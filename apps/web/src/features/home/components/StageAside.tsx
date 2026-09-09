import { formatCount, formatLongDate } from '@/lib/format';

type StageAsideProps =
  | { variant: 'left'; title: string; author: string }
  | { variant: 'right'; pages: number; quizOpensAt: string; participantCount: number };

/**
 * The two panels either side of the book, visible only at ≥900px
 * (`stage.css` hides both below that) but always in the DOM, in the
 * prototype's accessible order — a screen reader or a print view still gets
 * the book's title before its facts.
 */
export function StageAside(props: StageAsideProps) {
  if (props.variant === 'left') {
    return (
      <div className="stage__aside stage__aside--left">
        <p className="tag">On the stage</p>
        <h2 className="booktitle">{props.title}</h2>
        <p className="byline">{props.author}</p>
      </div>
    );
  }

  return (
    <div className="stage__aside stage__aside--right">
      <dl className="facts">
        <div className="facts__row">
          <dt>Pages</dt>
          <dd>{formatCount(props.pages)}</dd>
        </div>
        <div className="facts__row">
          <dt>Quiz opens</dt>
          <dd>{formatLongDate(props.quizOpensAt)}</dd>
        </div>
        <div className="facts__row">
          <dt>Readers in</dt>
          <dd>{formatCount(props.participantCount)}</dd>
        </div>
      </dl>
    </div>
  );
}
