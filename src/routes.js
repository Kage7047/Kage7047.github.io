// Every page the site has. The prerender step writes one HTML file per path, with its own meta tags.
export const SITE = {
  name: 'Ilya Nesterenok',
  url: 'https://kage7047.github.io',
  description: 'Backend, full-stack and DevOps engineer in Warsaw. Notes on building systems and then trying to break them.',
}

export const POSTS = [
  {
    slug: 'kyverno-fails-open',
    path: '/writing/kyverno-fails-open/',
    title: 'My admission policy said Fail. Kyverno let everything in.',
    dek: 'Scaling Kyverno to zero makes it delete its own webhooks. That, and four more things I only found because every defence in my supply chain has an attack that must get through without it.',
    date: '2026-11-06',
    tags: ['Kubernetes', 'supply chain', 'security'],
    image: '/og/kyverno-fails-open.png',
  },
  {
    slug: 'features-hide-bugs',
    path: '/writing/features-hide-bugs/',
    title: 'Every feature I added to my Raft hid a bug from my tests',
    dek: 'PreVote, CheckQuorum, snapshots and ReadIndex each made the cluster better and the simulator blinder. Seven deliberately broken builds showed where, and one of them found a bug in my chaos test.',
    date: '2026-11-06',
    tags: ['Go', 'distributed systems', 'testing'],
    image: '/og/features-hide-bugs.png',
  },
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
