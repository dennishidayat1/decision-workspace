import { Capacitor } from '@capacitor/core';

/** Supplement Ionic's scroll assist when the iOS web keyboard changes the visual viewport. */
export function keepIosInputVisible(window: Window): () => void {
  const { document, visualViewport: viewport } = window;
  if (!viewport || Capacitor.isNativePlatform()) return () => {};

  const listeners = new AbortController();
  let frame = 0;
  let paddedContent: HTMLElement | undefined;

  function clearPadding(): void {
    paddedContent?.style.removeProperty('--focus-obstruction');
    paddedContent = undefined;
    document.documentElement.classList.remove('workspace-keyboard-open');
    document.documentElement.style.removeProperty('--workspace-visual-height');
    document.documentElement.style.removeProperty('--workspace-visual-top');
  }

  function correctFocus(): void {
    if (!viewport || !document.documentElement.classList.contains('plt-ios')) return;

    const input = document.activeElement;
    const keyboardOpen = viewport.scale === 1 && window.innerHeight - viewport.height > 100;
    if (!keyboardOpen || !(input instanceof HTMLElement) ||
        !input.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range])')) {
      clearPadding();
      return;
    }

    const content = input.closest<HTMLElement>('ion-content, [data-keyboard-scroll]');
    const scroll = content?.matches('[data-keyboard-scroll]') ? content :
      content?.shadowRoot?.querySelector<HTMLElement>('[part="scroll"]');
    if (!content || !scroll) {
      clearPadding();
      return;
    }

    if (paddedContent && paddedContent !== content) clearPadding();
    paddedContent = content;
    document.documentElement.classList.add('workspace-keyboard-open');
    document.documentElement.style.setProperty('--workspace-visual-height', `${viewport.height}px`);
    document.documentElement.style.setProperty('--workspace-visual-top', `${viewport.offsetTop}px`);

    const bounds = scroll.getBoundingClientRect();
    const visibleTop = Math.max(bounds.top, viewport.offsetTop) + 12;
    const viewportBottom = viewport.offsetTop + viewport.height;
    const visibleBottom = Math.min(bounds.bottom, viewportBottom) - 12;
    content.style.setProperty('--focus-obstruction', `${Math.max(0, bounds.bottom - viewportBottom + 12)}px`);

    const field = (input.closest('ion-input, ion-textarea') ?? input).getBoundingClientRect();
    if (field.top < visibleTop || field.height > visibleBottom - visibleTop) {
      scroll.scrollTop += field.top - visibleTop;
    } else if (field.bottom > visibleBottom) {
      scroll.scrollTop += field.bottom - visibleBottom;
    }
  }

  function scheduleCorrection(): void {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(correctFocus);
  }

  viewport.addEventListener('resize', scheduleCorrection, { signal: listeners.signal });
  document.addEventListener('focusin', scheduleCorrection, { signal: listeners.signal });
  document.addEventListener('focusout', scheduleCorrection, { signal: listeners.signal });
  return () => {
    listeners.abort();
    window.cancelAnimationFrame(frame);
    clearPadding();
  };
}
