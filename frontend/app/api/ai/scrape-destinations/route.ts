import { NextResponse } from 'next/server'
import axios from 'axios'

const serperApiKeys = [
    process.env.SERPER_API_KEY_1,
    process.env.SERPER_API_KEY_2,
    process.env.SERPER_API_KEY_3,
].filter(Boolean) as string[]

async function callSerperWithRetry(keys: string[], query: string, type: 'search' | 'maps' | 'images' = 'maps', num = 20) {
    const shuffled = [...keys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const res = await axios.post(
                `https://google.serper.dev/${type}`,
                { q: query, gl: 'bj', hl: 'fr', num },
                { headers: { 'X-API-KEY': shuffled[i], 'Content-Type': 'application/json' }, timeout: 15000 }
            )
            if (type === 'maps') return res.data.places || []
            if (type === 'images') return res.data.images || []
            return res.data.organic || []
        } catch (err) {
            console.warn(`Serper key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) return []
        }
    }
    return []
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { destination, activities } = body

        if (!destination) {
            return NextResponse.json({ error: 'Destination requise' }, { status: 400 })
        }

        // Requête activités : double requête parallèle pour maximiser les résultats Maps
        const activityQuery1 = activities
            ? `${activities} tourisme visite ${destination} Bénin`
            : `musée monument palais temple plage ${destination} Bénin`
        const activityQuery2 = activities
            ? `excursion loisirs ${activities} ${destination} Bénin`
            : `parc attraction loisirs artisanat marché visite ${destination} Bénin`

        // Requête transport : plus générique pour matcher les agences locales
        const transportQuery = `taxi moto transport agence voyage location voiture ${destination} Bénin`

        // Scraping en parallèle — 6 requêtes (activités doublées pour plus de résultats)
        const [hotels, restaurants, act1, act2, transport, images] = await Promise.all([
            callSerperWithRetry(serperApiKeys, `hôtel hébergement auberge ${destination} Bénin`, 'maps'),
            callSerperWithRetry(serperApiKeys, `restaurant maquis brasserie gastronomie ${destination} Bénin`, 'maps'),
            callSerperWithRetry(serperApiKeys, activityQuery1, 'maps'),
            callSerperWithRetry(serperApiKeys, activityQuery2, 'maps'),
            callSerperWithRetry(serperApiKeys, transportQuery, 'maps'),
            callSerperWithRetry(serperApiKeys, `${destination} Bénin tourisme paysage nature`, 'images'),
        ])

        // Fusion et déduplication des activités par titre
        interface SerperPlaceRaw { title?: string }
        const seenTitles = new Set<string>()
        const activities_results = [...act1, ...act2].filter((p: SerperPlaceRaw) => {
            const t = (p.title || '').toLowerCase()
            if (seenTitles.has(t)) return false
            seenTitles.add(t)
            return true
        })

        // Normaliser chaque résultat
        interface SerperPlace { title?: string; address?: string; rating?: number; ratingCount?: number; thumbnailUrl?: string; position?: number }
        interface SerperImage { title?: string; imageUrl?: string; thumbnailUrl?: string; link?: string }

        const normalize = (items: SerperPlace[], category: string) => items.slice(0, 12).map((item: SerperPlace, i: number) => ({
            id: `${category}-${i}`,
            category,
            title: item.title || 'Sans titre',
            address: item.address || '',
            rating: item.rating || 0,
            reviews: item.ratingCount || 0,
            image_url: item.thumbnailUrl || null,
            selected: false,
        }))

        const normalizeImages = (items: SerperImage[]) => items.slice(0, 20).map((item: SerperImage, i: number) => ({
            id: `image-${i}`,
            title: item.title || '',
            url: item.imageUrl || item.thumbnailUrl || '',
            thumbnail: item.thumbnailUrl || item.imageUrl || '',
            source: item.link || '',
        }))

        return NextResponse.json({
            success: true,
            destination,
            categories: {
                hotels: normalize(hotels, 'hotel'),
                restaurants: normalize(restaurants, 'restaurant'),
                activities: normalize(activities_results, 'activity'),
                transport: normalize(transport, 'transport'),
            },
            images: normalizeImages(images),
        })

    } catch (err) {
        console.error('Erreur API Scrape:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
    }
}
