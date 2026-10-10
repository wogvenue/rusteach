---
id: m13-l04
title: Dokümantasyon ve Doc Testleri
minutes: 23
type: lesson
objectives:
  - "`///` ve `//!` belge yorumlarıyla bir fonksiyonu, tipi ve crate'i Markdown kullanarak belgeleyebilmek"
  - "`# Examples`, `# Panics` ve `# Errors` bölümlerini doğru yerde kullanarak bir API'nin sözleşmesini yazabilmek"
  - "Belgedeki kod örneklerinin `cargo test` ile **doc test** olarak çalıştırıldığını ve gizli `#` satırları ile `?` kullanımını açıklayabilmek"
  - "`cargo doc --open` ile HTML belgeleri üretip docs.rs ile ilişkisini açıklayabilmek"
keywords: [doc comment, "///", "//!", doc test, rustdoc, cargo doc, Examples, Panics, Errors, docs.rs]
---

Modül 8'de docs.rs'te bir crate'in belgelerini açtığında her fonksiyonun altında açıklamalar, uyarılar ve
**örnek kodlar** gördün. O sayfaları kimse elle HTML olarak yazmadı: hepsi kaynak koddaki özel yorumlardan
**otomatik** üretildi. Dahası, o örnek kodların her biri yayınlanmadan önce **derlenip çalıştırıldı** —
yani belgelerdeki örnekler aynı zamanda birer test.

Bu derste kodunu bu şekilde belgelemeyi öğreneceksin. Ve bu uygulamanın kod bloklarında ilk modülden
beri perde arkasında kullanılan bir hileyle — gizli `#` satırlarıyla — karşılaşınca şaşırabilirsin: onu biz
icat etmedik, rustdoc'tan ödünç aldık!

## Belge yorumları: `///`

Sıradan bir yorum (`//`) kodu **okuyan** geliştirici içindir: "burada neden böyle yaptık?" Belge yorumu
(`///`, *doc comment*) ise kodu **kullanacak** kişi içindir: "bu fonksiyon ne yapar, nasıl çağrılır?"
`///`, hemen **altındaki** öğeyi (fonksiyon, struct, enum, alan, modül...) belgeler ve içinde **Markdown**
yazabilirsin.

```rust
/// Notların tam sayı ortalamasını döndürür. Liste boşsa `None` döner.
///
/// Ortalama **aşağı yuvarlanır**: `[70, 85]` için sonuç `77`'dir.
pub fn ortalama(notlar: &[u32]) -> Option<u32> {
    // Boş listede sıfıra bölmemek için erken dönüyoruz (bu yorum belgeye girmez).
    if notlar.is_empty() {
        return None;
    }
    let mut toplam = 0;
    for n in notlar {
        toplam += n;
    }
    Some(toplam / notlar.len() as u32)
}

fn main() {
    println!("{:?}", ortalama(&[70, 85]));
    println!("{:?}", ortalama(&[]));
}
```

```predict
code: |
  /// Notların tam sayı ortalamasını döndürür. Liste boşsa `None` döner.
  pub fn ortalama(notlar: &[u32]) -> Option<u32> {
      if notlar.is_empty() {
          return None;
      }
      let mut toplam = 0;
      for n in notlar {
          toplam += n;
      }
      Some(toplam / notlar.len() as u32)
  }

  fn main() {
      println!("{:?}", ortalama(&[90, 95, 100]));
      println!("{:?}", ortalama(&[1, 2]));
      if let Some(o) = ortalama(&[50]) {
          println!("tek not: {o}");
      }
  }
options:
  - |
    Some(95)
    Some(1)
    tek not: 50
  - |
    95
    1.5
    tek not: 50
  - |
    Some(95)
    Some(2)
    tek not: Some(50)
answer: 0
explanation: |
  `ortalama` bir `Option<u32>` döndürür; `{:?}` onu `Some(95)` biçiminde yazdırır (Modül 7). `[1, 2]`
  için `3 / 2` tamsayı bölmesidir ve `1` olur — belgede "aşağı yuvarlanır" diye yazmamızın sebebi tam
  olarak bu. `if let Some(o)` ise değeri kutudan çıkarır, bu yüzden son satırda sadece `50` görünür.
  İyi bir belge, kullanıcının bu tür sürprizleri **çağırmadan önce** öğrenmesini sağlar.
```

Editöründe (VS Code + rust-analyzer) `ortalama` adının üstüne geldiğinde bu belge, Markdown'ı işlenmiş
hâliyle bir baloncukta görünür. Yani belge yorumu yazdığın an, takım arkadaşların bundan yararlanmaya başlar.

:::info `///` aslında bir özniteliktir
Derleyici için `/// Metin` satırı, `#[doc = " Metin"]` özniteliğinin kısa yazılışıdır. Belge yorumları
Python'daki *docstring*'ler gibi çalışma zamanında yaşayan dizgeler değildir; Java'daki Javadoc gibi
**derleme zamanında** koda iliştirilen bilgilerdir ve programın boyutuna hiçbir şey eklemezler.
:::

```rust
#[doc = "Bir siparişin KDV dahil toplamını kuruş cinsinden hesaplar."]
pub fn kdv_dahil(kurus: u32) -> u32 {
    kurus + kurus * 20 / 100
}

fn main() {
    // Yukarıdaki öznitelik, `/// Bir siparişin ...` yazmakla birebir aynıdır.
    println!("{} kuruş", kdv_dahil(1_000));
}
```

Belge yorumu her zaman bir **öğeyi** belgelemelidir. Peki altında hiçbir şey yoksa?

```compiles
code: |
  fn main() {
      println!("merhaba");
  }

  /// Bu yorum hiçbir şeyi belgelemiyor
answer: false
explanation: |
  Derlenmez: `error: expected item after doc comment` — `this doc comment doesn't document anything`.
  `///` sıradan bir yorum değil, **altındaki öğeye** bağlanan bir özniteliktir; dosyanın sonunda bağlanacak
  bir öğe olmadığı için hata alırsın. (Bir fonksiyonun **içinde**, örneğin bir `let` satırının üstünde
  kullanırsan da `unused doc comment` uyarısı alırsın: rustdoc ifadeleri belgelemez.) Kod içindeki
  açıklamalar için `//` kullan.
```

## `//!` ve standart bölümler

`///` altındaki öğeyi belgeler; **`//!`** ise **içinde bulunduğu** öğeyi. En sık kullanımı, `src/lib.rs`'in
en başında **crate'in kendisini** belgelemektir — docs.rs'te bir crate'i açınca gördüğün giriş sayfası budur.
Bir modül dosyasının (`src/katalog.rs`) başına yazılırsa o modülü belgeler.

```rust,ignore,title=src/lib.rs
//! # not_defteri
//!
//! Öğrenci notlarıyla çalışan küçük yardımcılar: ortalama, harf notu ve
//! metinden puan okuma.

/// Notların tam sayı ortalamasını döndürür. ...
pub fn ortalama(notlar: &[u32]) -> Option<u32> {
    // ...
}
```

:::warning `//!` en başta olmalı
`//!` satırları, belgeledikleri öğenin içinde **her şeyden önce** gelmelidir. `use` satırlarının ya da bir
fonksiyonun **ardından** `//!` yazarsan derleyici `error[E0753]: expected outer doc comment` der.
:::

Rust topluluğunun belgelerde kullandığı **standart başlıklar** vardır. Her okuyucu nereye bakacağını bilir:

| başlık | ne yazılır? | ne zaman? |
|---|---|---|
| `# Examples` | Çalışan, kısa kullanım örnekleri | Neredeyse her `pub` öğede |
| `# Panics` | Fonksiyonun hangi durumda **panik** yaptığı | Fonksiyon panik yapabiliyorsa — mutlaka |
| `# Errors` | Hangi durumda **hangi `Err`** döndüğü | `Result` döndüren fonksiyonlarda |
| `# Safety` | Çağıranın uyması gereken kurallar | `unsafe` fonksiyonlarda (Modül 24) |

:::analogy İlaç prospektüsü
Her ilacın kutusundan çıkan prospektüs aynı başlıklarla yazılır: *Kullanım şekli*, *Yan etkiler*,
*Kimler kullanmamalı*. Hasta hangi ilacı alırsa alsın, yan etkileri nerede arayacağını bilir. `# Examples`,
`# Panics` ve `# Errors` da kodunun prospektüsüdür: kullanıcı her crate'te paniklerin `# Panics` altında
yazdığını bilir ve kontrol etmeden fonksiyonu çağırmaz.
:::

```rust
/// 0-100 arası bir puanı harf notuna çevirir.
///
/// # Panics
///
/// `puan` 100'den büyükse panik yapar.
pub fn harf_notu(puan: u32) -> char {
    assert!(puan <= 100, "puan 0-100 arası olmalı: {puan}");
    if puan >= 90 {
        'A'
    } else if puan >= 80 {
        'B'
    } else if puan >= 70 {
        'C'
    } else if puan >= 60 {
        'D'
    } else {
        'F'
    }
}

/// Bir metni puana çevirir.
///
/// # Errors
///
/// Metin bir sayı değilse [`NotHatasi::SayiDegil`], sayı 100'ü aşıyorsa
/// [`NotHatasi::AralikDisi`] döner.
pub fn not_coz(metin: &str) -> Result<u32, NotHatasi> {
    let puan: u32 = metin.trim().parse().map_err(|_| NotHatasi::SayiDegil)?;
    if puan > 100 {
        return Err(NotHatasi::AralikDisi(puan));
    }
    Ok(puan)
}

/// [`not_coz`] fonksiyonunun hata tipi.
#[derive(Debug, PartialEq)]
pub enum NotHatasi {
    /// Metin bir tam sayı değil.
    SayiDegil,
    /// Sayı 0-100 aralığının dışında.
    AralikDisi(u32),
}
```

**Köşeli parantez** içine yazılan adlar **belge içi bağlantılardır** (intra-doc link): rustdoc adı kapsamdaki
öğeye çözer ve HTML belgede tıklanabilir bir bağlantıya çevirir. İçerideki backtick'ler yalnızca adı kod
gibi gösterir; bu yüzden en yaygın biçim `` [`not_coz`] ``'dur. Çözülemeyen bir bağlantı için rustdoc
uyarı verir, yani bağlantılar da kodla birlikte kontrol edilir. Enum varyantlarının ve struct alanlarının da
kendi `///` yorumları olabildiğine dikkat et.

```quiz
question: "`Result` döndüren bir fonksiyon, metin boşsa `Err(Bos)`, ama dahili bir tabloya erişirken programcı hatası olursa panik yapıyor. Belgesinde hangi bölümler olmalı?"
options:
  - "Sadece `# Examples`; hatalar zaten tipten belli"
  - "`# Errors` (ne zaman `Err(Bos)` döndüğü) ve `# Panics` (hangi durumda panik yaptığı), ayrıca `# Examples`"
  - "Sadece `# Panics`, çünkü `Err` de bir tür paniktir"
  - "`# Safety`, çünkü panik güvenli değildir"
answer: 1
explanation: |
  Modül 10'daki ayrımı belgelere taşıyoruz: `Err` **beklenen** bir sonuçtur ve kullanıcının ele alması
  gerekir → `# Errors`. Panik ise kullanıcının **kaçınması** gereken bir durumdur → `# Panics`. Tip imzası
  sadece *bir* hata tipi döndüğünü söyler; **hangi koşulda** hangi varyantın döndüğünü söylemez.
  `# Safety` yalnızca `unsafe` fonksiyonlar içindir (Modül 24).
feedback:
  - Tip, hatanın **ne zaman** döndüğünü söylemez.
  - Doğru! Errors + Panics + Examples.
  - "`Err` panik değildir; çağırana dönen sıradan bir değerdir."
  - "`# Safety` sadece `unsafe` fonksiyonlarda kullanılır."
```

## Belgedeki örnek bir testtir: doc test

Şimdi büyü kısmı. `# Examples` altına Markdown kod bloğuyla bir örnek yazdığında, `cargo test` o örneği
**ayrı bir program** olarak derler ve çalıştırır. Buna **doc test** denir.

````rust,ignore,title=src/lib.rs
//! # not_defteri
//!
//! Öğrenci notlarıyla çalışan küçük yardımcılar.

/// Notların tam sayı ortalamasını döndürür. Liste boşsa `None` döner.
///
/// # Examples
///
/// ```
/// use not_defteri::ortalama;
///
/// assert_eq!(ortalama(&[70, 80, 90]), Some(80));
/// assert_eq!(ortalama(&[]), None);
/// ```
pub fn ortalama(notlar: &[u32]) -> Option<u32> {
    // ... (yukarıdakiyle aynı)
}

/// 0-100 arası bir puanı harf notuna çevirir.
///
/// # Panics
///
/// `puan` 100'den büyükse panik yapar.
///
/// ```should_panic
/// not_defteri::harf_notu(101);
/// ```
pub fn harf_notu(puan: u32) -> char {
    // ...
}
````

`cargo test` çıktısının son bölümü artık boş değil (gerçek çıktı):

```console
   Doc-tests not_defteri

running 3 tests
test src/lib.rs - harf_notu (line 32) - should panic ... ok
test src/lib.rs - not_coz (line 59) ... ok
test src/lib.rs - ortalama (line 9) ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

all doctests ran in 0.17s; merged doctests compilation took 0.17s
```

Her doc test, **hangi öğenin belgesinde** ve **hangi satırda** başladığıyla adlandırılır. Örneklerin içinde
`use not_defteri::ortalama;` yazdığımıza dikkat et: doc test, kütüphanenin **dışında** derlenen ayrı bir
programdır — tıpkı bir entegrasyon testi gibi sadece `pub` API'yi görür ve crate'i adıyla içe aktarır.
Kabaca rustdoc senin örneğini şu programa çevirir:

```rust
# mod not_defteri {
#     pub fn ortalama(notlar: &[u32]) -> Option<u32> {
#         if notlar.is_empty() {
#             return None;
#         }
#         let mut toplam = 0;
#         for n in notlar {
#             toplam += n;
#         }
#         Some(toplam / notlar.len() as u32)
#     }
# }
// rustdoc'un ürettiği program (sadeleştirilmiş):
// `not_defteri` burada dış bir crate gibi davranıyor.
use not_defteri::ortalama;

fn main() {
    assert_eq!(ortalama(&[70, 80, 90]), Some(80));
    assert_eq!(ortalama(&[]), None);
    println!("doc test geçti");
}
```

Neden bu kadar önemli? Çünkü **belgeler çürür**. Fonksiyonun imzası ya da davranışı değişir, kimse README'deki
örneği güncellemeyi hatırlamaz ve yeni kullanıcılar çalışmayan örnekleri kopyalar. Rust'ta belge örneği
yanlışsa **testler kalır**. Diyelim ki belgeye yuvarlamayı düşünmeden şu satırı ekledin:
`assert_eq!(ortalama(&[70, 85]), Some(78));`

:::error
```text
running 3 tests
test src/lib.rs - not_coz (line 60) ... ok
test src/lib.rs - harf_notu (line 33) - should panic ... ok
test src/lib.rs - ortalama (line 9) ... FAILED

failures:

---- src/lib.rs - ortalama (line 9) stdout ----
Test executable failed (exit status: 101).

stderr:

thread 'main' (77) panicked at /tmp/rustdoctestrB9kWN/doctest_bundle_2024.rs:29:1:
assertion `left == right` failed
  left: Some(77)
 right: Some(78)
```
Doc test adı (`ortalama (line 9)`) sana **hangi örneğin** bozuk olduğunu söyler. `panicked at` satırındaki
dosya yolu rustdoc'un geçici dosyasıdır, ona takılma; `left`/`right` satırları her zamanki gibi okunur:
`(70 + 85) / 2 = 77` (tamsayı bölmesi), belge ise `78` iddia ediyordu.
:::

:::warning Doc testler sadece kütüphanelerde çalışır
Doc testler **library crate**'ler (`src/lib.rs`) için çalıştırılır. Sadece `src/main.rs`'ten oluşan bir binary
crate'te belge örnekleri test edilmez — bir sebep daha "kalın `lib.rs`, ince `main.rs`" desenini kullanmak
için. Bu uygulamanın alıştırmaları da tek dosyalık programlar olduğundan doc testleri burada
**çalıştıramayız**; çıktıları gerçek bir `cargo test` oturumundan alındı. Sadece doc testleri çalıştırmak
istediğinde: `cargo test --doc`.
:::

:::warning Özel öğelerin belgesindeki örnekler de çalıştırılır
rustdoc, `pub` olmayan bir fonksiyonun `///` yorumundaki kod bloğunu da doc test olarak toplar. Ama doc test
crate'in **dışında** derlendiği için o fonksiyonu çağıramaz: test ``error[E0603]: function `gizli` is private``
ile kalır. Özel yardımcıların davranışını birim testleriyle sına; belgelerine örnek koyacaksan bloğu
`text` ya da `ignore` olarak işaretle (etiketleri birazdan göreceğiz).
:::

```quiz
question: "`ortalama` fonksiyonunun adını `ortalama_al` olarak değiştirdin ama belgedeki `# Examples` örneğini güncellemeyi unuttun. `cargo test` ne der?"
options:
  - Hiçbir şey; belge yorumları derleyici tarafından yok sayılır
  - Sadece bir uyarı verir, testler geçer
  - "Doc test **derlenemez** (`ortalama` bulunamaz) ve doc test bölümü `FAILED` olur"
  - "Birim testleri kalır, doc testler geçer"
answer: 2
explanation: |
  Belgedeki örnek gerçek bir programdır: `use not_defteri::ortalama;` artık var olmayan bir şeyi içe
  aktarmaya çalışır ve derleme hatası verir (`unresolved import`). Doc test kalır, `cargo test` başarısız
  olur. Belgeler kodla **senkron kalmaya zorlanır** — Rust belgelerinin güvenilir olmasının sırrı budur.
  (Birim testlerin etkilenip etkilenmeyeceği, onların da eski adı kullanıp kullanmadığına bağlıdır.)
feedback:
  - Sıradan yorumlar yok sayılır; belge örnekleri değil.
  - Derlenemeyen bir doc test uyarı değil, başarısız bir testtir.
  - Doğru! Eskiyen örnek = kırmızı test.
  - Doc testler de bu değişiklikten etkilenir.
```

## Gizli satırlar, `?` ve kod bloğu ayarları

Doc test örneği kısa ve **okunaklı** olmalı, ama derlenebilmesi için bazen ek satırlar gerekir. rustdoc'un
çözümü: `# ` (diyez + boşluk) ile başlayan satırlar **derlenir ama belgede gösterilmez**. Tanıdık geldi mi?
Bu uygulamadaki kod blokları da aynı kuralı kullanıyor; kaynağını artık biliyorsun!

En yaygın kullanım `?` operatörüdür. Doc test kodu otomatik olarak `fn main() { ... }` içine sarılır ve bu
`main` `()` döndürür; Modül 10'dan biliyorsun ki `()` döndüren bir fonksiyonda `?` kullanılamaz (E0277).
Çözüm, örneğin sonuna dönüş değerini **gizli bir satırla** eklemektir:

````rust,ignore
/// # Examples
///
/// ```
/// use not_defteri::not_coz;
///
/// let puan = not_coz(" 85 ")?;
/// assert_eq!(puan, 85);
/// # Ok::<(), not_defteri::NotHatasi>(())
/// ```
pub fn not_coz(metin: &str) -> Result<u32, NotHatasi> {
    // ...
}
````

Kullanıcı belgede sadece üç temiz satır görür; `Ok::<(), NotHatasi>(())` satırı gizlidir. Örnek `(())` ile
bittiğinde rustdoc kodu `()` döndüren bir `main` yerine `Result` döndüren bir fonksiyonun içine sarar (kabaca:
"bu örnek `Result<(), NotHatasi>` döndüren bir `main` içindedir"). Turbofish (`::<>`, Modül 2'den tanıdık)
şarttır: `?`'in hatayı hangi tipe çevireceğini derleyici ancak böyle bilir.
Böylece örnekte `.unwrap()` yerine gerçek kodda kullanacağın deyimsel `?`'i gösterebilirsin.

````fill
prompt: Belge örneğinin `?` kullanabilmesi için boşlukları doldur. Örnek, kütüphaneyi dışarıdan kullanıyor.
code: |
  /// Metni pozitif bir sayıya çevirir.
  ///
  /// # Examples
  ///
  /// ```
  /// ___0 sayilar::pozitif_coz;
  ///
  /// let n = pozitif_coz("42")___1;
  /// assert_eq!(n, 42);
  /// # ___2::<(), std::num::ParseIntError>(())
  /// ```
  pub fn pozitif_coz(metin: &str) -> Result<u32, std::num::ParseIntError> {
      metin.trim().parse()
  }
blanks:
  - ["use"]
  - ["?"]
  - ["Ok"]
explanation: |
  Doc test kütüphanenin dışında çalıştığından fonksiyon `use sayilar::pozitif_coz;` ile içe aktarılır
  (`sayilar` crate'in adı). `?` hatayı `main`'e yükseltir; gizli `# Ok::<(), std::num::ParseIntError>(())`
  satırı da `main`'in dönüş tipini belirler. Belgeyi okuyan kişi bu son satırı hiç görmez.
````

Bir belge kod bloğunun nasıl ele alınacağını, açılış satırına yazdığın **etiketle** değiştirebilirsin:

| açılış | ne olur? | ne zaman? |
|---|---|---|
| ```` ``` ```` | Derlenir **ve** çalıştırılır (varsayılan Rust) | Her zamanki örnekler |
| ```` ```should_panic ```` | Çalıştırılır, **panik yapmalı** | `# Panics` bölümündeki örnekler |
| ```` ```no_run ```` | Derlenir ama **çalıştırılmaz** | Ağa bağlanan, dosya silen, sonsuz döngülü örnekler |
| ```` ```compile_fail ```` | **Derlenmemeli** | "Bunu yapamazsın" diye göstermek için (ör. borrow checker'ın engellediği kullanım) |
| ```` ```ignore ```` | Hiç derlenmez, `ignored` sayılır | Çok nadiren — çoğu zaman `no_run` daha iyidir |
| ```` ```text ```` | Rust kodu değil, test değil | Çıktı örnekleri, komutlar |

````quiz
question: |
  Bir fonksiyonun belgesinde beş kod bloğu var: bir tane etiketsiz (```` ``` ````), bir `ignore`,
  bir `text`, bir `no_run` ve bir `compile_fail`. Hepsi doğru yazılmış. `cargo test`'in doc test
  bölümünde kaç test listelenir ve kaçı **çalıştırılır** (programı yürütülür)?
options:
  - 5 test listelenir, 5'i çalıştırılır
  - "4 test listelenir (`text` test değildir); sadece etiketsiz olan çalıştırılır"
  - 3 test listelenir, 3'ü çalıştırılır
  - "4 test listelenir; etiketsiz, `no_run` ve `compile_fail` çalıştırılır"
answer: 1
explanation: |
  `text` bloğu Rust kodu sayılmaz, listeye hiç girmez. Kalan dördü listelenir (gerçek çıktıda
  `ignore` olan `... ignored`, `no_run` olan `- compile ... ok`, `compile_fail` olan
  `- compile fail ... ok` diye görünür). Ama **yürütülen** tek program etiketsiz olandır: `no_run`
  sadece derlenir, `compile_fail` derlenmemesi beklenen koddur, `ignore` ise hiç dokunulmaz.
feedback:
  - "`text` bir test değildir; `ignore` ve `no_run` da çalıştırılmaz."
  - Doğru! Listelenen 4, yürütülen 1.
  - "`ignore` da listede `ignored` olarak görünür."
  - "`no_run` ve `compile_fail` derleme aşamasında kalır; program yürütülmez."
````

## `cargo doc`: belgeleri görmek

Yazdığın belgeleri HTML olarak görmek için:

```console
$ cargo doc --open
 Documenting not_defteri v0.1.0 (C:\projeler\not_defteri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.92s
     Opening C:\projeler\not_defteri\target\doc\not_defteri\index.html
```

`cargo doc`, **rustdoc** aracını çalıştırır ve `target/doc/` altına, docs.rs'te gördüğün sayfaların aynısını
üretir: arama kutusu, `//!` ile yazdığın giriş sayfası, her `pub` öğe için ayrı sayfa, tıklanabilir
`` [`not_coz`] `` bağlantıları. Varsayılan olarak **bağımlılıklarının** belgelerini de üretir; bu sayede
internet olmadan da kullandığın crate'lerin belgelerine bakabilirsin (yalnızca kendi crate'in için
`--no-deps`). Bir crate'i crates.io'ya yayınladığında docs.rs aynı aracı senin yerine çalıştırır.

Sadece **`pub` öğeler** belgede görünür: özel fonksiyonlar kütüphanenin kullanıcısını ilgilendirmez.
(`cargo doc --document-private-items` ile ekip içi belgelerde onları da gösterebilirsin.)

:::deep Belgesiz `pub` öğe bırakmamak
`src/lib.rs`'in en başına `#![warn(missing_docs)]` yazarsan, belge yorumu olmayan her `pub` öğe için derleyici
uyarı verir. Yayınlanan crate'lerde yaygın bir alışkanlıktır. Clippy'nin `missing_panics_doc` ve
`missing_errors_doc` uyarıları da panik yapabilen ya da `Result` döndüren `pub` fonksiyonlarda ilgili
bölümün eksik olduğunu yakalar; ikisi de `clippy::pedantic` grubundadır, yani varsayılan olarak kapalıdır
ve `#![warn(clippy::missing_panics_doc)]` gibi bir satırla açılır. Ayrıca Rust 2024 sürümüyle rustdoc,
doc testleri tek tek değil **toplu** derler (çıktıdaki `merged doctests compilation` satırı) — büyük
crate'lerde doc testler bu yüzden çok daha hızlı. (`compile_fail` gibi bazı örnekler yine ayrı derlenir.)
:::

## Sıra sende: bir API'yi belgelemek

````exercise
id: m13-e-indirim-belgesi
title: Kampanya fonksiyonunu belgele
difficulty: 3
prompt: |
  Bir mağaza kütüphanesi için `indirimli_fiyat(fiyat_kurus, yuzde)` fonksiyonunu **yaz ve belgele**.

  **Davranış:** `yuzde` 100'den büyükse `Err(IndirimHatasi::GecersizYuzde(yuzde))` döner; aksi hâlde indirim
  uygulanmış fiyatı (kuruş) `Ok` içinde döndürür. **İndirim tutarı aşağı yuvarlanır**: 999 kuruşa %50
  indirimde indirim 499 kuruştur, fiyat 500 kuruş olur. Çok büyük fiyatlarda bile **taşma
  olmamalı** (en büyük `u32` fiyatı için de çalışmalı).

  **Belge:** Dosyanın en başına bir `//!` crate açıklaması; fonksiyonun üstüne `///` ile kısa bir açıklama,
  bir `# Errors` bölümü ve içinde `assert_eq!` geçen bir kod bloğu barındıran bir `# Examples` bölümü yaz.

  (Uygulama tek dosyalık programları çalıştırdığı için doc testin burada yürütülmez; örneğini yine de gerçek
  bir projede `cargo test`'ten geçecek şekilde, crate adını `magaza` kabul ederek yaz.)
starter: |
  #[derive(Debug, PartialEq)]
  pub enum IndirimHatasi {
      GecersizYuzde(u32),
  }

  pub fn indirimli_fiyat(fiyat_kurus: u32, yuzde: u32) -> Result<u32, IndirimHatasi> {
      todo!()
  }

  fn main() {
      println!("{:?}", indirimli_fiyat(20_000, 25));
      println!("{:?}", indirimli_fiyat(20_000, 150));
  }
solution: |
  //! # magaza
  //!
  //! Kampanya ve indirim hesaplayan yardımcılar. Tüm fiyatlar kuruş cinsindendir.

  /// [`indirimli_fiyat`] fonksiyonunun hata tipi.
  #[derive(Debug, PartialEq)]
  pub enum IndirimHatasi {
      /// Yüzde 0-100 aralığının dışında.
      GecersizYuzde(u32),
  }

  /// Fiyata yüzde indirim uygular ve indirimli fiyatı kuruş cinsinden döndürür.
  ///
  /// İndirim tutarı aşağı yuvarlanır (999 kuruşa %50 → 500 kuruş). Ara hesap `u64` ile
  /// yapıldığından büyük fiyatlarda taşma olmaz.
  ///
  /// # Errors
  ///
  /// `yuzde` 100'den büyükse [`IndirimHatasi::GecersizYuzde`] döner.
  ///
  /// # Examples
  ///
  /// ```
  /// use magaza::indirimli_fiyat;
  ///
  /// let fiyat = indirimli_fiyat(20_000, 25)?;
  /// assert_eq!(fiyat, 15_000);
  /// # Ok::<(), magaza::IndirimHatasi>(())
  /// ```
  pub fn indirimli_fiyat(fiyat_kurus: u32, yuzde: u32) -> Result<u32, IndirimHatasi> {
      if yuzde > 100 {
          return Err(IndirimHatasi::GecersizYuzde(yuzde));
      }
      let indirim = fiyat_kurus as u64 * yuzde as u64 / 100;
      Ok(fiyat_kurus - indirim as u32)
  }

  fn main() {
      println!("{:?}", indirimli_fiyat(20_000, 25));
      println!("{:?}", indirimli_fiyat(20_000, 150));
  }
check: tests
tests: |
  #[test]
  fn yuzde_yirmi_bes_indirim() {
      assert_eq!(indirimli_fiyat(20_000, 25), Ok(15_000), "200 TL'ye %25 indirim = 150 TL");
  }

  #[test]
  fn sinir_yuzdeler() {
      assert_eq!(indirimli_fiyat(9_999, 0), Ok(9_999), "%0 indirim fiyatı değiştirmez");
      assert_eq!(indirimli_fiyat(9_999, 100), Ok(0), "%100 indirim = bedava");
  }

  #[test]
  fn asagi_yuvarlanir() {
      assert_eq!(indirimli_fiyat(999, 50), Ok(500), "999'un yarısı 499,5 → indirim 499, fiyat 500");
  }

  #[test]
  fn gecersiz_yuzde_hata() {
      assert_eq!(indirimli_fiyat(1_000, 101), Err(IndirimHatasi::GecersizYuzde(101)));
  }

  #[test]
  fn buyuk_fiyatta_tasma_yok() {
      assert_eq!(indirimli_fiyat(u32::MAX, 50), Ok(u32::MAX - u32::MAX / 2), "u32::MAX × 50 taşmamalı");
  }
hints:
  - "Önce davranışı yaz: `if yuzde > 100 { return Err(IndirimHatasi::GecersizYuzde(yuzde)); }`. Sonra indirimi hesapla."
  - "`fiyat_kurus * yuzde` çarpımı `u32`'ye sığmayabilir (Modül 2: taşma). Çarpmadan önce iki değeri de `as u64` ile genişlet, sonucu `as u32` ile geri çevir."
  - "Belge iskeleti: en üstte `//! # magaza`, fonksiyonun üstünde `/// Açıklama`, `/// # Errors`, `/// # Examples`, ardından ``/// ``` `` satırlarıyla açılıp kapanan ve içinde `/// assert_eq!(...)` olan bir blok."
require:
  - pattern: "//!"
    message: Dosyanın başına `//!` ile bir crate açıklaması ekle.
  - pattern: "///\\s*# Errors"
    message: "Belgede bir `# Errors` bölümü olmalı."
  - pattern: "///\\s*# Examples"
    message: "Belgede bir `# Examples` bölümü olmalı."
  - pattern: "///\\s*```"
    message: "`# Examples` altında `///` satırlarıyla açılan bir kod bloğu olmalı."
  - pattern: "///.*assert_eq!"
    message: Belge örneğin `assert_eq!` ile sonucu doğrulamalı.
explanation: |
  Belgen artık bir **sözleşme**: kullanıcı fonksiyonu çağırmadan önce hangi durumda `Err` döndüğünü
  (`# Errors`) ve nasıl kullanılacağını (`# Examples`) bilir. Örnekteki gizli
  `# Ok::<(), magaza::IndirimHatasi>(())` satırı, `?`'i belge örneğinde kullanmanı sağlar; okuyucu bu satırı
  görmez.

  Taşma neden önemli? `u32::MAX × 50` yaklaşık 214 milyardır, `u32`'nin sınırı ise yaklaşık 4,3 milyar.
  Debug modda bu çarpım panik yapar (testler debug modda çalışır), release modda ise **sessizce** yanlış
  sonuç üretirdi. `as u64` ile genişletip hesaplamak ve sonucu geri çevirmek güvenlidir: indirim hiçbir
  zaman fiyatın kendisinden büyük olamaz, yani `as u32` dönüşümü değer kaybetmez. Bu tür ayrıntılar da
  belgenin ilk paragrafında yer almayı hak eder.

  Alternatif yazımlar: genişletme için `u64::from(fiyat_kurus)` (Modül 11'deki `From`; kayıpsız olduğu tip
  imzasından belli, Clippy'nin pedantik `cast_lossless` uyarısı da bunu önerir). Geri dönüşte ise
  `as u32` bir değeri **sessizce kırpabilir**; burada değişmez (indirim ≤ fiyat) sayesinde güvenli, ama
  emin olamadığın yerlerde `u32::try_from(indirim)` hatayı görünür kılar.
````

## Özet

:::remember
- `//` kodu okuyan geliştirici için, `///` kodu **kullanan** kişi için (altındaki öğeyi belgeler, Markdown destekler).
- `//!` **içinde bulunduğu** öğeyi belgeler: `src/lib.rs` başında crate'i, modül dosyası başında modülü. En başta olmalı.
- Standart bölümler: `# Examples`, `# Panics`, `# Errors` (`# Safety` → `unsafe`). `` [`ad`] `` belge içi bağlantıdır.
- Belgedeki kod blokları **doc test**tir: `cargo test` onları ayrı programlar olarak çalıştırır; crate'i dışarıdan (`use crate_adi::...`) kullanırlar. Sadece library crate'lerde çalışır.
- `# ` ile başlayan satırlar derlenir ama gösterilmez. `?` için: `# Ok::<(), HataTipi>(())`.
- Etiketler: `should_panic`, `no_run`, `compile_fail`, `ignore`, `text`.
- `cargo doc --open` → `target/doc/`; docs.rs aynı aracı (rustdoc) kullanır. Sadece `pub` öğeler görünür.
:::

```reflect
prompt: |
  Python'da ya da JavaScript'te bir kütüphanenin README'sindeki örneği kopyalayıp çalışmadığını gördüğün
  oldu mu? Rust'taki doc test yaklaşımı bu sorunu nasıl çözüyor ve bunun bedeli ne?
answer: |
  Model cevap: Sıradan belgelerdeki örnekler kodla birlikte test edilmediği için, API değiştiğinde
  sessizce eskir ve kullanıcılar çalışmayan kodu kopyalar. Rust'ta `# Examples` altındaki her kod bloğu
  `cargo test` sırasında ayrı bir program olarak derlenip çalıştırılır; örnek bozulursa test kalır ve
  belgeyi güncellemeye zorlanırım. Bedeli: örneklerin derlenebilir olması gerekir (bazen gizli `#`
  satırları eklemek gerekir), doc testler birim testlerinden daha yavaş derlenir ve sadece library
  crate'lerde çalışır. Buna karşılık belgelere güvenilebilir ve her örnek aynı zamanda bir entegrasyon
  testi gibi `pub` API'yi dışarıdan sınar.
```

```flashcards
- front: "`//`, `///` ve `//!` arasındaki fark nedir?"
  back: "`//` sıradan yorum (belgeye girmez); `///` altındaki öğeyi belgeler; `//!` içinde bulunduğu öğeyi (crate/modül) belgeler."
- front: Belge yorumlarında kullanılan üç standart bölüm başlığı nedir?
  back: "`# Examples`, `# Panics`, `# Errors` (`unsafe` fonksiyonlar için ayrıca `# Safety`)."
- front: Doc test nedir?
  back: "Belge yorumundaki kod bloğu; `cargo test` onu ayrı bir program olarak derleyip çalıştırır. Örnek yanlışsa test kalır."
- front: "Doc test kodu kütüphanenin fonksiyonuna nasıl erişir?"
  back: "Dış bir crate gibi: `use crate_adi::fonksiyon;` — sadece `pub` API'yi görür."
- front: Bir doc testte `?` kullanabilmek için ne yapılır?
  back: "Sona gizli bir satır eklenir: `# Ok::<(), HataTipi>(())` — doc testin `main`'i böylece `Result` döndürür."
- front: "Doc test kod bloğunda `no_run` etiketi ne yapar?"
  back: Örnek derlenir ama çalıştırılmaz (ağ, dosya, sonsuz döngü içeren örnekler için).
- front: "`cargo doc --open` ne yapar?"
  back: "rustdoc ile `target/doc/` altına HTML belgeler (bağımlılıklar dahil) üretir ve tarayıcıda açar. docs.rs da aynı aracı kullanır."
- front: Sadece `src/main.rs` olan bir projede doc testler çalışır mı?
  back: Hayır; doc testler yalnızca library crate'ler için çalıştırılır.
```
