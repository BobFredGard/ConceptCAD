# Essaie l'environnement dans la vraie fenêtre, sur une COPIE de la pièce : boutons repris et boutons grisés, arbre, fil, cube, ateliers.
# powershell -File natif\mesures\verifier-environnement.ps1 -Fichier <chemin.conceptcad> -Dossier <dossier des images>
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
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, Rappel f, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static IntPtr ParNom(IntPtr parent, string nom) {
    IntPtr t = IntPtr.Zero;
    EnumChildWindows(parent, (h, l) => { var s = new StringBuilder(200); GetWindowText(h, s, 200); if (s.ToString() == nom) { t = h; return false; } return true; }, IntPtr.Zero);
    return t;
  }
  public static IntPtr ParId(IntPtr parent, int id) {
    IntPtr t = IntPtr.Zero;
    EnumChildWindows(parent, (h, l) => { if (GetDlgCtrlID(h) == id) { t = h; return false; } return true; }, IntPtr.Zero);
    return t;
  }
  public static string Image(IntPtr h, string chemin) {
    RECT r; GetWindowRect(h, out r);
    using (var b = new Bitmap(r.R - r.L, r.B - r.T)) {
      using (var g = Graphics.FromImage(b)) { IntPtr dc = g.GetHdc(); PrintWindow(h, dc, 2); g.ReleaseHdc(dc); }
      b.Save(chemin, System.Drawing.Imaging.ImageFormat.Png);
    }
    using (var s = System.Security.Cryptography.MD5.Create()) return Convert.ToBase64String(s.ComputeHash(System.IO.File.ReadAllBytes(chemin)));
  }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
'@
[void][U]::SetProcessDPIAware()
New-Item -ItemType Directory -Force $Dossier | Out-Null
$exe = Join-Path $PSScriptRoot '..\sortie\ConceptCADNatif.exe'
$copie = Join-Path $Dossier 'copie.conceptcad'
Copy-Item -LiteralPath $Fichier $copie -Force
$env:CONCEPTCAD_JOURNAL_ETAT = Join-Path $Dossier 'etat.txt'
$env:CONCEPTCAD_SANS_ACTIVER = '1'
Remove-Item Env:CONCEPTCAD_OUVRIR_ESQUISSE -ErrorAction SilentlyContinue
Remove-Item $env:CONCEPTCAD_JOURNAL_ETAT -ErrorAction SilentlyContinue

function Pos($x, $y) { return [IntPtr](([int]$y -shl 16) -bor ([int]$x -band 0xffff)) }
function Msg($h, $m, $a, $l) { [void][U]::PostMessage($h, $m, [IntPtr]$a, $l) }
function Clic($h, $x = 5, $y = 5) { Msg $h 0x201 1 (Pos $x $y); Start-Sleep -Milliseconds 30; Msg $h 0x202 0 (Pos $x $y); Start-Sleep -Milliseconds 300 }
function Double($h, $x, $y) { Msg $h 0x201 1 (Pos $x $y); Msg $h 0x202 0 (Pos $x $y); Msg $h 0x203 1 (Pos $x $y); Msg $h 0x202 0 (Pos $x $y); Start-Sleep -Milliseconds 700 }
function Bouton($nom) { $h = [U]::ParNom($w, $nom); if ($h -eq [IntPtr]::Zero) { Stoppe "bouton $nom introuvable" }; return $h }
function Etat { Start-Sleep -Milliseconds 200; return (Get-Content $env:CONCEPTCAD_JOURNAL_ETAT -Encoding UTF8 -ErrorAction SilentlyContinue | Where-Object { $_ -notlike 'cote *' } | Select-Object -Last 1) }
function Stoppe($quoi) { [void][U]::Image($w, (Join-Path $Dossier 'echec.png')); if (-not $p.HasExited) { $p.Kill() }; throw "ÉCHEC : $quoi (état : $(Etat))" }
function Verifie($ok, $quoi) { if (-not $ok) { Stoppe $quoi } }
function Visible($h) { return [U]::IsWindowVisible($h) }
function Image($nom) { Start-Sleep -Milliseconds 250; return [U]::Image($w, (Join-Path $Dossier $nom)) }

$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3
[void][U]::SetWindowPos($w, [IntPtr]::Zero, 20, 20, 1516, 939, 0x14)
Start-Sleep -Milliseconds 600
$arbre = [U]::ParId($w, 2001); $vue = [U]::ParId($w, 2005); $fil = [U]::ParId($w, 2007)
Verifie ($arbre -ne [IntPtr]::Zero -and $fil -ne [IntPtr]::Zero) 'arbre et fil présents'
"1. Ouverte : $(Etat)"

# Un bouton grisé se dit tel, et ne change rien
Clic (Bouton 'Révolution')
Verifie ((Etat) -like 'Révolution*pas encore*') 'un bouton grisé le dit'
"2. Bouton grisé : $(Etat)"
Clic (Bouton 'Nouveau projet')
Verifie ((Etat) -like '*pas encore*') 'Nouveau projet grisé'
$p.Refresh(); Verifie ($p.MainWindowTitle -notlike '●*') 'rien n''a changé'

# Le cube tourne la vue, la maison revient
$a = Image '1-depart.png'
$r = New-Object U+RECT; [void][U]::GetWindowRect($vue, [ref]$r)
$lv = $r.R - $r.L
Msg $vue 0x200 0 (Pos ($lv - 62) 44); Start-Sleep -Milliseconds 200
Clic $vue ($lv - 62) 44
Start-Sleep -Milliseconds 1200
$b = Image '2-cube.png'
Verifie ($a -ne $b) 'un clic sur le cube tourne la vue'
"3. Cube de vue : image changée"
Clic (Bouton 'Vue initiale')
Start-Sleep -Milliseconds 400
$c = Image '3-vue-initiale.png'
Verifie ($b -ne $c) 'la maison revient à la vue de départ'
"4. Vue initiale : image changée"

# Double-clic sur un plan : une esquisse s'y ouvre, refermée vide elle disparaît
# La liste de Windows lit la vraie souris pour un double-clic : ici, le clavier, qui fait la même chose
foreach ($t in 0x24, 0x28, 0x28, 0x0D) { Msg $arbre 0x100 $t ([IntPtr]1); if ($t -eq 0x0D) { Msg $arbre 0x102 $t ([IntPtr]1) }; Msg $arbre 0x101 $t ([IntPtr]1); Start-Sleep -Milliseconds 150 }
Start-Sleep -Milliseconds 500
Verifie ((Etat) -like '*Esquisse*') 'double-clic sur Plan XY'
Verifie (-not (Visible (Bouton 'Extrusion'))) 'le ruban laisse la place à la barre d''esquisse'
Verifie (Visible (Bouton 'Terminer')) 'barre d''esquisse visible'
Verifie (Visible (Bouton 'CAO')) 'la barre du haut reste'
[void](Image '4-plan-xy.png')
"5. Double-clic sur le plan XY : barre d'esquisse à la place du ruban"
Clic (Bouton 'Terminer')
Start-Sleep -Milliseconds 400
Verifie (Visible (Bouton 'Extrusion')) 'le ruban revient'
$p.Refresh(); Verifie ($p.MainWindowTitle -notlike '●*') 'une esquisse vide ne reste pas'
"6. Terminer sans dessiner : retirée"

# Le fil : le crayon ouvre l'esquisse
Double $fil 165 24
Verifie (Visible (Bouton 'Terminer')) 'double-clic sur le crayon du fil'
"7. Fil, double-clic sur l'esquisse : $(Etat)"
Clic (Bouton 'Abandonner')
Start-Sleep -Milliseconds 400
Verifie (Visible (Bouton 'Extrusion')) 'Abandonner ferme'
$p.Refresh(); Verifie ($p.MainWindowTitle -notlike '●*') 'Abandonner sans rien faire ne marque rien'
"8. Abandonner : pièce inchangée"

# L'extrusion du ruban, puis Annuler et Rétablir de la barre du haut
Clic (Bouton 'Extrusion')
Start-Sleep -Milliseconds 400
Verifie ((Etat) -like '*Réglez la profondeur*') 'Extrusion du ruban'
"9. Extrusion du ruban : $(Etat)"
Start-Sleep -Milliseconds 300
Clic (Bouton 'Annuler')
Start-Sleep -Milliseconds 500
Verifie ((Etat) -like '*57525.291*') 'Annuler de la barre du haut'
"10. Annuler : $(Etat)"
Start-Sleep -Milliseconds 300
Clic (Bouton 'Rétablir')
Start-Sleep -Milliseconds 500
Verifie ((Etat) -notlike '*57525.291*') 'Rétablir de la barre du haut'
Start-Sleep -Milliseconds 300
Clic (Bouton 'Annuler')
Start-Sleep -Milliseconds 500
"11. Rétablir puis Annuler : $(Etat)"
Clic (Bouton 'Régénérer')
Start-Sleep -Milliseconds 400
Verifie ((Etat) -like '*57525.291*') 'Régénérer'
"12. Régénérer : $(Etat)"

# Les ateliers
foreach ($m in 'FAO', 'PLAN', 'RENDU', 'CAO') {
  Clic (Bouton $m)
  Start-Sleep -Milliseconds 400
  [void](Image "atelier-$m.png")
  Verifie ((Visible $arbre) -eq ($m -eq 'CAO')) "arbre visible seulement en CAO ($m)"
  Verifie ((Visible (Bouton 'Extrusion')) -eq ($m -eq 'CAO')) "ruban CAO ($m)"
  if ($m -eq 'FAO') { Clic (Bouton 'Surfaçage'); Verifie ((Etat) -like 'Surfaçage*pas encore*') 'bouton FAO grisé' }
}
"13. Ateliers FAO, PLAN, RENDU, CAO"
Clic (Bouton 'Usinage'); Start-Sleep -Milliseconds 300
Verifie (-not (Visible $arbre)) 'onglet Usinage'
Clic (Bouton 'Modèle'); Start-Sleep -Milliseconds 300
Verifie (Visible $arbre) 'onglet Modèle'
Clic (Bouton "Replier l'arbre"); Start-Sleep -Milliseconds 300
Verifie (-not (Visible $arbre)) 'repli de l''arbre'
Clic (Bouton "Replier l'arbre"); Start-Sleep -Milliseconds 300
Verifie (Visible $arbre) 'dépli de l''arbre'
"14. Onglets et repli de l'arbre"
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"15. Fermeture propre, code $($p.ExitCode), rien à enregistrer"
