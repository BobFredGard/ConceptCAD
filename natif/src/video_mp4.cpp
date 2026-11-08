#include "video_mp4.h"

#ifdef _WIN32

#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

struct VideoMp4::Impl {
  ComPtr<IMFSinkWriter> ecrivain;
  DWORD flux = 0;
  bool demarre = false, mf = false;
  LONGLONG dernier = -1;
};

VideoMp4::VideoMp4() : p_(std::make_unique<Impl>()) {}
VideoMp4::~VideoMp4() {
  fermer();
  if (p_->mf) MFShutdown();
}

bool VideoMp4::ouvrir(const wxString& chemin, int largeur, int hauteur, int ips) {
  l_ = largeur;
  h_ = hauteur;
  ips_ = ips;
  if (!p_->mf) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);  // déjà fait par l'application : sans effet
    if (FAILED(MFStartup(MF_VERSION))) return false;
    p_->mf = true;
  }
  if (FAILED(MFCreateSinkWriterFromURL(chemin.wc_str(), nullptr, nullptr, &p_->ecrivain))) return false;
  ComPtr<IMFMediaType> sortie, entree;
  if (FAILED(MFCreateMediaType(&sortie))) return false;
  sortie->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
  sortie->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_H264);
  sortie->SetUINT32(MF_MT_AVG_BITRATE, 8000000);
  sortie->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
  MFSetAttributeSize(sortie.Get(), MF_MT_FRAME_SIZE, l_, h_);
  MFSetAttributeRatio(sortie.Get(), MF_MT_FRAME_RATE, ips_, 1);
  MFSetAttributeRatio(sortie.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
  if (FAILED(p_->ecrivain->AddStream(sortie.Get(), &p_->flux))) return false;
  if (FAILED(MFCreateMediaType(&entree))) return false;
  entree->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
  entree->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
  entree->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
  MFSetAttributeSize(entree.Get(), MF_MT_FRAME_SIZE, l_, h_);
  MFSetAttributeRatio(entree.Get(), MF_MT_FRAME_RATE, ips_, 1);
  MFSetAttributeRatio(entree.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
  if (FAILED(p_->ecrivain->SetInputMediaType(p_->flux, entree.Get(), nullptr))) return false;
  if (FAILED(p_->ecrivain->BeginWriting())) return false;
  p_->demarre = true;
  p_->dernier = -1;
  return true;
}

bool VideoMp4::ajouter(const wxImage& im, double ms) {
  if (!p_->demarre || im.GetWidth() != l_ || im.GetHeight() != h_) return false;
  const LONGLONG instant = static_cast<LONGLONG>(ms * 10000);  // en unités de 100 ns
  if (instant <= p_->dernier) return true;
  const DWORD taille = static_cast<DWORD>(l_ * h_ * 4);
  ComPtr<IMFMediaBuffer> tampon;
  if (FAILED(MFCreateMemoryBuffer(taille, &tampon))) return false;
  BYTE* d = nullptr;
  if (FAILED(tampon->Lock(&d, nullptr, nullptr))) return false;
  const unsigned char* s = im.GetData();
  // Le format RGB32 se range de bas en haut
  for (int y = 0; y < h_; y++) {
    const unsigned char* q = s + (static_cast<size_t>(h_ - 1 - y) * l_) * 3;
    BYTE* o = d + static_cast<size_t>(y) * l_ * 4;
    for (int x = 0; x < l_; x++, q += 3, o += 4) {
      o[0] = q[2];
      o[1] = q[1];
      o[2] = q[0];
      o[3] = 255;
    }
  }
  tampon->Unlock();
  tampon->SetCurrentLength(taille);
  ComPtr<IMFSample> ech;
  if (FAILED(MFCreateSample(&ech))) return false;
  ech->AddBuffer(tampon.Get());
  ech->SetSampleTime(instant);
  ech->SetSampleDuration(10000000 / ips_);
  if (FAILED(p_->ecrivain->WriteSample(p_->flux, ech.Get()))) return false;
  p_->dernier = instant;
  return true;
}

bool VideoMp4::fermer() {
  if (!p_->demarre) return false;
  p_->demarre = false;
  const bool ok = p_->dernier >= 0 && SUCCEEDED(p_->ecrivain->Finalize());
  p_->ecrivain.Reset();
  return ok;
}
#else
// Mac : le film MP4 viendra plus tard (étape suivante) ; ouvrir répond « refusé »
struct VideoMp4::Impl {};
VideoMp4::VideoMp4() : p_(std::make_unique<Impl>()) {}
VideoMp4::~VideoMp4() = default;
bool VideoMp4::ouvrir(const wxString&, int, int, int) { return false; }
bool VideoMp4::ajouter(const wxImage&, double) { return false; }
bool VideoMp4::fermer() { return false; }
#endif
