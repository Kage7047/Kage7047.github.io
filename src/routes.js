// Every page the site has. The prerender step writes one HTML file per path, with its own meta tags.
export const SITE = {
  name: 'Ilya Nesterenok',
  url: 'https://kage7047.github.io',
  description: 'Backend, full-stack and DevOps engineer in Warsaw. Notes on building systems and then trying to break them.',
}

export const POSTS = [
  {
    slug: 'more-workers-slower',
    path: '/writing/more-workers-slower/',
    title: 'Adding workers made my Postgres queue 5× slower',
    dek: 'Four workers did 1,638 jobs a second. Eight did 306. What pg_stat_activity showed, and the three changes that took eight workers to 2,152.',
    date: '2026-11-05',
    tags: ['Postgres', 'performance', 'queues'],
    image: '/og/more-workers-slower.png',
  },
]

export const ROUTES = [
  { path: '/', page: 'home', title: `${SITE.name} · backend, full-stack and DevOps`, description: SITE.description, image: '/og/home.png' },
  ...POSTS.map((p) => ({ path: p.path, page: p.slug, title: p.title, description: p.dek, image: p.image, post: p })),
]

export const NOT_FOUND = { path: '/404.html', page: '404', title: `Not found · ${SITE.name}`, description: SITE.description, image: '/og/home.png' }

export const routeFor = (pathname) => {
  const p = pathname.endsWith('/') ? pathname : `${pathname}/`
  return ROUTES.find((r) => r.path === p) || NOT_FOUND
}
