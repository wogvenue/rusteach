---
id: m13-boss
title: "Boss: Test Ustası"
minutes: 35
type: boss
---

Modül 13'ün sonuna geldin! Bu sınavda test modüllerini, `assert` makrolarını, panik ve `Result` testlerini,
birim/entegrasyon ayrımını, doc testleri ve TDD'yi bir arada kullanacaksın. Aralara önceki modüllerden
(sahiplik, modüller, `?`, String'ler) birkaç soru da serpiştirdik. Geçmek için **%80** yeterli. Bol şans! 🦀

## Test yazmanın temelleri

```quiz
question: "`#[cfg(test)] mod tests { ... }` ile ilgili hangisi doğrudur?"
options:
  - "Modül her derlemede derlenir ama sadece `cargo test` içindeki fonksiyonları çalıştırır"
  - "Modül yalnızca test derlemesinde (`cargo test`) derlenir; `cargo build` ile üretilen programda test kodu yer almaz"
  - "`cfg(test)` modülün içindekileri otomatik olarak `pub` yapar"
  - "`cfg(test)` yazılmazsa `#[test]` fonksiyonları çalışmaz"
answer: 1
explanation: |
  `#[cfg(test)]` bir **koşullu derleme** özniteliğidir: `cfg(test)` koşulu sadece `cargo test` (yani
  `rustc --test`) sırasında doğrudur. Gizlilikle ilgisi yoktur; testler özel fonksiyonlara çocuk modül
  oldukları için erişir. `#[test]` fonksiyonları zaten yalnızca test derlemesinde var olur; `cfg(test)`
  asıl olarak test modülündeki yardımcıların ve `use` satırlarının normal derlemeye girmemesini sağlar.
feedback:
  - Normal derlemede modül hiç derlenmez.
  - Doğru!
  - Gizlilik değişmez; erişim çocuk modül kuralından gelir.
  - "`#[test]` fonksiyonları `cfg(test)` olmadan da test derlemesinde çalışır; ama gelenek ve temizlik için modül içine konur."
```

```compiles
code: |
  #[derive(Debug)]
  enum Durum {
      Acik,
      Kapali,
  }

  fn main() {
      let d = Durum::Acik;
      assert_eq!(d, Durum::Acik);
      println!("{:?}", Durum::Kapali);
  }
answer: false
error: E0369
explanation: |
  `assert_eq!` iki tarafı `==` ile karşılaştırır; bunun için tipin `PartialEq` uygulaması gerekir (Modül 11).
  `Durum` sadece `Debug` türetiyor: ``binary operation `==` cannot be applied to type `Durum` `` (E0369).
  Çözüm: `#[derive(Debug, PartialEq)]`. (Tersi — `PartialEq` var, `Debug` yok — E0277 verirdi.)
```

```compiles
code: |
  fn sahiplen(v: Vec<i32>) -> usize {
      v.len()
  }

  fn main() {
      let v = vec![1, 2, 3];
      assert_eq!(sahiplen(v), 3);
      assert_eq!(v.len(), 3);
  }
answer: false
error: E0382
explanation: |
  `assert_eq!` kendisi değerleri taşımaz, ama **içine yazdığın ifade** sıradan koddur: `sahiplen(v)` çağrısı
  `v`'yi fonksiyona **taşır** (Modül 4). İkinci satırda `v` artık geçersizdir: `borrow of moved value: v`.
  Çözüm: fonksiyon `&[i32]` alsın ve `sahiplen(&v)` diye çağrılsın (Modül 5).
```

````quiz
question: |
  Bir geliştirici beklenen değeri **önce** yazmış: `assert_eq!(180, kdv_ekle(150));` Test şu çıktıyla kaldı:

  ```text
  assertion `left == right` failed
    left: 180
   right: 170
  ```

  `kdv_ekle(150)` ne döndürdü?
options:
  - "180"
  - "170"
  - Belli değil; `left` her zaman fonksiyonun sonucudur
answer: 1
explanation: |
  `left` her zaman `assert_eq!`'in **birinci**, `right` **ikinci** argümanıdır. Burada birinci argüman
  sabit `180`, ikincisi `kdv_ekle(150)` olduğu için fonksiyon `170` döndürmüş. Rust "beklenen/gerçek"
  ayrımı yapmaz; bu yüzden projede tek bir sıra seçip ona sadık kalmak, çıktıyı düşünmeden okumanı sağlar.
feedback:
  - 180 birinci argüman, yani sabit beklenen değer.
  - Doğru! `right` = ikinci argüman = fonksiyonun sonucu.
  - Rust argümanların anlamını bilmez; `left` sadece "birinci argüman" demektir.
````

## Panikler, Result'lar ve test düzeni

```quiz
question: |
  Bir fonksiyon şu mesajla panik yapıyor: `Geçersiz plaka: 99 ABC 1`. Hangi
  `#[should_panic(expected = ...)]` değerleriyle test **geçer**? (Birden fazla doğru olabilir.)
options:
  - "`\"Geçersiz plaka\"`"
  - "`\"geçersiz plaka\"`"
  - "`\"99 ABC\"`"
  - "`\"plaka: 99 ABC 12\"`"
answer: [0, 2]
explanation: |
  `expected` büyük/küçük harf duyarlı bir **alt dizge** kontrolüdür. `"Geçersiz plaka"` ve `"99 ABC"`
  mesajda birebir geçer. `"geçersiz"` küçük g ile yazıldığı için eşleşmez; sonuncusu ise mesajda olmayan
  bir `12` içeriyor. En sağlam seçim, mesajın değişmeyen kısmıdır (`"Geçersiz plaka"`).
feedback:
  - Doğru, birebir geçiyor.
  - Büyük/küçük harf duyarlı; `G` ≠ `g`.
  - Doğru, mesajın içinde geçiyor.
  - Mesaj `1` ile bitiyor, `12` değil.
```

```predict
code: |
  fn adim(n: i32) -> Result<i32, String> {
      if n < 0 {
          Err(format!("negatif: {n}"))
      } else {
          Ok(n * 2)
      }
  }

  fn test_zincir() -> Result<(), String> {
      let a = adim(3)?;
      println!("a = {a}");
      let b = adim(a - 10)?;
      println!("b = {b}");
      Ok(())
  }

  fn main() {
      match test_zincir() {
          Ok(()) => println!("ok"),
          Err(e) => println!("FAILED: {e}"),
      }
  }
options:
  - |
    a = 6
    b = -8
    ok
  - |
    a = 6
    FAILED: negatif: -4
  - |
    FAILED: negatif: -4
  - |
    a = 6
    b = -4
    FAILED: negatif: -4
answer: 1
explanation: |
  `adim(3)` `Ok(6)` döner, `a = 6` yazdırılır. `adim(6 - 10)` yani `adim(-4)` `Err` döner ve `?` (Modül 10)
  fonksiyondan **hemen** çıkar: `b` satırı hiç çalışmaz. `Result` döndüren bir test de aynen böyle kalır —
  ilk `Err`'de biter ve koşucu hatayı yazdırır.
```

```quiz
question: "Paketinde `tests/odeme.rs`, `tests/iade.rs` ve birim testleri var. **Sadece** `tests/odeme.rs` içindeki testleri çalıştırmak istiyorsun. Doğru komut hangisi?"
options:
  - "`cargo test odeme`"
  - "`cargo test --test odeme`"
  - "`cargo test --lib odeme`"
  - "`cargo test -- --test odeme`"
answer: 1
explanation: |
  `--test <ad>` Cargo'ya hangi entegrasyon test **crate**'ini derleyip çalıştıracağını söyler. `cargo test odeme`
  bir **ad filtresidir**: her bölümde (birim testleri dahil) adında `odeme` geçen testleri çalıştırır ve
  `tests/odeme.rs` içindeki, adında `odeme` geçmeyen testleri atlar. `--lib` sadece birim testlerini seçer.
feedback:
  - Bu dosya değil, test **adı** filtresidir.
  - Doğru!
  - "`--lib` sadece `src/lib.rs`'teki birim testleridir."
  - "`--`'den sonrası test programına gider. Test programının da bir `--test` bayrağı vardır ama anlamı \"benchmark değil test çalıştır\"dır; `odeme` sadece ad filtresi olur ve bütün test crate'leri çalışır."
```

```compiles
code: |
  mod kargo {
      pub struct Gonderi {
          agirlik: u32,
      }

      impl Gonderi {
          pub fn yeni(agirlik: u32) -> Gonderi {
              Gonderi { agirlik }
          }
      }
  }

  fn main() {
      let g = kargo::Gonderi::yeni(3);
      assert_eq!(g.agirlik, 3);
  }
answer: false
error: E0616
explanation: |
  `main`, `kargo` modülünün dışındadır — bir entegrasyon testinin kütüphaneye dışarıdan bakması gibi.
  `Gonderi` ve `yeni` `pub`, ama `agirlik` alanı değil (Modül 8: struct alanları ayrı ayrı `pub` yapılır):
  ``field `agirlik` of struct `Gonderi` is private`` (E0616). Entegrasyon testi bu alanı ancak bir
  `pub fn agirlik(&self) -> u32` getter'ı üzerinden okuyabilir; alanın kendisini sınamak birim testinin işidir.
```

```quiz
question: "`tests/` dizinine test içermeyen `yardimci.rs` adlı bir dosya koydun ve diğer test dosyaları ondan fonksiyon kullanıyor. Hangisi doğru?"
options:
  - Sorun yok; Cargo test içermeyen dosyaları atlar
  - "`yardimci.rs` ayrı bir test crate'i olarak derlenir ve çıktıda boş bir `running 0 tests` bölümü üretir; doğrusu `tests/yardimci/mod.rs` + `mod yardimci;`"
  - "Derlenmez; `tests/` içinde sadece `#[test]` içeren dosyalar olabilir"
  - "`yardimci.rs` otomatik olarak bütün test dosyalarına dahil edilir"
answer: 1
explanation: |
  Cargo `tests/` kökündeki **her** `.rs` dosyasını ayrı bir test crate'i yapar. Yardımcı dosya da bir bölüm
  açar ve `running 0 tests` yazar. Alt dizindeki `mod.rs` ise test crate'i sayılmaz; yalnızca
  `mod yardimci;` diyen dosyalara modül olarak dahil olur. Hiçbir dosya başka bir test dosyasına
  otomatik dahil edilmez.
feedback:
  - Cargo atlamaz; her dosya bir crate'tir.
  - Doğru!
  - Derlenir; sadece gereksiz bir boş bölüm üretir.
  - Otomatik dahil etme yok; her dosya `mod ...;` ile bildirmeli.
```

## Belgeler ve TDD

````fill
prompt: Belgedeki bölüm başlığını ve kod bloğu etiketini doldur; örnek, fonksiyonun panik yaptığını göstermeli.
code: |
  /// Bir yaşı kategoriye çevirir.
  ///
  /// # ___0
  ///
  /// `yas` 150'den büyükse panik yapar.
  ///
  /// ```___1
  /// yas_grubu::kategori(200);
  /// ```
  pub fn kategori(yas: u32) -> &'static str {
      assert!(yas <= 150, "yaş en fazla 150 olabilir");
      if yas < 18 {
          "çocuk"
      } else if yas < 65 {
          "yetişkin"
      } else {
          "yaşlı"
      }
  }
blanks:
  - ["Panics"]
  - ["should_panic"]
explanation: |
  Panik koşulları standart `# Panics` başlığı altında belgelenir. Panik yapan bir örneği doc test olarak
  yazmak için kod bloğunu ```` ```should_panic ```` ile açarsın: rustdoc örneği çalıştırır ve panik
  **bekler**. Dönüş tipindeki `&'static str` (Modül 12) dizge sabitlerinin programın tamamı boyunca
  yaşadığını söyler.
````

````quiz
question: |
  Şu doc test `cargo test` sırasında derlenmiyor:

  ```text
  /// ```
  /// let n = sayilar::coz("42")?;
  /// assert_eq!(n, 42);
  /// ```
  ```

  Sebebi ve en deyimsel çözümü hangisi?
options:
  - "Doc testlerde `?` hiçbir zaman kullanılamaz; `.unwrap()` yazmak zorunlusun"
  - "Örnek `()` döndüren bir `main`'e sarılır, `?` orada kullanılamaz (E0277); sona gizli bir `# Ok::<(), HataTipi>(())` satırı ekle"
  - "`sayilar::` yolu yanlış; doc testler `crate::` ile başlamalı"
  - "Kod bloğuna `no_run` eklemek sorunu çözer"
answer: 1
explanation: |
  rustdoc örneğini otomatik olarak `fn main() { ... }` içine sarar ve bu `main` `()` döndürür; Modül 10'dan
  bildiğin gibi `?` sadece `Result`/`Option` döndüren fonksiyonlarda çalışır. Gizli
  `# Ok::<(), HataTipi>(())` satırı `main`'in `Result` döndürmesini sağlar ve okuyucu bu satırı görmez.
  Doc testler crate'i dışarıdan kullandığı için `sayilar::` (crate adı) doğrudur. `no_run` da derlemeyi
  atlamaz; örnek yine derlenmek zorundadır.
feedback:
  - Kullanılabilir; sadece `main`'in dönüş tipini ayarlamak gerekir.
  - Doğru!
  - Doc test crate'in dışındadır; crate'in adını kullanır.
  - "`no_run` sadece çalıştırmayı atlar; derleme hatası kalır."
````

```quiz
question: "TDD ile çalışıyorsun. Yeni yazdığın `roma(40) == \"XL\"` testi, kodu hiç değiştirmeden **ilk çalıştırmada geçti**. En doğru tepki hangisi?"
options:
  - Harika, bir sonraki teste geç
  - Testin gerçekten çalıştığından şüphelen; davranış zaten var mı yoksa test yanlış mı yazıldı, kontrol et (örneğin beklenen değeri geçici olarak bozup kırmızıyı gör)
  - Testi sil, çünkü kırmızı olmayan test TDD'ye aykırıdır
  - Yeniden düzenleme adımına geç ve kodu baştan yaz
answer: 1
explanation: |
  TDD'de her yeni testi **önce kırmızı** görmek, testin hatayı yakalayabildiğinin kanıtıdır. Hemen geçen bir
  test ya zaten var olan bir davranışı tekrar sınıyordur (o zaman gereksiz olabilir) ya da hiçbir şeyi
  kontrol etmiyordur (yanlış fonksiyon, yanlış değer). Beklenen değeri geçici olarak `"XXXX"` yapıp testin
  kaldığını görmek hızlı bir sağlamadır.
feedback:
  - Bu, hiçbir şeyi kontrol etmeyen bir testi fark etmeden bırakmak olabilir.
  - Doğru! Görmediğin kırmızıya güvenme.
  - Silmek yerine önce nedenini anla; test yine de değerli olabilir.
  - Yeniden düzenleme davranış eklemez; burada sorun testin kendisi.
```

```predict
code: |
  fn main() {
      let sehir = "İstanbul";
      let mut harf = 0;
      for _ in sehir.chars() {
          harf += 1;
      }
      println!("{} {}", sehir.len(), harf);
  }
options:
  - "8 8"
  - "9 8"
  - "8 9"
  - "16 8"
answer: 1
explanation: |
  Modül 9: `len()` **bayt** sayar. Büyük `İ` (noktalı) UTF-8'de 2 bayttır, kalan 7 harf birer bayt: toplam
  **9**. `chars()` ise karakterleri tek tek verir: **8**. "Türkçe karakter" satırının uç durum listesinde
  durmasının sebebi budur — sadece ASCII ile test edilen bir uzunluk kontrolü bu farkı asla görmez.
```

## Uygulama: test ağı ör

```exercise
id: m13-boss-indirim-kademeleri
title: Kampanya kademelerini düzelt ve tablo testi yaz
difficulty: 3
prompt: |
  Bir market zincirinin kampanyası: sepet tutarı **1000 TL ve üzeri** ise %15, **500 TL ve üzeri** ise %10,
  **200 TL ve üzeri** ise %5 indirim; daha azına indirim yok.

  `indirim_orani` fonksiyonunda bir hata var (müşteriler tam 500 TL'lik sepetlerde indirim alamadıklarından
  şikâyet ediyor).

  1. Hatayı düzelt.
  2. `tests` modülüne, **sınır değerlerini** de içeren `(tutar, beklenen_oran)` çiftlerinden oluşan bir dizi
     üzerinde `for (..., ...) in ...` ile dönen bir **tablo güdümlü test** yaz.
starter: |
  pub fn indirim_orani(tutar: u32) -> u32 {
      if tutar > 1000 {
          15
      } else if tutar > 500 {
          10
      } else if tutar > 200 {
          5
      } else {
          0
      }
  }

  pub fn odenecek(tutar: u32) -> u32 {
      tutar - tutar * indirim_orani(tutar) / 100
  }

  fn main() {
      println!("750 TL → {} TL", odenecek(750));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      // Tablo güdümlü testini buraya yaz.
  }
solution: |
  pub fn indirim_orani(tutar: u32) -> u32 {
      if tutar >= 1000 {
          15
      } else if tutar >= 500 {
          10
      } else if tutar >= 200 {
          5
      } else {
          0
      }
  }

  pub fn odenecek(tutar: u32) -> u32 {
      tutar - tutar * indirim_orani(tutar) / 100
  }

  fn main() {
      println!("750 TL → {} TL", odenecek(750));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn kademe_sinirlari() {
          let vakalar = [(0, 0), (199, 0), (200, 5), (499, 5), (500, 10), (999, 10), (1000, 15), (5000, 15)];
          for (tutar, beklenen) in vakalar {
              assert_eq!(indirim_orani(tutar), beklenen, "{tutar} TL için oran");
          }
      }
  }
check: tests
tests: |
  #[test]
  fn sinirlar_dahil() {
      assert_eq!(indirim_orani(200), 5, "200 TL dahil %5");
      assert_eq!(indirim_orani(500), 10, "500 TL dahil %10");
      assert_eq!(indirim_orani(1000), 15, "1000 TL dahil %15");
  }

  #[test]
  fn sinirlarin_hemen_alti() {
      assert_eq!(indirim_orani(199), 0, "199 TL indirimsiz");
      assert_eq!(indirim_orani(499), 5, "499 TL %5");
      assert_eq!(indirim_orani(999), 10, "999 TL %10");
  }

  #[test]
  fn odenecek_tutar() {
      assert_eq!(odenecek(500), 450, "500 TL'ye %10 → 450 TL");
      assert_eq!(odenecek(100), 100, "indirimsiz sepet");
      assert_eq!(odenecek(2000), 1700, "2000 TL'ye %15 → 1700 TL");
  }
hints:
  - "\"ve üzeri\" ifadesi sınırın **dahil** olduğunu söyler. `tutar > 500` koşulu tam 500'ü kapsıyor mu?"
  - "Üç karşılaştırmanın hepsini `>=` yap. Tablo testi için: `let vakalar = [(199, 0), (200, 5), (499, 5), (500, 10)];`"
  - "Döngü: `for (tutar, beklenen) in vakalar { assert_eq!(indirim_orani(tutar), beklenen, \"{tutar} TL için oran\"); }` — her sınırı ve hemen altını eklemeyi unutma."
require:
  - pattern: "#\\[test\\][\\s\\S]*for\\s*&?\\s*\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)\\s+in\\b"
    message: "Test modülünde `for (tutar, beklenen) in vakalar` biçiminde bir tablo güdümlü test yazmalısın."
explanation: |
  Klasik bir **sınır hatası**: `>` yerine `>=`. Hatalı sürüm 750 TL gibi "orta" değerlerde doğru çalıştığı
  için `main`'deki deneme hiçbir şey göstermiyordu. Tablo testinde her kademenin **sınırını ve hemen altını**
  (`199/200`, `499/500`, `999/1000`) yan yana koymak, bu hata sınıfını tamamen kapatır; yeni bir kademe
  eklendiğinde de tabloya sadece iki satır eklersin. Mesajdaki `{tutar}` ise hangi satırın kaldığını gösterir.
```

```exercise
id: m13-boss-sinav-puani
title: Deneme sınavı puanlayıcı
difficulty: 4
prompt: |
  Bir dershanenin deneme sınavı için `puan_hesapla(cevaplar, anahtar)` fonksiyonunu yaz. Her soru bir karakter:
  öğrencinin cevabı `A`-`E` ya da boş bırakılmış soru için `-`.

  - Önce **karakter** sayıları karşılaştırılır; farklıysa
    `Err(SinavHatasi::UzunlukFarki { beklenen: <anahtar uzunluğu>, gelen: <cevap uzunluğu> })`.
  - Cevaplarda `A`-`E` ve `-` dışında bir karakter varsa, **ilk** geçersiz karakterle
    `Err(SinavHatasi::GecersizCevap(c))` (küçük harf de geçersizdir).
  - Puan: her doğru **+4**, her yanlış **-1**, boş **0**. Puan **eksiye düşmez**: en az `0`.

  `tests` modülüne en az iki test yaz; en az biri bir **hata yolunu** `assert_eq!(..., Err(...))` ile sınasın.
starter: |
  #[derive(Debug, PartialEq)]
  pub enum SinavHatasi {
      UzunlukFarki { beklenen: usize, gelen: usize },
      GecersizCevap(char),
  }

  pub fn puan_hesapla(cevaplar: &str, anahtar: &str) -> Result<u32, SinavHatasi> {
      todo!()
  }

  fn main() {
      println!("{:?}", puan_hesapla("AB-DA", "ABCDE"));
      println!("{:?}", puan_hesapla("ABC", "ABCDE"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      // Testlerini buraya yaz.
  }
solution: |
  #[derive(Debug, PartialEq)]
  pub enum SinavHatasi {
      UzunlukFarki { beklenen: usize, gelen: usize },
      GecersizCevap(char),
  }

  pub fn puan_hesapla(cevaplar: &str, anahtar: &str) -> Result<u32, SinavHatasi> {
      let mut verilen = Vec::new();
      for c in cevaplar.chars() {
          verilen.push(c);
      }
      let mut dogrular = Vec::new();
      for c in anahtar.chars() {
          dogrular.push(c);
      }
      if verilen.len() != dogrular.len() {
          return Err(SinavHatasi::UzunlukFarki { beklenen: dogrular.len(), gelen: verilen.len() });
      }
      let mut dogru: u32 = 0;
      let mut yanlis: u32 = 0;
      for i in 0..verilen.len() {
          let c = verilen[i];
          match c {
              '-' => {}
              'A'..='E' => {
                  if c == dogrular[i] {
                      dogru += 1;
                  } else {
                      yanlis += 1;
                  }
              }
              _ => return Err(SinavHatasi::GecersizCevap(c)),
          }
      }
      // u32'de 4 * dogru - yanlis eksiye düşebilir: saturating_sub 0'da durur (Modül 2).
      Ok((dogru * 4).saturating_sub(yanlis))
  }

  fn main() {
      println!("{:?}", puan_hesapla("AB-DA", "ABCDE"));
      println!("{:?}", puan_hesapla("ABC", "ABCDE"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn karisik_cevaplar() {
          assert_eq!(puan_hesapla("AB-DA", "ABCDE"), Ok(11));
      }

      #[test]
      fn eksik_cevap_uzunluk_hatasi() {
          assert_eq!(
              puan_hesapla("ABC", "ABCDE"),
              Err(SinavHatasi::UzunlukFarki { beklenen: 5, gelen: 3 })
          );
      }
  }
check: tests
tests: |
  #[test]
  fn puan_kurallari() {
      let vakalar = [
          ("ABCDE", "ABCDE", 20),
          ("AB-DA", "ABCDE", 11),
          ("-----", "ABCDE", 0),
          ("", "", 0),
      ];
      for (cevap, anahtar, beklenen) in vakalar {
          assert_eq!(puan_hesapla(cevap, anahtar), Ok(beklenen), "cevap {cevap:?}, anahtar {anahtar:?}");
      }
  }

  #[test]
  fn puan_eksiye_dusmez() {
      assert_eq!(puan_hesapla("BBBBB", "ACDEA"), Ok(0), "5 yanlış: 0 - 5 → 0");
      assert_eq!(puan_hesapla("EEEEA", "ABCDA"), Ok(0), "1 doğru 4 yanlış: 4 - 4 = 0");
      assert_eq!(puan_hesapla("EEEAA", "ABCAA"), Ok(5), "2 doğru 3 yanlış: 8 - 3 = 5");
  }

  #[test]
  fn uzunluk_farki() {
      assert_eq!(puan_hesapla("ABC", "ABCDE"), Err(SinavHatasi::UzunlukFarki { beklenen: 5, gelen: 3 }));
      assert_eq!(puan_hesapla("ABCDEA", "ABCDE"), Err(SinavHatasi::UzunlukFarki { beklenen: 5, gelen: 6 }));
      assert_eq!(
          puan_hesapla("ABx", "ABCDE"),
          Err(SinavHatasi::UzunlukFarki { beklenen: 5, gelen: 3 }),
          "uzunluk, karakter kontrolünden ÖNCE yapılmalı"
      );
  }

  #[test]
  fn gecersiz_cevaplar() {
      assert_eq!(puan_hesapla("ABx", "ABC"), Err(SinavHatasi::GecersizCevap('x')));
      assert_eq!(puan_hesapla("aBC", "ABC"), Err(SinavHatasi::GecersizCevap('a')), "küçük harf geçersiz");
      assert_eq!(puan_hesapla("AFZ", "ABC"), Err(SinavHatasi::GecersizCevap('F')), "ilk geçersiz karakter döner");
  }

  #[test]
  fn uzunluk_karakterle_olculur() {
      // "ABÇ" 3 karakter (4 bayt): uzunluk tutar, Ç geçersiz cevaptır
      assert_eq!(puan_hesapla("ABÇ", "ABC"), Err(SinavHatasi::GecersizCevap('Ç')));
  }
hints:
  - "Önce iki metnin karakterlerini `for c in metin.chars()` ile birer `Vec<char>`'a topla; böylece uzunluğu **karakter** olarak ölçer (`len()` bayt sayar — `Ç` 2 bayt!) ve `verilen[i]` ile `dogrular[i]`'yi yan yana karşılaştırabilirsin."
  - "Her soru için `match c { '-' => {}, 'A'..='E' => { ... }, _ => return Err(SinavHatasi::GecersizCevap(c)) }` kullan (Modül 7'deki karakter aralıkları)."
  - "Puanı eksiye düşürmeden hesapla: `u32` ile `dogru * 4 - yanlis` eksiye düşerse debug modda taşma paniği alırsın. Modül 2'deki `saturating_sub` tam bunun için: `Ok((dogru * 4).saturating_sub(yanlis))`."
require:
  - pattern: "#\\[test\\][\\s\\S]*#\\[test\\]"
    message: Test modülüne en az iki `#[test]` yazmalısın.
  - pattern: "assert_eq!\\([\\s\\S]*?Err\\(\\s*SinavHatasi::"
    message: "Testlerinden biri bir hata yolunu `assert_eq!(..., Err(SinavHatasi::...))` ile sınamalı."
explanation: |
  Bu alıştırma modülün bütün parçalarını birleştiriyor: hata yolları `Result` ile modellenmiş, testler
  `assert_eq!(.., Err(..))` ile **tam hatayı** doğruluyor, gizli testler tablo güdümlü ve uç durumlarla dolu.

  Üç tuzak vardı: **(1)** `cevaplar.len()` bayt sayar; `"ABÇ"` ile `"ABC"` bayt olarak farklı uzunlukta
  olduğu için yanlışlıkla `UzunlukFarki` dönerdi. **(2)** `dogru * 4 - yanlis` doğrudan `u32` ile hesaplanırsa
  yanlışlar fazla olduğunda **taşma paniği** (debug) ya da devasa bir sayı (release) çıkar;
  `saturating_sub` (ya da önce karşılaştırıp sonra çıkarmak: `if yanlis >= arti { 0 } else { arti - yanlis }`)
  güvenlidir. **(3)** Kontrol sırası: uzunluk önce, sonra karakterler — gizli testteki `"ABx"` / `"ABCDE"`
  vakası hem kısa hem geçersiz karakterli; doğru cevap `UzunlukFarki`'dir, `GecersizCevap('x')` değil.

  İndekslerle iki `Vec<char>` dolaşmak yerine Modül 14'te göreceğin `zip` ile iki metni yan yana
  yürüyebileceksin; ama uzunluğu yine önceden karakter olarak kontrol etmen gerekir, çünkü `zip` kısa olan
  bittiğinde sessizce durur.

  Kendi testlerinde bir hata yolunu sınaman da önemliydi: çoğu hata **mutlu yol dışında** saklanır.
```
