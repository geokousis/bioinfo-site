import { useEffect, useRef } from 'react';

type UseOverlayDialogOptions = {
  onRequestClose: () => void;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let lockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const isHidden = element.offsetParent === null && element !== document.activeElement;
    return !isHidden && !element.hasAttribute('disabled') && element.tabIndex !== -1;
  });

const applyBodyScrollLock = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
  }

  lockCount += 1;
};

const releaseBodyScrollLock = () => {
  if (typeof document === 'undefined' || lockCount === 0) {
    return;
  }

  lockCount -= 1;

  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
};

export function useOverlayDialog({ onRequestClose }: UseOverlayDialogOptions) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    applyBodyScrollLock();

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    requestAnimationFrame(() => {
      const focusables = getFocusableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const isInside = active ? panel.contains(active) : false;

      if (event.shiftKey) {
        if (!isInside || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!isInside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseBodyScrollLock();
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [onRequestClose]);

  return panelRef;
}
