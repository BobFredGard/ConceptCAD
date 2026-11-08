// Journal d'erreurs local (src/01-journal-erreurs.js du navigateur)
#include "journal.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <nlohmann/json.hpp>

#include <algorithm>
#include <cstdio>
#include <ctime>
#include <deque>
#include <exception>
#include <fstream>
#include <mutex>
#ifndef _WIN32
#include <sys/stat.h>
#endif
#include <vector>

namespace journal {
std::function<void()> surErreur;

namespace {
using J = nlohmann::json;
const size_t MAXI = 50, GESTES = 5;
#ifdef _WIN32
const char* const VERSION = "Essai Windows";
#else
const char* const VERSION = "Essai Mac";
#endif

std::recursive_mutex verrou;
std::vector<J> liste;
std::deque<std::string> gestes;

std::wstring fichier() {
  if (const wchar_t* e = _wgetenv(L"CC_JOURNAL")) return e;  // les essais écrivent ailleurs
  std::wstring d;
  if (const wchar_t* a = _wgetenv(L"APPDATA")) d = a;
  d += SEPW L"ConceptCADNatif";
#ifdef _WIN32
  CreateDirectoryW(d.c_str(), nullptr);
#else
  mkdir(portable::u8(d.c_str()).c_str(), 0755);
#endif
  return d + SEPW L"journal-erreurs.json";
}
std::string maintenant() {
  std::time_t t = std::time(nullptr);
  std::tm g{};
  gmtime_s(&g, &t);
  char b[32];
  std::strftime(b, sizeof b, "%Y-%m-%dT%H:%M:%SZ", &g);
  return b;
}
// Ne garde que le nom du fichier : le chemin complet peut contenir le nom de l'utilisateur
std::string nettoyer(const std::string& s, size_t maxi) {
  std::string o;
  for (size_t i = 0; i < s.size() && o.size() < maxi;) {
    const bool chemin = i + 2 < s.size() && std::isalpha(static_cast<unsigned char>(s[i])) && s[i + 1] == ':' && (s[i + 2] == '\\' || s[i + 2] == '/');
    if (!chemin) {
      o += s[i++];
      continue;
    }
    size_t f = i;
    while (f < s.size() && s[f] != ' ' && s[f] != ')' && s[f] != '\'' && s[f] != '"' && s[f] != '\n') f++;
    const size_t coupe = s.find_last_of("\\/", f - 1);
    o += s.substr(coupe + 1, f - coupe - 1);
    i = f;
  }
  return o;
}
void ecrire() {
  try {
    std::ofstream f(fichier(), std::ios::binary | std::ios::trunc);
    f << J(liste).dump(1, ' ', false, J::error_handler_t::replace);
  } catch (...) {
  }
}
#ifdef _WIN32
LONG WINAPI plantage(EXCEPTION_POINTERS* x) {
  // Le logiciel s'arrête : une dernière ligne, sans jamais provoquer une panne à son tour
  try {
    char m[64];
    std::snprintf(m, sizeof m, "Plantage (code %08lX)", x->ExceptionRecord->ExceptionCode);
    std::string lieu;
    HMODULE mod = nullptr;
    if (GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT, static_cast<const char*>(x->ExceptionRecord->ExceptionAddress), &mod) && mod) {
      char nom[MAX_PATH] = {};
      GetModuleFileNameA(mod, nom, MAX_PATH);
      char dec[32];
      std::snprintf(dec, sizeof dec, "+0x%llX", static_cast<unsigned long long>(static_cast<const char*>(x->ExceptionRecord->ExceptionAddress) - reinterpret_cast<const char*>(mod)));
      lieu = std::string(nom) + dec;
    }
    ajouter("plantage", m, lieu);
  } catch (...) {
  }
  return EXCEPTION_CONTINUE_SEARCH;
}
#endif
}  // namespace

void demarrer() {
  try {
    std::ifstream f(fichier(), std::ios::binary);
    if (f) {
      const J t = J::parse(f, nullptr, false);
      if (t.is_array()) {
        for (const J& x : t)
          if (x.is_object()) liste.push_back(x);
        if (liste.size() > MAXI) liste.erase(liste.begin(), liste.end() - MAXI);
      }
    }
  } catch (...) {
  }
#ifdef _WIN32
  SetUnhandledExceptionFilter(plantage);
#endif
  std::set_terminate([] {
    std::string m = "Arrêt sur une erreur non rattrapée";
    try {
      if (const auto e = std::current_exception()) std::rethrow_exception(e);
    } catch (const std::exception& e) {
      m = e.what();
    } catch (...) {
    }
    ajouter("plantage", m, "");
    std::abort();
  });
}

void ajouter(const std::string& genre, const std::string& message, const std::string& lieu) {
  try {
    const std::lock_guard<std::recursive_mutex> g(verrou);
    const std::string msg = nettoyer(message, 500), place = nettoyer(lieu, 160), now = maintenant();
    const J boutons(std::vector<std::string>(gestes.begin(), gestes.end()));
    for (size_t i = 0; i < liste.size(); i++) {
      if (liste[i].value("genre", "") != genre || liste[i].value("message", "") != msg || liste[i].value("lieu", "") != place) continue;
      J x = liste[i];
      liste.erase(liste.begin() + static_cast<std::ptrdiff_t>(i));
      x["fois"] = x.value("fois", 1) + 1;
      x["derniere"] = now;
      x["gestes"] = boutons;
      liste.push_back(std::move(x));
      ecrire();
      return;
    }
    liste.push_back({{"genre", genre}, {"message", msg}, {"lieu", place}, {"version", VERSION}, {"premiere", now}, {"derniere", now}, {"fois", 1}, {"gestes", boutons}});
    if (liste.size() > MAXI) liste.erase(liste.begin());
    ecrire();
  } catch (...) {
  }
}

void geste(const std::string& nomDuBouton) {
  try {
    const std::lock_guard<std::recursive_mutex> g(verrou);
    gestes.push_back(nomDuBouton.substr(0, 40));
    if (gestes.size() > GESTES) gestes.pop_front();
  } catch (...) {
  }
}

std::string texte() {
  const std::lock_guard<std::recursive_mutex> g(verrou);
  std::string L = "Journal d'erreurs ConceptCAD\nExporté le : " + maintenant() + "\nVersion en cours : " + VERSION + "\nProgramme : Windows natif\nErreurs différentes : " + std::to_string(liste.size()) + "\n";
  for (size_t i = 0; i < liste.size(); i++) {
    const J& x = liste[i];
    L += "\n--- " + std::to_string(i + 1) + " ---\nType : " + x.value("genre", "") + "\nVersion : " + x.value("version", "") + "\nFois : " + std::to_string(x.value("fois", 1)) +
         "\nPremière : " + x.value("premiere", "") + "\nDernière : " + x.value("derniere", "") + "\nMessage : " + x.value("message", "") + "\n";
    if (!x.value("lieu", "").empty()) L += "Lieu : " + x.value("lieu", "") + "\n";
    if (x.contains("gestes") && x["gestes"].is_array() && !x["gestes"].empty()) {
      L += "Derniers boutons : ";
      bool premier = true;
      for (const J& b : x["gestes"]) {
        L += (premier ? "" : " > ") + b.get<std::string>();
        premier = false;
      }
      L += "\n";
    }
  }
  return L;
}

size_t nombre() {
  const std::lock_guard<std::recursive_mutex> g(verrou);
  return liste.size();
}

std::string dernierMessage() {
  const std::lock_guard<std::recursive_mutex> g(verrou);
  return liste.empty() ? std::string() : liste.back().value("message", "");
}

void vider() {
  const std::lock_guard<std::recursive_mutex> g(verrou);
  liste.clear();
  ecrire();
}
}  // namespace journal
