# Dessine dans une esquisse par les messages de souris et de clavier que Windows enverrait à la fenêtre, sur une COPIE de la pièce.
# Rien ne passe par la vraie souris ni le vrai clavier : la personne devant le PC peut continuer à travailler.
# powershell -File natif\mesures\verifier-dessin.ps1 -Fichier <chemin.conceptcad> -Dossier <captures> [-Rang 0]
param([string]$Fichier, [string]$Dossier, [int]$Rang = 0)
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
$env:CONCEPTCAD_SANS_ACTIVER = '1'; $env:CONCEPTCAD_OUVRIR_ESQUISSE = "$Rang"
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

$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3
"1. Pièce ouverte : $(Etat)"
Start-Sleep -Milliseconds 800
Verifie ((Etat) -like '*Outils en haut*') 'l''esquisse devrait être modifiable'
$vue = [U]::ParId($w, 2004)
Capture '1-esquisse.png'
"2. Esquisse ouverte, barre d'outils visible"

# Une marge libre à droite : le cadrage laisse 15 % de chaque côté
$r = New-Object U+RECT; [void][U]::GetWindowRect($vue, [ref]$r)
$LL = $r.R - $r.L; $HH = $r.B - $r.T
function X($f) { return [int]($LL * $f) }
function Y($f) { return [int]($HH * $f) }

Outil 'Rectangle'
Clic (X 0.88) (Y 0.15); Souris (X 0.92) (Y 0.20); Capture '2-rectangle-brouillon.png'; Clic (X 0.97) (Y 0.27)
Start-Sleep -Milliseconds 200
Verifie ((Titre) -like '●*') 'le rectangle devrait marquer la pièce comme modifiée'
"3. Rectangle : $(Etat) ; titre : $(Titre)"

Outil 'Ligne'
Clic (X 0.88) (Y 0.35); Souris (X 0.93) (Y 0.36); Clic (X 0.97) (Y 0.35); Souris (X 0.97) (Y 0.40); Clic (X 0.97) (Y 0.45); Capture '3-lignes.png'
ClicDroit (X 0.97) (Y 0.45)
Touche 0x1B
Verifie ((Etat) -like 'Sélection*') 'Échap devrait revenir à l''outil Sélection sans quitter l''esquisse'
"4. Deux lignes, clic droit pour finir, Échap : on reste dans l'esquisse"

Outil 'Cercle'
Clic (X 0.92) (Y 0.60); Souris (X 0.95) (Y 0.60); Clic (X 0.97) (Y 0.60)
Touche 0x1B
Outil 'Arc'
Clic (X 0.92) (Y 0.80); Clic (X 0.97) (Y 0.80); Souris (X 0.95) (Y 0.72); Clic (X 0.92) (Y 0.72)
Touche 0x1B
Capture '4-cercle-arc.png'
"5. Cercle et arc posés"

# Glisser le coin du rectangle
Glisse (X 0.97) (Y 0.27) (X 0.99) (Y 0.29)
Capture '5-coin-glisse.png'
"6. Coin glissé"

# Le cercle : choisi puis effacé, puis Ctrl+Z, puis Ctrl+Y, puis Ctrl+Z
Clic (X 0.97) (Y 0.60)
Capture '6-choisi.png'
Touche 0x2E
Capture '7-efface.png'
Menu 6000
Capture '8-annule.png'
Menu 6001
Menu 6000
"7. Effacé, annulé, rétabli, annulé : $(Etat)"

# Coter une ligne par double-clic
Double (X 0.93) (Y 0.35)
Capture '9-cote.png'
"8. Double-clic sur une ligne : $(Etat)"

Menu 5003
Capture '10-enregistre.png'
"9. Enregistrer : $(Etat) ; titre : $(Titre) ; copie de secours : $(Test-Path "$copie.bak")"
Verifie ((Titre) -notlike '●*') 'après enregistrement, plus de modification en attente'
Touche 0x1B
Start-Sleep -Milliseconds 1500
Capture '11-piece.png'
"10. Échap : retour à la pièce : $(Etat)"
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"11. Fermeture propre, code $($p.ExitCode), sans question : rien n'est resté à enregistrer"
