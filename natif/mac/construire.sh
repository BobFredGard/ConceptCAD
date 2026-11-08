#!/bin/bash
# Fabrique natif/sortie-mac/ConceptCAD natif.app puis natif/sortie-mac/ConceptCAD-natif-Mac.dmg.
# Prérequis : bibliothèques de natif/mac/dependances.sh, CMake, Ninja, (brew install cmake ninja).
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
# Les bibliothèques dans l'application, pour qu'elle marche sur un Mac qui n'a rien installé :
# chaque bibliothèque venue de natif/.tiers/mac est copiée dans Contents/Frameworks et désignée par rapport au programme
F="$APP/Contents/Frameworks"
mkdir -p "$F"
copier() {
  local cible="$1" d nom
  for d in $(otool -L "$cible" | awk 'NR>1 {print $1}'); do
    case "$d" in
      "$P"/*|@rpath/*)
        nom=$(basename "$d")
        if [ ! -f "$F/$nom" ]; then
          cp -L "$P/lib/$nom" "$F/$nom"
          chmod u+w "$F/$nom"
          install_name_tool -id "@executable_path/../Frameworks/$nom" "$F/$nom" 2>/dev/null
          copier "$F/$nom"
        fi
        install_name_tool -change "$d" "@executable_path/../Frameworks/$nom" "$cible" 2>/dev/null
        ;;
    esac
  done
  # Plus aucun chemin de recherche vers le dossier de fabrication
  for r in $(otool -l "$cible" | awk '/cmd LC_RPATH/ {getline; getline; print $2}'); do
    install_name_tool -delete_rpath "$r" "$cible" 2>/dev/null || true
  done
}
copier "$APP/Contents/MacOS/ConceptCADNatif"
# Contrôle : aucune référence ne doit rester vers le Mac qui a fabriqué l'application
if otool -L "$APP/Contents/MacOS/ConceptCADNatif" "$F"/*.dylib | grep -E "$P|/Users/|/opt/homebrew|/usr/local|@rpath"; then
  echo "Bibliothèques encore liées au dossier de fabrication" >&2
  exit 1
fi
ls "$F" | wc -l
# Signature locale (sans compte développeur Apple) : obligatoire sur les puces Apple
codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP"
lipo -archs "$APP/Contents/MacOS/ConceptCADNatif"

mkdir -p "$S/dmg" && cp -R "$APP" "$S/dmg/" && ln -s /Applications "$S/dmg/Applications"
hdiutil create -volname "ConceptCAD natif" -srcfolder "$S/dmg" -ov -format UDZO "$S/ConceptCAD-natif-Mac.dmg"
rm -rf "$S/dmg"
du -sh "$APP" "$S/ConceptCAD-natif-Mac.dmg"
