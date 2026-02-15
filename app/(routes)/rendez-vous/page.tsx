'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

import { MapPin, CheckCircle, Calendar, Phone, Clock, Video, MessagesSquare, Smartphone, MessageCircle } from 'lucide-react';
import { COMPANY_INFO } from '@/lib/constants/company-info';

// Benin cities — real positions on viewBox 0 0 1000 1000
const beninCities = [
    { name: "Cotonou", x: 490, y: 910, main: true },
    { name: "Porto-Novo", x: 545, y: 900, main: true },
    { name: "Parakou", x: 522, y: 547, main: false },
    { name: "Natitingou", x: 398, y: 301, main: false },
    { name: "Djougou", x: 418, y: 458, main: false },
    { name: "Kandi", x: 585, y: 209, main: false },
    { name: "Abomey", x: 480, y: 807, main: false },
    { name: "Bohicon", x: 483, y: 793, main: false },
    { name: "Ouidah", x: 440, y: 920, main: false },
    { name: "Malanville", x: 701, y: 91, main: false },
];

export default function RendezVousPage() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        nom: '', prenom: '', email: '', telephone: '', service: 'Passeport / Administratif', message: '',
        date: '', timeSlot: '', contactMethod: 'Appel WhatsApp',
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [hoveredCity, setHoveredCity] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const res = await fetch('/api/rendez-vous', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setStatus('success');
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            {/* Hero */}
            <section className="py-12 md:py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white">
                <div className="container mx-auto px-4 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <Calendar className="mx-auto mb-4 text-[#FCD116]" size={40} />
                        <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">Prendre Rendez-vous</h1>
                        <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto">
                            Planifiez une consultation gratuite avec nos experts.
                        </p>
                    </motion.div>
                </div>
            </section>

            <div className="container mx-auto px-4 py-8 md:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
                    {/* Left: Benin Map */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative"
                    >
                        <div className="sticky top-24">
                            <h3 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                                <MapPin className="text-[#008751]" size={22} />
                                Notre présence au Bénin
                            </h3>

                            {/* SVG Map of Benin */}
                            {/* SVG Map of Benin */}
                            <div className="relative bg-gradient-to-br from-[#0f141e] to-[#1a2a3a] rounded-2xl p-6 md:p-8 shadow-xl overflow-hidden">
                                {/* Background glow */}
                                <div className="absolute top-1/4 left-1/3 w-40 h-40 bg-[#008751]/20 rounded-full blur-[60px]" />
                                <div className="absolute bottom-1/4 right-1/3 w-32 h-32 bg-[#FCD116]/15 rounded-full blur-[50px]" />

                                <svg viewBox="250 0 550 960" className="w-full max-w-[240px] md:max-w-[280px] mx-auto" xmlns="http://www.w3.org/2000/svg">
                                    {/* Real Benin departments from bj.svg */}
                                    <g strokeLinejoin="round" strokeLinecap="round">
                                        {/* Alibori */}
                                        <path d="M723 307.1l-54.9 6.1-34.9 7.2-35 2.9-21.2-4.4-7.9-0.2-23.3 3.2-22.8-1.7-7.4 1.3-7.4 0.4-7.5 1.8-7 0.1 1.6-1-0.7-46.9 0.2-2.5 0.6-1.8 1.4-2.5 2.9-3.4 8.6-7.2-4.7-4.6-1.7-1.2-0.4-0.1-0.6 0-0.8-0.4-0.7-0.4-1.3-0.6-1.7-0.3-1.4-0.1-7.2-10.3-28.2-50.9-0.7-0.8 19.1-19.5 10.6-8.7 7.8-4.4 2-2 0.5-1.4-0.1-1.6 0.1-2.6 1.5-4.2 5.6-6.2 2-3.9 5.3-14.3-0.3-1.5-1.7-2.6-0.2-1.6 0.8-1.9 1.2-0.3 1.4 0.2 1.3-0.4 0.9-1.1 1.2-2.2 1-1 1.4-0.2 1.6 0.6 1-0.2 0.1-2.6-0.3-1.8-0.9-0.7-1.4-0.3-1.6-0.7-1.5-1.3-1-1.2-0.8-1.5-4.9-13.9-1.4-8.2-0.1-3.4 1.2-2.6 3.6-1.6 1.9-0.2 3.4 0.1 1.8-0.2 0.4-0.4 1.2-1.6 0.7-0.6 1.1 0.3 0.8 0.8 0.8 0.3 0.8-1.6 0.7-1.8 1-0.4 1.3 0.2 1.7 0 0.5 0.4 0.2 0.8 0.4 0.7 1.1-0.1 0.8-0.5 1.4-1.3 0.6-0.4 5.2-1.4 0.5 0.1 1.3 0.7 0.7 0.1 0.9-0.4 1.7-1.3 1-0.2 5.1 1.3 1.4-0.7 2-3.3 0.5-1.1 0.2-1.2 0.5-1 0.7-0.9 1.6-0.6 1.5 1 1.6-0.4 1.3-1 2.3-2.8 1.6-1.1 1.4-0.3 2.9 0.1 1.5-0.3 3.5-0.1 1.7-2.2 7 6.2 2.9 1.6 1.5 1.6 1.1 1.8 0.9 3.4 1.2 1.2 1.6 0.8 1.7 0.7 4.8 0.5 1.2 0.4 0.6 0.8 1.4 2.7 5.9 8.7 24.9 22.9 0.4 0.8 2 1.5 0.5 0.8 0.3 3.2 0.7 3.3 1.1 2.7 3.3 5.6 2.1 2.4 1.2 1.2 1.8 1.2 2 0.5 1.9-0.9 2.1-1.2 1.7 0.3 1.5 0.9 1.7 0.6 6.5 4 5.3 1.9 1.6 1.1 1.2 1.2 4.8 6.9 1 0.9 0.8 0.5 0.6 0.6 0.6 1.2 0.7 2.3 0.6 1.1 0.2 1.3 0.5 1.2 1.3 0.6 1.3 2.4 1 0.8-3.2 3.4-10 17.2-1.8 6.7-0.9 2.3-2.9 7.9 0.3 3.4 2.1 4 26 36.9 3.5 3.3 1.2 0.2 1.4-0.2 0.2 0 1.1 0 1.2 1.2-1.4 5.7 0 3.2 0.5 3 1.1 2.7 1.5 2.5 0 0.1 3 13.1-0.2 4.4-3.1 7.7-0.2 2.6 0.7 1.8 1.2 1.2 1.3 1.1 1.1 1.2 0.7 1.6 1.4 4.8 1.3 1.7 1.9 0.6 2 0.3 1.9 1.1 1.3 2.9 0.7 4.3 0 3.5z" fill="#008751" fillOpacity="0.5" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Borgou */}
                                        <path d="M493.7 323.8l7-0.1 7.5-1.8 7.4-0.4 7.4-1.3 22.8 1.7 23.3-3.2 7.9 0.2 21.2 4.4 35-2.9 34.9-7.2 54.9-6.1 0.1 4.6-1.1 3.9-3.7 7.4-1.3 3.9-0.2 7.6-0.9 2.7-2.2 2.8-2.3 0.4-9.3-4.9-3-0.6-2.9 0.9-2.8 2.9-1 1.4-0.4 0.9-0.1 2.9-0.6 1.7-3.7 5.7-2.9 6.7 0.1 2.7 2.1 3.4 9.8 10.2 1.3 1.9 0.4 2.3-0.4 2.6-0.1 0.8-1.3 3.3-1.8 1.3-2.1 1-2.3 2.2-0.9 2.4-0.9 12.6-1.5 2.9-4.7 5.6-3.8 7-2.5 2.4-8.8-0.9-5.6 1.5-10.4 4.3-2.4 1.7-1.3 3-0.3 3.3 0.5 2.9 1.8 4.5 1.2 4.5-1.1 3.8-4.7 2.7-2.5-0.2-2.9-0.5-2.3 0.7-1.1 3.7 0.2 0.9 0.7 1.9-0.1 0.8-8.9 11.6-1 1-2.4 0.7-1 0.8-2.8 4.6-0.6 4 1 4.1 1.8 4.7 0.5 2.4 0 9.5-0.9 3.1-3 5.7-4.8 15.1-2.2 4.6-3.6 2.4-9.9 2.6-1.7 0-1.4-0.7-1.4-0.9-1.6-0.8-1.6-0.2-4.4 0.2-1.6 0.3-1.5 1-1.3 1.3-1.4 1-1.9 0.3-11.2-0.9 0.5 3.8-0.3 9.3-0.8 4.1-0.5 0.9-1.6 2.4-0.4 0.3 0.3 1.2 0.6 0.4 0.7 0.2 0.5 1 0 2.3-1.8 4.2-0.6 2.2 0.2 1.3 0.8 2.3-0.2 1.3-0.8 0.7-2.4 1.2-0.9 1.1 0 1.5 0 0.2-76.6-0.8 1.2-5.2-0.8-0.9-0.4-0.2-0.9-0.4-14.5-4.1-2.9-1.4-1.4-0.8-1.1-1-1-1.1-0.9-1.1-0.5-1.1-0.5-1.2-0.6-3-0.2-2.4 0.3-7.2 0.3-1.7 0.7-5 0.9-3.6 1.2-3 0.2-0.8 0.1-1-0.2-1-0.7-1.2-0.4-0.5-0.5-0.4-4.3-2-1.1-0.8-0.7-0.6-0.9-1-0.8-1.1-0.8-1.3-0.3-0.7-0.6-3.2-0.4-4.6 0.1-8.4 0.7-5 2.1-6.3 1.3-1 1.1-0.7 0.7-0.2 2.4-0.4 3.4-0.2 5.4 0.1 0.8-0.2 0.8-0.2 0.6-0.4 0.6-0.4 0.8-0.8 0.6-0.8 0.6-2 5.7-37.7 0-2.1-1.3-2.6-2.4-2.2-3-3.1-1.9-3.1-0.3-0.7-2.8-8.1-0.2-1.9 0.1-2.6 1.3-7.7 1.1-4.2 0-2.9-1.3-7.2 1.3-2.2 0.1-0.1 0.2-0.2 0.1-0.6 0.2-0.7-1.3-3-0.6-2.7 0-0.6 0.2-0.9 0.5-1.1 1.1-1.4 0.8-0.7 0.8-0.5 1.3-0.7 1.5-0.4 7.9-0.3 2.4-0.5 5.7-2 1.3-0.8 1.1-0.9 1-1.1 0.5-0.6 0.3-1.8 0.1-3-1.1-10.5-2.1-6.7-0.4-2.4-2.2-5.6-0.7-1.1-0.9-1.2-3.7-3.5-0.9-1.1-0.5-1.2-0.1-0.4-0.2-0.7 0-2.3 0.2-2.1 1-2.4 1.7-3.1 3.7-4.8 0.4-0.3 0.5-0.5 3.1-1.7z" fill="#FCD116" fillOpacity="0.35" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Atakora */}
                                        <path d="M458.9 188.8l0.7 0.8 28.2 50.9 7.2 10.3 1.4 0.1 1.7 0.3 1.3 0.6 0.7 0.4 0.8 0.4 0.6 0 0.4 0.1 1.7 1.2 4.7 4.6-8.6 7.2-2.9 3.4-1.4 2.5-0.6 1.8-0.2 2.5 0.7 46.9-1.6 1-3.1 1.7-0.5 0.5-0.4 0.3-3.7 4.8-1.7 3.1-1 2.4-0.2 2.1 0 2.3 0.2 0.7 0.1 0.4 0.5 1.2 0.9 1.1 3.7 3.5 0.9 1.2 0.7 1.1 2.2 5.6 0.4 2.4 2.1 6.7 1.1 10.5-0.1 3-0.3 1.8-0.5 0.6-1 1.1-1.1 0.9-1.3 0.8-5.7 2-2.4 0.5-7.9 0.3-1.5 0.4-1.3 0.7-0.8 0.5-0.8 0.7-1.1 1.4-0.5 1.1-0.2 0.9 0 0.6 0.6 2.7-41.1-1.3-5.5 2-5.1 3-4.7 3.9-6.2 3.1-7.3 1.8-9.1-1.1-6.2-1.4-7-0.8-6.2-0.2-8.2 1.6-1.8 0.7 0-1.1-1.9-5-15.3-10.3-20.7-13.9-12.4-8.2-8.3-5.6-13.8-9.3-11-7.3-1.1-2.2-0.2-3.4 2.1-15.2 2.1-8.2 0.1-5.8-1.2-13.3 2.1-4.9 7.9-7.6 1.9-2.7 0.4-1.5 0.2-3.4 0.3-1.6 2.3-4.3-0.2-1.6-1.2-3-0.4-1.6 0.4-2.9 3.8-9.1 4.4 2.4 1.9 0.3 2.6 0 0.6-0.8 0.4-1.7-0.1-1.7-0.9-0.8-1.1-0.6-0.5-1.3-0.1-1.7 0.1-1.5 0.6-0.3 1.2-1.9 0.8-1.8 1-1.3 0.6-0.2 0.7 0.2 3.2 0.5 1 0.7 0.7 0.7 0.8 0.3 0.4 0.3 0.8 1.5 0.2 0.3 0.9 0 1.6-0.8 0.6-0.2 4.4 0.5 1.5 0.5 0.4 0.8 1 1.4 1.1 1 0.5-0.6 0.1-2.4-1.6-1.7-0.9-1.6-0.3-1.6 0-1.7-0.3-1.7-0.3 0-1.3-0.7-0.5-0.2-0.1-0.7 0.3-1.9-0.2-0.6-1.3-0.3-0.9 0.8-0.6 0.3-0.1-2.3 0.7-0.3 4.8-1.1 0.8-0.6 1-2.7 0.7-0.7 1.5 0 2.9 1.4 1.5 0.5-0.7-2.6-0.6-5-2.7-4.5 0.7-1.8 1.5-1.5 1.5-2.3 1.4 1.1 1.1 1.7-0.2 0.8 1.3 0 0.7-0.4 0.8-0.4 1.2-0.3 2.8 0.1 2.3 0.7 4.8 2.3 1.9-3.4 0.2-1.2-0.3-1.4-1.4-1.5-0.4-1.1 0.8-1.8 1.6 0.8 1.7 1.9 0.9 1.6 1-1.2 1-0.4 1 0.4 1 1.2 2.6-2.1-0.3-1.9-1.4-2.1-0.9-2.5 1.3-2.8 2.9-1.9 3.3-1.4 2.3-1.5-1.3-3.2 0.2-1.2 1.1-1.8 1.9-1.4 1.8-0.6 1.5-0.8 0.9-2.1 2.3 1.3 2.8 0.6 13.7 1.1-0.3 1-0.4 2.1-0.2 0.9 2.5-0.1 3 5.7 2.9-1 2.5-1.3 6.7-1.5 2.7-1.3 2.3-0.7 6.4 0.4 2.7-0.2 5.7-2.3 2.8-0.5 2.5 0.7 1.4-0.9 1.8 0.3 3.7 1.7 6.2 2.4 5.1 0.4 4-1.9 0.6-0.7z" fill="#008751" fillOpacity="0.4" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Donga */}
                                        <path d="M470 395.4l1.3 3-0.2 0.7-0.1 0.6-0.2 0.2-0.1 0.1-1.3 2.2 1.3 7.2 0 2.9-1.1 4.2-1.3 7.7-0.1 2.6 0.2 1.9 2.8 8.1 0.3 0.7 1.9 3.1 3 3.1 2.4 2.2 1.3 2.6 0 2.1-5.7 37.7-0.6 2-0.6 0.8-0.8 0.8-0.6 0.4-0.6 0.4-0.8 0.2-0.8 0.2-5.4-0.1-3.4 0.2-2.4 0.4-0.7 0.2-1.1 0.7-1.3 1-2.1 6.3-0.7 5-0.1 8.4 0.4 4.6 0.6 3.2 0.3 0.7 0.8 1.3 0.8 1.1 0.9 1 0.7 0.6 1.1 0.8 4.3 2 0.5 0.4 0.4 0.5 0.7 1.2 0.2 1-0.1 1-0.2 0.8-1.2 3-0.9 3.6-0.7 5-0.3 1.7-0.3 7.2 0.2 2.4 0.6 3 0.5 1.2 0.5 1.1 0.9 1.1 1 1.1 1.1 1 1.4 0.8 2.9 1.4 14.5 4.1 0.9 0.4 0.4 0.2 0.8 0.9-1.2 5.2-1.1 4.5 1.4 1.8 1 2 2.4 13.1-1.9 12.6 1 3.5 0.8 0.8-1.1 1.8-2.1 1.6-1.2 0.8-1.7 0.8-2.5 0.7-3.4 0.1-0.9 0-0.9-0.2-4-1.5-1.7-0.3-3.6 0-0.7-0.1-0.7-0.3-1.7-1.4-0.6-0.4-4.3-1.2-1.4-0.8-1.2-0.8-1.1-1-2.1-2.8-0.6-0.5-0.6-0.4-0.7-0.3-0.8-0.1-4.4 0-0.9-0.1-0.9-0.2-0.7-0.4-0.7-0.3-0.6-0.5-3.9-4.2-1.1-0.9-1.2-0.8-1.6-0.6-0.9-0.3-1.7 0.2-2.4 0.4-12.6 3.4-1.6 0.1-0.8 0-2.7 0.2-7.8-0.2-2.6-0.2-0.3-19.7-0.2-13.6-0.2-16-0.2-18.3-0.8-4-1.1-3.6-3-5.2-9-9.5-11.6-12.2-0.8-1.2-2.7-4.2-2.1-5.9-1-14.9-1.7-4.2-2.4 1.3-2.2-2.2-1.4-3.6-0.5-3 0.6-1.9 2.6-4 0.9-1.9 0.1-1.5 0-2.9 0.3-1.5 0.3-1.8-1.2-6.9-0.2-11.4-0.2-16.1-0.2-10.8 1.8-0.7 8.2-1.6 6.2 0.2 7 0.8 6.2 1.4 9.1 1.1 7.3-1.8 6.2-3.1 4.7-3.9 5.1-3 5.5-2 41.1 1.3z" fill="#008751" fillOpacity="0.45" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Collines */}
                                        <path d="M484.9 579.8l76.6 0.8 2.8 35.7 0.4 4.3-1.2 5-1.1 1.7-2.9 3.3-0.8 1.8 0 1.3 0.4 2.7 0 1.4-1.2 6-0.1 2.8 0.5 3.5 1.1 3.3 2.9 6.1 0.9 3.1 0 3.2-1.2 2.7-1.5 2.4-1.1 2.5-0.4 2.7-0.3 8.7-1.8 9.3-0.6 9.2-0.5 1.3-1.5 2.8-0.3 1.1 0.1 0.7 0.1 0.6 1.1 1.8 1.7 4.2 3.4 3.8 1.3 2.2 0.4 2.1-1.4 19.7-29.8-0.2-2 0.1-2.2 6.1-0.3 4.1 1 3.8-0.3 1.6-2.1 0.7-1.5 1-4.5 6.4-1.7 3.2 0.3 3.5 1.1 3.7-26-12-10.3-3.2-8.4-0.8-7.6 0.2-6.9-1.1-5.5-3.8-5.4-4.8-7.9-3.3-6.5-1.4-29.3 1.7-2.9-0.3 0-2.5-0.1-29-0.1-23.2 0.4-23.3 0.2-16.8-1.5-12.6-0.8-1.3-0.8-0.3-0.4-0.6 0.7-3.6 0-2.5 0.2-1.3 4.8-7.9 0.5-2.6-0.6-1.4-3.7-4.8-0.8-1.6-0.2-1.7 0-4.4 2.6 0.2 7.8 0.2 2.7-0.2 0.8 0 1.6-0.1 12.6-3.4 2.4-0.4 1.7-0.2 0.9 0.3 1.6 0.6 1.2 0.8 1.1 0.9 3.9 4.2 0.6 0.5 0.7 0.3 0.7 0.4 0.9 0.2 0.9 0.1 4.4 0 0.8 0.1 0.7 0.3 0.6 0.4 0.6 0.5 2.1 2.8 1.1 1 1.2 0.8 1.4 0.8 4.3 1.2 0.6 0.4 1.7 1.4 0.7 0.3 0.7 0.1 3.6 0 1.7 0.3 4 1.5 0.9 0.2 0.9 0 3.4-0.1 2.5-0.7 1.7-0.8 1.2-0.8 2.1-1.6 1.1-1.8-0.8-0.8-1-3.5 1.9-12.6-2.4-13.1-1-2-1.4-1.8 1.1-4.5z" fill="#FCD116" fillOpacity="0.3" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Zou */}
                                        <path d="M518.7 777.6l0.8 2.7 0 6.5 0.5 1.3 0.8 1.1 0.6 1.4 0.1 2.3 0.4 1.7 2.3 8.7 2.2 4.8 6.9 4.7 0.8 1 0.1 0.8-0.2 2.4 3.2 16.3 0.7 6.5 0 0.1-0.2 0.2-0.3 0.4-0.6 0.4-0.9 0.1-1 0-2.8-0.2-9 0-4.1 0.4-2.3 1.2-2.4 3.2-1.5 2.9-0.3 2.9-43.6 0.2-1-0.9-2.4 1.4-1.6 0.6-0.9-0.1-1.3-0.5-4.9-3.7-0.8-0.8-0.3-0.6-0.7-2.6-2-3-2.3-1.2-2.4-3.3-3-4.7-2.3-1.8-0.8-0.3-1-0.8-1.8-3-1.4-6.4-1.9-6.8-2.2-3.9-1.9-1.2-0.5-0.9-0.7-1.6-5.6-7.2-2.2-1.7-1.2-1.4-0.6-1.2-0.2-2.8-0.3-0.9-0.8-1.3-0.5-1.1-0.8-3.7-7.6-16.3-1.1-1.8-3.1-3.7-4.7-1-0.1-12.6 2.9 0.3 29.3-1.7 6.5 1.4 7.9 3.3 5.4 4.8 5.5 3.8 6.9 1.1 7.6-0.2 8.4 0.8 10.3 3.2 26 12z" fill="#E8112D" fillOpacity="0.35" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Plateau */}
                                        <path d="M560.7 743.6l-0.3 4.8 0.8 5.7 2.9 5.4 4.3 5.2 3.2 5.3-0.4 6.1-0.4 1.3-0.1 0.9-0.4 0.3-3.2-0.7-1.5 0-1.1 0.7-0.4 1.6 3.1 35.9-0.2 2.1-0.4 1.3-1.2 1.5-1.3 2.8-0.7 1-0.1 1 0.5 1.9 1.3 1.6 3.8 3.1 0.8 1.4-0.5 1.6-1.5 0.8-1.9 0.5-1.7 0.8-3.7 5.3 0.5 5.3 1.9 5.6 0.7 6.1-1.5 6.1-0.4 3.2 0.7 2.8 1.1 1.5 1.3 0.9 1.5 0.5 1.8 0.1 0.8 0.7 0.3 1.5 0.5 6.7-0.8 1.7-1.8 1.1-2.6 2.4-1.7 3.1-0.1 3 1.3 6.2-0.3 3-2.7 7.9 0-0.1-5.7-9.5-2.2-2.4-7-6-2.8-4.6-3-17.1-7-16.8-1.4-7.4 0.3-7.5 2.8 0.2 1 0 0.9-0.1 0.6-0.4 0.3-0.4 0.2-0.2 0-0.1-0.7-6.5-3.2-16.3 0.2-2.4-0.1-0.8-0.8-1-6.9-4.7-2.2-4.8-2.3-8.7-0.4-1.7-0.1-2.3-0.6-1.4-0.8-1.1-0.5-1.3 0-6.5-0.8-2.7-1.1-3.7-0.3-3.5 1.7-3.2 4.5-6.4 1.5-1 2.1-0.7 0.3-1.6-1-3.8 0.3-4.1 2.2-6.1 2-0.1 29.8 0.2z" fill="#E8112D" fillOpacity="0.3" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Kouffo */}
                                        <path d="M402.1 761.4l4.7 1 3.1 3.7 1.1 1.8 7.6 16.3 0.8 3.7 0.5 1.1 0.8 1.3 0.3 0.9 0.2 2.8 0.6 1.2 1.2 1.4 2.2 1.7 5.6 7.2 0.7 1.6 0.5 0.9 1.9 1.2 2.2 3.9 1.9 6.8 1.4 6.4 1.8 3 1 0.8 0.8 0.3 2.3 1.8 3 4.7 2.4 3.3 2.3 1.2 2 3 0.7 2.6 0.3 0.6 0.8 0.8 4.9 3.7 1.3 0.5 0.9 0.1 1.6-0.6 2.4-1.4 1 0.9 1.3 3.6-0.7 2.2-0.9 1.7-2.3 5.9-0.6 1.3-1.2 1.4-2.1 3.6-0.5 1.5-0.2 1.2 0.2 1.8 0.2 2.9-2 4-8.8-4.5-4.5-1.2-4.8-0.2-7.9 1.7-9.2 3.4-13.6 3.2-3.2-0.1-2.4-0.3-7.9-3.8-0.6-0.3 1.1-1.5 0.6-2.3-0.9-3.5-1.1-3-0.6-2.5-0.1-2.5 1.1-6.1-0.3-2-1.3-1.6-2.2-1.6-0.2-0.2-1.6-2.4-2.8-10.4 10.9 0.1 2.6-0.8-0.1-21.5-0.1-21.2 0-21.8-0.1-14.4z" fill="#008751" fillOpacity="0.35" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Mono */}
                                        <path d="M397.2 880.6l0.6 0.3 7.9 3.8 2.4 0.3 3.2 0.1 13.6-3.2 9.2-3.4 7.9-1.7 4.8 0.2 4.5 1.2 8.8 4.5-0.8 3.8 0.2 2.6-0.3 1.6-0.3 1-1.2 1.2-0.7 0.9-1.1 1.8-0.5 1.2-0.2 1.4 0.2 4 0.5 8.2-0.2 3-0.4 1.8-0.8 2-3.2 8.3-0.7 3 0.4 4.5 2.3 3.3 1.2 3.8 0.5 2.6-0.1 1.2 0 0.1-14.9 1.7-38.4 8.8-1.1-3 3-1.6 18.6-4.4 3.1-0.2-2.8-10.7-2.8-11-3.7-6-1.3-0.9-3.1-1.6-0.9-0.8-0.4-1.3 0.4-3.1-0.2-1.5-0.9-1.2-2.4-2-0.4-1-0.2-1.7-1-0.4-1.4 0.2-1.4-0.2-1.1-0.7-1.3-0.9-1.1-1.2-0.9-1.2-0.4-1.5 0.1-1.3 0.2-1.3 0-1.1-1.6-2.9-1.9-1.5-0.9-1.7 1.2-3.3 2.2-2.9z" fill="#E8112D" fillOpacity="0.3" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Atlantique */}
                                        <path d="M512.5 851.4l5 8.1 1.4 6 0.5 8.4 0.5 15.7 0.2 4.3 1 13.3 1.6 2.9 0.8 0.2 0.9 0.3 0.6 0.3 1.7 1.3 0.7 6.6-0.6 3.6-2.3 5.6-6.9 0.9-3 0.8-2.6 1.7-1.8 1.7-1.3 3.6-7.7 0.7-11.6 2.6-34.7 4 0-0.1 0.1-1.2-0.5-2.6-1.2-3.8-2.3-3.3-0.4-4.5 0.7-3 3.2-8.3 0.8-2 0.4-1.8 0.2-3-0.5-8.2-0.2-4 0.2-1.4 0.5-1.2 1.1-1.8 0.7-0.9 1.2-1.2 0.3-1 0.3-1.6-0.2-2.6 0.8-3.8 2-4-0.2-2.9-0.2-1.8 0.2-1.2 0.5-1.5 2.1-3.6 1.2-1.4 0.6-1.3 2.3-5.9 0.9-1.7 0.7-2.2-1.3-3.6 43.6-0.2z" fill="#FCD116" fillOpacity="0.3" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Ouémé */}
                                        <path d="M560.9 912.2l-0.5 1.4-0.5 3-1.1 6.5-0.1 8.9-31.8 3-0.4-2.5-0.7-0.4-0.7-0.1-1.1-1 0.5-3 2.3-5.6 0.6-3.6-0.7-6.6-1.7-1.3-0.6-0.3-0.9-0.3-0.8-0.2-1.6-2.9-1-13.3-0.2-4.3-0.5-15.7-0.5-8.4-1.4-6-5-8.1 0.3-2.9 1.5-2.9 2.4-3.2 2.3-1.2 4.1-0.4 9 0-0.3 7.5 1.4 7.4 7 16.8 3 17.1 2.8 4.6 7 6 2.2 2.4 5.7 9.5 0 0.1z" fill="#E8112D" fillOpacity="0.35" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                        {/* Littoral */}
                                        <path d="M524.5 928l-0.5 3 1.1 1 0.7 0.1 0.7 0.4 0.4 2.5-18 1.7 1.3-3.6 1.8-1.7 2.6-1.7 3-0.8 6.9-0.9z" fill="#FCD116" fillOpacity="0.4" stroke="rgba(252,209,22,0.25)" strokeWidth="1" />
                                    </g>

                                    {/* City dots */}
                                    {beninCities.map((city) => (
                                        <g key={city.name}>
                                            {city.main && (
                                                <circle cx={city.x} cy={city.y} r="18" fill="none" stroke="#FCD116" strokeWidth="2" className="animate-ping" style={{ transformOrigin: `${city.x}px ${city.y}px`, animationDuration: '2s' }} />
                                            )}
                                            {city.main && (
                                                <circle cx={city.x} cy={city.y} r="14" fill="none" stroke="#FCD116" strokeWidth="1" opacity="0.4" />
                                            )}
                                            <circle
                                                cx={city.x} cy={city.y}
                                                r={city.main ? 8 : 5}
                                                fill={hoveredCity === city.name ? '#FCD116' : city.main ? '#FCD116' : '#ffffff'}
                                                className="cursor-pointer transition-all duration-300"
                                                onMouseEnter={() => setHoveredCity(city.name)}
                                                onMouseLeave={() => setHoveredCity(null)}
                                                style={{ filter: city.main ? 'drop-shadow(0 0 8px rgba(252,209,22,0.8))' : 'drop-shadow(0 0 3px rgba(255,255,255,0.5))' }}
                                            />
                                            {(city.main || hoveredCity === city.name) && (
                                                <text x={city.x + 14} y={city.y + 5} fill={city.main ? '#FCD116' : '#ffffff'} fontSize="22" fontWeight={city.main ? 'bold' : 'normal'} className="select-none" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                                                    {city.name}
                                                </text>
                                            )}
                                        </g>
                                    ))}
                                </svg>

                                {/* Legend */}
                                <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/50">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-[#FCD116]" /> Bureaux principaux
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-white" /> Zone couverte
                                    </div>
                                </div>
                            </div>

                            {/* Quick contact */}
                            <div className="mt-6 flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <Phone className="text-[#008751]" size={20} />
                                <div>
                                    <p className="text-sm font-bold text-[#1a2332]">Besoin d'aide immédiate ?</p>
                                    <a
                                        href={COMPANY_INFO.whatsappLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-gray-500 hover:text-[#008751] hover:underline transition-colors mt-1 block"
                                    >
                                        WhatsApp: {COMPANY_INFO.phoneDisplay}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right: Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="border-0 shadow-xl overflow-hidden">
                            <div className="h-1.5 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                            <CardHeader>
                                <CardTitle className="text-2xl">Planifier une consultation</CardTitle>
                                <CardDescription>Remplissez ce formulaire — premier appel de 15 min gratuit.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AnimatePresence mode="wait">
                                    {status === 'success' ? (
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center py-12 space-y-4"
                                        >
                                            <CheckCircle className="mx-auto text-[#008751]" size={48} />
                                            <h3 className="text-xl font-bold text-[#1a2332]">Demande envoyée !</h3>
                                            <p className="text-gray-500">Un conseiller vous contactera sous 24h.</p>
                                        </motion.div>
                                    ) : (
                                        <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                                            {/* Step indicator */}
                                            <div className="flex justify-center gap-2 mb-6">
                                                {[1, 2, 3, 4].map(i => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= i ? 'bg-[#008751] text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                                                            {i}
                                                        </div>
                                                        {i < 4 && <div className={`w-6 h-0.5 ${step > i ? 'bg-[#008751]' : 'bg-gray-200'}`} />}
                                                    </div>
                                                ))}
                                            </div>

                                            {step === 1 && (
                                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Nom *</label>
                                                            <input type="text" required value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
                                                                className="w-full p-3 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none" placeholder="Votre nom" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Prénom</label>
                                                            <input type="text" value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))}
                                                                className="w-full p-3 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none" placeholder="Votre prénom" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-gray-700">Email *</label>
                                                        <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none" placeholder="email@exemple.com" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-gray-700">Téléphone / WhatsApp</label>
                                                        <input type="tel" value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))}
                                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none" placeholder="+33 6 00 00 00 00" />
                                                    </div>
                                                </motion.div>
                                            )}

                                            {step === 2 && (
                                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-gray-700">Type de Service</label>
                                                        <select value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none bg-white">
                                                            <option>Passeport / Administratif</option>
                                                            <option>Logement / Immobilier</option>
                                                            <option>Création d&apos;Entreprise</option>
                                                            <option>Guide Culturel</option>
                                                            <option>Construction</option>
                                                            <option>Investissement</option>
                                                            <option>Autre</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-gray-700">Message (Optionnel)</label>
                                                        <textarea rows={5} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none resize-none"
                                                            placeholder="Détaillez votre projet..." />
                                                    </div>
                                                </motion.div>
                                            )}

                                            {step === 3 && (
                                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">

                                                    {/* Date & Heure */}
                                                    <div className="space-y-3">
                                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                            <Calendar size={16} className="text-[#008751]" /> Date souhaitée
                                                        </label>
                                                        <input
                                                            type="date"
                                                            min={new Date().toISOString().split('T')[0]}
                                                            value={form.date}
                                                            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] outline-none"
                                                        />

                                                        <div className="flex gap-3">
                                                            {['Matin (09h-13h)', 'Après-midi (14h-17h)'].map(slot => (
                                                                <button
                                                                    key={slot}
                                                                    type="button"
                                                                    onClick={() => setForm(p => ({ ...p, timeSlot: slot }))}
                                                                    className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all ${form.timeSlot === slot
                                                                        ? 'bg-[#008751]/10 border-[#008751] text-[#008751] font-medium'
                                                                        : 'border-gray-200 text-gray-500 hover:border-[#008751]/50'
                                                                        }`}
                                                                >
                                                                    {slot}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Mode de consultation */}
                                                    <div className="space-y-3">
                                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                            <MessagesSquare size={16} className="text-[#008751]" /> Mode de consultation
                                                        </label>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {[
                                                                { id: 'Appel WhatsApp', icon: MessageCircle },
                                                                { id: 'Appel Téléphonique', icon: Phone },
                                                                { id: 'Visio (Google Meet)', icon: Video },
                                                                { id: 'Présentiel (Cotonou)', icon: MapPin }
                                                            ].map(method => (
                                                                <button
                                                                    key={method.id}
                                                                    type="button"
                                                                    onClick={() => setForm(p => ({ ...p, contactMethod: method.id }))}
                                                                    className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${form.contactMethod === method.id
                                                                        ? 'bg-[#FCD116]/10 border-[#FCD116] text-black font-medium shadow-sm'
                                                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <method.icon size={16} className={form.contactMethod === method.id ? 'text-[#008751]' : 'text-gray-400'} />
                                                                    {method.id}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                </motion.div>
                                            )}

                                            {step === 4 && (
                                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center space-y-4 py-6">
                                                    <div className="text-5xl">📋</div>
                                                    <h3 className="text-xl font-bold text-[#1a2332]">Récapitulatif</h3>
                                                    <div className="text-left bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                                                        <p><span className="font-semibold">Nom:</span> {form.nom} {form.prenom}</p>
                                                        <p><span className="font-semibold">Email:</span> {form.email}</p>
                                                        {form.telephone && <p><span className="font-semibold">Tél:</span> {form.telephone}</p>}
                                                        <p><span className="font-semibold">Service:</span> {form.service}</p>
                                                        <div className="h-px bg-gray-200 my-2" />
                                                        <p><span className="font-semibold">Date:</span> {form.date || 'Non définie'} — {form.timeSlot || 'Non défini'}</p>
                                                        <p><span className="font-semibold">Mode:</span> {form.contactMethod}</p>
                                                        {form.message && <p className="mt-2 italic text-gray-600">&quot;{form.message}&quot;</p>}
                                                    </div>
                                                    <p className="text-gray-500 text-sm">Un conseiller vous recontactera sous 24h.</p>
                                                </motion.div>
                                            )}

                                            {status === 'error' && (
                                                <p className="text-[#E8112D] text-sm text-center">Erreur. Réessayez ou contactez-nous par WhatsApp.</p>
                                            )}

                                            <div className="flex justify-between pt-4">
                                                <Button type="button" variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}
                                                    className="rounded-xl">
                                                    Précédent
                                                </Button>
                                                {step < 4 ? (
                                                    <Button type="button" onClick={() => setStep(Math.min(4, step + 1))}
                                                        className="bg-[#008751] hover:bg-[#006B40] text-white rounded-xl px-8">
                                                        Suivant
                                                    </Button>
                                                ) : (
                                                    <Button type="submit" disabled={status === 'loading'}
                                                        className="bg-[#008751] hover:bg-[#006B40] text-white font-bold rounded-xl px-8">
                                                        {status === 'loading' ? 'Envoi...' : '✅ Confirmer'}
                                                    </Button>
                                                )}
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
