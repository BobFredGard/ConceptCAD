// Le flou sous les panneaux en vitre (backdrop-filter: blur du navigateur) : dans l'image même de la vue 3D,
// la zone sous le panneau est recopiée, floutée et remise en place à chaque image, juste avant l'affichage.
#pragma once
#include <AIS_InteractiveObject.hxx>

#include <memory>

struct ZoneFlou {
  bool actif = false;
  double x = 0, y = 0, l = 0, h = 0;  // en fractions de la vue, depuis le coin haut gauche
  double rayon = 0;                   // l'arrondi des coins, en fraction de la hauteur de la vue
};

class FlouVue : public AIS_InteractiveObject {
 public:
  DEFINE_STANDARD_RTTI_INLINE(FlouVue, AIS_InteractiveObject)
  FlouVue();
  std::shared_ptr<ZoneFlou> zone;
  bool AcceptDisplayMode(const int m) const override { return m == 0; }

 protected:
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override;
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}
};
