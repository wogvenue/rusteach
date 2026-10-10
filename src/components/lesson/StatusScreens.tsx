// Full-screen states of the focus-mode player that have no lesson to show: unknown lesson id and
// a lesson whose module is still locked. Both keep the drag-region top bar of the player.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Map as MapIcon, X } from 'lucide-react';
import type { Module } from '../../types/content';
import Ferris, { type FerrisMood } from '../Ferris';
import { Button } from '../ui/Button';

const OVERLAY_WIDTH = 140;

function BareTopBar({ title, onExit }: { title: string; onExit: () => void }) {
  const electron = typeof window !== 'undefined' && !!window.rusteach;
  return (
    <header
      className="drag-region flex h-14 shrink-0 items-center gap-2.5 border-b border-border pl-3"
      style={{ paddingRight: electron ? OVERLAY_WIDTH + 8 : 16 }}
    >
      <button
        type="button"
        onClick={onExit}
        className="no-drag grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Geri dön"
      >
        <X className="size-5" />
      </button>
      <span className="truncate text-sm font-semibold text-fg">{title}</span>
    </header>
  );
}

function StatusLayout({
  barTitle,
  onExit,
  mood,
  title,
  children,
  actions,
}: {
  barTitle: string;
  onExit: () => void;
  mood: FerrisMood;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="lesson-root flex h-full flex-col text-fg">
      <BareTopBar title={barTitle} onExit={onExit} />
      <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 28 }}
          className="flex max-w-md flex-col items-center text-center"
        >
          <Ferris mood={mood} size={140} />
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-fg">{title}</h1>
          <div className="mt-2 text-[0.95rem] leading-relaxed text-muted">{children}</div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{actions}</div>
        </motion.div>
      </main>
    </div>
  );
}

export function LessonNotFound({ onNavigate }: { onNavigate: (to: string) => void }) {
  return (
    <StatusLayout
      barTitle="Ders bulunamadı"
      onExit={() => onNavigate('/')}
      mood="thinking"
      title="Bu dersi bulamadık"
      actions={
        <>
          <Button icon={<MapIcon className="size-4" />} onClick={() => onNavigate('/harita')} autoFocus>
            Yolculuk haritasına git
          </Button>
          <Button variant="ghost" onClick={() => onNavigate('/')}>
            Ana sayfa
          </Button>
        </>
      }
    >
      Bağlantı eski olabilir ya da ders henüz yazılmamış olabilir. Haritadan devam edebileceğin dersi seçebilirsin.
    </StatusLayout>
  );
}

export function LessonLocked({
  module,
  prevModule,
  title,
  onNavigate,
}: {
  module: Module;
  prevModule?: Module;
  title: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <StatusLayout
      barTitle={title}
      onExit={() => onNavigate(`/modul/${module.id}`)}
      mood="sleep"
      title="Bu ders henüz kilitli"
      actions={
        <>
          {prevModule ? (
            <Button icon={<ArrowLeft className="size-4" />} onClick={() => onNavigate(`/modul/${prevModule.id}`)} autoFocus>
              Önceki modüle dön
            </Button>
          ) : (
            <Button icon={<MapIcon className="size-4" />} onClick={() => onNavigate('/harita')} autoFocus>
              Yolculuk haritasına git
            </Button>
          )}
          <Button variant="ghost" onClick={() => onNavigate(`/modul/${module.id}`)}>
            Modül sayfası
          </Button>
        </>
      }
    >
      <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
        <Lock className="size-3.5 text-subtle" aria-hidden="true" />
        Modül {module.number}: {module.title}
      </span>
      <p>
        “{title}” dersi bu modülde.
        {prevModule
          ? ` Modül ${prevModule.number} sınavını %80 ile geçtiğinde bu modül açılır.`
          : ' Önceki modülü bitirdiğinde bu modül açılır.'}{' '}
        Konuyu zaten biliyorsan haritadan atlama sınavına girebilir ya da Ayarlar’da serbest modu açabilirsin.
      </p>
    </StatusLayout>
  );
}
