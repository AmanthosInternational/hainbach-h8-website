/**
 * Mandant H8 der Rechner-Engine (Plan h8-funnel Arbeitspaket 1, K6 bis K10).
 *
 * Klassisches Skript, kein ESM, kein Bundler. Namensraum ist window.AMR im Browser und
 * global.AMR in Node. Diese Datei wird als erste geladen; alle anderen Module lesen
 * AMR.konstanten beim Laden. Sie enthaelt alles, was von der Hainbachstrasse 8 in
 * Esslingen abhaengt, und sonst nichts: die Engine unter rechner/ bleibt mandantenfrei.
 *
 * Zwei Dinge sind hier anders als bei W5 und der Grund, warum es diese Datei gibt:
 * der Stellplatz ist ein eigenes Wirtschaftsgut (STELLPLATZ_MODELL 'getrennt') und die
 * Baukostenobergrenze des § 7b EStG wird auf der Bruttogrundflaeche geprueft
 * (STEUER.flaechenFaktorGrenze), nicht auf der Wohnflaeche.
 */
(function (AMR) {
  'use strict';

  // Mandantenkuerzel, gleich dem Dateinamen. bauen.py setzt es beim Bau erneut, damit
  // Block und Mandantendatei nicht auseinanderlaufen koennen (K5).
  var SLUG = 'h8';

  // Stichtag aller Rechts- und Marktangaben dieser Datei. Steht auch im Disclaimer.
  var PRUEFDATUM = '09.09.2026';

  // ---------------------------------------------------------------------------
  // K6 Fakten H8. Quellen: Wohnungsliste v12 (Wohnflaeche inkl. 50 % Balkon, Kaufpreis,
  // Kaltmiete je m²), Faktenblatt 09.09.2026, Broschuere Juli Seite 31 (provisionsfrei).
  // ---------------------------------------------------------------------------

  // Zwoelf Einheiten, Summe 529,88 m² und 3.563.000 EUR. Titel und Status sind Vertriebs-
  // angaben: bis die Preis- und Reservierungsliste vorliegt (V5) stehen alle auf 'frei'.
  var WOHNUNGEN = [
    { nr: 1, lage: 'Gartengeschoss', zimmer: 2, wohnflaeche: 54.70, kaufpreis: 375000, mieteJeM2: 21.0, titel: 'Gartenwohnung mit Terrasse', status: 'frei' },
    { nr: 2, lage: 'Erdgeschoss', zimmer: 3, wohnflaeche: 64.05, kaufpreis: 439000, mieteJeM2: 21.5, titel: 'Familienwohnung mit Terrasse', status: 'frei' },
    { nr: 3, lage: '1. OG', zimmer: 1, wohnflaeche: 36.52, kaufpreis: 230000, mieteJeM2: 21.0, titel: 'Apartment mit Balkon', status: 'frei' },
    { nr: 4, lage: '1. OG', zimmer: 2, wohnflaeche: 43.81, kaufpreis: 300000, mieteJeM2: 23.0, titel: '2-Zimmer-Wohnung mit zwei Balkonen', status: 'frei' },
    { nr: 5, lage: '1. OG', zimmer: 1, wohnflaeche: 27.49, kaufpreis: 188000, mieteJeM2: 24.0, titel: 'Kompaktes Apartment mit Balkon', status: 'frei' },
    { nr: 6, lage: '2. OG', zimmer: 1, wohnflaeche: 38.57, kaufpreis: 243000, mieteJeM2: 20.0, titel: 'Apartment mit zwei Balkonen', status: 'frei' },
    { nr: 7, lage: '2. OG', zimmer: 2, wohnflaeche: 44.31, kaufpreis: 304000, mieteJeM2: 23.0, titel: '2-Zimmer-Wohnung mit zwei Balkonen', status: 'frei' },
    { nr: 8, lage: '2. OG', zimmer: 1, wohnflaeche: 27.49, kaufpreis: 188000, mieteJeM2: 23.0, titel: 'Kompaktes Apartment mit Balkon', status: 'frei' },
    { nr: 9, lage: '3. OG', zimmer: 1, wohnflaeche: 38.41, kaufpreis: 242000, mieteJeM2: 20.0, titel: 'Apartment mit Balkon und Aussicht', status: 'frei' },
    { nr: 10, lage: '3. OG', zimmer: 2, wohnflaeche: 44.12, kaufpreis: 302000, mieteJeM2: 23.0, titel: '2-Zimmer-Wohnung mit zwei Balkonen', status: 'frei' },
    { nr: 11, lage: '3. OG', zimmer: 1, wohnflaeche: 27.49, kaufpreis: 188000, mieteJeM2: 23.0, titel: 'Kompaktes Apartment mit Balkon', status: 'frei' },
    { nr: 12, lage: 'Dachgeschoss', zimmer: 3, wohnflaeche: 82.92, kaufpreis: 564000, mieteJeM2: 19.0, titel: 'Penthouse mit zwei Balkonen und Arbeitszimmer', status: 'frei' }
  ];

  // Zwoelf Doppelparker rueckwaerts auf dem Grundstueck, einer je Wohnung, keine Tiefgarage.
  // Verkaufspreis je 20.000 EUR (Cashflowanalyse, Blatt Stellplatz-Uebersicht, 08.09.2026).
  var STELLPLAETZE = [
    { schluessel: 'keiner', label: 'kein Stellplatz', preis: 0 },
    { schluessel: 'doppelparker', label: 'Doppelparker', preis: 20000 }
  ];

  // Der Doppelparker ist kein Gebaeudeteil, sondern ein eigenes Wirtschaftsgut: eigene
  // Miete, eigene lineare AfA, und er bleibt aus der § 7b-Pruefung heraus (K7). Das ist die
  // konservative Lesart; BMF Rn. 50 zaehlt zur Wohnung gehoerende Garagen zur Nutzflaeche.
  var STELLPLATZ_MODELL = 'getrennt';
  var STELLPLATZ_GETRENNT = { mieteMonat: 100, afaLinear: 0.02 };

  // Bodenanteil je Wohnung aus dem Grundstueckswert, anteilig nach Wohnflaeche. 900.000 EUR
  // ist der Wert des AfA-Blatts der Wohnungsliste und der Preis, zu dem die Services GmbH
  // an die Projektgesellschaft verkaufen soll (Meeting 08.09.2026). Bis die
  // Kaufpreisaufteilung vorliegt, ist das eine Annahme (V7).
  var BODEN = { art: 'grundstueck', wert: 900000, wohnflaecheGesamt: 529.88 };

  // Startwerte fuer die freie Eingabe: ungefaehr eine mittlere Zwei-Zimmer-Wohnung.
  var FREI = { kaufpreis: 300000, wohnflaeche: 45 };

  // Faktenblatt 09.09.2026. Name und Domain sind am 10.09.2026 entschieden (V1): das Projekt
  // heisst Hainbach H8 nach der Adresse Hainbachstrasse 8 und laeuft auf hainbach-h8.de.
  // Herleitung im Dossier, docs/research/projektname-und-domain-2026-09-10.md.
  var PROJEKT = {
    name: 'Hainbach H8',
    kurz: 'H8',
    domain: 'hainbach-h8.de',
    pfad: '/rechner/',
    einheiten: 12,
    frei: 12,
    flaeche: '27 bis 83 m²',
    standard: 'KfW 40 QNG',
    // Fertigstellungsjahr offen (V5), deshalb steht hier der belegte Baubeginn.
    fertigstellung: 'Baubeginn Frühjahr 2027',
    ort: 'Esslingen am Neckar, Oberesslingen (Baden-Württemberg)',
    adresse: 'Hainbachstrasse 8, 73730 Esslingen am Neckar',
    baugenehmigung: '27.08.2026',
    bauantrag: '28.11.2025',
    // Bruttogrundflaeche nach DIN 277 aus dem Projektangebot vom 02.09.2026, Planstand
    // 12.11.2025 des Bauantrags. Nenner der § 7b-Pruefung, siehe STEUER.
    bgf: 790.40,
    provisionsfrei: true
  };

  // Leer bis die H8-Broschuere mit Genehmigungsdatum und Preisliste vorliegt (V6).
  var BROSCHUERE_URL = '';

  // Festnetz und Firmen-Mail, oeffentliche Angaben des Hauses. Keine Mobilnummern,
  // keine Interessentendaten.
  var KONTAKT = [
    { name: 'Julian Neyer', telefon: '+49 (0) 711 209 095 75', mail: 'julian.neyer@amanthos.com' },
    { name: 'Bosko Trifunovic', telefon: '+49 (0) 711 209 095 67', mail: 'bosko.trifunovic@amanthos.com' }
  ];

  // Leer bis die Buchungsstrecke eingerichtet ist (V11); leer bedeutet: nur KONTAKT zeigen.
  var TERMIN_URL = '';

  var CAL = {
    link: 'julian-neyer/hainbach-h8',
    raum: 'hainbach-h8',
    skript: 'https://app.cal.com/embed/embed.js',
    ursprung: 'https://app.cal.com'
  };

  // Fertig zusammengesetzt, weil ui.js jede Zeile zaehlt. Cal.com faengt den Klick ueber
  // data-cal-link selbst ab; ohne TERMIN_URL bleibt das Attribut leer.
  var TERMIN_ATTRIBUTE = TERMIN_URL
    ? 'data-cal-link="' + CAL.link + '" data-cal-namespace="' + CAL.raum +
      '" data-cal-config=\'{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}\''
    : '';

  // Wird von bauen.py durch acht Hexzeichen der SHA-256 ueber die Bausteine ersetzt.
  var VERSION = 'c0156d51';

  // ---------------------------------------------------------------------------
  // K7 Steuer- und Rechenregeln Baden-Wuerttemberg. Jede Angabe am 09.09.2026 geprueft:
  // Bundesrecht an gesetze-im-internet.de, das Landesgesetz an landesrecht-bw.de, das
  // BMF-Schreiben am Volltext in docs/quellen des Projektarchivs.
  // ---------------------------------------------------------------------------
  var STEUER = {
    // § 11 Abs. 1 GrEStG nennt 3,5 vom Hundert; die Laender duerfen den Satz seit dem
    // 01.09.2006 selbst bestimmen (Art. 105 Abs. 2a Satz 2 GG). Baden-Wuerttemberg hat das
    // getan: Gesetz ueber die Festsetzung des Steuersatzes fuer die Grunderwerbsteuer vom
    // 26.10.2011, § 1, gueltig ab 05.11.2011, 5 vom Hundert. Geprueft 09.09.2026.
    grunderwerbsteuer: 0.05,
    // Annahme, kein Gesetzeswert: GNotKG-Orientierung, marktueblich 1,5 bis 2,0 % Notar
    // plus 0,5 % Grundbuch. Dr. Klein rechnet in der Musterfinanzierung vom 18.08.2026 mit
    // 2,5 %; der Rechner bleibt bei 2,0 % wie W5. Als Annahme beschriftet. 09.09.2026.
    notarGrundbuch: 0.02,
    // Broschuere Seite 31: provisionsfrei. Geprueft 09.09.2026.
    makler: 0,
    // § 7 Abs. 4 Satz 1 Nr. 2 Buchst. a EStG: "nach dem 31. Dezember 2022 fertiggestellt
    // worden sind, jaehrlich 3 Prozent". Geprueft 09.09.2026.
    afaLinear: 0.03,
    // § 7 Abs. 5a EStG: "5 Prozent vom jeweiligen Buchwert (Restwert)"; Baubeginn nach dem
    // 30.09.2023 und vor dem 01.10.2029, geplant ist Fruehjahr 2027. Geprueft 09.09.2026.
    afaDegressiv: 0.05,
    // § 7b Abs. 1 EStG: "jaehrlich 5 Prozent der Bemessungsgrundlage" im Jahr der
    // Anschaffung "und in den folgenden drei Jahren". Geprueft 09.09.2026.
    sonderAfaSatz: 0.05,
    sonderAfaJahre: 4,
    // § 7b Abs. 2 Satz 2 Nr. 2 EStG, Bauantrag nach dem 31.12.2022 und vor dem 01.10.2029:
    // hoechstens "5 200 Euro je Quadratmeter". Bauantrag H8 vom 28.11.2025, liegt im
    // Fenster. Geprueft 09.09.2026.
    sonderAfaKostenGrenzeJeM2: 5200,
    // § 7b Abs. 3 EStG: Bemessungsgrundlage "maximal 4 000 Euro je Quadratmeter"
    // Wohnflaeche. Der Rechner legt sie auf die Wohnflaeche, obwohl BMF Rn. 60 die
    // Nutzflaeche zulaesst: das ist die kleinere und damit vorsichtigere Zahl.
    // Geprueft 09.09.2026.
    sonderAfaBemessungMaxJeM2: 4000,
    // § 23 Abs. 1 Satz 1 Nr. 1 EStG: steuerfrei, wenn "der Zeitraum zwischen Anschaffung
    // und Veraeusserung nicht mehr als zehn Jahre betraegt". Geprueft 09.09.2026.
    betrachtungJahre: 10,
    // Nenner der 5.200-EUR-Pruefung, hier die Bruttogrundflaeche statt der Wohnflaeche.
    // BMF-Schreiben vom 21.05.2025, Rn. 49: bei einer Eigentumswohnung ist die den
    // Eigentumsrechten entsprechende Nutzflaeche des erworbenen Anteils massgebend, und
    // Rn. 51: alternativ darf die Bruttogrundflaeche nach DIN 277 herangezogen werden,
    // wenn sie aus den Bauunterlagen nachgewiesen wird. BGF 790,40 m² (Projektangebot
    // 02.09.2026), Wohnflaeche 529,88 m² (Wohnungsliste v12). Auf Wohnflaechenbasis
    // scheiterten neun der zwoelf Einheiten an der Grenze, auf BGF-Basis halten sie alle.
    // Die Lesart bestaetigt die Steuerberatung (V8). Geprueft 09.09.2026.
    flaechenFaktorGrenze: 790.40 / 529.88
  };

  // Dieselben Angaben als Daten, damit Seite und PDF sie zeigen koennen, ohne sie zu
  // wiederholen. Reihenfolge wie die Tabelle K7 des Bauplans.
  var RECHTSGRUNDLAGEN = [
    { regel: 'Grunderwerbsteuer Baden-Württemberg 5,0 %', quelle: 'Landesgesetz vom 26.10.2011 § 1, gültig ab 05.11.2011, zu § 11 Abs. 1 GrEStG', geprueft: PRUEFDATUM },
    { regel: 'Notar und Grundbuch 2,0 % (Annahme, kein Gesetzeswert)', quelle: 'GNotKG-Orientierung', geprueft: PRUEFDATUM },
    { regel: 'Maklerprovision 0 %', quelle: 'Broschüre Seite 31, provisionsfrei', geprueft: PRUEFDATUM },
    { regel: 'Lineare AfA Neubau 3 % p. a.', quelle: '§ 7 Abs. 4 Satz 1 Nr. 2 Buchst. a EStG', geprueft: PRUEFDATUM },
    { regel: 'Degressive AfA Wohngebäude 5 % p. a. vom Restwert', quelle: '§ 7 Abs. 5a EStG', geprueft: PRUEFDATUM },
    { regel: 'Sonder-AfA Mietwohnungsneubau 5 % p. a. in vier Jahren', quelle: '§ 7b Abs. 1 bis 3 EStG, BMF-Schreiben vom 21.05.2025', geprueft: PRUEFDATUM },
    { regel: 'Baukostenobergrenze 5.200 EUR je m², Bauantrag vom 28.11.2025', quelle: '§ 7b Abs. 2 Satz 2 Nr. 2 EStG, BMF-Schreiben vom 21.05.2025 Rn. 48', geprueft: PRUEFDATUM },
    { regel: 'Nebenkosten zählen zum Gebäudeanteil und damit in die Baukostenobergrenze', quelle: '§ 255 Abs. 1 HGB, BMF-Schreiben vom 21.05.2025 Rn. 39 und 47', geprueft: PRUEFDATUM },
    { regel: 'Prüfung je m² Nutzfläche des erworbenen Anteils, ersatzweise je m² Bruttogrundfläche nach DIN 277 (790,40 m² statt 529,88 m²)', quelle: 'BMF-Schreiben vom 21.05.2025 Rn. 49 und 51', geprueft: PRUEFDATUM },
    { regel: 'Bemessungsgrundlage höchstens 4.000 EUR je m², hier auf die Wohnfläche gerechnet', quelle: '§ 7b Abs. 3 EStG, BMF-Schreiben vom 21.05.2025 Rn. 60', geprueft: PRUEFDATUM },
    { regel: 'Stellplatz 2 % linear auf Preis plus Nebenkosten, ohne § 7b', quelle: '§ 7 Abs. 1 EStG, Cashflowanalyse Blatt Stellplatz-Übersicht', geprueft: PRUEFDATUM },
    { regel: 'Restwert sinkt um reguläre und Sonder-AfA', quelle: '§ 7a Abs. 9 EStG', geprueft: PRUEFDATUM },
    { regel: 'Grenzsteuersatz 0 bis 45 %, ohne Soli und Kirchensteuer', quelle: '§ 32a EStG, Fassung ab VZ 2026', geprueft: PRUEFDATUM },
    { regel: 'Verluste aus Vermietung mindern das übrige Einkommen', quelle: '§ 2 Abs. 3 und § 21 EStG', geprueft: PRUEFDATUM },
    { regel: 'Veräusserung nach zehn Jahren steuerfrei', quelle: '§ 23 Abs. 1 Satz 1 Nr. 1 EStG', geprueft: PRUEFDATUM }
  ];

  // ---------------------------------------------------------------------------
  // K8 Eingaben und Vorgaben
  // ---------------------------------------------------------------------------

  // Durchschnitt der zwoelf Kaltmieten der Wohnungsliste v12 (19,0 bis 24,0 EUR/m²).
  // Gilt nur fuer die freie Eingabe: jede Wohnung bringt ihre eigene Miete mit.
  // Annahme, keine Zusage. Erhebungsstand 09.09.2026.
  var MIETE_JE_M2_VORGABE = 21.5;

  // Bankanteil der Dr.-Klein-Musterfinanzierung vom 18.08.2026: ca. 4,01 % Sollzins,
  // Beleihung 83 bis 88 %. Auf 4,0 gerundet. Das zinsguenstige KfW-298-Darlehen
  // (150.000 EUR je Einheit, 2,68 % effektiv) bildet der Rechner nicht ab.
  var ZINS_VORGABE = 4.0;

  // Reihenfolge = Anzeigereihenfolge. ui.js rendert daraus die Regler und Wahlfelder,
  // modell.vorgaben() baut daraus den Startsatz. Eintraege mit ausWohnung: true werden
  // gesperrt, sobald eine Wohnungsnummer gewaehlt ist.
  var EINGABEN = [
    { schluessel: 'wohnung', typ: 'wahl', optionen: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'frei'], vorgabe: 5, label: 'Wohnung' },
    { schluessel: 'kaufpreis', typ: 'zahl', min: 150000, max: 800000, schritt: 1000, ausWohnung: true, label: 'Kaufpreis', einheit: 'EUR' },
    { schluessel: 'wohnflaeche', typ: 'zahl', min: 20, max: 100, schritt: 0.5, ausWohnung: true, label: 'Wohnfläche', einheit: 'm²' },
    { schluessel: 'stellplatz', typ: 'wahl', optionen: STELLPLAETZE.map(function (platz) { return platz.schluessel; }), vorgabe: 'keiner', label: 'Stellplatz', hinweis: 'Doppelparker, Miete ca. 100 EUR/Monat, eigenes Wirtschaftsgut mit 2 % linearer AfA' },
    { schluessel: 'mieteMonat', typ: 'zahl', min: 300, max: 3000, schritt: 10, label: 'Kaltmiete', einheit: 'EUR/Monat', hinweis: 'Annahme, Wohnungsliste v12, 19 bis 24 EUR/m²' },
    { schluessel: 'eigenkapital', typ: 'zahl', min: 0, max: 600000, schritt: 1000, label: 'Eigenkapital', einheit: 'EUR' },
    { schluessel: 'zinsProzent', typ: 'zahl', min: 1.0, max: 7.0, schritt: 0.1, vorgabe: ZINS_VORGABE, label: 'Sollzins', einheit: '% p. a.' },
    { schluessel: 'tilgungProzent', typ: 'zahl', min: 1.0, max: 5.0, schritt: 0.25, vorgabe: 2.0, label: 'anfängliche Tilgung', einheit: '% p. a.' },
    { schluessel: 'steuersatzProzent', typ: 'zahl', min: 0, max: 45, schritt: 1, vorgabe: 42, label: 'persönlicher Grenzsteuersatz', einheit: '%' },
    { schluessel: 'afaMethode', typ: 'wahl', optionen: ['degressiv', 'linear'], vorgabe: 'degressiv', label: 'Abschreibung' },
    { schluessel: 'sonderAfa', typ: 'wahl', optionen: ['auto', 'aus'], vorgabe: 'auto', label: 'Sonder-AfA § 7b' },
    { schluessel: 'bodenanteilProzent', typ: 'zahl', min: 10, max: 60, schritt: 0.1, label: 'Bodenanteil am Kaufpreis', einheit: '%', hinweis: 'aus Grundstückswert 900.000 EUR anteilig nach Wohnfläche, bis die Kaufpreisaufteilung vorliegt' },
    { schluessel: 'wertsteigerungProzent', typ: 'zahl', min: 0, max: 5, schritt: 0.5, vorgabe: 2.0, label: 'Wertsteigerung', einheit: '% p. a.' },
    { schluessel: 'mietsteigerungProzent', typ: 'zahl', min: 0, max: 5, schritt: 0.5, vorgabe: 1.5, label: 'Mietsteigerung', einheit: '% p. a.', hinweis: 'Annahme' },
    { schluessel: 'kostenMonat', typ: 'zahl', min: 0, max: 500, schritt: 5, label: 'nicht umlagefähige Kosten (Verwaltung, Rücklage)', einheit: 'EUR/Monat' }
  ];

  // ---------------------------------------------------------------------------
  // K10 Ereignisse. fbq und gtag existieren erst nach Einwilligung (Snippet 926),
  // ereignisse.js prueft das je Aufruf. Telefon-Klicks behandelt Snippet 928 bereits.
  // ---------------------------------------------------------------------------
  var EREIGNISSE = {
    ansicht: { metaArt: 'track', metaName: 'ViewContent', metaDaten: { content_name: 'Rechner H8' }, gtag: 'rechner_view' },
    ergebnis: { metaArt: 'trackCustom', metaName: 'RechnerErgebnis', metaDaten: { content_name: 'Rechner H8' }, gtag: 'rechner_ergebnis', mitEreignisId: true },
    gate: { metaArt: 'track', metaName: 'InitiateCheckout', metaDaten: { content_name: 'Rechner H8 PDF' }, gtag: 'rechner_pdf_gate_open' },
    lead: { metaArt: 'track', metaName: 'Lead', metaDaten: { content_name: 'Rechner H8' }, gtag: 'generate_lead', gtagDaten: { method: 'rechner' }, konversion: 'anfrage', mitEreignisId: true },
    // Getrennt wie bei W5: 'termin' ist der Klick, der den Kalender oeffnet,
    // 'terminGebucht' die von Cal.com bestaetigte Buchung. Nur die Buchung ist Konversion.
    termin: { metaArt: 'trackCustom', metaName: 'TerminKalenderGeoeffnet', metaDaten: { content_name: 'Termin H8' }, gtag: 'termin_click' },
    terminGebucht: { metaArt: 'track', metaName: 'Schedule', metaDaten: { content_name: 'Termin H8' }, gtag: 'termin_gebucht', konversion: 'termin' },
    // Einmal je Seitenaufruf, gefeuert von schnell.js (Arbeitspaket 2).
    schnell: { metaArt: 'trackCustom', metaName: 'SchnellrechnerErgebnis', metaDaten: { content_name: 'Rechner H8' }, gtag: 'schnell_ergebnis', mitEreignisId: true }
  };

  // Praefix der Rueckfall-ID, wenn Snippet 928 (amEreignisId) nicht geladen ist.
  var EREIGNIS_ID_PRAEFIX = 'h8-rechner-';

  // ---------------------------------------------------------------------------
  // K10 Lead-POST, geaendert durch K5 des Bauplans h8-website. Die H8-Seite ist statisch
  // und kennt kein admin-ajax.php: der Lead geht als JSON an den oeffentlichen Endpunkt des
  // Relays (K6). Damit entfallen die vier Elementor-Schluessel action, postId, formId und
  // queriedId; kopfzeile, refererTitle, kontaktFelder, amFelder und consentUnbekannt bleiben
  // unveraendert, weil Mail, PDF und Messkette sie woertlich lesen.
  // ---------------------------------------------------------------------------
  var LEAD = {
    kopfzeile: 'Kapitalanlage-Rechner H8 (/rechner/)',
    transport: 'json',
    endpunkt: 'https://amanthos-conversion-relay.onrender.com/v1/public/h8',
    refererTitle: 'Rechner H8',
    kontaktFelder: ['Vorname', 'Nachname', 'Email', 'Telefon'],
    amFelder: ['am_ereignis_id', 'am_consent', 'am_gclid', 'am_fbp', 'am_fbc'],
    consentUnbekannt: 'unknown'
  };

  // ---------------------------------------------------------------------------
  // K10 PDF. jsPDF 4.2.1 von cdnjs, SRI wie W5. Standardschrift Helvetica (WinAnsi)
  // deckt Umlaute und das Euro-Zeichen.
  // ---------------------------------------------------------------------------
  var PDF = {
    kopfTitel: 'Hainbach H8, Ihre Kapitalanlage-Auswertung',
    objektZeile: 'Hainbach H8, Hainbachstrasse 8, Esslingen am Neckar',
    fussLinks: 'Hainbach H8, Kapitalanlage-Rechner',
    fussRechts: PROJEKT.domain + '/rechner',
    dateiname: 'Hainbach-H8-Auswertung.pdf',
    quelle: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js',
    integrity: 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3',
    abschnitte: ['kopf', 'eingaben', 'ergebnis', 'jahre', 'annahmen', 'objekt', 'kontakt', 'disclaimer']
  };

  // ---------------------------------------------------------------------------
  // K10 Texte der Oberflaeche. ui.js setzt sie in die data-amr-text-Slots.
  // ---------------------------------------------------------------------------
  var TEXTE = {
    kopfMarke: 'Hainbach H8, Esslingen am Neckar',
    kopfTitel: 'In 60 Sekunden: Was bleibt bei einer Neubauwohnung in Esslingen nach Steuern?',
    kopfText: 'Stellen Sie Kaufpreis, Miete, Eigenkapital und Steuersatz auf Ihre Lage ein. ' +
      'Nettovermögen, Rendite und Cashflow rechnen sich sofort mit, ohne Anmeldung.',
    fussnote: 'Die Auswertung fasst Ihre Eingaben, das Ergebnis und die Steuerregeln auf einer ' +
      'Seite zusammen.',
    annahme: 'Alle Werte sind Annahmen, die Sie selbst verändern können. Grunderwerbsteuer 5 % ' +
      '(Baden-Württemberg) sowie Notar und Grundbuch stecken in den Kaufnebenkosten, eine ' +
      'Maklerprovision fällt nicht an. Was das Modell bewusst nicht abbildet, steht vollständig ' +
      'in der Auswertung.',
    szenarienTitel: 'Womit rechnen?',
    szenarienHinweis: 'Die Sätze ändern nur Zins und Steigerungen, nie Kaufpreis, Fläche ' +
      'oder Miete. Jeden Wert ziehen Sie danach selbst nach. Annahmen, keine Prognose.',
    gateText: 'Wohin dürfen wir uns bei Rückfragen wenden? Die Auswertung erstellen wir sofort ' +
      'im Anschluss, dazu erhalten Sie die Broschüre per E-Mail.',
    erfolgText: 'Die Broschüre erhalten Sie per E-Mail. Startet der Download nicht von selbst, ' +
      'holen Sie die Auswertung hier.',
    disclaimer:
      'Alle Angaben und Ergebnisse dieses Rechners erfolgen ohne Gewähr; eine Haftung für ' +
      'Richtigkeit und Vollständigkeit wird nicht übernommen. ' +
      'Diese Berechnung ist eine unverbindliche Modellrechnung und keine Steuer-, Rechts- oder ' +
      'Anlageberatung. Steuerliche Wirkungen hängen von Ihren persönlichen Verhältnissen ab und ' +
      'können sich durch Gesetzesänderungen verändern; bitte lassen Sie sie von Ihrer ' +
      'Steuerberaterin oder Ihrem Steuerberater prüfen. Die Sonderabschreibung nach § 7b EStG und ' +
      'die degressive AfA nach § 7 Abs. 5a EStG setzen Bedingungen voraus, die nicht der Rechner, ' +
      'sondern der Kaufvertrag und das Finanzamt entscheiden. Miete, Bodenanteil, Nebenkosten, ' +
      'Wertsteigerung und Zins sind Annahmen, die Sie selbst verändern können. Stand der ' +
      'Rechenregeln: ' + PRUEFDATUM + '.',
    // Bedingungen der Sonderabschreibung. Der Rechner prueft nur die Baukostenobergrenze;
    // alles andere entscheiden Kaufvertrag, Bauausfuehrung und Finanzamt. Seite und PDF
    // zeigen die Liste unter dem Pruefergebnis, damit aus der Rechnung keine Zusage wird.
    sonderAfaBedingungen: [
      'Der Bauantrag wurde am 28.11.2025 gestellt und liegt damit im Fenster vom 01.01.2023 bis zum 30.09.2029 (§ 7b Abs. 2 EStG).',
      'Der Baubeginn liegt vor dem 01.10.2029; geplant ist das Frühjahr 2027 (Voraussetzung auch der degressiven AfA nach § 7 Abs. 5a EStG).',
      'Das Gebäude erreicht Effizienzhaus 40 mit Nachhaltigkeitsklasse und wird mit dem Qualitätssiegel Nachhaltiges Gebäude nachgewiesen (§ 7b Abs. 2 Satz 2 Nr. 1 EStG).',
      'Der Gebäudeanteil einschliesslich Nebenkosten übersteigt 5.200 EUR je m² nicht; gerechnet wird auf der Nutzfläche, ersatzweise auf der Bruttogrundfläche nach DIN 277 (§ 7b Abs. 2 Satz 2 Nr. 2 EStG, BMF vom 21.05.2025 Rn. 49 und 51).',
      'Die Bemessungsgrundlage der Sonderabschreibung beträgt höchstens 4.000 EUR je m² (§ 7b Abs. 3 EStG).',
      'Die Wohnung wird bis zum Ende des Jahres der Fertigstellung angeschafft (§ 7b Abs. 1 EStG).',
      'Die Wohnung wird im Jahr der Anschaffung und in den folgenden neun Jahren entgeltlich zu Wohnzwecken vermietet (§ 7b Abs. 2 und Abs. 4 EStG).',
      'Die beihilferechtliche De-minimis-Erklärung wird abgegeben und der Höchstbetrag ist nicht ausgeschöpft (§ 7b Abs. 5 EStG, Verordnung (EU) 2023/2831).'
    ],
    // Bewusst nicht modelliert. Gehoert sichtbar in Seite und PDF.
    nichtModelliert: [
      'zeitanteilige AfA im ersten Jahr',
      'Solidaritätszuschlag und Kirchensteuer',
      'Finanzierungskosten der Grundschuld',
      'Mietausfall',
      'Instandhaltung über die Rücklage hinaus',
      'Steuer auf einen Verkauf vor Ablauf von zehn Jahren',
      'beihilferechtliche De-minimis-Grenze',
      'Sondertilgungen',
      'Anschlussfinanzierung',
      'Neben- und Zubehörräume in der Bemessungsgrundlage (BMF Rn. 60), bis die Teilungserklärung die Nutzflächen nennt',
      'Stellplatz-Miete steigt mit der Wohnungsmiete'
    ]
  };

  // ---------------------------------------------------------------------------
  // K10 Schnellrechner. Zeigt nur die Wirkung der Abschreibung auf die Einkommensteuer;
  // schnell.js (Arbeitspaket 2) rendert ihn, modell.schnell rechnet ihn.
  // ---------------------------------------------------------------------------
  var SCHNELL = {
    zvE: { min: 20000, max: 150000, schritt: 1000, vorgabe: 60000 },
    texte: {
      titel: 'Doppelt abschreiben: Was spart Ihnen die Abschreibung in zehn Jahren?',
      einkommen: 'zu versteuerndes Einkommen im Jahr',
      ergebnis: 'weniger Einkommensteuer in zehn Jahren',
      degressiv: 'aus degressiver AfA',
      sonder: 'aus Sonder-AfA § 7b',
      grenz: 'Ihr Grenzsteuersatz bei {zvE} zu versteuerndem Einkommen: {satz} %',
      hinweis: 'Nur die Wirkung der Abschreibung, Grundtarif 2026, ohne Solidaritätszuschlag ' +
        'und Kirchensteuer. Miete, Zinsen und alle Kosten rechnet der Detailrechner darunter.',
      weiter: 'Zum Detailrechner'
    }
  };

  AMR.konstanten = {
    SLUG: SLUG,
    PRUEFDATUM: PRUEFDATUM,
    WOHNUNGEN: WOHNUNGEN,
    STELLPLAETZE: STELLPLAETZE,
    STELLPLATZ_MODELL: STELLPLATZ_MODELL,
    STELLPLATZ_GETRENNT: STELLPLATZ_GETRENNT,
    BODEN: BODEN,
    SCHNELL: SCHNELL,
    FREI: FREI,
    PROJEKT: PROJEKT,
    BROSCHUERE_URL: BROSCHUERE_URL,
    KONTAKT: KONTAKT,
    TERMIN_URL: TERMIN_URL,
    TERMIN_ATTRIBUTE: TERMIN_ATTRIBUTE,
    CAL: CAL,
    VERSION: VERSION,
    STEUER: STEUER,
    RECHTSGRUNDLAGEN: RECHTSGRUNDLAGEN,
    MIETE_JE_M2_VORGABE: MIETE_JE_M2_VORGABE,
    ZINS_VORGABE: ZINS_VORGABE,
    // Annahmesaetze: NUR Annahmen, nie Kaufpreis, Flaeche, Miete oder Grenzsteuersatz.
  // Redaktionell gesetzt. Auflagen und Begruendung: rechner/tests/konstanten-h8.test.js.
  SZENARIEN: [
    { schluessel: 'vorsichtig', name: 'Vorsichtig',
      werte: { zinsProzent: 5, wertsteigerungProzent: 0.5, mietsteigerungProzent: 0.5 } },
    { schluessel: 'mittel', name: 'Mittel',
      werte: { zinsProzent: 4, wertsteigerungProzent: 2, mietsteigerungProzent: 1.5 } },
    { schluessel: 'optimistisch', name: 'Optimistisch',
      werte: { zinsProzent: 3.5, wertsteigerungProzent: 3, mietsteigerungProzent: 2.5 } }
  ],

  EINGABEN: EINGABEN,
    EREIGNISSE: EREIGNISSE,
    EREIGNIS_ID_PRAEFIX: EREIGNIS_ID_PRAEFIX,
    LEAD: LEAD,
    PDF: PDF,
    TEXTE: TEXTE
  };
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.konstanten;