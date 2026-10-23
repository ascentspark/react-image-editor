/**
 * A minimal focus trap for the packaged modal: Tab cycles inside the
 * container, focus moves in on activation and back to the opener on
 * deactivation. Framework-free so the dialog stays dependency-light.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusTrap {
  /** Start trapping: remember the opener and move focus into the container. */
  activate(): void;
  /** Stop trapping and return focus to the opener if it is still in the document. */
  deactivate(): void;
}

/** Tabbable descendants of `root`, in DOM order, skipping anything hidden by `hidden`/`display: none`. */
function tabbableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hidden && el.getClientRects().length > 0,
  );
}

/**
 * Create a focus trap around `container`. The container gets `tabindex="-1"`
 * so it can take focus itself when nothing inside is tabbable yet (the editor
 * mounts asynchronously) — Tab then never escapes to the page behind the scrim.
 */
export function createFocusTrap(container: HTMLElement, doc: Document = document): FocusTrap {
  let opener: HTMLElement | null = null;

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
      return;
    }
    const items = tabbableIn(container);
    if (items.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = doc.activeElement;
    const inside = active instanceof HTMLElement && container.contains(active);
    if (event.shiftKey) {
      if (!inside || active === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return {
    activate(): void {
      opener = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      if (!container.hasAttribute('tabindex')) {
        container.tabIndex = -1;
      }
      doc.addEventListener('keydown', onKeydown, true);
      (tabbableIn(container)[0] ?? container).focus();
    },
    deactivate(): void {
      doc.removeEventListener('keydown', onKeydown, true);
      if (opener && opener.isConnected) {
        opener.focus();
      }
      opener = null;
    },
  };
}
