import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { verifyApiAuth } from '@/lib/api-auth'
import { getCategory, getStatus, daysSince } from '@/lib/classement/categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ══════════════════════════════════════════════════════════════
// GET /api/agent/classement/export → bilan Excel (.xlsx) du classement
// ══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data } = await supabase
        .from('client_classement')
        .select('*')
        .order('service_category', { ascending: true })
        .order('first_contact_at', { ascending: true })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Retour Gagnant Bénin'
    wb.created = new Date()
    const ws = wb.addWorksheet('Classement Client', {
        views: [{ state: 'frozen', ySplit: 1 }],
    })

    ws.columns = [
        { header: 'Catégorie', key: 'cat', width: 26 },
        { header: 'Nom', key: 'name', width: 26 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Téléphone', key: 'phone', width: 18 },
        { header: 'Statut', key: 'status', width: 18 },
        { header: 'Ancienneté (jours)', key: 'days', width: 16 },
        { header: 'Premier contact', key: 'first', width: 16 },
        { header: 'Source', key: 'source', width: 14 },
        { header: 'Notes', key: 'notes', width: 50 },
    ]

    // En-tête stylé (vert RGB)
    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    head.alignment = { vertical: 'middle' }
    head.height = 22
    head.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
    })

    for (const c of data || []) {
        const days = daysSince(c.first_contact_at)
        ws.addRow({
            cat: getCategory(c.service_category).label,
            name: c.full_name || '',
            email: c.email,
            phone: c.phone || '',
            status: getStatus(c.status).label,
            days,
            first: c.first_contact_at ? new Date(c.first_contact_at).toLocaleDateString('fr-FR') : '',
            source: c.source || '',
            notes: c.notes || '',
        })
    }

    ws.eachRow({ includeEmpty: false }, (row, n) => {
        row.alignment = { vertical: 'top', wrapText: true }
        if (n > 1 && n % 2 === 0) {
            row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAF9' } } })
        }
    })

    const buf = await wb.xlsx.writeBuffer()
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Blob([buf]), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="classement-client-${stamp}.xlsx"`,
            'Cache-Control': 'no-store',
        },
    })
}
