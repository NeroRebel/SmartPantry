import type { SQLiteDatabase } from 'expo-sqlite';

const fields = {
  products: `name TEXT NOT NULL CHECK(length(trim(name)) > 0), brand TEXT, barcode TEXT,
    category TEXT NOT NULL CHECK(length(trim(category)) > 0), quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
    unit TEXT, expiration_date TEXT NOT NULL, storage_location TEXT, image_url TEXT, notes TEXT,
    notification_id TEXT, created_at TEXT NOT NULL`,
  shopping_list: `name TEXT NOT NULL CHECK(length(trim(name)) > 0), quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
    unit TEXT, category TEXT, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
    source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','recipe')), created_at TEXT NOT NULL`,
  product_history: `product_id TEXT, product_name TEXT NOT NULL CHECK(length(trim(product_name)) > 0),
    brand TEXT, category TEXT, quantity REAL CHECK(quantity IS NULL OR quantity >= 0), unit TEXT,
    expiration_date TEXT, action TEXT NOT NULL CHECK(action IN ('consumed','wasted')),
    action_date TEXT NOT NULL, created_at TEXT`,
} as const;

export async function migrateSyncMetadata(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    await db.execAsync('CREATE TABLE IF NOT EXISTS local_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    const done = await db.getFirstAsync('SELECT value FROM local_metadata WHERE key = ?', 'sync_schema_v1');
    if (!done) {
      for (const table of ['products', 'shopping_list', 'product_history'] as const) {
        const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        // Refuse an unknown partial migration instead of dropping ownership/metadata.
        if (columns.some((column) => column.name === 'user_id')) throw new Error('Unrecognized local sync schema');
        const names = columns.map((column) => column.name);
        const timestamp = table === 'product_history' ? 'action_date' : 'created_at';
        await db.execAsync(`CREATE TABLE ${table}_sync_v1 (
          id TEXT NOT NULL, user_id TEXT NOT NULL DEFAULT '', ${fields[table]},
          updated_at TEXT NOT NULL, deleted_at TEXT, local_revision INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, id)
        )`);
        // Column names come exclusively from these existing, inspected application tables.
        const safeNames = names.map((name) => `"${name.replace(/"/g, '""')}"`).join(', ');
        await db.execAsync(`INSERT INTO ${table}_sync_v1 (${safeNames}, updated_at)
          SELECT ${safeNames}, COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', ${timestamp}), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) FROM ${table}`);
        await db.execAsync(`DROP TABLE ${table}; ALTER TABLE ${table}_sync_v1 RENAME TO ${table}`);
      }
      await db.runAsync('INSERT INTO local_metadata (key, value) VALUES (?, ?)', 'sync_schema_v1', '1');
    }
    const historyColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(product_history)');
    for (const name of ['barcode', 'storage_location', 'image_url', 'notes'] as const) {
      if (!historyColumns.some((column) => column.name === name)) await db.execAsync(`ALTER TABLE product_history ADD COLUMN ${name} TEXT`);
    }
    const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
    if (!productColumns.some((column) => column.name === 'reminder_dirty')) await db.execAsync('ALTER TABLE products ADD COLUMN reminder_dirty INTEGER NOT NULL DEFAULT 1');
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS products_expiration_date ON products(user_id, deleted_at, expiration_date);
      CREATE INDEX IF NOT EXISTS shopping_list_completed_created ON shopping_list(user_id, deleted_at, completed, created_at DESC);
      CREATE INDEX IF NOT EXISTS product_history_action_date ON product_history(user_id, deleted_at, action_date DESC, id DESC);
    `);
    await db.execAsync('COMMIT');
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
