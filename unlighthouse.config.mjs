// Qualitaetswaechter der Hauskonvention (M12). Prueft die live ausgelieferte Seite,
// baut nichts. Mobil, weil die Anzeigen mobil ausgeliefert werden.
export default {
  site: 'https://hainbach-h8.de',
  scanner: {
    device: 'mobile',
    samples: 1,
  },
  ci: {
    // performance is reported as a warning by the workflow, not enforced: live mobile scores
    // vary between runs (77 to 93 on 14.09.2026).
    budget: {
      accessibility: 95,
      'best-practices': 95,
      seo: 95,
    },
    reporter: 'jsonExpanded',
  },
};
