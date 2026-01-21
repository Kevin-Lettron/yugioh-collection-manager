"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importStar(require("../config/database"));
async function migrate() {
    console.log('Starting migration: Adding language column to user_cards...');
    try {
        // Add the language column if it doesn't exist
        await (0, database_1.query)(`
      ALTER TABLE user_cards
      ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'EN'
    `);
        console.log('✓ Added language column');
        // Drop the old unique constraint if it exists
        await (0, database_1.query)(`
      ALTER TABLE user_cards
      DROP CONSTRAINT IF EXISTS user_cards_user_id_card_id_set_code_rarity_key
    `);
        console.log('✓ Dropped old unique constraint');
        // Add the new unique constraint including language
        await (0, database_1.query)(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_cards_unique'
        ) THEN
          ALTER TABLE user_cards
          ADD CONSTRAINT user_cards_unique
          UNIQUE(user_id, card_id, set_code, rarity, language);
        END IF;
      END $$
    `);
        console.log('✓ Added new unique constraint with language');
        // Create index on language column
        await (0, database_1.query)(`
      CREATE INDEX IF NOT EXISTS idx_user_cards_language ON user_cards(language)
    `);
        console.log('✓ Created index on language column');
        console.log('\n✅ Migration completed successfully!');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await database_1.default.end();
    }
}
migrate();
