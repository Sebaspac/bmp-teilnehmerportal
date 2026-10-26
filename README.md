# BMP Teilnehmerportal

Teilnehmerportal des Bayerischen Mittelstandspreises: Anmeldung, Fremdnominierung, Rechnung, Bewerbung (je Preis ein Fragebogen plus sechs Unterlagen), Juryverfahren in zwei Stufen, Einladung zur Gala und die Verwaltung der Geschäftsstelle – auslieferbar in drei Ausbaustufen.

**Stand:** klickbarer Prototyp mit allen Ansichten (Bewerber, Verwaltung, Sachbearbeitung, Jury) in den Ausbaustufen A, A + B, A + B + C und Gesamt. Die Daten liegen im Browser (localStorage), es gibt noch kein Backend. Der Code ist so aufgebaut, dass ein Backend hinter ein festes Interface kommt und dieselben Geschäftsregeln serverseitig nutzt – an den Oberflächen-Komponenten muss dafür nichts geändert werden.

| Dokument | Inhalt |
|---|---|
| [docs/teilnehmerportal-backend.md](docs/teilnehmerportal-backend.md) | **Übergabe an die Backend-Entwicklung:** Datenmodell, API-Vertrag, Befehle, Rollen, Zustandsmodell, Sichtbarkeit, offene Entscheidungen |
| [docs/testanleitung.md](docs/testanleitung.md) | Testzugänge und Use Cases zum Durchklicken |
| [PRODUCT.md](PRODUCT.md) | Nutzergruppen, Zweck und Gestaltungsprinzipien |

## Starten

Voraussetzungen: Node.js 22 oder neuer, pnpm 10.

```bash
pnpm install
```

```bash
pnpm dev
```

Dann http://localhost:3000/portal öffnen. Testzugänge stehen auf der Login-Seite („Testzugänge“) und in der Testanleitung. Unten in der Seitenleiste öffnet „Demo-Steuerung“ die Ausbaustufe, den Perspektivwechsel und die NEWEDGE-Szenarien.

### Ausbaustufen

Das Portal geht in Teilen live. Die Stufe ist eine Einstellung (Datei `.env.local` oder Umgebung des Deployments):

```bash
NEXT_PUBLIC_PORTAL_STAGE=a
```

| Wert | Stufe | Enthält |
|---|---|---|
| `a` | Phase A | Konto, Stammdaten, Anmeldung einreichen, Prüfung durch die Verwaltung |
| `ab` | Phase A + B | + Rechnung & Zahlung, Fragebögen der drei Preise (Verwaltung bearbeitet und schaltet frei), sechs Unterlagen |
| `abc` | Phase A + B + C | + Jury 1/2, Jury-Dashboard, Ergebnis und Einladung |
| `gesamt` (Standard) | Gesamt | + Gewinnerunterlagen |

Runde, Exporte sowie Rechte & Benutzer gibt es in jeder Stufe, jeweils mit dem, was zur Stufe gehört. Alles Weitere: `src/portal/domain/release.ts` und Abschnitt 3 der Übergabe.

| Befehl | Wirkung |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` / `pnpm start` | Produktions-Build bauen und starten |
| `pnpm typecheck` | TypeScript prüfen |
| `pnpm test` | Unit-Tests der Geschäftsregeln (ohne Browser, ca. 1 s) |
| `pnpm test:e2e` | Browser-Tests (Playwright, 26 Tests, ca. 1 min) |

## Aufbau

```
src/portal/
  domain/     Reines TypeScript: Typen, Regeln, Rechte, Sichtbarkeit. Läuft im Browser und auf dem Server.
  data/       Anbindung an die Datenhaltung – austauschbar hinter einem Interface.
  ui/         React-Komponenten. Lesen über usePortalSnapshot(), schreiben über runCommand().
  content/    Alle Texte der Oberfläche.
src/app/portal/  Next.js-Route /portal (eine Seite, Routing innerhalb des Portals)
src/shared/      Kleine Hilfen aus dem Website-Projekt (E-Mail-Prüfung, Bild)
tests/int/       Unit-Tests der Domäne (Vitest)
tests/e2e/       Browser-Tests (Playwright), Hilfen in tests/helpers/portal.ts
```

Abhängigkeiten zeigen nur nach unten: `ui → data → domain`, `ui → domain`, alle → `content`. Die Domäne kennt weder React noch Browser-APIs.

| Datei | Aufgabe |
|---|---|
| `domain/types.ts` | Datenmodell: alle Entitäten, Statuswerte und Anfangswerte |
| `domain/release.ts` | **Ausbaustufen**: Bausteine je Stufe, `hasFeature`, `parseStage` |
| `domain/commands.ts` | **Alle Schreibaktionen** als Befehle: wer darf (`authorize`), wann (Voraussetzungen), was ändert sich |
| `domain/permissions.ts` | Rollen, Rechte, `Actor` (wer handelt) |
| `domain/visibility.ts` | Was jede Rolle sehen darf (`visibleTo`) |
| `domain/process.ts` | Ableitungen: Phase, Status und nächster Schritt für Bewerber und Verwaltung, Bezeichnungen |
| `domain/selectors.ts` | Lesehilfen (Listen, Firmenname, Sitzung, Rundenstatus) |
| `domain/registration.ts` | Prüfregeln der Anmeldung |
| `domain/questionnaire.ts` | Fragebögen der Preise: Ausgangsfassungen, Preise, Prüfregeln je Antwortformat, Regeln für die Bearbeitung (`definitionProblem`, `sameStructure`) |
| `domain/application.ts` | Bewerbung: die sechs Unterlagen, erlaubte Formate, `applicationProgress` (wann ist die Bewerbung vollständig?) |
| `domain/exports.ts` | CSV-Exporte und Mailinglisten |
| `domain/seed.ts` | Nur Prototyp: Demo-Daten, Testzugänge, Szenarien |
| `data/backend.ts` | **Vertrag** `PortalBackend` (Snapshot lesen, Befehle ausführen, Anmeldung) und `DemoControls` |
| `data/portalClient.ts` | Wählt das Backend, Hooks für React, Fehlerhinweise |
| `data/mockBackend.ts` | Nur Prototyp: Backend im Browser (localStorage), nutzt `domain/commands.ts` |
| `data/httpBackend.ts` | Vorlage für das echte Backend (HTTP gegen `/api/portal/…`) |
| `ui/PortalApp.tsx` | Einstieg: Routing, Perspektiven, Filterung nach Rolle, Demo-Steuerung |
| `ui/AppShell.tsx` | App-Rahmen: Seitenleiste mit den Bereichen der Rolle (mobil Schublade), `PageHeader` für Listenansichten |
| `ui/Page.tsx` | Detailseite mit „Zurück zur …“, Titel, Zusatzzeile, optionaler Schrittleiste (`Steps`) und Aktionsleiste |
| `ui/*Sheet.tsx` | Detailseiten (Anmeldung, Vorgang, Preiswahl, Fragebogen je Preis, Stammdaten, Verwaltung) – alle auf `Page` |
| `ui/ApplicationView.tsx` | Bausteine der Bewerbung: Unterlagen hochladen bzw. lesen, Fragebögen als Zusammenfassung |
| `ui/QuestionnaireAdmin.tsx` | Verwaltung: Fragebögen der Preise (Liste, Editor mit Vorschau, Freischalten) |
| `ui/AdminView.tsx`, `ui/AdminAreas.tsx`, `ui/JuryAdmin.tsx` | Verwaltung: Übersicht, Listen, Vorgang, Runde, Exporte, Rechte, Jury |
| `ui/JuryView.tsx` | Juryansicht |

### Datenfluss

1. `usePortalSnapshot()` liefert den Stand. `PortalApp` filtert ihn mit `visibleTo` für die angemeldete Person und reicht ihn als `state` an die Ansichten weiter.
2. Eine Komponente ruft `runCommand({ type: 'payment.confirm', submissionId })`.
3. Das Backend prüft mit `authorize` und `applyCommand` (beides `domain/commands.ts`), speichert und meldet den neuen Stand.
4. Lehnt es ab, zeigt `CommandErrorNotice` die Begründung. Wer den Fehler selbst behandeln will (z. B. „E-Mail vergeben“ am Feld), nimmt `sendCommand`.

## Erweitern

**Neue Aktion**
1. Befehl in `PortalCommand` ergänzen (`domain/commands.ts`).
2. In `COMMAND_SPEC` eintragen, wer ihn auslösen darf, mit welchem Recht und ab welcher Ausbaustufe (`feature`).
3. In `apply` Voraussetzungen und Wirkung beschreiben (für Vorgänge mit `changeProcess`, das schreibt auch den Verlauf).
4. Test in `tests/int/portal-domain.int.spec.ts` ergänzen.
5. In der Oberfläche `runCommand({ type: … })` aufrufen. Buttons mit derselben Bedingung sperren, mit der der Befehl ablehnt.

**Neues Feld**
1. Typ und Anfangswert in `domain/types.ts`.
2. Ist es vertraulich? Dann in `domain/visibility.ts` für Rollen ohne Einsicht entfernen.
3. Muss es geprüft werden? Dann in `domain/registration.ts` bzw. im Befehl.
4. Oberfläche und, falls nötig, Export (`domain/exports.ts`).

**Neue Ansicht oder neuer Verwaltungsbereich**
1. Komponente in `ui/`, Texte in `content/portalContent.ts`. Listen beginnen mit `PageHeader`, Details nutzen `Page` – keine Overlays, keine Box in der Box: Abschnitte stehen auf einer weißen Fläche mit Trennlinien.
2. Route in `parseRoute` (`ui/PortalApp.tsx`). Ein Verwaltungsbereich ist ein Eintrag in `portalContent.admin.tabs` (mit `section`) und erscheint damit in der Seitenleiste; Symbol in `AREA_ICONS`, offene Arbeit in `areaCounts`.
3. Sichtbarkeit über `can(viewer, recht)` aus `domain/permissions.ts`.

**Neues Recht oder neue Rolle**: `domain/permissions.ts` (`ROLE_PERMISSIONS`, Stufe in `PERMISSION_FEATURE` bzw. `ROLE_FEATURE`). Die Rechte-Matrix unter „Rechte & Benutzer“ zeigt die Änderung automatisch.

**Funktion einer Ausbaustufe zuordnen**: Baustein aus `Feature` (`domain/release.ts`) wählen. Befehle tragen ihn in `COMMAND_SPEC`, Verwaltungsbereiche in `TAB_FEATURE` (`ui/AdminView.tsx`), Exporte in `EXPORTS`. In Komponenten mit `hasFeature(useStage(), 'jury')` ein- oder ausblenden; Status und nächste Schritte bekommen die Stufe über `useProcessContext()`.

**Frage zu einem Fragebogen**: Die Geschäftsstelle pflegt die Fragen in der Oberfläche (Verwaltung → Fragebögen). Im Code ändert man nur die Ausgangsfassung in `SEED_QUESTIONNAIRES` (`domain/questionnaire.ts`).

### Regeln

- Komponenten ändern nie Daten direkt und importieren weder `mockBackend` noch `fetch` – nur `data/portalClient.ts`.
- Geschäftsregeln gehören in `domain/`, nicht in Komponenten. Komponenten dürfen Regeln zur Anzeige abfragen (`canRelease`, `juryProgress`, `adminNext` …).
- Alles, was nur dem Prototyp dient, ist als „Nur Prototyp“ kommentiert und hängt an `portalDemo` (ohne Mock `null`).
- Texte stehen in `content/portalContent.ts`. Ausnahme: Bezeichnungen von Statuswerten in `domain/process.ts`, weil Exporte und Verlauf sie auch serverseitig brauchen.

## Backend anschließen

1. Endpunkte nach [docs/teilnehmerportal-backend.md](docs/teilnehmerportal-backend.md) umsetzen; im Route Handler `executeCommand` (mit `stage` aus `NEXT_PUBLIC_PORTAL_STAGE`) und `visibleTo` aus `src/portal/domain/` verwenden.
2. `NEXT_PUBLIC_PORTAL_BACKEND=http` setzen. Die Oberfläche nutzt dann `data/httpBackend.ts`, die Demo-Steuerung verschwindet.
3. Datei-Speicher für die sechs Bewerbungsunterlagen und die Gewinnerunterlagen anbinden (Abschnitt 11 der Übergabe).
4. Prototyp-Teile entfernen (Liste in der Übergabe, Abschnitt 12).

Das Portal kann eigenständig bleiben oder in das Website-Projekt (`bmp-website-2026-neu`, Payload CMS) übernommen werden – beide Wege beschreibt die Übergabe in Abschnitt 5.

## Tests

**Geschäftsregeln:** `pnpm test` – Ablauf eines Vorgangs, Bewerbung mit mehreren Preisen und Unterlagen, Fragebögen der Preise, Ausbaustufen, Rechte, Sichtbarkeit (`tests/int/portal-domain.int.spec.ts`, 19 Tests).

**Oberfläche:** einmalig den Browser installieren, dann `pnpm test:e2e`. Ein laufender Dev-Server wird mitbenutzt, sonst startet die Konfiguration `pnpm dev` (Port über `PORT`, Standard 3000).

```bash
pnpm exec playwright install chromium
```

| Datei (`tests/e2e/`) | Prüft |
|---|---|
| `anmeldung.e2e.spec.ts` | Testzugänge führen in ihre Ansicht, falsches Passwort, Abmelden |
| `ablauf.e2e.spec.ts` | NEWEDGE durch alle vier Phasen: zwei Preise, zwei Fragebögen, sechs Unterlagen (auch abgelehntes Format), Jury, Bewerbersicht nach jedem Schritt; Registrierung mit Fremdnominierung; Filter; mobil |
| `jury.e2e.spec.ts` | Jury-Dashboard, Mitglied anlegen und zuweisen, beide Jury-Arten bewerten (Desktop und mobil) |
| `verwaltung.e2e.spec.ts` | Trichter, Schnellaktionen, Live-Ansicht einer Bewerbung über zwei Tabs |
| `bereiche.e2e.spec.ts` | Runde, CSV-Exporte (Dateiinhalt), Rechte und Sachbearbeitung, Gewinnerunterlagen, Hinweis bei abgelehnter Aktion |
| `stufen.e2e.spec.ts` | Ausbaustufen A und A + B (Bereiche, Vorgang, Bewerbersicht), Fragebogen-Editor (bearbeiten, Vorschau, freischalten, danach nur Texte), Jury sieht alle sechs Unterlagen |

Jeder Test startet mit frischen Demo-Daten (eigener Browserkontext) und scheitert bei Fehlern in der Browserkonsole. Die Tests nutzen die Demo-Steuerung; für das echte Backend brauchen sie Testdaten in der Datenbank und Logins statt Perspektivwechsel.
