// A flashcard with a real 3D flip. Both faces share one grid cell, so the card takes the height of the
// taller face and nothing jumps when it turns.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Module } from '../../types/content';
import { htmlToText } from '../../lib/practice';
import type { CardStage } from '../../lib/srs';
import { ModuleTag, Prose } from './shared/ui';
import StageBadge from './StageBadge';

function FaceHeader({ module, lessonTitle, stage }: { module?: Module; lessonTitle?: string; stage: CardStage }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {module && <ModuleTag module={module} />}
        {lessonTitle && <span className="truncate text-xs text-subtle">{lessonTitle}</span>}
      </div>
      <StageBadge stage={stage} />
    </div>
  );
}

function Face({ back, hidden, children, onClick }: { back?: boolean; hidden: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      className={clsx(
        'lx-face lx-card-surface flex min-h-[320px] flex-col rounded-[28px] border border-border-strong p-6 sm:p-7',
        back && 'lx-face-back',
        hidden && 'pointer-events-none',
        onClick && !hidden && 'cursor-pointer',
      )}
      aria-hidden={hidden}
      inert={hidden}
      onClick={hidden ? undefined : onClick}
    >
      {children}
    </div>
  );
}

export default function FlashcardView({
  front,
  back,
  module,
  lessonTitle,
  stage,
  revealed,
  onReveal,
}: {
  front: string;
  back: string;
  module?: Module;
  lessonTitle?: string;
  stage: CardStage;
  revealed: boolean;
  onReveal: () => void;
}) {
  const long = htmlToText(front).length > 140;
  return (
    <div className="lx-flip">
      <motion.div
        className="lx-flip-inner"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 21, mass: 0.9 }}
      >
        <Face hidden={revealed} onClick={onReveal}>
          <FaceHeader module={module} lessonTitle={lessonTitle} stage={stage} />
          <div className="grid flex-1 place-items-center py-8">
            <Prose html={front} className={clsx('max-w-[54ch] text-center font-medium text-fg', long ? 'text-lg' : 'text-[22px] leading-snug')} />
          </div>
          <p className="text-center text-xs text-subtle">Önce cevabı zihninde kur, sonra kartı çevir.</p>
        </Face>
        <Face back hidden={!revealed}>
          <FaceHeader module={module} lessonTitle={lessonTitle} stage={stage} />
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <Prose html={front} className="max-w-[60ch] text-center text-sm text-muted" />
            <div className="my-5 h-px w-24 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" aria-hidden />
            <Prose html={back} className={clsx('max-w-[56ch] text-center text-fg', long ? 'text-lg' : 'text-xl leading-snug')} />
          </div>
        </Face>
      </motion.div>
    </div>
  );
}
