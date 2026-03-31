const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/app/(routes)/simulateur/page.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import \{ useState \} from 'react'/,
        `import { useState } from "react"\nimport { useTranslation, T } from "@/lib/translation"`
    );
    content = content.replace(
        /export default function SimulateurPage\(\) \{/,
        `export default function SimulateurPage() {\n    const { t } = useTranslation();`
    );
}

const replacements = [
    ['>L&apos;Oracle<', '><T>L&apos;Oracle</T><'],
    ['>Trouvez votre <', '><T>Trouvez votre </T><'],
    ['>voie<', '><T>voie</T><'],
    ['>En 5 questions, découvrez le service Retour Gagnant fait pour vous.<', '><T>En 5 questions, découvrez le service Retour Gagnant fait pour vous.</T><'],
    ['>Étape {currentStep + 1} / {totalSteps}<', '><T>Étape</T> {currentStep + 1} / {totalSteps}<'],
    ['{step.title}', '{t(step.title)}'],
    ['{step.subtitle}', '{t(step.subtitle)}'],
    ['{opt.label}', '{t(opt.label)}'],
    ['{contactStep.title}', '{t(contactStep.title)}'],
    ['{contactStep.subtitle}', '{t(contactStep.subtitle)}'],
    ['>Nom<', '><T>Nom</T><'],
    ['placeholder="Votre nom"', 'placeholder={t("Votre nom")}'],
    ['>Prénom<', '><T>Prénom</T><'],
    ['placeholder="Votre prénom"', 'placeholder={t("Votre prénom")}'],
    ['>Email<', '><T>Email</T><'],
    ['placeholder="votre@email.com"', 'placeholder={t("votre@email.com")}'],
    ['>WhatsApp (optionnel)<', '><T>WhatsApp (optionnel)</T><'],
    ['placeholder="+229 XX XX XX XX"', 'placeholder={t("+229 XX XX XX XX")}'],
    ['>Analyse en cours...<', '><T>Analyse en cours...</T><'],
    ['>Révéler ma recommandation<', '><T>Révéler ma recommandation</T><'],
    ['>score<', '><T>score</T><'],
    ['>Votre recommandation<', '><T>Votre recommandation</T><'],
    ['{result.service}', '{t(result.service)}'],
    ['\'Vos origines béninoises renforcent votre éligibilité. Notre équipe est prête à vous accompagner dans cette démarche.\'', 't(\'Vos origines béninoises renforcent votre éligibilité. Notre équipe est prête à vous accompagner dans cette démarche.\')'],
    ['\'Votre profil montre un fort intérêt pour le Bénin. Nous sommes prêts à vous accompagner.\'', 't(\'Votre profil montre un fort intérêt pour le Bénin. Nous sommes prêts à vous accompagner.\')'],
    ['>Découvrir ce service<', '><T>Découvrir ce service</T><'],
    ['>Prendre rendez-vous<', '><T>Prendre rendez-vous</T><'],
    ['>Précédent<', '><T>Précédent</T><']
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in simulateur/page.tsx');
