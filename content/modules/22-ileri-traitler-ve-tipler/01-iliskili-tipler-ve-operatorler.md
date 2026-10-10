---
id: m22-l01
title: İlişkili tipler ve operatör aşırı yükleme
minutes: 26
type: lesson
objectives:
  - "`std::ops` trait'lerini (`Add`, `Sub`, `Mul`, `Neg`, `AddAssign`, `Index`) uygulayarak kendi tiplerine operatör kazandırabilmek"
  - "Bir trait'te ilişkili tip (`type Output`) mi generic parametre (`Trait<T>`) mi kullanılacağına gerekçesiyle karar verebilmek"
  - "`Add<Rhs = Self>` gibi varsayılan tip parametrelerini okuyup farklı sağ taraf tipleri için impl yazabilmek"
  - "`PartialEq<Rhs>` ile farklı tipler arasında karşılaştırma tanımlayabilmek"
keywords: [ilişkili tip, associated type, operatör aşırı yükleme, operator overloading, std::ops, Add, Mul, Neg, AddAssign, Index, PartialEq, varsayılan tip parametresi, E0369]
---

Bir oyun motoru için fizik kodu yazıyorsun. Konum ve hız iki boyutlu vektörler; her karede
`konum = konum + hiz * dt` hesaplanıyor. Java'da bunu `konum = konum.add(hiz.scale(dt))` diye yazmak
zorundasın, çünkü Java kendi tiplerine `+` tanımlamana izin vermez. C++ ve Python izin verir
(`operator+`, `__add__`). Rust da izin verir, ama kendine özgü bir yolla: **Operatörler birer trait'tir.**

Bu derste Rust'ın `+`, `*`, `-`, `+=`, `[]` ve `==` operatörlerini kendi tiplerine nasıl uyguladığını
göreceksin. Bunu yaparken trait'lerin iki güçlü özelliğiyle tanışacaksın: **ilişkili tipler (associated
types)** ve **varsayılan tip parametreleri (default type parameters)**.

## Operatörler aslında trait'tir

Önce tahmin et: İki vektörü toplamak istiyoruz. Derlenir mi?

```compiles
code: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Vektor2 {
      x: f64,
      y: f64,
  }

  fn main() {
      let a = Vektor2 { x: 1.0, y: 2.0 };
      let b = Vektor2 { x: 3.0, y: -1.0 };
      let c = a + b;
      println!("{c:?}");
  }
answer: false
error: E0369
explanation: |
  Derleyici `Vektor2` için `+`'nın ne anlama geldiğini bilmiyor. `derive` ile `Debug`, `Clone`,
  `PartialEq` alabilirsin ama toplamanın anlamını türetemezsin: İki vektörü bileşen bileşen mi
  toplayacaksın, başka bir şey mi yapacaksın? Buna sen karar vermelisin.
```

:::error
```text
error[E0369]: cannot add `Vektor2` to `Vektor2`
  --> src/main.rs:10:15
   |
10 |     let c = a + b;
   |             - ^ - Vektor2
   |             |
   |             Vektor2
   |
note: an implementation of `Add` might be missing for `Vektor2`
  --> src/main.rs:2:1
   |
 2 | struct Vektor2 {
   | ^^^^^^^^^^^^^^ must implement `Add`
```
Mesaj çözümü de söylüyor: **`Add` trait'ini uygula.** Rust'ta `a + b` yazmak, aslında
`std::ops::Add::add(a, b)` çağırmanın kısa yoludur.
:::

`Add` standart kütüphanede (sadeleştirilmiş hâliyle) şöyle tanımlı:

```text
pub trait Add<Rhs = Self> {
    type Output;
    fn add(self, rhs: Rhs) -> Self::Output;
}
```

Üç parçası var: Sağ taraftaki işlenenin tipi `Rhs` (*right-hand side*), sonucun tipi `Output` ve
toplamayı yapan `add` metodu. `Rhs = Self` ve `type Output` bu dersin iki yeni kavramı; önce
uygulayalım, sonra ikisini de açacağız:

```rust
use std::ops::{Add, Sub};

#[derive(Debug, Clone, Copy, PartialEq)]
struct Vektor2 {
    x: f64,
    y: f64,
}

impl Add for Vektor2 {
    type Output = Vektor2;

    fn add(self, diger: Vektor2) -> Vektor2 {
        Vektor2 { x: self.x + diger.x, y: self.y + diger.y }
    }
}

impl Sub for Vektor2 {
    type Output = Vektor2;

    fn sub(self, diger: Vektor2) -> Vektor2 {
        Vektor2 { x: self.x - diger.x, y: self.y - diger.y }
    }
}

fn main() {
    let konum = Vektor2 { x: 1.0, y: 2.0 };
    let hiz = Vektor2 { x: 3.0, y: -1.0 };
    let yeni_konum = konum + hiz; // Add::add(konum, hiz)
    println!("{yeni_konum:?}");
    println!("{:?}", yeni_konum - konum); // hız geri gelir
}
```

Bu yaklaşım **operatör aşırı yükleme (operator overloading)** olarak bilinir. Rust'taki biçimi C++'tan
daha disiplinlidir: Yalnızca `std::ops` ve `std::cmp`'deki trait'lere karşılık gelen operatörleri
yükleyebilirsin. Yeni operatör icat edemezsin (`**` ya da `<=>` yok), atamayı (`=`), mantıksal `&&` ve
`||`'yi, `.` ve `as`'i değiştiremezsin. Böylece `a = b` ya da `x && y` gördüğünde ne olduğunu her
zaman bilirsin.

:::analogy Priz standardı
Duvardaki priz bir **standart**tır: O standarda uyan her cihaz (ütü, şarj aleti, çaycı) prize takılır.
Prizin, takılan cihazın ne olduğunu bilmesi gerekmez. `+` işareti de bir prizdir; standardın adı
`Add`'dir. `Vektor2`'nin fişini bu standarda uygun yaptığın (`impl Add`) anda `+` prizine takılabilir.
:::

## İlişkili tipler: type Output

`impl Add for Vektor2` içindeki `type Output = Vektor2;` satırına **ilişkili tip (associated type)**
denir: Trait'in içinde bir tip için ayrılmış bir yer tutucu. Trait, “bir sonuç tipi olacak” der; hangi
tip olacağına **uygulayan** karar verir. Bu fikri Modül 14'ten tanıyorsun: `Iterator`'ın
`type Item`'ı da ilişkili bir tiptir.

Kendi trait'imizle deneyelim. Bir “depo” kavramı tanımlıyoruz; kitaplık kitap, kumbara para saklar:

```rust
trait Depo {
    type Esya; // her depo kendi eşya tipini seçer

    fn koy(&mut self, esya: Self::Esya);
    fn son(&self) -> Option<&Self::Esya>;
}

#[derive(Debug)]
struct Kitap {
    ad: String,
}

struct Kitaplik {
    raflar: Vec<Kitap>,
}

struct Kumbara {
    paralar: Vec<u32>,
}

impl Depo for Kitaplik {
    type Esya = Kitap;

    fn koy(&mut self, esya: Kitap) {
        self.raflar.push(esya);
    }

    fn son(&self) -> Option<&Kitap> {
        self.raflar.last()
    }
}

impl Depo for Kumbara {
    type Esya = u32;

    fn koy(&mut self, esya: u32) {
        self.paralar.push(esya);
    }

    fn son(&self) -> Option<&u32> {
        self.paralar.last()
    }
}

// Her depoyla çalışır: eşyanın tipi D::Esya
fn iki_kez_koy<D: Depo>(depo: &mut D, a: D::Esya, b: D::Esya) {
    depo.koy(a);
    depo.koy(b);
}

// Yalnızca eşyası u32 olan depolarla çalışır
fn son_para<D: Depo<Esya = u32>>(depo: &D) -> u32 {
    *depo.son().unwrap_or(&0)
}

fn main() {
    let mut kitaplik = Kitaplik { raflar: Vec::new() };
    let nutuk = Kitap { ad: String::from("Nutuk") };
    let kuyucakli = Kitap { ad: String::from("Kuyucaklı Yusuf") };
    iki_kez_koy(&mut kitaplik, nutuk, kuyucakli);
    println!("{:?}", kitaplik.son().map(|k| &k.ad));

    let mut kumbara = Kumbara { paralar: Vec::new() };
    iki_kez_koy(&mut kumbara, 5, 20);
    println!("son atılan: {} TL", son_para(&kumbara));
}
```

İki yeni yazım biçimine dikkat: Generic kodda ilişkili tipe `D::Esya` diye ulaşılır. Bir sınırda onu
sabitlemek için de `Depo<Esya = u32>` yazılır; tıpkı Modül 14'te `impl Iterator<Item = u32>` yazdığın gibi.

Peki aynı şeyi generic bir parametreyle (`trait Depo<E>`) yapsak ne değişirdi? Bir tip, generic bir
trait'i **birden çok kez** uygulayabilir. Bu bazen tam istediğin şeydir:

```rust
trait Cevir<Hedef> {
    fn cevir(&self) -> Hedef;
}

struct Celsius(f64);

impl Cevir<f64> for Celsius {
    fn cevir(&self) -> f64 {
        self.0 * 1.8 + 32.0 // Fahrenheit değeri
    }
}

impl Cevir<String> for Celsius {
    fn cevir(&self) -> String {
        format!("{} °C", self.0)
    }
}

fn main() {
    let hava = Celsius(25.0);
    let f: f64 = hava.cevir(); // hangi impl? Tip belirtmesinden anlaşılıyor
    let yazi: String = hava.cevir();
    println!("{f} °F / {yazi}");
}
```

Ama bedeli var: `let x = hava.cevir();` yazarsan derleyici iki impl arasında seçim yapamaz ve
`E0283: type annotations needed` hatası verir (“multiple `impl`s satisfying `Celsius: Cevir<_>` found”).
İlişkili tipte bu belirsizlik hiç doğmaz, çünkü bir tip trait'i **yalnızca bir kez** uygulayabilir;
`Kumbara`'nın eşyası her zaman `u32`'dir.

| | İlişkili tip `type Esya;` | Generic parametre `Trait<T>` |
|---|---|---|
| Bir tip kaç kez uygulayabilir? | **Bir** kez | Her `T` için ayrı ayrı, **çok** kez |
| Kullanırken tip belirtmek | Gerekmez, impl'den bellidir | Çoğu zaman gerekir (`let f: f64 = ...`) |
| Ne zaman? | Tipin **doğal tek** bir cevabı varsa | Aynı tip için birden çok anlam mantıklıysa |
| Standart kütüphaneden | `Iterator::Item`, `Deref::Target`, `Add::Output` | `From<T>`, `Add<Rhs>`, `PartialEq<Rhs>` |

```quiz
question: |
  (Modül 14 tekrarı) `Iterator` trait'i neden `trait Iterator<T> { fn next(&mut self) -> Option<T>; }`
  biçiminde değil de `type Item` ilişkili tipiyle tanımlanmıştır?
options:
  - "Generic parametreli trait'ler `for` döngüsünde kullanılamadığı için"
  - "Bir iterator'ın ürettiği eleman tipi tektir; ilişkili tip bunu garanti eder ve her `next()` çağrısında tip belirtmeyi gereksiz kılar"
  - "İlişkili tipler çalışma anında daha hızlı olduğu için"
  - "`Iterator` çok eski bir trait olduğu ve generic'ler o zamanlar olmadığı için"
answer: 1
explanation: |
  `vec.iter()` her zaman `&T` üretir; aynı iterator'ın bir de `String` ürettiği bir dünya anlamsız olurdu.
  `Iterator<T>` olsaydı bir tip `Iterator<u32>` ve `Iterator<String>`'i birlikte uygulayabilirdi ve
  `for x in it` yazdığında derleyici `x`'in tipini çıkaramazdı. İkisi de derleme zamanında çözülür;
  hız farkı yoktur.
feedback:
  - "Sorun `for` değil; sorun belirsizlik. Generic trait'li tipler `for`'a girseydi bile hangi `T` seçilecekti?"
  - "Doğru!"
  - "İkisi de monomorfizasyonla derleme zamanında çözülür; çalışma anı maliyeti aynıdır (sıfır)."
  - "Generic'ler Rust 1.0'dan beri var; tercih bilinçli bir tasarım kararıdır."
```

## Varsayılan tip parametreleri: Add<Rhs = Self>

`Add<Rhs = Self>` içindeki `= Self` bir **varsayılan tip parametresidir**: `impl Add for Vektor2`
yazıp `Rhs`'yi belirtmezsen `Rhs = Vektor2` kabul edilir. En yaygın durum (aynı tipten iki değeri
toplamak) ekstra yazı gerektirmez. Ama sağ taraf **farklı** bir tip de olabilir. Fizikte bir vektörü bir
sayıyla ölçeklemek (`hiz * 2.0`) çok yaygındır:

```rust
use std::ops::Mul;

#[derive(Debug, Clone, Copy, PartialEq)]
struct Vektor2 {
    x: f64,
    y: f64,
}

// Vektor2 * f64 → Vektor2 (ölçekleme)
impl Mul<f64> for Vektor2 {
    type Output = Vektor2;

    fn mul(self, k: f64) -> Vektor2 {
        Vektor2 { x: self.x * k, y: self.y * k }
    }
}

// f64 * Vektor2 → Vektor2 (aynı işlem, ters sıra)
impl Mul<Vektor2> for f64 {
    type Output = Vektor2;

    fn mul(self, v: Vektor2) -> Vektor2 {
        v * self // yukarıdaki impl'e devret
    }
}

// Vektor2 * Vektor2 → f64 (nokta çarpımı)
impl Mul for Vektor2 {
    type Output = f64;

    fn mul(self, diger: Vektor2) -> f64 {
        self.x * diger.x + self.y * diger.y
    }
}

fn main() {
    let hiz = Vektor2 { x: 3.0, y: 4.0 };
    println!("{:?}", hiz * 2.0);
    println!("{:?}", 0.5 * hiz);
    println!("{}", hiz * hiz); // 3·3 + 4·4
}
```

Burada iki kavramın birlikte çalıştığını görüyorsun. `Rhs` **generic** bir parametre, çünkü bir tip
birden çok şeyle çarpılabilir (`f64` ile, `Vektor2` ile). `Output` ise **ilişkili** bir tip, çünkü
`Self` ve `Rhs` belli olduğunda sonucun tek bir doğru cevabı vardır: `Vektor2 * f64` her zaman
`Vektor2`, `Vektor2 * Vektor2` her zaman `f64`'tür.

Varsayılan tip parametreleri iki işe yarar: **1)** Yaygın durumda kullanıcıyı gereksiz yazıdan kurtarır.
**2)** Mevcut bir trait'i, onu kullanan kodu kırmadan genişletmeni sağlar: `trait Birlestir` yayınladıktan
sonra onu `trait Birlestir<Diger = Self>` yaparsan, eski `impl Birlestir for X` satırları aynen derlenmeye
devam eder. Kendi trait'inde de aynı sözdizimini kullanırsın: `trait Birlestir<Diger = Self> { ... }`.

```fill
prompt: "Boşlukları doldurarak bir `Para` değerinin bir tam sayıyla çarpılabilmesini (`fiyat * 3`) sağla."
code: |
  use std::ops::Mul;

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Para(u64); // kuruş cinsinden

  impl Mul<___0> for Para {
      type ___1 = Para;

      fn mul(self, adet: u64) -> Para {
          Para(self.0 * adet)
      }
  }

  fn main() {
      let simit = Para(1500);
      println!("{:?}", simit * 3);
  }
blanks:
  - ["u64"]
  - ["Output"]
output: Para(4500)
explanation: |
  Sağ taraf bir `u64` olduğu için `Mul<u64>` uyguluyoruz; varsayılan `Rhs = Self` burada işimize yaramaz
  (o `Para * Para` olurdu, ki para ile parayı çarpmak anlamsızdır!). İlişkili tipin adı trait'te
  `Output` olarak tanımlandığı için impl'de de tam bu adı kullanmalısın.
```

`impl Mul<Vektor2> for f64` satırı aklına bir şey getirdi mi? `Mul` de `f64` de standart kütüphaneden.

```quiz
question: |
  (Modül 11 tekrarı: orphan rule) `Vektor2` senin crate'inde tanımlı. Aşağıdaki impl'lerden **hangileri**
  derlenir?
options:
  - "`impl Mul<Vektor2> for f64 { ... }`"
  - "`impl Mul<f64> for Vektor2 { ... }`"
  - "`impl Mul<f64> for i32 { ... }`"
  - "`impl Mul<Vec<Vektor2>> for f64 { ... }`"
answer: [0, 1]
explanation: |
  Orphan rule, trait'in ya da tiplerden birinin yerel olmasını ister; trait'in tip parametreleri de
  sayılır. `Mul<Vektor2>` içinde yerel `Vektor2` geçtiği için ilk impl'i başka hiçbir crate yazamaz,
  çakışma olmaz. Bu yüzden `2.0 * v` yazabilmek mümkün. `Mul<f64> for i32` tamamen yabancıdır (`E0117`).
  `Vec<Vektor2>` ise yerel bir tipi içerse de kendisi yabancıdır (`Vec`), yerel sayılmaz.
feedback:
  - "Doğru: trait parametresindeki yerel tip impl'i sana ait kılıyor."
  - "Doğru: `Self` tipi senin."
  - "`Mul`, `f64` ve `i32`'nin hepsi yabancı: `E0117`."
  - "Yabancı bir tipin (`Vec`) içine yerel bir tip koymak onu yerel yapmaz."
```

## Operatörler ve sahiplik

`add` metodunun imzasına bir daha bak: `fn add(self, rhs: Rhs)`. `&self` değil, **`self`** alıyor.
Yani `a + b` iki işleneni de fonksiyona **taşır**. `Vektor2` `Copy` olduğu için bunu hiç fark etmedik.
Peki heap'te veri tutan bir tip olsaydı?

```compiles
question: "(Modül 4 tekrarı) `Polinom(vec![1, 2])`, `1 + 2x` polinomunu temsil ediyor. Derlenir mi?"
code: |
  use std::ops::Add;

  #[derive(Debug, PartialEq)]
  struct Polinom(Vec<i64>);

  impl Add for Polinom {
      type Output = Polinom;
      fn add(self, diger: Polinom) -> Polinom {
          let mut k = self.0;
          for (i, c) in diger.0.into_iter().enumerate() {
              if i < k.len() { k[i] += c; } else { k.push(c); }
          }
          Polinom(k)
      }
  }

  fn main() {
      let p = Polinom(vec![1, 2]);
      let q = Polinom(vec![0, 3, 5]);
      let r = p + q;
      println!("{r:?}");
      println!("{p:?}");
  }
answer: false
error: E0382
explanation: |
  `p + q`, `Add::add(p, q)` demektir; `self` değer olarak alındığı için `p` ve `q` fonksiyonun içine
  taşınır. `Polinom` bir `Vec` içerdiği için `Copy` olamaz, bu yüzden `p`'yi sonradan kullanmak `E0382`
  verir. Hata mesajı da bunu söylüyor: “`p` moved due to usage in operator”.
```

:::error
```text
error[E0382]: borrow of moved value: `p`
  --> src/main.rs:22:16
   |
18 |     let p = Polinom(vec![1, 2]);
   |         - move occurs because `p` has type `Polinom`, which does not implement the `Copy` trait
19 |     let q = Polinom(vec![0, 3, 5]);
20 |     let r = p + q;
   |             ----- `p` moved due to usage in operator
21 |     println!("{r:?}");
22 |     println!("{p:?}");
   |                ^ value borrowed here after move
   |
note: calling this operator moves the left-hand side
```
“calling this operator moves the left-hand side”: Operatörler sihirli değildir; sıradan metot
çağrılarıdır ve sahiplik kuralları aynen geçerlidir.
:::

Bunu Modül 9'dan da biliyorsun: `let s3 = s1 + &s2;` satırından sonra `s1` kullanılamıyordu, çünkü
standart kütüphanede `impl Add<&str> for String` var: Sol taraf değerle (taşınarak), sağ taraf referansla
alınıyor. Sol tarafın tamponu yeniden kullanılır, gereksiz kopya yapılmaz.

Heap'te veri tutan tipler için üç seçeneğin var:

1. Tip küçük ve basitse (`Vektor2`, `Para`) **`Copy` türet**; taşıma sorunu kendiliğinden kaybolur.
2. Operatörü **referanslar için** uygula: `impl Add for &Polinom`. Böylece `&p + &q` yazılır ve iki
   işlenen de ödünç alınır.
3. Bilinçli olarak `p.clone() + q` yaz (Modül 4: `clone` bir karar olmalı, refleks değil).

```rust
use std::ops::Add;

#[derive(Debug, Clone, PartialEq)]
struct Polinom(Vec<i64>); // Polinom(vec![1, 2, 5]) = 1 + 2x + 5x²

impl Add for &Polinom {
    type Output = Polinom; // referansları topla, YENİ bir polinom üret

    fn add(self, diger: &Polinom) -> Polinom {
        let (uzun, kisa) = if self.0.len() >= diger.0.len() {
            (self, diger)
        } else {
            (diger, self)
        };
        let mut katsayilar = uzun.0.clone();
        for (i, k) in kisa.0.iter().enumerate() {
            katsayilar[i] += k;
        }
        Polinom(katsayilar)
    }
}

fn main() {
    let p = Polinom(vec![1, 2]); // 1 + 2x
    let q = Polinom(vec![0, 3, 5]); // 3x + 5x²
    let r = &p + &q;
    println!("{r:?}");
    println!("p hâlâ burada: {p:?}");
}
```

`impl Add for &Polinom` satırında yaşam süresi yazmadık: impl başlıklarında da Modül 12'deki elision
geçerlidir (açık hâli `impl<'a> Add<&'a Polinom> for &'a Polinom`).

```memory
title: "let r = &p + &q; adım adım"
steps:
  - caption: "`p` ve `q` iki ayrı polinom; katsayıları heap'te."
    stack:
      - frame: main
        vars:
          - { name: p, type: Polinom, value: "ptr · len=2 · cap=2", to: h1 }
          - { name: q, type: Polinom, value: "ptr · len=3 · cap=3", to: h2 }
    heap:
      - { id: h1, value: "1 2" }
      - { id: h2, value: "0 3 5" }
  - caption: "`add(self: &Polinom, diger: &Polinom)` çağrılıyor: iki işlenen de yalnızca **ödünç** alındı."
    stack:
      - frame: main
        vars:
          - { name: p, type: Polinom, value: "ptr · len=2 · cap=2", to: h1 }
          - { name: q, type: Polinom, value: "ptr · len=3 · cap=3", to: h2 }
      - frame: add
        vars:
          - { name: self, type: "&Polinom", value: "&p", to: p }
          - { name: diger, type: "&Polinom", value: "&q", to: q }
    heap:
      - { id: h1, value: "1 2" }
      - { id: h2, value: "0 3 5" }
  - caption: "Sonuç yeni bir heap alanında. `p` ve `q` geçerliliğini koruyor; üç polinom da kullanılabilir."
    stack:
      - frame: main
        vars:
          - { name: p, type: Polinom, value: "ptr · len=2 · cap=2", to: h1 }
          - { name: q, type: Polinom, value: "ptr · len=3 · cap=3", to: h2 }
          - { name: r, type: Polinom, value: "ptr · len=3 · cap=3", to: h3 }
    heap:
      - { id: h1, value: "1 2" }
      - { id: h2, value: "0 3 5" }
      - { id: h3, value: "1 5 5" }
```

Şimdi sıra sende. `Para` küçük bir değer tipi; `Copy` türeteceğiz ve bütün aritmetiği ona kazandıracağız.

```exercise
id: m22-l01-e-para
title: Kuruş hassasiyetinde Para tipi
difficulty: 2
prompt: |
  Bir market kasası yazılımı için `Para` tipini kuruş cinsinden (`i64`) tutuyoruz; böylece Modül 2'deki
  `0.1 + 0.2` yuvarlama sorunları yaşanmıyor. `Display` hazır (`1250` kuruş → `12,50 TL`). Şunları
  tamamla:

  - `Add` (`a + b`), `Sub` (`a - b`): kuruşları topla / çıkar.
  - `Neg` (`-a`): iade için işaret değiştir.
  - `AddAssign` (`toplam += a`): `self`'i yerinde güncelle; dönüş değeri yok.
  - `Mul<i64> for Para` (`fiyat * 3`): adetle çarpma.
  - **Yeni bir impl ekle:** `3 * fiyat` da yazılabilsin (`Mul<Para> for i64`).
starter: |
  use std::fmt;
  use std::ops::{Add, AddAssign, Mul, Neg, Sub};

  #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
  struct Para {
      kurus: i64,
  }

  impl Para {
      fn tl(lira: i64, kurus: i64) -> Para {
          Para { kurus: lira * 100 + kurus }
      }
  }

  impl fmt::Display for Para {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          let isaret = if self.kurus < 0 { "-" } else { "" };
          let mutlak = self.kurus.abs();
          write!(f, "{isaret}{},{:02} TL", mutlak / 100, mutlak % 100)
      }
  }

  impl Add for Para {
      type Output = Para;
      fn add(self, diger: Para) -> Para {
          todo!()
      }
  }

  impl Sub for Para {
      type Output = Para;
      fn sub(self, diger: Para) -> Para {
          todo!()
      }
  }

  impl Neg for Para {
      type Output = Para;
      fn neg(self) -> Para {
          todo!()
      }
  }

  impl AddAssign for Para {
      fn add_assign(&mut self, diger: Para) {
          todo!()
      }
  }

  impl Mul<i64> for Para {
      type Output = Para;
      fn mul(self, adet: i64) -> Para {
          todo!()
      }
  }

  // TODO: `3 * fiyat` yazılabilsin diye i64 için Mul<Para> uygula

  fn main() {
      let cay = Para::tl(12, 50);
      let simit = Para::tl(7, 75);
      let mut sepet = cay * 2;
      sepet += simit;
      println!("Sepet: {sepet}");
      println!("İade: {}", -simit);
  }
solution: |
  use std::fmt;
  use std::ops::{Add, AddAssign, Mul, Neg, Sub};

  #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
  struct Para {
      kurus: i64,
  }

  impl Para {
      fn tl(lira: i64, kurus: i64) -> Para {
          Para { kurus: lira * 100 + kurus }
      }
  }

  impl fmt::Display for Para {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          let isaret = if self.kurus < 0 { "-" } else { "" };
          let mutlak = self.kurus.abs();
          write!(f, "{isaret}{},{:02} TL", mutlak / 100, mutlak % 100)
      }
  }

  impl Add for Para {
      type Output = Para;
      fn add(self, diger: Para) -> Para {
          Para { kurus: self.kurus + diger.kurus }
      }
  }

  impl Sub for Para {
      type Output = Para;
      fn sub(self, diger: Para) -> Para {
          Para { kurus: self.kurus - diger.kurus }
      }
  }

  impl Neg for Para {
      type Output = Para;
      fn neg(self) -> Para {
          Para { kurus: -self.kurus }
      }
  }

  impl AddAssign for Para {
      fn add_assign(&mut self, diger: Para) {
          self.kurus += diger.kurus;
      }
  }

  impl Mul<i64> for Para {
      type Output = Para;
      fn mul(self, adet: i64) -> Para {
          Para { kurus: self.kurus * adet }
      }
  }

  impl Mul<Para> for i64 {
      type Output = Para;
      fn mul(self, fiyat: Para) -> Para {
          fiyat * self
      }
  }

  fn main() {
      let cay = Para::tl(12, 50);
      let simit = Para::tl(7, 75);
      let mut sepet = cay * 2;
      sepet += simit;
      println!("Sepet: {sepet}");
      println!("İade: {}", -simit);
  }
check: tests
tests: |
  #[test]
  fn toplama_ve_cikarma() {
      assert_eq!(Para::tl(12, 50) + Para::tl(7, 75), Para::tl(20, 25), "12,50 + 7,75 = 20,25 TL olmalı");
      let fark = Para::tl(5, 0) - Para::tl(7, 25);
      assert_eq!(fark, Para { kurus: -225 }, "5,00 - 7,25 = -2,25 TL olmalı");
      assert_eq!(fark.to_string(), "-2,25 TL");
  }

  #[test]
  fn isaret_degistirme() {
      let p = Para::tl(3, 5);
      assert_eq!(-p, Para { kurus: -305 }, "-(3,05 TL) = -3,05 TL olmalı");
      assert_eq!(-(-p), p, "İki kez işaret değiştirmek değeri geri vermeli");
      assert_eq!(-Para { kurus: 0 }, Para { kurus: 0 }, "Sıfırın negatifi sıfırdır");
  }

  #[test]
  fn arti_esittir_biriktirir() {
      let mut toplam = Para { kurus: 0 };
      for fiyat in [Para::tl(1, 25), Para::tl(10, 0), Para { kurus: -50 }] {
          toplam += fiyat;
      }
      assert_eq!(toplam, Para::tl(10, 75), "1,25 + 10,00 - 0,50 = 10,75 TL olmalı");
  }

  #[test]
  fn iki_yonlu_carpma() {
      let fiyat = Para::tl(2, 50);
      assert_eq!(fiyat * 3, Para::tl(7, 50), "2,50 × 3 = 7,50 TL olmalı");
      assert_eq!(3 * fiyat, Para::tl(7, 50), "3 × 2,50 de aynı sonucu vermeli");
      assert_eq!(0 * fiyat, Para { kurus: 0 }, "0 adet ürün bedavadır");
      assert_eq!(fiyat * -2, Para::tl(-5, 0), "Negatif adet iade demektir");
  }
hints:
  - "Her impl'de yeni bir `Para { kurus: ... }` döndür; `self.kurus` ile `diger.kurus` sıradan `i64`'lerdir."
  - "`AddAssign` farklıdır: `&mut self` alır ve hiçbir şey döndürmez, yalnızca `self.kurus += diger.kurus;` yazılır."
  - "Ters çarpma için yeni bir blok: `impl Mul<Para> for i64 { type Output = Para; fn mul(self, fiyat: Para) -> Para { fiyat * self } }`. Orphan rule buna izin verir, çünkü `Mul<Para>` içinde yerel `Para` geçiyor."
explanation: |
  `Para` `Copy` olduğu için `cay * 2` yazdıktan sonra `cay` geçerli kalır: Operatörler `self`'i değerle
  alsa bile `Copy` tiplerde yalnızca bir kopya gider. Küçük değer tipleri için en rahat tasarım budur.

  `Mul<Para> for i64` içinde `fiyat * self` yazarak işi zaten yazdığın `Mul<i64> for Para`'ya
  devrettin. İki yönlü operatörlerde mantığı tek yerde tutmak, bir gün yuvarlama kuralı değiştiğinde
  tek bir yeri düzeltmeni sağlar.

  Gerçek bir uygulamada taşmaya karşı `checked_add` (Modül 2) kullanan bir `fn topla(self, d) -> Option<Para>`
  da eklemek isteyebilirsin. Operatör trait'leri `Output` döndürmek zorunda olduğu için hata
  bildiremez; o yüzden `+` sade ve “her zaman başarılı” işlemler için ayrılmalıdır.
```

## Diğer operatörler: Neg, AddAssign ve Index

`+` ile `*` başlangıçtı. Standart kütüphanede yüklenebilen operatörlerin tam listesi şöyle:

| Operatör | Trait | Not |
|---|---|---|
| `a + b`, `a - b`, `a * b`, `a / b`, `a % b` | `Add`, `Sub`, `Mul`, `Div`, `Rem` | `self` + `Rhs` değerle alınır, `Output` döner |
| `-a`, `!a` | `Neg`, `Not` | Tek işlenenli (unary) |
| `a & b`, `a \| b`, `a ^ b`, `a << b`, `a >> b` | `BitAnd`, `BitOr`, `BitXor`, `Shl`, `Shr` | Bit işlemleri |
| `a += b`, `a -= b`, `a *= b` ... | `AddAssign`, `SubAssign`, `MulAssign` ... | `&mut self` alır, `Output` yok |
| `a[i]` | `Index`, `IndexMut` | Referans döndürür |
| `a == b`, `a < b` | `PartialEq`, `PartialOrd` | `std::cmp`'de (Modül 11) |
| `*a` | `Deref`, `DerefMut` | Modül 17 |

Bileşik atama operatörleri (`+=`) neden ayrı trait'ler? Çünkü `a = a + b` bir **yeni değer** üretir,
`a += b` ise var olanı **yerinde** değiştirir. Büyük bir `Vec` ya da `String` için bu fark önemlidir:
`s += "ek"` yeni bir `String` oluşturmadan mevcut tamponun sonuna ekler.

Tahmin et:

```predict
code: |
  use std::ops::{AddAssign, Neg};

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Vektor2 {
      x: i32,
      y: i32,
  }

  impl Neg for Vektor2 {
      type Output = Vektor2;
      fn neg(self) -> Vektor2 {
          Vektor2 { x: -self.x, y: -self.y }
      }
  }

  impl AddAssign for Vektor2 {
      fn add_assign(&mut self, d: Vektor2) {
          self.x += d.x;
          self.y += d.y;
      }
  }

  fn main() {
      let mut konum = Vektor2 { x: 2, y: 5 };
      let hiz = Vektor2 { x: 1, y: -2 };
      konum += hiz;
      konum += -hiz;
      konum += hiz;
      println!("{} {}", konum.x, konum.y);
      println!("{}", -konum == Vektor2 { x: -3, y: -3 });
  }
options:
  - |
    3 3
    true
  - |
    4 1
    false
  - |
    2 5
    true
  - |
    3 3
    false
answer: 0
explanation: |
  `(2, 5) + (1, -2) = (3, 3)`, sonra `-hiz = (-1, 2)` eklenir: `(2, 5)`, sonra yine `hiz`: `(3, 3)`.
  `-hiz` yeni bir değer üretir; `hiz`'i **değiştirmez** (`neg(self)` bir kopya aldı). Bu yüzden üçüncü
  `+=` yine `(1, -2)` ekledi. `-konum = (-3, -3)`, karşılaştırma `true`. `4 1` seçtiysen `-hiz`'in
  `hiz`'i kalıcı olarak değiştirdiğini düşünmüş olabilirsin.
```

Köşeli parantez operatörü `Index` biraz farklıdır: Bir değer değil, **referans** döndürür.

```text
pub trait Index<Idx: ?Sized> {
    type Output: ?Sized;
    fn index(&self, index: Idx) -> &Self::Output;
}
```

Neden referans? Çünkü `v[i]` bir **yer ifadesidir (place expression)**: `v[i] = 5` ya da `&v[i]`
yazabilmelisin. Derleyici `v[i]`'yi `*v.index(i)` olarak çevirir. `index` geçici bir değer döndürseydi
`&v[i]` bir anda sarkan referans olurdu. (`?Sized` işaretini 3. derste açacağız: kısaca, `Output`'un
`str` gibi boyutu bilinmeyen bir tip de olabileceğini söylüyor.)

İndeks tipi `usize` olmak zorunda değil. Bir öğrenci karnesinde dersin adıyla nota ulaşalım:

```rust
use std::ops::{Index, IndexMut};

struct Karne {
    dersler: Vec<(String, u8)>,
}

impl Index<&str> for Karne {
    type Output = u8;

    fn index(&self, ders: &str) -> &u8 {
        for (ad, not) in &self.dersler {
            if ad == ders {
                return not;
            }
        }
        panic!("karnede '{ders}' dersi yok");
    }
}

impl IndexMut<&str> for Karne {
    fn index_mut(&mut self, ders: &str) -> &mut u8 {
        for (ad, not) in &mut self.dersler {
            if ad == ders {
                return not;
            }
        }
        panic!("karnede '{ders}' dersi yok");
    }
}

fn main() {
    let mut karne = Karne {
        dersler: vec![(String::from("Matematik"), 85), (String::from("Fizik"), 70)],
    };
    println!("Matematik: {}", karne["Matematik"]);
    karne["Fizik"] += 10; // IndexMut + u8'in kendi AddAssign'i
    println!("Fizik: {}", karne["Fizik"]);
}
```

Olmayan bir ders istenince panik atmak bir **gelenektir**: `v[99]` ve `harita["yok"]` da panik atar
(Modül 10: panik bir bug'ı işaret eder). Başarısız olabilecek erişim için yanına bir `get` metodu koyup
`Option<&u8>` döndürmek idiomatiktir. `karne["Fizik"] += 10` satırında iki operatör birlikte çalıştı:
`IndexMut` bir `&mut u8` verdi, `+=` ise onun üzerinden notu güncelledi.

## Farklı tipleri karşılaştırmak: PartialEq<Rhs>

`==` operatörünün trait'i `PartialEq` da varsayılan bir sağ taraf tipine sahiptir:
`trait PartialEq<Rhs: ?Sized = Self>`. `#[derive(PartialEq)]` yalnızca `Self == Self`'i üretir, ama
elle başka tiplerle karşılaştırma da tanımlayabilirsin. Standart kütüphane bunu yoğun kullanır:
`String::from("çay") == "çay"` derlenir, çünkü `impl PartialEq<&str> for String` var.

Bir oyunda puanları doğrudan sayılarla karşılaştırmak istiyoruz:

```compiles
code: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Puan(u64);

  impl PartialEq<u64> for Puan {
      fn eq(&self, diger: &u64) -> bool {
          self.0 == *diger
      }
  }

  fn main() {
      let p = Puan(100);
      println!("{}", p == 100);
      println!("{}", 100 == p);
  }
answer: false
error: E0277
explanation: |
  `p == 100` derlenir: `Puan: PartialEq<u64>` var. Ama `100 == p` için **sol** tarafın trait'i aranır:
  `u64: PartialEq<Puan>`. Böyle bir impl yok. Operatör trait'leri her zaman sol işlenenin tipine
  uygulanır; Rust simetriyi kendiliğinden varsaymaz.
```

:::error
```text
error[E0277]: can't compare `{integer}` with `Puan`
  --> src/main.rs:13:24
   |
13 |     println!("{}", 100 == p);
   |                        ^^ no implementation for `{integer} == Puan`
   |
   = help: the trait `PartialEq<Puan>` is not implemented for `{integer}`
   = note: `Puan` implements `PartialEq<{integer}>`
help: consider swapping the equality
   |
13 -     println!("{}", 100 == p);
13 +     println!("{}", p == 100);
```
Derleyici iki çözüm ima ediyor: ya işlenenlerin yerini değiştir ya da eksik yönü uygula.
:::

Eksik yönü uygulamak orphan rule'a takılmaz (`PartialEq<Puan>` içinde yerel `Puan` var):

```rust
use std::cmp::Ordering;

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
struct Puan(u64);

impl PartialEq<u64> for Puan {
    fn eq(&self, diger: &u64) -> bool {
        self.0 == *diger
    }
}

impl PartialEq<Puan> for u64 {
    fn eq(&self, diger: &Puan) -> bool {
        *self == diger.0
    }
}

impl PartialOrd<u64> for Puan {
    fn partial_cmp(&self, diger: &u64) -> Option<Ordering> {
        self.0.partial_cmp(diger)
    }
}

fn main() {
    let skor = Puan(1250);
    println!("{}", skor == 1250);
    println!("{}", 1250 == skor);
    if skor > 1000 {
        println!("Altın lig!");
    }
}
```

`skor > 1000` için `PartialOrd<u64>` yeterli oldu; `PartialOrd<Rhs>`, `PartialEq<Rhs>`'yi supertrait
olarak ister (supertrait'ler bir sonraki dersin konusu). Karşılaştırmalar `&self` aldığı için hiçbir
işlenen taşınmaz.

:::warning Operatörler sürpriz yapmamalı
Okuyan herkes `a + b`'nin **ucuz**, **yan etkisiz** ve matematikteki gibi davrandığını varsayar.
`kullanici_grubu + kullanici` ile bir veritabanına kayıt atmak ya da `a == b`'nin `a`'yı değiştirmesi
teknik olarak mümkündür ama okuyanı yanıltır. Anlamı tartışmalıysa adlandırılmış bir metot
(`grup.ekle(kullanici)`) her zaman daha iyidir. İki kural daha: `a == b` ise `b == a` da olmalı ve
`Eq` + `Hash` uyguluyorsan eşit değerlerin hash'leri eşit olmalı (Modül 11).
:::

```quiz
question: Aşağıdaki operatör aşırı yüklemelerinden hangisi **en az** idiomatiktir?
options:
  - "`Matris * Matris` için `Mul`: matris çarpımı"
  - "`Tarih + Gun` için `Add<Gun>`: tarihe gün eklemek"
  - "`Sepet + Urun` için `Add<Urun>`: ürünü sepete ekleyip stok veritabanını güncellemek"
  - "`Para == u64` için `PartialEq<u64>`"
answer: 2
explanation: |
  Matris çarpımı ve tarihe gün eklemek, matematikte ve günlük dilde `*` ve `+` ile ifade edilen saf
  işlemlerdir. Üçüncüsü ise yan etkili (veritabanı) ve pahalı bir işi masum görünen bir `+`'nın arkasına
  saklıyor. `sepet.ekle(urun)` hem daha açık hem de hata döndürebilir (`Result`). Operatör trait'leri
  hata bildiremez.
feedback:
  - "Matris çarpımı `*`'nın en klasik kullanımlarından biri (`nalgebra`, `glam` böyle yapar)."
  - "`chrono` gibi tarih crate'leri tam olarak bunu yapar: `tarih + Duration`."
  - "Doğru! Yan etkili ve başarısız olabilecek işler adlandırılmış metotlara yakışır."
  - "Standart kütüphanedeki `String == &str` gibi; karşılaştırma saf ve ucuz bir işlem."
```

Şimdi `Index`, referans üzerinden `Add` ve `+=`'yi bir arada kullanacağın daha zorlu bir problem:

```exercise
id: m22-l01-e-stok
title: Depo stoklarını operatörlerle yönetmek
difficulty: 4
prompt: |
  İki şubesi olan bir market zincirinin stoklarını `Stok` tipiyle tutuyoruz: ürün adı → adet
  (`BTreeMap<String, u32>`, Modül 9; anahtarlar sıralı tutulur). Şu operatörleri uygula:

  1. **`Index<&str> for Stok`** (`stok["elma"]`): ürünün adedini döndürür. Ürün **yoksa panik atma**,
     `0` döndür (ipucu: `&0` bir `&'static u32`'dir).
  2. **`Add for &Stok`** (`&kadikoy + &besiktas`): iki şubenin stoklarını birleştiren **yeni** bir `Stok`;
     ortak ürünlerin adetleri toplanır. İki şube de sonrasında kullanılabilir olmalı.
  3. **`AddAssign<(&str, u32)> for Stok`** (`stok += ("elma", 5)`): ürünü ekler, varsa adedini artırır.
starter: |
  use std::collections::BTreeMap;
  use std::ops::{Add, AddAssign, Index};

  #[derive(Debug, Clone, PartialEq)]
  struct Stok {
      urunler: BTreeMap<String, u32>,
  }

  impl Stok {
      fn bos() -> Stok {
          Stok { urunler: BTreeMap::new() }
      }
  }

  impl Index<&str> for Stok {
      type Output = u32;
      fn index(&self, urun: &str) -> &u32 {
          todo!()
      }
  }

  impl Add for &Stok {
      type Output = Stok;
      fn add(self, diger: &Stok) -> Stok {
          todo!()
      }
  }

  impl AddAssign<(&str, u32)> for Stok {
      fn add_assign(&mut self, (urun, adet): (&str, u32)) {
          todo!()
      }
  }

  fn main() {
      let mut kadikoy = Stok::bos();
      kadikoy += ("elma", 40);
      kadikoy += ("süt", 12);
      let mut besiktas = Stok::bos();
      besiktas += ("elma", 15);
      besiktas += ("peynir", 8);
      let toplam = &kadikoy + &besiktas;
      println!("{:?}", toplam.urunler);
      println!("Kadıköy'de peynir: {}", kadikoy["peynir"]);
  }
solution: |
  use std::collections::BTreeMap;
  use std::ops::{Add, AddAssign, Index};

  #[derive(Debug, Clone, PartialEq)]
  struct Stok {
      urunler: BTreeMap<String, u32>,
  }

  impl Stok {
      fn bos() -> Stok {
          Stok { urunler: BTreeMap::new() }
      }
  }

  impl Index<&str> for Stok {
      type Output = u32;
      fn index(&self, urun: &str) -> &u32 {
          self.urunler.get(urun).unwrap_or(&0)
      }
  }

  impl Add for &Stok {
      type Output = Stok;
      fn add(self, diger: &Stok) -> Stok {
          let mut sonuc = self.clone();
          for (urun, adet) in &diger.urunler {
              sonuc += (urun.as_str(), *adet);
          }
          sonuc
      }
  }

  impl AddAssign<(&str, u32)> for Stok {
      fn add_assign(&mut self, (urun, adet): (&str, u32)) {
          *self.urunler.entry(urun.to_string()).or_insert(0) += adet;
      }
  }

  fn main() {
      let mut kadikoy = Stok::bos();
      kadikoy += ("elma", 40);
      kadikoy += ("süt", 12);
      let mut besiktas = Stok::bos();
      besiktas += ("elma", 15);
      besiktas += ("peynir", 8);
      let toplam = &kadikoy + &besiktas;
      println!("{:?}", toplam.urunler);
      println!("Kadıköy'de peynir: {}", kadikoy["peynir"]);
  }
check: tests
tests: |
  fn stok(liste: &[(&str, u32)]) -> Stok {
      let mut s = Stok { urunler: BTreeMap::new() };
      for (u, a) in liste {
          s.urunler.insert(u.to_string(), *a);
      }
      s
  }

  #[test]
  fn indeks_var_olan_ve_olmayan() {
      let s = stok(&[("elma", 40), ("süt", 12)]);
      assert_eq!(s["elma"], 40, "elma'dan 40 tane var");
      assert_eq!(s["süt"], 12, "süt'ten 12 tane var");
      assert_eq!(s["karpuz"], 0, "Olmayan ürün için panik değil 0 dönmeli");
  }

  #[test]
  fn arti_esittir_ekler_ve_arttirir() {
      let mut s = Stok { urunler: BTreeMap::new() };
      s += ("çay", 3);
      s += ("şeker", 1);
      s += ("çay", 7);
      assert_eq!(s, stok(&[("çay", 10), ("şeker", 1)]), "Var olan ürünün adedi artmalı, yenisi eklenmeli");
  }

  #[test]
  fn iki_sube_birlesir() {
      let a = stok(&[("elma", 40), ("süt", 12)]);
      let b = stok(&[("elma", 15), ("peynir", 8)]);
      let t = &a + &b;
      assert_eq!(t, stok(&[("elma", 55), ("peynir", 8), ("süt", 12)]), "Ortak ürünler toplanmalı, diğerleri aynen gelmeli");
      assert_eq!(a["elma"], 40, "Toplama sol işleneni değiştirmemeli");
      assert_eq!(b["peynir"], 8, "Toplama sağ işleneni değiştirmemeli");
  }

  #[test]
  fn bos_stokla_toplama() {
      let a = stok(&[("ayran", 6)]);
      let bos = Stok { urunler: BTreeMap::new() };
      assert_eq!(&a + &bos, a, "Boş stok eklemek bir şey değiştirmemeli");
      assert_eq!(&bos + &a, a, "Sıra fark etmemeli");
  }
hints:
  - "`Index`: `BTreeMap::get` bir `Option<&u32>` döndürür. Yoksa ne döneceğini `unwrap_or(&0)` ile söyle; `&0` gibi sabit referanslar `'static` yaşar, sarkmaz."
  - "`AddAssign`: Modül 9'daki entry API'si: `*self.urunler.entry(urun.to_string()).or_insert(0) += adet;`"
  - "`Add`: `let mut sonuc = self.clone();` ile başla, sonra `for (urun, adet) in &diger.urunler` döngüsünde az önce yazdığın `+=`'yi kullan: `sonuc += (urun.as_str(), *adet);`. Son olarak `sonuc`'u döndür."
explanation: |
  `index` bir referans döndürmek zorunda olduğu için “yoksa 0” demek ilk bakışta imkânsız görünür:
  Geçici bir `0` değerine referans döndürülemez. `&0` ise özel bir durumdur: Sabit bir ifadenin
  referansı derleyici tarafından programın statik belleğine yerleştirilir (*constant promotion*) ve
  `&'static u32` olur. Bu, `HashMap`'in `Index`'inden bilerek farklı bir tasarım; stok için “yok” ile
  “0 adet” aynı anlama geldiği için mantıklı.

  `Add for &Stok` içinde `+=`'yi yeniden kullandın: Birleştirme mantığı tek yerde. `self.clone()` burada
  bir “refleks” değil, **gerekli** bir kopya: Sonuç yeni bir stok olmalı ve iki işlenen de
  değişmemeli. Sol işleneni tüketmeye razıysan `impl Add<&Stok> for Stok` yazıp `self`'i yeniden
  kullanabilirdin, tıpkı `String + &str` gibi; o zaman kopyaya da gerek kalmazdı.

  `add_assign`'in parametresindeki `(urun, adet): (&str, u32)` bir desen: Tuple'ı doğrudan parametre
  listesinde parçaladık (Modül 21).
```

## Özet

:::remember
- Operatörler trait'tir: `a + b` = `Add::add(a, b)`, `-a` = `Neg::neg(a)`, `a[i]` = `*a.index(i)`,
  `a += b` = `AddAssign::add_assign(&mut a, b)`. Eksikse `E0369`.
- **İlişkili tip** (`type Output;`): uygulayan seçer, tip başına **tek** impl, kullanırken tip belirtmek
  gerekmez. **Generic parametre** (`Trait<T>`): aynı tip için **çok** impl, çoğu zaman tip belirtmek gerekir.
- **Varsayılan tip parametresi** `Add<Rhs = Self>`: Yazmazsan `Rhs = Self`. Farklı sağ taraf için
  `impl Mul<f64> for Vektor2`; ters sıra için `impl Mul<Vektor2> for f64` (orphan rule izin verir).
- `add(self, ...)` işlenenleri **taşır**: küçük tiplere `Copy` türet ya da `impl Add for &Tip` yaz.
- `Index` referans döndürür; olmayan anahtarda panik geleneksel. `PartialEq<Rhs>` simetrik değildir,
  iki yönü de uygula. Operatörler ucuz, yan etkisiz ve tahmin edilebilir olmalı.
:::

```reflect
prompt: |
  `Add` trait'inde `Rhs` neden generic bir parametre, `Output` ise neden ilişkili bir tip? Kendi
  cümlelerinle, `Vektor2 * f64` ve `Vektor2 * Vektor2` örnekleri üzerinden açıkla.
answer: |
  Bir tip birden çok farklı şeyle toplanabilir ya da çarpılabilir: `Vektor2`'yi hem bir `f64` ile hem de
  başka bir `Vektor2` ile çarpmak anlamlı. Bu yüzden sağ taraf tipi `Rhs` generic olmalı ki aynı tip için
  `Mul<f64>` ve `Mul<Vektor2>` gibi birden çok impl yazılabilsin.

  Ama sol ve sağ taraf belli olduğunda sonucun tek bir doğru cevabı vardır: `Vektor2 * f64` her zaman
  `Vektor2`, `Vektor2 * Vektor2` (nokta çarpımı) her zaman `f64`'tür. Sonucu generic bir parametre yapmak
  aynı ikili için birden çok sonuç tipine izin verir ve her `a * b` ifadesinde tip belirtmeyi zorunlu
  kılardı. İlişkili tip ise her (Self, Rhs) çifti için sonucu tek bir tipe sabitler.
```

```flashcards
- front: "`a + b` ifadesini derleyici neye çevirir?"
  back: "`std::ops::Add::add(a, b)` çağrısına. Operatörler `std::ops` (ve `std::cmp`) trait'lerinin metotlarıdır."
- front: "İlişkili tip (associated type) ile generic trait parametresi arasındaki temel fark nedir?"
  back: "Bir tip, ilişkili tipli bir trait'i yalnızca **bir kez** uygulayabilir (sonuç tektir, tip belirtmek gerekmez). Generic parametreli trait'i her `T` için ayrı ayrı, **çok kez** uygulayabilir."
- front: "`trait Add<Rhs = Self>` içindeki `= Self` ne anlama gelir?"
  back: "Varsayılan tip parametresi: `impl Add for X` yazıp `Rhs`'yi belirtmezsen sağ taraf tipi `X` kabul edilir."
- front: "`2.0 * v` (`v: Vektor2`) yazabilmek için hangi impl gerekir ve orphan rule buna neden izin verir?"
  back: "`impl Mul<Vektor2> for f64`. Trait'in tip parametresinde yerel `Vektor2` geçtiği için bu impl'i başka bir crate yazamaz."
- front: "`p + q` sonrası `p` neden kullanılamayabilir? İki çözüm söyle."
  back: "`add(self, ..)` işleneni değerle alır, `Copy` olmayan `p` taşınır (`E0382`). Çözüm: tipe `Copy` türetmek ya da `impl Add for &Tip` yazıp `&p + &q` kullanmak."
- front: "`Index::index` neden bir değer değil, referans (`&Self::Output`) döndürür?"
  back: "`v[i]` bir yer ifadesidir (`*v.index(i)`); `&v[i]` ve `v[i] = x` yazılabilmeli. Geçici bir değere referans sarkardı."
- front: "`impl PartialEq<u64> for Puan` varken `100 == puan` neden derlenmez?"
  back: "Operatör trait'i **sol** işlenende aranır: `u64: PartialEq<Puan>` gerekir (`E0277`). Simetri kendiliğinden gelmez; ters yönü de uygulamalısın."
- front: "`a = a + b` ile `a += b` arasındaki fark nedir?"
  back: "`+` yeni bir değer üretir (`Add`, `Output` döner); `+=` var olanı yerinde değiştirir (`AddAssign`, `&mut self` alır, bir şey döndürmez)."
```
