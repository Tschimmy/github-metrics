import { GraphQLClient } from 'graphql-request'

const GITHUB_API_ENDPOINT = 'https://api.github.com/graphql'

export function createGitHubClient(token: string): GraphQLClient {
  if (!token) {
    throw new Error('GitHub token is required. Set GITHUB_TOKEN in .env file')
  }

  return new GraphQLClient(GITHUB_API_ENDPOINT, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}
