import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

        // Save to Supabase
        const { error: supabaseError } = await supabase
            .from('testimonials')
            .insert([{
                name,
                role: role || "",
                location: location || "",
                text,
                service,
                rating: 5,
                approved: false, // Admin must approve
            }]);

        if (supabaseError) throw supabaseError;
    } catch (error) {
        console.error("Testimonial submission error:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'envoi." },
            { status: 500 }
        );
    }
}
