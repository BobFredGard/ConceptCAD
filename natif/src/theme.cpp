#include "theme.h"

#include <wx/config.h>

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace theme {
namespace {

int courant_ = NUIT;
bool iconesCouleur_ = false;

// scene : le sol miroir de MF_3D ; bord : --border posé sur --surface ; bureau : MEP_DESK
const Palette PALETTES[NB] = {
    {L"Nuit", "nuit", wxColour(0x13, 0x15, 0x19), wxColour(0x1c, 0x1c, 0x1e), wxColour(0x2a, 0x2c, 0x30), wxColour(0x3a, 0x3a, 0x3d), wxColour(0x98, 0x98, 0x9d), wxColour(0xf5, 0xf5, 0xf7), wxColour(0x0a, 0x84, 0xff), wxColour(0x2b, 0x2e, 0x34)},
    {L"Graphite", "graphite", wxColour(0x17, 0x18, 0x1a), wxColour(0x20, 0x21, 0x24), wxColour(0x2e, 0x2f, 0x32), wxColour(0x43, 0x44, 0x47), wxColour(0x9a, 0xa0, 0xa6), wxColour(0xe8, 0xea, 0xed), wxColour(0x8a, 0xb4, 0xf8), wxColour(0x30, 0x32, 0x36)},
    {L"Atelier", "atelier", wxColour(0x14, 0x12, 0x10), wxColour(0x1a, 0x17, 0x14), wxColour(0x2a, 0x25, 0x20), wxColour(0x3f, 0x35, 0x2b), wxColour(0xa8, 0x9f, 0x92), wxColour(0xf7, 0xf1, 0xe8), wxColour(0xff, 0x9f, 0x0a), wxColour(0x2a, 0x26, 0x22)},
    {L"Clair", "clair", wxColour(0xd7, 0xdb, 0xe2), wxColour(0xe9, 0xec, 0xf1), wxColour(0xff, 0xff, 0xff), wxColour(0xe0, 0xe0, 0xe0), wxColour(0x5f, 0x63, 0x68), wxColour(0x1c, 0x1c, 0x1e), wxColour(0x0a, 0x6c, 0xff), wxColour(0xc9, 0xce, 0xd6)},
    {L"Contraste élevé", "contraste", wxColour(0x05, 0x05, 0x05), wxColour(0x00, 0x00, 0x00), wxColour(0x0b, 0x0b, 0x0b), wxColour(0x6d, 0x6d, 0x6d), wxColour(0xd0, 0xd0, 0xd0), wxColour(0xff, 0xff, 0xff), wxColour(0x00, 0xa8, 0xff), wxColour(0x00, 0x00, 0x00)},
};

int lumiere(const wxColour& c) { return (c.Red() + c.Green() + c.Blue()) / 3; }

wxColour melange(const wxColour& a, const wxColour& b, double t, unsigned char alpha) {
  const auto m = [t](int x, int y) { return static_cast<unsigned char>(std::lround(x + (y - x) * t)); };
  return wxColour(m(a.Red(), b.Red()), m(a.Green(), b.Green()), m(a.Blue(), b.Blue()), alpha);
}

int ecart(const wxColour& a, const wxColour& b) { return std::abs(a.Red() - b.Red()) + std::abs(a.Green() - b.Green()) + std::abs(a.Blue() - b.Blue()); }

}  // namespace

const Palette& palette(int i) { return PALETTES[std::clamp(i, 0, NB - 1)]; }
int courant() { return courant_; }
void choisir(int i) { courant_ = std::clamp(i, 0, NB - 1); }
bool iconesCouleur() { return iconesCouleur_; }
void iconesCouleur(bool oui) { iconesCouleur_ = oui; }

void charger() {
  wxConfig c(L"ConceptCADNatif");
  long t = NUIT;
  c.Read(L"theme", &t, NUIT);
  choisir(static_cast<int>(t));
  bool ic = false;
  c.Read(L"iconesCouleur", &ic, false);
  iconesCouleur_ = ic;
}

void enregistrer() {
  wxConfig c(L"ConceptCADNatif");
  c.Write(L"theme", static_cast<long>(courant_));
  c.Write(L"iconesCouleur", iconesCouleur_);
}

wxColour traduire(const wxColour& n) {
  const Palette& N = PALETTES[NUIT];
  const Palette& P = PALETTES[courant_];
  const unsigned char a = n.Alpha();
  if (ecart(n, N.primary) < 12) return wxColour(P.primary.Red(), P.primary.Green(), P.primary.Blue(), a);
  const int mx = std::max({n.Red(), n.Green(), n.Blue()}), mn = std::min({n.Red(), n.Green(), n.Blue()});
  if (mx - mn > 24) return n;  // les couleurs franches gardent leur sens : vert, rouge, orange…
  const int L = lumiere(n);
  // Le blanc pur s'écrit sur les boutons bleus : il reste blanc
  if (L > lumiere(N.texte)) return n;
  const struct { int l; const wxColour& c; } ancres[] = {{lumiere(N.scene), P.scene}, {lumiere(N.bg), P.bg}, {lumiere(N.surface), P.surface}, {lumiere(N.bord), P.bord}, {lumiere(N.muted), P.muted}, {lumiere(N.texte), P.texte}};
  if (L <= ancres[0].l) return melange(P.scene, P.scene, 0, a);
  for (size_t i = 1; i < std::size(ancres); i++)
    if (L <= ancres[i].l) return melange(ancres[i - 1].c, ancres[i].c, static_cast<double>(L - ancres[i - 1].l) / std::max(1, ancres[i].l - ancres[i - 1].l), a);
  return melange(P.texte, P.texte, 0, a);
}

wxColour passer(const wxColour& c, int de, int vers) {
  const Palette& A = palette(de);
  const Palette& B = palette(vers);
  const struct { const wxColour& a; const wxColour& b; } paires[] = {{A.scene, B.scene}, {A.bg, B.bg}, {A.surface, B.surface}, {A.bord, B.bord}, {A.muted, B.muted}, {A.texte, B.texte}, {A.primary, B.primary}};
  int mieux = 1000;
  const wxColour* r = nullptr;
  for (const auto& p : paires) {
    const int e = ecart(c, p.a);
    if (e < mieux) {
      mieux = e;
      r = &p.b;
    }
  }
  return r && mieux < 30 ? wxColour(r->Red(), r->Green(), r->Blue(), c.Alpha()) : c;
}

}  // namespace theme
