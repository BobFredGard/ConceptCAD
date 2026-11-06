# Outil Cote et longueur tapée, sur une COPIE de la pièce, avec les messages que Windows enverrait à la fenêtre : la vraie souris et le vrai clavier ne bougent pas.
# powershell -File natif\mesures\verifier-cotes.ps1 -Fichier <chemin.conceptcad> -Dossier <captures>
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
  public static IntPtr Enfant(IntPtr parent) {
    IntPtr r = IntPtr.Zero;
    EnumChildWindows(parent, (h, l) => { if (IsWindowVisible(h)) { r = h; return false; } return true; }, IntPtr.Zero);
    return r;
  }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, string l);
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

function Cotes { return (node -e "const f=require('fs'),z=require('zlib');let b=f.readFileSync(process.argv[1]);if(b[0]==0x1f)b=z.gunzipSync(b);const j=JSON.parse(b),d=j.doc||j,k=d.sketches.at(-1);console.log(k.dims.map(c=>c.type+(c.orient?'/'+c.orient:'')+'='+c.value+(c.ref?'(ref)':'')).join(' | '))" "$copie") }
function ClicCtrl($x, $y) { Souris $x $y; Msg $vue 0x201 9 (Pos $x $y); Start-Sleep -Milliseconds 30; Msg $vue 0x202 8 (Pos $x $y); Start-Sleep -Milliseconds 120 }
function Car($c) { Msg $vue 0x102 ([int][char]$c) ([IntPtr]1); Start-Sleep -Milliseconds 80 }
function Saisie { $h = [U]::ParId($w, 2005); return $h }

$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3

Menu 6005
$vue = [U]::ParId($w, 2004)
$r = New-Object U+RECT; [void][U]::GetWindowRect($vue, [ref]$r)
$LL = $r.R - $r.L; $HH = $r.B - $r.T
function X($f) { return [int]($LL * $f) }
function Y($f) { return [int]($HH * $f) }

# Longueur tapée : premier clic, souris vers la droite, on tape 40, Entrée
Outil 'Ligne'
Clic (X 0.30) (Y 0.30); Souris (X 0.50) (Y 0.30)
Car '4'; Car '0'
Capture '1-longueur-tapee.png'
Touche 0x0D
Verifie ((Etat) -like '*40.00 mm*') 'la longueur tapée crée la ligne de 40 mm'
"1. Longueur tapée : $(Etat)"
Touche 0x1B

# Angle tapé : la longueur vient de la souris, Tab bascule sur l'angle
Outil 'Ligne'
Clic (X 0.30) (Y 0.60); Souris (X 0.45) (Y 0.60)
Touche 0x09; Touche 0x09; Car '3'; Car '0'
Capture '2-angle-tape.png'
Touche 0x0D
Verifie ((Etat) -like '*mm cr*') 'l''angle tapé crée la ligne'
"2. Angle tapé : $(Etat)"
Touche 0x1B
Menu 5003
$c = Cotes
Verifie ($c -like 'length=40 | length=*') "chaque ligne tapée porte sa cote de longueur : $c"
"3. Enregistré : $c"

# Un cercle, à coter ensuite
Outil 'Cercle'
Clic (X 0.65) (Y 0.45); Clic (X 0.70) (Y 0.45)
Touche 0x1B
Menu 6001
Menu 6002
"4. Cercle tracé, Ctrl+Z puis Ctrl+Y"

# Outil Cote sur le cercle : clic, déplacement, clic dans le vide, la saisie s'ouvre, on tape
Outil 'Cote'
Clic (X 0.70) (Y 0.45)
Souris (X 0.80) (Y 0.30)
Capture '3-pose-diametre.png'
Clic (X 0.80) (Y 0.30)
Start-Sleep -Milliseconds 400
$s = Saisie
Verifie ($s -ne [IntPtr]::Zero) 'poser la cote ouvre sa saisie'
[void][U]::SendMessage($s, 0x000C, [IntPtr]::Zero, '30')
Msg $s 0x100 0x0D ([IntPtr]1); Msg $s 0x102 0x0D ([IntPtr]1); Msg $s 0x101 0x0D ([IntPtr]1)
Start-Sleep -Milliseconds 800
Capture '4-diametre-30.png'
"5. Diamètre posé puis tapé : $(Etat)"

# Pendant la pose, Échap retire la cote commencée, et l'outil revient à Sélection
Outil 'Cote'
Clic (X 0.65) (Y 0.45)
Clic (X 0.30) (Y 0.30)
Souris (X 0.45) (Y 0.20)
Touche 0x1B
"6. Distance commencée puis Échap : $(Etat)"
Menu 5003
$c = Cotes
Verifie ($c -notlike '*distance*') "la cote abandonnée ne doit pas rester : $c"
Verifie ($c -like '*diameter=30*') "le diamètre tapé doit être enregistré : $c"
"7. Enregistré : $c"

# Ctrl+clic sur les deux lignes : angle, pose dans le vide, chiffre tapé
Outil 'Cote'
ClicCtrl (X 0.40) (Y 0.30)
"8. Première ligne choisie : $(Etat)"
Capture '5-angle.png'
Touche 0x1B

[void]$p.CloseMainWindow()
Start-Sleep -Milliseconds 300
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"9. Fermeture propre, code $($p.ExitCode)"
