import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Deck, DeckCard } from '../../../shared/types';
import api from '../services/api';
import Button from '../components/ui/Button';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import HeroTitle from '../components/decor/HeroTitle';
import CardTile from '../components/decor/CardTile';
import { GlyphPyramid } from '../components/decor/Glyphs';

const DeckShare = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardDetail, setSelectedCardDetail] = useState<DeckCard | null>(null);

  useEffect(() => {
    if (shareToken) {
      fetchSharedDeck();
    }
  }, [shareToken]);

  const fetchSharedDeck = async () => {
    try {
      const response = await api.get(`/decks/shared/${shareToken}`);
      setDeck(response.data.deck);
    } catch (err: any) {
      console.error('Failed to fetch shared deck:', err);
      if (err.response?.status === 404) {
        setError('Ce lien de partage est invalide ou a expire.');
      } else {
        setError('Impossible de charger le deck partage.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Lien invalide</h2>
          <p className="text-gray-600 mb-6">{error || 'Ce deck n\'existe pas ou n\'est plus disponible.'}</p>
          <Button
            variant="primary"
            onClick={() => navigate('/login')}
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  const mainDeck = deck.main_deck || [];
  const extraDeck = deck.extra_deck || [];
  const mainDeckCount = mainDeck.reduce((sum, card) => sum + card.quantity, 0);
  const extraDeckCount = extraDeck.reduce((sum, card) => sum + card.quantity, 0);

  return (
    <div className="min-h-screen relative">
      <AppBackground />
      <CornerOrnaments />

      {/* Navigation - Guest version */}
      <nav
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background:
            'linear-gradient(180deg, rgba(11,8,19,0.85), rgba(11,8,19,0.55))',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <GlyphPyramid style={{ width: 24, height: 24, color: 'var(--gold)' }} />
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 900,
                  fontSize: 15,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text)',
                }}
              >
                Keit<span style={{ color: 'var(--gold)' }}>land</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif" }}>
                Mode Visiteur
              </span>
              <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                Se connecter
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with deck info */}
        <div
          className="cyber-panel p-6 mb-6"
          style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <HeroTitle
              kicker="— Vitrine ouverte —"
              title={deck.name}
              sub={`Créé par ${deck.user?.username || 'Utilisateur inconnu'}`}
            />
            <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
              {deck.is_public && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Public
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${deck.respect_banlist ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                {deck.respect_banlist ? 'Conforme Banlist' : 'Banlist ignoree'}
              </span>
            </div>
          </div>

          {/* Deck Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className="p-4 text-center cyber-cut-sm"
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm text-gray-500">Main Deck</p>
              <p className={`text-2xl font-bold ${mainDeckCount >= 40 && mainDeckCount <= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {mainDeckCount}
              </p>
              <p className="text-xs text-gray-400">/ 40-60 cartes</p>
            </div>
            <div
              className="p-4 text-center cyber-cut-sm"
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm text-gray-500">Extra Deck</p>
              <p className={`text-2xl font-bold ${extraDeckCount <= 15 ? 'text-green-600' : 'text-red-600'}`}>
                {extraDeckCount}
              </p>
              <p className="text-xs text-gray-400">/ 0-15 cartes</p>
            </div>
            <div
              className="p-4 text-center cyber-cut-sm"
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm text-gray-500">Likes</p>
              <p className="text-2xl font-bold text-green-600">{deck.likes_count || 0}</p>
            </div>
            <div
              className="p-4 text-center cyber-cut-sm"
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm text-gray-500">Commentaires</p>
              <p className="text-2xl font-bold text-blue-600">{deck.comments_count || 0}</p>
            </div>
          </div>
        </div>

        {/* Deck Lists */}
        <div className="space-y-6">
          {/* Main Deck */}
          <div
            className="cyber-panel p-6"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <h3 className="cyber-title mb-4">Deck Principal ({mainDeckCount} cartes)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {mainDeck.map((deckCard, i) => (
                <CardTile
                  key={deckCard.id}
                  uri={deckCard.card?.card_images?.[0]?.image_url_small}
                  name={deckCard.card?.name}
                  quantity={deckCard.quantity}
                  index={i}
                  onClick={() => setSelectedCardDetail(deckCard)}
                />
              ))}
            </div>
            {mainDeck.length === 0 && (
              <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Aucune carte dans le Deck Principal.
              </p>
            )}
          </div>

          {/* Extra Deck */}
          <div
            className="cyber-panel p-6"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <h3 className="cyber-title mb-4">Extra Deck ({extraDeckCount} cartes)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {extraDeck.map((deckCard, i) => (
                <CardTile
                  key={deckCard.id}
                  uri={deckCard.card?.card_images?.[0]?.image_url_small}
                  name={deckCard.card?.name}
                  quantity={deckCard.quantity}
                  index={i}
                  onClick={() => setSelectedCardDetail(deckCard)}
                />
              ))}
            </div>
            {extraDeck.length === 0 && (
              <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Aucune carte dans l'Extra Deck.
              </p>
            )}
          </div>
        </div>

        {/* Call to action */}
        <div
          className="mt-8 cyber-panel cyber-panel--glow p-8 text-center"
          style={{ background: 'var(--panel)', border: '1px solid var(--gold-dim)' }}
        >
          <HeroTitle
            kicker="— Rejoins-nous —"
            title="Ta propre vitrine t'attend"
            sub="Inscris-toi gratuitement pour créer tes propres decks et gérer ta collection."
            className="text-center"
          />
          <div className="mt-6">
            <Button
              variant="primary"
              size="lg"
              glitch
              onClick={() => navigate('/register')}
            >
              S'inscrire gratuitement
            </Button>
          </div>
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCardDetail && selectedCardDetail.card && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCardDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-2xl font-bold text-gray-800">
                {selectedCardDetail.card.name}
              </h3>
              <button
                onClick={() => setSelectedCardDetail(null)}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Card Image */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <img
                    src={selectedCardDetail.card.card_images?.[0]?.image_url || '/placeholder-card.png'}
                    alt={selectedCardDetail.card.name}
                    className="w-64 h-auto rounded-lg shadow-lg"
                  />
                </div>

                {/* Card Info */}
                <div className="flex-1 space-y-4">
                  {/* Type & Attribute Row */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {selectedCardDetail.card.type}
                    </span>
                    {selectedCardDetail.card.attribute && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedCardDetail.card.attribute === 'DARK' ? 'bg-gray-800 text-white' :
                        selectedCardDetail.card.attribute === 'LIGHT' ? 'bg-yellow-100 text-yellow-800' :
                        selectedCardDetail.card.attribute === 'FIRE' ? 'bg-red-100 text-red-800' :
                        selectedCardDetail.card.attribute === 'WATER' ? 'bg-blue-100 text-blue-800' :
                        selectedCardDetail.card.attribute === 'EARTH' ? 'bg-amber-100 text-amber-800' :
                        selectedCardDetail.card.attribute === 'WIND' ? 'bg-green-100 text-green-800' :
                        selectedCardDetail.card.attribute === 'DIVINE' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedCardDetail.card.attribute}
                      </span>
                    )}
                    {selectedCardDetail.card.race && (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                        {selectedCardDetail.card.race}
                      </span>
                    )}
                  </div>

                  {/* Monster Stats */}
                  {(selectedCardDetail.card.level !== undefined ||
                    selectedCardDetail.card.linkval !== undefined ||
                    selectedCardDetail.card.atk !== undefined) && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      {selectedCardDetail.card.level !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500 text-lg">&#9733;</span>
                          <span className="font-medium">Niveau {selectedCardDetail.card.level}</span>
                        </div>
                      )}
                      {selectedCardDetail.card.linkval !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-500 font-bold">LIEN-{selectedCardDetail.card.linkval}</span>
                        </div>
                      )}
                      {selectedCardDetail.card.scale !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-teal-600 font-medium">Echelle : {selectedCardDetail.card.scale}</span>
                        </div>
                      )}
                      {selectedCardDetail.card.atk !== undefined && (
                        <div className="font-medium">
                          <span className="text-red-600">ATK</span> {selectedCardDetail.card.atk}
                        </div>
                      )}
                      {selectedCardDetail.card.def !== undefined && (
                        <div className="font-medium">
                          <span className="text-blue-600">DEF</span> {selectedCardDetail.card.def}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Link Markers */}
                  {selectedCardDetail.card.linkmarkers && selectedCardDetail.card.linkmarkers.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Fleches Lien : </span>
                      <span className="text-gray-600">
                        {selectedCardDetail.card.linkmarkers.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Archetype */}
                  {selectedCardDetail.card.archetype && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Archetype : </span>
                      <span className="text-gray-600">{selectedCardDetail.card.archetype}</span>
                    </div>
                  )}

                  {/* Card Description/Effect */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Texte de la carte</h4>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedCardDetail.card.description}
                    </p>
                  </div>

                  {/* Banlist Info */}
                  {selectedCardDetail.card.banlist_info && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCardDetail.card.banlist_info.ban_tcg && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          selectedCardDetail.card.banlist_info.ban_tcg === 'Banned' ? 'bg-red-100 text-red-800' :
                          selectedCardDetail.card.banlist_info.ban_tcg === 'Limited' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          TCG: {selectedCardDetail.card.banlist_info.ban_tcg}
                        </span>
                      )}
                      {selectedCardDetail.card.banlist_info.ban_ocg && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          selectedCardDetail.card.banlist_info.ban_ocg === 'Banned' ? 'bg-red-100 text-red-800' :
                          selectedCardDetail.card.banlist_info.ban_ocg === 'Limited' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          OCG: {selectedCardDetail.card.banlist_info.ban_ocg}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity in deck */}
              <div className="mt-6 pt-6 border-t">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Quantite dans ce deck</p>
                  <p className="text-2xl font-bold text-blue-600">x{selectedCardDetail.quantity}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setSelectedCardDetail(null)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckShare;
