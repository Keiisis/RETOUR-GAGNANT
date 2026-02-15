import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const galleryDir = path.join(process.cwd(), "public", "images", "gallery");

        if (!fs.existsSync(galleryDir)) {
            return NextResponse.json({ images: [] });
        }

        const files = fs.readdirSync(galleryDir)
            .filter(f => /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(f))
            .sort()
            .map((filename, index) => ({
                id: index + 1,
                src: `/images/gallery/${filename}`,
                filename,
            }));

        return NextResponse.json({ images: files });
    } catch (error) {
        console.error("Gallery scan error:", error);
        return NextResponse.json({ images: [] });
    }
}
