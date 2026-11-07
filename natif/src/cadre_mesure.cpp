// La mesure à la souris : Ctrl+clic en Modéliser comme en Assembler, Maj+clic sur un cylindre
// (faceSelect, edgeSelect, shiftMeasure de 90-10-selection-mesure.js). Rien n'est modifié dans la pièce.
#include <BRepBndLib.hxx>
#include <BRepGProp.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <TopExp.hxx>
#include <TopExp_Explorer.hxx>
#include <TopLoc_Location.hxx>
#include <TopTools_IndexedDataMapOfShapeListOfShape.hxx>
#include <TopoDS.hxx>

#include <algorithm>

#include "cadre.h"
#include "nombres_js.h"
#include "noms.h"

namespace as = assemblage;
using J = nlohmann::ordered_json;

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
// Le navigateur écrit sur plusieurs lignes, la barre d'état sur une seule
wxString uneLigne(const std::string& s) {
  wxString t = tx(s);
  t.Replace(L"\n", L"  ·  ");
  return t;
}
std::string texteDe(const J& j, const char* k) {
  const auto it = j.find(k);
  return it != j.end() && it->is_string() ? it->get<std::string>() : std::string();
}
// Le rang de la face dans son corps, à partir de 1 (selFaceInfo)
int rangDansCorps(const TopoDS_Shape& corps, const TopoDS_Shape& face) {
  int k = 0;
  for (TopExp_Explorer ex(corps, TopAbs_FACE); ex.More(); ex.Next()) {
    k++;
    if (ex.Current().IsSame(face)) return k;
  }
  return 0;
}
}  // namespace

std::string Cadre::mesureOrigine(const TopoDS_Shape& corps, const std::vector<TopoDS_Shape>& faces) const {  // selOrigine
  std::vector<std::string> L;
  for (const TopoDS_Shape& f : faces) {
    const std::string nom = nomsFaceDe(corps, f);
    if (nom.empty()) continue;
    std::string t;
    if (nom.rfind("congé[", 0) == 0) t = "Congé";
    else if (nom.rfind("chanfrein[", 0) == 0) t = "Chanfrein";
    else {
      // « ex_3_abc/e6/flanc » : l'identifiant de la fonction est avant la première barre
      const std::string id = nom.substr(0, nom.find('/'));
      for (const Fonction& q : doc_.fonctions)
        if (q.id == id) t = q.nom.empty() ? q.id : q.nom;
    }
    if (!t.empty() && std::find(L.begin(), L.end(), t) == L.end()) L.push_back(t);
  }
  std::string r;
  for (size_t i = 0; i < L.size(); i++) r += (i ? " / " : "") + L[i];
  return r;
}

Cadre::MesureCoup Cadre::mesureLire(const Vue3D::CoupVue& c) const {
  MesureCoup m;
  m.s = c.s;
  m.t = c.t;
  m.p = c.p;
  m.propre = c.propre && asmMode_ != "asm";
  if (c.s.ShapeType() == TopAbs_FACE) m.g = mesure::geoFace(TopoDS::Face(c.s), c.t);
  // Le corps qui porte cette face, et son nom (bodyName, asmMeasName)
  if (m.propre) {
    for (const auto& [id, s] : formesCorps_) {
      if (c.s.ShapeType() == TopAbs_FACE && rangDansCorps(s, c.s) == 0) continue;
      if (c.s.ShapeType() != TopAbs_FACE) {
        bool dedans = false;
        for (TopExp_Explorer ex(s, TopAbs_EDGE); ex.More() && !dedans; ex.Next()) dedans = ex.Current().IsSame(c.s);
        if (!dedans) continue;
      }
      m.corps = s;
      const size_t i = std::find(doc_.corps.begin(), doc_.corps.end(), id) - doc_.corps.begin();
      m.nom = i < doc_.nomsCorps.size() ? doc_.nomsCorps[i] : id;
      break;
    }
  } else if (doc_.assemblage) {
    const J& a = *doc_.assemblage;
    std::string n;
    const J* comp = as::composant(a, as::racine(a));
    for (const std::string& id : c.chemin) {
      const J* o = nullptr;
      if (comp && comp->contains("occ"))
        for (const J& q : (*comp)["occ"])
          if (texteDe(q, "id") == id) o = &q;
      if (!o) break;
      n += (n.empty() ? "" : " › ") + texteDe(*o, "name");
      comp = as::composant(a, texteDe(*o, "comp"));
    }
    if (n.empty()) {
      const J* r = as::composant(a, as::racine(a));
      n = r ? texteDe(*r, "name") : std::string();
    }
    m.nom = n.empty() ? "pièce" : n;
    const auto it = asmSolides_.find(as::compDuChemin(a, c.chemin));
    if (it != asmSolides_.end() && c.s.ShapeType() == TopAbs_FACE)
      for (const auto& q : it->second->corps)
        if (const int k = rangDansCorps(q.second, c.s)) {
          m.rang = k;
          break;
        }
  }
  if (!m.corps.IsNull() && c.s.ShapeType() == TopAbs_FACE) m.rang = rangDansCorps(m.corps, c.s);
  return m;
}

std::string Cadre::mesureLibelleFace(const MesureCoup& m) const {
  return "Face" + (m.rang ? " " + std::to_string(m.rang) : std::string()) + " : " + m.nom;
}

void Cadre::mesureEffacer(bool discret) {
  const bool vu = !mesDessin_.vide();
  mesA_.reset();
  mesAretes_.clear();
  mesDessin_ = mesure::Dessin();
  if (vu) {
    vue_->montrerMesure(mesDessin_);
    if (!discret) etat(L"Mesure effacée.");
  }
}

void Cadre::mesureCoup(const Vue3D::CoupVue* c, bool ctrl, bool maj) {
  if (pioche_ || faces_ || choix_) return;
  if (maj && !ctrl) {  // shiftMeasure
    if (!c || c->s.ShapeType() != TopAbs_FACE) return;
    const MesureCoup m = mesureLire(*c);
    if (m.g.sorte == mesure::GeoFace::Cylindre) {
      etat(uneLigne(mesure::mesurerCylindre(m.g, m.p, mesDessin_)));
    } else {
      Bnd_Box b;
      BRepBndLib::Add(m.corps.IsNull() ? c->s : m.corps, b);
      if (b.IsVoid()) return;
      double x0, y0, z0, x1, y1, z1;
      b.Get(x0, y0, z0, x1, y1, z1);
      const double sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
      double d = std::min({sx, sy, sz});
      if (d == 0) d = std::max({sx, sy, sz});
      mesDessin_.cotes.push_back({m.p, gp_Pnt(m.p.X(), m.p.Y(), m.p.Z() + d / 2), "Ø≈" + js::fixe(d, 1)});
      etat(uneLigne("Arête/solide : " + m.nom + "\nØ approx (boîte englobante) ≈ " + js::fixe(d, 2) + " mm\n(Cliquez une face cylindrique pour l’Ø exact.)"));
    }
    vue_->montrerMesure(mesDessin_);
    return;
  }
  // Un clic simple : la première face d'une mesure, ce que la pièce affiche déjà suffit
  if (!ctrl) {
    mesureEffacer(true);
    if (c && c->s.ShapeType() == TopAbs_FACE) mesA_ = mesureLire(*c);
    else if (c && c->s.ShapeType() == TopAbs_EDGE) {
      const std::vector<gp_Pnt> P = mesure::pointsArete(TopoDS::Edge(c->s), c->t);
      if (P.size() >= 2) {
        mesAretes_ = {mesure::geoArete(P)};
        mesDessin_.aretes.push_back(P);
        vue_->montrerMesure(mesDessin_);
      }
    }
    return;
  }
  if (!c) return;
  const MesureCoup P = mesureLire(*c);
  if (c->s.ShapeType() == TopAbs_EDGE) {  // edgeSelect
    const std::vector<gp_Pnt> pts = mesure::pointsArete(TopoDS::Edge(c->s), c->t);
    if (pts.size() < 2) return;
    const mesure::GeoArete G = mesure::geoArete(pts);
    if (mesAretes_.empty()) {
      mesureEffacer(true);
      mesAretes_ = {G};
      mesDessin_.aretes.push_back(pts);
      std::string origine;
      int n = 0;
      if (P.propre && !P.corps.IsNull()) {
        TopTools_IndexedDataMapOfShapeListOfShape carte;
        TopExp::MapShapesAndAncestors(P.corps, TopAbs_EDGE, TopAbs_FACE, carte);
        n = carte.FindIndex(c->s);
        if (n > 0) {
          std::vector<TopoDS_Shape> faces;
          for (const TopoDS_Shape& f : carte.FindFromIndex(n)) faces.push_back(f);
          origine = mesureOrigine(P.corps, faces);
        }
      }
      etat(uneLigne("Arête" + (n ? " " + std::to_string(n) : std::string()) + " : " + mesure::decrireArete(G) + (origine.empty() ? "" : "\nCréée par : " + origine) + "\nCtrl+clic une 2e arête : distance perpendiculaire, angle ou entraxe."));
    } else {
      mesAretes_.push_back(G);
      mesDessin_.aretes.push_back(pts);
      etat(uneLigne(mesure::mesurerAretes(mesAretes_[0], G, mesDessin_)));
    }
    vue_->montrerMesure(mesDessin_);
    return;
  }
  // faceSelect
  if (!mesAretes_.empty() && !mesA_) {
    for (auto& a : mesDessin_.aretes) a.clear();
    mesDessin_.aretes.clear();
    mesAretes_.clear();
  }
  const auto surbrillance = [&] {
    if (!P.propre) mesDessin_.faces.push_back(c->s.Moved(TopLoc_Location(c->t)));
  };
  if (!mesA_) {
    mesureEffacer(true);
    mesA_ = P;
    surbrillance();
    if (P.g.sorte == mesure::GeoFace::Cylindre) {
      mesDessin_.axes.push_back({P.g.p, P.g.n});
      mesDessin_.etiquettes.push_back({"Ø " + js::fixe(P.g.r * 2, 2), P.p});
    }
    GProp_GProps g;
    BRepGProp::SurfaceProperties(c->s, g);
    std::string origine;
    if (P.propre && !P.corps.IsNull()) origine = mesureOrigine(P.corps, {c->s});
    const std::string sorte = P.g.sorte == mesure::GeoFace::Cylindre ? " · CYLINDRE Ø" + js::fixe(P.g.r * 2, 2) : P.g.sorte == mesure::GeoFace::Plan ? " · PLAN" : "";
    etat(uneLigne(mesureLibelleFace(P) + sorte + (origine.empty() ? "" : "\nCréée par : " + origine) + "\nAire ≈ " + js::fixe(g.Mass(), 1) + " mm²\nCtrl+clic une 2e face (entraxe auto si cylindres)"));
    vue_->montrerMesure(mesDessin_);
    return;
  }
  surbrillance();
  const std::string noms = mesureLibelleFace(*mesA_) + "\n" + mesureLibelleFace(P) + "\n";
  std::string texte;
  if (mesure::mesurerFaces(mesA_->g, mesA_->p, P.g, P.p, mesDessin_, texte)) {
    if (!P.propre || !mesA_->propre) texte = noms + texte;
  } else {
    const double d = mesA_->p.Distance(P.p);
    mesDessin_.cotes.push_back({mesA_->p, P.p, js::fixe(d, 2) + " mm"});
    texte = noms + "Distance points ≈ " + js::fixe(d, 2) + " mm";
  }
  etat(uneLigne(texte));
  vue_->montrerMesure(mesDessin_);
}

// L'essai automatique : un clic en un point de la pièce, avec ou sans Ctrl et Maj
bool Cadre::mesureEtapeEssai(const nlohmann::json& e, nlohmann::json& n) {
  if (e.contains("mesClic") || e.contains("mesPixel")) {
    wxPoint p;
    if (e.contains("mesClic")) {
      const auto& q = e["mesClic"];
      p = vue_->pixelDe(q[0].get<double>(), q[1].get<double>(), q[2].get<double>());
    } else {
      const wxSize T = vue_->GetClientSize();
      p = wxPoint(static_cast<int>(e["mesPixel"][0].get<double>() * T.x), static_cast<int>(e["mesPixel"][1].get<double>() * T.y));
    }
    vue_->essaiCtrl = e.value("ctrl", false) ? 1 : 0;
    vue_->essaiMaj = e.value("maj", false) ? 1 : 0;
    vue_->cliquerEn(p);
    vue_->essaiCtrl = vue_->essaiMaj = -1;
    n["cotes"] = mesDessin_.cotes.size();
    n["axes"] = mesDessin_.axes.size();
    n["etiquettes"] = mesDessin_.etiquettes.size();
    n["texteCotes"] = nlohmann::json::array();
    for (const mesure::Cote& k : mesDessin_.cotes) n["texteCotes"].push_back(k.texte);
    return true;
  }
  if (e.contains("mesEffacer")) {
    mesureEffacer(false);
    return true;
  }
  return false;
}
