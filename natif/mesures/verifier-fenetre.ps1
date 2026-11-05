# Vérifie le parcours réel du .exe comme le ferait une personne : clavier et souris, vraie fenêtre de choix de fichier.
# powershell -File natif\mesures\verifier-fenetre.ps1 -Fichier <chemin.conceptcad> -Cote 25 -Dossier <captures>
param([string]$Fichier, [string]$Cote = '25', [string]$Dossier)
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

function Devant($h) { [U]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [U]::keybd_event(0x12, 0, 2, [IntPtr]::Zero); [void][U]::ShowWindow($h, 9); [void][U]::SetForegroundWindow($h); Start-Sleep -Milliseconds 300 }
function Capture($h, $nom) {
  $r = New-Object U+RECT; [void][U]::GetWindowRect($h, [ref]$r)
  $b = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($r.L, $r.T, 0, 0, $b.Size); $g.Dispose()
  $p = Join-Path $Dossier $nom; $b.Save($p, [Drawing.Imaging.ImageFormat]::Png)
  $ms = New-Object IO.MemoryStream; $b.Save($ms, [Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose()
  return [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($ms.ToArray()))
}
function Clic($x, $y) { [void][U]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 80; [U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 120 }
function Echapper($t) { return ($t -replace '([+^%~(){}\[\]])', '{$1}') }

$p = Start-Process $exe -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 1
Devant $w
"1. Fenêtre ouverte : '$([U]::Texte($w))'"
"   Etat : $([U]::Texte([U]::GetDlgItem($w, 106)))"
$b = New-Object U+RECT; [void][U]::GetWindowRect([U]::GetDlgItem($w, 106), [ref]$b)
$v = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$v)
Clic ([int](($v.L + $v.R) / 2)) ([int](($v.T + $b.T) / 2))  # un clic dans la vue : le logiciel prend le clavier
[Windows.Forms.SendKeys]::SendWait('^o')
$d = [IntPtr]::Zero
for ($i = 0; $i -lt 30 -and $d -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 100; $d = [U]::Dialogue([uint32]$p.Id) }
if ($d -eq [IntPtr]::Zero) {
  "   Ctrl+O sans effet : essai du bouton Ouvrir"
  [void][U]::GetWindowRect([U]::GetDlgItem($w, 101), [ref]$b)
  Clic ([int](($b.L + $b.R) / 2)) ([int](($b.T + $b.B) / 2))
  for ($i = 0; $i -lt 50 -and $d -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 100; $d = [U]::Dialogue([uint32]$p.Id) }
}
if ($d -eq [IntPtr]::Zero) { $p.Kill(); throw 'la fenêtre de choix de fichier n''apparaît pas' }
"2. Fenêtre Windows de choix de fichier : '$([U]::Texte($d))'"
Start-Sleep -Milliseconds 500
[void](Capture $d '1-choix-fichier.png')
Devant $d
Start-Sleep -Milliseconds 800
[Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 200
[Windows.Forms.SendKeys]::SendWait((Echapper $Fichier))
Start-Sleep -Milliseconds 300
[Windows.Forms.SendKeys]::SendWait('{ENTER}')
for ($i = 0; $i -lt 100 -and ([U]::Texte($w) -eq 'ConceptCAD natif'); $i++) { Start-Sleep -Milliseconds 100 }
Start-Sleep -Seconds 1
"3. Pièce ouverte : '$([U]::Texte($w))'"
"   Etat : $([U]::Texte([U]::GetDlgItem($w, 106)))"
Devant $w
$avant = Capture $w '2-piece-ouverte.png'

$r = New-Object U+RECT; [void][U]::GetWindowRect([U]::GetDlgItem($w, 106), [ref]$r)
$v = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$v)
$cx = [int](($v.L + $v.R) / 2); $cy = [int](($v.T + $r.T) / 2)
[void][U]::SetCursorPos($cx, $cy); Start-Sleep -Milliseconds 100
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero)
for ($k = 1; $k -le 20; $k++) { [void][U]::SetCursorPos($cx + 12 * $k, $cy + 5 * $k); Start-Sleep -Milliseconds 25 }
[U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 500
$tourne = Capture $w '3-apres-rotation.png'
"4. Rotation à la souris : image changée = $($avant -ne $tourne)"

[void][U]::GetWindowRect([U]::GetDlgItem($w, 103), [ref]$r)
Clic ([int](($r.L + $r.R) / 2)) ([int](($r.T + $r.B) / 2))
[Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 100
[Windows.Forms.SendKeys]::SendWait($Cote)
[void][U]::GetWindowRect([U]::GetDlgItem($w, 104), [ref]$r)
Clic ([int](($r.L + $r.R) / 2)) ([int](($r.T + $r.B) / 2))
Start-Sleep -Seconds 1
"5. Cote passée à $Cote mm, bouton Recalculer :"
"   Etat : $([U]::Texte([U]::GetDlgItem($w, 106)))"
$modif = Capture $w '4-apres-cote.png'
"   image changée = $($tourne -ne $modif)"
[void][U]::PostMessage($w, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
Start-Sleep -Seconds 1
"6. Fermeture propre : $($p.HasExited)"
if (-not $p.HasExited) { $p.Kill() }
