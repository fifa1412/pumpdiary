interface PadIconProps {
  className?: string;
  ariaHidden?: boolean;
}

export function PadIcon({ className, ariaHidden = true }: PadIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="5"
        y="5"
        width="30"
        height="30"
        rx="8"
        className="fill-secondary stroke-border"
      />
      <rect
        x="65"
        y="5"
        width="30"
        height="30"
        rx="8"
        className="fill-secondary stroke-border"
      />
      <rect
        x="5"
        y="65"
        width="30"
        height="30"
        rx="8"
        className="fill-secondary stroke-border"
      />
      <rect
        x="65"
        y="65"
        width="30"
        height="30"
        rx="8"
        className="fill-secondary stroke-border"
      />
      <rect x="39" y="39" width="22" height="22" rx="6" className="fill-primary" />
      <g
        className="stroke-primary"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M27 27 15 15 M15 21 V15 H21" />
        <path d="M73 27 85 15 M79 15 H85 V21" />
        <path d="M27 73 15 85 M15 79 V85 H21" />
        <path d="M73 73 85 85 M79 85 H85 V79" />
      </g>
    </svg>
  );
}
