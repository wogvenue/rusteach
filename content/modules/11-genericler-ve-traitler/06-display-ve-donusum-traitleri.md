---
id: m11-l06
title: Display ve dönüşüm trait'leri
minutes: 21
type: lesson
objectives:
  - "Kendi tipin için `fmt::Display` uygulayıp onu `{}`, `to_string()` ve `format!` ile kullanabilmek"
  - "`From` uygulayarak `Into`'yu bedavaya alabilmek ve `impl Into<String>` gibi esnek parametreler yazabilmek"
  - "`as`, `From` ve `TryFrom` arasından kayıpsız, kayıplı ve başarısız olabilen dönüşümler için doğru olanı seçebilmek"
  - "`TryFrom` ile geçersiz değerleri daha oluşturulurken reddeden tipler tasarlayabilmek"
keywords: [Display, fmt, Formatter, "write!", to_string, From, Into, TryFrom, TryInto, as, E0277, E0282]
---

Modül 6'da `#[derive(Debug)]` yazınca `{:?}` hemen çalışmıştı, ama `{}` hep hata vermişti. Önceki derste
nedenini öğrendin: `Display` **türetilemez**, çünkü bir tipi kullanıcıya göstermenin tek bir doğru biçimi
yoktur. Bir sıcaklık “21.5°C” mi yazılmalı, “21,5 derece” mi? Buna sen karar verirsin.

Bu derste iki büyük işi bitiriyoruz: tiplerine bir **yüz** vermek (`Display`) ve tipler arasında **köprüler**
kurmak (`From`, `Into`, `TryFrom`). Modül 4'ten beri yazdığın `String::from("...")`'nun da aslında bir trait
metodu olduğunu göreceksin.

## Display: kullanıcıya göstermek

Bir hava durumu uygulamasında sıcaklığı ekrana yazdırmak istiyoruz. Önce tahmin et:

```compiles
code: |
  struct Sicaklik {
      derece: f64,
  }

  fn main() {
      let s = Sicaklik { derece: 21.5 };
      println!("Bugün hava {s}");
  }
answer: false
error: E0277
explanation: |
  `{}` yer tutucusu, değerin `std::fmt::Display` trait'ini uygulamasını ister. `Sicaklik` bunu
  uygulamıyor. `println!` sihirli değildir; arka planda 4. dersteki gibi bir **trait sınırı** denetler.
```

:::error
```text
error[E0277]: `Sicaklik` doesn't implement `std::fmt::Display`
 --> src/main.rs:7:26
  |
7 |     println!("Bugün hava {s}");
  |                          ^^^ `Sicaklik` cannot be formatted with the default formatter
  |
help: the trait `std::fmt::Display` is not implemented for `Sicaklik`
 --> src/main.rs:1:1
  |
1 | struct Sicaklik {
  | ^^^^^^^^^^^^^^^
  = note: in format strings you may be able to use `{:?}` (or `{:#?}` for pretty-print) instead
```
Yine tanıdık `E0277`: bir trait sınırı sağlanmadı. `note:` satırı kestirme bir yol öneriyor: `{:?}`.
Ama `Debug` çıktısı (`Sicaklik { derece: 21.5 }`) geliştirici içindir; kullanıcıya gösterilmez.
:::

`Display`'i elle uygulayalım. Trait'in tek bir zorunlu metodu vardır, `fmt`:

```rust
use std::fmt;

struct Sicaklik {
    derece: f64,
}

impl fmt::Display for Sicaklik {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}°C", self.derece)
    }
}

enum Hava {
    Gunesli,
    Yagmurlu,
    Karli,
}

impl fmt::Display for Hava {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Hava::Gunesli => write!(f, "güneşli"),
            Hava::Yagmurlu => write!(f, "yağmurlu"),
            Hava::Karli => write!(f, "karlı"),
        }
    }
}

fn main() {
    let bugun = Sicaklik { derece: 21.5 };
    let yarin = Sicaklik { derece: -3.0 };
    println!("Bugün {bugun}, hava {}", Hava::Gunesli);
    println!("Yarın {yarin}, hava {}", Hava::Karli);
    println!("Hafta sonu: {}", Hava::Yagmurlu);
}
```

İmzayı parça parça okuyalım:

- `f: &mut fmt::Formatter`, çıktının yazılacağı yer. `println!`, `format!` ya da bir dosya olabilir;
  senin bilmen gerekmez. (Bazı kodlarda `Formatter<'_>` görürsün; `'_` bir yaşam süresidir, Modül 12.)
- `write!(f, ...)`, `format!` gibi çalışır ama yeni bir `String` üretmek yerine doğrudan `f`'ye yazar.
- `fmt::Result`, yazma başarılı mı? `Result<(), fmt::Error>`'un kısa adıdır. `write!` zaten bunu
  döndürdüğü için son ifade olarak bırakman yeterli (Modül 3: noktalı virgülsüz son ifade).

`use std::fmt;` yazıp `fmt::Display`, `fmt::Formatter` demek, Modül 8'deki deyimsel kullanımdır:
`fmt::Result` ile bildiğimiz `Result` çakışmasın diye modülü içe aktar, öğeleri modül adıyla kullan.

:::analogy Mutfak ve servis tabağı
Bir restoranda aşçı mutfakta malzemeye bakarken her şeyi çiğ ve ayrıntılı görmek ister: kaç gram tuz, hangi
tencere, pişme derecesi. Müşteriye ise tabak **sunum** hâlinde gelir; tencereyi görmez. `Debug` mutfak
görünümüdür: tip adı, bütün alanlar, geliştirici için. `Display` servis tabağıdır: kullanıcı için
düzenlenmiş, tek bir biçim. Aynı yemeğin iki görünümü olabilir. Bu yüzden bir tipte ikisini birlikte
görmek çok yaygındır: `#[derive(Debug)]` ve elle yazılmış bir `impl Display`.
:::

## to_string ve biçimlendirme ayrıntıları

`Display`'i uyguladığın anda bir hediye alırsın: `to_string()` metodu. Hiç yazmadığın bu metot, `Display`
uygulayan **her** tipte kendiliğinden vardır. Standart kütüphane bunu tek bir genel `impl` ile sağlar;
nasıl mümkün olduğunu 8. derste (*blanket impl*) göreceksin.

```rust
# use std::fmt;
# struct Sicaklik {
#     derece: f64,
# }
# impl fmt::Display for Sicaklik {
#     fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
#         write!(f, "{}°C", self.derece)
#     }
# }
fn main() {
    let s = Sicaklik { derece: 30.0 };
    let metin: String = s.to_string();
    let rapor = format!("Ankara: {s} | Bursa: {}", Sicaklik { derece: 27.5 });
    println!("{metin} ({} bayt)", metin.len());
    println!("{rapor}");
}
```

`30.0` neden `30` olarak yazıldı? `f64`'ün kendi `Display`'i gereksiz `.0`'ı yazmaz. `{}°C`'deki `°` ise
UTF-8'de 2 bayt olduğu için “30°C” 5 bayttır (Modül 9).

Şimdi bir tablo hizalamak istiyoruz. Modül 1'deki genişlik ayarını (`{:>10}`) kendi tipimizde deneyelim.
Dikkatli düşün:

```predict
code: |
  use std::fmt;

  struct Sicaklik {
      derece: f64,
  }

  impl fmt::Display for Sicaklik {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}°C", self.derece)
      }
  }

  fn main() {
      let s = Sicaklik { derece: 21.5 };
      println!("[{:>10}]", "Ankara");
      println!("[{:>10}]", s);
  }
options:
  - |
    [    Ankara]
    [    21.5°C]
  - |
    [    Ankara]
    [21.5°C]
  - |
    [Ankara]
    [21.5°C]
answer: 1
explanation: |
  Sürpriz! `&str` genişliği uyguladı, bizim tipimiz uygulamadı. Genişlik, hizalama ve hassasiyet
  (`{:>10}`, `{:.1}`) `Formatter`'ın içinde **seçenek** olarak durur. Bunlara uyup uymamak `fmt`'yi
  yazanın sorumluluğudur. `write!(f, ...)` ise yeni bir biçimlendirme başlatır ve bu seçenekleri
  görmezden gelir.
```

Çözüm `f.pad`: verilen metni, çağıranın istediği genişlik ve hizalamayla yazar. `&str`'nin kendi `Display`'i
de tam olarak bunu yapar:

```rust
use std::fmt;

struct Sicaklik {
    derece: f64,
}

impl fmt::Display for Sicaklik {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let metin = format!("{}°C", self.derece);
        f.pad(&metin) // genişlik ve hizalamaya uyar
    }
}

fn main() {
    let sehirler = [("Ankara", 21.5), ("Erzurum", -8.0), ("Antalya", 31.0)];
    for (sehir, derece) in sehirler {
        let s = Sicaklik { derece };
        println!("{sehir:<8}|{s:>8}|");
    }
}
```

:::deep Hassasiyeti (`{:.1}`) desteklemek
`Formatter`, çağıranın ne istediğini sorabileceğin metotlar sunar: `f.width()` ve `f.precision()`
`Option<usize>` döndürür (istenmediyse `None`), `f.alternate()` ise `{:#}` yazılıp yazılmadığını `bool`
olarak söyler. Dikkat: `f.pad` hassasiyeti metne uygular, yani **keser**: `f.pad` kullanan bir tipte
`{:.2}` yazılırsa `21.5°C` metni `21` olarak görünür. Sayının ondalık hanesine uymak için hassasiyeti
kendin okumalısın:

```rust,ignore
match f.precision() {
    Some(h) => write!(f, "{:.*}°C", h, self.derece), // {:.*}: hassasiyeti argümandan al
    None => write!(f, "{}°C", self.derece),
}
```
Çoğu tip için bu kadarına gerek yoktur. Ama kütüphane yazıyorsan, kullanıcıların tablolarında hizalama
yapabilmesi için en azından `f.pad`'i düşün.
:::

## From ve Into: tipler arası köprü

Modül 4'ten beri yazdığın `String::from("merhaba")` aslında bir trait metodudur: standart kütüphanede
`impl From<&str> for String` vardır. `From<T>` şu sözü verir: *“Bir `T`'den kendimi **her zaman**,
başarısız olmadan oluşturabilirim.”* Standart kütüphane bu trait'i yüzlerce yerde uygular:

```rust
fn main() {
    let a = String::from("çay"); // &str → String
    let b = i64::from(42_i32); // i32 → i64 (kayıpsız genişletme)
    let c = f64::from(7_u8); // u8 → f64
    let d = u32::from('ş'); // char → Unicode kod noktası
    let e = char::from(65_u8); // u8 → char ('A')
    println!("{a} {b} {c} {d} {e}");
}
```

Kendi tiplerin için de uygulayabilirsin. Türkiye'de sıcaklık Celsius ile ölçülür ama bir Amerikan hava
servisi Fahrenheit istiyor:

```rust
#[derive(Debug)]
struct Celsius(f64);

#[derive(Debug)]
struct Fahrenheit(f64);

impl From<Celsius> for Fahrenheit {
    fn from(c: Celsius) -> Self {
        Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)
    }
}

fn main() {
    let kaynama = Fahrenheit::from(Celsius(100.0));
    let vucut: Fahrenheit = Celsius(36.6).into(); // Into: bedava!
    println!("{kaynama:?}");
    println!("Vücut ısısı: {:.1} °F", vucut.0);
}
```

Yalnızca `From` yazdık ama `.into()` da çalıştı. Standart kütüphanede şöyle genel bir kural var:
*“`U`, `From<T>` uyguluyorsa `T` de `Into<U>` uygular.”* İkisi aynı köprünün iki yönüdür: `From`, hedef
tipin bakış açısıdır (`Fahrenheit::from(c)`), `Into` ise kaynağın (`c.into()`). **Kural: daima `From`'u
uygula; `Into` kendiliğinden gelir.** (Bu kuralın nasıl yazıldığını 8. derste göreceksin.)

`.into()`'nun bir inceliği var. Tahmin et:

```compiles
code: |
  # struct Celsius(f64);
  # struct Fahrenheit(f64);
  # impl From<Celsius> for Fahrenheit {
  #     fn from(c: Celsius) -> Self {
  #         Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)
  #     }
  # }
  fn main() {
      let c = Celsius(100.0);
      let f = c.into();
      println!("{}", f.0);
  }
answer: false
error: E0282
explanation: |
  `into` generic bir dönüşümdür: `Celsius` başka tiplere de dönüşebilirdi (kendi `Into` sözleşmesi
  olan her tip). Hedef belli değilse derleyici seçemez. 1. dersteki `bos_liste()` gibi, tip bir yerden
  gelmeli: `let f: Fahrenheit = c.into();` ya da daha açık olan `Fahrenheit::from(c)`.
```

:::error
```text
error[E0282]: type annotations needed
  --> src/main.rs:10:9
   |
10 |     let f = c.into();
   |         ^
11 |     println!("{}", f.0);
   |                    - type must be known at this point
   |
help: consider giving `f` an explicit type
   |
10 |     let f: /* Type */ = c.into();
   |          ++++++++++++
```
`.into()` turbofish almaz (`c.into::<Fahrenheit>()` derlenmez), çünkü tip parametresi metotta değil
trait'in kendisinde (`Into<U>`). Hedefi ya değişkene yazarsın ya da `From` tarafını kullanırsın.
:::

### Esnek parametreler: `impl Into<String>`

`Into`'nun en yaygın kullanımı parametrelerdedir. Bir öğrenci kaydı oluşturan fonksiyon, hem `&str` hem
`String` kabul etsin:

```rust
#[derive(Debug)]
struct Ogrenci {
    ad: String,
    no: u32,
}

impl Ogrenci {
    fn yeni(ad: impl Into<String>, no: u32) -> Self {
        Ogrenci { ad: ad.into(), no }
    }
}

fn main() {
    let a = Ogrenci::yeni("Ayşe", 101); // &str
    let isim = String::from("Mehmet");
    let b = Ogrenci::yeni(isim, 102); // String
    println!("{a:?}");
    println!("{b:?}");
    println!("{} ve {} kayıtlı (no: {}, {})", a.ad, b.ad, a.no, b.no);
}
```

Neden `ad: &str` alıp içeride `ad.to_string()` demiyoruz? Çünkü çağıranın elinde zaten bir `String`
varsa, `impl Into<String>` onu **olduğu gibi taşır**; yeni bellek ayırmaz:

```memory
title: "Ogrenci::yeni: &str ile String arasındaki fark"
steps:
  - caption: "`yeni(\"Ayşe\", 101)`: `ad` bir `&str`; programın içindeki sabit metni gösteriyor. `ad.into()` heap'te **yeni** bir alan ayırıp baytları oraya kopyalar."
    stack:
      - frame: yeni
        vars:
          - { name: ad, type: "&str", value: "ptr · len=5", to: s1 }
          - { name: "Ogrenci.ad", type: String, value: "ptr · len=5 · cap=5", to: h1, note: "yeni ayrıldı" }
    heap:
      - { id: s1, value: "A y ş e", label: "programın içinde (statik)" }
      - { id: h1, value: "A y ş e" }
  - caption: "`yeni(isim, 102)`: `isim` zaten bir `String`. Sahiplik fonksiyona **taşınır** ve `ad.into()` hiçbir şey kopyalamaz (`String`'den `String`'e dönüşüm boş bir işlemdir). Aynı heap verisi artık öğrencinin."
    stack:
      - frame: main
        vars:
          - { name: isim, type: String, value: "ptr · len=6 · cap=6", moved: true }
      - frame: yeni
        vars:
          - { name: "Ogrenci.ad", type: String, value: "ptr · len=6 · cap=6", to: h2 }
    heap:
      - { id: h2, value: "M e h m e t" }
```

```quiz
question: "`fn yeni(ad: impl Into<String>, no: u32)` için aşağıdaki çağrılardan **hangileri** derlenir?"
options:
  - "`Ogrenci::yeni(\"Elif\", 1)`"
  - "`Ogrenci::yeni(String::from(\"Elif\"), 1)`"
  - "`Ogrenci::yeni('E', 1)`"
  - "`Ogrenci::yeni(42, 1)`"
answer: [0, 1, 2]
explanation: |
  `impl Into<String>`, “`String`'e dönüştürülebilen her tip” demektir. Standart kütüphanede
  `From<&str>`, `From<String>` (kendine dönüşüm) ve `From<char>` uygulamaları vardır; hepsi
  kendiliğinden `Into<String>` verir. Tam sayıdan `String`'e `From` yoktur, çünkü bir sayıyı metne çevirmenin
  bir **biçimi** vardır (ondalık mı, onaltılık mı?). Onun için `42.to_string()` kullanılır: `Display` üzerinden.
feedback:
  - "Doğru: `String: From<&str>`."
  - "Doğru: her tip kendine dönüşebilir; `String`, `From<String>`'i de uygular."
  - "Doğru! `String: From<char>` var; sonuç tek harfli bir metin olur."
  - "`String: From<i32>` yoktur (`E0277`). Sayıyı metne çevirmek için `to_string()` kullan."
```

Bu köprüyü Modül 10'da da kullanmıştın: `?` operatörü hatayı `From::from(hata)` ile
fonksiyonun hata tipine dönüştürüyordu. `&str` hatasının `String` hatasına kendiliğinden dönüşmesinin
sebebi `String: From<&str>`'ydi. Bir sonraki derste kendi hata tiplerin için `From` yazıp bu mekanizmayı
tamamen otomatikleştireceksin.

## as, From ve kayıp

Sayılar arasında dönüşüm için Modül 2'de `as` öğrenmiştin. Hatırla ve tahmin et:

```predict
question: "(Modül 2 tekrarı) Bu program ne yazdırır?"
code: |
  fn main() {
      let a = 300_u32 as u8;
      let b = -1_i32 as u32;
      let c = 3.99_f64 as i32;
      println!("{a} {b} {c}");
  }
options:
  - "44 4294967295 3"
  - "255 0 4"
  - "300 -1 3.99"
  - Derlenmez, değerler hedef tipe sığmıyor
answer: 0
explanation: |
  `as` **hiçbir zaman** hata vermez, ama sessizce bilgi kaybedebilir. `300 as u8` üst bitleri atar:
  300 − 256 = 44. `-1 as u32` aynı bitleri işaretsiz okur: 4 294 967 295. `3.99 as i32` ondalığı keser
  (yuvarlamaz): 3. Derleyici bunların hepsine izin verir, çünkü `as` “ne yaptığımı biliyorum” demektir.
  Ondalıktan tam sayıya `as` ise sarmaz, **sınıra yapışır** (saturate): `300.0 as u8` 255, `-5.0 as u8`
  0, `f64::NAN as i32` 0 olur. Yani `300.0` ve `-1.0` yazsaydın ikinci seçeneğin “255 0” kısmı doğru
  olurdu; ama `as` yine yuvarlamazdı (3.99 → 3).
```

`From` ise yalnızca **kayıpsız** dönüşümler için vardır. `u8` her zaman bir `u32`'ye sığar, bu yüzden
`u32::from(x_u8)` vardır. Tersi?

```compiles
code: |
  fn main() {
      let buyuk: u32 = 300;
      let kucuk = u8::from(buyuk);
      println!("{kucuk}");
  }
answer: false
error: E0277
explanation: |
  Standart kütüphane `impl From<u32> for u8` yazmamıştır, çünkü bu dönüşüm her zaman başarılı **olamaz**.
  `From` bir sözdür: “asla başarısız olmam, asla bilgi kaybetmem.” Bu söz tutulamıyorsa `From` yoktur.
```

:::error
```text
error[E0277]: the trait bound `u8: From<u32>` is not satisfied
 --> src/main.rs:3:17
  |
3 |     let kucuk = u8::from(buyuk);
  |                 ^^ the trait `From<u32>` is not implemented for `u8`
  |
help: `u8` implements trait `From<T>`
  ...  `From<bool>`
  ...  `From<std::ascii::Char>`
```
(Mesaj kısaltıldı.) `help:` bölümü `u8`'in hangi tiplerden `From` ile oluşturulabildiğini listeliyor:
`bool` gibi, her zaman sığan küçük tipler. `u32` listede yok.
:::

Üç aracın ne zaman kullanılacağı:

| Araç | Başarısız olabilir mi? | Bilgi kaybı | Ne zaman? |
|---|---|---|---|
| `as` | Hayır | **Sessizce** olabilir | Bilerek kesme/sarma istediğinde; sayısal ilkel tipler arasında |
| `From` / `Into` | Hayır | Asla | Her zaman başarılı olan dönüşümler |
| `TryFrom` / `TryInto` | **Evet** → `Result` | Asla; sığmıyorsa `Err` | Değer hedefe sığmayabiliyorsa |

## TryFrom: başarısız olabilen dönüşüm

`TryFrom`, `From`'un `Result` döndüren kardeşidir. Standart kütüphane bütün tam sayı çiftleri için uygular:

```rust
fn main() {
    println!("{:?}", u8::try_from(200_u32)); // sığar
    println!("{:?}", u8::try_from(300_u32)); // sığmaz
    println!("{:?}", u32::try_from(-5_i32)); // negatif, sığmaz

    let yas: i64 = 34;
    let kucuk: u8 = yas.try_into().unwrap_or(u8::MAX); // TryInto: bedava
    println!("{kucuk}");
}
```

`TryInto`, `Into` gibi kendiliğinden gelir ve prelude'dadır; `use` gerekmez.

Asıl güç kendi tiplerinde ortaya çıkar. Modül 10'da öğrendin: geçersiz değerlerin **hiç oluşmaması**
için tipi doğrulayan bir kurucu yazarsın. `TryFrom` bu kurucunun **standart adıdır**: Rust bilen herkes
`Not::try_from(x)` ya da `x.try_into()` görünce ne olduğunu anlar.

```rust
#[derive(Debug)]
struct Not(u8);

impl TryFrom<i32> for Not {
    type Error = String;

    fn try_from(deger: i32) -> Result<Self, Self::Error> {
        if (0..=100).contains(&deger) {
            Ok(Not(deger as u8)) // kontrolden sonra `as` güvenli
        } else {
            Err(format!("{deger} geçerli bir not değil (0-100 olmalı)"))
        }
    }
}

fn main() {
    if let Ok(not) = Not::try_from(85) {
        println!("Geçerli not: {}", not.0);
    }
    println!("{:?}", Not::try_from(120));
    let sonuc: Result<Not, String> = (-5_i32).try_into();
    println!("{sonuc:?}");
}
```

Yeni bir satır var: `type Error = String;`. Bu, trait'in senden istediği bir **ilişkili tip
(associated type)**: “Dönüşüm başarısız olursa hangi hata tipini döndüreceksin?” Sen `String` seçtin.
İmzadaki `Self::Error` da bu seçime işaret eder. İlişkili tipleri Modül 14'te (`Iterator`'ın `Item`'ı) ve
Modül 22'de ayrıntılı göreceksin. Şimdilik “trait'i uygularken doldurduğun bir tip boşluğu” olarak düşün.

```fill
prompt: |
  Bir otoparkta kat numarası 1 ile 5 arasında olabilir. `Kat` için `TryFrom<u8>` uygulamasını tamamla.
code: |
  #[derive(Debug)]
  struct Kat(u8);

  impl TryFrom<u8> for Kat {
      type ___0 = String;

      fn try_from(n: u8) -> Result<Self, ___1> {
          if (1..=5).contains(&n) {
              ___2
          } else {
              Err(format!("{n}. kat yok"))
          }
      }
  }

  fn main() {
      println!("{:?}", Kat::try_from(3));
      println!("{:?}", Kat::try_from(9));
  }
blanks:
  - ["Error"]
  - ["Self::Error", "String"]
  - ["Ok(Kat(n))", "Ok(Self(n))"]
output: |
  Ok(Kat(3))
  Err("9. kat yok")
explanation: |
  İlişkili tipin adı trait tarafından belirlenir: `TryFrom` için `Error`'dur (`FromStr` için ise `Err`,
  bir sonraki ders). Dönüş tipinde `Self::Error` yazmak, seçtiğin hata tipini tekrar etmekten iyidir:
  hata tipini değiştirirsen imzayı düzeltmen gerekmez. Başarılı dalda değeri `Ok` ile sarmayı unutma.
```

:::tip `TryFrom` yazınca `From` yazma
Bir tipe hem `From<u8>` hem `TryFrom<u8>` yazamazsın: `From` varsa standart kütüphane `TryFrom`'u zaten
“hiç başarısız olmayan” bir sürüm olarak kendiliğinden verir ve ikisi çakışır. Dönüşüm bazen başarısız
olabiliyorsa yalnızca `TryFrom` yaz; asla başarısız olmuyorsa yalnızca `From`.
:::

## Alıştırmalar

Önce `Display` ile kısa bir ısınma, sonra üç trait'i birlikte kullanan bir problem.

```exercise
id: m11-l06-e-tarife
title: Tren tarifesi panosu
difficulty: 2
prompt: |
  Bir tren istasyonunun pano yazılımı için iki tipe `Display` uygula:

  - `Saat` → her zaman iki haneli `SS:DD` biçimi: `Saat { saat: 9, dakika: 5 }` → `09:05`
  - `Sefer` → `<nereden> → <nereye> | <kalkış> - <varış>` biçimi, örneğin
    `Ankara → İstanbul | 09:05 - 13:30`

  `Sefer`'in `fmt`'si içinde `Saat` değerlerini `{}` ile yazdırarak **ilk impl'i yeniden kullan**; iki
  haneli biçimlendirmeyi tekrar yazma. (Modül 1: `{:02}` sayıyı iki haneye sıfırla tamamlar.)
starter: |
  use std::fmt;

  struct Saat {
      saat: u8,
      dakika: u8,
  }

  struct Sefer {
      nereden: String,
      nereye: String,
      kalkis: Saat,
      varis: Saat,
  }

  impl fmt::Display for Saat {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  impl fmt::Display for Sefer {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      let s = Sefer {
          nereden: String::from("Ankara"),
          nereye: String::from("İstanbul"),
          kalkis: Saat { saat: 9, dakika: 5 },
          varis: Saat { saat: 13, dakika: 30 },
      };
      println!("{s}");
  }
solution: |
  use std::fmt;

  struct Saat {
      saat: u8,
      dakika: u8,
  }

  struct Sefer {
      nereden: String,
      nereye: String,
      kalkis: Saat,
      varis: Saat,
  }

  impl fmt::Display for Saat {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{:02}:{:02}", self.saat, self.dakika)
      }
  }

  impl fmt::Display for Sefer {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{} → {} | {} - {}", self.nereden, self.nereye, self.kalkis, self.varis)
      }
  }

  fn main() {
      let s = Sefer {
          nereden: String::from("Ankara"),
          nereye: String::from("İstanbul"),
          kalkis: Saat { saat: 9, dakika: 5 },
          varis: Saat { saat: 13, dakika: 30 },
      };
      println!("{s}");
  }
check: tests
tests: |
  #[test]
  fn saat_iki_haneli_yazilir() {
      assert_eq!(Saat { saat: 9, dakika: 5 }.to_string(), "09:05", "Tek haneli saat ve dakikanın başına 0 eklenmeli");
      assert_eq!(Saat { saat: 23, dakika: 59 }.to_string(), "23:59", "İki haneli değerler olduğu gibi kalmalı");
      assert_eq!(Saat { saat: 0, dakika: 0 }.to_string(), "00:00", "Gece yarısı 00:00 olmalı");
  }

  #[test]
  fn sefer_panoda_dogru_gorunur() {
      let s = Sefer {
          nereden: String::from("İzmir"),
          nereye: String::from("Eskişehir"),
          kalkis: Saat { saat: 7, dakika: 45 },
          varis: Saat { saat: 14, dakika: 0 },
      };
      assert_eq!(s.to_string(), "İzmir → Eskişehir | 07:45 - 14:00", "Biçim: <nereden> → <nereye> | <kalkış> - <varış>");
  }

  #[test]
  fn format_ile_de_calisir() {
      let s = Saat { saat: 18, dakika: 3 };
      assert_eq!(format!("Kalkış: {s}"), "Kalkış: 18:03", "Display uygulanınca format! içinde {{}} ile kullanılabilmeli");
  }
hints:
  - "`Saat` için `write!(f, \"...\", self.saat, self.dakika)` kullan. İki haneli sıfır dolgulu biçim `{:02}`'dir."
  - "`Sefer`'de `self.kalkis` ve `self.varis`'i doğrudan `{}` ile yazdırabilirsin; çünkü artık `Saat` de `Display` uyguluyor."
  - "`write!(f, \"{} → {} | {} - {}\", self.nereden, self.nereye, self.kalkis, self.varis)`"
forbid:
  - pattern: "(kalkis|varis)\\s*\\.\\s*(saat|dakika)"
    message: "`Sefer` içinde saat ve dakikaya tek tek erişme: `Saat`'in `Display`'ini `{}` ile yeniden kullan."
explanation: |
  `Sefer`'in `fmt`'si `Saat`'in nasıl biçimlendirildiğini bilmiyor; yalnızca `{}` ile ondan kendini
  yazmasını istiyor. Bu, trait'lerle **kompozisyondur**: her tip kendi gösterimini bilir, büyük tipler
  küçüklerinkini kullanır. Saat biçimini (örneğin 12 saatlik sisteme) değiştirmek istersen tek bir yeri
  düzeltirsin.

  Testlerde `to_string()` kullandık ama sen onu hiç yazmadın: `Display` uygulayan her tipte hazır gelir.
  `format!` ve `println!` de aynı `fmt` metodunu çağırır.
```

```exercise
id: m11-l06-e-plaka
title: Plaka il kodları
difficulty: 3
prompt: |
  Türkiye'de araç plakaları il koduyla başlar: 01 (Adana) ile 81 (Düzce) arası. Bir trafik uygulaması için
  `IlKodu` tipini **geçersiz değer taşıyamayacak** şekilde tasarlıyoruz.

  1. **`TryFrom<u8> for IlKodu`**: `0` için `Err(PlakaHatasi::Sifir)`, `81`'den büyük değerler için
     `Err(PlakaHatasi::AralikDisi(deger))`, aksi hâlde `Ok`.
  2. **`From<IlKodu> for u8`**: kodu geri sayıya çevir (her zaman başarılı olduğu için `From`).
  3. **`Display for IlKodu`**: her zaman iki hane: `6` → `"06"`, `34` → `"34"`.
starter: |
  use std::fmt;

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct IlKodu(u8);

  #[derive(Debug, PartialEq)]
  enum PlakaHatasi {
      Sifir,
      AralikDisi(u8),
  }

  impl TryFrom<u8> for IlKodu {
      type Error = PlakaHatasi;

      fn try_from(deger: u8) -> Result<Self, Self::Error> {
          todo!()
      }
  }

  impl From<IlKodu> for u8 {
      fn from(kod: IlKodu) -> u8 {
          todo!()
      }
  }

  impl fmt::Display for IlKodu {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      match IlKodu::try_from(6) {
          Ok(kod) => println!("Plaka: {kod} ABC 123"),
          Err(e) => println!("Hata: {e:?}"),
      }
  }
solution: |
  use std::fmt;

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct IlKodu(u8);

  #[derive(Debug, PartialEq)]
  enum PlakaHatasi {
      Sifir,
      AralikDisi(u8),
  }

  impl TryFrom<u8> for IlKodu {
      type Error = PlakaHatasi;

      fn try_from(deger: u8) -> Result<Self, Self::Error> {
          if deger == 0 {
              Err(PlakaHatasi::Sifir)
          } else if deger > 81 {
              Err(PlakaHatasi::AralikDisi(deger))
          } else {
              Ok(IlKodu(deger))
          }
      }
  }

  impl From<IlKodu> for u8 {
      fn from(kod: IlKodu) -> u8 {
          kod.0
      }
  }

  impl fmt::Display for IlKodu {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{:02}", self.0)
      }
  }

  fn main() {
      match IlKodu::try_from(6) {
          Ok(kod) => println!("Plaka: {kod} ABC 123"),
          Err(e) => println!("Hata: {e:?}"),
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_kodlar_kabul_edilir() {
      assert_eq!(IlKodu::try_from(1), Ok(IlKodu(1)), "01 (Adana) geçerli");
      assert_eq!(IlKodu::try_from(34), Ok(IlKodu(34)), "34 (İstanbul) geçerli");
      assert_eq!(IlKodu::try_from(81), Ok(IlKodu(81)), "81 (Düzce) son geçerli kod");
  }

  #[test]
  fn gecersiz_kodlar_reddedilir() {
      assert_eq!(IlKodu::try_from(0), Err(PlakaHatasi::Sifir), "0 için Sifir hatası dönmeli");
      assert_eq!(IlKodu::try_from(82), Err(PlakaHatasi::AralikDisi(82)), "82 artık aralık dışı");
      assert_eq!(IlKodu::try_from(255), Err(PlakaHatasi::AralikDisi(255)), "Hata, gelen değeri taşımalı");
  }

  #[test]
  fn try_into_de_calisir() {
      let kod: Result<IlKodu, PlakaHatasi> = 6_u8.try_into();
      assert_eq!(kod, Ok(IlKodu(6)), "TryFrom yazınca try_into bedava gelmeli");
  }

  #[test]
  fn iki_haneli_gosterim() {
      assert_eq!(IlKodu(6).to_string(), "06", "Tek haneli kodun başına 0 eklenmeli");
      assert_eq!(IlKodu(35).to_string(), "35", "İki haneli kod olduğu gibi yazılmalı");
  }

  #[test]
  fn sayiya_geri_donusum() {
      assert_eq!(u8::from(IlKodu(16)), 16, "From<IlKodu> for u8 kodun sayısını vermeli");
      let n: u8 = IlKodu(81).into();
      assert_eq!(n, 81, "From yazınca into da bedava gelmeli");
  }
hints:
  - "`try_from`'da üç durum var: `deger == 0`, `deger > 81` ve geri kalanı. `if / else if / else` ile her birinde `Err(...)` ya da `Ok(IlKodu(deger))` döndür."
  - "`From<IlKodu> for u8` içinde tuple struct'ın ilk alanı `kod.0`'dır. `Display` için `write!(f, \"{:02}\", self.0)`."
  - "`AralikDisi` hatası gelen değeri taşımalı: `Err(PlakaHatasi::AralikDisi(deger))`."
explanation: |
  Artık `IlKodu` tipinde bir değer gördüğün her yerde onun **geçerli** olduğundan eminsin: tek oluşturma
  yolu `try_from` ve o da kontrol ediyor. (Gerçek bir projede `IlKodu`'yu bir modüle koyup alanı gizli
  bırakırdın; Modül 8: `IlKodu(99)` dışarıdan yazılamazdı.)

  Yönler bilinçli seçildi: `u8 → IlKodu` başarısız olabilir → `TryFrom`; `IlKodu → u8` asla başarısız olmaz →
  `From`. İkisini de yazınca `try_into` ve `into` bedavaya geldi.

  Hata tipini `String` yerine bir **enum** yapmak, çağıranın hatayı `match` ile ayırt etmesini sağlar
  (Modül 10). Testler de bu sayede tam olarak hangi hatanın döndüğünü denetleyebildi. Bir sonraki derste bu
  enum'a `Display` ve `Error` ekleyip onu tam teşekküllü bir hata tipine çevireceğiz.
```

## Özet

:::remember
- `impl fmt::Display for Tip { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, ...) } }`
  → `{}`, `format!` ve bedava `to_string()`.
- `write!` genişlik ve hizalama seçeneklerini yok sayar; bunlara uymak için `f.pad(&metin)` kullan.
- `From<T>`: asla başarısız olmayan, kayıpsız dönüşüm. **Daima `From`'u uygula**, `Into` kendiliğinden gelir.
  `.into()` için hedef tip belli olmalı (`E0282`).
- `impl Into<String>` parametresi hem `&str` hem `String` kabul eder; `String` gelirse kopyalamadan taşır.
- `as` sessizce keser; `From` yalnızca sığan dönüşümlerde var (`u8: From<u32>` yok → `E0277`);
  `TryFrom` → `Result`, `type Error = ...;` ile hata tipini seçersin.
:::

```reflect
prompt: |
  `300_u32 as u8`, `u8::from(300_u32)` ve `u8::try_from(300_u32)` arasındaki farkı kendi cümlelerinle
  açıkla. Bir banka uygulamasında bir tutarı daha küçük bir tipe çevirirken hangisini seçerdin, neden?
answer: |
  `as` her zaman derlenir ve çalışır ama sığmayan değeri sessizce keser: 300 → 44. `u8::from(300_u32)` hiç
  derlenmez, çünkü `From` yalnızca her zaman başarılı olan kayıpsız dönüşümler için tanımlıdır ve `u32 → u8`
  böyle değildir. `u8::try_from(300_u32)` derlenir ve `Err` döndürür: dönüşümün başarısız olabileceğini
  tipte gösterir, beni bu durumu ele almaya zorlar.

  Banka uygulamasında `try_from` seçerdim. Sessizce 300 TL'yi 44 TL'ye çeviren bir hata çok tehlikeli ve
  fark edilmesi zor olurdu. `Result` ise hatayı görünür kılar, `?` ile yayılabilir ya da kullanıcıya mesaj
  olarak gösterilebilir.
```

```flashcards
- front: "`Display` trait'inin zorunlu metodunun imzası nedir?"
  back: "`fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result`"
- front: "`Display` uygulayan bir tipe hangi metot bedavaya gelir?"
  back: "`to_string()` (ve tabii `{}` ile `format!`/`println!` kullanımı)."
- front: "Kendi `Display`'inde `write!` kullandın ama `{:>10}` hizalaması çalışmıyor. Neden, çözüm ne?"
  back: "`write!` `Formatter`'daki genişlik seçeneğini yok sayar. Metni `f.pad(&metin)` ile yazarsan genişliğe ve hizalamaya uyulur."
- front: "`From` mu uygulanır, `Into` mu? Neden?"
  back: "`From`. Standart kütüphane `U: From<T>` olan her yerde `T: Into<U>`'yu kendiliğinden sağlar."
- front: "`let f = c.into();` neden `E0282` verir?"
  back: "`into` her `Into<U>` hedefi için çalışabilir; hedef tip belli değil. `let f: Fahrenheit = c.into();` ya da `Fahrenheit::from(c)` yaz."
- front: "Neden `u8::from(300_u32)` derlenmez ama `u32::from(7_u8)` derlenir?"
  back: "`From` yalnızca asla başarısız olmayan dönüşümler için var; her `u32` bir `u8`'e sığmaz. Bunun için `u8::try_from(x)` kullanılır."
- front: "`impl TryFrom<i32> for Not` içinde `type Error = String;` satırı ne anlama gelir?"
  back: "Dönüşüm başarısız olunca dönecek hata tipini seçer (ilişkili tip). İmzada `Self::Error` diye kullanılır."
- front: "Parametreyi `ad: impl Into<String>` yapmanın `ad: &str` yapmaya göre avantajı nedir?"
  back: "Çağıranın elinde zaten bir `String` varsa kopyalamadan taşınır; `&str` gelirse de `into()` onu `String`'e çevirir."
```
