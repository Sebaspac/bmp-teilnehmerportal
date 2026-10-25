'use client'

/*
 * THESIS: Ein Vorgang, vier Phasen, drei Perspektiven. Statt getrennter Ansichten mit eigenen Wahrheiten lesen Bewerber,
 *   Verwaltung und Jury denselben simulierten Zustand; Phase (A), Detailstatus (B) und nächste Handlung (C) bleiben getrennt.
 * OWN-WORLD: BMP-Marke als Arbeitsoberfläche – Navy-Seitenleiste mit weißem Wappen, Gold markiert den aktiven Bereich und
 *   die eine Hauptaktion; Inhalt hell und flach (weiße Flächen auf warmem Hellgrau, Trennlinien statt Boxen), eckige
 *   Kanten, IBM Plex für Titel/Labels, Inter für Text.
 * STORY: Anmeldung → Prüfung → Fragebogen-Freigabe → Fragebogen → Auditsitzung der Jury → Einladung zur Gala (oder
 *   neutraler Abschluss); die Verwaltung schaltet die Schritte, der Bewerber sieht sofort, wo er steht und ob er handeln muss.
 * FIRST VIEWPORT: Seitenleiste mit den Bereichen der Rolle; rechts Seitentitel mit der Hauptaktion und darunter die Liste
 *   (Vorgänge mit Phase, Status und nächstem Schritt).
 * FORM: App-Rahmen mit Seitenleiste; Details (Vorgang, Fragebogen, Anmeldung, Jurymitglied) als eigene Seiten mit
 *   „Zurück“ statt überlagernder Mappen – nichts liegt übereinander.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Award,
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderUp,
  KeyRound,
  LayoutDashboard,
  Receipt,
  Scale,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import Image from '@/shared/UnoptimizedImage'
import { AdminOverview, AdminQuestionnaireSheet, AdminVorgangSheet, areaCounts, tabAllowed, type AdminTab } from '@/portal/ui/AdminView'
import { AppShell, type NavSection } from '@/portal/ui/AppShell'
import { AuthScreen } from '@/portal/ui/AuthScreen'
import { DemoPanel, type Perspective } from '@/portal/ui/DemoPanel'
import { cx } from '@/portal/ui/fields'
import { HelpView } from '@/portal/ui/HelpView'
import { JurorSheet, NewJurorSheet } from '@/portal/ui/JuryAdmin'
import { JuryView } from '@/portal/ui/JuryView'
import { PortalOverview } from '@/portal/ui/PortalOverview'
import { portalContent } from '@/portal/content/portalContent'
import { logout, newClientId, portalDemo, usePortalSnapshot } from '@/portal/data/portalClient'
import { actorOf, can, viewerRole } from '@/portal/domain/permissions'
import { JURY_TYPE_LABEL, ROUND_LABEL } from '@/portal/domain/process'
import { newedgeSubmission, type ScenarioId } from '@/portal/domain/seed'
import { accountOf, isProfileComplete, jurorById, registrationOpen, sessionAccount, submissionsFor } from '@/portal/domain/selectors'
import type { Account, SubmissionType } from '@/portal/domain/types'
import { visibleTo } from '@/portal/domain/visibility'
import { CommandErrorNotice } from '@/portal/ui/CommandErrorNotice'
import { ProfileSheet, type ProfileIntent } from '@/portal/ui/ProfileSheet'
import { QuestionnaireSheet } from '@/portal/ui/QuestionnaireSheet'
import { SubmissionSheet } from '@/portal/ui/SubmissionSheet'
import { VorgangSheet } from '@/portal/ui/VorgangSheet'
import styles from '@/portal/ui/portal.module.css'

type Route =
  | { view: 'login' }
  | { view: 'register' }
  | { view: 'overview' }
  | { view: 'profile' }
  | { view: 'new' }
  | { view: 'draft'; id: string }
  | { view: 'vorgang'; id: string }
  | { view: 'questionnaire'; id: string }
  | { view: 'help' }
  | { view: 'admin' }
  | { view: 'adminVorgang'; id: string }
  | { view: 'adminJuror'; id: string }
  | { view: 'adminQuestionnaire'; id: string }
  | { view: 'jury' }

function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean).slice(1).map(decodeURIComponent)
  const [first, second, third] = parts
  if (first === 'anmelden') return { view: 'login' }
  if (first === 'registrieren') return { view: 'register' }
  if (first === 'stammdaten') return { view: 'profile' }
  if (first === 'einreichen') return { view: 'new' }
  if (first === 'einreichung' && second) return { view: 'draft', id: second }
  if (first === 'vorgang' && second && third === 'fragebogen') return { view: 'questionnaire', id: second }
  if (first === 'vorgang' && second) return { view: 'vorgang', id: second }
  if (first === 'hilfe') return { view: 'help' }
  if (first === 'admin' && second === 'vorgang' && third) return { view: 'adminVorgang', id: third }
  if (first === 'admin' && second === 'jury' && third) return { view: 'adminJuror', id: third }
  if (first === 'admin' && second === 'fragebogen' && third) return { view: 'adminQuestionnaire', id: third }
  if (first === 'admin') return { view: 'admin' }
  if (first === 'jury') return { view: 'jury' }
  return { view: 'overview' }
}

const perspectiveOf = (route: Route): Perspective =>
  route.view === 'admin' || route.view === 'adminVorgang' || route.view === 'adminJuror' || route.view === 'adminQuestionnaire'
    ? 'admin'
    : route.view === 'jury'
      ? 'jury'
      : 'bewerber'

/** Nur Ziele innerhalb der Einreichung erlaubt („weiter“ nach den Stammdaten). */
const safeContinue = (value: string | null) =>
  value && /^(einreichen(\?entwurf=[\w-]+)?(&art=(eigenbewerbung|fremdvorschlag))?|einreichung\/[\w-]+)$/.test(value) ? value : null

/** Schlüssel des künftigen Entwurfs – steht ab dem Öffnen in der URL, damit Zurück/Vor immer denselben Entwurf meint. */
const newDraftKey = newClientId

/** Ziel nach dem Login (Deep Link, z. B. aus einer späteren E-Mail): nur bekannte Portalbereiche. */
const loginContinue = (value: string | null) =>
  value && /^(vorgang\/[\w-]+(\/fragebogen)?|einreichung\/[\w-]+|einreichen|stammdaten|hilfe)$/.test(value) ? value : null

const asType = (value: string | null): SubmissionType | undefined =>
  value === 'eigenbewerbung' || value === 'fremdvorschlag' ? value : undefined

const ADMIN_TABS = portalContent.admin.tabs.map((tab) => tab.key)
const asAdminTab = (value: string | null): AdminTab => (ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : 'uebersicht')

/* Sitzungsmerker (nur dieser Tab): Rückweg nach einem Demo-Wechsel. */
const PREVIOUS_ACCOUNT_KEY = 'bmp-portal-vorheriges-konto'

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(key, value)
    else window.sessionStorage.removeItem(key)
  } catch {
    // Ohne Speicher (z. B. privates Fenster) entfällt nur der Komfort.
  }
}

const accountName = (account: Account | null | undefined) =>
  account ? `${account.profile.firstName} ${account.profile.lastName}`.trim() || account.email : ''

const VIEW_TITLE: Record<string, string> = {
  login: 'Anmelden',
  register: 'Konto erstellen',
  overview: 'Meine Vorgänge',
  profile: 'Stammdaten',
  new: 'Neue Anmeldung',
  draft: 'Anmeldung fortsetzen',
  vorgang: 'Vorgang',
  questionnaire: 'Bewerbungsfragebogen',
  help: 'Hilfe',
  admin: 'Verwaltung',
  adminVorgang: 'Vorgang (Verwaltung)',
  adminJuror: 'Jurymitglied (Verwaltung)',
  adminQuestionnaire: 'Fragebogen (Verwaltung)',
  jury: 'Jury',
}

export default function PortalApp() {
  const pathname = usePathname() || '/portal'
  const searchParams = useSearchParams()
  const router = useRouter()
  // `snapshot`: alles, was das Backend liefert. Im Prototyp ist das der ganze Bestand, damit die Demo-Steuerung ohne
  // Login zwischen den Ansichten wechseln kann.
  const snapshot = usePortalSnapshot()
  const route = parseRoute(pathname)
  const perspective = perspectiveOf(route)
  // `state`: was die angemeldete Person sehen darf – gefiltert wie im echten Backend (domain/visibility.ts). Nur wenn die
  // Ansicht nicht zur Sitzung passt (Perspektivwechsel der Demo-Steuerung), arbeitet die Oberfläche mit dem ganzen Bestand.
  const state = useMemo(() => {
    if (!snapshot) return null
    const actor = actorOf(snapshot, snapshot.sessionAccountId)
    const matches =
      (perspective === 'bewerber' && actor.kind === 'applicant') || (perspective === 'admin' && actor.kind === 'staff') || (perspective === 'jury' && actor.kind === 'jury')
    return matches || !portalDemo ? { ...visibleTo(snapshot, actor), sessionAccountId: snapshot.sessionAccountId } : snapshot
  }, [snapshot, perspective])
  const account = sessionAccount(state)
  const isAuthView = route.view === 'login' || route.view === 'register'
  const needsAccount = perspective === 'bewerber' && !isAuthView
  const [pinnedEditorId, setPinnedEditorId] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  // Vorheriges Konto, wenn die Demo-Steuerung auf das Beispielkonto umgeschaltet hat (Rückweg in der Vorführung).
  // In der Sitzung gespeichert: Ein Wechsel des Pfadsegments baut die Seite neu auf, React-State ginge verloren.
  const [previousAccountId, setPreviousAccountIdState] = useState<string | null>(() => readSession(PREVIOUS_ACCOUNT_KEY))
  const setPreviousAccountId = (value: string | null) => {
    writeSession(PREVIOUS_ACCOUNT_KEY, value)
    setPreviousAccountIdState(value)
  }
  const rememberAccount = (nextAccountId: string | null | undefined) => {
    if (account && nextAccountId && account.id !== nextAccountId) setPreviousAccountId(account.id)
  }
  // Demo-Sprung von der Anmeldeseite direkt in einen Vorgang: die automatische Weiterleitung zur Übersicht auslassen.
  const demoJump = useRef(false)

  // Einzige Stelle für Weiterleitungen rund um die Anmeldung: Nach dem Registrieren geht es direkt zu den Stammdaten.
  useEffect(() => {
    if (!state) return
    if (!isAuthView) demoJump.current = false
    if (!account && needsAccount) {
      const target = loginContinue(pathname.replace(/^\/portal\/?/, ''))
      router.replace(target ? `/portal/anmelden?weiter=${encodeURIComponent(target)}` : '/portal/anmelden')
    } else if (account && isAuthView && !demoJump.current) {
      const back = loginContinue(searchParams.get('weiter'))
      // Testzugänge mit Rolle führen direkt in ihre Ansicht.
      const roleHome = account.role === 'verwaltung' || account.role === 'sachbearbeitung' ? '/portal/admin' : account.role === 'jury' ? '/portal/jury' : null
      router.replace(roleHome ?? (route.view === 'register' ? '/portal/stammdaten?willkommen=1' : back ? `/portal/${back}` : '/portal'))
    } else if (account?.role && perspective === 'bewerber' && !isAuthView) {
      // Verwaltung/Jury haben keine Bewerberseiten – zurück in die eigene Ansicht.
      router.replace(account.role === 'jury' ? '/portal/jury' : '/portal/admin')
    }
  }, [account, isAuthView, needsAccount, pathname, perspective, route.view, router, searchParams, state])

  // Nach dem Einreichen: Pin erst lösen, wenn die Route den Assistenten verlassen hat (Bestätigung bleibt stehen).
  useEffect(() => {
    if (route.view !== 'draft' && route.view !== 'new' && pinnedEditorId) setPinnedEditorId(null)
  }, [route.view, pinnedEditorId])

  // Fokussierte Elemente nie unter der klebrigen Kopfleiste (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollPaddingTop
    root.style.scrollPaddingTop = '76px'
    return () => {
      root.style.scrollPaddingTop = previous
    }
  }, [])

  // Ältere Links ohne Entwurfsschlüssel (z. B. nach den Stammdaten) bekommen einen – nur die Query, kein Neuaufbau.
  useEffect(() => {
    if (route.view !== 'new' || searchParams.get('entwurf')) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('entwurf', newDraftKey())
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, route.view, router, searchParams])

  // Signal für das Sicherheitsnetz in page.tsx: Das Portal läuft (hydriert).
  useEffect(() => {
    document.documentElement.setAttribute('data-portal-ready', '1')
    try {
      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith('bmp-portal-neu-geladen:'))
        .forEach((key) => window.sessionStorage.removeItem(key))
    } catch {
      // ohne Speicher kein Sicherheitsnetz-Zähler – unkritisch
    }
  }, [])

  // Eigener Seitentitel je Ansicht (Orientierung in Tabs, Verlauf und für Screenreader).
  useEffect(() => {
    const part = VIEW_TITLE[route.view]
    document.title = `${part ? `${part} – ` : ''}${portalContent.meta.title} – Bayerischer Mittelstandspreis`
  }, [route.view])

  const navigate = (path: string) => router.push(path)
  const closeSheet = () => router.replace('/portal')
  const adminTab = asAdminTab(searchParams.get('bereich'))
  const adminBase = adminTab === 'uebersicht' ? '/portal/admin' : `/portal/admin?bereich=${adminTab}`

  const startSubmission = (type?: SubmissionType) => {
    // Rundenverwaltung: Neue Anmeldungen nur, solange die Anmeldung geöffnet ist.
    if (!registrationOpen(state)) return
    // Jede neue Anmeldung bekommt sofort ihren eigenen Entwurfsschlüssel – „Neue Anmeldung“ startet damit immer leer.
    const target = `einreichen?entwurf=${newDraftKey()}${type ? `&art=${type}` : ''}`
    if (account && !isProfileComplete(account.profile)) navigate(`/portal/stammdaten?weiter=${encodeURIComponent(target)}`)
    else navigate(`/portal/${target}`)
  }

  /* ── Demo-Steuerung ── */
  const currentVorgangId = route.view === 'vorgang' || route.view === 'questionnaire' || route.view === 'adminVorgang' ? route.id : null

  const switchPerspective = (next: Perspective) => {
    setDemoOpen(false)
    if (next === 'admin') return navigate(currentVorgangId ? `/portal/admin/vorgang/${currentVorgangId}` : '/portal/admin')
    if (next === 'jury') return navigate('/portal/jury')
    const target = currentVorgangId ? snapshot?.submissions.find((item) => item.id === currentVorgangId) : newedgeSubmission(snapshot)
    if (target) {
      demoJump.current = true
      rememberAccount(target.accountId)
      portalDemo?.loginAs(target.accountId)
      return navigate(`/portal/vorgang/${target.id}`)
    }
    navigate('/portal')
  }

  const runScenario = (scenario: ScenarioId) => {
    const newedge = newedgeSubmission(snapshot)
    if (!newedge) return
    portalDemo?.applyScenario(newedge.id, scenario)
    setDemoOpen(false)
    if (perspective === 'admin') return navigate(`/portal/admin/vorgang/${newedge.id}`)
    if (perspective === 'jury') return navigate('/portal/jury')
    demoJump.current = true
    rememberAccount(newedge.accountId)
    portalDemo?.loginAs(newedge.accountId)
    navigate(`/portal/vorgang/${newedge.id}`)
  }

  const resetDemo = () => {
    if (!window.confirm(portalContent.prototype.resetConfirm)) return
    portalDemo?.reset()
    setDemoOpen(false)
    router.replace('/portal/anmelden')
  }


  const handleLogout = async () => {
    await logout()
    router.replace('/portal/anmelden')
  }
  const demoToggle = portalDemo ? { open: demoOpen, onToggle: () => setDemoOpen((open) => !open) } : null
  const demoPanel =
    demoOpen && snapshot && portalDemo ? (
      <DemoPanel
        state={snapshot}
        perspective={perspective}
        onClose={() => setDemoOpen(false)}
        onPerspective={switchPerspective}
        onScenario={runScenario}
        onReset={resetDemo}
        returnTo={
          previousAccountId && account?.id !== previousAccountId && accountOf(snapshot, previousAccountId)
            ? {
                name: accountName(accountOf(snapshot, previousAccountId)),
                onClick: () => {
                  portalDemo?.loginAs(previousAccountId)
                  setPreviousAccountId(null)
                  setDemoOpen(false)
                  navigate('/portal')
                },
              }
            : undefined
        }
      />
    ) : null

  if (!state || (!account && needsAccount) || (account && isAuthView)) {
    // Ladezustand im Rahmen der Zielansicht, damit beim Erscheinen nichts springt.
    return (
      <div className={styles.root}>
        {isAuthView || !account ? (
          <PublicBar />
        ) : (
          <div className={styles.app}>
            <div className={styles.sidebar} aria-hidden="true" />
          </div>
        )}
        <p className={styles.loading} role="status">
          <span className={styles.srOnly}>Wird geladen …</span>
        </p>
      </div>
    )
  }

  const navCopy = portalContent.nav
  // In der Seitenleiste steht nur, wer angemeldet ist und zur Ansicht passt (sonst Demo-Perspektive ohne Anmeldung).
  const shellAccount =
    perspective === 'bewerber'
      ? account
      : (perspective === 'admin' ? account?.role === 'verwaltung' || account?.role === 'sachbearbeitung' : account?.role === 'jury')
        ? account
        : null
  const shellUser = shellAccount
    ? {
        name: accountName(shellAccount),
        role:
          shellAccount.role === 'jury'
            ? JURY_TYPE_LABEL[jurorById(state, shellAccount.jurorId)?.type ?? 'jury1']
            : navCopy.roles[shellAccount.role ?? 'bewerber'],
      }
    : null

  const shell = (navLabel: string, sections: NavSection[], active: string, content: React.ReactNode) => (
    <div className={styles.root}>
      <AppShell navLabel={navLabel} sections={sections} active={active} onNavigate={navigate} user={shellUser} onLogout={handleLogout} demo={demoToggle}>
        {content}
      </AppShell>
      {demoPanel}
      <CommandErrorNotice />
    </div>
  )

  /* ── Verwaltung & Jury (Demo-Perspektiven ohne Anmeldung) ── */
  // Rolle für Rechte in der Verwaltung: Sachbearbeitung eingeschränkt, sonst (auch ohne Anmeldung) volle Verwaltungsrechte.
  const viewer = viewerRole(account)
  if (perspective === 'jury') {
    return shell(navCopy.juryLabel, [{ items: [{ key: 'jury', label: navCopy.jury, href: '/portal/jury', icon: ClipboardCheck }] }], 'jury', <JuryView state={state} account={account} />)
  }

  if (perspective === 'admin') {
    let page: React.ReactNode = null
    if (route.view === 'adminVorgang') {
      const submission = state.submissions.find((item) => item.id === route.id && item.status === 'eingereicht')
      page = submission ? (
        <AdminVorgangSheet
          key={submission.id}
          state={state}
          submission={submission}
          viewer={viewer}
          onClose={() => router.replace(adminBase)}
          onOpenQuestionnaire={() => router.push(`/portal/admin/fragebogen/${submission.id}`)}
          onOpenApplicant={
            portalDemo
              ? () => {
                  rememberAccount(submission.accountId)
                  portalDemo?.loginAs(submission.accountId)
                  navigate(`/portal/vorgang/${submission.id}`)
                }
              : undefined
          }
        />
      ) : (
        <Redirect to={adminBase} />
      )
    }
    if (route.view === 'adminQuestionnaire') {
      const submission = state.submissions.find((item) => item.id === route.id && item.status === 'eingereicht')
      page = submission ? (
        <AdminQuestionnaireSheet
          key={`fb-${submission.id}`}
          submission={submission}
          onClose={() => router.replace(adminBase)}
          onOpenCase={() => router.replace(`/portal/admin/vorgang/${submission.id}${adminTab !== 'uebersicht' ? `?bereich=${adminTab}` : ''}`)}
        />
      ) : (
        <Redirect to={adminBase} />
      )
    }
    if (route.view === 'adminJuror' && !can(viewer, 'jury')) page = <Redirect to="/portal/admin" />
    else if (route.view === 'adminJuror') {
      const juryBase = '/portal/admin?bereich=jury'
      const juror = jurorById(state, route.id)
      if (route.id === 'neu')
        page = <NewJurorSheet key="juror-new" onClose={() => router.replace(juryBase)} onCreated={(id) => router.replace(`/portal/admin/jury/${id}?neu=1`)} />
      else
        page = juror ? (
          <JurorSheet key={`juror-${juror.id}`} state={state} juror={juror} justCreated={searchParams.get('neu') === '1'} onClose={() => router.replace(juryBase)} />
        ) : (
          <Redirect to={juryBase} />
        )
    }

    const activeTab: AdminTab = route.view === 'adminJuror' ? 'jury' : adminTab
    const counts = areaCounts(state)
    const sections = (['arbeit', 'einstellungen'] as const)
      .map((section) => ({
        label: portalContent.admin.navSections[section],
        items: portalContent.admin.tabs
          .filter((tab) => tab.section === section && tabAllowed(viewer, tab.key))
          .map((tab) => ({
            key: tab.key,
            label: tab.label,
            href: tab.key === 'uebersicht' ? '/portal/admin' : `/portal/admin?bereich=${tab.key}`,
            icon: AREA_ICONS[tab.key],
            count: counts[tab.key],
          })),
      }))
      .filter((section) => section.items.length > 0)

    return shell(
      portalContent.admin.navLabel,
      sections,
      activeTab,
      page ?? <AdminOverview state={state} tab={activeTab} navigate={navigate} viewer={viewer} sessionAccountId={account?.id ?? null} />,
    )
  }

  if (!account) {
    return (
      <div className={styles.root}>
        <PublicBar demo={demoToggle} />
        <AuthScreen mode={route.view === 'register' ? 'register' : 'login'} />
        {demoPanel}
      </div>
    )
  }

  /* ── Bewerber ── */
  const submissions = submissionsFor(state, account.id)
  const freshId = route.view === 'overview' ? searchParams.get('neu') : null
  let page: React.ReactNode = null

  if (route.view === 'profile') {
    const continueTo = safeContinue(searchParams.get('weiter'))
    const intent: ProfileIntent = searchParams.get('willkommen') ? 'welcome' : continueTo ? 'beforeSubmission' : 'edit'
    page = (
      <ProfileSheet
        key="profile"
        account={account}
        intent={intent}
        onClose={closeSheet}
        onSaved={() => (continueTo ? router.replace(`/portal/${continueTo}`) : closeSheet())}
      />
    )
  }

  // Schritt-Navigation in der URL (Push), damit die Zurück-Taste einen Schritt zurückgeht.
  const rawStep = searchParams.get('schritt')
  const urlStep = rawStep !== null && /^\d+$/.test(rawStep) ? Number(rawStep) : null
  const pushStep = (next: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('schritt', String(next))
    params.delete('preise')
    router.push(`${pathname}?${params.toString()}`)
  }

  const editorProps = {
    account,
    urlStep,
    onStepChange: pushStep,
    onClose: closeSheet,
    onBeforeSubmit: (id: string) => setPinnedEditorId(id),
    onDone: (id: string) => router.replace(`/portal?neu=${encodeURIComponent(id)}`),
    onEditProfile: (draftId: string) => navigate(`/portal/stammdaten?weiter=${encodeURIComponent(`einreichung/${draftId}`)}`),
  }

  if (route.view === 'new') {
    const draftKey = searchParams.get('entwurf')
    const known = draftKey ? submissions.find((item) => item.id === draftKey) : undefined
    if (known && known.status !== 'entwurf' && pinnedEditorId !== known.id) page = <Redirect to={`/portal/vorgang/${known.id}`} />
    else
      page = (
        <SubmissionSheet
          key="editor"
          {...editorProps}
          draft={known}
          draftKey={draftKey ?? undefined}
          presetType={asType(searchParams.get('art'))}
          registrationClosed={!registrationOpen(state)}
        />
      )
  }

  if (route.view === 'draft') {
    const submission = submissions.find((item) => item.id === route.id)
    if (!submission) page = <Redirect to="/portal" />
    else if (submission.status === 'entwurf' || pinnedEditorId === submission.id)
      page = <SubmissionSheet key="editor" {...editorProps} draft={submission} resumeAtSaved registrationClosed={!registrationOpen(state)} />
    else page = <Redirect to={`/portal/vorgang/${submission.id}`} />
  }

  if (route.view === 'vorgang' || route.view === 'questionnaire') {
    const submission = submissions.find((item) => item.id === route.id && item.status === 'eingereicht')
    if (!submission) page = <Redirect to="/portal" />
    else if (route.view === 'vorgang')
      page = (
        <VorgangSheet
          key={`vorgang-${submission.id}`}
          account={account}
          submission={submission}
          onClose={closeSheet}
          navigate={navigate}
          initialSection={searchParams.get('abschnitt')}
        />
      )
    else
      page = (
        <QuestionnaireSheet
          key={`fragebogen-${submission.id}`}
          submission={submission}
          account={account}
          demoHandover={searchParams.get('demo') === 'uebergabe'}
          openPrizes={searchParams.get('preise') === '1'}
          urlStep={urlStep}
          onStepChange={pushStep}
          onPrizeEntry={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('preise', '1')
            router.replace(`${pathname}?${params.toString()}`)
          }}
          onClose={() => router.replace(`/portal/vorgang/${submission.id}`)}
        />
      )
  }

  const navKey = route.view === 'help' ? 'hilfe' : route.view === 'profile' ? 'stammdaten' : 'vorgaenge'
  const applicantSections: NavSection[] = [
    { items: navCopy.applicant.map((item) => ({ key: item.key, label: item.label, href: item.path, icon: APPLICANT_ICONS[item.key] })) },
  ]

  return shell(
    navCopy.applicantLabel,
    applicantSections,
    navKey,
    page ??
      (route.view === 'help' ? (
        <HelpView />
      ) : (
        <PortalOverview
          account={account}
          submissions={submissions}
          freshId={freshId}
          navigate={navigate}
          startSubmission={startSubmission}
          registration={{ open: registrationOpen(state), deadline: state.roundSettings.registrationDeadline, status: ROUND_LABEL[state.round] }}
        />
      )),
  )
}

const APPLICANT_ICONS: Record<string, LucideIcon> = { vorgaenge: FolderOpen, stammdaten: UserRound, hilfe: CircleHelp }

const AREA_ICONS: Record<AdminTab, LucideIcon> = {
  uebersicht: LayoutDashboard,
  anmeldungen: ClipboardCheck,
  zahlungen: Receipt,
  fragebogen: FileText,
  jury: Scale,
  ergebnisse: Award,
  unterlagen: FolderUp,
  runde: CalendarRange,
  exporte: FileSpreadsheet,
  rechte: KeyRound,
}

function Redirect({ to }: { to: string }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(to)
  }, [router, to])
  return null
}

/** Schmale Kopfleiste für Anmelden und Registrieren (ohne Seitenleiste). */
function PublicBar({ demo }: { demo?: { open: boolean; onToggle: () => void } | null }) {
  const copy = portalContent.bar
  return (
    <header className={styles.bar}>
      <a href="/" className={styles.barBrand} aria-label="Bayerischer Mittelstandspreis – zur Website">
        <Image src="/bmp-logo.png" alt="" width={87} height={34} className={styles.barLogo} />
        <span className={styles.barLabel}>{copy.portalLabel}</span>
      </a>
      {/* Nur Prototyp: Kennzeichnung und Demo-Steuerung. */}
      {demo && (
        <div className={styles.barProto}>
          <span className={styles.protoLabel}>{portalContent.prototype.label}</span>
          <button type="button" className={cx(styles.protoReset, demo.open && styles.protoResetActive)} onClick={demo.onToggle} aria-expanded={demo.open} data-demo-toggle>
            <SlidersHorizontal size={13} aria-hidden="true" />
            <span className={styles.protoResetLabel}>{portalContent.demo.open}</span>
          </button>
        </div>
      )}
      <span className={styles.barSpacer} />
      <a href="/" className={cx(styles.barCell, styles.barWebsite)} aria-label={copy.websiteLink}>
        <ExternalLink size={14} aria-hidden="true" />
        <span className={styles.barCellLabel} aria-hidden="true">
          {copy.websiteLink}
        </span>
      </a>
    </header>
  )
}
