const fs = require('fs');

const files = [
    'app/api/translate/route.ts',
    'app/api/rendez-vous/route.ts',
    'app/api/invoices/[id]/route.ts',
    'app/api/contact/route.ts',
    'app/api/ai/translate-message/route.ts',
    'app/api/ai/admin-help/route.ts',
    'app/api/ai/optimize/route.ts',
    'app/api/oracle/route.ts',
    'app/api/wiki/ask/route.ts',
];

for (const f of files) {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');

        // We want to replace standard fetch with groq rotation
        // e.g.:
        // const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        //    method: 'POST',
        //    headers: { ... },
        //    body: JSON.stringify({ model: 'llama...', messages: [ ... ] })
        // })

        // Find the call
        // We basically need to parse out the payload which is inside `body: JSON.stringify(...)`
        // And extract the API key var which usually is `apiKey` or `process.env.GROQ_API_KEY`

        let modified = false;

        content = content.replace(
            /const (\w+)\s*=\s*await fetch\(\s*['"`]https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions['"`],\s*\{[^}]*method:\s*'POST'[^]*?body:\s*JSON\.stringify\(\{([^]*?)\}\)\s*\}\s*\)/g,
            (match, varName, jsonBody) => {
                modified = true;
                let keyVar = 'groqApiKey';
                if (match.includes('${groqApiKey}')) keyVar = 'groqApiKey';
                else if (match.includes('${process.env.GROQ_API_KEY}')) keyVar = 'process.env.GROQ_API_KEY';
                else if (match.includes('${apiKey}')) keyVar = 'apiKey';
                else if (match.includes('process.env.GROQ_API_KEY')) keyVar = 'process.env.GROQ_API_KEY';

                return `const ${varName} = await fetchWithGroqRotation({${jsonBody}}, String(${keyVar}))`;
            }
        );

        if (modified) {
            if (!content.includes('fetchWithGroqRotation')) {
                content = "import { fetchWithGroqRotation } from '@/lib/groq';\n" + content;
            }
            fs.writeFileSync(f, content);
            console.log(`Patched ${f}`);
        } else {
            console.log(`Failed to patch or already patched ${f}`);
        }
    }
}
