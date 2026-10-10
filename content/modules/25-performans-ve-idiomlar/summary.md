# Özet Kartı: Performans ve İdiomatik Rust

## 1. Ölç, sonra optimize et

- **Tahmin etme, ölç.** Amdahl: kazanç, optimize edilen kısmın toplam süredeki **payıyla** sınırlı
  (100 s'nin 20 s'sini 10× hızlandır → 82 s).
- Sıra: **algoritma/veri yapısı** (O(n²) → O(n)) → gereksiz iş ve tahsisler → sabit çarpanlar.
- Yalnızca **`--release`** (ya da `cargo bench`) ile ölç; debug'da inlining yok, taşma kontrolleri var.
- "Ne kadar?" → benchmark (`Instant` + `black_box`, ciddi iş için **criterion**). "Nerede?" → profilci
  (`perf`, `cargo flamegraph`, samply). Flamegraph'ta **genişlik** = süre payı.

```rust
use std::hint::black_box;
use std::time::Instant;

fn main() {
    let veri: Vec<u64> = (1..=10_000).collect();
    let basla = Instant::now();
    let mut toplam = 0;
    for _ in 0..100 {
        toplam = black_box(black_box(&veri).iter().sum::<u64>()); // işi silinmekten koru
    }
    let _sure = basla.elapsed(); // tek ölçüme güvenme: ısınma + çok tekrar + medyan
    println!("{toplam}");
}
```

- Iterator'lar, generic'ler, newtype'lar **sıfır maliyetli**; `#[inline]` crate sınırı içindir, ölçmeden serpiştirme.

## 2. Bellek tahsisini azaltmak

| Teknik | Ne zaman? |
|---|---|
| `Vec::with_capacity(n)` / `String::with_capacity(n)` / `reserve(n)` | boyutu (yaklaşık) biliyorsan; **kapasite ≠ uzunluk** |
| `buf.clear()` + yeniden kullan | döngüde tampon: uzunluk 0, kapasite korunur; `write!` için `std::fmt::Write` |
| `&str` / `&[T]` parametre | sadece okuyorsan (`&String`, `&Vec<T>` alma → clippy `ptr_arg`) |
| `Cow<'_, str>` | çoğu girdi değişmeden dönüyorsa: `Borrowed` (tahsis yok) / `Owned` |
| `Rc::clone` / `Arc::clone` | büyük veriyi paylaşmak: sayaç artar, veri kopyalanmaz |
| `Box<str>` / `Box<[T]>` | büyümeyecek veri: 24 yerine 16 bayt |

```rust
use std::borrow::Cow;

fn kacisla(s: &str) -> Cow<'_, str> {
    if s.contains('<') {
        Cow::Owned(s.replace('<', "&lt;")) // yalnızca gerekince tahsis
    } else {
        Cow::Borrowed(s)
    }
}

fn main() {
    println!("{} {}", kacisla("merhaba"), kacisla("a<b"));
}
```

## 3. İdiomatik API tasarımı (Rust API Guidelines)

| Önek | Maliyet | Sahiplik | Örnek |
|---|---|---|---|
| `as_` | bedava | `&self` → ödünç | `as_str`, `as_bytes` |
| `to_` | pahalı (tahsis) | `&self` → sahipli | `to_string`, `to_lowercase` |
| `into_` | genelde ucuz | `self` (tüketir) → sahipli | `into_bytes`, `into_inner` |

- Getter'da `get_` yok: `ad()`, `ad_mut()`. Koleksiyonlarda `iter()`, `iter_mut()`, `IntoIterator` (`&T`, `&mut T`, `T`).
- Parametre: okuyacaksan `impl AsRef<str>`, **saklayacaksan `impl Into<String>`**, dizi için `impl IntoIterator<Item = T>`.
- Ortak trait'leri baştan uygula (`Debug`, `Clone`, `PartialEq`, `Default`, `Display`...): orphan rule yüzünden kullanıcı ekleyemez. `Into` değil **`From`** uygula.
- Çok seçenek → **builder**; atılması hata olan değerlere `#[must_use = "..."]` (yalnızca **uyarı** üretir).

## 4. Ölçeklenebilir hata yönetimi

```rust
use anyhow::{Context, Result, ensure};
use thiserror::Error;

#[derive(Debug, Error)]
enum SepetHatasi {
    #[error("geçersiz adet")] // kaynak mesajda DEĞİL, source()'ta
    Adet(#[from] std::num::ParseIntError),
    #[error("{0} stokta yok")]
    Stok(String),
}

fn adet_oku(s: &str) -> Result<u32, SepetHatasi> {
    Ok(s.trim().parse()?) // #[from] → ? otomatik dönüştürür
}

fn main() -> Result<()> {
    let n = adet_oku("3").context("sepet güncellenemedi")?;
    ensure!(n > 0, "adet sıfır olamaz");
    println!("{n} {}", SepetHatasi::Stok("elma".into()));
    Ok(())
}
```

| | Kütüphane → **thiserror** | Uygulama → **anyhow** |
|---|---|---|
| İhtiyaç | hatayı **ayırt etmek** (`match`) | **bağlam** ekleyip göstermek |
| Tip | kendi `enum`'un (public API) | `anyhow::Error` / `anyhow::Result<T>` |
| Araçlar | `#[error("..{alan}..")]`, `#[from]`, `#[source]`, `#[error(transparent)]` | `.context()`, `.with_context(...)`, `bail!`, `ensure!`, `downcast_ref` |

- Altın kural: kaynağı **ya** `Display` mesajına koy **ya** `source()`'tan döndür, ikisini birden asla.
- `anyhow::Error` biçimleri: `{}` en dış mesaj · `{:#}` tüm zincir tek satır (`a: b: c`) · `{:?}` `Caused by:` listesi.
- `with_context(|| format!(..))`: closure yalnızca hata olunca çalışır. Kütüphane API'sinde `anyhow` döndürme.

## 5. Kod kalitesi: clippy, rustfmt, CI

| Clippy grubu | Varsayılan |
|---|---|
| `correctness` | **deny** (derlemeyi durdurur) |
| `suspicious`, `style`, `complexity`, `perf` | warn |
| `pedantic`, `nursery`, `cargo` | allow (pedantic'i açmak yaygın) |
| `restriction` | allow — topluca açma, tek tek seç |

| Lint | Kötü | İdiomatik |
|---|---|---|
| `needless_return` | `return x;` (son satır) | `x` |
| `len_zero` | `v.len() == 0` | `v.is_empty()` |
| `ptr_arg` | `&Vec<T>`, `&String` | `&[T]`, `&str` |
| `collapsible_if` | `if a { if b { .. } }` | `if a && b { .. }` |
| `manual_map` | `Some(x) => Some(f(x)), None => None` | `o.map(f)` |
| `single_match` | `match o { Some(x) => .., _ => {} }` | `if let Some(x) = o { .. }` |
| `map_unwrap_or` | `o.map(f).unwrap_or(v)` | `o.map_or(v, f)` (varsayılan **önce**) |
| `unnecessary_map_or` | `o.map_or(false, p)` | `o.is_some_and(p)` |

- Susturmak gerekirse gerekçeyle: `#[expect(clippy::lint_adi, reason = "...")]` (gereksizleşince uyarır).
- **rustfmt:** stil bir araç çıktısıdır; `rustfmt.toml`'u minimumda tut.
- **CI sırası:** `cargo fmt --all --check` → `cargo clippy --all-targets --all-features -- -D warnings` →
  `cargo test` (**`--all-targets` doc testlerini çalıştırmaz!**) → `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps`.
- `#![deny(warnings)]`'i kaynağa yazma; sertlik CI'da (`-D warnings`), kurallar `Cargo.toml` `[lints]`'te.
- Refactor tuzağı: `!v.is_empty() && v.iter().all(p)` → boşluk kontrolü gerekli; boş dizide `all` = `true`.

## Kalıplar: typestate ve sealed trait

```rust
use std::marker::PhantomData;

mod gizli {
    pub trait Muhur {}
}
pub trait Durum: gizli::Muhur {} // sealed: crate dışında uygulanamaz

pub struct Taslak;
pub struct Yayinda;
impl gizli::Muhur for Taslak {}
impl gizli::Muhur for Yayinda {}
impl Durum for Taslak {}
impl Durum for Yayinda {}

pub struct Yazi<S: Durum> {
    baslik: String,
    _durum: PhantomData<S>, // 0 bayt
}

impl Yazi<Taslak> {
    pub fn yayinla(self) -> Yazi<Yayinda> {
        // self tüketilir → eski durum bir daha kullanılamaz
        Yazi { baslik: self.baslik, _durum: PhantomData }
    }
}

impl Yazi<Yayinda> {
    pub fn baslik(&self) -> &str {
        // yalnızca yayındaki yazıda var (taslakta çağırmak E0599)
        &self.baslik
    }
}

fn main() {
    let t: Yazi<Taslak> = Yazi { baslik: String::from("Rust'ta Kalite"), _durum: PhantomData };
    println!("{}", t.yayinla().baslik());
}
```

- **Typestate:** durum = tip parametresi; geçersiz çağrı derleme hatası, çalışma zamanı bedeli **0**. Durum çalışma
  zamanında belirleniyorsa ya da karışık durumlar bir `Vec`'te tutulacaksa → **enum**.
- **Sealed trait:** herkes **kullanır**, yalnızca crate **uygular**; trait'e metot eklemek kimseyi kırmaz. Derleyici
  bunu tanır: *"`Durum` is a sealed trait"* (E0277).

| Hata | Anlamı | Çözüm |
|---|---|---|
| E0308 (`&String` beklenen yerde `&str`) | parametre fazla kısıtlı | parametreyi `&str` yap |
| E0277 `? couldn't convert the error` | `From` uygulaması yok | `#[from]` ekle ya da `map_err` |
| E0599 metot yok (`Siparis<Sepette>`) | typestate: yanlış durumda çağrı | önce doğru geçişi yap |
| E0277 `X: Muhur` sağlanmıyor | mühürlü trait'i dışarıdan uygulama | sağlanan tiplerden birini kullan |
