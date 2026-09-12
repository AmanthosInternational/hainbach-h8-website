'use strict';

/**
 * H8: der Renditerechner an der Wohnungskarte (Plan h8-kartenrechner, Arbeitspaket 1).
 *
 * Er rechnet nichts selbst. Die Zahlen kommen aus AMR.modell.berechne(), derselben Quelle wie
 * auf der Rechnerseite. Stuende hier eine zweite Rechnung, zeigten beide eines Tages
 * verschiedene Ergebnisse, und niemand wuesste, welches gilt.
 *
 * Drei Entscheidungen erklaeren den Rest:
 *
 * 1. Der Ausloeser bleibt ein gewoehnlicher Verweis auf die Rechnerseite. Abgefangen wird der
 *    Klick nur, wenn der Browser showModal kennt. Damit ist der Rueckfallweg zugleich der Weg
 *    ohne JavaScript und der Weg, wenn eine Richtlinie dieses Modul blockiert. Ein blockiertes
 *    Skript war auf dieser Seite schon einmal lautlos.
 * 2. Die drei Rechnermodule kommen erst beim ersten Klick, nacheinander, und nur einmal.
 * 3. Schlaegt das Laden fehl, faehrt der Browser auf die Adresse des Ausloesers. Ein offener,
 *    leerer Dialog sieht aus wie ein Angebot und ist keines.
 *
 * Kein neuer globaler Name (K2 in js/am-kontrakt.js). Klassisches Skript, keine Abhaengigkeit.
 */

(function (global) {
  var REGLER = ['eigenkapital', 'zinsProzent', 'mieteMonat'];
  // Die Ausgabeslots tragen die Feldnamen des Modells, nicht erfundene. So laesst sich im
  // Markup nachlesen, welche Zahl gemeint ist, und es gibt keine zweite Vokabel zu pflegen.
  var AUSGABEN = {
    nettovermoegenEnde: [0, ' EUR'],
    irrProzent: [2, ' %'],
    cashflowNachSteuerMonatJahr1: [0, ' EUR/Monat'],
    abschreibungJahr1: [0, ' EUR'],
    afaSteuerwirkungSumme: [0, ' EUR']
  };
  var FORMATE = {};
  var laden = null;
  var gefeuert = false;

  function zahl(wert, stellen) {
    if (typeof wert !== 'number' || !isFinite(wert)) return '';
    if (Math.abs(wert) < Math.pow(10, -stellen) / 2) wert = 0;
    if (!FORMATE[stellen]) {
      FORMATE[stellen] = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: stellen, maximumFractionDigits: stellen
      });
    }
    return FORMATE[stellen].format(wert);
  }

  // Ein Modul nach dem anderen, nie parallel: 01-modell.js erwartet den Mandanten, und ein
  // gleichzeitiger Start haette sie in unbestimmter Reihenfolge ausgefuehrt.
  function eines(dok, pfad) {
    return new Promise(function (fertig, fehler) {
      var skript = dok.createElement('script');
      skript.src = pfad;
      skript.onload = function () { fertig(); };
      skript.onerror = function () { fehler(new Error(pfad)); };
      dok.head.appendChild(skript);
    });
  }

  function modulkette(dok, dialog) {
    if (laden) return laden;
    var pfade = String(dialog.getAttribute('data-amr-module') || '').split(/\s+/);
    laden = pfade.filter(Boolean).reduce(function (kette, pfad) {
      return kette.then(function () { return eines(dok, pfad); });
    }, Promise.resolve());
    return laden;
  }

  function amr() {
    return global.AMR && global.AMR.modell ? global.AMR.modell : null;
  }

  // Die Wertanzeige eines Reglers. Ausgaben des Modells laufen ueber data-amk-ausgabe.
  function setzen(dialog, name, text) {
    var ziel = dialog.querySelector('[data-amk-wert="' + name + '"]');
    if (ziel) ziel.textContent = text;
  }

  // berechne() rechnet die Abschreibung, gibt sie aber nicht als eigene Zahl heraus. Abgeleitet
  // wird sie deshalb hier und nicht im Modell: eine neue Ausgabe dort veraenderte die goldene
  // Datei des Rechners, und die bleibt byteidentisch. Die Zeile zu 7b haengt am selben Ergebnis.
  function steuerzahlen(dialog, ergebnis, eingaben) {
    var afa = function (j) { return j.afaRegulaer + j.sonderAfa + j.afaStellplatz; };
    var jahre = ergebnis.jahre || [];
    ergebnis.abschreibungJahr1 = jahre.length ? afa(jahre[0]) : 0;
    ergebnis.afaSteuerwirkungSumme = jahre.reduce(function (s, j) { return s + afa(j); }, 0)
      * (eingaben.steuersatzProzent || 0) / 100;
    var zeile = dialog.querySelector('[data-amk-sonder]');
    if (zeile) zeile.setAttribute('data-amk-sonder', ergebnis.sonderAfaAktiv ? 'ja' : 'nein');
  }

  function rechnen(dialog, eingaben) {
    var modell = amr();
    if (!modell) return;
    var ergebnis = modell.berechne(eingaben);
    steuerzahlen(dialog, ergebnis, eingaben);
    Object.keys(AUSGABEN).forEach(function (name) {
      var ziel = dialog.querySelector('[data-amk-ausgabe="' + name + '"]');
      if (ziel) ziel.textContent = zahl(ergebnis[name], AUSGABEN[name][0]) + AUSGABEN[name][1];
    });
  }

  // Die Beschriftung eines Reglers zeigt seinen Wert. Die Spanne steht in den Konstanten des
  // Mandanten, nicht im Markup: zwei Stellen mit derselben Zahl laufen irgendwann auseinander.
  function spanne(name) {
    var konstanten = global.AMR && global.AMR.konstanten ? global.AMR.konstanten : null;
    var felder = konstanten && konstanten.EINGABEN ? konstanten.EINGABEN : [];
    return felder.filter(function (f) { return f.schluessel === name; })[0] || null;
  }

  function beschriften(dialog, name, wert) {
    var feste = spanne(name);
    var stellen = feste && feste.schritt < 1 ? 1 : 0;
    setzen(dialog, name, zahl(Number(wert), stellen) + (feste ? ' ' + feste.einheit : ''));
  }

  // Spanne, Wert, Beschriftung und Reaktion an einer Stelle: drei Schleifen ueber dieselben
  // Regler waeren drei Gelegenheiten, eine davon zu vergessen.
  function reglerAufbauen(dialog, eingaben, nr) {
    REGLER.forEach(function (name) {
      var regler = dialog.querySelector('[data-amk-regler="' + name + '"]');
      if (!regler) return;
      var feste = spanne(name);
      if (feste) {
        regler.min = String(feste.min);
        regler.max = String(feste.max);
        regler.step = String(feste.schritt);
      }
      regler.value = String(eingaben[name]);
      beschriften(dialog, name, eingaben[name]);
      regler.oninput = function () {
        eingaben[name] = Number(regler.value);
        beschriften(dialog, name, regler.value);
        rechnen(dialog, eingaben);
        melden(nr);
      };
    });
  }

  function melden(nr) {
    if (gefeuert) return;
    gefeuert = true;
    var e = global.AMR && global.AMR.ereignisse ? global.AMR.ereignisse : null;
    if (e && typeof e.feuere === 'function') e.feuere('karte', { wohnung: String(nr) });
  }

  function fuellen(dialog, nr) {
    var modell = amr();
    if (!modell) return false;
    var eingaben = modell.vorgaben(nr);
    var titel = dialog.querySelector('[data-amk-wohnung]');
    if (titel) titel.textContent = String(nr);
    var weiter = dialog.querySelector('[data-amk-rolle="alle"]');
    if (weiter) weiter.setAttribute('href', '/rechner/?wohnung=' + encodeURIComponent(nr));
    reglerAufbauen(dialog, eingaben, nr);
    rechnen(dialog, eingaben);
    return true;
  }

  function schliessen(dialog, quelle) {
    if (dialog.open) dialog.close();
    if (quelle && typeof quelle.focus === 'function') quelle.focus();
    if (global.history && typeof global.history.back === 'function') global.history.back();
  }

  function oeffnen(dok, dialog, ausloeser, nr) {
    return modulkette(dok, dialog).then(function () {
      if (!fuellen(dialog, nr)) throw new Error('modell');
      dialog.showModal();
      if (global.history && typeof global.history.pushState === 'function') {
        global.history.pushState({ amkWohnung: nr }, '', '#wohnung-' + nr);
      }
      dialog.onclose = function () {
        if (ausloeser && typeof ausloeser.focus === 'function') ausloeser.focus();
      };
      var zu = dialog.querySelector('[data-amk-rolle="schliessen"]');
      if (zu) zu.onclick = function () { schliessen(dialog, ausloeser); };
    });
  }

  function starten(fenster) {
    var dok = fenster.document;
    dok.addEventListener('click', function (ereignis) {
      var ausloeser = ereignis.target && ereignis.target.closest
        ? ereignis.target.closest('[data-amr-karte]') : null;
      if (!ausloeser) return;
      var dialog = dok.querySelector('[data-amk-dialog]');
      // Ohne showModal bleibt der Verweis ein Verweis. Nicht abfangen ist hier die Antwort,
      // nicht ein halb offener Dialog.
      if (!dialog || typeof dialog.showModal !== 'function') return;
      ereignis.preventDefault();
      var nr = ausloeser.getAttribute('data-amr-karte');
      oeffnen(dok, dialog, ausloeser, nr)['catch'](function () {
        var ziel = ausloeser.getAttribute('href');
        if (ziel) fenster.location.href = ziel;
      });
    });
  }

  if (global && global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { starten(global); });
    } else {
      starten(global);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { zahl: zahl, starten: starten, REGLER: REGLER };
  }
})(typeof window !== 'undefined' ? window : globalThis);
