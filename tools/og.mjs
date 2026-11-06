// Social preview images (1200x630). Run `node tools/og.mjs` after changing a title; output is committed.
import fs from 'node:fs'
import sharp from 'sharp'

fs.mkdirSync('public/og', { recursive: true })
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function card({ eyebrow, lines, foot, chart }) {
  const title = lines
    .map((l, i) => `<text x="80" y="${240 + i * 78}" font-family="Newsreader, DejaVu Serif, serif" font-size="64" fill="#ecebe6">${esc(l)}</text>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#121211"/>
  <rect x="80" y="96" width="44" height="44" rx="11" fill="#ecebe6"/>
  <text x="102" y="126" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="18" font-weight="700" fill="#121211">IN</text>
  <text x="142" y="126" font-family="DejaVu Sans Mono, monospace" font-size="22" fill="#9a988f" letter-spacing="1">${esc(eyebrow)}</text>
  ${title}
  ${chart || ''}
  <text x="80" y="560" font-family="DejaVu Sans, sans-serif" font-size="26" fill="#9a988f">${esc(foot)}</text>
</svg>`
}

// 8-worker throughput, before vs after: 306 vs 2,152 jobs/s (the post's headline numbers)
const bar = (x, h, color, label) =>
  `<rect x="${x}" y="${520 - h}" width="56" height="${h}" rx="6" fill="${color}"/><text x="${x + 28}" y="${508 - h}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="22" font-weight="700" fill="#ecebe6">${label}</text>`
const chart = `${bar(960, 22, '#d95926', '306')}${bar(1030, 150, '#3987e5', '2,152')}<text x="1023" y="560" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#9a988f">8 workers: before → after</text>`

// the detection matrix in miniature: 7 bugs x 3 modes; orange = missed, outline = n/a
const MATRIX = [
  [0, 0, 0],
  [1, 1, 0],
  [0, 0, 2],
  [0, 0, 0],
  [0, 0, 2],
  [1, 0, 0],
  [0, 0, 0],
]
const cell = (x, y, v) =>
  v === 2
    ? `<rect x="${x + 1}" y="${y + 1}" width="44" height="28" rx="5" fill="none" stroke="#3a3a37" stroke-width="2"/>`
    : `<rect x="${x}" y="${y}" width="46" height="30" rx="5" fill="${v ? '#d95926' : '#2b2b29'}"/>`
const grid = MATRIX.map((row, r) => row.map((v, c) => cell(940 + c * 54, 236 + r * 38, v)).join('')).join('')
const matrix = `${grid}<text x="1021" y="530" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#9a988f">bugs × test modes</text>`

// one row per cluster attack: refused (green) with its control admitted (orange)
const shield = Array.from({ length: 14 }, (_, i) => {
  const x = 930 + (i % 2) * 90
  const y = 200 + Math.floor(i / 2) * 44
  return `<rect x="${x}" y="${y}" width="38" height="30" rx="5" fill="#2f7d4f"/><rect x="${x + 42}" y="${y}" width="38" height="30" rx="5" fill="#d95926"/>`
}).join('')
const attacks = `${shield}<text x="1015" y="530" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#9a988f">attack refused · control admitted</text>`

const cards = {
  'kyverno-fails-open': card({
    eyebrow: 'WRITING · KUBERNETES SECURITY',
    lines: ['My admission policy said', 'Fail. Kyverno let', 'everything in.'],
    foot: 'Ilya Nesterenok · kage7047.github.io',
    chart: attacks,
  }),
  'features-hide-bugs': card({
    eyebrow: 'WRITING · DISTRIBUTED SYSTEMS',
    lines: ['Every feature I added', 'to my Raft hid a bug', 'from my tests'],
    foot: 'Ilya Nesterenok · kage7047.github.io',
    chart: matrix,
  }),
  'more-workers-slower': card({
    eyebrow: 'WRITING · POSTGRES',
    lines: ['Adding workers made my', 'Postgres queue 5× slower'],
    foot: 'Ilya Nesterenok · kage7047.github.io',
    chart,
  }),
  home: card({
    eyebrow: 'WARSAW · BACKEND, FULL-STACK, DEVOPS',
    lines: ['I build systems,', 'then try to break them.'],
    foot: 'Ilya Nesterenok · kage7047.github.io',
  }),
}
for (const [name, svg] of Object.entries(cards)) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`public/og/${name}.png`)
  console.log(`public/og/${name}.png`)
}
