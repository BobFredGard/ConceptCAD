# Change une cote d'esquisse comme le ferait une personne : vrai clavier et vraie souris, sur une COPIE de la pièce.
# powershell -File natif\mesures\verifier-cote.ps1 -Fichier <chemin.conceptcad> -Dossier <captures> -Cote e13 -Valeur 60
param([string]$Fichier, [string]$Dossier, [string]$Cote = 'e13', [string]$Valeur = '60')
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
$Dossier = (Resolve-Path $Dossier).Path
$copie = Join-Path $Dossier 'copie.conceptcad'
Copy-Item -LiteralPath $Fichier $copie -Force
Remove-Item "$copie.bak" -ErrorAction SilentlyContinue
$env:CONCEPTCAD_JOURNAL_ETAT = Join-Path $Dossier 'etat.txt'
Remove-Item $env:CONCEPTCAD_JOURNAL_ETAT -ErrorAction SilentlyContinue

function Capture($nom) {
  $r = New-Object U+RECT; [void][U]::GetWindowRect($w, [ref]$r)
  $b = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($r.L, $r.T, 0, 0, $b.Size); $g.Dispose()
  $b.Save((Join-Path $Dossier $nom), [Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
}
# Jamais de touche ni de clic si la fenêtre devant n'est pas à ce programme : ils partiraient ailleurs.
function Garde { $q = 0; [void][U]::GetWindowThreadProcessId([U]::GetForegroundWindow(), [ref]$q); if ($q -ne $p.Id) { if (-not $p.HasExited) { $p.Kill() }; throw "une autre fenêtre est passée devant ($((Get-Process -Id $q -ErrorAction SilentlyContinue).ProcessName)) : arrêt, rien envoyé" } }
function Touches($k) { Garde; [Windows.Forms.SendKeys]::SendWait($k); Start-Sleep -Milliseconds 300 }
function Souris($x, $y) { Garde; [void][U]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 80 }
function Lignes { return @(Get-Content $env:CONCEPTCAD_JOURNAL_ETAT -Encoding UTF8 -ErrorAction SilentlyContinue) }
function Etat { Start-Sleep -Milliseconds 300; return (Lignes | Where-Object { $_ -notlike 'cote *' } | Select-Object -Last 1) }
function Titre { $p.Refresh(); return $p.MainWindowTitle }
function Rect($id) { $r = New-Object U+RECT; [void][U]::GetWindowRect([U]::GetDlgItem($w, $id), [ref]$r); return $r }
function Prive { Start-Sleep -Seconds 2; $q = Get-CimInstance Win32_PerfRawData_PerfProc_Process -Filter "IDProcess=$($p.Id)"; return [math]::Round($q.WorkingSetPrivate / 1MB, 1) }
function Double($x, $y) { Souris $x $y; foreach ($n in 1, 2) { [U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 40; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60 }; Start-Sleep -Milliseconds 500 }
function PosCote { $l = Lignes | Where-Object { $_ -like "cote $Cote *" } | Select-Object -Last 1; if (-not $l) { $p.Kill(); throw "cote $Cote non dessinée" }; $m = $l -split ' '; return @([int]$m[2], [int]$m[3]) }
function Verifie($ok, $quoi) { if (-not $ok) { Capture 'echec.png'; if (-not $p.HasExited) { $p.Kill() }; throw "ÉCHEC : $quoi (état : $(Etat))" } }

$p = Start-Process $exe -ArgumentList "`"$copie`"" -PassThru
for ($i = 0; $i -lt 100 -and $p.MainWindowHandle -eq 0; $i++) { Start-Sleep -Milliseconds 100; $p.Refresh() }
$w = $p.MainWindowHandle
if ($w -eq 0) { throw 'la fenêtre ne s''ouvre pas' }
Start-Sleep -Seconds 3
[U]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [U]::keybd_event(0x12, 0, 2, [IntPtr]::Zero); [void][U]::ShowWindow($w, 9); [void][U]::SetForegroundWindow($w); Start-Sleep -Milliseconds 300
$depart = Etat
"1. Pièce ouverte : $depart ; mémoire $(Prive) Mo"
$a = Rect 2001
Souris ($a.L + 60) ($a.T + 12)
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60; [U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 200
Touches '{HOME}'
Double ($a.L + 70) ($a.T + 27)
"2. Esquisse ouverte : $(Etat)"
Verifie ((Etat) -like '*Double-clic sur une cote*') 'l''esquisse devrait être modifiable'
Start-Sleep -Milliseconds 500
Capture '1-esquisse.png'

$c = PosCote
Double $c[0] $c[1]
Capture '2-saisie.png'
Touches '{ESC}'
Verifie ((Etat) -like '*Double-clic sur une cote*') 'Échap pendant la saisie ne doit pas quitter l''esquisse'
"3. Échap pendant la saisie : on reste dans l'esquisse"

Double $c[0] $c[1]
Touches 'abc{ENTER}'
Start-Sleep -Milliseconds 400
Capture '3-valeur-incorrecte.png'
$q = 0; [void][U]::GetWindowThreadProcessId([U]::GetForegroundWindow(), [ref]$q)
Touches '{ENTER}'
Verifie ((Titre) -notlike '●*') 'une valeur incorrecte ne doit rien changer'
"4. « abc » : refusé, rien de changé ; titre : $(Titre)"

Double $c[0] $c[1]
Touches "$Valeur{ENTER}"
Start-Sleep -Seconds 1
$apres = Etat
Capture '4-apres.png'
"5. Cote $Cote à $Valeur : $apres ; titre : $(Titre)"
Verifie ($apres -ne $depart -and $apres -like '*Volume*') 'le solide devrait avoir suivi'
Verifie ((Titre) -like '●*') 'le titre devrait signaler la modification'

Touches '^z'; Start-Sleep -Milliseconds 800
$annule = Etat
"6. Ctrl+Z : $annule ; titre : $(Titre)"
Verifie (($annule -split '\|')[1] -eq ($depart -split '\|')[1]) 'l''annulation devrait redonner le volume de départ'
Verifie ((Titre) -notlike '●*') 'après annulation, la pièce doit redevenir non modifiée'
Touches '^y'; Start-Sleep -Milliseconds 800
$retabli = Etat
"7. Ctrl+Y : $retabli ; titre : $(Titre)"
Verifie (($retabli -split '\|')[1] -eq ($apres -split '\|')[1]) 'le rétablissement devrait redonner le volume modifié'

Touches '^s'; Start-Sleep -Milliseconds 1000
"8. Ctrl+S : $(Etat) ; titre : $(Titre) ; copie de secours : $(Test-Path "$copie.bak")"
Verifie ((Titre) -notlike '●*') 'après enregistrement, plus de modification en attente'
Touches '{ESC}'; Start-Sleep -Milliseconds 600
Capture '5-piece.png'
"9. Échap : retour à la pièce ; mémoire $(Prive) Mo"
Garde
[void]$p.CloseMainWindow()
if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'la fenêtre ne se ferme pas' }
"10. Fermeture propre, code $($p.ExitCode), sans question : rien n'est resté à enregistrer"
