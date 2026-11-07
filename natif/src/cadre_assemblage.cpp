// L'assemblage à l'écran : traduction de src/47-assemblage-interface.js, 48-assemblage-placement.js et de treeComps (42-arbre-modele.js).
#include "theme.h"
#include <BRepAlgoAPI_Common.hxx>
#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepGProp.hxx>
#include <BRep_Builder.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
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

#include "profil_guide.h"
#include "enregistrer.h"
#include "assemblage.h"
#include "cadre.h"
#include "conges.h"
#include "enregistrer.h"
#include "fiches.h"
#include "interface_esquisse.h"
#include "lien_arbre.h"
#include "normalises.h"
#include "rejeu.h"
#include "rendu_moteur.h"
#include <IntCurvesFace_ShapeIntersector.hxx>
#include <gp_Lin.hxx>
#include "assemblage_refs.h"
#include "construction.h"

namespace as = assemblage;
using J = nlohmann::ordered_json;

namespace {
nlohmann::ordered_json docPorteurPat(const Document& d, const nlohmann::ordered_json* owner) {  // le document du composant qui porte la répétition
  if (owner && owner->contains("doc") && (*owner)["doc"].is_object()) return (*owner)["doc"];
  return documentActuelJson(d);
}
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

namespace {
const std::vector<std::pair<std::string, double>> MATIERES = {{"Acier", 7.85}, {"Inox", 7.93}, {"Aluminium", 2.70}, {"Laiton", 8.50}, {"Bronze", 8.80}, {"Cuivre", 8.96}, {"Fonte", 7.20}, {"Titane", 4.43}, {"PLA", 1.24}, {"ABS", 1.04}, {"PETG", 1.27}, {"Nylon (PA)", 1.14}, {"POM", 1.41}, {"Bois (chêne)", 0.75}};
std::string fmt(double v, int d = 2) {
  char b[64];
  snprintf(b, sizeof b, "%.*f", d, v);
  std::string s = b;
  for (char& c : s)
    if (c == '.') c = ',';
  return s;
}
}  // namespace

bool Cadre::asmOn() const { return doc_.assemblage && (asmMode_ == "asm" || as::aDesEnfants(*doc_.assemblage)); }

void Cadre::asmApresRejeu(const ResultatRejeu& r, bool ajuster) {
  if (!doc_.assemblage) {
    asmInspectFermer();
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
    as::memoriserSolides(&asmSolides_);
    as::majSolides(asmSolides_, doc_, r);
    bool bouge = as::resoudre(*copie, asmSolides_);
    // asmExtSync : ce que l'on vient de placer ou de rejouer a pu bouger ce que visent les autres ; trois passes au plus
    if (as::aDesReferences(*copie))
      for (int passe = 0; passe < 3 && as::majReferences(asmSolides_, doc_); passe++)
        if (as::resoudre(*copie, asmSolides_)) bouge = true;
    if (bouge) remplirArbre();
  }
  // Les références du composant actif : son rejeu les a lues avant ; si ce qu'elles voient a changé, il se rejoue
  const std::string sigActif = as::signatureActif(doc_, asmSolides_);
  if (sigActif != asmSigActif_) {
    asmSigActif_ = sigActif;
    if (!sigActif.empty() && asmPassesRefs_ < 3) {
      asmPassesRefs_++;
      CallAfter([this] {
        if (!doc_.assemblage || esquisseOuverte_ >= 0) return;
        as::suivreExternesActif(doc_);
        recalculer();
      });
    } else if (!sigActif.empty()) {
      etat(L"Références circulaires entre composants : position mémorisée.");
    }
  } else {
    asmPassesRefs_ = 0;
  }
  if (asmLiensNeufs_) {
    asmLiensNeufs_ = false;
    if (!asmLies().empty()) CallAfter([this] {
      asmLiensRefBase(asmLies());
      asmLiensVerifier(false);
    });
  }
  asmDessiner();
  if (ajuster) vue_->ajuster();
}

// cgPickOtherComp, cgPickOtherEdge : pendant le choix d'une référence, les autres composants répondent aussi
bool Cadre::cgPiocheAutre(const gp_Pnt& o, const gp_Dir& d) {
  if (!pioche_ || refAttendue_.empty() || !doc_.assemblage || asmMode_ == "asm" || esquisseOuverte_ >= 0) return false;
  const J& a = *doc_.assemblage;
  if (!as::aDesEnfants(a)) return false;
  const ElementConstruction* el = nullptr;
  for (const ElementConstruction& c : doc_.construction)
    if (c.id == refAttendue_) el = &c;
  std::string type, titre;
  if (!el || !emplacementConstruction(*el, rangAttendu_, type, titre) || (type != "plane" && type != "axis" && type != "point")) return false;
  const auto toucher = [](const TopoDS_Shape& forme, const gp_Pnt& p, const gp_Dir& dir, double& w, TopoDS_Face& f) {
    if (forme.IsNull()) return false;
    try {
      IntCurvesFace_ShapeIntersector inter;
      inter.Load(forme, 1e-6);
      inter.Perform(gp_Lin(p, dir), -1e9, 1e9);
      bool oui = false;
      for (int i = 1; i <= inter.NbPnt(); i++)
        if (!oui || inter.WParameter(i) < w) {
          w = inter.WParameter(i);
          f = inter.Face(i);
          oui = true;
        }
      return oui;
    } catch (const Standard_Failure&) {
      return false;
    }
  };
  double wActif = 1e300;
  TopoDS_Face fActif;
  if (!toucher(forme_, o, d, wActif, fActif)) wActif = 1e300;
  std::vector<as::ListeExterne> listes = as::listesExternes(a, asmSolides_);
  // La surface la plus proche parmi les autres composants
  const as::ListeExterne* lF = nullptr;
  TopoDS_Face fF;
  double wF = 1e300;
  for (const as::ListeExterne& L : listes) {
    const auto it = asmSolides_.find(L.comp);
    if (it == asmSolides_.end()) continue;
    const as::Repere Fi = as::inverser(L.passage);
    const as::V3 p = as::appliquer(Fi, {o.X(), o.Y(), o.Z()}), v = as::tourner(Fi, {d.X(), d.Y(), d.Z()});
    double w = 0;
    TopoDS_Face f;
    if (toucher(it->second->forme, gp_Pnt(p[0], p[1], p[2]), gp_Dir(v[0], v[1], v[2]), w, f) && w < wF) {
      wF = w;
      fF = f;
      lF = &L;
    }
  }
  const auto nomDe = [&](const as::ListeExterne& L) {
    const J* oc = L.chemin.empty() ? nullptr : as::occurrence(a, L.chemin.back());
    return oc ? oc->value("name", L.nom) : L.nom;
  };
  J r;
  // Une arête à 7 pixels au plus, que rien ne cache
  {
    const wxPoint c = vue_->dernierClic();
    const double pres = std::min(wActif, wF);
    const as::ListeExterne* lE = nullptr;
    const AreteListee* best = nullptr;
    double bd = 7;
    for (const as::ListeExterne& L : listes)
      for (const AreteListee& E : L.aretes) {
        wxPoint A = vue_->pixelDe(E.pts[0][0], E.pts[0][1], E.pts[0][2]);
        for (size_t k = 1; k < E.pts.size(); k++) {
          const wxPoint B = vue_->pixelDe(E.pts[k][0], E.pts[k][1], E.pts[k][2]);
          const double dx = B.x - A.x, dy = B.y - A.y, l2 = std::max(dx * dx + dy * dy, 1e-9);
          const double t = std::max(0.0, std::min(1.0, ((c.x - A.x) * dx + (c.y - A.y) * dy) / l2));
          const double q = std::hypot(c.x - (A.x + t * dx), c.y - (A.y + t * dy));
          if (q < bd) {
            const Vec3 P0 = E.pts[k - 1], P1 = E.pts[k];
            const double wx = P0[0] + (P1[0] - P0[0]) * t - o.X(), wy = P0[1] + (P1[1] - P0[1]) * t - o.Y(), wz = P0[2] + (P1[2] - P0[2]) * t - o.Z();
            if (wx * d.X() + wy * d.Y() + wz * d.Z() <= pres + 0.3 + std::abs(pres) * 0.004 || pres > 1e299) {
              bd = q;
              best = &E;
              lE = &L;
            }
          }
          A = B;
        }
      }
    if (best) {
      const GeoArete G = geoArete(best->pts);
      const as::Repere Fi = as::inverser(lE->passage);
      const auto local = [&](const Vec3& p) {
        as::V3 q = as::appliquer(Fi, p);
        for (double& x : q) x = std::round(x * 1e4) / 1e4;
        return J::array({q[0], q[1], q[2]});
      };
      double len = 0;
      for (size_t i = 1; i < best->pts.size(); i++) len += std::hypot(best->pts[i][0] - best->pts[i - 1][0], best->pts[i][1] - best->pts[i - 1][1], best->pts[i][2] - best->pts[i - 1][2]);
      J base = {{"k", "xe"}, {"ctx", lE->ext["ctx"]}, {"path", lE->ext["path"]}, {"pos", local(best->mid)}, {"len", std::round(len * 1e4) / 1e4}, {"sig", nullptr}};
      if (!best->nom.empty()) base["nom"] = best->nom;
      const std::string nm = nomDe(*lE);
      if (type == "point") {
        const auto ecran = [&](const Vec3& p) {
          const wxPoint q = vue_->pixelDe(p[0], p[1], p[2]);
          return std::hypot(static_cast<double>(q.x - c.x), static_cast<double>(q.y - c.y));
        };
        const double d0 = ecran(best->pts.front()), d1 = ecran(best->pts.back());
        base["sub"] = "edge";
        if (G.cercle && std::min(d0, d1) > 12) {
          base["name"] = "Centre · " + nm;
        } else {
          base["sub"] = "vtx";
          base["vpos"] = local(d0 <= d1 ? best->pts.front() : best->pts.back());
          base["name"] = "Sommet · " + nm;
        }
        r = base;
      } else if (type == "axis" && (G.droite || G.cercle)) {
        base["sub"] = "edge";
        base["name"] = std::string(G.cercle ? "Axe du cercle" : "Arête") + " · " + nm;
        r = base;
      } else if (type == "plane" && G.cercle) {
        base["sub"] = "edge";
        base["name"] = "Plan du cercle · " + nm;
        r = base;
      }
    }
  }
  if (r.is_null()) {
    if (type == "point" || !lF || wActif < wF - 1e-6) return false;  // la pièce active est devant
    const auto it = asmSolides_.find(lF->comp);
    as::FaceCapturee C;
    if (it == asmSolides_.end() || !as::capturerFace(it->second->forme, fF, C)) return false;
    if ((type == "plane") != C.plan) return false;
    r = {{"k", "xf"}, {"ctx", lF->ext["ctx"]}, {"path", lF->ext["path"]}, {"ref", C.ref}, {"loc", as::localisationFace(C)},
         {"name", std::string(C.plan ? "Face" : "Axe de face") + " · " + nomDe(*lF)}, {"sig", nullptr}};
    if (!C.nom.empty()) r["nom"] = C.nom;
  }
  const std::string id = refAttendue_;
  const int rang = rangAttendu_;
  pioche_ = nullptr;
  reglerConstruction(id, "r/" + std::to_string(rang), r.dump());
  return true;
}

// asmFill : tout l'arbre, dans le repère de l'instance éditée
void Cadre::asmDessiner() {
  std::vector<Vue3D::OccVue> L;
  std::vector<std::vector<gp_Pnt>> filetsH, filetsA;
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
      if (!v.fantome) {  // asmThrLines : les filets des corps affichés
        const as::Repere Fv = as::composer(V, inst.F);
        const auto placer = [&Fv](const std::vector<gp_Pnt>& P) {
          std::vector<gp_Pnt> Q;
          Q.reserve(P.size());
          for (const gp_Pnt& p : P) {
            const as::V3 q = as::appliquer(Fv, {p.X(), p.Y(), p.Z()});
            Q.emplace_back(q[0], q[1], q[2]);
          }
          return Q;
        };
        for (const SpiraleFilet& sf : S.spirales)
          if (std::any_of(S.corps.begin(), S.corps.end(), [&](const auto& c) { return c.first == sf.corps; })) {
            filetsH.push_back(placer(sf.helice));
            filetsA.push_back(placer(sf.anneau));
          }
      }
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
      // magLinesFor : les lignes de champ, si on les a demandées pour cette occurrence
      if (!inst.chemin.empty() && !v.fantome) {
        const J* oc = as::occurrence(a, inst.chemin.back());
        const J* cc = as::composant(a, inst.comp);
        J mag;
        if (oc && oc->value("mag", false) && cc && cc->contains("doc") && normalises::aimantDe((*cc)["doc"], mag)) {
          static std::map<std::string, std::vector<std::array<float, 9>>> memoire;
          std::vector<std::array<float, 9>>& T = memoire[mag.value("code", std::string())];
          if (T.empty())
            for (const normalises::SegmentChamp& s : normalises::lignesChamp(mag))
              T.push_back({static_cast<float>(s.a[0]), static_cast<float>(s.a[1]), static_cast<float>(s.a[2]), static_cast<float>(s.b[0]), static_cast<float>(s.b[1]), static_cast<float>(s.b[2]), s.couleur[0], s.couleur[1], s.couleur[2]});
          v.traits = T;
        }
      }
      L.push_back(std::move(v));
    }
  }
  vue_->cheminPiece(doc_.assemblage ? as::cheminActif(*doc_.assemblage) : as::Chemin{});
  vue_->modePlacer(asmMode_ == "asm" && atelier_ == Atelier::CAO);
  vue_->montrerOccurrences(L);
  vue_->montrerFiletsAutres(filetsH, filetsA);
  asmNbFilets_ = static_cast<int>(filetsH.size());
  asmMontrerChoix();
}

void Cadre::asmMontrerChoix() {
  const std::vector<std::string> lot = asmLot();
  vue_->choisirOccurrences(std::set<std::string>(lot.begin(), lot.end()));
  asmGizmo();
  for (const auto& [id, ligne] : lignesOcc_) {
    if (!ligne.IsOk()) continue;
    const bool on = std::find(lot.begin(), lot.end(), id) != lot.end();
    arbre_->SetItemBackgroundColour(ligne, on ? th(wxColour(0x0a, 0x4a, 0x8a)) : th(wxColour(0x2a, 0x2c, 0x30)));
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
  asmInspectFermer();
  asmAlignAnnuler(false);
  asmPatAnnuler(false);
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
    if (solideCalculable_ && asmSolides_.find(cid) == asmSolides_.end()) recalculer();  // asmEnsure : la pièce devient un composant
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
    as::resoudre(d["asm"], asmSolides_);
  }, message);
}

void Cadre::asmCliqueOcc(const std::string& id, bool ctrl, bool maj) {
  if (asmAlign_) return;
  mesureEffacer(true);
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
  if (!mesDessin_.vide()) {
    mesureEffacer(false);
    return true;
  }
  if (asmNormPose_) {
    asmNormPoseAnnuler();
    return true;
  }
  if (!doc_.assemblage || asmMode_ != "asm") return false;
  if (asmAlign_) {
    asmAlignAnnuler(true);
    return true;
  }
  if (asmPatEd_) {
    asmPatAnnuler(true);
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
    c["doc"] = as::documentVide(nomC);
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
  if (choix.ShowModal() != wxID_OK) return;
  wxMessageDialog q(this, L"Insérer " + wxFileName(choix.GetPath()).GetFullName() + L" :", L"Insérer", wxYES_NO | wxCANCEL | wxYES_DEFAULT | wxICON_QUESTION);
  q.SetYesNoCancelLabels(L"Lier (modifiable ici, la source suit)", L"Copier (indépendant)", L"Annuler");
  const int r = q.ShowModal();
  if (r == wxID_YES) asmLienInserer(choix.GetPath().ToStdWstring());
  else if (r == wxID_NO) asmInsererFichier(choix.GetPath().ToStdWstring());
}

// À droite de ce qui est déjà affiché
double Cadre::asmDroiteDeTout() const {
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
  return vu ? hi + 20 : 0;
}

// Les sources d'import d'un fichier inséré viennent avec lui
void Cadre::asmAjouterSources(const J& racineFichier) {
  if (!racineFichier.contains("imports") || !racineFichier["imports"].is_object() || racineFichier["imports"].empty()) return;
  std::map<std::string, std::string> S;
  for (auto it = racineFichier["imports"].begin(); it != racineFichier["imports"].end(); ++it)
    if (it.value().is_string()) S[it.key()] = it.value().get<std::string>();
  if (S.empty() || !doc_.assemblage) return;
  const J resolu = *doc_.assemblage;
  modifierStructure(doc_, [&](J& j) { j["asm"] = resolu; }, S);
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
    asmImports_ = racine;
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
  const double dx = asmDroiteDeTout();
  asmAjouterSources(asmImports_);
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
      const auto cleNeuve = [&](const std::string& k) {
        const size_t i = k.find('|');
        if (i == std::string::npos) return k;
        const auto it = om.find(k.substr(0, i));
        return (it == om.end() ? k.substr(0, i) : it->second) + k.substr(i);
      };
      if (c.contains("pats") && c["pats"].is_array())
        for (J& p : c["pats"]) {
          if (p.contains("src") && p["src"].is_array())
            for (J& x : p["src"])
              if (x.is_string() && om.count(x.get<std::string>())) x = om[x.get<std::string>()];
          if (p.contains("skip") && p["skip"].is_array())
            for (J& x : p["skip"])
              if (x.is_string()) x = cleNeuve(x.get<std::string>());
        }
      if (c.contains("occ"))
        for (J& o : c["occ"]) {
          if (o.contains("pat") && o["pat"].is_object()) o["pat"]["k"] = cleNeuve(texteDe(o["pat"], "k"));
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
    // asmLinkBadge : 🔗 lié, ✎ modifié ici, ⚠ problème
    if (c->contains("link") && (*c)["link"].is_object()) {
      t += L"  🔗";
      if (asmLienSale(cid)) t += L" ✎";
      const auto eL = asmLiensEtat_.find(cid);
      if (eL != asmLiensEtat_.end() && eL->second.alerte) t += L" ⚠";
    } else if (!texteDe(*c, "of").empty()) t += L"  🔗";
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
  if (const std::vector<std::string> lies = asmLies(); !lies.empty()) {
    bool alerte = false;
    for (const std::string& id : lies) {
      const auto eL = asmLiensEtat_.find(id);
      alerte = alerte || (eL != asmLiensEtat_.end() && eL->second.alerte);
    }
    arbre_->AppendItem(sec, wxString::Format(L"🔗 %zu composant(s) lié(s)%s  🔄", lies.size(), alerte ? L" ⚠" : L""), 12, -1, lien(LienArbre::LIENS, {}, "", false));
  }
  enfants(rid, {}, sec);
  arbre_->Expand(sec);
  // treePatterns
  {
    struct LignePat {
      const J* c;
      const J* p;
      as::Chemin chemin;
    };
    std::vector<LignePat> R;
    std::set<std::string> vus;
    for (const as::Instance& i : tout) {
      if (!vus.insert(i.comp).second) continue;
      const J* c = as::composant(a, i.comp);
      if (c && c->contains("pats") && (*c)["pats"].is_array())
        for (const J& p : (*c)["pats"]) R.push_back({c, &p, i.chemin});
    }
    if (!R.empty()) {
      const wxTreeItemId s = arbre_->AppendItem(r, wxString::Format(L"Répétitions (%zu)", R.size()), 15);
      arbre_->SetItemBold(s);
      for (const LignePat& q : R) {
        int n = 0;
        for (const J& o : (*q.c)["occ"]) n += o.contains("pat") && o["pat"].is_object() && texteDe(o["pat"], "id") == texteDe(*q.p, "id") ? 1 : 0;
        std::string src;
        for (const J& x : (*q.p)["src"])
          if (const J* o = as::occurrence(a, x.get<std::string>())) src += (src.empty() ? "" : ", ") + texteDe(*o, "name");
        wxString t = tx(texteDe(*q.p, "name")) + L"  " + tx(as::nomRepetition(*q.p)) + L" · " + tx(src) + wxString::Format(L" ×%zu", n + (*q.p)["src"].size());
        if (texteDe(*q.p, "st") == "warn") t += L"  ⚠";
        auto* l = lien(LienArbre::REPETITION, q.chemin, texteDe(*q.p, "id"), false);
        l->plan = texteDe(*q.c, "id");
        arbre_->AppendItem(s, t, 15, -1, l);
      }
      arbre_->Expand(s);
    }
  }
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
  if (l->sorte == LienArbre::LIENS) {
    CallAfter([this] { asmLiensVerifier(true); });
    return true;
  }
  if (l->sorte == LienArbre::REPETITION) {
    const as::Chemin ch = l->chemin;
    const std::string owner = l->plan, pat = l->occ;
    CallAfter([this, ch, owner, pat] {
      if (asmPatEd_) return;
      if (asmMode_ != "asm" || ch != as::cheminActif(*doc_.assemblage)) asmAller(ch, "asm");
      asmPatDebut(owner, pat, std::make_shared<J>(*doc_.assemblage));
    });
    return true;
  }
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
  if (l->sorte == LienArbre::REPETITION) {
    const std::string owner = l->plan, pat = l->occ;
    const as::Chemin ch = l->chemin;
    CallAfter([this, owner, pat, ch] {
      wxMenu m;
      enum { MOD = wxID_HIGHEST + 7500, SUP };
      m.Append(MOD, L"🔁 Modifier");
      m.Append(SUP, L"🗑 Supprimer la répétition");
      const int c = choisirMenu(m);
      if (c != MOD && c != SUP) return;
      if (asmMode_ != "asm" || ch != as::cheminActif(*doc_.assemblage)) asmAller(ch, "asm");
      if (c == MOD) asmPatDebut(owner, pat, std::make_shared<J>(*doc_.assemblage));
      else asmPatSupprimer(owner, pat);
    });
    return true;
  }
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
  enum { MODELER = wxID_HIGHEST + 7000, PLACER, DEPLACER, OCCURRENCE, FIXER, RENOMMER, SUPPRIMER, MASQUER, REPETER, LIEN_MAJ, LIEN_RELIER, LIEN_ROMPRE, LIEN_EXTRAIRE, LIEN_REMPLACER, NORM_MODIFIER, AIM_LIGNES, AIM_INFO };
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
  const bool normalisee = c->contains("doc") && (*c)["doc"].is_object() && (*c)["doc"].contains("std") && (*c)["doc"]["std"].is_object();
  J aimant;
  const bool estAimant = direct && normalisee && normalises::aimantDe((*c)["doc"], aimant);
  if (normalisee) m.Append(NORM_MODIFIER, L"🔩 Modifier la pièce normalisée…");
  if (estAimant) {
    m.Append(AIM_LIGNES, o->value("mag", false) ? L"🧲 Masquer les lignes de champ" : L"🧲 Afficher les lignes de champ");
    m.Append(AIM_INFO, L"ℹ️ Caractéristiques");
  }
  if (direct) {
    m.Append(DEPLACER, L"✥ Déplacer");
    m.Append(OCCURRENCE, L"➕ Nouvelle occurrence");
    m.Append(REPETER, L"🔁 Répétition");
    m.Append(FIXER, o->value("fixed", false) ? L"📌 Libérer" : L"📌 Fixer");
    m.Append(MASQUER, o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>() ? L"👁 Afficher" : L"🙈 Masquer");
    m.Append(RENOMMER, L"🏷 Renommer le composant");
    m.Append(SUPPRIMER, dansLot ? wxString::Format(L"🗑 Supprimer le lot (%zu)", lot.size()) : wxString(L"🗑 Supprimer"));
  }
  const std::string cidOcc = texteDe(*o, "comp");
  if (cidOcc != as::racine(*doc_.assemblage)) {
    if (c->contains("link") && (*c)["link"].is_object()) {
      m.Append(LIEN_MAJ, L"🔄 Mettre à jour les liens");
      m.Append(LIEN_RELIER, L"🔗 Relier la source…");
      m.Append(LIEN_ROMPRE, L"✂ Rompre le lien");
    } else if (texteDe(*c, "of").empty()) {
      m.Append(LIEN_EXTRAIRE, L"📤 Extraire vers un fichier…");
      m.Append(LIEN_REMPLACER, L"🔗 Remplacer par un lien…");
    }
  }
  const int choix = choisirMenu(m);
  if (choix == NORM_MODIFIER) return asmNormModifier(id);
  if (choix == AIM_LIGNES) {
    const bool montre = o->value("mag", false);
    changerAssemblage([&](J& a) {
      J* q = as::occurrence(a, id);
      if (montre) q->erase("mag");
      else (*q)["mag"] = true;
    });
    return;
  }
  if (choix == AIM_INFO) {
    wxString t;
    for (const auto& [k, v] : normalises::caracteristiques(aimant)) t += tx(k) + L" : " + tx(v) + L"\n";
    t += L"\nChamp calculé pour l’aimant seul dans l’air, à Br moyen. L’acier voisin et la température n’y entrent pas.";
    if (essaiMenu_) etat(t);
    else wxMessageBox(t, tx(texteDe(*o, "name")), wxOK | wxICON_INFORMATION, this);
    return;
  }
  if (choix == LIEN_MAJ) return asmLiensVerifier(true);
  if (choix == LIEN_RELIER) return asmLienRelier(cidOcc);
  if (choix == LIEN_ROMPRE) return asmLienRompre(cidOcc);
  if (choix == LIEN_EXTRAIRE) return asmLienExtraire(cidOcc);
  if (choix == LIEN_REMPLACER) return asmLienRemplacer(cidOcc);
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
  } else if (choix == REPETER) {
    if (asmMode_ != "asm") asmAller(AP, "asm", id);
    else if (std::find(lot.begin(), lot.end(), id) == lot.end()) {
      asmSel_ = id;
      asmLot_.clear();
    }
    asmRepetition();
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
    b->fond(th(wxColour(0x2a, 0x2c, 0x30)));
    b->SetMinSize(FromDIP(wxSize(-1, 26)));
    const auto action = f;
    b->surClic = [this, action] { CallAfter([action] { action(); }); };
    rangAsm_->Add(b, 0, wxEXPAND | wxTOP, FromDIP(4));
    boutonsAsm_.push_back({t, action});
  }
  carteDroite_->contenu()->Show(rangAsm_, !L.empty());
  hauteurBoutonsAsm_ = static_cast<int>(L.size()) * 30;
  carteDroite_->Layout();
  carteDroite_->Refresh();
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
        c.titre = i ? "   limite haute" : "   limite basse";
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
  if (asmInspect_) asmPanneauInspection(ch, B);
  else if (asmPatEd_) asmPanneauRepetition(ch, B);
  if (asmInspect_ || asmPatEd_) {
  } else if (asmAlign_) {
    asmPanneauAligner(ch, B);
  } else if (lot.empty()) {
    const std::string cat = "🧩 " + (c ? texteDe(*c, "name") : std::string());
    lecture(cat, "Placés ici", std::to_string(c && c->contains("occ") ? (*c)["occ"].size() : 0) + " composant(s), " + std::to_string(a["comps"].size()) + " dans le fichier");
    B.push_back({L"➕ Nouveau composant", [this] { asmNouveauComposant(); }});
    B.push_back({L"📥 Insérer…", [this] { asmInserer(); }});
    B.push_back({L"🔩 Normalisés…", [this] { asmNormalises(); }});
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
    const bool instance = o->contains("pat") && (*o)["pat"].is_object();
    if (instance) {
      const std::string pid = texteDe((*o)["pat"], "id");
      std::string nomP = "?", sorteP;
      const std::string oid = c ? texteDe(*c, "id") : std::string();
      if (c && c->contains("pats"))
        for (const J& q : (*c)["pats"])
          if (texteDe(q, "id") == pid) {
            nomP = texteDe(q, "name");
            sorteP = as::nomRepetition(q);
          }
      lecture(plc, "🔁 Instance de", nomP + " (" + sorteP + ") : position imposée, elle suit sa source");
      B.push_back({L"🔁 Modifier la répétition", [this, oid, pid] { asmPatDebut(oid, pid, std::make_shared<J>(*doc_.assemblage)); }});
    } else if (al) {
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
    if (!o->value("fixed", false) && !instance) {
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
    if (cc && cc->contains("doc") && (*cc)["doc"].is_object() && (*cc)["doc"].contains("std") && (*cc)["doc"]["std"].is_object()) B.push_back({L"🔩 Modifier…", [this, id] { asmNormModifier(id); }});
    B.push_back({L"➕ Occurrence", [this] { asmNouvelleOccurrence(); }});
    if (!instance) B.push_back({L"🔁 Répétition", [this] { asmRepetition(); }});
    const bool fx = o->value("fixed", false);
    B.push_back({fx ? L"📌 Libérer" : L"📌 Fixer", [this, id, fx] { changerAssemblage([&](J& a2) { (*as::occurrence(a2, id))["fixed"] = !fx; }); }});
    B.push_back({L"🗑 Supprimer", [this, id] { asmSupprimer({id}); }});
    if (cc && texteDe(*cc, "id") != as::racine(a)) {
      const std::string cidc = texteDe(*cc, "id");
      if (cc->contains("link") && (*cc)["link"].is_object()) {
        B.push_back({L"🔄 Mettre à jour les liens", [this] { asmLiensVerifier(true); }});
        B.push_back({L"🔗 Relier la source…", [this, cidc] { asmLienRelier(cidc); }});
        B.push_back({L"✂ Rompre le lien", [this, cidc] { asmLienRompre(cidc); }});
      } else if (texteDe(*cc, "of").empty()) {
        B.push_back({L"📤 Extraire vers un fichier…", [this, cidc] { asmLienExtraire(cidc); }});
        B.push_back({L"🔗 Remplacer par un lien…", [this, cidc] { asmLienRemplacer(cidc); }});
      }
    }
  }
  poserChamps(ch, false);
  ficheId_ = "@asm";
  poserBoutonsPanneau(B);
}

// Un réglage du panneau
void Cadre::asmFiche(const std::string& cle, const std::string& valeur) {
  if (!doc_.assemblage) return;
  if (cle.rfind("mat/", 0) == 0) {
    // La matière d'un composant : asmInspectProps
    const std::string cid = cle.substr(4);
    J m;
    for (const auto& [nom, rho] : MATIERES)
      if (nom == valeur) m = J{{"name", nom}, {"rho", rho}};
    if (m.is_null()) return;
    const J* c0 = as::composant(*doc_.assemblage, cid);
    const J resolu = *doc_.assemblage;
    const std::string act = as::actif(resolu);
    changerStructure([&](J& d) {
      d["asm"] = resolu;
      if (cid == act) d["mat"] = m;
      else (*as::composant(d["asm"], cid))["doc"]["mat"] = m;
    }, L"Matière de « " + (c0 ? tx(texteDe(*c0, "name")) : wxString()) + L" »");
    return asmInspecter();
  }
  if (asmPatFiche(cle, valeur)) return;
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
  if (asmMode_ == "asm") dynPosee_ = false;
  else if (dynPosee_) return;
  Vue3D::Gizmo G;
  if (doc_.assemblage && asmMode_ == "asm" && !asmAlign_ && asmLot().size() == 1) {
    const J* o = as::occurrence(*doc_.assemblage, asmSel_);
    const J& a = *doc_.assemblage;
    if (o && !(o->contains("pat") && (*o)["pat"].is_object())) {
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
  if (asmNormEtapeEssai(e, n)) fait = true;
  if (mesureEtapeEssai(e, n)) fait = true;
  if (e.contains("asm")) {
    const std::string q = e["asm"].get<std::string>();
    if (q == "basculer") asmBasculer();
    else if (q == "remonter") asmRemonter();
    else if (q == "echap") n["echap"] = asmEchap();
    else if (q == "composant") asmNouveauComposant();
    else if (q == "occurrence") asmNouvelleOccurrence();
    else if (q == "repetition") asmRepetition();
    else if (q == "inspecter") asmInspecter();
    else if (q == "depuisCorps") asmDepuisCorps({});
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
  if (e.contains("versComposant")) {
    // {"versComposant":"sk_1", "corps":false, "choix":"…"}
    essaiChoix_ = e.value("choix", std::string());
    asmDeplacerVers(e.value("corps", false), e["versComposant"].get<std::string>());
    n["entrees"] = essaiEntrees_;
    fait = true;
  }
  if (e.contains("liens") || e.contains("lierAsm") || e.contains("lienRompre") || e.contains("lienExtraire") || e.contains("lienRemplacer") || e.contains("lienRelier")) {
    essaiChoix_ = e.value("choix", std::string());
    const auto cidDe = [&](const std::string& nom) {
      const J* o = as::occurrence(*doc_.assemblage, idDe(nom));
      return o ? texteDe(*o, "comp") : std::string();
    };
    if (e.contains("lierAsm")) n["ok"] = asmLienInserer(wxString::FromUTF8(e["lierAsm"].get<std::string>()).ToStdWstring());
    if (e.contains("lienRompre")) asmLienRompre(cidDe(e["lienRompre"].get<std::string>()));
    if (e.contains("lienExtraire")) asmLienExtraire(cidDe(e["lienExtraire"][0].get<std::string>()), wxString::FromUTF8(e["lienExtraire"][1].get<std::string>()).ToStdWstring());
    if (e.contains("lienRemplacer")) asmLienRemplacer(cidDe(e["lienRemplacer"][0].get<std::string>()), wxString::FromUTF8(e["lienRemplacer"][1].get<std::string>()).ToStdWstring());
    if (e.contains("lienRelier")) asmLienRelier(cidDe(e["lienRelier"][0].get<std::string>()), wxString::FromUTF8(e["lienRelier"][1].get<std::string>()).ToStdWstring());
    if (e.contains("liens")) {
      const std::string q = e["liens"].get<std::string>();
      if (q == "verifier") asmLiensVerifier(true);
      else if (q == "ecrire") asmLiensEcrire();
    }
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
  asmLiensMesure(n);
  if (asmInspect_) {
    nlohmann::json I = {{"volume", asmInspect_->volume}, {"masse", asmInspect_->masse}, {"com", asmInspect_->com}};
    I["items"] = nlohmann::json::array();
    for (const Inspection::Item& x : asmInspect_->items) I["items"].push_back({{"label", x.nom}, {"mat", x.matiere}, {"rho", x.rho}, {"v", x.v}, {"mass", x.masse}, {"c", x.c}});
    I["inter"] = nlohmann::json::array();
    for (const Inspection::Inter& x : asmInspect_->inter) I["inter"].push_back({{"a", x.a}, {"b", x.b}, {"v", x.v}});
    n["inspection"] = std::move(I);
  }
}

// ---- Les répétitions de composants (asmPatStart, asmPatProps…) ----
nlohmann::ordered_json* Cadre::asmPatCourant() {
  if (!asmPatEd_ || !doc_.assemblage) return nullptr;
  J* o = as::composant(*doc_.assemblage, asmPatEd_->owner);
  if (!o || !o->contains("pats") || !(*o)["pats"].is_array()) return nullptr;
  for (J& p : (*o)["pats"])
    if (texteDe(p, "id") == asmPatEd_->pat) return &p;
  return nullptr;
}

void Cadre::asmRepetition() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  if (asmMode_ != "asm") asmBasculer();
  if (asmPatEd_ || !doc_.assemblage) return;
  if (const J* o = asmSel_.empty() ? nullptr : as::occurrence(*doc_.assemblage, asmSel_); o && o->contains("pat") && (*o)["pat"].is_object()) {
    const J* ow = as::porteur(*doc_.assemblage, asmSel_) ;
    if (ow) asmPatDebut(texteDe(*ow, "id"), texteDe((*o)["pat"], "id"), std::make_shared<J>(*doc_.assemblage));
    return;
  }
  std::vector<std::string> ids;
  const J& a = *doc_.assemblage;
  for (const std::string& id : asmLot()) {
    const J* o = as::occurrence(a, id);
    if (o && !(o->contains("pat") && (*o)["pat"].is_object())) ids.push_back(id);
  }
  if (ids.empty()) return etat(L"Répétition : cliquez d'abord l'occurrence à répéter (Ctrl+clic pour un lot), puis « Répétition ».");
  // Le pas proposé : la taille de la première source le long de X, sinon 50 mm
  double pas = 50;
  if (const J* s = as::occurrence(a, ids[0])) {
    const auto it = asmSolides_.find(texteDe(*s, "comp"));
    if (it != asmSolides_.end() && !it->second->forme.IsNull()) {
      const Mesures m = mesurer(it->second->forme);
      pas = std::max(5.0, std::ceil(1.2 * (m.boite[3] - m.boite[0])));
    }
  }
  auto avant = std::make_shared<J>(a);
  auto copie = std::make_shared<J>(a);
  const std::string owner = as::actif(a);
  const J p = as::nouvelleRepetition(*as::composant(*copie, owner), ids, pas);
  doc_.assemblage = copie;
  asmPatDebut(owner, texteDe(p, "id"), avant);
  etat(wxString::Format(L"Répétition de %zu occurrence(s) : type, direction, quantité et pas dans le panneau (aperçu en direct) · ✓ OK pour garder · Échap pour annuler.", ids.size()));
}

void Cadre::asmPatDebut(const std::string& owner, const std::string& pat, std::shared_ptr<J> avant) {
  asmPatEd_ = std::make_unique<PatEnCours>();
  asmPatEd_->owner = owner;
  asmPatEd_->pat = pat;
  asmPatEd_->avant = std::move(avant);
  asmPatRafraichir();
}

void Cadre::asmPatRafraichir() {
  if (!doc_.assemblage) return;
  auto copie = std::make_shared<J>(*doc_.assemblage);
  as::resoudre(*copie, asmSolides_);
  doc_.assemblage = copie;
  asmDessiner();
  remplirArbre();
  montrerAssemblage();
}

void Cadre::asmPatValider() {
  if (!asmPatEd_) return;
  auto avant = asmPatEd_->avant;
  asmPatEd_.reset();
  const J fin = *doc_.assemblage;
  doc_.assemblage = avant;
  changerAssemblage([&](J& a) { a = fin; });
}

void Cadre::asmPatAnnuler(bool dessiner) {
  if (!asmPatEd_) return;
  doc_.assemblage = asmPatEd_->avant;
  asmPatEd_.reset();
  if (dessiner) {
    asmDessiner();
    remplirArbre();
    montrerRien();
    etat(L"Répétition annulée.");
  }
}

void Cadre::asmPatSupprimer(const std::string& owner, const std::string& pat) {
  J* c = doc_.assemblage ? as::composant(*doc_.assemblage, owner) : nullptr;
  if (!c) return;
  wxString nom;
  int n = 0;
  if (c->contains("pats"))
    for (const J& p : (*c)["pats"])
      if (texteDe(p, "id") == pat) nom = tx(texteDe(p, "name"));
  for (const J& o : (*c)["occ"]) n += o.contains("pat") && (*o.find("pat")).is_object() && texteDe(o["pat"], "id") == pat ? 1 : 0;
  if (!confirmerSuppression(L"Supprimer « " + nom + wxString::Format(L" » ? Ses %d instance(s) partent, les sources restent (Ctrl+Z pour annuler).", n))) return;
  if (asmPatEd_ && asmPatEd_->pat == pat) asmPatAnnuler(false);
  changerAssemblage([&](J& a) {
    J* k = as::composant(a, owner);
    if (!k || !k->contains("pats")) return;
    J reste = J::array();
    for (J& p : (*k)["pats"])
      if (texteDe(p, "id") != pat) reste.push_back(std::move(p));
    if (reste.empty()) k->erase("pats");
    else (*k)["pats"] = std::move(reste);
  });
}

void Cadre::asmPanneauRepetition(std::vector<ChampFiche>& ch, std::vector<std::pair<wxString, std::function<void()>>>& B) {
  J* pp = asmPatCourant();
  if (!pp) {
    asmPatEd_.reset();
    return;
  }
  const J& p = *pp;
  const J* owner = as::composant(*doc_.assemblage, asmPatEd_->owner);
  const std::string cat = "🔁 " + texteDe(p, "name") + " · " + as::nomRepetition(p);
  const auto lecture = [&](const std::string& t, const std::string& v) {
    ChampFiche c;
    c.categorie = cat;
    c.cle = "l/" + t;
    c.titre = t;
    c.texte = v;
    ch.push_back(std::move(c));
  };
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
  const auto oui = [&](const std::string& cle, const std::string& titre, bool v) {
    ChampFiche c;
    c.sorte = ChampFiche::BOOLEEN;
    c.categorie = cat;
    c.cle = cle;
    c.titre = titre;
    c.oui = v;
    ch.push_back(std::move(c));
  };
  std::string sources;
  for (const J& id : p["src"])
    if (const J* o = as::occurrence(*doc_.assemblage, id.get<std::string>())) sources += (sources.empty() ? "" : ", ") + texteDe(*o, "name");
  int n = 0;
  for (const J& o : (*owner)["occ"]) n += o.contains("pat") && o["pat"].is_object() && texteDe(o["pat"], "id") == asmPatEd_->pat ? 1 : 0;
  const std::string type = texteDe(p, "type");
  lecture("Sources", sources + " · " + std::to_string(n) + " instance(s)" + (type == "mir" ? " (en miroir)" : ""));
  if (texteDe(p, "st") == "warn") lecture("⚠", texteDe(p, "msg"));
  ChampFiche nomC;
  nomC.categorie = cat;
  nomC.cle = "pat/name";
  nomC.titre = "Nom";
  nomC.texte = texteDe(p, "name");
  nomC.libre = true;
  ch.push_back(std::move(nomC));
  std::vector<std::pair<std::string, std::string>> types{{"lin", "Linéaire"}, {"circ", "Circulaire"}, {"mir", "Symétrie"}};
  types.push_back({"path", "Suivant un profil"});
  liste("pat/type", "Type", type, types);
  const std::vector<std::pair<std::string, std::string>> AX{{"X", "X"}, {"Y", "Y"}, {"Z", "Z"}}, PL{{"X", "YZ (normale X)"}, {"Y", "XZ (normale Y)"}, {"Z", "XY (normale Z)"}};
  const double copies = p.value("copies", 1.0);
  if (type != "path") {
    std::vector<std::pair<std::string, std::string>> fr{{"", "Origine de « " + texteDe(*owner, "name") + " »"}};
    const auto it = asmSolides_.find(asmPatEd_->owner);
    if (it != asmSolides_.end())
      for (const ElementConstruction& e : it->second->construction)
        if (e.kind == "frame") fr.push_back({e.id, e.nom});
    liste("pat/ref", "Référence", p.contains("ref") && p["ref"].is_object() ? texteDe(p["ref"], "cg") : std::string(), fr);
  }
  if (type == "lin") {
    liste("pat/axis", "Direction", texteDe(p, "axis"), AX);
    nombre("pat/n", "Quantité totale", copies + 1);
    nombre("pat/dist", "Pas (mm, négatif = sens inverse)", p.value("dist", 0.0));
    oui("pat/lin2", "2ᵉ direction", p.value("lin2", false));
    if (p.value("lin2", false)) {
      liste("pat/axis2", "Direction 2", texteDe(p, "axis2"), AX);
      nombre("pat/n2", "Quantité 2", p.value("copies2", 1.0) + 1);
      nombre("pat/dist2", "Pas 2 (mm)", p.value("dist2", 0.0));
    }
  } else if (type == "circ") {
    liste("pat/axis", "Axe", texteDe(p, "axis"), AX);
    nombre("pat/n", "Quantité totale", copies + 1);
    nombre("pat/angle", "Angle total (°, 360 = tour complet)", p.value("angle", 360.0));
  } else if (type == "mir") {
    liste("pat/axis", "Plan", texteDe(p, "axis"), PL);
    const bool dbl = p.contains("plane2") && p["plane2"].is_string();
    oui("pat/double", "Symétrie double", dbl);
    if (dbl) liste("pat/plane2", "Plan 2", texteDe(p, "plane2"), PL);
  } else if (type == "path") {
    nombre("pat/n", "Quantité totale", copies + 1);
    const J dj = docPorteurPat(doc_, owner);
    const std::vector<const J*> G = pgEsquissesGuides(dj);
    if (G.empty()) {
      lecture("Courbe guide", "Aucune esquisse de ce composant ne contient de ligne, d'arc ou de spline.");
    } else {
      const J path = p.contains("path") && p["path"].is_object() ? p["path"] : J::object();
      const std::string skId = texteDe(path, "sk");
      const J* sk = nullptr;
      std::vector<std::pair<std::string, std::string>> L{{"", "— choisir —"}};
      for (const J* s : G) {
        L.push_back({texteDe(*s, "id"), texteDe(*s, "name").empty() ? texteDe(*s, "id") : texteDe(*s, "name")});
        if (texteDe(*s, "id") == skId) sk = s;
      }
      liste("pat/pgsk", "Courbe guide", sk ? skId : std::string(), L);
      if (sk) {
        const std::vector<ChoixDepart> dep = pgChoixDepart(*sk);
        std::vector<std::pair<std::string, std::string>> D;
        std::string cour = "-1";
        for (size_t i = 0; i < dep.size(); i++) {
          D.push_back({std::to_string(i), dep[i].label});
          if (pgMemeDepart(dep[i].v, path)) cour = std::to_string(i);
        }
        if (cour == "-1") D.push_back({"-1", "(départ actuel)"});
        liste("pat/pgdep", "Départ", cour, D);
      }
      const bool pitch = texteDe(p, "pspace") == "pitch";
      liste("pat/pgsp", "Espacement", pitch ? "pitch" : "fit", {{"fit", "Réparti sur la longueur"}, {"pitch", "Pas imposé"}});
      if (pitch) nombre("pat/dist", "Pas le long de la courbe (mm)", p.value("dist", 0.0));
      liste("pat/pgor", "Orientation", texteDe(p, "orient") == "tangent" ? "tangent" : "fixed", {{"fixed", "Fixe (translation)"}, {"tangent", "Suit la tangente"}});
      oui("pat/pgrev", "Sens inversé", p.value("rev", false));
      if (sk) lecture("Courbe", pgNote(pgPlan(*sk, p, std::max(1, static_cast<int>(copies)) + 1)));
    }
  }
  if (p.contains("skip") && p["skip"].is_array() && !p["skip"].empty()) {
    const size_t k = p["skip"].size();
    B.push_back({wxString::Format(L"↺ Rétablir %zu instance(s) supprimée(s)", k), [this] {
                   if (J* q = asmPatCourant()) (*q)["skip"] = J::array();
                   asmPatRafraichir();
                 }});
  }
  B.push_back({L"✓ OK", [this] { asmPatValider(); }});
  B.push_back({L"Annuler", [this] { asmPatAnnuler(true); }});
  const std::string ow = asmPatEd_->owner, id = asmPatEd_->pat;
  B.push_back({L"🗑 Supprimer", [this, ow, id] { asmPatSupprimer(ow, id); }});
}

bool Cadre::asmPatFiche(const std::string& cle, const std::string& valeur) {
  if (cle.rfind("pat/", 0) != 0) return false;
  J* q = asmPatCourant();
  if (!q) return true;
  double v = 0;
  std::string s = valeur;
  for (char& c : s)
    if (c == ',') c = '.';
  char* fin = nullptr;
  v = strtod(s.c_str(), &fin);
  const bool lu = fin != s.c_str();
  const auto compte = [](double x) { return std::max(1.0, std::min(500.0, std::floor(x) - 1)); };
  const std::string k = cle.substr(4);
  if (k == "name") {
    if (!valeur.empty()) (*q)["name"] = valeur;
  } else if (k == "type") {
    if (texteDe(*q, "type") != valeur) {
      (*q)["type"] = valeur;
      if (valeur == "circ") {
        (*q)["axis"] = "Z";
        if (q->value("copies", 1.0) < 2) (*q)["copies"] = 5;
      } else if (valeur == "mir") (*q)["copies"] = 1;
      else if (valeur == "lin" && q->value("copies", 1.0) < 2) (*q)["copies"] = 2;
      else if (valeur == "path" && !q->contains("path")) {  // asmPatPathInit
        const J dj = docPorteurPat(doc_, as::composant(*doc_.assemblage, asmPatEd_->owner));
        const std::vector<const J*> G = pgEsquissesGuides(dj);
        if (!G.empty()) (*q)["path"] = pgDepartDefaut(*G.back());
        if (!q->contains("pspace")) (*q)["pspace"] = "fit";
        if (!q->contains("orient")) (*q)["orient"] = "fixed";
      }
    }
  } else if (k == "pgsk" || k == "pgdep") {
    const J dj = docPorteurPat(doc_, as::composant(*doc_.assemblage, asmPatEd_->owner));
    const std::string vise = k == "pgsk" ? valeur : (q->contains("path") && q->at("path").is_object() ? texteDe((*q)["path"], "sk") : std::string());
    for (const J* s : pgEsquissesGuides(dj)) {
      if (texteDe(*s, "id") != vise) continue;
      if (k == "pgsk") {
        (*q)["path"] = pgDepartDefaut(*s);
      } else {
        const std::vector<ChoixDepart> dep = pgChoixDepart(*s);
        const int i = std::atoi(valeur.c_str());
        if (i >= 0 && i < static_cast<int>(dep.size())) {
          J n = J::object();
          n["sk"] = vise;
          for (auto it = dep[i].v.begin(); it != dep[i].v.end(); ++it) n[it.key()] = *it;
          (*q)["path"] = std::move(n);
        }
      }
    }
  } else if (k == "pgsp") {
    (*q)["pspace"] = valeur;
    if (valeur == "pitch" && !(q->value("dist", 0.0) > 0)) (*q)["dist"] = 10;
  } else if (k == "pgor") {
    (*q)["orient"] = valeur;
  } else if (k == "pgrev") {
    if (valeur == "1") (*q)["rev"] = true;
    else q->erase("rev");
  } else if (k == "ref") {
    J r = J::object();
    r["cg"] = valeur.empty() ? J() : J(valeur);
    (*q)["ref"] = std::move(r);
  } else if (k == "axis" || k == "axis2" || k == "plane2") (*q)[k] = valeur;
  else if (k == "n" && lu) (*q)["copies"] = compte(v);
  else if (k == "n2" && lu) (*q)["copies2"] = compte(v);
  else if (k == "dist" && lu) (*q)["dist"] = v;
  else if (k == "dist2" && lu) (*q)["dist2"] = v;
  else if (k == "angle" && lu) (*q)["angle"] = v != 0 ? v : 360;
  else if (k == "lin2") {
    if (valeur == "1") {
      (*q)["lin2"] = true;
      if (!q->contains("axis2")) (*q)["axis2"] = texteDe(*q, "axis") == "X" ? "Y" : "X";
      if (!q->contains("copies2")) (*q)["copies2"] = 1;
      if (!q->contains("dist2")) (*q)["dist2"] = (*q)["dist"];
    } else q->erase("lin2");
  } else if (k == "double") {
    if (valeur == "1") (*q)["plane2"] = texteDe(*q, "axis") == "X" ? "Y" : "X";
    else q->erase("plane2");
  }
  asmPatRafraichir();
  return true;
}

// ---- Depuis un corps, vers un composant (asmCmdFromBodies, asmCmdMoveTo) ----
void Cadre::asmDepuisCorps(std::vector<std::string> ids) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  if (asmMode_ == "asm") return etat(L"Composants depuis les corps : modélisez d'abord le composant qui porte les corps.");
  if (ids.empty()) {
    for (const std::string& b : doc_.corps) {
      bool utile = false;
      for (const Fonction& f : doc_.fonctions) utile = utile || f.corps == b;
      if (utile) ids.push_back(b);
    }
    if (ids.empty()) return etat(L"Aucun corps avec des fonctions à transformer en composant.");
    if (!confirmerSuppression(wxString::Format(L"Créer un composant pour chacun des %zu corps ?", ids.size()))) return;
  }
  faireSuivre();
  size_t faits = 0;
  wxString noms, refus;
  changerStructure([&](J& d) {
    if (doc_.assemblage) d["asm"] = *doc_.assemblage;
    else as::assurer(d);
    J& a = d["asm"];
    const auto nomCorps = [&](const std::string& b) {
      if (d.contains("bodies"))
        for (const J& e : d["bodies"])
          if (texteDe(e, "id") == b) return texteDe(e, "name");
      return b;
    };
    for (const std::string& b : ids) {
      const as::PlanSeparation p = as::planSeparation(d, {b}, {});
      const std::string nom = nomCorps(b);
      if (!p.ok) {
        refus += L"• " + tx(nom) + L" : ";
        for (size_t i = 0; i < p.pourquoi.size() && i < 3; i++) refus += (i ? L" ; " : L"") + tx(p.pourquoi[i]);
        refus += L"\n";
        continue;
      }
      J c = J::object();
      const std::string cid = as::nouvelIdentifiant("cp");
      c["id"] = cid;
      c["kind"] = "comp";
      c["name"] = nom;
      c["doc"] = as::documentVide(nom);
      c["occ"] = J::array();
      c["link"] = nullptr;
      as::appliquerSeparation(d, c["doc"], p);
      a["comps"].push_back(std::move(c));
      (*as::composant(a, as::actif(a)))["occ"].push_back(as::nouvelleOccurrenceObjet(cid, nom + ":1", as::Repere()));
      noms += (faits++ ? L", " : L"") + tx(nom);
    }
  });
  if (!refus.empty() && !essaiMenu_) wxMessageBox(L"Non converti(s) :\n" + refus, L"Composants depuis les corps", wxOK | wxICON_WARNING, this);
  if (faits) etat(wxString::Format(L"%zu composant(s) créé(s) depuis les corps (", faits) + noms + L"), à la même place. Double-clic pour les modéliser, « Assembler » pour les déplacer.");
  else if (!refus.empty()) etat(L"Non converti : " + refus);
}

void Cadre::asmDeplacerVers(bool corps, const std::string& id) {
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  if (asmMode_ == "asm") return;
  // asmMoveTargets : tous les composants sauf l'actif, nommés par leur chemin
  struct Cible {
    std::string id;
    wxString nom;
  };
  std::vector<Cible> L;
  if (doc_.assemblage) {
    const J& a = *doc_.assemblage;
    std::set<std::string> vus{as::actif(a)};
    for (const as::Instance& inst : as::instances(a, as::racine(a))) {
      if (!vus.insert(inst.comp).second) continue;
      wxString nom;
      const J* c = as::composant(a, as::racine(a));
      for (const std::string& o : inst.chemin) {
        const J* q = as::occurrence(a, o);
        nom += (nom.empty() ? L"" : L" › ") + (q ? tx(texteDe(*q, "name")) : wxString());
        c = q ? as::composant(a, texteDe(*q, "comp")) : nullptr;
      }
      if (inst.chemin.empty() && c) nom = L"« " + tx(texteDe(*c, "name")) + L" » (racine)";
      L.push_back({inst.comp, nom});
    }
  }
  wxMenu m;
  for (size_t i = 0; i < L.size(); i++) m.Append(wxID_HIGHEST + 7400 + static_cast<int>(i), L"🧩 " + L[i].nom);
  m.Append(wxID_HIGHEST + 7399, L"➕ Nouveau composant");
  const int ch = choisirMenu(m);
  if (ch == wxID_NONE || ch == 0) return;
  if (ch == wxID_HIGHEST + 7399 && corps) return asmDepuisCorps({id});
  std::string cible;
  if (ch != wxID_HIGHEST + 7399) {
    const int k = ch - wxID_HIGHEST - 7400;
    if (k < 0 || k >= static_cast<int>(L.size())) return;
    cible = L[k].id;
    // asmRelToComp : la géométrie garde ses coordonnées
    const J& a = *doc_.assemblage;
    as::Repere W, T;
    as::monde(a, as::cheminActif(a), W);
    const as::Chemin tp = as::premierChemin(a, cible);
    if (as::monde(a, tp, T)) {
      const as::Repere R = as::composer(as::inverser(T), W);
      const as::Repere I;
      bool identite = true;
      for (int q = 0; q < 3; q++)
        if (std::abs(R.o[q]) > 1e-7 || std::abs(R.x[q] - I.x[q]) > 1e-7 || std::abs(R.y[q] - I.y[q]) > 1e-7 || std::abs(R.z[q] - I.z[q]) > 1e-7) identite = false;
      const J* c = as::composant(a, cible);
      if (!identite && !confirmerSuppression(L"« " + (c ? tx(texteDe(*c, "name")) : wxString()) + L" » n'est pas placé comme ce composant : la géométrie gardera ses coordonnées, donc se retrouvera décalée dans l'assemblage.\nContinuer ?")) return;
    }
  }
  faireSuivre();
  wxString refus, nomCible;
  std::string nomEsq;
  for (const Esquisse& e : doc_.esquisses)
    if (e.id == id) nomEsq = e.nom;
  changerStructure([&](J& d) {
    if (doc_.assemblage) d["asm"] = *doc_.assemblage;
    else as::assurer(d);
    J& a = d["asm"];
    const as::PlanSeparation p = corps ? as::planSeparation(d, {id}, {}) : as::planSeparation(d, {}, {id});
    if (!p.ok) {
      for (size_t i = 0; i < p.pourquoi.size() && i < 5; i++) refus += L"\n• " + tx(p.pourquoi[i]);
      return;
    }
    J* T = cible.empty() ? nullptr : as::composant(a, cible);
    if (!T) {
      const std::string nom = nomEsq.empty() ? "Composant" : nomEsq;
      J c = J::object();
      const std::string cid = as::nouvelIdentifiant("cp");
      c["id"] = cid;
      c["kind"] = "comp";
      c["name"] = nom;
      c["doc"] = as::documentVide(nom);
      c["occ"] = J::array();
      c["link"] = nullptr;
      a["comps"].push_back(std::move(c));
      (*as::composant(a, as::actif(a)))["occ"].push_back(as::nouvelleOccurrenceObjet(cid, nom + ":1", as::Repere()));
      T = as::composant(a, cid);
    }
    nomCible = tx(texteDe(*T, "name"));
    as::appliquerSeparation(d, (*T)["doc"], p);
  });
  if (!refus.empty()) {
    if (!essaiMenu_) wxMessageBox(L"Déplacement impossible :" + refus, L"Déplacer vers un composant", wxOK | wxICON_WARNING, this);
    etat(L"Déplacement impossible :" + refus);
  } else etat((corps ? L"Corps déplacé vers « " : L"Esquisse déplacée vers « ") + nomCible + L" ». Ctrl+Z pour annuler.");
}

// ---- L'inspection (48-composants-inspection) ----
// Les corps d'un composant, sans ceux qu'il masque
std::vector<Cadre::CorpsExact> Cadre::asmCorpsExacts(const std::string& cid) const {
  std::vector<CorpsExact> r;
  const auto it = asmSolides_.find(cid);
  if (!doc_.assemblage || it == asmSolides_.end()) return r;
  const bool estActif = cid == as::actif(*doc_.assemblage);
  const J* c = as::composant(*doc_.assemblage, cid);
  const J* d = c && c->contains("doc") && (*c)["doc"].is_object() ? &(*c)["doc"] : nullptr;
  for (const auto& [id, forme] : it->second->corps) {
    if (forme.IsNull()) continue;
    std::string nom = id;
    bool visible = true;
    if (estActif) {
      visible = std::find(doc_.corpsMasques.begin(), doc_.corpsMasques.end(), id) == doc_.corpsMasques.end();
      const size_t i = std::find(doc_.corps.begin(), doc_.corps.end(), id) - doc_.corps.begin();
      if (i < doc_.nomsCorps.size() && !doc_.nomsCorps[i].empty()) nom = doc_.nomsCorps[i];
    } else if (d) {
      if (d->contains("bodyVis") && (*d)["bodyVis"].is_object() && (*d)["bodyVis"].contains(id) && (*d)["bodyVis"][id].is_boolean()) visible = (*d)["bodyVis"][id].get<bool>();
      if (d->contains("bodies") && (*d)["bodies"].is_array())
        for (const J& b : (*d)["bodies"])
          if (texteDe(b, "id") == id && !texteDe(b, "name").empty()) nom = texteDe(b, "name");
    }
    if (visible) r.push_back({id, nom, forme});
  }
  return r;
}

// asmVisibleInstances : sous le composant actif (lui compris), sans celles masquées à un niveau quelconque du chemin
std::vector<as::Instance> Cadre::asmInstancesVisibles() const {
  std::vector<as::Instance> r;
  if (!doc_.assemblage) return r;
  const J& a = *doc_.assemblage;
  const std::string base = as::actif(a);
  for (const as::Instance& I : as::instances(a, base)) {
    bool masquee = false;
    for (const std::string& id : I.chemin) {
      const J* o = as::occurrence(a, id);
      if (!o || (o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>())) masquee = true;
    }
    if (!masquee) r.push_back(I);
  }
  return r;
}

namespace {
TopoDS_Shape place(const TopoDS_Shape& s, const as::Repere& F) { return BRepBuilderAPI_Transform(s, trsfDe(F), true).Shape(); }
}  // namespace

// asmStepShapes
std::vector<TopoDS_Shape> Cadre::asmFormesStep(std::string& nom, std::vector<std::string>& manquants) const {
  std::vector<TopoDS_Shape> r;
  if (!doc_.assemblage) return r;
  const J& a = *doc_.assemblage;
  const std::string base = as::actif(a);
  if (const J* c = as::composant(a, base)) nom = texteDe(*c, "name");
  std::set<std::string> vus;
  for (const as::Instance& I : asmInstancesVisibles()) {
    const std::vector<CorpsExact> L = asmCorpsExacts(I.comp);
    if (L.empty() && !vus.count(I.comp)) {
      const J* c = as::composant(a, I.comp);
      bool aDesFonctions = false;
      if (I.comp == base) aDesFonctions = !doc_.fonctions.empty();
      else if (c && c->contains("doc") && (*c)["doc"].is_object() && (*c)["doc"].contains("features") && (*c)["doc"]["features"].is_array())
        for (const J& f : (*c)["doc"]["features"])
          if (f.is_object() && !(f.contains("visible") && f["visible"].is_boolean() && !f["visible"].get<bool>())) aDesFonctions = true;
      if (aDesFonctions && c) manquants.push_back(texteDe(*c, "name"));
    }
    vus.insert(I.comp);
    for (const CorpsExact& b : L) r.push_back(place(b.forme, I.F));
  }
  return r;
}

// asmCmdInspect, asmInspectRun
void Cadre::asmInspecter() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  if (!doc_.assemblage) {
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
    solideCalculable_ = doc_.nonPrisEnCharge.empty();
    recalculer();
  }
  wxBusyCursor attente;
  etat(L"Inspection : formes exactes, masses, interférences…");
  const J& a = *doc_.assemblage;
  const std::string base = as::actif(a);
  auto R = std::make_unique<Inspection>();
  struct Place {
    TopoDS_Shape s;
    Bnd_Box b;
  };
  std::vector<Place> P;
  const auto nomChemin = [&](const as::Chemin& ch) {
    std::string n;
    for (const std::string& id : ch)
      if (const J* o = as::occurrence(a, id)) n += (n.empty() ? "" : " › ") + texteDe(*o, "name");
    return n;
  };
  for (const as::Instance& I : asmInstancesVisibles()) {
    std::string mat = "Acier";
    double rho = 7.85;
    if (I.comp == base) {
      if (doc_.densite > 0) {
        mat = doc_.matiere;
        rho = doc_.densite;
      }
    } else if (const J* c = as::composant(a, I.comp); c && c->contains("doc") && (*c)["doc"].is_object() && (*c)["doc"].contains("mat") && (*c)["doc"]["mat"].is_object()) {
      const J& m = (*c)["doc"]["mat"];
      if (m.contains("rho") && m["rho"].is_number() && m["rho"].get<double>() > 0) {
        mat = texteDe(m, "name");
        rho = m["rho"].get<double>();
      }
    }
    for (const CorpsExact& b : asmCorpsExacts(I.comp)) {
      Place q;
      q.s = place(b.forme, I.F);
      BRepBndLib::Add(q.s, q.b);
      GProp_GProps G;
      BRepGProp::VolumeProperties(q.s, G, false, false, false);
      Inspection::Item x;
      x.comp = I.comp;
      const std::string ch = nomChemin(I.chemin);
      x.nom = (ch.empty() ? "" : ch + " › ") + b.nom;
      x.matiere = mat;
      x.rho = rho;
      x.v = G.Mass();
      x.masse = x.v * rho / 1000;
      const gp_Pnt c = G.CentreOfMass();
      x.c = {c.X(), c.Y(), c.Z()};
      R->items.push_back(std::move(x));
      P.push_back(std::move(q));
    }
  }
  for (const Inspection::Item& x : R->items) {
    R->volume += x.v;
    R->masse += x.masse;
    for (int i = 0; i < 3; i++) R->com[i] += x.masse * x.c[i];
  }
  for (int i = 0; i < 3; i++) R->com[i] = R->masse > 0 ? R->com[i] / R->masse : 0;
  for (size_t i = 0; i < P.size(); i++)
    for (size_t j = i + 1; j < P.size(); j++) {
      if (P[i].b.IsOut(P[j].b)) continue;
      try {
        BRepAlgoAPI_Common c(P[i].s, P[j].s);
        if (!c.IsDone()) continue;
        GProp_GProps G;
        BRepGProp::VolumeProperties(c.Shape(), G, false, false, false);
        if (G.Mass() > 1e-3) R->inter.push_back({R->items[i].nom, R->items[j].nom, G.Mass(), c.Shape()});
      } catch (const Standard_Failure&) {
      }
    }
  asmInspect_ = std::move(R);
  std::vector<TopoDS_Shape> rouges;
  for (const Inspection::Inter& x : asmInspect_->inter) rouges.push_back(x.forme);
  vue_->montrerInspection(rouges, asmInspect_->masse > 0, gp_Pnt(asmInspect_->com[0], asmInspect_->com[1], asmInspect_->com[2]));
  montrerRien();
  ajusterDroite();
  etat(L"Inspection : " + wxString::Format("%d", static_cast<int>(asmInspect_->items.size())) + L" corps, " + tx(fmt(asmInspect_->masse / 1000, 3)) + L" kg, " + (asmInspect_->inter.empty() ? wxString(L"aucune interférence") : wxString::Format(L"%d interférence(s) (en rouge)", static_cast<int>(asmInspect_->inter.size()))) + L".");
}

void Cadre::asmInspectFermer() {
  if (!asmInspect_) return;
  asmInspect_.reset();
  vue_->montrerInspection({}, false, gp_Pnt());
}

void Cadre::asmPanneauInspection(std::vector<ChampFiche>& ch, std::vector<std::pair<wxString, std::function<void()>>>& B) {
  const Inspection& R = *asmInspect_;
  int k = 0;
  const auto ligne = [&](const std::string& cat, const std::string& titre, const std::string& texte) {
    ChampFiche c;
    c.categorie = cat;
    c.titre = titre;
    c.texte = texte;
    c.cle = "l/" + std::to_string(k++);
    ch.push_back(std::move(c));
  };
  const std::string phys = "⚖ Propriétés physiques";
  for (const Inspection::Item& x : R.items) ligne(phys, x.nom, fmt(x.v / 1000) + " cm³ · " + fmt(x.masse, 1) + " g");
  ligne(phys, "Total", fmt(R.volume / 1000) + " cm³ · " + fmt(R.masse / 1000, 3) + " kg");
  ligne(phys, "Centre de gravité", "(" + fmt(R.com[0]) + " ; " + fmt(R.com[1]) + " ; " + fmt(R.com[2]) + ") mm");
  std::set<std::string> vus;
  for (const Inspection::Item& x : R.items) {
    if (!vus.insert(x.comp).second) continue;
    const J* c = as::composant(*doc_.assemblage, x.comp);
    ChampFiche f;
    f.sorte = ChampFiche::CHOIX;
    f.categorie = "Matière";
    f.cle = "mat/" + x.comp;
    f.titre = c ? texteDe(*c, "name") : x.comp;
    f.texte = x.matiere;
    for (const auto& [nom, rho] : MATIERES) f.choix.push_back({nom, nom + " (" + fmt(rho) + " g/cm³)"});
    if (std::none_of(MATIERES.begin(), MATIERES.end(), [&](const auto& m) { return m.first == x.matiere; })) f.choix.push_back({x.matiere, x.matiere + " (" + fmt(x.rho) + " g/cm³)"});
    ch.push_back(std::move(f));
  }
  const std::string it = "⚠ Interférences (" + std::to_string(R.inter.size()) + ")";
  if (R.inter.empty()) ligne(it, "Aucune", "aucun volume commun entre deux corps");
  for (const Inspection::Inter& x : R.inter) {
    ligne(it, x.a, "∩ " + x.b);
    ligne(it, "   volume commun", fmt(x.v) + " mm³");
  }
  B.push_back({L"↻ Relancer", [this] { asmInspecter(); }});
  B.push_back({L"Fermer", [this] { asmInspectFermer(); montrerRien(); ajusterDroite(); }});
}

// asmSetOccRendu, asmClearOccRendu : o.rendu = {corps:{[id du corps]:{mat, col}}}
void Cadre::changerRenduOccurrence(const std::string occ, const std::string bid, const plan::J* e, bool tous) {
  const plan::J copie = e ? *e : plan::J();
  const bool efface = !e;
  changerAssemblage([&](nlohmann::ordered_json& a) {
    const plan::J* o = as::occurrence(a, occ);
    if (!o) return;
    const std::string comp = o->value("comp", std::string());
    for (plan::J& k : a["comps"]) {
      if (!k.contains("occ")) continue;
      for (plan::J& q : k["occ"]) {
        if (!(tous ? q.value("comp", std::string()) == comp : q.value("id", std::string()) == occ)) continue;
        if (efface) {
          if (!q.contains("rendu") || !q["rendu"].contains("corps")) continue;
          q["rendu"]["corps"].erase(bid);
          if (q["rendu"]["corps"].empty()) q.erase("rendu");
        } else q["rendu"]["corps"][bid] = copie;
      }
    }
  });
  if (atelier_ == Atelier::RENDU) montrerRendu(false);
  else majVueEnv();
}

// Ce que l'atelier Rendu photographie : les corps visibles avec leur apparence (renderLookOf), puis les autres composants placés
std::vector<PieceRendu> Cadre::renduPieces(const plan::J& racine) {
  static const unsigned PALETTE[] = {0x0a84ff, 0x30d158, 0xff9f0a, 0xbf5af2, 0xff453a, 0x64d2ff, 0xffd60a, 0x5e5ce6};
  const plan::J& d = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
  std::vector<PieceRendu> L;
  for (const auto& [id, forme] : dernierRejeu_.corpsVus) {
    if (std::find(doc_.corpsMasques.begin(), doc_.corpsMasques.end(), id) != doc_.corpsMasques.end()) continue;
    const size_t i = std::find(doc_.corps.begin(), doc_.corps.end(), id) - doc_.corps.begin();
    unsigned c = i < doc_.couleursCorps.size() ? doc_.couleursCorps[i] : 0;
    if (!c) c = doc_.teinte;
    if (!c) c = PALETTE[(i < doc_.corps.size() ? i : 0) % 8];
    PieceRendu p;
    p.forme = forme;
    p.id = id;
    p.nom = i < doc_.nomsCorps.size() && !doc_.nomsCorps[i].empty() ? doc_.nomsCorps[i] : id;
    p.couleur = p.couleurCao = c;
    if (d.contains("bodies") && d["bodies"].is_array())
      for (const auto& b : d["bodies"])
        if (b.is_object() && b.value("id", std::string()) == id && b.contains("mat") && b["mat"].is_string()) p.cle = b["mat"].get<std::string>();
    if (d.contains("rendu") && d["rendu"].contains("corps") && d["rendu"]["corps"].contains(id)) {
      const plan::J& r = d["rendu"]["corps"][id];
      p.propre = true;
      if (r.contains("mat") && r["mat"].is_string()) p.cle = r["mat"].get<std::string>();
      if (r.contains("col") && r["col"].is_number()) p.couleur = r["col"].get<unsigned>();
      p.rel = reliefDeJson(r);
    }
    if (!matiereRendu(p.cle)) p.cle.clear();
    L.push_back(p);
  }
  if (doc_.assemblage) {
    const J& a = *doc_.assemblage;
    const as::Chemin P = as::cheminActif(a);
    as::Repere W;
    as::monde(a, P, W);
    const as::Repere V = as::inverser(W);
    for (const as::Instance& inst : as::instances(a, as::racine(a))) {
      const auto it = asmSolides_.find(inst.comp);
      if (it == asmSolides_.end() || it->second->forme.IsNull() || as::cheminMasque(a, inst.chemin)) continue;
      if (estPrefixe(P, inst.chemin) && inst.chemin.size() == P.size()) continue;  // le composant actif est déjà là
      const as::SolideComposant& S = *it->second;
      const TopLoc_Location loc(trsfDe(as::composer(V, inst.F)));
      for (const auto& c : S.corps) {
        PieceRendu q;
        q.forme = c.second.Moved(loc);
        q.nom = S.nom.empty() ? inst.comp : S.nom;
        unsigned u = 0x9a9aa0;
        for (const auto& t : S.teintes)
          if (t.first.IsSame(c.second)) u = t.second;
        q.couleur = q.couleurCao = u;
        q.bid = c.first;
        q.occ = inst.chemin.empty() ? std::string() : inst.chemin.back();
        const auto lireLook = [&q](const J& r) {
          if (r.contains("mat") && r["mat"].is_string()) q.cle = r["mat"].get<std::string>();
          if (r.contains("col") && r["col"].is_number()) q.couleur = r["col"].get<unsigned>();
          q.rel = reliefDeJson(r);
        };
        // La CAO du composant, puis l'apparence de rendu de sa pièce (doc.rendu), puis l'occurrence la plus profonde qui en a une (asmOccRenduOf)
        if (const J* cc = as::composant(a, inst.comp); cc && cc->contains("doc") && (*cc)["doc"].is_object()) {
          const J& dd = (*cc)["doc"];
          if (dd.contains("bodies") && dd["bodies"].is_array())
            for (const J& b : dd["bodies"])
              if (b.is_object() && b.value("id", std::string()) == c.first && b.contains("mat") && b["mat"].is_string()) q.cle = b["mat"].get<std::string>();
          if (dd.contains("rendu") && dd["rendu"].is_object() && dd["rendu"].contains("corps") && dd["rendu"]["corps"].contains(c.first)) lireLook(dd["rendu"]["corps"][c.first]);
        }
        const J* fin = nullptr;
        as::Chemin bout;
        for (const std::string& oid : inst.chemin) {
          bout.push_back(oid);
          const J* oc = as::occurrence(a, oid);
          if (oc && oc->contains("rendu") && (*oc)["rendu"].is_object() && (*oc)["rendu"].contains("corps") && (*oc)["rendu"]["corps"].contains(c.first)) {
            fin = &(*oc)["rendu"]["corps"][c.first];
            q.propre = oid == q.occ;
          }
        }
        if (fin) lireLook(*fin);
        if (!matiereRendu(q.cle)) q.cle.clear();
        L.push_back(q);
      }
    }
  }
  return L;
}
