import { NextRequest, NextResponse } from "next/server";
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';

const SYSTEM_PROMPT = `Tu es un assistant polyglotte et traducteur assermenté pour Retour Gagnant Bénin.
Ton seul rôle est d'analyser le contexte du client (nationalité possible, anciennes notes, numéro de téléphone) et de traduire LE TEXTE que je te fournis.
1. Tu dois décider QUELLE EST LA MEILLEURE LANGUE (ex: Anglais, Français, Espagnol, Fon) en te basant sur le Contexte. Si le contexte ne donne pas d'indice, garde la langue actuelle ou traduis en Anglais si c'est un pays anglophone.
2. Tu dois formater ta réponse en JSON UNIQUEMENT, avec ce format strict :
{ "targetLanguage": "Langue choisie", "translated": "Texte traduit complètement" }
3. Ne mets RIEN d'autre que ce JSON (pas de bloc "\`\`\`json" ni de commentaires).`;

export async function POST(request: NextRequest) {
    try {
        const { text, clientContext } = await request.json();
        if (GROQ_KEYS.length === 0) {
            return NextResponse.json({ error: "La clé API Groq n'est pas configurée." }, { status: 500 });
        }

        if (!text) {
            return NextResponse.json({ error: "Texte manquant." }, { status: 400 });
        }

        const instruction = `Contexte Client (Indices pour deviner sa langue) :
${JSON.stringify(clientContext, null, 2)}

Brouillon actuel (à traduire dans la bonne langue pour ce client) :
${text}`;

        const response = await fetchWithGroqRotation({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: instruction },
            ],
            temperature: 0.1,
            max_tokens: 1500,
            response_format: { type: "json_object" }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API error (translate context):", errorText);
            return NextResponse.json({ error: "Erreur technique de traduction." }, { status: 500 });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "{}";
        
        try {
            const json = JSON.parse(content);
            return NextResponse.json(json);
        } catch {
            console.error("Failed to parse JSON translate:", content);
            return NextResponse.json({ targetLanguage: "Inconnue", translated: text });
        }

    } catch (error) {
        console.error("Translate Email Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
