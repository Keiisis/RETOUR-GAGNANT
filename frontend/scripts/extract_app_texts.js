const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function hashText(text) {
    if (!text) return '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

const texts = new Set();
function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
            scan(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');

            // match <T>text</T>
            const tRegex = /<T>([^<]+)<\/T>/g;
            let m;
            while ((m = tRegex.exec(content)) !== null) {
                if (m[1].trim()) texts.add(m[1].trim());
            }

            // match t('text') or t("text")
            const tFuncRegex = /t\((["'])(.*?)\1\)/g;
            while ((m = tFuncRegex.exec(content)) !== null) {
                if (m[2].trim()) texts.add(m[2].trim());
            }
        }
    }
}

scan('app');
scan('components');

const textsArray = Array.from(texts);
console.log('Found ' + textsArray.length + ' extracted texts');

async function upload() {
    const toInsert = textsArray.map(t => ({
        source_hash: hashText(t),
        source_text: t,
        lang: 'fr', // We will insert them as source language French so they get translated 
        translated_text: t,
        context: 'extractor'
    }));

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from('translations')
            .upsert(batch, { onConflict: 'source_hash,lang', ignoreDuplicates: true });

        if (error) {
            console.error('Error on batch', error);
        } else {
            inserted += batch.length;
        }
    }
    console.log('Done inserting ' + inserted + ' source texts.');
}

upload().catch(console.error);
