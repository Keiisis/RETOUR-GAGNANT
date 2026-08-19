// ══════════════════════════════════════════════════════════════
//  Pièces jointes d'un récap de dossier MyAfroOrigins.
//
//  Le client dépose ce qu'il a sous la main — capture de son espace
//  MyAfroOrigins, courrier reçu, acte de naissance déjà obtenu. Ces pièces
//  n'ont de sens que rattachées à SA demande : l'onglet du panel ne montre
//  qu'elles, à l'intérieur de la fiche concernée.
//
//  Le même point d'entrée sert au site et à l'application : l'identification
//  se fait par la RÉFÉRENCE du récap + l'email du déposant. Ce couple est
//  connu du seul client (la référence lui est remise par email), et il est
//  revérifié en base à chaque dépôt.
//
//  GET  ?reference=&email=  → les pièces déjà déposées
//  POST (multipart)         → une pièce
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, UPLOAD_LIMIT, flowKey } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const BUCKET = 'client-documents'
const TYPES_AUTORISES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx']
const TAILLE_MAX = 10 * 1024 * 1024 // 10 Mo
const MAX_PIECES = 15

const nettoyerNom = (nom: string) => nom
    .replace(/\.\./g, '').replace(/[/\\]/g, '').replace(/[^\w\-. ]/g, '_').slice(0, 200)

/** Le récap appartient-il bien à ce déposant ? */
async function recapDe(reference: string, email: string) {
    if (!reference || !email) return null
    const { data } = await supabase
        .from('myafro_recap_requests')
        .select('id, reference, email, prenom, nom, statut, dossier_id')
        .eq('reference', reference.trim().toUpperCase())
        .maybeSingle()

    if (!data) return null
    if (String(data.email || '').trim().toLowerCase() !== email.trim().toLowerCase()) return null
    return data
}

export async function GET(request: NextRequest) {
    const p = new URL(request.url).searchParams
    const recap = await recapDe(String(p.get('reference') || ''), String(p.get('email') || ''))
    if (!recap) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 })

    const { data, error } = await supabase
        .from('client_documents')
        .select('id, file_name, file_type, file_size, status, created_at')
        .eq('recap_id', recap.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json(
            { pieces: [], migration_requise: /does not exist|schema cache/i.test(error.message) },
        )
    }
    return NextResponse.json({ pieces: data || [], demande: { reference: recap.reference, statut: recap.statut } })
}

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'recap-myafro/documents', UPLOAD_LIMIT, flowKey(request))
    if (trop) return trop

    const form = await request.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Envoi invalide.' }, { status: 400 })

    const fichier = form.get('file')
    const reference = String(form.get('reference') || '')
    const email = String(form.get('email') || '')
    const source = String(form.get('source') || 'web')

    if (!(fichier instanceof File)) {
        return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
    }

    const recap = await recapDe(reference, email)
    if (!recap) {
        return NextResponse.json(
            { error: 'Référence ou email incorrect. Reprenez la référence reçue par email.' },
            { status: 404 },
        )
    }

    const ext = (fichier.name.split('.').pop() || '').toLowerCase()
    if (!TYPES_AUTORISES.includes(ext)) {
        return NextResponse.json(
            { error: `Type non autorisé. Acceptés : ${TYPES_AUTORISES.join(', ')}` },
            { status: 400 },
        )
    }
    if (fichier.size === 0) return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 })
    if (fichier.size > TAILLE_MAX) {
        return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 400 })
    }

    // Garde-fou de volume : une demande n'a pas besoin de cinquante pièces, et
    // le bucket n'est pas un espace de stockage gratuit.
    const { count } = await supabase
        .from('client_documents').select('id', { count: 'exact', head: true }).eq('recap_id', recap.id)
    if ((count || 0) >= MAX_PIECES) {
        return NextResponse.json(
            { error: `Vous avez atteint ${MAX_PIECES} pièces. Écrivez-nous pour en ajouter davantage.` },
            { status: 409 },
        )
    }

    const nom = nettoyerNom(fichier.name)
    if (!nom) return NextResponse.json({ error: 'Nom de fichier invalide.' }, { status: 400 })

    // Rangement par référence : une demande = un dossier dans le coffre.
    const chemin = `recap/${recap.reference}/${Date.now()}_${nom}`
    const octets = Buffer.from(await fichier.arrayBuffer())

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
        contentType: fichier.type || 'application/octet-stream',
        upsert: false,
    })
    if (upErr) {
        console.error('[recap/documents] dépôt échoué :', upErr.message)
        return NextResponse.json({ error: 'Le dépôt a échoué. Réessayez dans un instant.' }, { status: 502 })
    }

    const { error } = await supabase.from('client_documents').insert({
        client_email: recap.email,
        client_nom: `${recap.prenom} ${recap.nom}`.trim(),
        file_name: nom,
        file_url: chemin,
        storage_path: chemin,
        file_type: ext,
        file_size: fichier.size,
        status: 'en_attente',
        recap_id: recap.id,
        // La pièce rejoint aussi le dossier de suivi : l'agent la voit dans
        // l'onglet Dossiers sans avoir à ouvrir la fiche du récap.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dossier_id: (recap as any).dossier_id || null,
        source: source === 'mobile' ? 'mobile' : 'web',
    })

    if (error) {
        // Fichier en ligne sans ligne en base : on le retire plutôt que de
        // laisser un orphelin que personne ne verra jamais.
        await supabase.storage.from(BUCKET).remove([chemin]).catch(() => undefined)
        const manque = /column .* does not exist|schema cache/i.test(error.message)
        return NextResponse.json(
            {
                error: manque
                    ? 'Dépôt indisponible : la migration 20260821_recap_pieces.sql n’a pas été exécutée.'
                    : error.message,
            },
            { status: 500 },
        )
    }

    return NextResponse.json({ success: true, nom })
}
