'use client'

import React, { useRef, useState, useCallback } from 'react'
import { CardRecto, CardVerso, type CardData } from '@/components/OuidahCard'

/* ══════════════════════════════════════════════════════════════
   PAGE — Générateur de cartes de visite Ouidah Heritage Tour
══════════════════════════════════════════════════════════════ */

const DEFAULT_DATA: CardData = {
  prenom: 'Armel',
  nom: 'Adjovi',
  position: 'Guide & Expert Patrimoine',
  phone: '+229 97 00 00 00',
  email: 'armel@ouidahheritagetour.com',
}

// Styles couleurs cohérents avec la palette du composant
const NAVY    = '#1B2A4A'
const AMBER   = '#C88B2A'
const TERRA   = '#A8341A'
const CREAM   = '#FAF6F0'
const MUTED   = '#8A7B6C'

export default function HomePage() {
  const [data, setData] = useState<CardData>(DEFAULT_DATA)
  const [scale, setScale] = useState(0.62)
  const [activeView, setActiveView] = useState<'both' | 'recto' | 'verso'>('both')
  const [downloading, setDownloading] = useState(false)

  const rectoRef = useRef<HTMLDivElement>(null)
  const versoRef = useRef<HTMLDivElement>(null)

  const handleChange = useCallback((field: keyof CardData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setData(prev => ({ ...prev, [field]: e.target.value }))
  }, [])

  const downloadCard = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return
    setDownloading(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: undefined,
      })
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloading(false)
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${NAVY} 0%, #0F1C33 40%, #1a1228 100%)`,
      fontFamily: "var(--font-montserrat), 'Inter', sans-serif",
    }}>

      {/* ══ HEADER ══ */}
      <header style={{
        borderBottom: `1px solid rgba(200,139,42,0.2)`,
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Logo miniature */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ouidah-logo.png"
            alt="Ouidah Heritage Tour"
            width={44}
            height={44}
            style={{ objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div>
            <div style={{ color: AMBER, fontSize: 18, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Ouidah Heritage Tour
            </div>
            <div style={{ color: 'rgba(250,246,240,0.5)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
              Générateur de cartes de visite
            </div>
          </div>
        </div>

        {/* Indicateur vague/prestige */}
        <div style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}>
          <div style={{ width: 28, height: 4, backgroundColor: NAVY, border: `1px solid ${AMBER}`, borderRadius: 2 }} />
          <div style={{ width: 28, height: 4, backgroundColor: TERRA, borderRadius: 2 }} />
          <div style={{ width: 28, height: 4, backgroundColor: AMBER, borderRadius: 2 }} />
        </div>
      </header>

      <div style={{
        display: 'flex',
        minHeight: 'calc(100vh - 85px)',
      }}>

        {/* ══ PANNEAU FORMULAIRE (gauche) ══ */}
        <aside style={{
          width: 320,
          flexShrink: 0,
          borderRight: `1px solid rgba(200,139,42,0.15)`,
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          overflowY: 'auto',
        }}>

          {/* Section : Identité */}
          <section>
            <div style={{
              color: AMBER,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${AMBER}40, transparent)` }} />
              Identité
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, ${AMBER}40, transparent)` }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([
                { label: 'Prénom', field: 'prenom' as keyof CardData, placeholder: 'Armel' },
                { label: 'Nom de famille', field: 'nom' as keyof CardData, placeholder: 'Adjovi' },
                { label: 'Poste / Titre', field: 'position' as keyof CardData, placeholder: 'Guide & Expert Patrimoine' },
              ] as const).map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label style={{
                    display: 'block',
                    color: 'rgba(250,246,240,0.5)',
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={data[field]}
                    onChange={handleChange(field)}
                    placeholder={placeholder}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid rgba(200,139,42,0.25)`,
                      borderRadius: 6,
                      color: CREAM,
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = AMBER)}
                    onBlur={e => (e.target.style.borderColor = 'rgba(200,139,42,0.25)')}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Section : Contacts */}
          <section>
            <div style={{
              color: TERRA,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${TERRA}40, transparent)` }} />
              Contacts
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, ${TERRA}40, transparent)` }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([
                { label: 'Téléphone', field: 'phone' as keyof CardData, placeholder: '+229 97 00 00 00', type: 'tel' },
                { label: 'Email', field: 'email' as keyof CardData, placeholder: 'nom@ouidahheritagetour.com', type: 'email' },
              ] as const).map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label style={{
                    display: 'block',
                    color: 'rgba(250,246,240,0.5)',
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={data[field]}
                    onChange={handleChange(field)}
                    placeholder={placeholder}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid rgba(168,52,26,0.25)`,
                      borderRadius: 6,
                      color: CREAM,
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = TERRA)}
                    onBlur={e => (e.target.style.borderColor = 'rgba(168,52,26,0.25)')}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Section : Zoom */}
          <section>
            <div style={{
              color: 'rgba(250,246,240,0.4)',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Zoom aperçu — {Math.round(scale * 100)}%
            </div>
            <input
              type="range"
              min={0.3}
              max={0.85}
              step={0.01}
              value={scale}
              onChange={e => setScale(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: AMBER,
                cursor: 'pointer',
              }}
            />
          </section>

          {/* Section : Téléchargements */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <div style={{
              color: AMBER,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${AMBER}40, transparent)` }} />
              Exporter
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, ${AMBER}40, transparent)` }} />
            </div>

            {([
              { label: 'Télécharger le Recto', ref: rectoRef, file: 'ouidah-recto.png' },
              { label: 'Télécharger le Verso', ref: versoRef, file: 'ouidah-verso.png' },
            ] as const).map(({ label, ref: btnRef, file }) => (
              <button
                key={file}
                onClick={() => downloadCard(btnRef, file)}
                disabled={downloading}
                style={{
                  padding: '12px 20px',
                  background: downloading
                    ? 'rgba(200,139,42,0.15)'
                    : `linear-gradient(135deg, ${AMBER} 0%, #B07820 100%)`,
                  border: 'none',
                  borderRadius: 6,
                  color: downloading ? MUTED : NAVY,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  width: '100%',
                  textTransform: 'uppercase',
                }}
              >
                {downloading ? '⏳ En cours...' : `↓ ${label}`}
              </button>
            ))}
          </section>
        </aside>

        {/* ══ ZONE D'APERÇU (droite) ══ */}
        <main style={{
          flex: 1,
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          overflowY: 'auto',
        }}>

          {/* Onglets de vue */}
          <div style={{
            display: 'flex',
            gap: 0,
            border: `1px solid rgba(200,139,42,0.2)`,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {([
              { key: 'both', label: 'Recto & Verso' },
              { key: 'recto', label: 'Recto seul' },
              { key: 'verso', label: 'Verso seul' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                style={{
                  padding: '9px 20px',
                  background: activeView === key ? AMBER : 'transparent',
                  border: 'none',
                  color: activeView === key ? NAVY : 'rgba(250,246,240,0.5)',
                  fontSize: 12,
                  fontWeight: activeView === key ? 700 : 400,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  borderRight: key !== 'verso' ? `1px solid rgba(200,139,42,0.2)` : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cartes */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 40,
            alignItems: 'center',
            width: '100%',
          }}>

            {/* RECTO */}
            {(activeView === 'both' || activeView === 'recto') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{
                  color: AMBER,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.4em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}>
                  ✦ Recto ✦
                </div>
                <div style={{
                  filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))',
                }}>
                  <CardRecto ref={rectoRef} data={data} scale={scale} />
                </div>
              </div>
            )}

            {/* VERSO */}
            {(activeView === 'both' || activeView === 'verso') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{
                  color: AMBER,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.4em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}>
                  ✦ Verso ✦
                </div>
                <div style={{
                  filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))',
                }}>
                  <CardVerso ref={versoRef} data={data} scale={scale} />
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div style={{
            marginTop: 20,
            padding: '16px 24px',
            background: 'rgba(200,139,42,0.05)',
            border: `1px solid rgba(200,139,42,0.12)`,
            borderRadius: 8,
            maxWidth: 600,
            textAlign: 'center',
          }}>
            <div style={{ color: AMBER, fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
              💡 Impression recommandée
            </div>
            <div style={{ color: 'rgba(250,246,240,0.45)', fontSize: 12, lineHeight: 1.6 }}>
              Format <strong style={{ color: 'rgba(250,246,240,0.7)' }}>9cm × 5.4cm</strong> · Papier couché mat <strong style={{ color: 'rgba(250,246,240,0.7)' }}>400g</strong> ·
              Vernis sélectif sur le logo · Téléchargez en 3× pour une qualité d&apos;impression optimale.
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
