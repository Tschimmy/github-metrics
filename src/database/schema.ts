import Database from 'better-sqlite3'
import path from 'path'

export function initDatabase(dbPath?: string): Database.Database {
  const finalPath = dbPath || path.join(process.cwd(), 'metrics.db')
  const db = new Database(finalPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Create tables
  createTables(db)

  return db
}

function createTables(db: Database.Database): void {
  // Issues table
  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      issue_number INTEGER PRIMARY KEY,
      issue_title TEXT NOT NULL,
      issue_type TEXT,
      project_number INTEGER NOT NULL,
      current_state TEXT,
      last_synced_at TEXT NOT NULL
    )
  `)

  // State history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS state_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_number INTEGER NOT NULL,
      state_name TEXT NOT NULL,
      entered_at TEXT NOT NULL,
      exited_at TEXT,
      duration_days REAL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (issue_number) REFERENCES issues(issue_number),
      UNIQUE(issue_number, state_name, entered_at)
    )
  `)

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_state_history_issue
    ON state_history(issue_number)
  `)

  // Collection runs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at TEXT NOT NULL,
      issues_processed INTEGER NOT NULL,
      changes_detected INTEGER NOT NULL
    )
  `)
}
