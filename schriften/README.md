# Schriften der Projektwebsite Hainbach H8

**Stand 10.09.2026: dieses Verzeichnis ist leer, und das ist eine gemeldete Luecke, kein
Versehen.**

Der Plan zur H8-Website vom 10.09.2026 (unter `docs/` im Arbeitsrepo) verlangt selbstgehostete
Schriften, ausdruecklich, damit kein Abruf bei Google Fonts stattfindet und dadurch gar nicht
erst eine Einwilligungsfrage entsteht (Abschnitt E1). Im Repo liegt jedoch **keine einzige
Schriftdatei** (geprueft am 10.09.2026 mit `find . -iname '*.woff2' -o -iname '*.woff' -o
-iname '*.ttf' -o -iname '*.otf'`, kein Treffer), und das Arbeitspaket hatte die Auflage, nichts aus
dem Netz zu laden. Eine erfundene Datei waere schlimmer als die Luecke: sie erzeugt auf jeder
Seite einen toten Verweis, den der Qualitaetswaechter (lychee) meldet, und die Seite faellt
trotzdem auf die Ersatzschrift zurueck.

Bis die Dateien da sind, faehrt `seite/statisch/stil.css` eine Ersatzkette aus Systemschriften:

    --h8-titelschrift: Merriweather, Georgia, "Times New Roman", serif;
    --h8-textschrift:  Lato, system-ui, -apple-system, "Segoe UI", Roboto,
                       "Helvetica Neue", Arial, sans-serif;

Merriweather und Lato stehen bewusst vorn. Wer die Schriften auf seinem Rechner installiert
hat, sieht schon heute das gemeinte Bild; alle anderen sehen Georgia und die Systemschrift.

## Welche vier Dateien fehlen

Die Wahl ist nicht neu, sie folgt `rechner/rechner.css`: dort sind seit 07.09.2026
**Merriweather** fuer Ueberschriften und **Lato** fuer den Flaechentext gesetzt, gemessen an
der Schwesterseite `wohnidyll-w5.de`. Der Rechnerblock steht auf `/rechner/` mitten in dieser
Seite; zwei verschiedene Schriftpaare an dieser Stelle wuerde man sehen.

| Datei, genau dieser Name | Schrift | Schnitt | Zeichensatz |
|---|---|---|---|
| `merriweather-latin-400.woff2` | Merriweather | Regular 400 | latin |
| `merriweather-latin-700.woff2` | Merriweather | Bold 700 | latin |
| `lato-latin-400.woff2` | Lato | Regular 400 | latin |
| `lato-latin-700.woff2` | Lato | Bold 700 | latin |

- **Nur `woff2`.** Jeder Browser, den GitHub Pages heute bedient, kann es; ein zweites Format
  waere doppelte Ladung ohne Nutzen.
- **Zeichensatz `latin` genuegt.** Umlaute und Eszett liegen darin; `latin-ext` braucht die
  Seite nicht.
- **Lizenz:** beide Schriften stehen unter der SIL Open Font License 1.1. Die Datei `OFL.txt`
  gehoert mit in dieses Verzeichnis, das verlangt die Lizenz.
- **Herkunft:** die Originale kommen aus dem Google-Fonts-Bestand (Merriweather von Sorkin
  Type, Lato von Łukasz Dziedzic). Bezogen werden sie **einmal** von Hand oder per
  `fontsource`, nicht zur Bauzeit und nicht zur Laufzeit. Das Repo bleibt ohne
  Node-Werkzeugkette (E2).

## Was sich aendert, sobald die vier Dateien hier liegen

Genau zwei Stellen in `seite/statisch/stil.css`. Erstens dieser Block, direkt hinter den
Kommentarkopf:

    @font-face {
      font-family: "Merriweather";
      src: url("/statisch/schriften/merriweather-latin-400.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Merriweather";
      src: url("/statisch/schriften/merriweather-latin-700.woff2") format("woff2");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Lato";
      src: url("/statisch/schriften/lato-latin-400.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Lato";
      src: url("/statisch/schriften/lato-latin-700.woff2") format("woff2");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

Zweitens: nichts. Die beiden Kennwerte `--h8-titelschrift` und `--h8-textschrift` nennen
Merriweather und Lato bereits an erster Stelle und greifen ab dann von selbst. Die
Ersatzkette bleibt dahinter stehen, damit ein Ladefehler die Seite nicht ohne Schrift laesst.

Wer die Ladung beschleunigen will, ergaenzt im `<head>` von
`seite/vorlagen/grundgeruest.html` zwei Vorabladungen fuer die beiden 400er-Schnitte:

    <link rel="preload" href="/statisch/schriften/merriweather-latin-400.woff2"
          as="font" type="font/woff2" crossorigin>

Die CSP im Rahmen erlaubt `font-src 'self'` und traegt das ohne Aenderung.

## Was gilt, bis dahin

- **Kein Abruf bei fonts.googleapis.com oder fonts.gstatic.com**, in keiner Datei. Das ist ein
  Akzeptanzkriterium des Arbeitspakets und bleibt es auch nach dem Einsetzen der Dateien.
- Die Seite ist mit der Ersatzkette vollstaendig benutzbar. Es fehlt Anmutung, nicht Funktion.
- Wer die Dateien einsetzt, prueft danach die Sichtpruefung bei 400 px und 1440 px erneut:
  Georgia und Merriweather laufen unterschiedlich breit, und die Ueberschriften stehen im
  Entwurf knapp.
