# Rusteach — Architecture & team contract

Rusteach is a desktop app (Electron + React 19 + Vite 8 + TypeScript 7 + Tailwind CSS v4) that teaches
Rust from zero to expert in Turkish. Content lives in `content/` (see `CONTENT_SPEC.md`) and is compiled
into `src/generated/content.json` by `scripts/build-content.mjs`.

## Commands

| command | what |
|---|---|
| `node scripts/build-content.mjs [--with-examples]` | build the content bundle (`--with-examples` adds the demo module m00 from `content/_examples`, handy for UI work while real modules are being written) |
| `npx tsc --noEmit -p tsconfig.json` | typecheck the renderer |
| `npx vite build` | production renderer build → `dist/` |
| `npx vite --port 5173` | browser dev server (runner falls back to the Rust Playground through the `/playground` proxy) |
| `npm run dev` | Vite + Electron together |
| `npm run dist` | Windows installer via electron-builder |

**Never run `npm install`** (other agents work in the same folder at the same time — concurrent installs
corrupt `node_modules`). Everything needed is installed: react 19, react-router-dom 7, zustand 5,
framer-motion, lucide-react, clsx, @uiw/react-codemirror + @codemirror/lang-rust/view/state/language +
@lezer/highlight, canvas-confetti, recharts, @dnd-kit/core + sortable + utilities, ts-fsrs,
@fontsource-variable/inter + jetbrains-mono, electron, electron-builder, sharp, png-to-ico.
If you believe a package is truly missing, say so in your final report instead of installing it.

## Shared contracts (do not break; extend compatibly)

| file | contract |
|---|---|
| `src/types/content.ts` | JSON shape of lessons/blocks (mirrors the parser in `scripts/lib/lesson-parser.mjs`) |
| `src/types/bridge.ts` | `window.rusteach` API exposed by Electron's preload (`run`, `toolchain`, `openExternal`, `saveTextFile`, `openTextFile`, `setTitleBarTheme`) |
| `src/lib/runner.ts` | `runRust(req)`, `wrapTests`, `parseTestOutput`, `normalizeOutput`, `errorCodes`… |
| `src/lib/content.ts` | content lookup helpers (`modules`, `getLesson`, `findBlock`, `moduleLessons`, …) |
| `src/store/progress.ts` | the persisted progress store + derived selectors (`moduleStatus`, `lessonStatus`, `dueReviews`, `nextLessonId`, …) and XP constants |
| `src/store/ui.ts` | `toast()`, `xpToast()` |
| `src/lib/srs.ts` | FSRS scheduling helpers |
| `src/lib/xp.ts` | `levelInfo(xp)` |
| `src/lib/sound.ts`, `src/lib/celebrate.ts` | `play('correct'|…)`, `celebrateSmall/Big()` |
| `src/components/blocks/types.ts` | `BlockProps` / `BlockOutcome` — how block components talk to pages |
| `src/components/ui/Button.tsx`, `primitives.tsx` | `Button`, `Card`, `ProgressBar`, `ProgressRing`, `Badge`, `Kbd` |
| `src/components/Ferris.tsx` | mascot `<Ferris mood size />` |
| `src/App.tsx` | route table (see comment at the top) |

If you need a new store action or field, add it to `src/store/progress.ts` **additively** (new optional
fields, new actions) and mention it in your report. Never rename/remove existing ones.

## File ownership (parallel agents — only edit files you own)

| owner | files |
|---|---|
| **electron** | `electron/**`, `build/**` (icons), `scripts/make-icon.mjs`, `package.json` (`build` section + scripts only), `README.md` |
| **shell** | `src/components/layout/**`, `src/components/ui/**` (may restyle Button/primitives keeping the API), `src/components/Ferris.tsx`, `src/components/shell/**`, `src/pages/{Dashboard,MapPage,ModulePage,ProfilePage,GlossaryPage,SettingsPage}.tsx`, `src/lib/achievements.ts`, `src/lib/sound.ts`, `src/lib/celebrate.ts`, `src/index.css` (tokens may be extended, not renamed), `src/App.tsx` (only for shell-related wrappers) |
| **lesson** | `src/pages/{LessonPage,PlaygroundPage}.tsx`, `src/components/blocks/**`, `src/components/lesson/**`, `src/components/editor/**`, `src/styles/lesson.css` (imported from `LessonPage` or `BlockRenderer`) |
| **learn** | `src/pages/{ReviewPage,PracticePage,StatsPage}.tsx`, `src/components/review/**`, `src/components/stats/**`, `src/lib/practice.ts`, `src/lib/stats.ts`, `src/lib/srs.ts` |
| shared (additive only) | `src/store/progress.ts`, `src/store/ui.ts`, `src/types/*`, `src/lib/content.ts`, `src/lib/runner.ts` |

## Visual direction (all UI agents)

"A warm forge at night": deep ink-navy surfaces, Rust-orange ember accents (`--c-accent`), subtle radial
glows and gradient meshes behind hero areas, rounded-2xl cards with 1px borders, generous spacing,
confident typography (Inter, semibold headings with tight tracking; JetBrains Mono for code). Playful like
Duolingo, polished like Linear/Raycast. Ferris the crab appears as a friendly guide (empty states, lesson
intro/outro, celebrations) — never in the way. Motion via framer-motion: spring page transitions, button
press feedback, animated progress, "+XP" bursts, confetti for big wins; everything respects
`settings.reducedMotion`. Full light-theme parity (use the semantic tokens, never hard-coded grays).
Accessible: keyboard operable, visible focus rings, aria labels, WCAG AA contrast. All UI copy in Turkish.

Electron window: frameless title bar with Windows overlay controls on the right (≈ 140px wide, 40px tall).
The top bar must be a `.drag-region` with interactive children marked `.no-drag`, and leave ~140px free on
the right when `window.rusteach` exists. The lesson page (focus mode, outside the shell) needs the same.

## Learning-science features (why the app is shaped like this)

* **Chunking & cognitive load** — lessons are split into H2 steps shown one at a time.
* **Retrieval practice & testing effect** — checks in every step; *Devam* is gated until answered.
* **Pretesting / prediction** — predict/compiles blocks before explanations.
* **Immediate, elaborated feedback** — explanations and per-option feedback after each answer.
* **Metacognition / calibration** — optional confidence rating (1 tahmin, 2 biraz emin, 3 çok emin); low
  confidence or wrong answers enter spaced repetition; hypercorrection of confident errors.
* **Spaced repetition (FSRS)** — flashcards + missed checks scheduled in `/tekrar`.
* **Interleaving** — reviews and `/antrenman` mix modules; bosses include earlier-module items.
* **Generation effect** — coding exercises with real compiler feedback; hints are progressive.
* **Mastery learning** — module boss ≥ 80 % unlocks the next module; skip tests for experienced learners.
* **Dual coding** — memory diagrams, analogies, visual journey map.
* **Self-explanation** — reflect blocks + personal notes per lesson.
* **Distributed practice & habit** — daily goal, streaks with freezes, short sessions.
