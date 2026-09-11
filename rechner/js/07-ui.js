/* Kapitalanlage-Rechner Wohnidyll W5, Oberflaechenlogik (Plan Arbeitspaket 2, K4, K9).
   Rendert Karten und Regler in das Markup aus Arbeitspaket 1, rechnet ueber AMR.modell, fuellt
   die data-amr-ausgabe-Slots. Reine Helfer haengen unter AMR.ui, damit ui.test.js sie ohne
   DOM pruefen kann. Die Module aus Arbeitspaket 3 (ereignisse, lead, pdf) werden per typeof
   geprueft: fehlen sie, bleibt der Rechner bedienbar und zeigt "Vorschau ohne Lead/PDF".
   Kein Cookie, kein Storage, kein direkter Zugriff auf fbq oder gtag. */
(function (AMR) {
  'use strict';

  var K = AMR.konstanten;
  // Folgen Flaeche und Kaufpreis, bis der Nutzer sie bewegt (K4); Boden nur aus Grundstueck.
  var ABGELEITET = ['mieteMonat', 'eigenkapital', 'kostenMonat'].concat(K.BODEN.art === 'grundstueck' ? ['bodenanteilProzent'] : []);
  var ANSICHTEN = ['rechner', 'gate', 'erfolg'];
  var KONTAKT_FELDER = ['vorname', 'nachname', 'email', 'telefon'];
  var MAIL_MUSTER = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i; // wie Snippet 930
  var EUR_SLOTS = ['nettovermoegenEnde', 'vermoegenEnde', 'gewinn', 'nebenkosten', 'darlehen'];
  var EUR_MONAT_SLOTS = ['annuitaetMonat', 'cashflowVorSteuerMonatJahr1',
    'cashflowNachSteuerMonatJahr1', 'zuschussMonatDurchschnitt'];
  var MODULE = ['ereignisse', 'lead', 'pdf'];
  var WAHL_TEXTE = { // Stellplatztexte stehen in K.STELLPLAETZE, siehe wahlText.
    afaMethode: { degressiv: 'degressiv, 5 % vom Restwert', linear: 'linear, 3 %' },
    sonderAfa: { auto: 'automatisch prüfen', aus: 'aus' }
  };
  // --- Reine Helfer: kein DOM, kein Netz, keine Nebenwirkung. -----------------
  var FORMATE = {};
  function zahl(wert, stellen) {
    if (typeof wert !== 'number' || !isFinite(wert)) return '';
    if (Math.abs(wert) < Math.pow(10, -stellen) / 2) wert = 0; // verhindert "-0"
    if (!FORMATE[stellen]) FORMATE[stellen] = new Intl.NumberFormat('de-DE',
      { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
    return FORMATE[stellen].format(wert);
  }
  function stellenVon(wert) { var t = String(wert), p = t.indexOf('.'); return p < 0 ? 0 : t.length - p - 1; }
  function feldVon(schluessel) { return K.EINGABEN.filter(function (feld) { return feld.schluessel === schluessel; })[0] || null; }
  // Tiefenlink ?wohnung=<Nr> (Arbeitspaket 11, M24): liest die Nummer aus einer Suchzeichenkette.
  // Genommen wird nur, was feldVon('wohnung').optionen ohnehin anbietet, und zurueck kommt der
  // Wert aus den Konstanten, nie der Rohwert: die URL erreicht so weder Markup noch Modell.
  // Ohne Parameter, bei Unbekanntem und bei kaputter Kodierung ist die Antwort null.
  // Der Tiefenlink wird in AMR.modell ausgewertet, damit Schnell- und Detailrechner
  // dieselbe Auslegung benutzen und nicht auseinanderlaufen koennen.
  function wohnungAusSuche(suche) { return AMR.modell.wohnungAusSuche(suche); }
  // Satz zum Pruefergebnis der Sonderabschreibung, Wortlaut aus dem Plan.
  function sonderAfaText(ergebnis) {
    var wert = zahl(ergebnis.kostenJeM2, 0) + ' EUR/m²';
    var grenze = zahl(K.STEUER.sonderAfaKostenGrenzeJeM2, 0) + ' EUR/m²';
    if (!ergebnis.sonderAfaBerechtigt) return 'Sonder-AfA § 7b: greift nicht: ' + wert + ' liegen über ' + grenze;
    // Dritter Fall, im Plan nicht ausformuliert: berechtigt, aber abgeschaltet.
    if (!ergebnis.sonderAfaAktiv) return 'Sonder-AfA § 7b: abgeschaltet, sie griffe bei ' +
      wert + ' Gebäudeanteil';
    return 'Sonder-AfA § 7b: greift bei ' + wert + ' Gebäudeanteil';
  }
  // Text eines Ausgabe-Slots (K9). Unbekannte Schluessel liefern eine leere Zeichenkette.
  function ausgabeText(schluessel, ergebnis) {
    if (schluessel === 'sonderAfaStatus') return sonderAfaText(ergebnis);
    var wert = ergebnis[schluessel];
    if (schluessel === 'faktor') return wert === null ? 'n. v.' : zahl(wert, 2);
    if (schluessel === 'irrProzent') return wert === null ? 'n. v.' : zahl(wert, 2) + ' %';
    if (EUR_SLOTS.indexOf(schluessel) >= 0) return zahl(wert, 0) + ' EUR';
    if (EUR_MONAT_SLOTS.indexOf(schluessel) >= 0) return zahl(wert, 0) + ' EUR/Monat';
    return typeof wert === 'number' ? zahl(wert, 0) : '';
  }
  // Die Schwelle statt eines Vergleichs mit null: -0,4 ist keine rote Zahl.
  function istNegativ(schluessel, ergebnis) { var wert = ergebnis[schluessel]; return typeof wert === 'number' && isFinite(wert) && wert < -0.5; }
  function stufe(schluessel, wert, schritt) {
    var feld = feldVon(schluessel);
    return Math.min(feld.max, Math.max(feld.min, Math.round(wert / schritt) * schritt));
  }
  // Die drei abgeleiteten Vorgaben (K4). Quelle ist modell.vorgaben, damit die Kaltmiete der
  // Wohnung folgt, sobald sie eine eigene traegt (h8-funnel K2, WOHNUNGEN[i].mieteJeM2); bei
  // freier Eingabe zaehlen Kaufpreis und Flaeche der Regler, dort gilt MIETE_JE_M2_VORGABE.
  function abgeleitet(eingaben) {
    var nk = K.STEUER.grunderwerbsteuer + K.STEUER.notarGrundbuch + K.STEUER.makler;
    var satz = AMR.modell.wohnungVon(eingaben.wohnung) ? AMR.modell.vorgaben(eingaben.wohnung)
      : { mieteMonat: eingaben.wohnflaeche * K.MIETE_JE_M2_VORGABE,
        eigenkapital: eingaben.kaufpreis * nk + 0.1 * eingaben.kaufpreis,
        kostenMonat: 30 + 0.5 * eingaben.wohnflaeche };
    return {
      mieteMonat: stufe('mieteMonat', satz.mieteMonat, 10),
      eigenkapital: stufe('eigenkapital', satz.eigenkapital, 1000),
      kostenMonat: stufe('kostenMonat', satz.kostenMonat, 5),
      bodenanteilProzent: AMR.modell.bodenanteilProzentVon(eingaben.kaufpreis, eingaben.wohnflaeche)
    };
  }
  // Neuer Eingabesatz nach einer Nutzereingabe. Bei einer Wohnungsnummer kommen Kaufpreis und
  // Flaeche aus K2; die drei abgeleiteten Regler folgen nur, solange sie unberuehrt sind.
  function aenderung(eingaben, schluessel, wert, beruehrt) {
    var satz = Object.assign({}, eingaben);
    satz[schluessel] = wert;
    var wohnung = schluessel === 'wohnung' ? AMR.modell.wohnungVon(wert) : null;
    if (wohnung) { satz.kaufpreis = wohnung.kaufpreis; satz.wohnflaeche = wohnung.wohnflaeche; }
    if (['wohnung', 'kaufpreis', 'wohnflaeche'].indexOf(schluessel) >= 0) {
      var vorgabe = abgeleitet(satz);
      ABGELEITET.forEach(function (feld) {
        if (!beruehrt || beruehrt.indexOf(feld) < 0) satz[feld] = vorgabe[feld];
      });
    }
    return satz;
  }
  // Genau eine der drei Ansichten ist sichtbar; Unbekanntes faellt auf rechner zurueck.
  function sichtbarkeit(aktiv) {
    var gewaehlt = ANSICHTEN.indexOf(aktiv) >= 0 ? aktiv : ANSICHTEN[0], karte = {};
    ANSICHTEN.forEach(function (name) { karte[name] = name === gewaehlt; });
    return karte;
  }
  // Pflichtfelder und E-Mail-Muster wie Snippet 930.
  function pruefeKontakt(werte) {
    var sauber = {}, meldung = '';
    KONTAKT_FELDER.forEach(function (feld) {
      sauber[feld] = String(werte && werte[feld] != null ? werte[feld] : '').trim();
      if (!sauber[feld]) meldung = 'Bitte alle Felder ausfüllen.';
    });
    if (!meldung && !MAIL_MUSTER.test(sauber.email)) meldung = 'Bitte eine gültige E-Mail-Adresse eingeben.';
    return { ok: !meldung, meldung: meldung, werte: sauber };
  }
  // Fehlermeldung mit beiden Festnetznummern aus K2.
  function fehlerText() {
    return 'Das hat leider nicht geklappt. Bitte rufen Sie uns an: ' + K.KONTAKT.map(function (eintrag) { return eintrag.telefon; }).join(' oder ');
  }
  // Waehlbar: ohne die Verkehrsausscheidungsziffer, sonst waehlt das Telefon +49 0 711.
  function waehlbar(telefon) { return String(telefon).replace(/\(0\)/g, '').replace(/[^+0-9]/g, ''); }
  function fehlendeModule(raum) { return MODULE.filter(function (name) { return typeof (raum || AMR)[name] === 'undefined'; }); }
  function vorschauHinweis(fehlend) { return !fehlend || !fehlend.length ? '' : 'Vorschau ohne Lead/PDF: ' + fehlend.join(', ') + ' noch nicht geladen'; }
  // Kanal zu AMR.ereignisse. ansicht und ergebnis feuern hoechstens einmal je Seitenaufruf;
  // fehlt das Modul aus Arbeitspaket 3, passiert nichts und nichts wirft.
  function ereignisKanal(quelle) {
    var einmal = { ansicht: false, ergebnis: false };
    return {
      feuere: function (name, daten) {
        if (einmal[name] === true) return false;
        if (einmal[name] === false) einmal[name] = true;
        var ziel = typeof quelle === 'function' ? quelle() : quelle;
        if (!ziel || typeof ziel.feuere !== 'function') return false;
        try { ziel.feuere(name, daten); } catch (fehler) { return false; }
        return true;
      }
    };
  }
  // Tabellenzeile, Spalten wie K10 und wie der Kopf aus Arbeitspaket 1: Jahr, Miete, Zinsen,
  // Tilgung, AfA gesamt, Steuer, Cashflow n. St., Restschuld.
  function jahresZeile(zeile) {
    return [String(zeile.jahr), zahl(zeile.miete, 0), zahl(zeile.zinsen, 0),
      zahl(zeile.tilgung, 0), zahl(zeile.afaRegulaer + zeile.sonderAfa, 0),
      zahl(zeile.steuer, 0), zahl(zeile.cashflowNachSteuer, 0), zahl(zeile.restschuldEnde, 0)];
  }
  function reglerWert(feld, wert) {
    return zahl(wert, Math.min(2, Math.max(stellenVon(feld.schritt), stellenVon(wert)))) + (feld.einheit ? ' ' + feld.einheit : '');
  }
  function wahlText(schluessel, option) {
    if (schluessel === 'stellplatz') {
      var platz = AMR.modell.stellplatzVon(option);
      return platz.label + (platz.preis > 0 ? ' (' + zahl(platz.preis, 0) + ' EUR)' : '');
    }
    return (WAHL_TEXTE[schluessel] || {})[option] || String(option);
  }
  // Markup der Eingaben, ohne Werte: die setzt eingabenSchreiben, damit es nur einen Weg
  // zum Zustand gibt. Alle Texte stammen aus konstanten.js, nie aus einer Nutzereingabe.
  function karteMarkup(option) {
    var wohnung = AMR.modell.wohnungVon(option);
    var text = wohnung
      ? ['Nr. ' + wohnung.nr, wohnung.lage + ' · ' + wohnung.zimmer + ' Zi · ' +
        zahl(wohnung.wohnflaeche, 2) + ' m²', zahl(wohnung.kaufpreis, 0) + ' EUR']
      : ['frei', 'eigene Zahlen eingeben', 'Kaufpreis frei'];
    return '<label class="amr-karte"><input type="radio" name="amr-wohnung"' +
      ' data-amr-feld="wohnung" value="' + option + '">' +
      '<span class="amr-karte__nr">' + text[0] + '</span>' +
      '<span class="amr-karte__text">' + text[1] + '</span>' +
      '<span class="amr-karte__preis">' + text[2] + '</span></label>';
  }
  function feldMarkup(feld) {
    if (feld.typ === 'wahl') {
      return '<div class="amr-wahl"><span class="amr-regler__label">' + feld.label + '</span>' +
        feld.optionen.map(function (option) {
          return '<label class="amr-wahl__option"><input type="radio" name="amr-' +
            feld.schluessel + '" data-amr-feld="' + feld.schluessel + '" value="' + option +
            '"><span>' + wahlText(feld.schluessel, option) + '</span></label>';
        }).join('') + '</div>';
    }
    return '<label class="amr-regler"><span class="amr-regler__kopf">' +
      '<span class="amr-regler__label">' + feld.label + '</span>' +
      '<span class="amr-regler__wert"></span></span><input type="range" data-amr-feld="' +
      feld.schluessel + '" min="' + feld.min + '" max="' + feld.max + '" step="' + feld.schritt +
      '" aria-label="' + feld.label + (feld.einheit ? ' in ' + feld.einheit : '') + '">' +
      (feld.hinweis ? '<span class="amr-regler__hinweis">' + feld.hinweis + '</span>' : '') +
      '</label>';
  }
  // --- DOM. Jede Abfrage ist geprueft: fehlt ein Element aus K9, faellt nur dieser Teil
  // aus, der Rest arbeitet weiter. --------------------------------------------
  function start(wurzel) {
    var ziel = wurzel || (typeof document !== 'undefined' ? document.getElementById('amr') : null);
    if (!ziel || !ziel.ownerDocument) return null;
    var fenster = ziel.ownerDocument.defaultView;
    var vorwahl = wohnungAusSuche(fenster && fenster.location ? fenster.location.search : null);
    var eingaben = AMR.modell.vorgaben(vorwahl === null ? feldVon('wohnung').vorgabe : vorwahl);
    var ergebnis = AMR.modell.berechne(eingaben);
    var beruehrt = [], ansicht = 'rechner', laeuft = false, geplant = false;
    var ereignis = ereignisKanal(function () { return AMR.ereignisse; });
    function jeder(auswahl, aufgabe) {
      var knoten = ziel.querySelectorAll(auswahl);
      for (var i = 0; i < knoten.length; i++) aufgabe(knoten[i]);
    }
    function melde(text, art) {
      jeder('[data-amr-hinweis]', function (knoten) {
        knoten.textContent = text; knoten.className = 'amr-hinweis' + (art ? ' amr-hinweis--' + art : '');
      });
    }
    function gesperrt() { return AMR.modell.wohnungVon(eingaben.wohnung) !== null; }
    function eingabenBauen() {
      var karten = ziel.querySelector('[data-amr-wohnungen]');
      if (karten) karten.innerHTML = feldVon('wohnung').optionen.map(karteMarkup).join('');
      var behaelter = ziel.querySelector('[data-amr-eingaben]');
      if (!behaelter) return;
      behaelter.innerHTML = K.EINGABEN
        .filter(function (feld) { return feld.schluessel !== 'wohnung'; }).map(feldMarkup).join('');
    }
    // Schreibt in bestehende Knoten: ein Neubau naehme dem gezogenen Regler den Fokus.
    function eingabenSchreiben() {
      var sperre = gesperrt();
      jeder('[data-amr-feld]', function (knoten) {
        var schluessel = knoten.getAttribute('data-amr-feld'), feld = feldVon(schluessel);
        if (!feld) return;
        var wert = String(eingaben[schluessel]);
        if (knoten.type === 'radio') {
          knoten.checked = knoten.value === wert;
          if (schluessel !== 'wohnung' || !knoten.parentNode) return;
          knoten.parentNode.className = 'amr-karte' + (knoten.checked ? ' amr-karte--aktiv' : '');
          return;
        }
        // Gesperrt braucht der Regler jeden Wert: 642.000 EUR liegt nicht auf dem
        // 5.000er-Raster und wuerde sonst still auf 640.000 EUR gerundet.
        if (feld.ausWohnung) { knoten.disabled = sperre; knoten.step = sperre ? 'any' : String(feld.schritt); }
        if (knoten.value !== wert) knoten.value = wert;
        var anzeige = knoten.parentNode && knoten.parentNode.querySelector('.amr-regler__wert');
        if (anzeige) anzeige.textContent = reglerWert(feld, eingaben[schluessel]);
      });
    }
    function ausgabenSchreiben() {
      jeder('[data-amr-ausgabe]', function (knoten) {
        var schluessel = knoten.getAttribute('data-amr-ausgabe');
        knoten.textContent = ausgabeText(schluessel, ergebnis);
        if (knoten.classList) knoten.classList.toggle('amr-kennzahl--negativ', istNegativ(schluessel, ergebnis));
      });
      var koerper = ziel.querySelector('[data-amr-jahre]');
      if (!koerper) return;
      koerper.innerHTML = ergebnis.jahre.map(function (zeile) {
        return '<tr><td>' + jahresZeile(zeile).join('</td><td>') + '</td></tr>';
      }).join('');
    }
    function zeichne() { ergebnis = AMR.modell.berechne(eingaben); eingabenSchreiben(); ausgabenSchreiben(); }
    // Drosselung: waehrend eines gezogenen Reglers wird hoechstens je Bild gerechnet.
    function plane() {
      if (geplant) return;
      geplant = true;
      var lauf = function () { geplant = false; zeichne(); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(lauf); else lauf();
    }
    function nutzerAendert(schluessel, roh) {
      var feld = feldVon(schluessel);
      if (!feld) return;
      var wert = feld.typ === 'zahl' ? parseFloat(roh)
        : (schluessel === 'wohnung' && roh !== 'frei' ? Number(roh) : roh);
      if (typeof wert === 'number' && !isFinite(wert)) return;
      if (ABGELEITET.indexOf(schluessel) >= 0 && beruehrt.indexOf(schluessel) < 0) beruehrt.push(schluessel);
      eingaben = aenderung(eingaben, schluessel, wert, beruehrt);
      ereignis.feuere('ergebnis', { wohnung: String(eingaben.wohnung) });
      plane();
    }
    function ansichtSetzen(name) {
      ansicht = name;
      var karte = sichtbarkeit(name);
      jeder('[data-amr-ansicht]', function (knoten) {
        knoten.hidden = !karte[knoten.getAttribute('data-amr-ansicht')];
      });
    }
    function gateOeffnen() {
      ansichtSetzen('gate');
      melde('', null);
      ereignis.feuere('gate');
      var laden = AMR.pdf && typeof AMR.pdf.laden === 'function' ? AMR.pdf.laden() : null;
      if (laden && laden.then) laden.then(null, function () { return null; });
      // Fokus in das erste Feld, wie Snippet 930, nach dem Sichtbarwerden.
      var erstes = ziel.querySelector('[data-amr-gate-form] input');
      if (erstes) setTimeout(function () { erstes.focus(); }, 60);
    }
    function kontaktSchreiben() {
      var behaelter = ziel.querySelector('[data-amr-kontakt]');
      if (!behaelter) return;
      // Termin UND Telefon: der Anruf ab 60 s zaehlt bereits als Conversion (7750386215).
      var teile = K.TERMIN_URL ? ['<a class="amr-knopf" data-amr-aktion="termin" target="_blank" ' +
        K.TERMIN_ATTRIBUTE + ' rel="noopener" href="' + K.TERMIN_URL + '">Gesprächstermin wählen</a>'] : [];
      behaelter.innerHTML = teile.concat(K.KONTAKT.map(function (eintrag) {
        return '<a class="amr-knopf amr-knopf--zweit" href="tel:' + waehlbar(eintrag.telefon) +
          '">' + eintrag.name + ', ' + eintrag.telefon + '</a>';
      })).join('');
    }
    function pdfSpeichern(stillHalten) {
      var lauf = AMR.pdf && typeof AMR.pdf.speichern === 'function'
        ? AMR.pdf.speichern(eingaben, ergebnis) : null;
      var gescheitert = function () { if (!stillHalten) melde(fehlerText(), 'rot'); };
      if (lauf && typeof lauf.then === 'function') lauf.then(null, gescheitert);
      else if (!lauf) gescheitert();
    }
    function senden() {
      var formular = ziel.querySelector('[data-amr-gate-form]');
      if (laeuft || !formular) return;
      var roh = {};
      KONTAKT_FELDER.forEach(function (name) {
        roh[name] = formular.elements[name] ? formular.elements[name].value : '';
      });
      var pruefung = pruefeKontakt(roh);
      if (!pruefung.ok) return melde(pruefung.meldung, 'rot');
      var antwort = AMR.lead && typeof AMR.lead.senden === 'function'
        ? AMR.lead.senden(pruefung.werte, eingaben, ergebnis, {}) : null;
      if (!antwort || typeof antwort.then !== 'function') return melde(fehlerText(), 'rot');
      laeuft = true;
      melde('Wird gesendet …', null);
      antwort.then(function (lead) {
        laeuft = false;
        if (!lead || !lead.ok) return melde(fehlerText(), 'rot');
        // 'lead' feuert lead.js selbst (K7); ui.js feuert ansicht, ergebnis, gate, termin.
        ansichtSetzen('erfolg');
        kontaktSchreiben();
        pdfSpeichern(true); // Auto-Download nur als Versuch, Fehler bleiben still.
      }, function () { laeuft = false; melde(fehlerText(), 'rot'); });
    }
    // Einziger Eingang fuer Knoepfe und Tasten: ein Wurf aus Arbeitspaket 3 endet als Hinweis.
    function aktionAusfuehren(name) {
      try {
        if (name === 'pdf') gateOeffnen();
        else if (name === 'gate-zu') ansichtSetzen('rechner');
        else if (name === 'gate-senden') senden();
        else if (name === 'download') pdfSpeichern(false);
        else if (name === 'termin') ereignis.feuere('termin');
      } catch (fehler) {
        laeuft = false;
        melde(fehlerText(), 'rot');
      }
    }
    function reagiere(fall) {
      var knoten = fall.target;
      var schluessel = knoten && knoten.getAttribute ? knoten.getAttribute('data-amr-feld') : null;
      if (schluessel) nutzerAendert(schluessel, knoten.value);
    }
    ziel.addEventListener('input', reagiere);
    ziel.addEventListener('change', reagiere);
    ziel.addEventListener('click', function (fall) {
      var knoten = fall.target && fall.target.closest
        ? fall.target.closest('[data-amr-aktion]') : null;
      if (!knoten || !ziel.contains(knoten)) return;
      var name = knoten.getAttribute('data-amr-aktion');
      if (name !== 'termin') fall.preventDefault(); // Termin ist ein echter Verweis.
      aktionAusfuehren(name);
    });
    ziel.addEventListener('submit', function (fall) {
      fall.preventDefault();
      aktionAusfuehren('gate-senden');
    });
    // Escape schliesst das Gate, wie das Broschueren-Gate in Snippet 930.
    ziel.ownerDocument.addEventListener('keydown', function (fall) {
      if (fall.key === 'Escape' && ansicht === 'gate') aktionAusfuehren('gate-zu');
    });
    jeder('[data-amr-text]', function (knoten) {
      var wert = K.TEXTE[knoten.getAttribute('data-amr-text')];
      if (typeof wert === 'string') knoten.textContent = wert;
      else if (wert && wert.join) knoten.textContent = wert.join(', ');
    });
    eingabenBauen();
    ansichtSetzen('rechner');
    zeichne();
    var fehlend = fehlendeModule(AMR);
    if (fehlend.length) {
      // Sichtbare Bruecke, solange Arbeitspaket 3 fehlt; im Ganzen entsteht der Knoten nie.
      var hinweis = ziel.ownerDocument.createElement('p');
      hinweis.className = 'amr-hinweis amr-hinweis--rot';
      hinweis.setAttribute('data-amr-vorschau', '');
      hinweis.textContent = vorschauHinweis(fehlend);
      ziel.insertBefore(hinweis, ziel.firstChild);
    }
    ereignis.feuere('ansicht');
    return { eingaben: function () { return eingaben; }, ergebnis: function () { return ergebnis; },
      ansicht: function () { return ansicht; }, aktion: aktionAusfuehren };
  }
  AMR.ui = {
    start: start, zahl: zahl, ausgabeText: ausgabeText, istNegativ: istNegativ,
    sonderAfaText: sonderAfaText, abgeleitet: abgeleitet, aenderung: aenderung,
    sichtbarkeit: sichtbarkeit, pruefeKontakt: pruefeKontakt, fehlerText: fehlerText,
    fehlendeModule: fehlendeModule, vorschauHinweis: vorschauHinweis, wohnungAusSuche: wohnungAusSuche,
    ereignisKanal: ereignisKanal, jahresZeile: jahresZeile, reglerWert: reglerWert,
    wahlText: wahlText, karteMarkup: karteMarkup, feldMarkup: feldMarkup, waehlbar: waehlbar
  };
  // Startet sich selbst wie Snippet 930; in Node fehlt document, dort passiert nichts.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); });
    else start();
  }
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.ui;