/* Kapitalanlage-Rechner, Annahmesaetze ("Womit rechnen?").
   Drei Knoepfe ueber den Reglern, die eine Handvoll Annahmen auf einmal setzen. Vierzehn
   Regler ohne Anhaltspunkt sind fuer die meisten Besucher kein Werkzeug, sondern eine Huerde.

   DER BAUSTEIN FASST DEN ZUSTAND VON ui.js NICHT AN. Er setzt die Regler und meldet ein
   input-Ereignis, genau wie eine Hand es taete; ui.js hoert darauf ohnehin. Damit gibt es
   keinen zweiten Weg in den Zustand, der mit dem ersten auseinanderlaufen koennte, und ui.js
   bleibt unveraendert: sie ist bei 400 Zeilen gedeckelt und stand bereits genau dort. Ein
   Deckel ist kein Hindernis, sondern der Hinweis, dass etwas woanders hingehoert.

   Ladefolge: NACH ui.js. Beim Start hat ui.js seine Regler dann schon gebaut, und der
   input-Horcher steht. Kennt der Mandant keine SZENARIEN (W5), entsteht nichts.

   Reine Helfer haengen unter AMR.szenarien, damit szenarien.test.js sie ohne DOM prueft. */
(function (AMR) {
  'use strict';

  var K = AMR.konstanten;

  // --- Reine Helfer: kein DOM, kein Netz, keine Nebenwirkung. ----------------

  /** Deutsches Zahlformat. Eigene Fassung, weil ui.js sie nicht ausgibt. */
  function zahl(wert, stellen) {
    var feste = Number(wert).toFixed(stellen);
    var teile = feste.split('.');
    var ganz = teile[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return teile[1] ? ganz + ',' + teile[1] : ganz;
  }

  /** Nachkommastellen einer Zahl, hoechstens zwei: 0.5 ergibt 1, 4 ergibt 0. */
  function stellenVon(wert) {
    var text = String(wert);
    var punkt = text.indexOf('.');
    return punkt < 0 ? 0 : Math.min(2, text.length - punkt - 1);
  }

  function feldVon(schluessel) {
    var felder = (K && K.EINGABEN) || [];
    for (var i = 0; i < felder.length; i++) {
      if (felder[i].schluessel === schluessel) return felder[i];
    }
    return null;
  }

  function satzVon(schluessel) {
    var saetze = (K && K.SZENARIEN) || [];
    for (var i = 0; i < saetze.length; i++) {
      if (saetze[i].schluessel === schluessel) return saetze[i];
    }
    return null;
  }

  /**
   * Beschriftung eines Satzes aus Feldern und Werten, nie aus einem zweiten Text im
   * Datensatz: sonst stuende dieselbe Zahl zweimal da und die beiden liefen auseinander,
   * sobald jemand nur eine von ihnen anfasst.
   */
  function hinweis(satz) {
    var teile = [];
    if (!satz || !satz.werte) return '';
    Object.keys(satz.werte).forEach(function (schluessel) {
      var feld = feldVon(schluessel);
      if (!feld) return;
      var wert = satz.werte[schluessel];
      var stellen = Math.min(2, Math.max(stellenVon(feld.schritt), stellenVon(wert)));
      teile.push(feld.label + ' ' + zahl(wert, stellen) + (feld.einheit ? ' ' + feld.einheit : ''));
    });
    return teile.join(' · ');
  }

  /**
   * Passt ein Satz zu den gerade eingestellten Werten? Nur wenn JEDER seiner Werte steht.
   * Zieht jemand einen einzigen Regler weg, erlischt die Markierung; ein Knopf, der aktiv
   * aussieht, ohne es zu sein, ist schlimmer als gar keine Markierung.
   */
  function passt(satz, gelesen) {
    if (!satz || !satz.werte) return false;
    var felder = Object.keys(satz.werte);
    for (var i = 0; i < felder.length; i++) {
      var ist = gelesen[felder[i]];
      if (ist === undefined || ist === null) return false;
      if (Math.abs(Number(ist) - Number(satz.werte[felder[i]])) > 1e-9) return false;
    }
    return felder.length > 0;
  }

  function knopfMarkup(satz) {
    return '<button type="button" class="amr-szenario" data-amr-szenario="' + satz.schluessel +
      '" aria-pressed="false"><span class="amr-szenario__name">' + satz.name + '</span>' +
      '<span class="amr-szenario__hinweis">' + hinweis(satz) + '</span></button>';
  }

  function blockMarkup() {
    var saetze = (K && K.SZENARIEN) || [];
    if (!saetze.length) return '';
    var texte = (K && K.TEXTE) || {};
    return (texte.szenarienTitel ? '<h3 class="amr-titel">' + texte.szenarienTitel + '</h3>' : '') +
      '<div class="amr-szenarien__reihe">' + saetze.map(knopfMarkup).join('') + '</div>' +
      (texte.szenarienHinweis ? '<p class="amr-szenarien__fuss">' + texte.szenarienHinweis + '</p>' : '');
  }

  // --- DOM -------------------------------------------------------------------

  function start(wurzel) {
    var ziel = wurzel || (typeof document !== 'undefined' ? document.getElementById('amr') : null);
    if (!ziel || !ziel.querySelector) return null;
    var saetze = (K && K.SZENARIEN) || [];
    if (!saetze.length) return null;
    var behaelter = ziel.querySelector('[data-amr-szenarien]');
    if (!behaelter) return null;

    behaelter.hidden = false;
    behaelter.innerHTML = blockMarkup();

    function reglerVon(schluessel) {
      return ziel.querySelector('[data-amr-feld="' + schluessel + '"]');
    }

    /** Die eingestellten Werte, aus den Reglern gelesen, nicht aus einem eigenen Zustand. */
    function gelesen() {
      var stand = {};
      saetze.forEach(function (satz) {
        Object.keys(satz.werte).forEach(function (schluessel) {
          var regler = reglerVon(schluessel);
          if (regler) stand[schluessel] = parseFloat(regler.value);
        });
      });
      return stand;
    }

    function markiere() {
      var stand = gelesen();
      var knoepfe = behaelter.querySelectorAll('[data-amr-szenario]');
      for (var i = 0; i < knoepfe.length; i++) {
        var aktiv = passt(satzVon(knoepfe[i].getAttribute('data-amr-szenario')), stand);
        knoepfe[i].className = 'amr-szenario' + (aktiv ? ' amr-szenario--aktiv' : '');
        knoepfe[i].setAttribute('aria-pressed', aktiv ? 'true' : 'false');
      }
    }

    function setze(schluessel) {
      var satz = satzVon(schluessel);
      if (!satz) return;
      Object.keys(satz.werte).forEach(function (feld) {
        var regler = reglerVon(feld);
        if (!regler || regler.disabled) return;
        regler.value = String(satz.werte[feld]);
        // Dasselbe Ereignis, das eine Hand ausloest. ui.js rechnet daraufhin von selbst.
        if (typeof Event === 'function') regler.dispatchEvent(new Event('input', { bubbles: true }));
        else if (typeof regler.dispatchEvent === 'function') regler.dispatchEvent({ type: 'input', bubbles: true });
      });
      markiere();
    }

    behaelter.addEventListener('click', function (fall) {
      var knoten = fall.target && fall.target.closest
        ? fall.target.closest('[data-amr-szenario]') : null;
      if (!knoten) return;
      fall.preventDefault();
      setze(knoten.getAttribute('data-amr-szenario'));
    });
    // Jede andere Eingabe kann einen Satz verlassen; die Markierung folgt ihr.
    ziel.addEventListener('input', markiere);
    ziel.addEventListener('change', markiere);

    markiere();
    return { markiere: markiere, setze: setze, behaelter: behaelter };
  }

  AMR.szenarien = {
    start: start,
    hinweis: hinweis,
    passt: passt,
    satzVon: satzVon,
    knopfMarkup: knopfMarkup,
    blockMarkup: blockMarkup,
    zahl: zahl
  };
  // Startet sich selbst wie ui.js; in Node fehlt document, dort passiert nichts.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); });
    else start();
  }
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.szenarien;