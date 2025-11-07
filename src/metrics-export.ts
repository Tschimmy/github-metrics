import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

import { initDatabase } from './database/schema'
import { MetricsRepository } from './database/repository'

// Load environment variables
dotenv.config()

async function main() {
  const workflowStatesRaw = process.env.WORKFLOW_STATES

  if (!workflowStatesRaw) {
    console.error('Error: WORKFLOW_STATES not found in environment variables')
    console.error('Add WORKFLOW_STATES to .env (comma-separated list)')
    process.exit(1)
  }

  const workflowStates = workflowStatesRaw.split(',').map(s => s.trim())

  try {
    // Initialize database
    const db = initDatabase()
    const repo = new MetricsRepository(db)

    console.log('Exporting metrics to CSV...\n')

    // Get all issues
    const issues = repo.getAllIssues()

    if (issues.length === 0) {
      console.log('No issues found in database. Run `yarn metrics:collect` first.')
      db.close()
      return
    }

    // Build CSV
    const lines: string[] = []

    // Header row
    const headers = [
      'Issue Number',
      'Issue Title',
      'Issue Type',
      ...workflowStates.map(state => `${state} (days)`),
      'Current State',
      'Total Duration (days)',
    ]
    lines.push(escapeCsvRow(headers))

    // Data rows
    for (const issue of issues) {
      const stateHistory = repo.getStateHistory(issue.issueNumber)

      // Calculate total duration per state
      const stateDurations = new Map<string, number>()
      workflowStates.forEach(state => stateDurations.set(state, 0))

      let totalDays = 0
      for (const history of stateHistory) {
        const duration = history.durationDays || 0
        const existing = stateDurations.get(history.stateName) || 0
        stateDurations.set(history.stateName, existing + duration)
        totalDays += duration
      }

      const row: string[] = [
        issue.issueNumber.toString(),
        issue.issueTitle,
        issue.issueType || '',
      ]

      for (const state of workflowStates) {
        const days = stateDurations.get(state) || 0
        row.push(days.toFixed(2))
      }

      row.push(issue.currentState || 'Archived')
      row.push(totalDays.toFixed(2))

      lines.push(escapeCsvRow(row))
    }

    const csv = lines.join('\n')

    // Write to file
    const outputPath = path.join(process.cwd(), 'state-durations.csv')
    fs.writeFileSync(outputPath, csv, 'utf-8')

    console.log(`✓ Exported ${issues.length} issues`)
    console.log(`✓ CSV written to: ${outputPath}`)

    db.close()
  } catch (error) {
    console.error('Error exporting metrics:', error)
    process.exit(1)
  }
}

/**
 * Escape CSV row - handle quotes and commas in values
 */
function escapeCsvRow(values: string[]): string {
  return values
    .map((val) => {
      // Escape quotes by doubling them
      const escaped = val.replace(/"/g, '""')
      // Wrap in quotes if contains comma, quote, or newline
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`
      }
      return escaped
    })
    .join(',')
}

main()
