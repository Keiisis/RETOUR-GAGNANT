import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
    patrimoine: `Tu es un curateur d'art et historien spécialiste du Bénin. 
    Ton but est de transformer des descriptions factuelles en récits immersifs, passionnants et poétiques pour la diaspora.
    Utilise un ton noble, évocateur et fier. Évite les répétitions.`,

    testimonial: `Tu es un rédacteur marketing. Ton but est de rendre les témoignages clients plus fluides, professionnels et impactants, tout en gardant l'authenticité de l'avis original.
    Corrige la grammaire, améliore le vocabulaire, mais garde le sentiment d'origine.`,

    service: `Tu es un expert en marketing immobilier et services de conciergerie.
    Ton but est d'optimiser les descriptions de services pour qu'elles soient claires, convaincantes et orientées bénéfice client (valeur ajoutée, sécurité, professionnalisme).`,

    generic: `Tu es un expert en rédaction web. Optimise ce texte pour qu'il soit plus clair, professionnel et engageant.`
};

export async function POST(request: NextRequest) {
    try {
        const { text, type, instructions } = await request.json();
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { text: "L'IA n'est pas configuréée." },
                { status: 500 }
            );
        }

        const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.generic;
        const userPrompt = instructions
            ? `Optimise le texte suivant. Instructions additionnelles : ${instructions}\n\nTexte à optimiser :\n${text}`
            : `Optimise le texte suivant pour le rendre plus professionnel et captivant :\n\n${text}`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.6,
                max_tokens: 1500,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API error:", errorText);
            return NextResponse.json({ text: "Erreçur de connexion IA." }, { status: 500 });
        }

        const data = await response.json();
        const optimizedText = data.choices?.[0]?.message?.content || text;

        return NextResponse.json({ text: optimizedText });
    } catch (error) {
        console.error("AI Optimization Error:", error);
        return NextResponse.json({ text: "Une erreçur est survenue lors de l'optimisation." }, { status: 500 });
    }
}
