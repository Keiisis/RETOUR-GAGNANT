import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import { LOGO_BASE64 } from '@/lib/logoBase64'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * GET /api/reports/monthly?month=2026-03&agent_id=xxx
 *
 * Génère un rapport PDF mensuel de l'activité financière.
 * - month : format YYYY-MM (défaut : mois courant)
 * - agent_id : optionnel, filtre par agent (si vide → rapport global)
 *
 * Le PDF inclut :
 * - KPIs : CA total, nombre de documents, impayés, taux de recouvrement
 * - Répartition devis vs factures
 * - Top 5 clients par montant
 * - Liste détaillée de toutes les opérations
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const monthParam = url.searchParams.get('month') || ''
        const agentId = url.searchParams.get('agent_id') || ''

        // Déterminer le mois
        const now = new Date()
        let year: number, month: number

        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            const [y, m] = monthParam.split('-').map(Number)
            year = y
            month = m
        } else {
            year = now.getFullYear()
            month = now.getMonth() + 1
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endMonth = month === 12 ? 1 : month + 1
        const endYear = month === 12 ? year + 1 : year
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

        const monthLabel = new Date(year, month - 1).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
        })

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Configuration manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // ═══ RÉCUPÉRER LES DOCUMENTS DU MOIS ═══════════════════════════
        let query = supabase
            .from('documents_financiers')
            .select('*')
            .gte('created_at', startDate)
            .lt('created_at', endDate)
            .order('created_at', { ascending: true })

        if (agentId) {
            query = query.eq('agent_id', agentId)
        }

        const { data: documents, error: fetchErr } = await query

        if (fetchErr) {
            return NextResponse.json({ error: fetchErr.message }, { status: 500 })
        }

        const docs = documents || []

        // ═══ RÉCUPÉRER LE TEMPLATE OFFICIEL ════════════════════════════
        const { data: tplData } = await supabase
            .from('document_templates')
            .select('content')
            .eq('id', 'official_devis_facture')
            .single()

        const tpl = tplData?.content || {}
        const headerText = tpl.header || 'RETOUR GAGNANT BÉNIN'
        const footerText = tpl.footer || ''

        // ═══ CALCULER LES METRICS ═════════════════════════════════════
        const factures = docs.filter(d => d.type === 'facture')
        const devis = docs.filter(d => d.type === 'devis')

        const facturesPaye = factures.filter(d => d.status === 'paye')
        const facturesImpayees = factures.filter(d => ['accepte', 'envoye'].includes(d.status))
        const devisAcceptes = devis.filter(d => d.status === 'accepte')

        const caTotal = facturesPaye.reduce((s, d) => s + (d.total || 0), 0)
        const montantImpaye = facturesImpayees.reduce((s, d) => s + (d.total || 0), 0)
        const montantDevis = devis.reduce((s, d) => s + (d.total || 0), 0)
        const montantDevisAcceptes = devisAcceptes.reduce((s, d) => s + (d.total || 0), 0)

        const tauxRecouvrement = (caTotal + montantImpaye) > 0
            ? Math.round((caTotal / (caTotal + montantImpaye)) * 100)
            : 100
        const tauxConversion = devis.length > 0
            ? Math.round((devisAcceptes.length / devis.length) * 100)
            : 0

        // Top 5 clients
        const clientMap = new Map<string, number>()
        for (const d of factures) {
            const name = d.client_nom || 'Inconnu'
            clientMap.set(name, (clientMap.get(name) || 0) + (d.total || 0))
        }
        const topClients = [...clientMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

        // ═══ GÉNÉRER LE PDF ═══════════════════════════════════════════
        const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

        const doc = new jsPDF('p', 'mm', 'a4')
        const w = doc.internal.pageSize.getWidth()
        let y = 15

        // ── Header ──
        // Bande tricolore
        doc.setFillColor(0, 135, 81)
        doc.rect(0, 0, w / 3, 4, 'F')
        doc.setFillColor(252, 209, 22)
        doc.rect(w / 3, 0, w / 3, 4, 'F')
        doc.setFillColor(232, 17, 45)
        doc.rect((w / 3) * 2, 0, w / 3, 4, 'F')

        y = 12

        // Logo
        try {
            doc.addImage(LOGO_BASE64, 'PNG', 15, y, 22, 22)
        } catch {
            // Pas de logo disponible
        }

        // Titre entreprise
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(0, 135, 81)
        doc.text('RETOUR', 42, y + 8)
        doc.setTextColor(232, 17, 45)
        doc.text('GAGNANT', 42 + doc.getTextWidth('RETOUR') + 2, y + 8)

        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        const firstLine = (headerText || '').split('\n')[0] || 'BÉNIN'
        doc.text(firstLine.toUpperCase(), 42, y + 14)

        // Titre du rapport
        doc.setFontSize(11)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        const reportTitle = `RAPPORT FINANCIER : ${monthLabel.toUpperCase()}`
        doc.text(reportTitle, w - 15, y + 8, { align: 'right' })

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100)
        const dateGeneration = `Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
        doc.text(dateGeneration, w - 15, y + 14, { align: 'right' })

        if (agentId) {
            doc.setTextColor(0, 135, 81)
            doc.text(`Agent: ${agentId.slice(0, 8)}...`, w - 15, y + 20, { align: 'right' })
        }

        y += 30

        // Ligne séparatrice
        doc.setDrawColor(0, 135, 81)
        doc.setLineWidth(0.5)
        doc.line(15, y, w - 15, y)
        y += 8

        // ── KPIs ──
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 135, 81)
        doc.text('INDICATEURS CLÉS DE PERFORMANCE', 15, y)
        y += 8

        const kpiBoxW = (w - 40) / 4
        const kpiBoxH = 28
        const kpiBoxGap = 3
        const kpiStartX = 15

        const kpis = [
            { label: 'CA Encaissé', value: `${fmtN(caTotal)}`, unit: 'FCFA', color: [0, 135, 81] },
            { label: 'Impayés', value: `${fmtN(montantImpaye)}`, unit: 'FCFA', color: [239, 68, 68] },
            { label: 'Recouvrement', value: `${tauxRecouvrement}%`, unit: '', color: [59, 130, 246] },
            { label: 'Conv. Devis', value: `${tauxConversion}%`, unit: '', color: [252, 209, 22] },
        ]

        kpis.forEach((kpi, i) => {
            const x = kpiStartX + i * (kpiBoxW + kpiBoxGap)

            // Box background
            doc.setFillColor(245, 247, 250)
            doc.roundedRect(x, y, kpiBoxW, kpiBoxH, 3, 3, 'F')

            // Accent bar
            doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2])
            doc.rect(x, y, kpiBoxW, 2, 'F')

            // Label
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(120)
            doc.text(kpi.label.toUpperCase(), x + kpiBoxW / 2, y + 10, { align: 'center' })

            // Value
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2])
            doc.text(kpi.value, x + kpiBoxW / 2, y + 20, { align: 'center' })

            // Unit
            if (kpi.unit) {
                doc.setFontSize(6)
                doc.setTextColor(150)
                doc.text(kpi.unit, x + kpiBoxW / 2, y + 25, { align: 'center' })
            }
        })

        y += kpiBoxH + 10

        // ── Résumé par type ──
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 135, 81)
        doc.text('RÉPARTITION', 15, y)
        y += 7

        const summaryData = [
            ['Type', 'Nombre', 'Montant Total', 'Statut principal'],
            ['Factures payées', String(facturesPaye.length), `${fmtN(caTotal)} FCFA`, ' Encaissé'],
            ['Factures impayées', String(facturesImpayees.length), `${fmtN(montantImpaye)} FCFA`, '⏳ En attente'],
            ['Devis émis', String(devis.length), `${fmtN(montantDevis)} FCFA`, `${tauxConversion}% acceptés`],
            ['Devis acceptés', String(devisAcceptes.length), `${fmtN(montantDevisAcceptes)} FCFA`, ' Convertis'],
            ['TOTAL documents', String(docs.length), `${fmtN(caTotal + montantImpaye + montantDevis)} FCFA`, ''],
        ]

        // Simple table
        const colWidths = [45, 25, 45, 50]
        const tableStartX = 15

        summaryData.forEach((row, ri) => {
            let x = tableStartX
            row.forEach((cell, ci) => {
                if (ri === 0) {
                    doc.setFillColor(0, 135, 81)
                    doc.rect(x, y - 4, colWidths[ci], 7, 'F')
                    doc.setTextColor(255)
                    doc.setFontSize(7)
                    doc.setFont('helvetica', 'bold')
                } else if (ri === summaryData.length - 1) {
                    doc.setFillColor(245, 247, 250)
                    doc.rect(x, y - 4, colWidths[ci], 7, 'F')
                    doc.setTextColor(0)
                    doc.setFontSize(7)
                    doc.setFont('helvetica', 'bold')
                } else {
                    doc.setTextColor(50)
                    doc.setFontSize(7)
                    doc.setFont('helvetica', 'normal')
                }
                doc.text(cell, x + 2, y)
                x += colWidths[ci]
            })
            y += 7
        })

        y += 6

        // ── Top clients ──
        if (topClients.length > 0) {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(0, 135, 81)
            doc.text('TOP CLIENTS', 15, y)
            y += 7

            topClients.forEach(([name, total], i) => {
                // Bar
                const maxBarW = 80
                const barW = topClients[0][1] > 0 ? (total / topClients[0][1]) * maxBarW : 0

                doc.setFontSize(7)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(50)
                doc.text(`${i + 1}. ${name}`, 15, y)

                doc.setFillColor(0, 135, 81, 0.2)
                doc.roundedRect(80, y - 3, barW, 4, 1, 1, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 135, 81)
                doc.text(`${fmtN(total)} FCFA`, 80 + maxBarW + 5, y)

                y += 6
            })
            y += 4
        }

        // ── Liste détaillée ──
        if (docs.length > 0) {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(0, 135, 81)
            doc.text('DÉTAIL DES OPÉRATIONS', 15, y)
            y += 7

            const detailCols = [25, 22, 55, 35, 28]
            const detailHeaders = ['Date', 'Type', 'Client', 'Montant', 'Statut']

            // Header
            let x = 15
            detailHeaders.forEach((h, ci) => {
                doc.setFillColor(0, 135, 81)
                doc.rect(x, y - 4, detailCols[ci], 6, 'F')
                doc.setTextColor(255)
                doc.setFontSize(6)
                doc.setFont('helvetica', 'bold')
                doc.text(h, x + 2, y)
                x += detailCols[ci]
            })
            y += 6

            const statusLabels: Record<string, string> = {
                paye: 'Payé ',
                accepte: 'Accepté',
                envoye: 'Envoyé',
                brouillon: 'Brouillon',
                refuse: 'Refusé',
                annule: 'Annulé',
            }

            for (const d of docs) {
                // Vérifier si on dépasse la page
                if (y > 270) {
                    doc.addPage()
                    y = 15
                }

                const rowData = [
                    new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                    d.type === 'facture' ? 'FAC' : 'DEV',
                    (d.client_nom || 'N/A').substring(0, 30),
                    `${fmtN(d.total)} ${d.currency || 'XOF'}`,
                    statusLabels[d.status] || d.status,
                ]

                x = 15
                doc.setFontSize(6)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(40)

                // Alternate row bg
                if (docs.indexOf(d) % 2 === 0) {
                    doc.setFillColor(250, 250, 252)
                    doc.rect(15, y - 3.5, detailCols.reduce((a, b) => a + b, 0), 5, 'F')
                }

                rowData.forEach((cell, ci) => {
                    if (ci === 1) {
                        doc.setFont('helvetica', 'bold')
                        doc.setTextColor(d.type === 'facture' ? 0 : 59, d.type === 'facture' ? 135 : 130, d.type === 'facture' ? 81 : 246)
                    } else if (ci === 3) {
                        doc.setFont('helvetica', 'bold')
                        doc.setTextColor(0)
                    } else {
                        doc.setFont('helvetica', 'normal')
                        doc.setTextColor(40)
                    }
                    doc.text(cell, x + 2, y)
                    x += detailCols[ci]
                })
                y += 5
            }
        }

        // ── Footer ──
        const pageCount = doc.getNumberOfPages()
        for (let p = 1; p <= pageCount; p++) {
            doc.setPage(p)
            const pH = doc.internal.pageSize.getHeight()

            // Bande tricolore bas
            doc.setFillColor(0, 135, 81)
            doc.rect(0, pH - 4, w / 3, 4, 'F')
            doc.setFillColor(252, 209, 22)
            doc.rect(w / 3, pH - 4, w / 3, 4, 'F')
            doc.setFillColor(232, 17, 45)
            doc.rect((w / 3) * 2, pH - 4, w / 3, 4, 'F')

            // Footer text
            doc.setFontSize(6)
            doc.setTextColor(150)
            doc.setFont('helvetica', 'normal')
            const footerLine = footerText.split('\n')[0] || 'Retour Gagnant Bénin : Document confidentiel'
            doc.text(footerLine, w / 2, pH - 8, { align: 'center' })
            doc.text(`Page ${p}/${pageCount}`, w - 15, pH - 8, { align: 'right' })
        }

        // ═══ RETOURNER LE PDF ═════════════════════════════════════════
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
        const filename = `rapport-financier-${year}-${String(month).padStart(2, '0')}${agentId ? `-${agentId.slice(0, 8)}` : ''}.pdf`

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache',
            },
        })
    } catch (err) {
        console.error('[Report/Monthly] Error:', err)
        return NextResponse.json({ error: 'Erreur de génération du rapport' }, { status: 500 })
    }
}
