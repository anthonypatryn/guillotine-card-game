// Theme system: colour palettes + independently-chosen heading/body fonts,
// persisted to localStorage and applied as CSS variables on :root. Importing
// this module applies the saved theme immediately.

const PALETTES = {
  'parisian-noir': { name: 'Parisian Noir', swatch: ['#171210', '#7e1d26', '#c8a24a', '#efe3cd'], vars: {
    '--bg': '#171210', '--panel': '#241a14', '--panel-light': '#3b2d22', '--ink': '#f1e7d4', '--muted': '#b7a586',
    '--accent': '#7e1d26', '--accent-bright': '#b4323d', '--gold': '#c8a24a', '--cream': '#efe3cd' } },
  'french-quarter': { name: 'French Quarter', swatch: ['#241d16', '#8a4a3c', '#d6a23c', '#c7c3b6'], vars: {
    '--bg': '#241d16', '--panel': '#352a20', '--panel-light': '#4a3b2c', '--ink': '#efe6d4', '--muted': '#bcae92',
    '--accent': '#8a4a3c', '--accent-bright': '#a85a48', '--gold': '#d6a23c', '--cream': '#c7c3b6' } },
  'belle-epoque': { name: 'Belle Époque', swatch: ['#13202b', '#d48d91', '#e6c08a', '#9fb0bf'], vars: {
    '--bg': '#13202b', '--panel': '#1c2f40', '--panel-light': '#2b4559', '--ink': '#f2e5d4', '--muted': '#9fb0bf',
    '--accent': '#b0545a', '--accent-bright': '#d48d91', '--gold': '#e6c08a', '--cream': '#f2ceae' } },
  'bordeaux': { name: 'Bordeaux & Gold', swatch: ['#1a1010', '#6e1423', '#caa64a', '#e8dcc6'], vars: {
    '--bg': '#1a1010', '--panel': '#281619', '--panel-light': '#3c2329', '--ink': '#f0e3d6', '--muted': '#b09a8e',
    '--accent': '#6e1423', '--accent-bright': '#a01e30', '--gold': '#caa64a', '--cream': '#e8dcc6' } },
  'provence': { name: 'Provence (Lavender)', swatch: ['#2a2533', '#8e7bb0', '#d6a23c', '#abb2a6'], vars: {
    '--bg': '#2a2533', '--panel': '#352e40', '--panel-light': '#473c54', '--ink': '#efe6d4', '--muted': '#b3a7bf',
    '--accent': '#6a5a8a', '--accent-bright': '#8e7bb0', '--gold': '#d6a23c', '--cream': '#e9dcc6' } },
  'cote-dazur': { name: "Côte d'Azur", swatch: ['#0f2a3a', '#2e9cb0', '#e8c35a', '#f2ead6'], vars: {
    '--bg': '#0f2a3a', '--panel': '#163a4c', '--panel-light': '#215067', '--ink': '#f0ead8', '--muted': '#9fc0d0',
    '--accent': '#1f7a8c', '--accent-bright': '#2e9cb0', '--gold': '#e8c35a', '--cream': '#f2ead6' } },
  'provincial': { name: 'French Provincial', light: true, swatch: ['#4e5760', '#abb2a6', '#e0d3c4', '#eee9e2'], vars: {
    '--bg': '#e9e3d7', '--panel': '#dcd2c1', '--panel-light': '#cabda4', '--ink': '#3a362f', '--muted': '#6e6557',
    '--accent': '#4e5760', '--accent-bright': '#63707b', '--gold': '#b5a492', '--cream': '#eee9e2' } },
  'farmhouse': { name: 'French Farmhouse', light: true, swatch: ['#efe7d8', '#b06a4a', '#8fa58c', '#7fa0bd'], vars: {
    '--bg': '#efe7d8', '--panel': '#e2d6c1', '--panel-light': '#d0c0a2', '--ink': '#3b342a', '--muted': '#7a6e5b',
    '--accent': '#b06a4a', '--accent-bright': '#c47a55', '--gold': '#d8a23c', '--cream': '#f4ecdd' } },
};
// Pixel fonts only — the two the game ships with.
const HEAD_FONTS = {
  press: { name: 'Press Start', css: "'Press Start 2P', monospace" },
  silk:  { name: 'Silkscreen',  css: "'Silkscreen', monospace" },
};
const BODY_FONTS = {
  silk:  { name: 'Silkscreen',  css: "'Silkscreen', monospace" },
  press: { name: 'Press Start', css: "'Press Start 2P', monospace" },
};
export const THEME_KEY = 'guillotine-theme';
export function loadTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY));
    if (t && PALETTES[t.palette] && HEAD_FONTS[t.head] && BODY_FONTS[t.body]) return t;
  } catch { /* ignore */ }
  return { palette: 'parisian-noir', head: 'press', body: 'silk' };
}
export function applyTheme({ palette, head, body }) {
  const root = document.documentElement;
  const p = PALETTES[palette]; if (p) Object.entries(p.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  const h = HEAD_FONTS[head]; if (h) { root.style.setProperty('--font-head', h.css); root.style.setProperty('--font-display', h.css); }
  const b = BODY_FONTS[body]; if (b) root.style.setProperty('--font-body', b.css);
}
applyTheme(loadTheme());

export function ThemeSheet({ theme, setTheme, close }) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal theme-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">Theme &amp; Fonts</p>
        <div className="ts-label">Color palette</div>
        <div className="ts-grid">
          {Object.entries(PALETTES).map(([k, p]) => (
            <button key={k} className={'ts-pal' + (theme.palette === k ? ' on' : '')} onClick={() => setTheme({ palette: k })}>
              <span className="ts-sw">{p.swatch.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
              <span className="ts-name">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="ts-label">Headings</div>
        <div className="ts-grid ts-grid-3">
          {Object.entries(HEAD_FONTS).map(([k, f]) => (
            <button key={k} className={'ts-font' + (theme.head === k ? ' on' : '')}
              onClick={() => setTheme({ head: k })} style={{ fontFamily: f.css }}>{f.name}</button>
          ))}
        </div>
        <div className="ts-label">Body text</div>
        <div className="ts-grid">
          {Object.entries(BODY_FONTS).map(([k, f]) => (
            <button key={k} className={'ts-font' + (theme.body === k ? ' on' : '')}
              onClick={() => setTheme({ body: k })} style={{ fontFamily: f.css }}>{f.name}</button>
          ))}
        </div>
        <button className="btn primary" onClick={close}>Done</button>
      </div>
    </div>
  );
}
