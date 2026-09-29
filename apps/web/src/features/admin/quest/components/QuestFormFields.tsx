import { useFormContext } from 'react-hook-form';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { DateInputs } from '../../dates';
import { sectionsWithErrors, type ChangeSummary, type EditorSectionId } from '../changes';
import { sectionSummaries } from '../summaries';
import type { QuestFormState } from '../questForm';
import { EditorSection } from './EditorSection';
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
export function QuestFormFields({ changes, savedDates, onCoverUploadingChange }: QuestFormFieldsProps) {
  const {
    watch,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const summaries = sectionSummaries(watch());
  const errored = sectionsWithErrors(errors);
  const isWide = useMediaQuery('(min-width: 1024px)');

  const section = (id: EditorSectionId) => ({
    summary: summaries[id],
    isDirty: changes.sections.has(id),
    hasError: errored.has(id),
    defaultOpen: isWide
  });

  return (
    <div className="flex flex-col">
      <EditorSection title="Book" {...section('book')}>
        <BookFieldsSection onCoverUploadingChange={onCoverUploadingChange} />
      </EditorSection>
      <EditorSection title="Resources" {...section('resources')}>
        <ResourceListEditor />
      </EditorSection>
      <EditorSection title="Prizes" {...section('prizes')}>
        <PrizeFieldsSection />
      </EditorSection>
      <EditorSection title="Dates" {...section('dates')}>
        <DateTimelineField savedDates={savedDates} />
      </EditorSection>
      <EditorSection title="Quiz" {...section('quiz')}>
        <QuizMetaFieldsSection />
      </EditorSection>
    </div>
  );
}
