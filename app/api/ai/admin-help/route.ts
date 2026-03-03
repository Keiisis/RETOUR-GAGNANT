import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/api-auth";

const SYSTEM_PROMPT = `Tu es l'Expert Architecture & Admin de Retour Gagnant Bénin.
Ton rôle est d'aider l'administrateur à gérer le site, rédiger du contenu, et optimiser les opérations.

=== TES CAPACITÉS ===
- Rédiger des descriptions captivantes pour le patrimoine béninois
- Analyser les données de performance (visites, taux de clic)
- Proposer des améliorations pour l'espace admin
- Aider à la configuration technique

=== TON TON ===
Professionnel, expert, orienté vers l'action, et passionné par le rayonnement du Bénin.

=== CONTEXTE ACTUEL ===
L'administration utilise Refine + Supabase. Le site est une plateforme premium pour la diaspora béninoise.`;

export async function POST(request: NextRequest) {
    try {
        // 🛡️ SECURITY: Require 'admin' role
        const auth = await verifyApiAuth(request, 'admin')
        if (!auth.authenticated) return auth.error!

        const { prompt } = await request.json();
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { text: "L'assistant IA n'est pas configuréé. Veuillez ajouter GROQ_API_KEY à vos variables d'environnement." },
                { status: 500 }
            );
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API error:", errorText);
            return NextResponse.json(
                { text: "Je rencontre un souci technique avec Groq. Veuillez vérifier la console." },
                { status: 500 }
            );
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

        return NextResponse.json({ text });
    } catch (error) {
        console.error("AI Admin Help Error:", error);
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { text: "Une erreur est survenue : " + message },
            { status: 500 }
        );
    }
}
