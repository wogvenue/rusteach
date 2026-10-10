---
id: m11-l03
title: Trait'ler — ortak davranış
minutes: 18
type: lesson
objectives:
  - Bir trait tanımlayıp onu birden fazla tip için uygulayabilmek (`impl Trait for Tip`)
  - Varsayılan (default) metot yazabilmek ve gerektiğinde bir tipte ezebilmek (override)
  - Varsayılan metotlardan trait'in zorunlu metotlarını çağırarak ortak davranış kurabilmek
  - Trait'leri sınıf kalıtımıyla karşılaştırıp farklarını açıklayabilmek
keywords: [trait, "impl Trait for Tip", varsayılan metot, E0046, E0407, E0599, arayüz, kalıtım]
---

İlk iki derste `PartialOrd`, `PartialEq`, `Copy`, `Debug` gibi trait'leri **sınır** olarak kullandın:
“bu tip karşılaştırılabilsin”, “kopyalanabilsin”... Ama trait'in tam olarak ne olduğunu hep sonraya
bıraktık. Sıra geldi.

Bir haber uygulaması yazıyoruz. Ana sayfada gazete haberleri (`Haber`) ve sosyal medya gönderileri
(`Gonderi`) karışık listelenecek ve her birinin kısa bir **özeti** gösterilecek. İki tip çok farklı
veriler taşıyor, ama ortak bir **davranışları** var: özetlenebilmek. Rust'ta ortak davranışın adı
**trait**'tir.

## Trait tanımlamak ve uygulamak

Bir trait, tiplerin paylaşacağı davranışı **metot imzalarıyla** tarif eder:

```rust
pub trait Ozet {
    fn ozetle(&self) -> String;
}
```

`trait` anahtar kelimesi, bir ad (`UpperCamelCase`) ve süslü parantez içinde **gövdesiz** imzalar —
dikkat, imza `;` ile bitiyor. Anlamı: *“`Ozet` trait'ini uygulayan her tip, tam bu imzaya sahip bir
`ozetle` metodu sağlamak zorundadır.”* Trait sadece **ne** yapılacağını söyler; **nasıl** yapılacağına
her tip kendisi karar verir:

```rust
trait Ozet {
    fn ozetle(&self) -> String;
}

struct Haber {
    baslik: String,
    sehir: String,
    yazar: String,
}

struct Gonderi {
    kullanici: String,
    icerik: String,
    begeni: u32,
}

impl Ozet for Haber {
    fn ozetle(&self) -> String {
        format!("{} ({}) — {}", self.baslik, self.sehir, self.yazar)
    }
}

impl Ozet for Gonderi {
    fn ozetle(&self) -> String {
        format!("@{}: {} [{} beğeni]", self.kullanici, self.icerik, self.begeni)
    }
}

fn main() {
    let haber = Haber {
        baslik: String::from("Kapadokya'da balon sezonu açıldı"),
        sehir: String::from("Nevşehir"),
        yazar: String::from("Deniz Yılmaz"),
    };
    let gonderi = Gonderi {
        kullanici: String::from("rustsever"),
        icerik: String::from("Bugün ilk trait'imi yazdım!"),
        begeni: 42,
    };
    println!("{}", haber.ozetle());
    println!("{}", gonderi.ozetle());
}
```

`impl Ozet for Haber` şöyle okunur: *“`Haber` için `Ozet` trait'ini uygula.”* Modül 6'daki normal
`impl Haber` bloğundan farkı: `for` ile **hangi sözleşmeyi** yerine getirdiğini söylersin. Metot çağrısı
ise tamamen aynıdır: `haber.ozetle()`.

:::analogy Priz ve fiş standardı
Duvardaki priz, ona takılan cihazın saç kurutma makinesi mi, dizüstü bilgisayar mı, çaydanlık mı olduğunu
umursamaz. Tek şartı var: fiş **standarda** uymalı. Cihazlar birbirinden çok farklı işler yapar ama hepsi
aynı standardı uygular; priz de yalnızca standardın vaat ettiğini kullanır.

Trait bir standarttır (`Ozet`); `impl Ozet for Haber` bir cihaza standart fiş takmaktır. Trait'i kullanan
kod da priz gibidir: karşısındaki tipin ne olduğunu değil, yalnızca standarda uyduğunu bilir. (Böyle
“priz” fonksiyonları bir sonraki derste yazacağız.)
:::

Başka dillerde bu fikrin karşılıkları: Java ve C#'ta `interface`, Swift'te `protocol`, Go'da `interface`
(orada uygulama örtük, yani ayrıca belirtilmez). Python'da ise *duck typing* vardır: “ördek gibi
vaklıyorsa ördektir” — ama yanlışlık ancak çalışma anında anlaşılır. Rust'ta uygulama **açıktır**
(`impl ... for ...`) ve tipin tanımından **ayrı** yazılır; yani var olan bir tipe sonradan da eklenebilir.

## Sözleşmeye uymak zorunludur

Trait'e bir metot daha ekledik ama `Haber`'in impl bloğunu güncellemeyi unuttuk. Tahmin et:

```compiles
code: |
  trait Ozet {
      fn ozetle(&self) -> String;
      fn yazar(&self) -> String;
  }

  struct Haber {
      baslik: String,
  }

  impl Ozet for Haber {
      fn ozetle(&self) -> String {
          format!("Son dakika: {}", self.baslik)
      }
  }

  fn main() {
      let h = Haber { baslik: String::from("Rust 2024 sürümü çıktı") };
      println!("{}", h.ozetle());
  }
answer: false
error: E0046
explanation: |
  Sözleşmenin bir maddesi eksik: `Ozet` trait'i `yazar` metodunu da şart koşuyor ama `Haber` onu
  sağlamıyor. `yazar`'ı hiç çağırmamamız önemli değil — trait'i uygulamak **bütün** zorunlu
  maddeleri yerine getirmek demektir.
```

:::error
```text
error[E0046]: not all trait items implemented, missing: `yazar`
  --> src/main.rs:10:1
   |
 3 |     fn yazar(&self) -> String;
   |     -------------------------- `yazar` from trait
...
10 | impl Ozet for Haber {
   | ^^^^^^^^^^^^^^^^^^^ missing `yazar` in implementation
```
Mesaj hem eksik maddeyi (`missing: yazar`) hem de onun trait'teki tanımını gösteriyor. Bu sayede büyük bir
trait'i uygularken hangi metotları yazman gerektiğini derleyiciye sorabilirsin. (rust-analyzer'daki
“Implement missing members” eylemi de tam bunu yapar.)
:::

İmzalar da **birebir** uymalıdır: trait `fn ozetle(&self) -> String` diyorsa sen `-> &str` döndüremezsin
(`E0053: method has an incompatible type for trait`).

```quiz
question: |
  `impl Ozet for Haber { ... }` bloğuna, trait'te **olmayan** bir `fn kelime_sayisi(&self) -> usize`
  metodu eklersen ne olur?
options:
  - Sorun yok; metot `Haber`'e eklenir
  - "`E0407`: metot `Ozet` trait'inin üyesi değil — onu ayrı bir `impl Haber` bloğuna koymalısın"
  - Metot sessizce trait'e de eklenir ve diğer tipler de onu uygulamak zorunda kalır
answer: 1
explanation: |
  Trait impl bloğu bir sözleşmenin yerine getirildiği yerdir; içinde yalnızca o trait'in öğeleri olabilir.
  Tipe özel ek metotlar normal (*inherent*) `impl Haber { ... }` bloğuna gider. Modül 6'dan hatırla:
  bir tipin birden çok `impl` bloğu olabilir — trait impl'leri de bunlardan biridir.
feedback:
  - "Trait impl bloğuna yalnızca trait'in öğeleri girebilir: `method is not a member of trait`."
  - Doğru!
  - Bir trait yalnızca kendi tanımında değişir; bir impl bloğu trait'i genişletemez.
```

## Varsayılan uygulamalar

Bazen her tip için mantıklı bir **varsayılan** davranış vardır. Trait'teki bir metoda gövde yazarsan bu
bir **varsayılan uygulama (default implementation)** olur:

```rust
trait Ozet {
    fn ozetle(&self) -> String {
        String::from("(Devamını oku...)")
    }
}

struct Haber {
    baslik: String,
}

struct Reklam;

impl Ozet for Haber {
    fn ozetle(&self) -> String {
        format!("Haber: {}", self.baslik)
    }
}

impl Ozet for Reklam {} // varsayılanı olduğu gibi kullan

fn main() {
    let h = Haber { baslik: String::from("Van Gölü'nde inci kefali göçü başladı") };
    println!("{}", h.ozetle());
    println!("{}", Reklam.ozetle());
}
```

`Reklam` boş bir impl bloğuyla (`{}`) trait'i uyguluyor ve varsayılan `ozetle`'yi kullanıyor. `Haber` ise
aynı imzayla kendi sürümünü yazarak varsayılanı **eziyor (override)**. Terimler:

- Gövdesi **olmayan** metot → **zorunlu (required)**: her tip yazmak zorunda.
- Gövdesi **olan** metot → **sağlanan (provided)**: tip isterse kullanır, isterse ezer.

```predict
code: |
  trait Selam {
      fn selam(&self) -> String {
          String::from("Merhaba!")
      }
  }

  struct Ankarali;
  struct Berlinli;

  impl Selam for Ankarali {}

  impl Selam for Berlinli {
      fn selam(&self) -> String {
          String::from("Guten Tag!")
      }
  }

  fn main() {
      println!("{} {}", Ankarali.selam(), Berlinli.selam());
  }
options:
  - "Merhaba! Guten Tag!"
  - "Merhaba! Merhaba!"
  - "Guten Tag! Guten Tag!"
  - Derlenmez — impl bloğu boş olamaz
answer: 0
explanation: |
  `Ankarali` hiçbir metot yazmadığı için varsayılan `selam`'ı alır: `Merhaba!`. `Berlinli` metodu ezdiği
  için kendi sürümü çalışır: `Guten Tag!`. Bir trait'in **bütün** metotlarının varsayılanı varsa boş impl
  bloğu tamamen geçerlidir.
```

## Varsayılan metotlar diğer metotları çağırabilir

İşin en güçlü kısmı burası: varsayılan bir metot, trait'in **henüz yazılmamış** zorunlu metotlarını
çağırabilir.

```rust
trait Ozet {
    fn yazar(&self) -> String; // zorunlu

    fn ozetle(&self) -> String {
        // sağlanan — zorunlu metodu kullanıyor
        format!("({} tarafından yazıldı — devamını oku...)", self.yazar())
    }
}

struct Gonderi {
    kullanici: String,
    icerik: String,
}

impl Ozet for Gonderi {
    fn yazar(&self) -> String {
        format!("@{}", self.kullanici)
    }
}

fn main() {
    let g = Gonderi {
        kullanici: String::from("kodcu_kedi"),
        icerik: String::from("Trait'ler harika!"),
    };
    println!("{}", g.ozetle());
    println!("Tam metin: {}", g.icerik);
}
```

`Gonderi` yalnızca `yazar`'ı yazdı ama `ozetle`'yi de bedavaya aldı. Bu nasıl güvenli? Trait garanti
veriyor: `Ozet`'i uygulayan **her** tip `yazar`'ı sağlamak zorunda; yani varsayılan `ozetle` çalıştığı her
yerde `self.yazar()` mutlaka vardır.

Bu desen çok güçlüdür: tip **küçük bir çekirdek** sağlar, trait geri kalan **zengin davranışı** hediye
eder. Standart kütüphanedeki `Iterator` trait'i bunun en ünlü örneğidir: tek bir zorunlu metot (`next`)
yazarsın, elliyi aşkın hazır metot (`map`, `filter`, `sum`...) bedavaya gelir. Modül 14'te kendi
iterator'ını yazarken göreceksin.

:::warning Ezilen metottan varsayılana ulaşılamaz
Bir metodu ezdiğin anda, kendi sürümünün içinden varsayılan sürümü çağırmanın bir yolu yoktur
(Java'daki `super.metot()` gibi bir mekanizma yok). Ortak kodu paylaşmak istiyorsan onu ayrı bir
yardımcı metoda koy.
:::

```fill
prompt: |
  `Calisan` trait'inde `maas` zorunlu olsun, `yillik_maas` ise `maas`'ı kullanan varsayılan bir metot olsun.
  Boşlukları doldur.
code: |
  trait Calisan {
      fn maas(&self) -> u32___0
      fn yillik_maas(&self) -> u32 {
          ___1.maas() * 12
      }
  }

  struct Muhendis;

  impl Calisan ___2 Muhendis {
      fn maas(&self) -> u32 {
          85_000
      }
  }

  fn main() {
      println!("{}", Muhendis.yillik_maas());
  }
blanks:
  - [";"]
  - ["self"]
  - ["for"]
output: "1020000"
explanation: |
  Zorunlu metodun imzası `;` ile biter — gövdesi yoktur. Varsayılan metot, trait'i uygulayan tipe
  `self` üzerinden ulaşır ve onun `maas`'ını çağırır. `impl Calisan for Muhendis` yalnızca `maas`'ı yazdı;
  `yillik_maas` hazır geldi: 85 000 × 12 = 1 020 000.
```

## Trait'ler kalıtım değildir

Java ya da C++ bilenler burada bir sınıf hiyerarşisi bekleyebilir: `class Haber extends Icerik`. Rust'ta
**sınıf kalıtımı yoktur.** Bunun yerine:

| Kalıtım (Java/C++) | Trait'ler (Rust) |
|---|---|
| Alt sınıf, üst sınıfın **verisini ve davranışını** miras alır | Veri struct/enum'da durur; trait'ler **yalnızca davranış** tanımlar, alan içeremez |
| Tek bir üst sınıf (Java), derin hiyerarşiler | Bir tip **istediği kadar** trait uygular |
| “*Haber bir İçeriktir*” (is-a) | “*Haber özetlenebilir, yazdırılabilir, karşılaştırılabilir*” (can-do) |
| Üst sınıftaki bir değişiklik tüm alt sınıfları kırabilir (*kırılgan taban sınıf* sorunu) | Her impl bağımsızdır; bir tipe yeni davranış eklemek diğerlerini etkilemez |

Bir trait'i, **başkasının yazdığı** bir tipe de uygulayabilirsin. Mesela standart kütüphanenin `bool`
tipine Türkçe konuşmayı öğretelim:

```rust
trait EvetHayir {
    fn evet_hayir(&self) -> &str;
}

impl EvetHayir for bool {
    fn evet_hayir(&self) -> &str {
        if *self { "evet" } else { "hayır" }
    }
}

fn main() {
    let yagmur_yagiyor = true;
    let kar_yagiyor = false;
    println!("Yağmur yağıyor mu? {}", yagmur_yagiyor.evet_hayir());
    println!("Kar yağıyor mu? {}", kar_yagiyor.evet_hayir());
    println!("5 > 3 mü? {}", (5 > 3).evet_hayir());
}
```

Java'da `Boolean` sınıfına sonradan metot ekleyemezsin; Rust'ta kendi trait'inle ekleyebilirsin. (Her
kombinasyona izin yok — hangilerinin neden yasak olduğunu 8. derste, *orphan rule* ile öğreneceksin.)
Trait'lerin içinde `Self`, trait'i uygulayan tipi temsil eder ve trait'ler `self` almayan fonksiyonlar da
içerebilir (`fn yeni() -> Self;`). `Default::default()` ve `From::from` tam olarak böyle trait
fonksiyonlarıdır — onları 5. ve 6. derste göreceksin.

Son bir kural daha var. Trait ve tip bir modülün içinde tanımlıysa ne olur?

```compiles
question: (Modül 8 tekrarı) Bu kod derlenir mi?
code: |
  mod medya {
      pub trait Ozet {
          fn ozetle(&self) -> String;
      }

      pub struct Haber {
          pub baslik: String,
      }

      impl Ozet for Haber {
          fn ozetle(&self) -> String {
              format!("Son dakika: {}", self.baslik)
          }
      }
  }

  fn main() {
      let h = medya::Haber { baslik: String::from("Rust 2024 sürümü çıktı") };
      println!("{}", h.ozetle());
  }
answer: false
error: E0599
explanation: |
  `Haber` `Ozet`'i uyguluyor ama `main`'in kapsamında `Ozet` trait'i **yok**. Trait metotları ancak trait
  kapsama alındığında çağrılabilir. Çözüm: `use medya::Ozet;` (ya da `use crate::medya::Ozet;`).
```

:::error
```text
error[E0599]: no method named `ozetle` found for struct `Haber` in the current scope
  --> src/main.rs:19:22
   |
 3 |         fn ozetle(&self) -> String;
   |            ------ the method is available for `Haber` here
...
19 |     println!("{}", h.ozetle());
   |                      ^^^^^^ method not found in `Haber`
   |
   = help: items from traits can only be used if the trait is in scope
help: trait `Ozet` which provides `ozetle` is implemented but not in scope; perhaps you want to import it
   |
 1 + use crate::medya::Ozet;
   |
```
Neden böyle bir kural var? İki farklı trait aynı adlı bir metot tanımlayabilir; Rust yalnızca **senin
kapsama aldığın** trait'lerin metotlarını görür, böylece sürpriz çakışmalar olmaz. `Clone`, `PartialOrd`,
`ToString` gibi sık kullanılanları hiç `use` etmeden kullanabilmenin sebebi, onların her programa otomatik
eklenen **prelude**'da olmasıdır.
:::

```quiz
question: Aşağıdakilerden hangisi Rust trait'leri için **yanlıştır**?
options:
  - Bir tip birden fazla trait uygulayabilir
  - Trait'ler alan (field) tanımlayabilir; trait'i uygulayan tip bu alanları miras alır
  - Kendi trait'ini `bool` gibi standart bir tipe uygulayabilirsin
  - Varsayılan metotlar, trait'in zorunlu metotlarını çağırabilir
answer: 1
explanation: |
  Trait'ler yalnızca **davranış** tanımlar; veri her zaman struct ve enum'larda durur. Varsayılan bir metot
  veriye ihtiyaç duyarsa, onu bir zorunlu metot üzerinden ister (`fn yazar(&self) -> String;` gibi) — her tip
  kendi verisinden bu cevabı üretir.
feedback:
  - Doğru bir ifade; bir tip istediği kadar trait uygulayabilir.
  - Yanlış olan bu! Trait'lerin alanı olmaz.
  - "Doğru bir ifade; `impl EvetHayir for bool` örneğini gördün."
  - Doğru bir ifade; `ozetle`, `yazar`'ı çağırabiliyordu.
```

## Alıştırma: market rafı

```exercise
id: m11-l03-e-market
title: Market etiketleri ve KDV
difficulty: 3
prompt: |
  Bir market otomasyonu için `Urun` trait'i tasarlandı. Fiyatlar **kuruş** cinsinden tam sayı olarak
  tutuluyor (para hesabında ondalıklı sayılar yuvarlama hataları yapar — hatırla: `0.1 + 0.2`!).

  **1) Trait'teki iki varsayılan metodu yaz:**
  - `kdvli_fiyat`: KDV dahil fiyat = `fiyat × (100 + kdv_yuzde) / 100`. Küsurat aşağı yuvarlanır
    (tam sayı bölmesi bunu zaten yapar).
  - `etiket`: `"<ad>: <lira>.<kuruş> TL"` biçiminde, KDV dahil fiyatla. Kuruş her zaman **iki hane**
    olmalı: 505 kuruş → `"5.05 TL"`.

  **2) İki tipe trait'i uygula:**
  - `Ekmek`: adı `"Ekmek (250 g)"` biçiminde (gramajla), fiyatı gram başına 4 kuruş, KDV **%1**.
  - `Kulaklik`: adı markası, fiyatı `fiyat` alanı; KDV varsayılan (%20).
starter: |
  trait Urun {
      fn ad(&self) -> String;
      fn fiyat(&self) -> u32; // kuruş, KDV hariç

      fn kdv_yuzde(&self) -> u32 {
          20
      }

      fn kdvli_fiyat(&self) -> u32 {
          todo!()
      }

      fn etiket(&self) -> String {
          todo!()
      }
  }

  struct Ekmek {
      gramaj: u32,
  }

  struct Kulaklik {
      marka: String,
      fiyat: u32,
  }

  // TODO: impl Urun for Ekmek { ... }
  // TODO: impl Urun for Kulaklik { ... }

  fn main() {
      // Hazır olunca dene:
      // let ekmek = Ekmek { gramaj: 250 };
      // println!("{}", ekmek.etiket());
  }
solution: |
  trait Urun {
      fn ad(&self) -> String;
      fn fiyat(&self) -> u32; // kuruş, KDV hariç

      fn kdv_yuzde(&self) -> u32 {
          20
      }

      fn kdvli_fiyat(&self) -> u32 {
          self.fiyat() * (100 + self.kdv_yuzde()) / 100
      }

      fn etiket(&self) -> String {
          let k = self.kdvli_fiyat();
          format!("{}: {}.{:02} TL", self.ad(), k / 100, k % 100)
      }
  }

  struct Ekmek {
      gramaj: u32,
  }

  struct Kulaklik {
      marka: String,
      fiyat: u32,
  }

  impl Urun for Ekmek {
      fn ad(&self) -> String {
          format!("Ekmek ({} g)", self.gramaj)
      }

      fn fiyat(&self) -> u32 {
          self.gramaj * 4
      }

      fn kdv_yuzde(&self) -> u32 {
          1
      }
  }

  impl Urun for Kulaklik {
      fn ad(&self) -> String {
          self.marka.clone()
      }

      fn fiyat(&self) -> u32 {
          self.fiyat
      }
  }

  fn main() {
      let ekmek = Ekmek { gramaj: 250 };
      let kulaklik = Kulaklik { marka: String::from("Sesli X1"), fiyat: 149_900 };
      println!("{}", ekmek.etiket());
      println!("{}", kulaklik.etiket());
  }
check: tests
tests: |
  #[test]
  fn ekmekte_kdv_yuzde_bir() {
      let e = Ekmek { gramaj: 250 };
      assert_eq!(e.ad(), "Ekmek (250 g)", "Ekmeğin adı gramajı içermeli");
      assert_eq!(e.fiyat(), 1000, "250 g × 4 kuruş = 1000 kuruş");
      assert_eq!(e.kdv_yuzde(), 1, "Ekmekte KDV %1 — varsayılanı ezmelisin");
      assert_eq!(e.kdvli_fiyat(), 1010, "1000 kuruş + %1 KDV = 1010 kuruş");
      assert_eq!(e.etiket(), "Ekmek (250 g): 10.10 TL");
  }

  #[test]
  fn kulaklik_varsayilan_kdvyi_kullanir() {
      let k = Kulaklik { marka: String::from("Sesli X1"), fiyat: 149_900 };
      assert_eq!(k.ad(), "Sesli X1", "Kulaklığın adı markası olmalı");
      assert_eq!(k.kdv_yuzde(), 20, "Kulaklık varsayılan %20 KDV'yi kullanmalı");
      assert_eq!(k.kdvli_fiyat(), 179_880, "149900 + %20 = 179880 kuruş");
      assert_eq!(k.etiket(), "Sesli X1: 1798.80 TL");
  }

  struct Su;

  impl Urun for Su {
      fn ad(&self) -> String {
          String::from("Su")
      }
      fn fiyat(&self) -> u32 {
          500
      }
      fn kdv_yuzde(&self) -> u32 {
          1
      }
  }

  #[test]
  fn kurus_her_zaman_iki_hane() {
      assert_eq!(Su.kdvli_fiyat(), 505, "500 kuruş + %1 = 505 kuruş");
      assert_eq!(Su.etiket(), "Su: 5.05 TL", "Kuruş tek haneliyse başına 0 eklenmeli");
  }

  struct Sakiz;

  impl Urun for Sakiz {
      fn ad(&self) -> String {
          String::from("Sakız")
      }
      fn fiyat(&self) -> u32 {
          333
      }
  }

  #[test]
  fn kusurat_asagi_yuvarlanir() {
      assert_eq!(Sakiz.kdvli_fiyat(), 399, "333 × 1.20 = 399.6 → tam sayı bölmesiyle 399");
      assert_eq!(Sakiz.etiket(), "Sakız: 3.99 TL");
  }
hints:
  - "Varsayılan metotlar `self` üzerinden diğer metotları çağırabilir: `self.fiyat() * (100 + self.kdv_yuzde()) / 100`."
  - "`etiket` için önce `let k = self.kdvli_fiyat();`, sonra `format!(\"{}: {}.{:02} TL\", self.ad(), k / 100, k % 100)`. `{:02}` sayıyı iki haneye sıfırla tamamlar (Modül 1)."
  - "`impl Urun for Ekmek` içinde `ad`, `fiyat` (`self.gramaj * 4`) ve `kdv_yuzde` (`1`) yeter. `Kulaklik` için yalnızca `ad` (`self.marka.clone()`) ve `fiyat` yaz; KDV'yi varsayılan halleder."
explanation: |
  Asıl iş trait'in **varsayılan metotlarında**: `kdvli_fiyat` ve `etiket` yalnızca `fiyat`, `kdv_yuzde`
  ve `ad`'ı kullanıyor; hangi tip olduğunu bilmiyorlar. Bu yüzden testlerdeki `Su` ve `Sakiz` gibi senin hiç
  görmediğin tipler bile, sadece iki-üç zorunlu metot yazarak doğru etiketi aldı. `Ekmek` yalnızca KDV'yi
  ezdi; `Kulaklik` hiçbir şeyi ezmedi.

  `ad` metodunda `self.marka.clone()` gerekti: elimizde yalnızca `&self` var ve dönüş tipi sahipli bir
  `String`; ödünç aldığın veriyi taşıyamazsın (Modül 4-5).

  **Para için tam sayı:** `f64` ile `1798.8` gibi değerler ikili tabanda tam temsil edilemez ve hesaplar
  biriktikçe kuruş hataları doğar. Gerçek finans yazılımları da en küçük birimi (kuruş, cent) tam sayı
  olarak tutar ya da özel ondalık tipler kullanır.

  **Taşmaya dikkat:** `self.fiyat() * 120` ara sonucu `u32` sınırını (4 294 967 295) yaklaşık
  35,8 milyon kuruşun (≈ 358 000 TL) üstündeki fiyatlarda aşar. Debug derlemede program panikler, release
  derlemede sessizce yanlış sonuç verir (Modül 2). Market için yeterli, ama gerçek bir sistemde para
  tutarlarını `u64` ile tutmak daha güvenlidir.
```

## Özet

:::remember
- `trait Ad { fn metot(&self) -> Tip; }` → bir davranış **sözleşmesi**; `impl Ad for Tip { ... }` →
  o sözleşmeyi bir tip için yerine getirmek.
- Gövdesiz metot **zorunludur**; gövdeli metot **varsayılandır** — tip isterse kullanır (boş impl `{}`),
  isterse ezer.
- Varsayılan metotlar trait'in zorunlu metotlarını çağırabilir: küçük çekirdek + bedava zengin davranış.
- Eksik zorunlu metot → `E0046`; trait'te olmayan metot → `E0407`; trait kapsamda değil → `E0599` (`use` et).
- Trait'lerde **alan yok, kalıtım yok**: bir tip birçok trait uygular; başkasının tipine de trait uygulayabilirsin.
:::

```reflect
prompt: |
  Rust trait'leri ile Java'daki sınıf kalıtımı arasındaki temel fark nedir? Rust'ın kalıtım yerine
  trait'leri seçmesinin bir faydasını kendi örneğinle anlat.
answer: |
  Kalıtımda alt sınıf, üst sınıfın hem verisini hem davranışını devralır ve sınıflar bir hiyerarşi oluşturur.
  Rust'ta veri struct/enum'larda durur, trait'ler yalnızca davranışı tarif eder; bir tip istediği kadar
  trait'i birbirinden bağımsız olarak uygular.

  Faydası: örneğin bir `Haber` tipine hem `Ozet` hem `Yazdirilabilir` hem `Karsilastirilabilir` davranışlarını
  ayrı ayrı ekleyebilirim; hepsini tek bir üst sınıfa sıkıştırmam gerekmez. Üst sınıftaki bir değişikliğin
  tüm alt sınıfları kırması (kırılgan taban sınıf) gibi bir sorun da olmaz. Üstelik `bool` gibi başkasının
  yazdığı bir tipe bile kendi trait'imle sonradan davranış ekleyebilirim.
```

```flashcards
- front: Trait nedir?
  back: Tiplerin paylaşabileceği davranışı metot imzalarıyla tanımlayan bir sözleşme (Java/C#'taki `interface`'e benzer).
- front: Bir tipe trait uygulamanın sözdizimi nedir?
  back: "`impl TraitAdi for TipAdi { ... }`"
- front: "`E0046: not all trait items implemented` ne anlama gelir?"
  back: Trait'in zorunlu (gövdesiz) bir metodu impl bloğunda yazılmamış.
- front: Zorunlu (required) metot ile varsayılan (provided) metot arasındaki fark nedir?
  back: "Zorunlu metodun trait'te gövdesi yoktur (`;` ile biter), her tip yazmak zorundadır. Varsayılan metodun gövdesi vardır; tip isterse kullanır, isterse ezer."
- front: Varsayılan bir metot, henüz hiçbir tipin yazmadığı bir zorunlu metodu çağırabilir mi? Neden?
  back: Evet. Trait, onu uygulayan her tipin zorunlu metodu sağlayacağını garanti eder.
- front: "Bir trait metodunu çağırırken `E0599` ve “items from traits can only be used if the trait is in scope” alırsan ne yaparsın?"
  back: "Trait'i kapsama alırsın: `use yol::TraitAdi;`"
- front: Trait'ler alan (field) içerebilir mi?
  back: Hayır. Trait'ler yalnızca davranış tanımlar; veri struct ve enum'larda durur.
```
