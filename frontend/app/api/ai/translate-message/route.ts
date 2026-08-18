import { NextRequest, NextResponse } from "next/server";
import { fetchWithGroqRotation, GROQ_KEYS, GROQ_MODEL } from '@/lib/groq';

// Modèle puissant pour détection de langue précise
const DETECT_MODEL = GROQ_MODEL;
// Modèle rapide pour traduction simple
const TRANSLATE_MODEL = "llama-3.1-8b-instant";

const DETECT_SYSTEM = `Tu es un expert en détection de langue et traduction pour Retour Gagnant Bénin (service basé au Bénin, Afrique de l'Ouest).

Exemples de langues à détecter :
- "Bonjour, je voudrais un rendez-vous" → Français
- "Hello, I need help" → English
- "Hola, necesito ayuda" → Español
- "Mi dzo be" → Fon
- "Ẹ káàárọ" → Yoruba
- "Merhaba" → Turc

RÈGLE CRITIQUE : Si le texte contient des mots français comme "bonjour", "merci", "je", "vous", "nous", "pour", "les", "des", "est", "avec" → la langue est OBLIGATOIREMENT "Français".

Réponds UNIQUEMENT en JSON valide, rien d'autre.`;

const TRANSLATE_SYSTEM = `Tu es un traducteur expert. Traduis le texte fourni exactement dans la langue cible.
NE RAJOUTE AUCUN TEXTE, SEULEMENT LA TRADUCTION.`;

const SUGGEST_SYSTEM = `Tu es un assistant expert en relation client pour Retour Gagnant Bénin (service d'accompagnement pour retour au Bénin depuis la diaspora).

Génère 3 suggestions de réponse courtes et professionnelles pour un agent, dans la langue du client.
Chaque suggestion doit être utile, naturelle et adaptée au contexte du message client.

Format de réponse : JSON avec une liste "suggestions" de 3 chaînes de texte courtes (max 80 mots chacune).
Exemple : {"suggestions": ["Bonjour, je reviens vers vous rapidement.", "Merci pour votre message, je traite votre demande.", "Je vous contacte dans les 24h pour confirmer."]}`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { text, mode, targetLanguage, language, history } = body;

        if (GROQ_KEYS.length === 0) {
            return NextResponse.json(
                { error: "La clé API Groq n'est pas configurée." },
                { status: 500 }
            );
        }

        // ─── Mode : suggest_reply ───────────────────────────────────────────
        if (mode === "suggest_reply") {
            if (!text) {
                return NextResponse.json({ error: "Texte manquant." }, { status: 400 });
            }

            const clientLang = language || "Français";
            const historyContext = history && history.length > 0
                ? `\n\nHistorique récent de la conversation :\n${history.slice(-4).map((m: { role: string; content: string }) => `${m.role === 'client' ? 'Client' : 'Agent'}: ${m.content}`).join('\n')}`
                : "";

            const instruction = `Message du client (en ${clientLang}) :
"${text}"${historyContext}

Génère 3 suggestions de réponse courtes en ${clientLang} pour l'agent. Format JSON : {"suggestions": ["...", "...", "..."]}`;

            const response = await fetchWithGroqRotation({
                model: DETECT_MODEL,
                messages: [
                    { role: "system", content: SUGGEST_SYSTEM },
                    { role: "user", content: instruction },
                ],
                temperature: 0.7,
                max_tokens: 500,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Groq suggest_reply error:", errorText);
                return NextResponse.json({ suggestions: [] });
            }

            const data = await response.json();
            const output = data.choices?.[0]?.message?.content?.trim() || "";

            try {
                const cleaned = output.replace(/```json/g, "").replace(/```/g, "").trim();
                const json = JSON.parse(cleaned);
                return NextResponse.json({ suggestions: json.suggestions || [] });
            } catch {
                console.error("Failed to parse suggestions JSON:", output);
                return NextResponse.json({ suggestions: [] });
            }
        }

        // ─── Mode : detect_and_translate ───────────────────────────────────
        if (mode === "detect_and_translate") {
            if (!text) {
                return NextResponse.json({ error: "Texte manquant." }, { status: 400 });
            }

            const instruction = `Détecte la langue du texte suivant et traduis-le en Français.
Réponds UNIQUEMENT avec ce JSON (rien d'autre) : {"sourceLanguage": "NomDeLaLangue", "translated": "TexteEnFrançais"}

Texte à analyser : "${text}"`;

            const response = await fetchWithGroqRotation({
                model: DETECT_MODEL,
                messages: [
                    { role: "system", content: DETECT_SYSTEM },
                    { role: "user", content: instruction },
                ],
                temperature: 0.05,
                max_tokens: 800,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Groq detect error:", errorText);
                return NextResponse.json({ sourceLanguage: "Inconnue", translated: text });
            }

            const data = await response.json();
            const output = data.choices?.[0]?.message?.content?.trim() || "";

            try {
                const cleaned = output.replace(/```json/g, "").replace(/```/g, "").trim();
                const json = JSON.parse(cleaned);
                return NextResponse.json(json);
            } catch {
                console.error("Failed to parse detect JSON:", output);
                return NextResponse.json({ sourceLanguage: "Inconnue", translated: output });
            }
        }

        // ─── Mode : translate_to ────────────────────────────────────────────
        if (mode === "translate_to") {
            if (!targetLanguage) {
                return NextResponse.json({ error: "Langue cible non spécifiée." }, { status: 400 });
            }
            if (!text) {
                return NextResponse.json({ error: "Texte manquant." }, { status: 400 });
            }

            const instruction = `Traduis le texte suivant en ${targetLanguage}. Ne renvoie QUE la traduction, sans guillemets, sans commentaires.

Texte : ${text}`;

            const response = await fetchWithGroqRotation({
                model: TRANSLATE_MODEL,
                messages: [
                    { role: "system", content: TRANSLATE_SYSTEM },
                    { role: "user", content: instruction },
                ],
                temperature: 0.1,
                max_tokens: 1500,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Groq translate error:", errorText);
                return NextResponse.json({ error: "Erreur technique de traduction." }, { status: 500 });
            }

            const data = await response.json();
            const output = data.choices?.[0]?.message?.content?.trim() || "";
            return NextResponse.json({ translated: output });
        }

        return NextResponse.json({ error: "Mode invalide." }, { status: 400 });

    } catch (error) {
        console.error("Translation Message Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
