import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from '@/lib/document-numbering'

// Service role key → bypass RLS (le client portail n'est pas authentifié)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { document_id, signature_url } = body

        if (!document_id || !signature_url) {
            return NextResponse.json({ error: 'document_id et signature_url requis' }, { status: 400 })
        }

        // 1. Récupérer le devis original (pour copier agent_id et données)
        const { data: devis, error: fetchError } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('id', document_id)
            .eq('type', 'devis')
            .single()

        if (fetchError || !devis) {
            return NextResponse.json({ error: 'Devis introuvable ou déjà traité' }, { status: 404 })
        }

        // Guard: if devis is already signed, check for existing facture and return it
        if (devis.status === 'accepte') {
            const { data: existingFacture } = await supabase
                .from('documents_financiers')
                .select('id, numero')
                .eq('parent_devis_id', document_id)
                .eq('type', 'facture')
                .maybeSingle()

            return NextResponse.json({
                success: true,
                signed_at: devis.signed_at || new Date().toISOString(),
                numeroFacture: existingFacture?.numero || null,
                factureId: existingFacture?.id || null,
                alreadyExists: true,
            })
        }

        const signed_at = new Date().toISOString()

        // 2. Mettre à jour le statut + signature du devis
        const { error: updateError } = await supabase
            .from('documents_financiers')
            .update({
                status: 'accepte',
                signature_url,
                signed_at,
            })
            .eq('id', document_id)

        if (updateError) throw new Error(updateError.message)

        // 3. Vérifier si une facture existe déjà pour éviter les doublons
        const { data: existingFacture } = await supabase
            .from('documents_financiers')
            .select('id, numero')
            .eq('parent_devis_id', document_id)
            .eq('type', 'facture')
            .maybeSingle()

        if (existingFacture) {
            // Facture déjà créée (re-signature) — retourner la facture existante
            return NextResponse.json({
                success: true,
                signed_at,
                numeroFacture: existingFacture.numero,
                factureId: existingFacture.id,
                alreadyExists: true,
            })
        }

        // 4. Générer la facture liée (avec agent_id pour visibilité côté agent/admin)
        const numeroFacture = await nextDocumentNumber(supabase, 'facture')

        const { data: newFacture, error: insertError } = await supabase
            .from('documents_financiers')
            .insert({
                type: 'facture',
                numero: numeroFacture,
                parent_devis_id: document_id,
                agent_id: devis.agent_id, // Copier l'agent_id pour que l'agent puisse la voir
                client_nom: devis.client_nom,
                client_prenom: devis.client_prenom,
                client_email: devis.client_email,
                client_phone: devis.client_phone,
                client_adresse: devis.client_adresse,
                items: devis.items,
                currency: devis.currency || 'XOF',
                sous_total: devis.sous_total,
                total_tva: devis.total_tva,
                remise: devis.remise,
                total: devis.total,
                signature_url: signature_url,
                signed_at: signed_at,
                status: 'envoye',
                notes: `Facture générée automatiquement suite à la validation du devis N° ${devis.numero}.`,
                conditions: devis.conditions,
                validite: 'À réception',
            })
            .select('id')
            .single()

        if (insertError) throw new Error(`Erreur création facture: ${insertError.message} (code: ${insertError.code})`)

        return NextResponse.json({
            success: true,
            signed_at,
            numeroFacture,
            factureId: newFacture?.id,
        })

    } catch (err) {
        console.error('Erreur API sign document:', err)
        const message = err instanceof Error ? err.message : 'Erreur interne'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
