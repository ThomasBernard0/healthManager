import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
)

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
)

export const Plus = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const Minus = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M5 12h14" />
  </Icon>
)

export const Close = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const Pencil = (p: IconProps) => (
  <Icon size={13} strokeWidth={2.2} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
  </Icon>
)

export const Bolt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
  </Icon>
)

export const Search = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
)

/** Filled star (favourite). */
export const Star = (p: IconProps) => (
  <Icon size={14} fill="currentColor" stroke="none" {...p}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </Icon>
)

/** Outlined star (not a favourite). */
export const StarOutline = (p: IconProps) => (
  <Icon size={14} {...p}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </Icon>
)

/** ? (options menu) */
export const Dots = (p: IconProps) => (
  <Icon size={18} fill="currentColor" stroke="none" {...p}>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </Icon>
)
