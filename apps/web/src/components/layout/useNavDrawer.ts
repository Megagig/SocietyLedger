'use client';

import { useEffect, type RefObject } from 'react';
import { usePathname } from 'next/navigation';

/** Dispatched by the bottom navigation's "Menu" tab; the mounted sidebar listens and opens or closes its drawer. */
export const NAV_TOGGLE_EVENT = 'sl:nav-toggle';

export function requestNavToggle() {
  window.dispatchEvent(new CustomEvent(NAV_TOGGLE_EVENT));
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Drawer behaviour shared by the three sidebars below the `lg` breakpoint (at `lg` and up the sidebar is a fixed column, not a drawer):
 * closes after navigation, opens from the bottom navigation, closes on Escape, keeps Tab inside the drawer, stops the page behind it
 * scrolling, and hands focus back to whatever opened it.
 */
export function useNavDrawer(
  isOpen: boolean,
  setIsOpen: (open: boolean | ((open: boolean) => boolean)) => void,
  asideRef: RefObject<HTMLElement>,
  toggleRef: RefObject<HTMLElement>,
) {
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  useEffect(() => {
    const toggle = () => setIsOpen((open) => !open);
    window.addEventListener(NAV_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(NAV_TOGGLE_EVENT, toggle);
  }, [setIsOpen]);

  useEffect(() => {
    if (!isOpen || window.matchMedia('(min-width: 1024px)').matches) return;

    const opener = document.activeElement as HTMLElement | null;
    const insideDrawer = () => {
      const list = [
        ...(asideRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
        ...(toggleRef.current ? [toggleRef.current] : []),
      ];
      return list.filter((el) => el.offsetParent !== null);
    };
    insideDrawer()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = insideDrawer();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [isOpen, setIsOpen, asideRef, toggleRef]);
}
