import dotenv from 'dotenv'

import { createGitHubClient } from './client'
import { GetProjectDocument, GetProjectQuery } from './generated/graphql'

// Load environment variables
dotenv.config()

async function main() {
  const token = process.env.GITHUB_TOKEN
  const orgLogin = process.env.GITHUB_ORG_LOGIN
  const projectNumber = process.env.GITHUB_PROJECT_NUMBER

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

  try {
    const client = createGitHubClient(token)

    console.log('Fetching project data...')
    console.log(`Organization: ${orgLogin}`)
    console.log(`Project Number: ${projectNumber}\n`)

    const data: GetProjectQuery = await client.request(GetProjectDocument, {
      orgLogin,
      projectNumber: parseInt(projectNumber, 10),
    })

    console.log(JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error fetching project data:', error)
    process.exit(1)
  }
}

main()
