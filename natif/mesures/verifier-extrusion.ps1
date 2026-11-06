# Extrude par le menu, sur une COPIE de la pièce, avec les messages que Windows enverrait à la fenêtre : la vraie souris et le vrai clavier ne bougent pas.
# powershell -File natif\mesures\verifier-extrusion.ps1 -Fichier <chemin.conceptcad> -Dossier <captures>
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

function Fonctions { return (node -e "const f=require('fs'),z=require('zlib');let b=f.readFileSync(process.argv[1]);if(b[0]==0x1f)b=z.gunzipSync(b);const j=JSON.parse(b),d=j.doc||j;console.log(JSON.stringify(d.features.slice(-2).map(x=>[x.name,x.distance,x.op,x.mid,!!x.flip,!!x.through])),d.sketches.at(-1).visible)" "$copie") }
function Volume { $l = (Lignes | Where-Object { $_ -like '*Volume*' } | Select-Object -Last 1); if ($l -match 'Volume ([0-9.,]+)') { return $Matches[1] }; return '?' }

$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3
$v0 = Volume
"1. Pièce ouverte, volume $v0"

# Esquisse XY avec un grand rectangle (menu 6005), puis Extruder (6009)
Menu 6009
$apres = Etat
Menu 6001
Verifie ((Titre) -notlike '●*') 'annuler l''extrusion de la dernière esquisse ramène à la pièce d''origine'
"2. Ctrl+E sans rien choisir puis Ctrl+Z : $apres"

Menu 6005
$vue = [U]::ParId($w, 2004)
$r = New-Object U+RECT; [void][U]::GetWindowRect($vue, [ref]$r)
$LL = $r.R - $r.L; $HH = $r.B - $r.T
function X($f) { return [int]($LL * $f) }
function Y($f) { return [int]($HH * $f) }
Menu 6009
"3. Esquisse vide : $(Etat)"
Verifie ((Titre) -notlike '●*') 'une esquisse vide ne s''extrude pas et disparaît'
Menu 6005
$vue = [U]::ParId($w, 2004)
Outil 'Ligne'
Clic (X 0.45) (Y 0.40); Clic (X 0.55) (Y 0.40)
Touche 0x1B
Menu 6009
Verifie ((Etat) -like '*Extrusion impossible*') 'un trait seul ne donne pas de volume'
"4. Trait ouvert : $(Etat)"
Menu 6005
$vue = [U]::ParId($w, 2004)
Outil 'Rectangle'
Clic (X 0.45) (Y 0.40); Souris (X 0.50) (Y 0.45); Clic (X 0.60) (Y 0.60)
Touche 0x1B
Menu 6009
$v1 = Volume
Verifie ($v1 -ne $v0) 'l''extrusion doit changer le volume'
Verifie ((Titre) -like '●*') 'la pièce est marquée modifiée'
Capture '1-extrusion.png'
"5. Rectangle extrudé de 20 mm : volume $v1 ; $(Etat)"

# La profondeur a la main : on tape dans son champ
$g = [U]::ParId($w, 2002)
$ed = [U]::Enfant($g)
Verifie ($ed -ne [IntPtr]::Zero) 'le champ de profondeur devrait être prêt à la saisie'
[void][U]::SendMessage($ed, 0x000C, [IntPtr]::Zero, '35')
Msg $ed 0x100 0x0D ([IntPtr]1); Msg $ed 0x102 0x0D ([IntPtr]1); Msg $ed 0x101 0x0D ([IntPtr]1)
Start-Sleep -Milliseconds 1500
$v2 = Volume
Capture '2-profondeur.png'
Verifie ($v2 -ne $v1) 'la profondeur tapée doit changer le volume'
"6. Profondeur 35 : volume $v2"
Menu 6001
Verifie ((Volume) -eq $v1) 'Ctrl+Z revient à 20 mm'
Menu 6002
Verifie ((Volume) -eq $v2) 'Ctrl+Y revient à 35 mm'
"7. Ctrl+Z puis Ctrl+Y : $v1 puis $v2"

# Inverser, puis Poche : clics dans le panneau
$gr = New-Object U+RECT; [void][U]::GetWindowRect($g, [ref]$gr)
$gx = 150  # colonne des valeurs ; une ligne fait 20 points : 0 catégorie, 1 nom, 2 type, 3 esquisse, 4 opération, 5 étendue, 6 profondeur, 7 direction, 8 inverser
function Ligne($n) { return [int](20 * ($n + 0.5)) }
function ClicLigne($n) { Msg $g 0x201 1 (Pos $gx (Ligne $n)); Start-Sleep -Milliseconds 60; Msg $g 0x202 0 (Pos $gx (Ligne $n)); Start-Sleep -Milliseconds 500 }
# Une fois la ligne choisie, la case est une petite fenêtre à elle : c'est elle qui reçoit le clic
ClicLigne 8
$c = [U]::Enfant($g)
Verifie ($c -ne [IntPtr]::Zero) 'la case Inverser devrait être prête'
Msg $c 0x201 1 (Pos 8 8); Start-Sleep -Milliseconds 60; Msg $c 0x202 0 (Pos 8 8); Start-Sleep -Milliseconds 1500
Capture '4-inverse.png'
$v3 = Volume
Verifie ($v3 -ne $v2) 'inverser le sens doit changer le volume'
"8. Inverser le sens : volume $v3"
Menu 6001
Verifie ((Volume) -eq $v2) 'Ctrl+Z annule l''inversion'
# Choisir dans une liste : clic sur la ligne, puis flèche bas et Entrée dans son champ
function ChoixSuivant($n) {
  ClicLigne $n
  $e = [U]::Enfant($g)
  Verifie ($e -ne [IntPtr]::Zero) "le champ de la ligne $n devrait s'ouvrir"
  Msg $e 0x100 0x28 ([IntPtr]1); Msg $e 0x101 0x28 ([IntPtr]1); Start-Sleep -Milliseconds 300
  Msg $e 0x100 0x0D ([IntPtr]1); Msg $e 0x102 0x0D ([IntPtr]1); Msg $e 0x101 0x0D ([IntPtr]1); Start-Sleep -Milliseconds 1500
}
ChoixSuivant 4
Capture '5-poche.png'
$v4 = Volume
Verifie ($v4 -ne $v2) 'la poche doit changer le volume'
"9. Poche : volume $v4"
Menu 6001
Verifie ((Volume) -eq $v2) 'Ctrl+Z annule la poche'
"10. Ctrl+Z : volume $(Volume)"

Menu 5003
Verifie ((Titre) -notlike '●*') 'après enregistrement, plus de modification en attente'
"11. Enregistré : $(Fonctions)"
Menu 6001
"12. Ctrl+Z après enregistrement (revient à 20 mm) : $(Etat)"
Menu 6001
Verifie ((Etat) -like '*déjà enregistrée*') 'une extrusion enregistrée ne se retire pas par Ctrl+Z'
"13. $(Etat)"
Menu 6002
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"14. Fermeture propre, code $($p.ExitCode)"
