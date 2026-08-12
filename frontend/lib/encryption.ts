// ══════════════════════════════════════════════════════════════
// 🔐 Chiffrement AES-256-GCM : Fichiers sensibles + secrets TOTP
// Node.js crypto (serveur uniquement : ne pas importer côté client)
// ══════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// La clé de chiffrement doit être définie dans les variables d'environnement
// ENCRYPTION_KEY = clé hex 64 caractères (32 bytes = 256 bits)
function getEncryptionKey(): Buffer {
    const keyHex = process.env.ENCRYPTION_KEY
    if (!keyHex || keyHex.length < 64) {
        throw new Error('ENCRYPTION_KEY manquante ou invalide (64 hex chars requis)')
    }
    return Buffer.from(keyHex.slice(0, 64), 'hex')
}

// ── Chiffrer un Buffer (fichier binaire) ───────────────────────
export interface EncryptedFile {
    ciphertext: Buffer
    iv: string         // hex
    authTag: string    // hex
}

export function encryptBuffer(data: Buffer): EncryptedFile {
    const key = getEncryptionKey()
    const iv  = randomBytes(12) // 96 bits pour GCM

    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const authTag = cipher.getAuthTag()

    return {
        ciphertext: encrypted,
        iv:         iv.toString('hex'),
        authTag:    authTag.toString('hex'),
    }
}

// ── Déchiffrer un Buffer ───────────────────────────────────────
export function decryptBuffer(
    ciphertext: Buffer,
    ivHex: string,
    authTagHex: string
): Buffer {
    const key     = getEncryptionKey()
    const iv      = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ── Chiffrer une chaîne (secrets TOTP) ───────────────────────
export function encryptString(text: string): string {
    const result = encryptBuffer(Buffer.from(text, 'utf8'))
    // Format compact : iv:authTag:ciphertext (tout en base64url)
    return [
        result.iv,
        result.authTag,
        result.ciphertext.toString('base64'),
    ].join(':')
}

// ── Déchiffrer une chaîne ─────────────────────────────────────
export function decryptString(encoded: string): string {
    const parts = encoded.split(':')
    if (parts.length !== 3) throw new Error('Format de données chiffrées invalide')
    const [ivHex, authTagHex, ciphertextB64] = parts
    const ciphertext = Buffer.from(ciphertextB64, 'base64')
    return decryptBuffer(ciphertext, ivHex, authTagHex).toString('utf8')
}

// ── Hash SHA-256 (pour fingerprinting, non réversible) ────────
export function sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex')
}

// ── Générer une clé AES-256 aléatoire (utilitaire setup) ──────
export function generateEncryptionKey(): string {
    return randomBytes(32).toString('hex')
}
