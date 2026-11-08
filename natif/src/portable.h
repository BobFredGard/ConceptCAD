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
#endif  // __cplusplus
#endif  // _WIN32
