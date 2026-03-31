const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/layout/AudioPlayer.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import \{ useEffect, useRef, useState, useCallback \} from 'react';/,
        `import { useEffect, useRef, useState, useCallback } from 'react';\nimport { useTranslation } from '@/lib/translation';`
    );
    content = content.replace(
        /export default function AudioPlayer\(\) \{/,
        `export default function AudioPlayer() {\n    const { t } = useTranslation();`
    );
}

const replacements = [
    ['aria-label={isMuted ? "Activer le son" : "Couper le son"}', 'aria-label={isMuted ? t("Activer le son") : t("Couper le son")}'],
    ['title={isMuted ? "🔊 Activer l\'ambiance sonore" : "🔇 Couper le son"}', 'title={isMuted ? `🔊 ${t("Activer l\'ambiance sonore")}` : `🔇 ${t("Couper le son")}` }']
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in AudioPlayer.tsx');
