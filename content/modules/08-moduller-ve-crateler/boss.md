---
id: m08-boss
title: "Boss: Modüller, Paketler ve Crate'ler"
minutes: 40
type: boss
keywords: [boss, paket, crate, modül, mod, pub, gizlilik, "crate::", "super::", use, "pub use", dosyalar, crates.io, rand, regex, semver, Cargo.lock, features]
---

Modül 8'in sonuna geldin! Bu sınavda paketleri ve crate'leri, modül ağacını, `pub` ve gizlilik
kurallarını, yolları, `use` ve `pub use`'u, modülleri dosyalara bölmeyi, dış crate'leri ve sürüm
yönetimini bir arada kullanacaksın. Arada önceki modüllerden de birkaç soru var. Geçmek için **%80**
gerekiyor.

:::tip Strateji
Her soruda önce **modül ağacını** kâğıda çiz: kök `crate`, altında modüller, en altta öğeler. Sonra iki
soru sor: "Bu öğe, çağrıldığı yerden **görünür mü**?" (gizlilik: içeriden dışarıya) ve "Bu yol, yazıldığı
modülden başlayarak **doğru yere çıkıyor mu**?" (yollar ve `use`).
:::

## Bölüm 1: Paket, crate ve gizlilik

```quiz
question: "Bir paketin içinde `Cargo.toml`, `src/lib.rs` ve `src/main.rs` var. Hangisi doğrudur?"
options:
  - "Paket tek bir crate'tir; `lib.rs` ile `main.rs` aynı modül ağacının iki dalıdır"
  - "İki crate vardır; `main.rs` kütüphaneyi paket adıyla (`paket_adi::...`) kullanır ve yalnızca `pub` öğelerini görür"
  - "İki crate vardır; `main.rs`'in kütüphaneyi kullanabilmesi için `mod lib;` yazması gerekir"
  - "Bir pakette hem `lib.rs` hem `main.rs` bulunamaz"
answer: 1
explanation: |
  `src/main.rs` bir binary crate'in, `src/lib.rs` ise library crate'in köküdür; bir paket ikisini birden
  taşıyabilir. İki ayrı crate oldukları için `main.rs` kütüphaneyi dışarıdan, paket adıyla kullanır ve
  gizlilik sınırları crate düzeyinde işlediğinden yalnızca `pub` öğeleri (ve vitrinden açılanları) görür.
feedback:
  - Her kök dosya ayrı bir crate'in köküdür; iki ayrı modül ağacı vardır.
  - Doğru!
  - "`mod lib;` yazmak `lib.rs`'i binary crate'in içinde **ikinci kez** derler ve iki ayrı tip kümesi oluşturur."
  - En fazla bir library crate ve istediğin kadar binary crate olabilir; bu düzen çok yaygındır.
```

```compiles
code: |
  mod eczane {
      pub mod stok {
          fn ilac_sayisi() -> u32 {
              42
          }

          pub fn rapor() -> String {
              format!("{} çeşit ilaç var", ilac_sayisi())
          }
      }
  }

  fn main() {
      println!("{}", eczane::stok::rapor());
      println!("{}", eczane::stok::ilac_sayisi());
  }
answer: false
error: E0603
explanation: |
  `eczane` kökte tanımlı olduğu için `main` onu görür; `stok` `pub`, `rapor` da `pub`. Ama
  `ilac_sayisi` gizlidir: yalnızca `stok` modülünün (ve alt modüllerinin) içinden çağrılabilir. `rapor`
  onu sorunsuz çağırır, `main` çağıramaz: **E0603 - function `ilac_sayisi` is private**. Gizlilik
  "içeriden dışarıya" işler: üst modüller alt modüllerin gizli öğelerini göremez.
```

```predict
code: |
  mod oyun {
      pub enum Sinif {
          Savasci,
          Buyucu,
      }

      pub struct Karakter {
          pub ad: String,
          pub sinif: Sinif,
          can: u32,
      }

      impl Karakter {
          pub fn yeni(ad: &str, sinif: Sinif) -> Karakter {
              let can = match sinif {
                  Sinif::Savasci => 150,
                  Sinif::Buyucu => 80,
              };
              Karakter { ad: String::from(ad), sinif, can }
          }

          pub fn hasar_al(&mut self, miktar: u32) {
              self.can = self.can.saturating_sub(miktar);
          }

          pub fn can(&self) -> u32 {
              self.can
          }
      }
  }

  use oyun::{Karakter, Sinif};

  fn main() {
      let mut a = Karakter::yeni("Alp", Sinif::Savasci);
      let mut b = Karakter::yeni("Ece", Sinif::Buyucu);
      a.hasar_al(60);
      b.hasar_al(100);
      println!("{}: {}", a.ad, a.can());
      println!("{}: {}", b.ad, b.can());
  }
options:
  - |
    Alp: 90
    Ece: 0
  - |
    Alp: 90
    Ece: -20
  - "Derlenmez: `can` alanı gizli ve dışarıdan kullanılıyor"
  - "Panikler: `80 - 100` taşma (overflow) verir"
answer: 0
explanation: |
  `can` alanı gizli ama `main` onu hiç doğrudan kullanmıyor: değeri kurucu `yeni` atıyor, okumayı da
  aynı adlı `can()` metodu yapıyor (alan ile metot aynı adı taşıyabilir). `pub enum`'un varyantları
  kendiliğinden açık olduğu için `Sinif::Savasci` dışarıdan kullanılabiliyor.

  `saturating_sub` (Modül 2) sıfırın altına inmez: `80 - 100` panik yerine `0` verir. Düz `-` yazılsaydı
  debug derlemesinde taşma paniği olurdu; `u32` zaten negatif değer tutamaz.
```

```compiles
code: |
  mod banka {
      pub struct Hesap {
          pub sahip: String,
          bakiye: u64,
      }
  }

  fn main() {
      let h = banka::Hesap { sahip: String::from("Zeynep"), bakiye: 1_000_000 };
      println!("{}", h.sahip);
  }
answer: false
error: E0451
explanation: |
  `pub struct` yalnızca tipi açar; alanlar tek tek açılır. `bakiye` gizli olduğu için `banka`'nın
  dışında `Hesap { ... }` yazılamaz: **E0451 - field `bakiye` of struct `Hesap` is private**. İşte
  kapsüllemenin gücü: dışarıdaki kod kendine bir milyonluk hesap uyduramaz. Doğru tasarım, `banka`
  içinde `pub fn yeni(sahip: &str) -> Hesap` gibi bir kurucu sunmaktır.
```

## Bölüm 2: Yollar, use ve pub use

```predict
code: |
  fn ad() -> &'static str {
      "kök"
  }

  mod a {
      pub fn ad() -> &'static str {
          "a"
      }

      pub mod b {
          pub fn ad() -> &'static str {
              "b"
          }

          pub fn yaz() {
              println!("{} {} {}", self::ad(), super::ad(), crate::ad());
          }
      }
  }

  fn main() {
      a::b::yaz();
      println!("{}", a::ad());
  }
options:
  - |
    b a kök
    a
  - |
    kök a b
    a
  - |
    b b b
    a
answer: 0
explanation: |
  `self::` bulunulan modülden (`b`), `super::` bir üst modülden (`a`), `crate::` ise kökten başlar.
  Üç ayrı `ad` fonksiyonu üç ayrı modülde yaşadığı için çakışmazlar. `main`'deki `a::ad()` ise kökten
  göreli bir yoldur: `a` modülündeki `ad`.
```

```compiles
code: |
  mod okul {
      pub fn zil() -> &'static str {
          "Zil çaldı!"
      }
  }

  mod sinif {
      pub fn ders_bitti() -> &'static str {
          okul::zil()
      }
  }

  fn main() {
      println!("{}", sinif::ders_bitti());
  }
answer: false
error: E0433
explanation: |
  `okul::zil()` **göreli** bir yoldur: `sinif` modülünün içinden aranır. `sinif`'in içinde `okul`
  diye bir şey yok; `okul`, `sinif`'in **kardeşidir**. Derleyici **E0433** verir:
  ``cannot find module or crate `okul` in this scope`` (ve `use crate::okul;` eklemeyi önerir).
  Düzeltmenin üç yolu: `super::okul::zil()`, `crate::okul::zil()` ya da `sinif`'in içine
  `use crate::okul;` yazmak. Bir modül, üst modülündeki adlara **erişebilir** ama onları kendi
  kapsamında kendiliğinden **bulamaz**; yolu açıkça vermen gerekir.
```

```fill
prompt: |
  `use` satırlarını tamamla: `ankara` modülü kodda `baskent` adıyla kullanılsın, `std::cmp`'den de
  iki sayının büyüğünü veren fonksiyon gelsin.
code: |
  mod sehir {
      pub mod istanbul {
          pub fn nufus() -> u32 {
              15_700_000
          }
      }

      pub mod ankara {
          pub fn nufus() -> u32 {
              5_900_000
          }
      }
  }

  use sehir::{istanbul, ___0 as baskent};
  use std::cmp::___1;

  fn main() {
      println!("İstanbul: {}", istanbul::nufus());
      println!("Başkent: {}", baskent::nufus());
      println!("Büyüğü: {}", max(istanbul::nufus(), baskent::nufus()));
  }
blanks:
  - ["ankara"]
  - ["max"]
output: |
  İstanbul: 15700000
  Başkent: 5900000
  Büyüğü: 15700000
explanation: |
  `use sehir::{istanbul, ankara as baskent};` iç içe yol ile iki modülü birden getirir; `as` ikincisine
  yeni bir yerel ad verir. `use std::cmp::max;` ise `max`'ı doğrudan getirir. Fonksiyonlar için genelde
  üst modül getirilir (`istanbul::nufus()`), ama `max` gibi herkesin tanıdığı adları doğrudan getirmek de
  yaygındır.
```

```parsons
prompt: |
  Satırları sıraya koyarak `magaza` modülünün gizli `depo` alt modülündeki `Urun`'u bir **vitrinle**
  dışarı açan ve `main`'den kullanan programı kur. İki satır fazladan konmuş tuzaktır.
lines: |
  mod magaza {
      pub use depo::Urun;
      mod depo {
          pub struct Urun {
              pub ad: String,
          }
      }
  }
  fn main() {
      let u = magaza::Urun { ad: String::from("Çaydanlık") };
      println!("{}", u.ad);
  }
distractors: |
      pub use crate::depo::Urun;
      let u = magaza::depo::Urun { ad: String::from("Çaydanlık") };
explanation: |
  `pub use depo::Urun;` satırı `magaza`'nın içinde, göreli bir yolla yazılır (`depo`, `magaza`'nın
  çocuğudur). `crate::depo` ise kökte bir `depo` arardı ve bulamazdı. `depo` gizli kaldığı için
  `main` `magaza::depo::Urun` yazamaz (E0603); tek kapı vitrin: `magaza::Urun`.
```

```compiles
question: Modül 4'ü hatırla. Bu kargo programı derlenir mi?
code: |
  mod kargo {
      pub struct Paket {
          pub alici: String,
          pub kg: u32,
      }

      pub fn gonder(p: Paket) -> String {
          format!("{} kişisine {} kg gönderildi", p.alici, p.kg)
      }
  }

  fn main() {
      let p = kargo::Paket { alici: String::from("Murat"), kg: 3 };
      println!("{}", kargo::gonder(p));
      println!("Takip: {}", p.alici);
  }
answer: false
error: E0382
explanation: |
  Yollar ve gizlilik kusursuz: `Paket` ve alanları `pub`. Sorun **sahiplikte**: `gonder` paketi değer
  olarak (`Paket`) alır, yani `kargo::gonder(p)` çağrısı `p`'yi fonksiyona **taşır**. Sonraki satırda
  `p.alici`'yi kullanmak **E0382 - borrow of moved value: `p`** verir. Çözüm: `gonder(p: &Paket)` ve
  `kargo::gonder(&p)`. Modül sınırları sahiplik kurallarını değiştirmez.
```

## Bölüm 3: Dosyalar, dış crate'ler ve sürümler

```quiz
question: "`src/oyun/harita.rs` dosyasında `mod zindan;` yazıyor. Derleyici `zindan` modülünün gövdesini (modern biçimle) hangi dosyada arar?"
options:
  - "`src/zindan.rs`"
  - "`src/oyun/zindan.rs`"
  - "`src/oyun/harita/zindan.rs`"
  - "`src/harita/zindan.rs`"
answer: 2
explanation: |
  `src/oyun/harita.rs` dosyası `crate::oyun::harita` modülüdür. Onun alt modülü `zindan`'ın yolu
  `crate::oyun::harita::zindan`, dosyası da `src/oyun/harita/zindan.rs` (ya da eski biçimle
  `src/oyun/harita/zindan/mod.rs`). Dosya yolu modül yolunun aynasıdır.
feedback:
  - "Bu, kökte (`main.rs`/`lib.rs`) `mod zindan;` yazılsaydı aranacak dosyaydı."
  - "Bu, `oyun.rs` içinde `mod zindan;` yazılsaydı aranacak dosyaydı."
  - Doğru!
  - "`harita` kökün değil, `oyun`'un çocuğudur; klasör de `src/oyun/harita/` olmalı."
```

```predict
code: |
  use regex::Regex;

  fn main() {
      let re = Regex::new(r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+) ([0-9]{2,3})").unwrap();
      let notlar = "Ali 85, ayşe 92, Can 7, Deniz 100";
      let mut sayi = 0;
      for c in re.captures_iter(notlar) {
          println!("{}: {}", &c[1], &c[2]);
          sayi += 1;
      }
      println!("{sayi} kayıt");
  }
options:
  - |
    Ali: 85
    Deniz: 100
    2 kayıt
  - |
    Ali: 85
    ayşe: 92
    Can: 7
    Deniz: 100
    4 kayıt
  - |
    Ali: 85
    Can: 7
    Deniz: 100
    3 kayıt
answer: 0
explanation: |
  Desen "büyük harfle başlayan bir ad, bir boşluk, 2-3 rakam" diyor. `ayşe` küçük harfle başladığı için,
  `Can 7` ise tek haneli olduğu için eşleşmez. Kalan iki eşleşmede `c[1]` adı, `c[2]` notu verir.
```

```compiles
question: Modül 7'yi hatırla. `find`'ın sonucunu işleyen bu kod derlenir mi?
code: |
  use regex::Regex;

  fn main() {
      let re = Regex::new(r"[0-9]{5}").unwrap();
      match re.find("Adres: Çankaya, Ankara") {
          Some(m) => println!("Posta kodu: {}", m.as_str()),
      }
  }
answer: false
error: E0004
explanation: |
  `find` bir `Option<Match>` döndürür ve `match` **bütün** olasılıkları kapsamak zorundadır: **E0004,
  non-exhaustive patterns: `None` not covered**. Bu metinde posta kodu olmadığı için `None` kolu tam
  da gerçekleşecek koldur! Ya `None => println!("Posta kodu yok"),` kolunu ekle ya da yalnızca bir
  durumla ilgileniyorsan `if let Some(m) = re.find(...)` kullan.
```

```quiz
question: "`Cargo.toml`'da `zaman = \"0.4.2\"` yazıyor. Aşağıdaki sürümlerden hangileri bu gereksinimi karşılar? (Birden çok doğru cevap var.)"
options:
  - "`0.4.2`"
  - "`0.4.9`"
  - "`0.5.0`"
  - "`0.4.1`"
  - "`1.0.0`"
answer: [0, 1]
explanation: |
  `"0.4.2"` = `^0.4.2` = `>= 0.4.2, < 0.5.0`. `0.x` sürümlerinde kırıcı değişikliği MINOR bildirdiği
  için `0.5.0` aralığın dışındadır; `1.0.0` zaten başka bir MAJOR. `0.4.1` ise alt sınırın altında
  kalır.
feedback:
  - Doğru, alt sınırın kendisi dahildir.
  - Doğru, PATCH güncellemeleri uyumludur.
  - "`0.x`'te `0.4` → `0.5` kırıcı bir geçiştir."
  - "Gereksinim `0.4.2`'den başlar; `0.4.1` daha eskidir."
  - Farklı MAJOR, kesinlikle uyumsuz.
```

```quiz
question: |
  Projede `regex = "1.9"` var ve `Cargo.lock`'ta `regex 1.10.0` kilitli. crates.io'da bugün `1.13.1` ve
  `2.0.0` da yayımlanmış. `cargo update -p regex` çalıştırılırsa ne olur?
options:
  - "`Cargo.lock`'taki `regex` `1.13.1`'e güncellenir; `Cargo.toml` değişmez"
  - "`regex` `2.0.0`'a güncellenir ve `Cargo.toml` da `\"2.0\"` olur"
  - Hiçbir şey; `Cargo.lock` varken sürümler asla değişmez
  - "`Cargo.lock` silinir ve her derlemede en yeni sürüm kullanılır"
answer: 0
explanation: |
  `cargo update` kilitli sürümü **gereksinimin izin verdiği** en yeni sürüme taşır: `"1.9"` =
  `>= 1.9.0, < 2.0.0`, yani `1.13.1`. Gereksinimin kendisine (`Cargo.toml`'a) dokunmaz; kırıcı `2.0.0`'a
  geçmek bilinçli bir `Cargo.toml` değişikliği ister. Kilit dosyası güncellemeyi engellemez, onu
  **bilinçli ve tekrarlanabilir** bir adım hâline getirir.
feedback:
  - Doğru!
  - "`cargo update` aralığın dışına çıkmaz ve `Cargo.toml`'u değiştirmez."
  - "`Cargo.lock` sürümleri kendiliğinden değişmekten korur; ama `cargo update` tam da onu bilinçli olarak güncellemek içindir."
  - "`Cargo.lock` her zaman korunur; tekrarlanabilir derlemelerin temelidir."
```

```quiz
question: |
  Projenin `Cargo.toml`'unda `regex = { version = "1.13", default-features = false, features = ["std"] }`
  var; yani `\d` için gereken `unicode-perl` özelliğini açmadın. Ama bağımlılıklarından biri `regex`'i
  `unicode-perl` özelliğiyle istiyor. Senin kodundaki `Regex::new(r"\d+")` ne olur?
options:
  - "`Err` döner; senin `Cargo.toml`'unda `unicode-perl` kapalı"
  - "Çalışır: özellikler toplanır; `regex` bir kez, iki isteğin birleşimiyle (`std` + `unicode-perl`) derlenir"
  - "Cargo `regex`'i iki kez derler: biri senin ayarlarınla, biri bağımlılığınkilerle"
  - "Cargo özellik çakışması hatası verir ve derlemeyi durdurur"
answer: 1
explanation: |
  Özellikler **toplanır (additive)**: aynı bağımlılığın semver-uyumlu tek bir kopyası vardır ve Cargo onu
  ağaçtaki bütün isteklerin **birleşimiyle** derler. Bu yüzden `\d` senin kodunda da çalışır. Ama bu
  çalışma **tesadüftür**: bağımlılık yarın `unicode-perl`'ü bırakırsa senin kodun kırılır. Kullandığın
  özelliği her zaman kendi `Cargo.toml`'unda da açıkça iste.
feedback:
  - "Özellikler crate başına değil, bağımlılık ağacının tamamı için hesaplanır; birinin açtığı özellik herkese açılır."
  - Doğru! Yine de kullandığın özelliği kendin de açıkça iste.
  - "İki kopya yalnızca semver'e göre **uyumsuz** iki sürüm (ör. `1.x` ve `2.x`) istendiğinde oluşur; özellik farkı ikinci kopya yaratmaz."
  - "Özellikler toplanabilir olacak şekilde tasarlanır; Cargo farklı istekleri hata saymaz, birleştirir."
```

## Bölüm 4: Alıştırmalar

```exercise
id: m08-boss-e-kart
title: Ulaşım kartı
difficulty: 2
prompt: |
  Bir şehir içi ulaşım kartı modellenecek. `ulasim` modülünün içinde:

  - `pub struct Kart`: `pub sahibi: String` ve **gizli** `bakiye: u32` (kuruş) alanları.
  - Gizli bir sabit: `const BINIS_UCRETI: u32 = 2_000;` (20 TL).
  - `pub fn yeni(sahibi: &str) -> Kart`: bakiyesi 0 olan bir kart.
  - `pub fn yukle(&mut self, kurus: u32)`: bakiyeye ekler.
  - `pub fn bin(&mut self) -> bool`: bakiye ücrete yetiyorsa ücreti düşüp `true`, yetmiyorsa **hiçbir
    şeyi değiştirmeden** `false` döndürür.
  - `pub fn bakiye(&self) -> u32`: bakiyeyi okur.

  Bakiye dışarıdan değiştirilememeli: tek yol `yukle` ve `bin`.
starter: |
  mod ulasim {
      pub struct Kart {
          pub sahibi: String,
          // TODO: gizli bakiye alanı
      }

      // TODO: BINIS_UCRETI sabiti

      impl Kart {
          pub fn yeni(sahibi: &str) -> Kart {
              todo!()
          }

          pub fn yukle(&mut self, kurus: u32) {
              todo!()
          }

          pub fn bin(&mut self) -> bool {
              todo!()
          }

          pub fn bakiye(&self) -> u32 {
              todo!()
          }
      }
  }

  fn main() {
      let mut kart = ulasim::Kart::yeni("Selin");
      kart.yukle(5_000);
      let bindi = kart.bin();
      println!("{} biniş yapabildi mi? {bindi}", kart.sahibi);
      println!("Kalan: {} kuruş", kart.bakiye());
  }
solution: |
  mod ulasim {
      pub struct Kart {
          pub sahibi: String,
          bakiye: u32,
      }

      const BINIS_UCRETI: u32 = 2_000;

      impl Kart {
          pub fn yeni(sahibi: &str) -> Kart {
              Kart { sahibi: String::from(sahibi), bakiye: 0 }
          }

          pub fn yukle(&mut self, kurus: u32) {
              self.bakiye += kurus;
          }

          pub fn bin(&mut self) -> bool {
              if self.bakiye >= BINIS_UCRETI {
                  self.bakiye -= BINIS_UCRETI;
                  true
              } else {
                  false
              }
          }

          pub fn bakiye(&self) -> u32 {
              self.bakiye
          }
      }
  }

  fn main() {
      let mut kart = ulasim::Kart::yeni("Selin");
      kart.yukle(5_000);
      let bindi = kart.bin();
      println!("{} biniş yapabildi mi? {bindi}", kart.sahibi);
      println!("Kalan: {} kuruş", kart.bakiye());
  }
check: tests
tests: |
  #[test]
  fn yeni_kart_bos() {
      let k = ulasim::Kart::yeni("Selin");
      assert_eq!(k.sahibi, "Selin", "sahibi korunmalı");
      assert_eq!(k.bakiye(), 0, "yeni kartın bakiyesi 0 olmalı");
  }

  #[test]
  fn bos_kartla_binilemez() {
      let mut k = ulasim::Kart::yeni("Kerem");
      assert!(!k.bin(), "bakiye yokken biniş reddedilmeli");
      assert_eq!(k.bakiye(), 0, "reddedilen binişte bakiye değişmemeli");
  }

  #[test]
  fn yukleme_ve_binisler() {
      let mut k = ulasim::Kart::yeni("Selin");
      k.yukle(5_000);
      assert_eq!(k.bakiye(), 5_000, "5000 kuruş yüklendi");
      assert!(k.bin(), "50 TL ile binilebilmeli");
      assert_eq!(k.bakiye(), 3_000, "bir binişte 2000 kuruş düşmeli");
      assert!(k.bin(), "30 TL ile binilebilmeli");
      assert!(!k.bin(), "10 TL yetmemeli");
      assert_eq!(k.bakiye(), 1_000, "yetmeyen binişte bakiye 1000 kuruşta kalmalı");
  }

  #[test]
  fn tam_ucretle_binilir() {
      let mut k = ulasim::Kart::yeni("Ada");
      k.yukle(2_000);
      k.yukle(0);
      assert!(k.bin(), "bakiye tam ücret kadarsa binilebilmeli");
      assert_eq!(k.bakiye(), 0, "tam ücretle binince bakiye 0 olmalı");
  }
hints:
  - "Struct'a `bakiye: u32` alanını **`pub` olmadan** ekle; sabiti `impl`'in dışında, modülün içinde `const BINIS_UCRETI: u32 = 2_000;` olarak tanımla."
  - "`yeni`: `Kart { sahibi: String::from(sahibi), bakiye: 0 }`. `yukle`: `self.bakiye += kurus;`. `bakiye()`: `self.bakiye`."
  - "`bin`: `if self.bakiye >= BINIS_UCRETI { self.bakiye -= BINIS_UCRETI; true } else { false }`."
forbid:
  - pattern: "pub(\\([^)]*\\))?\\s+bakiye\\s*:"
    message: "Bakiye alanı gizli kalmalı (`pub(crate)` da olmaz, çünkü `main` aynı crate'te); dışarıya yalnızca metotlarla açılmalı."
explanation: |
  Kart'ın değişmez koşulu (invariant) "bakiye yalnızca yükleme ve binişle değişir" ve bu koşulu
  **derleyici** koruyor: `bakiye` gizli olduğu için `ulasim`'in dışındaki hiçbir kod `kart.bakiye = 999_999`
  yazamaz, `Kart { ... }` ile de kart uyduramaz. `bin`'de önce kontrol edip sonra düşmek, `u32`'nin sıfırın
  altına inip taşma paniği vermesini de önler (Modül 2). Bir sınır daha: `yukle`'deki `+=` da taşabilir
  (`u32` en fazla yaklaşık 42,9 milyon TL'lik kuruş tutar); debug'da panik, release'de sessiz sarma olur.
  Gerçek bir sistemde `checked_add` ile böyle bir yükleme reddedilir.

  Neden `pub(crate) bakiye` de yasak? `main` ile `ulasim` aynı crate'te olduğu için `pub(crate)` alan
  `main`'den de değiştirilebilirdi; kapsülleme yine bozulurdu.

  `BINIS_UCRETI` gizli bir sabit: ücret değişirse yalnızca bu satırı değiştirirsin ve kartı kullanan kimsenin
  kodu kırılmaz. Bu, Ders 7'deki "gizlilik, kırmadan değişme özgürlüğü verir" ilkesinin ta kendisi.
```

```exercise
id: m08-boss-e-restoran
title: Lokanta kasası
difficulty: 3
prompt: |
  Bir lokantanın kodu `restoran` modülünde. Menü hazır; senin görevin:

  1. Gizli `kasa` modülündeki `hesap_kes` fonksiyonunu tamamla: siparişlerdeki yemeklerin fiyatlarını
     `menu` modülündeki `fiyat` fonksiyonuyla bulup topla, üstüne **%10 servis** ekle (tamsayı:
     `toplam + toplam * 10 / 100`). Menüde olmayan **tek bir** yemek bile varsa `None` döndür. Boş sipariş
     `Some(0)`'dır.
  2. `kasa` modülü `menu`'ye **göreli ya da mutlak bir yolla** ulaşsın (`super::` veya `crate::`).
  3. `restoran` modülünün başına bir vitrin kur: dışarıdan `restoran::fiyat` ve `restoran::hesap_kes`
     yolları çalışsın. `menu` ve `kasa` gizli kalsın.
starter: |
  mod restoran {
      // ---- Vitrin ----
      // TODO

      mod menu {
          pub fn fiyat(yemek: &str) -> Option<u32> {
              match yemek {
                  "mercimek" => Some(90),
                  "iskender" => Some(420),
                  "lahmacun" => Some(150),
                  "ayran" => Some(40),
                  "künefe" => Some(180),
                  _ => None,
              }
          }
      }

      mod kasa {
          /// Toplam + %10 servis; menüde olmayan yemek varsa None.
          pub fn hesap_kes(siparisler: &[&str]) -> Option<u32> {
              todo!()
          }
      }
  }

  fn main() {
      // Vitrini kurunca bu satırı açabilirsin:
      // println!("{:?}", restoran::hesap_kes(&["iskender", "ayran"]));
  }
solution: |
  mod restoran {
      // ---- Vitrin ----
      pub use kasa::hesap_kes;
      pub use menu::fiyat;

      mod menu {
          pub fn fiyat(yemek: &str) -> Option<u32> {
              match yemek {
                  "mercimek" => Some(90),
                  "iskender" => Some(420),
                  "lahmacun" => Some(150),
                  "ayran" => Some(40),
                  "künefe" => Some(180),
                  _ => None,
              }
          }
      }

      mod kasa {
          use super::menu;

          const SERVIS_YUZDE: u32 = 10;

          /// Toplam + %10 servis; menüde olmayan yemek varsa None.
          pub fn hesap_kes(siparisler: &[&str]) -> Option<u32> {
              let mut toplam = 0;
              for yemek in siparisler {
                  match menu::fiyat(yemek) {
                      Some(f) => toplam += f,
                      None => return None,
                  }
              }
              Some(toplam + toplam * SERVIS_YUZDE / 100)
          }
      }
  }

  fn main() {
      println!("{:?}", restoran::hesap_kes(&["iskender", "ayran"]));
      println!("{:?}", restoran::hesap_kes(&["lahmacun", "pizza"]));
      println!("Künefe: {:?}", restoran::fiyat("künefe"));
  }
check: tests
tests: |
  #[test]
  fn vitrinden_fiyat() {
      assert_eq!(restoran::fiyat("künefe"), Some(180), "künefe 180 TL");
      assert_eq!(restoran::fiyat("pizza"), None, "menüde olmayan yemeğin fiyatı yok");
  }

  #[test]
  fn hesap_servisle_birlikte() {
      assert_eq!(restoran::hesap_kes(&["iskender", "ayran"]), Some(506), "460 TL + %10 servis = 506 TL");
      assert_eq!(restoran::hesap_kes(&["mercimek"]), Some(99), "90 TL + 9 TL servis = 99 TL");
      assert_eq!(
          restoran::hesap_kes(&["lahmacun", "lahmacun", "ayran", "künefe"]),
          Some(572),
          "520 TL + 52 TL servis = 572 TL (aynı yemek iki kez sayılmalı)"
      );
  }

  #[test]
  fn menude_olmayan_yemek() {
      assert_eq!(restoran::hesap_kes(&["iskender", "pizza"]), None, "menüde olmayan yemek varsa None");
      assert_eq!(restoran::hesap_kes(&["pizza", "iskender"]), None, "sıra fark etmemeli");
  }

  #[test]
  fn bos_siparis() {
      assert_eq!(restoran::hesap_kes(&[]), Some(0), "boş siparişin hesabı 0");
  }
hints:
  - |
    Vitrin iki satır: `pub use kasa::hesap_kes;` ve `pub use menu::fiyat;` (`restoran`'ın içinde,
    göreli yollarla).
  - |
    `kasa`, `menu`'nün kardeşidir: `kasa`'nın içine `use super::menu;` yaz ve `menu::fiyat(yemek)` diye
    çağır. Kardeş modül, göreli yolla (`menu::...`) doğrudan bulunamaz.
  - |
    `let mut toplam = 0;` ile başla. `for yemek in siparisler` döngüsünde
    `match menu::fiyat(yemek) { Some(f) => toplam += f, None => return None }` yaz. Döngüden sonra
    `Some(toplam + toplam * 10 / 100)` döndür.
forbid:
  - pattern: "pub(\\([^)]*\\))?\\s+mod\\s+(menu|kasa)\\b"
    message: "`menu` ve `kasa` gizli kalmalı; dışarıya yalnızca vitrinden açılmalı."
require:
  - pattern: "pub\\s+use\\s"
    message: "Vitrini `pub use` ile kur."
explanation: |
  Bu alıştırma modülün neredeyse bütün fikirlerini birleştiriyor:

  - **Gizlilik:** `menu` ve `kasa` gizli; dış dünya yalnızca `restoran::fiyat` ve `restoran::hesap_kes`'i
    tanıyor. Yarın `kasa`'yı `odeme` diye yeniden adlandırsan vitrin satırını güncellemen yeter.
  - **Yollar:** `kasa` kardeş modül `menu`'ye `super::menu` (ya da `crate::restoran::menu`) ile ulaşıyor.
    `pub use kasa::hesap_kes;` ise `restoran`'ın içinden göreli bir yol.
  - **Option:** Menüde olmayan bir yemek görüldüğü anda `return None;` ile erken çıkılıyor (Modül 7).
    `None` kolundaki `return`, fonksiyonun tamamından çıkar; yalnızca döngüden değil.

  `for yemek in siparisler` döngüsünde `yemek`'in tipi `&&str`'dir (dilimin elemanına referans), ama
  `menu::fiyat(yemek)` çağrısı sorunsuz derlenir: Rust, fonksiyon argümanlarında referansları otomatik
  olarak "açar" (deref coercion), `&&str`'den `&str` elde eder.
```

````exercise
id: m08-boss-e-cargo-satiri
title: Güncelleme güvenli mi?
difficulty: 4
prompt: |
  Bir bağımlılık güncelleme aracı yazıyorsun. `Cargo.toml`'daki bir satırı okuyup yeni bir sürümün
  semver'e göre **güvenle** (caret gereksinimi içinde kalarak) alınıp alınamayacağına karar vereceksin.

  1. `ayristir(satir: &str) -> Option<(String, (u64, u64, u64))>`: `ad = "SÜRÜM"` biçimindeki bir satırdan
     crate adını ve sürümü çıkarır.
     - Ad: küçük harf, rakam, `_` ve `-` (en az bir karakter).
     - Sürüm: 1-3 sayısal parça (`"1"`, `"0.10"`, `"1.13.1"`); eksik parçalar `0` sayılır.
     - Biçime uymayan her satır (tırnaksız sürüm, büyük harfli ad, dört parçalı sürüm, boş satır...)
       `None`.
     Hazır desen (ham metin içinde tırnak olduğu için `r#"..."#`):

     ```text
     ^([a-z0-9_-]+) = "([0-9]+)(?:\.([0-9]+))?(?:\.([0-9]+))?"$
     ```

     `(?:...)` gruplamadır ama **yakalamaz**; bu yüzden yakalanan gruplar sırasıyla: 1 = ad, 2 = major,
     3 = minor, 4 = patch. İsteğe bağlı bir grup eşleşmediyse `c.get(3)` `None` verir (`c.get(i)`,
     `Option<Match>` döndürür).
  2. `guvenli_mi(satir: &str, yeni: (u64, u64, u64)) -> bool`: Satır ayrıştırılamazsa `false`; yoksa `yeni`
     sürümün satırdaki caret gereksinimini karşılayıp karşılamadığını döndürür (`0.x` kuralları dahil!).
starter: |
  use regex::Regex;

  pub fn ayristir(satir: &str) -> Option<(String, (u64, u64, u64))> {
      todo!()
  }

  pub fn guvenli_mi(satir: &str, yeni: (u64, u64, u64)) -> bool {
      todo!()
  }

  fn main() {
      let satir = r#"rand = "0.10""#;
      println!("{:?}", ayristir(satir));
      println!("0.10.3 güvenli mi? {}", guvenli_mi(satir, (0, 10, 3)));
      println!("0.11.0 güvenli mi? {}", guvenli_mi(satir, (0, 11, 0)));
  }
solution: |
  use regex::Regex;

  pub fn ayristir(satir: &str) -> Option<(String, (u64, u64, u64))> {
      let re = Regex::new(r#"^([a-z0-9_-]+) = "([0-9]+)(?:\.([0-9]+))?(?:\.([0-9]+))?"$"#).unwrap();
      let c = match re.captures(satir) {
          Some(c) => c,
          None => return None,
      };
      let ad = String::from(&c[1]);
      let major: u64 = c[2].parse().unwrap();
      let minor: u64 = match c.get(3) {
          Some(m) => m.as_str().parse().unwrap(),
          None => 0,
      };
      let patch: u64 = match c.get(4) {
          Some(m) => m.as_str().parse().unwrap(),
          None => 0,
      };
      Some((ad, (major, minor, patch)))
  }

  pub fn guvenli_mi(satir: &str, yeni: (u64, u64, u64)) -> bool {
      let g = match ayristir(satir) {
          Some((_, surum)) => surum,
          None => return false,
      };
      let ust = if g.0 > 0 {
          (g.0 + 1, 0, 0)
      } else if g.1 > 0 {
          (0, g.1 + 1, 0)
      } else {
          (0, 0, g.2 + 1)
      };
      yeni >= g && yeni < ust
  }

  fn main() {
      let satir = r#"rand = "0.10""#;
      println!("{:?}", ayristir(satir));
      println!("0.10.3 güvenli mi? {}", guvenli_mi(satir, (0, 10, 3)));
      println!("0.11.0 güvenli mi? {}", guvenli_mi(satir, (0, 11, 0)));
  }
check: tests
tests: |
  #[test]
  fn tam_ve_eksik_surumleri_ayristirir() {
      assert_eq!(ayristir(r#"regex = "1.13.1""#), Some((String::from("regex"), (1, 13, 1))), "üç parçalı sürüm");
      assert_eq!(ayristir(r#"rand = "0.10""#), Some((String::from("rand"), (0, 10, 0))), "eksik patch 0 sayılır");
      assert_eq!(ayristir(r#"serde_json = "1""#), Some((String::from("serde_json"), (1, 0, 0))), "tek parçalı sürüm");
      assert_eq!(ayristir(r#"chrono-tz = "0.8.6""#), Some((String::from("chrono-tz"), (0, 8, 6))), "tireli crate adı");
  }

  #[test]
  fn hatali_satirlari_reddeder() {
      assert_eq!(ayristir(r#"rand = 0.10"#), None, "tırnaksız sürüm geçersiz");
      assert_eq!(ayristir(r#"Rand = "1""#), None, "büyük harfli ad geçersiz");
      assert_eq!(ayristir(r#"rand = "1.2.3.4""#), None, "dört parçalı sürüm geçersiz");
      assert_eq!(ayristir(""), None, "boş satır geçersiz");
  }

  #[test]
  fn bir_x_guncellemeleri() {
      let satir = r#"regex = "1.13""#;
      assert!(guvenli_mi(satir, (1, 13, 0)), "gereksinimin kendisi güvenli");
      assert!(guvenli_mi(satir, (1, 20, 4)), "1.20.4 aynı MAJOR, güvenli");
      assert!(!guvenli_mi(satir, (2, 0, 0)), "2.0.0 kırıcı");
      assert!(!guvenli_mi(satir, (1, 12, 9)), "1.12.9 gereksinimden eski");
  }

  #[test]
  fn sifir_x_guncellemeleri() {
      assert!(guvenli_mi(r#"rand = "0.10""#, (0, 10, 3)), "0.10.3 güvenli");
      assert!(!guvenli_mi(r#"rand = "0.10""#, (0, 11, 0)), "0.x'te MINOR artışı kırıcı");
      assert!(guvenli_mi(r#"deneme = "0.0.3""#, (0, 0, 3)), "0.0.3 kendisiyle uyumlu");
      assert!(!guvenli_mi(r#"deneme = "0.0.3""#, (0, 0, 4)), "0.0.x'te her sürüm kırıcı");
  }

  #[test]
  fn ayristirilamayan_satir_guvenli_degil() {
      assert!(!guvenli_mi("bozuk satır", (1, 0, 0)), "ayrıştırılamayan satırda false");
  }
hints:
  - |
    `ayristir`: Deseni `Regex::new(r#"...hazır desen..."#)` ile derle. `re.captures(satir)` bir
    `Option` döndürür; `match` ile `None` durumunda `return None;` yap.
  - |
    Ad için `String::from(&c[1])`, major için `c[2].parse().unwrap()`. Minor ve patch isteğe bağlı:
    `match c.get(3) { Some(m) => m.as_str().parse().unwrap(), None => 0 }`. Değişkenlerin tipini
    `let minor: u64 = ...` diye belirt ki `parse` neye çevireceğini bilsin.
  - |
    `guvenli_mi`: `match ayristir(satir) { Some((_, surum)) => surum, None => return false }` ile
    gereksinimi al. Üst sınır: `g.0 > 0` ise `(g.0 + 1, 0, 0)`, değilse `g.1 > 0` ise `(0, g.1 + 1, 0)`,
    değilse `(0, 0, g.2 + 1)`. Sonuç: `yeni >= g && yeni < ust`.
require:
  - pattern: "Regex::new"
    message: "Satırı `regex` crate'iyle ayrıştır."
explanation: |
  Bu alıştırma modülün son iki dersini Modül 7'deki `Option` ile birleştiriyor: `regex` ile ayrıştırma,
  `Option` ile eksik parçalar ve semver'in caret kuralı.

  - `^...$` sayesinde dört parçalı bir sürüm (`"1.2.3.4"`) reddedilir: üçüncü isteğe bağlı gruptan sonra
    gelen `.4`, kapanış tırnağıyla eşleşmez.
  - `c[3]` yerine `c.get(3)` kullanmak zorundaydık: `c[i]` eşleşmeyen bir grupta **panikler**,
    `get` ise `None` döndürür. Bu, Modül 7'deki "Option ile yokluğu açıkça ele al" ilkesinin bir crate
    API'sindeki karşılığıdır.
  - `parse().unwrap()` burada güvenli: desen o gruplara yalnızca rakam girmesine izin veriyor. (Çok uzun
    bir sayı `u64`'e sığmayıp panik verebilir; bunu düzgünce ele almayı Modül 10'da öğreneceksin.)
  - Caret'in üst sınırı, sürümün **ilk sıfır olmayan parçasının** bir artırılmasıdır: `1.13 → 2.0.0`,
    `0.10 → 0.11.0`, `0.0.3 → 0.0.4`.

  Gerçek dünyada Cargo bu işi `semver` crate'iyle yapar; `cargo upgrade` (cargo-edit) ve Dependabot gibi
  araçlar da tam olarak bu soruyu sorar: "Bu güncelleme gereksinimin içinde mi, yoksa kırıcı mı?"
````
