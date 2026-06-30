import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROLE_LABELS } from '@/lib/genealogy/requirements'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

async function getAuthUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    const supa = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supa.auth.getUser(token)
    return data?.user?.id || null
}

// ── Palette : design system Retour Gagnant + drapeau béninois ──
const COL_EMERALD = '#10B981'
const COL_EMERALD_DARK = '#047857'
const COL_GOLD = '#C9A84C'
const COL_GOLD_DEEP = '#A68B3C'
const COL_NAVY = '#1a2332'
const COL_MUTED = '#718096'
const COL_LINE = '#E2E8F0'
const COL_SOFT = '#F8FAF9'
// Drapeau du Bénin
const FLAG_GREEN = '#008751'
const FLAG_YELLOW = '#FCD116'
const FLAG_RED = '#E8112D'

const COMPANY = 'Retour Gagnant Bénin'
const CONTACT_LINE = 'contact@retourgagnantbenin.bj  ·  www.retourgagnantbenin.bj  ·  +229 01 60 32 21 21'

// Libellés FR des types de documents (vocabulaire DocType réel)
const DOC_TYPE_LABELS: Record<string, string> = {
    birth_certificate: 'Extrait de naissance',
    death_certificate: 'Acte de décès',
    marriage_certificate: 'Acte de mariage',
    family_book: 'Livret de famille',
    identity: "Pièce d'identité",
    address_proof: 'Justificatif de domicile',
    profession_proof: 'Preuve de profession',
    criminal_record: 'Casier judiciaire',
    afro_descent_proof: "Preuve d'afro-descendance",
    notarial_act: 'Acte notarial',
    military_act: 'Acte militaire',
    baptism_certificate: 'Acte de baptême',
    notoriety_act: 'Acte de notoriété',
    slave_register: 'Registre / Matricule',
    census_record: 'Recensement / Liste électorale',
    custom_certificate: 'Certificat de coutume',
    historical_identity: 'Pièce historique',
    other: 'Autre document',
}
const docTypeLabel = (t?: string | null) => (t ? DOC_TYPE_LABELS[t] || t : '—')
const roleLabel = (r?: string | null) => (r ? ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r : '—')
const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

interface DossierChecklistItem {
    label: string
    required: boolean
}

const CHECKLIST_AFRO: DossierChecklistItem[] = [
    { label: "Acte de naissance de l'enfant (apostillé)", required: true },
    { label: 'Acte de naissance des deux parents', required: true },
    { label: 'Acte de naissance des 4 grands-parents (si possible)', required: true },
    { label: 'Test ADN (origine afro-descendante)', required: false },
    { label: 'Justificatif de résidence en France/diaspora', required: true },
    { label: "Pièce d'identité (passeport en cours de validité)", required: true },
    { label: "Photos d'identité (norme ICAO, fond blanc)", required: true },
    { label: 'Casier judiciaire du pays de résidence (< 3 mois)', required: true },
    { label: 'Lettre de motivation manuscrite signée', required: true },
]

const CHECKLIST_ANCETRE: DossierChecklistItem[] = [
    { label: 'Recherche archives traite transatlantique', required: true },
    { label: "Acte d'esclavage ou registre de plantation", required: false },
    { label: "Acte de naissance de l'ancêtre identifié", required: true },
    { label: "Chaîne de filiation complète depuis l'ancêtre", required: true },
    { label: 'Photos / portraits / lettres familiales', required: false },
    { label: "Test ADN attestant l'origine béninoise", required: false },
    { label: 'Témoignages familiaux notariés', required: false },
    { label: 'Pièce du demandeur', required: true },
    { label: 'Lettre du demandeur expliquant la démarche', required: true },
]

// Charge le logo (HTTP — fiable en serverless Vercel) → data URL base64
async function loadLogoDataUrl(): Promise<string | null> {
    try {
        const res = await fetch(`${SITE_URL}/logo.jpg`)
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return `data:image/jpeg;base64,${buf.toString('base64')}`
    } catch {
        return null
    }
}

// POST /api/genealogie/dossier-pdf
// Body : { tree_id, tree_image_base64?, dossier_type?: 'afro_descendance'|'ancetre_esclavage'|'both' }
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await request.json()
        const treeId = String(body.tree_id || '')
        const treeImageB64: string | null = body.tree_image_base64 || null
        const dossierType: 'afro_descendance' | 'ancetre_esclavage' | 'both' =
            body.dossier_type === 'afro_descendance' || body.dossier_type === 'ancetre_esclavage'
                ? body.dossier_type
                : 'both'

        if (!treeId) return NextResponse.json({ error: 'tree_id requis' }, { status: 400 })

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { data: canRead } = await supabase.rpc('can_read_tree', { p_tree_id: treeId })
        if (!canRead) return NextResponse.json({ error: 'Accès refusé à cet arbre' }, { status: 403 })

        const { data: tree } = await supabase
            .from('trees')
            .select('id, name, client_first_name, client_last_name, client_email, created_at')
            .eq('id', treeId)
            .single()
        if (!tree) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

        const { data: persons } = await supabase
            .from('persons')
            .select('id, first_name, last_name, gender, birth_date, birth_place, death_date, death_place, relation_role, is_self')
            .eq('tree_id', treeId)
            .order('birth_date', { ascending: true, nullsFirst: false })

        const { data: docs } = await supabase
            .from('genealogy_documents')
            .select('id, doc_type, title, issued_date, person_id')
            .eq('tree_id', treeId)
            .order('doc_type')

        const { data: dossiers } = await supabase
            .from('dossiers')
            .select('id, dossier_type, status, progress, created_at')
            .eq('tree_id', treeId)

        const logoDataUrl = await loadLogoDataUrl()

        // ════════════════════ PDF ════════════════════
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
        const pageW = doc.internal.pageSize.getWidth()
        const pageH = doc.internal.pageSize.getHeight()
        const margin = 18

        const now = new Date()
        const clientName = `${tree.client_first_name || ''} ${tree.client_last_name || ''}`.trim() || tree.name || '—'
        const docRef = `RGB-PCF-${treeId.slice(0, 8).toUpperCase()}`

        // ── Bande tricolore (vert | jaune | rouge), pleine largeur ──
        const drawFlagBand = (yTop: number, h: number) => {
            const seg = pageW / 3
            doc.setFillColor(FLAG_GREEN); doc.rect(0, yTop, seg, h, 'F')
            doc.setFillColor(FLAG_YELLOW); doc.rect(seg, yTop, seg, h, 'F')
            doc.setFillColor(FLAG_RED); doc.rect(seg * 2, yTop, pageW - seg * 2, h, 'F')
        }

        // ════════════════ PAGE DE GARDE ════════════════
        // Bande tricolore haut
        drawFlagBand(0, 6)

        // Logo centré sur fond blanc
        const logoSize = 30
        if (logoDataUrl) {
            try {
                doc.addImage(logoDataUrl, 'JPEG', (pageW - logoSize) / 2, 20, logoSize, logoSize, undefined, 'FAST')
            } catch { /* logo indisponible */ }
        }

        // Nom de la société
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(22)
        doc.setTextColor(COL_NAVY)
        doc.text(COMPANY.toUpperCase(), pageW / 2, 62, { align: 'center' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(COL_MUTED)
        doc.text("Accompagnement de la diaspora béninoise & afro-descendante", pageW / 2, 69, { align: 'center' })

        // Filet doré central
        doc.setDrawColor(COL_GOLD)
        doc.setLineWidth(0.8)
        doc.line(pageW / 2 - 22, 76, pageW / 2 + 22, 76)

        // Bloc titre du document
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(COL_GOLD_DEEP)
        doc.text('DOSSIER OFFICIEL DE FILIATION', pageW / 2, 102, { align: 'center', charSpace: 1.2 })

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(27)
        doc.setTextColor(COL_EMERALD_DARK)
        doc.text('Plan de Composition', pageW / 2, 118, { align: 'center' })
        doc.text('de Famille', pageW / 2, 130, { align: 'center' })

        doc.setFont('helvetica', 'italic')
        doc.setFontSize(15)
        doc.setTextColor(COL_NAVY)
        doc.text(`de ${clientName}`, pageW / 2, 144, { align: 'center' })

        // ── Carte d'informations ──
        const cardX = margin
        const cardY = 162
        const cardW = pageW - margin * 2
        const cardH = 74
        doc.setFillColor(COL_SOFT)
        doc.setDrawColor(COL_LINE)
        doc.setLineWidth(0.4)
        doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD')
        // Accent émeraude à gauche
        doc.setFillColor(COL_EMERALD)
        doc.roundedRect(cardX, cardY, 2.2, cardH, 1, 1, 'F')

        const labelVal = (label: string, value: string, x: number, y: number) => {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(COL_GOLD_DEEP)
            doc.text(label.toUpperCase(), x, y, { charSpace: 0.8 })
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(11)
            doc.setTextColor(COL_NAVY)
            doc.text(value, x, y + 6)
        }

        const colL = cardX + 12
        const colR = cardX + cardW / 2 + 4
        labelVal('Établi pour', clientName, colL, cardY + 12)
        if (tree.client_email) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(COL_MUTED)
            doc.text(tree.client_email, colL, cardY + 23)
        }
        labelVal('Établi le', now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), colR, cardY + 12)
        labelVal('Référence', docRef, colL, cardY + 38)
        labelVal('Composition', `${(persons || []).length} membre(s) · ${(docs || []).length} pièce(s)`, colR, cardY + 38)

        // Mention confidentialité
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(COL_MUTED)
        doc.text(
            'Document strictement confidentiel — établi à la demande du client et réservé à son usage personnel.',
            pageW / 2, cardY + cardH + 12, { align: 'center', maxWidth: cardW }
        )

        // Pied de page de garde + bande tricolore bas
        doc.setFontSize(8.5)
        doc.setTextColor(COL_MUTED)
        doc.text(CONTACT_LINE, pageW / 2, pageH - 14, { align: 'center' })
        drawFlagBand(pageH - 6, 6)

        // ── En-tête de section (pages intérieures) ──
        const sectionHeader = (title: string, subtitle?: string) => {
            drawFlagBand(0, 3)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(17)
            doc.setTextColor(COL_EMERALD_DARK)
            doc.text(title, margin, 24)
            doc.setDrawColor(COL_GOLD)
            doc.setLineWidth(0.7)
            doc.line(margin, 28, pageW - margin, 28)
            if (subtitle) {
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(9.5)
                doc.setTextColor(COL_MUTED)
                doc.text(subtitle, margin, 34)
            }
        }

        // ════════════════ ARBRE (image) ════════════════
        if (treeImageB64) {
            doc.addPage()
            sectionHeader('Arbre de Filiation', 'Vue hiérarchique de la composition familiale')
            try {
                const imgData = treeImageB64.startsWith('data:') ? treeImageB64 : `data:image/png;base64,${treeImageB64}`
                const imgMaxW = pageW - margin * 2
                const imgMaxH = pageH - 56
                doc.addImage(imgData, 'PNG', margin, 40, imgMaxW, imgMaxH, undefined, 'FAST')
            } catch {
                doc.setFontSize(11); doc.setTextColor(COL_MUTED)
                doc.text("Aperçu de l'arbre indisponible.", margin, 48)
            }
        }

        // ════════════════ MEMBRES ════════════════
        if ((persons || []).length > 0) {
            doc.addPage()
            sectionHeader('Membres de la Famille', `${(persons || []).length} personne(s) recensée(s)`)
            autoTable(doc, {
                startY: 40,
                head: [['Nom complet', 'Sexe', 'Naissance', 'Lieu', 'Lien de parenté', 'Décès']],
                body: (persons || []).map(p => [
                    `${p.first_name || ''} ${p.last_name || ''}`.trim() + (p.is_self ? '  ★' : ''),
                    p.gender === 'male' ? 'H' : p.gender === 'female' ? 'F' : '—',
                    fmtDate(p.birth_date),
                    p.birth_place || '—',
                    roleLabel(p.relation_role),
                    p.death_date ? `† ${fmtDate(p.death_date)}` : '—',
                ]),
                headStyles: { fillColor: COL_EMERALD_DARK, textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8.5, cellPadding: 2.6, textColor: COL_NAVY, lineColor: COL_LINE, lineWidth: 0.1 },
                alternateRowStyles: { fillColor: COL_SOFT },
                margin: { left: margin, right: margin },
            })
        }

        // ════════════════ PIÈCES JUSTIFICATIVES ════════════════
        if ((docs || []).length > 0) {
            doc.addPage()
            sectionHeader('Coffre-fort Documentaire', `${(docs || []).length} pièce(s) archivée(s)`)

            const personNames: Record<string, string> = {}
            for (const p of persons || []) personNames[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim()

            autoTable(doc, {
                startY: 40,
                head: [['Type de pièce', 'Intitulé', 'Émise le', 'Concerne']],
                body: (docs || []).map(d => [
                    docTypeLabel(d.doc_type),
                    d.title || '—',
                    fmtDate(d.issued_date),
                    d.person_id ? personNames[d.person_id] || '—' : '—',
                ]),
                headStyles: { fillColor: COL_EMERALD_DARK, textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8.5, cellPadding: 2.6, textColor: COL_NAVY, lineColor: COL_LINE, lineWidth: 0.1 },
                alternateRowStyles: { fillColor: COL_SOFT },
                margin: { left: margin, right: margin },
            })
        }

        // ════════════════ PIÈCES À FOURNIR ════════════════
        const renderChecklist = (title: string, items: DossierChecklistItem[], dossier?: { status: string; progress: number }) => {
            doc.addPage()
            sectionHeader(
                'Pièces à Fournir',
                dossier
                    ? `${title} — Statut : ${dossier.status} · Avancement ${Math.round(dossier.progress)}%`
                    : title,
            )
            autoTable(doc, {
                startY: 40,
                head: [['Pièce à fournir', 'Caractère']],
                body: items.map(i => [i.label, i.required ? 'Obligatoire' : 'Optionnel']),
                headStyles: { fillColor: COL_EMERALD_DARK, textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 9.5, cellPadding: 3, textColor: COL_NAVY, lineColor: COL_LINE, lineWidth: 0.1 },
                columnStyles: { 0: { cellWidth: 132 }, 1: { cellWidth: 'auto', halign: 'center' } },
                alternateRowStyles: { fillColor: COL_SOFT },
                margin: { left: margin, right: margin },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        if (data.cell.text[0] === 'Obligatoire') {
                            data.cell.styles.textColor = COL_EMERALD_DARK
                            data.cell.styles.fontStyle = 'bold'
                        } else {
                            data.cell.styles.textColor = COL_MUTED
                        }
                    }
                },
            })
        }

        const dossierByType: Record<string, { status: string; progress: number } | undefined> = {}
        for (const d of dossiers || []) dossierByType[d.dossier_type] = { status: d.status, progress: d.progress }

        if (dossierType === 'afro_descendance' || dossierType === 'both')
            renderChecklist('Afro-descendance', CHECKLIST_AFRO, dossierByType.afro_descendance)
        if (dossierType === 'ancetre_esclavage' || dossierType === 'both')
            renderChecklist('Recherche ancestrale', CHECKLIST_ANCETRE, dossierByType.ancetre_esclavage)

        // ════════════════ Pied de page + bande tricolore (pages intérieures) ════════════════
        const pageCount = doc.getNumberOfPages()
        for (let i = 2; i <= pageCount; i++) {
            doc.setPage(i)
            drawFlagBand(pageH - 4, 4)
            doc.setFontSize(7.5)
            doc.setTextColor(COL_MUTED)
            doc.text(COMPANY, margin, pageH - 7)
            doc.text(docRef, pageW / 2, pageH - 7, { align: 'center' })
            doc.text(`Page ${i} / ${pageCount}`, pageW - margin, pageH - 7, { align: 'right' })
        }

        // ════════════════ Envoi du PDF binaire ════════════════
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
        const safeName = clientName.replace(/[^a-zA-Z0-9-]/g, '_') || treeId.slice(0, 8)
        const filename = `Plan-de-Composition-Familiale-${safeName}-${now.toISOString().slice(0, 10)}.pdf`

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(pdfBuffer.length),
            },
        })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
