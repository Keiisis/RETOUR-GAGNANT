import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/api-auth";
import { fetchWithGroqRotation, GROQ_MODEL } from "@/lib/groq";

const SYSTEM_PROMPT = `Tu es l'Expert Architecture & Admin de Retour Gagnant Bénin.
Ton rôle est d'aider l'administrateur à gérer le site, rédiger du contenu, et optimiser les opérations.

=== TES CAPACITÉS ===
- Rédiger des descriptions captivantes pour le patrimoine béninois et les services de la diaspora
- Analyser les données de performance (visites, taux de clic, conversions)
- Proposer des améliorations concrètes pour l'espace admin
- Aider à la configuration technique et à la stratégie digitale
- Générer du contenu marketing en français, anglais, espagnol, portugais, créole

=== TON TON ===
Professionnel, expert, orienté vers l'action, et passionné par le rayonnement du Bénin.
Réponds toujours en français sauf si l'administrateur écrit dans une autre langue.

=== CONTEXTE ACTUEL ===
La plateforme utilise Next.js + Supabase. C'est une plateforme premium pour la diaspora béninoise.
Les services principaux : nationalité béninoise, investissement, patrimoine, boutique.`;

export async function POST(request: NextRequest) {
    try {
        // Require admin role
        const auth = await verifyApiAuth(request, 'admin')
        if (!auth.authenticated) return auth.error!

        const { prompt } = await request.json();

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return NextResponse.json({ text: "Requête vide." }, { status: 400 });
        }

        const response = await fetchWithGroqRotation({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt.trim() },
            ],
            temperature: 0.7,
            max_tokens: 1500,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[AdminHelp] Groq API error:", errorText);
            return NextResponse.json(
                { text: "Erreur de connexion à l'IA. Vérifiez la configuration des clés Groq." },
                { status: 502 }
            );
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || "Désolé, je n'ai pas pu générer de réponse.";

        return NextResponse.json({ text });
    } catch (error) {
        console.error("[AdminHelp] Error:", error);
        const message = error instanceof Error ? error.message : 'Erreur inconnue'
        return NextResponse.json(
            { text: `Erreur serveur : ${message}` },
            { status: 500 }
        );
    }
}
