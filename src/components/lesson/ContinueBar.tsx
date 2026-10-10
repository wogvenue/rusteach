// Sticky bottom bar of the lesson player: tells what is left in the current step and moves on.
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, SkipForward } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ContinueBar({
  ready,
  pendingChecks,
  pendingExercises,
  pendingReflects = 0,
  label,
  onContinue,
  onSkipExercises,
  skipLabel,
  skipHint,
}: {
  ready: boolean;
  pendingChecks: number;
  pendingExercises: number;
  pendingReflects?: number;
  label: string;
  onContinue: () => void;
  onSkipExercises?: () => void;
  skipLabel?: string;
  /** replaces the "solve it or leave it for later" hint when only exercises are left */
  skipHint?: string;
}) {
  let hint = '';
  if (!ready) {
    const parts: string[] = [];
    if (pendingChecks) parts.push(pendingChecks === 1 ? 'soruyu cevapla' : `${pendingChecks} soruyu cevapla`);
    if (pendingReflects) parts.push('kendi cümlelerinle açıkla');
    if (pendingExercises) parts.push(pendingExercises === 1 ? 'alıştırmayı tamamla' : `${pendingExercises} alıştırmayı tamamla`);
    const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ve ${parts[parts.length - 1]}` : parts[0];
    hint =
      !pendingChecks && !pendingReflects && pendingExercises
        ? skipHint
          ? skipHint
          : pendingExercises === 1
          ? 'Alıştırmayı çöz ya da sonraya bırak.'
          : `${pendingExercises} alıştırmayı çöz ya da sonraya bırak.`
        : `Devam etmek için ${joined}.`;
  }
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-bg from-55% to-transparent px-4 pb-5 pt-10">
      <div className="pointer-events-auto flex min-h-12 flex-wrap items-center justify-end gap-3 pl-[3.25rem] sm:pl-[3.6rem]">
        <AnimatePresence mode="popLayout" initial={false}>
          {!ready && (
            <motion.p
              key="hint"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mr-auto text-sm text-muted"
              aria-live="polite"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
        {!ready && pendingExercises > 0 && pendingChecks === 0 && pendingReflects === 0 && onSkipExercises && (
          <Button variant="ghost" icon={<SkipForward className="size-4" />} onClick={onSkipExercises}>
            {skipLabel ?? 'Şimdilik geç'}
          </Button>
        )}
        <motion.div
          initial={false}
          animate={ready ? { scale: [0.96, 1.03, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Button
            size="lg"
            onClick={onContinue}
            disabled={!ready}
            iconRight={
              ready ? (
                <span className="ml-1 hidden items-center rounded-md bg-black/15 px-1.5 py-0.5 text-[0.7rem] font-semibold sm:inline-flex">
                  <CornerDownLeft className="mr-1 size-3" aria-hidden="true" /> Enter
                </span>
              ) : undefined
            }
          >
            {label}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
