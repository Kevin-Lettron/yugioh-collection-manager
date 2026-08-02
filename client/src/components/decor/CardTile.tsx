import { useRef } from 'react';

export type CardRarity = 'common' | 'rare' | 'super' | 'ultra' | 'secret' | 'prismatic';

/**
 * Devine la rareté à partir d'un label API libre.
 * `prismatic` regroupe les raretés arc-en-ciel les plus vives (Prismatic Secret,
 * Starlight, Ghost, Rainbow, Quarter Century Secret) qui méritent l'effet holo
 * pleine puissance. `secret` reste pour les Secret Rare classiques (rose/or/cyan).
 */
export function rarityFromLabel(label?: string | null): CardRarity {
  if (!label) return 'common';
  const l = label.toLowerCase();
  if (
    l.includes('prismatic') ||
    l.includes('starlight') ||
    l.includes('ghost') ||
    l.includes('rainbow') ||
    l.includes('quarter century')
  )
    return 'prismatic';
  if (l.includes('secret')) return 'secret';
  if (l.includes('ultra')) return 'ultra';
  if (l.includes('super')) return 'super';
  if (l.includes('rare')) return 'rare';
  return 'common';
}

interface Props {
  uri?: string;
  name?: string;
  rarity?: string | null;
  quantity?: number;
  language?: string;
  setCode?: string;
  onClick?: () => void;
  /** Index dans la grille — utilisé pour le stagger animation d'entrée */
  index?: number;
}

/**
 * Tuile de carte YGO selon la charte v2 « Sanctuaire du Millénium ».
 * Traitement retenu : glow par rareté + carte soulevée + reflet au sol.
 * Tilt 3D au hover + glow qui suit la souris (mix-blend-mode overlay).
 */
export function CardTile({
  uri,
  name,
  rarity,
  quantity = 1,
  language,
  setCode,
  onClick,
  index = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const r = rarityFromLabel(rarity);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    ref.current.style.setProperty('--mx', `${mx}%`);
    ref.current.style.setProperty('--my', `${my}%`);
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={onMouseMove}
      className={`card-tile card-tile--${r}`}
      style={{
        animationDelay: `${index * 40}ms`,
        cursor: onClick ? 'pointer' : 'default',
      }}>
      <div className="card-tile__inner">
        <div className="card-art">
          {uri ? (
            <img src={uri} alt={name || ''} loading="lazy" />
          ) : (
            <div className="card-art__placeholder" />
          )}
          {r === 'secret' && <div className="card-tile__holo" />}
          {r === 'prismatic' && (
            <>
              <div className="card-tile__rainbow" />
              <div className="card-tile__shimmer" />
            </>
          )}
          <div className="card-tile__glow" />
          {quantity > 0 && (
            <span className="card-qty">× {quantity}</span>
          )}
          {language && (
            <span className={`card-lang card-lang--${language.toLowerCase()}`}>
              {language.toUpperCase()}
            </span>
          )}
        </div>
        {(name || setCode) && (
          <div className="card-info">
            {name && <div className="card-name">{name}</div>}
            <div className="card-meta">
              {rarity && <span className="card-rarity">{rarity}</span>}
              {setCode && <span>{setCode}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CardTile;
