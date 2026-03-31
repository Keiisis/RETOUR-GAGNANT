import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import pptxgen from 'pptxgenjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Infos société (officielles) ──────────────────────────────────
const COMPANY = {
    name:    'Retour Gagnant Bénin',
    phone1:  '+229 01 60 32 21 21',
    phone2:  '+229 01 94 35 50 50',
    email:   'contact@retourgagnantbenin.bj',
    website: 'www.retourgagnantbenin.bj',
    address: 'Haie-Vive Cocotiers, Carré n°1158, Cotonou — République du Bénin',
    ifu:     '3202644573981',
    rccm:    'RB/COT/26 B 42001',
}

// ── Palette ──────────────────────────────────────────────────────
const C = {
    green:     '008751',
    yellow:    'FCD116',
    red:       'E8112D',
    dark:      '030B18',
    dark2:     '071428',
    white:     'FFFFFF',
    gray:      '8899AA',
    grayLight: 'B8C8D8',
}

// Dimensions LAYOUT_WIDE : 13.33" × 7.5"
const W = 13.33
const H = 7.5

const CATEGORY: Record<string, { bg: string; accent: string; label: string; emoji: string }> = {
    hotel:      { bg: '061830', accent: '38BDF8', label: 'Hébergement',      emoji: '🏨' },
    restaurant: { bg: '180A00', accent: 'FB923C', label: 'Gastronomie',      emoji: '🍽️' },
    activity:   { bg: '051A0A', accent: '34D399', label: 'Activité & Visite', emoji: '🎯' },
    transport:  { bg: '0E0620', accent: 'A78BFA', label: 'Transport VIP',    emoji: '🚗' },
    hero:       { bg: C.dark,  accent: C.yellow,  label: '',                 emoji: '✨' },
    pricing:    { bg: '020E04', accent: C.green,  label: 'Devis',            emoji: '💰' },
}

// ── Fetch image URL → base64 data URI ────────────────────────────
async function fetchImageBase64(url: string): Promise<string | null> {
    try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 7000)
        const resp = await fetch(url, { signal: ctrl.signal })
        clearTimeout(timer)
        if (!resp.ok) return null
        const buf = await resp.arrayBuffer()
        const mime = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
        const b64 = Buffer.from(buf).toString('base64')
        return `data:${mime};base64,${b64}`
    } catch {
        return null
    }
}

interface ProposalRow {
    id: string
    client_name: string
    client_email: string | null
    destination: string
    total_amount: number
    start_date?: string | null
    end_date?: string | null
    created_at: string
}

interface ItemRow {
    type: string
    title: string
    subtitle?: string
    description: string | null
    location?: string | null
    highlights?: string[]
    image_url: string | null
    original_price: number
    selling_price: number
    order_index: number
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: proposal, error: pe } = await supabase
            .from('ai_client_proposals')
            .select('id, client_name, client_email, destination, total_amount, start_date, end_date, created_at')
            .eq('id', id)
            .single()

        if (pe || !proposal) {
            console.error('PPTX: proposal lookup failed', { id, pe })
            return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
        }

        const { data: rawItems } = await supabase
            .from('ai_proposal_items')
            .select('*')
            .eq('proposal_id', id)
            .order('order_index', { ascending: true })

        const p = proposal as ProposalRow
        const items: ItemRow[] = (rawItems || []) as ItemRow[]
        const contentItems = items.filter(i => i.type !== 'hero' && i.type !== 'pricing')
        const billable = contentItems.filter(i => i.selling_price > 0)

        // ── Pré-fetch toutes les images en parallèle ──────────────
        const imageDataArr: (string | null)[] = await Promise.all(
            contentItems.map(item => item.image_url ? fetchImageBase64(item.image_url) : Promise.resolve(null))
        )

        // ── Initialiser pptx ──────────────────────────────────────
        const pptx = new pptxgen()
        pptx.author  = COMPANY.name
        pptx.company = COMPANY.name
        pptx.title   = `Voyage ${p.destination} — ${p.client_name}`
        pptx.layout  = 'LAYOUT_WIDE'

        // ── Footer commun ─────────────────────────────────────────
        const addFooter = (slide: pptxgen.Slide) => {
            // Fond semi-transparent
            slide.addShape('rect', {
                x: 0, y: H - 0.46, w: W, h: 0.46,
                fill: { color: '00000070' }, line: { width: 0 },
            })
            // Tricolor en bas
            slide.addShape('rect', { x: 0,        y: H - 0.07, w: W * 0.333, h: 0.07, fill: { color: C.green },  line: { width: 0 } })
            slide.addShape('rect', { x: W * 0.333, y: H - 0.07, w: W * 0.334, h: 0.07, fill: { color: C.yellow }, line: { width: 0 } })
            slide.addShape('rect', { x: W * 0.667, y: H - 0.07, w: W * 0.333, h: 0.07, fill: { color: C.red },    line: { width: 0 } })
            // Texte contact
            slide.addText(
                `${COMPANY.name}  ·  ${COMPANY.phone1}  ·  ${COMPANY.phone2}  ·  ${COMPANY.email}`,
                { x: 0, y: H - 0.44, w: W, h: 0.32, fontSize: 8, color: C.grayLight, align: 'center', fontFace: 'Calibri' }
            )
        }

        // ═══════════════════════════════════════════════════════════
        // SLIDE HERO
        // ═══════════════════════════════════════════════════════════
        {
            const slide = pptx.addSlide()
            slide.background = { color: C.dark }

            // Tricolor top (3 bandes larges)
            slide.addShape('rect', { x: 0, y: 0,   w: W, h: 0.25, fill: { color: C.green },  line: { width: 0 } })
            slide.addShape('rect', { x: 0, y: 0.25, w: W, h: 0.25, fill: { color: C.yellow }, line: { width: 0 } })
            slide.addShape('rect', { x: 0, y: 0.5,  w: W, h: 0.25, fill: { color: C.red },    line: { width: 0 } })

            // Logo société
            slide.addText(COMPANY.name.toUpperCase(), {
                x: 0, y: 0.9, w: W, h: 0.6,
                fontSize: 20, bold: true, color: C.yellow,
                align: 'center', fontFace: 'Calibri', charSpacing: 7,
            })

            // Ligne décorative
            slide.addShape('rect', { x: 4.5, y: 1.6, w: 4.33, h: 0.05, fill: { color: C.yellow + '50' }, line: { width: 0 } })

            // Destination (géant)
            slide.addText(p.destination.toUpperCase(), {
                x: 0, y: 1.75, w: W, h: 2.4,
                fontSize: 80, bold: true, color: C.white,
                align: 'center', fontFace: 'Calibri', autoFit: true,
            })

            // Préparé pour
            slide.addText('Voyage exclusivement préparé pour', {
                x: 0, y: 4.25, w: W, h: 0.42,
                fontSize: 13, color: C.grayLight, italic: true,
                align: 'center', fontFace: 'Calibri',
            })
            slide.addText(p.client_name, {
                x: 0, y: 4.68, w: W, h: 0.72,
                fontSize: 30, bold: true, color: C.yellow,
                align: 'center', fontFace: 'Calibri',
            })

            // Dates
            if (p.start_date && p.end_date) {
                const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                slide.addText(`Du ${fmt(p.start_date)}   ·   Au ${fmt(p.end_date)}`, {
                    x: 0, y: 5.5, w: W, h: 0.4,
                    fontSize: 13, color: C.grayLight,
                    align: 'center', fontFace: 'Calibri',
                })
            }

            // Stats cards
            const statItems = [
                { label: 'Hôtels',      val: items.filter(i => i.type === 'hotel').length,      color: '38BDF8' },
                { label: 'Restaurants', val: items.filter(i => i.type === 'restaurant').length,  color: 'FB923C' },
                { label: 'Activités',   val: items.filter(i => i.type === 'activity').length,    color: '34D399' },
                { label: 'Transports',  val: items.filter(i => i.type === 'transport').length,   color: 'A78BFA' },
            ].filter(s => s.val > 0)

            if (statItems.length > 0) {
                const cardW = 2.6
                const gap = 0.3
                const totalW = statItems.length * cardW + (statItems.length - 1) * gap
                const startX = (W - totalW) / 2
                statItems.forEach((s, i) => {
                    const x = startX + i * (cardW + gap)
                    slide.addShape('rect', {
                        x, y: p.start_date ? 6.05 : 5.6, w: cardW, h: 0.75,
                        fill: { color: s.color + '22' },
                        line: { color: s.color, width: 1 },
                    })
                    slide.addText(`${s.val}  ${s.label}`, {
                        x, y: p.start_date ? 6.05 : 5.6, w: cardW, h: 0.75,
                        fontSize: 16, bold: true, color: C.white,
                        align: 'center', fontFace: 'Calibri',
                    })
                })
            }

            // Total badge
            const totalY = statItems.length > 0 ? 6.9 : (p.start_date ? 6.05 : 5.75)
            slide.addShape('rect', { x: 4.5, y: totalY, w: 4.33, h: 0.5, fill: { color: C.green + '35' }, line: { color: C.green, width: 1 } })
            slide.addText(`TOTAL ESTIMÉ : ${p.total_amount.toLocaleString('fr-FR')} FCFA`, {
                x: 4.5, y: totalY, w: 4.33, h: 0.5,
                fontSize: 15, bold: true, color: C.yellow, align: 'center', fontFace: 'Calibri',
            })

            addFooter(slide)
        }

        // ═══════════════════════════════════════════════════════════
        // SLIDES CONTENU (hotel, restaurant, activity, transport)
        // ═══════════════════════════════════════════════════════════
        contentItems.forEach((item, idx) => {
            const slide = pptx.addSlide()
            const cat = CATEGORY[item.type] || CATEGORY.hotel
            slide.background = { color: cat.bg }

            const imgData = imageDataArr[idx]
            const imgX = 8.2   // position X de l'image (droite)
            const imgW = W - imgX  // 5.13"

            // ── Image pleine hauteur côté droit ──
            if (imgData) {
                try {
                    slide.addImage({
                        data: imgData,
                        x: imgX, y: 0, w: imgW, h: H,
                    })
                    // Overlay dégradé gauche (3 rectangles semi-transparents de gauche à droite)
                    slide.addShape('rect', { x: imgX - 0.8, y: 0, w: 1.5, h: H, fill: { color: cat.bg + 'F0' }, line: { width: 0 } })
                    slide.addShape('rect', { x: imgX - 1.8, y: 0, w: 1.2, h: H, fill: { color: cat.bg + '99' }, line: { width: 0 } })
                    slide.addShape('rect', { x: imgX - 2.5, y: 0, w: 0.9, h: H, fill: { color: cat.bg + '40' }, line: { width: 0 } })
                } catch {
                    // image failed, panneau de secours
                    slide.addShape('rect', { x: imgX, y: 0, w: imgW, h: H, fill: { color: cat.accent + '12' }, line: { width: 0 } })
                    slide.addText(cat.emoji, { x: imgX, y: 2.5, w: imgW, h: 2.5, fontSize: 90, align: 'center', fontFace: 'Calibri' })
                }
            } else {
                // Pas d'image : panneau décoratif
                slide.addShape('rect', { x: imgX, y: 0, w: imgW, h: H, fill: { color: cat.accent + '10' }, line: { color: cat.accent + '25', width: 1 } })
                slide.addText(cat.emoji, { x: imgX, y: 2.2, w: imgW, h: 3.0, fontSize: 90, align: 'center', fontFace: 'Calibri' })
            }

            // ── Barre accent pleine largeur (top) ──
            slide.addShape('rect', { x: 0, y: 0, w: W, h: 0.12, fill: { color: cat.accent }, line: { width: 0 } })

            // ── Badge catégorie ──
            slide.addShape('rect', { x: 0.5, y: 0.22, w: 2.7, h: 0.42, fill: { color: cat.accent + '28' }, line: { color: cat.accent, width: 0.8 } })
            slide.addText(`${cat.emoji}  ${cat.label}`, {
                x: 0.5, y: 0.22, w: 2.7, h: 0.42,
                fontSize: 11, bold: true, color: cat.accent,
                align: 'center', fontFace: 'Calibri',
            })

            // ── Prix (badge haut droite côté texte) ──
            if (item.selling_price > 0) {
                slide.addShape('rect', { x: 4.8, y: 0.22, w: 3.0, h: 0.42, fill: { color: cat.accent + '28' }, line: { color: cat.accent, width: 0.8 } })
                slide.addText(`💰  ${item.selling_price.toLocaleString('fr-FR')} FCFA`, {
                    x: 4.8, y: 0.22, w: 3.0, h: 0.42,
                    fontSize: 11, bold: true, color: cat.accent,
                    align: 'center', fontFace: 'Calibri',
                })
            }

            // ── Location ──
            if (item.location) {
                slide.addText(`📍  ${item.location}`, {
                    x: 0.5, y: 0.78, w: 7.4, h: 0.38,
                    fontSize: 12, color: C.grayLight, fontFace: 'Calibri',
                })
            }

            // ── Titre (grand) ──
            const titleY = item.location ? 1.25 : 0.82
            slide.addText(item.title, {
                x: 0.5, y: titleY, w: 7.4, h: 2.1,
                fontSize: 44, bold: true, color: C.white,
                fontFace: 'Calibri', wrap: true, autoFit: true,
            })

            // ── Sous-titre ──
            const stY = titleY + 2.15
            if (item.subtitle) {
                slide.addText(item.subtitle, {
                    x: 0.5, y: stY, w: 7.4, h: 0.5,
                    fontSize: 15, color: cat.accent, fontFace: 'Calibri', italic: true,
                })
            }

            // ── Description ──
            const descY = item.subtitle ? stY + 0.55 : stY
            if (item.description) {
                slide.addText(item.description, {
                    x: 0.5, y: descY, w: 7.4, h: 1.1,
                    fontSize: 12, color: C.grayLight, fontFace: 'Calibri', wrap: true,
                })
            }

            // ── Highlights (grille 3 colonnes) ──
            const hlY = (item.description ? descY + 1.18 : descY) + 0.05
            const highlights = item.highlights || []
            highlights.slice(0, 6).forEach((h, i) => {
                const col = i % 3
                const row = Math.floor(i / 3)
                const x = 0.5 + col * 2.55
                const y = hlY + row * 0.48
                slide.addShape('rect', {
                    x, y, w: 2.4, h: 0.4,
                    fill: { color: cat.accent + '18' },
                    line: { color: cat.accent + '55', width: 0.5 },
                })
                slide.addText(`✦  ${h}`, {
                    x, y, w: 2.4, h: 0.4,
                    fontSize: 9.5, color: C.white, fontFace: 'Calibri', inset: 0.1,
                })
            })

            addFooter(slide)
        })

        // ═══════════════════════════════════════════════════════════
        // SLIDE PRICING — Récapitulatif
        // ═══════════════════════════════════════════════════════════
        {
            const slide = pptx.addSlide()
            slide.background = { color: CATEGORY.pricing.bg }

            // Barre verte top
            slide.addShape('rect', { x: 0, y: 0, w: W, h: 0.15, fill: { color: C.green }, line: { width: 0 } })

            // Titre
            slide.addText('RÉCAPITULATIF DU DEVIS', {
                x: 0, y: 0.25, w: W, h: 0.75,
                fontSize: 30, bold: true, color: C.yellow,
                align: 'center', fontFace: 'Calibri', charSpacing: 5,
            })
            slide.addShape('rect', { x: 4.5, y: 1.1, w: 4.33, h: 0.04, fill: { color: C.yellow + '40' }, line: { width: 0 } })

            // Tableau
            const tX   = 1.2
            const tW   = W - 2.4
            const cEmo = tX + 0.1
            const cTit = tX + 0.9
            const cTitW = tW - 3.4
            const cPri = tX + tW - 2.2
            const cPriW = 2.1
            const rH   = 0.44
            let rY     = 1.25

            // En-tête tableau
            slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: C.green + '45' }, line: { width: 0 } })
            slide.addText('Prestation', { x: cTit, y: rY, w: cTitW, h: rH, fontSize: 11, bold: true, color: C.yellow, fontFace: 'Calibri', inset: 0.1 })
            slide.addText('Prix (FCFA)', { x: cPri, y: rY, w: cPriW, h: rH, fontSize: 11, bold: true, color: C.yellow, align: 'right', fontFace: 'Calibri', inset: 0.1 })
            rY += rH

            // Lignes items (max 10)
            const maxItems = 10
            billable.slice(0, maxItems).forEach((item, i) => {
                const bg = i % 2 === 0 ? 'FFFFFF0C' : '00000000'
                slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: bg }, line: { width: 0 } })

                const cat = CATEGORY[item.type]
                const acc = cat?.accent || C.yellow
                // Bande couleur catégorie sur bord gauche
                slide.addShape('rect', { x: tX, y: rY, w: 0.06, h: rH, fill: { color: acc }, line: { width: 0 } })

                slide.addText(cat?.emoji ?? '✦', { x: cEmo, y: rY, w: 0.7, h: rH, fontSize: 14, align: 'center', fontFace: 'Calibri' })
                slide.addText(item.title, { x: cTit, y: rY, w: cTitW, h: rH, fontSize: 11, color: C.white, fontFace: 'Calibri', inset: 0.1 })
                slide.addText(item.selling_price.toLocaleString('fr-FR'), { x: cPri, y: rY, w: cPriW, h: rH, fontSize: 11, color: C.grayLight, align: 'right', fontFace: 'Calibri', inset: 0.1 })
                rY += rH
            })

            // Ligne total
            rY += 0.18
            slide.addShape('rect', { x: tX, y: rY, w: tW, h: 0.58, fill: { color: C.green + '38' }, line: { color: C.green, width: 1 } })
            slide.addText('TOTAL', { x: tX + 0.2, y: rY, w: 5, h: 0.58, fontSize: 16, bold: true, color: C.white, fontFace: 'Calibri', inset: 0.12 })
            slide.addText(`${p.total_amount.toLocaleString('fr-FR')} FCFA`, {
                x: cPri - 0.5, y: rY, w: cPriW + 0.5, h: 0.58,
                fontSize: 17, bold: true, color: C.yellow, align: 'right', fontFace: 'Calibri', inset: 0.12,
            })
            rY += 0.58

            // Bloc contact
            const cY = Math.min(rY + 0.35, H - 1.55)
            slide.addShape('rect', { x: tX, y: cY, w: tW, h: 1.1, fill: { color: C.green + '18' }, line: { color: C.green + '55', width: 0.8 } })
            slide.addText('Pour finaliser votre réservation, contactez-nous :', {
                x: tX, y: cY + 0.06, w: tW, h: 0.32,
                fontSize: 10, color: C.grayLight, align: 'center', fontFace: 'Calibri',
            })
            slide.addText(`${COMPANY.phone1}  ·  ${COMPANY.phone2}  ·  ${COMPANY.email}`, {
                x: tX, y: cY + 0.42, w: tW, h: 0.38,
                fontSize: 14, bold: true, color: C.yellow, align: 'center', fontFace: 'Calibri',
            })
            slide.addText(`${COMPANY.address}  ·  IFU : ${COMPANY.ifu}  ·  RCCM : ${COMPANY.rccm}`, {
                x: tX, y: cY + 0.8, w: tW, h: 0.26,
                fontSize: 8.5, color: C.grayLight, align: 'center', fontFace: 'Calibri',
            })

            addFooter(slide)
        }

        // ── Générer et retourner ──────────────────────────────────
        const buf = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
        const safeName = p.client_name.replace(/[^a-zA-Z0-9\-]/g, '_')
        const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        const blob = new Blob([new Uint8Array(buf)], { type: mimeType })

        return new NextResponse(blob, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `attachment; filename="Voyage-${p.destination}-${safeName}.pptx"`,
            },
        })

    } catch (err) {
        console.error('Erreur PPTX:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
    }
}
