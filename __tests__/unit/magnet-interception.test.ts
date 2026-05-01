import { describe, expect, it, vi } from 'vitest';
import { createMagnetClickHandler } from '@/lib/services/magnet-interception';

function appendMagnetLink(): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = 'magnet:?xt=urn:btih:abc123';
  anchor.textContent = 'Magnet';
  document.body.append(anchor);
  return anchor;
}

describe('createMagnetClickHandler', () => {
  it('does not prevent navigation when interception is paused', () => {
    const sendMagnet = vi.fn();
    const handler = createMagnetClickHandler({
      isEnabled: () => false,
      sendMagnet,
    });
    const anchor = appendMagnetLink();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    anchor.addEventListener('click', handler, true);
    const allowed = anchor.dispatchEvent(event);

    expect(allowed).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(sendMagnet).not.toHaveBeenCalled();
  });

  it('prevents navigation and sends the magnet URI when interception is enabled', () => {
    const sendMagnet = vi.fn();
    const handler = createMagnetClickHandler({
      isEnabled: () => true,
      sendMagnet,
    });
    const anchor = appendMagnetLink();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    anchor.addEventListener('click', handler, true);
    const allowed = anchor.dispatchEvent(event);

    expect(allowed).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(sendMagnet).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc123');
  });
});
