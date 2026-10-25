# Teilnehmerportal – Übergabe an die Backend-Entwicklung

Stand: Oktober 2026 · Code: `src/portal/` (Einstieg: [README](../README.md)) · Route: `/portal`

Das Teilnehmerportal ist als klickbarer Prototyp fertig: alle Ansichten (Bewerber, Verwaltung, Sachbearbeitung, Jury), der komplette Ablauf in vier Phasen und alle Verwaltungsbereiche. Die Daten liegen heute im Browser (localStorage). Der Code ist so aufgebaut, dass das Backend **hinter ein festes Interface** kommt und **dieselben Geschäftsregeln** serverseitig verwendet. An den Oberflächen-Komponenten muss dafür nichts geändert werden.

## 1. Was schon fertig ist und was das Backend liefern muss

| Fertig im Frontend (wiederverwendbar) | Aufgabe Backend |
|---|---|
| Datenmodell als TypeScript-Typen (`domain/types.ts`) | Persistenz, z. B. Payload-Collections (Vorschlag in Abschnitt 4) |
| Alle Schreibaktionen als Befehle mit Rechte- und Zustandsprüfung (`domain/commands.ts`) | Route Handler, der `executeCommand` serverseitig aufruft und speichert |
| Sichtbarkeitsregeln je Rolle (`domain/visibility.ts`) | Jede Antwort mit `visibleTo` filtern |
| Prüfregeln für Anmeldung und Fragebogen (`domain/registration.ts`, `domain/questionnaire.ts`) | – (laufen in `executeCommand` mit) |
| HTTP-Client gegen die Endpunkte in Abschnitt 5 (`data/httpBackend.ts`) | Endpunkte umsetzen, Sitzung per HttpOnly-Cookie |
| CSV-Exporte als reine Funktionen (`domain/exports.ts`) | optional serverseitig ausliefern |
| – | Authentifizierung, Passwort-Reset, Einladungslinks |
| – | E-Mails (Abschnitt 9), Datei-Uploads (Abschnitt 10) |
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

## 3. Datenmodell

Alle Typen: `src/portal/domain/types.ts`. Statuswerte sind deutsche Schlüssel (so stehen sie auch in Exporten und im Verlauf).

```
Account 1 ─── n Submission            (Eigentümer; bei Fremdnominierung die vorschlagende Person)
Account 1 ─── 0..1 Juror               (nur Konten mit role = 'jury')
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
| `ProcessState` | `review`, `payment`, `questionnaire`, `deadline`, `jury`, `assigned`, `jury1`, `jury2`, `result`, `answers`, `documents?`, `log` | siehe Zustandsmodell (Abschnitt 7) |
| `RoundSettings` | `registrationDeadline`, `questionnaireDeadline` (YYYY-MM-DD) | zusammen mit `round` (Status) ein Singleton |

Felder des Fragebogens: `domain/questionnaire.ts` (`QUESTIONNAIRE`, mit Format, Pflicht und Länge je Feld). Antworten werden als `Record<Feld-ID, string>` gespeichert.

## 4. Vorschlag: Umsetzung mit Payload

Das Website-Projekt der BMP (Repo `bmp-website-2026-neu`) nutzt Payload 3. Zwei Wege sind möglich:

- **Portal in die Website übernehmen** (`src/portal` → dort `src/spa/portal`, Route `src/app/(frontend)/portal`) und Payload als Backend nutzen – Vorschlag unten.
- **Eigenständig in diesem Repo** mit eigenen Route Handlern und eigener Datenbank. Die Collections unten gelten dann sinngemäß als Tabellen.

Vorschlag für Payload (keine Vorgabe):

| Collection / Global | Inhalt | Zugriff |
|---|---|---|
| `portal-accounts` (eigene Auth-Collection, `auth: true`) | Account + Profile, Feld `role`, `active` | getrennt von `users` (CMS-Redaktion) |
| `portal-jurors` | Juror, Relation zu `portal-accounts` | Verwaltung |
| `portal-submissions` | Submission inkl. `process` als Group, `answers` als JSON, `reference` mit Unique-Index | Eigentümer, Verwaltung; Jury nur zugewiesene (über die API) |
| `portal-evaluations` *(empfohlen)* | je Bewertung ein Datensatz: Vorgang, Juror, `vote` oder `points` | statt der Maps `jury1`/`jury2`, siehe Nebenläufigkeit |
| `portal-log` *(optional)* | Verlauf append-only: Vorgang, Zeit, Text, Konto | nur Verwaltung |
| `portal-uploads` | Gewinnerunterlagen (Logo, Pressefoto) | **privat**, nicht die öffentliche `media`-Collection |
| Global `portal-round` | `status`, `registrationDeadline`, `questionnaireDeadline` | lesen alle, schreiben Verwaltung |

Achtung, Namensgleichheit im Website-Projekt: Die vorhandene Collection `jury-mitglieder` ist die **öffentliche Jury-Vorstellung auf der Website**, nicht die Jurymitglieder des Portals. `application-submissions` ist das bisherige Website-Formular.

**Nebenläufigkeit:** `executeCommand` liest einen Vorgang, ändert ihn und gibt ihn zurück. Bewerten zwei Jurymitglieder gleichzeitig denselben Vorgang, darf keine Stimme verloren gehen. Entweder Bewertungen als eigene Datensätze speichern (empfohlen) oder beim Speichern auf `updatedAt` prüfen (optimistisches Sperren) und bei Konflikt mit 409 antworten.

## 5. API-Vertrag

Der Client (`data/httpBackend.ts`) erwartet diese Endpunkte. Sitzung per HttpOnly-Cookie, alle Antworten JSON.

| Methode und Pfad | Anfrage | Antwort |
|---|---|---|
| `GET /api/portal/snapshot` | – | `200` `PortalSnapshot` = `{ ...visibleTo(data, actor), sessionAccountId }` |
| `POST /api/portal/auth/register` | `{ email, password }` | `201` · `409` E-Mail vergeben |
| `POST /api/portal/auth/login` | `{ email, password }` | `200` · `401` falsch · `403` deaktiviert |
| `POST /api/portal/auth/logout` | – | `204` |
| `POST /api/portal/commands` | ein `PortalCommand` | `200 { result }` · Fehler `{ error: { code, message, field? } }` |

Fehlercodes aus `CommandError.code` auf HTTP-Status: `unauthenticated` → 401, `forbidden` → 403, `not_found` → 404, `conflict` → 409, `invalid_state` → 409, `invalid_input` → 422. Die `message` ist deutsch und wird der Person direkt angezeigt; `field` markiert das betroffene Formularfeld.

Beispiel für den Befehls-Endpunkt (Skizze, nicht im Projekt angelegt):

```ts
// src/app/api/portal/commands/route.ts
import { executeCommand, type CommandErrorCode } from '@/portal/domain/commands'
import { actorOf } from '@/portal/domain/permissions'

const STATUS: Record<CommandErrorCode, number> = {
  unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409, invalid_state: 409, invalid_input: 422,
}

export async function POST(request: Request) {
  const session = await getPortalSession(request)          // Payload-Auth: Konto aus dem Cookie
  const command = parsePortalCommand(await request.json())   // Form prüfen (z. B. zod) – nie dem Client vertrauen
  const data = await loadPortalData(command)                 // betroffene Datensätze als PortalData
  const outcome = executeCommand(data, actorOf(data, session?.accountId), command, serverContext)
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: STATUS[outcome.error.code] })
  await savePortalData(outcome.data, outcome.changed)        // nur geänderte Datensätze, in einer Transaktion
  await notifyFor(command, outcome)                          // E-Mails, Abschnitt 9
  return Response.json({ result: outcome.result ?? null })
}
```

`serverContext` liefert `now`, `newId` und `newReference` (Eingangsnummer: eindeutig, z. B. `BMP-` + 6 Zeichen ohne verwechselbare Zeichen). `newPassword` bleibt im echten System leer; neue Zugänge bekommen einen Einladungslink.

Was `loadPortalData` je Befehl braucht: Vorgangsbefehle brauchen den Vorgang, die Jurymitglieder (`jury.*`) und die Runde (`draft.create`, `draft.submit`). Zugangsbefehle brauchen die Konten. Die Eindeutigkeit der E-Mail sollte zusätzlich ein Unique-Index absichern.

## 6. Befehle

Erzeugt aus `COMMAND_SPEC` in `domain/commands.ts`:

| Befehl | Wer | Recht | Wirkung |
|---|---|---|---|
| `profile.save` | eigenes Konto | – | Eigene Stammdaten speichern |
| `draft.create` | Bewerber (eigener Vorgang) | – | Entwurf einer Anmeldung anlegen (nur bei offener Anmeldung) |
| `draft.update` | Bewerber (eigener Vorgang) | – | Eigenen Entwurf zwischenspeichern |
| `draft.submit` | Bewerber (eigener Vorgang) | – | Eigene Anmeldung einreichen – vergibt die Eingangsnummer |
| `draft.discard` | Bewerber (eigener Vorgang) | – | Eigenen Entwurf verwerfen |
| `questionnaire.save` | Bewerber (eigener Vorgang) | – | Fragebogen zwischenspeichern |
| `questionnaire.submit` | Bewerber (eigener Vorgang) | – | Fragebogen einreichen |
| `documents.submit` | Bewerber (eigener Vorgang) | – | Gewinnerunterlage einreichen |
| `review.set` | Geschäftsstelle | `review` | Anmeldung prüfen: in Prüfung, Rückfrage, geprüft |
| `payment.invoice` | Geschäftsstelle | `payment` | Rechnung als gestellt markieren |
| `payment.confirm` | Geschäftsstelle | `payment` | Zahlungseingang vermerken |
| `questionnaire.setDeadline` | Geschäftsstelle | `release` | Frist für den Fragebogen setzen oder entfernen |
| `questionnaire.release` | Geschäftsstelle | `release` | Fragebogen freigeben |
| `jury.assign` | Geschäftsstelle | `jury` | Vorgang der Jury zuweisen (ohne Auswahl: Standardbesetzung) |
| `jury.setMember` | Geschäftsstelle | `jury` | Jurymitglied einem Fragebogen zuweisen oder lösen |
| `jury.start` | Geschäftsstelle | `jury` | Jury 1 bzw. Jury 2 starten |
| `jury.finish` | Geschäftsstelle | `jury` | Juryprüfung abschließen |
| `result.set` | Geschäftsstelle | `results` | Ergebnis festlegen (vorbereiten, Einladung, keine Einladung) |
| `documents.request` | Geschäftsstelle | `documents` | Gewinnerunterlagen anfordern |
| `documents.review` | Geschäftsstelle | `documents` | Gewinnerunterlage prüfen oder Nachbesserung erbitten |
| `jury.vote` | Jurymitglied (in eigenem Namen) | `evaluate` | Ersteinschätzung abgeben (Jury 1) |
| `jury.points` | Jurymitglied (in eigenem Namen) | `evaluate` | Punkte vergeben (Jury 2) |
| `round.setStatus` | Geschäftsstelle | `round` | Status der Wettbewerbsrunde setzen |
| `round.setSettings` | Geschäftsstelle | `round` | Anmeldeschluss und Standardfrist ändern |
| `juror.create` | Geschäftsstelle | `jury` | Jurymitglied mit Zugang anlegen |
| `juror.update` | Geschäftsstelle | `jury` | Jurymitglied ändern (Jury-Art nur ohne Zuweisungen) |
| `staff.create` | Geschäftsstelle | `rights` | Internen Benutzer anlegen |
| `staff.setRole` | Geschäftsstelle | `rights` | Rolle eines internen Benutzers ändern |
| `staff.setActive` | Geschäftsstelle | `rights` | Internen Zugang aktivieren oder deaktivieren |
| `account.resetAccess` | Geschäftsstelle | `rights` | Zugang neu ausstellen (bei Jury-Zugängen mit Recht „jury“) |

Rückgabewerte: `draft.submit` → `{ reference }`, `juror.create` → `{ jurorId }`, `staff.create` → `{ accountId }`. Alle anderen liefern nichts.

### Rollen und Rechte (`domain/permissions.ts`)

| Recht | Verwaltung | Sachbearbeitung | Jury 1 / Jury 2 |
|---|:-:|:-:|:-:|
| `review` Anmeldungen prüfen | ✓ | ✓ | – |
| `payment` Rechnungen & Zahlungen | ✓ | ✓ | – |
| `release` Fragebogen freigeben & Fristen | ✓ | ✓ | – |
| `jury` Jury organisieren & zuweisen | ✓ | – | – |
| `results` Ergebnisse freigeben | ✓ | – | – |
| `documents` Gewinnerunterlagen prüfen | ✓ | ✓ | – |
| `exports` Exporte | ✓ | ✓ | – |
| `round` Runde verwalten | ✓ | – | – |
| `rights` Benutzer & Rechte | ✓ | – | – |
| `evaluate` Fragebögen bewerten | – | – | ✓ (nur eigene Jury-Art) |

Bewerber haben keine Rolle; sie handeln nur an eigenen Vorgängen.

## 7. Zustandsmodell eines Vorgangs

Ein eingereichter Vorgang hat Teilzustände. Daraus leitet `domain/process.ts` die vier Phasen der Bewerbersicht ab (`phaseOf`), den Status mit nächstem Schritt für Bewerber (`applicantView`) und für die Verwaltung (`adminNext`).

| Teilzustand | Werte | Übergang (Befehl) und Voraussetzung |
|---|---|---|
| `review` | `neu` → `in_pruefung` / `rueckfrage` → `geprueft` | `review.set` – nur solange keine Rechnung gestellt ist |
| `payment` | `keine_rechnung` → `rechnung_offen` → `zahlung_eingegangen` | `payment.invoice` (Anmeldung geprüft), `payment.confirm` (Rechnung gestellt, Fragebogen noch gesperrt) |
| `questionnaire` | `gesperrt` → `verfuegbar` → `in_bearbeitung` → `eingereicht` | `questionnaire.release` (geprüft + bezahlt + Frist), `questionnaire.save`, `questionnaire.submit` (vollständig, bestätigt, mind. ein Preis) |
| `jury` | `nicht_zugewiesen` → `zugewiesen` → `jury1` → `jury2` → `abgeschlossen` | `jury.assign` (Fragebogen eingereicht), `jury.start` jury1 (Mitglieder zugewiesen) / jury2 (alle Stimmen da), `jury.finish` (alle Punkte da) |
| `result` | `ausstehend`, `vorbereitet` (intern), `einladung`, `keine_einladung` | `result.set` – erst nach abgeschlossener Jury |
| `documents` | je Unterlage `offen` → `eingereicht` → `geprueft` / `nachbesserung` | `documents.request` (Einladung freigegeben), `documents.submit`, `documents.review` |

Phasen der Bewerbersicht: 01 Anmeldung läuft (bis `review = geprueft`), 02 Fragebogen wird freigeschaltet (bis Jury zugewiesen), 03 Auditsitzung der Jury, 04 Einladung zur Gala (Jury abgeschlossen oder Ergebnis gesetzt).

Wettbewerbsrunde (`round`): `vorbereitung` → `anmeldung_offen` → `anmeldung_geschlossen` → `fragebogenphase` → `juryphase` → `abgeschlossen`. Neue Anmeldungen (`draft.create`, `draft.submit`) nur bei `anmeldung_offen`.

## 8. Sichtbarkeit (`domain/visibility.ts`)

| Rolle | Sieht | Sieht nicht |
|---|---|---|
| Bewerber | eigene Vorgänge, eigenes Konto, Rundenstatus | Stimmen, Punkte, Jurybesetzung, Verlauf, ein nur „vorbereitetes“ Ergebnis (erscheint als „ausstehend“), andere Konten, Zugangsdaten |
| Jurymitglied | nur zugewiesene, eingereichte Fragebögen mit Antworten; nur die eigene Bewertung | Bewertungen anderer, Verlauf, Gewinnerunterlagen, andere Konten |
| Sachbearbeitung | alle Vorgänge und Konten | Zugangsdaten |
| Verwaltung | alles | Zugangsdaten (Prototyp: Testpasswörter sichtbar, entfällt) |

Die Unit-Tests prüfen diese Regeln. Der Prototyp filtert die Oberfläche bereits so, sobald Sitzung und Ansicht zusammenpassen.

## 9. Benachrichtigungen (heute nicht umgesetzt)

Das Portal verschickt im Prototyp nichts. Naheliegende Auslöser, jeweils nach erfolgreichem Befehl:

| Befehl | E-Mail an |
|---|---|
| `draft.submit` | Eingangsbestätigung mit Eingangsnummer (Bewerber bzw. vorschlagende Person) |
| `review.set` → `rueckfrage` | kein Automatismus – die Geschäftsstelle meldet sich direkt (so im Prototyp beschrieben) |
| `payment.invoice` | Rechnung bzw. Hinweis auf die Rechnung |
| `questionnaire.release` | Fragebogen freigeschaltet, mit Frist |
| `questionnaire.submit` | Eingangsbestätigung Fragebogen |
| `result.set` → `einladung` / `keine_einladung` | Ergebnis (nicht bei `vorbereitet`) |
| `documents.request`, `documents.review` → `nachbesserung` | Bitte um Unterlagen bzw. Nachbesserung |
| `juror.create`, `staff.create`, `account.resetAccess` | Einladungslink zum Zugang |

Mailinglisten für den manuellen Versand liefern die CSV-Exporte (`domain/exports.ts`).

## 10. Datei-Uploads

Gewinnerunterlagen (Logo, Pressefoto) speichert der Prototyp nur als Dateinamen (`DocItem.fileName`). Im echten System: Upload in eine **private** Collection, im `DocItem` eine Referenz statt des Namens, Download nur für Eigentümer und Verwaltung. Erlaubte Formate stehen in `DOC_META` (`domain/process.ts`).

## 11. Nur Prototyp – entfällt im echten System

| Teil | Wo |
|---|---|
| Browser-Backend mit localStorage | `data/mockBackend.ts` |
| Demo-Daten, Testzugänge, NEWEDGE-Szenarien | `domain/seed.ts` (als Vorlage für einen Entwicklungs-Seed nutzbar) |
| Demo-Steuerung (Perspektivwechsel ohne Login, Szenarien, Zurücksetzen) | `DemoControls` in `data/backend.ts`, `ui/DemoPanel.tsx` – verschwindet automatisch ohne Mock |
| „Bewerberansicht öffnen“ in der Verwaltung | `AdminVorgangSheet` – verschwindet automatisch ohne Mock |
| Testpasswörter anzeigen („Zugang anzeigen“, „Neues Passwort“) | `ui/AdminAreas.tsx`, `ui/JuryAdmin.tsx` – im echten System „Einladung erneut senden“ |
| Box „Testzugänge“ auf der Login-Seite, Kennzeichnung „Prototyp“ | `ui/AuthScreen.tsx`, `ui/PortalApp.tsx` |
| Felder `passwordHash`, `demoPassword`, `demo`, `sample` | `domain/types.ts` |

## 12. Offene fachliche Entscheidungen

Im Prototyp als Annahme gelöst und in der Oberfläche als „Demo-Annahme“ gekennzeichnet:

1. **Fremdnominierung:** Wer erhält Rechnung und Fragebogen – das vorgeschlagene Unternehmen mit eigenem Konto? Erfährt die vorschlagende Person das Ergebnis? (Im Prototyp füllt die vorschlagende Person den Fragebogen stellvertretend aus und sieht die Antworten.)
2. **Zahlung:** ohne Zahlungsanbieter; die Geschäftsstelle vermerkt den Zahlungseingang manuell.
3. **Fragebögen für Roland-Berger-Zukunftspreis und Bavarian Future Award:** fehlen noch (Konzept 06).
4. **Sponsorenbereich:** nicht gebaut (Konzept 04).
5. **Rückfragen:** kein Nachrichtenkanal im Portal; die Geschäftsstelle meldet sich per E-Mail oder Telefon.
6. **Datenschutz:** Sieht die Verwaltung Entwürfe? Wie lange werden Konten, Antworten und Unterlagen aufbewahrt, wann gelöscht?
7. **Jury:** Befangenheit (Jurymitglied und Unternehmen verbunden) ist nicht abgebildet.
8. **Rundenstatus:** Die Verwaltung kann jeden Status direkt setzen. Soll das Backend nur die Reihenfolge erlauben?
