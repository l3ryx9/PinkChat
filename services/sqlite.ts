import * as SQLite from "expo-sqlite";

  let _db: SQLite.SQLiteDatabase | null = null;
  let _dbFailed = false;

  function getDb(): SQLite.SQLiteDatabase | null {
    if (_dbFailed) return null;
    if (_db) return _db;
    try {
      _db = SQLite.openDatabaseSync("adeux.db");
      _db.execSync(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          senderId TEXT NOT NULL,
          receiverId TEXT NOT NULL,
          content TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          deliveredAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(createdAt DESC);
      `);
    } catch (e) {
      console.error("[SQLite] Initialisation échouée (mode Firestore only):", e);
      _dbFailed = true;
      _db = null;
    }
    return _db;
  }

  export interface LocalMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    createdAt: number;
    deliveredAt: number | null;
  }

  export function saveMessages(messages: LocalMessage[]): void {
    const db = getDb();
    if (!db) return;
    try {
      for (const msg of messages) {
        db.runSync(
          `INSERT OR REPLACE INTO messages (id, senderId, receiverId, content, createdAt, deliveredAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [msg.id, msg.senderId, msg.receiverId, msg.content, msg.createdAt, msg.deliveredAt]
        );
      }
    } catch (e) {
      console.error("[SQLite] saveMessages échoué:", e);
    }
  }

  export function loadMessages(
    userId: string,
    partnerId: string,
    limit = 50
  ): LocalMessage[] {
    const db = getDb();
    if (!db) return [];
    try {
      return db.getAllSync<LocalMessage>(
        `SELECT * FROM messages
         WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
         ORDER BY createdAt DESC
         LIMIT ?`,
        [userId, partnerId, partnerId, userId, limit]
      );
    } catch (e) {
      console.error("[SQLite] loadMessages échoué:", e);
      return [];
    }
  }

  export function markDelivered(messageId: string): void {
    const db = getDb();
    if (!db) return;
    try {
      db.runSync(
        `UPDATE messages SET deliveredAt = ? WHERE id = ? AND deliveredAt IS NULL`,
        [Date.now(), messageId]
      );
    } catch (e) {
      console.error("[SQLite] markDelivered échoué:", e);
    }
  }
  