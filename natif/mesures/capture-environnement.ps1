# Images de chaque atelier, sur une COPIE de la pièce, à la taille du relevé du navigateur (1500×900), pour les comparer côte à côte.
# powershell -File natif\mesures\capture-environnement.ps1 -Fichier <chemin.conceptcad> -Dossier <dossier des images>
param([string]$Fichier, [string]$Dossier)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Text; using System.Runtime.InteropServices; using System.Drawing;
public static class U {
  public delegate bool Rappel(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int l, int t, uint f);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, Rappel f, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static IntPtr ParNom(IntPtr parent, string nom) {
    IntPtr trouve = IntPtr.Zero;
    EnumChildWindows(parent, (h, l) => { var s = new StringBuilder(200); GetWindowText(h, s, 200); if (s.ToString() == nom) { trouve = h; return false; } return true; }, IntPtr.Zero);
    return trouve;
  }
  public static void Clic(IntPtr h) { SendMessage(h, 0x201, (IntPtr)1, (IntPtr)0x00050005); SendMessage(h, 0x202, IntPtr.Zero, (IntPtr)0x00050005); }
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
New-Item -ItemType Directory -Force $Dossier | Out-Null
$exe = Join-Path $PSScriptRoot '..\sortie\ConceptCADNatif.exe'
$travail = Join-Path $env:TEMP ('capture-env-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force $travail | Out-Null
$copie = Join-Path $travail 'copie.conceptcad'
Copy-Item -LiteralPath $Fichier $copie -Force
$env:CONCEPTCAD_SANS_ACTIVER = '1'
Remove-Item Env:CONCEPTCAD_OUVRIR_ESQUISSE -ErrorAction SilentlyContinue
$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
try {
  for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
  $w = $p.MainWindowHandle
  if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
  Start-Sleep -Seconds 3
  [void][U]::SetWindowPos($w, [IntPtr]::Zero, 20, 20, 1516, 939, 0x14)
  Start-Sleep -Seconds 1
  [U]::Image($w, (Join-Path $Dossier 'cao.png'))
  foreach ($a in 'FAO', 'PLAN', 'RENDU', 'CAO') {
    $b = [U]::ParNom($w, $a)
    if ($b -eq [IntPtr]::Zero) { throw "bouton $a introuvable" }
    [U]::Clic($b)
    Start-Sleep -Milliseconds 800
    if ($a -ne 'CAO') { [U]::Image($w, (Join-Path $Dossier ($a.ToLower() + '.png'))) }
  }
  "ok $Dossier"
} finally {
  $p.Kill()
  Start-Sleep -Milliseconds 300
  Remove-Item -LiteralPath $travail -Recurse -Force -ErrorAction SilentlyContinue
}
