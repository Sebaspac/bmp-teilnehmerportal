'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ExternalLink, LogOut, Menu, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'

import Image from '@/shared/UnoptimizedImage'
import { cx } from '@/portal/ui/fields'
import { portalContent } from '@/portal/content/portalContent'
import styles from '@/portal/ui/portal.module.css'

export type NavItem = { key: string; label: string; href: string; icon: LucideIcon; count?: number }
export type NavSection = { label?: string; items: NavItem[] }

/**
 * App-Rahmen: Navy-Seitenleiste mit den Bereichen der jeweiligen Rolle, Konto und Abmelden; rechts der Inhalt.
 * Unter 1024 px wird die Leiste zur Schublade hinter „Menü“.
 */
export function AppShell({
  navLabel,
  sections,
  active,
  onNavigate,
  user,
  onLogout,
  demo,
  children,
}: {
  navLabel: string
  sections: NavSection[]
  active: string
  onNavigate: (href: string) => void
  /** Angemeldete Person – ohne passende Anmeldung (Demo-Perspektive) leer. */
  user?: { name: string; role: string } | null
  onLogout?: () => void
  /** Nur Prototyp: Kennzeichnung und Demo-Steuerung. */
  demo?: { open: boolean; onToggle: () => void } | null
  children: React.ReactNode
}) {
  const copy = portalContent.nav
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)

  // Mobile Schublade: Escape schließt, Fokus wandert hinein und beim Schließen zurück auf „Menü“.
  useEffect(() => {
    if (!menuOpen) return
    sidebar.current?.querySelector<HTMLElement>('a[aria-current="page"], nav a')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const go = (href: string) => {
    setMenuOpen(false)
    onNavigate(href)
  }

  return (
    <div className={styles.app}>
      <a href="#inhalt" className={cx(styles.srOnly, styles.skipLink)}>
        {copy.skip}
      </a>

      <header className={styles.mobileBar}>
        <a href="/" className={styles.mobileBrand} aria-label="Bayerischer Mittelstandspreis – zur Website">
          <Image src="/bmp-logo.png" alt="" width={70} height={28} className={styles.barLogo} />
          <span>{portalContent.bar.portalLabel}</span>
        </a>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="portal-sidebar"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          {menuOpen ? copy.closeMenu : copy.menu}
        </button>
      </header>

      {menuOpen && <div className={styles.navScrim} onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside id="portal-sidebar" ref={sidebar} className={cx(styles.sidebar, menuOpen && styles.sidebarOpen)} data-overlay-top={menuOpen ? '' : undefined}>
        <div className={styles.sidebarHead}>
          <a href="/" className={styles.sidebarBrand} aria-label="Bayerischer Mittelstandspreis – zur Website">
            <Image src="/bmp-logo.png" alt="" width={87} height={34} className={styles.barLogo} />
            <span className={styles.sidebarBrandLabel}>{portalContent.bar.portalLabel}</span>
          </a>
          {menuOpen && (
            <button
              type="button"
              className={styles.sidebarClose}
              onClick={() => {
                setMenuOpen(false)
                menuButton.current?.focus()
              }}
              aria-label={copy.closeMenu}
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className={styles.sidebarNav} aria-label={navLabel}>
          {sections.map((section, index) => (
            <div key={section.label ?? index} className={styles.navSection}>
              {section.label && <p className={styles.navSectionLabel}>{section.label}</p>}
              <ul className={styles.navList}>
                {section.items.map((item) => {
                  const Icon = item.icon
                  const current = item.key === active
                  return (
                    <li key={item.key}>
                      <a
                        href={item.href}
                        className={cx(styles.navItem, current && styles.navItemActive)}
                        aria-current={current ? 'page' : undefined}
                        onClick={(event) => {
                          event.preventDefault()
                          go(item.href)
                        }}
                      >
                        <Icon size={18} aria-hidden="true" className={styles.navIcon} />
                        <span className={styles.navLabel}>{item.label}</span>
                        {item.count ? (
                          <span className={styles.navCount}>
                            {item.count}
                            <span className={styles.srOnly}> offen</span>
                          </span>
                        ) : null}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFoot}>
          {demo && (
            <div className={styles.protoRow}>
              <span className={styles.protoLabel}>{portalContent.prototype.label}</span>
              <button
                type="button"
                className={cx(styles.protoReset, demo.open && styles.protoResetActive)}
                onClick={() => {
                  setMenuOpen(false)
                  demo.onToggle()
                }}
                aria-expanded={demo.open}
                data-demo-toggle
              >
                <SlidersHorizontal size={13} aria-hidden="true" />
                {portalContent.demo.open}
              </button>
            </div>
          )}
          <div className={styles.sidebarUser}>
            {user ? (
              <>
                <span className={styles.sidebarUserLabel}>{portalContent.bar.accountLabel}</span>
                <span className={styles.sidebarUserName}>{user.name}</span>
                <span className={styles.sidebarUserRole}>{user.role}</span>
              </>
            ) : (
              <span className={styles.sidebarUserRole}>{copy.demoView}</span>
            )}
          </div>
          <div className={styles.sidebarLinks}>
            <a href="/" className={styles.sidebarLink}>
              <ExternalLink size={15} aria-hidden="true" />
              {portalContent.bar.websiteLink}
            </a>
            {user && onLogout && (
              <button type="button" className={styles.sidebarLink} onClick={onLogout}>
                <LogOut size={15} aria-hidden="true" />
                {portalContent.bar.logout}
              </button>
            )}
          </div>
        </div>
      </aside>

      <main id="inhalt" className={styles.appMain} inert={menuOpen ? true : undefined}>
        {children}
      </main>
    </div>
  )
}

/** Kopf einer Listenansicht: Titel, kurzer Satz, Aktionen rechts. */
export function PageHeader({ title, lead, actions, children }: { title: React.ReactNode; lead?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <div className={styles.viewHeadText}>
          <h1 className={styles.viewTitle}>{title}</h1>
          {lead && <p className={styles.viewLead}>{lead}</p>}
        </div>
        {actions && <div className={styles.viewActions}>{actions}</div>}
      </div>
      {children}
    </header>
  )
}
