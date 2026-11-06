# Essai de l'association .conceptcad pour l'utilisateur courant, sans installateur.
#   associer.ps1 -Exe <chemin du .exe>     pose l'association
#   associer.ps1 -Retirer                  la retire (remet Windows comme avant)
param([string]$Exe,[switch]$Retirer)
$ext='HKCU:\Software\Classes\.conceptcad'
$classe='HKCU:\Software\Classes\ConceptCAD.Essai'
if($Retirer){
  Remove-Item $ext -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $classe -Recurse -Force -ErrorAction SilentlyContinue
}else{
  New-Item $ext -Force | Out-Null
  Set-Item $ext -Value 'ConceptCAD.Essai'
  New-Item "$classe\shell\open\command" -Force | Out-Null
  Set-Item $classe -Value 'Projet ConceptCAD'
  New-Item "$classe\DefaultIcon" -Force | Out-Null
  Set-Item "$classe\DefaultIcon" -Value "`"$Exe`",0"
  Set-Item "$classe\shell\open\command" -Value "`"$Exe`" `"%1`""
}
# prévient l'Explorateur que les associations ont changé
Add-Type -Namespace Win -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e,uint f,System.IntPtr a,System.IntPtr b);'
[Win.Shell]::SHChangeNotify(0x08000000,0,[System.IntPtr]::Zero,[System.IntPtr]::Zero)
