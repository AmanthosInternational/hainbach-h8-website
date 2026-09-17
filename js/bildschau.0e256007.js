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
 * **Blaettern in der Schau.** Ein Klick auf ein Bild einer Wohnungskarte oeffnet die Schau mit
 * allen zoombaren Bildern derselben Karte, in der Reihenfolge der Leiste (Raumbilder, dann
 * Grundriss; ein Feld ohne Bild, etwa die Tafel, faellt heraus). Die Knoepfe „Vorheriges Bild"
 * und „Naechstes Bild", die Pfeiltasten links und rechts und ein waagrechtes Wischen ueber
 * 40 px wechseln das Bild; nach dem letzten kommt wieder das erste. Ein Zaehler „2 / 3" sagt,
 * wo man steht. Hat die Karte nur ein zoombares Bild, gibt es weder Pfeile noch Zaehler.
 * Mit jedem Wechsel wechseln Alternativtext, `aria-label` und Pflichthinweis mit: ein
 * vergroessertes Rendering ohne seinen Hinweis darf nie stehen bleiben. Geladen wird nur das
 * gezeigte Bild, die Nachbarn nicht vorab. Der Knopf „Grundriss" ausserhalb der Leiste startet
 * beim Grundriss seiner Karte und blaettert ebenso. Nach dem Schliessen steht die Leiste der
 * Karte auf dem zuletzt gezeigten Feld, ohne dass die Seite springt.
 *
 * Escape, der Rueckgabefokus und das Sperren des Hintergrunds kommen vom `<dialog>` des
 * Browsers; Tab kreist zusaetzlich innerhalb der Schau. Fehlt `showModal` (sehr alte Oberflaeche), passiert nichts: der Knopf bleibt
 * wirkungslos und das Bild steht weiter in der Karte, wo es lesbar ist.
 */
(function () {
  'use strict';

  var WISCH_SCHWELLE = 40;

  function einhaengen(d) {
    var schau = d.querySelector('[data-amw-schaufenster]');
    if (!schau || typeof schau.showModal !== 'function') return 0;

    var bild = schau.querySelector('[data-amw-schau-bild]');
    var hinweis = schau.querySelector('[data-amw-schau-hinweis]');
    var zu = schau.querySelector('[data-amw-schau-zu]');
    if (!bild) return 0;

    // Der Wert aus dem Markup, bevor eine Schau ihn ueberschreibt.
    var ausgangsLabel = schau.getAttribute('aria-label') || '';

    // Die Buehne um das Bild traegt die Pfeile, damit sie mittig am Bild stehen und nie
    // ueber dem Hinweis darunter. Pfeile und Zaehler entstehen hier, nicht im Markup: ohne
    // Skript gibt es keine Schau und also auch nichts zu blaettern.
    var buehne = d.createElement('div');
    buehne.className = 'amw-schau__buehne';
    bild.parentNode.insertBefore(buehne, bild);
    buehne.appendChild(bild);

    function pfeil(klasse, label, zeichen) {
      var k = d.createElement('button');
      k.type = 'button';
      k.className = 'amw-schau__pfeil ' + klasse;
      k.setAttribute('aria-label', label);
      k.textContent = zeichen;
      k.hidden = true;
      buehne.appendChild(k);
      return k;
    }
    var zurueck = pfeil('amw-schau__pfeil--zurueck', 'Vorheriges Bild', '‹');
    var vor = pfeil('amw-schau__pfeil--vor', 'Nächstes Bild', '›');

    var zaehler = d.createElement('p');
    zaehler.className = 'amw-schau__zaehler';
    zaehler.setAttribute('aria-live', 'polite');
    zaehler.hidden = true;
    schau.insertBefore(zaehler, schau.firstChild);

    // Die Folge der geoeffneten Schau und die Stelle darin.
    var folge = [];
    var stelle = 0;

    function zeigen() {
      var e = folge[stelle];
      // Erst die Fassungen, dann die Quelle, beides im selben Durchlauf: der Browser waehlt
      // danach genau eine Datei. Die Nachbarn werden nicht angefasst und also nicht geladen.
      if (e.fassungen) bild.setAttribute('srcset', e.fassungen);
      else bild.removeAttribute('srcset');
      bild.src = e.quelle;
      bild.alt = e.alt || '';
      if (hinweis) hinweis.textContent = e.satz || '';
      schau.setAttribute('aria-label', e.alt || ausgangsLabel);
      var mehrere = folge.length > 1;
      zurueck.hidden = !mehrere;
      vor.hidden = !mehrere;
      zaehler.hidden = !mehrere;
      zaehler.textContent = mehrere ? (stelle + 1) + ' / ' + folge.length : '';
    }

    function blaettern(schritt) {
      if (folge.length < 2 || !schau.open) return;
      stelle = (stelle + schritt + folge.length) % folge.length;
      zeigen();
    }

    function eintragAusBild(img) {
      // Der Pflichthinweis steht im Markup neben dem Bild und gehoert mit in die Schau:
      // ein vergroessertes Rendering ohne den Hinweis waere ein Foto.
      var feld = img.closest ? img.closest('.amw-feld') : null;
      var hinweisknoten = feld ? feld.querySelector('.amw-hinweis') : null;
      return {
        quelle: img.getAttribute('src') || '',
        fassungen: img.getAttribute('srcset'),
        alt: img.getAttribute('alt'),
        satz: hinweisknoten ? hinweisknoten.textContent : '',
        feld: feld
      };
    }

    function eintragAusMerkmalen(knopf) {
      return {
        quelle: knopf.getAttribute('data-amw-schau-quelle'),
        fassungen: knopf.getAttribute('data-amw-schau-fassungen'),
        alt: knopf.getAttribute('data-amw-schau-text'),
        satz: knopf.getAttribute('data-amw-schau-satz'),
        feld: null
      };
    }

    // Alle zoombaren Bilder einer Karte in der Reihenfolge der Leiste.
    function folgeDerKarte(karte) {
      var liste = [];
      if (!karte) return liste;
      var felder = karte.querySelectorAll('.amw-feld');
      for (var i = 0; i < felder.length; i++) {
        var img = felder[i].querySelector('[data-amw-schau] img');
        if (img && img.getAttribute('src')) liste.push(eintragAusBild(img));
      }
      return liste;
    }

    function oeffnen(neueFolge, start) {
      folge = neueFolge;
      stelle = start;
      zeigen();
      schau.showModal();
    }

    function ausloesen(knopf) {
      var karte = knopf.closest ? knopf.closest('article') : null;
      var liste = folgeDerKarte(karte);
      var img = knopf.querySelector('img');
      var j;
      if (img) {
        for (j = 0; j < liste.length; j++) {
          if (liste[j].feld && liste[j].feld.contains(img)) return oeffnen(liste, j);
        }
        return oeffnen([eintragAusBild(img)], 0);
      }
      var eintrag = eintragAusMerkmalen(knopf);
      if (!eintrag.quelle) return;
      // Ein Textknopf wie „Grundriss": in der Folge seiner Karte beim selben Bild starten.
      for (j = 0; j < liste.length; j++) {
        if (liste[j].quelle === eintrag.quelle) return oeffnen(liste, j);
      }
      oeffnen([eintrag], 0);
    }

    var knoepfe = d.querySelectorAll('[data-amw-schau]');
    for (var i = 0; i < knoepfe.length; i++) {
      (function (knopf) {
        knopf.addEventListener('click', function () { ausloesen(knopf); });
      })(knoepfe[i]);
    }

    zurueck.addEventListener('click', function () { blaettern(-1); });
    vor.addEventListener('click', function () { blaettern(1); });

    schau.addEventListener('keydown', function (e) {
      var taste = e.key;
      if (taste === 'ArrowLeft' || taste === 'Left') { blaettern(-1); e.preventDefault(); }
      else if (taste === 'ArrowRight' || taste === 'Right') { blaettern(1); e.preventDefault(); }
      else if (taste === 'Tab') fokusKreisen(e);
    });

    // Der modale Dialog sperrt die Seite, laesst Tab aber in die Leiste des Browsers
    // weiterlaufen. Hier kreist der Fokus zwischen Schliessen und den sichtbaren Pfeilen.
    function fokusKreisen(e) {
      var ziele = [];
      var kandidaten = [zu, zurueck, vor];
      var k;
      for (k = 0; k < kandidaten.length; k++) {
        if (kandidaten[k] && !kandidaten[k].hidden) ziele.push(kandidaten[k]);
      }
      if (!ziele.length) return;
      var aktiv = d.activeElement;
      var stelleImKreis = -1;
      for (k = 0; k < ziele.length; k++) if (ziele[k] === aktiv) stelleImKreis = k;
      if (e.shiftKey && stelleImKreis <= 0) {
        ziele[ziele.length - 1].focus();
        e.preventDefault();
      } else if (!e.shiftKey && (stelleImKreis === -1 || stelleImKreis === ziele.length - 1)) {
        ziele[0].focus();
        e.preventDefault();
      }
    }

    // Wischen: nur eine ueberwiegend waagrechte Bewegung ueber der Schwelle zaehlt, damit
    // ein senkrechtes Ziehen (etwa zum Lesen eines langen Hinweises) nicht blaettert.
    var wischX = null;
    var wischY = null;
    schau.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 1) { wischX = null; return; }
      wischX = e.touches[0].clientX;
      wischY = e.touches[0].clientY;
    }, { passive: true });
    schau.addEventListener('touchend', function (e) {
      if (wischX === null || !e.changedTouches || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - wischX;
      var dy = e.changedTouches[0].clientY - wischY;
      wischX = null;
      if (Math.abs(dx) > WISCH_SCHWELLE && Math.abs(dx) > Math.abs(dy)) blaettern(dx < 0 ? 1 : -1);
    }, { passive: true });

    if (zu) zu.addEventListener('click', function () { schau.close(); });
    // Ein Klick neben das Bild schliesst, ein Klick auf das Bild nicht.
    schau.addEventListener('click', function (e) {
      if (e && e.target === schau) schau.close();
    });

    // Die Leiste auf ein Feld stellen, waagrecht und nur in der Leiste: kein scrollIntoView,
    // das wuerde auch die Seite verschieben.
    function leisteStellen(feld) {
      var leiste = feld && feld.parentNode;
      if (!leiste || !leiste.getBoundingClientRect) return;
      var ziel = feld.getBoundingClientRect().left - leiste.getBoundingClientRect().left + leiste.scrollLeft;
      leiste.scrollLeft = Math.round(ziel);
    }

    // Nach dem Schliessen die Adresse wieder freigeben: ein geschlossener Dialog soll kein
    // Bild im Speicher halten, und beim naechsten Oeffnen wird ohnehin neu gesetzt. Die
    // Beschriftung faellt auf den Ausgangswert aus dem Markup zurueck. Die Leiste der Karte
    // steht danach auf dem zuletzt gezeigten Feld.
    schau.addEventListener('close', function () {
      var letztes = folge[stelle];
      bild.removeAttribute('srcset');
      bild.src = '';
      schau.setAttribute('aria-label', ausgangsLabel);
      if (letztes && letztes.feld) {
        // Lag der Rueckgabefokus auf einem Bildknopf derselben Leiste, wandert er mit auf das
        // gezeigte Feld; ohne preventScroll zoege er die Leiste wieder zurueck.
        var aktiv = d.activeElement;
        var knopf = letztes.feld.querySelector('[data-amw-schau]');
        if (aktiv && knopf && aktiv !== knopf && aktiv.closest && aktiv.closest('.amw-leiste') === letztes.feld.parentNode) {
          try { knopf.focus({ preventScroll: true }); } catch (err) { knopf.focus(); }
        }
        leisteStellen(letztes.feld);
      }
      folge = [];
      stelle = 0;
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
