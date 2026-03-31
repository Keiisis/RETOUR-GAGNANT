import { NextRequest, NextResponse } from "next/server";
import { fetchWithGroqRotation } from "@/lib/groq";

const SYSTEM_PROMPTS: Record<string, string> = {
    patrimoine: `Tu es un curateur d'art et historien spécialiste du Bénin.
Ton but est de transformer des descriptions factuelles en récits immersifs, passionnants et poétiques pour la diaspora.
Utilise un ton noble, évocateur et fier. Évite les répétitions. Sois précis sur les détails culturels et historiques.`,

    testimonial: `Tu es un rédacteur marketing expert en authenticité.
Ton but est de rendre les témoignages clients plus fluides, professionnels et impactants, tout en gardant l'authenticité de l'avis original.
Corrige la grammaire, améliore le vocabulaire, mais garde le sentiment et la voix d'origine.`,

    service: `Tu es un expert en marketing de services premium pour la diaspora africaine.
Ton but est d'optimiser les descriptions de services pour qu'elles soient claires, convaincantes et orientées bénéfice client (valeur ajoutée, sécurité, professionnalisme).
Mets en avant les avantages concrets et la confiance.`,

    generic: `Tu es un expert en rédaction web premium.
Optimise ce texte pour qu'il soit plus clair, professionnel et engageant.
Améliore le style sans trahir le sens original.`
};

export async function POST(request: NextRequest) {
    try {
        const { text, type, instructions } = await request.json();

        if (!text || typeof text !== 'string' || !text.trim()) {
            return NextResponse.json({ text: "Texte vide." }, { status: 400 });
        }

        const systemPrompt = SYSTEM_PROMPTS[type as string] || SYSTEM_PROMPTS.generic;
        const userPrompt = instructions
            ? `Optimise le texte suivant. Instructions additionnelles : ${instructions}\n\nTexte à optimiser :\n${text}`
            : `Optimise le texte suivant pour le rendre plus professionnel et captivant :\n\n${text}`;

        const response = await fetchWithGroqRotation({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 2000,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Optimize] Groq API error:", errorText);
            return NextResponse.json(
                { text: "Erreur de connexion à l'IA. Veuillez réessayer." },
                { status: 502 }
            );
        }

        const data = await response.json();
        const optimizedText = data.choices?.[0]?.message?.content?.trim() || text;

        return NextResponse.json({ text: optimizedText });
    } catch (error) {
        console.error("[Optimize] Error:", error);
        return NextResponse.json(
            { text: "Une erreur est survenue lors de l'optimisation." },
            { status: 500 }
        );
    }
}
