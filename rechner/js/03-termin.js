/**
 * Kapitalanlage-Rechner Wohnidyll W5, Terminbuchung (Cal.com).
 *
 * Der Knopf auf dem Erfolgsbildschirm oeffnet den Buchungskalender als Ueberblendung auf
 * derselben Seite, statt einen zweiten Tab zu oeffnen. Cal.com meldet die bestaetigte
 * Buchung ueber das Ereignis bookingSuccessful zurueck, und erst dann geht die Conversion
 * an Google Ads und Meta.
 *
 * Warum nicht schon beim Klick: wer den Kalender aufmacht, hat noch nichts gebucht. Zaehlt
 * man den Klick als Terminbuchung, bietet die Suchkampagne auf Neugier statt auf Termine.
 * Der Klick bleibt als eigenes Zwischensignal erhalten, nur ohne Conversion.
 *
 * Der Lader startet erst, wenn der Erfolgsbildschirm sichtbar wird. Vorher hat die Seite
 * keinen Grund, app.cal.com anzusprechen: embed.js ist ein Drittskript, und schon sein
 * Abruf uebertraegt die IP des Besuchers. Den Knopf sieht nur, wer das Formular abgeschickt
 * hat, und erst dann lohnt der Lader.
 *
 * Faellt der Lader aus (Netz, Blocker, Skript geblockt, Klick bevor embed.js da ist),
 * passiert nichts Schlimmes: der Knopf ist ein gewoehnlicher Verweis auf cal.com und traegt
 * target="_blank". Gebucht wird dann in einem neuen Tab, nur die Rueckmeldung an die
 * Messung faellt aus.
 */
(function (AMR) {
  'use strict';
  var K = AMR.konstanten;
  var gestartet = false;

  function wirt() { return typeof window !== 'undefined' ? window : global; }

  /**
   * Der Einbettungslader von Cal.com, nachgebaut aus dem Ausgabecode der Oberflaeche
   * (07.09.2026). Er legt window.Cal an, haengt embed.js in den Kopf und puffert alle
   * Aufrufe in einer Warteschlange, bis das Skript da ist. Bewusst ohne kaufmaennisches
   * Und: WordPress schreibt jedes davon im Seiteninhalt in eine Entitaet um.
   */
  function lader(w) {
    var d = w.document;
    function puffer(ziel, argumente) { ziel.q.push(argumente); }
    if (w.Cal) return;
    w.Cal = function () {
      var cal = w.Cal;
      var argumente = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement('script')).src = K.CAL.skript;
        cal.loaded = true;
      }
      if (argumente[0] === 'init') {
        var api = function () { puffer(api, arguments); };
        var raum = argumente[1];
        api.q = api.q || [];
        if (typeof raum === 'string') {
          cal.ns[raum] = cal.ns[raum] || api;
          puffer(cal.ns[raum], argumente);
          puffer(cal, ['initNamespace', raum]);
          return;
        }
        puffer(cal, argumente);
        return;
      }
      puffer(cal, argumente);
    };
  }

  /**
   * Richtet die Einbettung ein. Mehrfachaufruf ist harmlos, der erste gewinnt.
   * Rueckgabe true, wenn eingerichtet wurde, sonst false (kein Browser, kein Link).
   */
  function starten() {
    if (gestartet) return false;
    var w = wirt();
    if (!w || !w.document || !K.CAL || !K.CAL.link) return false;
    gestartet = true;
    try {
      lader(w);
      w.Cal('init', K.CAL.raum, { origin: K.CAL.ursprung });
      // forwardQueryParams traegt utm_source und Konsorten aus der Seiten-URL in die
      // Buchung. Ohne das steht spaeter in jeder Buchung nur "cal.com".
      w.Cal.config = w.Cal.config || {};
      w.Cal.config.forwardQueryParams = true;
      var raum = w.Cal.ns[K.CAL.raum];
      raum('ui', { hideEventTypeDetails: false, layout: 'month_view' });
      raum('on', { action: 'bookingSuccessful', callback: gebucht });
      return true;
    } catch (fehler) {
      return false; // Der Knopf bleibt ein Verweis, das genuegt.
    }
  }

  /** Cal.com hat die Buchung bestaetigt. Erst hier zaehlt die Conversion. */
  function gebucht() {
    try {
      if (AMR.ereignisse) AMR.ereignisse.feuere('terminGebucht');
    } catch (fehler) {
      // bewusst still, die Buchung steht bereits
    }
  }

  /**
   * Wartet auf den Erfolgsbildschirm und startet dann. Ist er schon sichtbar, sofort.
   * Rueckgabe true, wenn beobachtet oder gestartet wurde; false ohne Ansicht oder ohne
   * MutationObserver. In beiden Faellen bleibt der Knopf ein gewoehnlicher Verweis.
   */
  function beobachten(dokument) {
    if (!dokument || typeof dokument.querySelector !== 'function') return false;
    var ansicht = dokument.querySelector('[data-amr-ansicht="erfolg"]');
    if (!ansicht) return false;
    if (!ansicht.hidden) { starten(); return true; }
    var Beobachter = wirt().MutationObserver;
    if (typeof Beobachter !== 'function') return false;
    var beobachter = new Beobachter(function () {
      if (ansicht.hidden) return;
      beobachter.disconnect();
      starten();
    });
    beobachter.observe(ansicht, { attributes: true, attributeFilter: ['hidden'] });
    return true;
  }

  AMR.termin = { starten: starten, gebucht: gebucht, beobachten: beobachten };

  // Selbststart: nicht laden, sondern warten. setTimeout laesst ui.js das Geruest zuerst
  // fuellen, damit die Erfolgsansicht beim Nachsehen schon im Dokument steht.
  var w = wirt();
  if (w && w.document && w.setTimeout) w.setTimeout(function () { beobachten(w.document); }, 0);
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.termin;