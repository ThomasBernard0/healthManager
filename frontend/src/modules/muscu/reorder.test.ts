import { toBlocks } from '@healthmanager/shared'
import { moveBlock, moveItem, normalizeGroups } from './reorder'

describe('moveItem', () => {
  it('moves an item up or down, clamped to the list', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
})

describe('superset blocks', () => {
  const item = (id: string, group: string | null = null) => ({ id, group })
  const ids = (items: { id: string }[]) => items.map((i) => i.id).join('')
  // a, [b c], d
  const list = [item('a'), item('b', 'g'), item('c', 'g'), item('d')]

  it('cuts the list in blocks: a superset is one block', () => {
    expect(toBlocks(list).map(ids)).toEqual(['a', 'bc', 'd'])
    expect(toBlocks([item('a', 'g'), item('b', 'h'), item('c', 'h')]).map(ids)).toEqual(['a', 'bc'])
  })

  it('moves a superset as one block', () => {
    expect(ids(moveBlock(list, 1, -1))).toBe('bcad')
    expect(ids(moveBlock(list, 1, 1))).toBe('adbc')
  })

  it('moves an exercise over a superset, never inside it', () => {
    expect(ids(moveBlock(list, 0, 1))).toBe('bcad')
    expect(ids(moveBlock(list, 2, -1))).toBe('adbc')
    expect(moveBlock(list, 0, -1)).toBe(list)
  })

  it('drops a group left with one item', () => {
    expect(normalizeGroups([item('a'), item('b', 'g'), item('d')])).toEqual([item('a'), item('b'), item('d')])
    expect(normalizeGroups(list)).toEqual(list)
  })
})
