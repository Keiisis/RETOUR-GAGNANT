const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!supabaseUrl || !supabaseKey || !groqApiKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', groqName: 'English' },
    { code: 'es', name: 'Español', groqName: 'Spanish' },
    { code: 'ht', name: 'Kreyòl', groqName: 'Haitian Creole' },
    { code: 'yo', name: 'Yoruba', groqName: 'Yoruba' }
];

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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log('Fetching all source texts...');

    // Get all source texts
    let sourceTexts = [];
    let page = 0;
    while (true) {
        const { data } = await supabase.from('translations')
            .select('source_text')
            .eq('lang', 'fr')
            .range(page * 1000, (page + 1) * 1000 - 1);

        if (!data || data.length === 0) break;
        sourceTexts = sourceTexts.concat(data);
        page++;
    }

    const uniqueSourceTexts = Array.from(new Set(sourceTexts.map(t => t.source_text)));
    console.log(`Found ${uniqueSourceTexts.length} unique source texts to translate.`);

    for (const langConfig of SUPPORTED_LANGUAGES) {
        if (langConfig.code === 'fr') continue;

        console.log(`\nProcessing language: ${langConfig.name}`);

        // Get existing hashes for this language
        let existingTrans = [];
        page = 0;
        while (true) {
            const { data } = await supabase.from('translations')
                .select('source_hash')
                .eq('lang', langConfig.code)
                .range(page * 1000, (page + 1) * 1000 - 1);

            if (!data || data.length === 0) break;
            existingTrans = existingTrans.concat(data);
            page++;
        }

        const existingHashes = new Set(existingTrans.map(t => t.source_hash));
        const missingTexts = uniqueSourceTexts.filter(t => !existingHashes.has(hashText(t)));

        console.log(`Found ${missingTexts.length} missing texts for ${langConfig.name}.`);

        if (missingTexts.length === 0) continue;

        let totalNew = 0;

        // Translate in batches of 20
        for (let i = 0; i < missingTexts.length; i += 20) {
            const batch = missingTexts.slice(i, i + 20);

            const prompt = `Translate the following JSON array of strings from French to ${langConfig.groqName}. 
CRITICAL RULES:
1. Return ONLY a valid JSON array of strings in the exact same order.
2. DO NOT add any markdown formatting or introductory text. Start directly with [.
3. Preserve HTML tags if present. Do not translate class names.
4. Keep names like "Retour Gagnant" in French.
5. EXTREMELY IMPORTANT: Preserve ANY HTML tags.

French array:
${JSON.stringify(batch)}`;

            try {
                const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            { role: 'system', content: 'You are a machine translation API.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.1,
                    })
                });

                if (!aiRes.ok) {
                    console.error('Groq API Error:', aiRes.status, await aiRes.text());
                    console.log('Sleeping for 3 seconds before continuing due to AP error...');
                    await sleep(3000); // 3 seconds penalty
                    continue; // Skip this batch, it will be picked up next run
                }

                const aiData = await aiRes.json();
                let cleanContent = aiData.choices[0].message.content.trim()
                    .replace(/^```json/g, '')
                    .replace(/^```/g, '')
                    .replace(/```$/g, '')
                    .trim();

                let translatedArray;
                try {
                    translatedArray = JSON.parse(cleanContent);
                } catch (e) {
                    console.error('Failed to parse Groq response:', cleanContent.substring(0, 100));
                    continue;
                }

                if (Array.isArray(translatedArray) && translatedArray.length === batch.length) {
                    const inserts = batch.map((text, idx) => ({
                        source_text: text,
                        source_hash: hashText(text),
                        lang: langConfig.code,
                        translated_text: translatedArray[idx],
                        context: 'batch'
                    }));

                    const { error } = await supabase.from('translations').upsert(inserts, { onConflict: 'source_hash,lang' });
                    if (!error) {
                        totalNew += inserts.length;
                        console.log(`+ Translated ${inserts.length} items to ${langConfig.name}`);
                    } else {
                        console.error('Supabase insert error', error);
                    }
                } else {
                    console.error('Length mismatch or invalid array:', translatedArray?.length, batch.length);
                }

            } catch (e) {
                console.error(`Batch translation error for ${langConfig.code}:`, e.message);
            }

            // Wait to avoid rate limits (Groq has 30 RPM -> 1 request per 2 seconds, but we batch 20, so 1 req is fine)
            // Let's pause for 2.5 seconds to be safe
            await sleep(2500);
        }

        console.log(`Finished ${langConfig.name}. Generated ${totalNew} translations.`);
    }
    console.log('All done!');
}

run();
