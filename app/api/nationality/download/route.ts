import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: app, error } = await supabase.from('nationality_applications').select('*').eq('id', id).single();
        if (error || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });

        const zip = new JSZip();

        // 1. Create text summary of all application data
        const summary = `
═══════════════════════════════════════════════════════════
DOSSIER DE DEMANDE DE NATIONALITÉ BÉNINOISE
Retour Gagnant Bénin — Reconnaissance Afro-Descendant
═══════════════════════════════════════════════════════════

RÉFÉRENCE : ${app.application_ref}
DATE DE SOUMISSION : ${app.submitted_at ? new Date(app.submitted_at).toLocaleString('fr-FR') : 'N/A'}
STATUT : ${app.status}

───────────────────────────────────────────────────────────
INFORMATIONS PERSONNELLES
───────────────────────────────────────────────────────────
Nom : ${app.nom}
Prénom(s) : ${app.prenom}
Genre : ${app.genre || 'N/A'}
Date de naissance : ${app.date_naissance || 'N/A'}
Pays de naissance : ${app.pays_naissance || 'N/A'}
Ville de naissance : ${app.ville_naissance || 'N/A'}
Nationalité : ${app.nationalite || 'N/A'}
Pays de résidence : ${app.pays_residence || 'N/A'}
Adresse : ${app.adresse_residence || 'N/A'}
Téléphone : ${app.telephone || 'N/A'}
Email : ${app.email}
Profession : ${app.profession || 'N/A'}
Demande depuis le Bénin : ${app.demande_depuis_benin ? 'Oui' : 'Non'}

───────────────────────────────────────────────────────────
AFRO-DESCENDANCE
───────────────────────────────────────────────────────────
Connaissance de la loi : ${app.knows_about_law ? 'Oui' : 'Non'}
Est afro-descendant(e) : ${app.is_afro_descendant ? 'Oui' : 'Non'}
Description : ${app.afro_descendant_description || 'N/A'}

ANCÊTRE 1 :
  Nom : ${app.ancestor1_nom || 'N/A'}
  Prénom : ${app.ancestor1_prenom || 'N/A'}
  Date de naissance : ${app.ancestor1_date_naissance || 'N/A'}
  Lien de parenté : ${app.ancestor1_lien_parente || 'N/A'}
  Vivant : ${app.ancestor1_vivant ? 'Oui' : 'Non'}
  Nationalité : ${app.ancestor1_nationalite || 'N/A'}
  Pays de résidence : ${app.ancestor1_pays_residence || 'N/A'}
  Autres infos : ${app.ancestor1_autres_infos || 'N/A'}

ANCÊTRE 2 :
  Nom : ${app.ancestor2_nom || 'N/A'}
  Prénom : ${app.ancestor2_prenom || 'N/A'}
  Date de naissance : ${app.ancestor2_date_naissance || 'N/A'}
  Lien de parenté : ${app.ancestor2_lien_parente || 'N/A'}
  Vivant : ${app.ancestor2_vivant ? 'Oui' : 'Non'}
  Nationalité : ${app.ancestor2_nationalite || 'N/A'}
  Pays de résidence : ${app.ancestor2_pays_residence || 'N/A'}
  Autres infos : ${app.ancestor2_autres_infos || 'N/A'}

───────────────────────────────────────────────────────────
DOCUMENT D'IDENTITÉ
───────────────────────────────────────────────────────────
Type : ${app.type_document_identite || 'N/A'}
Numéro : ${app.numero_document || 'N/A'}
Date d'expiration : ${app.date_expiration_document || 'N/A'}
Pays de délivrance : ${app.pays_delivrance || 'N/A'}
Lieu de délivrance : ${app.lieu_delivrance || 'N/A'}
Autorité : ${app.autorite_delivrance || 'N/A'}

───────────────────────────────────────────────────────────
PARENTS
───────────────────────────────────────────────────────────
Père : ${app.pere_prenom || ''} ${app.pere_nom || 'N/A'} — Né le ${app.pere_date_naissance || 'N/A'}
Mère : ${app.mere_prenom || ''} ${app.mere_nom || 'N/A'} — Née le ${app.mere_date_naissance || 'N/A'}

───────────────────────────────────────────────────────────
PAIEMENT
───────────────────────────────────────────────────────────
Montant : ${app.amount} ${app.currency}
Statut paiement : ${app.payment_status}
Référence paiement : ${app.payment_ref || 'N/A'}
Méthode : ${app.payment_method || 'N/A'}

───────────────────────────────────────────────────────────
DOCUMENTS JOINTS
───────────────────────────────────────────────────────────
${Array.isArray(app.documents_uploaded) ? app.documents_uploaded.join('\n') : 'Aucun'}

───────────────────────────────────────────────────────────
NOTES INTERNES
───────────────────────────────────────────────────────────
Agent assigné : ${app.assigned_agent || 'Non assigné'}
Notes agent : ${app.agent_notes || 'Aucune'}
Notes admin : ${app.admin_notes || 'Aucune'}

═══════════════════════════════════════════════════════════
Généré par Retour Gagnant Bénin le ${new Date().toLocaleString('fr-FR')}
═══════════════════════════════════════════════════════════
`;

        zip.file(`Dossier_${app.application_ref}.txt`, summary);

        zip.file(`data_${app.application_ref}.json`, JSON.stringify(app, null, 2));

        // 3. Add actual documents from Storage
        if (Array.isArray(app.documents_uploaded)) {
            for (const docLine of app.documents_uploaded) {
                const parts = docLine.split(': ');
                if (parts.length > 1) {
                    const storagePath = parts[1].trim();
                    if (!storagePath.startsWith('[Erreur')) {
                        const { data, error: dlError } = await supabase.storage.from('nationality_documents').download(storagePath);
                        if (data && !dlError) {
                            const buffer = await data.arrayBuffer();
                            const filename = storagePath.split('/').pop() || storagePath;
                            zip.file(`documents/${filename}`, buffer);
                        }
                    }
                }
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });

        return new NextResponse(zipBlob, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="Dossier_${app.application_ref}.zip"`,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Erreur génération ZIP' }, { status: 500 });
    }
}
