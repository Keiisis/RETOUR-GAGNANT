import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { RGPD_DOCS } from '@/lib/rgpd/content'
import { generateRgpdPdf } from '@/lib/rgpd/pdf'
import { generateRgpdDocx } from '@/lib/rgpd/docx'

// ══════════════════════════════════════════════════════════════
// GET /api/admin/rgpd/document?doc=registre|procedure|politique&format=pdf|docx
// Génère et renvoie le document RGPD (template RGB). Réservé admin + agent.
// ══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    // 'agent' autorise aussi les admins (cf. verifyApiAuth)
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const url = new URL(request.url)
    const docId = (url.searchParams.get('doc') || '').toLowerCase()
    const format = (url.searchParams.get('format') || 'pdf').toLowerCase()

    const doc = RGPD_DOCS[docId]
    if (!doc) return NextResponse.json({ error: 'Document inconnu' }, { status: 404 })

    const safeName = doc.id

    try {
        if (format === 'docx') {
            const buf = await generateRgpdDocx(doc)
            return new NextResponse(new Blob([new Uint8Array(buf)]), {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="rgb-${safeName}.docx"`,
                    'Cache-Control': 'no-store',
                },
            })
        }
        const bytes = await generateRgpdPdf(doc)
        return new NextResponse(bytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="rgb-${safeName}.pdf"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        console.error('[RGPD document]', err)
        return NextResponse.json({ error: 'Génération impossible' }, { status: 500 })
    }
}
