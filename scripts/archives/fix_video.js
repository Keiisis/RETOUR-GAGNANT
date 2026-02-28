const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ywvsfhqdtkgzavxsumnk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM');

async function fix() {
    console.log("Updating settings for video...");
    await s.from('settings').update({ value: "VOTRE RETOUR GAGNANT" }).eq('key', 'frontend_hero_title');
    await s.from('settings').update({ value: "Réalisez vos ambitions au cœur du Bénin : là où vos racines deviennent des héritages d'exception." }).eq('key', 'frontend_hero_subtitle');
    await s.from('settings').update({ value: "/videos/hero.mp4" }).eq('key', 'frontend_hero_video');

    const { data } = await s.from('settings').select('key, value').in('key', ['frontend_hero_title', 'frontend_hero_subtitle', 'frontend_hero_video']);
    console.log("Updated values in DB:", data);
}

fix();
