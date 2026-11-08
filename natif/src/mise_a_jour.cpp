// La mise à jour par Internet de la version native : voir mise_a_jour.h.
#include "mise_a_jour.h"

#include <wx/app.h>
#include <wx/msgdlg.h>
#include <wx/progdlg.h>
#include <wx/msw/wrapwin.h>

#include <bcrypt.h>
#include <shellapi.h>
#include <urlmon.h>

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <fstream>
#include <memory>
#include <nlohmann/json.hpp>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace miseAJour {
namespace {
// Toujours dans la Release V0.70.0 (la première bêta) : chaque version web crée une Release « dernière » sans cette fiche.
// Une bêta suivante remplace la fiche ici ; son installateur peut être dans n'importe quelle Release du dépôt.
const wchar_t* const FICHE = L"https://github.com/BobFredGard/ConceptCAD/releases/download/V0.70.0/natif-latest.json";
const char* const DEPOT = "https://github.com/BobFredGard/ConceptCAD/releases/download/";

// L'avancement d'un téléchargement, lu par la fenêtre pendant que le fil d'arrière-plan télécharge
struct Avancement : public IBindStatusCallback {
  std::atomic<unsigned long> recu{0}, total{0};
  std::atomic<bool> abandon{false};
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID id, void** p) override {
    if (id == IID_IUnknown || id == IID_IBindStatusCallback) {
      *p = static_cast<IBindStatusCallback*>(this);
      return S_OK;
    }
    *p = nullptr;
    return E_NOINTERFACE;
  }
  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
  HRESULT STDMETHODCALLTYPE OnStartBinding(DWORD, IBinding*) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE GetPriority(LONG*) override { return E_NOTIMPL; }
  HRESULT STDMETHODCALLTYPE OnLowResource(DWORD) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE OnProgress(ULONG fait, ULONG tout, ULONG, LPCWSTR) override {
    recu = fait, total = tout;
    return abandon ? E_ABORT : S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnStopBinding(HRESULT, LPCWSTR) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE GetBindInfo(DWORD* f, BINDINFO*) override {
    *f = BINDF_GETNEWESTVERSION | BINDF_NOWRITECACHE;  // jamais une vieille copie gardée par Windows
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDataAvailable(DWORD, DWORD, FORMATETC*, STGMEDIUM*) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE OnObjectAvailable(REFIID, IUnknown*) override { return S_OK; }
};

std::wstring dossierTemp() {
  wchar_t t[MAX_PATH + 1];
  const DWORD n = GetTempPathW(MAX_PATH, t);
  return std::wstring(t, n);
}

std::string empreinte(const std::wstring& chemin) {
  std::ifstream f(chemin, std::ios::binary);
  if (!f) return "";
  BCRYPT_ALG_HANDLE alg = nullptr;
  BCRYPT_HASH_HANDLE h = nullptr;
  if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, 0) != 0) return "";
  std::string r;
  if (BCryptCreateHash(alg, &h, nullptr, 0, nullptr, 0, 0) == 0) {
    std::vector<char> b(1 << 20);
    while (f) {
      f.read(b.data(), b.size());
      if (f.gcount() > 0) BCryptHashData(h, reinterpret_cast<PUCHAR>(b.data()), static_cast<ULONG>(f.gcount()), 0);
    }
    unsigned char d[32];
    if (BCryptFinishHash(h, d, sizeof d, 0) == 0) {
      char x[3];
      for (unsigned char c : d) {
        std::snprintf(x, sizeof x, "%02x", c);
        r += x;
      }
    }
    BCryptDestroyHash(h);
  }
  BCryptCloseAlgorithmProvider(alg, 0);
  return r;
}

// Lit la fiche de version ; vide si hors ligne, illisible, pas plus récente ou pas publiée dans le dépôt
nlohmann::json lireFiche(const std::wstring& adresse) {
  const std::wstring f = dossierTemp() + L"ConceptCAD-natif-latest-" + std::to_wstring(GetCurrentProcessId()) + L".json";
  Avancement av;
  if (FAILED(URLDownloadToFileW(nullptr, adresse.c_str(), f.c_str(), 0, &av))) return nullptr;
  nlohmann::json fiche;
  try {
    std::ifstream in(f);
    fiche = nlohmann::json::parse(in);
  } catch (...) {
    fiche = nullptr;
  }
  DeleteFileW(f.c_str());
  if (!fiche.is_object() || !fiche.value("build", 0) || fiche.value("url", std::string()).rfind(DEPOT, 0) != 0) return nullptr;
  return fiche;
}

void installer(wxWindow* fenetre, const nlohmann::json& fiche) {
  const std::string url = fiche.value("url", std::string()), attendu = fiche.value("sha256", std::string());
  const std::wstring cible = dossierTemp() + L"ConceptCAD-Natif-mise-a-jour.exe";
  auto av = std::make_shared<Avancement>();
  auto fini = std::make_shared<std::atomic<int>>(0);  // 0 en cours, 1 réussi, 2 raté
  DeleteFileW(cible.c_str());
  std::thread([av, fini, url, cible] {
    const HRESULT r = URLDownloadToFileW(nullptr, wxString::FromUTF8(url).wc_str(), cible.c_str(), 0, av.get());
    *fini = SUCCEEDED(r) ? 1 : 2;
  }).detach();
  wxProgressDialog attente(L"ConceptCAD Natif", L"Téléchargement de la nouvelle version…", 1000, fenetre, wxPD_APP_MODAL | wxPD_CAN_ABORT | wxPD_AUTO_HIDE);
  while (*fini == 0) {
    const unsigned long t = av->total, f = av->recu;
    const int v = t > 0 ? static_cast<int>(std::min<unsigned long long>(999, 1000ULL * f / t)) : 0;
    const wxString m = t > 0 ? wxString::Format(L"Téléchargement de la nouvelle version… %.0f / %.0f Mo", f / 1048576.0, t / 1048576.0) : wxString(L"Téléchargement de la nouvelle version…");
    if (!attente.Update(v, m)) av->abandon = true;
    wxMilliSleep(100);
  }
  attente.Update(1000);
  if (*fini != 1) {
    if (!av->abandon) wxMessageBox(L"Le téléchargement de la nouvelle version a échoué. Réessayez plus tard.", L"ConceptCAD Natif", wxOK | wxICON_WARNING, fenetre);
    return;
  }
  if (!attendu.empty() && empreinte(cible) != attendu) {
    DeleteFileW(cible.c_str());
    wxMessageBox(L"Le fichier téléchargé ne correspond pas à la version publiée : il n'est pas installé.", L"ConceptCAD Natif", wxOK | wxICON_WARNING, fenetre);
    return;
  }
  // L'installateur attend que ce programme soit fermé, remplace les fichiers et relance la nouvelle version
  if (reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"open", cible.c_str(), L"/maj", nullptr, SW_SHOWNORMAL)) <= 32) {
    wxMessageBox(L"L'installateur de la nouvelle version n'a pas pu être lancé.", L"ConceptCAD Natif", wxOK | wxICON_WARNING, fenetre);
    return;
  }
  if (wxWindow* w = wxTheApp->GetTopWindow()) w->Close();  // propose d'enregistrer la pièce si elle a changé
}

void proposer(const nlohmann::json& fiche) {
  wxWindow* fenetre = wxTheApp ? wxTheApp->GetTopWindow() : nullptr;
  if (!fenetre) return;
  const wxString v = wxString::FromUTF8(fiche.value("version", std::string("nouvelle version")));
  wxString texte = L"Une nouvelle version de ConceptCAD Natif est disponible : " + v + L".\nVous avez : " + VERSION + L".";
  if (fiche.contains("notes") && fiche["notes"].is_string() && !fiche["notes"].get<std::string>().empty()) texte += L"\n\n" + wxString::FromUTF8(fiche["notes"].get<std::string>());
  texte += L"\n\nL'installer maintenant ? Le programme se fermera puis se rouvrira.";
  if (wxMessageBox(texte, L"Mise à jour de ConceptCAD Natif", wxYES_NO | wxICON_QUESTION, fenetre) == wxYES) installer(fenetre, fiche);
}
}  // namespace

void verifier(wxWindow*) {
  if (_wgetenv(L"CONCEPTCAD_SANS_MAJ")) return;
  std::thread([] {
    const nlohmann::json fiche = lireFiche(FICHE);
    if (fiche.is_null() || fiche.value("build", 0) <= BUILD) return;
    if (wxTheApp) wxTheApp->CallAfter([fiche] { proposer(fiche); });
  }).detach();
}

int essai(const std::wstring& adresse, int build) {
  const nlohmann::json fiche = lireFiche(adresse.empty() ? std::wstring(FICHE) : adresse);
  if (fiche.is_null()) {
    std::printf("fiche absente ou refusee\n");
    return 2;
  }
  std::printf("fiche : build %d, %s\n", fiche.value("build", 0), fiche.value("url", std::string()).c_str());
  if (fiche.value("build", 0) <= build) {
    std::printf("a jour (build %d)\n", build);
    return 0;
  }
  const std::wstring cible = dossierTemp() + L"ConceptCAD-Natif-essai-maj.exe";
  DeleteFileW(cible.c_str());
  Avancement av;
  if (FAILED(URLDownloadToFileW(nullptr, wxString::FromUTF8(fiche.value("url", std::string())).wc_str(), cible.c_str(), 0, &av))) {
    std::printf("telechargement rate\n");
    return 3;
  }
  const std::string e = empreinte(cible);
  const bool bon = e == fiche.value("sha256", std::string());
  std::printf("telecharge %lu octets, empreinte %s\n", av.recu.load(), bon ? "conforme" : "FAUSSE");
  DeleteFileW(cible.c_str());
  return bon ? 1 : 4;
}
}  // namespace miseAJour
