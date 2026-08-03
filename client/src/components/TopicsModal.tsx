import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { newsApi } from '../services/newsApi';
import type { NewsTopic, NewsTopicMeta } from '../../../shared/types';
import { CheckIcon } from './decor/Icons';

interface TopicsModalProps {
  open: boolean;
  topics: NewsTopicMeta[];
  onClose: () => void;
  onSaved: (topics: NewsTopicMeta[]) => void;
}

const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_MODAL = 'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))';
const CUT_CARD = 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))';

/**
 * Modal d'abonnement aux thèmes d'actualités.
 * S'ouvre/ferme via `open` — animation d'entrée gérée par CSS.
 * ESC + clic sur l'overlay ferment.
 */
const TopicsModal = ({ open, topics, onClose, onSaved }: TopicsModalProps) => {
  const [selected, setSelected] = useState<Set<NewsTopic>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Initialise depuis le prop à chaque ouverture (permet de repartir du
      // dernier état persisté même si l'utilisateur ferme sans sauver).
      setSelected(new Set(topics.filter((t) => t.subscribed).map((t) => t.key)));
    }
  }, [open, topics]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (key: NewsTopic) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await newsApi.setTopics(Array.from(selected));
      onSaved(r.topics);
      toast.success('Préférences enregistrées');
      onClose();
    } catch {
      // toast déjà émis par l'intercepteur axios
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="topics-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,2,1,.86)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg,var(--panel),var(--bg))',
          border: '1px solid var(--border)',
          boxShadow: '0 40px 80px rgba(0,0,0,.6),0 0 60px rgba(245,197,24,.08)',
          padding: 32,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          clipPath: CUT_MODAL,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 6,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 11,
                letterSpacing: '0.3em',
                color: 'var(--gold)',
                textTransform: 'uppercase',
              }}
            >
              — Mes centres d'intérêt —
            </div>
            <h2
              id="topics-modal-title"
              style={{
                margin: '6px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text)',
              }}
            >
              Mes abonnements
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-muted)',
              fontSize: 26,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            margin: '14px 0 22px',
            padding: '12px 14px',
            background: 'rgba(168,85,247,.08)',
            borderLeft: '3px solid var(--violet)',
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-muted)',
          }}
        >
          Ne modifie que la pondération du fil, pas le filtre — tout reste
          consultable via les puces du haut de page.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
          className="max-sm:!grid-cols-1"
        >
          {topics.map((t) => {
            const on = selected.has(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggle(t.key)}
                style={{
                  textAlign: 'left',
                  padding: '16px 18px',
                  background: on
                    ? 'linear-gradient(135deg,rgba(245,197,24,.14),rgba(168,85,247,.08))'
                    : 'linear-gradient(135deg,var(--panel),var(--panel-2))',
                  border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  clipPath: CUT_CARD,
                  position: 'relative',
                  boxShadow: on ? '0 0 20px rgba(245,197,24,.18)' : 'none',
                  transition: 'transform .15s, box-shadow .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      flex: '0 0 22px',
                      border: `1.5px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
                      background: on ? 'var(--gold)' : 'transparent',
                      color: 'var(--on-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                      clipPath: 'polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)',
                    }}
                  >
                    {on && <CheckIcon size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: on ? 'var(--gold)' : 'var(--text)',
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: "'Rajdhani', sans-serif",
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 26,
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              height: 44,
              padding: '0 22px',
              background: 'var(--bg-elev)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: saving ? 'not-allowed' : 'pointer',
              clipPath: CUT_SM,
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 44,
              padding: '0 26px',
              position: 'relative',
              isolation: 'isolate',
              border: 0,
              background: 'transparent',
              color: 'var(--bg)',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--violet)',
                transform: 'translate(5px,0)',
                clipPath:
                  'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)',
                zIndex: -1,
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--gold)',
                clipPath:
                  'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)',
                zIndex: -1,
              }}
            />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicsModal;
