// Tiny ID generator — no external dependency needed
export const nanoid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);
