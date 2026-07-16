import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nom, prenom, email, whatsapp, transcript, duration, source } = body

        if (!transcript) {
            return NextResponse.json({ error: 'Transcription vide' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Save to voice_messages table
        const { error: voiceError } = await supabase.from('voice_messages').insert({
            client_nom: nom || '',
            client_prenom: prenom || '',
            client_email: email || '',
            client_whatsapp: whatsapp || '',
            transcript: transcript,
            duration_seconds: duration || 0,
            source: source || 'chat',
            is_read: false,
        })

        if (voiceError) throw voiceError

        // Also add to messages table with special type for admin visibility
        const { error: msgError } = await supabase.from('messages').insert({
            nom: nom || 'Client Vocal',
            prenom: prenom || '',
            email: email || 'vocal@assistant.ia',
 sujet: `Message Vocal (${duration || 0}s) — ${source === 'support_form'? 'Formulaire Support': 'Chat IA'}`,
            message: transcript,
            type: 'support',
            lu: false,
        })

        if (msgError) throw msgError

        return NextResponse.json({ success: true, message: 'Message vocal sauvegardé avec succès' })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur'
        console.error('Voice Save Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
