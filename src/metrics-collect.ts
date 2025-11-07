import dotenv from 'dotenv'

import { createGitHubClient } from './client'
import { GetProjectDocument, GetProjectQuery } from './generated/graphql'
import { TimelineEvent } from './state-duration'
import { initDatabase } from './database/schema'
import { MetricsRepository } from './database/repository'

// Load environment variables
dotenv.config()

async function main() {
  const token = process.env.GITHUB_TOKEN
  const orgLogin = process.env.GITHUB_ORG_LOGIN
  const projectNumber = process.env.GITHUB_PROJECT_NUMBER
  const issueTypeFilter = process.env.ISSUE_TYPE?.trim().toLowerCase()

  if (!token) {
    console.error('Error: GITHUB_TOKEN not found in environment variables')
    console.error('Copy .env.example to .env and add your GitHub token')
    process.exit(1)
  }

  if (!orgLogin || !projectNumber) {
    console.error('Error: GITHUB_ORG_LOGIN or GITHUB_PROJECT_NUMBER not found')
    console.error('Copy .env.example to .env and configure organization settings')
    process.exit(1)
  }

  const projectNum = parseInt(projectNumber, 10)

  try {
    // Initialize database
    const db = initDatabase()
    const repo = new MetricsRepository(db)

    const client = createGitHubClient(token)

    console.log('Collecting metrics...')
    console.log(`Organization: ${orgLogin}`)
    console.log(`Project Number: ${projectNumber}`)
    console.log(`Issue Type Filter: ${issueTypeFilter || 'all'}\n`)

    const runAt = new Date().toISOString()
    let issuesProcessed = 0
    let changesDetected = 0

    const data: GetProjectQuery = await client.request(GetProjectDocument, {
      orgLogin,
      projectNumber: projectNum,
    })

    const items = data.organization?.projectV2?.items.nodes || []

    for (const item of items) {
      if (!item || item.__typename !== 'ProjectV2Item') continue

      const content = item.content
      if (!content || content.__typename !== 'Issue') continue

      // Filter by issue type if specified
      if (issueTypeFilter) {
        const issueTypeName = content.issueType?.name?.toLowerCase()
        if (issueTypeName !== issueTypeFilter) continue
      }

      const timelineNodes = content.timelineItems.nodes || []
      const events: TimelineEvent[] = timelineNodes
        .filter((node): node is any =>
          node != null &&
          typeof node === 'object' &&
          'createdAt' in node &&
          'status' in node
        )
        .map(node => ({
          createdAt: node.createdAt,
          status: node.status,
          previousStatus: node.previousStatus,
          project: node.project,
        }))

      // Filter events for this project only
      const projectEvents = events.filter(e => e.project?.number === projectNum)
      if (projectEvents.length === 0) continue

      issuesProcessed++

      // Parse timeline into state transitions
      const sortedEvents = [...projectEvents].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      // Determine current state
      const currentState = sortedEvents.length > 0
        ? sortedEvents[sortedEvents.length - 1].status
        : null

      // Upsert issue
      repo.upsertIssue({
        issueNumber: content.number,
        issueTitle: content.title,
        issueType: content.issueType?.name || null,
        projectNumber: projectNum,
        currentState,
        lastSyncedAt: runAt,
      })

      // Get existing state history from DB
      const existingHistory = repo.getStateHistory(content.number)
      const existingMap = new Map(
        existingHistory.map(h => [`${h.stateName}:${h.enteredAt}`, h])
      )

      // Process each state transition
      for (let i = 0; i < sortedEvents.length; i++) {
        const event = sortedEvents[i]
        const nextEvent = sortedEvents[i + 1]

        const enteredAt = event.createdAt
        const exitedAt = nextEvent ? nextEvent.createdAt : null
        const stateName = event.status
        const key = `${stateName}:${enteredAt}`

        const duration = repo.calculateDuration(enteredAt, exitedAt)

        const existing = existingMap.get(key)

        // Check if needs update
        if (!existing || existing.exitedAt !== exitedAt) {
          changesDetected++
          repo.upsertStateHistory({
            issueNumber: content.number,
            stateName,
            enteredAt,
            exitedAt,
            durationDays: duration,
            recordedAt: runAt,
          })
        }
      }
    }

    // Update current state durations
    repo.updateCurrentStateDurations()

    // Record collection run
    repo.createCollectionRun({
      runAt,
      issuesProcessed,
      changesDetected,
    })

    console.log(`✓ Processed ${issuesProcessed} issues`)
    console.log(`✓ Detected ${changesDetected} changes`)
    console.log(`✓ Data saved to: metrics.db`)

    db.close()
  } catch (error) {
    console.error('Error fetching project data:', error)
    process.exit(1)
  }
}

main()
