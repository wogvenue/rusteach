---
id: m08-l04
title: use, as ve pub use
minutes: 19
type: lesson
objectives:
  - "`use` ile bir yolu kapsama getirip uzun yolları kısaltabilmek ve `use`'un yalnızca yazıldığı modülde geçerli olduğunu açıklayabilmek"
  - Fonksiyonlar için üst modülü, tipler için öğenin kendisini getiren deyimsel `use` alışkanlığını uygulayabilmek
  - "Ad çakışmalarını `as` ile çözebilmek; iç içe yolları ve glob (`*`) içe aktarmaları yerinde kullanabilmek"
  - "`pub use` ile iç düzeni gizleyen sade bir dış API (vitrin) kurabilmek"
keywords: [use, as, "pub use", yeniden dışa aktarma, re-export, glob, prelude, kapsam, E0252, E0255, E0364, E0432, E0659]
---

Geçen dersin sonunda yollar uzadıkça uzadı: `crate::restoran::mutfak::firin::pisir`. Bir fonksiyonda bunu
beş kez yazdığını düşün; hem parmakların yorulur hem de asıl önemli kısım (`pisir`) gürültünün içinde
kaybolur.

Bu derste üç araç öğreneceksin: uzun yollara kısayol açan **`use`**, çakışan adlara takma ad veren
**`as`** ve iç düzenini gizleyip dışarıya sade bir yüz gösteren **`pub use`**.

## use: uzun yollara kısayol

Önce kısayolsuz hâli:

```rust,ignore
fn main() {
    println!("Fırın {} derece", crate::restoran::mutfak::firin::sicaklik());
    println!("{}", crate::restoran::mutfak::firin::pisir("Lahmacun"));
    println!("{}", crate::restoran::mutfak::firin::pisir("Pide"));
}
```

Şimdi `use` ile:

```rust
mod restoran {
    pub mod mutfak {
        pub mod firin {
            pub fn pisir(yemek: &str) -> String {
                format!("{yemek} fırında pişti")
            }

            pub fn sicaklik() -> u32 {
                220
            }
        }
    }
}

use crate::restoran::mutfak::firin;

fn main() {
    println!("Fırın {} derece", firin::sicaklik());
    println!("{}", firin::pisir("Lahmacun"));
    println!("{}", firin::pisir("Pide"));
}
```

`use crate::restoran::mutfak::firin;` satırı, bulunduğu modüle (burada crate kökü) `firin` adında bir
**kısayol** ekler. Artık `firin::pisir` yazmak, uzun yolu yazmakla tamamen aynıdır. Hiçbir şey
kopyalanmaz, hiçbir şey yüklenmez; `use` yalnızca **derleme zamanında** bir ad oluşturur ve çalışan
programa sıfır etkisi vardır.

:::analogy Masaüstü kısayolu
Bilgisayarındaki bir program `C:\Program Files\...` altında derinlerde durur. Masaüstüne bir
**kısayol** koyduğunda program yerinden kıpırdamaz; sadece ona buradan tek tıkla ulaşırsın. Kısayolu
silmek programı silmez ve kısayol yalnızca **konduğu masaüstünde** görünür. `use` da tam olarak böyledir:
öğe yerinde kalır, `use` yalnızca yazıldığı modüle bir kısayol ekler.
:::

```quiz
question: "`use crate::restoran::mutfak::firin;` satırı ne yapar?"
options:
  - "`firin` modülünün kodunu bu dosyaya kopyalar (C'deki `#include` gibi)"
  - Program çalışırken `firin` modülünü belleğe yükler (Python'daki `import` gibi)
  - Yalnızca derleme zamanında, bulunduğu modüle `firin` adında bir kısayol ekler
  - "`firin` modülünü `pub` yapar"
answer: 2
explanation: |
  `use` bir **ad bağlama** işlemidir: yazıldığı modülde, verilen yolu gösteren yeni bir ad oluşturur.
  Kod kopyalanmaz, çalışma zamanında hiçbir şey olmaz, kimsenin görünürlüğü de değişmez.
feedback:
  - "C'nin `#include`'u dosyanın metnini olduğu gibi kopyalar; Rust'ta başlık (header) dosyası yoktur ve `use` hiçbir şey kopyalamaz."
  - "Python'daki `import`, modülü çalışma zamanında yükleyip çalıştırır. Rust'ta her şey derleme zamanında çözülür."
  - Doğru!
  - "`use` görünürlüğü değiştirmez. Görünürlüğü dışarıya açan, dersin sonunda göreceğin `pub use`'dur."
```

`use` satırındaki yol da sıradan bir yoldur: yanlışsa hata `use` satırında çıkar ve derleyici benzer adları
önerir:

:::error
```text
error[E0432]: unresolved import `okul::notlar::ortlama`
 --> src/main.rs:9:5
  |
9 | use okul::notlar::ortlama;
  |     ^^^^^^^^^^^^^^-------
  |                   |
  |                   no `ortlama` in `okul::notlar`
  |
help: a similar name exists in the module
  |
9 | use okul::notlar::ortalama;
  |                      +
```
**E0432 (unresolved import):** `use` satırındaki yol hiçbir öğeye ulaşmıyor. Burada basit bir yazım
hatası var; derleyici doğru adı (`ortalama`) bulup eksik harfi `+` ile gösteriyor.
:::

:::info Prelude: her modüle kendiliğinden gelen kısayollar
Geçen dersteki soruyu hatırla: `String`'in tam yolu `std::string::String` olduğu hâlde neden hep kısaca
yazıyoruz? Çünkü derleyici her modülde, sanki görünmez bir `use std::prelude::rust_2024::*;` satırı
varmış gibi davranır. Bu **prelude** listesinde en sık kullanılan adlar vardır: `String`, `Vec`,
`Option`, `Some`, `None`, `Result`, `Ok`, `Err`, `Box`, `drop`... Listede olmayan her şeyi
(`std::cmp::max` gibi) ya tam yoluyla yazar ya da `use` ile getirirsin.

Teknik olarak prelude gerçek bir `use` satırı değil, **en düşük öncelikli** ayrı bir kapsamdır: modülde
aynı adla tanımladığın ya da `use` ile getirdiğin her şey prelude'deki adı hatasız gölgeler. (Bu yüzden
kütüphanelerde kendi `Result` tip takma adını tanımlayan kodlar görürsün.)
:::

## use yalnızca yazıldığı modülde geçerlidir

Masaüstü kısayolunun yalnızca konduğu masaüstünde göründüğünü söyledik. Bunu sınayalım:

```compiles
question: "`use std::cmp::max;` crate kökünde yazılmış. Alt modüldeki fonksiyon `max`'ı kullanabilir mi? Bu kod derlenir mi?"
code: |
  use std::cmp::max;

  mod istatistik {
      pub fn en_yuksek(notlar: [u32; 3]) -> u32 {
          max(notlar[0], max(notlar[1], notlar[2]))
      }
  }

  fn main() {
      println!("{}", istatistik::en_yuksek([72, 95, 88]));
  }
answer: false
error: E0425
explanation: |
  Derlenmez: **E0425 — cannot find function `max` in this scope**. `use`, kısayolu yalnızca
  **yazıldığı modüle** (burada crate kökü) ekler. `istatistik` ayrı bir modüldür ve Ders 3'te
  gördüğümüz gibi üst modülün adlarını devralmaz. Üstelik derleyici kökteki `use` için bir de
  "unused import" uyarısı verir: kökte `max`'ı kullanan kimse yok!
```

:::error
```text
error[E0425]: cannot find function `max` in this scope
 --> src/main.rs:5:9
  |
5 |         max(notlar[0], max(notlar[1], notlar[2]))
  |         ^^^ not found in this scope
  |
help: consider importing one of these functions
  |
4 +     use crate::max;
  |
4 +     use std::cmp::max;
  |
```
Derleyici iki çözüm öneriyor: `use std::cmp::max;` (asıl kaynağından getirmek) ya da `use crate::max;`
(kökteki `use`'un oluşturduğu adı yeniden kullanmak; `use` ile oluşan adlar da birer öğedir). En temizi,
`use` satırını **ihtiyaç duyulan modülün içine** taşımaktır:

```rust,ignore
mod istatistik {
    use std::cmp::max;

    pub fn en_yuksek(notlar: [u32; 3]) -> u32 {
        max(notlar[0], max(notlar[1], notlar[2]))
    }
}
```
:::

`use` bir fonksiyonun ya da bloğun içine de yazılabilir; o zaman kısayol yalnızca o blokta geçerlidir:

```rust
fn rapor(a: u32, b: u32) {
    use std::cmp::{max, min}; // yalnızca bu fonksiyonun içinde geçerli
    println!("Büyük: {}, küçük: {}", max(a, b), min(a, b));
}

fn main() {
    rapor(42, 17);
    // max(1, 2); // ← burada E0425: kısayol `rapor`'un dışında yok
}
```

Alıştırmalardaki testlerin başında gördüğün `use super::*;` satırı da tam bu yüzden var: test modülü
**ayrı bir modüldür**; üst modülün öğelerine erişme izni olsa da (alt modüldür) onların adlarını kendi
kapsamında bulamaz. `use super::*;` bir üst modüldeki bütün adları — gizli olanlar dahil — tek seferde
kapsama getirir (`*`'ı birazdan göreceksin).

Bir de önceki bir modülden soru:

```compiles
question: Modül 4'ü hatırla. `use` ile kısaltılmış yolu kullanan bu kod derlenir mi?
code: |
  mod bildirim {
      pub mod sms {
          pub fn gonder(metin: String) -> usize {
              metin.len()
          }
      }
  }

  use bildirim::sms;

  fn main() {
      let duyuru = String::from("Yarın okul tatil!");
      let uzunluk = sms::gonder(duyuru);
      println!("{uzunluk} bayt gönderildi: {duyuru}");
  }
answer: false
error: E0382
explanation: |
  `use` tarafında sorun yok: `sms::gonder` doğru bir yol. Ama `gonder` parametresini **sahiplenerek**
  (`String`) alıyor. `sms::gonder(duyuru)` çağrısında `duyuru`'nun sahipliği fonksiyona **taşınır**
  (move) ve sonraki satırda `duyuru`'yu kullanmak **E0382: borrow of moved value: `duyuru`** hatası
  verir. Düzeltmek için fonksiyon `&str` alabilir (`gonder(metin: &str)` ve `sms::gonder(&duyuru)`).

  `use` yalnızca bir **ad** getirir; sahiplik ve ödünç alma kuralları aynen geçerlidir.
```

## Deyimsel use ve as ile takma ad

Bir fonksiyonu iki şekilde kapsama getirebilirsin; ikisi de derlenir:

```rust,ignore
use crate::restoran::mutfak::firin::pisir; // fonksiyonun kendisi
pisir("Pide");

use crate::restoran::mutfak::firin; // fonksiyonun üst modülü
firin::pisir("Pide");
```

Rust topluluğunun yerleşik bir alışkanlığı (idiom) var:

- **Fonksiyonlar için üst modülü getir:** `firin::pisir(...)`. Kodu okuyan, `pisir`'in yerel bir
  fonksiyon olmadığını ve nereden geldiğini bir bakışta görür.
- **Struct, enum ve diğer öğeler için öğenin kendisini getir:** `use std::collections::HashMap;` ve
  ardından `HashMap::new()`. Tip adları zaten ayırt edicidir; her seferinde `collections::HashMap` yazmak
  gürültü olurdu.

Bu bir derleyici kuralı değil, bir alışkanlıktır; ama başkalarının kodunu okurken her yerde karşına
çıkacak.

```quiz
question: "`okul::notlar` modülünde `ortalama` fonksiyonu ve `Karne` struct'ı var. Rust alışkanlığına en uygun olan hangisi?"
options:
  - "`use crate::okul::notlar::ortalama;` ile `ortalama(&k)`; `use crate::okul::notlar;` ile `notlar::Karne { ... }`"
  - "`use crate::okul::notlar;` ile `notlar::ortalama(&k)`; `use crate::okul::notlar::Karne;` ile `Karne { ... }`"
  - "Her şeyi `use crate::okul::notlar::*;` ile getirmek"
  - Hiç `use` yazmamak, her yerde tam yolu kullanmak
answer: 1
explanation: |
  Fonksiyon için üst modül (`notlar::ortalama`), tip için öğenin kendisi (`Karne`). Böylece fonksiyonun
  nereden geldiği görünür kalır, tip adları da gereksiz yere uzamaz.
feedback:
  - Tam tersi! Fonksiyonda üst modülü, tipte öğenin kendisini getirmek alışkanlıktır.
  - Doğru!
  - Glob (`*`) nelerin geldiğini gizler; birazdan neden dikkatli kullanılması gerektiğini göreceksin.
  - Derlenir ama uzun yollar okunabilirliği düşürür; `use` tam da bunun için var.
```

Peki iki farklı modülde **aynı adı** taşıyan iki öğeyi getirmek istersen?

```compiles
code: |
  mod ogrenci {
      pub struct Kayit {
          pub ad: String,
      }
  }

  mod kitap {
      pub struct Kayit {
          pub ad: String,
      }
  }

  use kitap::Kayit;
  use ogrenci::Kayit;

  fn main() {
      let k = Kayit { ad: String::from("Elif") };
      println!("{}", k.ad);
  }
answer: false
error: E0252
explanation: |
  Derlenmez: **E0252 — the name `Kayit` is defined multiple times**. Bir modülde aynı ad (aynı ad
  alanında) iki kez bulunamaz; yoksa `Kayit { ... }` yazdığında hangisini kastettiğin belli olmazdı.
```

:::error
```text
error[E0252]: the name `Kayit` is defined multiple times
  --> src/main.rs:14:5
   |
13 | use kitap::Kayit;
   |     ------------ previous import of the type `Kayit` here
14 | use ogrenci::Kayit;
   |     ^^^^^^^^^^^^^^ `Kayit` reimported here
   |
   = note: `Kayit` must be defined only once in the type namespace of this module
help: you can use `as` to change the binding name of the import
   |
14 | use ogrenci::Kayit as OtherKayit;
   |                    +++++++++++++
```
Derleyici çözümü de söylüyor: **`as`** ile getirdiğin ada yeni bir ad (takma ad) ver.
:::

İki çözüm var. Ya üst modülleri getirip `kitap::Kayit` ile `ogrenci::Kayit` yazarsın ya da `as` ile
takma ad verirsin:

```rust
mod ogrenci {
    pub struct Kayit {
        pub ad: String,
        pub sinif: u8,
    }
}

mod kitap {
    pub struct Kayit {
        pub ad: String,
        pub sayfa: u32,
    }
}

use kitap::Kayit as KitapKaydi;
use ogrenci::Kayit as OgrenciKaydi;

fn main() {
    let o = OgrenciKaydi { ad: String::from("Elif"), sinif: 10 };
    let k = KitapKaydi { ad: String::from("Çalıkuşu"), sayfa: 431 };
    println!("{} ({}. sınıf), '{}' kitabını ödünç aldı ({} sayfa).", o.ad, o.sinif, k.ad, k.sayfa);
}
```

Standart kütüphanede de bunun ünlü bir örneği var: `std::fmt::Result` ile `std::io::Result` (`Result`'ı
Modül 10'da göreceksin). İkisine birden ihtiyaç duyan kod genellikle `use std::fmt;` ve `use std::io;`
yazıp `fmt::Result` ile `io::Result` der, ya da `use std::io::Result as IoResult;` gibi bir takma ad
kullanır.

## İç içe yollar ve glob (*)

Aynı yerden birkaç şey getireceksen satırları birleştirebilirsin:

```rust
mod okul {
    pub mod notlar {
        pub struct Karne {
            pub ad: String,
            pub puanlar: [u32; 3],
        }

        pub fn ortalama(k: &Karne) -> u32 {
            (k.puanlar[0] + k.puanlar[1] + k.puanlar[2]) / 3
        }
    }

    pub mod devamsizlik {
        pub const SINIR: u32 = 10;

        pub fn durum(gun: u32) -> &'static str {
            if gun > SINIR { "sınırı aştı" } else { "sorun yok" }
        }
    }
}

use okul::devamsizlik;
use okul::notlar::{self, Karne}; // `self` = notlar modülünün kendisi
use std::cmp::{max, min}; // aynı modülden iki fonksiyon

fn main() {
    let k = Karne { ad: String::from("Deniz"), puanlar: [78, 92, 85] };
    let p = k.puanlar;
    println!("{}: ortalama {}", k.ad, notlar::ortalama(&k));
    println!("En yüksek {}, en düşük {}", max(p[0], max(p[1], p[2])), min(p[0], min(p[1], p[2])));
    println!("12 gün devamsızlık: {}", devamsizlik::durum(12));
}
```

- `use std::cmp::{max, min};` ≡ `use std::cmp::max;` + `use std::cmp::min;`
- Süslü parantezin içindeki **`self`**, ortak yolun kendisini getirir: `use okul::notlar::{self, Karne};`
  hem `notlar` modülünü hem `Karne`'yi getirir. (`max` ve `min` gibi herkesin tanıdığı fonksiyonları
  doğrudan getirmek de yaygındır; alışkanlıklar katı kurallar değildir.)
- İç içe de yazılabilir: üstteki iki `okul` satırı tek satırda `use okul::{devamsizlik, notlar::{self, Karne}};`
  olurdu.

Bir modülde **erişebildiğin bütün** öğeleri tek seferde getirmek için **glob** operatörü `*` kullanılır:
`use okul::notlar::*;`. Dışarıdan bakan biri için bu, o modülün `pub` öğeleri demektir; bir alt modülden
`use super::*;` yazan için ise üst modülün gizli öğeleri de dahildir (alt modül onları görebildiği için).
Kulağa pratik geliyor, ama bir sürprizi var:

```predict
question: Hem glob ile gelen hem de kökte tanımlı bir `selamla` var. Bu program ne yazdırır?
code: |
  mod araclar {
      pub fn selamla() -> &'static str {
          "araçlar modülünden merhaba"
      }

      pub fn veda() -> &'static str {
          "araçlar modülünden hoşça kal"
      }
  }

  use araclar::*;

  fn selamla() -> &'static str {
      "kökten merhaba"
  }

  fn main() {
      println!("{}", selamla());
      println!("{}", veda());
  }
options:
  - |
    kökten merhaba
    araçlar modülünden hoşça kal
  - |
    araçlar modülünden merhaba
    araçlar modülünden hoşça kal
  - "Derlenmez: `selamla` iki kez tanımlanmış (E0255)"
answer: 0
explanation: |
  Derlenir ve yereldeki `selamla` kazanır. Glob ile gelen adlar, modülün kendi adlarından **daha düşük
  önceliğe** sahiptir: modülde aynı adla açıkça tanımlanmış (ya da açıkça `use` edilmiş) bir öğe varsa
  glob'dan geleni **sessizce gölgeler**. Hata yok! Derleyicinin tek ipucu, hiç kullanılmayan
  `araclar::selamla` için verdiği "function `selamla` is never used" uyarısıdır.

  `use araclar::selamla;` diye açıkça yazsaydın **E0255** alırdın: "the name `selamla` is defined
  multiple times" (bir `use` ile yerel bir tanım çakışıyor; iki `use` çakışsaydı kod E0252 olurdu). Glob
  ise bu çakışmayı göz yumarak geçiştirir. Glob'ların asıl tehlikesi budur.
```

Glob'u dikkatli kullanmanın üç nedeni var:

1. **Adın nereden geldiği görünmez.** Kodu okuyan biri `rapor()`'u gördüğünde onu hangi modülde
   arayacağını bilemez.
2. **Sessiz gölgeleme:** Yukarıda gördüğün gibi yerel bir tanım, glob'dan geleni hatasız gizler.
3. **Gelecekteki çakışmalar:** İki glob aynı adı getirirse ve sen o adı kullanırsan derleme kırılır.
   Daha kötüsü, bugün sorunsuz derlenen kod, kullandığın kütüphane yarın yeni bir öğe eklediğinde
   kırılabilir.

:::error
```text
error[E0659]: `rapor` is ambiguous
  --> src/main.rs:17:20
   |
17 |     println!("{}", rapor());
   |                    ^^^^^ ambiguous name
   |
   = note: ambiguous because of multiple glob imports of a name in the same module
note: `rapor` could refer to the function imported here
  --> src/main.rs:13:5
   |
13 | use hava::*;
   |     ^^^^^^^
   = help: consider adding an explicit import of `rapor` to disambiguate
note: `rapor` could also refer to the function imported here
  --> src/main.rs:14:5
   |
14 | use trafik::*;
   |     ^^^^^^^^^
   = help: consider adding an explicit import of `rapor` to disambiguate
```
`use hava::*;` ve `use trafik::*;` ikisi de bir `rapor` fonksiyonu getiriyor. Derleyici tahmin
yürütmez: **E0659 (ambiguous)** verir ve hangisini istediğini açıkça yazmanı ister.
:::

Glob'un yerinde olduğu yerler de var: **test modülleri** (`use super::*;` test edilen modülün her şeyini
getirir) ve bazı crate'lerin bu iş için hazırladığı `prelude` modülleri (`use bir_crate::prelude::*;`).
Bunların dışında açık adları tercih et.

## pub use: iç düzeni gizleyen vitrin

Şu ana kadar `use` ile getirdiğimiz adlar **gizliydi**: yalnızca yazıldıkları modülün (ve alt
modüllerinin) işine yarıyordu. Başına `pub` koyarsan kısayol da dışarıya açılır. Buna **yeniden dışa
aktarma (re-export)** denir.

Neden isteyesin? Büyük bir kütüphanenin içi, onu **yazanlar** için mantıklı biçimde düzenlenir:
`karakter`, `savas`, `harita`... Ama onu **kullananlar** bu düzeni bilmek zorunda olmamalı.
`oyun::karakter::Karakter` yerine `oyun::Karakter` yazabilmeliler:

```rust
mod oyun {
    // Vitrin: oyunu kullananların bilmesi gereken her şey burada
    pub use karakter::Karakter;
    pub use savas::saldir as vur;

    mod karakter {
        pub struct Karakter {
            pub ad: String,
            pub can: u32,
        }

        impl Karakter {
            pub fn yeni(ad: &str) -> Karakter {
                Karakter { ad: String::from(ad), can: 100 }
            }
        }
    }

    mod savas {
        use super::karakter::Karakter;

        pub fn saldir(hedef: &mut Karakter, guc: u32) {
            hedef.can = hedef.can.saturating_sub(guc);
        }
    }
}

fn main() {
    let mut ejderha = oyun::Karakter::yeni("Ejderha");
    oyun::vur(&mut ejderha, 30);
    oyun::vur(&mut ejderha, 45);
    println!("{} canı: {}", ejderha.ad, ejderha.can);
    // oyun::karakter::Karakter::yeni("Ork"); // ← E0603: module `karakter` is private
}
```

`karakter` ve `savas` modülleri **gizli**; dışarıdan kimse onlara doğrudan ulaşamaz. Ama içlerindeki
`pub` öğeleri vitrinden (`pub use`) dışarı açtık; `as` ile `saldir`'a dışarıda `vur` adını bile verdik.
Artık iç düzeni istediğin gibi değiştirebilirsin (`savas`'ın adını `dovus` yapmak, onu ikiye bölmek...).
Vitrin satırları aynı kaldıkça oyunu kullanan **hiç kimsenin** kodu kırılmaz.

:::analogy Mağaza vitrini
Bir mağazanın deposu çalışanların işine göre düzenlenir: koliler, raflar, bölümler. Müşteri ise depoya
girmez; vitrine bakar ve istediğini oradan alır. Depoyu baştan düzenlesen bile vitrin aynıysa müşteri
hiçbir şey fark etmez. `pub use` satırları senin vitrinin, gizli alt modüller ise deponundur.
:::

Bu kalıp her yerde var. Standart kütüphanenin bir kısmı aslında `core` ve `alloc` adlı iki crate'in üstüne
kurulmuş bir vitrindir: `std::option::Option` aslında `core::option::Option`'dır, `String` ise `alloc`
crate'inde tanımlanır; `std` onları `pub use` ile yeniden dışa aktarır. docs.rs'de bir crate'in
belgelerinde **"Re-exports"** başlığını gördüğünde de karşındaki şey `pub use` satırlarıdır.

Bir sınır var: `pub use` yalnızca **senin görebildiğin** bir öğeyi dışarı açabilir. Gizli bir öğeyi
vitrine koymaya çalışırsan Ders 2'deki tanıdık hatayı alırsın:

:::error
```text
error[E0603]: constant `ZORLUK` is private
 --> src/main.rs:2:22
  |
2 |     pub use ayarlar::ZORLUK;
  |                      ^^^^^^ private constant
  |
note: the constant `ZORLUK` is defined here
 --> src/main.rs:5:9
  |
5 |         const ZORLUK: u32 = 3;
  |         ^^^^^^^^^^^^^^^^^^^^^^
```
`oyun` modülü, alt modülü `ayarlar`'ın gizli `ZORLUK` sabitini göremez; göremediği şeyi vitrine de
koyamaz. Çözüm: sabiti `ayarlar` içinde `pub const ZORLUK` yapmak. Modül `ayarlar` gizli kalabilir;
dışarıya yalnızca vitrin üzerinden açılır.
:::

İkinci sınır: `pub use` bir öğeyi **kendi görünürlüğünden daha geniş** açamaz. Görebildiğin ama gizli
(ya da yalnızca `pub(crate)`) olan bir öğeyi `pub use` ile dışarı vermeye kalkarsan **E0364** alırsın:
``error[E0364]: `f` is only public within the crate, and cannot be re-exported outside``. Vitrin, depoda
zaten `pub` olan malı sergiler; gizli malı vitrine koyarak açığa çıkaramazsın.

## Alıştırma: Kütüphanenin vitrini

Önce küçük bir vitrin kur:

```fill
prompt: |
  `sinema` modülünün içi gizli bir `salon` modülüyle düzenlenmiş. `main`'in yazdığı yollar çalışsın diye
  boşlukları doldur: `Bilet` vitrinden aynı adla, `satis_yap` ise `bilet_al` adıyla açılsın. Son boşluk,
  `gise` modülünün `Bilet`'i bulmasını sağlıyor.
code: |
  mod sinema {
      ___0 salon::koltuk::Bilet;
      pub use salon::gise::satis_yap ___1 bilet_al;

      mod salon {
          pub mod koltuk {
              pub struct Bilet {
                  pub film: String,
                  pub koltuk: String,
              }
          }

          pub mod gise {
              use ___2::koltuk::Bilet;

              pub fn satis_yap(film: &str, sira: char, no: u32) -> Bilet {
                  Bilet { film: String::from(film), koltuk: format!("{sira}{no}") }
              }
          }
      }
  }

  fn main() {
      let b: sinema::Bilet = sinema::bilet_al("Babam ve Oğlum", 'F', 7);
      println!("{} — koltuk {}", b.film, b.koltuk);
  }
blanks:
  - ["pub use"]
  - ["as"]
  - ["super", "crate::sinema::salon"]
output: "Babam ve Oğlum — koltuk F7"
explanation: |
  - `pub use salon::koltuk::Bilet;` → `Bilet` artık `sinema::Bilet` yolundan da görünür.
  - `pub use salon::gise::satis_yap as bilet_al;` → aynı fonksiyon dışarıda `sinema::bilet_al` adıyla
    çağrılır.
  - `use super::koltuk::Bilet;` → `gise`'nin üst modülü `salon`'dur ve `koltuk` onun içindedir. Bu satır
    `pub` değil: kısayol yalnızca `gise`'nin işine yarıyor.

  `salon` modülü gizli kaldığı için `main` hiçbir zaman `sinema::salon::...` yazamaz; tek kapı vitrindir.
```

Şimdi daha büyük bir vitrin:

````exercise
id: m08-e-kutuphane-vitrini
title: Kütüphanenin vitrini
difficulty: 2
prompt: |
  `kutuphane` modülünün içi kalabalık: `Kitap` üç kat derinde, arama fonksiyonu başka bir alt modülde,
  ceza hesabı da `odunc` modülünde. Kütüphaneyi kullananlar bu iç düzeni bilmek zorunda kalmasın.

  1. `katalog::arama::yazara_gore` fonksiyonunu tamamla: raftaki kitaplardan yazarı verilen yazar olanların
     **sayısını** döndürsün.
  2. `kutuphane` modülünün en üstüne bir **vitrin** kur. Dışarıdaki kod şu yolları kullanabilmeli:
     - `kutuphane::Kitap`
     - `kutuphane::yazara_gore`
     - `kutuphane::gecikme_cezasi` (bu, içerideki `odunc::ceza_hesapla` fonksiyonudur; sarmalayıcı bir
       fonksiyon yazma, `pub use ... as ...` ile yeni adla aç)
  3. İç modüller (`katalog` ve `odunc`) **gizli** kalsın.
starter: |
  mod kutuphane {
      // ---- Vitrin: dışarıya açılan her şey burada ----
      // TODO: `pub use` satırlarını buraya yaz.

      mod katalog {
          pub mod kitap {
              pub struct Kitap {
                  pub baslik: String,
                  pub yazar: String,
                  pub sayfa: u32,
              }

              impl Kitap {
                  pub fn yeni(baslik: &str, yazar: &str, sayfa: u32) -> Kitap {
                      Kitap {
                          baslik: String::from(baslik),
                          yazar: String::from(yazar),
                          sayfa,
                      }
                  }
              }
          }

          pub mod arama {
              use super::kitap::Kitap;

              /// Raftaki kitaplardan yazarı `yazar` olanların sayısını döndürür.
              pub fn yazara_gore(raf: &[Kitap], yazar: &str) -> usize {
                  todo!()
              }
          }
      }

      mod odunc {
          /// Geciken gün başına 5 TL, ama en fazla 100 TL.
          pub fn ceza_hesapla(geciken_gun: u32) -> u32 {
              std::cmp::min(geciken_gun * 5, 100)
          }
      }
  }

  fn main() {
      // Vitrini kurunca bu satırları açabilirsin:
      // let raf = [kutuphane::Kitap::yeni("Tutunamayanlar", "Oğuz Atay", 724)];
      // println!("{}", kutuphane::yazara_gore(&raf, "Oğuz Atay"));
  }
solution: |
  mod kutuphane {
      // ---- Vitrin: dışarıya açılan her şey burada ----
      pub use katalog::arama::yazara_gore;
      pub use katalog::kitap::Kitap;
      pub use odunc::ceza_hesapla as gecikme_cezasi;

      mod katalog {
          pub mod kitap {
              pub struct Kitap {
                  pub baslik: String,
                  pub yazar: String,
                  pub sayfa: u32,
              }

              impl Kitap {
                  pub fn yeni(baslik: &str, yazar: &str, sayfa: u32) -> Kitap {
                      Kitap {
                          baslik: String::from(baslik),
                          yazar: String::from(yazar),
                          sayfa,
                      }
                  }
              }
          }

          pub mod arama {
              use super::kitap::Kitap;

              /// Raftaki kitaplardan yazarı `yazar` olanların sayısını döndürür.
              pub fn yazara_gore(raf: &[Kitap], yazar: &str) -> usize {
                  let mut sayi = 0;
                  for kitap in raf {
                      if kitap.yazar == yazar {
                          sayi += 1;
                      }
                  }
                  sayi
              }
          }
      }

      mod odunc {
          /// Geciken gün başına 5 TL, ama en fazla 100 TL.
          pub fn ceza_hesapla(geciken_gun: u32) -> u32 {
              std::cmp::min(geciken_gun * 5, 100)
          }
      }
  }

  fn main() {
      let raf = [
          kutuphane::Kitap::yeni("Tutunamayanlar", "Oğuz Atay", 724),
          kutuphane::Kitap::yeni("Tehlikeli Oyunlar", "Oğuz Atay", 503),
      ];
      let ilk = &raf[0];
      println!("{} — {} ({} sayfa)", ilk.baslik, ilk.yazar, ilk.sayfa);
      println!("Oğuz Atay: {} kitap", kutuphane::yazara_gore(&raf, "Oğuz Atay"));
      println!("10 gün gecikme cezası: {} TL", kutuphane::gecikme_cezasi(10));
  }
check: tests
tests: |
  #[test]
  fn kitap_vitrinden_olusturulur() {
      let k = kutuphane::Kitap::yeni("Tutunamayanlar", "Oğuz Atay", 724);
      assert_eq!(k.baslik, "Tutunamayanlar", "başlık korunmalı");
      assert_eq!(k.yazar, "Oğuz Atay", "yazar korunmalı");
      assert_eq!(k.sayfa, 724, "sayfa sayısı korunmalı");
  }

  #[test]
  fn yazara_gore_sayar() {
      let raf = [
          kutuphane::Kitap::yeni("Tutunamayanlar", "Oğuz Atay", 724),
          kutuphane::Kitap::yeni("Saatleri Ayarlama Enstitüsü", "Ahmet Hamdi Tanpınar", 382),
          kutuphane::Kitap::yeni("Tehlikeli Oyunlar", "Oğuz Atay", 503),
      ];
      assert_eq!(kutuphane::yazara_gore(&raf, "Oğuz Atay"), 2, "rafta Oğuz Atay'ın 2 kitabı var");
      assert_eq!(kutuphane::yazara_gore(&raf, "Ahmet Hamdi Tanpınar"), 1, "rafta Tanpınar'ın 1 kitabı var");
      assert_eq!(kutuphane::yazara_gore(&raf, "Sait Faik"), 0, "rafta Sait Faik kitabı yok");
      assert_eq!(kutuphane::yazara_gore(&[], "Oğuz Atay"), 0, "boş rafta sonuç 0 olmalı");
  }

  #[test]
  fn gecikme_cezasi_vitrinde() {
      assert_eq!(kutuphane::gecikme_cezasi(0), 0, "gecikme yoksa ceza da yok");
      assert_eq!(kutuphane::gecikme_cezasi(4), 20, "4 gün gecikme 20 TL olmalı");
      assert_eq!(kutuphane::gecikme_cezasi(60), 100, "ceza en fazla 100 TL olmalı");
  }
hints:
  - |
    Vitrin satırları `kutuphane` modülünün içine, en üste yazılır; yol `kutuphane`'den başlayan göreli
    bir yoldur. Örneğin: `pub use katalog::kitap::Kitap;`
  - |
    `yazara_gore` için de bir `pub use` satırı gerekir. `odunc::ceza_hesapla` ise dışarıda başka bir adla
    görünmeli: `pub use odunc::ceza_hesapla as ...;`
  - |
    `yazara_gore`: `let mut sayi = 0;` ile başla, `for kitap in raf` ile kitapları dolaş,
    `kitap.yazar == yazar` ise `sayi += 1;` yap ve sonunda `sayi`'yı döndür.
forbid:
  - pattern: "pub(\\([^)]*\\))?\\s+mod\\s+(katalog|odunc)\\b"
    message: "İç modülleri açma! Dışarıya yalnızca vitrin (`pub use`) üzerinden ulaşılmalı."
require:
  - pattern: "pub\\s+use\\s"
    message: "Vitrini `pub use` satırlarıyla kur."
  - pattern: "as\\s+gecikme_cezasi"
    message: "`ceza_hesapla`'yı dışarıya `as gecikme_cezasi` ile, yeni bir adla aç."
explanation: |
  Vitrin üç satırdan ibaret:

  ```rust
  pub use katalog::arama::yazara_gore;
  pub use katalog::kitap::Kitap;
  pub use odunc::ceza_hesapla as gecikme_cezasi;
  ```

  `katalog` ve `odunc` gizli kaldığı hâlde içlerindeki `pub` öğeleri dışarı açabildin; çünkü `kutuphane`
  kendi alt modüllerinin `pub` öğelerini görebilir ve `pub use` onları bir kat dışarıya taşır.
  Kullanıcılar artık yalnızca `kutuphane::Kitap`, `kutuphane::yazara_gore` ve
  `kutuphane::gecikme_cezasi`'yı bilir. Yarın `arama` modülünü `sorgu` diye yeniden adlandırsan ya da
  `odunc`'u ikiye bölsen bile vitrin satırlarını güncellemen yeter; dışarıdaki kimsenin kodu kırılmaz.

  `yazara_gore`'deki `kitap.yazar == yazar` karşılaştırmasında sol taraf `String`, sağ taraf `&str`;
  Rust bu ikisini doğrudan karşılaştırabilir.
````

## Özet

:::remember
- `use yol;` bulunduğu modüle bir **kısayol** ekler: derleme zamanında bir ad; kopyalama ya da
  çalışma zamanı etkisi yok.
- `use` yalnızca **yazıldığı modülde** (ya da blokta) geçerlidir; alt modüller onu devralmaz.
  Testlerdeki `use super::*;` bu yüzden var.
- Alışkanlık: fonksiyonlarda **üst modülü** (`firin::pisir()`), tiplerde **öğenin kendisini**
  (`use std::collections::HashMap;`) getir.
- Ad çakışmasında (iki `use` → E0252, `use` ile yerel tanım → E0255) `as` ile takma ad ver ya da üst
  modülleri getir.
- `use a::{b, c};` iç içe yol; `{self, X}` modülün kendisini de getirir. Glob (`*`) adların kaynağını
  gizler ve yerel tanımlarca sessizce gölgelenir; testler ve prelude'ler dışında idareli kullan.
- `pub use` = **vitrin**: iç modüller gizli kalırken seçtiğin öğeleri sade yollarla dışarıya açar.
  Göremediğin öğeyi (E0603) ya da kendisinden daha az görünür bir öğeyi (E0364) vitrine koyamazsın.
- Prelude, `String`, `Vec`, `Option` gibi adları her modüle kendiliğinden getirir; en düşük öncelikli
  kapsamdır, kendi tanımların onu gölgeler.
:::

```reflect
prompt: |
  `pub use` ile kurulan bir "vitrin", bir kütüphaneyi kullananlar için neden değerlidir? Kütüphanenin
  iç düzeni değiştiğinde ne olacağını düşünerek açıkla.
answer: |
  Model cevap: Vitrin, kütüphanenin dış dünyaya verdiği sözü iç düzeninden ayırır. Kullanıcılar
  `oyun::Karakter` gibi kısa ve sabit yolları kullanır; `karakter`, `savas` gibi iç modüllerin varlığından
  haberleri bile olmaz. Kütüphaneyi yazan kişi iç modülleri yeniden adlandırabilir, bölebilir ya da
  birleştirebilir; tek yapması gereken `pub use` satırlarını güncellemektir. Böylece kullanıcıların kodu
  kırılmaz ve iç modüller gizli kaldığı için kimse yanlışlıkla iç ayrıntılara bağımlı hâle gelmez.
```

```flashcards
- front: "`use` çalışma zamanında ne yapar?"
  back: "Hiçbir şey. Derleme zamanında, yazıldığı modüle bir kısayol (ad) ekler; kod kopyalamaz ya da yüklemez."
- front: Kökte yazılan bir `use`, alt modüllerde de geçerli midir?
  back: "Hayır. `use` yalnızca yazıldığı modülde (ya da blokta) geçerlidir; alt modülün kendi `use`'u gerekir."
- front: Fonksiyonlar ve tipler için deyimsel `use` nasıl yazılır?
  back: "Fonksiyonda üst modülü getir (`firin::pisir()`), tipte öğenin kendisini (`use std::collections::HashMap;`)."
- front: İki modülden aynı adlı iki tip getirmek E0252 verir. Çözüm?
  back: "`use kitap::Kayit as KitapKaydi;` gibi `as` ile takma ad ya da üst modülleri getirip `kitap::Kayit` yazmak."
- front: "`use okul::notlar::{self, Karne};` neleri getirir?"
  back: "`notlar` modülünün kendisini ve `Karne`'yi."
- front: Glob (`use x::*;`) ile gelen bir adla aynı adlı yerel bir öğe varsa ne olur?
  back: Yerel öğe kazanır ve glob'dan geleni hatasız, sessizce gölgeler.
- front: "`pub use` ne işe yarar?"
  back: "Yeniden dışa aktarır: bir öğeyi bu modülün yolundan da (ör. `oyun::Karakter`) dışarıya açar; iç modüller gizli kalabilir."
- front: Prelude nedir?
  back: "Derleyicinin her modüle kendiliğinden getirdiği sık kullanılan adlar listesi (`String`, `Vec`, `Option`, `Some`, `None`...)."
```
