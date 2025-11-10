import Database from 'better-sqlite3'

export interface Issue {
  issueNumber: number
  issueTitle: string
  issueType: string | null
  projectNumber: number
  currentState: string | null
  lane: string | null
  lastSyncedAt: string
}

export interface StateHistory {
  id?: number
  issueNumber: number
  stateName: string
  enteredAt: string
  exitedAt: string | null
  durationDays: number | null
  recordedAt: string
}

export interface CollectionRun {
  id?: number
  runAt: string
  issuesProcessed: number
  changesDetected: number
}

export class MetricsRepository {
  constructor(private db: Database.Database) {}

  // Issues operations
  upsertIssue(issue: Issue): void {
    const stmt = this.db.prepare(`
      INSERT INTO issues (issue_number, issue_title, issue_type, project_number, current_state, lane, last_synced_at)
      VALUES (@issueNumber, @issueTitle, @issueType, @projectNumber, @currentState, @lane, @lastSyncedAt)
      ON CONFLICT(issue_number) DO UPDATE SET
        issue_title = @issueTitle,
        issue_type = @issueType,
        project_number = @projectNumber,
        current_state = @currentState,
        lane = @lane,
        last_synced_at = @lastSyncedAt
    `)
    stmt.run(issue)
  }

  getIssue(issueNumber: number): Issue | null {
    const stmt = this.db.prepare(`
      SELECT issue_number as issueNumber, issue_title as issueTitle,
             issue_type as issueType, project_number as projectNumber,
             current_state as currentState, lane, last_synced_at as lastSyncedAt
      FROM issues WHERE issue_number = ?
    `)
    return stmt.get(issueNumber) as Issue | undefined || null
  }

  getAllIssues(): Issue[] {
    const stmt = this.db.prepare(`
      SELECT issue_number as issueNumber, issue_title as issueTitle,
             issue_type as issueType, project_number as projectNumber,
             current_state as currentState, lane, last_synced_at as lastSyncedAt
      FROM issues
      ORDER BY issue_number
    `)
    return stmt.all() as Issue[]
  }

  // State history operations
  getStateHistory(issueNumber: number): StateHistory[] {
    const stmt = this.db.prepare(`
      SELECT id, issue_number as issueNumber, state_name as stateName,
             entered_at as enteredAt, exited_at as exitedAt,
             duration_days as durationDays, recorded_at as recordedAt
      FROM state_history
      WHERE issue_number = ?
      ORDER BY entered_at
    `)
    return stmt.all(issueNumber) as StateHistory[]
  }

  upsertStateHistory(history: StateHistory): void {
    const stmt = this.db.prepare(`
      INSERT INTO state_history (issue_number, state_name, entered_at, exited_at, duration_days, recorded_at)
      VALUES (@issueNumber, @stateName, @enteredAt, @exitedAt, @durationDays, @recordedAt)
      ON CONFLICT(issue_number, state_name, entered_at) DO UPDATE SET
        exited_at = @exitedAt,
        duration_days = @durationDays,
        recorded_at = @recordedAt
    `)
    stmt.run(history)
  }

  // Get all state history for export
  getAllStateHistory(): StateHistory[] {
    const stmt = this.db.prepare(`
      SELECT id, issue_number as issueNumber, state_name as stateName,
             entered_at as enteredAt, exited_at as exitedAt,
             duration_days as durationDays, recorded_at as recordedAt
      FROM state_history
      ORDER BY issue_number, entered_at
    `)
    return stmt.all() as StateHistory[]
  }

  // Collection runs operations
  createCollectionRun(run: Omit<CollectionRun, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO collection_runs (run_at, issues_processed, changes_detected)
      VALUES (@runAt, @issuesProcessed, @changesDetected)
    `)
    const result = stmt.run(run)
    return result.lastInsertRowid as number
  }

  // Update duration_days for current states (exited_at IS NULL)
  updateCurrentStateDurations(): void {
    this.db.exec(`
      UPDATE state_history
      SET duration_days = (
        julianday('now') - julianday(entered_at)
      )
      WHERE exited_at IS NULL
    `)
  }

  // Calculate duration between two dates
  calculateDuration(enteredAt: string, exitedAt: string | null): number {
    if (exitedAt) {
      const entered = new Date(enteredAt)
      const exited = new Date(exitedAt)
      return (exited.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)
    } else {
      const entered = new Date(enteredAt)
      const now = new Date()
      return (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)
    }
  }
}
