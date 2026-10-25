# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Unternehmer:innen** mittelständischer Unternehmen in Bayern, die ihr eigenes Unternehmen für den Bayerischen Mittelstandspreis (BMP) bewerben oder ein anderes Unternehmen vorschlagen.
- **Institutionen** (Verbände, Kammern, Hochschulen, Senatoren, Wirtschaftsbeirat, ehemalige Preisträger), die Unternehmen vorschlagen.
- **Privatpersonen**, die ein Unternehmen vorschlagen, das sie für preiswürdig halten.
- **Verwaltung / Geschäftsstelle**: prüft Anmeldungen, vermerkt Zahlungen, schaltet Fragebögen frei, organisiert die Jury und gibt Ergebnisse frei.
- **Jury**: bewertet intern in zwei Stufen (Jury 1: Ja/Vielleicht/Nein, Jury 2: Punkte).
- **Sponsoren & Partner**: eigener Basisbereich laut Konzept (nachgelagert, getrennt vom Bewerbungsprozess).

Alle drei Gruppen nutzen **einen gemeinsamen Zugang** und dürfen **beide Wege** gehen (Eigenbewerbung und Fremdnominierung).

## Product Purpose

Teilnehmerportal für Phase 1 (Bewerbungsphase) des BMP: Die **Kontoerstellung ist bewusst von der Bewerbung getrennt**. Wer sich registriert, muss noch nicht wissen, was er einreichen möchte. Kernablauf:

1. Anmelden oder Konto erstellen (ein Zugang für alle Gruppen)
2. Stammdaten vervollständigen (Person, Nutzergruppe, ggf. Organisation)
3. Bewerbungsart wählen: **Eigenbewerbung** (eigenes Unternehmen) oder **Fremdnominierung** (anderes Unternehmen)
4. Angaben prüfen und einreichen, Bestätigung, Rückkehr zum Portal

Erfolg: Ein Fremdnominierung gelingt mit wenigen öffentlich bekannten Angaben und einer kurzen Begründung; eine Eigenbewerbung darf mehr über das eigene Unternehmen verlangen. Die Struktur ist Grundlage für spätere Verwaltungsprozesse.

## Operating Context

- Teil der bestehenden BMP-Website (Next.js 16 + Payload CMS 3, SQLite), Sprache Deutsch.
- Fachliche Referenz: Draw.io-Konzept „10k Konzept“ (Phase A Anmeldung & Registrierung, Phase B Zahlung & Fragebogen, Phase C Jury 1/Jury 2, Menüstrukturen für Verwaltung, Unternehmen, Sponsor).
- **Verbindliches Vier-Phasen-Modell (Bewerbersicht):** 01 Anmeldung läuft → 02 Fragebogen wird freigeschaltet → 03 Auditsitzung der Jury → 04 Einladung zur Gala. Phase (A), Detailstatus (B) und nächste Handlung (C) werden getrennt dargestellt. Rechnung & Zahlung gehören zu Phase 02, Jury 1/2 sind interne Stufen von Phase 03.
- Die alte Darstellung der Website („Online-Einreichung → Formale Vorprüfung → Audit & Jury-Sitzung → Gala-Preisverleihung“) gilt für das Portal nicht.
- Teilnahmekriterien (Website): Standort Bayern, KMU-Größe, mindestens drei Geschäftsjahre am Markt, Privatwirtschaft.
- **Zahlung (Entscheidung 24.10.2026):** Die Teilnahme wird kostenpflichtig; das „kostenfrei“ der Website ist für das Portal überholt. Es gibt keine Bezahlabwicklung – die Verwaltung setzt einen Haken „Zahlung eingegangen“, danach wird der Fragebogen freigeschaltet.

## Capabilities and Constraints

- **Aktueller Stand: klickbarer UI-Prototyp.** Konten, Stammdaten, Vorgänge und ihr Prozesszustand liegen nur im Browser (localStorage); kein Backend, kein E-Mail-Versand, keine echte Authentifizierung oder Rechteverwaltung. Bewerber-, Verwaltungs- und Jury-Perspektive sowie acht NEWEDGE-Szenarien sind über eine gekennzeichnete Demo-Steuerung erreichbar. Zweck: Abstimmung mit dem Kunden, bevor das Backend gebaut wird.
- Der echte Bewerbungsfragebogen kommt vom Nutzer; die Fragen im Prototyp sind gekennzeichnete Platzhalter.
- Das bestehende anonyme Bewerbungsformular (Block `#bewerben` auf Startseite und Teilnahme-Seite) **läuft parallel weiter** und wird nicht verändert.
- Offen: Datenmodell im Payload-Backend, Passwort-Reset und E-Mail-Bestätigung, Rollen und Rechte, Fristen je Jahrgang, wer den Fragebogen bei Fremdnominierungen ausfüllt, Höhe und Text der Rechnung, Inhalt des Fragebogens, Jury-Punkteskala, Sponsorenbereich.

## Brand Commitments

- Name: „Der Bayerische Mittelstandspreis“ (BMP). Logo `public/bmp-logo.png` (weißes Wappen mit Rauten).
- Bestehende Website-Marke ist verbindlich: Navy `#111D55`, Gold `#EFBF04`, Blau `#24366A`, Anthrazit `#1A2030`; IBM Plex Sans (Überschriften, Labels) und Inter (Fließtext, Eingaben); eckige Formen.
- Kontakt: info@bmp-bayern.de

## Evidence on Hand

- Ablauf- und Kriterientexte, Formulartexte: `src/spa/participationContent.ts`
- Bilder: `public/images/` (Gala, Preisträger, Goldene Bavaria), Rautenmuster `public/rauten.webp`
- Keine echten Teilnehmerdaten, Fristen für den nächsten Jahrgang oder Statusangaben der Geschäftsstelle – im Prototyp nichts davon erfinden, Beispieldaten als solche kennzeichnen. NEWEDGE (BMP-L26GTL, 24.10.2026) ist der Referenz-Demovorgang; Datum und Eingangsnummer sind Demonstrationsdaten.

## Product Principles

1. Konto zuerst, Absicht später: Registrierung fragt nichts zur Einreichung.
2. Zwei Wege, klar getrennt: Eigenbewerbung darf ausführlich sein, Fremdnominierung muss leicht bleiben.
3. Einmal erfasst, überall genutzt: Stammdaten füllen Einreichungen vor.
4. Phase ist nicht Status: Jede Ansicht zeigt Hauptphase, Detailstatus und nächste Handlung getrennt – und ob der Bewerber handeln oder warten muss.
5. Vertraulichkeit: Jurybewertungen, Notizen und intern vorbereitete Ergebnisse erscheinen nie in der Bewerberansicht.

## Accessibility & Inclusion

Breites, teils älteres Unternehmerpublikum: gut lesbare Schriftgrößen (mind. 16px in Eingaben), sichtbare Labels, Tastaturbedienung, Kontrast nach WCAG AA.
