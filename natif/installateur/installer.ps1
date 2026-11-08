# Installe l'essai Windows natif de ConceptCAD pour l'utilisateur courant (sans droits administrateur).
# Lancé par l'installateur IExpress, depuis le dossier où il a extrait ConceptCADNatif.zip.
#   -Dossier <chemin>  : installe ailleurs (essais)
#   -SansRaccourcis    : ni raccourcis ni inscription dans « Applications installées » (essais)
param(
  [string]$Dossier = (Join-Path $env:LOCALAPPDATA 'Programs\ConceptCAD Natif'),
  [switch]$SansRaccourcis,
  [switch]$Silencieux
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$Nom = 'ConceptCAD Natif (essai)'
function Dire([string]$t, [string]$icone = 'Information') {
  if ($Silencieux) { Write-Output $t; return }
  [void][System.Windows.Forms.MessageBox]::Show($t, $Nom, 'OK', $icone)
}
try {
  $ici = Split-Path -Parent $MyInvocation.MyCommand.Path
  $zip = Join-Path $ici 'ConceptCADNatif.zip'
  if (-not (Test-Path $zip)) { throw "Archive absente : $zip" }
  # Le programme ouvert verrouille ses fichiers : demander de le fermer
  while (Get-Process -Name ConceptCADNatif -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Dossier, 'OrdinalIgnoreCase') }) {
    if ($Silencieux) { throw 'ConceptCAD Natif est ouvert : fermez-le.' }
    $r = [System.Windows.Forms.MessageBox]::Show("ConceptCAD Natif est ouvert.`nFermez-le puis cliquez sur OK.", $Nom, 'OKCancel', 'Warning')
    if ($r -ne 'OK') { exit 1 }
  }
  # Une version précédente est remplacée en entier : aucun ancien fichier ne reste mêlé aux nouveaux
  if (Test-Path $Dossier) { Remove-Item -LiteralPath $Dossier -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Dossier | Out-Null
  Expand-Archive -LiteralPath $zip -DestinationPath $Dossier -Force
  $exe = Join-Path $Dossier 'ConceptCADNatif.exe'
  if (-not (Test-Path $exe)) { throw 'Le programme manque après la copie.' }

  # Désinstallation : retire le dossier, les raccourcis et l'inscription
  $desinst = Join-Path $Dossier 'desinstaller.ps1'
  @'
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([System.Windows.Forms.MessageBox]::Show("Désinstaller ConceptCAD Natif (essai) ?", 'ConceptCAD Natif (essai)', 'OKCancel', 'Question') -ne 'OK') { exit 1 }
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'ConceptCAD Natif (essai).lnk') -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ConceptCAD Natif (essai).lnk') -Force
Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ConceptCADNatif' -Recurse -Force
Set-Location $env:TEMP
Start-Process cmd.exe -ArgumentList '/c', "timeout /t 2 >nul & rmdir /s /q `"$d`"" -WindowStyle Hidden
[void][System.Windows.Forms.MessageBox]::Show('ConceptCAD Natif (essai) est désinstallé. Vos pièces ne sont pas touchées.', 'ConceptCAD Natif (essai)')
'@ | Set-Content -LiteralPath $desinst -Encoding UTF8

  if (-not $SansRaccourcis) {
    $sh = New-Object -ComObject WScript.Shell
    foreach ($lieu in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
      $l = $sh.CreateShortcut((Join-Path $lieu "$Nom.lnk"))
      $l.TargetPath = $exe
      $l.WorkingDirectory = $Dossier
      $l.IconLocation = "$exe,0"
      $l.Description = 'ConceptCAD, version Windows native (essai)'
      $l.Save()
    }
    $cle = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ConceptCADNatif'
    New-Item -Path $cle -Force | Out-Null
    $taille = [int]((Get-ChildItem -LiteralPath $Dossier -Recurse -File | Measure-Object Length -Sum).Sum / 1KB)
    $props = @{
      DisplayName = $Nom; Publisher = 'ConceptCAD'; DisplayIcon = $exe; InstallLocation = $Dossier
      UninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$desinst`""
      DisplayVersion = (Get-Date -Format 'yyyy.MM.dd')
    }
    foreach ($k in $props.Keys) { New-ItemProperty -Path $cle -Name $k -Value $props[$k] -PropertyType String -Force | Out-Null }
    New-ItemProperty -Path $cle -Name EstimatedSize -Value $taille -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $cle -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $cle -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
  }
  Dire ("$Nom est installé.`n`nDossier : $Dossier" + $(if ($SansRaccourcis) { "" } else { "`nRaccourcis : menu Démarrer et bureau." }))
} catch {
  Dire ("L'installation a échoué :`n" + $_.Exception.Message) 'Error'
  exit 1
}
