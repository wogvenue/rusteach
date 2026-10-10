// Shared answer flow for check blocks (quiz / predict / compiles / fill / parsons):
//   answer -> (confidence?) -> commit (recordBlock) -> resolved, or "pending" after a wrong answer
//   in lesson/practice mode (the learner may retry before the answer is revealed).
// onComplete fires once, when the block is resolved (correct, revealed, or immediately in
// boss/review mode). The outcome reports the FIRST commit of this mount (first try).
import { useCallback, useMemo, useRef, useState } from 'react';
import { useProgress, type BlockResult, type Confidence } from '../../store/progress';
import { xpToast } from '../../store/ui';
import { play } from '../../lib/sound';
import type { BlockMode, BlockOutcome } from './types';

export type CheckPhase = 'answer' | 'confidence' | 'pending' | 'done';

export function savedResult(blockId: string, mode: BlockMode, fresh?: boolean): BlockResult | undefined {
  if (mode !== 'lesson' || fresh) return undefined;
  return useProgress.getState().blocks[blockId];
}

interface Options {
  blockId: string;
  lessonId: string;
  mode: BlockMode;
  fresh?: boolean;
  onComplete?: (o: BlockOutcome) => void;
  /** Can the learner retry before seeing the answer? (false for 2-option checks) */
  allowRetry: boolean;
  /** Ask "Ne kadar eminsin?" before revealing (first attempt only). */
  askConfidence: boolean;
  /** Reveal automatically after this many wrong attempts (default 2). */
  maxWrong?: number;
}

export function useCheckFlow<A>({
  blockId,
  lessonId,
  mode,
  fresh,
  onComplete,
  allowRetry,
  askConfidence,
  maxWrong = 2,
}: Options) {
  const saved = useMemo(() => savedResult(blockId, mode, fresh), [blockId, mode, fresh]);
  const showConfSetting = useProgress((s) => s.settings.showConfidence);
  const retryable = allowRetry && (mode === 'lesson' || mode === 'practice');

  const [phase, setPhase] = useState<CheckPhase>(() =>
    saved ? (saved.correct || !retryable ? 'done' : 'pending') : 'answer',
  );
  const [answer, setAnswer] = useState<A | undefined>(() => saved?.answer as A | undefined);
  const [correct, setCorrect] = useState<boolean | null>(() => (saved ? saved.correct : null));
  const [confidence, setConfidence] = useState<Confidence | undefined>(saved?.confidence);
  const [revealed, setRevealed] = useState<boolean>(() => !!saved && (saved.correct || !retryable));
  const [xp, setXp] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [restored] = useState(!!saved);
  const draft = useRef<{ a: A; ok: boolean } | null>(null);
  const first = useRef<BlockOutcome | null>(null);
  const done = useRef(!!saved);
  const wrong = useRef(saved && !saved.correct ? 1 : 0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCompleteRef.current?.(first.current ?? { correct: false });
  }, []);

  const commit = useCallback(
    (a: A, ok: boolean, conf?: Confidence) => {
      const res = useProgress.getState().recordBlock(blockId, lessonId, { correct: ok, confidence: conf, answer: a, context: mode });
      xpToast(res.xp, ok ? 'Doğru cevap' : undefined);
      play(ok ? 'correct' : 'wrong');
      setXp(res.xp);
      setAnswer(a);
      setCorrect(ok);
      setPulse((p) => p + 1);
      setAttempts((n) => n + 1);
      if (!first.current) first.current = { correct: ok, confidence: conf, answer: a };
      if (!ok) wrong.current += 1;
      // boss / review answers resolve immediately (retryable is only true in lesson / practice)
      if (ok || !retryable || wrong.current >= maxWrong) {
        setRevealed(true);
        setPhase('done');
        finish();
      } else {
        setPhase('pending');
      }
    },
    [blockId, lessonId, mode, retryable, maxWrong, finish],
  );

  /** Learner committed an answer. Asks for confidence first when enabled (first attempt only). */
  const submit = useCallback(
    (a: A, ok: boolean) => {
      const wantConf = askConfidence && showConfSetting && mode !== 'boss' && attempts === 0 && !restored;
      if (wantConf) {
        draft.current = { a, ok };
        setAnswer(a);
        setPhase('confidence');
        return;
      }
      commit(a, ok, undefined);
    },
    [askConfidence, showConfSetting, mode, attempts, restored, commit],
  );

  const pickConfidence = useCallback(
    (c: Confidence) => {
      const d = draft.current;
      if (!d) return;
      draft.current = null;
      setConfidence(c);
      commit(d.a, d.ok, c);
    },
    [commit],
  );

  /** Back from the confidence question to change the answer. */
  const cancelConfidence = useCallback(() => {
    draft.current = null;
    setPhase('answer');
  }, []);

  const retry = useCallback(() => {
    setCorrect(null);
    setPhase('answer');
  }, []);

  const reveal = useCallback(() => {
    setRevealed(true);
    setPhase('done');
    finish();
  }, [finish]);

  return {
    phase,
    answer,
    setAnswer,
    correct,
    confidence,
    revealed,
    xp,
    pulse,
    attempts,
    restored,
    wrongCount: wrong.current,
    retryable,
    submit,
    pickConfidence,
    cancelConfidence,
    retry,
    reveal,
  };
}
