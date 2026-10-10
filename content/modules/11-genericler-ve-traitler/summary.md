# Özet Kartı: Generic'ler ve Trait'ler

## Generic'ler: bir kez yaz, her tiple kullan

```rust
use std::fmt::Display;

fn en_buyuk<T: PartialOrd + Copy>(liste: &[T]) -> T { // generic fonksiyon
    let mut en = liste[0];
    for &x in liste {
        if x > en {
            en = x;
        }
    }
    en
}

struct Nokta<T> { x: T, y: T }                 // generic struct (enum'lar: Option<T>, Result<T, E>)

impl<T: Display> Nokta<T> {                    // her T: Display için metot
    fn goster(&self) -> String { format!("({}, {})", self.x, self.y) }
}

impl Nokta<f64> {                              // yalnızca Nokta<f64> için metot
    fn uzaklik(&self) -> f64 { (self.x * self.x + self.y * self.y).sqrt() }
}

fn main() {
    let p = Nokta { x: 3.0, y: 4.0 };
    println!("{} {} {}", en_buyuk(&[3, 9, 2]), p.goster(), p.uzaklik());
}
```

- Gövde **her olası `T` için** denetlenir: Sınırda yazmayan bir yeteneği (`>`, `{}`, `clone`) kullanamazsın.
- **Monomorfizasyon (monomorphization):** Her farklı somut tip için ayrı bir kopya derlenir. Çalışma
  anında maliyet sıfırdır; karşılığında derleme süresi ve ikili (binary) boyutu artar.
- Tip çıkarılamıyorsa `let v: Vec<i32> = ...` ya da **turbofish** kullan: `"5".parse::<u8>()`.
- Aynı `T` iki alanda aynı tip demektir: `Nokta { x: 1, y: 2.0 }` → **E0308**. İki alan farklı tip
  olacaksa `Nokta<T, U>` yaz. Bildirilen ama hiçbir alanda kullanılmayan tip parametresi → **E0392**.
- `impl<T> Nokta<T>` ve `impl Nokta<f64>` içinde **aynı adlı** metot olamaz (**E0592**): Kararlı Rust'ta
  “daha özel olan kazanır” (specialization) yok.

## Trait'ler: ortak davranış sözleşmesi

```rust
trait Ozet {
    fn yazar(&self) -> String;                 // zorunlu
    fn ozet(&self) -> String {                 // varsayılan (ezilebilir)
        format!("{} tarafından...", self.yazar())
    }
}

struct Gonderi { kullanici: String }

impl Ozet for Gonderi {
    fn yazar(&self) -> String { format!("@{}", self.kullanici) }
}

fn main() {
    let g = Gonderi { kullanici: String::from("ece") };
    println!("{}", g.ozet());
}
```

- Zorunlu metot eksik → **E0046**. Trait'te olmayan bir metot → **E0407**.
- Başka bir modüldeki trait'in metodunu çağırmak için trait **kapsamda** olmalı (`use crate::Ozet;`);
  değilse **E0599**.

## Sınır yazmanın dört yolu

| Yazım | Ne zaman? |
|---|---|
| `fn f(x: &impl Ozet)` | Kısa, tek parametre |
| `fn f<T: Ozet>(a: &T, b: &T)` | İki parametre **aynı** tip olmalıysa |
| `fn f<T, U>(..) where T: Ozet + Clone, U: Debug` | Sınırlar uzunsa |
| `fn f() -> impl Ozet` | Tek bir gizli somut tip döndürmek için (iki farklı tip → **E0308**; `dyn` Modül 20'de) |

- Birden çok sınır `+` ile birleşir: `T: PartialOrd + Display`.
- **Koşullu impl:** `impl<T: Display> Cift<T> { ... }` ya da `impl<T: Display> fmt::Display for Kargo<T>`.
  Metot ya da trait yalnızca sınırı sağlayan `T`'ler için vardır.

## derive ve standart trait'ler

| Trait | Verdiği | Not |
|---|---|---|
| `Debug` | `{:?}`, `{:#?}` | Neredeyse her tipe türet |
| `Clone` / `Copy` | `.clone()` / örtük kopya | `Copy` ⇒ `Clone`; `String`/`Vec` alanı varsa `Copy` türetilemez (**E0204**) |
| `PartialEq` / `Eq` | `==`, `!=` | `f64` yalnızca `PartialEq`'dir (NaN ≠ NaN) |
| `PartialOrd` / `Ord` | `<`, `sort()`, `max()` | Alanlar **tanım sırasıyla**, enum'lar **varyant sırasıyla** (açık sayı verildiyse `A = 2` sayıya göre) karşılaştırılır |
| `Hash` | `HashMap`/`HashSet` anahtarı | `Eq` ile birlikte; `f64` alanı engel olur. `PartialEq`'i elle yazarsan `Hash`'i de aynı alanlara göre yaz |
| `Default` | `Tip::default()`, `..Default::default()` | `0`, `""`, `false`, boş `Vec`, `None`; enum'da `#[default]` |

`derive` her alanın da o trait'i uygulamasını ister; uygulamayan bir alan **E0277** verir (`Copy` için
**E0204**). Generic tiplerde sınır tip parametresine eklenir: `#[derive(Clone)] struct Kutu<T>` →
`impl<T: Clone> Clone for Kutu<T>`; `Renk` `Clone` değilse `Kutu<Renk>`'te `clone` yoktur (**E0599**).
Özel bir sıralama gerekiyorsa `Ord`'u kendin yaz.

## Gösterim ve dönüşüm trait'leri

| Trait | Yazdığın | Bedava gelen |
|---|---|---|
| `fmt::Display` | `fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result` | `{}`, `.to_string()` |
| `From<A> for B` | `fn from(a: A) -> B` | `a.into()` (hedef tip belli olmalı, yoksa **E0282**) |
| `TryFrom<A> for B` | `type Error;` + `fn try_from(a: A) -> Result<B, Self::Error>` | `a.try_into()` |
| `FromStr for B` | `type Err;` + `fn from_str(s: &str) -> Result<B, Self::Err>` | `"..".parse::<B>()` |
| `std::error::Error` | `impl Error for Hata {}` (önce `Debug` + `Display`) | `Box<dyn Error>`'a girer |

- `From` kayıpsız ve hatasız dönüşümler içindir; kayıp olabiliyorsa `TryFrom` kullan. `as` ise sessizce
  keser: `300u32 as u8 == 44`. Ondalıktan tam sayıya `as` sınıra yapışır: `300.0 as u8 == 255`.
- `write!(f, ...)` genişlik ayarını (`{:>8}`) yok sayar. Hizalama istiyorsan `f.pad(&metin)` kullan
  (dikkat: `f.pad` ile hassasiyet, örneğin `{:.2}`, sayıyı yuvarlamaz, metni keser).
- `FromStr` prelude'da değildir: `Tip::from_str(..)` için `use std::str::FromStr;` gerekir; `parse` için gerekmez.
- `impl From<ParseIntError> for Hata` varsa `?` hatayı **kendiliğinden** çevirir; `map_err` gerekmez.

## Esnek parametreler

| İmza | Kabul eder | Ne zaman? |
|---|---|---|
| `ad: &str` | `&String`, `&str` | Yalnızca okuyacaksan (maliyet yok) |
| `ad: impl Into<String>` | `&str`, `String` | `String` saklayacaksan; sahipli `String` kopyalanmadan taşınır |
| `x: impl AsRef<str>` | `String`, `&str`, `&String` | `&[impl AsRef<str>]` hem `&[String]` hem `&[&str]` alır |

## Trait kuralları

- **Orphan rule:** `impl Trait for Tip` için trait **ya da** tip senin crate'inde olmalı.
  `impl Display for Vec<String>` → **E0117**; `impl From<Yerel> for String` ise geçerlidir.
- **Newtype:** `struct Sepet(Vec<String>);` yabancı bir tipi sarar ve bellekte ek maliyeti yoktur.
  Sarılan tipin metotları gelmez; gerekenleri sen yazarsın.
- **Blanket impl:** `impl<T: Display> Vurgula for T { ... }` sınırı sağlayan her tipe uygulanır. Bununla
  çakışan ikinci bir impl → **E0119** (ileride `Display` kazanabilecek yabancı tipler, örneğin `Vec<i32>`,
  için de). `ToString` da böyle gelir: `Display` yaz, `ToString`'i elle yazma.
- **Const generic'ler:** `struct Matris<const N: usize> { veri: [[i32; N]; N] }`. Boyut tipin parçasıdır:
  `Matris<2>` ile `Matris<3>` farklı tiplerdir (**E0308**: expected `2`, found `3`). Veri stack'te
  durur, heap kullanılmaz. Const parametre tam sayı, `bool` ya da `char` olabilir; gövdede değer gibi
  kullanılır (`0..N`, `{N}`). İfade argümanı süslü parantez ister: `f::<{ 2 * 2 }>()`.

## Sık hatalar

| Hata | Neden | Çözüm |
|---|---|---|
| `E0369` binary operation `>` cannot be applied to type `T` | Sınırsız `T` ile operatör | `T: PartialOrd` (`==` için `PartialEq`) |
| `E0277` `T` doesn't implement `Display` | Sınırda olmayan bir yetenek | Sınıra ekle: `T: Display` |
| `E0508` cannot move out of type `[T]` | `liste[0]`'ı dilimden taşımak | `T: Copy`, `.clone()` ya da `&T` döndür |
| `E0282` type annotations needed | `parse()` ya da `into()` hedef tipsiz | Tip yaz ya da turbofish kullan |
| `E0046` / `E0407` | Eksik / fazla trait metodu | İmzayı trait'tekiyle eşleştir |
| `E0599` no method named ... | Trait kapsamda değil ya da metot başka bir somut tip için | `use` ile içeri al, doğru tipi kullan |
| `E0599` method exists ... but its trait bounds were not satisfied | Koşullu impl / türetilmiş impl'in sınırı sağlanmadı | Eksik trait'i tipe uygula ya da türet |
| `E0277` `?` couldn't convert the error to `Hata` | Hata tipine `From` yok | `impl From<KaynakHata> for Hata` ya da `map_err` |
| `E0204` the trait `Copy` cannot be implemented | `Copy` olmayan bir alan var | Yalnızca `Clone` türet |
| `E0592` duplicate definitions | Aynı adlı metot hem `impl<T>` hem `impl Tip<f64>` içinde | Özel sürüme farklı ad ver |
| `E0117` / `E0119` | Orphan rule / çakışan impl | Newtype / tek impl |
