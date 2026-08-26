import React, { useEffect, useState } from 'react'
import { View, StyleSheet, InteractionManager, AppState } from 'react-native'
import { WebView } from 'react-native-webview'
import NetInfo from '@react-native-community/netinfo'

/* ═══════════════════════════════════════════════════════════
   PRÉCHAUFFAGE DU PAIEMENT, AU LANCEMENT DE L'APPLICATION

   Kkiapay sert 1,33 Mo de JavaScript NON COMPRESSÉ, sans `Cache-Control`
   (mesuré le 2026-08-24). C'est ce téléchargement que le client attendait
   après avoir appuyé sur « Payer ».

   Un premier correctif l'avait déplacé au moment où le récapitulatif de
   paiement s'affiche. Mieux, mais insuffisant : le client lit ce
   récapitulatif en quelques secondes, pas en vingt.

   Ce composant va au bout de l'idée — les ressources se téléchargent dès
   l'ouverture de l'application, pendant que la personne consulte ses
   dossiers. Quand elle arrive au paiement, tout est déjà dans le cache de
   la WebView.

   QUATRE GARDE-FOUS, parce qu'un préchargement mal réglé coûte de la
   batterie et des données à des gens qui paient leur mégaoctet :

     1. RIEN AU DÉMARRAGE À FROID. On attend la fin des interactions puis
        six secondes : l'ouverture de l'application ne doit pas rivaliser
        avec un téléchargement d'un mégaoctet.

     2. À CHAQUE OUVERTURE, DONNÉES MOBILES COMPRISES. Décision du
        propriétaire du projet, prise en connaissance du coût : ouvrir vite
        la page de paiement prime sur l'économie de forfait.

        Le coût réel est d'ailleurs modeste. Ces fichiers portent un `ETag`
        et un `Last-Modified` sans `Cache-Control` : la WebView les considère
        frais environ deux jours et demi par heuristique, puis revalide et
        reçoit un 304 de quelques centaines d'octets. Le mégaoctet complet ne
        repart que lorsque le cache a expiré ou a été vidé.

     3. UNE SEULE FOIS PAR LANCEMENT. Le composant est monté une fois dans
        l'arbre de l'application : il ne peut pas se déclencher en boucle.

     4. LA WEBVIEW MEURT APRÈS COUP. Quarante-cinq secondes suffisent pour
        télécharger ; ensuite le composant se démonte et rend la mémoire.
        Le cache HTTP, lui, survit — c'est tout ce qu'on voulait.

   L'URL ne porte aucune configuration : aucune transaction n'est créée, on
   ne télécharge que la coquille et ses ressources.
   ═══════════════════════════════════════════════════════════ */

const ORIGINE = 'https://widget-v3.kkiapay.me/'
const ATTENTE_AVANT_MS = 6000
const DUREE_VIE_MS = 45000

export default function PrechauffagePaiement() {
    const [actif, setActif] = useState(false)

    useEffect(() => {
        let vivant = true
        let minuteurFin: ReturnType<typeof setTimeout> | undefined

        const decider = async () => {
            /* Seule condition : être en ligne. Le type de connexion n'entre
               plus en compte — on précharge aussi en données mobiles. */
            try {
                const etat = await NetInfo.fetch()
                if (!etat.isConnected) return
            } catch {
                // État inconnu : on tente. Une WebView qui échoue ne coûte rien.
            }

            if (!vivant) return
            setActif(true)

            // 4. Durée de vie bornée.
            minuteurFin = setTimeout(() => { if (vivant) setActif(false) }, DUREE_VIE_MS)
        }

        // 1. Après les interactions, puis un délai.
        const tache = InteractionManager.runAfterInteractions(() => {
            const m = setTimeout(decider, ATTENTE_AVANT_MS)
            minuteurFin = m
        })

        /* Application mise en arrière-plan pendant le préchauffage : on
           arrête. Télécharger pour quelqu'un qui a quitté l'écran serait du
           gaspillage pur. */
        const abonnement = AppState.addEventListener('change', (etat) => {
            if (etat !== 'active') setActif(false)
        })

        return () => {
            vivant = false
            tache.cancel?.()
            if (minuteurFin) clearTimeout(minuteurFin)
            abonnement.remove()
        }
    }, [])

    if (!actif) return null

    return (
        <View style={styles.horsChamp} pointerEvents="none" accessible={false}>
            <WebView
                source={{ uri: ORIGINE }}
                javaScriptEnabled
                domStorageEnabled
                cacheEnabled
                androidLayerType="software"
                style={styles.vue}
                /* Une panne de réseau ici ne doit rien signaler : le
                   préchauffage est un confort, jamais une étape. */
                onError={() => setActif(false)}
                onHttpError={() => setActif(false)}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    /* Hors champ plutôt que `display: none` : une WebView masquée ne charge
       pas sa page sur certaines versions d'Android. */
    horsChamp: { position: 'absolute', width: 1, height: 1, left: -9999, top: -9999, opacity: 0 },
    vue: { width: 1, height: 1 },
})