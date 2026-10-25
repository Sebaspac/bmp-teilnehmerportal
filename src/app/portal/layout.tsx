import React from 'react'

// Sicherheitsnetz für Browser-Zurück/Vor: Lädt der Browser eine Portalseite als neues Dokument und übernimmt React sie
// nicht (beobachtet im Dev-Server, ohne Fehlermeldung), wird sie einmalig neu geladen. Greift nur bei `back_forward` und
// nur, wenn sich das Portal kurz nach `load` nicht als bereit gemeldet hat (`data-portal-ready`, gesetzt in
// src/portal/ui/PortalApp.tsx). Steht im Portal-Layout, weil das Portal nur per Dokumentaufruf betreten wird: Das Layout
// wird auf dem Server gerendert und bei Navigationen innerhalb des Portals nicht neu erzeugt.
const PORTAL_BFCACHE_GUARD = `(function(){try{var n=performance.getEntriesByType('navigation')[0];if(!n||n.type!=='back_forward')return;var k='bmp-portal-neu-geladen:'+location.pathname+location.search;var done=false;function check(){if(done)return;done=true;if(document.documentElement.getAttribute('data-portal-ready'))return;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');location.reload()}window.addEventListener('load',function(){setTimeout(check,700)});setTimeout(check,2500)}catch(e){}})();`

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PORTAL_BFCACHE_GUARD }} />
      {children}
    </>
  )
}
