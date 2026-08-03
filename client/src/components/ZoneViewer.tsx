import { useEffect } from 'react';
import { DeckCard } from '../../../shared/types';

const CUT_PANEL =
  'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))';

export type ZoneKey = 'extra' | 'graveyard' | 'banished';

export const ZONE_LABELS: Record<ZoneKey, string> = {
  extra: 'Extra Deck',
  graveyard: 'Cimetière',
  banished: 'Bannis',
};

const ZONE_COLORS: Record<ZoneKey, string> = {
  extra: 'var(--cyan)',
  graveyard: 'var(--magenta)',
  banished: 'var(--violet)',
};

interface ZoneViewerProps {
  zone: ZoneKey | null;
  cards: DeckCard[];
  onClose: () => void;
}

/**
 * Contenu d'une zone du plateau (Extra Deck, Cimetière, Bannis).
 *
 * Les cartes du Cimetière et des Bannis sont des instances atomiques : deux
 * exemplaires de la même carte y figurent en deux entrées. On les affiche donc
 * telles quelles, dans l'ordre d'arrivée — l'ordre du Cimetière compte au jeu.
 * L'Extra Deck, lui, est regroupé par carte avec sa quantité.
 */
export default function ZoneViewer({ zone, cards, onClose }: ZoneViewerProps) {
  // Fermeture au clavier : une superposition sans échappatoire clavier est un
  // piège pour la navigation au tabulateur.
  useEffect(() => {
    if (!zone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zone, onClose]);

  if (!zone) return null;

  const color = ZONE_COLORS[zone];
  const label = ZONE_LABELS[zone];

  // L'Extra Deck se regroupe, les zones de jeu gardent leur ordre.
  const entries =
    zone === 'extra'
      ? Object.values(
          cards.reduce<Record<number, { card: DeckCard; count: number }>>((acc, dc) => {
            const cur = acc[dc.card_id];
            if (cur) cur.count += dc.quantity;
            else acc[dc.card_id] = { card: dc, count: dc.quantity };
            return acc;
          }, {})
        )
      : cards.map((dc) => ({ card: dc, count: 1 }));

  const total = entries.reduce((s, e) => s + e.count, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--panel)',
          border: `1px solid ${color}`,
          clipPath: CUT_PANEL,
          padding: '22px 24px',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h3
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color,
              margin: 0,
            }}>
            {label}
          </h3>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}>
            {total} carte{total > 1 ? 's' : ''}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-muted)',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 4,
            }}>
            ×
          </button>
        </div>

        {total === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {zone === 'extra'
              ? "Ce deck n'a pas d'Extra Deck."
              : `${label} vide pour l'instant.`}
          </p>
        ) : (
          <div
            style={{
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))',
              gap: 10,
            }}>
            {entries.map((entry, i) => {
              const img =
                entry.card.card?.card_images?.[0]?.image_url_small ||
                entry.card.card?.card_images?.[0]?.image_url;
              const name = entry.card.card?.name_fr || entry.card.card?.name || '—';
              return (
                <div key={`${entry.card.card_id}-${i}`} style={{ position: 'relative' }}>
                  {img ? (
                    <img
                      src={img}
                      alt={name}
                      title={name}
                      loading="lazy"
                      style={{
                        width: '100%',
                        aspectRatio: '59 / 86',
                        objectFit: 'cover',
                        border: '1px solid var(--border)',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '59 / 86',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        padding: 6,
                        textAlign: 'center',
                      }}>
                      {name}
                    </div>
                  )}
                  {entry.count > 1 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'var(--bg)',
                        color,
                        border: `1px solid ${color}`,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                      ×{entry.count}
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 4,
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                    {name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
