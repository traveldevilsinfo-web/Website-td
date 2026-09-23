"use client";

import { useRef } from "react";

// <details> menu that closes itself when a link or button inside is tapped (layout persists across navigations).
export function MobileMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as Element).closest("a, button") && ref.current) ref.current.open = false;
      }}
    >
      {children}
    </details>
  );
}
