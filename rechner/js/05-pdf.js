/**
 * Kapitalanlage-Rechner Wohnidyll W5, PDF (Plan Arbeitspaket 3, K10).
 *
 * inhalt() ist eine reine Datenstruktur und ohne Browser pruefbar. laden() haengt jsPDF
 * 4.2.1 von cdnjs mit SRI genau einmal in die Seite, erst wenn das Gate oeffnet (Promise
 * gecacht). speichern() rendert A4 hochkant mit Seitenumbruch, Kopf- und Fusszeile und
 * ruft doc.save(). Zahlen kommen aus lead.js (Ladefolge K1), damit Seite, Mail und PDF
 * gleich runden.
 */
(function (AMR) {
  'use strict';
  var K = AMR.konstanten;
  var LINKS = 18, RECHTS = 192, OBEN = 24, UNTEN = 272; // A4 hochkant, Masse in mm
  var GRAU = [90, 100, 112], LINIE = [180, 186, 194];

  function wirt() { return typeof window !== 'undefined' ? window : global; }
  function zahl(wert, min, max) { return AMR.lead.zahl(wert, min, max); }
  function eur(wert) { return zahl(Math.round(wert), 0, 0) + ' €'; } // Helvetica WinAnsi deckt das Zeichen

  function datum(jetzt) {
    var d = jetzt instanceof Date ? jetzt : new Date();
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
  }

  function wohnungText(eingaben) {
    var w = AMR.modell.wohnungVon(eingaben.wohnung);
    return w ? 'Nr. ' + w.nr + ' (' + w.lage + ', ' + w.zimmer + ' Zimmer)' : 'freie Eingabe';
  }

  /** Ergebnis der 5.200-EUR-Pruefung nach § 7b EStG, als ganzer Satz. */
  function sonderAfaSatz(ergebnis) {
    var ist = zahl(Math.round(ergebnis.kostenJeM2), 0, 0) + ' €/m²';
    var grenze = zahl(K.STEUER.sonderAfaKostenGrenzeJeM2, 0, 0) + ' €/m²';
    if (!ergebnis.sonderAfaBerechtigt) return 'greift nicht: ' + ist + ' Gebäudeanteil liegen über ' + grenze;
    if (!ergebnis.sonderAfaAktiv) return 'abgeschaltet, obwohl ' + ist + ' Gebäudeanteil unter ' + grenze + ' liegen';
    return 'greift: ' + ist + ' Gebäudeanteil liegen unter ' + grenze;
  }

  /**
   * Bezugsgroesse der Euro je m² im Abschnitt Annahmen (h8-funnel K10). Bei Faktor 1,0 ist
   * der Nenner der § 7b-Pruefung die Wohnflaeche wie bisher; ein anderer Faktor bildet die
   * Nutzflaeche oder den BGF-Anteil ab (BMF-Schreiben vom 21.05.2025, Rn. 49 und 51), dann
   * waere "je m² Wohnfläche" falsch beschriftet.
   */
  function flaechenFaktor() { return K.STEUER.flaechenFaktorGrenze || 1; }
  function gebaeudeanteilLabel() {
    return 'Gebäudeanteil je m² ' + (flaechenFaktor() === 1 ? 'Wohnfläche' : 'Nutzfläche (BGF-Anteil)');
  }

  // Labels und Einheiten aus K.EINGABEN, damit Seite und PDF dasselbe zeigen.
  function eingabeZeilen(eingaben, ergebnis) {
    return K.EINGABEN.map(function (feld) {
      var wert = eingaben[feld.schluessel];
      if (feld.schluessel === 'wohnung') wert = wohnungText(eingaben);
      else if (feld.schluessel === 'stellplatz') wert = wert + ' (' + eur(ergebnis.stellplatzpreis) + ')';
      else if (feld.typ === 'zahl') wert = zahl(wert, 0, 2) + (feld.einheit ? ' ' + feld.einheit.replace('EUR', '€') : '');
      return [feld.label + (feld.hinweis ? ', ' + feld.hinweis : ''), String(wert)];
    });
  }

  function jahresZeilen(ergebnis) {
    return ergebnis.jahre.map(function (z) {
      return [String(z.jahr)].concat([z.miete, z.zinsen, z.tilgung, z.afaRegulaer + z.sonderAfa,
        z.steuer, z.cashflowNachSteuer, z.restschuldEnde].map(function (wert) {
        return zahl(Math.round(wert), 0, 0);
      }));
    });
  }

  function annahmeZeilen(eingaben, ergebnis) {
    var zeilen = [
      ['Sonder-AfA § 7b EStG', sonderAfaSatz(ergebnis)],
      [gebaeudeanteilLabel(), zahl(Math.round(ergebnis.kostenJeM2), 0, 0) + ' €/m²']
    ];
    // Bei einem Faktor ungleich 1,0 steht die gepruefte Flaeche als eigene Zeile darunter,
    // sonst bleibt offen, worauf sich die Euro je m² beziehen (h8-funnel K10).
    if (flaechenFaktor() !== 1) {
      zeilen.push(['Nutzfläche für die ' + zahl(K.STEUER.sonderAfaKostenGrenzeJeM2, 0, 0) + '-EUR-Prüfung',
        zahl(ergebnis.grenzFlaeche, 2, 2) + ' m², BGF-Anteil']);
    }
    // Null bis eine Nachkommastelle, damit W5 weiter "30 %" zeigt und ein aus dem
    // Grundstueckswert abgeleiteter Anteil nicht gerundet erscheint (h8-funnel K2).
    zeilen.push(['Bodenanteil, Annahme bis die Kaufpreisaufteilung vorliegt',
      zahl(eingaben.bodenanteilProzent, 0, 1) + ' %']);
    // Der Stellplatz steht nur bei STELLPLATZ_MODELL 'getrennt' als eigenes Wirtschaftsgut mit
    // eigener Miete und eigener AfA in der Rechnung, deshalb gehoert er dort zu den Annahmen
    // (h8-funnel K10). Bei 'imGebaeude' steckt er im Gesamtkaufpreis und ist mit der Zeile im
    // Abschnitt "Ihre Eingaben" abgedeckt. Ohne gewaehlten Stellplatz bleibt die Zeile weg.
    if (K.STELLPLATZ_MODELL === 'getrennt' && eingaben.stellplatz !== 'keiner') {
      zeilen.push(['Stellplatz',
        AMR.modell.stellplatzVon(eingaben.stellplatz).label + ', ' + eur(ergebnis.stellplatzpreis)]);
    }
    return zeilen.concat(K.RECHTSGRUNDLAGEN.map(function (g) { return [g.regel, g.quelle + ', geprüft ' + g.geprueft]; }),
      [['Nicht modelliert', K.TEXTE.nichtModelliert.join(', ')]]);
  }

  function kontaktZeilen() {
    var zeilen = K.KONTAKT.map(function (k) { return [k.name, k.telefon + ', ' + k.mail]; });
    if (K.TERMIN_URL) zeilen.push(['Gesprächstermin', K.TERMIN_URL]);
    return zeilen;
  }

  /** Abschnitte in der Reihenfolge aus K10, Schluessel wie K.PDF.abschnitte. */
  function inhalt(eingaben, ergebnis, jetzt) {
    return [
      { schluessel: 'kopf', titel: K.PDF.kopfTitel, zeilen: [
        ['Datum', datum(jetzt)], ['Version des Rechners', K.VERSION],
        ['Objekt', K.PDF.objektZeile], ['Betrachtungszeitraum', K.STEUER.betrachtungJahre + ' Jahre']
      ] },
      { schluessel: 'eingaben', titel: 'Ihre Eingaben', zeilen: eingabeZeilen(eingaben, ergebnis) },
      { schluessel: 'ergebnis', titel: 'Ergebnis nach ' + K.STEUER.betrachtungJahre + ' Jahren', zeilen: [
        ['Immobilienwert am Ende', eur(ergebnis.immobilienwertEnde)], ['Restschuld am Ende', eur(ergebnis.restschuldEnde)],
        ['Nettovermögen, Wert minus Restschuld', eur(ergebnis.nettovermoegenEnde)],
        ['Summe der Cashflows nach Steuern', eur(ergebnis.summeCashflow)],
        ['Vermögen inklusive Cashflows', eur(ergebnis.vermoegenEnde)], ['Gewinn gegenüber dem Eigenkapital', eur(ergebnis.gewinn)],
        ['Faktor auf das Eigenkapital', zahl(ergebnis.faktor, 2, 2)], ['Rendite p. a., interner Zinsfuss', zahl(ergebnis.irrProzent, 2, 2) + ' %'],
        ['Cashflow nach Steuern, Jahr 1', eur(ergebnis.cashflowNachSteuerMonatJahr1) + ' im Monat'],
        ['Cashflow vor Steuern, Jahr 1', eur(ergebnis.cashflowVorSteuerMonatJahr1) + ' im Monat'],
        ['durchschnittlicher Zuschuss', eur(ergebnis.zuschussMonatDurchschnitt) + ' im Monat'],
        ['Kaufnebenkosten', eur(ergebnis.nebenkosten)], ['Darlehen', eur(ergebnis.darlehen)],
        ['Annuität', eur(ergebnis.annuitaetMonat) + ' im Monat']
      ] },
      { schluessel: 'jahre', titel: 'Jahresübersicht, alle Werte in Euro', tabelle: {
        kopf: ['Jahr', 'Miete', 'Zinsen', 'Tilgung', 'AfA gesamt', 'Steuer', 'Cashflow n. St.', 'Restschuld'],
        zeilen: jahresZeilen(ergebnis)
      } },
      { schluessel: 'annahmen', titel: 'Annahmen und Steuerregeln', zeilen: annahmeZeilen(eingaben, ergebnis) },
      { schluessel: 'objekt', titel: 'Das Objekt', zeilen: [
        ['Lage', K.PROJEKT.ort], ['Einheiten', K.PROJEKT.einheiten + ', davon frei ' + K.PROJEKT.frei],
        ['Wohnungsgrössen', K.PROJEKT.flaeche], ['Standard', K.PROJEKT.standard],
        ['Fertigstellung', K.PROJEKT.fertigstellung], ['Ihre Wohnung', wohnungText(eingaben)],
        ['Kauf', K.PROJEKT.provisionsfrei ? 'provisionsfrei' : 'mit Provision']
      ] },
      { schluessel: 'kontakt', titel: 'Ihre Ansprechpartner', zeilen: kontaktZeilen() },
      { schluessel: 'disclaimer', titel: 'Hinweis', text: K.TEXTE.disclaimer }
    ];
  }

  // Laufendes Versprechen; nach einem Fehler wieder null, damit ein zweiter Versuch laedt.
  var laufend = null;

  /** Haengt jsPDF genau einmal in die Seite. Der Parameter dokument dient den Tests. */
  function laden(dokument) {
    var w = wirt();
    if (w.jspdf && w.jspdf.jsPDF) return Promise.resolve();
    if (laufend) return laufend;
    var dok = dokument || (typeof document !== 'undefined' ? document : null);
    if (!dok) return Promise.reject(new Error('kein Dokument'));
    laufend = new Promise(function (fertig, gescheitert) {
      var skript = dok.createElement('script');
      skript.src = K.PDF.quelle; skript.integrity = K.PDF.integrity;
      skript.crossOrigin = 'anonymous'; skript.async = true;
      skript.onload = function () { fertig(); };
      skript.onerror = function () { laufend = null; gescheitert(new Error('jsPDF nicht geladen')); };
      (dok.head || dok.body).appendChild(skript);
    });
    return laufend;
  }

  function kopfUndFuss(doc) {
    var seiten = doc.getNumberOfPages();
    for (var s = 1; s <= seiten; s++) {
      doc.setPage(s); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(GRAU[0], GRAU[1], GRAU[2]); doc.setDrawColor(LINIE[0], LINIE[1], LINIE[2]);
      doc.text(K.PDF.fussLinks, LINKS, 14); doc.text(K.PDF.fussRechts, RECHTS, 14, { align: 'right' });
      doc.line(LINKS, 16.5, RECHTS, 16.5); doc.line(LINKS, 279, RECHTS, 279);
      doc.text('Seite ' + s + ' von ' + seiten, LINKS, 284);
      doc.text('Version ' + K.VERSION + ', Stand ' + K.PRUEFDATUM, RECHTS, 284, { align: 'right' });
      doc.setTextColor(29, 33, 37);
    }
    return doc;
  }

  /** Zeichnet die Abschnitte. Oeffentlich, damit Werkzeuge ohne Browser rendern koennen. */
  function zeichne(doc, abschnitte) {
    var y = OBEN;
    function neueSeite() { doc.addPage(); y = OBEN; }
    function platz(hoehe) { if (y + hoehe > UNTEN) neueSeite(); }
    function strich() { doc.setDrawColor(LINIE[0], LINIE[1], LINIE[2]); doc.line(LINKS, y, RECHTS, y); }
    function titel(text) {
      platz(18);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(text, LINKS, y);
      y += 2.5; strich(); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    }
    function zeile(label, wert) {
      var links = doc.splitTextToSize(String(label), 84), rechts = doc.splitTextToSize(String(wert), 84);
      var hoehe = Math.max(links.length, rechts.length) * 5;
      platz(hoehe);
      doc.text(links, LINKS, y);
      doc.text(rechts, RECHTS, y, { align: 'right' });
      y += hoehe;
    }
    function tabelle(kopf, zeilen) {
      var kanten = [], rand = LINKS;
      [10, 24, 23, 23, 24, 23, 24, 23].forEach(function (breite) { rand += breite; kanten.push(rand); });
      function reihe(werte) {
        werte.forEach(function (wert, s) { doc.text(String(wert), kanten[s], y, { align: 'right' }); });
      }
      function kopfzeile() {
        platz(12);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        reihe(kopf);
        y += 1.8; strich(); y += 4.4;
        doc.setFont('helvetica', 'normal');
      }
      kopfzeile();
      zeilen.forEach(function (werte) {
        if (y + 5 > UNTEN) { neueSeite(); kopfzeile(); }
        reihe(werte);
        y += 5;
      });
      doc.setFontSize(10);
    }
    function absatz(text) {
      doc.setFontSize(9);
      doc.splitTextToSize(String(text), RECHTS - LINKS).forEach(function (teil) {
        platz(5); doc.text(teil, LINKS, y); y += 4.6;
      });
      doc.setFontSize(10);
    }
    abschnitte.forEach(function (ab) {
      titel(ab.titel);
      if (ab.zeilen) ab.zeilen.forEach(function (z) { zeile(z[0], z[1]); });
      if (ab.tabelle) tabelle(ab.tabelle.kopf, ab.tabelle.zeilen);
      if (ab.text) absatz(ab.text);
      y += 6;
    });
    return kopfUndFuss(doc);
  }

  /** Laedt jsPDF (falls noetig), rendert und speichert die Auswertung. */
  function speichern(eingaben, ergebnis, optionen) {
    var opt = optionen || {};
    return (opt.jsPDF ? Promise.resolve() : laden(opt.dokument)).then(function () {
      var Bauer = opt.jsPDF || wirt().jspdf.jsPDF;
      var doc = new Bauer({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      zeichne(doc, inhalt(eingaben, ergebnis, opt.jetzt || new Date()));
      doc.save(K.PDF.dateiname);
    });
  }

  AMR.pdf = { inhalt: inhalt, laden: laden, zeichne: zeichne, speichern: speichern };
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.pdf;