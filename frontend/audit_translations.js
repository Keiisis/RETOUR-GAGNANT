const fs = require('fs');
const path = require('path');

const dirsToScan = ['app', 'components', 'lib', 'emails']; // On scanne ces dossiers
const extensions = ['.tsx', '.ts', '.jsx', '.js'];

let results = [];

function scanDirectory(directory) {
    if (!fs.existsSync(directory)) return;
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (extensions.includes(path.extname(fullPath))) {
            analyzeFile(fullPath);
        }
    }
}

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // Skip imports, comments, console.logs
        if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.includes('console.log')) {
            return;
        }

        // 1. Chercher les attributs HTML avec des chaînes en dur (ex: placeholder="Texte", alt="Image")
        const attrRegex = /(placeholder|title|alt|aria-label)="([^"]*[a-zA-Z][^"]*)"/g;
        let match;
        while ((match = attrRegex.exec(line)) !== null) {
            results.push({
                file: filePath.replace(/\\/g, '/'),
                line: lineNum,
                type: 'attribute',
                matched: match[2],
                fullLine: trimmed
            });
        }

        // 2. Chercher du texte JSX pur entre les balises (ex: <div>Texte ici</div>)
        // Regex simplifiée pour trouver >Texte<, ignorant les balises <T>
        const jsxTextRegex = />([^<{}]+)</g;
        while ((match = jsxTextRegex.exec(line)) !== null) {
            const text = match[1].trim();
            // Ignorer le texte vide, les nombres purs, ou la ponctuation isolée
            if (text.length > 1 && /[a-zA-Z]/.test(text)) {
                // S'assurer qu'on n'est pas déjà dans un `<T>` ou `</T>`
                if (!line.includes('<T>') && !line.includes('</T>')) {
                    results.push({
                        file: filePath.replace(/\\/g, '/'),
                        line: lineNum,
                        type: 'jsx-text',
                        matched: text,
                        fullLine: trimmed
                    });
                }
            }
        }

        // 3. Messages d'erreurs d'API (res.status().json({ error: "Texte" }) ou NextResponse.json({ message: "Texte" }))
        const apiErrorRegex = /(error|message|description)\s*:\s*["']([^"']+[a-zA-Z][^"']+)["']/g;
        while ((match = apiErrorRegex.exec(line)) !== null) {
            // Check if it's already using t()
            if (!line.includes('t(')) {
                results.push({
                    file: filePath.replace(/\\/g, '/'),
                    line: lineNum,
                    type: 'api-response-text',
                    matched: match[2],
                    fullLine: trimmed
                });
            }
        }
    });
}

// Lancer le scan
dirsToScan.forEach(scanDirectory);

// Supprimer les doublons et les faux positifs
results = results.filter(r =>
    !r.matched.includes('http') && // Pas d'URL
    !r.matched.includes('text/') && // Pas de mime types
    !r.matched.includes('flex') && // Pas de classes CSS accidentelles
    r.matched.length > 2
);

// Sauvegarder dans un fichier JSON et markdown
fs.writeFileSync('untranslated_audit.json', JSON.stringify(results, null, 2));

const mdContent = `# Audit de Traduction
**Total d'occurrences potentielles non traduites : ${results.length}**

*Ce fichier liste les endroits probables (non exhaustif) où du texte en dur est encore présent dans le code.*

${results.slice(0, 50).map(r => `- **${r.file}:${r.line}** (${r.type}) : \`${r.matched}\``).join('\n')}
${results.length > 50 ? `\n*... et ${results.length - 50} autres occurrences (Voir untranslated_audit.json).*` : ''}
`;

fs.writeFileSync('audit_traduction.md', mdContent);
console.log(`Audit terminé. ${results.length} éléments trouvés. Voir audit_traduction.md`);
