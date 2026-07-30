import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { ScanResult } from '../services/api';

interface CardScanConfirmationProps {
  scanResult: ScanResult;
  userPhotoUrl: string;
  onConfirmed: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const CardScanConfirmation = ({
  scanResult,
  userPhotoUrl,
  onConfirmed,
  onRetry,
  onClose,
}: CardScanConfirmationProps) => {
  const rarities = scanResult.availableRarities || ['Common'];
  const [rarity, setRarity] = useState(rarities[0]);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  const confidencePct = Math.round((scanResult.confidence || 0) * 100);
  const lowConfidence = (scanResult.confidence || 0) < 0.7;

  const handleAdd = async () => {
    if (!scanResult.code) {
      toast.error('Aucun code à ajouter');
      return;
    }
    setSaving(true);
    try {
      await api.post('/collection/cards/add', {
        card_code: scanResult.card?.card_id,
        set_code: scanResult.code,
        rarity,
        quantity,
        language: scanResult.detectedLanguage,
      });
      toast.success(`${scanResult.name} ajouté à la collection !`);
      onConfirmed();
    } catch (err: any) {
      const message = err?.response?.data?.error || "Erreur lors de l'ajout";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h3 className="text-xl font-bold text-gray-800">Carte détectée</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Info carte */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-sm text-gray-600">Code détecté :</p>
            <p className="text-lg font-mono font-bold text-blue-600 break-all">
              {scanResult.code}
            </p>
            <p className="text-sm text-gray-600 mt-2">Nom :</p>
            <p className="text-base font-semibold text-gray-800 break-words">
              {scanResult.name}
            </p>
            {scanResult.detectedLanguage && (
              <p className="text-xs text-gray-500 mt-1">
                Langue détectée : {scanResult.detectedLanguage}
              </p>
            )}
          </div>

          {/* Confiance */}
          <div
            className={`rounded-lg p-3 text-sm ${
              lowConfidence
                ? 'bg-orange-50 text-orange-800 border border-orange-200'
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}
          >
            <p className="font-medium">
              Confiance IA : {confidencePct}%
              {lowConfidence && ' — vérifie que c\'est bien la bonne carte !'}
            </p>
            {scanResult.notes && (
              <p className="text-xs mt-1 italic">{scanResult.notes}</p>
            )}
          </div>

          {/* Comparaison photos */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Comparaison :</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1 text-center">Ta photo</p>
                <img
                  src={userPhotoUrl}
                  alt="Photo scannée"
                  className="w-full rounded border border-gray-200 object-contain max-h-48"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1 text-center">Image officielle</p>
                {scanResult.officialImage ? (
                  <img
                    src={scanResult.officialImage}
                    alt={scanResult.name}
                    className="w-full rounded border border-gray-200 object-contain max-h-48"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                    Pas d'image
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rareté */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rareté <span className="text-red-500">*</span>
            </label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Raretés disponibles pour ce code (selon YGOProDeck).
            </p>
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité</label>
            <input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Boutons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={onRetry}
              disabled={saving}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50"
            >
              Pas la bonne carte
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-green-400"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Ajout…</span>
                </>
              ) : (
                'Ajouter à ma collection'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardScanConfirmation;
