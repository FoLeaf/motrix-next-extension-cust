export interface MagnetClickHandlerDeps {
  isEnabled: () => boolean;
  sendMagnet: (url: string) => void;
}

function getMagnetHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a[href^="magnet:"]');
  return anchor?.getAttribute('href') ?? null;
}

export function createMagnetClickHandler(deps: MagnetClickHandlerDeps) {
  return (event: MouseEvent): void => {
    const href = getMagnetHref(event.target);
    if (!href || !deps.isEnabled()) return;

    event.preventDefault();
    event.stopPropagation();
    deps.sendMagnet(href);
  };
}
