import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import axios from 'axios'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Pool de clés API avec rotation
const groqApiKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
    process.env.GROQ_API_KEY_6
].filter(Boolean) as string[]

const serperApiKeys = [
    process.env.SERPER_API_KEY_1,
    process.env.SERPER_API_KEY_2,
    process.env.SERPER_API_KEY_3,
    process.env.SERPER_API_KEY
].filter(Boolean) as string[]



// Retry intelligent : si une clé échoue, essayer les suivantes
async function callGroqWithRetry(keys: string[], prompt: string): Promise<string> {
    const shuffled = [...keys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const groq = new Groq({ apiKey: shuffled[i] })
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' },
                temperature: 0.2
            })
            return completion.choices[0].message.content || '{"results": []}'
        } catch (err) {
            console.warn(`Groq key ${i + 1} failed, trying next...`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Groq ont échoué')
}

async function callSerperWithRetry(keys: string[], query: string): Promise<unknown> {
    const shuffled = [...keys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const res = await axios.post(
                'https://google.serper.dev/maps',
                { q: query, gl: 'bj', hl: 'fr' },
                { headers: { 'X-API-KEY': shuffled[i], 'Content-Type': 'application/json' }, timeout: 15000 }
            )
            return res.data
        } catch (err) {
            console.warn(`Serper key ${i + 1} failed, trying next...`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Serper ont échoué')
}

// ═══════════════════════════════════════════════════════
// GET : Historique des recherches + Leads existants
// ═══════════════════════════════════════════════════════
export async function GET(req: Request) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Config Supabase manquante' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { searchParams } = new URL(req.url)
        const action = searchParams.get('action')

        // Stats globales
        if (action === 'stats') {
            const { data: totalLeads } = await supabase
                .from('ai_prospection_leads')
                .select('id', { count: 'exact', head: true })

            const { data: topKeywords } = await supabase
                .from('ai_prospection_leads')
                .select('keyword')

            const { data: topCities } = await supabase
                .from('ai_prospection_leads')
                .select('city')

            const { data: favorites } = await supabase
                .from('ai_prospection_leads')
                .select('id', { count: 'exact', head: true })
                .eq('is_favorite', true)

            const { data: withPhone } = await supabase
                .from('ai_prospection_leads')
                .select('id', { count: 'exact', head: true })
                .not('phone', 'is', null)

            // Comptage par keyword
            const keywordCounts: Record<string, number> = {}
            topKeywords?.forEach((r: { keyword: string }) => {
                keywordCounts[r.keyword] = (keywordCounts[r.keyword] || 0) + 1
            })
            const cityCounts: Record<string, number> = {}
            topCities?.forEach((r: { city: string }) => {
                cityCounts[r.city] = (cityCounts[r.city] || 0) + 1
            })

            return NextResponse.json({
                totalLeads: totalLeads?.length ?? 0,
                totalFavorites: favorites?.length ?? 0,
                totalWithPhone: withPhone?.length ?? 0,
                topKeywords: Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
                topCities: Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
            })
        }

        // Historique des recherches
        if (action === 'history') {
            const { data } = await supabase
                .from('ai_radar_searches')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20)
            return NextResponse.json({ searches: data || [] })
        }

        // Export CSV
        if (action === 'export') {
            const keyword = searchParams.get('keyword')
            const city = searchParams.get('city')

            let query = supabase.from('ai_prospection_leads')
                .select('title, address, phone, rating, reviews_count, description, keyword, city, relevance_score, status, is_favorite, created_at')
                .order('relevance_score', { ascending: false })

            if (keyword) query = query.eq('keyword', keyword)
            if (city) query = query.eq('city', city)

            const { data } = await query.limit(500)
            const leads = data || []

            // Générer le CSV
            const headers = 'Nom,Adresse,Telephone,Note,Avis,Description,Mot-cle,Ville,Score,Statut,Favori,Date\n'
            const rows = leads.map(l =>
                `"${l.title}","${l.address}","${l.phone || ''}","${l.rating || ''}","${l.reviews_count || ''}","${(l.description || '').replace(/"/g, '""')}","${l.keyword}","${l.city}","${l.relevance_score}","${l.status}","${l.is_favorite}","${l.created_at}"`
            ).join('\n')

            return new Response(headers + rows, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="radar-leads-${Date.now()}.csv"`
                }
            })
        }

        // Liste des leads avec filtres
        const keyword = searchParams.get('keyword')
        const city = searchParams.get('city')
        const minRating = searchParams.get('minRating')
        const onlyWithPhone = searchParams.get('onlyWithPhone')
        const onlyFavorites = searchParams.get('onlyFavorites')
        const status = searchParams.get('status')
        const sortBy = searchParams.get('sortBy') || 'relevance_score'
        const sortDir = searchParams.get('sortDir') === 'asc' ? true : false
        const page = parseInt(searchParams.get('page') || '1')
        const perPage = 20

        let query = supabase.from('ai_prospection_leads')
            .select('*')
            .order(sortBy, { ascending: sortDir })
            .range((page - 1) * perPage, page * perPage - 1)

        if (keyword) query = query.ilike('keyword', `%${keyword}%`)
        if (city) query = query.ilike('city', `%${city}%`)
        if (minRating) query = query.gte('rating', minRating)
        if (onlyWithPhone === 'true') query = query.not('phone', 'is', null)
        if (onlyFavorites === 'true') query = query.eq('is_favorite', true)
        if (status && status !== 'all') query = query.eq('status', status)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ data: data || [] })

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// ═══════════════════════════════════════════════════════
// POST : Lancer un scan (avec cache, dedup, retry, score IA)
// ═══════════════════════════════════════════════════════
export async function POST(req: Request) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Config Supabase manquante' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { keyword, city, filters } = await req.json()

        if (!keyword || !city) {
            return NextResponse.json({ error: 'Mot clé et ville obligatoires' }, { status: 400 })
        }
        if (serperApiKeys.length === 0) {
            return NextResponse.json({ error: 'Clés API Serper manquantes' }, { status: 500 })
        }
        if (groqApiKeys.length === 0) {
            return NextResponse.json({ error: 'Clés API Groq manquantes' }, { status: 500 })
        }

        const normalizedKeyword = keyword.trim().toLowerCase()
        const normalizedCity = city.trim().toLowerCase()

        // ── CACHE : Vérifier si une recherche récente existe (<24h) ──
        const { data: cachedSearch } = await supabase
            .from('ai_radar_searches')
            .select('*')
            .eq('keyword', normalizedKeyword)
            .eq('city', normalizedCity)
            .gt('cached_until', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (cachedSearch && cachedSearch.results_count > 0) {
            // Servir les résultats du cache
            const { data: cachedLeads } = await supabase
                .from('ai_prospection_leads')
                .select('*')
                .eq('keyword', normalizedKeyword)
                .eq('city', normalizedCity)
                .order('relevance_score', { ascending: false })

            return NextResponse.json({
                success: true,
                data: cachedLeads || [],
                cached: true,
                message: `Résultats en cache (${cachedSearch.results_count} leads). Recherche originale : ${new Date(cachedSearch.created_at).toLocaleDateString('fr-FR')}`
            })
        }

        // ── SCRAPING avec retry ──
        const searchQuery = `${keyword} ${city} Benin`
        const searchData = await callSerperWithRetry(serperApiKeys, searchQuery) as { places?: Array<Record<string, unknown>> }
        const places = searchData.places

        if (!places || places.length === 0) {
            return NextResponse.json({ success: true, data: [], message: 'Aucun résultat trouvé.' })
        }

        // ── DÉDUPLICATION : Exclure les lieux déjà en BDD ──
        const { data: existingLeads } = await supabase
            .from('ai_prospection_leads')
            .select('title')
            .eq('city', normalizedCity)

        const existingTitles = new Set((existingLeads || []).map((l: { title: string }) => l.title.toLowerCase().trim()))
        const newPlaces = places.filter((p: Record<string, unknown>) => !existingTitles.has((p.title as string || '').toLowerCase().trim()))

        if (newPlaces.length === 0) {
            // Retourner les existants
            const { data: existing } = await supabase
                .from('ai_prospection_leads')
                .select('*')
                .eq('keyword', normalizedKeyword)
                .eq('city', normalizedCity)
                .order('relevance_score', { ascending: false })

            return NextResponse.json({
                success: true,
                data: existing || [],
                cached: true,
                message: 'Tous les résultats sont déjà en base. Aucun doublon ajouté.'
            })
        }

        const topPlaces = newPlaces.slice(0, 100) // Augmenté pour tout rafler au maximum

        // ── ENRICHISSEMENT IA avec score de pertinence ──
        const minRating = filters?.minRating || 0
        const requirePhone = filters?.requirePhone || false

        const aiPrompt = `Tu es une IA experte en Data Mining, prospection B2B et géolocalisation au Bénin.
Voici des données brutes de lieux récupérés sur Google Maps pour une recherche ciblée sur la VILLE/ZONE de : "${city.toUpperCase()}".

DONNÉES BRUTES :
${JSON.stringify(topPlaces)}

INSTRUCTIONS STRICTES ET IMPÉRATIVES :
1. FILTRAGE GÉOGRAPHIQUE INTELLIGENT : Conserve tous les lieux qui se trouvent bien à "${city.toUpperCase()}" ou dans sa localité/commune directe. Accepte les variations d'orthographe (ex: Ganvie / Ganvié). Rejette fermement les lieux qui sont manifestement dans une toute AUTRE grande ville différente (ex: si on cherche "Ganvié", on rejette "Cotonou" ou "Ouidah", MAIS on accepte les lieux situés sur le Lac Nokoué, Sô-Ava ou la commune d'Abomey-Calavi s'ils sont pertinents). Ne sois pas "trop" strict si l'adresse Google Maps est un peu floue ou imprécise, tant que le lieu n'est pas hors zone.
2. INCLUSION TOTALE DES NON-NOTÉS : Tu DOIS conserver et inclure TOUS les résultats pertinents, MÊME S'ILS N'ONT AUCUNE NOTE (rating inexistant, null, ou 0). Ne discrimine surtout pas les lieux sans avis.
3. Ne retourne QUE l'objet JSON, sans markdown ou texte avant/après. Ne génère aucune phrase d'ouverture !
4. Pour chaque lieu validé :
   - "title": Nom exact.
   - "address": Adresse exacte. Si manquante ou trop courte, complète avec "${city}, Bénin".
   - "phone": Formate au format WhatsApp Bénin : "+229XXXXXXXX" (si fourni, sinon null).
   - "rating": La note d'origine (si aucune note, mets null, ne mets pas 0).
   - "reviews_count": Nombre d'avis (si aucun avis, mets 0).
   - "description": Rédige une courte description marketing percutante et professionnelle (3 phrases max).
   - "relevance_score": Attribue un score de 0 à 100. Critères : zone parfaite = +50 points, téléphone = +30, données = +20.
   - "whatsapp_template": Un message professionnel court (3-4 lignes) d'approche B2B pour un partenariat, prêt à envoyer sur WhatsApp.
   - "original_photo_url": Conserve la valeur de "thumbnailUrl" si elle existe dans les données brutes, sinon null.
${minRating > 0 ? `5. FILTRE ADDITIONNEL VITAL : Le client exige une note minimum de ${minRating}. Exclus STRICTEMENT tout lieu dont la note est inférieure à ${minRating}. (Note: Si la note est null/inexistante, EXCLUS le lieu aussi car il n'a pas la note minimale requise).` : ''}
${requirePhone ? '6. FILTRE ADDITIONNEL VITAL : Exclure systématiquement tout lieu sans numéro de téléphone.' : ''}

Format de Sortie JSON strict :
{
  "results": [
    {
      "title": "Nom",
      "address": "Adresse",
      "phone": "+229XXXXXXXX",
      "rating": 4.5,
      "reviews_count": 120,
      "description": "Description...",
      "original_photo_url": "https://...",
      "relevance_score": 85,
      "whatsapp_template": "Bonjour [Nom du lieu]..."
    }
  ]
}`

        const aiContent = await callGroqWithRetry(groqApiKeys, aiPrompt)
        const aiOutput = JSON.parse(aiContent)
        const enhancedLeads = aiOutput.results || []

        // ── STOCKAGE (Images + BDD) ──
        const savedLeads = []
        await supabase.storage.createBucket('leads-images', { public: true }).catch(() => {})

        for (const lead of enhancedLeads) {
            let finalPhotoUrl: string | null = null

            if (lead.original_photo_url) {
                try {
                    const photoRes = await axios.get(lead.original_photo_url, { responseType: 'arraybuffer', timeout: 8000 })
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
                    const { error: upErr } = await supabase.storage.from('leads-images')
                        .upload(`radar/${fileName}`, photoRes.data, { contentType: 'image/jpeg', upsert: true })
                    if (!upErr) {
                        const { data: pubData } = supabase.storage.from('leads-images').getPublicUrl(`radar/${fileName}`)
                        finalPhotoUrl = pubData.publicUrl
                    }
                } catch { console.warn('Image skipped:', lead.title) }
            }

            const { data: dbItem, error: dbError } = await supabase.from('ai_prospection_leads').insert({
                keyword: normalizedKeyword,
                city: normalizedCity,
                title: lead.title,
                address: lead.address,
                phone: lead.phone,
                description: lead.description,
                rating: lead.rating ? String(lead.rating) : null,
                reviews_count: lead.reviews_count ? parseInt(String(lead.reviews_count)) : null,
                photo_url: finalPhotoUrl,
                relevance_score: lead.relevance_score || 0,
                whatsapp_template: lead.whatsapp_template || null,
                status: 'new'
            }).select('*').single()

            if (dbError) {
                console.warn('Erreur insertion lead:', dbError.message)
            }

            savedLeads.push(dbItem || { ...lead, photo_url: finalPhotoUrl || lead.original_photo_url })
        }

        // ── Enregistrer dans l'historique ──
        await supabase.from('ai_radar_searches').insert({
            keyword: normalizedKeyword,
            city: normalizedCity,
            results_count: savedLeads.length,
            cached_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })

        return NextResponse.json({ success: true, data: savedLeads, cached: false })

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        console.error('Erreur API Radar POST:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// ═══════════════════════════════════════════════════════
// PATCH : Modifier un lead (favori, notes, statut, assignation)
// ═══════════════════════════════════════════════════════
export async function PATCH(req: Request) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Config Supabase manquante' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { id, ...updates } = await req.json()

        if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

        // Seuls ces champs sont modifiables
        const allowed: Record<string, unknown> = {}
        if ('is_favorite' in updates) allowed.is_favorite = updates.is_favorite
        if ('notes' in updates) allowed.notes = updates.notes
        if ('status' in updates) allowed.status = updates.status
        if ('assigned_agent_id' in updates) allowed.assigned_agent_id = updates.assigned_agent_id

        const { data, error } = await supabase
            .from('ai_prospection_leads')
            .update(allowed)
            .eq('id', id)
            .select('*')
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ lead: data })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
