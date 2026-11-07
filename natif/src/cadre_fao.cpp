// L'atelier FAO : le programme montre et transmet, le moteur JavaScript validé décide et calcule.
#include <wx/file.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/dcmemory.h>
#include <wx/msgdlg.h>
#include <wx/stdpaths.h>

#include <windows.h>

#include <cstdio>
#include <fstream>
#include <functional>

#include "cadre.h"
#include "enregistrer.h"
#include "fao_moteur.h"
#include "fao_vue.h"

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::wstring tempFao(const wchar_t* nom) {
  return (wxStandardPaths::Get().GetTempDir() + L"\\conceptcad-fao-" + wxString::Format("%lu", GetCurrentProcessId()) + nom).ToStdWstring();
}
std::string utf8(const std::wstring& s) { return wxString(s).ToStdString(wxConvUTF8); }
}  // namespace

// Le texte que le moteur doit voir : la pièce telle qu'elle est maintenant, pas celle du disque
std::string Cadre::faoTexteCourant() {
  const std::string base = !doc_.texteBase.empty() ? doc_.texteBase.str() : texteDuFichier(doc_);
  if (base.empty()) return base;
  try {
    return doc_.modifie() ? texteEnregistre(doc_, base) : base;
  } catch (const std::exception&) {
    return base;
  }
}

void Cadre::faoEntrer() {
  if (!moteurFao_) {
    moteurFao_ = std::make_unique<MoteurFao>();
    moteurFao_->surEvenement = [this](const plan::J& e) { faoEvenement(e); };
  }
  std::string texte = faoTexteCourant();
  if (texte.empty()) return faoMessage(L"FAO : ouvrez d'abord une pièce.");
  if (faoOuvert_ && texte == faoTexteOuvert_) {
    faoRafraichir();
    return;
  }
  faoMessage(L"FAO : démarrage du moteur d'usinage…");
  faoEnCours_++;
  moteurFao_->demarrer([this, texte = std::move(texte)](bool ok, const std::string& err) mutable {
    if (!ok) {
      faoEnCours_--;
      faoMessage(tx(err));
      return;
    }
    const std::wstring f = tempFao(L".conceptcad");
    std::ofstream(f, std::ios::binary) << texte;
    faoMessage(L"FAO : lecture de la pièce…");
    faoTexteOuvert_ = std::move(texte);
    moteurFao_->commande("ouvrir", {{"fichier", utf8(f)}}, [this, f](bool ok2, const plan::J&, const std::string& err2) {
      faoEnCours_--;
      _wremove(f.c_str());
      if (!ok2) {
        faoMessage(L"FAO : lecture impossible. " + tx(err2).BeforeFirst('\n'));
        return;
      }
      faoOuvert_ = true;
      faoSale_ = false;
      faoSigTraces_.clear();
      faoRafraichir();
    });
  });
}

void Cadre::faoMessage(const wxString& m) {
  if (m.empty()) return;
  etat(m);
}

void Cadre::faoRafraichir() {
  faoEnCours_++;
  moteurFao_->commande("vue", plan::J::object(), [this](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    faoAppliquer(r);
  });
}

void Cadre::faoAppliquer(const plan::J& r) {
  arbreFao_->montrer(r.value("arbre", plan::J()));
  ficheFao_->montrer(r.value("fiche", plan::J()));
  faoFenetreOutils(r.contains("outils") ? r["outils"] : plan::J());
  if (r.contains("message")) faoMessage(tx(r["message"].get<std::string>()));
  const std::string sig = r.value("sig", std::string());
  if (sig != faoSigTraces_ && atelier_ == Atelier::FAO) {
    faoSigTraces_ = sig;
    faoTraces(r.value("rap", std::string("tous")));
  }
  if (atelier_ == Atelier::FAO) faoScene();
  carteDroite_->Layout();
}

void Cadre::faoToucher(long el, const std::string& sorte, const plan::J& valeur, bool ctrl, bool maj) {
  faoEnCours_++;
  plan::J a = {{"el", el}, {"sorte", sorte}, {"ctrl", ctrl}, {"maj", maj}};
  if (!valeur.is_null()) a["valeur"] = valeur;
  faoSale_ = true;
  moteurFao_->commande("toucher", a, [this](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    faoAppliquer(r);
  });
}

void Cadre::faoAction(const std::string& nom, const std::string& type) {
  if (!faoOuvert_) return faoMessage(L"FAO : le moteur d'usinage lit encore la pièce.");
  faoEnCours_++;
  faoSale_ = true;
  plan::J a = {{"nom", nom}};
  if (!type.empty()) a["type"] = type;
  moteurFao_->commande("action", a, [this](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    faoAppliquer(r);
  });
}

// La page a produit quelque chose pendant son calcul
void Cadre::faoEvenement(const plan::J& e) {
  const std::string k = e.value("evt", std::string());
  if (k == "message") return faoMessage(tx(e.value("texte", std::string())));
  if (k == "alerte") return faoMessage(tx(e.value("texte", std::string())));
  if (k == "indisponible") return indisponible(tx(e.value("texte", std::string())));
  if (k == "telecharger") {
    const wxString nom = tx(e.value("nom", std::string()));
    const std::string texte = e.value("texte", std::string());
    if (!faoSortieEssai_.empty()) {
      std::ofstream(faoSortieEssai_, std::ios::binary) << texte;
      return;
    }
    wxFileDialog d(this, L"Enregistrer le programme", wxEmptyString, nom, L"Tous les fichiers (*.*)|*.*", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
    if (d.ShowModal() != wxID_OK) return;
    std::ofstream(d.GetPath().ToStdWstring(), std::ios::binary) << texte;
    etat(L"Enregistré dans " + d.GetPath() + L".");
  }
}

void Cadre::faoFenetreOutils(const plan::J& d) {
  if (d.is_null()) {
    if (fenetreOutilsFao_) fenetreOutilsFao_->Hide();
    return;
  }
  if (!fenetreOutilsFao_) {
    fenetreOutilsFao_ = new wxFrame(this, wxID_ANY, L"Bibliothèque d'outils", wxDefaultPosition, FromDIP(wxSize(640, 620)), wxDEFAULT_FRAME_STYLE | wxFRAME_FLOAT_ON_PARENT);
    outilsFao_ = new VueDom(fenetreOutilsFao_, wxColour(0x24, 0x26, 0x2b));
    outilsFao_->surToucher = [this](long el, const std::string& s, const plan::J& v, bool c, bool m) { faoToucher(el, s, v, c, m); };
    fenetreOutilsFao_->Bind(wxEVT_CLOSE_WINDOW, [this](wxCloseEvent&) { faoAction("outils", ""); });
  }
  outilsFao_->montrer(d);
  fenetreOutilsFao_->Show();
}

// Les traces du posage courant, en nombres bruts dans un fichier
void Cadre::faoTraces(const std::string& rapides) {
  const std::wstring f = tempFao(L".traces");
  faoEnCours_++;
  moteurFao_->commande("tracesFichier", {{"fichier", utf8(f)}}, [this, f, rapides](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    std::vector<float> tout;
    {
      std::ifstream in(f, std::ios::binary | std::ios::ate);
      const std::streamoff n = in.tellg();
      if (n > 0) {
        tout.resize(static_cast<size_t>(n) / sizeof(float));
        in.seekg(0);
        in.read(reinterpret_cast<char*>(tout.data()), n);
      }
    }
    _wremove(f.c_str());
    Vue3D::DessinFao D;
    D.fondu = rapides == "fondu";
    D.masque = rapides == "masque";
    size_t pos = 0;
    int masquees = 0, absentes = 0;
    for (const auto& o : r["ops"]) {
      if (o.value("absent", false)) {
        absentes++;
        continue;
      }
      const bool cache = o.value("hidden", false);
      if (cache) masquees++;
      const struct {
        const char* k;
        std::vector<float>* v;
      } C[] = {{"cut", &D.coupe}, {"rap", &D.rapides}, {"ret", &D.remontees}, {"plg", &D.plongees}};
      for (const auto& c : C) {
        const size_t n = o.value(c.k, 0);
        if (!cache && pos + n <= tout.size()) c.v->insert(c.v->end(), tout.begin() + pos, tout.begin() + pos + n);
        pos += n;
      }
    }
    const auto& F = r["frame"];
    const auto lire = [](const plan::J& p, double q[3]) {
      if (p.is_array()) for (int i = 0; i < 3; i++) q[i] = p[i].get<double>();
      else if (p.is_object()) {
        q[0] = p.value("x", 0.0);
        q[1] = p.value("y", 0.0);
        q[2] = p.value("z", 0.0);
      }
    };
    lire(F["X"], D.x);
    lire(F["Y"], D.y);
    lire(F["Z"], D.z);
    lire(F["O"], D.o);
    vue_->montrerFao(D);
    faoAbsentes_ = absentes;
    faoMasquees_ = masquees;
  });
}

bool Cadre::faoClic(const Vue3D::ClicFao& c) {
  if (atelier_ != Atelier::FAO || !moteurFao_ || !faoOuvert_) return false;
  plan::J a = {{"x", c.x}, {"y", c.y}, {"w", c.w}, {"h", c.h}, {"bouton", c.bouton}, {"ctrl", c.ctrl}, {"maj", c.maj}, {"persp", c.persp}, {"near", c.pres}, {"far", c.loin}};
  plan::J p = plan::J::array(), v = plan::J::array();
  for (int i = 0; i < 16; i++) {
    p.push_back(c.proj[i]);
    v.push_back(c.vue[i]);
  }
  a["proj"] = p;
  a["vue"] = v;
  faoEnCours_++;
  faoSale_ = true;
  moteurFao_->commande("souris", a, [this](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    faoAppliquer(r);
  });
  return true;
}

void Cadre::faoTouche(const std::string& cle, bool ctrl, bool maj) {
  if (!moteurFao_ || !faoOuvert_) return;
  faoEnCours_++;
  faoSale_ = true;
  moteurFao_->commande("touche", {{"key", cle}, {"ctrl", ctrl}, {"maj", maj}}, [this](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    faoAppliquer(r);
  });
}

// Le brut, les repères, les cubes : ce que la page a posé dans sa scène
void Cadre::faoScene() {
  const std::wstring f = tempFao(L".scene");
  faoEnCours_++;
  moteurFao_->commande("sceneFichier", {{"fichier", utf8(f)}}, [this, f](bool ok, const plan::J& r, const std::string& err) {
    faoEnCours_--;
    if (!ok) return faoMessage(tx(err).BeforeFirst('\n'));
    std::ifstream in(f, std::ios::binary);
    std::vector<Vue3D::ObjetFao> L;
    for (const auto& o : r["objets"]) {
      Vue3D::ObjetFao x;
      x.sorte = o.value("k", std::string("S"))[0];
      x.couleur = o.value("c", 0xffffffu);
      x.alpha = o.value("al", 1.0);
      x.taille = o.value("pl", 0.0);
      x.profondeur = o.value("dep", true);
      x.a.resize(o.value("n", 0));
      if (!x.a.empty()) in.read(reinterpret_cast<char*>(x.a.data()), x.a.size() * sizeof(float));
      L.push_back(std::move(x));
    }
    in.close();
    _wremove(f.c_str());
    if (atelier_ == Atelier::FAO) vue_->montrerSceneFao(L);
  });
}

void Cadre::faoQuitterVue() {
  if (vue_) {
    vue_->montrerFao(Vue3D::DessinFao{});
    vue_->montrerSceneFao({});
  }
  faoSigTraces_.clear();
  if (fenetreOutilsFao_) fenetreOutilsFao_->Hide();
}

// Le programme écrit le fichier : l'usinage et les parcours viennent du moteur. Ici on attend sa réponse.
void Cadre::faoFaireSuivre() {
  if (!moteurFao_ || !faoOuvert_ || !faoSale_) return;
  bool fini = false;
  const std::wstring f = tempFao(L".etat");
  moteurFao_->commande("etat", {{"fichier", utf8(f)}}, [&fini](bool, const plan::J&, const std::string&) { fini = true; });
  while (!fini && moteurFao_->enMarche()) wxYield();
  try {
    std::ifstream in(f, std::ios::binary);
    if (in) {
      const auto e = nlohmann::ordered_json::parse(in);
      poserFao(doc_, e["fao"], e["moves"]);
      faoTexteOuvert_ = faoTexteCourant();
      faoSale_ = false;
    }
  } catch (const std::exception& ex) {
    faoMessage(tx(ex.what()));
  }
  _wremove(f.c_str());
}

// Les étapes d'essai : {"fao":{"clic":"12. Ébauche"}}, {"champ":"Nom","valeur":"X"}, {"action":"regenerer"}…
void Cadre::faoEssai(const plan::J& e) {
  const auto attendre = [this] {
    while ((faoEnCours_ > 0 || (moteurFao_ && moteurFao_->occupe())) && (moteurFao_ && moteurFao_->enMarche())) {
      wxYield();
      Sleep(5);
    }
    wxYield();
  };
  attendre();
  if (e.contains("clic")) {
    if (!arbreFao_->essaiCliquer(e["clic"].get<std::string>(), e.value("rang", 0))) ficheFao_->essaiCliquer(e["clic"].get<std::string>(), e.value("rang", 0));
  }
  if (e.contains("champ")) ficheFao_->essaiChamp(e["champ"].get<std::string>(), e["valeur"]);
  if (e.contains("touche")) faoTouche(e["touche"].get<std::string>(), e.value("ctrl", false), e.value("maj", false));
  if (e.contains("action")) faoAction(e["action"].get<std::string>(), e.value("type", std::string()));
  if (e.contains("sortie")) faoSortieEssai_ = wxString::FromUTF8(e["sortie"].get<std::string>()).ToStdWstring();
  attendre();
  // Deux tours : les traces partent d'une réponse
  attendre();
  if (e.contains("relevé")) std::ofstream(wxString::FromUTF8(e["relevé"].get<std::string>()).ToStdWstring()) << plan::J({{"arbre", arbreFao_->racine()}, {"fiche", ficheFao_->racine()}}).dump(1, ' ', false, plan::J::error_handler_t::replace);
  if (e.contains("imageOutils") && fenetreOutilsFao_) {
    const wxSize t = fenetreOutilsFao_->GetSize();
    wxBitmap image(t.x, t.y, 32);
    {
      wxMemoryDC dc(image);
      PrintWindow(fenetreOutilsFao_->GetHWND(), static_cast<HDC>(dc.GetHDC()), 2);
    }
    image.ConvertToImage().SaveFile(wxString::FromUTF8(e["imageOutils"].get<std::string>()), wxBITMAP_TYPE_PNG);
  }
  if (e.contains("image3d")) vue_->image(wxString::FromUTF8(e["image3d"].get<std::string>()));
}
