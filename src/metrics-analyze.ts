import dotenv from 'dotenv'
import { initDatabase } from './database/schema'
import { MetricsRepository } from './database/repository'

// @ts-ignore - cli-chart doesn't have types
import Chart from 'cli-chart'

// Load environment variables
dotenv.config()

interface StateDurationData {
  stateName: string
  avgDuration: number
  count: number
}

function parseDate(dateStr: string): Date {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.error(`Error: Invalid date format "${dateStr}"`)
    console.error('Use ISO format: YYYY-MM-DD (e.g., 2024-01-01)')
    process.exit(1)
  }
  return date
}

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2)
  const startIndex = args.indexOf('--start')
  const endIndex = args.indexOf('--end')
  const laneIndex = args.indexOf('--lane')

  if (startIndex === -1 || !args[startIndex + 1]) {
    console.error('Error: --start date is required')
    console.error('Usage: yarn metrics:analyze --start YYYY-MM-DD --end YYYY-MM-DD [--lane LANE]')
    process.exit(1)
  }

  if (endIndex === -1 || !args[endIndex + 1]) {
    console.error('Error: --end date is required')
    console.error('Usage: yarn metrics:analyze --start YYYY-MM-DD --end YYYY-MM-DD [--lane LANE]')
    process.exit(1)
  }

  const startDate = parseDate(args[startIndex + 1])
  const endDate = parseDate(args[endIndex + 1])
  const laneFilter = laneIndex !== -1 && args[laneIndex + 1] ? args[laneIndex + 1] : null

  if (startDate >= endDate) {
    console.error('Error: --start date must be before --end date')
    process.exit(1)
  }

  // Load workflow state order from env
  const workflowStatesEnv = process.env.WORKFLOW_STATES || ''
  const workflowOrder = workflowStatesEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (workflowOrder.length === 0) {
    console.error('Error: WORKFLOW_STATES not configured in .env')
    console.error('Add comma-separated states in workflow order')
    process.exit(1)
  }

  try {
    // Initialize database
    const db = initDatabase()
    const repo = new MetricsRepository(db)

    console.log(`\nPhase Duration Analysis`)
    console.log(`${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)
    if (laneFilter) {
      console.log(`Lane: ${laneFilter}`)
    }
    console.log('━'.repeat(60))
    console.log()

    // Query state history within date range
    const allHistory = repo.getAllStateHistory()
    const allIssues = repo.getAllIssues()

    // Create issue map for lane filtering
    const issueMap = new Map(allIssues.map(i => [i.issueNumber, i]))

    // Filter by date range and lane (check if state was active during the period)
    const filteredHistory = allHistory.filter(h => {
      const entered = new Date(h.enteredAt)
      const exited = h.exitedAt ? new Date(h.exitedAt) : new Date()

      // State overlaps with our date range if:
      // entered <= endDate AND (exited >= startDate OR exited is null)
      const inDateRange = entered <= endDate && exited >= startDate

      // Filter by lane if specified
      if (laneFilter) {
        const issue = issueMap.get(h.issueNumber)
        return inDateRange && issue?.lane === laneFilter
      }

      return inDateRange
    })

    if (filteredHistory.length === 0) {
      console.log('No state transitions found in this date range.')
      db.close()
      return
    }

    // Group by state and calculate averages
    const stateMap = new Map<string, { totalDuration: number; count: number }>()

    for (const h of filteredHistory) {
      if (!h.stateName || h.stateName.trim() === '') continue

      const existing = stateMap.get(h.stateName) || { totalDuration: 0, count: 0 }
      existing.totalDuration += h.durationDays || 0
      existing.count += 1
      stateMap.set(h.stateName, existing)
    }

    // Convert to array and calculate averages
    const stateData: StateDurationData[] = Array.from(stateMap.entries()).map(
      ([stateName, data]) => ({
        stateName,
        avgDuration: data.totalDuration / data.count,
        count: data.count,
      })
    )

    // Sort by workflow order
    const sortedData = stateData.sort((a, b) => {
      const indexA = workflowOrder.indexOf(a.stateName)
      const indexB = workflowOrder.indexOf(b.stateName)

      // If state not in workflow order, put at end
      if (indexA === -1 && indexB === -1) return a.stateName.localeCompare(b.stateName)
      if (indexA === -1) return 1
      if (indexB === -1) return -1

      return indexA - indexB
    })

    // Print table-style output with bars
    const maxLabelLength = Math.max(...sortedData.map(d => d.stateName.length))
    const maxDuration = Math.max(...sortedData.map(d => d.avgDuration))
    const barWidth = 50

    for (const data of sortedData) {
      const barLength = Math.round((data.avgDuration / maxDuration) * barWidth)
      const bar = '█'.repeat(barLength)
      const daysStr = data.avgDuration.toFixed(1)
      const label = data.stateName.padEnd(maxLabelLength)

      console.log(`${label}  ${bar} ${daysStr} days`)
    }

    // Summary stats
    console.log()
    const totalTransitions = filteredHistory.length
    const avgDuration = stateData.reduce((sum, d) => sum + d.avgDuration, 0) / stateData.length
    const totalCycleTime = stateData.reduce((sum, d) => sum + d.avgDuration, 0)

    console.log(`Total transitions: ${totalTransitions}  |  Avg per phase: ${avgDuration.toFixed(1)} days  |  Total cycle time: ${totalCycleTime.toFixed(1)} days`)
    console.log()

    db.close()
  } catch (error) {
    console.error('Error analyzing metrics:', error)
    process.exit(1)
  }
}

main()
