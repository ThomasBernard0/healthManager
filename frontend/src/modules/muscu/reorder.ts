/** The list with the item at `from` moved to `to` (indexes clamped to the list). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to))
  if (from === target || from < 0 || from >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(target, 0, item)
  return copy
}
