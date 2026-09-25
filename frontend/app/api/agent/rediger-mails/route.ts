// ══════════════════════════════════════════════════════════════
//  « Rédiger un mail » : carnet de contacts + historique d'envoi.
//
//  Avant : l'écran interrogeait Supabase DEPUIS LE NAVIGATEUR avec la session
//  de l'agent. La RLS lui refuse ces tables (email_logs = admin seulement,
//  client_profiles = le client lui-même, logement_leads = aucune policy) :
//  contacts et historique revenaient vides, sans erreur visible.
//
//  Ici : lecture service-role, derrière requireStaff('agent') (agents + admins).
//  Aucune écriture.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type ContactType = 'client' | 'lead' | 'partenaire'

interface Contact {
    id: string
    email: string
    nom: string
    prenom: string
    phone?: string
    type: ContactType
}

const PLAFOND = 5000

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const [clientsRes, leadsRes, messagesRes, logsRes] = await Promise.all([
        supabase.from('client_profiles').select('id, prenom, nom, email, phone').not('email', 'is', null).limit(PLAFOND),
        supabase.from('logement_leads').select('id, nom, prenom, email, telephone').not('email', 'is', null).limit(PLAFOND),
        supabase.from('messages').select('nom, prenom, email').not('email', 'is', null).limit(PLAFOND),
        // email_logs ne porte pas l'auteur de l'envoi : l'historique est celui
        // de l'équipe (tous les envois faits depuis cet écran).
        supabase
            .from('email_logs')
            .select('id, to_email, subject, body_html, context, status, created_at')
            .eq('context', 'agent_compose')
            .order('created_at', { ascending: false })
            .limit(50),
    ])

    const erreur = clientsRes.error || leadsRes.error || messagesRes.error || logsRes.error
    if (erreur) {
        console.error('[rediger-mails] lecture:', erreur.message)
    }

    // Priorité : client > lead > expéditeur de message (même email = un seul contact)
    const contacts = new Map<string, Contact>()
    for (const c of clientsRes.data || []) {
        const email = String(c.email || '').trim()
        if (!email) continue
        contacts.set(email.toLowerCase(), {
            id: c.id, email, nom: c.nom || '', prenom: c.prenom || '',
            phone: c.phone || undefined, type: 'client',
        })
    }
    for (const l of leadsRes.data || []) {
        const email = String(l.email || '').trim()
        if (!email || contacts.has(email.toLowerCase())) continue
        contacts.set(email.toLowerCase(), {
            id: l.id, email, nom: l.nom || '', prenom: l.prenom || '',
            phone: l.telephone || undefined, type: 'lead',
        })
    }
    for (const m of messagesRes.data || []) {
        const email = String(m.email || '').trim()
        if (!email || contacts.has(email.toLowerCase())) continue
        contacts.set(email.toLowerCase(), {
            id: email, email, nom: m.nom || '', prenom: m.prenom || '', type: 'client',
        })
    }

    return NextResponse.json({
        contacts: Array.from(contacts.values()).sort((a, b) => a.nom.localeCompare(b.nom)),
        envoyes: logsRes.data || [],
        // Signalé à l'écran plutôt que de laisser croire à un carnet vide.
        partiel: !!erreur,
    })
}
