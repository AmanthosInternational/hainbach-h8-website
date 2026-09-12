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

    function oeffnen(quelle) {
      bild.src = quelle.getAttribute('src') || '';
      var fassungen = quelle.getAttribute('srcset');
      if (fassungen) bild.setAttribute('srcset', fassungen);
      else bild.removeAttribute('srcset');
      bild.alt = quelle.getAttribute('alt') || '';
      if (hinweis) {
        // Der Pflichthinweis steht im Markup neben dem Bild und gehoert mit in die Schau:
        // ein vergroessertes Rendering ohne den Hinweis waere ein Foto.
        var feld = quelle.closest ? quelle.closest('.amw-feld') : null;
        var text = feld ? feld.querySelector('.amw-hinweis') : null;
        hinweis.textContent = text ? text.textContent : '';
      }
      schau.showModal();
    }

    var knoepfe = d.querySelectorAll('[data-amw-schau]');
    for (var i = 0; i < knoepfe.length; i++) {
      (function (knopf) {
        knopf.addEventListener('click', function () {
          var quelle = knopf.querySelector('img');
          if (quelle) oeffnen(quelle);
        });
      })(knoepfe[i]);
    }

    if (zu) zu.addEventListener('click', function () { schau.close(); });
    // Ein Klick neben das Bild schliesst, ein Klick auf das Bild nicht.
    schau.addEventListener('click', function (e) {
      if (e && e.target === schau) schau.close();
    });
    // Nach dem Schliessen die Adresse wieder freigeben: ein geschlossener Dialog soll kein
    // Bild im Speicher halten, und beim naechsten Oeffnen wird ohnehin neu gesetzt.
    schau.addEventListener('close', function () {
      bild.removeAttribute('srcset');
      bild.src = '';
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
