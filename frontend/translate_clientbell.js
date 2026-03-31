const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/layout/ClientBell.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import Link from 'next\/link'/,
        `import Link from 'next/link'\nimport { useTranslation, T } from '@/lib/translation'`
    );
    content = content.replace(
        /export default function ClientBell\(\) \{/,
        `export default function ClientBell() {\n    const { t } = useTranslation();`
    );
}

const replacements = [
    ['>Notifications<', '><T>Notifications</T><'],
    ['>Tout marquer comme lu<', '><T>Tout marquer comme lu</T><'],
    ['>Aucune notification<', '><T>Aucune notification</T><'],
    ['>Mon Espace <', '><T>Mon Espace</T> <']
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in ClientBell.tsx');
