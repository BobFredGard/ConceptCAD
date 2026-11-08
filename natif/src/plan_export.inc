// Les sorties d'une planche : SVG, PDF et DXF (98-mep-95-export-init.js) et l'impression.
// Inclus à la fin de plan_vue.cpp. SVG, PDF et impression partent des primitives déjà résolues
// (ce qu'on voit), le DXF des éléments du dessin : il lui faut les classes pour ses calques.
namespace {
std::string nombreSortie(double v, int n) { return js::texte(js::arrondi(v, n)); }
std::string couleurHtml(const wxColour& c) { return c.GetAsString(wxC2S_HTML_SYNTAX).Lower().utf8_string(); }

// ---- DXF R12 (mepDxfBuild) ----
const std::vector<std::array<const char*, 3>> CALQUES_DXF = {{"CONTOUR", "7", "CONTINUOUS"}, {"TANGENTE", "9", "CONTINUOUS"}, {"CACHE", "3", "DASHED"}, {"AXE", "1", "CENTER"}, {"COTES", "4", "CONTINUOUS"}, {"HACHURES", "8", "CONTINUOUS"}, {"CADRE", "7", "CONTINUOUS"}, {"CARTOUCHE", "7", "CONTINUOUS"}, {"TEXTE", "7", "CONTINUOUS"}, {"ESQUISSE", "5", "CONTINUOUS"}, {"FILETAGE", "7", "CONTINUOUS"}};
std::string calqueDxf(const std::set<std::string>& c, bool texte) {  // mepDxfLayer
  const auto a = [&](const char* k) { return c.count(k) > 0; };
  if (a("mepHidden")) return "CACHE";
  if (a("mepCutLine") || a("mepCutEnd") || a("mepCutArr") || a("mepDetailC") || a("mepDetailB")) return "AXE";
  if (a("mepAxis") || a("mepAxisCross")) return "AXE";
  if (a("mepDimL") || a("mepDimT") || a("mepDimRef")) return "COTES";
  if (a("mepHatch")) return "HACHURES";
  if (a("mepTangent") || a("mepBrk")) return "TANGENTE";
  if (a("mepThread")) return "FILETAGE";
  if (a("mepTitleText") || a("mepTitleVal") || a("mepRevText") || a("mepTitleBlock") || a("mepTbLine")) return "CARTOUCHE";
  if (a("mepFrame") || a("mepFrame2")) return "CADRE";
  if (a("mepSkFree")) return "ESQUISSE";
  if (a("mepLbl")) return "TEXTE";
  return texte ? "TEXTE" : "CONTOUR";
}
std::string texteDxf(const std::string& u8) {  // les accents en \U+XXXX
  const std::wstring w = wxString::FromUTF8(u8).ToStdWstring();
  std::string o;
  for (const wchar_t ch : w) {
    if (ch >= 0x20 && ch <= 0x7e) {
      o += static_cast<char>(ch);
    } else {
      char b[16];
      std::snprintf(b, sizeof b, "\\U+%04X", static_cast<unsigned>(ch));
      o += b;
    }
  }
  return o;
}
std::string decoupe(const std::string& s) {
  const size_t a = s.find_first_not_of(" \t\r\n");
  if (a == std::string::npos) return "";
  return s.substr(a, s.find_last_not_of(" \t\r\n") - a + 1);
}
struct BilanDxf {
  std::string texte;
  std::map<std::string, int> compte;
  int total = 0;
};
BilanDxf dxfDe(const std::vector<plan::Elt>& els, const J& mep, double W, double H) {
  const Palette P = paletteDe(mep);
  const plan::TaillesCotes tc = plan::taillesCotes(mep);
  const double hF = tc.fleche * std::tan(tc.angleFleche * PI / 360);
  const double capRatio = tc.corpsCote > 0 ? plan::hauteurCapitale() : 0.7;
  std::ostringstream ent;
  BilanDxf B;
  const auto R = [](double v) { return nombreSortie(v, 4); };
  const auto g = [](std::ostringstream& o, int c, const std::string& v) { o << c << "\r\n" << v << "\r\n"; };
  const auto plus = [&](const char* t) { B.compte[t]++, B.total++; };
  using Pt = std::array<double, 2>;
  const auto ligne = [&](const std::string& L, const Pt& a, const Pt& b) {
    if (std::hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) return;
    plus("LINE");
    g(ent, 0, "LINE"), g(ent, 8, L), g(ent, 10, R(a[0])), g(ent, 20, R(H - a[1])), g(ent, 11, R(b[0])), g(ent, 21, R(H - b[1]));
  };
  const auto poly = [&](const std::string& L, const std::vector<Pt>& pts, bool ferme) {
    if (pts.size() < 2) return;
    if (pts.size() == 2 && !ferme) return ligne(L, pts[0], pts[1]);
    plus("POLY");
    g(ent, 0, "POLYLINE"), g(ent, 8, L), g(ent, 66, "1"), g(ent, 10, "0"), g(ent, 20, "0"), g(ent, 70, ferme ? "1" : "0");
    for (const Pt& q : pts) g(ent, 0, "VERTEX"), g(ent, 8, L), g(ent, 10, R(q[0])), g(ent, 20, R(H - q[1]));
    g(ent, 0, "SEQEND"), g(ent, 8, L);
  };
  const auto pleinDxf = [&](const std::string& L, const std::vector<Pt>& t) {
    if (t.size() < 3) return;
    plus("SOLID");
    g(ent, 0, "SOLID"), g(ent, 8, L), g(ent, 10, R(t[0][0])), g(ent, 20, R(H - t[0][1])), g(ent, 11, R(t[1][0])), g(ent, 21, R(H - t[1][1]));
    g(ent, 12, R(t[2][0])), g(ent, 22, R(H - t[2][1])), g(ent, 13, R(t[2][0])), g(ent, 23, R(H - t[2][1]));
  };
  const auto fleches = [&](const std::string& L, const plan::Elt& e, double sw, const std::vector<Pt>& l) {
    if (l.size() < 2) return;
    if (const std::string* m = attrDe(e, "marker-end")) {
      std::vector<Pt> tri;
      const Pt& a = l[l.size() - 2];
      const Pt& b = l.back();
      fleche(tri, b[0], b[1], b[0] - a[0], b[1] - a[1], tc.fleche * sw, hF * sw, m->find("mepArrS") == std::string::npos);
      pleinDxf(L, tri);
    }
    if (const std::string* m = attrDe(e, "marker-start")) {
      std::vector<Pt> tri;
      fleche(tri, l[0][0], l[0][1], l[1][0] - l[0][0], l[1][1] - l[0][1], tc.fleche * sw, hF * sw, m->find("mepArrS") == std::string::npos);
      pleinDxf(L, tri);
    }
  };
  static const char* const SAUTE[] = {"mepPage", "mepGrid", "mepVB", "mepVBSel", "mepSnap", "mepAxisPick", "mepDraft", "mepDimGhost", "mepFace"};
  for (size_t i = 0; i < els.size(); i++) {
    const plan::Elt& e = els[i];
    if (e.aide || e.niveau > 0) continue;
    const std::string* cl = attrDe(e, "class");
    const std::set<std::string> C = cl ? classesDe(*cl) : std::set<std::string>();
    bool saute = false;
    for (const char* s : SAUTE)
      if (C.count(s)) saute = true;
    if (saute) continue;
    const Rendu r = renduDe(e, P);
    if (r.opacite <= 0) continue;
    const std::string L = calqueDxf(C, e.tag == "text");
    if (e.tag == "text") {
      double rot = 0, ax = 0, ay = 0;
      if (const std::string* tr = attrDe(e, "transform"); tr && tr->rfind("rotate(", 0) == 0) {
        std::istringstream f(tr->substr(7));
        f >> rot >> ax >> ay;
      }
      const double co = std::cos(rot * PI / 180), si = std::sin(rot * PI / 180);
      struct Morceau {
        std::string t;
        double corps;
      };
      std::vector<Morceau> chunk;
      double cx = nombre(e, "x"), cy = nombre(e, "y");
      const auto vider = [&]() {
        double tot = 0;
        for (const Morceau& m : chunk) tot += plan::largeurTexte(m.t, m.corps, r.gras);
        double x = cx - (r.ancre == "middle" ? tot / 2 : r.ancre == "end" ? tot : 0);
        for (const Morceau& m : chunk) {
          const std::string s = decoupe(m.t);
          if (!s.empty()) {  // getStartPositionOfChar : au premier caractère qui n'est pas un blanc
            const double x1 = x + plan::largeurTexte(m.t.substr(0, m.t.find_first_not_of(" \t\r\n")), m.corps, r.gras);
            const double qx = rot != 0 ? ax + (x1 - ax) * co - (cy - ay) * si : x1, qy = rot != 0 ? ay + (x1 - ax) * si + (cy - ay) * co : cy;
            plus("TEXT");
            g(ent, 0, "TEXT"), g(ent, 8, L), g(ent, 10, R(qx)), g(ent, 20, R(H - qy)), g(ent, 40, R(m.corps * capRatio)), g(ent, 1, texteDxf(s));
            const double ang = -std::atan2(si, co) * 180 / PI;  // ramené entre -180 et 180 comme la matrice du navigateur
            if (std::abs(ang) > 0.01) g(ent, 50, R(ang));
          }
          x += plan::largeurTexte(m.t, m.corps, r.gras);
        }
        chunk.clear();
      };
      if (!e.txt.empty()) chunk.push_back({e.txt, r.corps});
      for (size_t k = i + 1; k < els.size() && els[k].niveau > 0; k++) {
        const plan::Elt& s = els[k];
        if (attrDe(s, "x")) {
          vider();
          cx = nombre(s, "x");
          if (attrDe(s, "y")) cy = nombre(s, "y");
        }
        double corps = r.corps;
        if (const std::string* a = attrDe(s, "font-size")) corps = std::strtod(a->c_str(), nullptr);
        if (!s.txt.empty()) chunk.push_back({s.txt, corps});
      }
      vider();
      continue;
    }
    if (r.trait.empty()) continue;
    if (e.tag == "line") {
      const std::vector<Pt> l{{nombre(e, "x1"), nombre(e, "y1")}, {nombre(e, "x2"), nombre(e, "y2")}};
      ligne(L, l[0], l[1]);
      fleches(L, e, r.largeur, l);
    } else if (e.tag == "rect") {
      const double x = nombre(e, "x"), y = nombre(e, "y"), w = nombre(e, "width"), h = nombre(e, "height");
      if (w > 0 && h > 0) poly(L, {{x, y}, {x + w, y}, {x + w, y + h}, {x, y + h}}, true);
    } else if (e.tag == "circle") {
      plus("CIRCLE");
      g(ent, 0, "CIRCLE"), g(ent, 8, L), g(ent, 10, R(nombre(e, "cx"))), g(ent, 20, R(H - nombre(e, "cy"))), g(ent, 40, R(nombre(e, "r")));
    } else if (e.tag == "path") {
      std::vector<std::vector<Pt>> lignes;
      const std::string* d = attrDe(e, "d");
      if (d) cheminEnPoints(*d, lignes, 0.0002);
      const bool courbe = d && d->find_first_of("ACQSTacqst") != std::string::npos;
      const auto longueur = [](const std::vector<Pt>& l) {
        double s = 0;
        for (size_t k = 0; k + 1 < l.size(); k++) s += std::hypot(l[k + 1][0] - l[k][0], l[k + 1][1] - l[k][1]);
        return s;
      };
      const auto pointA = [](const std::vector<Pt>& l, double s) {
        for (size_t k = 0; k + 1 < l.size(); k++) {
          const double c = std::hypot(l[k + 1][0] - l[k][0], l[k + 1][1] - l[k][1]);
          if (s <= c && c > 0) return Pt{l[k][0] + (l[k + 1][0] - l[k][0]) * s / c, l[k][1] + (l[k + 1][1] - l[k][1]) * s / c};
          s -= c;
        }
        return l.back();
      };
      std::vector<Pt> fleche0, fleche1;
      if (!lignes.empty() && lignes.front().size() >= 2) {
        const double t = longueur(lignes.front()), u = std::min(.05, t / 10);
        fleche0 = {lignes.front()[0], pointA(lignes.front(), u)};
      }
      if (!lignes.empty() && lignes.back().size() >= 2) {
        const double t = longueur(lignes.back()), u = std::min(.05, t / 10);
        fleche1 = {pointA(lignes.back(), t - u), lignes.back().back()};
      }
      for (auto& l : lignes) {
        const bool ferme = l.size() > 3 && std::hypot(l.front()[0] - l.back()[0], l.front()[1] - l.back()[1]) < 1e-9;
        if (courbe) {
          const double t = longueur(l);
          if (!(t > 0)) continue;
          const int n = std::min(720, std::max(2, static_cast<int>(std::ceil(t / 0.25))));
          std::vector<Pt> q;
          for (int k = 0; k <= n; k++) q.push_back(pointA(l, t * k / n));
          q.back() = l.back();
          poly(L, q, ferme && d->find_last_of("Zz") != std::string::npos);
        } else {
          if (ferme) l.pop_back();
          poly(L, l, ferme);
        }
      }
      if (const std::string* m = attrDe(e, "marker-start"); m && fleche0.size() == 2) {
        std::vector<Pt> tri;
        fleche(tri, fleche0[0][0], fleche0[0][1], fleche0[1][0] - fleche0[0][0], fleche0[1][1] - fleche0[0][1], tc.fleche * r.largeur, hF * r.largeur, m->find("mepArrS") == std::string::npos);
        pleinDxf(L, tri);
      }
      if (const std::string* m = attrDe(e, "marker-end"); m && fleche1.size() == 2) {
        std::vector<Pt> tri;
        fleche(tri, fleche1[1][0], fleche1[1][1], fleche1[1][0] - fleche1[0][0], fleche1[1][1] - fleche1[0][1], tc.fleche * r.largeur, hF * r.largeur, m->find("mepArrS") == std::string::npos);
        pleinDxf(L, tri);
      }
    }
  }
  std::ostringstream o;
  g(o, 0, "SECTION"), g(o, 2, "HEADER"), g(o, 9, "$ACADVER"), g(o, 1, "AC1009"), g(o, 9, "$DWGCODEPAGE"), g(o, 3, "ANSI_1252"), g(o, 9, "$INSUNITS"), g(o, 70, "4");
  g(o, 9, "$EXTMIN"), g(o, 10, "0"), g(o, 20, "0"), g(o, 9, "$EXTMAX"), g(o, 10, R(W)), g(o, 20, R(H));
  g(o, 9, "$LIMMIN"), g(o, 10, "0"), g(o, 20, "0"), g(o, 9, "$LIMMAX"), g(o, 10, R(W)), g(o, 20, R(H)), g(o, 0, "ENDSEC");
  g(o, 0, "SECTION"), g(o, 2, "TABLES"), g(o, 0, "TABLE"), g(o, 2, "LTYPE"), g(o, 70, "3");
  const auto typeLigne = [&](const char* nm, const char* ds, const std::vector<double>& pat) {
    double tot = 0;
    for (double v : pat) tot += std::abs(v);
    g(o, 0, "LTYPE"), g(o, 2, nm), g(o, 70, "0"), g(o, 3, ds), g(o, 72, "65"), g(o, 73, std::to_string(pat.size())), g(o, 40, R(tot));
    for (double v : pat) g(o, 49, R(v));
  };
  typeLigne("CONTINUOUS", "Solid line", {});
  typeLigne("DASHED", "__ __ __", {2, -1.2});
  typeLigne("CENTER", "____ _ ____", {8, -2, 1.5, -2});
  g(o, 0, "ENDTAB"), g(o, 0, "TABLE"), g(o, 2, "LAYER"), g(o, 70, std::to_string(CALQUES_DXF.size()));
  for (const auto& c : CALQUES_DXF) g(o, 0, "LAYER"), g(o, 2, c[0]), g(o, 70, "0"), g(o, 62, c[1]), g(o, 6, c[2]);
  g(o, 0, "ENDTAB"), g(o, 0, "ENDSEC"), g(o, 0, "SECTION"), g(o, 2, "ENTITIES");
  o << ent.str();
  g(o, 0, "ENDSEC"), g(o, 0, "EOF");
  B.texte = o.str();
  return B;
}

// ---- Les symboles hors du jeu du PDF : leur contour, lu dans la police de Windows ----
struct ContourGlyphe {
  std::vector<std::vector<std::array<double, 2>>> boucles;  // pour un corps de 1, y vers le haut
  double avance = 0;
};
ContourGlyphe contourDe(wchar_t ch) {
  static std::map<wchar_t, ContourGlyphe> cache;
  const auto it = cache.find(ch);
  if (it != cache.end()) return it->second;
  ContourGlyphe G;
#ifndef _WIN32
  contourGlypheMac(ch, G.boucles, G.avance);  // mac.mm : même contour, lu dans la police de symboles du Mac
#else
  const double E = 2048;
  HDC dc = CreateCompatibleDC(nullptr);
  HFONT f = CreateFontW(-static_cast<int>(E), 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, OUT_TT_ONLY_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH, L"Segoe UI Symbol");
  HGDIOBJ avant = SelectObject(dc, f);
  GLYPHMETRICS gm{};
  const MAT2 m{{0, 1}, {0, 0}, {0, 0}, {0, 1}};
  const DWORD n = GetGlyphOutlineW(dc, ch, GGO_NATIVE | GGO_UNHINTED, &gm, 0, nullptr, &m);
  if (n != GDI_ERROR && n > 0) {
    std::vector<char> buf(n);
    GetGlyphOutlineW(dc, ch, GGO_NATIVE | GGO_UNHINTED, &gm, n, buf.data(), &m);
    const auto F = [&](const FIXED& q) { return (q.value + q.fract / 65536.0) / E; };
    size_t p = 0;
    while (p < n) {
      const auto* h = reinterpret_cast<const TTPOLYGONHEADER*>(buf.data() + p);
      std::vector<std::array<double, 2>> b{{F(h->pfxStart.x), F(h->pfxStart.y)}};
      size_t q = p + sizeof(TTPOLYGONHEADER);
      const size_t fin = p + h->cb;
      while (q < fin) {
        const auto* c = reinterpret_cast<const TTPOLYCURVE*>(buf.data() + q);
        if (c->wType == TT_PRIM_LINE) {
          for (int i = 0; i < c->cpfx; i++) b.push_back({F(c->apfx[i].x), F(c->apfx[i].y)});
        } else {  // quadratiques : découpées finement
          for (int i = 0; i + 1 < c->cpfx; i++) {
            const std::array<double, 2> a = b.back(), k{F(c->apfx[i].x), F(c->apfx[i].y)};
            std::array<double, 2> e{F(c->apfx[i + 1].x), F(c->apfx[i + 1].y)};
            if (i + 2 < c->cpfx) e = {(k[0] + e[0]) / 2, (k[1] + e[1]) / 2};
            for (int t = 1; t <= 8; t++) {
              const double u = t / 8.0;
              b.push_back({(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * k[0] + u * u * e[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * k[1] + u * u * e[1]});
            }
          }
        }
        q += sizeof(WORD) * 2 + sizeof(POINTFX) * c->cpfx;
      }
      G.boucles.push_back(std::move(b));
      p = fin;
    }
  }
  G.avance = gm.gmCellIncX / E;
  SelectObject(dc, avant);
  DeleteObject(f);
  DeleteDC(dc);
#endif
  cache[ch] = G;
  return G;
}
// Le jeu WinAnsi des polices du PDF : 0 si le caractère n'y est pas
unsigned char octetWinAnsi(wchar_t c) {
  if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) return static_cast<unsigned char>(c);
  static const std::map<wchar_t, unsigned char> T = {{0x20ac, 0x80}, {0x201a, 0x82}, {0x192, 0x83}, {0x201e, 0x84}, {0x2026, 0x85}, {0x2020, 0x86}, {0x2021, 0x87}, {0x2c6, 0x88}, {0x2030, 0x89}, {0x160, 0x8a}, {0x2039, 0x8b}, {0x152, 0x8c}, {0x17d, 0x8e}, {0x2018, 0x91}, {0x2019, 0x92}, {0x201c, 0x93}, {0x201d, 0x94}, {0x2022, 0x95}, {0x2013, 0x96}, {0x2014, 0x97}, {0x2dc, 0x98}, {0x2122, 0x99}, {0x161, 0x9a}, {0x203a, 0x9b}, {0x153, 0x9c}, {0x17e, 0x9e}, {0x178, 0x9f}};
  const auto it = T.find(c);
  return it != T.end() ? it->second : 0;
}
std::string compresse(const void* d, size_t n) {
  wxMemoryOutputStream m;
  {
    wxZlibOutputStream z(m, -1, wxZLIB_ZLIB);
    z.Write(d, n);
    z.Close();
  }
  std::string o(m.GetSize(), '\0');
  m.CopyTo(o.data(), o.size());
  return o;
}
}  // namespace

// ---- SVG : ce qu'on voit, écrit en mm ----
std::string PlanVue::svgDesPrimitives() const {
  const auto ech = [](const std::string& t) {
    std::string r;
    for (char c : t) {
      if (c == '&') r += "&amp;";
      else if (c == '<') r += "&lt;";
      else if (c == '>') r += "&gt;";
      else if (c == '"') r += "&quot;";
      else r += c;
    }
    return r;
  };
  const auto N = [](double v) { return nombreSortie(v, 3); };
  std::ostringstream o;
  o << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 " << N(largeurPage_) << " " << N(hauteurPage_) << "\" width=\"" << N(largeurPage_) << "mm\" height=\"" << N(hauteurPage_) << "mm\">\n";
  for (const Prim& p : prims_) {
    if (p.genre == Prim::TRAITS || p.genre == Prim::REMPLI) {
      std::string d;
      for (const Trait& t : p.traits) {
        if (t.pts.size() < 2) continue;
        for (size_t i = 0; i < t.pts.size(); i++) d += (i ? "L" : "M") + N(t.pts[i][0]) + " " + N(t.pts[i][1]);
        if (p.genre == Prim::REMPLI) d += "Z";
      }
      if (d.empty()) continue;
      o << "<path d=\"" << d << "\"";
      if (p.genre == Prim::TRAITS) {
        o << " fill=\"none\" stroke=\"" << couleurHtml(p.couleur) << "\" stroke-width=\"" << N(p.largeur) << "\"";
        if (p.cap == wxCAP_ROUND) o << " stroke-linecap=\"round\"";
        if (p.join == wxJOIN_ROUND) o << " stroke-linejoin=\"round\"";
      } else {
        o << " fill=\"" << couleurHtml(p.couleur) << "\" fill-rule=\"evenodd\"";
      }
      if (p.opacite < 1) o << " opacity=\"" << N(p.opacite) << "\"";
      o << "/>\n";
    } else if (p.genre == Prim::TEXTE) {
      if (p.texte.empty()) continue;
      o << "<text x=\"" << N(p.x) << "\" y=\"" << N(p.y) << "\" font-family=\"Arial,Helvetica,sans-serif\" font-size=\"" << N(p.corps) << "\" fill=\"" << couleurHtml(p.couleur) << "\" xml:space=\"preserve\"";
      if (p.gras) o << " font-weight=\"bold\"";
      if (p.halo > 0) o << " stroke=\"" << couleurHtml(p.couleurHalo) << "\" stroke-width=\"" << N(p.halo) << "\" paint-order=\"stroke\"";
      if (p.angle != 0) o << " transform=\"rotate(" << N(p.angle) << " " << N(p.axeX) << " " << N(p.axeY) << ")\"";
      o << ">" << ech(p.texte.utf8_string()) << "</text>\n";
    } else if (p.genre == Prim::IMAGE && p.image && p.image->IsOk()) {
      wxMemoryOutputStream m;
      p.image->ConvertToImage().SaveFile(m, wxBITMAP_TYPE_PNG);
      wxString b64;
      {
        std::string brut(m.GetSize(), '\0');
        m.CopyTo(brut.data(), brut.size());
        b64 = wxBase64Encode(brut.data(), brut.size());
      }
      o << "<image x=\"" << N(p.x) << "\" y=\"" << N(p.y) << "\" width=\"" << N(p.l) << "\" height=\"" << N(p.h) << "\" preserveAspectRatio=\"none\" xlink:href=\"data:image/png;base64," << b64.utf8_string() << "\"/>\n";
    }
  }
  o << "</svg>\n";
  return o.str();
}

// ---- PDF : une page au format exact de la planche ----
std::string PlanVue::pdfDesPrimitives() const {
  const double K = 72.0 / 25.4;
  const double H = hauteurPage_;
  const auto N = [](double v) { return nombreSortie(v, 3); };
  std::ostringstream c;
  std::vector<double> alphas;
  std::vector<std::array<int, 2>> images;
  std::vector<const Prim*> primsImage;
  const auto couleur = [&](const wxColour& q, bool trait) {
    c << N(q.Red() / 255.0) << " " << N(q.Green() / 255.0) << " " << N(q.Blue() / 255.0) << (trait ? " RG\n" : " rg\n");
  };
  const auto alpha = [&](double a) {
    size_t i = 0;
    for (; i < alphas.size(); i++)
      if (alphas[i] == a) break;
    if (i == alphas.size()) alphas.push_back(a);
    c << "/G" << i << " gs\n";
  };
  c << "q\n";
  for (const Prim& p : prims_) {
    if (p.genre == Prim::TRAITS || p.genre == Prim::REMPLI) {
      const bool transparent = p.opacite < 1;
      if (transparent) c << "q\n", alpha(p.opacite);
      couleur(p.couleur, p.genre == Prim::TRAITS);
      if (p.genre == Prim::TRAITS) c << N(p.largeur * K) << " w\n" << (p.cap == wxCAP_ROUND ? 1 : 0) << " J\n" << (p.join == wxJOIN_ROUND ? 1 : 0) << " j\n";
      bool un = false;
      for (const Trait& t : p.traits) {
        if (t.pts.size() < 2) continue;
        for (size_t i = 0; i < t.pts.size(); i++) c << N(t.pts[i][0] * K) << " " << N((H - t.pts[i][1]) * K) << (i ? " l\n" : " m\n");
        if (p.genre == Prim::REMPLI) c << "h\n";
        un = true;
      }
      if (un) c << (p.genre == Prim::TRAITS ? "S\n" : "f*\n");
      if (transparent) c << "Q\n";
    } else if (p.genre == Prim::TEXTE) {
      if (p.texte.empty()) continue;
      const double t = p.angle * PI / 180, co = std::cos(t), si = std::sin(t);
      const double a0 = p.angle != 0 ? p.axeX + (p.x - p.axeX) * co - (p.y - p.axeY) * si : p.x;
      const double b0 = p.angle != 0 ? p.axeY + (p.x - p.axeX) * si + (p.y - p.axeY) * co : p.y;
      const double sz = p.corps * K;
      double av = 0;  // en mm le long du texte
      const std::wstring ws = p.texte.ToStdWstring();
      size_t i = 0;
      while (i < ws.size()) {
        const bool ansi = octetWinAnsi(ws[i]) != 0;
        size_t j = i;
        while (j < ws.size() && (octetWinAnsi(ws[j]) != 0) == ansi) j++;
        const std::wstring run = ws.substr(i, j - i);
        const double X = (a0 + av * co) * K, Y = (H - (b0 + av * si)) * K;
        if (ansi) {
          std::string o;
          for (const wchar_t q : run) {
            const unsigned char b = octetWinAnsi(q);
            if (b == '(' || b == ')' || b == '\\') o += '\\';
            o += static_cast<char>(b);
          }
          const std::string F = p.gras ? "/F2 " : "/F1 ";
          const auto ecrire = [&](int mode) {
            c << "BT\n" << F << N(sz) << " Tf\n" << mode << " Tr\n" << N(co) << " " << N(-si) << " " << N(si) << " " << N(co) << " " << N(X) << " " << N(Y) << " Tm\n(" << o << ") Tj\nET\n";
          };
          if (p.halo > 0) {
            couleur(p.couleurHalo, true);
            c << N(p.halo * K) << " w\n1 j\n";
            ecrire(1);
          }
          couleur(p.couleur, false);
          ecrire(0);
          av += plan::largeurTexte(wxString(run).utf8_string(), p.corps, p.gras);
        } else {
          couleur(p.couleur, false);
          double dx = 0;
          for (const wchar_t q : run) {
            const ContourGlyphe G = contourDe(q);
            for (const auto& b : G.boucles) {
              for (size_t k = 0; k < b.size(); k++) {
                const double u = (dx + b[k][0]) * p.corps, w = b[k][1] * p.corps;
                c << N(X + (u * co + w * si) * K) << " " << N(Y + (-u * si + w * co) * K) << (k ? " l\n" : " m\n");
              }
              c << "h\n";
            }
            if (!G.boucles.empty()) c << "f*\n";
            dx += G.avance;
          }
          av += dx * p.corps;
        }
        i = j;
      }
    } else if (p.genre == Prim::IMAGE && p.image && p.image->IsOk()) {
      c << "q\n" << N(p.l * K) << " 0 0 " << N(p.h * K) << " " << N(p.x * K) << " " << N((H - p.y - p.h) * K) << " cm\n/I" << primsImage.size() << " Do\nQ\n";
      primsImage.push_back(&p);
    }
  }
  c << "Q\n";
  const std::string contenu = c.str(), serre = compresse(contenu.data(), contenu.size());
  // Les objets : 1 catalogue, 2 pages, 3 page, 4 contenu, 5-6 polices, puis les images et les états de transparence
  std::string o = "%PDF-1.5\n%\xE2\xE3\xCF\xD3\n";
  std::vector<size_t> pos;
  const auto objet = [&](const std::string& corps) {
    pos.push_back(o.size());
    o += std::to_string(pos.size()) + " 0 obj\n" + corps + "\nendobj\n";
  };
  const int premier = 7;
  std::string res = "/Font << /F1 5 0 R /F2 6 0 R >>";
  if (!primsImage.empty()) {
    res += " /XObject <<";
    for (size_t i = 0; i < primsImage.size(); i++) res += " /I" + std::to_string(i) + " " + std::to_string(premier + i) + " 0 R";
    res += " >>";
  }
  if (!alphas.empty()) {
    res += " /ExtGState <<";
    for (size_t i = 0; i < alphas.size(); i++) res += " /G" + std::to_string(i) + " " + std::to_string(premier + primsImage.size() + i) + " 0 R";
    res += " >>";
  }
  objet("<< /Type /Catalog /Pages 2 0 R >>");
  objet("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objet("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + N(largeurPage_ * K) + " " + N(hauteurPage_ * K) + "] /Contents 4 0 R /Resources << " + res + " >> >>");
  objet("<< /Length " + std::to_string(serre.size()) + " /Filter /FlateDecode >>\nstream\n" + serre + "\nendstream");
  objet("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objet("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  for (const Prim* p : primsImage) {
    const wxImage im = p->image->ConvertToImage();
    const std::string z = compresse(im.GetData(), static_cast<size_t>(im.GetWidth()) * im.GetHeight() * 3);
    objet("<< /Type /XObject /Subtype /Image /Width " + std::to_string(im.GetWidth()) + " /Height " + std::to_string(im.GetHeight()) + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length " + std::to_string(z.size()) + " >>\nstream\n" + z + "\nendstream");
  }
  for (const double a : alphas) objet("<< /Type /ExtGState /CA " + N(a) + " /ca " + N(a) + " >>");
  const size_t xref = o.size();
  o += "xref\n0 " + std::to_string(pos.size() + 1) + "\n0000000000 65535 f \n";
  for (const size_t q : pos) {
    char b[32];
    std::snprintf(b, sizeof b, "%010zu 00000 n \n", q);
    o += b;
  }
  o += "trailer\n<< /Size " + std::to_string(pos.size() + 1) + " /Root 1 0 R >>\nstartxref\n" + std::to_string(xref) + "\n%%EOF\n";
  return o;
}

// ---- L'impression : à l'échelle 1:1 si la feuille de l'imprimante est assez grande, sinon ajustée ----
namespace {
class ImpressionPlan : public wxPrintout {
 public:
  explicit ImpressionPlan(std::function<void(wxDC&)> dessin, const wxString& titre) : wxPrintout(titre), dessin_(std::move(dessin)) {}
  bool HasPage(int n) override { return n == 1; }
  void GetPageInfo(int* a, int* b, int* c, int* d) override { *a = 1, *b = 1, *c = 1, *d = 1; }
  bool OnPrintPage(int) override {
    wxDC* dc = GetDC();
    if (!dc) return false;
    dessin_(*dc);
    return true;
  }

 private:
  std::function<void(wxDC&)> dessin_;
};
}  // namespace
void PlanVue::dessinerSurImprimante(wxDC& dc, int largeurPx, int hauteurPx, double pxParMmX, double pxParMmY) const {
  const double k = std::min({pxParMmX, pxParMmY, largeurPx / std::max(1.0, largeurPage_), hauteurPx / std::max(1.0, hauteurPage_)});
  const double ox = (largeurPx - largeurPage_ * k) / 2, oy = (hauteurPx - hauteurPage_ * k) / 2;
  const auto X = [&](double v) { return static_cast<int>(std::lround(ox + v * k)); };
  const auto Y = [&](double v) { return static_cast<int>(std::lround(oy + v * k)); };
  for (const Prim& p : prims_) {
    if (p.genre == Prim::TRAITS) {
      dc.SetPen(wxPen(p.couleur, std::max(1, static_cast<int>(std::lround(p.largeur * k))), wxPENSTYLE_SOLID));
      dc.SetBrush(*wxTRANSPARENT_BRUSH);
      for (const Trait& t : p.traits) {
        std::vector<wxPoint> q;
        q.reserve(t.pts.size());
        for (const auto& a : t.pts) q.emplace_back(X(a[0]), Y(a[1]));
        if (q.size() >= 2) dc.DrawLines(static_cast<int>(q.size()), q.data());
      }
    } else if (p.genre == Prim::REMPLI) {
      dc.SetPen(*wxTRANSPARENT_PEN);
      dc.SetBrush(wxBrush(p.couleur));
      for (const Trait& t : p.traits) {
        std::vector<wxPoint> q;
        for (const auto& a : t.pts) q.emplace_back(X(a[0]), Y(a[1]));
        if (q.size() >= 3) dc.DrawPolygon(static_cast<int>(q.size()), q.data());
      }
    } else if (p.genre == Prim::TEXTE) {
      if (p.texte.empty()) continue;
      wxFont f(wxFontInfo().FaceName("Arial").Bold(p.gras));
      f.SetPixelSize(wxSize(0, -std::max(1, static_cast<int>(std::lround(p.corps * k)))));
      dc.SetFont(f);
      dc.SetTextForeground(p.couleur);
      dc.SetBackgroundMode(wxBRUSHSTYLE_TRANSPARENT);
      const double a = p.angle * PI / 180, co = std::cos(a), si = std::sin(a);
      const double h = 0.905 * p.corps;  // du haut du texte à sa ligne de base
      double x = p.x + h * si * (p.angle != 0 ? 1 : 0), y = p.y - h * (p.angle != 0 ? co : 1);
      if (p.angle != 0) {
        const double dx = p.x - p.axeX, dy = p.y - p.axeY;
        const double xb = p.axeX + dx * co - dy * si, yb = p.axeY + dx * si + dy * co;
        x = xb + h * si, y = yb - h * co;
        dc.DrawRotatedText(p.texte, X(x), Y(y), -p.angle);
      } else {
        dc.DrawText(p.texte, X(x), Y(y));
      }
    } else if (p.genre == Prim::IMAGE && p.image && p.image->IsOk()) {
      const wxImage im = p.image->ConvertToImage().Scale(std::max(1, static_cast<int>(p.l * k)), std::max(1, static_cast<int>(p.h * k)), wxIMAGE_QUALITY_HIGH);
      dc.DrawBitmap(wxBitmap(im), X(p.x), Y(p.y));
    }
  }
}

std::string PlanVue::nomDeSortie() const {
  std::string d = top_.value("name", std::string("plan")), n = planche().value("name", std::string());
  std::string o;
  bool blanc = false;
  for (const unsigned char c : d) {
    if (std::isalnum(c) || c == '.' || c == '-' || c == '_') o += static_cast<char>(c), blanc = false;
    else if (!blanc) o += '_', blanc = true;
  }
  o += '_';
  for (const char c : n)
    if (c != ' ' && c != '\t') o += c;
  return o;
}
template <typename F>
void PlanVue::pourExport(F&& faire) {
  const plan::SelectionPlan garde = sel_;
  sel_ = plan::SelectionPlan();
  exportEnCours_ = true;
  construire();
  faire();
  exportEnCours_ = false;
  sel_ = garde;
  construire();
  Refresh(false);
}
wxString PlanVue::exporterVers(const std::string& format, const std::string& chemin) {
  std::string donnees;
  wxString bilan;
  if (format == "dxf") {
    pourExport([&] {
      calcul_.selection = &sel_;
      const std::vector<plan::Elt> els = plan::dessiner(mep_, planche_, piece_, calcul_);
      const BilanDxf B = dxfDe(els, mep_, largeurPage_, hauteurPage_);
      donnees = B.texte;
      bilan = wxString::Format(L" (%d entités, calques CONTOUR/CACHE/AXE/COTES…)", B.total);
    });
  } else {
    pourExport([&] { donnees = format == "svg" ? svgDesPrimitives() : pdfDesPrimitives(); });
  }
  std::ofstream f(wxString::FromUTF8(chemin).ToStdWstring(), std::ios::binary);
  f.write(donnees.data(), static_cast<std::streamsize>(donnees.size()));
  return bilan;
}
void PlanVue::exporter(const std::string& format) {
  if (!mep_.is_object() || !mep_.contains("sheets") || mep_["sheets"].empty()) return;
  const wxString maj = wxString::FromUTF8(format).Upper(), ext = wxString::FromUTF8(format);
  wxFileDialog dlg(this, wxString(L"Exporter la planche en ") + maj, wxEmptyString, wxString::FromUTF8(nomDeSortie()) + L"." + ext, maj + L" (*." + ext + L")|*." + ext, wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
  if (dlg.ShowModal() != wxID_OK) return;
  wxBusyCursor attente;
  try {
    const wxString b = exporterVers(format, dlg.GetPath().utf8_string());
    if (surEtat) surEtat(maj + L" exporté : " + dlg.GetFilename() + b);
  } catch (const std::exception& e) {
    if (surEtat) surEtat(wxString(L"Export ") + maj + L" impossible : " + wxString::FromUTF8(e.what()));
  }
}
namespace {
wxString texteIgnores(const J& sk) {  // mepDxfSkipText
  wxString o;
  if (!sk.is_object()) return o;
  for (auto it = sk.begin(); it != sk.end(); ++it) o += (o.empty() ? L" — ignorés : " : L", ") + wxString::Format("%d ", it.value().get<int>()) + wxString::FromUTF8(it.key());
  return o;
}
// Lit le DXF ; le fichier peut être en ANSI : ses noms de calques sont alors repris tels quels
bool chargerDxf(wxWindow* parent, const std::string& chemin, J& lu, wxString& nom, const std::function<void(const wxString&)>& etat) {
  wxString fichier = wxString::FromUTF8(chemin);
  if (fichier.empty()) {
    wxFileDialog dlg(parent, L"Importer un DXF", wxEmptyString, wxEmptyString, L"DXF (*.dxf)|*.dxf", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
    if (dlg.ShowModal() != wxID_OK) return false;
    fichier = dlg.GetPath();
  }
  std::ifstream f(fichier.ToStdWstring(), std::ios::binary);
  std::string brut((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
  if (wxString::FromUTF8(brut).empty() && !brut.empty()) brut = wxString(brut.data(), wxConvISO8859_1, brut.size()).utf8_string();
  const wxFileName fn(fichier);
  try {
    lu = plan::lireDxf(brut);
  } catch (const std::exception&) {
    lu = J();
  }
  if (!lu.is_object() || lu.value("n", 0) == 0) {
    if (etat) etat(L"DXF : aucun élément géométrique lisible dans « " + fn.GetFullName() + L" ».");
    return false;
  }
  nom = fn.GetName();
  return true;
}
}  // namespace
void PlanVue::importerDxf(const std::string& chemin) {
  if (!planPret()) return;
  J lu;
  wxString nom;
  if (!chargerDxf(this, chemin, lu, nom, surEtat)) return;
  int cotes = 0, perdues = 0;
  const std::string id = plan::importerDxf(mep_, planche_, piece_, calcul_, lu, nom.utf8_string(), cotes, perdues);
  sel_ = plan::SelectionPlan();
  sel_.vue = id;
  redessiner();
  valider(L"nouvelle vue");
  if (surEtat) {
    const auto mm = [&](const char* k) { return wxString::FromUTF8(plan::nombreAffiche(lu["bbox"][k].get<double>(), 1)); };
    wxString m = L"DXF « " + nom + wxString::Format(L" » importé : %d élément(s), ", lu["n"].get<int>()) + mm("w") + L" × " + mm("h") + L" mm";
    if (cotes) m += wxString::Format(L" ; %d cote(s) reprise(s) en cotes du plan", cotes);
    if (perdues) m += wxString::Format(L" (%d non reprise(s))", perdues);
    surEtat(m + texteIgnores(lu["skipped"]) + L".");
  }
  if (surSelection) surSelection();
}
void PlanVue::remplacerDxf(const std::string& id, const std::string& chemin) {
  J* v = vueCourante(id);
  if (!v) return;
  J lu;
  wxString nom;
  if (!chargerDxf(this, chemin, lu, nom, surEtat)) return;
  plan::remplacerDxf(*v, lu, nom.utf8_string());
  redessiner();
  valider(L"DXF remplacé");
  if (surEtat) surEtat(L"DXF de la vue remplacé par « " + nom + wxString::Format(L" » (%d élément(s))", lu["n"].get<int>()) + texteIgnores(lu["skipped"]) + L". Les cotes gardent leurs n° d’éléments.");
  if (surSelection) surSelection();
}
void PlanVue::imprimer() {
  if (!mep_.is_object() || !mep_.contains("sheets") || mep_["sheets"].empty()) return;
  wxPrintData pd;
  pd.SetOrientation(largeurPage_ > hauteurPage_ ? wxLANDSCAPE : wxPORTRAIT);
  const std::string fmt = planche().value("format", std::string("A4"));
  pd.SetPaperId(fmt == "A3" ? wxPAPER_A3 : fmt == "A4" ? wxPAPER_A4 : fmt == "A2" ? wxPAPER_A2 : wxPAPER_A4);
  wxPrintDialogData dd(pd);
  wxPrinter imprimante(&dd);
  pourExport([&] {
    ImpressionPlan page(
        [this](wxDC& dc) {
          int w, h;
          dc.GetSize(&w, &h);
          const wxSize ppi = dc.GetPPI();
          dessinerSurImprimante(dc, w, h, ppi.x / 25.4, ppi.y / 25.4);
        },
        wxString::FromUTF8(nomDeSortie()));
    if (!imprimante.Print(this, &page, true) && wxPrinter::GetLastError() == wxPRINTER_ERROR && surEtat) surEtat(L"Impression impossible.");
  });
}
