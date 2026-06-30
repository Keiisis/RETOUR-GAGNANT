'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTranslation, T } from '@/lib/translation'

interface PatrimoineItem {
    id: string
    title: string
    description: string
    imagename: string
    location?: string
}

const fallbackItems: PatrimoineItem[] = [
    { id: 'f1', title: 'Porte du Non-Retour', description: 'Symbole mémoriel historique de la traite transatlantique.', imagename: 'Porte du Non-Retour.jpg' },
    { id: 'f2', title: 'Palais Royaux d\'Abomey', description: 'Vestiges de la puissance du Royaume de Dahomey.', imagename: 'Palais Royaux Abomey.jpg' },
    { id: 'f3', title: 'Cité Lacustre de Ganvié', description: 'La Venise de l\'Afrique, entièrement bâtie sur l\'eau.', imagename: 'Cité Lacustre Ganvié.jpg' },
    { id: 'f4', title: 'Tata Somba', description: 'Architecture forteresse unique au monde.', imagename: 'TATA SOMBA.jpg' },
    { id: 'f5', title: 'Zangbeto', description: 'Gardien de la nuit et police traditionnelle vaudou.', imagename: 'Zangpeto.jpg' },
    { id: 'f6', title: 'Chutes de Kota', description: 'Un havre de fraîcheur et de nature préservée.', imagename: 'Chutes de Kota.jpg' },
    { id: 'f7', title: 'Place de l\'Amazone', description: 'Monument majestueux rendant hommage aux guerrières Agoodjié du Dahomey.', imagename: 'place-amazone.jpg' },
    { id: 'f8', title: 'Monument Bio Guerra', description: 'Statue équestre honorant le héros national Bio Guerra.', imagename: 'bio-guera.jpg' },
    { id: 'f9', title: 'Temple des Pythons', description: 'Site sacré à Ouidah dédié au culte du python.', imagename: 'ouidah-temple-python-3.jpg' },
    { id: 'f10', title: 'Grand-Popo', description: 'Cité balnéaire pittoresque entre mer et fleuve.', imagename: 'Grand-Popo.jpg' },
    { id: 'f11', title: 'Mur de Fresques de Cotonou', description: 'L\'une des plus longues fresques murales d\'Afrique.', imagename: 'Mur de Fresque de Cotonou.jpg' },
    { id: 'f12', title: 'Parc National de la Pendjari', description: 'Joyau de la biodiversité ouest-africaine.', imagename: 'Parc Pendjari.jpg' },
]

export default function PatrimoineList() {
    const { t } = useTranslation()
    const [items, setItems] = useState<PatrimoineItem[]>(fallbackItems)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data, error } = await supabase
                    .from('patrimoine')
                    .select('*')
                    .order('created_at', { ascending: true })

                if (!error && data && data.length > 0) {
                    setItems(data)
                }
            } catch {
                console.warn('Using fallback patrimoine data.')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    if (loading) return <div className="text-center py-10 text-slate-600"><T>Chargement du patrimoine...</T></div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item, index) => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-500/20 rounded-2xl overflow-hidden transition-all duration-300 group"
                >
                    <div className="relative h-64 w-full overflow-hidden">
                        <Image
                            src={`/assets/patrimoine/${item.imagename}`}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                                e.currentTarget.src = '/images/hero-bg.jpg'
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <h3 className="absolute bottom-4 left-4 text-xl font-bold text-white font-heading">
                            {t(item.title)}
                        </h3>
                    </div>
                    <div className="p-6">
                        <p className="text-slate-600 text-sm leading-relaxed line-clamp-4">
                            {t(item.description)}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}
