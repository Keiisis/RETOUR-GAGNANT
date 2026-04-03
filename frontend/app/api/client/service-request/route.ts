import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let body: {
        service_id: string
        service_type: string
        service_title: string
        description: string
        phone?: string
        client_email?: string
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { service_id, service_type, service_title, description, phone, client_email } = body

    if (!service_id || !service_type || !description?.trim()) {
        return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const slug = service_id.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    const ref = `REQ-${slug}-${Date.now()}`

    const etapes = [
        { id: 1, label: 'Demande reçue', status: 'completed', date: today, note: '' },
        { id: 2, label: 'Prise en charge', status: 'pending', date: null, note: '' },
        { id: 3, label: 'Traitement en cours', status: 'pending', date: null, note: '' },
        { id: 4, label: 'Finalisation', status: 'pending', date: null, note: '' },
        { id: 5, label: 'Service livré', status: 'pending', date: null, note: '' },
    ]

    // Récupérer l'email vérifié depuis l'auth
    let userEmail = client_email || ''
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(auth.userId!)
        if (user?.email) userEmail = user.email
    } catch {
        // fallback sur l'email transmis par le client
    }

    // Créer un fil de conversation dans la table messages
    // → Le client pourra voir les réponses dans /client/messages
    // → L'agent/admin peut répondre depuis le panel dossier
    const { data: msgThread } = await supabase
        .from('messages')
        .insert({
            client_id:  auth.userId,
            nom:        '',
            prenom:     '',
            email:      userEmail.toLowerCase(),
            telephone:  phone || '',
            sujet:      `[${ref}] ${service_title}`,
            message:    description.trim(),
            type:       'service_request',
            lu:         false,
        })
        .select('id')
        .single()

    const messageThreadId = msgThread?.id || null

    const { data, error } = await supabase
        .from('dossier_tracking')
        .insert({
            num_dossier:       ref,
            client_id:         auth.userId,
            client_email:      userEmail.toLowerCase(),
            client_nom:        '',
            client_prenom:     '',
            client_whatsapp:   phone || '',
            client_phone:      phone || '',
            service_type,
            service:           service_id,
            statut:            'reception',
            etapes,
            progression:       20,
            documents_manquants: [],
            client_message:    description.trim(),
            message_thread_id: messageThreadId,
            notes_internes:    `Demande depuis l'espace client.\nService: ${service_title}\nMessage client: ${description.trim()}\nTél: ${phone || 'Non fourni'}`,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ dossier: data })
}
