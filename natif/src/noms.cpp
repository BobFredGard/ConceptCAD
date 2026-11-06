#include "noms.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepTools_History.hxx>
#include <Standard_Failure.hxx>
#include <TopExp.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Vertex.hxx>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <deque>
#include <exception>
#include <memory>
#include <mutex>
#include <set>
#include <unordered_map>

namespace {
// Une table par solide. Le solide est gardé avec elle : son adresse ne peut pas resservir à un autre.
struct Entree {
  TopoDS_Shape garde;
  std::shared_ptr<TableNoms> t;
};
std::mutex gVerrou;
std::unordered_map<const void*, Entree> gTables;
std::deque<TopoDS_Shape> gFinales;
thread_local std::vector<const void*> tCles;
thread_local std::vector<std::string> tPertes;

const void* cleDe(const TopoDS_Shape& s) { return s.TShape().get(); }
std::shared_ptr<TableNoms> tableDe(const TopoDS_Shape& s) {
  if (s.IsNull()) return nullptr;
  std::lock_guard<std::mutex> v(gVerrou);
  const auto i = gTables.find(cleDe(s));
  return i == gTables.end() ? nullptr : i->second.t;
}
void poser(const TopoDS_Shape& s, std::shared_ptr<TableNoms> t) {
  std::lock_guard<std::mutex> v(gVerrou);
  const void* k = cleDe(s);
  gTables[k] = Entree{s, std::move(t)};
  tCles.push_back(k);
}
void carteFaces(const TopoDS_Shape& s, CarteFaces& m) { TopExp::MapShapesAndAncestors(s, TopAbs_FACE, TopAbs_SHELL, m); }
Vec3 centreDe(const TopoDS_Shape& f) {
  try {
    Vec3 pos, dim;
    boiteFace(TopoDS::Face(f), pos, dim);
    return pos;
  } catch (const Standard_Failure&) {
    return {0, 0, 0};
  }
}
bool centreAvant(const Vec3& a, const Vec3& b) {  // (a0-b0)||(a1-b1)||(a2-b2)
  if (a[0] != b[0]) return a[0] < b[0];
  if (a[1] != b[1]) return a[1] < b[1];
  return a[2] < b[2];
}

struct ListeAretes {
  std::vector<std::string> noms;
  TopTools_IndexedDataMapOfShapeListOfShape carte;
};
bool nomsAretes(const TopoDS_Shape& s, ListeAretes& R) {
  const auto T = tableDe(s);
  if (!T) return false;
  TopExp::MapShapesAndAncestors(s, TopAbs_EDGE, TopAbs_FACE, R.carte);
  CarteFaces mF;
  carteFaces(s, mF);
  TopTools_IndexedDataMapOfShapeListOfShape mV;
  TopExp::MapShapesAndAncestors(s, TopAbs_VERTEX, TopAbs_FACE, mV);
  const auto nomF = [&](const TopoDS_Shape& x) {
    const int j = mF.FindIndex(x);
    if (j <= 0 || j > static_cast<int>(T->f.size()) || T->f[j - 1].empty()) return std::string("?");
    return T->f[j - 1];
  };
  struct Rang {
    int i = 0;
    std::string cle;
    std::vector<std::string> paire;
    std::string bouts;
    Vec3 c{0, 0, 0};
  };
  const int N = R.carte.Extent();
  std::vector<Rang> rows(N);
  std::vector<std::string> ordreGroupes;
  std::map<std::string, std::vector<int>> grp;
  for (int i = 1; i <= N; i++) {
    std::set<std::string> vus;
    for (const TopoDS_Shape& fx : R.carte.FindFromIndex(i)) vus.insert(nomF(fx));
    Rang& r = rows[i - 1];
    r.i = i;
    r.paire.assign(vus.begin(), vus.end());
    for (size_t k = 0; k < r.paire.size(); k++) r.cle += (k ? "|" : "") + r.paire[k];
    if (!grp.count(r.cle)) ordreGroupes.push_back(r.cle);
    grp[r.cle].push_back(i - 1);
  }
  // Deux arêtes entre les mêmes faces : départagées par les faces qui touchent leurs bouts
  for (const std::string& g : ordreGroupes) {
    const std::vector<int>& L = grp[g];
    if (L.size() < 2) continue;
    std::vector<std::string> ordre2;
    std::map<std::string, std::vector<int>> g2;
    for (int k : L) {
      Rang& r = rows[k];
      const TopoDS_Edge e = TopoDS::Edge(R.carte.FindKey(r.i));
      std::set<std::string> v;
      for (const TopoDS_Vertex& q : {TopExp::FirstVertex(e, false), TopExp::LastVertex(e, false)}) {
        const int j = q.IsNull() ? 0 : mV.FindIndex(q);
        if (j > 0)
          for (const TopoDS_Shape& fx : mV.FindFromIndex(j)) v.insert(nomF(fx));
      }
      std::string b;
      for (const std::string& n : v)
        if (std::find(r.paire.begin(), r.paire.end(), n) == r.paire.end()) b += (b.empty() ? "" : ",") + n;
      r.bouts = b;
      if (!g2.count(b)) ordre2.push_back(b);
      g2[b].push_back(k);
    }
    for (const std::string& b : ordre2) {
      std::vector<int>& M = g2[b];
      if (M.size() > 1) {  // vraies jumelles : ordre géométrique, pas celui du noyau
        for (int k : M) {
          try {
            BRepAdaptor_Curve ad(TopoDS::Edge(R.carte.FindKey(rows[k].i)));
            const gp_Pnt p = ad.Value((ad.FirstParameter() + ad.LastParameter()) / 2);
            rows[k].c = {p.X(), p.Y(), p.Z()};
          } catch (const Standard_Failure&) {
          }
        }
        std::stable_sort(M.begin(), M.end(), [&](int x, int y) { return centreAvant(rows[x].c, rows[y].c); });
      }
      for (size_t k = 0; k < M.size(); k++) rows[M[k]].cle += (b.empty() ? "" : "<" + b + ">") + (M.size() > 1 ? "#" + std::to_string(k + 1) : "");
    }
  }
  R.noms.resize(N);
  for (int i = 0; i < N; i++) R.noms[i] = rows[i].cle;
  return true;
}

std::string sansNumeros(std::string n) {  // n.replace(/(#\d+)+$/,'')
  for (;;) {
    size_t i = n.size();
    while (i > 0 && n[i - 1] >= '0' && n[i - 1] <= '9') i--;
    if (i == n.size() || i == 0 || n[i - 1] != '#') return n;
    n.resize(i - 1);
  }
}
std::vector<std::string> nomsDecoupe(const std::string& nom) {  // crochets et chevrons respectés
  int prof = 0;
  std::string cur;
  std::vector<std::string> fa;
  for (char c : nom) {
    if (c == '[') prof++;
    else if (c == ']') prof--;
    if (!prof && c == '<') break;
    if (!prof && c == '|') {
      fa.push_back(cur);
      cur.clear();
      continue;
    }
    cur += c;
  }
  fa.push_back(cur);
  return fa;
}
std::string nomsBase(std::string n, const std::map<std::string, std::string>& a) {
  n = sansNumeros(n);
  int g = 0;
  for (auto i = a.find(n); i != a.end() && g++ < 8; i = a.find(n)) n = sansNumeros(i->second);
  return n;
}
}  // namespace

bool nomsConnus(const TopoDS_Shape& s) { return tableDe(s) != nullptr; }

void nomsPartage(const TopoDS_Shape& src, const TopoDS_Shape& dst) {
  if (src.IsNull() || dst.IsNull()) return;
  if (auto t = tableDe(src)) poser(dst, t);
}

void nomsTransmet(const std::vector<TopoDS_Shape>& entrees, const HistoireNoms& api, const TopoDS_Shape& res, const NaissanceNoms& nais) {
  if (res.IsNull()) return;
  try {
    std::vector<std::pair<TopoDS_Shape, std::shared_ptr<TableNoms>>> avec;
    for (const TopoDS_Shape& s : entrees)
      if (auto t = tableDe(s)) avec.push_back({s, t});
    if (avec.empty()) return;
    CarteFaces mR;
    carteFaces(res, mR);
    const int N = mR.Extent();
    std::vector<std::vector<std::string>> par(N);
    std::map<std::string, std::string> a;
    for (const auto& e : avec) {
      CarteFaces mS;
      carteFaces(e.first, mS);
      const TableNoms& T = *e.second;
      const int n = mS.Extent();
      for (int i = 1; i <= n && i <= static_cast<int>(T.f.size()); i++) {
        const std::string& nom = T.f[i - 1];
        if (nom.empty()) continue;
        const TopoDS_Shape x = mS.FindKey(i);
        const int ici = mR.FindIndex(x);
        if (ici > 0) par[ici - 1].push_back(nom);
        std::vector<TopoDS_Shape> L;
        if (api.modifie) {
          try {
            const TopTools_ListOfShape l = api.modifie(x);
            for (const TopoDS_Shape& y : l) L.push_back(y);
          } catch (const Standard_Failure&) {
            L.clear();
          }
        }
        // Dépouille : ses faces inclinées ne sont données que par ModifiedShape
        if (L.empty() && ici <= 0 && api.modifieForme) {
          try {
            const TopoDS_Shape y = api.modifieForme(x);
            if (!y.IsNull()) L.push_back(y);
          } catch (const Standard_Failure&) {
          }
        }
        struct Morceau {
          int j;
          TopoDS_Shape y;
          Vec3 c{0, 0, 0};
        };
        std::vector<Morceau> pieces;
        for (const TopoDS_Shape& y : L) {
          const int j = mR.FindIndex(y);
          if (j > 0 && std::none_of(pieces.begin(), pieces.end(), [&](const Morceau& p) { return p.j == j; })) pieces.push_back({j, y});
        }
        if (pieces.size() == 1) par[pieces[0].j - 1].push_back(nom);
        else if (pieces.size() > 1) {
          // Morceaux d'une face coupée : ordre géométrique, pas celui du noyau
          for (Morceau& p : pieces) p.c = centreDe(p.y);
          std::stable_sort(pieces.begin(), pieces.end(), [](const Morceau& p, const Morceau& q) { return centreAvant(p.c, q.c); });
          for (size_t k = 0; k < pieces.size(); k++) par[pieces[k].j - 1].push_back(nom + "#" + std::to_string(k + 1));
        }
      }
      for (const auto& q : T.a) a[q.first] = q.second;
    }
    auto t = std::make_shared<TableNoms>();
    t->f.assign(N, std::string());
    for (int i = 0; i < N; i++) {
      if (par[i].empty()) continue;
      // Faces fusionnées (unification) : le plus petit nom reste, les autres y renvoient
      std::set<std::string> noms(par[i].begin(), par[i].end());
      t->f[i] = *noms.begin();
      for (const std::string& x : noms)
        if (x != t->f[i]) a[x] = t->f[i];
    }
    t->a = std::move(a);
    if (nais) nais(mR, t->f);
    // Deux faces de même nom (contours d'une même esquisse, chacun son dessus) : #2, #3… dans l'ordre géométrique
    std::vector<std::string> ordre;
    std::map<std::string, std::vector<int>> vus;
    for (int i = 0; i < N; i++)
      if (!t->f[i].empty()) {
        if (!vus.count(t->f[i])) ordre.push_back(t->f[i]);
        vus[t->f[i]].push_back(i);
      }
    for (const std::string& n : ordre) {
      const std::vector<int>& L = vus[n];
      if (L.size() < 2) continue;
      std::vector<std::pair<int, Vec3>> q;
      for (int i : L) q.push_back({i, centreDe(mR.FindKey(i + 1))});
      std::stable_sort(q.begin(), q.end(), [](const auto& x, const auto& y) { return centreAvant(x.second, y.second); });
      for (size_t k = 1; k < q.size(); k++) t->f[q[k].first] = n + "#" + std::to_string(k + 1);
    }
    poser(res, t);
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
}

void nomsNomme(const TopoDS_Shape& res, const NaissanceNoms& fn) {
  if (res.IsNull()) return;
  try {
    CarteFaces m;
    carteFaces(res, m);
    auto t = std::make_shared<TableNoms>();
    t->f.assign(m.Extent(), std::string());
    fn(m, t->f);
    poser(res, t);
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
}

void nomsApresUnify(const Handle(BRepTools_History)& h, const TopoDS_Shape& s, const TopoDS_Shape& r) {
  if (!tableDe(s) || h.IsNull()) return;
  try {
    HistoireNoms api;
    api.modifie = [&h](const TopoDS_Shape& x) { return h->Modified(x); };
    nomsTransmet({s}, api, r);
  } catch (const Standard_Failure&) {
  }
}

void nomsPrefixe(const TopoDS_Shape& s, const std::string& pre) {
  const auto T = tableDe(s);
  if (!T) return;
  auto t = std::make_shared<TableNoms>();
  t->f.reserve(T->f.size());
  for (const std::string& n : T->f) t->f.push_back(n.empty() ? n : pre + "/" + n);
  for (const auto& q : T->a) t->a[pre + "/" + q.first] = pre + "/" + q.second;
  poser(s, t);
}

void nomsPrismeFaces(const std::function<TopTools_ListOfShape(const TopoDS_Shape&)>& genere, const std::function<TopoDS_Shape()>& premiere, const std::function<TopoDS_Shape()>& derniere,
                     const TopoDS_Shape& res, const std::vector<CoteNom>& cotes) {
  nomsNomme(res, [&](const CarteFaces& m, std::vector<std::string>& f) {
    std::set<std::string> pris;
    const auto pose = [&](const TopoDS_Shape& x, const std::string& nom) {
      const int j = m.FindIndex(x);
      if (j <= 0 || !f[j - 1].empty()) return;
      std::string n = nom;
      for (int k = 2; pris.count(n); k++) n = nom + "#" + std::to_string(k);
      f[j - 1] = n;
      pris.insert(n);
    };
    for (const CoteNom& c : cotes) {
      try {
        const TopTools_ListOfShape l = genere(c.e);
        for (const TopoDS_Shape& y : l) pose(y, c.id + "/flanc");
      } catch (const Standard_Failure&) {
      }
    }
    try {
      const TopoDS_Shape a = premiere();
      if (!a.IsNull()) pose(a, "bas");
      const TopoDS_Shape b = derniere();
      if (!b.IsNull()) pose(b, "haut");
    } catch (const Standard_Failure&) {
    }
  });
}

void nomsApresConge(const std::function<TopTools_ListOfShape(const TopoDS_Shape&)>& genere, const HistoireNoms& api, const TopoDS_Shape& base, const TopoDS_Shape& s, bool chanfrein) {
  if (!tableDe(base)) return;
  try {
    ListeAretes R;
    const bool aR = nomsAretes(base, R);
    nomsTransmet({base}, api, s, [&](const CarteFaces& m, std::vector<std::string>& f) {
      if (!aR) return;
      const int n = R.carte.Extent();
      const std::string pre = chanfrein ? "chanfrein" : "congé";
      for (int i = 1; i <= n; i++) {
        int k = 0;
        const TopTools_ListOfShape l = genere(R.carte.FindKey(i));
        for (const TopoDS_Shape& y : l) {
          const int j = m.FindIndex(y);
          if (j > 0 && f[j - 1].empty()) {
            f[j - 1] = pre + "[" + R.noms[i - 1] + "]" + (k ? "#" + std::to_string(k + 1) : "");
            k++;
          }
        }
      }
    });
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
}

void nomsCompose(const std::vector<TopoDS_Shape>& parts, const TopoDS_Shape& res, const std::vector<std::string>& ids) {
  if (res.IsNull()) return;
  if (parts.size() == 1 && !parts[0].IsNull() && cleDe(parts[0]) == cleDe(res)) return;
  try {
    CarteFaces m;
    carteFaces(res, m);
    auto t = std::make_shared<TableNoms>();
    t->f.assign(m.Extent(), std::string());
    std::set<std::string> vus;
    for (size_t k = 0; k < parts.size(); k++) {
      const auto T = tableDe(parts[k]);
      if (!T) continue;
      CarteFaces mP;
      carteFaces(parts[k], mP);
      for (int i = 1; i <= mP.Extent() && i <= static_cast<int>(T->f.size()); i++) {
        const std::string& n = T->f[i - 1];
        if (n.empty()) continue;
        const int j = m.FindIndex(mP.FindKey(i));
        if (j <= 0) continue;
        const std::string q = vus.count(n) ? n + "@" + (k < ids.size() && !ids[k].empty() ? ids[k] : std::to_string(k)) : n;
        vus.insert(q);
        t->f[j - 1] = q;
      }
      for (const auto& x : T->a) t->a[x.first] = x.second;
    }
    poser(res, t);
  } catch (const Standard_Failure&) {
  }
}

void nomsMemeRangs(const TopoDS_Shape& src, const TopoDS_Shape& dst) {
  const auto T = tableDe(src);
  if (!T || dst.IsNull()) return;
  try {
    CarteFaces a, b;
    carteFaces(src, a);
    carteFaces(dst, b);
    if (a.Extent() == b.Extent()) poser(dst, T);
  } catch (const Standard_Failure&) {
  }
}

std::optional<InstantaneNoms> nomsInstantane(const TopoDS_Shape& s) {
  const auto T = tableDe(s);
  if (!T) return std::nullopt;
  try {
    CarteFaces m;
    carteFaces(s, m);
    InstantaneNoms r;
    for (int i = 1; i <= m.Extent() && i <= static_cast<int>(T->f.size()); i++) {
      if (T->f[i - 1].empty()) continue;
      const TopoDS_Face x = TopoDS::Face(m.FindKey(i));
      r.L.push_back({T->f[i - 1], descSurf(x), centreDe(x)});
    }
    r.a = T->a;
    return r;
  } catch (const Standard_Failure&) {
    return std::nullopt;
  }
}

void nomsCompleter(const TopoDS_Shape& res, const std::string& fid, const InstantaneNoms* snap) {
  if (res.IsNull()) return;
  auto T = tableDe(res);
  if (T && !T->f.empty() && std::none_of(T->f.begin(), T->f.end(), [](const std::string& n) { return n.empty(); })) return;
  try {
    CarteFaces m;
    carteFaces(res, m);
    const int N = m.Extent();
    if (T && static_cast<int>(T->f.size()) != N) T = nullptr;
    const bool neuve = !T;
    auto t = T ? T : std::make_shared<TableNoms>();
    if (neuve) {
      t->f.assign(N, std::string());
      if (snap) t->a = snap->a;
    }
    std::vector<std::string>& f = t->f;
    std::set<std::string> pris;
    for (const std::string& n : f)
      if (!n.empty()) pris.insert(n);
    const auto libre = [&](const std::string& n) {
      if (!pris.count(n)) return n;
      for (int k = 2;; k++) {
        const std::string q = n + "#" + std::to_string(k);
        if (!pris.count(q)) return q;
      }
    };
    struct Vide {
      int i;
      TopoDS_Shape x;
      Vec3 c;
    };
    std::vector<Vide> vides;
    for (int i = 0; i < N; i++)
      if (f[i].empty()) {
        const TopoDS_Shape x = m.FindKey(i + 1);
        vides.push_back({i, x, centreDe(x)});
      }
    std::stable_sort(vides.begin(), vides.end(), [](const Vide& p, const Vide& q) { return centreAvant(p.c, q.c); });
    if (snap && !snap->L.empty()) {
      std::vector<Vide> reste;
      for (const Vide& v : vides) {
        const DescSurf d = descSurf(TopoDS::Face(v.x));
        std::vector<const InstantaneNoms::Ligne*> c;
        for (const auto& q : snap->L)
          if (memeSurface(q.d, d)) c.push_back(&q);
        if (c.empty()) {
          reste.push_back(v);
          continue;
        }
        const auto dist = [&](const InstantaneNoms::Ligne* q) { return std::hypot(q->c[0] - v.c[0], q->c[1] - v.c[1], q->c[2] - v.c[2]); };
        std::stable_sort(c.begin(), c.end(), [&](const auto* p, const auto* q) { return dist(p) < dist(q); });
        const InstantaneNoms::Ligne* q = c[0];
        for (const auto* z : c)
          if (!pris.count(z->nom)) {
            q = z;
            break;
          }
        const std::string n = libre(q->nom);
        f[v.i] = n;
        pris.insert(n);
      }
      vides = std::move(reste);
    }
    if (!fid.empty())
      for (size_t k = 0; k < vides.size(); k++) {
        const std::string n = libre(fid + "/~" + std::to_string(k + 1));
        f[vides[k].i] = n;
        pris.insert(n);
      }
    if (neuve) poser(res, t);
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
}

void nomsFaceSurSurface(const TopoDS_Shape& res, const std::string& nom, const DescSurf& nd) {
  if (res.IsNull() || nom.empty()) return;
  const auto T = tableDe(res);
  if (!T) return;
  try {
    CarteFaces m;
    carteFaces(res, m);
    if (static_cast<int>(T->f.size()) != m.Extent()) return;
    std::set<std::string> pris;
    for (const std::string& n : T->f)
      if (!n.empty()) pris.insert(n);
    int k = 0;
    for (size_t i = 0; i < T->f.size(); i++) {
      if (!T->f[i].empty()) continue;
      if (!memeSurface(descSurf(TopoDS::Face(m.FindKey(static_cast<int>(i) + 1))), nd)) continue;
      std::string n = nom;
      while (pris.count(n)) n = nom + "#" + std::to_string(++k + 1);
      T->f[i] = n;
      pris.insert(n);
    }
  } catch (const Standard_Failure&) {
  }
}

std::string nomsFaceDe(const TopoDS_Shape& shape, const TopoDS_Shape& face) {
  const auto T = tableDe(shape);
  if (!T || face.IsNull()) return "";
  try {
    CarteFaces m;
    carteFaces(shape, m);
    const int j = m.FindIndex(face);
    return j > 0 && j <= static_cast<int>(T->f.size()) ? T->f[j - 1] : "";
  } catch (const Standard_Failure&) {
    return "";
  }
}

std::string nomsPos(const Vec3& p) {
  char b[128];
  snprintf(b, sizeof b, "(%.1f, %.1f, %.1f)", p[0], p[1], p[2]);
  return b;
}

std::optional<TopoDS_Face> nomsRefFace(const TopoDS_Shape& shape, const std::string& nomRef, const Vec3* pos) {
  if (nomRef.empty() || shape.IsNull()) return std::nullopt;
  const auto T = tableDe(shape);
  if (!T) return std::nullopt;
  try {
    CarteFaces m;
    carteFaces(shape, m);
    if (static_cast<int>(T->f.size()) != m.Extent()) return std::nullopt;
    const auto rang = [&](const std::string& n) {
      const auto it = std::find(T->f.begin(), T->f.end(), n);
      return it == T->f.end() ? -1 : static_cast<int>(it - T->f.begin());
    };
    std::string nom = nomRef;
    int i = rang(nom), g = 0;
    while (i < 0 && g++ < 8) {
      const auto q = T->a.find(nom);
      if (q == T->a.end()) break;
      nom = q->second;
      i = rang(nom);
    }
    if (i < 0) {
      // Face coupée depuis (#1, #2…) ou nom d'un morceau recollé depuis : le morceau le plus proche
      const std::string base = sansNumeros(nom);
      std::vector<int> L;
      for (size_t k = 0; k < T->f.size(); k++) {
        const std::string& n = T->f[k];
        if (!n.empty() && (n == base || n.rfind(nom + "#", 0) == 0 || n.rfind(base + "#", 0) == 0)) L.push_back(static_cast<int>(k));
      }
      if (!L.empty()) {
        i = L[0];
        if (L.size() > 1 && pos) {
          double bd = 1e18;
          for (int k : L) {
            const Vec3 c = centreDe(m.FindKey(k + 1));
            const double d = std::hypot(c[0] - (*pos)[0], c[1] - (*pos)[1], c[2] - (*pos)[2]);
            if (d < bd) {
              bd = d;
              i = k;
            }
          }
        }
      }
    }
    if (i < 0) {
      tPertes.push_back("la face d’origine n’existe plus" + (pos ? " près de " + nomsPos(*pos) : std::string()) + " — recherche par position");
      return std::nullopt;
    }
    return TopoDS::Face(m.FindKey(i + 1));
  } catch (const Standard_Failure&) {
    return std::nullopt;
  }
}

std::map<std::string, std::string> nomsSurAretes(const TopoDS_Shape& shape, std::vector<AreteListee>& aretes) {
  std::map<std::string, std::string> alias;
  if (shape.IsNull() || aretes.empty()) return alias;
  const auto T = tableDe(shape);
  if (!T) return alias;
  try {
    ListeAretes R;
    if (!nomsAretes(shape, R)) return alias;
    std::unordered_map<int, AreteListee*> par;
    for (AreteListee& a : aretes) par[a.src] = &a;
    int k = 0;
    for (TopExp_Explorer ex(shape, TopAbs_EDGE); ex.More(); ex.Next(), k++) {
      const auto i = par.find(k);
      if (i == par.end()) continue;
      const int j = R.carte.FindIndex(ex.Current());
      if (j > 0) i->second->nom = R.noms[j - 1];
    }
    alias = T->a;
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
  return alias;
}

int nomsTrouveArete(const std::vector<AreteListee>& aretes, const std::map<std::string, std::string>& alias, const std::string& nom, const Vec3* pos) {
  if (nom.empty() || aretes.empty()) return -1;
  for (size_t i = 0; i < aretes.size(); i++)
    if (aretes[i].nom == nom) return static_cast<int>(i);
  const auto cle = [&](const std::string& n) {
    std::vector<std::string> v;
    for (const std::string& x : nomsDecoupe(n)) v.push_back(nomsBase(x, alias));
    std::sort(v.begin(), v.end());
    std::string c;
    for (size_t i = 0; i < v.size(); i++) c += (i ? "|" : "") + v[i];
    return c;
  };
  const std::string c = cle(nom);
  std::vector<int> L;
  for (size_t k = 0; k < aretes.size(); k++)
    if (!aretes[k].nom.empty() && cle(aretes[k].nom) == c) L.push_back(static_cast<int>(k));
  if (L.empty()) return -1;
  if (L.size() == 1 || !pos) return L[0];
  const auto d = [&](int k) {
    const Vec3& m = aretes[k].mid;
    return std::hypot(m[0] - (*pos)[0], m[1] - (*pos)[1], m[2] - (*pos)[2]);
  };
  std::stable_sort(L.begin(), L.end(), [&](int x, int y) { return d(x) < d(y); });
  return L[0];
}

std::vector<std::string> nomsPerteLue() {
  std::vector<std::string> L;
  L.swap(tPertes);
  return L;
}

void nomsFinDeRejeu(const std::vector<TopoDS_Shape>& finales) {
  std::lock_guard<std::mutex> v(gVerrou);
  for (const TopoDS_Shape& s : finales)
    if (!s.IsNull()) gFinales.push_back(s);
  while (gFinales.size() > 12) {
    const TopoDS_Shape s = gFinales.front();
    gFinales.pop_front();
    const void* k = cleDe(s);
    if (std::none_of(gFinales.begin(), gFinales.end(), [&](const TopoDS_Shape& x) { return cleDe(x) == k; })) gTables.erase(k);
  }
  for (const void* k : tCles)
    if (std::none_of(gFinales.begin(), gFinales.end(), [&](const TopoDS_Shape& x) { return cleDe(x) == k; })) gTables.erase(k);
  tCles.clear();
}
