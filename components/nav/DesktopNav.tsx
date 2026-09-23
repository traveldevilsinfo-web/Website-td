"use client";

/**
 * Desktop menus open on hover / focus (pure CSS). After a link inside a panel is clicked, the pointer and focus
 * are still there, so the panel would stay open over the new page: mark it dismissed (it fades out) until the
 * pointer leaves that menu.
 */
export function DesktopNav({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <nav aria-label="Main" className={className}
      onClickCapture={(e) => {
        const link = (e.target as Element).closest(".menu-panel a");
        const group = link?.closest<HTMLElement>(".group");
        if (!group) return;
        group.dataset.dismissed = "";
        (document.activeElement as HTMLElement | null)?.blur();
        group.addEventListener("mouseleave", () => delete group.dataset.dismissed, { once: true });
      }}>
      {children}
    </nav>
  );
}
