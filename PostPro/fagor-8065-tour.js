/* ───────────────────────────────────────────────────────────────────────────
   Machine : Fagor 8065 T (tour 2 axes X / Z)
   Fiche de TOURNAGE (posages « Tour ») : elle n'apparaît que dans les posages
   de tournage. X est écrit en diamètre (G151), plan G18, G96 / G192 S, G95.
   Repère dans les lignes : {T} numéro d'outil (le correcteur D porte le même).
   ─────────────────────────────────────────────────────────────────────────── */
tourMachine({
  id: 'fagor8065t',              // identifiant enregistré dans les projets : ne pas le changer
  label: 'Fagor 8065 T (tour)',  // nom affiché dans la liste des machines
  kind: 'fagor',                 // dialecte : 'fagor' ou 'siemens'
  ext: 'nc',                     // extension du programme exporté
  numbers: { start: 10, step: 5 },  // lignes N10, N15, N20…
  coolant: { flood: 'M08', off: 'M09' },
  toolChange: ['T{T} D{T}'],     // tourelle : T et son correcteur (ajouter 'M06' si la machine le demande)
  end: ['M30'],
  // Outils tournants et axe C (option « Outils tournants (axe C) » du posage) — À VALIDER sur la machine.
  // {N} n° de la broche de l'outil tournant (réglé dans le posage), {S} tr/min, {M} 3 ou 4, {C} angle en degrés.
  live: {
    caxOn: ['#CAX'],                       // broche principale passée en axe C
    caxOff: ['#CAX OFF'],
    on: ['#MASTER S{N}', 'S{S} M{M}'],     // outil tournant en marche
    off: ['M05', '#MASTER S1'],
    c: 'G0 C{C}'                           // positionnement de l'axe C
  }
});
