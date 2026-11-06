// Lecture d'un projet .conceptcad (JSON, gzip possible) : même format que la version navigateur.
#pragma once
#include <array>
#include <cmath>
#include <string>
#include <unordered_map>
#include <vector>

struct Pt { double x = 0, y = 0; };
using Vec3 = std::array<double, 3>;

struct Entite {
  std::string id, t, p1, p2, pc, pa, pb;
  std::string p;  // point porté par un « cpoint »
  double r = 0;
  bool construction = false, ref = false, axe = false, poignee = false, proj = false, percage = false;
  bool ext = false;  // tenue par une source extérieure à l'esquisse (intersection, perçage...)
  std::vector<std::string> poly;  // sommets d'un polygone : ils suivent son diamètre
  // Spline : ses points de passage ou ses pôles, dans l'ordre
  std::vector<std::string> pts;
  bool closed = false;
  std::string mode;            // "ctrl" : par points de contrôle
  std::vector<double> knots;   // nœuds explicites d'un morceau exact (Ajuster, Décaler)
  int deg = 0;
  std::string handle;          // ligne de construction qui est la poignée de cette spline
  std::string projName, srcName;  // noms persistants d'une projection (« Projetée 3 », « Arête 7 »)
  std::string skSrcSk, skSrcPt, skSrcEnt;  // projection d'une autre esquisse : l'esquisse, son point ou son élément
  int skSrcM = 0;                          // courbe projetée : nombre de segments de l'échantillon
  bool pierce = false;                     // point où une arête du solide traverse le plan
  std::string isectJson;                   // Intersection : sa source, en JSON
  int isplN = 0;                           // courbe libre d'une intersection : ses n points de découpage
  bool aSrcMid = false;  // milieu 3D de l'arête source d'une projection : c'est par lui qu'on la retrouve
  Vec3 srcMid{0, 0, 0};
  bool suiviInconnu = false;  // projection qui suit autre chose qu'une arête retrouvée par position (nom, intersection, autre esquisse)
};

// Contrainte et cote d'esquisse : mêmes champs que le fichier (src/50-esquisse-2, 50-esquisse-4).
struct Contrainte {
  std::string id, type, p, line, ent, a, b, mid, c, d;
  std::string s;  // tangence ou courbure de spline : la spline
  bool inf = false;
  bool inner = false;  // tangent2 : un cercle dans l'autre
  int sa = 0, sb = 0;
};
struct Cote {
  std::string id, type, line, ent, a, b, p, orient, nom;
  std::string expr, exprErr;  // formule et son erreur (src/51-parametres)
  std::string oa, ob;  // cote d'angle en pose : les deux lignes d'origine (skDimAngleAt)
  double value = 0, ox = 0, oy = 0, w = 0, sl = 0;
  bool aW = false, ref = false, dia = false, formule = false, formuleFausse = false, comp = false;
  bool chk = false;  // déjà contrôlée (skCheckNewDims)
  int refV = 0;      // 2 : référence posée automatiquement
  int ccw = -1;  // -1 : absent du fichier
  int sgn = 0;   // côté mémorisé d'un entraxe, 0 : absent
};

struct Hote {
  bool existe = false;
  std::string feat, tag = "TOP", edge;
  double x = 0, y = 0, h = 0;
  bool aH = false;
  std::string nom;  // nom de la face, écrit seulement quand l'esquisse est créée ici
};

struct Esquisse {
  std::string plan_cg;  // id de l'élément de construction qui porte l'esquisse
  std::string id, nom, plan;
  std::string at;  // esquisse créée ici : la fonction après laquelle elle se place (cgAtNow), vide si aucune
  int seq = 1;  // prochain numéro d'identifiant
  Vec3 o{0, 0, 0}, u{1, 0, 0}, v{0, 1, 0}, n{0, 0, 1};
  bool visible = true;
  std::vector<std::string> ordre;  // ordre d'enregistrement des points : il décide des fusions de noeuds
  std::unordered_map<std::string, Pt> points;
  std::vector<Entite> entites;
  std::vector<Contrainte> contraintes;
  std::vector<Cote> cotes;
  Hote hote;
  const Pt* point(const std::string& id) const {
    auto it = points.find(id);
    return it == points.end() ? nullptr : &it->second;
  }
  const Entite* entite(const std::string& id) const {
    for (const Entite& e : entites)
      if (e.id == id) return &e;
    return nullptr;
  }
};

// Les nombres et la structure d'une esquisse : ce que le logiciel sait changer et enregistrer
bool memesValeurs(const Esquisse& a, const Esquisse& b);
// La structure seule : éléments, identifiants, liens entre eux ; pas les coordonnées, rayons et valeurs de cotes
bool memesLiens(const Esquisse& a, const Esquisse& b);

// L'ancre d'une arête de congé dans une esquisse : point ou entité, à un niveau (xAnchorFor, src/20-60)
struct AncreArete {
  bool existe = false, aZ = false, aSide = false, loin = false;
  std::string t, sk, id;
  double z = 0, dist = 0;
  int side = 0;
};
// Une arête retenue par un congé ou un chanfrein exact
struct AreteConge {
  Vec3 pos{0, 0, 0}, pos0{0, 0, 0};
  bool aPos0 = false, seed = false;
  double r = 0, len = 0;
  AncreArete ancre;
  std::string nomAffiche;  // name : « Arête 6 »
  std::string nom;  // nom unique de l'arête, par les faces qu'elle sépare
};

// Une étape de « Déplacer le corps » (bmove) : translation, direction, rotation, point à point
struct EtapeDeplacement {
  std::string k;
  Vec3 v{0, 0, 0}, o{0, 0, 0}, d{0, 0, 0}, a{0, 0, 0}, b{0, 0, 0};
  double dist = 0, deg = 0;
};
// Une face retenue par une fonction : sa boîte, sa normale et son ancre d'esquisse
struct RefFace {  // le nom se retient au premier passage, même sur une référence constante (nomsRefNote)
  Vec3 pos{0, 0, 0}, dim{0, 0, 0}, n{0, 0, 0};
  bool lue = false, aNormale = false;
  std::string st;   // type de surface
  mutable std::string nom;  // nom unique, retenu au premier passage (nomsRefNote)
  AncreArete ancre;
};
// Réglages d'un perçage tels que dans le fichier (NaN : absent)
struct ReglagePercage {
  std::string kind, end, pilot;
  double d = NAN, stD = NAN, stH = NAN, stTip = NAN, cbD = NAN, cbH = NAN, csD = NAN, csA = NAN, depth = NAN, tip = NAN, reamD = NAN, reamH = NAN, reamOff = NAN;
  bool aPlan = false;
  Vec3 planP{}, planN{};
};

struct Fonction {
  std::string id, type, nom, esquisse, corps, op = "add";
  std::vector<std::string> corpsEnPlus;  // f.cutBodies : découpe rejouée aussi dans ces corps
  std::string repeatId;      // copie faite par cette répétition
  bool repetee = false;      // copie ou source d'une répétition : la changer n'est pas encore repris
  ReglagePercage percage;
  // Révolution : axe {k:'line',id} ou {k:'sys',d}
  std::string axeK, axeId, axeD;
  double angle = 360;
  // Dépouille (xdraft) et extrusion dépouillée ou jusqu'à un objet
  RefFace refFace;
  std::vector<RefFace> facesVisees;
  double angleDepouille = 0, draft = 0;
  double dist = 0;       // xmove
  bool facesTangentes = false;  // xmove
  std::string chemin;    // sweep : esquisse du chemin
  std::vector<std::string> outils;  // combine : corps outils
  std::string modeFonction;  // combine : cut, intersect ; xsplit : body, face
  bool garder = false;       // combine : garde les outils
  std::string corpsNeuf;     // xsplit, bscale : le corps qui naît
  std::string planSrc, planCg;  // xsplit
  Vec3 planO{0, 0, 0}, planN{0, 0, 1};
  bool aPlanON = false;
  double decalage = 0;
  std::vector<EtapeDeplacement> etapes;  // bmove
  Vec3 centre{0, 0, 0};                  // bscale
  double echelle = 1, echelleX = 1, echelleY = 1, echelleZ = 1;
  bool echelleUni = true, copie = false;
  bool upto = false;
  double distance = 10;
  bool aDistance = false, visible = true, mid = false, flip = false, through = false;
  // Congé ou chanfrein exact (xfillet)
  std::vector<AreteConge> aretes;
  bool chamfer = false;
  int tangent = -1;  // -1 : absent du fichier, 0 : case décochée, 1 : chaîne tangente suivie
  // État du dernier calcul, jamais écrit dans le fichier
  std::string congeErreur, congeAjuste;
  int congeTrouvees = 0, congeTotal = 0;
};
// Ce que le logiciel sait changer et enregistrer dans une fonction
inline bool memesReglages(const Fonction& a, const Fonction& b) {
  return a.id == b.id && a.distance == b.distance && a.op == b.op && a.nom == b.nom && a.mid == b.mid && a.flip == b.flip && a.through == b.through;
}

// doc.params : un paramètre libre, un nom et une expression
struct Parametre {
  std::string nom, expr, err;
  double value = 0;
  bool aValeur = false, exprNombre = false;  // exprNombre : le fichier avait un nombre à la place du texte
  bool operator==(const Parametre& o) const { return nom == o.nom && expr == o.expr && err == o.err && value == o.value && aValeur == o.aValeur; }
};
// doc.derive : un paramètre venu d'un autre fichier, en lecture seule
struct ParamDerive {
  std::string nom, lien;
  double value = 0;
  bool absent = false;
};
// Une valeur de fonction 3D nommée ou en formule (parHolders) : h.expr[clé], h.pname[clé]
struct PorteurFx {
  std::string fonction, origine, cle, nom, expr, err;
  int arete = -1;       // rang de l'arête d'un congé, -1 pour la fonction elle-même
  bool pris = false;    // ce programme sait changer cette valeur : la profondeur d'une extrusion
  bool change = false;  // parResolve vient de la changer
  double valeur = 0;
};

// Élément de construction : ce programme ne le recalcule pas encore, il garde sa position
struct ElementConstruction {
  std::string id;
  bool surPiece = false;                // une référence vise une face, une arête, un sommet ou une esquisse
  std::vector<std::string> surElements;  // autres éléments de construction visés
  bool aRepere = false;
  Vec3 o{0, 0, 0}, z{0, 0, 1};  // sa dernière position
};
struct Document {
  std::vector<ElementConstruction> construction;
  // Le plan de cette esquisse suit-il la pièce ? (il ne se recalcule pas encore ici)
  bool planSuitLaPiece(const std::string& id, int garde = 0) const;
  bool unPlanSuitLaPiece() const;
  std::string nom;
  std::vector<std::string> corps;
  std::vector<std::string> nomsCorps;  // même rang que corps
  std::vector<unsigned> couleursCorps;  // même rang que corps ; 0 = pas de couleur dans la fiche
  unsigned teinte = 0;  // teinte de la pièce (doc.tint), pour les corps sans couleur
  std::vector<Esquisse> esquisses;
  std::vector<Esquisse> esquissesFichier;  // telles qu'écrites dans le fichier : ce qui en diffère reste à enregistrer
  std::vector<Fonction> fonctions;
  std::vector<Fonction> fonctionsFichier;  // telles qu'écrites dans le fichier
  std::vector<Parametre> params, paramsFichier;
  std::vector<ParamDerive> derives;
  std::vector<PorteurFx> porteurs, porteursFichier;
  std::vector<size_t> parEnAttente;  // parPending : les esquisses dont une cote a changé, à résoudre
  std::string corpsActif;  // où naît une nouvelle fonction
  std::vector<std::string> nonPrisEnCharge;  // vide = la pièce se rejoue entièrement
  std::vector<std::string> sourcesRepetees;  // les fonctions que copie une répétition
  std::wstring chemin;
  std::string octets;  // le fichier tel qu'il est sur le disque : l'enregistrement en repart
  bool compresse = false;
  int nomsFace = 0;  // entNames.face : compteur des noms « Face n », jamais réemployés
  int nomsArete = 0;  // entNames.edge : de même pour « Arête n »
  int nomsProj = 0;   // entNames.proj : de même pour « Projetée n »
  int nomsIsect = 0;  // entNames.isect : de même pour « Intersection n »
  int nomsAreteLu = 0, nomsProjLu = 0, nomsIsectLu = 0;  // tels que lus dans le fichier
  bool modifie() const {
    if (esquisses.size() != esquissesFichier.size() || fonctions.size() != fonctionsFichier.size()) return true;
    if (!(params == paramsFichier) || porteursChanges()) return true;
    for (size_t i = 0; i < fonctions.size(); i++)
      if (!memesReglages(fonctions[i], fonctionsFichier[i])) return true;
    for (size_t i = 0; i < esquisses.size(); i++)
      if (!memesValeurs(esquisses[i], esquissesFichier[i])) return true;
    return false;
  }
  bool porteursChanges() const {
    if (porteurs.size() != porteursFichier.size()) return true;
    for (size_t i = 0; i < porteurs.size(); i++)
      if (porteurs[i].nom != porteursFichier[i].nom || porteurs[i].expr != porteursFichier[i].expr) return true;
    return false;
  }
  Esquisse* esquisse(const std::string& id);
  const Fonction* fonction(const std::string& id) const;
  // Changer cette profondeur laisse-t-il les autres esquisses justes sans le solveur ? Une esquisse liée au solide
  // (projection, face d'appui) dans un plan non parallèle suit les arêtes qui bougent : le navigateur la recalcule, pas ce programme.
  bool profondeurModifiable(size_t i) const;
};

// Lève std::runtime_error si le fichier est illisible.
Document lireProjet(const std::wstring& chemin);
std::string lireOctets(const std::wstring& chemin);
std::string degonfler(const std::string& gz);
