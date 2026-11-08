// Le peu de Cocoa dont la version Mac a besoin : la vue où OCCT dessine, et la largeur exacte d'un texte.
#import <Cocoa/Cocoa.h>
#import <CoreText/CoreText.h>

#include <Cocoa_Window.hxx>
#include <wx/window.h>

#include <array>
#include <string>
#include <vector>

#include "fenetre_occt.h"

occ::handle<Aspect_Window> fenetreOcct(wxWindow* w) {
  NSView* vue = (NSView*)w->GetHandle();
  // Écran Retina : les positions de la souris arrivent en points, pas en pixels. Pour que les clics tombent
  // juste sans tout reprendre, OCCT dessine pour l'instant en points (image un peu moins fine sur Retina).
  [vue setWantsBestResolutionOpenGLSurface:NO];
  return new Cocoa_Window(vue);
}

// Le contour d'un symbole absent des polices du PDF, pour un corps de 1, y vers le haut (plan_export.inc ;
// Windows le lit dans « Segoe UI Symbol », le Mac dans « Apple Symbols » ou la police qui a le caractère)
void contourGlypheMac(wchar_t ch, std::vector<std::vector<std::array<double, 2>>>& boucles, double& avance) {
  @autoreleasepool {
    const double E = 2048;
    CTFontRef base = CTFontCreateWithName(CFSTR("Apple Symbols"), E, nullptr);
    UniChar u[2];
    CFIndex n = 1;
    const unsigned c = static_cast<unsigned>(ch);
    if (c >= 0x10000) {
      u[0] = static_cast<UniChar>(0xD800 + ((c - 0x10000) >> 10));
      u[1] = static_cast<UniChar>(0xDC00 + ((c - 0x10000) & 0x3FF));
      n = 2;
    } else {
      u[0] = static_cast<UniChar>(c);
    }
    CFStringRef s = CFStringCreateWithCharacters(nullptr, u, n);
    CTFontRef police = CTFontCreateForString(base, s, CFRangeMake(0, n));
    CGGlyph g[2] = {0, 0};
    if (CTFontGetGlyphsForCharacters(police, u, g, n)) {
      CGSize av;
      CTFontGetAdvancesForGlyphs(police, kCTFontOrientationHorizontal, g, &av, 1);
      avance = av.width / E;
      CGPathRef p = CTFontCreatePathForGlyph(police, g[0], nullptr);
      if (p) {
        struct Etat {
          std::vector<std::vector<std::array<double, 2>>>* b;
          double E;
        } etat{&boucles, E};
        CGPathApplyWithBlock(p, ^(const CGPathElement* el) {
          auto& B = *etat.b;
          const auto P = [&](CGPoint q) { return std::array<double, 2>{q.x / etat.E, q.y / etat.E}; };
          switch (el->type) {
            case kCGPathElementMoveToPoint:
              B.push_back({P(el->points[0])});
              break;
            case kCGPathElementAddLineToPoint:
              if (!B.empty()) B.back().push_back(P(el->points[0]));
              break;
            case kCGPathElementAddQuadCurveToPoint:
              if (!B.empty()) {
                const auto a = B.back().back(), k = P(el->points[0]), e = P(el->points[1]);
                for (int t = 1; t <= 8; t++) {
                  const double v = t / 8.0;
                  B.back().push_back({(1 - v) * (1 - v) * a[0] + 2 * v * (1 - v) * k[0] + v * v * e[0], (1 - v) * (1 - v) * a[1] + 2 * v * (1 - v) * k[1] + v * v * e[1]});
                }
              }
              break;
            case kCGPathElementAddCurveToPoint:
              if (!B.empty()) {
                const auto a = B.back().back(), k1 = P(el->points[0]), k2 = P(el->points[1]), e = P(el->points[2]);
                for (int t = 1; t <= 8; t++) {
                  const double v = t / 8.0, w = 1 - v;
                  B.back().push_back({w * w * w * a[0] + 3 * w * w * v * k1[0] + 3 * w * v * v * k2[0] + v * v * v * e[0], w * w * w * a[1] + 3 * w * w * v * k1[1] + 3 * w * v * v * k2[1] + v * v * v * e[1]});
                }
              }
              break;
            case kCGPathElementCloseSubpath:
              break;
          }
        });
        CGPathRelease(p);
      }
    }
    CFRelease(police);
    CFRelease(s);
    CFRelease(base);
  }
}

// La largeur d'un texte en Arial (gras ou non), crénage compris, en unités de la police de taille « corps »
// (plan_cotes.cpp : même rôle que GetCharacterPlacementW sous Windows)
double largeurTexteMac(const std::wstring& texte, bool gras, double corps) {
  @autoreleasepool {
    NSString* s = [[NSString alloc] initWithBytes:texte.data() length:texte.size() * sizeof(wchar_t) encoding:NSUTF32LittleEndianStringEncoding];
    CTFontRef police = CTFontCreateWithName(gras ? CFSTR("Arial-BoldMT") : CFSTR("ArialMT"), corps, nullptr);
    NSDictionary* attributs = @{(id)kCTFontAttributeName: (__bridge id)police};
    NSAttributedString* a = [[NSAttributedString alloc] initWithString:s attributes:attributs];
    CTLineRef ligne = CTLineCreateWithAttributedString((CFAttributedStringRef)a);
    const double l = CTLineGetTypographicBounds(ligne, nullptr, nullptr, nullptr);
    CFRelease(ligne);
    CFRelease(police);
#if !__has_feature(objc_arc)
    [a release];
    [s release];
#endif
    return l;
  }
}
