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
    address: 'Haie-Vive Cocotiers, Carré n°1158, Cotonou : République du Bénin',
    ifu:     '3202644573981',
    rccm:    'RB/COT/26 B 42001',
}

/* ══════════════════════════════════════════════════════════════════
   PPTX : MÊME DIRECTION ARTISTIQUE QUE L'ÉCRAN D'ACCUEIL MOBILE.

   « LE BLANC EST LA FORCE » : fonds blancs francs, encre anthracite
   (#3C3C3C, jamais de noir pur), accents du drapeau béninois, fin liseré
   tricolore en signature, typographie Plus Jakarta Sans. Plus AUCUN fond
   sombre. Les slides à plusieurs images sont mis en page en mosaïque nette.
   Valeurs reprises de mobile/src/config/theme.ts (design system v2).
══════════════════════════════════════════════════════════════════ */
const C = {
    green:     '008751',
    greenDeep: '00643C',
    greenSoft: 'E6F3ED',
    yellow:    'FCD116',
    yellowSoft:'FEF7DC',
    yellowInk: '8A6D08',
    red:       'E8112D',
    white:     'FFFFFF',
    mist:      'F5F5F5',
    ink:       '3C3C3C',
    inkMuted:  '505050',
    inkFaint:  '8A8A8A',
    line:      'F0F0F0',
    lineStrong:'E4E4E4',
}

// Police du design mobile. Se substitue proprement si absente du poste.
const FONT = 'Plus Jakarta Sans'
// Ombre douce TEINTÉE gris (jamais noire), comme les cartes posées sur blanc.
const SOFT_SHADOW = { type: 'outer' as const, color: 'BDBDBD', blur: 10, offset: 4, angle: 90, opacity: 0.45 }

const W = 13.33
const H = 7.5

const CATEGORY: Record<string, { label: string }> = {
    hotel:      { label: 'Hébergement' },
    restaurant: { label: 'Gastronomie' },
    activity:   { label: 'Activité & Visite' },
    transport:  { label: 'Transport' },
    hero:       { label: '' },
    pricing:    { label: 'Devis' },
}

const fmt = (n: number) =>
    Math.round(n).toLocaleString('fr-FR').replace(/[    ]/g, ' ')

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
    currency?: string | null
    start_date?: string | null
    end_date?: string | null
    created_at: string
}

const LABEL_DEVISE: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£' }
const labelDevise = (c?: string | null) => LABEL_DEVISE[(c || 'XOF').toUpperCase()] || (c || 'FCFA')

interface SlideImageRow { url: string; caption?: string }
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
    metadata?: { images?: SlideImageRow[] } | null
}

// Toutes les images d'un item (principale + galerie metadata.images), dédupliquées.
function imageUrlsOf(item: ItemRow): string[] {
    const urls: string[] = []
    if (item.image_url) urls.push(item.image_url)
    for (const g of item.metadata?.images || []) {
        if (g?.url && !urls.includes(g.url)) urls.push(g.url)
    }
    return urls
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: proposal, error: pe } = await supabase
            .from('ai_client_proposals')
            .select('id, client_name, client_email, destination, total_amount, currency, start_date, end_date, created_at')
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
        const cur = labelDevise(p.currency)
        const items: ItemRow[] = (rawItems || []) as ItemRow[]
        const contentItems = items.filter(i => i.type !== 'hero' && i.type !== 'pricing')
        const billable = contentItems.filter(i => i.selling_price > 0)

        // ── Pré-fetch : pour chaque item, TOUTES ses images (galeries incluses) ──
        const itemImages: string[][] = await Promise.all(
            contentItems.map(async item => {
                const datas = await Promise.all(imageUrlsOf(item).map(u => fetchImageBase64(u)))
                return datas.filter((d): d is string => !!d)
            })
        )

        // Image de couverture : galerie du hero, sinon 1re image de contenu.
        const heroItem = items.find(i => i.type === 'hero')
        const heroImg = (heroItem ? (await Promise.all(imageUrlsOf(heroItem).map(u => fetchImageBase64(u)))).find((d): d is string => !!d) : null)
            || itemImages.flat().find(Boolean)
            || null

        const pptx = new pptxgen()
        pptx.author  = COMPANY.name
        pptx.company = COMPANY.name
        pptx.title   = `Voyage ${p.destination} : ${p.client_name}`
        pptx.layout  = 'LAYOUT_WIDE'

        // Fin liseré tricolore : la signature de la maison.
        const addFlagRule = (slide: pptxgen.Slide, y: number, h = 0.1) => {
            slide.addShape('rect', { x: 0,        y, w: W * 0.34, h, fill: { color: C.green },  line: { width: 0 } })
            slide.addShape('rect', { x: W * 0.34, y, w: W * 0.33, h, fill: { color: C.yellow }, line: { width: 0 } })
            slide.addShape('rect', { x: W * 0.67, y, w: W * 0.33, h, fill: { color: C.red },    line: { width: 0 } })
        }

        // Pied de page discret sur blanc.
        const addFooter = (slide: pptxgen.Slide) => {
            slide.addText(
                `${COMPANY.name}   ·   ${COMPANY.phone1}   ·   ${COMPANY.email}`,
                { x: 0.5, y: H - 0.5, w: W - 1, h: 0.3, fontSize: 8, color: C.inkFaint, align: 'center', fontFace: FONT, charSpacing: 1 },
            )
            addFlagRule(slide, H - 0.1, 0.1)
        }

        /* Mosaïque d'images « cover » (recadrées, jamais déformées) dans un
           rectangle (bx,by,bw,bh). 1→plein cadre, 2→empilées, 3→une grande +
           deux, 4→grille 2×2, 5+→2×2 avec pastille « +N ». Ombre douce grise. */
        const placeImages = (slide: pptxgen.Slide, imgs: string[], bx: number, by: number, bw: number, bh: number) => {
            const g = 0.14 // gouttière
            const frame = (data: string, x: number, y: number, w: number, h: number) => {
                slide.addImage({ data, x, y, w, h, sizing: { type: 'cover', w, h }, shadow: SOFT_SHADOW })
                slide.addShape('rect', { x, y, w, h, fill: { type: 'none' }, line: { color: C.lineStrong, width: 0.75 } })
            }
            if (imgs.length === 0) {
                // Aucune image : panneau vert doux avec initiale du drapeau.
                slide.addShape('roundRect', { x: bx, y: by, w: bw, h: bh, rectRadius: 0.12, fill: { color: C.greenSoft }, line: { width: 0 } })
                slide.addText('RG', { x: bx, y: by, w: bw, h: bh, align: 'center', valign: 'middle', fontFace: FONT, bold: true, fontSize: 40, color: C.green })
                return
            }
            if (imgs.length === 1) {
                frame(imgs[0], bx, by, bw, bh)
                return
            }
            if (imgs.length === 2) {
                const h = (bh - g) / 2
                frame(imgs[0], bx, by, bw, h)
                frame(imgs[1], bx, by + h + g, bw, h)
                return
            }
            if (imgs.length === 3) {
                const topH = bh * 0.58
                const botH = bh - topH - g
                const halfW = (bw - g) / 2
                frame(imgs[0], bx, by, bw, topH)
                frame(imgs[1], bx, by + topH + g, halfW, botH)
                frame(imgs[2], bx + halfW + g, by + topH + g, halfW, botH)
                return
            }
            // 4 et plus : grille 2×2
            const cw = (bw - g) / 2
            const ch = (bh - g) / 2
            const cells = [
                [bx, by], [bx + cw + g, by],
                [bx, by + ch + g], [bx + cw + g, by + ch + g],
            ]
            const shown = imgs.slice(0, 4)
            shown.forEach((im, i) => frame(im, cells[i][0], cells[i][1], cw, ch))
            const extra = imgs.length - 4
            if (extra > 0) {
                // Pastille « +N » sur la dernière cellule.
                const [ex, ey] = cells[3]
                slide.addShape('rect', { x: ex, y: ey, w: cw, h: ch, fill: { color: '3C3C3C', transparency: 35 }, line: { width: 0 } })
                slide.addText(`+${extra}`, { x: ex, y: ey, w: cw, h: ch, align: 'center', valign: 'middle', fontFace: FONT, bold: true, fontSize: 28, color: C.white })
            }
        }

        // ═══════════════════════════════════════════════════════════
        // SLIDE HERO : couverture blanche éditoriale (texte à gauche, photo à droite)
        // ═══════════════════════════════════════════════════════════
        {
            const slide = pptx.addSlide()
            slide.background = { color: C.white }
            addFlagRule(slide, 0, 0.14)

            // Colonne photo à droite (ou panneau vert doux si aucune image)
            placeImages(slide, heroImg ? [heroImg] : [], 6.85, 0.75, 5.95, 6.0)

            const Lx = 0.7, Lw = 5.9
            slide.addText('RETOUR GAGNANT BÉNIN', {
                x: Lx, y: 0.75, w: Lw, h: 0.3, fontSize: 11, bold: true, color: C.green,
                fontFace: FONT, charSpacing: 4,
            })
            slide.addText('CARNET DE VOYAGE SUR MESURE', {
                x: Lx, y: 1.7, w: Lw, h: 0.35, fontSize: 12, color: C.inkFaint,
                fontFace: FONT, charSpacing: 3,
            })
            slide.addText(p.destination, {
                x: Lx, y: 2.1, w: Lw, h: 1.5, fontSize: 54, bold: true, color: C.ink, fontFace: FONT,
            })
            slide.addShape('rect', { x: Lx, y: 3.55, w: 1.4, h: 0.045, fill: { color: C.green }, line: { width: 0 } })

            slide.addText('PRÉPARÉ EXCLUSIVEMENT POUR', {
                x: Lx, y: 3.85, w: Lw, h: 0.3, fontSize: 9, color: C.inkFaint, fontFace: FONT, charSpacing: 2,
            })
            slide.addText(p.client_name, {
                x: Lx, y: 4.15, w: Lw, h: 0.55, fontSize: 24, bold: true, color: C.ink, fontFace: FONT,
            })

            if (p.start_date && p.end_date) {
                const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                slide.addText(`Du ${fmtDate(p.start_date)}  au  ${fmtDate(p.end_date)}`, {
                    x: Lx, y: 4.8, w: Lw, h: 0.32, fontSize: 12, color: C.inkMuted, fontFace: FONT,
                })
            }

            const parts = [
                { n: items.filter(i => i.type === 'hotel').length,      s: 'hébergements' },
                { n: items.filter(i => i.type === 'restaurant').length, s: 'restaurants' },
                { n: items.filter(i => i.type === 'activity').length,   s: 'activités' },
                { n: items.filter(i => i.type === 'transport').length,  s: 'transports' },
            ].filter(x => x.n > 0).map(x => `${x.n} ${x.s}`)
            if (parts.length > 0) {
                slide.addText(parts.join('   ·   '), {
                    x: Lx, y: p.start_date ? 5.2 : 4.9, w: Lw, h: 0.32, fontSize: 12, color: C.inkMuted, fontFace: FONT,
                })
            }

            // Total : pilule vert doux, montant vert
            slide.addShape('roundRect', {
                x: Lx, y: 5.75, w: 4.4, h: 0.62, rectRadius: 0.09,
                fill: { color: C.greenSoft }, line: { color: C.green, width: 1 },
            })
            slide.addText(
                [
                    { text: 'TOTAL ESTIMÉ    ', options: { color: C.inkMuted, fontSize: 11, bold: false } },
                    { text: `${fmt(p.total_amount)} ${cur}`, options: { color: C.green, fontSize: 15, bold: true } },
                ],
                { x: Lx + 0.1, y: 5.75, w: 4.2, h: 0.62, align: 'center', valign: 'middle', fontFace: FONT },
            )

            addFooter(slide)
        }

        // ═══════════════════════════════════════════════════════════
        // SLIDES CONTENU : blanc, texte à gauche, images (mosaïque) à droite
        // ═══════════════════════════════════════════════════════════
        contentItems.forEach((item, idx) => {
            const slide = pptx.addSlide()
            slide.background = { color: C.white }
            const cat = CATEGORY[item.type] || CATEGORY.hotel
            addFlagRule(slide, 0, 0.12)

            // Mosaïque d'images à droite
            placeImages(slide, itemImages[idx] || [], 6.85, 0.75, 5.95, 5.6)

            const Lx = 0.7, Lw = 5.85

            // Sur-titre catégorie (vert)
            slide.addText(cat.label.toUpperCase(), {
                x: Lx, y: 0.7, w: Lw, h: 0.3, fontSize: 11, bold: true, color: C.green,
                fontFace: FONT, charSpacing: 2,
            })
            // Localisation
            if (item.location) {
                slide.addText(item.location, {
                    x: Lx, y: 1.08, w: Lw, h: 0.3, fontSize: 12, color: C.inkFaint, fontFace: FONT,
                })
            }
            // Titre (encre)
            const titleY = item.location ? 1.5 : 1.1
            slide.addText(item.title, {
                x: Lx, y: titleY, w: Lw, h: 1.6, fontSize: 34, bold: true, color: C.ink,
                fontFace: FONT, valign: 'top',
            })
            // Sous-titre (vert)
            const stY = titleY + 1.65
            if (item.subtitle) {
                slide.addText(item.subtitle, {
                    x: Lx, y: stY, w: Lw, h: 0.4, fontSize: 13, italic: true, color: C.green, fontFace: FONT,
                })
            }
            // Description (encre douce)
            const descY = item.subtitle ? stY + 0.5 : stY
            if (item.description) {
                slide.addText(item.description, {
                    x: Lx, y: descY, w: Lw, h: 1.15, fontSize: 11.5, color: C.inkMuted, fontFace: FONT,
                    valign: 'top', lineSpacingMultiple: 1.2,
                })
            }
            // Points forts : pastilles vert doux
            const hlY = (item.description ? descY + 1.25 : descY) + 0.05
            const highlights = (item.highlights || []).slice(0, 6)
            highlights.forEach((h, i) => {
                const col = i % 2
                const row = Math.floor(i / 2)
                const x = Lx + col * 2.95
                const yy = hlY + row * 0.48
                slide.addShape('roundRect', {
                    x, y: yy, w: 2.8, h: 0.4, rectRadius: 0.06,
                    fill: { color: C.greenSoft }, line: { width: 0 },
                })
                slide.addText(h, {
                    x: x + 0.14, y: yy, w: 2.55, h: 0.4, fontSize: 9.5, color: C.greenDeep,
                    fontFace: FONT, valign: 'middle',
                })
            })

            // Prix : pilule JAUNE (fond premium), texte encre
            if (item.selling_price > 0) {
                slide.addShape('roundRect', {
                    x: Lx, y: 6.35, w: 3.3, h: 0.55, rectRadius: 0.08,
                    fill: { color: C.yellow }, line: { width: 0 },
                })
                slide.addText(
                    [
                        { text: 'TARIF INCLUS   ', options: { color: C.yellowInk, fontSize: 9, bold: true } },
                        { text: `${fmt(item.selling_price)} ${cur}`, options: { color: '3C2E00', fontSize: 14, bold: true } },
                    ],
                    { x: Lx + 0.1, y: 6.35, w: 3.1, h: 0.55, align: 'center', valign: 'middle', fontFace: FONT },
                )
            }

            addFooter(slide)
        })

        // ═══════════════════════════════════════════════════════════
        // SLIDE PRICING : récapitulatif blanc
        // ═══════════════════════════════════════════════════════════
        {
            const slide = pptx.addSlide()
            slide.background = { color: C.white }
            addFlagRule(slide, 0, 0.14)

            slide.addText('Récapitulatif du devis', {
                x: 0, y: 0.55, w: W, h: 0.8, fontSize: 30, bold: true, color: C.ink, align: 'center', fontFace: FONT,
            })
            slide.addShape('rect', { x: W / 2 - 0.9, y: 1.35, w: 1.8, h: 0.045, fill: { color: C.green }, line: { width: 0 } })

            const tX = 1.6, tW = W - 3.2
            const cTit = tX + 0.35, cTitW = tW - 3.0
            const cPri = tX + tW - 2.4, cPriW = 2.2
            const rH = 0.5
            let rY = 1.8

            slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: C.greenSoft }, line: { width: 0 } })
            slide.addText('PRESTATION', { x: cTit, y: rY, w: cTitW, h: rH, fontSize: 11, bold: true, color: C.greenDeep, fontFace: FONT, valign: 'middle', charSpacing: 2 })
            slide.addText(`PRIX (${cur})`, { x: cPri, y: rY, w: cPriW, h: rH, fontSize: 11, bold: true, color: C.greenDeep, align: 'right', fontFace: FONT, valign: 'middle', charSpacing: 1 })
            rY += rH

            const maxItems = 9
            billable.slice(0, maxItems).forEach((item, i) => {
                if (i % 2 === 1) {
                    slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: C.mist }, line: { width: 0 } })
                }
                slide.addShape('rect', { x: tX, y: rY, w: 0.06, h: rH, fill: { color: C.green }, line: { width: 0 } })
                slide.addText(item.title, { x: cTit, y: rY, w: cTitW, h: rH, fontSize: 12, color: C.ink, fontFace: FONT, valign: 'middle' })
                slide.addText(`${fmt(item.selling_price)}`, { x: cPri, y: rY, w: cPriW, h: rH, fontSize: 12, color: C.inkMuted, align: 'right', fontFace: FONT, valign: 'middle' })
                rY += rH
            })
            // Séparateur bas de table
            slide.addShape('rect', { x: tX, y: rY, w: tW, h: 0.015, fill: { color: C.lineStrong }, line: { width: 0 } })

            // Total
            rY += 0.22
            slide.addShape('roundRect', { x: tX, y: rY, w: tW, h: 0.66, rectRadius: 0.07, fill: { color: C.green }, line: { width: 0 } })
            slide.addText('TOTAL', { x: tX + 0.35, y: rY, w: 5, h: 0.66, fontSize: 15, bold: true, color: C.white, fontFace: FONT, valign: 'middle', charSpacing: 2 })
            slide.addText(`${fmt(p.total_amount)} ${cur}`, {
                x: cPri - 0.6, y: rY, w: cPriW + 0.6, h: 0.66, fontSize: 17, bold: true, color: C.yellow, align: 'right', fontFace: FONT, valign: 'middle',
            })
            rY += 0.66

            // Bloc contact : vert doux
            const cY = Math.min(rY + 0.45, H - 1.55)
            slide.addShape('roundRect', { x: tX, y: cY, w: tW, h: 1.05, rectRadius: 0.08, fill: { color: C.greenSoft }, line: { width: 0 } })
            slide.addText('Pour finaliser votre réservation, contactez votre conseiller :', {
                x: tX, y: cY + 0.12, w: tW, h: 0.3, fontSize: 10, color: C.inkMuted, align: 'center', fontFace: FONT,
            })
            slide.addText(`${COMPANY.phone1}   ·   ${COMPANY.phone2}   ·   ${COMPANY.email}`, {
                x: tX, y: cY + 0.44, w: tW, h: 0.34, fontSize: 13, bold: true, color: C.green, align: 'center', fontFace: FONT,
            })
            slide.addText(`${COMPANY.address}   ·   IFU : ${COMPANY.ifu}   ·   RCCM : ${COMPANY.rccm}`, {
                x: tX, y: cY + 0.78, w: tW, h: 0.24, fontSize: 8.5, color: C.inkFaint, align: 'center', fontFace: FONT,
            })

            addFooter(slide)
        }

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
