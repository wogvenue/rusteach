---
id: m11-l04
title: Trait sınırları
minutes: 19
type: lesson
objectives:
  - "`&impl Trait` ve `<T: Trait>` sözdizimleriyle trait sınırlı fonksiyonlar yazabilmek ve aralarındaki farkı açıklayabilmek"
  - "`+` ile çoklu sınır ve `where` cümlesiyle okunaklı imzalar kurabilmek"
  - "`-> impl Trait` dönüş tipini ve “tek somut tip” kuralını açıklayabilmek"
  - Yalnızca belirli sınırları sağlayan tipler için koşullu metot (`impl<T: Display + PartialOrd> Cift<T>`) yazabilmek
keywords: [trait sınırı, trait bound, "impl Trait", where, çoklu sınır, koşullu impl, E0277, statik dispatch]
---

Önceki derste `Ozet` trait'ini tanımlayıp `Haber` ve `Gonderi` tiplerine uyguladık. Ama bu trait'i
**kullanan** bir fonksiyon henüz yazmadık — priz benzetmesindeki “priz” eksik. Bu derste 1. dersteki trait
sınırlarını (`T: PartialOrd`) kendi trait'lerimizle birleştiriyoruz: *“`Ozet` uygulayan her tipi kabul eden”*
fonksiyonlar. Böylece generic'ler ile trait'ler sonunda buluşuyor.

## Parametre olarak trait: `&impl Ozet`

```rust
trait Ozet {
    fn ozetle(&self) -> String;
}

struct Haber {
    baslik: String,
}

struct Gonderi {
    kullanici: String,
    icerik: String,
}

impl Ozet for Haber {
    fn ozetle(&self) -> String {
        format!("Haber: {}", self.baslik)
    }
}

impl Ozet for Gonderi {
    fn ozetle(&self) -> String {
        format!("@{}: {}", self.kullanici, self.icerik)
    }
}

fn bildir(oge: &impl Ozet) {
    println!("🔔 Yeni içerik! {}", oge.ozetle());
}

fn main() {
    let h = Haber { baslik: String::from("Erzurum'da kar kalınlığı 1 metreyi aştı") };
    let g = Gonderi {
        kullanici: String::from("dagci"),
        icerik: String::from("Palandöken'de kayak zamanı!"),
    };
    bildir(&h);
    bildir(&g);
}
```

`oge: &impl Ozet` şöyle okunur: *“`oge`, `Ozet` trait'ini uygulayan **herhangi bir** tipe referanstır.”*
Gövdede `oge` ile yalnızca `Ozet`'in vaat ettiğini yapabilirsin (`ozetle`). `oge.baslik` yazamazsın,
çünkü her `Ozet` tipinin bir başlığı yoktur — 1. dersteki iş ilanı kuralı.

Sözleşmeye uymayan bir tip verirsek ne olur?

```compiles
code: |
  # trait Ozet {
  #     fn ozetle(&self) -> String;
  # }
  #
  struct Hava {
      derece: i32,
  }

  fn bildir(oge: &impl Ozet) {
      println!("Yeni: {}", oge.ozetle());
  }

  fn main() {
      let h = Hava { derece: 21 };
      bildir(&h);
      println!("{}", h.derece);
  }
answer: false
error: E0277
explanation: |
  `Hava` `Ozet`'i uygulamıyor, yani `bildir`'in sözleşmesini sağlamıyor. Dikkat: hata fonksiyonun içinde
  değil, **çağrı yerinde** çıkar. Gövde zaten `Ozet` varsayımıyla denetlenmişti; şimdi denetlenen, çağıranın
  sözünü tutup tutmadığı.
```

:::error
```text
error[E0277]: the trait bound `Hava: Ozet` is not satisfied
  --> src/main.rs:15:12
   |
15 |     bildir(&h);
   |     ------ ^^ unsatisfied trait bound
   |     |
   |     required by a bound introduced by this call
   |
help: the trait `Ozet` is not implemented for `Hava`
  --> src/main.rs:9:1
   |
 9 | struct Hava {
   | ^^^^^^^^^^^
note: required by a bound in `bildir`
  --> src/main.rs:5:22
   |
 5 | fn bildir(oge: &impl Ozet) {
   |                      ^^^^ required by this bound in `bildir`
```
`E0277` trait sınırı hatalarının genel kodudur ve onu çok göreceksin. Okuma sırası: **kim** sağlamıyor
(`Hava`), **neyi** sağlamıyor (`Ozet`), **kim** istiyor (`note: required by a bound in bildir`).
:::

## Uzun yazım: `<T: Ozet>`

`impl Ozet` aslında bir kısaltmadır. Uzun hâli, 1. derste öğrendiğin generic fonksiyonun ta kendisi:

```rust
# pub trait Ozet {
#     fn ozetle(&self) -> String;
# }
// İkisi de aynı anlamda:
pub fn bildir_kisa(oge: &impl Ozet) {
    println!("{}", oge.ozetle());
}

pub fn bildir_uzun<T: Ozet>(oge: &T) {
    println!("{}", oge.ozetle());
}
```

Basit durumlarda `impl Ozet` daha okunaklıdır. Fark, **birden fazla** parametre olunca ortaya çıkar. Her
`impl Trait` parametresi kendi gizli tip parametresini oluşturur; `<T: Ozet>` ise **tek bir** `T`'yi
birden çok yerde kullanmana izin verir:

```text
fn karsilastir(a: &impl Ozet, b: &impl Ozet)   // a ile b FARKLI tipler olabilir
fn karsilastir<T: Ozet>(a: &T, b: &T)           // a ile b AYNI tip olmak ZORUNDA
```

```quiz
question: |
  `karsilastir(&haber, &gonderi)` çağrısı (bir `Haber` ve bir `Gonderi`, ikisi de `Ozet` uyguluyor)
  aşağıdaki imzalardan **hangileriyle** derlenir?
options:
  - "`fn karsilastir(a: &impl Ozet, b: &impl Ozet)`"
  - "`fn karsilastir<T: Ozet>(a: &T, b: &T)`"
  - "`fn karsilastir<T: Ozet, U: Ozet>(a: &T, b: &U)`"
answer: [0, 2]
explanation: |
  İki ayrı `impl Ozet`, iki ayrı gizli tip parametresi demektir; bu yüzden ilk imza aslında üçüncüyle
  **aynıdır**. İkinci imzada ise tek bir `T` var: ilk argüman `T = Haber` yapar, ikincisi `Gonderi`
  olduğu için `E0308` (*expected `&Haber`, found `&Gonderi`*) alırsın.
feedback:
  - Doğru — her `impl Ozet` kendi tipini seçer.
  - "Tek bir `T` var; `Haber` ve `Gonderi` aynı anda `T` olamaz (`E0308`)."
  - "Doğru — `T` ve `U` bağımsız; bu, ilk imzanın uzun yazımıdır."
```

Bir incelik: turbofish yalnızca **adı konmuş** tip parametrelerine verilebilir. `bildir_uzun::<Haber>(&h)`
yazabilirsin, ama `impl Ozet` parametresinin tipini turbofish ile belirtemezsin.

Peki parametre referans değil de **değer** olursa? Generic olmak sahiplik kurallarını değiştirir mi?

```compiles
question: "(Modül 4 tekrarı) Bu kez parametre `&impl Ozet` değil, `impl Ozet`. Derlenir mi?"
code: |
  # trait Ozet {
  #     fn ozetle(&self) -> String;
  # }
  # struct Haber {
  #     baslik: String,
  # }
  # impl Ozet for Haber {
  #     fn ozetle(&self) -> String {
  #         format!("Haber: {}", self.baslik)
  #     }
  # }
  fn bildir(oge: impl Ozet) {
      println!("Yeni: {}", oge.ozetle());
  }

  fn main() {
      let h = Haber { baslik: String::from("Kars'ta kaşar festivali başladı") };
      bildir(h);
      bildir(h);
  }
answer: false
error: E0382
explanation: |
  `oge: impl Ozet` değeri **sahiplenerek** alır: ilk `bildir(h)` çağrısı `h`'yi fonksiyona taşır ve fonksiyon
  bitince değer drop edilir. İkinci çağrı taşınmış bir değeri kullanmaya çalışır. Generic'ler sahiplik
  kurallarını değiştirmez! Değeri yalnızca okuyacaksan `&impl Ozet` al ve `bildir(&h)` diye çağır.
```

Son olarak bu fonksiyonların nasıl derlendiğini hatırla: trait sınırlı generic'ler de **monomorfizasyona**
uğrar. `bildir(&h)` için `Haber`'e, `bildir(&g)` için `Gonderi`'ye özel bir kopya üretilir ve `ozetle`
çağrısı derleme zamanında doğrudan doğru fonksiyona bağlanır. Buna **statik dağıtım (static dispatch)**
denir: çalışma anında “acaba hangi `ozetle`?” sorusu hiç sorulmaz.

## Birden fazla sınır ve `where`

Bazen bir tipin **birkaç** yeteneğe birden sahip olmasını istersin. Sınırları `+` ile birleştir:

```rust
use std::fmt::Debug;

trait Ozet {
    fn ozetle(&self) -> String;
}

#[derive(Debug)]
struct Haber {
    baslik: String,
    okunma: u32,
}

impl Ozet for Haber {
    fn ozetle(&self) -> String {
        format!("{} ({} okunma)", self.baslik, self.okunma)
    }
}

fn incele(oge: &(impl Ozet + Debug)) {
    println!("Özet : {}", oge.ozetle());
    println!("Debug: {oge:?}");
}

fn main() {
    let h = Haber { baslik: String::from("Hamsi sezonu başladı"), okunma: 1250 };
    incele(&h);
}
```

`&(impl Ozet + Debug)`'daki parantezler şart: onlarsız `&impl Ozet + Debug` belirsiz olur. Generic hâli:
`fn incele<T: Ozet + Debug>(oge: &T)`.

Sınırlar çoğaldıkça imza okunmaz hâle gelir:

```text
fn rapor<T: Ozet + Debug + Clone, U: Display + PartialOrd>(a: &T, b: &U) -> String
```

**`where` cümlesi (where clause)** sınırları imzanın sonuna taşır; fonksiyonun adı, parametreleri ve dönüş
tipi bir bakışta görünür:

```text
fn rapor<T, U>(a: &T, b: &U) -> String
where
    T: Ozet + Debug + Clone,
    U: Display + PartialOrd,
```

:::analogy Dalış okulunun katılım şartları
Bir dalış okulunun broşürü: *“Yüzme bilen **ve** sağlık raporu olan herkes kayıt olabilir.”* Kayıt masasındaki
görevli belgelerini kapıda kontrol eder; eksikse seni orada geri çevirir, eğitmenin dersinde değil. İçeride
eğitmen de herkesin yüzebildiğini **varsayarak** ders verir, kimseye tek tek sormaz. Şartlar uzayınca broşürün
en altına ayrı bir “Katılım şartları” kutusu konur. Bazı ileri kurslar ise yalnızca ek sertifikası olanlara açıktır.

Rust'taki karşılıkları: `T: Yuzme + SaglikRaporu` çoklu sınırdır; kapıdaki kontrol, çağrı yerindeki `E0277`'dir;
eğitmenin varsayımı, gövdenin sınırlara güvenmesidir; “Katılım şartları” kutusu `where` cümlesidir; ileri kurslar
da birazdan göreceğin **koşullu metotlardır**.
:::

Gerçek bir örnek: değerleri yazdıran ve en büyüğünü köşeli paranteze alan bir tablo fonksiyonu. `Display`,
`{}` ile yazdırılabilen tiplerin trait'idir (sayılar, `&str`, `String`...); kendi tiplerin için nasıl
uygulanacağını 6. derste göreceksin.

```rust
use std::fmt::Display;

fn tabloya_yaz<T>(baslik: &str, degerler: &[T])
where
    T: Display + PartialOrd,
{
    if degerler.is_empty() {
        println!("{baslik}: (veri yok)");
        return;
    }
    let mut en_buyuk = &degerler[0];
    for d in degerler {
        if d > en_buyuk {
            en_buyuk = d;
        }
    }
    print!("{baslik}:");
    for d in degerler {
        if d >= en_buyuk {
            print!(" [{d}]");
        } else {
            print!(" {d}");
        }
    }
    println!();
}

fn main() {
    tabloya_yaz("Sıcaklık", &[18, 24, 31, 27]);
    tabloya_yaz("Meyve", &["elma", "zeytin", "kiraz"]);
    let bos: [f64; 0] = [];
    tabloya_yaz("Yağış", &bos);
}
```

Şimdi aynı fonksiyona Türkçe harfler verelim. Dikkatli düşün:

```predict
code: |
  use std::fmt::Display;

  fn tabloya_yaz<T>(baslik: &str, degerler: &[T])
  where
      T: Display + PartialOrd,
  {
      // ... yukarıdaki gövdenin aynısı ...
  #     if degerler.is_empty() {
  #         println!("{baslik}: (veri yok)");
  #         return;
  #     }
  #     let mut en_buyuk = &degerler[0];
  #     for d in degerler {
  #         if d > en_buyuk {
  #             en_buyuk = d;
  #         }
  #     }
  #     print!("{baslik}:");
  #     for d in degerler {
  #         if d >= en_buyuk {
  #             print!(" [{d}]");
  #         } else {
  #             print!(" {d}");
  #         }
  #     }
  #     println!();
  }

  fn main() {
      tabloya_yaz("Harf", &['ç', 'z', 'a']);
  }
options:
  - "Harf: ç [z] a"
  - "Harf: [ç] z a"
  - "Harf: ç z [a]"
answer: 1
explanation: |
  Sürpriz! `char` değerleri Türk alfabesindeki sıraya göre değil, **Unicode kod noktalarına** göre
  karşılaştırılır (Modül 2: `char` bir Unicode skaler değeridir). `'z'` U+007A (122), `'ç'` ise U+00E7 (231);
  yani `'ç' > 'z'`. `PartialOrd` tipin **kendi** sıralamasını kullanır; Türkçe sözlük sırası gerekiyorsa
  bunu ayrıca kodlaman gerekir.
```

Şimdi sıra sende: satırları sıralayarak `where` cümleli bir fonksiyon kur.

```parsons
prompt: |
  `T`'nin hem yazdırılabilir (`Display`) hem karşılaştırılabilir (`PartialOrd`) olmasını isteyen ve iki
  değerden büyük olanı yazdıran fonksiyonu kur. Dikkat: iki satır tuzak.
lines: |
  use std::fmt::Display;
  fn buyugu_yaz<T>(a: T, b: T)
  where
      T: Display + PartialOrd,
  {
      let buyuk = if a > b { a } else { b };
      println!("Büyük olan: {buyuk}");
  }
distractors: |
  fn buyugu_yaz(a: T, b: T)
      T: Display, PartialOrd,
explanation: |
  Tip parametresi fonksiyon adından sonra `<T>` ile **bildirilmeli** (tuzak 1 bildirmiyor). `where`'den sonra
  her tip parametresi için bir satır gelir ve sınırlar `+` ile birleştirilir (tuzak 2 virgül kullanıyor;
  virgül `where`'de farklı tip parametrelerinin sınırlarını ayırır). Gövde `>` ve `{}` kullandığı için iki
  sınır da gerekli.
```

## Dönüş tipi olarak `impl Trait`

`impl Trait` dönüş tipinde de kullanılabilir:

```rust
# trait Ozet {
#     fn ozetle(&self) -> String;
# }
#
# struct Gonderi {
#     kullanici: String,
#     icerik: String,
# }
#
# impl Ozet for Gonderi {
#     fn ozetle(&self) -> String {
#         format!("@{}: {}", self.kullanici, self.icerik)
#     }
# }
#
fn gunun_gonderisi() -> impl Ozet {
    Gonderi {
        kullanici: String::from("rustacean_tr"),
        icerik: String::from("Bugün trait sınırlarını bitiriyoruz!"),
    }
}

fn main() {
    let g = gunun_gonderisi();
    println!("{}", g.ozetle());
}
```

Çağıran yalnızca *“`Ozet` uygulayan bir şey”* aldığını bilir; somut tipin `Gonderi` olduğunu bilmez ve
buna güvenemez (`g.kullanici` yazamaz). Neden yararlı?

1. **Uygulama ayrıntısını gizler:** Yarın `Gonderi` yerine başka bir `Ozet` tipi döndürürsen çağıranların
   kodu değişmez.
2. **Adı yazılamayan tipler:** Closure'lar ve iterator zincirleri (Modül 14) öyle karmaşık tipler üretir ki
   `-> impl Iterator<Item = u32>` demek tek pratik yoldur.

:::deep `-> impl Trait` neyi gizlemez?
Çağıran somut tipin adını ve metotlarını göremez, ama iki şey yine de görünür. Birincisi, `Send` ve
`Sync` gibi **otomatik trait'ler** (Modül 18) gizli tipten kendiliğinden “sızar”: gizli tip `Send` ise
dönen değer de `Send` sayılır. İkincisi, Rust 2024 sürümünde (edition) gizli tip, kapsamdaki **tüm**
generic parametreleri ve yaşam sürelerini *yakalar* (capture); bunu daraltmak için
`-> impl Trait + use<..>` sözdizimi vardır. Yaşam sürelerini Modül 12'de, bu inceliklerin ayrıntısını
Modül 22'de göreceksin.
:::

Ama bir sınırı var. `Haber` ve `Gonderi` ikisi de `Ozet` uyguluyor (gizli satırlarda). Bu fonksiyon derlenir mi?

```compiles
code: |
  # trait Ozet {
  #     fn ozetle(&self) -> String;
  # }
  # struct Haber;
  # struct Gonderi;
  # impl Ozet for Haber {
  #     fn ozetle(&self) -> String {
  #         String::from("haber")
  #     }
  # }
  # impl Ozet for Gonderi {
  #     fn ozetle(&self) -> String {
  #         String::from("gönderi")
  #     }
  # }
  fn icerik_uret(haber_mi: bool) -> impl Ozet {
      if haber_mi {
          Haber
      } else {
          Gonderi
      }
  }

  fn main() {
      println!("{}", icerik_uret(true).ozetle());
  }
answer: false
error: E0308
explanation: |
  `-> impl Ozet` “`Ozet` uygulayan **herhangi bir şey**” değil, “`Ozet` uygulayan **tek, gizli, somut bir tip**”
  demektir. Bu tipe derleme zamanında karar verilir; bir dal `Haber`, öteki `Gonderi` döndüremez.
```

:::error
```text
error[E0308]: `if` and `else` have incompatible types
  --> src/main.rs:17:9
   |
14 | /     if haber_mi {
15 | |         Haber
   | |         ----- expected because of this
16 | |     } else {
17 | |         Gonderi
   | |         ^^^^^^^ expected `Haber`, found `Gonderi`
18 | |     }
   | |_____- `if` and `else` have incompatible types
   |
help: you could change the return type to be a boxed trait object
   |
13 - fn icerik_uret(haber_mi: bool) -> impl Ozet {
13 + fn icerik_uret(haber_mi: bool) -> Box<dyn Ozet> {
   |
```
Derleyici bir çözüm öneriyor: **trait nesnesi** (`Box<dyn Ozet>`). Bu, tipi çalışma anında belirleyen
dinamik bir mekanizmadır ve Modül 20'nin konusu. Bugünkü bilgilerinle diğer çözüm: seçenekleri bir
**enum**'da toplamak (Modül 7) — `enum Icerik { H(Haber), G(Gonderi) }`.
:::

## Koşullu metotlar

Trait sınırlarını `impl` bloklarına da koyabilirsin. Böylece generic bir tipin bazı metotları yalnızca
**belirli yeteneklere sahip** `T`'ler için var olur:

```rust
use std::fmt::Display;

struct Cift<T> {
    x: T,
    y: T,
}

impl<T> Cift<T> {
    fn yeni(x: T, y: T) -> Self {
        Self { x, y }
    }
}

impl<T: Display + PartialOrd> Cift<T> {
    fn buyugu_goster(&self) {
        if self.x >= self.y {
            println!("En büyük: x = {}", self.x);
        } else {
            println!("En büyük: y = {}", self.y);
        }
    }
}

fn main() {
    Cift::yeni(3, 8).buyugu_goster();
    Cift::yeni("zeytin", "armut").buyugu_goster();
}
```

`yeni` **her** `Cift<T>` için vardır; `buyugu_goster` ise yalnızca `T` hem `Display` hem `PartialOrd`
olduğunda. Peki yazdırılamayan ve karşılaştırılamayan bir tiple denersek?

```compiles
code: |
  # use std::fmt::Display;
  #
  # struct Cift<T> {
  #     x: T,
  #     y: T,
  # }
  #
  # impl<T> Cift<T> {
  #     fn yeni(x: T, y: T) -> Self {
  #         Self { x, y }
  #     }
  # }
  #
  # impl<T: Display + PartialOrd> Cift<T> {
  #     fn buyugu_goster(&self) {
  #         if self.x >= self.y {
  #             println!("En büyük: x = {}", self.x);
  #         } else {
  #             println!("En büyük: y = {}", self.y);
  #         }
  #     }
  # }
  #
  struct Renk(u8, u8, u8);

  fn main() {
      let c = Cift::yeni(Renk(255, 0, 0), Renk(0, 0, 255));
      c.buyugu_goster();
  }
answer: false
error: E0599
explanation: |
  `Cift::yeni` sorunsuz çalışır (o blokta sınır yok), ama `buyugu_goster` yalnızca `Display + PartialOrd`
  olan `T`'ler için tanımlı. `Renk` ikisini de uygulamıyor; metot bu tip için **yok**.
```

:::error
```text
error[E0599]: the method `buyugu_goster` exists for struct `Cift<Renk>`, but its trait bounds were not satisfied
  --> src/main.rs:28:7
   |
24 | struct Renk(u8, u8, u8);
   | ----------- doesn't satisfy `Renk: PartialOrd` or `Renk: std::fmt::Display`
...
28 |     c.buyugu_goster();
   |       ^^^^^^^^^^^^^ method cannot be called on `Cift<Renk>` due to unsatisfied trait bounds
   |
note: the following trait bounds were not satisfied:
      `Renk: PartialOrd`
      `Renk: std::fmt::Display`
```
2. ve 3. derste gördüğün `E0599`'lardan (metot o tip için hiç yok / trait kapsamda değil) farklı olarak
mesaj “metot **var**, ama sınırlar sağlanmadı” diyor ve eksik sınırları tek tek listeliyor. (Tam mesajda derleyici `#[derive(PartialEq, PartialOrd)]` eklemeyi de
öneriyor — `derive` bir sonraki dersin konusu.)
:::

:::tip Sınırları struct'a değil, impl'e koy
`struct Cift<T: Display + PartialOrd>` diye de yazabilirdin, ama o zaman `Cift<T>`'den söz eden **her**
`impl` bloğu ve generic fonksiyon (yalnızca `yeni`'yi içeren blok bile) bu sınırları yeniden yazmak
zorunda kalır. `Cift<Renk>` gibi bir değer ise hiç oluşturulamaz. Genel kural: sınırı, ona gerçekten
ihtiyaç duyan `impl` bloğuna ya da fonksiyona koy. Standart kütüphane de böyle yapar: `Vec<T>`'nin
tanımında hiçbir sınır yoktur. Ardışık tekrarları silen `dedup` metodu `T: PartialEq` sınırlı ayrı bir
`impl` bloğundadır; `sort` ise (dilim üzerinden gelir) yalnızca kendi imzasında `T: Ord` ister.
:::

## Alıştırma: puan tablosu

```exercise
id: m11-l04-e-puan
title: Okul turnuvasının puan tablosu
difficulty: 3
prompt: |
  Okulun yarışma uygulamasında hem öğrenciler hem futbol takımları puanlanıyor. Ortak davranış `Puanli`
  trait'inde: her tip `puan()` döndürebiliyor. Trait ve iki tip hazır; sen üç fonksiyon yaz:

  1. **`toplam_puan`** — `impl Trait` sözdizimiyle (imza hazır): dilimdeki puanların toplamı.
  2. **`en_iyi`** — generic sözdizimiyle (imza hazır): en yüksek puanlı elemana referans; dilim boşsa
     `None`. Eşitlikte **ilk gelen** kazanır.
  3. **`esigi_gecenler`** — imzadaki `<T: Puanli>` sınırını bir **`where` cümlesine taşı** ve gövdeyi yaz:
     puanı `esik`'e **eşit ya da büyük** olan eleman sayısını `usize` olarak döndürsün.
starter: |
  trait Puanli {
      fn puan(&self) -> u32;
  }

  struct Ogrenci {
      ad: String,
      not: u32,
  }

  struct Takim {
      isim: String,
      galibiyet: u32,
      beraberlik: u32,
  }

  impl Puanli for Ogrenci {
      fn puan(&self) -> u32 {
          self.not
      }
  }

  impl Puanli for Takim {
      fn puan(&self) -> u32 {
          self.galibiyet * 3 + self.beraberlik
      }
  }

  fn toplam_puan(liste: &[impl Puanli]) -> u32 {
      todo!()
  }

  fn en_iyi<T: Puanli>(liste: &[T]) -> Option<&T> {
      todo!()
  }

  // TODO: Sınırı `where` cümlesine taşı, sonra gövdeyi yaz.
  fn esigi_gecenler<T: Puanli>(liste: &[T], esik: u32) -> usize {
      todo!()
  }

  fn main() {
      let sinif = vec![
          Ogrenci { ad: String::from("Ayşe"), not: 92 },
          Ogrenci { ad: String::from("Emre"), not: 78 },
      ];
      let lig = vec![Takim { isim: String::from("Sarıyer"), galibiyet: 5, beraberlik: 2 }];
      println!("{} ve {} hazır", sinif[0].ad, lig[0].isim);
  }
solution: |
  trait Puanli {
      fn puan(&self) -> u32;
  }

  struct Ogrenci {
      ad: String,
      not: u32,
  }

  struct Takim {
      isim: String,
      galibiyet: u32,
      beraberlik: u32,
  }

  impl Puanli for Ogrenci {
      fn puan(&self) -> u32 {
          self.not
      }
  }

  impl Puanli for Takim {
      fn puan(&self) -> u32 {
          self.galibiyet * 3 + self.beraberlik
      }
  }

  fn toplam_puan(liste: &[impl Puanli]) -> u32 {
      let mut toplam = 0;
      for oge in liste {
          toplam += oge.puan();
      }
      toplam
  }

  fn en_iyi<T: Puanli>(liste: &[T]) -> Option<&T> {
      if liste.is_empty() {
          return None;
      }
      let mut en_iyi = &liste[0];
      for oge in liste {
          if oge.puan() > en_iyi.puan() {
              en_iyi = oge;
          }
      }
      Some(en_iyi)
  }

  fn esigi_gecenler<T>(liste: &[T], esik: u32) -> usize
  where
      T: Puanli,
  {
      let mut sayac = 0;
      for oge in liste {
          if oge.puan() >= esik {
              sayac += 1;
          }
      }
      sayac
  }

  fn main() {
      let sinif = vec![
          Ogrenci { ad: String::from("Ayşe"), not: 92 },
          Ogrenci { ad: String::from("Emre"), not: 78 },
      ];
      let lig = vec![Takim { isim: String::from("Sarıyer"), galibiyet: 5, beraberlik: 2 }];
      println!("Sınıf toplamı: {}", toplam_puan(&sinif));
      if let Some(birinci) = en_iyi(&sinif) {
          println!("Birinci: {}", birinci.ad);
      }
      println!("{} takım 10 puanı geçti ({})", esigi_gecenler(&lig, 10), lig[0].isim);
  }
check: tests
tests: |
  fn sinif() -> Vec<Ogrenci> {
      vec![
          Ogrenci { ad: String::from("Ayşe"), not: 92 },
          Ogrenci { ad: String::from("Emre"), not: 78 },
          Ogrenci { ad: String::from("Zeynep"), not: 92 },
          Ogrenci { ad: String::from("Can"), not: 45 },
      ]
  }

  #[test]
  fn toplam_her_tiple_calisir() {
      assert_eq!(toplam_puan(&sinif()), 307, "92 + 78 + 92 + 45 = 307");
      let lig = [
          Takim { isim: String::from("Sarıyer"), galibiyet: 5, beraberlik: 2 },
          Takim { isim: String::from("Bodrum"), galibiyet: 3, beraberlik: 4 },
      ];
      assert_eq!(toplam_puan(&lig), 30, "Takım puanı galibiyet × 3 + beraberlik: 17 + 13 = 30");
  }

  #[test]
  fn esitlikte_ilk_gelen_kazanir() {
      let s = sinif();
      let birinci = en_iyi(&s).expect("dolu listede bir kazanan olmalı");
      assert_eq!(birinci.ad, "Ayşe", "Ayşe ve Zeynep 92 ile eşit; ilk gelen (Ayşe) seçilmeli");
  }

  #[test]
  fn en_iyi_takimi_bulur() {
      let lig = [
          Takim { isim: String::from("Bodrum"), galibiyet: 3, beraberlik: 4 },
          Takim { isim: String::from("Sarıyer"), galibiyet: 5, beraberlik: 2 },
      ];
      let lider = en_iyi(&lig).expect("lig boş değil");
      assert_eq!(lider.isim, "Sarıyer", "17 puanlı Sarıyer, 13 puanlı Bodrum'un önünde olmalı");
  }

  #[test]
  fn bos_listede_none_ve_sifir() {
      let bos: Vec<Takim> = Vec::new();
      assert!(en_iyi(&bos).is_none(), "Boş listede kazanan olmaz");
      assert_eq!(toplam_puan(&bos), 0, "Boş listenin toplamı 0 olmalı");
      assert_eq!(esigi_gecenler(&bos, 10), 0, "Boş listede kimse eşiği geçemez");
  }

  #[test]
  fn esige_esit_olan_da_sayilir() {
      let s = sinif();
      assert_eq!(esigi_gecenler(&s, 78), 3, "78 ve üstü: Ayşe, Emre, Zeynep (eşit olan da sayılır)");
      assert_eq!(esigi_gecenler(&s, 93), 0, "93 ve üstü kimse yok");
  }
hints:
  - "`toplam_puan` için bir `toplam` değişkeni tut ve `for oge in liste` içinde `oge.puan()` ekle. `en_iyi` için önce boş dilimi ele al, sonra 1. dersteki `en_buyuk` gibi bir aday referans tut."
  - "Eşitlikte ilk gelenin kalması için yalnızca **kesin büyükse** değiştir: `if oge.puan() > en_iyi.puan()`."
  - "`esigi_gecenler` imzasında `<T: Puanli>` yerine yalnızca `<T>` yaz; dönüş tipinden (`-> usize`) sonra yeni satırda `where T: Puanli,` ve ardından gövdenin `{`'i gelir. Gövdede bir sayaç tut, `oge.puan() >= esik` ise artır."
require:
  - pattern: "where\\s+T\\s*:\\s*Puanli"
    message: "`esigi_gecenler`'in sınırını `where T: Puanli` cümlesiyle vermelisin."
explanation: |
  Üç fonksiyon üç farklı sözdizimi kullandı ama anlamları aynı türden: hepsi “`Puanli` uygulayan **bir** tip”
  ile çalışıyor ve gövdede yalnızca `puan()` çağırıyor. `&[impl Puanli]` ile `<T: Puanli>(&[T])` tamamen
  denktir; `where` sadece okunabilirlik içindir.

  Önemli bir ayrıntı: `&[impl Puanli]` **karışık** bir liste değildir! Her çağrıda dilimin tamamı tek bir
  somut tipten oluşur — ya hepsi `Ogrenci` ya hepsi `Takim` (monomorfizasyon her tip için ayrı kopya üretir).
  Öğrencileri ve takımları **aynı listede** tutmak için trait nesneleri gerekir: `Vec<Box<dyn Puanli>>` —
  Modül 20'de.

  `en_iyi` 1. dersteki `en_buyuk`'un trait'li hâli: karşılaştırmayı `T`'nin kendisiyle değil, trait'in
  verdiği `puan()` ile yaptık; bu yüzden `T: PartialOrd` gerekmedi.
```

## Özet

:::remember
- `fn f(x: &impl Trait)` ≡ `fn f<T: Trait>(x: &T)`. İki parametrede fark: iki `impl Trait` **farklı**
  tipler olabilir; tek `T` **aynı** tipi zorlar.
- Çoklu sınır: `T: A + B` ya da `&(impl A + B)`; uzun sınırlar için `where` cümlesi.
- `-> impl Trait`: **tek, gizli, somut** bir tip döndürür. Farklı tipler gerekiyorsa enum ya da
  `Box<dyn Trait>` (Modül 20).
- `impl<T: A + B> Tip<T> { ... }`: yalnızca sınırları sağlayan `T`'ler için var olan metotlar.
- Sınırı struct tanımına değil, ona ihtiyaç duyan `impl`/fonksiyona koy.
- Sınır sağlanmazsa: fonksiyonda `E0277`, koşullu metotta `E0599` (“trait bounds were not satisfied”).
:::

```reflect
prompt: |
  `fn bildir(oge: &impl Ozet)` imzasını gören biri, fonksiyonun gövdesini hiç okumadan neleri bilir?
  Bu bilgi büyük bir projede neden değerlidir?
answer: |
  İmzadan şunları bilir: fonksiyon `Ozet` uygulayan **her** tiple çalışır; değeri yalnızca **ödünç** alır
  (sahipliği almaz, değiştirmez); gövde bu değerle yalnızca `Ozet`'in sağladığı metotları kullanabilir.
  Kendi tipimi bu fonksiyona vermek için tek yapmam gereken `Ozet`'i uygulamaktır.

  Büyük projelerde bu çok değerlidir: bir fonksiyonu kullanmak için içini okumam gerekmez, derleyici sözleşmeyi
  iki taraf için de denetler. Fonksiyonun içi değişse bile imza aynı kaldıkça benim kodum kırılmaz.
```

```flashcards
- front: "`fn f(x: &impl Ozet)` sözdiziminin generic (uzun) karşılığı nedir?"
  back: "`fn f<T: Ozet>(x: &T)`"
- front: "`fn f(a: &impl Ozet, b: &impl Ozet)` ile `fn f<T: Ozet>(a: &T, b: &T)` arasındaki fark nedir?"
  back: "İlkinde `a` ve `b` farklı tipler olabilir; ikincisinde ikisi de aynı `T` tipinde olmalıdır."
- front: Birden fazla trait sınırı nasıl yazılır?
  back: "`+` ile: `T: Ozet + Debug` ya da `&(impl Ozet + Debug)` (parantezler şart)."
- front: "`where` cümlesi ne işe yarar?"
  back: Uzun trait sınırlarını imzanın sonuna taşıyarak fonksiyon imzasını okunur kılar.
- front: "`-> impl Ozet` dönen bir fonksiyon `if` ile bir dalda `Haber`, diğerinde `Gonderi` döndürebilir mi?"
  back: "Hayır. `impl Trait` tek bir somut tiptir (`E0308`). Çözüm: enum ya da `Box<dyn Ozet>` (Modül 20)."
- front: "`impl<T: Display + PartialOrd> Cift<T>` bloğundaki bir metodu `Cift<Renk>` üzerinde (Renk bu trait'leri uygulamıyor) çağırırsan ne olur?"
  back: "`E0599`: metot var ama trait sınırları sağlanmadı — metot o tip için yoktur."
- front: "`E0277: the trait bound X: Ozet is not satisfied` neyi anlatır?"
  back: "`Ozet` sınırı isteyen bir yere, `Ozet`'i uygulamayan bir `X` tipi verildi."
- front: Statik dağıtım (static dispatch) nedir?
  back: Trait sınırlı generic çağrılarının monomorfizasyon sayesinde derleme zamanında doğrudan doğru fonksiyona bağlanması.
```
