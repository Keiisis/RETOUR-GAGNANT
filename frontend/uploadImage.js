const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ywvsfhqdtkgzavxsumnk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function upload() {
    const filePath = path.join(__dirname, 'public/images/image_RGB.jpg');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }
    const fileData = fs.readFileSync(filePath);

    // ensure the bucket exists
    await supabase.storage.createBucket('gallery', { public: true }).catch(err => {
        // Ignore if already exists
    });

    const { data, error } = await supabase.storage.from('gallery').upload('portfolio/image_RGB.jpg', fileData, {
        upsert: true,
        contentType: 'image/jpeg'
    });
    if (error) {
        console.error('Error uploading:', error);
    } else {
        // get public url
        const { data: publicUrl } = supabase.storage.from('gallery').getPublicUrl('portfolio/image_RGB.jpg');
        console.log('UPLOADED_URL:', publicUrl.publicUrl);
    }
}
upload();
