'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wrench, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface MaintenanceGuardProps {
    children: React.ReactNode
}

export function MaintenanceGuard({ children }: MaintenanceGuardProps) {
    const [checking, setChecking] = useState(true)
    const [maintenance, setMaintenance] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetch('/api/boutique/status')
            .then(res => res.json())
            .then(data => {
                setMaintenance(data.maintenance)
                setMessage(data.message || '')
            })
            .catch(() => { })
            .finally(() => setChecking(false))
    }, [])

    if (checking) return null

    if (maintenance) {
        return (
            <div className="min-h-screen bg-[#05080a] flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-lg text-center space-y-8"
                >
                    <div className="w-24 h-24 rounded-full bg-[#FCD116]/10 border-2 border-[#FCD116]/20 flex items-center justify-center mx-auto">
                        <Wrench size={40} className="text-[#FCD116]" />
                    </div>

                    <div>
                        <h1 className="text-4xl font-black text-white font-heading mb-4">
                            Boutique en <span className="text-[#FCD116]">Maintenance</span>
                        </h1>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-gray-600">
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            Nous revenons tres bientot
                        </span>
                    </div>

                    <Link href="/">
                        <Button className="h-14 px-8 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 gap-2">
                            <ArrowLeft size={18} /> Retour a l'accueil
                        </Button>
                    </Link>
                </motion.div>
            </div>
        )
    }

    return <>{children}</>
}
