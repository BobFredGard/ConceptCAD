[ConceptCAD](../../README.md) › [Manuel](README.md) › Démarrage

# Démarrage

C'est le même logiciel partout, et les projets `.conceptcad` passent d'une version à l'autre.

## En ligne

Pour essayer, ou pour travailler avec une connexion, sur PC ou sur téléphone.

- Ouvrir [bobfredgard.github.io/ConceptCAD](https://bobfredgard.github.io/ConceptCAD/).
- Le noyau se télécharge au premier lancement (≈ 43 Mo, de préférence en Wi-Fi), puis reste en cache.

## Version autonome

Pour un PC sans Internet, ou pour garder le logiciel avec soi.

- [Télécharger `ConceptCAD-autonome.html`](https://www.dropbox.com/scl/fi/sne7f5a9y8dr659b2xrow/ConceptCAD-autonome.html?rlkey=fgd0w1r5816ake50vxtd4fnuj&dl=0) (≈ 23 Mo), puis l'ouvrir par double-clic dans Chrome ou Edge.
- Le fichier contient tout.
- Il est remplacé à chaque version : le même lien donne toujours la dernière.
- Fonctionne sous Brave et Chrome, sous Windows 11.

## Application Windows

Pour travailler sur PC avec de vraies fenêtres Ouvrir et Enregistrer, et le double-clic sur un `.conceptcad`.

- [Télécharger l'installateur](https://github.com/BobFredGard/ConceptCAD/releases/latest/download/ConceptCAD-Windows-setup.exe) (≈ 22 Mo), sans droits d'administrateur.
- Comptez environ 1 Go de RAM pièce ouverte.
- Le programme n'est pas signé : Windows peut afficher un avertissement.
- Publiée à la main, cette version peut avoir un peu de retard sur le site ([notes de version](https://github.com/BobFredGard/ConceptCAD/releases/latest)).
- **Pas encore vérifié** : Windows 10 et un PC vraiment débranché n'ont pas été essayés.
- Elle a besoin de WebView2, déjà présent sur Windows 11 ; s'il manque, l'installateur essaie de le télécharger.

## Application Mac

Pour travailler sur Mac (macOS 12 ou plus récent), avec les mêmes fenêtres et le double-clic.

- [Télécharger le DMG](https://github.com/BobFredGard/ConceptCAD/releases/latest/download/ConceptCAD-Mac.dmg) (≈ 45 Mo), l'ouvrir et glisser ConceptCAD dans Applications.
- L'application n'est pas signée par Apple : au premier lancement, Réglages Système > Confidentialité et sécurité > « Ouvrir quand même ».
- Essayée sur un Mac M4 de 16 Go, pas encore sur un Mac Intel.

## Depuis les sources

Pour les développeurs : voir [Développement](developpement.md).

**Ne pas ouvrir `ConceptCAD.html` par double-clic.** Le navigateur lui refuse le noyau de calcul : la page affiche alors un message qui renvoie vers les solutions ci-dessus, et rien d'autre. Hors ligne, prendre la version autonome.

## Noyau de calcul

Le noyau géométrique exact est **OpenCascade 8 compilé en WebAssembly** par nos soins (recette reproductible dans `occt-build/`), en deux versions :

- **multicœur**, choisie toute seule quand le navigateur et le PC le permettent, et écrite dans la barre d'état ;
- **normale**, sur un seul cœur, qui reste celle du fichier autonome.

S'il n'est pas disponible, l'application bascule seule sur un moteur maillage (CSG).

## Cartes graphiques

Le site, la version autonome et les applications Windows et Mac fonctionnent avec les cartes NVIDIA et AMD, y compris sur un PC portable à deux cartes, avec l'une ou l'autre. Sur Mac, ConceptCAD utilise la puce graphique Apple.

## Exemples

Le dossier [`Exemples/`](../../Exemples) du dépôt contient des projets à ouvrir, dont :

- **Perçages** : plaque usinée complète, avec sa planche ;
- **Crochet** ;
- **Support Pédale Déportée R1200RT 2011** ;
- **Axe** ;
- **Cavité Usinage** ;
- **Malaxeur Retard** ;
- **Engrenages**.

---

[Sommaire du manuel](README.md) · [Interface →](interface.md)
