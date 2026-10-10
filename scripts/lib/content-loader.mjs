// Loads curriculum.yaml + every module folder and parses all lessons.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { parseLesson } from './lesson-parser.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT = path.join(ROOT, 'content');

export function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

/**
 * @param {object} opts
 * @param {object} opts.md markdown-it instance (from createMarkdown)
 * @param {string[]} [opts.only] module ids (m04) or numbers (04 / 4) to restrict to
 */
export function loadContent({ md, only, withExamples = false } = {}) {
  const problems = []; // {file, line, level:'error'|'warning', message}
  const curriculum = readYaml(path.join(CONTENT, 'curriculum.yaml'));
  if (withExamples) {
    // Demo module for UI development (content/_examples), shown before module 1.
    curriculum.modules = [{ id: 'm00', dir: '../_examples', tier: 't1', title: 'Örnek Modül' }, ...curriculum.modules];
    if (only?.length) only = [...only, 'm00'];
  }
  const wanted = only?.length
    ? new Set(only.map((o) => (/^m\d+$/i.test(o) ? o.toLowerCase() : `m${String(o).padStart(2, '0')}`)))
    : null;

  const tiers = curriculum.tiers;
  const modules = [];
  const lessons = {};

  curriculum.modules.forEach((cm, order) => {
    if (wanted && !wanted.has(cm.id)) return;
    const dir = path.join(CONTENT, 'modules', cm.dir);
    const modFile = path.join(dir, 'module.yaml');
    if (!fs.existsSync(modFile)) {
      problems.push({ file: rel(modFile), line: 1, level: 'warning', message: `modül henüz yazılmamış (${cm.id})` });
      return;
    }
    let meta;
    try {
      meta = readYaml(modFile) || {};
    } catch (e) {
      problems.push({ file: rel(modFile), line: 1, level: 'error', message: `module.yaml YAML hatası: ${e.message}` });
      return;
    }
    if (meta.id && meta.id !== cm.id)
      problems.push({ file: rel(modFile), line: 1, level: 'error', message: `id '${meta.id}' curriculum'daki '${cm.id}' ile uyuşmuyor` });
    const tier = tiers.find((t) => t.id === cm.tier);

    const lessonIds = [];
    const files = Array.isArray(meta.lessons) ? meta.lessons : [];
    if (!files.length) problems.push({ file: rel(modFile), line: 1, level: 'error', message: 'lessons listesi boş' });

    const parseFile = (name, kind) => {
      const f = path.join(dir, name);
      if (!fs.existsSync(f)) {
        problems.push({ file: rel(modFile), line: 1, level: 'error', message: `dosya bulunamadı: ${name}` });
        return null;
      }
      const { lesson, errors, warnings } = parseLesson(fs.readFileSync(f, 'utf8'), { file: rel(f), md, kind });
      for (const e of errors) problems.push({ file: rel(f), line: e.line, level: 'error', message: e.message });
      for (const w of warnings) problems.push({ file: rel(f), line: w.line, level: 'warning', message: w.message });
      return lesson;
    };

    files.forEach((name, idx) => {
      const lesson = parseFile(name, 'lesson');
      if (!lesson) return;
      const expected = `${cm.id}-l${String(idx + 1).padStart(2, '0')}`;
      if (lesson.id !== expected)
        problems.push({ file: lesson.file, line: 1, level: 'error', message: `id '${lesson.id}' olmalı: '${expected}'` });
      lesson.id = expected;
      if (lessons[lesson.id])
        problems.push({ file: lesson.file, line: 1, level: 'error', message: `tekrarlanan ders id: ${lesson.id}` });
      lesson.moduleId = cm.id;
      lesson.index = idx;
      lessons[lesson.id] = lesson;
      lessonIds.push(lesson.id);
    });

    let bossId = null;
    if (meta.boss) {
      const boss = parseFile(meta.boss, 'boss');
      if (boss) {
        boss.id = `${cm.id}-boss`;
        boss.type = 'boss';
        boss.moduleId = cm.id;
        boss.index = files.length;
        lessons[boss.id] = boss;
        bossId = boss.id;
      }
    } else problems.push({ file: rel(modFile), line: 1, level: 'warning', message: 'boss tanımlı değil' });

    let summary = null;
    if (meta.summary) {
      summary = parseFile(meta.summary, 'summary');
    } else problems.push({ file: rel(modFile), line: 1, level: 'warning', message: 'summary tanımlı değil' });

    modules.push({
      id: cm.id,
      dir: cm.dir,
      order,
      number: order + 1,
      tier: cm.tier,
      color: tier?.color ?? '#F97316',
      title: String(meta.title ?? cm.title),
      subtitle: String(meta.subtitle ?? ''),
      icon: String(meta.icon ?? '🦀'),
      description: md.render(String(meta.description ?? '')),
      lessonIds,
      bossId,
      summaryHtml: summary?.html ?? '',
      summaryFile: summary?.file,
      summaryStaticRust: summary?.staticRust ?? [],
    });
  });

  // ---------------- reference material
  const reference = { glossary: [], errors: [] };
  const gFile = path.join(CONTENT, 'reference', 'glossary.yaml');
  if (fs.existsSync(gFile)) {
    try {
      const g = readYaml(gFile) || [];
      reference.glossary = g.map((e, i) => {
        if (!e?.tr || !e?.en || !e?.def)
          problems.push({ file: rel(gFile), line: 1, level: 'error', message: `glossary[${i}] tr/en/def eksik` });
        return {
          tr: String(e?.tr ?? ''), en: String(e?.en ?? ''), def: md.render(String(e?.def ?? '')),
          module: e?.module ? String(e.module) : undefined,
        };
      });
    } catch (e) {
      problems.push({ file: rel(gFile), line: 1, level: 'error', message: `YAML hatası: ${e.message}` });
    }
  }
  const eFile = path.join(CONTENT, 'reference', 'errors.yaml');
  if (fs.existsSync(eFile)) {
    try {
      const list = readYaml(eFile) || [];
      reference.errors = list.map((e, i) => {
        if (!e?.code || !e?.title || !e?.explanation || !e?.bad || !e?.fix)
          problems.push({ file: rel(eFile), line: 1, level: 'error', message: `errors[${i}] code/title/explanation/bad/fix eksik` });
        return {
          code: String(e?.code ?? ''), title: String(e?.title ?? ''),
          explanation: md.render(String(e?.explanation ?? '')),
          bad: String(e?.bad ?? '').replace(/\s+$/, ''), fix: String(e?.fix ?? '').replace(/\s+$/, ''),
          fixExplanation: e?.fix_explanation ? md.render(String(e.fix_explanation)) : '',
          module: e?.module ? String(e.module) : undefined,
        };
      });
    } catch (e) {
      problems.push({ file: rel(eFile), line: 1, level: 'error', message: `YAML hatası: ${e.message}` });
    }
  }

  return { tiers, modules, lessons, reference, problems };
}

export function printProblems(problems, { showWarnings = true } = {}) {
  const errs = problems.filter((p) => p.level === 'error');
  const warns = problems.filter((p) => p.level === 'warning');
  for (const p of errs) console.log(`  ✗ HATA   ${p.file}:${p.line}  ${p.message}`);
  if (showWarnings) for (const p of warns) console.log(`  ⚠ uyarı  ${p.file}:${p.line}  ${p.message}`);
  return { errors: errs.length, warnings: warns.length };
}
