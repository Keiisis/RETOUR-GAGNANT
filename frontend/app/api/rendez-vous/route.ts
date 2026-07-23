import { NextRequest, NextResponse } from 'next/server';
import { isSlotBookable } from '@/lib/availability'
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getEmailTemplates } from '@/lib/email';
import { getStaffToLine } from '@/lib/staff-recipients';
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { trackClient } from '@/lib/classement/track';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ── Base de connaissances par service (alimente la réponse autonome de l'IA) ──
// Permet à l'assistant de répondre concrètement selon le service choisi :
// ce qu'on fait, les pièces utiles à préparer, les points de vigilance.
const SERVICE_KNOWLEDGE: { match: string[]; brief: string }[] = [
    {
        match: ['passeport', 'document', 'administratif', 'cip', 'état civil', 'etat civil'],
        brief: "Passeport & documents officiels : enrôlement, acte de naissance, CIP, passeport. Pièces utiles : pièce d'identité, justificatif d'état civil, justificatif de domicile. On accompagne la diaspora à distance et sur place à Cotonou.",
    },
    {
        match: ['logement', 'immobilier', 'louer', 'acheter', 'foncier', 'terrain', 'bien'],
        brief: "Immobilier & foncier : vérification de titres fonciers, sécurisation d'achat/location, lutte contre les arnaques foncières. Pièces utiles : localisation du bien, documents fonciers existants, budget approximatif.",
    },
    {
        match: ['entreprise', 'business', 'société', 'societe', 'création'],
        brief: "Création d'entreprise au Bénin : immatriculation (RCCM, IFU), choix de la forme juridique, domiciliation. Pièces utiles : pièce d'identité, activité envisagée, associés éventuels.",
    },
    {
        match: ['culture', 'tourisme', 'guide', 'cauris', 'racines'],
        brief: "Tourisme & culture : circuits sur les racines, accompagnement culturel, logistique sur place. Utile : dates envisagées, nombre de personnes, centres d'intérêt.",
    },
    {
        match: ['chantier', 'construction', 'bâtir', 'batir', 'suivi'],
        brief: "Suivi de chantier : supervision de construction à distance, rapports photo/vidéo, contrôle des artisans. Utile : localisation du chantier, état d'avancement, type d'ouvrage.",
    },
    {
        match: ['investissement', 'investir', 'rendement', 'affaires'],
        brief: "Investissement : opportunités locales, accompagnement et sécurisation. Utile : secteur visé, horizon, montant envisagé. Aucune promesse de rendement — analyse au cas par cas.",
    },
    {
        match: ['nationalité', 'nationalite', 'vip', 'citoyenneté', 'citoyennete'],
        brief: "Nationalité VIP (afro-descendants) : accompagnement à l'obtention de la nationalité béninoise. Pièces souvent demandées : actes de naissance (et ascendants si possible), pièce d'identité, justificatifs de filiation/afro-descendance. Le test d'éligibilité gratuit (« L'Oracle ») permet une première analyse.",
    },
    {
        match: ['ancestral', 'ancêtre', 'ancetre', 'généalogie', 'genealogie', 'recherche'],
        brief: "Recherche ancestrale : reconstitution de la filiation, archives, généalogie liée à la traite. Utile : tout document familial, noms/lieux connus, récits de famille.",
    },
];

function knowledgeFor(service: string): string {
    const s = (service || '').toLowerCase();
    const hit = SERVICE_KNOWLEDGE.find(k => k.match.some(m => s.includes(m)));
    return hit?.brief || "Service d'accompagnement de la diaspora. Notre équipe analysera précisément votre besoin.";
}

async function generateAutoReply(clientName: string, service: string, message: string): Promise<string> {
    const fallback = "Bonjour " + (clientName || '') + ", nous avons bien reçu votre demande concernant « " + (service || 'votre projet') + " ». Un conseiller dédié l'étudie et vous recontactera sous 24h avec les prochaines étapes. En attendant, vous pouvez nous joindre sur WhatsApp au +229 01 60 32 21 21.";
    try {
        if (GROQ_KEYS.length === 0) return fallback;

        const knowledge = knowledgeFor(service);
        const hasMessage = !!(message && message.trim());

        const res = await fetchWithGroqRotation({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `Tu es le conseiller virtuel de Retour Gagnant Bénin (accompagnement de la diaspora béninoise et afro-descendante). Un visiteur vient de demander un rendez-vous. Tu rédiges LE message de réponse personnalisé qui lui sera envoyé immédiatement par email, AVANT qu'un conseiller humain ne le rappelle.

OBJECTIF : le rassurer, montrer qu'on a VRAIMENT lu et compris sa demande, et le fidéliser en lui apportant déjà une vraie valeur — de façon autonome, sans qu'un agent intervienne.

RAISONNE d'abord sur sa situation précise (son service + son message), puis réponds.

RÈGLES :
- Réponds DIRECTEMENT et CONCRÈTEMENT à ce qu'il écrit. S'il pose une question, donne un premier éclairage utile.
- Appuie-toi sur les informations métier fournies ci-dessous pour donner des conseils pertinents (ex. pièces à préparer, prochaines étapes).
- Chaleureux, professionnel, humain. Tutoiement non — vouvoie poliment.
- 5 à 8 phrases, structurées et fluides. PAS de markdown, pas de listes à puces, pas de titres.
- Ne donne JAMAIS de prix chiffré ni de date/heure ferme (le conseiller les confirmera).
- Ne promets aucun résultat garanti (nationalité, rendement, délai administratif).
- Termine en indiquant qu'un conseiller dédié le recontactera sous 24h, et propose le WhatsApp +229 01 60 32 21 21 pour toute urgence.
- Rédige en français.

INFORMATIONS MÉTIER SUR LE SERVICE CONCERNÉ :
${knowledge}`,
                },
                {
                    role: 'user',
                    content: `Client : "${clientName || 'Visiteur'}"
Service demandé : "${service || 'Non précisé'}"
Message du client : ${hasMessage ? `"${message.trim()}"` : "(aucun message écrit — adapte une réponse d'accueil pertinente pour ce service)"}`,
                },
            ],
            temperature: 0.6,
            max_tokens: 500,
        });

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        return reply && reply.length > 20 ? reply : fallback;
    } catch {
        return fallback;
    }
}

// Mapping timeSlot → heure
function mapTimeSlot(timeSlot: string): string {
    const lower = (timeSlot || '').toLowerCase();
    if (lower.includes('matin') || lower.includes('morning') || lower.includes('9h') || lower.includes('10h')) return '09:00';
    if (lower.includes('après-midi') || lower.includes('apres-midi') || lower.includes('afternoon') || lower.includes('13h') || lower.includes('14h')) return '14:00';
    if (lower.includes('soir') || lower.includes('evening') || lower.includes('17h') || lower.includes('18h')) return '17:00';
    // If it looks like a time already (HH:MM)
    if (/^\d{1,2}:\d{2}$/.test(timeSlot)) return timeSlot;
    return '09:00';
}

// Mapping contactMethod → type rdv
function mapContactMethod(contactMethod: string): 'presentiel' | 'visio' | 'telephone' {
    const lower = (contactMethod || '').toLowerCase();
    if (lower.includes('présentiel') || lower.includes('presentiel') || lower.includes('cotonou') || lower.includes('bureau')) return 'presentiel';
    if (lower.includes('meet') || lower.includes('visio') || lower.includes('video') || lower.includes('zoom') || lower.includes('teams')) return 'visio';
    return 'telephone'; // WhatsApp, appel, téléphone, etc.
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, telephone, service, message, date, timeSlot, contactMethod } = body;

        if (!nom || !email) {
            return NextResponse.json({ error: 'Nom et email sont requis.' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const clientName = `${prenom || ''} ${nom}`.trim();

        // Encoder les infos visiteur dans notes (pas de compte, pas de client_id)
        // Format structuré pour que l'agenda agent puisse parser le nom/téléphone
        const notesParts = [`__VISITOR__: ${clientName} | Tel: ${telephone || 'N/A'}`];
        if (message?.trim()) notesParts.push(`---\nMessage: ${message.trim()}`);
        const notesContent = notesParts.join('\n');

        // ── CONTRÔLE DE DISPONIBILITÉ (anti-conflit) ──────────────────
        // Le créneau doit être ouvert ET non complet. Sans horaires
        // configurés en base, on n'impose rien (compatibilité ascendante).
        const heureDemandee = mapTimeSlot(timeSlot)
        if (date && heureDemandee) {
            const { ok, reason } = await isSlotBookable(supabase, String(date), String(heureDemandee), service || null)
            if (!ok && reason && reason !== 'Horaires non configurés') {
                return NextResponse.json(
                    { error: `Ce créneau n'est plus disponible : ${reason}. Merci d'en choisir un autre.` },
                    { status: 409 },
                )
            }
        }

        // Sauvegarder dans rdv_requests (table unifiée pour tous les RDV)
        const { data: insertedRdv, error: rdvError } = await supabase
            .from('rdv_requests')
            .insert([{
                client_id: null,
                client_email: email,
                date: date || null,
                heure: heureDemandee,
                type: mapContactMethod(contactMethod),
                motif: service || 'Consultation générale',
                notes: notesContent,
                statut: 'en_attente',
            }])
            .select('id')
            .single();

        if (rdvError) throw rdvError;
        const rdvId = insertedRdv?.id || '';

        // Notification in-app pour les panels Admin + Agent (fire-and-forget)
        void supabase.from('messages').insert([{
            nom: clientName,
            email,
            telephone: telephone || null,
            sujet: `Nouvelle demande de RDV — ${service || 'Consultation'}`,
            message: `${clientName} a demandé un rendez-vous.\n\nService : ${service || 'Consultation'}\n${date ? `Date souhaitée : ${date} ${timeSlot || ''}\n` : ''}Canal : ${contactMethod || 'téléphone'}\nTéléphone : ${telephone || 'non communiqué'}\n${message?.trim() ? `\nMessage :\n${message.trim()}` : ''}\n\n→ À traiter dans l'onglet Rendez-vous (Agenda) du panel Agent.`,
            type: 'rdv',
            lu: false,
        }]).then(({ error: msgErr }) => {
            if (msgErr) console.log('[RDV] notification in-app échouée (non bloquant):', msgErr.message);
        });

        // Fire-and-forget : emails de confirmation + notification agent
        (async () => {
            try {
                const aiReply = await generateAutoReply(clientName, service || 'Consultation', message || '');
                const templates = await getEmailTemplates('fr');

                // Email de confirmation au visiteur (sans CTA "réserver un rdv" — illogique)
                await sendEmail({
                    to: email,
 subject: `Retour Gagnant — Votre demande de rendez-vous est enregistrée`,
                    html: await templates.rdvConfirmation(clientName, service || 'Consultation', date, timeSlot, contactMethod, aiReply, message || ''),
                    context: 'rdv_confirmation',
                    relatedId: rdvId,
                });

                // Notification équipe — 5 destinataires fixes + admin configuré
                // (l'agent ET l'admin doivent recevoir chaque demande de RDV)
                const staffTo = await getStaffToLine();
                await sendEmail({
                    to: staffTo,
 subject: `Nouveau RDV — ${clientName} (${service || 'Consultation'})`,
                    html: await templates.rdvAdminNotification(clientName, email, service || 'Consultation', date, timeSlot, contactMethod, telephone || '', message || '', aiReply),
                    context: 'admin_notification',
                    relatedId: rdvId,
                });
            } catch (emailErr) {
                console.log('[RDV] Email send failed (non-blocking):', emailErr);
            }

            // Notification WhatsApp automatique (no-op si non configuré)
            try {
                await sendWhatsAppNotification(
                    ` Nouveau RDV — Retour Gagnant\n` +
                    `Client : ${clientName}\n` +
                    `Service : ${service || 'Consultation'}\n` +
                    `Tél : ${telephone || 'non communiqué'}\n` +
                    `Email : ${email}\n` +
                    (date ? `Date souhaitée : ${date} ${timeSlot || ''}\n` : '') +
                    (message ? `Message : ${message.slice(0, 300)}` : '')
                );
            } catch (waErr) {
                console.log('[RDV] WhatsApp non-blocking:', waErr);
            }

            // Classement Client automatique (CRM)
            await trackClient({ email, full_name: clientName, phone: telephone, serviceLabel: service, source: 'rdv' });
        })();

        return NextResponse.json({ success: true, message: 'Demande de rendez-vous envoyée !' });
    } catch (error) {
        console.error('[RDV POST]', error);
        return NextResponse.json({ error: 'Erreur lors de la soumission.' }, { status: 500 });
    }
}
