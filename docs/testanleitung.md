# Testanleitung Teilnehmerportal (klickbarer Prototyp)

**Adresse:** http://localhost:3000/portal (vorher `pnpm install` und `pnpm dev`, siehe README)

Alle Daten liegen nur in diesem Browser. Es gibt keine echte Anmeldung, keine E-Mails und keine Zahlung.

## 0. Vorbereitung

1. Portal öffnen → oben **„Demo-Steuerung“** → ganz unten **„Alle Demo-Daten zurücksetzen“**. Damit startet jeder Test sauber.
2. **Nur ein Tab:** Die Anmeldung gilt für alle Tabs des Browsers. Ein Login als Verwaltung in Tab 2 meldet den Unternehmer in Tab 1 ab. Zwischen den Rollen wechseln Sie so:
   - **Abmelden / Anmelden** mit dem nächsten Testzugang, oder
   - **Demo-Steuerung → Perspektive** (Bewerber / Verwaltung / Jury, ohne Passwort), oder
   - in der Verwaltung im Vorgang **„Bewerberansicht öffnen“**. Damit sehen Sie sofort, was der Bewerber sieht.
3. **Mobil testen:** Browser-Entwicklertools → Gerätemodus, z. B. 390 × 844.

## 1. Testzugänge

Passwort für alle: **demo2026**. Auf der Login-Seite füllt **„Eintragen“** die Felder aus.

| Ansicht | E-Mail | Was Sie sehen |
|---|---|---|
| Unternehmer (Eigenbewerbung) | `unternehmer@demo.bmp` | Alex Muster mit Vorgang **NEWEDGE** (Phase 01, „Neu eingegangen“) |
| Vorschlagende Person (Fremdnominierung) | `vorschlag@demo.bmp` | Paula Beispiel mit **Huber Holzbau KG** (Phase 01, „In Prüfung“) |
| Verwaltung / Geschäftsstelle | `verwaltung@demo.bmp` | Verwaltung mit allen Rechten, Start auf **„Übersicht“** |
| Sachbearbeitung (eingeschränkt) | `sachbearbeitung@demo.bmp` | Verwaltung ohne Runde, Jury und Ergebnisse; Jury- und Ergebnisschritte nur lesbar |
| Jury 1 (Ja / Vielleicht / Nein) | `jury1@demo.bmp` | Juryansicht als Jurymitglied A, nur zugewiesene Fragebögen |
| Jury 2 (Punkte 1–10) | `jury2@demo.bmp` | Juryansicht als Jurymitglied D, nur zugewiesene Fragebögen |
| Neues Konto | beliebige Adresse über **„Konto erstellen“** | leeres Konto, Start bei den Stammdaten |

Weitere Jurymitglieder (B, C in Jury 1; E in Jury 2) und selbst angelegte Mitglieder melden sich mit den Zugangsdaten an, die in der Verwaltung unter **Jury → „Verwalten“** angezeigt werden. Selbst angelegte interne Benutzer finden Sie unter **Exporte & Rechte → Interne Zugänge → „Anzeigen“**.

**Menü der Verwaltung:** Übersicht · Runde · Anmeldungen · Zahlungen · Fragebögen · Jury · Ergebnisse · Gewinnerunterlagen · Exporte & Rechte.

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
| 1 | – (Ausgangslage) | Phase 01 · **Neu eingegangen**, Fragebogen gesperrt |
| 2 | „In Prüfung setzen“ | Phase 01 · **In Prüfung** |
| 3 | „Rückfrage erforderlich“ | Status **Rückfrage**, „Die Geschäftsstelle meldet sich …“ (kein Handlungsbedarf) |
| 4 | „Prüfung abschließen und vormerken“ | Phase 02 · **Rechnung folgt** |
| 5 | „Rechnung als gestellt markieren“ | **Rechnung offen**, „Ihr Schritt: Rechnung begleichen“; Fragebogen „wird nach Zahlungseingang freigeschaltet“ |
| 6 | „Zahlung als eingegangen markieren“ → Frist setzen → „Fragebogen freigeben“ | **Fragebogen verfügbar** mit Frist im „Ihr Schritt“ |
| 7 | (Bewerber füllt aus, siehe UC 5) | Phase 02 · **Fragebogen eingereicht** |
| 8 | „Der Jury zuweisen“ → „Jury 1 starten“ | Phase 03 · **Auditsitzung der Jury**, keine Jury-Details sichtbar |
| 9 | (Jury stimmt ab, siehe UC 6) → „Übrige Stimmen simulieren“ → „Jury 2 starten“ → „Übrige Stimmen simulieren“ → „Juryprüfung abschließen“ | Phase 04 · **Entscheidung ausstehend** |
| 10 | „Einladung vorbereiten (intern)“ | weiterhin **Entscheidung ausstehend**: Die vorbereitete Einladung ist unsichtbar |
| 11 | „Einladung freigeben“ | **Einladung liegt vor**, „Einladung ansehen“ öffnet den Brief |
| 11b | alternativ „Keine Einladung“ | **Verfahren abgeschlossen**, neutral, ohne Gratulation |

Leitplanken (in der Verwaltung prüfen):
- ✓ „Fragebogen freigeben“ ist gesperrt, solange Prüfung, Zahlung oder **Frist** fehlen.
- ✓ „Jury 2 starten“ ist gesperrt, bis alle Jury-1-Stimmen da sind.
- ✓ Eine freigegebene Einladung zurückzunehmen fragt nach.

**Abkürzung:** Demo-Steuerung → **NEWEDGE-Szenario 1–8**. Das springt direkt in jeden dieser Zustände.

### UC 5: Fragebogen ausfüllen

1. Szenario **3 „Fragebogen freigegeben“** → „Fragebogen bearbeiten“.
   - ✓ Zuerst die **Preiswahl**, mehrere Preise sind möglich.
   - ✓ Roland-Berger-Zukunftspreis und Bavarian Future Award zeigen „Fragebogen folgt“.
2. Bayerischer Mittelstandspreis wählen → „Weiter zum Fragebogen“.
   - ✓ Kontaktdaten sind aus der Anmeldung übernommen.
3. Formate testen unter „Unternehmensdaten“:
   - Umsatz `12.5` → ✓ wird zu `12,5`.
   - `850.000` → ✓ Fehlermeldung, die Eingabe bleibt stehen.
   - `13,47` → ✓ Hinweis „eine Nachkommastelle“.
   - `6000` → ✓ Plausibilitätsmeldung.
4. „Zwischenspeichern“ → ✓ „Gespeichert“ mit Haken (mobil nur das Symbol).
5. Bis „Prüfen & einreichen“ → bei einem Abschnitt **„Ändern“** → ✓ Der Button heißt dann „Zurück zur Prüfung“.
6. Bestätigung anhaken → **„Fragebogen einreichen“** → ✓ Bestätigungsseite, danach Phase 02 · Fragebogen eingereicht.
7. Sonderfall Preislücke: In der Preiswahl **nur** Roland-Berger wählen.
   - ✓ Status „Fragebogen folgt“, keine Frist, kein „Ihr Schritt“.
   - ✓ „Preisauswahl ändern“ führt direkt zur Preiswahl.

### UC 6: Jury bewertet (zwei Jury-Arten)

1. Szenario **6 „Juryprüfung“** (oder UC 4 bis Schritt 8) → als `jury1@demo.bmp` anmelden.
   - ✓ Kopf: „Sie bewerten als Jurymitglied A · Jury 1 · Ersteinschätzung“.
   - ✓ Hinweis „Vertraulich“.
   - ✓ Nur die zugewiesenen Fragebögen, offene oben, „Ihre Bewertung: offen/abgegeben“.
2. „Fragebogen lesen“ → ✓ Antworten und gewählte Preise.
3. **Ja / Vielleicht / Nein** wählen → ✓ „Bewertung gespeichert“. Ein Punktefeld gibt es hier nicht.
4. Abmelden → als `jury2@demo.bmp` anmelden.
   - ✓ Nur das Punktefeld (1–10); solange Jury 2 nicht gestartet ist, steht dort „Die Punktevergabe beginnt …“.
5. Verwaltung: „Übrige Stimmen simulieren“ → „Jury 2 starten“ → als `jury2@demo.bmp` Punkte vergeben.
6. Gegenprobe: als Bewerber anmelden → ✓ keine Stimmen, Punkte oder Jury-Stufen sichtbar.
7. Ohne Jury-Zugang (Demo-Steuerung → „Jury“): ✓ Oben lässt sich wählen, als welches Mitglied Sie die Ansicht sehen.

### UC 7: Fremdnominierung durch die Phasen

1. Als Verwaltung → **Huber Holzbau KG** „Öffnen“ → Prüfung abschließen → Rechnung → Zahlung → Frist → Freigabe.
2. „Ansicht der vorschlagenden Person öffnen“ (oder als `vorschlag@demo.bmp` anmelden).
   - ✓ „Unternehmen informiert“.
   - ✓ Kein „Ihr Schritt“, keine Rechnung, kein Fragebogen.
   - ✓ Demo-Hinweise zur noch offenen Zuständigkeit.
3. Optional „Demo: als Unternehmen öffnen“ → ✓ Der Fragebogen aus Sicht des vorgeschlagenen Unternehmens.

### UC 8: Verwaltung – Übersicht und Steuerung

1. Als `verwaltung@demo.bmp` → Startseite **„Übersicht“**.
2. Oben die vier Phasen als Trichter:
   - ✓ Phase 01 „erst angemeldet“ mit Aufschlüsselung, z. B. „Neu 1 · In Prüfung 1“.
   - ✓ Phase 02 „im Fragebogenprozess“: Rechnung folgt / Rechnung offen / Freigabe offen / Fragebogen in Arbeit / eingereicht.
   - ✓ Phase 03 „in der Jury“: Zugewiesen / Jury 1 / Jury 2.
   - ✓ Phase 04 mit „eingeladen: …“, dazu Entscheidung offen / keine Einladung.
   - ✓ Ein Klick auf eine Phase filtert die Listen darunter.
3. **„Ihre Aufgaben“**: alle Vorgänge, bei denen die Verwaltung am Zug ist.
   - ✓ Schritte ohne weitere Eingaben direkt ausführbar: **„Rechnung stellen“**, **„Zahlung bestätigen“**, **„Der Jury zuweisen“**, **„Jury 1/2 starten“**, **„Juryprüfung abschließen“**.
   - ✓ Prüfung, Freigabe (braucht eine Frist) und Ergebnis über **„Vorgang öffnen“**.
4. **„Alle Vorgänge“**: Spalte „Fragebogen“ mit Status und „x von 29 Pflichtangaben“.
5. **Live ansehen:** bei „Fragebogen in Arbeit“ oder „eingereicht“ → **„Live ansehen“**.
   - ✓ Stand, Fortschritt, letzter Speicherzeitpunkt, alle Antworten.
   - Live-Test mit zwei Tabs:
     - Tab 1: Demo-Steuerung → „Verwaltung“, Fragebogen von NEWEDGE live öffnen.
     - Tab 2: Demo-Steuerung → „Bewerber“, im Fragebogen ein Feld ändern.
     - ✓ Tab 1 zeigt die Änderung ohne Neuladen.
6. Die übrigen Menüpunkte:
   - ✓ **Zahlungen**, **Fragebögen** und **Ergebnisse** zeigen standardmäßig nur offene Arbeit; „Erledigte einblenden“ zeigt den Rest.
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
   - ✓ Sechs Stufen: Vorbereitung → Anmeldung geöffnet → Anmeldung geschlossen → Fragebogenphase → Juryphase → Verfahren abgeschlossen.
   - ✓ Rechts „Was der Status bewirkt“: Neue Anmeldungen **möglich** oder **gesperrt**, dazu die Zahl der Anmeldungen und Entwürfe.
2. **„Anmeldung schließen“** → Rückfrage bestätigen.
   - ✓ Status „Anmeldung geschlossen“, Neue Anmeldungen **gesperrt**.
3. Als `unternehmer@demo.bmp` anmelden (oder Demo-Steuerung → „Bewerber“).
   - ✓ Hinweis, dass die Anmeldung derzeit geschlossen ist.
   - ✓ **„Neue Anmeldung“** ist gesperrt.
   - ✓ Ein vorher angelegter Entwurf lässt sich öffnen, aber nicht einreichen (Hinweis im Formular).
4. Zurück in der Verwaltung → **„Anmeldung wieder öffnen“** → ✓ wieder **möglich**.
5. **Anmeldeschluss** ändern → ✓ Bewerber sehen das neue Datum unter „Neue Anmeldung“.
6. **Standardfrist Fragebogen** setzen → ✓ Im Vorgang erscheint vor der Fragebogen-Freigabe **„Standardfrist übernehmen (…)“**.
7. „Status direkt setzen (Demo)“ springt in jede Stufe (nur für die Vorführung).

### UC 11: Exporte und Mailinglisten

1. Verwaltung → **„Exporte & Rechte“** → Abschnitt **Exporte**.
   - ✓ Neun Listen, jeweils mit Anzahl der Einträge: Alle Teilnehmenden · Phase 01 · Zahlungserinnerung · Erinnerung Fragebogen (mit Frist) · Eingeladene (Gala) · Ohne Einladung · Fehlende Gewinnerunterlagen · Vorschlagende Personen · Jury-Auswertung.
2. **„CSV herunterladen“** → ✓ Die Datei `bmp-2027_mailing_…_<Datum>.csv` wird gespeichert.
   - In Excel öffnen → ✓ Spalten Anrede, Vorname, Nachname, E-Mail, Unternehmen, Eingangsnummer, Art, Phase, Status; Umlaute korrekt.
3. **Jury-Auswertung** → ✓ Stimmen der Jury 1 (Ja / Vielleicht / Nein), Ø-Punkte der Jury 2 und Ergebnis je Fragebogen.
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

1. Verwaltung → **„Exporte & Rechte“** → Abschnitt **Rechte & Benutzer**.
   - ✓ Matrix „Rollen und Rechte“ für Verwaltung, Sachbearbeitung, Jury 1 und Jury 2.
   - ✓ „Interne Zugänge“: alle Konten der Geschäftsstelle und der Jury.
2. **Benutzer anlegen**: Name, E-Mail, Rolle (Verwaltung oder Sachbearbeitung) → „Anlegen“.
   - ✓ Ohne Angaben erscheinen Fehlermeldungen.
   - ✓ Der neue Zugang erscheint mit erzeugtem Passwort („Anzeigen“, „Neues Passwort“). Im Prototyp wird nichts versendet.
3. Abmelden → mit dem neuen Zugang (Rolle Sachbearbeitung) oder mit `sachbearbeitung@demo.bmp` anmelden.
   - ✓ Menü ohne **Runde**, **Jury** und **Ergebnisse**.
   - ✓ Im Vorgang sind Juryorganisation und Ergebnis **nur lesbar** („Nur lesen – für diesen Schritt fehlt Ihrer Rolle das Recht.“).
   - ✓ Unter „Exporte & Rechte“ nur die Exporte, keine Benutzerverwaltung.
4. Als Verwaltung beim neuen Zugang den Haken **„aktiv“** entfernen → abmelden → mit diesem Zugang anmelden.
   - ✓ Anmeldung abgelehnt: „Dieser Zugang ist deaktiviert …“.
5. Den eigenen Zugang können Sie weder deaktivieren noch in der Rolle ändern.

Jury-Zugänge verwalten Sie unter **Jury** (UC 9), nicht hier.

### UC 14: Bedienung, Mobil, Tastatur

- **Tastatur:** Tab durch die Kopfleiste → ✓ goldener Fokusrahmen.
- **Mappen:** Mappe öffnen und mit **Escape** oder **X** schließen → ✓ Der Fokus kehrt zum Button zurück.
- **Mobil (390 px):**
  - ✓ Im Vorgang steht der nächste Schritt oben.
  - ✓ Fußleisten sind einzeilig.
  - ✓ Die Verwaltung zeigt Karten.
  - ✓ Kein seitliches Scrollen.
- **Demo-Wechsel:** Als neues Konto angemeldet → Demo-Steuerung „Bewerber“ → ✓ Im Panel erscheint **„Zurück zu Ihrem Konto: …“**.

## 3. Bekannte Grenzen

- **Kein Backend.** Daten nur im Browser; ein anderer Browser oder ein privates Fenster hat eigene Daten.
- **Bewusst noch nicht gebaut:** der Sponsorenbereich (Konzept 04) und die Fragebögen für Roland-Berger-Zukunftspreis und Bavarian Future Award (Konzept 06).
- **Rechte** gelten nur in der Oberfläche. Es gibt keine echte Zugriffskontrolle.
- **Exporte** sind CSV-Dateien, die Excel öffnet; keine .xlsx. Das Portal versendet keine E-Mails.
- **Gewinnerunterlagen:** Dateien werden nicht hochgeladen, nur der Dateiname wird gespeichert.
- **Platzhalter:** Beträge, Rechnungs- und Einladungstexte, Liste der Gewinnerunterlagen.
- **Browser-Zurück/Vor über eine Dokumentgrenze** (z. B. Portal → „Zur Website“ → Zurück): Im Dev-Server kann das Portal kurz laden und lädt sich dann einmal selbst neu (Sicherheitsnetz, ca. 1,3 s).
