// Ce qui manque au Mac pour compiler le code écrit pour Windows : inclus d'office avant chaque fichier sur Mac
// (CMakeLists.txt, -include). Sous Windows, seuls SEPW et IMPRIMER_FENETRE servent, et donnent exactement le code d'avant.
#pragma once

// Ouvrir un fichier par un chemin en wstring : Visual Studio l'accepte directement, pas le Mac.
// Sous Windows, cheminFlux rend son argument tel quel (code identique) ; sur Mac, un std::filesystem::path.
#ifdef __cplusplus
#ifdef _WIN32
template <class T>
inline const T& cheminFlux(const T& t) { return t; }
#else
#include <filesystem>
#include <string>
inline std::filesystem::path cheminFlux(const std::wstring& w) { return std::filesystem::path(w); }
inline std::filesystem::path cheminFlux(const wchar_t* w) { return std::filesystem::path(w); }
inline const std::string& cheminFlux(const std::string& s) { return s; }
inline const char* cheminFlux(const char* s) { return s; }
inline const std::filesystem::path& cheminFlux(const std::filesystem::path& p) { return p; }
template <class T>
inline auto cheminFlux(const T& t) -> decltype(std::filesystem::path(t.ToStdWstring())) { return std::filesystem::path(t.ToStdWstring()); }
#endif

// Nombres à virgule écrits et relus au plus court (std::to_chars et std::from_chars) : sous Windows ce sont ceux
// de la bibliothèque, inchangés ; sur Mac, ils n'existent qu'à partir de macOS 13.3 et 26, d'où cette version
// qui donne le même texte : le moins de chiffres qui redonne exactement le même nombre, en notation fixe ou
// scientifique selon la plus courte (fixe si égalité), exposant sur deux chiffres au moins.
#include <charconv>
#ifdef _WIN32
namespace cc {
using std::from_chars;
using std::to_chars;
}  // namespace cc
#else
#include <xlocale.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <system_error>
namespace cc {
namespace detail {
inline locale_t localeC() {
  static locale_t l = newlocale(LC_ALL_MASK, "C", nullptr);
  return l;
}
// Les chiffres les plus courts (sans zéros à droite) et l'exposant du premier chiffre
inline void chiffres(double v, std::string& d, int& e) {
  char b[64];
  for (int p = 1; p <= 17; p++) {
    snprintf_l(b, sizeof b, localeC(), "%.*e", p - 1, v);
    if (strtod_l(b, nullptr, localeC()) == v || p == 17) break;
  }
  const char* x = std::strchr(b, 'e');
  e = std::atoi(x + 1);
  d.clear();
  for (const char* c = b; c < x; c++)
    if (*c >= '0' && *c <= '9') d += *c;
  while (d.size() > 1 && d.back() == '0') d.pop_back();
}
inline std::string fixe(const std::string& d, int e) {
  const int n = static_cast<int>(d.size());
  if (e >= n - 1) return d + std::string(static_cast<size_t>(e - n + 1), '0');
  if (e >= 0) return d.substr(0, static_cast<size_t>(e + 1)) + "." + d.substr(static_cast<size_t>(e + 1));
  return "0." + std::string(static_cast<size_t>(-e - 1), '0') + d;
}
inline std::string scientifique(const std::string& d, int e) {
  char x[16];
  std::snprintf(x, sizeof x, "e%c%02d", e < 0 ? '-' : '+', e < 0 ? -e : e);
  return d.substr(0, 1) + (d.size() > 1 ? "." + d.substr(1) : std::string()) + x;
}
inline std::to_chars_result ecrire(char* debut, char* fin, double v, int forme) {  // 0 au plus court, 1 fixe, 2 scientifique
  std::string t;
  if (v != v) t = "nan";
  else if (v == HUGE_VAL) t = "inf";
  else if (v == -HUGE_VAL) t = "-inf";
  else {
    const bool neg = std::signbit(v);
    const double a = neg ? -v : v;
    std::string d;
    int e = 0;
    if (a == 0) d = "0";
    else chiffres(a, d, e);
    std::string f = fixe(d, e);
    // Un entier : Windows écrit la valeur exacte du nombre (1e23 donne 99999999999999991611392)
    if (e >= static_cast<int>(d.size()) - 1) {
      char g[400];
      snprintf_l(g, sizeof g, localeC(), "%.0f", a);
      f = g;
    }
    const std::string s = scientifique(d, e);
    t = (neg ? "-" : "") + (forme == 1 ? f : forme == 2 ? s : (s.size() < f.size() ? s : f));
  }
  if (static_cast<size_t>(fin - debut) < t.size()) return {fin, std::errc::value_too_large};
  std::memcpy(debut, t.data(), t.size());
  return {debut + t.size(), std::errc()};
}
}  // namespace detail
inline std::to_chars_result to_chars(char* debut, char* fin, double v) { return detail::ecrire(debut, fin, v, 0); }
inline std::to_chars_result to_chars(char* debut, char* fin, double v, std::chars_format f) {
  return detail::ecrire(debut, fin, v, f == std::chars_format::fixed ? 1 : f == std::chars_format::scientific ? 2 : 0);
}
// Comme std::from_chars : pas d'espace ni de « + » devant, pas de « 0x », point décimal quelle que soit la langue
inline std::from_chars_result from_chars(const char* debut, const char* fin, double& v) {
  const std::string s(debut, fin);
  if (s.empty() || s[0] == ' ' || s[0] == '+' || s[0] == '\t' || s.find_first_of("xX") != std::string::npos) return {debut, std::errc::invalid_argument};
  char* f = nullptr;
  const double r = strtod_l(s.c_str(), &f, detail::localeC());
  if (f == s.c_str()) return {debut, std::errc::invalid_argument};
  v = r;
  return {debut + (f - s.c_str()), std::errc()};
}
}  // namespace cc
#endif
#endif

// Polices propres à Windows et leur équivalent Mac (un nom de police absent laisse sur Mac un texte sans police)
#ifdef _WIN32
#define POLICE_SEGOE "Segoe UI"
#define POLICE_SYMBOLES "Segoe UI Symbol"
#else
#define POLICE_SEGOE "Helvetica Neue"
#define POLICE_SYMBOLES "Apple Symbols"
#endif

#ifdef _WIN32
#define SEPW L"\\"
// Photo d'une fenêtre avec ce que dessine OpenGL (2 : PW_RENDERFULLCONTENT)
#define IMPRIMER_FENETRE(fenetre, dc) PrintWindow((fenetre)->GetHWND(), static_cast<HDC>((dc).GetHDC()), 2)
#else
#define SEPW L"/"
// Sur Mac, les photos de fenêtres des essais automatiques ne sont pas encore faites
#define IMPRIMER_FENETRE(fenetre, dc) ((void)(fenetre), (void)(dc))

#ifdef __cplusplus
#include <strings.h>
#include <sys/stat.h>
#include <unistd.h>

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cwchar>
#include <ctime>
#include <map>
#include <mutex>
#include <string>

namespace portable {
// wchar_t vaut 4 octets sur Mac (UTF-32) : conversions vers et depuis UTF-8 pour les fonctions du système
inline std::string u8(const wchar_t* w) {
  std::string s;
  if (!w) return s;
  for (; *w; ++w) {
    const unsigned c = static_cast<unsigned>(*w);
    if (c < 0x80) s += static_cast<char>(c);
    else if (c < 0x800) { s += static_cast<char>(0xC0 | (c >> 6)); s += static_cast<char>(0x80 | (c & 0x3F)); }
    else if (c < 0x10000) { s += static_cast<char>(0xE0 | (c >> 12)); s += static_cast<char>(0x80 | ((c >> 6) & 0x3F)); s += static_cast<char>(0x80 | (c & 0x3F)); }
    else { s += static_cast<char>(0xF0 | (c >> 18)); s += static_cast<char>(0x80 | ((c >> 12) & 0x3F)); s += static_cast<char>(0x80 | ((c >> 6) & 0x3F)); s += static_cast<char>(0x80 | (c & 0x3F)); }
  }
  return s;
}
inline std::wstring large(const char* s) {
  std::wstring w;
  if (!s) return w;
  const unsigned char* p = reinterpret_cast<const unsigned char*>(s);
  while (*p) {
    unsigned c = *p++;
    int n = 0;
    if (c >= 0xF0) { c &= 0x07; n = 3; }
    else if (c >= 0xE0) { c &= 0x0F; n = 2; }
    else if (c >= 0xC0) { c &= 0x1F; n = 1; }
    for (; n > 0 && (*p & 0xC0) == 0x80; --n) c = (c << 6) | (*p++ & 0x3F);
    w += static_cast<wchar_t>(c);
  }
  return w;
}
}  // namespace portable

inline FILE* _wfopen(const wchar_t* chemin, const wchar_t* mode) { return std::fopen(portable::u8(chemin).c_str(), portable::u8(mode).c_str()); }
inline int _wremove(const wchar_t* chemin) { return std::remove(portable::u8(chemin).c_str()); }
inline int _wrename(const wchar_t* a, const wchar_t* b) { return std::rename(portable::u8(a).c_str(), portable::u8(b).c_str()); }
inline const wchar_t* _wgetenv(const wchar_t* nom) {
  static std::mutex verrou;
  static std::map<std::wstring, std::wstring> valeurs;  // les adresses rendues restent valables
  const std::string n = portable::u8(nom);
  const char* v = std::getenv(n.c_str());
  // APPDATA : le dossier des réglages de Windows ; son équivalent Mac est ~/Library/Application Support
  std::string appdata;
  if (!v && n == "APPDATA" && std::getenv("HOME")) {
    appdata = std::string(std::getenv("HOME")) + "/Library/Application Support";
    v = appdata.c_str();
  }
  if (!v) return nullptr;
  std::lock_guard<std::mutex> g(verrou);
  std::wstring& r = valeurs[nom];
  const std::wstring w = portable::large(v);
  if (r != w) r = w;
  return r.c_str();
}
inline int _wtoi(const wchar_t* s) { return static_cast<int>(std::wcstol(s, nullptr, 10)); }
inline double _wtof(const wchar_t* s) { return std::wcstod(s, nullptr); }
inline int _wcsicmp(const wchar_t* a, const wchar_t* b) { return wcscasecmp(a, b); }
inline int _stricmp(const char* a, const char* b) { return strcasecmp(a, b); }
inline int localtime_s(std::tm* r, const std::time_t* t) { return localtime_r(t, r) ? 0 : 1; }
inline int gmtime_s(std::tm* r, const std::time_t* t) { return gmtime_r(t, r) ? 0 : 1; }
inline unsigned long long GetTickCount64() {
  return static_cast<unsigned long long>(std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count());
}
inline unsigned long GetTickCount() { return static_cast<unsigned long>(GetTickCount64()); }
inline unsigned long GetCurrentProcessId() { return static_cast<unsigned long>(getpid()); }
inline void Sleep(unsigned long ms) { usleep(static_cast<useconds_t>(ms) * 1000); }
// Fichiers : écrire sur le disque, exister, remplacer d'un coup (rename est atomique sur Mac)
inline int _fileno(FILE* f) { return fileno(f); }
inline int _commit(int fd) { return fsync(fd); }
#define INVALID_FILE_ATTRIBUTES 0xFFFFFFFFul
#define MOVEFILE_REPLACE_EXISTING 0x1
#define MOVEFILE_WRITE_THROUGH 0x8
inline unsigned long GetFileAttributesW(const wchar_t* chemin) {
  struct stat s;
  return ::stat(portable::u8(chemin).c_str(), &s) == 0 ? 0ul : INVALID_FILE_ATTRIBUTES;
}
inline int MoveFileExW(const wchar_t* de, const wchar_t* vers, unsigned long) { return std::rename(portable::u8(de).c_str(), portable::u8(vers).c_str()) == 0; }
// std::filesystem::path::c_str() donne du char sur Mac
inline int _wcsicmp(const char* a, const char* b) { return strcasecmp(a, b); }
#endif  // __cplusplus
#endif  // _WIN32
