import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Cloud, Cpu, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useProgress } from '../../store/progress';
import { Tooltip } from '../ui/Tooltip';
import { effectiveRunner, useToolchain } from '../shell/toolchain';

export default function RunnerChip() {
  const setting = useProgress((s) => s.settings.runner);
  const { info, checked, refresh } = useToolchain();
  const navigate = useNavigate();

  useEffect(() => {
    if (!checked) void refresh();
  }, [checked, refresh]);

  const kind = effectiveRunner(setting, info, checked);
  const meta = {
    local: {
      label: 'Yerel Rust',
      icon: <Cpu className="size-3.5" aria-hidden />,
      tone: 'text-success bg-success-soft',
      tip: `Kodun bilgisayarındaki Rust ile çalışır${info?.rustc ? ` (${info.rustc.replace(/^rustc\s+/, '').split(' ')[0]})` : ''}.`,
    },
    online: {
      label: 'Çevrimiçi',
      icon: <Cloud className="size-3.5" aria-hidden />,
      tone: 'text-info bg-info-soft',
      tip: !window.rusteach
        ? 'Kodun Rust Playground’da çalışır.'
        : setting === 'online'
          ? 'Ayarlarda çevrimiçi çalıştırma seçili; kodun Rust Playground’da çalışır.'
          : 'Bilgisayarında Rust bulunamadı; kodun Rust Playground’da çalışır. Kurulum için tıkla.',
    },
    missing: {
      label: 'Rust bulunamadı',
      icon: <TriangleAlert className="size-3.5" aria-hidden />,
      tone: 'text-warning bg-warning-soft',
      tip: 'Ayarlarda yerel çalıştırma seçili ama Rust kurulu değil. Kurulum adımları için tıkla.',
    },
    checking: {
      label: 'Denetleniyor',
      icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden />,
      tone: 'text-muted bg-surface-2',
      tip: 'Bilgisayarındaki Rust kurulumu kontrol ediliyor.',
    },
  }[kind];

  return (
    <Tooltip side="bottom" content={meta.tip}>
      <button
        type="button"
        onClick={() => navigate('/ayarlar#calistirici')}
        className={clsx(
          'no-drag inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-[filter] hover:brightness-110',
          meta.tone,
        )}
        aria-label={`Kod çalıştırıcı: ${meta.label}`}
      >
        {meta.icon}
        <span className="hidden min-[1180px]:inline">{meta.label}</span>
      </button>
    </Tooltip>
  );
}
