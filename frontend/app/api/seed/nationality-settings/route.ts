import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Seed nationality form settings if not exists
        const { data: existing } = await supabase
            .from('page_sections')
            .select('id')
            .eq('page', 'nationalite')
            .eq('section_key', 'form_settings')
            .single()

        if (!existing) {
            await supabase.from('page_sections').insert({
                page: 'nationalite',
                section_key: 'form_settings',
                title: 'Paramètres du formulaire de nationalité',
                content: {
                    // Demande gratuite depuis l'agrément (nov. 2026) : aucun montant demandé au client.
                    amount: 0,
                    currency: 'EUR',
                    payment_description: 'Demande de nationalité béninoise gratuite (agence agréée)',
                    required_documents: [
                        "Pièce d'identité en cours de validité",
                        'Justificatif de domicile',
                        "Preuve d'afro descendance",
                        'Casier judiciaire ou Certificat d\'antécédents criminels',
                        'Preuve de profession'
                    ]
                },
                sort_order: 1,
                is_active: true,
            })
        }

        return NextResponse.json({ success: true, existed: !!existing })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
