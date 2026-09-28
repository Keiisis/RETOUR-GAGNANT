// ══════════════════════════════════════════════════════════════
//  Motif ILIKE EXACT pour une adresse e-mail.
//
//  `.ilike('email', adresse)` sert à comparer sans tenir compte de la casse,
//  mais `_` et `%` y sont des JOKERS : « jean_dupont@x.com » correspond aussi
//  à « jeanXdupont@x.com ». Là où la recherche désigne un compte (création
//  d'utilisateur, effacement RGPD, rattachement d'un dossier), c'était agir
//  sur la mauvaise personne. On échappe les jokers ; PostgREST traduisant en
//  plus `*` en `%`, une adresse contenant `*` est refusée (null).
// ══════════════════════════════════════════════════════════════

export function motifEmailExact(email: string): string | null {
    const e = String(email || '').toLowerCase().trim()
    if (!e || e.includes('*')) return null
    return e.replace(/[\\%_]/g, c => '\\' + c)
}
