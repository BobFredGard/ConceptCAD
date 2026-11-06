// ConceptCAD en application Windows. Le logiciel lui-même est inchangé : ce programme ouvre sa page
// dans WebView2 et donne au pont (../pont.js) l'accès aux vraies fenêtres et aux fichiers.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use percent_encoding::percent_decode_str;
use rfd::{FileDialog, MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{Emitter, Manager, State, WebviewWindow, WindowEvent};

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

#[derive(Default)]
struct Fermeture {
    permise: AtomicBool,
    reponse: AtomicBool,
    veille: AtomicBool,
}

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

/// La page a bien reçu la demande de fermeture : elle va poser sa question.
#[tauri::command]
fn fermeture_recue(etat: State<Fermeture>) {
    etat.reponse.store(true, Ordering::SeqCst);
}

/// La page a fini (enregistré ou non) : fermeture normale, ses données en attente sont écrites.
#[tauri::command]
fn fermer(window: WebviewWindow, etat: State<Fermeture>) -> Result<(), String> {
    etat.permise.store(true, Ordering::SeqCst);
    window.close().map_err(|e| e.to_string())
}

/// Croix de la fenêtre : la question vient de la page. Si un long calcul l'empêche de répondre,
/// Windows propose quand même de fermer : on ne reste jamais prisonnier de la fenêtre.
fn demande_fermeture(fen: &tauri::Window) {
    let etat = fen.state::<Fermeture>();
    etat.reponse.store(false, Ordering::SeqCst);
    let _ = fen.emit("demande-fermeture", ());
    if etat.veille.swap(true, Ordering::SeqCst) {
        return;
    }
    let fen = fen.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(5));
        let etat = fen.state::<Fermeture>();
        if !etat.reponse.load(Ordering::SeqCst) {
            let reponse = MessageDialog::new()
                .set_level(MessageLevel::Warning)
                .set_title("ConceptCAD")
                .set_description("ConceptCAD est occupé par un calcul et ne répond pas.\n\nFermer quand même ? Les modifications non enregistrées peuvent être perdues.")
                .set_buttons(MessageButtons::YesNo)
                .show();
            if reponse == MessageDialogResult::Yes {
                etat.permise.store(true, Ordering::SeqCst);
                let _ = fen.destroy();
            }
        }
        etat.veille.store(false, Ordering::SeqCst);
    });
}

fn premier_fichier(args: impl Iterator<Item = PathBuf>, dossier: &Path) -> Option<String> {
    args.map(|a| dossier.join(a)).find(|p| p.is_file()).map(|p| std::path::absolute(&p).unwrap_or(p).to_string_lossy().into_owned())
}

fn main() {
    let ici = std::env::current_dir().unwrap_or_default();
    let fichier = premier_fichier(std::env::args_os().skip(1).map(PathBuf::from), &ici);
    tauri::Builder::default()
        // Double-clic alors que l'application est ouverte : même fenêtre, ramenée devant.
        .plugin(tauri_plugin_single_instance::init(|app, args, dossier| {
            if let Some(f) = premier_fichier(args.into_iter().skip(1).map(PathBuf::from), Path::new(&dossier)) {
                if let Ok(mut d) = app.state::<Demarrage>().0.lock() {
                    *d = Some(f);
                }
                let _ = app.emit("fichier-recu", ());
            }
            if let Some(fen) = app.get_webview_window("main") {
                let _ = fen.unminimize();
                let _ = fen.set_focus();
            }
        }))
        .manage(Demarrage(Mutex::new(fichier)))
        .manage(Fermeture::default())
        .on_window_event(|fen, evenement| {
            if let WindowEvent::CloseRequested { api, .. } = evenement {
                if !fen.state::<Fermeture>().permise.load(Ordering::SeqCst) {
                    api.prevent_close();
                    demande_fermeture(fen);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            dialogue_ouvrir, dialogue_enregistrer, dialogue_dossier, lire, infos, lister, creer_dossier, ecrire, titre, fichier_demarrage, fermeture_recue, fermer
        ])
        .run(tauri::generate_context!())
        .expect("démarrage de l'application impossible");
}
