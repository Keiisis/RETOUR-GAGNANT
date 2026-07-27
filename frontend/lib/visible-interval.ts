// ══════════════════════════════════════════════════════════════
//  POLLING ÉCONOME EN EDGE REQUESTS
//  setInterval « nu » continue de taper les API même quand l'onglet est en
//  arrière-plan (agent qui laisse son panel ouvert toute la journée = des
//  milliers de requêtes edge inutiles). Ce helper :
//    - lance le callback à l'intervalle donné,
//    - MET EN PAUSE dès que l'onglet passe en arrière-plan (document.hidden),
//    - REPREND (et rejoue une fois immédiatement) au retour au premier plan.
//  À utiliser dans un useEffect : le retour est la fonction de nettoyage.
//
//    useEffect(() => visibleInterval(fetchData, 60_000), [])
// ══════════════════════════════════════════════════════════════

export function visibleInterval(
    fn: () => void,
    ms: number,
    { runImmediately = true }: { runImmediately?: boolean } = {},
): () => void {
    if (typeof document === 'undefined') return () => {}

    let id: ReturnType<typeof setInterval> | null = null

    const start = () => {
        if (id !== null) return
        if (runImmediately) fn()
        id = setInterval(fn, ms)
    }
    const stop = () => {
        if (id !== null) { clearInterval(id); id = null }
    }
    const onVisibility = () => {
        if (document.hidden) stop()
        else start()
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) start()

    return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        stop()
    }
}
