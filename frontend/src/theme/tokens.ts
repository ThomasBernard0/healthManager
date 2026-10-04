/**
 * Design tokens — the single source of truth for colors, spacing, typography, radii and shadows.
 * Components never hard-code these values: use the CSS variables (var(--color-primary))
 * or, in TS, the `tokens` object. Update from design/<feature>/ handoffs here only.
 */
export const tokens = {
  color: {
    bg: '#f7f8fa',
    surface: '#ffffff',
    text: '#1a1d23',
    textMuted: '#5c6370',
    border: '#e2e5ea',
    primary: '#2f6fed',
    success: '#1f9d55',
    warning: '#c98a00',
    danger: '#d64545',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '16px',
    pill: '999px',
  },
  font: {
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, 'Cascadia Code', Consolas, monospace",
  },
  fontSize: {
    sm: '0.875rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '2rem',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
  shadow: {
    sm: '0 1px 2px rgba(16, 24, 40, 0.06)',
    md: '0 4px 12px rgba(16, 24, 40, 0.08)',
  },
} as const

export type Tokens = typeof tokens

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Flattens tokens into CSS custom properties: color.textMuted -> --color-text-muted. */
export function toCssVariables(t: Tokens = tokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [group, values] of Object.entries(t)) {
    for (const [name, value] of Object.entries(values)) {
      vars[`--${kebab(group)}-${kebab(name)}`] = value
    }
  }
  return vars
}

/** Writes the tokens onto :root so plain CSS can use var(--…). */
export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(toCssVariables())) {
    root.style.setProperty(name, value)
  }
}
