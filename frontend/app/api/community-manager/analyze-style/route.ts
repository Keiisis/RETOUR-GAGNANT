import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groqApiKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
    process.env.GROQ_API_KEY_6,
    process.env.GROQ_API_KEY,
].filter(Boolean) as string[]

async function callGroq(
    systemPrompt: string,
    userPrompt: string,
    opts: { temperature: number; max_tokens: number }
): Promise<string> {
    const shuffled = [...groqApiKeys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const groq = new Groq({ apiKey: shuffled[i] })
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' },
                temperature: opts.temperature,
                max_tokens: opts.max_tokens,
            })
            return completion.choices[0].message.content || '{}'
        } catch (err) {
            console.warn(`[analyze-style] Groq key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Groq ont échoué')
}

// ═══════════════════════════════════════════════════════════════════
// PASS 1 — Analyse structurelle & quantitative
// ═══════════════════════════════════════════════════════════════════
const PASS1_SYSTEM = `Tu es un analyste quantitatif expert en marketing digital, copywriting viral et community management africain.
Tu reçois des publications de réseaux sociaux. Ton rôle : extraire des METRIQUES PRECISES, des PATTERNS STRUCTURELS et des SCORES CHIFFRES.

IMPORTANT :
- Chaque score est un entier de 0 à 100
- Chaque hook doit être une CITATION EXACTE du texte (pas une reformulation)
- Les technique doivent être parmi : curiosity_gap, shock_stat, direct_question, bold_claim, personal_story, controversy, social_proof, scarcity, empathy_hook
- Sois PRECIS et FACTUEL, pas vague

Retourne UNIQUEMENT un JSON valide avec cette structure :
{
  "voice_fingerprint": {
    "signature_phrases": ["phrase exacte répétée 1", "phrase 2", "phrase 3"] (max 5, CITATIONS EXACTES),
    "transition_words": ["mot1", "mot2"] (max 8, mots de liaison récurrents),
    "rhythm": "short_punchy | flowing_narrative | mixed",
    "sentence_avg_words": number (moyenne mots par phrase, estimée),
    "punctuation_style": "exclamation_heavy | question_driven | ellipsis_lover | clean | mixed",
    "opening_patterns": ["pattern1", "pattern2"] (max 4, comment les posts commencent),
    "closing_patterns": ["pattern1", "pattern2"] (max 4, comment les posts finissent)
  },
  "hooks_masterclass": [
    {
      "hook": "TEXTE EXACT de l'accroche (première phrase/ligne du post)",
      "technique": "curiosity_gap | shock_stat | direct_question | bold_claim | personal_story | controversy | social_proof | scarcity | empathy_hook",
      "power_score": number (0-100, basé sur : clarté, émotion, curiosité, spécificité),
      "why_it_works": "explication courte (1 phrase) de pourquoi cette accroche fonctionne"
    }
  ] (les 5-6 meilleures accroches, classées par power_score décroissant),
  "content_blueprint": {
    "structure_template": "string (ex: Hook percutant → Pain point → Story personnelle → Solution → CTA émotionnel)",
    "ideal_length_words": number (longueur moyenne observée),
    "hashtag_count": number (nombre moyen de hashtags par post),
    "hashtag_placement": "end | inline | mixed | none",
    "emoji_density": "none | light (1-2 par post) | medium (3-5) | heavy (6+)",
    "emoji_favorites": ["emoji1", "emoji2", "emoji3"] (les emojis les plus utilisés),
    "visual_pairing": "lifestyle_photos | data_graphics | face_close_ups | quotes_cards | video_clips | mixed",
    "cta_formulas": ["formule CTA exacte 1", "formule 2", "formule 3"] (max 4, CITATIONS),
    "posting_frequency": "string (estimation)",
    "best_days": ["jour1", "jour2"]
  },
  "scores": {
    "hook_power": number (0-100, qualité des accroches),
    "emotional_depth": number (0-100, profondeur émotionnelle du contenu),
    "storytelling": number (0-100, capacité narrative),
    "authority": number (0-100, expertise/crédibilité perçue),
    "humor": number (0-100, usage de l'humour),
    "urgency": number (0-100, création de sentiment d'urgence),
    "community_building": number (0-100, engagement communautaire),
    "viral_potential": number (0-100, potentiel de partage/viralité)
  }
}`

// ═══════════════════════════════════════════════════════════════════
// PASS 2 — Analyse stratégique & créative
// ═══════════════════════════════════════════════════════════════════
const PASS2_SYSTEM = `Tu es un stratège marketing digital expert en psychologie d'audience, positionnement concurrentiel et copywriting viral pour l'Afrique de l'Ouest.

Tu reçois :
1. Les publications originales d'un profil
2. L'analyse structurelle (Pass 1) déjà réalisée

Ton rôle : compléter avec la dimension STRATEGIQUE, PSYCHOLOGIQUE et CREATIVE.

IMPORTANT :
- L'audience_persona doit être DEDUIT des publications (qui réagit ? qui est visé ?)
- Les example_rewrites doivent montrer la TRANSFORMATION d'un texte générique vers le style analysé
- Le system_prompt doit être DIRECTEMENT utilisable dans Claude/ChatGPT pour imiter ce style
- Sois concret et actionnable, pas générique

Retourne UNIQUEMENT un JSON valide :
{
  "emotional_map": {
    "dominant_emotions": [
      {"emotion": "string", "frequency": number (0.0 à 1.0, proportion), "example": "citation courte du texte"}
    ] (max 5 émotions, classées par fréquence décroissante),
    "emotional_arc": "buildup_to_climax | steady | rollercoaster | tension_release | crescendo",
    "pain_points_addressed": ["douleur 1", "douleur 2"] (max 5, les problèmes que l'audience ressent),
    "desires_activated": ["désir 1", "désir 2"] (max 5, les aspirations stimulées),
    "emotional_density_score": number (0-100, richesse émotionnelle globale)
  },
  "audience_persona": {
    "age_range": "string (ex: 25-35)",
    "gender_lean": "mixed | female_dominant | male_dominant",
    "socio_economic": "string (ex: classe moyenne aspirationnelle urbaine)",
    "pain_points": ["problème 1", "problème 2"] (max 4),
    "language_register": "familier | informal_professional | formel | technique | mixte",
    "platform_behavior": "string (ex: scrolleurs qui sauvegardent, commentateurs actifs)"
  },
  "competitive_edge": {
    "unique_differentiator": "string (ce qui le rend unique vs les autres)",
    "content_gaps": ["sujet non couvert 1", "sujet 2"] (max 4, opportunités manquées),
    "vulnerability": "string (leur plus grande faiblesse exploitable)",
    "copy_this": ["technique à copier 1", "technique 2"] (max 4, ce qui marche et qu'on peut reproduire),
    "avoid_this": ["erreur à éviter 1", "erreur 2"] (max 3, ce qui ne marche pas chez eux)
  },
  "claude_instructions": {
    "system_prompt": "string (prompt système complet prêt à l'emploi pour imiter ce style, max 400 mots)",
    "do_list": ["faire ceci", "faire cela"] (max 6, règles à suivre),
    "dont_list": ["ne pas faire ceci", "éviter cela"] (max 5, erreurs à éviter),
    "example_rewrites": [
      {"before": "Version générique/plate d'un post", "after": "Même contenu réécrit dans le style analysé"}
    ] (exactement 2 exemples avant/après)
  },
  "viral_formula": "string (LA formule virale condensée en 1 phrase percutante, ex: 'Choc émotionnel + preuve sociale + CTA urgent = viralité')",
  "tone": "string (ex: inspirant et autoritaire avec une touche d'humour)",
  "vocabulary_level": "simple | courant | soutenu | technique | mixte"
}`

// ═══════════════════════════════════════════════════════════════════
// Sanitization — robustesse contre les sorties Groq imprévisibles
// ═══════════════════════════════════════════════════════════════════
function clamp(v: unknown, min: number, max: number): number {
    const n = Number(v)
    if (isNaN(n)) return 0
    return Math.max(min, Math.min(max, Math.round(n)))
}

function ensureArray(v: unknown): string[] {
    return Array.isArray(v) ? v.map(String).filter(Boolean) : []
}

function ensureStr(v: unknown, fallback = ''): string {
    if (v === null || v === undefined) return fallback
    const s = String(v).trim()
    return s === 'null' || s === 'undefined' ? fallback : s
}

interface HookItem {
    hook: string
    technique: string
    power_score: number
    why_it_works: string
}

interface EmotionItem {
    emotion: string
    frequency: number
    example: string
}

interface RewriteItem {
    before: string
    after: string
}

function sanitizePass1(raw: Record<string, unknown>) {
    const vf = (raw.voice_fingerprint || {}) as Record<string, unknown>
    const hm = Array.isArray(raw.hooks_masterclass) ? raw.hooks_masterclass : []
    const cb = (raw.content_blueprint || {}) as Record<string, unknown>
    const sc = (raw.scores || {}) as Record<string, unknown>

    return {
        voice_fingerprint: {
            signature_phrases: ensureArray(vf.signature_phrases).slice(0, 5),
            transition_words: ensureArray(vf.transition_words).slice(0, 8),
            rhythm: ensureStr(vf.rhythm, 'mixed'),
            sentence_avg_words: clamp(vf.sentence_avg_words, 3, 50),
            punctuation_style: ensureStr(vf.punctuation_style, 'mixed'),
            opening_patterns: ensureArray(vf.opening_patterns).slice(0, 4),
            closing_patterns: ensureArray(vf.closing_patterns).slice(0, 4),
        },
        hooks_masterclass: hm.slice(0, 6).map((h: unknown) => {
            const item = (h || {}) as Record<string, unknown>
            return {
                hook: ensureStr(item.hook),
                technique: ensureStr(item.technique, 'bold_claim'),
                power_score: clamp(item.power_score, 0, 100),
                why_it_works: ensureStr(item.why_it_works),
            } as HookItem
        }),
        content_blueprint: {
            structure_template: ensureStr(cb.structure_template),
            ideal_length_words: clamp(cb.ideal_length_words, 10, 2000),
            hashtag_count: clamp(cb.hashtag_count, 0, 30),
            hashtag_placement: ensureStr(cb.hashtag_placement, 'end'),
            emoji_density: ensureStr(cb.emoji_density, 'medium'),
            emoji_favorites: ensureArray(cb.emoji_favorites).slice(0, 5),
            visual_pairing: ensureStr(cb.visual_pairing, 'mixed'),
            cta_formulas: ensureArray(cb.cta_formulas).slice(0, 4),
            posting_frequency: ensureStr(cb.posting_frequency),
            best_days: ensureArray(cb.best_days),
        },
        scores: {
            hook_power: clamp(sc.hook_power, 0, 100),
            emotional_depth: clamp(sc.emotional_depth, 0, 100),
            storytelling: clamp(sc.storytelling, 0, 100),
            authority: clamp(sc.authority, 0, 100),
            humor: clamp(sc.humor, 0, 100),
            urgency: clamp(sc.urgency, 0, 100),
            community_building: clamp(sc.community_building, 0, 100),
            viral_potential: clamp(sc.viral_potential, 0, 100),
        },
    }
}

function sanitizePass2(raw: Record<string, unknown>) {
    const em = (raw.emotional_map || {}) as Record<string, unknown>
    const ap = (raw.audience_persona || {}) as Record<string, unknown>
    const ce = (raw.competitive_edge || {}) as Record<string, unknown>
    const ci = (raw.claude_instructions || {}) as Record<string, unknown>

    const dominantEmotions = Array.isArray(em.dominant_emotions) ? em.dominant_emotions : []
    const rewrites = Array.isArray(ci.example_rewrites) ? ci.example_rewrites : []

    return {
        emotional_map: {
            dominant_emotions: dominantEmotions.slice(0, 5).map((e: unknown) => {
                const item = (e || {}) as Record<string, unknown>
                return {
                    emotion: ensureStr(item.emotion),
                    frequency: Math.max(0, Math.min(1, Number(item.frequency) || 0)),
                    example: ensureStr(item.example),
                } as EmotionItem
            }),
            emotional_arc: ensureStr(em.emotional_arc, 'steady'),
            pain_points_addressed: ensureArray(em.pain_points_addressed).slice(0, 5),
            desires_activated: ensureArray(em.desires_activated).slice(0, 5),
            emotional_density_score: clamp(em.emotional_density_score, 0, 100),
        },
        audience_persona: {
            age_range: ensureStr(ap.age_range, '25-40'),
            gender_lean: ensureStr(ap.gender_lean, 'mixed'),
            socio_economic: ensureStr(ap.socio_economic),
            pain_points: ensureArray(ap.pain_points).slice(0, 4),
            language_register: ensureStr(ap.language_register, 'informal_professional'),
            platform_behavior: ensureStr(ap.platform_behavior),
        },
        competitive_edge: {
            unique_differentiator: ensureStr(ce.unique_differentiator),
            content_gaps: ensureArray(ce.content_gaps).slice(0, 4),
            vulnerability: ensureStr(ce.vulnerability),
            copy_this: ensureArray(ce.copy_this).slice(0, 4),
            avoid_this: ensureArray(ce.avoid_this).slice(0, 3),
        },
        claude_instructions: {
            system_prompt: ensureStr(ci.system_prompt),
            do_list: ensureArray(ci.do_list).slice(0, 6),
            dont_list: ensureArray(ci.dont_list).slice(0, 5),
            example_rewrites: rewrites.slice(0, 2).map((r: unknown) => {
                const item = (r || {}) as Record<string, unknown>
                return {
                    before: ensureStr(item.before),
                    after: ensureStr(item.after),
                } as RewriteItem
            }),
        },
        viral_formula: ensureStr(raw.viral_formula),
        tone: ensureStr(raw.tone, 'Non déterminé'),
        vocabulary_level: ensureStr(raw.vocabulary_level, 'courant'),
    }
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/community-manager/analyze-style
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { samples, platform, profile_url } = body

        if (!samples || samples.trim().length < 50) {
            return NextResponse.json(
                { error: 'Veuillez fournir au moins quelques publications à analyser (50 caractères minimum).' },
                { status: 400 }
            )
        }

        const trimmedSamples = samples.trim().slice(0, 12000)
        const ctx = `${platform ? `Plateforme: ${platform}` : ''}${profile_url ? ` | Profil: ${profile_url}` : ''}`

        // ── PASS 1 : Structurel & Quantitatif ───────────────────
        console.log(`[analyze-style] Pass 1 — structurel...`)
        const raw1 = await callGroq(
            PASS1_SYSTEM,
            `${ctx ? `${ctx}\n\n` : ''}Analyse ces publications :\n\n---\n${trimmedSamples}\n---\n\nRetourne l'analyse structurelle JSON.`,
            { temperature: 0.2, max_tokens: 3000 }
        )

        let parsed1: Record<string, unknown>
        try { parsed1 = JSON.parse(raw1) } catch {
            console.warn('[analyze-style] Pass 1 JSON parse failed:', raw1?.slice(0, 200))
            return NextResponse.json({ error: 'Analyse échouée — réessayez' }, { status: 500 })
        }

        const pass1 = sanitizePass1(parsed1)

        // ── PASS 2 : Stratégique & Créatif ──────────────────────
        console.log(`[analyze-style] Pass 2 — stratégique...`)
        let pass2
        try {
            const raw2 = await callGroq(
                PASS2_SYSTEM,
                `${ctx ? `${ctx}\n\n` : ''}## Analyse structurelle (Pass 1) :\n\`\`\`json\n${JSON.stringify(pass1, null, 2)}\n\`\`\`\n\n## Publications originales :\n---\n${trimmedSamples.slice(0, 6000)}\n---\n\nComplète avec l'analyse stratégique JSON.`,
                { temperature: 0.5, max_tokens: 3000 }
            )
            const parsed2 = JSON.parse(raw2)
            pass2 = sanitizePass2(parsed2)
        } catch (err) {
            console.warn('[analyze-style] Pass 2 failed, partial result:', err instanceof Error ? err.message : '')
            pass2 = null
        }

        // ── Fusion Pass1 + Pass2 ────────────────────────────────
        const scores = {
            ...pass1.scores,
            overall: Math.round(
                pass1.scores.hook_power * 0.2 +
                pass1.scores.emotional_depth * 0.15 +
                pass1.scores.storytelling * 0.15 +
                pass1.scores.authority * 0.1 +
                pass1.scores.viral_potential * 0.2 +
                pass1.scores.community_building * 0.1 +
                pass1.scores.urgency * 0.05 +
                pass1.scores.humor * 0.05
            ),
        }

        const analysis: Record<string, unknown> = {
            // Deep Style DNA (nouvelles sections)
            voice_fingerprint: pass1.voice_fingerprint,
            hooks_masterclass: pass1.hooks_masterclass,
            content_blueprint: pass1.content_blueprint,
            scores,
            emotional_map: pass2?.emotional_map || null,
            audience_persona: pass2?.audience_persona || null,
            competitive_edge: pass2?.competitive_edge || null,
            claude_instructions: pass2?.claude_instructions || null,

            // Champs legacy plats (backward compat avec l'UI existante)
            tone: pass2?.tone || 'Non déterminé',
            vocabulary_level: pass2?.vocabulary_level || 'courant',
            typical_structure: pass1.content_blueprint.structure_template,
            hooks: pass1.hooks_masterclass.map((h: HookItem) => h.hook),
            hashtag_strategy: `${pass1.content_blueprint.hashtag_count} hashtags, placement: ${pass1.content_blueprint.hashtag_placement}`,
            emoji_usage: pass1.content_blueprint.emoji_density,
            avg_post_length: `${pass1.content_blueprint.ideal_length_words} mots`,
            engagement_triggers: pass2?.emotional_map?.pain_points_addressed || [],
            writing_patterns: pass1.voice_fingerprint.opening_patterns,
            improvement_tips: pass2?.competitive_edge?.content_gaps || [],
            viral_formula: pass2?.viral_formula || '',
            best_content_types: [pass1.content_blueprint.visual_pairing],
            call_to_action_style: pass1.content_blueprint.cta_formulas.join(' / '),
        }

        console.log(`[analyze-style] ✓ Deep Style DNA — score global: ${scores.overall}/100`)
        return NextResponse.json({ success: true, analysis, platform, profile_url })
    } catch (err) {
        console.error('[analyze-style] Error:', err)
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
