; La désinstallation de Tauri laisse l'association .conceptcad : on la retire ici.
; Lors d'une mise à jour, le nouvel installateur la repose aussitôt.
!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\.conceptcad"
  DeleteRegKey HKCU "Software\Classes\Projet ConceptCAD"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.conceptcad"
!macroend
