---
id: m13-l03
title: Birim ve Entegrasyon Testleri
minutes: 22
type: lesson
objectives:
  - Birim testi ile entegrasyon testi arasındaki farkı konum, erişim ve amaç açısından açıklayabilmek
  - "`tests/` dizininde, kütüphaneyi yalnızca `pub` API'si üzerinden kullanan bir entegrasyon testi dosyası kurabilmek"
  - "Ortak test yardımcılarını `tests/common/mod.rs` ile paylaşabilmek ve bunun neden `tests/common.rs` olmadığını açıklayabilmek"
  - "Binary bir projeyi test edilebilir kılmak için mantığı `src/lib.rs`'e taşıma gerekçesini açıklayabilmek"
keywords: [birim testi, entegrasyon testi, unit test, integration test, "tests/", common, lib.rs, pub API]
---

Bir otomobil fabrikası düşün. Motorun her parçası — pistonlar, supaplar, bujiler — üretim bandında tek tek
ölçülür ve test edilir. Ama bütün parçaların kusursuz olması, arabanın **yola çıktığında** çalışacağını
garanti etmez: parçalar birbirine uyuyor mu, direksiyon gerçekten tekerlekleri çeviriyor mu?

Yazılımda da iki soru var: *"Her parça kendi başına doğru mu?"* ve *"Parçalar birlikte, dışarıdan kullanıldığı
şekliyle doğru mu?"* Rust bu iki soruyu iki ayrı test türüyle yanıtlar ve Cargo ikisini de ayrı yerlerde
bekler.

## İki tür test, iki bakış açısı

Şimdiye kadar yazdığın her test bir **birim testi (unit test)** idi: kodun hemen yanında, `#[cfg(test)]`
modülünün içinde, tek bir fonksiyonu yalıtılmış olarak sınayan testler. Rust'ın ikinci test türü
**entegrasyon testi (integration test)**: kütüphaneni **dışarıdan**, tıpkı onu `Cargo.toml`'una ekleyen
yabancı bir programcı gibi kullanan testler.

| | birim testi | entegrasyon testi |
|---|---|---|
| nerede? | `src/` içinde, genellikle test ettiği kodla **aynı dosyada** | Paket kökündeki **`tests/`** dizininde, ayrı dosyalarda |
| ne görür? | Her şeyi — özel (private) fonksiyonlar dahil | Sadece kütüphanenin **`pub`** API'sini |
| crate | Test ettiği crate'in bir parçası (`mod tests`) | **Her dosya ayrı bir crate** |
| `#[cfg(test)]`? | Gerekli | Gereksiz — Cargo bu dosyaları zaten sadece `cargo test`'te derler |
| sorduğu soru | "Bu parça doğru mu?" | "Kütüphane, kullanıcının kullandığı şekliyle doğru mu?" |
| hız ve sayı | Çok sayıda, çok hızlı | Daha az, daha geniş kapsamlı |

:::analogy Tezgâh testi ve yol testi
Birim testi, motor parçasının **tezgâhta** ölçülmesidir: parçayı söker, içine bakar, tek başına zorlarsın.
Entegrasyon testi ise **test sürüşüdür**: kaputu açmazsın, sadece direksiyon, pedallar ve vites gibi
sürücünün kullandığı arayüzle (`pub` API) arabayı yola çıkarırsın. İkisi birbirinin yerini tutmaz:
tezgâhta kusursuz bir piston, yanlış takılmışsa yolda arabayı durdurur; yol testi ise sorunun
**hangi parçada** olduğunu söyleyemez.
:::

Python'daki `pytest`, Java'daki JUnit gibi çerçevelerde bu ayrım bir **gelenek**tir; dosyaları nereye
koyacağına sen karar verirsin. Rust'ta ise ayrım **dil ve Cargo düzeyinde** zorunludur: entegrasyon testi
gerçekten ayrı bir crate olduğu için, `pub` olmayan bir şeye dokunması **derleyici tarafından** engellenir.

```quiz
question: Hangi durum bir **entegrasyon testi** ile daha iyi sınanır?
options:
  - Özel `desi_hesapla` yardımcı fonksiyonunun yuvarlamayı doğru yapması
  - Bir kullanıcının `Gonderi::yeni(...)` ile paket oluşturup `ucret(&gonderi)` ile fiyat alabilmesi — tüm akışın dışarıdan çalışması
  - "`pub` olmayan bir struct alanının başlangıç değeri"
  - Bir `match` kolunun belirli bir sınır değerinde doğru dalı seçmesi
answer: 1
explanation: |
  Entegrasyon testi kütüphaneyi **kullanıcının gözünden** sınar: oluştur → hesapla → sonucu kontrol et.
  Özel fonksiyonlar ve alanlar entegrasyon testinden zaten **görünmez**; onlar birim testlerinin işidir.
  Belirli bir dalın sınır davranışı da tek bir fonksiyona odaklandığı için birim testine daha uygundur.
feedback:
  - Özel bir fonksiyon entegrasyon testinden görünmez; bu bir birim testi işi.
  - Doğru! Dış API üzerinden uçtan uca akış = entegrasyon testi.
  - Özel alanlar sadece birim testlerinden erişilebilir.
  - Tek fonksiyonun ayrıntısı birim testine uygundur.
```

## `tests/` dizini

Bir kargo ücreti kütüphanesi yazdığımızı düşünelim. Paket düzeni:

```text
kargo/
├── Cargo.toml
├── src/
│   └── lib.rs              ← kütüphane + birim testleri
└── tests/
    └── fiyat_testleri.rs   ← entegrasyon testi (ayrı bir crate)
```

```rust,title=src/lib.rs
pub struct Gonderi {
    agirlik_kg: u32,
    en_cm: u32,
    boy_cm: u32,
    yukseklik_cm: u32,
}

impl Gonderi {
    pub fn yeni(agirlik_kg: u32, en_cm: u32, boy_cm: u32, yukseklik_cm: u32) -> Gonderi {
        Gonderi { agirlik_kg, en_cm, boy_cm, yukseklik_cm }
    }
}

// Hacimsel ağırlık: kargo şirketleri büyük ama hafif paketleri böyle ücretlendirir.
fn desi(g: &Gonderi) -> u32 {
    let d = g.en_cm * g.boy_cm * g.yukseklik_cm / 3000;
    if d == 0 { 1 } else { d }
}

// Ücret = 40 TL + (desi ile kilodan büyük olanı) × 8 TL
pub fn ucret(g: &Gonderi) -> u32 {
    let d = desi(g);
    let ucretli = if d > g.agirlik_kg { d } else { g.agirlik_kg };
    40 + ucretli * 8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desi_hacimden_hesaplanir() {
        let g = Gonderi::yeni(1, 30, 40, 50); // 60 000 cm³ / 3000
        assert_eq!(desi(&g), 20);
    }

    #[test]
    fn kucuk_paket_en_az_bir_desi() {
        let g = Gonderi::yeni(1, 5, 5, 5);
        assert_eq!(desi(&g), 1, "desi asla 0 olmamalı");
    }
}
#
# fn main() {
#     println!("{} TL", ucret(&Gonderi::yeni(2, 30, 40, 50)));
#     println!("{} TL", ucret(&Gonderi::yeni(10, 20, 10, 10)));
# }
```

Birim testleri özel `desi` fonksiyonunu doğrudan sınıyor. Entegrasyon testi ise başka bir dosyada,
kütüphaneyi **adıyla** içe aktararak yazılır:

```rust,ignore,title=tests/fiyat_testleri.rs
use kargo::{ucret, Gonderi};

#[test]
fn hafif_ama_buyuk_paket_desiden_ucretlenir() {
    let yastik = Gonderi::yeni(2, 30, 40, 50); // 20 desi > 2 kg
    assert_eq!(ucret(&yastik), 40 + 20 * 8);
}

#[test]
fn agir_ama_kucuk_paket_kilodan_ucretlenir() {
    let dambil = Gonderi::yeni(10, 20, 10, 10); // 0 → 1 desi < 10 kg
    assert_eq!(ucret(&dambil), 40 + 10 * 8);
}
```

Üç farka dikkat et: dosyada **`mod tests` yok**, **`#[cfg(test)]` yok** ve kütüphane `use kargo::...` ile,
yani **dış bir crate gibi** içe aktarılıyor. (Paket adında tire varsa, örneğin `kargo-hesap`, crate adı alt
çizgiyle yazılır: `use kargo_hesap::...`.)

:::warning Kütüphanedeki `#[cfg(test)]` öğeleri entegrasyon testine görünmez
Entegrasyon testi derlenirken kütüphane, sıradan bir bağımlılık gibi **`cfg(test)` kapalı** derlenir;
`cfg(test)` yalnızca o an test olarak derlenen crate için açıktır. Bu yüzden `src/lib.rs`'e
`#[cfg(test)] pub fn ornek_gonderi()` gibi bir yardımcı koyup `tests/` içinden çağırmaya çalışırsan
`unresolved import` / `cannot find function` hatası alırsın. Entegrasyon testlerinin yardımcıları
`tests/` dizininde yaşar (birazdan göreceğimiz `tests/common/mod.rs`).
:::

`cargo test` artık **üç bölüm** çalıştırır:

```console
$ cargo test
   Compiling kargo v0.1.0 (C:\projeler\kargo)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.71s
     Running unittests src/lib.rs (target\debug\deps\kargo-3f1e6a0c2b9d4e57.exe)

running 2 tests
test tests::desi_hacimden_hesaplanir ... ok
test tests::kucuk_paket_en_az_bir_desi ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests\fiyat_testleri.rs (target\debug\deps\fiyat_testleri-8a2c4d6e0f1b3a59.exe)

running 2 tests
test agir_ama_kucuk_paket_kilodan_ucretlenir ... ok
test hafif_ama_buyuk_paket_desiden_ucretlenir ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests kargo

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

Entegrasyon testlerinin adlarında `tests::` öneki yok: her dosya kendi crate'inin köküdür. Bir bölüm
kalırsa Cargo **sonraki bölümleri çalıştırmaz** — birim testleri kalırsa entegrasyon testlerini görmezsin.
Mantıklı: parçalar bozuksa yol testine çıkmanın anlamı yok. (Yine de hepsini görmek istersen:
`cargo test --no-fail-fast`.)

| komut | ne çalışır? |
|---|---|
| `cargo test --lib` | Sadece `src/lib.rs`'teki birim testleri |
| `cargo test --test fiyat_testleri` | Sadece `tests/fiyat_testleri.rs` |
| `cargo test --tests` | Birim + bütün entegrasyon testleri (doc testleri hariç) |
| `cargo test ucret` | Her bölümde adında `ucret` geçen testler |

```quiz
question: |
  Bir paketin `tests/` dizininde `odeme.rs`, `iade.rs` ve `yardimci.rs` adlı üç dosya var; `src/lib.rs`'te de
  birim testleri var. `cargo test` çıktısında kaç tane `Running ...` satırı görürsün?
options:
  - "1 — bütün testler tek programda toplanır"
  - "2 — biri birim testleri, biri bütün `tests/` dizini için"
  - "4 — biri `src/lib.rs`, üçü `tests/` dizinindeki her dosya için"
  - "3 — `yardimci.rs` test içermediği için sayılmaz"
answer: 2
explanation: |
  `tests/` dizininin **doğrudan içindeki her `.rs` dosyası** ayrı bir crate olarak derlenir ve ayrı bir
  `Running tests\....rs` bölümü üretir — içinde hiç test olmasa bile. `yardimci.rs` için de bir bölüm
  açılır ve `running 0 tests` yazar. Bu, "Ortak yardımcılar" bölümünde çözeceğimiz küçük bir rahatsızlığın kaynağıdır.
  (Bunlara ek olarak en sonda bir de `Doc-tests` bölümü vardır.)
feedback:
  - Her entegrasyon test dosyası ayrı bir programdır.
  - Dizin değil, dosya başına bir crate oluşur.
  - Doğru! 1 birim + 3 entegrasyon dosyası.
  - Test içermese de `tests/` kökündeki her dosya bir crate'tir.
```

## Sadece `pub` API: dışarıdan bakmak

Uygulama içindeki kod blokları tek dosyadan oluşur, `tests/` dizini kuramayız. Ama entegrasyon testinin
özünü — **sadece `pub` olanı görmek** — tek dosyada bir modülle birebir taklit edebiliriz. Modül 8'den
hatırla: bir modülün dışındaki kod, o modülün yalnızca `pub` öğelerine erişebilir.

```compiles
code: |
  mod kargo {
      pub struct Gonderi {
          pub agirlik_kg: u32,
      }

      fn taban_ucret() -> u32 {
          40
      }

      pub fn ucret(g: &Gonderi) -> u32 {
          taban_ucret() + g.agirlik_kg * 8
      }
  }

  fn main() {
      let g = kargo::Gonderi { agirlik_kg: 3 };
      println!("{}", kargo::ucret(&g));
      println!("{}", kargo::taban_ucret());
  }
answer: false
error: E0603
explanation: |
  `main`, `kargo` modülünün **dışında**dır — tıpkı bir entegrasyon testinin kütüphanenin dışında olması gibi.
  `Gonderi`, `agirlik_kg` alanı ve `ucret` `pub` olduğu için sorun yok; ama `taban_ucret` özeldir:
  ``error[E0603]: function `taban_ucret` is private``. Gerçek bir entegrasyon testinde de aynı hatayı
  alırdın. Entegrasyon testleri bu yüzden **sözleşmeyi** sınar: kullanıcının erişebildiği her şey ve sadece o.
```

Bu kısıtlama bir eksiklik değil, bir **özelliktir**. Entegrasyon testleri yalnızca `pub` API'ye bağlı olduğu
için, kütüphanenin **içini** istediğin gibi yeniden düzenleyebilirsin: `desi` fonksiyonunu ikiye bölebilir,
adını değiştirebilir, silebilirsin. Dış davranış aynı kaldıkça entegrasyon testleri yeşil kalır. Birim
testleri ise iç ayrıntılara bağlı oldukları için böyle bir değişiklikte güncellenmek zorunda kalabilir.

Şimdi tek dosyada, bir modülün hem içinden (birim testi) hem dışından (entegrasyon tarzı) kullanıldığı tam bir
örnek. `main` burada bir "dış kullanıcı" rolünde:

```rust
mod kargo {
    pub struct Gonderi {
        agirlik_kg: u32, // alanlar gizli: dışarıdan sadece kurucu ile oluşturulur
        desi: u32,
    }

    impl Gonderi {
        pub fn yeni(agirlik_kg: u32, desi: u32) -> Gonderi {
            Gonderi { agirlik_kg, desi }
        }
    }

    fn ucretli_agirlik(g: &Gonderi) -> u32 {
        if g.desi > g.agirlik_kg { g.desi } else { g.agirlik_kg }
    }

    pub fn ucret(g: &Gonderi) -> u32 {
        40 + ucretli_agirlik(g) * 8
    }

    #[cfg(test)]
    mod tests {
        use super::*; // içeriden: özel `ucretli_agirlik` görünür

        #[test]
        fn buyuk_olan_secilir() {
            assert_eq!(ucretli_agirlik(&Gonderi::yeni(2, 20)), 20);
        }
    }
}

fn main() {
    // dışarıdan: sadece pub olanlar
    let yastik = kargo::Gonderi::yeni(2, 20);
    let dambil = kargo::Gonderi::yeni(10, 1);
    println!("Yastık: {} TL", kargo::ucret(&yastik));
    println!("Dambıl: {} TL", kargo::ucret(&dambil));
}
```

:::info Uygulamadaki alıştırmalar da böyle çalışır
"Kontrol et" düğmesinin eklediği gizli testler, kodunun **en dış** seviyesine bir `mod rusteach_tests` olarak
eklenir. Kodun bir modül içeriyorsa, gizli testler o modülü tıpkı bir entegrasyon testi gibi **dışarıdan**
görür: sadece `pub` olanlara erişebilir. Bu dersin alıştırmasında bundan yararlanacağız.
:::

## Ortak yardımcılar: `tests/common/mod.rs`

Entegrasyon test dosyaları çoğaldıkça aynı hazırlık kodunu tekrar tekrar yazmaya başlarsın: "örnek bir
gönderi oluştur", "test müşterisi oluştur"... Bunu bir yardımcı dosyaya koymak isteriz. İlk akla gelen
`tests/common.rs` olur — ama hatırla: `tests/` kökündeki **her** `.rs` dosyası ayrı bir test crate'idir.
Çıktında şu gereksiz bölüm belirir:

```console
     Running tests\common.rs (target\debug\deps\common-5b7d9f1a3c2e4d60.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

Çözüm, Modül 8'de gördüğün **eski stil** modül dosyası adlandırmasıdır: `tests/common/mod.rs`. Cargo,
`tests/`'in **alt dizinlerindeki** dosyaları test crate'i saymaz; böylece `common` sadece onu `mod common;`
ile bildiren test dosyalarının bir modülü olur. (Tek istisna `main.rs` adıdır: `tests/odeme/main.rs`
gibi bir dosyayı Cargo, birden çok dosyaya yayılmış **bir** test crate'inin kökü sayar. Yardımcı dizinine
`main.rs` koyma.)

```text
tests/
├── common/
│   └── mod.rs           ← yardımcılar (kendi başına bir test crate'i DEĞİL)
├── fiyat_testleri.rs    ← mod common; ile kullanır
└── iade_testleri.rs     ← mod common; ile kullanır
```

```rust,ignore,title=tests/common/mod.rs
use kargo::Gonderi;

pub fn ornek_koli() -> Gonderi {
    Gonderi::yeni(5, 30, 40, 50)
}
```

```rust,ignore,title=tests/fiyat_testleri.rs
mod common;

use kargo::ucret;

#[test]
fn standart_koli_ucreti() {
    let koli = common::ornek_koli();
    assert_eq!(ucret(&koli), 40 + 20 * 8);
}
```

:::warning Yardımcılarda "never used" uyarıları
Her test dosyası `common`'ı **kendi** modülü olarak ayrı ayrı derler. `iade_testleri.rs`, `common`'daki bir
fonksiyonu kullanmıyorsa, o derlemede `` warning: function `ornek_koli` is never used `` görürsün. Bu yanlış
alarm yaygındır; `tests/common/mod.rs`'in başına `#![allow(dead_code)]` yazmak alışılmış çözümdür.
:::

```quiz
question: "`tests/common.rs` yerine neden `tests/common/mod.rs` kullanıyoruz?"
options:
  - "`mod.rs` dosyaları daha hızlı derlenir"
  - "`tests/` kökündeki her `.rs` dosyası ayrı bir test crate'i sayılır; alt dizindeki `mod.rs` sayılmaz, yalnızca `mod common;` diyen dosyaların modülü olur"
  - "`common.rs` adlı bir dosya Rust'ta yasaktır"
  - Entegrasyon testleri modern `common.rs` stilini desteklemez, modüller her zaman `mod.rs` olmalıdır
answer: 1
explanation: |
  Cargo'nun kuralı basittir: `tests/*.rs` = test crate'i. `tests/common.rs` da bu kurala girer ve çıktıda
  içi boş bir `Running tests\common.rs ... running 0 tests` bölümü üretir. `tests/common/mod.rs` ise bir
  alt dizinde olduğu için kural dışıdır; sadece onu `mod common;` ile bildiren dosyalara modül olarak
  dahil edilir. Modern `common.rs` stili `src/` içinde elbette hâlâ geçerlidir.
feedback:
  - Derleme hızıyla ilgisi yok.
  - Doğru! Mesele Cargo'nun `tests/` dizinini tarama kuralı.
  - Böyle bir yasak yok; sadece test crate'i olarak derlenir.
  - "`src/` içinde modern stil kullanılabilir; bu sadece `tests/` dizinine özgü bir durum."
```

## Binary crate'ler ve `lib.rs` deseni

Şimdiye kadar hep kütüphane (library) crate'i test ettik. Peki projen sadece `src/main.rs`'ten oluşan bir
**binary crate** ise? Kötü haber: entegrasyon testleri bir binary crate'i `use` ile içe **aktaramaz**.
Binary crate bir program üretir, başkalarının kullanabileceği öğeler dışa açmaz; `use kargo::ucret;`
yazmanın karşılığı yoktur.

Modül 8'de öğrendiğin desen tam da bu yüzden Rust dünyasında bu kadar yaygındır: **kalın kütüphane, ince
`main`**.

```text
kargo/
├── src/
│   ├── lib.rs     ← bütün mantık burada: Gonderi, desi, ucret (+ birim testleri)
│   └── main.rs    ← sadece girdiyi alır, kargo::ucret'i çağırır, sonucu yazdırır
└── tests/
    └── fiyat_testleri.rs   ← use kargo::...; ile kütüphaneyi sınar
```

```rust,ignore,title=src/main.rs
use kargo::{ucret, Gonderi};

fn main() {
    // Gerçek programda bu değerler komut satırından okunur (Modül 15).
    let koli = Gonderi::yeni(5, 30, 40, 50);
    println!("Ücret: {} TL", ucret(&koli));
}
```

Aynı yapının tek dosyalık taklidi: `mod kargo` kütüphaneyi, `main` ise `main.rs`'i temsil ediyor. `main`'in
**sadece** `use` ile aldığı `pub` öğeleri kullandığına dikkat et:

```rust
mod kargo {
    pub struct Gonderi {
        agirlik_kg: u32,
        desi: u32,
    }

    impl Gonderi {
        pub fn yeni(agirlik_kg: u32, desi: u32) -> Gonderi {
            Gonderi { agirlik_kg, desi }
        }
    }

    pub fn ucret(g: &Gonderi) -> u32 {
        let ucretli = if g.desi > g.agirlik_kg { g.desi } else { g.agirlik_kg };
        40 + ucretli * 8
    }
}

use kargo::{ucret, Gonderi};

fn main() {
    // ince main: veriyi hazırla → kütüphaneyi çağır → sonucu yazdır
    let siparisler = [("kitap", 1, 2), ("yorgan", 3, 25), ("dambıl", 10, 1)];
    for (ad, kg, desi) in siparisler {
        println!("{ad:>7}: {} TL", ucret(&Gonderi::yeni(kg, desi)));
    }
}
```

`main.rs` o kadar incedir ki test etmeye neredeyse gerek kalmaz: test edilmesi gereken her şey
`lib.rs`'tedir ve oradan hem birim hem entegrasyon testleriyle sınanır. Modül 15'teki komut satırı
projesinde bu deseni baştan sona uygulayacaksın.

:::deep Programın kendisini dışarıdan çalıştırmak ve sadece testte gereken crate'ler
Binary'yi `use` ile içe aktaramazsın, ama **çalıştırabilirsin**. Cargo, entegrasyon testlerini derlerken
paketin her binary'sinin yolunu `CARGO_BIN_EXE_<ad>` adlı derleme zamanı ortam değişkeniyle verir; test,
`std::process::Command::new(env!("CARGO_BIN_EXE_kargo"))` ile programı başlatıp çıktısını kontrol edebilir.
Bu "kara kutu" testleri, komut satırı araçlarında `main.rs`'in ince katmanını da sınamanın yoludur.

Testlerde kullandığın ama programın kendisine gerekmeyen crate'leri `Cargo.toml`'da `[dependencies]`
yerine **`[dev-dependencies]`** altına yazarsın: bunlar yalnızca testler, örnekler ve benchmark'lar
derlenirken bağlanır; kütüphaneni kullananlara yük olmaz.
:::

```quiz
question: Projen sadece `src/main.rs` içeriyor ve `tests/hesap.rs` dosyasında `use hesap_makinesi::topla;` yazıyorsun. Ne olur?
options:
  - Çalışır; Cargo binary crate'in fonksiyonlarını otomatik olarak dışa açar
  - "Derlenmez; binary crate içe aktarılabilecek bir kütüphane değildir — mantığı `src/lib.rs`'e taşıman gerekir"
  - "Çalışır, ama sadece `topla` fonksiyonu `pub` ise"
  - "Çalışır, ama testin içinde `#[cfg(test)]` kullanman gerekir"
answer: 1
explanation: |
  Entegrasyon testi, paketin **library crate**'ini dış bağımlılık gibi kullanır. Paket sadece binary
  crate içeriyorsa içe aktarılacak bir kütüphane yoktur (`unresolved import`). `pub` yazmak da bunu
  değiştirmez: binary crate'in öğeleri hiçbir zaman başka crate'lere açılmaz. Çözüm `src/lib.rs`
  eklemek ve mantığı oraya taşımaktır; `main.rs` de kütüphaneyi `use hesap_makinesi::...` ile kullanır.
feedback:
  - Binary crate hiçbir şeyi dışa açmaz.
  - Doğru! Bu yüzden "kalın lib.rs, ince main.rs" deseni yaygındır.
  - "`pub` bir binary crate'te başka crate'ler için anlam taşımaz."
  - "Entegrasyon testlerinde `#[cfg(test)]` gerekmez; sorun bu değil."
```

## Sıra sende: kütüphanenin vitrini

Önce bir entegrasyon test dosyasının satırlarını doğru sıraya koy:

```parsons
prompt: "`tests/fiyat_testleri.rs` dosyasını kur: yardımcı modülü en üstte bildir, sonra kütüphaneyi tam yoluyla (`kargo::ucret`) kullanan testi yaz."
lines: |
  mod common;
  #[test]
  fn standart_koli_ucreti() {
      let koli = common::ornek_koli();
      assert_eq!(kargo::ucret(&koli), 200);
  }
distractors: |
  #[cfg(test)]
  use super::*;
verify: false
explanation: |
  Entegrasyon test dosyası bir **crate köküdür**: en üstte `mod common;` ile yardımcı modül bildirilir;
  kütüphaneye ise dış bir crate gibi adıyla (`kargo::ucret`) ya da `use kargo::ucret;` ile ulaşılır. `#[cfg(test)]` gerekmez (dosya zaten sadece
  testte derlenir) ve `use super::*;` anlamsızdır — kökün `super`'i yoktur, kütüphane de ebeveyn değil,
  ayrı bir crate'tir. (Bu blok çok dosyalı bir düzen gerektirdiği için uygulamada çalıştırılmaz.)
```

Şimdi asıl alıştırma. Gizli testler kodunun **dışından** — bir entegrasyon testi gibi — `kargo` modülünü
kullanacak.

```exercise
id: m13-e-kargo-vitrini
title: Kargo kütüphanesinin vitrini
difficulty: 3
prompt: |
  `kargo` modülü bir kütüphaneyi temsil ediyor; gizli testler onu **dışarıdan**, bir entegrasyon testi gibi
  kullanacak: `kargo::Gonderi::yeni(kg, en, boy, yukseklik)` ve `kargo::ucret(&gonderi)`.

  1. `ucret` fonksiyonunu tamamla: ücretli ağırlık, `desi` ile kilodan **büyük olanıdır**;
     ücret = **40 TL + ücretli ağırlık × 8 TL**.
  2. Dışarıdan kullanılması gereken öğeleri (`Gonderi`, `yeni`, `ucret`) `pub` yap. Alanlar ve `desi`
     yardımcı fonksiyonu **gizli kalmalı** (iç ayrıntı).
  3. `kargo` modülünün **içine** bir `#[cfg(test)] mod tests` ekle ve gizli `desi` fonksiyonunu doğrudan
     sınayan en az bir birim testi yaz.
starter: |
  mod kargo {
      struct Gonderi {
          agirlik_kg: u32,
          en_cm: u32,
          boy_cm: u32,
          yukseklik_cm: u32,
      }

      impl Gonderi {
          fn yeni(agirlik_kg: u32, en_cm: u32, boy_cm: u32, yukseklik_cm: u32) -> Gonderi {
              Gonderi { agirlik_kg, en_cm, boy_cm, yukseklik_cm }
          }
      }

      fn desi(g: &Gonderi) -> u32 {
          let d = g.en_cm * g.boy_cm * g.yukseklik_cm / 3000;
          if d == 0 { 1 } else { d }
      }

      fn ucret(g: &Gonderi) -> u32 {
          todo!()
      }
  }

  fn main() {
      println!("Kargo hesaplayıcı hazır.");
  }
solution: |
  mod kargo {
      pub struct Gonderi {
          agirlik_kg: u32,
          en_cm: u32,
          boy_cm: u32,
          yukseklik_cm: u32,
      }

      impl Gonderi {
          pub fn yeni(agirlik_kg: u32, en_cm: u32, boy_cm: u32, yukseklik_cm: u32) -> Gonderi {
              Gonderi { agirlik_kg, en_cm, boy_cm, yukseklik_cm }
          }
      }

      fn desi(g: &Gonderi) -> u32 {
          let d = g.en_cm * g.boy_cm * g.yukseklik_cm / 3000;
          if d == 0 { 1 } else { d }
      }

      pub fn ucret(g: &Gonderi) -> u32 {
          let d = desi(g);
          let ucretli = if d > g.agirlik_kg { d } else { g.agirlik_kg };
          40 + ucretli * 8
      }

      #[cfg(test)]
      mod tests {
          use super::*;

          #[test]
          fn desi_hacimden_hesaplanir() {
              assert_eq!(desi(&Gonderi::yeni(1, 30, 40, 50)), 20);
          }

          #[test]
          fn desi_en_az_bir() {
              assert_eq!(desi(&Gonderi::yeni(1, 1, 1, 1)), 1);
          }
      }
  }

  fn main() {
      let koli = kargo::Gonderi::yeni(5, 30, 40, 50);
      println!("Koli: {} TL", kargo::ucret(&koli));
  }
check: tests
tests: |
  #[test]
  fn hafif_buyuk_paket_desiden_ucretlenir() {
      let yastik = kargo::Gonderi::yeni(2, 30, 40, 50);
      assert_eq!(kargo::ucret(&yastik), 200, "20 desi > 2 kg → 40 + 20 × 8");
  }

  #[test]
  fn agir_kucuk_paket_kilodan_ucretlenir() {
      let dambil = kargo::Gonderi::yeni(10, 20, 10, 10);
      assert_eq!(kargo::ucret(&dambil), 120, "1 desi < 10 kg → 40 + 10 × 8");
  }

  #[test]
  fn esitlikte_ayni_sonuc() {
      let kutu = kargo::Gonderi::yeni(4, 20, 20, 30);
      assert_eq!(kargo::ucret(&kutu), 72, "4 desi = 4 kg → 40 + 4 × 8");
  }

  #[test]
  fn minik_paket_bir_desi() {
      let zarf = kargo::Gonderi::yeni(0, 10, 10, 1);
      assert_eq!(kargo::ucret(&zarf), 48, "desi en az 1 sayılır → 40 + 1 × 8");
  }
hints:
  - "Önce `ucret`'i yaz: `let d = desi(g);` sonra `if d > g.agirlik_kg { d } else { g.agirlik_kg }` ile büyük olanı seç."
  - "Gizli testler `kargo::Gonderi::yeni` ve `kargo::ucret`'i modülün dışından çağırıyor: `struct Gonderi`, `fn yeni` ve `fn ucret`'in önüne `pub` ekle. Alanlara ve `desi`'ye dokunma."
  - "Birim testi `kargo` modülünün **içinde** olmalı ki gizli `desi`'yi görebilsin: `#[cfg(test)] mod tests { use super::*; #[test] fn desi_hacimden_hesaplanir() { assert_eq!(desi(&Gonderi::yeni(1, 30, 40, 50)), 20); } }`"
forbid:
  - pattern: "pub\\s*(\\([^)]*\\))?\\s*fn\\s+desi\\b"
    message: "`desi` bir iç ayrıntı; `pub` (ya da `pub(crate)`) yapmadan, modülün içindeki bir birim testiyle sına."
  - pattern: "pub\\s*(\\([^)]*\\))?\\s*(agirlik_kg|en_cm|boy_cm|yukseklik_cm)\\s*:"
    message: Alanlar gizli kalmalı; dış dünya `Gonderi::yeni` kurucusunu kullanır.
require:
  - pattern: "#\\[cfg\\(test\\)\\]"
    message: "`kargo` modülünün içine bir `#[cfg(test)] mod tests` eklemelisin."
  - pattern: "#\\[test\\][\\s\\S]*desi\\("
    message: Birim testlerinden biri gizli `desi` fonksiyonunu doğrudan çağırmalı.
explanation: |
  Bu alıştırmada tek dosyada iki test türünü birlikte kurdun:

  - Modülün **içindeki** `mod tests`, gizli `desi`'ye erişebilen bir **birim testi**dir (çocuk modül kuralı).
  - Gizli testler kodun en dış seviyesinde durdu; `kargo`'ya **dışarıdan** baktılar ve sadece `pub`
    olanları gördüler — tıpkı `tests/` dizinindeki bir entegrasyon testi gibi.

  `pub struct Gonderi` yazıp alanları gizli bırakmak, Modül 8'deki kapsüllemenin ta kendisidir: dış dünya
  bir gönderiyi yalnızca `yeni` kurucusuyla oluşturabilir. Bu sayede ileride alanları değiştirsen bile
  (örneğin boyutları milimetreye çevirsen), entegrasyon testleri ve kullanıcılar etkilenmez.
  `forbid` kuralları da bu sözleşmeyi koruyor: `desi`'yi sırf test edebilmek için `pub` yapmak, iç
  ayrıntıyı dünyaya açmak olurdu — birim testleri buna gerek bırakmaz.
```

## Özet

:::remember
- **Birim testi**: `src/` içinde, `#[cfg(test)] mod tests`, özel öğeleri görür, tek parçayı sınar.
- **Entegrasyon testi**: `tests/*.rs`, her dosya **ayrı bir crate**, sadece `pub` API'yi görür, `use crate_adi::...` ile içe aktarır, `#[cfg(test)]` gerekmez.
- `cargo test` sırası: birim testleri → her entegrasyon dosyası → doc testleri. Bir bölüm kalırsa sonrakiler çalışmaz.
- `cargo test --lib`, `cargo test --test dosya_adi`, `cargo test --tests`.
- Ortak yardımcılar `tests/common/mod.rs`'e; kullanan dosyada `mod common;`. (`tests/common.rs` boş bir test crate'i olur.)
- Binary crate içe aktarılamaz → mantığı `src/lib.rs`'e koy, `main.rs` ince kalsın.
:::

```reflect
prompt: |
  Entegrasyon testlerinin yalnızca `pub` API'ye erişebilmesi neden bir kısıtlama değil de bir **avantaj**
  olarak görülmeli? Kodu yeniden düzenleme (refactoring) örneği üzerinden açıkla.
answer: |
  Model cevap: Entegrasyon testleri kütüphaneyi kullanıcının gördüğü şekliyle sınar; iç ayrıntılara hiç
  bağlı değildir. Bu yüzden içerideki yardımcı fonksiyonları bölebilir, yeniden adlandırabilir ya da
  algoritmayı tamamen değiştirebilirim: `pub` fonksiyonların davranışı aynı kaldığı sürece entegrasyon
  testleri yeşil kalır ve bana "dış sözleşmeyi bozmadın" güvencesi verir. Eğer testler özel öğelere
  erişebilseydi, her iç değişiklikte testleri de değiştirmem gerekirdi ve testler bir güvenlik ağı olmaktan
  çıkıp bir yüke dönüşürdü. Özel ayrıntıların doğruluğunu ise kodun yanındaki birim testleri sınar.
```

```flashcards
- front: Entegrasyon testleri hangi dizine konur ve her dosya nasıl derlenir?
  back: "Paket kökündeki `tests/` dizinine; doğrudan içindeki her `.rs` dosyası **ayrı bir crate** olarak derlenir."
- front: Bir entegrasyon testi kütüphanenin hangi öğelerine erişebilir?
  back: "Sadece `pub` olanlara — kütüphaneyi `use crate_adi::...` ile dış bir crate gibi kullanır."
- front: "Entegrasyon test dosyalarında neden `#[cfg(test)]` yazılmaz?"
  back: "Cargo `tests/` dizinini zaten sadece `cargo test` sırasında derler."
- front: Sadece entegrasyon testlerini (tek bir dosyayı) çalıştıran komut nedir?
  back: "`cargo test --test dosya_adi` (birim testleri için `cargo test --lib`)."
- front: "Ortak test yardımcıları neden `tests/common.rs` değil `tests/common/mod.rs` dosyasına konur?"
  back: "`tests/` kökündeki her dosya bir test crate'idir (boş bir `running 0 tests` bölümü üretir); alt dizindeki `mod.rs` ise sadece `mod common;` diyen dosyaların modülüdür."
- front: Sadece `src/main.rs` olan bir projeye neden entegrasyon testi yazılamaz?
  back: "Binary crate içe aktarılamaz. Mantık `src/lib.rs`'e taşınır, `main.rs` ince kalır."
- front: "Paket adı `kargo-hesap` ise entegrasyon testinde nasıl içe aktarılır?"
  back: "Tire alt çizgiye dönüşür: `use kargo_hesap::...;`"
```
