// One lesson step on the "forge rail": numbered node, title and the step's blocks.
import { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { Step } from '../../types/content';
import BlockRenderer from '../blocks/BlockRenderer';
import type { BlockMode, BlockOutcome } from '../blocks/types';

export type StepState = 'done' | 'current' | 'todo';

interface Props {
  step: Step;
  index: number;
  state: StepState;
  lessonId: string;
  mode: BlockMode;
  fresh?: boolean;
  onBlockComplete: (blockId: string, outcome: BlockOutcome) => void;
  animateIn?: boolean;
}

const StepSection = memo(
  forwardRef<HTMLElement, Props>(function StepSection(
    { step, index, state, lessonId, mode, fresh, onBlockComplete, animateIn = true },
    ref,
  ) {
    const headingId = `adim-${index + 1}-baslik`;
    return (
      <motion.section
        ref={ref}
        id={`adim-${index + 1}`}
        data-state={state}
        className="step-section relative pb-14 pl-[3.25rem] sm:pl-[3.6rem]"
        initial={animateIn ? { opacity: 0, y: 18 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 30 }}
        aria-labelledby={headingId}
      >
        <div className="step-rail" aria-hidden="true">
          <span className="step-node">{state === 'done' ? <Check className="size-4" strokeWidth={3} /> : index + 1}</span>
        </div>
        {step.titleHtml ? (
          <h2 id={headingId} tabIndex={-1} className="step-title pt-0.5 outline-none" dangerouslySetInnerHTML={{ __html: step.titleHtml }} />
        ) : (
          <h2 id={headingId} tabIndex={-1} className="sr-only">
            Giriş
          </h2>
        )}
        <div className={step.titleHtml ? 'mt-5 space-y-7' : 'space-y-7 pt-1'}>
          {step.blocks.map((b, bi) => (
            <BlockRenderer
              key={'id' in b ? b.id : `md-${bi}`}
              block={b}
              lessonId={lessonId}
              mode={mode}
              fresh={fresh}
              onComplete={'id' in b ? (o) => onBlockComplete(b.id, o) : undefined}
            />
          ))}
        </div>
      </motion.section>
    );
  }),
);

export default StepSection;
