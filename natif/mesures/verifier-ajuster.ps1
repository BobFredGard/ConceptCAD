# Ajuster et Décaler, sur une COPIE de la pièce, avec les messages que Windows enverrait à la fenêtre : la vraie souris et le vrai clavier ne bougent pas.
# powershell -File natif\mesures\verifier-ajuster.ps1 -Fichier <chemin.conceptcad> -Dossier <captures>
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

function Comptes { return (node -e "const f=require('fs'),z=require('zlib');let b=f.readFileSync(process.argv[1]);if(b[0]==0x1f)b=z.gunzipSync(b);const j=JSON.parse(b),d=j.doc||j,k=d.sketches.at(-1),n=x=>k.entities.filter(e=>e.t==x).length;console.log('lignes='+n('line')+' cercles='+n('circle')+' arcs='+n('arc')+' cotes='+k.dims.map(c=>c.type).join(','))" "$copie") }
function ClicCtrl($x, $y) { Souris $x $y; Msg $vue 0x201 9 (Pos $x $y); Start-Sleep -Milliseconds 30; Msg $vue 0x202 8 (Pos $x $y); Start-Sleep -Milliseconds 120 }

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

# Une croix de deux lignes
Outil 'Ligne'
Clic (X 0.15) (Y 0.25); Clic (X 0.55) (Y 0.25); Touche 0x1B
Outil 'Ligne'
Clic (X 0.35) (Y 0.10); Clic (X 0.35) (Y 0.40); Touche 0x1B
Menu 5003
$c = Comptes
Verifie ($c -like 'lignes=2 *') "la croix fait deux lignes : $c"
"1. Croix : $c"

# Ajuster : le bras droit part, et la ligne croisée est partagée en deux au point de coupe, comme dans le navigateur
Outil 'Ajuster'
Clic (X 0.48) (Y 0.25)
Verifie ((Etat) -like '*Ligne ajust*') "le bras est retiré : $(Etat)"
"2. Ajuster : $(Etat)"
Capture '1-ajuster-ligne.png'
Menu 6001
Menu 6002
Menu 5003
$c = Comptes
Verifie ($c -like 'lignes=3 *') "trois lignes après Ctrl+Z et Ctrl+Y : $c"
"3. Annuler, rétablir, enregistrer : $c"

# Un cercle coupé par deux lignes, enregistré entier : le fichier le connaît comme cercle
Touche 0x1B
Outil 'Cercle'
Clic (X 0.75) (Y 0.30); Clic (X 0.85) (Y 0.30); Touche 0x1B
Outil 'Ligne'
Clic (X 0.60) (Y 0.22); Clic (X 0.90) (Y 0.22); Touche 0x1B
Outil 'Ligne'
Clic (X 0.60) (Y 0.38); Clic (X 0.90) (Y 0.38); Touche 0x1B
Menu 5003
$c = Comptes
Verifie ($c -like '* cercles=1 arcs=0 *') "le cercle est entier : $c"
"4. Cercle enregistré : $c"

# La touche T prend Ajuster. Le cercle devient un arc, et cet arc s'enregistre sur l'ancien cercle
Touche 0x54
Clic (X 0.85) (Y 0.30)
Verifie ((Etat) -like '*Cercle ajust*') "le cercle devient un arc : $(Etat)"
"5. Ajuster le cercle : $(Etat)"
Capture '2-ajuster-cercle.png'
Menu 5003
$c = Comptes
Verifie ($c -like '* cercles=0 arcs=1 *') "l'arc est enregistré : $c"
"6. Enregistré : $c"
Touche 0x1B

# Décaler sans rien choisir : un message, rien de créé
Outil 'Décaler'
Clic (X 0.20) (Y 0.75)
Verifie ((Etat) -like '*lectionnez*') "il faut d'abord choisir : $(Etat)"
"7. Rien de choisi : $(Etat)"
Touche 0x1B

# Un rectangle choisi en entier, décalé vers l'extérieur
Outil 'Rectangle'
Clic (X 0.20) (Y 0.60); Clic (X 0.40) (Y 0.80)
Outil 'Sélection'
Clic (X 0.30) (Y 0.60)
ClicCtrl (X 0.40) (Y 0.70)
ClicCtrl (X 0.30) (Y 0.80)
ClicCtrl (X 0.20) (Y 0.70)
Touche 0x4F
Clic (X 0.60) (Y 0.70)
"8. Armé : $(Etat)"
Capture '3-decaler-arme.png'
Souris (X 0.46) (Y 0.70)
"9. Distance vivante : $(Etat)"
Verifie ((Etat) -like '*mm*') "la distance suit la souris : $(Etat)"
Clic (X 0.46) (Y 0.70)
Verifie ((Etat) -like '*4 copi*') "quatre copies : $(Etat)"
"10. Décalé : $(Etat)"
Capture '4-decaler-rectangle.png'
Menu 5003
$c = Comptes
Verifie ($c -like '*gap*') "une cote d'écart pour la chaîne : $c"
"11. Enregistré : $c"

# Échap abandonne un décalage armé : rien de créé
$avant = Comptes
Outil 'Sélection'
Clic (X 0.30) (Y 0.60)
Outil 'Décaler'
Clic (X 0.60) (Y 0.70)
Touche 0x1B
Menu 5003
$c = Comptes
Verifie ($c -eq $avant) "Échap ne crée rien : $c"
"12. Échap : $c"

[void]$p.CloseMainWindow()
Start-Sleep -Milliseconds 300
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"13. Fermeture propre, code $($p.ExitCode)"
