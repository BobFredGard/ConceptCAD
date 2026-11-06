# Vérifie le parcours réel du .exe comme le ferait une personne : clavier et souris, vraie fenêtre de choix de fichier.
# powershell -File natif\mesures\verifier-fenetre.ps1 -Fichier <chemin.conceptcad> -Cote 25 -Dossier <captures>
param([string]$Fichier, [string]$Cote = '25', [string]$Dossier, [int]$LigneCote = 92, [int]$AreteX = 1172, [int]$AreteY = 486)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static IntPtr Dialogue(uint pid) {
    IntPtr trouve = IntPtr.Zero;
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); var c = new StringBuilder(64); GetClassName(h, c, 64);
      if (p == pid && IsWindowVisible(h) && c.ToString() == "#32770") { trouve = h; return false; } return true; }, IntPtr.Zero);
    return trouve;
  }
  public static string Texte(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
}
'@
[void][U]::SetProcessDPIAware()
$exe = Join-Path $PSScriptRoot '..\sortie\ConceptCADNatif.exe'
New-Item -ItemType Directory -Force $Dossier | Out-Null
$Fichier = (Resolve-Path $Fichier).Path
if ($Fichier -like '*\Exemples\*') { throw 'ce script enregistre dans le fichier : lui donner une copie, jamais une pièce de Exemples' }

function Devant($h) { [U]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [U]::keybd_event(0x12, 0, 2, [IntPtr]::Zero); [void][U]::ShowWindow($h, 9); [void][U]::SetForegroundWindow($h); Start-Sleep -Milliseconds 300 }
function Capture($h, $nom) {
  $r = New-Object U+RECT; [void][U]::GetWindowRect($h, [ref]$r)
  $b = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($r.L, $r.T, 0, 0, $b.Size); $g.Dispose()
  $p = Join-Path $Dossier $nom; $b.Save($p, [Drawing.Imaging.ImageFormat]::Png)
  $ms = New-Object IO.MemoryStream; $b.Save($ms, [Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose()
  return [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($ms.ToArray()))
}
# Jamais de touche ni de clic si une autre fenêtre est devant : ils partiraient chez elle.
$script:cible = [IntPtr]::Zero
function Garde { if ($script:cible -ne [IntPtr]::Zero -and [U]::GetForegroundWindow() -ne $script:cible) { if ($p -and -not $p.HasExited) { $p.Kill() }; throw 'une autre fenêtre est passée devant : arrêt, rien envoyé' } }
function Touches($k) { Garde; [Windows.Forms.SendKeys]::SendWait($k) }
function Clic($x, $y) { Garde; [void][U]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 80; [U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 120 }
function Echapper($t) { return ($t -replace '([+^%~(){}\[\]])', '{$1}') }

$journalEtat = Join-Path $Dossier 'etat.txt'
Remove-Item $journalEtat -ErrorAction SilentlyContinue
$env:CONCEPTCAD_JOURNAL_ETAT = (Join-Path (Resolve-Path $Dossier).Path 'etat.txt')
function Etat { Start-Sleep -Milliseconds 100; return (Get-Content $env:CONCEPTCAD_JOURNAL_ETAT -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -Last 1) }
function Rect($id) { $r = New-Object U+RECT; [void][U]::GetWindowRect([U]::GetDlgItem($w, $id), [ref]$r); return $r }
function CentreVue { $a = Rect 2001; $e = Rect 2003; $f = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$f); return @([int](($a.R + $f.R) / 2), [int](($a.T + $e.T) / 2)) }

$p = Start-Process $exe -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 1
Devant $w
$script:cible = $w
Touches '{ESC}'  # Alt, utilisé pour passer devant, a activé le menu
"1. Fenêtre ouverte : '$([U]::Texte($w))'"
"   Etat : $(Etat)"
[void](Capture $w '0-vide.png')
Touches '^o'
$d = [IntPtr]::Zero
for ($i = 0; $i -lt 50 -and $d -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 100; $d = [U]::Dialogue([uint32]$p.Id) }
if ($d -eq [IntPtr]::Zero) { $p.Kill(); throw 'la fenêtre de choix de fichier n''apparaît pas' }
"2. Fenêtre Windows de choix de fichier : '$([U]::Texte($d))'"
Start-Sleep -Milliseconds 500
Devant $d
$script:cible = $d
Start-Sleep -Milliseconds 800
Touches '^a'
Start-Sleep -Milliseconds 200
Touches (Echapper $Fichier)
Start-Sleep -Milliseconds 300
Touches '{ENTER}'
for ($i = 0; $i -lt 100 -and ([U]::Texte($w) -eq 'ConceptCAD natif'); $i++) { Start-Sleep -Milliseconds 100 }
Start-Sleep -Seconds 1
"3. Pièce ouverte : '$([U]::Texte($w))'"
"   Etat : $(Etat)"
Devant $w
$script:cible = $w
Touches '{ESC}'
$avant = Capture $w '1-piece-ouverte.png'

$c = CentreVue
$c[0] += 150  # un point sur la pièce du Drapeau, pas sur le fond
[void][U]::SetCursorPos($c[0], $c[1] + 20); Start-Sleep -Milliseconds 700
$survol = Capture $w '2-survol.png'
"4. Survol d'une face : image changée = $($avant -ne $survol)"
Clic $c[0] ($c[1] + 20)
Start-Sleep -Milliseconds 400
"5. Clic sur la pièce :"
"   Etat : $(Etat)"
[void](Capture $w '3-face-choisie.png')
$f = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$f)
Clic ($f.L + $AreteX) ($f.T + $AreteY)
Start-Sleep -Milliseconds 400
"   Clic sur une arête : $(Etat)"
[void](Capture $w '3b-arete-choisie.png')

$a = Rect 2001
Clic ($a.L + 70) ($a.T + 12)
Touches '{DOWN}{DOWN}{DOWN}{DOWN}'  # après le dossier Esquisses déplié, ses 2 esquisses et Corps 1
Start-Sleep -Milliseconds 400
"6. Fonction choisie dans l'arbre (voir capture)"
[void](Capture $w '4-fonction.png')

$g = Rect 2002
Clic ([int]($g.L + ($g.R - $g.L) * 0.75)) ($g.T + $LigneCote)
Start-Sleep -Milliseconds 200
Touches '^a'
Start-Sleep -Milliseconds 100
Touches $Cote
Touches '{ENTER}'
Start-Sleep -Seconds 1
"7. Cote passée à $Cote mm dans le panneau :"
"   Etat : $(Etat)"
[void](Capture $w '5-apres-cote.png')

Clic ($c[0]) (Rect 2003).T
Touches '^z'
Start-Sleep -Seconds 1
"8. Ctrl+Z :"
"   Etat : $(Etat)"
Touches '^y'
Start-Sleep -Seconds 1
"   Ctrl+Y : $(Etat)"
$av = Capture $w '6-avant-rotation.png'

Garde
[void][U]::SetCursorPos($c[0], $c[1]); Start-Sleep -Milliseconds 100
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero)
for ($k = 1; $k -le 20; $k++) { [void][U]::SetCursorPos($c[0] + 12 * $k, $c[1] + 5 * $k); Start-Sleep -Milliseconds 25 }
[U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 500
$ap = Capture $w '7-apres-rotation.png'
"9. Rotation à la souris : image changée = $($av -ne $ap)"
Garde
[U]::mouse_event(8, 0, 0, 0, [IntPtr]::Zero)
for ($k = 1; $k -le 10; $k++) { [void][U]::SetCursorPos($c[0] + 240 - 8 * $k, $c[1] + 100 - 6 * $k); Start-Sleep -Milliseconds 25 }
[U]::mouse_event(0x10, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 400
$ad = Capture $w '8-apres-deplacement.png'
"   Déplacement (clic droit) : image changée = $($ap -ne $ad)"
Garde
[U]::mouse_event(0x0800, 0, 0, 240, [IntPtr]::Zero)
Start-Sleep -Milliseconds 400
$az = Capture $w '9-apres-zoom.png'
"   Zoom (molette) : image changée = $($ad -ne $az)"
"10. Pièce modifiée, titre : '$([U]::Texte($w))'"
Touches '^s'
Start-Sleep -Seconds 1
"    Ctrl+S : $(Etat)"
"    Titre : '$([U]::Texte($w))' ; copie .bak présente : $(Test-Path ($Fichier + '.bak'))"
Touches '^z'
Start-Sleep -Seconds 1
"11. Ctrl+Z, de nouveau à enregistrer, titre : '$([U]::Texte($w))'"
function DemanderFermeture {
  [void][U]::PostMessage($w, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
  $q = [IntPtr]::Zero
  for ($i = 0; $i -lt 30 -and $q -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 100; $q = [U]::Dialogue([uint32]$p.Id) }
  if ($q -eq [IntPtr]::Zero) { throw 'pas de question avant de fermer une pièce modifiée' }
  Start-Sleep -Milliseconds 400
  $script:cible = $q
  Garde
}
DemanderFermeture
Touches '{ESC}'
Start-Sleep -Seconds 1
"12. Fermeture demandée, puis Annuler : fenêtre toujours ouverte = $(-not $p.HasExited)"
$script:cible = $w
DemanderFermeture
Touches '{TAB}{ENTER}'
Start-Sleep -Seconds 2
"13. Fermeture, Ne pas enregistrer : $($p.HasExited)"
if (-not $p.HasExited) { $p.Kill() }
$v = Join-Path $Dossier 'relu.json'
Start-Process $exe -ArgumentList '--verif', "`"$Fichier`"", "`"$v`"" -Wait
"14. Fichier relu après fermeture : $((Get-Content $v -Raw) -replace '.*"volume":([0-9.]+).*', '$1') mm³ (attendu : celui de la cote à $Cote mm)"
