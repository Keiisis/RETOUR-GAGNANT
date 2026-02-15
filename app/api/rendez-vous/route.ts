import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, telephone, service, message } = body;

        if (!nom || !email) {
            return NextResponse.json(
                { error: 'Nom et email sont requis.' },
                { status: 400 }
            );
        }

        // Save to Strapi
        try {
            await fetch(`${STRAPI_URL}/api/form-submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        nom,
                        prenom: prenom || '',
                        email,
                        telephone: telephone || '',
                        sujet: `RDV (${service}) : ${body.date || 'Date N/A'} - ${body.timeSlot || 'Créneau N/A'} [${body.contactMethod}]`,
                        message: message || '',
                        type: 'rendez-vous',
                        lu: false,
                    }
                }),
            });
        } catch {
            console.log('Strapi not available — appointment data logged only');
        }

        return NextResponse.json({ success: true, message: 'Demande de rendez-vous envoyée !' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erreur lors de la soumission.' },
            { status: 500 }
        );
    }
}
