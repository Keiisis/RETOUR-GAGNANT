const fs = require('fs');
const path = require('path');

const files = [
    'app/api/translate/route.ts',
    'app/api/translate/batch/route.ts',
    'app/api/rendez-vous/route.ts',
    'app/api/invoices/[id]/route.ts',
    'app/api/chat/route.ts',
    'app/api/contact/route.ts',
    'app/api/ai/translate-message/route.ts',
    'app/api/ai/admin-help/route.ts',
    'app/api/ai/optimize/route.ts',
    'app/api/oracle/route.ts',
    'app/api/wiki/ask/route.ts',
];

const changes = [];

files.forEach(file => {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) {
        return;
    }

    let content = fs.readFileSync(p, 'utf8');

    if (content.includes('fetchWithGroqRotation')) {
        return;
    }

    let oldContent = content;

    // 1) Inject the import
    if (!content.includes('fetchWithGroqRotation')) {
        content = "import { fetchWithGroqRotation } from '@/lib/groq';\n" + content;
    }

    // 2) Replace in chat/route.ts
    if (file.includes('chat/route.ts')) {
        // It uses dynamic endpoints:
        // const response = await fetch(endpoint, {
        //     method: 'POST',
        //     headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', },
        //     body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, }),
        // })
        content = content.replace(
            /const response = await fetch\(endpoint, \{\s*method:\s*'POST',\s*headers:\s*\{[^}]*\},\s*body:\s*JSON\.stringify\(\{([^]*?)\}\),\s*\}\)/,
            `let response;
    if (endpoint.includes('groq')) {
        response = await fetchWithGroqRotation({$1}, apiKey);
    } else {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' },
            body: JSON.stringify({$1})
        });
    }`
        );
    } else {
        // Standard hardcoded fetch replacement
        // Usually: 
        // const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        //    ... body: JSON.stringify({ ... })
        // })
        content = content.replace(
            /const (\w+)\s*=\s*await fetch\(\s*['"`]https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions['"`],\s*\{[^}]*method:\s*'POST'[^}]*headers:\s*\{(?:[^{}]*|\{[^{}]*\})*\}[^]*?body:\s*JSON\.stringify\(\{([^]*?)\}\)\s*\}\s*\)/g,
            (match, varName, jsonBody) => {
                // determine which API key variable is used in the codebase
                let keyVar = 'groqApiKey';
                if (match.includes('groqApiKey')) keyVar = 'groqApiKey';
                else if (match.includes('process.env.GROQ_API_KEY')) keyVar = 'process.env.GROQ_API_KEY';
                else if (match.includes('apiKey')) keyVar = 'apiKey';

                return `const ${varName} = await fetchWithGroqRotation({${jsonBody}}, String(${keyVar}))`;
            }
        );
    }

    if (content !== oldContent) {
        fs.writeFileSync(p, content);
        changes.push(file);
    }
});

console.log('Modified files:', changes.join(', '));
