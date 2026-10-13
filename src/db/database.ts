import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | undefined;

export function initializeDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync('smartpantry.db').then(async (db) => {
      try {
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL CHECK(length(trim(name)) > 0),
            brand TEXT,
            barcode TEXT,
            category TEXT NOT NULL CHECK(length(trim(category)) > 0),
            quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
            unit TEXT,
            expiration_date TEXT NOT NULL,
            storage_location TEXT,
            image_url TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS products_expiration_date ON products(expiration_date);
          CREATE TABLE IF NOT EXISTS shopping_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL CHECK(length(trim(name)) > 0),
            quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
            unit TEXT,
            category TEXT,
            completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
            source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'recipe')),
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS shopping_list_completed_created ON shopping_list(completed, created_at DESC);
          CREATE TABLE IF NOT EXISTS product_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            product_name TEXT NOT NULL CHECK(length(trim(product_name)) > 0),
            brand TEXT,
            category TEXT,
            quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
            unit TEXT,
            expiration_date TEXT,
            action TEXT NOT NULL CHECK(action IN ('consumed', 'wasted')),
            action_date TEXT NOT NULL,
            created_at TEXT
          );
          CREATE INDEX IF NOT EXISTS product_history_action_date ON product_history(action_date DESC, id DESC);
        `);
        return db;
      } catch (error) {
        await db.closeAsync().catch(() => {});
        throw error;
      }
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}
