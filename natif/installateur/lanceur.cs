// L'installateur : un seul .exe qui porte ConceptCADNatif.zip et installer.ps1 (ressources),
// les dépose dans un dossier temporaire et lance installer.ps1. Compilé par fabriquer.ps1 avec le
// csc du .NET Framework fourni avec Windows.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

static class Lanceur {
  const string Nom = "ConceptCAD Natif (essai)";

  static void Deposer(string ressource, string chemin) {
    using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(ressource))
    using (FileStream f = File.Create(chemin)) s.CopyTo(f);
  }

  [STAThread]
  static int Main(string[] args) {
    // « /maj » : lancé par le programme lui-même pour une mise à jour, l'accord a déjà été donné
    bool maj = Array.IndexOf(args, "/maj") >= 0;
    if (!maj && MessageBox.Show("Installer " + Nom + " ?\n\nLe programme sera copié dans votre dossier utilisateur, avec un raccourci dans le menu Démarrer et sur le bureau.",
                        Nom, MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return 1;
    string d = Path.Combine(Path.GetTempPath(), "ConceptCADNatif-installation-" + Guid.NewGuid().ToString("N").Substring(0, 8));
    try {
      Directory.CreateDirectory(d);
      Deposer("installer.ps1", Path.Combine(d, "installer.ps1"));
      Deposer("ConceptCADNatif.zip", Path.Combine(d, "ConceptCADNatif.zip"));
      ProcessStartInfo p = new ProcessStartInfo("powershell.exe",
          "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + Path.Combine(d, "installer.ps1") + "\"" + (maj ? " -Relancer" : ""));
      p.UseShellExecute = false;
      p.CreateNoWindow = true;
      using (Process q = Process.Start(p)) { q.WaitForExit(); return q.ExitCode; }
    } catch (Exception e) {
      MessageBox.Show("L'installation a échoué :\n" + e.Message, Nom, MessageBoxButtons.OK, MessageBoxIcon.Error);
      return 1;
    } finally {
      try { Directory.Delete(d, true); } catch { }
    }
  }
}
