/**
 * Kapitalanlage-Rechner, Lead-POST (Plan w5-rechner Arbeitspaket 3, K8; Plan h8-website K4).
 *
 * Zwei Transportwege, die Mandantendatei waehlt ueber LEAD.transport:
 *
 *   'elementor'  Vorgabe und Verhalten seit jeher. Sendet die Elementor-FormData an dasselbe
 *                Formular 71d95d2c wie das Broschueren-Gate der Startseite (Snippet 930,
 *                Zeile 135 bis 164); die Pipeline dahinter bleibt unveraendert: Team-Mail,
 *                Webhook zum Relay, Autoantwort mit Broschuere. W5 faehrt genau das weiter.
 *   'json'       POST als application/json an LEAD.endpunkt (absolute URL), Koerper nach K6
 *                des Bauplans h8-website. Holt vorher window.amBotToken(). Fuer Seiten ohne
 *                WordPress, bei denen es kein admin-ajax.php gibt.
 *
 * Ein Mandant ohne LEAD.transport faehrt den Elementor-Weg; ein neuer Schluessel ist noetig,
 * damit W5 unberuehrt bleibt.
 *
 * fetch, amLeadFelder und amBotToken sind injizierbar, damit die Tests ohne Netz laufen.
 */
(function (AMR) {
  'use strict';
  var K = AMR.konstanten;

  function wirt() { return typeof window !== 'undefined' ? window : global; }

  /** Deutsches Zahlenformat. Auch pdf.js nutzt es, damit Seite, Mail und PDF gleich runden. */
  function zahl(wert, min, max) {
    if (typeof wert !== 'number' || !isFinite(wert)) return 'n. v.';
    if (wert === 0) wert = 0; // fasst -0 zu 0 zusammen, sonst steht "-0" in der Mail
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }).format(wert);
  }

  function eur(wert) { return zahl(Math.round(wert), 0, 0) + ' EUR'; }

  function wohnungText(eingaben) {
    var w = AMR.modell.wohnungVon(eingaben.wohnung);
    var flaeche = zahl(eingaben.wohnflaeche, 0, 2) + ' m²';
    if (!w) return 'freie Eingabe (' + flaeche + ')';
    return 'Nr. ' + w.nr + ' (' + w.lage + ', ' + w.zimmer + ' Zimmer, ' + flaeche + ')';
  }

  // Ergebnis der 5.200-EUR-Pruefung nach § 7b EStG. "nicht berechtigt" ist der Wortlaut aus
  // K8; "abgeschaltet" deckt den Fall, dass der Nutzer sie trotz haltender Grenze abschaltet.
  function sonderAfaText(ergebnis) {
    var jeM2 = ' (' + zahl(Math.round(ergebnis.kostenJeM2), 0, 0) + ' EUR/m²)';
    if (ergebnis.sonderAfaAktiv) return 'aktiv' + jeM2;
    return (ergebnis.sonderAfaBerechtigt ? 'abgeschaltet' : 'nicht berechtigt') + jeM2;
  }

  /** Text fuer form_fields[message]. Fuenf Zeilen, Format verbindlich aus K8. */
  function nachricht(eingaben, ergebnis) {
    var e = eingaben;
    return [
      K.LEAD.kopfzeile + ', Version ' + K.VERSION,
      'Wohnung: ' + wohnungText(e) + ' | Kaufpreis ' + eur(e.kaufpreis) + ' | Stellplatz: ' + e.stellplatz,
      'Kaltmiete ' + eur(e.mieteMonat) + '/Monat | Eigenkapital ' + eur(e.eigenkapital) +
        ' | Zins ' + zahl(e.zinsProzent, 2, 2) + ' % | Tilgung ' + zahl(e.tilgungProzent, 2, 2) + ' %' +
        ' | Steuersatz ' + zahl(e.steuersatzProzent, 0, 0) + ' %',
      'AfA ' + e.afaMethode + ' | Sonder-AfA §7b: ' + sonderAfaText(ergebnis) +
        // Null bis eine Nachkommastelle: W5 zeigt weiter "30 %", ein aus dem Grundstueckswert
        // abgeleiteter Anteil zeigt "24,8 %" statt gerundet "25 %" (h8-funnel K2).
        ' | Bodenanteil ' + zahl(e.bodenanteilProzent, 0, 1) + ' %' +
        ' | Wertsteigerung ' + zahl(e.wertsteigerungProzent, 1, 1) + ' %' +
        ' | Mietsteigerung ' + zahl(e.mietsteigerungProzent, 1, 1) + ' %' +
        ' | Kosten ' + eur(e.kostenMonat) + '/Monat',
      'Nach ' + K.STEUER.betrachtungJahre + ' Jahren: Nettovermögen ' + eur(ergebnis.nettovermoegenEnde) +
        ' | Vermögen inkl. Cashflows ' + eur(ergebnis.vermoegenEnde) + ' | Gewinn ' + eur(ergebnis.gewinn) +
        ' | Faktor ' + zahl(ergebnis.faktor, 2, 2) + ' | Rendite ' + zahl(ergebnis.irrProzent, 2, 2) + ' % p. a.' +
        ' | Cashflow n. St. Jahr 1: ' + eur(ergebnis.cashflowNachSteuerMonatJahr1) + '/Monat'
    ].join('\n');
  }

  function ohneLeerraum(wert) {
    return String(wert === undefined || wert === null ? '' : wert).replace(/\s+/g, '');
  }

  /** K4: ohne Angabe in der Mandantendatei bleibt es beim Elementor-Weg. */
  function transport() {
    return (K.LEAD && K.LEAD.transport) || 'elementor';
  }

  /**
   * Ruft amLeadFelder genau einmal und liefert die fuenf Felder aus K8 vollstaendig, auch
   * wenn die Funktion fehlt oder mittendrin wirft. Wirft sie, ist die Ereignis-ID null, die
   * bis dahin gesetzten Werte bleiben stehen.
   */
  function amSammeln(leadFelder) {
    var roh = {}, id = null;
    try {
      if (leadFelder) id = leadFelder(function (name, wert) { roh[name] = wert || ''; }) || null;
    } catch (fehler) {
      id = null;
    }
    var felder = {};
    K.LEAD.amFelder.forEach(function (feld) {
      var wert = roh[feld];
      if (wert === undefined) wert = feld === 'am_consent' ? K.LEAD.consentUnbekannt : '';
      felder[feld] = wert;
    });
    return { felder: felder, ereignisId: id };
  }

  /**
   * Das Bot-Token aus K2. Fehlt die Funktion oder wirft sie, geht ein leeres Token hinaus und
   * der Server entscheidet (K6: 400 'ungueltig'). Der Rechner verwirft den Lead nicht selbst,
   * sonst verschwaende er ihn still.
   */
  function botTokenHolen(opt, w) {
    var quelle = opt.botToken || (typeof w.amBotToken === 'function' ? w.amBotToken : null);
    if (!quelle) return Promise.resolve('');
    try {
      return Promise.resolve(quelle()).then(
        function (wert) { return wert || ''; },
        function () { return ''; }
      );
    } catch (fehler) {
      return Promise.resolve('');
    }
  }

  /** Elementor-FormData, Feldnamen woertlich wie im Formular 71d95d2c (K8). */
  function elementorKoerper(kontakt, eingaben, ergebnis, seite, am) {
    var daten = new FormData();
    daten.append('action', K.LEAD.action);
    daten.append('post_id', K.LEAD.postId);
    daten.append('form_id', K.LEAD.formId);
    daten.append('queried_id', K.LEAD.queriedId);
    daten.append('referer_title', K.LEAD.refererTitle);
    // Ohne referrer bleibt meta[page_url] im Webhook leer: Elementor liest die Seiten-URL
    // aus diesem Feld, nicht aus dem Referer-Kopf (Snippet 930).
    daten.append('referrer', seite);
    // Elementor lehnt Leerzeichen im Telefonfeld ab ("The field accepts only numbers and phone
    // characters"), gemessen am 07.09.2026 an der lebenden Seite. Wer seine Nummer mit
    // Leerzeichen tippt, verloere sonst den Lead. Angezeigt bleibt die Eingabe, gesendet wird
    // sie ohne Leerraum.
    var werte = [kontakt.vorname, kontakt.nachname, kontakt.email, ohneLeerraum(kontakt.telefon)];
    K.LEAD.kontaktFelder.forEach(function (feld, i) {
      daten.append('form_fields[' + feld + ']', (werte[i] || '').trim());
    });
    daten.append('form_fields[message]', nachricht(eingaben, ergebnis));
    K.LEAD.amFelder.forEach(function (feld) {
      daten.append('form_fields[' + feld + ']', am.felder[feld]);
    });
    return daten;
  }

  /** Koerper von POST /v1/public/{tenant}, Schluessel in der Reihenfolge aus K6. */
  function jsonKoerper(kontakt, eingaben, ergebnis, seite, am, botToken) {
    var koerper = {
      vorname: (kontakt.vorname || '').trim(),
      nachname: (kontakt.nachname || '').trim(),
      email: (kontakt.email || '').trim(),
      telefon: ohneLeerraum(kontakt.telefon),
      // K6 laesst hoechstens 2000 Zeichen zu. Die fuenf Zeilen bleiben weit darunter; der
      // Schnitt ist die Wache, damit eine spaetere Formataenderung keinen 400 erzeugt.
      nachricht: nachricht(eingaben, ergebnis).slice(0, 2000),
      quelle: 'rechner',
      seite: seite
    };
    K.LEAD.amFelder.forEach(function (feld) { koerper[feld] = am.felder[feld]; });
    koerper.bot_token = botToken || '';
    // Honigtopf. Der Rechner hat kein solches Feld, also geht er immer leer hinaus.
    koerper.firma = '';
    return koerper;
  }

  /**
   * Sendet den Lead, kontakt = {vorname, nachname, email, telefon}.
   *
   * Elementor-Weg: antwortet admin-ajax mit success, feuert senden() das Ereignis lead (K7,
   * nur hier kommt die Antwort an) und liefert {ok:true}. JSON-Weg: dasselbe an ok:true der
   * Antwort nach K6, dazu broschuereUrl aus der Antwort. Jeder andere Ausgang liefert
   * {ok:false} ohne zweiten Versuch; den Hinweis mit den Telefonnummern zeigt die Oberflaeche.
   */
  function senden(kontakt, eingaben, ergebnis, optionen) {
    var opt = optionen || {};
    var w = wirt();
    var hole = opt.fetch || (typeof w.fetch === 'function' ? w.fetch.bind(w) : null);
    var leadFelder = opt.leadFelder || (typeof w.amLeadFelder === 'function' ? w.amLeadFelder : null);
    var kanal = opt.ereignisse === undefined ? AMR.ereignisse : opt.ereignisse;
    var seite = opt.referrer || (w.location ? w.location.href : '');

    // Erst einsammeln, dann senden: so stehen die fuenf Felder genau einmal und in der
    // Reihenfolge aus K8, auch wenn amLeadFelder fehlt oder mittendrin wirft. Das gilt in
    // beiden Transportwegen und auch dann, wenn gar kein fetch da ist.
    var am = amSammeln(leadFelder);
    var id = am.ereignisId;

    if (!hole) return Promise.resolve({ ok: false, ereignisId: id, fehler: 'kein fetch' });

    if (transport() === 'json') {
      return botTokenHolen(opt, w)
        .then(function (token) {
          return hole(K.LEAD.endpunkt, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonKoerper(kontakt, eingaben, ergebnis, seite, am, token)),
            // Fremder Ursprung: ohne Anmeldedaten, sonst verlangte die Route
            // Access-Control-Allow-Credentials, das K6 nicht zusagt.
            credentials: 'omit'
          })
            .then(function (antwort) { return antwort.json(); })
            .then(function (inhalt) {
              if (!inhalt || inhalt.ok !== true) {
                return {
                  ok: false,
                  ereignisId: id,
                  fehler: (inhalt && inhalt.grund) || 'abgelehnt',
                  broschuereUrl: ''
                };
              }
              if (kanal && typeof kanal.feuere === 'function') kanal.feuere('lead', { ereignisId: id });
              return { ok: true, ereignisId: id, fehler: null, broschuereUrl: inhalt.broschuere_url || '' };
            });
        })
        .catch(function () { return { ok: false, ereignisId: id, fehler: 'netz', broschuereUrl: '' }; });
    }

    return hole(K.LEAD.endpunkt, {
      method: 'POST',
      body: elementorKoerper(kontakt, eingaben, ergebnis, seite, am),
      credentials: 'same-origin'
    })
      .then(function (antwort) { return antwort.json(); })
      .then(function (inhalt) {
        if (!inhalt || !inhalt.success) return { ok: false, ereignisId: id, fehler: 'abgelehnt' };
        if (kanal && typeof kanal.feuere === 'function') kanal.feuere('lead', { ereignisId: id });
        return { ok: true, ereignisId: id, fehler: null };
      })
      .catch(function () { return { ok: false, ereignisId: id, fehler: 'netz' }; });
  }

  AMR.lead = { senden: senden, nachricht: nachricht, zahl: zahl, eur: eur, transport: transport };
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.lead;