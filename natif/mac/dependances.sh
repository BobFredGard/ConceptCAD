#!/bin/bash
# Compile, pour Mac (puces Apple et Intel dans les mêmes fichiers), les bibliothèques de la version native :
# OCCT 8.0.1 (même noyau et même version que Windows et le navigateur), wxWidgets 3.3.4, FreeType, et
# télécharge nlohmann/json. Il n'existe pas de binaires officiels Mac d'OCCT : on part des sources officielles.
# Tout va dans natif/.tiers/mac (hors Git). Compter une heure la première fois sur un Mac de GitHub.
#   bash natif/mac/dependances.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
T="$ICI/../.tiers/mac"
P="$T/prefixe"
SRC="$T/sources"
mkdir -p "$P" "$SRC"
ARCHS="${ARCHS:-arm64;x86_64}"
CIBLE="${CIBLE:-11.0}"
COMMUN=(-G Ninja -DCMAKE_BUILD_TYPE=Release "-DCMAKE_OSX_ARCHITECTURES=$ARCHS" "-DCMAKE_OSX_DEPLOYMENT_TARGET=$CIBLE" "-DCMAKE_INSTALL_PREFIX=$P" -DCMAKE_INSTALL_NAME_DIR="$P/lib")

if [ ! -f "$P/include/nlohmann/json.hpp" ]; then
  mkdir -p "$P/include/nlohmann"
  curl -fsSL -o "$P/include/nlohmann/json.hpp" https://github.com/nlohmann/json/releases/download/v3.12.0/json.hpp
fi

if [ ! -f "$P/lib/libfreetype.dylib" ]; then
  cd "$SRC"
  curl -fsSL -o ft.tar.xz https://download.savannah.gnu.org/releases/freetype/freetype-2.13.3.tar.xz \
    || curl -fsSL -o ft.tar.xz https://sourceforge.net/projects/freetype/files/freetype2/2.13.3/freetype-2.13.3.tar.xz/download
  tar xf ft.tar.xz
  cmake -S freetype-2.13.3 -B ft-build "${COMMUN[@]}" -DBUILD_SHARED_LIBS=ON \
    -DFT_DISABLE_ZLIB=ON -DFT_DISABLE_BZIP2=ON -DFT_DISABLE_PNG=ON -DFT_DISABLE_HARFBUZZ=ON -DFT_DISABLE_BROTLI=ON
  cmake --build ft-build
  cmake --install ft-build
fi

if [ ! -f "$P/bin/wx-config" ]; then
  cd "$SRC"
  curl -fsSL -o wx.tar.bz2 https://github.com/wxWidgets/wxWidgets/releases/download/v3.3.4/wxWidgets-3.3.4.tar.bz2
  tar xf wx.tar.bz2
  cmake -S wxWidgets-3.3.4 -B wx-build "${COMMUN[@]}" -DwxBUILD_SHARED=ON -DwxBUILD_SAMPLES=OFF -DwxBUILD_TESTS=OFF \
    -DwxBUILD_DEMOS=OFF -DwxUSE_WEBVIEW=OFF -DwxUSE_MEDIACTRL=OFF -DwxUSE_LIBTIFF=OFF -DwxUSE_LIBWEBP=OFF \
    -DwxUSE_LIBPNG=builtin -DwxUSE_LIBJPEG=builtin -DwxUSE_ZLIB=builtin -DwxUSE_EXPAT=builtin -DwxUSE_REGEX=builtin
  cmake --build wx-build
  cmake --install wx-build
fi

if [ ! -f "$P/lib/libTKernel.dylib" ]; then
  cd "$SRC"
  curl -fsSL -o occt.tar.gz https://github.com/Open-Cascade-SAS/OCCT/archive/refs/tags/V8.0.1.tar.gz
  rm -rf occt && mkdir occt && tar xf occt.tar.gz -C occt --strip-components 1
  cmake -S occt -B occt-build "${COMMUN[@]}" -DBUILD_LIBRARY_TYPE=Shared -DBUILD_MODULE_Draw=OFF \
    -DBUILD_DOC_Overview=OFF -DBUILD_SAMPLES_QT=OFF -DBUILD_USE_PCH=OFF -DBUILD_RELEASE_DISABLE_EXCEPTIONS=OFF \
    -DUSE_FREETYPE=ON -D3RDPARTY_FREETYPE_DIR="$P" -DUSE_FREEIMAGE=OFF -DUSE_TBB=OFF -DUSE_RAPIDJSON=OFF \
    -DUSE_OPENVR=OFF -DUSE_FFMPEG=OFF -DUSE_TK=OFF -DUSE_DRACO=OFF -DUSE_VTK=OFF -DUSE_GLES2=OFF \
    -DINSTALL_DIR="$P" -DINSTALL_DIR_LIB=lib -DINSTALL_DIR_INCLUDE=include/opencascade
  cmake --build occt-build
  cmake --install occt-build
fi
echo "Pret : $P"
