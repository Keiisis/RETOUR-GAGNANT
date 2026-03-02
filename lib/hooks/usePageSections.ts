import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePageSections(page: string) {
    const [sections, setSections] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            try {
                const { data, error } = await supabase
                    .from('page_sections')
                    .select('section_key, content')
                    .eq('page', page)
                    .eq('is_active', true)

                if (!error && data) {
                    const map: Record<string, any> = {}
                    data.forEach((row: any) => {
                        map[row.section_key] = row.content
                    })
                    setSections(map)
                }
            } catch {
                // fallback to empty - pages use their own defaults
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [page])

    return { sections, loading }
}
