/* Téléchargement direct de la « Preuve d'afro-descendance » en PDF A4.

   Avant (2026-10-16) le bouton ouvrait la boîte d'impression du navigateur :
   l'équipe devait encore choisir « Enregistrer au format PDF ». Ici le
   document affiché dans l'aperçu est dessiné par le navigateur (échelle 2), puis
   découpé en pages A4 entre deux blocs, jamais au milieu d'une carte, d'une
   ligne de tableau ou d'un titre isolé, et enregistré avec jsPDF.
   Navigateur uniquement : appelé depuis l'éditeur. */

/** Blocs qu'une coupure de page ne doit jamais traverser. */
const INSECABLES = 'header.entete, .drapeau, .titre, .cadre, h3, .demandeur .nomfort, dl .ligne, .carte, .niveau, .racine, thead, tbody tr, .note, .cloture, .avert'
const A4 = { l: 210, h: 297 }
const MARGE = { haut: 12, bas: 14 } // mm ; la première page commence au bord (en-tête pleine largeur)
const ECHELLE = 2

type Bloc = { haut: number; bas: number; titre: boolean }

/** Découpe [début, fin] en px CSS, de façon à ne couper aucun bloc. */
function decouper(hauteur: number, blocs: Bloc[], pxParMm: number): [number, number][] {
    const pages: [number, number][] = []
    let debut = 0
    while (debut < hauteur - 1) {
        const limite = debut + (A4.h - (pages.length ? MARGE.haut : 0) - MARGE.bas) * pxParMm
        if (limite >= hauteur) { pages.push([debut, hauteur]); break }
        let coupe = limite
        // Un bloc traversé : la page s'arrête juste avant lui.
        for (let garde = 0; garde < 60; garde++) {
            const traverse = blocs.find(b => b.haut > debut + 1 && b.haut < coupe - 0.5 && b.bas > coupe + 0.5)
            if (!traverse) break
            coupe = traverse.haut
        }
        // Un titre de section ne reste pas seul en bas de page.
        const titre = blocs.find(b => b.titre && b.haut > debut + 1 && b.bas <= coupe
            && !blocs.some(x => !x.titre && x.haut >= b.bas - 0.5 && x.bas <= coupe))
        if (titre) coupe = titre.haut
        if (coupe <= debut + 40) coupe = limite // bloc plus haut qu'une page : coupe franche
        pages.push([debut, coupe])
        debut = coupe
    }
    return pages
}

const enDataUrl = async (url: string): Promise<string> => {
    const blob = await (await fetch(url)).blob()
    return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(blob) })
}

/** Remplace chaque url("…") / src="…" par sa version data: (une image SVG ne charge rien d'externe). */
async function integrer(texte: string, motif: RegExp): Promise<string> {
    const urls = [...new Set(Array.from(texte.matchAll(motif), m => m[1]))]
    const donnees = await Promise.all(urls.map(enDataUrl))
    urls.forEach((u, i) => { texte = texte.split(u).join(donnees[i]) })
    return texte
}

/* Le document est dessiné par le navigateur lui-même : feuille et CSS du
   document dans une image SVG (foreignObject), polices et images intégrées.
   Même moteur, mêmes règles, même largeur : la mise en page est celle de
   l'aperçu, donc les mesures de découpe restent justes. (html-to-image
   réduisait chaque taille de police : le texte ne passait plus à la ligne
   au même endroit.) */
async function dessiner(doc: Document, feuille: HTMLElement): Promise<HTMLCanvasElement> {
    const l = feuille.offsetWidth, h = feuille.offsetHeight
    const css = await integrer(
        Array.from(doc.querySelectorAll('style'), s => s.textContent || '').join('\n')
            + '.feuille{box-shadow:none!important;margin:0!important}.filigrane{display:none!important}',
        /url\("([^"]+\.woff2)"\)/g,
    )
    const corps = await integrer(new XMLSerializer().serializeToString(feuille), /src="([^"]+)"/g)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}"><foreignObject x="0" y="0" width="${l}" height="${h}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA[${css}]]></style>${corps}</div></foreignObject></svg>`
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await img.decode()
    const toile = document.createElement('canvas')
    toile.width = Math.round(l * ECHELLE); toile.height = Math.round(h * ECHELLE)
    const ctx = toile.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, toile.width, toile.height)
    ctx.scale(ECHELLE, ECHELLE)
    ctx.drawImage(img, 0, 0, l, h)
    return toile
}

/** Logo en gris pour le filigrane de chaque page. */
async function filigrane(url: string): Promise<string | null> {
    try {
        const img = new Image()
        img.src = url
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.filter = 'grayscale(1)'
        ctx.drawImage(img, 0, 0)
        return c.toDataURL('image/png')
    } catch { return null }
}

export async function telechargerPreuvePdf(doc: Document, nomFichier: string, refDossier: string): Promise<void> {
    const { jsPDF, GState } = await import('jspdf')
    await doc.fonts?.ready
    const racine = doc.documentElement
    const zoom = racine.style.getPropertyValue('zoom')
    racine.style.removeProperty('zoom') // l'aperçu réduit ne doit pas fausser les mesures
    try {
        const feuille = doc.querySelector<HTMLElement>('.feuille')
        if (!feuille) throw new Error('Document introuvable dans l’aperçu.')
        const origine = feuille.getBoundingClientRect().top
        const blocs: Bloc[] = Array.from(doc.querySelectorAll<HTMLElement>(INSECABLES)).map(el => {
            const r = el.getBoundingClientRect()
            return { haut: r.top - origine, bas: r.bottom - origine, titre: el.tagName === 'H3' }
        })
        const pxParMm = feuille.offsetWidth / A4.l
        const pages = decouper(feuille.offsetHeight, blocs, pxParMm)

        const toile = await dessiner(doc, feuille)
        const logo = await filigrane(`${window.location.origin}/images/logo-preuve.png`)

        const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
        pages.forEach(([a, b], i) => {
            if (i) pdf.addPage()
            const tranche = document.createElement('canvas')
            tranche.width = toile.width
            tranche.height = Math.max(1, Math.round((b - a) * ECHELLE))
            tranche.getContext('2d')!.drawImage(toile, 0, Math.round(a * ECHELLE), toile.width, tranche.height, 0, 0, toile.width, tranche.height)
            pdf.addImage(tranche.toDataURL('image/jpeg', 0.93), 'JPEG', 0, i ? MARGE.haut : 0, A4.l, (b - a) / pxParMm, undefined, 'FAST')
            if (logo) {
                pdf.saveGraphicsState()
                pdf.setGState(new GState({ opacity: 0.045 }))
                pdf.addImage(logo, 'PNG', (A4.l - 115) / 2, (A4.h - 115) / 2, 115, 115)
                pdf.restoreGraphicsState()
            }
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7.5)
            pdf.setTextColor(138, 144, 153)
            pdf.text(`Retour Gagnant Bénin · Réf. ${refDossier}`, 16, A4.h - 7)
            pdf.text(`Page ${i + 1} / ${pages.length}`, A4.l - 16, A4.h - 7, { align: 'right' })
        })
        pdf.save(`${nomFichier}.pdf`)
    } finally {
        if (zoom) racine.style.setProperty('zoom', zoom)
    }
}
