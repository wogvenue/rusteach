---
id: m11-l07
title: FromStr, AsRef ve Error trait'i
minutes: 23
type: lesson
objectives:
  - "Kendi tipin için `FromStr` uygulayıp `.parse()` ile metinden doğrulanmış değer üretebilmek"
  - "`AsRef<str>` ile hem `&[String]` hem `&[&str]` kabul eden esnek fonksiyonlar yazabilmek"
  - "Kendi hata enum'una `Display` ve `std::error::Error` uygulayıp onu `Box<dyn Error>` içinde taşıyabilmek"
  - "`From` uygulayarak `?`'nin farklı hata tiplerini kendi hata tipine kendiliğinden dönüştürmesini sağlayabilmek"
keywords: [FromStr, parse, AsRef, "std::error::Error", "Box<dyn Error>", "?", From, ParseIntError, split_once, E0277, E0308]
---

Modül 2'den beri `"42".parse::<i32>()` yazıyorsun. 1. derste `parse`'ın generic bir metot olduğunu
gördün; peki `parse` bir metni `i32`'ye, `f64`'e, `bool`'a çevirmeyi nereden biliyor? Ve senin `Saat`
tipine çevirmeyi neden **bilmiyor**? Cevap yine bir trait.

Bu ders Modül 10'da yarım bıraktığımız bir hikâyeyi de bitiriyor. Orada kendi hata enum'larını
tasarlamıştın ama iki eksik vardı: hatalar kullanıcıya güzel bir mesajla gösterilemiyordu ve `?` onları
`Box<dyn Error>`'a koyamıyordu. Dersin sonunda üç farklı hata kaynağı olan bir fonksiyonu yalnızca `?`
işaretleriyle yazacaksın.

## parse'ın sırrı: FromStr

Bir tren uygulamasında kullanıcı kalkış saatini `"09:45"` diye yazıyor. Doğrudan `Saat`'e çevirmeyi
deneyelim:

```compiles
code: |
  #[derive(Debug)]
  struct Saat {
      saat: u8,
      dakika: u8,
  }

  fn main() {
      let s = "09:45".parse::<Saat>();
      println!("{s:?}");
  }
answer: false
error: E0277
explanation: |
  `parse` yalnızca `FromStr` trait'ini uygulayan tiplere çevirebilir. `i32`, `f64`, `bool`, `char`
  bu trait'i uygular; bizim `Saat` uygulamıyor. Derleyici `"09:45"`'in nasıl bir saate dönüşeceğini
  bilemez: “9 saat 45 dakika” mı, “9,45 saat” mi? Kuralı sen yazmalısın.
```

:::error
```text
error[E0277]: the trait bound `Saat: FromStr` is not satisfied
 --> src/main.rs:8:21
  |
8 |     let s = "09:45".parse::<Saat>();
  |                     ^^^^^ unsatisfied trait bound
  |
help: the trait `FromStr` is not implemented for `Saat`
 --> src/main.rs:2:1
  |
2 | struct Saat {
  | ^^^^^^^^^^^
  = help: the following other types implement trait `FromStr`:
            IpAddr
            Ipv4Addr
            NonZero<i32>
          and 32 others
```
(Liste kısaltıldı.) `help:` bölümü `FromStr`'yi uygulayan standart tipleri gösteriyor: IP adresleri bile
metinden ayrıştırılabiliyor!
:::

`parse`'ın standart kütüphanedeki imzası artık sana yabancı değil:

```text
pub fn parse<F: FromStr>(&self) -> Result<F, F::Err>
             ──────────             ─────────────────
             F, FromStr uygulayan   başarılıysa bir F, değilse F'nin
             herhangi bir tip       kendi hata tipi (F::Err)
```

`F::Err`, önceki dersteki `TryFrom`'un `Error`'u gibi bir **ilişkili tiptir**: Her tip, ayrıştırma
başarısız olursa hangi hatayı vereceğini kendisi seçer. `i32` için `ParseIntError`, `f64` için
`ParseFloatError`. `Saat` için biz seçelim:

```rust
use std::str::FromStr;

#[derive(Debug)]
struct Saat {
    saat: u8,
    dakika: u8,
}

impl FromStr for Saat {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (sa, dk) = s.trim().split_once(':').ok_or("':' işareti eksik")?;
        let saat = sa.parse::<u8>().map_err(|_| format!("'{sa}' geçerli bir saat değil"))?;
        let dakika = dk.parse::<u8>().map_err(|_| format!("'{dk}' geçerli bir dakika değil"))?;
        if saat > 23 || dakika > 59 {
            return Err(format!("{saat:02}:{dakika:02} diye bir saat yok"));
        }
        Ok(Saat { saat, dakika })
    }
}

fn main() {
    let kalkis: Saat = "09:45".parse().unwrap();
    println!("Kalkış: {} saat {} dakika", kalkis.saat, kalkis.dakika);

    println!("{:?}", "25:00".parse::<Saat>());
    println!("{:?}", "öğle".parse::<Saat>());
    println!("{:?}", "12:3x".parse::<Saat>());
    println!("{:?}", Saat::from_str(" 7:05 "));
}
```

Önceki modüllerden tanıdığın araçların hepsi iş başında: `split_once` metni ilk `:`'den ikiye böler ve bir
`Option` döndürür; Modül 10'un üçlüsü de burada: `ok_or` onu `Result`'a çevirir, `map_err`
`ParseIntError`'ı kendi mesajımıza tercüme eder, `?` her adımda hatayı yukarı iletir. `ok_or("...")` bir `&str` hatası üretir. Dönüş tipindeki hata ise
`String`'dir; `?` aradaki farkı `String: From<&str>` sayesinde kapatır (önceki ders).

İki küçük ayrıntı: `parse` çağırmak için `FromStr`'yi içe aktarmana gerek yoktur, çünkü `parse` `str`'nin
kendi metodudur. Ama `Saat::from_str(...)`'ı **doğrudan** çağırmak için trait kapsamda olmalıdır
(3. ders), bu yüzden `use std::str::FromStr;` yazarız. Uygularken `impl std::str::FromStr for Saat`
diye tam yolu da yazabilirdin; `use` yalnızca daha okunaklıdır. Ayrıca `FromStr` uyguladığın anda
`parse`'ın hem turbofish (`parse::<Saat>()`) hem tip notasyonu (`let k: Saat = ...`) biçimi çalışır.

Şimdi bu `Saat`'i `?` ile kullanalım:

```predict
question: "(Modül 10 tekrarı) Yukarıdaki `Saat` ve `FromStr` uygulaması aynen kullanılıyor. Program ne yazdırır?"
code: |
  # use std::str::FromStr;
  # struct Saat {
  #     saat: u8,
  #     dakika: u8,
  # }
  # impl FromStr for Saat {
  #     type Err = String;
  #     fn from_str(s: &str) -> Result<Self, Self::Err> {
  #         let (sa, dk) = s.trim().split_once(':').ok_or("':' işareti eksik")?;
  #         let saat = sa.parse::<u8>().map_err(|_| format!("'{sa}' geçerli bir saat değil"))?;
  #         let dakika = dk.parse::<u8>().map_err(|_| format!("'{dk}' geçerli bir dakika değil"))?;
  #         if saat > 23 || dakika > 59 {
  #             return Err(format!("{saat:02}:{dakika:02} diye bir saat yok"));
  #         }
  #         Ok(Saat { saat, dakika })
  #     }
  # }
  fn yolculuk_dakika(kalkis: &str, varis: &str) -> Result<u32, String> {
      let k: Saat = kalkis.parse()?;
      let v: Saat = varis.parse()?;
      let bas = k.saat as u32 * 60 + k.dakika as u32;
      let son = v.saat as u32 * 60 + v.dakika as u32;
      Ok(son - bas)
  }

  fn main() {
      println!("{:?}", yolculuk_dakika("09:05", "13:30"));
      println!("{:?}", yolculuk_dakika("09:05", "13.30"));
  }
options:
  - |
    Ok(265)
    Err("':' işareti eksik")
  - |
    Ok(265)
    Err("'13.30' geçerli bir saat değil")
  - |
    Ok(4.25)
    Err("':' işareti eksik")
  - Derlenmez, `parse()?` için turbofish gerekir
answer: 0
explanation: |
  İlk çağrı: 13 × 60 + 30 − (9 × 60 + 5) = 810 − 545 = 265 dakika. İkinci çağrıda `"13.30"` içinde `:`
  yok; `split_once` `None` döndürür, `ok_or` onu `Err("':' işareti eksik")` yapar ve `?` hatayı önce
  `from_str`'den, sonra ikinci `?` ile `yolculuk_dakika`'dan dışarı iletir. Turbofish gerekmez: `let k: Saat`
  notasyonu `parse`'a hedef tipi söyler. Hata tipi ikisinde de `String` olduğu için dönüşüm de gerekmez.
```

## Enum'lar için FromStr

`FromStr` en çok kullanıcının yazdığı **komutları** ve **seçenekleri** enum'lara çevirmek için kullanılır.
Bir oyunda oyuncu yön yazıyor:

```parsons
prompt: |
  Satırları sıralayarak `Yon` enum'u için `FromStr` uygulamasını kur. Dikkat: iki satır tuzak.
lines: |
  use std::str::FromStr;
  pub enum Yon { Kuzey, Guney }
  impl FromStr for Yon {
      type Err = String;
      fn from_str(s: &str) -> Result<Self, Self::Err> {
          match s {
              "kuzey" => Ok(Yon::Kuzey),
              "güney" => Ok(Yon::Guney),
              diger => Err(format!("bilinmeyen yön: {diger}")),
          }
      }
  }
distractors: |
      type Error = String;
      fn from_str(s: String) -> Result<Self, Self::Err> {
explanation: |
  `FromStr`'nin ilişkili tipinin adı **`Err`**'dir (`TryFrom`'daki `Error` ile karıştırma; ikisi farklı
  zamanlarda tasarlandı). `from_str` her zaman bir `&str` **ödünç alır**; ayrıştırırken metnin sahipliğine
  ihtiyaç yoktur. `match` bir `&str`'yi metin sabitleriyle karşılaştırabilir; son koldaki `diger` her şeyi
  yakalar (Modül 7) ve onu hata mesajında kullanır.
```

:::info `FromStr` mi, `TryFrom<&str>` mi?
İkisi de “metinden, başarısız olabilecek şekilde değer üret” der. `FromStr` daha eskidir ve `parse`
ona bağlıdır. Bu yüzden metinden ayrıştırma için **deyimsel seçim `FromStr`'dir**: herkes
`"...".parse::<Tip>()` yazmayı bekler. `TryFrom`'u sayılar ya da başka tiplerden dönüşümler için sakla.
:::

## AsRef: esnek parametreler

Bir market uygulamasında sepetteki ürünleri listeleyen bir fonksiyon yazıyoruz. Ürünler kimi zaman
kullanıcıdan gelen `Vec<String>`, kimi zaman koda gömülü bir `&str` dizisi. Tahmin et:

```compiles
code: |
  fn hepsini_yaz(liste: &[&str]) {
      for oge in liste {
          println!("- {oge}");
      }
  }

  fn main() {
      let sepet = vec![String::from("elma"), String::from("simit")];
      hepsini_yaz(&sepet);
  }
answer: false
error: E0308
explanation: |
  Tek bir `&String`, `&str` bekleyen bir yere sorunsuz verilebilir (Modül 5'teki deref zorlaması).
  Ama bir **dilim** dolusu `String`, bir dilim dolusu `&str` değildir. İkisinin bellekteki düzeni farklıdır
  ve Rust birini ötekiymiş gibi okuyamaz.
```

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:9:17
  |
9 |     hepsini_yaz(&sepet);
  |     ----------- ^^^^^^ expected `&[&str]`, found `&Vec<String>`
  |     |
  |     arguments to this function are incorrect
  |
  = note: expected reference `&[&str]`
             found reference `&Vec<String>`
```
:::

Neden dönüştürülemediğini bellekte görelim:

```memory
title: "&[String] ile &[&str] neden aynı şey değil?"
steps:
  - caption: "`sepet: Vec<String>`'in heap tamponunda elemanlar **24 bayttır**: her biri işaretçi + uzunluk + kapasite. Metinlerin kendisi heap'te ayrı yerlerde durur."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<String>", value: "ptr · len=2 · cap=2", to: h1 }
    heap:
      - { id: h1, value: "[ptr · len=4 · cap=4] [ptr · len=5 · cap=5]", label: "2 × 24 bayt" }
      - { id: h2, value: "e l m a" }
      - { id: h3, value: "s i m i t" }
  - caption: "Bir `&[&str]` ise art arda dizilmiş **16 baytlık** (işaretçi + uzunluk) çiftler ister. Elindeki 24 baytlık üçlüleri bu kalıba sığdırmanın tek yolu yeni bir dizi kurmaktır; Rust bunu senin yerine gizlice yapmaz."
    stack:
      - frame: main
        vars:
          - { name: iller, type: "[&str; 2]", value: "[ptr · len=6] [ptr · len=7]", note: "2 × 16 bayt", to: s1 }
    heap:
      - { id: s1, value: "M u ğ l a · I ğ d ı r", label: "programın içinde (statik)" }
```

Çözüm: “hangi tip olursa olsun, yeter ki ondan bir `&str` **ödünç alınabilsin**” demek. Bunun trait'i
`AsRef<str>`'dir. Tek metodu `as_ref()` ucuz bir referans dönüşümü yapar; hiçbir şey kopyalanmaz:

```rust
fn listele<S: AsRef<str>>(baslik: &str, liste: &[S]) {
    println!("{baslik}:");
    for oge in liste {
        println!("  - {}", oge.as_ref());
    }
}

fn iceriyor_mu<S: AsRef<str>>(liste: &[S], aranan: &str) -> bool {
    for oge in liste {
        if oge.as_ref() == aranan {
            return true;
        }
    }
    false
}

fn main() {
    let sepet = vec![String::from("elma"), String::from("simit")];
    let iller = ["Muğla", "Iğdır"];
    listele("Sepet", &sepet); // S = String
    listele("İller", &iller); // S = &str
    println!("{}", iceriyor_mu(&sepet, "simit"));
    println!("{}", iceriyor_mu(&iller, "Van"));
}
```

`String`, `&str` ve `str` `AsRef<str>`'yi uygular. Her çağrı kendi `S`'sini seçer ve monomorfizasyon
iki ayrı kopya üretir (2. ders). Gövdede `S` hakkında yalnızca “ondan `&str` alınabilir” bilgisi var;
gerisi her zamanki `&str` işlemleri.

Standart kütüphanede de bunu çok göreceksin. Örneğin dosya okuyan fonksiyonun imzası
`fn read_to_string<P: AsRef<Path>>(path: P)` şeklindedir. Bu sayede ona `"notlar.txt"`, bir `String` ya da
bir `Path` verebilirsin (Modül 15'te kullanacaksın).

Üç seçenek arasında nasıl karar vereceksin?

| İhtiyaç | Parametre | Neden |
|---|---|---|
| Tek bir metni **okumak** | `&str` | En basiti; `&String` de deref zorlamasıyla gelir |
| Metni **saklamak** (sahiplik lazım) | `impl Into<String>` | `String` gelirse kopyasız taşınır (önceki ders) |
| Metin benzeri şeylerin **koleksiyonunu** okumak ya da generic kod | `S: AsRef<str>` | `&[String]` ve `&[&str]`'nin ikisi de çalışır |

```quiz
question: |
  Bir kütüphane sistemi için üç fonksiyon yazıyorsun. Hangisinde `AsRef<str>` **en uygun** seçimdir?
options:
  - "`fn kitap_ekle(baslik: ...)`, başlığı `Kitap` struct'ında saklayacak"
  - "`fn yazar_ara(yazarlar: &[...], aranan: &str)`, çağıranlarda yazarlar bazen `Vec<String>`, bazen `&str` dizisi"
  - "`fn baslik_uzunlugu(baslik: ...)`, tek bir başlığın bayt sayısını döndürecek"
answer: 1
explanation: |
  `AsRef<str>` asıl gücünü **koleksiyonlarda** gösterir: `&[String]` ile `&[&str]` arasında deref
  zorlaması yoktur, generic bir `S: AsRef<str>` ise ikisini de kabul eder. Başlığı saklayacaksan sahiplik
  gerekir: `impl Into<String>`. Tek bir metni okumak için en sade seçim düz `&str`'dir; `AsRef` orada
  yalnızca imzayı karmaşıklaştırır.
feedback:
  - "Saklamak için sahiplik lazım: `impl Into<String>` daha uygun. `as_ref()` yalnızca ödünç verir."
  - Doğru!
  - "Çalışır ama gereksiz: `&str` parametresi `&String`'i de kabul eder (deref zorlaması)."
```

## Kendi hata tipini tamamlamak: Display ve Error

Modül 10'da banka hesabı için bir hata enum'u tasarlamıştın. Onu `Box<dyn Error>` döndüren bir fonksiyonda
`?` ile kullanmayı deneyelim:

```compiles
question: "(Modül 10 tekrarı) Derlenir mi?"
code: |
  use std::error::Error;

  #[derive(Debug)]
  enum HesapHatasi {
      YetersizBakiye { bakiye: u32, istenen: u32 },
  }

  fn cek(bakiye: u32, istenen: u32) -> Result<u32, HesapHatasi> {
      if istenen > bakiye {
          return Err(HesapHatasi::YetersizBakiye { bakiye, istenen });
      }
      Ok(bakiye - istenen)
  }

  fn main() -> Result<(), Box<dyn Error>> {
      let kalan = cek(100, 250)?;
      println!("{kalan}");
      Ok(())
  }
answer: false
error: E0277
explanation: |
  `Box<dyn Error>` “`Error` trait'ini uygulayan herhangi bir hata” kutusudur. `ParseIntError` gibi standart
  hatalar bu trait'i uygular, bizim `HesapHatasi` uygulamıyor. `?`, `From::from` ile hatayı kutuya koymaya
  çalışır ama bu dönüşüm yalnızca `Error` uygulayan tipler için vardır.
```

:::error
```text
error[E0277]: `?` couldn't convert the error: `HesapHatasi: std::error::Error` is not satisfied
  --> src/main.rs:16:30
   |
15 | fn main() -> Result<(), Box<dyn Error>> {
   |              -------------------------- required `HesapHatasi: std::error::Error` because of this
16 |     let kalan = cek(100, 250)?;
   |                 -------------^ the trait `std::error::Error` is not implemented for `HesapHatasi`
   |                 |
   |                 this has type `Result<_, HesapHatasi>`
   |
note: `HesapHatasi` needs to implement `std::error::Error`
   = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
   = note: required for `Box<dyn std::error::Error>` to implement `From<HesapHatasi>`
```
Son `note:` satırı bütün mekanizmayı özetliyor: `?` bir `From` dönüşümü yapar ve
`Box<dyn Error>: From<HesapHatasi>` ancak `HesapHatasi: Error` ise vardır.
:::

`std::error::Error` trait'inin iki şartı var: tipin hem `Debug` hem `Display` uygulaması. (Bir trait'in
başka trait'leri şart koşmasına **üst trait (supertrait)** denir; Modül 22'de göreceksin.) Kendi metotlarının
hepsinin ise varsayılan uygulaması var. Yani 3. dersteki `impl Selam for Ankarali {}` gibi **boş bir impl
bloğu** yeterli:

```rust
use std::error::Error;
use std::fmt;

#[derive(Debug)]
enum HesapHatasi {
    YetersizBakiye { bakiye: u32, istenen: u32 },
    GunlukLimit { limit: u32 },
}

impl fmt::Display for HesapHatasi {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            HesapHatasi::YetersizBakiye { bakiye, istenen } => {
                write!(f, "yetersiz bakiye: {istenen} TL istendi, hesapta {bakiye} TL var")
            }
            HesapHatasi::GunlukLimit { limit } => write!(f, "günlük çekim limiti {limit} TL"),
        }
    }
}

impl Error for HesapHatasi {} // Debug + Display var; gerisi varsayılan

fn para_cek(bakiye: u32, istenen: u32) -> Result<u32, HesapHatasi> {
    if istenen > 2000 {
        return Err(HesapHatasi::GunlukLimit { limit: 2000 });
    }
    if istenen > bakiye {
        return Err(HesapHatasi::YetersizBakiye { bakiye, istenen });
    }
    Ok(bakiye - istenen)
}

fn islem(adet_metni: &str) -> Result<u32, Box<dyn Error>> {
    let adet: u32 = adet_metni.parse()?; // ParseIntError → kutu
    let kalan = para_cek(1500, adet * 100)?; // HesapHatasi → kutu
    Ok(kalan)
}

fn main() {
    for girdi in ["3", "18", "25", "beş"] {
        match islem(girdi) {
            Ok(kalan) => println!("{girdi} banknot: tamam, kalan {kalan} TL"),
            Err(e) => println!("{girdi} banknot: HATA → {e}"),
        }
    }
}
```

`islem` iki farklı hata tipiyle karşılaşıyor ve ikisini de aynı kutuya koyuyor. `main` hangi hatanın
geldiğini bilmeden `{e}` ile yazdırabiliyor, çünkü kutudaki her hatanın bir `Display`'i olduğu garanti.

:::analogy Hastanenin standart olay bildirim formu
Büyük bir hastanede acil servis, laboratuvar ve eczane çok farklı sorunlarla karşılaşır. Ama hepsi bir
sorunu **aynı standart formla** bildirir: formun üstünde herkesin anlayacağı kısa bir açıklama, altında
uzmanlar için teknik ayrıntılar bulunur. Başhekimliğin gelen kutusu formun hangi bölümden geldiğine
bakmaz; standarda uyan her formu kabul eder.

`Error` trait'i o standart formdur: `Display` herkes için açıklama, `Debug` teknik ayrıntı. `Box<dyn Error>`
başhekimliğin gelen kutusudur. `impl Error for HesapHatasi {}` ise bölümünün “bizim formlarımız standarda
uyuyor” diye imza atmasıdır.
:::

:::deep Hata zincirleri: `source()`
`Error`'ın varsayılan metotlarından biri `source()`'tur: “Bu hataya **hangi** alt hata yol açtı?” Varsayılanı
`None` döndürür. Bir hata başka bir hatayı sarıyorsa (birazdan göreceğin `Adet(ParseIntError)` gibi) bu
metodu ezerek iç hatayı gösterebilirsin. Böylece raporlama araçları “sipariş okunamadı ← adet okunamadı ←
geçersiz rakam” gibi bir zinciri yazdırabilir:

```text
fn source(&self) -> Option<&(dyn Error + 'static)> {
    match self {
        SiparisHatasi::Adet(e) => Some(e),
        _ => None,
    }
}
```
İmzadaki `dyn` ve `'static` parçalarını Modül 12 ve 20'den sonra rahatça okuyacaksın.
:::

## From ile ?'yi otomatikleştirmek

`Box<dyn Error>` uygulamalar için harikadır, ama bir **kütüphane** yazıyorsan çağıranın hataları `match`
ile ayırt edebilmesi için somut bir hata enum'u döndürmek istersin (Modül 10). O zaman da şu sorun çıkar:

```compiles
code: |
  use std::num::ParseIntError;

  #[derive(Debug)]
  enum SiparisHatasi {
      Adet(ParseIntError),
      StokYok,
  }

  fn adet_oku(metin: &str) -> Result<u32, SiparisHatasi> {
      let adet = metin.trim().parse::<u32>()?;
      if adet > 10 {
          return Err(SiparisHatasi::StokYok);
      }
      Ok(adet)
  }

  fn main() {
      println!("{:?}", adet_oku("3"));
  }
answer: false
error: E0277
explanation: |
  `parse` bir `ParseIntError` üretir, fonksiyon ise `SiparisHatasi` döndürüyor. `?` hatayı
  `From::from` ile dönüştürmeye çalışır ama `SiparisHatasi: From<ParseIntError>` diye bir uygulama yok.
  Modül 10'da bunu her seferinde `map_err(SiparisHatasi::Adet)` ile çözüyordun.
```

:::error
```text
error[E0277]: `?` couldn't convert the error to `SiparisHatasi`
  --> src/main.rs:10:43
   |
 9 | fn adet_oku(metin: &str) -> Result<u32, SiparisHatasi> {
   |                             -------------------------- expected `SiparisHatasi` because of this
10 |     let adet = metin.trim().parse::<u32>()?;
   |                             --------------^ the trait `From<ParseIntError>` is not implemented for `SiparisHatasi`
   |                             |
   |                             this can't be annotated with `?` because it has type `Result<_, ParseIntError>`
   |
note: `SiparisHatasi` needs to implement `From<ParseIntError>`
   = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
```
Derleyici tam olarak eksik olanı söylüyor: `From<ParseIntError>`. Onu yazarsak `?` dönüşümü her yerde
kendiliğinden yapar:
:::

```text
metin.parse::<u32>()?
      │
      ├─ Ok(3)               →  ifadenin değeri 3 olur, devam
      └─ Err(ParseIntError)  →  return Err(From::from(hata))
                                         │
                                         └─ bizim impl From<ParseIntError> for SiparisHatasi
                                            → SiparisHatasi::Adet(hata)
```

Tam örnek: bir simitçinin sipariş satırlarını (`"3 simit"`) okuyan fonksiyon. Üç farklı hata kaynağı var:
biçim, adet ve ürün.

```rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum SiparisHatasi {
    Bicim,
    Adet(ParseIntError),
    UrunYok(String),
}

impl fmt::Display for SiparisHatasi {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            SiparisHatasi::Bicim => write!(f, "satır '<adet> <ürün>' biçiminde olmalı"),
            SiparisHatasi::Adet(e) => write!(f, "adet okunamadı ({e})"),
            SiparisHatasi::UrunYok(urun) => write!(f, "'{urun}' diye bir ürünümüz yok"),
        }
    }
}

impl Error for SiparisHatasi {}

impl From<ParseIntError> for SiparisHatasi {
    fn from(hata: ParseIntError) -> Self {
        SiparisHatasi::Adet(hata)
    }
}

fn birim_fiyat(urun: &str) -> Option<u32> {
    match urun {
        "simit" => Some(15),
        "çay" => Some(10),
        "poğaça" => Some(20),
        _ => None,
    }
}

fn satir_tutari(satir: &str) -> Result<u32, SiparisHatasi> {
    let (adet, urun) = satir.trim().split_once(' ').ok_or(SiparisHatasi::Bicim)?;
    let adet = adet.parse::<u32>()?; // From sayesinde: ParseIntError → SiparisHatasi::Adet
    let fiyat = birim_fiyat(urun).ok_or_else(|| SiparisHatasi::UrunYok(urun.to_string()))?;
    Ok(adet * fiyat)
}

fn main() {
    println!("{:?}", satir_tutari("4 çay"));
    if let Err(e) = satir_tutari("dört çay") {
        println!("Debug  : {e:?}");
        println!("Display: {e}");
    }
}
```

`satir_tutari`'da hiç `map_err` yok; üç `?`'nin her biri farklı bir hata kaynağını ele alıyor. Şimdi
farklı girdilerle dene:

```predict
code: |
  # use std::error::Error;
  # use std::fmt;
  # use std::num::ParseIntError;
  # #[derive(Debug)]
  # enum SiparisHatasi {
  #     Bicim,
  #     Adet(ParseIntError),
  #     UrunYok(String),
  # }
  # impl fmt::Display for SiparisHatasi {
  #     fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
  #         match self {
  #             SiparisHatasi::Bicim => write!(f, "satır '<adet> <ürün>' biçiminde olmalı"),
  #             SiparisHatasi::Adet(e) => write!(f, "adet okunamadı ({e})"),
  #             SiparisHatasi::UrunYok(urun) => write!(f, "'{urun}' diye bir ürünümüz yok"),
  #         }
  #     }
  # }
  # impl Error for SiparisHatasi {}
  # impl From<ParseIntError> for SiparisHatasi {
  #     fn from(hata: ParseIntError) -> Self {
  #         SiparisHatasi::Adet(hata)
  #     }
  # }
  # fn birim_fiyat(urun: &str) -> Option<u32> {
  #     match urun {
  #         "simit" => Some(15),
  #         "çay" => Some(10),
  #         "poğaça" => Some(20),
  #         _ => None,
  #     }
  # }
  # fn satir_tutari(satir: &str) -> Result<u32, SiparisHatasi> {
  #     let (adet, urun) = satir.trim().split_once(' ').ok_or(SiparisHatasi::Bicim)?;
  #     let adet = adet.parse::<u32>()?;
  #     let fiyat = birim_fiyat(urun).ok_or_else(|| SiparisHatasi::UrunYok(urun.to_string()))?;
  #     Ok(adet * fiyat)
  # }
  fn main() {
      for satir in ["3 simit", "2 lahmacun", "5", "-1 çay"] {
          match satir_tutari(satir) {
              Ok(tutar) => println!("{tutar} TL"),
              Err(e) => println!("hata: {e}"),
          }
      }
  }
options:
  - |
    45 TL
    hata: '2 lahmacun' diye bir ürünümüz yok
    hata: satır '<adet> <ürün>' biçiminde olmalı
    hata: adet okunamadı (invalid digit found in string)
  - |
    45 TL
    hata: 'lahmacun' diye bir ürünümüz yok
    hata: satır '<adet> <ürün>' biçiminde olmalı
    hata: adet okunamadı (invalid digit found in string)
  - |
    45 TL
    hata: 'lahmacun' diye bir ürünümüz yok
    hata: adet okunamadı (cannot parse integer from empty string)
    -10 TL
answer: 1
explanation: |
  `"3 simit"` → 3 × 15 = 45. `"2 lahmacun"` biçim ve adet olarak doğru ama ürün listede yok;
  `UrunYok` yalnızca ürün adını (`urun`) taşıyor. `"5"` içinde boşluk olmadığı için `split_once` `None`
  döndürür: `Bicim`. `"-1 çay"`: adet `u32` olarak ayrıştırılıyor ve `u32` eksi işaretini kabul etmez;
  `ParseIntError` oluşur, `?` onu `From` ile `Adet`'e çevirir. Böylece negatif adet daha ayrıştırma
  aşamasında reddedilir. Tipler doğrulamayı bizim yerimize yaptı!
```

**`From` mu, `map_err` mi?** İkisi birbirinin rakibi değildir. Bir hata tipi her zaman aynı varyanta
dönüşüyorsa `From` yaz ve `?`'nin işi kendiliğinden yapmasına izin ver. Aynı hata tipi farklı yerlerde
farklı anlamlar taşıyorsa (örneğin hem adet hem fiyat ayrıştırılıyor ve hangisinin bozuk olduğunu bilmek
istiyorsun) o noktada `map_err` ile bağlam ekle.

:::tip Gerçek projelerde
Bu kalıp o kadar yaygındır ki `thiserror` crate'i `Display`, `Error` ve `From` uygulamalarını tek bir
`#[derive(Error)]` ile üretir; ürettiği kod tam olarak bu derste elle yazdığın koddur. `anyhow` ise
kod üretmez: uygulamalar için `Box<dyn Error>`'ın daha güçlü bir sürümü olan hazır bir hata tipi sunar
(ona `?` ile aktarılan her hata da yine `From` ile çevrilir). İkisini Modül 25'te kullanacaksın; önce
elle yazmayı öğrenmemizin sebebi, perde arkasında olanı bilmen.
:::

## Alıştırmalar

```exercise
id: m11-l07-e-tarih
title: Tarihi metinden oku
difficulty: 3
prompt: |
  Bir tarih uygulaması kullanıcıdan tarihleri `GG.AA.YYYY` biçiminde alıyor (örneğin `29.10.1923`).
  `Tarih` için `FromStr` uygula, böylece `"29.10.1923".parse::<Tarih>()` çalışsın.

  Kurallar:
  - Baştaki ve sondaki boşluklar yok sayılır (`" 23.04.1920 "` geçerli).
  - Üç parça noktayla ayrılmalı; parçalar sayı olmalı (`gun: u8`, `ay: u8`, `yil: u16`).
  - Gün 1-31, ay 1-12 arasında olmalı (ayın kaç gün çektiğini kontrol etmene gerek yok).
  - Herhangi bir kural bozulursa açıklayıcı bir `Err(String)` döndür. Testler mesajın tam metnine
    bakmıyor, yalnızca `Err` olup olmadığına bakıyor.
starter: |
  use std::str::FromStr;

  #[derive(Debug, PartialEq)]
  struct Tarih {
      gun: u8,
      ay: u8,
      yil: u16,
  }

  impl FromStr for Tarih {
      type Err = String;

      fn from_str(s: &str) -> Result<Self, Self::Err> {
          todo!()
      }
  }

  fn main() {
      match "29.10.1923".parse::<Tarih>() {
          Ok(t) => println!("{}/{}/{}", t.gun, t.ay, t.yil),
          Err(e) => println!("Hata: {e}"),
      }
  }
solution: |
  use std::str::FromStr;

  #[derive(Debug, PartialEq)]
  struct Tarih {
      gun: u8,
      ay: u8,
      yil: u16,
  }

  impl FromStr for Tarih {
      type Err = String;

      fn from_str(s: &str) -> Result<Self, Self::Err> {
          let (g, kalan) = s.trim().split_once('.').ok_or("tarih GG.AA.YYYY biçiminde olmalı")?;
          let (a, y) = kalan.split_once('.').ok_or("tarih GG.AA.YYYY biçiminde olmalı")?;
          let gun = g.parse::<u8>().map_err(|_| format!("geçersiz gün: {g}"))?;
          let ay = a.parse::<u8>().map_err(|_| format!("geçersiz ay: {a}"))?;
          let yil = y.parse::<u16>().map_err(|_| format!("geçersiz yıl: {y}"))?;
          if gun == 0 || gun > 31 {
              return Err(format!("{gun} geçerli bir gün değil"));
          }
          if ay == 0 || ay > 12 {
              return Err(format!("{ay} geçerli bir ay değil"));
          }
          Ok(Tarih { gun, ay, yil })
      }
  }

  fn main() {
      match "29.10.1923".parse::<Tarih>() {
          Ok(t) => println!("{}/{}/{}", t.gun, t.ay, t.yil),
          Err(e) => println!("Hata: {e}"),
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_tarihler() {
      assert_eq!("29.10.1923".parse::<Tarih>(), Ok(Tarih { gun: 29, ay: 10, yil: 1923 }), "Cumhuriyet'in ilanı");
      assert_eq!("1.1.2000".parse::<Tarih>(), Ok(Tarih { gun: 1, ay: 1, yil: 2000 }), "Tek haneli gün ve ay da geçerli");
      assert_eq!(Tarih::from_str(" 23.04.1920 "), Ok(Tarih { gun: 23, ay: 4, yil: 1920 }), "Baştaki ve sondaki boşluklar kırpılmalı");
  }

  #[test]
  fn bicim_hatalari() {
      assert!("1923-10-29".parse::<Tarih>().is_err(), "Nokta yoksa Err dönmeli");
      assert!("29.10".parse::<Tarih>().is_err(), "Yıl eksikse Err dönmeli");
      assert!("".parse::<Tarih>().is_err(), "Boş metin Err olmalı");
      assert!("1.2.3.4".parse::<Tarih>().is_err(), "Dört parça varsa Err dönmeli");
  }

  #[test]
  fn sayi_olmayan_parcalar() {
      assert!("aa.10.1923".parse::<Tarih>().is_err(), "Gün sayı değilse Err dönmeli");
      assert!("29.10.19x3".parse::<Tarih>().is_err(), "Yıl sayı değilse Err dönmeli");
  }

  #[test]
  fn aralik_disi_degerler() {
      assert!("32.01.2024".parse::<Tarih>().is_err(), "32. gün yok");
      assert!("0.5.2024".parse::<Tarih>().is_err(), "0. gün yok");
      assert!("15.13.2024".parse::<Tarih>().is_err(), "13. ay yok");
      assert_eq!("31.12.2024".parse::<Tarih>(), Ok(Tarih { gun: 31, ay: 12, yil: 2024 }), "31 ve 12 sınırda geçerli");
  }
hints:
  - "Önce `s.trim()`, sonra iki kez `split_once('.')`: ilki günü ayırır, ikincisi kalan `\"10.1923\"` kısmını ay ve yıla böler. `None` gelirse `ok_or(\"...\")?` ile hata döndür."
  - "Her parçayı kendi tipine çevir: `g.parse::<u8>().map_err(|_| format!(\"geçersiz gün: {g}\"))?`. Yıl için `u16`."
  - "Sayılar okunduktan sonra aralıkları kontrol et: `if gun == 0 || gun > 31 { return Err(...); }`, ay için de benzeri. Sonunda `Ok(Tarih { gun, ay, yil })`."
explanation: |
  `"1.2.3.4"` örneğine bak: ikinci `split_once`'tan sonra yıl parçası `"3.4"` olur ve `u16`'ya
  ayrıştırılamadığı için kendiliğinden reddedilir. Ayrı bir “parça sayısı” kontrolüne gerek kalmadı.
  Benzer şekilde `-5.1.2000` de `u8` eksi işaretini kabul etmediği için düşer. Doğru tipleri seçmek
  doğrulamanın yarısını senin yerine yapar.

  `ok_or("...")` bir `&str` hatası üretir, dönüş tipi ise `String`. `?` aradaki farkı `From` ile kapatır.
  `map_err` ise burada gerçekten **bağlam ekliyor**: Üç parça da `ParseIntError` verebilir ve mesaj hangisinin
  bozuk olduğunu söylüyor.

  Gerçek bir uygulamada şubatın 29 gün çekip çekmediği gibi takvim kuralları da gerekir; o noktada
  `chrono` gibi bir crate kullanılır. Onun `NaiveDate` tipi de `FromStr` uygular, ama standart ISO
  biçimini bekler: `"1923-10-29".parse::<NaiveDate>()`. `GG.AA.YYYY` gibi yerel bir biçim için
  `NaiveDate::parse_from_str(metin, "%d.%m.%Y")` kullanılır. Senin `Tarih`'in ise kendi biçimini
  doğrudan `parse` ile okuyabiliyor.
```

```exercise
id: m11-l07-e-kayit
title: Okul kayıt satırları
difficulty: 4
prompt: |
  Bir okul kayıt sistemi öğrenci satırlarını `"<ad>, <yaş>"` biçiminde alıyor (örneğin `"Ayşe, 12"`).
  Hata tipi `KayitHatasi` hazır. Senin görevlerin:

  1. **`Display`**: Mesajlar tam olarak şöyle olmalı:
     - `VirgulYok` → `satırda virgül yok`
     - `YasSayiDegil(e)` → `yaş bir sayı değil: <e>` (`e`'yi `{e}` ile yazdır)
     - `YasAralikDisi(y)` → `yaş 7-18 arasında olmalı, <y> geldi`
  2. **`std::error::Error`**'ı uygula (böylece `Box<dyn Error>`'a girebilsin).
  3. **`From<ParseIntError>`**'ı uygula: `ParseIntError` → `YasSayiDegil`.
  4. **`kayit_oku`**: Satırı ilk virgülden böl; ad ve yaştaki boşlukları kırp; yaş 7-18 arasında
     değilse `YasAralikDisi`. Yaşı ayrıştırırken **`?` kullan ve `map_err` kullanma**: dönüşümü
     `From` yapmalı.
starter: |
  use std::error::Error;
  use std::fmt;
  use std::num::ParseIntError;

  #[derive(Debug)]
  enum KayitHatasi {
      VirgulYok,
      YasSayiDegil(ParseIntError),
      YasAralikDisi(u32),
  }

  impl fmt::Display for KayitHatasi {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  // TODO: impl Error for KayitHatasi
  // TODO: impl From<ParseIntError> for KayitHatasi

  fn kayit_oku(satir: &str) -> Result<(String, u32), KayitHatasi> {
      todo!()
  }

  fn main() {
      for satir in ["Ayşe, 12", "Mert", "Can, on", "Ece, 25"] {
          match kayit_oku(satir) {
              Ok((ad, yas)) => println!("{ad} ({yas}) kaydedildi"),
              Err(e) => println!("'{satir}' reddedildi: {e}"),
          }
      }
  }
solution: |
  use std::error::Error;
  use std::fmt;
  use std::num::ParseIntError;

  #[derive(Debug)]
  enum KayitHatasi {
      VirgulYok,
      YasSayiDegil(ParseIntError),
      YasAralikDisi(u32),
  }

  impl fmt::Display for KayitHatasi {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          match self {
              KayitHatasi::VirgulYok => write!(f, "satırda virgül yok"),
              KayitHatasi::YasSayiDegil(e) => write!(f, "yaş bir sayı değil: {e}"),
              KayitHatasi::YasAralikDisi(y) => write!(f, "yaş 7-18 arasında olmalı, {y} geldi"),
          }
      }
  }

  impl Error for KayitHatasi {}

  impl From<ParseIntError> for KayitHatasi {
      fn from(e: ParseIntError) -> Self {
          KayitHatasi::YasSayiDegil(e)
      }
  }

  fn kayit_oku(satir: &str) -> Result<(String, u32), KayitHatasi> {
      let (ad, yas) = satir.split_once(',').ok_or(KayitHatasi::VirgulYok)?;
      let yas = yas.trim().parse::<u32>()?;
      if !(7..=18).contains(&yas) {
          return Err(KayitHatasi::YasAralikDisi(yas));
      }
      Ok((ad.trim().to_string(), yas))
  }

  fn main() {
      for satir in ["Ayşe, 12", "Mert", "Can, on", "Ece, 25"] {
          match kayit_oku(satir) {
              Ok((ad, yas)) => println!("{ad} ({yas}) kaydedildi"),
              Err(e) => println!("'{satir}' reddedildi: {e}"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_kayitlar() {
      assert_eq!(kayit_oku("Ayşe, 12").unwrap(), (String::from("Ayşe"), 12), "\"Ayşe, 12\" → (\"Ayşe\", 12)");
      assert_eq!(kayit_oku(" Mehmet Ali ,7").unwrap(), (String::from("Mehmet Ali"), 7), "Boşluklar kırpılmalı; 7 sınırda geçerli");
      assert_eq!(kayit_oku("Zehra,18").unwrap(), (String::from("Zehra"), 18), "18 sınırda geçerli");
  }

  #[test]
  fn virgul_yoksa_hata() {
      assert!(matches!(kayit_oku("Mert"), Err(KayitHatasi::VirgulYok)), "Virgülsüz satır VirgulYok vermeli");
  }

  #[test]
  fn sayi_olmayan_yas_from_ile_donusur() {
      assert!(matches!(kayit_oku("Can, on"), Err(KayitHatasi::YasSayiDegil(_))), "\"on\" sayı değil: YasSayiDegil beklenir");
      assert!(matches!(kayit_oku("Can, "), Err(KayitHatasi::YasSayiDegil(_))), "Boş yaş da YasSayiDegil olmalı");
  }

  #[test]
  fn aralik_disi_yas() {
      assert!(matches!(kayit_oku("Ece, 25"), Err(KayitHatasi::YasAralikDisi(25))), "25 yaş aralık dışı ve hata 25'i taşımalı");
      assert!(matches!(kayit_oku("Bora, 6"), Err(KayitHatasi::YasAralikDisi(6))), "6 yaş aralık dışı");
  }

  #[test]
  fn mesajlar_ve_box_dyn_error() {
      assert_eq!(KayitHatasi::VirgulYok.to_string(), "satırda virgül yok");
      assert_eq!(KayitHatasi::YasAralikDisi(25).to_string(), "yaş 7-18 arasında olmalı, 25 geldi");
      let Err(hata) = kayit_oku("Can, on") else {
          panic!("\"Can, on\" Err vermeliydi");
      };
      assert_eq!(hata.to_string(), "yaş bir sayı değil: invalid digit found in string", "İç hatanın mesajı da yazılmalı");
      let kutu: Box<dyn std::error::Error> = KayitHatasi::VirgulYok.into();
      assert_eq!(kutu.to_string(), "satırda virgül yok", "Error uygulanınca hata Box<dyn Error>'a girebilmeli");
  }
hints:
  - "`Display` için `match self` ile her varyanta bir `write!` yaz. `Error` için gövdesiz bir impl yeterli: `impl Error for KayitHatasi {}`."
  - "`impl From<ParseIntError> for KayitHatasi { fn from(e: ParseIntError) -> Self { KayitHatasi::YasSayiDegil(e) } }`"
  - "`kayit_oku`: `let (ad, yas) = satir.split_once(',').ok_or(KayitHatasi::VirgulYok)?;` sonra `let yas = yas.trim().parse::<u32>()?;` Aralığı kontrol et ve `Ok((ad.trim().to_string(), yas))` döndür."
require:
  - pattern: "From<\\s*(std::num::)?ParseIntError\\s*>\\s+for\\s+KayitHatasi"
    message: "`impl From<ParseIntError> for KayitHatasi` yazmalısın."
  - pattern: "impl\\s+(std::error::)?Error\\s+for\\s+KayitHatasi"
    message: "`impl Error for KayitHatasi` yazmalısın."
forbid:
  - pattern: "map_err"
    message: "Bu alıştırmada `map_err` kullanma: dönüşümü `From` ve `?` yapmalı."
explanation: |
  Dört parça birbirini tamamlıyor: `Display` hatayı insanlara anlatır, `Error` onu Rust ekosisteminin
  ortak hata dili yapar (`Box<dyn Error>`, raporlama araçları), `From` ise `?`'nin dönüşümü kendiliğinden
  yapmasını sağlar. `kayit_oku`'daki iki `?` iki farklı yoldan geliyor: İlki zaten `KayitHatasi` olan bir
  hatayı (`ok_or` ile ürettik) olduğu gibi iletiyor, ikincisi `ParseIntError`'ı `From` ile çeviriyor.

  `YasSayiDegil` içteki `ParseIntError`'ı **saklıyor**, atmıyor. `Display`'de onu yazdırarak
  kullanıcıya asıl sebebi gösterdik. İstersen `source()`'u ezip hata zincirine de ekleyebilirsin.

  Çağıran kod artık iki şekilde çalışabilir: `match` ile varyantları ayırt eder (örneğin yaş hatasında
  kullanıcıya yeniden sorar) ya da `Box<dyn Error>` döndüren bir fonksiyonda `?` ile hatayı yukarı iletir.
  İyi tasarlanmış bir hata tipi ikisine de izin verir.
```

## Özet

:::remember
- `impl FromStr for Tip { type Err = ...; fn from_str(s: &str) -> Result<Self, Self::Err> }` →
  `"...".parse::<Tip>()` çalışır. `from_str`'yi doğrudan çağırmak için `use std::str::FromStr;`.
- `FromStr`'nin ilişkili tipi `Err`, `TryFrom`'unki `Error`'dur.
- `S: AsRef<str>` + `oge.as_ref()`: hem `&[String]` hem `&[&str]` kabul eder (dilimler arasında deref
  zorlaması yoktur → `E0308`). Tek metin okumak için `&str`, saklamak için `impl Into<String>`.
- `std::error::Error` = `Debug` + `Display` + (varsayılan metotlar) → `impl Error for Hata {}` yeterli.
  Ancak o zaman `?` hatayı `Box<dyn Error>`'a koyabilir.
- `impl From<AltHata> for Hatam` → `?` dönüşümü kendiliğinden yapar; `map_err`'i bağlam eklemek için sakla.
:::

```reflect
prompt: |
  `?` operatörü, `From` trait'i ve `std::error::Error` trait'i birlikte nasıl çalışıyor? Bir fonksiyonda
  `ParseIntError` üreten bir satırın sonundaki `?`, hatayı senin `SiparisHatasi` tipine nasıl çeviriyor?
answer: |
  `?`, `Err(e)` görünce fonksiyondan `return Err(From::from(e))` ile döner. Yani hatayı fonksiyonun dönüş
  tipindeki hata tipine `From` trait'iyle dönüştürmeye çalışır. Ben `impl From<ParseIntError> for SiparisHatasi`
  yazdıysam bu dönüşüm `SiparisHatasi::Adet(e)` olur; yazmadıysam derleyici `E0277` ile durur.

  `Error` trait'i ise başka bir köprüyü açar: Standart kütüphanede `Error` uygulayan her tip için
  `Box<dyn Error>: From<T>` vardır. Benim tipim `Debug` ve `Display` uygulayıp `impl Error for SiparisHatasi {}`
  derse, `Box<dyn Error>` döndüren fonksiyonlarda da `?` ile kullanılabilir. Kısacası `?` her zaman `From`'a
  sorar; `From` uygulamaları da hangi hatanın nereye gidebileceğini belirler.
```

```flashcards
- front: "`\"09:45\".parse::<Saat>()` çalışsın diye `Saat` hangi trait'i uygulamalıdır?"
  back: "`std::str::FromStr` (`type Err` + `fn from_str(s: &str) -> Result<Self, Self::Err>`)."
- front: "`FromStr` ile `TryFrom`'un ilişkili hata tiplerinin adları nedir?"
  back: "`FromStr` → `Err`, `TryFrom` → `Error`."
- front: "`fn f(l: &[&str])` fonksiyonuna `&Vec<String>` verilebilir mi? Neden?"
  back: "Hayır (`E0308`). `String` 24, `&str` 16 bayttır; dilimlerin bellek düzeni farklıdır. Çözüm: `fn f<S: AsRef<str>>(l: &[S])`."
- front: "`AsRef<str>`'nin metodu nedir ve maliyeti nedir?"
  back: "`as_ref()`; ucuz bir referans dönüşümüdür, hiçbir şey kopyalanmaz."
- front: Kendi hata tipine `std::error::Error` uygulamak için neler gerekir?
  back: "Tipin `Debug` ve `Display` uygulaması; sonra boş bir `impl Error for Hata {}` yeterlidir (metotların hepsi varsayılan)."
- front: "`?` bir `ParseIntError`'ı neden kendiliğinden `SiparisHatasi`'na çevirebilir?"
  back: "`?` hatayı `From::from` ile dönüştürür; `impl From<ParseIntError> for SiparisHatasi` yazılmıştır."
- front: "`? couldn't convert the error: X: std::error::Error is not satisfied` hatası ne zaman çıkar?"
  back: "`Box<dyn Error>` döndüren bir fonksiyonda, `Error` trait'ini uygulamayan bir `X` hatasına `?` uygulandığında."
- front: "`From` mu `map_err` mi?"
  back: "Hata her zaman aynı varyanta dönüşüyorsa `From`; aynı hata tipine yere göre farklı bağlam eklenecekse `map_err`."
```
