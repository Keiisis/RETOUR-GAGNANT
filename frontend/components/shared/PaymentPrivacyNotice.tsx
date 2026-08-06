'use client'

import { ShieldCheck } from '@phosphor-icons/react';

// ══════════════════════════════════════════════════════════════
// Notice RGPD pour les étapes de paiement.
// Information (art. 13 RGPD), PAS une case à cocher : la base légale
// du paiement est l'exécution du contrat / l'obligation légale (facturation),
// qui ne requiert pas de consentement — mais exige la transparence.
// ══════════════════════════════════════════════════════════════

export default function PaymentPrivacyNotice({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 ${className}`}>
            <ShieldCheck className="w-4 h-4 text-[#008751] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-gray-500">
                Vos nom, e-mail et téléphone sont utilisés uniquement pour traiter votre paiement,
                établir votre reçu et assurer le suivi de votre dossier (exécution du contrat et
                obligations comptables). <strong className="text-gray-600">Vos données bancaires sont
                traitées directement par notre prestataire de paiement sécurisé et ne sont jamais
                conservées par Retour Gagnant.</strong>{' '}
                <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-[#008751] hover:underline">
                    Politique de confidentialité
                </a>.
            </p>
        </div>
    )
}
