import { PageSkeleton } from '../../components/ui/Skeleton';

/** First-paint skeleton for public pages (AGENTS.md §2, §15). */
export default function PublicLoading() {
  return (
    <div className="mx-auto w-full max-w-shell px-5 py-10 sm:px-8">
      <PageSkeleton />
    </div>
  );
}
