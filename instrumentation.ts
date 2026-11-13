/**
 * Next.js instrumentation hook (AGENTS.md §12).
 *
 * Next runs this once per server process. Background jobs are registered here
 * for the Node runtime only — Edge has no timers and no database — and the job
 * module keeps a global singleton so dev hot reload cannot duplicate them.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { startJobs } = await import('./src/server/jobs');
  await startJobs();
}
