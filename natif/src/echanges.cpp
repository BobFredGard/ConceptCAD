#define NOMINMAX
#include <windows.h>

#include "echanges.h"

#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <TopoDS_Compound.hxx>
#include <BRepBndLib.hxx>
#include <BRep_Builder.hxx>
#include <BRep_Tool.hxx>
#include <Bnd_Box.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <Interface_Static.hxx>
#include <Poly_Triangulation.hxx>
#include <RWStl.hxx>
#include <STEPControl_Reader.hxx>
#include <STEPControl_Writer.hxx>
#include <TopExp_Explorer.hxx>
#include <TopLoc_Location.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>
#include <gp_Trsf.hxx>

#include <cstdint>
#include <cstdio>
#include <fstream>
#include <map>
#include <sstream>
#include <stdexcept>

std::string cleImport(const std::string& octets) {
  uint32_t h = 2166136261u;
  for (const unsigned char c : octets) {
    h ^= c;
    h *= 16777619u;
  }
  std::string b36;
  do {
    b36.insert(b36.begin(), "0123456789abcdefghijklmnopqrstuvwxyz"[h % 36]);
    h /= 36;
  } while (h);
  return "impsrc:" + b36 + "_" + std::to_string(octets.size());
}

std::string base64Coder(const std::string& o) {
  static const char T[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string r;
  r.reserve((o.size() + 2) / 3 * 4);
  for (size_t i = 0; i < o.size(); i += 3) {
    const unsigned a = static_cast<unsigned char>(o[i]), b = i + 1 < o.size() ? static_cast<unsigned char>(o[i + 1]) : 0, c = i + 2 < o.size() ? static_cast<unsigned char>(o[i + 2]) : 0;
    r += T[a >> 2];
    r += T[((a & 3) << 4) | (b >> 4)];
    r += i + 1 < o.size() ? T[((b & 15) << 2) | (c >> 6)] : '=';
    r += i + 2 < o.size() ? T[c & 63] : '=';
  }
  return r;
}

std::string base64Decoder(const std::string& t) {
  const auto val = [](char c) { return c >= 'A' && c <= 'Z' ? c - 'A' : c >= 'a' && c <= 'z' ? c - 'a' + 26 : c >= '0' && c <= '9' ? c - '0' + 52 : c == '+' ? 62 : c == '/' ? 63 : -1; };
  std::string r;
  r.reserve(t.size() / 4 * 3);
  unsigned acc = 0;
  int n = 0;
  for (const char c : t) {
    const int v = val(c);
    if (v < 0) continue;
    acc = (acc << 6) | static_cast<unsigned>(v);
    if (++n == 4) {
      r += static_cast<char>((acc >> 16) & 255);
      r += static_cast<char>((acc >> 8) & 255);
      r += static_cast<char>(acc & 255);
      n = 0;
      acc = 0;
    }
  }
  if (n == 3) {
    r += static_cast<char>((acc >> 10) & 255);
    r += static_cast<char>((acc >> 2) & 255);
  } else if (n == 2) {
    r += static_cast<char>((acc >> 4) & 255);
  }
  return r;
}

namespace {
// Un fichier temporaire : le lecteur STL du noyau ne lit que des fichiers
std::wstring cheminTemporaire(const wchar_t* extension) {
  wchar_t dossier[MAX_PATH + 1] = {};
  GetTempPathW(MAX_PATH, dossier);
  return std::wstring(dossier) + L"conceptcad-" + std::to_wstring(GetCurrentProcessId()) + L"-" + std::to_wstring(GetTickCount64()) + extension;
}
std::string utf8(const std::wstring& w) {
  const int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
  std::string s(n > 0 ? n - 1 : 0, '\0');
  if (n > 1) WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, s.data(), n, nullptr, nullptr);
  return s;
}

TopoDS_Shape lireStep(const std::string& octets) {
  std::istringstream flux(octets);
  STEPControl_Reader lecteur;
  if (lecteur.ReadStream("piece.step", flux) != IFSelect_RetDone && lecteur.NbRootsForTransfer() < 1) throw std::runtime_error("fichier STEP illisible");
  if (lecteur.NbRootsForTransfer() < 1) throw std::runtime_error("aucun solide transférable");
  lecteur.TransferRoots();
  TopoDS_Shape s = lecteur.OneShape();
  if (s.IsNull()) throw std::runtime_error("aucun solide transférable");
  return s;
}

TopoDS_Shape lireStl(const std::string& octets) {
  const std::wstring t = cheminTemporaire(L".stl");
  std::ofstream(t, std::ios::binary) << octets;
  occ::handle<Poly_Triangulation> tri = RWStl::ReadFile(utf8(t).c_str());
  _wremove(t.c_str());
  if (tri.IsNull() || tri->NbTriangles() < 1) throw std::runtime_error("STL illisible");
  // importStlBuild : la pièce est centrée
  Bnd_Box b;
  for (int i = 1; i <= tri->NbNodes(); i++) b.Add(tri->Node(i));
  double x0, y0, z0, x1, y1, z1;
  b.Get(x0, y0, z0, x1, y1, z1);
  const gp_XYZ c((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  // Une face plane par triangle : la vue, la sélection, les mesures et l'export s'en servent comme du reste
  if (tri->NbTriangles() > 2000000) throw std::runtime_error("STL de plus de 2 millions de triangles : trop lourd pour être ouvert ici");
  BRep_Builder bd;
  TopoDS_Compound comp;
  bd.MakeCompound(comp);
  for (int i = 1; i <= tri->NbTriangles(); i++) {
    int a, b2, c2;
    tri->Triangle(i).Get(a, b2, c2);
    const gp_Pnt p1(tri->Node(a).XYZ() - c), p2(tri->Node(b2).XYZ() - c), p3(tri->Node(c2).XYZ() - c);
    if (p1.Distance(p2) < 1e-7 || p2.Distance(p3) < 1e-7 || p3.Distance(p1) < 1e-7 || (p2.XYZ() - p1.XYZ()).Crossed(p3.XYZ() - p1.XYZ()).Modulus() < 1e-12) continue;
    BRepBuilderAPI_MakePolygon poly(p1, p2, p3, true);
    BRepBuilderAPI_MakeFace face(poly.Wire(), true);
    if (face.IsDone()) bd.Add(comp, face.Face());
  }
  return comp;
}
}  // namespace

TopoDS_Shape formeImportee(const Document& d, const Fonction& f, bool* exacte) {
  if (exacte) *exacte = f.importFmt != "stl";
  if (!d.imports || f.importCle.empty()) return TopoDS_Shape();
  const auto it = d.imports->find(f.importCle);
  if (it == d.imports->end()) return TopoDS_Shape();
  static std::map<std::string, TopoDS_Shape> lues;  // la clé est une empreinte du contenu
  const auto deja = lues.find(f.importCle);
  if (deja != lues.end()) return deja->second;
  const std::string octets = base64Decoder(it->second);
  TopoDS_Shape s = f.importFmt == "stl" ? lireStl(octets) : lireStep(octets);
  lues[f.importCle] = s;
  return s;
}

void exporterStep(const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin, const std::string& schema, bool sansCourbes2D) {
  if (formes.empty()) throw std::runtime_error("solide vide, rien à exporter");
  // Réglages communs du noyau : posés avant le transfert, remis ensuite
  Interface_Static::SetCVal("write.step.schema", schema == "AP203" ? "AP203" : "AP214IS");
  Interface_Static::SetIVal("write.surfacecurve.mode", sansCourbes2D ? 0 : 1);
  STEPControl_Writer ecrivain;
  for (const TopoDS_Shape& s : formes)
    if (ecrivain.Transfer(s, STEPControl_AsIs) != IFSelect_RetDone) throw std::runtime_error("transfert refusé par le noyau");
  std::ostringstream flux;
  if (ecrivain.WriteStream(flux) != IFSelect_RetDone) throw std::runtime_error("écriture refusée par le noyau");
  Interface_Static::SetIVal("write.surfacecurve.mode", 1);
  std::ofstream sortie(chemin, std::ios::binary);
  sortie << flux.str();
  if (!sortie) throw std::runtime_error("écriture du fichier impossible");
}

namespace {
template <class F>
void chaqueTriangle(const std::vector<TopoDS_Shape>& formes, F faire) {
  for (const TopoDS_Shape& s : formes)
    for (TopExp_Explorer e(s, TopAbs_FACE); e.More(); e.Next()) {
      const TopoDS_Face face = TopoDS::Face(e.Current());
      TopLoc_Location l;
      const occ::handle<Poly_Triangulation> t = BRep_Tool::Triangulation(face, l);
      if (t.IsNull()) continue;
      const bool inverse = face.Orientation() == TopAbs_REVERSED;
      for (int i = 1; i <= t->NbTriangles(); i++) {
        int a, b, c;
        t->Triangle(i).Get(a, b, c);
        if (inverse) std::swap(b, c);
        faire(t->Node(a).Transformed(l), t->Node(b).Transformed(l), t->Node(c).Transformed(l));
      }
    }
}
}  // namespace

void exporterStl(const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin) {
  uint32_t n = 0;
  chaqueTriangle(formes, [&](const gp_Pnt&, const gp_Pnt&, const gp_Pnt&) { n++; });
  if (!n) throw std::runtime_error("rien à exporter");
  std::ofstream s(chemin, std::ios::binary);
  const char tete[80] = {};
  s.write(tete, 80);
  s.write(reinterpret_cast<const char*>(&n), 4);
  chaqueTriangle(formes, [&](const gp_Pnt& a, const gp_Pnt& b, const gp_Pnt& c) {
    gp_XYZ m = (b.XYZ() - a.XYZ()).Crossed(c.XYZ() - a.XYZ());
    if (m.Modulus() > 0) m.Normalize();
    const float v[12] = {float(m.X()), float(m.Y()), float(m.Z()), float(a.X()), float(a.Y()), float(a.Z()), float(b.X()), float(b.Y()), float(b.Z()), float(c.X()), float(c.Y()), float(c.Z())};
    s.write(reinterpret_cast<const char*>(v), sizeof v);
    const uint16_t rien = 0;
    s.write(reinterpret_cast<const char*>(&rien), 2);
  });
  if (!s) throw std::runtime_error("écriture du fichier impossible");
}

void exporterObj(const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin) {
  std::ofstream s(chemin, std::ios::binary);
  s << "# ConceptCAD\n";
  s.precision(9);
  size_t n = 0, parties = 0;
  for (const TopoDS_Shape& forme : formes) {
    s << "o part" << ++parties << "\n";
    chaqueTriangle({forme}, [&](const gp_Pnt& a, const gp_Pnt& b, const gp_Pnt& c) {
      for (const gp_Pnt* p : {&a, &b, &c}) s << "v " << p->X() << " " << p->Y() << " " << p->Z() << "\n";
      s << "f " << n + 1 << " " << n + 2 << " " << n + 3 << "\n";
      n += 3;
    });
  }
  if (!n) throw std::runtime_error("rien à exporter");
  if (!s) throw std::runtime_error("écriture du fichier impossible");
}
