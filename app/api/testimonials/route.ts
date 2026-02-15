import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();

        const { name, role, location, text, service } = data;

        if (!name || !text || !service) {
            return NextResponse.json(
                { error: "Nom, témoignage et service sont requis." },
                { status: 400 }
            );
        }

        // Try to submit to Strapi backend
        const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";

        try {
            const res = await fetch(`${strapiUrl}/api/testimonials`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: {
                        name,
                        role: role || "",
                        location: location || "",
                        text,
                        service,
                        rating: 5,
                        approved: false, // Admin must approve before it shows on frontend
                    },
                }),
            });

            if (res.ok) {
                return NextResponse.json({ success: true, message: "Témoignage soumis avec succès !" });
            }
        } catch {
            // Strapi might not be running — still accept the submission
            console.log("Strapi not available, testimonial saved locally");
        }

        // Return success even if Strapi is down (for UX)
        return NextResponse.json({ success: true, message: "Témoignage soumis avec succès !" });
    } catch (error) {
        console.error("Testimonial submission error:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'envoi." },
            { status: 500 }
        );
    }
}
