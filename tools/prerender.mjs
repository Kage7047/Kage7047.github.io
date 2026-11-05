// Render every route to static HTML: readable without JS, by crawlers and by link previews.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = 'dist'
const server = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href)
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function head(route) {
  const { SITE } = server
  const url = SITE.url + (route.path === '/404.html' ? '/' : route.path)
  const tags = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${route.post ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE.url}${route.image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="author" content="${SITE.name}" />`,
    `<meta name="color-scheme" content="light dark" />`,
    `<link rel="alternate" type="application/rss+xml" title="${SITE.name}" href="/feed.xml" />`,
  ]
  if (route.post) tags.push(`<meta property="article:published_time" content="${route.post.date}" />`)
  if (route.page === '404') tags.push('<meta name="robots" content="noindex" />')
  return tags.join('\n    ')
}

const pages = [...server.ROUTES, server.NOT_FOUND]
for (const route of pages) {
  const html = template.replace('<!--head-->', head(route)).replace('<!--app-->', server.render(route))
  const file = route.path === '/404.html' ? path.join(dist, '404.html') : path.join(dist, route.path, 'index.html')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, html)
}

// sitemap and RSS
const { SITE } = server
const posts = server.ROUTES.filter((r) => r.post)
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${server.ROUTES.map(
    (r) => `  <url><loc>${SITE.url}${r.path}</loc>${r.post ? `<lastmod>${r.post.date}</lastmod>` : ''}</url>`,
  ).join('\n')}\n</urlset>\n`,
)
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`)
fs.writeFileSync(
  path.join(dist, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(SITE.name)}</title><link>${SITE.url}/</link><description>${esc(SITE.description)}</description>\n${posts
    .map(
      (r) =>
        `<item><title>${esc(r.title)}</title><link>${SITE.url}${r.path}</link><guid>${SITE.url}${r.path}</guid><pubDate>${new Date(r.post.date + 'T09:00:00Z').toUTCString()}</pubDate><description>${esc(r.description)}</description></item>`,
    )
    .join('\n')}\n</channel></rss>\n`,
)
fs.rmSync('dist-ssr', { recursive: true, force: true })
console.log(`prerendered ${pages.length} pages, sitemap.xml, feed.xml, robots.txt`)
