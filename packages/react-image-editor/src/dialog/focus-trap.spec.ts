import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFocusTrap, type FocusTrap } from './focus-trap';

/** jsdom lays nothing out, so make every element "visible" to the trap's filter. */
function makeVisible(root: HTMLElement): void {
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    el.getClientRects = () => [{} as DOMRect] as unknown as DOMRectList;
  }
}

function tab(shift = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

describe('createFocusTrap', () => {
  let opener: HTMLButtonElement;
  let container: HTMLDivElement;
  let first: HTMLButtonElement;
  let last: HTMLButtonElement;
  /** The trap under test — always deactivated afterwards so no listener leaks into the next test. */
  let trap: FocusTrap;

  beforeEach(() => {
    document.body.innerHTML = '';
    opener = document.createElement('button');
    opener.textContent = 'open';
    container = document.createElement('div');
    first = document.createElement('button');
    first.textContent = 'first';
    const middle = document.createElement('input');
    last = document.createElement('button');
    last.textContent = 'last';
    container.append(first, middle, last);
    document.body.append(opener, container);
    makeVisible(document.body);
    opener.focus();
  });

  afterEach(() => {
    trap.deactivate();
    vi.restoreAllMocks();
  });

  it('moves focus to the first tabbable element on activation', () => {
    trap = createFocusTrap(container);
    trap.activate();
    expect(document.activeElement).toBe(first);
  });

  it('wraps Tab from the last element to the first, and Shift+Tab from the first to the last', () => {
    trap = createFocusTrap(container);
    trap.activate();
    last.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back in when it has escaped the container', () => {
    trap = createFocusTrap(container);
    trap.activate();
    opener.focus();
    tab();
    expect(document.activeElement).toBe(first);
  });

  it('lets a Tab between inner elements proceed normally', () => {
    trap = createFocusTrap(container);
    trap.activate();
    first.focus();
    expect(tab().defaultPrevented).toBe(false);
  });

  it('focuses the container itself while nothing inside is tabbable yet', () => {
    container.replaceChildren();
    trap = createFocusTrap(container);
    trap.activate();
    expect(container.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(container);
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container);
  });

  it('restores focus to the opener on deactivation and stops listening', () => {
    trap = createFocusTrap(container);
    trap.activate();
    trap.deactivate();
    expect(document.activeElement).toBe(opener);
    last.focus();
    expect(tab().defaultPrevented).toBe(false);
  });

  it('does not throw when the opener has left the document', () => {
    trap = createFocusTrap(container);
    trap.activate();
    opener.remove();
    expect(() => trap.deactivate()).not.toThrow();
  });
});
