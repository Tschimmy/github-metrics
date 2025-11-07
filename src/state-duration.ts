export interface TimelineEvent {
  createdAt: string
  status: string
  previousStatus: string
  project?: {
    number: number
    title: string
  } | null
}

export interface StateDuration {
  state: string
  durationDays: number
  isCurrent: boolean
}

export interface IssueStateDurations {
  issueNumber: number
  issueTitle: string
  stateDurations: Map<string, number>
  currentState?: string
}

/**
 * Calculate time spent in each state for an issue
 * @param events Timeline events for the issue (sorted chronologically)
 * @param projectNumber The project number to filter events by
 * @param workflowStates List of valid workflow states to track
 * @returns Map of state -> duration in days
 */
export function calculateStateDurations(
  events: TimelineEvent[],
  projectNumber: number,
  workflowStates: string[]
): IssueStateDurations {
  // Filter events for the specified project only
  const projectEvents = events.filter(
    (e) => e.project?.number === projectNumber
  )

  // Sort by createdAt to ensure chronological order
  const sortedEvents = [...projectEvents].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Initialize durations map with all workflow states
  const stateDurations = new Map<string, number>()
  workflowStates.forEach((state) => stateDurations.set(state, 0))

  let currentState: string | undefined

  // Calculate durations between state transitions
  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i]
    const nextEvent = sortedEvents[i + 1]

    const state = event.status
    const startTime = new Date(event.createdAt)

    if (nextEvent) {
      // Calculate time between this event and next
      const endTime = new Date(nextEvent.createdAt)
      const durationMs = endTime.getTime() - startTime.getTime()
      const durationDays = durationMs / (1000 * 60 * 60 * 24)

      // Add to existing duration for this state
      const existing = stateDurations.get(state) || 0
      stateDurations.set(state, existing + durationDays)
    } else {
      // Last event - calculate time from then to now
      const now = new Date()
      const durationMs = now.getTime() - startTime.getTime()
      const durationDays = durationMs / (1000 * 60 * 60 * 24)

      const existing = stateDurations.get(state) || 0
      stateDurations.set(state, existing + durationDays)
      currentState = state
    }
  }

  return {
    issueNumber: 0, // Will be set by caller
    issueTitle: '', // Will be set by caller
    stateDurations,
    currentState,
  }
}
