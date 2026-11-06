# Pose des contraintes au clavier et au menu, sur une COPIE de la pièce, avec les messages que Windows enverrait à la fenêtre : la vraie souris et le vrai clavier ne bougent pas.
# powershell -File natif\mesures\verifier-contraintes.ps1 -Fichier <chemin.conceptcad> -Dossier <captures>
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

function Contraintes { return (node -e "const f=require('fs'),z=require('zlib');let b=f.readFileSync(process.argv[1]);if(b[0]==0x1f)b=z.gunzipSync(b);const j=JSON.parse(b),d=j.doc||j,k=d.sketches.at(-1);console.log(k.constraints.map(c=>c.type).join(','),'/',k.entities.map(e=>e.construction?'c':'n').join(''))" "$copie") }
function ClicCtrl($x, $y) { Souris $x $y; Msg $vue 0x201 9 (Pos $x $y); Start-Sleep -Milliseconds 30; Msg $vue 0x202 8 (Pos $x $y); Start-Sleep -Milliseconds 120 }
function DeuxLignes { Clic (X 0.475) (Y 0.4025); ClicCtrl (X 0.475) (Y 0.63) }

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
Outil 'Ligne'
Clic (X 0.35) (Y 0.40); Clic (X 0.60) (Y 0.405)
Touche 0x1B
Outil 'Ligne'
Clic (X 0.35) (Y 0.58); Clic (X 0.60) (Y 0.68)
Touche 0x1B
"1. Une ligne presque horizontale, une nettement penchée"

Clic (X 0.475) (Y 0.4025)
Touche 0x71
Verifie ((Etat) -like '*H ou V*') 'F2 pose horizontal ou vertical'
"2. F2 sur la première ligne : $(Etat)"

DeuxLignes
Touche 0x74
"3. F5 sur les deux lignes : $(Etat)"
Verifie ((Etat) -like '*Contrainte posée*') 'F5 pose parallèle'

# Parallèles et l'une horizontale : perpendiculaire est impossible, l'esquisse doit revenir à son état d'avant
DeuxLignes
Menu 6015
$refus = Etat
Verifie ($refus -like '*impossible*telle quelle*') 'perpendiculaire sur deux parallèles est refusée'
"4. Perpendiculaire sur deux parallèles : $refus"

# Le refus ne laisse aucun pas à annuler : Ctrl+Z retire le parallèle, Ctrl+Y le remet
Menu 6001; Menu 6002
Menu 5003
$c = Contraintes
Verifie ($c -like 'h,parallel /*') "le fichier doit garder h et parallel, et rien du refus : $c"
"5. Après refus, Ctrl+Z et Ctrl+Y, enregistré : $c"

Clic (X 0.475) (Y 0.4025)
Msg $vue 0x104 0x79 ([IntPtr]1); Msg $vue 0x105 0x79 ([IntPtr]1); Start-Sleep -Milliseconds 400
Verifie ((Etat) -like 'Symétrie*') 'F10 doit arriver à la symétrie, pas au menu de Windows'
"6. F10 avec une seule ligne : $(Etat)"

Clic (X 0.475) (Y 0.63)
Touche 0x58
Verifie ((Etat) -like '*de construction*') 'X passe la ligne en construction'
"7. Touche X : $(Etat)"
Capture '1-construction.png'
Touche 0x58
Verifie ((Etat) -like '*normale*') 'X la remet en normal'

# Deux bouts de lignes : Ctrl+clic puis F1 les fusionne, Ctrl+Z les sépare
Clic (X 0.60) (Y 0.4025); ClicCtrl (X 0.60) (Y 0.63)
Touche 0x70
Verifie ((Etat) -like '*fusionnés*') 'F1 fusionne les deux points'
"8. F1 sur deux points : $(Etat)"
Capture '2-fusion.png'
Menu 6001
Menu 5003
"9. Ctrl+Z puis enregistré : $(Contraintes)"
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"10. Fermeture propre, code $($p.ExitCode)"
