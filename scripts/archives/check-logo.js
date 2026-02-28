const fs = require('fs');

function getJpegDimensions(p) {
    try {
        const buffer = fs.readFileSync(p);
        let i = 2;
        while (i < buffer.length) {
            if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC2)) {
                return {
                    height: (buffer[i + 5] << 8) + buffer[i + 6],
                    width: (buffer[i + 7] << 8) + buffer[i + 8]
                };
            }
            // Move to next marker
            i += 2 + ((buffer[i + 2] << 8) + buffer[i + 3]);
        }
    } catch (e) {
        console.error(e);
    }
    return null;
}

const logoPath = 'c:/Users/Keiis Osiris/Desktop/RETOUR GAGNANT/frontend/public/images/logo.jpg';
if (fs.existsSync(logoPath)) {
    const dim = getJpegDimensions(logoPath);
    console.log('Logo info:', dim);
    if (dim) {
        if (dim.width === dim.height) {
            console.log('Aspect ratio is perfect (SQUARE).');
        } else {
            console.log('Aspect ratio is NOT SQUARE: ' + dim.width + 'x' + dim.height);
        }
    }
} else {
    console.log('Logo not found at:', logoPath);
}
