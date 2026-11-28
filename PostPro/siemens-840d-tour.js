/* ───────────────────────────────────────────────────────────────────────────
   Machine : Siemens 840D en tournage (2 axes X / Z)
   Fiche de TOURNAGE (posages « Tour ») : X en diamètre (DIAMON), plan G18,
   G96 / LIMS=, G95, arcs CR=.
   ─────────────────────────────────────────────────────────────────────────── */
tourMachine({
  id: 'siemens840dt',
  label: 'Siemens 840D T (tour)',
  kind: 'siemens',
  ext: 'mpf',
  numbers: { start: 10, step: 5 },
  coolant: { flood: 'M08', off: 'M09' },
  toolChange: ['T{T} D1'],
  end: ['M30'],
  // Outils tournants et axe C — À VALIDER sur la machine. {N} broche de l'outil tournant, {S} tr/min, {M} 3 ou 4, {C} angle.
  live: {
    caxOn: ['SPOS=0'],                     // broche principale en position (axe C)
    caxOff: [],                            // le M3 / M4 suivant la remet en vitesse
    on: ['M{N}={M} S{N}={S}'],
    off: ['M{N}=5'],
    c: 'SPOS={C}'
  }
});
