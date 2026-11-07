// Déplacer un corps et Échelle : choisir un axe, une direction ou un point (bmPickStart, src/85-deplacer-corps.js).
// Le navigateur montre des pastilles dans la vue ; ici, le choix se fait dans un menu, après le clic sur une face.
#include <wx/wx.h>
#include <wx/treectrl.h>

#include <BRepBndLib.hxx>
#include <BRepGProp.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <TopAbs_ShapeEnum.hxx>

#include <cmath>
#include <set>

#include "assemblage.h"
#include "cadre.h"
#include "enregistrer.h"
#include "fiches.h"

namespace {
wxString tx8(const std::string& s) { return wxString::FromUTF8(s); }
// bmFmt : 3 décimales, zéros de fin retirés, virgule
std::string fmt(double v, int n = 3) {
  char b[64];
  snprintf(b, sizeof b, "%.*f", n, v);
  std::string s = b;
  if (s.find('.') != std::string::npos) {
    while (s.back() == '0') s.pop_back();
    if (s.back() == '.') s.pop_back();
  }
  if (s == "-0") s = "0";
  for (char& c : s)
    if (c == '.') c = ',';
  return s;
}
std::string arrondi3(double v) {  // +(2*r).toFixed(3), puis texte
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  std::string s = b;
  while (s.back() == '0') s.pop_back();
  if (s.back() == '.') s.pop_back();
  return s;
}
assemblage::V3 unitaire(const assemblage::V3& v) {
  const double L = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return L > 1e-12 ? assemblage::V3{v[0] / L, v[1] / L, v[2] / L} : v;
}
nlohmann::ordered_json jsonV(const assemblage::V3& v) { return nlohmann::ordered_json::array({v[0], v[1], v[2]}); }
assemblage::V3 lireV(const nlohmann::ordered_json& j) {
  assemblage::V3 v{0, 0, 0};
  if (j.is_array() && j.size() >= 3)
    for (int i = 0; i < 3; i++)
      if (j[i].is_number()) v[i] = j[i].get<double>();
  return v;
}
}  // namespace

// bmBodyCentre : le centre de gravité, sinon le centre de la boîte
bool Cadre::bmCentreCorps(const std::string& id, assemblage::V3& c) const {
  const TopoDS_Shape s = solideDuCorps(id);
  if (s.IsNull()) return false;
  GProp_GProps g;
  BRepGProp::VolumeProperties(s, g);
  if (g.Mass() > 1e-9) {
    const gp_Pnt p = g.CentreOfMass();
    c = {p.X(), p.Y(), p.Z()};
    return true;
  }
  Bnd_Box b;
  BRepBndLib::Add(s, b);
  if (b.IsVoid()) return false;
  double x0, y0, z0, x1, y1, z1;
  b.Get(x0, y0, z0, x1, y1, z1);
  c = {(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2};
  return true;
}

std::vector<Cadre::OptionBm> Cadre::bmOptionsFixes(const std::string& corps, bool axes) const {
  std::vector<OptionBm> out;
  nlohmann::ordered_json d;
  try {
    d = documentJson(doc_);
  } catch (const std::exception&) {
  }
  const nlohmann::ordered_json vide = nlohmann::ordered_json::array();
  const auto& cgeo = d.contains("cgeo") && d["cgeo"].is_array() ? d["cgeo"] : vide;
  const auto nom = [](const nlohmann::ordered_json& g, const char* defaut) {
    const std::string n = g.contains("name") && g["name"].is_string() ? g["name"].get<std::string>() : std::string();
    return n.empty() ? std::string(defaut) : n;
  };
  if (axes) {  // bmStaticAxes
    assemblage::V3 c;
    const bool aCentre = bmCentreCorps(corps, c);
    static const char* const K[3] = {"X", "Y", "Z"};
    for (int i = 0; i < 3; i++) {
      assemblage::V3 dir{0, 0, 0};
      dir[i] = 1;
      out.push_back({std::string(K[i]) + " (origine)", {0, 0, 0}, {0, 0, 0}, dir});
    }
    if (aCentre)
      for (int i = 0; i < 3; i++) {
        assemblage::V3 dir{0, 0, 0};
        dir[i] = 1;
        out.push_back({std::string(K[i]) + " (centre du corps)", {0, 0, 0}, c, dir});
      }
    for (const auto& g : cgeo) {
      if (!g.is_object() || !g.contains("fr")) continue;
      const std::string kind = g.value("kind", std::string());
      const auto& fr = g["fr"];
      if (kind == "axis") out.push_back({nom(g, "Axe"), {0, 0, 0}, lireV(fr["o"]), lireV(fr["z"])});
      if (kind == "frame")
        for (const char* k : {"x", "y", "z"}) {
          const std::string K2(1, static_cast<char>(k[0] - 32));
          out.push_back({nom(g, "Repère") + " · " + K2, {0, 0, 0}, lireV(fr["o"]), lireV(fr[k])});
        }
    }
    return out;
  }
  // bmStaticPts
  out.push_back({"Origine", {0, 0, 0}});
  for (size_t i = 0; i < doc_.corps.size(); i++) {
    assemblage::V3 c;
    if (bmCentreCorps(doc_.corps[i], c)) out.push_back({"Centre de « " + (i < doc_.nomsCorps.size() ? doc_.nomsCorps[i] : doc_.corps[i]) + " »", c});
  }
  for (const auto& g : cgeo) {
    if (!g.is_object() || !g.contains("fr")) continue;
    const std::string kind = g.value("kind", std::string());
    if (kind == "point" || kind == "frame") out.push_back({nom(g, "Point") + (kind == "frame" ? " (origine)" : ""), lireV(g["fr"]["o"])});
  }
  return out;
}

// bmFaceAxes et les points d'accroche de la face cliquée
std::vector<Cadre::OptionBm> Cadre::bmOptionsFace(const TopoDS_Shape& s, bool axes) const {
  std::vector<OptionBm> out;
  const auto faces = assemblage::extraireAccroches({s});
  if (faces.empty()) return out;
  const assemblage::FaceAccroche& F = faces[0];
  if (axes) {
    if (F.k == "cyl") out.push_back({"Axe du cylindre Ø" + fmt(2 * F.r), {0, 0, 0}, F.c, F.n});
    else out.push_back({"Normale de la face", {0, 0, 0}, F.c, F.n});
    std::set<std::string> vus;
    for (const assemblage::AreteAccroche& e : F.aretes) {
      if (e.k == "circ") {
        char b[128];
        snprintf(b, sizeof b, "%.4f,%.4f,%.4f", e.c[0], e.c[1], e.c[2]);
        if (!vus.insert(b).second) continue;
        out.push_back({"Axe du cercle Ø" + fmt(2 * e.r), {0, 0, 0}, e.c, e.n});
      } else if (e.k == "line") {
        out.push_back({"Arête droite", {0, 0, 0}, e.m, e.d});
      }
    }
    return out;
  }
  const std::string nomFace = F.k == "plane" ? "Face plane" : "Cylindre Ø" + arrondi3(2 * F.r);
  for (const assemblage::PointAccroche& it : assemblage::pointsDe(F)) out.push_back({nomFace + " · " + it.nom, it.fr.o});
  return out;
}

void Cadre::bmFin() {
  pioche_ = nullptr;
  piocheAnnulee_ = nullptr;
  bmFid_.clear();
  bmWant_.clear();
  bmAFrom_ = false;
}

// La saisie du centre se lit sur le corps d'origine : l'échelle est sortie du rejeu (occSkipFeat)
void Cadre::bmSansEchelle(const std::string& fid, bool sans) {
  for (Fonction& f : doc_.fonctions)
    if (f.id == fid && f.type == "bscale" && f.visible == sans) {
      f.visible = !sans;
      bmMasquee_ = sans ? fid : std::string();
      recalculer();
    }
}

void Cadre::bmPoser(const OptionBm& o) {
  const std::string fid = bmFid_, want = bmWant_;
  const OptionBm depart = bmFrom_;
  const std::string masquee = bmMasquee_;
  bmFin();
  bmMasquee_.clear();
  for (Fonction& f : doc_.fonctions)
    if (f.id == masquee) f.visible = true;  // avant la copie pour l'annulation
  nlohmann::ordered_json step;
  wxString bilan;
  if (want == "center") {
    nlohmann::ordered_json v = {{"name", o.nom}, {"p", jsonV(o.p)}};
    bilan = L"Échelle : centre = " + tx8(o.nom) + L".";
    appliquerFiche(fid, "x/centre", v.dump());
    etat(bilan);
    return;
  }
  if (want == "to") {
    step = {{"k", "p"}, {"a", jsonV(depart.p)}, {"b", jsonV(o.p)}, {"na", depart.nom}, {"nb", o.nom}};
    bilan = tx8("Point à point : " + depart.nom + " → " + o.nom + ".");
  } else if (want == "axis") {
    step = {{"k", "r"}, {"o", jsonV(o.o)}, {"d", jsonV(unitaire(o.d))}, {"deg", 90}, {"name", o.nom}};
    bilan = tx8("Rotation de 90° autour de « " + o.nom + " » — réglez l’angle dans le panneau.");
  } else {
    step = {{"k", "d"}, {"o", jsonV(o.o)}, {"d", jsonV(unitaire(o.d))}, {"dist", 10}, {"name", o.nom}};
    bilan = tx8("Translation de 10 mm suivant « " + o.nom + " » — réglez la distance dans le panneau.");
  }
  appliquerFiche(fid, "x/etapeJson", step.dump());
  etat(bilan);
}

// Le menu des choix : ce qui vient de la face cliquée, ou ce qui existe toujours
void Cadre::bmMenu(const std::vector<OptionBm>& L, bool avecFace) {
  wxMenu m;
  enum { FACE = wxID_HIGHEST + 6300, O0 };
  if (avecFace) {
    m.Append(FACE, L"🎯 Cliquer une face dans la vue…");
    m.AppendSeparator();
  }
  for (size_t i = 0; i < L.size(); i++) m.Append(O0 + static_cast<int>(i), tx8(L[i].nom));
  const int c = choisirMenu(m);
  if (c >= O0 && c < O0 + static_cast<int>(L.size())) {
    const OptionBm o = L[c - O0];
    if (bmWant_ == "from") {
      bmFrom_ = o;
      bmAFrom_ = true;
      bmWant_ = "to";
      if (!essaiMenu_) CallAfter([this] { if (!bmFid_.empty()) bmEtape(); });
      else etat(tx8("Départ : " + o.nom));
      return;
    }
    bmPoser(o);
    return;
  }
  if (c == FACE) {
    pioche_ = [this](const TopoDS_Shape& s) { return bmFaceCliquee(s); };
    const bool ax = bmWant_ == "axis" || bmWant_ == "dir";
    etat(wxString::Format(L"Cliquez une face pour ses %s (Échap pour annuler).", ax ? L"axes" : L"points"));
    return;
  }
  if (avecFace || bmMasquee_.size()) bmAnnuler();
}

bool Cadre::bmFaceCliquee(const TopoDS_Shape& s) {
  const bool ax = bmWant_ == "axis" || bmWant_ == "dir";
  std::vector<OptionBm> L;
  if (!s.IsNull() && s.ShapeType() == TopAbs_FACE) L = bmOptionsFace(s, ax);
  if (L.empty()) {
    etat(L"Cliquez une face plane ou cylindrique d'un corps exact, ou Échap pour annuler.");
    return false;
  }
  bmMenu(L, false);
  return true;
}

void Cadre::bmEtape() {
  const bool ax = bmWant_ == "axis" || bmWant_ == "dir";
  std::string corps;
  for (const Fonction& f : doc_.fonctions)
    if (f.id == bmFid_) corps = f.corps;
  if (bmWant_ == "to") etat(tx8("Départ : " + bmFrom_.nom + ". Choisissez le point d’arrivée."));
  bmMenu(bmOptionsFixes(corps, ax), true);
}

void Cadre::bmAnnuler() {
  const std::string masquee = bmMasquee_;
  bmFin();
  if (!masquee.empty()) bmSansEchelle(masquee, false);
  etat(L"Saisie annulée.");
}

void Cadre::bmDemarrer(const std::string& fid, const std::string& want) {
  pioche_ = nullptr;
  bmFid_ = fid;
  bmWant_ = want;
  bmAFrom_ = false;
  piocheAnnulee_ = [this] { bmAnnuler(); };
  if (want == "center") bmSansEchelle(fid, true);
  bmEtape();
}

void Cadre::bsCentreCorps(const std::string& fid) {
  std::string corps;
  for (const Fonction& f : doc_.fonctions)
    if (f.id == fid) corps = f.corps;
  bmSansEchelle(fid, true);
  assemblage::V3 c;
  const bool ok = bmCentreCorps(corps, c);
  std::string nomCorps = corps;
  for (size_t i = 0; i < doc_.corps.size(); i++)
    if (doc_.corps[i] == corps && i < doc_.nomsCorps.size()) nomCorps = doc_.nomsCorps[i];
  bmFid_ = fid, bmWant_ = "center";
  if (ok) bmPoser({"Centre de « " + nomCorps + " »", c});
  else bmAnnuler();
}

void Cadre::boutonsDeplacer(const Fonction& f, std::vector<std::pair<wxString, std::function<void()>>>& boutons) {
  const std::string id = f.id;
  if (f.type == "bmove") {
    boutons.push_back({L"➜ Suivant une direction…", [this, id] { bmDemarrer(id, "dir"); }});
    boutons.push_back({L"⟳ Rotation…", [this, id] { bmDemarrer(id, "axis"); }});
    boutons.push_back({L"⊙ Point à point…", [this, id] { bmDemarrer(id, "from"); }});
  } else if (f.type == "bscale") {
    boutons.push_back({L"Centre : origine", [this, id] {
                         const nlohmann::ordered_json v = {{"name", "Origine"}, {"p", {0, 0, 0}}};
                         appliquerFiche(id, "x/centre", v.dump());
                       }});
    boutons.push_back({L"Centre du corps", [this, id] { bsCentreCorps(id); }});
    boutons.push_back({L"⊙ Choisir un point…", [this, id] { bmDemarrer(id, "center"); }});
  }
}
