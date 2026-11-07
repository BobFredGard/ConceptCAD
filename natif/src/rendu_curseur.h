// Le curseur des panneaux Rendu et de la fiche de la vue
#pragma once

#include <algorithm>
#include <cmath>
#include <functional>

#include <wx/dcbuffer.h>
#include <wx/wx.h>

class Curseur : public wxWindow {
 public:
  Curseur(wxWindow* parent, double v, double mini, double maxi, double pas) : wxWindow(parent, wxID_ANY), v_(v), a_(mini), b_(maxi), p_(pas) {
    SetBackgroundStyle(wxBG_STYLE_PAINT);
    SetMinSize(FromDIP(wxSize(50, 20)));
    Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
      wxAutoBufferedPaintDC dc(this);
      dc.SetBackground(GetParent()->GetBackgroundColour());
      dc.Clear();
      const wxSize t = GetClientSize();
      const int m = FromDIP(6), r = FromDIP(5), y = t.y / 2;
      dc.SetPen(*wxTRANSPARENT_PEN);
      dc.SetBrush(wxBrush(wxColour(0x48, 0x4a, 0x50)));
      dc.DrawRoundedRectangle(m, y - FromDIP(2), t.x - 2 * m, FromDIP(4), FromDIP(2));
      const int x = m + static_cast<int>((v_ - a_) / (b_ - a_) * (t.x - 2 * m));
      dc.SetBrush(wxBrush(wxColour(0x0a, 0x84, 0xff)));
      dc.DrawRoundedRectangle(m, y - FromDIP(2), x - m, FromDIP(4), FromDIP(2));
      dc.SetBrush(*wxWHITE_BRUSH);
      dc.DrawCircle(x, y, r);
    });
    const auto bouge = [this](wxMouseEvent& e) {
      if (!HasCapture()) return;
      poser(e.GetX());
    };
    Bind(wxEVT_LEFT_DOWN, [this](wxMouseEvent& e) {
      CaptureMouse();
      poser(e.GetX());
    });
    Bind(wxEVT_MOTION, bouge);
    Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) {
      if (HasCapture()) ReleaseMouse();
      if (surFin) surFin();
    });
    Bind(wxEVT_MOUSE_CAPTURE_LOST, [](wxMouseCaptureLostEvent&) {});
  }
  std::function<void(double)> surValeur;
  std::function<void()> surFin;

 private:
  void poser(int x) {
    const int m = FromDIP(6), l = std::max(1, GetClientSize().x - 2 * m);
    double v = a_ + std::clamp((x - m) / static_cast<double>(l), 0.0, 1.0) * (b_ - a_);
    v = a_ + std::round((v - a_) / p_) * p_;
    v = std::clamp(v, a_, b_);
    if (v == v_) return;
    v_ = v;
    Refresh(false);
    if (surValeur) surValeur(v_);
  }
  double v_, a_, b_, p_;
};
