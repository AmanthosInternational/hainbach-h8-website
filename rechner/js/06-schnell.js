/* Kapitalanlage-Rechner, Schnellrechner (Plan h8-funnel Arbeitspaket 2, Kontrakte K4 und K10).
   Einstiegsrechner ueber dem Detailrechner: Wohnung waehlen, zu versteuerndes Einkommen
   schieben, und ablesen, was die Abschreibung in zehn Jahren an Einkommensteuer spart.
   Gerechnet wird ausschliesslich in AMR.modell.schnell, hier steht nur Anzeige und Zustand.
   Reine Helfer haengen unter AMR.schnell, damit schnell.test.js sie ohne DOM pruefen kann.

   Zwei Eigenheiten der Ladefolge aus K5, beide bewusst so gebaut:
   1. schnell.js wird VOR ui.js geladen. Beim Start gibt es die Wohnungskarten des
      Detailrechners deshalb noch nicht. Der Startwert der Wohnungswahl kommt darum aus
      K.EINGABEN, nie aus dem DOM, und die Karten werden erst im Ereignis gesucht.
   2. AMR.ui existiert beim Laden noch nicht. Der Wortlaut des Paragraf-7b-Satzes wird
      deshalb beim Zeichnen geholt, nicht beim Laden.
   Ist K.SCHNELL null (W5), gibt start null zurueck und der Abschnitt bleibt verborgen. */
(function (AMR) {
  'use strict';

  var K = AMR.konstanten;

  // --- Reine Helfer: kein DOM, kein Netz, keine Nebenwirkung. ----------------
  var FORMATE = {};
  // Deutsches Zahlformat, dieselbe Regel wie ui.zahl; schnell.test.js prueft beide gegeneinander.
  function zahl(wert, stellen) {
    if (typeof wert !== 'number' || !isFinite(wert)) return '';
    if (Math.abs(wert) < Math.pow(10, -stellen) / 2) wert = 0; // verhindert "-0"
    if (!FORMATE[stellen]) FORMATE[stellen] = new Intl.NumberFormat('de-DE',
      { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
    return FORMATE[stellen].format(wert);
  }
  function eur(wert) { return zahl(wert, 0) + ' EUR'; }
  function feldWohnung() {
    return K.EINGABEN.filter(function (feld) { return feld.schluessel === 'wohnung'; })[0];
  }
  // Der Abschnitt zeigt sich nur, wo der Mandant einen Schnellrechner traegt (W5: SCHNELL null).
  function sichtbar(konstanten) {
    var quelle = konstanten || K;
    return !!(quelle && quelle.SCHNELL && quelle.SCHNELL.zvE && quelle.SCHNELL.texte);
  }
  // Ein Eintrag der Wohnungswahl: Nummer, Titel, Preis. Die Liste ist dieselbe wie die der
  // Karten (K.EINGABEN), damit Wahl und Karten nicht auseinanderlaufen koennen.
  function optionText(option) {
    var wohnung = AMR.modell.wohnungVon(option);
    if (!wohnung) return 'Eigene Zahlen im Detailrechner';
    return 'Nr. ' + wohnung.nr + ', ' + (wohnung.titel || wohnung.lage) + ', ' + eur(wohnung.kaufpreis);
  }
  function optionenMarkup(gewaehlt) {
    return feldWohnung().optionen.map(function (option) {
      return '<option value="' + option + '"' +
        (String(option) === String(gewaehlt) ? ' selected' : '') + '>' + optionText(option) + '</option>';
    }).join('');
  }
  // Zehn Saeulen: Hoehe in Prozent des groessten Jahresvorteils, darin der Anteil der
  // Sonder-AfA in Prozent der Saeule. Ohne Sonder-AfA bleibt die Saeule einfarbig.
  function balken(jahre) {
    var hoechster = 0;
    jahre.forEach(function (zeile) { if (zeile.vorteil > hoechster) hoechster = zeile.vorteil; });
    return jahre.map(function (zeile) {
      return {
        jahr: zeile.jahr,
        hoehe: hoechster > 0 ? 100 * zeile.vorteil / hoechster : 0,
        anteilSonder: zeile.vorteil > 0 ? 100 * zeile.vorteilSonder / zeile.vorteil : 0,
        text: zahl(zeile.vorteil, 0),
        label: 'Jahr ' + zeile.jahr + ': ' + eur(zeile.vorteil) + ' weniger Einkommensteuer' +
          (zeile.vorteilSonder >= 0.5 ? ', davon ' + eur(zeile.vorteilSonder) + ' aus der Sonder-AfA' : '')
      };
    });
  }
  function balkenMarkup(saeule) {
    return '<div class="amr-schnell__saeule">' +
      '<div class="amr-schnell__saeulewert">' + saeule.text + '</div>' +
      '<div class="amr-schnell__spur"><div class="amr-schnell__balken" role="img" aria-label="' +
      saeule.label + '" style="height:' + saeule.hoehe.toFixed(1) + '%">' +
      (saeule.anteilSonder > 0 ? '<div class="amr-schnell__teil" style="height:' +
        saeule.anteilSonder.toFixed(1) + '%"></div>' : '') +
      '</div></div><div class="amr-schnell__saeulejahr">' + saeule.jahr + 'J</div></div>';
  }
  // Wortlaut aus ui.sonderAfaText (K10). Der Schnellrechner rechnet immer mit sonderAfa auto,
  // dort ist berechtigt gleich aktiv (modell.js Zeile 155), der dritte Fall des Satzes kann
  // hier also nicht auftreten. Fehlt ui.js noch, bleibt die Zeile leer statt falsch.
  function pruefText(ergebnis) {
    if (!AMR.ui || typeof AMR.ui.sonderAfaText !== 'function') return '';
    return AMR.ui.sonderAfaText({ kostenJeM2: ergebnis.kostenJeM2,
      sonderAfaBerechtigt: ergebnis.sonderAfaAktiv, sonderAfaAktiv: ergebnis.sonderAfaAktiv });
  }
  // Wortlaut aus K.SCHNELL.texte.grenz (K10, nachgetragen in der Verdrahtung): der Mandant
  // liefert die Vorlage mit den Platzhaltern {zvE} und {satz}, hier werden nur die Zahlen
  // eingesetzt. Fehlt die Vorlage, bleibt die Zeile leer statt falsch, wie bei pruefText.
  function grenzText(ergebnis, konstanten) {
    var quelle = konstanten || K;
    var vorlage = quelle && quelle.SCHNELL && quelle.SCHNELL.texte && quelle.SCHNELL.texte.grenz;
    if (typeof vorlage !== 'string' || !vorlage) return '';
    return vorlage.replace('{zvE}', eur(ergebnis.zvE))
      .replace('{satz}', zahl(ergebnis.grenzsteuersatzProzent, 2));
  }
  // Kanal zu AMR.ereignisse: feuert hoechstens einmal je Seitenaufruf, prueft das Modul per
  // typeof und wirft nie. Gleiche Bauart wie ui.ereignisKanal, hier fuer genau ein Ereignis.
  function ereignisEinmal(quelle) {
    var gefeuert = false;
    return {
      feuere: function (name, daten) {
        if (gefeuert) return false;
        var ziel = typeof quelle === 'function' ? quelle() : quelle;
        if (!ziel || typeof ziel.feuere !== 'function') return false;
        gefeuert = true;
        try { ziel.feuere(name, daten); } catch (fehler) { return false; }
        return true;
      }
    };
  }
  function wohnungWert(roh) { return String(roh) === 'frei' ? 'frei' : Number(roh); }
  function zvEWert(roh) {
    var spanne = K.SCHNELL.zvE;
    var wert = parseFloat(roh);
    if (!isFinite(wert)) return spanne.vorgabe;
    return Math.min(spanne.max, Math.max(spanne.min, wert));
  }
  // Geruest des Abschnitts. Alle Texte stammen aus K.SCHNELL.texte, nie aus einer Nutzereingabe.
  function huelleMarkup(gewaehlt) {
    var t = K.SCHNELL.texte;
    var r = K.SCHNELL.zvE;
    return '<h3 class="amr-schnell__titel">' + t.titel + '</h3><div class="amr-schnell__raster">' +
      '<div class="amr-schnell__wahl">' +
      '<label class="amr-schnell__feld"><span class="amr-schnell__label">Wohnung</span>' +
      '<select class="amr-schnell__select" data-amr-schnell-feld="wohnung">' +
      optionenMarkup(gewaehlt === undefined ? feldWohnung().vorgabe : gewaehlt) + '</select></label>' +
      '<label class="amr-schnell__feld"><span class="amr-schnell__kopf">' +
      '<span class="amr-schnell__label">' + t.einkommen + '</span>' +
      '<span class="amr-schnell__reglerwert" data-amr-schnell-zve></span></span>' +
      '<input type="range" data-amr-schnell-feld="zvE" min="' + r.min + '" max="' + r.max +
      '" step="' + r.schritt + '" value="' + r.vorgabe + '" aria-label="' + t.einkommen + ' in EUR">' +
      '<span class="amr-schnell__spanne"><span>' + eur(r.min) + '</span><span>' + eur(r.max) +
      '</span></span></label></div><div class="amr-schnell__anzeige">' +
      '<p class="amr-schnell__summe"><span class="amr-schnell__zahl" data-amr-schnell-summe></span>' +
      '<span class="amr-schnell__einheit">' + t.ergebnis + '</span></p>' +
      '<p class="amr-schnell__chips">' + chipMarkup('degressiv', t.degressiv) +
      chipMarkup('sonder', t.sonder) + '</p>' +
      '<div class="amr-schnell__diagramm" data-amr-schnell-balken role="group" aria-label="' +
      t.ergebnis + ', je Jahr"></div>' +
      '<p class="amr-schnell__satz" data-amr-schnell-grenz></p>' +
      '<p class="amr-schnell__satz" data-amr-schnell-pruefung></p>' +
      '<p class="amr-schnell__fuss">' + t.hinweis + '</p>' +
      '<button type="button" class="amr-knopf amr-schnell__weiter" data-amr-schnell-weiter>' +
      t.weiter + '</button></div></div>';
  }
  function chipMarkup(art, text) {
    return '<span class="amr-schnell__chip amr-schnell__chip--' + art + '">' + text +
      '<b class="amr-schnell__chipwert" data-amr-schnell-' + art + '></b></span>';
  }
  // --- DOM. Jede Abfrage ist geprueft: fehlt ein Knoten, faellt nur dieser Teil aus. -------
  function start(wurzel) {
    if (!sichtbar(K)) return null;
    var ziel = wurzel || (typeof document !== 'undefined' ? document.getElementById('amr') : null);
    if (!ziel || !ziel.ownerDocument || typeof ziel.querySelector !== 'function') return null;
    var kasten = ziel.querySelector('[data-amr-schnell]');
    if (!kasten) return null;
    // Ein Tiefenlink `?wohnung=N` schlaegt die Vorgabe. Ohne das stand hier stur die
    // Vorgabewohnung, waehrend der Detailrechner darunter dem Link folgte (11.09.2026).
    var fenster = ziel.ownerDocument.defaultView;
    var vorwahl = AMR.modell.wohnungAusSuche(fenster && fenster.location ? fenster.location.search : null);
    var wohnung = vorwahl === null ? feldWohnung().vorgabe : vorwahl;
    var zvE = K.SCHNELL.zvE.vorgabe;
    var ergebnis = null;
    var ereignis = ereignisEinmal(function () { return AMR.ereignisse; });
    function schreibe(auswahl, text) {
      var knoten = kasten.querySelector(auswahl);
      if (knoten) knoten.textContent = text;
    }
    function zeichne() {
      ergebnis = AMR.modell.schnell(wohnung, zvE);
      schreibe('[data-amr-schnell-summe]', eur(ergebnis.summe));
      schreibe('[data-amr-schnell-degressiv]', eur(ergebnis.summeDegressiv));
      schreibe('[data-amr-schnell-sonder]', eur(ergebnis.summeSonder));
      schreibe('[data-amr-schnell-zve]', eur(zvE));
      schreibe('[data-amr-schnell-grenz]', grenzText(ergebnis));
      schreibe('[data-amr-schnell-pruefung]', pruefText(ergebnis));
      var flaeche = kasten.querySelector('[data-amr-schnell-balken]');
      if (flaeche) flaeche.innerHTML = balken(ergebnis.jahre).map(balkenMarkup).join('');
    }
    // Ergebnis nach einer Nutzereingabe: erst rechnen, dann einmal je Seitenaufruf melden.
    function nutzerAendert() {
      zeichne();
      ereignis.feuere('schnell', { wohnung: String(wohnung) });
    }
    // Erst hier, nie beim Start: ui.js baut die Karten spaeter. Der Klick setzt den Zustand
    // des Detailrechners, ui.js hoert ihn am selben Wurzelknoten.
    function karteWaehlen(wert) {
      var karte = ziel.querySelector('input[data-amr-feld="wohnung"][value="' + wert + '"]');
      if (karte && !karte.checked && typeof karte.click === 'function') karte.click();
    }
    // Gegenrichtung: eine Karte im Detailrechner zieht die Wahl im Schnellrechner nach.
    function uebernimm(roh) {
      var auswahl = kasten.querySelector('[data-amr-schnell-feld="wohnung"]');
      if (!auswahl || String(auswahl.value) === String(roh)) return;
      auswahl.value = String(roh);
      wohnung = wohnungWert(roh);
      nutzerAendert();
    }
    function reagiere(fall) {
      var knoten = fall.target;
      if (!knoten || typeof knoten.getAttribute !== 'function') return;
      var feld = knoten.getAttribute('data-amr-schnell-feld');
      if (feld === 'wohnung') {
        wohnung = wohnungWert(knoten.value);
        karteWaehlen(knoten.value);
        return nutzerAendert();
      }
      if (feld === 'zvE') {
        zvE = zvEWert(knoten.value);
        return nutzerAendert();
      }
      if (knoten.getAttribute('data-amr-feld') === 'wohnung' && knoten.value) uebernimm(knoten.value);
    }
    kasten.innerHTML = huelleMarkup(wohnung);
    kasten.hidden = false;
    ziel.addEventListener('input', reagiere);
    ziel.addEventListener('change', reagiere);
    ziel.addEventListener('click', function (fall) {
      var knopf = fall.target && typeof fall.target.closest === 'function'
        ? fall.target.closest('[data-amr-schnell-weiter]') : null;
      if (!knopf) return;
      if (typeof fall.preventDefault === 'function') fall.preventDefault();
      var eingaben = ziel.querySelector('[data-amr-eingaben]');
      if (!eingaben || typeof eingaben.scrollIntoView !== 'function') return;
      eingaben.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Der erste Regler ist bei gewaehlter Wohnung gesperrt (ui.js) und nimmt keinen Fokus
      // an; ohne diese Auswahl bliebe die Tastatur am Knopf stehen. Am 09.09. so gemessen.
      var frei = (eingaben.querySelectorAll ? [].slice.call(eingaben.querySelectorAll('input')) : [])
        .filter(function (knoten) { return !knoten.disabled; })[0];
      if (frei && typeof frei.focus === 'function') frei.focus({ preventScroll: true });
    });
    zeichne();
    // Nur im Sonderfall "Block nachtraeglich eingesetzt": dann laeuft start vor ui.js, und der
    // Paragraf-7b-Satz haette keinen Wortlaut. Ein zweiter Durchgang holt ihn nach.
    if (!AMR.ui && typeof setTimeout === 'function') setTimeout(zeichne, 0);
    return { eingaben: function () { return { wohnung: wohnung, zvE: zvE }; },
      ergebnis: function () { return ergebnis; } };
  }
  AMR.schnell = {
    start: start, zahl: zahl, eur: eur, sichtbar: sichtbar, optionText: optionText,
    optionenMarkup: optionenMarkup, balken: balken, balkenMarkup: balkenMarkup,
    grenzText: grenzText, pruefText: pruefText, ereignisEinmal: ereignisEinmal,
    huelleMarkup: huelleMarkup, wohnungWert: wohnungWert, zvEWert: zvEWert
  };
  // Startet sich selbst wie ui.js; in Node fehlt document, dort passiert nichts.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); });
    else start();
  }
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.schnell;