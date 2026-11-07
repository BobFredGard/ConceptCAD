// Le choix des faces dans la vue 3D : Déplacer une face, Dépouille, Coque, Suppression, Scinder.
// Traduction de src/85-deplacement-face.js, 85-suppression-face.js, 85-scinder.js, 86-draft-depouillage.js, 87-coque.js.
#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepGProp.hxx>
#include <GProp_GProps.hxx>
#include <BRepClass3d_SolidClassifier.hxx>
#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakeVertex.hxx>
#include <BRepExtrema_DistShapeShape.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <Bnd_Box.hxx>
#include <Standard_Failure.hxx>
#include <TopExp.hxx>
#include <TopExp_Explorer.hxx>
#include <TopTools_IndexedMapOfShape.hxx>
#include <TopoDS.hxx>
#include <gp_Circ.hxx>
#include <gp_Lin.hxx>
#include <gp_Pln.hxx>
#include <gp_Vec.hxx>

#include <algorithm>
#include <cmath>

#include "cadre.h"
#include "construction.h"
#include "faces.h"
#include "fiches.h"
#include "filets.h"
#include "noms.h"

namespace {
using json = nlohmann::ordered_json;
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
wxPGProperty* lectureSeule(wxPropertyGrid* g, const wxString& nom, const wxString& valeur) {
  wxPGProperty* p = g->Append(new wxStringProperty(nom, wxPG_LABEL, valeur));
  p->ChangeFlag(wxPGFlags::ReadOnly, true);
  return p;
}
double fixe(double v, int n) {  // +v.toFixed(n)
  const double k = std::pow(10.0, n), r = std::round(v * k) / k;
  return r == 0 ? 0.0 : r;
}
json trois(const Vec3& v, int n) { return json::array({fixe(v[0], n), fixe(v[1], n), fixe(v[2], n)}); }
// occFaceOutNormal : plan ou cylindre seulement ; l'orientation de la face dit le dehors
bool normaleSortante(const TopoDS_Face& f, Vec3& n) {
  try {
    BRepAdaptor_Surface ad(f, true);
    gp_Dir d;
    if (ad.GetType() == GeomAbs_Plane) d = ad.Plane().Axis().Direction();
    else if (ad.GetType() == GeomAbs_Cylinder) d = ad.Cylinder().Axis().Direction();
    else return false;
    const double s = f.Orientation() == TopAbs_REVERSED ? -1 : 1;
    n = {d.X() * s, d.Y() * s, d.Z() * s};
    return true;
  } catch (const Standard_Failure&) {
    return false;
  }
}
// occFaceRef : rien si la face n'est ni plane ni cylindrique
json refFace(const TopoDS_Face& f) {
  Vec3 n{}, pos{}, dim{};
  if (!normaleSortante(f, n)) return nullptr;
  boiteFace(f, pos, dim);
  return {{"pos", trois(pos, 3)}, {"dim", trois(dim, 3)}, {"n", trois(n, 4)}};
}
// occFaceRefAny : toute face
json refFaceLibre(const TopoDS_Face& f) {
  json r = refFace(f);
  if (r.is_null()) {
    Vec3 pos{}, dim{};
    boiteFace(f, pos, dim);
    r = {{"pos", trois(pos, 3)}, {"dim", trois(dim, 3)}};
  }
  r["st"] = natureSurface(f);
  return r;
}
json ancreDe(const AncreArete& a) {
  json o = {{"t", a.t}, {"sk", a.sk}, {"id", a.id}, {"z", a.z}};
  if (a.aSide) {
    o["side"] = a.side;
    o["dist"] = a.dist;
  }
  o["far"] = a.loin ? 1 : 0;
  return o;
}
Vec3 vec(const json& a) { return {a[0].get<double>(), a[1].get<double>(), a[2].get<double>()}; }
wxString centreDe(const json& r) {
  const Vec3 p = vec(r["pos"]);
  return wxString::Format(L"(%.1f ; %.1f ; %.1f)", p[0], p[1], p[2]);
}
std::vector<TopoDS_Face> facesDe(const TopoDS_Shape& s) {
  std::vector<TopoDS_Face> v;
  TopTools_IndexedMapOfShape m;
  TopExp::MapShapes(s, TopAbs_FACE, m);
  for (int i = 1; i <= m.Extent(); i++) v.push_back(TopoDS::Face(m(i)));
  return v;
}
double dist3(const Vec3& a, const Vec3& b) { return std::hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
double vers(const TopoDS_Face& f, const Vec3& p) {
  BRepExtrema_DistShapeShape d(BRepBuilderAPI_MakeVertex(gp_Pnt(p[0], p[1], p[2])).Vertex(), f);
  return d.IsDone() ? d.Value() : 1e18;
}
const wchar_t* nomSorte(int s) {
  switch (s) {
    case ChoixFaces::DEPLACER: return L"Déplacement de face";
    case ChoixFaces::DEPOUILLE: return L"Dépouillage";
    case ChoixFaces::COQUE: return L"Coque";
    case ChoixFaces::SUPPRESSION: return L"Suppression de face";
    default: return L"Scinder";
  }
}
}  // namespace

std::string Cadre::corpsDeForme(const TopoDS_Shape& s) const {
  for (const auto& [id, c] : formesCorps_) {
    TopTools_IndexedMapOfShape carte;
    TopExp::MapShapes(c, s.ShapeType(), carte);
    if (carte.Contains(s)) return id;
  }
  return "";
}

TopoDS_Shape Cadre::solideDuCorps(const std::string& id) const {
  for (const auto& [c, s] : formesCorps_)
    if (c == id) return s;
  return TopoDS_Shape();
}

namespace {
// repPickedDir : normale d'une face plane, direction d'une arête droite, axe d'un cercle ou d'un arc
bool directionDe(const TopoDS_Shape& s, bool faceSeule, gp_Dir& a) {
  if (s.IsNull()) return false;
  try {
    if (s.ShapeType() == TopAbs_FACE) {
      BRepAdaptor_Surface su(TopoDS::Face(s));
      if (su.GetType() != GeomAbs_Plane) return false;
      a = su.Plane().Axis().Direction();
      if (!su.Plane().Direct()) a.Reverse();
      if (s.Orientation() == TopAbs_REVERSED) a.Reverse();
      return true;
    }
    if (s.ShapeType() == TopAbs_EDGE && !faceSeule) {
      BRepAdaptor_Curve c(TopoDS::Edge(s));
      if (c.GetType() == GeomAbs_Line) a = c.Line().Direction();
      else if (c.GetType() == GeomAbs_Circle) a = c.Circle().Axis().Direction();
      else return false;
      return true;
    }
  } catch (const Standard_Failure&) {
  }
  return false;
}
std::string nombres(std::initializer_list<double> v) {
  std::string r;
  char b[64];
  for (double x : v) {
    std::snprintf(b, sizeof b, "%.12g", x);
    if (!r.empty()) r += ",";
    r += b;
  }
  return r;
}
}  // namespace

// Extrusion « Jusqu'à la face » (extPickFaceCommit) : un clic sur une face plane d'un corps
void Cadre::uptoChoisir(const std::string& id) {
  pioche_ = [this, id](const TopoDS_Shape& s) { return uptoPoser(id, s); };
  etat(L"Jusqu'à la face : cliquez une face dans la vue (Échap pour annuler).");
}

bool Cadre::uptoPoser(const std::string& id, const TopoDS_Shape& s) {
  int fi = -1;
  for (size_t k = 0; k < doc_.fonctions.size(); k++)
    if (doc_.fonctions[k].id == id) fi = static_cast<int>(k);
  if (fi < 0) return true;
  const Fonction f = doc_.fonctions[fi];
  const Esquisse* sk = doc_.esquisse(f.esquisse);
  if (!sk) return true;
  if (s.IsNull() || s.ShapeType() != TopAbs_FACE || BRepAdaptor_Surface(TopoDS::Face(s)).GetType() != GeomAbs_Plane) {
    etat(L"Jusqu'à la face : choisissez une face plane d'un corps.");
    return false;
  }
  const TopoDS_Face face = TopoDS::Face(s);
  const gp_Pln pl = BRepAdaptor_Surface(face).Plane();
  gp_Dir n = pl.Axis().Direction();
  if (face.Orientation() == TopAbs_REVERSED) n.Reverse();
  GProp_GProps pr;
  BRepGProp::SurfaceProperties(face, pr);
  const gp_Pnt c = pr.CentreOfMass();
  const double dotBn = n.X() * sk->n[0] + n.Y() * sk->n[1] + n.Z() * sk->n[2];
  const double t = std::abs(dotBn) < 1e-9 ? 0 : (n.X() * (c.X() - sk->o[0]) + n.Y() * (c.Y() - sk->o[1]) + n.Z() * (c.Z() - sk->o[2])) / dotBn;
  if (std::abs(t) < 1e-6) {
    etat(L"Jusqu'à la face : face non utilisable (parallèle au sens d'extrusion, ou dans le plan de l'esquisse) — choisissez-en une autre.");
    return false;
  }
  // Le corps cliqué, et la dernière fonction antérieure de ce corps
  std::string corps = f.corps;
  for (const auto& [idc, forme] : formesCorps_) {
    bool dedans = false;
    for (TopExp_Explorer ex(forme, TopAbs_FACE); ex.More() && !dedans; ex.Next()) dedans = ex.Current().IsSame(face);
    if (dedans) corps = idc;
  }
  std::string cible, derniere;
  for (int k = 0; k < fi; k++)
    if (doc_.fonctions[k].visible) {
      derniere = doc_.fonctions[k].id;
      if (doc_.fonctions[k].corps == corps) cible = derniere;
    }
  if (cible.empty()) cible = derniere;
  if (cible.empty()) {
    etat(L"Jusqu'à la face : aucune fonction ANTÉRIEURE — créez d'abord un volume avant cette extrusion.");
    return true;
  }
  const double sens = (c.X() - sk->o[0]) * sk->n[0] + (c.Y() - sk->o[1]) * sk->n[1] + (c.Z() - sk->o[2]) * sk->n[2];
  nlohmann::ordered_json u = nlohmann::ordered_json::object();
  u["ex"] = cible;
  u["side"] = sens >= 0 ? 1 : -1;
  u["faceId"] = {{"fi", 0}, {"bid", corps}};
  u["faceProps"] = {{"center", {{"x", c.X()}, {"y", c.Y()}, {"z", c.Z()}}}, {"normal", {{"x", n.X()}, {"y", n.Y()}, {"z", n.Z()}}}, {"area", pr.Mass()}};
  const std::string nomFace = nomsFaceDe(forme_, face);
  if (!nomFace.empty()) u["nom"] = nomFace;
  changerStructure([&](nlohmann::ordered_json& d) {
    for (auto& x : d["features"])
      if (x.value("id", std::string()) == id) {
        x["upto"] = u;
        x["through"] = false;
        x["distance"] = std::round(t * 10000) / 10000;
      }
  }, L"Ctrl+Z : annuler.");
  for (size_t q = 0; q < doc_.fonctions.size(); q++)
    if (doc_.fonctions[q].id == id) {
      doc_.fonctions[q].nom = nomExtrusion(doc_, doc_.fonctions[q]);
      if (doc_.fonctions[q].esquisse == f.esquisse) choisirFonction(static_cast<int>(q));
    }
  return true;
}

// Certains réglages demandent un clic dans la vue : la direction d'une répétition, la face où finit un perçage
void Cadre::demanderClicFiche(const std::string& id, const std::string& cle, const std::string& valeur) {
  const auto plan = [this, id](const std::string& cleFin, const wxString& quoi) {
    pioche_ = [this, id, cleFin](const TopoDS_Shape& s) {
      gp_Dir n;
      if (!directionDe(s, true, n)) {
        etat(L"Perçage : choisissez une face PLANE (Échap pour annuler).");
        return false;
      }
      const gp_Pnt p = BRepAdaptor_Surface(TopoDS::Face(s)).Plane().Location();
      appliquerFiche(id, cleFin, nombres({p.X(), p.Y(), p.Z(), n.X(), n.Y(), n.Z()}));
      etat(L"Perçage : face retenue.");
      return true;
    };
    etat(quoi);
  };
  const Fonction* f = nullptr;
  for (const Fonction& x : doc_.fonctions)
    if (x.id == id) f = &x;
  if (!f) return;
  if (f->type == "xthread") {
    if (cle == "x/face") creerFiletageVise(id);
    return;
  }
  if (f->type == "hole") {
    if (cle == "x/facefin" || (cle == "x/end" && valeur == "upto")) plan("x/uptoplan", L"Perçage : cliquez la face plane où le trou s'arrête (Échap pour annuler).");
    else if (cle == "x/facethr" || (cle == "x/thlen" && valeur == "upto")) plan("x/uptofil", L"Perçage : cliquez la face plane où le filet s'arrête (Échap pour annuler).");
    return;
  }
  if (f->type != "repeat" || (cle != "x/rep1" && cle != "x/rep2") || (valeur != "Face" && valeur != "Face+")) return;
  bool mir = false;
  if (doc_.fonctionsJson)
    if (const auto it = doc_.fonctionsJson->find(id); it != doc_.fonctionsJson->end()) mir = nlohmann::ordered_json::parse(it->second).value("mode", "") == "mir";
  pioche_ = [this, id, cle, mir](const TopoDS_Shape& s) {
    gp_Dir a;
    if (!directionDe(s, mir, a)) {
      etat(mir ? L"Répétition : cliquez une face plane (Échap pour annuler)." : L"Répétition : cliquez une face plane, une arête droite, un cercle ou un arc (Échap pour annuler).");
      return false;
    }
    appliquerFiche(id, cle, "Face:" + nombres({a.X(), a.Y(), a.Z()}));
    return true;
  };
  etat(mir ? L"Répétition : cliquez la face qui donne le plan (Échap pour annuler)." : L"Répétition : cliquez la face ou l'arête qui donne la direction (Échap pour annuler).");
}

// Bouton Filetage (askThread, threadPickStart) : la face déjà choisie, sinon un clic sur l'axe
void Cadre::creerFiletageVise(const std::string& idExistant) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  const auto prendre = [this, idExistant](const TopoDS_Face& face, bool dire) {
    double p[3];
    if (!pointDansFace(face, p)) return false;
    const std::string corps = corpsDeForme(face);
    const TopoDS_Shape solide = solideDuCorps(corps).IsNull() ? forme_ : solideDuCorps(corps);
    std::string erreur;
    nlohmann::ordered_json cyl = cylindreDeFiletage(solide, face, p, erreur);
    if (!erreur.empty()) {
      if (dire) etat(tx("Filetage : " + erreur + " (Échap pour annuler)."));
      return false;
    }
    const std::string nom = nomsFaceDe(solide, face);
    if (!nom.empty()) cyl["nom"] = nom;
    if (idExistant.empty()) creerFonction([&](nlohmann::ordered_json& d) { return creerFiletage(d, cyl, corps, indiceMarque()); }, L"Filetage : réglez la taille, la longueur et le type de filet.");
    else appliquerFiche(idExistant, "x/cyl", nlohmann::ordered_json{{"cyl", cyl}, {"body", corps}}.dump());
    return true;
  };
  if (idExistant.empty()) {
    const auto choisies = vue_->facesChoisies();
    if (choisies.size() == 1 && prendre(choisies[0], false)) return;
  }
  pioche_ = [prendre](const TopoDS_Shape& s) {
    if (s.ShapeType() != TopAbs_FACE) return false;
    return prendre(TopoDS::Face(s), true);
  };
  etat(L"Filetage : cliquez la face cylindrique de l'axe à fileter (Échap pour annuler).");
}

// cgPickModelRef : la référence que donne un clic sur la pièce, selon le type attendu ; rien si ce clic ne convient pas
json Cadre::referenceCliquee(const TopoDS_Shape& s, const std::string& type) {
  json r = nullptr;
  if (!s.IsNull() && s.ShapeType() == TopAbs_EDGE) {
    const auto liste = listerAretes(forme_);
    std::vector<TopoDS_Shape> rangs;
    for (TopExp_Explorer ex(forme_, TopAbs_EDGE); ex.More(); ex.Next()) rangs.push_back(ex.Current());
    for (const AreteListee& E : liste) {
      if (E.src >= static_cast<int>(rangs.size()) || !rangs[E.src].IsSame(s)) continue;
      const GeoArete G = geoArete(E.pts);
      json base = {{"k", "edge"}, {"pos", trois(E.mid, 4)}, {"len", std::round(E.len * 1e4) / 1e4}};
      AncreArete a;
      if (ancrePour(doc_, E.mid, a)) base["anchor"] = ancreDe(a);
      if (type == "point") {
        const wxPoint c = vue_->dernierClic();
        const auto ecran = [&](const Vec3& p) {
          const wxPoint q = vue_->pixelDe(p[0], p[1], p[2]);
          return std::hypot(static_cast<double>(q.x - c.x), static_cast<double>(q.y - c.y));
        };
        const double d0 = ecran(E.pts.front()), d1 = ecran(E.pts.back());
        if (G.cercle && std::min(d0, d1) > 12) {
          base["name"] = "Centre · Arête";
          r = base;
        } else {
          base["k"] = "vtx";
          base["vpos"] = trois(d0 <= d1 ? E.pts.front() : E.pts.back(), 4);
          base["name"] = "Sommet · Arête";
          r = base;
        }
      } else if (type == "axis" && (G.droite || G.cercle)) {
        base["name"] = "Arête";
        r = base;
      } else if (type == "plane" && G.cercle) {
        base["name"] = "Plan du cercle · Arête";
        r = base;
      } else if (type == "curve") {
        base["name"] = std::string(G.droite ? "Droite" : G.cercle ? "Arc" : "Courbe") + " · Arête";
        r = base;
      }
      break;
    }
  } else if (!s.IsNull() && s.ShapeType() == TopAbs_FACE && (type == "plane" || type == "axis")) {
    const TopoDS_Face f = TopoDS::Face(s);
    const std::string st = natureSurface(f);
    if ((type == "plane" && st == "Plane") || (type == "axis" && (st == "Cylinder" || st == "Cone"))) {
      json fr = refFaceLibre(f);
      const std::string nom = nomsFaceDe(forme_, f);
      if (!nom.empty()) fr["nom"] = nom;
      AncreArete a;
      if (fr.contains("pos") && ancrePour(doc_, vec(fr["pos"]), a)) fr["anchor"] = ancreDe(a);
      r = {{"k", "face"}, {"ref", fr}, {"name", "Face"}};
    }
  }
  return r;
}

void Cadre::piocherReference(const std::string& id, int rang) {
  const ElementConstruction* e = nullptr;
  for (const ElementConstruction& c : doc_.construction)
    if (c.id == id) e = &c;
  std::string type, titre;
  if (!e || !emplacementConstruction(*e, rang, type, titre)) return;
  refAttendue_ = id;
  rangAttendu_ = rang;
  const wxString consigne = tx(std::string(nomSorteConstruction(e->kind)) + " — " + titre + " : cliquez " + consigneEmplacement(type) + " (ou une ligne de l'arbre) — Échap pour arrêter.");
  etat(consigne);
  pioche_ = [this, id, rang, type, consigne](const TopoDS_Shape& s) {
    json r = referenceCliquee(s, type);
    if (r.is_null()) {
      etat(L"Rien de reconnu ici. " + consigne);
      return false;
    }
    reglerConstruction(id, "r/" + std::to_string(rang), r.dump());
    return true;
  };
}

// Bouton Clavette, ou Perçage sans centre (kwStart, holeStart) : un clic sur un cylindre
void Cadre::creerSurCylindre(bool clavette) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  const wxString quoi = clavette ? L"Clavette : " : L"Perçage : ";
  const auto prendre = [this, clavette, quoi](const TopoDS_Face& f) {
    double p[3];
    vue_->dernierPoint(p);
    ClicCylindre C;
    std::string err;
    if (!lireClicCylindre(f, p, clavette, C, err)) {
      etat(quoi + tx(err) + L" (Échap pour annuler).");
      return false;
    }
    C.ref = refFaceLibre(f);
    const std::string nom = nomsFaceDe(forme_, f);
    if (!nom.empty()) C.ref["nom"] = nom;
    AncreArete a;
    if (C.ref.contains("pos") && ancrePour(doc_, vec(C.ref["pos"]), a)) C.ref["anchor"] = ancreDe(a);
    C.corps = corpsDeForme(f);
    const size_t avant = doc_.esquisses.size();
    creerFonction([&](json& d) { return clavette ? creerClavette(d, C, indiceMarque()) : creerPercageCylindre(d, C, indiceMarque()); }, clavette ? (C.inner ? L"Clavette : alésage reconnu, cotes ISO 773 appliquées. Ctrl+Z pour annuler." : L"Clavette : arbre reconnu, cotes ISO 773 appliquées. Ctrl+Z pour annuler.") : L"Perçage sur cylindre : réglez la direction et la cote dans Paramètres. Ctrl+Z pour annuler.");
    // Le plan n'a pas de repère, ou la rainure pas de contour : rien n'est gardé
    if (doc_.esquisses.size() > avant) {
      const Esquisse& s = doc_.esquisses[avant];
      const ElementConstruction* el = planDuCylindre(doc_, s.id);
      std::string pb;
      if (!el || !el->aRepere) pb = el ? el->j.value("msg", std::string("plan tangent impossible")) : "plan tangent impossible";
      else if (clavette && s.entites.empty()) pb = el->kwSortie.is_object() ? el->kwSortie.value("warn", std::string("cotes de rainure impossibles")) : "cotes de rainure impossibles";
      if (!pb.empty()) {
        annuler();
        etat(quoi + tx(pb) + L".");
      }
    }
    return true;
  };
  const auto choisies = vue_->facesChoisies();
  if (choisies.size() == 1 && prendre(choisies[0])) return;
  pioche_ = [this, prendre, quoi](const TopoDS_Shape& s) {
    if (s.IsNull() || s.ShapeType() != TopAbs_FACE) {
      etat(quoi + L"cliquez une face CYLINDRIQUE (Échap pour annuler).");
      return false;
    }
    return prendre(TopoDS::Face(s));
  };
  etat(clavette ? L"Clavette : cliquez un ARBRE (face extérieure) ou un ALÉSAGE (face intérieure) — Échap pour annuler." : L"Perçage : cliquez un CYLINDRE de la pièce, ou placez d'abord des centres dans une esquisse (outil ⊕) — Échap pour annuler.");
}

// La direction ou la référence de cote d'un plan tangent (holeCylPickAt)
void Cadre::piocherCylindre(const std::string& fonction, const std::string& cle, const std::string& valeur) {
  const Fonction* f = nullptr;
  for (const Fonction& x : doc_.fonctions)
    if (x.id == fonction) f = &x;
  const ElementConstruction* el = f ? planDuCylindre(doc_, f->esquisse) : nullptr;
  if (!el) return;
  const std::string plan = el->id;
  const wxString quoi = f->kw ? L"Clavette : " : L"Perçage : ";
  const auto poser = [this, fonction, plan, quoi](const json& ref) {
    double cote = 0;
    int sens = 1;
    const std::string pb = placementCylindre(doc_, forme_, plan, ref, cote, sens);
    if (!pb.empty()) {
      etat(quoi + tx(pb) + L".");
      return false;
    }
    appliquerFiche(fonction, "z/pose", json{{"ref", ref}, {"d", cote}, {"side", sens}}.dump());
    etat(quoi + L"référence retenue — tapez la cote voulue.");
    return true;
  };
  if (cle == "z/ref" && valeur == "none") {
    poser(nullptr);
    return;
  }
  const bool pos = cle == "z/ref";
  pioche_ = [this, fonction, pos, poser, quoi](const TopoDS_Shape& s) {
    if (pos) {
      json r = referenceCliquee(s, "point");
      if (r.is_null()) r = referenceCliquee(s, "plane");
      if (r.is_null()) {
        etat(quoi + L"rien de reconnu ici (Échap pour annuler).");
        return false;
      }
      return poser(r);
    }
    json r = referenceCliquee(s, "axis");
    if (r.is_null()) r = referenceCliquee(s, "plane");
    if (r.is_null()) {
      etat(quoi + L"cliquez un axe, une arête droite ou une face plane (Échap pour annuler).");
      return false;
    }
    appliquerFiche(fonction, "z/dir", r.dump());
    etat(quoi + L"direction retenue.");
    return true;
  };
  etat(quoi + (pos ? L"cliquez une face, une arête ou un sommet (référence de la cote) — Échap pour annuler." : L"cliquez une arête droite ou une face plane (direction du trou) — Échap pour annuler."));
}

// Bouton Perçage (holeStart, askHole) : l'esquisse choisie si elle a des centres, sinon la dernière dont les centres ne sont pas encore percés
void Cadre::creerPercageVise() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  const auto aDesCentres = [](const Esquisse& s) {
    for (const Entite& e : s.entites)
      if (e.t == "cpoint" && e.percage) return true;
    return false;
  };
  const Esquisse* s = nullptr;
  if (const int i = esquisseDeLArbre(); i >= 0 && aDesCentres(doc_.esquisses[i])) s = &doc_.esquisses[i];
  // Un cylindre déjà sélectionné, s'il n'y a pas d'esquisse choisie (holeStart)
  if (!s && vue_->facesChoisies().size() == 1 && natureSurface(vue_->facesChoisies()[0]) == std::string("Cylinder")) return creerSurCylindre(false);
  if (!s)
    for (size_t i = doc_.esquisses.size(); i-- > 0 && !s;) {
      bool percee = false;
      for (const Fonction& f : doc_.fonctions) percee = percee || (f.type == "hole" && f.esquisse == doc_.esquisses[i].id);
      if (!percee && aDesCentres(doc_.esquisses[i])) s = &doc_.esquisses[i];
    }
  if (!s)
    for (size_t i = doc_.esquisses.size(); i-- > 0 && !s;)
      if (aDesCentres(doc_.esquisses[i])) s = &doc_.esquisses[i];
  if (!s) return creerSurCylindre(false);
  // Sens : vers la matière (le plan d'une face pointe vers l'extérieur)
  bool inverse = false;
  try {
    const TopoDS_Shape solide = forme_;
    if (!solide.IsNull())
      for (const Entite& e : s->entites) {
        if (e.t != "cpoint" || !e.percage) continue;
        const Pt* q = s->point(e.p);
        if (!q) continue;
        const gp_Pnt P(s->o[0] + s->u[0] * q->x + s->v[0] * q->y, s->o[1] + s->u[1] * q->x + s->v[1] * q->y, s->o[2] + s->u[2] * q->x + s->v[2] * q->y);
        const gp_Vec D(-s->n[0], -s->n[1], -s->n[2]);
        BRepClass3d_SolidClassifier cl(solide);
        const auto etatEn = [&](double t) {
          cl.Perform(P.Translated(D * t), 1e-6);
          return cl.State();
        };
        if (etatEn(0.6) != TopAbs_IN && etatEn(-0.6) == TopAbs_IN) inverse = true;
        break;
      }
  } catch (const Standard_Failure&) {
  }
  const std::string id = s->id;
  creerFonction([&](nlohmann::ordered_json& d) { return creerPercage(d, id, inverse, indiceMarque()); }, L"Perçage : réglez le type, le Ø et la fin dans Paramètres. Ctrl+Z : annuler.");
}

// Une fonction de faces s'édite-t-elle ainsi ?
bool Cadre::fonctionDeFaces(const Fonction& f) { return f.repeatId.empty() && (f.type == "xmove" || f.type == "xdraft" || f.type == "xshell" || f.type == "xdelface" || f.type == "xsplit"); }

void Cadre::entrerFaces(int sorte, const std::string& edition) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  quitterConge();
  const wxString nom = nomSorte(sorte);
  auto c = std::make_unique<ChoixFaces>();
  c->sorte = sorte;
  c->edition = edition;
  c->marqueAvant = marqueTemps_;
  if (sorte == ChoixFaces::DEPLACER) c->tangent = memoFacesTangentes_;
  if (sorte == ChoixFaces::DEPOUILLE) c->phaseRef = true;
  c->corps = doc_.corpsActif;
  // Éditer : rejeu jusqu'à la fonction, ses faces d'origine redeviennent cliquables (occSkipFeat + tlEditLock)
  json source;
  if (!edition.empty()) {
    if (!doc_.fonctionsJson) return;
    const auto it = doc_.fonctionsJson->find(edition);
    if (it == doc_.fonctionsJson->end()) return;
    source = json::parse(it->second);
    marqueTemps_ = edition;
    recalculer();
  }
  if (!solideCalculable_ || (forme_.IsNull() && !(sorte == ChoixFaces::SCINDER))) {
    marqueTemps_ = c->marqueAvant;
    return etat(nom + L" : solide exact indisponible (aucun volume).");
  }
  if (!edition.empty()) {
    const std::string corps = source.value("body", std::string());
    if (!corps.empty()) c->corps = corps;
    const TopoDS_Shape s = solideDuCorps(c->corps).IsNull() ? forme_ : solideDuCorps(c->corps);
    const auto retrouver = [&](const json& r) {
      Retenue e;
      e.ref = r;
      try {
        const RefFace rf = lireRefFaceJson(r);
        auto h = rf.aNormale ? trouverFace(doc_, s, rf) : trouverFaceLibre(doc_, s, rf);
        if (h) e.forme = *h;
      } catch (const Standard_Failure&) {
      }
      return e;
    };
    if (source.contains("faces") && source["faces"].is_array()) {
      for (const json& r : source["faces"])
        if (r.is_object() && r.contains("pos") && r.contains("dim")) c->faces.push_back(retrouver(r));
    } else if (source.contains("ref") && source["ref"].is_object()) {
      c->faces.push_back(retrouver(source["ref"]));
    }
    if (sorte == ChoixFaces::DEPLACER) {
      c->dist = source.value("dist", 0.0);
      c->tangent = source.value("tangent", false);
    } else if (sorte == ChoixFaces::DEPOUILLE) {
      c->angle = source.value("angle", 5.0);
      c->flip = source.value("flip", false);
      if (source.contains("ref") && source["ref"].is_object()) {
        c->reference = retrouver(source["ref"]);
        c->phaseRef = false;
      }
    } else if (sorte == ChoixFaces::COQUE) {
      c->epaisseur = source.value("thick", 2.0);
    } else if (sorte == ChoixFaces::SCINDER) {
      c->mode = source.value("mode", std::string("face")) == "body" ? "body" : "face";
      if (source.contains("pl") && source["pl"].is_object()) c->plan = source["pl"];
      c->decalage = source.value("off", 0.0);
      c->flip = source.value("flip", false);
    }
  }
  if (sorte == ChoixFaces::SCINDER && c->plan.is_null()) c->plan = {{"src", "XY"}};
  faces_ = std::move(c);
  vue_->debutChoixFaces();
  if (boutonOkChoix_) boutonOkChoix_->titre(edition.empty() ? L"Appliquer" : L"Enregistrer");
  messageConge_ = sorte == ChoixFaces::DEPOUILLE && faces_->phaseRef ? wxString(L"Dépouillage : cliquez la face de référence (le plan neutre, qui reste fixe).")
                  : sorte == ChoixFaces::DEPLACER                   ? wxString(L"Déplacement de face : cliquez les faces à déplacer (re-clic = retirer), réglez la distance, puis Appliquer (Entrée). Échap annule.")
                  : sorte == ChoixFaces::COQUE                      ? wxString(L"Coque : cliquez les faces à retirer (les ouvertures, re-clic = retirer), saisissez l'épaisseur, puis Appliquer (Entrée). Échap annule.")
                  : sorte == ChoixFaces::SUPPRESSION                ? wxString(L"Suppression de face : cliquez les faces à supprimer (re-clic = retirer), puis Enregistrer (Entrée). Échap annule.")
                                                                    : wxString(L"Scinder : cliquez les faces à couper (re-clic = retirer), choisissez le plan, puis Appliquer (Entrée). Échap annule.");
  rafraichirFaces();
}

void Cadre::quitterFaces() {
  if (!faces_) return;
  const bool edition = !faces_->edition.empty();
  const std::string marque = faces_->marqueAvant;
  faces_.reset();
  vue_->finChoix();
  carteDroite_->contenu()->Show(rangConge_, false);
  if (boutonOkChoix_) boutonOkChoix_->titre(L"Appliquer");
  marqueTemps_ = marque;
  montrerAtelier();
  montrerRien();
  carteDroite_->Layout();
  if (edition) {
    remplirArbre();
    if (solideCalculable_) recalculer();
  } else {
    etat(tx(doc_.nom));
  }
}

void Cadre::cliqueFaces(const TopoDS_Shape& s) {
  ChoixFaces& c = *faces_;
  const wxString nom = nomSorte(c.sorte);
  if (s.IsNull() || s.ShapeType() != TopAbs_FACE) {
    messageConge_ = nom + L" : cliquez une face du solide exact.";
    return rafraichirFaces();
  }
  const TopoDS_Face f = TopoDS::Face(s);
  const std::string corps = corpsDeForme(f);
  const auto trouver = [&]() {
    for (size_t i = 0; i < c.faces.size(); i++)
      if (!c.faces[i].forme.IsNull() && c.faces[i].forme.IsSame(f)) return static_cast<int>(i);
    return -1;
  };
  const auto chaine = [&](const TopoDS_Face& g, const std::string& id) {
    std::vector<TopoDS_Face> sortie;
    const TopoDS_Shape solide = solideDuCorps(id);
    if (solide.IsNull()) return sortie;
    const std::vector<TopoDS_Face> toutes = facesDe(solide);
    int rang = -1;
    for (size_t i = 0; i < toutes.size(); i++)
      if (toutes[i].IsSame(g)) rang = static_cast<int>(i);
    if (rang < 0) return sortie;
    try {
      for (int k : facesTangentesDe(toutes, {rang}))
        if (k != rang) sortie.push_back(toutes[k]);
    } catch (const Standard_Failure&) {
    }
    return sortie;
  };

  if (c.sorte == ChoixFaces::DEPLACER) {
    int i = trouver();
    if (i < 0 && c.tangent)
      for (size_t k = 0; k < c.faces.size() && i < 0; k++)
        if (!c.faces[k].forme.IsNull())
          for (const TopoDS_Face& g : chaine(c.faces[k].forme, c.faces[k].corps))
            if (g.IsSame(f)) i = static_cast<int>(k);
    const bool taille = c.edition.empty() && chercherTaille(f, corps);
    if (i >= 0 && !taille) {
      c.faces.erase(c.faces.begin() + i);
    } else if (!taille) {
      c.blendFonction.clear();
      Retenue e;
      e.ref = refFaceLibre(f);
      e.forme = f;
      e.corps = corps;
      c.faces.push_back(std::move(e));
    }
  } else if (c.sorte == ChoixFaces::DEPOUILLE) {
    const json r = refFace(f);
    if (r.is_null()) {
      messageConge_ = L"Dépouillage : cliquez une face plane ou cylindrique du solide exact.";
      return rafraichirFaces();
    }
    Retenue e;
    e.ref = r;
    e.forme = f;
    e.corps = corps;
    // L'ancre d'esquisse est retenue dès le clic : au rejeu, la face suit les éditions amont
    AncreArete a;
    if (ancrePour(doc_, vec(r["pos"]), a)) e.ref["anchor"] = ancreDe(a);
    if (c.phaseRef) {
      c.reference = e;
      c.phaseRef = false;
      int i = trouver();
      if (i >= 0) c.faces.erase(c.faces.begin() + i);
      messageConge_ = L"Dépouillage : face de référence posée. Cliquez maintenant les faces à dépouiller (re-clic = retirer) · Entrée = appliquer · Échap annule.";
    } else {
      const int i = trouver();
      if (i >= 0) {
        c.faces.erase(c.faces.begin() + i);
      } else {
        if (!c.reference.forme.IsNull() && c.reference.forme.IsSame(f)) {
          messageConge_ = L"C'est déjà la face de référence : elle reste fixe.";
          return rafraichirFaces();
        }
        const Vec3 nr = vec(c.reference.ref["n"]);
        const auto parallele = [&](const json& q) {
          const Vec3 n = vec(q["n"]);
          return std::abs(n[0] * nr[0] + n[1] * nr[1] + n[2] * nr[2]) > 0.999;
        };
        if (parallele(r)) {
          messageConge_ = L"Cette face est parallèle au plan neutre et ne le touche pas : le dépouillage y serait dégénéré. Choisissez une face qui part du plan de référence.";
          return rafraichirFaces();
        }
        c.faces.push_back(e);
        int tangentes = 0, ecartees = 0;
        if (c.tangent)
          for (const TopoDS_Face& g : chaine(f, corps)) {
            json q = refFace(g);
            if (q.is_null() || (!c.reference.forme.IsNull() && c.reference.forme.IsSame(g)) || parallele(q)) {
              ecartees++;
              continue;
            }
            if (std::any_of(c.faces.begin(), c.faces.end(), [&](const Retenue& x) { return !x.forme.IsNull() && x.forme.IsSame(g); })) continue;
            Retenue t;
            if (ancrePour(doc_, vec(q["pos"]), a)) q["anchor"] = ancreDe(a);
            t.ref = std::move(q);
            t.forme = g;
            t.corps = corps;
            c.faces.push_back(std::move(t));
            tangentes++;
          }
        messageConge_ = wxString::Format(L"%zu face(s) à dépouiller retenue(s)", c.faces.size());
        if (tangentes) messageConge_ += wxString::Format(L" (dont %d tangente(s))", tangentes);
        if (ecartees) messageConge_ += wxString::Format(L" — %d voisine(s) écartée(s) (référence ou parallèle au neutre)", ecartees);
        messageConge_ += L" — saisissez l'angle puis Appliquer.";
      }
    }
  } else if (c.sorte == ChoixFaces::COQUE || c.sorte == ChoixFaces::SUPPRESSION) {
    const int i = trouver();
    if (i >= 0) {
      c.faces.erase(c.faces.begin() + i);
    } else {
      const json r = c.sorte == ChoixFaces::COQUE ? refFace(f) : refFaceLibre(f);
      if (r.is_null()) {
        messageConge_ = L"Coque : cliquez une face plane ou cylindrique du solide exact.";
        return rafraichirFaces();
      }
      Retenue e;
      e.ref = r;
      e.forme = f;
      e.corps = corps;
      c.faces.push_back(std::move(e));
    }
    messageConge_ = wxString::Format(c.sorte == ChoixFaces::COQUE ? L"%zu face(s) à retirer retenue(s) — saisissez l'épaisseur puis Appliquer." : L"%zu face(s) à supprimer — Enregistrer (Entrée) ou Échap.", c.faces.size());
  } else {  // Scinder
    if (c.piocherPlan) {
      const json r = refFaceLibre(f);
      if (!r.contains("n") || r.value("st", std::string()) != "Plane") {
        messageConge_ = L"Scinder : cette face n'est pas plane — choisissez une face plane pour le plan de coupe.";
        return rafraichirFaces();
      }
      c.plan = {{"src", "face"}, {"o", r["pos"]}, {"n", r["n"]}};
      c.decalage = 0;
      c.piocherPlan = false;
    } else if (c.mode == "body") {
      c.corps = corps;
      messageConge_ = L"Corps à couper choisi. Choisissez le plan puis Appliquer.";
    } else {
      if (!c.faces.empty() && c.corps != corps) {
        c.faces.clear();
        messageConge_ = L"Faces d'un autre corps : la sélection repart de ce corps.";
      }
      c.corps = corps;
      const int i = trouver();
      if (i >= 0) {
        c.faces.erase(c.faces.begin() + i);
      } else {
        Retenue e;
        e.ref = refFaceLibre(f);
        e.forme = f;
        e.corps = corps;
        c.faces.push_back(std::move(e));
      }
    }
  }
  rafraichirFaces();
}

// occBlendOfFace : la face cliquée vient-elle d'un congé ou d'un chanfrein ? Alors « Déplacer une face » règle sa taille.
bool Cadre::chercherTaille(const TopoDS_Face& face, const std::string& corps) {
  ChoixFaces& c = *faces_;
  if (!doc_.fonctionsJson) return false;
  struct Arrondi {
    std::string id;
    json f;
  };
  std::vector<Arrondi> fonctions;
  const int fin = indiceMarque() < 0 ? static_cast<int>(doc_.fonctions.size()) : indiceMarque();
  for (int i = 0; i < fin; i++) {
    const Fonction& f = doc_.fonctions[i];
    if (f.type != "xfillet" || !f.visible || (!corps.empty() && f.corps != corps)) continue;
    const auto it = doc_.fonctionsJson->find(f.id);
    if (it == doc_.fonctionsJson->end()) continue;
    json j = json::parse(it->second);
    if (j.contains("edges") && j["edges"].is_array()) fonctions.push_back({f.id, std::move(j)});
  }
  if (fonctions.empty()) return false;
  struct Genre {
    bool plan = false, rayonConnu = false;
    double r = 0;
    Vec3 n{}, p{};
  };
  const auto genre = [](const TopoDS_Face& f) {
    Genre g;
    BRepAdaptor_Surface ad(f, true);
    if (ad.GetType() == GeomAbs_Plane) {
      const gp_Ax1 a = ad.Plane().Axis();
      g.plan = true;
      g.n = {a.Direction().X(), a.Direction().Y(), a.Direction().Z()};
      g.p = {a.Location().X(), a.Location().Y(), a.Location().Z()};
    } else if (ad.GetType() == GeomAbs_Cylinder) {
      g.rayonConnu = true;
      g.r = ad.Cylinder().Radius();
    } else if (ad.GetType() == GeomAbs_Torus) {
      g.rayonConnu = true;
      g.r = ad.Torus().MinorRadius();
    }
    return g;
  };
  struct Touche {
    bool oui = false;
    double sc = 0, r = 0;
    size_t fonction = 0, arete = 0;
  };
  const auto tester = [&](const TopoDS_Face& f, const Genre& s) {
    Touche b;
    for (size_t k = 0; k < fonctions.size(); k++) {
      const json& F = fonctions[k].f;
      const bool cham = F.value("chamfer", false);
      if (cham != s.plan) continue;
      const json& E = F["edges"];
      for (size_t i = 0; i < E.size(); i++) {
        if (!E[i].is_object() || !E[i].contains("pos") || !E[i]["pos"].is_array()) continue;
        const double r0 = E[i].value("r", 0.0), r = r0 != 0 ? r0 : F.value("radius", 0.0);
        if (!(r > 0)) continue;
        const Vec3 pos = vec(E[i]["pos"]);
        double sc;
        if (cham) {
          const double dp = std::abs((pos[0] - s.p[0]) * s.n[0] + (pos[1] - s.p[1]) * s.n[1] + (pos[2] - s.p[2]) * s.n[2]);
          if (dp < 0.1 * r || dp > 1.5 * std::max(r, F.value("cd2", 0.0))) continue;
          const double df = vers(f, pos);
          if (std::abs(df - dp) > 0.02 * r + 1e-3) continue;
          sc = std::abs(df - dp) / r;
        } else {
          if (s.rayonConnu && std::abs(s.r - r) > 1e-3 * std::max(1.0, r)) continue;
          const double df = vers(f, pos);
          if (df > 2 * r) continue;
          sc = df / r;
        }
        if (!b.oui || sc < b.sc) b = {true, sc, r, k, i};
      }
    }
    return b;
  };
  try {
    const Genre s0 = genre(face);
    Touche hit = tester(face, s0);
    const TopoDS_Shape solide = solideDuCorps(corps);
    if (!hit.oui && !s0.plan && !solide.IsNull()) {
      const std::vector<TopoDS_Face> toutes = facesDe(solide);
      std::vector<TopoDS_Face> groupe = {face};
      for (int k = 0; k < 40 && !hit.oui; k++) {
        std::vector<TopoDS_Face> suite;
        for (const TopoDS_Face& v : facesVoisinesDe(toutes, groupe)) {
          const Genre g = genre(v);
          if (!g.plan && (!g.rayonConnu || !s0.rayonConnu || std::abs(g.r - s0.r) < 1e-3 * std::max(1.0, s0.r))) suite.push_back(v);
        }
        if (suite.empty()) break;
        for (const TopoDS_Face& v : suite) {
          groupe.push_back(v);
          hit = tester(v, genre(v));
          if (hit.oui) break;
        }
      }
    }
    if (!hit.oui) return false;
    const json& F = fonctions[hit.fonction].f;
    const Vec3 P = vec(F["edges"][hit.arete]["pos"]);
    c.blendIdx.clear();
    for (size_t i = 0; i < F["edges"].size(); i++) {
      const json& e = F["edges"][i];
      if (!e.is_object() || !e.contains("pos")) continue;
      const double r0 = e.value("r", 0.0), r = r0 != 0 ? r0 : F.value("radius", 0.0);
      if (dist3(vec(e["pos"]), P) <= 0.75 && std::abs(r - hit.r) < 1e-9) c.blendIdx.push_back(static_cast<int>(i));
    }
    c.blendFonction = fonctions[hit.fonction].id;
    c.blendNom = F.value("name", std::string());
    c.blendRayon = hit.r;
    c.blendChanfrein = F.value("chamfer", false);
    c.faces.clear();
    c.blendForme = face;
    c.blendCorps = corps;
    messageConge_ = (c.blendChanfrein ? L"Chanfrein" : L"Congé") + wxString(L" : réglez sa ") + (c.blendChanfrein ? L"distance" : L"taille (rayon)") + L" puis Appliquer. Un autre clic choisit une autre face.";
    return true;
  } catch (const Standard_Failure&) {
    return false;
  } catch (const std::exception&) {
    return false;
  }
}

// Le plan de coupe tel que le fichier le décrit (splitPlaneOf)
void Cadre::planScission(Vec3& o, Vec3& n) const {
  const json& P = faces_->plan;
  const std::string src = P.value("src", std::string("XY"));
  o = {0, 0, 0};
  n = {0, 0, 1};
  if (src == "XZ") n = {0, 1, 0};
  else if (src == "YZ") n = {1, 0, 0};
  else if (src == "cg") {
    bool vu = false;
    for (const ElementConstruction& e : doc_.construction)
      if (e.id == P.value("cg", std::string()) && e.aRepere) {
        o = e.o;
        n = e.z;
        vu = true;
      }
    if (!vu && P.contains("o") && P["o"].is_array() && P.contains("n") && P["n"].is_array()) {
      o = vec(P["o"]);
      n = vec(P["n"]);
    }
  } else if (src == "face" && P.contains("o") && P.contains("n")) {
    o = vec(P["o"]);
    n = vec(P["n"]);
  }
  const double l = std::hypot(n[0], n[1], n[2]);
  if (l > 0) n = {n[0] / l, n[1] / l, n[2] / l};
  const double d = faces_->decalage;
  o = {o[0] + n[0] * d, o[1] + n[1] * d, o[2] + n[2] * d};
  if (faces_->flip) n = {-n[0], -n[1], -n[2]};
}

// Le panneau, la surbrillance, l'aperçu
void Cadre::rafraichirFaces() {
  ChoixFaces& c = *faces_;
  wxBusyCursor attente;
  fonctionMontree_ = -1;
  ficheId_.clear();
  facesListes_.clear();
  std::vector<TopoDS_Face> vues, reference;
  for (const Retenue& e : c.faces)
    if (!e.forme.IsNull()) vues.push_back(e.forme);
  if (c.sorte == ChoixFaces::DEPLACER && c.tangent && c.blendFonction.empty())
    for (const Retenue& e : c.faces) {
      if (e.forme.IsNull()) continue;
      const TopoDS_Shape solide = solideDuCorps(e.corps.empty() ? c.corps : e.corps);
      if (solide.IsNull()) continue;
      const std::vector<TopoDS_Face> toutes = facesDe(solide);
      for (size_t i = 0; i < toutes.size(); i++)
        if (toutes[i].IsSame(e.forme)) {
          try {
            for (int k : facesTangentesDe(toutes, {static_cast<int>(i)})) vues.push_back(toutes[k]);
          } catch (const Standard_Failure&) {
          }
        }
    }
  if (!c.blendFonction.empty() && !c.blendForme.IsNull()) vues.push_back(c.blendForme);
  if (!c.reference.forme.IsNull()) reference.push_back(c.reference.forme);

  // L'aperçu de la pièce : dépouille et coque seulement, comme dans le navigateur
  TopoDS_Shape apercu;
  wxString alerte;
  const bool avecApercu = (c.sorte == ChoixFaces::DEPOUILLE && !c.phaseRef && !c.faces.empty()) || (c.sorte == ChoixFaces::COQUE && !c.faces.empty());
  if (avecApercu) {
    std::string signature = c.sorte == ChoixFaces::COQUE ? std::to_string(c.epaisseur) : std::to_string(c.angle) + (c.flip ? "f" : "") + c.reference.ref.dump();
    for (const Retenue& e : c.faces) signature += e.ref.dump();
    if (signature != c.signature) {
      c.signature = signature;
      c.apercu.Nullify();
      c.alerte.clear();
      const std::string corps = !c.faces[0].corps.empty() ? c.faces[0].corps : c.corps;
      const TopoDS_Shape base = solideDuCorps(corps).IsNull() ? forme_ : solideDuCorps(corps);
      try {
        Fonction f;
        f.type = c.sorte == ChoixFaces::COQUE ? "xshell" : "xdraft";
        for (const Retenue& e : c.faces) f.facesVisees.push_back(lireRefFaceJson(e.ref));
        std::vector<std::string> msgs;
        if (c.sorte == ChoixFaces::COQUE) {
          f.epaisseur = c.epaisseur;
          c.apercu = appliquerCoque(doc_, f, base, msgs);
        } else {
          f.angleDepouille = c.angle;
          f.flip = c.flip;
          f.refFace = lireRefFaceJson(c.reference.ref);
          c.apercu = depouilleFaces(doc_, f, base, msgs);
        }
        if (c.apercu.IsSame(base)) c.apercu.Nullify();
        if (!c.apercu.IsNull()) {
          BRepMesh_IncrementalMesh(c.apercu, 0.2, false, 0.35, true);
        }
        if (!msgs.empty()) c.alerte = tx(msgs.back());
      } catch (const Standard_Failure& e) {
        c.apercu.Nullify();
        c.alerte = tx(e.what());
      } catch (const std::exception& e) {
        c.apercu.Nullify();
        c.alerte = tx(e.what());
      }
    }
    apercu = c.apercu;
    alerte = c.alerte;
  }
  // Le plan de coupe en bleu translucide
  TopoDS_Shape plan;
  if (c.sorte == ChoixFaces::SCINDER && !forme_.IsNull()) {
    try {
      Vec3 o{}, n{};
      planScission(o, n);
      const TopoDS_Shape vise = c.mode == "body" && !solideDuCorps(c.corps).IsNull() ? solideDuCorps(c.corps) : forme_;
      Bnd_Box b;
      BRepBndLib::Add(vise, b, true);
      const gp_Pnt mn = b.CornerMin(), mx = b.CornerMax();
      const Vec3 m{(mn.X() + mx.X()) / 2, (mn.Y() + mx.Y()) / 2, (mn.Z() + mx.Z()) / 2};
      const double k = (m[0] - o[0]) * n[0] + (m[1] - o[1]) * n[1] + (m[2] - o[2]) * n[2];
      const double s = mn.Distance(mx) * 0.375 + 2;
      const TopoDS_Face F = BRepBuilderAPI_MakeFace(gp_Pln(gp_Pnt(m[0] - n[0] * k, m[1] - n[1] * k, m[2] - n[2] * k), gp_Dir(n[0], n[1], n[2])), -s, s, -s, s).Face();
      BRepMesh_IncrementalMesh(F, 1.0);
      plan = F;
    } catch (const Standard_Failure&) {
    }
  }
  vue_->montrerFaces(vues, reference, apercu, c.sorte == ChoixFaces::COQUE ? 0x30d158u : 0x2f7bffu, plan);

  // Le panneau
  props_->Freeze();
  props_->Clear();
  props_->CenterSplitter();
  const auto champ = [&](const wxString& t, const char* cle, double v) { props_->Append(new wxStringProperty(t, cle, wxString::Format("%.10g", v))); };
  const auto coche = [&](const wxString& t, const char* cle, bool v) { props_->SetPropertyAttribute(props_->Append(new wxBoolProperty(t, cle, v)), wxPG_BOOL_USE_CHECKBOX, true); };
  const auto liste = [&](const wxString& t, const char* cle, const std::string& valeur, const std::vector<std::pair<std::string, std::string>>& L) {
    wxPGChoices l;
    std::vector<std::string> v;
    int choisi = 0;
    for (size_t k = 0; k < L.size(); k++) {
      l.Add(tx(L[k].second), static_cast<int>(k));
      v.push_back(L[k].first);
      if (L[k].first == valeur) choisi = static_cast<int>(k);
    }
    props_->Append(new wxEnumProperty(t, cle, l, choisi));
    facesListes_[cle] = std::move(v);
  };
  const auto lignes = [&](const wxString& suite) {
    for (size_t i = 0; i < c.faces.size(); i++) {
      const Retenue& e = c.faces[i];
      lectureSeule(props_, wxString::Format(L"%zu%s", i + 1, e.forme.IsNull() ? L" ⚠" : L""), centreDe(e.ref) + suite);
    }
  };
  wxString note;
  if (!c.blendFonction.empty()) {
    props_->Append(new wxPropertyCategory(c.blendChanfrein ? L"Taille du chanfrein" : L"Taille du congé"));
    lectureSeule(props_, L"Fonction", tx(c.blendNom));
    champ(c.blendChanfrein ? L"Distance (mm)" : L"Rayon (mm)", "cf:rayon", c.blendRayon);
    if (normaleOk(c.blendForme)) coche(L"Déplacer la face quand même", "cf:pousser", false);
    note = L"Sa taille change dans la fonction elle-même.";
  } else if (c.sorte == ChoixFaces::DEPLACER) {
    props_->Append(new wxPropertyCategory(c.edition.empty() ? L"Déplacement de face" : L"Édition du déplacement de face"));
    lignes(wxString());
    champ(L"Distance (mm)", "cf:dist", c.dist);
    coche(L"Faces tangentes", "cf:tangent", c.tangent);
    note = L"Chaque face se déplace le long de sa normale sortante : positif, elle avance ; négatif, elle rentre. Ses bords suivent les faces voisines. Une face cylindrique change de rayon.";
  } else if (c.sorte == ChoixFaces::DEPOUILLE) {
    props_->Append(new wxPropertyCategory(c.edition.empty() ? L"Dépouillage (angle de démoulage)" : L"Édition du dépouillage"));
    if (c.phaseRef) {
      note = L"Cliquez la face de référence dans la vue 3D : c'est le plan neutre, la seule qui ne bouge pas.";
    } else {
      if (!c.reference.ref.is_null()) lectureSeule(props_, c.reference.forme.IsNull() ? L"Plan neutre ⚠" : L"Plan neutre", centreDe(c.reference.ref));
      coche(L"Changer la référence", "cf:reference", false);
      lignes(wxString());
      coche(L"Chaîne tangente", "cf:tangent", c.tangent);
      champ(L"Angle (°)", "cf:angle", c.angle);
      coche(L"Inverser le sens de démoulage", "cf:flip", c.flip);
      note = L"Chaque face retenue doit TOUCHER le plan neutre : elle pivote de cet angle autour de sa ligne d'intersection avec lui.";
    }
  } else if (c.sorte == ChoixFaces::COQUE) {
    props_->Append(new wxPropertyCategory(c.edition.empty() ? L"Coque (évidage paroi mince)" : L"Édition de la coque"));
    lignes(L" · sera retirée");
    champ(L"Paroi (mm)", "cf:thick", c.epaisseur);
    note = L"L'intérieur est creusé de cette épaisseur sous chaque face conservée. Une paroi plus épaisse que la plus petite dimension de la pièce est refusée par le moteur.";
  } else if (c.sorte == ChoixFaces::SUPPRESSION) {
    props_->Append(new wxPropertyCategory(L"Édition de la suppression de face"));
    lignes(L" · sera supprimée");
    note = L"Les faces voisines sont prolongées jusqu'à se rejoindre. Si elles partent hors de la pièce, ajoutez aussi ces voisines à la suppression.";
  } else {
    props_->Append(new wxPropertyCategory(c.edition.empty() ? L"Scinder par un plan" : L"Édition de la scission"));
    liste(L"Couper", "cf:mode", c.mode, {{"face", "▦ Des faces"}, {"body", "◧ Un corps"}});
    std::vector<std::pair<std::string, std::string>> corps;
    for (size_t i = 0; i < doc_.corps.size(); i++) corps.push_back({doc_.corps[i], i < doc_.nomsCorps.size() ? doc_.nomsCorps[i] : doc_.corps[i]});
    if (c.mode == "body") liste(L"Corps à couper", "cf:corps", c.corps, corps);
    else lignes(wxString());
    std::vector<std::pair<std::string, std::string>> plans = {{"XY", "Plan XY (origine)"}, {"XZ", "Plan XZ (origine)"}, {"YZ", "Plan YZ (origine)"}};
    for (const ElementConstruction& e : doc_.construction)
      if (e.kind == "plane") plans.push_back({"cg:" + e.id, "▱ " + e.nom});
    plans.push_back({"face", "Face plane (cliquée)"});
    const std::string src = c.plan.value("src", std::string("XY"));
    liste(L"Plan", "cf:plan", src == "cg" ? "cg:" + c.plan.value("cg", std::string()) : src, plans);
    coche(c.piocherPlan ? L"Cliquez une face plane…" : L"Choisir une face plane", "cf:piocher", c.piocherPlan);
    champ(L"Décalage (mm)", "cf:off", c.decalage);
    coche(L"Inverser", "cf:flip", c.flip);
    note = c.mode == "body" ? L"Le côté vers lequel pointe la normale du plan part dans un corps neuf ; l'autre reste dans ce corps." : L"Chaque face reçoit une arête le long du plan ; le solide reste entier.";
  }
  props_->SetSplitterPosition(FromDIP(170));
  props_->Thaw();
  if (!alerte.empty()) note += L"\n⚠ " + alerte;
  noteDroite_->SetMinSize(wxDefaultSize);
  noteDroite_->SetLabel(note);
  noteDroite_->Wrap(-1);
  noteDroite_->Wrap(FromDIP(255));
  noteDroite_->InvalidateBestSize();
  noteDroite_->SetMinSize(noteDroite_->GetBestSize());
  noteMontree_ = !noteMontree_;
  carteDroite_->contenu()->Show(rangConge_, true);
  hauteurDroite_ = 0;
  ajusterDroite();
  carteDroite_->Layout();
  etat(messageConge_);
}

bool Cadre::normaleOk(const TopoDS_Face& f) const {
  Vec3 n{};
  return !f.IsNull() && normaleSortante(f, n);
}

void Cadre::reglerFaces(const std::string& cle, const std::string& valeur) {
  if (!faces_) return;
  ChoixFaces& c = *faces_;
  const auto lire = [&](double& v) {
    std::string t = valeur;
    std::replace(t.begin(), t.end(), ',', '.');
    try {
      size_t lu = 0;
      v = std::stod(t, &lu);
      return lu == t.size() && std::isfinite(v);
    } catch (const std::exception&) {
      return false;
    }
  };
  double v = 0;
  const bool oui = valeur == "1";
  if (cle == "cf:dist") {
    if (!lire(v)) messageConge_ = L"Distance invalide (ex. 5 ou -3).";
    else c.dist = std::abs(v) < 1e-9 ? 0 : v;
  } else if (cle == "cf:tangent") {
    c.tangent = oui;
    if (c.sorte == ChoixFaces::DEPLACER) memoFacesTangentes_ = oui;
  } else if (cle == "cf:angle") {
    if (!lire(v) || !(std::abs(v) > 1e-9 && std::abs(v) < 90)) messageConge_ = L"Angle invalide : il doit être compris entre −90 et 90° (exclus), non nul — un angle négatif inverse le sens.";
    else c.angle = v;
  } else if (cle == "cf:flip") {
    c.flip = oui;
  } else if (cle == "cf:reference") {
    if (oui) {
      c.phaseRef = true;
      messageConge_ = L"Dépouillage : cliquez la nouvelle face de référence (les faces déjà retenues sont conservées).";
    }
  } else if (cle == "cf:thick") {
    if (!lire(v) || !(v > 0)) messageConge_ = L"Épaisseur invalide : strictement positive (ex. 2).";
    else c.epaisseur = v;
  } else if (cle == "cf:rayon") {
    if (!lire(v) || !(v > 0)) messageConge_ = c.blendChanfrein ? L"Distance invalide : un nombre positif." : L"Rayon invalide : un nombre positif.";
    else c.blendRayon = v;
  } else if (cle == "cf:pousser") {
    if (oui && !c.blendForme.IsNull()) {
      Retenue e;
      e.ref = refFaceLibre(c.blendForme);
      e.forme = c.blendForme;
      e.corps = c.blendCorps;
      c.faces = {std::move(e)};
      c.blendFonction.clear();
    }
  } else if (cle == "cf:mode") {
    c.mode = valeur;
    c.piocherPlan = false;
  } else if (cle == "cf:corps") {
    c.corps = valeur;
  } else if (cle == "cf:plan") {
    if (valeur == "face") {
      if (c.plan.value("src", std::string()) != "face") c.piocherPlan = true;
    } else if (valeur.rfind("cg:", 0) == 0) {
      const std::string cg = valeur.substr(3);
      json pl = {{"src", "cg"}, {"cg", cg}};
      for (const ElementConstruction& e : doc_.construction)
        if (e.id == cg && e.aRepere) {
          pl["o"] = json::array({e.o[0], e.o[1], e.o[2]});
          pl["n"] = json::array({e.z[0], e.z[1], e.z[2]});
        }
      c.plan = pl;
      c.piocherPlan = false;
    } else {
      c.plan = {{"src", valeur}};
      c.piocherPlan = false;
    }
  } else if (cle == "cf:piocher") {
    c.piocherPlan = oui;
  } else if (cle == "cf:off") {
    if (!lire(v)) messageConge_ = L"Décalage invalide.";
    else c.decalage = v;
  }
  rafraichirFaces();
}

void Cadre::appliquerChoixFaces() {
  if (!faces_) return;
  const ChoixFaces c = *faces_;
  const wxString nom = nomSorte(c.sorte);
  if (!c.blendFonction.empty()) {
    quitterFacesSansCalcul();
    return creerFonction(
        [&](json& d) {
          for (json& f : d["features"])
            if (f.value("id", std::string()) == c.blendFonction) {
              for (int i : c.blendIdx) f["edges"][i]["r"] = c.blendRayon;
              return c.blendFonction;
            }
          throw std::runtime_error("Congé : fonction introuvable.");
        },
        L"Taille modifiée. Ctrl+Z : annuler.");
  }
  if (c.sorte == ChoixFaces::DEPOUILLE && c.phaseRef) {
    messageConge_ = L"Dépouillage : cliquez d'abord la face de référence.";
    return rafraichirFaces();
  }
  if (c.faces.empty() && !(c.sorte == ChoixFaces::SCINDER && c.mode == "body")) {
    messageConge_ = c.sorte == ChoixFaces::DEPLACER ? L"Déplacement de face : retenez au moins une face."
                    : c.sorte == ChoixFaces::DEPOUILLE ? L"Dépouillage : retenez au moins une face à dépouiller."
                    : c.sorte == ChoixFaces::COQUE ? L"Coque : retenez au moins une face à retirer (l'ouverture)."
                    : c.sorte == ChoixFaces::SUPPRESSION ? L"Suppression de face : retenez au moins une face (ou supprimez la fonction dans l'arbre)."
                                                         : L"Scinder : cliquez au moins une face à couper.";
    return rafraichirFaces();
  }
  if (c.sorte == ChoixFaces::SCINDER && c.plan.value("src", std::string()) == "face" && !c.plan.contains("o")) {
    messageConge_ = L"Scinder : choisissez le plan de coupe.";
    return rafraichirFaces();
  }
  // Le corps : celui des faces cliquées quand elles sont toutes sur le même
  std::string corps = c.corps;
  if (!c.faces.empty() && !c.faces[0].corps.empty()) {
    corps = c.faces[0].corps;
    for (const Retenue& e : c.faces)
      if (e.corps != corps) corps.clear();
  }
  const auto propre = [&](const Retenue& e) {
    json o = {{"pos", e.ref["pos"]}, {"dim", e.ref["dim"]}};
    if (e.ref.contains("n")) o["n"] = e.ref["n"];
    if (c.sorte == ChoixFaces::DEPOUILLE && e.ref.contains("anchor")) o["anchor"] = e.ref["anchor"];
    if ((c.sorte == ChoixFaces::DEPLACER || c.sorte == ChoixFaces::SUPPRESSION || c.sorte == ChoixFaces::SCINDER) && e.ref.contains("st")) o["st"] = e.ref["st"];
    if (e.ref.contains("nom")) o["nom"] = e.ref["nom"];
    return o;
  };
  json refs = json::array();
  for (const Retenue& e : c.faces) refs.push_back(propre(e));
  const std::string editee = c.edition;
  const std::string nomEdition = editee;
  quitterFacesSansCalcul();
  creerFonction(
      [&](json& d) {
        json* cible = nullptr;
        if (!editee.empty())
          for (json& f : d["features"])
            if (f.value("id", std::string()) == editee) cible = &f;
        if (!editee.empty() && !cible) throw std::runtime_error("Fonction introuvable.");
        json f = cible ? *cible : json::object();
        const bool nomAutomatique = !cible || f.value("name", std::string()).empty() || f.value("name", std::string()) == nomAutoFonction(d, f);
        const char* prefixe = "fc";
        f["visible"] = f.value("visible", true);
        if (c.sorte == ChoixFaces::DEPLACER) {
          prefixe = "mv";
          f["type"] = "xmove";
          f["faces"] = refs;
          f["ref"] = refs[0];
          f["dist"] = c.dist;
          if (c.tangent) f["tangent"] = true;
          else f.erase("tangent");
        } else if (c.sorte == ChoixFaces::DEPOUILLE) {
          prefixe = "dr";
          f["type"] = "xdraft";
          f["ref"] = propre(c.reference);
          f["faces"] = refs;
          f["angle"] = c.angle;
          f["flip"] = c.flip;
        } else if (c.sorte == ChoixFaces::COQUE) {
          prefixe = "sh";
          f["type"] = "xshell";
          f["faces"] = refs;
          f["thick"] = c.epaisseur;
        } else if (c.sorte == ChoixFaces::SUPPRESSION) {
          prefixe = "df";
          f["type"] = "xdelface";
          f["faces"] = refs;
        } else {
          prefixe = "sp";
          const bool etaitCorps = f.value("mode", std::string()) == "body";
          f["type"] = "xsplit";
          f["mode"] = c.mode;
          f["pl"] = c.plan;
          f["off"] = c.decalage;
          f["flip"] = c.flip;
          if (c.mode == "face") {
            f["faces"] = refs;
          } else {
            f.erase("faces");
          }
          if (c.mode == "body" && !f.contains("newBody")) f["newBody"] = corpsNeufScission(d, corps);
          if (c.mode == "face" && etaitCorps && f.contains("newBody")) {
            const std::string nb = f["newBody"].get<std::string>();
            f.erase("newBody");
            bool porte = false;
            for (const json& x : d["features"])
              if (x.value("id", std::string()) != editee && (x.value("body", std::string()) == nb || x.value("newBody", std::string()) == nb)) porte = true;
            if (!porte) {
              json r = json::array();
              for (json& b : d["bodies"])
                if (b.value("id", std::string()) != nb) r.push_back(std::move(b));
              d["bodies"] = std::move(r);
            }
          }
        }
        if (!corps.empty()) f["body"] = corps;
        if (cible) {
          if (nomAutomatique) f["name"] = nomAutoFonction(d, f);
          *cible = std::move(f);
          return editee;
        }
        return ajouterFonction(d, std::move(f), prefixe, indiceMarque());
      },
      nom + (editee.empty() ? L" créé. Ctrl+Z : annuler." : L" mis à jour. Ctrl+Z : annuler."));
}

// Sortir du mode avant d'écrire : le recalcul qui suit se fait une fois, et avec le marqueur d'avant
void Cadre::quitterFacesSansCalcul() {
  if (!faces_) return;
  const std::string marque = faces_->marqueAvant;
  faces_.reset();
  vue_->finChoix();
  carteDroite_->contenu()->Show(rangConge_, false);
  if (boutonOkChoix_) boutonOkChoix_->titre(L"Appliquer");
  marqueTemps_ = marque;
  montrerAtelier();
  carteDroite_->Layout();
}

// Suppr : les faces choisies partent, une fonction par corps touché (deleteSelectedFaces)
bool Cadre::supprimerFacesChoisies() {
  if (faces_ || choix_ || esquisseOuverte_ >= 0 || !docOuvert_) return false;
  const std::vector<TopoDS_Face> choisies = vue_->facesChoisies();
  if (choisies.empty()) return false;
  std::vector<std::pair<std::string, json>> parCorps;
  for (const TopoDS_Face& f : choisies) {
    const std::string corps = corpsDeForme(f);
    auto it = std::find_if(parCorps.begin(), parCorps.end(), [&](const auto& x) { return x.first == corps; });
    if (it == parCorps.end()) {
      parCorps.push_back({corps, json::array()});
      it = parCorps.end() - 1;
    }
    it->second.push_back(refFaceLibre(f));
  }
  creerFonction(
      [&](json& d) {
        std::string dernier;
        for (const auto& [corps, refs] : parCorps) {
          json f = {{"type", "xdelface"}, {"name", ""}, {"faces", refs}, {"visible", true}};
          if (!corps.empty()) f["body"] = corps;
          dernier = ajouterFonction(d, std::move(f), "df", indiceMarque());
        }
        return dernier;
      },
      wxString::Format(L"%zu face(s) supprimée(s) — les faces voisines ont été prolongées. Ctrl+Z pour annuler.", choisies.size()));
  return true;
}

// Pour les essais : la face la plus proche de ce point, comme si on l'avait cliquée
void Cadre::cliqueFacePres(const Vec3& p) {
  TopoDS_Face mieux;
  double d = 1e18;
  for (const TopoDS_Face& f : facesDe(forme_)) {
    const double x = vers(f, p);
    if (x < d) {
      d = x;
      mieux = f;
    }
  }
  if (faces_) cliqueFaces(mieux);
}

int Cadre::sorteDeFaces(const Fonction& f) {
  return f.type == "xmove" ? ChoixFaces::DEPLACER : f.type == "xdraft" ? ChoixFaces::DEPOUILLE : f.type == "xshell" ? ChoixFaces::COQUE : f.type == "xdelface" ? ChoixFaces::SUPPRESSION : ChoixFaces::SCINDER;
}
