#!/bin/bash
# Fabrique le DMG de ConceptCAD sur ce Mac, pour ce Mac. Un DMG fait ici s'ouvre sans le blocage d'Apple.
#   bash tauri/mac/construire.sh
set -e
cd "$(dirname "$0")/../.."

manque=0
xcode-select -p >/dev/null 2>&1 || { echo "Manque : outils Apple. Lancez : xcode-select --install"; manque=1; }
command -v node >/dev/null    || { echo "Manque : Node. Téléchargez-le sur https://nodejs.org"; manque=1; }
command -v cargo >/dev/null   || { echo "Manque : Rust. Instructions sur https://rustup.rs"; manque=1; }
command -v git-lfs >/dev/null || { echo "Manque : Git LFS. Instructions sur https://git-lfs.com"; manque=1; }
[ "$manque" = 0 ] || exit 1

git lfs pull --include "occt/**"
cargo tauri --version >/dev/null 2>&1 || cargo install tauri-cli --version 2.11.4 --locked
node tauri/preparer.cjs
(cd tauri/src-tauri && cargo tauri build --config tauri.mac.json)
echo
echo "DMG prêt :"
ls "$PWD"/tauri/src-tauri/target/release/bundle/dmg/*.dmg
