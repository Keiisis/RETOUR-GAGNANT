'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Globe, Phone, Mail, MapPin } from "lucide-react";
import { COMPANY_INFO } from "@/lib/constants/company-info";

export default function SettingsAdmin() {
    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-heading text-white">Configuration Globale</h1>
                <Button className="bg-[#008751] hover:bg-[#006B40] text-white gap-2">
                    <Save size={18} /> Sauvegarder
                </Button>
            </div>

            {/* Identity */}
            <Card className="bg-[#1a2332] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Globe size={20} className="text-[#FCD116]" /> Identité du Site
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Nom du Site</label>
                            <input defaultValue="Retour Gagnant" className="w-full bg-[#0f141e] border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#FCD116] outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Slogan</label>
                            <input defaultValue="Votre partenaire de confiance au Bénin" className="w-full bg-[#0f141e] border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#FCD116] outline-none" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="bg-[#1a2332] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <MapPin size={20} className="text-[#E8112D]" /> Coordonnées
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Adresse Physique</label>
                        <input defaultValue={COMPANY_INFO.address} className="w-full bg-[#0f141e] border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#FCD116] outline-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Téléphone (Affichage)</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input defaultValue={COMPANY_INFO.phoneDisplay} className="w-full bg-[#0f141e] border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white focus:ring-2 focus:ring-[#FCD116] outline-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input defaultValue={COMPANY_INFO.email} className="w-full bg-[#0f141e] border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white focus:ring-2 focus:ring-[#FCD116] outline-none" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Horaires */}
            <Card className="bg-[#1a2332] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white">Horaires d'ouverture</CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea defaultValue={COMPANY_INFO.hours} className="w-full bg-[#0f141e] border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#FCD116] outline-none h-24" />
                </CardContent>
            </Card>
        </div>
    );
}
