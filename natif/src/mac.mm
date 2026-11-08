// Le peu de Cocoa dont la version Mac a besoin : la vue où OCCT dessine, et la largeur exacte d'un texte.
#import <Cocoa/Cocoa.h>
#import <CoreText/CoreText.h>

#include <Cocoa_Window.hxx>
#include <wx/window.h>

#include <string>

#include "fenetre_occt.h"

occ::handle<Aspect_Window> fenetreOcct(wxWindow* w) {
  NSView* vue = (NSView*)w->GetHandle();
  // Écran Retina : les positions de la souris arrivent en points, pas en pixels. Pour que les clics tombent
  // juste sans tout reprendre, OCCT dessine pour l'instant en points (image un peu moins fine sur Retina).
  [vue setWantsBestResolutionOpenGLSurface:NO];
  return new Cocoa_Window(vue);
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
