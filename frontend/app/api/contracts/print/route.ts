// ══════════════════════════════════════════════════════════════
//  CONTRAT — Document A4 imprimable (aperçu + téléchargement PDF)
//  ?id=…     → accès staff (admin/agent)
//  ?token=…  → accès public via le lien sécurisé du client
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { contractDocumentHtml, type ContractRow } from '@/lib/contracts'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id')
        const token = request.nextUrl.searchParams.get('token')
        if (!id && !token) return NextResponse.json({ error: 'Paramètre manquant' }, { status: 400 })

        const supabase = createClient(supabaseUrl, serviceKey)
        const query = supabase.from('contracts').select('*')
        const { data, error } = id
            ? await query.eq('id', id).single()
            : await query.eq('sign_token', token).single()

        if (error || !data) {
            return new NextResponse('<h1 style="font-family:Arial;text-align:center;margin-top:80px;color:#5B6474">Contrat introuvable ou lien expiré</h1>', {
                status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
        }

        return new NextResponse(contractDocumentHtml(data as ContractRow), {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        })
    } catch (err) {
        console.error('[contracts print]', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
