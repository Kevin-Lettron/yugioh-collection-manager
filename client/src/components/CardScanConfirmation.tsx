import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { ScanCandidate, ScanResult, VisionReading } from '../services/api';

/** Résumé lisible de ce que l'IA a lu sur la photo, pour comparaison visuelle. */
function readingSummary(reading?: VisionReading): string | null {
  if (!reading) return null;
  const parts: string[] = [];
  if (reading.nameAsPrinted) parts.push(`« ${reading.nameAsPrinted} »`);
  if (reading.cardKind) {
    const kind =
      reading.cardKind === 'Spell' ? 'Magie' : reading.cardKind === 'Trap' ? 'Piège' : 'Monstre';
    parts.push(reading.spellTrapType ? `${kind} ${reading.spellTrapType}` : kind);
  }
  if (reading.attribute) parts.push(reading.attribute);
  if (reading.level !== null) parts.push(`Niv.${reading.level}`);
  if (reading.atk !== null) {
    parts.push(
      reading.def !== null ? `ATK ${reading.atk} / DEF ${reading.def}` : `ATK ${reading.atk}`
    );
  }
  if (reading.code) parts.push(reading.code);
  return parts.length > 0 ? parts.join(' · ') : null;
}

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
  // Carte retenue quand l'utilisateur corrige le choix de l'IA parmi les alternatives.
  const [chosen, setChosen] = useState<ScanCandidate | null>(null);

  const activeCard = chosen?.card ?? scanResult.card;
  const activeCode = chosen?.code ?? scanResult.code;
  const activeImage = chosen?.officialImage ?? scanResult.officialImage;
  const activeLanguage = chosen?.detectedLanguage ?? scanResult.detectedLanguage;
  const rarities = (chosen?.availableRarities ?? scanResult.availableRarities) || ['Common'];

  const [rarity, setRarity] = useState(rarities[0]);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  const confidencePct = Math.round((scanResult.confidence || 0) * 100);
  const lowConfidence = (scanResult.confidence || 0) < 0.7;
  // Après correction manuelle, l'avertissement de l'IA n'a plus lieu d'être.
  const uncertain = !chosen && scanResult.verification?.status !== 'confirmed';
  const reading = readingSummary(scanResult.reading);
  const others = (scanResult.alternatives || []).filter(
    (c) => c.card?.card_id !== activeCard?.card_id
  );

  const selectCandidate = (candidate: ScanCandidate) => {
    setChosen(candidate);
    setRarity((candidate.availableRarities || ['Common'])[0]);
  };

  const handleAdd = async () => {
    if (!activeCode) {
      toast.error('Aucun code à ajouter');
      return;
    }
    setSaving(true);
    try {
      await api.post('/collection/cards/add', {
        card_code: activeCard?.card_id,
        set_code: activeCode,
        rarity,
        quantity,
        language: activeLanguage,
      });
      toast.success(`${activeCard?.name} ajouté à la collection !`);
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
          {/* Avertissement quand les signaux lus ne confirment pas la carte trouvée */}
          {uncertain && (
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm">
              <p className="font-semibold">⚠️ Vérifie que c'est bien ta carte</p>
              <p className="text-xs mt-1">
                {scanResult.verification?.mismatched?.length
                  ? `Incohérences détectées : ${scanResult.verification.mismatched.join(', ')}.`
                  : "Les indices lus sur la photo n'ont pas suffi à confirmer l'identification."}
              </p>
            </div>
          )}

          {/* Info carte */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-sm text-gray-600">Code détecté :</p>
            <p className="text-lg font-mono font-bold text-blue-600 break-all">{activeCode}</p>
            <p className="text-sm text-gray-600 mt-2">Nom :</p>
            <p className="text-base font-semibold text-gray-800 break-words">
              {activeCard?.name || scanResult.name}
            </p>
            {activeLanguage && (
              <p className="text-xs text-gray-500 mt-1">Langue détectée : {activeLanguage}</p>
            )}
          </div>

          {/* Ce que l'IA a lu sur la photo */}
          {reading && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500">Lu sur ta photo</p>
              <p className="text-sm text-gray-800 mt-1 break-words">{reading}</p>
            </div>
          )}

          {/* Autres pistes proposées par le recoupement */}
          {others.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Ce n'est pas la bonne carte ?</p>
              {others.map((c, i) => (
                <button
                  key={`${c.card?.card_id}-${c.code || i}`}
                  type="button"
                  onClick={() => selectCandidate(c)}
                  className="w-full flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  {c.officialImage && (
                    <img src={c.officialImage} alt={c.name} className="w-12 h-16 object-contain" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-800 truncate">{c.name}</span>
                    <span className="block text-xs text-gray-500">
                      {c.card?.type}
                      {c.code ? ` · ${c.code}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

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
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={activeCard?.name || scanResult.name}
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
