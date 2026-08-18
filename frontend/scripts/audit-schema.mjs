/* Cartographie STRICTE de l'écart code ↔ base.
   La fenêtre d'analyse s'arrête au prochain .from( : sans cela l'outil
   attribuait à une table les colonnes de la requête suivante. */
import fs from 'fs'
import path from 'path'

const reel = JSON.parse(fs.readFileSync(new URL('./schema-reel.json', import.meta.url), 'utf8'))
const RACINES = ['app', 'lib', 'components', '../mobile/src']  // exécuter depuis frontend/

function fichiers(dir, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) fichiers(p, out) }
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
    }
    return out
}

const parTable = new Map()
const tablesAbsentes = new Map()
const ajouter = (map, k, v) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v) }

for (const racine of RACINES) {
    for (const f of fichiers(racine)) {
        const src = fs.readFileSync(f, 'utf8')
        const rel = path.relative('.', f).replace(/\\/g, '/')

        // On ignore `storage.from('bucket')` : un bucket de stockage n'est
        // PAS une table. Les confondre faisait passer des buckets
        // (nationality_documents, avatars…) pour des tables manquantes.
        const positions = [...src.matchAll(/\.from\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g)]
            .filter(m => !/storage\s*$/.test(src.slice(Math.max(0, m.index - 120), m.index).replace(/\s+/g, ' ').trimEnd() + ' ') && !/storage[\s\S]{0,40}$/.test(src.slice(Math.max(0, m.index - 120), m.index)))
        for (let i = 0; i < positions.length; i++) {
            const m = positions[i]
            const table = m[1]
            const debut = m.index + m[0].length
            // Fenêtre bornée au prochain .from( : plus de débordement.
            const fin = i + 1 < positions.length ? positions[i + 1].index : Math.min(src.length, debut + 700)
            const suite = src.slice(debut, fin)

            const cols = reel[table]
            if (!cols) { ajouter(tablesAbsentes, table, rel); continue }

            const signaler = (col, quoi) => {
                if (!cols.includes(col)) ajouter(parTable, table, `${col}  [${quoi}]  ${rel}`)
            }

            // .select('...') — hors relations imbriquées
            const sel = suite.match(/\.select\(\s*[`'"]([\s\S]*?)[`'"]\s*[,)]/)
            if (sel) {
                const sansRelations = sel[1].replace(/[a-z0-9_]+\s*\([^)]*\)/g, '')
                for (let c of sansRelations.split(',')) {
                    c = c.trim()
                    if (!c || c === '*') continue
                    if (c.includes(':')) c = c.split(':')[1].trim()   // alias -> colonne réelle
                    if (!/^[a-z0-9_]+$/i.test(c)) continue
                    signaler(c, 'select')
                }
            }

            // filtres
            for (const fm of suite.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|in|like|ilike|is)\(\s*['"]([a-z0-9_]+)['"]/g)) {
                signaler(fm[1], 'filtre')
            }
            // .order('colonne')
            for (const om of suite.matchAll(/\.order\(\s*['"]([a-z0-9_]+)['"]/g)) signaler(om[1], 'order')

            // .insert({ ... }) / .update({ ... }) : clés littérales
            for (const im of suite.matchAll(/\.(insert|update|upsert)\(\s*\{([\s\S]*?)\}\s*[,)]/g)) {
                for (const km of im[2].matchAll(/(?:^|[\s,{])([a-z][a-z0-9_]*)\s*:/g)) {
                    signaler(km[1], im[1])
                }
            }
        }
    }
}

let total = 0
console.log('══ COLONNES DEMANDÉES PAR LE CODE, ABSENTES DE LA BASE ══\n')
for (const [table, set] of [...parTable].sort()) {
    console.log(`▸ ${table}  (${set.size})`)
    for (const c of [...set].sort()) { console.log('    ' + c); total++ }
}
console.log(`\nTOTAL : ${total} occurrences sur ${parTable.size} tables`)

console.log('\n══ TABLES RÉFÉRENCÉES MAIS NON EXPOSÉES PAR L API ══')
for (const [t, set] of [...tablesAbsentes].sort()) {
    console.log(`  ${t}  →  ${[...set].join(', ')}`)
}
