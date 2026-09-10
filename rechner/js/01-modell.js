/**
 * Kapitalanlage-Rechner Wohnidyll W5, Rechenmodell (Plan Arbeitspaket 0, K5).
 *
 * Reine Funktionen, kein DOM, kein Netz. Jahresrechnung ueber zehn Jahre
 * (§ 23 Abs. 1 Satz 1 Nr. 1 EStG). Intern volle Genauigkeit; gerundet wird erst in
 * Anzeige, PDF und Lead-Nachricht.
 */
(function (AMR) {
  'use strict';

  var K = AMR.konstanten;

  function rundeAuf(wert, schritt) {
    return Math.round(wert / schritt) * schritt;
  }

  function wohnungVon(nr) {
    for (var i = 0; i < K.WOHNUNGEN.length; i++) {
      if (String(K.WOHNUNGEN[i].nr) === String(nr)) {
        return K.WOHNUNGEN[i];
      }
    }
    return null;
  }

  // Stellplatz aus der Liste STELLPLAETZE (h8-funnel K2). Ein unbekannter Schluessel liefert
  // einen Eintrag zum Preis null, damit ein alter Link niemanden in einen Fehler laufen laesst.
  function stellplatzVon(schluessel) {
    for (var i = 0; i < K.STELLPLAETZE.length; i++) {
      if (K.STELLPLAETZE[i].schluessel === schluessel) {
        return K.STELLPLAETZE[i];
      }
    }
    return { schluessel: schluessel, label: String(schluessel), preis: 0 };
  }

  function nebenkostenSatz() {
    return K.STEUER.grunderwerbsteuer + K.STEUER.notarGrundbuch + K.STEUER.makler;
  }

  /**
   * Bodenanteil am Kaufpreis in Prozent (h8-funnel K3). 'prozent' liefert die Annahme des
   * Mandanten, 'grundstueck' verteilt einen Grundstueckswert nach Wohnflaeche auf die
   * Wohnungen und rundet auf eine Nachkommastelle, damit der Regler einen zeigbaren Wert
   * bekommt und die Anzeige nicht mit fuenfzehn Stellen springt.
   */
  function bodenanteilProzentVon(kaufpreis, wohnflaeche) {
    if (!K.BODEN || K.BODEN.art !== 'grundstueck') {
      return K.BODEN ? K.BODEN.vorgabe : 30;
    }
    return Math.round(1000 * K.BODEN.wert * wohnflaeche / K.BODEN.wohnflaecheGesamt / kaufpreis) / 10;
  }

  // Kaltmiete je m² dieser Wohnung: die Vorgabe des Mandanten, sofern die Wohnung keine
  // eigene traegt (h8-funnel K2, WOHNUNGEN[i].mieteJeM2).
  function mieteJeM2Von(wohnung) {
    return wohnung && typeof wohnung.mieteJeM2 === 'number' ? wohnung.mieteJeM2 : K.MIETE_JE_M2_VORGABE;
  }

  /**
   * Vollstaendiger Eingabesatz fuer eine Wohnungsnummer oder 'frei'.
   * Miete, Eigenkapital und Kosten leiten sich aus der Wohnflaeche ab (K4).
   */
  function vorgaben(wohnungNr) {
    var wohnung = wohnungVon(wohnungNr);
    var kaufpreis = wohnung ? wohnung.kaufpreis : K.FREI.kaufpreis;
    var wohnflaeche = wohnung ? wohnung.wohnflaeche : K.FREI.wohnflaeche;
    return {
      wohnung: wohnung ? wohnung.nr : 'frei',
      kaufpreis: kaufpreis,
      wohnflaeche: wohnflaeche,
      stellplatz: 'keiner',
      mieteMonat: rundeAuf(wohnflaeche * mieteJeM2Von(wohnung), 10),
      eigenkapital: rundeAuf(kaufpreis * nebenkostenSatz() + 0.1 * kaufpreis, 1000),
      zinsProzent: K.ZINS_VORGABE,
      tilgungProzent: 2.0,
      steuersatzProzent: 42,
      afaMethode: 'degressiv',
      sonderAfa: 'auto',
      bodenanteilProzent: bodenanteilProzentVon(kaufpreis, wohnflaeche),
      wertsteigerungProzent: 2.0,
      mietsteigerungProzent: 1.5,
      kostenMonat: rundeAuf(30 + 0.5 * wohnflaeche, 5)
    };
  }

  // Kapitalwert der Zahlungsreihe bei Zinssatz r. Einsatz zum Zeitpunkt 0 ist das
  // Eigenkapital, Rueckfluss am Ende das Nettovermoegen nach Verkauf.
  function kapitalwert(r, eigenkapital, jahre, endwert) {
    var summe = -eigenkapital;
    for (var i = 0; i < jahre.length; i++) {
      summe += jahre[i].cashflowNachSteuer / Math.pow(1 + r, i + 1);
    }
    return summe + endwert / Math.pow(1 + r, jahre.length);
  }

  // Bisektion in [-0,99, 1,0] mit 200 Schritten (K5). Ohne Vorzeichenwechsel: null.
  function interneRendite(eigenkapital, jahre, endwert) {
    var unten = -0.99;
    var oben = 1.0;
    var fUnten = kapitalwert(unten, eigenkapital, jahre, endwert);
    var fOben = kapitalwert(oben, eigenkapital, jahre, endwert);
    if (!isFinite(fUnten) || !isFinite(fOben) || fUnten * fOben > 0) {
      return null;
    }
    for (var i = 0; i < 200; i++) {
      var mitte = (unten + oben) / 2;
      var fMitte = kapitalwert(mitte, eigenkapital, jahre, endwert);
      if (fUnten * fMitte <= 0) {
        oben = mitte;
      } else {
        unten = mitte;
        fUnten = fMitte;
      }
    }
    return 100 * ((unten + oben) / 2);
  }

  /**
   * Jahresrechnung ueber zehn Jahre. Erwartet den Eingabesatz aus vorgaben(),
   * liefert alle Kennzahlen aus K5 plus jahre[] mit je einer Jahreszeile.
   */
  function berechne(eingaben) {
    var jahre = [];
    var stellplatzpreis = stellplatzVon(eingaben.stellplatz).preis;
    var nk = nebenkostenSatz();
    var gesamtkaufpreis = eingaben.kaufpreis + stellplatzpreis;
    var nebenkosten = gesamtkaufpreis * nk;
    var gesamtinvestition = gesamtkaufpreis + nebenkosten;
    var darlehen = Math.max(0, gesamtinvestition - eingaben.eigenkapital);
    var zins = eingaben.zinsProzent / 100;
    var tilgung = eingaben.tilgungProzent / 100;
    var steuersatz = eingaben.steuersatzProzent / 100;
    var wertsteigerung = eingaben.wertsteigerungProzent / 100;
    var mietsteigerung = eingaben.mietsteigerungProzent / 100;
    var annuitaetJahr = darlehen * (zins + tilgung);

    // Nebenkosten erhoehen die Anschaffungskosten anteilig (§ 255 Abs. 1 HGB), der
    // Bodenanteil bleibt abschreibungsfrei. Steht der Stellplatz getrennt (h8-funnel K3),
    // ist er ein eigenes Wirtschaftsgut: er faellt aus der Gebaeude-AfA heraus und
    // bekommt eine eigene lineare AfA und eine eigene Miete.
    var bodenanteil = eingaben.bodenanteilProzent / 100;
    var getrennt = K.STELLPLATZ_MODELL === 'getrennt' && K.STELLPLATZ_GETRENNT;
    var afaBasis = getrennt
      ? eingaben.kaufpreis * (1 + nk) * (1 - bodenanteil)
      : gesamtinvestition * (1 - bodenanteil);
    var stellplatzAfaJahr = getrennt ? stellplatzpreis * (1 + nk) * K.STELLPLATZ_GETRENNT.afaLinear : 0;
    var stellplatzMieteJahr = getrennt && stellplatzpreis > 0 ? K.STELLPLATZ_GETRENNT.mieteMonat * 12 : 0;
    // Nenner der § 7b-Pruefung. Bei Faktor 1,0 ist das die Wohnflaeche wie bisher; ein
    // groesserer Faktor bildet die Nutzflaeche oder die Bruttogrundflaeche ab
    // (BMF-Schreiben vom 21.05.2025, Rn. 49 und 51).
    var grenzFlaeche = eingaben.wohnflaeche * (K.STEUER.flaechenFaktorGrenze || 1);
    var kostenJeM2 = afaBasis / grenzFlaeche;
    var sonderAfaBerechtigt = kostenJeM2 <= K.STEUER.sonderAfaKostenGrenzeJeM2;
    var sonderAfaAktiv = eingaben.sonderAfa === 'auto' && sonderAfaBerechtigt;
    var bemessungMax = K.STEUER.sonderAfaBemessungMaxJeM2 * eingaben.wohnflaeche;
    var sonderAfaJahr = sonderAfaAktiv ? K.STEUER.sonderAfaSatz * Math.min(afaBasis, bemessungMax) : 0;

    var restschuld = darlehen;
    var restwert = afaBasis;
    var summeCashflow = 0;
    for (var t = 1; t <= K.STEUER.betrachtungJahre; t++) {
      var miete = (eingaben.mieteMonat * 12 + stellplatzMieteJahr) * Math.pow(1 + mietsteigerung, t - 1);
      var kosten = eingaben.kostenMonat * 12;
      var zinsen = restschuld * zins;
      var tilgungJahr = darlehen > 0 ? Math.min(annuitaetJahr - zinsen, restschuld) : 0;
      var annuitaet = zinsen + tilgungJahr;
      var afaRegulaer =
        eingaben.afaMethode === 'linear' ? K.STEUER.afaLinear * afaBasis : K.STEUER.afaDegressiv * restwert;
      var sonderAfa = t <= K.STEUER.sonderAfaJahre ? sonderAfaJahr : 0;
      // § 7a Abs. 9 EStG: die degressive AfA des Folgejahres bemisst sich am geminderten Restwert.
      restwert = restwert - afaRegulaer - sonderAfa;
      var steuerlichesErgebnis = miete - kosten - zinsen - afaRegulaer - sonderAfa - stellplatzAfaJahr;
      var steuer = steuerlichesErgebnis * steuersatz;
      var cashflowVorSteuer = miete - kosten - annuitaet;
      var cashflowNachSteuer = cashflowVorSteuer - steuer;
      restschuld = restschuld - tilgungJahr;
      summeCashflow += cashflowNachSteuer;
      jahre.push({
        jahr: t,
        miete: miete,
        kosten: kosten,
        zinsen: zinsen,
        tilgung: tilgungJahr,
        afaRegulaer: afaRegulaer,
        sonderAfa: sonderAfa,
        afaStellplatz: stellplatzAfaJahr,
        steuerlichesErgebnis: steuerlichesErgebnis,
        steuer: steuer,
        cashflowVorSteuer: cashflowVorSteuer,
        cashflowNachSteuer: cashflowNachSteuer,
        restschuldEnde: restschuld,
        restwertEnde: restwert
      });
    }

    var immobilienwertEnde = gesamtkaufpreis * Math.pow(1 + wertsteigerung, K.STEUER.betrachtungJahre);
    var restschuldEnde = restschuld;
    var nettovermoegenEnde = immobilienwertEnde - restschuldEnde;
    var vermoegenEnde = nettovermoegenEnde + summeCashflow;
    var monate = K.STEUER.betrachtungJahre * 12;
    return {
      stellplatzpreis: stellplatzpreis,
      gesamtkaufpreis: gesamtkaufpreis,
      nebenkosten: nebenkosten,
      gesamtinvestition: gesamtinvestition,
      darlehen: darlehen,
      annuitaetJahr: annuitaetJahr,
      annuitaetMonat: annuitaetJahr / 12,
      afaBasis: afaBasis,
      grenzFlaeche: grenzFlaeche,
      bodenEur: eingaben.kaufpreis * bodenanteil,
      stellplatzAfaJahr: stellplatzAfaJahr,
      kostenJeM2: kostenJeM2,
      sonderAfaBerechtigt: sonderAfaBerechtigt,
      sonderAfaAktiv: sonderAfaAktiv,
      sonderAfaJahr: sonderAfaJahr,
      immobilienwertEnde: immobilienwertEnde,
      restschuldEnde: restschuldEnde,
      nettovermoegenEnde: nettovermoegenEnde,
      summeCashflow: summeCashflow,
      vermoegenEnde: vermoegenEnde,
      gewinn: vermoegenEnde - eingaben.eigenkapital,
      faktor: eingaben.eigenkapital > 0 ? vermoegenEnde / eingaben.eigenkapital : null,
      irrProzent: interneRendite(eingaben.eigenkapital, jahre, nettovermoegenEnde),
      cashflowVorSteuerMonatJahr1: jahre[0].cashflowVorSteuer / 12,
      cashflowNachSteuerMonatJahr1: jahre[0].cashflowNachSteuer / 12,
      zuschussMonatDurchschnitt: summeCashflow < 0 ? -summeCashflow / monate : 0,
      jahre: jahre
    };
  }

  /**
   * Einkommensteuer nach § 32a Abs. 1 EStG in der ab dem Veranlagungszeitraum 2026
   * geltenden Fassung. Zonen, Eckwerte und Konstanten am 09.09.2026 an
   * gesetze-im-internet.de gelesen und mit dem Plan verglichen, keine Abweichung.
   * Grundtarif, ohne Splitting, ohne Solidaritaetszuschlag, ohne Kirchensteuer.
   */
  function tarif(zvE) {
    var x = Math.floor(zvE); // § 32a Abs. 1 Satz 2: zu versteuerndes Einkommen auf volle Euro
    var steuer;
    if (x <= 12348) {
      steuer = 0;
    } else if (x <= 17799) {
      var y = (x - 12348) / 10000;
      steuer = (914.51 * y + 1400) * y;
    } else if (x <= 69878) {
      var z = (x - 17799) / 10000;
      steuer = (173.10 * z + 2397) * z + 1034.87;
    } else if (x <= 277825) {
      steuer = 0.42 * x - 11135.63;
    } else {
      steuer = 0.45 * x - 19470.38;
    }
    return Math.floor(steuer); // § 32a Abs. 1 Satz 6: auf den vollen Euro abrunden
  }

  /** Ableitung des Tarifs je Zone, in Prozent (§ 32a Abs. 1 EStG, Fassung ab VZ 2026). */
  function grenzsteuersatz(zvE) {
    var x = Math.floor(zvE);
    if (x <= 12348) return 0;
    if (x <= 17799) return (2 * 914.51 * ((x - 12348) / 10000) + 1400) / 100;
    if (x <= 69878) return (2 * 173.10 * ((x - 17799) / 10000) + 2397) / 100;
    return x <= 277825 ? 42 : 45;
  }

  /**
   * Modell des Schnellrechners (h8-funnel K4): nur die Wirkung der Abschreibung auf die
   * Einkommensteuer, ueber die zehn Jahre der Betrachtung. Miete, Zinsen und Kosten bleiben
   * dem Detailrechner vorbehalten, deshalb steht das auch im Text des Schnellrechners.
   * Eingabesatz sind die Vorgaben der Wohnung: Stellplatz keiner, AfA degressiv, Sonder-AfA
   * auto, Bodenanteil aus BODEN.
   */
  function schnell(wohnungNr, zvE) {
    var eingaben = vorgaben(wohnungNr);
    var ergebnis = berechne(eingaben);
    var voll = tarif(zvE);
    var summe = 0;
    var summeSonder = 0;
    var jahre = ergebnis.jahre.map(function (zeile) {
      var afa = zeile.afaRegulaer + zeile.sonderAfa;
      var vorteil = voll - tarif(Math.max(0, zvE - afa));
      // Aufteilung nach dem Anteil der Sonder-AfA an der gesamten Abschreibung des Jahres.
      var vorteilSonder = afa > 0 ? vorteil * zeile.sonderAfa / afa : 0;
      summe += vorteil;
      summeSonder += vorteilSonder;
      return {
        jahr: zeile.jahr,
        afaRegulaer: zeile.afaRegulaer,
        sonderAfa: zeile.sonderAfa,
        vorteil: vorteil,
        vorteilSonder: vorteilSonder,
        vorteilDegressiv: vorteil - vorteilSonder
      };
    });
    return {
      jahre: jahre,
      summe: summe,
      summeSonder: summeSonder,
      summeDegressiv: summe - summeSonder,
      grenzsteuersatzProzent: grenzsteuersatz(zvE),
      sonderAfaAktiv: ergebnis.sonderAfaAktiv,
      kostenJeM2: ergebnis.kostenJeM2,
      wohnung: eingaben.wohnung,
      zvE: zvE
    };
  }

  AMR.modell = { berechne: berechne, vorgaben: vorgaben, wohnungVon: wohnungVon,
    stellplatzVon: stellplatzVon, bodenanteilProzentVon: bodenanteilProzentVon,
    tarif: tarif, grenzsteuersatz: grenzsteuersatz, schnell: schnell };
})(typeof window !== 'undefined' ? (window.AMR = window.AMR || {}) : (global.AMR = global.AMR || {}));
if (typeof module !== 'undefined' && module.exports) module.exports = global.AMR.modell;