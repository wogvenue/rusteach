---
title: "Özet Kartı: Modüller, Paketler ve Crate'ler"
---

# Modüller, Paketler ve Crate'ler: Özet Kartı

## Üç katman

| Katman | Nedir? | Kim ilgilenir? | Örnek |
|---|---|---|---|
| **Paket** | `Cargo.toml` + bir ya da daha çok crate | Cargo | `cargo new oyun` |
| **Crate** | Derleme birimi; bir modül ağacının tamamı | `rustc` | kökü `src/main.rs` (binary) ya da `src/lib.rs` (library) |
| **Modül** | Crate içinde isim alanı + gizlilik sınırı | sen (`mod`) | `mod mutfak { ... }` |

- Pakette **en fazla bir** library crate, istediğin kadar binary crate (`src/main.rs`, `src/bin/*.rs`).
- Ağacın kökü `crate` adlı örtük modüldür. Aynı modülde aynı ad iki kez → `E0428`.
- Binary crate'te `main` zorunlu (`E0601`); library crate'in giriş noktası yoktur, `main` gerekmez.

## Gizlilik

```rust
mod banka {
    pub struct Hesap {
        pub sahip: String, // alan alan açılır
        bakiye: u64,       // gizli → dışarıdan Hesap { .. } yazılamaz (E0451)
    }

    impl Hesap {
        pub fn yeni(sahip: &str) -> Hesap {
            Hesap { sahip: String::from(sahip), bakiye: 0 } // kurucu değişmez koşulu korur
        }

        pub fn bakiye(&self) -> u64 {
            self.bakiye
        }
    }

    pub enum Tur {
        Vadesiz, // pub enum → bütün varyantlar açık
        Vadeli,
    }
}

fn main() {
    let h = banka::Hesap::yeni("Zeynep");
    for t in [banka::Tur::Vadesiz, banka::Tur::Vadeli] {
        let tur = match t {
            banka::Tur::Vadesiz => "vadesiz",
            banka::Tur::Vadeli => "vadeli",
        };
        println!("{} ({tur}): {}", h.sahip, h.bakiye());
    }
}
```

- Her şey **varsayılan olarak gizli**. Gizli bir öğeyi kendi modülü ve onun **alt modülleri** görür
  (içeriden dışarıya). Kardeş ve üst modüller göremez.
- `pub` bir öğe, **içinde durduğu modülü görebilen her yerden** görünür; yani `pub` yalnızca bir kapıyı
  açar, yol üzerindeki her modül de görünür olmalı.
- `pub struct` alanları tek tek açılır; `pub enum` varyantları topluca açılır.
- `pub(crate)`: bu crate'in her yerine açık · `pub(super)`: üst modüle (ve onun alt modüllerine) açık ·
  `pub(in crate::a)`: belirtilen ata modüle açık. Binary crate'te `pub` ile `pub(crate)` pratikte aynıdır.

## Yollar

| Yol | Nereden başlar? | Örnek |
|---|---|---|
| `crate::a::b` | crate kökünden (mutlak) | `crate::restoran::mutfak::pisir()` |
| `a::b` | bulunulan modülden (göreli) | `mutfak::pisir()` |
| `self::a` | bulunulan modülden (açık) | `self::yardimci()` |
| `super::a` | bir üst modülden | `super::menu::fiyat("ayran")` |
| `rand::...`, `std::...` | dış crate'ten (her modülde geçerli) | `std::cmp::max(a, b)` |

- Modüller üst modülün adlarını kapsamlarına **devralmaz** (erişebilirler ama kendiliğinden bulamazlar):
  kardeşe `super::kardes` ya da `crate::...` ile gidilir.
- `::` yollar için, `.` değerin alanı/metodu için.

## use, as, pub use

```rust,ignore
use crate::restoran::mutfak::firin;   // fonksiyonlar için: üst modülü getir → firin::pisir()
use std::collections::HashMap;        // tipler için: öğenin kendisini getir → HashMap::new()
use kitap::Kayit as KitapKaydi;       // ad çakışmasında takma ad (yoksa E0252 / E0255)
use std::cmp::{max, min};             // iç içe yol
use okul::notlar::{self, Karne};      // self = notlar modülünün kendisi
use super::*;                         // glob: testlerde ve prelude'lerde
pub use katalog::kitap::Kitap;        // vitrin: dışarıdan kutuphane::Kitap olarak görünür
```

- `use` derleme zamanında bir **kısayol**dur; yalnızca yazıldığı modülde (ya da blokta) geçerlidir.
- Glob (`*`) erişebildiğin bütün öğeleri getirir (dışarıdan yalnızca `pub` olanları, `use super::*` ile
  alt modülden gizlileri de). Glob'la gelen adı yerel tanım ya da açık `use` **sessizce gölgeler**; iki
  glob aynı adı getirirse, ad kullanıldığında `E0659`.
- `pub use` iç modüller gizliyken sade bir dış API kurar; iç düzen değişse de kullanıcı kodu kırılmaz.
  Göremediğin bir öğe vitrine konamaz (`E0603`); bir öğe kendi görünürlüğünden daha geniş de açılamaz
  (`pub(crate) fn` → `pub use` = `E0364`).
- **Prelude:** `String`, `Vec`, `Option`, `Some`, `None`, `Result`... her modülde kendiliğinden kullanılır.
  En düşük öncelikli kapsamdır: aynı adlı kendi tanımın (ya da glob'la gelen bir ad) onu gölgeler.

## Modülleri dosyalara bölmek

```text
src/
├── lib.rs          pub mod oyun;   (modüller burada bildirilir)
├── main.rs         use paket_adi::oyun::...;   (kütüphaneyi paket adıyla kullanır)
├── oyun.rs         pub mod harita;           → crate::oyun
└── oyun/
    └── harita.rs                             → crate::oyun::harita
```

- `mod ad;` = "gövde başka dosyada": `ad.rs` ya da `ad/mod.rs`. Bulunamazsa `E0583`; ikisi birden
  varsa `E0761`.
- Alt modüller, üst modülün adını taşıyan klasörde durur. Dosyanın içine `mod ad { }` sarmalayıcısı
  **yazılmaz**.
- Modül ağacını `mod` satırları kurar: ağaca bağlanmayan dosya **derlenmez**.
- Her modül **bir kez** bildirilir (`mod`); başka yerlerden `use crate::...` ile kullanılır.
- `main.rs` modülleri yeniden bildirmez; kütüphane onun için ayrı bir crate'tir (yalnızca `pub` görünür,
  `pub(crate)` görünmez). Paket adındaki `-` kodda `_` olur.

## Dış crate'ler

```toml
[dependencies]
rand = "0.10"                                        # ya da: cargo add rand
regex = "1.13"
serde = { version = "1", features = ["derive"] }     # özellik açmak

[dev-dependencies]
pretty_assertions = "1"                              # yalnızca test/örnek derlemelerinde
```

```rust,ignore
let zar: u32 = rand::random_range(1..=6);            // ..= dahil, .. hariç
let tura = rand::random_bool(0.5);

let re = regex::Regex::new(r"([0-9]{2})\.([0-9]{2})\.([0-9]{4})").unwrap(); // bir kez derle
re.is_match(metin);                                  // bool
re.find(metin);                                      // Option<Match> → m.as_str(), m.start()
for m in re.find_iter(metin) { /* ... */ }
if let Some(c) = re.captures(metin) { let yil = &c[3]; } // c[0] tamamı; c.get(i) → Option
re.replace_all(metin, "$3-$2-$1");
```

- `std` küçüktür çünkü **sonsuza dek** kırılmama sözü verir. O da bir crate'tir: büyük kısmı `core` ve
  `alloc`'tan `pub use` ile gelir, üstüne işletim sistemine dayanan kısımlar (dosya, ağ, thread) eklenir.
- Ekli olmayan crate → `E0433` / `E0432` ve `cargo add` önerisi.
- Belgeler **docs.rs**'te: önce **sürümü** kontrol et (`rand` 0.8 ↔ 0.10 farklı API).
- Crate seçimi: kullanım, bakım, belgeler, `1.x` olgunluğu, bağımlılık sayısı, lisans. Adı dikkatle yaz
  (typosquatting); `cargo audit` ile bilinen açıkları tara.
- Rastgeleliği ince bir katmanda tut; mantığı saf, test edilebilir fonksiyonlara ayır.

## Semver ve Cargo.lock

| Gereksinim | İzin verilen aralık |
|---|---|
| `"1.2.3"` = `"^1.2.3"` | `>= 1.2.3, < 2.0.0` |
| `"0.10"` | `>= 0.10.0, < 0.11.0` (`0.x`'te MINOR kırar) |
| `"0.0.3"` | `>= 0.0.3, < 0.0.4` (her sürüm kırar) |
| `"~1.2.3"` | `>= 1.2.3, < 1.3.0` |
| `"=1.2.3"` | yalnızca `1.2.3` |

- `MAJOR.MINOR.PATCH`: PATCH düzeltme, MINOR uyumlu yenilik, MAJOR **kırıcı**. Cargo aralıktaki en yeni
  sürümü seçer. Sürümleri metin değil sayı olarak karşılaştır (metin olarak `"1.10" < "1.9"` çıkar!).
- Kırıcı değişiklikler: `pub` öğe silmek/yeniden adlandırmak, parametre eklemek, `pub` enum'a varyant
  (`E0004`), tamamen `pub` struct'a alan (`E0063`). Gizli alanlar kütüphaneye değişme özgürlüğü verir.
- `Cargo.lock`: tüm ağacın **tam** sürümleri + checksum'lar → tekrarlanabilir derleme. Git'e eklenir,
  elle düzenlenmez. `cargo update [-p crate]` aralık içinde günceller. Kütüphane bağımlılık olunca
  onun `Cargo.lock`'u yok sayılır.
- Uyumsuz iki sürüm gerekirse ikisi de derlenir (tipleri farklıdır): `cargo tree -d`.
- Özellikler toplanır (additive); kod tarafında `#[cfg(feature = "ad")]`.

## Sık hatalar

| Hata | Ne oldu? | Çözüm |
|---|---|---|
| `E0603` | gizli öğeye (ya da gizli modül üzerinden) erişim | `pub` yap ya da vitrinden (`pub use`) aç |
| `E0451` | dışarıdan gizli alanlı struct kurma | modül içinde kurucu (`yeni`) sun |
| `E0616` | dışarıdan gizli alanı okuma ya da yazma | getter/metot (`fn bakiye(&self)`, `fn yukle(&mut self, ..)`) |
| `E0624` | gizli metot ya da ilişkili fonksiyon çağrısı | metodu `pub` yap |
| `E0425` / `E0433` | yol bulunamadı (kardeşe göreli yol, eksik `use`, ekli olmayan crate) | `super::`, `crate::`, `use` ya da `cargo add` |
| `E0432` | `use` satırındaki yol yanlış | yazımı ve ağacı kontrol et |
| `E0252` | aynı ad iki kez `use` edildi | `as` ile takma ad ya da üst modülü getir |
| `E0255` | `use` edilen ad aynı modüldeki bir tanımla çakışıyor | `as` ile takma ad |
| `E0364` | `pub use` öğeyi kendi görünürlüğünden geniş açıyor | öğeyi `pub` yap ya da vitrini daralt (`pub(crate) use`) |
| `E0659` | iki glob aynı adı getiriyor | adı açıkça `use` et |
| `E0583` | `mod ad;` için dosya yok, ya da `use` yerine `mod` yazıldı | dosyayı oluştur / `use crate::...` |
| `E0761` | hem `ad.rs` hem `ad/mod.rs` var | birini sil |
| `E0428` | aynı modülde aynı ad iki kez | farklı modüllere ayır ya da yeniden adlandır |
