// ════════════════════════════════════════════════════════════════
//  🧬 AURA HIVE v6.0 "PHANTOM" — PROJECT CLONER & REVERSE ENGINEER
//  Analyze any website → extract design, stack, architecture
//  Generate rebuild blueprint for drones
// ════════════════════════════════════════════════════════════════
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ════════════════════════════════════════════
// TECH DETECTION SIGNATURES
// ════════════════════════════════════════════
const TECH_SIGNATURES = {
    frameworks: {
        'React': { patterns: ['react', '_reactRoot', '__NEXT_DATA__', 'data-reactroot', 'reactjs'], confidence: 'HIGH' },
        'Next.js': { patterns: ['__NEXT_DATA__', '_next/', 'next/image', 'next-head-count'], confidence: 'HIGH' },
        'Vue.js': { patterns: ['__vue__', 'v-cloak', 'data-v-', 'Vue.js', 'vuejs'], confidence: 'HIGH' },
        'Nuxt': { patterns: ['__NUXT__', '_nuxt/', 'nuxt.js'], confidence: 'HIGH' },
        'Angular': { patterns: ['ng-version', 'ng-app', '_nghost', 'angular.js', 'angular.min'], confidence: 'HIGH' },
        'Svelte': { patterns: ['__svelte', 'svelte-'], confidence: 'HIGH' },
        'Astro': { patterns: ['astro-island', 'astro-slot'], confidence: 'HIGH' },
        'Remix': { patterns: ['__remix', 'remix-'], confidence: 'MEDIUM' },
        'jQuery': { patterns: ['jquery', 'jQuery', 'jquery.min'], confidence: 'HIGH' },
        'WordPress': { patterns: ['wp-content/', 'wp-includes/', 'wp-json/', '/xmlrpc.php'], confidence: 'HIGH' },
        'Shopify': { patterns: ['cdn.shopify.com', 'Shopify.theme', 'myshopify'], confidence: 'HIGH' },
        'Webflow': { patterns: ['webflow.js', 'wf-page', 'Webflow'], confidence: 'HIGH' },
        'Laravel': { patterns: ['laravel', 'csrf-token', 'XSRF-TOKEN'], confidence: 'MEDIUM' },
        'Django': { patterns: ['csrfmiddlewaretoken', 'django'], confidence: 'MEDIUM' },
        'Express': { patterns: ['X-Powered-By: Express'], confidence: 'MEDIUM' },
        'Ruby on Rails': { patterns: ['csrf-param', 'data-turbo', 'actioncable'], confidence: 'MEDIUM' }
    },
    css: {
        'Tailwind CSS': { patterns: ['tailwindcss', 'tw-'], confidence: 'MEDIUM' },
        'Bootstrap': { patterns: ['bootstrap', 'btn btn-', 'col-md-', 'container-fluid'], confidence: 'HIGH' },
        'Material UI': { patterns: ['MuiBox', 'MuiButton', 'mui-'], confidence: 'HIGH' },
        'shadcn/ui': { patterns: ['radix-', 'data-radix-'], confidence: 'MEDIUM' },
        'Chakra UI': { patterns: ['chakra-', 'css-'], confidence: 'MEDIUM' },
        'Ant Design': { patterns: ['ant-', 'antd'], confidence: 'HIGH' }
    },
    analytics: {
        'Google Analytics': { patterns: ['google-analytics.com', 'gtag', 'ga(', 'googletagmanager'], confidence: 'HIGH' },
        'Hotjar': { patterns: ['hotjar.com', 'hjSiteSettings'], confidence: 'HIGH' },
        'Mixpanel': { patterns: ['mixpanel.com', 'mixpanel.init'], confidence: 'HIGH' },
        'Segment': { patterns: ['segment.com', 'analytics.js', 'analytics.identify'], confidence: 'HIGH' },
        'Plausible': { patterns: ['plausible.io'], confidence: 'HIGH' },
        'Amplitude': { patterns: ['amplitude.com', 'amplitude.init'], confidence: 'HIGH' }
    },
    hosting: {
        'Vercel': { patterns: ['vercel', '.vercel.app', 'x-vercel-id'], confidence: 'HIGH' },
        'Netlify': { patterns: ['netlify', '.netlify.app', 'x-nf-request-id'], confidence: 'HIGH' },
        'AWS': { patterns: ['amazonaws.com', 'cloudfront', 'aws-'], confidence: 'HIGH' },
        'Cloudflare': { patterns: ['cf-ray', 'cloudflare'], confidence: 'HIGH' },
        'Firebase': { patterns: ['firebaseapp.com', 'firebase'], confidence: 'HIGH' },
        'Heroku': { patterns: ['.herokuapp.com'], confidence: 'HIGH' },
        'Railway': { patterns: ['.railway.app'], confidence: 'HIGH' }
    },
    auth: {
        'Auth0': { patterns: ['auth0.com', 'auth0-'], confidence: 'HIGH' },
        'Clerk': { patterns: ['clerk.dev', 'clerk-'], confidence: 'HIGH' },
        'Firebase Auth': { patterns: ['firebaseauth', 'firebase.auth'], confidence: 'HIGH' },
        'Supabase Auth': { patterns: ['supabase.co/auth', 'supabase-auth'], confidence: 'HIGH' },
        'NextAuth': { patterns: ['next-auth', '/api/auth/'], confidence: 'MEDIUM' }
    },
    payments: {
        'Stripe': { patterns: ['js.stripe.com', 'stripe.com', 'stripe-'], confidence: 'HIGH' },
        'PayPal': { patterns: ['paypal.com', 'paypalobjects'], confidence: 'HIGH' },
        'Paddle': { patterns: ['paddle.com', 'paddle.js'], confidence: 'HIGH' }
    }
};

// ════════════════════════════════════════════
// PROJECT CLONER CLASS
// ════════════════════════════════════════════
class ProjectCloner extends EventEmitter {
    constructor() {
        super();
        this.analyses = new Map();
    }

    // ── Full Website Analysis ──
    async analyzeWebsite(targetUrl, options = {}) {
        const analysisId = crypto.randomBytes(8).toString('hex');
        const maxPages = options.maxPages || 10;

        const analysis = {
            id: analysisId,
            target: targetUrl,
            started: new Date().toISOString(),
            status: 'running',
            design: {},
            techStack: {},
            structure: {},
            content: {},
            blueprint: null
        };

        this.analyses.set(analysisId, analysis);
        this.emit('analysis:started', { analysisId, target: targetUrl });

        try {
            // Phase 1: Fetch main page
            const mainPage = await this._fetch(targetUrl);
            if (!mainPage.success) {
                analysis.status = 'error';
                analysis.error = mainPage.error;
                return analysis;
            }

            // Phase 2: Design Extraction
            this.emit('analysis:phase', { phase: 'design' });
            analysis.design = this._extractDesign(mainPage.body, mainPage.headers);

            // Phase 3: Tech Stack Detection
            this.emit('analysis:phase', { phase: 'tech_stack' });
            analysis.techStack = this._detectTechStack(mainPage.body, mainPage.headers);

            // Phase 4: Structure Analysis
            this.emit('analysis:phase', { phase: 'structure' });
            analysis.structure = this._analyzeStructure(mainPage.body, targetUrl);

            // Phase 5: Content Extraction
            this.emit('analysis:phase', { phase: 'content' });
            analysis.content = this._extractContent(mainPage.body);

            // Phase 6: Multi-page analysis
            if (maxPages > 1) {
                this.emit('analysis:phase', { phase: 'multi_page' });
                const pages = this._extractLinks(mainPage.body, targetUrl);
                const subPages = [];

                for (const pageUrl of pages.slice(0, maxPages - 1)) {
                    const page = await this._fetch(pageUrl);
                    if (page.success) {
                        subPages.push({
                            url: pageUrl,
                            title: this._extractTitle(page.body),
                            sections: this._extractSections(page.body),
                            forms: this._extractForms(page.body)
                        });
                    }
                }
                analysis.structure.sub_pages = subPages;
            }

            // Phase 7: Generate Blueprint
            this.emit('analysis:phase', { phase: 'blueprint' });
            analysis.blueprint = this._generateBlueprint(analysis);

            analysis.status = 'complete';
            analysis.finished = new Date().toISOString();

        } catch (err) {
            analysis.status = 'error';
            analysis.error = err.message;
        }

        this.emit('analysis:complete', { analysisId });
        return analysis;
    }

    // ── Design Extraction ──
    _extractDesign(html, headers) {
        const design = {
            colors: [],
            fonts: [],
            spacing: {},
            layout: {},
            components: [],
            animations: false,
            darkMode: false,
            responsive: false
        };

        // Extract colors from inline styles and CSS
        const colorRegex = /#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)/g;
        const colorMatches = html.match(colorRegex);
        if (colorMatches) {
            const colorFreq = {};
            colorMatches.forEach(c => { colorFreq[c] = (colorFreq[c] || 0) + 1; });
            design.colors = Object.entries(colorFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .map(([color, count]) => ({ color, frequency: count }));
        }

        // Extract fonts
        const fontRegex = /font-family\s*:\s*([^;}"]+)/gi;
        const fontMatches = [...html.matchAll(fontRegex)];
        const fontSet = new Set();
        fontMatches.forEach(m => {
            m[1].split(',').forEach(f => fontSet.add(f.trim().replace(/["']/g, '')));
        });
        design.fonts = [...fontSet].filter(f => f.length > 1).slice(0, 10);

        // Google Fonts detection
        const gFontRegex = /fonts\.googleapis\.com\/css2?\?family=([^"&]+)/gi;
        const gFontMatches = [...html.matchAll(gFontRegex)];
        if (gFontMatches.length > 0) {
            design.googleFonts = gFontMatches.map(m => decodeURIComponent(m[1].replace(/\+/g, ' ')));
        }

        // Detect dark mode
        design.darkMode = html.includes('dark-mode') || html.includes('dark-theme') ||
            html.includes('prefers-color-scheme: dark') || html.includes('data-theme="dark"');

        // Detect responsive
        design.responsive = html.includes('viewport') || html.includes('@media') ||
            html.includes('responsive') || html.includes('col-md') || html.includes('grid');

        // Detect animations
        design.animations = html.includes('animation') || html.includes('transition') ||
            html.includes('keyframe') || html.includes('transform') || html.includes('gsap') ||
            html.includes('framer-motion') || html.includes('aos');

        // Detect component patterns
        const componentPatterns = [
            'navbar', 'nav', 'header', 'hero', 'footer', 'sidebar',
            'card', 'modal', 'dropdown', 'carousel', 'slider', 'accordion',
            'tabs', 'table', 'form', 'button', 'badge', 'toast',
            'breadcrumb', 'pagination', 'avatar', 'skeleton'
        ];
        design.components = componentPatterns.filter(c =>
            html.toLowerCase().includes(c)
        );

        return design;
    }

    // ── Tech Stack Detection ──
    _detectTechStack(html, headers) {
        const detected = {};
        const headerStr = JSON.stringify(headers || {}).toLowerCase();
        const combined = html + ' ' + headerStr;

        for (const [category, techs] of Object.entries(TECH_SIGNATURES)) {
            detected[category] = [];
            for (const [name, sig] of Object.entries(techs)) {
                const matches = sig.patterns.filter(p => combined.toLowerCase().includes(p.toLowerCase()));
                if (matches.length > 0) {
                    detected[category].push({
                        name,
                        confidence: sig.confidence,
                        matchedPatterns: matches.length
                    });
                }
            }
        }

        return detected;
    }

    // ── Structure Analysis ──
    _analyzeStructure(html, baseUrl) {
        return {
            title: this._extractTitle(html),
            meta: this._extractMeta(html),
            sections: this._extractSections(html),
            navigation: this._extractNavigation(html, baseUrl),
            forms: this._extractForms(html),
            images: this._countImages(html),
            scripts: this._countScripts(html),
            links: this._extractLinks(html, baseUrl).length
        };
    }

    // ── Content Extraction ──
    _extractContent(html) {
        // Strip tags for text content
        const textContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const words = textContent.split(/\s+/).filter(w => w.length > 2);

        return {
            textLength: textContent.length,
            wordCount: words.length,
            language: this._detectLanguage(textContent),
            headings: this._extractHeadings(html),
            cta_buttons: this._extractCTAs(html)
        };
    }

    // ── Generate Rebuild Blueprint ──
    _generateBlueprint(analysis) {
        const { design, techStack, structure, content } = analysis;

        // Determine recommended stack
        const primaryFramework = techStack.frameworks?.[0]?.name || 'Next.js';
        const cssFramework = techStack.css?.[0]?.name || 'Tailwind CSS';

        const blueprint = {
            title: `Blueprint: ${structure.title || analysis.target}`,
            recommended_stack: {
                framework: primaryFramework,
                css: cssFramework,
                hosting: techStack.hosting?.[0]?.name || 'Vercel',
                auth: techStack.auth?.[0]?.name || null,
                analytics: techStack.analytics?.[0]?.name || null,
                payments: techStack.payments?.[0]?.name || null
            },
            design_system: {
                colors: design.colors?.slice(0, 8).map(c => c.color),
                fonts: design.fonts?.slice(0, 3),
                google_fonts: design.googleFonts || [],
                dark_mode: design.darkMode,
                responsive: design.responsive,
                animations: design.animations
            },
            pages: [
                { path: '/', name: 'Home', sections: structure.sections?.length || 0 },
                ...(structure.sub_pages || []).map(p => ({
                    path: new URL(p.url).pathname,
                    name: p.title,
                    sections: p.sections?.length || 0,
                    forms: p.forms?.length || 0
                }))
            ],
            components_needed: design.components || [],
            content_summary: {
                headings: content.headings?.slice(0, 10),
                cta_buttons: content.cta_buttons?.slice(0, 5),
                word_count: content.wordCount
            },
            navigation: structure.navigation,
            rebuild_prompts: this._generateRebuildPrompts(analysis)
        };

        return blueprint;
    }

    // ── Generate Prompts for Drones ──
    _generateRebuildPrompts(analysis) {
        const { design, techStack, structure, content } = analysis;
        const framework = techStack.frameworks?.[0]?.name || 'Next.js';
        const css = techStack.css?.[0]?.name || 'Tailwind CSS';

        const prompts = [];

        // Setup prompt
        prompts.push({
            phase: 1,
            role: 'setup',
            prompt: `Create a new ${framework} project with ${css}. Set up the project structure with pages: ${structure.sub_pages?.map(p => new URL(p.url).pathname).join(', ') || '/'}. Use the color palette: ${design.colors?.slice(0, 5).map(c => c.color).join(', ')}. Fonts: ${design.fonts?.slice(0, 2).join(', ')}.${design.darkMode ? ' Include dark mode support.' : ''}${design.responsive ? ' Must be fully responsive.' : ''}`
        });

        // Component prompts
        if (design.components?.length > 0) {
            prompts.push({
                phase: 2,
                role: 'components',
                prompt: `Build these reusable components for the ${framework} project: ${design.components.join(', ')}. Use ${css} for styling. Colors: ${design.colors?.slice(0, 5).map(c => c.color).join(', ')}. ${design.animations ? 'Include smooth animations and transitions.' : ''}`
            });
        }

        // Page prompts
        prompts.push({
            phase: 3,
            role: 'pages',
            prompt: `Build the homepage with these sections: ${content.headings?.slice(0, 5).map(h => h.text).join(', ')}. Include CTAs: ${content.cta_buttons?.slice(0, 3).map(c => c.text).join(', ')}. Navigation links: ${structure.navigation?.join(', ')}. Match the design with colors ${design.colors?.slice(0, 3).map(c => c.color).join(', ')} and fonts ${design.fonts?.slice(0, 2).join(', ')}.`
        });

        return prompts;
    }

    // ═══════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════

    async _fetch(urlStr) {
        return new Promise((resolve) => {
            try {
                const parsed = new URL(urlStr);
                const lib = parsed.protocol === 'https:' ? https : http;
                const req = lib.get(urlStr, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
                    timeout: 15000,
                    rejectUnauthorized: false
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ success: true, body: data, headers: res.headers, status: res.statusCode }));
                });
                req.on('error', (err) => resolve({ success: false, error: err.message }));
                req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
            } catch (err) { resolve({ success: false, error: err.message }); }
        });
    }

    _extractTitle(html) {
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return match ? match[1].trim().substring(0, 100) : '';
    }

    _extractMeta(html) {
        const meta = {};
        const metaRegex = /<meta\s+(?:name|property)\s*=\s*["']([^"']+)["']\s+content\s*=\s*["']([^"']+)["']/gi;
        let match;
        while ((match = metaRegex.exec(html)) !== null) {
            meta[match[1]] = match[2].substring(0, 200);
        }
        return meta;
    }

    _extractSections(html) {
        const sections = [];
        const sectionRegex = /<(?:section|main|article|div)\s+(?:[^>]*(?:id|class)\s*=\s*["']([^"']+)["'][^>]*)>/gi;
        let match;
        while ((match = sectionRegex.exec(html)) !== null) {
            const id = match[1];
            if (id && id.length > 1 && id.length < 50) sections.push(id);
        }
        return [...new Set(sections)].slice(0, 30);
    }

    _extractNavigation(html, baseUrl) {
        const nav = [];
        const navRegex = /<nav[\s\S]*?<\/nav>/gi;
        const navMatch = html.match(navRegex);
        if (navMatch) {
            const linkRegex = /href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)/gi;
            let lm;
            while ((lm = linkRegex.exec(navMatch[0])) !== null) {
                const text = lm[2].trim();
                if (text && text.length > 0 && text.length < 30) {
                    nav.push(text);
                }
            }
        }
        return [...new Set(nav)].slice(0, 15);
    }

    _extractForms(html) {
        const forms = [];
        const formRegex = /<form[^>]*>/gi;
        let match;
        while ((match = formRegex.exec(html)) !== null) {
            forms.push(match[0].substring(0, 200));
        }
        return forms;
    }

    _extractHeadings(html) {
        const headings = [];
        const hRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
        let match;
        while ((match = hRegex.exec(html)) !== null) {
            const text = match[2].replace(/<[^>]+>/g, '').trim();
            if (text.length > 0 && text.length < 100) {
                headings.push({ level: parseInt(match[1]), text });
            }
        }
        return headings.slice(0, 20);
    }

    _extractCTAs(html) {
        const ctas = [];
        const btnRegex = /<(?:button|a)[^>]*class\s*=\s*["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
        let match;
        while ((match = btnRegex.exec(html)) !== null) {
            const text = match[1].replace(/<[^>]+>/g, '').trim();
            if (text.length > 0 && text.length < 50) ctas.push({ text });
        }
        return ctas.slice(0, 10);
    }

    _extractLinks(html, baseUrl) {
        const links = [];
        const baseHost = new URL(baseUrl).hostname;
        const linkRegex = /href\s*=\s*["']([^"'#]+)/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
            try {
                const abs = match[1].startsWith('http') ? match[1] : new URL(match[1], baseUrl).toString();
                if (new URL(abs).hostname === baseHost) links.push(abs);
            } catch { /* skip */ }
        }
        return [...new Set(links)].slice(0, 50);
    }

    _countImages(html) {
        return (html.match(/<img\s/gi) || []).length;
    }

    _countScripts(html) {
        return (html.match(/<script\s/gi) || []).length;
    }

    _detectLanguage(text) {
        const sample = text.substring(0, 500).toLowerCase();
        if (/\b(le|la|les|de|du|des|est|sont|dans|pour|avec|une|sur)\b/i.test(sample)) return 'French';
        if (/\b(el|la|los|es|de|del|en|para|con|una|por)\b/i.test(sample)) return 'Spanish';
        if (/\b(der|die|das|ist|und|in|von|zu|den|mit)\b/i.test(sample)) return 'German';
        return 'English';
    }

    // ── Get analysis ──
    getAnalysis(id) { return this.analyses.get(id); }
    getHistory() {
        return [...this.analyses.entries()].map(([id, a]) => ({
            id, target: a.target, status: a.status, started: a.started
        }));
    }
}

module.exports = { ProjectCloner, TECH_SIGNATURES };
