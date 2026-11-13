import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GuideReviewEditor } from '@/features/curator/GuideReviewEditor';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';
import { isAppError } from '@/server/lib/errors';
import { getGuidesService } from '@/server/modules/guides';
import type { GuideDetailDto } from '@/server/modules/guides/service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review guide',
};

interface CuratorGuidePageProps {
  params: Promise<{ id: string }>;
}

export default async function CuratorGuidePage({ params }: CuratorGuidePageProps) {
  const { id } = await params;
  const guideId = Number(id);
  if (!Number.isInteger(guideId) || guideId < 1) notFound();

  const session = await requirePageRole('Curator', ROLE_HOME.Curator);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  let guide: GuideDetailDto;
  try {
    guide = await getGuidesService().getForCurator(guideId);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return <GuideReviewEditor guide={guide} dict={dict} locale={locale} />;
}
