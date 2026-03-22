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
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase.js'

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

    const name = createForm.name.trim()
    const email = createForm.email.trim().toLowerCase()

    if (!name || !email) {
      setCreateError('Enter your name and email to create a room.')
      return
    }

    if (!selectedTemplate) {
      setCreateError('No room template is available yet.')
      return
    }

    const roomId = createRoomId()
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(242,127,90,0.16),_transparent_28%),linear-gradient(180deg,_#fff8ef_0%,_#f5efe6_100%)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl content-center gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/80 px-6 py-10 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur md:px-10 md:py-14">
          <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
          <p className="relative mb-4 text-xs uppercase tracking-[0.24em] text-amber-800">
            Innovation starts here
          </p>
          <h1 className="relative font-serif text-6xl leading-none tracking-tight text-slate-900 sm:text-7xl lg:text-[6.5rem]">
            Innovationery
          </h1>
          <p className="relative mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            A clean starting point for building products, experiments, and ideas
            that deserve a real launch.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#about"
              className="inline-flex min-h-12 items-center rounded-full bg-gradient-to-br from-slate-900 to-sky-700 px-5 text-sm font-medium text-orange-50 transition hover:brightness-110"
            >
              Explore the vision
            </a>
            <a
              href="/room/demo-room"
              className="inline-flex min-h-12 items-center rounded-full bg-sky-900/10 px-5 text-sm font-medium text-sky-900 transition hover:bg-sky-900/15"
            >
              Open demo room
            </a>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-900/10 bg-white/75 p-4 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur sm:p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`flex min-h-24 items-center justify-center rounded-[1.5rem] border px-6 py-5 text-left text-xl font-semibold transition sm:text-2xl ${
                activeTab === 'join'
                  ? 'border-slate-900 bg-slate-900 text-orange-50 shadow-[0_20px_40px_rgba(15,23,42,0.18)]'
                  : 'border-slate-900/10 bg-white text-slate-900 hover:border-slate-900/30 hover:bg-slate-50'
              }`}
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex min-h-24 items-center justify-center rounded-[1.5rem] border px-6 py-5 text-left text-xl font-semibold transition sm:text-2xl ${
                activeTab === 'create'
                  ? 'border-slate-900 bg-slate-900 text-orange-50 shadow-[0_20px_40px_rgba(15,23,42,0.18)]'
                  : 'border-slate-900/10 bg-white text-slate-900 hover:border-slate-900/30 hover:bg-slate-50'
              }`}
            >
              Create Room
            </button>
          </div>

          {activeTab === 'join' ? (
            <div className="mt-4 rounded-[1.75rem] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.92))] p-6 sm:p-8">
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.24em] text-amber-800">
                  Join an active room
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                  Enter the room details and jump in.
                </h2>
              </div>

              <form
                onSubmit={handleJoinSubmit}
                className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
              >
                <label className="grid gap-3 text-sm font-medium text-slate-700">
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
                    className="min-h-28 rounded-[1.75rem] border border-slate-900/10 bg-white px-5 text-3xl font-semibold uppercase tracking-[0.24em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15 sm:min-h-32 sm:text-4xl"
                  />
                </label>
                <div className="grid gap-4 self-end">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
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
                      className="min-h-14 rounded-2xl border border-slate-900/10 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
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
                      className="min-h-14 rounded-2xl border border-slate-900/10 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
                    />
                  </label>
                </div>
                {joinError ? (
                  <p className="lg:col-span-2 text-sm font-medium text-rose-700">
                    {joinError}
                  </p>
                ) : null}
                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={joinLoading}
                    className="inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-sky-700 px-7 text-base font-medium text-orange-50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {joinLoading ? 'Joining...' : 'Join Now'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.75rem] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.92))] p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="rounded-[1.5rem] border border-slate-900/10 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-amber-800">
                        Room Types
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        Pick a starting format
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
                    {roomTemplates.map((roomType) => (
                      <button
                        key={roomType.id}
                        type="button"
                        onClick={() => setSelectedRoomType(roomType.id)}
                        role="radio"
                        aria-checked={selectedRoomType === roomType.id}
                        className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
                          selectedRoomType === roomType.id
                            ? 'border-sky-700 bg-sky-50 shadow-[0_18px_30px_rgba(14,165,233,0.12)]'
                            : 'border-slate-900/10 bg-slate-50 hover:border-sky-700/40 hover:bg-sky-50'
                        }`}
                      >
                        <span className="block min-w-0">
                          <span className="block text-lg font-semibold text-slate-900">
                            {roomType.name}
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-slate-600">
                            {roomType.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {templatesStatus === 'ready' ? (
                    <p className="mt-4 text-sm text-slate-500">
                      Room templates are loading live from the Firestore `roomTemplates` collection.
                    </p>
                  ) : null}
                  {templatesStatus === 'empty' ? (
                    <p className="mt-4 text-sm text-amber-700">
                      The Firestore `roomTemplates` collection is empty, so fallback template data is being shown.
                    </p>
                  ) : null}
                  {templatesStatus === 'error' ? (
                    <p className="mt-4 text-sm text-rose-700">
                      Firestore templates could not be loaded, so fallback template data is being shown.
                    </p>
                  ) : null}
                </div>

                <div className="relative rounded-[1.5rem] border border-slate-900/10 bg-slate-950 p-5 text-orange-50 sm:p-6">
                  <div
                    aria-hidden="true"
                    className="absolute left-[-14px] top-16 hidden h-7 w-7 rotate-45 border-b border-l border-slate-900/10 bg-slate-950 lg:block"
                  />
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-200/80">
                    {selectedTemplate?.name ? `${selectedTemplate.name} Workflow` : 'Room Workflow'}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {selectedTemplate?.workflow.title ?? 'No workflow available'}
                  </h2>
                  {selectedTemplate?.workflow.description ? (
                    <p className="mt-3 max-w-xl text-sm leading-6 text-orange-100/80">
                      {selectedTemplate.workflow.description}
                    </p>
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-orange-100/70">Activities / steps</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {selectedTemplate
                          ? `${selectedTemplate.workflow.activities.length || 1} / ${selectedTemplate.workflow.steps.length}`
                          : '0 / 0'}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-orange-100/70">Total time</p>
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
                          <p className="text-sm uppercase tracking-[0.18em] text-orange-200/75">
                            Activity {activityIndex + 1}
                          </p>
                          <h3 className="text-lg font-semibold text-white">{activity.title}</h3>
                          {activity.totalMinutes ? (
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-orange-100/80">
                              {activity.totalMinutes} min
                            </span>
                          ) : null}
                        </div>
                        {activity.description ? (
                          <p className="mt-2 text-sm leading-6 text-orange-100/75">
                            {activity.description}
                          </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-orange-100/75">
                          <span className="rounded-full bg-slate-950/30 px-3 py-1">
                            {activity.steps.length} steps
                          </span>
                          <span>Open the room to view step details.</span>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-slate-900/10 bg-slate-950 p-5 text-orange-50 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-orange-200/80">
                      Create New Room
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                      Start this workflow in a fresh room
                    </h3>
                  </div>
                  {selectedTemplate?.name ? (
                    <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-orange-50">
                      {selectedTemplate.name}
                    </span>
                  ) : null}
                </div>

                <form onSubmit={handleCreateSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-orange-50">
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
                      className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-orange-50/45 focus:border-orange-200 focus:ring-2 focus:ring-orange-100/20"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-orange-50">
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
                      className="min-h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-orange-50/45 focus:border-orange-200 focus:ring-2 focus:ring-orange-100/20"
                    />
                  </label>
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-orange-100/80 md:col-span-2">
                    Creating a room stores the room id in Firestore, enters you anonymously right away, and sends a one-time verification link in parallel.
                  </div>
                  {createError ? (
                    <p className="text-sm font-medium text-rose-300 md:col-span-2">{createError}</p>
                  ) : null}
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={createLoading || !selectedTemplate}
                      className="inline-flex min-h-14 items-center justify-center rounded-full bg-orange-100 px-7 text-base font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createLoading ? 'Preparing...' : 'Create Room'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        <section
          id="about"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-7 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
            <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
            <h2 className="relative text-xl font-semibold text-slate-900">
              Fast foundation
            </h2>
            <p className="relative mt-3 leading-7 text-slate-600">
              Built on Vite and React so the app is ready for quick iteration
              from day one.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-7 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
            <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
            <h2 className="relative text-xl font-semibold text-slate-900">
              Firebase enabled
            </h2>
            <p className="relative mt-3 leading-7 text-slate-600">
              Firebase is installed and Firestore now stores room ids and room membership when someone creates or joins a room.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-7 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur md:col-span-2 xl:col-span-1">
            <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
            <h2 className="relative text-xl font-semibold text-slate-900">
              Room to grow
            </h2>
            <p className="relative mt-3 leading-7 text-slate-600">
              This homepage is intentionally minimal so you can layer in auth,
              boards, chat, and room-scoped workflows without reworking the foundation.
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}

function RoomPage({ roomId }) {
  const [room, setRoom] = useState(null)
  const [persistedMembers, setPersistedMembers] = useState([])
  const [status, setStatus] = useState('loading')
  const [memberStatus, setMemberStatus] = useState('loading')
  const [banner, setBanner] = useState(() => readRoomBanner(roomId))
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
        setMemberStatus('ready')
      },
      () => {
        setPersistedMembers([])
        setMemberStatus('error')
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/85 px-6 py-10 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur md:px-10 md:py-14">
          <div className="absolute -right-12 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.18),_transparent_70%)]" />
          <p className="relative text-xs uppercase tracking-[0.24em] text-sky-700">
            Room Page
          </p>
          <h1 className="relative mt-4 font-serif text-5xl leading-tight tracking-tight text-slate-900 sm:text-6xl">
            Room {roomId}
          </h1>
          <p className="relative mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {status === 'ready'
              ? `This room is connected to Firestore and currently shows ${members.length} member${members.length === 1 ? '' : 's'} in realtime.`
              : 'This route is wired for room-specific experiences. Use the room id from the URL to load presence, boards, chat, or other room-scoped data.'}
          </p>
          <div className="relative mt-8 flex flex-wrap items-center gap-4">
            <code className="rounded-full bg-slate-900 px-4 py-2 text-sm text-slate-100">
              /room/{roomId}
            </code>
            {roomTypeName ? (
              <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-medium text-sky-900">
                {roomTypeName}
              </span>
            ) : null}
            <a
              href="/"
              className="inline-flex min-h-12 items-center rounded-full bg-sky-900 px-5 text-sm font-medium text-white transition hover:brightness-110"
            >
              Back home
            </a>
          </div>
        </section>

        {banner ? (
          <section
            className={`rounded-[1.5rem] border px-5 py-4 text-sm leading-6 shadow-[0_24px_80px_rgba(10,34,51,0.08)] ${
              banner.tone === 'sky'
                ? 'border-sky-200 bg-sky-50 text-sky-900'
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
                className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-5">
            <article className="rounded-[1.75rem] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-sky-700">
                    Workflow Details
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    Activities and steps for this room
                  </h2>
                </div>
                {roomWorkflow?.totalMinutes ? (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    {roomWorkflow.totalMinutes} min
                  </span>
                ) : null}
              </div>

              {roomWorkflow?.description ? (
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  {roomWorkflow.description}
                </p>
              ) : null}

              {roomWorkflow ? (
                <div className="mt-6 space-y-4">
                  {(roomWorkflow.activities ?? []).map((activity, activityIndex) => (
                    <section
                      key={activity.id}
                      className="rounded-[1.5rem] border border-slate-900/10 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm uppercase tracking-[0.18em] text-sky-700">
                          Activity {activityIndex + 1}
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {activity.title}
                        </h3>
                        {activity.totalMinutes ? (
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            {activity.totalMinutes} min
                          </span>
                        ) : null}
                      </div>
                      {activity.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {activity.description}
                        </p>
                      ) : null}

                      <div className="mt-4 space-y-4">
                        {activity.steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="relative rounded-[1.25rem] border border-slate-900/10 bg-white p-4 pl-16"
                          >
                            {index < activity.steps.length - 1 ? (
                              <div className="absolute bottom-[-1rem] left-6 top-[3.5rem] w-px bg-slate-200" />
                            ) : null}
                            <span className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-sky-900 text-sm font-semibold text-white">
                              {index + 1}
                            </span>
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-medium leading-7 text-slate-900">
                                  {step.title}
                                </p>
                                {step.activityType ? (
                                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                                    {step.activityType}
                                  </span>
                                ) : null}
                                {step.durationMinutes ? (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    {step.durationMinutes} min
                                  </span>
                                ) : null}
                              </div>
                              {step.description ? (
                                <p className="text-sm leading-6 text-slate-600">
                                  {step.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-base text-slate-600">
                  No workflow has been recorded for this room yet.
                </p>
              )}
            </article>

            <article className="rounded-[1.75rem] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-sky-700">
                    Members
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    Everyone currently in this room
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  {members.length} total
                </span>
              </div>

              {status === 'loading' || memberStatus === 'loading' ? (
                <p className="mt-6 text-base text-slate-600">Loading room members...</p>
              ) : null}
              {status === 'error' || memberStatus === 'error' ? (
                <p className="mt-6 text-base text-rose-700">
                  Unable to load the room from Firestore.
                </p>
              ) : null}
              {status === 'missing' && !isDemoRoom ? (
                <p className="mt-6 text-base text-slate-600">
                  No Firestore room document exists for this room id yet. Create or join the room from the homepage first.
                </p>
              ) : null}
              {status === 'missing' && isDemoRoom ? (
                <p className="mt-6 text-base text-slate-600">
                  This is the built-in demo room for the hackathon brainstorm workflow.
                </p>
              ) : null}
              {status === 'ready' && members.length === 0 ? (
                <p className="mt-6 text-base text-slate-600">This room has no members yet.</p>
              ) : null}

              {status === 'ready' && members.length > 0 ? (
                <div className="mt-6 grid gap-3">
                  {members.map((member) => {
                    const isCurrentMember = currentMember?.id === member.id
                    const displayName = getMemberDisplayName(member)

                    return (
                      <div
                        key={member.id || member.email || displayName}
                        className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-slate-900/10 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={createAvatarUrl(member.email, member.name)}
                            alt={`${displayName} avatar`}
                            className="h-12 w-12 rounded-full border border-slate-900/10 bg-slate-200 object-cover"
                          />
                          <div>
                            <p className="text-base font-semibold text-slate-900">
                              {displayName}
                            </p>
                            <p className="text-sm text-slate-600">
                              {member.email || 'No email provided'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isCurrentMember ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                              You
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              member.isOnline
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {member.isOnline ? 'Online' : 'Offline'}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              member.isVerified
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {member.isVerified ? 'Verified' : 'Anonymous'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </article>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-900/10 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(10,34,51,0.16)]">
            <p className="text-sm uppercase tracking-[0.2em] text-sky-200/80">
              Room Snapshot
            </p>
            <div className="mt-5 space-y-4">
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-sky-100/75">Room id</p>
                <p className="mt-2 text-lg font-semibold">{roomId}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-sky-100/75">Template</p>
                <p className="mt-2 text-lg font-semibold">
                  {roomTypeName ?? 'Waiting for Firestore data'}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-sky-100/75">Workflow</p>
                <p className="mt-2 text-lg font-semibold">
                  {roomWorkflow?.stepCount
                    ? `${roomWorkflow.activityCount ?? roomWorkflow.activities?.length ?? 1} activities / ${roomWorkflow.stepCount} steps`
                    : 'Waiting for Firestore data'}
                </p>
                <p className="mt-1 text-sm text-sky-100/70">
                  {roomWorkflow?.totalMinutes
                    ? `${roomWorkflow.totalMinutes} min total`
                    : 'No duration recorded'}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-sky-100/75">Member sync</p>
                <p className="mt-2 text-lg font-semibold">
                  {status === 'ready' ? 'Live' : 'Pending'}
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-6 text-slate-100">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 px-8 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">404</p>
        <h1 className="mt-4 font-serif text-4xl">Page not found</h1>
        <a
          href="/"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-white px-5 text-sm font-medium text-slate-950"
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
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#fff8ef_0%,_#f5efe6_100%)] px-5 py-6 text-slate-800">
        <div className="rounded-[2rem] border border-slate-900/10 bg-white/85 px-8 py-10 text-center shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-700">Finishing sign-in</p>
          <h1 className="mt-4 font-serif text-4xl text-slate-900">Verifying your email link...</h1>
        </div>
      </main>
    )
  }

  if (roomMatch) {
    const roomId = decodeURIComponent(roomMatch[1])
    return <RoomPage roomId={roomId} />
  }

  if (pathname === '/') {
    return <HomePage />
  }

  return <NotFoundPage />
}

export default App
