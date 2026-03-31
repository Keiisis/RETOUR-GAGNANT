import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
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
      // scripts des SDK de paiement + analytics
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'" +
        " https://cdn.kkiapay.me https://sandbox.kkiapay.me" +
        " https://cdn.fedapay.com https://checkout.fedapay.com" +
        " https://js.stripe.com" +
        " https://www.paypal.com https://www.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.kkiapay.me https://*.fedapay.com https://www.paypalobjects.com https://*.paypal.com",
      // connexions API paiement — CRITIQUE : kkiapay init via XHR avant d'exposer openKkiapayWidget
      "connect-src 'self'" +
        " https://*.supabase.co wss://*.supabase.co" +
        " https://api.groq.com" +
        " https://api.stripe.com https://m.stripe.com https://m.stripe.network" +
        " https://*.kkiapay.me wss://*.kkiapay.me" +
        " https://api.fedapay.com https://sandbox-api.fedapay.com https://checkout.fedapay.com" +
        " https://api-m.paypal.com https://api-m.sandbox.paypal.com",
      // iframes widgets de paiement
      "frame-src 'self'" +
        " https://js.stripe.com https://hooks.stripe.com" +
        " https://www.paypal.com https://www.sandbox.paypal.com" +
        " https://*.kkiapay.me" +
        " https://checkout.fedapay.com",
      "worker-src 'self' blob:",
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
  },
  turbopack: {},
}

export default withPWA(nextConfig)
