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
