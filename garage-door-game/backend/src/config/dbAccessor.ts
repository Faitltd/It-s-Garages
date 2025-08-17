// Lightweight DB accessor to avoid importing sqlite3 at module load time
// Routes should use getDb() and handle the case where DB is not yet initialized

let _db: any | null = null;

export function setDb(db: any) {
  _db = db;
}

export function getDb(): any | null {
  return _db;
}

