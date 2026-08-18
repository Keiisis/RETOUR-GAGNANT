// ══════════════════════════════════════════════════════════════
//  GET /api/tickets/[code] : le BILLET rendu, QR compris.
//
//  Le design du billet est fourni par l'équipe et stocké en base (voir
//  lib/event-tickets → getTicketTemplate) : global, ou spécifique à un
//  événement. Le QR est injecté AUTOMATIQUEMENT à l'emplacement du marqueur
//  {{QR_CODE}} du design, en data URI — le billet reste donc un fichier
//  autonome, affichable et téléchargeable hors ligne.
//
//  ?format=html  (défaut) page complète, imprimable / « Enregistrer en PDF »
//  ?format=png   image du QR seul (utile pour un aperçu compact)
//
//  Le code du billet fait office de secret de consultation : il est aléatoire
//  (4 octets) et ne révèle que les informations du porteur. Aucune donnée
//  d'autres invités n'est accessible.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTicketTemplate, renderTicketTemplate, qrDataUri } from '@/lib/event-tickets'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const dateFr = (iso?: string | null) => iso
    ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
    : ''

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params
    const ticketCode = decodeURIComponent(code || '').trim()
    if (!ticketCode) return NextResponse.json({ error: 'Code manquant.' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') || 'html').toLowerCase()

    const { data: ticket } = await supabase
        .from('event_tickets')
        .select('ticket_code, qr_data, ticket_type, is_used, used_at, event_id, registration_id')
        .eq('ticket_code', ticketCode)
        .maybeSingle()

    if (!ticket) return NextResponse.json({ error: 'Billet introuvable.' }, { status: 404 })

    const qrUri = await qrDataUri(ticket.qr_data, 420)
    if (format === 'png') {
        const base64 = qrUri.split(',')[1] || ''
        return new NextResponse(Buffer.from(base64, 'base64'), {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' },
        })
    }

    const [{ data: reg }, { data: event }] = await Promise.all([
        supabase.from('event_registrations')
            // Pas de client_id sur cette table (schéma déployé) : l'inscription
            // porte elle-même l'identité de l'invité.
            .select('full_name, email, phone')
            .eq('id', ticket.registration_id).maybeSingle(),
        supabase.from('events')
            .select('title, start_date, location')
            .eq('id', ticket.event_id).maybeSingle(),
    ])

    const fullName = String(reg?.full_name || '').trim()
    const email = String(reg?.email || '').trim()
    const phone = String(reg?.phone || '').trim()

    const template = await getTicketTemplate(supabase, ticket.event_id)
    const corps = renderTicketTemplate(template, {
        ticket_code: ticket.ticket_code,
        qr_uri: qrUri,
        full_name: fullName || 'Invité',
        email,
        phone,
        ticket_type: ticket.ticket_type === 'vip' ? 'VIP' : 'Standard',
        event_title: String(event?.title || 'Événement'),
        event_date: dateFr(event?.start_date),
        event_location: String(event?.location || ''),
    })

    const usedBanner = ticket.is_used
        ? `<div style="max-width:720px;margin:0 auto 14px;padding:12px 16px;border-radius:12px;background:#FDECEA;border:1px solid #E8112D;color:#8A1020;font:600 13px ui-sans-serif,system-ui,sans-serif">
             Ce billet a déjà été scanné${ticket.used_at ? ` le ${dateFr(ticket.used_at)}` : ''}. Il n'est plus valable pour entrer.
           </div>` : ''

    const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Billet ${ticket.ticket_code}</title>
<style>
  body { margin:0; padding:24px 16px; background:#F3F6F4;
         font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; }

  .rgb-actions { max-width:760px; margin:0 auto 16px; display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end }
  .rgb-actions button { display:inline-flex; align-items:center; gap:7px; border:0; border-radius:999px;
    padding:11px 20px; font:700 13px inherit; cursor:pointer; }
  .rgb-btn-dl { background:#008751; color:#fff }
  .rgb-btn-print { background:#fff; color:#101A14; box-shadow:inset 0 0 0 1px #D9E2DC }
  .rgb-actions button:disabled { opacity:.55; cursor:progress }
  .rgb-hint { max-width:760px; margin:0 auto 16px; font-size:11.5px; color:#5E6A64; text-align:right }

  /* ── IMPRESSION ────────────────────────────────────────────────────────
     Trois défauts corrigés :
     1. le billet basculait en version étroite : la zone imprimable (~700 px
        une fois les marges retirées) passait sous le point de rupture mobile
        du design. Celui-ci est désormais limité au media screen.
     2. les aplats (souche sombre, bande tricolore) disparaissaient : les
        navigateurs suppriment les fonds à l'impression sauf print-color-adjust.
     3. le billet se retrouvait perdu en haut d'une A4 : on centre et on cadre. */
  @page { size: A4 portrait; margin: 14mm; }
  @media print {
    html, body { background:#fff !important; padding:0 !important; }
    .rgb-actions, .rgb-hint { display:none !important; }
    /* Impose l'impression des couleurs de fond à toute la page. */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    /* Le billet ne doit jamais être coupé en deux pages. */
    .rgbt, .rgbt-wrap { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head><body>
${usedBanner}
<div class="rgb-actions">
  <button class="rgb-btn-dl" id="rgb-dl">Télécharger l'image</button>
  <button class="rgb-btn-print" onclick="window.print()">Imprimer</button>
</div>
<div class="rgb-hint">L'image téléchargée s'envoie par WhatsApp ou s'imprime chez un imprimeur.</div>

<div id="rgb-ticket">${corps}</div>

<script src="/vendor/html2canvas.min.js"></script>
<script>
  // « Télécharger » ouvrait la boîte d'impression : ce n'est pas un
  // téléchargement. On produit ici un VRAI fichier PNG, utilisable hors ligne,
  // partageable et imprimable en boutique.
  (function () {
    var bouton = document.getElementById('rgb-dl')
    var cible = document.getElementById('rgb-ticket')
    if (!bouton || !cible) return

    bouton.addEventListener('click', function () {
      var libelle = bouton.textContent
      bouton.disabled = true
      bouton.textContent = 'Préparation…'

      var rendu = window.html2canvas
        ? window.html2canvas(cible, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
        : Promise.reject(new Error('indisponible'))

      rendu.then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (!blob) throw new Error('image vide')
          var url = URL.createObjectURL(blob)
          var a = document.createElement('a')
          a.href = url
          a.download = 'billet-${ticket.ticket_code}.png'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          // Libération différée : Safari lit le blob après le clic.
          setTimeout(function () { URL.revokeObjectURL(url) }, 4000)
          bouton.disabled = false
          bouton.textContent = libelle
        }, 'image/png')
      }).catch(function () {
        // Repli honnête : on n'échoue pas en silence, on bascule sur l'impression
        // (« Enregistrer en PDF » y est disponible sur tous les navigateurs).
        bouton.disabled = false
        bouton.textContent = libelle
        alert("Le téléchargement de l'image n'a pas abouti sur cet appareil. Utilisez « Imprimer », puis choisissez « Enregistrer en PDF ».")
      })
    })
  })()
</script>
</body></html>`

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'private, no-store',
        },
    })
}
