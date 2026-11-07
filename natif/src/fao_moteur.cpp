#include "fao_moteur.h"

#include <wx/app.h>
#include <wx/filename.h>
#include <wx/stdpaths.h>
#include <wx/utils.h>

#include <windows.h>

namespace {
// Le dossier du programme : fao/ s'y trouve, et le Node joint à la distribution s'il y en a un
std::wstring dossierProgramme() { return wxFileName(wxStandardPaths::Get().GetExecutablePath()).GetPath().ToStdWstring(); }
}  // namespace

MoteurFao::~MoteurFao() {
  *vivant_ = false;
  arreter();
}

void MoteurFao::arreter() {
  if (entree_) CloseHandle(static_cast<HANDLE>(entree_));
  entree_ = nullptr;
  if (proc_) {
    if (WaitForSingleObject(static_cast<HANDLE>(proc_), 1500) != WAIT_OBJECT_0) TerminateProcess(static_cast<HANDLE>(proc_), 0);
    CloseHandle(static_cast<HANDLE>(proc_));
  }
  proc_ = nullptr;
  if (lecteur_.joinable()) lecteur_.join();
  if (sortie_) CloseHandle(static_cast<HANDLE>(sortie_));
  sortie_ = nullptr;
  enMarche_ = pret_ = false;
}

void MoteurFao::demarrer(const std::function<void(bool, const std::string&)>& pret) {
  if (enMarche_) {
    if (pret_) pret(true, "");
    else surPret_ = pret;
    return;
  }
  surPret_ = pret;
  const std::wstring d = dossierProgramme();
  const std::wstring script = d + L"\\fao\\moteur.cjs";
  if (!wxFileExists(script)) {
    pret(false, "Le moteur d'usinage est absent : " + wxString(script).ToStdString(wxConvUTF8));
    return;
  }
  // Le Node joint au programme, sinon celui de l'ordinateur
  std::wstring node = d + L"\\fao\\node.exe";
  if (!wxFileExists(node)) node = L"node";
  SECURITY_ATTRIBUTES sa{sizeof(sa), nullptr, TRUE};
  HANDLE inL = nullptr, inE = nullptr, outL = nullptr, outE = nullptr;
  CreatePipe(&inL, &inE, &sa, 0);
  CreatePipe(&outL, &outE, &sa, 1 << 20);
  SetHandleInformation(inE, HANDLE_FLAG_INHERIT, 0);
  SetHandleInformation(outL, HANDLE_FLAG_INHERIT, 0);
  HANDLE nul = CreateFileW(L"NUL", GENERIC_WRITE, FILE_SHARE_WRITE, &sa, OPEN_EXISTING, 0, nullptr);
  STARTUPINFOW si{};
  si.cb = sizeof(si);
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = inL;
  si.hStdOutput = outE;
  si.hStdError = nul;
  PROCESS_INFORMATION pi{};
  std::wstring ligne = L"\"" + node + L"\" --max-old-space-size=8192 \"" + script + L"\"";
  const BOOL ok = CreateProcessW(nullptr, ligne.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, d.c_str(), &si, &pi);
  CloseHandle(inL);
  CloseHandle(outE);
  CloseHandle(nul);
  if (!ok) {
    CloseHandle(inE);
    CloseHandle(outL);
    pret(false, "Node.js est introuvable : le moteur d'usinage ne peut pas démarrer.");
    return;
  }
  CloseHandle(pi.hThread);
  proc_ = pi.hProcess;
  entree_ = inE;
  sortie_ = outL;
  enMarche_ = true;
  lecteur_ = std::thread([this] { lire(); });
}

void MoteurFao::lire() {
  std::string buf;
  char t[65536];
  DWORD n = 0;
  auto vivant = vivant_;
  while (ReadFile(static_cast<HANDLE>(sortie_), t, sizeof(t), &n, nullptr) && n) {
    buf.append(t, n);
    size_t i;
    size_t debut = 0;
    while ((i = buf.find('\n', debut)) != std::string::npos) {
      std::string l = buf.substr(debut, i - debut);
      debut = i + 1;
      // § en UTF-8 : C2 A7. Le reste est du bavardage de la page.
      if (l.size() > 2 && static_cast<unsigned char>(l[0]) == 0xC2 && static_cast<unsigned char>(l[1]) == 0xA7) {
        wxTheApp->CallAfter([this, vivant, s = l.substr(2)] {
          if (*vivant) recu(s);
        });
      }
    }
    buf.erase(0, debut);
  }
  wxTheApp->CallAfter([this, vivant] {
    if (!*vivant) return;
    // Le moteur s'est arrêté : personne ne doit attendre pour toujours
    const bool etaitPret = pret_;
    enMarche_ = pret_ = false;
    auto a = std::move(attente_);
    attente_.clear();
    for (auto& [k, r] : a) r(false, plan::J(), "Le moteur d'usinage s'est arrêté.");
    if (!etaitPret && surPret_) {
      auto f = std::move(surPret_);
      surPret_ = nullptr;
      f(false, "Le moteur d'usinage n'a pas pu démarrer.");
    }
  });
}

void MoteurFao::recu(const std::string& ligne) {
  plan::J o;
  try {
    o = plan::J::parse(ligne);
  } catch (const std::exception&) {
    return;
  }
  if (o.contains("evt")) {
    if (surEvenement) surEvenement(o);
    return;
  }
  if (o.contains("pret")) {
    pret_ = o["pret"].get<bool>();
    if (surPret_) {
      auto f = std::move(surPret_);
      surPret_ = nullptr;
      f(pret_, o.value("erreur", std::string()));
    }
    return;
  }
  const long n = o.value("n", -1L);
  auto it = attente_.find(n);
  if (it == attente_.end()) return;
  Reponse r = std::move(it->second);
  attente_.erase(it);
  const bool ok = o.value("ok", false);
  r(ok, ok && o.contains("r") ? o["r"] : plan::J(), o.value("erreur", std::string()));
}

void MoteurFao::commande(const std::string& nom, plan::J args, const Reponse& r) {
  if (!entree_) {
    r(false, plan::J(), "Le moteur d'usinage n'est pas démarré.");
    return;
  }
  const long n = ++suivant_;
  attente_[n] = r;
  if (!args.is_object()) args = plan::J::object();
  args["n"] = n;
  args["cmd"] = nom;
  const std::string l = args.dump(-1, ' ', false, plan::J::error_handler_t::replace) + "\n";
  DWORD ecrit = 0;
  WriteFile(static_cast<HANDLE>(entree_), l.data(), static_cast<DWORD>(l.size()), &ecrit, nullptr);
}
