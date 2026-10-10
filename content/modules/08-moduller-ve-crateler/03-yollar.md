---
id: m08-l03
title: "Yollar: crate::, super:: ve self::"
minutes: 17
type: lesson
objectives:
  - "`crate::` ile başlayan mutlak yolları ve bir adla, `self::` ya da `super::` ile başlayan göreli yolları ayırt edebilmek"
  - Modül ağacının herhangi bir noktasından bir öğeye giden doğru yolu yazabilmek
  - Kod taşındığında hangi yolun neden kırılacağını önceden tahmin edebilmek
  - E0425 ve E0433 yol hatalarını okuyup derleyicinin önerileriyle düzeltebilmek
keywords: [yol, path, "crate::", "super::", "self::", mutlak yol, göreli yol, E0425, E0433]
---

Kargo görevlisine adresini verirken "Türkiye, İzmir, Konak, Lale Sokak No: 7" dersin. Aynı apartmandaki
komşuna ise "bir kat yukarı" demen yeter. İki tarif de aynı kapıya çıkar; ama ilki nereden bakılırsa
bakılsın işe yarar, ikincisi yalnızca **bulunduğun yerden** anlamlıdır.

Rust'ta modül ağacındaki bir öğeye ulaşmak için yazdığın **yollar (paths)** da tam olarak böyle çalışır.
Bu derste iki çeşit yolu, yolları kurarken kullanacağın üç anahtar kelimeyi (`crate`, `self`, `super`)
ve kod taşındığında hangisinin neden kırıldığını öğreneceksin.

## Yol: modül ağacındaki adres

Önceki derslerde `banka::faiz_hesapla()` gibi yolları zaten yazdın. Bir **yol**, `::` ile ayrılmış
adlardan oluşur ve modül ağacındaki bir öğeyi gösterir. İki çeşidi vardır:

- **Mutlak yol (absolute path):** crate kökünden başlar. Kendi crate'indeki öğeler için `crate`
  anahtar kelimesiyle başlar.
- **Göreli yol (relative path):** bulunduğun modülden başlar. Bu modüldeki bir öğenin **adıyla**,
  `self` ya da `super` ile başlar.

```rust
mod restoran {
    pub mod mutfak {
        pub mod firin {
            pub fn pisir(yemek: &str) {
                println!("  Fırında pişiyor: {yemek}");
            }
        }
    }

    pub mod salon {
        pub fn siparis_al(yemek: &str) {
            println!("Sipariş: {yemek}");
            // Mutlak yol: crate kökünden başlar
            crate::restoran::mutfak::firin::pisir(yemek);
            // Göreli yol: bir üst modülden (restoran) başlar
            super::mutfak::firin::pisir("ekmek");
        }
    }
}

fn main() {
    // main crate kökünde; `restoran` da kökte tanımlı, adıyla başlayabiliriz (göreli yol)
    restoran::salon::siparis_al("lahmacun");
    // Aynı fonksiyona mutlak yolla da ulaşılır:
    crate::restoran::salon::siparis_al("pide");
}
```

Ağaçta iki yolun nasıl yürüdüğüne bak:

```text
crate                        ← crate kökü (src/main.rs)
├── main
└── restoran
    ├── mutfak
    │   └── firin
    │       └── pisir
    └── salon
        └── siparis_al       ← buradan pisir'e iki yol var:
                                crate::restoran::mutfak::firin::pisir   (mutlak: kökten in)
                                super::mutfak::firin::pisir             (göreli: bir üste çık, sonra in)
```

Dosya sistemini biliyorsan bu sana tanıdık gelecek:

| Dosya sistemi | Rust | Anlamı |
|---|---|---|
| `/` (en baştaki) | `crate` | crate kökü |
| `.` | `self` | bulunduğun modül |
| `..` | `super` | bir üst (ebeveyn) modül |
| `/` (ayraç) | `::` | "...'nin içindeki" |
| `/home/elif/notlar.txt` | `crate::restoran::salon::siparis_al` | mutlak yol |
| `../mutfak/firin` | `super::mutfak::firin` | göreli yol |

:::analogy Tam adres ve yol tarifi
Mutlak yol, kargo paketinin üzerindeki **tam adres** gibidir: Paketi hangi şehirden gönderirsen gönder
aynı kapıya ulaşır. Göreli yol ise komşuna verdiğin **yol tarifidir**: "iki kat yukarı, sağdaki kapı".
Kısa ve pratiktir ama yalnızca bulunduğun yerden anlamlıdır; aynı tarifi başka bir binada verirsen yanlış
kapıya çıkarsın.
:::

:::info Diğer dillerde
- **C++** da `::` kullanır; `::isim` global ad alanından başlar, Rust'taki `crate::`'e benzer.
- **Python**'da `from . import x` aynı paketten, `from .. import x` üst paketten içe aktarır: Rust'taki
  `self` ve `super`'in karşılığı. Mutlak içe aktarma ise paketin adından başlar.
- **Java**'da tam nitelikli ad (`java.util.List`) her zaman paket kökünden başlar; "bir üst paket"
  diye göreli bir yazım yoktur.
:::

Mutlak yollarla ilgili bir tahminle devam edelim:

```compiles
question: "`PARA_BIRIMI` crate kökünde ve **gizli** (başında `pub` yok). Üç kat derindeki `fis` modülü ona ulaşabilir mi? Bu kod derlenir mi?"
code: |
  const PARA_BIRIMI: &str = "TL";

  mod magaza {
      pub mod kasa {
          pub mod fis {
              pub fn yazdir(tutar: u32) {
                  println!("Toplam: {tutar} {}", crate::PARA_BIRIMI);
              }
          }
      }
  }

  fn main() {
      magaza::kasa::fis::yazdir(150);
  }
answer: true
explanation: |
  Derlenir ve `Toplam: 150 TL` yazdırır. İki kural birlikte çalışıyor:

  - **Yol:** `crate::PARA_BIRIMI` kökten başlar; ağacın neresinde yazılırsa yazılsın aynı sabiti gösterir.
  - **Gizlilik:** Gizli bir öğe, tanımlandığı modülde **ve bütün alt modüllerinde** görünür (Ders 2).
    Crate kökü herkesin atasıdır; bu yüzden kökteki gizli öğeler crate'in **her yerinden** görülebilir.
```

`crate::` ile başlayan bir yol, adres defterindeki **tam adres** gibidir: kodu hangi modüle koyarsan koy
aynı yeri gösterir. Uzun ama belirsizlik yoktur.

Bir ayrıntı: `crate` kelimesi her zaman **içinde bulunduğun** crate'in köküdür. Başka bir crate'in
öğelerine ise o crate'in **adıyla** başlayan yollarla ulaşırsın. Aslında bunu çoktan biliyorsun:
Modül 4'ten beri kullandığın `std::mem::size_of` ya da `std::cmp::max` gibi yollar `std` crate'inin
kökünden başlar. Evet, standart kütüphane de bir crate!
Kendi library crate'ini (Ders 5) ve crates.io'dan eklenen crate'leri (Ders 6) de böyle adlarıyla
kullanacaksın.

:::deep Neden ayrı bir `crate` anahtar kelimesi var?
Rust 2015 sürümünde (edition) `use` bildirimlerindeki yollar her zaman kökten, kodun geri kalanındaki
yollar ise bulunduğun modülden çözülüyordu; aynı yazım iki yerde farklı anlama gelebiliyordu. Rust 2018
bu karışıklığı giderdi: kök artık açıkça `crate` diye yazılıyor ve yollar her yerde aynı kurallarla
çözülüyor. Eski kodlarda `extern crate rand;` gibi satırlar görürsen o döneme ait olduğunu bil; bugün
`Cargo.toml`'a eklenen dış crate'ler için bu satıra gerek yoktur. `::std::cmp::max` gibi `::` ile başlayan yollar ise bugün
"bu adı taşıyan **dış crate**" anlamına gelir; çoğunlukla makroların içinde karşına çıkar.
:::

## self:: ve super:: — bulunduğun yerden yürümek

Göreli yollar bulunduğun modülden başlar ve ağaçta yukarı ya da aşağı yürür:

- **`super`**: bir üst modül (dosya sistemindeki `..`). `super::super` iki üst modüldür.
- **`self`**: bulunduğun modül (dosya sistemindeki `.`). Aşağıdaki örnekte `self::sinif::kart` ile
  `sinif::kart` aynı şeydir; `self` çoğu zaman yalnızca "bu modüldeki" vurgusunu yapar. Tek bir ince
  farkı var: `self::` **yalnızca** bu modüldeki adlara bakar; yalın `sinif::` ise bu modülde öyle bir ad
  yoksa aynı adı taşıyan bir **dış crate**'e de çıkabilir (dış crate'ler Ders 6'da). `self::` yazmak,
  yolun kesinlikle bu modülden başladığını garanti eder. (Bir sonraki dersteki `use` listelerinde
  `self` gerçekten işe yarayacak.)

```rust
mod okul {
    const OKUL_ADI: &str = "Atatürk Fen Lisesi";

    pub mod sinif {
        pub fn kart(ad: &str, sube: &str) -> String {
            format!("{ad} · 10-{sube}")
        }

        pub mod kulup {
            pub fn uye_karti(ad: &str) -> String {
                let ogrenci = super::kart(ad, "B"); // super → sinif
                let okul = super::super::OKUL_ADI; // super::super → okul
                format!("[{okul} Robotik Kulübü] {ogrenci}")
            }
        }
    }

    pub fn tanit() {
        println!("{}", self::sinif::kart("Elif", "A")); // self → okul (bu modül)
        println!("{}", sinif::kulup::uye_karti("Can")); // self:: yazmadan da aynısı
    }
}

fn main() {
    okul::tanit();
}
```

```text
crate
└── okul              OKUL_ADI (gizli), tanit
    └── sinif         kart
        └── kulup     uye_karti   ← super = sinif, super::super = okul
```

`kulup`, gizli `OKUL_ADI` sabitini `super::super::OKUL_ADI` ile okuyabiliyor; çünkü `okul`'un
torunudur ve alt modüller atalarının gizli öğelerini görür.

```quiz
question: "`crate::a::b::c` modülündeki bir fonksiyonun içinde `super::super::f()` yazıyorsun. Hangi `f` çağrılır?"
options:
  - "`crate::a::b::c::f`"
  - "`crate::a::b::f`"
  - "`crate::a::f`"
  - "`crate::f`"
answer: 2
explanation: |
  İlk `super` bir üst modüle çıkar: `c`'den `b`'ye. İkinci `super` bir kat daha çıkar: `b`'den `a`'ya.
  Yani `super::super::f` ≡ `crate::a::f`. Dosya sistemindeki `../../f` gibi.
feedback:
  - "Bu, `self::f` (ya da yalnızca `f`) olurdu; `super` hiç yukarı çıkmadın."
  - "Bu, tek bir `super` ile olurdu: `super::f`."
  - Doğru!
  - "Köke çıkmak için üç `super` gerekirdi (`super::super::super::f`) ya da kısaca `crate::f`."
```

## Görmek, adıyla çağırmak demek değildir

Şimdi çok sık yapılan bir hataya bakalım. Alt modüller atalarının öğelerini **görebiliyorsa**, onları
adıyla doğrudan çağırabilirler mi?

```compiles
question: Alt modüller atalarının öğelerini görebilir (Ders 2). Peki bu kod derlenir mi?
code: |
  mod market {
      pub fn indirim_orani() -> u32 {
          15
      }

      pub mod kasa {
          pub fn odenecek(tutar: u32) -> u32 {
              tutar - tutar * indirim_orani() / 100
          }
      }
  }

  fn main() {
      println!("{}", market::kasa::odenecek(200));
  }
answer: false
error: E0425
explanation: |
  Derlenmez: **E0425 — cannot find function `indirim_orani` in this scope**. `kasa` modülü
  `indirim_orani`'na erişmeye **yetkili** ama o adı kendi içinde bulamıyor. Her modül kendi ad
  alanıdır ve üst modülün adlarını devralmaz. Doğrusu: `super::indirim_orani()`.
```

Burada iki ayrı soru var ve karıştırılmaları çok yaygın:

1. **Gizlilik:** Bu öğeye erişmeye **iznim** var mı? (Ders 2'nin konusu.)
2. **Kapsam (scope):** Bu öğenin adını buraya **yolsuz** yazabilir miyim?

Bir modül, içi boş yeni bir ad alanı açar. `kasa`'nın içinde yalnızca `kasa`'da tanımlanan adlar (ve
birazdan değineceğimiz, her yere otomatik gelen birkaç standart ad) kapsamdadır. `market`'teki
`indirim_orani` görünürdür ama kapsamda değildir; ona bir **yolla** ulaşman gerekir:

:::error
```text
error[E0425]: cannot find function `indirim_orani` in this scope
 --> src/main.rs:8:29
  |
8 |             tutar - tutar * indirim_orani() / 100
  |                             ^^^^^^^^^^^^^ not found in this scope
  |
help: consider importing this function
  |
7 +         use crate::market::indirim_orani;
  |
```
`help` satırı bir `use` bildirimi öneriyor; `use` ile bir adı kapsama getirmeyi bir sonraki derste
göreceksin. Şimdilik en kısa düzeltme yolu yazmak: `super::indirim_orani()`.
:::

C++ bilenler özellikle dikkat: C++'ta iç içe namespace'ler dıştaki adları kendiliğinden görür; `namespace
a { int f(); namespace b { int g() { return f(); } } }` derlenir. Rust'ta ise her modül kendi ad
alanıdır, tıpkı Python'da bir alt modülün üst paketteki adı kullanmak için `from .. import` yazmak
zorunda olması gibi.

Benzer bir hata, yolun **ilk halkası** bulunamadığında çıkar. Baştaki restoran örneğinde, `salon`
modülünün içinde `mutfak::firin::pisir(yemek)` yazsaydın derleyici `mutfak`'ı `salon`'un içinde arardı:

:::error
```text
error[E0433]: cannot find module or crate `mutfak` in this scope
  --> src/main.rs:13:13
   |
13 |             mutfak::firin::pisir(yemek);
   |             ^^^^^^ use of unresolved module or unlinked crate `mutfak`
   |
   = help: if you wanted to use a crate named `mutfak`, use `cargo add mutfak` to add it to your `Cargo.toml`
help: consider importing this module
   |
11 +         use crate::restoran::mutfak::firin;
   |
help: if you import `firin`, refer to it directly
   |
13 -             mutfak::firin::pisir(yemek);
13 +             firin::pisir(yemek);
   |
```
Mesajın "module **or crate**" demesinin bir nedeni var: bir yolun ilk halkası bu modüldeki bir öğe
olabileceği gibi bir **crate adı** da olabilir (`std::cmp::max` gibi). Bu yüzden derleyici, `mutfak`
adında bir dış crate kullanmak isteyip istemediğini de soruyor (dış crate'ler Ders 6'da). Doğru yol:
`super::mutfak::firin::pisir(yemek)` ya da `crate::restoran::mutfak::firin::pisir(yemek)`.
:::

:::ferris Derleyici yol tarifini biliyor
Yol hatalarında `help:` satırlarını atlama! Derleyici crate'in bütün ağacını tanır; aradığın öğe başka
bir yerde varsa doğru yolu çoğu zaman hazır önerir (`crate::restoran::mutfak::firin`).
:::

## Hangi yolu seçmeli?

Mutlak ve göreli yol aynı öğeyi gösterebiliyorsa hangisini yazmalısın? Cevap, kodun **ileride nasıl
taşınacağına** bağlı. Önce tahmin et:

````quiz
question: |
  ```rust
  mod magaza {
      pub fn kdv(tutar: u32) -> u32 {
          tutar * 20 / 100
      }

      pub mod kasa {
          pub fn fis(tutar: u32) {
              let a = crate::magaza::kdv(tutar); // (A)
              let b = super::kdv(tutar);         // (B)
              println!("{a} {b}");
          }
      }
  }
  ```
  Proje büyüyor ve ekip `kasa` modülünü `magaza`'nın içinden çıkarıp **crate köküne** taşıyor (artık
  `crate::kasa`). `kdv` olduğu yerde kalıyor. Hangi satır **kırılır**?
options:
  - Yalnızca (A)
  - Yalnızca (B)
  - İkisi de
  - Hiçbiri
answer: 1
explanation: |
  (A) mutlak bir yol: `crate::magaza::kdv` hâlâ var olduğu için `kasa` nereye taşınırsa taşınsın çalışır.
  (B) ise göreli: taşımadan sonra `kasa`'nın üst modülü artık crate kökü. `super::kdv` köke bakar,
  orada `kdv` yoktur → **E0425: cannot find function `kdv` in module `super`**.
feedback:
  - "(A) kökten başlıyor; `crate::magaza::kdv` yerinde durduğu için taşımadan etkilenmez."
  - Doğru!
  - "(A) kökten başladığı için taşımadan etkilenmez."
  - "(B)'deki `super`, taşımadan sonra farklı bir modülü (crate kökünü) gösterir."
````

Şimdi madalyonun öbür yüzü: `magaza`'yı, içindeki `kasa` ile **birlikte** yeni bir `sube` modülünün
içine taşıdığını düşün.

| Değişiklik | (A) `crate::magaza::kdv` | (B) `super::kdv` |
|---|---|---|
| Yalnızca `kasa` başka bir yere taşınır | ✅ çalışır | ❌ kırılır |
| `magaza`, `kasa` ile birlikte `sube`'nin içine taşınır | ❌ kırılır (artık `crate::sube::magaza`) | ✅ çalışır |

Buradan çıkan pratik kural:

- **Birlikte yaşayıp birlikte taşınan** parçalar arasında (bir modül ve kendi alt modülleri, bir modül
  ve onun testleri) **göreli** yol (`super::`) doğaldır.
- **Birbirinden bağımsız** yerlerdeki öğeler için **mutlak** yol (`crate::`) daha dayanıklıdır. Rust
  topluluğu da genellikle mutlak yolları tercih eder: Bir öğenin tanımı ile onu kullanan kodun birbirinden
  bağımsız taşınması daha olasıdır.
- Hangisini seçersen seç, yanlış yol **derleme zamanında** yakalanır. Python'da hatalı bir `import`
  ancak program çalışıp o modül yüklendiğinde fark edilir; Rust'ta program hiç derlenmez ve derleyici
  doğru yolu önerir. Bu yüzden Rust'ta kodu yeniden düzenlemek (refactoring) korkutucu değildir.

## Yollar yalnızca fonksiyonlara gitmez

`::` "...'nin içindeki" demektir ve yalnızca modüller için kullanılmaz. Önceki modüllerde bunu fark
etmeden yaptın bile:

| Yol | Ne gösterir? |
|---|---|
| `crate::ayarlar::KDV` | bir modüldeki sabit |
| `siparis::Siparis::yeni` | bir tipin ilişkili fonksiyonu (Modül 6) |
| `siparis::Durum::Kargoda` | bir enum'un varyantı (Modül 7) |
| `std::cmp::max` | `std` crate'inin `cmp` modülündeki fonksiyon |
| `u32::MAX` | bir tipin ilişkili sabiti |

```rust
mod siparis {
    pub const UCRETSIZ_KARGO: u32 = 500;

    pub enum Durum {
        Hazirlaniyor,
        Kargoda,
    }

    pub struct Siparis {
        pub tutar: u32,
        pub durum: Durum,
    }

    impl Siparis {
        pub fn yeni(tutar: u32) -> Self {
            Self { tutar, durum: Durum::Hazirlaniyor }
        }

        pub fn kargo_ucreti(&self) -> u32 {
            if self.tutar >= UCRETSIZ_KARGO { 0 } else { 40 }
        }
    }
}

fn main() {
    let mut s = siparis::Siparis::yeni(620); // tipin ilişkili fonksiyonu
    s.durum = siparis::Durum::Kargoda; // enum varyantı

    let durum = match s.durum {
        siparis::Durum::Hazirlaniyor => "hazırlanıyor",
        siparis::Durum::Kargoda => "kargoda",
    };
    println!("Sipariş {durum}, kargo ücreti: {} TL", s.kargo_ucreti());
    println!("Ücretsiz kargo sınırı: {} TL", siparis::UCRETSIZ_KARGO); // modüldeki sabit

    let en_buyuk = std::cmp::max(s.tutar, 1000); // std crate'indeki fonksiyon
    println!("max(620, 1000) = {en_buyuk}");
    println!("u32 en fazla {} olabilir", u32::MAX); // tipin ilişkili sabiti
}
```

`.` ile `::` arasındaki fark: `.` bir **değer** üzerinde çalışır (`s.tutar`, `s.kargo_ucreti()`); `::`
ise **adlar ağacında** yürür. Java ve Python ikisi için de `.` kullanır (`java.util.List`,
`os.path.join`); Rust, C++ gibi ikisini ayırır. Böylece `a::b`'nin bir değer değil bir **ad** olduğunu
bir bakışta anlarsın.

:::info Peki `String` neden yolsuz yazılabiliyor?
`String`'in tam yolu `std::string::String`, `Option`'ınki `std::option::Option`'dır. Bunları her
seferinde uzun uzun yazmıyoruz, çünkü Rust her modüle sık kullanılan adlardan oluşan küçük bir listeyi,
**prelude**'ü, kendiliğinden getirir. Bunun nasıl yapıldığını bir sonraki derste `use` ile göreceksin.
:::

Bir de Modül 6'yı hatırlayalım:

```predict
question: Modül 6'daki metot çağrılarını hatırla. Bu program ne yazdırır?
code: |
  mod geometri {
      pub struct Dikdortgen {
          pub en: u32,
          pub boy: u32,
      }

      impl Dikdortgen {
          pub fn kare(kenar: u32) -> Self {
              Self { en: kenar, boy: kenar }
          }

          pub fn alan(&self) -> u32 {
              self.en * self.boy
          }
      }
  }

  fn main() {
      let oda = geometri::Dikdortgen { en: 3, boy: 4 };
      let salon = geometri::Dikdortgen::kare(5);
      println!("{}", oda.alan() + geometri::Dikdortgen::alan(&salon));
  }
output: "37"
explanation: |
  `oda.alan()` 3 × 4 = **12**, `salon` ise 5 × 5'lik bir kare: **25**. Toplam **37**.

  Üç ayrıntı: `geometri::Dikdortgen::kare(5)` bir **ilişkili fonksiyona** giden yoldur; `Self`, `impl`
  bloğunun içinde `Dikdortgen` demektir. `geometri::Dikdortgen::alan(&salon)` ise `salon.alan()`
  çağrısının **açık yol** hâlidir: Modül 6'da gördüğün gibi nokta ile çağrıda alıcıya `&`'ı Rust kendisi
  ekler. Struct'ı modül dışında `{ en: 3, boy: 4 }` ile kurabilmemizin nedeni de bütün alanların `pub`
  olması (Ders 2).
```

## Alıştırma: Kafe kasası

Önce yolları küçük bir örnekte kendin kur:

```fill
prompt: |
  `sevkiyat` modülündeki fonksiyon, bir üst modüldeki `stok` fonksiyonuna ve crate kökündeki `SIRKET`
  sabitine ulaşıyor; `rapor` ise kendi alt modülünü çağırıyor. Boşlukları `crate`, `super` ya da `self`
  ile doldur.
code: |
  const SIRKET: &str = "Anadolu Lojistik";

  mod depo {
      pub fn stok(urun: &str) -> u32 {
          match urun {
              "kalem" => 120,
              "defter" => 45,
              _ => 0,
          }
      }

      pub mod sevkiyat {
          pub fn hazirla(urun: &str) -> String {
              let adet = ___0::stok(urun);
              let firma = ___1::SIRKET;
              format!("{firma}: {adet} adet {urun} yola çıkmaya hazır")
          }
      }

      pub fn rapor() -> String {
          ___2::sevkiyat::hazirla("defter")
      }
  }

  fn main() {
      println!("{}", depo::rapor());
  }
blanks:
  - ["super", "crate::depo"]
  - ["crate", "super::super"]
  - ["self", "crate::depo"]
output: "Anadolu Lojistik: 45 adet defter yola çıkmaya hazır"
explanation: |
  - `___0`: `hazirla`, `sevkiyat` modülünde; `stok` ise bir üstteki `depo`'da → `super::stok`.
  - `___1`: `SIRKET` crate kökünde → `crate::SIRKET`. İki kat yukarı çıkan `super::super::SIRKET` de
    olur ama niyeti `crate::` daha açık anlatır.
  - `___2`: `rapor` zaten `depo`'nun içinde ve `sevkiyat` onun alt modülü → `self::sevkiyat`. Burada
    `self::` yazmasan da olurdu: `sevkiyat::hazirla(...)` da aynı göreli yoldur.
```

Şimdi üç yol türünü tek bir fonksiyonda kullanma zamanı:

````exercise
id: m08-e-kafe-kasasi
title: Kafe kasası
difficulty: 2
prompt: |
  Bir kafenin kasa programı üç yardımcıya sahip:

  - crate kökünde `kdv_ekle` (yüzde 10 KDV ekler),
  - `kafe::menu` modülünde `fiyat` (ürün menüde yoksa `None` döndürür),
  - `kafe::kasa::indirim` modülünde `ogrenci` (yüzde 20 öğrenci indirimi).

  `kafe::kasa::toplam` fonksiyonunu tamamla:

  1. Sepetteki ürünlerin fiyatlarını topla; **menüde olmayan ürünleri atla**.
  2. Müşteri öğrenciyse **önce** indirimi uygula.
  3. En son KDV'yi ekle ve sonucu döndür.

  Yolları pratik etmek için menüye **`super::`** ile, KDV fonksiyonuna **`crate::`** ile ulaş.
  Yardımcı fonksiyonları değiştirme.
starter: |
  const KDV_ORANI: u32 = 10; // yüzde

  fn kdv_ekle(tutar: u32) -> u32 {
      tutar + tutar * KDV_ORANI / 100
  }

  mod kafe {
      pub mod menu {
          pub fn fiyat(urun: &str) -> Option<u32> {
              match urun {
                  "çay" => Some(20),
                  "simit" => Some(25),
                  "kahve" => Some(60),
                  "tost" => Some(80),
                  _ => None,
              }
          }
      }

      pub mod kasa {
          pub mod indirim {
              pub fn ogrenci(tutar: u32) -> u32 {
                  tutar - tutar * 20 / 100
              }
          }

          pub fn toplam(sepet: &[&str], ogrenci_mi: bool) -> u32 {
              todo!()
          }
      }
  }

  fn main() {
      let sepet = ["çay", "simit", "pasta"];
      println!("Ödenecek: {} TL", kafe::kasa::toplam(&sepet, false));
  }
solution: |
  const KDV_ORANI: u32 = 10; // yüzde

  fn kdv_ekle(tutar: u32) -> u32 {
      tutar + tutar * KDV_ORANI / 100
  }

  mod kafe {
      pub mod menu {
          pub fn fiyat(urun: &str) -> Option<u32> {
              match urun {
                  "çay" => Some(20),
                  "simit" => Some(25),
                  "kahve" => Some(60),
                  "tost" => Some(80),
                  _ => None,
              }
          }
      }

      pub mod kasa {
          pub mod indirim {
              pub fn ogrenci(tutar: u32) -> u32 {
                  tutar - tutar * 20 / 100
              }
          }

          pub fn toplam(sepet: &[&str], ogrenci_mi: bool) -> u32 {
              let mut ara_toplam = 0;
              for urun in sepet {
                  if let Some(f) = super::menu::fiyat(urun) {
                      ara_toplam += f;
                  }
              }
              if ogrenci_mi {
                  ara_toplam = indirim::ogrenci(ara_toplam);
              }
              crate::kdv_ekle(ara_toplam)
          }
      }
  }

  fn main() {
      let sepet = ["çay", "simit", "pasta"];
      println!("Ödenecek: {} TL", kafe::kasa::toplam(&sepet, false));
  }
check: tests
tests: |
  #[test]
  fn bos_sepet() {
      assert_eq!(kafe::kasa::toplam(&[], false), 0, "boş sepetin tutarı 0 TL olmalı");
  }

  #[test]
  fn kdv_eklenir() {
      assert_eq!(kafe::kasa::toplam(&["çay", "simit"], false), 49, "çay + simit = 45 TL; %10 KDV ile 49 TL olmalı");
      assert_eq!(kafe::kasa::toplam(&["tost", "tost"], false), 176, "2 tost = 160 TL; KDV ile 176 TL olmalı");
  }

  #[test]
  fn menude_olmayan_urun_atlanir() {
      assert_eq!(kafe::kasa::toplam(&["çay", "pasta", "simit"], false), 49, "menüde olmayan 'pasta' atlanmalı");
      assert_eq!(kafe::kasa::toplam(&["pizza"], true), 0, "sepette yalnızca menü dışı ürün varsa tutar 0 TL olmalı");
  }

  #[test]
  fn ogrenci_indirimi_kdvden_once_uygulanir() {
      assert_eq!(kafe::kasa::toplam(&["kahve", "tost"], false), 154, "140 TL + KDV = 154 TL olmalı");
      assert_eq!(
          kafe::kasa::toplam(&["kahve", "tost"], true),
          123,
          "140 TL → %20 indirim → 112 TL → KDV ile 123 TL olmalı (önce indirim, sonra KDV)"
      );
  }
hints:
  - |
    Ürünleri `for urun in sepet` ile dolaş. `super::menu::fiyat(urun)` bir `Option<u32>` döndürür;
    `if let Some(f) = ...` ile yalnızca menüdeki ürünlerin fiyatını topla (Modül 7).
  - |
    İndirim fonksiyonu `toplam`'ın bulunduğu `kasa` modülünün **alt** modülünde:
    `indirim::ogrenci(...)` (ya da `self::indirim::ogrenci(...)`). KDV fonksiyonu crate kökünde:
    `crate::kdv_ekle(...)`.
  - |
    İskelet:

    ```rust
    let mut ara_toplam = 0;
    for urun in sepet {
        if let Some(f) = /* menüden fiyat */ {
            ara_toplam += f;
        }
    }
    if ogrenci_mi {
        ara_toplam = /* indirimli tutar */;
    }
    /* KDV'yi ekleyip döndür */
    ```
require:
  - pattern: "super::menu::fiyat"
    message: "Menüdeki fiyata `super::menu::fiyat(...)` ile ulaş; bu alıştırma göreli yolları pratik etmek için."
  - pattern: "crate::kdv_ekle"
    message: "KDV'yi `crate::kdv_ekle(...)` ile ekle; bu alıştırma mutlak yolları pratik etmek için."
explanation: |
  Tek fonksiyonda üç farklı yol kullandın:

  - `super::menu::fiyat`: bir üst modül olan `kafe`'den başlayan **göreli** yol.
  - `indirim::ogrenci`: bulunduğun modülün alt modülüne inen **göreli** yol (`self::indirim::ogrenci`
    ile aynı).
  - `crate::kdv_ekle`: kökten başlayan **mutlak** yol.

  `kdv_ekle` ve `KDV_ORANI` crate kökünde ve **gizli**; `kasa` kökün torunu olduğu için onları görebilir
  (Ders 2). İşlem sırası da önemliydi: önce KDV ekleyip sonra indirim yapsaydın 140 TL'lik sepet 124 TL
  tutardı; son test bu hatayı yakalıyor.

  Küçük bir ayrıntı: `for urun in sepet` döngüsünde `urun`'un tipi `&&str`'dir (bir `&str` dilimini
  ödünç alarak dolaşıyoruz). Rust onu `fiyat`'ın beklediği `&str`'e kendiliğinden çevirir; bu,
  `&String`'i `&str` bekleyen bir fonksiyona verebilmeni sağlayan kuralın aynısıdır (Modül 5).
````

## Özet

:::remember
- **Yol**, `::` ile ayrılmış adlardır: modül ağacında bir öğenin adresi.
- **Mutlak yol** kökten başlar: `crate::a::b`. Ağacın neresinden yazılırsa yazılsın aynı öğeyi gösterir.
- **Göreli yol** bulunduğun modülden başlar: bir adla, `self::` (bu modül) ya da `super::` (üst modül)
  ile. `super::super` iki kat yukarı çıkar.
- **Görebilmek ≠ adıyla çağırabilmek:** Modüller üst modülün adlarını devralmaz; atadaki bir öğeye bir
  yolla (`super::f()`, `crate::f()`) ulaşırsın. Aksi hâlde **E0425** ya da **E0433**.
- Birlikte taşınan kod arasında `super::`, bağımsız parçalar arasında `crate::` tercih et.
- `::` yalnızca modüller için değildir: `Tip::yeni`, `Enum::Varyant`, `u32::MAX`, `std::cmp::max`.
:::

```reflect
prompt: |
  Bir arkadaşın "Ben her yerde `crate::` ile mutlak yol yazarım, `super::`'e hiç gerek yok" diyor.
  Hangi durumda `super::`'in daha iyi bir seçim olduğunu kod taşıma örneğiyle ona açıkla.
answer: |
  Model cevap: Mutlak yollar, kullanan kod tek başına taşındığında kırılmaz; bu yüzden çoğu zaman iyi
  bir varsayılandır. Ama birbirine sıkı bağlı parçalar birlikte taşındığında durum tersine döner.
  Örneğin `magaza` modülünü içindeki `kasa` ile birlikte `sube`'nin içine taşırsam,
  `crate::magaza::kdv` yazan her satır kırılır, çünkü artık doğru yol `crate::sube::magaza::kdv`'dir.
  `kasa` içindeki `super::kdv` ise çalışmaya devam eder, çünkü `kasa` ile `magaza` arasındaki ilişki
  değişmemiştir. Bir modül ile kendi alt modülleri (ya da testleri) gibi birlikte yaşayan parçalarda
  `super::` daha dayanıklıdır.
```

```flashcards
- front: "`crate::` ile başlayan bir yol nereden başlar?"
  back: Bulunduğun crate'in kökünden; buna mutlak yol denir.
- front: "`super::` neyi gösterir?"
  back: "Bir üst (ebeveyn) modülü; dosya sistemindeki `..` gibi. `super::super` iki üst modüldür."
- front: "`self::sinif::kart` ile `sinif::kart` arasında fark var mı?"
  back: "Hayır. İkisi de bulunduğun modülden başlayan göreli yoldur; `self` yalnızca vurgu yapar."
- front: "`crate::a::b::c` içinde yazılan `super::super::f` hangi fonksiyondur?"
  back: "`crate::a::f`"
- front: Bir alt modül, üst modüldeki bir fonksiyonu yalnızca adıyla çağırabilir mi?
  back: "Hayır. Ona erişmeye izni vardır ama adı kapsamda değildir; `super::f()` gibi bir yol gerekir (aksi hâlde E0425)."
- front: Yalnızca kullanan modül taşınırsa hangi yol türü kırılır?
  back: "Göreli yol (`super::...`). Mutlak yol (`crate::...`) kullanan kodun yerinden bağımsızdır."
- front: "`.` ile `::` arasındaki fark nedir?"
  back: "`.` bir değer üzerinde çalışır (alan, metot); `::` adlar ağacında yürür (modül, tip, varyant, ilişkili öğe)."
```
