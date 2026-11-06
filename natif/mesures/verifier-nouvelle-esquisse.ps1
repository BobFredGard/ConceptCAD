# Crée des esquisses par le menu, sur une COPIE de la pièce, avec les messages que Windows enverrait à la fenêtre : la vraie souris et le vrai clavier ne bougent pas.
# powershell -File natif\mesures\verifier-nouvelle-esquisse.ps1 -Fichier <chemin.conceptcad> -Dossier <captures>
param([string]$Fichier, [string]$Dossier)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Runtime.InteropServices; using System.Drawing;
public static class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  public delegate bool Rappel(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, Rappel f, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  public static IntPtr ParNom(IntPtr parent, string nom) {
    IntPtr r = IntPtr.Zero;
    EnumChildWindows(parent, (h, l) => { var s = new System.Text.StringBuilder(64); GetWindowText(h, s, 64); if (s.ToString() == nom && IsWindowVisible(h)) { r = h; return false; } return true; }, IntPtr.Zero);
    return r;
  }
  public static IntPtr ParId(IntPtr parent, int id) {
    IntPtr r = IntPtr.Zero;
    EnumChildWindows(parent, (h, l) => { if (GetDlgCtrlID(h) == id && IsWindowVisible(h)) { r = h; return false; } return true; }, IntPtr.Zero);
    return r;
  }
  public static void Image(IntPtr h, string chemin) {
    RECT r; GetWindowRect(h, out r);
    using (var b = new Bitmap(r.R - r.L, r.B - r.T)) {
      using (var g = Graphics.FromImage(b)) { IntPtr dc = g.GetHdc(); PrintWindow(h, dc, 2); g.ReleaseHdc(dc); }
      b.Save(chemin, System.Drawing.Imaging.ImageFormat.Png);
    }
  }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
'@
[void][U]::SetProcessDPIAware()
$exe = Join-Path $PSScriptRoot '..\sortie\ConceptCADNatif.exe'
New-Item -ItemType Directory -Force $Dossier | Out-Null
$Dossier = (Resolve-Path $Dossier).Path
$copie = Join-Path $Dossier 'copie.conceptcad'
Copy-Item -LiteralPath $Fichier $copie -Force
Remove-Item "$copie.bak" -ErrorAction SilentlyContinue
$env:CONCEPTCAD_JOURNAL_ETAT = Join-Path $Dossier 'etat.txt'
$env:CONCEPTCAD_SANS_ACTIVER = '1'; Remove-Item Env:CONCEPTCAD_OUVRIR_ESQUISSE -ErrorAction SilentlyContinue
Remove-Item $env:CONCEPTCAD_JOURNAL_ETAT -ErrorAction SilentlyContinue

function Capture($nom) { Start-Sleep -Milliseconds 150; [U]::Image($w, (Join-Path $Dossier $nom)) }
function Pos($x, $y) { return [IntPtr](([int]$y -shl 16) -bor ([int]$x -band 0xffff)) }
function Msg($h, $m, $a, $l) { [void][U]::PostMessage($h, $m, [IntPtr]$a, $l) }
# WM_MOUSEMOVE 0x200, LBUTTONDOWN 0x201, LBUTTONUP 0x202, LBUTTONDBLCLK 0x203, RBUTTONDOWN 0x204, RBUTTONUP 0x205 ; 1 : bouton gauche tenu, 2 : droit
function Souris($x, $y, $b = 0) { Msg $vue 0x200 $b (Pos $x $y); Start-Sleep -Milliseconds 40 }
function Clic($x, $y) { Souris $x $y; Msg $vue 0x201 1 (Pos $x $y); Start-Sleep -Milliseconds 30; Msg $vue 0x202 0 (Pos $x $y); Start-Sleep -Milliseconds 120 }
function ClicDroit($x, $y) { Souris $x $y; Msg $vue 0x204 2 (Pos $x $y); Start-Sleep -Milliseconds 30; Msg $vue 0x205 0 (Pos $x $y); Start-Sleep -Milliseconds 120 }
function Double($x, $y) { Souris $x $y; Msg $vue 0x201 1 (Pos $x $y); Msg $vue 0x202 0 (Pos $x $y); Msg $vue 0x203 1 (Pos $x $y); Msg $vue 0x202 0 (Pos $x $y); Start-Sleep -Milliseconds 400 }
function Glisse($x1, $y1, $x2, $y2) { Souris $x1 $y1; Msg $vue 0x201 1 (Pos $x1 $y1); foreach ($k in 1..6) { Souris ($x1 + ($x2 - $x1) * $k / 6) ($y1 + ($y2 - $y1) * $k / 6) 1 }; Msg $vue 0x202 0 (Pos $x2 $y2); Start-Sleep -Milliseconds 200 }
function Touche($code) { Msg $vue 0x100 $code ([IntPtr]1); Msg $vue 0x101 $code ([IntPtr]1); Start-Sleep -Milliseconds 200 }
function Menu($id) { Msg $w 0x111 $id ([IntPtr]::Zero); Start-Sleep -Milliseconds 1200 }  # WM_COMMAND : Ctrl+S et compagnie
function Lignes { return @(Get-Content $env:CONCEPTCAD_JOURNAL_ETAT -Encoding UTF8 -ErrorAction SilentlyContinue) }
function Etat { Start-Sleep -Milliseconds 300; return (Lignes | Where-Object { $_ -notlike 'cote *' } | Select-Object -Last 1) }
function Titre { $p.Refresh(); return $p.MainWindowTitle }
function Outil($nom) {
  $h = [U]::ParNom($w, $nom)
  if ($h -eq [IntPtr]::Zero) { $p.Kill(); throw "bouton $nom introuvable" }
  Msg $h 0x201 1 (Pos 5 5); Msg $h 0x202 0 (Pos 5 5); Start-Sleep -Milliseconds 200
}
function Verifie($ok, $quoi) { if (-not $ok) { Capture 'echec.png'; if (-not $p.HasExited) { $p.Kill() }; throw "ÉCHEC : $quoi (état : $(Etat))" } }

function Esquisses { return (node -e "const f=require('fs'),z=require('zlib');let b=f.readFileSync(process.argv[1]);if(b[0]==0x1f)b=z.gunzipSync(b);const j=JSON.parse(b),d=j.doc||j;console.log(d.sketches.map(s=>s.name+':'+s.plane+':'+s.entities.length+(s.host?':'+s.host.tag+':'+s.host.name:'')).join(' | '))" "$copie") }

$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3
"1. Pièce ouverte : $(Etat)"
$vue = [U]::ParId($w, 2004)
$vue3d = [U]::ParId($w, 2005)
Verifie ($vue3d -ne [IntPtr]::Zero) 'vue 3D introuvable'

# Menu Esquisse : 6005 XY, 6006 XZ, 6007 YZ, 6008 face ; 6001 annuler, 6002 rétablir, 5003 enregistrer
Menu 6005
Verifie ((Etat) -like '*Esquisse 3*') 'XY : la nouvelle esquisse devrait s''ouvrir'
$vue = [U]::ParId($w, 2004)
Verifie ((Titre) -like '●*') 'la nouvelle esquisse marque la pièce comme modifiée'
Capture '1-nouvelle-xy.png'
"2. Nouvelle esquisse XY ouverte : $(Titre)"
Touche 0x1B; Touche 0x1B; Start-Sleep -Milliseconds 600
Verifie ((Titre) -notlike '●*') 'une esquisse restée vide ne doit pas rester dans la pièce'
"3. Refermée sans rien dessiner : retirée, plus rien à enregistrer"

Menu 6006
$vue = [U]::ParId($w, 2004)
$r = New-Object U+RECT; [void][U]::GetWindowRect($vue, [ref]$r)
$LL = $r.R - $r.L; $HH = $r.B - $r.T
function X($f) { return [int]($LL * $f) }
function Y($f) { return [int]($HH * $f) }
Outil 'Rectangle'
Clic (X 0.45) (Y 0.40); Souris (X 0.50) (Y 0.45); Clic (X 0.60) (Y 0.60)
Touche 0x1B
Capture '2-rectangle-xz.png'
"4. Rectangle dans une esquisse XZ : $(Etat)"
Menu 6001; Menu 6001
Verifie ((Titre) -notlike '●*') 'annuler le rectangle puis la création ramène à la pièce d''origine'
"5. Ctrl+Z deux fois : rectangle puis création annulés"
Menu 6002; Menu 6002
Verifie ((Titre) -like '●*') 'rétablir ramène l''esquisse'
Capture '3-retabli.png'
"6. Ctrl+Y deux fois : esquisse et rectangle revenus"
Menu 5003
Verifie ((Titre) -notlike '●*') 'après enregistrement, plus de modification en attente'
"7. Enregistré : $(Esquisses)"
Menu 6001
Menu 6001
Verifie ((Etat) -like '*déjà enregistrée*') 'une esquisse enregistrée ne se retire pas par Ctrl+Z'
Menu 6002
"8. Une esquisse déjà enregistrée n'est pas retirée par Ctrl+Z"
Verifie ((Titre) -notlike '●*') 'rétablir ramène à ce qui est enregistré'

# Une face du solide : clic au milieu de la vue 3D, puis menu
$r = New-Object U+RECT; [void][U]::GetWindowRect($vue3d, [ref]$r)
$cx = [int](($r.R - $r.L) / 2); $cy = [int](($r.B - $r.T) / 2)
Menu 6008
Verifie ((Etat) -like '*cliquez d''abord une face*') 'sans face choisie, le menu le dit'
"9. Sans face choisie : $(Etat)"
# La pièce n'occupe pas forcément le milieu de la vue : on essaie une grille jusqu'à toucher une face
:grille foreach ($fy in 0.5, 0.4, 0.6, 0.3, 0.7) { foreach ($fx in 0.5, 0.42, 0.58, 0.35, 0.65) {
  $mx = [int](($r.R - $r.L) * $fx); $my = [int](($r.B - $r.T) * $fy)
  Msg $vue3d 0x200 0 (Pos $mx $my); Start-Sleep -Milliseconds 300
  Msg $vue3d 0x201 1 (Pos $mx $my); Start-Sleep -Milliseconds 80; Msg $vue3d 0x202 0 (Pos $mx $my); Start-Sleep -Milliseconds 300
  if ((Etat) -like 'Face *' -and (Etat) -notlike '*Cylindr*' -and (Etat) -notlike '*Arrondi*') { break grille }
} }
"10. Clic sur le solide : $(Etat)"
Capture '4-face.png'
Verifie ((Etat) -like 'Face *') 'le clic devrait choisir une face'
Menu 6008
Verifie ((Etat) -like '*(face)*') 'la nouvelle esquisse sur face devrait s''ouvrir'
$vue = [U]::ParId($w, 2004)
Capture '5-esquisse-face.png'
Outil 'Cercle'
Clic (X 0.50) (Y 0.50); Souris (X 0.52) (Y 0.50); Clic (X 0.54) (Y 0.50)
Touche 0x1B
Capture '6-cercle-face.png'
Menu 5003
Touche 0x1B
Start-Sleep -Milliseconds 800
"11. Esquisse sur face enregistrée : $(Esquisses)"
Verifie ((Titre) -notlike '●*') 'tout est enregistré'
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"12. Fermeture propre, code $($p.ExitCode)"
