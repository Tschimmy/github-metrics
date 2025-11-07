import { IssueStateDurations } from './state-duration'

/**
 * Export issue state durations to CSV format
 * @param issuesData Array of issue state durations
 * @param workflowStates Ordered list of workflow states
 * @returns CSV string
 */
export function exportToCSV(
  issuesData: IssueStateDurations[],
  workflowStates: string[]
): string {
  const lines: string[] = []

  // Header row
  const headers = [
    'Issue Number',
    'Issue Title',
    ...workflowStates.map((state) => `${state} (days)`),
    'Current State',
    'Total Duration (days)',
  ]
  lines.push(escapeCsvRow(headers))

  // Data rows
  for (const issue of issuesData) {
    const row: string[] = [
      issue.issueNumber.toString(),
      issue.issueTitle,
    ]

    let totalDays = 0
    for (const state of workflowStates) {
      const days = issue.stateDurations.get(state) || 0
      totalDays += days
      row.push(formatDuration(days))
    }

    row.push(issue.currentState || 'Archived')
    row.push(formatDuration(totalDays))

    lines.push(escapeCsvRow(row))
  }

  return lines.join('\n')
}

/**
 * Format duration to 2 decimal places
 */
function formatDuration(days: number): string {
  return days.toFixed(2)
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
