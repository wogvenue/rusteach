---
id: m16-boss
title: "Boss: Atölyenin Ustabaşı"
minutes: 40
type: boss
keywords: [profile, opt-level, overflow-checks, crates.io, semver, yank, pub use, workspace, features, cfg, lint, forbid, must_use, edition, MSRV]
---

Atölyenin kapısında ustabaşı bekliyor. Elinde bir `Cargo.toml`, belinde bir alet kemeri: profiller,
yayın kuralları, workspace'ler, özellikler, lint'ler ve edition'lar. İçeri girip kendi projeni
yönetebilmek için ona Cargo'yu yalnızca "çalıştır" düğmesi olarak değil, bir **araç zinciri** olarak
kullanabildiğini göstermelisin. Geçme notu **%80**. Arada önceki modüllerden de sorular var: tamsayı
taşması, modül görünürlüğü ve `Result` hâlâ her yerde!

## Profiller ve yayın

````quiz
question: |
  Aşağıdaki kod `cargo build --release` ile, `Cargo.toml`'da hiçbir profil ayarı **yapılmadan** derlenip
  çalıştırılıyor. Ne olur?

  ```rust
  let koltuk: u8 = std::hint::black_box(255);
  let yeni = koltuk + 1;
  println!("{yeni}");
  ```
options:
  - "`attempt to add with overflow` mesajıyla panik olur"
  - "`0` yazdırır; release'te `overflow-checks` kapalıdır ve değer başa sarar"
  - "`256` yazdırır; release derleyicisi tipi otomatik olarak `u16`'ya büyütür"
  - "Sonuç tanımsızdır (undefined behavior); her çalıştırmada farklı olabilir"
answer: 1
explanation: |
  `release` profilinde `overflow-checks = false` varsayılandır: düz `+` taşınca **iyi tanımlanmış
  biçimde** başa sarar (255 + 1 → 0). Aynı kod `dev` profilinde panikler. Rust'ta taşma asla tanımsız
  davranış değildir; ama iki profilin farklı davranması, taşmanın mümkün olduğu yerlerde niyetini
  `checked_*`, `wrapping_*` ya da `saturating_*` ile açıkça yazman gerektiği anlamına gelir.
feedback:
  - Bu `dev` profilinin davranışı; release'te taşma kontrolü varsayılan olarak kapalıdır.
  - Doğru!
  - Rust tipleri asla kendiliğinden büyütmez; `u8` her profilde `u8`'dir.
  - C'deki işaretli taşmanın aksine Rust'ta taşma her zaman tanımlıdır.
````

```predict
question: Bu program (her profilde aynı) ne yazdırır?
code: |
  fn main() {
      let stok: u32 = 3;
      println!("{}", stok.saturating_sub(5));
      println!("{:?}", stok.checked_sub(5));
      println!("{}", stok.wrapping_sub(5));
  }
options:
  - |
    0
    None
    4294967294
  - |
    -2
    None
    0
  - |
    0
    Some(0)
    4294967294
  - |
    0
    None
    0
answer: 0
explanation: |
  `u32` negatif olamaz (Modül 2). `saturating_sub` alt sınırda durur: `0`. `checked_sub` taşmayı
  `None` ile bildirir. `wrapping_sub` ise başa sarar: 3 − 5 = −2, yani 2³² − 2 = `4294967294`.
  Üçü de niyetini açıkça söylediğin için `dev` ve `release`'te **aynı** sonucu verir.
```

````quiz
question: |
  `turkce-harf` crate'inin `1.4.2` sürümünde şu genel tip var (`#[non_exhaustive]` **yok**):

  ```rust
  pub enum HarfTuru {
      Sesli,
      Sessiz,
  }
  ```

  Bir sonraki sürümde `Yumusak` adlı yeni bir varyant ekliyorsun. Semver'e göre sürüm ne olmalı?
options:
  - "`1.4.3`, çünkü mevcut hiçbir fonksiyon değişmedi"
  - "`1.5.0`, çünkü bu geriye uyumlu yeni bir özellik"
  - "`2.0.0`, çünkü kullanıcıların `match`'leri artık eksik kalır ve derlenmez"
  - "Sürüm değiştirmeye gerek yok; enum'lar semver kapsamında değil"
answer: 2
explanation: |
  Kullanıcılar `HarfTuru` üzerinde **tüm varyantları** kapsayan `match`'ler yazmış olabilir (Modül 7).
  Yeni bir varyant geldiğinde bu `match`'ler `E0004: non-exhaustive patterns` ile derlenmez. Yani bu
  kırıcı bir değişikliktir → büyük sürüm. Baştan `#[non_exhaustive]` koysaydın kullanıcılar `_ =>` kolu
  yazmak zorunda kalırdı ve yeni varyant küçük sürümde (`1.5.0`) eklenebilirdi.
feedback:
  - Yama sürümü yalnızca API'yi değiştirmeyen hata düzeltmeleri içindir.
  - Masum görünüyor ama kapsamlı `match` yazan herkesin kodunu kırar.
  - Doğru!
  - Genel API'deki her öğe semver sözünün parçasıdır.
````

````compiles
question: "`pub use` ile hazırlanan bu \"vitrin\" derlenir mi?"
code: |
  mod kasa {
      pub mod hesap {
          pub fn kdv_ekle(fiyat: u32) -> u32 {
              fiyat * 120 / 100
          }
      }

      mod gizli {
          pub fn iskonto(fiyat: u32) -> u32 {
              fiyat * 90 / 100
          }
      }
  }

  pub use kasa::hesap::kdv_ekle;
  pub use kasa::gizli::iskonto;

  fn main() {
      println!("{}", iskonto(kdv_ekle(1000)));
  }
answer: false
error: E0603
explanation: |
  `iskonto` fonksiyonu `pub` olsa da onu içeren `gizli` modülü `pub` **değil**. Bir yolun her halkası
  görünür olmalıdır (Modül 8):

  ```text
  error[E0603]: module `gizli` is private
  ```

  `pub use` bir öğeyi vitrine taşır, ama göremediğin bir öğeyi görünür yapamaz. Çözüm `pub mod gizli`
  (ya da `pub(crate) mod gizli` ve `pub use` yerine `pub(crate) use`) yazmaktır.
````

```quiz
question: |
  `kahve-kasa 0.2.0`'ı yayınladın; bir saat sonra fiyatları yanlış yuvarlayan ciddi bir hata buldun ve
  `cargo yank kahve-kasa@0.2.0` çalıştırdın. Hangisi **doğrudur**?
options:
  - "`0.2.0` crates.io'dan silindi; düzeltilmiş kodu yine `0.2.0` numarasıyla yayınlayabilirsin"
  - "`0.2.0` yeni çözümlemelerde seçilmez ama silinmez; `Cargo.lock`'unda `0.2.0` kilitli projeler derlenmeye devam eder; düzeltmeyi `0.2.1` olarak yayınlarsın"
  - "`Cargo.lock`'unda `0.2.0` olan tüm projeler bir sonraki derlemede hata alır"
  - "Yank edilen sürümü kullanan projeler `cargo build` sırasında otomatik olarak `0.1.x`'e düşürülür"
answer: 1
explanation: |
  Yayın **kalıcıdır**: hiçbir sürüm numarası iki kez kullanılamaz, yank edilmiş olsa bile. Yank yalnızca
  "yeni projeler bunu seçmesin" demektir; var olan kilit dosyaları bozulmaz, böylece tekrarlanabilir
  derleme sözü korunur. Doğru yol düzeltmeyi bir yama sürümü (`0.2.1`) olarak yayınlamaktır.
feedback:
  - Yank silmez ve aynı numara bir daha asla kullanılamaz.
  - Doğru!
  - Tam tersi; yank var olan kilit dosyalarını bozmamak için tasarlandı.
  - Cargo kilitli bir sürümü kendiliğinden değiştirmez; hele bir küçük sürüm geriye hiç.
```

## Workspace ve features

```quiz
question: |
  `kahve` workspace'inde `kahve-web`, `kahve-cekirdek`'e `path` bağımlılığıyla bağlı. `kahve-cekirdek`'teki
  bir fonksiyonu değiştirip workspace kökünde `cargo test -p kahve-web` çalıştırıyorsun. Ne olur?
options:
  - "Değişiklik görülmez; `path` bağımlılığı crates.io'daki son yayınlanmış sürümü kullanır"
  - "`kahve-cekirdek` yeniden derlenir, `kahve-web` onunla birlikte derlenir ve yalnızca `kahve-web`'in testleri çalışır"
  - "Workspace'teki tüm üyelerin testleri çalışır, çünkü komut kökte çalıştırıldı"
  - "Hata alırsın; `path` bağımlılıkları önce `cargo publish` ile yayınlanmalıdır"
answer: 1
explanation: |
  `path` bağımlılığı diskteki **güncel kaynağı** kullanır; değişen çekirdek yeniden derlenir ve onu
  kullanan `kahve-web` de onunla birlikte derlenir. `-p kahve-web` testleri yalnızca o üyeyle sınırlar.
  Tüm üyelerin testleri için `cargo test --workspace` yazardın. Ortak `target/` sayesinde değişmeyen
  bağımlılıklar yeniden derlenmez.
feedback:
  - "`path` bağımlılığı yereldeki kaynağı okur; yayınlanmış sürüme ancak `version` ile ve yayın sırasında bakılır."
  - Doğru!
  - "Kökte çalıştırmak tek başına \"hepsi\" demek değildir; `-p` hedefi açıkça seçer."
  - "`path` bağımlılıkları yayın gerektirmez; workspace'lerin varlık sebebi tam olarak bu."
```

````quiz
question: |
  Workspace kökündeki `Cargo.toml`'da şu tablo var:

  ```toml
  [workspace.dependencies]
  serde = { version = "1.0", features = ["derive"] }
  ```

  `kahve-web` üyesinin `serde`'yi bu ortak tanımdan kullanması için kendi `[dependencies]` tablosuna ne
  yazabilirsin? (Birden fazla doğru cevap olabilir.)
options:
  - "`serde = { workspace = true }`"
  - "`serde.workspace = true`"
  - "Hiçbir şey; `[workspace.dependencies]`'teki her crate tüm üyelere otomatik eklenir"
  - "`serde = \"workspace\"`"
answer: [0, 1]
explanation: |
  `[workspace.dependencies]` bir **katalogdur**, otomatik ekleme yapmaz: her üye hangi bağımlılığı
  istediğini kendisi söyler, ama sürümü ve özellikleri tek yerden miras alır. `serde = { workspace = true }`
  ile `serde.workspace = true` TOML'da **aynı** şeyin iki yazımıdır (satır içi tablo ve noktalı anahtar).
  `"workspace"` ise bir sürüm gereksinimi olarak okunur ve geçersizdir.
feedback:
  - Doğru, satır içi tablo yazımı.
  - Doğru, noktalı anahtar yazımı; anlamı birincisiyle aynı.
  - Katalog yalnızca bir tanımdır; üye istemedikçe bağımlılık eklenmez.
  - Bu bir sürüm metni olarak okunur ve geçerli bir sürüm gereksinimi değildir.
````

````compiles
question: "Özellik (feature) açılmadan, düz `cargo run` ile derlenen bu program derlenir mi?"
code: |
  #![allow(unexpected_cfgs)]

  #[cfg(feature = "json")]
  fn json_yaz(adet: u32) -> String {
      format!("{{\"adet\": {adet}}}")
  }

  fn main() {
      println!("{}", json_yaz(3));
  }
answer: false
error: E0425
explanation: |
  `json` özelliği kapalıyken `#[cfg(feature = "json")]` işaretli fonksiyon koddan **tamamen silinir**.
  `main` onu koşulsuz çağırdığı için derleyici fonksiyonu bulamaz:

  ```text
  error[E0425]: cannot find function `json_yaz` in this scope
   --> src/main.rs:9:20
    |
  9 |     println!("{}", json_yaz(3));
    |                    ^^^^^^^^ not found in this scope
    |
  note: found an item that was configured out
   --> src/main.rs:4:4
    |
  3 | #[cfg(feature = "json")]
    |       ---------------- the item is gated behind the `json` feature
  4 | fn json_yaz(adet: u32) -> String {
    |    ^^^^^^^^
  ```

  Derleyicinin notu çok yardımcıdır: fonksiyon **var**, ama `json` özelliğinin arkasında olduğu için
  derlemeye girmedi. Çağıran kodu da `#[cfg(feature = "json")]` ile işaretlemen ya da
  özelliği kapalıyken çalışan bir alternatif tanımlaman gerekir.
````

```predict
question: "Bu program `cargo run` ile (dev profili, hiçbir özellik açılmadan) ne yazdırır?"
code: |
  #![allow(unexpected_cfgs)]

  #[cfg(feature = "renkli")]
  fn etiket() -> &'static str {
      "\x1b[32mTAMAM\x1b[0m"
  }

  #[cfg(not(feature = "renkli"))]
  fn etiket() -> &'static str {
      "TAMAM"
  }

  fn main() {
      println!("{}", etiket());
      println!("{}", cfg!(feature = "renkli"));
      println!("{}", cfg!(any(feature = "renkli", not(test))));
      println!("{}", cfg!(debug_assertions));
  }
options:
  - |
    TAMAM
    false
    true
    true
  - |
    TAMAM
    false
    false
    true
  - |
    TAMAM
    false
    true
    false
  - Derlenmez; `etiket` iki kez tanımlanmış
answer: 0
explanation: |
  İki `etiket` tanımından yalnızca biri derlemeye girer: özellik kapalı olduğu için `not(feature =
  "renkli")` olan. Aynı adın iki kez görünmesi bu yüzden çakışma değildir. `cfg!(feature = "renkli")`
  `false`; `any(...)` ise koşullardan **biri** doğruysa doğrudur: `cargo run` test derlemesi olmadığından
  `not(test)` doğrudur. `dev` profilinde `debug-assertions` açık olduğundan son satır `true`'dur
  (`--release` ile `false` olurdu).
```

```compiles
question: "Hiçbir özellik açılmadan derlenen bu program derlenir mi?"
code: |
  #![allow(unexpected_cfgs)]

  #[cfg(all(feature = "tek-thread", feature = "cok-thread"))]
  compile_error!("`tek-thread` ve `cok-thread` birlikte açılamaz");

  fn main() {
      println!("kasa açıldı");
  }
answer: true
explanation: |
  Derlenir. `compile_error!` yalnızca **derlemeye girdiğinde** hata üretir; onu saran `#[cfg(all(...))]`
  iki özellik birden açık olmadıkça yanlıştır, bu yüzden makro çağrısı koddan silinir. Bu kalıp, özellik
  birleştirmesi (feature unification) yüzünden birbirini dışlayan iki özelliğin aynı anda açılması
  durumunu yakalamanın standart yoludur: kombinasyon oluşursa derleme anlaşılır bir mesajla durur.
```

## Araç zinciri

````compiles
question: "`Result` dönen bir çağrının sonucu yok sayılıyor. Bu program derlenir mi?"
code: |
  #![deny(unused_must_use)]

  fn main() {
      "42".parse::<i32>();
      println!("stok sayısı okundu");
  }
answer: false
explanation: |
  `Result` tipi `#[must_use]` ile işaretlidir (Modül 10): sonucunu yok saymak normalde bir **uyarıdır**.
  Bu crate `#![deny(unused_must_use)]` ile o lint'i hataya çevirdiği için derleme durur:

  ```text
  error: unused `Result` that must be used
   --> src/main.rs:4:5
    |
  4 |     "42".parse::<i32>();
    |     ^^^^^^^^^^^^^^^^^^^
    |
    = note: this `Result` may be an `Err` variant, which should be handled
  note: the lint level is defined here
  ```

  Lint hatalarının bir `E` kodu yoktur; mesajın sonundaki "the lint level is defined here" notu hangi
  özniteliğin bu uyarıyı hataya çevirdiğini gösterir. Sonucu `match`, `?` ya da `let sayi = ...?;` ile
  ele almalısın; gerçekten bilerek atıyorsan `let _ = ...;` yazarsın.
````

```quiz
question: |
  Ekibin kod tabanını uyarısız tutmak istiyor: hiçbir uyarı `main` dalına girmesin. Ama yerelde
  geliştirirken yarım kalmış bir kodun uyarıları kimseyi durdurmasın. En iyi yaklaşım hangisi?
options:
  - "`src/main.rs`'in başına `#![deny(warnings)]` yazmak"
  - "CI'da `cargo clippy -- -D warnings` çalıştırmak; kaynak koda `deny(warnings)` yazmamak"
  - "`Cargo.toml`'da `[lints.rust]` altında `warnings = \"forbid\"` yazmak"
  - "Uyarıları her ay toplu olarak temizlemek"
answer: 1
explanation: |
  `-D warnings` bayrağı uyarıları **yalnızca CI'da** hataya çevirir: `main`'e uyarılı kod giremez, ama
  yerelde derleme durmaz. Kaynağa yazılan `#![deny(warnings)]` ise iki sorun yaratır: yerelde her küçük
  uyarı derlemeyi durdurur ve **yeni bir Rust sürümü** yeni bir lint eklediğinde, hiçbir şeyi
  değiştirmediğin kodun bir sabah derlenmez hâle gelir. `forbid` bunu daha da katılaştırır.
feedback:
  - Çalışır ama yerelde seni durdurur ve derleyici güncellemelerinde kodunu kırar.
  - Doğru!
  - Bu en katı ve en kırılgan seçenek; yerel geliştirmeyi de durdurur.
  - Elle ve gecikmeli denetim kuralı uygulamaz; uyarılar birikir.
```

```quiz
question: |
  Edition 2021'de yazılmış `eski-jenerator` kütüphanesinde `pub fn gen() -> u32` adlı bir fonksiyon var.
  Senin crate'in edition 2024'te. Bu fonksiyonu nasıl çağırırsın?
options:
  - "Çağıramazsın; ya senin crate'in 2021'e dönmeli ya da kütüphane güncellenmeli"
  - "`eski_jenerator::gen()` sorunsuz çalışır, çünkü fonksiyon 2021'de tanımlandı"
  - "`eski_jenerator::r#gen()` ile; `r#` öneki ayrılmış kelimeyi sıradan bir ad olarak kullanmanı sağlar"
  - "Cargo, bağımlılığı otomatik olarak edition 2024'e çevirip adı değiştirir"
answer: 2
explanation: |
  Edition crate başınadır: kütüphane kendi 2021 kurallarıyla derlenir ve orada `gen` sıradan bir addır.
  Ama **senin** kodun 2024 kurallarıyla ayrıştırılır ve orada `gen` ayrılmış bir anahtar kelimedir.
  Ham tanımlayıcı `r#gen` iki dünyayı birleştirir. İşte ekosistemin bölünmemesinin sırrı: hiçbir crate
  başkasının edition'ını beklemek zorunda değildir.
feedback:
  - Farklı edition'lardaki crate'ler birlikte çalışır; tasarımın amacı bu.
  - "Senin dosyan 2024 kurallarıyla ayrıştırılır; orada `gen` bir anahtar kelimedir."
  - Doğru!
  - Cargo bağımlılıkların kaynak kodunu değiştirmez; her crate kendi edition'ında kalır.
```

```fill
prompt: |
  Boşlukları doldur: (1) Bu crate'te hiçbir yerde `unsafe` kod olmasın ve **hiçbir modül** bu kuralı
  tek başına gevşetemesin. (2) `indirim_uygula`'nın sonucu yok sayılırsa derleyici uyarsın.
  (3) Test modülü yalnızca `cargo test` sırasında derlensin.
code: |
  #![___0(unsafe_code)]

  #[___1 = "indirimli fiyatı kullanmazsan indirim boşa gider"]
  fn indirim_uygula(fiyat: u32, yuzde: u32) -> u32 {
      fiyat * (100 - yuzde) / 100
  }

  fn main() {
      let fiyat = indirim_uygula(20000, 15);
      println!("{fiyat}");
  }

  #[cfg(___2)]
  mod testler {
      use super::*;

      #[test]
      fn yuzde_on_bes_indirim() {
          assert_eq!(indirim_uygula(20000, 15), 17000);
      }
  }
blanks:
  - ["forbid"]
  - ["must_use"]
  - ["test"]
output: "17000"
explanation: |
  `deny(unsafe_code)` de hata verirdi, ama içerideki bir `#[allow(unsafe_code)]` onu gevşetebilirdi.
  "Hiç kimse açamasın" şartı `forbid` ister (gevşetme denemesi `E0453` verir). `#[must_use = "..."]`
  sonucun yok sayılmasını `unused_must_use` lint'inin konusu yapar ve mesajı uyarıya ekler.
  `#[cfg(test)]` ise Modül 13'ten tanıdık: test modülü normal derlemede koddan silinir.
```

## Son sınav: üç görev

````exercise
id: m16-boss-e-fis
title: Her profilde aynı fiş
difficulty: 2
prompt: |
  Kasa yazılımın testlerde (dev profili) doğru çalışıyor; ama release'te çok büyük bir toptan siparişte
  taşma sessizce **yanlış** bir tutar üretti. Hesabı, taşmayı her profilde aynı biçimde yakalayacak
  şekilde yaz. Tutarlar kuruş cinsinden `u32`.

  1. `fis_toplami(kalemler)`: Her kalem `(adet, birim_fiyat)` çiftidir. Tüm `adet × birim_fiyat`
     tutarlarının toplamını `Some` içinde döndür. Herhangi bir **çarpma ya da toplama** taşarsa `None`.
     Boş fiş → `Some(0)`.
  2. `odenecek(kalemler, kdv_orani)`: `toplam × (100 + kdv_orani) / 100`. Hesap sırası tam olarak budur:
     önce çarp, sonra böl. `fis_toplami` `None` ise ya da `100 + kdv_orani` veya **ara çarpım** taşarsa
     `None`.
  3. `fis_toplami`'yi `#[must_use]` ile işaretle: `Option` tipi kendiliğinden `must_use` değildir,
     sonucu unutulan bir fiş hesabı da bir hatadır.
starter: |
  pub fn fis_toplami(kalemler: &[(u32, u32)]) -> Option<u32> {
      todo!()
  }

  pub fn odenecek(kalemler: &[(u32, u32)], kdv_orani: u32) -> Option<u32> {
      todo!()
  }

  fn main() {
      let sepet = [(2, 4500), (1, 12000)];
      match odenecek(&sepet, 20) {
          Some(tutar) => println!("Ödenecek: {tutar} kuruş"),
          None => println!("Tutar u32 sınırını aştı!"),
      }
  }
solution: |
  #[must_use = "fiş toplamını kullanmazsan hesap boşa gider"]
  pub fn fis_toplami(kalemler: &[(u32, u32)]) -> Option<u32> {
      let mut toplam: u32 = 0;
      for &(adet, birim_fiyat) in kalemler {
          let tutar = adet.checked_mul(birim_fiyat)?;
          toplam = toplam.checked_add(tutar)?;
      }
      Some(toplam)
  }

  pub fn odenecek(kalemler: &[(u32, u32)], kdv_orani: u32) -> Option<u32> {
      let toplam = fis_toplami(kalemler)?;
      let carpan = 100u32.checked_add(kdv_orani)?;
      let ara_carpim = toplam.checked_mul(carpan)?;
      Some(ara_carpim / 100)
  }

  fn main() {
      let sepet = [(2, 4500), (1, 12000)];
      match odenecek(&sepet, 20) {
          Some(tutar) => println!("Ödenecek: {tutar} kuruş"),
          None => println!("Tutar u32 sınırını aştı!"),
      }
  }
check: tests
tests: |
  #[test]
  fn normal_fis_dogru_hesaplanir() {
      assert_eq!(fis_toplami(&[(2, 4500), (1, 12000)]), Some(21000), "2 × 4500 + 12000 = 21000");
      assert_eq!(odenecek(&[(2, 4500), (1, 12000)], 20), Some(25200), "21000 + %20 KDV = 25200");
      assert_eq!(odenecek(&[(3, 1000)], 10), Some(3300), "3000 + %10 KDV = 3300");
  }

  #[test]
  fn bos_fis_sifirdir() {
      assert_eq!(fis_toplami(&[]), Some(0), "boş fişin toplamı 0'dır, None değil");
      assert_eq!(odenecek(&[], 20), Some(0), "boş fişte ödenecek tutar 0'dır");
  }

  #[test]
  fn carpma_ve_toplama_tasmasi_yakalanir() {
      assert_eq!(fis_toplami(&[(3, 2_000_000_000)]), None, "3 × 2 milyar u32'ye sığmaz (çarpma taşması)");
      assert_eq!(
          fis_toplami(&[(1, 4_000_000_000), (1, 400_000_000)]),
          None,
          "4,4 milyar u32'ye sığmaz (toplama taşması; sınır 4.294.967.295)"
      );
      assert_eq!(fis_toplami(&[(1, u32::MAX)]), Some(u32::MAX), "tam sınırdaki değer hâlâ geçerlidir");
  }

  #[test]
  fn kdv_hesabindaki_tasmalar_yakalanir() {
      assert_eq!(
          odenecek(&[(1, 40_000_000)], 20),
          None,
          "40 milyon × 120 ara çarpımı u32'yi aşar; önce çarp, sonra böl kuralı gereği None"
      );
      assert_eq!(odenecek(&[(1, 100)], u32::MAX), None, "100 + kdv_orani da taşabilir");
  }
hints:
  - "`checked_mul` ve `checked_add` taşmada `None` döndürür. `?` operatörü `Option` döndüren bir fonksiyonda `None`'ı anında yukarı iletir (Modül 10)."
  - "`fis_toplami`'de `let mut toplam: u32 = 0;` ile başla; döngüde `let tutar = adet.checked_mul(birim_fiyat)?;` ve `toplam = toplam.checked_add(tutar)?;` yaz."
  - "`odenecek`'te: `let toplam = fis_toplami(kalemler)?;`, `let carpan = 100u32.checked_add(kdv_orani)?;`, `Some(toplam.checked_mul(carpan)? / 100)`. Fonksiyonun üstüne `#[must_use]` eklemeyi unutma."
require:
  - pattern: "#\\[must_use"
    message: "`fis_toplami`'yi `#[must_use]` ile işaretlemelisin."
forbid:
  - pattern: "wrapping_|saturating_"
    message: Bu görevde taşma bir hata; başa sarmak ya da sınırda durmak yanlış tutar üretir. `checked_*` kullan.
explanation: |
  `checked_*` ailesi taşmayı bir **değer** olarak (`None`) döndürdüğü için, sonucu profil ayarlarından
  bağımsızdır: `dev`'de panik, `release`'te sessiz başa sarma yerine her yerde aynı `None`. `?` ile
  birleşince her adım tek satırda "taşarsa vazgeç" der.

  `#[must_use]` neden önemli? `Result` zaten `must_use`'dur, ama `Option` değildir; `fis_toplami(&sepet);`
  yazıp sonucu unutan biri hiçbir uyarı almazdı. Şimdi `unused_must_use` lint'i onu uyarır.

  Alternatif: Hesabı `u64` ile yapıp en sonda `u32::try_from(...)` ile geri çevirmek, ara çarpım taşmasını
  önler ve `odenecek(&[(1, 40_000_000)], 20)` için `Some(48_000_000)` verirdi. Bu da meşru bir tasarımdır
  (hatta kullanıcı için daha iyidir), ama farklı bir sözleşmedir; bu görevin sözleşmesi "önce `u32`'de
  çarp, sonra böl" idi. Sözleşmeyi testler belirler.
````

````exercise
id: m16-boss-e-lint-hakemi
title: Lint seviyesi hakemi
difficulty: 3
prompt: |
  Derleyicinin bir lint için verdiği kararı taklit eden bir "hakem" yaz. Lint seviyeleri dıştan içe
  (crate → modül → fonksiyon) katman katman verilir.

  1. `etkin_seviye(varsayilan, katmanlar)`: Lint'in varsayılan seviyesiyle başla, katmanları sırayla
     uygula; her yeni katman öncekinin yerini alır (**en yakın kazanır**). Tek istisna `Forbid`:
     - Seviye `Forbid` iken gelen `Deny` ya da `Forbid` kabul edilir ama seviye `Forbid` **kalır**
       (bunlar kuralı gevşetmez).
     - Seviye `Forbid` iken gelen `Allow`, `Expect` ya da `Warn` bir çatışmadır (`E0453`) → `None`.
  2. `derleyici_ne_der(varsayilan, katmanlar, tetiklendi)`: `tetiklendi`, lint'in kodda gerçekten
     tetiklenip tetiklenmediğidir.
     - Çatışma (`None`) → `Hata`
     - `Allow` → `Sessiz`
     - `Expect` → tetiklendiyse `Sessiz`, tetiklenmediyse `Uyari` (karşılanmamış beklenti)
     - `Warn` → tetiklendiyse `Uyari`, değilse `Sessiz`
     - `Deny` / `Forbid` → tetiklendiyse `Hata`, değilse `Sessiz`
starter: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  pub enum Seviye {
      Allow,
      Expect,
      Warn,
      Deny,
      Forbid,
  }

  #[derive(Debug, PartialEq)]
  pub enum Sonuc {
      Sessiz,
      Uyari,
      Hata,
  }

  pub fn etkin_seviye(varsayilan: Seviye, katmanlar: &[Seviye]) -> Option<Seviye> {
      todo!()
  }

  pub fn derleyici_ne_der(varsayilan: Seviye, katmanlar: &[Seviye], tetiklendi: bool) -> Sonuc {
      todo!()
  }

  fn main() {
      // #![forbid(...)] altında #[allow(...)]: E0453
      let sonuc = derleyici_ne_der(Seviye::Warn, &[Seviye::Forbid, Seviye::Allow], false);
      println!("{sonuc:?}");
  }
solution: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  pub enum Seviye {
      Allow,
      Expect,
      Warn,
      Deny,
      Forbid,
  }

  #[derive(Debug, PartialEq)]
  pub enum Sonuc {
      Sessiz,
      Uyari,
      Hata,
  }

  pub fn etkin_seviye(varsayilan: Seviye, katmanlar: &[Seviye]) -> Option<Seviye> {
      let mut seviye = varsayilan;
      for &yeni in katmanlar {
          if seviye == Seviye::Forbid {
              match yeni {
                  Seviye::Deny | Seviye::Forbid => {} // gevşetmiyor: Forbid kalır
                  Seviye::Allow | Seviye::Expect | Seviye::Warn => return None, // E0453
              }
          } else {
              seviye = yeni;
          }
      }
      Some(seviye)
  }

  pub fn derleyici_ne_der(varsayilan: Seviye, katmanlar: &[Seviye], tetiklendi: bool) -> Sonuc {
      match etkin_seviye(varsayilan, katmanlar) {
          None => Sonuc::Hata,
          Some(Seviye::Allow) => Sonuc::Sessiz,
          Some(Seviye::Expect) => {
              if tetiklendi {
                  Sonuc::Sessiz
              } else {
                  Sonuc::Uyari
              }
          }
          Some(Seviye::Warn) => {
              if tetiklendi {
                  Sonuc::Uyari
              } else {
                  Sonuc::Sessiz
              }
          }
          Some(Seviye::Deny | Seviye::Forbid) => {
              if tetiklendi {
                  Sonuc::Hata
              } else {
                  Sonuc::Sessiz
              }
          }
      }
  }

  fn main() {
      // #![forbid(...)] altında #[allow(...)]: E0453
      let sonuc = derleyici_ne_der(Seviye::Warn, &[Seviye::Forbid, Seviye::Allow], false);
      println!("{sonuc:?}");
  }
check: tests
tests: |
  #[test]
  fn en_yakin_seviye_kazanir() {
      assert_eq!(etkin_seviye(Seviye::Warn, &[]), Some(Seviye::Warn), "katman yoksa varsayılan geçerlidir");
      assert_eq!(etkin_seviye(Seviye::Warn, &[Seviye::Deny, Seviye::Allow]), Some(Seviye::Allow), "içerideki allow, crate'teki deny'ı ezer");
      assert_eq!(etkin_seviye(Seviye::Allow, &[Seviye::Forbid]), Some(Seviye::Forbid));
  }

  #[test]
  fn forbid_gevsetilemez() {
      assert_eq!(etkin_seviye(Seviye::Warn, &[Seviye::Forbid, Seviye::Allow]), None, "forbid altında allow: E0453");
      assert_eq!(etkin_seviye(Seviye::Warn, &[Seviye::Forbid, Seviye::Expect]), None, "forbid altında expect: E0453");
      assert_eq!(etkin_seviye(Seviye::Warn, &[Seviye::Forbid, Seviye::Warn]), None, "forbid altında warn: E0453");
  }

  #[test]
  fn forbid_altinda_deny_forbidi_bozmaz() {
      assert_eq!(
          etkin_seviye(Seviye::Warn, &[Seviye::Forbid, Seviye::Deny]),
          Some(Seviye::Forbid),
          "deny kuralı gevşetmez ama seviye forbid olarak kalır"
      );
      assert_eq!(
          etkin_seviye(Seviye::Warn, &[Seviye::Forbid, Seviye::Deny, Seviye::Allow]),
          None,
          "araya giren deny, forbid'i ortadan kaldırmaz; sonraki allow yine E0453"
      );
  }

  #[test]
  fn derleyicinin_karari() {
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[], true), Sonuc::Uyari);
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[], false), Sonuc::Sessiz, "tetiklenmeyen lint sessizdir");
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[Seviye::Deny], true), Sonuc::Hata);
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[Seviye::Allow], true), Sonuc::Sessiz);
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[Seviye::Forbid], false), Sonuc::Sessiz);
  }

  #[test]
  fn expect_ve_catisma() {
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[Seviye::Expect], true), Sonuc::Sessiz, "beklenti karşılandı");
      assert_eq!(derleyici_ne_der(Seviye::Warn, &[Seviye::Expect], false), Sonuc::Uyari, "karşılanmamış beklenti uyarı verir");
      assert_eq!(
          derleyici_ne_der(Seviye::Warn, &[Seviye::Forbid, Seviye::Allow], false),
          Sonuc::Hata,
          "E0453 çatışması lint tetiklenmese de hatadır"
      );
  }
hints:
  - "`etkin_seviye`'de `let mut seviye = varsayilan;` ile başla ve `for &yeni in katmanlar` ile katmanları dolaş. İki durumu ayır: şu anki seviye `Forbid` mu, değil mi?"
  - "`Forbid` değilse `seviye = yeni;`. `Forbid` ise `match yeni { Seviye::Deny | Seviye::Forbid => {}, _ => return None }`: Deny/Forbid seviyeyi değiştirmez."
  - "`derleyici_ne_der`'de `match etkin_seviye(...)` yaz: `None => Sonuc::Hata`, `Some(Seviye::Allow) => Sonuc::Sessiz`, ... `Some(Seviye::Deny | Seviye::Forbid)` gibi bir or-deseni iki kolu birleştirir (Modül 7)."
explanation: |
  Bu hakem, derleyicinin gerçek davranışının küçük bir modelidir. Rustc'de `#![forbid(x)]` altında
  `#[deny(x)]` yazmak hata **vermez**: deny kuralı gevşetmez, bu yüzden derleyici onu sessizce kabul eder
  ve seviye forbid olarak kalır. Bu yüzden testteki `[Forbid, Deny, Allow]` zinciri yine `E0453` ile biter.
  Bir hata türü olarak `E0453`, lint tetiklensin ya da tetiklenmesin **özniteliğin kendisi** yüzünden
  oluşur; `derleyici_ne_der`'in ilk kolu bunu modeller.

  `Expect` en ilginç seviyedir: tetiklenmesi "iyi" (beklenti karşılandı, sessiz), tetiklenmemesi "kötü"dür
  (`unfulfilled_lint_expectations` uyarısı). `allow`'un unutulup kodda birikmesini önleyen şey tam olarak bu
  ters mantıktır.

  Tasarım notu: `Seviye`'yi `Copy` yapmak `for &yeni in katmanlar` ile değerleri doğrudan almayı sağlar.
  `match`'teki or-desenleri (`Seviye::Deny | Seviye::Forbid`) ve `Some(...)` içindeki iç içe desenler
  sayesinde her kural tek bir kolda okunur; `_` yerine tüm varyantları yazmak da, ileride yeni bir
  seviye eklenirse derleyicinin seni uyarmasını sağlar.
````

````exercise
id: m16-boss-e-yayin-denetcisi
title: Yayın öncesi denetçi
difficulty: 4
prompt: |
  `cargo publish` geri alınamaz bir adımdır; ekibin için yayından önce paketi denetleyen bir araç yaz.
  `yayin_denetle(paket, yayinlanmis)` bulduğu **tüm** sorunları aşağıdaki kural sırasıyla bir `Vec`
  içinde döndürür; sorun yoksa boş `Vec`. `yayinlanmis`, crates.io'da bu paket için daha önce yayınlanmış
  (yank edilmişler dahil) sürümlerdir.

  1. **Ad**: 1–64 karakter; ilk karakter bir ASCII harf; diğerleri ASCII harf, rakam, `-` ya da `_`.
     Değilse → `GecersizAd`.
  2. **Sürüm**: tam olarak `BÜYÜK.KÜÇÜK.YAMA`, üç parça da sayı (bu görevde `-beta` gibi ön sürüm
     etiketleri desteklenmiyor). Değilse → `BozukSurum`.
  3. **Açıklama**: yoksa ya da yalnızca boşluktan oluşuyorsa → `EksikAciklama`.
  4. **Lisans**: `lisans` ya da `lisans_dosyasi` alanlarından **en az biri** dolu olmalı (boşluktan ibaret
     olmayan). Değilse → `EksikLisans`.
  5. **Anahtar kelimeler**: en fazla 5. Fazlaysa → `CokFazlaAnahtarKelime(sayı)`.
  6. **Tekrar**: Sürüm geçerliyse ve `yayinlanmis` içinde aynı sürüm varsa → `SurumZatenYayinlanmis`.

  `surum_coz` yardımcı fonksiyonunu da yaz; 2. ve 6. kuralda ikisinde de kullanabilirsin.
starter: |
  pub struct Paket<'a> {
      pub ad: &'a str,
      pub surum: &'a str,
      pub aciklama: Option<&'a str>,
      pub lisans: Option<&'a str>,
      pub lisans_dosyasi: Option<&'a str>,
      pub anahtar_kelimeler: Vec<&'a str>,
  }

  #[derive(Debug, PartialEq)]
  pub enum Sorun {
      GecersizAd,
      BozukSurum,
      EksikAciklama,
      EksikLisans,
      CokFazlaAnahtarKelime(usize),
      SurumZatenYayinlanmis,
  }

  pub fn surum_coz(metin: &str) -> Option<(u64, u64, u64)> {
      todo!()
  }

  pub fn yayin_denetle(paket: &Paket<'_>, yayinlanmis: &[&str]) -> Vec<Sorun> {
      todo!()
  }

  fn main() {
      let paket = Paket {
          ad: "kahve-kasa",
          surum: "0.3.1",
          aciklama: Some("Kahve dükkânı için kasa hesapları"),
          lisans: None,
          lisans_dosyasi: None,
          anahtar_kelimeler: vec!["kahve", "kasa"],
      };
      println!("{:?}", yayin_denetle(&paket, &["0.3.0", "0.3.1"]));
  }
solution: |
  pub struct Paket<'a> {
      pub ad: &'a str,
      pub surum: &'a str,
      pub aciklama: Option<&'a str>,
      pub lisans: Option<&'a str>,
      pub lisans_dosyasi: Option<&'a str>,
      pub anahtar_kelimeler: Vec<&'a str>,
  }

  #[derive(Debug, PartialEq)]
  pub enum Sorun {
      GecersizAd,
      BozukSurum,
      EksikAciklama,
      EksikLisans,
      CokFazlaAnahtarKelime(usize),
      SurumZatenYayinlanmis,
  }

  pub fn surum_coz(metin: &str) -> Option<(u64, u64, u64)> {
      let parcalar: Vec<&str> = metin.split('.').collect();
      if parcalar.len() != 3 {
          return None;
      }
      let buyuk = parcalar[0].parse().ok()?;
      let kucuk = parcalar[1].parse().ok()?;
      let yama = parcalar[2].parse().ok()?;
      Some((buyuk, kucuk, yama))
  }

  fn ad_gecerli_mi(ad: &str) -> bool {
      let mut karakterler = ad.chars();
      let Some(ilk) = karakterler.next() else {
          return false; // boş ad
      };
      if !ilk.is_ascii_alphabetic() {
          return false;
      }
      ad.len() <= 64 && karakterler.all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
  }

  fn dolu_mu(alan: Option<&str>) -> bool {
      match alan {
          Some(metin) => !metin.trim().is_empty(),
          None => false,
      }
  }

  pub fn yayin_denetle(paket: &Paket<'_>, yayinlanmis: &[&str]) -> Vec<Sorun> {
      let mut sorunlar = Vec::new();

      if !ad_gecerli_mi(paket.ad) {
          sorunlar.push(Sorun::GecersizAd);
      }

      let surum = surum_coz(paket.surum);
      if surum.is_none() {
          sorunlar.push(Sorun::BozukSurum);
      }

      if !dolu_mu(paket.aciklama) {
          sorunlar.push(Sorun::EksikAciklama);
      }

      if !dolu_mu(paket.lisans) && !dolu_mu(paket.lisans_dosyasi) {
          sorunlar.push(Sorun::EksikLisans);
      }

      let kelime_sayisi = paket.anahtar_kelimeler.len();
      if kelime_sayisi > 5 {
          sorunlar.push(Sorun::CokFazlaAnahtarKelime(kelime_sayisi));
      }

      if let Some(yeni) = surum {
          if yayinlanmis.iter().any(|eski| surum_coz(eski) == Some(yeni)) {
              sorunlar.push(Sorun::SurumZatenYayinlanmis);
          }
      }

      sorunlar
  }

  fn main() {
      let paket = Paket {
          ad: "kahve-kasa",
          surum: "0.3.1",
          aciklama: Some("Kahve dükkânı için kasa hesapları"),
          lisans: None,
          lisans_dosyasi: None,
          anahtar_kelimeler: vec!["kahve", "kasa"],
      };
      println!("{:?}", yayin_denetle(&paket, &["0.3.0", "0.3.1"]));
  }
check: tests
tests: |
  fn ornek() -> Paket<'static> {
      Paket {
          ad: "kahve-kasa",
          surum: "0.3.1",
          aciklama: Some("Kahve dükkânı için kasa hesapları"),
          lisans: Some("MIT OR Apache-2.0"),
          lisans_dosyasi: None,
          anahtar_kelimeler: vec!["kahve", "kasa", "fis"],
      }
  }

  #[test]
  fn gecerli_paket_sorunsuzdur() {
      let sonuc = yayin_denetle(&ornek(), &["0.1.0", "0.3.0"]);
      assert!(sonuc.is_empty(), "geçerli paket için sorun beklenmiyordu, bulunan: {sonuc:?}");
      let mut p = ornek();
      p.anahtar_kelimeler = vec!["a", "b", "c", "d", "e"];
      let sonuc = yayin_denetle(&p, &[]);
      assert!(sonuc.is_empty(), "tam 5 anahtar kelime serbesttir, bulunan: {sonuc:?}");
  }

  #[test]
  fn surum_cozulur() {
      assert_eq!(surum_coz("0.3.1"), Some((0, 3, 1)));
      assert_eq!(surum_coz("12.0.40"), Some((12, 0, 40)));
      for kotu in ["1.2", "1.x.0", "1.2.3.4", "", "v1.0.0", "1.0.0-beta"] {
          assert_eq!(surum_coz(kotu), None, "\"{kotu}\" geçerli bir sürüm değil");
          let mut p = ornek();
          p.surum = kotu;
          assert_eq!(yayin_denetle(&p, &["1.2.0"]), vec![Sorun::BozukSurum], "\"{kotu}\" için yalnızca BozukSurum beklenir");
      }
  }

  #[test]
  fn ad_kurallari() {
      for kotu in ["", "1kahve", "-kahve", "kahve kasa", "kahve.kasa", "çay-ocagi"] {
          let mut p = ornek();
          p.ad = kotu;
          assert_eq!(yayin_denetle(&p, &[]), vec![Sorun::GecersizAd], "\"{kotu}\" geçersiz bir crate adı");
      }
      let sinirda = "a".repeat(64);
      let mut p = ornek();
      p.ad = &sinirda;
      assert!(yayin_denetle(&p, &[]).is_empty(), "64 karakterlik ad geçerlidir");
      let uzun = "a".repeat(65);
      p.ad = &uzun;
      assert_eq!(yayin_denetle(&p, &[]), vec![Sorun::GecersizAd], "65 karakterlik ad çok uzun");
  }

  #[test]
  fn eksik_meta_veriler() {
      let mut p = ornek();
      p.aciklama = None;
      p.lisans = None;
      p.lisans_dosyasi = Some("LISANS.txt");
      assert_eq!(yayin_denetle(&p, &[]), vec![Sorun::EksikAciklama], "license-file, license'ın yerine geçer");
      p.aciklama = Some("   ");
      p.lisans_dosyasi = Some("  ");
      assert_eq!(
          yayin_denetle(&p, &[]),
          vec![Sorun::EksikAciklama, Sorun::EksikLisans],
          "yalnızca boşluktan oluşan alanlar eksik sayılır"
      );
  }

  #[test]
  fn ayni_surum_ve_kural_sirasi() {
      assert_eq!(
          yayin_denetle(&ornek(), &["0.3.0", "0.3.1"]),
          vec![Sorun::SurumZatenYayinlanmis],
          "0.3.1 yank edilmiş olsa bile numarası tekrar kullanılamaz"
      );
      let mut p = ornek();
      p.lisans = None;
      p.anahtar_kelimeler = vec!["a", "b", "c", "d", "e", "f"];
      assert_eq!(
          yayin_denetle(&p, &["0.3.1"]),
          vec![Sorun::EksikLisans, Sorun::CokFazlaAnahtarKelime(6), Sorun::SurumZatenYayinlanmis],
          "tüm sorunlar kural sırasıyla listelenmeli"
      );
  }
hints:
  - "`surum_coz`: `split('.')` ile parçalara ayır, `collect` et ve önce `len() != 3` kontrolü yap. Her parçayı `parse().ok()?` ile çevir: hatalı parça anında `None` döndürür."
  - "Ad için: `ad.chars()`'tan ilk karakteri `next()` ile al (`let Some(ilk) = ... else { return false; };`) ve `is_ascii_alphabetic()` olup olmadığına bak; kalanlar için `all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')`. Uzunluk sınırını da unutma. Açıklama ve lisans için `Option<&str>` alıp 'dolu mu' diyen küçük bir yardımcı yaz."
  - "`let mut sorunlar = Vec::new();` ile başla ve kuralları **sırayla** `if` ile denetleyip `push` et. 6. kural için: `if let Some(yeni) = surum_coz(paket.surum)` ve `yayinlanmis.iter().any(|eski| surum_coz(eski) == Some(yeni))`."
explanation: |
  Bu denetçi, Ders 2'nin yayın kurallarını koda döker: `description` ve `license`/`license-file`
  zorunluluğu, en fazla 5 anahtar kelime, crates.io'nun ad kuralları ve en önemlisi **yayının kalıcılığı**:
  yank edilmiş bir sürümün numarası bile bir daha kullanılamaz.

  Tasarım kararları:

  - Sorunları ilk hatada durmak yerine bir `Vec`'te **toplamak**, kullanıcıya tek seferde tam bir liste
    verir (Cargo'nun kendisi de çoğu meta veri eksikliğini birlikte raporlar).
  - `surum_coz` iki yerde kullanılır; sürümleri metin olarak değil tuple olarak karşılaştırmak, ileride
    "en yüksek sürüm" gibi sorular için de hazır bir temel sağlar (tuple'lar soldan sağa sıralanır).
  - `dolu_mu`'daki `match`, `Option`'ın standart kütüphanedeki bir metoduyla tek satıra da inebilir:
    `alan.is_some_and(|metin| !metin.trim().is_empty())`, yani "değer varsa ve koşulu sağlıyorsa".
  - `ad.len()` bayt sayar; ama geçerli bir adda tüm karakterler ASCII olduğu için bayt sayısı karakter
    sayısına eşittir. `çay-ocagi` zaten ilk karakter kuralında elenir.

  Gerçek semver ayrıca `01` gibi baştaki sıfırları ve `-beta.1` gibi ön sürüm etiketlerini de
  düzenler; tam bir uygulama için ekosistemdeki `semver` crate'i kullanılır.
````
