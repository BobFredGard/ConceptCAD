#include "enregistrer.h"

#include <windows.h>
#include <io.h>
#include <zlib.h>

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>

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

std::string retoucher(const std::string& texte, const std::vector<Retouche>& retouches, const std::vector<RetoucheEsquisse>& esquisses) {
  std::vector<Morceau> morceaux, deEsquisses;
  const auto lireFonctions = [&](Parcours& p) {
    p.attendre('[');
    size_t rang = 0;
    if (p.voir() == ']') return;
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

  // Même règle qu'à la lecture : un projet avec trajectoires range sa pièce dans « doc »
  Parcours p(texte);
  size_t posDoc = std::string::npos;
  const size_t racine = p.ici();
  p.membres([&](const std::string& k) {
    if (k == "doc" && p.voir() == '{') posDoc = p.ici();
    p.sauter();
  });
  p.aller(posDoc != std::string::npos ? posDoc : racine);
  lireDocument(p);
  if (morceaux.size() != retouches.size() || (deEsquisses.empty() && !esquisses.empty())) Parcours::panne();
  morceaux.insert(morceaux.end(), deEsquisses.begin(), deEsquisses.end());

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

void enregistrerProjet(Document& d, const std::wstring& cible, bool forcer) {
  std::vector<Retouche> retouches;
  for (size_t i = 0; i < d.fonctions.size(); i++)
    if (d.fonctions[i].distance != d.fonctions[i].distanceFichier) retouches.push_back({i, d.fonctions[i].distance});

  std::vector<RetoucheEsquisse> esquisses;
  for (size_t i = 0; i < d.esquisses.size(); i++) {
    const Esquisse& s = d.esquisses[i];
    const Esquisse& f = d.esquissesFichier[i];
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

  std::string octets = d.octets;
  if (!retouches.empty() || !esquisses.empty()) {
    const std::string texte = retoucher(d.compresse ? degonfler(d.octets) : d.octets, retouches, esquisses);
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
