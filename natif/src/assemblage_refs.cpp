#include "assemblage_refs.h"

#include <BRepAdaptor_Surface.hxx>
#include <BRepGProp.hxx>
#include <GProp_GProps.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <gp_Cone.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Pln.hxx>

#include <algorithm>
#include <cmath>
#include <set>
#include <sstream>

#include "coter.h"
#include "faces.h"
#include "noms.h"
#include "nombres_js.h"

namespace assemblage {

// Ce qu'un composant montre aux autres : capturé à la première demande, avec son solide
struct CaptureRefs {
  std::vector<FaceCapturee> faces;
  std::vector<AreteListee> aretes;
  std::map<std::string, std::string> alias;
  std::string signature;
};

namespace {
const J* g_a = nullptr;
Solides* g_S = nullptr;
std::string g_cid;
Solides* g_solides = nullptr;  // ceux de l'application : le composant actif les lit pendant son rejeu

struct Vue {
  const J* a = nullptr;
  Solides* S = nullptr;
  std::string cid;
};
bool vueDe(const Document& d, Vue& v) {
  if (g_a) {
    v = {g_a, g_S, g_cid};
    return true;
  }
  if (!d.assemblage || !g_solides) return false;
  v = {d.assemblage.get(), g_solides, actif(*d.assemblage)};
  return true;
}

double arr(double x, double q) { return std::round(x * q) / q; }
V3 arrondiV(const V3& p, double q) { return {arr(p[0], q), arr(p[1], q), arr(p[2], q)}; }
J jv(const V3& p) { return J::array({p[0], p[1], p[2]}); }
V3 lireV(const J& j) { return {j[0].get<double>(), j[1].get<double>(), j[2].get<double>()}; }
bool estV(const J* j) { return j && j->is_array() && j->size() >= 3 && (*j)[0].is_number() && (*j)[1].is_number() && (*j)[2].is_number(); }
const J* champ(const J& j, const char* k) {
  const auto it = j.find(k);
  return it == j.end() ? nullptr : &*it;
}
std::string texte(const J& j, const char* k) {
  const J* x = champ(j, k);
  return x && x->is_string() ? x->get<std::string>() : std::string();
}
bool lireChemin(const J& j, const char* k, Chemin& c) {
  const J* x = champ(j, k);
  if (!x || !x->is_array()) return false;
  c.clear();
  for (const J& q : *x) {
    if (!q.is_string()) return false;
    c.push_back(q.get<std::string>());
  }
  return true;
}
double ps(const V3& a, const V3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
V3 moins(const V3& a, const V3& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }

// occFaceRefAny
J refDeFace(const TopoDS_Face& f, const V3* normale) {
  V3 pos{}, dim{};
  boiteFace(f, pos, dim);
  J r = {{"pos", jv(arrondiV(pos, 1e3))}, {"dim", jv(arrondiV(dim, 1e3))}};
  if (normale) r["n"] = jv(arrondiV(*normale, 1e4));
  r["st"] = natureSurface(f);
  return r;
}

CaptureRefs& captureDe(SolideComposant& s) {
  if (s.capture) return *s.capture;
  auto c = std::make_shared<CaptureRefs>();
  s.capture = c;
  if (s.forme.IsNull()) {
    c->signature = "vide";
    return *c;
  }
  try {
    c->aretes = listerAretes(s.forme);
    if (c->aretes.size() > 8000) c->aretes.resize(8000);
    c->alias = nomsSurAretes(s.forme, c->aretes);
    for (AreteListee& e : c->aretes) {
      e.mid = arrondiV(e.mid, 1e6);
      for (Vec3& p : e.pts) p = arrondiV(p, 1e6);
    }
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
  for (TopExp_Explorer ex(s.forme, TopAbs_FACE); ex.More() && c->faces.size() < 4000; ex.Next()) {
    FaceCapturee F;
    if (capturerFace(s.forme, TopoDS::Face(ex.Current()), F)) c->faces.push_back(std::move(F));
  }
  std::ostringstream o;
  o.precision(10);
  const auto ecrire = [&](const V3& p) { o << arr(p[0], 1e4) << ',' << arr(p[1], 1e4) << ',' << arr(p[2], 1e4) << ';'; };
  for (const AreteListee& e : c->aretes) {
    ecrire(e.mid);
    o << arr(e.len, 1e4) << ';';
  }
  for (const FaceCapturee& F : c->faces) {
    ecrire(F.plan ? F.o : F.ao);
    ecrire(F.plan ? F.n : F.ad);
  }
  const std::string t = o.str();
  c->signature = std::to_string(std::hash<std::string>()(t)) + ":" + std::to_string(t.size());
  return *c;
}

// asmSkExtCtx
Chemin contexteDe(const J& a, const J& x, const std::string& cid) {
  Chemin c;
  if (lireChemin(x, "ctx", c) && compDuChemin(a, c) == cid) return c;
  const Chemin P = cheminActif(a);
  if (cid == actif(a) && compDuChemin(a, P) == cid) return P;
  return premierChemin(a, cid);
}
// asmSkXf
bool passageDe(const J& a, const Chemin& ctx, const Chemin& path, Repere& F) {
  Repere Wt, Wc;
  if (!monde(a, path, Wt) || !monde(a, ctx, Wc)) return false;
  F = composer(inverser(Wc), Wt);
  return true;
}
SolideComposant* solideDe(Solides& S, const std::string& cid) {
  const auto it = S.find(cid);
  return it == S.end() ? nullptr : it->second.get();
}
// La capture du composant visé par x, et le passage de son repère à celui de v.cid. Il ne se vise jamais lui-même.
CaptureRefs* cibleDe(const Vue& v, const J& x, Repere& F) {
  Chemin path;
  if (!lireChemin(x, "path", path)) return nullptr;
  const std::string T = compDuChemin(*v.a, path);
  if (T.empty() || T == v.cid) return nullptr;
  SolideComposant* s = solideDe(*v.S, T);
  if (!s) return nullptr;
  if (!passageDe(*v.a, contexteDe(*v.a, x, v.cid), path, F)) return nullptr;
  return &captureDe(*s);
}

// asmXfFind : le nom d'abord, puis la référence durable, puis la géométrie mémorisée à moins d'1 mm
const FaceCapturee* trouverFace(const std::vector<FaceCapturee>& Fs, J& ref) {
  const std::string nom = texte(ref, "nom");
  if (!nom.empty())
    for (const FaceCapturee& e : Fs)
      if (e.nom == nom) return &e;
  const J r0 = ref.contains("ref") ? ref["ref"] : J();
  if (!r0.is_null())
    for (const FaceCapturee& e : Fs)
      if (e.ref == r0) {
        if (nom.empty() && !e.nom.empty()) ref["nom"] = e.nom;
        return &e;
      }
  const J* L = champ(ref, "loc");
  const J* lp = L ? champ(*L, "plane") : nullptr;
  const J* la = L ? champ(*L, "axis") : nullptr;
  const FaceCapturee* best = nullptr;
  double bd = 1e300;
  for (const FaceCapturee& e : Fs) {
    if (lp && lp->is_object() && e.plan && estV(champ(*lp, "n")) && estV(champ(*lp, "o")) && ps(lireV((*lp)["n"]), e.n) > 0.999) {
      const V3 n = lireV((*lp)["n"]);
      const double q = std::abs(ps(moins(e.o, lireV((*lp)["o"])), n));
      if (q < bd) bd = q, best = &e;
    }
    if (la && la->is_object() && !e.plan && estV(champ(*la, "d")) && estV(champ(*la, "o"))) {
      const V3 ad = lireV((*la)["d"]);
      if (std::abs(ps(ad, e.ad)) <= 0.999) continue;
      const V3 w = moins(e.ao, lireV((*la)["o"]));
      const double t = ps(w, ad);
      const double q = std::hypot(w[0] - ad[0] * t, w[1] - ad[1] * t, w[2] - ad[2] * t);
      if (q < bd) bd = q, best = &e;
    }
  }
  return bd < 1 ? best : nullptr;
}

double longueurDe(const AreteListee& e) {
  double L = 0;
  for (size_t i = 1; i < e.pts.size(); i++) L += std::hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1], e.pts[i][2] - e.pts[i - 1][2]);
  return L;
}

// Les références d'un document : éléments de construction et arêtes projetées, figées exceptées
void referencesDe(const J& doc, std::vector<J>& out) {
  if (const J* cg = champ(doc, "cgeo"); cg && cg->is_array())
    for (const J& el : *cg) {
      if (!el.is_object()) continue;
      if (texte(el, "how") == "ext")
        if (const J* x = champ(el, "ext"); x && x->is_object() && !x->value("frozen", false)) out.push_back(*x);
      if (const J* r = champ(el, "refs"); r && r->is_array())
        for (const J& q : *r)
          if (q.is_object() && (texte(q, "k") == "xf" || texte(q, "k") == "xe")) out.push_back(q);
    }
  if (const J* sk = champ(doc, "sketches"); sk && sk->is_array())
    for (const J& s : *sk)
      if (s.is_object())
        if (const J* es = champ(s, "entities"); es && es->is_array())
          for (const J& e : *es)
            if (e.is_object())
              if (const J* x = champ(e, "ext"); x && x->is_object()) out.push_back(*x);
}

std::string signatureDe(const J& a, Solides& S, const std::string& cid, const std::vector<J>& refs) {
  if (refs.empty()) return "";
  std::ostringstream o;
  o.precision(10);
  for (const J& x : refs) {
    Chemin path;
    if (!lireChemin(x, "path", path)) continue;
    const std::string T = compDuChemin(a, path);
    Repere F;
    if (T.empty() || T == cid || !passageDe(a, contexteDe(a, x, cid), path, F)) {
      o << "?;";
      continue;
    }
    for (const V3* v : {&F.o, &F.x, &F.y, &F.z}) o << arr((*v)[0], 1e4) << ',' << arr((*v)[1], 1e4) << ',' << arr((*v)[2], 1e4) << '|';
    SolideComposant* s = solideDe(S, T);
    o << (s ? captureDe(*s).signature : std::string("?"));
    if (const std::string cg = texte(x, "cg"); !cg.empty() && s)
      for (const ElementConstruction& el : s->construction)
        if (el.id == cg && el.j.contains("fr")) o << el.j["fr"].dump();
    o << ';';
  }
  return o.str();
}
}  // namespace

PoseRefs::PoseRefs(const J& a, Solides& S, const std::string& cid) {
  g_a = &a;
  g_S = &S;
  g_cid = cid;
}
PoseRefs::~PoseRefs() {
  g_a = nullptr;
  g_S = nullptr;
  g_cid.clear();
}
void memoriserSolides(Solides* S) { g_solides = S; }

bool capturerFace(const TopoDS_Shape& forme, const TopoDS_Face& f, FaceCapturee& out) {
  try {
    BRepAdaptor_Surface ad(f, true);
    const GeomAbs_SurfaceType gt = ad.GetType();
    V3 pos{}, dim{};
    boiteFace(f, pos, dim);
    if (gt == GeomAbs_Plane) {
      const gp_Dir d = ad.Plane().Axis().Direction();
      const double s = f.Orientation() == TopAbs_REVERSED ? -1 : 1;
      const V3 n = {d.X() * s, d.Y() * s, d.Z() * s};
      out.plan = true;
      out.o = arrondiV(pos, 1e6);
      out.n = arrondiV(n, 1e6);
      out.ref = refDeFace(f, &n);
    } else if (gt == GeomAbs_Cylinder || gt == GeomAbs_Cone) {
      const gp_Ax1 ax = gt == GeomAbs_Cylinder ? ad.Cylinder().Axis() : ad.Cone().Axis();
      const V3 d = {ax.Direction().X(), ax.Direction().Y(), ax.Direction().Z()}, lo = {ax.Location().X(), ax.Location().Y(), ax.Location().Z()};
      const double t = ps(moins(pos, lo), d);
      out.plan = false;
      out.ao = arrondiV({lo[0] + d[0] * t, lo[1] + d[1] * t, lo[2] + d[2] * t}, 1e6);
      out.ad = arrondiV(d, 1e6);
      out.rad = gt == GeomAbs_Cylinder ? arr(ad.Cylinder().Radius(), 1e6) : -1;
      if (gt == GeomAbs_Cylinder) {
        const double s = f.Orientation() == TopAbs_REVERSED ? -1 : 1;
        const V3 n = {d[0] * s, d[1] * s, d[2] * s};
        out.ref = refDeFace(f, &n);
      } else {
        out.ref = refDeFace(f, nullptr);
      }
    } else {
      return false;
    }
    out.nom = nomsFaceDe(forme, f);
    return true;
  } catch (const Standard_Failure&) {
    return false;
  }
}

J localisationFace(const FaceCapturee& f) {
  if (f.plan) return J{{"plane", J{{"o", jv(f.o)}, {"n", jv(f.n)}}}};
  J ax = {{"o", jv(f.ao)}, {"d", jv(f.ad)}};
  ax["rad"] = f.rad >= 0 ? J(f.rad) : J(nullptr);
  return J{{"axis", ax}};
}

bool faceExterne(const Document& d, J& ref, FaceCapturee& out, Repere& passage) {
  Vue v;
  if (!vueDe(d, v)) return false;
  CaptureRefs* c = cibleDe(v, ref, passage);
  if (!c) return false;
  const FaceCapturee* f = trouverFace(c->faces, ref);
  if (!f) return false;
  out = *f;
  return true;
}

bool areteExterne(const Document& d, J& ref, AreteListee& out, Repere& passage) {
  if (!estV(champ(ref, "pos"))) return false;
  Vue v;
  if (!vueDe(d, v)) return false;
  CaptureRefs* c = cibleDe(v, ref, passage);
  if (!c) return false;
  const V3 pos = lireV(ref["pos"]);
  const std::string nom = texte(ref, "nom");
  const AreteListee* best = nullptr;
  if (!nom.empty()) {
    const int i = nomsTrouveArete(c->aretes, c->alias, nom, &pos);
    if (i >= 0) best = &c->aretes[i];
  }
  if (!best) {  // asmXeFind : l'arête la plus proche, de longueur voisine
    double bd = 2.5;
    const double len0 = ref.value("len", 0.0);
    for (const AreteListee& e : c->aretes) {
      const double q = std::hypot(e.mid[0] - pos[0], e.mid[1] - pos[1], e.mid[2] - pos[2]);
      if (q > bd) continue;
      const double L = longueurDe(e);
      if (len0 > 0 && std::abs(L - len0) > std::max(2.0, 0.35 * len0)) continue;
      bd = q;
      best = &e;
    }
    if (best && nom.empty() && !best->nom.empty() && bd < 1e-3) ref["nom"] = best->nom;
  }
  if (!best) return false;
  out = *best;
  ref["pos"] = jv(arrondiV(best->mid, 1e4));
  ref["len"] = arr(longueurDe(*best), 1e4);
  return true;
}

bool repereExterne(const Document& d, const J& e, Repere& F) {
  Vue v;
  if (!vueDe(d, v)) return false;
  Chemin path;
  if (!lireChemin(e, "path", path)) return false;
  const std::string T = compDuChemin(*v.a, path);
  if (T.empty()) return false;
  // asmExtGeom : l'élément dans le repère de son composant
  Repere G;
  const std::string cg = texte(e, "cg");
  if (!cg.empty()) {
    const J* fr = nullptr;
    if (SolideComposant* s = solideDe(*v.S, T))
      for (const ElementConstruction& el : s->construction)
        if (el.id == cg && el.j.contains("fr")) fr = &el.j["fr"];
    if (!fr)
      if (const J* c = composant(*v.a, T); c && c->contains("doc"))
        if (const J* L = champ((*c)["doc"], "cgeo"); L && L->is_array())
          for (const J& k : *L)
            if (k.is_object() && texte(k, "id") == cg && k.contains("fr")) fr = &k["fr"];
    if (!fr || !fr->is_object()) return false;
    G = repereDe(*fr);
  } else {
    const std::string o = texte(e, "o");
    if (o == "XY") G = Repere();
    else if (o == "XZ") G = {{0, 0, 0}, {1, 0, 0}, {0, 0, 1}, {0, -1, 0}};
    else if (o == "YZ") G = {{0, 0, 0}, {0, 1, 0}, {0, 0, 1}, {1, 0, 0}};
    else if (o == "X") G = {{0, 0, 0}, {0, 1, 0}, {0, 0, 1}, {1, 0, 0}};
    else if (o == "Y") G = {{0, 0, 0}, {0, 0, 1}, {1, 0, 0}, {0, 1, 0}};
    else G = Repere();
  }
  Repere Wt, Wc;
  const Chemin ctx = contexteDe(*v.a, e, v.cid);
  if (!monde(*v.a, path, Wt) || !monde(*v.a, ctx, Wc)) return false;
  F = arrondir(composer(inverser(Wc), composer(Wt, G)));
  return true;
}

bool aretesExternes(const Document& d, const J& x, std::vector<AreteListee>& L, std::map<std::string, std::string>& alias) {
  Vue v;
  if (!vueDe(d, v)) return false;
  Repere F;
  CaptureRefs* c = cibleDe(v, x, F);
  if (!c || c->aretes.empty()) return false;
  L = c->aretes;
  alias = c->alias;
  for (AreteListee& e : L) {
    e.mid = appliquer(F, e.mid);
    for (Vec3& p : e.pts) p = appliquer(F, p);
  }
  return true;
}

std::vector<CandidatExterne> candidatsExternes(const J& a, const std::string& kind) {
  std::vector<CandidatExterne> out;
  if (!aDesEnfants(a)) return out;
  const Chemin moi = cheminActif(a);
  std::vector<std::pair<std::string, std::string>> O;
  if (kind == "plane") O = {{"XY", "Plan XY"}, {"XZ", "Plan XZ"}, {"YZ", "Plan YZ"}};
  else if (kind == "axis") O = {{"X", "Axe X"}, {"Y", "Axe Y"}, {"Z", "Axe Z"}};
  else O = {{"O", "Origine"}};
  for (const Instance& inst : instances(a, racine(a))) {
    if (inst.chemin == moi) continue;
    std::string nm;
    for (const std::string& id : inst.chemin) {
      const J* oc = occurrence(a, id);
      nm += (nm.empty() ? "" : " › ") + (oc ? oc->value("name", std::string("?")) : std::string("?"));
    }
    const J* c = composant(a, inst.comp);
    if (!c) continue;
    if (inst.chemin.empty()) nm = c->value("name", std::string()) + " (racine)";
    J base = {{"ctx", moi}, {"path", inst.chemin}};
    for (const auto& [id, lab] : O) {
      J v = base;
      v["cg"] = nullptr;
      v["o"] = id;
      v["frozen"] = false;
      out.push_back({v, nm + " › " + lab});
    }
    if (c->contains("doc"))
      if (const J* L = champ((*c)["doc"], "cgeo"); L && L->is_array())
        for (const J& k : *L)
          if (k.is_object() && k.contains("fr") && k["fr"].is_object() && texte(k, "kind") == kind) {
            J v = base;
            v["cg"] = texte(k, "id");
            v["o"] = nullptr;
            v["frozen"] = false;
            out.push_back({v, nm + " › " + texte(k, "name")});
          }
  }
  return out;
}

std::vector<ListeExterne> listesExternes(const J& a, Solides& S) {
  std::vector<ListeExterne> out;
  if (!aDesEnfants(a)) return out;
  const Chemin P = cheminActif(a);
  const std::string act = actif(a);
  for (const Instance& inst : instances(a, racine(a))) {
    if (inst.comp == act || cheminMasque(a, inst.chemin)) continue;
    SolideComposant* s = solideDe(S, inst.comp);
    if (!s) continue;
    CaptureRefs& c = captureDe(*s);
    if (c.aretes.empty()) continue;
    ListeExterne L;
    if (!passageDe(a, P, inst.chemin, L.passage)) continue;
    L.ext = {{"ctx", P}, {"path", inst.chemin}};
    L.chemin = inst.chemin;
    L.comp = inst.comp;
    const J* cc = composant(a, inst.comp);
    L.nom = cc ? cc->value("name", std::string()) : std::string();
    L.aretes = c.aretes;
    for (AreteListee& e : L.aretes) {
      e.mid = appliquer(L.passage, e.mid);
      for (Vec3& p : e.pts) p = appliquer(L.passage, p);
    }
    out.push_back(std::move(L));
  }
  return out;
}

std::string signatureDocument(const J& a, Solides& S, const std::string& cid, const J& doc) {
  std::vector<J> refs;
  referencesDe(doc, refs);
  return signatureDe(a, S, cid, refs);
}

std::string signatureActif(const Document& haut, Solides& S) {
  if (!haut.assemblage) return "";
  std::vector<J> refs;
  for (const ElementConstruction& el : haut.construction) {
    if (texte(el.j, "how") == "ext")
      if (const J* x = champ(el.j, "ext"); x && x->is_object() && !x->value("frozen", false)) refs.push_back(*x);
    if (const J* r = champ(el.j, "refs"); r && r->is_array())
      for (const J& q : *r)
        if (q.is_object() && (texte(q, "k") == "xf" || texte(q, "k") == "xe")) refs.push_back(q);
  }
  for (const Esquisse& s : haut.esquisses)
    for (const Entite& e : s.entites)
      if (!e.extRef.empty()) refs.push_back(J::parse(e.extRef));
  return signatureDe(*haut.assemblage, S, actif(*haut.assemblage), refs);
}

bool suivreExternesActif(Document& d) { return suivreExternes(d); }

nlohmann::json bilanReferences(const J& a, Solides& S) {
  nlohmann::json out = nlohmann::json::object();
  const auto r3 = [](double x) { return std::round(x * 1e3) / 1e3; };
  if (!a.contains("comps")) return out;
  for (const J& c : a["comps"]) {
    SolideComposant* s = solideDe(S, texte(c, "id"));
    if (!s) continue;
    CaptureRefs& C = captureDe(*s);
    V3 m{0, 0, 0};
    for (const AreteListee& e : C.aretes)
      for (int i = 0; i < 3; i++) m[i] += e.mid[i];
    const double n = std::max<size_t>(1, C.aretes.size());
    nlohmann::json x = {{"nb", C.aretes.size()}, {"centre", {r3(m[0] / n), r3(m[1] / n), r3(m[2] / n)}}};
    GProp_GProps g;
    if (!s->forme.IsNull()) BRepGProp::VolumeProperties(s->forme, g);
    x["volume"] = r3(g.Mass());
    x["spirales"] = s->spirales.size();
    nlohmann::json cg = nlohmann::json::object();
    for (const ElementConstruction& el : s->construction) {
      nlohmann::json k = {{"st", el.j.value("st", std::string())}, {"msg", el.j.value("msg", std::string())}};
      if (el.j.contains("fr") && el.j["fr"].is_object()) {
        const Repere F = repereDe(el.j["fr"]);
        k["o"] = {r3(F.o[0]), r3(F.o[1]), r3(F.o[2])};
        k["z"] = {r3(F.z[0]), r3(F.z[1]), r3(F.z[2])};
      }
      cg[el.id] = k;
    }
    x["cg"] = cg;
    out[texte(c, "name").empty() ? s->nom : texte(c, "name")] = x;
  }
  return out;
}

bool aDesReferences(const J& a) {
  const J* L = champ(a, "comps");
  if (!L || !L->is_array()) return false;
  for (const J& c : *L)
    if (const J* d = champ(c, "doc"); d && d->is_object()) {
      std::vector<J> refs;
      referencesDe(*d, refs);
      if (!refs.empty()) return true;
    }
  return false;
}
}  // namespace assemblage
