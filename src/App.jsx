import { useEffect, useState } from 'react'
import {
  EmailAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
} from 'firebase/auth'
import {
  collection,
  collectionGroup,
  doc,
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

const normalizedFallbackRoomTemplates = fallbackRoomTemplates.map((template) =>
  normalizeRoomTemplate(template.id, template),
)

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
    }
  }

  if (!step || typeof step !== 'object') {
    return {
      id: `step-${index + 1}`,
      title: `Step ${index + 1}`,
      description: '',
      activityType: '',
      durationMinutes: null,
    }
  }

  return {
    id: step.id || `step-${index + 1}`,
    title: step.title || step.name || step.label || `Step ${index + 1}`,
    description: step.description || step.summary || '',
    activityType: step.activityType || step.type || step.format || '',
    durationMinutes: toNumber(
      step.durationMinutes ?? step.minutes ?? step.duration,
    ),
  }
}

function normalizePipelineSegment(segment, index) {
  if (typeof segment === 'string') {
    return {
      id: `segment-${index + 1}`,
      title: segment,
      description: '',
      totalMinutes: null,
      steps: [],
    }
  }

  if (!segment || typeof segment !== 'object') {
    return {
      id: `segment-${index + 1}`,
      title: `Segment ${index + 1}`,
      description: '',
      totalMinutes: null,
      steps: [],
    }
  }

  const stepsSource = segment.steps ?? segment.items ?? []
  const steps = stepsSource.map((step, stepIndex) =>
    normalizePipelineStep(step, stepIndex),
  )
  const summedMinutes = steps.reduce(
    (total, step) => total + (step.durationMinutes ?? 0),
    0,
  )

  return {
    id: segment.id || `segment-${index + 1}`,
    title: segment.title || segment.name || segment.label || `Segment ${index + 1}`,
    description: segment.description || segment.summary || '',
    totalMinutes:
      toNumber(segment.totalMinutes ?? segment.minutes ?? segment.duration) ??
      (summedMinutes > 0 ? summedMinutes : null),
    steps,
  }
}

function normalizeRoomTemplate(id, template) {
  const workflowSource = template?.workflow ?? template?.pipeline ?? {}
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
    totalMinutes,
    activities,
    activityCount: activities.length,
    stepCount: steps.length,
    steps,
  }

  return {
    id,
    name: template?.name || template?.title || 'Untitled room',
    description: template?.description || '',
    sortOrder: toNumber(template?.sortOrder) ?? Number.MAX_SAFE_INTEGER,
    workflow,
    pipeline: workflow,
  }
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
const gradientButtonLargeClass = `${gradientButtonBaseClass} min-h-14 px-7 text-base font-medium`
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

function getMemberDisplayName(member) {
  return member?.name?.trim() || member?.email?.trim() || 'Guest'
}

function formatRoomTimestamp(value) {
  if (!value) {
    return 'No activity yet'
  }

  const resolvedDate =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : typeof value === 'string' || typeof value === 'number'
          ? new Date(value)
          : null

  if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {
    return 'No activity yet'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(resolvedDate)
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

  const workflow = room?.roomTemplate?.workflow
  const activeStage =
    workflow?.activities?.[0]?.title ||
    workflow?.steps?.[0]?.title ||
    null

  return activeStage ? `Ready for ${activeStage}` : 'Waiting for workflow'
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

function getRoomBannerKey(roomId) {
  return `innovationery:room-banner:${roomId}`
}

function writeRoomBanner(roomId, banner) {
  window.localStorage.setItem(getRoomBannerKey(roomId), JSON.stringify(banner))
}

function readRoomBanner(roomId) {
  try {
    return JSON.parse(window.localStorage.getItem(getRoomBannerKey(roomId)) || 'null')
  } catch {
    return null
  }
}

function clearRoomBanner(roomId) {
  window.localStorage.removeItem(getRoomBannerKey(roomId))
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
  roomTypeId,
  roomTemplate,
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
  const roomRef = doc(db, 'rooms', roomId)
  const memberRef = doc(db, 'rooms', roomId, 'members', memberKey)
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

  await setDoc(
    roomRef,
    {
      roomId,
      roomTypeId,
      roomTypeName: roomTemplate?.name ?? 'Custom Room',
      updatedAt: serverTimestamp(),
      ...(created
        ? {
            createdAt: serverTimestamp(),
            createdBy: member,
            roomTemplate: roomTemplate
              ? {
                  id: roomTemplate.id,
                  name: roomTemplate.name,
                  description: roomTemplate.description,
                  workflow: {
                    title: roomTemplate.workflow.title,
                    description: roomTemplate.workflow.description,
                    totalMinutes: roomTemplate.workflow.totalMinutes,
                    activityCount: roomTemplate.workflow.activities.length,
                    stepCount: roomTemplate.workflow.steps.length,
                    activities: roomTemplate.workflow.activities,
                    steps: roomTemplate.workflow.steps,
                  },
                }
              : null,
          }
        : {}),
    },
    { merge: true },
  )
  await setDoc(
    memberRef,
    {
      ...member,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  window.localStorage.setItem(
    `innovationery:room-member:${roomId}`,
    JSON.stringify(member),
  )

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
      collection(db, 'roomTemplates'),
      (snapshot) => {
        if (snapshot.empty) {
          setRoomTemplates(
            normalizedFallbackRoomTemplates,
          )
          setTemplatesStatus('empty')
          return
        }

        const templates = snapshot.docs
          .map((templateDoc) =>
            normalizeRoomTemplate(templateDoc.id, templateDoc.data()),
          )
          .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
              return left.sortOrder - right.sortOrder
            }

            return left.name.localeCompare(right.name)
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
        roomTypeId: 'custom',
        name,
        email,
        created: false,
      }

      writePendingAuthContext(flow)

      try {
        await sendSignInLinkToEmail(auth, email, getActionCodeSettings(roomId))
        writeRoomBanner(roomId, {
          tone: 'sky',
          text: `A one-time verification link was sent to ${email}. Verify your email whenever you are ready to recover this brainstorm later.`,
        })
      } catch {
        clearPendingAuthContext()
        writeRoomBanner(roomId, {
          tone: 'slate',
          text: 'We could not send the verification email right now, but you have still entered anonymously and can keep working.',
        })
      }

      await upsertRoomMembership({
        roomId,
        roomTypeId: 'custom',
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
        roomTypeId: selectedTemplate.id,
        roomTemplate: selectedTemplate,
        name,
        email,
        created: true,
      }

      writePendingAuthContext(flow)

      try {
        await sendSignInLinkToEmail(auth, email, getActionCodeSettings(roomId))
        writeRoomBanner(roomId, {
          tone: 'sky',
          text: `A one-time verification link was sent to ${email}. Verify your email whenever you are ready to recover this brainstorm later.`,
        })
      } catch {
        clearPendingAuthContext()
        writeRoomBanner(roomId, {
          tone: 'slate',
          text: 'We could not send the verification email right now, but your room was still created and you entered anonymously.',
        })
      }

      await upsertRoomMembership({
        roomId,
        roomTypeId: selectedTemplate.id,
        roomTemplate: selectedTemplate,
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
                        Start a {selectedTemplate?.name ?? 'new'} room
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
                                  {roomType.name}
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
                                {roomType.description}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {templatesStatus === 'ready' ? (
                      <p className="mt-4 text-sm text-slate-500">
                        Room templates are loading live from the Firestore `roomTemplates` collection.
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
                      {selectedTemplate?.name ? `${selectedTemplate.name} Workflow` : 'Room Workflow'}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {selectedTemplate?.workflow.title ?? 'No workflow available'}
                    </h2>
                    {selectedTemplate?.workflow.description ? (
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100/80">
                        {selectedTemplate.workflow.description}
                      </p>
                    ) : null}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-100/70">Activities / steps</p>
                        <p className="mt-2 text-3xl font-semibold">
                          {selectedTemplate
                            ? `${selectedTemplate.workflow.activities.length || 1} / ${selectedTemplate.workflow.steps.length}`
                            : '0 / 0'}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-100/70">Total time</p>
                        <p className="mt-2 text-3xl font-semibold">
                          {selectedTemplate?.workflow.totalMinutes
                            ? `${selectedTemplate.workflow.totalMinutes} min`
                            : 'Custom'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {(selectedTemplate?.workflow.activities.length
                        ? selectedTemplate.workflow.activities
                        : [
                            {
                              id: 'default-activity',
                              title: 'Workflow',
                              description: '',
                              totalMinutes: selectedTemplate?.workflow.totalMinutes ?? null,
                              steps: selectedTemplate?.workflow.steps ?? [],
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
  const [memberCounts, setMemberCounts] = useState({})
  const [memberStatus, setMemberStatus] = useState('loading')

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'rooms'),
      (snapshot) => {
        const nextRooms = snapshot.docs.map((roomDoc) => ({
          id: roomDoc.id,
          ...roomDoc.data(),
        }))

        nextRooms.sort((left, right) => {
          const leftUpdated = left.updatedAt?.seconds ?? 0
          const rightUpdated = right.updatedAt?.seconds ?? 0

          if (leftUpdated !== rightUpdated) {
            return rightUpdated - leftUpdated
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

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collectionGroup(db, 'members'),
      (snapshot) => {
        const counts = {}

        snapshot.docs.forEach((memberDoc) => {
          const roomId = memberDoc.ref.parent.parent?.id

          if (!roomId) {
            return
          }

          counts[roomId] = (counts[roomId] ?? 0) + 1
        })

        setMemberCounts(counts)
        setMemberStatus('ready')
      },
      () => {
        setMemberCounts({})
        setMemberStatus('error')
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
            <a
              href="/"
              className={gradientButtonMediumClass}
            >
              Back home
            </a>
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
              {roomStatus === 'ready' && memberStatus === 'ready' ? 'Live' : 'Loading'}
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

          {roomStatus === 'loading' || memberStatus === 'loading' ? (
            <p className="px-6 py-10 text-base text-slate-600">Loading rooms...</p>
          ) : null}
          {roomStatus === 'error' || memberStatus === 'error' ? (
            <p className="px-6 py-10 text-base text-rose-700">
              Unable to load the admin room list from Firestore.
            </p>
          ) : null}
          {roomStatus === 'ready' && rooms.length === 0 ? (
            <p className="px-6 py-10 text-base text-slate-600">
              No rooms have been created yet.
            </p>
          ) : null}

          {roomStatus === 'ready' && memberStatus === 'ready' && rooms.length > 0 ? (
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
                        {room.roomTypeName || room.roomTemplate?.name || 'Custom Room'}
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
                        {formatRoomTimestamp(room.updatedAt || room.createdAt)}
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

function RoomPage({ roomId }) {
  const [room, setRoom] = useState(null)
  const [persistedMembers, setPersistedMembers] = useState([])
  const [status, setStatus] = useState('loading')
  const [banner, setBanner] = useState(() => readRoomBanner(roomId))
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const currentMember = JSON.parse(
    window.localStorage.getItem(`innovationery:room-member:${roomId}`) || 'null',
  )

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRoom(null)
          setStatus('missing')
          return
        }

        setRoom(snapshot.data())
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
    const unsubscribe = onSnapshot(
      collection(db, 'rooms', roomId, 'members'),
      (snapshot) => {
        setPersistedMembers(snapshot.docs.map((memberDoc) => memberDoc.data()))
      },
      () => {
        setPersistedMembers([])
      },
    )

    return unsubscribe
  }, [roomId])

  useEffect(() => {
    if (!currentMember?.id) {
      return undefined
    }

    const memberRef = doc(db, 'rooms', roomId, 'members', currentMember.id)

    const setPresence = (isOnline) =>
      setDoc(
        memberRef,
        {
          isOnline,
          lastSeenAt: serverTimestamp(),
        },
        { merge: true },
      )

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
  const isDemoRoom = roomId.trim().toLowerCase() === 'demo-room'
  const demoTemplate =
    normalizedFallbackRoomTemplates.find((template) => template.id === 'hackathon') ?? null
  const roomWorkflow = room?.roomTemplate?.workflow ?? (isDemoRoom ? demoTemplate?.workflow : null)
  const roomTypeName = room?.roomTypeName ?? (isDemoRoom ? demoTemplate?.name : null)
  const members = normalizeMembers(room, persistedMembers)
    .sort((left, right) =>
      getMemberDisplayName(left).localeCompare(getMemberDisplayName(right)),
    )
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
  const safeCurrentStepIndex =
    workflowSequence.length > 0 ? Math.min(currentStepIndex, workflowSequence.length - 1) : 0
  const currentStep = workflowSequence[safeCurrentStepIndex] ?? null
  const currentActivityIndex = currentStep?.activityIndex ?? 0
  const isWorkflowComplete = workflowSequence.length > 0 && safeCurrentStepIndex === workflowSequence.length - 1 && remainingSeconds === 0
  const firstStepDurationSeconds = (workflowSequence[0]?.durationMinutes ?? 0) * 60
  const nextStepDurationSeconds =
    (workflowSequence[safeCurrentStepIndex + 1]?.durationMinutes ?? 0) * 60
  const currentStepDurationSeconds = (currentStep?.durationMinutes ?? 0) * 60
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
  const moveToStep = (stepIndex) => {
    const nextIndex = Math.max(0, Math.min(stepIndex, workflowSequence.length - 1))
    const nextStep = workflowSequence[nextIndex]

    setCurrentStepIndex(nextIndex)
    setRemainingSeconds((nextStep?.durationMinutes ?? 0) * 60)
    setIsPaused(false)
  }
  const completeCurrentStep = () => {
    if (!currentStep) {
      return
    }

    if (safeCurrentStepIndex < workflowSequence.length - 1) {
      moveToStep(safeCurrentStepIndex + 1)
      return
    }

    setRemainingSeconds(0)
    setIsPaused(false)
  }

  useEffect(() => {
    if (workflowSequence.length === 0) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentStepIndex(0)
      setRemainingSeconds(firstStepDurationSeconds)
      setIsPaused(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [firstStepDurationSeconds, roomId, workflowSequence.length])

  useEffect(() => {
    if (!currentStep || workflowSequence.length === 0) {
      return undefined
    }

    if (isPaused) {
      return undefined
    }

    if (remainingSeconds > 0) {
      const intervalId = window.setInterval(() => {
        setRemainingSeconds((seconds) => Math.max(0, seconds - 1))
      }, 1000)

      return () => window.clearInterval(intervalId)
    }

    if (safeCurrentStepIndex < workflowSequence.length - 1) {
      const timeoutId = window.setTimeout(() => {
        const nextIndex = safeCurrentStepIndex + 1

        setCurrentStepIndex(nextIndex)
        setRemainingSeconds(nextStepDurationSeconds)
        setIsPaused(false)
      }, 1200)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [
    currentStep,
    isPaused,
    nextStepDurationSeconds,
    remainingSeconds,
    safeCurrentStepIndex,
    workflowSequence.length,
  ])

  return (
    <main className="min-h-screen bg-[image:var(--theme-bg-room)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/85 px-6 py-8 shadow-[var(--theme-shadow-soft)] backdrop-blur md:px-8 md:py-9">
          <div className="absolute -right-12 top-0 h-56 w-56 rounded-full bg-[image:var(--theme-orb-room)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-700">Room Page</p>
              <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Room {roomId}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {currentStep
                  ? `The room is currently in ${currentStep.activityTitle}. The timer will move the workflow through each step automatically.`
                  : status === 'ready'
                    ? `This room is connected to Firestore and currently shows ${members.length} member${members.length === 1 ? '' : 's'} in realtime.`
                    : 'This route is wired for room-specific experiences. Use the room id from the URL to load presence, boards, chat, or other room-scoped data.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <code className="rounded-full bg-slate-950 px-4 py-2 text-sm text-slate-50">
                  /room/{roomId}
                </code>
                {roomTypeName ? (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900">
                    {roomTypeName}
                  </span>
                ) : null}
                <a
                  href="/"
                  className={gradientButtonMediumClass}
                >
                  Back home
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[30rem]">
              <div className="rounded-[1.25rem] border border-slate-900/20 bg-slate-950 px-4 py-4 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-200/80">Snapshot</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-slate-100/70">Template</p>
                    <p className="mt-1 font-semibold text-white">
                      {roomTypeName ?? 'Waiting for data'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-slate-100/70">Workflow</p>
                    <p className="mt-1 font-semibold text-white">
                      {roomWorkflow?.stepCount
                        ? `${roomWorkflow.activityCount ?? workflowActivities.length} / ${roomWorkflow.stepCount}`
                        : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-slate-100/70">Total time</p>
                    <p className="mt-1 font-semibold text-white">
                      {roomWorkflow?.totalMinutes ? `${roomWorkflow.totalMinutes} min` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-slate-100/70">Sync</p>
                    <p className="mt-1 font-semibold text-white">
                      {status === 'ready' ? 'Live' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50/70 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-700">Members</p>
                    <p className="mt-1 text-sm text-slate-600">{members.length} in room</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {members.filter((member) => member.isOnline).length} online
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {members.slice(0, 6).map((member) => {
                    const displayName = getMemberDisplayName(member)
                    const isCurrentMember = currentMember?.id === member.id

                    return (
                      <div
                        key={member.id || member.email || displayName}
                        className="flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-2.5 py-2"
                      >
                        <img
                          src={createAvatarUrl(member.email, member.name)}
                          alt={`${displayName} avatar`}
                          className="h-8 w-8 rounded-full border border-slate-900/10 bg-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="max-w-[8rem] truncate text-sm font-medium text-slate-900">
                            {displayName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {isCurrentMember ? 'You' : member.isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {members.length > 6 ? (
                    <div className="flex items-center rounded-full border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                      +{members.length - 6} more
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {banner ? (
          <section
            className={`rounded-[1.5rem] border px-5 py-4 text-sm leading-6 shadow-[var(--theme-shadow-soft)] ${
              banner.tone === 'sky'
                ? 'border-slate-200 bg-slate-50 text-slate-900'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>{banner.text}</p>
              <button
                type="button"
                onClick={() => {
                  clearRoomBanner(roomId)
                  setBanner(null)
                }}
                className={gradientButtonCompactClass}
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="rounded-[1.75rem] border border-slate-900/20 bg-slate-950 p-5 text-white shadow-[var(--theme-shadow-dark-panel)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-200/80">Workflow</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Activities
                </h2>
              </div>
              {roomWorkflow?.totalMinutes ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                  {roomWorkflow.totalMinutes} min
                </span>
              ) : null}
            </div>

            {roomWorkflow?.description ? (
              <p className="mt-4 text-sm leading-6 text-slate-100/70">{roomWorkflow.description}</p>
            ) : null}

            {workflowActivities.length > 0 ? (
              <div className="mt-6 space-y-4">
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

                  return (
                    <section
                      key={activity.id || `activity-${activityIndex + 1}`}
                      className={`rounded-[1.5rem] border px-4 py-4 transition ${
                        isCurrentActivity
                          ? 'border-slate-400/40 bg-slate-400/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-200/70">
                            Activity {activityIndex + 1}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-white">
                            {activity.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompletedActivity ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-100">
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
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-100">
                            {activity.steps.length} steps
                          </span>
                        </div>
                      </div>
                      {isCollapsed ? (
                        <p
                          className={`mt-4 text-sm ${
                            isCompletedActivity
                              ? 'text-emerald-100/80'
                              : 'text-slate-100/65'
                          }`}
                        >
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
                                    ? 'bg-white text-slate-900'
                                    : isPastStep
                                      ? 'bg-emerald-400/10 text-emerald-100'
                                      : 'bg-white/5 text-slate-100/75'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {isPastStep ? (
                                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-100">
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
                                            ? 'border-slate-900 bg-slate-900'
                                            : 'border-current/40'
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
              <p className="mt-6 text-sm text-slate-100/70">
                No workflow has been recorded for this room yet.
              </p>
            )}
          </aside>

          <div className="space-y-5">
            <article className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-6 shadow-[var(--theme-shadow-soft)] backdrop-blur">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-700">Current Step</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {currentStep?.title ?? 'Waiting for workflow'}
                  </h2>
                  <p className="mt-2 text-base text-slate-600">
                    {currentStep
                      ? `${currentStep.activityTitle} • Step ${currentStep.stepIndex + 1} of ${workflowActivities[currentActivityIndex]?.steps.length ?? 0}`
                      : 'A room workflow will appear here once the room template is available.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-slate-900/20 bg-slate-950 px-5 py-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-200/75">Timer</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {formatCountdown(remainingSeconds)}
                    </p>
                  </div>
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
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPaused((paused) => !paused)}
                    disabled={!currentStep || isWorkflowComplete}
                    className={gradientButtonCompactClass}
                  >
                    {isPaused ? 'Resume timer' : 'Pause timer'}
                  </button>
                  <button
                    type="button"
                    onClick={completeCurrentStep}
                    disabled={!currentStep || isWorkflowComplete}
                    className={gradientButtonCompactClass}
                  >
                    Finish step
                  </button>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-[width] duration-700 ease-out"
                    style={{ width: `${currentStepProgressPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-100/70">
                  <span>{Math.round(currentStepProgressPercent)}% complete</span>
                  <span>{formatCountdown(remainingSeconds)} remaining</span>
                </div>
              </div>

              {currentStep?.description ? (
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                  {currentStep.description}
                </p>
              ) : null}

              <div className="mt-6 rounded-[1.5rem] bg-slate-50/70 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-700">
                  Facilitation cues
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Activity</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {currentStep?.activityTitle ?? 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Format</p>
                    <p className="mt-1 text-lg font-semibold capitalize text-slate-900">
                      {currentStep?.activityType || 'Open discussion'}
                    </p>
                  </div>
                </div>
              </div>
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
        if (pendingContext?.roomId) {
          writeRoomBanner(pendingContext.roomId, {
            tone: 'slate',
            text: 'We could not finish email verification on this device because the original email address was not available.',
          })
        }

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
            roomTypeId: pendingContext.roomTypeId,
            roomTemplate: pendingContext.roomTemplate,
            name: pendingContext.name,
            email: pendingContext.email,
            authUser: auth.currentUser,
            created: false,
          })

          writeRoomBanner(pendingContext.roomId, {
            tone: 'sky',
            text: 'Email verified. This brainstorm is now linked to your verified sign-in.',
          })
        }

        clearPendingAuthContext()

        if (pendingContext?.roomId) {
          window.history.replaceState({}, '', `/room/${encodeURIComponent(pendingContext.roomId)}`)
        } else {
          window.history.replaceState({}, '', '/')
        }
      } catch {
        if (pendingContext?.roomId) {
          writeRoomBanner(pendingContext.roomId, {
            tone: 'slate',
            text: 'We could not complete email verification. You can keep working anonymously and try again later.',
          })
        }
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

  if (pathname === '/') {
    return <HomePage />
  }

  return <NotFoundPage />
}

export default App
