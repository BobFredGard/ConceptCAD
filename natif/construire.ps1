# Fabrique natif\sortie\ConceptCADNatif.exe et y copie les DLL nécessaires (et elles seules).
# À lancer depuis la racine du dépôt : powershell -File natif\construire.ps1
# Prérequis : Visual Studio 2022 (C++), CMake. Téléchargements, depuis les sources officielles :
#   OCCT V8.0.1 : https://github.com/Open-Cascade-SAS/OCCT/releases/tag/V8.0.1 (occt-combined-release-no-pch.zip)
#   JSON 3.12.0 : https://github.com/nlohmann/json/releases/download/v3.12.0/json.hpp
#   wxWidgets 3.3.4 : https://github.com/wxWidgets/wxWidgets/releases/tag/v3.3.4
param([switch]$SansTelechargement)
$ErrorActionPreference = 'Stop'
$N = Join-Path $PSScriptRoot '.'
$T = Join-Path $N '.tiers'
$Bin = Join-Path $T 'occt-bin'
if (-not $SansTelechargement) {
  if (-not (Test-Path "$T\nlohmann\json.hpp")) {
    New-Item -ItemType Directory -Force "$T\nlohmann" | Out-Null
    Invoke-WebRequest 'https://github.com/nlohmann/json/releases/download/v3.12.0/json.hpp' -OutFile "$T\nlohmann\json.hpp"
  }
  if (-not (Test-Path "$Bin\opencascade-8.0.1-vc14-64")) {
    $Z = "$T\bin-officiels"
    New-Item -ItemType Directory -Force $Z | Out-Null
    & gh release download V8.0.1 -R Open-Cascade-SAS/OCCT -p occt-combined-release-no-pch.zip -D $Z --clobber
    Expand-Archive "$Z\occt-combined-release-no-pch.zip" $Z -Force
    Expand-Archive "$Z\opencascade-8.0.1-vc14-64-combined.zip" $Bin -Force
  }
  if (-not (Test-Path "$T\wx\lib\vc14x_x64_dll\wxbase334u_vc14x_x64.dll")) {
    $Dl = "$T\wx\dl"
    New-Item -ItemType Directory -Force $Dl | Out-Null
    foreach ($p in 'wxMSW-3.3.4_vc14x_x64_Dev.7z', 'wxMSW-3.3.4_vc14x_x64_ReleaseDLL.7z', 'wxWidgets-3.3.4-headers.7z') {
      & gh release download v3.3.4 -R wxWidgets/wxWidgets -p $p -D $Dl --clobber
      & "$env:WINDIR\System32\tar.exe" -xf "$Dl\$p" -C "$T\wx"
      if ($LASTEXITCODE) { exit $LASTEXITCODE }
    }
  }
}
& cmake -S $N -B "$T\build" -G "Visual Studio 17 2022" -A x64
if ($LASTEXITCODE) { exit $LASTEXITCODE }
& cmake --build "$T\build" --config Release -- /m /v:m /nologo
if ($LASTEXITCODE) { exit $LASTEXITCODE }

$S = Join-Path $N 'sortie'
$O = "$Bin\opencascade-8.0.1-vc14-64\win64\vc14\bin"
$P = "$Bin\3rdparty-vc14-64"
$tk = 'TKernel','TKMath','TKG2d','TKG3d','TKGeomBase','TKBRep','TKGeomAlgo','TKTopAlgo','TKPrim','TKBO','TKBool','TKShHealing','TKMesh','TKHLR','TKService','TKV3d','TKOpenGl'
foreach ($d in $tk) { Copy-Item "$O\$d.dll" $S -Force }
$tiers = @(
  "$P\tbb-2021.13.0-x64\bin\tbb12.dll","$P\tbb-2021.13.0-x64\bin\tbbmalloc.dll","$P\jemalloc-vc14-64\bin\jemalloc.dll",
  "$P\freeimage-3.18.0-x64\bin\FreeImage.dll","$P\freetype-2.13.3-x64\bin\freetype.dll","$P\openvr-1.14.15-64\bin\win64\openvr_api.dll",
  "$P\ffmpeg-3.3.4-64\bin\avcodec-57.dll","$P\ffmpeg-3.3.4-64\bin\avformat-57.dll","$P\ffmpeg-3.3.4-64\bin\swscale-4.dll","$P\ffmpeg-3.3.4-64\bin\avutil-55.dll",
  "$P\msvc-vc14-64\msvcp140.dll","$P\msvc-vc14-64\vcruntime140.dll","$P\msvc-vc14-64\vcruntime140_1.dll","$P\msvc-vc14-64\vcomp140.dll",
  "$P\zlib-1.2.8-vc14-64\bin\zlib.dll")
foreach ($d in $tiers) { Copy-Item $d $S -Force }
foreach ($d in 'wxbase334u','wxmsw334u_core','wxmsw334u_aui','wxmsw334u_propgrid') { Copy-Item "$T\wx\lib\vc14x_x64_dll\${d}_vc14x_x64.dll" $S -Force }
$Mo = [math]::Round(((Get-ChildItem $S | Measure-Object Length -Sum).Sum) / 1MB)
Write-Output "Pret : $S\ConceptCADNatif.exe ($Mo Mo avec les DLL)"
