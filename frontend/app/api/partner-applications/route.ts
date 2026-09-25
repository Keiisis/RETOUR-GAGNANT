// ══════════════════════════════════════════════════════════════
//  Candidature partenaire — dépôt PUBLIC (page /devenir-partenaire).
//
//  Le formulaire postait sur /api/admin/partner-applications : le middleware
//  refuse tout visiteur anonyme sous /api/admin, donc AUCUNE candidature
//  n'arrivait (réponse « Non authentifié »). Le traitement reste le même ;
//  seule l'adresse devient publique, avec un plafond anti-abus.
// ══════════════════════════════════════════════════════════════
import { NextRequest } from 'next/server'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { POST as deposer } from '@/app/api/admin/partner-applications/route'

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'partner-applications', PUBLIC_FORM_LIMIT)
    if (trop) return trop
    return deposer(request)
}
