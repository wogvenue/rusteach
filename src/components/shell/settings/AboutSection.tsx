// Settings: about Rusteach — version, content size, credits and licenses.
import { ExternalLink, Info } from 'lucide-react';
import Ferris from '../../Ferris';
import { totals } from '../../../lib/content';
import { fmtNum } from '../turkish';
import { openExternal } from '../toolchain';
import { SettingsSection } from './SettingRow';

function ExtLink({ href, children }: { href: string; children: string }) {
  return (
    <button
      type="button"
      onClick={() => openExternal(href)}
      className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </button>
  );
}

export default function AboutSection() {
  const version = window.rusteach?.appVersion;
  return (
    <SettingsSection id="hakkinda" title="Hakkında" icon={<Info className="size-[18px]" />}>
      <div className="flex flex-wrap items-center gap-5 py-5">
        <Ferris size={76} mood="wave" />
        <div className="min-w-0 flex-1">
          <p className="text-[19px] font-semibold tracking-[-0.02em] text-fg">Rusteach</p>
          <p className="text-[13px] text-muted">
            {version ? `Sürüm ${version}` : 'Tarayıcı sürümü'}. {fmtNum(totals.modules)} modül, {fmtNum(totals.lessons)} ders,{' '}
            {fmtNum(totals.exercises)} alıştırma, {fmtNum(totals.flashcards)} kart.
          </p>
          <p className="mt-2 max-w-[62ch] text-[13px] leading-5 text-muted">
            Rust’ı sıfırdan uzmanlığa, Türkçe ve öğrenme biliminin yöntemleriyle öğreten bir masaüstü uygulaması: kısa adımlar,
            geri getirme pratiği, aralıklı tekrar ve gerçek derleyiciyle alıştırmalar.
          </p>
        </div>
      </div>
      <ul className="space-y-2.5 py-4 text-[13px] leading-5 text-muted">
        <li>
          <span className="font-semibold text-fg">Ferris</span> maskotu Karen Rustad Tölva’nın eseridir ve kamu malıdır (CC0).{' '}
          <ExtLink href="https://rustacean.net">rustacean.net</ExtLink>
        </li>
        <li>
          Müfredat, <span className="font-semibold text-fg">The Rust Programming Language</span> kitabından esinlenir (MIT /
          Apache-2.0).{' '}
          <ExtLink href="https://doc.rust-lang.org/book/">Kitabı aç</ExtLink>
        </li>
        <li>
          Çevrimiçi kod çalıştırma Rust Playground ile yapılır.{' '}
          <ExtLink href="https://play.rust-lang.org">play.rust-lang.org</ExtLink>
        </li>
        <li>Rust ve Cargo, Rust Foundation’ın ticari markalarıdır; Rusteach bağımsız bir eğitim projesidir.</li>
      </ul>
    </SettingsSection>
  );
}
