import { useEffect, useRef, useState } from 'react'
import {
  EmailAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase.js'

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function shuffleArray(items) {
  const nextItems = [...items]

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentValue = nextItems[index]

    nextItems[index] = nextItems[swapIndex]
    nextItems[swapIndex] = currentValue
  }

  return nextItems
}

const fallbackRoomTemplates = [
  {
    id: 'hackathon',
    name: 'Hackathon Brainstorm',
    description: 'Guide teams from introductions into shared problem discovery and selection.',
    workflow: {
      title: 'Hackathon brainstorm workflow',
      description: 'Warm up the room, surface candidate problems, then converge on a single problem statement.',
      totalMinutes: 21,
      activities: [
        {
          title: 'Icebreaker',
          steps: [
            {
              title: 'Introduction',
              description: 'Each participant introduces themselves.',
              activityType: 'roundrobin',
              durationMinutes: 1,
            },
            {
              title: 'Fun facts',
              description: 'Each participant shares a fun fact.',
              activityType: 'roundrobin',
              durationMinutes: 1,
            },
            {
              title: 'Hackathon goals',
              description: 'Each participant shares what they hope to get out of the hackathon.',
              activityType: 'roundrobin',
              durationMinutes: 1,
            },
            {
              title: 'Why mental health matters',
              description: 'Each participant shares why mental health is important to them.',
              activityType: 'roundrobin',
              durationMinutes: 2,
            },
          ],
        },
        {
          title: 'Problem statement brainstorm',
          steps: [
            {
              title: 'Brainstorm problems',
              description: 'Individually capture as many problems as possible.',
              activityType: 'individual stickies',
              durationMinutes: 3,
            },
            {
              title: 'Share and read out',
              description: 'Group members share and read out their problems.',
              activityType: 'group stickies',
              durationMinutes: 3,
            },
            {
              title: 'Vote on top problems',
              description: 'Vote on the strongest problem candidates.',
              activityType: 'voting',
              durationMinutes: 1,
            },
            {
              title: 'Discuss top three',
              description: 'Open discussion on the three strongest options.',
              activityType: 'open discuss',
              durationMinutes: 3,
            },
            {
              title: 'Choose the top problem',
              description: 'Vote to select a single problem to pursue.',
              activityType: 'voting',
              durationMinutes: 1,
            },
            {
              title: 'Refine the problem',
              description: 'Collaboratively tighten the final problem statement.',
              activityType: 'group fill in the blank',
              durationMinutes: 5,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'ideation',
    name: 'Ideation Sprint',
    description: 'Fast-moving room for collecting and shaping early product ideas.',
    pipeline: {
      title: 'From raw ideas to next bets',
      description: 'A quick facilitation flow for capturing, sorting, and prioritizing early concepts.',
      totalMinutes: 65,
      steps: [
        {
          title: 'Set the challenge',
          description: 'Frame the problem, goal, and boundaries for the session.',
          durationMinutes: 10,
        },
        {
          title: 'Generate ideas',
          description: 'Collect concepts, prompts, and bold options from the group.',
          durationMinutes: 20,
        },
        {
          title: 'Cluster signals',
          description: 'Group related ideas into themes or opportunity areas.',
          durationMinutes: 10,
        },
        {
          title: 'Vote on bets',
          description: 'Identify the strongest ideas using lightweight prioritization.',
          durationMinutes: 10,
        },
        {
          title: 'Assign next actions',
          description: 'Turn the winning concepts into owners and follow-up actions.',
          durationMinutes: 15,
        },
      ],
    },
  },
  {
    id: 'roadmap',
    name: 'Roadmap Planning',
    description: 'Structure initiatives, timelines, and ownership into a clear plan.',
    pipeline: {
      title: 'From priorities to a delivery plan',
      description: 'Shape initiatives into a sequenced roadmap with clear tradeoffs.',
      totalMinutes: 80,
      steps: [
        {
          title: 'Review goals',
          description: 'Align on business outcomes and planning constraints.',
          durationMinutes: 15,
        },
        {
          title: 'Assess initiatives',
          description: 'Compare candidate workstreams by impact and effort.',
          durationMinutes: 20,
        },
        {
          title: 'Sequence delivery',
          description: 'Organize the work into a practical order of execution.',
          durationMinutes: 20,
        },
        {
          title: 'Assign ownership',
          description: 'Set accountable owners for each initiative or milestone.',
          durationMinutes: 10,
        },
        {
          title: 'Capture risks',
          description: 'Record dependencies, blockers, and timeline assumptions.',
          durationMinutes: 15,
        },
      ],
    },
  },
  {
    id: 'design',
    name: 'Design Critique',
    description: 'Review flows, surfaces, and interaction decisions with focused feedback.',
    pipeline: {
      title: 'From review to design decisions',
      description: 'Move through a structured critique without drifting into vague feedback.',
      totalMinutes: 55,
      steps: [
        {
          title: 'Present the work',
          description: 'Show the flow and explain the design intent.',
          durationMinutes: 10,
        },
        {
          title: 'Clarify context',
          description: 'Answer questions about goals, constraints, and users.',
          durationMinutes: 10,
        },
        {
          title: 'Capture critique',
          description: 'Collect focused observations from the team.',
          durationMinutes: 15,
        },
        {
          title: 'Prioritize changes',
          description: 'Separate must-fix issues from optional improvements.',
          durationMinutes: 10,
        },
        {
          title: 'Confirm decisions',
          description: 'Document the next design moves and owners.',
          durationMinutes: 10,
        },
      ],
    },
  },
  {
    id: 'launch',
    name: 'Launch Readiness',
    description: 'Align product, marketing, and operations before release.',
    pipeline: {
      title: 'From checklist to launch confidence',
      description: 'Coordinate the final pre-launch review across every function involved.',
      totalMinutes: 75,
      steps: [
        {
          title: 'Check scope',
          description: 'Confirm the exact release scope and success criteria.',
          durationMinutes: 10,
        },
        {
          title: 'Review dependencies',
          description: 'Inspect product, support, legal, and marketing blockers.',
          durationMinutes: 20,
        },
        {
          title: 'Validate messaging',
          description: 'Align the announcement, positioning, and internal narrative.',
          durationMinutes: 15,
        },
        {
          title: 'Walk through support plan',
          description: 'Prepare issue routing, monitoring, and escalation paths.',
          durationMinutes: 15,
        },
        {
          title: 'Approve go-live',
          description: 'Make the final launch call and assign the live owner.',
          durationMinutes: 15,
        },
      ],
    },
  },
  {
    id: 'retro',
    name: 'Team Retro',
    description: 'Reflect on wins, friction points, and next improvements together.',
    pipeline: {
      title: 'From reflection to process change',
      description: 'Help the team identify what to keep, stop, and improve next.',
      totalMinutes: 60,
      steps: [
        {
          title: 'Set the tone',
          description: 'Establish a blameless frame for open reflection.',
          durationMinutes: 10,
        },
        {
          title: 'Capture highlights',
          description: 'List wins, misses, and moments worth discussing.',
          durationMinutes: 15,
        },
        {
          title: 'Find patterns',
          description: 'Group themes and expose recurring friction points.',
          durationMinutes: 15,
        },
        {
          title: 'Choose improvements',
          description: 'Select the highest-value process changes to try.',
          durationMinutes: 10,
        },
        {
          title: 'Assign follow-through',
          description: 'Set owners and checkpoints for the next sprint.',
          durationMinutes: 10,
        },
      ],
    },
  },
  {
    id: 'research',
    name: 'Research Review',
    description: 'Collect learnings, evidence, and decision signals from discovery work.',
    pipeline: {
      title: 'From evidence to decisions',
      description: 'Convert research findings into product implications and follow-ups.',
      totalMinutes: 70,
      steps: [
        {
          title: 'Review the brief',
          description: 'Restate the research questions and audience.',
          durationMinutes: 10,
        },
        {
          title: 'Share findings',
          description: 'Present evidence, quotes, and signal strength.',
          durationMinutes: 20,
        },
        {
          title: 'Map implications',
          description: 'Translate insights into product or strategy impact.',
          durationMinutes: 15,
        },
        {
          title: 'Prioritize decisions',
          description: 'Identify which decisions are now unblocked.',
          durationMinutes: 10,
        },
        {
          title: 'Plan follow-up research',
          description: 'Capture gaps and the next validation steps.',
          durationMinutes: 15,
        },
      ],
    },
  },
]

const workflowStepPalette = [
  {
    id: 'roundrobin',
    label: 'Round Robin',
    type: 'roundrobin',
    instructions: 'Each person takes a turn responding to a prompt.',
    input: [],
    outputs: [],
    data: {},
  },
  {
    id: 'individual-stickies',
    label: 'Individual Cards',
    type: 'individual stickies',
    instructions: 'People add cards privately before sharing.',
    input: [],
    outputs: ['CardList'],
    data: {},
  },
  {
    id: 'group-stickies',
    label: 'Group Cards',
    type: 'group stickies',
    instructions: 'The room groups and reviews cards together.',
    input: ['CardList'],
    outputs: ['CardList'],
    data: {},
  },
  {
    id: 'voting',
    label: 'Voting',
    type: 'voting',
    instructions: 'Participants vote on the strongest options.',
    input: ['CardList'],
    outputs: ['CardList'],
    data: {
      numberOfVotes: 'number',
    },
  },
  {
    id: 'open-discuss',
    label: 'Discussion',
    type: 'open discuss',
    instructions: 'Open discussion around a set of options or outputs.',
    input: ['Card', 'CardList', 'FillInTheBlankInputs'],
    outputs: [],
    data: {},
  },
  {
    id: 'group-fill',
    label: 'Fill In Blank',
    type: 'group fill in the blank',
    instructions: 'The room fills out a shared sentence together.',
    input: ['FillInTheBlankInputs', 'CardList'],
    outputs: ['FillInTheBlankInputs'],
    data: {
      text: 'string',
    },
  },
]

function createEditorId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function serializeWorkflowStep(step) {
  return {
    id: step?.id || createEditorId('step'),
    title: step?.title || 'Untitled step',
    description: step?.description || '',
    type: step?.activityType || step?.type || '',
    durationMinutes: toNumber(step?.durationMinutes) ?? 0,
    prompt: step?.prompt || '',
    data: step?.data && typeof step.data === 'object' ? step.data : {},
  }
}

function serializeWorkflowActivity(activity) {
  return {
    id: activity?.id || createEditorId('activity'),
    title: activity?.title || 'Untitled activity',
    description: activity?.description || '',
    steps: Array.isArray(activity?.steps) ? activity.steps.map(serializeWorkflowStep) : [],
  }
}

function serializeWorkflowDefinition(template) {
  const synchronizedTemplate = synchronizeWorkflowDefinition(template)
  const workflow = synchronizedTemplate?.workflow ?? {
    title: 'Untitled workflow',
    description: '',
    state: [],
    totalMinutes: 0,
    activities: [],
    steps: [],
    activityCount: 0,
    stepCount: 0,
  }

  return {
    name: workflow.title || template?.name || 'Untitled workflow',
    description: workflow.description || template?.description || '',
    activities: Array.isArray(workflow.activities)
      ? workflow.activities.map(serializeWorkflowActivity)
      : [],
  }
}

function createEmptyWorkflowDefinition(workflowId) {
  return normalizeRoomTemplate(workflowId, {
    id: workflowId,
    workflow: {
      title: 'Untitled workflow',
      description: '',
      state: [],
      totalMinutes: 0,
      activities: [
        {
          id: createEditorId('activity'),
          title: 'New Activity',
          description: '',
          steps: [],
        },
      ],
    },
  })
}

function getDefaultWorkflowDefinition(workflowId) {
  return (
    normalizedFallbackRoomTemplates.find((template) => template.id === workflowId) ??
    createEmptyWorkflowDefinition(workflowId)
  )
}

function getWorkflowPersistenceKey(template) {
  return JSON.stringify(serializeWorkflowDefinition(template))
}

function getStepTypeDefinition(activityType) {
  return (
    workflowStepPalette.find((item) => item.type === activityType) ??
    workflowStepPalette[0]
  )
}

function createStepDataFromDefinition(definition) {
  return Object.entries(definition?.data ?? {}).reduce((accumulator, [key, valueType]) => {
    accumulator[key] = valueType === 'number' ? 0 : valueType === 'boolean' ? false : ''
    return accumulator
  }, {})
}

function createWorkflowStep(activityType) {
  const definition = getStepTypeDefinition(activityType)

  return {
    id: createEditorId('step'),
    title: 'New step',
    prompt: '',
    description: '',
    activityType: definition.type,
    durationMinutes: 0,
    data: createStepDataFromDefinition(definition),
  }
}

function collectPersistedStatePaths(source, prefix = '') {
  if (Array.isArray(source)) {
    return source
      .flatMap((value) => collectPersistedStatePaths(value, prefix))
      .filter(Boolean)
  }

  if (typeof source === 'string') {
    const trimmedValue = source.trim()
    return trimmedValue ? [trimmedValue] : []
  }

  if (!source || typeof source !== 'object') {
    return prefix ? [prefix] : []
  }

  return Object.entries(source).flatMap(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    return collectPersistedStatePaths(value, nextPrefix)
  })
}

function normalizePersistedStatePaths(source) {
  const uniquePaths = new Set()

  collectPersistedStatePaths(source).forEach((path) => {
    if (typeof path !== 'string') {
      return
    }

    const normalizedPath = path.trim()

    if (!normalizedPath) {
      return
    }

    uniquePaths.add(normalizedPath)
  })

  return [...uniquePaths]
}

function getWorkflowStepStateKey(step, index = 0) {
  return step?.id || `step-${index + 1}`
}

function getDefaultStepStatePaths(step, index = 0) {
  const stepKey = getWorkflowStepStateKey(step, index)
  const statePaths = [
    `steps.${stepKey}.startTime`,
    `steps.${stepKey}.pauseTime`,
  ]

  switch (step?.activityType) {
    case 'individual stickies':
      statePaths.push(`steps.${stepKey}.cards`)
      break
    case 'group stickies':
      statePaths.push(`steps.${stepKey}.cards`, `steps.${stepKey}.groups`)
      break
    case 'voting':
      statePaths.push(`steps.${stepKey}.cards`, `steps.${stepKey}.groups`, `steps.${stepKey}.votes`)
      break
    case 'group fill in the blank':
      statePaths.push(`steps.${stepKey}.fillInTheBlank`)
      break
    default:
      break
  }

  return statePaths
}

function getWorkflowStateValueForPath(path) {
  if (path === 'currentStepIndex') {
    return 0
  }

  if (
    path.endsWith('.cards') ||
    path.endsWith('.groups') ||
    path.endsWith('.votes')
  ) {
    return []
  }

  if (path.endsWith('.fillInTheBlank')) {
    return ''
  }

  return null
}

function createWorkflowStateShape(paths) {
  const nextState = {}

  paths.forEach((path) => {
    const segments = path.split('.').filter(Boolean)

    if (segments.length === 0) {
      return
    }

    let cursor = nextState

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1

      if (isLeaf) {
        cursor[segment] = getWorkflowStateValueForPath(path)
        return
      }

      if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
        cursor[segment] = {}
      }

      cursor = cursor[segment]
    })
  })

  return nextState
}

function deriveWorkflowState(steps, workflowStateSource) {
  const uniquePaths = new Set(['currentStepIndex'])

  steps.forEach((step, index) => {
    getDefaultStepStatePaths(step, index).forEach((path) => {
      uniquePaths.add(path)
    })

  })

  normalizePersistedStatePaths(workflowStateSource).forEach((path) => {
    uniquePaths.add(path)
  })

  return createWorkflowStateShape([...uniquePaths])
}

function synchronizeWorkflowDefinition(template) {
  if (!template) {
    return template
  }

  const workflow = template.workflow ?? {}
  const activities = Array.isArray(workflow.activities) ? workflow.activities : []
  const steps =
    activities.length > 0
      ? activities.flatMap((activity) => activity.steps ?? [])
      : Array.isArray(workflow.steps)
        ? workflow.steps
        : []

  const synchronizedWorkflow = {
    ...workflow,
    activities,
    activityCount: activities.length,
    stepCount: steps.length,
    steps,
    state: deriveWorkflowState(steps, workflow.state),
  }

  return {
    ...template,
    workflow: synchronizedWorkflow,
    pipeline: synchronizedWorkflow,
  }
}

function normalizeWorkflowRuntime(runtime, steps) {
  const normalizedSteps = steps.reduce((accumulator, step, index) => {
    const stepKey = getWorkflowStepStateKey(step, index)
    const persistedStepState = runtime?.steps?.[stepKey]

    accumulator[stepKey] = {
      startTime:
        typeof persistedStepState?.startTime === 'string' ? persistedStepState.startTime : null,
      pauseTime:
        typeof persistedStepState?.pauseTime === 'string' ? persistedStepState.pauseTime : null,
    }

    return accumulator
  }, {})

  return {
    currentStepIndex: toNumber(runtime?.currentStepIndex) ?? 0,
    steps: normalizedSteps,
  }
}

function createWorkflowRuntimeForStep(steps, stepIndex, runtime, timestamp = new Date()) {
  const normalizedRuntime = normalizeWorkflowRuntime(runtime, steps)
  const boundedStepIndex =
    steps.length > 0 ? Math.max(0, Math.min(stepIndex, steps.length - 1)) : 0
  const stepKey = getWorkflowStepStateKey(steps[boundedStepIndex], boundedStepIndex)

  return {
    ...normalizedRuntime,
    currentStepIndex: boundedStepIndex,
    steps: {
      ...normalizedRuntime.steps,
      ...(stepKey
        ? {
            [stepKey]: {
              ...(normalizedRuntime.steps[stepKey] ?? {}),
              startTime: timestamp.toISOString(),
              pauseTime: null,
            },
          }
        : {}),
    },
  }
}

function completeWorkflowStepRuntime(steps, stepIndex, runtime, durationSeconds, timestamp = new Date()) {
  const normalizedRuntime = normalizeWorkflowRuntime(runtime, steps)
  const stepKey = getWorkflowStepStateKey(steps[stepIndex], stepIndex)

  if (!stepKey) {
    return normalizedRuntime
  }

  return {
    ...normalizedRuntime,
    currentStepIndex: stepIndex,
    steps: {
      ...normalizedRuntime.steps,
      [stepKey]: {
        ...(normalizedRuntime.steps[stepKey] ?? {}),
        startTime: new Date(timestamp.getTime() - Math.max(0, durationSeconds) * 1000).toISOString(),
        pauseTime: null,
      },
    },
  }
}

function getStepRemainingSeconds(durationSeconds, stepRuntime, now = new Date()) {
  if (durationSeconds <= 0) {
    return 0
  }

  const startTimeMs = Date.parse(stepRuntime?.startTime ?? '')

  if (!Number.isFinite(startTimeMs)) {
    return durationSeconds
  }

  const pauseTimeMs = Date.parse(stepRuntime?.pauseTime ?? '')
  const effectiveEndTimeMs = Number.isFinite(pauseTimeMs) ? pauseTimeMs : now.getTime()
  const elapsedSeconds = Math.max(0, Math.floor((effectiveEndTimeMs - startTimeMs) / 1000))

  return Math.max(0, durationSeconds - elapsedSeconds)
}

const normalizedFallbackRoomTemplates = fallbackRoomTemplates.map((template) =>
  normalizeRoomTemplate(template.id, template),
)

function remapWorkflowSelection(selectedNode, previousActivities, nextActivities) {
  if (!selectedNode) {
    return selectedNode
  }

  if (selectedNode.type === 'activity') {
    const selectedActivityId = previousActivities[selectedNode.activityIndex]?.id
    const nextActivityIndex = nextActivities.findIndex((activity) => activity.id === selectedActivityId)

    return {
      type: 'activity',
      activityIndex: nextActivityIndex >= 0 ? nextActivityIndex : 0,
      stepIndex: null,
    }
  }

  const selectedActivityId = previousActivities[selectedNode.activityIndex]?.id
  const selectedStepId =
    previousActivities[selectedNode.activityIndex]?.steps?.[selectedNode.stepIndex ?? -1]?.id

  for (let activityIndex = 0; activityIndex < nextActivities.length; activityIndex += 1) {
    const stepIndex = nextActivities[activityIndex].steps.findIndex((step) => step.id === selectedStepId)

    if (stepIndex >= 0) {
      return {
        type: 'step',
        activityIndex,
        stepIndex,
      }
    }
  }

  const nextActivityIndex = nextActivities.findIndex((activity) => activity.id === selectedActivityId)

  return {
    type: 'activity',
    activityIndex: nextActivityIndex >= 0 ? nextActivityIndex : 0,
    stepIndex: null,
  }
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePipelineStep(step, index) {
  if (typeof step === 'string') {
    return {
      id: `step-${index + 1}`,
      title: step,
      description: '',
      activityType: '',
      durationMinutes: null,
      prompt: '',
      data: {},
    }
  }

  if (!step || typeof step !== 'object') {
    return {
      id: `step-${index + 1}`,
      title: `Step ${index + 1}`,
      description: '',
      activityType: '',
      durationMinutes: null,
      prompt: '',
      data: {},
    }
  }

  const activityType = step.activityType || step.type || step.format || ''
  const stepTypeDefinition = getStepTypeDefinition(activityType)
  const normalizedData = createStepDataFromDefinition(stepTypeDefinition)

  Object.entries(step.data && typeof step.data === 'object' ? step.data : {}).forEach(([key, value]) => {
    normalizedData[key] = value
  })

  return {
    id: step.id || `step-${index + 1}`,
    title: step.title || step.name || step.label || `Step ${index + 1}`,
    description: step.description || step.summary || '',
    activityType,
    durationMinutes: toNumber(
      step.durationMinutes ?? step.minutes ?? step.duration,
    ),
    prompt: step.prompt || '',
    data: normalizedData,
  }
}

function normalizePipelineSegment(segment, index) {
  if (typeof segment === 'string') {
    return {
      id: `segment-${index + 1}`,
      title: segment,
      description: '',
      steps: [],
    }
  }

  if (!segment || typeof segment !== 'object') {
    return {
      id: `segment-${index + 1}`,
      title: `Segment ${index + 1}`,
      description: '',
      steps: [],
    }
  }

  const stepsSource = segment.steps ?? segment.items ?? []
  const steps = stepsSource.map((step, stepIndex) =>
    normalizePipelineStep(step, stepIndex),
  )
  return {
    id: segment.id || `segment-${index + 1}`,
    title: segment.title || segment.name || segment.label || `Segment ${index + 1}`,
    description: segment.description || segment.summary || '',
    steps,
  }
}

function normalizeRoomTemplate(id, template) {
  const hasFlatWorkflowShape =
    typeof template?.name === 'string' ||
    typeof template?.description === 'string' ||
    Array.isArray(template?.activities)
  const workflowSource = hasFlatWorkflowShape
    ? {
        title: template?.name,
        description: template?.description,
        activities: template?.activities,
      }
    : template?.workflow ?? template?.pipeline ?? {}
  const activitiesSource =
    template?.workflowActivities ??
    template?.pipelineSegments ??
    workflowSource.activities ??
    workflowSource.segments ??
    []
  const activities = activitiesSource.map(normalizePipelineSegment)
  const hasActivities = activities.length > 0
  const stepsSource = template?.workflowSteps ?? template?.pipelineSteps ?? workflowSource.steps ?? []
  const steps = hasActivities
    ? activities.flatMap((activity) => activity.steps)
    : stepsSource.map(normalizePipelineStep)
  const summedMinutes = steps.reduce(
    (total, step) => total + (step.durationMinutes ?? 0),
    0,
  )
  const totalMinutes =
    toNumber(template?.totalMinutes ?? workflowSource.totalMinutes) ??
    (summedMinutes > 0 ? summedMinutes : null)

  const workflow = {
    title:
      workflowSource.title ||
      template?.workflowTitle ||
      template?.pipelineTitle ||
      'How this room moves from kickoff to action',
    description:
      workflowSource.description ||
      template?.workflowDescription ||
      template?.pipelineDescription ||
      '',
    state: workflowSource.state ?? [],
    totalMinutes,
    activities,
    activityCount: activities.length,
    stepCount: steps.length,
    steps,
  }

  return synchronizeWorkflowDefinition({
    id,
    name:
      workflow.title || template?.name || template?.title || 'Untitled workflow',
    description:
      workflow.description || template?.description || '',
    sortOrder: toNumber(template?.sortOrder) ?? Number.MAX_SAFE_INTEGER,
    workflow,
    pipeline: workflow,
  })
}

const EMAIL_STORAGE_KEY = 'innovationery:email-link-email'
const PENDING_AUTH_KEY = 'innovationery:pending-auth'
const subscriptionTiers = [
  {
    name: 'Starter',
    price: 'Free',
    summary: 'For lightweight workshops, pilots, and early team rituals.',
    details: 'Up to 10 members per room',
    cta: 'Start free',
    featured: false,
    features: [
      'Unlimited rooms',
      'Core facilitation templates',
      'Basic realtime collaboration',
      'Email link recovery',
    ],
  },
  {
    name: 'Team',
    price: '$39',
    cadence: '/month',
    summary: 'For recurring product teams running active sessions every week.',
    details: 'Up to 50 members per room',
    cta: 'Talk to sales',
    featured: true,
    features: [
      'Everything in Starter',
      'Priority room performance',
      'Admin controls for facilitators',
      'Exportable session summaries',
    ],
  },
  {
    name: 'Business',
    price: '$119',
    cadence: '/month',
    summary: 'For larger programs coordinating cross-functional rooms at scale.',
    details: 'Up to 250 members per room',
    cta: 'Talk to sales',
    featured: false,
    features: [
      'Everything in Team',
      'Admin dashboard',
      'Advanced reporting',
      'Dedicated onboarding support',
    ],
  },
]

const gradientButtonBaseClass =
  'inline-flex items-center justify-center rounded-[999px] bg-gradient-to-br from-slate-950 to-slate-700 text-slate-50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60'
const gradientButtonMediumClass = `${gradientButtonBaseClass} min-h-12 px-5 text-sm font-medium`
const gradientButtonCompactClass = `${gradientButtonBaseClass} min-h-11 px-5 text-sm font-medium`
const secondaryButtonMediumClass =
  'inline-flex min-h-12 items-center justify-center rounded-[999px] bg-slate-900/10 px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-900/15'
const sectionTabActiveClass =
  'border-slate-900/15 border-b-white bg-white text-slate-950 shadow-[var(--theme-shadow-soft)]'
const sectionTabInactiveClass =
  'border-transparent bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-900'

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function createMemberKey(email, name) {
  const source = (email || name).trim().toLowerCase()
  return source.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest'
}

function createAvatarUrl(email, name) {
  const seedSource = email ?? name ?? 'guest'
  const seed = String(seedSource).trim().toLowerCase() || 'guest'
  return `https://robohash.org/${encodeURIComponent(seed)}?set=set3`
}

function downloadFacilitationGuide() {
  const guideLines = [
    'Brainstorm Facilitation Guide',
    '',
    'Open strong',
    'Set the challenge, success criteria, and timebox before ideas start flowing.',
    '',
    'Keep the room moving',
    'Move from solo idea capture into sharing, clustering, and quick voting without losing pace.',
    '',
    'End with action',
    'Close every brainstorm with a decision, owners, and the next experiment to run.',
  ]

  const escapedLines = guideLines.map((line) =>
    line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'),
  )

  const contentStream = [
    'BT',
    '/F1 22 Tf',
    '50 770 Td',
    `(${escapedLines[0]}) Tj`,
    '0 -34 Td',
    '/F1 12 Tf',
    `(${escapedLines[2]}) Tj`,
    '0 -18 Td',
    `(${escapedLines[3]}) Tj`,
    '0 -34 Td',
    `(${escapedLines[5]}) Tj`,
    '0 -18 Td',
    `(${escapedLines[6]}) Tj`,
    '0 -34 Td',
    `(${escapedLines[8]}) Tj`,
    '0 -18 Td',
    `(${escapedLines[9]}) Tj`,
    'ET',
  ].join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += object
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'innovationery-brainstorm-facilitation-guide.pdf'
  link.click()
  window.URL.revokeObjectURL(url)
}

function navigateToRoom(roomId) {
  window.location.assign(`/room/${encodeURIComponent(roomId)}`)
}

function normalizeMembers(room, persistedMembers) {
  if (persistedMembers.length > 0) {
    return persistedMembers
  }

  const nestedMembers = room?.members
  if (Array.isArray(nestedMembers)) {
    return nestedMembers
  }

  if (nestedMembers && typeof nestedMembers === 'object') {
    return Object.values(nestedMembers)
  }

  return Object.entries(room ?? {})
    .filter(([key, value]) => key.startsWith('members.') && value && typeof value === 'object')
    .map(([, value]) => value)
}

function normalizeRoomWorkflowState(workflowStateSource, steps) {
  const runtime = normalizeWorkflowRuntime(workflowStateSource, steps)
  const sectionsSource =
    workflowStateSource?.sections && typeof workflowStateSource.sections === 'object'
      ? workflowStateSource.sections
      : {}

  const sections = Object.entries(sectionsSource).reduce((accumulator, [sectionId, section]) => {
    if (!section || typeof section !== 'object') {
      return accumulator
    }

    accumulator[sectionId] = {
      id: sectionId,
      activityId:
        typeof section.activityId === 'string' && section.activityId.trim()
          ? section.activityId
          : sectionId,
      activityTitle: typeof section.activityTitle === 'string' ? section.activityTitle : '',
      activityDescription:
        typeof section.activityDescription === 'string' ? section.activityDescription : '',
      activityIndex: toNumber(section.activityIndex) ?? 0,
      cards: Array.isArray(section.cards) ? section.cards.filter(Boolean) : [],
    }

    return accumulator
  }, {})

  return {
    currentStepIndex: runtime.currentStepIndex,
    startedAt:
      typeof workflowStateSource?.startedAt === 'string' ? workflowStateSource.startedAt : null,
    steps: runtime.steps,
    sections,
  }
}

function normalizeRoomDocument(room) {
  const normalizedMembersSource =
    room?.members && typeof room.members === 'object' && !Array.isArray(room.members)
      ? room.members
      : {}

  return {
    workflowId: typeof room?.workflowId === 'string' ? room.workflowId : null,
    workflowState:
      room?.workflowState && typeof room.workflowState === 'object' ? room.workflowState : {},
    members: Object.entries(normalizedMembersSource).reduce((accumulator, [memberId, member]) => {
      if (!member || typeof member !== 'object') {
        return accumulator
      }

      accumulator[memberId] = {
        ...member,
        id: member.id || memberId,
      }
      return accumulator
    }, {}),
  }
}

function hasStrictRoomSchema(room) {
  if (!room || typeof room !== 'object' || Array.isArray(room)) {
    return false
  }

  const keys = Object.keys(room)

  return keys.every((key) => ['workflowId', 'workflowState', 'members'].includes(key))
}

function hasStrictWorkflowSchema(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return false
  }

  const keys = Object.keys(workflow)

  return keys.every((key) => ['name', 'description', 'activities', 'steps'].includes(key))
}

async function updateRoomDocument(roomId, updater) {
  const roomRef = doc(db, 'rooms', roomId)
  const snapshot = await getDoc(roomRef)
  const currentRoom = normalizeRoomDocument(snapshot.exists() ? snapshot.data() : null)
  const nextRoom = normalizeRoomDocument(updater(currentRoom) ?? currentRoom)
  await setDoc(roomRef, nextRoom)
}

function getMemberDisplayName(member) {
  return member?.name?.trim() || member?.email?.trim() || 'Guest'
}

function resolveStageLabel(stageValue) {
  if (typeof stageValue === 'string') {
    const trimmed = stageValue.trim()
    return trimmed || null
  }

  if (typeof stageValue === 'number') {
    return `Stage ${stageValue}`
  }

  if (!stageValue || typeof stageValue !== 'object') {
    return null
  }

  return (
    stageValue.title ||
    stageValue.name ||
    stageValue.label ||
    stageValue.status ||
    null
  )
}

function getRoomCurrentStage(room) {
  const currentStepIndex = toNumber(room?.workflowState?.currentStepIndex)

  if (currentStepIndex !== null) {
    return currentStepIndex > 0 ? `Step ${currentStepIndex + 1}` : 'Ready to start'
  }

  const directStage =
    resolveStageLabel(room?.currentActivity) ||
    resolveStageLabel(room?.currentStage) ||
    resolveStageLabel(room?.currentStep) ||
    resolveStageLabel(room?.stage) ||
    resolveStageLabel(room?.activity) ||
    resolveStageLabel(room?.status)

  if (directStage) {
    return directStage
  }

  return room?.workflowId ? 'Waiting for workflow' : 'No workflow assigned'
}

function readPendingAuthContext() {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_AUTH_KEY) || 'null')
  } catch {
    return null
  }
}

function writePendingAuthContext(context) {
  window.localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(context))
  window.localStorage.setItem(EMAIL_STORAGE_KEY, context.email)
}

function clearPendingAuthContext() {
  window.localStorage.removeItem(PENDING_AUTH_KEY)
  window.localStorage.removeItem(EMAIL_STORAGE_KEY)
}

function getActionCodeSettings(roomId) {
  return {
    url: `${window.location.origin}/room/${encodeURIComponent(roomId)}`,
    handleCodeInApp: true,
  }
}

async function ensureActiveUser() {
  if (auth.currentUser) {
    return auth.currentUser
  }

  const credentials = await signInAnonymously(auth)
  return credentials.user
}

async function upsertRoomMembership({
  roomId,
  workflowId,
  name,
  email,
  authUser,
  created = false,
}) {
  const normalizedName = name.trim()
  const normalizedEmail = email.trim().toLowerCase()
  const resolvedUser = authUser ?? auth.currentUser
  const memberKey = resolvedUser?.uid ?? createMemberKey(email, name)
  const isVerified = Boolean(resolvedUser && !resolvedUser.isAnonymous && resolvedUser.emailVerified)
  const member = {
    id: memberKey,
    authUid: resolvedUser?.uid ?? null,
    name: normalizedName,
    email: normalizedEmail,
    isOnline: true,
    isVerified,
    joinedAt: new Date().toISOString(),
  }
  const userRef = doc(db, 'users', memberKey)

  await setDoc(
    userRef,
    {
      id: memberKey,
      authUid: resolvedUser?.uid ?? null,
      name: normalizedName,
      email: normalizedEmail,
      isAnonymous: resolvedUser?.isAnonymous ?? false,
      isVerified,
      lastJoinedRoomId: roomId,
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )

  await updateRoomDocument(roomId, (currentRoom) => {
    const resolvedWorkflowId =
      workflowId ?? currentRoom.workflowId ?? null

    return {
      workflowId: resolvedWorkflowId,
      workflowState: currentRoom.workflowState ?? {},
      members: {
        ...currentRoom.members,
        [memberKey]: {
          ...member,
          lastSeenAt: new Date().toISOString(),
          createdAt:
            currentRoom.members?.[memberKey]?.createdAt ??
            (created ? new Date().toISOString() : null),
        },
      },
    }
  })

  return member
}

function HomePage() {
  const [activeTab, setActiveTab] = useState('join')
  const [roomTemplates, setRoomTemplates] = useState(
    normalizedFallbackRoomTemplates,
  )
  const [templatesStatus, setTemplatesStatus] = useState('loading')
  const [selectedRoomType, setSelectedRoomType] = useState(fallbackRoomTemplates[0].id)
  const [joinForm, setJoinForm] = useState({
    roomId: '',
    name: '',
    email: '',
  })
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
  })
  const [createRoomIdPreview, setCreateRoomIdPreview] = useState(() => createRoomId())
  const [joinError, setJoinError] = useState('')
  const [createError, setCreateError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'workflows'),
      (snapshot) => {
        if (snapshot.empty) {
          setRoomTemplates(
            normalizedFallbackRoomTemplates,
          )
          setTemplatesStatus('empty')
          return
        }

        const templates = snapshot.docs
          .map((templateDoc) => {
            const templateData = templateDoc.data()
            const normalizedTemplate = normalizeRoomTemplate(templateDoc.id, templateData)

            if (!hasStrictWorkflowSchema(templateData)) {
              void setDoc(
                doc(db, 'workflows', templateDoc.id),
                serializeWorkflowDefinition(normalizedTemplate),
              )
            }

            return normalizedTemplate
          })
          .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
              return left.sortOrder - right.sortOrder
            }

            return (left.workflow?.title ?? '').localeCompare(right.workflow?.title ?? '')
          })

        setRoomTemplates(templates)
        setTemplatesStatus('ready')
      },
      () => {
        setRoomTemplates(
          normalizedFallbackRoomTemplates,
        )
        setTemplatesStatus('error')
      },
    )

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!roomTemplates.some((template) => template.id === selectedRoomType)) {
      setSelectedRoomType(roomTemplates[0]?.id ?? '')
    }
  }, [roomTemplates, selectedRoomType])

  const selectedTemplate =
    roomTemplates.find((template) => template.id === selectedRoomType) ??
    roomTemplates[0] ??
    null

  async function handleJoinSubmit(event) {
    event.preventDefault()
    setJoinError('')

    const roomId = joinForm.roomId.trim().toUpperCase()
    const name = joinForm.name.trim()
    const email = joinForm.email.trim().toLowerCase()

    if (!roomId || !name || !email) {
      setJoinError('Enter a room id, name, and email to join.')
      return
    }

    setJoinLoading(true)

    try {
      const activeUser = await ensureActiveUser()
      const flow = {
        roomId,
        workflowId: null,
        name,
        email,
        created: false,
      }

      writePendingAuthContext(flow)

      try {
        await sendSignInLinkToEmail(auth, email, getActionCodeSettings(roomId))
      } catch {
        clearPendingAuthContext()
      }

      await upsertRoomMembership({
        roomId,
        workflowId: null,
        name,
        email,
        authUser: activeUser,
      })
      navigateToRoom(roomId)
    } catch {
      setJoinError('Unable to join the room right now. Check Firebase setup and try again.')
    } finally {
      setJoinLoading(false)
    }
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    setCreateError('')

    const roomId = createRoomIdPreview.trim().toUpperCase()
    const name = createForm.name.trim()
    const email = createForm.email.trim().toLowerCase()

    if (!roomId || !name || !email) {
      setCreateError('Enter a room id, name, and email to create a room.')
      return
    }

    if (!selectedTemplate) {
      setCreateError('No room template is available yet.')
      return
    }

    setCreateLoading(true)

    try {
      const activeUser = await ensureActiveUser()
      const flow = {
        roomId,
        workflowId: selectedTemplate.id,
        name,
        email,
        created: true,
      }

      writePendingAuthContext(flow)

      try {
        await sendSignInLinkToEmail(auth, email, getActionCodeSettings(roomId))
      } catch {
        clearPendingAuthContext()
      }

      await upsertRoomMembership({
        roomId,
        workflowId: selectedTemplate.id,
        name,
        email,
        authUser: activeUser,
        created: true,
      })
      navigateToRoom(roomId)
    } catch {
      setCreateError('Unable to create the room right now. Check Firebase setup and try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[image:var(--theme-bg-home)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl content-center gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/80 px-6 py-10 shadow-[var(--theme-shadow-soft)] backdrop-blur md:px-10 md:py-14">
          <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[image:var(--theme-orb-home)]" />
          <p className="relative mb-4 text-xs uppercase tracking-[0.24em] text-slate-800">
            Innovation starts here
          </p>
          <h1 className="relative font-serif text-6xl leading-none tracking-tight text-slate-900 sm:text-7xl lg:text-[6.5rem]">
            in·no·va·tion·er·y
          </h1>
          <p className="relative mt-4 text-sm font-medium tracking-[0.08em] text-slate-500 sm:text-base">
            /ˌinəˈvāSHəˌnerē/
          </p>
          <p className="relative mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            <span className="font-semibold text-slate-700">noun</span>
            {' '}
            the tools, rituals, and shared momentum teams use to turn bold ideas
            into breakthrough products, experiments, and real forward motion.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/room/demo-room"
              className={gradientButtonMediumClass}
            >
              Demo
            </a>
            <a
              href="#brainstorming-rooms"
              className={secondaryButtonMediumClass}
            >
              Brainstorm
            </a>
            <a
              href="#facilitation"
              className={secondaryButtonMediumClass}
            >
              Facilitation
            </a>
            <a
              href="#plans"
              className={secondaryButtonMediumClass}
            >
              Plans
            </a>
          </div>
        </section>

        <section
          id="brainstorming-rooms"
          className="rounded-[2rem] border border-slate-900/10 bg-white/75 p-4 shadow-[var(--theme-shadow-soft)] backdrop-blur sm:p-5 md:p-6"
        >
          <div className="px-2 pb-4 pt-1 sm:px-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
              Start fast, join live, keep momentum.
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Brainstorming Rooms
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Launch a new facilitated room in minutes or jump into an active session with the room code.
            </p>
          </div>
          <div className="flex gap-2 border-b border-slate-900/10 px-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`inline-flex min-h-12 items-center justify-center rounded-t-[1.5rem] border border-b-0 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition sm:text-base ${
                activeTab === 'join'
                  ? sectionTabActiveClass
                  : sectionTabInactiveClass
              }`}
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`inline-flex min-h-12 items-center justify-center rounded-t-[1.5rem] border border-b-0 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition sm:text-base ${
                activeTab === 'create'
                  ? sectionTabActiveClass
                  : sectionTabInactiveClass
              }`}
            >
              Create Room
            </button>
          </div>

          {activeTab === 'join' ? (
            <div className="mt-4 rounded-[1.75rem] border border-slate-900/10 bg-[image:var(--theme-panel-gradient)] p-6 sm:p-8">
              <form
                onSubmit={handleJoinSubmit}
                className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
              >
                <div className="lg:col-span-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
                      Join an active room
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                      Enter the room details and jump in.
                    </h2>
                  </div>
                  <button
                    type="submit"
                    disabled={joinLoading}
                    className={`${gradientButtonMediumClass} shrink-0`}
                  >
                    {joinLoading ? 'Joining...' : 'Join Room'}
                  </button>
                </div>
                <div className="lg:col-span-2 grid gap-4 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-slate-50 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <label className="grid gap-2 text-sm font-medium text-slate-50">
                    Room Number
                    <input
                      type="text"
                      value={joinForm.roomId}
                      onChange={(event) =>
                        setJoinForm((current) => ({
                          ...current,
                          roomId: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="ABCD12"
                      className="min-h-28 rounded-[1.75rem] border border-white/10 bg-white/10 px-5 text-3xl font-semibold uppercase tracking-[0.24em] text-white outline-none transition placeholder:text-slate-50/35 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20 sm:min-h-32 sm:text-4xl"
                    />
                  </label>
                  <div className="grid gap-4 self-end">
                    <label className="grid gap-2 text-sm font-medium text-slate-50">
                      Your Name
                      <input
                        type="text"
                        value={joinForm.name}
                        onChange={(event) =>
                          setJoinForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Enter your name"
                        className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-50/45 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-slate-50">
                      Email
                      <input
                        type="email"
                        value={joinForm.email}
                        onChange={(event) =>
                          setJoinForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        placeholder="Enter your email"
                        className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-50/45 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20"
                      />
                    </label>
                  </div>
                  {joinError ? (
                    <p className="lg:col-span-2 text-sm font-medium text-rose-300">
                      {joinError}
                    </p>
                  ) : null}
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.75rem] border border-slate-900/10 bg-[image:var(--theme-panel-gradient)] p-6 sm:p-8">
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="lg:col-span-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
                        Create New Room
                      </p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                        Start a {selectedTemplate?.workflow?.title ?? 'new'} room
                      </h2>
                    </div>
                    <button
                      type="submit"
                      disabled={createLoading || !selectedTemplate}
                      className={`${gradientButtonMediumClass} shrink-0`}
                    >
                      {createLoading ? 'Preparing...' : 'Create Room'}
                    </button>
                  </div>
                  <div className="lg:col-span-2 grid gap-4 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-slate-50 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <label className="grid gap-2 text-sm font-medium text-slate-50">
                      Room Number
                    <input
                      type="text"
                      value={createRoomIdPreview}
                      onChange={(event) => setCreateRoomIdPreview(event.target.value.toUpperCase())}
                      placeholder="ABCD12"
                      className="min-h-28 rounded-[1.75rem] border border-white/10 bg-white/10 px-5 text-3xl font-semibold uppercase tracking-[0.24em] text-white outline-none sm:min-h-32 sm:text-4xl"
                    />
                    </label>
                    <div className="grid gap-4 self-end">
                      <label className="grid gap-2 text-sm font-medium text-slate-50">
                        Your Name
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Enter your name"
                          className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-50/45 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-50">
                        Email
                        <input
                          type="email"
                          value={createForm.email}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          placeholder="Enter your email"
                          className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-50/45 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20"
                        />
                      </label>
                    </div>
                    {createError ? (
                      <p className="lg:col-span-2 text-sm font-medium text-rose-300">{createError}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="rounded-[1.5rem] border border-slate-900/10 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
                          Room Types
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                          Pick a brainstorm format
                        </h2>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {roomTemplates.length} templates
                      </span>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Room types"
                      className="max-h-[24rem] space-y-3 overflow-y-auto pr-1"
                    >
                      {roomTemplates.map((roomType) => {
                        const isEnabled = roomType.id === 'hackathon' || roomType.id === 'ideation'
                        const isSelected = selectedRoomType === roomType.id

                        return (
                          <button
                            key={roomType.id}
                            type="button"
                            onClick={() => {
                              if (isEnabled) {
                                setSelectedRoomType(roomType.id)
                              }
                            }}
                            disabled={!isEnabled}
                            role="radio"
                            aria-checked={isSelected}
                            aria-disabled={!isEnabled}
                            className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
                              isSelected
                                ? 'border-slate-950 bg-slate-950 text-slate-50 shadow-[var(--theme-shadow-strong)]'
                                : isEnabled
                                  ? 'border-slate-900/10 bg-slate-50/60 hover:border-slate-700/40 hover:bg-slate-50'
                                  : 'cursor-not-allowed border-slate-900/10 bg-slate-100/70 opacity-55'
                            }`}
                          >
                            <span className="block min-w-0">
                              <span className="flex items-center justify-between gap-3">
                                <span className={`block text-lg font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                  {roomType.workflow?.title ?? 'Untitled workflow'}
                                </span>
                                {roomType.id === 'hackathon' || roomType.id === 'ideation' ? (
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] ${
                                    isSelected ? 'bg-white/10 text-slate-50' : 'bg-slate-900 text-white'
                                  }`}>
                                    Free
                                  </span>
                                ) : null}
                              </span>
                              <span className={`mt-2 block text-sm leading-6 ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                                {roomType.workflow?.description ?? ''}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {templatesStatus === 'ready' ? (
                      <p className="mt-4 text-sm text-slate-500">
                        Room templates are loading live from the Firestore `workflows` collection.
                      </p>
                    ) : null}
                    {templatesStatus === 'error' ? (
                      <p className="mt-4 text-sm text-rose-700">
                        Firestore templates could not be loaded, so fallback template data is being shown.
                      </p>
                    ) : null}
                  </div>

                  <div className="relative rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-slate-50 sm:p-6">
                    <div
                      aria-hidden="true"
                      className="absolute left-[-14px] top-16 hidden h-7 w-7 rotate-45 border-b border-l border-slate-900/20 bg-slate-950 lg:block"
                    />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-200/80">
                      Workflow
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {selectedTemplate?.workflow?.title ?? 'No workflow available'}
                    </h2>
                    {selectedTemplate?.workflow?.description ? (
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100/80">
                        {selectedTemplate.workflow?.description}
                      </p>
                    ) : null}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-100/70">Activities / steps</p>
                        <p className="mt-2 text-3xl font-semibold">
                          {selectedTemplate
                            ? `${selectedTemplate.workflow?.activities?.length || 1} / ${selectedTemplate.workflow?.steps?.length ?? 0}`
                            : '0 / 0'}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-100/70">Total time</p>
                        <p className="mt-2 text-3xl font-semibold">
                          {selectedTemplate?.workflow?.totalMinutes
                            ? `${selectedTemplate.workflow?.totalMinutes} min`
                            : 'Custom'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {((selectedTemplate?.workflow?.activities?.length ?? 0) > 0
                        ? selectedTemplate?.workflow?.activities ?? []
                        : [
                            {
                              id: 'default-activity',
                              title: 'Workflow',
                              description: '',
                              totalMinutes: selectedTemplate?.workflow?.totalMinutes ?? null,
                              steps: selectedTemplate?.workflow?.steps ?? [],
                            },
                          ]
                      ).map((activity, activityIndex) => (
                        <section
                          key={activity.id}
                          className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm uppercase tracking-[0.18em] text-slate-200/75">
                              Activity {activityIndex + 1}
                            </p>
                            <h3 className="text-lg font-semibold text-white">{activity.title}</h3>
                            {activity.totalMinutes ? (
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-100/80">
                                {activity.totalMinutes} min
                              </span>
                            ) : null}
                          </div>
                          {activity.description ? (
                            <p className="mt-2 text-sm leading-6 text-slate-100/75">
                              {activity.description}
                            </p>
                          ) : null}
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-100/75">
                            <span className="rounded-full bg-slate-950/40 px-3 py-1">
                              {activity.steps.length} steps
                            </span>
                            <span>Open the room to view step details.</span>
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}
        </section>

        <section
          id="facilitation"
          className="rounded-[2rem] border border-slate-900/10 bg-white/75 p-6 shadow-[var(--theme-shadow-soft)] backdrop-blur sm:p-7 md:p-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
                Download the facilitator playbook.
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Facilitation Toolkit
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
                Grab a concise guide with the prompts, timeboxes, and closing moves that help brainstorms stay focused and productive.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadFacilitationGuide}
              className={`${gradientButtonMediumClass} shrink-0`}
            >
              Download PDF
            </button>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <article className="rounded-[1.75rem] border border-slate-900/10 bg-slate-50/70 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-700">Before the room</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">Frame the challenge</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Use the guide to define a sharper prompt, set a realistic timebox, and explain what a strong outcome looks like.
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-slate-900/10 bg-slate-50/70 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-700">During the session</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">Keep energy moving</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Follow a simple flow for silent idea generation, fast sharing, clustering, and lightweight voting without losing momentum.
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-slate-900/10 bg-slate-50/70 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-700">After the session</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">Turn ideas into action</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Wrap with decision prompts, owners, and next steps so the brainstorm ends with traction instead of a loose pile of notes.
              </p>
            </article>
          </div>
        </section>

        <section
          id="plans"
          className="rounded-[2rem] border border-slate-900/10 bg-white/75 p-6 shadow-[var(--theme-shadow-soft)] backdrop-blur sm:p-7 md:p-8"
        >
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
              Plans that fit one room or a whole program
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Plans
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              Start free for small workshops, then upgrade when you need larger rooms, facilitator controls, and reporting.
            </p>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-3">
            {subscriptionTiers.map((tier) => (
              <article
                key={tier.name}
                className={`relative overflow-hidden rounded-[1.75rem] border p-7 shadow-[var(--theme-shadow-soft)] ${
                  tier.featured
                    ? 'border-slate-900 bg-white/95 text-slate-900'
                    : 'border-slate-900/10 bg-white/85 text-slate-900'
                }`}
              >
                <div
                  className={`absolute -bottom-14 -right-8 h-40 w-40 rounded-full ${
                    tier.featured
                      ? 'bg-[image:var(--theme-orb-featured)]'
                      : 'bg-[image:var(--theme-orb-standard)]'
                  }`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-semibold">{tier.name}</h3>
                    {tier.featured ? (
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white">
                        Most Popular
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {tier.summary}
                  </p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className="text-5xl font-semibold tracking-tight">
                      {tier.price}
                    </span>
                    {tier.cadence ? (
                      <span className="pb-1 text-sm text-slate-500">
                        {tier.cadence}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-3 rounded-full px-4 py-2 text-sm font-medium ${
                      tier.featured
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {tier.details}
                  </p>
                  <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-600">
                    {tier.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <a
                    href={tier.cta === 'Talk to sales' ? 'mailto:hello@innovationery.app' : '#'}
                    className={`${gradientButtonMediumClass} mt-8`}
                  >
                    {tier.cta}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer
          id="footer-contact"
          className="rounded-[2rem] border border-slate-900/10 bg-white/85 px-6 py-8 text-slate-900 shadow-[var(--theme-shadow-soft)] sm:px-8"
        >
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-700">
                Contact
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Need a larger rollout or custom onboarding?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Reach out for enterprise pricing, implementation support, or product questions.
              </p>
            </div>

            <div className="grid justify-items-center gap-4 text-sm leading-6 text-slate-600">
              <a
                href="mailto:hello@innovationery.app"
                className={gradientButtonMediumClass}
              >
                Contact us
              </a>
              <a
                href="mailto:hello@innovationery.app"
                className="text-center text-lg font-medium text-slate-900"
              >
                hello@innovationery.app
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

function AdminPage() {
  const [rooms, setRooms] = useState([])
  const [roomStatus, setRoomStatus] = useState('loading')
  const [workflowSeedStatus, setWorkflowSeedStatus] = useState('loading')
  const memberCounts = rooms.reduce((counts, room) => {
    counts[room.id] = normalizeMembers(room, []).length
    return counts
  }, {})

  useEffect(() => {
    let cancelled = false

    async function ensureDefaultWorkflow() {
      const hackathonTemplate =
        normalizedFallbackRoomTemplates.find((template) => template.id === 'hackathon') ?? null

      if (!hackathonTemplate) {
        if (!cancelled) {
          setWorkflowSeedStatus('error')
        }
        return
      }

      try {
        const workflowRef = doc(db, 'workflows', hackathonTemplate.id)
        const snapshot = await getDoc(workflowRef)

        if (!snapshot.exists()) {
          await setDoc(workflowRef, serializeWorkflowDefinition(hackathonTemplate))
        }

        if (!cancelled) {
          setWorkflowSeedStatus('ready')
        }
      } catch {
        if (!cancelled) {
          setWorkflowSeedStatus('error')
        }
      }
    }

    void ensureDefaultWorkflow()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'rooms'),
      (snapshot) => {
        const nextRooms = snapshot.docs.map((roomDoc) => ({
          id: roomDoc.id,
          ...normalizeRoomDocument(roomDoc.data()),
        }))

        nextRooms.sort((left, right) => {
          const leftMemberCount = Object.keys(left.members ?? {}).length
          const rightMemberCount = Object.keys(right.members ?? {}).length

          if (leftMemberCount !== rightMemberCount) {
            return rightMemberCount - leftMemberCount
          }

          return left.id.localeCompare(right.id)
        })

        setRooms(nextRooms)
        setRoomStatus('ready')
      },
      () => {
        setRooms([])
        setRoomStatus('error')
      },
    )

    return unsubscribe
  }, [])

  return (
    <main className="min-h-screen bg-[image:var(--theme-bg-admin)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/85 px-6 py-10 shadow-[var(--theme-shadow-soft)] backdrop-blur md:px-10 md:py-14">
          <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-[image:var(--theme-orb-admin)]" />
          <p className="relative text-xs uppercase tracking-[0.24em] text-slate-700">
            Admin
          </p>
          <div className="relative mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-5xl leading-tight tracking-tight text-slate-900 sm:text-6xl">
                Active rooms
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Live overview of room ids, room types, current stage, and member counts from Firestore.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/admin/workflows/hackathon"
                className={secondaryButtonMediumClass}
              >
                Edit workflows
              </a>
              <a
                href="/"
                className={gradientButtonMediumClass}
              >
                Back home
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-slate-900/10 bg-white/85 p-5 shadow-[var(--theme-shadow-soft)]">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-700">Rooms</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{rooms.length}</p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-900/10 bg-white/85 p-5 shadow-[var(--theme-shadow-soft)]">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-700">Members</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {Object.values(memberCounts).reduce((total, count) => total + count, 0)}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-900/10 bg-white/85 p-5 shadow-[var(--theme-shadow-soft)]">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-700">Sync</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {roomStatus === 'ready' && workflowSeedStatus === 'ready'
                ? 'Live'
                : workflowSeedStatus === 'error'
                  ? 'Issue'
                  : 'Loading'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ensures the default hackathon workflow exists in Firestore.
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/90 shadow-[var(--theme-shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/10 px-6 py-5">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-700">
                Firestore rooms
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Room operations dashboard
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {rooms.length} active
            </span>
          </div>

          {roomStatus === 'loading' ? (
            <p className="px-6 py-10 text-base text-slate-600">Loading rooms...</p>
          ) : null}
          {roomStatus === 'error' ? (
            <p className="px-6 py-10 text-base text-rose-700">
              Unable to load the admin room list from Firestore.
            </p>
          ) : null}
          {roomStatus === 'ready' && rooms.length === 0 ? (
            <p className="px-6 py-10 text-base text-slate-600">
              No rooms have been created yet.
            </p>
          ) : null}

          {roomStatus === 'ready' && rooms.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Room
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Room type
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Current stage
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Members
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-t border-slate-900/10 align-top">
                      <td className="px-6 py-5">
                        <div>
                          <a
                            href={`/room/${encodeURIComponent(room.id)}`}
                            className="text-base font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-600"
                          >
                            {room.roomId || room.id}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {room.workflowId || 'No workflow'}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {getRoomCurrentStage(room)}
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-sm font-medium text-slate-900">
                          {memberCounts[room.id] ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {memberCounts[room.id] > 0 ? 'Active members' : 'No activity yet'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function WorkflowEditorPage({ workflowId }) {
  const [workflowDefinition, setWorkflowDefinition] = useState(null)
  const [editorStatus, setEditorStatus] = useState('loading')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [selectedNode, setSelectedNode] = useState({ type: 'activity', activityIndex: 0, stepIndex: null })
  const persistedKeyRef = useRef('')

  useEffect(() => {
    const workflowRef = doc(db, 'workflows', workflowId)
    const unsubscribe = onSnapshot(
      workflowRef,
      (snapshot) => {
        const nextWorkflow = snapshot.exists()
          ? normalizeRoomTemplate(snapshot.id, snapshot.data())
          : getDefaultWorkflowDefinition(workflowId)
        const nextKey = snapshot.exists() ? getWorkflowPersistenceKey(nextWorkflow) : ''

        persistedKeyRef.current = nextKey
        setWorkflowDefinition((current) => {
          if (current && getWorkflowPersistenceKey(current) === getWorkflowPersistenceKey(nextWorkflow)) {
            return current
          }

          return synchronizeWorkflowDefinition(nextWorkflow)
        })
        setEditorStatus('ready')
      },
      () => {
        setWorkflowDefinition(synchronizeWorkflowDefinition(getDefaultWorkflowDefinition(workflowId)))
        setEditorStatus('error')
      },
    )

    return unsubscribe
  }, [workflowId])

  useEffect(() => {
    if (editorStatus !== 'ready' || !workflowDefinition) {
      return undefined
    }

    const nextKey = getWorkflowPersistenceKey(workflowDefinition)

    if (nextKey === persistedKeyRef.current) {
      return undefined
    }

    setSaveStatus('saving')

    const timeoutId = window.setTimeout(() => {
      void setDoc(
        doc(db, 'workflows', workflowId),
        serializeWorkflowDefinition(workflowDefinition),
      )
        .then(() => {
          persistedKeyRef.current = nextKey
          setSaveStatus('saved')
        })
        .catch(() => {
          setSaveStatus('error')
        })
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [editorStatus, workflowDefinition, workflowId])

  useEffect(() => {
    if (!workflowDefinition) {
      return
    }

    const selectedActivity = workflowDefinition.workflow?.activities?.[selectedNode.activityIndex]

    if (!selectedActivity) {
      setSelectedNode({ type: 'activity', activityIndex: 0, stepIndex: null })
      return
    }

    if (selectedNode.type === 'step') {
      const selectedStep = selectedActivity.steps[selectedNode.stepIndex ?? -1]

      if (!selectedStep) {
        setSelectedNode({ type: 'activity', activityIndex: selectedNode.activityIndex, stepIndex: null })
      }
    }
  }, [selectedNode, workflowDefinition])

  useEffect(() => {
    if (!workflowDefinition) {
      return
    }

    const synchronizedDefinition = synchronizeWorkflowDefinition(workflowDefinition)

    if (getWorkflowPersistenceKey(synchronizedDefinition) === getWorkflowPersistenceKey(workflowDefinition)) {
      return
    }

    setWorkflowDefinition(synchronizedDefinition)
  }, [workflowDefinition])

  const updateWorkflowField = (field, value) => {
    setWorkflowDefinition((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    )
  }

  const updateWorkflowMeta = (field, value) => {
    setWorkflowDefinition((current) =>
      current
        ? {
            ...current,
            workflow: {
              ...current.workflow,
              [field]: value,
            },
          }
        : current,
    )
  }

  const addActivity = () => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      const nextActivities = [
        ...current.workflow.activities,
        {
          id: createEditorId('activity'),
          title: 'New Activity',
          description: '',
          totalMinutes: null,
          steps: [],
        },
      ]

      setSelectedNode({ type: 'activity', activityIndex: nextActivities.length - 1, stepIndex: null })

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: nextActivities,
        },
      }
    })
  }

  const updateActivity = (activityIndex, field, value) => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: current.workflow.activities.map((activity, index) =>
            index === activityIndex
              ? {
                  ...activity,
                  [field]: value,
                }
              : activity,
          ),
        },
      }
    })
  }

  const removeActivity = (activityIndex) => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: current.workflow.activities.filter((_, index) => index !== activityIndex),
        },
      }
    })
    setSelectedNode((current) => ({
      type: 'activity',
      activityIndex: Math.max(0, activityIndex - 1),
      stepIndex: null,
    }))
  }

  const addStepToActivity = (activityIndex, activityType = workflowStepPalette[0].type) => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      const nextStep = createWorkflowStep(activityType)
      const nextStepIndex = current.workflow.activities[activityIndex]?.steps.length ?? 0

      setSelectedNode({ type: 'step', activityIndex, stepIndex: nextStepIndex })

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: current.workflow.activities.map((activity, index) =>
            index === activityIndex
              ? {
                  ...activity,
                  steps: [...activity.steps, nextStep],
                }
              : activity,
          ),
        },
      }
    })
  }

  const updateStep = (activityIndex, stepIndex, field, value) => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: current.workflow.activities.map((activity, activityCursor) =>
            activityCursor === activityIndex
              ? {
                  ...activity,
                  steps: activity.steps.map((step, stepCursor) =>
                    stepCursor === stepIndex
                      ? {
                          ...step,
                          ...(field === 'activityType'
                            ? {
                                activityType: value,
                                data: createStepDataFromDefinition(getStepTypeDefinition(value)),
                              }
                            : {
                                [field]: value,
                              }),
                        }
                      : step,
                  ),
                }
              : activity,
          ),
        },
      }
    })
  }

  const removeStep = (activityIndex, stepIndex) => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: current.workflow.activities.map((activity, index) =>
            index === activityIndex
              ? {
                  ...activity,
                  steps: activity.steps.filter((_, stepCursor) => stepCursor !== stepIndex),
                }
              : activity,
          ),
        },
      }
    })
  }

  const moveActivity = (sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) {
      return
    }

    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      const previousActivities = current.workflow.activities
      const nextActivities = [...previousActivities]
      const [movedActivity] = nextActivities.splice(sourceIndex, 1)

      if (!movedActivity) {
        return current
      }

      const boundedTargetIndex = Math.max(0, Math.min(targetIndex, nextActivities.length))
      nextActivities.splice(boundedTargetIndex, 0, movedActivity)
      setSelectedNode((selection) =>
        remapWorkflowSelection(selection, previousActivities, nextActivities),
      )

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: nextActivities,
        },
      }
    })
  }

  const moveActivityByOffset = (activityIndex, offset) => {
    const targetIndex = activityIndex + offset

    if (
      !workflowDefinition ||
      targetIndex < 0 ||
      targetIndex >= workflowDefinition.workflow.activities.length
    ) {
      return
    }

    moveActivity(activityIndex, targetIndex)
  }

  const moveStep = (sourceActivityIndex, sourceStepIndex, targetActivityIndex, targetStepIndex) => {
    setWorkflowDefinition((current) => {
      if (!current) {
        return current
      }

      const previousActivities = current.workflow.activities
      const nextActivities = previousActivities.map((activity) => ({
        ...activity,
        steps: [...activity.steps],
      }))
      const sourceActivity = nextActivities[sourceActivityIndex]
      const targetActivity = nextActivities[targetActivityIndex]

      if (!sourceActivity || !targetActivity) {
        return current
      }

      const [movedStep] = sourceActivity.steps.splice(sourceStepIndex, 1)

      if (!movedStep) {
        return current
      }

      let boundedTargetStepIndex = Math.max(0, Math.min(targetStepIndex, targetActivity.steps.length))

      if (
        sourceActivityIndex === targetActivityIndex &&
        sourceStepIndex < boundedTargetStepIndex
      ) {
        boundedTargetStepIndex -= 1
      }

      targetActivity.steps.splice(boundedTargetStepIndex, 0, movedStep)
      setSelectedNode((selection) =>
        remapWorkflowSelection(selection, previousActivities, nextActivities),
      )

      return {
        ...current,
        workflow: {
          ...current.workflow,
          activities: nextActivities,
        },
      }
    })
  }

  const moveStepByOffset = (activityIndex, stepIndex, offset) => {
    const activity = workflowDefinition?.workflow?.activities?.[activityIndex]

    if (!activity) {
      return
    }

    if (offset < 0) {
      if (stepIndex > 0) {
        moveStep(activityIndex, stepIndex, activityIndex, stepIndex - 1)
        return
      }

      const previousActivity = workflowDefinition?.workflow?.activities?.[activityIndex - 1]

      if (!previousActivity) {
        return
      }

      moveStep(activityIndex, stepIndex, activityIndex - 1, previousActivity.steps.length)
      return
    }

    if (offset > 0) {
      if (stepIndex < activity.steps.length - 1) {
        moveStep(activityIndex, stepIndex, activityIndex, stepIndex + 2)
        return
      }

      const nextActivity = workflowDefinition?.workflow?.activities?.[activityIndex + 1]

      if (!nextActivity) {
        return
      }

      moveStep(activityIndex, stepIndex, activityIndex + 1, 0)
    }
  }

  const selectedActivity = workflowDefinition?.workflow?.activities?.[selectedNode.activityIndex] ?? null
  const selectedStep =
    selectedNode.type === 'step' && selectedActivity
      ? selectedActivity.steps[selectedNode.stepIndex ?? -1] ?? null
      : null
  const selectedStepTypeDefinition = selectedStep
    ? getStepTypeDefinition(selectedStep.activityType)
    : null
  const workflowStatePreview = JSON.stringify(
    deriveWorkflowState(
      workflowDefinition?.workflow?.steps ?? [],
      workflowDefinition?.workflow?.state ?? {},
    ),
    null,
    2,
  )

  if (editorStatus === 'loading' || !workflowDefinition) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[image:var(--theme-bg-admin)] px-5 py-6 text-slate-900">
        <div className="rounded-[1.5rem] border border-slate-900/10 bg-white/85 px-6 py-5 shadow-[var(--theme-shadow-soft)]">
          Loading workflow editor...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[image:var(--theme-bg-admin)] px-5 py-6 text-slate-900 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded-[2rem] border border-slate-900/10 bg-white/85 px-6 py-8 shadow-[var(--theme-shadow-soft)] backdrop-blur md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-700">Admin Workflow Editor</p>
              <h1 className="mt-3 font-serif text-4xl tracking-tight text-slate-900 sm:text-5xl">
                {workflowDefinition.workflow.title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Select an activity or step, edit its configuration, and save directly to Firestore.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {saveStatus === 'saving'
                  ? 'Saving...'
                  : saveStatus === 'saved'
                    ? 'Saved'
                    : saveStatus === 'error'
                      ? 'Save error'
                      : 'Ready'}
              </span>
              <a href="/admin" className={gradientButtonMediumClass}>
                Back to admin
              </a>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Workflow Title
              <input
                type="text"
                value={workflowDefinition.workflow.title}
                onChange={(event) => updateWorkflowMeta('title', event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Workflow Description
              <textarea
                value={workflowDefinition.workflow.description}
                onChange={(event) => updateWorkflowMeta('description', event.target.value)}
                className="min-h-24 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Workflow State
              <textarea
                value={workflowStatePreview}
                readOnly
                className="min-h-36 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none"
              />
              <p className="text-xs text-slate-500">
                Auto-derived list of workflow state keys that will be persisted to Firebase for this workflow.
              </p>
            </label>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <aside className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-5 shadow-[var(--theme-shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-700">Activities</p>
                <p className="mt-1 text-sm text-slate-500">Select an activity or step to edit it.</p>
              </div>
              <button type="button" onClick={addActivity} className={gradientButtonCompactClass}>
                + Activity
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {workflowDefinition.workflow.activities.map((activity, activityIndex) => {
                const isSelectedActivity =
                  selectedNode.type === 'activity' && selectedNode.activityIndex === activityIndex
                const canMoveActivityUp = activityIndex > 0
                const canMoveActivityDown =
                  activityIndex < workflowDefinition.workflow.activities.length - 1

                return (
                  <section
                    key={activity.id || `activity-${activityIndex + 1}`}
                    onClick={() =>
                      setSelectedNode({ type: 'activity', activityIndex, stepIndex: null })
                    }
                    className={`rounded-[1.5rem] border px-4 py-4 transition ${
                      isSelectedActivity
                        ? 'border-slate-950 bg-slate-950 text-white shadow-[var(--theme-shadow-strong)]'
                        : 'border-slate-900/10 bg-white text-slate-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 cursor-pointer text-left">
                        <p className={`text-xs uppercase tracking-[0.18em] ${
                          isSelectedActivity ? 'text-slate-300' : 'text-slate-500'
                        }`}>
                          Activity {activityIndex + 1}
                        </p>
                        <h3 className={`mt-1 truncate text-base font-semibold ${
                          isSelectedActivity ? 'text-white' : 'text-slate-900'
                        }`}>
                          {activity.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canMoveActivityUp}
                          onClick={(event) => {
                            event.stopPropagation()
                            moveActivityByOffset(activityIndex, -1)
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            isSelectedActivity
                              ? 'border border-white/20 text-white hover:bg-white/10 disabled:border-white/10 disabled:text-slate-500 disabled:hover:bg-transparent'
                              : 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent'
                          }`}
                        >
                          ^
                        </button>
                        <button
                          type="button"
                          disabled={!canMoveActivityDown}
                          onClick={(event) => {
                            event.stopPropagation()
                            moveActivityByOffset(activityIndex, 1)
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            isSelectedActivity
                              ? 'border border-white/20 text-white hover:bg-white/10 disabled:border-white/10 disabled:text-slate-500 disabled:hover:bg-transparent'
                              : 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent'
                          }`}
                        >
                          v
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            addStepToActivity(activityIndex)
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            isSelectedActivity
                              ? 'border border-white/20 text-white hover:bg-white/10'
                              : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          + Step
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            removeActivity(activityIndex)
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            isSelectedActivity
                              ? 'border border-white/20 text-white hover:bg-white/10'
                              : 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {activity.steps.length > 0 ? (
                        activity.steps.map((step, stepIndex) => {
                          const isSelectedStep =
                            selectedNode.type === 'step' &&
                            selectedNode.activityIndex === activityIndex &&
                            selectedNode.stepIndex === stepIndex
                          const canMoveStepUp = stepIndex > 0 || activityIndex > 0
                          const canMoveStepDown =
                            stepIndex < activity.steps.length - 1 ||
                            activityIndex < workflowDefinition.workflow.activities.length - 1

                          return (
                            <div
                              key={step.id || `${activityIndex}-${stepIndex}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedNode({ type: 'step', activityIndex, stepIndex })
                              }}
                              className={`rounded-2xl px-3 py-3 text-sm ${
                                isSelectedStep
                                  ? 'bg-slate-950 text-white'
                                  : 'bg-slate-50 text-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 cursor-pointer text-left">
                                  <p className="truncate font-medium">{step.title || `Step ${stepIndex + 1}`}</p>
                                  <p className={`mt-1 text-xs ${isSelectedStep ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {step.activityType || 'Step'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!canMoveStepUp}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      moveStepByOffset(activityIndex, stepIndex, -1)
                                    }}
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                      isSelectedStep
                                        ? 'border border-white/20 text-white hover:bg-white/10 disabled:border-white/10 disabled:text-slate-500 disabled:hover:bg-transparent'
                                        : 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent'
                                    }`}
                                  >
                                    ^
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveStepDown}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      moveStepByOffset(activityIndex, stepIndex, 1)
                                    }}
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                      isSelectedStep
                                        ? 'border border-white/20 text-white hover:bg-white/10 disabled:border-white/10 disabled:text-slate-500 disabled:hover:bg-transparent'
                                        : 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent'
                                    }`}
                                  >
                                    v
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      removeStep(activityIndex, stepIndex)
                                    }}
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                      isSelectedStep
                                        ? 'border border-white/20 text-white hover:bg-white/10'
                                        : 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                                    }`}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                          No steps yet.
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </aside>

          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto space-y-5">
            {selectedActivity ? (
                <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-5 shadow-[var(--theme-shadow-soft)]">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-700">
                    {selectedNode.type === 'activity' ? 'Activity Configuration' : 'Step Configuration'}
                  </p>
                  {selectedNode.type === 'activity' ? (
                    <div className="mt-4 grid gap-4">
                      <label className="grid gap-2 text-sm font-medium text-slate-800">
                        Activity Title
                        <input
                          type="text"
                          value={selectedActivity.title}
                          onChange={(event) =>
                            updateActivity(selectedNode.activityIndex, 'title', event.target.value)
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                        />
                      </label>
                    </div>
                  ) : selectedStep ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-800 lg:col-span-2">
                        Step Type
                        <select
                          value={selectedStep.activityType || ''}
                          onChange={(event) =>
                            updateStep(
                              selectedNode.activityIndex,
                              selectedNode.stepIndex,
                              'activityType',
                              event.target.value,
                            )
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                        >
                          {workflowStepPalette.map((paletteItem) => (
                            <option key={paletteItem.id} value={paletteItem.type}>
                              {paletteItem.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-800">
                        Step Title
                        <input
                          type="text"
                          value={selectedStep.title || ''}
                          onChange={(event) =>
                            updateStep(selectedNode.activityIndex, selectedNode.stepIndex, 'title', event.target.value)
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-800">
                        Duration Minutes
                        <input
                          type="number"
                          min="0"
                          value={selectedStep.durationMinutes ?? 0}
                          onChange={(event) =>
                            updateStep(
                              selectedNode.activityIndex,
                              selectedNode.stepIndex,
                              'durationMinutes',
                              Number(event.target.value) || 0,
                            )
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-800 lg:col-span-2">
                        Prompt
                        <input
                          type="text"
                          value={selectedStep.prompt || ''}
                          onChange={(event) =>
                            updateStep(selectedNode.activityIndex, selectedNode.stepIndex, 'prompt', event.target.value)
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-800 lg:col-span-2">
                        Description
                        <textarea
                          value={selectedStep.description || ''}
                          onChange={(event) =>
                            updateStep(
                              selectedNode.activityIndex,
                              selectedNode.stepIndex,
                              'description',
                              event.target.value,
                            )
                          }
                          className="min-h-20 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                        />
                      </label>
                      {selectedStepTypeDefinition && Object.keys(selectedStepTypeDefinition.data).length > 0 ? (
                        <div className="grid gap-4 lg:col-span-2">
                          {Object.entries(selectedStepTypeDefinition.data).map(([dataKey, valueType]) => (
                            <label key={dataKey} className="grid gap-2 text-sm font-medium text-slate-800">
                              {dataKey}
                              {valueType === 'number' ? (
                                <input
                                  type="number"
                                  value={selectedStep.data?.[dataKey] ?? 0}
                                  onChange={(event) =>
                                    updateStep(
                                      selectedNode.activityIndex,
                                      selectedNode.stepIndex,
                                      'data',
                                      {
                                        ...(selectedStep.data ?? {}),
                                        [dataKey]: Number(event.target.value) || 0,
                                      },
                                    )
                                  }
                                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                                />
                              ) : valueType === 'boolean' ? (
                                <select
                                  value={selectedStep.data?.[dataKey] ? 'true' : 'false'}
                                  onChange={(event) =>
                                    updateStep(
                                      selectedNode.activityIndex,
                                      selectedNode.stepIndex,
                                      'data',
                                      {
                                        ...(selectedStep.data ?? {}),
                                        [dataKey]: event.target.value === 'true',
                                      },
                                    )
                                  }
                                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={selectedStep.data?.[dataKey] ?? ''}
                                  onChange={(event) =>
                                    updateStep(
                                      selectedNode.activityIndex,
                                      selectedNode.stepIndex,
                                      'data',
                                      {
                                        ...(selectedStep.data ?? {}),
                                        [dataKey]: event.target.value,
                                      },
                                    )
                                  }
                                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function RoomPage({ roomId }) {
  const [room, setRoom] = useState(null)
  const [authUser, setAuthUser] = useState(() => auth.currentUser)
  const [workflowDefinition, setWorkflowDefinition] = useState(null)
  const [workflowStatus, setWorkflowStatus] = useState('loading')
  const [brainstormDraft, setBrainstormDraft] = useState('')
  const [isSubmittingBrainstormCard, setIsSubmittingBrainstormCard] = useState(false)
  const [roomIdentityForm, setRoomIdentityForm] = useState(() => ({
    name: '',
    email: window.localStorage.getItem(EMAIL_STORAGE_KEY) || '',
  }))
  const [roomIdentityError, setRoomIdentityError] = useState('')
  const [roomIdentityLoading, setRoomIdentityLoading] = useState(false)
  const [status, setStatus] = useState('loading')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [roundRobinOrder, setRoundRobinOrder] = useState([])
  const [completedRoundRobinSpeakerIds, setCompletedRoundRobinSpeakerIds] = useState([])
  const isDemoRoom = roomId.trim().toLowerCase() === 'demo-room'
  const demoTemplate =
    normalizedFallbackRoomTemplates.find((template) => template.id === 'hackathon') ?? null

  useEffect(() => onAuthStateChanged(auth, setAuthUser), [])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRoom(null)
          setStatus('missing')
          return
        }

        setRoom(normalizeRoomDocument(snapshot.data()))
        setStatus('ready')
      },
      () => {
        setRoom(null)
        setStatus('error')
      },
    )

    return unsubscribe
  }, [roomId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!room || isDemoRoom || hasStrictRoomSchema(room)) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      void updateRoomDocument(roomId, (currentRoom) => currentRoom)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [isDemoRoom, room, roomId])

  useEffect(() => {
    if (!room?.workflowId) {
      setWorkflowDefinition(null)
      setWorkflowStatus('unassigned')
      return undefined
    }

    setWorkflowStatus('loading')

    const unsubscribe = onSnapshot(
      doc(db, 'workflows', room.workflowId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setWorkflowDefinition(null)
          setWorkflowStatus('missing')
          return
        }

        const nextWorkflowDefinition = normalizeRoomTemplate(snapshot.id, snapshot.data())
        const hasWorkflowContent =
          (nextWorkflowDefinition.workflow?.activities?.length ?? 0) > 0 ||
          (nextWorkflowDefinition.workflow?.steps?.length ?? 0) > 0

        setWorkflowDefinition(nextWorkflowDefinition)
        setWorkflowStatus(hasWorkflowContent ? 'ready' : 'empty')
      },
      () => {
        setWorkflowDefinition(null)
        setWorkflowStatus('error')
      },
    )

    return unsubscribe
  }, [room?.workflowId])

  const members = normalizeMembers(room, [])
    .sort((left, right) =>
      getMemberDisplayName(left).localeCompare(getMemberDisplayName(right)),
    )
  const currentMember =
    authUser
      ? members.find(
          (member) =>
            member.authUid === authUser.uid ||
            (authUser.email && member.email === authUser.email),
        ) ?? null
      : null

  useEffect(() => {
    if (!currentMember?.id) {
      return undefined
    }

    const setPresence = (isOnline) =>
      updateRoomDocument(roomId, (currentRoom) => ({
        workflowId: currentRoom.workflowId,
        workflowState: currentRoom.workflowState,
        members: {
          ...currentRoom.members,
          [currentMember.id]: {
            ...(currentRoom.members?.[currentMember.id] ?? currentMember),
            isOnline,
            lastSeenAt: new Date().toISOString(),
          },
        },
      }))

    void setPresence(true)

    const handleVisibilityChange = () => {
      void setPresence(document.visibilityState === 'visible')
    }

    const handlePageHide = () => {
      void setPresence(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      void setPresence(false)
    }
  }, [currentMember?.id, roomId])
  const roomWorkflow =
    workflowDefinition?.workflow ??
    (isDemoRoom ? demoTemplate?.workflow : null)
  const workflowTitle =
    workflowDefinition?.workflow?.title ??
    (isDemoRoom ? demoTemplate?.workflow?.title : null)
  const workflowActivities =
    roomWorkflow?.activities?.length
      ? roomWorkflow.activities
      : roomWorkflow?.steps?.length
        ? [
            {
              id: 'default-activity',
              title: roomWorkflow.title || 'Workflow',
              description: roomWorkflow.description || '',
              totalMinutes: roomWorkflow.totalMinutes ?? null,
              steps: roomWorkflow.steps,
            },
          ]
        : []
  const emptyWorkflowMessage =
    workflowStatus === 'loading'
      ? 'Loading workflow definition...'
      : workflowStatus === 'unassigned'
        ? 'This room does not have a workflowId yet.'
        : workflowStatus === 'missing'
          ? `Workflow "${room?.workflowId}" was not found in Firestore.`
          : workflowStatus === 'error'
            ? `Workflow "${room?.workflowId}" could not be loaded from Firestore. Check Firestore rules and network access.`
            : workflowStatus === 'empty'
              ? `Workflow "${room?.workflowId}" loaded, but it has no activities or steps.`
              : 'No workflow has been recorded for this room yet.'
  const workflowSequence = workflowActivities.flatMap((activity, activityIndex) =>
    activity.steps.map((step, stepIndex) => {
      const stepsBeforeActivity = workflowActivities
        .slice(0, activityIndex)
        .reduce((total, segment) => total + segment.steps.length, 0)

      return {
        ...step,
        activityId: activity.id || `activity-${activityIndex + 1}`,
        activityTitle: activity.title,
        activityDescription: activity.description,
        activityIndex,
        stepIndex,
        sequenceIndex: stepsBeforeActivity + stepIndex,
      }
    }),
  )
  const roomWorkflowState = normalizeRoomWorkflowState(room?.workflowState, workflowSequence)
  const workflowRuntime = normalizeWorkflowRuntime(roomWorkflowState, workflowSequence)
  const safeCurrentStepIndex =
    workflowSequence.length > 0
      ? Math.min(workflowRuntime.currentStepIndex, workflowSequence.length - 1)
      : 0
  const currentStep = workflowSequence[safeCurrentStepIndex] ?? null
  const currentStepRuntime = currentStep
    ? workflowRuntime.steps[getWorkflowStepStateKey(currentStep, safeCurrentStepIndex)] ?? null
    : null
  const hasWorkflowStarted = Boolean(roomWorkflowState.startedAt)
  const currentActivityIndex = currentStep?.activityIndex ?? 0
  const isRoundRobinStep = currentStep?.activityType === 'roundrobin'
  const isIndividualBrainstormStep = currentStep?.activityType === 'individual stickies'
  const isGroupBrainstormStep = currentStep?.activityType === 'group stickies'
  const currentStepDurationSeconds = (currentStep?.durationMinutes ?? 0) * 60
  const remainingSeconds = hasWorkflowStarted
    ? getStepRemainingSeconds(currentStepDurationSeconds, currentStepRuntime, new Date(nowMs))
    : 0
  const isPaused = Boolean(currentStepRuntime?.pauseTime)
  const roundRobinMembers = roundRobinOrder
    .map((memberId) => members.find((member) => member.id === memberId))
    .filter(Boolean)
  const roundRobinSpeakerCount = roundRobinMembers.length
  const activeRoundRobinMember =
    roundRobinMembers.find((member) => !completedRoundRobinSpeakerIds.includes(member.id)) ?? null
  const currentRoundRobinSpeakerIndex = activeRoundRobinMember
    ? Math.min(completedRoundRobinSpeakerIds.length + 1, roundRobinSpeakerCount)
    : 0
  const roundRobinProgressDots =
    isRoundRobinStep && roundRobinSpeakerCount > 1
      ? Array.from({ length: roundRobinSpeakerCount - 1 }, (_, index) => ((index + 1) / roundRobinSpeakerCount) * 100)
      : []
  const isWorkflowComplete =
    workflowSequence.length > 0 &&
    safeCurrentStepIndex === workflowSequence.length - 1 &&
    remainingSeconds === 0
  const currentStepProgressPercent =
    currentStepDurationSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((currentStepDurationSeconds - remainingSeconds) / currentStepDurationSeconds) * 100,
          ),
        )
      : 0
  const totalWorkflowSeconds = workflowSequence.reduce(
    (total, step) => total + (step.durationMinutes ?? 0) * 60,
    0,
  )
  const elapsedWorkflowSeconds = hasWorkflowStarted
    ? Math.min(
        totalWorkflowSeconds,
        workflowSequence
          .slice(0, safeCurrentStepIndex)
          .reduce((total, step) => total + (step.durationMinutes ?? 0) * 60, 0) +
          Math.max(0, currentStepDurationSeconds - remainingSeconds),
      )
    : 0
  const displayedElapsedMinutes =
    elapsedWorkflowSeconds > 0 ? Math.min(Math.ceil(elapsedWorkflowSeconds / 60), roomWorkflow?.totalMinutes ?? 0) : 0
  const displayedTotalMinutes = roomWorkflow?.totalMinutes ?? Math.round(totalWorkflowSeconds / 60)
  const roomCode = roomId
  const timerProgressPercent =
    displayedTotalMinutes > 0
      ? Math.min(100, Math.max(0, (displayedElapsedMinutes / displayedTotalMinutes) * 100))
      : 0
  const displayedCompletedSteps =
    workflowSequence.length > 0
      ? hasWorkflowStarted
        ? Math.min(safeCurrentStepIndex + 1, workflowSequence.length)
        : 0
      : 0
  const stepProgressPercent =
    workflowSequence.length > 0 ? (displayedCompletedSteps / workflowSequence.length) * 100 : 0
  const compactRadialCircumference = 2 * Math.PI * 18
  const currentSectionId = currentStep?.activityId ?? null
  const currentActivityCards = currentSectionId
    ? roomWorkflowState.sections?.[currentSectionId]?.cards ?? []
    : []
  const shouldRevealAllBrainstormCards = isGroupBrainstormStep
  const shouldPromptForRoomIdentity = !currentMember?.id && (status === 'ready' || isDemoRoom)
  const visibleBrainstormCardCount = currentActivityCards.filter(
    (card) => shouldRevealAllBrainstormCards || card.authorId === currentMember?.id,
  ).length
  const hiddenBrainstormCardCount = currentActivityCards.length - visibleBrainstormCardCount
  const persistWorkflowState = async (updater) => {
    await updateRoomDocument(roomId, (currentRoom) => {
      const currentWorkflowState = normalizeRoomWorkflowState(currentRoom.workflowState, workflowSequence)
      const nextWorkflowState =
        typeof updater === 'function' ? updater(currentWorkflowState) : updater

      return {
        workflowId: currentRoom.workflowId ?? room?.workflowId ?? demoTemplate?.id ?? null,
        workflowState: nextWorkflowState,
        members: currentRoom.members,
      }
    })
  }

  const startWorkflow = async () => {
    await persistWorkflowState((currentWorkflowState) => ({
      ...currentWorkflowState,
      startedAt: new Date().toISOString(),
      ...createWorkflowRuntimeForStep(workflowSequence, 0, currentWorkflowState),
    }))
  }

  const togglePauseState = async () => {
    if (!currentStep) {
      return
    }

    const stepKey = getWorkflowStepStateKey(currentStep, safeCurrentStepIndex)
    const timestamp = new Date()
    const currentStepState = workflowRuntime.steps[stepKey] ?? {
      startTime: timestamp.toISOString(),
      pauseTime: null,
    }

    if (isPaused) {
      const startTimeMs = Date.parse(currentStepState.startTime ?? '')
      const pauseTimeMs = Date.parse(currentStepState.pauseTime ?? '')

      if (!Number.isFinite(startTimeMs) || !Number.isFinite(pauseTimeMs)) {
        return
      }

      const resumedStartTime = new Date(
        startTimeMs + (timestamp.getTime() - pauseTimeMs),
      ).toISOString()

      await persistWorkflowState((currentWorkflowState) => ({
        ...currentWorkflowState,
        steps: {
          ...currentWorkflowState.steps,
          [stepKey]: {
            ...currentStepState,
            startTime: resumedStartTime,
            pauseTime: null,
          },
        },
      }))
      return
    }

    await persistWorkflowState((currentWorkflowState) => ({
      ...currentWorkflowState,
      steps: {
        ...currentWorkflowState.steps,
        [stepKey]: {
          ...currentStepState,
          pauseTime: timestamp.toISOString(),
        },
      },
    }))
  }

  const completeCurrentStep = async () => {
    if (!currentStep) {
      return
    }

    const timestamp = new Date()

    if (safeCurrentStepIndex < workflowSequence.length - 1) {
      await persistWorkflowState((currentWorkflowState) =>
        createWorkflowRuntimeForStep(
          workflowSequence,
          safeCurrentStepIndex + 1,
          currentWorkflowState,
          timestamp,
        ),
      )
      return
    }

    await persistWorkflowState((currentWorkflowState) =>
      completeWorkflowStepRuntime(
        workflowSequence,
        safeCurrentStepIndex,
        currentWorkflowState,
        currentStepDurationSeconds,
        timestamp,
      ),
    )
  }
  const submitBrainstormCard = async (event) => {
    event.preventDefault()

    const trimmedDraft = brainstormDraft.trim()

    if (!trimmedDraft || !currentMember?.id || !currentStep?.activityId || !isIndividualBrainstormStep) {
      return
    }

    setIsSubmittingBrainstormCard(true)

    try {
      await persistWorkflowState((currentWorkflowState) => {
        const currentSection = currentWorkflowState.sections?.[currentSectionId] ?? {
          id: currentSectionId,
          activityId: currentStep.activityId,
          activityTitle: currentStep.activityTitle ?? '',
          activityDescription: currentStep.activityDescription ?? '',
          activityIndex: currentStep.activityIndex ?? 0,
          cards: [],
        }

        return {
          ...currentWorkflowState,
          sections: {
            ...currentWorkflowState.sections,
            [currentSectionId]: {
              ...currentSection,
              cards: [
                ...currentSection.cards,
                {
                  id: createEditorId('card'),
                  activityId: currentStep.activityId,
                  activityTitle: currentStep.activityTitle ?? '',
                  activityIndex: currentStep.activityIndex ?? 0,
                  sectionId: currentSectionId,
                  authorId: currentMember.id,
                  authorName: getMemberDisplayName(currentMember),
                  text: trimmedDraft,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          },
        }
      })
      setBrainstormDraft('')
    } finally {
      setIsSubmittingBrainstormCard(false)
    }
  }
  const handleRoomIdentitySubmit = async (event) => {
    event.preventDefault()
    setRoomIdentityError('')

    const name = roomIdentityForm.name.trim()
    const email = roomIdentityForm.email.trim().toLowerCase()

    if (!name || !email) {
      setRoomIdentityError('Enter your name and email to continue in this room.')
      return
    }

    setRoomIdentityLoading(true)

    try {
      const activeUser = await ensureActiveUser()
      const flow = {
        roomId,
        workflowId: room?.workflowId ?? (isDemoRoom ? demoTemplate?.id ?? null : null),
        name,
        email,
        created: false,
      }

      writePendingAuthContext(flow)

      try {
        await sendSignInLinkToEmail(auth, email, getActionCodeSettings(roomId))
      } catch {
        clearPendingAuthContext()
      }

      await upsertRoomMembership({
        roomId,
        workflowId: room?.workflowId ?? (isDemoRoom ? demoTemplate?.id ?? null : null),
        name,
        email,
        authUser: activeUser,
      })
    } catch {
      setRoomIdentityError('Unable to join this room right now. Check Firebase setup and try again.')
    } finally {
      setRoomIdentityLoading(false)
    }
  }

  useEffect(() => {
    if (workflowSequence.length === 0 || !hasWorkflowStarted) {
      return undefined
    }

    const stepKey = getWorkflowStepStateKey(workflowSequence[safeCurrentStepIndex], safeCurrentStepIndex)

    if (workflowRuntime.steps[stepKey]?.startTime) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      void persistWorkflowState((currentWorkflowState) =>
        createWorkflowRuntimeForStep(
          workflowSequence,
          safeCurrentStepIndex,
          currentWorkflowState,
        ),
      )
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    hasWorkflowStarted,
    safeCurrentStepIndex,
    workflowSequence.length,
  ])

  useEffect(() => {
    if (hasWorkflowStarted) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setRoundRobinOrder([])
      setCompletedRoundRobinSpeakerIds([])
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [hasWorkflowStarted])

  useEffect(() => {
    if (!isRoundRobinStep) {
      const timeoutId = window.setTimeout(() => {
        setRoundRobinOrder([])
        setCompletedRoundRobinSpeakerIds([])
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    const randomizedMemberIds = shuffleArray(
      members
        .map((member) => member.id)
        .filter(Boolean),
    )

    const timeoutId = window.setTimeout(() => {
      setRoundRobinOrder(randomizedMemberIds)
      setCompletedRoundRobinSpeakerIds([])
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [currentStep?.sequenceIndex, isRoundRobinStep, members])

  useEffect(() => {
    if (
      !hasWorkflowStarted ||
      !isRoundRobinStep ||
      isPaused ||
      currentStepDurationSeconds <= 0 ||
      roundRobinSpeakerCount === 0
    ) {
      return
    }

    const elapsedSeconds = Math.min(
      currentStepDurationSeconds,
      Math.max(0, currentStepDurationSeconds - remainingSeconds),
    )
    const expectedCompletedSpeakerCount =
      remainingSeconds === 0
        ? roundRobinSpeakerCount
        : Math.min(
            roundRobinSpeakerCount - 1,
            Math.floor((elapsedSeconds * roundRobinSpeakerCount) / currentStepDurationSeconds),
          )

    if (expectedCompletedSpeakerCount <= completedRoundRobinSpeakerIds.length) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setCompletedRoundRobinSpeakerIds(
        roundRobinMembers
          .slice(0, expectedCompletedSpeakerCount)
          .map((member) => member.id)
          .filter(Boolean),
      )
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    completedRoundRobinSpeakerIds.length,
    currentStepDurationSeconds,
    hasWorkflowStarted,
    isPaused,
    isRoundRobinStep,
    remainingSeconds,
    roundRobinMembers,
    roundRobinSpeakerCount,
  ])

  useEffect(() => {
    if (!hasWorkflowStarted || !currentStep || workflowSequence.length === 0) {
      return undefined
    }

    if (isPaused) {
      return undefined
    }

    if (remainingSeconds === 0 && safeCurrentStepIndex < workflowSequence.length - 1) {
      const timeoutId = window.setTimeout(() => {
        void persistWorkflowState((currentWorkflowState) =>
          createWorkflowRuntimeForStep(
            workflowSequence,
            safeCurrentStepIndex + 1,
            currentWorkflowState,
          ),
        )
      }, 1200)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [
    currentStep,
    hasWorkflowStarted,
    isPaused,
    remainingSeconds,
    safeCurrentStepIndex,
    workflowSequence.length,
  ])

  return (
    <main className="min-h-screen bg-[image:var(--theme-bg-room)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      {shouldPromptForRoomIdentity ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-5 py-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] border border-slate-900/20 bg-[image:var(--theme-panel-gradient)] p-6 shadow-[var(--theme-shadow-modal)] sm:p-8">
            <form onSubmit={handleRoomIdentitySubmit} className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-800">
                    Join this room
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                    Enter your details to continue.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    We could not find your saved room identity on this device, so add it again to keep collaborating in {roomCode}.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={roomIdentityLoading}
                  className={`${gradientButtonMediumClass} shrink-0`}
                >
                  {roomIdentityLoading ? 'Joining...' : 'Continue'}
                </button>
              </div>

              <div className="grid gap-4 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-slate-50 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <label className="grid gap-2 text-sm font-medium text-slate-50">
                  Room Number
                  <input
                    type="text"
                    value={roomCode}
                    readOnly
                    className="min-h-28 rounded-[1.75rem] border border-white/10 bg-white/10 px-5 text-3xl font-semibold uppercase tracking-[0.24em] text-white outline-none sm:min-h-32 sm:text-4xl"
                  />
                </label>
                <div className="grid gap-4 self-end">
                  <label className="grid gap-2 text-sm font-medium text-slate-50">
                    Your Name
                    <input
                      type="text"
                      value={roomIdentityForm.name}
                      onChange={(event) =>
                        setRoomIdentityForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Enter your name"
                      className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-50/45 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-50">
                    Email
                    <input
                      type="email"
                      value={roomIdentityForm.email}
                      onChange={(event) =>
                        setRoomIdentityForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="Enter your email"
                      className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-50/45 focus:border-slate-200 focus:ring-2 focus:ring-slate-100/20"
                    />
                  </label>
                </div>
                {roomIdentityError ? (
                  <p className="text-sm font-medium text-rose-300 lg:col-span-2">
                    {roomIdentityError}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/85 px-5 py-4 shadow-[var(--theme-shadow-soft)] backdrop-blur md:px-6 md:py-4">
          <div className="absolute -right-12 top-0 h-56 w-56 rounded-full bg-[image:var(--theme-orb-room)]" />
          <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-700">
                Join with Room Code: {roomCode}
              </p>
              <h1 className="font-serif text-3xl leading-tight tracking-tight text-slate-900 sm:text-4xl">
                {workflowTitle ?? `Room ${roomId}`}
              </h1>
              <p className="mt-1 text-sm leading-5 text-slate-600 sm:text-base">
                {!hasWorkflowStarted
                  ? 'Ready to start the first activity.'
                  : currentStep
                    ? `${currentStep.activityTitle} > ${currentStep.title}`
                    : status === 'ready'
                      ? 'Waiting for the current activity.'
                    : 'Loading room details.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <div className="rounded-[1.25rem] border border-slate-900/10 bg-white px-3 py-2.5 shadow-sm">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-700">Progress</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative h-10 w-10">
                      <svg
                        viewBox="0 0 48 48"
                        className="-rotate-90 h-10 w-10"
                        aria-hidden="true"
                      >
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          fill="none"
                          stroke="rgb(226 232 240)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          fill="none"
                          stroke="rgb(15 23 42)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={compactRadialCircumference}
                          strokeDashoffset={
                            compactRadialCircumference * (1 - timerProgressPercent / 100)
                          }
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Time</p>
                      <p className="text-sm font-medium text-slate-900">
                        {displayedTotalMinutes > 0 ? `${displayedElapsedMinutes}/${displayedTotalMinutes}mins` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative h-10 w-10">
                      <svg
                        viewBox="0 0 48 48"
                        className="-rotate-90 h-10 w-10"
                        aria-hidden="true"
                      >
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          fill="none"
                          stroke="rgb(226 232 240)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          fill="none"
                          stroke="rgb(100 116 139)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={compactRadialCircumference}
                          strokeDashoffset={
                            compactRadialCircumference * (1 - stepProgressPercent / 100)
                          }
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Steps</p>
                      <p className="text-sm font-medium text-slate-900">
                        {workflowSequence.length > 0 ? `${displayedCompletedSteps}/${workflowSequence.length}steps` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-700">Members</p>
                <div className="mt-2 flex items-center">
                  {members.slice(0, 6).map((member, memberIndex) => {
                    const displayName = getMemberDisplayName(member)

                    return (
                      <div
                        key={member.id || member.email || displayName}
                        className={`relative ${memberIndex === 0 ? '' : '-ml-3'}`}
                        title={displayName}
                      >
                        <img
                          src={createAvatarUrl(member.email, member.name)}
                          alt={`${displayName} avatar`}
                          className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 object-cover shadow-sm"
                        />
                        {member.isOnline ? (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                        ) : null}
                      </div>
                    )
                  })}
                  {members.length > 6 ? (
                    <div className="-ml-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-600 shadow-sm">
                      +{members.length - 6}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-5 text-slate-900 shadow-[var(--theme-shadow-soft)] backdrop-blur">
            {workflowActivities.length > 0 ? (
              <div className="space-y-4">
                {workflowActivities.map((activity, activityIndex) => {
                  const isCurrentActivity = currentActivityIndex === activityIndex
                  const isFutureActivity = activityIndex > currentActivityIndex
                  const activitySequenceItems = workflowSequence.filter(
                    (item) => item.activityIndex === activityIndex,
                  )
                  const lastActivitySequenceIndex =
                    activitySequenceItems[activitySequenceItems.length - 1]?.sequenceIndex ?? -1
                  const isCompletedActivity =
                    workflowSequence.length > 0 &&
                    (lastActivitySequenceIndex < safeCurrentStepIndex ||
                      (isWorkflowComplete &&
                        lastActivitySequenceIndex === safeCurrentStepIndex))
                  const isCollapsed = isCompletedActivity || isFutureActivity
                  const activityProgressLabel = isCompletedActivity
                    ? `${activity.steps.length}/${activity.steps.length}`
                    : isCurrentActivity
                      ? `${Math.min(currentStep?.stepIndex ?? 0, activity.steps.length - 1) + 1}/${activity.steps.length}`
                      : `0/${activity.steps.length}`

                  return (
                    <section
                      key={activity.id || `activity-${activityIndex + 1}`}
                      className={`rounded-[1.5rem] border bg-white px-4 py-4 text-slate-900 transition ${
                        isCurrentActivity
                          ? 'border-slate-900/20 shadow-[var(--theme-shadow-soft)]'
                          : 'border-slate-900/10 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Activity {activityIndex + 1}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-slate-900">
                            {activity.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompletedActivity ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              >
                                <path
                                  d="M3.5 8.5L6.5 11.5L12.5 4.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                            {activityProgressLabel}
                          </span>
                        </div>
                      </div>
                      {isCollapsed ? (
                        <p className={`mt-4 text-sm ${isCompletedActivity ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {isCompletedActivity ? 'Activity complete' : 'Starts later'}
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {activity.steps.map((step, stepIndex) => {
                            const sequenceItem = activitySequenceItems.find(
                              (item) => item.stepIndex === stepIndex,
                            )
                            const isCurrentStep =
                              sequenceItem?.sequenceIndex === currentStep?.sequenceIndex
                            const isPastStep =
                              (sequenceItem?.sequenceIndex ?? Infinity) < safeCurrentStepIndex

                            return (
                              <div
                                key={`${activity.id || activityIndex}-${step.id}-${stepIndex}`}
                                className={`rounded-2xl px-3 py-3 text-sm ${
                                  isCurrentStep
                                    ? 'bg-slate-950 text-white'
                                    : isPastStep
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-slate-50 text-slate-600'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {isPastStep ? (
                                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                        <svg
                                          viewBox="0 0 16 16"
                                          fill="none"
                                          className="h-3 w-3"
                                          aria-hidden="true"
                                        >
                                          <path
                                            d="M3.5 8.5L6.5 11.5L12.5 4.5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span
                                        className={`inline-flex h-5 w-5 shrink-0 rounded-full border ${
                                          isCurrentStep
                                            ? 'border-white bg-white'
                                            : 'border-slate-300'
                                        }`}
                                      />
                                    )}
                                    <p className="truncate font-medium">{step.title}</p>
                                  </div>
                                  {step.durationMinutes ? (
                                    <span className="shrink-0 text-xs">
                                      {step.durationMinutes} min
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {emptyWorkflowMessage}
              </p>
            )}
          </aside>

          <div className="space-y-5">
            {hasWorkflowStarted ? (
              <div className="rounded-[1.5rem] border border-slate-900/20 bg-slate-950 px-4 py-4 text-white shadow-[var(--theme-shadow-dark-panel)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200/75">Timer</p>
                    <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <p className="text-2xl font-semibold tabular-nums">
                        {formatCountdown(remainingSeconds)}
                      </p>
                      <p className="text-sm text-slate-100/70">
                        {isWorkflowComplete
                          ? 'Workflow complete'
                          : isPaused
                            ? 'Paused'
                            : currentStep?.durationMinutes
                              ? `${currentStep.durationMinutes} minute step`
                              : 'No duration recorded'}
                      </p>
                    </div>
                    {isRoundRobinStep && roundRobinSpeakerCount > 0 ? (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-100/70">
                        Speaker {currentRoundRobinSpeakerIndex || roundRobinSpeakerCount} of{' '}
                        {roundRobinSpeakerCount}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void togglePauseState()
                      }}
                      disabled={!currentStep || isWorkflowComplete}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
                      title={isPaused ? 'Resume timer' : 'Pause timer'}
                    >
                      {isPaused ? (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M6 4.5a1 1 0 0 1 1.53-.848l7 4.5a1 1 0 0 1 0 1.696l-7 4.5A1 1 0 0 1 6 13.5v-9Z" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M5.75 4A1.75 1.75 0 0 0 4 5.75v8.5C4 15.216 4.784 16 5.75 16h.5C7.216 16 8 15.216 8 14.25v-8.5A1.75 1.75 0 0 0 6.25 4h-.5ZM13.75 4A1.75 1.75 0 0 0 12 5.75v8.5c0 .966.784 1.75 1.75 1.75h.5c.966 0 1.75-.784 1.75-1.75v-8.5A1.75 1.75 0 0 0 14.25 4h-.5Z" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={completeCurrentStep}
                      disabled={
                        !currentStep ||
                        isWorkflowComplete ||
                        (isRoundRobinStep && roundRobinMembers.length === 0)
                      }
                      className={gradientButtonCompactClass}
                    >
                      Complete step
                    </button>
                  </div>
                </div>
                <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-[width] duration-700 ease-out"
                    style={{ width: `${currentStepProgressPercent}%` }}
                  />
                  {roundRobinProgressDots.map((offset) => (
                    <span
                      key={offset}
                      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950/40 bg-slate-50/90"
                      style={{ left: `${offset}%` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-100/70">
                  <span>{Math.round(currentStepProgressPercent)}% complete</span>
                  <span>{formatCountdown(remainingSeconds)} remaining</span>
                </div>
              </div>
            ) : null}

            <article className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-6 shadow-[var(--theme-shadow-soft)] backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-700">
                    {hasWorkflowStarted
                      ? currentStep?.title ?? 'Waiting for workflow'
                      : 'Ready to start'}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {hasWorkflowStarted
                      ? currentStep?.description || currentStep?.title || 'Waiting for workflow'
                      : 'Ready to start'}
                  </h2>
                </div>
              </div>

              {!hasWorkflowStarted ? (
                <div className="mt-5 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-white shadow-[var(--theme-shadow-dark-panel)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-300">Room Members</p>
                      <p className="mt-2 text-sm text-slate-100/70">
                        {members.length > 0
                          ? `${members.length} member${members.length === 1 ? '' : 's'} ready to begin this session.`
                          : 'No members are in this room yet.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void startWorkflow()
                      }}
                      disabled={members.length === 0}
                      className={gradientButtonCompactClass}
                    >
                      Start
                    </button>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {members.map((member) => {
                      const displayName = getMemberDisplayName(member)

                      return (
                        <div
                          key={member.id || member.email || displayName}
                          className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <img
                            src={createAvatarUrl(member.email, member.name)}
                            alt={`${displayName} avatar`}
                            className="h-11 w-11 rounded-full border border-slate-200 bg-slate-200 object-cover"
                          />
                          <div className="min-w-0">
                            <p className="max-w-[10rem] truncate text-sm font-medium text-white">
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-300">
                              {member.isOnline ? 'Online' : 'In room'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {hasWorkflowStarted && isRoundRobinStep ? (
                <div className="mt-6 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-white shadow-[var(--theme-shadow-dark-panel)]">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-300">Round Robin</p>
                  {activeRoundRobinMember ? (
                    <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[var(--theme-shadow-soft)]">
                      <div className="flex items-center gap-4">
                        <img
                          src={createAvatarUrl(
                            activeRoundRobinMember.email,
                            activeRoundRobinMember.name,
                          )}
                          alt={`${getMemberDisplayName(activeRoundRobinMember)} avatar`}
                          className="h-16 w-16 rounded-full border border-white/10 bg-slate-200 object-cover"
                        />
                        <div>
                          <p className="text-sm text-slate-300">Now speaking</p>
                          <p className="mt-1 text-2xl font-semibold text-white">
                            {getMemberDisplayName(activeRoundRobinMember)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm font-medium text-emerald-100">
                      {roundRobinMembers.length > 0
                        ? 'Everyone in the room has had a turn.'
                        : 'No room members are available for this round robin yet.'}
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap gap-3">
                    {roundRobinMembers.map((member) => {
                      const displayName = getMemberDisplayName(member)
                      const isActiveSpeaker = activeRoundRobinMember?.id === member.id
                      const isCompletedSpeaker = completedRoundRobinSpeakerIds.includes(member.id)

                      return (
                        <div
                          key={member.id || member.email || displayName}
                          className={`relative flex items-center gap-3 rounded-full border bg-white/5 px-3 py-2 transition ${
                            isCompletedSpeaker
                              ? 'border-emerald-400/60 ring-2 ring-emerald-400/20'
                              : isActiveSpeaker
                                ? 'border-slate-200/70 ring-2 ring-slate-100/15'
                                : 'border-white/10'
                          }`}
                        >
                          <div className="relative">
                            <img
                              src={createAvatarUrl(member.email, member.name)}
                              alt={`${displayName} avatar`}
                              className="h-11 w-11 rounded-full border border-white/10 bg-slate-200 object-cover"
                            />
                            {isCompletedSpeaker ? (
                              <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <svg
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M3.5 8.5L6.5 11.5L12.5 4.5"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[10rem] truncate text-sm font-medium text-white">
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-300">
                              {isCompletedSpeaker
                                ? 'Done'
                                : isActiveSpeaker
                                  ? 'Speaking'
                                  : 'Waiting'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {hasWorkflowStarted && (isIndividualBrainstormStep || isGroupBrainstormStep) ? (
                <div className="mt-6 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 p-5 text-white shadow-[var(--theme-shadow-dark-panel)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-300">
                        {isIndividualBrainstormStep ? 'Individual brainstorm' : 'Shared board'}
                      </p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100/70">
                        {isIndividualBrainstormStep
                          ? 'Add one idea at a time. You can read your own cards now, while everyone else stays hidden until the next step.'
                          : 'All cards are now visible so the group can read, discuss, and organize them together.'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/70">
                      <p>
                        {currentActivityCards.length} card{currentActivityCards.length === 1 ? '' : 's'}
                      </p>
                      {hiddenBrainstormCardCount > 0 ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                          {hiddenBrainstormCardCount} hidden from you
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {isIndividualBrainstormStep ? (
                    <form
                      onSubmit={(event) => {
                        void submitBrainstormCard(event)
                      }}
                      className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[var(--theme-shadow-soft)]"
                    >
                      <label className="block text-sm font-medium text-white" htmlFor="brainstorm-card-input">
                        Add a card
                      </label>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          id="brainstorm-card-input"
                          type="text"
                          value={brainstormDraft}
                          onChange={(event) => setBrainstormDraft(event.target.value)}
                          placeholder="Type one problem or idea"
                          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-300/45 focus:border-slate-200 focus:bg-white/15"
                          maxLength={180}
                          disabled={!currentMember?.id || isSubmittingBrainstormCard}
                        />
                        <button
                          type="submit"
                          disabled={
                            !currentMember?.id ||
                            !brainstormDraft.trim() ||
                            isSubmittingBrainstormCard
                          }
                          className={gradientButtonCompactClass}
                        >
                          {isSubmittingBrainstormCard ? 'Adding…' : 'Add card'}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {currentActivityCards.length > 0 ? (
                      currentActivityCards.map((card) => {
                        const isCurrentUsersCard = card.authorId === currentMember?.id
                        const isHiddenCard = !shouldRevealAllBrainstormCards && !isCurrentUsersCard

                        return (
                          <article
                            key={card.id}
                            className={`relative min-h-40 rounded-[1.5rem] border p-4 shadow-[var(--theme-shadow-soft)] transition ${
                              isHiddenCard
                                ? 'border-white/10 bg-white/10'
                                : 'border-amber-300/20 bg-amber-300/10'
                            }`}
                          >
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                              {isCurrentUsersCard ? 'You' : card.authorName || 'Room member'}
                            </p>
                            <p
                              className={`mt-3 text-lg leading-7 text-white ${
                                isHiddenCard ? 'select-none blur-md' : ''
                              }`}
                              aria-hidden={isHiddenCard}
                            >
                              {card.text}
                            </p>
                            {isHiddenCard ? (
                              <div className="absolute inset-4 flex items-end">
                                <p className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 shadow-sm">
                                  Reveals next step
                                </p>
                              </div>
                            ) : null}
                          </article>
                        )
                      })
                    ) : (
                      <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 px-5 py-10 text-sm text-slate-300 md:col-span-2 xl:col-span-3">
                        {isIndividualBrainstormStep
                          ? 'No cards yet. Add the first idea for this activity.'
                          : 'No cards were added during the individual brainstorm.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </article>

          </div>
        </section>
      </div>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-6 text-slate-100">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 px-8 py-10 text-center shadow-[var(--theme-shadow-modal)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">404</p>
        <h1 className="mt-4 font-serif text-4xl">Page not found</h1>
        <a
          href="/"
          className={`${gradientButtonMediumClass} mt-8`}
        >
          Return home
        </a>
      </div>
    </main>
  )
}

function App() {
  const [authReady, setAuthReady] = useState(!isSignInWithEmailLink(auth, window.location.href))
  const { pathname } = window.location
  const roomMatch = pathname.match(/^\/room\/([^/]+)\/?$/)
  const workflowAdminMatch = pathname.match(/^\/admin\/workflows\/([^/]+)\/?$/)

  useEffect(() => {
    let cancelled = false

    async function resolveEmailLink() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        if (!cancelled) {
          setAuthReady(true)
        }
        return
      }

      const pendingContext = readPendingAuthContext()
      const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY)
      const email = storedEmail || pendingContext?.email

      if (!email) {
        if (!cancelled) {
          setAuthReady(true)
        }
        return
      }

      try {
        if (auth.currentUser?.isAnonymous) {
          const credential = EmailAuthProvider.credentialWithLink(email, window.location.href)
          await linkWithCredential(auth.currentUser, credential)
        } else {
          await signInWithEmailLink(auth, email, window.location.href)
        }

        if (pendingContext && auth.currentUser) {
          await upsertRoomMembership({
            roomId: pendingContext.roomId,
            workflowId: pendingContext.workflowId,
            name: pendingContext.name,
            email: pendingContext.email,
            authUser: auth.currentUser,
            created: false,
          })
        }

        clearPendingAuthContext()

        if (pendingContext?.roomId) {
          window.history.replaceState({}, '', `/room/${encodeURIComponent(pendingContext.roomId)}`)
        } else {
          window.history.replaceState({}, '', '/')
        }
      } catch {
      } finally {
        if (!cancelled) {
          setAuthReady(true)
        }
      }
    }

    void resolveEmailLink()

    return () => {
      cancelled = true
    }
  }, [])

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[image:var(--theme-bg-auth)] px-5 py-6 text-slate-800">
        <div className="rounded-[2rem] border border-slate-900/10 bg-white/85 px-8 py-10 text-center shadow-[var(--theme-shadow-soft)] backdrop-blur">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Finishing sign-in</p>
          <h1 className="mt-4 font-serif text-4xl text-slate-900">Verifying your email link...</h1>
        </div>
      </main>
    )
  }

  if (roomMatch) {
    const roomId = decodeURIComponent(roomMatch[1])
    return <RoomPage roomId={roomId} />
  }

  if (pathname === '/admin') {
    return <AdminPage />
  }

  if (workflowAdminMatch) {
    return <WorkflowEditorPage workflowId={decodeURIComponent(workflowAdminMatch[1])} />
  }

  if (pathname === '/') {
    return <HomePage />
  }

  return <NotFoundPage />
}

export default App
