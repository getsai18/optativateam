/** Simulated network latency for mock API calls. */
export function latency(minMs = 120, maxMs = 320): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
