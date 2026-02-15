import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, sujet, message } = body;

        if (!nom || !email || !message) {
            return NextResponse.json(
                { error: 'Nom, email et message sont requis.' },
                { status: 400 }
            );
        }

        // Try saving to Strapi
        try {
            await fetch(`${STRAPI_URL}/api/form-submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        nom,
                        prenom: prenom || '',
                        email,
                        sujet: sujet || 'Contact général',
                        message,
                        type: 'contact',
                        lu: false,
                    }
                }),
            });
        } catch {
            console.log('Strapi not available — form data logged only');
        }

        return NextResponse.json({ success: true, message: 'Message envoyé avec succès !' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erreur lors de l\'envoi du message.' },
            { status: 500 }
        );
    }
}
