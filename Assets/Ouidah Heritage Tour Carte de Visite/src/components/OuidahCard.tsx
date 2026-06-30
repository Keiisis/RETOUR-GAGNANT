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
   PALETTE — Extraite du blason Ouidah Heritage Tour
   • Bleu Marine profond  : couleur de l'océan dans le blason
   • Rouge Terre          : couleur du serpent Dan & symboles
   • Or Ambre             : couleur de la nef & tresse
   • Crème Parchemin      : fond, rappelle les manuscrits anciens
   • Charbon doux         : textes principaux
══════════════════════════════════════════════════════════════ */

const NAVY      = '#1B2A4A'   // Bleu marine profond (océan du blason)
const NAVY_DEEP = '#0F1C33'   // Marine très sombre pour les accents
const TERRACOTTA= '#A8341A'   // Rouge terre du serpent Dan
const AMBER     = '#C88B2A'   // Or ambre de la nef et de la tresse
const AMBER_L   = '#E0A840'   // Or clair lumineux
const CREAM     = '#FAF6F0'   // Crème parchemin
const CREAM_D   = '#F0E8DB'   // Crème légèrement plus sombre
const CHARCOAL  = '#1E1A17'   // Noir chaud
const MUTED     = '#8A7B6C'   // Taupe pour les secondaires
const WHITE     = '#FFFFFF'

/* ══════════════════════════════════════════════════════════════
   TYPOGRAPHY
══════════════════════════════════════════════════════════════ */

const SERIF = "var(--font-playfair), 'Cormorant Garamond', 'Didot', Georgia, serif"
const SANS  = "var(--font-montserrat), 'Inter', 'Helvetica Neue', Arial, sans-serif"

/* ══════════════════════════════════════════════════════════════
   MOTIF SVG — Entrelacs tribaux (inspiré de la tresse du blason)
══════════════════════════════════════════════════════════════ */

const TricolorBraid = ({ width, height, s }: { width: number; height: number; s: number }) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
    <defs>
      <pattern id="braid" x="0" y="0" width={24 * s} height={height} patternUnits="userSpaceOnUse">
        {/* Navy strand */}
        <ellipse cx={12 * s} cy={height * 0.25} rx={6 * s} ry={height * 0.18} fill={NAVY} opacity="0.85" />
        {/* Terracotta strand */}
        <ellipse cx={6 * s} cy={height * 0.5} rx={6 * s} ry={height * 0.18} fill={TERRACOTTA} opacity="0.85" />
        {/* Amber strand */}
        <ellipse cx={18 * s} cy={height * 0.5} rx={6 * s} ry={height * 0.18} fill={AMBER} opacity="0.85" />
        {/* Navy strand bottom */}
        <ellipse cx={12 * s} cy={height * 0.75} rx={6 * s} ry={height * 0.18} fill={NAVY} opacity="0.85" />
      </pattern>
    </defs>
    <rect width={width} height={height} fill={`url(#braid)`} />
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   SERPENT DAN — Motif SVG simplifié (décoratif)
══════════════════════════════════════════════════════════════ */

const DanSerpent = ({ size, col }: { size: number; col: string }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 60 84" fill="none" style={{ display: 'block' }}>
    {/* Corps du serpent courbé */}
    <path
      d="M30 80 C10 70 8 55 20 45 C32 35 42 35 38 22 C34 10 22 8 18 15"
      stroke={col} strokeWidth="6" strokeLinecap="round" fill="none"
    />
    {/* Tête */}
    <ellipse cx="16" cy="12" rx="8" ry="6" fill={col} />
    {/* Œil */}
    <circle cx="19" cy="10" r="2" fill={WHITE} />
    <circle cx="20" cy="10" r="1" fill={CHARCOAL} />
    {/* Langue */}
    <path d="M8 13 L3 11 M8 13 L3 16" stroke={col} strokeWidth="1.5" strokeLinecap="round" />
    {/* Queue */}
    <path d="M30 80 C35 83 38 82 36 78" stroke={col} strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   NEFS (Voilier) — Motif SVG
══════════════════════════════════════════════════════════════ */

const SailingShip = ({ size, col }: { size: number; col: string }) => (
  <svg width={size * 1.6} height={size} viewBox="0 0 96 60" fill={col} style={{ display: 'block' }}>
    {/* Coque */}
    <path d="M10 42 Q48 50 86 42 L82 52 Q48 58 14 52 Z" />
    {/* Mât */}
    <rect x="46" y="10" width="3" height="32" />
    {/* Grande voile */}
    <path d="M49 12 L49 40 L75 30 Z" opacity="0.9" />
    {/* Petite voile avant */}
    <path d="M46 16 L46 38 L24 32 Z" opacity="0.75" />
    {/* Pavillon */}
    <path d="M49 10 L62 6 L49 12 Z" />
    {/* Vagues */}
    <path d="M2 46 Q16 44 20 46 Q28 48 32 46" stroke={col} strokeWidth="1.5" fill="none" opacity="0.5" />
    <path d="M64 46 Q78 44 82 46 Q90 48 94 46" stroke={col} strokeWidth="1.5" fill="none" opacity="0.5" />
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   ICÔNES CONTACTS — Stroke 1.2px, style gravure
══════════════════════════════════════════════════════════════ */

const IcoPhone = ({ sz, col }: { sz: number; col: string }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.2"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.13 12.77a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
)

const IcoMail = ({ sz, col }: { sz: number; col: string }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.2"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

const IcoGlobe = ({ sz, col }: { sz: number; col: string }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.2"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
)

const IcoPin = ({ sz, col }: { sz: number; col: string }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.2"
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   QR CODE — Avec fallback image custom
══════════════════════════════════════════════════════════════ */

function QRCodeDisplay({ size, dark, light }: { size: number; dark: string; light: string }) {
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
    img.src = '/images/qr-ouidah.png'
  }, [])

  if (qrSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={qrSrc} alt="QR Code" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
  }

  return (
    <QRCode
      value="https://www.ouidahheritagetour.com"
      size={size}
      fgColor={dark}
      bgColor={light}
      level="M"
    />
  )
}

/* ══════════════════════════════════════════════════════════════
   LOGO OUIDAH — Avec fallback SVG emblématique si image absente
══════════════════════════════════════════════════════════════ */

function OuidahLogo({ size, s }: { size: number; s: number }) {
  const [hasLogo, setHasLogo] = useState(true)

  return hasLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/ouidah-logo.png"
      alt="Ouidah Heritage Tour"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
      onError={() => setHasLogo(false)}
    />
  ) : (
    /* Blason SVG de secours — fidèle au logo fourni */
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: 'block' }}>
      {/* Cercle de fond */}
      <circle cx="100" cy="100" r="95" fill={CREAM} stroke={AMBER} strokeWidth="2" />

      {/* Zone océan (moitié basse) */}
      <path d="M20 115 Q100 105 180 115 L180 185 Q100 195 20 185 Z" fill={NAVY} opacity="0.85" />
      <path d="M20 115 Q100 105 180 115" stroke={NAVY_DEEP} strokeWidth="1.5" fill="none" />

      {/* Bordure tressée tricolore — simplifiée */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * Math.PI * 2 - Math.PI / 2
        const r = 88
        const x = 100 + r * Math.cos(angle)
        const y = 100 + r * Math.sin(angle)
        const cols = [NAVY, TERRACOTTA, AMBER]
        return <circle key={i} cx={x} cy={y} r="5.5" fill={cols[i % 3]} />
      })}

      {/* Voilier */}
      <g transform="translate(55, 28) scale(0.85)">
        <rect x="43" y="8" width="2.5" height="28" fill={AMBER} />
        <path d="M45.5 10 L45.5 34 L68 26 Z" fill={AMBER} />
        <path d="M43 14 L43 34 L24 28 Z" fill={AMBER} opacity="0.8" />
        <path d="M8 38 Q46 44 84 38 L80 48 Q46 54 12 48 Z" fill={AMBER} />
      </g>

      {/* Serpent Dan */}
      <path
        d="M62 160 C48 148 46 132 56 122 C66 112 76 114 74 102 C72 90 62 88 60 96"
        stroke={TERRACOTTA} strokeWidth="7" strokeLinecap="round" fill="none"
      />
      <ellipse cx="58" cy="93" rx="9" ry="6.5" fill={TERRACOTTA} />
      <circle cx="63" cy="91" r="2" fill={WHITE} />
      <circle cx="64" cy="91" r="1" fill={CHARCOAL} />

      {/* Croix Vévé (symbole vodoun) */}
      <rect x="96" y="100" width="3" height="38" fill={TERRACOTTA} />
      <rect x="86" y="114" width="23" height="3" fill={TERRACOTTA} />
      <rect x="90" y="104" width="3.5" height="30" fill={TERRACOTTA} transform="rotate(45,91.75,119)" />
      <rect x="90" y="104" width="3.5" height="30" fill={TERRACOTTA} transform="rotate(-45,91.75,119)" />
      <circle cx="97.5" cy="97" r="4" fill="none" stroke={TERRACOTTA} strokeWidth="2.5" />

      {/* Colonnes / Temple */}
      <rect x="138" y="100" width="8" height="42" fill={TERRACOTTA} />
      <rect x="154" y="100" width="8" height="42" fill={TERRACOTTA} />
      <rect x="134" y="97" width="32" height="5" fill={TERRACOTTA} />
      <rect x="134" y="142" width="32" height="4" fill={TERRACOTTA} />

      {/* Lignes vagues dans l'océan */}
      <path d="M40 130 Q55 127 65 130" stroke={WHITE} strokeWidth="1.5" fill="none" opacity="0.4" />
      <path d="M120 125 Q140 122 155 125" stroke={WHITE} strokeWidth="1.5" fill="none" opacity="0.4" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   RECTO — "Le Blason"
   Composition centrée et majestueuse
   Fond crème parchemin, blason central, typographie Serif
══════════════════════════════════════════════════════════════ */

export const CardRecto = forwardRef<HTMLDivElement, { data: CardData; scale?: number }>(
  ({ scale = 1 }, ref) => {
    const W = 900 * scale, H = 540 * scale, s = scale

    return (
      <div ref={ref} style={{
        width: W,
        height: H,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: CREAM,
        boxSizing: 'border-box',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
      }}>

        {/* ── Fond parchemin texturé (SVG noise) ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
          <filter id="recto-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#recto-noise)" />
        </svg>

        {/* ── Bande tricolore gauche — rappel du blason ── */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7 * s, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, backgroundColor: NAVY }} />
          <div style={{ flex: 1, backgroundColor: TERRACOTTA }} />
          <div style={{ flex: 1, backgroundColor: AMBER }} />
        </div>

        {/* ── Bande tricolore droite ── */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7 * s, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, backgroundColor: AMBER }} />
          <div style={{ flex: 1, backgroundColor: TERRACOTTA }} />
          <div style={{ flex: 1, backgroundColor: NAVY }} />
        </div>

        {/* ── Filet or en haut ── */}
        <div style={{
          position: 'absolute', top: 0, left: 7 * s, right: 7 * s,
          height: 3 * s, backgroundColor: AMBER, opacity: 0.7,
        }} />

        {/* ── Filet or en bas ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 7 * s, right: 7 * s,
          height: 3 * s, backgroundColor: AMBER, opacity: 0.7,
        }} />

        {/* ── Cadre intérieur de prestige (double liseré) ── */}
        <div style={{
          position: 'absolute',
          top: 18 * s, bottom: 18 * s,
          left: 22 * s, right: 22 * s,
          border: `0.5px solid ${AMBER}`,
          opacity: 0.45,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          top: 22 * s, bottom: 22 * s,
          left: 26 * s, right: 26 * s,
          border: `0.5px solid ${AMBER}`,
          opacity: 0.2,
          pointerEvents: 'none',
        }} />

        {/* ── Nef (voilier) — motif gauche haut ── */}
        <div style={{
          position: 'absolute',
          top: 34 * s, left: 40 * s,
          opacity: 0.12,
        }}>
          <SailingShip size={40 * s} col={NAVY} />
        </div>

        {/* ── Serpent Dan — motif droit bas ── */}
        <div style={{
          position: 'absolute',
          bottom: 30 * s, right: 44 * s,
          opacity: 0.1,
          transform: 'scaleX(-1)',
        }}>
          <DanSerpent size={32 * s} col={TERRACOTTA} />
        </div>

        {/* ══════════════════════════════════════════
            CONTENU CENTRAL — Composition axiale
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          paddingTop: 10 * s,
        }}>

          {/* Petite couronne décorative (motif dentelle) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10 * s,
            marginBottom: 22 * s,
          }}>
            <div style={{ width: 40 * s, height: 1 * s, background: `linear-gradient(to right, transparent, ${AMBER})` }} />
            <svg width={20 * s} height={12 * s} viewBox="0 0 20 12">
              <path d="M0 12 L0 4 L5 0 L10 6 L15 0 L20 4 L20 12" fill="none" stroke={AMBER} strokeWidth="0.8" />
            </svg>
            <div style={{ width: 40 * s, height: 1 * s, background: `linear-gradient(to left, transparent, ${AMBER})` }} />
          </div>

          {/* LOGO / BLASON */}
          <div style={{
            width: 200 * s,
            height: 200 * s,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.12))',
          }}>
            <OuidahLogo size={192 * s} s={s} />
          </div>

          {/* Séparateur aile */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14 * s,
            marginTop: 22 * s,
            marginBottom: 14 * s,
          }}>
            <div style={{ width: 60 * s, height: 1 * s, background: `linear-gradient(to right, transparent, ${AMBER})` }} />
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', backgroundColor: TERRACOTTA }} />
            <div style={{ width: 6 * s, height: 6 * s, transform: 'rotate(45deg)', backgroundColor: AMBER }} />
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', backgroundColor: TERRACOTTA }} />
            <div style={{ width: 60 * s, height: 1 * s, background: `linear-gradient(to left, transparent, ${AMBER})` }} />
          </div>

          {/* NOM — Grand Serif */}
          <div style={{
            fontFamily: SERIF,
            color: NAVY_DEEP,
            fontSize: 38 * s,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
            lineHeight: 1,
          }}>
            Ouidah Heritage Tour
          </div>

          {/* Tagline — Cuivre, Italic Serif */}
          <div style={{
            fontFamily: SERIF,
            color: TERRACOTTA,
            fontSize: 13.5 * s,
            fontStyle: 'italic',
            fontWeight: 400,
            letterSpacing: '0.06em',
            textAlign: 'center',
            marginTop: 10 * s,
          }}>
            « Retour aux sources — Voyage dans la mémoire »
          </div>

          {/* Label Bénin */}
          <div style={{
            fontFamily: SANS,
            color: MUTED,
            fontSize: 9 * s,
            fontWeight: 500,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginTop: 14 * s,
          }}>
            Ouidah · Bénin · Afrique de l'Ouest
          </div>
        </div>
      </div>
    )
  }
)
CardRecto.displayName = 'CardRecto'

/* ══════════════════════════════════════════════════════════════
   VERSO — "Le Cartouche"
   Fond navy profond, typographie blanche et ambrée
   Colonne gauche (identité + contacts) / Colonne droite (QR)
   Éléments du blason en filigrane
══════════════════════════════════════════════════════════════ */

export const CardVerso = forwardRef<HTMLDivElement, { data: CardData; scale?: number }>(
  ({ data, scale = 1 }, ref) => {
    const W = 900 * scale, H = 540 * scale, s = scale
    const qrSize = Math.round(118 * s)

    return (
      <div ref={ref} style={{
        width: W,
        height: H,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: NAVY,
        boxSizing: 'border-box',
        boxShadow: '0 25px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.1)',
      }}>

        {/* ── Fond parchemin texturé (SVG noise) ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }}>
          <filter id="verso-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#verso-noise)" />
        </svg>

        {/* ── Blason en filigrane — grand, centré, très opaque ── */}
        <div style={{
          position: 'absolute',
          right: -20 * s,
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.04,
          pointerEvents: 'none',
        }}>
          <OuidahLogo size={420 * s} s={s} />
        </div>

        {/* ── Serpent Dan — filigrane gauche ── */}
        <div style={{
          position: 'absolute',
          left: 20 * s,
          bottom: 20 * s,
          opacity: 0.06,
          pointerEvents: 'none',
        }}>
          <DanSerpent size={80 * s} col={AMBER} />
        </div>

        {/* ── Bandes tricolores gauche ── */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7 * s, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, backgroundColor: AMBER }} />
          <div style={{ flex: 1, backgroundColor: TERRACOTTA }} />
          <div style={{ flex: 1, backgroundColor: AMBER_L, opacity: 0.7 }} />
        </div>

        {/* ── Bandes tricolores droite ── */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7 * s, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, backgroundColor: AMBER_L, opacity: 0.7 }} />
          <div style={{ flex: 1, backgroundColor: TERRACOTTA }} />
          <div style={{ flex: 1, backgroundColor: AMBER }} />
        </div>

        {/* ── Liseré haut ── */}
        <div style={{
          position: 'absolute', top: 0, left: 7 * s, right: 7 * s,
          height: 2.5 * s, backgroundColor: AMBER, opacity: 0.6,
        }} />

        {/* ── Liseré bas ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 7 * s, right: 7 * s,
          height: 2.5 * s, backgroundColor: AMBER, opacity: 0.6,
        }} />

        {/* ── Cadre prestige intérieur ── */}
        <div style={{
          position: 'absolute',
          top: 18 * s, bottom: 18 * s,
          left: 22 * s, right: 22 * s,
          border: `0.5px solid ${AMBER}`,
          opacity: 0.2,
          pointerEvents: 'none',
        }} />

        {/* ══════════════════════════════════════════
            LAYOUT COLONNES
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute',
          top: 38 * s,
          bottom: 38 * s,
          left: 38 * s,
          right: 38 * s,
          display: 'flex',
          gap: 0,
        }}>

          {/* ═══ GAUCHE — Identité & Contacts ═══ */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingRight: 36 * s,
            borderRight: `1px solid rgba(200,139,42,0.2)`,
          }}>

            {/* BLOC IDENTITÉ */}
            <div>
              {/* Logo compact + "Ouidah Heritage Tour" */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10 * s,
                marginBottom: 24 * s,
              }}>
                <div style={{ flexShrink: 0 }}>
                  <OuidahLogo size={38 * s} s={s} />
                </div>
                <div>
                  <div style={{
                    fontFamily: SANS,
                    color: AMBER,
                    fontSize: 9 * s,
                    fontWeight: 600,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}>
                    Ouidah Heritage Tour
                  </div>
                  <div style={{
                    fontFamily: SERIF,
                    color: CREAM,
                    fontSize: 8 * s,
                    fontStyle: 'italic',
                    opacity: 0.6,
                    marginTop: 3 * s,
                  }}>
                    Guide officiel du patrimoine
                  </div>
                </div>
              </div>

              {/* PRÉNOM */}
              <div style={{
                fontFamily: SANS,
                color: AMBER_L,
                fontSize: 13 * s,
                fontWeight: 500,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                marginBottom: 6 * s,
              }}>
                {data.prenom}
              </div>

              {/* NOM */}
              <div style={{
                fontFamily: SERIF,
                color: CREAM,
                fontSize: 46 * s,
                fontWeight: 700,
                lineHeight: 0.92,
                letterSpacing: '0.01em',
                marginBottom: 18 * s,
              }}>
                {data.nom}
              </div>

              {/* Séparateur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 * s, marginBottom: 14 * s }}>
                <div style={{ width: 30 * s, height: 1.5 * s, backgroundColor: TERRACOTTA }} />
                <div style={{ width: 5 * s, height: 5 * s, borderRadius: '50%', backgroundColor: AMBER, opacity: 0.8 }} />
                <div style={{ width: 80 * s, height: 0.5 * s, backgroundColor: AMBER, opacity: 0.25 }} />
              </div>

              {/* POSTE */}
              <div style={{
                fontFamily: SANS,
                color: CREAM,
                fontSize: 10.5 * s,
                fontWeight: 300,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                opacity: 0.75,
              }}>
                {data.position || 'Guide & Expert Patrimoine'}
              </div>
            </div>

            {/* BLOC CONTACTS */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12 * s,
            }}>
              {data.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                  <IcoPhone sz={Math.round(14 * s)} col={TERRACOTTA} />
                  <span style={{
                    fontFamily: SANS,
                    color: CREAM,
                    fontSize: 13 * s,
                    fontWeight: 300,
                    letterSpacing: '0.08em',
                    opacity: 0.9,
                  }}>
                    {data.phone}
                  </span>
                </div>
              )}
              {data.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                  <IcoMail sz={Math.round(14 * s)} col={TERRACOTTA} />
                  <span style={{
                    fontFamily: SANS,
                    color: CREAM,
                    fontSize: 13 * s,
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    opacity: 0.9,
                  }}>
                    {data.email}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                <IcoGlobe sz={Math.round(14 * s)} col={TERRACOTTA} />
                <span style={{
                  fontFamily: SANS,
                  color: AMBER,
                  fontSize: 12 * s,
                  fontWeight: 400,
                  letterSpacing: '0.05em',
                  opacity: 0.85,
                }}>
                  www.ouidahheritagetour.com
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                <IcoPin sz={Math.round(14 * s)} col={TERRACOTTA} />
                <span style={{
                  fontFamily: SANS,
                  color: CREAM,
                  fontSize: 11 * s,
                  fontWeight: 300,
                  letterSpacing: '0.04em',
                  opacity: 0.65,
                }}>
                  Ouidah, République du Bénin
                </span>
              </div>
            </div>
          </div>

          {/* ═══ DROITE — QR Code & déco ═══ */}
          <div style={{
            width: 230 * s,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 36 * s,
          }}>

            {/* Voilier déco */}
            <div style={{ opacity: 0.5 }}>
              <SailingShip size={32 * s} col={AMBER} />
            </div>

            {/* QR Code — Cadre blanc avec double bordure */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 * s }}>
              <div style={{
                padding: `${2 * s}px`,
                border: `2px solid ${AMBER}`,
                borderRadius: 4 * s,
                backgroundColor: CREAM,
                boxShadow: `0 0 0 1px rgba(200,139,42,0.3), 0 12px 32px rgba(0,0,0,0.35)`,
              }}>
                <div style={{
                  padding: `${10 * s}px`,
                  backgroundColor: WHITE,
                }}>
                  <QRCodeDisplay size={qrSize} dark={NAVY} light={WHITE} />
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: SANS,
                  color: AMBER,
                  fontSize: 8 * s,
                  fontWeight: 600,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  marginBottom: 3 * s,
                }}>
                  Scanner pour explorer
                </div>
                <div style={{
                  fontFamily: SERIF,
                  color: CREAM,
                  fontSize: 9 * s,
                  fontStyle: 'italic',
                  opacity: 0.5,
                }}>
                  ouidahheritagetour.com
                </div>
              </div>
            </div>

            {/* Bas : Ornement tricolore */}
            <div style={{ display: 'flex', gap: 4 * s, alignItems: 'center' }}>
              <div style={{ width: 18 * s, height: 3 * s, backgroundColor: NAVY, border: `1px solid ${AMBER}`, opacity: 0.7 }} />
              <div style={{ width: 18 * s, height: 3 * s, backgroundColor: TERRACOTTA }} />
              <div style={{ width: 18 * s, height: 3 * s, backgroundColor: AMBER }} />
            </div>
          </div>
        </div>
      </div>
    )
  }
)
CardVerso.displayName = 'CardVerso'
