// La fenêtre où OCCT dessine : WNT_Window sous Windows, Cocoa_Window (NSView) sur Mac (mac.mm).
#pragma once
#include <Aspect_Window.hxx>
#include <OpenGl_GraphicDriver.hxx>
#include <wx/window.h>

#ifdef _WIN32
#include <WNT_Window.hxx>
inline occ::handle<Aspect_Window> fenetreOcct(wxWindow* w) { return new WNT_Window(reinterpret_cast<Aspect_Handle>(w->GetHWND())); }
inline void reglerPiloteOcct(const occ::handle<OpenGl_GraphicDriver>&) {}
#else
occ::handle<Aspect_Window> fenetreOcct(wxWindow* w);
// Mac sans carte graphique utilisable (machine virtuelle, par exemple) : dessin 3D par le processeur plutôt qu'une fermeture
void reglerPiloteOcct(const occ::handle<OpenGl_GraphicDriver>& pilote);
#endif
