// Manual Jest mock for expo-sqlite, backed by Node's built-in node:sqlite.
// Implements only the subset of the SQLiteDatabase API this project uses
// (execAsync, runAsync, getAllAsync, getFirstAsync, withTransactionAsync),
// so db/database.ts and db/queries.ts can run against a real SQLite engine
// in tests instead of a hand-rolled fake.
import { DatabaseSync } from 'node:sqlite';

export class FakeSQLiteDatabase {
  private native: DatabaseSync;

  constructor() {
    this.native = new DatabaseSync(':memory:');
  }

  async execAsync(sql: string): Promise<void> {
    this.native.exec(sql);
  }

  async runAsync(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const stmt = this.native.prepare(sql);
    const info = stmt.run(...(params as never[]));
    return { changes: Number(info.changes), lastInsertRowId: Number(info.lastInsertRowid) };
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.native.prepare(sql);
    return stmt.all(...(params as never[])) as T[];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.native.prepare(sql);
    const row = stmt.get(...(params as never[]));
    return (row as T) ?? null;
  }

  async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
    this.native.exec('BEGIN');
    try {
      await callback();
      this.native.exec('COMMIT');
    } catch (e) {
      this.native.exec('ROLLBACK');
      throw e;
    }
  }
}

export type SQLiteDatabase = FakeSQLiteDatabase;

export async function openDatabaseAsync(_name: string): Promise<FakeSQLiteDatabase> {
  return new FakeSQLiteDatabase();
}
