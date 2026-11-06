// Rejoue dans le natif les gestes de mesures/dessin-reference.cjs et compare toute l'esquisse après chacun.
// BancDessin <reference.json> <dossier Exemples> [seuil en mm] [--detail]
#include <windows.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <map>
#include <nlohmann/json.hpp>
#include <sstream>

#include "dessin.h"
#include "enregistrer.h"
#include "projet.h"

using json = nlohmann::json;

static std::wstring large(const std::string& s) {
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  std::wstring w(n - 1, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), n);
  return w;
}

static std::string structure(const Esquisse& s) {
  std::ostringstream o;
  o << s.seq << '#';
  for (size_t i = 0; i < s.ordre.size(); i++) o << (i ? "," : "") << s.ordre[i];
  o << '#';
  for (size_t i = 0; i < s.entites.size(); i++) {
    const Entite& e = s.entites[i];
    o << (i ? ";" : "") << e.id << ',' << e.t << ',' << e.p1 << ',' << e.p2 << ',' << e.pc << ',' << e.pa << ',' << e.pb << ',' << e.p << ',' << (e.construction ? 1 : 0);
  }
  o << '#';
  for (size_t i = 0; i < s.contraintes.size(); i++) {
    const Contrainte& c = s.contraintes[i];
    o << (i ? ";" : "") << c.id << ',' << c.type << ',' << c.p << ',' << c.line << ',' << c.ent << ',' << c.a << ',' << c.b << ',' << c.mid << ',' << c.c << ',' << c.d << ',' << (c.inf ? 1 : 0);
  }
  o << '#';
  for (size_t i = 0; i < s.cotes.size(); i++) {
    const Cote& d = s.cotes[i];
    o << (i ? ";" : "") << d.id << ',' << d.type << ',' << d.line << ',' << d.ent << ',' << d.a << ',' << d.b << ',' << d.p << ',' << d.orient << ',' << (d.ref ? 1 : 0) << ',' << (d.chk ? 1 : 0) << ',' << (d.dia ? 1 : 0) << ',' << d.sgn << ',' << d.ccw;
  }
  return o.str();
}

// Le premier endroit où deux états diffèrent, assez pour comprendre
static std::string difference(const std::string& a, const std::string& b) {
  size_t i = 0;
  while (i < a.size() && i < b.size() && a[i] == b[i]) i++;
  const size_t d = i > 30 ? i - 30 : 0;
  return "natif …" + a.substr(d, 90) + "… navigateur …" + b.substr(d, 90) + "…";
}

// Deux JSON égaux à seuil près ; un champ absent vaut false, 0 ou null. Rend le chemin du premier écart.
static std::string ecartJson(const json& a, const json& b, double seuil, const std::string& ou) {
  if (a.is_number() && b.is_number()) return std::abs(a.get<double>() - b.get<double>()) <= seuil ? "" : ou;
  if (a.is_object() && b.is_object()) {
    for (const auto& [k, v] : a.items()) {
      const auto it = b.find(k);
      const std::string e = it != b.end() ? ecartJson(v, *it, seuil, ou + "." + k) : (v.is_null() || v == false || v == 0) ? "" : ou + "." + k + " (seulement à gauche)";
      if (!e.empty()) return e;
    }
    for (const auto& [k, v] : b.items())
      if (!a.contains(k) && !(v.is_null() || v == false || v == 0)) return ou + "." + k + " (seulement à droite)";
    return "";
  }
  if (a.is_array() && b.is_array()) {
    if (a.size() != b.size()) return ou + " (taille)";
    for (size_t i = 0; i < a.size(); i++) {
      const std::string e = ecartJson(a[i], b[i], seuil, ou + "[" + std::to_string(i) + "]");
      if (!e.empty()) return e;
    }
    return "";
  }
  return a == b ? "" : ou;
}

int wmain(int argc, wchar_t** argv) {
  if (argc < 3) return 2;
  SetConsoleOutputCP(CP_UTF8);
  const double seuil = argc > 3 ? _wtof(argv[3]) : 1e-6;
  const bool detail = argc > 4;
  std::ifstream in(argv[1], std::ios::binary);
  std::stringstream ss;
  ss << in.rdbuf();
  const json ref = json::parse(ss.str());
  ss.str("");
  const std::wstring dossier = argv[2];

  std::map<std::string, Document> docs;
  long nSessions = 0, nEtats = 0, refusees = 0, sessionsOk = 0;
  long tranches[6] = {0, 0, 0, 0, 0, 0};
  std::map<std::string, long> parGeste, fautesGeste;
  std::vector<std::string> fautes;
  std::vector<std::pair<double, std::string>> pires;
  const auto t0 = std::chrono::steady_clock::now();
  std::map<std::string, std::string> textes;
  std::map<std::string, json> lus;
  long ecritOk = 0, ecritFaux = 0;
  std::vector<std::string> fautesEcrit;

  for (const json& es : ref) {
    const std::string f = es["fichier"].get<std::string>(), id = es["esquisse"].get<std::string>();
    Esquisse base;
    if (id == "(vide)") {
      base.id = id;
    } else {
      if (!docs.count(f)) docs.emplace(f, lireProjet(dossier + L"\\" + large(f)));
      Esquisse* s = docs.at(f).esquisse(id);
      if (!s) {
        printf("esquisse absente : %s %s\n", f.c_str(), id.c_str());
        return 2;
      }
      base = *s;
    }
    if (!Solveur(base).prisEnCharge()) {
      refusees++;
      continue;
    }
    for (const json& se : es["sessions"]) {
      nSessions++;
      Esquisse s = base;
      Edition ed(s);
      Dessin D(s, ed);
      D.vue(se["s"].get<double>());
      D.premiere();
      bool bonne = true;
      std::string geste;
      long rang = 0;
      for (const json& st : se["pas"]) {
        rang++;
        const std::string a = st["a"];
        if (st.contains("geste")) geste = st["geste"];
        const double x = st.contains("x") ? st["x"].get<double>() : 0, y = st.contains("y") ? st["y"].get<double>() : 0;
        if (a == "outil") {
          const std::string o = st["o"];
          D.choisirOutil(o == "line" ? Dessin::LIGNE : o == "rect" ? Dessin::RECTANGLE : o == "circle" ? Dessin::CERCLE : o == "arc" ? Dessin::ARC : o == "dim" ? Dessin::COTE : o == "trim" ? Dessin::AJUSTER : o == "offset" ? Dessin::DECALER : Dessin::SELECTION);
        } else if (a == "bas") {
          D.enfonce(x, y, st.value("c", false));
        } else if (a == "bouge") {
          D.bouge(x, y);
        } else if (a == "haut") {
          D.relache(x, y);
        } else if (a == "dbl") {
          D.doubleClic(x, y);
        } else if (a == "echap") {
          D.echap();
        } else if (a == "suppr") {
          D.supprimer();
        } else if (a == "con") {
          D.poserContrainte(st["t"].get<std::string>());
        } else if (a == "f1") {
          D.toucheF1();
        } else if (a == "f2") {
          D.toucheF2();
        } else if (a == "touche") {
          const std::string k = st["k"];
          if (k == "Enter") {
            if (!D.entree() && D.outil() == Dessin::COTE) D.poserCoteIci();
          } else if (k == "Tab") {
            D.tabulation();
          } else if (k == "Backspace") {
            if (!D.retourArriere()) D.supprimer();
          } else if (!D.caractere(k[0]) && D.outil() == Dessin::COTE && D.poseEnCours()) {
            D.poserCoteIci();
          }
        }
        if (!st.contains("etat")) continue;
        nEtats++;
        parGeste[geste]++;
        const json& e = st["etat"];
        const std::string ou = f + " " + id + " graine " + std::to_string(se["graine"].get<int>()) + " pas " + std::to_string(rang) + " " + geste;
        const std::string mien = structure(s), sien = e["st"];
        if (mien != sien) {
          fautes.push_back(ou + " : STRUCTURE " + difference(mien, sien));
          fautesGeste[geste]++;
          bonne = false;
          break;  // la suite ne prouverait plus rien
        }
        double m = 0;
        const auto& rp = e["pts"];
        for (size_t k = 0; k < s.ordre.size(); k++) {
          const Pt& q = s.points.at(s.ordre[k]);
          m = std::max(m, std::max(std::abs(q.x - rp[2 * k].get<double>()), std::abs(q.y - rp[2 * k + 1].get<double>())));
        }
        size_t nr = 0;
        for (const Entite& en : s.entites)
          if (en.t == "circle" || en.t == "arc") m = std::max(m, std::abs(en.r - e["ray"][nr++].get<double>()));
        for (size_t k = 0; k < s.cotes.size(); k++) m = std::max(m, std::abs(s.cotes[k].value - e["val"][k].get<double>()));
        const int t = m < 1e-9 ? 0 : m < 1e-6 ? 1 : m < 1e-3 ? 2 : m < 0.05 ? 3 : m < 1 ? 4 : 5;
        tranches[t]++;
        if (!(m <= seuil)) {
          pires.push_back({m, ou});
          fautesGeste[geste]++;
          bonne = false;
          break;
        }
      }
      if (bonne) sessionsOk++;
      // Ce que le natif écrirait pour cette session : l'esquisse comme le navigateur, tout le reste intact
      if (bonne && id != "(vide)" && se.contains("final")) {
        const std::string ou = f + " " + id + " graine " + std::to_string(se["graine"].get<int>());
        try {
          Document& d = docs.at(f);
          if (!textes.count(f)) {
            textes[f] = d.compresse ? degonfler(d.octets) : d.octets;
            lus[f] = json::parse(textes[f]);
          }
          size_t rang = 0;
          while (d.esquisses[rang].id != id) rang++;
          const Esquisse garde = d.esquisses[rang];
          d.esquisses[rang] = s;
          std::string texte;
          try {
            texte = texteEnregistre(d, textes[f]);
          } catch (...) {
            d.esquisses[rang] = garde;
            throw;
          }
          d.esquisses[rang] = garde;
          const json nouveau = json::parse(texte);
          const json& ancien = lus[f];
          const bool lot = ancien.contains("doc") && ancien["doc"].is_object();
          const json& A = lot ? nouveau["doc"] : nouveau;
          const json& B = lot ? ancien["doc"] : ancien;
          std::string e = ecartJson(A["sketches"][rang], se["final"], seuil < 1e-6 ? 1e-6 : seuil, "esquisse");
          for (const auto& [k, v] : B.items())
            if (e.empty() && k != "sketches" && !(A.contains(k) && A[k] == v)) e = "document." + k + " a changé";
          for (size_t i = 0; e.empty() && i < B["sketches"].size(); i++)
            if (i != rang && A["sketches"][i] != B["sketches"][i]) e = "une autre esquisse a changé";
          if (lot)
            for (const auto& [k, v] : ancien.items())
              if (e.empty() && k != "doc" && !(nouveau.contains(k) && nouveau[k] == v)) e = "fichier." + k + " a changé";
          if (e.empty()) {
            ecritOk++;
          } else {
            ecritFaux++;
            fautesEcrit.push_back(ou + " : " + e);
          }
        } catch (const std::exception& x) {
          ecritFaux++;
          fautesEcrit.push_back(ou + " : refus : " + x.what());
        }
      }
    }
  }
  const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  std::sort(pires.begin(), pires.end(), [](const auto& a, const auto& b) { return a.first > b.first; });
  printf("%zu esquisses (%ld refusées), %ld sessions, %ld identiques jusqu'au bout, %ld états comparés, %.1f s\n", ref.size(), refusees, nSessions, sessionsOk, nEtats, ms / 1000);
  printf("écart < 1e-9 mm : %ld | < 1e-6 : %ld | < 1e-3 : %ld | < 0,05 : %ld | < 1 : %ld | au-delà : %ld\n", tranches[0], tranches[1], tranches[2], tranches[3], tranches[4], tranches[5]);
  for (const auto& [g, n] : parGeste) printf("  %-14s %6ld états, %ld arrêts sur un écart\n", g.c_str(), n, fautesGeste[g]);
  printf("%zu écarts de structure, %zu au-delà de %g mm\n", fautes.size(), pires.size(), seuil);
  const size_t lim = detail ? 100000 : 25;
  for (size_t i = 0; i < fautes.size() && i < lim; i++) printf("  %s\n", fautes[i].c_str());
  for (size_t i = 0; i < pires.size() && i < lim; i++) printf("  %.3g  %s\n", pires[i].first, pires[i].second.c_str());
  printf("enregistrement : %ld sessions écrites comme le navigateur, %ld écarts\n", ecritOk, ecritFaux);
  for (size_t i = 0; i < fautesEcrit.size() && i < lim; i++) printf("  %s\n", fautesEcrit[i].c_str());
  return sessionsOk == nSessions && !ecritFaux ? 0 : 1;
}
