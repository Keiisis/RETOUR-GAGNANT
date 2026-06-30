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
   PALETTE — Fond blanc, accents dorés, texte sombre
══════════════════════════════════════════════════════════════ */

const GOLD   = '#C9A84C'
const GOLD_D = '#B08D3A'
const DARK   = '#1A1A2E'
const TEXT   = '#1B1B1B'
const TEXT_L = '#6B6B6B'

/* ══════════════════════════════════════════════════════════════
   FONT STACK — Montserrat + Inter, sans-serif géométrique
══════════════════════════════════════════════════════════════ */

const FONT = "var(--font-montserrat), 'Inter', 'Helvetica Neue', sans-serif"

/* ══════════════════════════════════════════════════════════════
   ICÔNES SVG minimalistes — trait fin
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
        img.src = '/images/qr-code.png'
    }, [])

    if (qrSrc) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={qrSrc} alt="QR Code" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
    }
    return <QRCode value="https://www.retourgagnantbenin.bj" size={size} fgColor={DARK} bgColor="#ffffff" level="M" />
}

/* ══════════════════════════════════════════════════════════════
   RECTO — Minimaliste
   Respiration + Hiérarchie typographique uniquement
   Zéro ornement. Logo + Nom + Tagline. C'est tout.
══════════════════════════════════════════════════════════════ */

export const CardRecto = forwardRef<HTMLDivElement, { data: CardData; scale?: number }>(
    ({ scale = 1 }, ref) => {
        const W = 680 * scale, H = 440 * scale, s = scale

        return (
            <div ref={ref} style={{
                width: W, height: H, position: 'relative', overflow: 'hidden',
                borderRadius: 10 * s, flexShrink: 0,
                fontFamily: FONT,
                boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                background: '#FFFFFF',
                boxSizing: 'border-box',
            }}>
                {/* ── Accent doré fin en haut ── */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: 4 * s,
                    background: GOLD,
                }} />

                {/* ── Accent doré fin en bas ── */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: 4 * s,
                    background: GOLD,
                }} />

                {/* ── Contenu centré — tout ULTRA VISIBLE ── */}
                <div style={{
                    position: 'absolute',
                    top: 4 * s,
                    bottom: 4 * s,
                    left: 0, right: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: `${10 * s}px ${30 * s}px`,
                }}>

                    {/* LOGO — MAXIMUM */}
                    <img
                        src="/images/logo-transparent.png"
                        alt="Retour Gagnant Bénin"
                        style={{
                            width: 340 * s,
                            height: 340 * s,
                            objectFit: 'contain',
                            marginBottom: 0,
                        }}
                    />

                    {/* NOM — RETOUR GAGNANT BÉNIN sur une seule ligne */}
                    <div style={{
                        color: DARK,
                        fontSize: 27 * s,
                        fontWeight: 900,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        fontFamily: FONT,
                        textAlign: 'center',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                    }}>
                        Retour Gagnant Bénin
                    </div>

                    {/* Tagline — dorée, ULTRA VISIBLE, gras */}
                    <div style={{
                        color: GOLD_D,
                        fontSize: 21 * s,
                        letterSpacing: '0.02em',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontFamily: FONT,
                        marginTop: 6 * s,
                    }}>
                        L&apos;Agence du Retour des Afro-descendants
                    </div>
                </div>
            </div>
        )
    }
)
CardRecto.displayName = 'CardRecto'

/* ══════════════════════════════════════════════════════════════
   VERSO — Design Minimaliste Premium
   100% respiration + hiérarchie typo
   Zéro ornement décoratif
   Montserrat/Inter, gras, espaces blancs généreux
══════════════════════════════════════════════════════════════ */

export const CardVerso = forwardRef<HTMLDivElement, { data: CardData; scale?: number }>(
    ({ data, scale = 1 }, ref) => {
        const W = 680 * scale, H = 440 * scale, s = scale
        const qrSize = Math.round(112 * s) // QR Code plus grand !

        return (
            <div ref={ref} style={{
                width: W, height: H, position: 'relative', overflow: 'hidden',
                borderRadius: 10 * s, flexShrink: 0,
                fontFamily: FONT,
                boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                background: '#FFFFFF',
                boxSizing: 'border-box',
            }}>

                {/* ── Accent doré fin en haut ── */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: 4 * s,
                    background: GOLD,
                }} />

                {/* ── Accent doré fin en bas ── */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: 4 * s,
                    background: GOLD,
                }} />

                {/* ══════════════════════════════════════════
                    CONTENU — Gauche: identité / Droite: QR
                ══════════════════════════════════════════ */}
                <div style={{
                    position: 'absolute',
                    top: 4 * s, bottom: 4 * s,
                    left: 0, right: 0,
                    display: 'flex',
                }}>
                    {/* ═══ GAUCHE — 72% de la largeur ═══ */}
                    <div style={{
                        flex: 1,
                        padding: `${36 * s}px ${0}px ${30 * s}px ${42 * s}px`,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>

                        {/* PRÉNOM — Ultra visible */}
                        <div style={{
                            color: TEXT_L,
                            fontSize: 22 * s,
                            fontWeight: 900,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            lineHeight: 1,
                            marginBottom: 4 * s,
                        }}>
                            {data.prenom}
                        </div>

                        {/* NOM — Ultra visible, Très gros */}
                        <div style={{
                            color: GOLD_D,
                            fontSize: 36 * s,
                            fontWeight: 900,
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                            lineHeight: 1.1,
                        }}>
                            {data.nom}
                        </div>

                        {/* Ligne dorée fine — seul élément graphique */}
                        <div style={{
                            width: 50 * s,
                            height: 3 * s,
                            background: GOLD,
                            marginTop: 14 * s,
                            marginBottom: 10 * s,
                            borderRadius: 2,
                        }} />

                        {/* POSTE — TRÈS GRAS, MAJEUR */}
                        <div style={{
                            color: DARK,
                            fontSize: 15 * s,
                            fontWeight: 900,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            marginBottom: 28 * s,
                        }}>
                            {data.position || 'CONSULTANT(E)'}
                        </div>

                        {/* ── CONTACTS — GÉANTS ── */}
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            gap: 14 * s,
                        }}>
                            {data.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                                    <IcoPhone sz={Math.round(20 * s)} col={GOLD} />
                                    <span style={{
                                        color: DARK,
                                        fontSize: 18 * s,
                                        fontWeight: 800,
                                        letterSpacing: '0.04em',
                                    }}>
                                        {data.phone}
                                    </span>
                                </div>
                            )}

                            {data.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                                    <IcoMail sz={Math.round(20 * s)} col={GOLD} />
                                    <span style={{
                                        color: DARK,
                                        fontSize: 18 * s,
                                        fontWeight: 800,
                                        letterSpacing: '0.02em',
                                    }}>
                                        {data.email}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Espace flexible → pousse le footer en bas */}
                        <div style={{ flex: 1, minHeight: 12 * s }} />

                        {/* ── FOOTER — ULTRA GROS, lisible même pour malvoyants ── */}
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            gap: 12 * s,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 * s }}>
                                <IcoGlobe sz={Math.round(24 * s)} col={GOLD} />
                                <span style={{
                                    color: DARK,
                                    fontSize: 17 * s,
                                    fontWeight: 900,
                                    letterSpacing: '0.01em',
                                }}>
                                    contact@retourgagnantbenin.bj — www.retourgagnantbenin.bj
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 * s }}>
                                <IcoPin sz={Math.round(24 * s)} col={GOLD} />
                                <span style={{
                                    color: DARK,
                                    fontSize: 17 * s,
                                    fontWeight: 900,
                                }}>
                                    Haie-Vive Cocotiers, Carré N°1158, Cotonou — BÉNIN
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ═══ DROITE — QR Code, centré verticalement ═══ */}
                    <div style={{
                        width: 180 * s,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingRight: 20 * s,
                    }}>
                        {/* QR Code — carré simple, propre */}
                        <div style={{
                            background: '#ffffff',
                            padding: `${8 * s}px`,
                            border: `2px solid ${GOLD}`,
                            borderRadius: 6 * s,
                        }}>
                            <QRCodeDisplay size={qrSize} />
                        </div>

                        {/* Label */}
                        <div style={{
                            marginTop: 10 * s,
                            color: GOLD_D,
                            fontSize: 8 * s,
                            fontWeight: 800,
                            letterSpacing: '0.3em',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                        }}>
                            Scannez
                        </div>
                    </div>
                </div>
            </div>
        )
    }
)
CardVerso.displayName = 'CardVerso'
