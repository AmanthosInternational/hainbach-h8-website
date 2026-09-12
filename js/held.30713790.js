/**
 * Die Bildbuehne im Held (Plan h8-verkauf-2, Abschnitt 7).
 *
 * REINE ZUGABE, und das ist keine Absichtserklaerung, sondern im Markup verankert: die
 * erste Ebene steht dort mit `src` und `fetchpriority="high"` wie seit jeher. Faellt diese
 * Datei aus, bleibt der Held genau der Held von heute. Erst dieses Skript legt die
 * weiteren Ebenen an, und erst wenn die Seite steht: Motive, die schon beim Laden
 * angefordert werden, machen das eine Motiv langsamer, das der Besucher wirklich sieht.
 *
 * WAS ES ANFASST: das Bild mit `data-amb-bild` und dessen Elternknoten. Nichts sonst. Die
 * Liste der Motive steht in diesem Attribut, eine Zeile je Motiv, Felder durch Leerzeichen
 * getrennt: grosses Bild, kleines Bild, Beschreibung. Die beiden Pfade tragen nie ein
 * Leerzeichen, also sind sie eindeutig und der Rest der Zeile ist der Text.
 *
 * DREI RUECKSICHTEN, jede eine Zeile weniger Bewegung:
 *   * Bei genau einem Motiv laeuft kein Zeitgeber, und es entsteht kein Knopf. Die Buehne
 *     ist dann der Held von heute, ohne jede Zutat.
 *   * `prefers-reduced-motion: reduce` schaltet alles ab, nicht nur langsamer. Der Knopf
 *     entsteht dann gar nicht erst, und held.css verbirgt ihn zusaetzlich, falls die
 *     Einstellung nach dem Laden umgelegt wird.
 *   * Der Knopf haelt an und laesst wieder laufen. Sein Zustand steht in `aria-pressed`,
 *     nicht in einer Klasse.
 *
 * Es gehoert seite/statisch/held.css dazu: ohne dieses Blatt kennt niemand die Deckkraft
 * der Ebenen. Beide werden zusammen verdrahtet, nie einzeln.
 *
 * Kein globaler Name, kein Netzzugriff ausser den Bildern selbst, kein Speicher, kein
 * Inline-Skript: die Richtlinie der Seite setzt `script-src 'self'`.
 */
(function (global) {
  'use strict';

  // Sechs Sekunden Standzeit, 900 ms Uebergang (der steht in held.css). Lang genug, dass
  // ein Motiv wirkt, kurz genug, dass die Buehne im Blickfeld einmal herumkommt.
  var STANDZEIT_MS = 6000;
  var ANHALTEN = 'Bildwechsel anhalten';
  var FORTSETZEN = 'Bildwechsel fortsetzen';
  // Zeichenkuerzel, damit die Quelle reines ASCII bleibt: zwei Balken, ein Dreieck. Die
  // Bedeutung traegt aria-label, nicht das Zeichen; FE0E haelt das Dreieck vom Bildzeichen ab.
  var ZEICHEN_HALT = '\u275A\u275A';
  var ZEICHEN_LAUF = '\u25B6\uFE0E';
  var BREITE_IM_NAMEN = /-(\d+)\.webp$/;

  /** Zerlegt die Liste aus `data-amb-bild`. Unvollstaendige Zeilen fallen still heraus. */
  function motive(text) {
    var zeilen = String(text || '').split('\n');
    var liste = [];
    for (var i = 0; i < zeilen.length; i += 1) {
      var felder = zeilen[i].trim().split(' ');
      if (felder.length < 3 || !felder[0] || !felder[1]) continue;
      liste.push({ bild: felder[0], klein: felder[1], alt: felder.slice(2).join(' ') });
    }
    return liste;
  }

  /**
   * Baut das srcset aus den Breiten in den Dateinamen, nach derselben Regel wie das
   * Bauwerkzeug: die Breite steht im Namen, das ist die ganze Regel. Fehlt eine Breite
   * oder sind beide Fassungen dieselbe Datei, gibt es kein srcset statt eines falschen.
   */
  function srcsatz(motiv) {
    var gross = BREITE_IM_NAMEN.exec(motiv.bild);
    var klein = BREITE_IM_NAMEN.exec(motiv.klein);
    if (!gross || !klein || motiv.bild === motiv.klein) return '';
    return motiv.klein + ' ' + klein[1] + 'w, ' + motiv.bild + ' ' + gross[1] + 'w';
  }

  /**
   * Eine weitere Ebene. Sie traegt dieselbe Klasse wie die erste, weil stil.css dort die
   * Geometrie fuehrt (absolut, deckend, object-fit cover); ihr Zustand haengt allein am
   * Merkmal `data-amb-ebene`.
   */
  function ebene(dok, motiv) {
    var bild = dok.createElement('img');
    bild.setAttribute('class', 'h8-hero__bild');
    bild.setAttribute('alt', motiv.alt);
    bild.setAttribute('decoding', 'async');
    var satz = srcsatz(motiv);
    if (satz) {
      bild.setAttribute('srcset', satz);
      // Die Buehne fuellt die ganze Fensterbreite; ohne sizes naehme der Browser dasselbe
      // an und holte trotzdem immer die groesste Fassung.
      bild.setAttribute('sizes', '100vw');
    }
    bild.setAttribute('src', motiv.bild);
    bild.setAttribute('data-amb-ebene', 'aus');
    return bild;
  }

  /** Der Knopf. 48 px kommen aus held.css, die Bedeutung aus aria-label. */
  function knopf(dok) {
    var schalter = dok.createElement('button');
    schalter.setAttribute('type', 'button');
    schalter.setAttribute('data-amb-pause', '');
    schalter.setAttribute('aria-pressed', 'false');
    schalter.setAttribute('aria-label', ANHALTEN);
    schalter.setAttribute('title', ANHALTEN);
    schalter.textContent = ZEICHEN_HALT;
    return schalter;
  }

  /** Hat der Besucher Bewegung abbestellt? Ohne matchMedia gilt: nicht abbestellt. */
  function ruhig(fenster) {
    if (typeof fenster.matchMedia !== 'function') return false;
    var frage = fenster.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(frage && frage.matches);
  }

  /**
   * Erst wenn die Seite geladen ist, dann einen Bildrahmen spaeter. Zwei Bildrahmen allein
   * reichen nicht: am 12.09.2026 im Browser gemessen, starteten die drei weiteren
   * Anforderungen dann bei 23 ms, waehrend der erste Anstrich bei 108 ms lag. Sie liefen
   * dem ersten Motiv also in den Weg, genau das, was hier nicht passieren soll.
   */
  function nachDemLaden(fenster, tun) {
    var dok = fenster.document;
    function gleich() {
      if (typeof fenster.requestAnimationFrame === 'function') fenster.requestAnimationFrame(tun);
      else if (typeof fenster.setTimeout === 'function') fenster.setTimeout(tun, 0);
    }
    if (!dok || dok.readyState === 'complete') gleich();
    else if (typeof fenster.addEventListener === 'function') fenster.addEventListener('load', gleich);
    else gleich();
  }

  /** Legt Ebenen und Knopf an und laesst den Zeitgeber laufen. */
  function aufbauen(fenster, dok, buehne, erste, weitere) {
    var ebenen = [erste];
    for (var i = 0; i < weitere.length; i += 1) {
      ebenen.push(buehne.appendChild(ebene(dok, weitere[i])));
    }
    // Erst jetzt, und in einem Zug: vorher traegt die erste Ebene kein Merkmal, und damit
    // gilt keine Regel aus held.css fuer sie. So kann zwischen Laden und Aufbau nichts
    // aufblitzen.
    erste.setAttribute('data-amb-ebene', 'an');

    var stand = 0;
    var uhr = null;
    function zeige(nr) {
      ebenen[stand].setAttribute('data-amb-ebene', 'aus');
      stand = nr;
      ebenen[stand].setAttribute('data-amb-ebene', 'an');
    }
    function weiter() { zeige((stand + 1) % ebenen.length); }
    function laufen() {
      if (uhr === null) uhr = fenster.setInterval(weiter, STANDZEIT_MS);
    }
    function halten() {
      if (uhr !== null) { fenster.clearInterval(uhr); uhr = null; }
    }

    var schalter = knopf(dok);
    schalter.addEventListener('click', function () {
      var laeuft = uhr !== null;
      if (laeuft) halten(); else laufen();
      schalter.setAttribute('aria-pressed', laeuft ? 'true' : 'false');
      schalter.setAttribute('aria-label', laeuft ? FORTSETZEN : ANHALTEN);
      schalter.setAttribute('title', laeuft ? FORTSETZEN : ANHALTEN);
      schalter.textContent = laeuft ? ZEICHEN_LAUF : ZEICHEN_HALT;
    });
    buehne.appendChild(schalter);
    laufen();
    return { ebenen: ebenen, schalter: schalter, weiter: weiter };
  }

  /**
   * Sucht die erste Ebene, liest die Motive und uebergibt an `aufbauen`. Gibt zurueck, ob
   * eine Buehne entsteht; das braucht der Test, und der Browser wirft es weg.
   */
  function starten(fenster) {
    var dok = fenster && fenster.document;
    if (!dok || typeof dok.querySelector !== 'function') return false;
    var erste = dok.querySelector('[data-amb-bild]');
    if (!erste || !erste.parentNode) return false;
    var quelle = erste.getAttribute('src') || '';
    var alle = motive(erste.getAttribute('data-amb-bild'));
    var weitere = [];
    for (var i = 0; i < alle.length; i += 1) {
      // Das Motiv, das schon steht, wird nicht ein zweites Mal geladen.
      if (alle[i].bild !== quelle) weitere.push(alle[i]);
    }
    if (!weitere.length || ruhig(fenster)) return false;
    nachDemLaden(fenster, function () {
      aufbauen(fenster, dok, erste.parentNode, erste, weitere);
    });
    return true;
  }

  if (global && global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { starten(global); });
    } else {
      starten(global);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { starten: starten, motive: motive, srcsatz: srcsatz, STANDZEIT_MS: STANDZEIT_MS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
