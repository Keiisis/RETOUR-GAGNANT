const fs = require('fs');
const path = require('path');

const auditData = JSON.parse(fs.readFileSync('untranslated_audit.json', 'utf8'));

// Group by file
const filesMap = {};
auditData.forEach(item => {
    // Only target React components for automatic replacements
    if (item.file.includes('components/') || item.file.includes('app/(routes)/') || item.file.includes('app/admin/')) {
        if (!filesMap[item.file]) filesMap[item.file] = [];
        filesMap[item.file].push(item);
    }
});

let modifiedFiles = 0;

for (const [file, items] of Object.entries(filesMap)) {
    if (!fs.existsSync(file)) continue;

    let content = fs.readFileSync(file, 'utf8');
    let needsImport = false;
    let needsHook = false;

    // Sort items by line descending so replacements don't change previous line numbers
    items.sort((a, b) => b.line - a.line);

    let lines = content.split('\n');

    for (const item of items) {
        const lineIdx = item.line - 1;
        let line = lines[lineIdx];

        if (item.type === 'jsx-text') {
            // Remplacer >Text< par ><T>Text</T><
            const regex = new RegExp(`>(\\s*)${escapeRegex(item.matched)}(\\s*)<`, 'g');
            const newLine = line.replace(regex, `>$1<T>${item.matched}</T>$2<`);
            if (line !== newLine) {
                lines[lineIdx] = newLine;
                needsImport = true;
            }
        } else if (item.type === 'attribute') {
            // Remplacer attr="Text" par attr={t("Text")}
            const regex = new RegExp(`(placeholder|title|alt|aria-label)="([^"]*${escapeRegex(item.matched)}[^"]*)"`, 'g');
            const newLine = line.replace(regex, `$1={t("$2")}`);
            if (line !== newLine) {
                lines[lineIdx] = newLine;
                needsImport = true;
                needsHook = true;
            }
        }
    }

    content = lines.join('\n');

    // Add Imports if changed
    if (needsImport) {
        if (!content.includes('import { useTranslation')) {
            // Add to top after 'use client'
            if (content.match(/^['"]use client['"];?/m)) {
                content = content.replace(/^(['"]use client['"];?\s*\n)/m, `$1import { useTranslation, T } from '@/lib/translation';\n`);
            } else {
                content = `import { useTranslation, T } from '@/lib/translation';\n` + content;
            }
        } else if (!content.includes('T }')) {
            content = content.replace(/import \{ useTranslation \} from/g, `import { useTranslation, T } from`);
        }

        // Add Hook if placeholder or attribute needed `t`
        if (needsHook) {
            // Cherche le début du composant exporté
            const componentFunctionRegex = /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*{/g;
            if (!content.includes('const { t } = useTranslation()') && !content.includes('const {t} = useTranslation()')) {
                content = content.replace(componentFunctionRegex, match => `${match}\n    const { t } = useTranslation();`);
            }
        }

        fs.writeFileSync(file, content);
        modifiedFiles++;
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`🚀 Transformation automatique terminée. ${modifiedFiles} fichiers front end mis à jour avec <T> et t() !`);
