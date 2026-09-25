// ══════════════════════════════════════════════════════════════
//  POST /api/tracking/piece — pièce manquante déposée depuis /suivi-dossier.
//  FormData : num_dossier, email, doc_name, file.
//
//  Avant (audit 25/09/2026) : dépôt dans le bucket PUBLIC `documents` et mise
//  à jour de dossier_tracking en clé publique ; si le dépôt échouait, la pièce
//  disparaissait quand même de la liste « manquantes ». Et la recherche ne
//  renvoyant pas l'id, le bouton ne faisait en réalité rien.
//  Maintenant : le serveur revérifie le couple numéro + email, dépose dans le
//  bucket PRIVÉ `client-documents`, inscrit la pièce, puis seulement la retire
//  de la liste des manquantes.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServeur } from '@/lib/supabase-serveur'
import { guardPublic, UPLOAD_LIMIT } from '@/lib/api-guard'
import { dossierCourantDe } from '@/lib/dossier-service'
import { normaliserEmail } from '@/lib/espace-email'

const BUCKET = 'client-documents'
const TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx']
const MAX = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Envoi invalide.' }, { status: 400 })

    const num = String(form.get('num_dossier') || '').trim().toUpperCase()
    const email = normaliserEmail(form.get('email'))
    const docName = String(form.get('doc_name') || '').trim()
    const fichier = form.get('file')

    const trop = guardPublic(req, 'tracking/piece', UPLOAD_LIMIT, num ? `suivi:${num}` : undefined)
    if (trop) return trop

    if (!num || !email || !docName || !(fichier instanceof File)) {
        return NextResponse.json({ error: 'Numéro de dossier, email, pièce et fichier requis.' }, { status: 400 })
    }
    const ext = (fichier.name.split('.').pop() || '').toLowerCase()
    if (!TYPES.includes(ext)) return NextResponse.json({ error: `Types acceptés : ${TYPES.join(', ')}` }, { status: 400 })
    if (fichier.size === 0 || fichier.size > MAX) return NextResponse.json({ error: 'Fichier vide ou trop volumineux (max 10 Mo).' }, { status: 400 })

    const { data: suivi } = await supabaseServeur.from('dossier_tracking')
        .select('id, num_dossier, client_email, client_nom, client_prenom, documents_manquants')
        .eq('num_dossier', num).maybeSingle()
    if (!suivi || String(suivi.client_email || '').toLowerCase() !== email) {
        return NextResponse.json({ error: 'Dossier introuvable pour ce numéro et cet email.' }, { status: 404 })
    }
    const manquantes: string[] = Array.isArray(suivi.documents_manquants) ? suivi.documents_manquants : []
    if (!manquantes.includes(docName)) {
        return NextResponse.json({ error: 'Cette pièce n’est plus demandée sur le dossier.' }, { status: 409 })
    }

    const sur = (v: string) => v.replace(/[^\w.@-]/g, '_').slice(0, 80)
    const chemin = `${sur(email)}/suivi/${sur(num)}/${sur(docName)}_${Date.now()}.${ext}`
    const { error: upErr } = await supabaseServeur.storage.from(BUCKET)
        .upload(chemin, Buffer.from(await fichier.arrayBuffer()), { contentType: fichier.type || 'application/octet-stream', upsert: false })
    if (upErr) return NextResponse.json({ error: 'Le fichier n’a pas pu être déposé. Réessayez dans un instant.' }, { status: 502 })

    const { error: insErr } = await supabaseServeur.from('client_documents').insert({
        client_email: email,
        client_nom: `${suivi.client_prenom || ''} ${suivi.client_nom || ''}`.trim(),
        file_name: `${docName}.${ext}`,
        file_url: chemin,
        storage_path: chemin,
        dossier_id: await dossierCourantDe(email),
        file_type: ext,
        file_size: fichier.size,
        status: 'en_attente',
        source: 'web',
    })
    if (insErr) {
        await supabaseServeur.storage.from(BUCKET).remove([chemin]).catch(() => undefined)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    const reste = manquantes.filter(d => d !== docName)
    const { error: majErr } = await supabaseServeur.from('dossier_tracking')
        .update({ documents_manquants: reste }).eq('id', suivi.id)
    if (majErr) return NextResponse.json({ error: majErr.message }, { status: 500 })

    return NextResponse.json({ success: true, documents_manquants: reste })
}
