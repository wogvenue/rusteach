// Settings: export / import progress as a JSON file, and the guarded "start over" reset.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, HardDrive, RotateCcw, TriangleAlert, Upload } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { dayKey, useProgress } from '../../../store/progress';
import { toast } from '../../../store/ui';
import { SettingRow, SettingsSection } from './SettingRow';

const CONFIRM_WORD = 'SIFIRLA';
/** Accepts sıfırla / SIFIRLA / sifirla. */
const confirmed = (t: string) => t.trim().toLocaleUpperCase('tr').replace(/İ/g, 'I') === CONFIRM_WORD;

export default function DataSection() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null); // imported JSON waiting for confirmation
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const exportProgress = async () => {
    const json = useProgress.getState().exportData();
    const name = `rusteach-ilerleme-${dayKey()}.json`;
    try {
      if (window.rusteach) {
        const saved = await window.rusteach.saveTextFile(name, json);
        if (saved) toast({ kind: 'success', title: 'İlerlemen kaydedildi', description: 'Dosyayı başka bir bilgisayara taşıyıp içe aktarabilirsin.' });
        return;
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ kind: 'success', title: 'İlerleme dosyası indirildi', description: name });
    } catch {
      toast({ kind: 'error', title: 'Dosya kaydedilemedi', description: 'Başka bir klasör seçip yeniden dene.' });
    }
  };

  const validate = (text: string | null) => {
    if (text === null) return;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.app !== 'rusteach' || !parsed.data) throw new Error('format');
      setPending(text);
    } catch {
      toast({ kind: 'error', title: 'Bu bir Rusteach ilerleme dosyası değil', description: 'Ayarlar sayfasından dışa aktardığın .json dosyasını seç.' });
    }
  };

  const importProgress = async () => {
    if (window.rusteach) {
      try {
        validate(await window.rusteach.openTextFile());
      } catch {
        toast({ kind: 'error', title: 'Dosya açılamadı' });
      }
    } else fileInput.current?.click();
  };

  const confirmImport = () => {
    if (!pending) return;
    const ok = useProgress.getState().importData(pending);
    setPending(null);
    toast(
      ok
        ? { kind: 'success', title: 'İlerlemen içe aktarıldı', description: 'Kaldığın yerden devam edebilirsin.' }
        : { kind: 'error', title: 'İçe aktarma başarısız', description: 'Dosya bozuk olabilir; mevcut ilerlemen değişmedi.' },
    );
  };

  const confirmReset = () => {
    useProgress.getState().resetAll();
    setResetOpen(false);
    setTyped('');
    toast({ kind: 'info', title: 'İlerleme sıfırlandı', description: 'Yolculuk baştan başlıyor.' });
    navigate('/');
  };

  return (
    <SettingsSection id="veriler" title="Verilerin" description="İlerlemen yalnızca bu bilgisayarda saklanır" icon={<HardDrive className="size-[18px]" />}>
      <SettingRow
        title="Dışa aktar"
        description="Bütün ilerlemeni, notlarını ve ayarlarını tek bir dosyaya kaydet. Yedek almak ya da başka bilgisayara taşımak için."
        control={() => (
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => void exportProgress()}>
            Dosyaya kaydet
          </Button>
        )}
      />
      <SettingRow
        title="İçe aktar"
        description="Daha önce kaydettiğin bir ilerleme dosyasını yükle. Bu bilgisayardaki mevcut ilerlemenin yerini alır."
        control={() => (
          <>
            <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => void importProgress()}>
              Dosya seç
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              tabIndex={-1}
              aria-hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) validate(await f.text());
              }}
            />
          </>
        )}
      />
      <SettingRow
        title="Baştan başla"
        description="Bütün XP’ni, derslerini, kartlarını ve başarımlarını siler. Geri alınamaz; önce dışa aktarmanı öneririz."
        control={() => (
          <Button variant="outline" className="!text-danger hover:!border-danger" icon={<RotateCcw className="size-4" />} onClick={() => setResetOpen(true)}>
            İlerlemeyi sıfırla
          </Button>
        )}
      />

      <Dialog open={pending !== null} onClose={() => setPending(null)} labelledBy="import-title" describedBy="import-desc">
        <div className="p-6">
          <h2 id="import-title" className="pr-8 text-[19px] font-semibold tracking-[-0.02em] text-fg">
            İlerleme dosyası yüklensin mi?
          </h2>
          <p id="import-desc" className="mt-2 text-sm leading-6 text-muted">
            Bu bilgisayardaki ilerlemenin yerini dosyadaki ilerleme alacak. Mevcut ilerlemeni saklamak istiyorsan önce dışa aktar.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Vazgeç
            </Button>
            <Button data-autofocus icon={<Upload className="size-4" />} onClick={confirmImport}>
              Dosyayı yükle
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setTyped('');
        }}
        labelledBy="reset-title"
        describedBy="reset-desc"
      >
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed(typed)) confirmReset();
          }}
        >
          <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger" aria-hidden>
            <TriangleAlert className="size-5" />
          </span>
          <h2 id="reset-title" className="mt-4 pr-8 text-[19px] font-semibold tracking-[-0.02em] text-fg">
            Bütün ilerlemen silinsin mi?
          </h2>
          <p id="reset-desc" className="mt-2 text-sm leading-6 text-muted">
            XP, seri, dersler, tekrar kartları, notlar ve başarımlar kalıcı olarak silinir. Onaylamak için kutuya{' '}
            <span className="font-mono font-semibold text-fg">{CONFIRM_WORD}</span> yaz.
          </p>
          <label htmlFor="reset-confirm" className="sr-only">
            Onay kelimesi
          </label>
          <input
            id="reset-confirm"
            data-autofocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={CONFIRM_WORD}
            className="mt-4 h-11 w-full rounded-xl border border-border-strong bg-surface-2 px-3.5 font-mono text-sm tracking-[0.12em] text-fg outline-none focus:border-danger focus:ring-2 focus:ring-[color-mix(in_oklab,var(--c-danger)_25%,transparent)]"
          />
          <div className="mt-6 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setResetOpen(false);
                setTyped('');
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" disabled={!confirmed(typed)}>
              Her şeyi sil
            </Button>
          </div>
        </form>
      </Dialog>
    </SettingsSection>
  );
}
