import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const groqApiKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
    process.env.GROQ_API_KEY_6
].filter(Boolean) as string[]

async function callGroqWithRetry(keys: string[], prompt: string): Promise<string> {
    const shuffled = [...keys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const groq = new Groq({ apiKey: shuffled[i] })
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' },
                temperature: 0.3
            })
            return completion.choices[0].message.content || '{"items": []}'
        } catch (err) {
            console.warn(`Groq key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Groq ont échoué')
}

interface SelectedItem {
    category: string
    title: string
    address?: string
    rating?: number
    image_url?: string | null
}

export async function POST(req: Request) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Config Supabase manquante' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseKey)
        const body = await req.json()
        const {
            client_name, client_email, client_phone,
            destination, start_date, end_date,
            budget, activities, notes, currency,
            selected_items // Items selected by agent from scraping results
        } = body

        if (!client_name || !destination) {
            return NextResponse.json({ error: 'Nom du client et destination requis.' }, { status: 400 })
        }

        const selectedHotels = (selected_items || []).filter((i: SelectedItem) => i.category === 'hotel')
        const selectedRestaurants = (selected_items || []).filter((i: SelectedItem) => i.category === 'restaurant')
        const selectedActivities = (selected_items || []).filter((i: SelectedItem) => i.category === 'activity')
        const selectedTransport = (selected_items || []).filter((i: SelectedItem) => i.category === 'transport')

        const aiPrompt = `Tu es le meilleur agent de conciergerie VIP au Bénin pour "Retour Gagnant Bénin".
Conçois une proposition d'itinéraire PREMIUM pour ce client.

CLIENT :
- Nom : ${client_name}
- Destination : ${destination}
- Dates : ${start_date || 'Non précisé'} au ${end_date || 'Non précisé'}
- Budget : ${budget || 'Non précisé'}
- Préférences : ${activities || 'Non précisé'}
- Notes : ${notes || 'Aucune'}

ÉLÉMENTS SÉLECTIONNÉS PAR L'AGENT (base tes slides UNIQUEMENT sur ces choix) :
HOTELS : ${JSON.stringify(selectedHotels)}
RESTAURANTS : ${JSON.stringify(selectedRestaurants)}
ACTIVITÉS : ${JSON.stringify(selectedActivities)}
TRANSPORT : ${JSON.stringify(selectedTransport)}

Génère un JSON avec la clé "items" contenant les slides dans cet ordre :
{
  "type": "hero" | "hotel" | "restaurant" | "activity" | "transport" | "pricing",
  "title": "Titre accrocheur en français",
  "subtitle": "Sous-titre court et impactant (5-8 mots)",
  "description": "Description professionnelle, immersive, chaleureuse (3-4 phrases). Parle du Bénin avec passion.",
  "location": "Lieu précis (ex: Ouidah, Bénin)",
  "highlights": ["Point fort 1", "Point fort 2", "Point fort 3"],
  "original_price": 50000,
  "image_url": "URL image si disponible dans les données, sinon null"
}

Règles strictes :
1. "hero" : Première slide d'accueil chaleureuse. Titre GRANDIOSE. (original_price: 0)
2. Crée une slide pour CHAQUE hôtel sélectionné (type:"hotel")
3. Crée une slide pour CHAQUE restaurant sélectionné (type:"restaurant")
4. Crée une slide pour CHAQUE activité sélectionnée (type:"activity")
5. Si transport sélectionné, crée une slide (type:"transport", prix par défaut 40000 FCFA/jour)
6. "pricing" : Slide finale récapitulative. (original_price: 0)
7. Chaque slide DOIT avoir des "highlights" (3 points forts)
8. Chaque slide DOIT avoir un "subtitle" accrocheur
9. Retourne UNIQUEMENT le JSON valide.

Format :
{ "items": [...] }`

        const aiResponse = await callGroqWithRetry(groqApiKeys, aiPrompt)
        const parsed = JSON.parse(aiResponse)

        interface ProposalItem {
            type: string
            title: string
            subtitle?: string
            description: string
            location: string
            highlights?: string[]
            original_price: number
            image_url: string | null
        }

        const items: ProposalItem[] = parsed.items || []

        // Sauvegarde dans DB
        const proposalData: Record<string, unknown> = {
            client_name,
            client_email,
            client_phone,
            destination,
            start_date: start_date || null,
            end_date: end_date || null,
            budget,
            activities,
            notes,
            status: 'draft',
            total_amount: items.reduce((acc: number, item: ProposalItem) => acc + (item.original_price || 0), 0)
        }
        // currency est optionnel selon la version du schéma DB — on l'insère de façon conditionnelle
        // Exécuter d'abord sans currency, si ça plante par son absence c'est qu'elle n'existe pas encore
        let proposal: Record<string, unknown> | null = null
        let proposalError: { message: string; code?: string } | null = null

        // Tentative 1 : avec currency (si la colonne existe)
        const res1 = await supabase.from('ai_client_proposals').insert({
            ...proposalData,
            currency: currency || 'XOF'
        }).select().single()

        if (res1.error) {
            // Si l'erreur est liée à la colonne currency inexistante, réessayer sans
            const isColumnError = res1.error.message?.includes('currency') || res1.error.code === '42703'
            const isCheckError = res1.error.code === '23514' // CHECK constraint violation
            if (isColumnError || isCheckError) {
                const res2 = await supabase.from('ai_client_proposals').insert(proposalData).select().single()
                proposal = res2.data
                proposalError = res2.error
            } else {
                proposalError = res1.error
            }
        } else {
            proposal = res1.data
        }

        if (proposalError) throw new Error(proposalError.message || 'Erreur création proposition')
        if (!proposal) throw new Error('Proposition non créée')

        const proposalItemsToInsert = items.map((item: ProposalItem, index: number) => ({
            proposal_id: proposal!.id,
            type: item.type,
            title: item.title,
            subtitle: item.subtitle || '',
            description: item.description,
            location: item.location || destination,
            highlights: item.highlights || [],
            image_url: item.image_url,
            original_price: item.original_price || 0,
            selling_price: item.original_price || 0,
            order_index: index,
        }))

        const { error: itemsError } = await supabase.from('ai_proposal_items').insert(proposalItemsToInsert)
        if (itemsError) throw new Error(itemsError.message || 'Erreur insertion items')

        return NextResponse.json({ success: true, proposalId: (proposal as Record<string, unknown>).id, secretKey: (proposal as Record<string, unknown>).secret_key })

    } catch (err) {
        console.error('Erreur API Generate Proposal:', err)
        const message = err instanceof Error
            ? err.message
            : (typeof err === 'object' && err !== null && 'message' in err)
                ? String((err as { message: unknown }).message)
                : 'Erreur interne'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
