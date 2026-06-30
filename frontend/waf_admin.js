/**
 * Script de diagnostic et déblocage WAF pour Retour Gagnant
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Charger .env.local du frontend
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Erreur: Les variables d'environnement Supabase ne sont pas chargées.");
    console.log("Veuillez vérifier que le fichier .env.local existe et contient NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function listBlockedIps() {
    console.log("\n--- CONFIG WAF (waf_config) ---");
    const { data: configRows, error: configErr } = await supabase
        .from('waf_config')
        .select('*');

    if (configErr) {
        console.error("Erreur lors de la récupération de la config WAF:", configErr);
    } else {
        const configMap = Object.fromEntries(configRows.map(r => [r.key, r.value]));
        console.log(`- Activé : ${configMap['enabled'] !== 'false' ? '\x1b[32mOui\x1b[0m' : '\x1b[31mNon\x1b[0m'}`);
        console.log(`- Niveau de paranoïa : ${configMap['paranoia_level'] || '1'}`);
        console.log(`- IPs sur liste blanche : \x1b[36m${configMap['whitelisted_ips'] || '[]'}\x1b[0m`);
        console.log(`- Pays bloqués : ${configMap['blocked_countries'] || '[]'}`);
    }

    console.log("\n--- IPs BLOQUÉES (ip_blocks activement bloquées) ---");
    const { data: blocks, error: err1 } = await supabase
        .from('ip_blocks')
        .select('*')
        .is('unblocked_at', null)
        .order('blocked_at', { ascending: false });

    if (err1) {
        console.error("Erreur lors de la récupération des ip_blocks:", err1);
        return;
    }

    if (!blocks || blocks.length === 0) {
        console.log("Aucune IP n'est actuellement bloquée dans ip_blocks.");
    } else {
        blocks.forEach(b => {
            console.log(`- IP: \x1b[31m${b.ip}\x1b[0m | Raison: ${b.reason} | Bloqué le: ${b.blocked_at} | Violations: ${b.violation_count}`);
        });
    }

    console.log("\n--- PROFILS SUSPECTS (waf_ip_memory - trust_score < 15) ---");
    const { data: memory, error: err2 } = await supabase
        .from('waf_ip_memory')
        .select('*')
        .lt('trust_score', 15)
        .order('trust_score', { ascending: true });

    if (err2) {
        console.error("Erreur lors de la récupération de la mémoire IP:", err2);
        return;
    }

    if (!memory || memory.length === 0) {
        console.log("Aucun profil suspect dans la mémoire.");
    } else {
        memory.forEach(m => {
            console.log(`- IP: \x1b[33m${m.ip}\x1b[0m | Trust Score: \x1b[31m${m.trust_score}\x1b[0m/100 | Bloqué count: ${m.blocked_count} | Attaques: ${m.attack_types ? m.attack_types.join(', ') : 'Aucune'}`);
        });
    }

    console.log("\n--- DERNIERS LOGS WAF (waf_logs) ---");
    const { data: logs, error: err3 } = await supabase
        .from('waf_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (err3) {
        console.error("Erreur lors de la récupération des logs WAF:", err3);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log("Aucun log WAF récent.");
    } else {
        logs.forEach(l => {
            console.log(`- [${l.created_at}] IP: ${l.ip} | Path: ${l.path} | Type: \x1b[35m${l.threat_type}\x1b[0m | Score: ${l.score} | Détail: ${l.threat_detail}`);
        });
    }
}

async function unblockIp(ip) {
    console.log(`\nTentative de déblocage de l'IP: \x1b[36m${ip}\x1b[0m...`);

    // 1. Débloquer dans ip_blocks (mettre unblocked_at à now)
    const { data: blockUpdate, error: blockErr } = await supabase
        .from('ip_blocks')
        .update({ unblocked_at: new Date().toISOString(), reason: 'Débloqué manuellement par script administrateur' })
        .eq('ip', ip)
        .is('unblocked_at', null);

    if (blockErr) {
        console.error("Erreur lors du déblocage dans ip_blocks:", blockErr);
    } else {
        console.log("✅ IP débloquée dans la table `ip_blocks` (unblocked_at mis à jour).");
    }

    // 2. Réinitialiser la mémoire waf_ip_memory (mettre trust_score à 100)
    const { data: memUpdate, error: memErr } = await supabase
        .from('waf_ip_memory')
        .update({ trust_score: 100, blocked_count: 0 })
        .eq('ip', ip);

    if (memErr) {
        console.error("Erreur lors de la réinitialisation de la mémoire WAF:", memErr);
    } else {
        console.log("✅ Score de confiance (trust_score) réinitialisé à 100 dans `waf_ip_memory`.");
    }

    console.log(`\n\x1b[32mL'IP ${ip} a été débloquée avec succès dans Supabase !\x1b[0m`);
}

async function whitelistIp(ip) {
    console.log(`\nTentative de mise sur liste blanche de l'IP: \x1b[36m${ip}\x1b[0m...`);
    
    // Débloquer d'abord l'IP au cas où
    await unblockIp(ip);

    // Récupérer la config actuelle
    const { data: configRows, error: configErr } = await supabase
        .from('waf_config')
        .select('*')
        .eq('key', 'whitelisted_ips')
        .maybeSingle();

    if (configErr) {
        console.error("Erreur lors de la récupération des IPs sur liste blanche:", configErr);
        return;
    }

    let whitelisted = [];
    let exists = false;
    if (configRows) {
        exists = true;
        if (configRows.value) {
            try {
                whitelisted = JSON.parse(configRows.value);
            } catch (e) {
                console.error("Erreur de parsing du JSON des IPs sur liste blanche:", e);
            }
        }
    }

    if (!whitelisted.includes(ip)) {
        whitelisted.push(ip);
        
        let updateErr;
        if (exists) {
            // Faire un update
            const { error } = await supabase
                .from('waf_config')
                .update({ value: JSON.stringify(whitelisted) })
                .eq('key', 'whitelisted_ips');
            updateErr = error;
        } else {
            // Faire un insert
            const { error } = await supabase
                .from('waf_config')
                .insert({ key: 'whitelisted_ips', value: JSON.stringify(whitelisted) });
            updateErr = error;
        }

        if (updateErr) {
            console.error("Erreur lors de la mise à jour de la liste blanche:", updateErr);
        } else {
            console.log(`✅ L'IP \x1b[32m${ip}\x1b[0m a été ajoutée à la liste blanche (whitelisted_ips) avec succès !`);
        }
    } else {
        console.log(`ℹ️ L'IP \x1b[33m${ip}\x1b[0m est déjà dans la liste blanche.`);
    }
}

const args = process.argv.slice(2);
if (args[0] === 'unblock') {
    if (!args[1]) {
        console.error("Erreur: Veuillez spécifier l'IP à débloquer. Exemple: node waf_admin.js unblock 127.0.0.1");
        process.exit(1);
    }
    unblockIp(args[1]);
} else if (args[0] === 'whitelist') {
    if (!args[1]) {
        console.error("Erreur: Veuillez spécifier l'IP à mettre sur liste blanche. Exemple: node waf_admin.js whitelist 127.0.0.1");
        process.exit(1);
    }
    whitelistIp(args[1]);
} else {
    listBlockedIps();
}
