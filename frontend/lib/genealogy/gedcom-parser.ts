/* ════════════════════════════════════════════════════════════════
   GEDCOM Parser — minimaliste, GEDCOM 5.5 + 7.0
   Lit le texte GEDCOM ligne par ligne et construit deux maps :
   - individuals : { @I1@ → IndividualRecord }
   - families    : { @F1@ → FamilyRecord }

   Format GEDCOM :
     0 @ID@ TAG       (header de record)
     1 TAG VALUE      (champ de niveau 1)
     2 TAG VALUE      (sous-champ de niveau 2)
   La hiérarchie est portée par le numéro de niveau (0, 1, 2…).
════════════════════════════════════════════════════════════════ */

export interface GedcomIndividual {
    id: string                  // @I1@
    first_name: string | null
    last_name: string | null
    gender: 'male' | 'female' | 'other' | null
    birth_date: string | null   // ISO YYYY-MM-DD (ou YYYY si seul)
    birth_place: string | null
    death_date: string | null
    death_place: string | null
    famc: string | null         // ID de la famille où il est enfant
    fams: string[]              // IDs de familles où il est conjoint
    notes: string[]
}

export interface GedcomFamily {
    id: string                  // @F1@
    husband: string | null      // @I2@
    wife: string | null         // @I3@
    children: string[]          // [@I1@, …]
    marriage_date: string | null
    marriage_place: string | null
}

export interface GedcomParseResult {
    individuals: Map<string, GedcomIndividual>
    families: Map<string, GedcomFamily>
    warnings: string[]
    raw_lines: number
}

/** Convertit une date GEDCOM en ISO partial (YYYY-MM-DD, YYYY-MM, ou YYYY). */
export function parseGedcomDate(raw: string): string | null {
    if (!raw) return null
    const cleaned = raw.trim().replace(/^(ABT|AFT|BEF|CAL|EST|FROM|TO|BET)\s+/i, '')
    const months: Record<string, string> = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    }
    // "15 MAY 1950"
    const m1 = cleaned.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i)
    if (m1) {
        const day = m1[1].padStart(2, '0')
        const month = months[m1[2].toUpperCase()]
        if (month) return `${m1[3]}-${month}-${day}`
    }
    // "MAY 1950"
    const m2 = cleaned.match(/^([A-Z]{3})\s+(\d{4})$/i)
    if (m2) {
        const month = months[m2[1].toUpperCase()]
        if (month) return `${m2[2]}-${month}-01`
    }
    // "1950"
    const m3 = cleaned.match(/^(\d{4})$/)
    if (m3) return `${m3[1]}-01-01`
    // ISO direct
    const m4 = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m4) return cleaned
    return null
}

/** "John /Doe/ Jr" → { first: "John", last: "Doe" }. */
export function parseGedcomName(raw: string): { first: string | null; last: string | null } {
    if (!raw) return { first: null, last: null }
    const surnameMatch = raw.match(/\/(.*?)\//)
    const last = surnameMatch ? surnameMatch[1].trim() : null
    const first = raw.replace(/\/(.*?)\//, '').trim() || null
    return { first, last }
}

interface GedcomLine {
    level: number
    xref: string | null
    tag: string
    value: string
}

function parseLine(rawLine: string): GedcomLine | null {
    const line = rawLine.trim()
    if (!line) return null
    const m = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z_]+)(?:\s+(.*))?$/)
    if (!m) return null
    return {
        level: parseInt(m[1], 10),
        xref: m[2] || null,
        tag: m[3],
        value: m[4] || '',
    }
}

export function parseGedcom(content: string): GedcomParseResult {
    const lines = content.split(/\r\n|\n|\r/)
    const individuals = new Map<string, GedcomIndividual>()
    const families = new Map<string, GedcomFamily>()
    const warnings: string[] = []

    let currentIndi: GedcomIndividual | null = null
    let currentFam: GedcomFamily | null = null
    let activeSection: 'BIRT' | 'DEAT' | 'MARR' | null = null

    for (let i = 0; i < lines.length; i++) {
        const parsed = parseLine(lines[i])
        if (!parsed) continue
        const { level, xref, tag, value } = parsed

        if (level === 0) {
            currentIndi = null
            currentFam = null
            activeSection = null
            if (tag === 'INDI' && xref) {
                currentIndi = {
                    id: xref,
                    first_name: null, last_name: null, gender: null,
                    birth_date: null, birth_place: null,
                    death_date: null, death_place: null,
                    famc: null, fams: [], notes: [],
                }
                individuals.set(xref, currentIndi)
            } else if (tag === 'FAM' && xref) {
                currentFam = {
                    id: xref,
                    husband: null, wife: null, children: [],
                    marriage_date: null, marriage_place: null,
                }
                families.set(xref, currentFam)
            }
            continue
        }

        if (level === 1) {
            activeSection = null
            if (currentIndi) {
                switch (tag) {
                    case 'NAME': {
                        const { first, last } = parseGedcomName(value)
                        currentIndi.first_name = first
                        currentIndi.last_name = last
                        break
                    }
                    case 'SEX':
                        currentIndi.gender = value.toUpperCase() === 'M' ? 'male'
                            : value.toUpperCase() === 'F' ? 'female' : 'other'
                        break
                    case 'BIRT':
                        activeSection = 'BIRT'
                        break
                    case 'DEAT':
                        activeSection = 'DEAT'
                        break
                    case 'FAMC':
                        currentIndi.famc = value
                        break
                    case 'FAMS':
                        currentIndi.fams.push(value)
                        break
                    case 'NOTE':
                        if (value) currentIndi.notes.push(value)
                        break
                }
            } else if (currentFam) {
                switch (tag) {
                    case 'HUSB':
                        currentFam.husband = value
                        break
                    case 'WIFE':
                        currentFam.wife = value
                        break
                    case 'CHIL':
                        currentFam.children.push(value)
                        break
                    case 'MARR':
                        activeSection = 'MARR'
                        break
                }
            }
            continue
        }

        if (level === 2) {
            if (currentIndi && activeSection === 'BIRT') {
                if (tag === 'DATE') currentIndi.birth_date = parseGedcomDate(value)
                else if (tag === 'PLAC') currentIndi.birth_place = value || null
            } else if (currentIndi && activeSection === 'DEAT') {
                if (tag === 'DATE') currentIndi.death_date = parseGedcomDate(value)
                else if (tag === 'PLAC') currentIndi.death_place = value || null
            } else if (currentFam && activeSection === 'MARR') {
                if (tag === 'DATE') currentFam.marriage_date = parseGedcomDate(value)
                else if (tag === 'PLAC') currentFam.marriage_place = value || null
            } else if (currentIndi && tag === 'CONT' && currentIndi.notes.length > 0) {
                currentIndi.notes[currentIndi.notes.length - 1] += `\n${value}`
            }
            continue
        }
    }

    if (individuals.size === 0) {
        warnings.push('Aucun INDI trouvé dans le fichier GEDCOM')
    }

    return {
        individuals,
        families,
        warnings,
        raw_lines: lines.length,
    }
}
