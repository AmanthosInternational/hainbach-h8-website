/**
 * Kapitalanlage-Rechner Wohnidyll W5, Ereignisse (Plan Arbeitspaket 3, K7).
 *
 * Kapselt fbq, gtag und amKonversion. fbq und gtag existieren erst nach der Einwilligung
 * (Complianz laedt sie ueber Snippet 926), amEreignisId und amKonversion nur mit Snippet 928.
 * Jeder Zugriff ist deshalb einzeln geprueft und der Aufruf in try/catch gefasst: feuere()
 * wirft nie und haelt die Seite nie an.
 */
(function (AMR) {
  'use strict';
  var K = AMR.konstanten;
  var ID_ART = 'rechner'; // Art fuer amEreignisId, K7 Zeile "ergebnis"

  function wirt() { return typeof window !== 'undefined' ? window : global; }

  /** Rueckfall ohne Snippet 928: lokale ID, damit das Pixel trotzdem eine eventID traegt. */
  function rueckfallId() {
    return K.EREIGNIS_ID_PRAEFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Die ID des Leads kommt aus amLeadFelder und wird von lead.js durchgereicht; fuer das
  // Ergebnis-Ereignis erzeugt sie Snippet 928, sonst der Rueckfall.
  function ereignisId(daten) {
    if (daten && daten.ereignisId) return daten.ereignisId;
    var w = wirt();
    return typeof w.amEreignisId === 'function' ? w.amEreignisId(ID_ART) : rueckfallId();
  }

  // Feste Daten aus den Konstanten, ergaenzt um die Wohnung, wenn der Aufrufer sie mitgibt
  // (K7: nur RechnerErgebnis traegt sie). Rueckgabe null, wenn nichts zu senden ist.
  function daten(feste, mit) {
    var ziel = feste ? Object.assign({}, feste) : null;
    if (mit && mit.wohnung !== undefined && mit.wohnung !== null) {
      ziel = ziel || {};
      ziel.wohnung = String(mit.wohnung);
    }
    return ziel;
  }

  /**
   * Feuert ein Ereignis aus K7. Unbekannte Namen werden still uebergangen, fehlende
   * Messwerkzeuge ausgelassen, Fehler geschluckt: Messung stoppt den Rechner nie.
   */
  function feuere(name, mit) {
    try {
      var spec = K.EREIGNISSE[name];
      if (!spec) return;
      var w = wirt();
      var id = spec.mitEreignisId ? ereignisId(mit) : null;
      if (spec.konversion && typeof w.amKonversion === 'function') w.amKonversion(spec.konversion);
      if (typeof w.fbq === 'function') {
        var args = [spec.metaArt, spec.metaName, daten(spec.metaDaten, mit) || {}];
        if (id) args.push({ eventID: id });
        w.fbq.apply(null, args);
      }
      if (typeof w.gtag === 'function') {
        var gDaten = daten(spec.gtagDaten, mit);
        if (gDaten) w.gtag('event', spec.gtag, gDaten);
        else w.gtag('event', spec.gtag);
      }
    } catch (fehler) {
      // bewusst still
    }
  }

  AMR.ereignisse = { feuere: feuere, rueckfallId: rueckfallId };
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.ereignisse;