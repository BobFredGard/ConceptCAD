// ConceptCAD natif : point d'entrée. Lance la fenêtre, ou le calcul sans fenêtre (--verif).
#include <wx/wx.h>

#include <chrono>
#include <cstdio>
#include <string>
#include <vector>

#include <shellapi.h>

#include "cadre.h"
#include "coter.h"
#include "enregistrer.h"

namespace {
std::vector<std::wstring> gArgs;

std::string utf8(const std::wstring& w) {
  int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
  std::string s(n > 0 ? n - 1 : 0, '\0');
  if (n > 1) WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, s.data(), n, nullptr, nullptr);
  return s;
}

// --verif <fichier> <sortie.json> [nFonction=valeur ...] : calcule sans fenêtre, écrit les mesures.
int modeVerif(const std::vector<std::wstring>& a) {
  if (a.size() < 3) return 2;
  FILE* s = _wfopen(a[2].c_str(), L"wb");
  if (!s) return 2;
  try {
    Document d = lireProjet(a[1]);
    fprintf(s, "{\"nonPrisEnCharge\":[");
    for (size_t i = 0; i < d.nonPrisEnCharge.size(); i++) fprintf(s, "%s\"%s\"", i ? "," : "", d.nonPrisEnCharge[i].c_str());
    fprintf(s, "],\"modifiables\":[");
    bool virgule = false;
    for (size_t i = 0; i < d.fonctions.size(); i++)
      if (d.fonctions[i].type == "extrude" && d.profondeurModifiable(i)) {
        fprintf(s, "%s%zu", virgule ? "," : "", i);
        virgule = true;
      }
    fprintf(s, "],\"parallele\":%s,\"cas\":[", parallele() ? "true" : "false");
    bool premier = true;
    auto cas = [&](const std::string& nom) {
      const auto t0 = std::chrono::steady_clock::now();
      ResultatRejeu r = rejouer(d);
      const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
      Mesures m = mesurer(r.forme);
      fprintf(s, "%s{\"nom\":\"%s\",\"volume\":%.9f,\"aire\":%.9f,\"faces\":%d,\"aretes\":%d,\"sommets\":%d,\"solides\":%d,\"valide\":%s,\"boite\":[%.6f,%.6f,%.6f,%.6f,%.6f,%.6f],\"ms\":%.3f,\"messages\":%zu}",
              premier ? "" : ",", nom.c_str(), m.volume, m.aire, m.faces, m.aretes, m.sommets, m.solides, m.valide ? "true" : "false",
              m.boite[0], m.boite[1], m.boite[2], m.boite[3], m.boite[4], m.boite[5], ms, r.messages.size());
      premier = false;
    };
    cas("tel quel");
    for (size_t i = 3; i < a.size(); i++) {
      const size_t eq = a[i].find(L'=');
      if (eq == std::wstring::npos) continue;
      d.fonctions.at(_wtoi(a[i].substr(0, eq).c_str())).distance = _wtof(a[i].substr(eq + 1).c_str());
      cas(utf8(a[i]));
    }
    fprintf(s, "]}\n");
  } catch (const std::exception& e) {
    fprintf(s, "{\"erreur\":\"%s\"}\n", e.what());
    fclose(s);
    return 1;
  }
  fclose(s);
  return 0;
}

// --reenregistrer <fichier> <sortie> [nFonction=valeur ...] : enregistre sans fenêtre, pour les essais.
// --conflit <fichier> : le fichier change après l'ouverture ; l'enregistrement doit refuser (code 3).
int modeEnregistrer(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    if (a[0] == L"--conflit") {
      FILE* f = _wfopen(a[1].c_str(), L"ab");
      if (!f) return 2;
      fputc(' ', f);
      fclose(f);
      d.fonctions.at(0).distance += 1;
      try {
        enregistrerProjet(d, a[1]);
      } catch (const FichierChangeAilleurs&) {
        return 3;
      }
      return 0;
    }
    for (size_t i = 3; i < a.size(); i++) {
      const size_t eq = a[i].find(L'=');
      if (eq != std::wstring::npos) d.fonctions.at(_wtoi(a[i].substr(0, eq).c_str())).distance = _wtof(a[i].substr(eq + 1).c_str());
    }
    enregistrerProjet(d, a[2]);
  } catch (const std::exception&) {
    return 1;
  }
  return 0;
}

// --coter <fichier> <sortie> <esquisse> <cote> <valeur> : change une cote comme le ferait la fenêtre, puis enregistre.
// Code 4 : valeur refusée par le solveur ; 5 : esquisse ou cote figée, avec la raison sur la sortie d'erreur.
int modeCoter(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const std::string id = utf8(a[3]);
    for (size_t i = 0; i < d.esquisses.size(); i++) {
      if (d.esquisses[i].id != id) continue;
      std::string raison = esquisseFigee(d, i);
      for (const Cote& c : d.esquisses[i].cotes)
        if (raison.empty() && c.id == utf8(a[4])) raison = coteFigee(c);
      if (!raison.empty()) {
        fprintf(stderr, "%s\n", raison.c_str());
        return 5;
      }
      Edition ed(d.esquisses[i]);
      if (!saisirCote(d, i, ed, utf8(a[4]), _wtof(a[5].c_str()), raison)) {
        fprintf(stderr, "%s\n", raison.c_str());
        return 4;
      }
      enregistrerProjet(d, a[2]);
      return 0;
    }
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}

class Appli : public wxApp {
 public:
  bool OnInit() override {
    SetAppearance(Appearance::Dark);  // comme le thème par défaut de la version navigateur
    auto* cadre = new Cadre;
    // Les captures ne doivent pas prendre la main sur ce que fait la personne devant le PC.
    if (!gArgs.empty() && gArgs[0] == L"--captures") cadre->ShowWithoutActivating();
    else cadre->Show();
    cadre->Update();
    // --protocole <fichier> <journal> [nb] : même suite de modifications que la version navigateur
    if (gArgs.size() >= 3 && gArgs[0] == L"--protocole") {
      const int nb = gArgs.size() >= 4 ? _wtoi(gArgs[3].c_str()) : 120;
      if (!cadre->lancerProtocole(gArgs[1], gArgs[2], nb)) return false;
    } else if (gArgs.size() >= 3 && gArgs[0] == L"--captures") {
      // --captures <fichier> <dossier> : une image par esquisse, puis fermeture
      wxImage::AddHandler(new wxPNGHandler);
      cadre->SetClientSize(cadre->FromDIP(wxSize(1500, 900)));
      cadre->ouvrir(gArgs[1]);
      cadre->capturerEsquisses(gArgs[2]);
      cadre->Close(true);
    } else if (!gArgs.empty()) {
      cadre->ouvrir(gArgs[0]);
    }
    return true;
  }
};
}  // namespace

wxIMPLEMENT_APP_NO_MAIN(Appli);

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR, int) {
  int argc = 0;
  wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  reglerParallele(true);
  for (int i = 1; i < argc; i++) {
    if (wcscmp(argv[i], L"--sequentiel") == 0) reglerParallele(false);
    else gArgs.push_back(argv[i]);
  }
  LocalFree(argv);
  if (!gArgs.empty() && gArgs[0] == L"--verif") return modeVerif(gArgs);
  if (gArgs.size() >= 3 && gArgs[0] == L"--reenregistrer") return modeEnregistrer(gArgs);
  if (gArgs.size() >= 2 && gArgs[0] == L"--conflit") return modeEnregistrer(gArgs);
  if (gArgs.size() >= 6 && gArgs[0] == L"--coter") return modeCoter(gArgs);
  // Processeurs à deux sortes de cœurs : un cœur économe calcule la même pièce 1,7 fois moins vite (345 → 585 ms mesurés).
  // On demande à Windows de ne pas traiter ce programme comme une tâche de fond, même quand sa fenêtre n'est pas devant.
  PROCESS_POWER_THROTTLING_STATE qos{PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED, 0};
  SetProcessInformation(GetCurrentProcess(), ProcessPowerThrottling, &qos, sizeof qos);
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  return wxEntry(inst, nullptr, nullptr, SW_SHOWNORMAL);
}
