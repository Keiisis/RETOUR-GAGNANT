import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/* ═══════════════════════════════════════════════════════════
   Reglage systeme « Reduire les animations »

   A LIRE AVANT D'AJOUTER DES GARDE-FOUS PARTOUT.

   Reanimated 4 respecte DEJA ce reglage, tout seul : chaque animation
   recoit `reduceMotion: ReduceMotion.System` par defaut, et `withRepeat`
   s'arrete a la premiere repetition quand le reglage est actif (verifie
   dans node_modules/react-native-reanimated/lib/module/animation/repeat.js).
   Les 26 boucles decoratives de l'application sont donc couvertes sans
   une ligne de code : il ne faut RIEN leur ajouter.

   Ce hook ne sert qu'au mouvement que Reanimated ne pilote pas — video en
   lecture automatique, GIF anime, carrousel a defilement propre. C'est le
   seul angle mort reel, et il tombe sous la regle WCAG 2.2.2 (« Pause,
   Stop, Hide ») des que le mouvement dure plus de cinq secondes.

   Contrairement au `useReducedMotion()` de Reanimated, qui fige la valeur
   lue au lancement, celui-ci suit les changements en cours de session.
═══════════════════════════════════════════════════════════ */
export function useMouvementReduit(): boolean {
    const [reduit, setReduit] = useState(false)

    useEffect(() => {
        let vivant = true

        AccessibilityInfo.isReduceMotionEnabled()
            .then((actif) => { if (vivant) setReduit(actif) })
            .catch(() => { /* reglage indisponible : on garde le mouvement */ })

        const abonnement = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            (actif) => setReduit(actif),
        )

        return () => {
            vivant = false
            abonnement.remove()
        }
    }, [])

    return reduit
}
