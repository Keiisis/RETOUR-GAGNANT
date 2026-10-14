// ══════════════════════════════════════════════════════════════
//  « Fiche de synthèse d'enregistrement » MyAfroOrigins (PDF A4).
//
//  Remise au client une fois son dossier déposé sur la plateforme : elle
//  réunit le numéro de dossier MyAfroOrigins et ses identifiants d'accès au
//  portail de suivi. Mise en page reprise du modèle validé par l'agence
//  (en-tête vert + bande tricolore, cartouche, quatre cases, bloc des
//  identifiants, encadré de sécurité). Libellés fixes dans les 6 langues
//  du site ; aucune traduction automatique sur ce document.
//  Module isomorphe (jsPDF), comme lib/document-pdf.ts.
// ══════════════════════════════════════════════════════════════
import { jsPDF } from 'jspdf'
import type { EnregistrementMyafro } from './myafro-enregistrement'
import type { LangueDoc } from './document-langues'

type RGB = [number, number, number]
const C = {
    vert: [0, 135, 81] as RGB, vertClair: [240, 253, 244] as RGB, vertBord: [187, 247, 208] as RGB,
    jaune: [252, 209, 22] as RGB, rouge: [232, 17, 45] as RGB,
    texte: [17, 24, 39] as RGB, gris: [71, 85, 105] as RGB, grisClair: [100, 116, 139] as RGB,
    fond: [248, 250, 252] as RGB, bord: [226, 232, 240] as RGB,
    ambreFond: [255, 251, 235] as RGB, ambreBord: [253, 230, 138] as RGB, ambre: [217, 119, 6] as RGB, brun: [146, 64, 14] as RGB,
}

interface Libelles {
    sousTitre: string; titre: string; sousTitreFiche: string; section: string
    demandeur: string; demarche: string; demarcheValeur: string; numero: string; date: string
    acces: string; accesAide: string; email: string; motDePasse: string
    securiteTitre: string; securite: string; reference: string
    mois: string[]; locale: string
}
const L: Record<LangueDoc, Libelles> = {
    fr: {
        sousTitre: "PROGRAMME D'ACCOMPAGNEMENT & SUIVI DES DÉMARCHES ADMINISTRATIVES",
        titre: "FICHE DE SYNTHÈSE D'ENREGISTREMENT", sousTitreFiche: 'Document récapitulatif des identifiants de suivi de la demande de nationalité',
        section: 'INFORMATIONS SUR LA DEMANDE', demandeur: 'NOM & PRÉNOM DU DEMANDEUR', demarche: 'TYPE DE DÉMARCHE', demarcheValeur: 'Nationalité Béninoise',
        numero: 'NUMÉRO DE DOSSIER / SUIVI', date: 'DATE DE DÉPÔT / DEMANDE',
        acces: "IDENTIFIANTS D'ACCÈS AU PORTAIL DE SUIVI", accesAide: "Utilisez ces identifiants pour consulter l'avancement de la procédure sur le portail en ligne officiel.",
        email: 'ADRESSE E-MAIL DE SUIVI', motDePasse: 'MOT DE PASSE RÉSEAU',
        securiteTitre: 'Recommandation de Sécurité :', securite: "Ce document contient des informations confidentielles d'accès. Conservez-le dans un endroit sûr et ne communiquez vos identifiants à aucune personne non autorisée.",
        reference: 'Document de Référence',
        mois: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'], locale: 'fr',
    },
    en: {
        sousTitre: 'SUPPORT PROGRAMME & ADMINISTRATIVE PROCEDURE TRACKING',
        titre: 'REGISTRATION SUMMARY SHEET', sousTitreFiche: 'Summary of the tracking credentials for the nationality application',
        section: 'APPLICATION DETAILS', demandeur: "APPLICANT'S FULL NAME", demarche: 'TYPE OF PROCEDURE', demarcheValeur: 'Beninese Nationality',
        numero: 'FILE / TRACKING NUMBER', date: 'FILING / APPLICATION DATE',
        acces: 'TRACKING PORTAL LOGIN DETAILS', accesAide: 'Use these credentials to follow the progress of the procedure on the official online portal.',
        email: 'TRACKING E-MAIL ADDRESS', motDePasse: 'PORTAL PASSWORD',
        securiteTitre: 'Security recommendation:', securite: 'This document contains confidential login information. Keep it in a safe place and never share your credentials with anyone unauthorised.',
        reference: 'Reference Document',
        mois: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], locale: 'en',
    },
    es: {
        sousTitre: 'PROGRAMA DE ACOMPAÑAMIENTO Y SEGUIMIENTO DE TRÁMITES ADMINISTRATIVOS',
        titre: 'FICHA DE SÍNTESIS DE REGISTRO', sousTitreFiche: 'Resumen de los identificadores de seguimiento de la solicitud de nacionalidad',
        section: 'DATOS DE LA SOLICITUD', demandeur: 'NOMBRE Y APELLIDOS DEL SOLICITANTE', demarche: 'TIPO DE TRÁMITE', demarcheValeur: 'Nacionalidad beninesa',
        numero: 'NÚMERO DE EXPEDIENTE / SEGUIMIENTO', date: 'FECHA DE PRESENTACIÓN',
        acces: 'IDENTIFICADORES DE ACCESO AL PORTAL DE SEGUIMIENTO', accesAide: 'Utilice estos identificadores para consultar el avance del trámite en el portal oficial en línea.',
        email: 'CORREO DE SEGUIMIENTO', motDePasse: 'CONTRASEÑA DEL PORTAL',
        securiteTitre: 'Recomendación de seguridad:', securite: 'Este documento contiene datos de acceso confidenciales. Consérvelo en un lugar seguro y no comunique sus identificadores a ninguna persona no autorizada.',
        reference: 'Documento de referencia',
        mois: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], locale: 'es',
    },
    pt: {
        sousTitre: 'PROGRAMA DE ACOMPANHAMENTO E SEGUIMENTO DOS TRÂMITES ADMINISTRATIVOS',
        titre: 'FICHA-RESUMO DE REGISTRO', sousTitreFiche: 'Resumo das credenciais de acompanhamento do pedido de nacionalidade',
        section: 'INFORMAÇÕES DO PEDIDO', demandeur: 'NOME COMPLETO DO REQUERENTE', demarche: 'TIPO DE PROCEDIMENTO', demarcheValeur: 'Nacionalidade beninense',
        numero: 'NÚMERO DO PROCESSO / ACOMPANHAMENTO', date: 'DATA DO PEDIDO',
        acces: 'CREDENCIAIS DE ACESSO AO PORTAL DE ACOMPANHAMENTO', accesAide: 'Use estas credenciais para acompanhar o andamento do processo no portal oficial online.',
        email: 'E-MAIL DE ACOMPANHAMENTO', motDePasse: 'SENHA DO PORTAL',
        securiteTitre: 'Recomendação de segurança:', securite: 'Este documento contém informações de acesso confidenciais. Guarde-o em local seguro e não compartilhe suas credenciais com nenhuma pessoa não autorizada.',
        reference: 'Documento de referência',
        mois: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'], locale: 'pt',
    },
    cr: {
        sousTitre: 'PWOGRAM AKONPAGNMAN & SWIV DÉMACH ADMINISTRATIF',
        titre: 'FICH SENTÈZ ANRÉJISTRÈMAN', sousTitreFiche: 'Dokiman ki ka rézimé idantifyan swiv a dimann nasyonalité-a',
        section: 'ENFÒMASYON SOU DIMANN-LA', demandeur: 'NON & SIYATI MOUN-LA KI KA FÈ DIMANN', demarche: 'KALITÉ DÉMACH', demarcheValeur: 'Nasyonalité Béninwa',
        numero: 'NIMÉWO DOSYÉ / SWIV', date: 'DAT DÉPO / DIMANN',
        acces: 'IDANTIFYAN POU ANTRÉ ASOU PÒTAY SWIV-LA', accesAide: 'Sèvi épi idantifyan-lasa pou gadé kijan démach-la ka avansé asou pòtay ofisyèl-la an liy.',
        email: 'ADRÈS IMÈL SWIV', motDePasse: 'MÒD PAS PÒTAY',
        securiteTitre: 'Konsèy sékirité :', securite: 'Dokiman-lasa ni enfòmasyon konfidansyèl. Gadé-y an on koté sèten é pa bay pèsonn ki pa otorizé idantifyan a-zòt.',
        reference: 'Dokiman référans',
        mois: ['janvyé', 'févriyé', 'mas', 'avril', 'mé', 'jen', 'jiyè', 'out', 'sèptanm', 'òktòb', 'novanm', 'désanm'], locale: 'cr',
    },
    ht: {
        sousTitre: 'PWOGRAM AKONPAYMAN AK SWIVI DEMACH ADMINISTRATIF',
        titre: 'FICH SENTÈZ ANREJISTREMAN', sousTitreFiche: 'Dokiman ki rezime idantifyan swivi demann nasyonalite a',
        section: 'ENFÒMASYON SOU DEMANN LAN', demandeur: 'NON AK SIYATI MOUN K AP FÈ DEMANN', demarche: 'KALITE DEMACH', demarcheValeur: 'Nasyonalite Benen',
        numero: 'NIMEWO DOSYE / SWIVI', date: 'DAT DEPO / DEMANN',
        acces: 'IDANTIFYAN POU ANTRE SOU PÒTAY SWIVI A', accesAide: 'Sèvi ak idantifyan sa yo pou w swiv kijan demach la ap avanse sou pòtay ofisyèl la sou entènèt.',
        email: 'ADRÈS IMÈL SWIVI', motDePasse: 'MODPAS PÒTAY LA',
        securiteTitre: 'Rekòmandasyon sekirite :', securite: 'Dokiman sa a gen enfòmasyon konfidansyèl. Kenbe l nan yon kote ki an sekirite epi pa bay okenn moun ki pa otorize idantifyan ou yo.',
        reference: 'Dokiman referans',
        mois: ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'], locale: 'ht',
    },
}

/** « 06 Octobre 2026 » (jour sur deux chiffres, mois en toutes lettres). */
export function dateLongue(iso: string, l: LangueDoc = 'fr'): string {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
    if (isNaN(d.getTime())) return iso
    const m = L[l].mois[d.getUTCMonth()]
    const j = String(d.getUTCDate()).padStart(2, '0')
    return l === 'en' ? `${j} ${m} ${d.getUTCFullYear()}` : l === 'es' || l === 'pt' ? `${j} de ${m} de ${d.getUTCFullYear()}` : `${j} ${m} ${d.getUTCFullYear()}`
}

/** « MONTA Raphaël » : nom en capitales, prénom tel quel. */
export const nomDemandeur = (e: Pick<EnregistrementMyafro, 'demandeur'>) =>
    [e.demandeur.nom.toUpperCase(), e.demandeur.prenom].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

export const nomFichierFiche = (e: Pick<EnregistrementMyafro, 'demandeur' | 'numeroDossier'>) =>
    `Fiche_suivi_MyAfroOrigins_${nomDemandeur(e).replace(/[^\p{L}\p{N}]+/gu, '_')}_${e.numeroDossier.replace(/[^\w-]+/g, '')}.pdf`

/** Email d'accompagnement de la fiche (texte fixe par langue ; les identifiants restent dans le PDF joint). */
export function messageFiche(l: LangueDoc, prenom: string, numero: string): { sujet: string; titre: string; corps: string } {
    const echap = (s: string) => s.trim().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
    const p = echap(prenom)
    numero = echap(numero)
    const m: Record<LangueDoc, { sujet: string; titre: string; corps: string }> = {
        fr: { sujet: `Votre dossier MyAfroOrigins N° ${numero} : fiche de suivi`, titre: 'Votre dossier est enregistré', corps: `Bonjour ${p},<br><br>Votre demande de nationalité béninoise a été déposée sur la plateforme MyAfroOrigins sous le numéro <strong>${numero}</strong>.<br><br>Vous trouverez en pièce jointe votre fiche de synthèse d'enregistrement : elle contient vos identifiants d'accès au portail de suivi. Conservez-la précieusement et ne la transmettez à personne.<br><br>Notre équipe reste à vos côtés à chaque étape.` },
        en: { sujet: `Your MyAfroOrigins file No. ${numero}: tracking sheet`, titre: 'Your file is registered', corps: `Hello ${p},<br><br>Your application for Beninese nationality has been filed on the MyAfroOrigins platform under number <strong>${numero}</strong>.<br><br>Attached is your registration summary sheet with your login details for the tracking portal. Please keep it safe and do not share it with anyone.<br><br>Our team remains by your side at every step.` },
        es: { sujet: `Su expediente MyAfroOrigins N.º ${numero}: ficha de seguimiento`, titre: 'Su expediente está registrado', corps: `Hola ${p}:<br><br>Su solicitud de nacionalidad beninesa ha sido presentada en la plataforma MyAfroOrigins con el número <strong>${numero}</strong>.<br><br>Adjuntamos su ficha de síntesis de registro con sus identificadores de acceso al portal de seguimiento. Consérvela con cuidado y no la comparta con nadie.<br><br>Nuestro equipo le acompaña en cada etapa.` },
        pt: { sujet: `Seu processo MyAfroOrigins N.º ${numero}: ficha de acompanhamento`, titre: 'Seu processo está registrado', corps: `Olá, ${p},<br><br>Seu pedido de nacionalidade beninense foi registrado na plataforma MyAfroOrigins sob o número <strong>${numero}</strong>.<br><br>Em anexo está sua ficha-resumo de registro, com suas credenciais de acesso ao portal de acompanhamento. Guarde-a com cuidado e não a compartilhe com ninguém.<br><br>Nossa equipe acompanha você em cada etapa.` },
        cr: { sujet: `Dosyé MyAfroOrigins a-w N° ${numero} : fich swiv`, titre: 'Dosyé a-w anréjistré', corps: `Bonjou ${p},<br><br>Dimann nasyonalité béninwa a-w ja dépozé asou platfòm MyAfroOrigins, épi nimewo <strong>${numero}</strong>.<br><br>Nou ka voyé-w fich sentèz anréjistrèman a-w an pyès jwent : idantifyan a-w pou pòtay swiv-la adan-y. Gadé-y byen é pa bay pèsonn li.<br><br>Ékip-nou la épi-w pou chak étap.` },
        ht: { sujet: `Dosye MyAfroOrigins ou N° ${numero} : fich swivi`, titre: 'Dosye ou anrejistre', corps: `Bonjou ${p},<br><br>Demann nasyonalite Benen ou an depoze sou platfòm MyAfroOrigins ak nimewo <strong>${numero}</strong>.<br><br>Nou voye fich sentèz anrejistreman ou an atache : li gen idantifyan ou pou pòtay swivi a. Kenbe l byen epi pa bay pèsonn li.<br><br>Ekip nou an la avè w nan chak etap.` },
    }
    return m[l] || m.fr
}

export function dessinerFicheSuivi(e: EnregistrementMyafro, langue: LangueDoc = 'fr'): jsPDF {
    const t = L[langue] || L.fr
    const pdf = new jsPDF('p', 'mm', 'a4')
    const PW = 210, PH = 297, ML = 18, MR = 18, CW = PW - ML - MR
    const couleur = (c: RGB, m: 'text' | 'fill' | 'draw' = 'text') =>
        m === 'text' ? pdf.setTextColor(c[0], c[1], c[2]) : m === 'fill' ? pdf.setFillColor(c[0], c[1], c[2]) : pdf.setDrawColor(c[0], c[1], c[2])
    const police = (style: 'normal' | 'bold', taille: number, c: RGB, famille = 'helvetica') => { pdf.setFont(famille, style); pdf.setFontSize(taille); couleur(c) }
    const ajuster = (txt: string, largeur: number, depart: number) => {
        let s = depart; pdf.setFontSize(s)
        while (pdf.getTextWidth(txt) > largeur && s > 6) { s -= 0.25; pdf.setFontSize(s) }
    }
    const boite = (x: number, y: number, w: number, h: number, fond: RGB, bord: RGB) => {
        couleur(fond, 'fill'); couleur(bord, 'draw'); pdf.setLineWidth(0.25); pdf.roundedRect(x, y, w, h, 1.6, 1.6, 'FD')
    }
    const case_ = (x: number, y: number, w: number, h: number, libelle: string, valeur: string, cValeur: RGB = C.texte, mono = false) => {
        boite(x, y, w, h, [255, 255, 255], C.bord)
        police('bold', 7.4, C.grisClair); pdf.text(libelle, x + 4, y + 5.6)
        police('bold', mono ? 10.6 : 11.2, cValeur, mono ? 'courier' : 'helvetica')
        ajuster(valeur, w - 8, mono ? 10.6 : 11.2); pdf.text(valeur, x + 4, y + 11.8)
    }

    // ── En-tête ─────────────────────────────────────────────────────────────
    police('bold', 17, C.vert); pdf.text('RETOUR GAGNANT BÉNIN', ML, 30)
    police('normal', 8.6, C.gris); ajuster(t.sousTitre, CW - 30, 8.6); pdf.text(t.sousTitre, ML, 36)
    const bx = PW - MR - 21, by = 28.6, bw = 7
    ;[C.vert, C.jaune, C.rouge].forEach((c, i) => { couleur(c, 'fill'); pdf.roundedRect(bx + i * bw, by, bw, 1.4, 0.7, 0.7, 'F') })
    couleur(C.vert, 'fill'); pdf.rect(ML, 40.2, CW, 0.7, 'F')

    // ── Cartouche titre ─────────────────────────────────────────────────────
    couleur(C.fond, 'fill'); pdf.roundedRect(ML, 46, CW, 17, 1.4, 1.4, 'F')
    couleur(C.vert, 'fill'); pdf.rect(ML, 46, 1, 17, 'F')
    police('bold', 12.6, C.texte); pdf.text(t.titre, ML + 6, 53)
    police('normal', 8.4, C.gris); ajuster(t.sousTitreFiche, CW - 12, 8.4); pdf.text(t.sousTitreFiche, ML + 6, 58.8)

    // ── Informations sur la demande ─────────────────────────────────────────
    police('bold', 10.8, C.vert); pdf.text(t.section, ML, 72)
    couleur([203, 213, 225], 'draw'); pdf.setLineWidth(0.35); pdf.line(ML, 74.6, PW - MR, 74.6)
    const cw = (CW - 3.4) / 2, ch = 16.2
    case_(ML, 78, cw, ch, t.demandeur, nomDemandeur(e))
    case_(ML + cw + 3.4, 78, cw, ch, t.demarche, t.demarcheValeur)
    case_(ML, 97.6, cw, ch, t.numero, `N° ${e.numeroDossier}`, C.vert)
    case_(ML + cw + 3.4, 97.6, cw, ch, t.date, dateLongue(e.dateDepot, langue))

    // ── Identifiants d'accès ────────────────────────────────────────────────
    boite(ML, 119.6, CW, 37, C.vertClair, C.vertBord)
    police('bold', 10.8, C.vert); ajuster(t.acces, CW - 9, 10.8); pdf.text(t.acces, ML + 4.6, 126.6)
    police('normal', 8.2, C.gris); ajuster(t.accesAide, CW - 9, 8.2); pdf.text(t.accesAide, ML + 4.6, 132.6)
    const iw = (CW - 9.2 - 3.4) / 2
    case_(ML + 4.6, 137, iw, 14.6, t.email, e.emailSuivi, C.texte, true)
    case_(ML + 4.6 + iw + 3.4, 137, iw, 14.6, t.motDePasse, e.motDePasse, C.texte, true)

    // ── Recommandation de sécurité ──────────────────────────────────────────
    // Titre en gras puis texte courant sur la même ligne : retour à la ligne
    // calculé mot à mot (la première ligne est raccourcie de la largeur du titre).
    police('bold', 8.4, C.brun)
    const wTitre = pdf.getTextWidth(`${t.securiteTitre} `)
    police('normal', 8.4, C.brun)
    const largeur = CW - 10, lignes: string[] = ['']
    for (const mot of t.securite.split(/\s+/)) {
        const i = lignes.length - 1, essai = lignes[i] ? `${lignes[i]} ${mot}` : mot
        if (pdf.getTextWidth(essai) <= largeur - (i === 0 ? wTitre : 0)) lignes[i] = essai
        else lignes.push(mot)
    }
    const hs = Math.max(15.6, lignes.length * 4.2 + 6.4)
    boite(ML, 161.8, CW, hs, C.ambreFond, C.ambreBord)
    couleur(C.ambre, 'fill'); pdf.rect(ML, 161.8, 0.9, hs, 'F')
    police('bold', 8.4, C.brun); pdf.text(t.securiteTitre, ML + 4.6, 168.2)
    police('normal', 8.4, C.brun)
    lignes.forEach((l, i) => pdf.text(l, ML + 4.6 + (i === 0 ? wTitre : 0), 168.2 + i * 4.2))

    // ── Pied de page ────────────────────────────────────────────────────────
    couleur([203, 213, 225], 'draw'); pdf.setLineWidth(0.3); pdf.line(ML, PH - 16, PW - MR, PH - 16)
    police('normal', 8.6, C.gris)
    const civ = e.demandeur.civilite ? `${e.demandeur.civilite} ` : ''
    pdf.text(`RETOUR GAGNANT BÉNIN — ${civ}${nomDemandeur(e)}`, ML, PH - 10.4)
    pdf.text(t.reference, PW - MR, PH - 10.4, { align: 'right' })
    return pdf
}
