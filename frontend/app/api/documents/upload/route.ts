// ══════════════════════════════════════════════════════════════
//  Dépôt d'une pièce depuis l'espace client (/mon-compte).
//
//  ⚠️ CETTE ROUTE NE TÉLÉVERSAIT RIEN. Elle recevait le NOM du fichier, sa
//  taille et son type, puis inscrivait en base une ligne avec une adresse
//  inventée (`/uploads/<nom>`). Le fichier lui-même restait sur l'ordinateur
//  du client. L'agent voyait donc une pièce « reçue » qu'il ne pouvait pas
//  ouvrir — le pire des deux mondes : ni le fichier, ni l'aveu qu'il manque.
//
//  Le fichier est désormais réellement déposé dans le bucket PRIVÉ
//  `client-documents`, et la ligne porte son chemin de stockage. La lecture
//  passe par une URL signée à durée courte (cf. /api/admin/documents/signed-url),
//  jamais par un lien public : ce sont des pièces d'identité.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guardPublic, UPLOAD_LIMIT } from '@/lib/api-guard'
import { dossierCourantDe, ouvrirDossier } from '@/lib/dossier-service'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const BUCKET = 'client-documents';
const ALLOWED_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

function sanitizeFileName(name: string): string {
    return name
        .replace(/\.\./g, '')
        .replace(/[/\\]/g, '')
        .replace(/[^\w\-. ]/g, '_')
        .slice(0, 255);
}

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'documents/upload', UPLOAD_LIMIT)
    if (trop) return trop

    try {
        const formData = await req.formData().catch(() => null);
        if (!formData) {
            return NextResponse.json(
                { error: 'Envoi invalide : le fichier doit accompagner la demande.' },
                { status: 400 },
            );
        }

        const fichier = formData.get('file');
        const client_email = String(formData.get('client_email') || '').trim();
        const client_nom = String(formData.get('client_nom') || '').trim();
        const file_type = String(formData.get('file_type') || 'autre').trim();

        if (!client_email || !(fichier instanceof File)) {
            return NextResponse.json({ error: 'Email et fichier requis.' }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
            return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
        }

        const ext = (fichier.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
            return NextResponse.json(
                { error: `Type de fichier non autorisé. Types acceptés : ${ALLOWED_TYPES.join(', ')}` },
                { status: 400 },
            );
        }
        if (fichier.size > MAX_SIZE_BYTES) {
            return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 400 });
        }
        if (fichier.size === 0) {
            return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 });
        }

        const safeName = sanitizeFileName(fichier.name);
        if (!safeName) {
            return NextResponse.json({ error: 'Nom de fichier invalide.' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Un dossier par client : le tri reste lisible même après des centaines
        // de dépôts, et une purge par client devient triviale.
        const dossier = client_email.toLowerCase().replace(/[^\w.@-]/g, '_');
        const chemin = `${dossier}/${Date.now()}_${safeName}`;

        const octets = Buffer.from(await fichier.arrayBuffer());
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
            contentType: fichier.type || 'application/octet-stream',
            upsert: false,
        });

        if (upErr) {
            console.error('[documents/upload] dépôt storage échoué :', upErr.message);
            return NextResponse.json(
                { error: 'Le fichier n’a pas pu être déposé. Réessayez dans un instant.' },
                { status: 502 },
            );
        }

        // ── Une pièce sans dossier n'existe pour personne ──────────────
        //  L'espace client permet de déposer un document hors parcours. Sans
        //  rattachement, la ligne n'apparaissait dans AUCUNE vue d'équipe :
        //  le client croyait avoir transmis, l'agent ne voyait rien.
        //  On raccroche donc au dossier ouvert le plus récent, et à défaut on
        //  en ouvre un — c'est bien une demande du client qui arrive.
        let dossierId = await dossierCourantDe(client_email);
        if (!dossierId) {
            const [prenom, ...reste] = (client_nom || '').trim().split(' ');
            dossierId = await ouvrirDossier({
                service_type: 'Pièces transmises par le client',
                prenom: prenom || '',
                nom: reste.join(' '),
                email: client_email,
                notes: `Ouvert automatiquement au dépôt de « ${safeName} » depuis l'espace client.`,
                source: 'web',
            });
        }

        const { error } = await supabase.from('client_documents').insert({
            client_email,
            client_nom: client_nom || '',
            file_name: safeName,
            // Chemin dans le bucket privé : la lecture se fait par URL signée.
            file_url: chemin,
            storage_path: chemin,
            dossier_id: dossierId,
            file_type: ALLOWED_TYPES.includes(file_type) ? file_type : ext,
            file_size: fichier.size,
            status: 'en_attente',
            source: 'web',
        });

        if (error) {
            // Le fichier est en ligne mais la ligne manque : on retire le fichier
            // plutôt que de laisser un orphelin invisible dans le bucket.
            await supabase.storage.from(BUCKET).remove([chemin]).catch(() => undefined);
            throw error;
        }

        return NextResponse.json({ success: true, chemin });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
