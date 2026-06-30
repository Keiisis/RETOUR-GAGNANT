import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/security'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch settings (grilles_tarifaires)
        const { data: settingsData } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'grilles_tarifaires')
            .maybeSingle()

        // 2. Fetch signature details
        const { data: templateData } = await supabase
            .from('document_templates')
            .select('content')
            .eq('id', 'official_devis_facture')
            .maybeSingle()

        const tpl = templateData?.content || {}
        const presidentName = tpl.signature_name || 'N. R. G'

        // Default layout data if settings are empty
        const defaultGrids = [
            {
                id: 'documents-identite',
                title: 'DOCUMENTS & IDENTITÉ',
                rows: [
                    { no: '1', service: 'Acte de naissance béninois (sécurisé)', details: 'Copie intégrale certifiée conforme', unit: 'Par document', price: '15 000 FCFA / 23 €', delay: '72h' },
                    { no: '2', service: 'Passeport Biométrique Béninois', details: 'Demande complète, photos, suivi', unit: 'Par demande', price: '75 000 FCFA / 115 €', delay: '10 à 15 jours' },
                    { no: '3', service: 'Carte Nationale d\'Identité (CNIB)', details: 'Inscription, prise d\'empreintes, retrait', unit: 'Par demande', price: '30 000 FCFA / 46 €', delay: '5 à 7 jours' },
                    { no: '4', service: 'Certificat d\'Identification Personnelle (CIP)', details: 'Vérification d\'identité officielle', unit: 'Par document', price: '10 000 FCFA / 15 €', delay: '48h' },
                    { no: '5', service: 'Casier Judiciaire Béninois', details: 'Extrait de casier judiciaire B3', unit: 'Par document', price: '12 000 FCFA / 18 €', delay: '72h' }
                ]
            }
        ]

        let grids = defaultGrids
        if (settingsData?.value) {
            try {
                const parsed = JSON.parse(settingsData.value)
                // Normalize older schema structure (price, unit, delay) to the new structure (price_fcfa, price_eur)
                grids = parsed.map((grid: any) => ({
                    ...grid,
                    rows: grid.rows.map((row: any) => {
                        let price_fcfa = row.price_fcfa || ''
                        let price_eur = row.price_eur || ''
                        if (!price_fcfa && row.price) {
                            const parts = row.price.split('/')
                            price_fcfa = parts[0]?.trim() || ''
                            price_eur = parts[1]?.trim() || ''
                        }
                        return {
                            no: row.no || '',
                            service: row.service || '',
                            details: row.details || '',
                            price_fcfa,
                            price_eur,
                            options: row.options || undefined
                        }
                    })
                }))
            } catch (e) {
                console.error('Error parsing grilles_tarifaires settings:', e)
            }
        } else {
            // Normalize default grids
            grids = defaultGrids.map((grid: any) => ({
                ...grid,
                rows: grid.rows.map((row: any) => {
                    const parts = row.price.split('/')
                    return {
                        no: row.no,
                        service: row.service,
                        details: row.details,
                        price_fcfa: parts[0]?.trim() || '',
                        price_eur: parts[1]?.trim() || ''
                    }
                })
            }))
        }

        // Filter if gridId is provided
        const url = new URL(request.url)
        const gridId = url.searchParams.get('gridId')
        if (gridId) {
            grids = grids.filter(g => g.id === gridId)
        }

        if (grids.length === 0) {
            return new NextResponse('Aucune grille tarifaire trouvée.', { status: 404 })
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        const logoUrl = `${baseUrl}/images/logo-transparent.png`
        const stampUrl = `${baseUrl}/images/cachet-PDG.png`
        const date = new Date().toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric',
        })

        const gridsHtml = grids.map((grid) => {
            const gridRef = `GRI-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${grid.id.toUpperCase().slice(0, 8)}`

            const totalLines = grid.rows.reduce((acc: number, r: any) => {
                if (r.options && r.options.length > 0) {
                    return acc + r.options.length
                }
                return acc + 1
            }, 0)

            // Calculate total text length in table to assess density
            let totalTextLength = 0
            grid.rows.forEach((row: any) => {
                totalTextLength += (row.service || '').length
                totalTextLength += (row.details || '').length
                if (row.options) {
                    row.options.forEach((opt: any) => {
                        totalTextLength += (opt.label || '').length
                    })
                }
            })

            // Spacing variables to scale dynamically
            let introFontSize = '11px'
            let introLineHeight = '1.55'
            let introPadding = '10px 0 6px'
            let cellPadding = '6px 10px'
            let cellFontSize = '10.5px'
            let cellLineHeight = '1.35'
            let sigPadding = '8px 0 0'
            let sigMinHeight = '80px'
            let sigPaddingInternal = '10px 14px'
            let tableMarginTopBottom = 'auto'

            if (totalLines > 11) {
                introFontSize = '10px'
                introLineHeight = '1.4'
                introPadding = '5px 0 3px'
                cellPadding = '6px 10px'
                cellFontSize = '9.5px'
                cellLineHeight = '1.3'
                sigPadding = '5px 0 0'
                sigMinHeight = '70px'
                sigPaddingInternal = '8px 12px'
            } else if (totalLines > 8) {
                introFontSize = '12px'
                introLineHeight = '1.6'
                introPadding = '10px 0 6px'
                cellPadding = '9px 14px'
                cellFontSize = '11px'
                cellLineHeight = '1.4'
                sigPadding = '8px 0 0'
                sigMinHeight = '80px'
                sigPaddingInternal = '10px 14px'
            } else {
                introFontSize = '13.5px'
                introLineHeight = '1.8'
                introPadding = '18px 0 12px'
                cellPadding = '12px 16px'
                cellFontSize = '12px'
                cellLineHeight = '1.5'
                sigPadding = '15px 0 0'
                sigMinHeight = '90px'
                sigPaddingInternal = '12px 14px'
            }

            const rowsHtml = grid.rows.map((row: any) => {
                // If there are sub-options, we render using rowspan
                if (row.options && row.options.length > 0) {
                    const n = row.options.length
                    const firstOption = row.options[0]
                    const firstRowHtml = `
                    <tr>
                        <td rowspan="${n}" class="center bold">${escapeHtml(row.no)}</td>
                        <td rowspan="${n}" class="bold">${escapeHtml(row.service)}</td>
                        <td class="details-cell">${escapeHtml(firstOption.label || '')}</td>
                        <td class="right bold price-cell">${escapeHtml(firstOption.price_fcfa)}</td>
                        <td class="right bold price-cell" style="color: #000 !important;">${escapeHtml(firstOption.price_eur)}</td>
                    </tr>
                    `
                    
                    const otherRowsHtml = row.options.slice(1).map((opt: any) => {
                        return `
                        <tr>
                            <td class="details-cell">${escapeHtml(opt.label || '')}</td>
                            <td class="right bold price-cell">${escapeHtml(opt.price_fcfa)}</td>
                            <td class="right bold price-cell" style="color: #000 !important;">${escapeHtml(opt.price_eur)}</td>
                        </tr>
                        `
                    }).join('')
                    
                    return firstRowHtml + otherRowsHtml
                }

                // Default standard row
                return `
                <tr>
                    <td class="center bold">${escapeHtml(row.no)}</td>
                    <td class="bold">${escapeHtml(row.service)}</td>
                    <td class="details-cell">${escapeHtml(row.details || '')}</td>
                    <td class="right bold price-cell">${escapeHtml(row.price_fcfa)}</td>
                    <td class="right bold price-cell" style="color: #000 !important;">${escapeHtml(row.price_eur)}</td>
                </tr>
                `
            }).join('')

            return `
            <div class="page" style="--intro-font-size:${introFontSize}; --intro-line-height:${introLineHeight}; --intro-padding:${introPadding}; --cell-padding:${cellPadding}; --cell-font-size:${cellFontSize}; --cell-line-height:${cellLineHeight}; --sig-padding:${sigPadding}; --sig-min-height:${sigMinHeight}; --sig-padding-internal:${sigPaddingInternal}; --table-margin-top-bottom:${tableMarginTopBottom};">
                <!-- RUBAN DRAPEAU BÉNIN -->
                <div class="flag-stripe">
                    <div class="flag-g"></div>
                    <div class="flag-j"></div>
                    <div class="flag-r"></div>
                </div>

                <!-- ENTÊTE -->
                <div class="header">
                    <div class="brand">
                        <img src="${logoUrl}" alt="RETOUR GAGNANT" class="logo" onerror="this.style.display='none'" />
                        <div class="brand-text">
                            <div class="brand-name">
                                <span class="c-vert">RETOUR </span><span class="c-rouge">GAGNANT</span>
                            </div>
                            <div class="brand-benin">Bénin</div>
                            <div class="brand-slogan">L'agence d'accompagnement à la Nationalité Béninoise et au retour des Afro-descendants.</div>
                        </div>
                    </div>
                    <div class="meta">
                        <div class="meta-type">GRILLES TARIFAIRES</div>
                        <div class="meta-sub">${escapeHtml(grid.title)}</div>
                        <div class="meta-ref">N° ${gridRef}</div>
                        <div class="meta-date">Date : Cotonou, le ${date}</div>
                    </div>
                </div>

                <!-- CORPS -->
                <div class="body">
                    <!-- TEXTE INTRODUCTIF - occupe l'espace du haut -->
                    <div class="intro">
                        Retour Gagnant Bénin est le partenaire stratégique de référence dédié à la réussite absolue de votre retour et de votre établissement au Bénin. De l'acquisition rigoureuse de votre nationalité béninoise à la sécurisation de vos projets de vie et d'investissement, notre agence déploie une expertise d'excellence pour chacun de vos besoins administratifs et juridiques. C'est avec le plus haut niveau d'engagement que nous vous présentons ci-dessous la grille tarifaire officielle de nos prestations pour le pôle <strong>${escapeHtml(grid.title)}</strong>.
                    </div>

                    <!-- TABLEAU CENTRÉ AU MILIEU DE LA FEUILLE -->
                    <div class="table-center">
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th class="center" style="width:40px">N°</th>
                                        <th style="width:32%">Service / Prestation</th>
                                        <th style="width:32%">Détails inclus</th>
                                        <th class="right" style="width:18%">Tarif (FCFA)</th>
                                        <th class="right" style="width:18%">Tarif (EUR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- ZONE SIGNATURE EN BAS À DROITE -->
                    <div class="sig-zone">
                        <div class="sig-box">
                            <div class="sig-text">
                                <div class="sig-title">DIRECTION GÉNÉRALE</div>
                                <div class="sig-company">RETOUR GAGNANT BÉNIN</div>
                                <div class="sig-label">La Présidente Directrice Générale :</div>
                                <div class="sig-name">${escapeHtml(presidentName)}</div>
                                <div class="sig-sub">Signature et Cachet officiel</div>
                                <div class="sig-date">Fait à Cotonou, Le ${date}</div>
                                <div class="sig-valid">Validité officielle garantie</div>
                            </div>
                            <img src="${stampUrl}" alt="Cachet" class="cachet" onerror="this.style.display='none'" />
                        </div>
                    </div>
                </div>

                <!-- PIED DE PAGE -->
                <div class="footer">
                    <p class="footer-info">RETOUR GAGNANT BENIN - RCCM: RB/COT/26 B 42001 - IFU: 3202644573981 - Haie-Vive Cocotiers, Cotonou - contact@retourgagnantbenin.bj</p>
                    <p class="footer-ref">Document N° ${gridRef} — Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
                </div>
            </div>
            `
        }).join('')

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Grilles Tarifaires — Retour Gagnant Bénin</title>
  <style>
    /* ===== RESET ===== */
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#e8edf2;color:#000}

    /* ===== BOUTON TÉLÉCHARGER ===== */
    .actions{max-width:210mm;margin:18px auto 0;display:flex;justify-content:flex-end;gap:10px}
    .btn{padding:11px 28px;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .2s}
    .btn-print{background:#008751;color:#fff;box-shadow:0 4px 12px rgba(0,135,81,.2)}
    .btn-print:hover{background:#006b40;transform:translateY(-1px)}

    /* ===== FEUILLE A4 ===== */
    .page{
      width:210mm;
      height:297mm;
      max-height:297mm;
      margin:18px auto 36px;
      background:#fff;
      position:relative;
      display:flex;
      flex-direction:column;
      box-shadow:0 8px 40px rgba(0,0,0,.08);
      overflow:hidden;
      padding-top:8mm; /* Marge haute de sécurité pour que le ruban tricolore apparaisse sur le papier imprimé */
    }

    /* ===== RUBAN DRAPEAU ===== */
    .flag-stripe{
      display:flex;
      height:6px;
      flex-shrink:0;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }
    .flag-g{
      flex:1;
      height:100%;
      background:#008751 !important;
      border-top:6px solid #008751 !important;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }
    .flag-j{
      flex:1;
      height:100%;
      background:#FCD116 !important;
      border-top:6px solid #FCD116 !important;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }
    .flag-r{
      flex:1;
      height:100%;
      background:#E8112D !important;
      border-top:6px solid #E8112D !important;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }

    /* ===== ENTÊTE ===== */
    .header{
      display:flex;justify-content:space-between;align-items:center;
      padding:12px 32px 10px;
      border-bottom:2.5px solid #008751;
      flex-shrink:0;
    }
    .brand{display:flex;align-items:center;gap:18px}

    /* Logo libre, sans fond noir, sans cadre */
    .logo{
      width:95px;height:auto;
      object-fit:contain;
      display:block;
      background:transparent !important;
      border:none !important;
      box-shadow:none !important;
      border-radius:0 !important;
      padding:0 !important;
    }

    .brand-name{font-size:24px;font-weight:900;line-height:1.1;letter-spacing:-.3px}
    .c-vert{color:#008751}
    .c-rouge{color:#E8112D}
    .brand-benin{font-size:9px;font-weight:800;color:#000;letter-spacing:3px;text-transform:uppercase;margin-top:2px}
    .brand-slogan{font-size:9.5px;color:#000;margin-top:5px;max-width:260px;line-height:1.4;font-weight:700}

    .meta{text-align:right}
    .meta-type{font-size:20px;font-weight:900;color:#008751;letter-spacing:1px}
    .meta-sub{font-size:12px;font-weight:800;color:#E8112D;margin-top:5px;text-transform:uppercase}
    .meta-ref{font-size:12px;font-weight:700;color:#000;margin-top:6px;font-family:monospace}
    .meta-date{font-size:11px;color:#000;margin-top:5px;font-weight:700}

    /* ===== CORPS ===== */
    .body{
      flex:1;
      display:flex;
      flex-direction:column;
      padding:0 32px;
      padding-bottom:24px;
    }

    /* Texte introductif - occupe l'espace du haut, bien aéré et espacé */
    .intro{
      font-size: var(--intro-font-size, 11px);
      line-height: var(--intro-line-height, 1.55);
      color:#000;
      padding: var(--intro-padding, 10px 0 6px);
      text-align:justify;
      font-weight:700;
      flex-shrink:0;
    }

    /* ===== TABLEAU CENTRÉ AU MILIEU ===== */
    .table-center{
      margin: var(--table-margin-top-bottom, auto) 0;
      width:100%;
    }

    .table-wrap{
      border:2px solid #000;
      border-radius:8px;
      overflow:hidden;
      width:100%;
    }
    table{width:100%;border-collapse:collapse}
    thead tr{
      background:#008751 !important;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }
    thead th{padding: var(--cell-padding, 7px 10px);font-size: calc(var(--cell-font-size, 10.5px) - 1px);font-weight:900;text-transform:uppercase;letter-spacing:.7px;color:#fff;text-align:left}
    thead th.right{text-align:right}
    thead th.center{text-align:center}

    tbody tr{background:#fff;border-bottom:1.5px solid #000;page-break-inside:avoid;break-inside:avoid}
    tbody tr:last-child{border-bottom:none}
    tbody tr:nth-child(even){
      background:#f8fafc !important;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }

    tbody td{padding: var(--cell-padding, 6px 10px);font-size: var(--cell-font-size, 10.5px);color:#000;line-height: var(--cell-line-height, 1.35);vertical-align:middle}
    tbody td.right{text-align:right}
    tbody td.center{text-align:center}
    .bold{font-weight:700}
    .details-cell{font-weight:600;color:#333;font-size: var(--cell-font-size, 10.5px);font-style:italic}
    .price-cell{
      color:#008751 !important;
      font-weight:900;
      font-size: calc(var(--cell-font-size, 10.5px) + 1px);
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }

    /* ===== ZONE SIGNATURE - en bas à droite, identique à la facture ===== */
    .sig-zone{
      flex-shrink:0;
      display:flex;
      justify-content:flex-end;
      padding: var(--sig-padding, 8px 0 0);
      page-break-inside:avoid;
      break-inside:avoid;
    }

    /* Cadre vert — dimensions facture */
    .sig-box{
      border:1px solid #008751;
      border-radius:8px;
      padding: var(--sig-padding-internal, 10px 14px);
      background:#f0fff6 !important;
      min-height: var(--sig-min-height, 80px);
      position:relative;
      width:370px;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }

    .sig-text{
      position:relative;
      z-index:1;
    }
    .sig-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#006b40;margin-bottom:4px}
    .sig-company{font-size:8px;font-weight:700;color:#008751;margin-bottom:8px}
    .sig-label{font-size:8px;font-weight:700;color:#000;margin-bottom:2px}
    .sig-name{font-size:12px;font-weight:800;color:#008751;margin-top:2px;margin-bottom:4px}
    .sig-sub{font-size:9px;color:#667;margin-bottom:2px}
    .sig-date{font-size:9px;color:#888;margin-top:4px}
    .sig-valid{font-size:7.5px;font-weight:800;text-transform:uppercase;color:#008751;letter-spacing:0.5px;margin-top:4px}

    /* Cachet 200px — mix-blend-mode:multiply rend le blanc invisible, comme un vrai tampon */
    .cachet{
      position:absolute;
      right:5px;
      top:38%;
      transform:translateY(-50%);
      width:250px;
      height:250px;
      object-fit:contain;
      mix-blend-mode:multiply;
      opacity:.95;
    }

    /* ===== PIED DE PAGE ===== */
    .footer{
      margin-top:auto;
      background:#fff;
      padding:10px 32px 14px; /* Grand padding bas pour éviter la coupure par l'imprimante */
      text-align:center;
      border-top:2px solid #dde3ee;
    }
    .footer-info{font-size:9.5px;font-weight:900;color:#000;line-height:1.5;margin-bottom:3px}
    .footer-ref{font-size:8.5px;font-weight:800;color:#000}

    /* ===== IMPRESSION / PDF ===== */
    @page{size:A4;margin:0}

    @media print{
      body{background:#fff}
      .actions{display:none !important}
      .page{
        box-shadow:none;
        margin:0;
        width:210mm;
        height:297mm;
        max-height:297mm;
        overflow:hidden;
        page-break-after:always;
        break-after:page;
        padding-top:8mm !important;
      }
      .page:last-child{page-break-after:avoid;break-after:avoid}
      .flag-stripe,.flag-g,.flag-j,.flag-r{
        -webkit-print-color-adjust:exact !important;
        print-color-adjust:exact !important;
      }
      .flag-g{background:#008751 !important;border-top:6px solid #008751 !important}
      .flag-j{background:#FCD116 !important;border-top:6px solid #FCD116 !important}
      .flag-r{background:#E8112D !important;border-top:6px solid #E8112D !important}
      thead tr{
        -webkit-print-color-adjust:exact !important;
        print-color-adjust:exact !important;
        background:#008751 !important;
      }
      thead th{
        color:#fff !important;
      }
      .sig-box{
        -webkit-print-color-adjust:exact !important;
        print-color-adjust:exact !important;
        background:#f0fff6 !important;
        border-color:#008751 !important;
      }
      tbody tr:nth-child(even){
        -webkit-print-color-adjust:exact !important;
        print-color-adjust:exact !important;
        background:#f8fafc !important;
      }
      .price-cell{
        -webkit-print-color-adjust:exact !important;
        print-color-adjust:exact !important;
        color:#008751 !important;
      }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">🖨&nbsp; Télécharger / Imprimer la Grille</button>
  </div>
  
  ${gridsHtml}
</body>
</html>`

        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        console.error('Grille print error:', err)
        return new NextResponse('Erreur lors de la génération de la grille tarifaire.', { status: 500 })
    }
}
