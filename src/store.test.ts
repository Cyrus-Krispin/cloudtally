import { beforeEach, describe, expect, it, vi } from 'vitest'
import { designs, useStore } from './store'
import { comparisonTemplates, templates } from './templates'

// The store saves to localStorage, so give it one before it loads.
const memory = vi.hoisted(() => {
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true })
  return m
})

const s = () => useStore.getState()

beforeEach(() => {
  useStore.setState({ ...templates[3].diagram(), past: [], future: [], clipboard: null, active: 'a', other: null })
})

describe('editor history', () => {
  it('undoes and redoes an added service', () => {
    const before = s().nodes.length
    s().addService('lambda', { x: 0, y: 0 })
    expect(s().nodes).toHaveLength(before + 1)
    s().undo()
    expect(s().nodes).toHaveLength(before)
    s().redo()
    expect(s().nodes).toHaveLength(before + 1)
  })

  it('groups quick edits to the same field into one undo step', () => {
    const id = s().nodes[1].id
    s().updateNode(id, { config: { cacheHitPercent: 80 } })
    s().updateNode(id, { config: { cacheHitPercent: 70 } })
    s().updateNode(id, { config: { cacheHitPercent: 60 } })
    s().undo()
    expect(s().nodes[1].data.config.cacheHitPercent).toBe(95)
  })

  it('removes selected services with their connections in one step', () => {
    useStore.setState({ nodes: s().nodes.map((n, i) => ({ ...n, selected: i === 1 })) })
    s().removeSelected()
    expect(s().nodes.map((n) => n.id)).toEqual(['users', 'site'])
    expect(s().edges).toHaveLength(0)
    s().undo()
    expect(s().nodes).toHaveLength(3)
    expect(s().edges).toHaveLength(2)
  })
})

describe('copy and paste', () => {
  it('pastes copies with new IDs and the connections between them', () => {
    s().selectAll()
    s().copySelected()
    s().paste()
    expect(s().nodes).toHaveLength(6)
    expect(new Set(s().nodes.map((n) => n.id)).size).toBe(6)
    expect(s().edges).toHaveLength(4)
    const pasted = s().nodes.filter((n) => n.selected)
    expect(pasted).toHaveLength(3)
    expect(pasted[0].position.x).toBe(s().nodes[0].position.x + 40)
  })
})

describe('designs A and B', () => {
  const ids = () => s().nodes.map((n) => n.id)

  it('starts B as a copy of A and keeps edits to each apart', () => {
    s().switchDesign('b')
    expect(s().active).toBe('b')
    expect(ids()).toEqual(['users', 'cdn', 'site'])
    s().addService('lambda', { x: 0, y: 0 })
    expect(s().nodes).toHaveLength(4)
    s().switchDesign('a')
    expect(ids()).toEqual(['users', 'cdn', 'site'])
    s().switchDesign('b')
    expect(s().nodes).toHaveLength(4)
  })

  it('shares the workload between designs', () => {
    s().switchDesign('b')
    s().setWorkload({ dailyActiveUsers: 123_000 })
    s().switchDesign('a')
    expect(s().workload.dailyActiveUsers).toBe(123_000)
  })

  it('keeps a separate undo history for each design', () => {
    s().switchDesign('b')
    s().switchDesign('a')
    s().addService('lambda', { x: 0, y: 0 }) // A: 4 services
    s().switchDesign('b')
    expect(s().past).toHaveLength(0)
    s().removeElement('site') // B: 2 services
    s().switchDesign('a')
    s().undo()
    expect(ids()).toEqual(['users', 'cdn', 'site'])
    s().switchDesign('b')
    expect(ids()).toEqual(['users', 'cdn'])
    s().undo()
    expect(ids()).toEqual(['users', 'cdn', 'site'])
  })

  it('does not undo a workload change made on the other design', () => {
    s().switchDesign('b')
    s().addService('lambda', { x: 0, y: 0 })
    s().switchDesign('a')
    s().setWorkload({ dailyActiveUsers: 50_000 })
    s().switchDesign('b')
    s().undo()
    expect(s().nodes).toHaveLength(3)
    expect(s().workload.dailyActiveUsers).toBe(50_000)
  })

  it('removes design B and goes back to A', () => {
    s().switchDesign('b')
    s().addService('lambda', { x: 0, y: 0 })
    s().removeDesignB()
    expect(s().active).toBe('a')
    expect(s().other).toBeNull()
    expect(ids()).toEqual(['users', 'cdn', 'site'])
  })

  it('loads a comparison into both designs, each undoable', () => {
    const c = comparisonTemplates[0].comparison()
    s().loadComparison(c)
    const { a, b } = designs(s())
    expect(a.nodes.map((n) => n.data.type)).toEqual(c.a.nodes.map((n) => n.data.type))
    expect(b!.nodes.map((n) => n.data.type)).toEqual(c.b.nodes.map((n) => n.data.type))
    s().undo()
    expect(ids()).toEqual(['users', 'cdn', 'site'])
  })
})

describe('saving designs', () => {
  const saved = () => JSON.parse(memory.get('cloudtally-diagram')!).state

  it('saves both designs and which one is showing, and restores them', async () => {
    s().switchDesign('b')
    s().addService('lambda', { x: 0, y: 0 })
    s().setWorkload({ dailyActiveUsers: 77_000 })
    expect(saved().active).toBe('b')
    expect(saved().other.nodes).toHaveLength(3)
    expect(saved().other.past).toBeUndefined()

    const before = memory.get('cloudtally-diagram')!
    useStore.setState({ ...templates[0].diagram(), active: 'a', other: null })
    memory.set('cloudtally-diagram', before)
    await useStore.persist.rehydrate()
    expect(s().active).toBe('b')
    expect(s().nodes).toHaveLength(4)
    expect(s().workload.dailyActiveUsers).toBe(77_000)
    s().switchDesign('a')
    expect(s().nodes).toHaveLength(3)
    expect(s().past).toEqual([])
  })

  it('loads saves from before there were two designs', async () => {
    const old = templates[1].diagram()
    useStore.setState({ active: 'b', other: { nodes: [], edges: [], past: [], future: [] } })
    memory.set('cloudtally-diagram', JSON.stringify({ state: { workload: old.workload, nodes: old.nodes, edges: old.edges }, version: 1 }))
    await useStore.persist.rehydrate()
    expect(s().active).toBe('a')
    expect(s().other).toBeNull()
    expect(s().nodes.map((n) => n.id)).toEqual(old.nodes.map((n) => n.id))
  })
})
