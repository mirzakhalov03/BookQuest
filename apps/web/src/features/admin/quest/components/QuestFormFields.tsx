import { memo, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { BookOpen, CalendarDays, CircleHelp, Link2, Trophy } from 'lucide-react';
import type { AdminQuest } from '@bookquest/shared';
import type { DateInputs } from '../../dates';
import { sectionsWithErrors, type ChangeSummary, type EditorSectionId } from '../changes';
import type { QuestFormState } from '../questForm';
import { SectionTabs, type SectionTab } from './SectionTabs';
import { BookFieldsSection } from './BookFieldsSection';
import { ResourceListEditor } from './ResourceListEditor';
import { PrizeFieldsSection } from './PrizeFieldsSection';
import { DateTimelineField } from './DateTimelineField';
import { QuizConfigSection } from './QuizConfigSection';
import { useT } from '@/i18n';

interface QuestFormFieldsProps {
  changes: ChangeSummary;
  /** The saved schedule — past dates in it lock. `null` when creating. */
  savedDates: DateInputs | null;
  /** True while the cover or the prize photo is uploading, so Save can wait. */
  onUploadingChange: (uploading: boolean) => void;
  /** The saved quest, once one exists: only then is there a quiz to set up. Absent when creating. */
  quiz?: { quest: AdminQuest; lockMessage: string | null };
}

/** Every quest field, grouped. Shared by the editor and the new-edition page through form context. Memoised: fields subscribe themselves. */
export const QuestFormFields = memo(function QuestFormFields({
  changes,
  savedDates,
  onUploadingChange,
  quiz
}: QuestFormFieldsProps) {
  const [coverUploading, setCoverUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  useEffect(() => onUploadingChange(coverUploading || photoUploading), [coverUploading, photoUploading, onUploadingChange]);
  const {
    formState: { errors, submitCount }
  } = useFormContext<QuestFormState>();
  const errored = sectionsWithErrors(errors);
  const [active, setActive] = useState<EditorSectionId>('book');
  const t = useT().adminQuest.tabs;

  // A failed save jumps to the first broken group; typing elsewhere never yanks the view.
  useEffect(() => {
    if (submitCount === 0) return;
    const first = tabs.find((tab) => errored.has(tab.id));
    if (first) setActive(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  const tab = (
    id: EditorSectionId,
    title: string,
    icon: SectionTab<EditorSectionId>['icon'],
    content: React.ReactNode
  ) => ({
    id,
    title,
    icon,
    content,
    isDirty: changes.sections.has(id),
    hasError: errored.has(id)
  });

  const tabs: SectionTab<EditorSectionId>[] = [
    tab(
      'book',
      t.book,
      BookOpen,
      <BookFieldsSection onCoverUploadingChange={setCoverUploading} />
    ),
    tab('resources', t.resources, Link2, <ResourceListEditor />),
    tab('prizes', t.prizes, Trophy, <PrizeFieldsSection onPhotoUploadingChange={setPhotoUploading} />),
    tab('dates', t.dates, CalendarDays, <DateTimelineField savedDates={savedDates} />),
    ...(quiz
      ? [
          tab(
            'quiz',
            t.quiz,
            CircleHelp,
            <QuizConfigSection quest={quiz.quest} lockMessage={quiz.lockMessage} onGoTo={setActive} />
          )
        ]
      : [])
  ];

  return <SectionTabs tabs={tabs} active={active} onChange={setActive} />;
});
