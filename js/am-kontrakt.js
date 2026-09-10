/**
 * Der globale JS-Vertrag der H8-Seite (Plan h8-website, K2, aus Befund M22).
 *
 * Diese Datei wird als ERSTE JS-Datei geladen und legt die zehn Namen aus K2 mit
 * wirkungslosen Voreinstellungen an. Zweck: eine fehlende oder kaputte Datei aus Arbeitspaket 5,
 * 6 oder 7 darf die Seite nie zerbrechen, und `rechner/lead.js` sowie `rechner/ereignisse.js`
 * duerfen die Namen ungeprueft rufen.
 *
 * Die Namen sind nicht verhandelbar. Sie stammen aus Snippet 928 der Bestandsseite, und der
 * Rechner ruft sie woertlich so auf (M22). Wer hier einen Namen anders schreibt, bricht die
 * Entdopplung mit Meta, ohne dass irgendetwas rot wird.
 *
 * Vorbelegung, nie Ueberschreibung: jeder Name wird nur gesetzt, wenn er noch fehlt. So kann
 * die Datei mehrfach geladen werden, und ein spaeter geladenes messkette.js (Arbeitspaket 6),
 * einwilligung.js (Arbeitspaket 5) oder formular.js (Arbeitspaket 7) ersetzt die Vorgabe einfach.
 *
 * Kein Netzzugriff, kein Cookie-Schreiben, keine Abhaengigkeit. Klassisches Skript, kein ESM.
 */
(function (w) {
  'use strict';

  // Die zehn Namen aus K2, in der Reihenfolge der Tabelle. Auch als Datenliste, damit ein
  // Test sie zaehlen kann, ohne sie ein zweites Mal abzuschreiben.
  var NAMEN = [
    'amEreignisId',
    'amLetzteEreignisId',
    'amEinwilligung',
    'amCookie',
    'amGclid',
    'amFbc',
    'amLeadFelder',
    'amKonversion',
    'amEinwilligungOeffnen',
    'amBotToken'
  ];

  // Praefix aller Ereignis-IDs dieses Mandanten. Steht auch in
  // rechner/mandanten/h8.js als EREIGNIS_ID_PRAEFIX; hier ohne die Art, weil K2
  // 'h8-<art>-<z36>-<r>' vorgibt.
  var PRAEFIX = 'h8-';

  /** Setzt einen Namen nur, wenn ihn noch niemand gestellt hat. */
  function vorgabe(name, wert) {
    if (w[name] === undefined) w[name] = wert;
  }

  // --- amEreignisId(art) -> 'h8-<art>-<z36>-<r>' ------------------------------
  // Gefuellt von Arbeitspaket 6, gerufen von Arbeitspaket 7 und rechner/ereignisse.js. Die Vorgabe
  // liefert eine formgerechte ID statt eines leeren Strings: eine leere eventID waere fuer
  // Meta schlimmer als eine, die nur nicht mit dem Server geteilt wird.
  vorgabe('amEreignisId', function (art) {
    var id = PRAEFIX + (art || 'ereignis') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
    w.amLetzteEreignisId = id;
    return id;
  });

  // --- amLetzteEreignisId -> Wert oder null -----------------------------------
  // Gefuellt von den Arbeitspaketen 6 und 7, gelesen von Arbeitspaket 6. Vor dem ersten Ereignis null.
  vorgabe('amLetzteEreignisId', null);

  // --- amEinwilligung() -> 'granted' | 'denied' | 'unknown' -------------------
  // Gefuellt von Arbeitspaket 5. Ohne Banner ist der Stand unbekannt, nie 'granted': eine
  // Voreinstellung, die Einwilligung behauptet, waere ein Rechtsfehler, kein Bug.
  vorgabe('amEinwilligung', function () {
    return 'unknown';
  });

  // --- amCookie(name) -> string ------------------------------------------------
  // Gefuellt und gerufen von Arbeitspaket 6. Die Vorgabe liest nur, schreibt nie.
  vorgabe('amCookie', function (name) {
    if (!name || typeof w.document === 'undefined' || !w.document) return '';
    var treffer = ('; ' + (w.document.cookie || '')).split('; ' + name + '=');
    return treffer.length === 2 ? treffer.pop().split(';').shift() : '';
  });

  // --- amGclid() -> string, 90 Tage gesichert ---------------------------------
  // Gefuellt von Arbeitspaket 6. Die Vorgabe sichert nichts und liefert deshalb leer; das
  // Sichern ueber 90 Tage ist Aufgabe der Messkette und braucht eine Einwilligung.
  vorgabe('amGclid', function () {
    return '';
  });

  // --- amFbc() -> string --------------------------------------------------------
  vorgabe('amFbc', function () {
    return '';
  });

  // --- amLeadFelder(setzer) -> ereignisId ---------------------------------------
  // Gefuellt von Arbeitspaket 6, gerufen von Arbeitspaket 7 und rechner/lead.js. Die Vorgabe setzt
  // alle fuenf Namen genau einmal, damit der Aufrufer nie ein fehlendes Feld erbt, und
  // benutzt dafuer ausschliesslich die Vorgaben darueber. Ergebnis ohne Messkette: vier
  // leere Werte und 'unknown' als Einwilligungsstand, also genau das, was rechner/lead.js
  // auch ohne diese Datei eingesetzt haette.
  vorgabe('amLeadFelder', function (setzer) {
    if (typeof setzer !== 'function') return w.amLetzteEreignisId;
    setzer('am_ereignis_id', w.amLetzteEreignisId || '');
    setzer('am_consent', w.amEinwilligung());
    setzer('am_gclid', w.amGclid());
    setzer('am_fbp', w.amCookie('_fbp'));
    setzer('am_fbc', w.amFbc());
    return w.amLetzteEreignisId;
  });

  // --- amKonversion(art), art aus {anfrage, telefon, termin} --------------------
  // Gefuellt von Arbeitspaket 6, gerufen von Arbeitspaket 7 und rechner/ereignisse.js. Ohne
  // Messkette gibt es kein Google-Tag, an das zu melden waere: die Vorgabe tut nichts.
  vorgabe('amKonversion', function () {});

  // --- amEinwilligungOeffnen() --------------------------------------------------
  // Gefuellt von Arbeitspaket 5, gerufen vom Knopf in der Fussleiste. Ohne Banner gibt es
  // nichts zu oeffnen; der Knopf darf trotzdem nicht werfen.
  vorgabe('amEinwilligungOeffnen', function () {});

  // --- amBotToken() -> Promise<string>, Vorgabe Promise.resolve('') -------------
  // Gefuellt von Arbeitspaket 7, gerufen von Arbeitspaket 7 und rechner/lead.js. Ohne Turnstile
  // geht ein leeres Token hinaus und der Server entscheidet (K6: 400 'ungueltig').
  vorgabe('amBotToken', function () {
    return Promise.resolve('');
  });

  // Kein elfter Name auf window: K2 nennt zehn, und ein zusaetzlicher globaler Name waere
  // genau die Art Abweichung, vor der M22 warnt. Die Liste geht deshalb nur ueber
  // module.exports hinaus, das es im Browser nicht gibt, und dient allein den Tests der
  // Arbeitspakete 5, 6 und 7.
  if (typeof module !== 'undefined' && module.exports) module.exports = { namen: NAMEN, wirt: w };
})(typeof window !== 'undefined' ? window : globalThis);
