import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Deck, DeckCard, UserCard, CardLanguage } from '../../../shared/types';
import api from '../services/api';

const LANGUAGE_LABELS: Record<CardLanguage, string> = {
  EN: 'Anglais',
  FR: 'Francais',
  DE: 'Allemand',
  IT: 'Italien',
  PT: 'Portugais',
  SP: 'Espagnol',
  JP: 'Japonais',
  KR: 'Coreen',
};

const DeckShare = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Lien invalide</h2>
          <p className="text-gray-600 mb-6">{error || 'Ce deck n\'existe pas ou n\'est plus disponible.'}</p>
          <Link
            to="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const mainDeck = deck.main_deck || [];
  const extraDeck = deck.extra_deck || [];
  const mainDeckCount = mainDeck.reduce((sum, card) => sum + card.quantity, 0);
  const extraDeckCount = extraDeck.reduce((sum, card) => sum + card.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation - Guest version */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">YuGiOh Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-500 text-sm">Mode Visiteur</span>
              <Link
                to="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with deck info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">{deck.name}</h2>
              <p className="text-gray-600 mt-1">
                Cree par <span className="font-semibold">{deck.user?.username || 'Utilisateur inconnu'}</span>
              </p>
            </div>
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
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Main Deck</p>
              <p className={`text-2xl font-bold ${mainDeckCount >= 40 && mainDeckCount <= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {mainDeckCount}
              </p>
              <p className="text-xs text-gray-400">/ 40-60 cartes</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Extra Deck</p>
              <p className={`text-2xl font-bold ${extraDeckCount <= 15 ? 'text-green-600' : 'text-red-600'}`}>
                {extraDeckCount}
              </p>
              <p className="text-xs text-gray-400">/ 0-15 cartes</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Likes</p>
              <p className="text-2xl font-bold text-green-600">{deck.likes_count || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Commentaires</p>
              <p className="text-2xl font-bold text-blue-600">{deck.comments_count || 0}</p>
            </div>
          </div>
        </div>

        {/* Deck Lists */}
        <div className="space-y-6">
          {/* Main Deck */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Deck Principal ({mainDeckCount} cartes)
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {mainDeck.map((deckCard) => (
                <div key={deckCard.id} className="relative group">
                  <img
                    src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                    alt={deckCard.card?.name}
                    className="w-full h-auto rounded shadow cursor-pointer hover:opacity-90 transition"
                    onClick={() => setSelectedCardDetail(deckCard)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-1">
                    <p className="text-[10px] font-semibold truncate">{deckCard.card?.name}</p>
                    <p className="text-[10px] text-center font-bold">x{deckCard.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            {mainDeck.length === 0 && (
              <p className="text-center text-gray-600 py-8">
                Aucune carte dans le Deck Principal.
              </p>
            )}
          </div>

          {/* Extra Deck */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Extra Deck ({extraDeckCount} cartes)
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {extraDeck.map((deckCard) => (
                <div key={deckCard.id} className="relative group">
                  <img
                    src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                    alt={deckCard.card?.name}
                    className="w-full h-auto rounded shadow cursor-pointer hover:opacity-90 transition"
                    onClick={() => setSelectedCardDetail(deckCard)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-1">
                    <p className="text-[10px] font-semibold truncate">{deckCard.card?.name}</p>
                    <p className="text-[10px] text-center font-bold">x{deckCard.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            {extraDeck.length === 0 && (
              <p className="text-center text-gray-600 py-8">
                Aucune carte dans l'Extra Deck.
              </p>
            )}
          </div>
        </div>

        {/* Call to action */}
        <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-2">Creez votre propre collection !</h3>
          <p className="mb-4 opacity-90">Inscrivez-vous gratuitement pour creer vos propres decks et gerer votre collection Yu-Gi-Oh.</p>
          <Link
            to="/register"
            className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-gray-100 transition font-semibold"
          >
            S'inscrire gratuitement
          </Link>
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
                <button
                  onClick={() => setSelectedCardDetail(null)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckShare;
