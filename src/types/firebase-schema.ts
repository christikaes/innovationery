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
}

export interface FirebaseWorkflowCard {
  id: string
  activityId: string
  activityTitle: string
  activityIndex: number
  sectionId: string
  authorId: string
  authorName: string
  text: string
  createdAt: string
}

export interface FirebaseWorkflowSectionState {
  id: string
  activityId: string
  activityTitle: string
  activityDescription: string
  activityIndex: number
  cards: FirebaseWorkflowCard[]
}

export interface FirebaseRoomWorkflowState {
  currentStepIndex: number
  startedAt: string | null
  steps: Record<string, FirebaseWorkflowStepState>
  sections: Record<string, FirebaseWorkflowSectionState>
}

export interface FirebaseRoomDocument {
  workflowId: string | null
  workflowState: FirebaseRoomWorkflowState
  members: Record<string, FirebaseRoomMember>
}

export interface FirebaseWorkflowStep {
  id: string
  title: string
  description: string
  type: string
  durationMinutes: number | null
  prompt: string
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
  activities: FirebaseWorkflowActivity[]
}
