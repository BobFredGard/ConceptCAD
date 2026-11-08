// La fenêtre où OCCT dessine : WNT_Window sous Windows, Cocoa_Window (NSView) sur Mac (mac.mm).
#pragma once
#include <Aspect_Window.hxx>
#include <wx/window.h>

#ifdef _WIN32
#include <WNT_Window.hxx>
inline occ::handle<Aspect_Window> fenetreOcct(wxWindow* w) { return new WNT_Window(reinterpret_cast<Aspect_Handle>(w->GetHWND())); }
#else
occ::handle<Aspect_Window> fenetreOcct(wxWindow* w);
#endif
