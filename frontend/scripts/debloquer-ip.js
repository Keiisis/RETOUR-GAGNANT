/* ═══════════════════════════════════════════════════════════════
   DÉBLOQUER UNE ADRESSE IP RETENUE À TORT PAR LE WAF

   Le WAF inscrit un blocage dans `ip_blocks` SANS date d'expiration
   (`expires_at` reste nul). Un blocage est donc DÉFINITIF tant que personne
   ne le lève à la main — même si la réputation de l'adresse est remontée à
   100 entre-temps, car `ip_blocks` n'est jamais réévalué.

   C'est ainsi que l'adresse de l'agence s'est retrouvée bannie du site le
   2026-08-20 : elle était en liste blanche superadmin la veille, puis un
   appel en ligne de commande (User-Agent de librairie HTTP, règle R913110)
   l'a fait passer pour un scanner.

   Utilisation :
       node scripts/debloquer-ip.js 41.x.y.z            → débloque
       node scripts/debloquer-ip.js 41.x.y.z --confiance → débloque ET
                                                            met en confiance 7 jours
       node scripts/debloquer-ip.js --liste              → montre les blocages actifs

   À lancer depuis `frontend/` : la clé de service est lue dans .env.local.
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs')
const path = require('path')

const env = Object.fromEntries(
    fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
        .split(/\r?\n/)
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL
const CLE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !CLE) {
    console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de .env.local')
    process.exit(1)
}

const entetes = (extra = {}) => ({
    apikey: CLE, Authorization: `Bearer ${CLE}`,
    'Content-Type': 'application/json', ...extra,
})

async function appeler(chemin, init = {}) {
    const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, { ...init, headers: entetes(init.headers) })
    const texte = await r.text()
    if (!r.ok) throw new Error(`${r.status} ${texte.slice(0, 300)}`)
    return texte ? JSON.parse(texte) : null
}

async function lister() {
    const lignes = await appeler(
        'ip_blocks?select=ip,reason,violation_count,blocked_at&unblocked_at=is.null&order=blocked_at.desc&limit=100',
    )
    console.log(`${lignes.length} blocage(s) actif(s) :\n`)
    for (const l of lignes) {
        console.log(`  ${String(l.ip).padEnd(20)} ${l.blocked_at.slice(0, 16)}  ${String(l.reason).slice(0, 70)}`)
    }
}

async function debloquer(ip, mettreEnConfiance) {
    const bloques = await appeler(`ip_blocks?ip=eq.${encodeURIComponent(ip)}&select=id,reason,blocked_at,unblocked_at`)
    if (!bloques.length) {
        console.log(`Aucun blocage enregistré pour ${ip}.`)
    } else {
        for (const b of bloques) {
            console.log(`  blocage du ${b.blocked_at.slice(0, 16)} — ${String(b.reason).slice(0, 70)}` +
                (b.unblocked_at ? ' (déjà levé)' : ''))
        }
        await appeler(`ip_blocks?ip=eq.${encodeURIComponent(ip)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ unblocked_at: new Date().toISOString() }),
        })
        console.log(`  → blocage(s) levé(s).`)
    }

    /* La réputation aussi : sans cela, le RPC Sentinel peut re-bloquer
       l'adresse dès la requête suivante. */
    await appeler(`waf_ip_memory?ip=eq.${encodeURIComponent(ip)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            trust_score: 100, blocked_count: 0, attack_types: [],
            tarpit_level: 0, threat_score: 0, last_action: 'allow',
        }),
    }).catch(() => console.log('  (pas de mémoire IP à remettre à zéro)'))
    console.log('  → réputation remise à 100.')

    if (mettreEnConfiance) {
        /* La table `waf_trusted_ips` exige un `user_id` : une adresse de
           confiance appartient toujours à quelqu'un du personnel, et le nombre
           d'adresses par personne est plafonné. On passe donc par la fonction
           prévue, `enregistrer_ip_de_confiance`, avec un compte interne.

           Sans identifiant fourni, on prend le premier compte administrateur
           trouvé — c'est lui qui « porte » l'exemption et pourra la retirer. */
        const admins = await appeler('user_profiles?select=id,role,email&role=in.(admin,superadmin)&limit=1')
        if (!admins || !admins.length) {
            console.log('  ! aucun compte administrateur trouvé : mise en confiance ignorée.')
            return
        }
        const r = await fetch(`${URL_BASE}/rest/v1/rpc/enregistrer_ip_de_confiance`, {
            method: 'POST',
            headers: entetes(),
            body: JSON.stringify({
                p_ip: ip, p_user_id: admins[0].id, p_role: admins[0].role,
                p_user_agent: 'scripts/debloquer-ip.js',
            }),
        })
        const actives = await r.json().catch(() => null)
        if (!r.ok || actives === -1) {
            console.log(`  ! mise en confiance refusée (adresse privée, réservée ou invalide).`)
        } else {
            console.log(`  → mise en confiance enregistrée sous ${admins[0].email} (${actives} adresse(s) active(s)).`)
        }
    }
}

;(async () => {
    const args = process.argv.slice(2)
    if (!args.length || args[0] === '--liste') return lister()

    const ip = args[0]
    if (!/^[0-9a-fA-F.:]+$/.test(ip)) {
        console.error(`« ${ip} » ne ressemble pas à une adresse IP.`)
        process.exit(1)
    }
    console.log(`Déblocage de ${ip} :`)
    await debloquer(ip, args.includes('--confiance'))
    console.log('Terminé.')
})().catch(e => { console.error('Échec :', e.message); process.exit(1) })
