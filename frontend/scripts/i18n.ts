// Outil des traductions statiques.
//   node scripts/i18n.ts audit [dossier…]   textes français visibles non enveloppés dans t() / <T>
//   node scripts/i18n.ts dictionnaires      dictionnaires lib/translation/dict/<lang>.json depuis la table translations
//                                           + liste des textes encore sans traduction (scripts/i18n-manquants.json)
// Clé d'un texte = hashText(extractBrands(texte).maskedText), exactement comme TranslationProvider.
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { extractBrands } from '../lib/translation/brands.ts'
import { hashText } from '../lib/translation/hash.ts'
import { copieDuSource } from '../lib/translation/marques.ts'

const RACINE = path.resolve(import.meta.dirname, '..')
const LANGUES = ['en', 'es', 'pt', 'cr', 'ht'] as const
const DOSSIERS_PUBLICS = ['app', 'components', 'lib']
const EXCLUS = /[\\/](admin|agent|api|node_modules|\.next)[\\/]|[\\/]components[\\/](admin|agent|comptabilite|rapports)[\\/]|\.test\.|\.d\.ts$/

function fichiers(dossiers: string[]): string[] {
  const out: string[] = []
  const marche = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (EXCLUS.test(p + (e.isDirectory() ? path.sep : ''))) continue
      if (e.isDirectory()) marche(p)
      else if (/\.tsx?$/.test(e.name)) out.push(p)
    }
  }
  for (const d of dossiers) marche(path.join(RACINE, d))
  return out
}

const estAppelT = (n: ts.Node) => ts.isCallExpression(n) && (
  (ts.isIdentifier(n.expression) && n.expression.text === 't') ||
  (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 't'))
const tagDe = (n: ts.JsxElement | ts.JsxSelfClosingElement) => (ts.isJsxElement(n) ? n.openingElement.tagName : n.tagName).getText()
function dansTraduction(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (estAppelT(p)) return true
    if (ts.isJsxElement(p) && tagDe(p) === 'T') return true
  }
  return false
}

// Un texte est-il du français affiché (et pas une clé, une classe, une URL, un identifiant) ?
const MOTS = /\b(le|la|les|des|du|de|un|une|et|ou|vos|votre|pour|avec|sur|dans|est|sont|veuillez|aucun|aucune|choisir|ajouter|suivant|précédent|retour|oui|non|nom|prénom|date|pays|ville|adresse|envoyer|valider|continuer|annuler|fermer|enregistrer|télécharger|fichier|pièce|demande|dossier|paiement|frais|mois|jours?|ans|minutes?)\b/i
function francaisAffiche(s: string): boolean {
  const t = s.trim()
  if (t.length < 2 || !/[a-zà-ÿ]/i.test(t)) return false
  if (/^(https?:|\/|#|mailto:|tel:|\.\/|@)/.test(t)) return false
  if (/^[a-z0-9_.:-]+$/.test(t) && !MOTS.test(t)) return false          // clé, classe, slug
  if (/^[\w-]+(\s+[\w:/[\]().%-]+)+$/.test(t) && /(^|\s)(flex|grid|text-|bg-|px-|py-|mt-|mb-|w-|h-|rounded|border|items-|justify-|gap-|font-|hover:|md:|lg:)/.test(t)) return false
  return /[éèêëàâçùûôîïœ]/i.test(t) || MOTS.test(t) || /^[A-ZÉ][a-zà-ÿ]+/.test(t)
}
const ATTRS_VISIBLES = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'description', 'helperText', 'tooltip'])

type Trouvaille = { fichier: string; ligne: number; texte: string; genre: string }
function auditer(fichier: string): Trouvaille[] {
  const src = fs.readFileSync(fichier, 'utf8')
  const sf = ts.createSourceFile(fichier, src, ts.ScriptTarget.Latest, true, fichier.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: Trouvaille[] = []
  const ligne = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const ajoute = (n: ts.Node, texte: string, genre: string) => out.push({ fichier: path.relative(RACINE, fichier), ligne: ligne(n), texte: texte.trim().slice(0, 90), genre })
  const visite = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
    if (ts.isJsxText(n) && /[a-zà-ÿ]{2,}/i.test(n.text) && !dansTraduction(n)) ajoute(n, n.text, 'jsx')
    else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTRS_VISIBLES.has(n.name.getText()) && francaisAffiche(n.initializer.text)) ajoute(n, n.initializer.text, 'attribut')
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !dansTraduction(n) && francaisAffiche(n.text)) {
      const p = n.parent
      const ignore = ts.isJsxAttribute(p) || ts.isImportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isLiteralTypeNode(p) ||
        (ts.isPropertyAssignment(p) && p.name === n) || ts.isElementAccessExpression(p) ||
        (ts.isCallExpression(p) && /^(console\.\w+|require|fetch|\w+\.from|\w+\.eq|\w+\.select|\w+\.order|\w+\.in|\w+\.match|\w+\.includes|\w+\.startsWith|\w+\.endsWith|\w+\.split|\w+\.replace|\w+\.test|new Date|\w+\.get|\w+\.set|\w+\.getItem|\w+\.setItem|\w+\.removeItem)$/.test(p.expression.getText())) ||
        (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText())) || ts.isCaseClause(p)
      if (!ignore) ajoute(n, n.text, 'chaine')
    }
    ts.forEachChild(n, visite)
  }
  visite(sf)
  return out
}

// React décode les entités du texte JSX (&apos; → ') avant t() : la clé doit être calculée sur le texte décodé.
const ENTITES: Record<string, string> = { apos: "'", quot: '"', amp: '&', lt: '<', gt: '>', nbsp: ' ' }
const decoderJsx = (s: string) => s.replace(/&(?:(\w+)|#(\d+)|#x([0-9a-f]+));/gi, (m, nom, dec, hex) => nom ? (ENTITES[nom.toLowerCase()] ?? m) : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)))

// Toutes les chaînes enveloppées : t('…'), t("…"), t(`…`) sans substitution, <T>…</T> littéral.
function sourcesTraduites(fs_: string[]): Set<string> {
  const s = new Set<string>()
  for (const f of fs_) {
    const src = fs.readFileSync(f, 'utf8')
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visite = (n: ts.Node) => {
      if (estAppelT(n)) { const a = (n as ts.CallExpression).arguments[0]; if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && a.text.trim()) s.add(a.text) }
      if (ts.isJsxElement(n) && tagDe(n) === 'T') { const txt = n.children.map(c => ts.isJsxText(c) ? decoderJsx(c.text) : (ts.isJsxExpression(c) && c.expression && ts.isStringLiteral(c.expression) ? c.expression.text : '\u0000')).join(''); if (!txt.includes('\u0000')) { const v = txt.replace(/\s+/g, ' ').trim(); if (v) s.add(v) } }
      ts.forEachChild(n, visite)
    }
    visite(sf)
  }
  return s
}
const cle = (texte: string) => hashText(extractBrands(texte).maskedText)

const identiques: Record<string, string[]> = {}
async function lireTable() {
  const env = Object.fromEntries(fs.readFileSync(path.join(RACINE, '.env.local'), 'utf8').split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const parLangue: Record<string, Record<string, string>> = {}
  for (const l of LANGUES) {
    parLangue[l] = {}
    for (let page = 0; ; page++) {
      const { data, error } = await sb.from('translations').select('source_hash, source_text, translated_text, context').eq('lang', l).range(page * 1000, page * 1000 + 999)
      if (error) throw error
      // une « traduction » qui recopie le français n'en est pas une : on la traite comme absente
      for (const r of data || []) {
        const src = (r.source_text || '').trim(), tr = (r.translated_text || '').trim()
        // lignes d'un ancien hachage (source_hash ≠ clé actuelle) : jamais lues par le site, ignorées
        if (src === tr && /[a-zà-ÿ]{2}/i.test(src) && r.context !== 'dictionnaire' && r.source_hash === cle(r.source_text)) (identiques[l] ||= []).push(r.source_text)   // à revérifier (mot isolé : peut être légitime)
        if (!copieDuSource(src, tr)) parLangue[l][r.source_hash] = r.translated_text
      }
      if (!data || data.length < 1000) break
    }
  }
  return parLangue
}

const mode = process.argv[2]
if (mode === 'audit') {
  const cibles = process.argv.slice(3)
  const liste = cibles.length ? cibles.flatMap(c => fs.statSync(path.join(RACINE, c)).isDirectory() ? fichiers([c]) : [path.join(RACINE, c)]) : fichiers(DOSSIERS_PUBLICS)
  const tout = liste.flatMap(auditer)
  const parFichier = new Map<string, number>(); for (const x of tout) parFichier.set(x.fichier, (parFichier.get(x.fichier) || 0) + 1)
  if (process.argv.includes('--detail') || cibles.length) for (const x of tout) console.log(`${x.fichier}:${x.ligne}  [${x.genre}]  ${x.texte}`)
  else for (const [f, n] of [...parFichier].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f)
  console.log(`TOTAL ${tout.length} textes non enveloppés dans ${parFichier.size} fichiers`)
} else if (mode === 'dictionnaires') {
  const liste = fichiers(DOSSIERS_PUBLICS)
  const sources = sourcesTraduites(liste)
  // Littéraux affichés via t(variable) (listes d'options, menus, catégories) : retenus s'ils ont déjà une traduction en base.
  const litteraux = new Set<string>()
  // --litteraux : sous-ensemble à traduire d'avance (options, libellés d'objets), hors métadonnées SEO
  const affichables = new Set<string>()
  const PROPS = /^(label|libelle|hint|aide|title|titre|subtitle|sousTitre|description|desc|text|texte|name|nom|placeholder|question|answer|reponse|tag|badge|cta|message|info|note|detail|details|etape|step|value)$/
  const seo = (n: ts.Node) => { for (let p = n.parent; p; p = p.parent) if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p)) && /^(metadata|generateMetadata|jsonLd)$/.test(p.name?.getText() ?? '')) return true; return false }
  for (const f of liste) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const v = (n: ts.Node) => {
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && francaisAffiche(n.text)) {
        litteraux.add(ts.isJsxAttribute(n.parent) ? decoderJsx(n.text) : n.text)
        const p = n.parent
        if (((ts.isPropertyAssignment(p) && p.initializer === n && PROPS.test(p.name.getText())) || ts.isArrayLiteralExpression(p)) && !seo(n)) affichables.add(n.text)
      }
      ts.forEachChild(n, v)
    }
    v(sf)
  }
  const table = await lireTable()
  const dossier = path.join(RACINE, 'lib', 'translation', 'dict'); fs.mkdirSync(dossier, { recursive: true })
  const manquants: Record<string, string[]> = {}
  for (const l of LANGUES) {
    const dict: Record<string, string> = {}
    manquants[l] = []
    for (const texte of [...sources].sort()) { const k = cle(texte); if (table[l][k]) dict[k] = table[l][k]; else manquants[l].push(texte) }
    for (const texte of litteraux) { const k = cle(texte); if (!dict[k] && table[l][k]) dict[k] = table[l][k]; else if (!dict[k] && affichables.has(texte) && process.argv.includes('--litteraux')) manquants[l].push(texte) }
    // les traductions faites à la main dans l'admin restent prioritaires au chargement (base > dictionnaire)
    fs.writeFileSync(path.join(dossier, `${l}.json`), JSON.stringify(dict, null, 0) + '\n')
    console.log(`${l} : ${Object.keys(dict).length} entrées · ${manquants[l].length} sans traduction / ${sources.size} textes`)
  }
  fs.writeFileSync(path.join(RACINE, 'scripts', 'i18n-manquants.json'), JSON.stringify(manquants, null, 1))
} else if (mode === 'identiques') {
  // toutes les fausses traductions de la base (français recopié), contenu dynamique compris, à retraduire par `traduire`
  await lireTable()
  fs.writeFileSync(path.join(RACINE, 'scripts', 'i18n-manquants.json'), JSON.stringify(identiques, null, 1))
  for (const l of LANGUES) console.log(`${l} : ${(identiques[l] || []).length} fausses traductions`)
} else if (mode === 'traduire') {
  // Traduit UNE fois, hors ligne, les textes listés dans scripts/i18n-manquants.json (même prompt et même masquage
  // des marques que /api/translate), les enregistre dans la table translations (modifiables dans l'admin),
  // puis relancer `dictionnaires` pour les figer dans les fichiers versionnés.
  const { masquerMarques, demasquerMarques, jetonsIntacts, CONSIGNE_MARQUES } = await import('../lib/translation/marques.ts')
  const env = Object.fromEntries(fs.readFileSync(path.join(RACINE, '.env.local'), 'utf8').split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
  const cles = Object.keys(env).filter(k => /^GROQ_API_KEY(_\d+)?$/.test(k)).map(k => env[k]).filter(Boolean)
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { SUPPORTED_LANGUAGES } = await import('../lib/translation/constants.ts')
  const manquants: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts', 'i18n-manquants.json'), 'utf8'))
  const langues = process.argv.slice(3).length ? process.argv.slice(3) : [...LANGUES]
  let k = 0
  const groq = async (body: object) => {
    for (let essai = 0; essai < cles.length * 3; essai++) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cles[k % cles.length]}` }, body: JSON.stringify(body) })
      if (r.ok) return r.json()
      k++; await new Promise(res => setTimeout(res, r.status === 429 ? 4000 : 1500))
    }
    throw new Error('Groq indisponible')
  }
  const variables = (s: string) => (s.match(/\{[A-Za-z0-9_]+\}/g) || []).sort().join('|')
  for (const l of langues) {
    const cfg = SUPPORTED_LANGUAGES.find(x => x.code === l)!
    const textes = manquants[l] || []
    let faits = 0, rejets = 0
    for (let i = 0; i < textes.length; i += 25) {
      const lot = textes.slice(i, i + 25).map(original => { const m = extractBrands(original).maskedText; const { texte, remplacements } = masquerMarques(m); return { m, masque: texte, remplacements, hash: hashText(m) } })
      const creole = l === 'cr' || l === 'ht'
      const prompt = `Translate the following JSON array of strings from French to ${cfg.groqName}.
CRITICAL RULES:
1. Return ONLY a valid JSON object whose keys are the numbers "0", "1", "2"… of the input array (same order), and whose values are the translations in ${cfg.groqName}.
2. DO NOT add any markdown formatting, explanations, or notes.
3. Preserve shortcodes like {name}, {RG}, {RGB1}, {RGB2} exactly as they are.
4. IMPORTANT: Translate everything to a natural, high-quality ${cfg.groqName} translation for a premium service (website of an agency helping Afro-descendants obtain Beninese nationality and settle in Benin). These are user-interface strings: keep them concise, same register, same punctuation.
4b. ${CONSIGNE_MARQUES}
5. EXTREMELY IMPORTANT: Preserve ANY and ALL HTML tags exactly identical.${cfg.promptHint ? `\n6. LANGUAGE CONTEXT: ${cfg.promptHint}` : ''}${creole ? `\n7. CRITICAL: You MUST translate to ${cfg.groqName}, NOT to English and NOT to French.` : ''}

French strings to translate:
${JSON.stringify(Object.fromEntries(lot.map((x, n) => [String(n), x.masque])))}`
      let parsed: Record<string, string> = {}
      try {
        const d = await groq({ model: 'openai/gpt-oss-120b', temperature: 0.1, max_tokens: 8000, messages: [
          { role: 'system', content: `You are a professional translation API that translates French text to ${cfg.groqName}. You only output valid JSON objects whose keys are the given indexes. Never output arrays, markdown, or explanations. Never return the French text unchanged: every sentence must be genuinely translated (only brand names, proper nouns and codes stay as they are).` },
          { role: 'user', content: prompt }] })
        parsed = JSON.parse(String(d.choices[0].message.content).trim().replace(/^```(json)?/, '').replace(/```$/, '').trim())
      } catch (e) { console.warn(`${l} lot ${i / 25} : ${(e as Error).message}`); rejets += lot.length; continue }
      const lignes = []
      for (const [n, x] of lot.entries()) {
        const brut = parsed[String(n)] ?? parsed[x.masque]
        if (typeof brut !== 'string' || !brut.trim() || !jetonsIntacts(brut, x.remplacements.length) || variables(brut) !== variables(x.masque) || copieDuSource(x.masque, brut)) { rejets++; continue }
        lignes.push({ source_text: x.m, source_hash: x.hash, lang: l, translated_text: demasquerMarques(brut, x.remplacements), context: 'dictionnaire' })
      }
      if (lignes.length) { const { error } = await sb.from('translations').upsert(lignes, { onConflict: 'source_hash,lang' }); if (error) throw error }
      faits += lignes.length
      process.stdout.write(`\r${l} : ${faits} traduits, ${rejets} rejetés / ${textes.length}   `)
    }
    console.log()
  }
} else {
  console.log('usage : node scripts/i18n.ts audit [dossier…] | dictionnaires | traduire [langues…]')
}
