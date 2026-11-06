# Image de l'écran d'esquisse, sur une COPIE de la pièce, à la taille du relevé du navigateur (1500×900), pour les comparer côte à côte.
# powershell -File natif\mesures\capture-interface.ps1 -Fichier <chemin.conceptcad> -Sortie <image.png> [-Esquisse 0]
param([string]$Fichier, [string]$Sortie, [int]$Esquisse = 0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Runtime.InteropServices; using System.Drawing;
public static class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int l, int t, uint f);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
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
$dossier = Join-Path $env:TEMP ('capture-interface-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force $dossier | Out-Null
$copie = Join-Path $dossier 'copie.conceptcad'
Copy-Item -LiteralPath $Fichier $copie -Force
$env:CONCEPTCAD_SANS_ACTIVER = '1'
$env:CONCEPTCAD_OUVRIR_ESQUISSE = "$Esquisse"
$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 4
[void][U]::SetWindowPos($w, [IntPtr]::Zero, 20, 20, 1516, 980, 0x14)
Start-Sleep -Seconds 1
[U]::Image($w, $Sortie)
$p.Kill()
Remove-Item -LiteralPath $dossier -Recurse -Force -ErrorAction SilentlyContinue
"ok $Sortie"
