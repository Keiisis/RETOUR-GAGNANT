/* ═══════════════════════════════════════════════════════════
   Dates et heures dans la langue de l'utilisateur.

   Le probleme corrige ici : 66 appels repartis sur 29 ecrans passaient
   `'fr-FR'` en dur a `toLocaleDateString` / `toLocaleString`. Le reste de
   l'interface se traduisait, mais la date restait « 21 aout 2026 » meme en
   anglais — un detail qui trahit tout de suite qu'une traduction est partielle.

   Pourquoi une lecture MMKV plutot qu'un hook : `useLang()` n'est utilisable que
   dans un composant, alors que ces appels vivent souvent dans des fonctions
   utilitaires ou des `map()`. MMKV etant SYNCHRONE, la langue se lit ici sans
   promesse ni contexte, et le remplacement se fait a l'identique — un jeton
   contre un autre — sans refondre 29 ecrans.

   Le re-rendu au changement de langue reste assure par `LangContext` : tout
   ecran qui affiche une date appelle aussi `t()`, et se redessine donc.
═══════════════════════════════════════════════════════════ */
import { lire } from './stockage'

/** MEME clé que `LangContext` (`STORAGE_KEY`). Les deux doivent rester alignées. */
const CLE_LANGUE = '@rg_mobile_lang'

/* Les deux créoles n'ont pas de format de date propre dans les moteurs
   d'internationalisation : ils empruntent celui du français, qui est la langue
   de référence de leurs locuteurs pour l'écrit administratif. */
const LOCALES: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-GB',
    es: 'es-ES',
    pt: 'pt-BR',
    cr: 'fr-FR',
    ht: 'fr-FR',
}

/**
 * La locale BCP-47 correspondant à la langue choisie dans l'application.
 * Sert d'argument à toutes les méthodes `toLocale*` : `localeActuelle()`
 * remplace exactement le `'fr-FR'` qui était écrit en dur.
 */
export function localeActuelle(): string {
    const code = lire(CLE_LANGUE)
    return (code && LOCALES[code]) || LOCALES.fr
}
