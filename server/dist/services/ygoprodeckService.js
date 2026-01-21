"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YGOProDeckService = void 0;
const axios_1 = __importDefault(require("axios"));
const API_BASE_URL = process.env.YGOPRODECK_API_URL || 'https://db.ygoprodeck.com/api/v7';
// Cache for card sets to avoid repeated API calls
let cardSetsCache = null;
let cardSetsCacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
class YGOProDeckService {
    /**
     * Get all card sets from API (cached)
     */
    static async getCardSets() {
        const now = Date.now();
        if (cardSetsCache && (now - cardSetsCacheTime) < CACHE_TTL) {
            return cardSetsCache;
        }
        try {
            const response = await axios_1.default.get(`${API_BASE_URL}/cardsets.php`);
            if (response.data) {
                cardSetsCache = response.data;
                cardSetsCacheTime = now;
                return response.data;
            }
            return [];
        }
        catch (error) {
            console.error('Error fetching card sets:', error);
            return cardSetsCache || [];
        }
    }
    /**
     * Get set name from set code prefix
     * Example: "LDK2" -> "Legendary Decks II"
     */
    static async getSetNameFromCode(setCodePrefix) {
        const sets = await this.getCardSets();
        const matchingSet = sets.find((s) => s.set_code.toLowerCase() === setCodePrefix.toLowerCase());
        return matchingSet?.set_name || null;
    }
    /**
     * Detect language from set code
     * Example: LDK2-FRK40 -> 'FR', LOB-EN001 -> 'EN', LOB-001 -> 'EN' (default)
     */
    static detectLanguageFromSetCode(setCode) {
        // Pattern: XXXX-XXnnn where XX is the language code
        const match = setCode.match(/^[A-Z0-9]+-([A-Z]{2})[A-Z]?\d+$/i);
        if (match) {
            const langCode = match[1].toUpperCase();
            return this.LANGUAGE_CODES[langCode] || 'EN';
        }
        // Default to English if no language code detected
        return 'EN';
    }
    /**
     * Convert localized set codes to English format
     * French: LDK2-FRK40 -> LDK2-ENK40
     * German: LDK2-DEK40 -> LDK2-ENK40
     * Italian: LDK2-ITK40 -> LDK2-ENK40
     * Portuguese: LDK2-PTK40 -> LDK2-ENK40
     * Spanish: LDK2-SPK40 -> LDK2-ENK40
     */
    static normalizeSetCode(setCode) {
        // Language code patterns: FR, DE, IT, PT, SP -> EN
        const languageCodes = ['FR', 'DE', 'IT', 'PT', 'SP'];
        let normalized = setCode;
        for (const lang of languageCodes) {
            // Pattern: XXXX-FRYnn -> XXXX-ENYnn (where Y is optional letter, nn is number)
            const regex = new RegExp(`^([A-Z0-9]+)-${lang}([A-Z]?)(\\d+)$`, 'i');
            const match = normalized.match(regex);
            if (match) {
                normalized = `${match[1]}-EN${match[2]}${match[3]}`.toUpperCase();
                break;
            }
        }
        return normalized;
    }
    /**
     * Fetch card by set code using the cardset endpoint
     * Example: LDK2-FRK40 -> extracts set name "Legendary Decks II" and searches
     * Supports French, German, Italian, Portuguese, Spanish card codes
     */
    static async getCardBySetCode(setCode) {
        try {
            // Extract set prefix (e.g., "LDK2" from "LDK2-FRK40")
            const setPrefix = setCode.split('-')[0];
            // Get the full set name from the prefix
            const setName = await this.getSetNameFromCode(setPrefix);
            if (!setName) {
                // Try to find similar set codes for suggestion
                const sets = await this.getCardSets();
                const similar = sets
                    .filter(s => s.set_code.startsWith(setPrefix.substring(0, 2)))
                    .slice(0, 5)
                    .map(s => s.set_code);
                const suggestion = similar.length > 0
                    ? ` Sets similaires : ${similar.join(', ')}`
                    : '';
                return {
                    card: null,
                    error: `Set "${setPrefix}" non trouvé dans la base de données.${suggestion}`
                };
            }
            // Normalize the set code to English format for comparison
            const normalizedSetCode = this.normalizeSetCode(setCode);
            // Search for cards in this set by name
            const response = await axios_1.default.get(`${API_BASE_URL}/cardinfo.php`, {
                params: {
                    cardset: setName,
                    misc: 'yes',
                },
            });
            if (response.data && response.data.data) {
                const cards = response.data.data;
                // Find the exact card by full set code (try both original and normalized)
                const card = cards.find((c) => {
                    if (c.card_sets) {
                        return c.card_sets.some((set) => {
                            const apiSetCode = set.set_code.toLowerCase();
                            return (apiSetCode === setCode.toLowerCase() ||
                                apiSetCode === normalizedSetCode.toLowerCase());
                        });
                    }
                    return false;
                });
                if (card) {
                    return { card: this.transformCard(card) };
                }
                // Card not found with this exact set code in this set
                return {
                    card: null,
                    error: `Code "${setCode}" non trouvé dans le set "${setName}". Vérifiez le numéro de carte.`
                };
            }
            return { card: null };
        }
        catch (error) {
            console.error('Error fetching card by set code:', error);
            return { card: null };
        }
    }
    /**
     * Search card by either Card ID or Set Code
     * Intelligently detects which type of search to perform
     * Returns card, set info, and detected language
     */
    static async searchByCodeOrSetCode(code) {
        const trimmedCode = code.trim();
        // Check if it looks like a set code (contains a dash like "LDK2-FRK40")
        if (trimmedCode.includes('-')) {
            const detectedLanguage = this.detectLanguageFromSetCode(trimmedCode);
            const result = await this.getCardBySetCode(trimmedCode);
            if (result.card) {
                // Find the specific set info for this set code (try normalized version for API match)
                const normalizedCode = this.normalizeSetCode(trimmedCode);
                const setInfo = result.card.card_sets?.find((s) => s.set_code.toLowerCase() === normalizedCode.toLowerCase());
                return {
                    card: result.card,
                    setInfo: setInfo || null,
                    detectedLanguage,
                    originalSetCode: trimmedCode.toUpperCase()
                };
            }
            return {
                card: null,
                setInfo: null,
                detectedLanguage,
                originalSetCode: trimmedCode.toUpperCase(),
                error: result.error
            };
        }
        // Otherwise, assume it's a card ID (numeric)
        if (/^\d+$/.test(trimmedCode)) {
            const card = await this.getCardById(trimmedCode);
            return { card, setInfo: null, detectedLanguage: 'EN', originalSetCode: '' };
        }
        // If neither, try both approaches
        // First try as card ID
        const cardById = await this.getCardById(trimmedCode);
        if (cardById) {
            return { card: cardById, setInfo: null, detectedLanguage: 'EN', originalSetCode: '' };
        }
        // Then try as set code
        const detectedLanguage = this.detectLanguageFromSetCode(trimmedCode);
        const result = await this.getCardBySetCode(trimmedCode);
        if (result.card) {
            const normalizedCode = this.normalizeSetCode(trimmedCode);
            const setInfo = result.card.card_sets?.find((s) => s.set_code.toLowerCase() === normalizedCode.toLowerCase());
            return {
                card: result.card,
                setInfo: setInfo || null,
                detectedLanguage,
                originalSetCode: trimmedCode.toUpperCase()
            };
        }
        return {
            card: null,
            setInfo: null,
            detectedLanguage: 'EN',
            originalSetCode: '',
            error: result.error
        };
    }
    /**
     * Fetch card by name
     */
    static async getCardByName(name) {
        try {
            const response = await axios_1.default.get(`${API_BASE_URL}/cardinfo.php`, {
                params: {
                    name: name,
                    misc: 'yes',
                },
            });
            if (response.data && response.data.data && response.data.data.length > 0) {
                return this.transformCard(response.data.data[0]);
            }
            return null;
        }
        catch (error) {
            console.error('Error fetching card by name:', error);
            return null;
        }
    }
    /**
     * Fetch card by YGOProDeck ID
     */
    static async getCardById(id) {
        try {
            const response = await axios_1.default.get(`${API_BASE_URL}/cardinfo.php`, {
                params: {
                    id: id,
                    misc: 'yes',
                },
            });
            if (response.data && response.data.data && response.data.data.length > 0) {
                return this.transformCard(response.data.data[0]);
            }
            return null;
        }
        catch (error) {
            console.error('Error fetching card by ID:', error);
            return null;
        }
    }
    /**
     * Search cards by query
     */
    static async searchCards(query, limit = 20) {
        try {
            const response = await axios_1.default.get(`${API_BASE_URL}/cardinfo.php`, {
                params: {
                    fname: query,
                    misc: 'yes',
                },
            });
            if (response.data && response.data.data) {
                return response.data.data
                    .slice(0, limit)
                    .map((card) => this.transformCard(card));
            }
            return [];
        }
        catch (error) {
            console.error('Error searching cards:', error);
            return [];
        }
    }
    /**
     * Get rarities available for a specific set code
     */
    static getRaritiesForSetCode(card, setCode) {
        if (!card.card_sets)
            return [];
        const sets = card.card_sets.filter((set) => set.set_code.toLowerCase() === setCode.toLowerCase());
        return sets.map((set) => set.set_rarity);
    }
    /**
     * Transform YGOProDeck API response to our Card type
     */
    static transformCard(apiCard) {
        return {
            id: 0, // Will be set by database
            card_id: apiCard.id.toString(),
            name: apiCard.name,
            type: apiCard.type,
            frame_type: apiCard.frameType,
            description: apiCard.desc,
            atk: apiCard.atk,
            def: apiCard.def,
            level: apiCard.level,
            race: apiCard.race,
            attribute: apiCard.attribute,
            archetype: apiCard.archetype,
            card_sets: apiCard.card_sets?.map(set => ({
                set_name: set.set_name,
                set_code: set.set_code,
                set_rarity: set.set_rarity,
                set_rarity_code: set.set_rarity_code,
                set_price: set.set_price,
            })),
            card_images: apiCard.card_images?.map(img => ({
                id: img.id,
                image_url: img.image_url,
                image_url_small: img.image_url_small,
                image_url_cropped: img.image_url_cropped,
            })),
            card_prices: apiCard.card_prices,
            banlist_info: apiCard.banlist_info ? {
                ban_tcg: apiCard.banlist_info.ban_tcg,
                ban_ocg: apiCard.banlist_info.ban_ocg,
                ban_goat: apiCard.banlist_info.ban_goat,
            } : undefined,
            linkval: apiCard.linkval,
            linkmarkers: apiCard.linkmarkers,
            scale: apiCard.scale,
            created_at: new Date(),
            updated_at: new Date(),
        };
    }
    /**
     * Check if a card is in extra deck based on frame type
     */
    static isExtraDeckCard(frameType) {
        const extraDeckTypes = ['fusion', 'synchro', 'xyz', 'link'];
        return extraDeckTypes.includes(frameType.toLowerCase());
    }
    /**
     * Get banlist limit for a card (for TCG format)
     */
    static getBanlistLimit(card) {
        if (!card.banlist_info?.ban_tcg) {
            return 3; // No restriction
        }
        switch (card.banlist_info.ban_tcg) {
            case 'Banned':
                return 0;
            case 'Limited':
                return 1;
            case 'Semi-Limited':
                return 2;
            default:
                return 3;
        }
    }
}
exports.YGOProDeckService = YGOProDeckService;
/**
 * Language codes mapping for Yu-Gi-Oh cards
 */
YGOProDeckService.LANGUAGE_CODES = {
    'EN': 'EN', // English
    'FR': 'FR', // French
    'DE': 'DE', // German
    'IT': 'IT', // Italian
    'PT': 'PT', // Portuguese
    'SP': 'SP', // Spanish
    'JP': 'JP', // Japanese
    'JA': 'JP', // Japanese (alternate)
    'KR': 'KR', // Korean
    'KO': 'KR', // Korean (alternate)
};
