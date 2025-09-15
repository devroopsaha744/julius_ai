export function startKeepalive(ws: any, intervalMs: number) {
  const t = setInterval(() => {
    try { ws.ping?.(); } catch {}
  }, intervalMs);
  return t;
}

export function stopKeepalive(timer: ReturnType<typeof setInterval> | null) {
  if (timer) clearInterval(timer);
}
