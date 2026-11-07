// Les tolérances ISO 286 (src/05-iso286.js) : écarts d'une classe pour un Ø nominal.
#include "iso286.h"

#include <nlohmann/json.hpp>

#include <algorithm>
#include <cctype>
#include <cmath>

#include "nombres_js.h"

namespace {
using json = nlohmann::json;
const char* const TABLES =
    R"~~({"main":[3,6,10,18,30,50,80,120,180,250,315,400,500],"sub":[3,6,10,14,18,24,30,40,50,65,80,100,120,140,160,180,200,225,250,280,315,355,400,450,500],"it":{"0":[0.5,0.6,0.6,0.8,1,1,1.2,1.5,2,3,4,5,6],"1":[0.8,1,1,1.2,1.5,1.5,2,2.5,3.5,4.5,6,7,8],"2":[1.2,1.5,1.5,2,2.5,2.5,3,4,5,7,8,9,10],"3":[2,2.5,2.5,3,4,4,5,6,8,10,12,13,15],"4":[3,4,4,5,6,7,8,10,12,14,16,18,20],"5":[4,5,6,8,9,11,13,15,18,20,23,25,27],"6":[6,8,9,11,13,16,19,22,25,29,32,36,40],"7":[10,12,15,18,21,25,30,35,40,46,52,57,63],"8":[14,18,22,27,33,39,46,54,63,72,81,89,97],"9":[25,30,36,43,52,62,74,87,100,115,130,140,155],"10":[40,48,58,70,84,100,120,140,160,185,210,230,250],"11":[60,75,90,110,130,160,190,220,250,290,320,360,400],"12":[100,120,150,180,210,250,300,350,400,460,520,570,630],"13":[140,180,220,270,330,390,460,540,630,720,810,890,970],"14":[250,300,360,430,520,620,740,870,1000,1150,1300,1400,1550],"15":[400,480,580,700,840,1000,1200,1400,1600,1850,2100,2300,2500],"16":[600,750,900,1100,1300,1600,1900,2200,2500,2900,3200,3600,4000],"17":[1000,1200,1500,1800,2100,2500,3000,3500,4000,4600,5200,5700,6300],"18":[1400,1800,2200,2700,3300,3900,4600,5400,6300,7200,8100,8900,9700],"01":[0.3,0.4,0.4,0.5,0.6,0.6,0.8,1,1.2,2,2.5,3,4]},"shaft":{"a":[-270,-270,-280,-290,-290,-300,-300,-310,-320,-340,-360,-380,-410,-460,-520,-580,-660,-740,-820,-920,-1050,-1200,-1350,-1500,-1650],"b":[-140,-140,-150,-150,-150,-160,-160,-170,-180,-190,-200,-220,-240,-260,-280,-310,-340,-380,-420,-480,-540,-600,-680,-760,-840],"c":[-60,-70,-80,-95,-95,-110,-110,-120,-130,-140,-150,-170,-180,-200,-210,-230,-240,-260,-280,-300,-330,-360,-400,-440,-480],"cd":[-34,-46,-56,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],"d":[-20,-30,-40,-50,-50,-65,-65,-80,-80,-100,-100,-120,-120,-145,-145,-145,-170,-170,-170,-190,-190,-210,-210,-230,-230],"e":[-14,-20,-25,-32,-32,-40,-40,-50,-50,-60,-60,-72,-72,-85,-85,-85,-100,-100,-100,-110,-110,-125,-125,-135,-135],"ef":[-10,-14,-18,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],"f":[-6,-10,-13,-16,-16,-20,-20,-25,-25,-30,-30,-36,-36,-43,-43,-43,-50,-50,-50,-56,-56,-62,-62,-68,-68],"fg":[-4,-6,-8,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],"g":[-2,-4,-5,-6,-6,-7,-7,-9,-9,-10,-10,-12,-12,-14,-14,-14,-15,-15,-15,-17,-17,-18,-18,-20,-20],"h":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"k":[0,1,1,1,1,2,2,2,2,2,2,3,3,3,3,3,4,4,4,4,4,4,4,5,5],"m":[2,4,6,7,7,8,8,9,9,11,11,13,13,15,15,15,17,17,17,20,20,21,21,23,23],"n":[4,8,10,12,12,15,15,17,17,20,20,23,23,27,27,27,31,31,31,34,34,37,37,40,40],"p":[6,12,15,18,18,22,22,26,26,32,32,37,37,43,43,43,50,50,50,56,56,62,62,68,68],"r":[10,15,19,23,23,28,28,34,34,41,43,51,54,63,65,68,77,80,84,94,98,108,114,126,132],"s":[14,19,23,28,28,35,35,43,43,53,59,71,79,92,100,108,122,130,140,158,170,190,208,232,252],"t":[null,null,null,null,null,null,41,48,54,)~~"
    R"~~(66,75,91,104,122,134,146,166,180,196,218,240,268,294,330,360],"u":[18,23,28,33,33,41,48,60,70,87,102,124,144,170,190,210,236,258,284,315,350,390,435,490,540],"v":[null,null,null,null,39,47,55,68,81,102,120,146,172,202,228,252,284,310,340,385,425,475,530,595,660],"x":[20,28,34,40,45,54,64,80,97,122,146,178,210,248,280,310,350,385,425,475,525,590,660,740,820],"y":[null,null,null,null,null,63,75,94,114,144,174,214,254,300,340,380,425,470,520,580,650,730,820,920,1000],"z":[26,35,42,50,60,73,88,112,136,172,210,258,310,365,415,465,520,575,640,710,790,900,1000,1100,1250],"za":[32,42,52,64,77,98,118,148,180,226,274,335,400,470,535,600,670,740,820,920,1000,1150,1300,1450,1600],"zb":[40,50,67,90,108,136,160,200,242,300,360,445,525,620,700,780,880,960,1050,1200,1300,1500,1650,1850,2100],"zc":[60,80,97,130,150,188,218,274,325,405,480,585,690,800,900,1000,1150,1250,1350,1550,1700,1900,2100,2400,2600]},"j":{"j5":[-2,-2,-2,-3,-4,-5,-7,-9,-11,-13,-16,-18,-20],"j6":[-2,-2,-2,-3,-4,-5,-7,-9,-11,-13,-16,-18,-20],"j7":[-4,-4,-5,-6,-8,-10,-12,-15,-18,-21,-26,-28,-32],"J6":[2,5,5,6,8,10,13,16,18,22,25,29,33],"J7":[4,6,8,10,12,14,18,22,26,30,36,39,43],"J8":[6,10,12,15,20,24,28,34,41,47,55,60,66]},"delta":{"3":[0,1,1,1,1.5,1.5,2,2,3,3,4,4,5],"4":[0,1.5,1.5,2,2,3,3,4,4,4,4,5,5],"5":[0,1,2,3,3,4,5,5,6,6,7,7,7],"6":[0,3,3,3,4,5,6,7,7,9,9,11,13],"7":[0,4,6,7,8,9,11,13,15,17,20,21,23],"8":[0,6,7,9,12,14,16,19,23,26,29,32,34]},"hole":["A","B","C","CD","D","E","EF","F","FG","G","H","JS","J","K","M","N","P","R","S","T","U","V","X","Y","Z","ZA","ZB","ZC"],"upper":["a","b","c","cd","d","e","ef","f","fg","g"]})~~";
const json& tables() {
  static const json T = json::parse(TABLES);
  return T;
}
int rang(const json& bornes, double d) {
  for (size_t i = 0; i < bornes.size(); i++)
    if (d <= bornes[i].get<double>() + 1e-9) return static_cast<int>(i);
  return -1;
}
std::string minuscule(std::string s) {
  for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return s;
}
std::string majuscule(std::string s) {
  for (char& c : s) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
  return s;
}
}  // namespace

std::optional<EcartsIso> ecartsIso286(const std::string& classeBrute, double nominal) {  // iso286Range
  std::string cls = classeBrute;
  while (!cls.empty() && std::isspace(static_cast<unsigned char>(cls.back()))) cls.pop_back();
  size_t deb = 0;
  while (deb < cls.size() && std::isspace(static_cast<unsigned char>(cls[deb]))) deb++;
  cls = cls.substr(deb);
  size_t n = 0;
  while (n < cls.size() && std::isalpha(static_cast<unsigned char>(cls[n]))) n++;
  if (n < 1 || n > 2 || n == cls.size()) return std::nullopt;
  const std::string L = cls.substr(0, n), g = cls.substr(n);
  if (!(g == "01" || g == "0" || (g.size() == 1 && g[0] >= '1' && g[0] <= '9') || (g.size() == 2 && g[0] == '1' && g[1] >= '0' && g[1] <= '8'))) return std::nullopt;
  const std::string up = majuscule(L), l = minuscule(L);
  if (L != up && L != l) return std::nullopt;
  const json& T = tables();
  if (std::find(T["hole"].begin(), T["hole"].end(), up) == T["hole"].end()) return std::nullopt;
  const bool trou = L == up;
  const double d = std::abs(nominal);
  if (!(d > 0) || d > 500) return std::nullopt;
  const int im = rang(T["main"], d), is = rang(T["sub"], d);
  if (im < 0 || !T["it"].contains(g)) return std::nullopt;
  const double IT = T["it"][g][im].get<double>();
  const int gN = std::stoi(g);
  double lo = 0, hi = 0;
  const auto mm = [&]() {
    EcartsIso r;
    r.lo = js::arrondi(lo / 1000, 4);
    r.hi = js::arrondi(hi / 1000, 4);
    return r;
  };
  if (l == "h") {
    lo = trou ? 0 : -IT, hi = trou ? IT : 0;
    return mm();
  }
  if (l == "js") {
    lo = -IT / 2, hi = IT / 2;
    return mm();
  }
  if (l == "j") {
    const std::string k = L + g;
    if (!T["j"].contains(k)) return std::nullopt;
    const double t = T["j"][k][im].get<double>();
    if (trou) lo = t - IT, hi = t;
    else lo = t, hi = t + IT;
    return mm();
  }
  if (!T["shaft"].contains(l) || T["shaft"][l][is].is_null()) return std::nullopt;
  const double sv = T["shaft"][l][is].get<double>();
  double ei = sv;
  if (l == "k") ei = (gN >= 4 && gN <= 7) ? sv : 0;
  const bool upper = std::find(T["upper"].begin(), T["upper"].end(), l) != T["upper"].end();
  if (!trou) {
    if (upper) lo = sv - IT, hi = sv;
    else lo = ei, hi = ei + IT;
    return mm();
  }
  if (upper) {
    lo = -sv, hi = -sv + IT;
    return mm();
  }
  const std::string gs = std::to_string(gN);
  const double D = (gN >= 3 && gN <= 8) ? T["delta"][gs][im].get<double>() : 0;
  double ES;
  if (l == "k") ES = d <= 3 ? 0 : (gN <= 8 ? -T["shaft"]["k"][is].get<double>() + D : 0);
  else if (l == "m") {
    ES = d <= 3 ? -2 : (gN <= 8 ? -sv + D : -sv);
    if (gN == 6 && d > 250 && d <= 315) ES = -9;
  } else if (l == "n") ES = d <= 3 ? -4 : (gN <= 8 ? -sv + D : 0);
  else ES = -sv + (gN <= 7 ? D : 0);
  lo = ES - IT, hi = ES;
  return mm();
}
