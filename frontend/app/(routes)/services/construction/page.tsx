'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ServiceLanding from '@/components/services/ServiceLanding'
import { DEFAULT_CONSTRUCTION } from '@/lib/content/construction'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'

export default function ConstructionPage() {
    const [c, setC] = useState<ServiceLandingContent>(DEFAULT_CONSTRUCTION)
    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase
                    .from('page_sections')
                    .select('content')
                    .eq('page', 'construction')
                    .eq('section_key', 'page_content')
                    .eq('is_active', true)
                    .single()
                if (data?.content) setC(mergeServiceLanding(DEFAULT_CONSTRUCTION, data.content as Partial<ServiceLandingContent>))
            } catch { /* fallback defaults */ }
        })()
    }, [])
    return <ServiceLanding content={c} />
}
