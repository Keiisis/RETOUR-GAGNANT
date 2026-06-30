import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
        }

        const { id } = await request.json()
        if (!id) {
            return NextResponse.json({ error: 'ID de l\'article manquant' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Fetch current views
        const { data: post, error: fetchError } = await supabase
            .from('blog_posts')
            .select('views')
            .eq('id', id)
            .single()

        if (fetchError || !post) {
            return NextResponse.json({ error: 'Article non trouvé' }, { status: 404 })
        }

        const newViews = (post.views || 0) + 1

        const { error: updateError } = await supabase
            .from('blog_posts')
            .update({ views: newViews })
            .eq('id', id)

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, views: newViews })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur lors de la mise à jour des vues' },
            { status: 500 }
        )
    }
}
