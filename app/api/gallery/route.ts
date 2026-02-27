import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        // 1. Get local images
        const galleryDir = path.join(process.cwd(), "public", "images", "gallery");
        let localFiles: any[] = [];

        try {
            if (fs.existsSync(galleryDir)) {
                const files = fs.readdirSync(galleryDir);
                localFiles = files
                    .filter(file => /\.(jpg|jpeg|png|webp|avif)$/i.test(file))
                    .map((file, index) => ({
                        id: `local-${index}`,
                        src: `/images/gallery/${file}`,
                        filename: file,
                    }));
            }
        } catch (dirError) {
            console.error("Local gallery read error:", dirError);
        }

        // 2. Get Supabase images
        const { data: supabaseData, error: supabaseError } = await supabase
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false });

        const supabaseFiles = (supabaseData || [])
            .filter((item: any) => (item.url && item.url.trim() !== "") || (item.src && item.src.trim() !== "") || (item.image_url && item.image_url.trim() !== ""))
            .map((item: any, index: number) => ({
                id: item.id || `supabase-${index}`,
                src: item.url || item.src || item.image_url,
                filename: item.filename || item.title || `image-${index}`,
            }));

        // 3. Combine both (local first for speed, then supabase)
        const allImages = [...localFiles, ...supabaseFiles];

        return NextResponse.json({ images: allImages });
    } catch (error) {
        console.error("Gallery fetch error:", error);
        return NextResponse.json({ images: [] });
    }
}
