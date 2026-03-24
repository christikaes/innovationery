export interface FirebaseRoomMember {
  id: string
  authUid: string | null
  name: string
  email: string
  isOnline: boolean
  isVerified: boolean
  joinedAt: string
  lastSeenAt?: string | null
  createdAt?: string | null
}

export interface FirebaseWorkflowStepState {
  startTime: string | null
  pauseTime: string | null
  cards: FirebaseWorkflowCard[]
}

export interface FirebaseRoomWorkflowState {
  currentStepIndex: number
  startedAt: string | null
  steps: Record<string, FirebaseWorkflowStepState>
}

export interface FirebaseWorkflowCardMetadata {
  variables?: string[]
  groupId?: string | null
}

export interface FirebaseWorkflowCard {
  id: string
  authorId: string
  authorName: string
  text: string
  createdAt: string
  metadata?: FirebaseWorkflowCardMetadata
}

export interface FirebaseRoomDocument {
  workflowId: string | null
  workflowState: FirebaseRoomWorkflowState
}

export interface FirebaseWorkflowStep {
  id: string
  title: string
  description: string
  type: string
  durationMinutes: number | null
  prompt: string
  inputStepIds: string[]
  data: Record<string, string | number | boolean>
}

export interface FirebaseWorkflowActivity {
  id: string
  title: string
  description: string
  steps: FirebaseWorkflowStep[]
}

export interface FirebaseWorkflowDocument {
  name: string
  description: string
  accessTier: string
  sortOrder: number
  activities: FirebaseWorkflowActivity[]
}
