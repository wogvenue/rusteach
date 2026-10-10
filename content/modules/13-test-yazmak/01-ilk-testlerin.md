---
id: m13-l01
title: İlk Testlerin
minutes: 22
type: lesson
objectives:
  - "`#[cfg(test)]` modülü, `use super::*;` ve `#[test]` fonksiyonlarından oluşan bir test modülünü sıfırdan yazabilmek"
  - "`assert!`, `assert_eq!` ve `assert_ne!` arasından duruma uygun olanı seçip özel hata mesajıyla kullanabilmek"
  - "`cargo test` çıktısındaki `left`/`right` satırlarını, dosya:satır bilgisini ve özet satırını okuyup hatanın yerini bulabilmek"
  - Rust'ta özel (private) fonksiyonların neden test edilebildiğini modül ağacıyla açıklayabilmek
keywords: ["#[test]", "#[cfg(test)]", assert, assert_eq, assert_ne, cargo test, birim testi, use super]
---

Bir fonksiyon yazdın, `main`'de birkaç `println!` ile denedin, çalışıyor. Üç hafta sonra o fonksiyona
küçük bir "iyileştirme" yaptın. Hâlâ çalışıyor mu? Emin olmak için o eski `println!`'leri yeniden yazıp
çıktıları **gözle** mi kontrol edeceksin? Ya projede 300 fonksiyon varsa?

Bu derste bu işi bilgisayara devretmeyi öğreneceksin: **otomatik test (automated test)**. Rust'ta test
yazmak için hiçbir ek kütüphane kurman gerekmez — test altyapısı dilin ve Cargo'nun içine gömülüdür.

:::ferris
Testler, gelecekteki sana yazılmış küçük mektuplardır: "Bu fonksiyon böyle çalışmalı, bozarsan haber
veririm." Birkaç satırlık yatırım, yıllarca huzur! 🦀
:::

## Derleyici her şeyi yakalayamaz

Rust derleyicisi tip hatalarını, sahiplik ihlallerini ve sarkan referansları yakalar. Ama şu fonksiyona
bak — bir arkadaşın KDV hesabını "sadeleştirmiş":

```rust
pub fn kdv_ekle(fiyat: u32) -> u32 {
    fiyat + fiyat / 100 * 20 // önce böl, sonra çarp
}

fn main() {
    println!("100 TL → {} TL", kdv_ekle(100));
    println!("150 TL → {} TL", kdv_ekle(150));
}
```

Çalıştır ve ikinci satıra dikkatle bak. `150 TL`'nin %20 KDV'li hâli `180 TL` olmalıydı ama `170` çıkıyor.
Sebep Modül 2'den tanıdık: **tamsayı bölmesi** küsuratı atar. `150 / 100` sonucu `1`'dir, `1 * 20 = 20`.
Doğrusu önce çarpmak, sonra bölmektir: `fiyat * 20 / 100`.

Derleyici bu hatayı göremez; çünkü kod tip açısından kusursuzdur. Derleyici "**kod geçerli mi?**" sorusunu
yanıtlar, "**kod doğru olanı mı yapıyor?**" sorusunu değil. İkinci soruyu yanıtlamanın yolu, beklentini
koda dökmektir: *"`kdv_ekle(150)` sonucu `180` olmalı."* İşte bu cümlenin çalıştırılabilir hâline
**test** diyoruz.

:::analogy Pilotun kontrol listesi
Pilotlar her kalkıştan önce, binlerce kez uçmuş olsalar bile, aynı **kontrol listesini** (checklist)
baştan sona okur: yakıt, flaplar, fren... Hafızaya güvenmezler; çünkü bir maddeyi atlamanın bedeli büyüktür.
Otomatik testler de kodunun kontrol listesidir: her değişiklikten sonra `cargo test` dersin, liste saniyeler
içinde baştan sona yeniden kontrol edilir. Yorulmaz, unutmaz, atlamaz.
:::

Diğer dillerde test yazmak için genellikle ayrı bir çerçeve (framework) kurarsın: Java'da JUnit,
Python'da `pytest`, JavaScript'te Jest. Rust'ta ise `#[test]` özniteliği (attribute) ve `cargo test`
komutu dilin standart parçasıdır; her Rust projesi aynı şekilde test edilir.

```quiz
question: Aşağıdakilerden hangisi Rust derleyicisinin **yakalayamayacağı**, ancak bir testin yakalayabileceği bir hatadır?
options:
  - Bir `String`'i taşıdıktan sonra tekrar kullanmak
  - "`i32` beklenen yere `&str` vermek"
  - İndirim hesabında `%10` yerine yanlışlıkla `%100` indirim uygulamak
  - Var olmayan bir fonksiyonu çağırmak
answer: 2
explanation: |
  Yanlış yüzde, tip açısından tamamen geçerli bir koddur: `u32` alır, `u32` döndürür. Derleyici
  **niyetini** bilemez. Testler tam bu boşluğu doldurur: beklenen davranışı (`indirim(200) == 180`)
  yazarsın ve kod bu beklentiden saparsa test kırmızıya döner. Diğer üç seçenek derleme hatasıdır
  (sırasıyla E0382, E0308, E0425).
feedback:
  - Bu bir sahiplik hatası (E0382); derleyici zaten yakalar.
  - Tip uyuşmazlığı (E0308); derleyici zaten yakalar.
  - Doğru! Mantık hataları ancak beklentiyi yazan bir testle yakalanır.
  - Bu E0425 hatasıdır; derleyici zaten yakalar.
```

## İlk test modülün

`cargo new --lib magaza` komutuyla bir kütüphane projesi oluşturduğunda Cargo, `src/lib.rs` içine sana
hazır bir örnek test koyar. Biz de aynı kalıpla KDV fonksiyonumuzu (bu sefer doğru hâliyle) test edelim:

```rust,title=src/lib.rs
pub fn kdv_ekle(fiyat: u32) -> u32 {
    fiyat + fiyat * 20 / 100
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yuz_liranin_kdvli_hali() {
        assert_eq!(kdv_ekle(100), 120);
    }

    #[test]
    fn sifir_liraya_kdv_eklenmez() {
        assert_eq!(kdv_ekle(0), 0);
    }
}
```

Satır satır inceleyelim:

| parça | ne işe yarar? |
|---|---|
| `#[cfg(test)]` | **Koşullu derleme (conditional compilation)**: bu modül *sadece* `cargo test` sırasında derlenir. `cargo build` ile üretilen programa test kodu girmez. |
| `mod tests { ... }` | Testleri ayrı bir **iç modülde** toplarız (Modül 8). İsim gelenektir; `tests` olmak zorunda değil. |
| `use super::*;` | `tests` modülü, `lib.rs`'in bir **çocuk** modülüdür. `super` ebeveyn modülü gösterir; `*` oradaki her şeyi kapsama alır. |
| `#[test]` | "Bu fonksiyon bir testtir" der. Test fonksiyonu parametre almaz ve (şimdilik) bir şey döndürmez. |
| `assert_eq!(a, b)` | `a == b` değilse **panik** yapar. Panik yapan test **başarısız** sayılır. |

Kural çok basit: **test fonksiyonu panik yapmadan biterse geçer, panik yaparsa kalır.** Tüm `assert`
makroları da koşul tutmadığında `panic!` çağırır (Modül 10).

Terminalde `cargo test` dediğinde şu çıktıyı görürsün:

```console
$ cargo test
   Compiling magaza v0.1.0 (C:\projeler\magaza)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.46s
     Running unittests src/lib.rs (target\debug\deps\magaza-21fc602832e2b36c.exe)

running 2 tests
test tests::sifir_liraya_kdv_eklenmez ... ok
test tests::yuz_liranin_kdvli_hali ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests magaza

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

Testlerin tam adı `tests::yuz_liranin_kdvli_hali` biçimindedir: **modül yolu + fonksiyon adı**. Sıralamanın
dosyadakiyle aynı olmadığına dikkat et: test koşucusu testleri **adlarına göre alfabetik** sıralayıp başlatır
(`sifir...` < `yuz...`), ama testler varsayılan olarak **paralel** çalıştığı için sonuç satırları **bitiş
sırasıyla** yazılır (bir sonraki derste ayrıntısıyla). Kısacası testlerin hangi sırayla çalışacağına asla
güvenme. En alttaki `Doc-tests` bölümü, belge yorumlarındaki örnekleri çalıştırır — Ders 4'ün konusu.

:::info Uygulamadaki "Derle" düğmesi
Yukarıdaki gibi `main` içermeyen bloklar uygulamada **kütüphane** olarak derlenir; `#[cfg(test)]` modülü bu
derlemede yok sayılır. Testleri gerçekten **çalıştırmak** için ders içindeki alıştırmaları kullanacaksın:
alıştırmalarda "Kontrol et" düğmesi kodunu `cargo test` ile çalıştırır ve her testin sonucunu tek tek gösterir.
:::

:::deep cargo test perde arkasında ne yapar?
`cargo test`, kodunu `rustc --test` ile derler. Bu bayrak iki şey yapar: `cfg(test)` koşulunu **açar**
(böylece `#[cfg(test)]` işaretli kod derlemeye girer) ve senin `main` fonksiyonunun yerine kendi
**test koşucusunu (test harness)** içeren bir `main` üretir. Bu koşucu `#[test]` ile işaretlenen bütün
fonksiyonların listesini tutar, her birini ayrı bir **thread**'de çalıştırır, paniği yakalar ve sonunda
özet satırını yazdırır. `#[test]` fonksiyonlarının kendisi de `cfg(test)`'e bağlıdır: normal bir
`cargo build`'de hiç derlenmezler.
:::

`use super::*;` satırını unutursan ne olur? Aşağıdaki kod `#[cfg(test)]` kullanmıyor ki uygulamada da
derlensin, ama durum birebir aynı: `tests` bir çocuk modül ve fonksiyonu ebeveynden çağırıyor.

```compiles
code: |
  fn kare(x: i32) -> i32 {
      x * x
  }

  mod tests {
      pub fn kontrol() {
          assert_eq!(kare(3), 9);
      }
  }

  fn main() {
      tests::kontrol();
      println!("tamam");
  }
answer: false
error: E0425
explanation: |
  Her modül kendi **isim alanıdır** (Modül 8). `kare`, crate kökünde tanımlı; `tests` modülünün
  içinden ona `kare` diye ulaşılamaz. Derleyici `cannot find function 'kare' in this scope` (E0425)
  der ve `help: consider importing this function: use crate::kare;` önerir. Test modüllerinin en başına
  `use super::*;` yazmamızın sebebi budur: ebeveyndeki her şeyi tek satırda kapsama alır.
  (`super::kare(3)` diye tam yol yazmak da çalışırdı.)
```

## `assert!`, `assert_eq!` ve `assert_ne!`

Üç temel makron var. Hepsi koşul tutmazsa panik yapar; farkları **ne kontrol ettikleri** ve **hata
mesajında ne gösterdikleri**dir.

```rust
fn tek_mi(n: i32) -> bool {
    n % 2 != 0
}

fn main() {
    // assert!(koşul): koşul true olmalı
    assert!(tek_mi(7));
    assert!(!tek_mi(10));

    // assert_eq!(sol, sag): iki değer eşit olmalı
    let sepet = vec![12, 30, 8];
    assert_eq!(sepet.len(), 3);

    // assert_ne!(sol, sag): iki değer FARKLI olmalı
    let kullanici_kodu = String::from("TR-2024");
    assert_ne!(kullanici_kodu, "");

    println!("Bütün kontroller geçti!");
}
```

Evet, bu makrolar **sıradan kodda da** çalışır; testlere özel değillerdir. Testte kullanıldıklarında
paniklerini test koşucusu yakalar ve "FAILED" olarak raporlar.

| makro | kullanım | ne zaman? |
|---|---|---|
| `assert!(kosul)` | `assert!(liste.is_empty())` | Sonuç zaten `bool` ise: `is_empty`, `contains`, `is_ok`, karşılaştırmalar (`x > 0`) |
| `assert_eq!(a, b)` | `assert_eq!(toplam, 42)` | Bir değerin **beklenen** değere eşit olması — testlerin büyük çoğunluğu |
| `assert_ne!(a, b)` | `assert_ne!(yeni_sifre, eski_sifre)` | Sadece "farklı olsun" yeter, tam değeri önemli değilse |

Neden her şeyi `assert!(a == b)` ile yazmıyoruz? Çünkü başarısızlıkta `assert!` sadece "koşul yanlış"
diyebilir (`assertion failed: a == b`); `assert_eq!` ise **iki tarafın değerini de** gösterir. Hata
ayıklarken bu, saatler kazandırır. `assert_ne!` de aynı biçimde yazar, sadece başlık
``assertion `left != right` failed`` olur ve iki satırda **aynı** değeri görürsün (sorun zaten eşit
olmalarıdır). Bunun bir bedeli var: `assert_eq!`/`assert_ne!`'e verdiğin değerlerin tipi hem `PartialEq`
(karşılaştırma için) hem de `Debug` (yazdırma için) trait'lerini uygulamalıdır (Modül 11).

:::tip `debug_assert!` ailesi
`debug_assert!`, `debug_assert_eq!` ve `debug_assert_ne!` aynı işi yapar ama yalnızca `debug_assertions`
açıkken, yani varsayılan olarak **debug** derlemede çalışır; `--release` derlemede tamamen silinirler. Üretim kodunun içine pahalı tutarlılık kontrolleri koymak
için kullanılır. Testlerde ise her zaman düz `assert!` ailesini yaz: testin kontrolü, derleme ayarına bağlı
olmamalı.
:::

```compiles
code: |
  #[derive(PartialEq)]
  struct Nokta {
      x: i32,
      y: i32,
  }

  fn main() {
      let a = Nokta { x: 1, y: 2 };
      let b = Nokta { x: 1, y: 2 };
      assert_eq!(a, b);
      println!("eşit: {} {}", a.x, b.y);
  }
answer: false
error: E0277
explanation: |
  `Nokta` karşılaştırılabilir (`PartialEq` türetilmiş), ama **yazdırılamaz**. `assert_eq!` başarısız
  olursa iki değeri `{:?}` ile göstermek zorunda olduğundan `Debug` ister:
  `` error[E0277]: `Nokta` doesn't implement `Debug` ``. Derleyicinin önerisi de hazır:
  `help: consider annotating 'Nokta' with #[derive(Debug)]`. Kendi tiplerini test edeceksen
  `#[derive(Debug, PartialEq)]` neredeyse her zaman ilk satırdır. Tersine, `Debug` olup `PartialEq`
  olmasaydı hata `E0369` olurdu (`binary operation '==' cannot be applied`).
```

Peki `assert_eq!` değerleri **taşır** mı? Modül 4'ü hatırla: bir `String`'i bir fonksiyona vermek onu taşır.

```compiles
code: |
  fn main() {
      let sehir = String::from("Isparta");
      assert_eq!(sehir, "Isparta");
      assert_eq!(sehir.len(), 7);
      println!("{sehir} doğrulandı");
  }
answer: true
explanation: |
  Derlenir! `assert_eq!` bir **fonksiyon değil, makrodur** ve içeride iki tarafın **referansını** alır
  (kabaca `match (&sol, &sag) { ... }` koduna açılır). Bu yüzden `sehir` taşınmaz, kontrolden sonra
  kullanılmaya devam eder. Ayrıca `String` ile `&str`'yi doğrudan karşılaştırabildiğine dikkat et:
  standart kütüphane `String: PartialEq<&str>` uygulamasını sağlar.
```

## Başarısız bir testi okumak

KDV fonksiyonunun hatalı (önce bölen) sürümünü iki testle sınayalım. İkinci teste bir de **özel hata mesajı**
ekledik: `assert_eq!`'in üçüncü argümanından itibaren her şey, tıpkı `format!` gibi bir biçim dizgesidir.

```rust
pub fn kdv_ekle(fiyat: u32) -> u32 {
    fiyat + fiyat / 100 * 20
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yuz_liranin_kdvli_hali() {
        assert_eq!(kdv_ekle(100), 120);
    }

    #[test]
    fn yuz_elli_liranin_kdvli_hali() {
        let sonuc = kdv_ekle(150);
        assert_eq!(sonuc, 180, "150 TL'ye %20 KDV eklenince 180 TL olmalı");
    }
}
```

`cargo test` çıktısı (gerçek çıktı):

:::error
```text
running 2 tests
test tests::yuz_liranin_kdvli_hali ... ok
test tests::yuz_elli_liranin_kdvli_hali ... FAILED

failures:

---- tests::yuz_elli_liranin_kdvli_hali stdout ----

thread 'tests::yuz_elli_liranin_kdvli_hali' (50) panicked at src/lib.rs:17:9:
assertion `left == right` failed: 150 TL'ye %20 KDV eklenince 180 TL olmalı
  left: 170
 right: 180
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    tests::yuz_elli_liranin_kdvli_hali

test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```
Okuma sırası: **1)** `FAILED` yazan test adı, **2)** `panicked at src/lib.rs:17:9` → hangi `assert`
satırı patladı, **3)** senin mesajın, **4)** `left` (birinci argüman, yani `sonuc`) ve `right` (ikinci
argüman, `180`). Son satır toplam tabloyu verir; komut çıkış kodu da başarısız (101) olur.
:::

İlk testin **geçtiğine** dikkat et! `100 / 100 * 20` tesadüfen doğru sonucu veriyor. Tek bir "kolay" değerle
test etmek, hatayı saklayabilir. Bu yüzden iyi testler **birden fazla ve özenle seçilmiş** değer dener:
yuvarlak sayılar, yuvarlak olmayanlar, sıfır, sınır değerleri. (Ders 5'te bunu sistematik hâle getireceğiz.)

:::tip Sol ve sağ: bir düzen seç
Bazı dillerde `assertEquals(beklenen, gercek)` sırası zorunludur. Rust tarafları sadece `left` ve `right`
diye adlandırır; hangisinin "beklenen" olduğunu bilmez. Topluluğun yaygın alışkanlığı **önce gerçek sonuç,
sonra beklenen değer**: `assert_eq!(kdv_ekle(150), 180)`. Hangisini seçersen seç, projede **tutarlı** ol;
böylece `left`/`right` satırlarını her seferinde düşünmeden okursun.
:::

Özel mesajlar, özellikle değerin kendisi hikâyeyi anlatmadığında değerlidir. `assert!` için de geçerlidir:

```rust,should_panic
fn main() {
    let stok = 3;
    let istenen = 5;
    assert!(
        stok >= istenen,
        "stokta {stok} ürün var ama {istenen} ürün istendi"
    );
    println!("sipariş onaylandı");
}
```

````quiz
question: |
  Bir test şu satırla başarısız oldu. Hangi bilgiyi **çıkaramazsın**?

  ```text
  thread 'tests::sepet_bos' (51) panicked at src/lib.rs:42:9:
  assertion `left == right` failed
    left: 2
   right: 0
  ```
options:
  - Başarısız olan testin adını ve modülünü
  - Patlayan `assert_eq!`'in bulunduğu satırı
  - "`left` değerinin `assert_eq!`'in birinci argümanından geldiğini"
  - "Fonksiyonun **neden** 2 döndürdüğünü"
answer: 3
explanation: |
  Test çıktısı **ne** olduğunu (beklenen 0, gelen 2) ve **nerede** olduğunu (`src/lib.rs:42:9`, test
  `tests::sepet_bos`) söyler; **neden** olduğunu söylemez. Nedeni bulmak senin işindir — ama artık
  hangi girdinin, hangi satırda, hangi sonucu ürettiğini bildiğin için arama alanı çok küçüktür. Burada
  özel bir mesaj (`"boş sepet 0 ürün içermeli"`) okumayı daha da kolaylaştırırdı.
feedback:
  - Çıkarabilirsin; `tests::sepet_bos` yazıyor.
  - "Çıkarabilirsin; `src/lib.rs:42:9`."
  - Çıkarabilirsin; `left` her zaman birinci argümandır.
  - Doğru! Test sadece belirtiyi gösterir; teşhis sende.
````

:::warning Ondalık sayıları `assert_eq!` ile karşılaştırma
Modül 2'den hatırla: `0.1 + 0.2` tam olarak `0.3` değildir. `assert_eq!(0.1 + 0.2, 0.3)` testi
`left: 0.30000000000000004, right: 0.3` diyerek kalır. Ondalık sonuçları bir **tolerans** ile karşılaştır:
`assert!((sonuc - 0.3).abs() < 1e-9, "sonuç {sonuc}");`

`1e-9` gibi **mutlak** bir tolerans, değerler 1 civarındayken uygundur. Milyonlarla çalışıyorsan yuvarlama
farkı da büyür; o zaman toleransı değerin büyüklüğüyle orantılı seç (ör. `(a - b).abs() <= 1e-9 * b.abs()`).
:::

```predict
code: |
  fn ortalama(a: f64, b: f64) -> f64 {
      (a + b) / 2.0
  }

  fn main() {
      let o = ortalama(0.1, 0.2);
      println!("{}", o == 0.15);
      println!("{}", (o - 0.15).abs() < 1e-9);
  }
options:
  - |
    true
    true
  - |
    false
    true
  - |
    false
    false
answer: 1
explanation: |
  `0.1 + 0.2` ikilik tabanda tam temsil edilemez, `0.30000000000000004` olur; yarısı da `0.15`'ten çok
  az farklıdır. `==` bu küçük farkı affetmez (`false`), tolerans karşılaştırması ise farkın
  `0.000000001`'den küçük olduğunu görür (`true`). Ondalık hesap yapan fonksiyonları test ederken
  ikinci yöntemi kullan.
```

## Özel (private) fonksiyonları test etmek

Birçok dilde "özel metotlar test edilmeli mi, edilebilir mi?" uzun bir tartışmadır; Java'da özel bir
metodu test etmek için yansıma (reflection) gibi hilelere başvurulur. Rust'ta durum nettir:

```rust
// Fiyatlar kuruş cinsinden: 125 = 1,25 TL
pub fn sepet_toplami(fiyatlar: &[u32]) -> u32 {
    let mut toplam = 0;
    for f in fiyatlar {
        toplam += on_kurusa_yuvarla(*f);
    }
    toplam
}

// pub değil: crate dışından görünmez
fn on_kurusa_yuvarla(fiyat: u32) -> u32 {
    (fiyat + 5) / 10 * 10
}

fn main() {
    println!("Sepet: {} kuruş", sepet_toplami(&[125, 94]));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yuvarlama_yukari() {
        assert_eq!(on_kurusa_yuvarla(125), 130); // özel fonksiyon, yine de erişilebilir
    }

    #[test]
    fn toplam_yuvarlanmis_fiyatlarla() {
        assert_eq!(sepet_toplami(&[125, 94]), 220);
    }
}
```

Neden çalışıyor? Modül 8'deki gizlilik kuralı: **bir öğe, tanımlandığı modülde ve o modülün tüm çocuklarında
görünür.** `tests`, `on_kurusa_yuvarla`'nın tanımlandığı modülün çocuğu olduğu için ona erişebilir. Özel bir
istisna değil, sıradan modül kuralı.

:::warning "never used" uyarısı
Özel bir fonksiyonu **sadece** testlerde kullanırsan, normal `cargo build`'de derleyici
`` warning: function `x` is never used `` der — çünkü `#[cfg(test)]` modülü yokken o fonksiyonu kimse
çağırmıyordur. Bu uyarı genellikle gerçek bir şeyi işaret eder: kullanılmayan kodu sil ya da gerçekten
kullanıldığı yere bağla. Yukarıdaki örnekte `on_kurusa_yuvarla`'yı `sepet_toplami` kullandığı için uyarı yoktur.
:::

```quiz
question: "`mod tests` içindeki bir test, aynı dosyadaki `pub` olmayan `fn on_kurusa_yuvarla` fonksiyonunu neden çağırabilir?"
options:
  - "`#[cfg(test)]` gizlilik kurallarını kapatır"
  - "`#[test]` fonksiyonları her şeye erişebilen özel fonksiyonlardır"
  - "`tests` modülü, fonksiyonun tanımlandığı modülün çocuğudur; çocuk modüller ebeveynin özel öğelerini görür"
  - Aynı dosyadaki her şey her zaman `pub` sayılır
answer: 2
explanation: |
  Rust'ta gizlilik **modül ağacına** göre işler: özel bir öğe kendi modülünde ve **alt modüllerinde**
  görünür, üstte ve kardeşlerde görünmez. Test modülünü kodun hemen yanına, bir çocuk modül olarak
  koymamızın sebebi tam olarak budur. `cfg(test)` sadece "bu kod ne zaman derlensin" sorusunu yanıtlar,
  gizlilikle ilgisi yoktur.
feedback:
  - "`cfg` yalnızca koşullu derlemedir; gizliliği değiştirmez."
  - "`#[test]` fonksiyonu sıradan bir fonksiyondur; yalnızca test koşucusuna kaydedilir."
  - Doğru! Bu, Modül 8'deki gizlilik kuralının doğal sonucu.
  - Hayır; aynı dosyada da modüller arası gizlilik geçerlidir (E0603).
```

## Sıra sende: testlerle çalışmak

Önce boşlukları doldurarak bir test modülünün iskeletini hatırla:

```fill
prompt: Boşlukları doldurarak `indirimli` fonksiyonu için çalışan bir test modülü yaz.
code: |
  pub fn indirimli(fiyat: u32, yuzde: u32) -> u32 {
      fiyat - fiyat * yuzde / 100
  }

  #[___0(test)]
  mod tests {
      use ___1::*;

      #[___2]
      fn yuzde_on_indirim() {
          ___3(indirimli(200, 10), 180, "200 TL'ye %10 indirim 180 TL eder");
      }
  }
blanks:
  - ["cfg"]
  - ["super"]
  - ["test"]
  - ["assert_eq!"]
explanation: |
  `#[cfg(test)]` modülün yalnızca test derlemesine girmesini, `use super::*;` ebeveyndeki
  `indirimli`'nin görünmesini, `#[test]` fonksiyonun test olarak kaydedilmesini sağlar.
  `assert_eq!`'in üçüncü argümanı, başarısızlıkta gösterilecek mesajdır.
```

Şimdi gerçek bir hata avı. Aşağıdaki fonksiyon, başlangıç kodundaki teste göre **kalıyor**. "Kontrol et"
düğmesine basıp test çıktısını oku, hatayı bul ve düzelt.

```exercise
id: m13-e-kargo-ucreti
title: Kargo ücretindeki sınır hatası
difficulty: 2
prompt: |
  Bir kargo şirketinin tarifesi şöyle:

  | desi | ücret |
  |---|---|
  | 0 – 5 (5 dahil) | 50 TL |
  | 6 – 10 (10 dahil) | 80 TL |
  | 10'dan fazla | 80 TL + 10'u aşan **her desi** için 10 TL |

  `kargo_ucreti` fonksiyonu yazılmış ama başlangıç kodundaki test kalıyor. Önce testi çalıştırıp
  çıktıdaki `left`/`right` değerlerini oku, sonra fonksiyonu düzelt. Testi **silme**; gizli testler
  tarifenin tüm sınırlarını kontrol edecek.
starter: |
  pub fn kargo_ucreti(desi: u32) -> u32 {
      if desi < 5 {
          50
      } else if desi < 10 {
          80
      } else {
          80 + (desi - 10) * 10
      }
  }

  fn main() {
      println!("3 desi: {} TL", kargo_ucreti(3));
      println!("12 desi: {} TL", kargo_ucreti(12));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn bes_desi_kucuk_paket_sayilir() {
          assert_eq!(kargo_ucreti(5), 50, "5 desi dahil 50 TL olmalı");
      }
  }
solution: |
  pub fn kargo_ucreti(desi: u32) -> u32 {
      if desi <= 5 {
          50
      } else if desi <= 10 {
          80
      } else {
          80 + (desi - 10) * 10
      }
  }

  fn main() {
      println!("3 desi: {} TL", kargo_ucreti(3));
      println!("12 desi: {} TL", kargo_ucreti(12));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn bes_desi_kucuk_paket_sayilir() {
          assert_eq!(kargo_ucreti(5), 50, "5 desi dahil 50 TL olmalı");
      }
  }
check: tests
tests: |
  #[test]
  fn kucuk_paketler_50_tl() {
      assert_eq!(kargo_ucreti(0), 50, "0 desi küçük paket");
      assert_eq!(kargo_ucreti(1), 50, "1 desi küçük paket");
      assert_eq!(kargo_ucreti(5), 50, "5 desi hâlâ küçük paket (sınır dahil)");
  }

  #[test]
  fn orta_paketler_80_tl() {
      assert_eq!(kargo_ucreti(6), 80, "6 desi orta paket");
      assert_eq!(kargo_ucreti(10), 80, "10 desi hâlâ orta paket (sınır dahil)");
  }

  #[test]
  fn buyuk_paketler_desi_basina_artar() {
      assert_eq!(kargo_ucreti(11), 90, "11 desi: 80 + 1 * 10");
      assert_eq!(kargo_ucreti(25), 230, "25 desi: 80 + 15 * 10");
      assert_eq!(kargo_ucreti(100), 980, "100 desi: 80 + 90 * 10");
  }
hints:
  - "Test çıktısındaki `left` değeri fonksiyonun **gerçekte** döndürdüğü değer: `kargo_ucreti(5)` neden 80 dönüyor?"
  - "Tarifede \"5 dahil\" yazıyor. `desi < 5` koşulu 5'i kapsıyor mu? Aynı soruyu 10 için de sor."
  - "İki karşılaştırmayı da `<=` yap: `if desi <= 5 { 50 } else if desi <= 10 { 80 } else { ... }`"
explanation: |
  Bu, yazılımın en yaygın hata türlerinden biridir: **sınır hatası (off-by-one)**. `<` ile `<=`
  arasındaki tek karakterlik fark, tam sınırdaki müşteriye yanlış ücret çıkarır. Dikkat: hatalı sürüm
  `3` ve `12` desi için **doğru** sonuç veriyordu — `main`'deki `println!` denemeleri hatayı hiç
  göstermezdi. Testler bu yüzden özellikle **sınır değerlerini** (5, 6, 10, 11) dener.

  Testteki mesajlar da işini kolaylaştırdı: `"5 desi dahil 50 TL olmalı"` sana hem beklentiyi hem
  kuralı hatırlattı. Gizli testlerin üç ayrı fonksiyona bölündüğüne dikkat et: biri kalırsa, hangi
  **tarife aralığının** bozuk olduğunu adından anlarsın.
```

Son adım: testleri **sen** yaz. Bu alıştırmada hem fonksiyonu tamamlayacak hem de onu koruyan test
modülünü kendin dolduracaksın.

```exercise
id: m13-e-harf-notu-testleri
title: Harf notu ve kendi testlerin
difficulty: 3
prompt: |
  Üniversitenin not sistemi: **90-100 → 'A'**, **80-89 → 'B'**, **70-79 → 'C'**, **60-69 → 'D'**,
  **0-59 → 'F'**.

  1. `harf_notu(puan: u8) -> char` fonksiyonunu tamamla.
  2. Alttaki `tests` modülüne **en az üç** `#[test]` fonksiyonu yaz ve `assert_eq!` kullan. Testlerin
     en az birinde bir **sınır değeri** (örneğin 89 ve 90) denesin.

  "Kontrol et" düğmesi hem senin testlerini hem de gizli testleri çalıştırır; hepsi geçmeli.
starter: |
  pub fn harf_notu(puan: u8) -> char {
      todo!()
  }

  fn main() {
      println!("{}", harf_notu(85));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      // Testlerini buraya yaz.
  }
solution: |
  pub fn harf_notu(puan: u8) -> char {
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

  fn main() {
      println!("{}", harf_notu(85));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn doksan_ve_ustu_a() {
          assert_eq!(harf_notu(90), 'A');
          assert_eq!(harf_notu(100), 'A');
      }

      #[test]
      fn seksen_dokuz_b_dir() {
          assert_eq!(harf_notu(89), 'B', "89 sınırın hemen altında");
      }

      #[test]
      fn elli_dokuz_ve_alti_f() {
          assert_eq!(harf_notu(59), 'F');
          assert_eq!(harf_notu(0), 'F');
      }
  }
check: tests
tests: |
  #[test]
  fn gizli_sinirlar_a_b() {
      assert_eq!(harf_notu(90), 'A', "90 → A");
      assert_eq!(harf_notu(89), 'B', "89 → B");
      assert_eq!(harf_notu(100), 'A', "100 → A");
  }

  #[test]
  fn gizli_sinirlar_c_d_f() {
      assert_eq!(harf_notu(80), 'B', "80 → B");
      assert_eq!(harf_notu(79), 'C', "79 → C");
      assert_eq!(harf_notu(70), 'C', "70 → C");
      assert_eq!(harf_notu(69), 'D', "69 → D");
      assert_eq!(harf_notu(60), 'D', "60 → D");
      assert_eq!(harf_notu(59), 'F', "59 → F");
      assert_eq!(harf_notu(0), 'F', "0 → F");
  }
hints:
  - "Önce fonksiyonu yaz: en yüksek eşikten başlayan bir `if / else if` zinciri en okunaklısıdır (`puan >= 90` ...)."
  - "Bir test şöyle görünür: `#[test] fn doksan_a_dir() { assert_eq!(harf_notu(90), 'A'); }` — bunu `mod tests` içine yaz."
  - "Sınır testi için eşiği ve hemen altını birlikte dene: `harf_notu(90)` → `'A'`, `harf_notu(89)` → `'B'`. Üç ayrı `#[test]` fonksiyonu olmalı."
require:
  - pattern: "(#\\[test\\][\\s\\S]*){3}"
    message: Test modülüne en az üç `#[test]` fonksiyonu yazmalısın.
  - pattern: "assert_eq!"
    message: Testlerinde `assert_eq!` kullanmalısın.
explanation: |
  Eşikleri büyükten küçüğe kontrol etmek, her dalda sadece **alt sınırı** yazmanı sağlar: `puan >= 80`
  dalına gelindiyse `puan`'ın 90'dan küçük olduğu zaten bellidir. Alternatif olarak Modül 7'deki
  `match` aralıklarıyla da yazabilirdin: `match puan { 90..=u8::MAX => 'A', 80..=89 => 'B', ... }`.
  (`u8` 255'e kadar gidebildiği için ilk kol `90..=100` olsaydı `match` kapsayıcı olmazdı.)

  Testlerinde neyi denediğin, kaç test yazdığından daha önemlidir. Sınır değerleri (`90`/`89`,
  `60`/`59`) ve uç değerler (`0`, `100`) en çok hatanın saklandığı yerlerdir. Test adlarının
  **davranışı** anlattığına dikkat et: `seksen_dokuz_b_dir` başarısız olduğunda neyin bozulduğunu
  kodu açmadan anlarsın.
```

## Özet

:::remember
- Test = beklentinin çalıştırılabilir hâli. Derleyici "geçerli mi?" der, test "doğru mu?" der.
- Kalıp: `#[cfg(test)] mod tests { use super::*; #[test] fn davranis_adi() { ... } }`
- Test **panik yapmadan biterse geçer**, panik yaparsa kalır. Tüm `assert` makroları başarısızlıkta panik yapar.
- `assert!(bool)`, `assert_eq!(a, b)`, `assert_ne!(a, b)`; ek argümanlar `format!` gibi özel mesajdır.
- `assert_eq!` için tip `PartialEq` + `Debug` olmalı; değerler taşınmaz (referansla karşılaştırılır).
- Özel fonksiyonlar test edilebilir: `tests` bir **çocuk modüldür**.
- Ondalık sayıları tolerans ile karşılaştır: `(a - b).abs() < 1e-9`.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: `kdv_ekle` örneğinde `100` ile yapılan test neden hatayı yakalayamadı ve
  bu durum, test yazarken değer seçimi hakkında sana ne öğretiyor?
answer: |
  Model cevap: Hatalı kod önce bölüp sonra çarpıyordu; `100 / 100 * 20` tesadüfen tam sayı olduğu için
  doğru sonuç verdi. Tamsayı bölmesinin küsuratı attığı durumu (`150 / 100 = 1`) ancak "yuvarlak olmayan"
  bir değer ortaya çıkarır. Bu yüzden testlerde tek ve kolay bir değer yerine, farklı karakterde birkaç
  değer seçmeliyim: yuvarlak ve yuvarlak olmayan sayılar, sıfır ve özellikle sınır değerleri. Bir testin
  geçmesi kodun doğru olduğunu kanıtlamaz; sadece denediğim durumlarda doğru olduğunu gösterir.
```

```flashcards
- front: "`#[cfg(test)]` özniteliği bir modüle ne yapar?"
  back: Modülü yalnızca `cargo test` derlemesine dahil eder; normal `cargo build` çıktısında test kodu yer almaz (koşullu derleme).
- front: Test modülünün başında neden `use super::*;` yazılır?
  back: "`tests` bir çocuk modüldür; `super::*` ebeveyn modüldeki fonksiyon ve tipleri kapsama alır. Yoksa bulunamayan her ad için hata alırsın (fonksiyonlarda E0425)."
- front: Bir Rust testi ne zaman **başarısız** sayılır?
  back: Test fonksiyonu panik yaptığında (örneğin bir `assert` makrosu tutmadığında).
- front: "`assert_eq!(a, b)` kullanabilmek için `a` ve `b`'nin tipi hangi iki trait'i uygulamalıdır?"
  back: "`PartialEq` (karşılaştırmak için) ve `Debug` (başarısızlıkta `left`/`right` değerlerini yazdırmak için)."
- front: "`assert!(a == b)` yerine neden `assert_eq!(a, b)` tercih edilir?"
  back: Başarısızlıkta `assert_eq!` iki tarafın değerini (`left`/`right`) gösterir; `assert!` sadece koşulun yanlış olduğunu söyler.
- front: "`assert_eq!` çıktısındaki `left` hangi değerdir?"
  back: Makroya verilen **birinci** argüman (`right` ise ikinci).
- front: "`pub` olmayan bir fonksiyon `mod tests` içinden neden çağrılabilir?"
  back: Özel öğeler, tanımlandıkları modülde ve onun **çocuk** modüllerinde görünür; `tests` bir çocuk modüldür.
- front: "İki `f64` değerini testte nasıl karşılaştırmalısın?"
  back: "Tolerans ile: `assert!((a - b).abs() < 1e-9);` — `assert_eq!` küçük yuvarlama farklarında kalır."
```
