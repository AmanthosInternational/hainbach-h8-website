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

  function anwerfen() {
    var wurzel = dok.documentElement;
    if (!wurzel) return;

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
