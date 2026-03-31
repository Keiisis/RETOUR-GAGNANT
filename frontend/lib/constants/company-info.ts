import { supabase } from '@/lib/supabase'

// Default fallback values
const DEFAULT_COMPANY_INFO = {
    email: 'contact@retourgagnantbenin.bj',
    phoneDisplay: '+229 01 60 32 21 21',
    phoneDial: '+2290160322121',
    phone2Display: '+229 01 94 35 50 50',
    phone2Dial: '+2290194355050',
    whatsappLink: 'https://wa.me/2290160322121',
    whatsapp2Link: 'https://wa.me/2290194355050',
    address: 'Haie-Vive Cocotiers, Carré n°1158',
    addressShort: 'Haie-Vive, Cotonou',
    hours: 'Lun - Ven : 8h - 18h\nSamedi sur Rendez-vous : 8h - 13h',
    socials: {
        facebook: '#',
        instagram: '#',
        linkedin: '#',
        twitter: '#',
    },
}

export const COMPANY_INFO = DEFAULT_COMPANY_INFO

export async function getCompanyInfo() {
    try {
        const { data, error } = await supabase
            .from('page_sections')
            .select('content')
            .eq('page', 'contact')
            .eq('section_key', 'company_info')
            .single()

        if (!error && data?.content) {
            return { ...DEFAULT_COMPANY_INFO, ...data.content }
        }
    } catch {
        // fallback
    }
    return DEFAULT_COMPANY_INFO
}
