// ══════════════════════════════════════════════════════════════
//  Fiche de Suivi Client RGB : page imprimable (A4).
//  En-tête identique à la grille tarifaire (app/api/grille-tarifaire/print),
//  corps fidèle au modèle « Fiche de Suivi Client — RGB ».
//  La mise en pages est faite dans le navigateur : chaque bloc est posé
//  sur la page courante, mesuré, et passe à la page suivante s'il déborde.
//  Les pièces (section 4) et l'analyse (section 5) se coupent ligne à
//  ligne, avec la mention « (suite) » : aucune longueur ne déborde.
// ══════════════════════════════════════════════════════════════
import { escapeHtml } from './security'
import { OPTIONS, casesCochees, type FicheSuivi } from './fiche-suivi'

const e = (v: string | null | undefined) => escapeHtml(v ?? '')

const VIDE = '___/___/20___'

function dateFr(iso: string | null | undefined): string {
    if (!iso) return VIDE
    const [a, m, j] = iso.split('-')
    return `${j}/${m}/${a}`
}

function cases(champ: keyof typeof OPTIONS, valeur: string | null | undefined, lignes?: string[][]): string {
    const coches = champ === 'canaux' ? [] : casesCochees(champ, valeur)
    const libelles = new Map<string, string>(OPTIONS[champ].map(([v, l]) => [v, l]))
    const une = (v: string) => `<span class="opt"><span class="cb${coches.includes(v) ? ' on' : ''}"></span>${e(libelles.get(v))}</span>`
    const groupes = lignes ?? [OPTIONS[champ].map(([v]) => v)]
    return groupes.map(g => `<div class="opts">${g.map(une).join('')}</div>`).join('')
}

function canaux(liste: string[]): string {
    return `<div class="opts">${OPTIONS.canaux
        .map(([v, l]) => `<span class="opt"><span class="cb${liste.includes(v) ? ' on' : ''}"></span>${e(l)}</span>`)
        .join('')}</div>`
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#e8edf2;color:#1a2433}
.actions{max-width:210mm;margin:18px auto 0;display:flex;justify-content:flex-end;gap:10px}
.btn{padding:11px 28px;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}
.btn-print{background:#008751;color:#fff}
.page{width:210mm;height:297mm;max-height:297mm;margin:18px auto 36px;background:#fff;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.08);overflow:hidden;padding-top:8mm}
.flag-stripe{display:flex;height:6px;flex-shrink:0}
.flag-g,.flag-j,.flag-r{flex:1;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.flag-g{background:#008751;border-top:6px solid #008751}
.flag-j{background:#FCD116;border-top:6px solid #FCD116}
.flag-r{background:#E8112D;border-top:6px solid #E8112D}
.header{display:flex;justify-content:space-between;align-items:center;padding:12px 32px 10px;border-bottom:2.5px solid #008751;flex-shrink:0}
.brand{display:flex;align-items:center;gap:18px}
.logo{width:95px;height:var(--logo-h,auto);object-fit:contain}
.brand-name{font-size:24px;font-weight:900;line-height:1.1;letter-spacing:-.3px}
.c-vert{color:#008751}.c-rouge{color:#E8112D}
.brand-benin{font-size:9px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:2px}
.brand-slogan{font-size:9.5px;font-weight:700;margin-top:5px;max-width:260px;line-height:1.4}
.meta{text-align:right}
.meta-type{font-size:20px;font-weight:900;color:#008751;letter-spacing:1px}
.meta-sub{font-size:12px;font-weight:800;color:#E8112D;margin-top:5px;text-transform:uppercase}
.meta-ref{font-size:12px;font-weight:700;margin-top:6px;font-family:monospace}
.meta-date{font-size:11px;font-weight:700;margin-top:5px}
.body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:12px 32px 14px}
.footer{margin-top:auto;padding:10px 32px 14px;text-align:center;border-top:2px solid #dde3ee;flex-shrink:0}
.footer-info{font-size:9.5px;font-weight:900;line-height:1.5}
.footer-ref{font-size:8.5px;font-weight:800;margin-top:3px;color:#5b6778}
.titre{font-size:15px;font-weight:800;color:#12462f;line-height:1.3;margin-bottom:10px}
.dossier{background:#f6f8fa;border:1px solid #d5dce4;padding:9px 14px;font-size:10.5px;margin-bottom:6px}
.dossier .l{display:flex;justify-content:space-between;align-items:center;gap:12px}
.dossier .l+.l{margin-top:7px}
.dossier b{font-weight:800}
.mono{font-family:monospace;font-size:11px;font-weight:700}
.sec{margin-top:12px}
.sec-title{font-size:12px;font-weight:800;color:#12462f;text-transform:uppercase;padding-bottom:5px;border-bottom:2px solid #12462f;margin-bottom:8px;letter-spacing:.2px}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
th,td{border:1px solid #c9d1db;padding:7px 9px;text-align:left;vertical-align:middle;overflow-wrap:anywhere}
thead th{background:#12462f;color:#fff;font-weight:800;font-size:10.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td.lab{background:#f6f8fa;font-weight:800;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td.c{text-align:center}
.opts{display:flex;flex-wrap:wrap;gap:4px 16px}
.opts+.opts{margin-top:5px}
.opt{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.cb{display:inline-block;width:10px;height:10px;border:1.3px solid #3a4656;border-radius:2px;position:relative;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cb.on{background:#12462f;border-color:#12462f}
.cb.on::after{content:'';position:absolute;left:2.4px;top:0;width:3px;height:6px;border:solid #fff;border-width:0 1.6px 1.6px 0;transform:rotate(45deg)}
.texte{border:1px solid #c9d1db;padding:2px 12px 6px;min-height:118px;font-size:10.5px;line-height:22px;white-space:pre-wrap;overflow-wrap:anywhere;
  background-image:linear-gradient(to right,#fff 50%,transparent 50%),linear-gradient(to bottom,transparent 21px,#b9c4d1 21px);
  background-size:8px 22px,100% 22px;background-position:0 2px,0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.texte p{min-height:22px}
.suite{font-weight:700;text-transform:none;color:#5b6778}
@page{size:A4;margin:0}
@media print{
  body{background:#fff}
  .actions{display:none}
  .page{box-shadow:none;margin:0;page-break-after:always;break-after:page}
  .page:last-child{page-break-after:auto;break-after:auto}
}
`

// Mise en pages, exécutée dans le navigateur.
const SCRIPT = `
(function(){
  var tpl=document.getElementById('tpl-page'),src=document.getElementById('src').content,
      pages=document.getElementById('pages'),body;
  function nouvellePage(){var p=tpl.content.firstElementChild.cloneNode(true);pages.appendChild(p);body=p.querySelector('.body');}
  function deborde(){return body.scrollHeight>body.clientHeight+1;}
  function marquerSuite(sec){var t=sec.querySelector('.sec-title');var s=document.createElement('span');s.className='suite';s.textContent=' (suite)';t.appendChild(s);}
  function placer(el){body.appendChild(el);if(deborde()&&body.children.length>1){body.removeChild(el);nouvellePage();body.appendChild(el);}}
  function placerLignes(blk,sel,conteneur,couper){
    var items=Array.prototype.slice.call(blk.querySelectorAll(sel)),i=0,suite=false;
    for(;;){
      var sec=blk.cloneNode(true),box=sec.querySelector(conteneur);box.innerHTML='';
      if(suite)marquerSuite(sec);
      body.appendChild(sec);
      var mis=0;
      while(i<items.length){
        var it=items[i].cloneNode(true);box.appendChild(it);
        if(!deborde()){i++;mis++;continue;}
        box.removeChild(it);
        if(couper){var reste=couper(box,items[i]);if(reste){items[i]=reste;mis++;}}
        break;
      }
      if(mis===0){
        body.removeChild(sec);
        if(body.children.length===0){box.appendChild(items[i].cloneNode(true));body.appendChild(sec);i++;}
        else{nouvellePage();continue;}
      }
      if(i>=items.length)return;
      nouvellePage();suite=true;
    }
  }
  function couperParagraphe(box,p){
    var mots=p.textContent.split(' '),essai=document.createElement('p'),lo=0,hi=mots.length-1;
    box.appendChild(essai);
    while(lo<hi){var mid=Math.ceil((lo+hi)/2);essai.textContent=mots.slice(0,mid).join(' ');if(deborde())hi=mid-1;else lo=mid;}
    if(lo===0){box.removeChild(essai);return null;}
    essai.textContent=mots.slice(0,lo).join(' ');
    var reste=document.createElement('p');reste.textContent=mots.slice(lo).join(' ');return reste;
  }
  // Un bloc qui tient en entier sur la page courante ou sur une page neuve n'est jamais coupé.
  function entier(blk){
    var el=blk.cloneNode(true);body.appendChild(el);if(!deborde())return true;
    body.removeChild(el);if(body.children.length===0)return false;
    var essai=tpl.content.firstElementChild.cloneNode(true);pages.appendChild(essai);
    var b=essai.querySelector('.body');b.appendChild(el);
    if(b.scrollHeight<=b.clientHeight+1){body=b;return true;}
    pages.removeChild(essai);return false;
  }
  function demarrer(){
    nouvellePage();
    Array.prototype.forEach.call(src.children,function(blk){
      var mode=blk.getAttribute('data-split');
      if(mode&&entier(blk))return;
      if(mode==='table')placerLignes(blk,'tbody tr','tbody',null);
      else if(mode==='text')placerLignes(blk,'.texte p','.texte',couperParagraphe);
      else placer(blk.cloneNode(true));
    });
    var toutes=pages.querySelectorAll('.page');
    for(var k=0;k<toutes.length;k++)toutes[k].querySelector('.num').textContent='Page '+(k+1)+' sur '+toutes.length;
    document.documentElement.setAttribute('data-pages',String(toutes.length));
  }
  var logo=new Image();
  logo.onload=function(){document.documentElement.style.setProperty('--logo-h',(95*logo.naturalHeight/logo.naturalWidth)+'px');pret();};
  logo.onerror=function(){document.documentElement.classList.add('sans-logo');pret();};
  function pret(){if(document.fonts&&document.fonts.ready)document.fonts.ready.then(demarrer);else demarrer();}
  logo.src=document.getElementById('tpl-page').getAttribute('data-logo');
})();
`

type Imprimable = Omit<FicheSuivi, 'statut_dossier'> & { statut_dossier: FicheSuivi['statut_dossier'] | null }

// Modèle vierge à remplir à la main : aucune case cochée, numéro et dates en pointillés.
export const FICHE_VIERGE: Imprimable = {
    id: '', numero: '', client_id: null, source: 'manuel', date_fiche: '', statut_dossier: null, date_depot: null,
    nom_complet: null, telephone: null, email: null, pays: null, ville: null, canaux: [],
    reclamation_statut: null, date_etat_lieux: null, observation: null,
    accueil_statut: null, accueil_date_reclamation: null, accueil_date_reception: null,
    frais_statut: null, frais_date: null, frais_justificatif: false, pieces: [], analyse_suivi: null,
    guichet_statut: null, guichet_date: null, ceremonie_statut: null, ceremonie_date: null, created_at: '', updated_at: '',
}

export function ficheSuiviHtml(f: Imprimable, opts: { logoUrl: string; genereLe: Date }): string {
    const genere = f.numero ? opts.genereLe.toLocaleDateString('fr-FR', { timeZone: 'Africa/Porto-Novo' }) : VIDE
    const dateLongue = f.date_fiche
        ? new Date(f.date_fiche + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        : '_____________________'
    const numero = e(f.numero || 'RGB-20___-______')

    const pieces = [...(f.pieces || [])]
    // Comme le modèle : au moins 5 lignes, les vides restent à remplir à la main.
    const lignesPieces = pieces.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${p.date ? dateFr(p.date) : ''}</td><td>${e(p.piece)}</td><td>${cases('piece_statut', p.statut, [['recue', 'conforme'], ['attente']])}</td></tr>`)
    for (let i = pieces.length; i < 5; i++)
        lignesPieces.push(`<tr><td class="c">${i + 1}</td><td></td><td></td><td>${cases('piece_statut', null, [['recue', 'conforme'], ['attente']])}</td></tr>`)

    const paragraphes = (f.analyse_suivi || '').split(/\r?\n/)
    while (paragraphes.length < 5) paragraphes.push('')

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche de suivi ${numero}</title>
<style>${CSS}
.sans-logo .logo{display:none}</style></head>
<body>
<div class="actions"><button class="btn btn-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>

<template id="tpl-page" data-logo="${e(opts.logoUrl)}"><div class="page">
  <div class="flag-stripe"><div class="flag-g"></div><div class="flag-j"></div><div class="flag-r"></div></div>
  <div class="header">
    <div class="brand">
      <img class="logo" src="${e(opts.logoUrl)}" alt="Retour Gagnant Bénin">
      <div class="brand-text">
        <div class="brand-name"><span class="c-vert">RETOUR </span><span class="c-rouge">GAGNANT</span></div>
        <div class="brand-benin">Bénin</div>
        <div class="brand-slogan">L'agence d'accompagnement à la Nationalité Béninoise et au retour des Afro-descendants.</div>
      </div>
    </div>
    <div class="meta">
      <div class="meta-type">FICHE DE SUIVI CLIENT</div>
      <div class="meta-sub">Nationalité béninoise</div>
      <div class="meta-ref">N° ${numero}</div>
      <div class="meta-date">Date : Cotonou, le ${e(dateLongue)}</div>
    </div>
  </div>
  <div class="body"></div>
  <div class="footer">
    <div class="footer-info">RETOUR GAGNANT BENIN - RCCM: RB/COT/26 B 42001 - IFU: 3202644573981 - Haie-Vive Cocotiers, Cotonou - contact@retourgagnantbenin.bj</div>
    <div class="footer-ref">Fiche de Suivi Client N° ${numero} : Générée le ${e(genere)} · <span class="num"></span></div>
  </div>
</div></template>

<template id="src">
<div class="blk">
  <div class="titre">Demande de Nationalité Béninoise et Accompagnement Administratif à l'Obtention de la Nationalité</div>
  <div class="dossier">
    <div class="l"><span><b>Dossier N° :</b> <span class="mono">${numero}</span></span><span><b>Date :</b> ${dateFr(f.date_fiche)}</span></div>
    <div class="l"><span style="display:flex;align-items:center;gap:10px"><b>Statut :</b>${cases('statut_dossier', f.statut_dossier)}</span><span><b>Date du dépôt :</b> ${dateFr(f.date_depot)}</span></div>
  </div>
</div>

<div class="blk sec">
  <div class="sec-title">1. Identité et localisation du client</div>
  <table><colgroup><col style="width:36%"><col></colgroup><tbody>
    <tr><td class="lab">Nom et Prénom(s)</td><td>${e(f.nom_complet)}</td></tr>
    <tr><td class="lab">Téléphone / WhatsApp<br>&amp; E-mail</td><td>${e(f.telephone)}${f.telephone && f.email ? '<br>' : ''}${e(f.email)}</td></tr>
    <tr><td class="lab">Localisation actuelle (Pays / Ville)</td><td>${e([f.pays, f.ville].filter(Boolean).join(' / '))}</td></tr>
    <tr><td class="lab">Canal de contact</td><td>${canaux(f.canaux || [])}</td></tr>
  </tbody></table>
</div>

<div class="blk sec">
  <div class="sec-title">2. Réclamation — Dossier déjà introduit sur MyAfroOrigins</div>
  <table><colgroup><col style="width:36%"><col></colgroup><tbody>
    <tr><td class="lab">Statut de la réclamation</td><td>${cases('reclamation_statut', f.reclamation_statut, [['aucune', 'aucune_3m'], ['aucune_6m'], ['attestation']])}</td></tr>
    <tr><td class="lab">Date état des lieux du dossier</td><td>${dateFr(f.date_etat_lieux)}</td></tr>
    <tr><td class="lab">Observation</td><td style="white-space:pre-wrap">${e(f.observation)}</td></tr>
  </tbody></table>
</div>

<div class="blk sec">
  <div class="sec-title">3. Demande de nationalité béninoise &amp; paiements</div>
  <table><colgroup><col style="width:28%"><col style="width:35%"><col style="width:17%"><col style="width:20%"></colgroup>
    <thead><tr><th>Rubrique</th><th>Statut</th><th>Date réclamation</th><th>Date de réception</th></tr></thead>
    <tbody>
      <tr><td class="lab">Accueil &amp; accompagnement à la demande de nationalité</td><td>${cases('accueil_statut', f.accueil_statut, [['complet'], ['partiel'], ['attente']])}</td><td class="c">${dateFr(f.accueil_date_reclamation)}</td><td class="c">${dateFr(f.accueil_date_reception)}</td></tr>
      <tr><td class="lab">Frais MyAfroOrigins (Paiement)</td><td>${cases('frais_statut', f.frais_statut, [['recu', 'verifie'], ['attente']])}</td><td>Date :<br>${dateFr(f.frais_date)}</td><td><span class="opt"><span class="cb${f.frais_justificatif ? ' on' : ''}"></span>Justificatif</span></td></tr>
    </tbody></table>
</div>

<div class="blk sec" data-split="table">
  <div class="sec-title">4. Liste des pièces réclamées au client</div>
  <table><colgroup><col style="width:7%"><col style="width:17%"><col style="width:45%"><col style="width:31%"></colgroup>
    <thead><tr><th>N°</th><th>Date</th><th>Pièce(s) réclamée(s)</th><th>Statut</th></tr></thead>
    <tbody>${lignesPieces.join('')}</tbody></table>
</div>

<div class="blk sec" data-split="text">
  <div class="sec-title">5. Analyse et observations du suivi du dossier RGB</div>
  <div class="texte">${paragraphes.map(p => `<p>${e(p)}</p>`).join('')}</div>
</div>

<div class="blk sec">
  <div class="sec-title">6. Accompagnement final &amp; cérémonie officielle</div>
  <table><colgroup><col style="width:44%"><col style="width:37%"><col style="width:19%"></colgroup>
    <thead><tr><th>Étape d'accompagnement</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>
      <tr><td class="lab">Accompagnement au Guichet Unique (Enrôlement)</td><td>${cases('guichet_statut', f.guichet_statut, [['programme', 'effectue'], ['attente']])}</td><td class="c">${dateFr(f.guichet_date)}</td></tr>
      <tr><td class="lab">Accompagnement &amp; inscription à la remise officielle de la cérémonie</td><td>${cases('ceremonie_statut', f.ceremonie_statut, [['inscrit', 'remise'], ['attente']])}</td><td class="c">${dateFr(f.ceremonie_date)}</td></tr>
    </tbody></table>
</div>
</template>

<div id="pages"></div>
<script>${SCRIPT}</script>
</body></html>`
}
