// Les outils de cotation de la mise en plan (98-mep-85-cote-unique.js, 98-mep-87-chaine.js, l'outil de 98-mep-80-souris.js) ;
// inclus à la fin de plan_cotes.cpp, avec lequel il partage le calcul des cotes.
namespace {
J* vueMod(J& sh, const std::string& id) { return const_cast<J*>(vueDe(sh, id)); }
std::string signatureEnt(const Ent& e, const std::string& ak) {  // mepEntSig
  if (!ak.empty()) return "X" + ak;
  const auto liste = [](std::initializer_list<double> L, int n) {
    std::string s;
    for (double q : L) s += (s.empty() ? "" : ",") + js::fixe(q, n);
    return s;
  };
  if (e.t == 'L') return "L" + liste({e.x1, e.y1, e.x2, e.y2}, 3);
  if (e.t == 'C') return "C" + liste({e.cx, e.cy, e.r}, 3);
  if (e.t == 'A') return "A" + liste({e.cx, e.cy, e.r, e.a0, e.a1}, 4);
  return "?";
}
J indiceEnt(const SelEnt& s) { return s.ak.empty() ? J(s.i) : J("ax:" + s.ak); }
SelEnt selDe(const EntTouchee& h) {
  SelEnt s;
  s.vid = h.vid, s.i = h.i, s.ak = h.ak, s.t = h.e.t, s.sig = signatureEnt(h.e, h.ak), s.lx = h.lx, s.ly = h.ly;
  return s;
}
std::optional<Ent> entDeSel(Ctx& c, J& v, const SelEnt& s) {  // mepEntRef
  if (!s.ak.empty()) {
    for (const Axe& p : lignesAxes(c, v))
      if (p.ak == s.ak) {
        Ent e;
        e.t = p.t, e.x1 = p.x1, e.y1 = p.y1, e.x2 = p.x2, e.y2 = p.y2, e.cx = p.cx, e.cy = p.cy, e.r = p.r;
        return e;
      }
    return std::nullopt;
  }
  const std::vector<Ent>& els = geoDe(c, v).els;
  if (s.i < 0 || s.i >= static_cast<int>(els.size())) return std::nullopt;
  const Ent& e = els[s.i];
  if (!s.sig.empty() && s.sig != signatureEnt(e, "")) return std::nullopt;
  return e;
}
J memoOblong(const Oblong& s) { return {{"x1", s.x1}, {"y1", s.y1}, {"x2", s.x2}, {"y2", s.y2}, {"r", s.r}}; }
J indiceCentre(Ctx& c, const J& v, int i) {  // mepSlotCtrHint
  for (const Oblong& s : oblongsDe(c, v)) {
    const auto dans = [&](const std::vector<int>& L) { return std::find(L.begin(), L.end(), i) != L.end(); };
    if (dans(s.ia) || dans(s.ib) || dans(s.il)) {
      if (dans(s.ib)) return {{"t", "slot"}, {"n", 1}, {"s", memoOblong(s)}};
      if (dans(s.ia)) return {{"t", "slot"}, {"n", 0}, {"s", memoOblong(s)}};
      break;
    }
  }
  return {{"t", "ctr"}, {"i", i}};
}
bool vueOblique(const J& v) { return vrai(v, "obl") || vrai(v, "persp"); }
bool diametreEntreTraits(Ctx& c, const J& v, const Ent& e1, const Ent& e2) {  // mepCylDiaBetween
  if (e1.t != 'L' || e2.t != 'L' || vueOblique(v)) return false;
  const Base b = baseDe(v);
  const double tol = 0.01, l1 = hyp(e1.x2 - e1.x1, e1.y2 - e1.y1);
  if (l1 < 1e-9) return false;
  const double ux = (e1.x2 - e1.x1) / l1, uy = (e1.y2 - e1.y1) / l1;
  const auto off = [&](const Ent& e, double ox, double oy) { return (e.x1 - ox) * -uy + (e.y1 - oy) * ux; };
  const double gap = std::abs(off(e2, e1.x1, e1.y1));
  if (gap < 1e-6) return false;
  for (const Corps* bd : corpsDeVue(c, v))
    for (const RevAxe& g : cylindresDe(c, *bd)) {
      if (std::abs(dot(g.d, b.dir)) > 0.02) continue;
      double dx = dot(g.d, b.u), dy = dot(g.d, b.v);
      const double L = hyp(dx, dy);
      if (L < 1e-9) continue;
      dx /= L, dy /= L;
      if (std::abs(dx * uy - dy * ux) > 1e-3) continue;
      const double ox = dot(g.o, b.u), oy = dot(g.o, b.v), s1 = off(e1, ox, oy), s2 = off(e2, ox, oy);
      std::vector<double> rs = g.rs;
      if (rs.empty()) rs.push_back(g.r);
      for (double r : rs)
        if (std::abs(gap - 2 * r) < tol && std::abs(std::abs(s1) - r) < tol && std::abs(std::abs(s2) - r) < tol && s1 * s2 < 0) return true;
    }
  return false;
}
bool diametreDeSegment(Ctx& c, const J& v, double ax, double ay, double bx, double by) {  // mepCylDiaSeg
  if (vueOblique(v)) return false;
  const double len = hyp(bx - ax, by - ay);
  if (len < 1e-6) return false;
  const Base b = baseDe(v);
  const double tol = 0.01, mx = (ax + bx) / 2, my = (ay + by) / 2;
  for (const Corps* bd : corpsDeVue(c, v))
    for (const RevAxe& g : cylindresDe(c, *bd)) {
      if (std::abs(dot(g.d, b.dir)) > 0.02) continue;
      double dx = dot(g.d, b.u), dy = dot(g.d, b.v);
      const double L = hyp(dx, dy);
      if (L < 1e-9) continue;
      dx /= L, dy /= L;
      if (std::abs(((bx - ax) * dx + (by - ay) * dy) / len) > 1e-3) continue;
      const double ox = dot(g.o, b.u), oy = dot(g.o, b.v);
      if (std::abs((mx - ox) * -dy + (my - oy) * dx) > tol) continue;
      const double t = ((mx - ox) * dx + (my - oy) * dy) / L;
      if (t < g.t0 - tol || t > g.t1 + tol) continue;
      std::vector<double> rs = g.rs;
      if (rs.empty()) rs.push_back(g.r);
      for (double r : rs)
        if (std::abs(len - 2 * r) < tol) return true;
    }
  return false;
}
void diametreAuto(Ctx& c, J& d) {  // mepDimAutoDia
  const std::string k = chaine(d, "kind");
  if (vrai(d, "dsym") || vrai(d, "txt") || (k != "len" && k != "dist") || (vrai(d, "vid2") && chaine(d, "vid2") != chaine(d, "vid"))) return;
  J* v = vueMod(c.sh, chaine(d, "vid"));
  if (!v || !vrai(d, "a") || !vrai(d, "b")) return;
  double ax = num(d["a"], "x"), ay = num(d["a"], "y"), bx = num(d["b"], "x"), by = num(d["b"], "y");
  if (k == "len" && vrai(d["a"], "hint"))
    if (const auto e = entiteDeHint(c, *v, d["a"]["hint"]); e && e->t == 'L') ax = e->x1, ay = e->y1, bx = e->x2, by = e->y2;
  const std::string o = chaine(d, "orient", "a");
  if (o == "h") by = ay;
  else if (o == "v") bx = ax;
  try {
    if (diametreDeSegment(c, *v, ax, ay, bx, by)) d["dsym"] = "Ø";
  } catch (const std::exception&) {
  }
}
J brouillonDeSelection(Ctx& c, const std::vector<SelEnt>& sel) {  // mepDimDraftFromSel
  if (sel.empty()) return nullptr;
  J* Av = vueMod(c.sh, sel[0].vid);
  if (!Av) return nullptr;
  const auto Ae0 = entDeSel(c, *Av, sel[0]);
  if (!Ae0) return nullptr;
  const Ent Ae = *Ae0;
  const J Ai = indiceEnt(sel[0]);
  const std::string avid = chaine(*Av, "id");
  J base = {{"off", 10}, {"tol", nullptr}, {"__ghost", true}, {"vid", avid}, {"vid2", nullptr}};
  if (sel.size() == 1) {
    if (Ae.t == 'L') {
      base["kind"] = "len";
      base["a"] = {{"x", Ae.x1}, {"y", Ae.y1}, {"hint", {{"t", "seg"}, {"i", Ai}}}};
      base["b"] = {{"x", Ae.x2}, {"y", Ae.y2}};
      return base;
    }
    if (Ae.t == 'C' || Ae.t == 'A') {
      base["kind"] = Ae.t == 'A' ? "rad" : "dia";
      base["a"] = {{"x", Ae.cx}, {"y", Ae.cy}, {"hint", {{"t", "ctr"}, {"i", Ai}}}};
      base["b"] = {{"x", Ae.cx + Ae.r}, {"y", Ae.cy}};
      return base;
    }
    return nullptr;
  }
  if (sel.size() != 2) return nullptr;
  J* Bv = vueMod(c.sh, sel[1].vid);
  if (!Bv) return nullptr;
  const auto Be0 = entDeSel(c, *Bv, sel[1]);
  if (!Be0) return nullptr;
  const Ent Be = *Be0;
  const J Bi = indiceEnt(sel[1]);
  const std::string bvid = chaine(*Bv, "id");
  const auto estL = [](const Ent& x) { return x.t == 'L'; };
  const auto estC = [](const Ent& x) { return x.t == 'C' || x.t == 'A'; };
  const auto centre = [&](J& v, const Ent& e, const SelEnt& s) {
    J q = {{"x", e.cx}, {"y", e.cy}};
    if (s.ak.empty()) q["hint"] = indiceCentre(c, v, s.i);
    else if (J h = refAxe(c, v, q, s.ak); !h.is_null()) q["hint"] = h;
    return q;
  };
  if (estL(Ae) && estL(Be)) {
    const double ax = Ae.x2 - Ae.x1, ay = Ae.y2 - Ae.y1, bx = Be.x2 - Be.x1, by = Be.y2 - Be.y1;
    const double la0 = hyp(ax, ay), lb0 = hyp(bx, by), la = la0 != 0 ? la0 : 1, lb = lb0 != 0 ? lb0 : 1;
    if (std::abs(ax * by - ay * bx) / (la * lb) < 1e-4 && avid == bvid) {
      const double snapTol = std::max(0.15, std::min(2.0, 1.5 / std::max(num(*Av, "scale"), 1e-9)));
      const auto sur = [&](const Ent& e, double lx, double ly, double& px, double& py) {  // mepSnapSeg
        const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
        double t = L2 > 1e-12 ? ((lx - e.x1) * dx + (ly - e.y1) * dy) / L2 : 0;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const double d0 = hyp(lx - e.x1, ly - e.y1), d1 = hyp(lx - e.x2, ly - e.y2);
        if (d0 <= snapTol && d0 <= d1) t = 0;
        else if (d1 <= snapTol) t = 1;
        px = e.x1 + dx * t, py = e.y1 + dy * t;
        return t;
      };
      double pax, pay, pbx, pby;
      const double tA = sur(Ae, sel[0].lx, sel[0].ly, pax, pay);
      sur(Be, sel[1].lx, sel[1].ly, pbx, pby);
      const double tB = ((pbx - Ae.x1) * ax + (pby - Ae.y1) * ay) / (la * la);
      double t = (tA + tB) / 2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const double ax0 = Ae.x1 + ax * t, ay0 = Ae.y1 + ay * t;
      double tb = ((ax0 - Be.x1) * bx + (ay0 - Be.y1) * by) / (lb * lb);
      tb = tb < 0 ? 0 : (tb > 1 ? 1 : tb);
      base["kind"] = "dist";
      base["a"] = {{"x", ax0}, {"y", ay0}, {"hint", {{"t", "seg"}, {"i", Ai}}}};
      base["b"] = {{"x", Be.x1 + bx * tb}, {"y", Be.y1 + by * tb}, {"hint", {{"t", "seg"}, {"i", Bi}}}};
      bool cyl = false;
      try {
        cyl = diametreEntreTraits(c, *Av, Ae, Be);
      } catch (const std::exception&) {
      }
      if (cyl) base["dsym"] = "Ø";
      return base;
    }
    base["kind"] = "ang", base["off"] = 14, base["vid2"] = bvid;
    base["a"] = {{"x", Ae.x1}, {"y", Ae.y1}, {"hint", {{"t", "seg"}, {"i", Ai}}}};
    base["b"] = {{"x", Be.x1}, {"y", Be.y1}, {"hint", {{"t", "seg"}, {"i", Bi}}}};
    return base;
  }
  if (avid != bvid) return nullptr;
  base["kind"] = "dist";
  if (estC(Ae) && estC(Be)) {
    base["a"] = centre(*Av, Ae, sel[0]);
    base["b"] = centre(*Bv, Be, sel[1]);
    return base;
  }
  const bool Aligne = estL(Ae);
  const Ent& line = Aligne ? Ae : Be;
  const Ent& circ = Aligne ? Be : Ae;
  if (!estL(line) || !estC(circ)) return nullptr;
  const double ax = line.x2 - line.x1, ay = line.y2 - line.y1, la0 = hyp(ax, ay), la = la0 != 0 ? la0 : 1;
  double t = ((circ.cx - line.x1) * ax + (circ.cy - line.y1) * ay) / (la * la);
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  base["a"] = {{"x", line.x1 + ax * t}, {"y", line.y1 + ay * t}, {"hint", {{"t", "seg"}, {"i", Aligne ? Ai : Bi}}}};
  base["b"] = centre(*Bv, circ, Aligne ? sel[1] : sel[0]);
  return base;
}
std::string orientDepuisPoints(double ax, double ay, double bx, double by, double px, double py) {  // mepDimOrientFromPts
  const double dx = bx - ax, dy = by - ay, mx = (ax + bx) / 2, my = (ay + by) / 2, rdx = px - mx, rdy = py - my;
  if (hyp(rdx, rdy) <= 1e-6) return "a";
  const double beta = std::atan2(dy, dx), phi = std::atan2(rdy, rdx);
  const auto w180 = [](double a) {
    a = std::fmod(a * 180 / PI, 180.0);
    if (a < 0) a += 180;
    return a;
  };
  struct K {
    const char* o;
    double d;
    bool ok;
  };
  std::vector<K> L = {{"h", w180(phi - PI / 2), std::abs(dx) > 1e-6}, {"v", w180(phi), std::abs(dy) > 1e-6}, {"a", w180(phi - (beta + PI / 2)), true}};
  std::stable_sort(L.begin(), L.end(), [](const K& p, const K& q) { return p.d < q.d; });
  for (const K& k : L)
    if (k.ok) return k.o;
  return "a";
}
void suivreSouris(Ctx& c, J& d, double x, double y) {  // mepDimMoveTo pour une cote en cours de pose
  const std::string k = chaine(d, "kind");
  if ((k == "len" || k == "dist") && vrai(d, "__ghost") && !vrai(d, "__orientLock") && vrai(d, "b"))
    if (const auto w = mondeCote(c, d)) d["orient"] = orientDepuisPoints(w->a.x, w->a.y, w->b.x, w->b.y, x, y);
  deplacerCoteDans(c, d, x, y, GesteCote());
}
J pointAccroche(Ctx& c, J& v, const Accroche& sn, double qx, double qy) {  // mepSnapHint
  J q = {{"x", qx}, {"y", qy}};
  if (!sn.hit || sn.vid != chaine(v, "id")) return q;
  J h;
  if (!sn.ak.empty() && (sn.t == "axEnd" || sn.t == "axMid" || sn.t == "onAx" || sn.t == "ctr")) h = refAxe(c, v, q, sn.ak);
  else if (sn.ak.empty() && sn.i >= 0) {
    if (sn.t == "end") h = {{"t", "seg"}, {"i", sn.i}};
    else if (sn.t == "ctr") h = indiceCentre(c, v, sn.i);
    else if (sn.t == "mid" || sn.t == "onSeg") {
      const std::vector<Ent>& els = geoDe(c, v).els;
      if (sn.i < static_cast<int>(els.size()) && els[sn.i].t == 'L') {
        const Ent& e = els[sn.i];
        const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
        h = {{"t", "eln"}, {"l", {{"x1", e.x1}, {"y1", e.y1}, {"x2", e.x2}, {"y2", e.y2}, {"k", e.k}}}, {"f", L2 > 1e-12 ? ((qx - e.x1) * dx + (qy - e.y1) * dy) / L2 : 0.0}};
      }
    }
  }
  if (!h.is_null()) q["hint"] = h;
  return q;
}
struct PointLocal {
  J* v = nullptr;
  J q;
};
PointLocal pointLocal(Ctx& c, double x, double y, double zoom) {  // mepSnapLocal
  PointLocal r;
  const Accroche sn = accrocher(c, x, y, zoom);
  r.v = sn.hit && !sn.vid.empty() ? vueMod(c.sh, sn.vid) : vueMod(c.sh, vueSous(c.sh, c.mep, c.piece, c.calc, sn.x, sn.y));
  if (!r.v) return r;
  const double s = num(*r.v, "scale");
  r.q = pointAccroche(c, *r.v, sn, (sn.x - num(*r.v, "x")) / s, (sn.y - num(*r.v, "y")) / s);
  return r;
}
J brouillonTrouLigne(Ctx& c, J& v, const Ent& e, const J& i, double lx, double ly) {  // mepHoleAtLine, mepHoleDraftLine
  if (e.t != 'L') return nullptr;
  const Base b = baseDe(v);
  const double len = hyp(e.x2 - e.x1, e.y2 - e.y1);
  if (len < 1e-6) return nullptr;
  const Trou* bestF = nullptr;
  double bestS = 0;
  for (const Trou& f : c.piece.trous) {
    if (!f.visible || f.pts.empty()) continue;
    const double co = std::abs(dot(f.dir, b.dir));
    if (co >= 0.999) continue;
    const double si = std::sqrt(1 - co * co), ax = dot(f.dir, b.u) / si, ay = dot(f.dir, b.v) / si;
    const std::vector<double> rs = rayonsAu(f, true);
    const double rMax = *std::max_element(rs.begin(), rs.end());
    const double r0 = f.d / 2;
    const double longueur = f.end != "blind" ? 2000 : f.depth + (f.tip > 0 ? r0 / std::tan(f.tip * PI / 360) : 0);
    const double spanT = longueur * si;
    const auto tolW = [](double r) { return std::max(0.05, r * 0.02); };
    const auto nearR = [&](double w) { return w <= 0.05 || std::any_of(rs.begin(), rs.end(), [&](double r) { return std::abs(w - r) <= tolW(r); }); };
    for (const PointTrou& P : f.pts) {
      const double px = dot(P.p, b.u), py = dot(P.p, b.v);
      const double t1 = (e.x1 - px) * ax + (e.y1 - py) * ay, w1s = (e.x1 - px) * ay - (e.y1 - py) * ax;
      const double t2 = (e.x2 - px) * ax + (e.y2 - py) * ay, w2s = (e.x2 - px) * ay - (e.y2 - py) * ax;
      const double marge = rMax * co + 0.2;
      const auto dans = [&](double t, double w) { return t >= -marge && t <= spanT + marge && std::abs(w) <= rMax + 0.05; };
      if (!dans(t1, w1s) || !dans(t2, w2s)) continue;
      const double w1 = std::abs(w1s), w2 = std::abs(w2s);
      bool aScore = false;
      double score = 0;
      if (std::abs(w1s - w2s) <= std::max(0.02, len * 0.02) && nearR(w1) && nearR(w2)) {
        score = w1;
        for (double r : rs) score = std::min(score, std::abs(w1 - r));
        aScore = true;
      } else if (co < 0.02 && nearR(w1) && nearR(w2)) {
        score = 1, aScore = true;
      } else if (co >= 0.02) {
        for (double r : rs) {
          if (w1 > r + tolW(r) || w2 > r + tolW(r)) continue;
          const double h1 = r * co * std::sqrt(std::max(0.0, 1 - (w1 * w1) / (r * r))), h2 = r * co * std::sqrt(std::max(0.0, 1 - (w2 * w2) / (r * r)));
          for (double a1 : {t1 - h1, t1 + h1})
            for (double a2 : {t2 - h2, t2 + h2})
              if (std::abs(a1 - a2) <= 0.05 + r * 0.03 && a1 >= -0.2 && a1 <= spanT + 0.2 && (!aScore || score > 1)) score = 1, aScore = true;
        }
      }
      if (aScore && (!bestF || score < bestS)) bestF = &f, bestS = score;
    }
  }
  if (!bestF) return nullptr;
  const int hn = totalFamille(c, familleTrou(c, *bestF));
  const double r0 = bestF->d / 2;
  J d = {{"kind", "hole"}, {"vid", chaine(v, "id")}, {"vid2", nullptr}, {"a", {{"x", lx}, {"y", ly}, {"hint", {{"t", "seg"}, {"i", i}}}}}, {"b", {{"x", lx + r0 + 5}, {"y", ly - r0 - 5}}}, {"off", 0}, {"holeFid", bestF->fid}, {"holeText", texteTrou(*bestF, c.st.prec)}, {"__ghost", true}, {"tol", nullptr}};
  if (hn > 1) d["holeN"] = hn;
  return d;
}
J brouillonTrou(Ctx& c, J& v, const EntTouchee& h) {  // mepHoleDraft
  const Ent& e = h.e;
  const J i = h.ak.empty() ? J(h.i) : J("ax:" + h.ak);
  if (e.t == 'L') return brouillonTrouLigne(c, v, e, i, h.lx, h.ly);
  const auto m = trouAuCercle(c, v, e);
  if (!m) {
    if (e.t != 'A') return nullptr;
    Ent corde;
    corde.t = 'L', corde.x1 = e.cx + e.r * std::cos(e.a0), corde.y1 = e.cy + e.r * std::sin(e.a0), corde.x2 = e.cx + e.r * std::cos(e.a1), corde.y2 = e.cy + e.r * std::sin(e.a1);
    return brouillonTrouLigne(c, v, corde, i, h.lx, h.ly);
  }
  const int hn = nombreDeTrous(c, v, familleTrou(c, *m->f));
  J d = {{"kind", "hole"}, {"vid", chaine(v, "id")}, {"vid2", nullptr}, {"a", {{"x", e.cx}, {"y", e.cy}, {"hint", {{"t", "ctr"}, {"i", i}}}}}, {"b", {{"x", e.cx + e.r * 0.9}, {"y", e.cy - e.r * 0.9}}}, {"off", 0}, {"holeFid", m->f->fid}, {"holeText", texteTrou(*m->f, c.st.prec)}, {"__ghost", true}, {"tol", nullptr}};
  if (hn > 1) d["holeN"] = hn;
  return d;
}
J coteDeChaine(Ctx& c, const OutilPlan& o, const J& q) {  // mepChainDim
  J d = {{"kind", "dist"}, {"vid", o.chaineVue}, {"vid2", nullptr}, {"a", o.chaineA}, {"b", q}, {"orient", o.chaineOrient}, {"off", 0}, {"tol", nullptr}};
  const auto w = mondeCote(c, d);
  if (!w) return nullptr;
  const double dx = w->b.x - w->a.x, dy = w->b.y - w->a.y;
  if (o.chaineOrient == "h" ? std::abs(dx) < 1e-6 : o.chaineOrient == "v" ? std::abs(dy) < 1e-6 : hyp(dx, dy) < 1e-6) return nullptr;
  d["off"] = decalageDepuisPoints(w->a.x, w->a.y, w->b.x, w->b.y, o.chaineOrient, o.chaineLx, o.chaineLy);
  return d;
}
J pointDeChaine(Ctx& c, const OutilPlan& o, double x, double y, double zoom) {  // mepChainPtAuto
  J* v = vueMod(c.sh, o.chaineVue);
  if (!v) return nullptr;
  const Accroche sn = accrocher(c, x, y, zoom);
  const double s = num(*v, "scale");
  return pointAccroche(c, *v, sn, (sn.x - num(*v, "x")) / s, (sn.y - num(*v, "y")) / s);
}
void poserBrouillon(Ctx& c, J& d, const std::string& id) {
  d["id"] = id;
  d.erase("__ghost"), d.erase("__orientLock"), d.erase("_pp");
  if (!d.contains("tol")) d["tol"] = nullptr;
  diametreAuto(c, d);
  c.sh["dims"].push_back(d);
}
J pointPapier(double x, double y) { return J::array({x, y}); }
// Les accrochages imposés (98-mep-86-accrochages.js)
J entVersJ(const Ent& e) {  // mepSnapEntOf
  if (e.t == 'L') return {{"t", "L"}, {"x1", e.x1}, {"y1", e.y1}, {"x2", e.x2}, {"y2", e.y2}, {"k", e.k}};
  if (e.t == 'A') return {{"t", "A"}, {"cx", e.cx}, {"cy", e.cy}, {"r", e.r}, {"a0", e.a0}, {"a1", e.a1}};
  return {{"t", "C"}, {"cx", e.cx}, {"cy", e.cy}, {"r", e.r}};
}
struct EntS {
  Ent e;
  int i;
  std::string ak;
};
std::vector<EntS> entsCotables(Ctx& c, J& v) {  // mepSnapEnts
  std::vector<EntS> out;
  const std::vector<Ent>& els = geoDe(c, v).els;
  for (int i = 0; i < static_cast<int>(els.size()); i++)
    if (els[i].t == 'L' || els[i].t == 'C' || els[i].t == 'A') out.push_back({els[i], i, ""});
  try {
    for (const Axe& p : lignesAxes(c, v))
      if (p.t == 'L' || p.t == 'C') {
        Ent e;
        e.t = p.t, e.x1 = p.x1, e.y1 = p.y1, e.x2 = p.x2, e.y2 = p.y2, e.cx = p.cx, e.cy = p.cy, e.r = p.r;
        out.push_back({e, -1, p.ak});
      }
  } catch (const std::exception&) {
  }
  return out;
}
std::vector<XY> croisements(const Ent& a, const Ent& b) {  // mepSnapInter
  std::vector<XY> out;
  const auto lineLine = [&](const Ent& p, const Ent& q) {
    const double dx1 = p.x2 - p.x1, dy1 = p.y2 - p.y1, dx2 = q.x2 - q.x1, dy2 = q.y2 - q.y1;
    const double den = dx1 * dy2 - dy1 * dx2, n = hyp(dx1, dy1) * hyp(dx2, dy2);
    if (!(n > 1e-18) || std::abs(den) / n < 1e-6) return;
    const double t = ((q.x1 - p.x1) * dy2 - (q.y1 - p.y1) * dx2) / den;
    out.push_back({p.x1 + dx1 * t, p.y1 + dy1 * t});
  };
  const auto lineCirc = [&](const Ent& p, const Ent& k) {
    const double dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = hyp(dx, dy);
    if (!(L > 1e-12)) return;
    const double ux = dx / L, uy = dy / L, t0 = (k.cx - p.x1) * ux + (k.cy - p.y1) * uy;
    const double fx = p.x1 + ux * t0, fy = p.y1 + uy * t0, h = hyp(k.cx - fx, k.cy - fy);
    if (h > k.r * (1 + 1e-9)) return;
    const double s = std::sqrt(std::max(0.0, k.r * k.r - h * h));
    out.push_back({fx + ux * s, fy + uy * s});
    if (s > 1e-9) out.push_back({fx - ux * s, fy - uy * s});
  };
  const auto circCirc = [&](const Ent& c1, const Ent& c2) {
    const double dx = c2.cx - c1.cx, dy = c2.cy - c1.cy, d = hyp(dx, dy);
    if (!(d > 1e-9) || d > c1.r + c2.r + 1e-9 || d < std::abs(c1.r - c2.r) - 1e-9) return;
    const double q = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d), h = std::sqrt(std::max(0.0, c1.r * c1.r - q * q));
    const double mx = c1.cx + dx * q / d, my = c1.cy + dy * q / d;
    out.push_back({mx - dy * h / d, my + dx * h / d});
    if (h > 1e-9) out.push_back({mx + dy * h / d, my - dx * h / d});
  };
  if (a.t == 'L' && b.t == 'L') lineLine(a, b);
  else if (a.t == 'L') lineCirc(a, b);
  else if (b.t == 'L') lineCirc(b, a);
  else circCirc(a, b);
  return out;
}
bool horsEntite(const Ent& e, double qx, double qy) {  // mepSnapOutside
  if (e.t == 'L') {
    const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
    if (!(L2 > 1e-12)) return false;
    const double t = ((qx - e.x1) * dx + (qy - e.y1) * dy) / L2, tol = 1e-4 / std::sqrt(L2);
    return t < -tol || t > 1 + tol;
  }
  if (e.t == 'A') return !arcContient(e, std::atan2(qy - e.cy, qx - e.cx));
  return false;
}
struct PointImpose {
  double x = 0, y = 0, qx = 0, qy = 0;
  std::string vid, mode;
  Accroche indice;  // ce qui donnera une référence durable
  std::vector<Ent> ext;
};
std::optional<PointImpose> pointImpose(Ctx& c, double sx, double sy, const std::string& mode, double zoom) {  // mepSnapModePt
  const double tol = 8 / zoom;
  std::optional<PointImpose> best;
  double bd = tol;
  const auto take = [&](J& v, double lx, double ly, const char* t, int i, const std::string& ak, const std::vector<Ent>& ext, double score) {
    const double s = num(v, "scale"), x = num(v, "x") + lx * s, y = num(v, "y") + ly * s, d = score >= 0 ? score : hyp(x - sx, y - sy);
    if (d < bd) {
      bd = d;
      PointImpose S;
      S.x = x, S.y = y, S.qx = lx, S.qy = ly, S.vid = chaine(v, "id"), S.mode = mode, S.ext = ext;
      if (t) S.indice.hit = true, S.indice.t = t, S.indice.vid = S.vid, S.indice.i = i, S.indice.ak = ak;
      best = S;
    }
  };
  const auto dansVue = [&](const J& v) {
    double x, y, w, h;
    if (!boiteDeVue(v, c.sh, c.mep, c.piece, c.calc, x, y, w, h)) return true;
    return sx >= x - 20 && sx <= x + w + 20 && sy >= y - 20 && sy <= y + h + 20;
  };
  if (mode == "end" || mode == "mid" || mode == "ctr") {
    for (J& v : c.sh["views"]) {
      if (!dansVue(v)) continue;
      for (const EntS& es : entsCotables(c, v)) {
        const Ent& e = es.e;
        const char* tEnd = es.ak.empty() ? "end" : "axEnd";
        const char* tMid = es.ak.empty() ? "mid" : "axMid";
        if (e.t == 'L') {
          if (mode == "end") {
            take(v, e.x1, e.y1, tEnd, es.i, es.ak, {}, -1);
            take(v, e.x2, e.y2, tEnd, es.i, es.ak, {}, -1);
          } else if (mode == "mid") take(v, (e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, tMid, es.i, es.ak, {}, -1);
        } else if (mode == "ctr") take(v, e.cx, e.cy, "ctr", es.i, es.ak, {}, -1);
        else if (e.t == 'A') {
          if (mode == "end") {
            take(v, e.cx + e.r * std::cos(e.a0), e.cy + e.r * std::sin(e.a0), nullptr, -1, "", {}, -1);
            take(v, e.cx + e.r * std::cos(e.a1), e.cy + e.r * std::sin(e.a1), nullptr, -1, "", {}, -1);
          } else if (mode == "mid") {
            const double m = (std::min(e.a0, e.a1) + std::max(e.a0, e.a1)) / 2;
            take(v, e.cx + e.r * std::cos(m), e.cy + e.r * std::sin(m), nullptr, -1, "", {}, -1);
          }
        }
      }
    }
    return best;
  }
  if (mode == "maxx" || mode == "maxy") {
    const auto hit = entiteSousCurseur(c, sx, sy, zoom, true);
    if (!hit) return std::nullopt;
    J* v = vueMod(c.sh, hit->vid);
    if (!v) return std::nullopt;
    const Ent& e = hit->e;
    struct P {
      double x, y;
      bool end;
    };
    std::vector<P> pts;
    if (e.t == 'L') pts = {{e.x1, e.y1, true}, {e.x2, e.y2, true}};
    else if (e.t == 'C' || e.t == 'A') {
      for (double k : {0.0, 0.5, 1.0, 1.5}) {
        const double a = k * PI;
        if (e.t == 'C' || arcContient(e, a)) pts.push_back({e.cx + e.r * std::cos(a), e.cy + e.r * std::sin(a), false});
      }
      if (e.t == 'A')
        for (double a : {e.a0, e.a1}) pts.push_back({e.cx + e.r * std::cos(a), e.cy + e.r * std::sin(a), false});
    }
    if (pts.empty()) return std::nullopt;
    const bool enX = mode == "maxx";
    P lo = pts[0], hi = pts[0];
    for (const P& q : pts) {
      if ((enX ? q.x : q.y) < (enX ? lo.x : lo.y) - 1e-9) lo = q;
      if ((enX ? q.x : q.y) > (enX ? hi.x : hi.y) + 1e-9) hi = q;
    }
    bd = 1e300;
    for (const P& q : {lo, hi}) take(*v, q.x, q.y, q.end && hit->ak.empty() ? "end" : nullptr, hit->i, "", {}, -1);
    return best;
  }
  if (mode == "int") {
    for (J& v : c.sh["views"]) {
      if (!dansVue(v)) continue;
      const double s = num(v, "scale"), lx = (sx - num(v, "x")) / s, ly = (sy - num(v, "y")) / s, tl = tol / s;
      struct K {
        Ent e;
        double d;
      };
      std::vector<K> cand;
      for (const EntS& es : entsCotables(c, v)) {
        const Ent& e = es.e;
        double d;
        if (e.t == 'L') {
          const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = hyp(dx, dy);
          if (!(L > 1e-9)) continue;
          d = std::abs((lx - e.x1) * dy - (ly - e.y1) * dx) / L;
        } else d = std::abs(hyp(lx - e.cx, ly - e.cy) - e.r);
        if (d <= tl * 1.5) cand.push_back({e, d});
      }
      std::stable_sort(cand.begin(), cand.end(), [](const K& a, const K& b) { return a.d < b.d; });
      if (cand.size() > 24) cand.resize(24);
      for (size_t i = 0; i < cand.size(); i++)
        for (size_t j = i + 1; j < cand.size(); j++)
          for (const XY& p : croisements(cand[i].e, cand[j].e)) {
            const bool out = horsEntite(cand[i].e, p.x, p.y) || horsEntite(cand[j].e, p.x, p.y);
            const double sc = hyp(num(v, "x") + p.x * s - sx, num(v, "y") + p.y * s - sy) + (out ? 0.15 / zoom : 0);
            take(v, p.x, p.y, nullptr, -1, "", {cand[i].e, cand[j].e}, sc);
          }
    }
    return best;
  }
  return std::nullopt;
}
J pointDeImpose(Ctx& c, const PointImpose& S) {  // mepSnapModeQ
  J q = {{"x", S.qx}, {"y", S.qy}};
  if (S.ext.size() == 2) {
    q["hint"] = {{"t", "int"}, {"e", J::array({entVersJ(S.ext[0]), entVersJ(S.ext[1])})}};
    return q;
  }
  J* v = vueMod(c.sh, S.vid);
  return v ? pointAccroche(c, *v, S.indice, S.qx, S.qy) : q;
}
std::optional<EntTouchee> entiteIntersection(Ctx& c, double x, double y, double zoom) {  // mepIntPickHit
  auto h = entiteSousCurseur(c, x, y, zoom, true);
  return h && (h->e.t == 'L' || h->e.t == 'C' || h->e.t == 'A') ? h : std::nullopt;
}
std::optional<PointImpose> pointIntersection(Ctx& c, const OutilPlan& o, const std::optional<EntTouchee>& hit, double x, double y) {  // mepIntPoint
  if (!o.aInt || !hit || hit->vid != o.intVue || (hit->i == o.intI && hit->ak == o.intAk)) return std::nullopt;
  J* v = vueMod(c.sh, hit->vid);
  if (!v) return std::nullopt;
  std::optional<PointImpose> best;
  double bd = 1e300;
  const double s = num(*v, "scale");
  for (const XY& p : croisements(o.intEnt, hit->e)) {
    const double X = num(*v, "x") + p.x * s, Y = num(*v, "y") + p.y * s, d = hyp(X - x, Y - y);
    if (d < bd) {
      bd = d;
      PointImpose S;
      S.x = X, S.y = Y, S.qx = p.x, S.qy = p.y, S.vid = hit->vid, S.mode = "int", S.ext = {o.intEnt, hit->e};
      best = S;
    }
  }
  return best;
}
std::string libelleAccrochage(const std::string& m) {
  for (const auto& q : modesAccrochage())
    if (q.first == m) return q.second;
  return "Automatique";
}
std::string minuscule(std::string s) {  // la 1ʳᵉ lettre seule : les libellés commencent par une capitale simple
  if (!s.empty() && s[0] >= 'A' && s[0] <= 'Z') s[0] = static_cast<char>(s[0] + 32);
  return s;
}
std::optional<PointImpose> cliqueImpose(Ctx& c, OutilPlan& o, double x, double y, double zoom, std::string& msg) {  // mepSnapModeClick, mepIntClick
  if (o.snapMode != "int") {
    auto S = pointImpose(c, x, y, o.snapMode, zoom);
    if (!S) msg = "Accrochage " + minuscule(libelleAccrochage(o.snapMode)) + " : aucun point sous le curseur.";
    return S;
  }
  const auto hit = entiteIntersection(c, x, y, zoom);
  if (!o.aInt) {
    if (!hit) return msg = "Intersection : cliquez une ligne ou un cercle.", std::nullopt;
    o.aInt = true, o.intVue = hit->vid, o.intI = hit->i, o.intAk = hit->ak, o.intEnt = hit->e;
    return msg = "Intersection : cliquez la 2ᵉ ligne ou le cercle (Échap annule l’intersection).", std::nullopt;
  }
  if (!hit) return msg = "Intersection : cliquez la 2ᵉ ligne ou le cercle (Échap annule l’intersection).", std::nullopt;
  if (hit->vid != o.intVue) return msg = "Intersection : les 2 entités doivent être dans la même vue.", std::nullopt;
  if (hit->i == o.intI && hit->ak == o.intAk) return msg = "Intersection : cliquez une AUTRE ligne ou un cercle.", std::nullopt;
  auto S = pointIntersection(c, o, hit, x, y);
  if (!S) return msg = "Intersection : ces 2 entités ne se coupent pas, même prolongées — cliquez-en une autre.", std::nullopt;
  o.aInt = false, o.aSnapHov = false;
  return S;
}
bool droiteVersPoint(Ctx& c, OutilPlan& o, const PointImpose& S, double x, double y, std::string& msg) {  // mepDimLineToPt
  J* v = vueMod(c.sh, o.dimLine.vid);
  if (!v) return o.aDimLine = false, msg = "Cote annulée : vue supprimée.", false;
  if (S.vid != o.dimLine.vid) return msg = "Distance : la droite et le point doivent être dans la même vue.", false;
  const J q = pointDeImpose(c, S);
  const Ent& e = o.dimLineEnt;
  const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = hyp(dx, dy);
  if (!(L > 1e-12)) return false;
  const char* hv = std::abs(dy) / L < 1e-4 ? "v" : std::abs(dx) / L < 1e-4 ? "h" : nullptr;
  double t = ((S.qx - e.x1) * dx + (S.qy - e.y1) * dy) / (L * L);
  if (hv) t = t < 0 ? 0 : (t > 1 ? 1 : t);
  const double fx = e.x1 + dx * t, fy = e.y1 + dy * t;
  const std::string orient = hv ? hv : "a";
  const double dn = orient == "v" ? std::abs(S.qy - fy) : orient == "h" ? std::abs(S.qx - fx) : hyp(S.qx - fx, S.qy - fy);
  if (dn < 1e-9) return msg = "Distance : ce point est sur la droite — choisissez-en un autre.", false;
  J a = {{"x", fx}, {"y", fy}};
  if (t >= -1e-9 && t <= 1 + 1e-9) a["hint"] = {{"t", "seg"}, {"i", indiceEnt(o.dimLine)}};
  o.dim = {{"kind", "dist"}, {"vid", o.dimLine.vid}, {"a", a}, {"b", q}, {"off", 8}, {"orient", orient}, {"__ghost", true}, {"__orientLock", true}, {"_pp", pointPapier(x, y)}};
  o.aDimLine = false, o.entSel.clear(), o.hov = false, o.aSnapHov = false;
  suivreSouris(c, o.dim, x, y);
  msg = "Distance droite → point : cliquez pour placer la cote.";
  return true;
}
// Les axes (98-mep-80-souris.js, mepAxisClick ; 98-mep-70-cotes.js, mepAxisHoleAt)
std::string cleRef(const J& r) {  // mepAxisRefKey
  if (vrai(r, "fid")) return chaine(r, "fid") + "|" + chaine(r, "pid");
  if (vrai(r, "ax")) {
    const V3 o = v3(sous(r["ax"], "o")), d = v3(sous(r["ax"], "d"));
    return "x" + js::fixe(o[0], 2) + "," + js::fixe(o[1], 2) + "," + js::fixe(o[2], 2) + "|" + js::fixe(d[0], 3) + "," + js::fixe(d[1], 3) + "," + js::fixe(d[2], 3);
  }
  if (vrai(r, "c")) return "c" + js::fixe(num(r["c"], "cx"), 2) + "," + js::fixe(num(r["c"], "cy"), 2) + "," + js::fixe(num(r["c"], "r"), 2);
  return "";
}
J axeGeoSous(Ctx& c, double sx, double sy, double zoom) {  // mepAxisGeoAt
  const auto hit = entiteSousCurseur(c, sx, sy, zoom, false);
  J* v0 = hit ? vueMod(c.sh, hit->vid) : vueMod(c.sh, vueSous(c.sh, c.mep, c.piece, c.calc, sx, sy));
  const double tolS = 8 / zoom;
  J best;
  double bd = tolS;
  const auto examiner = [&](J& v) {
    if (vueOblique(v)) return;
    const Base b = baseDe(v);
    const double s = num(v, "scale"), px = (sx - num(v, "x")) / s, py = (sy - num(v, "y")) / s;
    for (const Corps* bd3 : corpsDeVue(c, v))
      for (const RevAxe& g : revolutionsDe(c, *bd3)) {
        const double facing = dot(g.d, b.dir);
        const auto P = [&](double t) { return V3{g.o[0] + g.d[0] * t, g.o[1] + g.d[1] * t, g.o[2] + g.d[2] * t}; };
        double d = 1e300, r = g.r;
        std::vector<double> rs = g.rs;
        if (rs.empty()) rs.push_back(g.r);
        if (std::abs(facing) > 0.999) {
          const V3 q = P(g.t0);
          const double rc = hyp(px - dot(q, b.u), py - dot(q, b.v));
          for (double rr : rs) {
            const double k = std::abs(rc - rr) * s;
            if (k < d) d = k, r = rr;
          }
          d = std::min(d, rc * s);
        } else if (std::abs(facing) < 0.02) {
          const V3 A = P(g.t0), B = P(g.t1);
          const double ax = dot(A, b.u), ay = dot(A, b.v), bx = dot(B, b.u), by = dot(B, b.v), L = hyp(bx - ax, by - ay);
          if (L < 1e-6) continue;
          const double ux = (bx - ax) / L, uy = (by - ay) / L, t = (px - ax) * ux + (py - ay) * uy;
          if (t < -1 / s * tolS || t > L + tolS / s) continue;
          const double off = std::abs((px - ax) * -uy + (py - ay) * ux);
          d = off * s;
          for (double rr : rs) {
            const double k = std::abs(off - rr) * s;
            if (k < d) d = k, r = rr;
          }
        } else continue;
        if (d < bd) {
          bd = d;
          best = {{"vid", chaine(v, "id")}, {"ax", {{"o", {g.o[0], g.o[1], g.o[2]}}, {"d", {g.d[0], g.d[1], g.d[2]}}, {"r", r}, {"t0", g.t0}, {"t1", g.t1}}}};
        }
      }
  };
  if (v0) examiner(*v0);
  else
    for (J& v : c.sh["views"]) examiner(v);
  if (!best.is_null()) return best;
  if (hit && (hit->e.t == 'C' || hit->e.t == 'A')) return {{"vid", hit->vid}, {"c", {{"cx", hit->e.cx}, {"cy", hit->e.cy}, {"r", hit->e.r}}}};
  return nullptr;
}
J trouAxeSous(Ctx& c, double sx, double sy, double zoom) {  // mepAxisHoleAt
  const auto hit = entiteSousCurseur(c, sx, sy, zoom, false);
  if (hit && hit->ak.empty()) {
    J* v = vueMod(c.sh, hit->vid);
    if (v)
      if (const auto m = trouAuCercle(c, *v, hit->e)) return {{"vid", hit->vid}, {"fid", m->f->fid}, {"pid", m->P->id}};
  }
  J* v0 = vueMod(c.sh, vueSous(c.sh, c.mep, c.piece, c.calc, sx, sy));
  J best;
  double bd = 8 / zoom;
  const auto examiner = [&](J& v) {
    const Base b = baseDe(v);
    const double s = num(v, "scale");
    for (const Trou& f : c.piece.trous) {
      if (!f.visible) continue;
      for (const PointTrou& P : f.pts) {
        const TrouVu h = trouVu(f, P, b);
        const double d = hyp(num(v, "x") + h.x * s - sx, num(v, "y") + h.y * s - sy);
        if (d < bd) bd = d, best = {{"vid", chaine(v, "id")}, {"fid", h.fid}, {"pid", h.pid}};
      }
    }
  };
  if (v0) examiner(*v0);
  else
    for (J& v : c.sh["views"]) examiner(v);
  if (!best.is_null()) return best;
  try {
    return axeGeoSous(c, sx, sy, zoom);
  } catch (const std::exception&) {
    return nullptr;
  }
}
bool centresEgaux(const J& a, const Oblong& b, double t) {  // mepSlotSameCenters
  const auto n = [&](double x, double y) { return std::abs(x - y) <= t; };
  const double x1 = num(a, "x1"), y1 = num(a, "y1"), x2 = num(a, "x2"), y2 = num(a, "y2");
  return (n(x1, b.x1) && n(y1, b.y1) && n(x2, b.x2) && n(y2, b.y2)) || (n(x1, b.x2) && n(y1, b.y2) && n(x2, b.x1) && n(y2, b.y1));
}
void ajouterAxe(J& v, J ann) {
  if (!v.contains("axes") || !v["axes"].is_array()) v["axes"] = J::array();
  v["axes"].push_back(std::move(ann));
}
std::string texteModeAxe(const OutilPlan& o) {  // mepAxisModeStatus
  const std::string& m = o.axisMode;
  const std::string n = std::to_string(o.axisPick.size());
  if (m == "align") return "Alignement : " + n + " trou(s) sélectionné(s) — cliquez encore ou Entrée pour créer.";
  if (m == "pitch") return "Cercle de perçage : " + n + " trou(s) sélectionné(s) — cliquez encore ou Entrée pour créer.";
  if (m == "free") return "Axe libre : cliquez le départ puis l’arrivée.";
  if (m == "sym") return o.aSym ? "Axe de symétrie : cliquez la 2ᵉ droite." : "Axe de symétrie : cliquez 2 droites (parallèles : axe médian ; sécantes : bissectrice).";
  return "Axe : cliquez un trou, un cercle, un arc, un oblong ou le contour d’une forme de révolution.";
}
void cliqueAxe(Ctx& c, OutilPlan& o, SuiteOutil& r, double x, double y, double zoom) {  // mepAxisClick
  const std::string& mode = o.axisMode;
  if (mode == "sym") {
    const auto hit = entiteSousCurseur(c, x, y, zoom, false);
    if (!hit || hit->e.t != 'L') return void(r.message = "Axe de symétrie : cliquez une droite d’une vue.");
    if (!o.aSym) {
      o.aSym = true, o.symVue = hit->vid, o.symEnt = hit->e, o.symI = hit->i;
      return void(r.message = texteModeAxe(o));
    }
    o.aSym = false;
    if (o.symVue != hit->vid) return void(r.message = "Axe de symétrie : les 2 droites doivent être dans la même vue.");
    if (o.symI == hit->i) {
      o.aSym = true;
      return void(r.message = "Axe de symétrie : cliquez une AUTRE droite.");
    }
    J* v = vueMod(c.sh, hit->vid);
    if (!v) return;
    XY A, B;
    if (!axeSym(segDe(segVers(o.symEnt)), segDe(segVers(hit->e)), *v, A, B)) return void(r.message = "Axe de symétrie : droites dégénérées.");
    ajouterAxe(*v, {{"id", identifiantPlan("ax")}, {"kind", "sym"}, {"l1", segVers(o.symEnt)}, {"l2", segVers(hit->e)}});
    r.change = true, r.libelle = "axe de symétrie", r.message = "Axe de symétrie créé — tirez ses extrémités pour l’allonger.";
    return;
  }
  if (mode == "free") {
    const Accroche sn = accrocher(c, x, y, zoom);
    J* v = vueMod(c.sh, vueSous(c.sh, c.mep, c.piece, c.calc, sn.x, sn.y));
    if (!v) return void(r.message = "Axe libre : cliquez dans une vue.");
    if (!o.aFree) {
      o.aFree = true, o.freeX = sn.x, o.freeY = sn.y, o.freeVue = chaine(*v, "id"), o.hovX = sn.x, o.hovY = sn.y;
      return void(r.message = "Axe libre : cliquez le 2ᵉ point.");
    }
    if (chaine(*v, "id") != o.freeVue) return void(r.message = "Axe libre : les 2 points doivent être dans la même vue.");
    const double s = num(*v, "scale"), vx = num(*v, "x"), vy = num(*v, "y");
    const double ax = (o.freeX - vx) / s, ay = (o.freeY - vy) / s, bx = (sn.x - vx) / s, by = (sn.y - vy) / s;
    if (hyp(bx - ax, by - ay) < 0.2) return void(r.message = "Axe libre : points confondus.");
    o.aFree = false;
    ajouterAxe(*v, {{"id", identifiantPlan("ax")}, {"kind", "free"}, {"a", {{"x", ax}, {"y", ay}}}, {"b", {{"x", bx}, {"y", by}}}});
    r.change = true, r.libelle = "axe libre", r.message = "Axe libre créé.";
    return;
  }
  if (mode == "hole") {  // un oblong : ses 2 centres d'un seul clic (mepSlotAxisClick)
    const auto hit = entiteSousCurseur(c, x, y, zoom, false);
    if (hit && hit->ak.empty()) {
      J* v = vueMod(c.sh, hit->vid);
      if (v && !trouAuCercle(c, *v, hit->e)) {
        const Oblong* s = nullptr;
        for (const Oblong& q : oblongsDe(c, *v)) {
          const auto dans = [&](const std::vector<int>& L) { return std::find(L.begin(), L.end(), hit->i) != L.end(); };
          if (dans(q.ia) || dans(q.ib) || dans(q.il)) {
            s = &q;
            break;
          }
        }
        if (s) {
          const J& ax = sous(*v, "axes");
          if (ax.is_array())
            for (const J& a : ax)
              if (chaine(a, "kind") == "slot" && vrai(a, "s") && centresEgaux(a["s"], *s, 0.01)) return void(r.message = "Cet oblong a déjà ses 2 centres et son axe.");
          ajouterAxe(*v, {{"id", identifiantPlan("ax")}, {"kind", "slot"}, {"s", memoOblong(*s)}});
          r.change = true, r.libelle = "axe d’oblong", r.message = "Oblong : 2 centres et axe créés (ils suivent le modèle) — cotez depuis ces centres.";
          return;
        }
      }
    }
  }
  const J ref = trouAxeSous(c, x, y, zoom);
  if (ref.is_null()) return void(r.message = "Axe : cliquez un cercle, un arc, un oblong ou le contour d’une forme de révolution.");
  J* v = vueMod(c.sh, chaine(ref, "vid"));
  if (!v) return;
  if (mode == "hole") {
    ajouterAxe(*v, {{"id", identifiantPlan("ax")}, {"kind", "hole"}, {"ref", ref}});
    r.change = true, r.libelle = "axe de perçage";
    r.message = vrai(ref, "fid") ? "Axe de trou créé." : std::string("Axe créé") + (vrai(ref, "ax") ? " sur la forme de révolution (suit le modèle)." : " sur le cercle.");
    return;
  }
  if (!o.axisPick.empty() && chaine(o.axisPick[0], "vid") != chaine(ref, "vid")) return void(r.message = "Axe : sélectionnez les trous dans la même vue.");
  const auto it = std::find_if(o.axisPick.begin(), o.axisPick.end(), [&](const J& q) { return cleRef(q) == cleRef(ref); });
  if (it != o.axisPick.end()) o.axisPick.erase(it);
  else o.axisPick.push_back(ref);
  r.message = texteModeAxe(o);
}
const char* libelleCote(const std::string& k) { return k == "hole" ? "cote perçage" : k == "dia" ? "cote Ø" : k == "rad" ? "cote R" : k == "ang" ? "cote angle" : k == "len" ? "cote longueur" : "cote distance"; }
}  // namespace

std::string texteOutilAxe(const OutilPlan& o) { return texteModeAxe(o); }
std::string validerMotifAxe(J& mep, int planche, const Piece& p, Calcul& calc, OutilPlan& o, std::string& libelle) {  // mepAxisCommitPattern
  Ctx c = contexteGeste(mep, planche, p, calc);
  libelle.clear();
  if (o.axisPick.empty()) return "";
  J* v = vueMod(c.sh, chaine(o.axisPick[0], "vid"));
  if (!v) return "Axe : vue introuvable.";
  J refs = J::array();
  std::vector<TrouVu> hs;
  for (const J& r : o.axisPick) {
    J q = r;
    if (const auto h = axeDeReference(c, *v, q)) hs.push_back(*h);
    refs.push_back(q);
  }
  const double tol = AX_TOL / echelleAxe(*v);
  if (o.axisMode == "align") {
    if (hs.size() < 2) return "Alignement : sélectionnez au moins 2 trous.";
    // mepAxisCollinear
    const TrouVu* A = &hs[0];
    const TrouVu* B = &hs.back();
    double best = -1;
    for (size_t i = 0; i < hs.size(); i++)
      for (size_t j = i + 1; j < hs.size(); j++) {
        const double d = std::pow(hs[i].x - hs[j].x, 2) + std::pow(hs[i].y - hs[j].y, 2);
        if (d > best) best = d, A = &hs[i], B = &hs[j];
      }
    const double dx = B->x - A->x, dy = B->y - A->y, L = hyp(dx, dy);
    const bool ok = L >= 1e-9 && std::all_of(hs.begin(), hs.end(), [&](const TrouVu& h) { return std::abs((h.x - A->x) * dy - (h.y - A->y) * dx) / L <= tol; });
    if (!ok) return "Alignement : les centres ne sont pas alignés.";
    o.axisPick.clear();
    ajouterAxe(*v, {{"id", identifiantPlan("ax")}, {"kind", "align"}, {"refs", refs}});
    libelle = "axe aligné";
    return "Axe commun créé sur " + std::to_string(hs.size()) + " trous.";
  }
  if (o.axisMode == "pitch") {
    if (hs.size() < 3) return "Cercle de perçage : sélectionnez au moins 3 trous.";
    double cx, cy, r;
    if (!ajusterCercle(hs, cx, cy, r)) return "Cercle de perçage : les centres ne sont pas sur un même cercle.";
    double m = 0;
    for (const TrouVu& h : hs) m = std::max(m, std::abs(hyp(h.x - cx, h.y - cy) - r));
    if (m > std::max(0.1, tol * 2)) return "Cercle de perçage : les centres ne sont pas sur un même cercle.";
    o.axisPick.clear();
    ajouterAxe(*v, {{"id", identifiantPlan("ax")}, {"kind", "pitch"}, {"refs", refs}});
    libelle = "cercle de perçage";
    return "Cercle de perçage créé sur " + std::to_string(hs.size()) + " trous.";
  }
  return "";
}
std::optional<AxeTouche> axeSous(J& mep, int planche, const Piece& p, Calcul& calc, double sx, double sy, double zoom) {  // mepAxisAt
  Ctx c = contexteGeste(mep, planche, p, calc);
  const double tol = 5 / zoom;
  std::optional<AxeTouche> best;
  double bd = tol;
  for (J& v : c.sh["views"]) {
    const double s = num(v, "scale"), vx = num(v, "x"), vy = num(v, "y");
    for (const Axe& q : lignesAxes(c, v)) {
      double d = 1e9;
      int end = 0;
      if (q.t == 'L') {
        const double ax = vx + q.x1 * s, ay = vy + q.y1 * s, bx = vx + q.x2 * s, by = vy + q.y2 * s, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const double t = L2 > 1e-12 ? std::max(0.0, std::min(1.0, ((sx - ax) * dx + (sy - ay) * dy) / L2)) : 0;
        d = hyp(sx - (ax + dx * t), sy - (ay + dy * t));
        const double d1 = hyp(sx - ax, sy - ay), d2 = hyp(sx - bx, sy - by);
        if (std::min(d1, d2) <= 6 / zoom) end = d1 <= d2 ? 1 : 2;
        if (end) d = (end == 1 ? d1 : d2) - tol;
      } else if (q.t == 'C') {
        d = std::abs(hyp(sx - (vx + q.cx * s), sy - (vy + q.cy * s)) - q.r * s);
      }
      if (d < bd) {
        bd = d;
        AxeTouche h;
        h.vid = chaine(v, "id"), h.ak = q.ak, h.end = end, h.ligne = q.t == 'L';
        if (q.manuel) h.id = q.ak.substr(1, q.ak.rfind('.') - 1);
        best = h;
      }
    }
  }
  if (!best) return best;
  // Un axe libre se tire par ses deux extrémités mémorisées
  if (J* v = vueMod(c.sh, best->vid); v && !best->id.empty() && v->contains("axes"))
    for (const J& an : (*v)["axes"])
      if (chaine(an, "id") == best->id && chaine(an, "kind") == "free" && vrai(an, "a") && vrai(an, "b")) {
        const double s = num(*v, "scale"), vx = num(*v, "x"), vy = num(*v, "y");
        const double dA = hyp(vx + num(an["a"], "x") * s - sx, vy + num(an["a"], "y") * s - sy), dB = hyp(vx + num(an["b"], "x") * s - sx, vy + num(an["b"], "y") * s - sy);
        best->libre = true;
        best->end = std::min(dA, dB) <= 6 / zoom ? (dA <= dB ? 1 : 2) : 0;
      }
  return best;
}
bool tirerAxe(J& mep, int planche, const Piece& p, Calcul& calc, const AxeTouche& h, double x, double y, double zoom) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueMod(c.sh, h.vid);
  if (!v) return false;
  const double s = num(*v, "scale"), vx = num(*v, "x"), vy = num(*v, "y");
  if (h.libre) {
    for (J& an : (*v)["axes"])
      if (chaine(an, "id") == h.id) {
        const char* mob = h.end == 1 ? "a" : "b";
        const J fix = an[h.end == 1 ? "b" : "a"];
        const double dx = num(an[mob], "x") - num(fix, "x"), dy = num(an[mob], "y") - num(fix, "y"), L = hyp(dx, dy);
        if (!(L > 1e-9)) return false;
        const double ux = dx / L, uy = dy / L, lx = (x - vx) / s, ly = (y - vy) / s;
        const double t = std::max(0.5, (lx - num(fix, "x")) * ux + (ly - num(fix, "y")) * uy);
        an[mob] = {{"x", num(fix, "x") + ux * t}, {"y", num(fix, "y") + uy * t}};
        return true;
      }
    return false;
  }
  const Axe* q = axeParCle(c, *v, h.ak);
  if (!q || q->t != 'L') return false;
  const double L = hyp(q->bx2 - q->bx1, q->by2 - q->by1);
  if (!(L > 1e-9)) return false;
  const double ux = (q->bx2 - q->bx1) / L, uy = (q->by2 - q->by1) / L;
  const Accroche sn = accrocher(c, x, y, zoom, true);  // sur la géométrie, hors traits d'axe
  const double px = sn.hit ? sn.x : x, py = sn.hit ? sn.y : y, lx = (px - vx) / s, ly = (py - vy) / s;
  double e1 = 0, e2 = 0;
  if (const J& ex = sous(*v, "axExt"); ex.is_object() && ex.contains(h.ak) && ex[h.ak].is_array() && ex[h.ak].size() >= 2) e1 = ex[h.ak][0].get<double>(), e2 = ex[h.ak][1].get<double>();
  if (h.end == 1) e1 = -((lx - q->bx1) * ux + (ly - q->by1) * uy);
  else e2 = (lx - q->bx2) * ux + (ly - q->by2) * uy;
  const double mn = 0.5 / s;
  if (L + e1 + e2 < mn) {
    if (h.end == 1) e1 = mn - L - e2;
    else e2 = mn - L - e1;
  }
  if (!(*v).contains("axExt") || !(*v)["axExt"].is_object()) (*v)["axExt"] = J::object();
  (*v)["axExt"][h.ak] = J::array({js::arrondi(e1, 4), js::arrondi(e2, 4)});
  return true;
}
void enleverAxe(J& v, const std::string& id) {  // mepAxisExtDrop et le retrait
  J nv = J::array();
  if (v.contains("axes") && v["axes"].is_array())
    for (J& a : v["axes"])
      if (chaine(a, "id") != id) nv.push_back(std::move(a));
  v["axes"] = std::move(nv);
  retirerAllongements(v, id);
}
void retirerAllongements(J& v, const std::string& id) {
  if (!v.contains("axExt") || !v["axExt"].is_object()) return;
  const std::string pre = "m" + id + ".";
  J ne = J::object();
  for (auto it = v["axExt"].begin(); it != v["axExt"].end(); ++it)
    if (it.key().rfind(pre, 0) != 0) ne[it.key()] = it.value();
  v["axExt"] = std::move(ne);
}
ApercuCommande apercuAxeChoisi(J& mep, int planche, const Piece& p, Calcul& calc, const std::string& vid, const std::string& id, const std::string& ak, double zoom) {
  ApercuCommande a;
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueMod(c.sh, vid);
  if (!v) return a;
  const double s = num(*v, "scale"), vx = num(*v, "x"), vy = num(*v, "y"), hs = 2.2 / std::max(1e-6, zoom);
  for (const Axe& q : lignesAxes(c, *v)) {
    const bool sel = id.empty() ? q.ak == ak : (q.manuel && q.ak.rfind("m" + id + ".", 0) == 0);
    if (!sel) continue;
    if (q.t == 'L') {
      a.traits.push_back({vx + q.x1 * s, vy + q.y1 * s, vx + q.x2 * s, vy + q.y2 * s, false, false});
      a.cadres.push_back({vx + q.x1 * s - hs, vy + q.y1 * s - hs, 2 * hs, 2 * hs, false});
      a.cadres.push_back({vx + q.x2 * s - hs, vy + q.y2 * s - hs, 2 * hs, 2 * hs, false});
    } else if (q.t == 'C') {
      a.ronds.push_back({vx + q.cx * s, vy + q.cy * s, q.r * s, false});
    }
  }
  return a;
}
OutilPlan commencerOutil(const std::string& tool, const std::string& coteSelection, const J& sh) {  // mepSetTool
  OutilPlan o;
  o.tool = tool;
  if ((tool == "ordx" || tool == "ordy") && !coteSelection.empty()) {
    if (const J* g = coteParId(const_cast<J&>(sh), coteSelection))
      if (chaine(*g, "kind") == "ord" && (chaine(*g, "axis") == "y") == (tool == "ordy")) o.ord = coteSelection;
  }
  return o;
}
SuiteOutil cliqueOutil(J& mep, int planche, const Piece& p, Calcul& calc, OutilPlan& o, double x, double y, bool ctrl, bool maj, bool alt, double zoom) {
  SuiteOutil r;
  Ctx c = contexteGeste(mep, planche, p, calc);
  J& sh = c.sh;
  if (!sh.contains("dims") || !sh["dims"].is_array()) sh["dims"] = J::array();
  const auto hitVueDe = [&](const EntTouchee& h) { return vueMod(sh, h.vid); };
  const auto validerPose = [&](const std::string& message) {
    J d = o.dim;
    const std::string id = identifiantPlan("d");
    const std::string k = chaine(d, "kind");
    d["ref"] = maj;
    poserBrouillon(c, d, id);
    o.dim = nullptr, o.entSel.clear(), o.hov = false;
    r.change = true, r.libelle = libelleCote(k), r.selCote = id, r.message = message;
  };
  if (o.tool == "dim") {
    if (o.enChaine) {  // mepChainClick
      J q;
      if (!o.snapMode.empty()) {
        std::string msg;
        const auto S = cliqueImpose(c, o, x, y, zoom, msg);
        if (!S) return r.message = msg, r;
        if (S->vid != o.chaineVue) return r.message = "Chaîne de cotes : le point doit être dans la même vue.", r;
        q = pointDeImpose(c, *S);
      } else q = pointDeChaine(c, o, x, y, zoom);
      J d = q.is_null() ? J() : coteDeChaine(c, o, q);
      if (d.is_null()) return r.message = "Chaîne de cotes : cote nulle dans cette direction — cliquez un autre point.", r;
      d["id"] = identifiantPlan("d"), d["ref"] = false;
      diametreAuto(c, d);
      o.chaineA = d["b"];
      sh["dims"].push_back(d);
      o.chaineN++;
      o.dim = nullptr, o.snapMode.clear(), o.aSnapHov = false, o.aInt = false;
      r.change = true, r.libelle = "cote en chaîne";
      r.message = "Chaîne de cotes : " + std::to_string(o.chaineN) + " cote" + (o.chaineN > 1 ? "s" : "") + " — cliquez le point suivant (Échap termine).";
      return r;
    }
    if (o.dim.is_null() && !o.snapMode.empty()) {  // le clic donne un point, jamais une entité
      std::string msg;
      const auto S = cliqueImpose(c, o, x, y, zoom, msg);
      if (!S) return r.message = msg, r;
      if (o.aDimLine) return droiteVersPoint(c, o, *S, x, y, msg), r.message = msg, r;
      o.dim = {{"kind", "dist"}, {"a", pointDeImpose(c, *S)}, {"vid", S->vid}, {"off", 8}, {"__ghost", true}};
      o.aSnapHov = false;
      r.message = "Distance : cliquez le 2ᵉ point (accrochage " + minuscule(libelleAccrochage(o.snapMode)) + ", clic droit pour changer).";
      return r;
    }
    if (!o.dim.is_null() && chaine(o.dim, "kind") == "dist" && !vrai(o.dim, "b") && !o.snapMode.empty()) {
      std::string msg;
      const auto S = cliqueImpose(c, o, x, y, zoom, msg);
      if (!S) return r.message = msg, r;
      if (S->vid != chaine(o.dim, "vid")) return r.message = "Distance : les 2 points doivent être dans la même vue.", r;
      o.dim["b"] = pointDeImpose(c, *S);
      o.dim["_pp"] = pointPapier(x, y);
      o.aSnapHov = false;
      r.message = "Distance : encore un clic pour placer la cote.";
      return r;
    }
    const bool pp = !o.dim.is_null() && chaine(o.dim, "kind") == "dist" && (!vrai(o.dim, "b") || o.dim.contains("_pp"));
    if (!pp) {
      const std::optional<EntTouchee> hit = entiteSousCurseur(c, x, y, zoom, true);
      const auto utile = [&]() { return hit && (hit->e.t == 'L' || hit->e.t == 'C' || hit->e.t == 'A'); };
      if (!o.dim.is_null()) {
        const bool meme = hit && !o.entSel.empty() && std::any_of(o.entSel.begin(), o.entSel.end(), [&](const SelEnt& s) { return s.vid == hit->vid && s.i == hit->i && s.ak == hit->ak && (s.sig.empty() || s.sig == signatureEnt(hit->e, hit->ak)); });
        if (o.entSel.size() == 1 && !meme && utile()) {  // mepDimAddEnt
          std::vector<SelEnt> s2 = o.entSel;
          s2.push_back(selDe(*hit));
          J d = brouillonDeSelection(c, s2);
          if (d.is_null()) return r.message = "Cote : ces 2 entités ne peuvent pas être cotées ensemble.", r;
          o.entSel = s2, o.dim = d;
          r.message = "2 entités — cliquez pour poser la cote (clic droit : R/Ø).";
          return r;
        }
        suivreSouris(c, o.dim, x, y);  // mepDimCommitDraft
        validerPose("Cote posée — glissez n’importe quel trait rouge ou l’étiquette pour la déplacer.");
        return r;
      }
      if (utile()) {  // mepDimSelectEnt
        const std::vector<SelEnt> s1{selDe(*hit)};
        J d = brouillonDeSelection(c, s1);
        if (d.is_null()) return r.message = "Cote : cette entité ne peut pas être cotée seule.", r;
        if (hit->e.t == 'C' || hit->e.t == 'A') d["kind"] = hit->e.t == 'A' ? (alt ? "dia" : "rad") : (alt ? "rad" : "dia");
        o.entSel = s1, o.dim = d;
        r.effacerSelection = true;
        const std::string lab = hit->e.t == 'L' ? "Longueur" : chaine(d, "kind") == "dia" ? "Cote Ø" : "Cote R";
        r.message = lab + " : cliquez une 2ᵉ entité ou posez la cote (Échap annule).";
        return r;
      }
      // Sinon : un point libre, pour une distance
      const Accroche sn = accrocher(c, x, y, zoom);
      J* v = vueMod(sh, vueSous(sh, c.mep, c.piece, c.calc, sn.x, sn.y));
      if (!v) return r.message = "Cote : cliquez une arête ou un cercle projeté.", r;
      const double s = num(*v, "scale");
      o.dim = {{"kind", "dist"}, {"a", pointAccroche(c, *v, sn, (sn.x - num(*v, "x")) / s, (sn.y - num(*v, "y")) / s)}, {"vid", chaine(*v, "id")}, {"off", 8}, {"__ghost", true}};
      r.message = "Distance : cliquez le 2ᵉ point.";
      return r;
    }
    if (!vrai(o.dim, "b")) {
      J* v = vueMod(sh, chaine(o.dim, "vid"));
      if (!v) return o.dim = nullptr, r;
      const Accroche sn = accrocher(c, x, y, zoom);
      const double s = num(*v, "scale");
      o.dim["b"] = pointAccroche(c, *v, sn, (sn.x - num(*v, "x")) / s, (sn.y - num(*v, "y")) / s);
      o.dim["_pp"] = pointPapier(x, y);
      r.message = "Distance : encore un clic pour placer la cote.";
      return r;
    }
    // Le placement final
    suivreSouris(c, o.dim, x, y);
    J d = o.dim;
    J nd = {{"id", identifiantPlan("d")}, {"kind", "dist"}, {"vid", d["vid"]}, {"vid2", nullptr}, {"a", d["a"]}, {"b", d["b"]}, {"off", d["off"]}, {"orient", chaine(d, "orient", "a")}, {"ref", maj}, {"tol", nullptr}};
    diametreAuto(c, nd);
    sh["dims"].push_back(nd);
    o.dim = nullptr, o.entSel.clear(), o.snapMode.clear(), o.aSnapHov = false;
    r.change = true, r.libelle = "cote distance", r.message = "Cote posée.", r.effacerSelection = true;
    return r;
  }
  if (o.tool == "axis") {
    cliqueAxe(c, o, r, x, y, zoom);
    return r;
  }
  if (o.tool == "hole") {
    if (!o.dim.is_null()) {
      suivreSouris(c, o.dim, x, y);
      validerPose("Cote posée — glissez n’importe quel trait rouge ou l’étiquette pour la déplacer.");
      return r;
    }
    auto hit = entiteSousCurseur(c, x, y, zoom, false);
    J d = hit ? brouillonTrou(c, *hitVueDe(*hit), *hit) : J();
    if (d.is_null()) {
      auto hax = entiteSousCurseur(c, x, y, zoom, true);
      if (hax && hax->e.t == 'L') d = brouillonTrou(c, *hitVueDe(*hax), *hax);
    }
    if (d.is_null()) return r.message = "Perçage : cliquez un trou, vu de bout (cercle, arc) ou de côté (paroi, axe, fond).", r;
    o.dim = d;
    r.effacerSelection = true;
    r.message = "Perçage : cliquez pour placer l’étiquette (Échap annule).";
    return r;
  }
  if (o.tool == "ordx" || o.tool == "ordy") {  // mepOrdClick
    const std::string axis = o.tool == "ordy" ? "y" : "x";
    PointLocal S = pointLocal(c, x, y, zoom);
    if (!S.v) return r.message = "Ordonnées : cliquez dans une vue.", r;
    J* cur = o.ord.empty() ? nullptr : coteParId(sh, o.ord);
    if (!cur) {
      double off = -10;  // mepOrdDefaultOff
      const J& v = *S.v;
      const XY oS = versFeuille(v, num(S.q, "x"), num(S.q, "y"));
      double minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      bool any = false;
      for (const Ent& e : geoDe(c, *S.v).els) {
        double a, b, d, f;
        if (!boiteEnt(e, a, b, d, f)) continue;
        minx = std::min(minx, a), miny = std::min(miny, b), maxx = std::max(maxx, d), maxy = std::max(maxy, f), any = true;
      }
      if (any) off = axis == "y" ? (num(v, "x") + minx * num(v, "scale")) - 10 - oS.x : (num(v, "y") + miny * num(v, "scale")) - 10 - oS.y;
      const std::string id = identifiantPlan("d");
      sh["dims"].push_back({{"id", id}, {"kind", "ord"}, {"axis", axis}, {"vid", chaine(v, "id")}, {"vid2", nullptr}, {"o", S.q}, {"a", S.q}, {"b", S.q}, {"pts", J::array()}, {"off", off}, {"ref", false}, {"tol", nullptr}});
      o.ord = id;
      r.change = true, r.libelle = "cotation d’ordonnées", r.selCote = id;
      std::string A = axis;
      A[0] = static_cast<char>(toupper(A[0]));
      r.message = "Ordonnées " + A + " : origine « 0 » posée — cliquez les points à coter (Entrée ou Échap pour terminer).";
      return r;
    }
    if (chaine(*S.v, "id") != chaine(*cur, "vid")) return r.message = "Ordonnées : les points doivent être dans la vue de l’origine.", r;
    (*cur)["pts"].push_back(S.q);
    r.change = true, r.libelle = "point d’ordonnée";
    r.message = "Ordonnées : " + std::to_string((*cur)["pts"].size()) + " point(s) — Entrée ou Échap pour terminer.";
    return r;
  }
  if (o.tool == "note") {
    if (!o.dim.is_null()) {  // le 2ᵉ clic place le texte, puis le saisit
      suivreSouris(c, o.dim, x, y);
      J d = o.dim;
      const std::string id = identifiantPlan("d");
      d["ref"] = false;
      poserBrouillon(c, d, id);
      o.dim = nullptr;
      r.change = true, r.libelle = "cote distance", r.selCote = id, r.saisirNote = true;
      return r;
    }
    PointLocal S = pointLocal(c, x, y, zoom);
    if (!S.v) return r.message = "Note : cliquez la pointe de la flèche dans une vue.", r;
    const double s = num(*S.v, "scale");
    o.dim = {{"kind", "note"}, {"vid", chaine(*S.v, "id")}, {"vid2", nullptr}, {"a", S.q}, {"b", {{"x", num(S.q, "x") + 8 / s}, {"y", num(S.q, "y") - 8 / s}}}, {"off", 0}, {"txt", "Texte"}, {"__ghost", true}};
    r.effacerSelection = true;
    r.message = "Note : cliquez pour placer le texte (Échap annule).";
    return r;
  }
  return r;
}
bool survolOutil(J& mep, int planche, const Piece& p, Calcul& calc, OutilPlan& o, double x, double y, double zoom) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  o.curX = x, o.curY = y, o.aCur = true;
  const auto survolImpose = [&]() {
    const bool isInt = o.snapMode == "int";
    const auto ih = isInt ? entiteIntersection(c, x, y, zoom) : std::nullopt;
    const auto S = isInt ? pointIntersection(c, o, ih, x, y) : pointImpose(c, x, y, o.snapMode, zoom);
    o.hov = ih.has_value();
    if (ih) o.hovEnt = ih->e, o.hovVue = ih->vid;
    o.aSnapHov = S.has_value();
    if (S) {
      o.hovX = S->x, o.hovY = S->y, o.hovQx = S->qx, o.hovQy = S->qy, o.hovMode = S->mode, o.hovVueS = S->vid, o.hovExt = S->ext;
    }
    return S;
  };
  if (o.tool == "dim" && o.enChaine) {  // mepChainHover
    J q;
    if (!o.snapMode.empty()) {
      const auto S = survolImpose();
      if (S && S->vid == o.chaineVue) q = {{"x", S->qx}, {"y", S->qy}};
    } else {
      o.aSnapHov = false;
      q = pointDeChaine(c, o, x, y, zoom);
    }
    J d = q.is_null() ? J() : coteDeChaine(c, o, q);
    if (!d.is_null()) d["__ghost"] = true;
    o.dim = d;
    return true;
  }
  if (o.tool == "dim" && !o.snapMode.empty() && !(!o.dim.is_null() && vrai(o.dim, "b"))) {
    survolImpose();
    return false;
  }
  if (o.tool == "dim" || o.tool == "hole") {
    o.aSnapHov = false;
    const auto hit = entiteSousCurseur(c, x, y, zoom, o.tool == "dim");
    o.hov = hit.has_value();
    if (hit) o.hovEnt = hit->e, o.hovVue = hit->vid;
    if (!o.dim.is_null() && !(chaine(o.dim, "kind") == "dist" && !vrai(o.dim, "b"))) {
      suivreSouris(c, o.dim, x, y);
      return true;
    }
    return false;
  }
  if (o.tool == "note" && !o.dim.is_null()) {
    suivreSouris(c, o.dim, x, y);
    return true;
  }
  if (o.tool == "axis" && o.aFree) {
    const Accroche sn = accrocher(c, x, y, zoom);
    o.hovX = sn.x, o.hovY = sn.y;
  }
  return false;
}
const std::vector<std::pair<std::string, std::string>>& modesAccrochage() {  // MEP_SNAP_MODES
  static const std::vector<std::pair<std::string, std::string>> L = {{"", "Automatique"}, {"end", "Extrémité"}, {"mid", "Milieu"}, {"ctr", "Centre"}, {"maxx", "Point extrême suivant X"}, {"maxy", "Point extrême suivant Y"}, {"int", "Intersection (même prolongée)"}};
  return L;
}
std::string choisirAccrochage(J& mep, int planche, const Piece& p, Calcul& calc, OutilPlan& o, const std::string& m) {  // mepSetSnapMode
  Ctx c = contexteGeste(mep, planche, p, calc);
  o.snapMode = m, o.aSnapHov = false, o.aInt = false;
  if (!m.empty() && !o.dim.is_null() && chaine(o.dim, "kind") == "len" && o.entSel.size() == 1 && o.entSel[0].t == 'L') {
    if (J* v = vueMod(c.sh, o.entSel[0].vid))
      if (const auto e = entDeSel(c, *v, o.entSel[0]); e && e->t == 'L') {
        o.aDimLine = true, o.dimLine = o.entSel[0], o.dimLineEnt = *e;
        o.dim = nullptr, o.hov = false;
      }
  }
  if (m.empty() && o.aDimLine) {  // retour à la longueur de la droite
    o.aDimLine = false;
    o.dim = brouillonDeSelection(c, o.entSel);
  }
  if (!m.empty() && !o.dim.is_null() && !(chaine(o.dim, "kind") == "dist" && !vrai(o.dim, "b"))) {
    o.dim = nullptr, o.entSel.clear(), o.hov = false, o.aDimLine = false;
  }
  const std::string nth = (!o.dim.is_null() || o.aDimLine || o.enChaine) ? "2ᵉ" : "1ᵉʳ";
  if (m == "int") return "Intersection (" + nth + " point) : cliquez une ligne ou un cercle, puis une 2ᵉ (clic droit pour changer).";
  if (!m.empty()) return "Accrochage " + minuscule(libelleAccrochage(m)) + " : cliquez le " + nth + " point" + (o.aDimLine ? " (cote perpendiculaire à la droite)" : "") + " (clic droit pour changer).";
  return "Accrochage automatique.";
}
void orienterCote(J& mep, int planche, const Piece& p, Calcul& calc, J& d, const std::string& o) {  // mepDimSetOrient
  Ctx c = contexteGeste(mep, planche, p, calc);
  CoteVue q;
  ceQuiSaisitLaCote(c, d, q);
  d["orient"] = o;
  if (q.aTexte)
    if (const auto w = mondeCote(c, d)) d["off"] = decalageDepuisPoints(w->a.x, w->a.y, w->b.x, w->b.y, o, q.tx, q.ty);
}
ApercuCommande apercuOutil(J& mep, int planche, const Piece& p, Calcul& calc, const OutilPlan& o, double zoom) {
  ApercuCommande a;
  Ctx c = contexteGeste(mep, planche, p, calc);
  const auto dessiner = [&](J& v, const Ent& e) {
    const double s = num(v, "scale"), vx = num(v, "x"), vy = num(v, "y");
    if (e.t == 'L') {
      a.traits.push_back({vx + e.x1 * s, vy + e.y1 * s, vx + e.x2 * s, vy + e.y2 * s, false, false});
    } else if (e.t == 'C') {
      a.ronds.push_back({vx + e.cx * s, vy + e.cy * s, e.r * s, false});
    } else if (e.t == 'A') {
      const int n = 24;
      for (int k = 0; k < n; k++) {
        const double t0 = e.a0 + (e.a1 - e.a0) * k / n, t1 = e.a0 + (e.a1 - e.a0) * (k + 1) / n;
        a.traits.push_back({vx + (e.cx + e.r * std::cos(t0)) * s, vy + (e.cy + e.r * std::sin(t0)) * s, vx + (e.cx + e.r * std::cos(t1)) * s, vy + (e.cy + e.r * std::sin(t1)) * s, false, false});
      }
    }
  };
  if (o.hov)
    if (J* v = vueMod(c.sh, o.hovVue)) dessiner(*v, o.hovEnt);
  for (const SelEnt& s : o.entSel)
    if (J* v = vueMod(c.sh, s.vid))
      if (const auto e = entDeSel(c, *v, s)) dessiner(*v, *e);
  if (o.tool == "axis") {  // mepDrawAxisDraft
    if (o.aFree) {
      a.traits.push_back({o.freeX, o.freeY, o.hovX, o.hovY, false, false});
      return a;
    }
    if (o.aSym)
      if (J* v = vueMod(c.sh, o.symVue)) dessiner(*v, o.symEnt);
    if (!o.axisPick.empty())
      if (J* v = vueMod(c.sh, chaine(o.axisPick[0], "vid"))) {
        const double s = num(*v, "scale"), vx = num(*v, "x"), vy = num(*v, "y");
        std::vector<TrouVu> hs;
        for (const J& r : o.axisPick) {
          J q = r;
          if (const auto h = axeDeReference(c, *v, q)) hs.push_back(*h);
        }
        for (const TrouVu& h : hs) a.ronds.push_back({vx + h.x * s, vy + h.y * s, 3 / std::max(1e-6, zoom), false});
        if (o.axisMode == "align" && hs.size() >= 2) {
          for (const Prim& p : traitsAlignes(hs, *v, false))
            if (p.t == 'L') a.traits.push_back({vx + p.x1 * s, vy + p.y1 * s, vx + p.x2 * s, vy + p.y2 * s, false, false});
        } else if (o.axisMode == "pitch" && hs.size() >= 3) {
          double cx, cy, rr;
          if (ajusterCercle(hs, cx, cy, rr)) a.ronds.push_back({vx + cx * s, vy + cy * s, rr * s, true});
        }
      }
    return a;
  }
  // Le repère du point imposé survolé, ses prolongements et le 1ᵉʳ point déjà choisi (mepDrawSnapHov)
  if (o.tool == "dim") {
    const double z = std::max(1e-6, zoom), s = 3.2 / z;
    const auto trait = [&](double x1, double y1, double x2, double y2) { a.traits.push_back({x1, y1, x2, y2, false, false}); };
    const auto mark = [&](double x, double y, const std::string& m) {
      if (m == "end") {
        trait(x - s, y - s, x + s, y - s), trait(x + s, y - s, x + s, y + s), trait(x + s, y + s, x - s, y + s), trait(x - s, y + s, x - s, y - s);
      } else if (m == "mid") {
        trait(x, y - s * 1.2, x + s * 1.1, y + s * 0.8), trait(x + s * 1.1, y + s * 0.8, x - s * 1.1, y + s * 0.8), trait(x - s * 1.1, y + s * 0.8, x, y - s * 1.2);
      } else if (m == "ctr") {
        a.ronds.push_back({x, y, s, false});
      } else if (m == "int") {
        trait(x - s, y - s, x + s, y + s), trait(x - s, y + s, x + s, y - s);
      } else {
        trait(x, y - s * 1.2, x + s * 1.2, y), trait(x + s * 1.2, y, x, y + s * 1.2), trait(x, y + s * 1.2, x - s * 1.2, y), trait(x - s * 1.2, y, x, y - s * 1.2);
      }
    };
    const auto prolongements = [&](J& v, double qx, double qy, const std::vector<Ent>& ext) {
      const double sc = num(v, "scale"), vx = num(v, "x"), vy = num(v, "y");
      for (const Ent& e : ext) {
        if (!horsEntite(e, qx, qy)) continue;
        if (e.t == 'L') {
          const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
          const double t = L2 > 1e-12 ? ((qx - e.x1) * dx + (qy - e.y1) * dy) / L2 : 0;
          trait(vx + (t < 0 ? e.x1 : e.x2) * sc, vy + (t < 0 ? e.y1 : e.y2) * sc, vx + qx * sc, vy + qy * sc);
        }
      }
    };
    const J& D = o.dim;
    if (D.is_object() && chaine(D, "kind") == "dist" && vrai(D, "a") && !vrai(D, "b"))
      if (J* v = vueMod(c.sh, chaine(D, "vid"))) {
        const double sc = num(*v, "scale"), Ax = num(*v, "x") + num(D["a"], "x") * sc, Ay = num(*v, "y") + num(D["a"], "y") * sc;
        mark(Ax, Ay, chaine(sous(D["a"], "hint"), "t") == "int" ? "int" : "end");
        if (o.aSnapHov) trait(Ax, Ay, o.hovX, o.hovY);
      }
    if (o.aSnapHov) {
      if (J* v = vueMod(c.sh, o.hovVueS)) prolongements(*v, o.hovQx, o.hovQy, o.hovExt);
      if (o.aDimLine && o.hovVueS == o.dimLine.vid)
        if (J* v = vueMod(c.sh, o.dimLine.vid)) {  // le pied de la perpendiculaire
          const Ent& e = o.dimLineEnt;
          const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = hyp(dx, dy);
          if (L > 1e-12) {
            double t = ((o.hovQx - e.x1) * dx + (o.hovQy - e.y1) * dy) / (L * L);
            if (std::abs(dy) / L < 1e-4 || std::abs(dx) / L < 1e-4) t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const double sc = num(*v, "scale");
            trait(num(*v, "x") + (e.x1 + dx * t) * sc, num(*v, "y") + (e.y1 + dy * t) * sc, o.hovX, o.hovY);
          }
        }
      mark(o.hovX, o.hovY, o.hovMode);
    }
  }
  return a;
}
std::string coteRappelSous(J& mep, int planche, const Piece& p, Calcul& calc, J& d, double x, double y, double zoom) {  // mepChainRappelAt
  const std::string k = chaine(d, "kind");
  if (k != "len" && k != "dist") return "";
  Ctx c = contexteGeste(mep, planche, p, calc);
  const auto w = mondeCote(c, d);
  if (!w) return "";
  const auto g = ligneCote(c, d, *w);
  if (!g) return "";
  const auto sd = [&](const XY& A, const XY& B) {
    const double dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
    const double t = L2 > 1e-12 ? std::max(0.0, std::min(1.0, ((x - A.x) * dx + (y - A.y) * dy) / L2)) : 0;
    return hyp(x - (A.x + dx * t), y - (A.y + dy * t));
  };
  const double tol = 6 / zoom, da = sd(g->sa, g->ea), db = sd(g->sb, g->eb), dl = sd(g->a1, g->b1), m = std::min(da, db);
  if (!(m < tol) || dl < m) return "";
  CoteVue q;
  ceQuiSaisitLaCote(c, d, q);
  if (q.aTexte && hyp(x - q.tx, y - q.ty) < std::min(m, 2.5 / zoom)) return "";
  return da <= db ? "a" : "b";
}
bool commencerChaine(J& mep, int planche, const Piece& p, Calcul& calc, OutilPlan& o, J& d, const std::string& bout) {  // mepChainStart
  Ctx c = contexteGeste(mep, planche, p, calc);
  const auto w = mondeCote(c, d);
  if (!w) return false;
  const auto g = ligneCote(c, d, *w);
  if (!g || !vrai(d, bout.c_str())) return false;
  o.enChaine = true;
  o.chaineVue = bout == "a" ? chaine(d, "vid") : (vrai(d, "vid2") ? chaine(d, "vid2") : chaine(d, "vid"));
  o.chaineA = d[bout];
  o.chaineOrient = chaine(d, "orient", "a");
  o.chaineLx = bout == "a" ? g->a1.x : g->b1.x;
  o.chaineLy = bout == "a" ? g->a1.y : g->b1.y;
  o.chaineN = 0;
  o.dim = nullptr, o.entSel.clear(), o.hov = false;
  return true;
}
int percagesAuto(J& mep, int planche, const Piece& p, Calcul& calc, const std::string& vueChoisie) {  // mepAutoHoles
  Ctx c = contexteGeste(mep, planche, p, calc);
  J& sh = c.sh;
  if (!sh.contains("dims") || !sh["dims"].is_array()) sh["dims"] = J::array();
  std::set<std::string> faits;
  for (const J& d : sh["dims"]) {
    if (chaine(d, "kind") != "hole" || chaine(d, "holeFid").empty()) continue;
    const Trou* f = trouDe(c, chaine(d, "holeFid"));
    faits.insert(f ? familleTrou(c, *f) : chaine(d, "holeFid"));
  }
  J ajout = J::array();
  for (J& v : sh["views"]) {
    if (!vueChoisie.empty() && chaine(v, "id") != vueChoisie) continue;
    struct Vu {
      Ent e;
      int i;
      bool vis;
    };
    struct Fam {
      const Trou* f;
      std::string fam;
      std::vector<std::pair<std::string, Vu>> pts;
    };
    std::vector<Fam> parF;
    const std::vector<Ent>& els = geoDe(c, v).els;
    const auto span = [](const Ent& x) { return x.t == 'C' ? 2 * PI : std::abs(x.a1 - x.a0); };
    for (int i = 0; i < static_cast<int>(els.size()); i++) {
      const Ent& e = els[i];
      const auto m = trouAuCercle(c, v, e);
      if (!m) continue;
      const std::string fam = familleTrou(c, *m->f);
      if (faits.count(fam)) continue;
      const std::string cle = js::fixe(m->P->p[0], 3) + "," + js::fixe(m->P->p[1], 3) + "," + js::fixe(m->P->p[2], 3);
      auto F = std::find_if(parF.begin(), parF.end(), [&](const Fam& q) { return q.fam == fam; });
      if (F == parF.end()) parF.push_back({m->f, fam, {}}), F = parF.end() - 1;
      auto q = std::find_if(F->pts.begin(), F->pts.end(), [&](const auto& w) { return w.first == cle; });
      const bool vis = e.k != "hid";
      if (q == F->pts.end()) F->pts.push_back({cle, {e, i, vis}});
      else if ((vis && !q->second.vis) || (vis == q->second.vis && (e.r > q->second.e.r + 1e-6 || (std::abs(e.r - q->second.e.r) <= 1e-6 && span(e) > span(q->second.e))))) q->second = {e, i, vis};
    }
    for (const Fam& F : parF) {
      std::vector<Vu> L;
      for (const auto& q : F.pts) L.push_back(q.second);
      std::stable_sort(L.begin(), L.end(), [](const Vu& A, const Vu& B) {
        const int ca = A.e.t == 'C', cb = B.e.t == 'C';
        if (ca != cb) return ca > cb;
        return (A.e.cx - A.e.cy) > (B.e.cx - B.e.cy);
      });
      const Ent& e = L[0].e;
      const double k = e.r + 9 / std::max(1e-9, num(v, "scale") != 0 ? num(v, "scale") : 1);
      const double a0 = -PI / 4;
      double ang = a0;
      if (e.t == 'A') {  // mepHoleArcAng : un côté où le trou existe encore
        bool dedans = false;
        for (const Ent& q : els)
          if ((q.t == 'C' || q.t == 'A') && hyp(q.cx - e.cx, q.cy - e.cy) < 0.05 && std::abs(q.r - e.r) < 0.05 && (q.t == 'C' || arcContient(q, a0))) dedans = true;
        if (!dedans) ang = (e.a0 + e.a1) / 2;
      }
      J d = {{"id", identifiantPlan("d")}, {"kind", "hole"}, {"vid", chaine(v, "id")}, {"vid2", nullptr}, {"a", {{"x", e.cx}, {"y", e.cy}, {"hint", {{"t", "ctr"}, {"i", L[0].i}}}}},
             {"b", {{"x", e.cx + k * std::sqrt(2.0) * 0.75 * std::cos(ang)}, {"y", e.cy + k * std::sqrt(2.0) * 0.75 * std::sin(ang)}}}, {"off", 0}, {"holeFid", F.f->fid}, {"holeText", texteTrou(*F.f, c.st.prec)}, {"holeN", L.size()}, {"tol", nullptr}, {"ref", false}};
      ajout.push_back(d);
      faits.insert(F.fam);
    }
  }
  for (J& d : ajout) sh["dims"].push_back(d);
  return static_cast<int>(ajout.size());
}
