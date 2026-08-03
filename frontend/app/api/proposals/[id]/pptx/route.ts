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

/* ══════════════════════════════════════════════════════════════════
   REFONTE ANTI « AI-SLOP » — charte stricte du drapeau béninois.

   Ce qui trahissait la génération automatique dans l'ancienne version :
   des accents NÉON hors charte (bleu ciel #38BDF8, orange #FB923C,
   violet #A78BFA) pour distinguer les catégories, un fond différent par
   catégorie, et une typographie « Calibri » partout. On revient à une
   direction éditoriale sobre :
     · une seule base sombre neutre (encre chaude, pas un bleu-nuit criard) ;
     · les SEULES couleurs sont celles du drapeau : vert, jaune, rouge ;
     · titres en serif (Georgia) pour l'élégance, corps en Calibri ;
     · la catégorie se lit à l'étiquette, pas à une couleur gadget.
══════════════════════════════════════════════════════════════════ */
const C = {
    green:     '008751',
    greenDeep: '00643C',
    yellow:    'FCD116',
    red:       'E8112D',
    ink:       '0E1512',   // encre chaude quasi-noire (neutre, jamais bleu-nuit)
    inkSoft:   '16211C',   // panneaux
    white:     'FFFFFF',
    mist:      'D7E0DB',   // texte secondaire clair
    fog:       '93A79E',   // texte discret
}

// Polices : serif éditorial pour les titres, sans-serif pour le corps.
// Georgia / Calibri sont présentes sur tout poste Office / Windows.
const TITLE = 'Georgia'
const BODY  = 'Calibri'

// Dimensions LAYOUT_WIDE : 13.33" × 7.5"
const W = 13.33
const H = 7.5

// Catégories : plus AUCUNE couleur propre. Un libellé lisible suffit ;
// l'accent visuel unique est le vert du Bénin, le jaune pour le premium.
const CATEGORY: Record<string, { label: string }> = {
    hotel:      { label: 'Hébergement' },
    restaurant: { label: 'Gastronomie' },
    activity:   { label: 'Activité & Visite' },
    transport:  { label: 'Transport' },
    hero:       { label: '' },
    pricing:    { label: 'Devis' },
}

// Séparateur de milliers : toLocaleString('fr-FR') insère une espace fine
// insécable (U+202F) que certains rendus PowerPoint affichent mal. On la
// ramène à une espace normale, cohérent avec le devis PDF.
const fmt = (n: number) =>
    Math.round(n).toLocaleString('fr-FR').replace(/[    ]/g, ' ')

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
    currency?: string | null
    start_date?: string | null
    end_date?: string | null
    created_at: string
}

// Label monétaire du devis. La devise est celle saisie par l'agent.
const LABEL_DEVISE: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£' }
const labelDevise = (c?: string | null) => LABEL_DEVISE[(c || 'XOF').toUpperCase()] || (c || 'FCFA')

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

        // ── Pré-fetch toutes les images en parallèle ──────────────
        const imageDataArr: (string | null)[] = await Promise.all(
            contentItems.map(item => item.image_url ? fetchImageBase64(item.image_url) : Promise.resolve(null))
        )

        // Image de couverture : celle de la slide « hero » (l'agent y met la ville
        // du voyage), sinon la première image de contenu disponible. Fini le fond
        // noir : la couverture est portée par une vraie photo.
        const heroItem = items.find(i => i.type === 'hero')
        const heroImg = (heroItem?.image_url ? await fetchImageBase64(heroItem.image_url) : null)
            || imageDataArr.find((d): d is string => !!d)
            || null

        // ── Initialiser pptx ──────────────────────────────────────
        const pptx = new pptxgen()
        pptx.author  = COMPANY.name
        pptx.company = COMPANY.name
        pptx.title   = `Voyage ${p.destination} — ${p.client_name}`
        pptx.layout  = 'LAYOUT_WIDE'

        // Filet tricolore fin, la signature de la maison (réutilisé partout).
        const addFlagRule = (slide: pptxgen.Slide, y: number, h = 0.06) => {
            slide.addShape('rect', { x: 0,          y, w: W * 0.34, h, fill: { color: C.green },  line: { width: 0 } })
            slide.addShape('rect', { x: W * 0.34,   y, w: W * 0.33, h, fill: { color: C.yellow }, line: { width: 0 } })
            slide.addShape('rect', { x: W * 0.67,   y, w: W * 0.33, h, fill: { color: C.red },    line: { width: 0 } })
        }

        // ── Pied de page commun, discret ──────────────────────────
        const addFooter = (slide: pptxgen.Slide) => {
            addFlagRule(slide, H - 0.06, 0.06)
            slide.addText(
                `${COMPANY.name}   ·   ${COMPANY.phone1}   ·   ${COMPANY.email}`,
                { x: 0, y: H - 0.42, w: W, h: 0.3, fontSize: 8, color: C.fog, align: 'center', fontFace: BODY, charSpacing: 1 }
            )
        }

        // ═══════════════════════════════════════════════════════════
        // SLIDE HERO — couverture éditoriale
        // ═══════════════════════════════════════════════════════════
        {
            const slide = pptx.addSlide()
            if (heroImg) {
                // Couverture portée par la photo de la ville. Voile sombre UNIFORME
                // (pas de bandes) pour garder le texte blanc parfaitement lisible.
                slide.background = { data: heroImg }
                slide.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: '0A140E', transparency: 32 }, line: { width: 0 } })
            } else {
                slide.background = { color: C.ink }
            }

            // Filet tricolore en tête
            addFlagRule(slide, 0, 0.14)

            // Wordmark discret
            slide.addText('RETOUR GAGNANT BÉNIN', {
                x: 0, y: 0.55, w: W, h: 0.35,
                fontSize: 12, bold: true, color: C.yellow,
                align: 'center', fontFace: BODY, charSpacing: 6,
            })

            // Surtitre
            slide.addText('CARNET DE VOYAGE SUR MESURE', {
                x: 0, y: 2.05, w: W, h: 0.4,
                fontSize: 13, color: C.fog,
                align: 'center', fontFace: BODY, charSpacing: 4,
            })

            // Destination — grand serif
            slide.addText(p.destination, {
                x: 0.5, y: 2.4, w: W - 1, h: 1.5,
                fontSize: 60, bold: true, color: C.white,
                align: 'center', fontFace: TITLE,
            })

            // Filet vert court sous le titre
            slide.addShape('rect', { x: W / 2 - 0.9, y: 4.0, w: 1.8, h: 0.035, fill: { color: C.green }, line: { width: 0 } })

            // Préparé pour
            slide.addText('PRÉPARÉ EXCLUSIVEMENT POUR', {
                x: 0, y: 4.35, w: W, h: 0.32,
                fontSize: 10, color: C.fog,
                align: 'center', fontFace: BODY, charSpacing: 3,
            })
            slide.addText(p.client_name, {
                x: 0, y: 4.65, w: W, h: 0.7,
                fontSize: 28, italic: true, color: C.yellow,
                align: 'center', fontFace: TITLE,
            })

            // Dates
            if (p.start_date && p.end_date) {
                const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                slide.addText(`Du ${fmtDate(p.start_date)}  au  ${fmtDate(p.end_date)}`, {
                    x: 0, y: 5.45, w: W, h: 0.36,
                    fontSize: 12, color: C.mist,
                    align: 'center', fontFace: BODY,
                })
            }

            // Sommaire du séjour — une seule ligne sobre (fini les cartes néon)
            const parts = [
                { n: items.filter(i => i.type === 'hotel').length,      s: 'hébergements' },
                { n: items.filter(i => i.type === 'restaurant').length, s: 'restaurants' },
                { n: items.filter(i => i.type === 'activity').length,   s: 'activités' },
                { n: items.filter(i => i.type === 'transport').length,  s: 'transports' },
            ].filter(x => x.n > 0).map(x => `${x.n} ${x.s}`)
            if (parts.length > 0) {
                slide.addText(parts.join('   ·   '), {
                    x: 0, y: p.start_date ? 5.85 : 5.55, w: W, h: 0.34,
                    fontSize: 12, color: C.mist, align: 'center', fontFace: BODY,
                })
            }

            // Total — pilule verte, montant jaune
            const totalY = 6.35
            slide.addShape('roundRect', {
                x: W / 2 - 2.3, y: totalY, w: 4.6, h: 0.62, rectRadius: 0.08,
                fill: { color: C.ink }, line: { color: C.green, width: 1.25 },
            })
            slide.addText(
                [
                    { text: 'TOTAL ESTIMÉ    ', options: { color: C.fog, fontSize: 12, bold: false } },
                    { text: `${fmt(p.total_amount)} ${cur}`, options: { color: C.yellow, fontSize: 15, bold: true } },
                ],
                { x: W / 2 - 2.3, y: totalY, w: 4.6, h: 0.62, align: 'center', fontFace: BODY },
            )

            addFooter(slide)
        }

        // ═══════════════════════════════════════════════════════════
        // SLIDES CONTENU
        // ═══════════════════════════════════════════════════════════
        contentItems.forEach((item, idx) => {
            const slide = pptx.addSlide()
            slide.background = { color: C.ink }
            const cat = CATEGORY[item.type] || CATEGORY.hotel

            const imgData = imageDataArr[idx]
            const imgX = 7.7            // l'image occupe la droite
            const imgW = W - imgX       // ≈ 5.63"

            // ── Image plein cadre à droite, SPLIT NET (fini les voiles dégradés
            //    qui faisaient d'affreuses rayures) ──
            if (imgData) {
                try {
                    slide.addImage({ data: imgData, x: imgX, y: 0, w: imgW, h: H })
                } catch {
                    slide.addShape('rect', { x: imgX, y: 0, w: imgW, h: H, fill: { color: C.inkSoft }, line: { width: 0 } })
                }
            } else {
                // Pas d'image : panneau sobre uni
                slide.addShape('rect', { x: imgX, y: 0, w: imgW, h: H, fill: { color: C.inkSoft }, line: { width: 0 } })
            }
            // Fin filet vert vertical sur la ligne de partage : une couture nette,
            // élégante, plutôt qu'un dégradé baveux.
            slide.addShape('rect', { x: imgX - 0.02, y: 0, w: 0.04, h: H, fill: { color: C.green }, line: { width: 0 } })

            // ── Filet tricolore en tête ──
            addFlagRule(slide, 0, 0.1)

            // ── Étiquette catégorie (contour vert, texte vert) ──
            slide.addShape('roundRect', {
                x: 0.6, y: 0.5, w: 2.5, h: 0.42, rectRadius: 0.06,
                fill: { color: C.ink }, line: { color: C.green, width: 1 },
            })
            slide.addText(cat.label.toUpperCase(), {
                x: 0.6, y: 0.5, w: 2.5, h: 0.42,
                fontSize: 10, bold: true, color: C.green,
                align: 'center', fontFace: BODY, charSpacing: 2,
            })

            // ── Localisation ──
            if (item.location) {
                slide.addText(item.location, {
                    x: 0.62, y: 1.15, w: 6.6, h: 0.36,
                    fontSize: 12, color: C.fog, fontFace: BODY, charSpacing: 1,
                })
            }

            // ── Titre — grand serif ──
            const titleY = item.location ? 1.55 : 1.15
            slide.addText(item.title, {
                x: 0.6, y: titleY, w: 6.7, h: 1.7,
                fontSize: 38, bold: true, color: C.white,
                fontFace: TITLE, wrap: true, valign: 'top',
            })

            // ── Sous-titre ──
            const stY = titleY + 1.75
            if (item.subtitle) {
                slide.addText(item.subtitle, {
                    x: 0.6, y: stY, w: 6.7, h: 0.5,
                    fontSize: 14, italic: true, color: C.green, fontFace: TITLE,
                })
            }

            // ── Description ──
            const descY = item.subtitle ? stY + 0.55 : stY
            if (item.description) {
                slide.addText(item.description, {
                    x: 0.6, y: descY, w: 6.7, h: 1.2,
                    fontSize: 12, color: C.mist, fontFace: BODY, wrap: true, lineSpacingMultiple: 1.15,
                })
            }

            // ── Points forts — pastilles vertes discrètes ──
            const hlY = (item.description ? descY + 1.3 : descY) + 0.05
            const highlights = (item.highlights || []).slice(0, 6)
            highlights.forEach((h, i) => {
                const col = i % 2
                const row = Math.floor(i / 2)
                const x = 0.6 + col * 3.35
                const yy = hlY + row * 0.5
                slide.addShape('roundRect', {
                    x, y: yy, w: 3.2, h: 0.4, rectRadius: 0.05,
                    fill: { color: C.green, transparency: 88 },
                    line: { color: C.green, width: 0.5 },
                })
                slide.addText(h, {
                    x: x + 0.12, y: yy, w: 2.95, h: 0.4,
                    fontSize: 10, color: C.white, fontFace: BODY, valign: 'middle',
                })
            })

            // ── Prix — pilule jaune, en bas de la colonne texte ──
            if (item.selling_price > 0) {
                slide.addShape('roundRect', {
                    x: 0.6, y: 6.35, w: 3.2, h: 0.55, rectRadius: 0.07,
                    fill: { color: C.yellow }, line: { width: 0 },
                })
                slide.addText(
                    [
                        { text: 'TARIF INCLUS   ', options: { color: C.greenDeep, fontSize: 9, bold: true } },
                        { text: `${fmt(item.selling_price)} ${cur}`, options: { color: '3C2E00', fontSize: 14, bold: true } },
                    ],
                    { x: 0.6, y: 6.35, w: 3.2, h: 0.55, align: 'center', fontFace: BODY, valign: 'middle' },
                )
            }

            addFooter(slide)
        })

        // ═══════════════════════════════════════════════════════════
        // SLIDE PRICING — Récapitulatif
        // ═══════════════════════════════════════════════════════════
        {
            const slide = pptx.addSlide()
            slide.background = { color: C.ink }
            addFlagRule(slide, 0, 0.14)

            // Titre serif
            slide.addText('Récapitulatif du devis', {
                x: 0, y: 0.5, w: W, h: 0.8,
                fontSize: 32, bold: true, color: C.white,
                align: 'center', fontFace: TITLE,
            })
            slide.addShape('rect', { x: W / 2 - 0.9, y: 1.35, w: 1.8, h: 0.03, fill: { color: C.yellow }, line: { width: 0 } })

            // Tableau
            const tX   = 1.6
            const tW   = W - 3.2
            const cTit = tX + 0.35
            const cTitW = tW - 3.0
            const cPri = tX + tW - 2.4
            const cPriW = 2.2
            const rH   = 0.5
            let rY     = 1.75

            // En-tête
            slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: C.green, transparency: 78 }, line: { width: 0 } })
            slide.addText('PRESTATION', { x: cTit, y: rY, w: cTitW, h: rH, fontSize: 11, bold: true, color: C.yellow, fontFace: BODY, valign: 'middle', charSpacing: 2 })
            slide.addText(`PRIX (${cur})`, { x: cPri, y: rY, w: cPriW, h: rH, fontSize: 11, bold: true, color: C.yellow, align: 'right', fontFace: BODY, valign: 'middle', charSpacing: 1 })
            rY += rH

            const maxItems = 9
            billable.slice(0, maxItems).forEach((item, i) => {
                if (i % 2 === 1) {
                    slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: C.white, transparency: 94 }, line: { width: 0 } })
                }
                // Filet vert sur le bord gauche (accent unique, uniforme)
                slide.addShape('rect', { x: tX, y: rY, w: 0.05, h: rH, fill: { color: C.green }, line: { width: 0 } })
                slide.addText(item.title, { x: cTit, y: rY, w: cTitW, h: rH, fontSize: 12, color: C.white, fontFace: BODY, valign: 'middle' })
                slide.addText(`${fmt(item.selling_price)}`, { x: cPri, y: rY, w: cPriW, h: rH, fontSize: 12, color: C.mist, align: 'right', fontFace: BODY, valign: 'middle' })
                rY += rH
            })

            // Total
            rY += 0.2
            slide.addShape('roundRect', { x: tX, y: rY, w: tW, h: 0.66, rectRadius: 0.06, fill: { color: C.green, transparency: 70 }, line: { color: C.green, width: 1.25 } })
            slide.addText('TOTAL', { x: tX + 0.35, y: rY, w: 5, h: 0.66, fontSize: 15, bold: true, color: C.white, fontFace: BODY, valign: 'middle', charSpacing: 2 })
            slide.addText(`${fmt(p.total_amount)} ${cur}`, {
                x: cPri - 0.6, y: rY, w: cPriW + 0.6, h: 0.66,
                fontSize: 17, bold: true, color: C.yellow, align: 'right', fontFace: BODY, valign: 'middle',
            })
            rY += 0.66

            // Bloc contact
            const cY = Math.min(rY + 0.45, H - 1.5)
            slide.addShape('roundRect', { x: tX, y: cY, w: tW, h: 1.05, rectRadius: 0.06, fill: { color: C.inkSoft }, line: { color: C.green, width: 0.75 } })
            slide.addText('Pour finaliser votre réservation, contactez votre conseiller :', {
                x: tX, y: cY + 0.1, w: tW, h: 0.3,
                fontSize: 10, color: C.fog, align: 'center', fontFace: BODY,
            })
            slide.addText(`${COMPANY.phone1}   ·   ${COMPANY.phone2}   ·   ${COMPANY.email}`, {
                x: tX, y: cY + 0.42, w: tW, h: 0.34,
                fontSize: 13, bold: true, color: C.yellow, align: 'center', fontFace: BODY,
            })
            slide.addText(`${COMPANY.address}   ·   IFU : ${COMPANY.ifu}   ·   RCCM : ${COMPANY.rccm}`, {
                x: tX, y: cY + 0.76, w: tW, h: 0.24,
                fontSize: 8.5, color: C.fog, align: 'center', fontFace: BODY,
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
