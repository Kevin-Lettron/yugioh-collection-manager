import Anthropic from '@anthropic-ai/sdk';
import { Card, UserCard } from '../../../shared/types';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Rate limiting for API calls
let apiCallCount = 0;
const maxApiCalls = parseInt(process.env.CLAUDE_API_MAX_CALLS || '5', 10);

export function getApiCallCount(): number {
  return apiCallCount;
}

export function getMaxApiCalls(): number {
  return maxApiCalls;
}

export function getRemainingCalls(): number {
  return Math.max(0, maxApiCalls - apiCallCount);
}

export function resetApiCallCount(): void {
  apiCallCount = 0;
}

interface AIDeckResponse {
  mainDeck: {
    cardId: number;
    cardName: string;
    quantity: number;
    reason: string;
  }[];
  extraDeck: {
    cardId: number;
    cardName: string;
    quantity: number;
    reason: string;
  }[];
  suggestions: {
    cardName: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  explanation: string;
}

// Normalized response for frontend
interface NormalizedAIDeckResponse {
  selectedCards: {
    cardId: number;
    cardName: string;
    quantity: number;
    isExtraDeck: boolean;
    reason: string;
  }[];
  suggestions: {
    cardName: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  explanation: string;
}

// Extra deck card types
const EXTRA_DECK_TYPES = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster'];

function isExtraDeckCard(type: string): boolean {
  return EXTRA_DECK_TYPES.includes(type);
}

interface CardInfo {
  id: number;
  name: string;
  type: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  race?: string;
  description?: string;
  archetype?: string;
  availableQuantity: number;
  isExtraDeck: boolean;
}

export async function buildDeckWithAI(
  userCards: UserCard[],
  prompt: string,
  existingMainDeck?: { cardId: number; cardName: string; quantity: number }[],
  existingExtraDeck?: { cardId: number; cardName: string; quantity: number }[]
): Promise<NormalizedAIDeckResponse> {
  // Group cards by card ID and sum quantities (user may have same card from different sets)
  const cardMap = new Map<number, CardInfo>();

  for (const uc of userCards) {
    if (!uc.card) continue;

    const existing = cardMap.get(uc.card.id);
    if (existing) {
      existing.availableQuantity += uc.quantity;
    } else {
      cardMap.set(uc.card.id, {
        id: uc.card.id,
        name: uc.card.name,
        type: uc.card.type,
        attribute: uc.card.attribute,
        level: uc.card.level,
        atk: uc.card.atk,
        def: uc.card.def,
        race: uc.card.race,
        description: uc.card.description,
        archetype: uc.card.archetype,
        availableQuantity: uc.quantity,
        isExtraDeck: isExtraDeckCard(uc.card.type),
      });
    }
  }

  // Separate main deck and extra deck cards
  const mainDeckCards: CardInfo[] = [];
  const extraDeckCards: CardInfo[] = [];

  cardMap.forEach(card => {
    // Cap available quantity at 3 (deck building rule)
    card.availableQuantity = Math.min(card.availableQuantity, 3);

    if (card.isExtraDeck) {
      extraDeckCards.push(card);
    } else {
      mainDeckCards.push(card);
    }
  });

  // Build existing deck context with card names
  let existingDeckContext = '';
  if (existingMainDeck && existingMainDeck.length > 0) {
    const mainDeckStr = existingMainDeck
      .map(c => `- ${c.cardName} (ID: ${c.cardId}) x${c.quantity}`)
      .join('\n');
    const extraDeckStr = existingExtraDeck && existingExtraDeck.length > 0
      ? existingExtraDeck.map(c => `- ${c.cardName} (ID: ${c.cardId}) x${c.quantity}`).join('\n')
      : 'Vide';

    existingDeckContext = `

=== DECK ACTUEL À OPTIMISER ===
Main Deck actuel (${existingMainDeck.reduce((s, c) => s + c.quantity, 0)} cartes):
${mainDeckStr}

Extra Deck actuel (${existingExtraDeck?.reduce((s, c) => s + c.quantity, 0) || 0} cartes):
${extraDeckStr}

Tu dois REMPLACER ce deck par une version optimisée. Tu peux garder, retirer ou ajouter des cartes.`;
  }

  // Format cards for better readability
  const formatCard = (c: CardInfo) => {
    let info = `ID:${c.id} | "${c.name}" | ${c.type}`;
    if (c.attribute) info += ` | ${c.attribute}`;
    if (c.level !== undefined) info += ` | Niv.${c.level}`;
    if (c.atk !== undefined) info += ` | ATK:${c.atk}`;
    if (c.def !== undefined) info += ` DEF:${c.def}`;
    if (c.race) info += ` | ${c.race}`;
    if (c.archetype) info += ` | Archetype: ${c.archetype}`;
    info += ` | DISPO: x${c.availableQuantity}`;
    return info;
  };

  const mainDeckCardsStr = mainDeckCards.map(formatCard).join('\n');
  const extraDeckCardsStr = extraDeckCards.length > 0
    ? extraDeckCards.map(formatCard).join('\n')
    : 'Aucune carte Extra Deck dans la collection';

  // Calculate total available main deck cards
  const totalAvailableMainDeckCards = mainDeckCards.reduce((sum, c) => sum + c.availableQuantity, 0);

  const systemPrompt = `Tu es un maître deck-builder Yu-Gi-Oh! Tu construis des decks COMPLETS, SYNERGIQUES et JOUABLES.

=== OBJECTIF PRINCIPAL ===
Créer un deck de 40-45 cartes EXACTEMENT, entièrement cohérent avec la demande de l'utilisateur.
Chaque carte doit avoir une RAISON d'être dans le deck - pas de remplissage aléatoire.

=== RÈGLES OBLIGATOIRES ===
1. Main Deck: EXACTEMENT 40-45 cartes (sum des quantity = 40-45)
2. Extra Deck: 0-15 cartes max (monstres Fusion/Synchro/Xyz/Link)
3. Max 3 copies par carte, ne dépasse JAMAIS la quantité DISPO
4. Utilise UNIQUEMENT les cardId de la collection fournie

=== MÉTHODE DE CONSTRUCTION (suis ces étapes) ===

**ÉTAPE 1 - CŒUR DU DECK (12-18 cartes)**
- Identifie les cartes ESSENTIELLES du thème demandé
- Mets quantity: 3 pour chaque carte clé (boss monsters, searchers, enablers)

**ÉTAPE 2 - SUPPORT DU THÈME (8-12 cartes)**
- Cartes qui supportent la stratégie principale
- Mets quantity: 2-3 selon l'importance

**ÉTAPE 3 - MOTEUR DE PIOCHE/RECHERCHE (4-6 cartes)**
- Pot of Duality, Trade-In, Cards of Consonance, etc.
- Cartes qui améliorent la consistance

**ÉTAPE 4 - PROTECTION ET CONTRÔLE (8-12 cartes)**
- Pièges: Mirror Force, Magic Cylinder, Call of the Haunted, etc.
- Magies: Harpie's Feather Duster, Mystical Space Typhoon, etc.
- Choisis des cartes qui PROTÈGENT ta stratégie

**ÉTAPE 5 - VÉRIFICATION ET AJUSTEMENT**
- Compte le total: doit être entre 40 et 45
- Si < 40: ajoute des cartes de protection ou support PERTINENTES
- Si > 45: retire les cartes les moins synergiques

=== IMPORTANT: PERTINENCE ===
Chaque carte ajoutée doit avoir un LIEN avec la stratégie:
- Pour un deck Dragon: ajoute des cartes qui supportent les Dragons
- Pour un deck Magicien: ajoute des cartes qui supportent les Spellcasters
- Les cartes génériques (Mirror Force, MST) sont OK car elles protègent N'IMPORTE quelle stratégie

=== FORMAT JSON ===
{
  "mainDeck": [
    {"cardId": [ID], "cardName": "[NOM]", "quantity": [1-3], "reason": "[POURQUOI CETTE CARTE]"}
  ],
  "extraDeck": [...],
  "suggestions": [{"cardName": "[CARTE À ACHETER]", "reason": "[POURQUOI]", "priority": "high|medium|low"}],
  "explanation": "[STRATÉGIE COMPLÈTE DU DECK]",
  "totalMainDeckCards": [TOTAL EXACT]
}

=== AVANT DE RÉPONDRE ===
1. Calcule: sum(mainDeck[*].quantity) = ?
2. Ce total DOIT être entre 40 et 45
3. Vérifie que chaque carte a une raison pertinente

Réponds UNIQUEMENT avec le JSON.`;

  const userMessage = `=== MA COLLECTION (${mainDeckCards.length} cartes uniques, ${totalAvailableMainDeckCards} copies au total) ===

${mainDeckCardsStr}

=== EXTRA DECK DISPONIBLE ===
${extraDeckCardsStr}
${existingDeckContext}

=== MA DEMANDE ===
${prompt}

=== RAPPEL ===
- Construis un deck de 40-45 cartes EXACTEMENT
- Utilise quantity: 3 pour les cartes clés, 2 pour le support, 1 pour les tech
- Chaque carte doit être PERTINENTE pour la stratégie demandée
- N'oublie pas les cartes de protection (pièges, removal)
- Inclus "totalMainDeckCards" avec le total exact dans ta réponse`;

  try {
    // Check rate limit before making API call
    if (apiCallCount >= maxApiCalls) {
      throw new Error(`Limite d'appels API atteinte (${maxApiCalls}/${maxApiCalls}). Contactez l'administrateur pour réinitialiser le compteur.`);
    }

    // Increment call counter
    apiCallCount++;
    console.log(`Claude API call ${apiCallCount}/${maxApiCalls}`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    console.log('Claude raw response (first 1000 chars):', textContent.text.substring(0, 1000));
    console.log('Claude raw response (last 500 chars):', textContent.text.substring(textContent.text.length - 500));

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const result: AIDeckResponse = JSON.parse(jsonMatch[0]);

    // Log what Claude actually returned
    const totalMainQuantity = (result.mainDeck || []).reduce((sum, c) => sum + (c.quantity || 1), 0);
    const totalExtraQuantity = (result.extraDeck || []).reduce((sum, c) => sum + (c.quantity || 1), 0);
    console.log(`Claude returned: Main deck ${result.mainDeck?.length || 0} entries totaling ${totalMainQuantity} cards`);
    console.log(`Claude returned: Extra deck ${result.extraDeck?.length || 0} entries totaling ${totalExtraQuantity} cards`);

    // Show first 5 cards with their quantities
    console.log('First 5 main deck cards from Claude:',
      (result.mainDeck || []).slice(0, 5).map(c => `${c.cardName} x${c.quantity}`)
    );

    // Validate and fix the response
    const validated = validateAndFixDeckResponse(result, cardMap);

    return validated;
  } catch (error: any) {
    console.error('Claude API error:', error);
    throw new Error(`Erreur lors de la génération du deck: ${error.message}`);
  }
}

function validateAndFixDeckResponse(
  response: AIDeckResponse,
  availableCards: Map<number, CardInfo>
): NormalizedAIDeckResponse {
  console.log('\n========================================');
  console.log('=== VALIDATE AND FIX DECK RESPONSE ===');
  console.log('========================================');
  console.log('Available cards in collection:', availableCards.size);

  // Track cards by ID to merge duplicates
  const mainDeckById = new Map<number, { cardId: number; cardName: string; quantity: number; reason: string }>();
  const extraDeckById = new Map<number, { cardId: number; cardName: string; quantity: number; reason: string }>();

  // Track total by card NAME (for the 3-copy rule across all versions of the same card)
  const cardNameCount = new Map<string, number>();

  console.log('Processing AI response - Main deck entries:', response.mainDeck?.length || 0);
  console.log('Processing AI response - Extra deck entries:', response.extraDeck?.length || 0);

  // First pass: merge duplicates and collect all cards by ID
  for (const card of response.mainDeck || []) {
    const available = availableCards.get(card.cardId);
    if (!available) {
      console.warn(`Card ID ${card.cardId} (${card.cardName}) not found in collection, skipping`);
      continue;
    }

    // Skip if it's actually an extra deck card
    if (available.isExtraDeck) {
      console.warn(`Card ${available.name} is an Extra Deck card, skipping from main deck`);
      continue;
    }

    // Merge with existing entry for same card ID
    const existing = mainDeckById.get(card.cardId);
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      mainDeckById.set(card.cardId, {
        cardId: card.cardId,
        cardName: available.name,
        quantity: card.quantity,
        reason: card.reason || '',
      });
    }
  }

  for (const card of response.extraDeck || []) {
    const available = availableCards.get(card.cardId);
    if (!available) {
      console.warn(`Card ID ${card.cardId} (${card.cardName}) not found in collection, skipping`);
      continue;
    }

    // Skip if it's not an extra deck card
    if (!available.isExtraDeck) {
      console.warn(`Card ${available.name} is not an Extra Deck card, skipping from extra deck`);
      continue;
    }

    // Merge with existing entry for same card ID
    const existing = extraDeckById.get(card.cardId);
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      extraDeckById.set(card.cardId, {
        cardId: card.cardId,
        cardName: available.name,
        quantity: card.quantity,
        reason: card.reason || '',
      });
    }
  }

  console.log('After merge - Unique main deck cards:', mainDeckById.size);
  console.log('After merge - Unique extra deck cards:', extraDeckById.size);

  // Second pass: apply rules and limits
  const validMainDeck: NormalizedAIDeckResponse['selectedCards'] = [];
  let mainDeckTotal = 0;

  for (const [cardId, card] of mainDeckById) {
    const available = availableCards.get(cardId)!;

    // Get current count for this card name (across all card IDs with same name)
    const nameCount = cardNameCount.get(available.name) || 0;

    // Calculate max allowed: min of (3 - already used, available in collection)
    const maxByName = Math.max(0, 3 - nameCount);
    const maxByCollection = available.availableQuantity;
    const maxAllowed = Math.min(maxByName, maxByCollection);

    let quantity = Math.min(card.quantity, maxAllowed);

    // Don't exceed 60 cards in main deck
    if (mainDeckTotal + quantity > 60) {
      quantity = Math.max(0, 60 - mainDeckTotal);
    }

    if (quantity <= 0) {
      console.warn(`Card ${available.name}: quantity reduced to 0 (nameCount=${nameCount}, maxByName=${maxByName}, maxByCollection=${maxByCollection})`);
      continue;
    }

    // Update name count
    cardNameCount.set(available.name, nameCount + quantity);
    mainDeckTotal += quantity;

    validMainDeck.push({
      cardId: card.cardId,
      cardName: available.name,
      quantity,
      isExtraDeck: false,
      reason: card.reason,
    });

    console.log(`Main deck: ${available.name} x${quantity} (total for this name: ${cardNameCount.get(available.name)})`);
  }

  const validExtraDeck: NormalizedAIDeckResponse['selectedCards'] = [];
  let extraDeckTotal = 0;

  for (const [cardId, card] of extraDeckById) {
    const available = availableCards.get(cardId)!;

    // Get current count for this card name
    const nameCount = cardNameCount.get(available.name) || 0;

    // Calculate max allowed
    const maxByName = Math.max(0, 3 - nameCount);
    const maxByCollection = available.availableQuantity;
    const maxAllowed = Math.min(maxByName, maxByCollection);

    let quantity = Math.min(card.quantity, maxAllowed);

    // Don't exceed 15 cards in extra deck
    if (extraDeckTotal + quantity > 15) {
      quantity = Math.max(0, 15 - extraDeckTotal);
    }

    if (quantity <= 0) {
      console.warn(`Card ${available.name}: quantity reduced to 0 (nameCount=${nameCount}, maxByName=${maxByName}, maxByCollection=${maxByCollection})`);
      continue;
    }

    // Update name count
    cardNameCount.set(available.name, nameCount + quantity);
    extraDeckTotal += quantity;

    validExtraDeck.push({
      cardId: card.cardId,
      cardName: available.name,
      quantity,
      isExtraDeck: true,
      reason: card.reason,
    });

    console.log(`Extra deck: ${available.name} x${quantity} (total for this name: ${cardNameCount.get(available.name)})`);
  }

  console.log(`\n=== DECK BEFORE AUTO-FILL ===`);
  console.log(`Main Deck: ${mainDeckTotal} cards (${validMainDeck.length} unique)`);
  console.log(`Extra Deck: ${extraDeckTotal} cards (${validExtraDeck.length} unique)`);
  console.log(`Need auto-fill? ${mainDeckTotal} < 40 = ${mainDeckTotal < 40}`);

  // AUTO-FILL: If main deck has less than 40 cards, add more from available cards
  if (mainDeckTotal < 40) {
    console.log(`=== AUTO-FILL STARTING ===`);
    console.log(`Current main deck: ${mainDeckTotal} cards, need ${40 - mainDeckTotal} more`);
    console.log(`Available cards in collection: ${availableCards.size}`);

    // Count how many non-extra deck cards are available
    let availableMainDeckCardsCount = 0;
    availableCards.forEach(card => {
      if (!card.isExtraDeck) availableMainDeckCardsCount++;
    });
    console.log(`Non-extra deck cards available: ${availableMainDeckCardsCount}`);

    // STEP 1: First, try to increase quantity of existing cards up to 3
    console.log(`STEP 1: Increasing existing cards quantities to max 3...`);
    for (const card of validMainDeck) {
      if (mainDeckTotal >= 40) break;

      const available = availableCards.get(card.cardId);
      if (!available) {
        console.log(`  - Card ID ${card.cardId} not found in availableCards`);
        continue;
      }

      // Current quantity in deck vs max allowed (3)
      const currentQtyInDeck = card.quantity;
      // Force increase to 3 regardless of collection (will be capped later if needed)
      const targetQty = 3;

      // How many more can we add for this specific card?
      const canAdd = targetQty - currentQtyInDeck;

      if (canAdd > 0) {
        const toAdd = Math.min(canAdd, 40 - mainDeckTotal);
        card.quantity += toAdd;
        // Update the name count as well
        const currentNameCount = cardNameCount.get(available.name) || 0;
        cardNameCount.set(available.name, currentNameCount + toAdd);
        mainDeckTotal += toAdd;
        console.log(`  -> Increased ${available.name} from x${currentQtyInDeck} to x${card.quantity} (total now: ${mainDeckTotal})`);
      }
    }

    // STEP 2: Add new cards from collection that aren't in the deck yet
    if (mainDeckTotal < 40) {
      console.log(`STEP 2: Adding new cards from collection...`);
      console.log(`Still need ${40 - mainDeckTotal} more cards`);

      const usedCardIds = new Set(validMainDeck.map(c => c.cardId));
      const availableForFill: CardInfo[] = [];

      availableCards.forEach((card, cardId) => {
        if (!card.isExtraDeck && !usedCardIds.has(cardId)) {
          const nameCount = cardNameCount.get(card.name) || 0;
          if (nameCount < 3) {
            availableForFill.push(card);
          }
        }
      });

      console.log(`Found ${availableForFill.length} unused cards to potentially add`);

      // Sort by potential usefulness (prefer cards with archetypes, spells/traps for generic utility)
      availableForFill.sort((a, b) => {
        // Prioritize spells and traps (generic utility)
        const aIsSpellTrap = a.type.includes('Spell') || a.type.includes('Trap');
        const bIsSpellTrap = b.type.includes('Spell') || b.type.includes('Trap');
        if (aIsSpellTrap && !bIsSpellTrap) return -1;
        if (!aIsSpellTrap && bIsSpellTrap) return 1;

        // Then prioritize cards with archetypes
        if (a.archetype && !b.archetype) return -1;
        if (!a.archetype && b.archetype) return 1;

        // Then by ATK for monsters
        return (b.atk || 0) - (a.atk || 0);
      });

      // Log first 10 available cards for debugging
      console.log(`First 10 available cards for fill:`, availableForFill.slice(0, 10).map(c => `${c.name} (x${c.availableQuantity})`));

      // Add cards until we reach 40
      for (const card of availableForFill) {
        if (mainDeckTotal >= 40) break;

        const nameCount = cardNameCount.get(card.name) || 0;
        const maxByName = Math.max(0, 3 - nameCount);
        const maxByCollection = card.availableQuantity;
        const maxAllowed = Math.min(maxByName, maxByCollection);

        // How many can we add without exceeding 40?
        const needed = 40 - mainDeckTotal;
        const quantity = Math.min(maxAllowed, needed);

        if (quantity > 0) {
          cardNameCount.set(card.name, nameCount + quantity);
          mainDeckTotal += quantity;

          validMainDeck.push({
            cardId: card.id,
            cardName: card.name,
            quantity,
            isExtraDeck: false,
            reason: '[Auto-ajouté pour atteindre 40 cartes]',
          });

          console.log(`  -> Added ${card.name} x${quantity} (total now: ${mainDeckTotal})`);
        }
      }
    }

    console.log(`=== AUTO-FILL COMPLETE: ${mainDeckTotal} cards ===`);
  }

  console.log(`=== FINAL VALIDATED DECK ===`);
  console.log(`Main Deck: ${mainDeckTotal} cards (${validMainDeck.length} unique)`);
  console.log(`Extra Deck: ${extraDeckTotal} cards (${validExtraDeck.length} unique)`);

  let explanation = response.explanation || '';
  const warnings: string[] = [];

  if (mainDeckTotal < 40) {
    console.warn(`WARNING: Main deck only has ${mainDeckTotal} cards (minimum 40) - not enough cards in collection to fill`);
    warnings.push(`⚠️ Le main deck n'a que ${mainDeckTotal} cartes (minimum requis: 40). Votre collection ne contient pas assez de cartes pour compléter le deck.`);
  }
  if (mainDeckTotal > 60) {
    console.error(`ERROR: Main deck has ${mainDeckTotal} cards (maximum 60)`);
    warnings.push(`⚠️ Le main deck a ${mainDeckTotal} cartes (maximum: 60). Retirez des cartes.`);
  }
  if (extraDeckTotal > 15) {
    console.error(`ERROR: Extra deck has ${extraDeckTotal} cards (maximum 15)`);
    warnings.push(`⚠️ L'extra deck a ${extraDeckTotal} cartes (maximum: 15). Retirez des cartes.`);
  }

  if (warnings.length > 0) {
    explanation = warnings.join('\n') + '\n\n' + explanation;
  }

  return {
    selectedCards: [...validMainDeck, ...validExtraDeck],
    suggestions: response.suggestions || [],
    explanation,
  };
}

export default {
  buildDeckWithAI,
  getApiCallCount,
  getMaxApiCalls,
  getRemainingCalls,
  resetApiCallCount
};
