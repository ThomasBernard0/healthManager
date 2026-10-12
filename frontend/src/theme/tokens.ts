/**
 * Design tokens — the single source of truth for colors, spacing, typography, radii and shadows.
 * Components never hard-code these values: use the CSS variables (var(--color-accent))
 * or, in TS, the `tokens` object. Transcribed from design/ (spec §5 "Visual language").
 */
const light = {
  ground: '#F3F4EF',
  card: '#FFFFFF',
  ink: '#17201B',
  muted: '#5B655F',
  accent: '#1E6B47',
  accentHover: '#14492F',
  accentSoft: '#E3EFE7',
  accentSoftInk: '#14492F',
  accentLight: '#9CC4AE',
  onAccent: '#FFFFFF',
  over: '#B4510F',
  protein: '#2F5D8A',
  carbs: '#C98A1B',
  fat: '#7A4E91',
  border: '#E1E4DC',
  borderStrong: '#C9CEC3',
  divider: '#EEF0EA',
  track: '#E6E8E1',
  reference: '#8A938D',
  inverse: '#17201B',
  onInverse: '#FFFFFF',
  onInverseMuted: '#B8C2BC',
  onInverseAccent: '#9CC4AE',
  scrim: 'rgba(23, 32, 27, 0.45)',
  camera: '#000000',
  cameraFrame: 'rgba(255, 255, 255, 0.9)',
  onCamera: '#FFFFFF',
  /** Behind text laid over a photo (muscle pills on an exercise image). */
  overlay: 'rgba(255, 255, 255, 0.85)',
}

/** Dark theme: same roles, values tuned for contrast on a dark ground. */
const dark: typeof light = {
  ground: '#0F1411',
  card: '#1A211D',
  ink: '#E8ECE8',
  muted: '#9AA59F',
  accent: '#5DBB8C',
  accentHover: '#7FD0A7',
  accentSoft: '#1F3529',
  accentSoftInk: '#A6DCBF',
  accentLight: '#2F5C45',
  onAccent: '#0F1411',
  over: '#F0955A',
  protein: '#82AAD6',
  carbs: '#E2B35C',
  fat: '#BE97D4',
  border: '#2C3530',
  borderStrong: '#404B45',
  divider: '#252D28',
  track: '#2C3530',
  reference: '#7A847E',
  inverse: '#26302A',
  onInverse: '#E8ECE8',
  onInverseMuted: '#9AA59F',
  onInverseAccent: '#7FD0A7',
  scrim: 'rgba(0, 0, 0, 0.6)',
  camera: '#000000',
  cameraFrame: 'rgba(255, 255, 255, 0.9)',
  onCamera: '#FFFFFF',
  overlay: 'rgba(15, 20, 17, 0.75)',
}

export const tokens = {
  color: light,
  space: {
    '2': '2px',
    '3': '3px',
    '4': '4px',
    '6': '6px',
    '8': '8px',
    '10': '10px',
    '12': '12px',
    '14': '14px',
    '16': '16px',
    '18': '18px',
    '20': '20px',
    '22': '22px',
    '24': '24px',
    '28': '28px',
    '32': '32px',
    '40': '40px',
    '64': '64px',
  },
  radius: {
    xs: '2px',
    bar: '3px',
    sm: '6px',
    segment: '8px',
    md: '9px',
    segmented: '10px',
    lg: '12px',
    xl: '14px',
    card: '16px',
    list: '18px',
    panel: '20px',
    sheet: '24px',
    pill: '999px',
  },
  font: {
    body: "'IBM Plex Sans', system-ui, sans-serif",
    display: "'Space Grotesk', 'IBM Plex Sans', system-ui, sans-serif",
  },
  fontSize: {
    '11': '11px',
    '12': '12px',
    '13': '13px',
    '14': '14px',
    '15': '15px',
    '16': '16px',
    '17': '17px',
    '18': '18px',
    '20': '20px',
    '22': '22px',
    '24': '24px',
    '26': '26px',
    '28': '28px',
    '30': '30px',
    '36': '36px',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    /** Small uppercase labels (SUPERSET). */
    label: '0.04em',
  },
  shadow: {
    fab: '0 6px 18px rgba(23, 32, 27, 0.18)',
    dialog: '0 20px 60px rgba(23, 32, 27, 0.25)',
  },
  size: {
    touch: '44px',
    input: '48px',
    row: '52px',
    button: '54px',
    fab: '56px',
    fabClearance: '120px',
    timeColumn: '42px',
    numberInput: '72px',
    segment: '38px',
    toggle: '36px',
    desktopControl: '40px',
    desktopToggle: '32px',
    periodLabel: '210px',
    chartDesktop: '240px',
    miniChart: '74px',
    miniBar: '14px',
    colTime: '52px',
    colMacro: '48px',
    colKcal: '64px',
    colMenu: '40px',
    menuButton: '36px',
    tableMin: '440px',
    bandColumn: '240px',
    statsMin: '150px',
    macrosMin: '200px',
    miniWeek: '220px',
    weekColumn: '380px',
    chartColumn: '420px',
    tableColumn: '460px',
    chart: '180px',
    scanner: '280px',
    scanFrame: '120px',
    checkbox: '22px',
    ring: '150px',
    ringDesktop: '168px',
    content: '1120px',
    header: '1320px',
    dialog: '560px',
    mobile: '560px',
    thumb: '52px',
    thumbSmall: '40px',
    /** Rotation number in Mes séances. */
    badge: '28px',
    rowTall: '64px',
    stepper: '180px',
    exerciseThumbLarge: '84px',
    setIndexColumn: '22px',
    setTargetColumn: '78px',
    statusIcon: '32px',
    exerciseImage: '230px',
    exerciseImageDesktop: '300px',
    /** A / B letter of an exercise in a superset. */
    supersetBadge: '22px',
    supersetBadgeSmall: '18px',
    supersetBar: '3px',
    /** First column of a superset set row: badge + set number ("A1"). */
    supersetIndexColumn: '34px',
    /** One of the two stacked thumbnails of a superset card. */
    thumbStacked: '38px',
    supersetImage: '96px',
    /** Lest | Aide control of a bodyweight exercise. */
    loadSegment: '30px',
  },
} as const

export const darkColors = dark

/** Below this width the mobile layout applies (CSS media queries repeat it: 1024px). */
export const DESKTOP_MIN_WIDTH = 1024

export type Tokens = typeof tokens

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Flattens tokens into CSS custom properties: color.accentSoft -> --color-accent-soft. */
export function toCssVariables(t: Tokens = tokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [group, values] of Object.entries(t)) {
    for (const [name, value] of Object.entries(values)) {
      vars[`--${kebab(group)}-${kebab(name)}`] = value
    }
  }
  return vars
}

const declarations = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join('')

/**
 * The theme stylesheet: light on :root, dark under prefers-color-scheme,
 * and forced either way with <html data-theme="light|dark">.
 */
export function themeCss(): string {
  const base = declarations(toCssVariables())
  const darkVars = declarations(toCssVariables({ ...tokens, color: dark }))
  return [
    `:root{color-scheme:light;${base}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;${darkVars}}}`,
    `:root[data-theme="dark"]{color-scheme:dark;${darkVars}}`,
  ].join('\n')
}

/** Injects the theme stylesheet so plain CSS can use var(--…). */
export function applyTheme(doc: Document = document): void {
  const id = 'theme-tokens'
  const style = doc.getElementById(id) ?? doc.head.appendChild(doc.createElement('style'))
  style.id = id
  style.textContent = themeCss()
}
