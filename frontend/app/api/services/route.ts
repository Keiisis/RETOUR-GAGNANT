import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Route publique : utilise la service role key pour contourner RLS
// Les pages publiques (ServicesGrid, [slug]) appellent cette route au lieu du client anon

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ services: [] })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // ⚠️ NE JAMAIS énumérer les colonnes ici.
        // Les deux tentatives précédentes demandaient `duration, documents,
        // processus` — absentes de la table déployée. PostgREST rejette la
        // requête ENTIÈRE sur une colonne inconnue (42703) : les deux essais
        // échouaient, la route renvoyait `{ services: [] }`, et TOUT le site
        // basculait sur la liste codée en dur. Résultat : un service ajouté en
        // base n'apparaissait jamais, en silence.
        // `select('*')` suit le schéma quel qu'il soit.
        const { data, error } = await supabase.from('services').select('*')

        if (error || !data) {
            return NextResponse.json({ services: [] })
        }

        const services = data
            .filter((s) => s.is_active !== false)
            .sort((a, b) => ((a.order_index ?? a.order ?? 0) as number) - ((b.order_index ?? b.order ?? 0) as number))

        return NextResponse.json({ services })
    } catch {
        return NextResponse.json({ services: [] })
    }
}
