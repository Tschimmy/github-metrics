import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

import { createGitHubClient } from './client'
import { GetProjectDocument, GetProjectQuery } from './generated/graphql'
import { calculateStateDurations, TimelineEvent, IssueStateDurations } from './state-duration'
import { exportToCSV } from './csv-exporter'

// Load environment variables
dotenv.config()

async function main() {
  const token = process.env.GITHUB_TOKEN
  const orgLogin = process.env.GITHUB_ORG_LOGIN
  const projectNumber = process.env.GITHUB_PROJECT_NUMBER
  const workflowStatesRaw = process.env.WORKFLOW_STATES

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

  if (!workflowStatesRaw) {
    console.error('Error: WORKFLOW_STATES not found in environment variables')
    console.error('Add WORKFLOW_STATES to .env (comma-separated list)')
    process.exit(1)
  }

  const workflowStates = workflowStatesRaw.split(',').map(s => s.trim())
  const projectNum = parseInt(projectNumber, 10)

  try {
    const client = createGitHubClient(token)

    console.log('Fetching project data...')
    console.log(`Organization: ${orgLogin}`)
    console.log(`Project Number: ${projectNumber}`)
    console.log(`Workflow States: ${workflowStates.join(', ')}\n`)

    const data: GetProjectQuery = await client.request(GetProjectDocument, {
      orgLogin,
      projectNumber: projectNum,
    })

    // Process issues and calculate state durations
    const issuesData: IssueStateDurations[] = []

    const items = data.organization?.projectV2?.items.nodes || []

    for (const item of items) {
      if (!item || item.__typename !== 'ProjectV2Item') continue

      const content = item.content
      if (!content || content.__typename !== 'Issue') continue

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

      if (events.length === 0) continue

      const durations = calculateStateDurations(events, projectNum, workflowStates)
      durations.issueNumber = content.number
      durations.issueTitle = content.title

      issuesData.push(durations)
    }

    // Generate CSV
    const csv = exportToCSV(issuesData, workflowStates)

    // Write to file
    const outputPath = path.join(process.cwd(), 'state-durations.csv')
    fs.writeFileSync(outputPath, csv, 'utf-8')

    console.log(`✓ Processed ${issuesData.length} issues`)
    console.log(`✓ CSV exported to: ${outputPath}`)
  } catch (error) {
    console.error('Error fetching project data:', error)
    process.exit(1)
  }
}

main()
