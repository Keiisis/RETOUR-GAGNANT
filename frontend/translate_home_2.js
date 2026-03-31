const fs = require('fs');

function replaceAll(str, map) {
    let res = str;
    for (const [key, val] of map) {
        res = res.split(key).join(val);
    }
    return res;
}

function translateServicesGrid() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/ServicesGrid.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { LucideIcon } from "lucide-react";', 'import { LucideIcon } from "lucide-react";\nimport { useTranslation, T } from "@/lib/translation";');
        code = code.replace('export default function ServicesGrid() {', 'export default function ServicesGrid() {\n    const { t } = useTranslation();');

        const replaces = [
            ['{service.title}', '{t(service.title)}'],
            ['{service.description}', '{t(service.description)}'],
            ['>En savoir plus<', '><T>En savoir plus</T><'],
        ];

        code = replaceAll(code, replaces);
        fs.writeFileSync(p, code);
        console.log('ServicesGrid translated');
    }
}

function translateTestimonialsCarousel() {
    const p = 'C:/Users/HP/Desktop/RETOUR GAGNANT TEMPLATE/frontend/components/home/TestimonialsCarousel.tsx';
    let code = fs.readFileSync(p, 'utf8');
    if (!code.includes('useTranslation')) {
        code = code.replace('import { supabase } from \'@/lib/supabase\';', 'import { supabase } from \'@/lib/supabase\';\nimport { useTranslation, T } from "@/lib/translation";');

        code = code.replace('function TestimonialCard({ item }: { item: Testimonial }) {', 'function TestimonialCard({ item }: { item: Testimonial }) {\n    const { t } = useTranslation();');
        code = code.replace('function SubmissionForm() {', 'function SubmissionForm() {\n    const { t } = useTranslation();');
        code = code.replace('export default function TestimonialsCarousel() {', 'export default function TestimonialsCarousel() {\n    const { t } = useTranslation();');

        const replaces = [
            ['>Merci ! 🇧🇯<', '><T>Merci ! 🇧🇯</T><'],
            ['>Votre témoignage a été reçu. Il sera publié après validation.<', '><T>Votre témoignage a été reçu. Il sera publié après validation.</T><'],
            ['>Envoyer un autre avis<', '><T>Envoyer un autre avis</T><'],
            ['>Partagez votre expérience<', '><T>Partagez votre expérience</T><'],
            ['>Rejoignez la communauté du Retour Gagnant<', '><T>Rejoignez la communauté du Retour Gagnant</T><'],
            ['placeholder="Votre nom"', 'placeholder={t("Votre nom")}'],
            ['placeholder="Votre rôle (ex: Entrepreneur)"', 'placeholder={t("Votre rôle (ex: Entrepreneur)")}'],
            ['placeholder="Ville, Pays"', 'placeholder={t("Ville, Pays")}'],
            ['>Service utilisé<', '><T>Service utilisé</T><'],
            ['>Passeport & Administratif<', '><T>Passeport & Administratif</T><'],
            ['>Logement Premium<', '><T>Logement Premium</T><'],
            ['>Création d\'Entreprise<', '><T>Création d\'Entreprise</T><'],
            ['>Guide Culturel<', '><T>Guide Culturel</T><'],
            ['>Construction<', '><T>Construction</T><'],
            ['>Investissement<', '><T>Investissement</T><'],
            ['>Votre Note<', '><T>Votre Note</T><'],
            ['>Votre Photo (Optionnel)<', '><T>Votre Photo (Optionnel)</T><'],
            ['>Ajouter une photo<', '><T>Ajouter une photo</T><'],
            ['placeholder="Racontez-nous votre histoire..."', 'placeholder={t("Racontez-nous votre histoire...")}'],
            ['>Publication en cours...<', '><T>Publication en cours...</T><'],
            ['>Envoyer mon avis<', '><T>Envoyer mon avis</T><'],
            ['>La Voix de la Diaspora<', '><T>La Voix de la Diaspora</T><'],
            ['>Ils ont osé le <', '><T>Ils ont osé le</T> <'],
            ['>Retour Gagnant<', '><T>Retour Gagnant</T><'],
            ['>Découvrez les histoires inspirantes de ceux qui ont franchi le pas.<', '><T>Découvrez les histoires inspirantes de ceux qui ont franchi le pas.</T><'],
            ['{item.role}', '{t(item.role)}'],
            ['{item.text}', '{t(item.text)}'],
            ['{item.service}', '{t(item.service)}']
        ];

        code = replaceAll(code, replaces);
        fs.writeFileSync(p, code);
        console.log('TestimonialsCarousel translated');
    }
}
translateServicesGrid();
translateTestimonialsCarousel();
