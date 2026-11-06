# Remplit une vraie fenêtre Windows « Ouvrir » / « Enregistrer sous » de l'application, sans toucher
# au clavier ni à la souris de la personne qui utilise le PC.
#   fenetre-windows.ps1 -AppId <pid> -Chemin <chemin> [-Attente 20]   ou   -Annuler
param([int]$AppId,[string]$Chemin,[int]$Attente=20,[switch]$Annuler)
Add-Type -TypeDefinition @'
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class Fen{
  delegate bool Vu(IntPtr h,IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(Vu f,IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p,Vu f,IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,string l);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
  static string Cl(IntPtr h){var s=new StringBuilder(64);GetClassName(h,s,64);return s.ToString();}
  public static string Titre(IntPtr h){var s=new StringBuilder(256);GetWindowText(h,s,256);return s.ToString();}
  public static IntPtr Dialogue(uint pid){
    IntPtr t=IntPtr.Zero;
    EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid&&IsWindowVisible(h)&&Cl(h)=="#32770"){t=h;return false;}return true;},IntPtr.Zero);
    return t;
  }
  public static IntPtr ChampNom(IntPtr d){
    IntPtr t=IntPtr.Zero;
    // 1148 : Ouvrir ; 1001 : Enregistrer sous ; 1152 : choix d'un dossier
    EnumChildWindows(d,(h,l)=>{if(Cl(h)=="Edit"){int i=GetDlgCtrlID(h);if(i==1148||i==1001||i==1152){t=h;return false;}}return true;},IntPtr.Zero);
    return t;
  }
  public static void Remplir(IntPtr e,string v){SendMessage(e,0x000C,IntPtr.Zero,v);}
  public static void Bouton(IntPtr d,int id){PostMessage(d,0x0111,(IntPtr)id,IntPtr.Zero);} // WM_COMMAND
}
'@
$fin=(Get-Date).AddSeconds($Attente)
$dlg=[IntPtr]::Zero
while($dlg -eq [IntPtr]::Zero -and (Get-Date) -lt $fin){
  $dlg=[Fen]::Dialogue([uint32]$AppId)
  if($dlg -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 150}
}
if($dlg -eq [IntPtr]::Zero){Write-Output 'AUCUNE FENETRE';exit 2}
Write-Output ('FENETRE:'+[Fen]::Titre($dlg))
if($Annuler){Start-Sleep -Milliseconds 500;[Fen]::Bouton($dlg,2);Write-Output 'ANNULE';exit 0}
$edit=[IntPtr]::Zero
$fin=(Get-Date).AddSeconds(8)
while($edit -eq [IntPtr]::Zero -and (Get-Date) -lt $fin){
  $edit=[Fen]::ChampNom($dlg)
  if($edit -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 200}
}
if($edit -eq [IntPtr]::Zero){
  [Fen]::Bouton($dlg,2) # ne jamais laisser une fenêtre ouverte : quelqu'un pourrait y choisir un vrai fichier
  Write-Output 'CHAMP NOM INTROUVABLE';exit 3
}
Start-Sleep -Milliseconds 400
[Fen]::Remplir($edit,$Chemin)
Start-Sleep -Milliseconds 200
[Fen]::Bouton($dlg,1)
Write-Output 'OK'
