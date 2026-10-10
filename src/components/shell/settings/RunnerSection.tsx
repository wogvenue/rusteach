// Settings: where code runs (auto / local / online), the detected local toolchain and a short
// guide for installing Rust on Windows.
import { useEffect } from 'react';
import clsx from 'clsx';
import { CircleCheck, CircleDashed, ExternalLink, Globe, Laptop, RefreshCw, Sparkles, SquareTerminal, TriangleAlert } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Kbd } from '../../ui/primitives';
import { useProgress } from '../../../store/progress';
import { effectiveRunner, isElectron, openExternal, useToolchain } from '../toolchain';
import { SettingRow, SettingsSection } from './SettingRow';

type Runner = 'auto' | 'local' | 'online';

export default function RunnerSection() {
  const runner = useProgress((s) => s.settings.runner);
  const { info, loading, checked, refresh } = useToolchain();
  const electron = isElectron();

  useEffect(() => {
    if (electron && !checked) void refresh();
  }, [electron, checked, refresh]);

  const kind = effectiveRunner(runner, info, checked);
  const hasRust = !!info?.rustc;

  return (
    <SettingsSection
      id="calistirma"
      title="Kod çalıştırma"
      description="Yazdığın kodun nerede derlenip çalışacağı"
      icon={<SquareTerminal className="size-[18px]" />}
    >
      <SettingRow
        title="Çalıştırma yeri"
        description={
          electron
            ? 'Otomatik: bilgisayarında Rust kuruluysa onu, değilse çevrimiçi Rust Playground’u kullanır.'
            : 'Tarayıcı sürümünde kod her zaman çevrimiçi Rust Playground’da çalışır.'
        }
        control={({ labelId }) => (
          <Segmented<Runner>
            labelledBy={labelId}
            value={electron ? runner : 'online'}
            onChange={(v) => useProgress.getState().updateSettings({ runner: v })}
            options={[
              { value: 'auto', label: 'Otomatik', icon: <Sparkles className="size-3.5" /> },
              { value: 'local', label: 'Yerel', icon: <Laptop className="size-3.5" /> },
              { value: 'online', label: 'Çevrimiçi', icon: <Globe className="size-3.5" /> },
            ]}
            className={clsx(!electron && 'pointer-events-none opacity-60')}
          />
        )}
      />

      <div className="py-4">
        <div
          className={clsx(
            'flex flex-wrap items-start gap-4 rounded-2xl border p-4',
            kind === 'missing' ? 'border-[color-mix(in_oklab,var(--c-warning)_40%,var(--c-border))] bg-warning-soft' : 'border-border bg-surface-2',
          )}
          aria-live="polite"
        >
          <span className="mt-0.5" aria-hidden>
            {kind === 'local' ? (
              <CircleCheck className="size-5 text-success" />
            ) : kind === 'missing' ? (
              <TriangleAlert className="size-5 text-warning" />
            ) : kind === 'checking' ? (
              <CircleDashed className="size-5 animate-spin text-muted" />
            ) : (
              <Globe className="size-5 text-info" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">
              {kind === 'local'
                ? 'Kodun bilgisayarındaki Rust ile çalışıyor'
                : kind === 'missing'
                  ? 'Yerel Rust bulunamadı'
                  : kind === 'checking'
                    ? 'Rust kurulumu kontrol ediliyor…'
                    : 'Kodun çevrimiçi Rust Playground’da çalışıyor'}
            </p>
            {electron ? (
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
                <dt className="text-muted">rustc</dt>
                <dd className="truncate font-mono text-fg">{info?.rustc ?? (checked ? 'kurulu değil' : '…')}</dd>
                <dt className="text-muted">cargo</dt>
                <dd className="truncate font-mono text-fg">{info?.cargo ?? (checked ? 'kurulu değil' : '…')}</dd>
              </dl>
            ) : (
              <p className="mt-1 text-[13px] leading-5 text-muted">
                İnternet bağlantısı gerekir. Masaüstü uygulamasında Rust’ı kurarsan kodun çevrimdışı ve daha hızlı çalışır.
              </p>
            )}
            {kind === 'missing' && (
              <p className="mt-2 text-[13px] leading-5 text-fg">
                “Yerel” seçili ama Rust kurulu değil. Aşağıdaki adımlarla kurabilir ya da “Otomatik”e geçebilirsin.
              </p>
            )}
          </div>
          {electron && (
            <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => void refresh()}>
              Yeniden kontrol et
            </Button>
          )}
        </div>
      </div>

      {(!electron || !hasRust) && <InstallGuide electron={electron} />}
    </SettingsSection>
  );
}

function InstallGuide({ electron }: { electron: boolean }) {
  const steps = [
    {
      title: 'rustup’ı indir',
      body: (
        <>
          Rust’ın resmi kurulum aracı rustup’tır.{' '}
          <button
            type="button"
            onClick={() => openExternal('https://rustup.rs')}
            className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline"
          >
            rustup.rs
            <ExternalLink className="size-3" aria-hidden />
          </button>{' '}
          adresinden <span className="font-mono text-[12.5px]">rustup-init.exe</span> dosyasını indirip çalıştır.
        </>
      ),
    },
    {
      title: 'C++ derleme araçlarını kabul et',
      body: (
        <>
          Windows’ta Rust, Microsoft’un bağlayıcısına ihtiyaç duyar. Kurulum sorduğunda Visual Studio Build Tools’u kur ve
          “Desktop development with C++” iş yükünü seç.
        </>
      ),
    },
    {
      title: 'Varsayılanlarla devam et',
      body: (
        <>
          Kurucunun sorusuna <Kbd>1</Kbd> ve <Kbd>Enter</Kbd> ile cevap ver. Bitince bir terminalde{' '}
          <span className="font-mono text-[12.5px]">rustc --version</span> yazarak kontrol edebilirsin.
        </>
      ),
    },
    {
      title: electron ? 'Rusteach’i yeniden başlat' : 'Masaüstü uygulamasını kullan',
      body: electron
        ? 'Uygulamayı kapatıp aç ya da yukarıdaki “Yeniden kontrol et” düğmesine bas. Kodun artık yerelde çalışır.'
        : 'Yerel Rust’ı yalnızca masaüstü uygulaması kullanabilir; tarayıcıda çalışmaya devam edebilirsin.',
    },
  ];
  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-fg">Rust’ı bilgisayarına kur</h3>
      <p className="mt-0.5 text-[13px] text-muted">Yaklaşık 10 dakika sürer ve bir kez yapılır.</p>
      <ol className="mt-3 grid gap-2.5 @3xl:grid-cols-2">
        {steps.map((st, i) => (
          <li key={st.title} className="flex gap-3 rounded-2xl border border-border p-3.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent" aria-hidden>
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg">{st.title}</div>
              <p className="mt-0.5 text-[13px] leading-5 text-muted">{st.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
