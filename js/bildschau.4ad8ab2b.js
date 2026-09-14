/**
 * Bilder der Wohnungen gross ansehen.
 *
 * In der Karte ist ein Foto 360 px breit, auf dem Telefon 92 Prozent der Breite. Wer wissen
 * will, wie die Kueche wirklich aussieht, hat dort zu wenig. Ein Klick oeffnet dasselbe Bild
 * als Ueberblendung ueber die ganze Seite, mit `sizes="100vw"`, damit der Browser die
 * groesste vorhandene Fassung holt statt die kleine hochzuskalieren.
 *
 * **Es wird nichts nachgeladen, was nicht schon da ist.** Die Schau uebernimmt `src`,
 * `srcset` und `alt` des angeklickten Bildes; ausgeliefert wird, was ohnehin im Markup steht.
 *
 * Ein Ausloeser bringt sein Bild auf einem von zwei Wegen mit. Steckt in ihm ein `<img>`,
 * gilt dieser Weg wie bisher und hat Vorrang. Steckt keins darin, liest die Schau die vier
 * Merkmale `data-amw-schau-quelle`, `-fassungen`, `-text` und `-satz`: so kann ein reiner
 * Textknopf (etwa „Grundriss") ohne eigenes Bild trotzdem ein Bild gross zeigen. Fehlt die
 * Quelle, tut ein Klick nichts, und die Schau bleibt geschlossen.
 *
 * Waehrend die Schau offen ist, traegt der Dialog als `aria-label` den Alternativtext des
 * gezeigten Bildes, damit ein Vorleseprogramm ansagt, was zu sehen ist. Beim Schliessen
 * faellt die Beschriftung auf den Wert aus dem Markup zurueck.
 *
 * Escape, der Rueckgabefokus und das Sperren des Hintergrunds kommen vom `<dialog>` des
 * Browsers. Fehlt `showModal` (sehr alte Oberflaeche), passiert nichts: der Knopf bleibt
 * wirkungslos und das Bild steht weiter in der Karte, wo es lesbar ist.
 */
(function () {
  'use strict';

  function einhaengen(d) {
    var schau = d.querySelector('[data-amw-schaufenster]');
    if (!schau || typeof schau.showModal !== 'function') return 0;

    var bild = schau.querySelector('[data-amw-schau-bild]');
    var hinweis = schau.querySelector('[data-amw-schau-hinweis]');
    var zu = schau.querySelector('[data-amw-schau-zu]');
    if (!bild) return 0;

    // Der Wert aus dem Markup, bevor eine Schau ihn ueberschreibt.
    var ausgangsLabel = schau.getAttribute('aria-label') || '';

    function oeffnen(quelle, fassungen, alt, satz) {
      bild.src = quelle;
      if (fassungen) bild.setAttribute('srcset', fassungen);
      else bild.removeAttribute('srcset');
      bild.alt = alt || '';
      if (hinweis) hinweis.textContent = satz || '';
      schau.setAttribute('aria-label', alt || ausgangsLabel);
      schau.showModal();
    }

    function ausBild(bildQuelle) {
      // Der Pflichthinweis steht im Markup neben dem Bild und gehoert mit in die Schau:
      // ein vergroessertes Rendering ohne den Hinweis waere ein Foto.
      var feld = bildQuelle.closest ? bildQuelle.closest('.amw-feld') : null;
      var hinweisknoten = feld ? feld.querySelector('.amw-hinweis') : null;
      oeffnen(
        bildQuelle.getAttribute('src') || '',
        bildQuelle.getAttribute('srcset'),
        bildQuelle.getAttribute('alt'),
        hinweisknoten ? hinweisknoten.textContent : ''
      );
    }

    function ausMerkmalen(knopf) {
      var quelle = knopf.getAttribute('data-amw-schau-quelle');
      if (!quelle) return;
      oeffnen(
        quelle,
        knopf.getAttribute('data-amw-schau-fassungen'),
        knopf.getAttribute('data-amw-schau-text'),
        knopf.getAttribute('data-amw-schau-satz')
      );
    }

    var knoepfe = d.querySelectorAll('[data-amw-schau]');
    for (var i = 0; i < knoepfe.length; i++) {
      (function (knopf) {
        knopf.addEventListener('click', function () {
          var bildQuelle = knopf.querySelector('img');
          if (bildQuelle) ausBild(bildQuelle);
          else ausMerkmalen(knopf);
        });
      })(knoepfe[i]);
    }

    if (zu) zu.addEventListener('click', function () { schau.close(); });
    // Ein Klick neben das Bild schliesst, ein Klick auf das Bild nicht.
    schau.addEventListener('click', function (e) {
      if (e && e.target === schau) schau.close();
    });
    // Nach dem Schliessen die Adresse wieder freigeben: ein geschlossener Dialog soll kein
    // Bild im Speicher halten, und beim naechsten Oeffnen wird ohnehin neu gesetzt. Die
    // Beschriftung faellt auf den Ausgangswert aus dem Markup zurueck.
    schau.addEventListener('close', function () {
      bild.removeAttribute('srcset');
      bild.src = '';
      schau.setAttribute('aria-label', ausgangsLabel);
    });

    return knoepfe.length;
  }

  if (typeof window !== 'undefined' && window.document) {
    einhaengen(window.document);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { einhaengen: einhaengen };
  }
})();
