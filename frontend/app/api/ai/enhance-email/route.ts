import { NextRequest, NextResponse } from "next/server";
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';

const SYSTEM_PROMPT = `Tu es un expert en communication et copywriting pour "Retour Gagnant Bénin" (une agence qui facilite les retours, investissements, nationalité béninoise, immobilier, etc.).
Ton seul rôle est d'améliorer et rendre professionnel un brouillon d'email écrit par un agent.

Règles:
1. Rends le texte extrêmement professionnel, chaleureux, convaincant et parfaitement rédigé (sans faute).
2. Adopte le ton officiel de KAGE / Retour Gagnant Bénin.
3. Conserve TOUTES les informations importantes et l'intention du brouillon.
4. NE rajoute pas d'entête complète (comme "De: Retour Gagnant") ni de footer générique sauf une formule de politesse finale (ex: "Cordialement, L'équipe Retour Gagnant Bénin").
5. Renvoyer UNIQUEMENT le texte final, sans commentaires additionnels de ta part.`;

export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();
        if (GROQ_KEYS.length === 0) {
            return NextResponse.json({ error: "La clé API Groq n'est pas configurée." }, { status: 500 });
        }

        if (!text) {
            return NextResponse.json({ error: "Texte manquant." }, { status: 400 });
        }

        const instruction = `Brouillon à améliorer :\n\n${text}`;

        const response = await fetchWithGroqRotation({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: instruction },
            ],
            temperature: 0.3,
            max_tokens: 1500,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API error (enhance):", errorText);
            return NextResponse.json({ error: "Erreur technique d'amélioration." }, { status: 500 });
        }

        const data = await response.json();
        const output = data.choices?.[0]?.message?.content?.trim() || "";

        return NextResponse.json({ enhanced: output });

    } catch (error) {
        console.error("Enhance Email Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
