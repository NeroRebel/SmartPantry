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
