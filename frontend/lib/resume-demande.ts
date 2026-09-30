// ══════════════════════════════════════════════════════════════
//  Résumé d'une demande (table `messages`) pour les centres de notifications
//  admin et agent : TIRÉ DU MESSAGE RÉEL, jamais d'une formule écrite en dur.
//
//  Avant le 30/09/2026, toute demande de type « nationality » s'affichait
//  « Le profil X a soumis une nouvelle demande de passeport / CI. » : faux pour
//  une demande de nationalité payée (cas TOUCHE, RG-NAT-2026-8925), un dossier
//  complété ou une fiche restaurée.
// ══════════════════════════════════════════════════════════════

const propre = (s?: string | null) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** « Demande de nationalité : TEDDY MICKAËL TOUCHE » (nature lue dans le sujet). */
export function titreDemande(m: { sujet?: string | null; nom?: string | null; prenom?: string | null }): string {
    const nature = propre(m.sujet).replace(/\s*#.*$/, '') || 'Demande de nationalité'
    const qui = propre(`${m.nom || ''} ${m.prenom || ''}`)
    return qui ? `${nature} : ${qui}` : nature
}

/** « Nouvelle demande de nationalité béninoise · Réf. RG-NAT-2026-8925 · 260 EUR ». */
export function resumeDemande(m: { message?: string | null; sujet?: string | null }): string {
    const texte = String(m.message || '')
    const premiere = propre(texte.split('\n').find(l => l.trim()) || '')
    const ref = /R[ée]f[ée]rence\s*:\s*([^\s,)]+)/i.exec(texte)?.[1] || /#\s*([A-Z0-9-]+)/.exec(String(m.sujet || ''))?.[1]
    const montant = propre(/Montant[^:\n]*:\s*([^\n]+)/i.exec(texte)?.[1])
    const morceaux = [premiere, ref && !premiere.includes(ref) ? `Réf. ${ref}` : '', montant ? montant : ''].filter(Boolean)
    return morceaux.join(' · ') || propre(m.sujet) || 'Nouvelle demande'
}
