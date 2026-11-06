# Vérifie la vue d'esquisse comme le ferait une personne : vrai clavier et vraie souris.
# powershell -File natif\mesures\verifier-esquisse.ps1 -Fichier <chemin.conceptcad> -Dossier <captures>
param([string]$Fichier, [string]$Dossier)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
'@
[void][U]::SetProcessDPIAware()
$exe = Join-Path $PSScriptRoot '..\sortie\ConceptCADNatif.exe'
New-Item -ItemType Directory -Force $Dossier | Out-Null
$Fichier = (Resolve-Path $Fichier).Path
$env:CONCEPTCAD_JOURNAL_ETAT = Join-Path (Resolve-Path $Dossier).Path 'etat.txt'
Remove-Item $env:CONCEPTCAD_JOURNAL_ETAT -ErrorAction SilentlyContinue

function Capture($nom) {
  $r = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$r)
  $b = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($r.L, $r.T, 0, 0, $b.Size); $g.Dispose()
  $b.Save((Join-Path $Dossier $nom), [Drawing.Imaging.ImageFormat]::Png)
  # Empreinte de la seule zone à droite de l'arbre : la surbrillance de l'arbre change avec le focus
  $m = 320; $zone = $b.Clone((New-Object Drawing.Rectangle $m, 0, ($b.Width - $m), $b.Height), $b.PixelFormat)
  $ms = New-Object IO.MemoryStream; $zone.Save($ms, [Drawing.Imaging.ImageFormat]::Bmp); $zone.Dispose(); $b.Dispose()
  return [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($ms.ToArray()))
}
# Jamais de touche ni de clic si une autre fenêtre est devant : ils partiraient chez elle.
function Garde { if ([U]::GetForegroundWindow() -ne $w) { if (-not $p.HasExited) { $p.Kill() }; $q = 0; [void][U]::GetWindowThreadProcessId([U]::GetForegroundWindow(), [ref]$q); throw "une autre fenêtre est passée devant ($((Get-Process -Id $q -ErrorAction SilentlyContinue).ProcessName)) : arrêt, rien envoyé" } }
function Touches($k) { Garde; [Windows.Forms.SendKeys]::SendWait($k); Start-Sleep -Milliseconds 200 }
function Souris($x, $y) { Garde; [void][U]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 80 }
function Etat { Start-Sleep -Milliseconds 150; return (Get-Content $env:CONCEPTCAD_JOURNAL_ETAT -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -Last 1) }
function Rect($id) { $r = New-Object U+RECT; [void][U]::GetWindowRect([U]::GetDlgItem($w, $id), [ref]$r); return $r }
function Prive { Start-Sleep -Seconds 2; $q = Get-CimInstance Win32_PerfRawData_PerfProc_Process -Filter "IDProcess=$($p.Id)"; return [math]::Round($q.WorkingSetPrivate / 1MB, 1) }
function Double($x, $y) { Souris $x $y; foreach ($n in 1, 2) { [U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 40; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60 }; Start-Sleep -Milliseconds 400 }

$p = Start-Process $exe -ArgumentList "`"$Fichier`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3
[U]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [U]::keybd_event(0x12, 0, 2, [IntPtr]::Zero); [void][U]::ShowWindow($w, 9); [void][U]::SetForegroundWindow($w); Start-Sleep -Milliseconds 300
Touches '{ESC}'
"1. Pièce ouverte, mémoire au repos : $(Prive) Mo"
$a = Rect 2001
Souris ($a.L + 60) ($a.T + 12)
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 200
Touches '{HOME}'
$h3d = Capture '1-piece.png'
Double ($a.L + 70) ($a.T + 27)
if ((Etat) -notlike '*lecture seule*') { $p.Kill(); throw 'le double-clic n''ouvre pas l''esquisse' }
"2. Double-clic dans l'arbre : $(Etat)"
Start-Sleep -Milliseconds 500
$h0 = Capture '2-esquisse.png'
"   Vue changée : $($h0 -ne $h3d) ; mémoire : $(Prive) Mo"
$e = Rect 2003; $f = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$f)
$cx = [int](($a.R + $f.R) / 2); $cy = [int](($a.T + $e.T) / 2)
Souris $cx $cy
[U]::mouse_event(0x0800, 0, 0, 240, [IntPtr]::Zero); Start-Sleep -Milliseconds 400
$h1 = Capture '3-zoom.png'
"3. Molette (zoom) : image changée = $($h1 -ne $h0)"
[U]::mouse_event(8, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60
Souris ($cx + 120) ($cy + 70)
[U]::mouse_event(16, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 400
$h2 = Capture '4-deplacement.png'
"4. Clic droit glissé (déplacement) : image changée = $($h2 -ne $h1)"
Touches '^f'; Start-Sleep -Milliseconds 300
$h3 = Capture '5-ajuste.png'
"5. Ctrl+F (ajuster) : retour à l'image de départ = $($h3 -eq $h0)"
Touches '{ESC}'; Start-Sleep -Milliseconds 500
"6. Échap : $(Etat)"
$h4 = Capture '6-retour-3d.png'
"   Retour à la pièce : $($h4 -ne $h3)"
Souris ($a.L + 60) ($a.T + 12)
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 200
Touches '{HOME}'; Touches '{DOWN}'; Touches '{ENTER}'
if ((Etat) -notlike '*lecture seule*') { $p.Kill(); throw 'Entrée n''ouvre pas l''esquisse' }
"7. Entrée dans l'arbre : esquisse rouverte"
Start-Sleep -Milliseconds 400
# Bouton « Terminer l'esquisse » en haut à gauche de la vue
$x = $a.R + 60; $y = $a.T + 8
Souris $x $y
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 500
"8. Bouton Terminer : $(Etat)"
Garde
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"9. Fermeture propre, code $($p.ExitCode)"
