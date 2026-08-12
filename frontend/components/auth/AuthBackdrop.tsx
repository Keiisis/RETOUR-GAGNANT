import Image from 'next/image'

/* ═══════════════════════════════════════════════════════════
   AuthBackdrop : atmosphère commune aux écrans de connexion
   (client / agent / admin).

   Pourquoi ce composant : les trois pages partageaient le MÊME gabarit
   générique (fond quasi-noir + deux halos radiaux flous + grille « tech »),
   seule la teinte changeant. C'est le gabarit qu'on retrouve sur des
   milliers d'interfaces générées : il ne raconte rien du métier.

   Direction retenue : chaque porte d'entrée s'ouvre sur une image qui dit
   ce que fait la personne qui se connecte. Les trois forment une suite :
     · client → la Porte du Retour (revenir vers la terre des ancêtres)
     · agent  → planter le jeune arbre dans la terre de latérite (cultiver)
     · admin  → l'arbre-réseau vu d'en haut (superviser l'ensemble)

   Le voile posé sur l'image est CHAUD (jamais un noir plat) : il calme la
   zone du formulaire sans éteindre la photo. Aucune animation perpétuelle.
═══════════════════════════════════════════════════════════ */

export type AuthTone = 'parchment' | 'charcoal'

const TONES: Record<AuthTone, {
    base: string
    weave: string
    /** Voile appliqué par-dessus la photo pour garder le formulaire lisible. */
    scrim: string
    fallbackWash: string
}> = {
    // Espaces client & agent : lumière chaude, papier.
    parchment: {
        base: '#F8F5EE',
        weave: 'rgba(31,27,22,0.055)',
        scrim:
            'linear-gradient(180deg, rgba(248,245,238,0.62) 0%, rgba(248,245,238,0.80) 42%, rgba(248,245,238,0.92) 100%),' +
            'radial-gradient(70% 55% at 50% 50%, rgba(248,245,238,0.55), transparent 75%)',
        fallbackWash:
            'radial-gradient(120% 80% at 50% 108%, rgba(0,135,81,0.10), transparent 62%),' +
            'radial-gradient(90% 60% at 88% -8%, rgba(176,138,24,0.10), transparent 60%)',
    },
    // Administration : nuit profonde, lueur d'or contenue.
    charcoal: {
        base: '#0B1220',
        weave: 'rgba(255,253,247,0.045)',
        scrim:
            'linear-gradient(180deg, rgba(9,14,24,0.55) 0%, rgba(9,14,24,0.74) 45%, rgba(9,14,24,0.88) 100%),' +
            'radial-gradient(70% 55% at 50% 50%, rgba(9,14,24,0.45), transparent 78%)',
        fallbackWash:
            'radial-gradient(120% 80% at 50% 110%, rgba(232,190,42,0.10), transparent 60%),' +
            'radial-gradient(80% 55% at 88% -6%, rgba(0,135,81,0.10), transparent 60%)',
    },
}

export default function AuthBackdrop({
    tone = 'parchment',
    image,
    imageAlt = '',
    focus = 'center',
}: {
    tone?: AuthTone
    /** Chemin public de la photo de fond. Sans image, on retombe sur le tissage. */
    image?: string
    imageAlt?: string
    /** object-position de la photo (ex. 'center 60%'). */
    focus?: string
}) {
    const c = TONES[tone]
    return (
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: c.base }}>
            {image ? (
                <Image
                    src={image}
                    alt={imageAlt}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover"
                    style={{ objectPosition: focus }}
                />
            ) : (
                <>
                    {/* Repli sans photo : tissage diagonal (étoffe), pas une grille technique. */}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage:
                                `repeating-linear-gradient(45deg, ${c.weave} 0 1px, transparent 1px 14px),` +
                                `repeating-linear-gradient(-45deg, ${c.weave} 0 1px, transparent 1px 14px)`,
                        }}
                    />
                    <div className="absolute inset-0" style={{ background: c.fallbackWash }} />
                </>
            )}

            {/* Voile chaud : rend le formulaire lisible sans éteindre la photo. */}
            {image ? <div className="absolute inset-0" style={{ background: c.scrim }} /> : null}

            {/* Filet tricolore en pied de page : signature de marque, discrète. */}
            <div className="absolute bottom-0 inset-x-0 h-[3px] flex">
                <span className="flex-1 bg-[#008751]" />
                <span className="w-[18%] bg-[#FCD116]" />
                <span className="w-[18%] bg-[#E8112D]" />
            </div>
        </div>
    )
}

/* Sceau de marque circulaire (anneau tricolore) : remplace le badge carré à
   dégradé + glow néon, identique sur les trois écrans. */
export function BrandSeal({
    children,
    inner = '#FFFFFF',
    size = 76,
}: {
    children: React.ReactNode
    /** Couleur intérieure du sceau : doit s'accorder au fond de la page. */
    inner?: string
    size?: number
}) {
    return (
        <div
            className="inline-flex rounded-full p-[2.5px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]"
            style={{
                width: size,
                height: size,
                background: 'conic-gradient(from 210deg, #008751 0deg 150deg, #FCD116 150deg 250deg, #E8112D 250deg 330deg, #008751 330deg 360deg)',
            }}
        >
            <div
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{ background: inner }}
            >
                {children}
            </div>
        </div>
    )
}
