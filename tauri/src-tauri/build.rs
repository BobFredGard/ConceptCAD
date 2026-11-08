fn main() {
    // Sans cette ligne, une icône changée n'entre pas dans le programme à la recompilation.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    // La version vient de package.json (tauri.conf.json y renvoie) : sans cette ligne, les propriétés
    // du programme Windows gardent l'ancien numéro (resté à 0.69.2 jusqu'en V0.70.4).
    println!("cargo:rerun-if-changed=../../package.json");
    tauri_build::build()
}
