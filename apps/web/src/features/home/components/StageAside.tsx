import { formatCount, formatLongDate } from '@/lib/format';
import { useT } from '@/i18n';

type StageAsideProps =
  | { variant: 'left'; title: string; author: string }
  /** Hidden book: the title slot says it's coming instead. */
  | { variant: 'left'; title: null }
  | { variant: 'right'; pages: number | null; quizOpensAt: string; participantCount: number };

/**
 * The two panels either side of the book, visible only at ≥900px
 * (`stage.css` hides both below that) but always in the DOM, in the
 * prototype's accessible order — a screen reader or a print view still gets
 * the book's title before its facts.
 */
export function StageAside(props: StageAsideProps) {
  const t = useT().home;
  if (props.variant === 'left') {
    return (
      <div className="stage__aside stage__aside--left">
        {/* `/`'s one heading — no other element on Home outranks the book
            itself. `.booktitle`'s look comes from the class, not the tag, so
            promoting it from h2 to h1 changes nothing visually. */}
        {props.title === null ? (
          <h1 className="booktitle">{t.revealedSoon}</h1>
        ) : (
          <>
            <h1 className="booktitle">{props.title}</h1>
            <p className="byline">{props.author}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="stage__aside stage__aside--right">
      <dl className="facts">
        {props.pages !== null && (
          <div className="facts__row">
            <dt>{t.factPages}</dt>
            <dd>{formatCount(props.pages)}</dd>
          </div>
        )}
        <div className="facts__row">
          <dt>{t.factQuizOpens}</dt>
          <dd>{formatLongDate(props.quizOpensAt)}</dd>
        </div>
        <div className="facts__row">
          <dt>{t.factReaders}</dt>
          <dd>{formatCount(props.participantCount)}</dd>
        </div>
      </dl>
    </div>
  );
}
