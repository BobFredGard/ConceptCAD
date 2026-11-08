# Fabrique natif\sortie\Installer-ConceptCAD-Natif.exe avec le compilateur C# fourni avec Windows :
# le programme, ses bibliothèques et le moteur d'usinage, sans les fichiers des bancs ni les anciennes versions.
#   powershell -NoProfile -ExecutionPolicy Bypass -File natif\installateur\fabriquer.ps1
$ErrorActionPreference = 'Stop'
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$natif = Split-Path -Parent $ici
$sortie = Join-Path $natif 'sortie'
$travail = Join-Path $natif '.tiers\installateur'
$cible = Join-Path $sortie 'Installer-ConceptCAD-Natif.exe'

if (Test-Path $travail) { Remove-Item -LiteralPath $travail -Recurse -Force }
$copie = Join-Path $travail 'programme'
New-Item -ItemType Directory -Force -Path $copie | Out-Null

# Ce qui sert à faire tourner le programme : l'exe, les .dll et le dossier fao
Copy-Item -LiteralPath (Join-Path $sortie 'ConceptCADNatif.exe') -Destination $copie
Get-ChildItem -LiteralPath $sortie -Filter *.dll -File | Copy-Item -Destination $copie
Copy-Item -LiteralPath (Join-Path $sortie 'fao') -Destination $copie -Recurse

$zip = Join-Path $travail 'ConceptCADNatif.zip'
Compress-Archive -Path (Join-Path $copie '*') -DestinationPath $zip -CompressionLevel Optimal
# PowerShell 5 lit un script sans marque UTF-8 comme du texte ANSI : les accents seraient faux
$texte = [IO.File]::ReadAllText((Join-Path $ici 'installer.ps1'))
[IO.File]::WriteAllText((Join-Path $travail 'installer.ps1'), $texte, (New-Object Text.UTF8Encoding $true))

# L'icône du programme, pour l'installateur
Add-Type -AssemblyName System.Drawing
$ico = Join-Path $travail 'icone.ico'
$fi = [IO.File]::Create($ico)
[System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $copie 'ConceptCADNatif.exe')).Save($fi)
$fi.Close()

# Le lanceur (lanceur.cs) porte l'archive et le script en ressources
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (Test-Path $cible) { Remove-Item -LiteralPath $cible -Force }
& $csc /nologo /target:winexe /optimize+ /platform:x64 "/out:$cible" "/win32icon:$ico" /reference:System.Windows.Forms.dll `
  "/resource:$zip,ConceptCADNatif.zip" "/resource:$(Join-Path $travail 'installer.ps1'),installer.ps1" (Join-Path $ici 'lanceur.cs')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $cible)) { throw "Le compilateur C# n'a pas produit l'installateur" }
Remove-Item -LiteralPath $copie -Recurse -Force
"{0} : {1:N0} Mo" -f $cible, ((Get-Item $cible).Length / 1MB)
