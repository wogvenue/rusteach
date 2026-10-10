// First-run onboarding: welcome, name, prior experience, daily goal, how Rusteach teaches.
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowLeft, Brain, Bug, Footprints, Repeat } from 'lucide-react';
import Ferris, { type FerrisMood } from '../Ferris';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useProgress, type Profile } from '../../store/progress';
import { modules, tiers } from '../../lib/content';
import { play } from '../../lib/sound';
import { celebrateSmall } from '../../lib/celebrate';

type Experience = NonNullable<Profile['experience']>;

const STEPS: { mood: FerrisMood; bubble: string }[] = [
  { mood: 'wave', bubble: 'Selam!' },
  { mood: 'happy', bubble: 'Tanıştığımıza memnun oldum.' },
  { mood: 'thinking', bubble: 'Bakalım nereden başlıyoruz…' },
  { mood: 'happy', bubble: 'Az ama her gün!' },
  { mood: 'celebrate', bubble: 'Hazırsın!' },
];

const EXPERIENCES: { id: Experience; icon: string; title: string; text: string }[] = [
  { id: 'none', icon: '🌱', title: 'Hiç yazmadım', text: 'Sorun değil, her şeyi en baştan anlatacağız.' },
  { id: 'some', icon: '🌿', title: 'Biraz yazdım', text: 'Python ya da JavaScript gibi bir dilde birkaç program yazdım.' },
  { id: 'experienced', icon: '🌳', title: 'Deneyimliyim', text: 'Başka dillerde rahatım, Rust’ta yeniyim.' },
];

const EXPERIENCE_NOTE: Record<Experience, ReactNode> = {
  none: 'Harika bir başlangıç noktası. İlk modül tam olarak senin için yazıldı; acele etmeden ilerle.',
  some: (
    <>
      Bildiğin konuları hızlıca geçebilirsin: haritada kilitli bir modülün <strong>atlama sınavını</strong> %80 ile geçersen o
      modül doğrudan açılır.
    </>
  ),
  experienced: (
    <>
      Temel modülleri <strong>atlama sınavlarıyla</strong> geçip sahiplik, ödünç alma ve trait’ler gibi Rust’a özgü konulara hızla
      ulaşabilirsin. Sahiplik modülünü atlamamanı öneririz: Rust’ın kalbi orada.
    </>
  ),
};

const GOALS = [
  { xp: 50, title: 'Rahat', text: 'Günde yaklaşık 10 dakika' },
  { xp: 100, title: 'Düzenli', text: 'Günde yaklaşık 20 dakika', recommended: true },
  { xp: 200, title: 'Ciddi', text: 'Günde yaklaşık 40 dakika' },
];

const METHOD = [
  { icon: Footprints, title: 'Kısa adımlar', text: 'Her ders küçük adımlara bölünür. Beynin bir seferde az ama sağlam öğrenir.' },
  { icon: Brain, title: 'Önce hatırlamaya çalış', text: 'Cevaba bakmadan önce hatırlamayı denemek, tekrar okumaktan çok daha etkilidir.' },
  { icon: Repeat, title: 'Aralıklı tekrar', text: 'Öğrendiklerin, tam unutmak üzereyken Tekrar bölümünde yeniden karşına çıkar.' },
  { icon: Bug, title: 'Hatalar öğretir', text: 'Yanlış cevaplar ve derleyici hataları öğrenmenin parçası. Onlardan korkma, onları oku.' },
];

export default function Onboarding({ open }: { open: boolean }) {
  return (
    <Dialog open={open} dismissible={false} labelledBy="onboarding-title" className="max-w-[860px] overflow-hidden">
      <OnboardingFlow />
    </Dialog>
  );
}

function OnboardingFlow() {
  const profile = useProgress((s) => s.profile);
  const currentGoal = useProgress((s) => s.settings.dailyGoalXp);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(profile.name);
  const [experience, setExperience] = useState<Experience | undefined>(profile.experience);
  const [goal, setGoal] = useState(GOALS.some((g) => g.xp === currentGoal) ? currentGoal : 100);
  const heading = useRef<HTMLHeadingElement>(null);
  const last = STEPS.length - 1;

  useEffect(() => {
    // move focus to the new step for screen readers / keyboard users (not on the first render)
    if (step > 0) heading.current?.focus();
  }, [step]);

  const finish = (skip = false) => {
    const { completeOnboarding, updateSettings } = useProgress.getState();
    completeOnboarding({ name: name.trim(), experience: skip ? experience : experience ?? 'none' });
    updateSettings({ dailyGoalXp: goal });
    if (!skip) {
      play('complete');
      celebrateSmall({ x: 0.5, y: 0.6 });
    }
  };

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  const canContinue = step !== 2 || !!experience;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    if (step === last) finish();
    else go(step + 1);
  };

  const primaryLabel = ['Tanışalım', 'Devam', 'Devam', 'Devam', 'Yolculuğa başla'][step];

  return (
    <form onSubmit={submit} className="grid min-h-[520px] grid-cols-[minmax(0,300px)_1fr]">
      {/* illustration */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden border-r border-border bg-surface-2 px-6">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_35%,color-mix(in_oklab,var(--c-accent)_26%,transparent),transparent_70%)]"
        />
        <div aria-hidden className="absolute -bottom-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full border border-[color-mix(in_oklab,var(--c-accent)_18%,transparent)]" />
        <div aria-hidden className="absolute -bottom-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full border border-[color-mix(in_oklab,var(--c-accent)_10%,transparent)]" />
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="relative flex flex-col items-center"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <div className="relative mb-3 rounded-2xl border border-border-strong bg-elevated px-3.5 py-2 text-sm font-semibold text-fg shadow-card">
              {STEPS[step].bubble}
              <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-border-strong bg-elevated" />
            </div>
            <Ferris mood={STEPS[step].mood} size={200} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* content */}
      <div className="flex min-w-0 flex-col p-8 pb-6">
        <div className="relative flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -20, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            >
              {step === 0 && (
                <StepBody
                  headingRef={heading}
                  title="Merhaba, ben Ferris!"
                  lead="Rust topluluğunun maskotuyum ve bu yolculukta rehberin olacağım. Rusteach’te Rust’ı hiç bilmeden başlayıp uzmanlık seviyesine kadar öğreneceksin: kısa derslerle, gerçek kodla ve bol pratikle."
                >
                  <ul className="mt-6 space-y-2.5 text-[15px]">
                    <Fact icon="🗺️">
                      {tiers.length} bölgeye yayılmış {Math.max(modules.length, 1)} modüllük bir yolculuk
                    </Fact>
                    <Fact icon="🦀">Gerçek Rust derleyicisiyle çalışan kod alıştırmaları</Fact>
                    <Fact icon="🧠">Unutmadan önce hatırlatan aralıklı tekrar sistemi</Fact>
                  </ul>
                </StepBody>
              )}

              {step === 1 && (
                <StepBody headingRef={heading} title="Sana nasıl seslenelim?" lead="Seni adınla selamlayalım ve yolculuğun sonunda sertifikana adını yazalım.">
                  <label htmlFor="onb-name" className="mt-6 block text-sm font-semibold text-fg">
                    Adın
                  </label>
                  <input
                    id="onb-name"
                    data-autofocus
                    autoFocus
                    value={name}
                    maxLength={40}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="given-name"
                    className="mt-2 h-12 w-full rounded-xl border border-border-strong bg-surface-2 px-4 text-[17px] font-medium text-fg outline-none transition-colors focus:border-accent focus:bg-surface"
                  />
                  <p className="mt-2 text-[13px] text-muted">Bilgilerin yalnızca bu bilgisayarda saklanır. İstersen boş bırakabilirsin.</p>
                </StepBody>
              )}

              {step === 2 && (
                <StepBody headingRef={heading} title="Daha önce kod yazdın mı?" lead="Sana uygun bir başlangıç noktası önerelim.">
                  <div role="radiogroup" aria-labelledby="onboarding-title" className="mt-5 grid gap-2.5">
                    {EXPERIENCES.map((x) => (
                      <ChoiceCard key={x.id} selected={experience === x.id} onSelect={() => setExperience(x.id)} icon={x.icon} title={x.title} text={x.text} />
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    {experience && (
                      <motion.p
                        key={experience}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-[13px] leading-5 text-fg [&_strong]:font-semibold [&_strong]:text-accent"
                      >
                        {EXPERIENCE_NOTE[experience]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </StepBody>
              )}

              {step === 3 && (
                <StepBody headingRef={heading} title="Günlük hedefini seç" lead="Her gün biraz çalışmak, haftada bir uzun oturumdan çok daha kalıcıdır.">
                  <div role="radiogroup" aria-labelledby="onboarding-title" className="mt-5 grid grid-cols-3 gap-2.5">
                    {GOALS.map((g) => (
                      <button
                        key={g.xp}
                        type="button"
                        role="radio"
                        aria-checked={goal === g.xp}
                        onClick={() => setGoal(g.xp)}
                        className={clsx(
                          'relative flex flex-col items-start rounded-2xl border p-4 text-left transition-colors',
                          goal === g.xp
                            ? 'border-accent bg-accent-soft'
                            : 'border-border-strong bg-surface-2 hover:border-subtle',
                        )}
                      >
                        {g.recommended && (
                          <span className="absolute right-2.5 top-2.5 rounded-full bg-accent px-2 text-[10px] font-bold leading-5 text-accent-fg">
                            Önerilen
                          </span>
                        )}
                        <span className="text-[15px] font-semibold text-fg">{g.title}</span>
                        <span className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-fg">
                          {g.xp}
                          <span className="ml-1 text-sm font-semibold text-muted">XP</span>
                        </span>
                        <span className="mt-1 text-xs text-muted">{g.text}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[13px] leading-5 text-muted">
                    Hedefini her tamamladığında 25 XP bonus kazanırsın. İstediğin zaman Ayarlar’dan değiştirebilirsin.
                  </p>
                </StepBody>
              )}

              {step === 4 && (
                <StepBody headingRef={heading} title="Rusteach nasıl öğretir?" lead="Uygulamanın her parçası, beynin gerçekte nasıl öğrendiğine göre tasarlandı.">
                  <ul className="mt-5 grid gap-3">
                    {METHOD.map(({ icon: Icon, title, text }) => (
                      <li key={title} className="flex gap-3.5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div>
                          <div className="text-[15px] font-semibold text-fg">{title}</div>
                          <div className="text-[13px] leading-5 text-muted">{text}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </StepBody>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer */}
        <div className="mt-6 flex items-center gap-3">
          <ol className="flex items-center gap-1.5" aria-label={`Adım ${step + 1} / ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <li
                key={i}
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-accent' : i < step ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-border-strong',
                )}
              />
            ))}
          </ol>
          <div className="ml-auto flex items-center gap-2">
            {step < last && (
              <button type="button" onClick={() => finish(true)} className="mr-1 rounded-lg px-2 py-1 text-[13px] font-medium text-muted hover:text-fg">
                Şimdilik geç
              </button>
            )}
            {step > 0 && (
              <Button type="button" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => go(step - 1)}>
                Geri
              </Button>
            )}
            <Button type="submit" size="lg" disabled={!canContinue} data-autofocus={step === 0 ? true : undefined}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function StepBody({
  title,
  lead,
  children,
  headingRef,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div>
      <h2 id="onboarding-title" ref={headingRef} tabIndex={-1} className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-fg outline-none">
        {title}
      </h2>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-6 text-muted">{lead}</p>
      {children}
    </div>
  );
}

function Fact({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-lg" aria-hidden>
        {icon}
      </span>
      <span className="text-fg">{children}</span>
    </li>
  );
}

function ChoiceCard({ selected, onSelect, icon, title, text }: { selected: boolean; onSelect: () => void; icon: string; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={clsx(
        'flex items-center gap-3.5 rounded-2xl border px-4 py-3 text-left transition-colors',
        selected ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface-2 hover:border-subtle',
      )}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-fg">{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
      <span
        aria-hidden
        className={clsx('grid size-5 shrink-0 place-items-center rounded-full border-2', selected ? 'border-accent' : 'border-border-strong')}
      >
        {selected && <span className="size-2.5 rounded-full bg-accent" />}
      </span>
    </button>
  );
}
