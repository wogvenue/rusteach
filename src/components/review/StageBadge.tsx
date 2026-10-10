import { Badge } from '../ui/primitives';
import { STAGE_LABELS, type CardStage } from '../../lib/srs';

const TONES: Record<CardStage, 'accent' | 'info' | 'success' | 'warning'> = {
  new: 'accent',
  learning: 'info',
  review: 'success',
  relearning: 'warning',
};

export default function StageBadge({ stage, className }: { stage: CardStage; className?: string }) {
  return (
    <Badge tone={TONES[stage]} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STAGE_LABELS[stage]}
    </Badge>
  );
}
