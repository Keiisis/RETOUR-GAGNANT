'use client'

import React, { forwardRef, useState, useEffect } from 'react'
import QRCode from 'react-qr-code'
import { BookOpen, House as Home, Briefcase, Bank as Landmark, Hammer, TrendUp as TrendingUp, Users, SealCheck as BadgeCheck, GridFour as LayoutGrid } from '@phosphor-icons/react';

/* ══════════════════════════════════════════════════════════════
   PALETTE : Bleu cobalt eclatant + Or vibrant + drapeau Benin
══════════════════════════════════════════════════════════════ */

const BLUE_DEEP  = '#052257'
const BLUE_MAIN  = '#0A3A8A'
const BLUE_LIGHT = '#1E5FD9'

const GOLD       = '#C9A84C'
const GOLD_LIGHT = '#F2D57E'
const GOLD_VIVID = '#FCD116'

const BENIN_GREEN = '#008751'
const BENIN_RED   = '#E8112D'

const WHITE = '#FFFFFF'

const FONT = "var(--font-montserrat), 'Inter', 'Helvetica Neue', sans-serif"

const GRADIENT_BG     = `linear-gradient(160deg, ${BLUE_DEEP} 0%, ${BLUE_MAIN} 55%, ${BLUE_LIGHT} 100%)`
const GRADIENT_GOLD   = `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 50%, ${GOLD_VIVID} 100%)`
const GRADIENT_GOLD_V = `linear-gradient(180deg, ${GOLD_VIVID} 0%, ${GOLD} 100%)`

export interface RollUpData {
    phone1: string
    phone2: string
    email: string
    website: string
    address: string
}

/* ══════════════════════════════════════════════════════════════
   QR CODE : utilise l'image custom /images/qr-code.png (avec logo
   arbre au centre). Fallback sur QRCode genere si indispo.
══════════════════════════════════════════════════════════════ */

function QRCodeDisplay({ size, fallbackUrl }: { size: number; fallbackUrl: string }) {
    const [src, setSrc] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth || img.width
                canvas.height = img.naturalHeight || img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) { setFailed(true); return }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                setSrc(canvas.toDataURL('image/png'))
            } catch {
                setFailed(true)
            }
        }
        img.onerror = () => setFailed(true)
        img.src = '/images/qr-code.png'
    }, [])

    if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt="QR Code" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
    }
    if (failed) {
        return <QRCode value={fallbackUrl} size={size} level="H" fgColor={BLUE_DEEP} />
    }
    // placeholder blanc pendant le chargement (evite le flash)
    return <div style={{ width: size, height: size, background: '#ffffff' }} />
}

/* 9 services du site (FALLBACK_SERVICES) */
const SERVICES = [
    { icon: BookOpen,    title: 'PASSEPORT & DOCUMENTS' },
    { icon: Home,        title: 'ACHETER OU LOUER' },
    { icon: Briefcase,   title: "CRÉATION D'ENTREPRISE" },
    { icon: Landmark,    title: 'GUIDE CULTUREL' },
    { icon: Hammer,      title: 'SUIVI DE CHANTIER' },
    { icon: TrendingUp,  title: 'INVESTISSEMENT' },
    { icon: Users,       title: 'RECHERCHE ANCESTRALE' },
    { icon: BadgeCheck,  title: 'NATIONALITÉ VIP' },
]
const SERVICE_EXTRA = { icon: LayoutGrid, title: 'AUTRES SERVICES' }

/* ══════════════════════════════════════════════════════════════
   Mini-logo RGB (tricolore drapeau Benin) en haut a gauche
══════════════════════════════════════════════════════════════ */

function MiniLogoRGB({ s }: { s: number }) {
    const letterStyle = (color: string): React.CSSProperties => ({
        color,
        fontSize: 38 * s,
        fontWeight: 900,
        letterSpacing: '0.02em',
        textShadow: `0 ${2 * s}px ${6 * s}px rgba(0,0,0,0.5)`,
        filter: `drop-shadow(0 0 ${4 * s}px ${color}40)`,
    })
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: FONT,
            gap: 1 * s,
        }}>
            <span style={letterStyle(BENIN_GREEN)}>R</span>
            <span style={letterStyle(GOLD_VIVID)}>G</span>
            <span style={letterStyle(BENIN_RED)}>B</span>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════
   ICONE SERVICE : circle gradient or, icone bleu profond
══════════════════════════════════════════════════════════════ */

function ServiceRow({
    Icon, title, s,
}: { Icon: typeof BookOpen; title: string; s: number }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16 * s,
            paddingTop: 13 * s,
            paddingBottom: 13 * s,
        }}>
            <div style={{
                width: 46 * s,
                height: 46 * s,
                borderRadius: '50%',
                background: GRADIENT_GOLD_V,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 ${3 * s}px ${10 * s}px rgba(252,209,22,0.4), inset 0 ${1 * s}px ${2 * s}px rgba(255,255,255,0.4)`,
            }}>
                <Icon size={24 * s} color={BLUE_DEEP} strokeWidth={2.4} />
            </div>
            <span style={{
                fontSize: 19 * s,
                fontWeight: 800,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
                color: WHITE,
                textShadow: `0 ${1 * s}px ${3 * s}px rgba(0,0,0,0.4)`,
            }}>
                {title}
            </span>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════
   ROLL-UP : 85x200 cm (850 x 2000 px base DOM)
══════════════════════════════════════════════════════════════ */

export const RollUp = forwardRef<HTMLDivElement, { data: RollUpData, scale?: number }>(
    ({ data, scale = 1 }, ref) => {
        const w = 850 * scale
        const h = 2000 * scale
        const s = scale

        return (
            <div
                ref={ref}
                style={{
                    width: w,
                    height: h,
                    background: GRADIENT_BG,
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: FONT,
                    color: WHITE,
                }}
            >
                {/* ═══════════════════════════════════════════
                    DECORS : halos lateraux verts + halo or
                ═══════════════════════════════════════════ */}

                {/* Halo vert gauche */}
                <div style={{
                    position: 'absolute',
                    top: 400 * s,
                    left: -300 * s,
                    width: 700 * s,
                    height: 1200 * s,
                    background: `radial-gradient(ellipse, rgba(0,135,81,0.3) 0%, rgba(0,135,81,0.1) 35%, transparent 65%)`,
                    filter: 'blur(40px)',
                    zIndex: 0,
                }} />

                {/* Halo vert droit */}
                <div style={{
                    position: 'absolute',
                    top: 600 * s,
                    right: -300 * s,
                    width: 800 * s,
                    height: 1400 * s,
                    background: `radial-gradient(ellipse, rgba(0,135,81,0.38) 0%, rgba(252,209,22,0.15) 30%, transparent 65%)`,
                    filter: 'blur(50px)',
                    zIndex: 0,
                }} />

                {/* Halo or haut (autour du logo) */}
                <div style={{
                    position: 'absolute',
                    top: -200 * s,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 1200 * s,
                    height: 800 * s,
                    background: `radial-gradient(circle, rgba(252,209,22,0.18) 0%, transparent 60%)`,
                    borderRadius: '50%',
                    zIndex: 0,
                }} />

                {/* Halo or bas (autour du QR / footer) */}
                <div style={{
                    position: 'absolute',
                    bottom: 50 * s,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 900 * s,
                    height: 500 * s,
                    background: `radial-gradient(circle, rgba(252,209,22,0.2) 0%, transparent 60%)`,
                    borderRadius: '50%',
                    zIndex: 0,
                }} />

                {/* ═══════════════════════════════════════════
                    MINI-LOGO RGB en haut a gauche
                ═══════════════════════════════════════════ */}

                <div style={{
                    position: 'absolute',
                    top: 40 * s,
                    left: 50 * s,
                    zIndex: 3,
                }}>
                    <MiniLogoRGB s={s} />
                </div>

                {/* ═══════════════════════════════════════════
                    CONTENU : layout flex vertical
                ═══════════════════════════════════════════ */}

                <div style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                    {/* ═══ HEADER : Logo libre + titre ═══ */}
                    <div style={{
                        marginTop: 90 * s,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        padding: `0 ${40 * s}px`,
                    }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/logo-transparent.png"
                            alt="Retour Gagnant Bénin"
                            crossOrigin="anonymous"
                            style={{
                                width: 280 * s,
                                height: 280 * s,
                                objectFit: 'contain',
                                marginBottom: 20 * s,
                                filter: `drop-shadow(0 ${8 * s}px ${24 * s}px rgba(252,209,22,0.3))`,
                            }}
                        />

                        {/* Titre XL (65 -> 78) avec gradient or + ombre */}
                        <h1 style={{
                            fontSize: 78 * s,
                            fontWeight: 900,
                            textAlign: 'center',
                            lineHeight: 1.05,
                            letterSpacing: '0.02em',
                            margin: 0,
                            background: GRADIENT_GOLD,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: `drop-shadow(0 ${3 * s}px ${10 * s}px rgba(0,0,0,0.6))`,
                        }}>
                            RETOUR GAGNANT
                        </h1>
                        <h1 style={{
                            fontSize: 78 * s,
                            fontWeight: 900,
                            textAlign: 'center',
                            lineHeight: 1.05,
                            letterSpacing: '0.02em',
                            margin: 0,
                            marginTop: 4 * s,
                            background: GRADIENT_GOLD,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: `drop-shadow(0 ${3 * s}px ${10 * s}px rgba(0,0,0,0.6))`,
                        }}>
                            BÉNIN
                        </h1>

                        {/* Separateur losange or */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16 * s,
                            marginTop: 16 * s,
                            marginBottom: 14 * s,
                        }}>
                            <div style={{ width: 90 * s, height: 2 * s, background: GRADIENT_GOLD, borderRadius: 1 }} />
                            <div style={{
                                width: 14 * s,
                                height: 14 * s,
                                transform: 'rotate(45deg)',
                                background: GRADIENT_GOLD_V,
                                boxShadow: `0 0 ${10 * s}px rgba(252,209,22,0.6)`,
                            }} />
                            <div style={{ width: 90 * s, height: 2 * s, background: GRADIENT_GOLD, borderRadius: 1 }} />
                        </div>

                        {/* Sous-titre 3 lignes */}
                        <h2 style={{
                            fontSize: 28 * s,
                            fontWeight: 500,
                            color: WHITE,
                            textAlign: 'center',
                            maxWidth: '85%',
                            lineHeight: 1.35,
                            margin: 0,
                            textShadow: `0 ${2 * s}px ${6 * s}px rgba(0,0,0,0.5)`,
                        }}>
                            L&apos;Agence d&apos;Accompagnement à<br />
                            la Nationalité et au Retour des<br />
                            Afro-descendants
                        </h2>
                    </div>

                    {/* ═══ PRESENTATION ═══ */}
                    <div style={{
                        width: '86%',
                        textAlign: 'center',
                        marginTop: 45 * s,
                        marginBottom: 35 * s,
                    }}>
                        <h3 style={{
                            fontSize: 42 * s,
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            marginBottom: 20 * s,
                            background: GRADIENT_GOLD,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: `drop-shadow(0 ${2 * s}px ${6 * s}px rgba(0,0,0,0.4))`,
                        }}>
                            PRÉSENTATION
                        </h3>
                        <p style={{
                            fontSize: 22 * s,
                            lineHeight: 1.5,
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.95)',
                            textShadow: `0 ${1 * s}px ${3 * s}px rgba(0,0,0,0.3)`,
                            margin: 0,
                        }}>
                            Retour Gagnant Bénin (RGB) est l&apos;agence de référence dédiée à l&apos;accompagnement stratégique de la diaspora historique. Nous transformons votre désir de retour en une réalité sereine et sécurisée. De l&apos;obtention de la nationalité béninoise à votre installation immobilière et entrepreneuriale, nous garantissons un ancrage digne sur la terre de vos ancêtres.
                        </p>
                        {/* Petit trait or sous la presentation */}
                        <div style={{
                            width: 80 * s,
                            height: 3 * s,
                            background: GRADIENT_GOLD,
                            borderRadius: 2,
                            margin: `${18 * s}px auto 0`,
                            boxShadow: `0 ${2 * s}px ${6 * s}px rgba(252,209,22,0.4)`,
                        }} />
                    </div>

                    {/* ═══ NOS SERVICES ═══ */}
                    <div style={{
                        width: '86%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <h3 style={{
                            fontSize: 54 * s,
                            fontWeight: 900,
                            letterSpacing: '0.06em',
                            marginBottom: 14 * s,
                            textTransform: 'uppercase',
                            background: GRADIENT_GOLD,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: `drop-shadow(0 ${3 * s}px ${10 * s}px rgba(0,0,0,0.5))`,
                            textAlign: 'center',
                        }}>
                            NOS SERVICES
                        </h3>

                        {/* Trait or large au dessus de la grille */}
                        <div style={{
                            width: '100%',
                            height: 2 * s,
                            background: GRADIENT_GOLD,
                            borderRadius: 1,
                            marginBottom: 6 * s,
                            boxShadow: `0 ${1 * s}px ${4 * s}px rgba(252,209,22,0.3)`,
                        }} />

                        {/* Grille 2 col des 8 premiers services avec lignes horizontales separatrices */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            columnGap: 34 * s,
                            width: '100%',
                        }}>
                            {SERVICES.map((svc, i) => (
                                <div key={i} style={{
                                    borderBottom: `${1.5 * s}px solid rgba(201,168,76,0.55)`,
                                }}>
                                    <ServiceRow Icon={svc.icon} title={svc.title} s={s} />
                                </div>
                            ))}
                        </div>

                        {/* 9e service : "Autres Services" pleine largeur centre */}
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            borderBottom: `${1.5 * s}px solid rgba(201,168,76,0.55)`,
                        }}>
                            <ServiceRow Icon={SERVICE_EXTRA.icon} title={SERVICE_EXTRA.title} s={s} />
                        </div>
                    </div>

                    {/* Espace flexible */}
                    <div style={{ flex: 1, minHeight: 20 * s }} />

                    {/* ═══ FOOTER : QR + contacts + slogan ═══ */}
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: 22 * s,
                        paddingBottom: 80 * s, // ~4cm marge securite
                    }}>
                        {/* QR avec logo arbre + cadre or fin */}
                        <div style={{
                            position: 'relative',
                            padding: 3 * s,
                            borderRadius: 12 * s,
                            background: GRADIENT_GOLD_V,
                            boxShadow: `0 ${8 * s}px ${28 * s}px rgba(252,209,22,0.3), 0 0 ${20 * s}px rgba(252,209,22,0.2)`,
                            marginBottom: 22 * s,
                        }}>
                            <div style={{
                                background: WHITE,
                                padding: 10 * s,
                                borderRadius: 9 * s,
                            }}>
                                <QRCodeDisplay
                                    size={165 * s}
                                    fallbackUrl={data.website || 'https://www.retourgagnantbenin.bj'}
                                />
                            </div>
                        </div>

                        {/* Contacts */}
                        <div style={{
                            textAlign: 'center',
                            fontSize: 21 * s,
                            fontWeight: 500,
                            lineHeight: 1.45,
                            color: 'rgba(255,255,255,0.95)',
                            textShadow: `0 ${1 * s}px ${3 * s}px rgba(0,0,0,0.4)`,
                            padding: `0 ${40 * s}px`,
                        }}>
                            <span style={{ color: GOLD_LIGHT, fontWeight: 800 }}>{data.phone1}</span>
                            <span style={{ margin: `0 ${12 * s}px`, color: 'rgba(255,255,255,0.4)' }}>|</span>
                            <span style={{ color: GOLD_LIGHT, fontWeight: 800 }}>{data.phone2}</span>
                            <br />
                            {data.email}
                            {data.website && (
                                <>
                                    <span style={{ margin: `0 ${10 * s}px`, color: 'rgba(255,255,255,0.4)' }}>•</span>
                                    <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>{data.website}</span>
                                </>
                            )}
                            <br />
                            {data.address}
                        </div>

                        {/* Trait or */}
                        <div style={{
                            width: '55%',
                            height: 2 * s,
                            background: GRADIENT_GOLD,
                            borderRadius: 2,
                            marginTop: 20 * s,
                            marginBottom: 16 * s,
                            boxShadow: `0 ${2 * s}px ${6 * s}px rgba(252,209,22,0.4)`,
                        }} />

                        {/* Slogan en BLANC (comme le design de reference) */}
                        <div style={{
                            fontSize: 28 * s,
                            fontWeight: 800,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            color: WHITE,
                            textShadow: `0 ${2 * s}px ${8 * s}px rgba(0,0,0,0.5)`,
                        }}>
                            Votre Retour, Notre Mission
                        </div>
                    </div>
                </div>
            </div>
        )
    }
)
RollUp.displayName = 'RollUp'
