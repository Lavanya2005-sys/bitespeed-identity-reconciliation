import Database, { Database as DatabaseType } from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "contacts.db");

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create the Contact table
db.exec(`
  CREATE TABLE IF NOT EXISTS Contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber TEXT,
    email TEXT,
    linkedId INTEGER,
    linkPrecedence TEXT NOT NULL CHECK(linkPrecedence IN ('primary', 'secondary')),
    createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
    updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
    deletedAt DATETIME,
    FOREIGN KEY (linkedId) REFERENCES Contact(id)
  );
`);

// Create indexes for faster lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_contact_email ON Contact(email);
  CREATE INDEX IF NOT EXISTS idx_contact_phone ON Contact(phoneNumber);
  CREATE INDEX IF NOT EXISTS idx_contact_linkedId ON Contact(linkedId);
`);

export default db;
