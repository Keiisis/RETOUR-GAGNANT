import { supabase } from '@/lib/supabase'

// Default fallback values
const DEFAULT_COMPANY_INFO = {
    email: 'retourgagnant2bj@gmail.com',
    phoneDisplay: '+229 01 60 32 21 21',
    phoneDial: '+2290160322121',
    whatsappLink: 'https://wa.me/22960322121',
    address: 'Haie-Vive Cocotiers, Carré n°1158',
    addressShort: 'Haie-Vive, Cotonou',
    hours: 'Lun - Ven : 8h - 18h',
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
