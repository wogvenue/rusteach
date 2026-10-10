---
id: m11-l02
title: Generic struct, enum ve metotlar
minutes: 19
type: lesson
objectives:
  - Bir ya da birden fazla tip parametresi alan struct ve enum tanımlayabilmek
  - "`impl<T>` ile her tip için, `impl Nokta<f64>` ile yalnızca belirli bir tip için metot yazabilmek"
  - Bir metodun kendi tip parametrelerini struct'ın tip parametrelerinden ayırt edebilmek
  - Monomorfizasyonun ne olduğunu ve generic'lerin çalışma zamanında neden bedava olduğunu açıklayabilmek
keywords: [generic struct, generic enum, "impl<T>", "Option<T>", "Result<T, E>", monomorfizasyon, sıfır maliyet]
---

Bir strateji oyunu yazıyorsun. Haritadaki birimler tam sayılı bir ızgarada (`i32`) duruyor, ama fizik motoru
mermileri ondalıklı koordinatlarla (`f64`) hesaplıyor. `NoktaI32` ve `NoktaF64` diye iki ayrı struct mı
yazacaksın? Önceki derste **fonksiyonları** generic yaptık; şimdi aynı fikri **veri yapılarına** ve
**metotlara** uyguluyoruz. Dersin sonunda da büyük soruyu cevaplayacağız: bütün bu esnekliğin çalışma
zamanında bir bedeli var mı?

## Generic struct: `Nokta<T>`

Struct adının ardından `<T>` ile tip parametresini bildirir, alanlarda kullanırsın:

```rust
#[derive(Debug)]
struct Nokta<T> {
    x: T,
    y: T,
}

fn main() {
    let izgara = Nokta { x: 5, y: 10 }; // Nokta<i32>
    let mermi = Nokta { x: 1.5, y: 4.25 }; // Nokta<f64>
    let harfler = Nokta { x: 'a', y: 'z' }; // Nokta<char>
    println!("{izgara:?}");
    println!("{mermi:?}");
    println!("{harfler:?}: x = {}, y = {}", harfler.x, harfler.y);
}
```

`Nokta<T>`'yi şöyle oku: *“`T` tipinde iki koordinatı olan nokta.”* Tipi yine derleyici çıkarır:
`Nokta { x: 5, y: 10 }` gördüğünde `T = i32` olduğunu anlar. Peki şu satır?

```compiles
code: |
  struct Nokta<T> {
      x: T,
      y: T,
  }

  fn main() {
      let p = Nokta { x: 5, y: 4.0 };
      println!("{} {}", p.x, p.y);
  }
answer: false
error: E0308
explanation: |
  Tanımda **tek** bir `T` var; yani `x` ile `y` **aynı tipte** olmak zorunda. Derleyici `x: 5`'i görünce
  `T`'nin bir tam sayı olduğuna karar verir, ardından `y: 4.0` ondalıklı geldiği için itiraz eder:
  `expected integer, found floating-point number`.
```

Alanların farklı tiplerde olabilmesini istiyorsan **iki** tip parametresi kullanırsın:

```rust
struct Nokta<T, U> {
    x: T,
    y: U,
}

fn main() {
    let a = Nokta { x: 5, y: 4.0 }; // Nokta<i32, f64>
    let b = Nokta { x: "e", y: 4 }; // Nokta<&str, i32> — satranç karesi: e4
    let c = Nokta { x: 'k', y: 'k' }; // Nokta<char, char> — T ile U aynı da olabilir
    println!("a: ({}, {})", a.x, a.y);
    println!("b: {}{}", b.x, b.y);
    println!("c: {}{}", c.x, c.y);
}
```

:::tip Kaç tip parametresi fazladır?
İstediğin kadar tip parametresi kullanabilirsin, ama `<A, B, C, D, E>` gibi uzun listeler genellikle yapının
fazla iş üstlendiğinin ve daha küçük parçalara bölünmesi gerektiğinin işaretidir.

Ters yönde bir kural da var: Bir struct'a bildirdiğin her tip parametresini en az bir alanda kullanmak
zorundasın. `struct Kimlik<T> { no: u32 }` yazarsan `E0392` (*type parameter `T` is never used*) alırsın.
Bir tipi alan tutmadan “etiket” olarak taşımanın yolu (`PhantomData`) Modül 22'de.
:::

## Generic enum'lar: `Option<T>` ve `Result<T, E>`

Haberin olmadan generic enum'lar kullanıyordun. Standart kütüphanedeki tanımlar aslında bu kadar kısa
(sadeleştirilmiş hâlleri):

```rust
pub enum Option<T> {
    None,
    Some(T),
}

pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

`Option<T>`, “ya bir `T` var ya da yok” fikrini **her tip için bir kez** ifade eder. `Result<T, E>` iki tip
parametresi alır: başarı değerinin tipi `T`, hatanın tipi `E`. Modül 10'da `Result<i32, ParseIntError>`
yazdığında `T = i32`, `E = ParseIntError` seçmiştin. `Vec<T>` ve `HashMap<K, V>` ise generic struct'lardır.

Kendi generic enum'umuzu yazalım: bir dosya indirmenin durumunu tutan `Indirme<T>`. İndirilen veri bir
resim adı (`String`), bir dosya boyutu (`u64`) ya da başka bir şey olabilir:

```rust
enum Indirme<T> {
    Bekliyor,
    Suruyor(u8), // yüzde
    Bitti(T),
    Hata(String),
}

fn durum_yaz<T: std::fmt::Debug>(d: &Indirme<T>) -> String {
    match d {
        Indirme::Bekliyor => String::from("sırada bekliyor"),
        Indirme::Suruyor(yuzde) => format!("%{yuzde} indirildi"),
        Indirme::Bitti(veri) => format!("tamam: {veri:?}"),
        Indirme::Hata(mesaj) => format!("HATA: {mesaj}"),
    }
}

fn main() {
    let profil: Indirme<String> = Indirme::Bitti(String::from("ayse.png"));
    let video: Indirme<u64> = Indirme::Suruyor(45);
    let sirada: Indirme<u64> = Indirme::Bekliyor;
    let kopuk: Indirme<u64> = Indirme::Hata(String::from("bağlantı koptu"));
    println!("{}", durum_yaz(&profil));
    println!("{}", durum_yaz(&video));
    println!("{}", durum_yaz(&sirada));
    println!("{}", durum_yaz(&kopuk));
}
```

Varyantlardan yalnızca `Bitti(T)` tip parametresini kullanıyor; diğerleri her `T` için aynı. `durum_yaz`
ise generic bir **fonksiyon**: `veri`'yi `{:?}` ile yazdırdığı için `T: std::fmt::Debug` sınırını istiyor
(1. derste öğrendiğin kural: gövdede ne kullanıyorsan sınırda söz verilmiş olmalı).

```quiz
question: |
  (Modül 7 tekrarı) `let durum = Indirme::Bekliyor;` satırını tek başına yazar ve `durum`'u başka hiçbir yerde
  kullanmazsan ne olur?
options:
  - Derlenir; `T` varsayılan olarak `i32` olur
  - "`E0282`: tip notasyonu gerekir — `Bekliyor` varyantı `T` hakkında hiçbir ipucu taşımıyor"
  - Derlenir; veri taşımayan varyantların tipi olmaz
answer: 1
explanation: |
  `let x = None;` ile tamamen aynı durum! `None` da `Bekliyor` da `T` taşımadığı için derleyici `T`'yi
  çıkaramaz. Her değerin derleme zamanında **tek, kesin** bir tipi olmalıdır; `Indirme<String>` ile
  `Indirme<u64>` farklı tiplerdir. Çözüm 1. dersteki gibi: `let durum: Indirme<u64> = Indirme::Bekliyor;`
  ya da turbofish ile `Indirme::<u64>::Bekliyor`.
feedback:
  - Rust tip parametreleri için sessizce bir varsayılan seçmez (tam sayı sabitlerinin aksine).
  - "Doğru! Tıpkı `let x = None;` gibi."
  - "Tip, değerin tamamına aittir: `Bekliyor` bir `Indirme<T>` değeridir ve `T` belli olmalıdır."
```

## Metotlar: `impl<T>`

Generic bir struct'a metot eklerken `impl`'in hemen ardından da tip parametresini bildirirsin:

```rust
struct Nokta<T> {
    x: T,
    y: T,
}

impl<T> Nokta<T> {
    fn yeni(x: T, y: T) -> Self {
        Nokta { x, y }
    }

    fn x(&self) -> &T {
        &self.x
    }

    fn y(&self) -> &T {
        &self.y
    }
}

impl Nokta<f64> {
    fn orijine_uzaklik(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

fn main() {
    let p = Nokta::yeni(3.0, 4.0);
    println!("x = {}, uzaklık = {}", p.x(), p.orijine_uzaklik());

    let k = Nokta::yeni('a', 'b');
    println!("k.y = {}", k.y());
}
```

İki farklı `impl` bloğu var:

- **`impl<T> Nokta<T>`** — `impl`'den sonraki `<T>`, tıpkı fonksiyonlardaki gibi bir **bildirimdir**:
  “şimdi `T` adında bir tip parametresi tanıtıyorum.” Ardından gelen `Nokta<T>` bu `T`'yi **kullanır**.
  `<T>`'yi `impl`'den sonra yazmayı unutursan derleyici `T`'yi gerçek bir tip adı sanar ve
  `cannot find type T in this scope` der. Bu bloktaki metotlar **her** `Nokta<T>` için vardır.
- **`impl Nokta<f64>`** — burada `<T>` bildirilmiyor; somut bir tip yazıyoruz. Bu blok yalnızca
  `Nokta<f64>` için geçerlidir. `sqrt` yalnızca ondalıklı sayılarda olduğundan bu metodun `Nokta<char>`'da
  olması zaten anlamsız olurdu.

Getter'ların adı, Modül 6'daki gelenekle alanla aynıdır (`x()`), `get_x()` değil.

:::warning Aynı adı “özelleştirmek” için kullanamazsın
`impl<T> Nokta<T>` içinde bir `goster` metodu varken `impl Nokta<f64>` içine **aynı adlı** ikinci bir
`goster` yazarsan derleyici bunu “`f64` için daha özel sürüm” olarak görmez. `Nokta<f64>` için iki
tanım birden olur ve `E0592` (*duplicate definitions with name `goster`*) alırsın. Rust'ta kararlı
(stable) bir *specialization* yok. Belirli tipe özel metotlara farklı ad ver.
:::

```compiles
code: |
  # struct Nokta<T> {
  #     x: T,
  #     y: T,
  # }
  #
  # impl<T> Nokta<T> {
  #     fn yeni(x: T, y: T) -> Self {
  #         Nokta { x, y }
  #     }
  # }
  #
  impl Nokta<f64> {
      fn orijine_uzaklik(&self) -> f64 {
          (self.x * self.x + self.y * self.y).sqrt()
      }
  }

  fn main() {
      let p = Nokta::yeni(3, 4);
      println!("{}", p.orijine_uzaklik());
  }
answer: false
error: E0599
explanation: |
  `Nokta::yeni(3, 4)` bir `Nokta<i32>` üretir (tam sayı sabitleri varsayılan olarak `i32`). `orijine_uzaklik`
  ise yalnızca `Nokta<f64>` için tanımlı. `Nokta::yeni(3.0, 4.0)` yazsaydın derlenirdi.
```

:::error
```text
error[E0599]: no method named `orijine_uzaklik` found for struct `Nokta<{integer}>` in the current scope
  --> src/main.rs:14:22
   |
 1 | struct Nokta<T> {
   | --------------- method `orijine_uzaklik` not found for this struct
...
14 |     println!("{}", p.orijine_uzaklik());
   |                      ^^^^^^^^^^^^^^^ method not found in `Nokta<{integer}>`
   |
   = note: the method was found for `Nokta<f64>`
```
`Nokta<{integer}>`: derleyici henüz hangi tam sayı tipi olduğuna karar vermemiş ama tam sayı olduğunu
biliyor. Son satırdaki `note:` asıl ipucu: “bu metot var, ama `Nokta<f64>` için.”
:::

```fill
prompt: |
  `Kutu<T>` **her tip** için bir `ac` metoduna, **yalnızca `Kutu<String>`** için de `uzunluk` metoduna sahip
  olsun. Boşlukları doldur.
code: |
  struct Kutu<T> {
      icerik: T,
  }

  impl___0 Kutu<T> {
      fn ac(self) -> T {
          self.icerik
      }
  }

  impl Kutu<___1> {
      fn uzunluk(&self) -> usize {
          self.icerik.len()
      }
  }

  fn main() {
      let mektup = Kutu { icerik: String::from("Merhaba!") };
      println!("{}", mektup.uzunluk());
      let hediye = Kutu { icerik: 42 };
      println!("{}", hediye.ac());
      println!("{}", mektup.ac());
  }
blanks:
  - ["<T>"]
  - ["String"]
output: |
  8
  42
  Merhaba!
explanation: |
  `impl<T> Kutu<T>` her tip için geçerli bir blok açar; `ac` kutuyu tüketir (`self`) ve içindekinin
  **sahipliğini** döndürür. `impl Kutu<String>` ise yalnızca `String` içeren kutular için:
  `len()` her `T`'de olmadığından `uzunluk` ancak burada yazılabilir. `hediye.uzunluk()` yazsaydın `E0599` alırdın.
```

## Metodun kendi generic'leri

Bir metot, struct'ın tip parametrelerinden **bağımsız** kendi tip parametrelerini de bildirebilir.
Aşağıdaki `karistir`, kendi noktasından `x`'i, diğer noktadan `y`'yi alıp yeni bir nokta kuruyor.
Önce tahmin et:

```predict
code: |
  struct Nokta<X1, Y1> {
      x: X1,
      y: Y1,
  }

  impl<X1, Y1> Nokta<X1, Y1> {
      fn karistir<X2, Y2>(self, diger: Nokta<X2, Y2>) -> Nokta<X1, Y2> {
          Nokta { x: self.x, y: diger.y }
      }
  }

  fn main() {
      let p1 = Nokta { x: 5, y: 10.4 };
      let p2 = Nokta { x: String::from("Merhaba"), y: 'c' };
      let p3 = p1.karistir(p2);
      println!("p3.x = {}, p3.y = {}", p3.x, p3.y);
  }
options:
  - "p3.x = 5, p3.y = c"
  - "p3.x = 5, p3.y = 10.4"
  - "p3.x = Merhaba, p3.y = c"
  - Derlenmez — bir metot yeni tip parametreleri bildiremez
answer: 0
explanation: |
  `p1` bir `Nokta<i32, f64>`, `p2` bir `Nokta<String, char>`. `karistir` `self`'ten `x`'i (`5`), `diger`'den
  `y`'yi (`'c'`) alır; sonuç bir `Nokta<i32, char>` olur. `X1`/`Y1` **struct'a** aittir (`impl`'den sonra
  bildirildi), `X2`/`Y2` ise yalnızca **bu metoda** aittir (metot adından sonra bildirildi).
```

Değişkenlerin kapsamı gibi düşün: `X1`, `Y1` bütün `impl` bloğunda geçerlidir; `X2`, `Y2` yalnızca
`karistir`'in imzasında ve gövdesinde. Peki bellekte neler oldu? `karistir`, `self`'i ve `diger`'i **değer
olarak** (sahipliğini alarak) kabul ediyor:

```memory
title: p1.karistir(p2) — sahiplik nereye gitti?
steps:
  - caption: "Çağrıdan önce: `p1` tamamen stack'te; `p2.x` bir `String`, karakterleri heap'te."
    stack:
      - frame: main
        vars:
          - { name: p1, type: "Nokta<i32, f64>", value: "x=5 · y=10.4" }
          - { name: p2, type: "Nokta<String, char>", value: "x: ptr·len=7·cap=7 · y='c'", to: h1 }
    heap:
      - { id: h1, value: "M e r h a b a" }
  - caption: "`karistir` içinde: `p1` ve `p2` metoda **taşındı** (`self` ve `diger` oldular). `main`'deki adlar artık geçersiz."
    stack:
      - frame: main
        vars:
          - { name: p1, type: "Nokta<i32, f64>", value: "x=5 · y=10.4", moved: true }
          - { name: p2, type: "Nokta<String, char>", value: "x: ptr·len=7·cap=7 · y='c'", moved: true }
      - frame: karistir
        vars:
          - { name: self, type: "Nokta<i32, f64>", value: "x=5 · y=10.4" }
          - { name: diger, type: "Nokta<String, char>", value: "x: ptr·len=7·cap=7 · y='c'", to: h1 }
    heap:
      - { id: h1, value: "M e r h a b a" }
  - caption: "Dönüşten sonra: `p3` = `self.x` + `diger.y`. Kullanılmayan `diger.x` (String) metot bitince **drop edildi** ve heap belleği serbest kaldı."
    stack:
      - frame: main
        vars:
          - { name: p1, type: "Nokta<i32, f64>", value: "x=5 · y=10.4", moved: true }
          - { name: p2, type: "Nokta<String, char>", value: "x: ptr·len=7·cap=7 · y='c'", moved: true }
          - { name: p3, type: "Nokta<i32, char>", value: "x=5 · y='c'" }
    heap:
      - { id: h1, value: "M e r h a b a", freed: true }
```

```compiles
question: "(Modül 4 tekrarı) `karistir`'den sonra `p1`'in bir alanını okumaya çalışırsak bu kod derlenir mi?"
code: |
  # struct Nokta<X1, Y1> {
  #     x: X1,
  #     y: Y1,
  # }
  #
  # impl<X1, Y1> Nokta<X1, Y1> {
  #     fn karistir<X2, Y2>(self, diger: Nokta<X2, Y2>) -> Nokta<X1, Y2> {
  #         Nokta { x: self.x, y: diger.y }
  #     }
  # }
  #
  fn main() {
      let p1 = Nokta { x: 5, y: 10.4 };
      let p2 = Nokta { x: String::from("Merhaba"), y: 'c' };
      let p3 = p1.karistir(p2);
      println!("{} {}", p3.x, p3.y);
      println!("{}", p1.x);
  }
answer: false
error: E0382
explanation: |
  `karistir(self, ...)` `p1`'i **tüketir**: sahiplik metoda taşınır. Alanlarının (`i32` ve `f64`) `Copy`
  olması bir şey değiştirmez; **struct'ın kendisi** `Copy` değil, çünkü öyle olduğunu söylemedik.
  (Bir struct'ı `Copy` yapmayı 5. derste `derive` ile öğreneceksin.) Taşınmış değeri kullanmak: `E0382`.
```

## Monomorfizasyon: generic'lerin bedeli var mı?

Bu kadar esneklik çalışma zamanında yavaşlığa yol açar mı? **Hayır.** Rust generic kodu derlerken
**monomorfizasyon (monomorphization)** uygular: programda kullanılan **her somut tip için** kodun ayrı,
özel bir kopyasını üretir. 1. dersteki `en_buyuk<T: PartialOrd>`'u `i32` ve `char` ile çağırdığında
derleyici, o dersin başında **elle yazdığın** iki fonksiyonu perde arkasında senin yerine yazar:

```rust,ignore
// Derleyicinin ürettiği kodun kavramsal hâli (gerçekte bu iş derleyicinin içinde olur):
fn en_buyuk_i32(liste: &[i32]) -> &i32 { /* ... aynı gövde ... */ }
fn en_buyuk_char(liste: &[char]) -> &char { /* ... aynı gövde ... */ }

enum Option_i32 { Some(i32), None }   // Option<i32> için
enum Option_f64 { Some(f64), None }   // Option<f64> için
```

:::analogy Matbaa kalıbı
Bir matbaada düğün davetiyesi kalıbı var: *“Sayın ____, düğünümüze davetlisiniz.”* Kalıp tek, ama matbaa
her misafir için boşluğu doldurup **ayrı, gerçek davetiyeler** basar. Davetiyeyi alan kişi boşluklu bir
kalıp değil, kendi adının basılı olduğu kartı görür.

Generic kod kalıptır; monomorfizasyon matbaadır. Derleyici `Nokta<i32>` ve `Nokta<f64>` için ayrı ayrı,
tamamen somut kod “basar”. Program çalışırken ortada kalıp yoktur, yalnızca baskılar vardır — bu yüzden
hiçbir ek maliyet de yoktur. Bedeli mi? Her misafire ayrı baskı yapıldığı için **kâğıt** (programın
dosya boyutu) ve **baskı süresi** (derleme süresi) artar.
:::

Her somut tip gerçekten ayrı bir tiptir ve **kendi bellek düzenine** sahiptir. Bunu kendi gözünle gör:
`std::mem::size_of::<T>()` bir tipin kaç bayt yer kapladığını söyler. (Argümanı olmayan bir generic
fonksiyon — turbofish şart! Bellek düzenini Modül 24'te derinlemesine göreceğiz.)

```rust
# #![allow(dead_code)]
use std::mem::size_of;

struct Nokta<T> {
    x: T,
    y: T,
}

fn main() {
    println!("Nokta<u8>     : {} bayt", size_of::<Nokta<u8>>());
    println!("Nokta<i32>    : {} bayt", size_of::<Nokta<i32>>());
    println!("Nokta<f64>    : {} bayt", size_of::<Nokta<f64>>());
    println!("Nokta<String> : {} bayt", size_of::<Nokta<String>>());
}
```

```memory
title: Nokta<i32> ve Nokta<String> bellekte
steps:
  - caption: "`a` 8 bayttır ve tamamen stack'tedir. `b` 48 bayttır: içindeki iki `String`'in her biri 24 baytlık bir başlıktır (işaretçi, uzunluk, kapasite); karakterler heap'tedir. Hiçbir kutulama yok — değerler doğrudan struct'ın içinde duruyor."
    stack:
      - frame: main
        vars:
          - { name: a, type: "Nokta<i32>", value: "x=3 · y=4", note: "8 bayt" }
          - { name: b.x, type: String, value: "ptr · len=6 · cap=6", to: h1 }
          - { name: b.y, type: String, value: "ptr · len=6 · cap=6", to: h2, note: "b'nin tamamı 48 bayt" }
    heap:
      - { id: h1, value: "A n k a r a" }
      - { id: h2, value: "İ z m i r" }
```

**Diğer dillerle karşılaştırma:** Java'da `ArrayList<Integer>`, tip silme (type erasure) yüzünden aslında
heap'teki ayrı ayrı `Integer` nesnelerine işaretçiler tutar; her erişimde bir işaretçi takibi ve tip
dönüşümü vardır. Rust'ın `Vec<i32>`'si ise ham `i32`'leri yan yana tutar. C++ şablonları da monomorfizasyon
yapar; Rust'ın farkı, 1. derste gördüğün gibi gövdeyi önceden sınırlara göre denetlemesidir.

Rust'ın tasarım ilkesi buna **sıfır maliyetli soyutlama (zero-cost abstraction)** der: *kullanmadığın
şeyin bedelini ödemezsin; kullandığın şeyi de elle daha iyi yazamazdın.* Tek kopya kodla çalışma anında
karar veren alternatifi — trait nesneleri (`dyn Trait`) — Modül 20'de göreceksin.

```quiz
question: Monomorfizasyonun gerçek bedeli nedir?
options:
  - Generic fonksiyonlar her çağrıda tip kontrolü yaptığı için yavaştır
  - Generic tiplerin değerleri her zaman heap'te saklanır
  - Program dosyası büyüyebilir ve derleme uzayabilir; çalışma zamanı hızı etkilenmez
  - Generic kod, elle yazılmış koda göre daha az optimize edilir
answer: 2
explanation: |
  Her somut tip için ayrı kod üretildiğinden, bir generic fonksiyonu on farklı tiple kullanırsan on kopya
  derlenir: daha uzun derleme, daha büyük dosya. Karşılığında her kopya, o tipe özel yazılmış kod kadar
  hızlıdır; derleyici her kopyayı ayrı ayrı optimize edebilir (satır içi alma/inlining dahil).
feedback:
  - Çalışma zamanında tip kontrolü yoktur; tipler derlemede kesinleşir.
  - "`Nokta<i32>` tamamen stack'te durur; heap'e yalnızca `String` gibi tiplerin kendi verisi gider."
  - Doğru! Bedel derleme süresi ve dosya boyutunda ödenir.
  - Tersine — her kopya, o tipe özel yazılmış gibi ayrıca optimize edilir.
```

## Alıştırma: generic bir yığın

```exercise
id: m11-l02-e-yigin
title: "Geri Al (Ctrl+Z) yığını"
difficulty: 3
prompt: |
  Bir metin editörü için **geri alma geçmişi** tutacaksın. Geçmiş bir **yığın (stack)** olmalı: en son
  eklenen işlem ilk geri alınır (LIFO — *last in, first out*). Yığın generic olsun ki aynı yapı editörde
  metinler (`String`), bir çizim programında renk kodları (`u32`) için de kullanılabilsin.

  `Yigin<T>` struct'ı hazır. Sen `impl<T> Yigin<T>` bloğunu yaz ve şu metotları ekle:

  | metot | ne yapar |
  |---|---|
  | `fn yeni() -> Self` | boş bir yığın oluşturur |
  | `fn ekle(&mut self, deger: T)` | değeri yığının tepesine koyar |
  | `fn geri_al(&mut self) -> Option<T>` | tepedeki değeri **çıkarıp** döndürür; boşsa `None` |
  | `fn tepe(&self) -> Option<&T>` | tepedeki değere **bakar**, çıkarmaz; boşsa `None` |
  | `fn uzunluk(&self) -> usize` | eleman sayısı |
  | `fn bos_mu(&self) -> bool` | hiç eleman yoksa `true` |
starter: |
  struct Yigin<T> {
      elemanlar: Vec<T>,
  }

  // TODO: impl<T> Yigin<T> { ... } bloğunu buraya yaz.

  fn main() {
      // Metotları yazdıktan sonra burada deneyebilirsin:
      // let mut gecmis = Yigin::yeni();
      // gecmis.ekle(String::from("Merhaba"));
      // println!("{:?}", gecmis.geri_al());
  }
solution: |
  struct Yigin<T> {
      elemanlar: Vec<T>,
  }

  impl<T> Yigin<T> {
      fn yeni() -> Self {
          Yigin { elemanlar: Vec::new() }
      }

      fn ekle(&mut self, deger: T) {
          self.elemanlar.push(deger);
      }

      fn geri_al(&mut self) -> Option<T> {
          self.elemanlar.pop()
      }

      fn tepe(&self) -> Option<&T> {
          self.elemanlar.last()
      }

      fn uzunluk(&self) -> usize {
          self.elemanlar.len()
      }

      fn bos_mu(&self) -> bool {
          self.elemanlar.is_empty()
      }
  }

  fn main() {
      let mut gecmis = Yigin::yeni();
      gecmis.ekle(String::from("Merhaba"));
      gecmis.ekle(String::from("Merhaba dünya"));
      println!("{:?}", gecmis.tepe());
      println!("{:?}", gecmis.geri_al());
      println!("{} işlem kaldı, boş mu: {}", gecmis.uzunluk(), gecmis.bos_mu());
  }
check: tests
tests: |
  #[test]
  fn son_giren_ilk_cikar() {
      let mut y = Yigin::yeni();
      y.ekle(String::from("yaz"));
      y.ekle(String::from("sil"));
      y.ekle(String::from("kalın yap"));
      assert_eq!(y.geri_al(), Some(String::from("kalın yap")), "En son eklenen ilk çıkmalı (LIFO)");
      assert_eq!(y.geri_al(), Some(String::from("sil")), "Sonra bir öncekine sıra gelmeli");
      assert_eq!(y.uzunluk(), 1, "İki geri almadan sonra 1 işlem kalmalı");
  }

  #[test]
  fn bos_yiginda_none() {
      let mut y: Yigin<u32> = Yigin::yeni();
      assert!(y.bos_mu(), "Yeni yığın boş olmalı");
      assert_eq!(y.uzunluk(), 0, "Yeni yığının uzunluğu 0 olmalı");
      assert_eq!(y.geri_al(), None, "Boş yığından geri alma None dönmeli (panik değil!)");
      assert_eq!(y.tepe(), None, "Boş yığının tepesi None olmalı");
  }

  #[test]
  fn tepe_cikarmaz() {
      let mut y = Yigin::yeni();
      y.ekle(0xFF0000_u32);
      y.ekle(0x00FF00);
      assert_eq!(y.tepe(), Some(&0x00FF00), "Tepe, son eklenen renk olmalı");
      assert_eq!(y.tepe(), Some(&0x00FF00), "tepe() elemanı çıkarmamalı");
      assert_eq!(y.uzunluk(), 2, "tepe() uzunluğu değiştirmemeli");
      assert!(!y.bos_mu(), "İki elemanlı yığın boş değildir");
  }

  #[test]
  fn bosaltip_tekrar_doldurulabilir() {
      let mut y = Yigin::yeni();
      for i in 1..=3 {
          y.ekle(i);
      }
      while y.geri_al().is_some() {}
      assert!(y.bos_mu(), "Hepsi geri alınınca yığın boş olmalı");
      y.ekle(42);
      assert_eq!(y.tepe(), Some(&42), "Boşaldıktan sonra yeniden kullanılabilmeli");
  }
hints:
  - "Blok başlığı `impl<T> Yigin<T> {` olmalı. `yeni` içinde `Yigin { elemanlar: Vec::new() }` döndür."
  - "`Vec`'in hazır metotları işini görür: `push`, `pop` (zaten `Option<T>` döndürür), `len`, `is_empty`."
  - "`tepe` için `self.elemanlar.last()` kullan: son elemana `Option<&T>` olarak bakar, çıkarmaz."
explanation: |
  Yığın, `Vec<T>`'nin üstünde ince bir katman — ama **anlamlı bir arayüz**: kullanan kişi yığının ortasına
  dokunamaz, yalnızca tepeyle çalışır. Hiçbir metotta `T` hakkında bir şey varsaymadık (karşılaştırma,
  kopyalama, yazdırma yok); bu yüzden `impl<T>` bloğu **hiçbir trait sınırı** istemedi.

  İmzalar sahipliği net anlatıyor: `ekle` değerin sahipliğini **alır** (`T`), `geri_al` sahipliği çağırana
  **geri verir** (`Option<T>`), `tepe` ise yalnızca **ödünç verir** (`Option<&T>`). Testlerde aynı kodun
  hem `String` hem `u32` hem `i32` ile çalıştığını gördün — üç ayrı kopya da monomorfizasyonla üretildi.

  Not: `Yigin { elemanlar: Vec::new() }` yerine `Self { elemanlar: Vec::new() }` da yazabilirdin.
```

## Özet

:::remember
- `struct Ad<T> { alan: T }`, `enum Ad<T> { A(T), B }` — tip parametresi addan sonra bildirilir.
  `Option<T>`, `Result<T, E>`, `Vec<T>`, `HashMap<K, V>` hep bu şekilde tanımlanmıştır.
- `impl<T> Ad<T> { ... }` → metotlar **her** `T` için; `impl Ad<f64> { ... }` → yalnızca o somut tip için.
- Metotlar kendi tip parametrelerini bildirebilir: `fn karistir<X2, Y2>(self, ...)`.
- Veri taşımayan varyantlarda (`None`, `Bekliyor`) `T` çıkarılamazsa tip notasyonu gerekir (`E0282`).
- **Monomorfizasyon**: her somut tip için ayrı kod üretilir → çalışma zamanı maliyeti **sıfır**;
  bedel derleme süresi ve dosya boyutunda ödenir.
:::

```reflect
prompt: |
  Java'daki `ArrayList<Integer>` ile Rust'taki `Vec<i32>` bellekte nasıl farklı durur? Monomorfizasyon
  bu farkı nasıl mümkün kılıyor ve bunun bir bedeli var mı?
answer: |
  Java derlemeden sonra generic tip bilgisini siler; `ArrayList<Integer>` aslında heap'te ayrı ayrı duran
  `Integer` nesnelerine işaretçiler tutar. Her eleman için ayrı bir nesne, her erişimde de işaretçi takibi
  ve tip dönüşümü vardır.

  Rust ise `Vec<i32>` için özel kod üretir (monomorfizasyon) ve `i32`'leri yan yana, ham hâlleriyle saklar.
  Derleyici her somut tipin boyutunu ve düzenini bildiği için kutulamaya ya da çalışma zamanı kontrolüne gerek
  kalmaz. Bedeli: her farklı tip için kod tekrar üretildiğinden derleme süresi ve program boyutu artabilir.
```

```flashcards
- front: "`impl<T> Nokta<T>` satırında `impl`'den hemen sonraki `<T>` ne işe yarar?"
  back: "`T`'yi tip parametresi olarak **bildirir**. Yazılmazsa derleyici `T`'yi somut bir tip adı sanar ve bulamaz."
- front: "`impl Nokta<f64> { fn uzaklik(&self) -> f64 {...} }` — `uzaklik` hangi değerlerde çağrılabilir?"
  back: "Yalnızca `Nokta<f64>` değerlerinde. `Nokta<i32>` üzerinde çağırmak `E0599` verir."
- front: "`struct Nokta<T> { x: T, y: T }` ile `Nokta { x: 5, y: 4.0 }` neden derlenmez?"
  back: "Tek `T` var; iki alan aynı tipte olmalı (`E0308`). Farklı tipler için `Nokta<T, U>` gerekir."
- front: Monomorfizasyon nedir?
  back: Derleyicinin, generic kodun programda kullanılan her somut tip için ayrı, özel bir kopyasını üretmesi.
- front: Monomorfizasyonun bedeli hangi alanda ödenir?
  back: Çalışma zamanında değil; derleme süresinde ve ikili (binary) dosya boyutunda.
- front: "`let d = Indirme::Bekliyor;` neden tek başına derlenmez?"
  back: "`Bekliyor` varyantı `T` taşımaz; derleyici `T`'yi çıkaramaz (`E0282`). `let d: Indirme<u64> = ...` yaz."
- front: "`fn karistir<X2, Y2>(self, diger: Nokta<X2, Y2>) -> Nokta<X1, Y2>` — `X1` ve `X2` kime aittir?"
  back: "`X1` struct'a (`impl<X1, Y1>` ile bildirildi), `X2` yalnızca `karistir` metoduna."
```
