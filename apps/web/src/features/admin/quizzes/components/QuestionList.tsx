import { useEffect, useState, type ReactNode } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus } from 'lucide-react';
import { findQuizIssues, type QuizQuestion } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { newQuestion, type QuizFormState } from '../quizForm';
import { QuestionEditor } from './QuestionEditor';

const TYPE_LABEL = { true_false: 'T/F', mcq: 'MCQ' } as const;
const DIFFICULTY_DOT = { easy: 'bg-gold-soft', medium: 'bg-amber', hard: 'bg-ember' } as const;
const ROW_BUTTON =
  'flex h-11 w-9 shrink-0 items-center justify-center text-taupe hover:text-paper disabled:opacity-30 disabled:hover:text-taupe';

/** `issues` keys for one question, with the `questions.{i}.` prefix stripped. */
function issuesFor(all: Record<string, string> | null, index: number): Record<string, string> {
  const prefix = `questions.${index}.`;
  return Object.fromEntries(
    Object.entries(all ?? {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, message]) => [key.slice(prefix.length), message])
  );
}

export function QuestionList({ locked }: { locked: boolean }) {
  const {
    control,
    getValues,
    formState: { errors, submitCount }
  } = useFormContext<QuizFormState>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'questions', keyName: 'key' });
  const [questions, settings] = useWatch({ control, name: ['questions', 'settings'] });
  const [openId, setOpenId] = useState<string | null>(null);
  const issues = findQuizIssues({ questions, settings });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // After a failed submit, open the first question the form complains about.
  useEffect(() => {
    if (submitCount === 0) return;
    const first = fields.findIndex((_, i) => errors.questions?.[i]);
    const target = first === -1 ? undefined : fields[first];
    if (target) setOpenId(target.id);
    // Only a new submit attempt should steal focus, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from !== -1 && to !== -1) move(from, to);
  }

  function addQuestion() {
    const all = getValues('questions');
    const next = newQuestion(all[all.length - 1]);
    append(next);
    setOpenId(next.id);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">Questions</h2>
      {settings.shuffleQuestions && (
        <p className="m-0 text-sm text-taupe">
          Order is shuffled for each participant; this order is used in preview and review.
        </p>
      )}
      {issues?.questions && fields.length === 0 && <p className="m-0 text-sm text-amber">{issues.questions}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {fields.map((field, index) => {
              const question = questions[index];
              if (!question) return null;
              const rowIssues = issuesFor(issues, index);
              return (
                <SortableRow
                  key={field.id}
                  id={field.id}
                  index={index}
                  count={fields.length}
                  question={question}
                  defaultTime={settings.defaultTimeLimitSec}
                  hasError={Boolean(errors.questions?.[index]) || Object.keys(rowIssues).length > 0}
                  open={openId === field.id}
                  locked={locked}
                  onToggle={() => setOpenId(openId === field.id ? null : field.id)}
                  onMove={(to) => move(index, to)}
                >
                  <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
                    <QuestionEditor
                      index={index}
                      issues={rowIssues}
                      onRemove={() => {
                        remove(index);
                        setOpenId(null);
                      }}
                    />
                  </fieldset>
                </SortableRow>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

      {!locked && (
        <div className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-b)+4.5rem)] z-[3] flex justify-center">
          <Button type="button" onClick={addQuestion} className="min-h-11 px-5">
            <Plus className="h-4 w-4" aria-hidden /> Question
          </Button>
        </div>
      )}
    </section>
  );
}

interface SortableRowProps {
  id: string;
  index: number;
  count: number;
  question: QuizQuestion;
  defaultTime: number;
  hasError: boolean;
  open: boolean;
  locked: boolean;
  onToggle: () => void;
  onMove: (to: number) => void;
  children: ReactNode;
}

/** Collapsed header per §5.2: number, type, first line, difficulty dot, time, error badge. */
function SortableRow({
  id,
  index,
  count,
  question,
  defaultTime,
  hasError,
  open,
  locked,
  onToggle,
  onMove,
  children
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: locked });
  const seconds = question.timeLimitSec ?? defaultTime;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-box border bg-[color:var(--color-ash)] ${
        isDragging ? 'relative z-10 border-amber/60 shadow-lg' : 'border-[color:var(--rule)]'
      }`}
    >
      <div className="flex items-center">
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Drag question ${index + 1}`}
          disabled={locked}
          {...attributes}
          {...listeners}
          className={`${ROW_BUTTON} touch-none cursor-grab`}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <span className="w-6 shrink-0 text-sm tabular-nums text-taupe">{index + 1}</span>
          <span className="shrink-0 rounded-full border border-[color:var(--rule)] px-1.5 text-xs text-taupe">
            {TYPE_LABEL[question.type]}
          </span>
          <span className={`min-w-0 flex-1 truncate ${question.prompt.trim() ? 'text-paper' : 'text-taupe'}`}>
            {question.prompt.trim() || 'Untitled question'}
          </span>
          <span aria-label={question.difficulty} className={`h-2 w-2 shrink-0 rounded-full ${DIFFICULTY_DOT[question.difficulty]}`} />
          <span className="shrink-0 text-xs tabular-nums text-taupe">{seconds}s</span>
          {hasError && <AlertTriangle aria-label="Needs attention" className="h-4 w-4 shrink-0 text-error" />}
          <ChevronDown className={`h-4 w-4 shrink-0 text-taupe transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Move question ${index + 1} up`}
          disabled={locked || index === 0}
          onClick={() => onMove(index - 1)}
          className={ROW_BUTTON}
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Move question ${index + 1} down`}
          disabled={locked || index === count - 1}
          onClick={() => onMove(index + 1)}
          className={ROW_BUTTON}
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {open && children}
    </li>
  );
}
