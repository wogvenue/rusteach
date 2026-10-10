// Achievements grid on the profile: filter (all / unlocked / locked), grouped by category.
import { useMemo, useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import AchievementTile from '../AchievementTile';
import { ACHIEVEMENTS, CATEGORY_LABEL, type AchievementCategory } from '../../../lib/achievements';
import type { ProgressData } from '../../../store/progress';
import { fmtNum } from '../turkish';

type Filter = 'all' | 'open' | 'locked';

const ORDER: AchievementCategory[] = ['yol', 'kod', 'sinav', 'bolge', 'aliskanlik', 'hafiza', 'ustbilis', 'gizli'];

export default function AchievementsSection({ s }: { s: ProgressData }) {
  const [filter, setFilter] = useState<Filter>('all');
  const unlocked = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;

  const groups = useMemo(() => {
    return ORDER.map((cat) => {
      const items = ACHIEVEMENTS.filter((a) => a.category === cat)
        .filter((a) => (filter === 'open' ? !!s.achievements[a.id] : filter === 'locked' ? !s.achievements[a.id] : true))
        .sort((a, b) => Number(!!s.achievements[b.id]) - Number(!!s.achievements[a.id]));
      return { cat, items };
    }).filter((g) => g.items.length > 0);
  }, [s, filter]);

  return (
    <section aria-labelledby="ach-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ach-title" className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
            Başarımlar
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {fmtNum(ACHIEVEMENTS.length)} başarımın <span className="font-semibold text-fg">{fmtNum(unlocked)}</span> tanesini açtın.
          </p>
        </div>
        <Segmented<Filter>
          size="sm"
          label="Başarımları süz"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'open', label: 'Açılanlar' },
            { value: 'locked', label: 'Kilitliler' },
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-muted">
          {filter === 'open'
            ? 'Henüz açılmış başarım yok. İlk dersini bitirdiğinde ilki gelir.'
            : 'Bütün başarımları açtın. Gerçek bir Rustacean!'}
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <div key={g.cat}>
              <h3 className="mb-2.5 text-[13px] font-semibold text-muted">
                {CATEGORY_LABEL[g.cat]}
                <span className="ml-1.5 font-medium tabular-nums text-subtle">
                  {ACHIEVEMENTS.filter((a) => a.category === g.cat && s.achievements[a.id]).length}/
                  {ACHIEVEMENTS.filter((a) => a.category === g.cat).length}
                </span>
              </h3>
              <ul className="grid gap-2.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
                {g.items.map((a) => (
                  <li key={a.id}>
                    <AchievementTile def={a} unlockedAt={s.achievements[a.id]} state={s} className="h-full" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
