---
id: m08-l02
title: mod, pub ve Gizlilik Kuralları
minutes: 19
type: lesson
objectives:
  - Rust'ta öğelerin neden varsayılan olarak gizli olduğunu ve `pub`'ın tam olarak neyi açtığını açıklayabilmek
  - Bir öğenin hangi modüllerden görülebileceğini "içeriden dışarıya" kuralıyla belirleyebilmek
  - "`pub struct` alanları ile `pub enum` varyantları arasındaki gizlilik farkını söyleyebilmek"
  - Gizli alanlar ve kurucu fonksiyonlarla değişmez koşulları (invariant) koruyan bir tip tasarlayabilmek
keywords: [pub, gizlilik, privacy, görünürlük, E0603, E0616, E0451, E0624, kapsülleme, invariant, pub(crate), pub(super)]
---

Bir bankanın yazılımında hesabının bakiyesini doğrudan değiştirebildiğini düşün:
`hesap.bakiye = 1_000_000;` Senin için harika, banka için felaket! Gerçek hayatta bakiye yalnızca para
yatırma ve çekme işlemleriyle, kurallara uyarak değişir.

Rust'ta bu korumayı **gizlilik (privacy)** kuralları sağlar. Bu derste `pub`'ın tam olarak neyi
açtığını, ve neyi **açmadığını**, öğreneceksin. Ders sonunda bakiyesine dışarıdan kimsenin
dokunamadığı bir banka hesabı tasarlayacaksın.

## Varsayılan: her şey gizli

Geçen derste modüllerin içindeki fonksiyonların başına hep `pub` yazdık. Yazmasaydık ne olurdu?

```compiles
code: |
  mod banka {
      fn faiz_hesapla(anapara: f64) -> f64 {
          anapara * 0.45
      }
  }

  fn main() {
      let faiz = banka::faiz_hesapla(1000.0);
      println!("Yıllık faiz: {faiz} TL");
  }
answer: false
error: E0603
explanation: |
  `faiz_hesapla`'nın başında `pub` yok. Rust'ta bir modülün içindeki her öğe **varsayılan olarak
  gizlidir (private)**. `main` ise `banka` modülünün dışında duruyor, bu yüzden fonksiyonu göremez:
  **E0603 - function `faiz_hesapla` is private**.
```

Derleyicinin tam mesajı şöyle:

:::error
```text
error[E0603]: function `faiz_hesapla` is private
 --> src/main.rs:8:23
  |
8 |     let faiz = banka::faiz_hesapla(1000.0);
  |                       ^^^^^^^^^^^^ private function
  |
note: the function `faiz_hesapla` is defined here
 --> src/main.rs:2:5
  |
2 |     fn faiz_hesapla(anapara: f64) -> f64 {
  |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```
Okuma sırası: **1)** hata kodu ve özet (gizli bir fonksiyon), **2)** `^^^` işaretleri yolun **hangi
halkasının** gizli olduğunu gösterir, **3)** `note` satırı öğenin nerede tanımlandığını söyler,
`pub` eklemeye karar verirsen gideceğin yer orasıdır.
:::

Düzeltmek kolay: `pub fn faiz_hesapla`. Ama dikkat, her şeyi körü körüne `pub` yapmak çözüm değildir.
Aşağıda oranın nasıl belirlendiği bankanın iç meselesi olarak gizli kalıyor:

```rust
mod banka {
    pub fn faiz_hesapla(anapara: f64) -> f64 {
        anapara * oran()
    }

    fn oran() -> f64 {
        0.45 // gizli: dışarıdaki kod bu fonksiyonu bilmek zorunda değil
    }
}

fn main() {
    let faiz = banka::faiz_hesapla(1000.0);
    println!("Yıllık faiz: {faiz} TL");
}
```

Neden varsayılan **gizli**?

- **Gizli olanı özgürce değiştirirsin.** Adını, parametrelerini değiştirebilir, hatta silebilirsin;
  kimse etkilenmez. `pub` yaptığın her şey ise bir **söz**dür: başkaları ona güvenip kod yazar,
  değiştirirsen onların kodu kırılır.
- **Gizliden açığa geçmek kolay, açıktan gizliye geçmek zordur.** Bir `pub` eklemek bir saniye sürer;
  bir `pub`'ı geri almak onu kullanan herkesi etkiler. Güvenli varsayılan, dar olanıdır.
- **Bilinçli karar:** Neyin dışarıya açılacağını sen seçersin; bir iç ayrıntı kazara dışarı sızmaz.

C'de durum tam tersidir: bir dosyadaki fonksiyonlar varsayılan olarak diğer dosyalara açıktır,
gizlemek için `static` yazman gerekir. Rust "kapalı başla, gerekeni aç" der.

## Kim kimi görebilir?

Gizlilik kuralları iki cümleye sığar:

1. **Gizli bir öğe**, tanımlandığı modülde **ve o modülün bütün alt modüllerinde** görünür.
2. **`pub` bir öğe** ise, içinde durduğu modülü görebilen **her yerden** görünür. Pratikte: bir yolun
   çalışması için yoldaki her halkanın bulunduğun yerden görünür olması gerekir.

Yani görünürlük **içeriden dışarıya** doğru akar: alt modüller atalarının gizli öğelerini görür; atalar
ise alt modüllerin gizli öğelerini göremez. `pub`, bir öğeyi kendi modülünün bir kat dışına taşır;
oradan ötesi, o modülün kendisinin ne kadar görünür olduğuna bağlıdır.

```rust
mod okul {
    fn okul_kodu() -> u32 {
        34_017 // gizli: yalnızca okul ve alt modülleri görür
    }

    pub mod sinif {
        pub fn yoklama() {
            // Alt modül, atasının gizli öğesini görebilir:
            let kod = super::okul_kodu();
            println!("Okul {kod}: yoklama alındı.");
        }
    }

    pub fn gunu_baslat() {
        println!("Zil çaldı!");
        sinif::yoklama(); // üst modül, alt modülün pub öğesini görür
    }
}

fn main() {
    okul::gunu_baslat();
}
```

`super::okul_kodu()` yolundaki `super` "bir üst modül" demektir, dosya sistemindeki `..` gibi.
Yolları bir sonraki derste ayrıntılı göreceğiz. Şimdilik kimin neyi gördüğüne odaklan:

| Kim bakıyor? | `okul_kodu` (gizli, `okul` içinde) | `sinif::yoklama` (`pub`, `sinif` içinde) |
|---|---|---|
| `okul` içindeki `gunu_baslat` | ✅ aynı modül | ✅ `pub`, kendi alt modülünde |
| `sinif` içindeki `yoklama` | ✅ atasının gizli öğesi | ✅ aynı modül |
| crate kökündeki `main` | ❌ gizli ve `okul`'un içinde | ✅ yoldaki her halka açık |

Son satır, geçen dersteki soruyu da cevaplıyor: `mod okul`'un başında `pub` yok ama `main` onu
görebiliyor. Çünkü `okul` **crate kökünde** tanımlanmış gizli bir öğe ve `main` de crate kökünde,
aynı modüldeler!

:::analogy Filmli araba camı
Camları filmli bir arabanın içinden dışarıyı rahatça görürsün ama dışarıdan içerisi görünmez.
Modüller de böyle: bir alt modülün içinden, onu saran bütün modüllerin gizli öğelerini görürsün;
dışarıdan ise içerideki gizli öğelere bakamazsın. `pub` camın bir bölümünü **şeffaf** yapar: o öğe
bir kat dışarıdan da görünür.
:::

Kuralı uygulayalım. Bu kod derlenir mi?

```compiles
code: |
  mod okul {
      pub mod sinif {
          fn not_defteri() -> u32 {
              87
          }

          pub fn ortalama_ilan_et() {
              println!("Sınıf ortalaması: {}", not_defteri());
          }
      }

      pub fn mudur_kontrolu() {
          let not = sinif::not_defteri();
          println!("Müdür not defterini inceledi: {not}");
      }
  }

  fn main() {
      okul::sinif::ortalama_ilan_et();
      okul::mudur_kontrolu();
  }
answer: false
error: E0603
explanation: |
  `not_defteri`, `sinif` modülünün **gizli** fonksiyonu. Aynı modüldeki `ortalama_ilan_et` onu rahatça
  çağırır. Ama `mudur_kontrolu`, `sinif`'in **atası** olan `okul` modülünde duruyor; atalar alt
  modüllerin gizli öğelerini göremez → **E0603: function `not_defteri` is private**.

  Müdür not defterini görmek istiyorsa ya `not_defteri` `pub` (ya da birazdan göreceğin `pub(super)`)
  yapılmalı ya da `sinif` modülü ona `pub` bir fonksiyonla gerekeni sunmalı.
```

## pub yalnızca bir kapıyı açar

Bir modülü `pub` yapmak, içindekileri de açar mı? Tahmin et:

```compiles
code: |
  mod kutuphane {
      pub mod raf {
          fn kitap_bul(no: u32) -> String {
              format!("Raf kodu: A-{no}")
          }
      }
  }

  fn main() {
      println!("{}", kutuphane::raf::kitap_bul(7));
  }
answer: false
error: E0603
explanation: |
  `pub mod raf` yalnızca modülün **adını** dışarıya açar; içindekileri değil. `kitap_bul` hâlâ gizli →
  **E0603: function `kitap_bul` is private**. Her öğe kendi `pub`'ını ister: `pub fn kitap_bul`.
```

Ters durum da geçerli: fonksiyon `pub` olsa bile içinde durduğu modül gizliyse yol daha baştan kapanır.

```rust,compile_fail,E0603
mod okul {
    mod ogretmenler_odasi {
        pub fn sinav_sorulari() {}
    }
}

fn main() {
    okul::ogretmenler_odasi::sinav_sorulari();
}
```

:::error
```text
error[E0603]: module `ogretmenler_odasi` is private
 --> src/main.rs:8:11
  |
8 |     okul::ogretmenler_odasi::sinav_sorulari();
  |           ^^^^^^^^^^^^^^^^^  -------------- function `sinav_sorulari` is not publicly re-exported
  |           |
  |           private module
  |
note: the module `ogretmenler_odasi` is defined here
 --> src/main.rs:2:5
  |
2 |     mod ogretmenler_odasi {
  |     ^^^^^^^^^^^^^^^^^^^^^
```
Bu kez `^^^` işaretleri fonksiyonu değil **modülü** gösteriyor: yolun kapandığı halka
`ogretmenler_odasi`. Bir yolun çalışması için yoldaki **her halkanın** bulunduğun yerden görünür olması
gerekir. ("not publicly re-exported" notunu Ders 4'teki `pub use` ile anlayacaksın.)
:::

### Ara seviyeler: pub(crate) ve pub(super)

`pub` "herkese açık" demektir; bir library crate'te bu, senin crate'ini kullanan **başka crate'lerin**
de görebileceği anlamına gelir. Bazen bir öğenin crate'in her yerinden görünmesini ama dış dünyaya kapalı
kalmasını istersin. Rust bunun için ara seviyeler sunar:

| Yazım | Kimler görebilir? |
|---|---|
| *(hiçbir şey)* | Tanımlandığı modül ve onun alt modülleri |
| `pub(super)` | Ayrıca bir üst modül (ve onun alt modülleri) |
| `pub(in crate::a)` | Belirtilen ata modül `a` ve onun içindeki her şey |
| `pub(crate)` | Bu crate'in her yeri, ama başka crate'ler değil |
| `pub` | Her yer (yoldaki her halka açık olduğu sürece) |

```rust
mod oyun {
    pub mod kayit {
        // Crate'in her yerinden kullanılabilir, dış crate'lere kapalı:
        pub(crate) fn dosya_adi(slot: u8) -> String {
            format!("kayit_{slot}.dat")
        }

        // Yalnızca bir üst modül (`oyun`) ve onun alt modülleri kullanabilir:
        pub(super) fn saglama_toplami(puan: u32) -> u32 {
            puan % 97
        }
    }

    pub fn kaydet(slot: u8, puan: u32) {
        let dosya = kayit::dosya_adi(slot);
        let kontrol = kayit::saglama_toplami(puan);
        println!("{dosya} dosyasına {puan} puan yazıldı (sağlama: {kontrol})");
    }
}

fn main() {
    oyun::kaydet(1, 1250);
    println!("Sıradaki dosya: {}", oyun::kayit::dosya_adi(2));
    // oyun::kayit::saglama_toplami(5); // ← E0603: main, `oyun`'un dışında kalıyor
}
```

Bir not: **binary crate**'te dışarıdan seni kullanan başka bir crate olmadığı için `pub` ile `pub(crate)`
pratikte aynı sonucu verir. Fark, library crate'lerde ortaya çıkar: orada `pub` bir **söz**dür, `pub(crate)`
ise yalnızca takım içi bir anlaşma.

```quiz
question: |
  Bir library crate yazıyorsun. `yardimci::temizle` fonksiyonunu crate'in **içindeki** bütün modüller
  kullanabilsin ama senin crate'ini bağımlılık olarak ekleyen **dış** projeler göremesin istiyorsun.
  Fonksiyonun başına ne yazarsın?
options:
  - "`pub`"
  - "`pub(crate)`"
  - "`pub(super)`"
  - Hiçbir şey; gizli bırakırım
answer: 1
explanation: |
  `pub(crate)` öğeyi crate'in her yerine açar ama crate sınırında durur: dış projeler onu göremez.
  Gerçek projelerde en sık kullanılan ara seviye budur: "takım içi" yardımcılar için idealdir.
feedback:
  - "`pub` öğeyi dış projelere de açar (yolundaki modüller de açıksa)."
  - Doğru!
  - "`pub(super)` yalnızca bir üst modüle açar; crate'in uzak köşelerindeki modüller onu göremez."
  - Gizli bir öğeyi yalnızca `yardimci` modülü ve onun alt modülleri görebilir.
```

## Struct'larda alan alan, enum'larda topluca

Struct ve enum'larda `pub`'ın etkisi farklıdır:

- **`pub struct`** yalnızca **tipin adını** açar. Her **alan** ayrı ayrı `pub` istemedikçe gizlidir.
  `impl` bloğundaki **metotlar ve ilişkili fonksiyonlar** da öyle.
- **`pub enum`** ise **bütün varyantları** (ve içlerindeki veriyi) birlikte açar.

```rust
mod kutuphane {
    pub enum Tur {
        Roman,
        Siir,
    }

    pub struct Kitap {
        pub baslik: String,
        pub tur: Tur,
        stok: u32, // gizli: yalnızca kutuphane modülü değiştirebilir
    }

    impl Kitap {
        pub fn yeni(baslik: &str, tur: Tur, stok: u32) -> Kitap {
            Kitap { baslik: String::from(baslik), tur, stok }
        }

        pub fn stok(&self) -> u32 {
            self.stok
        }

        pub fn odunc_ver(&mut self) -> bool {
            if self.stok > 0 {
                self.stok -= 1;
                true
            } else {
                false
            }
        }
    }
}

fn tur_adi(kitap: &kutuphane::Kitap) -> String {
    // pub enum'un varyantları dışarıdan da eşleştirilebilir:
    match kitap.tur {
        kutuphane::Tur::Roman => String::from("roman"),
        kutuphane::Tur::Siir => String::from("şiir"),
    }
}

fn main() {
    let mut roman = kutuphane::Kitap::yeni("Kürk Mantolu Madonna", kutuphane::Tur::Roman, 1);
    let siir = kutuphane::Kitap::yeni("Han Duvarları", kutuphane::Tur::Siir, 3);

    roman.baslik.push_str(" (Sabahattin Ali)"); // pub alan: okunur ve değiştirilir
    println!("{} - {}", roman.baslik, tur_adi(&roman));
    println!("{} - {}, stok: {}", siir.baslik, tur_adi(&siir), siir.stok());

    println!("İlk ödünç: {}", roman.odunc_ver());
    println!("İkinci ödünç: {}", roman.odunc_ver());
    println!("Kalan stok: {}", roman.stok());
}
```

`stok` gizli olduğu için dışarıdan `roman.stok = 99;` yazamazsın (E0616); stok yalnızca kuralları
denetleyen `odunc_ver` ile değişir. Alan ile metodun aynı adı (`stok`) taşıyabildiğine dikkat et: bu,
Modül 6'daki okuma metodu (getter) geleneğidir.

Gizli bir alanın bir yan etkisi daha var: struct'ı modül dışında `{ ... }` ile **kuramazsın**, çünkü
gizli alana değer veremezsin:

```rust,compile_fail,E0451
mod kutuphane {
    pub struct Kitap {
        pub baslik: String,
        stok: u32,
    }
}

fn main() {
    let k = kutuphane::Kitap {
        baslik: String::from("Kuyucaklı Yusuf"),
        stok: 3,
    };
    println!("{}", k.baslik);
}
```

:::error
```text
error[E0451]: field `stok` of struct `Kitap` is private
  --> src/main.rs:11:9
   |
 9 |     let k = kutuphane::Kitap {
   |             ---------------- in this type
10 |         baslik: String::from("Kuyucaklı Yusuf"),
11 |         stok: 3,
   |         ^^^^ private field
```
Tek bir gizli alan bile struct'ın dışarıdan "elle" kurulmasını engeller. Bu bir kusur değil, bir
**özellik**: tipin nasıl oluşturulacağına modül karar verir (birazdan göreceğin kurucular).
:::

Gizlilik hatalarının hepsi aynı aileden; mesajları ezberlemen gerekmez ama kodları tanımak işini
hızlandırır:

| Kod | Mesajın başı | Ne oldu? |
|---|---|---|
| E0603 | ``function `x` is private`` / ``module `x` is private`` | Gizli fonksiyon, modül, struct, sabit... |
| E0616 | ``field `stok` of struct `Kitap` is private`` | Gizli alanı okumaya/yazmaya çalıştın |
| E0451 | aynı cümle, struct kurarken | Gizli alanlı struct'ı `{ ... }` ile kurmaya çalıştın |
| E0624 | ``method `x` is private`` / ``associated function `yeni` is private`` | Gizli metot ya da ilişkili fonksiyon |

Tuple struct'larda da aynı kural geçerli: `pub struct Metre(f64);` tanımında alan gizli olduğu için
dışarıda `birim::Metre(5.0)` yazamazsın (**E0603: tuple struct constructor `Metre` is private**).
Alanı açmak istersen: `pub struct Metre(pub f64);`.

**Peki enum'lar neden topluca açık?** Bir enum'u kullanan kişi onun üzerinde `match` yapar. Varyantlardan
biri gizli olsaydı dışarıdaki `match` hiçbir zaman eksiksiz (exhaustive) olamaz, o varyantın değeri de
oluşturulamazdı; böyle bir enum neredeyse işe yaramazdı. Struct'ta ise gizli alanlar çok kullanışlıdır:
iç düzeni saklar, tipe yalnızca metotlarla erişilmesini sağlarsın.

````quiz
question: |
  ```rust
  mod magaza {
      pub struct Urun {
          pub ad: String,
          fiyat: u32,
      }

      pub enum Kategori {
          Gida,
          Elektronik,
      }
  }
  ```
  Crate kökündeki `main` fonksiyonundan **hangileri** yapılabilir? (Birden çok seçenek doğru olabilir.)
options:
  - "`magaza::Kategori::Elektronik` değerini oluşturmak"
  - "`u` bir `magaza::Urun` ise `u.ad` alanını okumak"
  - "`u` bir `magaza::Urun` ise `u.fiyat` alanını okumak"
  - "`magaza::Urun { ad: String::from(\"Çay\"), fiyat: 50 }` ile yeni ürün oluşturmak"
answer: [0, 1]
explanation: |
  `pub enum Kategori` bütün varyantlarıyla açıktır, `Elektronik` rahatça oluşturulur. `Urun`'un `ad`
  alanı `pub` olduğu için okunabilir. `fiyat` ise gizli: okumak **E0616**, onu içeren bir struct
  literal yazmak **E0451** verir. `Urun` oluşturmak için `magaza` modülünün bir kurucu sunması gerekir.
feedback:
  - Doğru, `pub enum`'un varyantları otomatik olarak açıktır.
  - Doğru, `ad` alanı ayrıca `pub` yazılmış.
  - "`fiyat` alanının başında `pub` yok; struct'ın `pub` olması alanlarını açmaz (E0616)."
  - Gizli `fiyat` alanına dışarıdan değer verilemez (E0451); bir kurucu fonksiyon gerekir.
````

:::info Gizlilik derleme zamanında yaşar
Gizlilik bir **derleme zamanı** kuralıdır: `pub` olsun olmasın, alanlar bellekte aynen yan yana durur
ve çalışma zamanında hiçbir ek maliyet yoktur. Java'da yansıma (*reflection*) ile gizli alanlara
ulaşılabilir; güvenli (safe) Rust'ta ise gizli bir alana modül dışından erişmenin hiçbir yolu yoktur.
:::

:::deep Gizli bir tipi `pub` bir fonksiyondan döndürmek
Gerçek projelerde sık düşülen bir tuzak:

```rust,ignore
mod oyun {
    struct Ayar { zorluk: u8 }            // gizli tip
    pub fn varsayilan() -> Ayar {         // pub fonksiyon, ama dönüş tipi gizli!
        Ayar { zorluk: 1 }
    }
}
```

Derleyici tanım için bir **uyarı** verir: ``type `Ayar` is more private than the item `varsayilan` ``
(`private_interfaces` lint'i). Dışarıdaki kod `oyun::varsayilan()` çağırınca ise **hata** alır:
``type `Ayar` is private``. Fonksiyon açık ama döndürdüğü değerin tipine kimse ulaşamıyor. Kural: bir
`pub` öğenin imzasında geçen her tip en az o öğe kadar görünür olmalı. Çözüm `pub struct Ayar` yazmaktır;
alanları yine gizli kalabilir.
:::

```memory
title: Gizli alan bellekte nerede?
steps:
  - caption: "`roman` bir `Kitap`: `baslik` (pub), `tur` (pub) ve `stok` (gizli) stack'te yan yana durur; başlığın karakterleri heap'tedir. Gizlilik bu resmi hiç değiştirmez, yalnızca **kimin dokunabileceğini** belirler."
    stack:
      - frame: main
        vars:
          - { name: roman.baslik, type: String, value: "ptr | len | cap", to: h1, mut: true, note: pub }
          - { name: roman.tur, type: Tur, value: Roman, note: pub }
          - { name: roman.stok, type: u32, value: "1", note: "gizli, yalnızca kutuphane modülü dokunur" }
    heap:
      - { id: h1, value: "Kürk Mantolu Madonna (Sabahattin Ali)" }
```

## Kapsülleme: kurucular ve değişmez koşullar

Gizli alanların asıl gücü burada ortaya çıkar. Bir tipin **her zaman** doğru olması gereken kuralına
**değişmez koşul (invariant)** denir: "stok eksiye düşmez", "stadyuma kapasiteden fazla kişi girmez",
"yaş 150'den büyük olamaz". Alanlar açık olsaydı herkes bu kuralları tek satırla çiğneyebilirdi.
Alanlar gizli olunca ise değeri değiştirmenin **tek yolu** senin yazdığın metotlardır; kuralı da orada,
**bir kez** denetlersin. Buna **kapsülleme (encapsulation)** denir.

:::analogy Banka veznesi
Kasadaki paraya kendin uzanamazsın; veznedara gidersin. Veznedar kimliğini kontrol eder, bakiyeni
denetler, kuralları uygular. Gizli alanlar **kasadır**, `pub` metotlar **vezne penceresi**. Kasa
herkese açık olsaydı bankanın kuralları yalnızca bir rica olurdu.
:::

Bir stadyum turnikesi düşün: kapasite dolunca kimse giremez.

```rust
mod stadyum {
    pub struct Turnike {
        kapasite: u32,
        iceride: u32,
    }

    impl Turnike {
        pub fn yeni(kapasite: u32) -> Turnike {
            Turnike { kapasite, iceride: 0 }
        }

        /// Yer varsa bir kişiyi içeri alır ve true döndürür; doluysa false.
        pub fn gecis(&mut self) -> bool {
            if self.iceride < self.kapasite {
                self.iceride += 1;
                true
            } else {
                false
            }
        }

        pub fn iceride(&self) -> u32 {
            self.iceride
        }
    }
}

fn main() {
    let mut turnike = stadyum::Turnike::yeni(2);
    for taraftar in ["Ayşe", "Burak", "Cem"] {
        if turnike.gecis() {
            println!("{taraftar} içeri girdi.");
        } else {
            println!("{taraftar}: Üzgünüz, stadyum dolu!");
        }
    }
    println!("İçeride {} kişi var.", turnike.iceride());
    // turnike.iceride = 50_000; // ← derlenmez: alan gizli (E0616)
}
```

Bu tasarımda üç şey birlikte çalışıyor:

- **Gizli alanlar:** Kimse `iceride`'yi dışarıdan değiştiremez.
- **Kurucu (`yeni`):** Alanlar gizli olduğu için dışarıda `Turnike { ... }` yazılamaz (E0451). Bir
  turnike elde etmenin tek yolu `yeni`'dir ve her turnike **geçerli** bir durumda (`iceride: 0`) doğar.
- **Kuralı denetleyen metotlar:** Durumu değiştiren tek kapı `gecis`'tir; kapasite kuralı yalnızca
  orada yazılır.

Python'da alanların başına `_` koyup "lütfen dokunmayın" dersin; Java'da `private` alanlar ve
getter/setter yazarsın. Rust'ın farkı: gizli alanlar varsayılandır ve kural derleyici tarafından
**zorunlu** kılınır.

Önceki modülleri hatırla. Bu kod derlenir mi?

```compiles
question: Modül 2 ve 5'i hatırla. Bu kod derlenir mi?
code: |
  mod stadyum {
      pub struct Turnike {
          kapasite: u32,
          iceride: u32,
      }

      impl Turnike {
          pub fn yeni(kapasite: u32) -> Turnike {
              Turnike { kapasite, iceride: 0 }
          }

          pub fn gecis(&mut self) -> bool {
              if self.iceride < self.kapasite {
                  self.iceride += 1;
                  true
              } else {
                  false
              }
          }
      }
  }

  fn main() {
      let turnike = stadyum::Turnike::yeni(100);
      let girdi = turnike.gecis();
      println!("{girdi}");
  }
answer: false
error: E0596
explanation: |
  Gizlilik açısından her şey yolunda: `Turnike`, `yeni` ve `gecis` `pub`. Sorun başka yerde: `gecis`
  **`&mut self`** alıyor, yani turnikeyi değiştirerek ödünç alıyor. `turnike` ise `mut` olmadan
  tanımlanmış → **E0596: cannot borrow `turnike` as mutable, as it is not declared as mutable**.
  Çözüm: `let mut turnike = ...`. Gizlilik kuralları, değişmezlik ve ödünç alma kurallarıyla
  **birlikte** çalışır; biri diğerinin yerine geçmez.
```

Şimdi kapsüllemeyi bir tuple struct ile sen kur:

```fill
prompt: |
  `yas` modülündeki `Yas` tipi, 0–150 aralığı dışındaki değerlerin **hiç oluşturulamamasını** garanti
  etmeli. Boşlukları doldur: tip ve kurucusu dışarıdan görünsün, ama içteki sayı **gizli** kalsın.
code: |
  mod yas {
      ___0 struct Yas(u8);

      impl Yas {
          ___1 fn yeni(deger: u8) -> Option<Yas> {
              if deger <= 150 {
                  Some(Yas(deger))
              } else {
                  None
              }
          }

          pub fn deger(&self) -> u8 {
              self.___2
          }
      }
  }

  fn main() {
      match yas::Yas::yeni(29) {
          Some(y) => println!("Geçerli yaş: {}", y.deger()),
          None => println!("Geçersiz yaş!"),
      }
      match yas::Yas::yeni(200) {
          Some(y) => println!("Geçerli yaş: {}", y.deger()),
          None => println!("Geçersiz yaş!"),
      }
  }
blanks:
  - ["pub", "pub(crate)"]
  - ["pub", "pub(crate)"]
  - ["0"]
output: |
  Geçerli yaş: 29
  Geçersiz yaş!
explanation: |
  `pub struct Yas(u8);` tipi dışarıya açar ama içteki `u8` alanı **gizli** kalır (`pub struct Yas(pub u8)`
  yazmadık). Bu yüzden modül dışında `yas::Yas(200)` yazılamaz (**E0603: tuple struct constructor `Yas`
  is private**); bir `Yas` elde etmenin tek yolu, kuralı denetleyen `Yas::yeni`'dir. Gizli alana modülün
  içinden `self.0` ile ulaşılır.

  Sonuç: programın hiçbir yerinde 150'den büyük bir `Yas` **var olamaz**. Modül 7'deki "geçersiz
  durumları temsil edilemez kıl" fikri, gizlilik sayesinde artık tiplerin sınırında da korunuyor.
```

## Alıştırmalar

:::info Testler bu kodu nereden çağırıyor?
Bu uygulamadaki alıştırmalarda testler, senin kodunun **sonuna** bir modül olarak eklenir:

```rust,ignore
// ... senin kodun burada biter

#[cfg(test)]
mod rusteach_tests {
    use super::*;

    // testler burada
}
```

Yani testler crate kökünün bir **alt modülündedir**. Kökteki gizli öğeleri görebilirler (alt modüller
atalarının gizli öğelerini görür) ama `mod banka`'nın **içindeki** gizli öğeleri göremezler; onlar için
`pub` gerekir. (`use super::*;` satırını Ders 4'te, testleri Modül 13'te ayrıntılı göreceğiz.)
:::

İlk alıştırmada derleyicinin hata mesajlarını rehber olarak kullanacaksın:

```exercise
id: m08-e-karakter-gizlilik
title: Gizlilik hatalarını düzelt
difficulty: 2
prompt: |
  Bu oyun kodu derlenmiyor: `oyun` modülündeki hiçbir şey dışarıya açık değil. **En az sayıda**
  `pub` ekleyerek programı derlenir hâle getir. Program şunu yazdırmalı: `Ferris canı: 25`

  Kural: karakterin **`can` alanı gizli kalmalı**. Can, yalnızca `hasar_al` ile azalabilmeli ve
  dışarıdan `can()` metoduyla okunabilmeli; kimse `k.can = 9999;` yazamamalı.
starter: |
  mod oyun {
      struct Karakter {
          ad: String,
          can: u32,
      }

      impl Karakter {
          fn yeni(ad: &str) -> Karakter {
              Karakter {
                  ad: String::from(ad),
                  can: 100,
              }
          }

          fn hasar_al(&mut self, miktar: u32) {
              if miktar >= self.can {
                  self.can = 0;
              } else {
                  self.can -= miktar;
              }
          }

          fn can(&self) -> u32 {
              self.can
          }
      }
  }

  fn main() {
      let mut k = oyun::Karakter::yeni("Ferris");
      k.hasar_al(30);
      k.hasar_al(45);
      println!("{} canı: {}", k.ad, k.can());
  }
starter_compiles: false
solution: |
  mod oyun {
      pub struct Karakter {
          pub ad: String,
          can: u32,
      }

      impl Karakter {
          pub fn yeni(ad: &str) -> Karakter {
              Karakter {
                  ad: String::from(ad),
                  can: 100,
              }
          }

          pub fn hasar_al(&mut self, miktar: u32) {
              if miktar >= self.can {
                  self.can = 0;
              } else {
                  self.can -= miktar;
              }
          }

          pub fn can(&self) -> u32 {
              self.can
          }
      }
  }

  fn main() {
      let mut k = oyun::Karakter::yeni("Ferris");
      k.hasar_al(30);
      k.hasar_al(45);
      println!("{} canı: {}", k.ad, k.can());
  }
check: output
expected_output: "Ferris canı: 25"
hints:
  - |
    Derleyicinin hatalarını **yukarıdan aşağıya** oku. Her E0603, E0624 ve E0616 hatası sana tam olarak
    hangi öğenin gizli olduğunu söylüyor.
  - |
    `main`'in dışarıdan kullandığı her şey açılmalı: struct'ın kendisi, `yeni`, `hasar_al`, `can()`
    metodu ve `main`'in doğrudan okuduğu `ad` alanı.
  - |
    `can` **alanını** gizli bırak; `main` canı `can()` metoduyla okuyor. Metot ile alan aynı adı
    taşıyabilir: `pub fn can(&self) -> u32` açık, `can: u32` alanı gizli.
forbid:
  - pattern: "pub(\\([^)]*\\))?\\s+can\\s*:"
    message: "`can` alanını açma! Can yalnızca `hasar_al` ile değişebilmeli; okumak için `can()` metodu var."
require:
  - pattern: "hasar_al\\(30\\)"
    message: "`main`'deki `k.hasar_al(30)` çağrısını silme; amaç kodu olduğu gibi derlenir hâle getirmek."
  - pattern: "hasar_al\\(45\\)"
    message: "`main`'deki `k.hasar_al(45)` çağrısını silme; amaç kodu olduğu gibi derlenir hâle getirmek."
  - pattern: "k\\.can\\(\\)"
    message: Canı `k.can()` metoduyla okumaya devam et.
explanation: |
  Toplam **beş** `pub` gerekti ve her biri bir hata koduna karşılık geliyordu:

  - `pub struct Karakter` → **E0603** (struct gizliydi; `main` tipin adını bile göremiyordu)
  - `pub fn yeni` → **E0624** (gizli ilişkili fonksiyon)
  - `pub fn hasar_al` ve `pub fn can` → **E0624** (gizli metotlar)
  - `pub ad: String` → **E0616** (`main` alanı doğrudan okuyor)

  `can` alanı ise bilerek gizli kaldı. Böylece "can 0'ın altına inmez ve yalnızca hasarla azalır" kuralı
  sadece `hasar_al`'ın içinde yaşıyor; başka hiçbir kod onu çiğneyemez. `ad` için `pub` yerine bir
  `ad()` okuma metodu da yazabilirdin - bu, adı da salt okunur yapardı. "En az `pub`" ilkesi:
  dışarının **ihtiyaç duyduğu** kadarını aç.
```

Şimdi sıfırdan bir tasarım:

```exercise
id: m08-e-banka-hesabi
title: Bakiyesi korunan banka hesabı
difficulty: 3
prompt: |
  `banka` modülündeki `Hesap` tipini tamamla. Kurallar:

  - Bakiye **asla** dışarıdan doğrudan değiştirilemesin: `bakiye` alanı gizli kalmalı.
  - `Hesap::ac(sahip)` yeni bir hesabı **0** bakiyeyle açar.
  - `yatir(miktar)` bakiyeyi artırır.
  - `cek(miktar) -> bool`: bakiye yetiyorsa düşer ve `true` döner; yetmiyorsa **hiçbir şey değişmez**
    ve `false` döner.
  - `havale(&mut self, hedef: &mut Hesap, miktar) -> bool`: çekim başarılıysa parayı hedef hesaba yatırır.
  - `bakiye()` ve `sahip()` okuma metotlarıdır.

  Testler `banka` modülünün **dışından** çağıracak; neyin `pub` olacağına sen karar ver.
starter: |
  mod banka {
      pub struct Hesap {
          sahip: String,
          bakiye: u64,
      }

      impl Hesap {
          fn ac(sahip: &str) -> Hesap {
              todo!()
          }

          fn sahip(&self) -> &str {
              todo!()
          }

          fn bakiye(&self) -> u64 {
              todo!()
          }

          fn yatir(&mut self, miktar: u64) {
              todo!()
          }

          fn cek(&mut self, miktar: u64) -> bool {
              todo!()
          }

          fn havale(&mut self, hedef: &mut Hesap, miktar: u64) -> bool {
              todo!()
          }
      }
  }

  fn main() {
      // İstersen önce burada dene:
      // let mut h = banka::Hesap::ac("Zeynep");
  }
solution: |
  mod banka {
      pub struct Hesap {
          sahip: String,
          bakiye: u64,
      }

      impl Hesap {
          pub fn ac(sahip: &str) -> Hesap {
              Hesap {
                  sahip: String::from(sahip),
                  bakiye: 0,
              }
          }

          pub fn sahip(&self) -> &str {
              &self.sahip
          }

          pub fn bakiye(&self) -> u64 {
              self.bakiye
          }

          pub fn yatir(&mut self, miktar: u64) {
              self.bakiye += miktar;
          }

          pub fn cek(&mut self, miktar: u64) -> bool {
              if miktar <= self.bakiye {
                  self.bakiye -= miktar;
                  true
              } else {
                  false
              }
          }

          pub fn havale(&mut self, hedef: &mut Hesap, miktar: u64) -> bool {
              if self.cek(miktar) {
                  hedef.yatir(miktar);
                  true
              } else {
                  false
              }
          }
      }
  }

  fn main() {
      let mut zeynep = banka::Hesap::ac("Zeynep");
      let mut mert = banka::Hesap::ac("Mert");
      zeynep.yatir(1000);
      let tamam = zeynep.havale(&mut mert, 300);
      println!("Havale: {tamam}");
      println!("{}: {} TL, {}: {} TL", zeynep.sahip(), zeynep.bakiye(), mert.sahip(), mert.bakiye());
  }
check: tests
tests: |
  #[test]
  fn yeni_hesap_sifir_bakiyeyle_acilir() {
      let h = banka::Hesap::ac("Zeynep");
      assert_eq!(h.bakiye(), 0, "yeni hesabın bakiyesi 0 olmalı");
      assert_eq!(h.sahip(), "Zeynep", "sahip adı korunmalı");
  }

  #[test]
  fn yatir_ve_cek() {
      let mut h = banka::Hesap::ac("Mert");
      h.yatir(500);
      assert!(h.cek(200), "500 TL'lik hesaptan 200 TL çekilebilmeli");
      assert_eq!(h.bakiye(), 300, "500 - 200 = 300 TL kalmalı");
  }

  #[test]
  fn yetersiz_bakiyede_hicbir_sey_degismez() {
      let mut h = banka::Hesap::ac("Ece");
      h.yatir(100);
      assert!(!h.cek(150), "bakiye yetmiyorsa cek false döndürmeli");
      assert_eq!(h.bakiye(), 100, "başarısız çekimde bakiye değişmemeli");
      assert!(h.cek(100), "bakiyenin tamamı çekilebilmeli");
      assert_eq!(h.bakiye(), 0, "tamamı çekilince bakiye 0 olmalı");
  }

  #[test]
  fn havale_iki_hesabi_birden_gunceller() {
      let mut ali = banka::Hesap::ac("Ali");
      let mut banu = banka::Hesap::ac("Banu");
      ali.yatir(1000);
      assert!(ali.havale(&mut banu, 250), "yeterli bakiyeyle havale başarılı olmalı");
      assert_eq!((ali.bakiye(), banu.bakiye()), (750, 250), "Ali'de 750, Banu'da 250 TL olmalı");
      assert!(!banu.havale(&mut ali, 300), "Banu'nun 250 TL'si 300 TL'lik havaleye yetmez");
      assert_eq!((ali.bakiye(), banu.bakiye()), (750, 250), "başarısız havalede iki bakiye de değişmemeli");
  }
hints:
  - |
    Önce hangi öğelerin `pub` olacağına karar ver: testler `Hesap::ac`'ı ve bütün metotları dışarıdan
    çağırıyor, ama **alanlara** hiç dokunmuyor. Alanlar gizli kalsın.
  - |
    `cek` önce koşulu denetlemeli: `if miktar <= self.bakiye { self.bakiye -= miktar; true } else { false }`.
    `sahip` metodu `&self.sahip` döndürebilir (`&String`, `&str`'e kendiliğinden dönüşür).
  - |
    `havale` işi iki adıma böler: önce kendi hesabından `self.cek(miktar)` dene; başarılıysa
    `hedef.yatir(miktar)` çağır ve `true` döndür, değilse `false`.
forbid:
  - pattern: "pub(\\([^)]*\\))?\\s+bakiye\\s*:"
    message: "`bakiye` alanını açma! Bakiye yalnızca `yatir`, `cek` ve `havale` ile değişebilmeli."
explanation: |
  Bu tasarımda bakiyeyi değiştirmenin yalnızca üç kapısı var: `yatir`, `cek` ve `havale`. "Bakiye
  eksiye düşmez" kuralı tek bir yerde, `cek`'in içinde yaşıyor; `havale` de kuralı yeniden yazmak
  yerine `cek`'i kullanıyor. Gizli alan + `pub` kurucu + `pub` metotlar: kapsüllemenin tarifi budur.

  Birkaç ayrıntı:

  - `sahip(&self) -> &str`, alanın kopyasını değil **ödüncünü** verir (Modül 5). Dışarıdaki kod adı
    okuyabilir ama değiştiremez.
  - `bakiye` için `u64` seçmek de bir korumadır: işaretsiz tip negatif değer tutamaz. Ama yalnız
    başına yetmez: denetimsiz bir `self.bakiye -= miktar` yetersiz bakiyede debug derlemesinde taşma
    (overflow) paniği verir, `--release`'te ise sessizce sarar ve hesapta birden 18 kentilyon TL
    belirirdi (Modül 2). Bu yüzden önce denetliyoruz. (`checked_sub` de aynı işi `Option` ile görür.)
  - Borrow checker bonusu: `ali.havale(&mut ali, 10)` **derlenmez** (E0499), çünkü aynı hesabı iki kez
    değiştirilebilir olarak ödünç alamazsın. Kendine havale gibi tuhaf durumlar derleme zamanında
    elenir.
```

## Özet

:::remember
- Her öğe varsayılan olarak **gizlidir**. Gizli bir öğe, tanımlandığı modülde ve onun **alt
  modüllerinde** görünür: görünürlük içeriden dışarıya akar.
- `pub` bir öğe, içinde durduğu modülü görebilen her yerden görünür. Bir yolun çalışması için yoldaki
  **her halka** görünür olmalıdır.
- `pub mod` modülün adını açar, içindekileri değil. `pub struct` tipi açar, **alanları ve metotları**
  değil (her biri ayrı `pub` ister). `pub enum` ise **bütün varyantları** açar.
- Gizli alanlar + `pub` kurucu + `pub` metotlar = **değişmez koşulları** koruyan kapsülleme.
- Ara seviyeler: `pub(crate)` crate'in her yeri, `pub(super)` bir üst modül (ve onun alt modülleri),
  `pub(in crate::a)` belirtilen ata modül.
- Hatalar: **E0603** gizli öğe, **E0616** gizli alan, **E0451** gizli alanlı struct literal,
  **E0624** gizli metot.
:::

```reflect
prompt: |
  Rust'ta öğelerin varsayılan olarak gizli olması neden iyi bir karar? "Gizliden açığa geçmek" ile
  "açıktan gizliye geçmek" arasındaki farkı ve kapsüllemeyi kullanarak açıkla.
answer: |
  Model cevap: Gizli bir öğeyi istediğim zaman değiştirebilir ya da silebilirim, çünkü kimse ona
  bağımlı değildir. `pub` yaptığım her şey ise bir sözdür; başkaları ona güvenip kod yazar ve onu geri
  almak herkesi kırar. Bu yüzden dar başlamak (gizli) ve yalnızca gerekeni açmak daha güvenlidir. Ayrıca
  alanlar gizli olunca tipin değerini değiştirmenin tek yolu benim metotlarım olur; "bakiye eksiye
  düşmez" gibi kuralları bir kez, metodun içinde denetlerim ve hiçbir dış kod bu kuralı çiğneyemez.
```

```flashcards
- front: Gizli (private) bir öğe hangi modüllerden görülebilir?
  back: Tanımlandığı modülden ve o modülün bütün alt modüllerinden (görünürlük içeriden dışarıya akar).
- front: "`pub struct Kitap { baslik: String }` tanımında `baslik` modül dışından okunabilir mi?"
  back: "Hayır. `pub struct` yalnızca tipi açar; her alan ayrıca `pub` ister (aksi hâlde **E0616**)."
- front: "`pub enum` tanımında varyantların başına ayrıca `pub` yazmak gerekir mi?"
  back: "Hayır. `pub enum`'un bütün varyantları (ve içlerindeki veri) otomatik olarak açıktır."
- front: Gizli alanı olan bir struct'ı modül dışında nasıl oluşturursun?
  back: "Struct literal ile oluşturamazsın (**E0451**); modülün sunduğu `pub` bir kurucuyu (ör. `yeni`) kullanırsın."
- front: "`pub(crate)` ne anlama gelir?"
  back: Öğe crate'in her yerinden görünür ama bu crate'i kullanan başka crate'lerden görünmez.
- front: "`E0624` hatası neyi anlatır?"
  back: "Gizli bir metot ya da ilişkili fonksiyon (ör. `Hesap::yeni`) modül dışından çağrılmış."
- front: "`pub mod raf { fn bul() {} }` için dışarıdan `raf::bul()` çağrılabilir mi?"
  back: "Hayır. `pub mod` yalnızca modülün adını açar; `bul` da ayrıca `pub` olmalı (**E0603**)."
- front: Değişmez koşul (invariant) nedir ve gizlilik onu nasıl korur?
  back: Bir tipin her zaman doğru olması gereken kuralıdır; alanlar gizli olunca değer yalnızca kuralı denetleyen metotlarla değişebilir.
```
