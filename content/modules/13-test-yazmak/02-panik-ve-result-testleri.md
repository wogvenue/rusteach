---
id: m13-l02
title: Panik ve Result Döndüren Testler
minutes: 24
type: lesson
objectives:
  - "Bir fonksiyonun beklendiği gibi panik yaptığını `#[should_panic(expected = \"...\")]` ile test edebilmek ve `expected`'in neden gerekli olduğunu açıklayabilmek"
  - "`Result<(), E>` döndüren testlerde `?` kullanabilmek ve `Err` dönen bir değeri `assert_eq!` ya da `matches!` ile doğrulayabilmek"
  - "Testlerin paralel thread'lerde çalışmasının sonuçlarını açıklayıp `#[ignore]` ve `cargo test` seçenekleriyle hangi testlerin nasıl çalışacağını yönetebilmek"
keywords: [should_panic, expected, Result, "?", ignore, cargo test, no-capture, nocapture, test-threads, filtre]
---

Önceki derste testlerin "doğru sonuç döndü mü?" sorusunu yanıtladı. Ama iyi bir fonksiyonun ölçüsü sadece
doğru girdide doğru sonuç vermesi değildir; **yanlış girdide doğru şekilde reddetmesi** de en az o kadar
önemlidir. Bankanın parayı doğru yatırması kadar, bakiyesi yetmeyen çekimi **reddetmesi** de kritiktir.

Modül 10'dan hatırla: Rust'ta bir şeyin ters gitmesinin iki yolu var, kurtarılamaz hatalar için
**`panic!`**, beklenen hatalar için **`Result`**. Bu derste ikisini de test etmeyi, sonra da `cargo test`'in
dümenine geçmeyi öğreneceksin.

## Panik beklenen davranış olduğunda

`yuzde` fonksiyonu, bütünün sıfır olmasını bir **sözleşme ihlali** sayıyor: sıfıra bölmeye çalışan kod
hatalıdır, çağıran düzeltmelidir. Modül 10'daki kılavuza göre bu bir panik durumudur:

```rust,should_panic
pub fn yuzde(kisim: u32, butun: u32) -> u32 {
    assert!(butun != 0, "bütün sıfır olamaz (kısım: {kisim})");
    kisim * 100 / butun
}

fn main() {
    println!("{}%", yuzde(1, 4));
    println!("{}%", yuzde(5, 0)); // sözleşme ihlali → panik
}
```

Bu davranışı test etmek istiyoruz: *"`yuzde(5, 0)` panik yapmalı."* Ama bir test panik yapınca **kalıyordu**.
Çözüm, test fonksiyonuna ikinci bir öznitelik eklemek: `#[should_panic]`. Bu öznitelik test koşucusuna
mantığı tersine çevirmesini söyler: **panik olursa geçer, olmazsa kalır.**

```rust
pub fn yuzde(kisim: u32, butun: u32) -> u32 {
    assert!(butun != 0, "bütün sıfır olamaz (kısım: {kisim})");
    kisim * 100 / butun
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ceyrek_yuzde_yirmi_bes() {
        assert_eq!(yuzde(1, 4), 25);
    }

    #[test]
    #[should_panic]
    fn sifira_bolunemez() {
        yuzde(5, 0);
    }
}
```

```console
running 2 tests
test tests::ceyrek_yuzde_yirmi_bes ... ok
test tests::sifira_bolunemez - should panic ... ok
```

Çıktıdaki `- should panic` eki, bu testin tersine çevrilmiş mantıkla çalıştığını hatırlatır. Şimdi tahmin et:

````quiz
question: |
  Aşağıdaki testin sonucu ne olur?

  ```rust
  #[test]
  #[should_panic]
  fn panik_bekliyorum() {
      yuzde(1, 4);
  }
  ```
options:
  - "`ok`, `#[should_panic]` testleri her zaman geçer"
  - "`FAILED`, fonksiyon panik yapmadı ama panik bekleniyordu"
  - "Derlenmez, `yuzde`'nin dönüş değeri kullanılmıyor"
answer: 1
explanation: |
  `yuzde(1, 4)` sorunsuzca `25` döndürür; panik olmaz. Test **panik bekliyordu**, bu yüzden kalır.
  Gerçek çıktı: `note: test did not panic as expected at src/lib.rs:46:8`. Bu iyi bir şey:
  `#[should_panic]` testi, bir gün biri `assert!` satırını silerse (ve fonksiyon sessizce yanlış bir
  sonuç döndürmeye başlarsa) seni uyaracaktır. Dönüş değerini kullanmamak ise en fazla bir uyarıdır,
  hata değil - `u32` için uyarı bile yoktur.
feedback:
  - Hayır; panik olmazsa `should_panic` testi kalır.
  - Doğru! Beklenen panik gelmediği için test kalır.
  - "Kullanılmayan dönüş değeri hata değildir (`#[must_use]` olmayan tiplerde uyarı bile vermez)."
````

## `expected`: doğru sebepten panik

`#[should_panic]`'in sinsi bir zayıflığı var: **her** paniği kabul eder. Şu ortalama fonksiyonuna bak:

```rust
pub fn ortalama(notlar: &[u32]) -> u32 {
    let mut toplam = 0;
    for n in notlar {
        toplam += n;
    }
    toplam / notlar.len() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic]
    fn bos_liste_panik_yapar() {
        let notlar: Vec<u32> = Vec::new();
        ortalama(&notlar);
    }
}
```

Bu test **geçer**. Ama neden? Fonksiyonda boş liste için bilinçli bir kontrol yok; panik, sıfıra bölmeden
(`attempt to divide by zero`) geliyor. Test "boş liste düzgün şekilde reddediliyor" iddiasını kanıtlamıyor,
sadece "bir şeyler patlıyor" diyor. Yarın biri koda bir dizin hatası eklese (`notlar[0]` gibi), test yine
geçerdi, yanlış sebepten.

Çözüm, beklenen panik mesajının bir **parçasını** vermek: `#[should_panic(expected = "...")]`. Test ancak
panik mesajı bu alt dizgeyi (substring) **içeriyorsa** geçer. Fonksiyonu değiştirmeden testi
`expected = "liste boş"` ile yazarsak gerçek tablo ortaya çıkar:

:::error
```text
---- tests::bos_liste_panik_yapar stdout ----

thread 'tests::bos_liste_panik_yapar' (49) panicked at src/lib.rs:6:5:
attempt to divide by zero
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
note: panic did not contain expected string
      panic message: "attempt to divide by zero"
 expected substring: "liste boş"
```
Test koşucusu sana iki şeyi yan yana gösterir: gerçekte gelen panik mesajı (`panic message`) ve beklediğin
parça (`expected substring`). Burada açıkça görülüyor: fonksiyon boş listeyi **hiç kontrol etmiyor**.
:::

Doğru düzeltme fonksiyonun içindedir: sözleşmeyi **açıkça** kontrol eden bir `assert!`. Artık hem
sözleşme açık hem test anlamlı:

```rust
pub fn ortalama(notlar: &[u32]) -> u32 {
    assert!(!notlar.is_empty(), "liste boş: ortalama hesaplanamaz");
    let mut toplam = 0;
    for n in notlar {
        toplam += n;
    }
    toplam / notlar.len() as u32
}

fn main() {
    println!("Ortalama: {}", ortalama(&[70, 85, 91]));
    // ortalama(&[]) artık "liste boş: ..." mesajıyla panik yapar;
    // #[should_panic(expected = "liste boş")] testi doğru sebepten geçer.
}
```

```quiz
question: |
  Bir fonksiyon şu mesajla panik yapıyor: `yetersiz stok: 3 var, 5 istendi`. Aşağıdaki `expected`
  değerlerinden hangileriyle `#[should_panic]` testi **geçer**? (Birden fazla seçenek doğru olabilir.)
options:
  - "`expected = \"yetersiz stok\"`"
  - "`expected = \"Yetersiz stok\"`"
  - "`expected = \"5 istendi\"`"
  - "`expected = \"yetersiz stok: 5 var\"`"
answer: [0, 2]
explanation: |
  `expected` bir **alt dizge** (substring) kontrolüdür: mesajın herhangi bir yerinde, **büyük/küçük harf
  duyarlı** olarak geçmesi yeterlidir. `"yetersiz stok"` ve `"5 istendi"` mesajda birebir var.
  `"Yetersiz"` büyük Y ile yazılmış, eşleşmez. Sonuncusu ise mesajda olmayan bir sayı içeriyor.

  İpucu: `expected` için mesajın **değişmeyen, anlamlı** kısmını seç (`"yetersiz stok"`). Sayıları
  içeren kısımlar test verisi değiştikçe kırılır.
feedback:
  - Doğru, birebir geçiyor.
  - Büyük/küçük harf duyarlıdır; `Y` ≠ `y`.
  - Doğru, mesajın sonunda birebir geçiyor.
  - Mesajda "3 var" yazıyor; bu dizge mesajda yok.
```

:::tip Debug modunda taşma da paniktir
`cargo test` varsayılan olarak `test` profilinde derler; bu profil ayarlarını **debug** (`dev`) profilinden
alır. Modül 2'den hatırla: debug modunda tamsayı taşması (`u8` için `255 + 1`) panik yapar:
`attempt to add with overflow`. Bu, testlerin taşma hatalarını da yakalamasını sağlar, ama
`#[should_panic]` testinin yanlış sebepten geçmesine de yol açabilir. Bir sebep daha: `expected` kullan.
(`cargo test --release` ile release ayarlarına geçersen taşma kontrolleri varsayılan olarak kapanır; aynı
test bu kez panik yerine sessizce sarmalanmış bir sonuç görür.)
:::

## `Result` döndüren testler

Modül 10'daki banka hesabını hatırla: yetersiz bakiye bir programcı hatası değil, **beklenen** bir durumdur;
bu yüzden `cek` metodu panik yapmaz, `Result` döndürür.

```rust
#[derive(Debug, PartialEq)]
pub enum HesapHatasi {
    YetersizBakiye { bakiye: u32, istenen: u32 },
    SifirTutar,
}

pub struct Hesap {
    bakiye: u32,
}

impl Hesap {
    pub fn yeni(bakiye: u32) -> Hesap {
        Hesap { bakiye }
    }

    pub fn bakiye(&self) -> u32 {
        self.bakiye
    }

    pub fn cek(&mut self, tutar: u32) -> Result<u32, HesapHatasi> {
        if tutar == 0 {
            return Err(HesapHatasi::SifirTutar);
        }
        if tutar > self.bakiye {
            return Err(HesapHatasi::YetersizBakiye { bakiye: self.bakiye, istenen: tutar });
        }
        self.bakiye -= tutar;
        Ok(self.bakiye)
    }
}

fn main() {
    let mut hesap = Hesap::yeni(100);
    println!("{:?}", hesap.cek(30));
    println!("{:?}", hesap.cek(500));
    println!("{:?}", hesap.cek(0));
    println!("Kalan: {} TL", hesap.bakiye());
}
```

Bu kodu test ederken iki farklı soru sorarız: **mutlu yol** (çekim başarılı mı?) ve **hata yolu** (doğru
hatayı mı döndürüyor?). Mutlu yolda birden fazla `cek` çağrısı var ve her biri `Result` döndürüyor. Her
birine `.unwrap()` yazmak yerine `?` kullanmak isteriz. Ama bir dakika:

```compiles
code: |
  fn kontrol() {
      let n: u32 = "42".parse()?;
      assert_eq!(n, 42);
  }

  fn main() {
      kontrol();
  }
answer: false
error: E0277
explanation: |
  Modül 10: `?` operatörü hatayı **çağırana geri döndürür**; bu yüzden yalnızca `Result` (ya da `Option`)
  döndüren fonksiyonlarda kullanılabilir. Dönüş tipi `()` olan bir fonksiyonda derleyici şunu söyler:
  ``the `?` operator can only be used in a function that returns `Result` or `Option` `` (E0277) ve
  hemen bir düzeltme önerir: `fn kontrol() -> Result<(), Box<dyn std::error::Error>>` ve sonda `Ok(())`.
  Test fonksiyonları da aynı kurala tabidir - çözüm de aynıdır.
```

Rust test fonksiyonlarının `Result<(), E>` döndürmesine izin verir. Kural: **`Ok(())` dönerse test geçer,
`Err(...)` dönerse kalır.** `E` tipinin `Debug` uygulaması yeterlidir; çünkü koşucu hatayı `{:?}` ile yazdırır.

```rust,ignore
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cekim_bakiyeyi_azaltir() -> Result<(), HesapHatasi> {
        let mut hesap = Hesap::yeni(100);
        hesap.cek(30)?;
        hesap.cek(20)?;
        assert_eq!(hesap.bakiye(), 50);
        Ok(())
    }

    #[test]
    fn fazla_cekim_hata_dondurur() {
        let mut hesap = Hesap::yeni(100);
        let sonuc = hesap.cek(150);
        assert_eq!(sonuc, Err(HesapHatasi::YetersizBakiye { bakiye: 100, istenen: 150 }));
        assert_eq!(hesap.bakiye(), 100, "başarısız çekim bakiyeyi değiştirmemeli");
    }

    #[test]
    fn sifir_tutar_reddedilir() {
        let mut hesap = Hesap::yeni(100);
        assert!(matches!(hesap.cek(0), Err(HesapHatasi::SifirTutar)));
    }
}
```

Hata yolunu test etmenin üç yolu var, güçlüden zayıfa:

| yöntem | ne kontrol eder? | ne zaman? |
|---|---|---|
| `assert_eq!(sonuc, Err(...))` | Hatanın **tam** değerini, alanlarıyla birlikte | Hata tipi `PartialEq` + `Debug` ise, en güçlüsü |
| `assert!(matches!(sonuc, Err(Hata::X { .. })))` | Sadece **varyantı** (Modül 7'deki `matches!`) | Alanlar önemsizse ya da tip `PartialEq` değilse |
| `assert!(sonuc.is_err())` | Sadece "bir hata oldu" | Son çare, `#[should_panic]`'in `expected`'siz hâli kadar zayıf |

Farkı kendin gör: aşağıda **yanlış** hata dönüyor (`SifirTutar`), ama `is_err()` yine de memnun:

```rust
# #[derive(Debug, PartialEq)]
# pub enum HesapHatasi {
#     YetersizBakiye { bakiye: u32, istenen: u32 },
#     SifirTutar,
# }
fn main() {
    let beklenen: Result<u32, HesapHatasi> =
        Err(HesapHatasi::YetersizBakiye { bakiye: 100, istenen: 150 });
    let gelen: Result<u32, HesapHatasi> = Err(HesapHatasi::SifirTutar); // yanlış hata!

    println!("tam eşitlik : {}", gelen == beklenen);
    println!("varyant     : {}", matches!(gelen, Err(HesapHatasi::YetersizBakiye { .. })));
    println!("is_err      : {}", gelen.is_err());
}
```

Sadece `is_err()` kullanan bir test bu hatayı **kaçırırdı**. Testin gücü, doğrulamanın ne kadar
**kesin** olduğuyla ölçülür.

Peki hata tipini elle oluşturamıyorsan? Örneğin `parse`'ın döndürdüğü `ParseIntError`'ın herkese açık bir
kurucusu yoktur; `Err(ParseIntError { .. })` yazamazsın. Yine de `is_err()`'e razı olma, hatanın **içine
bak**: `unwrap_err()` hatayı çıkarır (sonuç `Ok` ise panik yapar, yani test zaten kalır). Sonra tipin
sunduğu bir bilgiyle (`ParseIntError` için `.kind()`) ya da en azından mesajıyla karşılaştır:

```rust
use std::num::IntErrorKind;

fn main() {
    let hata = "otuz".parse::<u8>().unwrap_err();
    assert_eq!(hata.kind(), &IntErrorKind::InvalidDigit);
    assert_eq!(hata.to_string(), "invalid digit found in string");

    let tasma = "300".parse::<u8>().unwrap_err(); // u8 en fazla 255
    println!("{:?} / {:?}", hata.kind(), tasma.kind());
}
```

:::warning `?` ile kalan testte satır numarası yoktur
`?` ile biten bir test şu kadarını yazdırır: `Error: YetersizBakiye { bakiye: 50, istenen: 80 }`.
**Hangi** `cek` çağrısının başarısız olduğunu söylemez; `assert_eq!`'teki gibi `src/lib.rs:17:9` satırı
yoktur. Bu yüzden `?`'i **hazırlık** adımları için kullan ("bu adım zaten çalışmalı"), asıl
doğrulamalarını ise `assert` makrolarıyla yap. Ayrıca `#[should_panic]` ile `Result` dönüş tipi birlikte
kullanılamaz: `` error: functions using `#[should_panic]` must return `()` ``.
:::

Testin `Err` döndürdüğü anda kalmasının mantığını görmek için küçük bir "mini test koşucusu" yazalım.
Gerçek koşucu da kabaca bunu yapar:

```predict
code: |
  fn test_iki_cekim() -> Result<(), String> {
      let mut bakiye: u32 = 100;
      for tutar in [50, 80] {
          if tutar > bakiye {
              return Err(format!("{tutar} TL çekilemedi"));
          }
          bakiye -= tutar;
          println!("{tutar} TL çekildi");
      }
      Ok(())
  }

  fn raporla(ad: &str, sonuc: Result<(), String>) {
      match sonuc {
          Ok(()) => println!("test {ad} ... ok"),
          Err(e) => println!("test {ad} ... FAILED ({e})"),
      }
  }

  fn main() {
      raporla("iki_cekim", test_iki_cekim());
  }
options:
  - |
    50 TL çekildi
    80 TL çekildi
    test iki_cekim ... ok
  - |
    50 TL çekildi
    test iki_cekim ... FAILED (80 TL çekilemedi)
  - |
    test iki_cekim ... FAILED (80 TL çekilemedi)
answer: 1
explanation: |
  İlk çekimden sonra bakiye `50` olur ve `"50 TL çekildi"` yazdırılır. İkinci tur `80 > 50` olduğu için
  `Err` ile **erkenden döner** - sonraki satırlar çalışmaz. Gerçek testlerde `?` aynısını yapar: ilk `Err`'de
  test fonksiyonundan çıkılır ve koşucu `Err` değerini görüp testi `FAILED` sayar.
```

Şimdi sıra sende:

```fill
prompt: Testin `?` kullanabilmesi için eksik dönüş tipini ve son ifadeyi tamamla.
code: |
  pub fn yas_coz(girdi: &str) -> Result<u8, std::num::ParseIntError> {
      girdi.trim().parse::<u8>()
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn bosluklu_yas_cozulur() -> ___0 {
          let yas = yas_coz("  42 ")___1;
          assert_eq!(yas, 42);
          ___2
      }
  }
blanks:
  - ["Result<(), std::num::ParseIntError>", "Result<(),std::num::ParseIntError>", "Result<(), Box<dyn std::error::Error>>"]
  - ["?"]
  - ["Ok(())"]
explanation: |
  Test `Result<(), E>` döndürdüğünde `?`, `Err` gelirse testi o anda bitirir (test kalır). Son ifade
  `Ok(())` testin başarıyla bittiğini söyler - unutursan `E0308: mismatched types` alırsın, çünkü
  fonksiyon `()` döndürüyor olur. `Box<dyn std::error::Error>` de çalışır ve farklı hata tiplerini
  aynı testte `?` ile kullanmanı sağlar.
```

## Testler nasıl çalışır: her biri kendi thread'inde

`cargo test` testlerini **paralel** çalıştırır: test koşucusu her test için ayrı bir **thread** (iş parçacığı)
başlatır. Thread'leri Modül 18'de ayrıntılı göreceğiz; şimdilik bilmen gereken: her thread'in **kendi
stack'i** vardır ve bir thread'deki panik (Modül 10'daki stack'i geri sarma, *unwinding*) **sadece o
thread'i** durdurur.

```memory
title: Üç test, üç thread
steps:
  - caption: "Koşucu her test için ayrı bir thread açar. Her testin değişkenleri **kendi stack'inde** yaşar."
    stack:
      - frame: "thread: tests::cekim_bakiyeyi_azaltir"
        vars:
          - { name: hesap, type: Hesap, value: "bakiye = 70", mut: true }
      - frame: "thread: tests::fazla_cekim_hata_dondurur"
        vars:
          - { name: hesap, type: Hesap, value: "bakiye = 100", mut: true }
          - { name: sonuc, type: "Result<u32, HesapHatasi>", value: "Err(YetersizBakiye { .. })" }
      - frame: "thread: tests::sifira_bolunemez"
        vars:
          - { name: kisim, type: u32, value: "5" }
          - { name: butun, type: u32, value: "0" }
  - caption: "`sifira_bolunemez` panik yaptı: sadece **o thread'in** stack'i geri sarılır. Diğer testler hiç etkilenmeden devam eder."
    stack:
      - frame: "thread: tests::cekim_bakiyeyi_azaltir"
        vars:
          - { name: hesap, type: Hesap, value: "bakiye = 50", mut: true, note: "devam ediyor" }
      - frame: "thread: tests::fazla_cekim_hata_dondurur"
        vars:
          - { name: hesap, type: Hesap, value: "bakiye = 100", mut: true }
          - { name: sonuc, type: "Result<u32, HesapHatasi>", value: "Err(YetersizBakiye { .. })" }
      - frame: "thread: tests::sifira_bolunemez"
        vars:
          - { name: kisim, type: u32, value: "5", moved: true, note: "panik → geri sarıldı" }
          - { name: butun, type: u32, value: "0", moved: true }
```

Bu tasarım iki şey kazandırır: tek bir panik bütün test oturumunu çökertmez (koşucu panikleri sayar ve
sonunda hepsini raporlar), ve çok çekirdekli işlemcilerde testler çok daha hızlı biter. Bir şartı var:
**testler birbirinden bağımsız olmalı.**

:::analogy Sınav salonu
Testleri bir sınav salonundaki öğrenciler gibi düşün. Herkes kendi masasında, kendi kâğıdıyla aynı anda
çalışır; birinin kalemi kırılırsa (panik) diğerleri yazmaya devam eder. Ama iki öğrenciye **aynı kâğıdı**
verirsen (ortak bir dosya, ortak bir ortam değişkeni) birbirlerinin cevaplarını karalarlar, sonuç,
kimin önce yazdığına göre değişir.
:::

Paralellik yüzünden çıktıdaki test sırası her çalıştırmada değişebilir ve ortak bir kaynağa dokunan testler
**bazen** kalıp bazen geçebilir (*flaky test*). Böyle testleri tek thread'de sırayla çalıştırmak için:
`cargo test -- --test-threads=1`. Ama asıl çözüm, testleri ortak duruma dokunmayacak şekilde tasarlamaktır.

En sinsi ortak kaynaklardan biri **ortam değişkenleridir** (environment variables): bütün süreç (process)
için tektir, yani bütün test thread'leri aynı değişkenleri paylaşır. Rust 2024 sürümünde
`std::env::set_var` tam da bu yüzden `unsafe` olarak işaretlendi: başka bir thread aynı anda ortamı
okurken değiştirmek tanımsız davranışa yol açabilir. Testlerinde ortam değişkeni değiştirmek yerine
değeri fonksiyona **parametre** olarak vermeyi tercih et.

```quiz
question: İki test aynı anda çalışıyor. Hangi durum paralel çalışmada **sorun çıkarabilir**?
options:
  - İki testin de kendi içinde `let mut hesap = Hesap::yeni(100);` oluşturması
  - İki testin de diskteki aynı `ayarlar.txt` dosyasına yazıp sonra okuması
  - Bir testin panik yapması, diğerinin `Ok(())` döndürmesi
  - İki testin aynı saf (pure) fonksiyonu farklı girdilerle çağırması
answer: 1
explanation: |
  Her testin kendi stack'inde oluşturduğu değerler tamamen bağımsızdır; saf fonksiyonlar (sadece
  girdisine bakıp çıktı üreten) da güvenlidir. Ortak bir dosya ise iki thread'in **paylaştığı** dış
  dünyadır: A yazar, B üzerine yazar, A okur ve B'nin verisini görür. Sonuç zamanlamaya bağlıdır.
  Çözüm: her teste ayrı dosya adı ver ya da `--test-threads=1` kullan.
feedback:
  - Her `hesap` kendi thread'inin stack'indedir; paylaşılmaz.
  - Doğru! Paylaşılan dış kaynak = yarış durumu.
  - Panik sadece kendi thread'ini durdurur; diğer test etkilenmez.
  - Saf fonksiyonlar paylaşılan durum içermez, güvenlidir.
```

## `#[ignore]` ve `cargo test`'i yönetmek

Bazı testler pahalıdır: bir milyon kayıtla çalışan bir performans testi, ağ gerektiren bir test...
Bunları her `cargo test`'te çalıştırmak istemezsin. `#[ignore]` özniteliği testi **varsayılan olarak
atlatır**; isteğe bağlı olarak sebebini de yazabilirsin:

```rust,ignore
#[test]
#[ignore = "yavaş: bir milyon siparişle çalışıyor"]
fn milyon_siparis_raporu() {
    // ...
}
```

```console
running 3 tests
test tests::milyon_siparis_raporu ... ignored, yavaş: bir milyon siparişle çalışıyor
test tests::cekim_bakiyeyi_azaltir ... ok
test tests::sifir_tutar_reddedilir ... ok

test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

`cargo test` komutunun argümanları **iki gruba** ayrılır ve aralarındaki `--` çok önemlidir:
**`--`'den öncekiler Cargo'ya**, **sonrakiler** derlenen **test programına** gider.

| komut | ne yapar? |
|---|---|
| `cargo test cek` | Adında `cek` **geçen** testleri çalıştırır (tam ad üzerinde alt dizge: `tests::cekim_...`). Diğerleri `filtered out` sayılır. |
| `cargo test tests::cekim_bakiyeyi_azaltir -- --exact` | Sadece adı **birebir** bu olan testi çalıştırır |
| `cargo test -- --ignored` | **Sadece** `#[ignore]` işaretli testleri çalıştırır |
| `cargo test -- --include-ignored` | Hepsini, işaretliler dahil çalıştırır |
| `cargo test -- --no-capture` | Testlerdeki `println!` çıktısını **anında** gösterir (eski yazımı: `--nocapture`) |
| `cargo test -- --show-output` | Geçen testlerin yakalanmış çıktısını sonda gösterir |
| `cargo test -- --test-threads=1` | Testleri tek thread'de, sırayla çalıştırır |
| `cargo test -- --list` | Testleri çalıştırmadan listeler |

Bir ayrıntı: koşucu varsayılan olarak testlerin `println!` (ve `eprintln!`) çıktısını **yakalar** (capture).
Geçen bir testin çıktısını hiç görmezsin; kalan bir testin çıktısı ise `---- tests::x stdout ----`
bölümünde gösterilir. Bu, yüzlerce testin çıktısı birbirine karışmasın diyedir. Hata ayıklarken
`--no-capture` bu perdeyi kaldırır. (Bayrağın adı Rust 1.88'de `--nocapture`'dan `--no-capture`'a
çevrildi; eski yazım hâlâ çalışır ve internetteki pek çok örnekte onu görürsün.)

```quiz
question: Adında `rapor` geçen, `#[ignore]` ile işaretlenmiş testleri ve **sadece** onları çalıştırmak istiyorsun. Doğru komut hangisi?
options:
  - "`cargo test -- --ignored`"
  - "`cargo test rapor -- --ignored`"
  - "`cargo test --ignored rapor`"
  - "`cargo test rapor`"
answer: 1
explanation: |
  Filtre (`rapor`) Cargo'nun argümanıdır, `--`'den **önce** yazılır; Cargo onu her test programına iletir.
  `--ignored` ise test programının bayrağıdır, `--`'den **sonra** gelir. İlk seçenekte filtre yok: adı ne
  olursa olsun **bütün** `#[ignore]`'lu testler çalışır. Üçüncüsünde Cargo `--ignored` diye bir bayrak
  tanımaz ve hata verir. Sonuncusu ise filtreyi uygular ama `#[ignore]`'lu testleri **atlar**.
feedback:
  - Filtre eksik; adında `rapor` geçmeyen `#[ignore]`'lu testler de çalışır.
  - Doğru! Filtre Cargo'ya, `--ignored` test programına.
  - "`--ignored` bir Cargo bayrağı değildir; `--`'den sonra yazılmalı."
  - Bu, `#[ignore]`'lu testleri atlar.
```

## Sıra sende: hata yollarını test etmek

```exercise
id: m13-e-depo-stok
title: "Depo stoğu: panik mi, Result mı?"
difficulty: 3
prompt: |
  Bir e-ticaret deposunu modelliyoruz. `Depo` yapısını tamamla:

  - `Depo::yeni(kapasite)`, kapasite **0 ise** `"kapasite sıfır olamaz"` mesajını içeren bir mesajla
    **panik** yapmalı (bu bir programcı hatasıdır). Aksi hâlde boş (stok = 0) bir depo döndürür.
  - `ekle(adet)`, stok + adet kapasiteyi **aşarsa** `Err(StokHatasi::KapasiteAsildi { bos_yer })`
    döndürür (`bos_yer` = kapasite - stok); aksi hâlde stoğu artırır ve `Ok(yeni_stok)` döndürür.
    `ekle(u32::MAX)` gibi devasa bir değer de **taşma paniği değil**, bu hatayı vermeli.
  - `cikar(adet)`, stoktan fazlası istenirse `Err(StokHatasi::Yetersiz { mevcut })` döndürür; aksi hâlde
    stoğu azaltır ve `Ok(yeni_stok)` döndürür. Hata durumunda stok **değişmemeli**.

  Gizli testler `#[should_panic(expected = ...)]`, `Result` döndüren testler ve `assert_eq!(.., Err(..))`
  kullanacak.
starter: |
  #[derive(Debug, PartialEq)]
  pub enum StokHatasi {
      KapasiteAsildi { bos_yer: u32 },
      Yetersiz { mevcut: u32 },
  }

  pub struct Depo {
      kapasite: u32,
      stok: u32,
  }

  impl Depo {
      pub fn yeni(kapasite: u32) -> Depo {
          todo!()
      }

      pub fn stok(&self) -> u32 {
          self.stok
      }

      pub fn ekle(&mut self, adet: u32) -> Result<u32, StokHatasi> {
          todo!()
      }

      pub fn cikar(&mut self, adet: u32) -> Result<u32, StokHatasi> {
          todo!()
      }
  }

  fn main() {
      let mut depo = Depo::yeni(10);
      println!("{:?}", depo.ekle(7));
      println!("{:?}", depo.ekle(5));
      println!("{:?}", depo.cikar(9));
      println!("stok: {}", depo.stok());
  }
solution: |
  #[derive(Debug, PartialEq)]
  pub enum StokHatasi {
      KapasiteAsildi { bos_yer: u32 },
      Yetersiz { mevcut: u32 },
  }

  pub struct Depo {
      kapasite: u32,
      stok: u32,
  }

  impl Depo {
      pub fn yeni(kapasite: u32) -> Depo {
          assert!(kapasite > 0, "kapasite sıfır olamaz");
          Depo { kapasite, stok: 0 }
      }

      pub fn stok(&self) -> u32 {
          self.stok
      }

      pub fn ekle(&mut self, adet: u32) -> Result<u32, StokHatasi> {
          let bos_yer = self.kapasite - self.stok;
          if adet > bos_yer {
              return Err(StokHatasi::KapasiteAsildi { bos_yer });
          }
          self.stok += adet;
          Ok(self.stok)
      }

      pub fn cikar(&mut self, adet: u32) -> Result<u32, StokHatasi> {
          if adet > self.stok {
              return Err(StokHatasi::Yetersiz { mevcut: self.stok });
          }
          self.stok -= adet;
          Ok(self.stok)
      }
  }

  fn main() {
      let mut depo = Depo::yeni(10);
      println!("{:?}", depo.ekle(7));
      println!("{:?}", depo.ekle(5));
      println!("{:?}", depo.cikar(9));
      println!("stok: {}", depo.stok());
  }
check: tests
tests: |
  #[test]
  #[should_panic(expected = "kapasite sıfır olamaz")]
  fn sifir_kapasite_panik_yapar() {
      Depo::yeni(0);
  }

  #[test]
  fn ekle_ve_cikar_mutlu_yol() -> Result<(), StokHatasi> {
      let mut depo = Depo::yeni(10);
      assert_eq!(depo.ekle(4)?, 4, "boş depoya 4 eklenince stok 4");
      assert_eq!(depo.ekle(6)?, 10, "kapasite tam dolabilir");
      assert_eq!(depo.cikar(3)?, 7, "10 - 3 = 7");
      Ok(())
  }

  #[test]
  fn yeni_depo_bos_baslar() {
      assert_eq!(Depo::yeni(1).stok(), 0, "yeni deponun stoğu 0 olmalı");
  }

  #[test]
  fn kapasite_asimi_hata_dondurur() {
      let mut depo = Depo::yeni(10);
      depo.ekle(8).unwrap();
      assert_eq!(depo.ekle(3), Err(StokHatasi::KapasiteAsildi { bos_yer: 2 }), "8/10 doluyken 2 yer kalır");
      assert_eq!(depo.stok(), 8, "başarısız ekleme stoğu değiştirmemeli");
  }

  #[test]
  fn devasa_ekleme_tasma_panigi_vermez() {
      let mut depo = Depo::yeni(10);
      depo.ekle(1).unwrap();
      assert_eq!(depo.ekle(u32::MAX), Err(StokHatasi::KapasiteAsildi { bos_yer: 9 }), "stok + u32::MAX taşmamalı");
      assert_eq!(depo.stok(), 1, "başarısız ekleme stoğu değiştirmemeli");
  }

  #[test]
  fn yetersiz_stok_hata_dondurur() {
      let mut depo = Depo::yeni(5);
      depo.ekle(2).unwrap();
      assert_eq!(depo.cikar(3), Err(StokHatasi::Yetersiz { mevcut: 2 }), "2 varken 3 çıkarılamaz");
      assert_eq!(depo.stok(), 2, "başarısız çıkarma stoğu değiştirmemeli");
      assert_eq!(depo.cikar(2), Ok(0), "tüm stok çıkarılabilir");
  }
hints:
  - "Panik için Modül 10'daki `assert!(kosul, \"mesaj\")` kalıbı en kısasıdır: `assert!(kapasite > 0, \"kapasite sıfır olamaz\");`"
  - "Önce koşulu kontrol edip hatayla **erken dön**, stoğu ancak sonra değiştir. Böylece hata durumunda stok dokunulmadan kalır."
  - "`ekle` için boş yeri hesapla: `let bos_yer = self.kapasite - self.stok; if adet > bos_yer { return Err(StokHatasi::KapasiteAsildi { bos_yer }); }`"
explanation: |
  Bu alıştırma Modül 10'daki ayrımı somutlaştırıyor: kapasitesi 0 olan bir depo oluşturmak **kodda bir
  hatadır** (panik, `#[should_panic]` ile test edilir); dolu depoya ürün eklemeye çalışmak ise **günlük
  hayatın parçasıdır** (`Result`, `assert_eq!(.., Err(..))` ile test edilir).

  `ekle` içinde neden `self.stok + adet > self.kapasite` yerine boş yeri hesapladık? Çünkü toplama
  `u32` sınırını aşabilir: `ekle(u32::MAX)` çağrısı debug modda **taşma paniği** verirdi (gizli
  `devasa_ekleme_tasma_panigi_vermez` testi tam bunu yakalar). Çıkarma ise güvenli, çünkü `stok` hiçbir
  zaman `kapasite`'yi geçemez - bu bir **değişmez (invariant)**. Modül 2'deki `checked_add` de aynı işi
  görür: `None` taşma demektir, `Some(yeni)` ise `yeni <= self.kapasite` koşuluyla ayrıca kontrol edilir
  (bu koşulu desenin içine yazmanı sağlayan *match guard*'ları Modül 21'de göreceksin).

  Gizli testlerdeki `assert_eq!(depo.stok(), 8, ...)` satırları da önemli: hata yolunu test ederken
  sadece dönen hatayı değil, **yan etkilerin olmadığını** da doğrulamak gerekir.
```

Şimdi tersini yap: fonksiyonlar hazır, testleri sen yazacaksın.

```exercise
id: m13-e-sinema-testleri
title: Sinema bileti için hata testleri
difficulty: 3
prompt: |
  Sinema uygulamasının iki fonksiyonu yazılmış ve doğru çalışıyor:

  - `koltuk_kodu(sira, no)`, `no` 1 ile 20 arasında değilse `"koltuk numarası 1-20 arası olmalı"`
    mesajıyla panik yapar; aksi hâlde `"C7"` gibi bir kod döndürür.
  - `yas_coz(girdi)`, metni `u8`'e çevirir; çeviremezse `Err` döndürür.

  `tests` modülüne şu iki testi **sen** yaz:

  1. `koltuk_kodu('A', 0)` çağrısının panik yaptığını `#[should_panic(expected = "...")]` ile doğrulayan bir test.
  2. **`Result<(), ...>` döndüren** ve `yas_coz("18")?` ile `?` kullanan, sonucun `18` olduğunu
     `assert_eq!` ile doğrulayan bir test.
starter: |
  pub fn koltuk_kodu(sira: char, no: u32) -> String {
      assert!((1..=20).contains(&no), "koltuk numarası 1-20 arası olmalı, {no} verildi");
      format!("{sira}{no}")
  }

  pub fn yas_coz(girdi: &str) -> Result<u8, std::num::ParseIntError> {
      girdi.trim().parse::<u8>()
  }

  fn main() {
      println!("{}", koltuk_kodu('C', 7));
      println!("{:?}", yas_coz("18"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      // 1) should_panic testi
      // 2) Result döndüren test
  }
solution: |
  pub fn koltuk_kodu(sira: char, no: u32) -> String {
      assert!((1..=20).contains(&no), "koltuk numarası 1-20 arası olmalı, {no} verildi");
      format!("{sira}{no}")
  }

  pub fn yas_coz(girdi: &str) -> Result<u8, std::num::ParseIntError> {
      girdi.trim().parse::<u8>()
  }

  fn main() {
      println!("{}", koltuk_kodu('C', 7));
      println!("{:?}", yas_coz("18"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      #[should_panic(expected = "koltuk numarası 1-20 arası olmalı")]
      fn sifir_numarali_koltuk_yok() {
          koltuk_kodu('A', 0);
      }

      #[test]
      fn on_sekiz_yas_cozulur() -> Result<(), std::num::ParseIntError> {
          let yas = yas_coz("18")?;
          assert_eq!(yas, 18);
          Ok(())
      }
  }
check: tests
tests: |
  #[test]
  fn fonksiyonlar_hala_dogru() {
      assert_eq!(koltuk_kodu('C', 7), "C7", "fonksiyonu değiştirmemelisin");
      assert_eq!(yas_coz(" 30 "), Ok(30));
      assert_eq!(
          yas_coz("otuz").unwrap_err().kind(),
          &std::num::IntErrorKind::InvalidDigit,
          "\"otuz\" bir sayı değildir"
      );
  }

  #[test]
  #[should_panic(expected = "koltuk numarası")]
  fn yirmi_bir_numara_panik() {
      koltuk_kodu('B', 21);
  }
hints:
  - "Bir test fonksiyonunun üstüne iki öznitelik yazabilirsin: önce `#[test]`, sonra `#[should_panic(expected = \"koltuk numarası\")]`."
  - "`Result` döndüren test: `fn on_sekiz_yas_cozulur() -> Result<(), std::num::ParseIntError> { ... }`. Gövdede `let yas = yas_coz(\"18\")?;` yaz."
  - "Result testinin son satırı noktalı virgülsüz `Ok(())` olmalı; ondan önce `assert_eq!(yas, 18);`."
require:
  - pattern: "should_panic\\s*\\(\\s*expected\\s*=\\s*\"[^\"]+\""
    message: "Panik testinde boş olmayan bir mesaj parçasıyla `#[should_panic(expected = \"...\")]` kullanmalısın, `expected`'siz (ya da `expected = \"\"`) hâli her paniği kabul eder."
  - pattern: "koltuk_kodu\\s*\\(\\s*'[^']+'\\s*,\\s*0\\s*\\)"
    message: "Panik testi `koltuk_kodu('A', 0)` çağrısını denemeli."
  - pattern: "->\\s*Result\\s*<\\s*\\(\\s*\\)"
    message: "En az bir testin `Result<(), ...>` döndürmeli."
  - pattern: "yas_coz\\([^)]*\\)\\s*\\?"
    message: "Result testinde `yas_coz(...)?` biçiminde `?` operatörünü kullanmalısın."
explanation: |
  `expected` için mesajın **sabit** kısmını seçmek en sağlamıdır: `"koltuk numarası 1-20 arası olmalı"`
  ifadesi her geçersiz numarada aynıdır, sondaki `"0 verildi"` ise girdiye göre değişir.

  Result testinde hata tipi olarak `std::num::ParseIntError` yazdık; çünkü `?` ile yükselen hata tam
  olarak bu tiptedir. `Box<dyn std::error::Error>` yazsaydın da çalışırdı - farklı hata tiplerini aynı
  testte `?` ile kullanmak istediğinde daha esnektir.

  Dikkat: Result testi **mutlu yolu** test ediyor (`?` başarısızlık beklemiyor). Hata yolunu test etmek
  isteseydin `?` değil, hatanın kendisine bakan bir `assert` kullanırdın. `ParseIntError` elle
  oluşturulamadığı için `assert_eq!(yas_coz("otuz"), Err(...))` yazamazsın; gizli testteki gibi
  `yas_coz("otuz").unwrap_err().kind()` ile `IntErrorKind::InvalidDigit`'i karşılaştırmak, sadece
  `is_err()` demekten çok daha kesindir (`"300"` için tür `PosOverflow` olurdu).
```

## Özet

:::remember
- `#[should_panic]`: test panik yaparsa **geçer**. Her zaman `expected = "mesaj parçası"` ekle; yoksa yanlış sebepten (sıfıra bölme, taşma, dizin hatası) de geçer.
- `expected` büyük/küçük harf duyarlı bir **alt dizge** kontrolüdür; mesajın sabit kısmını seç.
- Test `Result<(), E>` döndürebilir (`E: Debug`): `Ok(())` → geçer, `Err` → kalır. İçinde `?` kullanılabilir. `#[should_panic]` ile birlikte kullanılamaz.
- Hata yolunu test et: `assert_eq!(sonuc, Err(..))` > `matches!` > `is_err()`. Yan etkileri de kontrol et.
- Testler paralel thread'lerde çalışır; panik sadece kendi thread'ini durdurur. Testler **bağımsız** olmalı.
- `cargo test filtre -- --ignored | --include-ignored | --no-capture | --test-threads=1 | --exact`, `--`'den sonrası test programına gider.
:::

```reflect
prompt: |
  Bir takım arkadaşın şöyle diyor: "`#[should_panic]` testlerime `expected` yazmıyorum, nasılsa panik
  oluyor ve test geçiyor." Ona neden ikna edici bir şekilde itiraz edersin?
answer: |
  Model cevap: `expected`'siz bir `#[should_panic]` testi "bir şeyler patladı" der, "doğru şey doğru
  sebeple patladı" demez. Boş liste örneğinde test, bilinçli bir kontrol yüzünden değil sıfıra bölme
  yüzünden geçiyordu; fonksiyon boş listeyi hiç ele almıyordu. Kodda yeni bir hata (taşma, yanlış dizin)
  ortaya çıksa test yine yeşil kalırdı ve hatayı saklardı. `expected` ile mesajın sabit bir parçasını
  verince test, gerçekten bizim koyduğumuz sözleşme kontrolünü doğrular; başka bir panik geldiğinde de
  `panic did not contain expected string` diyerek gerçek mesajı gösterir.
```

```flashcards
- front: "`#[should_panic]` bir testin sonucunu nasıl değiştirir?"
  back: Mantığı tersine çevirir, test fonksiyonu panik yaparsa **geçer**, panik yapmadan biterse kalır (`test did not panic as expected`).
- front: "`#[should_panic(expected = \"x\")]` ne kontrol eder?"
  back: Panik mesajının `"x"` alt dizgesini (büyük/küçük harf duyarlı) içerdiğini. İçermezse test kalır.
- front: "`expected`'siz `#[should_panic]` neden tehlikelidir?"
  back: Her paniği kabul eder; test, sıfıra bölme veya taşma gibi **yanlış bir sebepten** de geçebilir.
- front: "`Result` döndüren bir test ne zaman geçer, ne zaman kalır?"
  back: "`Ok(())` dönerse geçer, `Err(e)` dönerse kalır (koşucu `e`'yi `Debug` ile yazdırır). İçinde `?` kullanılabilir."
- front: "`#[should_panic]` ile `-> Result<(), E>` aynı testte kullanılabilir mi?"
  back: "Hayır: `functions using #[should_panic] must return ()`."
- front: "`cargo test` argümanlarında `--` ne işe yarar?"
  back: "Öncesi Cargo'ya (ör. filtre), sonrası test programına gider (ör. `--ignored`, `--no-capture`, `--test-threads=1`)."
- front: Testler varsayılan olarak nasıl çalışır ve bunun sonucu nedir?
  back: Her biri ayrı thread'de, **paralel**. Sıra değişebilir; ortak kaynağa (dosya, ortam değişkeni) dokunan testler birbirini bozabilir.
- front: "Geçen bir testteki `println!` çıktısını görmek için hangi bayrak kullanılır?"
  back: "`cargo test -- --no-capture` (anında; eski yazımı `--nocapture`) ya da `cargo test -- --show-output` (sonda)."
```
