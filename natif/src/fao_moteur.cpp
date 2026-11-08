#include "fao_moteur.h"

#include <wx/app.h>
#include <wx/filename.h>
#include <wx/stdpaths.h>
#include <wx/utils.h>
#include <wx/filefn.h>
#ifndef _WIN32
#include <fcntl.h>
#endif

#ifdef _WIN32
#include <windows.h>
#else
#include <signal.h>
#include <spawn.h>
#include <sys/wait.h>
#include <unistd.h>
extern char** environ;
#endif

namespace {
// Le dossier du programme : fao/ s'y trouve, et le Node joint à la distribution s'il y en a un
#ifdef _WIN32
std::wstring dossierProgramme() { return wxFileName(wxStandardPaths::Get().GetExecutablePath()).GetPath().ToStdWstring(); }
#else
// Mac : fao/ est dans Contents/Resources de l'application
std::wstring dossierProgramme() { return wxStandardPaths::Get().GetResourcesDir().ToStdWstring(); }
// Les descripteurs du Mac rangés dans les pointeurs prévus pour Windows (0 reste « rien »)
void* versPtr(intptr_t n) { return reinterpret_cast<void*>(n + 1); }
int versFd(void* p) { return static_cast<int>(reinterpret_cast<intptr_t>(p) - 1); }
#endif
}  // namespace

MoteurFao::~MoteurFao() {
  *vivant_ = false;
  arreter();
}

void MoteurFao::arreter() {
#ifndef _WIN32
  if (entree_) close(versFd(entree_));
  entree_ = nullptr;
  if (proc_) {
    const pid_t pid = static_cast<pid_t>(versFd(proc_));
    int etat = 0;
    for (int i = 0; i < 30 && waitpid(pid, &etat, WNOHANG) == 0; i++) usleep(50000);
    if (waitpid(pid, &etat, WNOHANG) == 0) {
      kill(pid, SIGTERM);
      waitpid(pid, &etat, 0);
    }
  }
  proc_ = nullptr;
  if (lecteur_.joinable()) lecteur_.join();
  if (sortie_) close(versFd(sortie_));
  sortie_ = nullptr;
  enMarche_ = pret_ = false;
  return;
#endif
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
  const std::wstring script = d + SEPW L"fao\\moteur.cjs";
  if (!wxFileExists(script)) {
    pret(false, "Le moteur d'usinage est absent : " + wxString(script).ToStdString(wxConvUTF8));
    return;
  }
#ifndef _WIN32
  // Le Node joint au programme, sinon celui de l'ordinateur (Homebrew, installateur officiel)
  std::string node = portable::u8((d + SEPW L"fao" SEPW L"node").c_str());
  for (const char* c : {"/opt/homebrew/bin/node", "/usr/local/bin/node"})
    if (access(node.c_str(), X_OK) != 0) node = c;
  if (access(node.c_str(), X_OK) != 0) {
    pret(false, "Node.js est introuvable : le moteur d'usinage ne peut pas démarrer.");
    return;
  }
  int versEnfant[2], depuisEnfant[2];
  if (pipe(versEnfant) != 0 || pipe(depuisEnfant) != 0) {
    pret(false, "Le moteur d'usinage n'a pas pu démarrer.");
    return;
  }
  posix_spawn_file_actions_t act;
  posix_spawn_file_actions_init(&act);
  posix_spawn_file_actions_adddup2(&act, versEnfant[0], 0);
  posix_spawn_file_actions_adddup2(&act, depuisEnfant[1], 1);
  posix_spawn_file_actions_addopen(&act, 2, "/dev/null", O_WRONLY, 0);
  posix_spawn_file_actions_addclose(&act, versEnfant[1]);
  posix_spawn_file_actions_addclose(&act, depuisEnfant[0]);
  const std::string scriptU8 = portable::u8(script.c_str()), dU8 = portable::u8(d.c_str());
  std::string o1 = "--max-old-space-size=8192";
  char* args[] = {node.data(), o1.data(), const_cast<char*>(scriptU8.c_str()), nullptr};
  pid_t pid = 0;
  const std::string ancien = wxGetCwd().ToStdString(wxConvUTF8);
  wxSetWorkingDirectory(wxString::FromUTF8(dU8));
  const int r = posix_spawn(&pid, node.c_str(), &act, nullptr, args, environ);
  wxSetWorkingDirectory(wxString::FromUTF8(ancien));
  posix_spawn_file_actions_destroy(&act);
  close(versEnfant[0]);
  close(depuisEnfant[1]);
  if (r != 0) {
    close(versEnfant[1]);
    close(depuisEnfant[0]);
    pret(false, "Node.js est introuvable : le moteur d'usinage ne peut pas démarrer.");
    return;
  }
  signal(SIGPIPE, SIG_IGN);
  proc_ = versPtr(pid);
  entree_ = versPtr(versEnfant[1]);
  sortie_ = versPtr(depuisEnfant[0]);
  enMarche_ = true;
  lecteur_ = std::thread([this] { lire(); });
  return;
#else
  // Le Node joint au programme, sinon celui de l'ordinateur
  std::wstring node = d + SEPW L"fao\\node.exe";
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
#endif
}

void MoteurFao::lire() {
  std::string buf;
  char t[65536];
  auto vivant = vivant_;
#ifdef _WIN32
  DWORD n = 0;
  while (ReadFile(static_cast<HANDLE>(sortie_), t, sizeof(t), &n, nullptr) && n) {
#else
  ssize_t n = 0;
  while ((n = read(versFd(sortie_), t, sizeof(t))) > 0) {
#endif
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
#ifdef _WIN32
  DWORD ecrit = 0;
  WriteFile(static_cast<HANDLE>(entree_), l.data(), static_cast<DWORD>(l.size()), &ecrit, nullptr);
#else
  for (size_t fait = 0; fait < l.size();) {
    const ssize_t k = write(versFd(entree_), l.data() + fait, l.size() - fait);
    if (k <= 0) break;
    fait += static_cast<size_t>(k);
  }
#endif
}
