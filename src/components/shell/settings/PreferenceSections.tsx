// Settings: appearance (theme, motion, text sizes), sound, and learning preferences.
import { useState } from 'react';
import { BookOpenText, Flame, Monitor, Moon, Palette, Sun, TriangleAlert, Unlock, Volume2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Switch } from '../../ui/Switch';
import { Dialog } from '../../ui/Dialog';
import CodeView from '../../editor/CodeView';
import { useProgress, type Settings } from '../../../store/progress';
import { play } from '../../../lib/sound';
import { fmtNum } from '../turkish';
import { RangeControl, SettingRow, SettingsSection } from './SettingRow';
import '../../../styles/lesson.css';

const set = (patch: Partial<Settings>) => useProgress.getState().updateSettings(patch);

const PREVIEW_CODE = `fn main() {
    let ad = String::from("Ferris");
    println!("Merhaba, {ad}!");
}`;

export function AppearanceSection() {
  const st = useProgress((s) => s.settings);
  return (
    <SettingsSection id="gorunum" title="Görünüm" description="Tema, hareket ve yazı boyutları" icon={<Palette className="size-[18px]" />}>
      <SettingRow
        title="Tema"
        description="Sistem seçeneği Windows’un açık / koyu ayarını izler."
        control={({ labelId }) => (
          <Segmented<Settings['theme']>
            labelledBy={labelId}
            value={st.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'dark', label: 'Koyu', icon: <Moon className="size-3.5" /> },
              { value: 'light', label: 'Açık', icon: <Sun className="size-3.5" /> },
              { value: 'system', label: 'Sistem', icon: <Monitor className="size-3.5" /> },
            ]}
          />
        )}
      />
      <SettingRow
        title="Hareketi azalt"
        description="Sayfa geçişlerini, konfetiyi ve süslü animasyonları kapatır."
        control={({ labelId, descId }) => (
          <Switch checked={st.reducedMotion} onChange={(reducedMotion) => set({ reducedMotion })} labelledBy={labelId} describedBy={descId} />
        )}
      />
      <SettingRow
        title="Ders metni boyutu"
        description="Ders, özet kartı ve sözlük metinlerinin büyüklüğü."
        control={({ labelId }) => (
          <RangeControl
            labelledBy={labelId}
            value={st.contentScale}
            min={0.9}
            max={1.25}
            step={0.05}
            onChange={(contentScale) => set({ contentScale: Math.round(contentScale * 100) / 100 })}
            format={(v) => `%${Math.round(v * 100)}`}
          />
        )}
      >
        <div className="mt-3 rounded-2xl border border-border bg-surface-2 px-5 py-4">
          <div className="lesson-prose">
            <p>
              Rust’ta her değerin tek bir <strong>sahibi</strong> vardır. Sahip kapsam dışına çıktığında değer otomatik olarak
              bırakılır.
            </p>
          </div>
        </div>
      </SettingRow>
      <SettingRow
        title="Kod yazı boyutu"
        description="Kod düzenleyicisi ve kod örneklerindeki yazı büyüklüğü."
        control={({ labelId }) => (
          <RangeControl
            labelledBy={labelId}
            value={st.editorFontSize}
            min={12}
            max={20}
            step={1}
            onChange={(editorFontSize) => set({ editorFontSize })}
            format={(v) => `${v} px`}
          />
        )}
      >
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--code-border)]">
          <CodeView code={PREVIEW_CODE} ariaLabel="Kod yazı boyutu önizlemesi" />
        </div>
      </SettingRow>
    </SettingsSection>
  );
}

export function SoundSection() {
  const sound = useProgress((s) => s.settings.sound);
  return (
    <SettingsSection id="ses" title="Ses" icon={<Volume2 className="size-[18px]" />}>
      <SettingRow
        title="Ses efektleri"
        description="Doğru cevap, seviye atlama ve başarım sesleri. Kısa ve yumuşak tutuldu."
        control={({ labelId, descId }) => (
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" disabled={!sound} onClick={() => play('correct')}>
              Dinle
            </Button>
            <Switch checked={sound} onChange={(v) => set({ sound: v })} labelledBy={labelId} describedBy={descId} />
          </div>
        )}
      />
    </SettingsSection>
  );
}

const GOALS = [
  { value: 50, label: 'Rahat', hint: 'Günde yaklaşık 10 dakika' },
  { value: 100, label: 'Düzenli', hint: 'Günde yaklaşık 20 dakika' },
  { value: 200, label: 'Ciddi', hint: 'Günde 40 dakika ve üzeri' },
];

export function LearningSection() {
  const st = useProgress((s) => s.settings);
  const [freeAsk, setFreeAsk] = useState(false);
  const goalHint = GOALS.find((g) => g.value === st.dailyGoalXp)?.hint;

  return (
    <SettingsSection id="ogrenme" title="Öğrenme" description="Hedefin ve derslerin işleyişi" icon={<BookOpenText className="size-[18px]" />}>
      <SettingRow
        title="Günlük hedef"
        description={
          <>
            {goalHint ? `${goalHint}. ` : ''}Hedefe ulaştığın her gün serin uzar ve +25 XP bonus alırsın. Kısa ama her gün
            çalışmak, haftada bir uzun oturumdan daha kalıcıdır.
          </>
        }
        control={({ labelId }) => (
          <Segmented<number>
            labelledBy={labelId}
            value={st.dailyGoalXp}
            onChange={(dailyGoalXp) => set({ dailyGoalXp })}
            options={GOALS.map((g) => ({
              value: g.value,
              hint: g.hint,
              label: (
                <span className="inline-flex items-baseline gap-1">
                  {g.label}
                  <span className="text-[11px] font-medium tabular-nums text-subtle">{g.value}</span>
                </span>
              ),
            }))}
          />
        )}
      />
      <SettingRow
        title="Günlük yeni kart"
        description="Tekrar oturumlarına her gün en fazla kaç yeni kart girsin. Az tutmak birikmeyi önler."
        control={({ labelId }) => (
          <RangeControl
            labelledBy={labelId}
            value={st.newCardsPerDay}
            min={5}
            max={60}
            step={5}
            onChange={(newCardsPerDay) => set({ newCardsPerDay })}
            format={(v) => fmtNum(v)}
          />
        )}
      />
      <SettingRow
        title="“Ne kadar emindin?” sorusu"
        description="Cevaptan sonra ne kadar emin olduğunu sorar. Tahminle bildiğin sorular tekrara eklenir; emin olup yanıldıkların en kalıcı dersi verir."
        control={({ labelId, descId }) => (
          <Switch checked={st.showConfidence} onChange={(showConfidence) => set({ showConfidence })} labelledBy={labelId} describedBy={descId} />
        )}
      />
      <SettingRow
        title="Serbest mod"
        description="Bütün modüllerin ve derslerin kilidini açar. Sıradan bağımsız gezinmek istersen."
        control={({ labelId, descId }) => (
          <Switch
            checked={st.freeMode}
            onChange={(v) => (v ? setFreeAsk(true) : set({ freeMode: false }))}
            labelledBy={labelId}
            describedBy={descId}
          />
        )}
      >
        {st.freeMode && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] leading-5 text-fg">
            <Unlock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            Serbest mod açık: bütün dersler açık. Modül sınavları ve ustalık rozetleri yine de geçerli.
          </p>
        )}
      </SettingRow>

      <Dialog open={freeAsk} onClose={() => setFreeAsk(false)} labelledBy="free-title" describedBy="free-desc">
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning" aria-hidden>
            <TriangleAlert className="size-5" />
          </span>
          <h2 id="free-title" className="mt-4 pr-8 text-[19px] font-semibold tracking-[-0.02em] text-fg">
            Serbest mod açılsın mı?
          </h2>
          <div id="free-desc" className="mt-2 space-y-2 text-sm leading-6 text-muted">
            <p>
              Rusteach ustalık öğrenmesine dayanır: her modül bir öncekinin üstüne kurulur ve sınavdan %80 almadan
              ilerlememek, boşlukların birikmesini önler.
            </p>
            <p>
              Atlanan temeller Rust’ta genellikle sonradan sahiplik ve ödünç alma hataları olarak geri döner. Konuyu zaten
              biliyorsan <span className="font-semibold text-fg">atlama sınavları</span> daha iyi bir yoldur.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setFreeAsk(false)}>
              Vazgeç
            </Button>
            <Button
              variant="secondary"
              icon={<Flame className="size-4" />}
              onClick={() => {
                set({ freeMode: true });
                setFreeAsk(false);
              }}
            >
              Yine de aç
            </Button>
          </div>
        </div>
      </Dialog>
    </SettingsSection>
  );
}

