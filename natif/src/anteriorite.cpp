#include "anteriorite.h"

#include <algorithm>
#include <set>

namespace anteriorite {
namespace {
using Liste = std::vector<const J*>;

std::string ch(const J& o, const char* k) {
  if (!o.is_object()) return "";
  const auto it = o.find(k);
  return it != o.end() && it->is_string() ? it->get<std::string>() : std::string();
}
const J& sous(const J& o, const char* k) {
  static const J vide;
  if (!o.is_object()) return vide;
  const auto it = o.find(k);
  return it != o.end() ? *it : vide;
}
std::string idDe(const J* f) { return ch(*f, "id"); }

Liste listeDe(const J& d) {
  Liste L;
  const J& F = sous(d, "features");
  if (F.is_array())
    for (const J& f : F) L.push_back(&f);
  return L;
}
int rang(const Liste& F, const J* f) {
  const auto it = std::find(F.begin(), F.end(), f);
  return it == F.end() ? -1 : static_cast<int>(it - F.begin());
}

const J* parId(const J& liste, const std::string& id) {
  if (liste.is_array())
    for (const J& x : liste)
      if (ch(x, "id") == id) return &x;
  return nullptr;
}

struct Lien {
  std::string id, why;
  bool soft = false;
};
struct Violation {
  const J* f;
  const J* dep;
  std::string why;
};

// esquisse → première fonction qui la consomme (antSketchUsers)
std::map<std::string, const J*> utilisateurs(const Liste& F) {
  std::map<std::string, const J*> m;
  for (const J* f : F) {
    const std::string t = ch(*f, "type");
    if (t == "extrude" || t == "revolve" || t == "sweep" || t == "hole") {
      const std::string s = ch(*f, "sketchId");
      if (!s.empty()) m.emplace(s, f);
    }
    if (t == "sweep") {
      const std::string p = ch(*f, "pathId");
      if (!p.empty()) m.emplace(p, f);
    }
  }
  return m;
}

void esquissesDesAncres(const J& o, std::set<std::string>& out, int prof) {  // antAnchorSketches
  if (prof > 4) return;
  if (o.is_array()) {
    for (const J& x : o) esquissesDesAncres(x, out, prof + 1);
    return;
  }
  if (!o.is_object()) return;
  const J& a = sous(o, "anchor");
  if (a.is_object() && a.contains("sk") && a["sk"].is_string()) out.insert(a["sk"].get<std::string>());
  for (auto it = o.begin(); it != o.end(); ++it) {
    if (it.key() == "anchor" || (!it.key().empty() && it.key()[0] == '_')) continue;
    if (it->is_object() || it->is_array()) esquissesDesAncres(*it, out, prof + 1);
  }
}

bool constructionSurModele(const J& d, const J* c, std::set<std::string>& vus);
bool esquisseSurModele(const J& d, const std::string& id, std::set<std::string>& vus) {
  const J* s = parId(sous(d, "sketches"), id);
  if (!s) return false;
  if (!ch(sous(*s, "host"), "feat").empty()) return true;
  if (ch(*s, "plane") != "CG" || !sous(*s, "cg").is_object()) return false;
  return constructionSurModele(d, parId(sous(d, "cgeo"), ch(sous(*s, "cg"), "id")), vus);
}
bool constructionSurModele(const J& d, const J* c, std::set<std::string>& vus) {  // cgDependsOnModel
  if (!c || !vus.insert(ch(*c, "id")).second) return false;
  const J& refs = sous(*c, "refs");
  if (!refs.is_array()) return false;
  for (const J& r : refs) {
    const std::string k = ch(r, "k");
    if (k == "face" || k == "edge" || k == "vtx") return true;
    if (k == "cg" && constructionSurModele(d, parId(sous(d, "cgeo"), ch(r, "id")), vus)) return true;
    if ((k == "skent" || k == "skpt") && esquisseSurModele(d, ch(r, "sk"), vus)) return true;
  }
  return false;
}

std::vector<Lien> liensDe(const J& d, const J& f, const Liste& F, const std::map<std::string, const J*>& users) {  // antDeps
  std::vector<Lien> out;
  std::set<std::string> vu;
  const std::string moi = ch(f, "id");
  const auto add = [&](const std::string& id, const std::string& why, bool soft = false) {
    if (id.empty() || id == moi || vu.count(id)) return;
    if (std::none_of(F.begin(), F.end(), [&](const J* x) { return ch(*x, "id") == id; })) return;
    vu.insert(id);
    out.push_back({id, why, soft});
  };
  if (!ch(f, "repeatId").empty()) return out;
  const J& esquisses = sous(d, "sketches");
  const auto nomEsq = [](const J& s) {
    const std::string n = ch(s, "name");
    return n.empty() ? ch(s, "id") : n;
  };
  const std::string type = ch(f, "type");
  if (type == "repeat") {
    const J& base = sous(f, "base");
    if (base.is_array())
      for (const J& b : base)
        if (b.is_string()) add(b.get<std::string>(), "source de la répétition");
    if (ch(f, "mode") == "path") {
      const J* gk = parId(esquisses, ch(sous(f, "path"), "sk"));
      if (gk && !ch(sous(*gk, "host"), "feat").empty()) add(ch(sous(*gk, "host"), "feat"), "face portant la courbe guide « " + nomEsq(*gk) + " »");
    }
  }
  if (type == "xfillet" || type == "fillet") add(ch(f, "target"), "fonction visée");
  add(ch(sous(f, "upto"), "ex"), "cible « jusqu’à »");
  const std::string source = ch(f, "sketchId"), chemin = type == "sweep" ? ch(f, "pathId") : std::string();
  for (const std::string& skId : {source, chemin}) {
    if (skId.empty()) continue;
    const J* sk = parId(esquisses, skId);
    if (!sk) continue;
    const J& host = sous(*sk, "host");
    if (!ch(host, "feat").empty()) add(ch(host, "feat"), "face portant l’esquisse « " + nomEsq(*sk) + " »");
    if (sous(host, "mv").is_array())
      for (const J& m : sous(host, "mv")) add(ch(m, "id"), "déplacement de la face portant l’esquisse « " + nomEsq(*sk) + " »");
    if (ch(*sk, "plane") == "CG" && !ch(sous(*sk, "cg"), "id").empty()) {
      const J* c = parId(sous(d, "cgeo"), ch(sous(*sk, "cg"), "id"));
      std::set<std::string> v;
      if (c && !ch(*c, "at").empty() && constructionSurModele(d, c, v)) {
        const std::string nc = ch(*c, "name");
        add(ch(*c, "at"), "plan de construction « " + (nc.empty() ? ch(*c, "id") : nc) + " » de l’esquisse « " + nomEsq(*sk) + " »");
      }
    }
    // Les esquisses reprises par projection, de proche en proche
    std::set<std::string> vus;
    std::vector<const J*> pile{sk};
    while (!pile.empty()) {
      const J* s = pile.back();
      pile.pop_back();
      if (!vus.insert(ch(*s, "id")).second) continue;
      std::set<std::string> deps;
      const J& ents = sous(*s, "entities");
      if (ents.is_array())
        for (const J& e : ents) {
          const std::string q = ch(sous(e, "skSrc"), "sk");
          if (!q.empty()) deps.insert(q);
        }
      for (const std::string& id : deps) {
        const J* q = parId(esquisses, id);
        if (!q) continue;
        const std::string hote = ch(sous(*q, "host"), "feat");
        if (!hote.empty()) add(hote, "face portant l’esquisse « " + nomEsq(*q) + " », projetée dans « " + nomEsq(*sk) + " »");
        pile.push_back(q);
      }
    }
  }
  std::set<std::string> ancres;
  esquissesDesAncres(f, ancres, 0);
  for (const std::string& skId : ancres) {
    if (skId == source) continue;
    const auto u = users.find(skId);
    if (u != users.end()) add(ch(*u->second, "id"), "faces ou arêtes créées par « " + ch(*u->second, "name") + " »", true);
  }
  return out;
}

std::vector<Violation> violations(const J& d, const Liste& F, bool soft) {  // antViolations
  const auto users = utilisateurs(F);
  std::map<std::string, int> idx;
  for (size_t i = 0; i < F.size(); i++) idx[idDe(F[i])] = static_cast<int>(i);
  std::vector<Violation> out;
  for (size_t i = 0; i < F.size(); i++)
    for (const Lien& l : liensDe(d, *F[i], F, users)) {
      if (l.soft && !soft) continue;
      const auto j = idx.find(l.id);
      if (j != idx.end() && j->second > static_cast<int>(i)) out.push_back({F[i], F[j->second], l.why});
    }
  return out;
}
std::string message(const Violation& v) {  // antMsg
  return "« " + ch(*v.f, "name") + " » doit rester après « " + ch(*v.dep, "name") + " » (" + v.why + ").";
}

bool blocDe(const J* f, const Liste& F, int& a, int& b) {  // featBlockOf
  const int i = rang(F, f);
  if (i < 0 || !ch(*f, "repeatId").empty()) return false;
  a = b = i;
  if (ch(*f, "type") != "repeat") return true;
  const std::string id = ch(*f, "id");
  const auto kids = std::count_if(F.begin(), F.end(), [&](const J* k) { return ch(*k, "repeatId") == id; });
  b = i + static_cast<int>(kids);
  for (int k = i + 1; k <= b; k++)
    if (k >= static_cast<int>(F.size()) || ch(*F[k], "repeatId") != id) return false;
  return true;
}

bool cran(Liste& F, const J* f, int dir) {  // featMoveStep
  int d0, d1;
  if (!blocDe(f, F, d0, d1)) return false;
  const std::string mine = ch(*f, "body");
  const int L = d1 - d0 + 1, n = static_cast<int>(F.size());
  const auto debutBloc = [&](int k) {
    const std::string r = ch(*F[k], "repeatId");
    if (r.empty()) return k;
    for (int q = 0; q < n; q++)
      if (ch(*F[q], "id") == r && ch(*F[q], "type") == "repeat") return q;
    return -1;
  };
  const auto longueur = [&](int k) {
    const J& o = *F[k];
    if (ch(o, "type") != "repeat" || !ch(o, "repeatId").empty()) return 0;
    const std::string id = ch(o, "id");
    return static_cast<int>(std::count_if(F.begin(), F.end(), [&](const J* x) { return ch(*x, "repeatId") == id; }));
  };
  const Liste seg(F.begin() + d0, F.begin() + d1 + 1);
  int at = -1, apres = 0;
  if (dir < 0) {
    int k = d0 - 1;
    while (k >= 0) {
      const int s = debutBloc(k);
      if (s < 0 || s >= d0) {
        k--;
        continue;
      }
      if (ch(*F[s], "body") == mine) {
        at = s;
        break;
      }
      k = s - 1;  // saute le bloc entier d'un autre corps
    }
    if (at < 0) return false;
    F.erase(F.begin() + d0, F.begin() + d1 + 1);
    F.insert(F.begin() + at, seg.begin(), seg.end());
  } else {
    int k = d1 + 1;
    while (k < n) {
      if (!ch(*F[k], "repeatId").empty()) {
        k++;
        continue;
      }
      const int e = k + longueur(k);
      if (ch(*F[k], "body") == mine) {
        at = k;
        apres = e - k + 1;
        break;
      }
      k = e + 1;
    }
    if (at < 0) return false;
    F.erase(F.begin() + d0, F.begin() + d1 + 1);
    F.insert(F.begin() + at - L + apres, seg.begin(), seg.end());
  }
  return true;
}

// featMoveRaw : pourquoi est rempli si l'antériorité refuse
bool cranControle(const J& d, Liste& F, const J* f, int dir, std::string& pourquoi) {
  pourquoi.clear();
  Liste G = F;
  if (!cran(G, f, dir)) return false;
  std::set<std::string> avant;
  const auto cle = [](const Violation& v) { return ch(*v.f, "id") + ">" + ch(*v.dep, "id"); };
  for (const Violation& v : violations(d, F, true)) avant.insert(cle(v));
  for (const Violation& v : violations(d, G, true))
    if (!avant.count(cle(v))) {
      pourquoi = message(v);
      return false;
    }
  F = std::move(G);
  return true;
}

// featMoveApply + featMoveKeepAnchors
void poser(J& d, const Liste& A, const J* f) {
  const Liste F = listeDe(d);
  J nouveau = J::array();
  for (const J* x : A) nouveau.push_back(*x);
  int a, b;
  if (blocDe(f, F, a, b)) {
    std::set<std::string> ids;
    for (int k = a; k <= b; k++) ids.insert(idDe(F[k]));
    const J prev = a > 0 ? J(idDe(F[a - 1])) : J(nullptr);
    if (d.contains("cgeo") && d["cgeo"].is_array())
      for (J& c : d["cgeo"]) {
        std::set<std::string> v;
        if (c.is_object() && ids.count(ch(c, "at")) && !constructionSurModele(d, &c, v)) c["at"] = prev;
      }
    if (d.contains("sketches") && d["sketches"].is_array())
      for (J& s : d["sketches"])
        if (s.is_object() && ids.count(ch(s, "at"))) s["at"] = prev;
  }
  d["features"] = std::move(nouveau);
}
const J* fonction(const J& d, const std::string& id) { return parId(sous(d, "features"), id); }
}  // namespace

std::map<std::string, std::string> avertissements(const J& d) {
  std::map<std::string, std::string> m;
  for (const Violation& v : violations(d, listeDe(d), false)) {
    std::string& s = m[ch(*v.f, "id")];
    if (!s.empty()) s += "\n";
    s += "« " + ch(*v.dep, "name") + " » (" + v.why + ") est placée APRÈS";
  }
  return m;
}

std::string bilanOuverture(const J& d) {
  const auto L = violations(d, listeDe(d), false);
  if (L.empty()) return "";
  std::string s = "⚠ Antériorité : " + std::to_string(L.size()) + " lien(s) vers une fonction placée plus loin —";
  for (const Violation& v : L) s += " " + message(v);
  return s;
}

void deplacerCran(J& d, const std::string& id, int dir) {
  const J* f = fonction(d, id);
  if (!f) return;
  Liste A = listeDe(d);
  std::string pourquoi;
  if (!cranControle(d, A, f, dir, pourquoi))
    throw Refus(!pourquoi.empty() ? "⛔ Déplacement refusé : " + pourquoi : "Déjà en tête / en fin de corps — rien à décaler.");
  poser(d, A, f);
}

void deplacerSur(J& d, const std::string& id, const std::string& cible) {
  const J* f = fonction(d, id);
  const J* T = fonction(d, cible);
  if (!f || !T || f == T || !ch(*f, "repeatId").empty() || !ch(*T, "repeatId").empty() || ch(*f, "body") != ch(*T, "body")) throw Refus("Rien à déplacer.");
  Liste A = listeDe(d);
  const Liste F = A;
  const int dir = rang(F, T) > rang(F, f) ? 1 : -1;
  for (size_t n = 0; n < F.size(); n++) {
    if (dir > 0 ? rang(A, f) > rang(A, T) : rang(A, f) < rang(A, T)) break;
    std::string pourquoi;
    Liste B = A;
    if (!cranControle(d, B, f, dir, pourquoi)) {
      if (!pourquoi.empty()) throw Refus("⛔ Déplacement refusé : " + pourquoi);
      break;
    }
    A = std::move(B);
  }
  if (A == F) throw Refus("Rien à déplacer.");
  poser(d, A, f);
}

void deplacerDansFil(J& d, const std::string& id, bool versDroite, const std::string& voisine) {
  const J* f = fonction(d, id);
  if (!f || !ch(*f, "repeatId").empty()) return;
  const J* T = voisine.empty() ? nullptr : fonction(d, voisine);
  Liste A = listeDe(d);
  const Liste F = A;
  for (size_t n = 0; n < F.size(); n++) {
    std::string pourquoi;
    Liste B = A;
    if (!cranControle(d, B, f, versDroite ? 1 : -1, pourquoi)) {
      if (!pourquoi.empty()) throw Refus("⛔ Déplacement refusé : " + pourquoi);
      break;
    }
    if (T && (versDroite ? rang(B, f) > rang(B, T) : rang(B, f) < rang(B, T))) break;
    A = std::move(B);
  }
  if (A == F) throw Refus("Déplacement impossible ici : une fonction reste dans son corps, une répétition se déplace en bloc.");
  poser(d, A, f);
}
}  // namespace anteriorite
