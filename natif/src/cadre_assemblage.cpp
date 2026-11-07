// L'assemblage à l'écran : traduction de src/47-assemblage-interface.js, 48-assemblage-placement.js et de treeComps (42-arbre-modele.js).
#include <BRep_Builder.hxx>
#include <TopoDS_Compound.hxx>
#include <gp_Ax1.hxx>
#include <gp_Quaternion.hxx>
#include <gp_Trsf.hxx>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/msgdlg.h>
#include <wx/textdlg.h>

#include <algorithm>
#include <cmath>
#include <set>

#include "assemblage.h"
#include "cadre.h"
#include "conges.h"
#include "enregistrer.h"
#include "fiches.h"
#include "interface_esquisse.h"
#include "lien_arbre.h"
#include "rejeu.h"

namespace as = assemblage;
using J = nlohmann::ordered_json;

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::string texteDe(const J& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_string() ? x->get<std::string>() : std::string();
}
gp_Trsf trsfDe(const as::Repere& F) {
  gp_Trsf t;
  t.SetValues(F.x[0], F.y[0], F.z[0], F.o[0], F.x[1], F.y[1], F.z[1], F.o[1], F.x[2], F.y[2], F.z[2], F.o[2]);
  return t;
}
std::string nombreCourt(double v) {
  char b[40];
  snprintf(b, sizeof b, "%.3f", v);
  std::string s = b;
  while (!s.empty() && s.back() == '0') s.pop_back();
  if (!s.empty() && s.back() == '.') s.pop_back();
  for (char& c : s)
    if (c == '.') c = ',';
  return s;
}
bool estPrefixe(const as::Chemin& a, const as::Chemin& b) {
  if (a.size() > b.size()) return false;
  return std::equal(a.begin(), a.end(), b.begin());
}
as::Repere rotationAutour(const as::Repere& F, const as::V3& O, const as::V3& a, double ang) {
  // asmRotFr : rotation rigide autour de la droite (O, a)
  const gp_Dir d(a[0], a[1], a[2]);
  gp_Trsf r;
  r.SetRotation(gp_Ax1(gp_Pnt(O[0], O[1], O[2]), d), ang);
  const auto pt = [&](const as::V3& v) {
    gp_Pnt p(v[0], v[1], v[2]);
    p.Transform(r);
    return as::V3{p.X(), p.Y(), p.Z()};
  };
  const auto vc = [&](const as::V3& v) {
    gp_Vec p(v[0], v[1], v[2]);
    p.Transform(r);
    return as::V3{p.X(), p.Y(), p.Z()};
  };
  as::Repere R;
  R.o = pt(F.o);
  R.x = vc(F.x);
  R.y = vc(F.y);
  R.z = vc(F.z);
  return as::arrondir(R);
}
}  // namespace

bool Cadre::asmOn() const { return doc_.assemblage && (asmMode_ == "asm" || as::aDesEnfants(*doc_.assemblage)); }

void Cadre::asmApresRejeu(const ResultatRejeu& r, bool ajuster) {
  if (!doc_.assemblage) {
    asmSolides_.clear();
    vue_->montrerOccurrences({});
    vue_->modePlacer(false);
    asmMode_ = "part";
    ruban_->modeAssemblage(false);
    return;
  }
  auto copie = std::make_shared<J>(*doc_.assemblage);
  doc_.assemblage = copie;
  {
    wxBusyCursor attente;
    as::majSolides(asmSolides_, doc_, r);
    as::resoudre(*copie, asmSolides_);
  }
  asmDessiner();
  if (ajuster) vue_->ajuster();
}

// asmFill : tout l'arbre, dans le repère de l'instance éditée
void Cadre::asmDessiner() {
  std::vector<Vue3D::OccVue> L;
  if (doc_.assemblage && atelier_ == Atelier::CAO) {
    const J& a = *doc_.assemblage;
    const as::Chemin P = as::cheminActif(a);
    const size_t n = P.size();
    as::Repere W;
    as::monde(a, P, W);
    const as::Repere V = as::inverser(W);
    const bool placer = asmMode_ == "asm";
    for (const as::Instance& inst : as::instances(a, as::racine(a))) {
      const auto it = asmSolides_.find(inst.comp);
      if (it == asmSolides_.end() || it->second->forme.IsNull() || as::cheminMasque(a, inst.chemin)) continue;
      const bool mine = estPrefixe(P, inst.chemin);
      const bool self = mine && inst.chemin.size() == n;
      if (self) continue;  // le composant actif est la pièce affichée
      Vue3D::OccVue v;
      as::SolideComposant& S = *it->second;
      v.forme = S.forme;
      v.t = trsfDe(as::composer(V, inst.F));
      v.teintes = S.teintes;
      v.transparences = S.transparences;
      v.fantome = !mine && placer;
      v.cliquable = mine && placer;
      if (v.cliquable) v.cle = inst.chemin[n];
      v.chemin = inst.chemin;
      double op, gl;
      std::string ar;
      as::apparenceDe(a, inst.chemin, op, gl, ar);
      if (op >= 0 || gl >= 0) v.transparence = 1 - std::min(op >= 0 ? op : 1.0, gl >= 0 ? gl : 1.0);
      if (!v.fantome && ar != "off") {
        if (!S.aretesFaites) {
          BRep_Builder bb;
          TopoDS_Compound vives, lisses;
          bb.MakeCompound(vives);
          bb.MakeCompound(lisses);
          for (const auto& c : S.corps)
            for (const AreteVue& q : aretesVisibles(c.second)) bb.Add(q.vive ? vives : lisses, q.arete);
          S.vives = vives;
          S.lisses = lisses;
          S.aretesFaites = true;
        }
        v.aretes = true;
        v.vives = S.vives;
        v.lisses = S.lisses;
      }
      L.push_back(std::move(v));
    }
  }
  vue_->cheminPiece(doc_.assemblage ? as::cheminActif(*doc_.assemblage) : as::Chemin{});
  vue_->modePlacer(asmMode_ == "asm" && atelier_ == Atelier::CAO);
  vue_->montrerOccurrences(L);
  asmMontrerChoix();
}

void Cadre::asmMontrerChoix() {
  const std::vector<std::string> lot = asmLot();
  vue_->choisirOccurrences(std::set<std::string>(lot.begin(), lot.end()));
  asmGizmo();
  for (const auto& [id, ligne] : lignesOcc_) {
    if (!ligne.IsOk()) continue;
    const bool on = std::find(lot.begin(), lot.end(), id) != lot.end();
    arbre_->SetItemBackgroundColour(ligne, on ? wxColour(0x0a, 0x4a, 0x8a) : wxColour(0x2a, 0x2c, 0x30));
  }
}

// asmLotIds : le lot vaut tant qu'il contient l'occurrence sélectionnée
std::vector<std::string> Cadre::asmLot() const {
  std::vector<std::string> r;
  if (!doc_.assemblage || asmSel_.empty()) return r;
  const J* c = as::composant(*doc_.assemblage, as::actif(*doc_.assemblage));
  if (!c || !c->contains("occ")) return r;
  const auto ok = [&](const std::string& id) {
    for (const J& o : (*c)["occ"])
      if (texteDe(o, "id") == id) return true;
    return false;
  };
  if (std::find(asmLot_.begin(), asmLot_.end(), asmSel_) != asmLot_.end()) {
    for (const std::string& id : asmLot_)
      if (ok(id)) r.push_back(id);
    if (!r.empty()) return r;
  }
  if (ok(asmSel_)) r.push_back(asmSel_);
  return r;
}

// asmShow : va à l'instance, en mode 'part' (Modéliser) ou 'asm' (Placer)
void Cadre::asmAller(const as::Chemin& chemin, const std::string& mode, const std::string& choisie) {
  if (!docOuvert_) return;
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  quitterConge();
  asmAlignAnnuler(false);
  if (!doc_.assemblage) {
    // asmEnsure : le document devient la racine d'un assemblage
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
    solideCalculable_ = doc_.nonPrisEnCharge.empty();
  }
  const J& a = *doc_.assemblage;
  as::Chemin p = as::compDuChemin(a, chemin).empty() ? as::Chemin{} : chemin;
  const std::string cid = as::compDuChemin(a, p);
  const bool change = cid != as::actif(a);
  const bool bouge = p != as::cheminActif(a);
  const bool premier = asmMode_ != mode;
  asmMode_ = mode;
  ruban_->modeAssemblage(mode == "asm");
  if (change) {
    const bool etaitModifie = doc_.modifie();
    // Le rejeu restera valable pour ce composant quand il ne sera plus actif
    auto ancien = asmSolides_.find(as::actif(a));
    std::shared_ptr<as::SolideComposant> garde = ancien != asmSolides_.end() ? ancien->second : nullptr;
    const std::string idAncien = as::actif(a);
    // Une annulation portant sur les esquisses ne vaut que pour ce composant ; le document entier, lui, reste valable
    auto avant = std::make_shared<Document>(doc_);
    annulations_.erase(std::remove_if(annulations_.begin(), annulations_.end(), [](const ModifCote& m) { return !m.docAvant; }), annulations_.end());
    retablissements_.clear();
    ModifCote m;
    m.docAvant = avant;
    annulations_.push_back(std::move(m));
    const J resolu = *doc_.assemblage;
    modifierStructure(doc_, [&](J& d) {
      d["asm"] = resolu;
      d["asm"]["mode"] = mode;
      as::activer(d, cid, p);
    });
    doc_.basculeSeule = !etaitModifie;
    if (garde && doc_.assemblage) {
      if (const J* c = as::composant(*doc_.assemblage, idAncien); c && c->contains("doc") && (*c)["doc"].is_object()) {
        const std::string texte = (*c)["doc"].dump(-1, ' ', false, J::error_handler_t::replace);
        garde->empreinte = std::to_string(std::hash<std::string>()(texte)) + ":" + std::to_string(texte.size());
      }
    }
    marqueTemps_.clear();
    asmSel_ = choisie;
    asmLot_.clear();
    ajusterVue_ = true;
    apresStructure();
  } else {
    auto copie = std::make_shared<J>(a);
    (*copie)["path"] = p;
    (*copie)["mode"] = mode;
    doc_.assemblage = copie;
    const J* c = as::composant(*copie, cid);
    asmSel_ = choisie;
    if (asmSel_.empty() && c && mode == "asm" && !asmLot_.empty()) asmSel_.clear();
    asmLot_.clear();
    remplirArbre();
    montrerRien();
    asmDessiner();
    if (premier || bouge) vue_->ajuster();
  }
  const J* c = as::composant(*doc_.assemblage, as::actif(*doc_.assemblage));
  const wxString nom = c ? tx(texteDe(*c, "name")) : wxString();
  if (mode == "asm") etat(L"Placer les composants de « " + nom + L" » : clic = sélectionner · double-clic = modéliser" + (p.empty() ? L"." : L" · Échap = remonter."));
  else etat(L"Modéliser « " + nom + L" »" + (as::aDesEnfants(*doc_.assemblage) ? L" · le reste de l'assemblage est autour. « Assembler » pour déplacer ses composants." : L""));
}

// asmToggle : l'aller-retour sans quitter la pièce
void Cadre::asmBasculer() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (asmMode_ == "asm") {
    as::Chemin P = doc_.assemblage ? as::cheminActif(*doc_.assemblage) : as::Chemin{};
    if (!asmSel_.empty()) P.push_back(asmSel_);
    return asmAller(P, "part");
  }
  if (doc_.assemblage) {
    const as::Chemin P = as::cheminActif(*doc_.assemblage);
    const J* c = as::composant(*doc_.assemblage, as::actif(*doc_.assemblage));
    if (c && (!c->contains("occ") || (*c)["occ"].empty()) && !P.empty()) {
      as::Chemin haut = P;
      haut.pop_back();
      return asmAller(haut, "asm", P.back());
    }
    return asmAller(P, "asm");
  }
  asmAller({}, "asm");
}

void Cadre::asmRemonter() {
  if (!doc_.assemblage) return;
  as::Chemin P = as::cheminActif(*doc_.assemblage);
  if (P.empty()) return;
  const std::string d = P.back();
  P.pop_back();
  asmAller(P, "asm", d);
}

// Chaque modification repart de l'état replacé et passe par la même porte que le reste : annulable, enregistrée
void Cadre::changerAssemblage(const std::function<void(J&)>& f, const wxString& message) {
  if (!doc_.assemblage) return;
  const J resolu = *doc_.assemblage;
  changerStructure([&](J& d) {
    d["asm"] = resolu;
    f(d["asm"]);
  }, message);
}

void Cadre::asmCliqueOcc(const std::string& id, bool ctrl, bool maj) {
  if (asmAlign_) return;
  if (!doc_.assemblage) return;
  const J* c = as::composant(*doc_.assemblage, as::actif(*doc_.assemblage));
  if (id.empty() || !c) {
    asmSel_.clear();
    asmAncre_.clear();
    asmLot_.clear();
  } else if (maj) {
    std::vector<std::string> ord;
    for (const J& o : (*c)["occ"]) ord.push_back(texteDe(o, "id"));
    const auto rang = [&](const std::string& x) {
      const auto k = std::find(ord.begin(), ord.end(), x);
      return k == ord.end() ? -1 : static_cast<int>(k - ord.begin());
    };
    int a = rang(asmAncre_) >= 0 ? rang(asmAncre_) : rang(asmSel_);
    const int b = rang(id);
    if (a < 0) a = b;
    std::vector<std::string> L = ctrl ? asmLot() : std::vector<std::string>{};
    for (int k = std::min(a, b); k <= std::max(a, b); k++)
      if (std::find(L.begin(), L.end(), ord[k]) == L.end()) L.push_back(ord[k]);
    asmLot_ = L;
    asmSel_ = id;
  } else if (ctrl) {
    std::vector<std::string> L = asmLot();
    const auto k = std::find(L.begin(), L.end(), id);
    const bool retire = k != L.end();
    if (retire) L.erase(k);
    else L.push_back(id);
    asmAncre_ = id;
    asmLot_ = L;
    asmSel_ = retire ? (L.empty() ? std::string() : L.back()) : id;
  } else {
    asmAncre_ = id;
    asmLot_.clear();
    asmSel_ = id;
  }
  asmMontrerChoix();
  montrerRien();
  if (const J* o = asmSel_.empty() ? nullptr : as::occurrence(*doc_.assemblage, asmSel_)) {
    const J* cc = as::composant(*doc_.assemblage, texteDe(*o, "comp"));
    etat(tx(texteDe(*o, "name")) + L" — composant « " + (cc ? tx(texteDe(*cc, "name")) : wxString()) + L" »" + (o->value("fixed", false) ? L" · fixée" : L"") + (o->contains("align") && (*o)["align"].is_object() ? L" · alignée" : L"") + L"   Double-clic = modéliser ce composant.");
  } else if (id.empty()) etat(L"Aucun composant ici.");
}

bool Cadre::asmEchap() {
  if (!doc_.assemblage || asmMode_ != "asm") return false;
  if (asmAlign_) {
    asmAlignAnnuler(true);
    return true;
  }
  if (asmAnim_.IsRunning()) {
    asmAnim_.Stop();
    montrerRien();
    return true;
  }
  if (!asmSel_.empty()) {
    asmCliqueOcc("", false, false);
    return true;
  }
  if (!as::cheminActif(*doc_.assemblage).empty()) {
    asmRemonter();
    return true;
  }
  return false;
}

// asmCmdNewComp : nouveau composant, enfant du composant actif ; on entre aussitôt dedans
void Cadre::asmNouveauComposant() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  if (!doc_.assemblage) {
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
  }
  const as::Chemin P = as::cheminActif(*doc_.assemblage);
  std::string idOcc, nomC, nomP;
  changerAssemblage([&](J& a) {
    J* ow = as::composant(a, as::actif(a));
    nomC = "Composant " + std::to_string(a["comps"].size());
    nomP = texteDe(*ow, "name");
    J c = J::object();
    const std::string id = as::nouvelIdentifiant("cp");
    c["id"] = id;
    c["kind"] = "comp";
    c["name"] = nomC;
    J doc = J::object();
    doc["name"] = nomC;
    doc["tint"] = 0;
    doc["sketches"] = J::array();
    doc["features"] = J::array();
    doc["cgeo"] = J::array();
    doc["bodyVis"] = J::object();
    doc["bodies"] = J::array();
    doc["bodySeq"] = 1;
    doc["activeBody"] = nullptr;
    doc["mep"] = nullptr;
    c["doc"] = std::move(doc);
    c["occ"] = J::array();
    c["link"] = nullptr;
    J o = as::nouvelleOccurrenceObjet(id, nomC + ":1", as::Repere());
    idOcc = texteDe(o, "id");
    a["comps"].push_back(std::move(c));
    (*as::composant(a, as::actif(a)))["occ"].push_back(std::move(o));
  });
  as::Chemin N = P;
  N.push_back(idOcc);
  asmAller(N, "part");
  etat(L"Nouveau composant « " + tx(nomC) + L" » dans « " + tx(nomP) + L" » : créez une esquisse. « Assembler » pour le positionner.");
}

// asmCmdNewOcc : décalée le long de X pour qu'on la voie
void Cadre::asmNouvelleOccurrence() {
  if (asmMode_ != "asm") asmBasculer();
  const J* src = asmSel_.empty() || !doc_.assemblage ? nullptr : as::occurrence(*doc_.assemblage, asmSel_);
  if (!src) return etat(L"Nouvelle occurrence : sélectionnez d'abord le composant à répéter (mode Assembler).");
  const std::string cid = texteDe(*src, "comp");
  as::Repere fr = as::repereDe(src->value("fr", J::object()));
  double dx = 50;
  if (const auto it = asmSolides_.find(cid); it != asmSolides_.end() && !it->second->forme.IsNull()) {
    const Mesures m = mesurer(it->second->forme);
    dx = std::max(10.0, 1.2 * (m.boite[3] - m.boite[0]));
  }
  fr.o[0] += dx;
  std::string id, nom;
  changerAssemblage([&](J& a) {
    nom = as::nomOccurrence(a, cid);
    J o = as::nouvelleOccurrenceObjet(cid, nom, as::arrondir(fr));
    id = texteDe(o, "id");
    (*as::composant(a, as::actif(a)))["occ"].push_back(std::move(o));
  });
  asmSel_ = id;
  asmLot_.clear();
  asmMontrerChoix();
  montrerRien();
  etat(L"Occurrence " + tx(nom) + L" ajoutée (décalée en X). Placez-la, ou alignez un repère.");
}

void Cadre::asmSupprimer(const std::vector<std::string>& ids) {
  if (!doc_.assemblage || ids.empty()) return;
  wxString question;
  {
    const J& a = *doc_.assemblage;
    wxString noms;
    std::set<std::string> cids;
    for (const std::string& id : ids)
      if (const J* o = as::occurrence(a, id)) {
        noms += (noms.empty() ? L"" : L", ") + tx(texteDe(*o, "name"));
        cids.insert(texteDe(*o, "comp"));
      }
    wxString perdus;
    for (const std::string& cid : cids) {
      bool autre = false;
      for (const J& c : a["comps"])
        if (c.contains("occ"))
          for (const J& o : c["occ"])
            if (texteDe(o, "comp") == cid && std::find(ids.begin(), ids.end(), texteDe(o, "id")) == ids.end()) autre = true;
      if (!autre)
        if (const J* c = as::composant(a, cid)) perdus += (perdus.empty() ? L"" : L", ") + tx(texteDe(*c, "name"));
    }
    question = ids.size() > 1 ? wxString::Format(L"Supprimer %zu occurrences ?\n\n%s", ids.size(), noms) : L"Supprimer l'occurrence « " + noms + L" » ?";
    if (!perdus.empty()) question += L"\n\nDernière occurrence de : " + perdus + L". Le composant sera supprimé avec ses sous-composants (Ctrl+Z pour annuler).";
  }
  if (!confirmerSuppression(question)) return;
  const as::Chemin P = as::cheminActif(*doc_.assemblage);
  asmAlignAnnuler(false);
  size_t k = P.size();
  for (const std::string& id : ids) k = std::min<size_t>(k, std::find(P.begin(), P.end(), id) - P.begin());
  if (k < P.size()) asmAller(as::Chemin(P.begin(), P.begin() + k), asmMode_);
  asmSel_.clear();
  asmLot_.clear();
  changerAssemblage([&](J& a) {
    for (const std::string& id : ids) as::supprimerOccurrence(a, id);
    if (a["comps"].size() == 1 && !as::aDesEnfants(a)) a["path"] = J::array();
  });
  etat(L"Supprimé. Ctrl+Z pour annuler.");
}

void Cadre::asmLotChaque(const std::function<void(J&)>& f) {
  const std::vector<std::string> L = asmLot();
  changerAssemblage([&](J& a) {
    for (const std::string& id : L)
      if (J* o = as::occurrence(a, id)) f(*o);
  });
}

void Cadre::asmInserer() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  wxFileDialog choix(this, L"Insérer un fichier comme composant", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad)|*.conceptcad", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
  if (choix.ShowModal() == wxID_OK) asmInsererFichier(choix.GetPath().ToStdWstring());
}

// asmInsertText : une copie du fichier, dont la racine devient un composant enfant du composant actif, identifiants renouvelés
bool Cadre::asmInsererFichier(const std::wstring& chemin) {
  J top;
  try {
    std::string b = lireOctets(chemin);
    if (b.size() >= 2 && static_cast<unsigned char>(b[0]) == 0x1f && static_cast<unsigned char>(b[1]) == 0x8b) b = degonfler(b);
    J racine = J::parse(b);
    top = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
    if (!top.contains("features") || !top["features"].is_array()) throw std::runtime_error("ce n'est pas un projet ConceptCAD");
    if (racine.contains("imports") && racine["imports"].is_object() && !racine["imports"].empty()) asmImports_ = racine["imports"];
    else asmImports_ = J();
  } catch (const std::exception& e) {
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Insertion impossible", wxOK | wxICON_WARNING, this);
    return false;
  }
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  if (!doc_.assemblage) {
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
  }
  std::string base = wxFileName(chemin).GetName().utf8_string();
  // à droite de ce qui est déjà affiché
  double dx = 0;
  {
    const J& a = *doc_.assemblage;
    bool vu = false;
    double hi = 0;
    for (const as::Instance& inst : as::instances(a, as::actif(a))) {
      const auto it = asmSolides_.find(inst.comp);
      if (it == asmSolides_.end() || it->second->forme.IsNull()) continue;
      const Mesures m = mesurer(it->second->forme);
      const double h = inst.F.o[0] + std::abs(inst.F.x[0]) * m.boite[3] + std::abs(inst.F.y[0]) * m.boite[4] + std::abs(inst.F.z[0]) * m.boite[5];
      hi = vu ? std::max(hi, h) : h;
      vu = true;
    }
    if (vu) dx = hi + 20;
  }
  std::string idOcc;
  changerAssemblage([&](J& a) {
    std::map<std::string, std::string> cm, om;
    J entrants = J::array();
    std::string racineId;
    if (top.contains("asm") && top["asm"].is_object() && top["asm"].contains("comps")) {
      J t = top["asm"];
      J docHaut = top;
      docHaut.erase("asm");
      racineId = as::racine(t);
      for (J& c : t["comps"]) {
        cm[texteDe(c, "id")] = as::nouvelIdentifiant("cp");
        if (c.contains("occ"))
          for (const J& o : c["occ"]) om[texteDe(o, "id")] = as::nouvelIdentifiant("oc");
        if (!c.contains("doc") || !c["doc"].is_object()) c["doc"] = docHaut;
      }
      entrants = t["comps"];
    } else {
      J c = J::object();
      racineId = "_r";
      c["id"] = racineId;
      c["kind"] = "comp";
      c["name"] = base;
      c["doc"] = top;
      c["occ"] = J::array();
      c["link"] = nullptr;
      cm[racineId] = as::nouvelIdentifiant("cp");
      entrants.push_back(std::move(c));
    }
    const auto renomme = [&](J& rel) {
      if (rel.is_object() && rel.contains("path") && rel["path"].is_array())
        for (J& x : rel["path"])
          if (x.is_string() && om.count(x.get<std::string>())) x = om[x.get<std::string>()];
    };
    for (J& c : entrants) {
      const std::string ancien = texteDe(c, "id");
      if (ancien == racineId) {
        c["name"] = base;
        c["doc"]["name"] = base;
      }
      c["id"] = cm[ancien];
      if (c.contains("occ"))
        for (J& o : c["occ"]) {
          o["id"] = om[texteDe(o, "id")];
          o["comp"] = cm[texteDe(o, "comp")];
          if (o.contains("align") && o["align"].is_object()) {
            if (o["align"].contains("src")) renomme(o["align"]["src"]);
            if (o["align"].contains("dst")) renomme(o["align"]["dst"]);
          }
        }
      a["comps"].push_back(std::move(c));
    }
    as::Repere fr;
    fr.o[0] = dx;
    J o = as::nouvelleOccurrenceObjet(cm[racineId], base + ":1", fr);
    idOcc = texteDe(o, "id");
    (*as::composant(a, as::actif(a)))["occ"].push_back(std::move(o));
  });
  asmImports_ = J();
  if (asmMode_ != "asm") asmAller(as::cheminActif(*doc_.assemblage), "asm", idOcc);
  asmSel_ = idOcc;
  asmLot_.clear();
  asmMontrerChoix();
  montrerRien();
  etat(L"Inséré : « " + tx(base) + L" ». Placez-le ou alignez un repère.");
  return true;
}

// ---- L'arbre (treeComps) ----
void Cadre::remplirComposants(const wxTreeItemId& racineArbre) {
  const J& a = *doc_.assemblage;
  const as::Chemin AP = as::cheminActif(a);
  const size_t n = AP.size();
  const wxColour grise(0x78, 0x78, 0x7d), bleu(0x0a, 0x84, 0xff);
  lignesOcc_.clear();
  const auto lien = [](LienArbre::Sorte s, const as::Chemin& c, const std::string& occ, bool direct) {
    auto* l = new LienArbre(false, -1);
    l->sorte = s;
    l->chemin = c;
    l->occ = occ;
    l->direct = direct;
    return l;
  };
  // treeCompContent : le contenu d'un composant non édité, en lecture seule
  const auto contenu = [&](const wxTreeItemId& parent, const as::Chemin& chemin, const J& D) {
    const auto ligne = [&](const wxTreeItemId& p, const wxString& t, int img) {
      const wxTreeItemId k = arbre_->AppendItem(p, t, img, -1, lien(LienArbre::CONTENU, chemin, "", false));
      arbre_->SetItemTextColour(k, grise);
      return k;
    };
    ligne(parent, L"Origine", 11);
    size_t nc = 0;
    if (D.contains("cgeo") && D["cgeo"].is_array())
      for (const J& k : D["cgeo"])
        if (k.is_object() && k.contains("kind")) nc++;
    if (nc) ligne(parent, wxString::Format(L"Construction (%zu)", nc), 11);
    if (D.contains("sketches") && D["sketches"].is_array() && !D["sketches"].empty()) {
      const wxTreeItemId s = ligne(parent, wxString::Format(L"Esquisses (%zu)", D["sketches"].size()), 0);
      for (const J& k : D["sketches"]) ligne(s, tx(texteDe(k, "name")), 0);
    }
    const J F = D.contains("features") && D["features"].is_array() ? D["features"] : J::array();
    J B = D.contains("bodies") && D["bodies"].is_array() && !D["bodies"].empty() ? D["bodies"] : J::array();
    if (B.empty()) {
      J b = J::object();
      b["id"] = "b1";
      b["name"] = "Corps 1";
      B.push_back(b);
    }
    const std::string premier = texteDe(B[0], "id");
    for (const J& b : B) {
      const std::string bid = texteDe(b, "id");
      std::vector<const J*> L;
      for (const J& f : F) {
        if (f.contains("repeatId") && f["repeatId"].is_string()) continue;
        const std::string fb = texteDe(f, "body");
        bool connu = false;
        for (const J& q : B) connu = connu || texteDe(q, "id") == fb;
        if ((connu ? fb : premier) == bid) L.push_back(&f);
      }
      const wxTreeItemId k = ligne(parent, tx(texteDe(b, "name")) + wxString::Format(L" · %zu fonction(s)", L.size()), 3);
      for (const J* f : L) ligne(k, tx(texteDe(*f, "name")), texteDe(*f, "op") == "cut" ? 2 : 1);
    }
  };
  std::function<void(const std::string&, const as::Chemin&, const wxTreeItemId&)> enfants;
  const std::function<void(const std::string&, const as::Chemin&, const wxTreeItemId&)> marcher = [&](const std::string& cid, const as::Chemin& chemin, const wxTreeItemId& parent) {
    const J* c = as::composant(a, cid);
    if (!c || chemin.empty()) return;
    const std::string id = chemin.back();
    const J* o = as::occurrence(a, id);
    if (!o) return;
    const bool self = chemin == AP;
    const bool mine = chemin.size() > n && estPrefixe(AP, chemin);
    const bool direct = mine && chemin.size() == n + 1;
    wxString t = tx(texteDe(*o, "name"));
    if (c->contains("occ") && !(*c)["occ"].empty()) t += wxString::Format(L" (%zu)", (*c)["occ"].size());
    if (o->value("fixed", false)) t += L"  📌 fixe";
    if (o->contains("align") && (*o)["align"].is_object()) t += L"  ⚙ " + tx(as::nomLiaison(texteDe((*o)["align"], "type")));
    if (texteDe(*o, "st") == "warn") t += L"  ⚠";
    const wxTreeItemId ligne = arbre_->AppendItem(parent, t, self ? 13 : 12, -1, lien(LienArbre::INSTANCE, chemin, id, direct));
    if (self) {
      arbre_->SetItemTextColour(ligne, bleu);
      arbre_->SetItemBold(ligne);
    } else if (!mine || (o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>())) arbre_->SetItemTextColour(ligne, grise);
    if (direct) lignesOcc_[id] = ligne;
    if (self && asmMode_ == "part") {
      remplirPiece(ligne);
      arbre_->Expand(ligne);
    } else if (!self && c->contains("doc") && (*c)["doc"].is_object()) contenu(ligne, chemin, (*c)["doc"]);
    enfants(cid, chemin, ligne);
    if (self || (estPrefixe(chemin, AP))) arbre_->Expand(ligne);
  };
  enfants = [&](const std::string& cid, const as::Chemin& chemin, const wxTreeItemId& parent) {
    const J* c = as::composant(a, cid);
    if (!c || !c->contains("occ")) return;
    // frères identiques regroupés à partir de 3
    std::vector<std::pair<std::string, std::vector<const J*>>> G;
    for (const J& o : (*c)["occ"]) {
      const std::string oc = texteDe(o, "comp");
      auto g = std::find_if(G.begin(), G.end(), [&](const auto& x) { return x.first == oc; });
      if (g == G.end()) {
        G.push_back({oc, {}});
        g = std::prev(G.end());
      }
      g->second.push_back(&o);
    }
    for (const auto& [oc, L] : G) {
      if (L.size() < 3) {
        for (const J* o : L) {
          as::Chemin p = chemin;
          p.push_back(texteDe(*o, "id"));
          marcher(oc, p, parent);
        }
        continue;
      }
      const J* gc = as::composant(a, oc);
      int nf = 0, nj = 0;
      for (const J* o : L) {
        nf += o->value("fixed", false) ? 1 : 0;
        nj += o->contains("align") && (*o)["align"].is_object() ? 1 : 0;
      }
      wxString t = (gc ? tx(texteDe(*gc, "name")) : wxString()) + wxString::Format(L" ×%zu", L.size());
      if (nf) t += L"  📌";
      if (nj) t += L"  ⚙";
      as::Chemin p0 = chemin;
      p0.push_back(texteDe(*L[0], "id"));
      const wxTreeItemId g = arbre_->AppendItem(parent, t, 12, -1, lien(LienArbre::GROUPE, p0, "", false));
      bool ouvrir = false;
      for (const J* o : L) {
        as::Chemin p = chemin;
        p.push_back(texteDe(*o, "id"));
        ouvrir = ouvrir || estPrefixe(p, AP) || texteDe(*o, "id") == asmSel_;
        marcher(oc, p, g);
      }
      if (ouvrir) arbre_->Expand(g);
    }
  };
  // racine : son propre contenu, puis Composants, puis Liaisons
  const std::string rid = as::racine(a);
  const J* rc = as::composant(a, rid);
  const bool selfRacine = AP.empty();
  const wxTreeItemId r = arbre_->AppendItem(racineArbre, rc ? tx(texteDe(*rc, "name")) : wxString(L"Racine"), selfRacine ? 13 : 12, -1, lien(LienArbre::INSTANCE, {}, "", false));
  arbre_->SetItemBold(r);
  if (selfRacine) arbre_->SetItemTextColour(r, bleu);
  else arbre_->SetItemTextColour(r, grise);
  if (selfRacine && asmMode_ == "part") remplirPiece(r);
  else if (!selfRacine && rc && rc->contains("doc") && (*rc)["doc"].is_object() && ((*rc)["doc"].value("features", J::array()).size() || (*rc)["doc"].value("sketches", J::array()).size())) contenu(r, {}, (*rc)["doc"]);
  arbre_->Expand(r);
  const std::vector<as::Instance> tout = as::instances(a, rid);
  const wxTreeItemId sec = arbre_->AppendItem(r, wxString::Format(L"Composants (%zu)", tout.size() - 1), 12);
  arbre_->SetItemBold(sec);
  enfants(rid, {}, sec);
  arbre_->Expand(sec);
  // treeJoints
  std::vector<std::pair<const J*, as::Chemin>> Lj;
  std::set<std::string> vus;
  for (const as::Instance& i : tout) {
    if (i.chemin.empty()) continue;
    const std::string id = i.chemin.back();
    if (!vus.insert(id).second) continue;
    const J* o = as::occurrence(a, id);
    if (o && o->contains("align") && (*o)["align"].is_object()) Lj.push_back({o, as::Chemin(i.chemin.begin(), i.chemin.end() - 1)});
  }
  if (!Lj.empty()) {
    const wxTreeItemId s = arbre_->AppendItem(r, wxString::Format(L"Liaisons (%zu)", Lj.size()), 14);
    arbre_->SetItemBold(s);
    for (const auto& [o, owner] : Lj) {
      const J& al = (*o)["align"];
      wxString t = tx(as::nomLiaison(texteDe(al, "type"))) + L"  " + tx(texteDe(*o, "name")) + L" → " + tx(nomRel(as::compDuChemin(a, owner), al.value("dst", J()), !al.contains("rel") || !al["rel"].is_object()));
      if (texteDe(*o, "st") == "warn") t += L"  ⚠";
      as::Chemin p = owner;
      p.push_back(texteDe(*o, "id"));
      arbre_->AppendItem(s, t, 14, -1, lien(LienArbre::LIAISON, p, texteDe(*o, "id"), false));
    }
    arbre_->Expand(s);
  }
  arbre_->Expand(r);
}

// asmRelName : « Châssis:1 › Roue:2 › Repère A » ; chemin vide = le composant cid lui-même
std::string Cadre::nomRel(const std::string& cid, const J& r, bool normal) const {
  if (!normal) return "telle que construite";
  if (!doc_.assemblage || !r.is_object()) return "?";
  const J& a = *doc_.assemblage;
  const J* c = as::composant(a, cid);
  std::string parts;
  const bool chemin = r.contains("path") && r["path"].is_array() && !r["path"].empty();
  if (chemin)
    for (const J& x : r["path"]) {
      if (!x.is_string() || !c) return "?";
      const J* o = nullptr;
      for (const J& q : (*c)["occ"])
        if (texteDe(q, "id") == x.get<std::string>()) o = &q;
      if (!o) return "?";
      parts += texteDe(*o, "name") + " › ";
      c = as::composant(a, texteDe(*o, "comp"));
    }
  if (!c) return "?";
  if (r.contains("sn") && r["sn"].is_object()) return parts + (chemin ? "" : texteDe(*c, "name") + " · ") + texteDe(r["sn"], "name");
  const std::string cg = texteDe(r, "cg");
  if (!cg.empty()) {
    const auto it = asmSolides_.find(texteDe(*c, "id"));
    if (it != asmSolides_.end())
      for (const ElementConstruction& e : it->second->construction)
        if (e.id == cg) return parts + e.nom;
    return parts + "?";
  }
  return parts + (chemin ? "Origine" : "Origine de « " + texteDe(*c, "name") + " »");
}

// Rend true si la ligne a été traitée
bool Cadre::asmSurArbre(const LienArbre* l) {
  if (!l || l->sorte == LienArbre::PIECE) return false;
  if (asmSansEvenement_) return true;
  if (l->sorte == LienArbre::LIAISON || (l->sorte == LienArbre::INSTANCE && l->direct)) {
    const std::string id = l->occ;
    const bool ctrl = wxGetKeyState(WXK_CONTROL), maj = wxGetKeyState(WXK_SHIFT);
    const as::Chemin AP = as::cheminActif(*doc_.assemblage);
    as::Chemin owner = l->chemin;
    if (!owner.empty()) owner.pop_back();
    if (asmMode_ != "asm" || owner != AP) CallAfter([this, owner, id] { asmAller(owner, "asm", id); });
    else CallAfter([this, id, ctrl, maj] { asmCliqueOcc(id, ctrl, maj); });
    return true;
  }
  if (l->sorte == LienArbre::CONTENU) {
    const J* o = l->chemin.empty() ? nullptr : as::occurrence(*doc_.assemblage, l->chemin.back());
    const std::string cid = as::compDuChemin(*doc_.assemblage, l->chemin);
    const J* c = as::composant(*doc_.assemblage, cid);
    (void)o;
    etat(L"Lecture seule : double-clic pour modéliser « " + (c ? tx(texteDe(*c, "name")) : wxString()) + L" ».");
  }
  return true;
}

bool Cadre::asmSurArbreActive(const LienArbre* l) {
  if (!l || l->sorte == LienArbre::PIECE) return false;
  if (l->sorte == LienArbre::LIAISON) return true;
  const as::Chemin p = l->chemin;
  CallAfter([this, p] { asmAller(p, "part"); });
  return true;
}

bool Cadre::asmSurArbreMenu(const LienArbre* l) {
  if (!l || l->sorte == LienArbre::PIECE) return false;
  if (l->sorte != LienArbre::INSTANCE || l->chemin.empty()) return true;
  const as::Chemin chemin = l->chemin;
  const std::string id = l->occ;
  const bool direct = l->direct;
  CallAfter([this, chemin, id, direct] { asmMenuOccurrence(chemin, id, direct); });
  return true;
}

void Cadre::asmMenuOccurrence(const as::Chemin& chemin, const std::string& id, bool direct) {
  if (!doc_.assemblage) return;
  const J* o = as::occurrence(*doc_.assemblage, id);
  if (!o) return;
  const J* c = as::composant(*doc_.assemblage, texteDe(*o, "comp"));
  if (!c) return;
  const as::Chemin AP = as::cheminActif(*doc_.assemblage);
  enum { MODELER = wxID_HIGHEST + 7000, PLACER, DEPLACER, OCCURRENCE, FIXER, RENOMMER, SUPPRIMER, MASQUER };
  if (direct && asmMode_ == "asm") {
    const std::vector<std::string> L = asmLot();
    if (std::find(L.begin(), L.end(), id) == L.end()) {
      asmSel_ = id;
      asmLot_.clear();
      asmMontrerChoix();
      montrerRien();
    }
  }
  const std::vector<std::string> lot = asmLot();
  const bool dansLot = std::find(lot.begin(), lot.end(), id) != lot.end() && lot.size() > 1;
  wxMenu m;
  m.Append(MODELER, L"✏️ Modéliser ce composant");
  if (c->contains("occ") && !(*c)["occ"].empty()) m.Append(PLACER, L"🧩 Placer ses composants");
  if (direct) {
    m.Append(DEPLACER, L"✥ Déplacer");
    m.Append(OCCURRENCE, L"➕ Nouvelle occurrence");
    m.Append(FIXER, o->value("fixed", false) ? L"📌 Libérer" : L"📌 Fixer");
    m.Append(MASQUER, o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>() ? L"👁 Afficher" : L"🙈 Masquer");
    m.Append(RENOMMER, L"🏷 Renommer le composant");
    m.Append(SUPPRIMER, dansLot ? wxString::Format(L"🗑 Supprimer le lot (%zu)", lot.size()) : wxString(L"🗑 Supprimer"));
  }
  const int choix = choisirMenu(m);
  const bool fixe = o->value("fixed", false);
  const bool cache = o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>();
  const wxString nomAncien = tx(texteDe(*c, "name"));
  if (choix == MODELER) asmAller(chemin, "part");
  else if (choix == PLACER) asmAller(chemin, "asm");
  else if (choix == DEPLACER) {
    if (asmMode_ != "asm") asmAller(AP, "asm", id);
    else {
      asmSel_ = id;
      asmLot_.clear();
      asmMontrerChoix();
      montrerRien();
    }
    const J* q = as::occurrence(*doc_.assemblage, id);
    const wxString nom = tx(texteDe(*q, "name"));
    const bool al = q->contains("align") && (*q)["align"].is_object();
    if (q->value("fixed", false)) etat(L"« " + nom + L" » est fixée : libérez-la (📌 Libérer) pour la déplacer.");
    else if (al && !as::dofs((*q)["align"]).empty()) etat(L"« " + nom + L" » est liée : seuls ses degrés de liberté se pilotent (manipulateur ou réglages).");
    else if (al) etat(L"« " + nom + L" » est alignée (rigide) : supprimez la liaison pour la déplacer librement.");
    else etat(L"Déplacer « " + nom + L" » : flèches = translation, anneaux = rotation (pas 1 mm / 5°, Maj = libre), ou Position X / Y / Z dans le panneau.");
  } else if (choix == OCCURRENCE) {
    if (asmMode_ != "asm") asmAller(AP, "asm", id);
    asmSel_ = id;
    asmLot_.clear();
    asmNouvelleOccurrence();
  } else if (choix == FIXER) changerAssemblage([&](J& a) {
    if (J* q = as::occurrence(a, id)) (*q)["fixed"] = !fixe;
  });
  else if (choix == MASQUER) changerAssemblage([&](J& a) {
    if (J* q = as::occurrence(a, id)) (*q)["visible"] = cache;
  });
  else if (choix == RENOMMER) {
    const wxString nv = demanderNom(nomAncien);
    if (!nv.empty()) changerAssemblage([&](J& a) { as::renommerComposant(a, id, nv.utf8_string()); });
  } else if (choix == SUPPRIMER) asmSupprimer(dansLot ? lot : std::vector<std::string>{id});
}

// ---- Le panneau (asmRenderProps, asmPlacementCore, asmLookProps) ----
void Cadre::poserBoutonsPanneau(const std::vector<std::pair<wxString, std::function<void()>>>& L) {
  rangAsm_->Clear(true);
  boutonsAsm_.clear();
  for (const auto& [t, f] : L) {
    auto* b = new BoutonEsquisse(carteDroite_, wxID_ANY, t, t, BoutonEsquisse::ENCADRE);
    b->titre(t);
    b->fond(wxColour(0x2a, 0x2c, 0x30));
    b->SetMinSize(FromDIP(wxSize(-1, 26)));
    const auto action = f;
    b->surClic = [this, action] { CallAfter([action] { action(); }); };
    rangAsm_->Add(b, 0, wxEXPAND | wxTOP, FromDIP(4));
    boutonsAsm_.push_back({t, action});
  }
  carteDroite_->contenu()->Show(rangAsm_, !L.empty());
  hauteurBoutonsAsm_ = static_cast<int>(L.size()) * 30;
  carteDroite_->Layout();
}

void Cadre::montrerAssemblage() {
  fonctionMontree_ = -1;
  ficheId_.clear();
  ficheChoix_.clear();
  props_->Clear();
  props_->CenterSplitter();
  if (!doc_.assemblage) return;
  const J& a = *doc_.assemblage;
  const std::vector<std::string> lot = asmLot();
  std::vector<ChampFiche> ch;
  const auto lecture = [&](const std::string& cat, const std::string& titre, const std::string& texte) {
    ChampFiche c;
    c.categorie = cat;
    c.titre = titre;
    c.texte = texte;
    c.cle = "l/" + titre;
    ch.push_back(std::move(c));
  };
  const auto nombre = [&](const std::string& cat, const std::string& cle, const std::string& titre, double v) {
    ChampFiche c;
    c.sorte = ChampFiche::NOMBRE;
    c.categorie = cat;
    c.cle = cle;
    c.titre = titre;
    c.nombre = v;
    ch.push_back(std::move(c));
  };
  const auto liste = [&](const std::string& cat, const std::string& cle, const std::string& titre, const std::string& v, const std::vector<std::pair<std::string, std::string>>& L) {
    ChampFiche c;
    c.sorte = ChampFiche::CHOIX;
    c.categorie = cat;
    c.cle = cle;
    c.titre = titre;
    c.texte = v;
    c.choix = L;
    ch.push_back(std::move(c));
  };
  const auto oui = [&](const std::string& cat, const std::string& cle, const std::string& titre, bool v) {
    ChampFiche c;
    c.sorte = ChampFiche::BOOLEEN;
    c.categorie = cat;
    c.cle = cle;
    c.titre = titre;
    c.oui = v;
    ch.push_back(std::move(c));
  };
  // Les degrés de liberté d'une occurrence liée
  const auto degres = [&](const std::string& cat, const J& o) {
    const J& al = o["align"];
    const std::string id = texteDe(o, "id");
    for (const std::string& k : as::dofs(al)) {
      const bool rot = k[0] == 'r';
      const char* noms[] = {"Translation X", "Translation Y", "Translation Z", "Rotation X", "Rotation Y", "Rotation Z"};
      const int r = (rot ? 3 : 0) + (k[1] - 'x');
      const double v = al.contains("q") && al["q"].is_object() && al["q"].contains(k) && al["q"][k].is_number() ? al["q"][k].get<double>() : 0;
      nombre(cat, "q/" + id + "/" + k, std::string(noms[r]) + (rot ? " (°)" : " (mm)"), v);
      const bool aLim = al.contains("lim") && al["lim"].is_object() && al["lim"].contains(k) && al["lim"][k].is_array();
      ChampFiche mi, ma;
      mi.sorte = ma.sorte = ChampFiche::CHOIX;
      (void)mi;
      for (int i = 0; i < 2; i++) {
        ChampFiche c;
        c.categorie = cat;
        c.cle = "lim/" + id + "/" + k + "/" + std::to_string(i);
        c.titre = std::string(i ? "   limite haute" : "   limite basse") + " (vide = libre)";
        c.sorte = ChampFiche::LECTURE;
        c.texte = aLim ? nombreCourt(al["lim"][k][i].get<double>()) : "";
        c.libre = true;
        ch.push_back(std::move(c));
      }
    }
  };
  std::vector<std::pair<wxString, std::function<void()>>> B;
  const as::Chemin P = as::cheminActif(a);
  const std::string actif = as::actif(a);
  const J* c = as::composant(a, actif);
  const J* o = lot.size() == 1 ? as::occurrence(a, lot[0]) : nullptr;
  if (asmAlign_) {
    asmPanneauAligner(ch, B);
  } else if (lot.empty()) {
    const std::string cat = "🧩 " + (c ? texteDe(*c, "name") : std::string());
    lecture(cat, "Placés ici", std::to_string(c && c->contains("occ") ? (*c)["occ"].size() : 0) + " composant(s), " + std::to_string(a["comps"].size()) + " dans le fichier");
    B.push_back({L"➕ Nouveau composant", [this] { asmNouveauComposant(); }});
    B.push_back({L"📥 Insérer…", [this] { asmInserer(); }});
    B.push_back({L"✏️ Modéliser « " + (c ? tx(texteDe(*c, "name")) : wxString()) + L" »", [this] { asmBasculer(); }});
    if (!P.empty()) B.push_back({L"↑ Remonter", [this] { asmRemonter(); }});
    if (c && c->contains("occ"))
      for (const J& q : (*c)["occ"])
        if (q.contains("align") && q["align"].is_object() && !as::dofs(q["align"]).empty()) degres("⚙ " + texteDe(q, "name") + " · " + as::nomLiaison(texteDe(q["align"], "type")), q);
  } else if (lot.size() > 1) {
    int nf = 0, nh = 0;
    std::string noms;
    for (const std::string& id : lot)
      if (const J* q = as::occurrence(a, id)) {
        nf += q->value("fixed", false) ? 1 : 0;
        nh += q->contains("visible") && (*q)["visible"].is_boolean() && !(*q)["visible"].get<bool>() ? 1 : 0;
        noms += (noms.empty() ? "" : ", ") + texteDe(*q, "name");
      }
    lecture("📦 " + std::to_string(lot.size()) + " composants sélectionnés", "Lot", noms);
    const bool tousFixes = nf == static_cast<int>(lot.size()), tousCaches = nh == static_cast<int>(lot.size());
    B.push_back({tousFixes ? L"📌 Libérer" : L"📌 Fixer", [this, tousFixes] { asmLotChaque([&](J& q) { q["fixed"] = !tousFixes; }); }});
    B.push_back({tousCaches ? L"👁 Afficher" : L"🙈 Masquer", [this, tousCaches] { asmLotChaque([&](J& q) { q["visible"] = tousCaches; }); }});
    B.push_back({L"🗑 Supprimer", [this] { asmSupprimer(asmLot()); }});
  } else if (o) {
    const J* cc = as::composant(a, texteDe(*o, "comp"));
    const std::string id = texteDe(*o, "id");
    const std::string cat = "📦 " + texteDe(*o, "name");
    int nOcc = 0;
    for (const J& k : a["comps"])
      if (k.contains("occ"))
        for (const J& q : k["occ"]) nOcc += texteDe(q, "comp") == texteDe(*o, "comp") ? 1 : 0;
    lecture(cat, "Composant", (cc ? texteDe(*cc, "name") : std::string()) + " · " + std::to_string(nOcc) + " occurrence(s)");
    if (texteDe(*o, "st") == "warn") lecture(cat, "⚠", texteDe(*o, "msg"));
    const as::Repere fr = as::repereDe(o->value("fr", J::object()));
    const bool al = o->contains("align") && (*o)["align"].is_object();
    const std::string plc = "Placement";
    if (al) {
      const J& A = (*o)["align"];
      const bool rel = A.contains("rel") && A["rel"].is_object();
      lecture(plc, "Liée à", rel ? "telle que construite" : nomRel(texteDe(*o, "comp"), A.value("src", J()), true) + " → " + nomRel(actif, A.value("dst", J()), true));
      std::string ty = texteDe(A, "type");
      if (ty.empty()) ty = "rigid";
      liste(plc, "align/type", "Liaison", ty, {{"rigid", "Rigide"}, {"revolute", "Pivot"}, {"slider", "Glissière"}, {"cylindrical", "Pivot glissant"}, {"planar", "Plan"}, {"ball", "Rotule"}});
      if (!rel) {
        oui(plc, "align/flip", "Retourner", A.value("flip", false));
        nombre(plc, "align/rz", "Rotation (°)", A.contains("rz") && A["rz"].is_number() ? A["rz"].get<double>() : 0);
        const char* ax[] = {"X", "Y", "Z"};
        for (int i = 0; i < 3; i++) nombre(plc, "align/off/" + std::to_string(i), std::string("Décalage ") + ax[i] + " (mm)", A.contains("off") && A["off"].is_array() && A["off"].size() > static_cast<size_t>(i) && A["off"][i].is_number() ? A["off"][i].get<double>() : 0);
      }
      degres(plc, *o);
      if (!as::dofs(A).empty()) {
        B.push_back({L"📌 Capturer la position", [this, id] { changerAssemblage([&](J& a2) {
                       J* q = as::occurrence(a2, id);
                       (*q)["align"]["q0"] = (*q)["align"].value("q", J::object());
                     }); }});
        B.push_back({L"↺ Rétablir", [this, id] { changerAssemblage([&](J& a2) {
                       J* q = as::occurrence(a2, id);
                       (*q)["align"]["q"] = (*q)["align"].value("q0", J::object());
                     }); }});
        B.push_back({asmAnim_.IsRunning() && asmAnimOcc_ == id ? L"■ Arrêter" : L"▶ Animer", [this, id] { asmAnimer(id); }});
      }
      B.push_back({L"Supprimer la liaison", [this, id] { asmAnim_.Stop(); changerAssemblage([&](J& a2) { (*as::occurrence(a2, id))["align"] = nullptr; }); }});
    } else if (o->value("fixed", false)) {
      lecture(plc, "📌", "Fixée : libérez-la pour la déplacer.");
    } else {
      const char* ax[] = {"X", "Y", "Z"};
      for (int i = 0; i < 3; i++) nombre(plc, "pos/" + std::to_string(i), std::string("Position ") + ax[i] + " (mm)", fr.o[i]);
      for (int i = 0; i < 3; i++)
        for (int s : {-90, 90}) B.push_back({wxString(s > 0 ? L"+" : L"−") + L"90° " + ax[i], [this, id, i, s] { changerAssemblage([&](J& a2) {
                                                J* q = as::occurrence(a2, id);
                                                const as::Repere F = as::repereDe((*q)["fr"]);
                                                as::V3 d{0, 0, 0};
                                                d[i] = 1;
                                                (*q)["fr"] = as::jsonDe(rotationAutour(F, F.o, d, s * 3.14159265358979323846 / 180));
                                              }); }});
    }
    if (!o->value("fixed", false)) {
      B.push_back({L"🔗 Aligner un repère…", [this, id] { asmAlignDebut(id); }});
      if (!al) B.push_back({L"⚙ Liaison telle que construite…", [this, id] { asmMenuTelleQueConstruite(id); }});
    }
    // Apparence (assemblage)
    const std::string ap = "Apparence (assemblage)";
    const J L0 = o->contains("look") && (*o)["look"].is_object() ? (*o)["look"] : J::object();
    nombre(ap, "look/op", "Intensité (15 à 100 %)", std::round((L0.contains("op") ? L0["op"].get<double>() : 1.0) * 100));
    nombre(ap, "look/gl", "Transparence (0 à 90 %)", std::round((1 - (L0.contains("gl") ? L0["gl"].get<double>() : 1.0)) * 100));
    liste(ap, "look/edges", "Arêtes", texteDe(L0, "edges"), {{"", "Comme le bouton « Arêtes »"}, {"on", "Toujours"}, {"off", "Jamais"}});
    B.push_back({L"Appliquer à toutes les occurrences de « " + (cc ? tx(texteDe(*cc, "name")) : wxString()) + L" »", [this, id] { changerAssemblage([&](J& a2) {
                   const J* s = as::occurrence(a2, id);
                   const J lk = s->value("look", J());
                   const std::string cid = texteDe(*s, "comp");
                   for (J& k : a2["comps"])
                     if (k.contains("occ"))
                       for (J& q : k["occ"])
                         if (texteDe(q, "comp") == cid) q["look"] = lk;
                 }); }});
    as::Chemin Pi = P;
    Pi.push_back(id);
    B.push_back({L"✏️ Modéliser", [this, Pi] { asmAller(Pi, "part"); }});
    if (cc && cc->contains("occ") && !(*cc)["occ"].empty()) B.push_back({L"🧩 Placer ses composants", [this, Pi] { asmAller(Pi, "asm"); }});
    B.push_back({L"➕ Occurrence", [this] { asmNouvelleOccurrence(); }});
    const bool fx = o->value("fixed", false);
    B.push_back({fx ? L"📌 Libérer" : L"📌 Fixer", [this, id, fx] { changerAssemblage([&](J& a2) { (*as::occurrence(a2, id))["fixed"] = !fx; }); }});
    B.push_back({L"🗑 Supprimer", [this, id] { asmSupprimer({id}); }});
  }
  poserChamps(ch, false);
  ficheId_ = "@asm";
  poserBoutonsPanneau(B);
}

// Un réglage du panneau
void Cadre::asmFiche(const std::string& cle, const std::string& valeur) {
  if (!doc_.assemblage) return;
  if (asmAlign_ && asmAlignFiche(cle, valeur)) return;
  const auto nombreDe = [&](double& v) {
    std::string s = valeur;
    for (char& c : s)
      if (c == ',') c = '.';
    char* fin = nullptr;
    v = strtod(s.c_str(), &fin);
    return fin != s.c_str();
  };
  double v = 0;
  const std::string id = asmSel_;
  if (cle.rfind("pos/", 0) == 0) {
    if (!nombreDe(v)) return montrerRien();
    const int i = std::atoi(cle.c_str() + 4);
    changerAssemblage([&](J& a) {
      J* o = as::occurrence(a, id);
      as::Repere F = as::repereDe((*o)["fr"]);
      F.o[i] = v;
      (*o)["fr"] = as::jsonDe(as::arrondir(F));
    });
  } else if (cle.rfind("look/", 0) == 0) {
    changerAssemblage([&](J& a) {
      J* o = as::occurrence(a, id);
      J L = o->contains("look") && (*o)["look"].is_object() ? (*o)["look"] : J::object();
      if (cle == "look/edges") {
        if (valeur.empty()) L.erase("edges");
        else L["edges"] = valeur;
      } else if (nombreDe(v)) {
        if (cle == "look/op") {
          v = std::min(100.0, std::max(15.0, v));
          if (v < 100) L["op"] = std::round(v * 10) / 1000;
          else L.erase("op");
        } else {
          v = std::min(90.0, std::max(0.0, v));
          if (v > 0) L["gl"] = std::round((100 - v) * 10) / 1000;
          else L.erase("gl");
        }
      }
      if (L.empty()) o->erase("look");
      else (*o)["look"] = L;
    });
  } else if (cle.rfind("align/", 0) == 0) {
    changerAssemblage([&](J& a) {
      J* o = as::occurrence(a, id);
      J& A = (*o)["align"];
      if (cle == "align/type") {
        if (valeur == "rigid") A.erase("type");
        else A["type"] = valeur;
        if (!A.contains("q")) A["q"] = J::object();
      } else if (cle == "align/flip") A["flip"] = valeur == "1";
      else if (cle == "align/rz") {
        if (nombreDe(v)) A["rz"] = v;
      } else if (cle.rfind("align/off/", 0) == 0) {
        if (nombreDe(v)) {
          if (!A.contains("off") || !A["off"].is_array()) A["off"] = J::array({0, 0, 0});
          A["off"][std::atoi(cle.c_str() + 10)] = v;
        }
      }
    });
  } else if (cle.rfind("q/", 0) == 0) {
    const size_t p = cle.rfind('/');
    const std::string occ = cle.substr(2, p - 2), k = cle.substr(p + 1);
    if (!nombreDe(v)) return montrerRien();
    changerAssemblage([&](J& a) {
      J* o = as::occurrence(a, occ);
      J& A = (*o)["align"];
      if (!A.contains("q") || !A["q"].is_object()) A["q"] = J::object();
      if (A.contains("lim") && A["lim"].is_object() && A["lim"].contains(k)) {
        const double l0 = A["lim"][k][0].get<double>(), l1 = A["lim"][k][1].get<double>();
        v = std::min(std::max(v, std::min(l0, l1)), std::max(l0, l1));
      }
      A["q"][k] = v;
    });
  } else if (cle.rfind("lim/", 0) == 0) {
    const size_t p2 = cle.rfind('/'), p1 = cle.rfind('/', p2 - 1);
    const std::string occ = cle.substr(4, p1 - 4), k = cle.substr(p1 + 1, p2 - p1 - 1);
    const int i = std::atoi(cle.c_str() + p2 + 1);
    const bool lu = nombreDe(v);
    changerAssemblage([&](J& a) {
      J* o = as::occurrence(a, occ);
      J& A = (*o)["align"];
      if (!A.contains("lim") || !A["lim"].is_object()) A["lim"] = J::object();
      if (lu) {
        const bool rot = k[0] == 'r';
        J cur = A["lim"].contains(k) ? A["lim"][k] : J::array({rot ? -180 : -100, rot ? 180 : 100});
        cur[i] = v;
        A["lim"][k] = cur;
      } else A["lim"].erase(k);
    });
  }
}

void Cadre::asmMenuTelleQueConstruite(const std::string& id) {
  struct Ligne {
    std::string type, axe;
    wxString texte;
  };
  std::vector<Ligne> L;
  const struct { const char* t; const wchar_t* lab; bool un; } T[] = {{"revolute", L"Pivot", false}, {"slider", L"Glissière", false}, {"cylindrical", L"Pivot glissant", false}, {"planar", L"Plan", false}, {"ball", L"Rotule", true}};
  for (const auto& t : T) {
    if (t.un || std::string(t.t) == "planar") L.push_back({t.t, "z", wxString(L"⚙ ") + t.lab});
    else
      for (const char* ax : {"z", "x", "y"}) {
        wxString A(ax);
        L.push_back({t.t, ax, wxString(L"⚙ ") + t.lab + L" · axe " + A.Upper() + L" de l'occurrence"});
      }
  }
  wxMenu m;
  for (size_t i = 0; i < L.size(); i++) m.Append(wxID_HIGHEST + 7100 + static_cast<int>(i), L[i].texte);
  const int c = choisirMenu(m) - wxID_HIGHEST - 7100;
  if (c < 0 || c >= static_cast<int>(L.size())) return;
  changerAssemblage([&](J& a) {
    J* o = as::occurrence(a, id);
    (*o)["align"] = as::alignementTelQueConstruit(*o, L[c].type, L[c].axe);
  }, L"Liaison à la position actuelle : faites-la jouer au manipulateur ou aux réglages.");
}

// asmAnimStart : aller-retour entre les limites, sinon un tour / ±50 mm
void Cadre::asmAnimer(const std::string& id) {
  if (asmAnim_.IsRunning() && asmAnimOcc_ == id) {
    asmAnim_.Stop();
    montrerRien();
    return;
  }
  const J* o = as::occurrence(*doc_.assemblage, id);
  if (!o || !o->contains("align") || as::dofs((*o)["align"]).empty()) return;
  asmAnimOcc_ = id;
  asmAnimK_ = as::dofs((*o)["align"])[0];
  asmAnimDir_ = 1;
  asmAnim_.Start(33);
  montrerRien();
  etat(L"Animation de « " + tx(texteDe(*o, "name")) + L" » : ■ ou Échap pour arrêter.");
}

void Cadre::asmPasAnimation() {
  if (!doc_.assemblage || asmMode_ != "asm") {
    asmAnim_.Stop();
    return;
  }
  J* o = as::occurrence(*doc_.assemblage, asmAnimOcc_);
  if (!o || !o->contains("align") || !(*o)["align"].is_object()) {
    asmAnim_.Stop();
    return;
  }
  J& A = (*o)["align"];
  const bool rot = asmAnimK_[0] == 'r';
  const double sp = rot ? 90 : 20, dt = 0.033;
  if (!A.contains("q") || !A["q"].is_object()) A["q"] = J::object();
  double v = (A["q"].contains(asmAnimK_) && A["q"][asmAnimK_].is_number() ? A["q"][asmAnimK_].get<double>() : 0) + asmAnimDir_ * sp * dt;
  const bool lim = A.contains("lim") && A["lim"].is_object() && A["lim"].contains(asmAnimK_);
  const double l0 = lim ? A["lim"][asmAnimK_][0].get<double>() : 0, l1 = lim ? A["lim"][asmAnimK_][1].get<double>() : 0;
  const double lo = lim ? std::min(l0, l1) : (rot ? -1e300 : -50), hi = lim ? std::max(l0, l1) : (rot ? 1e300 : 50);
  if (v > hi) {
    v = hi;
    asmAnimDir_ = -1;
  }
  if (v < lo) {
    v = lo;
    asmAnimDir_ = 1;
  }
  if (rot && !lim && std::abs(v) > 360) v = std::fmod(v, 360);
  A["q"][asmAnimK_] = v;
  as::resoudre(*doc_.assemblage, asmSolides_);
  asmDessiner();
}

// ---- Le manipulateur (asmGizmoSpec, asmGizmoDown, asmGizmoMove) ----
void Cadre::asmGizmo() {
  Vue3D::Gizmo G;
  if (doc_.assemblage && asmMode_ == "asm" && !asmAlign_ && asmLot().size() == 1) {
    const J* o = as::occurrence(*doc_.assemblage, asmSel_);
    const J& a = *doc_.assemblage;
    if (o) {
      const bool al = o->contains("align") && (*o)["align"].is_object();
      if (!al && !o->value("fixed", false)) {
        const as::Repere F = as::repereDe(o->value("fr", J::object()));
        G.actif = true;
        G.o = F.o;
        for (int i = 0; i < 3; i++) {
          G.ax[i] = {0, 0, 0};
          G.ax[i][i] = 1;
          G.fleche[i] = G.anneau[i] = true;
        }
      } else if (al && !as::dofs((*o)["align"]).empty()) {
        // Le repère de la liaison : sa cible
        J copie = (*o)["align"];
        as::Repere T;
        J copieA = a;
        if (as::cibleLiaison(copieA, asmSolides_, as::actif(a), copie, T)) {
          G.actif = true;
          double tv[3] = {0, 0, 0};
          for (const std::string& k : as::dofs(copie)) {
            const int i = k[1] - 'x';
            const double v = copie.contains("q") && copie["q"].is_object() && copie["q"].contains(k) && copie["q"][k].is_number() ? copie["q"][k].get<double>() : 0;
            if (k[0] == 't') {
              tv[i] = v;
              G.fleche[i] = true;
              G.degreFleche[i] = k;
            } else {
              G.anneau[i] = true;
              G.degreAnneau[i] = k;
            }
          }
          G.o = as::appliquer(T, {tv[0], tv[1], tv[2]});
          G.ax[0] = T.x;
          G.ax[1] = T.y;
          G.ax[2] = T.z;
        }
      }
    }
  }
  vue_->poserGizmo(G);
}

void Cadre::asmGeste(int phase, const std::string& sorte, int axe, const std::string& degre, double valeur, bool libre) {
  if (!doc_.assemblage) return;
  if (phase == 0) {
    asmGesteAvant_ = std::make_shared<J>(*doc_.assemblage);
    asmGesteBouge_ = false;
    return;
  }
  if (!asmGesteAvant_) return;
  const J* o0 = as::occurrence(*asmGesteAvant_, asmSel_);
  if (!o0) return;
  if (phase == 2) {
    auto avant = asmGesteAvant_;
    asmGesteAvant_.reset();
    if (!asmGesteBouge_) {
      doc_.assemblage = avant;
      asmDessiner();
      return;
    }
    const J fin = *doc_.assemblage;
    doc_.assemblage = avant;
    changerAssemblage([&](J& a) { a = fin; });
    return;
  }
  // phase 1 : le geste en cours, sur une copie
  const double d = sorte == "move" ? (libre ? valeur : std::round(valeur)) : (libre ? valeur : std::round(valeur / 5) * 5);
  auto copie = std::make_shared<J>(*asmGesteAvant_);
  J* o = as::occurrence(*copie, asmSel_);
  const wxString nom = tx(texteDe(*o, "name"));
  const char* XYZ = "XYZ";
  if (!degre.empty()) {
    J& A = (*o)["align"];
    if (!A.contains("q") || !A["q"].is_object()) A["q"] = J::object();
    double v = (A["q"].contains(degre) && A["q"][degre].is_number() ? A["q"][degre].get<double>() : 0) + d;
    if (A.contains("lim") && A["lim"].is_object() && A["lim"].contains(degre)) {
      const double l0 = A["lim"][degre][0].get<double>(), l1 = A["lim"][degre][1].get<double>();
      v = std::min(std::max(v, std::min(l0, l1)), std::max(l0, l1));
    }
    A["q"][degre] = v;
    etat(nom + wxString::Format(L" : %s %.*f%s (Maj = libre)", wxString(degre).Upper(), libre ? 2 : 0, v, sorte == "move" ? L" mm" : L"°"));
  } else if (sorte == "move") {
    as::Repere F = as::repereDe((*o)["fr"]);
    F.o[axe] += d;
    (*o)["fr"] = as::jsonDe(as::arrondir(F));
    etat(nom + wxString::Format(L" : %c %+.*f mm (Maj = libre)", XYZ[axe], libre ? 2 : 0, d));
  } else {
    const as::Repere F = as::repereDe((*o)["fr"]);
    as::V3 a{0, 0, 0};
    a[axe] = 1;
    (*o)["fr"] = as::jsonDe(rotationAutour(F, F.o, a, d * 3.14159265358979323846 / 180));
    etat(nom + wxString::Format(L" : rotation %c %.*f° (Maj = libre)", XYZ[axe], libre ? 1 : 0, d));
  }
  asmGesteBouge_ = d != 0;
  as::resoudre(*copie, asmSolides_);
  doc_.assemblage = copie;
  asmDessiner();
}

// ---- Aligner (asmAlignStart…) ----
std::vector<Cadre::RepereCandidat> Cadre::asmReperesSous(const std::string& cid, const std::string& saufOcc) {
  std::vector<RepereCandidat> out;
  const J& a = *doc_.assemblage;
  for (const as::Instance& inst : as::instances(a, cid)) {
    if (!saufOcc.empty() && !inst.chemin.empty() && inst.chemin[0] == saufOcc) continue;
    const auto une = [&](const std::string& cg, const as::Repere& F) {
      RepereCandidat r;
      r.rel = J::object();
      r.rel["path"] = inst.chemin;
      r.rel["cg"] = cg.empty() ? J() : J(cg);
      r.nom = nomRel(cid, r.rel, true);
      r.F = as::composer(inst.F, F);
      out.push_back(std::move(r));
    };
    une("", as::Repere());
    const auto it = asmSolides_.find(inst.comp);
    if (it != asmSolides_.end())
      for (const ElementConstruction& e : it->second->construction)
        if (e.kind == "frame" && e.j.contains("fr") && e.j["fr"].is_object()) une(e.id, as::repereDe(J::parse(e.j["fr"].dump())));
  }
  return out;
}

static std::string cleRel(const J& r) {
  if (!r.is_object()) return "";
  std::string s;
  if (r.contains("path") && r["path"].is_array())
    for (const J& x : r["path"]) s += x.get<std::string>() + "/";
  s += "|" + (r.contains("cg") && r["cg"].is_string() ? r["cg"].get<std::string>() : std::string());
  if (r.contains("sn") && r["sn"].is_object()) s += "|" + r["sn"].value("w", std::string()) + r["sn"]["fr"]["o"].dump();
  return s;
}

void Cadre::asmAlignDebut(const std::string& id) {
  const J* o = as::occurrence(*doc_.assemblage, id);
  if (!o) return;
  if (o->value("fixed", false)) return etat(L"Occurrence fixée : libérez-la pour l'aligner.");
  asmAlign_ = std::make_unique<AlignEnCours>();
  asmAlign_->occ = id;
  asmAlign_->avant = std::make_shared<J>(*doc_.assemblage);
  const wxString nomOcc = tx(texteDe(*o, "name"));
  asmAlignRafraichir();
  etat(L"Aligner « " + nomOcc + L" » : choisissez le repère du composant à poser, dans le panneau, sur une triade, ou sur une face pour ses points d'accroche.");
}

// asmAlignPreview : l'aperçu se fait sur une copie, qui remplace l'état tant que la commande dure
void Cadre::asmAlignRafraichir() {
  if (!asmAlign_) return;
  auto copie = std::make_shared<J>(*asmAlign_->avant);
  J* o = as::occurrence(*copie, asmAlign_->occ);
  if (!asmAlign_->src.is_null() && !asmAlign_->dst.is_null()) {
    J al = J::object();
    al["src"] = asmAlign_->src;
    al["dst"] = asmAlign_->dst;
    al["flip"] = asmAlign_->flip;
    al["rz"] = asmAlign_->rz;
    al["off"] = J::array({asmAlign_->off[0], asmAlign_->off[1], asmAlign_->off[2]});
    (*o)["align"] = std::move(al);
  }
  as::resoudre(*copie, asmSolides_);
  doc_.assemblage = copie;
  asmDessiner();
  asmAlignMarques();
  montrerAssemblage();
}

void Cadre::asmAlignMarques() {
  std::vector<Vue3D::Marque> M;
  asmAlign_->cles.clear();
  if (!asmAlign_) return vue_->poserMarques(M);
  const J& a = *doc_.assemblage;
  const std::string actif = as::actif(a);
  const J* me = as::occurrence(a, asmAlign_->occ);
  if (!me) return vue_->poserMarques(M);
  const as::Repere frMe = as::repereDe(me->value("fr", J::object()));
  const auto mettre = [&](const as::Repere& F, const std::string& cle, bool point, bool orange, bool on) {
    Vue3D::Marque m;
    m.o = F.o;
    m.x = F.x;
    m.y = F.y;
    m.z = F.z;
    m.point = point;
    m.orange = orange;
    m.grand = on;
    M.push_back(m);
    asmAlign_->cles.push_back(cle);
  };
  if (asmAlign_->etape == 0) {
    int i = 0;
    for (const RepereCandidat& r : asmReperesSous(texteDe(*me, "comp"), "")) mettre(as::composer(frMe, r.F), "s" + std::to_string(i++), false, false, cleRel(asmAlign_->src) == cleRel(r.rel));
  } else {
    int i = 0;
    for (const RepereCandidat& r : asmReperesSous(actif, asmAlign_->occ)) mettre(r.F, "d" + std::to_string(i++), false, false, cleRel(asmAlign_->dst) == cleRel(r.rel));
  }
  // les points de la face choisie
  if (asmAlign_->aFace) {
    as::Repere W, Wa, Fi;
    as::monde(a, asmAlign_->cheminAbs, W);
    as::monde(a, as::cheminActif(a), Wa);
    Fi = as::composer(as::inverser(Wa), W);
    for (size_t i = 0; i < asmAlign_->points.size(); i++) mettre(as::composer(Fi, asmAlign_->points[i].fr), "p" + std::to_string(i), true, asmAlign_->points[i].aArete, false);
  }
  vue_->poserMarques(M);
}

void Cadre::asmPanneauAligner(std::vector<ChampFiche>& ch, std::vector<std::pair<wxString, std::function<void()>>>& B) {
  const J& a = *doc_.assemblage;
  const J* o = as::occurrence(a, asmAlign_->occ);
  const std::string cat = "🔗 Aligner « " + (o ? texteDe(*o, "name") : std::string()) + " »";
  const auto liste = [&](const std::string& cle, const std::string& titre, const std::string& v, const std::vector<std::pair<std::string, std::string>>& L) {
    ChampFiche c;
    c.sorte = ChampFiche::CHOIX;
    c.categorie = cat;
    c.cle = cle;
    c.titre = titre;
    c.texte = v;
    c.choix = L;
    ch.push_back(std::move(c));
  };
  const auto nombre = [&](const std::string& cle, const std::string& titre, double v) {
    ChampFiche c;
    c.sorte = ChampFiche::NOMBRE;
    c.categorie = cat;
    c.cle = cle;
    c.titre = titre;
    c.nombre = v;
    ch.push_back(std::move(c));
  };
  const auto points = [&](int cote) {
    if (!asmAlign_->aFace || asmAlign_->coteFace != cote) return;
    std::vector<std::pair<std::string, std::string>> L{{"", "— choisir —"}};
    for (size_t i = 0; i < asmAlign_->points.size(); i++) L.push_back({std::to_string(i), asmAlign_->points[i].nom});
    liste("al/point", "Point : " + asmAlign_->nomFace, "", L);
  };
  const auto listeReperes = [&](const std::vector<RepereCandidat>& R, const J& courant, const std::string& cle, const std::string& titre, const std::string& compCible) {
    std::vector<std::pair<std::string, std::string>> L{{"", "— choisir —"}};
    std::string v;
    for (size_t i = 0; i < R.size(); i++) {
      L.push_back({std::to_string(i), R[i].nom});
      if (cleRel(courant) == cleRel(R[i].rel)) v = std::to_string(i);
    }
    if (courant.is_object() && courant.contains("sn")) {
      L.push_back({"sn", nomRel(compCible, courant, true)});
      v = "sn";
    }
    liste(cle, titre, v, L);
  };
  const std::string compOcc = o ? texteDe(*o, "comp") : std::string();
  listeReperes(asmReperesSous(compOcc, ""), asmAlign_->src, "al/src", "1. Repère à poser", compOcc);
  points(0);
  if (!asmAlign_->src.is_null()) {
    listeReperes(asmReperesSous(as::actif(a), asmAlign_->occ), asmAlign_->dst, "al/dst", "2. Repère cible", as::actif(a));
    points(1);
  }
  if (!asmAlign_->dst.is_null()) {
    ChampFiche c;
    c.sorte = ChampFiche::BOOLEEN;
    c.categorie = cat;
    c.cle = "al/flip";
    c.titre = "Retourner (Z opposés)";
    c.oui = asmAlign_->flip;
    ch.push_back(std::move(c));
    nombre("al/rz", "Rotation autour de Z (°)", asmAlign_->rz);
    nombre("al/off/0", "Décalage X (mm)", asmAlign_->off[0]);
    nombre("al/off/1", "Décalage Y (mm)", asmAlign_->off[1]);
    nombre("al/off/2", "Décalage Z (mm)", asmAlign_->off[2]);
    if (o && texteDe(*o, "st") == "warn") {
      ChampFiche w;
      w.categorie = cat;
      w.titre = "⚠";
      w.cle = "l/w";
      w.texte = texteDe(*o, "msg");
      ch.push_back(std::move(w));
    }
  }
  B.push_back({L"✓ Valider", [this] { asmAlignValider(); }});
  B.push_back({L"Annuler", [this] { asmAlignAnnuler(true); }});
}

bool Cadre::asmAlignFiche(const std::string& cle, const std::string& valeur) {
  if (cle.rfind("al/", 0) != 0) return false;
  const J& a = *doc_.assemblage;
  const J* o = as::occurrence(a, asmAlign_->occ);
  const auto nombreDe = [&](double& v) {
    std::string s = valeur;
    for (char& c : s)
      if (c == ',') c = '.';
    char* fin = nullptr;
    v = strtod(s.c_str(), &fin);
    return fin != s.c_str();
  };
  double v = 0;
  if (cle == "al/src" || cle == "al/dst") {
    if (valeur.empty() || valeur == "sn") return true;
    const std::vector<RepereCandidat> R = cle == "al/src" ? asmReperesSous(texteDe(*o, "comp"), "") : asmReperesSous(as::actif(a), asmAlign_->occ);
    const size_t i = std::stoul(valeur);
    if (i < R.size()) asmAlignPose(cle == "al/src" ? 0 : 1, R[i].rel);
    return true;
  }
  if (cle == "al/point") {
    if (!valeur.empty()) asmAlignChoisirPoint(std::stoi(valeur));
    return true;
  }
  if (cle == "al/flip") asmAlign_->flip = valeur == "1";
  else if (cle == "al/rz" && nombreDe(v)) asmAlign_->rz = v;
  else if (cle.rfind("al/off/", 0) == 0 && nombreDe(v)) asmAlign_->off[std::atoi(cle.c_str() + 7)] = v;
  asmAlignRafraichir();
  return true;
}

void Cadre::asmAlignPose(int cote, const J& rel) {
  if (cote == 0) {
    asmAlign_->src = rel;
    asmAlign_->etape = 1;
    asmAlign_->aFace = false;
    asmAlignRafraichir();
    etat(L"Aligner : choisissez maintenant la cible — repère, ou face (points d'accroche) du composant actif ou d'un autre composant.");
  } else {
    asmAlign_->dst = rel;
    asmAlign_->aFace = false;
    asmAlignRafraichir();
    etat(L"Aligner : réglez retourner / rotation / décalage puis ✓ Valider.");
  }
}

void Cadre::asmAlignChoisirPoint(int i) {
  if (!asmAlign_ || !asmAlign_->aFace || i < 0 || i >= static_cast<int>(asmAlign_->points.size())) return;
  J rel = J::object();
  rel["path"] = asmAlign_->cheminRel;
  rel["cg"] = nullptr;
  rel["sn"] = as::referenceAccroche(asmAlign_->face, asmAlign_->points[i]);
  asmAlignPose(asmAlign_->coteFace, rel);
}

// Clic dans la vue pendant Aligner
void Cadre::asmAlignClicMarque(int i) {
  if (!asmAlign_ || i < 0 || i >= static_cast<int>(asmAlign_->cles.size())) return;
  const std::string k = asmAlign_->cles[i];
  if (k[0] == 'p') return asmAlignChoisirPoint(std::atoi(k.c_str() + 1));
  const J& a = *doc_.assemblage;
  const J* o = as::occurrence(a, asmAlign_->occ);
  const std::vector<RepereCandidat> R = k[0] == 's' ? asmReperesSous(texteDe(*o, "comp"), "") : asmReperesSous(as::actif(a), asmAlign_->occ);
  const size_t r = std::atoi(k.c_str() + 1);
  if (r < R.size()) asmAlignPose(k[0] == 's' ? 0 : 1, R[r].rel);
}

// asmSnapPick : face d'une instance admissible → ses points d'accroche
void Cadre::asmAlignClicFace(const as::Chemin& cheminFace, const gp_Pnt& pointActif, bool plan, const as::V3& normaleLocale) {
  if (!asmAlign_) return;
  const J& a = *doc_.assemblage;
  const as::Chemin P = as::cheminActif(a);
  const size_t n = P.size();
  as::Chemin path = cheminFace;
  if (path.size() < n || !estPrefixe(P, path)) return etat(L"Hors du composant actif.");
  const bool dansMoi = path.size() > n && path[n] == asmAlign_->occ;
  const int cote = asmAlign_->etape;
  if ((cote == 0) != dansMoi) return etat(cote == 0 ? L"Cliquez une face de l'occurrence à poser." : L"Cliquez une face d'un autre composant.");
  const std::string cid = as::compDuChemin(a, path);
  const auto it = asmSolides_.find(cid);
  if (it == asmSolides_.end()) return;
  const std::vector<as::FaceAccroche>& G = as::accrochesDe(*it->second);
  as::Repere W, Wa;
  as::monde(a, path, W);
  as::monde(a, P, Wa);
  const as::Repere Fi = as::inverser(as::composer(as::inverser(Wa), W));
  const as::V3 pl = as::appliquer(Fi, {pointActif.X(), pointActif.Y(), pointActif.Z()});
  const as::FaceAccroche* F = as::faceSous(G, pl, plan ? &normaleLocale : nullptr);
  if (!F) return etat(L"Cette face n'a pas de points d'accroche (ni plane, ni cylindrique) — utilisez une arête circulaire voisine ou un repère.");
  asmAlign_->aFace = true;
  asmAlign_->coteFace = cote;
  asmAlign_->face = *F;
  asmAlign_->points = as::pointsDe(*F);
  asmAlign_->nomFace = as::nomFace(*F);
  asmAlign_->cheminAbs = path;
  asmAlign_->cheminRel = as::Chemin(path.begin() + n + (cote == 0 ? 1 : 0), path.end());
  asmAlignMarques();
  montrerAssemblage();
  etat(tx(asmAlign_->nomFace) + wxString::Format(L" : %zu points d'accroche — cliquez-en un (ou dans le panneau).", asmAlign_->points.size()));
}

void Cadre::asmAlignValider() {
  if (!asmAlign_) return;
  if (asmAlign_->src.is_null() || asmAlign_->dst.is_null()) return etat(L"Aligner : choisissez les deux repères.");
  const J fin = *doc_.assemblage;
  auto avant = asmAlign_->avant;
  const std::string id = asmAlign_->occ;
  asmAlign_.reset();
  vue_->poserMarques({});
  doc_.assemblage = avant;
  changerAssemblage([&](J& a) { a = fin; });
  const J* o = as::occurrence(*doc_.assemblage, id);
  etat((o ? tx(texteDe(*o, "name")) : wxString()) + L" alignée" + (o && texteDe(*o, "st") == "warn" ? L" — ⚠ " + tx(texteDe(*o, "msg")) : wxString(L"")) + L". Elle suivra les repères si les composants changent.");
}

void Cadre::asmAlignAnnuler(bool dessiner) {
  if (!asmAlign_) return;
  doc_.assemblage = asmAlign_->avant;
  asmAlign_.reset();
  vue_->poserMarques({});
  if (dessiner) {
    asmDessiner();
    montrerRien();
  }
}

// ---- Les gestes de l'essai automatique ----
bool Cadre::asmEtapeEssai(const nlohmann::json& e, nlohmann::json& n) {
  const auto idDe = [&](const std::string& nom) {
    if (!doc_.assemblage) return std::string();
    for (const J& c : (*doc_.assemblage)["comps"])
      if (c.contains("occ"))
        for (const J& o : c["occ"])
          if (texteDe(o, "id") == nom || texteDe(o, "name") == nom) return texteDe(o, "id");
    return std::string();
  };
  bool fait = false;
  essaiMenu_ = true;
  if (e.contains("asm")) {
    const std::string q = e["asm"].get<std::string>();
    if (q == "basculer") asmBasculer();
    else if (q == "remonter") asmRemonter();
    else if (q == "echap") n["echap"] = asmEchap();
    else if (q == "composant") asmNouveauComposant();
    else if (q == "occurrence") asmNouvelleOccurrence();
    else if (q == "valider") asmAlignValider();
    fait = true;
  }
  if (e.contains("asmClic")) {
    asmCliqueOcc(idDe(e["asmClic"].get<std::string>()), e.value("ctrl", false), e.value("maj", false));
    fait = true;
  }
  if (e.contains("asmModeler")) {
    const std::string id = idDe(e["asmModeler"].get<std::string>());
    as::Chemin P = as::cheminActif(*doc_.assemblage);
    P.push_back(id);
    asmAller(P, "part");
    fait = true;
  }
  if (e.contains("asmMenu")) {
    essaiChoix_ = e.value("choix", std::string());
    essaiNom_ = e.value("nom", std::string());
    const std::string id = idDe(e["asmMenu"].get<std::string>());
    as::Chemin P = as::cheminActif(*doc_.assemblage);
    P.push_back(id);
    asmMenuOccurrence(P, id, true);
    n["entrees"] = essaiEntrees_;
    fait = true;
  }
  if (e.contains("panneau")) {
    const std::string t = e["panneau"].get<std::string>();
    bool trouve = false;
    essaiChoix_ = e.value("choix", std::string());
    const auto L = boutonsAsm_;
    for (const auto& [b, f] : L)
      if (!trouve && b.utf8_string().find(t) != std::string::npos) {
        f();
        trouve = true;
      }
    n["ok"] = trouve;
    fait = true;
  }
  if (e.contains("insererAsm")) {
    n["ok"] = asmInsererFichier(wxString::FromUTF8(e["insererAsm"].get<std::string>()).ToStdWstring());
    fait = true;
  }
  if (e.contains("geste")) {
    // {"geste":["move",0,12.4]} : un geste du manipulateur, valeur brute avant le pas
    asmGeste(0, "", 0, "", 0, false);
    asmGeste(1, e["geste"][0].get<std::string>(), e["geste"][1].get<int>(), e.value("degre", std::string()), e["geste"][2].get<double>(), e.value("libre", false));
    asmGeste(2, "", 0, "", 0, false);
    fait = true;
  }
  if (e.contains("alignPoint")) {
    asmAlignChoisirPoint(e["alignPoint"].get<int>());
    fait = true;
  }
  if (e.contains("alignFace")) {
    // {"alignFace":[chemin…], "p":[x,y,z] dans le repère du composant visé} : comme un clic sur cette face
    as::Chemin ch;
    for (const auto& x : e["alignFace"]) ch.push_back(idDe(x.get<std::string>()));
    as::Repere W, Wa;
    as::monde(*doc_.assemblage, ch, W);
    as::monde(*doc_.assemblage, as::cheminActif(*doc_.assemblage), Wa);
    const as::V3 q = as::appliquer(as::composer(as::inverser(Wa), W), {e["p"][0].get<double>(), e["p"][1].get<double>(), e["p"][2].get<double>()});
    asmAlignClicFace(ch, gp_Pnt(q[0], q[1], q[2]), false, as::V3{0, 0, 0});
    if (asmAlign_) {
      n["points"] = nlohmann::json::array();
      for (const as::PointAccroche& p : asmAlign_->points) n["points"].push_back(p.nom);
    }
    fait = true;
  }
  essaiMenu_ = false;
  if (fait) n["etat"] = std::string(etatVue_->texte().utf8_str());
  return fait;
}

void Cadre::asmMesureEssai(nlohmann::json& n) {
  nlohmann::json lignes = nlohmann::json::array();
  std::function<void(const wxTreeItemId&, int)> lire = [&](const wxTreeItemId& it, int prof) {
    wxTreeItemIdValue k;
    for (wxTreeItemId c = arbre_->GetFirstChild(it, k); c.IsOk(); c = arbre_->GetNextChild(it, k)) {
      lignes.push_back(std::string(prof, ' ') + arbre_->GetItemText(c).utf8_string());
      if (arbre_->IsExpanded(c)) lire(c, prof + 1);
    }
  };
  if (arbre_->GetRootItem().IsOk()) lire(arbre_->GetRootItem(), 0);
  n["arbre"] = std::move(lignes);
  n["mode"] = asmMode_;
  n["sel"] = asmSel_;
  n["lot"] = asmLot();
  if (!doc_.assemblage) return;
  const J& a = *doc_.assemblage;
  n["actif"] = as::actif(a);
  n["chemin"] = as::cheminActif(a);
  n["nComps"] = a["comps"].size();
  nlohmann::json L = nlohmann::json::array();
  for (const as::Instance& i : as::instances(a, as::racine(a))) {
    nlohmann::json l = {{"path", i.chemin}, {"comp", i.comp}, {"o", i.F.o}, {"x", i.F.x}, {"z", i.F.z}};
    if (!i.chemin.empty())
      if (const J* o = as::occurrence(a, i.chemin.back())) {
        l["name"] = texteDe(*o, "name");
        l["st"] = texteDe(*o, "st");
        l["fixed"] = o->value("fixed", false);
        l["align"] = o->contains("align") && (*o)["align"].is_object();
      }
    L.push_back(std::move(l));
  }
  n["instances"] = std::move(L);
}
