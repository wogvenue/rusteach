# Özet Kartı: İleri Trait'ler ve Tipler

## Operatörler = trait'ler (`std::ops`)

| Operatör | Trait | İmza özü |
|---|---|---|
| `a + b`, `a - b`, `a * b` | `Add<Rhs = Self>`, `Sub`, `Mul` | `fn add(self, rhs: Rhs) -> Self::Output` |
| `-a` | `Neg` | `fn neg(self) -> Self::Output` |
| `a += b` | `AddAssign<Rhs = Self>` | `fn add_assign(&mut self, rhs: Rhs)` |
| `a[i]` | `Index<Idx>` / `IndexMut` | `fn index(&self, i: Idx) -> &Self::Output` |
| `a == b` | `PartialEq<Rhs = Self>` | `fn eq(&self, other: &Rhs) -> bool` |

```rust
use std::ops::{Add, Mul};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct V(pub f64, pub f64);

impl Add for V {
    type Output = V; // ilişkili tip: tek doğru cevap
    fn add(self, o: V) -> V {
        V(self.0 + o.0, self.1 + o.1)
    }
}

impl Mul<f64> for V {
    // generic Rhs: aynı tip için birden çok impl olabilir
    type Output = V;
    fn mul(self, k: f64) -> V {
        V(self.0 * k, self.1 * k)
    }
}
```

- Operatörler `self`'i **değer olarak** alır: `Copy` değilse operand taşınır (E0382). Çare: `derive(Copy)` ya da `impl Add for &T`.
- `h * 2.0` için `Mul<f64> for V`; `2.0 * h` için ayrıca `Mul<V> for f64` gerekir.
- **İlişkili tip mi generic mi?** Uygulayıcı başına tek cevap → `type Item;`. Birden çok impl anlamlı → `Trait<T>`.
- **Varsayılan tip parametresi**: `trait Add<Rhs = Self>`; yazılmazsa `Rhs = Self`.

## Belirsizlik, supertrait, newtype

| Durum | Yazım |
|---|---|
| İki trait'te aynı metot | `Pilot::uc(&kisi)` |
| `self`'siz ilişkili fonksiyon | `<Kopek as Hayvan>::yavru_adi()` (yoksa E0790) |
| Supertrait | `trait Rapor: Display + Debug { .. }`; varsayılan metotta `{self}` kullanılabilir |
| Yabancı trait + yabancı tip (orphan, E0117) | `struct Liste(Vec<String>); impl Display for Liste` |

- Tipin kendi (inherent) metodu varsa `x.metot()` önce onu seçer; iki trait çakışır ve inherent yoksa **E0034**.
- Newtype: sıfır maliyet, yeni tip. İçteki tipin bütün metotlarını istiyorsan `Deref` (dikkatli kullan).

## İleri tipler

| Kavram | Özü |
|---|---|
| `type Liste = Vec<String>;` | **Takma ad**, yeni tip değil. `impl Liste` yazılamaz (E0116). Kalıp: `type Sonuc<T> = Result<T, Hata>;` |
| `!` (never) | `panic!`, `continue`, `break`, `return`, `loop {}`, `todo!()`, `process::exit` → her tipe dönüşür. `fn f() -> !` |
| DST | `str`, `[T]`, `dyn Trait`: boyut çalışma anında; hep işaretçi arkasında (`&`, `Box`, `Rc`) |
| Fat pointer | `&str`/`&[T]` = adres + uzunluk; `&dyn Trait` = adres + vtable → 16 bayt |
| `Sized` | Her generic'te örtük `T: Sized`. `T: ?Sized` kaldırır → `T` yalnızca `&T`/`Box<T>` ile. Trait'te `Self` zaten `?Sized` |

```rust
use std::fmt::Display;

pub fn yaz<T: Display + ?Sized>(x: &T) -> String {
    format!("<{x}>") // T = str ve T = dyn Display de olabilir
}
```

## Fonksiyonlar ve closure'lar

| | Boyut | Ne zaman? |
|---|---|---|
| Fonksiyon öğesi `iki_kat` | 0 bayt, her fonksiyonun kendi tipi | Generic `F: Fn` parametresine verirken (inline edilir) |
| `fn(i32) -> i32` işaretçisi | 8 bayt, `Copy` | Tablo, struct alanı, FFI; **yakalamayan** closure'lar dönüşür |
| `impl Fn(i32) -> i32` | Closure'ın kendi boyutu | Varsayılan parametre ve dönüş tipi |
| `Box<dyn Fn(i32) -> i32>` | 16 bayt + heap | Çalışma anında seçilen / birlikte saklanan farklı closure'lar |

- `let mut f = iki_kat; f = uc_kat;` → **E0308** (farklı fn öğeleri). Çare: `let mut f: fn(i32) -> i32`.
- Değer olarak fonksiyonlar: `.map(str::trim)`, `.map(String::from)`, `.map(Some)`, `.map(Puan)`, `i64::checked_add`.
- Tipler **birebir** uymalı: `Vec<String>` üzerinde `.iter().map(str::len)` → **E0631** (`&String` ≠ `&str`).
- **HRTB**: `F: Fn(&str) -> &str` ≡ `F: for<'a> Fn(&'a str) -> &'a str` (“her `'a` için”). Dışarıdan seçilen `'a` ile yerel ödünç → E0597.
- Yaşam süresi parametreli trait'te açıkça: `where P: for<'a> Ayristir<'a>`. Hata dili: “not general enough”.

## PhantomData, marker'lar, sealed, GAT, RPITIT

```rust
use std::marker::PhantomData;

#[derive(Debug, Clone, Copy)]
pub enum Metre {}

#[derive(Debug, Clone, Copy)]
pub struct Uzunluk<B> {
    pub deger: f64,
    birim: PhantomData<B>, // 0 bayt; olmazsa E0392
}

pub mod para {
    mod gizli {
        pub trait Muhur {}
    }
    pub trait ParaBirimi: gizli::Muhur {} // sealed: dışarıda kullanılır, uygulanamaz
}

pub trait Koleksiyon {
    fn ogeler(&self) -> impl Iterator<Item = u32>; // RPITIT (1.75+), dyn uyumlu değil
}

pub trait OdunctenIterator {
    type Oge<'a> // GAT (1.65+)
    where
        Self: 'a;
    fn sonraki<'a>(&'a mut self) -> Option<Self::Oge<'a>>;
}
```

- `PhantomData<T>`: “sanki `T` tutuyorum”. Birim/durum etiketleri, typestate. `derive(Clone)` yine de `T: Clone` ister.
- **Marker trait'ler**: `Copy`, `Eq` (derive); `Send`, `Sync`, `Unpin` (**otomatik**); `Sized` (örtük). `PhantomData<Rc<()>>` → tip `!Send`.
- **`impl Trait` konumları**: argüman (gizli generic), dönüş (tek gizli tip), trait metodu dönüşü (RPITIT). `let x: impl ..` → **E0562**.
- Edition 2024: dönüşteki `impl Trait` bütün yaşam sürelerini yakalar; daraltmak için `+ use<>` / `+ use<'a, T>`.

## Sık hatalar

| Kod | Anlamı | Çare |
|---|---|---|
| E0369 | Tip için operatör tanımlı değil | `impl Add for T` |
| E0382 | Operatör operandı taşıdı | `Copy` ya da `&a + &b` impl'i |
| E0034 / E0790 | Belirsiz metot / ilişkili fonksiyon | `Trait::m(&x)` / `<T as Trait>::f()` |
| E0117 / E0116 | Orphan rule / takma ada impl | Newtype |
| E0277 (Sized) | `T = str` ama örtük `T: Sized` | `T: ?Sized` |
| E0308 (fn) | Farklı fn öğeleri / yakalayan closure → `fn` | `fn(..)` tipini yaz / `impl Fn` kullan |
| E0631 | Fonksiyon değerinin imzası uymuyor | `String::len` ya da closure |
| E0597 (HRTB) | Dışarıdan seçilen `'a` | `for<'a>` |
| E0392 | Kullanılmayan tip parametresi | `PhantomData<T>` |
| E0038 | RPITIT'li trait `dyn` olamaz | `Box<dyn Iterator>` döndür ya da `where Self: Sized` |
| E0562 | `impl Trait` izin verilmeyen konumda | Generic ya da `Box<dyn ..>` |
