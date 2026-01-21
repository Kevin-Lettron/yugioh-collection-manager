import pool, { query } from '../config/database';

async function migrate() {
  console.log('Starting migration: Adding language column to user_cards...');

  try {
    // Add the language column if it doesn't exist
    await query(`
      ALTER TABLE user_cards
      ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'EN'
    `);
    console.log('✓ Added language column');

    // Drop the old unique constraint if it exists
    await query(`
      ALTER TABLE user_cards
      DROP CONSTRAINT IF EXISTS user_cards_user_id_card_id_set_code_rarity_key
    `);
    console.log('✓ Dropped old unique constraint');

    // Add the new unique constraint including language
    await query(`
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
    await query(`
      CREATE INDEX IF NOT EXISTS idx_user_cards_language ON user_cards(language)
    `);
    console.log('✓ Created index on language column');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
