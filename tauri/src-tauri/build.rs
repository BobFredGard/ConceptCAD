fn main() {
    // Sans cette ligne, une icône changée n'entre pas dans le programme à la recompilation.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
