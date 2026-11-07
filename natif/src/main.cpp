// ConceptCAD natif : point d'entrée. Lance la fenêtre, ou le calcul sans fenêtre (--verif).
#include <wx/wx.h>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>

#include <chrono>
#include <cstdio>
#include <string>
#include <vector>

#include <shellapi.h>

#include <fstream>
#include <nlohmann/json.hpp>
#include <sstream>

#include "assemblage.h"
#include "cadre.h"
#include "conges.h"
#include "coter.h"
#include "dessin.h"
#include "enregistrer.h"
#include "mesure.h"
#include "normalises.h"
#include "parametres.h"

namespace {
std::vector<std::wstring> gArgs;

std::string utf8(const std::wstring& w) {
  int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
  std::string s(n > 0 ? n - 1 : 0, '\0');
  if (n > 1) WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, s.data(), n, nullptr, nullptr);
  return s;
}

// --normalises <cas.json> <sortie.json> : les pièces normalisées demandées, pour les comparer au navigateur
nlohmann::ordered_json decrirePiece(const normalises::Piece& sp) {
  using J = nlohmann::ordered_json;
  J r = J::object();
  r["key"] = sp.key;
  r["norm"] = sp.norm;
  r["desig"] = sp.desig;
  r["name"] = sp.name;
  r["info"] = sp.info;
  r["seat"] = sp.seat;
  r["sink"] = sp.sink;
  r["reach"] = sp.reach;
  r["etat"] = sp.st;
  J c = J::array();
  for (const normalises::Controle& k : sp.checks) c.push_back(J::array({k.ok, k.txt}));
  r["checks"] = c;
  if (sp.paire.empty()) r["doc"] = normalises::documentDe(sp);
  J p = J::array();
  for (const normalises::MembrePaire& m : sp.paire) {
    J q = J::object();
    q["key"] = m.sp.key;
    q["fr"] = assemblage::jsonDe(m.fr);
    q["doc"] = normalises::documentDe(m.sp);
    p.push_back(q);
  }
  r["paire"] = p;
  return r;
}
// --mesures : les mêmes paires que le navigateur, sans fenêtre
int modeMesures(const std::vector<std::wstring>& a) {
  using J = nlohmann::ordered_json;
  std::ifstream f(a[1], std::ios::binary);
  std::stringstream ss;
  ss << f.rdbuf();
  const J e = J::parse(ss.str());
  Document d = lireProjet(wxString::FromUTF8(e["piece"].get<std::string>()).ToStdWstring());
  const ResultatRejeu r = rejouer(d);
  std::vector<std::vector<TopoDS_Face>> faces;
  std::vector<std::vector<TopoDS_Edge>> aretes;
  for (const auto& c : r.corps) {
    faces.emplace_back();
    aretes.emplace_back();
    for (TopExp_Explorer ex(c.second, TopAbs_FACE); ex.More(); ex.Next()) faces.back().push_back(TopoDS::Face(ex.Current()));
    for (TopExp_Explorer ex(c.second, TopAbs_EDGE); ex.More(); ex.Next()) aretes.back().push_back(TopoDS::Edge(ex.Current()));
  }
  J sortie = J::array();
  const auto pnt = [](const J& v) { return gp_Pnt(v[0].get<double>(), v[1].get<double>(), v[2].get<double>()); };
  for (const J& c : e["cas"]) {
    J s = J::object();
    const size_t ca = c["ca"], cb = c["cb"], ia = c["a"], ib = c["b"];
    mesure::Dessin des;
    std::string texte;
    if (c["t"] == "f") {
      s["ok"] = mesure::mesurerFaces(mesure::geoFace(faces[ca][ia]), pnt(c["pa"]), mesure::geoFace(faces[cb][ib]), pnt(c["pb"]), des, texte);
    } else {
      const mesure::GeoArete A = mesure::geoArete(mesure::pointsArete(aretes[ca][ia])), B = mesure::geoArete(mesure::pointsArete(aretes[cb][ib]));
      s["ok"] = true;
      s["desc"] = mesure::decrireArete(A);
      texte = mesure::mesurerAretes(A, B, des);
    }
    s["texte"] = texte;
    sortie.push_back(s);
  }
  std::ofstream o(a[2], std::ios::binary);
  o << sortie.dump(0, ' ', false, J::error_handler_t::replace);
  return 0;
}
int modeNormalises(const std::vector<std::wstring>& a) {
  using J = nlohmann::ordered_json;
  std::ifstream f(a[1], std::ios::binary);
  std::stringstream ss;
  ss << f.rdbuf();
  const J cas = J::parse(ss.str());
  std::ofstream s(a[2], std::ios::binary);
  s << "[\n";
  bool premier = true;
  for (const J& c : cas) {
    J r = J::object();
    const std::string cat = c["cat"].get<std::string>();
    const J etat = normalises::etatNormalise(cat, c["st"]);
    J opts = J::object();
    for (const normalises::Champ& ch : normalises::categorie(cat).champs) {
      if (ch.visible && !ch.visible(etat)) continue;
      J o = J::array();
      for (const normalises::Option& q : ch.options(etat)) o.push_back(J::array({q.v, q.lib}));
      opts[ch.k] = o;
    }
    r["opts"] = opts;
    try {
      r["p"] = decrirePiece(normalises::specification(cat, c["st"]));
    } catch (const std::exception& e) {
      r["err"] = e.what();
      r["etat"] = etat;
    }
    s << (premier ? "" : ",\n") << r.dump(-1, ' ', false, J::error_handler_t::replace);
    premier = false;
  }
  s << "\n]\n";
  return 0;
}

// --verif <fichier> <sortie.json> [nFonction=valeur ...] : calcule sans fenêtre, écrit les mesures.
// Le solide de chaque corps après chaque fonction, pour trouver où deux programmes se séparent
int modeEtapes(const std::vector<std::wstring>& a) {
  if (a.size() < 3) return 2;
  FILE* s = _wfopen(a[2].c_str(), L"wb");
  if (!s) return 2;
  Document d = lireProjet(a[1]);
  fprintf(s, "[");
  bool premier = true;
  for (size_t n = 0; n < d.fonctions.size(); n++) {
    if (!d.fonctions[n].visible) continue;
    const ResultatRejeu r = rejouer(d, static_cast<int>(n) + 1);
    fprintf(s, "%s{\"id\":\"%s\",\"corps\":{", premier ? "" : ",\n", d.fonctions[n].id.c_str());
    premier = false;
    bool v = false;
    for (const auto& c : r.corps) {
      const Mesures m = mesurer(c.second);
      fprintf(s, "%s\"%s\":[%.6f,%d]", v ? "," : "", c.first.c_str(), m.volume, m.faces);
      v = true;
    }
    fprintf(s, "}}");
    fflush(s);
  }
  fprintf(s, "]");
  fclose(s);
  return 0;
}
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
    std::function<void()> ecrireAssemblage = [] {};
    auto cas = [&](const std::string& nom) {
      const auto t0 = std::chrono::steady_clock::now();
      ResultatRejeu r = rejouer(d);
      const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
      Mesures m = mesurer(r.forme);
      fprintf(s, "%s{\"textes\":[", premier ? "" : ",");
      for (size_t k = 0; k < r.messages.size(); k++) {
        std::string t = r.messages[k];
        for (char& c : t)
          if (c == '"' || c == '\\' || static_cast<unsigned char>(c) < 32) c = ' ';
        fprintf(s, "%s\"%s\"", k ? "," : "", t.c_str());
      }
      fprintf(s, "],\"construction\":[");
      {
        bool v = false;
        for (const ElementConstruction& e : d.construction) {
          nlohmann::json l = {{"id", e.id}, {"fr", e.j.contains("fr") ? nlohmann::json::parse(e.j["fr"].dump()) : nlohmann::json()}, {"st", e.j.value("st", std::string())}};
          fprintf(s, "%s%s", v ? "," : "", l.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace).c_str());
          v = true;
        }
      }
      fprintf(s, "],\"nom\":\"%s\",\"volume\":%.9f,\"aire\":%.9f,\"faces\":%d,\"aretes\":%d,\"sommets\":%d,\"solides\":%d,\"valide\":%s,\"boite\":[%.6f,%.6f,%.6f,%.6f,%.6f,%.6f],\"ms\":%.3f,\"messages\":%zu}",
              nom.c_str(), m.volume, m.aire, m.faces, m.aretes, m.sommets, m.solides, m.valide ? "true" : "false",
              m.boite[0], m.boite[1], m.boite[2], m.boite[3], m.boite[4], m.boite[5], ms, r.messages.size());
      premier = false;
    };
    cas("tel quel");
    ecrireAssemblage = [&] {
      if (!d.assemblage) return;
      assemblage::Solides S;
      const ResultatRejeu r = rejouer(d);
      assemblage::majSolides(S, d, r);
      assemblage::resoudre(*d.assemblage, S);
      nlohmann::ordered_json j = nlohmann::ordered_json::object();
      j["actif"] = assemblage::actif(*d.assemblage);
      j["instances"] = nlohmann::ordered_json::array();
      for (const assemblage::Instance& i : assemblage::instances(*d.assemblage, assemblage::racine(*d.assemblage))) {
        nlohmann::ordered_json l = nlohmann::ordered_json::object();
        l["path"] = i.chemin;
        l["comp"] = i.comp;
        l["F"] = assemblage::jsonDe(i.F);
        if (!i.chemin.empty())
          if (const auto* o = assemblage::occurrence(*d.assemblage, i.chemin.back())) {
            l["st"] = o->value("st", std::string());
            l["msg"] = o->value("msg", std::string());
          }
        j["instances"].push_back(l);
      }
      j["comps"] = nlohmann::ordered_json::object();
      for (const auto& [id, s] : S) {
        const Mesures m = mesurer(s->forme);
        nlohmann::ordered_json l = nlohmann::ordered_json::object();
        l["volume"] = m.volume;
        l["faces"] = m.faces;
        l["solides"] = m.solides;
        l["messages"] = s->messages;
        l["accroches"] = assemblage::accrochesDe(*s).size();
        j["comps"][id] = l;
      }
      fprintf(s, ",\"assemblage\":%s", j.dump(-1, ' ', false, nlohmann::ordered_json::error_handler_t::replace).c_str());
    };
    for (size_t i = 3; i < a.size(); i++) {
      const size_t eq = a[i].find(L'=');
      if (eq == std::wstring::npos) continue;
      d.fonctions.at(_wtoi(a[i].substr(0, eq).c_str())).distance = _wtof(a[i].substr(eq + 1).c_str());
      cas(utf8(a[i]));
    }
    fprintf(s, "]");
    ecrireAssemblage();
    fprintf(s, "}\n");
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

// --formule <fichier> <sortie> <esquisse> <cote> <texte> : la saisie telle que tapée, « [nom =] valeur|expression »
int modeFormule(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const std::string id = utf8(a[3]);
    for (size_t i = 0; i < d.esquisses.size(); i++) {
      if (d.esquisses[i].id != id) continue;
      std::string raison = esquisseFigee(d, i);
      if (!raison.empty()) {
        fprintf(stderr, "%s\n", raison.c_str());
        return 5;
      }
      Edition ed(d.esquisses[i]);
      if (!saisirCoteTexte(d, i, ed, utf8(a[4]), utf8(a[5]), raison)) {
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
// --parametre <fichier> <sortie> <nom> <expression> : parSetParam, ou un nouveau paramètre si le nom n'existe pas
int modeParametre(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const EtatFormules avant(d);
    const std::string nom = utf8(a[3]);
    std::string raison;
    Parametre* p = nullptr;
    for (Parametre& q : d.params)
      if (q.nom == nom) p = &q;
    if (!p) {
      raison = parControleNom(d, nom, nullptr, nullptr, nullptr);
      if (raison.empty()) {
        d.params.push_back(Parametre{nom, "10", "", 10, true});
        p = &d.params.back();
      }
    }
    if (raison.empty()) raison = parReglerParametre(d, *p, utf8(a[4]));
    if (!raison.empty()) {
      fprintf(stderr, "%s\n", raison.c_str());
      return 4;
    }
    if (!appliquerFormules(d, avant, -1, nullptr, raison)) {
      fprintf(stderr, "%s\n", raison.c_str());
      return 4;
    }
    enregistrerProjet(d, a[2]);
    return 0;
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}
// --evaluer <liste.json> <sortie.json> : parEval sur une liste de textes, avec les noms donnés dans le fichier
int modeEvaluer(const std::vector<std::wstring>& a) {
  try {
    const nlohmann::json j = nlohmann::json::parse(lireOctets(a[1]));
    const auto chercher = [&](const std::string& n) -> double {
      if (!j["noms"].contains(n)) throw std::runtime_error("« " + n + " » inconnu");
      return j["noms"][n].get<double>();
    };
    nlohmann::json sortie = nlohmann::json::array();
    for (const auto& t : j["textes"]) {
      nlohmann::json r;
      r["t"] = t;
      try {
        r["v"] = parEval(t.get<std::string>(), chercher);
      } catch (const std::exception& e) {
        r["e"] = e.what();
      }
      r["n"] = parEstNombre(t.get<std::string>());
      sortie.push_back(r);
    }
    const std::string texte = sortie.dump();
    FILE* f = _wfopen(a[2].c_str(), L"wb");
    if (!f) return 1;
    fwrite(texte.data(), 1, texte.size(), f);
    fclose(f);
    return 0;
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}

// --nouvelle-esquisse <fichier> <sortie> <XY|XZ|YZ|rang de face> : crée l'esquisse vide et enregistre.
// --esquisses-faces <fichier> <sortie.json> : ce que donnerait chaque face plane, pour comparer au navigateur.
TopoDS_Face faceDeRang(const TopoDS_Shape& forme, int rang) {
  int k = 0;
  for (TopExp_Explorer x(forme, TopAbs_FACE); x.More(); x.Next())
    if (k++ == rang) return TopoDS::Face(x.Current());
  return TopoDS_Face();
}
int modeNouvelleEsquisse(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const std::string quoi = utf8(a[3]);
    Esquisse s;
    if (quoi == "XY" || quoi == "XZ" || quoi == "YZ") {
      s = nouvelleEsquissePlan(d, quoi);
    } else {
      const TopoDS_Shape forme = rejouer(d).forme;
      const TopoDS_Face f = faceDeRang(forme, std::stoi(quoi));
      if (f.IsNull() || !nouvelleEsquisseFace(d, forme, f, s)) return 5;
    }
    d.esquisses.push_back(std::move(s));
    enregistrerProjet(d, a[2]);
    return 0;
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}
// --extruder <fichier> <sortie> <rang d'esquisse> <profondeur> <add|cut> [mid] [flip] [through] : crée l'extrusion par les mêmes réglages que le panneau, et enregistre.
int modeExtruder(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const size_t rang = std::stoul(a[3]);
    if (rang >= d.esquisses.size()) return 5;
    Esquisse& s = d.esquisses[rang];
    Fonction f = nouvelleExtrusion(d, s);
    reglerOperation(f, utf8(a[5]));
    reglerProfondeur(f, _wtof(a[4].c_str()));
    for (size_t i = 6; i < a.size(); i++) {
      if (a[i] == L"mid") f.mid = true;
      if (a[i] == L"flip") f.flip = true;
      if (a[i] == L"through") reglerATravers(f, true);
    }
    f.nom = nomExtrusion(d, f);
    d.fonctions.push_back(std::move(f));
    s.visible = false;
    enregistrerProjet(d, a[2]);
    return 0;
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}
// --conge <fichier> <sortie.conceptcad> <gestes.json> <rapport.json> : le choix des arêtes sans fenêtre, comparé au navigateur par tester-conges-gestes.cjs.
int modeConge(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const ResultatRejeu r = rejouer(d);
    std::ifstream entree(a[3]);
    const nlohmann::json j = nlohmann::json::parse(entree);
    ChoixConge c(d, r.forme, j.value("chanfrein", false), j.value("r", 2.0), j.value("tangent", true));
    nlohmann::json sortie, vives = nlohmann::json::array(), lisses = nlohmann::json::array();
    for (auto& e : c.vives()) {
      nlohmann::json l = {{"mid", e.mid}, {"len", e.len}};
      AncreArete an;
      if (ancrePour(d, e.mid, an) && an.existe) {
        l["ancre"] = {{"t", an.t}, {"sk", an.sk}, {"id", an.id}, {"z", an.z}, {"far", an.loin ? 1 : 0}};
        if (an.aSide) {
          l["ancre"]["side"] = an.side;
          l["ancre"]["dist"] = an.dist;
        }
      }
      vives.push_back(std::move(l));
    }
    for (auto& e : c.lisses()) lisses.push_back({{"mid", e.mid}, {"len", e.len}});
    sortie["vives"] = vives;
    sortie["lisses"] = lisses;
    if (j.contains("mids")) {
      for (const auto& m : j["mids"]) {
        int b = -1;
        double bd = 1e-3;
        for (size_t i = 0; i < c.vives().size(); i++) {
          const auto& v = c.vives()[i].mid;
          const double e = std::abs(v[0] - m[0].get<double>()) + std::abs(v[1] - m[1].get<double>()) + std::abs(v[2] - m[2].get<double>());
          if (e < bd) {
            bd = e;
            b = static_cast<int>(i);
          }
        }
        if (b >= 0) c.basculer(b);
      }
      const ApercuConge& ap = c.apercu();
      sortie["apercu"] = !ap.forme.IsNull();
      sortie["nouvelles"] = ap.nouvelles.size();
      sortie["message"] = ap.message;
      if (!ap.forme.IsNull()) {
        const Mesures me = mesurer(ap.forme);
        sortie["apercuVolume"] = me.volume;
        sortie["apercuFaces"] = me.faces;
      }
      if (!c.selection().empty()) {
        Fonction f = c.creer(d, r.corps);
        d.fonctions.push_back(std::move(f));
        rejouer(d);
        enregistrerProjet(d, a[2]);
        sortie["ecrit"] = true;
      }
    }
    std::ofstream(a[4]) << sortie.dump();
    return 0;
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}
int modeEsquissesFaces(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const TopoDS_Shape forme = rejouer(d).forme;
    nlohmann::json liste = nlohmann::json::array();
    int rang = -1;
    for (TopExp_Explorer x(forme, TopAbs_FACE); x.More(); x.Next()) {
      rang++;
      const TopoDS_Face f = TopoDS::Face(x.Current());
      Document c = d;
      Esquisse s;
      double p[3];
      if (!pointDansFace(f, p) || !nouvelleEsquisseFace(c, forme, f, s)) continue;
      nlohmann::json j{{"rang", rang}, {"point", {p[0], p[1], p[2]}}, {"name", s.nom}, {"origin", s.o}, {"axU", s.u}, {"axV", s.v}, {"axN", s.n}, {"at", s.at}};
      if (s.hote.existe) {
        j["host"] = {{"feat", s.hote.feat}, {"tag", s.hote.tag}, {"x", s.hote.x}, {"y", s.hote.y}, {"name", s.hote.nom}};
        if (s.hote.tag == "SIDE") {
          j["host"]["edge"] = s.hote.edge;
          j["host"]["h"] = s.hote.h;
        }
      }
      liste.push_back(j);
    }
    std::ofstream(a[2].c_str(), std::ios::binary) << liste.dump();
    return 0;
  } catch (const std::exception& e) {
    fprintf(stderr, "%s\n", e.what());
  }
  return 1;
}

// --dessiner <fichier> <sortie> <esquisse> <gestes.json> : rejoue des gestes comme le ferait la fenêtre, puis enregistre.
int modeDessiner(const std::vector<std::wstring>& a) {
  try {
    Document d = lireProjet(a[1]);
    const std::string id = utf8(a[3]);
    std::ifstream in(a[4].c_str(), std::ios::binary);
    std::stringstream ss;
    ss << in.rdbuf();
    const nlohmann::json script = nlohmann::json::parse(ss.str());
    for (size_t i = 0; i < d.esquisses.size(); i++) {
      if (d.esquisses[i].id != id) continue;
      const std::string raison = esquisseFigee(d, i);
      if (!raison.empty()) {
        fprintf(stderr, "%s\n", raison.c_str());
        return 5;
      }
      Edition ed(d.esquisses[i]);
      Dessin D(d.esquisses[i], ed);
      D.vue(script.value("s", 1.0));
      D.premiere();
      for (const auto& st : script["pas"]) {
        const std::string g = st["a"];
        const double x = st.value("x", 0.0), y = st.value("y", 0.0);
        if (g == "outil") {
          const std::string o = st["o"];
          D.choisirOutil(o == "coincident" ? Dessin::COINCIDENT : o == "fillet" ? Dessin::CONGE : o == "chamfer" ? Dessin::CHANFREIN : o == "slot" ? Dessin::OBLONG : o == "polygon" ? Dessin::POLYGONE : o == "cpoint" ? Dessin::POINT_C : o == "hpoint" ? Dessin::PERCAGE : o == "line" ? Dessin::LIGNE : o == "rect" ? Dessin::RECTANGLE : o == "circle" ? Dessin::CERCLE : o == "arc" ? Dessin::ARC : Dessin::SELECTION);
        } else if (g == "bas") {
          D.enfonce(x, y, st.value("c", false));
        } else if (g == "bouge") {
          D.bouge(x, y);
        } else if (g == "haut") {
          D.relache(x, y);
        } else if (g == "dbl") {
          D.doubleClic(x, y);
        } else if (g == "echap") {
          D.echap();
        } else if (g == "suppr") {
          D.supprimer();
        }
      }
      suivreEsquisses(d, i);
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
    if ((!gArgs.empty() && (gArgs[0] == L"--captures" || gArgs[0] == L"--essai-conge" || gArgs[0] == L"--essai-esquisse" || gArgs[0] == L"--image3d")) || _wgetenv(L"CONCEPTCAD_SANS_ACTIVER")) cadre->ShowWithoutActivating();
    else cadre->Show();
    cadre->Update();
    // --protocole <fichier> <journal> [nb] : même suite de modifications que la version navigateur
    if (gArgs.size() >= 3 && gArgs[0] == L"--protocole") {
      const int nb = gArgs.size() >= 4 ? _wtoi(gArgs[3].c_str()) : 120;
      if (!cadre->lancerProtocole(gArgs[1], gArgs[2], nb)) return false;
    } else if (gArgs.size() >= 6 && gArgs[0] == L"--essai-esquisse") {
      // --essai-esquisse <fichier> <rang, -1 : nouvelle sur XY> <sortie> <etapes.json> <dossier>
      wxImage::AddHandler(new wxPNGHandler);
      cadre->SetClientSize(cadre->FromDIP(wxSize(1500, 900)));
      cadre->Update();
      wxYield();
      if (!cadre->essaiEsquisse(gArgs[1], _wtoi(gArgs[2].c_str()), gArgs[3], gArgs[4], gArgs[5])) exit(3);
      cadre->Close(true);
    } else if (gArgs.size() >= 5 && gArgs[0] == L"--essai-conge") {
      // --essai-conge <fichier> <sortie> <gestes.json> <dossier> : de vrais clics dans la vue, des images, puis fermeture
      wxImage::AddHandler(new wxPNGHandler);
      cadre->SetClientSize(cadre->FromDIP(wxSize(1500, 900)));
      cadre->Update();
      wxYield();
      if (!cadre->essaiGestesConge(gArgs[1], gArgs[2], gArgs[3], gArgs[4])) exit(3);
      cadre->Close(true);
    } else if (gArgs.size() >= 3 && gArgs[0] == L"--image3d") {
      // --image3d <fichier> <image.png> : la vue 3D dans une image, à comparer à la version navigateur, puis fermeture
      cadre->SetClientSize(cadre->FromDIP(wxSize(1500, 900)));
      cadre->ouvrir(gArgs[1]);
      wxYield();
      cadre->imageVue3D(gArgs[2]);
      cadre->Close(true);
    } else if (gArgs.size() >= 3 && gArgs[0] == L"--captures") {
      // --captures <fichier> <dossier> : une image par esquisse, puis fermeture
      wxImage::AddHandler(new wxPNGHandler);
      cadre->SetClientSize(cadre->FromDIP(wxSize(1500, 900)));
      cadre->ouvrir(gArgs[1]);
      cadre->capturerEsquisses(gArgs[2]);
      cadre->Close(true);
    } else if (!gArgs.empty()) {
      cadre->ouvrir(gArgs[0]);
      // Pour natif/mesures/verifier-dessin.ps1 : un double-clic dans l'arbre ne passe pas par des messages envoyés de l'extérieur
      if (const wchar_t* rang = _wgetenv(L"CONCEPTCAD_OUVRIR_ESQUISSE")) cadre->entrerEsquisse(_wtoi(rang));
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
  if (gArgs.size() >= 3 && gArgs[0] == L"--normalises") return modeNormalises(gArgs);
  if (gArgs.size() >= 3 && gArgs[0] == L"--mesures") return modeMesures(gArgs);
  if (!gArgs.empty() && gArgs[0] == L"--etapes") return modeEtapes(gArgs);
  if (gArgs.size() >= 3 && gArgs[0] == L"--reenregistrer") return modeEnregistrer(gArgs);
  if (gArgs.size() >= 2 && gArgs[0] == L"--conflit") return modeEnregistrer(gArgs);
  if (gArgs.size() >= 6 && gArgs[0] == L"--coter") return modeCoter(gArgs);
  if (gArgs.size() >= 6 && gArgs[0] == L"--formule") return modeFormule(gArgs);
  if (gArgs.size() >= 5 && gArgs[0] == L"--parametre") return modeParametre(gArgs);
  if (gArgs.size() >= 3 && gArgs[0] == L"--evaluer") return modeEvaluer(gArgs);
  if (gArgs.size() >= 5 && gArgs[0] == L"--dessiner") return modeDessiner(gArgs);
  if (gArgs.size() >= 4 && gArgs[0] == L"--nouvelle-esquisse") return modeNouvelleEsquisse(gArgs);
  if (gArgs.size() >= 3 && gArgs[0] == L"--esquisses-faces") return modeEsquissesFaces(gArgs);
  if (gArgs.size() >= 6 && gArgs[0] == L"--extruder") return modeExtruder(gArgs);
  if (gArgs.size() >= 5 && gArgs[0] == L"--conge") return modeConge(gArgs);
  // Processeurs à deux sortes de cœurs : un cœur économe calcule la même pièce 1,7 fois moins vite (345 → 585 ms mesurés).
  // On demande à Windows de ne pas traiter ce programme comme une tâche de fond, même quand sa fenêtre n'est pas devant.
  PROCESS_POWER_THROTTLING_STATE qos{PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED, 0};
  SetProcessInformation(GetCurrentProcess(), ProcessPowerThrottling, &qos, sizeof qos);
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  return wxEntry(inst, nullptr, nullptr, SW_SHOWNORMAL);
}
