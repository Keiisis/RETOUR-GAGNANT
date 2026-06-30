# Scripts de refactor (archive)

Scripts Node ponctuels utilisés pour migrer le code mobile.
**Mission terminée** — laissés ici pour traçabilité, ne pas relancer.

| Script | Effet |
|--------|-------|
| `replace_icons.js` | Migration `@expo/vector-icons` (Ionicons) → `lucide-react-native` |
| `fix_remaining_ionicons.js` | Réinjection sélective d'Ionicons là où Lucide n'avait pas l'équivalent (ex: glyphes Service) |
| `replace_colors.js` | Migration de la palette héritée vers le design system Nexus Emerald (`config/theme.ts`) |

Si un nouveau refactor du même type est nécessaire, dupliquer un script comme template plutôt que d'éditer ceux-ci.
