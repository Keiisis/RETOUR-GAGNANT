import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  // Quota Edge Vercel : caching de navigation désactivé (incident 75% du quota)
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // scripts des SDK de paiement. 'unsafe-eval' RETIRÉ (vecteur XSS eval).
      // 'wasm-unsafe-eval' autorise WebAssembly sans rouvrir eval() JS.
      // NB : 'unsafe-inline' reste tant que les nonces ne sont pas en place —
      // leur passage nécessite de retravailler le cache PWA (next-pwa) et un
      // test en préproduction, sous peine de pages blanches (nonce périmé en cache).
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" +
        " https://cdn.kkiapay.me https://sandbox.kkiapay.me" +
        " https://cdn.fedapay.com https://checkout.fedapay.com" +
        " https://js.stripe.com" +
        " https://www.paypal.com https://www.paypalobjects.com" +
        " https://www.googletagmanager.com https://www.google-analytics.com",
      // Durcissement (gains sans risque de casse) :
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.kkiapay.me https://*.fedapay.com https://www.paypalobjects.com https://*.paypal.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://unpkg.com https://www.google-analytics.com https://www.googletagmanager.com",
      // connexions API paiement — CRITIQUE : kkiapay init via XHR avant d'exposer openKkiapayWidget
      // blob: requis pour les textures embarquées du modèle 3D (GLTFLoader/ImageBitmap
      // fetch les images du GLB via des URL blob: same-origin) — sinon textures bloquées
      // par la CSP → bâtiment blanc sans couleur.
      "connect-src 'self' blob:" +
        " https://*.supabase.co wss://*.supabase.co" +
        " https://api.groq.com" +
        " https://api.stripe.com https://m.stripe.com https://m.stripe.network" +
        " https://*.kkiapay.me wss://*.kkiapay.me" +
        " https://api.fedapay.com https://sandbox-api.fedapay.com https://checkout.fedapay.com" +
        " https://api-m.paypal.com https://api-m.sandbox.paypal.com" +
        " https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://tiles.openfreemap.org" +
        " https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
      // iframes widgets de paiement + aperçu PDF local (blob same-origin, ex :
      // prévisualisation de la fiche d'analyse avant envoi)
      "frame-src 'self' blob:" +
        " https://js.stripe.com https://hooks.stripe.com" +
        " https://www.paypal.com https://www.sandbox.paypal.com" +
        " https://*.kkiapay.me" +
        " https://checkout.fedapay.com",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob: https://*.supabase.co",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'www.retourgagnantbenin.bj' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    // Vercel build (2 cœurs / 8 Go) tombait en OOM (SIGKILL) depuis que
    // l'app a grossi. Ce flag officiel Next.js libère le graphe de modules
    // au fil de la compilation → pic mémoire fortement réduit.
    webpackMemoryOptimizations: true,
  },
  // Compilation webpack (imposée par next-pwa). On bride la mémoire au lieu
  // de passer aux Elastic Build Machines payantes :
  webpack: (config, { dev }) => {
    if (!dev) {
      // webpack parallélise jusqu'à 100 modules → pic RAM. Sur 2 cœurs c'est
      // inutile : on limite pour lisser la mémoire (build un peu plus long).
      config.parallelism = 1
      // Pas de source maps serveur en prod (grosses allocations, inutiles).
      config.devtool = false
    }
    return config
  },
  turbopack: {},
}

export default withPWA(nextConfig)
