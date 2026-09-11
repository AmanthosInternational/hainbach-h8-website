/**
 * Die Messkette der H8-Seite: Google Consent Mode v2, Google Tag, Meta-Pixel, Ereignis-IDs,
 * Klick-IDs, Anrufconversion und die Klickereignisse. Sie loest die beiden Messsnippets der
 * Bestandsseite ab und fuellt den globalen JS-Vertrag K2 (Namen aus M22).
 *
 * Die eine Zusage, an der alles haengt: OHNE EINWILLIGUNG WIRD NICHT GEMESSEN.
 * Diese Datei ruft `window.amEinwilligung()`. Solange die Antwort nicht 'granted' lautet,
 * entsteht kein Skript-Element, geht kein `fbq`- und kein `gtag`-Ereignis hinaus und wird
 * keine Klick-ID gespeichert. Einzige Ausnahme ist der Consent-Mode-Vorgabewert, der nur in
 * das lokale `dataLayer`-Feld geschrieben wird und keinen Netzverkehr ausloest; Google
 * verlangt ihn ausdruecklich VOR dem Laden des Tags.
 *
 * Reihenfolge beim Laden: am-kontrakt.js, einwilligung.js, messkette.js. Der Vertrag legt
 * wirkungslose Vorbelegungen an, diese Datei ersetzt die sieben Namen, die ihr gehoeren:
 * amEreignisId, amLetzteEreignisId, amCookie, amGclid, amFbc, amLeadFelder, amKonversion.
 * `amEinwilligung` gehoert der Einwilligungsoberflaeche und wird hier nur gelesen, nie gesetzt.
 *
 * Die Grenze zur Einwilligungsoberflaeche, damit sie niemand zweimal baut: sie stellt
 * `amEinwilligung()`, sie sendet die Aktualisierung des Consent Mode bei jeder Entscheidung
 * (mit `analytics_storage` dauerhaft auf 'denied'), und sie feuert `am-einwilligung` auf
 * `document`. Diese Datei stellt den Vorgabewert des Consent Mode, horcht auf das Ereignis
 * und zieht danach nach, ohne die Seite neu zu laden.
 *
 * Zwei Namen ausserhalb des Vertrags, beide gewollt und beide belegt:
 *   window.amMesskette             Zustand und Pruefeinstieg, macht den doppelten Aufbau
 *                                  wirkungslos (genau ein Pixel-Init je Seitenaufruf).
 *   window.amAnrufnummerGetauscht  Beweisstueck fuer Punkt 8 der Pruefliste.
 *
 * Kein Framework, keine Fremdbibliothek, kein Bezug auf das Formular-Plugin der Bestandsseite.
 * Klassisches Skript, kein ESM. Unter Node ohne DOM exportiert die Datei nur `aufbau`, damit
 * die Pruefung sie gegen einen DOM-Doppelgaenger fahren kann.
 */
(function () {
  'use strict';

  /* Projektwerte. Sie stehen so in der Sammelstelle des Mandanten und sind allesamt Werte,
     die ohnehin im ausgelieferten HTML jeder Werbeseite stehen. Ein leerer Wert ist ein
     offener Inhaberschritt und kein Fehler: der zugehoerige Pfad bleibt dann einfach aus.
     pixelId ist am 10.09.2026 leer, weil das eigene H8-Pixel noch nicht angelegt ist. */
  var VORGABEN = {
    adsKonto: 'AW-702540316',
    adsZiel: {
      anfrage: 'AW-702540316/TTx-CNCYxvIcEJzU_84C',
      telefon: 'AW-702540316/WI55CNmYxvIcEJzU_84C',
      termin: 'AW-702540316/M2U-CNOYxvIcEJzU_84C'
    },
    adsAnruf: 'AW-702540316/YjuZCNaYxvIcEJzU_84C',
    pixelId: '',
    anrufAnzeige: '+49 (0) 711 209 095 75',
    gtagQuelle: 'https://www.googletagmanager.com/gtag/js?id=',
    pixelQuelle: 'https://connect.facebook.net/en_US/fbevents.js',
    /* Taktgeber, der die Einwilligung nachfragt, solange sie unbeantwortet ist. Er ist der
       Grund, warum die Messung auch dann anspringt, wenn die Oberflaeche der Einwilligung
       kein Ereignis feuert. Er endet, sobald eine Antwort vorliegt. */
    pruefTaktMs: 1000,
    einwilligungEreignis: 'am-einwilligung'
  };

  var TAGE90 = 90 * 86400 * 1000;
  var PRAEFIX = 'h8-';
  var GCLID_SCHLUESSEL = 'am_gclid';

  /** Flache Mischung: Vorgaben, darueber die Ueberschreibung der Pruefung. */
  function mische(grund, oben) {
    var ergebnis = {};
    var name;
    for (name in grund) {
      if (Object.prototype.hasOwnProperty.call(grund, name)) ergebnis[name] = grund[name];
    }
    if (!oben) return ergebnis;
    for (name in oben) {
      if (Object.prototype.hasOwnProperty.call(oben, name)) ergebnis[name] = oben[name];
    }
    return ergebnis;
  }

  /** Ruft fn und schluckt jeden Fehler. Eine kaputte Messung darf die Seite nie zerbrechen. */
  function sicher(fn, ersatz) {
    try {
      return fn();
    } catch (e) {
      return ersatz;
    }
  }

  /**
   * Baut die Messkette auf einem Fenster auf. Im Browser laeuft das einmal am Dateiende,
   * die Pruefung ruft es mit einem Doppelgaenger und eigenen Werten.
   */
  function aufbau(w, ueberschreibung) {
    if (!w) return null;

    /* Doppelter Aufbau: Zustand liegt am Fenster, nicht in dieser Funktion. Ein zweites
       Skript-Element mit derselben Datei darf den Pixel nicht ein zweites Mal anmelden. */
    if (w.amMesskette && w.amMesskette.aufgebaut) {
      w.amMesskette.pruefen();
      return w.amMesskette;
    }

    var K = mische(VORGABEN, ueberschreibung);
    var d = w.document;
    var zustand = { gestartet: false, pixelInit: false, tagGeladen: false, takt: null };

    // --- Einwilligung, die einzige Wache -------------------------------------------------
    function einwilligung() {
      return sicher(function () {
        if (typeof w.amEinwilligung !== 'function') return 'unknown';
        return w.amEinwilligung() || 'unknown';
      }, 'unknown');
    }

    /** Die Bedingung, ohne die nichts hinausgeht. Wer sie entfernt, macht die Pruefung rot. */
    function erlaubt() {
      return einwilligung() === 'granted';
    }

    // --- Werkzeuge ------------------------------------------------------------------------
    function ausAdresse(name) {
      return sicher(function () {
        var suche = (w.location && w.location.search) || '';
        if (!suche) return '';
        if (typeof URLSearchParams === 'function') {
          return new URLSearchParams(suche).get(name) || '';
        }
        var treffer = new RegExp('[?&]' + name + '=([^&]*)').exec(suche);
        return treffer ? decodeURIComponent(treffer[1]) : '';
      }, '');
    }

    function ablageLesen(schluessel) {
      return sicher(function () {
        var roh = w.localStorage && w.localStorage.getItem(schluessel);
        return roh ? JSON.parse(roh) : null;
      }, null);
    }

    function ablageSchreiben(schluessel, wert) {
      sicher(function () {
        if (!w.localStorage) return null;
        w.localStorage.setItem(schluessel, JSON.stringify({ v: wert, t: Date.now() }));
        return null;
      }, null);
    }

    /** Legt ein Skript-Element an und haengt es ein. Nur von den Ladepfaden gerufen. */
    function skriptLaden(quelle) {
      return sicher(function () {
        if (!d || typeof d.createElement !== 'function') return null;
        var s = d.createElement('script');
        s.async = true;
        s.src = quelle;
        var ziel = d.head || d.documentElement || d.body;
        if (ziel && typeof ziel.appendChild === 'function') ziel.appendChild(s);
        return s;
      }, null);
    }

    // --- Google Consent Mode v2 -----------------------------------------------------------
    /* gtag ist eine Warteschlange, kein Netzaufruf. Der Vorgabewert muss vor jedem anderen
       gtag-Aufruf stehen, sonst wertet Google die spaeteren Aufrufe als einwilligungsfrei. */
    function gtagBereit() {
      if (!w.dataLayer) w.dataLayer = [];
      if (typeof w.gtag !== 'function') {
        w.gtag = function () {
          w.dataLayer.push(arguments);
        };
      }
    }

    function consentVorgabe() {
      gtagBereit();
      w.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied'
      });
    }

    /* Das `update` sendet die Einwilligungsoberflaeche selbst, bei jeder Entscheidung und mit
       `analytics_storage` dauerhaft auf 'denied', weil es keine Analytics-Eigenschaft gibt.
       Hier wird es deshalb bewusst NICHT gesendet: zwei Aktualisierungen mit verschiedenen
       Werten fuer `analytics_storage` wuerden einander ueberschreiben, und wer zuletzt
       schreibt, haette gewonnen. Der Vorgabewert oben bleibt unsere Aufgabe, er muss stehen,
       bevor irgendein Tag geladen wird. */

    // --- Anrufconversion ------------------------------------------------------------------
    /* Aus der Anzeigeform wird die internationale Form gerechnet, damit nur ein Wert gepflegt
       werden muss: aus "+49 (0) 711 ..." wird "+49711...", die Null nach der Landesvorwahl
       faellt weg. */
    function anrufE164() {
      return '+' + String(K.anrufAnzeige || '').replace(/\D/g, '').replace(/^490/, '49');
    }

    /* Google ersetzt von sich aus nur den Text. Wir tauschen zusaetzlich das tel:-Ziel, sonst
       waehlt ein Mobilgeraet weiter die Festnetznummer und der Anruf zaehlt nicht. */
    function nummerTauschen(anzeige, mobil) {
      sicher(function () {
        if (!d || typeof d.querySelectorAll !== 'function') return null;
        var ziel = anrufE164().replace(/\D/g, '');
        var roh = String(mobil || '');
        var href = /^tel:/i.test(roh) ? roh : 'tel:' + roh.replace(/[^\d+]/g, '');
        var links = d.querySelectorAll('a[href^="tel:"]');
        for (var i = 0; i < links.length; i++) {
          var a = links[i];
          var ziffern = String(a.getAttribute('href') || '')
            .replace(/\D/g, '')
            .replace(/^490/, '49');
          if (ziffern !== ziel) continue;
          a.href = href;
          a.textContent = anzeige;
        }
        w.amAnrufnummerGetauscht = anzeige;
        return null;
      }, null);
    }

    // --- Die Ladepfade, alle hinter der Wache ---------------------------------------------
    function googleTagLaden() {
      if (zustand.tagGeladen) return;
      if (!K.adsKonto) return;
      zustand.tagGeladen = true;
      skriptLaden(K.gtagQuelle + K.adsKonto);
      w.gtag('js', new Date());
      w.gtag('config', K.adsKonto);
      if (!K.adsAnruf) return;
      w.gtag('config', K.adsAnruf, {
        phone_conversion_number: anrufE164(),
        phone_conversion_callback: nummerTauschen
      });
    }

    /* Der Lader von Meta, wortgleich in der Wirkung zum Bestandssnippet, nur gegen `w` und
       `d` statt gegen die Globalen geschrieben. */
    function pixelLader() {
      if (w.fbq) return;
      var n = function () {
        if (n.callMethod) n.callMethod.apply(n, arguments);
        else n.queue.push(arguments);
      };
      w.fbq = n;
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      skriptLaden(K.pixelQuelle);
    }

    function pixelLaden() {
      if (zustand.pixelInit) return;
      /* Offener Inhaberschritt: ohne eigene Pixel-Kennung wird nichts angelegt und nichts
         gemeldet. Der Rest der Messkette laeuft weiter, die Meta-Haelfte fehlt still. */
      if (!K.pixelId) return;
      pixelLader();
      zustand.pixelInit = true;
      sicher(function () {
        w.fbq('init', K.pixelId);
        w.fbq('track', 'PageView');
        return null;
      }, null);
    }

    function starten() {
      if (zustand.gestartet) return;
      if (!erlaubt()) return;
      zustand.gestartet = true;
      googleTagLaden();
      pixelLaden();
      /* Jetzt erst darf die Klick-ID die 90 Tage ueberdauern. */
      sicher(w.amGclid, '');
    }

    // --- Der Vertrag K2, die sieben Namen dieser Datei -------------------------------------
    w.amEreignisId = function (art) {
      var id = PRAEFIX + (art || 'ereignis') + '-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 10);
      w.amLetzteEreignisId = id;
      return id;
    };

    if (w.amLetzteEreignisId === undefined) w.amLetzteEreignisId = null;

    w.amCookie = function (name) {
      return sicher(function () {
        if (!name || !d) return '';
        var treffer = String(d.cookie || '').match(
          new RegExp('(?:^|; )' + name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1') + '=([^;]*)')
        );
        return treffer ? decodeURIComponent(treffer[1]) : '';
      }, '');
    };

    /* gclid: aus der Adresszeile, sonst aus dem gesicherten Wert. Gesichert wird nur mit
       Einwilligung, weil das Ablegen einer Werbekennung im Geraet genau die Speicherung ist,
       die die Einwilligung deckt. Gelesen wird immer: was frueher unter Einwilligung
       abgelegt wurde, bleibt gueltig, bis die 90 Tage um sind. */
    w.amGclid = function () {
      var ausUrl = ausAdresse('gclid');
      if (ausUrl) {
        if (erlaubt()) ablageSchreiben(GCLID_SCHLUESSEL, ausUrl);
        return ausUrl;
      }
      var alt = ablageLesen(GCLID_SCHLUESSEL);
      if (alt && alt.v && Date.now() - alt.t < TAGE90) return alt.v;
      return '';
    };

    /* fbc: das Cookie von Meta, sonst aus fbclid in Metas Format gebaut. Kein Schreiben. */
    w.amFbc = function () {
      var c = w.amCookie('_fbc');
      if (c) return c;
      var id = ausAdresse('fbclid');
      if (id) return 'fb.1.' + Date.now() + '.' + id;
      return '';
    };

    /* Die fuenf versteckten Werte, woertlich nach K2. Gemeinsam fuer Formular, Gate und
       Rechner, damit alle drei dasselbe senden. setzer(name, wert). */
    w.amLeadFelder = function (setzer) {
      if (typeof setzer !== 'function') return w.amLetzteEreignisId;
      var id = w.amEreignisId('lead');
      w.amLetzteEreignisId = id;
      setzer('am_ereignis_id', id);
      setzer('am_consent', einwilligung());
      setzer('am_gclid', sicher(w.amGclid, ''));
      setzer('am_fbp', w.amCookie('_fbp'));
      setzer('am_fbc', sicher(w.amFbc, ''));
      return id;
    };

    /* 'anfrage' vom Formular und vom Gate, 'telefon' vom Anrufklick, 'termin' vom Rechner.
       'anruf' ist keine Art: die Anrufconversion zaehlt Google selbst ueber die
       Weiterleitungsnummer. */
    w.amKonversion = function (art) {
      if (!erlaubt()) return;
      var ziel = K.adsZiel[art];
      if (!ziel) return;
      if (typeof w.gtag !== 'function') return;
      sicher(function () {
        w.gtag('event', 'conversion', { send_to: ziel });
        return null;
      }, null);
    };

    // --- Klickereignisse -------------------------------------------------------------------
    /* Ueber das Dokument delegiert, damit auch spaeter eingehaengte Knoepfe zaehlen. Jeder
       Zweig fragt die Einwilligung erneut: die Zuhoerer haengen von Anfang an, melden aber
       erst, wenn eine Antwort vorliegt. */
    function naechsterLink(knoten) {
      return sicher(function () {
        if (!knoten || typeof knoten.closest !== 'function') return null;
        return knoten.closest('a');
      }, null);
    }

    function istPdf(href) {
      return /\.pdf(?:$|[?#])/i.test(String(href || ''));
    }

    function beiKlick(e) {
      if (!erlaubt()) return;
      var a = naechsterLink(e && e.target);
      if (!a) return;
      var href = String((a.getAttribute && a.getAttribute('href')) || a.href || '');
      if (/^tel:/i.test(href)) {
        w.amKonversion('telefon');
        sicher(function () {
          if (typeof w.fbq === 'function') {
            w.fbq('track', 'Contact', { content_name: 'Telefon H8' },
              { eventID: w.amEreignisId('contact') });
          }
          if (typeof w.gtag === 'function') w.gtag('event', 'phone_click');
          return null;
        }, null);
        return;
      }
      if (!istPdf(href)) return;
      sicher(function () {
        if (typeof w.fbq === 'function') {
          w.fbq('track', 'ViewContent', { content_name: 'Broschuere H8' });
        }
        if (typeof w.gtag === 'function') {
          w.gtag('event', 'file_download', { file_name: 'Broschuere H8' });
        }
        return null;
      }, null);
    }

    // --- Nachfragen, bis die Einwilligung beantwortet ist ---------------------------------
    function taktEnde() {
      if (zustand.takt === null) return;
      sicher(function () {
        if (typeof w.clearInterval === 'function') w.clearInterval(zustand.takt);
        return null;
      }, null);
      zustand.takt = null;
    }

    function pruefen() {
      if (erlaubt()) {
        starten();
        taktEnde();
        return;
      }
      if (einwilligung() !== 'unknown') taktEnde();
    }

    function taktStart() {
      if (zustand.takt !== null) return;
      if (!K.pruefTaktMs) return;
      if (einwilligung() !== 'unknown') return;
      if (typeof w.setInterval !== 'function') return;
      zustand.takt = w.setInterval(pruefen, K.pruefTaktMs);
    }

    // --- Aufbau in fester Reihenfolge ------------------------------------------------------
    consentVorgabe();

    if (d && typeof d.addEventListener === 'function') {
      d.addEventListener('click', beiKlick, true);
      /* Die Einwilligungsoberflaeche feuert dieses Ereignis bei jeder Entscheidung, mit
         `detail.stand` als Wert. Ohne diesen Draht liefe der Pixel nach einer frischen
         Zustimmung erst beim naechsten Seitenaufruf an, und genau der erste Aufruf ist
         der, fuer den die Kampagne den Klick bezahlt hat. Der Wert im Ereignis wird
         absichtlich nicht gelesen: `amEinwilligung()` bleibt die Wahrheit, das Ereignis
         ist nur der Ausloeser. */
      d.addEventListener(K.einwilligungEreignis, pruefen);
    }

    /* Ohne Einwilligung liest das hier nur die Adresszeile und legt nichts ab. */
    sicher(w.amGclid, '');

    w.amMesskette = {
      aufgebaut: true,
      pruefen: pruefen,
      erlaubt: erlaubt,
      nummerTauschen: nummerTauschen,
      werte: K,
      zustand: zustand
    };

    pruefen();
    taktStart();

    return w.amMesskette;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { aufbau: aufbau, VORGABEN: VORGABEN };
  }
  if (typeof window !== 'undefined' && window && window.document) aufbau(window);
})();
