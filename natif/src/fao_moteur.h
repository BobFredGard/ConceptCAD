// Le moteur FAO : le JavaScript validé du navigateur, dans un processus Node lancé seulement quand
// l'atelier FAO en a besoin (fao/moteur.cjs). On lui parle par lignes JSON, sans jamais bloquer la fenêtre.
#pragma once
#include <wx/string.h>

#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include "plan.h"

class MoteurFao {
 public:
  using Reponse = std::function<void(bool ok, const plan::J& r, const std::string& erreur)>;
  ~MoteurFao();
  // Lance le moteur s'il ne tourne pas ; prêt est appelé quand il répond, ou avec l'erreur
  void demarrer(const std::function<void(bool, const std::string&)>& pret);
  bool enMarche() const { return enMarche_; }
  bool pret() const { return pret_; }
  // Une commande : la réponse arrive plus tard, dans la fenêtre. Une à la fois, dans l'ordre.
  void commande(const std::string& nom, plan::J args, const Reponse& r);
  // Le temps d'attente des essais : traite ce qui est arrivé
  bool occupe() const { return !attente_.empty(); }
  std::function<void(const plan::J&)> surEvenement;

 private:
  void lire();
  void recu(const std::string& ligne);
  void arreter();
  void* proc_ = nullptr;
  void* entree_ = nullptr;
  void* sortie_ = nullptr;
  std::thread lecteur_;
  bool enMarche_ = false, pret_ = false;
  long suivant_ = 0;
  std::map<long, Reponse> attente_;
  std::function<void(bool, const std::string&)> surPret_;
  std::shared_ptr<bool> vivant_ = std::make_shared<bool>(true);
};
