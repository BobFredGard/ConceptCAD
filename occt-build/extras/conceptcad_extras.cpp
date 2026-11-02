// ConceptCAD — liaisons écrites à la main, ajoutées au noyau OCCT recompilé.
// Compilé tel quel par les deux chaînes :
//   opencascade.js 2.x  → `mainBuild.additionalBindCode` (texte injecté par occt-build/build.cjs)
//   libcascade 3.x      → `mainBuild.additionalBindFiles`
// Tout passe par des types simples (nombres, booléens, std::string) ou des classes que le
// noyau expose déjà (TopoDS_Shape, TopoDS_Face, TopTools_ListOfShape), pour ne dépendre
// ni du générateur de liaisons ni de ses conventions de nommage (_1, _2…).
//
// CCFaceOffset — BRepOffset_MakeOffset avec décalage par face (SetOffsetOnFace).
//   Absent des noyaux publiés : la liaison automatique de la classe échoue sur
//   GetAnalyse() (déclarée, jamais définie dans OCCT). On n'expose que l'utile.
//   Usage JS : const o=new oc.CCFaceOffset(); o.Init(solide,0,1e-6,true,false,0,false);
//              o.SetFace(face,2.5); o.MakeOffset(); if(o.IsDone()) o.Shape()
// CCText — conversions UTF-8 ⇄ TCollection_ExtendedString (noms XCAF accentués).
// CCStatic — Interface_Static (schéma STEP AP242, unités…) par chaînes.

#include <emscripten/bind.h>
#include <string>
#include <vector>

#include <Standard_Failure.hxx>
#include <TopoDS_Shape.hxx>
#include <TopoDS_Face.hxx>
#include <TopTools_ListOfShape.hxx>
#include <GeomAbs_JoinType.hxx>
#include <BRepOffset_Mode.hxx>
#include <BRepOffset_MakeOffset.hxx>
#include <TCollection_ExtendedString.hxx>
#include <TCollection_AsciiString.hxx>
#include <Interface_Static.hxx>

class CCFaceOffset {
public:
  CCFaceOffset() {}

  // join : 0 = arc (GeomAbs_Arc), 2 = intersection (GeomAbs_Intersection)
  void Init(const TopoDS_Shape& s, double offset, double tol, bool intersection,
            bool selfInter, int join, bool removeIntEdges) {
    myMaker.Initialize(s, offset, tol, BRepOffset_Skin, intersection ? Standard_True : Standard_False,
                       selfInter ? Standard_True : Standard_False,
                       join == 2 ? GeomAbs_Intersection : GeomAbs_Arc,
                       Standard_False, removeIntEdges ? Standard_True : Standard_False);
    myMsg.clear();
  }
  void SetFace(const TopoDS_Face& f, double off) { myMaker.SetOffsetOnFace(f, off); }
  void AllowLinearization(bool on) { myMaker.AllowLinearization(on ? Standard_True : Standard_False); }

  // Rend vrai si le calcul a abouti ; une exception OCCT est rattrapée ici (message dans Message()).
  bool MakeOffset() { return run(false); }
  bool MakeThickSolid() { return run(true); }

  bool IsDone() const { return myMaker.IsDone() == Standard_True; }
  int Error() const { return (int)myMaker.Error(); }
  std::string Message() const { return myMsg; }
  TopoDS_Shape Shape() const { return myMaker.Shape(); }
  // Historique : ce que devient une face / arête de départ.
  TopTools_ListOfShape Modified(const TopoDS_Shape& s) { return myMaker.Modified(s); }
  TopTools_ListOfShape Generated(const TopoDS_Shape& s) { return myMaker.Generated(s); }

private:
  bool run(bool thick) {
    try {
      if (thick) myMaker.MakeThickSolid(); else myMaker.MakeOffsetShape();
    } catch (const Standard_Failure& e) {
      myMsg = std::string(e.DynamicType()->Name()) + ": " + (e.GetMessageString() ? e.GetMessageString() : "");
      return false;
    } catch (...) {
      myMsg = "exception C++";
      return false;
    }
    return myMaker.IsDone() == Standard_True;
  }
  BRepOffset_MakeOffset myMaker;
  std::string myMsg;
};

class CCText {
public:
  static TCollection_ExtendedString ToExtended(const std::string& utf8) {
    return TCollection_ExtendedString(utf8.c_str(), Standard_True);
  }
  static std::string FromExtended(const TCollection_ExtendedString& s) {
    std::vector<char> buf(s.LengthOfCString() + 1, 0);
    Standard_PCharacter p = buf.data();
    s.ToUTF8CString(p);
    return std::string(buf.data());
  }
};

class CCStatic {
public:
  static bool SetCVal(const std::string& name, const std::string& val) {
    return Interface_Static::SetCVal(name.c_str(), val.c_str()) == Standard_True;
  }
  static bool SetIVal(const std::string& name, int val) {
    return Interface_Static::SetIVal(name.c_str(), val) == Standard_True;
  }
  static std::string CVal(const std::string& name) {
    Standard_CString v = Interface_Static::CVal(name.c_str());
    return v ? std::string(v) : std::string();
  }
};

EMSCRIPTEN_BINDINGS(conceptcad_extras) {
  emscripten::class_<CCFaceOffset>("CCFaceOffset")
    .constructor<>()
    .function("Init", &CCFaceOffset::Init)
    .function("SetFace", &CCFaceOffset::SetFace)
    .function("AllowLinearization", &CCFaceOffset::AllowLinearization)
    .function("MakeOffset", &CCFaceOffset::MakeOffset)
    .function("MakeThickSolid", &CCFaceOffset::MakeThickSolid)
    .function("IsDone", &CCFaceOffset::IsDone)
    .function("Error", &CCFaceOffset::Error)
    .function("Message", &CCFaceOffset::Message)
    .function("Shape", &CCFaceOffset::Shape)
    .function("Modified", &CCFaceOffset::Modified)
    .function("Generated", &CCFaceOffset::Generated);
  emscripten::class_<CCText>("CCText")
    .class_function("ToExtended", &CCText::ToExtended)
    .class_function("FromExtended", &CCText::FromExtended);
  emscripten::class_<CCStatic>("CCStatic")
    .class_function("SetCVal", &CCStatic::SetCVal)
    .class_function("SetIVal", &CCStatic::SetIVal)
    .class_function("CVal", &CCStatic::CVal);
}
