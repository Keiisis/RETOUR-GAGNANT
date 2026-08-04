import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)
const BUCKET = 'nationality_documents'

// Reconstitue la vraie extension d'un fichier à partir de ses octets magiques.
async function sniffExt(buf: ArrayBuffer): Promise<string | null> {
    const head = new Uint8Array(buf).subarray(0, 8)
    const hex = Array.from(head.subarray(0, 4)).map(x => x.toString(16).padStart(2, '0')).join('')
    if (hex.startsWith('25504446')) return 'pdf'
    if (hex.startsWith('89504e47')) return 'png'
    if (hex.startsWith('ffd8ff')) return 'jpg'
    if (hex.startsWith('474946')) return 'gif'
    if (hex.startsWith('d0cf11e0')) return 'xls'
    if (hex.startsWith('504b0304')) {
        try {
            const z = await JSZip.loadAsync(buf)
            const names = Object.keys(z.files)
            if (names.some(n => n.startsWith('xl/'))) return 'xlsx'
            if (names.some(n => n.startsWith('word/'))) return 'docx'
            if (names.some(n => n.startsWith('ppt/'))) return 'pptx'
            return 'zip'
        } catch { return 'zip' }
    }
    return null
}

const typeOf = (ext: string) =>
    ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? 'image'
        : ext === 'pdf' ? 'pdf'
            : ['xls', 'xlsx', 'csv', 'ods'].includes(ext) ? 'sheet'
                : ['doc', 'docx', 'odt', 'rtf'].includes(ext) ? 'word'
                    : 'file'

function parseLine(line: string): { label: string; path: string } | null {
    const idx = line.indexOf(': ')
    if (idx === -1) return null
    const raw = line.slice(0, idx).trim()
    const label = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw
    const path = line.slice(idx + 2).trim()
    if (!path.startsWith('nat-')) return null
    return { label, path }
}

// GET — liste les pièces + RÉPARE les « .bin » (rename storage + DB) et renvoie
// des URLs signées. Utilisé par le gestionnaire de fichiers de l'édition.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!
    const { id } = await params

    const { data: app } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded')
        .eq('id', id).maybeSingle()
    if (!app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const lines = Array.isArray(app.documents_uploaded) ? [...(app.documents_uploaded as string[])] : []
    let mutated = false

    const docs: Array<{ index: number; label: string; path: string; ext: string; type: string; url: string | null }> = []
    for (let i = 0; i < lines.length; i++) {
        const p = parseLine(lines[i])
        if (!p) continue
        let path = p.path
        let ext = (path.split('.').pop() || '').toLowerCase()

        // Réparation « .bin » : on télécharge, on sniff, on renomme.
        if (ext === 'bin') {
            try {
                const { data: file } = await supabase.storage.from(BUCKET).download(path)
                if (file) {
                    const sniffed = await sniffExt(await file.arrayBuffer())
                    if (sniffed && sniffed !== 'bin') {
                        const newPath = path.replace(/\.bin$/i, '.' + sniffed)
                        const { error: mvErr } = await supabase.storage.from(BUCKET).move(path, newPath)
                        if (!mvErr) {
                            lines[i] = lines[i].replace(path, newPath)
                            path = newPath; ext = sniffed; mutated = true
                        }
                    }
                }
            } catch { /* on garde .bin si la réparation échoue */ }
        }

        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
        docs.push({ index: i, label: p.label, path, ext, type: typeOf(ext), url: signed?.signedUrl || null })
    }

    if (mutated) {
        await supabase.from('nationality_applications').update({ documents_uploaded: lines }).eq('id', id)
    }

    return NextResponse.json({ documents: docs })
}

// PATCH — remplace le FICHIER d'une pièce en conservant son libellé + sa
// position ; { oldPath, newPath }. L'ancien fichier storage est supprimé.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const oldPath = String(body.oldPath || '')
    const newPath = String(body.newPath || '')
    if (!oldPath.startsWith('nat-') || !newPath.startsWith('nat-')) {
        return NextResponse.json({ error: 'Chemins invalides' }, { status: 400 })
    }

    const { data: app } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded')
        .eq('id', id).maybeSingle()
    if (!app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const lines = Array.isArray(app.documents_uploaded) ? (app.documents_uploaded as string[]) : []
    let replaced = false
    const updated = lines.map(l => {
        if (l.includes(oldPath)) { replaced = true; return l.replace(oldPath, newPath) }
        return l
    })
    if (!replaced) return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 })

    await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {})
    await supabase.from('nationality_applications').update({ documents_uploaded: updated }).eq('id', id)
    return NextResponse.json({ success: true })
}

// DELETE ?path=… — retire une pièce (storage + ligne DB).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!
    const { id } = await params
    const path = request.nextUrl.searchParams.get('path') || ''
    if (!path.startsWith('nat-')) return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 })

    const { data: app } = await supabase
        .from('nationality_applications')
        .select('documents_uploaded')
        .eq('id', id).maybeSingle()
    if (!app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const lines = Array.isArray(app.documents_uploaded) ? (app.documents_uploaded as string[]) : []
    const kept = lines.filter(l => !l.includes(path))
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    await supabase.from('nationality_applications').update({ documents_uploaded: kept }).eq('id', id)

    return NextResponse.json({ success: true, removed: lines.length - kept.length })
}
