// Une vidéo MP4 (H.264) écrite image par image, avec le codeur fourni par Windows (Media Foundation).
#pragma once
#include <wx/wx.h>

#include <memory>

class VideoMp4 {
 public:
  VideoMp4();
  ~VideoMp4();
  // Largeur et hauteur paires. Rend false si Windows refuse.
  bool ouvrir(const wxString& chemin, int largeur, int hauteur, int imagesParSeconde = 30);
  // ms : l'instant de l'image depuis le début
  bool ajouter(const wxImage& image, double ms);
  bool fermer();
  int largeur() const { return l_; }
  int hauteur() const { return h_; }

 private:
  struct Impl;
  std::unique_ptr<Impl> p_;
  int l_ = 0, h_ = 0, ips_ = 30;
};
