const fs = require('fs');

function replaceAll(str, map) {
    let res = str;
    for (const [key, val] of map) {
        res = res.split(key).join(val);
    }
    return res;
}

function translatePartnersSection() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/PartnersSection.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { ArrowRight, ExternalLink } from "lucide-react";', 'import { ArrowRight, ExternalLink } from "lucide-react"\nimport { useTranslation, T } from "@/lib/translation"');
        code = code.replace('export default function PartnersSection() {', 'export default function PartnersSection() {\n    const { t } = useTranslation();');
        code = code.replace("Ils nous font confiance", "<T>Ils nous font confiance</T>");
        code = code.replace("nous soutiennent", "<T>nous soutiennent</T>");
        code = code.replace("Découvrir nos partenaires privilégiés", "<T>Découvrir nos partenaires privilégiés</T>");

        fs.writeFileSync(p, code);
        console.log('PartnersSection translated');
    }
}

function translateImmersiveGallery() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/ImmersiveGallery.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";', 'import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";\nimport { useTranslation, T } from "@/lib/translation";');
        code = code.replace('export default function ImmersiveGallery() {', 'export default function ImmersiveGallery() {\n    const { t } = useTranslation();');

        const replaces = [
            ['>Immersion Visuelle<', '><T>Immersion Visuelle</T><'],
            ['>Vision du <', '><T>Vision du</T> <'],
            ['>Découvrir<', '><T>Découvrir</T><'],
            ['>Photos<', '><T>Photos</T><'],
            ['>Souvenirs<', '><T>Souvenirs</T><'],
        ];

        code = replaceAll(code, replaces);
        fs.writeFileSync(p, code);
        console.log('ImmersiveGallery translated');
    }
}

translatePartnersSection();
translateImmersiveGallery();
