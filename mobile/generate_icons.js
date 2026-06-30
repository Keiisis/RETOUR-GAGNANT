/**
 * generate_icons.js
 * Ajoute le fond bleu marine (#1B2A4A) derrière le logo transparent
 * pour générer des icônes compatibles iOS & Android
 *
 * Usage: node generate_icons.js
 *
 * Entrée : ./assets/icon.png (transparent)
 * Sortie :
 *   - ./assets/icon-ios.png       (1024x1024, fond bleu marine, pour iOS)
 *   - ./assets/adaptive-icon.png  (1024x1024, transparent, pour Android foreground)
 *   - ./assets/splash-icon.png    (inchangé, transparent — le fond vient de app.json)
 *   - ./assets/icon.png           (1024x1024, fond bleu marine — fallback global)
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const BG_COLOR = '#1B2A4A';
const SIZE = 1024;

async function main() {
    const assetsDir = path.join(__dirname, 'assets');
    const srcPath = path.join(assetsDir, 'icon.png');

    if (!fs.existsSync(srcPath)) {
        console.error('❌ Fichier introuvable:', srcPath);
        process.exit(1);
    }

    console.log('🎨 Chargement du logo transparent...');
    const logo = await loadImage(srcPath);
    const logoW = logo.width;
    const logoH = logo.height;
    console.log(`   Logo original: ${logoW}x${logoH}`);

    // ═══ 1. Icône avec fond bleu marine (iOS + fallback global) ═══
    console.log('\n📱 Génération icon-ios.png (fond bleu marine)...');
    const canvasIos = createCanvas(SIZE, SIZE);
    const ctxIos = canvasIos.getContext('2d');

    // Fond bleu marine
    ctxIos.fillStyle = BG_COLOR;
    ctxIos.fillRect(0, 0, SIZE, SIZE);

    // Logo centré (avec marge de ~10% pour respiration)
    const margin = SIZE * 0.05;
    const drawSize = SIZE - margin * 2;
    const offsetX = (SIZE - drawSize) / 2;
    const offsetY = (SIZE - drawSize) / 2;
    ctxIos.drawImage(logo, offsetX, offsetY, drawSize, drawSize);

    const iosBuffer = canvasIos.toBuffer('image/png');
    fs.writeFileSync(path.join(assetsDir, 'icon-ios.png'), iosBuffer);
    console.log(`   ✅ icon-ios.png (${(iosBuffer.length / 1024).toFixed(0)} KB)`);

    // Écraser aussi icon.png avec la version fond bleu
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), iosBuffer);
    console.log(`   ✅ icon.png écrasé (fond bleu marine)`);

    // ═══ 2. Adaptive icon Android (transparent, juste le logo) ═══
    console.log('\n🤖 Génération adaptive-icon.png (transparent, Android)...');
    const canvasAdaptive = createCanvas(SIZE, SIZE);
    const ctxAdaptive = canvasAdaptive.getContext('2d');

    // Fond transparent (par défaut du canvas)
    // Logo centré avec marge safe zone Android (18% de chaque côté)
    const safeMargin = SIZE * 0.15;
    const safeSize = SIZE - safeMargin * 2;
    const safeX = (SIZE - safeSize) / 2;
    const safeY = (SIZE - safeSize) / 2;
    ctxAdaptive.drawImage(logo, safeX, safeY, safeSize, safeSize);

    const adaptiveBuffer = canvasAdaptive.toBuffer('image/png');
    fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptiveBuffer);
    console.log(`   ✅ adaptive-icon.png (${(adaptiveBuffer.length / 1024).toFixed(0)} KB)`);

    // ═══ 3. Notification icon (monochrome blanc sur transparent) ═══
    console.log('\n🔔 Génération notification-icon.png...');
    const canvasNotif = createCanvas(96, 96);
    const ctxNotif = canvasNotif.getContext('2d');
    ctxNotif.drawImage(logo, 8, 8, 80, 80);

    const notifBuffer = canvasNotif.toBuffer('image/png');
    fs.writeFileSync(path.join(assetsDir, 'notification-icon.png'), notifBuffer);
    console.log(`   ✅ notification-icon.png (${(notifBuffer.length / 1024).toFixed(0)} KB)`);

    console.log('\n✅ Toutes les icônes ont été générées !');
    console.log('\n📋 Configuration app.json recommandée :');
    console.log(`   "icon": "./assets/icon.png"             → fond bleu marine (iOS)`);
    console.log(`   "adaptiveIcon.foregroundImage": "./assets/adaptive-icon.png" → transparent`);
    console.log(`   "adaptiveIcon.backgroundColor": "${BG_COLOR}" → Android affiche bleu derrière`);
    console.log(`   "splash.backgroundColor": "${BG_COLOR}"   → splash bleu marine`);
}

main().catch(err => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
});
