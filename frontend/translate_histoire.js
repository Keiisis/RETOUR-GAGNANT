const fs = require('fs');

function translateFounderCard() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/histoire/FounderCard.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace("import Image from 'next/image'", "import Image from 'next/image'\nimport { useTranslation } from '@/lib/translation'");
        code = code.replace("export function FounderCard({ founder, index }: { founder: FounderData, index: number }) {", "export function FounderCard({ founder, index }: { founder: FounderData, index: number }) {\n    const { t } = useTranslation();");
        code = code.replace("{founder.role}", "{t(founder.role)}");
        code = code.replace("{founder.name}", "{t(founder.name)}");
        code = code.replace("{founder.quote}", "{t(founder.quote)}");
        fs.writeFileSync(p, code);
    }
}

function translateTimelineSection() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/histoire/TimelineSection.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace("import { ArrowRight } from 'lucide-react'", "import { ArrowRight } from 'lucide-react'\nimport { useTranslation, T } from '@/lib/translation'");
        code = code.replace("export function TimelineSection({ items }: { items: TimelineItem[] }) {", "export function TimelineSection({ items }: { items: TimelineItem[] }) {\n    const { t } = useTranslation();");

        code = code.replace("{item.year}", "{t(item.year)}");
        code = code.replace("{item.title}", "{t(item.title)}");
        code = code.replace("{item.description}", "{t(item.description)}");

        fs.writeFileSync(p, code);
    }
}

function translateNotreHistoirePage() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/app/notre-histoire/page.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace("import { usePageSections } from '@/lib/hooks/usePageSections'", "import { usePageSections } from '@/lib/hooks/usePageSections'\nimport { T, useTranslation } from '@/lib/translation'");
        code = code.replace("export default function NotreHistoirePage() {", "export default function NotreHistoirePage() {\n    const { t } = useTranslation();");

        const replaceList = [
            ['>Notre Histoire<', '><T>Notre Histoire</T><'],
            ['N&eacute;s d&apos;une', 't(\\"N\'és d\'une\\")'],
            ['>Vision<', '><T>Vision</T><'],
            ['Port&eacute;s par une Mission', 't(\\"Portés par une Mission\\")'],
            ['>Derrière Retour Gagnant, il y a des visionnaires qui ont transformé un rêve en réalité.\n                            Découvrez le parcours de ceux qui œuvrent chaque jour pour rendre votre retour au Bénin inoubliable.<', '><T>Derrière Retour Gagnant, il y a des visionnaires qui ont transformé un rêve en réalité. Découvrez le parcours de ceux qui œuvrent chaque jour pour rendre votre retour au Bénin inoubliable.</T><'],
            ['>Découvrir notre parcours<', '><T>Découvrir notre parcours</T><'],
            ['>Le Constat<', '><T>Le Constat</T><'],
            ['>Le Monde Avant Retour Gagnant<', '><T>Le Monde Avant Retour Gagnant</T><'],
            ['Pendant des décennies, les membres de la diaspora béninoise faisaient face à un paradoxe cruel :\n                                le désir profond de revenir enrichir leur terre natale, confronté à un mur de complexités administratives,\n                                juridiques et logistiques.', 't(\\"Pendant des décennies, les membres de la diaspora béninoise faisaient face à un paradoxe cruel : le désir profond de revenir enrichir leur terre natale, confronté à un mur de complexités administratives, juridiques et logistiques.\\")'],
            ['>Les d&eacute;marches &eacute;taient opaques, les interlocuteurs dispers&eacute;s, et les arnaques fr&eacute;quentes.\n                                Combien de projets de retour ont &eacute;t&eacute; abandonn&eacute;s faute d&apos;accompagnement ? Combien de r&ecirc;ves\n                                ont &eacute;t&eacute; bris&eacute;s par la bureaucratie ?<', '>{t(\\"Les démarches étaient opaques, les interlocuteurs dispersés, et les arnaques fréquentes. Combien de projets de retour ont été abandonnés faute d\'accompagnement ? Combien de rêves ont été brisés par la bureaucratie ?\\")}<'],
            ['>&quot;Il fallait que quelqu&apos;un se l&egrave;ve et dise : plus jamais un retour ne sera un parcours du combattant.\n                                    C&apos;est cette conviction qui a tout d&eacute;clench&eacute;.&quot;<', '>{t(\\"\\"Il fallait que quelqu\'un se lève et dise : plus jamais un retour ne sera un parcours du combattant. C\'est cette conviction qui a tout déclenché.\\"\\")}<'],
            ['>Notre Parcours<', '><T>Notre Parcours</T><'],
            ['De l&apos;Id&eacute;e &agrave; la', 't(\\"De l\'Idée à la\\")'],
            ['>R&eacute;alit&eacute;<', '><T>Réalité</T><'],
            ['>Les Visionnaires<', '><T>Les Visionnaires</T><'],
            ['>Les Architectes du<', '><T>Les Architectes du</T><'],
            ['>Changement<', '><T>Changement</T><'],
            ['>Rencontrez les promoteurs qui ont donn&eacute; vie &agrave; cette vision et qui continuent de porter\n                            l&apos;ambition de Retour Gagnant chaque jour.<', '>{t(\\"Rencontrez les promoteurs qui ont donné vie à cette vision et qui continuent de porter l\'ambition de Retour Gagnant chaque jour.\\")}<'],
            ['>ADN<', '><T>ADN</T><'],
            ['>Nos<', '><T>Nos</T><'],
            ['>Valeurs<', '><T>Valeurs</T><'],
            ['>Votre Retour Gagnant<', '><T>Votre Retour Gagnant</T><'],
            ['>Commence Ici<', '><T>Commence Ici</T><'],
            ['>Rejoignez les centaines de familles qui ont fait confiance à notre expertise.\n                            Prenons 15 minutes pour discuter de votre projet de retour.<', '><T>Rejoignez les centaines de familles qui ont fait confiance à notre expertise. Prenons 15 minutes pour discuter de votre projet de retour.</T><'],
            ['>Prendre Rendez-vous<', '><T>Prendre Rendez-vous</T><'],
            ['>Nous Contacter<', '><T>Nous Contacter</T><'],
            ['{stat.label}', '{t(stat.label)}'],
            ['{val.title}', '{t(val.title)}'],
            ['{val.description}', '{t(val.description)}']
        ];

        for (let i = 0; i < replaceList.length; i++) {
            code = code.replace(replaceList[i][0], replaceList[i][1]);
        }

        fs.writeFileSync(p, code);
    }
}

translateFounderCard();
translateTimelineSection();
translateNotreHistoirePage();
console.log('Translated notre-histoire components and page');
