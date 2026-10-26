# Testanleitung Teilnehmerportal (klickbarer Prototyp)

**Adresse:** http://localhost:3000/portal (vorher `pnpm install` und `pnpm dev`, siehe README)

Alle Daten liegen nur in diesem Browser. Es gibt keine echte Anmeldung, keine E-Mails und keine Zahlung.

## 0. Vorbereitung

1. Portal öffnen → in der Seitenleiste unten **„Demo-Steuerung“** (mobil hinter **„Menü“**) → ganz unten **„Alle Demo-Daten zurücksetzen“**. Damit startet jeder Test sauber.
2. **Nur ein Tab:** Die Anmeldung gilt für alle Tabs des Browsers. Ein Login als Verwaltung in Tab 2 meldet den Unternehmer in Tab 1 ab. Zwischen den Rollen wechseln Sie so:
   - **Abmelden / Anmelden** mit dem nächsten Testzugang, oder
   - **Demo-Steuerung → Perspektive** (Bewerber / Verwaltung / Jury, ohne Passwort), oder
   - in der Verwaltung im Vorgang **„Bewerberansicht öffnen“**. Damit sehen Sie sofort, was der Bewerber sieht.
3. **Mobil testen:** Browser-Entwicklertools → Gerätemodus, z. B. 390 × 844.
4. **Ausbaustufe:** Demo-Steuerung → **Ausbaustufe** (A · A + B · A + B + C · Gesamt). Die Use Cases 1–14 gehen von **Gesamt** aus; die Stufen selbst prüft UC 15. „Zurücksetzen“ ändert die Stufe nicht.

## 1. Testzugänge

Passwort für alle: **demo2026**. Auf der Login-Seite füllt **„Eintragen“** die Felder aus.

| Ansicht | E-Mail | Was Sie sehen |
|---|---|---|
| Unternehmer (Eigenbewerbung) | `unternehmer@demo.bmp` | Alex Muster mit Vorgang **NEWEDGE** (Phase 01, „Neu eingegangen“) |
| Vorschlagende Person (Fremdnominierung) | `vorschlag@demo.bmp` | Paula Beispiel mit **Huber Holzbau KG** (Phase 01, „In Prüfung“) |
| Verwaltung / Geschäftsstelle | `verwaltung@demo.bmp` | Verwaltung mit allen Rechten, Start auf **„Übersicht“** |
| Sachbearbeitung (eingeschränkt) | `sachbearbeitung@demo.bmp` | Verwaltung ohne Runde, Jury und Ergebnisse; Jury- und Ergebnisschritte nur lesbar |
| Jury 1 (Ja / Vielleicht / Nein) | `jury1@demo.bmp` | Juryansicht als Jurymitglied A, nur zugewiesene Bewerbungen (Fragebögen und sechs Unterlagen) |
| Jury 2 (Punkte 1–10) | `jury2@demo.bmp` | Juryansicht als Jurymitglied D, nur zugewiesene Bewerbungen |
| Neues Konto | beliebige Adresse über **„Konto erstellen“** | leeres Konto, Start bei den Stammdaten |

Weitere Jurymitglieder (B, C in Jury 1; E in Jury 2) und selbst angelegte Mitglieder melden sich mit den Zugangsdaten an, die in der Verwaltung unter **Jury → „Verwalten“** angezeigt werden. Selbst angelegte interne Benutzer finden Sie unter **Rechte & Benutzer → Interne Zugänge → „Anzeigen“**.

**Aufbau:** Links die Seitenleiste mit den Bereichen der Rolle (mobil hinter **„Menü“**), unten Konto, Abmelden und Demo-Steuerung. Details wie ein Vorgang, ein Fragebogen oder ein Jurymitglied öffnen als eigene Seite; oben führt **„Zurück zur …“** zurück.

**Menü der Verwaltung (Gesamt):** Vorgänge: Übersicht · Anmeldungen · Zahlungen · Bewerbungen · Jury · Ergebnisse · Gewinnerunterlagen; Verwaltung: Fragebögen · Runde · Exporte · Rechte & Benutzer. Die Zahlen neben den Bereichen zeigen offene Arbeit. In den Ausbaustufen fehlen die Bereiche späterer Stufen (UC 15).

**Bewerbung:** Nach Prüfung und Zahlung schaltet die Verwaltung die Bewerbung frei. Der Bewerber wählt einen oder mehrere Preise, füllt **je Preis einen Fragebogen** aus und lädt **sechs Unterlagen** hoch (PDF, Word, Excel, PowerPoint, OpenDocument, Bilder). Vollständig = alle Fragebögen eingereicht und alle Unterlagen da; dann steht „Bewerbung eingereicht“.

## 2. Use Cases

Jeder Use Case hat eine Schrittfolge und eine Erwartung (✓).

### UC 1: Konto erstellen und eigenes Unternehmen anmelden (Eigenbewerbung)

1. Abmelden → **„Konto erstellen“** → E-Mail, Passwort (mind. 8 Zeichen), Einwilligung → „Konto erstellen“.
   - ✓ Es geht direkt zu den **Stammdaten**.
2. Vor- und Nachname, Nutzergruppe **„Unternehmer“**, Unternehmensname → „Stammdaten speichern“.
3. **„Neue Anmeldung“** → **Eigenbewerbung** → „Weiter“.
   - ✓ Hinweis: Die Teilnahme ist kostenpflichtig, die Rechnung folgt nach der Prüfung.
4. Felder ausfüllen.
   - ✓ Unternehmensname ist aus den Stammdaten übernommen.
   - ✓ Ohne Pflichtfelder springt „Weiter“ zum ersten Fehler.
5. Prüfen → „Ändern“ testen → Einwilligung → **„Anmeldung einreichen“**.
   - ✓ Bestätigung mit Eingangsnummer.
   - ✓ Zurück zum Portal: Der Vorgang steht in **Phase 01 · Neu eingegangen**.
6. Zusatz:
   - Während der Anmeldung die **Browser-Zurück-Taste** drücken. ✓ Sie geht einen Schritt zurück, die Eingaben bleiben.
   - Abbrechen und später **„Weiter bearbeiten“**. ✓ Der Entwurf wird fortgesetzt.

### UC 2: Ein anderes Unternehmen vorschlagen (Fremdnominierung)

1. Mit `vorschlag@demo.bmp` oder einem neuen Konto (Nutzergruppe **Privatperson**) → **„Neue Anmeldung“** → **Fremdnominierung**.
   - ✓ Nur 3 Pflichtangaben: Firmenname, Ort, Begründung.
   - ✓ Hinweis: Für Sie entstehen keine Kosten.
2. Einreichen.
   - ✓ Bestätigung: „Ihre Fremdnominierung ist eingegangen“.
   - ✓ Im Vorgang steht: „Für Sie ist nichts weiter zu tun.“
3. Später (siehe UC 7):
   - ✓ Die vorschlagende Person sieht nur den Stand.
   - ✓ Keine Rechnung, kein Fragebogen-Inhalt, kein Einladungsbrief.

### UC 3: Wiederkehrender Bewerber prüft seinen Stand

1. Mit `unternehmer@demo.bmp` anmelden → Dashboard „Meine Vorgänge“.
   - ✓ Jede Zeile zeigt Phase, Status und **„Ihr Schritt“** bzw. **„Kein Handlungsbedarf“** mit passendem Button.
2. NEWEDGE öffnen.
   - ✓ Zeitleiste der 4 Phasen, Phasenkarte, nächster Schritt.
   - ✓ Darunter die Blöcke Anmeldung · Rechnung & Zahlung · Bewerbungsfragebogen · Ergebnis & Einladung.
   - ✓ Gesperrte Blöcke nennen den Grund.
3. Deep Link:
   - Abmelden → `http://localhost:3000/portal/vorgang/demo-newedge-vorgang` aufrufen → anmelden.
   - ✓ Sie landen direkt im Vorgang.

### UC 4: Kerndurchlauf NEWEDGE durch alle vier Phasen

Rollenwechsel per **Demo-Steuerung → Perspektive** (siehe oben). Nach jedem Verwaltungsschritt **„Bewerberansicht öffnen“**.

| # | Verwaltung (Vorgang NEWEDGE → „Öffnen“) | Erwartung beim Bewerber |
|---|---|---|
| 1 | – (Ausgangslage) | Phase 01 · **Neu eingegangen**, Bewerbung gesperrt |
| 2 | „In Prüfung setzen“ | Phase 01 · **In Prüfung** |
| 3 | „Rückfrage erforderlich“ | Status **Rückfrage**, „Die Geschäftsstelle meldet sich …“ (kein Handlungsbedarf) |
| 4 | „Prüfung abschließen und vormerken“ | Phase 02 · **Rechnung folgt** |
| 5 | „Rechnung als gestellt markieren“ | **Rechnung offen**, „Ihr Schritt: Rechnung begleichen“; Bewerbung „wird freigeschaltet, sobald Ihre Zahlung eingegangen ist“ |
| 6 | „Zahlung als eingegangen markieren“ → Frist setzen → „Bewerbung freigeben“ | **Bewerbung freigeschaltet** mit Frist im „Ihr Schritt“ |
| 7 | (Bewerber wählt Preise, füllt die Fragebögen aus und lädt die Unterlagen hoch, siehe UC 5) | Phase 02 · **Bewerbung eingereicht** |
| 8 | „Der Jury zuweisen“ → „Jury 1 starten“ | Phase 03 · **Auditsitzung der Jury**, keine Jury-Details sichtbar |
| 9 | (Jury stimmt ab, siehe UC 6) → „Übrige Stimmen simulieren“ → „Jury 2 starten“ → „Übrige Stimmen simulieren“ → „Juryprüfung abschließen“ | Phase 04 · **Entscheidung ausstehend** |
| 10 | „Einladung vorbereiten (intern)“ | weiterhin **Entscheidung ausstehend**: Die vorbereitete Einladung ist unsichtbar |
| 11 | „Einladung freigeben“ | **Einladung liegt vor**, „Einladung ansehen“ öffnet den Brief |
| 11b | alternativ „Keine Einladung“ | **Verfahren abgeschlossen**, neutral, ohne Gratulation |

Leitplanken (in der Verwaltung prüfen):
- ✓ „Bewerbung freigeben“ ist gesperrt, solange Prüfung, Zahlung oder **Frist** fehlen.
- ✓ „Der Jury zuweisen“ gibt es erst, wenn die Bewerbung vollständig ist.
- ✓ „Jury 2 starten“ ist gesperrt, bis alle Jury-1-Stimmen da sind.
- ✓ Eine freigegebene Einladung zurückzunehmen fragt nach.

**Abkürzung:** Demo-Steuerung → **NEWEDGE-Szenario 1–8**. Das springt direkt in jeden dieser Zustände.

### UC 5: Bewerbung ausfüllen – Preise, Fragebögen, Unterlagen

1. Szenario **3 „Bewerbung freigeschaltet“** → „Zur Bewerbung“.
   - ✓ Der Block **Bewerbung** zeigt Preise, Fragebögen und die **sechs Unterlagen** mit Nummer, Bezeichnung und Hinweis.
2. **„Preise wählen“** → eigene Seite.
   - ✓ Mehrere Preise sind möglich; der Bavarian Future Award zeigt „Fragebogen folgt“ (noch im Entwurf, siehe UC 16).
   - Ohne Auswahl „Auswahl speichern“ → ✓ Fehlermeldung.
3. Bayerischer Mittelstandspreis **und** Roland-Berger-Zukunftspreis wählen → „Auswahl speichern“.
   - ✓ Es geht direkt in den Fragebogen zum Mittelstandspreis; Kontaktdaten sind aus der Anmeldung übernommen.
4. Formate testen unter „Unternehmensdaten“:
   - Umsatz `12.5` → ✓ wird zu `12,5`.
   - `850.000` → ✓ Fehlermeldung, die Eingabe bleibt stehen.
   - `13,47` → ✓ Hinweis „eine Nachkommastelle“.
   - `6000` → ✓ Plausibilitätsmeldung.
5. „Zwischenspeichern“ → ✓ „Gespeichert“ mit Haken (mobil nur das Symbol).
6. Bis „Prüfen & einreichen“ → bei einem Abschnitt **„Ändern“** → ✓ Der Button heißt dann „Zurück zur Prüfung“.
7. Bestätigung anhaken → **„Fragebogen einreichen“**.
   - ✓ Bestätigungsseite mit „Für die vollständige Bewerbung fehlt noch: Fragebogen Roland-Berger-Zukunftspreis, 6 Unterlagen“.
8. Zurück zum Vorgang → beim Roland-Berger-Zukunftspreis **„Ausfüllen“** → zwei Abschnitte ausfüllen und einreichen.
9. **Unterlagen:** je Platz „Datei auswählen“.
   - Eine `.exe`-Datei → ✓ „Dieses Format wird nicht angenommen“.
   - PDF, Word (`.docx`), Excel (`.xlsx`), PowerPoint, Bild → ✓ Dateiname, Format und Größe erscheinen; der Button heißt danach „Austauschen“.
   - ✓ Nach der sechsten Datei: Status **„Bewerbung eingereicht“**, „Fragebögen 2 von 2 eingereicht · Unterlagen 6 von 6“.
10. Sonderfall: nur Preise wählen, deren Fragebogen noch nicht freigeschaltet ist (z. B. nur Bavarian Future Award) und alle Unterlagen hochladen.
    - ✓ Status „Fragebogen folgt“, kein „Ihr Schritt“; in der Verwaltung steht „Fragebogen freischalten: Future Award“.

### UC 6: Jury bewertet (zwei Jury-Arten)

1. Szenario **6 „Juryprüfung“** (oder UC 4 bis Schritt 8) → als `jury1@demo.bmp` anmelden.
   - ✓ Kopf: „Sie bewerten als Jurymitglied A · Jury 1 · Ersteinschätzung“.
   - ✓ Hinweis „Vertraulich“.
   - ✓ Nur die zugewiesenen Bewerbungen, offene oben, „Ihre Bewertung: offen/abgegeben“.
2. Je Unternehmen ✓ **„Unterlagen (6)“** mit allen Dateien (Name, Format, Größe – z. B. Frankenkeramik: PowerPoint, PDF, Excel, Word).
3. „Fragebögen lesen (2)“ → ✓ die Antworten je gewähltem Preis (Frankenkeramik: Mittelstandspreis und Roland-Berger-Zukunftspreis).
4. **Ja / Vielleicht / Nein** wählen → ✓ „Bewertung gespeichert“. Ein Punktefeld gibt es hier nicht.
5. Abmelden → als `jury2@demo.bmp` anmelden.
   - ✓ Nur das Punktefeld (1–10); solange Jury 2 nicht gestartet ist, steht dort „Die Punktevergabe beginnt …“.
6. Verwaltung: „Übrige Stimmen simulieren“ → „Jury 2 starten“ → als `jury2@demo.bmp` Punkte vergeben.
7. Gegenprobe: als Bewerber anmelden → ✓ keine Stimmen, Punkte oder Jury-Stufen sichtbar.
8. Ohne Jury-Zugang (Demo-Steuerung → „Jury“): ✓ Oben lässt sich wählen, als welches Mitglied Sie die Ansicht sehen.

### UC 7: Fremdnominierung durch die Phasen

1. Als Verwaltung → **Huber Holzbau KG** „Öffnen“ → Prüfung abschließen → Rechnung → Zahlung → Frist → Freigabe.
2. „Ansicht der vorschlagenden Person öffnen“ (oder als `vorschlag@demo.bmp` anmelden).
   - ✓ „Unternehmen informiert“.
   - ✓ Kein „Ihr Schritt“, keine Rechnung, keine Bewerbung.
   - ✓ Demo-Hinweise zur noch offenen Zuständigkeit.
3. Optional „Demo: als Unternehmen öffnen“ → ✓ Die Bewerbung (Preise, Fragebögen, Unterlagen) aus Sicht des vorgeschlagenen Unternehmens.

### UC 8: Verwaltung – Übersicht und Steuerung

1. Als `verwaltung@demo.bmp` → Startseite **„Übersicht“**.
2. Oben die vier Phasen als Trichter:
   - ✓ Phase 01 „erst angemeldet“ mit Aufschlüsselung, z. B. „Neu 1 · In Prüfung 1“.
   - ✓ Phase 02 „in der Bewerbung“: Rechnung folgt / Rechnung offen / Freigabe offen / Bewerbung in Arbeit / eingereicht.
   - ✓ Phase 03 „in der Jury“: Zugewiesen / Jury 1 / Jury 2.
   - ✓ Phase 04 mit „eingeladen: …“, dazu Entscheidung offen / keine Einladung.
   - ✓ Ein Klick auf eine Phase filtert die Listen darunter.
3. **„Ihre Aufgaben“**: alle Vorgänge, bei denen die Verwaltung am Zug ist.
   - ✓ Schritte ohne weitere Eingaben direkt ausführbar: **„Rechnung stellen“**, **„Zahlung bestätigen“**, **„Der Jury zuweisen“**, **„Jury 1/2 starten“**, **„Juryprüfung abschließen“**.
   - ✓ Prüfung, Freigabe (braucht eine Frist) und Ergebnis über **„Vorgang öffnen“**.
4. **„Alle Vorgänge“**: Spalte „Bewerbung“ mit Status und „Fragebögen x/y · Unterlagen x/6“.
5. **Live ansehen:** bei „Bewerbung in Arbeit“ oder „eingereicht“ → **„Live ansehen“**.
   - ✓ Stand, gewählte Preise, Fragebögen je Preis mit allen Antworten, die sechs Unterlagen, letzter Speicherzeitpunkt.
   - Live-Test mit zwei Tabs:
     - Tab 1: Demo-Steuerung → „Verwaltung“, Bewerbung von NEWEDGE live öffnen.
     - Tab 2: Demo-Steuerung → „Bewerber“, im Fragebogen ein Feld ändern.
     - ✓ Tab 1 zeigt die Änderung ohne Neuladen.
6. Die übrigen Menüpunkte:
   - ✓ **Zahlungen**, **Bewerbungen** und **Ergebnisse** zeigen standardmäßig nur offene Arbeit; „Erledigte einblenden“ zeigt den Rest.
   - ✓ **Bewerbungen**: Spalten Preise, Stand (Fragebögen und Unterlagen) und Frist.
   - ✓ Suche und Phasenfilter; **„Liste exportieren (CSV)“** siehe UC 11.

### UC 9: Jury-Dashboard – Mitglieder, Fortschritt, Zugänge, Zuweisung

1. Verwaltung → **„Jury“** (Seite „Jury-Dashboard“).
   - ✓ Kennzahlen: Jurymitglieder (je Art), Fragebögen in Jury 1 und Jury 2, offene Bewertungen.
   - ✓ Je Jury-Art eine Tabelle: **Zugewiesen · Bearbeitet · Offen · Fortschritt** pro Mitglied.
   - ✓ Darunter die Fragebögen in der Jury mit „Jury 1: 2/3 · Jury 2: 0/2“.
2. **„Jurymitglied anlegen“** → Name, E-Mail, Jury-Art (Jury 1 oder Jury 2) → „Anlegen“.
   - ✓ Ohne Angaben erscheinen Fehlermeldungen.
   - ✓ Danach öffnet sich das Profil mit **erzeugtem Zugang** (E-Mail und Passwort, „Neues Passwort erzeugen“). Im Prototyp wird nichts versendet.
3. Im Profil unter „Zugewiesene Fragebögen“ Haken setzen.
   - ✓ Zähler und Dashboard aktualisieren sich.
   - ✓ Abgeschlossene Fälle sind gesperrt.
   - ✓ Die Jury-Art lässt sich nur ohne Zuweisungen ändern.
4. Abmelden → mit dem erzeugten Zugang anmelden → ✓ nur die zugewiesenen Fragebögen, nur die Bewertungsform der eigenen Jury-Art.
5. Im Vorgang (Verwaltung) unter „Juryorganisation“:
   - ✓ Besetzung je Jury-Art mit Häkchen und dem Stand jedes Mitglieds.
   - ✓ „Der Jury zuweisen“ ohne eigene Auswahl setzt alle Mitglieder (Standardbesetzung).
   - ✓ „Jury 2 starten“ erst, wenn alle zugewiesenen Jury-1-Stimmen da sind.

### UC 10: Wettbewerbsrunde steuern (Runde)

1. Verwaltung → **„Runde“** (oder oben im Kopf **„Runde verwalten“**).
   - ✓ Sechs Stufen: Vorbereitung → Anmeldung geöffnet → Anmeldung geschlossen → Bewerbungsphase → Juryphase → Verfahren abgeschlossen (in den Ausbaustufen weniger, siehe UC 15).
   - ✓ Rechts „Was der Status bewirkt“: Neue Anmeldungen **möglich** oder **gesperrt**, dazu die Zahl der Anmeldungen und Entwürfe.
2. **„Anmeldung schließen“** → Rückfrage bestätigen.
   - ✓ Status „Anmeldung geschlossen“, Neue Anmeldungen **gesperrt**.
3. Als `unternehmer@demo.bmp` anmelden (oder Demo-Steuerung → „Bewerber“).
   - ✓ Hinweis, dass die Anmeldung derzeit geschlossen ist.
   - ✓ **„Neue Anmeldung“** ist gesperrt.
   - ✓ Ein vorher angelegter Entwurf lässt sich öffnen, aber nicht einreichen (Hinweis im Formular).
4. Zurück in der Verwaltung → **„Anmeldung wieder öffnen“** → ✓ wieder **möglich**.
5. **Anmeldeschluss** ändern → ✓ Bewerber sehen das neue Datum unter „Neue Anmeldung“.
6. **Standardfrist** für die Bewerbung setzen → ✓ Im Vorgang erscheint vor der Freigabe der Bewerbung **„Standardfrist übernehmen (…)“**.
7. „Status direkt setzen (Demo)“ springt in jede Stufe (nur für die Vorführung).

### UC 11: Exporte und Mailinglisten

1. Verwaltung → **„Exporte“**.
   - ✓ Neun Listen, jeweils mit Anzahl der Einträge: Alle Teilnehmenden · Phase 01 · Vorschlagende Personen · Zahlungserinnerung · Erinnerung Bewerbung (mit Frist und dem, was noch offen ist) · Eingeladene (Gala) · Ohne Einladung · Jury-Auswertung · Fehlende Gewinnerunterlagen.
2. **„CSV herunterladen“** → ✓ Die Datei `bmp-2027_mailing_…_<Datum>.csv` wird gespeichert.
   - In Excel öffnen → ✓ Spalten Anrede, Vorname, Nachname, E-Mail, Unternehmen, Eingangsnummer, Art, Phase, Status; Umlaute korrekt.
3. **Jury-Auswertung** → ✓ Preise, Anzahl der Unterlagen, Stimmen der Jury 1 (Ja / Vielleicht / Nein), Ø-Punkte der Jury 2 und Ergebnis je Bewerbung.
4. In einem Listen-Menüpunkt (z. B. **Anmeldungen**) → **„Liste exportieren (CSV)“** → ✓ Exportiert genau die sichtbare Liste, mit Filter und Suche.
5. **Ergebnisse** → ✓ zusätzlich „Mailingliste Eingeladene (CSV)“ und „Mailingliste ohne Einladung (CSV)“.

Das Portal verschickt nichts. Die Listen sind für den manuellen Versand über den Mailingserver gedacht.

### UC 12: Gewinnerunterlagen und Medienstatus

Voraussetzung ist eine freigegebene Einladung. In den Demo-Daten hat **Alpenländische Feinkost …** schon eine; sonst NEWEDGE-Szenario 8 oder UC 4 bis Schritt 11.

1. Verwaltung → **„Gewinnerunterlagen“**.
   - ✓ Alle eingeladenen Unternehmen mit Status „nicht angefordert“.
2. **„Unterlagen anfordern“**.
   - ✓ Medienstatus je Unterlage (Logo, Pressefoto, Kurzporträt, Pressekontakt), z. B. „0 von 4 geprüft · 4 offen“.
3. Vorgang öffnen → **„Bewerberansicht öffnen“** (mobil „Ansicht öffnen“). Alpenländische gehört zum Sammelkonto ohne Login, deshalb geht es nur über diesen Button.
   - ✓ „Ihr Schritt: Unterlagen für Gala und Presse einreichen“.
   - ✓ Block „Unterlagen für Gala und Presse“: **„Datei auswählen“** für Logo und Pressefoto, Textfelder für Kurzporträt und Pressekontakt, je Unterlage **„Einreichen“**.
4. Zurück in der Verwaltung → Vorgang → **6 Gewinnerunterlagen & Medienstatus**.
   - ✓ Das Eingereichte steht mit Dateiname bzw. Text da.
   - ✓ Je Unterlage **„Geprüft“** oder **„Nachbesserung“**.
   - ✓ Bei Nachbesserung sieht der Bewerber den Hinweis der Geschäftsstelle und kann neu einreichen.
5. Alle vier geprüft → ✓ „Unterlagen vollständig“, beim Bewerber kein „Ihr Schritt“ mehr.

Die Liste der Unterlagen ist ein Platzhalter. Dateien werden nicht hochgeladen, gespeichert wird nur der Dateiname.

### UC 13: Rechte und Benutzer

1. Verwaltung → **„Rechte & Benutzer“**.
   - ✓ Matrix „Rollen und Rechte“ für Verwaltung, Sachbearbeitung, Jury 1 und Jury 2.
   - ✓ „Interne Zugänge“: alle Konten der Geschäftsstelle und der Jury.
2. **Benutzer anlegen**: Name, E-Mail, Rolle (Verwaltung oder Sachbearbeitung) → „Anlegen“.
   - ✓ Ohne Angaben erscheinen Fehlermeldungen.
   - ✓ Der neue Zugang erscheint mit erzeugtem Passwort („Anzeigen“, „Neues Passwort“). Im Prototyp wird nichts versendet.
3. Abmelden → mit dem neuen Zugang (Rolle Sachbearbeitung) oder mit `sachbearbeitung@demo.bmp` anmelden.
   - ✓ Menü ohne **Runde**, **Jury** und **Ergebnisse**.
   - ✓ Im Vorgang sind Juryorganisation und Ergebnis **nur lesbar** („Nur lesen – für diesen Schritt fehlt Ihrer Rolle das Recht.“).
   - ✓ **Exporte** ja, **Rechte & Benutzer** fehlt im Menü.
4. Als Verwaltung beim neuen Zugang den Haken **„aktiv“** entfernen → abmelden → mit diesem Zugang anmelden.
   - ✓ Anmeldung abgelehnt: „Dieser Zugang ist deaktiviert …“.
5. Den eigenen Zugang können Sie weder deaktivieren noch in der Rolle ändern.

Jury-Zugänge verwalten Sie unter **Jury** (UC 9), nicht hier.

### UC 14: Bedienung, Mobil, Tastatur

- **Tastatur:** Tab durch die Seitenleiste → ✓ goldener Fokusrahmen; „Zum Inhalt springen“ als erster Halt.
- **Detailseiten:** Vorgang öffnen, dann **„Zurück zur …“** oder **Escape** (außerhalb von Textfeldern) → ✓ Die Liste erscheint wieder, der Fokus steht auf dem Button, mit dem Sie geöffnet haben.
- **Mobil (390 px):**
  - ✓ **„Menü“** öffnet die Seitenleiste als Schublade; Escape oder **X** schließt sie.
  - ✓ Im Vorgang steht der nächste Schritt oben.
  - ✓ Die Aktionsleiste unten bleibt sichtbar und ist einzeilig.
  - ✓ Tabellen der Verwaltung werden zu Karten.
  - ✓ Kein seitliches Scrollen.
- **Demo-Wechsel:** Als neues Konto angemeldet → Demo-Steuerung „Bewerber“ → ✓ Im Panel erscheint **„Zurück zu Ihrem Konto: …“**.

### UC 15: Ausbaustufen A, A + B, A + B + C, Gesamt

Demo-Steuerung → **Ausbaustufe**. Im echten System entspricht das der Einstellung `NEXT_PUBLIC_PORTAL_STAGE` (a, ab, abc, gesamt).

| Stufe | Verwaltung (Seitenleiste) | Bewerber |
|---|---|---|
| **A** | Übersicht · Anmeldungen · Runde · Exporte · Rechte & Benutzer; Trichter nur Phase 01 | nach „Prüfung abschließen“: **„Anmeldung geprüft“**, „Über die nächsten Schritte … informieren wir Sie per E-Mail“; keine Rechnung, keine Bewerbung |
| **A + B** | + Zahlungen · Bewerbungen · Fragebögen; Trichter Phase 01–02 | Ablauf bis **„Bewerbung eingereicht“**, danach „Auf Nachricht der Geschäftsstelle warten“ |
| **A + B + C** | + Jury · Ergebnisse | bis Einladung bzw. Abschluss; keine Gewinnerunterlagen |
| **Gesamt** | + Gewinnerunterlagen | alles |

Außerdem je Stufe prüfen:
- ✓ **Vorgang (Verwaltung):** nur die Schritte der Stufe, fortlaufend nummeriert (A: nur Anmeldungsprüfung).
- ✓ **Rechte & Benutzer:** In A und A + B keine Jury-Rollen, keine Jury-Rechte, keine Jury-Zugänge.
- ✓ **Runde:** nur die Status der Stufe (A: bis „Anmeldung geschlossen“).
- ✓ **Exporte:** nur die Listen der Stufe (A: Alle, Phase 01, Vorschlagende).
- ✓ **Demo-Steuerung:** In A und A + B keine Perspektive „Jury“ und nur die passenden Szenarien.
- ✓ **Login-Seite:** In A und A + B keine Jury-Testzugänge.
- ✓ **Hilfe:** nur die Phasen und Fragen der Stufe.

### UC 16: Fragebögen der Preise bearbeiten und freischalten

1. Als Verwaltung → **Fragebögen**.
   - ✓ Drei Zeilen: Mittelstandspreis und Roland-Berger-Zukunftspreis **freigeschaltet**, Bavarian Future Award **Entwurf**.
   - ✓ Je Zeile Umfang (Abschnitte, Fragen, Pflicht) und Nutzung (gewählt, begonnen, eingereicht).
   - ✓ „Zurückziehen“ ist gesperrt, sobald jemand begonnen hat.
2. Future Award → **„Bearbeiten“**.
   - Überschrift ändern, **„Frage hinzufügen“**, Fragetext, Antwortformat (z. B. „Ganze Zahl“) und „Pflichtangabe“ setzen.
   - Bei „Auswahl“: Möglichkeiten eine je Zeile (mindestens zwei).
   - Pfeile verschieben Fragen und Abschnitte, der Papierkorb entfernt sie.
   - **„Änderungen speichern“** → ✓ „Gespeichert“. „Verwerfen“ setzt auf den letzten Stand zurück; „Zurück zur Liste“ fragt bei ungespeicherten Änderungen nach.
3. **„Vorschau“** → ✓ So sehen Bewerber den Fragebogen; Eingaben werden nicht gespeichert.
4. Zurück zur Liste → **„Freischalten“** (Rückfrage bestätigen) → ✓ Status „Freigeschaltet“.
5. Erneut öffnen („Ansehen und Texte korrigieren“):
   - ✓ Texte lassen sich ändern; Antwortformat, Pflicht, Hinzufügen und Entfernen sind gesperrt.
6. Als Bewerber (Szenario 3) → „Preise wählen“ → ✓ Der Future Award zeigt kein „Fragebogen folgt“ mehr; nach der Auswahl öffnet sich der neue Fragebogen.
7. Sachbearbeitung: ✓ Kein Bereich „Fragebögen“ (Recht nur für die Verwaltung).

## 3. Bekannte Grenzen

- **Kein Backend.** Daten nur im Browser; ein anderer Browser oder ein privates Fenster hat eigene Daten.
- **Bewusst noch nicht gebaut:** der Sponsorenbereich (Konzept 04). Die Fragebögen für Roland-Berger-Zukunftspreis und Bavarian Future Award sind Platzhalter, die die Geschäftsstelle im Bereich „Fragebögen“ ersetzt.
- **Rechte** gelten nur in der Oberfläche. Es gibt keine echte Zugriffskontrolle.
- **Exporte** sind CSV-Dateien, die Excel öffnet; keine .xlsx. Das Portal versendet keine E-Mails.
- **Unterlagen (Bewerbung und Gewinner):** Dateien werden nicht hochgeladen, gespeichert werden nur Name und Größe. Die Jury sieht die Dateinamen, kann die Dateien im Prototyp aber nicht öffnen.
- **Platzhalter:** Beträge, Rechnungs- und Einladungstexte, Bezeichnungen der sechs Bewerbungsunterlagen, Liste der Gewinnerunterlagen.
- **Browser-Zurück/Vor über eine Dokumentgrenze** (z. B. Portal → „Zur Website“ → Zurück): Im Dev-Server kann das Portal kurz laden und lädt sich dann einmal selbst neu (Sicherheitsnetz, ca. 1,3 s).
