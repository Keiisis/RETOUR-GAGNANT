const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/layout/Footer.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import \{ COMPANY_INFO \} from "@\/lib\/constants\/company-info";/,
        `import { COMPANY_INFO } from "@/lib/constants/company-info";\nimport { useTranslation, T } from "@/lib/translation";`
    );
    content = content.replace(
        /export default function Footer\(\) \{/,
        `export default function Footer() {\n    const { t } = useTranslation();`
    );
}

const replacements = [
    ['>Votre partenaire de confiance pour un retour réussi et des investissements sécurisés au Bénin. Tradition, Modernité, Et Excellence.<', '><T>Votre partenaire de confiance pour un retour réussi et des investissements sécurisés au Bénin. Tradition, Modernité, Et Excellence.</T><'],
    ['>Navigation<', '><T>Navigation</T><'],
    ['>Services Clés<', '><T>Services Clés</T><'],
    ['>Contact<', '><T>Contact</T><'],
    ['> République du Bénin<', '><T>République du Bénin</T><'],
    ['>© 2025 Retour Gagnant Bénin. Tous droits réservés.<', '><T>© 2025 Retour Gagnant Bénin. Tous droits réservés.</T><'],
    ['>Mentions Légales<', '><T>Mentions Légales</T><'],
    ['>Confidentialité<', '><T>Confidentialité</T><'],
    ['{item.name}', '{t(item.name)}']
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in Footer.tsx');
