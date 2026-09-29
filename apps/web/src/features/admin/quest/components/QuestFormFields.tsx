import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { BookOpen, CalendarDays, CircleHelp, Link2, Trophy } from 'lucide-react';
import type { DateInputs } from '../../dates';
import { sectionsWithErrors, type ChangeSummary, type EditorSectionId } from '../changes';
import type { QuestFormState } from '../questForm';
import { SectionTabs, type SectionTab } from './SectionTabs';
import { BookFieldsSection } from './BookFieldsSection';
import { ResourceListEditor } from './ResourceListEditor';
import { PrizeFieldsSection } from './PrizeFieldsSection';
import { DateTimelineField } from './DateTimelineField';
import { QuizMetaFieldsSection } from './QuizMetaFieldsSection';

interface QuestFormFieldsProps {
  changes: ChangeSummary;
  /** The saved schedule — past dates in it lock. `null` when creating. */
  savedDates: DateInputs | null;
  onCoverUploadingChange: (uploading: boolean) => void;
}

/** Every quest field, grouped. Shared by the editor and the new-edition page through form context. */
export function QuestFormFields({
  changes,
  savedDates,
  onCoverUploadingChange
}: QuestFormFieldsProps) {
  const {
    formState: { errors, submitCount }
  } = useFormContext<QuestFormState>();
  const errored = sectionsWithErrors(errors);
  const [active, setActive] = useState<EditorSectionId>('book');

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
      'Book',
      BookOpen,
      <BookFieldsSection onCoverUploadingChange={onCoverUploadingChange} />
    ),
    tab('resources', 'Resources', Link2, <ResourceListEditor />),
    tab('prizes', 'Prizes', Trophy, <PrizeFieldsSection />),
    tab('dates', 'Dates', CalendarDays, <DateTimelineField savedDates={savedDates} />),
    tab('quiz', 'Quiz', CircleHelp, <QuizMetaFieldsSection />)
  ];

  return <SectionTabs tabs={tabs} active={active} onChange={setActive} />;
}
