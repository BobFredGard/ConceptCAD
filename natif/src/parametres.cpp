#include "configurations.h"
#include "parametres.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <limits>
#include <map>
#include <set>
#include <stdexcept>
#include <unordered_map>

#include "maths_js.h"

namespace {
const double PI = 3.14159265358979323846;
const double NaN = std::numeric_limits<double>::quiet_NaN();

bool blanc(unsigned char c) { return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v'; }
bool chiffre(char c) { return c >= '0' && c <= '9'; }
bool lettre(char c) { return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '_'; }
bool motCar(char c) { return lettre(c) || chiffre(c); }
std::string enMinuscules(std::string s) {
  for (char& c : s)
    if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
  return s;
}
// JS trim, avec l'espace insécable
std::string sansBlancs(const std::string& s) {
  size_t a = 0, b = s.size();
  for (;;) {
    if (a < b && blanc(s[a])) a++;
    else if (a + 1 < b && static_cast<unsigned char>(s[a]) == 0xC2 && static_cast<unsigned char>(s[a + 1]) == 0xA0) a += 2;
    else break;
  }
  for (;;) {
    if (b > a && blanc(s[b - 1])) b--;
    else if (b > a + 1 && static_cast<unsigned char>(s[b - 1]) == 0xA0 && static_cast<unsigned char>(s[b - 2]) == 0xC2) b -= 2;
    else break;
  }
  return s.substr(a, b - a);
}
bool commenceSansCasse(const std::string& s, size_t i, const char* m) {
  for (; *m; m++, i++) {
    if (i >= s.size()) return false;
    char c = s[i];
    if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
    if (c != *m) return false;
  }
  return true;
}
// .replace(/\s*(mm|°|deg)\s*$/i,'')
std::string sansUniteFinale(const std::string& s) {
  size_t b = s.size();
  while (b > 0 && blanc(s[b - 1])) b--;
  size_t a = std::string::npos;
  if (b >= 2 && commenceSansCasse(s, b - 2, "mm")) a = b - 2;
  else if (b >= 2 && static_cast<unsigned char>(s[b - 2]) == 0xC2 && static_cast<unsigned char>(s[b - 1]) == 0xB0) a = b - 2;
  else if (b >= 3 && commenceSansCasse(s, b - 3, "deg")) a = b - 3;
  if (a == std::string::npos) return s;
  while (a > 0 && blanc(s[a - 1])) a--;
  return s.substr(0, a);
}
std::string uneLettre(const std::string& s, size_t i) {
  size_t n = 1;
  const unsigned char c = static_cast<unsigned char>(s[i]);
  if (c >= 0xF0) n = 4;
  else if (c >= 0xE0) n = 3;
  else if (c >= 0xC0) n = 2;
  return s.substr(i, n);
}
double rondJs(double x) {  // Math.round
  const double f = std::floor(x);
  return x - f >= 0.5 ? f + 1 : f;
}
double parPas(double (*f)(double), double x, double p, bool aP) {
  p = std::abs(aP ? p : 1);
  if (!(p > 0)) throw std::runtime_error("pas d’arrondi nul");
  const double q = x / p, r = rondJs(q);
  return (std::abs(q - r) < 1e-9 ? r : f(q)) * p;
}
double plancher(double x) { return std::floor(x); }
double plafond(double x) { return std::ceil(x); }

const char* const FONCTIONS[] = {"sqrt", "abs", "min", "max", "floor", "ceil", "round", "roundmoins", "roundplus", "and", "or", "not", "sin", "cos", "tan", "asin", "acos", "atan"};
bool estFonction(const std::string& n) {
  return std::any_of(std::begin(FONCTIONS), std::end(FONCTIONS), [&](const char* f) { return n == f; });
}
double appeler(const std::string& f, const std::vector<double>& a) {
  const double x = a.empty() ? NaN : a[0];
  const bool aP = a.size() > 1;
  const double p = aP ? a[1] : 0;
  if (f == "sqrt") return std::sqrt(x);
  if (f == "abs") return std::abs(x);
  if (f == "min" || f == "max") {
    double v = f == "min" ? std::numeric_limits<double>::infinity() : -std::numeric_limits<double>::infinity();
    for (const double y : a) v = f == "min" ? jsmin(v, y) : jsmax(v, y);
    return v;
  }
  if (f == "floor") return std::floor(x);
  if (f == "ceil") return std::ceil(x);
  if (f == "round") return parPas(rondJs, x, p, aP);
  if (f == "roundmoins") return parPas(plancher, x, p, aP);
  if (f == "roundplus") return parPas(plafond, x, p, aP);
  const auto vrai = [](double y) { return y != 0 && !std::isnan(y); };
  if (f == "and") return std::all_of(a.begin(), a.end(), vrai) ? 1 : 0;
  if (f == "or") return std::any_of(a.begin(), a.end(), vrai) ? 1 : 0;
  if (f == "not") return vrai(x) ? 0 : 1;
  if (f == "sin") return m_sin(x * PI / 180);
  if (f == "cos") return m_cos(x * PI / 180);
  if (f == "tan") return std::tan(x * PI / 180);
  if (f == "asin") return std::asin(x) * 180 / PI;
  if (f == "acos") return std::acos(x) * 180 / PI;
  if (f == "atan") return std::atan(x) * 180 / PI;
  return NaN;
}

// La descente récursive de parEval, dans le même ordre
struct Lecture {
  std::string s;
  const std::function<double(const std::string&)>& chercher;
  size_t i = 0;
  int sec = 0;  // > 0 : branche non retenue d'un if, lue sans erreur de calcul

  [[noreturn]] static void err(const std::string& m) { throw std::runtime_error(m); }
  void sp() {
    while (i < s.size() && blanc(s[i])) i++;
  }
  char ici() const { return i < s.size() ? s[i] : '\0'; }
  double comparer() {
    double v = somme();
    for (;;) {
      sp();
      const std::string o = operateur();
      if (o.empty()) return v;
      i += o.size();
      const double w = somme();
      const bool b = o == "<" ? v < w : o == ">" ? v > w : o == "<=" ? v <= w + 1e-9 : o == ">=" ? v >= w - 1e-9 : (o == "==" || o == "=") ? std::abs(v - w) < 1e-9 : std::abs(v - w) >= 1e-9;
      v = b ? 1 : 0;
    }
  }
  std::string operateur() const {
    if (i >= s.size()) return "";
    const char a = s[i], b = i + 1 < s.size() ? s[i + 1] : '\0';
    if (a == '<' && b == '=') return "<=";
    if (a == '>' && b == '=') return ">=";
    if (a == '=' && b == '=') return "==";
    if (a == '!' && b == '=') return "!=";
    if (a == '<' && b == '>') return "<>";
    if (a == '<') return "<";
    if (a == '>') return ">";
    if (a == '=') return "=";
    return "";
  }
  double somme() {
    double v = terme();
    for (;;) {
      sp();
      const char c = ici();
      if (c == '+') {
        i++;
        v += terme();
      } else if (c == '-') {
        i++;
        v -= terme();
      } else {
        return v;
      }
    }
  }
  double terme() {
    double v = unaire();
    for (;;) {
      sp();
      const char c = ici();
      if (c == '*') {
        i++;
        v *= unaire();
      } else if (c == '/') {
        i++;
        const double d = unaire();
        if (d == 0) {
          if (sec) {
            v = 0;
            continue;
          }
          err("division par zéro");
        }
        v /= d;
      } else {
        return v;
      }
    }
  }
  double unaire() {
    sp();
    if (ici() == '-') {
      i++;
      return -unaire();
    }
    if (ici() == '+') {
      i++;
      return unaire();
    }
    return puissance();
  }
  double puissance() {
    const double b = atome();
    sp();
    if (ici() == '^') {
      i++;
      return std::pow(b, unaire());
    }
    return b;
  }
  // /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/ : la longueur, 0 si ce n'est pas un nombre
  size_t longueurNombre() const {
    size_t j = i;
    if (j < s.size() && chiffre(s[j])) {
      while (j < s.size() && chiffre(s[j])) j++;
      if (j < s.size() && s[j] == '.') j++;
      while (j < s.size() && chiffre(s[j])) j++;
    } else if (j + 1 < s.size() && s[j] == '.' && chiffre(s[j + 1])) {
      j++;
      while (j < s.size() && chiffre(s[j])) j++;
    } else {
      return 0;
    }
    if (j < s.size() && (s[j] == 'e' || s[j] == 'E')) {
      size_t k = j + 1;
      if (k < s.size() && (s[k] == '+' || s[k] == '-')) k++;
      if (k < s.size() && chiffre(s[k])) {
        while (k < s.size() && chiffre(s[k])) k++;
        j = k;
      }
    }
    return j - i;
  }
  // L'unité collée au nombre, mm, cm, m, in, ", °, deg, rad
  void unite(double& v) {
    size_t j = i;
    while (j < s.size() && blanc(s[j])) j++;
    static const struct {
      const char* t;
      double k;
    } U[] = {{"mm", 1}, {"cm", 10}, {"m", 1000}, {"in", 25.4}, {"\"", 25.4}, {"\xC2\xB0", 1}, {"deg", 1}, {"rad", 180 / PI}};
    for (const auto& u : U) {
      const size_t n = strlen_(u.t);
      if (s.compare(j, n, u.t) != 0) continue;
      if (j + n < s.size() && motCar(s[j + n])) continue;
      i = j + n;
      v *= u.k;
      return;
    }
  }
  static size_t strlen_(const char* t) {
    size_t n = 0;
    while (t[n]) n++;
    return n;
  }
  bool separateur() const { return ici() == ';' || ici() == ','; }
  double atome() {
    sp();
    const char c = ici();
    if (c == '(') {
      i++;
      const double v = comparer();
      sp();
      if (ici() != ')') err("« ) » manquante");
      i++;
      return v;
    }
    if (const size_t n = longueurNombre()) {
      double v = strtod(s.substr(i, n).c_str(), nullptr);
      i += n;
      unite(v);
      return v;
    }
    if (i < s.size() && lettre(c)) {
      size_t j = i;
      while (j < s.size() && motCar(s[j])) j++;
      const std::string nm = s.substr(i, j - i);
      i = j;
      sp();
      if (ici() == '(') {
        const std::string ln = enMinuscules(nm);
        if (ln == "if" || ln == "si") {
          i++;
          const double t = comparer();
          sp();
          if (!separateur()) err("if(test ; alors ; sinon) : « ; » manquant");
          i++;
          if (t == 0) sec++;
          const double a = comparer();
          if (t == 0) sec--;
          sp();
          if (!separateur()) err("if(test ; alors ; sinon) : « sinon » manquant");
          i++;
          if (t != 0) sec++;
          const double b = comparer();
          if (t != 0) sec--;
          sp();
          if (ici() != ')') err("« ) » manquante");
          i++;
          return t != 0 ? a : b;
        }
        if (!estFonction(ln)) err("fonction inconnue « " + nm + " »");
        i++;
        std::vector<double> args;
        sp();
        if (ici() != ')') {
          for (;;) {
            args.push_back(comparer());
            sp();
            if (separateur()) {
              i++;
              continue;
            }
            break;
          }
        }
        sp();
        if (ici() != ')') err("« ) » manquante");
        i++;
        if (sec) {
          try {
            return appeler(ln, args);
          } catch (const std::exception&) {
            return 0;
          }
        }
        return appeler(ln, args);
      }
      if (nm == "pi" || nm == "PI") return PI;
      if (sec) {
        try {
          return chercher(nm);
        } catch (const std::exception&) {
          return 0;
        }
      }
      return chercher(nm);
    }
    if (i >= s.size()) err("expression incomplète");
    err("caractère inattendu « " + uneLettre(s, i) + " »");
  }
};

// « nom = » au début d'une saisie : /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*(.*)$/
bool separerNom(const std::string& s, std::string& nom, std::string& reste) {
  if (s.empty() || !lettre(s[0])) return false;
  size_t i = 0;
  while (i < s.size() && motCar(s[i])) i++;
  size_t j = i;
  while (j < s.size() && blanc(s[j])) j++;
  if (j >= s.size() || s[j] != '=' || (j + 1 < s.size() && s[j + 1] == '=')) return false;
  nom = s.substr(0, i);
  j++;
  while (j < s.size() && blanc(s[j])) j++;
  reste = s.substr(j);
  return true;
}

bool sansTexte(const std::string& s) { return s.find_first_not_of(" \t\r\n") == std::string::npos; }

struct Entree {
  enum Sorte { DERIVE, PARAM, COTE, PORTEUR } sorte = PARAM;
  const ParamDerive* derive = nullptr;
  Parametre* param = nullptr;
  Cote* cote = nullptr;
  PorteurFx* porteur = nullptr;
};
// parAll : du moins prioritaire au plus prioritaire
std::unordered_map<std::string, Entree> tousLesNoms(const Document& dc) {
  Document& d = const_cast<Document&>(dc);  // le recueil ne change rien ; parResoudre écrit à travers lui
  std::unordered_map<std::string, Entree> m;
  for (const ParamDerive& p : d.derives)
    if (!p.nom.empty()) {
      Entree e;
      e.sorte = Entree::DERIVE;
      e.derive = &p;
      m[p.nom] = e;
    }
  for (Parametre& p : d.params)
    if (!p.nom.empty()) {
      Entree e;
      e.sorte = Entree::PARAM;
      e.param = &p;
      m[p.nom] = e;
    }
  for (Esquisse& s : d.esquisses)
    for (Cote& c : s.cotes)
      if (!c.nom.empty()) {
        Entree e;
        e.sorte = Entree::COTE;
        e.cote = &c;
        m[c.nom] = e;
      }
  for (PorteurFx& h : d.porteurs)
    if (!h.nom.empty()) {
      Entree e;
      e.sorte = Entree::PORTEUR;
      e.porteur = &h;
      m[h.nom] = e;
    }
  return m;
}
// parHolderSet : true si la valeur change. La quantité est arrondie, la distance garde son sens.
bool poserPorteur(PorteurFx& h, double v) {
  if (h.cle == "qty" || h.cle == "qty2") {
    const double n = rondJs(v);
    if (!(n >= 2)) throw std::runtime_error("quantité < 2 (" + nombreJsFixe(v, 4) + ")");
    if (h.valeur != n) {
      h.valeur = n;
      return true;
    }
    return false;
  }
  if (std::abs(h.valeur - v) > 1e-9) {
    h.valeur = h.cle == "distance" ? std::abs(v) : v;
    return true;
  }
  return false;
}
}  // namespace

std::string nombreJs(double v) {
  if (std::isnan(v)) return "NaN";
  if (std::isinf(v)) return v > 0 ? "Infinity" : "-Infinity";
  if (v == 0) return "0";
  char b[400];
  const double a = std::abs(v);
  const auto r = a >= 1e21 || a < 1e-6 ? std::to_chars(b, b + sizeof b, v, std::chars_format::scientific) : std::to_chars(b, b + sizeof b, v, std::chars_format::fixed);
  std::string t(b, r.ptr);
  // 1e+21 et 1e-7 comme JavaScript : pas de zéro devant l'exposant
  const size_t e = t.find('e');
  if (e != std::string::npos && e + 2 < t.size() && t[e + 2] == '0') t.erase(e + 2, 1);
  return t;
}
std::string nombreJsFixe(double v, int chiffres) {
  // v.toFixed(n) : en cas d'égalité parfaite, le plus grand
  char b[512];
  snprintf(b, sizeof b, "%.*f", chiffres + 60, std::abs(v));
  std::string t(b);
  const size_t coupe = t.size() - 60;
  const bool plus = t[coupe] >= '5';
  t.resize(coupe);
  if (plus) {
    size_t i = t.size();
    for (;;) {
      if (i == 0) {
        t.insert(0, 1, '1');
        break;
      }
      i--;
      if (t[i] == '.') continue;
      if (t[i] == '9') {
        t[i] = '0';
        continue;
      }
      t[i]++;
      break;
    }
  }
  const double x = strtod(t.c_str(), nullptr);
  return nombreJs(v < 0 ? -x : x);
}

double parEval(const std::string& source, const std::function<double(const std::string&)>& lookup) {
  std::string s = sansBlancs(source);
  // .replace(/(\d),(\d)/g,'$1.$2')
  for (size_t i = 1; i + 1 < s.size(); i++)
    if (s[i] == ',' && chiffre(s[i - 1]) && chiffre(s[i + 1])) {
      s[i] = '.';
      i += 2;  // l'expression régulière a consommé le chiffre suivant : « 1,2,3 » devient « 1.2,3 »
    }
  s = sansUniteFinale(s);
  Lecture L{s, lookup};
  if (s.empty()) Lecture::err("expression vide");
  const double v = L.comparer();
  L.sp();
  if (L.i < s.size()) Lecture::err("caractère inattendu « " + uneLettre(s, L.i) + " »");
  if (!std::isfinite(v)) Lecture::err("résultat non fini");
  return v;
}

bool parEstNombre(const std::string& t0) {
  // /^\s*[+-]?(\d+([.,]\d*)?|[.,]\d+)\s*$/
  const std::string t = sansBlancs(t0);
  size_t i = 0;
  if (i < t.size() && (t[i] == '+' || t[i] == '-')) i++;
  if (i >= t.size()) return false;
  if (chiffre(t[i])) {
    while (i < t.size() && chiffre(t[i])) i++;
    if (i < t.size() && (t[i] == '.' || t[i] == ',')) {
      i++;
      while (i < t.size() && chiffre(t[i])) i++;
    }
  } else if ((t[i] == '.' || t[i] == ',') && i + 1 < t.size() && chiffre(t[i + 1])) {
    i++;
    while (i < t.size() && chiffre(t[i])) i++;
  } else {
    return false;
  }
  return i == t.size();
}
double parDimUser(const Cote& c) { return c.type == "angle" ? c.value * 180 / PI : (c.dia ? 2 * c.value : c.value); }
double parDimFromUser(const Cote& c, double f) { return c.type == "angle" ? f * PI / 180 : (c.dia ? f / 2 : f); }
std::string parTexteSaisie(const Cote& c) {
  const std::string base = c.type == "angle" ? nombreJsFixe(c.value * 180 / PI, 2) : nombreJsFixe(c.dia ? 2 * c.value : c.value, 4);
  const std::string droite = !sansTexte(c.expr) ? c.expr : base;
  return (c.nom.empty() ? "" : c.nom + " = ") + droite;
}

void parResoudre(Document& d) {
  const auto m = tousLesNoms(d);
  std::unordered_map<std::string, double> val;
  std::set<std::string> occupes;
  std::function<double(const std::string&)> get = [&](const std::string& nm) -> double {
    const auto dv = val.find(nm);
    if (dv != val.end()) return dv->second;
    const auto it = m.find(nm);
    if (it == m.end()) throw std::runtime_error("« " + nm + " » inconnu");
    const Entree& e = it->second;
    if (e.sorte == Entree::DERIVE) {
      const double v = e.derive->value;
      if (!std::isfinite(v)) throw std::runtime_error("« " + nm + " » sans valeur");
      val[nm] = v;
      return v;
    }
    if (occupes.count(nm)) throw std::runtime_error("référence circulaire (« " + nm + " »)");
    occupes.insert(nm);
    double v;
    try {
      const std::string ex = e.sorte == Entree::PARAM ? e.param->expr : e.sorte == Entree::PORTEUR ? e.porteur->expr : e.cote->expr;
      if (!sansTexte(ex)) v = parEval(ex, get);
      else v = e.sorte == Entree::PARAM ? (e.param->aValeur ? e.param->value : NaN) : e.sorte == Entree::PORTEUR ? e.porteur->valeur : parDimUser(*e.cote);
    } catch (...) {
      occupes.erase(nm);
      throw;
    }
    occupes.erase(nm);
    if (!std::isfinite(v)) throw std::runtime_error("« " + nm + " » sans valeur");
    val[nm] = v;
    return v;
  };
  for (Parametre& p : d.params) {
    try {
      p.value = !p.nom.empty() ? get(p.nom) : parEval(p.expr, get);
      p.aValeur = true;
      p.err.clear();
    } catch (const std::exception& e) {
      p.err = e.what();
    }
  }
  for (size_t i = 0; i < d.esquisses.size(); i++) {
    for (Cote& c : d.esquisses[i].cotes) {
      if (c.ref || sansTexte(c.expr)) continue;
      try {
        const double v = !c.nom.empty() ? get(c.nom) : parEval(c.expr, get);
        if (!(v > 0) || (c.type == "angle" && v >= 180)) throw std::runtime_error("valeur hors domaine (" + nombreJsFixe(v, 4) + ")");
        const double nv = parDimFromUser(c, v);
        if (std::abs(nv - c.value) > 1e-9) {
          c.value = nv;
          if (std::find(d.parEnAttente.begin(), d.parEnAttente.end(), i) == d.parEnAttente.end()) d.parEnAttente.push_back(i);
        }
        c.exprErr.clear();
        c.formuleFausse = false;
      } catch (const std::exception& e) {
        c.exprErr = e.what();
        c.formuleFausse = true;
      }
    }
  }
  for (PorteurFx& h : d.porteurs) {
    if (sansTexte(h.expr)) continue;
    try {
      const double v = !h.nom.empty() ? get(h.nom) : parEval(h.expr, get);
      if (!std::isfinite(v)) throw std::runtime_error("valeur non finie");
      if (poserPorteur(h, v)) h.change = true;
      h.err.clear();
    } catch (const std::exception& e) {
      h.err = e.what();
    }
  }
}

double parValeurNom(const Document& d, const std::string& nom) {
  const auto m = tousLesNoms(d);
  const auto it = m.find(nom);
  if (it == m.end()) throw std::runtime_error("« " + nom + " » inconnu");
  const Entree& e = it->second;
  if (e.sorte == Entree::DERIVE) return e.derive->value;
  if (e.sorte == Entree::PARAM) {
    if (e.param->aValeur && std::isfinite(e.param->value)) return e.param->value;
    return parEval(e.param->expr, [&](const std::string& n) { return parValeurNom(d, n); });
  }
  return e.sorte == Entree::PORTEUR ? e.porteur->valeur : parDimUser(*e.cote);
}

std::string parControleNom(const Document& d, const std::string& nm, const Cote* cote, const Parametre* param, const PorteurFx* porteur) {
  bool bon = !nm.empty() && lettre(nm[0]);
  for (const char c : nm) bon = bon && motCar(c);
  if (!bon) return "Nom invalide « " + nm + " » : lettres, chiffres, _ (sans espace ni accent, pas de chiffre en tête).";
  if (estFonction(nm) || nm == "pi" || nm == "PI") return "« " + nm + " » est réservé (fonction / constante).";
  const auto m = tousLesNoms(d);
  const auto it = m.find(nm);
  if (it != m.end()) {
    const Entree& e = it->second;
    const bool lui = (e.sorte == Entree::COTE && e.cote == cote) || (e.sorte == Entree::PARAM && e.param == param) || (e.sorte == Entree::PORTEUR && e.porteur == porteur);
    if (!lui) return "Le nom « " + nm + " » est déjà utilisé.";
  }
  return "";
}

void parRenommer(Document& d, const std::string& ancien, const std::string& nouveau) {
  if (ancien.empty() || nouveau.empty() || ancien == nouveau) return;
  const auto dans = [&](std::string& t) {
    std::string o;
    for (size_t i = 0; i < t.size();) {
      const bool debut = i == 0 || !motCar(t[i - 1]);
      if (debut && t.compare(i, ancien.size(), ancien) == 0 && (i + ancien.size() >= t.size() || !motCar(t[i + ancien.size()]))) {
        o += nouveau;
        i += ancien.size();
      } else {
        o += t[i++];
      }
    }
    t = std::move(o);
  };
  for (Parametre& p : d.params) dans(p.expr);
  for (Esquisse& s : d.esquisses)
    for (Cote& c : s.cotes) dans(c.expr);
  for (PorteurFx& h : d.porteurs) dans(h.expr);
  cfgRenommerColonne(d, ancien, nouveau);
}

SaisieCote parValiderCote(Document& d, Cote& c, const std::string& texte) {
  SaisieCote r;
  const std::string s = sansBlancs(texte);
  std::string nom, reste;
  const bool nomme = separerNom(s, nom, reste);
  std::string expr = sansBlancs(nomme ? reste : s);
  // « Ø20 », « R5 », « ∠45 » acceptés tels qu'affichés : /^[ØøR∠]\s*(?=[\d.,(-])/
  for (const char* const sym : {"\xC3\x98", "\xC3\xB8", "R", "\xE2\x88\xA0"}) {
    const std::string y(sym);
    if (expr.compare(0, y.size(), y) != 0) continue;
    size_t j = y.size();
    while (j < expr.size() && blanc(expr[j])) j++;
    if (j < expr.size() && (chiffre(expr[j]) || expr[j] == '.' || expr[j] == ',' || expr[j] == '(' || expr[j] == '-')) expr = expr.substr(j);
    break;
  }
  if (expr.empty()) {
    r.message = "Valeur vide.";
    return r;
  }
  if (nomme) {
    const std::string ok = parControleNom(d, nom, &c, nullptr, nullptr);
    if (!ok.empty()) {
      r.message = ok;
      return r;
    }
  }
  const std::string ancienNom = c.nom, ancienneExpr = c.expr;
  const double ancienne = c.value;
  const auto restaurer = [&]() {
    if (nomme && !ancienNom.empty() && nom != ancienNom) parRenommer(d, nom, ancienNom);
    c.nom = ancienNom;
    c.expr = ancienneExpr;
    c.formule = !sansTexte(c.expr);
    c.value = ancienne;
    c.exprErr.clear();
    c.formuleFausse = false;
  };
  if (nomme && !ancienNom.empty() && nom != ancienNom) parRenommer(d, ancienNom, nom);
  if (nomme) c.nom = nom;
  double f;
  if (parEstNombre(expr)) {
    std::string e = expr;
    std::replace(e.begin(), e.end(), ',', '.');
    f = strtod(e.c_str(), nullptr);
    c.expr.clear();
    c.formule = false;
  } else {
    c.expr = expr;
    c.formule = true;
    parResoudre(d);
    if (!c.exprErr.empty()) {
      r.message = "Expression : " + c.exprErr;
      restaurer();
      return r;
    }
    f = parDimUser(c);
  }
  if (!std::isfinite(f) || f <= 0 || (c.type == "angle" && f >= 180)) {
    restaurer();
    r.message = "Valeur invalide.";
    return r;
  }
  r.ok = true;
  r.valeur = parDimFromUser(c, f);
  return r;
}

std::string parReglerParametre(Document& d, Parametre& p, const std::string& expr) {
  if (expr.empty()) return "Expression vide.";
  const std::string ancienne = p.expr;
  p.expr = expr;
  parResoudre(d);
  if (!p.err.empty()) {
    const std::string m = p.err;
    p.expr = ancienne;
    parResoudre(d);
    return "Expression : " + m;
  }
  return "";
}

std::string parReglerPorteur(Document& d, PorteurFx& h, const std::string& texte) {
  const std::string s = sansBlancs(texte);
  std::string nom, reste;
  const bool nomme = separerNom(s, nom, reste);
  const std::string expr = sansBlancs(nomme ? reste : s);
  if (expr.empty()) return "Valeur vide.";
  if (nomme) {
    const std::string ok = parControleNom(d, nom, nullptr, nullptr, &h);
    if (!ok.empty()) return ok;
  }
  const PorteurFx avant = h;
  if (nomme && !avant.nom.empty() && nom != avant.nom) parRenommer(d, avant.nom, nom);
  if (nomme) h.nom = nom;
  if (parEstNombre(expr)) {
    std::string e = expr;
    std::replace(e.begin(), e.end(), ',', '.');
    h.expr.clear();
    if (poserPorteur(h, strtod(e.c_str(), nullptr))) h.change = true;
    return "";
  }
  h.expr = expr;
  parResoudre(d);
  if (!h.err.empty()) {
    const std::string m = h.err;
    if (nomme && !avant.nom.empty() && nom != avant.nom) parRenommer(d, nom, avant.nom);
    h = avant;
    return "Expression : " + m;
  }
  return "";
}

std::string parNomAutomatique(Document& d, Cote& c) {
  for (int n = 1; n < 10000; n++) {
    const std::string nm = "d" + std::to_string(n);
    if (parControleNom(d, nm, &c, nullptr, nullptr).empty()) {
      c.nom = nm;
      return nm;
    }
  }
  return "";
}

std::vector<NomPropose> parNomsProposes(const Document& d, const std::string& mot) {
  const std::string lw = enMinuscules(mot);
  struct L {
    NomPropose n;
    std::string cle;
    bool fonction = false;
  };
  std::vector<L> out;
  const auto fmt = [](double v) {
    if (!std::isfinite(v)) return std::string();
    std::string t = nombreJsFixe(v, 4);
    std::replace(t.begin(), t.end(), '.', ',');
    return t;
  };
  for (const auto& kv : tousLesNoms(d)) {
    double v = NaN;
    try {
      v = parValeurNom(d, kv.first);
    } catch (const std::exception&) {
    }
    const Entree::Sorte s = kv.second.sorte;
    out.push_back({{kv.first, kv.first, fmt(v), s == Entree::PARAM ? "paramètre" : s == Entree::DERIVE ? "dérivé" : s == Entree::COTE ? "cote" : "fonction 3D"}, enMinuscules(kv.first), false});
  }
  out.push_back({{"pi", "pi", fmt(PI), "constante"}, "pi", false});
  out.push_back({{"if( ; ; )", "if(", "test ; alors ; sinon", "condition"}, "if", true});
  for (const char* f : FONCTIONS) {
    const std::string n(f);
    out.push_back({{n + "( )", n + "(", n.rfind("round", 0) == 0 ? "x ; pas" : "", "fonction"}, n, true});
  }
  out.erase(std::remove_if(out.begin(), out.end(), [&](const L& o) { return o.cle.find(lw) == std::string::npos; }), out.end());
  const auto rang = [&](const L& o) { return o.cle == lw ? 0 : o.cle.rfind(lw, 0) == 0 ? 1 : 2; };
  std::stable_sort(out.begin(), out.end(), [&](const L& p, const L& q) {
    if (rang(p) != rang(q)) return rang(p) < rang(q);
    if (p.fonction != q.fonction) return q.fonction;
    return p.cle < q.cle;
  });
  std::vector<NomPropose> r;
  if (out.size() == 1 && out[0].n.insere == mot) return r;  // nom déjà complet, seul candidat : Entrée valide le champ
  for (size_t i = 0; i < out.size() && i < 12; i++) r.push_back(out[i].n);
  return r;
}

bool parMotEnCours(const std::wstring& t, long curseur, long& debut, long& fin, std::string& mot) {
  const auto car = [](wchar_t c) { return (c >= L'A' && c <= L'Z') || (c >= L'a' && c <= L'z') || c == L'_' || (c >= L'0' && c <= L'9'); };
  const auto tete = [](wchar_t c) { return (c >= L'A' && c <= L'Z') || (c >= L'a' && c <= L'z') || c == L'_'; };
  long a = curseur;
  while (a > 0 && car(t[a - 1])) a--;
  while (a < curseur && !tete(t[a])) a++;  // le mot commence par une lettre
  if (a >= curseur) return false;
  if (a > 0 && ((t[a - 1] >= L'0' && t[a - 1] <= L'9') || t[a - 1] == L'.' || t[a - 1] == L',')) return false;  // unité « 5mm »
  long b = curseur;
  while (b < static_cast<long>(t.size()) && car(t[b])) b++;
  debut = a;
  fin = b;
  mot.clear();
  for (long i = a; i < curseur; i++) mot += static_cast<char>(t[i]);
  return true;
}
