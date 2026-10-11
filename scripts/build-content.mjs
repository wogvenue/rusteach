#!/usr/bin/env node
// Builds src/generated/content.json from content/ (Markdown + YAML).
//
//   node scripts/build-content.mjs                 # validate everything + write bundle
//   node scripts/build-content.mjs --only m04,m05  # validate just these modules (no write)
//   node scripts/build-content.mjs --no-warnings   # hide pedagogy warnings
//   node scripts/build-content.mjs --with-examples # also include content/_examples as demo module m00 (UI dev)
//
// Exit code 1 when there are errors (warnings never fail the build).
import fs from 'node:fs';
import path from 'node:path';
import { createHighlighter } from 'shiki';
import { createMarkdown, SHIKI_LANGS } from './lib/lesson-parser.mjs';
import { loadContent, printProblems, ROOT } from './lib/content-loader.mjs';

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] || '').split(',').filter(Boolean)
  : null;
const showWarnings = !args.includes('--no-warnings');
const write = !only || args.includes('--write');

const t0 = Date.now();
const highlighter = await createHighlighter({ themes: ['one-dark-pro', 'one-light'], langs: SHIKI_LANGS });
const md = createMarkdown(highlighter);
const withExamples = args.includes('--with-examples');
const { tiers, modules, lessons, reference, problems } = loadContent({ md, only, withExamples });

for (const l of Object.values(lessons)) delete l.staticRust;
for (const m of modules) delete m.summaryStaticRust;

const counts = {
  modules: modules.length,
  lessons: Object.values(lessons).filter((l) => l.type !== 'boss').length,
  bosses: Object.values(lessons).filter((l) => l.type === 'boss').length,
  exercises: Object.values(lessons).reduce((a, l) => a + l.stats.exercises, 0),
  checks: Object.values(lessons).reduce((a, l) => a + l.stats.checks, 0),
  flashcards: Object.values(lessons).reduce((a, l) => a + l.stats.flashcards, 0),
  glossary: reference.glossary.length,
  errors: reference.errors.length,
};

console.log(`\nRusteach içerik derleyici, ${only ? 'sadece ' + only.join(', ') : 'tüm modüller'}`);
const { errors, warnings } = printProblems(problems, { showWarnings });

if (write) {
  const out = path.join(ROOT, 'src', 'generated', 'content.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const bundle = { version: 1, generatedAt: new Date().toISOString(), counts, tiers, modules, lessons, reference };
  fs.writeFileSync(out, JSON.stringify(bundle));
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`\n→ src/generated/content.json yazıldı (${kb} KB)`);
}
console.log(
  `\n${counts.modules} modül · ${counts.lessons} ders · ${counts.bosses} boss · ${counts.exercises} alıştırma · ` +
    `${counts.checks} soru · ${counts.flashcards} kart · ${counts.glossary} terim · ${counts.errors} hata kodu`,
);
console.log(`${errors} hata, ${warnings} uyarı (${Date.now() - t0} ms)\n`);
process.exit(errors ? 1 : 0);
