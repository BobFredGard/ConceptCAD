// La matière pendant la lecture d'usinage : le moteur JavaScript taille sa grille de hauteurs,
// ce dessin n'en reçoit que les colonnes touchées et les réécrit sur place dans la carte graphique.
#pragma once

#include <AIS_InteractiveObject.hxx>
#include <Graphic3d_AspectFillArea3d.hxx>
#include <Graphic3d_AttribBuffer.hxx>
#include <Graphic3d_IndexBuffer.hxx>
#include <gp_Dir.hxx>
#include <gp_Pnt.hxx>

#include <cstdint>
#include <vector>

struct GrilleFao {
  int nx = 0, ny = 0;
  double pas = 1, ox = 0, oy = 0, oz = 0, sx1 = 0, sy1 = 0, full = 0;
  bool lisse = false;
  unsigned couleur = 0x9c846a, reflet = 0x111111;
  double brillance = 30;
};

// Une matière éclairée, comme MeshPhongMaterial dans la page
occ::handle<Graphic3d_AspectFillArea3d> aspectEclaire(unsigned couleur, unsigned reflet, double brillance);

class MatiereFao : public AIS_InteractiveObject {
 public:
  explicit MatiereFao(const GrilleFao& g);
  // Par colonne 8 nombres : indice, dessus, normale (3), direction de paroi (2), creusée
  void colonnes(const float* v, size_t n);
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override;
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}
  // faoMatterRayHit : le premier point de matière sur le rayon o + t d (repère de la grille)
  bool viser(const gp_Pnt& o, const gp_Dir& d, gp_Pnt& p) const;
  gp_Pnt centre() const { return gp_Pnt((g_.ox + g_.sx1) / 2, (g_.oy + g_.sy1) / 2, (g_.oz + g_.full) / 2); }

 private:
  float* sommet(int i) { return reinterpret_cast<float*>(sommets_->ChangeData() + static_cast<size_t>(i) * 24); }
  void poser(int i, float x, float y, float z, float nx, float ny, float nz);
  void ecrireColonne(int c);
  void construireLisse();
  void lisser(const std::vector<int>& chg);
  void marquer(int i) {
    if (i < bas_) bas_ = i;
    if (i > haut_) haut_ = i;
  }

  GrilleFao g_;
  int nc_ = 0;
  std::vector<float> dessus_, normales_, parois_;
  std::vector<uint8_t> creusee_, vues_;
  occ::handle<Graphic3d_AttribBuffer> sommets_;
  occ::handle<Graphic3d_IndexBuffer> indices_;
  int bas_ = 0x7fffffff, haut_ = -1;
  // Le lisse : les nœuds, moyennes des 4 cellules voisines, et les murs de bord
  int NX_ = 0, NY_ = 0, NV_ = 0;
  std::vector<int> n2top_;
  std::vector<uint8_t> vusN_, vusZ_;
  std::vector<float> cumul_;
};
