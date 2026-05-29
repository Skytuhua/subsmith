/** Monotonic id generator for cue identities (internal only; never serialized). */
let counter = 0

export function nextId(): string {
  counter += 1
  return `c${counter.toString(36)}`
}

/** Reset the counter — used by tests for deterministic ids. */
export function resetIds(): void {
  counter = 0
}
