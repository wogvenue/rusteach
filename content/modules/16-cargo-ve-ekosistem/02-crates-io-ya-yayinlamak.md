---
id: m16-l02
title: crates.io'ya Yayınlamak
minutes: 22
type: lesson
objectives:
  - "Yayınlanacak bir crate'i `///`, `//!`, `# Examples` bölümleri ve `pub use` ile kullanışlı bir genel API'ye sahip olacak biçimde hazırlayabilmek"
  - "`Cargo.toml`'a yayın için gereken meta verileri (`description`, `license` ve diğerleri) ekleyebilmek"
  - "`cargo publish`, `--dry-run` ve `cargo yank` komutlarının ne yaptığını ve yayının neden kalıcı olduğunu açıklayabilmek"
  - Bir API değişikliğinin semver'e göre yama, küçük ya da büyük sürüm gerektirdiğine karar verebilmek
keywords: [crates.io, cargo publish, cargo yank, semver, metadata, license, docs.rs, pub use, deprecated, non_exhaustive]
---

Modül 9'da Türkçenin küçük bir tuzağını görmüştün: Rust'ın `to_uppercase` metodu `i` harfini `I` yapar,
oysa Türkçede doğrusu `İ`'dir. Diyelim ki bu sorunu çözen küçük, temiz bir kütüphane yazdın. Kendi
projelerinde kullanıyorsun, arkadaşların da istiyor. Kodu e-postayla mı göndereceksin?

Hayır: **crates.io**'ya yayınlayacaksın. Böylece dünyadaki her Rust geliştiricisi tek bir
`cargo add turkce-harf` ile onu kullanabilir. Bu derste bir crate'i yayına hazırlamayı, yayınlamayı ve
yayından sonra en önemli sorumluluğunu, yani **sürüm disiplinini (semver)** öğreneceksin.

:::ferris
crates.io'da 150 binden fazla crate var ve her biri senin gibi birinin "bunu başkaları da kullanabilir"
demesiyle başladı. Bugün sen de o yolun başındasın! 🦀
:::

## Önce belge: kullanıcının ilk gördüğü şey

Bir crate'i yayınladığında **docs.rs** onu otomatik olarak derler ve belgelerini yayınlar. Kullanıcının
kodundan önce gördüğü şey bu belgelerdir. Modül 13'te öğrendiğin araçları hatırla: `///` bir öğeyi,
`//!` ise içinde bulunduğu crate'i ya da modülü belgeler.

```rust
//! # turkce_harf
//!
//! Türkçeye özgü büyük/küçük harf dönüşümleri: `i ↔ İ` ve `ı ↔ I`.

/// Metni Türkçe kurallarına göre büyük harfe çevirir.
///
/// Standart [`str::to_uppercase`] `i` harfini `I` yapar; bu fonksiyon `İ` yapar.
///
/// # Examples
///
/// ```
/// assert_eq!(turkce_harf::buyut("istanbul"), "İSTANBUL");
/// assert_eq!(turkce_harf::buyut("ılık"), "ILIK");
/// ```
pub fn buyut(metin: &str) -> String {
    let mut sonuc = String::new();
    for c in metin.chars() {
        match c {
            'i' => sonuc.push('İ'),
            'ı' => sonuc.push('I'),
            _ => sonuc.extend(c.to_uppercase()),
        }
    }
    sonuc
}

fn main() {
    println!("{}", buyut("iğdır ılıcaları"));
}
```

İyi bir crate belgesinin üç özelliği vardır:

1. **Crate düzeyinde bir giriş** (`//!`): Bu crate ne işe yarar, neden var, nereden başlanır?
2. **Her genel öğede bir örnek** (`# Examples`): Kullanıcı kopyalayıp çalıştırabilmeli. Belgedeki örnekler
   `cargo test` ile **test olarak çalışır** (doc test), yani belgen asla kodunla çelişmez.
3. **Sözleşmenin sınırları**: Fonksiyon panikleyebiliyorsa `# Panics`, `Result` döndürüyorsa `# Errors`
   bölümü ne zaman ve neden olduğunu anlatır.

Köşeli parantez içindeki `` [`str::to_uppercase`] `` bir **belge içi bağlantıdır** (*intra-doc link*):
`cargo doc` onu ilgili sayfaya tıklanabilir bir bağlantıya çevirir, ad yanlışsa da uyarır.

:::info Diğer dillerde
Python'da docstring'ler, Java'da Javadoc yorumları vardır; ama içlerindeki örnekler çoğu zaman eskir,
çünkü kimse onları çalıştırmaz. Rust'ta belgedeki örnek bir **testtir**: API'yi değiştirip belgeyi
güncellemeyi unutursan `cargo test` kırmızı yanar.
:::

Belgesiz bir genel öğe bırakmamak için derleyiciden yardım isteyebilirsin. `missing_docs` lint'i
varsayılan olarak kapalıdır; kütüphanenin köküne `#![deny(missing_docs)]` yazarsan onu hataya
yükseltirsin (lint seviyelerini Ders 5'te ayrıntılı göreceğiz):

````compiles
question: Bu **kütüphane** crate'i derlenir mi?
code: |
  #![deny(missing_docs)]
  //! Türkçe harf dönüşümleri.

  /// Metni büyük harfe çevirir.
  pub fn buyut(metin: &str) -> String {
      metin.to_uppercase()
  }

  pub fn kucult(metin: &str) -> String {
      metin.to_lowercase()
  }
answer: false
explanation: |
  `kucult` genel (`pub`) bir fonksiyon ama belge yorumu yok. `missing_docs` lint'i `deny` seviyesinde
  olduğu için bu bir **derleme hatasıdır**:

  ```text
  error: missing documentation for a function
   --> src/lib.rs:9:1
    |
  9 | pub fn kucult(metin: &str) -> String {
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  ```

  Bu lint yalnızca **genel API**'ye bakar: gizli (`pub` olmayan) fonksiyonların belgesiz kalması sorun
  değildir, çünkü kullanıcı onları hiç görmez. Hata kodu (`E....`) olmadığına dikkat et: lint'lerden
  gelen hatalar kod yerine lint adını taşır.
````

## Kullanışlı bir vitrin: pub use

Kütüphaneni büyüttükçe içini modüllere bölersin (Modül 8). Bu iç düzen **senin** için mantıklıdır:

```text
turkce_harf
├── donusum
│   ├── buyuk   → buyut()
│   └── kucuk   → kucult()
└── dogrulama   → turkce_harf_mi()
```

Ama kullanıcı `turkce_harf::donusum::buyuk::buyut` yazmak zorunda kalmamalı; hatta senin iç düzenini
bilmemeli bile. Modül 8'de öğrendiğin **`pub use`** ile en sık kullanılan öğeleri crate'in köküne
"vitrin" olarak koyarsın:

```rust
# mod donusum {
#     pub mod buyuk {
#         pub fn buyut(metin: &str) -> String {
#             metin.replace('i', "İ").replace('ı', "I").to_uppercase()
#         }
#     }
#     pub mod kucuk {
#         pub fn kucult(metin: &str) -> String {
#             metin.replace('I', "ı").replace('İ', "i").to_lowercase()
#         }
#     }
# }
# mod dogrulama {
#     pub fn turkce_harf_mi(c: char) -> bool {
#         "çğıöşüÇĞİÖŞÜ".contains(c)
#     }
# }
pub use crate::donusum::buyuk::buyut;
pub use crate::donusum::kucuk::kucult;
pub use crate::dogrulama::turkce_harf_mi;

fn main() {
    // Kullanıcı iç düzeni bilmeden, doğrudan kökteki adları kullanır:
    println!("{}", buyut("çiçek"));
    println!("{}", kucult("IŞIK"));
    println!("{}", turkce_harf_mi('ğ'));
}
```

Bunun iki büyük faydası var. Birincisi, kullanıcı `use turkce_harf::buyut;` yazar ve docs.rs ana
sayfada yeniden dışa aktarılan (*re-export*) öğeleri hemen gösterir. İkincisi daha da önemli: genel API
artık iç düzenden **bağımsızdır**. Yarın `donusum` modülünü yeniden düzenlesen bile köke koyduğun
yollar değişmez, yani kullanıcının kodu kırılmaz. Bu, bu dersin son adımında göreceğin semver
disiplininin ilk aracıdır.

```quiz
question: |
  `pub use crate::donusum::buyuk::buyut;` satırını kütüphanenin köküne ekledin. Bir kullanıcı için
  aşağıdakilerden hangisi **doğrudur**?
options:
  - "Artık yalnızca `turkce_harf::buyut` çalışır; uzun yol kapanır"
  - "`turkce_harf::buyut` kullanılabilir; `donusum` modülü `pub` ise uzun yol da çalışmaya devam eder"
  - "`pub use` fonksiyonun bir kopyasını oluşturur; iki ayrı fonksiyon olur"
  - "`pub use` yalnızca crate'in içinde geçerlidir; kullanıcı bunu göremez"
answer: 1
explanation: |
  `pub use` bir öğeye **ikinci bir genel ad** verir; kopya oluşturmaz, eski yolu da kapatmaz. Kullanıcı
  için en temiz durum, iç modülleri gizli (`mod donusum;`) tutup yalnızca vitrini açmaktır. Böylece
  iç düzen tamamen senin elinde kalır.
feedback:
  - "`pub use` bir ad ekler, hiçbir yolu kapatmaz."
  - Doğru!
  - Aynı fonksiyon, iki yol; tek bir tanım vardır.
  - "Sadece `use` (pub olmadan) crate içinde kalırdı; `pub use` tam olarak dışarıya açmak içindir."
```

````exercise
id: m16-e-turkce-vitrin
title: Türkçe harf kütüphanesinin vitrini
difficulty: 2
prompt: |
  `turkce_harf` kütüphanesini yayına hazırlıyorsun. `buyut` hazır; senden iki şey isteniyor:

  1. `kucult` fonksiyonunu yaz: `İ` → `i`, `I` → `ı`, diğer harfler için standart `to_lowercase`.
     Dikkat: Rust'ın kendi `to_lowercase`'i `İ` harfini tek bir `i`'ye değil, `i` + birleşik nokta
     işaretine (`"i̇"`) çevirir. Bu yüzden `İ`'yi de özel olarak ele almalısın.
  2. Crate'in köküne **`pub use`** ile `buyut` ve `kucult`'u koy; testler onları doğrudan kökten
     (`buyut(...)`, `kucult(...)`) çağırıyor.

  Bonus (zorunlu değil): `kucult`'a `# Examples` bölümü olan bir `///` belgesi yaz.
starter: |
  //! Türkçeye özgü büyük/küçük harf dönüşümleri.

  mod donusum {
      pub mod buyuk {
          /// Metni Türkçe kurallarına göre büyük harfe çevirir.
          pub fn buyut(metin: &str) -> String {
              let mut sonuc = String::new();
              for c in metin.chars() {
                  match c {
                      'i' => sonuc.push('İ'),
                      'ı' => sonuc.push('I'),
                      _ => sonuc.extend(c.to_uppercase()),
                  }
              }
              sonuc
          }
      }

      pub mod kucuk {
          pub fn kucult(metin: &str) -> String {
              todo!()
          }
      }
  }

  // Vitrini buraya kur.

  fn main() {
      println!("{}", donusum::buyuk::buyut("istanbul"));
  }
solution: |
  //! Türkçeye özgü büyük/küçük harf dönüşümleri.

  mod donusum {
      pub mod buyuk {
          /// Metni Türkçe kurallarına göre büyük harfe çevirir.
          pub fn buyut(metin: &str) -> String {
              let mut sonuc = String::new();
              for c in metin.chars() {
                  match c {
                      'i' => sonuc.push('İ'),
                      'ı' => sonuc.push('I'),
                      _ => sonuc.extend(c.to_uppercase()),
                  }
              }
              sonuc
          }
      }

      pub mod kucuk {
          /// Metni Türkçe kurallarına göre küçük harfe çevirir.
          ///
          /// # Examples
          ///
          /// ```
          /// assert_eq!(turkce_harf::kucult("ILIK İÇECEK"), "ılık içecek");
          /// ```
          pub fn kucult(metin: &str) -> String {
              let mut sonuc = String::new();
              for c in metin.chars() {
                  match c {
                      'İ' => sonuc.push('i'),
                      'I' => sonuc.push('ı'),
                      _ => sonuc.extend(c.to_lowercase()),
                  }
              }
              sonuc
          }
      }
  }

  pub use donusum::buyuk::buyut;
  pub use donusum::kucuk::kucult;

  fn main() {
      println!("{}", buyut("istanbul"));
      println!("{}", kucult("ILIK İÇECEK"));
  }
check: tests
tests: |
  #[test]
  fn noktali_ve_noktasiz_buyuk_harfler() {
      assert_eq!(kucult("İSTANBUL"), "istanbul", "'İ' tek bir 'i' olmalı (Rust'ın to_lowercase'i 'i̇' üretir)");
      assert_eq!(kucult("ILIK SU"), "ılık su", "'I' Türkçede 'ı' olur");
  }

  #[test]
  fn diger_turkce_harfler() {
      assert_eq!(kucult("ÇAĞRI ŞÖLENİ ÜÇÜNCÜ"), "çağrı şöleni üçüncü");
      assert_eq!(kucult("Rust 2024!"), "rust 2024!", "rakam ve noktalama değişmemeli");
      assert_eq!(kucult(""), "", "boş metin boş kalmalı");
  }

  #[test]
  fn gidis_donus() {
      let metin = "şiir ıhlamur iğne";
      assert_eq!(kucult(&buyut(metin)), metin, "önce büyütüp sonra küçültünce aynı metne dönülmeli");
  }
hints:
  - "`buyut`'un yapısını aynen kopyala: `chars()` ile harfleri gez, `match` ile özel harfleri yakala."
  - "Özel durumlar `'İ' => sonuc.push('i')` ve `'I' => sonuc.push('ı')`; geri kalanı için `sonuc.extend(c.to_lowercase())`."
  - "Vitrin için kökte iki satır yeter: `pub use donusum::buyuk::buyut;` ve `pub use donusum::kucuk::kucult;`."
require:
  - pattern: "pub\\s+use\\s+(crate::)?donusum::kucuk::kucult"
    message: "`kucult`'u crate'in köküne `pub use` ile koymalısın."
  - pattern: "pub\\s+use\\s+(crate::)?donusum::buyuk::buyut"
    message: "`buyut`'u crate'in köküne `pub use` ile koymalısın."
explanation: |
  `to_lowercase` Unicode'un **dilden bağımsız** kurallarını uygular. Unicode'a göre `İ`'nin küçüğü,
  noktayı korumak için `i` + `U+0307` (birleşik üst nokta) olur; ekranda çoğu zaman `i̇` diye görünür ve
  `"istanbul"` ile **eşit değildir**. Türkçe ve Azerice gibi dillerde doğru dönüşüm için dile özgü
  kuralları senin uygulaman gerekir; gerçek dünyada bu iş için `icu` gibi crate'ler vardır.

  `donusum` modülü gizli kaldı (`mod`, `pub mod` değil). Kullanıcı yalnızca vitrini görür:
  `turkce_harf::buyut` ve `turkce_harf::kucult`. Yarın `donusum`'u `harfler` diye yeniden adlandırsan
  bile yalnızca iki `pub use` satırını güncellersin; hiçbir kullanıcının kodu kırılmaz.

  Neden bir `main` var? Bu uygulamada kod tek bir dosyada çalışıyor. Gerçek kütüphanede bu kod
  `src/lib.rs`'te durur ve `main` olmaz.
````

## Cargo.toml: kimlik kartı

crates.io bir crate'i kabul etmeden önce `[package]` tablosunda bazı bilgileri ister. Yayına hazır bir
`Cargo.toml` şöyle görünür:

```toml
[package]
name = "turkce-harf"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"                    # MSRV: desteklenen en eski Rust (Ders 5)
description = "Türkçeye özgü büyük/küçük harf dönüşümleri (i/İ, ı/I)"
license = "MIT OR Apache-2.0"
repository = "https://github.com/elifk/turkce-harf"
readme = "README.md"
keywords = ["turkce", "turkish", "unicode", "case"]
categories = ["text-processing", "internationalization"]
exclude = ["ornek-veriler/"]
```

| Alan | Zorunlu mu? | Ne işe yarar? |
|---|---|---|
| `description` | **evet** | crates.io'daki arama sonuçlarında görünen tek cümlelik özet |
| `license` (ya da `license-file`) | **evet** | kodunu kimin, hangi koşullarla kullanabileceği |
| `repository`, `homepage`, `documentation` | önerilir | kaynak kodu, ana sayfa ve belge bağlantıları |
| `readme` | önerilir | crates.io sayfasında gösterilen tanıtım metni |
| `keywords` | önerilir | en fazla 5 arama anahtar kelimesi |
| `categories` | önerilir | crates.io'nun sabit kategori listesinden seçilir |
| `rust-version` | önerilir | crate'in derlendiği en eski Rust sürümü |
| `include` / `exclude` | isteğe bağlı | pakete hangi dosyaların gireceği |

`license` alanı **SPDX** adlarıyla yazılır: `MIT`, `Apache-2.0`, `GPL-3.0-only`... Rust ekosisteminin
geleneği, Rust'ın kendisi gibi `"MIT OR Apache-2.0"` çift lisansıdır: kullanıcı ikisinden birini seçer.

`name` crates.io'da **küresel ve benzersizdir**, ilk gelen alır. Ayrıca crates.io `-` ve `_` karakterlerini
aynı sayar: `turkce-harf` alındıysa `turkce_harf` adıyla yayın yapamazsın. Kodda ise tire her zaman alt
çizgiye dönüşür (Modül 8): `turkce_harf::buyut`.

Eksik alanla yayınlamaya çalışırsan crates.io yüklemeyi reddeder (kısaltılmış):

```console
$ cargo publish
error: failed to publish to registry at https://crates.io

Caused by:
  the remote server responded with an error (status 400 Bad Request): missing or empty metadata
  fields: description, license. Please see https://doc.rust-lang.org/cargo/reference/manifest.html
  for more information on configuring these fields
```

```quiz
question: "`Cargo.toml`'unda yalnızca `name`, `version` ve `edition` var. `cargo publish` için **en az** hangi alanları eklemelisin?"
options:
  - "`authors` ve `repository`"
  - "`description` ve `license` (ya da `license-file`)"
  - "`readme` ve `keywords`"
  - Hiçbirini; crates.io eksikleri otomatik doldurur
answer: 1
explanation: |
  crates.io iki şeyi zorunlu tutar: crate'in **ne olduğu** (`description`) ve **hangi koşullarla
  kullanılabileceği** (`license` ya da kendi lisans dosyan için `license-file`). Lisanssız kod,
  hukuken "tüm hakları saklı" sayılır; kimse onu güvenle kullanamaz. Diğer alanlar çok faydalıdır ama
  zorunlu değildir.
feedback:
  - "`authors` artık isteğe bağlıdır; `repository` önerilir ama zorunlu değildir."
  - Doğru!
  - İkisi de önerilir ama yükleme onlarsız da kabul edilir.
  - crates.io eksik meta veriyle yüklemeyi reddeder.
```

## cargo publish: geri dönüşü olmayan adım

Yayın akışı dört adımdır:

```console
$ cargo login                      # 1. crates.io'dan aldığın API anahtarını (token) bir kez kaydet
$ cargo package --list             # 2. pakete hangi dosyaların gireceğine bak
$ cargo publish --dry-run          # 3. her şeyi yap ama yükleme
$ cargo publish                    # 4. gerçekten yayınla
    Updating crates.io index
   Packaging turkce-harf v0.1.0 (C:\projeler\turkce-harf)
    Packaged 6 files, 9.4KiB (3.1KiB compressed)
   Verifying turkce-harf v0.1.0 (C:\projeler\turkce-harf)
   Compiling turkce-harf v0.1.0 (C:\projeler\turkce-harf\target\package\turkce-harf-0.1.0)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.02s
   Uploading turkce-harf v0.1.0 (C:\projeler\turkce-harf)
   Published turkce-harf v0.1.0 at registry `crates-io`
```

1. **`cargo login`**: crates.io'ya GitHub hesabınla girer, hesap ayarlarından bir **API token** oluşturur
   ve bunu bir kez `cargo login`'e verirsin. Bu anahtar bir şifre gibidir: asla bir dosyayla birlikte
   git'e ekleme, kimseyle paylaşma.
2. **`cargo package`**: Kodunu bir `.crate` arşivine (sıkıştırılmış kaynak kodu) paketler.
3. **Doğrulama**: Cargo paketi `target/package/` içinde **sıfırdan derler**. Pakete girmeyen bir dosyaya
   ihtiyacın varsa hata burada, yayından önce çıkar. `--dry-run` tam olarak bu güvenlik ağıdır.
4. **Yükleme**: Paket crates.io'ya gider; birkaç dakika içinde docs.rs belgelerini derler.

Bir de sık karşılaşılan bir fren var: Git deposunda henüz commit etmediğin değişiklikler varsa
`cargo publish` durur ve seni uyarır, çünkü yayınladığın kodun depodaki bir commit'e karşılık gelmesi
iyi bir alışkanlıktır.

### Yayın kalıcıdır

Yayınlanan bir sürüm **değiştirilemez ve üzerine yazılamaz**. `0.1.0`'da bir hata bulursan aynı numarayla
yeniden yükleyemezsin; yeni bir sürüm (`0.1.1`) yayınlarsın. crates.io yalnızca çok dar koşullarda (örneğin
yayından sonraki ilk 72 saat içinde ya da çok az indirilmiş ve hiçbir crate'in ona bağımlı olmadığı
durumlarda) bir crate'in tamamen silinmesine izin verir; o durumda bile aynı sürüm numarası bir daha kullanılamaz. Neden bu kadar katı? Çünkü binlerce
projenin `Cargo.lock` dosyası (Modül 8) o tam sürüme işaret ediyor olabilir. Bir sürüm kaybolsa ya da
içeriği değişse, dünkü derleme bugün başka bir sonuç verirdi.

Peki çok kötü bir hata yaptıysan? **Geri çekme (yank)**:

```console
$ cargo yank turkce-harf@0.1.1           # bu sürümü geri çek
$ cargo yank turkce-harf@0.1.1 --undo    # fikrini değiştirirsen geri al
```

Geri çekilen bir sürüm **silinmez**. Yalnızca Cargo artık yeni çözümlemelerde onu seçmez. `Cargo.lock`'unda
zaten `0.1.1` yazan projeler derlenmeye devam eder; yeni bir projede `cargo add turkce-harf` ise onu atlar.

:::analogy Basılmış kitap
Bir yayınevi kitabın bir baskısını bastığında, raflara ve kütüphanelere giden kitaplar geri toplanamaz.
Baskıda bir hata varsa yayınevi iki şey yapar: düzeltilmiş **yeni bir baskı** çıkarır ve eski baskı
için "bunu artık satmıyoruz" der. Evinde o baskıdan olan okur kitabını okumaya devam eder; yeni alan
ise düzeltilmiş baskıyı alır. `yank` tam olarak "artık satmıyoruz" demektir.
:::

```quiz
question: |
  `turkce-harf 0.1.1`'i yanlışlıkla bir test API anahtarı içeren bir dosyayla yayınladın ve sürümü
  `cargo yank` ile geri çektin. Hangisi **doğrudur**?
options:
  - Dosya artık crates.io'dan silindi; sorun çözüldü
  - "Sürüm yeni projelerde seçilmez ama arşiv hâlâ indirilebilir; anahtarı **hemen iptal edip yenilemelisin**"
  - "`0.1.1`'i düzeltilmiş içerikle aynı numarayla yeniden yükleyebilirsin"
  - "`Cargo.lock`'unda `0.1.1` olan projeler artık derlenemez"
answer: 1
explanation: |
  Yank **silme değildir**: `Cargo.lock`'ları bozmamak için arşiv yerinde kalır ve isteyen indirebilir.
  Sızan bir anahtar ya da şifre için tek doğru çözüm onu geçersiz kılıp yenisini oluşturmaktır. Ardından
  düzeltilmiş bir `0.1.2` yayınlarsın. Bu yüzden `cargo package --list` ile pakete ne girdiğine yayından
  **önce** bakmak çok değerlidir.
feedback:
  - Yank içeriği silmez, yalnızca yeni çözümlemelerden gizler.
  - Doğru!
  - Yayınlanan bir sürüm numarası asla yeniden kullanılamaz.
  - Tam tersi; yank var olan kilit dosyalarını bozmamak için tasarlandı.
```

## Semver disiplini: neyi kırarsın?

Yayınladığın andan itibaren kodun artık yalnızca senin değil. Kullanıcıların `Cargo.toml`'a
`turkce-harf = "1.2"` yazdığında Cargo'ya şunu söylerler: "1.2.0 ya da üstü, ama 2.0.0'dan küçük her
sürüm benim kodumla **uyumludur**." (Bu `^` kuralını Modül 8'de görmüştün.) `cargo update` çalıştıran her
kullanıcı senin yeni `1.x` sürümünü otomatik alır. O sürüm kodlarını bozarsa, sözünü tutmamış olursun.

**Semantik sürümleme (semver)**, `BÜYÜK.KÜÇÜK.YAMA` numarasının her parçasına bir anlam yükler:

| Değişiklik | Örnek | `1.4.2` → |
|---|---|---|
| **Yama**: davranışı düzelten, API'yi değiştirmeyen | bir hata düzeltmesi | `1.4.3` |
| **Küçük**: geriye uyumlu yenilik | yeni bir `pub fn` | `1.5.0` |
| **Büyük**: kullanıcı kodunu kırabilecek her şey | bir `pub fn`'i silmek ya da imzasını değiştirmek | `2.0.0` |

`1.0.0`'dan önce kural bir basamak kayar: `0.y.z`'de **kırıcı** değişiklik `y`'yi, diğer her şey `z`'yi
artırır. Yani `0.3.7` → kırıcı değişiklikle `0.4.0`, yeni bir özellikle `0.3.8` olur.

Bazı değişikliklerin kırıcı olduğu ilk bakışta belli değildir. Kendi kendine dene: Bir ayar kütüphanesinin
`1.0` sürümü, bütün alanları `pub` olan bir `Ayar` yapısı sunuyor. `1.1` sürümünde yazar zararsız görünen
**yeni bir alan** ekliyor. Kullanıcının kodu yeni sürümle derlenir mi?

```compiles
code: |
  mod ayar_kutuphanesi {
      // v1.1: yazi_boyutu alanı eklendi
      pub struct Ayar {
          pub dil: String,
          pub tema: String,
          pub yazi_boyutu: u8,
      }
  }

  // Kullanıcının v1.0'a göre yazdığı kod:
  fn main() {
      let a = ayar_kutuphanesi::Ayar {
          dil: String::from("tr"),
          tema: String::from("koyu"),
      };
      println!("{} / {}", a.dil, a.tema);
  }
answer: false
error: E0063
explanation: |
  Alanları tamamen `pub` olan bir struct'ı kullanıcı **struct ifadesiyle** kurabilir. Yeni bir alan
  eklendiğinde bu kod `E0063` hatası verir (*missing field `yazi_boyutu`*). Yani "sadece bir alan ekledim"
  aslında **büyük sürüm** gerektiren kırıcı bir değişikliktir.

  Kütüphane yazarları bunu iki yolla önler: alanları gizli tutup bir kurucu (`Ayar::new`) sunmak
  (Modül 8'deki kapsülleme), ya da struct'ı `#[non_exhaustive]` ile işaretlemek. Bu öznitelik,
  **başka crate'lerin** struct'ı ifadeyle kurmasını ve tüm alanlarını desenle açmasını yasaklar; böylece
  ileride alan eklemek kırıcı olmaz.
```

Kapsüllenmiş tasarımda aynı değişiklik kimseyi kırmaz. Alanlar gizli olduğu için kullanıcı struct'ı
yalnızca kurucu üzerinden kurabilir; yazar istediği kadar yeni alan ekleyebilir:

```rust
mod ayar_kutuphanesi {
    // v1.1: yazi_boyutu eklendi, ama alanlar gizli
    pub struct Ayar {
        dil: String,
        tema: String,
        yazi_boyutu: u8,
    }

    impl Ayar {
        pub fn new(dil: &str, tema: &str) -> Self {
            Ayar { dil: dil.to_string(), tema: tema.to_string(), yazi_boyutu: 14 }
        }

        pub fn ozet(&self) -> String {
            format!("{} / {} / {} pt", self.dil, self.tema, self.yazi_boyutu)
        }
    }
}

// Kullanıcının v1.0'a göre yazdığı kod v1.1'de de aynen derlenir:
fn main() {
    let a = ayar_kutuphanesi::Ayar::new("tr", "koyu");
    println!("{}", a.ozet());
}
```

Aynı tuzak enum'larda da var. Kullanıcı Modül 7'de öğrendiğin gibi `match` ile tüm varyantları ele
almışsa, senin eklediğin **yeni bir varyant** onun kodunda `E0004: non-exhaustive patterns` hatasına yol
açar. Gelecekte genişleyecek enum'lara `#[non_exhaustive]` eklersen, diğer crate'ler `match`'lerinde
her zaman bir `_` kolu yazmak zorunda kalır ve yeni varyant onları kırmaz. (Bu öznitelik kendi crate'inin
içinde hiçbir şeyi kısıtlamaz; yalnızca dışarıdaki kullanıcılara uygulanır.)

Bir öğeyi kaldırmak kırıcıdır; ama kullanıcılarına bir geçiş süresi tanıyabilirsin. `#[deprecated]`
özniteliği öğeyi kullanan herkese bir **uyarı** gösterir:

````compiles
question: "`#[deprecated]` ile işaretlenmiş bir fonksiyonu çağıran bu kod derlenir mi?"
code: |
  #[deprecated(since = "1.3.0", note = "yerine `buyut` kullan")]
  pub fn buyuk_harf(metin: &str) -> String {
      buyut(metin)
  }

  pub fn buyut(metin: &str) -> String {
      metin.to_uppercase()
  }

  fn main() {
      println!("{}", buyuk_harf("rust"));
  }
answer: true
explanation: |
  Derlenir; `deprecated` bir **uyarıdır**, hata değil. Derleyici şunu yazar:

  ```text
  warning: use of deprecated function `buyuk_harf`: yerine `buyut` kullan
    --> src/main.rs:11:20
     |
  11 |     println!("{}", buyuk_harf("rust"));
     |                    ^^^^^^^^^^
  ```

  Tipik akış şöyledir: `1.3.0`'da yeni adı ekle ve eskisini `deprecated` yap (küçük sürüm, kimse
  kırılmaz). Kullanıcılar uyarıyı görüp kodlarını günceller. Eski adı ancak bir sonraki **büyük**
  sürümde (`2.0.0`) tamamen kaldır.
````

```quiz
question: "Kütüphanen `1.4.2` sürümünde. Aşağıdaki değişikliklerden hangileri **büyük sürüm** (`2.0.0`) gerektirir? (Birden çok doğru cevap var.)"
options:
  - "Yeni bir `pub fn harf_say` eklemek"
  - "`pub fn buyut(metin: &str) -> String` imzasını `pub fn buyut(metin: String) -> String` yapmak"
  - "`#[non_exhaustive]` olmayan genel bir enum'a yeni bir varyant eklemek"
  - Bir fonksiyonun içindeki bir hatayı, imzasına dokunmadan düzeltmek
  - "Bir trait'e varsayılan gövdesi **olmayan** yeni bir metot eklemek"
answer: [1, 2, 4]
explanation: |
  İmza değişikliği her çağıranı kırar; yeni varyant tüm varyantları ele alan `match`'leri kırar; gövdesiz
  yeni bir trait metodu ise o trait'i kendi tipleri için uygulamış (`impl`) herkesi kırar (Modül 11),
  çünkü artık eksik bir metotları vardır. Yeni bir fonksiyon eklemek **küçük** (`1.5.0`), bir hatayı
  düzeltmek ise **yama** (`1.4.3`) sürümüdür. Kırıcı değişiklikleri yakalamak için gerçek projeler
  yayından önce `cargo-semver-checks` aracını çalıştırır.
feedback:
  - Geriye uyumlu bir yenilik; küçük sürüm (`1.5.0`) yeter.
  - "Doğru: `&str` geçen her çağıran kırılır."
  - "Doğru: kullanıcının `match`'i artık `E0004` verir."
  - Bu bir yama sürümüdür (`1.4.3`).
  - "Doğru: trait'i uygulayan her `impl` eksik metot hatası alır."
```

```exercise
id: m16-e-semver
title: Sürüm hesaplayıcı
difficulty: 3
prompt: |
  Cargo'nun sürüm kurallarını kodla ifade et.

  1. `Surum` için `Display` uygula: `1.10.0` biçiminde yazılsın (Modül 11).
  2. `sonraki_surum(s, d)`: Bir değişiklikten sonra yayınlanması gereken sürümü döndür.
     - `buyuk >= 1` ise: `Kirici` → `(b+1).0.0`, `YeniOzellik` → `b.(k+1).0`, `HataDuzeltme` → `b.k.(y+1)`
     - `buyuk == 0` ise: `Kirici` → `0.(k+1).0`; `YeniOzellik` ve `HataDuzeltme` → `0.k.(y+1)`
  3. `uyumlu_mu(gereksinim, aday)`: `Cargo.toml`'daki `"1.2.3"` (yani `^1.2.3`) gereksinimini `aday`
     sürümü karşılıyor mu?
     - Aday, gereksinimden **küçük olmamalı** ve
     - gereksinimin **sıfır olmayan ilk** basamağı (en soldaki) adayda aynı olmalı, solundakiler de:
       `^1.2.3` → `1.x.y`; `^0.2.3` → `0.2.y`; `^0.0.3` → yalnızca `0.0.3`.
starter: |
  use std::fmt;

  #[derive(Debug, Clone, Copy, PartialEq)]
  pub struct Surum {
      pub buyuk: u64,
      pub kucuk: u64,
      pub yama: u64,
  }

  #[derive(Debug, Clone, Copy)]
  pub enum Degisiklik {
      HataDuzeltme,
      YeniOzellik,
      Kirici,
  }

  impl fmt::Display for Surum {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  pub fn sonraki_surum(s: Surum, d: Degisiklik) -> Surum {
      todo!()
  }

  pub fn uyumlu_mu(gereksinim: Surum, aday: Surum) -> bool {
      todo!()
  }

  fn main() {
      let s = Surum { buyuk: 1, kucuk: 4, yama: 2 };
      println!("{s} → {}", sonraki_surum(s, Degisiklik::YeniOzellik));
  }
solution: |
  use std::fmt;

  #[derive(Debug, Clone, Copy, PartialEq)]
  pub struct Surum {
      pub buyuk: u64,
      pub kucuk: u64,
      pub yama: u64,
  }

  #[derive(Debug, Clone, Copy)]
  pub enum Degisiklik {
      HataDuzeltme,
      YeniOzellik,
      Kirici,
  }

  impl fmt::Display for Surum {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}.{}.{}", self.buyuk, self.kucuk, self.yama)
      }
  }

  pub fn sonraki_surum(s: Surum, d: Degisiklik) -> Surum {
      let Surum { buyuk, kucuk, yama } = s;
      let (b, k, y) = match (buyuk, d) {
          (0, Degisiklik::Kirici) => (0, kucuk + 1, 0),
          (0, _) => (0, kucuk, yama + 1),
          (_, Degisiklik::Kirici) => (buyuk + 1, 0, 0),
          (_, Degisiklik::YeniOzellik) => (buyuk, kucuk + 1, 0),
          (_, Degisiklik::HataDuzeltme) => (buyuk, kucuk, yama + 1),
      };
      Surum { buyuk: b, kucuk: k, yama: y }
  }

  pub fn uyumlu_mu(gereksinim: Surum, aday: Surum) -> bool {
      let g = (gereksinim.buyuk, gereksinim.kucuk, gereksinim.yama);
      let a = (aday.buyuk, aday.kucuk, aday.yama);
      if a < g {
          return false;
      }
      if g.0 > 0 {
          a.0 == g.0
      } else if g.1 > 0 {
          a.0 == 0 && a.1 == g.1
      } else {
          a == g
      }
  }

  fn main() {
      let s = Surum { buyuk: 1, kucuk: 4, yama: 2 };
      println!("{s} → {}", sonraki_surum(s, Degisiklik::YeniOzellik));
  }
check: tests
tests: |
  fn v(buyuk: u64, kucuk: u64, yama: u64) -> Surum {
      Surum { buyuk, kucuk, yama }
  }

  #[test]
  fn surum_yazdirilir() {
      assert_eq!(v(1, 10, 0).to_string(), "1.10.0");
      assert_eq!(format!("v{}", v(0, 3, 7)), "v0.3.7");
  }

  #[test]
  fn kararli_surumde_artis() {
      assert_eq!(sonraki_surum(v(1, 4, 2), Degisiklik::HataDuzeltme), v(1, 4, 3), "yama: sadece son basamak artar");
      assert_eq!(sonraki_surum(v(1, 4, 2), Degisiklik::YeniOzellik), v(1, 5, 0), "küçük sürümde yama 0'a döner");
      assert_eq!(sonraki_surum(v(1, 4, 2), Degisiklik::Kirici), v(2, 0, 0), "büyük sürümde diğerleri 0'a döner");
  }

  #[test]
  fn sifir_surumunde_artis() {
      assert_eq!(sonraki_surum(v(0, 3, 7), Degisiklik::Kirici), v(0, 4, 0), "0.y.z'de kırıcı değişiklik y'yi artırır");
      assert_eq!(sonraki_surum(v(0, 3, 7), Degisiklik::YeniOzellik), v(0, 3, 8), "0.y.z'de yeni özellik z'yi artırır");
      assert_eq!(sonraki_surum(v(0, 3, 7), Degisiklik::HataDuzeltme), v(0, 3, 8));
  }

  #[test]
  fn caret_uyumlulugu() {
      assert!(uyumlu_mu(v(1, 2, 3), v(1, 2, 3)), "aynı sürüm uyumludur");
      assert!(uyumlu_mu(v(1, 2, 3), v(1, 9, 0)), "^1.2.3, 1.9.0'ı kabul eder");
      assert!(!uyumlu_mu(v(1, 2, 3), v(2, 0, 0)), "^1.2.3, 2.0.0'ı kabul etmez");
      assert!(!uyumlu_mu(v(1, 2, 3), v(1, 2, 2)), "gereksinimden eski sürüm kabul edilmez");
      assert!(!uyumlu_mu(v(1, 2, 3), v(1, 1, 9)), "1.1.9 < 1.2.3");
  }

  #[test]
  fn sifirli_caret_uyumlulugu() {
      assert!(uyumlu_mu(v(0, 2, 3), v(0, 2, 9)), "^0.2.3, 0.2.9'u kabul eder");
      assert!(!uyumlu_mu(v(0, 2, 3), v(0, 3, 0)), "^0.2.3, 0.3.0'ı kabul etmez");
      assert!(uyumlu_mu(v(0, 0, 3), v(0, 0, 3)));
      assert!(!uyumlu_mu(v(0, 0, 3), v(0, 0, 4)), "^0.0.3 yalnızca 0.0.3'tür");
  }
hints:
  - "`Display` için `write!(f, \"{}.{}.{}\", ...)` yeterli. `sonraki_surum`'da `match (s.buyuk, d)` ile hem sıfır durumunu hem değişikliği aynı anda eşleştirebilirsin."
  - "Kol sırası önemli: `(0, Degisiklik::Kirici)` kolu `(0, _)` kolundan **önce** gelmeli. Yeni özellik ve büyük sürümde sağdaki basamakları 0'a çekmeyi unutma."
  - "`uyumlu_mu`'da sürümleri `(buyuk, kucuk, yama)` tuple'larına çevir: tuple'lar soldan sağa karşılaştırılır, yani `a < g` tam istediğin sıralamadır. Sonra `g.0 > 0`, `g.1 > 0` ve geri kalan durumu ayrı ayrı ele al."
explanation: |
  `match (buyuk, d)` iki bilgiyi tek bir desende birleştirir; derleyici de tüm olasılıkları ele alıp
  almadığını kontrol eder (Modül 7). `(0, _)` kolunun `(0, Degisiklik::Kirici)`'den sonra gelmesi
  zorunludur, yoksa kırıcı değişiklik de yama artışına düşerdi.

  `uyumlu_mu`'da tuple karşılaştırması (`a < g`) **sözlük sırası** kullanır: önce büyük, eşitse küçük,
  o da eşitse yama basamağı karşılaştırılır. Gerçek Cargo bu kuralları `semver` crate'iyle uygular;
  `semver::VersionReq::parse("1.2.3")?.matches(&surum)` tam olarak senin yazdığın şeyi yapar.

  Bu kural neden önemli? `0.y.z` sürümlerinde `y`'nin artması "her şey değişebilir" demektir. Bu yüzden
  Cargo `^0.2.3` gereksinimini **0.3.0'a hiç yükseltmez**. Ekosistemde pek çok popüler crate'in yıllarca
  `0.x`'te kalmasının nedeni de budur: `1.0` demek, kırıcı değişikliklerde çok daha dikkatli olacağına
  söz vermektir.
```

## Özet

:::remember
- Yayından önce: `//!` ile crate girişi, her genel öğede `///` ve `# Examples` (doc test olarak çalışır); `#![deny(missing_docs)]` eksikleri yakalar.
- `pub use` ile genel API'yi iç modül düzeninden bağımsız bir "vitrine" koy.
- `description` ve `license` (ya da `license-file`) **zorunlu**; `repository`, `readme`, `keywords` (≤ 5), `categories`, `rust-version` önerilir.
- Akış: `cargo login` → `cargo package --list` → `cargo publish --dry-run` → `cargo publish`.
- Yayın **kalıcıdır**; sürüm numarası asla yeniden kullanılmaz. `cargo yank` yalnızca yeni çözümlemelerde seçilmeyi engeller, silmez.
- Semver: hata düzeltmesi → yama, geriye uyumlu yenilik → küçük, kırıcı → büyük (`0.y.z`'de kırıcı → `y`). Yeni alan/varyant da kırıcı olabilir: `#[non_exhaustive]` ve `#[deprecated]` ile önlem al.
:::

```reflect
prompt: |
  crates.io neden yayınlanmış bir sürümün silinmesine ya da üzerine yazılmasına (neredeyse hiç) izin
  vermiyor? Bunun yerine sunduğu `yank` hangi sorunu çözüyor, hangisini çözmüyor?
answer: |
  Model cevap: Binlerce projenin `Cargo.lock`'u tam bir sürüme işaret ediyor olabilir. Sürüm silinse ya
  da içeriği değişse, aynı kilit dosyasıyla yapılan derleme dün başka bugün başka sonuç verir ya da hiç
  çalışmaz; tekrarlanabilir derleme fikri çöker. `yank`, hatalı bir sürümün **yeni** projelere
  bulaşmasını engeller ama var olan kilit dosyalarını bozmaz. Çözmediği şey ise içeriğin kendisidir:
  arşiv hâlâ indirilebilir, bu yüzden sızan bir şifre ya da anahtar mutlaka iptal edilip yenilenmelidir.
```

```flashcards
- front: crates.io'ya yayın için `Cargo.toml`'da zorunlu iki alan?
  back: "`description` ve `license` (ya da `license-file`)."
- front: "`cargo publish --dry-run` ne yapar?"
  back: Paketler ve paketi sıfırdan derleyerek doğrular, ama crates.io'ya **yüklemez**.
- front: "`cargo yank turkce-harf@0.1.1` sürümü siler mi?"
  back: "Hayır. Yeni çözümlemelerde seçilmez; `Cargo.lock`'unda o sürüm olan projeler derlenmeye devam eder."
- front: Yayınlanmış `0.1.0`'da hata buldun. Aynı numarayla düzeltilmiş kodu yükleyebilir misin?
  back: "Hayır; sürüm numaraları kalıcıdır. Düzeltmeyi `0.1.1` olarak yayınlarsın."
- front: "`1.4.2` sürümünde geriye uyumlu yeni bir `pub fn` eklendi. Sıradaki sürüm?"
  back: "`1.5.0` (küçük sürüm; yama 0'a döner)."
- front: "`0.3.7` sürümünde kırıcı bir değişiklik yaptın. Sıradaki sürüm?"
  back: "`0.4.0` — `0.y.z`'de kırıcı değişiklik `y`'yi artırır."
- front: "Bütün alanları `pub` olan bir struct'a yeni alan eklemek neden kırıcıdır?"
  back: "Kullanıcıların struct ifadeleri eksik alan hatası (`E0063`) verir. Önlem: gizli alanlar + kurucu ya da `#[non_exhaustive]`."
- front: "`#[deprecated(since, note)]` kullanan kodu derlemek hata mı verir?"
  back: Hayır, yalnızca uyarı verir. Kaldırmadan önce kullanıcılara geçiş süresi tanımanın aracıdır.
```
