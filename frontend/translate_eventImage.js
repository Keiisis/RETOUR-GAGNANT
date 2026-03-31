const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/events/EventImageUpload.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import \{ Upload, X, ImageIcon, Loader2, Link as LinkIcon \} from 'lucide-react'/,
        `import { Upload, X, ImageIcon, Loader2, Link as LinkIcon } from 'lucide-react'\nimport { useTranslation, T } from '@/lib/translation'`
    );
    content = content.replace(
        /export default function EventImageUpload\(\{/,
        `export default function EventImageUpload({`
    );
    content = content.replace(
        /}: EventImageUploadProps\) \{/,
        `}: EventImageUploadProps) {\n    const { t } = useTranslation();`
    );
}

const replacements = [
    ["'Échec upload'", "t('Échec upload')"],
    ["'Erreur upload'", "t('Erreur upload')"],
    ["'Fichier image requis (JPG, PNG, WebP)'", "t('Fichier image requis (JPG, PNG, WebP)')"],
    ["'Image trop lourde (max 8 MB)'", "t('Image trop lourde (max 8 MB)')"],
    ["{showUrl ? 'Masquer URL' : 'Coller une URL'}", "{showUrl ? t('Masquer URL') : t('Coller une URL')}"],
    ["placeholder=\"https://...\"", "placeholder={t('https://...')}"]
];

for (const [search, replace] of replacements) {
    if (content.includes(search)) {
        content = content.split(search).join(replace);
    }
}

// Complex replacements using Regex or split
content = content.replace(/>\s*Remplacer\s*<\/button>/g, `> <T>Remplacer</T> </button>`);
content = content.replace(/>Envoi en cours\.\.\.</g, `><T>Envoi en cours...</T><`);
content = content.replace(/Glisser-déposer ou\{' '\}/g, `<T>Glisser-déposer ou</T>{' '}`);
content = content.replace(/>\s*parcourir\s*<\/span>/g, `><T>parcourir</T></span>`);
content = content.replace(/>JPG, PNG, WebP — max 8 MB</g, `><T>JPG, PNG, WebP — max 8 MB</T><`);
content = content.replace(/{uploading \? 'Envoi\.\.\.' : 'Choisir depuis l\\'appareil'}/, `{uploading ? t('Envoi...') : t('Choisir depuis l\\'appareil')}`);

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in EventImageUpload.tsx');
