const fs = require('fs');
const filepath = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/NationalitySection.tsx';
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes('useTranslation')) {
    content = content.replace(
        /import \{ useEffect \} from "react";/,
        `import { useEffect } from "react";\nimport { useTranslation, T } from "@/lib/translation";`
    );
    content = content.replace(
        /export default function NationalitySection\(\) \{/,
        `export default function NationalitySection() {\n    const { t } = useTranslation();`
    );
}

const replacements = [
    // Progress
    ['>Potentiel<', '><T>Potentiel</T><'],
    ['>Étape {currentStep + 1} de {totalSteps}<', '><T>Étape</T> {currentStep + 1} <T>de</T> {totalSteps}<'],
    ['>Analyse en cours...<', '><T>Analyse en cours...</T><'],

    // Intro
    ['>Identité & Citoyenneté<', '><T>Identité & Citoyenneté</T><'],
    ['>Obtenir la <', '><T>Obtenir la</T> <'],
    ['>Nationalité Béninoise<', '><T>Nationalité Béninoise</T><'],
    ['>Retrouvez votre fierté et vos droits. Que vous soyez descendant d\'afro-descendants ou ayant des liens familiaux, nous vous accompagnons dans toutes les démarches administratives.<', '><T>Retrouvez votre fierté et vos droits. Que vous soyez descendant d\'afro-descendants ou ayant des liens familiaux, nous vous accompagnons dans toutes les démarches administratives.</T><'],
    ['"Analyse approfondie de votre dossier"', 't("Analyse approfondie de votre dossier")'],
    ['"Recherche ou reconstitution de preuves"', 't("Recherche ou reconstitution de preuves")'],
    ['"Dépôt et suivi VIP auprès des autorités"', 't("Dépôt et suivi VIP auprès des autorités")'],
    ['"Accompagnement jusqu\'au passeport"', 't("Accompagnement jusqu\'au passeport")'],

    ['>Test d\'Éligibilité<', '><T>Test d\'Éligibilité</T><'],
    ['>Découvrez vos chances d\'obtenir la nationalité béninoise et recevez un plan d\'action concret en 6 étapes interactives.<', '><T>Découvrez vos chances d\'obtenir la nationalité béninoise et recevez un plan d\'action concret en 6 étapes interactives.</T><'],
    ['>Démarrer l\'Analyse<', '><T>Démarrer l\'Analyse</T><'],
    ['>Rapide<', '><T>Rapide</T><'],
    ['>Confidentiel<', '><T>Confidentiel</T><'],

    // Dynamic tags
    ['{step.title}', '{t(step.title)}'],
    ['{step.subtitle}', '{t(step.subtitle)}'],
    ['{opt.label}', '{t(opt.label)}'],
    ['{opt.detail}', '{t(opt.detail)}'],
    ['placeholder={field.placeholder}', 'placeholder={t(field.placeholder)}'],
    ['placeholder="Racontez-nous votre histoire, posez vos questions, parlez-nous de votre projet..."', 'placeholder={t("Racontez-nous votre histoire, posez vos questions, parlez-nous de votre projet...")}'],

    // Journey Buttons
    ['>Retour<', '><T>Retour</T><'],
    ['>Étape Suivante<', '><T>Étape Suivante</T><'],
    ['>Lancer l\'Analyse <', '><T>Lancer l\'Analyse</T> <'],

    // Result
    ['>Félicitations <', '><T>Félicitations</T> <'],
    ['> !<', '><T> !</T><'],
    ['>L\'Oracle de Retour Gagnant a analysé vos réponses avec succès. Votre profil offre d\'excellentes perspectives pour l\'obtention de la nationalité béninoise.<', '><T>L\'Oracle de Retour Gagnant a analysé vos réponses avec succès. Votre profil offre d\'excellentes perspectives pour l\'obtention de la nationalité béninoise.</T><'],
    ['>Analyse de votre profil :<', '><T>Analyse de votre profil :</T><'],
    ['{insight}', '{t(insight)}'],
    ['>Votre code d\'analyse (N.A.G)<', '><T>Votre code d\'analyse (N.A.G)</T><'],
    ['>Consulter un Expert Privé<', '><T>Consulter un Expert Privé</T><'],
    ['> Ces données ont été bien transmises sécuritairement à nos agents.<', '> <T>Ces données ont été bien transmises sécuritairement à nos agents.</T><']
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Replacements done in NationalitySection.tsx');
