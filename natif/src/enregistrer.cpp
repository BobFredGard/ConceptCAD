#include "enregistrer.h"

#include <windows.h>
#include <io.h>
#include <zlib.h>

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <map>

namespace {
// Parcours du texte JSON, sans le décoder : on y cherche seulement la place de chaque « distance ».
// Le fichier a déjà été lu sans erreur à l'ouverture ; tout écart ici arrête l'enregistrement.
class Parcours {
 public:
  explicit Parcours(const std::string& t) : t_(t) {
    if (t_.compare(0, 3, "\xEF\xBB\xBF") == 0) i_ = 3;
  }
  size_t ici() const { return i_; }
  void aller(size_t i) { i_ = i; }
  void blancs() {
    while (i_ < t_.size() && (t_[i_] == ' ' || t_[i_] == '\t' || t_[i_] == '\r' || t_[i_] == '\n')) i_++;
  }
  char voir() {
    blancs();
    if (i_ >= t_.size()) panne();
    return t_[i_];
  }
  void attendre(char c) {
    if (voir() != c) panne();
    i_++;
  }
  // Texte brut d'une chaîne, sans ses guillemets
  std::string chaine() {
    attendre('"');
    const size_t d = i_;
    while (i_ < t_.size() && t_[i_] != '"') i_ += t_[i_] == '\\' ? 2 : 1;
    if (i_ >= t_.size()) panne();
    return t_.substr(d, i_++ - d);
  }
  void sauter() {
    const char c = voir();
    if (c == '"') {
      chaine();
    } else if (c == '{' || c == '[') {
      int prof = 0;
      do {
        const char x = voir();
        if (x == '"') {
          chaine();
          continue;
        }
        if (x == '{' || x == '[') prof++;
        else if (x == '}' || x == ']') prof--;
        i_++;
      } while (prof > 0);
    } else {
      while (i_ < t_.size() && !strchr(",}] \t\r\n", t_[i_])) i_++;
    }
  }
  // Appelle f(clé) sur chaque membre de l'objet courant, placé devant sa valeur ; f doit passer la valeur.
  template <class F>
  void membres(F f) {
    attendre('{');
    if (voir() == '}') {
      i_++;
      return;
    }
    for (;;) {
      const std::string k = chaine();
      attendre(':');
      blancs();
      f(k);
      const char c = voir();
      i_++;
      if (c == '}') return;
      if (c != ',') panne();
    }
  }
  [[noreturn]] static void panne() { throw std::runtime_error("structure du fichier inattendue, rien n'a été écrit"); }

 private:
  const std::string& t_;
  size_t i_ = 0;
};

std::string nombreJson(double v) {
  if (!std::isfinite(v)) throw std::runtime_error("valeur de cote incorrecte, rien n'a été écrit");
  if (v == 0) return "0";  // -0 s'écrit 0, comme JSON.stringify
  char b[64];
  const auto r = std::to_chars(b, b + sizeof b, v);  // le plus court qui redonne exactement le même nombre
  return std::string(b, r.ptr);
}

std::string gonfler(const std::string& texte) {
  z_stream z{};
  if (deflateInit2(&z, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 16 + MAX_WBITS, 8, Z_DEFAULT_STRATEGY) != Z_OK) throw std::runtime_error("compression impossible");
  std::string out(deflateBound(&z, static_cast<uLong>(texte.size())), '\0');
  z.next_in = reinterpret_cast<Bytef*>(const_cast<char*>(texte.data()));
  z.avail_in = static_cast<uInt>(texte.size());
  z.next_out = reinterpret_cast<Bytef*>(out.data());
  z.avail_out = static_cast<uInt>(out.size());
  const int r = deflate(&z, Z_FINISH);
  const uLong n = z.total_out;
  deflateEnd(&z);
  if (r != Z_STREAM_END) throw std::runtime_error("compression impossible");
  out.resize(n);
  return out;
}

void ecrireFichier(const std::wstring& chemin, const std::string& octets) {
  FILE* f = _wfopen(chemin.c_str(), L"wb");
  if (!f) throw std::runtime_error("écriture impossible dans ce dossier");
  const bool ok = fwrite(octets.data(), 1, octets.size(), f) == octets.size() && fflush(f) == 0 && _commit(_fileno(f)) == 0;
  if (fclose(f) != 0 || !ok) {
    _wremove(chemin.c_str());
    throw std::runtime_error("écriture incomplète (disque plein ?)");
  }
}

bool existe(const std::wstring& chemin) { return GetFileAttributesW(chemin.c_str()) != INVALID_FILE_ATTRIBUTES; }

// Le fichier écrit se relit-il comme la même pièce ?
void controler(const std::wstring& temp, const std::string& octets, const Document& d) {
  if (lireOctets(temp) != octets) throw std::runtime_error("la relecture du fichier écrit ne redonne pas les mêmes octets");
  const Document r = lireProjet(temp);
  bool pareil = r.esquisses.size() == d.esquisses.size() && r.fonctions.size() == d.fonctions.size() && r.nonPrisEnCharge == d.nonPrisEnCharge;
  for (size_t i = 0; pareil && i < r.fonctions.size(); i++)
    pareil = r.fonctions[i].id == d.fonctions[i].id && r.fonctions[i].distance == d.fonctions[i].distance;
  for (size_t i = 0; pareil && i < r.esquisses.size(); i++)
    pareil = r.esquisses[i].id == d.esquisses[i].id && memesValeurs(r.esquisses[i], d.esquisses[i]);
  if (!pareil) throw std::runtime_error("la relecture du fichier écrit ne redonne pas la même pièce");
}
}  // namespace

namespace {
struct Morceau {
  size_t debut, fin;
  std::string nouveau;
};

// Le tableau courant, élément par élément : f(rang) doit passer la valeur.
template <class F>
void tableau(Parcours& p, F f) {
  p.attendre('[');
  if (p.voir() == ']') {
    p.aller(p.ici() + 1);
    return;
  }
  for (size_t rang = 0;; rang++) {
    p.blancs();
    f(rang);
    const char c = p.voir();
    p.aller(p.ici() + 1);
    if (c == ']') return;
    if (c != ',') Parcours::panne();
  }
}

// Remplace la valeur de chaque membre connu ; insère à l'ouverture de l'objet ceux qu'on a le droit d'ajouter.
struct Champ {
  const char* nom;
  std::string valeur;
  bool ajoutPermis;
  bool vu = false;
};
void retoucherObjet(Parcours& p, std::vector<Champ> champs, std::vector<Morceau>& morceaux) {
  p.blancs();
  const size_t ouverture = p.ici() + 1;
  p.membres([&](const std::string& k) {
    const size_t d = p.ici();
    p.sauter();
    for (Champ& c : champs)
      if (k == c.nom) {
        c.vu = true;
        morceaux.push_back({d, p.ici(), c.valeur});
      }
  });
  for (const Champ& c : champs) {
    if (c.vu) continue;
    if (!c.ajoutPermis) Parcours::panne();
    morceaux.push_back({ouverture, ouverture, std::string("\"") + c.nom + "\":" + c.valeur + ","});
  }
}

std::string entierJson(int v) { return std::to_string(v); }

void retoucherEsquisse(Parcours& p, const RetoucheEsquisse& r, std::vector<Morceau>& morceaux) {
  size_t points = 0;
  p.membres([&](const std::string& k) {
    if (k == "points" && p.voir() == '{') {
      p.membres([&](const std::string& id) {
        const auto it = std::find_if(r.points.begin(), r.points.end(), [&](const RetoucheEsquisse::Point& q) { return q.id == id; });
        if (it == r.points.end()) {
          p.sauter();
          return;
        }
        points++;
        retoucherObjet(p, {{"x", nombreJson(it->x), false}, {"y", nombreJson(it->y), false}}, morceaux);
      });
    } else if (k == "entities" && p.voir() == '[') {
      tableau(p, [&](size_t rang) {
        const auto it = std::find_if(r.elements.begin(), r.elements.end(), [&](const RetoucheEsquisse::Element& q) { return q.rang == rang; });
        if (it == r.elements.end()) {
          p.sauter();
          return;
        }
        std::vector<Champ> champs;
        if (it->aR) champs.push_back({"r", nombreJson(it->r), false});
        if (it->aMid) champs.push_back({"srcMid", "[" + nombreJson(it->mid[0]) + "," + nombreJson(it->mid[1]) + "," + nombreJson(it->mid[2]) + "]", true});
        retoucherObjet(p, champs, morceaux);
      });
    } else if (k == "dims" && p.voir() == '[') {
      tableau(p, [&](size_t rang) {
        const auto it = std::find_if(r.cotes.begin(), r.cotes.end(), [&](const RetoucheEsquisse::Mesure& q) { return q.rang == rang; });
        if (it == r.cotes.end()) {
          p.sauter();
          return;
        }
        std::vector<Champ> champs;
        if (it->aValeur) champs.push_back({"value", nombreJson(it->valeur), false});
        if (it->sgn) champs.push_back({"sgn", entierJson(it->sgn), true});
        if (it->ccw >= 0) champs.push_back({"ccw", entierJson(it->ccw), true});
        retoucherObjet(p, champs, morceaux);
      });
    } else {
      p.sauter();
    }
  });
  if (points != r.points.size()) Parcours::panne();
}
}  // namespace

namespace {
std::string appliquer(const std::string& texte, std::vector<Morceau> morceaux) {
  std::sort(morceaux.begin(), morceaux.end(), [](const Morceau& a, const Morceau& b) { return a.debut < b.debut; });
  std::string out;
  out.reserve(texte.size() + 32 * morceaux.size());
  size_t pos = 0;
  for (const Morceau& m : morceaux) {
    out.append(texte, pos, m.debut - pos);
    out += m.nouveau;
    pos = m.fin;
  }
  out.append(texte, pos, std::string::npos);
  return out;
}

// Même règle qu'à la lecture : un projet avec trajectoires range sa pièce dans « doc »
void allerAuDocument(Parcours& p) {
  size_t posDoc = std::string::npos;
  const size_t racine = p.ici();
  p.membres([&](const std::string& k) {
    if (k == "doc" && p.voir() == '{') posDoc = p.ici();
    p.sauter();
  });
  p.aller(posDoc != std::string::npos ? posDoc : racine);
}

// Une chaîne simple : identifiant ou type. Ce programme n'en crée pas qui demandent un échappement.
std::string texteJson(const std::string& v) {
  for (const char c : v)
    if (c == '"' || c == '\\' || static_cast<unsigned char>(c) < 0x20) Parcours::panne();
  return "\"" + v + "\"";
}
void ajouterTexte(std::string& o, const char* k, const std::string& v) {
  if (!v.empty()) o += std::string(",\"") + k + "\":" + texteJson(v);
}

// Les éléments créés ici, avec les clés et l'ordre du navigateur
std::string nouvelleEntite(const Entite& e) {
  std::string o = "{\"id\":" + texteJson(e.id) + ",\"t\":" + texteJson(e.t);
  ajouterTexte(o, "p1", e.p1);
  ajouterTexte(o, "p2", e.p2);
  ajouterTexte(o, "pc", e.pc);
  ajouterTexte(o, "pa", e.pa);
  ajouterTexte(o, "pb", e.pb);
  ajouterTexte(o, "p", e.p);
  if (e.t == "circle" || e.t == "arc") o += ",\"r\":" + nombreJson(e.r);
  if (e.construction) o += ",\"construction\":true";
  return o + "}";
}
std::string nouvelleContrainte(const Contrainte& c) {
  std::string o = "{\"id\":" + texteJson(c.id) + ",\"type\":" + texteJson(c.type);
  ajouterTexte(o, "p", c.p);
  ajouterTexte(o, "line", c.line);
  ajouterTexte(o, "ent", c.ent);
  ajouterTexte(o, "a", c.a);
  ajouterTexte(o, "b", c.b);
  ajouterTexte(o, "mid", c.mid);
  ajouterTexte(o, "c", c.c);
  ajouterTexte(o, "d", c.d);
  if (c.inf) o += ",\"inf\":true";
  if (c.sa) o += ",\"sa\":" + std::to_string(c.sa);
  if (c.sb) o += ",\"sb\":" + std::to_string(c.sb);
  return o + "}";
}
std::string nouvelleCote(const Cote& d) {
  std::string o = "{\"id\":" + texteJson(d.id) + ",\"type\":" + texteJson(d.type);
  ajouterTexte(o, "line", d.line);
  ajouterTexte(o, "ent", d.ent);
  ajouterTexte(o, "a", d.a);
  ajouterTexte(o, "b", d.b);
  ajouterTexte(o, "p", d.p);
  ajouterTexte(o, "orient", d.orient);
  o += ",\"value\":" + nombreJson(d.value);
  if (d.ox != 0 || d.oy != 0) o += ",\"ox\":" + nombreJson(d.ox) + ",\"oy\":" + nombreJson(d.oy);
  if (d.chk) o += ",\"chk\":1";
  if (d.ref) o += ",\"ref\":true";
  if (d.refV) o += ",\"refV\":" + std::to_string(d.refV);
  if (d.dia) o += ",\"dia\":true";
  if (d.sgn) o += ",\"sgn\":" + std::to_string(d.sgn);
  if (d.ccw >= 0) o += ",\"ccw\":" + std::to_string(d.ccw);
  return o + "}";
}

// Un élément gardé dont un lien a changé (deux points fusionnés) : seul ce champ change dans son texte
struct Ecarts {
  std::vector<Champ> champs;
  void texte(const char* nom, const std::string& a, const std::string& b) {
    if (a == b) return;
    if (a.empty()) throw std::runtime_error("lien d'esquisse effacé, rien n'a été écrit");
    champs.push_back({nom, texteJson(a), true});
  }
  void oui(const char* nom, bool a, bool b) {
    if (a != b) champs.push_back({nom, a ? "true" : "false", true});
  }
};
std::string retoucherBrut(const std::string& brut, const Ecarts& e) {
  if (e.champs.empty()) return brut;
  std::vector<Morceau> m;
  Parcours p(brut);
  retoucherObjet(p, e.champs, m);
  return appliquer(brut, std::move(m));
}
std::string ecartsEntite(const std::string& brut, const Entite& a, const Entite& b) {
  if (a.t != b.t || a.poly != b.poly) throw std::runtime_error("élément d'esquisse changé d'une façon pas encore reprise, rien n'a été écrit");
  Ecarts e;
  e.texte("p1", a.p1, b.p1);
  e.texte("p2", a.p2, b.p2);
  e.texte("pc", a.pc, b.pc);
  e.texte("pa", a.pa, b.pa);
  e.texte("pb", a.pb, b.pb);
  e.texte("p", a.p, b.p);
  e.oui("construction", a.construction, b.construction);
  return retoucherBrut(brut, e);
}
std::string ecartsContrainte(const std::string& brut, const Contrainte& a, const Contrainte& b) {
  if (a.type != b.type) throw std::runtime_error("contrainte changée d'une façon pas encore reprise, rien n'a été écrit");
  Ecarts e;
  e.texte("p", a.p, b.p);
  e.texte("line", a.line, b.line);
  e.texte("ent", a.ent, b.ent);
  e.texte("a", a.a, b.a);
  e.texte("b", a.b, b.b);
  e.texte("mid", a.mid, b.mid);
  e.texte("c", a.c, b.c);
  e.texte("d", a.d, b.d);
  e.oui("inf", a.inf, b.inf);
  return retoucherBrut(brut, e);
}
// skDimsSyncAngles : deux lignes cotées qui ne sont plus parallèles, l'écart devient un angle. Tout le reste du texte de la cote est gardé.
std::string coteDevenueAngle(const std::string& brut, const Cote& a) {
  Parcours q(brut);
  std::string o = "{";
  q.membres([&](const std::string& k) {
    const size_t d = q.ici();
    q.sauter();
    if (k == "orient" || k == "sgn" || k == "sl" || k == "ccw") return;
    const std::string v = k == "type" ? texteJson(a.type) : k == "value" ? nombreJson(a.value) : brut.substr(d, q.ici() - d);
    o += (o.size() > 1 ? "," : "") + texteJson(k) + ":" + v;
  });
  if (a.ccw >= 0) o += ",\"ccw\":" + std::to_string(a.ccw);
  return o + "}";
}
std::string ecartsCote(const std::string& brut, const Cote& a, const Cote& b) {
  if (a.type == "angle" && b.type == "gap") return coteDevenueAngle(brut, a);
  if (a.type != b.type) throw std::runtime_error("cote changée d'une façon pas encore reprise, rien n'a été écrit");
  Ecarts e;
  e.texte("line", a.line, b.line);
  e.texte("ent", a.ent, b.ent);
  e.texte("a", a.a, b.a);
  e.texte("b", a.b, b.b);
  e.texte("p", a.p, b.p);
  if (a.chk != b.chk) e.champs.push_back({"chk", a.chk ? "1" : "0", true});  // le navigateur écrit 1
  e.oui("ref", a.ref, b.ref);
  e.oui("dia", a.dia, b.dia);
  if (a.refV != b.refV) e.champs.push_back({"refV", std::to_string(a.refV), true});
  return retoucherBrut(brut, e);
}

std::string idDe(const std::string& brut) {
  Parcours q(brut);
  std::string id;
  if (q.voir() != '{') Parcours::panne();
  q.membres([&](const std::string& k) {
    if (k == "id" && q.voir() == '"') id = q.chaine();
    else q.sauter();
  });
  if (id.empty()) Parcours::panne();
  return id;
}

// Réécrit un tableau d'éléments : l'ordre de s, le texte d'origine pour ce qui reste, du neuf pour ce qui s'ajoute
template <class T, class Neuf, class Ecart>
std::string refondreTableau(Parcours& p, const std::string& texte, const std::vector<T>& s, const std::vector<T>& f, Neuf neuf, Ecart ecart) {
  std::map<std::string, std::string> bruts;
  tableau(p, [&](size_t) {
    const size_t d = p.ici();
    p.sauter();
    std::string b = texte.substr(d, p.ici() - d);
    if (!bruts.emplace(idDe(b), std::move(b)).second) Parcours::panne();
  });
  // Tout ce qui est dans le fichier a été lu : rien d'inconnu ne doit disparaître
  if (bruts.size() != f.size()) Parcours::panne();
  std::map<std::string, const T*> anciens;
  for (const T& x : f) {
    if (!bruts.count(x.id)) Parcours::panne();
    anciens[x.id] = &x;
  }
  std::string o = "[";
  bool premier = true;
  for (const T& x : s) {
    if (!premier) o += ",";
    premier = false;
    const auto it = anciens.find(x.id);
    o += it == anciens.end() ? neuf(x) : ecart(bruts[x.id], x, *it->second);
  }
  return o + "]";
}

void refondreEsquisse(Parcours& p, const std::string& texte, const Esquisse& s, const Esquisse& f, std::vector<Morceau>& out) {
  p.blancs();
  const size_t ouverture = p.ici() + 1;
  bool vuPts = false, vuE = false, vuC = false, vuD = false, vuSeq = false;
  p.membres([&](const std::string& k) {
    const size_t d = p.ici();
    if (k == "points" && p.voir() == '{') {
      vuPts = true;
      std::map<std::string, std::string> bruts;
      p.membres([&](const std::string& id) {
        const size_t q = p.ici();
        p.sauter();
        bruts[id] = texte.substr(q, p.ici() - q);
      });
      if (bruts.size() != f.ordre.size()) Parcours::panne();
      std::string o = "{";
      for (size_t i = 0; i < s.ordre.size(); i++) {
        const std::string& id = s.ordre[i];
        const auto it = bruts.find(id);
        std::string v;
        if (it != bruts.end()) {
          v = it->second;
        } else {
          const Pt* q = s.point(id);
          if (!q) Parcours::panne();
          v = "{\"x\":" + nombreJson(q->x) + ",\"y\":" + nombreJson(q->y) + "}";
        }
        o += (i ? "," : "") + texteJson(id) + ":" + v;
      }
      out.push_back({d, p.ici(), o + "}"});
    } else if (k == "entities" && p.voir() == '[') {
      vuE = true;
      std::string o = refondreTableau(p, texte, s.entites, f.entites, nouvelleEntite, ecartsEntite);
      out.push_back({d, p.ici(), std::move(o)});
    } else if (k == "constraints" && p.voir() == '[') {
      vuC = true;
      std::string o = refondreTableau(p, texte, s.contraintes, f.contraintes, nouvelleContrainte, ecartsContrainte);
      out.push_back({d, p.ici(), std::move(o)});
    } else if (k == "dims" && p.voir() == '[') {
      vuD = true;
      std::string o = refondreTableau(p, texte, s.cotes, f.cotes, nouvelleCote, ecartsCote);
      out.push_back({d, p.ici(), std::move(o)});
    } else if (k == "seq") {
      vuSeq = true;
      p.sauter();
      out.push_back({d, p.ici(), std::to_string(s.seq)});
    } else {
      p.sauter();
    }
  });
  if (!vuPts) Parcours::panne();
  std::string ajout;
  if (!vuE && !s.entites.empty()) {
    if (!f.entites.empty()) Parcours::panne();
    ajout += "\"entities\":[";
    for (size_t i = 0; i < s.entites.size(); i++) ajout += (i ? "," : "") + nouvelleEntite(s.entites[i]);
    ajout += "],";
  }
  if (!vuC && !s.contraintes.empty()) {
    if (!f.contraintes.empty()) Parcours::panne();
    ajout += "\"constraints\":[";
    for (size_t i = 0; i < s.contraintes.size(); i++) ajout += (i ? "," : "") + nouvelleContrainte(s.contraintes[i]);
    ajout += "],";
  }
  if (!vuD && !s.cotes.empty()) {
    if (!f.cotes.empty()) Parcours::panne();
    ajout += "\"dims\":[";
    for (size_t i = 0; i < s.cotes.size(); i++) ajout += (i ? "," : "") + nouvelleCote(s.cotes[i]);
    ajout += "],";
  }
  if (!vuSeq) ajout += "\"seq\":" + std::to_string(s.seq) + ",";
  if (!ajout.empty()) out.push_back({ouverture, ouverture, std::move(ajout)});
}

struct Refonte {
  size_t rang;
  const Esquisse* s;
  const Esquisse* f;
};
// Première passe : les éléments ajoutés ou retirés. Ce qui reste garde son texte, octet pour octet.
std::string refondre(const std::string& texte, const std::vector<Refonte>& L) {
  Parcours p(texte);
  allerAuDocument(p);
  std::vector<Morceau> morceaux;
  size_t traitees = 0;
  p.membres([&](const std::string& k) {
    if (k != "sketches" || p.voir() != '[') {
      p.sauter();
      return;
    }
    morceaux.clear();
    traitees = 0;
    tableau(p, [&](size_t rang) {
      const auto it = std::find_if(L.begin(), L.end(), [&](const Refonte& r) { return r.rang == rang; });
      if (it == L.end()) {
        p.sauter();
        return;
      }
      traitees++;
      refondreEsquisse(p, texte, *it->s, *it->f, morceaux);
    });
  });
  if (traitees != L.size()) Parcours::panne();
  return appliquer(texte, std::move(morceaux));
}

// Le fichier ramené à la structure de s : les nombres de ce qui existait déjà, ceux de s pour le neuf.
// La seconde passe, celle qui retouche les nombres, part de cette esquisse.
std::string texteVec(const Vec3& v) { return "[" + nombreJson(v[0]) + "," + nombreJson(v[1]) + "," + nombreJson(v[2]) + "]"; }
// L'esquisse telle que newSketch la pose, vide : ce qui y est dessiné s'ajoute ensuite comme dans une esquisse existante
std::string esquisseCreee(const Esquisse& s) {
  std::string o = "{\"id\":" + texteJson(s.id) + ",\"name\":" + texteJson(s.nom) + ",\"plane\":" + texteJson(s.plan);
  o += ",\"entities\":[],\"points\":{},\"constraints\":[],\"dims\":[],\"seq\":1,\"visible\":true,\"origin\":" + texteVec(s.o);
  o += ",\"at\":" + (s.at.empty() ? std::string("null") : texteJson(s.at));
  o += ",\"axU\":" + texteVec(s.u) + ",\"axV\":" + texteVec(s.v) + ",\"axN\":" + texteVec(s.n);
  if (s.plan == "FACE") {
    o += ",\"host\":";
    if (!s.hote.existe) {
      o += "null";
    } else {
      o += "{\"feat\":" + texteJson(s.hote.feat) + ",\"tag\":" + texteJson(s.hote.tag) + ",\"x\":" + nombreJson(s.hote.x) + ",\"y\":" + nombreJson(s.hote.y) + ",\"name\":" + texteJson(s.hote.nom);
      if (s.hote.tag == "SIDE") o += ",\"edge\":" + texteJson(s.hote.edge) + ",\"h\":" + nombreJson(s.hote.h);
      o += "}";
    }
  }
  return o + ",\"rdV\":1}";
}
// Ajoute les esquisses créées à la fin de la liste, et le compteur de noms de faces s'il a servi
std::string ajouterEsquisses(const std::string& texte, const std::vector<const Esquisse*>& L, int nomsFace) {
  Parcours p(texte);
  allerAuDocument(p);
  p.blancs();
  const size_t ouverture = p.ici() + 1;
  std::vector<Morceau> morceaux;
  std::string neuf;
  bool avecNom = false;
  for (const Esquisse* s : L) {
    neuf += (neuf.empty() ? "" : ",") + esquisseCreee(*s);
    avecNom = avecNom || s->hote.existe;
  }
  bool vuListe = false, vuNoms = false;
  p.membres([&](const std::string& k) {
    if (k == "sketches" && p.voir() == '[') {
      vuListe = true;
      const size_t d = p.ici();
      p.aller(d + 1);
      const bool vide = p.voir() == ']';
      p.aller(d);
      p.sauter();
      morceaux.push_back({p.ici() - 1, p.ici() - 1, (vide ? "" : ",") + neuf});
    } else if (k == "entNames" && avecNom) {
      vuNoms = true;
      if (p.voir() == '{') {
        retoucherObjet(p, {{"face", std::to_string(nomsFace), true}}, morceaux);
      } else {
        const size_t d = p.ici();
        p.sauter();
        morceaux.push_back({d, p.ici(), "{\"face\":" + std::to_string(nomsFace) + "}"});
      }
    } else {
      p.sauter();
    }
  });
  if (!vuListe) Parcours::panne();
  if (avecNom && !vuNoms) morceaux.push_back({ouverture, ouverture, "\"entNames\":{\"face\":" + std::to_string(nomsFace) + "},"});
  return appliquer(texte, std::move(morceaux));
}

Esquisse aligner(const Esquisse& s, const Esquisse& f) {
  Esquisse t = s;
  for (const std::string& id : t.ordre)
    if (const Pt* q = f.point(id)) t.points[id] = *q;
  for (Entite& e : t.entites)
    if (const Entite* o = f.entite(e.id)) {
      e.r = o->r;
      e.srcMid = o->srcMid;
    }
  for (Cote& c : t.cotes)
    for (const Cote& o : f.cotes)
      if (o.id == c.id) {
        if (o.type != c.type) break;  // réécrite en entier par la refonte : rien à retoucher ensuite
        c.value = o.value;
        c.sgn = o.sgn;
        c.ccw = o.ccw;
        break;
      }
  return t;
}
}  // namespace

std::string retoucher(const std::string& texte, const std::vector<Retouche>& retouches, const std::vector<RetoucheEsquisse>& esquisses) {
  std::vector<Morceau> morceaux, deEsquisses;
  const auto lireFonctions = [&](Parcours& p) {
    p.attendre('[');
    size_t rang = 0;
    if (p.voir() == ']') {  // pièce sans fonction, seulement des esquisses
      p.aller(p.ici() + 1);
      return;
    }
    for (;;) {
      const auto it = std::find_if(retouches.begin(), retouches.end(), [&](const Retouche& r) { return r.fonction == rang; });
      if (it == retouches.end()) {
        p.sauter();
      } else {
        // S'il y a plusieurs « distance » dans l'objet, la dernière compte, comme à la lecture
        bool trouve = false;
        size_t debut = 0, fin = 0;
        p.blancs();
        const size_t ouverture = p.ici() + 1;
        p.membres([&](const std::string& k) {
          const size_t d = p.ici();
          p.sauter();
          if (k == "distance") {
            trouve = true;
            debut = d;
            fin = p.ici();
          }
        });
        if (trouve) morceaux.push_back({debut, fin, nombreJson(it->distance)});
        else morceaux.push_back({ouverture, ouverture, "\"distance\":" + nombreJson(it->distance) + ","});
      }
      rang++;
      const char c = p.voir();
      p.aller(p.ici() + 1);
      if (c == ']') break;
      if (c != ',') Parcours::panne();
    }
  };
  const auto lireDocument = [&](Parcours& p) {
    bool vu = false;
    p.membres([&](const std::string& k) {
      if (k == "features" && p.voir() == '[') {
        morceaux.clear();
        lireFonctions(p);
        vu = true;
      } else if (k == "sketches" && p.voir() == '[' && !esquisses.empty()) {
        deEsquisses.clear();
        size_t traitees = 0;
        tableau(p, [&](size_t rang) {
          const auto it = std::find_if(esquisses.begin(), esquisses.end(), [&](const RetoucheEsquisse& r) { return r.esquisse == rang; });
          if (it == esquisses.end()) {
            p.sauter();
            return;
          }
          traitees++;
          retoucherEsquisse(p, *it, deEsquisses);
        });
        if (traitees != esquisses.size()) Parcours::panne();
      } else {
        p.sauter();
      }
    });
    if (!vu) Parcours::panne();
  };

  Parcours p(texte);
  allerAuDocument(p);
  lireDocument(p);
  if (morceaux.size() != retouches.size() || (deEsquisses.empty() && !esquisses.empty())) Parcours::panne();
  morceaux.insert(morceaux.end(), deEsquisses.begin(), deEsquisses.end());
  return appliquer(texte, std::move(morceaux));
}

std::string texteEnregistre(const Document& d, const std::string& texteOrigine) {
  // Les esquisses créées sont d'abord écrites vides : la suite les traite comme des esquisses du fichier
  if (d.esquisses.size() < d.esquissesFichier.size()) throw std::runtime_error("esquisse retirée d'une façon pas encore reprise, rien n'a été écrit");
  std::vector<Esquisse> fichiers = d.esquissesFichier;
  std::string texteFichier = texteOrigine;
  if (d.esquisses.size() > fichiers.size()) {
    std::vector<const Esquisse*> nouvelles;
    for (size_t i = fichiers.size(); i < d.esquisses.size(); i++) nouvelles.push_back(&d.esquisses[i]);
    texteFichier = ajouterEsquisses(texteOrigine, nouvelles, d.nomsFace);
    for (const Esquisse* s : nouvelles) {
      Esquisse f = *s;
      f.ordre.clear();
      f.points.clear();
      f.entites.clear();
      f.contraintes.clear();
      f.cotes.clear();
      f.seq = 1;
      fichiers.push_back(std::move(f));
    }
  }
  std::vector<Retouche> retouches;
  for (size_t i = 0; i < d.fonctions.size(); i++)
    if (d.fonctions[i].distance != d.fonctions[i].distanceFichier) retouches.push_back({i, d.fonctions[i].distance});

  std::vector<Refonte> refontes;
  std::vector<Esquisse> alignees;  // n'est lue que par rang, et réservée : les adresses restent justes
  alignees.reserve(d.esquisses.size());
  for (size_t i = 0; i < d.esquisses.size(); i++)
    alignees.push_back(memesLiens(d.esquisses[i], fichiers[i]) ? fichiers[i] : aligner(d.esquisses[i], fichiers[i]));
  for (size_t i = 0; i < d.esquisses.size(); i++)
    if (!memesLiens(d.esquisses[i], fichiers[i])) refontes.push_back({i, &d.esquisses[i], &fichiers[i]});

  std::vector<RetoucheEsquisse> esquisses;
  for (size_t i = 0; i < d.esquisses.size(); i++) {
    const Esquisse& s = d.esquisses[i];
    const Esquisse& f = alignees[i];
    if (memesValeurs(s, f)) continue;
    RetoucheEsquisse r;
    r.esquisse = i;
    for (const std::string& id : s.ordre) {
      const Pt* a = s.point(id);
      const Pt* b = f.point(id);
      if (a->x != b->x || a->y != b->y) r.points.push_back({id, a->x, a->y});
    }
    for (size_t k = 0; k < s.entites.size(); k++) {
      const bool aR = s.entites[k].r != f.entites[k].r, aMid = s.entites[k].srcMid != f.entites[k].srcMid;
      if (aR || aMid) r.elements.push_back({k, aR, s.entites[k].r, aMid, s.entites[k].srcMid});
    }
    for (size_t k = 0; k < s.cotes.size(); k++) {
      const Cote& a = s.cotes[k];
      const Cote& b = f.cotes[k];
      const bool aV = a.value != b.value;
      const int sgn = a.sgn != b.sgn ? a.sgn : 0, ccw = a.ccw != b.ccw ? a.ccw : -1;
      if (a.sgn != b.sgn && !a.sgn) throw std::runtime_error("côté de cote effacé, rien n'a été écrit");
      if (a.ccw != b.ccw && a.ccw < 0) throw std::runtime_error("sens de cote effacé, rien n'a été écrit");
      if (aV || sgn || ccw >= 0) r.cotes.push_back({k, aV, a.value, sgn, ccw});
    }
    esquisses.push_back(std::move(r));
  }
  if (retouches.empty() && esquisses.empty() && refontes.empty()) return texteFichier;
  return retoucher(refontes.empty() ? texteFichier : refondre(texteFichier, refontes), retouches, esquisses);
}

void enregistrerProjet(Document& d, const std::wstring& cible, bool forcer) {
  std::string octets = d.octets;
  if (d.modifie()) {
    const std::string texte = texteEnregistre(d, d.compresse ? degonfler(d.octets) : d.octets);
    octets = d.compresse ? gonfler(texte) : texte;
    if (d.compresse && degonfler(octets) != texte) throw std::runtime_error("la compression ne redonne pas le même texte, rien n'a été écrit");
  }

  // Plus rien à faire si le disque contient déjà exactement cela
  const bool cibleExiste = existe(cible);
  const std::string surDisque = cibleExiste ? lireOctets(cible) : std::string();
  if (!forcer && cibleExiste && _wcsicmp(cible.c_str(), d.chemin.c_str()) == 0 && surDisque != d.octets) throw FichierChangeAilleurs();

  if (!cibleExiste || surDisque != octets) {
    const std::wstring temp = cible + L".tmp" + std::to_wstring(GetCurrentProcessId());
    ecrireFichier(temp, octets);
    try {
      controler(temp, octets, d);
      if (cibleExiste) ecrireFichier(cible + L".bak", surDisque);  // même nom que la copie de secours du navigateur
      // Remplacement d'un seul coup ; un antivirus ou Dropbox peut tenir le fichier un court instant
      bool remplace = false;
      for (int essai = 0; essai < 5 && !remplace; essai++) {
        remplace = MoveFileExW(temp.c_str(), cible.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != 0;
        if (!remplace) Sleep(200);
      }
      if (!remplace) throw std::runtime_error("le fichier est protégé ou ouvert par un autre programme");
    } catch (...) {
      _wremove(temp.c_str());
      throw;
    }
  }

  d.octets = std::move(octets);
  d.chemin = cible;
  for (Fonction& f : d.fonctions) f.distanceFichier = f.distance;
  d.esquissesFichier = d.esquisses;
}
