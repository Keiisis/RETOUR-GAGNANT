'use client'

import React, { forwardRef, useState, useEffect } from 'react'
import QRCode from 'react-qr-code'

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */

export interface CardData {
    prenom: string
    nom: string
    position: string
    phone: string
    email: string
}

/* ══════════════════════════════════════════════════════════════
   PALETTE LUXE
══════════════════════════════════════════════════════════════ */

const GOLD   = '#C9A84C'
const GOLD_L = '#E2C97E'
const DARK   = '#030A18' // Nuit extrêmement profonde
const DARK2  = '#0A1C3A' // Reflet bleu nuit

/* ══════════════════════════════════════════════════════════════
   ICÔNES SVG PREMIUM — rendu inline (compatible html-to-image)
══════════════════════════════════════════════════════════════ */

const IcoPhone = ({ sz, col }: { sz: number; col: string }) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill={col} style={{ display: 'block', flexShrink: 0 }}>
        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
)

const IcoMail = ({ sz, col }: { sz: number; col: string }) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill={col} style={{ display: 'block', flexShrink: 0 }}>
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
)

const IcoGlobe = ({ sz, col }: { sz: number; col: string }) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill={col} style={{ display: 'block', flexShrink: 0 }}>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
    </svg>
)

const IcoPin = ({ sz, col }: { sz: number; col: string }) => (
    <svg width={sz} height={sz} viewBox="0 0 20 20" fill={col} style={{ display: 'block', flexShrink: 0 }}>
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
)

/* ══════════════════════════════════════════════════════════════
   QR CODE — canvas data URL pour html-to-image
══════════════════════════════════════════════════════════════ */

function QRCodeDisplay({ size }: { size: number }) {
    const [qrSrc, setQrSrc] = useState<string | null>(null)

    useEffect(() => {
        const img = new window.Image()
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth || img.width
                canvas.height = img.naturalHeight || img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) { setQrSrc(null); return }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                setQrSrc(canvas.toDataURL('image/png'))
            } catch { setQrSrc(null) }
        }
        img.onerror = () => setQrSrc(null)
        img.src = '/images/qr-code.png' // Assurez-vous d'avoir une image statique en fallback si besoin
    }, [])

    if (qrSrc) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={qrSrc} alt="QR Code" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
    }
    return <QRCode value="https://www.retourgagnantbenin.bj" size={size} fgColor={DARK} bgColor="#ffffff" level="M" />
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANTS PARTAGÉS (FOND ET FILIGRANE)
══════════════════════════════════════════════════════════════ */

const CardBackground = ({ s }: { s: number }) => (
    <>
        {/* Fond Nuit Etoilée */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, ${DARK2} 0%, ${DARK} 100%)`, zIndex: 0 }} />
        
        {/* Lueur d'ambiance super subtile cyan/or */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: 200 * s, height: 200 * s, background: `radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 200 * s, height: 200 * s, background: `radial-gradient(circle, rgba(0,135,81,0.03) 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

        {/* Bordure intérieure extrêmement fine et discrète */}
        <div style={{ position: 'absolute', top: 5 * s, bottom: 5 * s, left: 5 * s, right: 5 * s, border: `0.5px solid ${GOLD}25`, borderRadius: 6 * s, pointerEvents: 'none', zIndex: 1 }} />

        {/* Le Filigrane RGB (Titanesque mais presque invisible : 3% opacité) */}
        <div style={{ 
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-15deg)', 
            color: '#ffffff', opacity: 0.025, fontSize: 130 * s, fontWeight: 900, 
            fontFamily: "'Cinzel','Georgia',serif", pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', zIndex: 1 
        }}>
            RGB
        </div>
    </>
)

/* ══════════════════════════════════════════════════════════════
   RECTO — Le Prestige de la Marque
══════════════════════════════════════════════════════════════ */

export const CardRecto = forwardRef<HTMLDivElement, { data: CardData; scale?: number }>(
    ({ scale = 1 }, ref) => {
        const W = 340 * scale, H = 220 * scale, s = scale

        return (
            <div ref={ref} style={{
                width: W, height: H, position: 'relative', overflow: 'hidden',
                borderRadius: 10 * s, flexShrink: 0,
                fontFamily: "'Arial','Helvetica',sans-serif",
                boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
            }}>
                <CardBackground s={s} />

                {/* ── CONTENU CENTRAL ── */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    
                    {/* Glow divin derrière le logo géant */}
                    <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', width: 160 * s, height: 160 * s, background: `radial-gradient(circle, ${GOLD}20 0%, transparent 60%)`, pointerEvents: 'none' }} />

                    {/* Logo Géant & Majestueux */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/logo-transparent.png" alt="RGB" style={{ width: 90 * s, height: 90 * s, objectFit: 'contain', marginBottom: 6 * s, filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.4))' }} />

                    {/* Ornement Royal (Diamant & Lignes) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 * s, marginBottom: 8 * s }}>
                        <div style={{ width: 60 * s, height: 1 * s, background: `linear-gradient(90deg, transparent, ${GOLD}70)` }} />
                        <div style={{ width: 4.5 * s, height: 4.5 * s, background: GOLD_L, transform: 'rotate(45deg)', boxShadow: `0 0 12px ${GOLD}80` }} />
                        <div style={{ width: 60 * s, height: 1 * s, background: `linear-gradient(270deg, transparent, ${GOLD}70)` }} />
                    </div>

                    {/* Nom Agence avec fort letter-spacing (Titanesque) */}
                    <div style={{ color: GOLD_L, fontSize: 10.5 * s, fontWeight: 700, letterSpacing: '0.38em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif", textAlign: 'center', marginLeft: `${0.38 * 10.5 * s}px` /* Compense le letter-spacing */ }}>
                        Retour Gagnant
                    </div>
                    <div style={{ color: GOLD_L, fontSize: 10.5 * s, fontWeight: 700, letterSpacing: '0.38em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif", textAlign: 'center', marginTop: 4 * s, marginLeft: `${0.38 * 10.5 * s}px` }}>
                        Bénin
                    </div>

                    {/* Tagline en or pâle italique (Très élégante) */}
                    <div style={{ color: `${GOLD_L}85`, fontSize: 5.5 * s, letterSpacing: '0.22em', textAlign: 'center', fontStyle: 'italic', marginTop: 10 * s, fontWeight: 300 }}>
                        L&apos;Agence du Retour des Afro-descendants
                    </div>
                </div>
            </div>
        )
    }
)
CardRecto.displayName = 'CardRecto'

/* ══════════════════════════════════════════════════════════════
   VERSO — Aéré, Structuré, Hiérarchisé
══════════════════════════════════════════════════════════════ */

const ContactRow = ({ Icon, value, dim = false, s }: {
    Icon: (p: { sz: number; col: string }) => React.ReactElement;
    value: string;
    dim?: boolean;
    s: number;
}) => {
    const ico = Math.round(7 * s)
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 * s, marginBottom: 3.5 * s }}>
            <Icon sz={ico} col={dim ? `${GOLD}90` : GOLD_L} />
            <span style={{ 
                color: '#ffffff', 
                opacity: dim ? 0.75 : 1, 
                fontSize: dim ? 5 * s : 5.8 * s, 
                lineHeight: 1.3, 
                fontWeight: dim ? 400 : 500,
                fontFamily: "'Inter','Arial',sans-serif", 
                letterSpacing: '0.02em',
                whiteSpace: 'pre-line' 
            }}>
                {value}
            </span>
        </div>
    )
}

export const CardVerso = forwardRef<HTMLDivElement, { data: CardData; scale?: number }>(
    ({ data, scale = 1 }, ref) => {
        const W = 340 * scale, H = 220 * scale, s = scale

        return (
            <div ref={ref} style={{
                width: W, height: H, position: 'relative', overflow: 'hidden',
                borderRadius: 10 * s, flexShrink: 0,
                fontFamily: "'Arial','Helvetica',sans-serif",
                boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
            }}>
                <CardBackground s={s} />

                {/* Séparateur Vertical Ultra-Fin en fond pour structurer (optionnel, on le garde délicat) */}
                <div style={{ position: 'absolute', top: 25 * s, bottom: 45 * s, left: 220 * s, width: '1px', background: `linear-gradient(180deg, transparent, ${GOLD}30, transparent)`, zIndex: 1 }} />

                <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
                    
                    {/* 1. Bloc Agent (Nom + Titre TRÈS VISIBLE) */}
                    <div style={{ position: 'absolute', top: 20 * s, left: 20 * s, width: 190 * s }}>
                        <div style={{ color: GOLD_L, fontSize: 13.5 * s, fontWeight: 700, letterSpacing: '0.05em', fontFamily: "'Cinzel','Georgia',serif", lineHeight: 1.1 }}>
                            {data.prenom} {data.nom}
                        </div>
                        <div style={{ width: 45 * s, height: 1.5 * s, background: GOLD, marginTop: 4.5 * s, marginBottom: 4.5 * s }} />
                        <div style={{ color: GOLD_L, opacity: 0.9, fontSize: 6.5 * s, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
                            {data.position || 'CONSULTANT(E)'}
                        </div>
                    </div>

                    {/* 2. Contacts Agent (Milieu - plus aéré) */}
                    <div style={{ position: 'absolute', top: 80 * s, left: 20 * s, width: 190 * s }}>
                        {data.phone && <ContactRow Icon={IcoPhone} value={data.phone} s={s} />}
                        {data.email && <ContactRow Icon={IcoMail} value={data.email} s={s} />}
                    </div>

                    {/* 3. Séparateur Horizontal Agent / Agence */}
                    <div style={{ position: 'absolute', bottom: 33 * s, left: 20 * s, width: 100 * s, height: 0.5 * s, background: `${GOLD}20` }} />

                    {/* 4. Contacts Agence (Bas - bien en bas et visible) */}
                    <div style={{ position: 'absolute', bottom: 12 * s, left: 20 * s, width: 300 * s }}>
                        <ContactRow Icon={IcoPhone} value="+229 01 60 32 21 21 / +229 01 94 35 50 50" dim s={s} />
                        <ContactRow Icon={IcoGlobe} value="contact@retourgagnantbenin.bj — www.retourgagnantbenin.bj" dim s={s} />
                        <ContactRow Icon={IcoPin} value="Haie-Vive Cocotiers, Carré N°1158, Cotonou — BÉNIN" dim s={s} />
                    </div>

                    {/* 5. QR CODE (Droite, aligné sur le haut) */}
                    <div style={{ position: 'absolute', top: 22 * s, right: 20 * s, width: 85 * s, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ 
                            background: '#ffffff', 
                            padding: 4.5 * s, 
                            borderRadius: 4 * s, 
                            boxShadow: `0 0 0 1px ${GOLD}50, 0 8px 30px rgba(0,0,0,0.6)` 
                        }}>
                            <QRCodeDisplay size={Math.round(65 * s)} />
                        </div>
                        <div style={{ marginTop: 6 * s, color: `${GOLD}70`, fontSize: 4.2 * s, letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: "'Cinzel',serif", textAlign: 'center' }}>
                            Scannez-moi
                        </div>
                    </div>
                    
                </div>
            </div>
        )
    }
)
CardVerso.displayName = 'CardVerso'
