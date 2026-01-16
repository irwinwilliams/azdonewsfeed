import type { ReactNode } from "react";

type IconProps = { className?: string; title?: string };

function Svg({ children, className, title }: { children: ReactNode } & IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5"}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M14 2l8 8-3 1-2 6-2 2-4-4-6 2-1 3-1-1 2-6-4-4 2-2 6-2 1-3z"
        opacity="0.9"
      />
    </Svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M7 3c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2H7z"
      />
    </Svg>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M5 3h10l4 4v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm9 1v4h4"
      />
      <path fill="currentColor" d="M7 11h10v2H7zm0 4h10v2H7z" opacity="0.7" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z"
      />
    </Svg>
  );
}
