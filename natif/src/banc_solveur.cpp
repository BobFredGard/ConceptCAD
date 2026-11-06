// Compare le solveur natif aux résultats de référence du navigateur (mesures/solveur-reference.cjs).
// BancSolveur <reference.json> <dossier Exemples> [seuil en mm] [--detail]
#include <windows.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <map>
#include <nlohmann/json.hpp>
#include <sstream>

#include "projet.h"
#include "solveur.h"

using json = nlohmann::json;

static std::wstring large(const std::string& s) {
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  std::wstring w(n - 1, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), n);
  return w;
}

struct Ecart {
  double max = 0;
  std::string ou;
};

int wmain(int argc, wchar_t** argv) {
  if (argc < 3) return 2;
  SetConsoleOutputCP(CP_UTF8);
  const double seuil = argc > 3 ? _wtof(argv[3]) : 1e-6;
  const bool detail = argc > 4;
  std::ifstream in(argv[1], std::ios::binary);
  std::stringstream ss;
  ss << in.rdbuf();
  const json ref = json::parse(ss.str());
  const std::wstring dossier = argv[2];

  std::map<std::string, Document> docs;
  long etapes = 0, justes = 0, scenarios = 0, refuses = 0, desaccords = 0, acceptees = 0, refusees = 0;
  long tranches[6] = {0, 0, 0, 0, 0, 0};  // < 1e-9, 1e-6, 1e-3, 0,05, 1, au-delà
  std::vector<std::pair<double, std::string>> pires;
  const auto t0 = std::chrono::steady_clock::now();

  for (const json& es : ref) {
    const std::string f = es["fichier"].get<std::string>(), id = es["esquisse"].get<std::string>();
    if (!docs.count(f)) docs.emplace(f, lireProjet(dossier + L"\\" + large(f)));
    Esquisse* s = docs.at(f).esquisse(id);
    if (!s) {
      printf("esquisse absente : %s %s\n", f.c_str(), id.c_str());
      return 2;
    }
    if (!Solveur(*s).prisEnCharge()) {
      refuses++;
      printf("refusée : %s %s (%s)\n", f.c_str(), id.c_str(), Solveur(*s).raisonRefus().c_str());
      continue;
    }
    for (const json& cas : es["cas"]) {
      scenarios++;
      const std::string type = cas["type"];
      Solveur S(*s);
      std::vector<double> pts, ray;
      double pireAvant = 0;
      const auto comparer = [&](const json& e, const std::string& quoi) {
        S.etat(pts, ray);
        etapes++;
        double m = 0;
        const auto& rp = e["pts"];
        const auto& rr = e["ray"];
        const auto& ri = e["ids"];
        const auto& mes = S.idsPoints();
        if (rp.size() != 2 * ri.size() || rr.size() != ray.size()) {
          printf("TAILLE différente %s %s %s\n", f.c_str(), id.c_str(), quoi.c_str());
          m = 1e9;
        } else {
          // Par identifiant : le navigateur retire au nettoyage (annulation) les points qui ne servent plus
          for (size_t k = 0; k < ri.size(); k++) {
            const std::string nom = ri[k].get<std::string>();
            const auto it = std::find(mes.begin(), mes.end(), nom);
            if (it == mes.end()) {
              m = 1e9;
              continue;
            }
            const size_t q = it - mes.begin();
            for (int c = 0; c < 2; c++) {
              const double d = std::abs(pts[2 * q + c] - rp[2 * k + c].get<double>());
              if (d > m || std::isnan(d)) m = d;
            }
          }
          for (size_t i = 0; i < ray.size(); i++) {
            const double d = std::abs(ray[i] - rr[i].get<double>());
            if (d > m || std::isnan(d)) m = d;
          }
        }
        const int t = m < 1e-9 ? 0 : m < 1e-6 ? 1 : m < 1e-3 ? 2 : m < 0.05 ? 3 : m < 1 ? 4 : 5;
        tranches[t]++;
        if (m > pireAvant) pireAvant = m;
        if (m <= seuil) justes++;
        else pires.push_back({m, f + " " + id + " " + type + " " + quoi});
      };
      if (type == "ouverture") {
        comparer(cas["etapes"][0], "avant résolution");
        S.resoudre();
        comparer(cas["etapes"][1], "après résolution");
      } else if (type == "cote") {
        S.resoudre();
        int k = 0;
        for (const json& e : cas["etapes"]) {
          S.poserCote(cas["cote"].get<std::string>(), e["valeur"].get<double>());
          S.resoudre();
          comparer(e, cas["cote"].get<std::string>() + " pas " + std::to_string(k++));
        }
      } else if (type == "saisies") {
        S.resoudre();
        int k = 0;
        Solveur::Saisie avant;
        for (const json& e : cas["etapes"]) {
          const std::string quoi = "saisie " + std::to_string(k++);
          if (e.contains("annule")) {
            S.annuler(avant);
            comparer(e, quoi + " annulée");
            continue;
          }
          avant = S.instantane();
          std::string raison;
          const bool ok = S.saisir(e["cote"].get<std::string>(), e["valeur"].get<double>(), &raison);
          if (ok != e["ok"].get<bool>() && !raison.empty()) printf("  raison du refus natif : %s\n", raison.c_str());
          if (ok != e["ok"].get<bool>()) {
            desaccords++;
            printf("DÉCISION différente %s %s %s (%s -> %g) : natif %d résidu %.3g, navigateur %d résidu %.3g ; pire écart avant %.3g mm\n", f.c_str(), id.c_str(), quoi.c_str(), e["cote"].get<std::string>().c_str(), e["valeur"].get<double>(), ok, S.residu(), !ok, e["res"].get<double>(), pireAvant);
          }
          if (e["ok"].get<bool>()) acceptees++;
          else refusees++;
          comparer(e, quoi + (ok ? "" : " (refus)"));
        }
      } else {
        S.resoudre();
        int k = 0;
        for (const json& e : cas["etapes"]) {
          S.deplacerProjections(e["dx"].get<double>(), e["dy"].get<double>());
          S.resoudre();
          comparer(e, "projection pas " + std::to_string(k++));
        }
      }
    }
  }
  const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  std::sort(pires.begin(), pires.end(), [](const auto& a, const auto& b) { return a.first > b.first; });
  printf("%zu esquisses (%ld refusées), %ld scénarios, %ld états comparés, %.1f s\n", ref.size(), refuses, scenarios, etapes, ms / 1000);
  printf("écart < 1e-9 mm : %ld | < 1e-6 : %ld | < 1e-3 : %ld | < 0,05 : %ld | < 1 : %ld | au-delà : %ld\n", tranches[0], tranches[1], tranches[2], tranches[3], tranches[4], tranches[5]);
  printf("saisies du navigateur : %ld acceptées, %ld refusées ; décisions différentes : %ld\n", acceptees, refusees, desaccords);
  printf("%ld états au-delà de %g mm\n", etapes - justes, seuil);
  const size_t n = detail ? pires.size() : std::min<size_t>(pires.size(), 40);
  for (size_t i = 0; i < n; i++) printf("  %.3g  %s\n", pires[i].first, pires[i].second.c_str());
  return justes == etapes && !desaccords ? 0 : 1;
}
