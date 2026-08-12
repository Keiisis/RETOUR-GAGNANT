'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Script from 'next/script'
import { CheckCircle as CheckCircle2, Receipt, Download, CircleNotch as Loader2, PenNib as PenTool, ShieldCheck, Envelope as Mail, Phone, Calendar, CreditCard, X, CaretRight as ChevronRight, WarningCircle as AlertCircle, Shield } from '@phosphor-icons/react';
import { LOGO_BASE64, STAMP_BASE64 } from '@/lib/logoBase64'
import { convertCurrency, getCurrencyForLang, formatPriceWithMargin, refreshRates, type CurrencyCode } from '@/lib/currency'
import { useTranslation } from '@/lib/translation'
import CurrencySelector from '@/components/boutique/CurrencySelector'

// Safe date formatter to avoid RangeError: Invalid time value
const formatDateSafe = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR')
}

interface DocumentFinancier {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_phone: string
    client_adresse: string
    items: any[]
    currency: string
    sous_total: number
    total_tva: number
    remise: number
    total: number
    status: string
    notes: string
    conditions: string
    validite: string
    created_at: string
    signature_url?: string
    signed_at?: string
    parent_devis_id?: string
}

export default function ClientPortalPage() {
    const params = useParams()
    const id = params?.id as string
    
    const [doc, setDoc] = useState<DocumentFinancier | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [signing, setSigning] = useState(false)
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState('')

    // Canvas Refs for Signature
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    const [paymentSettings, setPaymentSettings] = useState<any>({})
    const [showPaymentMethods, setShowPaymentMethods] = useState(false)
    const [paymentError, setPaymentError] = useState('')
    // ── ACOMPTE : montant choisi par le client (vide = solde total) ──
    const [acompte, setAcompte] = useState('')
    const [dejaPaye, setDejaPaye] = useState(0)
    const { lang } = useTranslation()
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => getCurrencyForLang(lang))
    useEffect(() => { setSelectedCurrency(getCurrencyForLang(lang)) }, [lang])

    const [clientSession, setClientSession] = useState<any>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setClientSession(session)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setClientSession(session)
        })
        // Taux de change à jour AVANT toute conversion vers XOF (charge Kkiapay/
        // FedaPay d'une facture EUR/USD) : évite d'utiliser le taux de secours
        // codé (USD=600) et de sur/sous-facturer le client.
        refreshRates().catch(() => {})
        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings/payment')
                const data = await res.json()
                setPaymentSettings(data)
            } catch (e) {
                console.error('Settings fetch error:', e)
            }
        }

        const fetchDoc = async () => {
            if (!id) return
            const { data, error } = await supabase
                .from('documents_financiers')
                .select('*')
                .eq('id', id)
                .single()
                
            if (error || !data) {
                setError("Document introuvable ou lien invalide.")
            } else {
                setDoc(data as DocumentFinancier)
                if (data.signature_url) {
                    setSignatureUrl(data.signature_url)
                } else if (data.type === 'facture' && data.parent_devis_id) {
                    // Héritage de la signature du devis parent
                    const { data: parentData } = await supabase
                        .from('documents_financiers')
                        .select('signature_url, signed_at')
                        .eq('id', data.parent_devis_id)
                        .single()
                    
                    if (parentData?.signature_url) {
                        setSignatureUrl(parentData.signature_url)
                        setDoc(prev => prev ? { 
                            ...prev, 
                            signature_url: parentData.signature_url,
                            signed_at: parentData.signed_at 
                        } : null)
                    }
                }
            }
            setLoading(false)
        }
        // Encaissements déjà enregistrés (acomptes) → solde restant dû
        const fetchPaiements = async () => {
            if (!id) return
            const { data } = await supabase
                .from('paiements_manuels').select('montant').eq('document_id', id)
            setDejaPaye((data || []).reduce((a, p) => a + (Number(p.montant) || 0), 0))
        }
        fetchSettings()
        fetchDoc()
        fetchPaiements()
    }, [id])

    // ─── Signature Logic ──────────────────────────────────────────
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true)
        draw(e)
    }

    const endDrawing = () => {
        setIsDrawing(false)
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) ctx.beginPath()
        }
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        let x = 0
        let y = 0
        
        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left
            y = e.touches[0].clientY - rect.top
        } else {
            x = (e as React.MouseEvent).clientX - rect.left
            y = (e as React.MouseEvent).clientY - rect.top
        }

        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#00af64' // Emerald color

        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const clearSignature = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const saveSignature = async () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const pixelBuffer = new Uint32Array(ctx!.getImageData(0, 0, canvas.width, canvas.height).data.buffer)
        const isCanvasBlank = !pixelBuffer.some(color => color !== 0)

        if (isCanvasBlank) {
            alert('Veuillez apposer votre signature avant de valider.')
            return
        }

        setIsProcessing(true)
        const dataUrl = canvas.toDataURL('image/png')

        try {
            const res = await fetch('/api/documents/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_id: id, signature_url: dataUrl })
            })
            const json = await res.json()

            if (json.success) {
                const signedAt = json.signed_at || new Date().toISOString()
                setSignatureUrl(dataUrl)
                setDoc(prev => prev ? {
                    ...prev,
                    status: 'accepte',
                    signature_url: dataUrl,
                    signed_at: signedAt,
                } : null)
                setSigning(false)
                // Devis accepté : on invite immédiatement au paiement (le paiement
                // justifie l'émission de la facture) : ouverture directe du choix
                // de moyen de paiement.
                setTimeout(() => processPayment(), 400)
            } else {
                alert('Erreur lors de la sauvegarde : ' + (json.error || 'Erreur inconnue'))
            }
        } catch {
            alert('Erreur réseau. Vérifiez votre connexion et réessayez.')
        }
        setIsProcessing(false)
    }

    // Montant réellement débité : acompte saisi, sinon SOLDE restant dû.
    // Tout est ramené en XOF (devise d'encaissement des passerelles).
    const totalXOF = doc
        ? (doc.currency === 'XOF' || doc.currency === 'FCFA'
            ? Number(doc.total) || 0
            : convertCurrency(Number(doc.total) || 0, doc.currency as CurrencyCode, 'XOF'))
        : 0
    const soldeXOF = Math.max(0, Math.round(totalXOF - dejaPaye))
    const acompteXOF = Math.round(Number(acompte) || 0)
    const aPayerXOF = acompteXOF > 0 ? Math.min(acompteXOF, soldeXOF) : soldeXOF

    // ─── Paiement multi-provider Logic ────────────────────────────────────
    const activeProviders = [
        { 
            id: 'fedapay', 
            name: 'FedaPay', 
            subtitle: 'Mobile Money / Carte', 
            color: 'bg-[#2ECC71]/20 border-[#2ECC71]/40 text-[#2ECC71]', 
            isReady: (paymentSettings.fedapay_enabled === 'true' || paymentSettings.fedapay_enabled === true) && !!paymentSettings.fedapay_public_key 
        },
        { 
            id: 'kkiapay', 
            name: 'Kkiapay', 
            subtitle: 'Mobile Money / Carte', 
            color: 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9]', 
            isReady: (paymentSettings.kkiapay_enabled === 'true' || paymentSettings.kkiapay_enabled === true) && !!paymentSettings.kkiapay_public_key 
        },
        { 
            id: 'zeyow', 
            name: 'Zeyow', 
            subtitle: 'Carte Virtuelle', 
            color: 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]', 
            isReady: (paymentSettings.zeyow_enabled === 'true' || paymentSettings.zeyow_enabled === true) && !!paymentSettings.zeyow_redirect_url 
        },
    ].filter(p => p.isReady)

    const handleFedaPay = () => {
        if (!doc) return
        setIsProcessing(true)
        setPaymentError('')

        try {
            // Montant de base en XOF (FedaPay et KKiapay traitent uniquement en XOF)
            const baseXOF = aPayerXOF

            ;(window as any).FedaPay.init({
                public_key: paymentSettings.fedapay_public_key || process.env.NEXT_PUBLIC_FEDAPAY_PUBLIC_KEY,
                environment: paymentSettings.fedapay_sandbox === 'true' ? 'sandbox' : 'live',
                transaction: {
                    amount: Math.round(baseXOF),
                    description: `Paiement ${doc.type === 'facture' ? 'Facture' : 'Devis'} N° ${doc.numero}`,
                    currency: { iso: 'XOF' },
                },
                customer: {
                    email: doc.client_email,
                    lastname: doc.client_nom,
                    firstname: doc.client_prenom || 'Client'
                },
                onComplete: async function(resp: any) {
                    if (resp.reason === 'checkout complete' || resp.reason === 'APPROVED') {
                        await finalizePayment('FedaPay', resp.transaction?.id || resp.id)
                    } else {
                        setPaymentError("Le paiement n'a pas été finalisé.")
                        setIsProcessing(false)
                    }
                }
            }).open()
        } catch (e) {
            console.error('FedaPay error:', e)
            setPaymentError("Erreur lors de l'initialisation de FedaPay.")
            setIsProcessing(false)
        }
    }

    const handleKkiapay = () => {
        if (!doc) return
        setIsProcessing(true)
        setPaymentError('')

        try {
            // KKiapay : toujours XOF (pas de paramètre devise)
            const amountXOF = aPayerXOF
            
            // Config minimale et conforme : pas de `paymentmethod` (tableau rejeté
            // par le widget → « paramètres invalides ») ni de `callback` (forcerait
            // une redirection qui contourne le listener de succès).
            ;(window as any).openKkiapayWidget({
                amount: Math.round(amountXOF),
                position: 'center',
                key: paymentSettings.kkiapay_sandbox === 'true'
                    ? (paymentSettings.kkiapay_sandbox_public_key || paymentSettings.kkiapay_public_key)
                    : paymentSettings.kkiapay_public_key,
                sandbox: paymentSettings.kkiapay_sandbox === 'true',
                email: doc.client_email || undefined,
                name: `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim() || undefined,
                data: JSON.stringify({ doc_id: id, type: doc.type }),
            })

            ;(window as any).addKkiapayListener('success', async (response: any) => {
                await finalizePayment('Kkiapay', response.transactionId)
            })

            ;(window as any).addKkiapayListener('failed', () => {
                setPaymentError("Le paiement Kkiapay a échoué.")
                setIsProcessing(false)
            })
        } catch (e) {
            console.error('Kkiapay error:', e)
            setPaymentError("Erreur lors de l'initialisation de Kkiapay.")
            setIsProcessing(false)
        }
    }

    const handleZeyow = () => {
        if (!doc) return
        const redirectUrl = paymentSettings.zeyow_redirect_url
        if (!redirectUrl) { setPaymentError('Zeyow non configuré.'); return }
        const amountXOF = aPayerXOF
        window.location.href = `${redirectUrl}?amount=${amountXOF}&email=${doc.client_email}&doc_id=${id}`
    }

    const finalizePayment = async (method: string, txId: string) => {
        // Confirmation CÔTÉ SERVEUR : vérification de la transaction chez le
        // provider + garde atomique + reçu client + alerte équipe.
        // (L'ancien update Supabase côté client échouait : colonne inexistante-//  et n'était de toute façon ni vérifié ni notifié.)
        try {
            const res = await fetch('/api/documents/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doc_id: id,
                    provider: method.toLowerCase().includes('feda') ? 'fedapay' : 'kkiapay',
                    transaction_id: txId,
                    expected_xof: aPayerXOF,
                }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setShowPaymentMethods(false)
                // Recharger le document : un devis payé a été converti en FACTURE
                // (nouveau n° FAC, type='facture', statut='paye') côté serveur.
                const { data: fresh } = await supabase
                    .from('documents_financiers')
                    .select('*')
                    .eq('id', id)
                    .single()
                if (fresh) setDoc(fresh as DocumentFinancier)
                const { data: pms } = await supabase
                    .from('paiements_manuels').select('montant').eq('document_id', id)
                const cumul = (pms || []).reduce((a, p) => a + (Number(p.montant) || 0), 0)
                setDejaPaye(cumul)
                setAcompte('')
                if (data.partial) {
                    alert(`Acompte de ${Number(data.encaisse_xof || 0).toLocaleString('fr-FR')} FCFA bien reçu. Solde restant : ${Number(data.solde_xof || 0).toLocaleString('fr-FR')} FCFA.`)
                } else {
                    alert('Paiement confirmé ! Votre facture officielle a été émise et un reçu vous a été envoyé par email. Merci de votre confiance.')
                }
            } else {
                alert(data.error || 'Paiement reçu mais confirmation en attente. Notre équipe va régulariser cela.')
            }
        } catch (e) {
            console.error('Finalize error:', e)
            alert('Paiement reçu mais erreur lors de la mise à jour. Notre équipe va régulariser cela.')
        }
        setIsProcessing(false)
    }

    const processPayment = () => {
        if (activeProviders.length === 1) {
            const p = activeProviders[0]
            if (p.id === 'fedapay') handleFedaPay()
            else if (p.id === 'kkiapay') handleKkiapay()
            else if (p.id === 'zeyow') handleZeyow()
        } else if (activeProviders.length > 1) {
            setShowPaymentMethods(true)
        } else {
            alert("Aucun moyen de paiement n'est disponible pour le moment. Veuillez nous contacter.")
        }
    }


    // ─── Formatting Logic ──────────────────────────────────────────


    // Formateur montants : 180000 → "180.000" (sans espaces insécables du fr-FR)
    const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

    const generatePDF = async () => {
        if (!doc) return
        setGenerating(true)
        try {
            // Fetch ERP Templates
            let devisHeader = "RETOUR GAGNANT BÉNIN\nRCCM : RB/COT/26 B 42001 | IFU : 3202644573981\nHaie-Vive Cocotiers, Cotonou, Bénin\n+229 01 60 32 21 21 / +229 01 94 35 50 50\ncontact@retourgagnantbenin.bj"
            let devisFooter = "RETOUR GAGNANT BÉNIN - RCCM: RB/COT/26 B 42001 - IFU: 3202644573981 - Haie-Vive Cocotiers, Cotonou - contact@retourgagnantbenin.bj\nDocument N° - Généré le"
            let presidentName = "Nathalie RIFFERT GERMANY"
            let presidentTitle = "LA DIRECTION GÉNÉRALE"

            try {
                const { data: templateData } = await supabase
                    .from('document_templates')
                    .select('content')
                    .eq('id', 'official_devis_facture')
                    .single()

                if (templateData?.content) {
                    const tpl = templateData.content
                    if (tpl.header) devisHeader = tpl.header
                    if (tpl.footer) devisFooter = tpl.footer
                    if (tpl.signature_name) presidentName = tpl.signature_name
                    if (tpl.signature_title) presidentTitle = tpl.signature_title
                }
            } catch (err) {
                console.error("Failed to load official template", err)
            }

            const jsPDF = (await import('jspdf')).default
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pw = 210
            const ph = 297
            const ml = 14
            const mr = 14
            const cw = pw - ml - mr

            // Helper: safe text (remplace les caracteres problematiques pour jsPDF)
            const safe = (s: string) => s
                .replace(/\u2014/g, '-')   // em dash
                .replace(/\u2013/g, '-')   // en dash
                .replace(/\u2019/g, "'")   // smart quote
                .replace(/\u2018/g, "'")
                .replace(/\u201c/g, '"')
                .replace(/\u201d/g, '"')
                .replace(/\u2713/g, '[OK]') // checkmark
                .replace(/\u2714/g, '[OK]')
                .replace(/\u2022/g, '-')    // bullet

            // ── BENIN FLAG STRIPE (PRINT-OPTIMIZED) ───────────────
            // Pour garantir l'impression sur toutes les imprimantes, on utilise des lignes 
            // très épaisses au lieu de rectangles (souvent ignorés comme "background").
            const stripeThickness = 6
            const stripeYPos = 3 // Milieu de la ligne
            
            pdf.setLineWidth(stripeThickness)
            
            // Vert
            pdf.setDrawColor(0, 135, 81)
            pdf.line(0, stripeYPos, pw / 3, stripeYPos)
            
            // Jaune
            pdf.setDrawColor(252, 209, 22)
            pdf.line(pw / 3, stripeYPos, (pw * 2) / 3, stripeYPos)
            
            // Rouge
            pdf.setDrawColor(232, 17, 45)
            pdf.line((pw * 2) / 3, stripeYPos, pw, stripeYPos)

            // ── WHITE HEADER (identique navbar) ──────────────────
            const headerTop = 6 // Descendu légèrement pour laisser la bande respirer
            const headerH = 48
            pdf.setFillColor(255, 255, 255)
            pdf.rect(0, headerTop, pw, headerH, 'F')

            // Ligne de separation en bas du header
            pdf.setDrawColor(215, 215, 215)
            pdf.setLineWidth(0.4)
            pdf.line(0, headerTop + headerH, pw, headerTop + headerH)

            // ── LOGO ──────────────────────────────────────────────
            const logoSize = 32
            const logoX = 7 // Plus à gauche que ml (14)
            const logoY = headerTop + 8

            try {
                // Background blanc pour le logo transparent
                pdf.setFillColor(255, 255, 255)
                pdf.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 1, 'F')
                
                // Le logo fourni est désormais transparent, donc on utilise 'PNG'
                const logoData = LOGO_BASE64.startsWith('data:') ? LOGO_BASE64 : `data:image/png;base64,${LOGO_BASE64}`
                pdf.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize)
            } catch (e) {
                console.error('Logo error:', e)
            }

            // ── NOM : RETOUR GAGNANT + BENIN + SLOGAN ────────────
            const textLeft = logoX + logoSize + 3
            const nameY = logoY + 10

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(16)
            pdf.setTextColor(0, 135, 81) // #008751
            pdf.text('RETOUR', textLeft, nameY)
            const rW = pdf.getTextWidth('RETOUR ')
            pdf.setTextColor(232, 17, 45) // #E8112D
            pdf.text('GAGNANT', textLeft + rW, nameY)

            // BENIN avec tracking large
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(8)
            pdf.setTextColor(90, 90, 90)
            pdf.setCharSpace(2)
            pdf.text('BENIN', textLeft, nameY + 6)
            pdf.setCharSpace(0)

            // Slogan original
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(6.5)
            pdf.setTextColor(130, 130, 130)
            const sloganText = safe("L'agence d'accompagnement a la Nationalite Beninoise et au retour des Afro-descendants.")
            const sloganLines = pdf.splitTextToSize(sloganText, 80)
            sloganLines.forEach((line: string, i: number) => {
                pdf.text(line, textLeft, nameY + 11.5 + i * 3.5)
            })

            // ── TYPE DOCUMENT (droite, en haut du header) ────────
            const typeLabel = doc.type === 'devis' ? 'DEVIS' : 'FACTURE'
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(24)
            if (doc.type === 'devis') {
                pdf.setTextColor(180, 120, 0)
            } else {
                pdf.setTextColor(0, 135, 81)
            }
            pdf.text(typeLabel, pw - mr, headerTop + 14, { align: 'right' })

            // Numero + Date + Validite
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8)
            pdf.setTextColor(80, 80, 80)
            pdf.text('N. ' + doc.numero, pw - mr, headerTop + 22, { align: 'right' })
            pdf.text('Date : ' + new Date(doc.created_at).toLocaleDateString('fr-FR'), pw - mr, headerTop + 27, { align: 'right' })
            if (doc.validite) {
                const validLabel = doc.type === 'facture' ? 'Delai : ' : 'Validite : '
                pdf.text(safe(validLabel + doc.validite), pw - mr, headerTop + 32, { align: 'right' })
            }

            // ── STATUS BADGE (Dans le header, à droite en bas) ──────────────────
            const statusLabels: Record<string, string> = {
                brouillon: 'BROUILLON', envoye: 'ENVOYE', accepte: 'ACCEPTE',
                refuse: 'REFUSE', paye: 'PAYE', en_retard: 'EN RETARD', annule: 'ANNULE'
            }
            const statusColorMap: Record<string, [number, number, number]> = {
                brouillon: [120, 120, 120], envoye: [59, 130, 246], accepte: [0, 160, 90],
                refuse: [220, 50, 50], paye: [16, 185, 110], en_retard: [220, 120, 20], annule: [90, 90, 90],
            }
            const sc = statusColorMap[doc.status] || [90, 90, 90]
            const statusText = statusLabels[doc.status] || doc.status.toUpperCase()
            
            const badgeY = headerTop + 37
            const badgeW = 32
            const badgeH = 8
            pdf.setFillColor(sc[0], sc[1], sc[2])
            pdf.roundedRect(pw - mr - badgeW, badgeY, badgeW, badgeH, 1.5, 1.5, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(7.5)
            pdf.setTextColor(255, 255, 255)
            pdf.text(statusText, pw - mr - badgeW / 2, badgeY + 5.5, { align: 'center' })

            let y = headerTop + headerH + 8

            // ── EMETTEUR / DESTINATAIRE ──────────────────────────
            const boxW = (cw - 6) / 2
            const boxH = 46

            // Emetteur (dark box)
            pdf.setFillColor(18, 28, 42)
            pdf.setDrawColor(40, 60, 90)
            pdf.setLineWidth(0.3)
            pdf.roundedRect(ml, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6)
            pdf.setTextColor(80, 120, 180)
            pdf.text('EMETTEUR', ml + 4, y + 6)
            pdf.setFontSize(8)
            pdf.setTextColor(220, 230, 245)
            const headerLines = pdf.splitTextToSize(devisHeader, boxW - 8)
            headerLines.forEach((l: string, i: number) => {
                const isFirst = i === 0
                if (isFirst) {
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(9)
                } else {
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(6.5)
                    if (i === 1) pdf.setTextColor(140, 160, 185)
                }
                const offset = isFirst ? 13 : (19 + (i - 1) * 6)
                pdf.text(safe(l), ml + 4, y + offset)
            })

            // Destinataire (light box)
            const toX = ml + boxW + 6
            pdf.setFillColor(248, 250, 255)
            pdf.setDrawColor(200, 215, 240)
            pdf.roundedRect(toX, y, boxW, boxH, 2, 2, 'FD')

            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6)
            pdf.setTextColor(100, 110, 160)
            pdf.text('DESTINATAIRE', toX + 4, y + 6)
            pdf.setFontSize(9)
            pdf.setTextColor(30, 40, 70)
            const clientFullName = `${doc.client_nom} ${doc.client_prenom}`.trim() || 'Client'
            pdf.text(clientFullName, toX + 4, y + 13)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(7)
            pdf.setTextColor(70, 80, 110)
            let clientY = y + 19
            if (doc.client_email) { pdf.text(doc.client_email, toX + 4, clientY); clientY += 5.5 }
            if (doc.client_phone) { pdf.text(doc.client_phone, toX + 4, clientY); clientY += 5.5 }
            if (doc.client_adresse) {
                const addrLines = pdf.splitTextToSize(doc.client_adresse, boxW - 8)
                addrLines.slice(0, 3).forEach((line: string) => {
                    pdf.text(line, toX + 4, clientY)
                    clientY += 5
                })
            }

            y += boxH + 8

            // ── TABLE DES ITEMS ──────────────────────────────────
            const cols = [
                { header: 'DESCRIPTION', w: 70, align: 'left' as const },
                { header: 'QTE', w: 14, align: 'center' as const },
                { header: 'PU HT', w: 26, align: 'right' as const },
                { header: 'TVA %', w: 15, align: 'center' as const },
                { header: 'TVA', w: 22, align: 'right' as const },
                { header: 'TOTAL HT', w: 35, align: 'right' as const },
            ]

            // Table header (dark)
            pdf.setFillColor(10, 16, 24)
            pdf.rect(ml, y, cw, 9, 'F')
            let colX = ml
            cols.forEach(col => {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(6)
                pdf.setTextColor(200, 215, 230)
                if (col.align === 'right') {
                    pdf.text(col.header, colX + col.w - 2, y + 6, { align: 'right' })
                } else if (col.align === 'center') {
                    pdf.text(col.header, colX + col.w / 2, y + 6, { align: 'center' })
                } else {
                    pdf.text(col.header, colX + 3, y + 6)
                }
                colX += col.w
            })
            y += 9

            // Table rows
            doc.items.forEach((item: any, i: number) => {
                const rowH = 9
                const even = i % 2 === 0
                pdf.setFillColor(even ? 252 : 245, even ? 253 : 247, even ? 255 : 250)
                pdf.rect(ml, y, cw, rowH, 'F')
                pdf.setDrawColor(220, 228, 238)
                pdf.setLineWidth(0.15)
                pdf.line(ml, y + rowH, ml + cw, y + rowH)

                const tvaMnt = item.quantity * item.unit_price * item.tva / 100
                const lineTotal = item.quantity * item.unit_price
                const rowData = [
                    { text: safe(item.description || '-'), w: cols[0].w, align: 'left' },
                    { text: String(item.quantity), w: cols[1].w, align: 'center' },
                    { text: fmtN(item.unit_price), w: cols[2].w, align: 'right' },
                    { text: item.tva + '%', w: cols[3].w, align: 'center' },
                    { text: fmtN(tvaMnt), w: cols[4].w, align: 'right' },
                    { text: fmtN(lineTotal), w: cols[5].w, align: 'right' },
                ]
                colX = ml
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(7.5)
                pdf.setTextColor(40, 55, 75)
                rowData.forEach(cell => {
                    if (cell.align === 'right') {
                        pdf.text(cell.text, colX + cell.w - 2, y + 6, { align: 'right' })
                    } else if (cell.align === 'center') {
                        pdf.text(cell.text, colX + cell.w / 2, y + 6, { align: 'center' })
                    } else {
                        const lines = pdf.splitTextToSize(cell.text, cell.w - 4)
                        pdf.text(lines[0] || '', colX + 3, y + 6)
                    }
                    colX += cell.w
                })
                y += rowH
            })

            // Table bottom line
            pdf.setDrawColor(100, 120, 160)
            pdf.setLineWidth(0.5)
            pdf.line(ml, y, ml + cw, y)
            y += 6

            // ── TOTAUX ──────────────────────────────────────────
            const totW = 80
            const totX2 = pw - mr - totW
            const cur = doc.currency || 'XOF'

            const drawTotRow = (label: string, value: string, bold = false, red = false) => {
                pdf.setFont('helvetica', bold ? 'bold' : 'normal')
                pdf.setFontSize(bold ? 8.5 : 7.5)
                pdf.setTextColor(red ? 200 : 70, red ? 50 : 85, red ? 50 : 105)
                pdf.text(label, totX2, y + 4.5)
                pdf.setTextColor(red ? 200 : 25, red ? 50 : 35, red ? 50 : 60)
                pdf.text(value, pw - mr, y + 4.5, { align: 'right' })
                y += 7
            }

            drawTotRow('Sous-total HT', fmtN(doc.sous_total) + ' ' + cur)
            drawTotRow('TVA (18%)', '+ ' + fmtN(doc.total_tva) + ' ' + cur)
            if (doc.remise > 0) drawTotRow('Remise', '- ' + fmtN(doc.remise) + ' ' + cur, false, true)

            pdf.setDrawColor(150, 175, 210)
            pdf.setLineWidth(0.4)
            pdf.line(totX2 - 2, y - 1, pw - mr, y - 1)

            // TOTAL TTC green box
            pdf.setFillColor(0, 135, 81)
            pdf.roundedRect(totX2 - 3, y, totW + 3, 11, 2, 2, 'F')
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(9)
            pdf.setTextColor(255, 255, 255)
            pdf.text('TOTAL TTC', totX2, y + 7.5)
            pdf.text(fmtN(doc.total) + ' ' + cur, pw - mr, y + 7.5, { align: 'right' })
            y += 16

            // ── ZONE DE SIGNATURE (Facture ou Devis) ────────────
            if (y + 45 > ph - 18) {
                pdf.addPage()
                y = 15 // Reset y for new page
            }

            if (true) {
                const sigW = (cw - 8) / 2
                const sigBoxH = 48

                // Client box
                pdf.setFillColor(signatureUrl ? 235 : 242, 255, signatureUrl ? 245 : 248)
                pdf.setDrawColor(0, 135, 81)
                pdf.setLineWidth(0.3)
                pdf.roundedRect(ml, y, sigW, sigBoxH, 2, 2, 'FD')
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.setTextColor(0, 100, 60)
                pdf.text('BON POUR ACCORD (CLIENT)', ml + 4, y + 7)

                if (signatureUrl) {
                    try {
                        pdf.addImage(signatureUrl, 'PNG', ml + 4, y + 10, sigW - 10, 22)
                    } catch { /* skip */ }
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(6)
                    pdf.setTextColor(0, 140, 70)
                    const signedDate = doc.signed_at
                        ? formatDateSafe(doc.signed_at)
                        : new Date().toLocaleDateString('fr-FR')
                    pdf.text('[OK] Validé numériquement le ' + signedDate, ml + 4, y + 43)
                } else {
                    pdf.setFont('helvetica', 'italic')
                    pdf.setFontSize(6.5)
                    pdf.setTextColor(90, 100, 95)
                    pdf.text('Signature en attente ...', ml + 10, y + 20)
                    pdf.text('Date de la facture : ' + formatDateSafe(doc.created_at), ml + 4, y + 43)
                }

                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7.5)
                pdf.setTextColor(0, 0, 0)
                pdf.text(doc.client_prenom + ' ' + doc.client_nom, ml + 4, y + 36)

                // PDG box
                const sig2X = ml + sigW + 8
                pdf.setFillColor(242, 245, 255)
                pdf.setDrawColor(100, 110, 200)
                pdf.roundedRect(sig2X, y, sigW, sigBoxH, 2, 2, 'FD')
                
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(6.5)
                pdf.setTextColor(70, 80, 170)
                pdf.text(presidentTitle.toUpperCase(), sig2X + 4, y + 7)
                
                pdf.setFontSize(5.5)
                pdf.setTextColor(0, 0, 0)
                pdf.text('La Responsable de Signature :', sig2X + 4, y + 18)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(7)
                pdf.text(safe(presidentName), sig2X + 4, y + 23)

                // Add Stamp if available (much larger)
                if (STAMP_BASE64) {
                    try {
                        const stampData = STAMP_BASE64.startsWith('data:') ? STAMP_BASE64 : `data:image/png;base64,${STAMP_BASE64}`
                        // Increased size from 48 to 65
                        pdf.addImage(stampData, 'PNG', sig2X + sigW - 65, y - 5, 65, 65)
                    } catch (e) {
                        console.error('Error adding stamp:', e)
                    }
                }

                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(6)
                pdf.setTextColor(120, 130, 150)
                pdf.text('Validité officielle garantie', sig2X + 4, y + 43)
            }

            // ── FILIGRANE (brouillon / paye) ────────────────────
            if (doc.status === 'brouillon') {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(70)
                pdf.setTextColor(215, 220, 225)
                pdf.text('BROUILLON', pw / 2, ph / 2, { align: 'center', angle: 40 })
            }
            if (doc.status === 'paye') {
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(75)
                pdf.setTextColor(195, 240, 215)
                pdf.text('PAYE', pw / 2, ph / 2, { align: 'center', angle: 40 })
            }

            // ── FOOTER ──────────────────────────────────────────
            // Augmentation de la marge de sécurité (Remonté à 18mm du bord)
            const footH = 18
            const footerY = ph - footH
            pdf.setFillColor(10, 16, 24)
            pdf.rect(0, footerY, pw, footH, 'F')
            const footerLines = devisFooter.split('\n')
            
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(6)
            pdf.setTextColor(180, 190, 210) // Plus clair pour l'impression sur fond noir
            if (footerLines.length > 0) pdf.text(safe(footerLines[0]), pw / 2, footerY + 6, { align: 'center' })
            
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(6.5)
            pdf.setTextColor(255, 255, 255)
            const secondLine = footerLines.length > 1 ? safe(footerLines[1]) + ' - ' : ''
            pdf.text(secondLine + 'Document N° ' + doc.numero + ' - Généré le ' + new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR'), pw / 2, footerY + 11, { align: 'center' })

            pdf.save(`${doc.type}_${doc.numero}.pdf`)
        } catch (err) {
            console.error('PDF generation error:', err)
        }
        setGenerating(false)
    }


    if (loading) {
        return <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
    }

    if (error || !doc) {
        return (
            <div className="min-h-screen bg-[#F4F7F5] flex flex-col items-center justify-center text-center p-6">
                <ShieldCheck size={48} className="text-red-500 mb-4 opacity-50" />
                <h1 className="text-2xl font-black text-slate-900 mb-2">Document Sécurisé</h1>
                <p className="text-slate-500 max-w-sm">{error || "Ce document n'est plus disponible ou vous n'y avez pas accès."}</p>
            </div>
        )
    }

    const isPaid = doc.status === 'paye'
    const isAccepted = doc.status === 'accepte'
    // Facture émise manuellement (preuve d'un paiement déjà reçu) :
    // pas issue d'un devis signé → aucun bouton de paiement à afficher
    const isManualFacture = doc.type === 'facture' && !doc.parent_devis_id
    const statusColor = isPaid ? 'text-emerald-600 bg-emerald-500/10' : 
                       isAccepted ? 'text-emerald-600 bg-emerald-500/10' : 
                       'text-blue-600 bg-blue-500/10'

    return (
        <div className="min-h-screen bg-[#F4F7F5] text-slate-600 font-sans selection:bg-emerald-500/30">
            {/* INJECTION FEDAPAY SCRIPT */}
            <Script src="https://checkout.fedapay.com/js/checkout.js" strategy="lazyOnload" />

            {/* Bandeau Supérieur Minimaliste Bénin */}
            <div className="h-1.5 w-full flex">
                <div className="flex-1 bg-emerald-600"></div>
                <div className="flex-1 bg-amber-400"></div>
                <div className="flex-1 bg-red-600"></div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
                
                {/* Header Portail */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-slate-200 shadow-lg overflow-hidden relative">
                            <Image src="/images/logo-transparent.png" alt="Logo Retour Gagnant" width={48} height={48} className="object-contain" />
                        </div>
                        <div>
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-2">
                                <ShieldCheck size={16} className="text-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Espace Client Sécurisé</span>
                            </motion.div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                RETOUR GAGNANT <span className="text-emerald-500">BÉNIN</span>
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">Agence de Conciergerie & Services Internationaux</p>
                        </div>
                    </div>

                    <div className="text-left md:text-right bg-slate-50 border border-slate-200 p-4 rounded-2xl md:min-w-[200px]">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            {doc.type === 'devis' ? 'Devis Pro-forma' : 'Facture Officielle'}
                        </p>
                        <p className="text-xl font-black text-slate-900 font-mono break-all">{doc.numero}</p>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200">
                            <div className={`w-2 h-2 rounded-full ${(isPaid || (doc.type === 'facture' && doc.status === 'envoye')) ? 'bg-emerald-400' : isAccepted ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'}`}></div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${(isPaid || (doc.type === 'facture' && doc.status === 'envoye')) ? 'text-emerald-600 bg-emerald-500/10' : statusColor.split(' ')[0]}`}>
                                {doc.status === 'paye' || (doc.type === 'facture' && doc.status === 'envoye') ? 'ACQUITTEE' : doc.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Paper Document */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl relative"
                >
                    {/* Watermark */}
                    {(isPaid || doc.status === 'brouillon' || doc.type === 'facture') && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-5">
                            <p className="text-[150px] font-black italic transform -rotate-45 text-slate-900 blur-[2px]">
                                {doc.status === 'paye' || (doc.type === 'facture' && doc.status === 'envoye') ? 'ACQUITTEE' : doc.status.toUpperCase()}
                            </p>
                        </div>
                    )}

                    <div className="p-6 md:p-10 relative z-10">
                        {/* Client Info */}
                        <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-sm overflow-hidden relative">
                                        <Image src="/images/logo-transparent.png" alt="Logo" width={48} height={48} className="object-contain" />
                                    </div>
                                    <p className="text-slate-900 font-bold text-xl leading-tight">RETOUR GAGNANT <br/><span className="text-xs text-emerald-600 font-normal tracking-[0.2em]">BÉNIN</span></p>
                                </div>
                                <div className="text-sm text-slate-500 mt-2 space-y-1">
                                    <p>RCCM: RB/COT/26 B 42001</p>
                                    <p>IFU: 3202644573981</p>
                                </div>
                            </div>
                            <div className="bg-white/[0.03] p-5 rounded-2xl border border-slate-200 md:w-1/2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Destinataire (Client)</p>
                                <p className="text-lg text-slate-900 font-bold">{doc.client_nom} {doc.client_prenom}</p>
                                <div className="text-sm text-slate-500 mt-2 space-y-1">
                                    {doc.client_email && <p className="flex items-center gap-2"><Mail size={14} className="text-slate-500"/> {doc.client_email}</p>}
                                    {doc.client_phone && <p className="flex items-center gap-2"><Phone size={14} className="text-slate-500"/> {doc.client_phone}</p>}
                                    {doc.client_adresse && <p className="mt-2 text-xs border-t border-slate-200 pt-2">{doc.client_adresse}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto w-full mb-8 rounded-2xl border border-slate-200">
                            <table className="w-full text-left border-collapse min-w-full">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-slate-200">
                                        <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                                        <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Qté</th>
                                        <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">PU HT</th>
                                        <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">TVA</th>
                                        <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Total HT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doc.items.map((it, i) => (
                                        <tr key={i} className="border-b border-slate-200 last:border-0 hover:bg-white/[0.01]">
                                            <td className="py-4 px-3 md:px-5 text-sm text-slate-600 min-w-[150px]">{it.description}</td>
                                            <td className="py-4 px-5 text-sm text-slate-500 text-center">{it.quantity}</td>
                                            <td className="py-4 px-5 text-sm text-slate-500 text-right font-mono">{it.unit_price.toLocaleString('fr-FR')}</td>
                                            <td className="py-4 px-5 text-sm text-slate-500 text-right">{it.tva}%</td>
                                            <td className="py-4 px-5 text-sm text-slate-900 font-mono text-right">{(it.quantity * it.unit_price).toLocaleString('fr-FR')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals & Conditions */}
                        <div className="flex flex-col lg:flex-row justify-between gap-8 mb-8">
                            <div className="lg:w-1/2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Conditions Générales & Validité</p>
                                <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                                    {doc.conditions}
                                    {doc.type === 'devis' && (
                                        <>
                                            <br/><br/>
                                            <strong><Calendar size={12} className="inline mr-1 relative -top-[1px]"/> Délai / Validité :</strong> {doc.validite}
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="lg:w-1/2 lg:max-w-xs ml-auto space-y-3">
                                <div className="flex justify-between items-center text-sm text-slate-500 border-b border-slate-200 pb-3">
                                    <span>Sous-total HT</span>
                                    <span className="font-mono">{((doc.currency === 'XOF' || doc.currency === 'FCFA') ? Math.round(doc.sous_total) : doc.sous_total).toLocaleString('fr-FR')} {doc.currency}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-slate-500 border-b border-slate-200 pb-3">
                                    <span>TVA</span>
                                    <span className="font-mono">+ {((doc.currency === 'XOF' || doc.currency === 'FCFA') ? Math.round(doc.total_tva) : doc.total_tva).toLocaleString('fr-FR')} {doc.currency}</span>
                                </div>
                                {doc.remise > 0 && (
                                    <div className="flex justify-between items-center text-sm text-amber-500 border-b border-slate-200 pb-3">
                                        <span>Remise appliquée</span>
                                        <span className="font-mono">- {((doc.currency === 'XOF' || doc.currency === 'FCFA') ? Math.round(doc.remise) : doc.remise).toLocaleString('fr-FR')} {doc.currency}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Total TTC</span>
                                    <div className="text-right space-y-1">
                                        {/* Montant officiel du document : TOUJOURS dans la devise
                                            d'émission : la conversion n'est qu'indicative dessous */}
                                        <div className="text-2xl font-black text-emerald-600 font-mono tracking-tighter">
                                            {((doc.currency === 'XOF' || doc.currency === 'FCFA') ? Math.round(doc.total) : doc.total).toLocaleString('fr-FR')} {doc.currency || 'XOF'}
                                        </div>
                                        {selectedCurrency !== (doc.currency || 'XOF') && (
                                            <div className="text-[10px] text-slate-500">
                                                soit environ {formatPriceWithMargin(doc.total, selectedCurrency)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end pt-1">
                                    <CurrencySelector
                                        value={selectedCurrency}
                                        onChange={setSelectedCurrency}
                                        baseAmountXOF={doc.total}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SIGNATURE & STAMP BLOCK */}
                        {(signatureUrl || STAMP_BASE64) && (
                            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Side A: Client Signature */}
                                {doc.type !== 'facture' && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Signature du Client (Approbation)</p>
                                        <div className="bg-white h-56 rounded-xl flex flex-col items-center justify-center p-4 border border-emerald-500/10">
                                            {signatureUrl ? (
                                                <>
                                                    <Image src={signatureUrl} alt="Signature Client" width={250} height={120} className="h-4/5 w-auto object-contain pointer-events-none mb-2" />
                                                    <p className="text-gray-900 font-bold text-sm uppercase tracking-tight">{doc.client_prenom} {doc.client_nom}</p>
                                                </>
                                            ) : (
                                                <div className="text-center">
                                                    <p className="text-xs text-slate-500 italic mb-2">Signature en attente</p>
                                                    <p className="text-gray-900 font-bold text-sm uppercase opacity-50">{doc.client_prenom} {doc.client_nom}</p>
                                                </div>
                                            )}
                                        </div>
                                        {signatureUrl && (
                                            <div className="mt-3 space-y-1 text-center">
                                                <p className="text-[10px] text-emerald-500/80 font-bold">ÉMISSION : {formatDateSafe(doc?.created_at)}</p>
                                                <p className="text-[9px] text-emerald-500/60 font-medium italic">Validé numériquement le {doc?.signed_at ? formatDateSafe(doc.signed_at) : new Date().toLocaleDateString('fr-FR')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Side B: PDG Stamp & Sign */}
                                <div className={`${doc.type === 'facture' ? 'md:col-span-2 max-w-md mx-auto w-full' : ''} bg-blue-500/5 border border-blue-500/20 p-5 rounded-2xl relative text-gray-900`}>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">Cachet & Signature Direction</p>
                                    <div className="bg-white h-56 rounded-xl flex items-center justify-center p-4 relative">
                                        <div className="text-center z-10">
                                            <p className="text-[10px] text-slate-500 font-bold mb-1">RETOUR GAGNANT BÉNIN</p>
                                            <p className="text-[9px] text-emerald-600 font-black uppercase">La Présidente Directrice Générale</p>
                                            <p className="text-sm text-gray-900 font-bold mt-1">Nathalie RIFFERT GERMANY</p>
                                        </div>
                                        {STAMP_BASE64 && (
                                            <Image 
                                                src={`data:image/png;base64,${STAMP_BASE64}`} 
                                                alt="Cachet PDG" 
                                                width={260} 
                                                height={260} 
                                                className="absolute inset-0 m-auto object-contain opacity-95 rotate-[-5deg] z-0"
                                            />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-blue-500/60 mt-2 text-center font-medium">Validité officielle garantie</p>
                                </div>
                            </div>
                        )}

                        {/* Devis accepté, en attente de paiement : le paiement justifie
                            l'émission de la facture officielle. */}
                        {signatureUrl && doc.type === 'devis' && !isPaid && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3">
                                        <Receipt size={20} className="text-amber-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-amber-600">Devis accepté et signé</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Finalisez le paiement ci-dessous pour recevoir votre facture officielle acquittée.
                                            </p>
                                        </div>
                                    </div>
                                )}

                    </div>
                </motion.div>

                {/* ─── ACTION AREA (BOTTOM FLOATING OR STATIC) ─── */}
                <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-4">
                    
                    {/* CASE 1: Devis not accepted -> Require Signature */}
                    {doc.type === 'devis' && !isAccepted && !signing && (
                        <button 
                            onClick={() => setSigning(true)}
                            className="w-full md:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-all"
                        >
                            <PenTool size={20} />
                            Accepter le Devis & Signer
                        </button>
                    )}

                    {/* ── ACOMPTE : le client peut régler une partie ── */}
                    {!isPaid && !isManualFacture && soldeXOF > 0 && (doc.type === 'facture' || (doc.type === 'devis' && isAccepted)) && (
                        <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 mb-2">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                <p className="text-sm font-black text-slate-900">Régler un acompte ou la totalité</p>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
                                    Solde dû : {soldeXOF.toLocaleString('fr-FR')} FCFA
                                </span>
                            </div>
                            {dejaPaye > 0 && (
                                <p className="text-[11px] text-slate-500 mb-3">
                                    Déjà réglé : <span className="font-bold text-emerald-600">{dejaPaye.toLocaleString('fr-FR')} FCFA</span>
                                    {' '}sur {Math.round(totalXOF).toLocaleString('fr-FR')} FCFA.
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="number" min={0} max={soldeXOF} step="1"
                                    value={acompte}
                                    onChange={e => setAcompte(e.target.value)}
                                    placeholder={`${soldeXOF} (solde total)`}
                                    title="Montant de l'acompte en FCFA"
                                    className="flex-1 min-w-[160px] bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                                />
                                {[25, 50].map(pct => (
                                    <button key={pct} type="button"
                                        onClick={() => setAcompte(String(Math.round(soldeXOF * pct / 100)))}
                                        className="text-[11px] font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all">
                                        {pct}%
                                    </button>
                                ))}
                                <button type="button" onClick={() => setAcompte('')}
                                    className="text-[11px] font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all">
                                    Totalité
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">
                                Laissez vide pour régler l&apos;intégralité du solde. Chaque acompte est enregistré et la facture
                                n&apos;est acquittée qu&apos;une fois le solde atteint.
                            </p>
                        </div>
                    )}

                    {/* CASE 1b: Devis signé/accepté, non payé -> PAYER MAINTENANT.
                        Le paiement déclenche l'émission de la facture officielle. */}
                    {doc.type === 'devis' && isAccepted && !isPaid && (
                        <button
                            onClick={processPayment}
                            disabled={isProcessing}
                            className="w-full md:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-8 py-4 rounded-2xl font-black text-lg shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
                            {isProcessing ? 'Connexion en cours...'
                                : `${acompteXOF > 0 && acompteXOF < soldeXOF ? 'Payer l’acompte' : 'Payer maintenant'} (${aPayerXOF.toLocaleString('fr-FR')} FCFA)`}
                        </button>
                    )}

                    {/* CASE 2: Facture issue d'un devis signé, non payée -> paiement.
                        Les factures émises manuellement attestent d'un paiement déjà
                        reçu : jamais de bouton « Payer » dessus. */}
                    {doc.type === 'facture' && !isPaid && !isManualFacture && (
                        <button
                            onClick={processPayment}
                            disabled={isProcessing}
                            className="w-full md:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-8 py-4 rounded-2xl font-black text-lg shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
                            {isProcessing ? 'Connexion en cours...' : `Payer de façon sécurisée (${
                                selectedCurrency === (doc.currency || 'XOF')
                                    ? `${doc.total.toLocaleString('fr-FR')} ${doc.currency || 'XOF'}`
                                    : formatPriceWithMargin(doc.total, selectedCurrency)
                            })`}
                        </button>
                    )}

                    {/* CASE 3: Download Button (Always available unless signing) */}
                    {!signing && (
                        <button 
                            onClick={generatePDF}
                            disabled={generating}
                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 px-6 py-4 rounded-2xl font-bold transition-all hover:bg-slate-100 disabled:opacity-50"
                        >
                            {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            {generating ? 'Génération...' : 'Télécharger le PDF'}
                        </button>
                    )}
                </div>
            </div>

            {/* ─── BANNIÈRE ESPACE CLIENT ─── */}
            <div className="max-w-4xl mx-auto px-4 mt-6 mb-2">
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck size={18} className="text-blue-600" />
                        </div>
                        <div>
                            {clientSession ? (
                                <>
                                    <p className="font-black text-slate-900 text-sm">Vous êtes connecté</p>
                                    <p className="text-slate-500 text-[12px]">{clientSession.user?.email}</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-black text-slate-900 text-sm">Accédez à votre espace client</p>
                                    <p className="text-slate-500 text-[12px]">Suivez tous vos dossiers, documents et rendez-vous depuis un seul espace sécurisé.</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {clientSession ? (
                            <a href="/client/dashboard"
                                className="px-4 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold flex items-center gap-1.5 shadow-[0_4px_15px_rgba(59,130,246,0.25)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)] transition-all">
                                Mon espace client
                            </a>
                        ) : (
                            <>
                                <a href={`/client/login?email=${encodeURIComponent(doc?.client_email || '')}&from=/portail/${id}`}
                                    className="px-4 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:border-blue-500/30 text-slate-900 text-sm font-bold flex items-center transition-colors">
                                    Se connecter
                                </a>
                                <a href={`/client/register?email=${encodeURIComponent(doc?.client_email || '')}&from=/portail/${id}`}
                                    className="px-4 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold flex items-center gap-1.5 shadow-[0_4px_15px_rgba(59,130,246,0.25)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)] transition-all">
                                    Créer mon compte
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── SIGNATURE MODAL OVERLAY ─── */}
            <AnimatePresence>
                {signing && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-[#F4F7F5]/90 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#F4F7F5] border border-slate-200 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative"
                        >
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white/[0.02]">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Signature Numérique</h3>
                                    <p className="text-xs text-slate-500 mt-1">Dessinez votre signature dans le cadre ci-dessous.</p>
                                </div>
                                <button onClick={() => setSigning(false)} title="Fermer" className="text-slate-500 hover:text-slate-900 bg-slate-50 p-2 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-6">
                                <div className="bg-white rounded-2xl shadow-inner border-[3px] border-emerald-500/30 overflow-hidden relative touch-none">
                                    {/* Ligne pointillée pour guider */}
                                    <div className="absolute top-[70%] left-8 right-8 h-px border-b-2 border-dashed border-gray-200 pointer-events-none"></div>
                                    <span className="absolute bottom-4 right-6 text-slate-600 font-bold text-xs pointer-events-none select-none italic">
                                        Signez au-dessus de la ligne
                                    </span>

                                    <canvas
                                        ref={canvasRef}
                                        width={500}
                                        height={250}
                                        className="w-full h-[250px] cursor-crosshair block"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={endDrawing}
                                        onMouseLeave={endDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={endDrawing}
                                    />
                                </div>
                                
                                <div className="flex justify-between items-center mt-4">
                                    <button onClick={clearSignature} className="text-sm font-bold text-slate-500 hover:text-slate-900 px-4 py-2">
                                        Effacer
                                    </button>
                                    <button 
                                        onClick={saveSignature}
                                        disabled={isProcessing}
                                        className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                    >
                                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        Valider & Approuver
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* ─── PAYMENT METHODS MODAL ─── */}
            <AnimatePresence>
                {showPaymentMethods && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-[#F4F7F5]/90 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#F4F7F5] border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                        <CreditCard className="text-amber-600" />
                                        Moyen de paiement
                                    </h3>
                                    <button onClick={() => setShowPaymentMethods(false)} title="Fermer" className="p-2 text-slate-500 hover:text-slate-900 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-500">Montant à payer</p>
                                        <p className="text-lg font-black text-emerald-600 font-mono">
                                            {selectedCurrency === (doc.currency || 'XOF')
                                                ? `${doc.total.toLocaleString('fr-FR')} ${doc.currency || 'XOF'}`
                                                : formatPriceWithMargin(doc.total, selectedCurrency)
                                            }
                                        </p>
                                        {(doc.currency && doc.currency !== 'XOF' && doc.currency !== 'FCFA') && (
                                            <p className="text-[10px] text-gray-600">encaissé en {Math.round(convertCurrency(doc.total, doc.currency as CurrencyCode, 'XOF')).toLocaleString('fr-FR')} XOF (Mobile Money)</p>
                                        )}
                                    </div>
                                    <CurrencySelector
                                        value={selectedCurrency}
                                        onChange={setSelectedCurrency}
                                        baseAmountXOF={doc.total}
                                    />
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {activeProviders.map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => {
                                            if (p.id === 'fedapay') handleFedaPay()
                                            else if (p.id === 'kkiapay') handleKkiapay()
                                            else if (p.id === 'zeyow') handleZeyow()
                                        }}
                                        className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-slate-200 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group text-left"
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${p.color}`}>
                                            <CreditCard size={22} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">{p.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{p.subtitle}</p>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-600 group-hover:text-slate-900 transition-colors" />
                                    </button>
                                ))}

                                {paymentError && (
                                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-600 text-xs">
                                        <AlertCircle size={14} className="flex-shrink-0" />
                                        {paymentError}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-gray-600 justify-center mt-2">
                                    <Shield size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Transaction 100% sécurisée</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scripts de paiement - Uniquement Kkiapay ici car Fedapay est géré au chargement */}
            <Script src="https://cdn.kkiapay.me/k.js" strategy="lazyOnload" />

        </div>
    )
}

