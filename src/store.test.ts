import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { templates } from './templates'

const s = () => useStore.getState()

beforeEach(() => {
  useStore.setState({ ...templates[3].diagram(), past: [], future: [], clipboard: null })
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
