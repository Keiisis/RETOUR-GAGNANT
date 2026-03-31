const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/PhotoDiaporama.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import Image from 'next\/image';/,
        `import Image from 'next/image';\nimport { useTranslation, T } from '@/lib/translation';`
    );
    // Add t to ScrolledDiaporama
    content = content.replace(
        /function ScrolledDiaporama\(\{[^}]+\} : \{[^}]+\}\) \{/,
        (match) => `${match}\n    const { t } = useTranslation();`
    );
    // Add t to DreamCard
    content = content.replace(
        /function DreamCard\(\{[^}]+\} : \{[^}]+\}\) \{/,
        (match) => `${match}\n    const { t } = useTranslation();`
    );
    // Add t to PhotoDiaporama
    content = content.replace(
        /export default function PhotoDiaporama\(\) \{/,
        `export default function PhotoDiaporama() {\n    const { t } = useTranslation();`
    );
}

// Ensure function signature matching works:
// The regexes above might not perfectly match due to newlines or exact spacing. Let's do exact replaces based on the file content.

content = content.replace(
    /function ScrolledDiaporama\(\{ images, containerRef \}: \{ images: GalleryImage\[\], containerRef: React\.RefObject<HTMLDivElement \| null> \}\) \{/,
    `function ScrolledDiaporama({ images, containerRef }: { images: GalleryImage[], containerRef: React.RefObject<HTMLDivElement | null> }) {\n    const { t } = useTranslation();`
);

content = content.replace(
    /function DreamCard\(\{ img, museumMode, onClick \}: \{ img: GalleryImage, museumMode: boolean, onClick: \(\) => void \}\) \{/,
    `function DreamCard({ img, museumMode, onClick }: { img: GalleryImage, museumMode: boolean, onClick: () => void }) {\n    const { t } = useTranslation();`
);

content = content.replace(
    /export default function PhotoDiaporama\(\) \{/,
    `export default function PhotoDiaporama() {\n    const { t } = useTranslation();`
);

const replacements = [
    ["{museumMode ? 'Quitter le Mode Musée' : 'Activer le Mode Musée'}", "{museumMode ? t('Quitter le Mode Musée') : t('Activer le Mode Musée')}"],
    [">Collection Impériale<", "><T>Collection Impériale</T><"],
    [">L'ÂME <", "><T>L'ÂME</T> <"],
    [">ÉTERNELLE<", "><T>ÉTERNELLE</T><"],
    [">IMMERSION TOTALE<", "><T>IMMERSION TOTALE</T><"],
    ["\"Une traversée onirique à travers {images.length || 238} fragments de notre patrie. Laissez-vous porter par le flux du temps.\"", "{t('Une traversée onirique à travers {{count}} fragments de notre patrie. Laissez-vous porter par le flux du temps.', { count: images.length || 238 })}"],
    [">Relique du Bénin<", "><T>Relique du Bénin</T><"],
    [">PATRIMOINE ROYAL<", "><T>PATRIMOINE ROYAL</T><"],
    [">BÉNIN REVEAL<", "><T>BÉNIN REVEAL</T><"],
    [">Initialisation du Rêve...<", "><T>Initialisation du Rêve...</T><"]
];

for (const [search, replace] of replacements) {
    if (content.includes(search)) {
        content = content.split(search).join(replace);
    }
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in PhotoDiaporama.tsx');
