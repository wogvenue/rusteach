// "Rust Yolculuğu Sertifikası": a paper-like document that keeps its own light palette in both
// themes and scales with its container width (cqw units), so the same markup is used on screen
// and on an A4 landscape page.
import { createPortal } from 'react-dom';
import Ferris from '../Ferris';
import { fmtDate, fmtNum, genitive } from './turkish';

export interface CertificateData {
  name: string;
  date: string; // ISO
  modules: number;
  lessons: number;
  exercises: number;
  hours: number;
  serial: string;
}

const INK = '#1f1a17';
const SOFT = '#6b625a';
const EMBER = '#c2410c';
const GOLD = '#b7791f';
const PAPER = '#fffaf2';

function CertificateBody({ data }: { data: CertificateData }) {
  const name = data.name.trim() || 'Rustacean';
  const cq = (n: number) => `${n}cqw`;
  return (
    <div className="w-full [container-type:inline-size]">
      <div
        className="relative aspect-[297/210] w-full overflow-hidden"
        style={{ background: PAPER, color: INK, fontFamily: 'var(--font-sans)', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
        {/* paper texture glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 60% at 50% 0%, rgb(247 76 0 / 0.07), transparent 70%), radial-gradient(60% 50% at 50% 110%, rgb(183 121 31 / 0.08), transparent 70%)`,
          }}
        />
        {/* frame */}
        <div className="absolute" style={{ inset: cq(2.2), border: `${cq(0.32)} solid ${EMBER}`, borderRadius: cq(0.6) }} />
        <div className="absolute" style={{ inset: cq(3.1), border: `${cq(0.1)} solid ${GOLD}`, borderRadius: cq(0.4), opacity: 0.7 }} />

        <div className="relative flex h-full flex-col items-center text-center" style={{ padding: `${cq(6)} ${cq(9)} ${cq(5)}` }}>
          <div className="flex items-center" style={{ gap: cq(0.8), fontSize: cq(1.5), fontWeight: 700, letterSpacing: '-0.02em' }}>
            <span style={{ color: EMBER }}>Rusteach</span>
          </div>
          <h2 style={{ marginTop: cq(2.4), fontFamily: 'Georgia, "Times New Roman", serif', fontSize: cq(4.1), fontWeight: 400, lineHeight: 1.1 }}>
            Rust Yolculuğu Sertifikası
          </h2>
          <p style={{ marginTop: cq(2.6), fontSize: cq(1.45), color: SOFT }}>Bu sertifika</p>
          <p
            style={{
              marginTop: cq(0.8),
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: cq(5.4),
              lineHeight: 1.15,
              color: INK,
              maxWidth: '90%',
              overflowWrap: 'anywhere',
            }}
          >
            {name}
          </p>
          <div style={{ marginTop: cq(1.2), width: cq(34), height: cq(0.12), background: GOLD, opacity: 0.6 }} />
          <p style={{ marginTop: cq(1.8), maxWidth: cq(62), fontSize: cq(1.5), lineHeight: 1.6, color: '#3d3530' }}>
            {genitive(name)} Rusteach’teki {fmtNum(data.modules)} modülün tamamını modül sınavlarıyla geçerek Rust
            programlama dilinde sıfırdan uzmanlığa uzanan yolculuğu bitirdiğini belgeler.
          </p>

          <dl className="flex" style={{ marginTop: cq(2.6), gap: cq(4.5) }}>
            {[
              [fmtNum(data.modules), 'modül'],
              [fmtNum(data.lessons), 'ders'],
              [fmtNum(data.exercises), 'alıştırma'],
              [fmtNum(data.hours), 'saat çalışma'],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col items-center">
                <dt className="order-2" style={{ fontSize: cq(1.15), color: SOFT, marginTop: cq(0.3) }}>
                  {l}
                </dt>
                <dd className="order-1" style={{ margin: 0, fontSize: cq(2.5), fontWeight: 650, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex w-full items-end justify-between">
            <div className="text-left" style={{ fontSize: cq(1.2), color: SOFT }}>
              <div style={{ fontSize: cq(1.45), color: INK, fontWeight: 600 }}>{fmtDate(data.date)}</div>
              <div style={{ marginTop: cq(0.3) }}>Tamamlanma tarihi</div>
            </div>
            <div className="flex flex-col items-center">
              <div
                className="grid place-items-center rounded-full"
                style={{
                  width: cq(10.5),
                  height: cq(10.5),
                  background: `radial-gradient(circle at 35% 30%, #fde9b8, #f3c45c 55%, ${GOLD})`,
                  boxShadow: `0 0 0 ${cq(0.35)} ${PAPER}, 0 0 0 ${cq(0.55)} ${GOLD}`,
                }}
              >
                <div style={{ width: cq(7.6) }}>
                  <Ferris size={64} mood="celebrate" animate={false} className="h-auto w-full" />
                </div>
              </div>
            </div>
            <div className="text-right" style={{ fontSize: cq(1.2), color: SOFT }}>
              <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: cq(2), color: INK }}>Ferris</div>
              <div style={{ marginTop: cq(0.2) }}>Rusteach rehberi</div>
              <div style={{ marginTop: cq(0.5), fontSize: cq(0.95), fontFamily: 'var(--font-mono)', opacity: 0.8 }}>No. {data.serial}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * On-screen certificate. With `printable`, a print-only copy is also rendered directly under
 * <body>; mount at most one printable certificate at a time.
 */
export default function Certificate({
  data,
  className,
  printable = false,
}: {
  data: CertificateData;
  className?: string;
  printable?: boolean;
}) {
  return (
    <>
      <div className={className}>
        <CertificateBody data={data} />
      </div>
      {printable &&
        createPortal(
          <div className="print-area">
            <CertificateBody data={data} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** Deterministic, human-friendly serial derived from the learner's start date. */
export function certificateSerial(createdAt: string, name: string): string {
  let h = 2166136261;
  for (const ch of `${createdAt}|${name}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const n = (h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
  return `RT-${n.slice(0, 3)}-${n.slice(3)}`;
}
