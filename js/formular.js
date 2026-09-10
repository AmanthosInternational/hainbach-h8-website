/**
 * H8: Formular und Broschueren-Gate im Browser (Plan h8-website, Arbeitspaket 7).
 *
 * Nachfolger von docs/h8/snippets/930-broschueren-gate.html, ohne Elementor: kein Ruf an das
 * Ajax-Tor von WordPress, keine Multipart-Formulardaten, keine Elementor-Feldnamen. Gesendet
 * wird JSON nach K6 an die oeffentliche Route POST /v1/public/{tenant} des Relays.
 *
 * Zwei Punkte, die den Rest des Moduls erklaeren:
 *
 * 1. Das Fenster wird VOR dem Warten auf die Antwort geoeffnet. Safari und iOS verwerfen ein
 *    window.open, das erst in einem spaeteren Callback kommt, weil die Nutzergeste dann
 *    verfallen ist. Geoeffnet wird deshalb sofort ein leeres Fenster; seine Adresse setzt
 *    erst die 200-Antwort. Damit steht die Broschuerenadresse an keiner Stelle im Markup,
 *    und wer sie doch dorthin schriebe, haette das Gate ausgehebelt.
 * 2. Ein 502 ist die Zusage, nicht der Ausrutscher: kommt die Team-Mail nicht durch, sagt das
 *    Formular sichtbar "Bitte rufen Sie uns an" und nennt die Nummer, statt den Lead still zu
 *    verlieren. Jede der fuenf Antworten aus K6 hat deshalb ihre eigene Meldung.
 *
 * Fuellt window.amBotToken aus K2 (Promise<string>) und ruft window.amLeadFelder,
 * window.amKonversion und, falls vorhanden, fbq. Kein elfter globaler Name: alles andere
 * bleibt im Modul. Klassisches Skript, kein ESM, keine Abhaengigkeit.
 *
 * Voraussetzungen, die andere Arbeitspakete liefern (hier bewusst nicht mitgebaut):
 *   - seite/vorlagen/teile/broschueren-gate.html wird ins Geruest eingefuegt (Arbeitspaket 2/3),
 *     dazu seite/statisch/formular.css und diese Datei im <head>.
 *   - Das Turnstile-Skript (challenges.cloudflare.com, render=explicit) laedt das Geruest,
 *     weil nur dort die CSP steht (Arbeitspaket 2).
 */
(function (global) {
  'use strict';

  // K5: dieselbe oeffentliche Adresse, die rechner/mandanten/h8.js als LEAD.endpunkt traegt.
  // Ueberschreibbar ueber data-am-endpunkt am Dialog, damit eine Vorschau ohne Codeaenderung
  // auf einen anderen Mandanten zeigen kann.
  var ENDPUNKT = 'https://amanthos-conversion-relay.onrender.com/v1/public/h8';

  // Die Nummer aus dem 502-Satz. Geschaeftsnummer der Vertriebsleitung, dieselbe wie in
  // rechner/mandanten/h8.js; ueberschreibbar ueber data-am-telefon.
  var TELEFON = '+49 (0) 711 209 095 75';

  // K6: die fuenf Messfelder, woertlich wie in K2 und in rechner/lead.js.
  var AM_FELDER = ['am_ereignis_id', 'am_consent', 'am_gclid', 'am_fbp', 'am_fbc'];

  // Die Eingabefelder des Formulars. "firma" ist der Honigtopf und muss leer bleiben.
  var FELDER = ['vorname', 'nachname', 'email', 'telefon', 'nachricht', 'firma'];

  // Die Bausteine des Dialogs. Sie werden ueber data-am-rolle gefunden, nie ueber Klassen
  // oder Tagnamen: so bleibt der Stil frei aenderbar, ohne das Modul zu brechen.
  var ROLLEN = ['form', 'schliessen', 'senden', 'hinweis', 'bot', 'erfolg', 'broschuere-link'];

  var NACHRICHT_MAX = 2000;   // K6
  var GRENZE_BYTES = 8192;    // K6: hoechstens 8 KB
  var TOKEN_FRIST_MS = 20000; // so lange wird auf ein Turnstile-Token gewartet

  // Sichtbare Texte. Schweizer Orthografie, "ss" statt scharfem s.
  var MELDUNGEN = {
    pflicht: 'Bitte füllen Sie Vorname, Nachname, E-Mail und Telefon aus.',
    email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    telefon: 'Bitte geben Sie eine Telefonnummer ein, unter der wir Sie erreichen.',
    gross: 'Ihre Nachricht ist zu lang. Bitte kürzen Sie sie.',
    bot: 'Die Sicherheitsprüfung ist noch nicht abgeschlossen. Bitte warten Sie einen Moment ' +
      'und senden Sie erneut.',
    ungueltig: 'Bitte prüfen Sie Ihre Angaben, eine davon konnten wir nicht annehmen.',
    herkunft: 'Diese Seite darf das Formular nicht senden. Bitte rufen Sie uns an: ' + TELEFON,
    zu_viele: 'Von diesem Anschluss kamen kurz hintereinander mehrere Anfragen. Bitte ' +
      'versuchen Sie es in einer Stunde erneut oder rufen Sie uns an: ' + TELEFON,
    mail: 'Ihre Anfrage hat uns nicht erreicht. Bitte rufen Sie uns an: ' + TELEFON,
    netz: 'Die Verbindung kam nicht zustande. Bitte rufen Sie uns an: ' + TELEFON,
    erfolg: 'Vielen Dank. Die Broschüre öffnet sich in einem neuen Fenster.'
  };

  // Die Gruende aus K6, die der Server im Koerper nennt.
  var GRUENDE = ['ungueltig', 'herkunft', 'zu_viele', 'mail'];

  var NACH_CODE = { 400: 'ungueltig', 403: 'herkunft', 429: 'zu_viele', 502: 'mail' };

  var EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

  function text(wert) {
    return String(wert === undefined || wert === null ? '' : wert).trim();
  }

  function ohneLeerraum(wert) {
    return String(wert === undefined || wert === null ? '' : wert).replace(/\s+/g, '');
  }

  /**
   * Feldpruefung im Browser. Liefert den Schluessel der Meldung oder null.
   *
   * Der Honigtopf steht zuerst: ist er gefuellt, wird gar nicht erst gesendet, und die
   * Meldung nennt ihn nicht, damit ein Skript nicht lernt, welches Feld es verraten hat.
   */
  function pruefe(werte) {
    if (text(werte.firma)) return 'ungueltig';
    if (!text(werte.vorname) || !text(werte.nachname) || !text(werte.email) || !text(werte.telefon)) {
      return 'pflicht';
    }
    if (!EMAIL.test(text(werte.email))) return 'email';
    if (ohneLeerraum(werte.telefon).replace(/[^0-9]/g, '').length < 6) return 'telefon';
    return null;
  }

  /**
   * Der Koerper aus K6, Schluessel in der Reihenfolge des Kontrakts.
   *
   * Der Leerraum faellt aus der Telefonnummer, damit Seite und Rechner dieselbe Schreibweise
   * senden (rechner/lead.js macht es genauso).
   */
  function koerperBauen(werte, felder, botToken, seite) {
    var koerper = {
      vorname: text(werte.vorname),
      nachname: text(werte.nachname),
      email: text(werte.email),
      telefon: ohneLeerraum(werte.telefon),
      nachricht: text(werte.nachricht).slice(0, NACHRICHT_MAX),
      quelle: werte.quelle || 'gate',
      seite: seite || ''
    };
    AM_FELDER.forEach(function (feld) {
      koerper[feld] = (felder && felder[feld]) || '';
    });
    koerper.bot_token = botToken || '';
    koerper.firma = text(werte.firma);
    return koerper;
  }

  /**
   * Uebersetzt eine Antwort nach K6 in einen Meldungsschluessel. null heisst Erfolg.
   *
   * Der Statuscode entscheidet, nicht der Koerper: ein Server, der 502 sendet und keinen
   * Grund nennt, muss trotzdem den Anruf-Satz ausloesen.
   */
  function meldungFuer(status, inhalt) {
    if (status === 200 && inhalt && inhalt.ok === true) return null;
    if (NACH_CODE[status]) return NACH_CODE[status];
    var grund = inhalt && inhalt.grund;
    if (grund && GRUENDE.indexOf(grund) !== -1) return grund;
    return 'netz';
  }

  /**
   * Bindet das Modul an ein Fenster. Getrennt vom Aufbau darunter, damit die Tests es gegen
   * einen Doppelgaenger fahren koennen, ohne ein DOM aus dem Netz zu laden.
   */
  function bauen(w) {
    var bot = { id: null, token: '', wartende: [] };
    var laeuft = false;

    function dok() {
      return w && w.document ? w.document : null;
    }

    function rolle(wurzel, name) {
      return wurzel ? wurzel.querySelector('[data-am-rolle="' + name + '"]') : null;
    }

    function botBehaelter() {
      var d = dok();
      return d ? d.querySelector('[data-am-rolle="bot"]') : null;
    }

    /** Turnstile explizit rendern, sobald der Dialog offen ist. Genau einmal. */
    function botVorbereiten() {
      var behaelter = botBehaelter();
      var t = w.turnstile;
      if (!behaelter || !t || typeof t.render !== 'function' || bot.id !== null) return;
      var sitekey = behaelter.getAttribute('data-am-sitekey') || '';
      if (!sitekey) return;
      try {
        bot.id = t.render(behaelter, {
          sitekey: sitekey,
          callback: function (token) { botSetzen(token || ''); },
          'error-callback': function () { botSetzen(''); },
          'expired-callback': function () { botSetzen(''); }
        });
      } catch (fehler) {
        bot.id = null;
      }
    }

    function botSetzen(token) {
      bot.token = token || '';
      var wartende = bot.wartende;
      bot.wartende = [];
      for (var i = 0; i < wartende.length; i++) wartende[i](bot.token);
    }

    /** Ein Turnstile-Token ist einmalig. Nach jedem Versuch faengt es von vorne an. */
    function botZuruecksetzen() {
      bot.token = '';
      var t = w.turnstile;
      if (t && typeof t.reset === 'function' && bot.id !== null) {
        try { t.reset(bot.id); } catch (fehler) { /* ein kaputtes Widget darf nichts brechen */ }
      }
    }

    /**
     * window.amBotToken aus K2: Promise<string>, nie eine Ablehnung.
     *
     * Ohne Turnstile geht ein leeres Token hinaus. Was daraus folgt, entscheidet der
     * Aufrufer: das Formular haelt an und sagt es (unten), rechner/lead.js sendet und
     * laesst den Server entscheiden.
     */
    function botToken() {
      botVorbereiten();
      if (bot.token) return Promise.resolve(bot.token);
      var t = w.turnstile;
      if (t && typeof t.getResponse === 'function' && bot.id !== null) {
        var wert = '';
        try { wert = t.getResponse(bot.id) || ''; } catch (fehler) { wert = ''; }
        if (wert) {
          bot.token = wert;
          return Promise.resolve(wert);
        }
      }
      if (!t || bot.id === null) return Promise.resolve('');
      return new Promise(function (fertig) {
        var erledigt = false;
        function einmal(token) {
          if (erledigt) return;
          erledigt = true;
          fertig(token || '');
        }
        bot.wartende.push(einmal);
        if (typeof w.setTimeout === 'function') {
          w.setTimeout(function () { einmal(''); }, TOKEN_FRIST_MS);
        }
      });
    }

    /**
     * Ruft amLeadFelder genau einmal und liefert die fuenf Felder vollstaendig, auch wenn
     * die Funktion fehlt oder mittendrin wirft (dieselbe Wache wie in rechner/lead.js).
     */
    function amSammeln() {
      var roh = {};
      var id = null;
      try {
        if (typeof w.amLeadFelder === 'function') {
          id = w.amLeadFelder(function (name, wert) { roh[name] = wert || ''; }) || null;
        }
      } catch (fehler) {
        id = null;
      }
      var felder = {};
      AM_FELDER.forEach(function (feld) {
        var wert = roh[feld];
        if (wert === undefined) wert = feld === 'am_consent' ? 'unknown' : '';
        felder[feld] = wert;
      });
      return { felder: felder, ereignisId: id || felder.am_ereignis_id || null };
    }

    function konversionMelden(ereignisId) {
      try {
        if (typeof w.amKonversion === 'function') w.amKonversion('anfrage');
      } catch (fehler) { /* die Messkette darf den Lead nie aufhalten */ }
      try {
        if (typeof w.fbq === 'function') {
          w.fbq('track', 'Lead', { content_name: 'Broschuere H8' },
            ereignisId ? { eventID: ereignisId } : undefined);
        }
      } catch (fehler) { /* dasselbe fuer den Pixel */ }
    }

    /**
     * Verdrahtet den Dialog. Liefert null, wenn es ihn auf dieser Seite nicht gibt: das
     * Modul darf auf jeder Seite geladen werden.
     */
    function starten(optionen) {
      var opt = optionen || {};
      var d = dok();
      if (!d) return null;
      var gate = d.getElementById('am-gate');
      if (!gate) return null;
      var form = rolle(gate, 'form');
      if (!form) return null;

      var hinweis = rolle(gate, 'hinweis');
      var knopf = rolle(gate, 'senden');
      var erfolgsansicht = rolle(gate, 'erfolg');
      var link = rolle(gate, 'broschuere-link');
      var endpunkt = gate.getAttribute('data-am-endpunkt') || ENDPUNKT;
      var telefon = gate.getAttribute('data-am-telefon') || TELEFON;
      var hole = opt.fetch || (typeof w.fetch === 'function' ? w.fetch.bind(w) : null);

      function feld(name) {
        return form.elements ? form.elements[name] : null;
      }

      function werteLesen() {
        var werte = {};
        FELDER.forEach(function (name) {
          var el = feld(name);
          werte[name] = el ? el.value : '';
        });
        werte.quelle = gate.getAttribute('data-am-quelle') || 'gate';
        return werte;
      }

      function melde(schluessel) {
        if (!hinweis) return;
        if (!schluessel) {
          hinweis.textContent = '';
          hinweis.classList.remove('am-rot');
          hinweis.classList.remove('am-gruen');
          return;
        }
        var satz = MELDUNGEN[schluessel] || MELDUNGEN.netz;
        // Die Nummer kann am Dialog stehen; dann steht sie auch im Satz.
        if (telefon !== TELEFON) satz = satz.split(TELEFON).join(telefon);
        hinweis.textContent = satz;
        hinweis.classList.remove(schluessel === 'erfolg' ? 'am-rot' : 'am-gruen');
        hinweis.classList.add(schluessel === 'erfolg' ? 'am-gruen' : 'am-rot');
      }

      // Die Beschriftung gehoert der Vorlage, nicht dem Modul: gelesen wird sie einmal beim
      // Verdrahten und nach jedem Versuch wieder eingesetzt.
      var knopfText = knopf ? knopf.textContent : '';

      function sperren(zu) {
        laeuft = zu;
        if (!knopf) return;
        knopf.disabled = !!zu;
        knopf.textContent = zu ? 'Wird gesendet …' : knopfText;
      }

      function fensterSchliessen(fenster) {
        if (!fenster) return;
        try { fenster.close(); } catch (fehler) { /* ein blockiertes Fenster hat kein close */ }
      }

      function erfolg(url, fenster, ereignisId) {
        if (url) {
          if (fenster) {
            try { fenster.location.href = url; } catch (fehler) { /* Popupblocker */ }
          }
          // Zweiter Weg fuer den Fall, dass der Browser das Fenster verworfen hat. Die
          // Adresse kommt aus der Antwort und landet erst jetzt im DOM, nie im Markup.
          if (link) {
            link.setAttribute('href', url);
            link.hidden = false;
          }
        } else {
          fensterSchliessen(fenster);
        }
        if (typeof form.reset === 'function') form.reset();
        form.hidden = true;
        if (erfolgsansicht) erfolgsansicht.hidden = false;
        melde('erfolg');
        sperren(false);
        botZuruecksetzen();
        konversionMelden(ereignisId);
      }

      function fehlschlag(schluessel, fenster) {
        fensterSchliessen(fenster);
        melde(schluessel);
        sperren(false);
        botZuruecksetzen();
        return { ok: false, grund: schluessel };
      }

      function absenden(ereignis) {
        if (ereignis && typeof ereignis.preventDefault === 'function') ereignis.preventDefault();
        if (laeuft) return Promise.resolve({ ok: false, grund: 'laeuft' });

        var werte = werteLesen();
        var fehler = pruefe(werte);
        if (fehler) {
          melde(fehler);
          return Promise.resolve({ ok: false, grund: fehler });
        }
        if (!hole) {
          melde('netz');
          return Promise.resolve({ ok: false, grund: 'netz' });
        }

        sperren(true);
        melde(null);
        // Erst einsammeln, dann senden: die fuenf Felder stehen genau einmal und in der
        // Reihenfolge aus K2, auch wenn amLeadFelder fehlt oder wirft.
        var am = amSammeln();

        // Vor jedem Warten: das leere Fenster aus der Nutzergeste heraus. Seine Adresse
        // setzt erst die 200-Antwort.
        var fenster = null;
        try {
          if (typeof w.open === 'function') fenster = w.open('', '_blank');
        } catch (f) {
          fenster = null;
        }

        return botToken()
          .then(function (token) {
            if (!token) return fehlschlag('bot', fenster);

            var koerper = koerperBauen(werte, am.felder, token, w.location ? w.location.href : '');
            var rumpf = JSON.stringify(koerper);
            if (rumpf.length > GRENZE_BYTES) return fehlschlag('gross', fenster);

            return hole(endpunkt, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: rumpf,
              // Fremder Ursprung: ohne Anmeldedaten, sonst verlangte die Route
              // Access-Control-Allow-Credentials, das K6 nicht zusagt.
              credentials: 'omit'
            }).then(function (antwort) {
              return Promise.resolve()
                .then(function () { return antwort.json(); })
                .catch(function () { return null; })
                .then(function (inhalt) {
                  var schluessel = meldungFuer(antwort.status, inhalt);
                  if (schluessel) return fehlschlag(schluessel, fenster);
                  var url = (inhalt && inhalt.broschuere_url) || '';
                  erfolg(url, fenster, am.ereignisId);
                  return { ok: true, broschuereUrl: url };
                });
            });
          })
          .catch(function () { return fehlschlag('netz', fenster); });
      }

      function offen() {
        return gate.classList.contains('am-auf');
      }

      function oeffnen() {
        if (form.hidden) {
          // Nach einem Erfolg wieder von vorne, sonst sieht der zweite Interessent am
          // selben Rechner nur die Danksagung des ersten.
          form.hidden = false;
          if (erfolgsansicht) erfolgsansicht.hidden = true;
          if (link) link.hidden = true;
        }
        melde(null);
        gate.classList.add('am-auf');
        if (d.body && d.body.style) d.body.style.overflow = 'hidden';
        botVorbereiten();
        var erstes = feld('vorname');
        if (erstes && typeof erstes.focus === 'function') erstes.focus();
      }

      function schliessen() {
        gate.classList.remove('am-auf');
        if (d.body && d.body.style) d.body.style.overflow = '';
      }

      var ausloeser = d.querySelectorAll('[data-am-gate]');
      for (var i = 0; i < ausloeser.length; i++) {
        (function (el) {
          el.addEventListener('click', function (e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            oeffnen();
          });
        })(ausloeser[i]);
      }

      var zu = rolle(gate, 'schliessen');
      if (zu) zu.addEventListener('click', schliessen);
      gate.addEventListener('click', function (e) {
        // Nur die Huelle schliesst, nie ein Klick in die Karte.
        if (e && e.target === gate) schliessen();
      });
      d.addEventListener('keydown', function (e) {
        if (!e || e.key !== 'Escape') return;
        if (offen()) schliessen();
      });
      form.addEventListener('submit', absenden);

      sperren(false);
      return { oeffnen: oeffnen, schliessen: schliessen, absenden: absenden, offen: offen };
    }

    return { botToken: botToken, starten: starten };
  }

  var oeffentlich = {
    bauen: bauen,
    pruefe: pruefe,
    koerperBauen: koerperBauen,
    meldungFuer: meldungFuer,
    MELDUNGEN: MELDUNGEN,
    AM_FELDER: AM_FELDER,
    FELDER: FELDER,
    ROLLEN: ROLLEN,
    ENDPUNKT: ENDPUNKT,
    TELEFON: TELEFON,
    NACHRICHT_MAX: NACHRICHT_MAX,
    GRENZE_BYTES: GRENZE_BYTES
  };

  // Im Browser: den einen Namen aus K2 setzen und den Dialog verdrahten. amBotToken wird
  // bewusst ueberschrieben, nicht vorbelegt: am-kontrakt.js haelt nur die wirkungslose
  // Vorgabe, gefuellt wird sie hier (K2, Spalte "wer fuellt").
  if (global && global.document) {
    var api = bauen(global);
    global.amBotToken = api.botToken;
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { api.starten(); });
    } else {
      api.starten();
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = oeffentlich;
})(typeof window !== 'undefined' ? window : globalThis);
