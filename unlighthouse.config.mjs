// Qualitaetswaechter der Hauskonvention (M12). Prueft die live ausgelieferte Seite,
// baut nichts. Mobil, weil die Anzeigen mobil ausgeliefert werden.
export default {
  site: 'https://hainbach-h8.de',
  scanner: {
    device: 'mobile',
    samples: 1,
  },
  ci: {
    budget: {
      performance: 95,
      accessibility: 95,
      'best-practices': 95,
      seo: 95,
    },
    reporter: 'jsonExpanded',
  },
};
