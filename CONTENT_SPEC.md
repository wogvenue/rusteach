# Rusteach Content Specification (authoring contract)

This document is the contract between **content authors** (lesson writers) and the **app**
(lesson player, verifier, build script). Everything a learner sees comes from files under
`content/`. The build script `scripts/build-content.mjs` turns them into
`src/generated/content.json`; the verifier `scripts/verify-rust.mjs` compiles and runs
**every** piece of Rust code so nothing broken ever reaches a learner.

Audience: Turkish-speaking absolute beginners who should finish as confident, expert Rust
developers. **All learner-facing text is Turkish.** Code identifiers may be Turkish or English
(see style rules), Rust keywords/std names are of course English.

---

## 1. Directory layout

```
content/
  curriculum.yaml                  # tiers + module order + per-lesson outline (the plan)
  modules/
    04-sahiplik/                   # NN-slug, NN = module number (01..26)
      module.yaml                  # module metadata + lesson order
      01-bellek-stack-heap.md      # lessons, in order
      02-sahiplik-kurallari.md
      ...
      boss.md                      # mastery test (type: boss)
      summary.md                   # cheat sheet ("Özet Kartı"), plain markdown
  reference/
    glossary.yaml                  # Turkish/English term dictionary
    errors.yaml                    # compiler error guide (E0382 ...)
```

### module.yaml

```yaml
id: m04                    # m + two-digit number
title: Sahiplik
subtitle: Rust'ın kalbi — belleği güvenle yönetmek
icon: "🦀"                 # one emoji
description: |
  2-4 sentence Turkish description of what the learner will be able to do.
lessons:                   # file names in teaching order (boss and summary NOT listed here)
  - 01-bellek-stack-heap.md
  - 02-sahiplik-kurallari.md
boss: boss.md
summary: summary.md
```

(The tier, color and order of a module come from `curriculum.yaml`, not from module.yaml.)

---

## 2. Lesson file format

A lesson is Markdown with YAML front matter. **`## ` (H2) headings split the lesson into
steps** — the player shows one step at a time ("chunking"); the learner presses *Devam* to
reveal the next one, and cannot continue until every check in the step is answered.
Content before the first H2 is the lesson intro (keep it short: a hook + why this matters).

```markdown
---
id: m04-l03                # m<module>-l<lesson>, boss = m04-boss
title: Taşıma (Move) Semantiği
minutes: 12                # realistic estimate
type: lesson               # lesson | project | boss
objectives:                # 2-4 measurable "...-abilmek" objectives
  - Bir değerin ne zaman taşındığını (move) söyleyebilmek
  - E0382 hatasını okuyup düzeltebilmek
keywords: [move, sahiplik, E0382]
---

Short intro paragraph(s)...

## Birinci adım başlığı

Text, code, checks...

## İkinci adım başlığı
...
```

Recommended lesson size: **4-7 steps**, 10-15 minutes. Every step should end with — or contain —
at least one active element (check, exercise, run-it code). Avoid walls of text: a step is
roughly 150-400 words of prose plus code/checks.

### 2.1 Regular Markdown

Standard CommonMark + tables. Use `inline code` for identifiers. Bold sparingly for key terms.
Non-Rust code fences (`toml`, `sh`, `text`, `console`) are rendered as static highlighted code.

### 2.2 Callouts (`:::` containers)

```markdown
:::tip Başlık (optional)
Body markdown.
:::
```

Kinds:
| kind      | use for |
|-----------|---------|
| `tip`     | practical advice, shortcuts |
| `info`    | background facts |
| `warning` | pitfalls, common mistakes |
| `error`   | showing a real compiler error message and how to read it |
| `analogy` | an everyday-life analogy (elaboration / dual coding) — **use at least one per lesson where a concept is new** |
| `ferris`  | the mascot Ferris (a crab) speaking directly, friendly/encouraging, 1-3 sentences |
| `deep`    | optional deep dive, collapsed by default ("Derinlemesine") — for curious learners |
| `remember`| a key rule to memorize, boxed ("Unutma!") |

Callouts may contain markdown and **plain** code fences (static only). Interactive blocks
(quiz, exercise, ...) must NOT be placed inside callouts.

### 2.3 Rust code blocks

````markdown
```rust
fn main() {
    println!("Merhaba!");
}
```
````

The info string controls behaviour (comma separated flags, like rustdoc):

| info string            | meaning | verifier expectation |
|------------------------|---------|----------------------|
| `rust`                 | runnable example; learner can press **Çalıştır** and edit it | compiles and runs with exit code 0 |
| `rust,norun`           | complete program that must not be run in the app (infinite loop, reads stdin, opens a server, reads files, uses `std::env::args`) | compiles |
| `rust,compile_fail`    | intentionally broken code (shown with a red "Derlenmez" badge) — the point is the error | **fails** to compile. Add `E0382`-style code to the info string to assert the exact error: `rust,compile_fail,E0382` |
| `rust,should_panic`    | compiles, panics at runtime (shown with a "Panik!" badge) | compiles, exits non-zero with `panicked` |
| `rust,ignore`          | fragment that cannot compile on its own (e.g. a Cargo-project file layout, pseudo code). **Use sparingly** — prefer hidden lines | not checked |
| `rust,title=src/lib.rs`| optional title shown above the block (can combine with other flags) | — |

A block **without `fn main`** is compiled as a library (no Run button, a *Derle* button instead).

**Hidden lines (strongly encouraged):** like rustdoc, a line starting with `# ` (hash + space)
or consisting only of `#` is hidden from the learner but included when compiling/running.
Use them to make short snippets verifiable:

````markdown
```rust
# fn main() {
let x = 5;
let y = x + 1;
println!("{y}");
# }
```
````

Code style: `rustfmt` style, 4 spaces, edition **2024**, no warnings when possible
(prefix intentionally unused variables with `_` or use them). Output with `println!` so
"Çalıştır" shows something meaningful. Keep runnable programs fast (< 1 s), deterministic,
no stdin, no files, no network. External crates available online:
`rand, serde, serde_json, tokio, regex, itertools, anyhow, thiserror, rayon, chrono, futures`
(use only in modules that teach them).

### 2.4 Interactive blocks

Interactive blocks are fenced code blocks whose language is one of the names below and whose
body is **YAML**. Use YAML block scalars (`|`) for any code or multi-line markdown. Strings that
contain `: ` or start with special characters (`*`, `&`, `!`, `[`, `{`, `` ` ``, `'`, `"`, `#`, `%`, `@`, `|`, `>`) must be quoted or written as block scalars — when in doubt, use `|`.
If a block's YAML contains a line with three backticks, use a four-backtick outer fence.

All markdown fields (question, explanation, prompt, hints, options...) accept markdown incl. `inline code`.
IDs are generated automatically from position (`<lessonId>-<type>-<n>`); you may set `id:` explicitly
for exercises if you want a stable name.

#### `quiz` — multiple choice (retrieval practice)

````markdown
```quiz
question: |
  `let s2 = s1;` satırından sonra `s1` için ne söylenebilir?
options:
  - "`s1` hâlâ kullanılabilir"
  - "`s1` artık geçersizdir; değer `s2`'ye taşındı"
  - "`s1` ve `s2` aynı belleği paylaşır, ikisi de kullanılabilir"
answer: 1                        # 0-based index; for multi-select use a list: [0, 2]
explanation: |
  `String` `Copy` değildir; atama **sahipliği taşır**...
feedback:                        # optional, one entry per option: why that option is wrong/right
  - "`String` heap'te veri tutar ve `Copy` değildir."
  - "Doğru!"
  - "Bu, iki kez serbest bırakma (double free) hatasına yol açardı."
```
````

Write plausible distractors based on **real misconceptions**. 3-4 options. Explanations must teach,
not just confirm.

#### `predict` — "Bu kod ne yazdırır?" (predict-then-run, desirable difficulty)

````markdown
```predict
question: Bu program ne yazdırır?      # optional, default "Bu kod ne yazdırır?"
code: |
  fn main() {
      let x = 5;
      let x = x * 2;
      { let x = x + 1; println!("{x}"); }
      println!("{x}");
  }
options:                              # exact expected stdout per option
  - |
    11
    10
  - |
    11
    11
  - |
    6
    5
answer: 0
explanation: |
  Gölgeleme (shadowing) ...
```
````

Without `options`, the learner types the output; then give `output: |` with the exact stdout.
The verifier RUNS the code and checks stdout equals the correct option / `output` (trailing
whitespace trimmed). Code supports hidden `# ` lines.

#### `compiles` — "Derlenir mi?" (borrow-checker intuition)

````markdown
```compiles
code: |
  fn main() {
      let mut v = vec![1, 2, 3];
      let first = &v[0];
      v.push(4);
      println!("{first}");
  }
answer: false                # true = compiles
error: E0502                 # optional (only when answer is false): expected error code
explanation: |
  `first` değişmez bir ödünç alma; `push` ise değişebilir ödünç ister...
```
````

#### `fill` — fill in the blanks

````markdown
```fill
prompt: Boşlukları doldurarak `s`'yi fonksiyona ödünç ver.
code: |
  fn uzunluk(s: ___0) -> usize {
      s.len()
  }
  fn main() {
      let s = String::from("merhaba");
      let n = uzunluk(___1);
      println!("{s} {n}");
  }
blanks:
  - ["&String", "&str"]        # accepted answers for ___0 (first one is canonical)
  - ["&s"]                     # ___1
explanation: |
  ...
```
````

Blanks are written `___0`, `___1`, ... Answers compare after trimming and removing spaces.
The verifier substitutes the **first** answer of each blank and requires the program to run (or compile, for libs).

#### `parsons` — put the lines in order

````markdown
```parsons
prompt: Satırları doğru sıraya koyarak 1'den 5'e kadar sayıların toplamını yazdıran programı kur.
lines: |                       # correct order, with indentation
  fn main() {
      let mut toplam = 0;
      for i in 1..=5 {
          toplam += i;
      }
      println!("{toplam}");
  }
distractors: |                 # optional wrong lines mixed in
      for i in 1..5 {
      let toplam = 0;
explanation: ...
```
````

Indentation is applied automatically; the learner orders lines. Verifier runs the correct order.
Keep it to 4-10 lines.

#### `exercise` — write code (generation effect, the core of mastery)

````markdown
```exercise
id: m04-e-tasima            # optional stable id
title: Sahipliği geri ver
difficulty: 2                # 1 (warm-up) .. 5 (challenge)
prompt: |
  `uzunluk_hesapla` fonksiyonu bir `String` alıyor ve onu tüketiyor. Fonksiyonu,
  string'in **sahipliğini geri verecek** şekilde değiştir...
starter: |
  fn uzunluk_hesapla(s: String) -> (String, usize) {
      todo!()
  }

  fn main() {
      let s = String::from("rust");
      let (s, n) = uzunluk_hesapla(s);
      println!("{s}: {n}");
  }
solution: |
  fn uzunluk_hesapla(s: String) -> (String, usize) {
      let n = s.len();
      (s, n)
  }

  fn main() {
      let s = String::from("rust");
      let (s, n) = uzunluk_hesapla(s);
      println!("{s}: {n}");
  }
check: tests                 # tests | output | run
tests: |
  #[test]
  fn uzunlugu_dogru() {
      let (s, n) = uzunluk_hesapla(String::from("merhaba"));
      assert_eq!(n, 7);
      assert_eq!(s, "merhaba");
  }
hints:                        # 2-3 progressive hints, from gentle to almost-solution
  - Bir fonksiyon birden fazla değeri tuple ile döndürebilir.
  - Önce `s.len()` ile uzunluğu bir değişkene al, sonra `(s, n)` döndür.
forbid:                       # optional: regexes the learner's code must NOT match
  - pattern: "\\.clone\\(\\)"
    message: Bu alıştırmada `clone` kullanmadan çöz!
require:                      # optional: regexes the code MUST match
  - pattern: "\\(s, *n\\)|\\(s,n\\)"
    message: Tuple döndürmelisin.
explanation: |               # shown after success: why the solution works, alternatives
  ...
```
````

Check modes:
- `tests` — the app appends `#[cfg(test)] mod rusteach_tests { use super::*; <tests> }` to the
  learner code and runs `cargo test`. Tests should have **Turkish snake_case names** describing behaviour
  and assertion messages helpful to beginners: `assert_eq!(n, 7, "\"merhaba\" 7 harflidir");`
  Test `pub`/private functions freely (same crate). 2-5 tests including edge cases.
- `output` — runs the program; stdout (trimmed) must equal `expected_output: |`.
- `run` — the program must compile and run with exit code 0 (use for "fix the compile error" tasks;
  combine with `forbid`/`require` to prevent trivial cheats).

Rules: `starter` must compile (use `todo!()`/`unimplemented!()` for missing bodies) **unless**
the exercise is "fix this compile error" (then set `starter_compiles: false`).
The starter must NOT already pass the check. The verifier checks: solution passes; starter does
not pass; solution satisfies forbid/require.
Exercises must only use concepts already taught (see "allowed concepts" in curriculum.yaml).

#### `flashcards` — spaced repetition deck (added to the learner's SRS on lesson completion)

````markdown
```flashcards
- front: "`Copy` trait'i olan tiplere 3 örnek ver."
  back: "`i32`, `bool`, `char` (ve tamamı `Copy` olan tuple'lar, `&T`)"
- front: E0382 hatası ne anlama gelir?
  back: Taşınmış (moved) bir değer kullanılmaya çalışılıyor.
```
````

Each lesson: **4-8 cards**, one atomic fact per card (minimum information principle),
question on the front phrased to force recall (not recognition). Mix: definitions, "why",
code-reading (`front` may contain a short code fence via `|`), error codes. Put the
flashcards block in the LAST step of the lesson (usually a "Özet" step).

#### `memory` — stack/heap diagram (dual coding), optionally animated in steps

````markdown
```memory
title: let s2 = s1; sonrası
steps:
  - caption: "`s1` oluşturuldu: işaretçi, uzunluk ve kapasite stack'te; karakterler heap'te."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr | len=5 | cap=5", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: Taşıma sonrası `s1` geçersiz (gri), `s2` aynı heap verisine işaret ediyor.
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr | len=5 | cap=5", moved: true }
          - { name: s2, type: String, value: "ptr | len=5 | cap=5", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
```
````

var fields: `name, value, type?, to? (heap id or another var name for references), moved?, mut?, note?`.
heap fields: `id, value, label?, freed?`. Use these generously in ownership/borrowing/smart pointer lessons.

#### `reflect` — self-explanation / elaborative interrogation

````markdown
```reflect
prompt: Kendi cümlelerinle açıkla — Rust neden aynı anda iki `&mut` referansa izin vermez?
answer: |
  Model cevap: Veri yarışlarını (data race) derleme zamanında engellemek için...
```
````

The learner writes an answer, then sees the model answer and self-rates. Use 1 per lesson.

---

## 3. Boss file (`boss.md`, `type: boss`)

The module mastery test. Pass threshold **80%**. Structure: a short intro, then 3-4 steps
(H2) containing **10-14 scored items** (quiz / predict / compiles / fill / parsons) and
**2-3 exercises** of increasing difficulty, covering ALL lessons of the module and **interleaving**
2-3 items from earlier modules (spiral review). No new teaching in a boss; explanations still
required. No flashcards in a boss.

## 4. summary.md — "Özet Kartı" (cheat sheet)

Plain markdown (no interactive blocks, static code allowed using ```rust,ignore or plain ```rust —
code is compile-checked unless `ignore`): the module's key rules, syntax, common errors and fixes,
in a compact scannable format (tables, short bullets, tiny code). ~1-2 screens.

## 5. Pedagogy rules (non-negotiable)

1. **Concept order**: only use concepts already taught (see `allowed` in curriculum.yaml). If a
   preview is unavoidable (e.g. `.unwrap()` before error handling), name it and say where it is
   explained ("Bunu Modül 10'da detaylı göreceğiz").
2. **Every lesson has**: ≥1 `analogy` callout (when introducing a concept), ≥3 checks
   (`quiz`/`predict`/`compiles`/`fill`/`parsons`) spread across steps, ≥1 `exercise`
   (conceptual-only lessons may replace it with extra checks), 1 `reflect`, 4-8 flashcards,
   ≥2 runnable `rust` examples.
3. **Worked example → faded → independent**: show a full example, then a fill/parsons on a
   similar problem, then an exercise.
4. **Prediction before explanation** for surprising behaviour (predict/compiles first, explain after).
5. **Errors are teachers**: show real compiler errors (in `error` callouts with ```text blocks) and
   teach reading them; Rust's error messages are a feature.
6. **Retrieval of earlier material**: from module 3 on, each lesson includes at least one check
   that requires an earlier module's concept (interleaving/spiral).
7. Concrete before abstract; use familiar Turkish examples (öğrenci notları, kütüphane, banka hesabı,
   market sepeti, oyun karakteri, hava durumu...).
8. Explanations of WHY, not just WHAT. Compare with other languages (C/C++, Python, Java, JS) briefly
   when it clarifies the motivation.

## 6. Turkish style

- Warm, clear, second person singular ("sen"), encouraging but not childish. Short sentences.
- Correct Turkish characters (ç ğ ı İ ö ş ü) everywhere. Suffixes after code/English terms use an
  apostrophe: `String`'in, `Vec`'e, `match`'te, borrow checker'ın.
- Introduce each technical term as **Türkçe (English)** the first time, e.g. **sahiplik (ownership)**,
  **ödünç alma (borrowing)**, **yaşam süresi (lifetime)**, **özellik/trait** (keep "trait"),
  **closure** (keep), **iterator** (keep), **crate** (keep), **makro (macro)**. After that, use the
  term the Rust community in Turkey commonly uses; keep English for words with no good Turkish equivalent.
- Identifiers in examples: Turkish names are welcome (`ogrenci`, `toplam`, `hesapla`) but must be ASCII
  (no ç/ş/ğ/ı/ö/ü in identifiers — Rust allows Unicode identifiers but it hurts typing). String
  literals can contain Turkish characters freely.
- Numbers/format: use `println!("{x}")` inline-args style (modern Rust) mostly.
