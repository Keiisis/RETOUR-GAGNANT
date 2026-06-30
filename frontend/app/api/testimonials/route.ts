import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Variables Supabase manquantes');
    return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/testimonials — fetch all approved testimonials for public display
export async function GET() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .eq('approved', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase select error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const testimonials = (data || []).map(t => {
            let location = t.location || '';
            let role = t.role || '';
            if (!role && location.includes(' | ')) {
                const parts = location.split(' | ');
                location = parts[0];
                role = parts[1];
            }
            return {
                id: t.id,
                name: t.name,
                role: role || 'Client',
                text: t.text,
                location: location || 'Bénin',
                rating: t.rating || 5,
                service: t.service || 'Général',
                photoUrl: t.photo || null
            };
        });

        return NextResponse.json({ testimonials });
    } catch (error) {
        console.error("Testimonials fetch error:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des témoignages." },
            { status: 500 }
        );
    }
}

// POST /api/testimonials — public submission from frontend
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const data = await request.json();

        const { name, role, location, text, service, rating, photo_url, photo } = data;

        if (!name || !text) {
            return NextResponse.json(
                { error: "Nom et témoignage sont requis." },
                { status: 400 }
            );
        }

        // Combine location and role into location field if the table does not support role column natively
        const combinedLocation = role ? `${location || ''} | ${role}` : (location || null);

        // Insert using service role key (bypasses RLS)
        const { data: inserted, error: supabaseError } = await supabase
            .from('testimonials')
            .insert([{
                name,
                location: combinedLocation,
                text,
                service: service || null,
                rating: rating ?? 5,
                photo: photo_url || photo || null,
                approved: false, // Admin must approve
                created_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (supabaseError) {
            console.error("Supabase insert error:", supabaseError);
            throw supabaseError;
        }

        return NextResponse.json(
            { success: true, testimonial: inserted },
            { status: 201 }
        );
    } catch (error) {
        console.error("Testimonial submission error:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'envoi du témoignage." },
            { status: 500 }
        );
    }
}

