// Shape of src/generated/content.json (produced by scripts/build-content.mjs).
// Every *Html / html field is trusted, pre-rendered HTML (markdown -> HTML, Shiki-highlighted code).

export interface Tier {
  id: string;
  title: string;
  subtitle: string;
  color: string; // hex
  emoji: string;
}

export interface Module {
  id: string; // "m04"
  dir: string;
  order: number; // 0-based position in the curriculum
  number: number; // 1-based, shown to learners ("Modül 4")
  tier: string; // tier id
  color: string; // tier color
  title: string;
  subtitle: string;
  icon: string; // emoji
  description: string; // html
  lessonIds: string[]; // regular + project lessons in order
  bossId: string | null; // "m04-boss"
  summaryHtml: string; // cheat sheet html ("Özet Kartı")
}

export type LessonType = 'lesson' | 'project' | 'boss';

export interface LessonStats {
  checks: number;
  exercises: number;
  flashcards: number;
  runnable: number;
  reflect: number;
  analogy: number;
  memory: number;
}

export interface Lesson {
  id: string; // "m04-l03" | "m04-boss"
  moduleId: string;
  index: number;
  title: string;
  minutes: number;
  type: LessonType;
  objectives: string[]; // inline html
  keywords: string[];
  steps: Step[];
  stats: LessonStats;
  file: string;
}

export interface Step {
  title: string; // raw markdown ("" for the intro step)
  titleHtml: string;
  blocks: Block[];
}

export type CodeMode = 'run' | 'norun' | 'compile_fail' | 'should_panic' | 'ignore';

export interface MdBlock {
  type: 'md';
  html: string;
}

export interface CodeBlock {
  type: 'code';
  id: string;
  lang: 'rust';
  code: string; // full source incl. hidden lines -> what gets compiled
  display: string; // what the learner sees
  mode: CodeMode;
  isLib: boolean; // no fn main -> "Derle" instead of "Çalıştır"
  title?: string;
  errorCode?: string; // for compile_fail, e.g. "E0382"
  crates: string[]; // external crates used (tokio, serde...)
  line: number;
}

export interface QuizBlock {
  type: 'quiz';
  id: string;
  question: string; // html
  options: string[]; // inline html
  answer: number[]; // correct indices
  multi: boolean;
  explanation: string; // html
  feedback?: string[]; // inline html per option
  line: number;
}

export interface PredictBlock {
  type: 'predict';
  id: string;
  question: string; // html
  code: string;
  display: string;
  options?: string[]; // exact outputs (plain text)
  answer?: number;
  output?: string; // when free-text
  explanation: string;
  crates: string[];
  line: number;
}

export interface CompilesBlock {
  type: 'compiles';
  id: string;
  question: string; // html
  code: string;
  display: string;
  answer: boolean;
  error?: string; // E0382
  explanation: string;
  crates: string[];
  line: number;
}

export interface FillBlock {
  type: 'fill';
  id: string;
  prompt: string; // html
  code: string; // contains ___0, ___1 ...
  blanks: string[][]; // accepted answers per blank (first = canonical)
  output?: string;
  explanation: string;
  crates: string[];
  line: number;
}

export interface ParsonsLine {
  text: string;
  indent: number; // in 4-space units
}

export interface ParsonsBlock {
  type: 'parsons';
  id: string;
  prompt: string; // html
  lines: ParsonsLine[]; // correct order
  distractors: ParsonsLine[];
  explanation: string; // html (may be "")
  verify: boolean;
  source: string;
  line: number;
}

export interface RegexRule {
  pattern: string;
  message: string;
}

export interface ExerciseBlock {
  type: 'exercise';
  id: string;
  title: string;
  difficulty: number; // 1..5
  prompt: string; // html
  starter: string;
  solution: string;
  check: 'tests' | 'output' | 'run';
  tests?: string;
  expectedOutput?: string;
  hints: string[]; // html, progressive
  forbid: RegexRule[];
  require: RegexRule[];
  explanation: string; // html, shown after success
  starterCompiles: boolean;
  crates: string[];
  line: number;
}

export interface Flashcard {
  id: string;
  front: string; // html
  back: string; // html
}

export interface FlashcardsBlock {
  type: 'flashcards';
  id: string;
  cards: Flashcard[];
  line: number;
}

export interface MemoryVar {
  name: string;
  value: string;
  type?: string;
  to?: string; // heap id or another var name
  moved: boolean;
  mut: boolean;
  note?: string; // inline html
}

export interface MemoryFrame {
  frame: string;
  vars: MemoryVar[];
}

export interface MemoryHeapItem {
  id: string;
  value: string;
  label?: string;
  freed: boolean;
  to?: string;
}

export interface MemoryStep {
  caption: string; // inline html
  stack: MemoryFrame[];
  heap: MemoryHeapItem[];
}

export interface MemoryBlock {
  type: 'memory';
  id: string;
  title: string; // inline html
  steps: MemoryStep[];
  line: number;
}

export interface ReflectBlock {
  type: 'reflect';
  id: string;
  prompt: string; // html
  answer: string; // html (model answer)
  line: number;
}

export type Block =
  | MdBlock
  | CodeBlock
  | QuizBlock
  | PredictBlock
  | CompilesBlock
  | FillBlock
  | ParsonsBlock
  | ExerciseBlock
  | FlashcardsBlock
  | MemoryBlock
  | ReflectBlock;

/** Blocks that produce a correct/incorrect result. */
export type CheckBlock = QuizBlock | PredictBlock | CompilesBlock | FillBlock | ParsonsBlock;
export type ScoredBlock = CheckBlock | ExerciseBlock;

export const CHECK_TYPES = ['quiz', 'predict', 'compiles', 'fill', 'parsons'] as const;

export interface GlossaryEntry {
  tr: string;
  en: string;
  def: string; // html
  module?: string;
}

export interface ErrorEntry {
  code: string; // E0382
  title: string;
  explanation: string; // html
  bad: string; // rust code that triggers the error
  fix: string; // fixed code
  fixExplanation: string; // html
  module?: string;
}

export interface ContentBundle {
  version: number;
  generatedAt: string;
  counts: Record<string, number>;
  tiers: Tier[];
  modules: Module[];
  lessons: Record<string, Lesson>;
  reference: { glossary: GlossaryEntry[]; errors: ErrorEntry[] };
}
