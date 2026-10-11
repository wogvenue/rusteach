// "Neden karışık sırayla?" - a tiny dual-coded explanation of interleaving.
import { Shuffle } from 'lucide-react';

const BLOCKED = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
const MIXED = [0, 1, 2, 1, 0, 2, 0, 1, 2, 0, 2, 1];

function Row({ label, order, colors }: { label: string; order: number[]; colors: string[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[72px] shrink-0 text-xs font-medium text-muted">{label}</span>
      <div className="flex gap-1">
        {order.map((c, i) => (
          <span key={i} className="size-3.5 rounded-[4px]" style={{ background: colors[c % colors.length] }} />
        ))}
      </div>
    </div>
  );
}

export default function InterleaveNote({ colors }: { colors: string[] }) {
  const palette = colors.length >= 3 ? colors : ['#22C55E', '#F97316', '#0EA5E9'];
  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="interleave-title">
      <div className="flex items-center gap-2">
        <Shuffle className="size-4 text-accent" aria-hidden />
        <h2 id="interleave-title" className="text-sm font-semibold text-fg">
          Neden karışık sırayla?
        </h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Kartları modüller ve dersler arasında karıştırıyoruz. Böylece beynin her soruda önce “bu hangi konu?” diye
        düşünüp doğru bilgiyi seçmek zorunda kalıyor. İlk başta biraz daha zor gelir, ama bilgiyi gerçek hayatta
        bulup kullanma becerini belirgin biçimde güçlendirir.
      </p>
      <div className="mt-4 space-y-2" aria-hidden>
        <Row label="Bloklu" order={BLOCKED} colors={palette} />
        <Row label="Karışık" order={MIXED} colors={palette} />
      </div>
    </section>
  );
}
