# Teilnehmerportal – Übergabe an die Backend-Entwicklung

Stand: Oktober 2026 · Code: `src/portal/` (Einstieg: [README](../README.md)) · Route: `/portal`

Das Teilnehmerportal ist als klickbarer Prototyp fertig: alle Ansichten (Bewerber, Verwaltung, Sachbearbeitung, Jury), der komplette Ablauf in vier Phasen und alle Verwaltungsbereiche – in drei Ausbaustufen plus Gesamtversion (Abschnitt 3), mit je einem Fragebogen pro Preis, den die Verwaltung bearbeitet und freischaltet, und sechs Bewerbungsunterlagen je Unternehmen. Die Daten liegen heute im Browser (localStorage). Der Code ist so aufgebaut, dass das Backend **hinter ein festes Interface** kommt und **dieselben Geschäftsregeln** serverseitig verwendet. An den Oberflächen-Komponenten muss dafür nichts geändert werden.

## 1. Was schon fertig ist und was das Backend liefern muss

| Fertig im Frontend (wiederverwendbar) | Aufgabe Backend |
|---|---|
| Datenmodell als TypeScript-Typen (`domain/types.ts`) | Persistenz, z. B. Payload-Collections (Vorschlag in Abschnitt 5) |
| Alle Schreibaktionen als Befehle mit Rechte- und Zustandsprüfung (`domain/commands.ts`) | Route Handler, der `executeCommand` serverseitig aufruft und speichert |
| Sichtbarkeitsregeln je Rolle (`domain/visibility.ts`) | Jede Antwort mit `visibleTo` filtern |
| Prüfregeln für Anmeldung, Fragebögen und Dateien (`domain/registration.ts`, `domain/questionnaire.ts`, `domain/application.ts`) | – (laufen in `executeCommand` mit) |
| Ausbaustufen als Konfiguration (`domain/release.ts`), von Oberfläche und Befehlen geprüft | `NEXT_PUBLIC_PORTAL_STAGE` je Deployment setzen und `stage` im Befehlskontext mitgeben |
| HTTP-Client gegen die Endpunkte in Abschnitt 6 (`data/httpBackend.ts`) | Endpunkte umsetzen, Sitzung per HttpOnly-Cookie |
| CSV-Exporte als reine Funktionen (`domain/exports.ts`) | optional serverseitig ausliefern |
| – | Authentifizierung, Passwort-Reset, Einladungslinks |
| – | E-Mails (Abschnitt 10), Datei-Speicher für Bewerbungs- und Gewinnerunterlagen (Abschnitt 11) |
| Unit-Tests der Regeln (`tests/int/portal-domain.int.spec.ts`) und Browser-Tests der Oberfläche (`tests/e2e/`, `pnpm test:e2e`) | Tests für Persistenz und Endpunkte; Browser-Tests auf Testdaten statt Demo-Steuerung umstellen |

Umschalten auf das echte Backend: `NEXT_PUBLIC_PORTAL_BACKEND=http` setzen. Dann nutzt die Oberfläche `data/httpBackend.ts`, und die Demo-Steuerung verschwindet.

## 2. Architektur

```
 Browser                                                     Server (Next.js, gleiches Projekt)
┌──────────────────────────────────────────────┐            ┌─────────────────────────────────────────────┐
│ ui/ (React-Komponenten)                      │            │ app/api/portal/… (Route Handler)            │
│   liest  usePortalSnapshot()                 │            │   Sitzung → Actor (actorOf)                  │
│   schreibt runCommand({ type: … })           │            │   executeCommand(data, actor, command, ctx)  │
│        │                                     │            │   speichern, was `changed` nennt             │
│ data/portalClient.ts ── wählt das Backend    │            │   Antwort: visibleTo(data, actor)            │
│   ├─ mockBackend.ts  (heute, localStorage)   │   HTTP     │        │                                     │
│   └─ httpBackend.ts  (später) ───────────────┼──────────▶ │        ▼                                     │
│                                              │            │ Payload-Collections / Datenbank             │
└──────────────────────────────────────────────┘            └─────────────────────────────────────────────┘
              domain/ (Typen, Regeln, Rechte, Sichtbarkeit) – identisch in Browser und Server
```

Grundsätze:

- **Eine Quelle für Regeln.** Was erlaubt ist, steht nur in `domain/commands.ts`. Die Oberfläche sperrt Buttons zur Orientierung, verbindlich ist die Prüfung im Befehl.
- **Lesen als Snapshot, Schreiben als Befehl.** Der Client erhält, was die angemeldete Person sehen darf, und schickt benannte Befehle, nie freie Datenänderungen.
- **Der Akteur kommt vom Server.** Rolle und Konto-ID stammen aus der Sitzung, nie aus der Anfrage.

## 3. Ausbaustufen

Das Portal geht in Teilen live. Welche Stufe läuft, ist eine Einstellung des Deployments: `NEXT_PUBLIC_PORTAL_STAGE` = `a` | `ab` | `abc` | `gesamt` (Standard `gesamt`). Im Prototyp lässt sich die Stufe zusätzlich in der Demo-Steuerung umschalten.

| Stufe | Enthält | Verwaltungsbereiche |
|---|---|---|
| `a` – Phase A | Konto, Stammdaten, Anmeldung einreichen, Prüfung durch die Verwaltung | Übersicht, Anmeldungen, Runde, Exporte, Rechte & Benutzer |
| `ab` – Phase A + B | + Rechnung & Zahlung, Preiswahl, Fragebögen je Preis (bearbeiten, freischalten, ausfüllen), sechs Unterlagen | + Zahlungen, Bewerbungen, Fragebögen |
| `abc` – Phase A + B + C | + Jury 1 und Jury 2, Jury-Dashboard, Ergebnis und Einladung | + Jury, Ergebnisse |
| `gesamt` | + Gewinnerunterlagen & Medienstatus | + Gewinnerunterlagen |

Alles hängt an einer Datei, `domain/release.ts`:

- `Feature` (`anmeldung`, `bewerbung`, `jury`, `gewinnerunterlagen`) und `FEATURE_STAGE` – ab welcher Stufe ein Baustein dabei ist; `hasFeature(stage, feature)` fragt ab.
- Jeder Befehl trägt in `COMMAND_SPEC` seinen Baustein. `applyCommand` lehnt Befehle außerhalb der Stufe mit `unavailable` ab – das Backend muss nur `stage` im `CommandContext` setzen.
- Oberfläche: Bereiche (`TAB_FEATURE` in `ui/AdminView.tsx`), Rechte und Rollen (`PERMISSION_FEATURE`, `ROLE_FEATURE`), Rundenstatus (`ROUND_FEATURE`), Exporte (`EXPORTS[…].feature`), Phasen (`phasesIn`) und Hilfetexte richten sich nach der Stufe. `applicantView` und `adminNext` bekommen sie über den `ProcessContext`: In Stufe A endet die Bewerbersicht nach der Prüfung mit „Anmeldung geprüft“, in A + B mit „Bewerbung eingereicht“.
- In React liefert `useStage()` bzw. `useProcessContext()` (`data/portalClient.ts`) die gültige Stufe.

Neue Funktion für eine Stufe: Baustein wählen (oder in `Feature` ergänzen), Befehl in `COMMAND_SPEC` mit `feature` eintragen, in der Oberfläche mit `hasFeature` einblenden.

## 4. Datenmodell

Alle Typen: `src/portal/domain/types.ts`. Statuswerte sind deutsche Schlüssel (so stehen sie auch in Exporten und im Verlauf).

```
Account 1 ─── n Submission            (Eigentümer; bei Fremdnominierung die vorschlagende Person)
Account 1 ─── 0..1 Juror               (nur Konten mit role = 'jury')
QuestionnaireDefinition (3, je Preis) Fragebogen eines Preises: Abschnitte, Fragen, Status entwurf/freigeschaltet
Submission.process.prizes             gewählte Preise
Submission.process.questionnaires     je Preis Antworten + Stand (in_bearbeitung / eingereicht)
Submission.process.applicationDocs    sechs Unterlagen (Datei je Platz)
Submission.process.assigned.{jury1,jury2} ─── n Juror (IDs)
Submission.process.jury1 / jury2      Bewertungen je Juror-ID (vertraulich)
Round (Singleton)                     Status + Einstellungen der Wettbewerbsrunde
```

| Entität | Wichtige Felder | Hinweise |
|---|---|---|
| `Account` | `email` (eindeutig, klein geschrieben), `role?` (`verwaltung`, `sachbearbeitung`, `jury`, ohne = Bewerber), `active?`, `jurorId?`, `profile` | `passwordHash`, `demoPassword`, `demo` sind **nur Prototyp** und entfallen |
| `Profile` | Anrede, Vor-/Nachname, Telefon, `group` (`unternehmer`, `institution`, `privatperson`), Organisation | `completedAt`, sobald vollständig (`isProfileComplete`) |
| `Juror` | `name`, `email`, `type` (`jury1` Ja/Vielleicht/Nein, `jury2` Punkte 1–10), `accountId` | Jury-Art nur ohne Zuweisungen änderbar |
| `Submission` | `type` (`eigenbewerbung`, `fremdvorschlag`), `status` (`entwurf`, `eingereicht`), `self` bzw. `nomination`, `reference` (Eingangsnummer, entsteht beim Einreichen), `process` | Entwurfs-ID erzeugt der Client (UUID, Idempotenzschlüssel) |
| `ProcessState` | `review`, `payment`, `application`, `deadline`, `prizes`, `questionnaires`, `applicationDocs`, `applicationCompletedAt?`, `jury`, `assigned`, `jury1`, `jury2`, `result`, `documents?`, `log` | siehe Zustandsmodell (Abschnitt 8) |
| `PrizeQuestionnaire` | `status` (`in_bearbeitung`, `eingereicht`), `answers`, `step`, `savedAt?`, `submittedAt?` | je Preis in `process.questionnaires`; Einträge abgewählter Preise bleiben als Entwurf, zählen aber nicht |
| `UploadedFile` | `fileName`, `size`, `uploadedAt` | Prototyp ohne Datei; im echten System zusätzlich die Referenz auf die gespeicherte Datei |
| `QuestionnaireDefinition` | `prize` (`bmp`, `roland_berger`, `future_award`), `status` (`entwurf`, `freigeschaltet`), `sections`, `updatedAt`, `releasedAt?` | `PortalData.questionnaires`; Abschnitte und Fragen: Typen `QuestionSection`, `QuestionField` |
| `RoundSettings` | `registrationDeadline`, `questionnaireDeadline` (YYYY-MM-DD) | zusammen mit `round` (Status) ein Singleton |

Fragebögen: Die gültige Fassung steht im Bestand (`PortalData.questionnaires`) und wird von der Verwaltung bearbeitet. Die Ausgangsfassungen liefert `domain/questionnaire.ts` (`SEED_QUESTIONNAIRES`: der BMP-Fragebogen, für Roland-Berger-Zukunftspreis und Bavarian Future Award Platzhalter). Antworten werden je Preis als `Record<Feld-ID, string>` gespeichert; geprüft wird gegen die Fassung des Preises (`validateSection`).

Bewerbungsunterlagen: sechs feste Plätze (`APPLICATION_DOCS` in `domain/application.ts`, Bezeichnungen sind Platzhalter). Jeder Platz nimmt PDF, Word, Excel, PowerPoint, OpenDocument und Bilder bis 25 MB an (`checkUpload`).

Die Bewerbung ist **vollständig**, wenn für jeden gewählten Preis der Fragebogen eingereicht ist und alle sechs Unterlagen vorliegen (`applicationProgress`). Dann setzen die Befehle `application` auf `eingereicht` – ohne eigenen „Einreichen“-Befehl.

## 5. Vorschlag: Umsetzung mit Payload

Das Website-Projekt der BMP (Repo `bmp-website-2026-neu`) nutzt Payload 3. Zwei Wege sind möglich:

- **Portal in die Website übernehmen** (`src/portal` → dort `src/spa/portal`, Route `src/app/(frontend)/portal`) und Payload als Backend nutzen – Vorschlag unten.
- **Eigenständig in diesem Repo** mit eigenen Route Handlern und eigener Datenbank. Die Collections unten gelten dann sinngemäß als Tabellen.

Vorschlag für Payload (keine Vorgabe):

| Collection / Global | Inhalt | Zugriff |
|---|---|---|
| `portal-accounts` (eigene Auth-Collection, `auth: true`) | Account + Profile, Feld `role`, `active` | getrennt von `users` (CMS-Redaktion) |
| `portal-jurors` | Juror, Relation zu `portal-accounts` | Verwaltung |
| `portal-submissions` | Submission inkl. `process` als Group, `questionnaires` als JSON, `reference` mit Unique-Index | Eigentümer, Verwaltung; Jury nur zugewiesene (über die API) |
| `portal-questionnaires` | je Preis eine `QuestionnaireDefinition` (`sections` als JSON), Unique auf `prize` | lesen alle (Entwürfe nur Verwaltung), schreiben Verwaltung |
| `portal-evaluations` *(empfohlen)* | je Bewertung ein Datensatz: Vorgang, Juror, `vote` oder `points` | statt der Maps `jury1`/`jury2`, siehe Nebenläufigkeit |
| `portal-log` *(optional)* | Verlauf append-only: Vorgang, Zeit, Text, Konto | nur Verwaltung |
| `portal-uploads` | Bewerbungsunterlagen (sechs je Vorgang) und Gewinnerunterlagen (Logo, Pressefoto) | **privat**, nicht die öffentliche `media`-Collection; lesen Eigentümer, Verwaltung und zugewiesene Jury |
| Global `portal-round` | `status`, `registrationDeadline`, `questionnaireDeadline` | lesen alle, schreiben Verwaltung |

Achtung, Namensgleichheit im Website-Projekt: Die vorhandene Collection `jury-mitglieder` ist die **öffentliche Jury-Vorstellung auf der Website**, nicht die Jurymitglieder des Portals. `application-submissions` ist das bisherige Website-Formular.

**Nebenläufigkeit:** `executeCommand` liest einen Vorgang, ändert ihn und gibt ihn zurück. Bewerten zwei Jurymitglieder gleichzeitig denselben Vorgang, darf keine Stimme verloren gehen. Entweder Bewertungen als eigene Datensätze speichern (empfohlen) oder beim Speichern auf `updatedAt` prüfen (optimistisches Sperren) und bei Konflikt mit 409 antworten.

## 6. API-Vertrag

Der Client (`data/httpBackend.ts`) erwartet diese Endpunkte. Sitzung per HttpOnly-Cookie, alle Antworten JSON.

| Methode und Pfad | Anfrage | Antwort |
|---|---|---|
| `GET /api/portal/snapshot` | – | `200` `PortalSnapshot` = `{ ...visibleTo(data, actor), sessionAccountId }` |
| `POST /api/portal/auth/register` | `{ email, password }` | `201` · `409` E-Mail vergeben |
| `POST /api/portal/auth/login` | `{ email, password }` | `200` · `401` falsch · `403` deaktiviert |
| `POST /api/portal/auth/logout` | – | `204` |
| `POST /api/portal/commands` | ein `PortalCommand` | `200 { result }` · Fehler `{ error: { code, message, field? } }` |

Fehlercodes aus `CommandError.code` auf HTTP-Status: `unauthenticated` → 401, `forbidden` → 403, `not_found` → 404, `unavailable` → 404 (außerhalb der Ausbaustufe), `conflict` → 409, `invalid_state` → 409, `invalid_input` → 422. Die `message` ist deutsch und wird der Person direkt angezeigt; `field` markiert das betroffene Formularfeld.

Beispiel für den Befehls-Endpunkt (Skizze, nicht im Projekt angelegt):

```ts
// src/app/api/portal/commands/route.ts
import { executeCommand, type CommandErrorCode } from '@/portal/domain/commands'
import { actorOf } from '@/portal/domain/permissions'

const STATUS: Record<CommandErrorCode, number> = {
  unauthenticated: 401, forbidden: 403, not_found: 404, unavailable: 404, conflict: 409, invalid_state: 409, invalid_input: 422,
}

export async function POST(request: Request) {
  const session = await getPortalSession(request)          // Payload-Auth: Konto aus dem Cookie
  const command = parsePortalCommand(await request.json())   // Form prüfen (z. B. zod) – nie dem Client vertrauen
  const data = await loadPortalData(command)                 // betroffene Datensätze als PortalData
  const outcome = executeCommand(data, actorOf(data, session?.accountId), command, serverContext)
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: STATUS[outcome.error.code] })
  await savePortalData(outcome.data, outcome.changed)        // nur geänderte Datensätze, in einer Transaktion
  await notifyFor(command, outcome)                          // E-Mails, Abschnitt 10
  return Response.json({ result: outcome.result ?? null })
}
```

`serverContext` liefert `now`, `newId`, `newReference` (Eingangsnummer: eindeutig, z. B. `BMP-` + 6 Zeichen ohne verwechselbare Zeichen) und `stage` (aus `NEXT_PUBLIC_PORTAL_STAGE`, `parseStage`). `newPassword` bleibt im echten System leer; neue Zugänge bekommen einen Einladungslink.

Was `loadPortalData` je Befehl braucht: Vorgangsbefehle brauchen den Vorgang, die Jurymitglieder (`jury.*`), die Runde (`draft.create`, `draft.submit`) und die Fragebögen der Preise (`questionnaire.*`, `application.*`). `questionnaireDef.withdraw` braucht zusätzlich alle Vorgänge (oder eine Abfrage „hat jemand begonnen?“). Zugangsbefehle brauchen die Konten.

Hochladen (`application.uploadDoc`): Die Datei geht zuerst an einen eigenen Upload-Endpunkt (privater Speicher, Prüfung von Format und Größe mit `checkUpload`), danach trägt der Befehl die Referenz am Platz ein. Im Prototyp schickt der Befehl nur Name und Größe. Die Eindeutigkeit der E-Mail sollte zusätzlich ein Unique-Index absichern.

## 7. Befehle

Erzeugt aus `COMMAND_SPEC` in `domain/commands.ts`. „Ab Stufe“: A = Anmeldung, B = Bewerbung, C = Jury und Ergebnis (Abschnitt 3).

| Befehl | Wer | Recht | Ab Stufe | Wirkung |
|---|---|---|---|---|
| `profile.save` | eigenes Konto | – | A | Eigene Stammdaten speichern |
| `draft.create` | Bewerber (eigener Vorgang) | – | A | Entwurf einer Anmeldung anlegen (nur bei offener Anmeldung) |
| `draft.update` | Bewerber (eigener Vorgang) | – | A | Eigenen Entwurf zwischenspeichern |
| `draft.submit` | Bewerber (eigener Vorgang) | – | A | Eigene Anmeldung einreichen – vergibt die Eingangsnummer |
| `draft.discard` | Bewerber (eigener Vorgang) | – | A | Eigenen Entwurf verwerfen |
| `application.setPrizes` | Bewerber (eigener Vorgang) | – | B | Preise wählen, für die sich das Unternehmen bewirbt |
| `questionnaire.save` | Bewerber (eigener Vorgang) | – | B | Fragebogen eines Preises zwischenspeichern |
| `questionnaire.submit` | Bewerber (eigener Vorgang) | – | B | Fragebogen eines Preises einreichen |
| `application.uploadDoc` | Bewerber (eigener Vorgang) | – | B | Bewerbungsunterlage hochladen oder austauschen |
| `documents.submit` | Bewerber (eigener Vorgang) | – | Gesamt | Gewinnerunterlage einreichen |
| `review.set` | Geschäftsstelle | `review` | A | Anmeldung prüfen: in Prüfung, Rückfrage, geprüft |
| `payment.invoice` | Geschäftsstelle | `payment` | B | Rechnung als gestellt markieren |
| `payment.confirm` | Geschäftsstelle | `payment` | B | Zahlungseingang vermerken |
| `application.setDeadline` | Geschäftsstelle | `release` | B | Frist für die Bewerbung setzen oder entfernen |
| `application.release` | Geschäftsstelle | `release` | B | Bewerbung freigeben (Fragebögen und Unterlagen) |
| `questionnaireDef.update` | Geschäftsstelle | `questionnaires` | B | Fragebogen eines Preises bearbeiten (freigeschaltet: nur Texte) |
| `questionnaireDef.release` | Geschäftsstelle | `questionnaires` | B | Fragebogen eines Preises für Bewerber freischalten |
| `questionnaireDef.withdraw` | Geschäftsstelle | `questionnaires` | B | Freischaltung zurückziehen (nur solange niemand begonnen hat) |
| `jury.assign` | Geschäftsstelle | `jury` | C | Vorgang der Jury zuweisen (ohne Auswahl: Standardbesetzung) |
| `jury.setMember` | Geschäftsstelle | `jury` | C | Jurymitglied einer Bewerbung zuweisen oder lösen |
| `jury.start` | Geschäftsstelle | `jury` | C | Jury 1 bzw. Jury 2 starten |
| `jury.finish` | Geschäftsstelle | `jury` | C | Juryprüfung abschließen |
| `result.set` | Geschäftsstelle | `results` | C | Ergebnis festlegen (vorbereiten, Einladung, keine Einladung) |
| `documents.request` | Geschäftsstelle | `documents` | Gesamt | Gewinnerunterlagen anfordern |
| `documents.review` | Geschäftsstelle | `documents` | Gesamt | Gewinnerunterlage prüfen oder Nachbesserung erbitten |
| `jury.vote` | Jurymitglied (in eigenem Namen) | `evaluate` | C | Ersteinschätzung abgeben (Jury 1) |
| `jury.points` | Jurymitglied (in eigenem Namen) | `evaluate` | C | Punkte vergeben (Jury 2) |
| `round.setStatus` | Geschäftsstelle | `round` | A | Status der Wettbewerbsrunde setzen |
| `round.setSettings` | Geschäftsstelle | `round` | A | Anmeldeschluss und Standardfrist ändern |
| `juror.create` | Geschäftsstelle | `jury` | C | Jurymitglied mit Zugang anlegen |
| `juror.update` | Geschäftsstelle | `jury` | C | Jurymitglied ändern (Jury-Art nur ohne Zuweisungen) |
| `staff.create` | Geschäftsstelle | `rights` | A | Internen Benutzer anlegen |
| `staff.setRole` | Geschäftsstelle | `rights` | A | Rolle eines internen Benutzers ändern |
| `staff.setActive` | Geschäftsstelle | `rights` | A | Internen Zugang aktivieren oder deaktivieren |
| `account.resetAccess` | Geschäftsstelle | `rights` | A | Zugang neu ausstellen (bei Jury-Zugängen mit Recht „jury“) |

Rückgabewerte: `draft.submit` → `{ reference }`, `juror.create` → `{ jurorId }`, `staff.create` → `{ accountId }`. Alle anderen liefern nichts.

### Rollen und Rechte (`domain/permissions.ts`)

| Recht | Verwaltung | Sachbearbeitung | Jury 1 / Jury 2 |
|---|:-:|:-:|:-:|
| `review` Anmeldungen prüfen | ✓ | ✓ | – |
| `payment` Rechnungen & Zahlungen | ✓ | ✓ | – |
| `release` Bewerbung freigeben & Fristen | ✓ | ✓ | – |
| `questionnaires` Fragebögen der Preise bearbeiten & freischalten | ✓ | – | – |
| `jury` Jury organisieren & zuweisen | ✓ | – | – |
| `results` Ergebnisse freigeben | ✓ | – | – |
| `documents` Gewinnerunterlagen prüfen | ✓ | ✓ | – |
| `exports` Exporte | ✓ | ✓ | – |
| `round` Runde verwalten | ✓ | – | – |
| `rights` Benutzer & Rechte | ✓ | – | – |
| `evaluate` Bewerbungen bewerten | – | – | ✓ (nur eigene Jury-Art) |

Bewerber haben keine Rolle; sie handeln nur an eigenen Vorgängen.

## 8. Zustandsmodell eines Vorgangs

Ein eingereichter Vorgang hat Teilzustände. Daraus leitet `domain/process.ts` die vier Phasen der Bewerbersicht ab (`phaseOf`), den Status mit nächstem Schritt für Bewerber (`applicantView`) und für die Verwaltung (`adminNext`).

| Teilzustand | Werte | Übergang (Befehl) und Voraussetzung |
|---|---|---|
| `review` | `neu` → `in_pruefung` / `rueckfrage` → `geprueft` | `review.set` – nur solange keine Rechnung gestellt ist |
| `payment` | `keine_rechnung` → `rechnung_offen` → `zahlung_eingegangen` | `payment.invoice` (Anmeldung geprüft), `payment.confirm` (Rechnung gestellt, Bewerbung noch gesperrt) |
| `application` | `gesperrt` → `verfuegbar` → `in_bearbeitung` → `eingereicht` | `application.release` (geprüft + bezahlt + Frist); ab der ersten Angabe `in_bearbeitung`; `eingereicht` automatisch, sobald alle Fragebögen und Unterlagen da sind |
| `prizes` | Liste der gewählten Preise | `application.setPrizes` (Bewerbung offen, mind. ein Preis, eingereichte Fragebögen binden ihren Preis) |
| `questionnaires[preis]` | `in_bearbeitung` → `eingereicht` | `questionnaire.save` / `questionnaire.submit` (Preis gewählt, Fragebogen freigeschaltet, vollständig und bestätigt) |
| `applicationDocs[platz]` | Datei | `application.uploadDoc` (Bewerbung freigegeben, Format und Größe zulässig) – austauschbar bis zur Zuweisung an die Jury |
| `jury` | `nicht_zugewiesen` → `zugewiesen` → `jury1` → `jury2` → `abgeschlossen` | `jury.assign` (Bewerbung eingereicht), `jury.start` jury1 (Mitglieder zugewiesen) / jury2 (alle Stimmen da), `jury.finish` (alle Punkte da) |
| `result` | `ausstehend`, `vorbereitet` (intern), `einladung`, `keine_einladung` | `result.set` – erst nach abgeschlossener Jury |
| `documents` | je Unterlage `offen` → `eingereicht` → `geprueft` / `nachbesserung` | `documents.request` (Einladung freigegeben), `documents.submit`, `documents.review` |

Phasen der Bewerbersicht: 01 Anmeldung läuft (bis `review = geprueft`), 02 Fragebogen wird freigeschaltet – Rechnung und Bewerbung (bis Jury zugewiesen), 03 Auditsitzung der Jury, 04 Einladung zur Gala (Jury abgeschlossen oder Ergebnis gesetzt). Die Ausbaustufe begrenzt die Phasen (`phasesIn`).

Fragebogen eines Preises (`QuestionnaireDefinition.status`): `entwurf` → `freigeschaltet` mit `questionnaireDef.release` (vollständig: Überschriften, Fragetexte, eindeutige IDs, Auswahl mit mind. zwei Möglichkeiten – `definitionProblem`). Im Entwurf ändert `questionnaireDef.update` alles; freigeschaltet nur Texte, der Aufbau (Abschnitte, Feld-IDs, Antwortformate, Pflicht, Höchstlängen, Auswahlwerte) bleibt gleich (`sameStructure`). `questionnaireDef.withdraw` geht zurück in den Entwurf, solange noch niemand Antworten gespeichert hat.

Wettbewerbsrunde (`round`): `vorbereitung` → `anmeldung_offen` → `anmeldung_geschlossen` → `fragebogenphase` (Anzeige: Bewerbungsphase) → `juryphase` → `abgeschlossen`. Neue Anmeldungen (`draft.create`, `draft.submit`) nur bei `anmeldung_offen`.

## 9. Sichtbarkeit (`domain/visibility.ts`)

| Rolle | Sieht | Sieht nicht |
|---|---|---|
| Bewerber | eigene Vorgänge, eigenes Konto, Rundenstatus, freigeschaltete Fragebögen der Preise | Stimmen, Punkte, Jurybesetzung, Verlauf, ein nur „vorbereitetes“ Ergebnis (erscheint als „ausstehend“), Fragebögen im Entwurf (nur Status), andere Konten, Zugangsdaten |
| Jurymitglied | nur zugewiesene Bewerbungen: alle sechs Unterlagen und die eingereichten Fragebögen der gewählten Preise; nur die eigene Bewertung | Bewertungen anderer, Verlauf, Entwürfe abgewählter Preise, Gewinnerunterlagen, andere Konten |
| Sachbearbeitung | alle Vorgänge und Konten | Zugangsdaten |
| Verwaltung | alles | Zugangsdaten (Prototyp: Testpasswörter sichtbar, entfällt) |

Die Unit-Tests prüfen diese Regeln. Der Prototyp filtert die Oberfläche bereits so, sobald Sitzung und Ansicht zusammenpassen.

## 10. Benachrichtigungen (heute nicht umgesetzt)

Das Portal verschickt im Prototyp nichts. Naheliegende Auslöser, jeweils nach erfolgreichem Befehl:

| Befehl | E-Mail an |
|---|---|
| `draft.submit` | Eingangsbestätigung mit Eingangsnummer (Bewerber bzw. vorschlagende Person) |
| `review.set` → `rueckfrage` | kein Automatismus – die Geschäftsstelle meldet sich direkt (so im Prototyp beschrieben) |
| `payment.invoice` | Rechnung bzw. Hinweis auf die Rechnung |
| `application.release` | Bewerbung freigeschaltet, mit Frist |
| `questionnaire.submit` | Eingangsbestätigung je Fragebogen; bei Vollständigkeit „Bewerbung eingereicht“ |
| `questionnaireDef.release` | Bewerber, die den Preis gewählt haben: Fragebogen jetzt verfügbar |
| `result.set` → `einladung` / `keine_einladung` | Ergebnis (nicht bei `vorbereitet`) |
| `documents.request`, `documents.review` → `nachbesserung` | Bitte um Unterlagen bzw. Nachbesserung |
| `juror.create`, `staff.create`, `account.resetAccess` | Einladungslink zum Zugang |

Mailinglisten für den manuellen Versand liefern die CSV-Exporte (`domain/exports.ts`).

## 11. Datei-Uploads

Bewerbungsunterlagen (sechs je Vorgang, `UploadedFile`) und Gewinnerunterlagen (`DocItem.fileName`) speichert der Prototyp nur als Name (und Größe). Im echten System: Upload in eine **private** Collection, am Platz eine Referenz statt des Namens. Bewerbungsunterlagen sehen Eigentümer, Verwaltung und die zugewiesene Jury; Gewinnerunterlagen nur Eigentümer und Verwaltung. Erlaubte Formate: `ACCEPTED_EXTENSIONS` und `MAX_FILE_BYTES` (`domain/application.ts`) bzw. `DOC_META` (`domain/process.ts`). Virenprüfung und Speicherfristen gehören in den Upload-Endpunkt.

## 12. Nur Prototyp – entfällt im echten System

| Teil | Wo |
|---|---|
| Browser-Backend mit localStorage | `data/mockBackend.ts` |
| Demo-Daten, Testzugänge, NEWEDGE-Szenarien | `domain/seed.ts` (als Vorlage für einen Entwicklungs-Seed nutzbar) |
| Demo-Steuerung (Ausbaustufe umschalten, Perspektivwechsel ohne Login, Szenarien, Zurücksetzen) | `DemoControls` in `data/backend.ts`, `ui/DemoPanel.tsx` – verschwindet automatisch ohne Mock; die Stufe kommt dann nur aus `NEXT_PUBLIC_PORTAL_STAGE` |
| „Bewerberansicht öffnen“ in der Verwaltung | `AdminVorgangSheet` – verschwindet automatisch ohne Mock |
| Testpasswörter anzeigen („Zugang anzeigen“, „Neues Passwort“) | `ui/AdminAreas.tsx`, `ui/JuryAdmin.tsx` – im echten System „Einladung erneut senden“ |
| Box „Testzugänge“ auf der Login-Seite, Kennzeichnung „Prototyp“ | `ui/AuthScreen.tsx`, `ui/PortalApp.tsx` |
| Felder `passwordHash`, `demoPassword`, `demo`, `sample` | `domain/types.ts` |

## 13. Offene fachliche Entscheidungen

Im Prototyp als Annahme gelöst und in der Oberfläche als „Demo-Annahme“ gekennzeichnet:

1. **Fremdnominierung:** Wer erhält Rechnung und Fragebogen – das vorgeschlagene Unternehmen mit eigenem Konto? Erfährt die vorschlagende Person das Ergebnis? (Im Prototyp füllt die vorschlagende Person den Fragebogen stellvertretend aus und sieht die Antworten.)
2. **Zahlung:** ohne Zahlungsanbieter; die Geschäftsstelle vermerkt den Zahlungseingang manuell.
3. **Fragebögen für Roland-Berger-Zukunftspreis und Bavarian Future Award:** Platzhalter; die Geschäftsstelle legt die Fragen im Bereich „Fragebögen“ fest. Offen: Brauchen geänderte Fassungen nach dem Freischalten eine Versionierung (heute: nur Textkorrekturen erlaubt)?
4. **Die sechs Unterlagen:** Bezeichnungen sind Platzhalter (`APPLICATION_DOCS`). Sind alle Pflicht? Gibt es Vorlagen zum Herunterladen?
5. **Sponsorenbereich:** nicht gebaut (Konzept 04).
6. **Rückfragen:** kein Nachrichtenkanal im Portal; die Geschäftsstelle meldet sich per E-Mail oder Telefon.
7. **Datenschutz:** Sieht die Verwaltung Entwürfe? Wie lange werden Konten, Antworten und Unterlagen aufbewahrt, wann gelöscht?
8. **Jury:** Befangenheit (Jurymitglied und Unternehmen verbunden) ist nicht abgebildet.
9. **Rundenstatus:** Die Verwaltung kann jeden Status direkt setzen. Soll das Backend nur die Reihenfolge erlauben?
10. **Übergang zwischen Ausbaustufen:** Vorgänge aus Stufe A laufen in Stufe A + B einfach weiter (gleiche Daten). Soll beim Wechsel automatisch eine E-Mail an alle geprüften Anmeldungen gehen?
