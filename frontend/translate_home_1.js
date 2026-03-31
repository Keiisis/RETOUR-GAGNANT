const fs = require('fs');

function replaceAll(str, map) {
    let res = str;
    for (const [key, val] of map) {
        res = res.split(key).join(val);
    }
    return res;
}

function translateHeritageCarousel() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/HeritageCarousel.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { MapPin } from "lucide-react";', 'import { MapPin } from "lucide-react";\nimport { useTranslation, T } from "@/lib/translation";');
        code = code.replace('export default function HeritageCarousel() {', 'export default function HeritageCarousel() {\n    const { t } = useTranslation();');
        code = code.replace('function HeritageCard({ item }: { item: HeritageItem }) {', 'function HeritageCard({ item }: { item: HeritageItem }) {\n    const { t } = useTranslation();');

        const replaces = [
            ['Chargement du patrimoine...', '{t("Chargement du patrimoine...")}'],
            ['Découverte & Racines', '<T>Découverte & Racines</T>'],
            ['>Patrimoine & <', '><T>Patrimoine &</T>  <'],
            ['>Culture<', '><T>Culture</T><'],
            ['Plongez au cœur de l\'histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.', '<T>Plongez au cœur de l\\\'histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.</T>'],
            ['{item.location}', '{t(item.location || "")}'],
            ['{item.title}', '{t(item.title)}'],
            ['{item.description}', '{t(item.description)}']
        ];

        code = replaceAll(code, replaces);
        fs.writeFileSync(p, code);
        console.log('HeritageCarousel translated');
    }
}

function translateStatsSection() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/StatsSection.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { Users, Building, MapPin, Award } from "lucide-react";', 'import { Users, Building, MapPin, Award } from "lucide-react";\nimport { useTranslation, T } from "@/lib/translation";');
        code = code.replace('export default function StatsSection() {', 'export default function StatsSection() {\n    const { t } = useTranslation();');
        code = code.replace('{stat.label}', '{t(stat.label)}');
        fs.writeFileSync(p, code);
        console.log('StatsSection translated');
    }
}

function translateProcessSteps() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/ProcessSteps.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { Fingerprint, Landmark, MapPin, Handshake } from "lucide-react";', 'import { Fingerprint, Landmark, MapPin, Handshake } from "lucide-react";\nimport { useTranslation, T } from "@/lib/translation";');
        code = code.replace('export default function ProcessSteps() {', 'export default function ProcessSteps() {\n    const { t } = useTranslation();');

        const replaces = [
            ['>Notre Méthodologie<', '><T>Notre Méthodologie</T><'],
            ['>Votre Parcours d\'Intégration<', '><T>Votre Parcours d\'Intégration</T><'],
            ['>Un accompagnement pas-à-pas, de la découverte de vos racines jusqu\'à votre installation complète au Bénin.<', '><T>Un accompagnement pas-à-pas, de la découverte de vos racines jusqu\'à votre installation complète au Bénin.</T><'],
            ['{step.title}', '{t(step.title)}'],
            ['{step.description}', '{t(step.description)}']
        ];

        code = replaceAll(code, replaces);
        fs.writeFileSync(p, code);
        console.log('ProcessSteps translated');
    }
}

translateHeritageCarousel();
translateStatsSection();
translateProcessSteps();
