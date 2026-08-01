import { CornerOrnament } from './Glyphs';

/**
 * 4 ornements de coin dorés — égyptiens géométriques. Fixed, opacité 0.4,
 * pulse animation discrète (4 s). À monter à la racine des pages
 * authentifiées, pas sur les modales full-screen ou l'écran caméra.
 */
export function CornerOrnaments() {
  const shared = {
    'aria-hidden': true,
    className: 'fixed z-10 pointer-events-none animate-[san-corner_4s_ease-in-out_infinite]',
    style: { width: 100, height: 100, color: 'var(--gold)', opacity: 0.4 },
  };
  return (
    <>
      <CornerOrnament {...shared} style={{ ...shared.style, top: 12, left: 12 }} />
      <CornerOrnament
        {...shared}
        style={{ ...shared.style, top: 12, right: 12, transform: 'scaleX(-1)' }}
      />
      <CornerOrnament
        {...shared}
        style={{ ...shared.style, bottom: 12, left: 12, transform: 'scaleY(-1)' }}
      />
      <CornerOrnament
        {...shared}
        style={{ ...shared.style, bottom: 12, right: 12, transform: 'scale(-1)' }}
      />
    </>
  );
}

export default CornerOrnaments;
