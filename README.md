# GitHub Metrics

TypeScript project for extracting data from GitHub GraphQL API and analyzing project metrics.

## Setup

### Prerequisites

- Node.js 22
- GitHub Personal Access Token
- **Strongbox** (for database decryption)
- Contact [**Florian Kimmel**](https://eversports.slack.com/team/U07QL8H1E0G) for database key ID

### Installation

1. Install dependencies:

```bash
yarn install
```

2. Create `.env` file:

```bash
cp .env.example .env
```

3. Add your GitHub token to `.env`:
   - Create token at: <https://github.com/settings/tokens>
   - Required scopes: `repo`, `read:org`, `read:user`
   - Add to `.env`: `GITHUB_TOKEN=your_token_here`

4. Generate TypeScript types from GitHub schema:

```bash
yarn codegen
```

5. **Database Access**: The SQLite database is encrypted with strongbox. To decrypt:
   - Install [Strongbox](https://github.com/uw-labs/strongbox/tree/master)
   - Contact [**Florian Kimmel**](https://eversports.slack.com/team/U07QL8H1E0G) to get the key ID
   - Configure strongbox with the provided key

## Available Commands

### Metrics

- `yarn metrics:collect` - Collect metrics from GitHub
- `yarn metrics:analyze --start YYYY-MM-DD --end YYYY-MM-DD` - Analyze phase durations with visual charts
- `yarn metrics:export` - Export metrics data
- `yarn metrics:run` - Run metrics script

### Development

- `yarn dev` - Run the application
- `yarn build` - Build for production
- `yarn codegen` - Generate TypeScript types from GraphQL schema
- `yarn codegen:watch` - Watch mode for type generation
- `yarn lint` - Lint code
- `yarn lint:fix` - Fix linting issues
- `yarn format` - Format code

## Usage

1. Collect metrics: `yarn metrics:collect`
2. Analyze metrics: `yarn metrics:analyze --start YYYY-MM-DD --end YYYY-MM-DD`
3. Export results: `yarn metrics:export`

## Visual Output Examples

The `yarn metrics:analyze` command produces horizontal bar charts showing time spent in each workflow phase:

```
Phase Duration Analysis
2024-01-01 to 2024-12-31
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backlog      ███████████████ 12.4 days
Ready        ████ 3.2 days
In Progress  ████████████████████████████ 24.8 days
In Review    ██████ 5.1 days
Done         ███ 2.3 days

Total transitions: 45  |  Avg per phase: 9.6 days  |  Total cycle time: 47.8 days
```

**Chart components:**

- **Phase names** (left): Workflow states in order
- **Duration bars** (█): Visual representation of time spent
- **Days** (right): Average days in each phase
- **Summary**: Total transitions, avg per phase, total cycle time

The chart identifies workflow bottlenecks by showing where items spend most time.
