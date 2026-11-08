#!/bin/bash
# Fabrique natif/sortie-mac/ConceptCAD natif.app puis natif/sortie-mac/ConceptCAD-natif-Mac.dmg.
# Prérequis : bibliothèques de natif/mac/dependances.sh, CMake, Ninja, dylibbundler (brew install cmake ninja dylibbundler).
#   bash natif/mac/construire.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
N="$(cd "$ICI/.." && pwd)"
P="$N/.tiers/mac/prefixe"
B="$N/.tiers/mac/build"
S="$N/sortie-mac"
ARCHS="${ARCHS:-arm64;x86_64}"

cmake -S "$N" -B "$B" -G Ninja -DCMAKE_BUILD_TYPE=Release "-DCMAKE_OSX_ARCHITECTURES=$ARCHS" -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \
  -DTIERS_MAC="$P" -DwxWidgets_CONFIG_EXECUTABLE="$P/bin/wx-config"
# -k 0 : toutes les erreurs d'un coup, pas seulement la première
cmake --build "$B" --target ConceptCADNatif -- -k 0

rm -rf "$S" && mkdir -p "$S"
APP="$S/ConceptCAD natif.app"
cp -R "$B/ConceptCADNatif.app" "$APP"
# L'icône : le même dessin que la version native Windows
mkdir -p "$APP/Contents/Resources"
iconutil -c icns "$ICI/ConceptCAD.iconset" -o "$APP/Contents/Resources/ConceptCAD.icns"
# Les bibliothèques dans l'application, pour qu'elle marche sur un Mac qui n'a rien installé
dylibbundler -of -cd -b -x "$APP/Contents/MacOS/ConceptCADNatif" -d "$APP/Contents/Frameworks" \
  -p @executable_path/../Frameworks/ -s "$P/lib" > "$S/dylibbundler.txt"
# Signature locale (sans compte développeur Apple) : obligatoire sur les puces Apple
codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP"
lipo -archs "$APP/Contents/MacOS/ConceptCADNatif"

mkdir -p "$S/dmg" && cp -R "$APP" "$S/dmg/" && ln -s /Applications "$S/dmg/Applications"
hdiutil create -volname "ConceptCAD natif" -srcfolder "$S/dmg" -ov -format UDZO "$S/ConceptCAD-natif-Mac.dmg"
rm -rf "$S/dmg"
du -sh "$APP" "$S/ConceptCAD-natif-Mac.dmg"
