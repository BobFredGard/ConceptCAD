// ConceptCAD natif : fenêtre Windows, ouverture d'un .conceptcad, rejeu, vue 3D, modification d'une cote.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shobjidl.h>

#include <AIS_InteractiveContext.hxx>
#include <AIS_Shape.hxx>
#include <Aspect_DisplayConnection.hxx>
#include <Graphic3d_AspectFillArea3d.hxx>
#include <OpenGl_GraphicDriver.hxx>
#include <Prs3d_Drawer.hxx>
#include <Prs3d_LineAspect.hxx>
#include <Quantity_Color.hxx>
#include <Standard_Failure.hxx>
#include <V3d_View.hxx>
#include <V3d_Viewer.hxx>
#include <WNT_Window.hxx>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <string>

#include "rejeu.h"

#pragma comment(linker, "\"/manifestdependency:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")

namespace {
enum { ID_OUVRIR = 101, ID_COTE, ID_VALEUR, ID_RECALCULER, ID_AJUSTER, ID_ETAT, ID_MINUTERIE };

std::wstring large(const std::string& s) {
  int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  std::wstring w(n > 0 ? n - 1 : 0, L'\0');
  if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), n);
  return w;
}
std::string utf8(const std::wstring& w) {
  int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
  std::string s(n > 0 ? n - 1 : 0, '\0');
  if (n > 1) WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, s.data(), n, nullptr, nullptr);
  return s;
}
double msDepuis(std::chrono::steady_clock::time_point t0) {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}

struct Protocole {  // même suite de modifications que la version navigateur (natif/mesures)
  bool actif = false;
  int total = 120, i = 0, fonction = -1;
  double base = 0, pas = 0.05;
  FILE* journal = nullptr;
};

struct Appli {
  HWND principale = nullptr, vue3d = nullptr, cote = nullptr, valeur = nullptr, etat = nullptr;
  HFONT police = nullptr;
  occ::handle<Aspect_DisplayConnection> connexion;
  occ::handle<OpenGl_GraphicDriver> pilote;
  occ::handle<V3d_Viewer> visu;
  occ::handle<V3d_View> vue;
  occ::handle<AIS_InteractiveContext> contexte;
  occ::handle<AIS_Shape> affichee;
  Document doc;
  bool docOuvert = false, ajusterVue = true;
  std::wstring chemin;
  std::vector<int> cotes;  // indices des fonctions dont la profondeur se règle
  int sx = 0, sy = 0;
  double msRejeu = 0, msMaillage = 0;
  Protocole proto;
} A;

void afficherEtat(const std::wstring& t) { SetWindowTextW(A.etat, t.c_str()); }

void creerVue() {
  A.connexion = new Aspect_DisplayConnection();
  A.pilote = new OpenGl_GraphicDriver(A.connexion);
  A.visu = new V3d_Viewer(A.pilote);
  A.visu->SetDefaultLights();
  A.visu->SetLightOn();
  A.vue = A.visu->CreateView();
  A.vue->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(A.vue3d)));
  A.vue->SetBgGradientColors(Quantity_Color(0.30, 0.34, 0.40, Quantity_TOC_sRGB), Quantity_Color(0.74, 0.78, 0.83, Quantity_TOC_sRGB), Aspect_GradientFillMethod_Vertical);
  A.vue->SetProj(V3d_XposYnegZpos);
  A.vue->TriedronDisplay(Aspect_TOTP_LEFT_LOWER, Quantity_NOC_WHITE, 0.09);
  A.contexte = new AIS_InteractiveContext(A.visu);
}

// Rejoue et affiche. Rend la durée totale en ms (calcul + maillage + dessin).
double recalculer() {
  const auto t0 = std::chrono::steady_clock::now();
  ResultatRejeu r;
  try {
    r = rejouer(A.doc);
    A.msRejeu = msDepuis(t0);
    if (!r.forme.IsNull()) mailler(r.forme, parallele());
  } catch (const Standard_Failure& e) {
    r.messages.push_back(e.what());
  }
  const double tCalcul = msDepuis(t0);
  A.msMaillage = tCalcul - A.msRejeu;
  if (!A.affichee.IsNull()) A.contexte->Remove(A.affichee, false);
  A.affichee.Nullify();
  if (!r.forme.IsNull()) {
    A.affichee = new AIS_Shape(r.forme);
    A.affichee->Attributes()->SetAutoTriangulation(false);  // le maillage vient de mailler()
    A.affichee->Attributes()->SetFaceBoundaryDraw(true);
    A.affichee->Attributes()->SetFaceBoundaryAspect(new Prs3d_LineAspect(Quantity_NOC_BLACK, Aspect_TOL_SOLID, 1.0));
    A.affichee->SetColor(Quantity_Color(0.62, 0.68, 0.76, Quantity_TOC_sRGB));
    A.affichee->SetMaterial(Graphic3d_NameOfMaterial_Steel);
    A.contexte->Display(A.affichee, AIS_Shaded, -1, false);  // -1 : pas de sélection dans ce premier morceau
  }
  if (A.ajusterVue) {
    A.vue->FitAll(0.08, false);
    A.ajusterVue = false;
  } else {
    A.vue->ZFitAll();
  }
  A.vue->Redraw();
  const double total = msDepuis(t0);
  if (!A.proto.actif && r.forme.IsNull() && r.messages.empty()) {
    afficherEtat(large(A.doc.nom) + L"  |  Aucun solide dans ce fichier (esquisses seules).");
  } else if (!A.proto.actif) {
    Mesures m = mesurer(r.forme);
    wchar_t b[300];
    swprintf(b, 300, L"%ls  |  Volume %.3f mm³  |  %d faces  |  calcul %.0f ms, total %.0f ms%ls", large(A.doc.nom).c_str(), m.volume, m.faces, tCalcul, total,
             r.messages.empty() ? L"" : L"  |  ⚠ voir message");
    afficherEtat(b);
    if (!r.messages.empty()) {
      std::wstring t;
      for (auto& x : r.messages) t += large(x) + L"\n";
      MessageBoxW(A.principale, t.c_str(), L"Messages du rejeu", MB_ICONWARNING);
    }
  }
  return total;
}

void remplirCotes() {
  SendMessageW(A.cote, CB_RESETCONTENT, 0, 0);
  A.cotes.clear();
  for (size_t i = 0; i < A.doc.fonctions.size(); i++) {
    auto& f = A.doc.fonctions[i];
    if (f.type != "extrude" || !f.visible || f.through) continue;
    A.cotes.push_back(static_cast<int>(i));
    SendMessageW(A.cote, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(large(f.nom).c_str()));
  }
  SendMessageW(A.cote, CB_SETCURSEL, 0, 0);
}
void montrerCoteChoisie() {
  int k = static_cast<int>(SendMessageW(A.cote, CB_GETCURSEL, 0, 0));
  if (k < 0 || k >= static_cast<int>(A.cotes.size())) return;
  wchar_t b[64];
  swprintf(b, 64, L"%g", A.doc.fonctions[A.cotes[k]].distance);
  SetWindowTextW(A.valeur, b);
}

bool ouvrir(const std::wstring& chemin) {
  try {
    Document d = lireProjet(chemin);
    if (!d.nonPrisEnCharge.empty()) {
      std::wstring t = L"Ce premier morceau du logiciel natif ne sait pas encore rejouer cette pièce entièrement.\nElle n'est donc pas ouverte, plutôt que de montrer un solide faux.\n\nManque :\n";
      for (auto& x : d.nonPrisEnCharge) t += L"  •  " + large(x) + L"\n";
      if (!A.proto.actif) MessageBoxW(A.principale, t.c_str(), L"Pièce pas encore prise en charge", MB_ICONINFORMATION);
      afficherEtat(L"Pièce non ouverte : fonctions pas encore reprises.");
      return false;
    }
    A.doc = std::move(d);
    A.chemin = chemin;
    A.docOuvert = true;
    A.ajusterVue = true;
    size_t p = chemin.find_last_of(L"\\/");
    SetWindowTextW(A.principale, (chemin.substr(p == std::wstring::npos ? 0 : p + 1) + L" — ConceptCAD natif").c_str());
    remplirCotes();
    montrerCoteChoisie();
    recalculer();
    return true;
  } catch (const std::exception& e) {
    MessageBoxW(A.principale, large(e.what()).c_str(), L"Ouverture impossible", MB_ICONERROR);
    return false;
  }
}

void choisirFichier() {
  IFileOpenDialog* dlg = nullptr;
  if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dlg)))) return;
  const COMDLG_FILTERSPEC filtres[] = {{L"Projets ConceptCAD (*.conceptcad)", L"*.conceptcad"}, {L"Tous les fichiers", L"*.*"}};
  dlg->SetFileTypes(2, filtres);
  dlg->SetTitle(L"Ouvrir une pièce ConceptCAD");
  std::wstring choisi;
  if (SUCCEEDED(dlg->Show(A.principale))) {
    IShellItem* item = nullptr;
    if (SUCCEEDED(dlg->GetResult(&item))) {
      PWSTR p = nullptr;
      if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &p))) {
        choisi = p;
        CoTaskMemFree(p);
      }
      item->Release();
    }
  }
  dlg->Release();
  if (!choisi.empty()) ouvrir(choisi);
}

void appliquerCote() {
  if (!A.docOuvert) return;
  int k = static_cast<int>(SendMessageW(A.cote, CB_GETCURSEL, 0, 0));
  if (k < 0 || k >= static_cast<int>(A.cotes.size())) return;
  wchar_t b[64];
  GetWindowTextW(A.valeur, b, 64);
  std::wstring t = b;
  std::replace(t.begin(), t.end(), L',', L'.');
  wchar_t* fin = nullptr;
  double v = wcstod(t.c_str(), &fin);
  if (fin == t.c_str() || *fin != L'\0' || v == 0) {
    MessageBoxW(A.principale, L"Saisir un nombre différent de zéro, en millimètres.", L"Cote incorrecte", MB_ICONWARNING);
    return;
  }
  A.doc.fonctions[A.cotes[k]].distance = v;
  recalculer();
}

LRESULT CALLBACK procVue(HWND h, UINT m, WPARAM w, LPARAM l) {
  const int x = static_cast<short>(LOWORD(l)), y = static_cast<short>(HIWORD(l));
  switch (m) {
    case WM_PAINT: {
      PAINTSTRUCT ps;
      BeginPaint(h, &ps);
      EndPaint(h, &ps);
      if (!A.vue.IsNull()) A.vue->Redraw();
      return 0;
    }
    case WM_ERASEBKGND:
      return 1;
    case WM_SIZE:
      if (!A.vue.IsNull()) A.vue->MustBeResized();
      return 0;
    case WM_LBUTTONDOWN:
    case WM_MBUTTONDOWN:
      SetFocus(h);
      SetCapture(h);
      A.vue->StartRotation(x, y);
      return 0;
    case WM_RBUTTONDOWN:
      SetFocus(h);
      SetCapture(h);
      A.sx = x;
      A.sy = y;
      return 0;
    case WM_LBUTTONUP:
    case WM_MBUTTONUP:
    case WM_RBUTTONUP:
      ReleaseCapture();
      return 0;
    case WM_MOUSEMOVE:
      if (w & (MK_LBUTTON | MK_MBUTTON)) {
        A.vue->Rotation(x, y);
      } else if (w & MK_RBUTTON) {
        A.vue->Pan(x - A.sx, A.sy - y);
        A.sx = x;
        A.sy = y;
      }
      return 0;
    case WM_MOUSEWHEEL: {
      POINT p{x, y};
      ScreenToClient(h, &p);
      A.vue->StartZoomAtPoint(p.x, p.y);
      const int d = GET_WHEEL_DELTA_WPARAM(w) / 4;
      A.vue->ZoomAtPoint(p.x, p.y, p.x + d, p.y + d);
      A.vue->Redraw();
      return 0;
    }
  }
  return DefWindowProcW(h, m, w, l);
}

void disposer(HWND h) {
  RECT r;
  GetClientRect(h, &r);
  const int H = 44, EH = 26;
  MoveWindow(A.etat, 0, r.bottom - EH, r.right, EH, TRUE);
  MoveWindow(A.vue3d, 0, H, r.right, std::max(1L, r.bottom - H - EH), TRUE);
}

void pasProtocole() {
  auto& P = A.proto;
  if (P.i >= P.total) {
    KillTimer(A.principale, ID_MINUTERIE);
    A.doc.fonctions[P.fonction].distance = P.base;
    fprintf(P.journal, "fin\n");
    fflush(P.journal);
    return;
  }
  P.i++;
  A.doc.fonctions[P.fonction].distance = P.base + (P.base < 0 ? -1 : 1) * P.pas * P.i;
  const double ms = recalculer();
  fprintf(P.journal, "modif %d %.3f %.3f %.3f\n", P.i, ms, A.msRejeu, A.msMaillage);
  fflush(P.journal);
}

LRESULT CALLBACK procPrincipale(HWND h, UINT m, WPARAM w, LPARAM l) {
  switch (m) {
    case WM_SIZE:
      disposer(h);
      return 0;
    case WM_COMMAND:
      switch (LOWORD(w)) {
        case ID_OUVRIR:
          choisirFichier();
          return 0;
        case ID_RECALCULER:
          appliquerCote();
          return 0;
        case ID_AJUSTER:
          if (!A.vue.IsNull()) A.vue->FitAll(0.08);
          return 0;
        case ID_COTE:
          if (HIWORD(w) == CBN_SELCHANGE) montrerCoteChoisie();
          return 0;
      }
      break;
    case WM_TIMER:
      if (w == ID_MINUTERIE) pasProtocole();
      return 0;
    case WM_MOUSEWHEEL:
      return SendMessageW(A.vue3d, m, w, l);
    case WM_DESTROY:
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(h, m, w, l);
}

HWND controle(const wchar_t* classe, const wchar_t* texte, DWORD style, int x, int y, int L, int H, int id, HWND p) {
  HWND c = CreateWindowExW(0, classe, texte, WS_CHILD | WS_VISIBLE | style, x, y, L, H, p, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)), GetModuleHandleW(nullptr), nullptr);
  SendMessageW(c, WM_SETFONT, reinterpret_cast<WPARAM>(A.police), TRUE);
  return c;
}

void creerFenetres(HINSTANCE inst) {
  WNDCLASSEXW wc{sizeof wc};
  wc.lpfnWndProc = procVue;
  wc.hInstance = inst;
  wc.style = CS_OWNDC;
  wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  wc.lpszClassName = L"CCNatifVue";
  RegisterClassExW(&wc);
  wc.style = 0;
  wc.lpfnWndProc = procPrincipale;
  wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
  wc.lpszClassName = L"CCNatifPrincipale";
  RegisterClassExW(&wc);
  A.police = CreateFontW(-14, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
  // Même surface de vue que la version navigateur (fenêtre 1400 × 900)
  RECT r{0, 0, 1400, 900};
  AdjustWindowRect(&r, WS_OVERLAPPEDWINDOW, FALSE);
  A.principale = CreateWindowExW(0, L"CCNatifPrincipale", L"ConceptCAD natif", WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, 40, 40, r.right - r.left, r.bottom - r.top, nullptr, nullptr, inst, nullptr);
  HWND p = A.principale;
  controle(L"BUTTON", L"Ouvrir…", BS_PUSHBUTTON, 8, 8, 90, 28, ID_OUVRIR, p);
  controle(L"STATIC", L"Cote :", SS_CENTERIMAGE, 112, 8, 44, 28, 0, p);
  A.cote = controle(L"COMBOBOX", L"", CBS_DROPDOWNLIST | WS_VSCROLL, 156, 9, 340, 240, ID_COTE, p);
  A.valeur = controle(L"EDIT", L"", WS_BORDER | ES_AUTOHSCROLL, 504, 10, 90, 24, ID_VALEUR, p);
  controle(L"STATIC", L"mm", SS_CENTERIMAGE, 600, 8, 28, 28, 0, p);
  controle(L"BUTTON", L"Recalculer", BS_PUSHBUTTON, 634, 8, 100, 28, ID_RECALCULER, p);
  controle(L"BUTTON", L"Ajuster la vue", BS_PUSHBUTTON, 746, 8, 110, 28, ID_AJUSTER, p);
  A.etat = controle(L"STATIC", L"Aucune pièce ouverte.  Ctrl+O pour ouvrir.  Clic gauche : tourner.  Clic droit : déplacer.  Molette : zoom.", SS_CENTERIMAGE | WS_BORDER, 0, 0, 100, 26, ID_ETAT, p);
  A.vue3d = CreateWindowExW(0, L"CCNatifVue", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN, 0, 44, 100, 100, p, nullptr, inst, nullptr);
  disposer(p);
}

// --verif <fichier> <sortie.json> [nFonction=valeur ...] : calcule sans fenêtre, écrit les mesures.
int modeVerif(int argc, wchar_t** argv) {
  if (argc < 4) return 2;
  FILE* s = _wfopen(argv[3], L"wb");
  if (!s) return 2;
  try {
    Document d = lireProjet(argv[2]);
    fprintf(s, "{\"nonPrisEnCharge\":[");
    for (size_t i = 0; i < d.nonPrisEnCharge.size(); i++) fprintf(s, "%s\"%s\"", i ? "," : "", d.nonPrisEnCharge[i].c_str());
    fprintf(s, "],\"parallele\":%s,\"cas\":[", parallele() ? "true" : "false");
    bool premier = true;
    auto cas = [&](const std::string& nom) {
      const auto t0 = std::chrono::steady_clock::now();
      ResultatRejeu r = rejouer(d);
      const double ms = msDepuis(t0);
      Mesures m = mesurer(r.forme);
      fprintf(s, "%s{\"nom\":\"%s\",\"volume\":%.9f,\"aire\":%.9f,\"faces\":%d,\"aretes\":%d,\"sommets\":%d,\"solides\":%d,\"valide\":%s,\"boite\":[%.6f,%.6f,%.6f,%.6f,%.6f,%.6f],\"ms\":%.3f,\"messages\":%zu}",
              premier ? "" : ",", nom.c_str(), m.volume, m.aire, m.faces, m.aretes, m.sommets, m.solides, m.valide ? "true" : "false",
              m.boite[0], m.boite[1], m.boite[2], m.boite[3], m.boite[4], m.boite[5], ms, r.messages.size());
      premier = false;
    };
    cas("tel quel");
    for (int i = 4; i < argc; i++) {
      std::wstring a = argv[i];
      size_t eq = a.find(L'=');
      if (eq == std::wstring::npos) continue;
      d.fonctions.at(_wtoi(a.substr(0, eq).c_str())).distance = _wtof(a.substr(eq + 1).c_str());
      cas(utf8(a));
    }
    fprintf(s, "]}\n");
  } catch (const std::exception& e) {
    fprintf(s, "{\"erreur\":\"%s\"}\n", e.what());
    fclose(s);
    return 1;
  }
  fclose(s);
  return 0;
}
}  // namespace

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR, int montrer) {
  int argc = 0;
  wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  reglerParallele(true);
  std::vector<std::wstring> args;
  for (int i = 1; i < argc; i++) {
    if (wcscmp(argv[i], L"--sequentiel") == 0) reglerParallele(false);
    else args.push_back(argv[i]);
  }
  if (args.size() >= 1 && args[0] == L"--verif") {
    std::vector<wchar_t*> v{argv[0]};
    for (auto& a : args) v.push_back(a.data());
    return modeVerif(static_cast<int>(v.size()), v.data());
  }
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_SYSTEM_AWARE);
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  INITCOMMONCONTROLSEX cc{sizeof cc, ICC_STANDARD_CLASSES};
  InitCommonControlsEx(&cc);
  creerFenetres(inst);
  ShowWindow(A.principale, montrer);
  UpdateWindow(A.principale);
  creerVue();
  ACCEL raccourcis[] = {{FCONTROL | FVIRTKEY, 'O', ID_OUVRIR}};
  HACCEL acc = CreateAcceleratorTableW(raccourcis, 1);

  // --protocole <fichier> <journal> : même suite de modifications que la version navigateur
  if (args.size() >= 3 && args[0] == L"--protocole") {
    A.proto.actif = true;
    A.proto.journal = _wfopen(args[2].c_str(), L"wb");
    if (!A.proto.journal || !ouvrir(args[1])) return 1;
    A.proto.fonction = A.cotes.empty() ? -1 : A.cotes[0];
    if (A.proto.fonction < 0) return 1;
    A.proto.base = A.doc.fonctions[A.proto.fonction].distance;
    if (args.size() >= 4) A.proto.total = _wtoi(args[3].c_str());
    fprintf(A.proto.journal, "pret\n");
    fflush(A.proto.journal);
    // Attend le feu vert du mesureur (fichier <journal>.go) : la mesure « au repos » se fait avant.
    SetTimer(A.principale, ID_MINUTERIE + 1, 200, [](HWND h, UINT, UINT_PTR id, DWORD) {
      static std::wstring signal;
      if (signal.empty()) {
        int n = 0;
        wchar_t** v = CommandLineToArgvW(GetCommandLineW(), &n);
        for (int i = 1; i + 2 < n; i++)
          if (wcscmp(v[i], L"--protocole") == 0) signal = std::wstring(v[i + 2]) + L".go";
      }
      if (GetFileAttributesW(signal.c_str()) != INVALID_FILE_ATTRIBUTES) {
        KillTimer(h, id);
        SetTimer(h, ID_MINUTERIE, 20, nullptr);
      }
    });
  } else if (!args.empty()) {
    ouvrir(args[0]);
  }

  MSG msg;
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    if (TranslateAcceleratorW(A.principale, acc, &msg)) continue;
    if (msg.message == WM_KEYDOWN && msg.wParam == VK_RETURN && msg.hwnd == A.valeur) {
      appliquerCote();
      continue;
    }
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  CoUninitialize();
  return 0;
}
