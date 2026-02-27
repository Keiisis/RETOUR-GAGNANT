import type { Config } from 'tailwindcss'

const config = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: '',
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)'],
                heading: ['var(--font-poppins)'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                // ═══ Agent Dashboard "Nexus Emerald" palette ═══
                nexus: {
                    deep: 'var(--nexus-deep)',
                    card: 'var(--nexus-card)',
                    elevated: 'var(--nexus-elevated)',
                    hover: 'var(--nexus-hover)',
                    accent: 'var(--nexus-accent)',
                    'accent-soft': 'var(--nexus-accent-soft)',
                    glow: 'var(--nexus-glow)',
                    teal: 'var(--nexus-teal)',
                    text: 'var(--nexus-text)',
                    'text-secondary': 'var(--nexus-text-secondary)',
                    'text-muted': 'var(--nexus-text-muted)',
                    'border-subtle': 'var(--nexus-border-subtle)',
                    'border-default': 'var(--nexus-border-default)',
                    'border-strong': 'var(--nexus-border-strong)',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            boxShadow: {
                'nexus-glow': '0 0 30px var(--nexus-glow)',
                'nexus-glow-lg': '0 0 60px var(--nexus-glow)',
                'nexus-card': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(16, 185, 129, 0.1)',
                'nexus-elevated': '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.08)',
            },
            backdropBlur: {
                xs: '2px',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
                'nexus-pulse': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                },
                'nexus-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)' },
                    '50%': { boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)' },
                },
                'nexus-float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                'nexus-shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'nexus-border-flow': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                'nexus-scale-in': {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                'nexus-slide-up': {
                    '0%': { transform: 'translateY(16px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'nexus-shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
                    '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
                },
                'orb-float-1': {
                    '0%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0, 0) scale(1)' },
                },
                'orb-float-2': {
                    '0%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(-40px, 30px) scale(1.05)' },
                    '66%': { transform: 'translate(25px, -40px) scale(0.95)' },
                    '100%': { transform: 'translate(0, 0) scale(1)' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'nexus-pulse': 'nexus-pulse 2s ease-in-out infinite',
                'nexus-glow': 'nexus-glow 3s ease-in-out infinite',
                'nexus-float': 'nexus-float 6s ease-in-out infinite',
                'nexus-shimmer': 'nexus-shimmer 2s linear infinite',
                'nexus-border-flow': 'nexus-border-flow 4s ease infinite',
                'nexus-scale-in': 'nexus-scale-in 0.3s ease-out',
                'nexus-slide-up': 'nexus-slide-up 0.4s ease-out',
                'nexus-shake': 'nexus-shake 0.5s ease-in-out',
                'orb-1': 'orb-float-1 20s ease-in-out infinite',
                'orb-2': 'orb-float-2 25s ease-in-out infinite',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
} satisfies Config

export default config
