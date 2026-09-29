import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deflateSync } from 'zlib'
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
// ⚠️ FABRIQUE, pas constante : pptxgenjs convertit l'objet ombre EN PLACE
// (blur×12700, angle×60000…). Un objet partagé était re-multiplié à chaque
// image → valeurs hors bornes → « PowerPoint ne peut pas ouvrir le fichier »
// dès la 2e image.
const SOFT_SHADOW = () => ({ type: 'outer' as const, color: 'BDBDBD', blur: 10, offset: 4, angle: 90, opacity: 0.45 })
// `width: 0` laisse un contour fin visible dans PowerPoint : on supprime le trait.
const NO_LINE = { type: 'none' as const }

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
    Math.round(n).toLocaleString('fr-FR').replace(/[    ]/g, ' ')

const tronquer = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s)

/* Estimation du nombre de lignes d'un texte (retour à la ligne par mots).
   `em` = largeur moyenne d'un caractère en fraction du corps : volontairement
   généreuse pour Plus Jakarta Sans (plus large que les polices de repli). */
function nbLignes(text: string, fontPt: number, widthIn: number, em = 0.5): number {
    const parLigne = Math.max(8, Math.floor((widthIn * 72) / (fontPt * em)))
    let lignes = 0
    for (const para of text.split(/\n/)) {
        let courant = 0
        lignes += 1
        for (const mot of para.split(/\s+/).filter(Boolean)) {
            const l = mot.length
            if (courant === 0) courant = l
            else if (courant + 1 + l <= parLigne) courant += 1 + l
            else { lignes += 1; courant = l }
            while (courant > parLigne) { lignes += 1; courant -= parLigne }
        }
    }
    return lignes
}
const hauteurTexte = (lignes: number, fontPt: number, interligne = 1.2) => (lignes * fontPt * interligne) / 72

/* ── Dégradé vert (PNG généré à la volée, sans dépendance) ─────────
   pptxgenjs ne sait pas remplir une forme en dégradé : on fabrique une
   petite image PNG (vert profond → vert drapeau, halo jaune discret) que
   PowerPoint étire sans escalier. Sert de visuel quand la photo manque. */
const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c >>> 0
    }
    return t
})()
function crc32(buf: Buffer): number {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
}
const hex = (h: string) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
function degradeVert(bw: number, bh: number): string {
    const w = 160
    const h = Math.max(40, Math.round((w * bh) / bw))
    const deep = hex(C.greenDeep), vif = hex(C.green), jaune = hex(C.yellow)
    const raw = Buffer.alloc((w * 3 + 1) * h)
    for (let y = 0; y < h; y++) {
        const row = y * (w * 3 + 1)
        raw[row] = 0
        for (let x = 0; x < w; x++) {
            const u = x / (w - 1), v = y / (h - 1)
            const t = Math.min(1, u * 0.55 + v * 0.45)
            let r = deep[0] + (vif[0] - deep[0]) * t
            let g = deep[1] + (vif[1] - deep[1]) * t
            let b = deep[2] + (vif[2] - deep[2]) * t
            // Halo jaune doux en bas à droite (soleil du drapeau).
            const d = Math.hypot(u - 0.92, v - 0.95)
            const halo = Math.pow(Math.max(0, 1 - d / 0.75), 2) * 0.28
            r += (jaune[0] - r) * halo; g += (jaune[1] - g) * halo; b += (jaune[2] - b) * halo
            // Voile clair en haut à gauche.
            const lum = Math.pow(Math.max(0, 1 - Math.hypot(u, v) / 0.9), 2) * 0.1
            r += (255 - r) * lum; g += (255 - g) * lum; b += (255 - b) * lum
            const o = row + 1 + x * 3
            raw[o] = Math.round(r); raw[o + 1] = Math.round(g); raw[o + 2] = Math.round(b)
        }
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(raw, { level: 9 })),
        pngChunk('IEND', Buffer.alloc(0)),
    ])
    return `data:image/png;base64,${png.toString('base64')}`
}

async function fetchImageBase64(url: string): Promise<string | null> {
    try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 7000)
        const resp = await fetch(url, { signal: ctrl.signal })
        clearTimeout(timer)
        if (!resp.ok) return null
        const mime = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
        if (!mime.startsWith('image/')) return null
        const buf = await resp.arrayBuffer()
        if (buf.byteLength === 0) return null
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

// Visuel de repli quand aucune image n'est disponible.
interface Repli { label: string; title?: string; sub?: string }

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
        const addFlagRule = (slide: pptxgen.Slide, y: number, h = 0.1, x0 = 0, w0 = W) => {
            slide.addShape('rect', { x: x0,               y, w: w0 * 0.34, h, fill: { color: C.green },  line: NO_LINE })
            slide.addShape('rect', { x: x0 + w0 * 0.34,   y, w: w0 * 0.33, h, fill: { color: C.yellow }, line: NO_LINE })
            slide.addShape('rect', { x: x0 + w0 * 0.67,   y, w: w0 * 0.33, h, fill: { color: C.red },    line: NO_LINE })
        }

        // Pied de page discret sur blanc.
        const addFooter = (slide: pptxgen.Slide) => {
            slide.addText(
                `${COMPANY.name}   ·   ${COMPANY.phone1}   ·   ${COMPANY.email}`,
                { x: 0.5, y: H - 0.5, w: W - 1, h: 0.3, fontSize: 8, color: C.inkFaint, align: 'center', fontFace: FONT, charSpacing: 1 },
            )
            addFlagRule(slide, H - 0.1, 0.1)
        }

        /* Visuel de repli : dégradé vert + type de prestation en toutes lettres,
           nom de l'établissement, liseré tricolore. Remplace l'ancien « RG » brut. */
        const placePlaceholder = (slide: pptxgen.Slide, bx: number, by: number, bw: number, bh: number, r: Repli) => {
            slide.addImage({ data: degradeVert(bw, bh), x: bx, y: by, w: bw, h: bh, sizing: { type: 'cover', w: bw, h: bh }, shadow: SOFT_SHADOW() })
            const cx = bx + 0.5, cw = bw - 1
            const titre = r.title ? tronquer(r.title, 70) : ''
            const lt = titre ? Math.min(3, nbLignes(titre, 18, cw, 0.52)) : 0
            const blocH = 0.3 + 0.12 + 0.75 + 0.2 + 0.05 + (lt ? 0.25 + hauteurTexte(lt, 18, 1.15) : 0) + (r.sub ? 0.4 : 0)
            let y = by + (bh - blocH) / 2
            slide.addText('RETOUR GAGNANT BÉNIN', {
                x: cx, y, w: cw, h: 0.3, fontSize: 10, bold: true, color: C.yellow, align: 'center', fontFace: FONT, charSpacing: 4, margin: 0,
            })
            y += 0.42
            slide.addText(r.label, {
                x: cx, y, w: cw, h: 0.75, fontSize: 34, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: FONT, margin: 0,
            })
            y += 0.95
            addFlagRule(slide, y, 0.05, bx + bw / 2 - 0.7, 1.4)
            y += 0.05
            if (lt) {
                y += 0.25
                const th = hauteurTexte(lt, 18, 1.15)
                slide.addText(titre, {
                    x: cx, y, w: cw, h: th, fontSize: 18, color: C.white, align: 'center', valign: 'top', fontFace: FONT, margin: 0,
                    lineSpacingMultiple: 0.95,
                })
                y += th
            }
            if (r.sub) {
                slide.addText(r.sub, {
                    x: cx, y: y + 0.1, w: cw, h: 0.3, fontSize: 11, color: 'D9EFE4', align: 'center', fontFace: FONT, margin: 0,
                })
            }
        }

        /* Mosaïque d'images « cover » (recadrées, jamais déformées) dans un
           rectangle (bx,by,bw,bh). 1→plein cadre, 2→empilées, 3→une grande +
           deux, 4→grille 2×2, 5+→2×2 avec pastille « +N ». Ombre douce grise. */
        const placeImages = (slide: pptxgen.Slide, imgs: string[], bx: number, by: number, bw: number, bh: number, repli: Repli) => {
            const g = 0.14 // gouttière
            const frame = (data: string, x: number, y: number, w: number, h: number) => {
                slide.addImage({ data, x, y, w, h, sizing: { type: 'cover', w, h }, shadow: SOFT_SHADOW() })
                slide.addShape('rect', { x, y, w, h, fill: { type: 'none' }, line: { color: C.lineStrong, width: 0.75 } })
            }
            if (imgs.length === 0) {
                placePlaceholder(slide, bx, by, bw, bh, repli)
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
                slide.addShape('rect', { x: ex, y: ey, w: cw, h: ch, fill: { color: '3C3C3C', transparency: 35 }, line: NO_LINE })
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

            // Colonne photo à droite (ou visuel dégradé si aucune image)
            placeImages(slide, heroImg ? [heroImg] : [], 6.85, 0.75, 5.95, 6.0,
                { label: 'Carnet de voyage', title: p.destination, sub: 'Séjour sur mesure au Bénin' })

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
            slide.addShape('rect', { x: Lx, y: 3.55, w: 1.4, h: 0.045, fill: { color: C.green }, line: NO_LINE })

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

            // Accord singulier/pluriel : « 1 transport », « 2 transports ».
            const parts = [
                { n: items.filter(i => i.type === 'hotel').length,      s: 'hébergement' },
                { n: items.filter(i => i.type === 'restaurant').length, s: 'restaurant' },
                { n: items.filter(i => i.type === 'activity').length,   s: 'activité' },
                { n: items.filter(i => i.type === 'transport').length,  s: 'transport' },
            ].filter(x => x.n > 0).map(x => `${x.n} ${x.s}${x.n > 1 ? 's' : ''}`)
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
        // Colonne de gauche calculée en hauteur réelle (lignes estimées) puis
        // centrée verticalement sur la colonne image : plus de grand vide
        // entre le titre et le sous-titre.
        // ═══════════════════════════════════════════════════════════
        const IMG_Y = 0.75, IMG_H = 5.6
        contentItems.forEach((item, idx) => {
            const slide = pptx.addSlide()
            slide.background = { color: C.white }
            const cat = CATEGORY[item.type] || CATEGORY.hotel
            addFlagRule(slide, 0, 0.12)

            // Mosaïque d'images à droite (ou visuel dégradé)
            placeImages(slide, itemImages[idx] || [], 6.85, IMG_Y, 5.95, IMG_H,
                { label: cat.label || 'Prestation', title: item.title, sub: item.location || undefined })

            const Lx = 0.7, Lw = 5.85

            // ── Mesures ──
            // Titre, sous-titre et description vivent dans UNE seule zone de
            // texte (paragraphes successifs) : le sous-titre suit toujours le
            // titre, quelle que soit la police réellement rendue. La hauteur
            // n'est qu'estimée pour placer les pastilles en dessous.
            const EM_TITRE = 0.5, EM_TEXTE = 0.47
            const title = tronquer(item.title || '', 110)
            let titleSize = 32
            let tl = nbLignes(title, titleSize, Lw, EM_TITRE)
            if (tl > 2) { titleSize = 26; tl = Math.min(3, nbLignes(title, titleSize, Lw, EM_TITRE)) }
            const titleH = hauteurTexte(tl, titleSize, 1.1)

            const SUB_PT = 13, SUB_AVANT = 6          // pt
            const subtitle = item.subtitle ? tronquer(item.subtitle, 140) : ''
            const sl = subtitle ? Math.min(2, nbLignes(subtitle, SUB_PT, Lw, EM_TEXTE)) : 0
            const subH = sl ? hauteurTexte(sl, SUB_PT, 1.2) + SUB_AVANT / 72 : 0

            const DESC_PT = 11.5, DESC_AVANT = 12, DESC_MAX_LIGNES = 8
            let desc = item.description || ''
            while (desc && nbLignes(desc, DESC_PT, Lw, EM_TEXTE) > DESC_MAX_LIGNES) {
                desc = tronquer(desc, Math.floor(desc.length * 0.9))
            }
            const dl = desc ? nbLignes(desc, DESC_PT, Lw, EM_TEXTE) : 0
            const descH = dl ? hauteurTexte(dl, DESC_PT, 1.2 * 1.2) + DESC_AVANT / 72 : 0
            const texteH = titleH + subH + descH + 0.08

            const highlights = (item.highlights || []).slice(0, 6)
            const hlRows = Math.ceil(highlights.length / 2)
            const hlH = hlRows ? hlRows * 0.48 - 0.08 : 0
            const hasPrice = item.selling_price > 0

            const G_CAT = 0.12, G_LOC = 0.1, G_HL = 0.25, G_PRICE = 0.35
            const blocs: number[] = [0.3]                                  // catégorie
            if (item.location) blocs.push(G_CAT + 0.3)                     // localisation
            blocs.push((item.location ? G_LOC : G_CAT) + texteH)           // titre + sous-titre + description
            if (hlH) blocs.push(G_HL + hlH)
            if (hasPrice) blocs.push(G_PRICE + 0.55)
            const blocH = blocs.reduce((a, b) => a + b, 0)

            // Centré sur la colonne image, borné entre le liseré et le pied de page.
            const TOP = 0.6, BOTTOM = H - 0.62
            let y = IMG_Y + (IMG_H - blocH) / 2
            y = Math.max(TOP, Math.min(y, BOTTOM - blocH))

            // Sur-titre catégorie (vert)
            slide.addText(cat.label.toUpperCase(), {
                x: Lx, y, w: Lw, h: 0.3, fontSize: 11, bold: true, color: C.green,
                fontFace: FONT, charSpacing: 2, margin: 0, valign: 'middle',
            })
            y += 0.3
            // Localisation
            if (item.location) {
                y += G_CAT
                slide.addText(item.location, {
                    x: Lx, y, w: Lw, h: 0.3, fontSize: 12, color: C.inkFaint, fontFace: FONT, margin: 0, valign: 'middle',
                })
                y += 0.3
            }
            // Titre (encre) → sous-titre (vert, italique) → description (encre douce)
            y += item.location ? G_LOC : G_CAT
            const runs: pptxgen.TextProps[] = [
                { text: title, options: { fontSize: titleSize, bold: true, color: C.ink, breakLine: true, lineSpacingMultiple: 0.95 } },
            ]
            if (subtitle) {
                runs.push({ text: subtitle, options: { fontSize: SUB_PT, italic: true, color: C.green, breakLine: true, paraSpaceBefore: SUB_AVANT } })
            }
            if (desc) {
                runs.push({ text: desc, options: { fontSize: DESC_PT, color: C.inkMuted, paraSpaceBefore: DESC_AVANT, lineSpacingMultiple: 1.2 } })
            }
            slide.addText(runs, { x: Lx, y, w: Lw, h: texteH, fontFace: FONT, valign: 'top', margin: 0 })
            y += texteH
            // Points forts : pastilles vert doux
            if (hlH) {
                y += G_HL
                highlights.forEach((h, i) => {
                    const col = i % 2
                    const row = Math.floor(i / 2)
                    const x = Lx + col * 2.95
                    const yy = y + row * 0.48
                    slide.addShape('roundRect', {
                        x, y: yy, w: 2.8, h: 0.4, rectRadius: 0.06,
                        fill: { color: C.greenSoft }, line: NO_LINE,
                    })
                    slide.addText(tronquer(h, 48), {
                        x: x + 0.14, y: yy, w: 2.55, h: 0.4, fontSize: 9.5, color: C.greenDeep,
                        fontFace: FONT, valign: 'middle', margin: 0,
                    })
                })
                y += hlH
            }

            // Prix : pilule JAUNE (fond premium), texte encre
            if (hasPrice) {
                y += G_PRICE
                slide.addShape('roundRect', {
                    x: Lx, y, w: 3.3, h: 0.55, rectRadius: 0.08,
                    fill: { color: C.yellow }, line: NO_LINE,
                })
                slide.addText(
                    [
                        { text: 'TARIF INCLUS   ', options: { color: C.yellowInk, fontSize: 9, bold: true } },
                        { text: `${fmt(item.selling_price)} ${cur}`, options: { color: '3C2E00', fontSize: 14, bold: true } },
                    ],
                    { x: Lx + 0.1, y, w: 3.1, h: 0.55, align: 'center', valign: 'middle', fontFace: FONT },
                )
            }

            addFooter(slide)
        })

        // ═══════════════════════════════════════════════════════════
        // SLIDE(S) PRICING : récapitulatif blanc.
        // Positions calculées de bas en haut : bloc contact ancré au-dessus du
        // pied de page, TOTAL au-dessus, table dans l'espace restant. Lignes
        // resserrées si besoin, puis pagination (« suite ») : jamais de
        // chevauchement, jamais de ligne perdue.
        // ═══════════════════════════════════════════════════════════
        {
            const tX = 1.6, tW = W - 3.2
            const cTit = tX + 0.35, cTitW = tW - 3.0
            const cPri = tX + tW - 2.4, cPriW = 2.2
            const HEAD_Y = 1.8, HEAD_H = 0.5
            const CONTACT_H = 1.05, TOTAL_H = 0.66
            const CONTACT_Y = H - 0.62 - CONTACT_H          // 5,83
            const TOTAL_Y = CONTACT_Y - 0.25 - TOTAL_H      // 4,92
            const R_MAX = 0.5, R_MIN = 0.34
            // Pages intermédiaires : place réservée à la mention « suite » au-dessus du pied.
            const tableFin = (dernier: boolean) => (dernier ? TOTAL_Y - 0.2 : H - 1.05)
            const espace = (dernier: boolean) => tableFin(dernier) - (HEAD_Y + HEAD_H)
            const capDernier = Math.max(1, Math.floor(espace(true) / R_MIN + 1e-6))
            const capAutres = Math.max(1, Math.floor(espace(false) / R_MIN + 1e-6))

            // Découpage en pages : la dernière porte TOTAL + contact.
            const pages: ItemRow[][] = []
            let reste = [...billable]
            while (reste.length > capDernier) {
                const n = Math.min(capAutres, reste.length - 1)
                pages.push(reste.slice(0, n))
                reste = reste.slice(n)
            }
            pages.push(reste)

            pages.forEach((lignes, pi) => {
                const dernier = pi === pages.length - 1
                const slide = pptx.addSlide()
                slide.background = { color: C.white }
                addFlagRule(slide, 0, 0.14)

                const titre = pages.length > 1 ? `Récapitulatif du devis (${pi + 1}/${pages.length})` : 'Récapitulatif du devis'
                slide.addText(titre, {
                    x: 0, y: 0.55, w: W, h: 0.8, fontSize: 30, bold: true, color: C.ink, align: 'center', fontFace: FONT,
                })
                slide.addShape('rect', { x: W / 2 - 0.9, y: 1.35, w: 1.8, h: 0.045, fill: { color: C.green }, line: NO_LINE })

                const rH = lignes.length ? Math.max(R_MIN, Math.min(R_MAX, espace(dernier) / lignes.length)) : R_MAX
                const fs = rH >= 0.45 ? 12 : 11
                let rY = HEAD_Y

                slide.addShape('rect', { x: tX, y: rY, w: tW, h: HEAD_H, fill: { color: C.greenSoft }, line: NO_LINE })
                slide.addText('PRESTATION', { x: cTit, y: rY, w: cTitW, h: HEAD_H, fontSize: 11, bold: true, color: C.greenDeep, fontFace: FONT, valign: 'middle', charSpacing: 2 })
                slide.addText(`PRIX (${cur})`, { x: cPri, y: rY, w: cPriW, h: HEAD_H, fontSize: 11, bold: true, color: C.greenDeep, align: 'right', fontFace: FONT, valign: 'middle', charSpacing: 1 })
                rY += HEAD_H

                lignes.forEach((item, i) => {
                    if (i % 2 === 1) {
                        slide.addShape('rect', { x: tX, y: rY, w: tW, h: rH, fill: { color: C.mist }, line: NO_LINE })
                    }
                    slide.addShape('rect', { x: tX, y: rY, w: 0.06, h: rH, fill: { color: C.green }, line: NO_LINE })
                    slide.addText(tronquer(item.title, 85), { x: cTit, y: rY, w: cTitW, h: rH, fontSize: fs, color: C.ink, fontFace: FONT, valign: 'middle' })
                    slide.addText(`${fmt(item.selling_price)}`, { x: cPri, y: rY, w: cPriW, h: rH, fontSize: fs, color: C.inkMuted, align: 'right', fontFace: FONT, valign: 'middle' })
                    rY += rH
                })
                // Séparateur bas de table
                slide.addShape('rect', { x: tX, y: rY, w: tW, h: 0.015, fill: { color: C.lineStrong }, line: NO_LINE })

                if (!dernier) {
                    slide.addText('Suite du récapitulatif sur la page suivante →', {
                        x: tX, y: rY + 0.12, w: tW, h: 0.3, fontSize: 10, italic: true, color: C.inkFaint, align: 'right', fontFace: FONT,
                    })
                    addFooter(slide)
                    return
                }

                // Total : collé sous la table si elle est courte, sinon à sa place fixe.
                const totalY = Math.min(TOTAL_Y, rY + 0.25)
                slide.addShape('roundRect', { x: tX, y: totalY, w: tW, h: TOTAL_H, rectRadius: 0.07, fill: { color: C.green }, line: NO_LINE })
                slide.addText('TOTAL', { x: tX + 0.35, y: totalY, w: 5, h: TOTAL_H, fontSize: 15, bold: true, color: C.white, fontFace: FONT, valign: 'middle', charSpacing: 2 })
                slide.addText(`${fmt(p.total_amount)} ${cur}`, {
                    x: cPri - 0.6, y: totalY, w: cPriW + 0.6, h: TOTAL_H, fontSize: 17, bold: true, color: C.yellow, align: 'right', fontFace: FONT, valign: 'middle',
                })

                // Bloc contact : vert doux, toujours SOUS le total (écart ≥ 0,25").
                const cY = Math.min(CONTACT_Y, totalY + TOTAL_H + 0.3)
                slide.addShape('roundRect', { x: tX, y: cY, w: tW, h: CONTACT_H, rectRadius: 0.08, fill: { color: C.greenSoft }, line: NO_LINE })
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
            })
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
