// Maquette ConceptCAD en application Windows. Le logiciel lui-même est inchangé : ce programme
// ouvre sa page dans WebView2 et donne au pont (../pont.js) l'accès aux vraies fenêtres et aux fichiers.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use percent_encoding::percent_decode_str;
use rfd::FileDialog;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{State, WebviewWindow};

#[derive(Deserialize)]
struct Filtre {
    description: String,
    extensions: Vec<String>,
}

#[derive(Serialize)]
struct Infos {
    taille: u64,
    modif: u64,
    dossier: bool,
}

#[derive(Serialize)]
struct Entree {
    nom: String,
    dossier: bool,
}

/// Fichier reçu par double-clic : donné une seule fois (pas de réouverture si la page se recharge).
struct Demarrage(Mutex<Option<String>>);

fn dialogue(fen: &WebviewWindow, filtres: Vec<Filtre>, depart: Option<String>) -> FileDialog {
    let mut d = FileDialog::new().set_parent(fen);
    for f in &filtres {
        let ext: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
        d = d.add_filter(&f.description, &ext);
    }
    if let Some(p) = depart {
        d = d.set_directory(p);
    }
    d
}

fn chaine(p: Option<PathBuf>) -> Option<String> {
    p.map(|x| x.to_string_lossy().into_owned())
}

#[tauri::command(async)]
fn dialogue_ouvrir(window: WebviewWindow, filtres: Vec<Filtre>, depart: Option<String>) -> Option<String> {
    chaine(dialogue(&window, filtres, depart).pick_file())
}

#[tauri::command(async)]
fn dialogue_enregistrer(window: WebviewWindow, filtres: Vec<Filtre>, depart: Option<String>, nom: Option<String>) -> Option<String> {
    let mut d = dialogue(&window, filtres, depart);
    if let Some(n) = nom {
        d = d.set_file_name(n);
    }
    chaine(d.save_file())
}

#[tauri::command(async)]
fn dialogue_dossier(window: WebviewWindow, depart: Option<String>) -> Option<String> {
    chaine(dialogue(&window, vec![], depart).pick_folder())
}

#[tauri::command(async)]
fn lire(chemin: String) -> Result<Response, String> {
    fs::read(&chemin).map(Response::new).map_err(|e| e.to_string())
}

#[tauri::command(async)]
fn infos(chemin: String) -> Option<Infos> {
    let m = fs::metadata(&chemin).ok()?;
    let modif = m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map_or(0, |d| d.as_millis() as u64);
    Some(Infos { taille: m.len(), modif, dossier: m.is_dir() })
}

#[tauri::command(async)]
fn lister(chemin: String) -> Result<Vec<Entree>, String> {
    let mut l = vec![];
    for e in fs::read_dir(&chemin).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        l.push(Entree {
            nom: e.file_name().to_string_lossy().into_owned(),
            dossier: e.file_type().map(|t| t.is_dir()).unwrap_or(false),
        });
    }
    Ok(l)
}

#[tauri::command(async)]
fn creer_dossier(chemin: String) -> Result<(), String> {
    fs::create_dir_all(&chemin).map_err(|e| e.to_string())
}

/// Écrit à côté puis remplace d'un coup : une panne en plein milieu laisse l'ancien fichier intact.
fn ecrire_sur(chemin: &Path, octets: &[u8]) -> std::io::Result<()> {
    let mut nom = chemin.as_os_str().to_owned();
    nom.push(".ecriture");
    let tmp = PathBuf::from(nom);
    let essai = (|| {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(octets)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, chemin)
    })();
    if essai.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    essai
}

#[tauri::command]
fn ecrire(request: Request) -> Result<(), String> {
    let brut = request.headers().get("x-chemin").and_then(|v| v.to_str().ok()).ok_or("chemin absent")?;
    let chemin = percent_decode_str(brut).decode_utf8().map_err(|e| e.to_string())?.into_owned();
    let InvokeBody::Raw(octets) = request.body() else {
        return Err("contenu binaire attendu".into());
    };
    ecrire_sur(Path::new(&chemin), octets).map_err(|e| e.to_string())
}

#[tauri::command]
fn titre(window: WebviewWindow, texte: String) -> Result<(), String> {
    window.set_title(&texte).map_err(|e| e.to_string())
}

#[tauri::command]
fn fichier_demarrage(etat: State<Demarrage>) -> Option<String> {
    etat.0.lock().ok()?.take()
}

fn main() {
    let fichier = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| p.is_file())
        .map(|p| std::path::absolute(&p).unwrap_or(p).to_string_lossy().into_owned());
    tauri::Builder::default()
        .manage(Demarrage(Mutex::new(fichier)))
        .invoke_handler(tauri::generate_handler![
            dialogue_ouvrir, dialogue_enregistrer, dialogue_dossier, lire, infos, lister, creer_dossier, ecrire, titre, fichier_demarrage
        ])
        .run(tauri::generate_context!())
        .expect("démarrage de l'application impossible");
}
