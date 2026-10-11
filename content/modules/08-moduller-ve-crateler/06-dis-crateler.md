---
id: m08-l06
title: Dış Crate'ler ve crates.io
minutes: 20
type: lesson
objectives:
  - "Bir crate'i `Cargo.toml`'un `[dependencies]` bölümüne (ya da `cargo add` ile) ekleyip kodda yol kökü olarak kullanabilmek"
  - "`rand` ile rastgele sayı üretebilmek ve rastgeleliği saf mantıktan ayırarak test edilebilir kod yazabilmek"
  - "`regex` ile metinde desen arayabilmek: `Regex::new`, `is_match`, `find`, `find_iter`, `captures`, `replace_all`"
  - crates.io ve docs.rs'te bir crate'i bulup belgelerini okuyabilmek ve kalitesini somut ölçütlerle değerlendirebilmek
keywords: [crates.io, docs.rs, bağımlılık, dependency, Cargo.toml, cargo add, rand, regex, std, extern prelude, E0432, E0433]
---

Bir zar oyunu yazmak istiyorsun. İlk ihtiyacın 1 ile 6 arasında rastgele bir sayı. Python'da
`random.randint(1, 6)`, JavaScript'te `Math.random()` var. Rust'ın (kararlı/stable) standart
kütüphanesinde ise... **rastgele sayı üreteci yok.** Düzenli ifadeler (regex) de yok, JSON da yok, HTTP
istemcisi de. (Gece sürümlerinde denenen deneysel bir `std::random` modülü var, ama kararlı Rust'ta
kullanılamaz.)

Bu bir eksiklik değil, bilinçli bir tasarım kararı. Bu derste nedenini öğrenecek, ardından Rust
ekosisteminin kalbine, **crates.io**'ya gidip başkalarının yazdığı crate'leri kendi projende
kullanacaksın.

## Standart kütüphane neden küçük?

Önce ne bildiğini yokla:

```quiz
question: Aşağıdakilerden hangileri Rust'ın standart kütüphanesinde (`std`) **yoktur**? (Birden çok doğru cevap var.)
options:
  - Rastgele sayı üretimi
  - "Anahtar-değer tablosu (`HashMap`)"
  - Düzenli ifadeler (regex)
  - Dosya okuma/yazma
  - JSON ayrıştırma
answer: [0, 2, 4]
explanation: |
  `std`'de `HashMap` (Modül 9) ve dosya işlemleri (`std::fs`) var; ama rastgele sayı, regex ve JSON için
  topluluğun crate'lerini kullanırsın: `rand`, `regex`, `serde_json`. Bunlar `std`'nin parçası olmayan
  ama herkesin kullandığı, son derece olgun kütüphanelerdir; `regex` resmî `rust-lang` organizasyonu
  altında geliştirilir.
feedback:
  - Doğru, `rand` crate'i gerekir.
  - "`HashMap` `std::collections` modülündedir; Modül 9'da göreceksin."
  - Doğru, `regex` crate'i gerekir.
  - "`std::fs` dosya işlemlerini sağlar."
  - Doğru, `serde` + `serde_json` gerekir.
```

Neden? Çünkü Rust'ın standart kütüphanesi **sonsuza kadar geriye dönük uyumluluk** sözü verir: 2015'te
Rust 1.0 için yazılmış bir program (güvenlik açığı düzeltmesi gibi çok küçük istisnalar dışında) bugünkü
derleyiciyle de derlenir. `std`'ye giren her fonksiyon, her
tip **asla kaldırılamaz ve kırılamaz.** Bu yüzden Rust ekibi `std`'ye yalnızca tasarımından emin olduğu,
neredeyse her programın ihtiyaç duyduğu şeyleri koyar.

Rastgele sayı üretimi gibi alanlarda en iyi tasarım yıllar içinde değişir. Gerçek bir örnek: `rand`
crate'inin API'si 0.8 sürümünden 0.10'a kadar iki kez köklü biçimde değişti. `std`'de olsaydı eski ve
kötü tasarım sonsuza dek orada kalırdı. Crate olduğu için ekosistem gelişebiliyor; eski sürümü kullanan
projeler de bozulmadan eski sürümde kalabiliyor (nasıl olduğunu bir sonraki derste göreceksin).

:::info Diğer diller
**Python** "piller dahil" (*batteries included*) felsefesini izler: standart kütüphanesi devasadır. Bedeli
de vardır: yıllar içinde "ölü piller" birikti ve Python 3.13'te 19 eski modül kaldırıldı. **JavaScript**
(npm) uç noktadadır: standart kütüphane çok küçük, her şey paket. Rust ortada durur: küçük ama kaya gibi
sağlam bir `std`, üstüne kaliteli ve sürümlenmiş bir ekosistem.
:::

:::analogy Telefon ve uygulama mağazası
Yeni bir telefon aldığında telefon, mesaj, kamera gibi **temel uygulamalar** hazır gelir; üretici
bunları yıllarca destekleyeceğine söz verir. Gerisini **uygulama mağazasından** indirirsin. Mağaza her
uygulamanın hangi sürümde olduğunu takip eder ve güncellemeyi senin onayına bırakır. Rust'ta temel
uygulamalar `std`, mağaza **crates.io**, mağaza uygulaması da **Cargo**'dur.
:::

## Bağımlılık eklemek: Cargo.toml ve cargo add

Bir crate'i projene eklemek için `Cargo.toml`'un `[dependencies]` bölümüne adını ve sürüm gereksinimini
yazarsın:

```toml
[package]
name = "zar"
version = "0.1.0"
edition = "2024"

[dependencies]
rand = "0.10"
regex = "1.13"
```

Bu satırı elle yazmak yerine Cargo'ya da yazdırabilirsin:

```console
$ cargo add rand
    Updating crates.io index
      Adding rand v0.10.3 to dependencies
$ cargo add regex@1.13
$ cargo remove regex
```

`cargo add`, crates.io'daki en yeni uyumlu sürümü bulup `Cargo.toml`'a yazar. `"0.10"` gibi bir sürüm
gereksiniminin tam olarak hangi sürümlere izin verdiğini (semver) bir sonraki dersin konusu.

Ardından ilk `cargo build`'de şunlar olur:

```console
$ cargo build
    Updating crates.io index
     Locking 9 packages to latest compatible versions
  Downloaded rand v0.10.3
  Downloaded rand_core v0.10.1
  ...
   Compiling rand_core v0.10.1
   Compiling rand v0.10.3
   Compiling zar v0.1.0 (C:\Users\elif\projeler\zar)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6.42s
```

1. Cargo crates.io'nun **dizinine (index)** bakar ve gereksinime uyan sürümleri seçer.
2. Seçtiği tam sürümleri `Cargo.lock` dosyasına kilitler (bir sonraki ders).
3. Crate'leri indirir; bilgisayarındaki ortak önbellekte (`~/.cargo/registry`) saklar, yani başka
   projeler aynı sürümü yeniden indirmez.
4. Yalnızca senin eklediklerini değil, **onların bağımlılıklarını** da (geçişli bağımlılıklar,
   *transitive dependencies*) derler. Yukarıda `rand_core`'u sen istemedin; `rand` istedi.
5. Derlenmiş bağımlılıklar `target/` klasöründe kalır. Bu yüzden ilk derleme yavaştır, sonrakiler
   hızlıdır.

Kodda ise hiçbir ek bildirim gerekmez. Bağımlılığın **adı**, tıpkı `std` gibi bir yolun kökü olarak
kullanılır:

```rust
fn main() {
    let zar: u32 = rand::random_range(1..=6);
    println!("Zar: {zar}");
}
```

:::tip Bu uygulamada Cargo.toml yok
Bu uygulamanın çevrimiçi çalıştırıcısı (Rust Playground) en popüler crate'leri önceden yüklü tutar; bu
yüzden derslerdeki `rand` ve `regex` örnekleri hiçbir ayar yapmadan çalışır. Kendi bilgisayarında ise
önce `cargo add rand` demen gerekir. Unutursan derleyici seni uyarır:
:::

```compiles
question: "Projenin `Cargo.toml`'unda hiç bağımlılık yok. Bu kod derlenir mi?"
code: |
  fn main() {
      let simdi = zaman::simdi();
      println!("{simdi}");
  }
answer: false
error: E0433
explanation: |
  `zaman` adında ne bir modül ne de bağlanmış bir crate var. Derleyici iki ihtimali de söyler:
  **use of unresolved module or unlinked crate `zaman`** ve hemen ardından `cargo add zaman` önerisi.
  Bir crate'i kullanabilmek için onu `Cargo.toml`'a eklemek zorunludur; derleyici internette crate aramaz.
```

:::error
```text
error[E0433]: cannot find module or crate `zaman` in this scope
 --> src/main.rs:2:17
  |
2 |     let simdi = zaman::simdi();
  |                 ^^^^^ use of unresolved module or unlinked crate `zaman`
  |
  = help: if you wanted to use a crate named `zaman`, use `cargo add zaman` to add it to your `Cargo.toml`
```
Hata `use zaman::simdi;` satırında olsaydı kod **E0432** (``unresolved import `zaman` ``) olurdu; altındaki
açıklama ve `cargo add` önerisi aynıdır.
Bir de sık görülen ayrıntı: crate adında **tire** varsa kodda **alt çizgi** yazılır. `Cargo.toml`'da
`serde-json` değil `serde_json` olduğu için sorun yok; ama örneğin `chrono-tz` crate'i kodda `chrono_tz::`
diye kullanılır.
:::

### std de bir crate

Fark ettin mi? `std::cmp::max` yazarken `std` de bir yolun kökü. Çünkü standart kütüphane de bir
**crate**'tir; derleyici onu her projeye kendiliğinden bağlar. Üstelik `std`'nin büyük bölümü iki alt
crate'ten gelir: işletim sistemi gerektirmeyen çekirdek `core` ve bellek ayırmayı (`String`, `Vec`)
sağlayan `alloc`. `std` bunları `pub use` ile yeniden dışa aktarır (`std::cmp::max` aslında
`core::cmp::max`'tir) ve üstüne işletim sistemine dayanan kısımları (dosyalar, ağ, iş parçacıkları)
ekler. Ders 4'teki `pub use` vitrini tam olarak burada iş başında.

Dış crate adlarının (`std`, `rand`, `regex`...) bir özelliği daha var: Ders 4'te `use` ile açılan
kısayolların **yalnızca yazıldığı modülde** geçerli olduğunu görmüştük. Crate adları ise her modülde
geçerlidir; derleyici onları özel bir listede (**extern prelude**) tutar. Bu yüzden şu derlenir:

```rust
mod oyun {
    pub mod zar {
        pub fn at() -> u32 {
            rand::random_range(1..=6) // `use` yok, yine de çalışır
        }

        pub fn buyugu(a: u32, b: u32) -> u32 {
            std::cmp::max(a, b) // std de her modülde kök olarak kullanılabilir
        }
    }
}

fn main() {
    let a = oyun::zar::at();
    let b = oyun::zar::at();
    println!("{a} ve {b} atıldı; büyük olan {}", oyun::zar::buyugu(a, b));
}
```

## rand: rastgele sayılar

`rand` crate'inin en kolay kullanımı, yukarıda gördüğün serbest fonksiyonlardır:

| Fonksiyon | Ne döndürür? |
|---|---|
| `rand::random_range(1..=6)` | aralıktan rastgele bir sayı (`..=` dahil, `..` hariç) |
| `rand::random::<f64>()` | `0.0` ile `1.0` arasında (1 hariç) bir ondalık sayı |
| `rand::random::<u8>()` | tipin tüm aralığından rastgele bir değer |
| `rand::random_bool(0.25)` | %25 olasılıkla `true` |

Bir iş yerindeki **çay ocağı kurası**: bugün çayı kim demleyecek?

```rust
fn main() {
    let ekip = ["Ayşe", "Burak", "Cem", "Derya", "Emre"];

    // Rastgele bir indeks seç: 0, 1, 2, 3 ya da 4 (len() hariç!)
    let i = rand::random_range(0..ekip.len());
    println!("Bugün çayı {} demliyor.", ekip[i]);

    // Yazı-tura: %50 olasılık
    let tura = rand::random_bool(0.5);
    println!("Simit parasını {} ödüyor.", if tura { "kaybeden" } else { "kazanan" });

    // 0.0 ile 1.0 arasında bir sayı
    let sans: f64 = rand::random();
    println!("Bugünkü şans katsayın: {sans:.2}");
}
```

Birkaç kez çalıştır; her seferinde farklı sonuç göreceksin. Şimdi Modül 3'teki aralıkları hatırlatan
bir soru:

```predict
question: Bu program 1000 zar atıyor. Ne yazdırır?
code: |
  fn main() {
      let mut altilar = 0;
      for _ in 0..1000 {
          let zar: u32 = rand::random_range(1..6);
          if zar == 6 {
              altilar += 1;
          }
      }
      println!("{altilar}");
  }
options:
  - "0"
  - "Yaklaşık 167 (her çalıştırmada biraz farklı)"
  - "1000"
answer: 0
explanation: |
  `1..6` aralığı **6'yı içermez** (yarı açık aralık; Modül 3'teki `for i in 1..5` gibi). Bu zar yalnızca
  1-5 arası sayı üretir, bu yüzden altı **asla** gelmez ve program her seferinde `0` yazar. Gerçek bir
  zar için `1..=6` yazmalısın. Rastgele kodlardaki bu tür hatalar sinsidir: program çalışır, sadece
  sonuçlar sessizce yanlıştır.
```

Eski bir blog yazısından kod kopyalarsan şu hatayla karşılaşabilirsin:

:::error
```text
error[E0425]: cannot find function `thread_rng` in crate `rand`
 --> src/main.rs:2:21
  |
2 |     let zar = rand::thread_rng().gen_range(1..=6);
  |                     ^^^^^^^^^^ not found in `rand`
```
`rand::thread_rng().gen_range(...)` `rand` 0.8'in API'siydi. 0.9'da adlar `rand::rng()` ve
`random_range` oldu (eski adlar bir süre uyarıyla çalışmaya devam etti), 0.10'da ise eski adlar tamamen
kaldırıldı. `gen_range` neden yeniden adlandırıldı? Rust 2024 sürümünde `gen` ayrılmış bir anahtar
kelime oldu; `gen` adlı bir metodu çağırmak `r#gen()` gibi garip bir yazım gerektirecekti. Kod yanlış
değil, **başka bir sürüm için** yazılmış. Ders: bir crate'in örneğini kullanırken her zaman **hangi
sürümün** belgesine baktığını kontrol et. (Metot biçimindeki `rand::rng().random_range(...)` kullanımı
için bir trait'i kapsama getirmek gerekir; 0.10'da bu `use rand::RngExt;` satırıdır. Trait'leri
Modül 11'de göreceğiz; o zamana kadar serbest fonksiyonlar yeter.)
:::

:::tip Rastgeleliği mantıktan ayır
Rastgele sonuç üreten bir fonksiyonu test etmek zordur: beklenen çıktı her seferinde değişir. Çözüm,
rastgeleliği **ince bir katmana** hapsetmektir: zarı atan fonksiyon tek satır olsun, zar sonucunu
**yorumlayan** fonksiyon ise sayıyı parametre olarak alsın. Yorumlama mantığı artık sıradan, saf
(*pure*) bir fonksiyondur ve her girdisi tek tek test edilebilir. Aşağıdaki alıştırma tam olarak böyle
kurulu.
:::

```exercise
id: m08-e-tavla-zari
title: Tavla zarı
difficulty: 2
prompt: |
  Bir tavla uygulaması için üç fonksiyon yaz:

  1. `zar_at() -> u8`: `rand` ile 1-6 arası (6 dahil) rastgele bir zar değeri döndürür.
  2. `cift_adi(a: u8, b: u8) -> Option<&'static str>`: İki zar **aynıysa** tavladaki adını `Some` içinde
     döndürür, farklıysa `None`:

     | Zarlar | Ad |
     |---|---|
     | 1-1 | `"hep yek"` |
     | 2-2 | `"dubara"` |
     | 3-3 | `"dü se"` |
     | 4-4 | `"dört cihar"` |
     | 5-5 | `"pencü"` |
     | 6-6 | `"düşeş"` |

  3. `hamle_sayisi(a: u8, b: u8) -> u8`: Çift atıldıysa oyuncu **4** hamle, yoksa **2** hamle yapar.

  Testler `zar_at`'ı 1000 kez çağırıp değerlerin aralıkta olduğunu ve **altı yüzün de** geldiğini
  kontrol eder; diğer iki fonksiyonu ise sabit girdilerle sınar.
starter: |
  pub fn zar_at() -> u8 {
      todo!()
  }

  pub fn cift_adi(a: u8, b: u8) -> Option<&'static str> {
      todo!()
  }

  pub fn hamle_sayisi(a: u8, b: u8) -> u8 {
      todo!()
  }

  fn main() {
      let (a, b) = (zar_at(), zar_at());
      match cift_adi(a, b) {
          Some(ad) => println!("{a}-{b}: {ad}! {} hamle", hamle_sayisi(a, b)),
          None => println!("{a}-{b}: {} hamle", hamle_sayisi(a, b)),
      }
  }
solution: |
  pub fn zar_at() -> u8 {
      rand::random_range(1..=6)
  }

  pub fn cift_adi(a: u8, b: u8) -> Option<&'static str> {
      if a != b {
          return None;
      }
      match a {
          1 => Some("hep yek"),
          2 => Some("dubara"),
          3 => Some("dü se"),
          4 => Some("dört cihar"),
          5 => Some("pencü"),
          6 => Some("düşeş"),
          _ => None,
      }
  }

  pub fn hamle_sayisi(a: u8, b: u8) -> u8 {
      if a == b { 4 } else { 2 }
  }

  fn main() {
      let (a, b) = (zar_at(), zar_at());
      match cift_adi(a, b) {
          Some(ad) => println!("{a}-{b}: {ad}! {} hamle", hamle_sayisi(a, b)),
          None => println!("{a}-{b}: {} hamle", hamle_sayisi(a, b)),
      }
  }
check: tests
tests: |
  #[test]
  fn zar_her_zaman_bir_ile_alti_arasinda() {
      for _ in 0..1000 {
          let z = zar_at();
          assert!((1..=6).contains(&z), "zar 1 ile 6 arasında olmalı, gelen: {z}");
      }
  }

  #[test]
  fn alti_yuzun_hepsi_gelir() {
      let mut goruldu = [false; 6];
      for _ in 0..1000 {
          let z = zar_at();
          goruldu[(z - 1) as usize] = true;
      }
      assert_eq!(goruldu, [true; 6], "1000 atışta 1'den 6'ya her yüz en az bir kez gelmeli (6 dahil mi?)");
  }

  #[test]
  fn ciftlerin_adlari() {
      assert_eq!(cift_adi(1, 1), Some("hep yek"), "1-1 hep yek'tir");
      assert_eq!(cift_adi(2, 2), Some("dubara"), "2-2 dubaradır");
      assert_eq!(cift_adi(3, 3), Some("dü se"), "3-3 dü se'dir");
      assert_eq!(cift_adi(4, 4), Some("dört cihar"), "4-4 dört cihar'dır");
      assert_eq!(cift_adi(5, 5), Some("pencü"), "5-5 pencüdür");
      assert_eq!(cift_adi(6, 6), Some("düşeş"), "6-6 düşeştir");
  }

  #[test]
  fn cift_olmayan_zarlar() {
      assert_eq!(cift_adi(6, 5), None, "6-5 çift değil, None olmalı");
      assert_eq!(cift_adi(1, 2), None, "1-2 çift değil, None olmalı");
      assert_eq!(hamle_sayisi(6, 5), 2, "çift değilse 2 hamle");
      assert_eq!(hamle_sayisi(3, 3), 4, "çift atılınca 4 hamle");
      assert_eq!(hamle_sayisi(1, 1), 4, "hep yek de çifttir: 4 hamle");
  }
hints:
  - "`rand::random_range` bir aralık alır. Kapalı aralık (6 dahil) için `..=` kullan."
  - "`cift_adi`'da önce `a != b` ise `return None;` ile erken çık. Sonra `match a { 1 => Some(\"hep yek\"), ... }` yaz; `match`'in tüm olasılıkları kapsaması için sona `_ => None` ekle."
  - "`hamle_sayisi` tek bir `if` ifadesi: `if a == b { 4 } else { 2 }`."
require:
  - pattern: "rand::"
    message: "Zarı `rand` crate'iyle at (`rand::random_range`)."
explanation: |
  Çözümde rastgelelik yalnızca tek satırda yaşıyor: `rand::random_range(1..=6)`. Geri kalan her şey saf
  mantık; bu yüzden `cift_adi` ve `hamle_sayisi`'nı tüm olasılıklarıyla test edebildik. Rastgele kısmı ise
  **özellik (property)** testleriyle sınadık: tek tek değerleri değil, "her zaman aralıkta" ve "her yüz
  gelir" gibi her çalıştırmada doğru olması gereken özellikleri. (Bir yüzün 1000 atışta hiç gelmeme
  olasılığı yaklaşık 10⁻⁷⁹; pratikte sıfır.)

  `match a`'daki `_ => None` kolu neden gerekli? `u8` 0-255 arası değer alabilir ve `match` tüm
  olasılıkları kapsamak zorundadır (Modül 7, E0004). Fonksiyon 7-7 gibi geçersiz bir girdiye de makul
  bir cevap verir.

  Erken `return None;` yerine `match (a, b) { (1, 1) => ..., _ => None }` gibi bir tuple deseni de
  yazabilirdin; ikisi de deyimsel Rust'tır.
```

## regex: metinde desen aramak

**Düzenli ifade (regular expression, regex)**, metinde aranacak bir **deseni** tarif eden küçük bir
dildir: "beş rakam", "büyük harfle başlayan kelime", "gg.aa.yyyy biçiminde tarih"... Bu dili `regex`
crate'i konuşur. En sık kullanılan parçalar:

| Desen | Anlamı | Örnek eşleşme |
|---|---|---|
| `abc` | harfi harfine "abc" | `abc` |
| `[0-9]` | tek bir rakam | `7` |
| `[A-Z]`, `[a-zçğıöşü]` | tek bir büyük harf / küçük Türkçe harf | `K`, `ş` |
| `.` | satır sonu (`\n`) dışında herhangi bir karakter (`\.` ise gerçek nokta) | `x` |
| `+`, `*`, `?` | önceki parça: 1+ kez, 0+ kez, 0 ya da 1 kez | `[0-9]+` → `2025` |
| `{3}`, `{2,4}` | önceki parça: tam 3 kez, 2-4 kez | `[0-9]{3}` → `112` |
| `^`, `$` | metnin başı, metnin sonu | `^[0-9]+$` → yalnızca rakamlardan oluşan metin |
| `( )` | grup: parçayı yakala | `([0-9]+) TL` |
| `a\|b` | a ya da b | `kedi\|köpek` |

Desenleri Modül 1'de gördüğün **ham metin (raw string)** `r"..."` ile yazarsın; böylece `\.` gibi ters
eğik çizgiler Rust tarafından değil, regex tarafından yorumlanır.

```rust
use regex::Regex;

fn main() {
    // Desen bir kez derlenir, sonra defalarca kullanılır
    let posta_kodu = Regex::new(r"^[0-9]{5}$").unwrap();

    for aday in ["34710", "0612", "35000", "34 710"] {
        println!("{aday:>8} → {}", posta_kodu.is_match(aday));
    }

    // find: ilk eşleşme, Option<Match> döndürür
    let adres = "Kadıköy, 34710 İstanbul";
    let kod = Regex::new(r"[0-9]{5}").unwrap();
    match kod.find(adres) {
        Some(m) => println!("Posta kodu: {} (bayt konumu: {})", m.as_str(), m.start()),
        None => println!("Posta kodu yok"),
    }
}
```

- `Regex::new(...)` deseni derler. Desen hatalı olabileceği için sonuç doğrudan `Regex` değil, bir
  **`Result`**'tır; şimdilik `.unwrap()` ile açıyoruz (hatalı desende program panikler). `Result`'ı
  Modül 10'da ayrıntılı göreceğiz.
- `is_match` → `bool`; `find` → `Option<Match>` (Modül 7'deki `Option`!). `Match`'in `as_str()` ile
  eşleşen metni, `start()` ile başladığı bayt konumunu (0'dan sayılır) alırsın. Burada `start()` 9 değil
  **11** döner: `ı` ve `ö` UTF-8'de ikişer bayt tutar. Bu konum `&adres[11..]` gibi bir dilimlemede
  doğrudan kullanılabilir.
- `^...$` deseni **tüm metnin** desene uymasını ister. Onlar olmadan `[0-9]{5}` metnin **herhangi bir
  yerinde** beş rakam arar.

Gruplarla eşleşmenin parçalarını da yakalayabilirsin. Tahmin et:

```predict
code: |
  use regex::Regex;

  fn main() {
      let re = Regex::new(r"([0-9]+) TL").unwrap();
      let fis = "Çay 15 TL, simit 20 TL, poğaça 25TL";
      let mut toplam = 0;
      for c in re.captures_iter(fis) {
          let tutar: u32 = c[1].parse().unwrap();
          toplam += tutar;
          println!("{}", &c[0]);
      }
      println!("Toplam: {toplam}");
  }
options:
  - |
    15 TL
    20 TL
    Toplam: 35
  - |
    15 TL
    20 TL
    25TL
    Toplam: 60
  - |
    15
    20
    Toplam: 35
answer: 0
explanation: |
  Desen "bir ya da daha çok rakam, **bir boşluk**, TL" diyor. `25TL`'de boşluk olmadığı için eşleşmez.
  `captures_iter` her eşleşme için bir **yakalama** (`Captures`) verir: `c[0]` eşleşmenin tamamı
  (`"15 TL"`), `c[1]` birinci parantezli grup (`"15"`). Grubu `parse` ile sayıya çevirip topladık.

  Gerçek bir fiş ayrıştırıcısında `25TL`'yi de yakalamak isteyebilirsin: boşluğu isteğe bağlı yapan
  ` ?` ile desen `([0-9]+) ?TL` olurdu.
```

:::warning Deseni döngünün içinde derleme
`Regex::new` pahalıdır: deseni ayrıştırıp bir otomat (durum makinesi) kurar. Aynı deseni bir döngünün
içinde her turda yeniden derlersen program gereksiz yere yavaşlar. Deseni **bir kez** derle, sonra
istediğin kadar kullan; yukarıdaki örneklerde de öyle yaptık.
:::

:::deep Neden Rust'ın regex'i "her zaman hızlı"?
Python, JavaScript ve Java'nın regex motorlarının çoğu **geri izleme (backtracking)** ile çalışır. Bazı
desenler kötü girdilerde **üstel** sürede çalışır. 2 Temmuz 2019'da Cloudflare'in dünya çapındaki
servisleri, bir güvenlik duvarı kuralındaki tek bir regex yüzünden yaklaşık yarım saat çöktü: işlemciler
o tek deseni değerlendirmeye çalışırken %100'e kilitlendi. Rust'ın `regex` crate'i **doğrusal zaman**
garantisi verir: en kötü durumda bile süre desen boyutu × metin uzunluğu ile sınırlıdır; desen sabitken
arama süresi metnin uzunluğuyla orantılı büyür. Bedeli, geri başvuru (*backreference*, `\1`) ve çevreye
bakma (*lookaround*) gibi birkaç özelliğin olmamasıdır. Bu, Rust ekosisteminin tipik bir tercihidir: güvenliği
varsayılan yapmak.
:::

:::info `\d` yerine neden `[0-9]`?
Başka dillerde rakam için `\d` yazıldığını görmüş olabilirsin. `regex` crate'i de `\d`'yi destekler,
ancak bu, Unicode tablolarını içeren isteğe bağlı bir **özellik (feature)** ile gelir ve bu uygulamanın
çevrimiçi çalıştırıcısında o özellik kapalı (kelime sınırı `\b` ve `\w` için de aynısı geçerli). Bu
yüzden derslerde `[0-9]` kullanıyoruz; kendi projende varsayılan özelliklerle `\d` de çalışır. Yalnız
dikkat: `regex`'te `\d` varsayılan olarak Unicode'daki **bütün** rakamları eşler (ör. Arap-Hint rakamı
`٣`); yalnızca `0-9` istiyorsan `[0-9]` zaten daha kesin bir seçimdir. Özelliklere (features) bir
sonraki derste kısaca değineceğiz.
:::

Bir de Modül 5'ten bir soru. `find`'ın döndürdüğü `Match`, aranan metnin **içine bakan** bir referans
taşır:

```compiles
code: |
  use regex::Regex;

  fn main() {
      let re = Regex::new(r"[0-9]{5}").unwrap();
      let mut adres = String::from("Kadıköy, 34710 İstanbul");
      let kod = re.find(&adres);
      adres.push_str(", Türkiye");
      match kod {
          Some(m) => println!("Posta kodu: {}", m.as_str()),
          None => println!("Posta kodu yok"),
      }
  }
answer: false
error: E0502
explanation: |
  `re.find(&adres)` `adres`'i değişmez olarak ödünç alır ve dönen `Match` bu ödüncü taşır: `as_str()`
  eşleşmeyi kopyalamaz, `adres`'in içindeki baytları gösterir. `kod` daha sonra (`match`'te) kullanıldığı
  için ödünç o satıra kadar sürer. Arada `push_str` ile `adres`'i değiştirmek **E0502** verir: `String`
  büyürken başka bir yere taşınabilir ve `Match` boşluğu gösterirdi.

  Çözüm: `push_str`'ü `match`'ten sonraya al ya da eşleşmeyi önce kendi `String`'ine kopyala
  (`String::from(m.as_str())`). Dış crate'ler de aynı borrow checker kurallarına tabidir; güvenlik sözü
  ekosistemin tamamını kapsar.
```

Sıra sende. Gruplar ve `replace_all` ile tarih biçimini değiştir:

```fill
prompt: |
  Metindeki `gg.aa.yyyy` biçimli tarihleri `yyyy-aa-gg` biçimine çevir; ardından ilk tarihin **yılını**
  yazdır. Desende noktanın "herhangi bir karakter" değil **gerçek nokta** anlamına gelmesi gerektiğini
  unutma.
code: |
  use regex::Regex;

  fn main() {
      let re = Regex::new(r"([0-9]{2})___0([0-9]{2})\.([0-9]{4})").unwrap();
      let metin = "Sınav 15.03.2025, sonuç 02.04.2025 tarihinde.";
      let yeni = re.___1(metin, "$3-$2-$1");
      println!("{yeni}");
      if let Some(c) = re.captures(metin) {
          println!("İlk sınavın yılı: {}", &c[___2]);
      }
  }
blanks:
  - ['\.', '[.]']
  - ["replace_all"]
  - ["3"]
output: |
  Sınav 2025-03-15, sonuç 2025-04-02 tarihinde.
  İlk sınavın yılı: 2025
explanation: |
  - `\.` gerçek bir noktadır; yalnız `.` yazsaydın "herhangi bir karakter" olurdu ve `15-03.2025` gibi
    metinler de eşleşirdi.
  - `replace_all` her eşleşmeyi değiştirir (`replace` yalnızca ilkini). Değiştirme metninde `$1`, `$2`,
    `$3` yakalanan grupları temsil eder: gün, ay, yıl.
  - `captures` ilk eşleşmenin gruplarını `Option` içinde verir; `if let` ile açtık (Modül 7). Yıl üçüncü
    gruptur: `c[3]`.
```

## crates.io, docs.rs ve iyi crate seçmek

**crates.io**, Rust topluluğunun resmî paket kayıt merkezidir (*registry*): `cargo add` ve `cargo build`
crate'leri buradan indirir. 300.000'i aşkın crate barındırır. Bir crate sayfasında şunları görürsün:
toplam ve son 90 gündeki indirme sayısı, yayımlanmış bütün sürümler ve tarihleri, lisans, kaynak kodu
deposunun bağlantısı, bağımlılıkları ve ona bağımlı crate'ler.

**docs.rs** ise crates.io'ya yayımlanan **her crate'in her sürümünün** belgelerini otomatik olarak üretip
yayımlar. Belgeler, kodun içindeki `///` belge yorumlarından (Modül 1'de önizlemesini görmüştün) üretilir.
Bir crate'in belgesini okurken:

- Ana sayfadaki **örneklerle** başla; iyi crate'ler en sık kullanım senaryolarını orada gösterir.
- Sol üstteki **sürüm seçiciye** bak: projendeki sürümün belgesini okuduğundan emin ol (bkz.
  `thread_rng` hatası).
- **Structs / Functions / Traits** listelerinden aradığın öğeye in; her fonksiyonun imzası ve örneği vardır.
- **Feature flags** sekmesi isteğe bağlı özellikleri listeler.
- Kendi projenin bağımlılıklarının belgelerini çevrimdışı görmek için `cargo doc --open` yeterlidir.

Peki aynı işi yapan beş crate varsa hangisini seçmeli?

| Ölçüt | Neye bak? |
|---|---|
| Kullanım | İndirme sayısı, ona bağımlı crate sayısı |
| Bakım | Son sürümün tarihi, depodaki açık/kapanmış issue'lar |
| Belgeler | docs.rs'te örnekler var mı, her öğe açıklanmış mı? |
| Olgunluk | `1.0` ve üstü mü, yoksa API hâlâ değişen bir `0.x` mi? |
| Bağımlılıklar | Kaç geçişli bağımlılık getiriyor? Her biri derleme süresi ve risk demek. |
| Lisans | MIT / Apache-2.0 gibi projene uygun bir lisans mı? |

:::warning Tedarik zinciri güvenliği
Bir bağımlılık eklediğinde, başkasının kodunu kendi programının içine alırsın. 2022'de crates.io'da
popüler `rust_decimal` crate'inin adını taklit eden `rustdecimal` adlı **kötü amaçlı** bir crate
yakalandı (*typosquatting*: yazım hatasından faydalanma). Crate adını her zaman dikkatle yaz, beklediğin
yazarın crate'i olduğunu kontrol et ve az sayıda, iyi bilinen bağımlılığı tercih et. **RustSec**
veritabanı bilinen güvenlik açıklarını listeler; `cargo audit` aracı projeni bu listeye karşı tarar.
:::

```quiz
question: |
  Bir proje için metindeki e-posta adreslerini bulman gerekiyor. Hangi seçenek en sağlam yaklaşım?
options:
  - "crates.io'da \"email\" arayıp çıkan ilk crate'i `cargo add` ile eklemek"
  - "Zaten bağımlılık olarak bulunan, çok kullanılan, iyi belgelenmiş ve `1.x` sürümündeki `regex` ile bir desen yazmak; yeterli olmazsa adayları indirme sayısı, bakım, belgeler ve lisansa göre karşılaştırmak"
  - "Asla dış crate kullanmamak; her şeyi sıfırdan yazmak her zaman daha güvenlidir"
  - "En son güncellenmiş crate'i seçmek; yeni olan her zaman daha iyidir"
answer: 1
explanation: |
  İyi crate seçmek bir mühendislik kararıdır: önce elindeki araçların işi görüp görmediğine bak, sonra
  adayları somut ölçütlerle karşılaştır. Her bağımlılık bir güven ilişkisidir; sayılarını az, kalitelerini
  yüksek tut.
feedback:
  - İlk sonuç, adı en çok benzeyen sonuçtur; kaliteli olduğu anlamına gelmez. Typosquatting saldırıları tam da bu alışkanlıktan yararlanır.
  - Doğru!
  - "Kendi yazdığın kod da hata içerir; `regex` gibi yıllardır milyonlarca projede sınanmış bir crate çoğu zaman senin ilk denemenden daha güvenlidir. Amaç dengeyi bulmak."
  - Güncellik iyi bir işarettir ama tek başına yetmez; dün yayımlanmış, kimsenin kullanmadığı bir crate risklidir.
```

## Alıştırma: Plaka dedektifi

Öğrendiklerini birleştirme zamanı: bir trafik uygulaması için Türk plakalarını doğrulayan ve bir metnin
içinden bulan iki fonksiyon yazacaksın.

````exercise
id: m08-e-plaka
title: Plaka dedektifi
difficulty: 3
prompt: |
  Sadeleştirilmiş Türk plaka biçimi: `İL HARFLER RAKAMLAR`, aralarda **tek boşluk**.

  - **İl kodu:** iki rakam, `01` ile `81` arası (`00`, `82`, `99` geçersiz).
  - **Harfler:** 1-3 büyük harf (`A`-`Z`).
  - **Rakamlar:** 2-4 rakam.

  Örnekler: `"34 ABC 123"` ✓, `"06 A 1234"` ✓, `"00 AB 123"` ✗, `"34 abc 123"` ✗, `"34ABC123"` ✗.

  1. `plaka_gecerli_mi(plaka: &str) -> bool`: Metnin **tamamı** geçerli bir plakaysa `true`.
  2. `metindeki_plakalar(metin: &str) -> Vec<String>`: Metnin **içindeki** bütün plakaları bulunma
     sırasıyla döndürür.

  Bu uygulamada `\d` kapalı olduğu için rakamlar için `[0-9]` kullan.
starter: |
  use regex::Regex;

  pub fn plaka_gecerli_mi(plaka: &str) -> bool {
      todo!()
  }

  pub fn metindeki_plakalar(metin: &str) -> Vec<String> {
      todo!()
  }

  fn main() {
      println!("{}", plaka_gecerli_mi("34 ABC 123"));
      let tutanak = "Kavşakta 34 ABC 123 ve 06 A 1234 plakalı araçlar çarpıştı.";
      for p in metindeki_plakalar(tutanak) {
          println!("Bulunan plaka: {p}");
      }
  }
solution: |
  use regex::Regex;

  pub fn plaka_gecerli_mi(plaka: &str) -> bool {
      let re = Regex::new(r"^(0[1-9]|[1-7][0-9]|8[01]) [A-Z]{1,3} [0-9]{2,4}$").unwrap();
      re.is_match(plaka)
  }

  pub fn metindeki_plakalar(metin: &str) -> Vec<String> {
      let re = Regex::new(r"(0[1-9]|[1-7][0-9]|8[01]) [A-Z]{1,3} [0-9]{2,4}").unwrap();
      let mut bulunanlar = vec![];
      for m in re.find_iter(metin) {
          bulunanlar.push(String::from(m.as_str()));
      }
      bulunanlar
  }

  fn main() {
      println!("{}", plaka_gecerli_mi("34 ABC 123"));
      let tutanak = "Kavşakta 34 ABC 123 ve 06 A 1234 plakalı araçlar çarpıştı.";
      for p in metindeki_plakalar(tutanak) {
          println!("Bulunan plaka: {p}");
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_plakalar() {
      assert!(plaka_gecerli_mi("34 ABC 123"), "34 ABC 123 geçerli");
      assert!(plaka_gecerli_mi("06 A 1234"), "06 A 1234 geçerli (1 harf, 4 rakam)");
      assert!(plaka_gecerli_mi("81 ZZ 99"), "81 son il kodu, geçerli");
      assert!(plaka_gecerli_mi("01 B 12"), "01 ilk il kodu, geçerli");
  }

  #[test]
  fn gecersiz_il_kodlari() {
      assert!(!plaka_gecerli_mi("00 AB 123"), "00 diye bir il kodu yok");
      assert!(!plaka_gecerli_mi("82 AB 123"), "il kodu en fazla 81");
      assert!(!plaka_gecerli_mi("99 AB 123"), "99 diye bir il kodu yok");
      assert!(!plaka_gecerli_mi("6 AB 123"), "il kodu iki haneli olmalı (06)");
  }

  #[test]
  fn gecersiz_bicimler() {
      assert!(!plaka_gecerli_mi("34 abc 123"), "harfler büyük olmalı");
      assert!(!plaka_gecerli_mi("34ABC123"), "gruplar arasında boşluk olmalı");
      assert!(!plaka_gecerli_mi("34 ABCD 12"), "en fazla 3 harf");
      assert!(!plaka_gecerli_mi("34 AB 12345"), "en fazla 4 rakam (^ ve $ unutulmasın)");
      assert!(!plaka_gecerli_mi("34 AB 1"), "en az 2 rakam");
      assert!(!plaka_gecerli_mi("Plaka: 34 AB 123"), "metnin tamamı plaka olmalı");
      assert!(!plaka_gecerli_mi(""), "boş metin geçerli değil");
  }

  #[test]
  fn metinden_plaka_bulma() {
      let tutanak = "Kavşakta 34 ABC 123 ve 06 A 1234 plakalı araçlar çarpıştı.";
      assert_eq!(metindeki_plakalar(tutanak), vec!["34 ABC 123", "06 A 1234"], "iki plaka sırasıyla bulunmalı");
      assert_eq!(metindeki_plakalar("Bugün hiç kaza olmadı."), Vec::<String>::new(), "plaka yoksa boş liste");
      assert_eq!(metindeki_plakalar("Hatalı kayıt: 99 XX 11, 35 KS 789"), vec!["35 KS 789"], "geçersiz il kodlu plaka atlanmalı");
  }
hints:
  - |
    Deseni üç parçada düşün: il kodu, harfler, rakamlar. Harfler `[A-Z]{1,3}`, rakamlar `[0-9]{2,4}`.
    Aralardaki boşlukları desene harfi harfine yaz.
  - |
    İl kodu için üç seçeneği `|` ile birleştir ve gruba al: `01`-`09` → `0[1-9]`, `10`-`79` →
    `[1-7][0-9]`, `80`-`81` → `8[01]`. Doğrulama deseninin başına `^`, sonuna `$` koy; arama
    deseninde bunlar olmamalı.
  - |
    `metindeki_plakalar`: `let mut bulunanlar = vec![];` ile başla, `for m in re.find_iter(metin)`
    döngüsünde `bulunanlar.push(String::from(m.as_str()));` yap ve sonunda `bulunanlar`'ı döndür.
require:
  - pattern: "Regex::new"
    message: "Bu alıştırmayı `regex` crate'iyle çöz (`Regex::new`)."
explanation: |
  İki fonksiyonun deseni neredeyse aynı; tek fark `^` ve `$`. Doğrulamada "metnin **tamamı** desene uysun"
  istiyoruz, aramada ise "metnin **herhangi bir yerinde** desen geçsin". `^`/`$` unutulsaydı
  `"34 AB 12345"` metnindeki `"34 AB 1234"` parçası eşleşir ve geçersiz plaka kabul edilirdi.

  İl kodunu (`0[1-9]|[1-7][0-9]|8[01]`) regex ile sınırlamak biraz zahmetli. Alternatif: `([0-9]{2})`
  ile yakalayıp `c[1].parse::<u32>()` sonucunu `1..=81` aralığında kontrol etmek. Sayısal kurallar
  karmaşıklaştıkça bu yöntem daha okunaklıdır.

  Sınırlamalar: arama deseni kelime sınırlarına bakmaz; `"134 AB 12"` gibi bir metinde `"34 AB 12"`'yi
  bulur. Gerçek bir uygulamada desenin iki ucuna kelime sınırı (`\b`) eklenirdi; `\b` de `\d` gibi
  Unicode özelliği ister ve bu uygulamada kapalıdır (yalnızca ASCII'ye bakan `(?-u:\b)` biçimi burada da
  çalışır). Bir de performans: fonksiyon her
  çağrıldığında deseni yeniden derliyor. Sık çağrılan bir fonksiyonda deseni bir kez derleyip saklamak
  gerekir; bunun deyimsel yolunu (`std::sync::LazyLock`) Modül 18'de göreceksin.
````

## Özet

:::remember
- `std` küçüktür, çünkü sonsuza dek kırılmama sözü verir. Rastgele sayı, regex, JSON gibi işler için
  crates.io'daki crate'ler kullanılır.
- Bağımlılık `Cargo.toml`'da `[dependencies]` altına yazılır: `rand = "0.10"` ya da `cargo add rand`.
  İlk `cargo build` crate'i ve geçişli bağımlılıklarını indirip derler.
- Crate adı yolun köküdür: `rand::random_range(1..=6)`. Crate adları (**extern prelude**) her modülde
  geçerlidir. Adındaki tire kodda alt çizgi olur. Ekli olmayan crate → **E0432/E0433** ve
  `cargo add` önerisi.
- `std` de bir crate'tir (`core` + `alloc` üstüne kurulu bir vitrin).
- `rand`: `random_range`, `random`, `random_bool`. Rastgeleliği ince bir katmanda tut, mantığı saf
  fonksiyonlara ayır.
- `regex`: `Regex::new(r"...")` bir kez derle; `is_match`, `find` (`Option<Match>`), `find_iter`,
  `captures` (`c[0]`, `c[1]`), `replace_all` (`$1`).
- Belgeler docs.rs'te, **sürüme dikkat**. Crate seçerken kullanım, bakım, belgeler, olgunluk,
  bağımlılık sayısı ve lisansa bak; adı dikkatle yaz.
:::

```reflect
prompt: |
  Rust'ın standart kütüphanesi neden rastgele sayı üretimi ya da regex gibi yaygın ihtiyaçları
  içermiyor? Bu kararın bir avantajını ve bir dezavantajını açıkla.
answer: |
  Model cevap: `std`'ye giren her şey sonsuza kadar geriye dönük uyumlu kalmak zorundadır; kötü bir
  tasarım bir kez girerse bir daha çıkarılamaz. Rastgele sayı ve regex gibi alanlarda en iyi tasarım
  zamanla değişebildiği için bunlar crate olarak kalır. **Avantajı:** crate'ler bağımsız sürümlenir ve
  gelişebilir (`rand`'ın API'si birkaç kez iyileşti), eski sürümü kullanan projeler ise bozulmaz;
  `std` de küçük ve çok güvenilir kalır. **Dezavantajı:** basit bir program için bile bağımlılık eklemem,
  hangi crate'in kaliteli olduğunu araştırmam ve başkasının koduna güvenmem gerekir; bu da derleme
  süresini ve tedarik zinciri riskini artırır.
```

```flashcards
- front: Bir projeye `rand` crate'ini eklemenin iki yolu nedir?
  back: "`Cargo.toml`'da `[dependencies]` altına `rand = \"0.10\"` yazmak ya da terminalde `cargo add rand` çalıştırmak."
- front: Rust'ın standart kütüphanesi neden küçük tutulur?
  back: "`std` sonsuza kadar geriye dönük uyumluluk sözü verir; giren hiçbir şey kaldırılamaz. Tasarımı zamanla değişebilecek alanlar crate olarak kalır."
- front: "`rand::random_range(1..6)` hangi değerleri üretebilir?"
  back: "1, 2, 3, 4, 5, `..` aralığı üst sınırı **içermez**. Zar için `1..=6` gerekir."
- front: Kodda kullandığın bir crate `Cargo.toml`'da yoksa hangi hatayı alırsın?
  back: "E0433 (yolda) ya da E0432 (`use`'da): use of unresolved module or unlinked crate, `cargo add` önerisiyle."
- front: "`Cargo.toml`'daki `chrono-tz` crate'i kodda nasıl yazılır?"
  back: "`chrono_tz::...`, crate adındaki tireler kodda alt çizgiye dönüşür."
- front: "regex'te `[0-9]{5}` ile `^[0-9]{5}$` arasındaki fark nedir?"
  back: "İlki metnin **herhangi bir yerinde** beş rakam arar; ikincisi metnin **tamamının** tam beş rakam olmasını ister."
- front: "`re.captures(metin)` sonucunda `c[0]` ve `c[1]` neyi verir?"
  back: "`c[0]` eşleşmenin tamamını, `c[1]` birinci parantezli grubu."
- front: Bir crate'in belgelerini okurken docs.rs'te ilk neyi kontrol etmelisin?
  back: "Sürüm seçiciyi: projendeki sürümün belgesine baktığından emin ol (ör. `rand` 0.8 ile 0.10'un API'si farklı)."
```
