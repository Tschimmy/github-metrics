# GitHub Metrics

TypeScript project for extracting data from GitHub GraphQL API

## Setup

### Prerequisites

- Node.js 22
- GitHub Personal Access Token

### Installation

1. Install dependencies:
```bash
yarn install
# or
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your GitHub token to `.env`:
   - Create token at: https://github.com/settings/tokens
   - Required scopes: `repo`, `read:org`, `read:user`
   - Add to `.env`: `GITHUB_TOKEN=your_token_here`

4. Generate TypeScript types from GitHub schema:
```bash
yarn codegen
```

## Development

### Run the application
```bash
yarn dev
```

### Generate GraphQL types
```bash
# Generate once
yarn codegen

# Watch mode (auto-regenerate on changes)
yarn codegen:watch
```

### Lint and format
```bash
yarn lint
yarn lint:fix
yarn format
```

### Build
```bash
yarn build
```

## Usage

1. Add GraphQL queries in `src/queries/*.graphql`
2. Run `yarn codegen` to generate TypeScript types
3. Import generated types from `src/generated/graphql`
4. Use the client in `src/client.ts` to execute queries

Example query file: `src/queries/viewer.graphql`
