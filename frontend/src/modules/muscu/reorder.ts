import { toBlocks } from '@healthmanager/shared'

/** The list with the item at `from` moved to `to` (indexes clamped to the list). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to))
  if (from === target || from < 0 || from >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(target, 0, item)
  return copy
}

interface Grouped {
  /** Superset group (null: solo). */
  group: string | null
}

/** The list with a block moved by `steps` blocks: a superset moves as one, and is never split by another item. */
export function moveBlock<T extends Grouped>(items: T[], block: number, steps: number): T[] {
  const blocks = toBlocks(items)
  const moved = moveItem(blocks, block, block + steps)
  return moved === blocks ? items : moved.flat()
}

/** Groups that are no longer two items next to each other are dropped (their items become solo). */
export function normalizeGroups<T extends Grouped>(items: T[]): T[] {
  return toBlocks(items).flatMap((block) =>
    block.length === 2 ? block : block.map((item) => (item.group === null ? item : { ...item, group: null })),
  )
}
