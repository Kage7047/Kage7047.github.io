# kage7047.github.io

My site and writing: <https://kage7047.github.io>.

Vite + React, prerendered to static HTML at build time (so every page reads without JavaScript and
previews well when shared), with GSAP and Lenis for motion on top. Motion follows the OS
reduced-motion setting; `?motion=on` or the footer toggle overrides it.

```bash
npm ci
npm run dev       # local dev server
npm run build     # client bundle, SSR bundle, then tools/prerender.mjs writes one HTML file per page
node tools/og.mjs # regenerate the social preview images in public/og/
```

Pushes to `main` build and deploy through GitHub Actions (`.github/workflows/deploy.yml`).

Posts live in `src/pages/posts/`, and are listed in `src/routes.js`. Charts and diagrams are plain
React + SVG/CSS in `src/components/`, with a table view for every chart.
