# Özet Kartı — Cargo ve Ekosistem

## Profiller (`[profile.*]`)

Yalnızca **değiştirdiğin** ayarları yaz; profiller yalnızca **kök** `Cargo.toml`'dan okunur.

| Ayar | `dev` | `release` | Not |
|---|---|---|---|
| `opt-level` | `0` | `3` | `1`, `2`; boyut için `"s"` / `"z"` (tırnaklı!) |
| `debug` | tam | yok | profil aracı için release'te `debug = true` |
| `debug-assertions` | açık | kapalı | `debug_assert!` ve `cfg!(debug_assertions)` buna bağlı |
| `overflow-checks` | açık → **panik** | kapalı → **başa sarar** | taşabilecek yerde `checked_*` / `wrapping_*` / `saturating_*` |
| `lto` | `false` | `false` | `"thin"` hızlı kazanç, `true`/`"fat"` en güçlüsü ama yavaş |
| `codegen-units` | `256` | `16` | `1` = en iyi optimizasyon, en yavaş derleme |
| `panic` | `"unwind"` | `"unwind"` | `"abort"`: daha küçük binary, geri sarma ve `drop` yok |
| `strip` | `"none"` | `"debuginfo"` (debug kapalıyken) | `true` = `"symbols"`: sembolleri de at |

```toml
[profile.dev.package."*"]   # yalnızca bağımlılıkları optimize et
opt-level = 3

[profile.dagitim]           # özel profil → cargo build --profile dagitim → target/dagitim/
inherits = "release"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

Hızı **release'te** ve **tekrarlayarak** ölç; boyutu dosyaya bakarak ölç (`cargo bloat` ayrıntı verir).

## crates.io'ya yayın

- Belgeler: `//!` crate girişi, `///` her genel öğe, `# Examples` (doc test olarak çalışır), `#![deny(missing_docs)]`.
- Vitrin: iç modül düzenini `pub use` ile genel API'den ayır; yolun her halkası görünür olmalı (yoksa `E0603`).
- Zorunlu meta veri: `description` + `license` (ya da `license-file`). Önerilen: `repository`, `readme`, `keywords` (≤ 5), `categories`, `rust-version`.

```console
$ cargo login                      # crates.io API anahtarı (bir kez)
$ cargo package --list             # pakete hangi dosyalar girecek?
$ cargo publish --dry-run          # her şeyi yap, yükleme hariç
$ cargo publish                    # KALICI: sürüm numarası asla yeniden kullanılmaz
$ cargo yank kahve-kasa@0.2.0      # yeni çözümlemelerde seçilmez; silinmez, kilitliler çalışır
```

| Değişiklik | `1.4.2` → | `0.3.7` → |
|---|---|---|
| Hata düzeltmesi | `1.4.3` | `0.3.8` |
| Geriye uyumlu yenilik (yeni `pub fn`) | `1.5.0` | `0.3.8` |
| Kırıcı (silme, imza değişikliği, tüm alanları `pub` struct'a alan, enum'a varyant) | `2.0.0` | `0.4.0` |

Önlemler: `#[non_exhaustive]` (yeni alan/varyant küçük sürümde eklenebilsin), `#[deprecated(since = "..", note = "..")]` (eski adı bir büyük sürüm boyunca koru).

## Workspace'ler

```toml
# kök Cargo.toml (sanal manifest)
[workspace]
members = ["kahve-cekirdek", "kahve-cli", "kahve-web"]
resolver = "3"

[workspace.package]
version = "0.4.0"
edition = "2024"

[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
```

```toml
# kahve-web/Cargo.toml
[package]
name = "kahve-web"
version.workspace = true
edition.workspace = true

[dependencies]
kahve-cekirdek = { path = "../kahve-cekirdek", version = "0.4.0" }
serde = { workspace = true }
```

- Paylaşılan: tek `Cargo.lock`, tek `target/`, kökteki profiller. `[workspace.dependencies]` bir **katalogdur**, otomatik eklemez.
- Komutlar: `-p uye` tek üye · `--workspace` hepsi · `default-members` bayraksız komutların hedefi.
- `cargo tree`: `-i ad` kim kullanıyor · `-d` kopya sürümler · `-e features` · `(*)` = daha önce gösterildi.
- `cargo update [-p ad] [--precise x.y.z]`: yalnızca `Cargo.lock`'u, `Cargo.toml`'un izin verdiği aralıkta günceller.

## Features ve koşullu derleme

```toml
[features]
default = ["renkli"]
renkli = []
json = ["dep:serde_json"]          # isteğe bağlı bağımlılığı açar
tam = ["renkli", "json"]

[dependencies]
serde_json = { version = "1", optional = true }
kahve-cekirdek = { version = "0.4", default-features = false, features = ["json"] }
```

| | `#[cfg(k)]` | `cfg!(k)` |
|---|---|---|
| Koşul yanlışsa | öğe **silinir**, tip denetimi bile yok | `false` üretir, iki dal da derlenir |
| Ne için | var olmayan şeyi kullanan kod (platform, özellik) | iki dalın da her yerde derlendiği kararlar |

- Koşullar: `test`, `debug_assertions`, `windows` / `unix`, `target_os = "linux"`, `feature = "json"`, `not(..)`, `all(..)`, `any(..)`.
- Komutlar: `--features json` (`-F`), `--no-default-features`, `--all-features`.
- Özellikler tüm ağaçta **birleştirilir** → yalnızca yetenek ekle (additive); çelişkiyi `compile_error!` ile yakala.

```rust
#![allow(unexpected_cfgs)] // tek dosyada özellikler tanımlı olmadığı için

#[cfg(all(feature = "tek-thread", feature = "cok-thread"))]
compile_error!("`tek-thread` ve `cok-thread` birlikte açılamaz");

#[cfg_attr(feature = "json", derive(Clone))] // koşullu öznitelik
#[derive(Debug)]
struct Siparis {
    adet: u32,
}

fn main() {
    let siparis = Siparis { adet: 2 };
    println!("{} adet: {siparis:?}", siparis.adet);
    println!("renkli mi? {}", cfg!(feature = "renkli"));
}
```

## Araç zinciri

| Konu | Hatırla |
|---|---|
| `cargo install ad --locked` | binary'yi `~/.cargo/bin`'e kurar; `PATH`'teki `cargo-xyz` → `cargo xyz` |
| Eklentiler | `nextest` (hızlı test), `audit` (güvenlik açığı), `expand` (makro açılımı), `watch` / `bacon`, `edit` (`cargo upgrade`), `semver-checks`, `bloat` |
| `rustfmt.toml` | az ayar (`max_width`, `style_edition`...); CI'da `cargo fmt --check`; `#[rustfmt::skip]` |
| Lint seviyesi | `allow` < `expect` < `warn` < `deny` < `forbid` · `#[..]` bir öğe, `#![..]` tüm kapsam · en yakın kazanır |
| `forbid` | içeride `allow` / `expect` / `warn` → **E0453**; `deny` kabul edilir ama `forbid` kalır |
| `#[expect(lint, reason = "...")]` | lint tetiklenmezse `unfulfilled_lint_expectations` uyarısı |
| `#[must_use = "..."]` | sonucu yok saymak uyarı; `Result` zaten `must_use`, `Option` değil |
| `[lints]` | `[lints.rust]` / `[lints.clippy]`, grup için `priority = -1`; workspace'te `[workspace.lints]` |
| CI | `cargo clippy -- -D warnings` (kaynağa `#![deny(warnings)]` yazma) |

```rust
#![forbid(unsafe_code)]

#[must_use = "indirimli fiyatı kullanmazsan indirim boşa gider"]
fn indirim_uygula(fiyat: u32, yuzde: u32) -> u32 {
    fiyat * (100 - yuzde) / 100
}

#[expect(dead_code, reason = "kampanya modülü gelecek sürümde kullanacak")]
fn kampanya_orani() -> u32 {
    15
}

fn main() {
    let fiyat = indirim_uygula(20000, 15);
    println!("{fiyat}");
}
```

## Edition'lar ve sürümler

| Edition | Rust | Öne çıkan |
|---|---|---|
| 2015 | 1.0 | ilk sürüm |
| 2018 | 1.31 | `async` / `await` / `dyn`, `crate::` yolları |
| 2021 | 1.56 | closure'lar alanları ayrı yakalar, dizilerde `into_iter()` değerle, `resolver = "2"` |
| 2024 | 1.85 | `gen` ayrıldı (`r#gen`), `resolver = "3"`, yeni rustfmt stili |

- Edition **crate başınadır**; her derleyici hepsini destekler; farklı edition'lı crate'ler birlikte çalışır.
- Geçiş: eski edition'dayken `cargo fix --edition` → `edition = "2024"` → `cargo build` + `cargo test`.
- MSRV: `rust-version = "1.88"` (eski derleyiciye net hata; `resolver = "3"` uyumlu sürümleri tercih eder). Edition 2024 zaten en az 1.85 ister. Dene: `cargo +1.88.0 check`.
- `rust-toolchain.toml` → `[toolchain]` altında `channel = "1.85.0"`, `components = ["rustfmt", "clippy"]`.
- Araç zinciri önceliği: `+sürüm` > `RUSTUP_TOOLCHAIN` > `rustup override` > `rust-toolchain.toml` > varsayılan.

## Sık hatalar

| Belirti | Sebep | Çözüm |
|---|---|---|
| Testte panik, release'te yanlış sayı | `overflow-checks` profile bağlı | `checked_*` / `wrapping_*` / `saturating_*` |
| Üyedeki `[profile.release]` etkisiz | profiller yalnızca kökten okunur | kök `Cargo.toml`'a taşı |
| `E0425` + "found an item that was configured out" | `#[cfg(feature = ..)]` öğe bu derlemede yok | çağıranı da `cfg`'le ya da özelliği aç |
| `E0603 module ... is private` (`pub use`) | yolun bir halkası gizli | modülü `pub` yap |
| `E0453 ... incompatible with previous forbid` | `forbid` altında gevşetme | kodu düzelt ya da `forbid` yerine `deny` kullan |
| `unexpected cfg condition value` | `Cargo.toml`'da tanımsız özellik adı | `[features]`'a ekle ya da yazımı düzelt |
| ``expected identifier, found reserved keyword `gen` `` | edition 2024 | `r#gen` ya da yeniden adlandır |
| `cargo publish` meta veri yüzünden reddediyor | `description` / `license` yok | `Cargo.toml`'a ekle |
