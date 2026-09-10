/**
 * Das Einwilligungsbanner der H8-Seite (Plan h8-website, Arbeitspaket 5, Entscheidung E5).
 *
 * Eigenes Banner, keine dritte Partei, keine Abhaengigkeit. Zwei Zustaende, nicht drei:
 * "Notwendig" gilt immer, "Marketing" ist die Wahl. Eine Statistik-Kategorie gibt es nicht,
 * weil es keine Analytics-Property gibt (E5); analytics_storage bleibt deshalb 'denied'.
 *
 * Diese Datei fuellt genau zwei der zehn Namen aus K2 und legt keinen elften an:
 *   window.amEinwilligung()       -> 'granted' | 'denied' | 'unknown'
 *   window.amEinwilligungOeffnen()  oeffnet das Banner erneut (Knopf in der Fussleiste)
 *
 * Die Sperre, um die es hier geht: solange keine ausdrueckliche Zustimmung gespeichert ist,
 * liefert amEinwilligung() nie 'granted'. Jeder unlesbare, halbe, fremde oder aeltere
 * Cookie-Inhalt faellt auf 'unknown' zurueck, nie auf 'granted'. Eine Voreinstellung, die
 * Einwilligung behauptet, waere ein Rechtsfehler, kein Bug (so steht es schon in
 * am-kontrakt.js). Arbeitspaket 6 laedt Pixel und Google-Tag erst, wenn hier 'granted' steht.
 *
 * Speicherung im Cookie `am_consent`, sechs Monate, Wert
 * {v:1, marketing:'granted'|'denied', ts:<ISO>, textstand:'<Datum>'}. Cookie und nicht
 * localStorage, weil der Zustand vor dem Laden der Marketingteile lesbar sein muss (E5).
 *
 * Kein Netzzugriff, kein fremdes Element, kein Nachladen: dieses Modul entscheidet nur und
 * sagt Bescheid. Klassisches Skript, kein ESM, damit es ohne Bauschritt geladen werden kann.
 */
(function (wirt) {
  'use strict';

  /** Name des Cookies. Woertlich wie in K2 und in der field_map des Mandanten. */
  var COOKIE = 'am_consent';

  /**
   * Fassung des gespeicherten Wertes. Ein Cookie mit einer anderen Fassung gilt als
   * unbekannt, das ist der Zweck des Feldes: eine Umstellung des Formats fragt neu, statt
   * eine alte Struktur zu raten.
   */
  var VERSION = 1;

  /**
   * Textstand der Datenschutzerklaerung, den der Besucher gesehen hat. Er wird
   * mitgespeichert, weil er der Nachweis ist, wozu genau zugestimmt wurde (E5, Punkt 1).
   * Er macht eine gespeicherte Wahl bewusst NICHT ungueltig: das waere eine Rechtsfrage
   * (W13) und keine Bauentscheidung. Wer den Rechtstext aendert, aendert diesen Wert mit.
   */
  var TEXTSTAND = '2026-09-10';

  /** Sechs Monate in Sekunden (180 Tage), die Frist aus E5. */
  var DAUER_SEKUNDEN = 15552000;

  /**
   * Ereignis auf `document`, mit dem die Messkette (Arbeitspaket 6) von einer frischen
   * Entscheidung erfaehrt, ohne dass hier ein elfter globaler Name entsteht.
   */
  var EREIGNIS = 'am-einwilligung';

  /** Alle sichtbaren Texte an einer Stelle, deutsche Rechtschreibung der Schweiz. */
  var TEXT = {
    titel: 'Cookies und Marketing',
    beschreibung: 'Notwendige Cookies halten diese Seite am Laufen. Für Marketing und die ' +
      'Messung unserer Anzeigen (Meta, Google) brauchen wir Ihre Einwilligung. Sie können ' +
      'Ihre Wahl jederzeit im Fuss der Seite unter «Cookie-Einstellungen» ändern.',
    annehmen: 'Alle akzeptieren',
    ablehnen: 'Nur notwendige',
    schliessen: 'Schliessen',
    datenschutz: 'Datenschutzerklärung',
    standGranted: 'Ihre aktuelle Wahl: Marketing erlaubt.',
    standDenied: 'Ihre aktuelle Wahl: nur notwendige Cookies.'
  };

  // --- Lesen -------------------------------------------------------------------------

  /** Liefert den rohen Cookie-Wert oder null. Liest nur, schreibt nie. */
  function gespeichert(w) {
    var dok = w && w.document;
    if (!dok) return null;
    var teile = String(dok.cookie || '').split(';');
    for (var i = 0; i < teile.length; i++) {
      var stueck = teile[i].replace(/^\s+|\s+$/g, '');
      if (stueck.indexOf(COOKIE + '=') === 0) return stueck.slice(COOKIE.length + 1);
    }
    return null;
  }

  /**
   * Die Sperre in einer Funktion: nur ein vollstaendig lesbarer Wert der aktuellen Fassung
   * mit dem woertlichen Wert 'granted' ergibt 'granted'. Alles andere ist 'unknown', und
   * 'denied' braucht ebenso den woertlichen Wert.
   */
  function ausWert(roh) {
    if (!roh) return 'unknown';
    var daten;
    try {
      daten = JSON.parse(decodeURIComponent(roh));
    } catch (fehler) {
      return 'unknown';
    }
    if (!daten || typeof daten !== 'object') return 'unknown';
    if (daten.v !== VERSION) return 'unknown';
    if (daten.marketing === 'granted') return 'granted';
    if (daten.marketing === 'denied') return 'denied';
    return 'unknown';
  }

  // --- Schreiben ---------------------------------------------------------------------

  /** Schreibt die Wahl in das Cookie und liefert den geschriebenen Wert zurueck. */
  function merke(w, wahl) {
    var wert = {
      v: VERSION,
      marketing: wahl,
      ts: new Date().toISOString(),
      textstand: TEXTSTAND
    };
    var stueck = [
      COOKIE + '=' + encodeURIComponent(JSON.stringify(wert)),
      'Max-Age=' + DAUER_SEKUNDEN,
      'Path=/',
      'SameSite=Lax'
    ];
    // Secure nur ueber HTTPS, sonst waere das Cookie in einer lokalen Vorschau wirkungslos.
    if (w.location && String(w.location.protocol) === 'https:') stueck.push('Secure');
    w.document.cookie = stueck.join('; ');
    return wert;
  }

  /**
   * Sagt der Messkette Bescheid: Consent Mode v2 als Aktualisierung, dazu ein Ereignis auf
   * `document`. Beides in try/catch, denn ein fremder Fehler darf die Entscheidung des
   * Besuchers nicht verschlucken; das Cookie ist an dieser Stelle schon geschrieben.
   */
  function melde(w, wahl) {
    var erlaubt = wahl === 'granted' ? 'granted' : 'denied';
    try {
      if (typeof w.gtag === 'function') {
        w.gtag('consent', 'update', {
          ad_storage: erlaubt,
          ad_user_data: erlaubt,
          ad_personalization: erlaubt,
          analytics_storage: 'denied'
        });
      }
    } catch (fehler) {
      /* Ein kaputtes Google-Tag bleibt ein Messproblem, kein Bedienproblem. */
    }
    try {
      var dok = w.document;
      if (dok && typeof dok.dispatchEvent === 'function') {
        var ereignis;
        if (typeof w.CustomEvent === 'function') {
          ereignis = new w.CustomEvent(EREIGNIS, { detail: { stand: wahl } });
        } else {
          ereignis = { type: EREIGNIS, detail: { stand: wahl } };
        }
        dok.dispatchEvent(ereignis);
      }
    } catch (fehler) {
      /* dito */
    }
  }

  // --- Oberflaeche -------------------------------------------------------------------

  function element(dok, tag, klasse, text) {
    var knoten = dok.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text) knoten.textContent = text;
    return knoten;
  }

  function entferne(knoten) {
    if (!knoten) return;
    if (typeof knoten.remove === 'function') knoten.remove();
    else if (knoten.parentNode) knoten.parentNode.removeChild(knoten);
  }

  /**
   * Ruft `tue`, sobald der Koerper des Dokuments existiert. Wird diese Datei im Kopf
   * geladen, wartet das Banner, statt sich neben den Kopf zu haengen.
   */
  function beiBereit(w, tue) {
    var dok = w && w.document;
    if (!dok) return;
    if (dok.body) {
      tue();
      return;
    }
    if (typeof dok.addEventListener === 'function') {
      var einmal = function () {
        dok.removeEventListener('DOMContentLoaded', einmal);
        tue();
      };
      dok.addEventListener('DOMContentLoaded', einmal);
    }
  }

  /**
   * Baut das Banner. `vorher` steuert nur zwei Zugaben: den Satz mit der
   * aktuellen Wahl und den Schliessen-Knopf. Beide gibt es erst, wenn schon eine Wahl
   * vorliegt: ein Wegklicken ohne Entscheidung waere die stille Variante von 'granted'.
   */
  function baue(dok, vorher, entscheide, schliessen) {
    var wurzel = element(dok, 'div', 'am-einwilligung');
    wurzel.setAttribute('role', 'dialog');
    wurzel.setAttribute('aria-labelledby', 'am-ew-titel');
    wurzel.setAttribute('aria-describedby', 'am-ew-text');
    wurzel.setAttribute('data-stand', vorher);

    var inhalt = element(dok, 'div', 'am-ew-inhalt');
    wurzel.appendChild(inhalt);

    var titel = element(dok, 'h2', 'am-ew-titel', TEXT.titel);
    titel.setAttribute('id', 'am-ew-titel');
    inhalt.appendChild(titel);

    var text = element(dok, 'p', 'am-ew-text', TEXT.beschreibung);
    text.setAttribute('id', 'am-ew-text');
    inhalt.appendChild(text);

    if (vorher !== 'unknown') {
      inhalt.appendChild(element(
        dok, 'p', 'am-ew-stand',
        vorher === 'granted' ? TEXT.standGranted : TEXT.standDenied
      ));
    }

    // Beide Schaltflaechen stehen in derselben Zeile, in derselben Ebene, in derselben
    // Groesse (einwilligung.css). Ablehnen steht zuerst, damit auch die Tastatur es zuerst
    // erreicht. Ablehnen ist damit so leicht wie Annehmen, wie E5 es verlangt.
    var wahl = element(dok, 'div', 'am-ew-wahl');
    inhalt.appendChild(wahl);

    var nein = element(dok, 'button', 'am-ew-knopf am-ew-knopf--nein', TEXT.ablehnen);
    nein.setAttribute('type', 'button');
    nein.setAttribute('data-wahl', 'denied');
    nein.addEventListener('click', function () { entscheide('denied'); });
    wahl.appendChild(nein);

    var ja = element(dok, 'button', 'am-ew-knopf am-ew-knopf--ja', TEXT.annehmen);
    ja.setAttribute('type', 'button');
    ja.setAttribute('data-wahl', 'granted');
    ja.addEventListener('click', function () { entscheide('granted'); });
    wahl.appendChild(ja);

    var fuss = element(dok, 'p', 'am-ew-fuss');
    var link = element(dok, 'a', 'am-ew-link', TEXT.datenschutz);
    link.setAttribute('href', '/datenschutz/');
    fuss.appendChild(link);
    inhalt.appendChild(fuss);

    if (vorher !== 'unknown') {
      var zu = element(dok, 'button', 'am-ew-schliessen', TEXT.schliessen);
      zu.setAttribute('type', 'button');
      zu.setAttribute('aria-label', TEXT.schliessen);
      zu.addEventListener('click', function () { schliessen(); });
      inhalt.appendChild(zu);
    }

    return { wurzel: wurzel, nein: nein, ja: ja };
  }

  // --- Aufbau ------------------------------------------------------------------------

  /**
   * Legt die beiden Namen aus K2 auf `w` und zeigt das Banner, solange keine Wahl vorliegt.
   * Gibt einen Griff fuer die Tests zurueck; auf `window` landet davon nichts.
   */
  function installiere(w) {
    var offen = null;
    var taste = null;

    function stand() {
      return ausWert(gespeichert(w));
    }

    function schliessen() {
      if (!offen) return;
      entferne(offen.wurzel);
      var dok = w.document;
      if (taste && dok && typeof dok.removeEventListener === 'function') {
        dok.removeEventListener('keydown', taste);
      }
      taste = null;
      offen = null;
    }

    function entscheide(wahl) {
      var vorher = stand();
      merke(w, wahl);
      schliessen();
      melde(w, wahl);
      // Widerruf: was vor der Ablehnung geladen wurde, laesst sich nicht zurueckholen.
      // Deshalb neu laden, und nur dann, denn ein Neuladen nach jedem Klick waere
      // laestig und nach einer Zustimmung ueberfluessig (E5).
      if (wahl === 'denied' && vorher === 'granted') {
        if (w.location && typeof w.location.reload === 'function') w.location.reload();
      }
    }

    function zeige() {
      var dok = w.document;
      if (!dok || typeof dok.createElement !== 'function') return;
      if (offen) {
        if (typeof offen.nein.focus === 'function') offen.nein.focus();
        return;
      }
      var vorher = stand();
      offen = baue(dok, vorher, entscheide, schliessen);
      var platz = dok.body || dok.documentElement;
      if (!platz) {
        offen = null;
        return;
      }
      platz.appendChild(offen.wurzel);
      if (typeof offen.nein.focus === 'function') offen.nein.focus();
      if (typeof dok.addEventListener === 'function') {
        taste = function (ereignis) {
          if (!ereignis) return;
          if (ereignis.key !== 'Escape' && ereignis.key !== 'Esc') return;
          // Escape schliesst nur ein Banner, hinter dem schon eine Wahl steht. Ohne Wahl
          // waere das Wegdruecken eine Entscheidung, die niemand getroffen hat.
          if (stand() !== 'unknown') schliessen();
        };
        dok.addEventListener('keydown', taste);
      }
    }

    function oeffnen() {
      beiBereit(w, zeige);
    }

    // K2: Vorgabe aus am-kontrakt.js ersetzen, keinen weiteren Namen anlegen.
    w.amEinwilligung = stand;
    w.amEinwilligungOeffnen = oeffnen;

    if (stand() === 'unknown') oeffnen();

    return {
      stand: stand,
      oeffnen: oeffnen,
      schliessen: schliessen,
      banner: function () { return offen; }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      installiere: installiere,
      COOKIE: COOKIE,
      VERSION: VERSION,
      TEXTSTAND: TEXTSTAND,
      DAUER_SEKUNDEN: DAUER_SEKUNDEN,
      EREIGNIS: EREIGNIS,
      TEXT: TEXT
    };
  }

  // Im Browser genau ein Aufruf, im Test keiner: dort setzt jeder Fall seinen eigenen Wirt.
  if (wirt && typeof wirt.document !== 'undefined') installiere(wirt);
})(typeof window !== 'undefined' ? window : null);
