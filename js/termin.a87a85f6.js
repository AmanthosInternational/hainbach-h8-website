/**
 * Terminbuchung als Ueberblendung statt als zweiter Tab.
 *
 * Zwoelf Wohnungskarten tragen je einen Knopf TERMIN VEREINBAREN. Bisher war das ein
 * gewoehnlicher Verweis mit `target="_blank"`: der Besucher verlaesst die Seite, bucht
 * woanders und kommt meist nicht zurueck. Cal.com kann denselben Kalender als Ueberblendung
 * auf der Seite zeigen, so wie es die Schwesterseite seit dem 07.09.2026 tut.
 *
 * **Warum das Skript erst beim Klick geladen wird.** `embed.js` liegt bei Cal.com, und schon
 * sein Abruf uebertraegt die IP des Besuchers dorthin. Beim Seitenaufbau zu laden hiesse:
 * jeder Besucher wird gemeldet, auch die grosse Mehrheit, die nie einen Termin will. Wer
 * klickt, hat sich dagegen entschieden. Der Preis ist eine kurze Wartezeit beim allerersten
 * Klick; jeder weitere laeuft sofort, weil Cal.com die Knoepfe dann selbst bedient.
 *
 * **Der Knopf bleibt ein Verweis.** Ohne JavaScript, mit Skriptblocker oder bei einem Fehler
 * im Netz greift das `href` mit `target="_blank"` wie bisher. Gebucht wird dann in einem
 * neuen Tab, und nur die Ueberblendung faellt aus, nicht die Buchung.
 *
 * Der Lader selbst ist die Warteschlange aus dem Ausgabecode von Cal.com, gleichlautend mit
 * `rechner/termin.js`. Bewusst ohne kaufmaennisches Und geschrieben.
 */
(function () {
  'use strict';

  var SKRIPT = 'https://app.cal.com/embed/embed.js';
  var URSPRUNG = 'https://cal.com';
  var WARTE_MS = 60; // Cal.com haengt seinen Klickfaenger erst nach dem Laden ein.

  var zustand = 'kalt'; // kalt, laedt, bereit, gescheitert

  /**
   * Legt `window.Cal` an und puffert jeden Aufruf, bis das Skript da ist. Nachgebaut aus dem
   * Ausgabecode der Oberflaeche; `fertig` wird gerufen, sobald `embed.js` geladen ist oder
   * endgueltig gescheitert.
   */
  function lader(w, fertig) {
    var d = w.document;
    function puffer(ziel, argumente) { ziel.q.push(argumente); }
    if (w.Cal) { fertig(true); return; }
    w.Cal = function () {
      var cal = w.Cal;
      var argumente = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        var skript = d.createElement('script');
        skript.src = SKRIPT;
        skript.onload = function () { fertig(true); };
        skript.onerror = function () { fertig(false); };
        d.head.appendChild(skript);
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

  /** Cal.com hat eine Buchung bestaetigt. Erst hier, nicht beim Oeffnen des Kalenders. */
  function gebucht(w) {
    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: 'termin_gebucht' });
    } catch (fehler) {
      // bewusst still: die Buchung steht bereits, die Meldung ist die Zugabe
    }
  }

  /**
   * Laedt und richtet ein. `fertig(true)` heisst: Cal.com bedient die Knoepfe ab jetzt selbst.
   *
   * Die Reihenfolge ist der Kern und war am 12.09.2026 zuerst falsch herum: `lader` legt nur
   * `window.Cal` an, **eingehaengt wird das Skript erst beim ersten Aufruf davon**. Steht der
   * Aufruf im Rueckruf, der auf das Laden wartet, wartet er ewig. Also erst rufen, dann warten.
   */
  function starten(w, fertig) {
    var gemeldet = false;
    function einmal(bereit) {
      if (gemeldet) return;
      gemeldet = true;
      zustand = bereit ? 'bereit' : 'gescheitert';
      fertig(bereit);
    }
    lader(w, einmal);
    try {
      w.Cal('init', { origin: URSPRUNG });
      // Ohne das steht in jeder Buchung als Quelle nur "cal.com"; utm_source und
      // Konsorten der Seiten-Adresse wandern sonst nicht mit.
      w.Cal.config = w.Cal.config || {};
      w.Cal.config.forwardQueryParams = true;
      w.Cal('ui', { hideEventTypeDetails: false, layout: 'month_view' });
      w.Cal('on', { action: 'bookingSuccessful', callback: function () { gebucht(w); } });
    } catch (fehler) {
      einmal(false);
    }
  }

  function einhaengen(d, w) {
    var knoepfe = d.querySelectorAll('[data-cal-link]');
    for (var i = 0; i < knoepfe.length; i++) {
      knoepfe[i].addEventListener('click', function (e) {
        // Nur nach einem Fehlschlag darf der Browser dem Verweis folgen. Solange Cal.com
        // laedt oder bereits uebernommen hat, wird er angehalten: sonst oeffnet sich die
        // Ueberblendung UND ein zweiter Tab. Am 12.09.2026 genau so im Browser gesehen.
        if (zustand === 'gescheitert') return;
        if (!e || typeof e.preventDefault !== 'function') return;
        e.preventDefault();
        // Cal.com hoert selbst am Dokument mit; unser Anhalten stoppt nur den Verweis,
        // nicht das Weiterreichen des Ereignisses.
        if (zustand === 'bereit' || zustand === 'laedt') return;
        zustand = 'laedt';
        var knopf = e.currentTarget;
        starten(w, function (bereit) {
          if (!bereit) { w.open(knopf.href, '_blank', 'noopener'); return; }
          // Der Klickfaenger von Cal.com haengt erst nach dem Laden; ein zweiter,
          // gestellter Klick geht dann durch ihn und oeffnet die Ueberblendung.
          w.setTimeout(function () { knopf.click(); }, WARTE_MS);
        });
      });
    }
    return knoepfe.length;
  }

  if (typeof window !== 'undefined' && window.document) {
    einhaengen(window.document, window);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { einhaengen: einhaengen, lader: lader };
  }
})();
