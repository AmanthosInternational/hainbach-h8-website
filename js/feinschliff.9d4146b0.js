/**
 * Feinschliff: blendet Abschnitte ein, sobald sie in Sicht kommen.
 *
 * Reine Zugabe. Die Seite ist ohne diese Datei vollstaendig lesbar, und das ist keine
 * Absichtserklaerung, sondern im Stil verankert: verborgen wird ausschliesslich unter
 * `html.hat-einblendung`, und diese Klasse setzt allein dieses Skript. Faellt es aus,
 * bleibt jeder Abschnitt sichtbar. Der umgekehrte Bau, im Stil verstecken und per
 * Skript zeigen, verschluckt bei jedem Skriptfehler den halben Seiteninhalt; genau so
 * verlieren Seiten ihre Inhalte an eine Animation.
 *
 * Drei Ruecksichten:
 *   * `prefers-reduced-motion: reduce` schaltet alles ab, nicht nur langsamer.
 *   * Ohne IntersectionObserver passiert nichts.
 *   * Was beim Laden schon im Bild steht, wird sofort und ohne Bewegung gezeigt.
 *     Sonst blitzt der obere Seitenteil auf und verschwindet wieder.
 *
 * Kein Inline-Skript: die Richtlinie der Seite setzt `script-src 'self'`.
 */
(function (w) {
  'use strict';

  if (!w || !w.document) return;
  var dok = w.document;

  /**
   * Markiert in der Kopfzeile das Thema, bei dem der Besucher gerade steht.
   *
   * Das ist keine Bewegung, sondern Orientierung, und laeuft deshalb auch dann, wenn jemand
   * Bewegung abbestellt hat. Auf einer Seite mit elf Abschnitten unter einem festen Kopf ist
   * die Frage "wo bin ich" sonst nur durch Scrollen zu beantworten.
   *
   * Der Rand von -45 % oben und unten laesst ein schmales Band in der Mitte des Fensters
   * uebrig. Massgeblich ist, welcher Abschnitt dieses Band schneidet; ohne den Rand waeren
   * beim Scrollen staendig zwei bis drei Abschnitte gleichzeitig "sichtbar".
   */
  function spur() {
    if (typeof w.IntersectionObserver !== 'function') return;
    var ziele = dok.querySelectorAll('.h8-kopf__ziel[href*="#"]');
    var jeId = {};
    var abschnitte = [];
    for (var i = 0; i < ziele.length; i++) {
      var verweis = ziele[i].getAttribute('href') || '';
      var raute = verweis.indexOf('#');
      if (raute < 0) continue;
      var kennung = verweis.slice(raute + 1);
      // Auf der Rechnerseite zeigen dieselben Ziele auf eine ANDERE Seite. Dort gibt es die
      // Abschnitte nicht, und dann wird auch nichts markiert.
      var ziel = kennung ? dok.getElementById(kennung) : null;
      if (!ziel) continue;
      // Die Kennung sitzt auf der Ueberschrift, damit ein Sprung dort landet und nicht im
      // Bild darueber. Fuer die Markierung ist eine Ueberschrift aber zu kurz: sie durchquert
      // das Messband in Sekundenbruchteilen. Beobachtet wird deshalb der ganze Abschnitt.
      var abschnitt = (ziel.closest && ziel.closest('.h8-abschnitt')) || ziel;
      abschnitt.id = abschnitt.id || ('am-abschnitt-' + kennung);
      jeId[kennung] = ziele[i];
      abschnitte.push(abschnitt);
    }
    if (!abschnitte.length) return;

    var imBand = {};
    function zeichne() {
      var jetzt = null;
      for (var j = 0; j < abschnitte.length; j++) {
        if (imBand[abschnitte[j].id]) { jetzt = abschnitte[j].id; break; }
      }
      for (var kennung in jeId) {
        if (!Object.prototype.hasOwnProperty.call(jeId, kennung)) continue;
        var hier = kennung === jetzt;
        jeId[kennung].className = 'h8-kopf__ziel' + (hier ? ' h8-kopf__ziel--hier' : '');
        if (hier) jeId[kennung].setAttribute('aria-current', 'true');
        else jeId[kennung].removeAttribute('aria-current');
      }
    }
    var beobachter = new w.IntersectionObserver(function (eintraege) {
      for (var k = 0; k < eintraege.length; k++) {
        imBand[eintraege[k].target.id] = eintraege[k].isIntersecting;
      }
      zeichne();
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    for (var m = 0; m < abschnitte.length; m++) beobachter.observe(abschnitte[m]);
  }

  function anwerfen() {
    var wurzel = dok.documentElement;
    if (!wurzel) return;

    spur();

    var ruhig = typeof w.matchMedia === 'function' && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (ruhig || typeof w.IntersectionObserver !== 'function') return;

    var teile = dok.querySelectorAll('[data-am-einblenden]');
    if (!teile.length) return;

    wurzel.className += (wurzel.className ? ' ' : '') + 'hat-einblendung';

    var hoehe = w.innerHeight || wurzel.clientHeight || 0;
    var wartend = [];
    for (var i = 0; i < teile.length; i++) {
      var kasten = teile[i].getBoundingClientRect();
      // Was beim Laden schon zu sehen ist, gehoert nicht in eine Einblendung.
      if (kasten.top < hoehe * 0.92) teile[i].className += ' ist-sichtbar';
      else wartend.push(teile[i]);
    }
    if (!wartend.length) return;

    var beobachter = new w.IntersectionObserver(
      function (eintraege) {
        for (var k = 0; k < eintraege.length; k++) {
          if (!eintraege[k].isIntersecting) continue;
          eintraege[k].target.className += ' ist-sichtbar';
          // Einmal gezeigt, nie wieder beobachtet: ein Abschnitt, der beim
          // Zurueckscrollen erneut verschwindet, ist eine Zumutung.
          beobachter.unobserve(eintraege[k].target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    for (var j = 0; j < wartend.length; j++) beobachter.observe(wartend[j]);
  }

  if (dok.readyState === 'loading') dok.addEventListener('DOMContentLoaded', anwerfen);
  else anwerfen();
})(typeof window !== 'undefined' ? window : null);
