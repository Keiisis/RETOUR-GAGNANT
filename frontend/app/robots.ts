import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/ceo/',
                    '/agent/',
                    '/client/',
                    '/admin/',
                    '/portfolio/',
                    '/api/',
                ],
            },
        ],
        sitemap: 'https://www.retourgagnantbenin.bj/sitemap.xml',
    }
}
