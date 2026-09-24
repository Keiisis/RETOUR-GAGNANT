'use client'

// L'onglet « Dossiers MyAfroOrigins » : reprise sur invitation, puis récaps.
// Le même assemblage est monté dans /agent/documents — voir
// components/admin/MyafroRepriseSection.tsx.
import MyafroRepriseSection from '@/components/admin/MyafroRepriseSection'
import RecapMyafroSection from '@/components/admin/RecapMyafroSection'

export default function AdminDocumentsPage() {
    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto space-y-10">
                <MyafroRepriseSection />

                {/* Demandes déposées depuis la page publique du service ou depuis
                    un lien de reprise : elles arrivent réglées (ou justifiées par
                    une facture), sans qu'un agent ait à les saisir. */}
                <div id="myafro" className="scroll-mt-24"><RecapMyafroSection /></div>

                {/* La liste générique des pièces client a été retirée d'ici : à cet
                    endroit, une pièce n'a de sens que rattachée à une demande de récap.
                    Elles s'affichent donc DANS la fiche concernée (RecapMyafroSection),
                    et non dans une liste séparée où l'on ignore de quel dossier elles
                    parlent. */}
            </div>
        </div>
    )
}
