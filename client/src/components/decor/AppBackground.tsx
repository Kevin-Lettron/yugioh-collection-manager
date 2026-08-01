import { useEffect, useRef } from 'react';
import { GlyphEye, GlyphPyramid } from './Glyphs';

/**
 * Fond « Sanctuaire du Millénium » — glyphes en parallax souris + scroll.
 * Le halo violet et la trame or sont sur body via theme.css, ce composant
 * ajoute les 2 couches de glyphes flottants.
 *
 * Respecte prefers-reduced-motion (pas de parallax si utilisateur l'a coché).
 */
export function AppBackground() {
  const layer1 = useRef<HTMLDivElement>(null);
  const layer2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let mx = 0,
      my = 0,
      sy = 0,
      ticking = false;

    const apply = () => {
      if (layer1.current)
        layer1.current.style.transform = `translate3d(${mx * 0.15}px, ${
          -sy * 0.15 + my * 0.15
        }px, 0)`;
      if (layer2.current)
        layer2.current.style.transform = `translate3d(${mx * 0.32}px, ${
          -sy * 0.3 + my * 0.32
        }px, 0)`;
      ticking = false;
    };
    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / innerWidth - 0.5) * 24;
      my = (e.clientY / innerHeight - 0.5) * 24;
      request();
    };
    const onScroll = () => {
      sy = scrollY;
      request();
    };
    addEventListener('mousemove', onMouse);
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      removeEventListener('mousemove', onMouse);
      removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      <div
        ref={layer1}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden will-change-transform">
        <GlyphPyramid
          className="absolute animate-[san-float_12s_ease-in-out_infinite]"
          style={{ top: '12%', left: '6%', width: 80, height: 80, color: 'var(--gold)', opacity: 0.06 }}
        />
        <GlyphEye
          className="absolute animate-[san-float_12s_ease-in-out_-3s_infinite]"
          style={{ top: '32%', right: '8%', width: 110, height: 110, color: 'var(--violet)', opacity: 0.09 }}
        />
        <GlyphPyramid
          className="absolute animate-[san-float_12s_ease-in-out_-6s_infinite]"
          style={{ top: '65%', left: '14%', width: 60, height: 60, color: 'var(--violet)', opacity: 0.08 }}
        />
      </div>
      <div
        ref={layer2}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden will-change-transform">
        <GlyphEye
          className="absolute animate-[san-float_14s_ease-in-out_-2s_infinite]"
          style={{ top: '22%', left: '35%', width: 44, height: 44, color: 'var(--violet)', opacity: 0.07 }}
        />
        <GlyphPyramid
          className="absolute animate-[san-float_14s_ease-in-out_-5s_infinite]"
          style={{ bottom: '18%', right: '32%', width: 54, height: 54, color: 'var(--gold)', opacity: 0.06 }}
        />
      </div>
    </>
  );
}

export default AppBackground;
