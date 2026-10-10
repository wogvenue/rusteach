---
id: m19-l02
title: async fn ve .await
minutes: 16
type: lesson
objectives:
  - "`#[tokio::main]` ile bir async program başlatıp makronun ne ürettiğini açıklayabilmek"
  - "`async fn`'in aslında `impl Future<Output = T>` döndürdüğünü gösterebilmek ve E0308/E0728 hatalarını düzeltebilmek"
  - Future'ların `.await` edilmeden çalışmadığını tahmin edip kullanılmayan future uyarısını yorumlayabilmek
  - "Async kodda `std::thread::sleep` yerine `tokio::time::sleep` kullanmanın nedenini açıklayabilmek"
keywords: [async fn, .await, "#[tokio::main]", impl Future, async block, tokio::time::sleep, E0728, E0752]
---

Önceki derste async'in **neden** var olduğunu gördün. Şimdi ellerini kirletme zamanı: ilk async programını
yazacak, `async fn`'in aslında ne döndürdüğünü, `.await`'in tam olarak ne yaptığını ve async dünyasının bir numaralı
kuralını ("asla bloklama!") öğreneceksin.

:::info Bu modülde tokio
Bu modüldeki örnekler **tokio** crate'ini kullanır (Modül 8'de dış crate eklemeyi görmüştün). Kendi projende
`Cargo.toml`'a `tokio = { version = "1", features = ["full"] }` satırını eklemen yeterli. Uygulamadaki
kod blokları tokio'yla hazır gelir.
:::

## İlk async programın

```rust
use std::time::Duration;

async fn hava_durumu(sehir: &str) -> i32 {
    // Bir API'ye soruyormuş gibi biraz bekle
    tokio::time::sleep(Duration::from_millis(50)).await;
    if sehir == "Isparta" { 18 } else { 25 }
}

#[tokio::main]
async fn main() {
    let derece = hava_durumu("Isparta").await;
    println!("Isparta: {derece}°C");
}
```

Üç yeni parça var:

- **`async fn`**: Gövdesi hemen çalışmayan, bunun yerine bir **future** döndüren fonksiyon.
- **`.await`**: "Bu future bitene kadar bekle; beklerken thread'i başka görevlere bırak." Sonuçta future'ın
  ürettiği değeri (`i32`) verir.
- **`#[tokio::main]`**: `main`'i bir runtime içinde çalıştıran bir **öznitelik makrosu (attribute macro)**.

Neden `#[tokio::main]` gerekiyor? Çünkü `main`'i doğrudan `async` yapamazsın:

:::error
```text
error[E0752]: `main` function is not allowed to be `async`
 --> src/main.rs:1:1
  |
1 | async fn main() {
  | ^^^^^^^^^^^^^^^ `main` function is not allowed to be `async`
```
`async fn main` bir future döndürürdü; ama işletim sistemi bir future'ı nasıl yoklayacağını bilmez. Önceki derste
gördüğün gibi **standart kütüphanede runtime yok**. Birinin runtime'ı kurup bu future'ı yoklaması gerekir.
:::

`#[tokio::main]` tam olarak bunu yapar. Makronun ürettiği kod kabaca şudur (bunu elle de yazabilirsin):

```rust
fn main() {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all() // zamanlayıcıları ve ağ sürücüsünü aç
        .build()
        .unwrap();

    // block_on: bu future bitene kadar mevcut thread'i beklet ve future'ı yokla
    let sonuc = runtime.block_on(async {
        println!("runtime içindeyim");
        42
    });
    println!("block_on döndü: {sonuc}");
}
```

Normal `main` senkron dünyadır; `block_on` iki dünya arasındaki **köprüdür**: bir future alır, bitene kadar
yoklar, sonucunu senkron koda geri verir. `#[tokio::main(flavor = "current_thread")]` yazarsan tokio çok thread'li
yerine **tek thread'li** bir runtime kurar; testler ve küçük araçlar için hafif bir seçenektir.

```quiz
question: "`#[tokio::main]` özniteliği `async fn main` için ne yapar?"
options:
  - "`main`'i her çağrıda ayrı bir thread'de yeniden başlatır"
  - "Senkron bir `main` üretir; içinde bir tokio runtime kurar ve senin async gövdeni `block_on` ile bitene kadar çalıştırır"
  - "Derleyiciye `main`'in async olabileceğini söyleyen bir ayardır; runtime'ı Rust'ın kendisi sağlar"
  - Programdaki bütün fonksiyonları otomatik olarak async yapar
answer: 1
explanation: |
  Makro, kodunu senkron bir `fn main()`'e sarar: bir runtime oluşturur ve async gövdeyi `block_on` ile çalıştırır.
  Rust'ın kendisi runtime sağlamaz; `E0752` hatası da bu yüzden vardır.
feedback:
  - "Yeni thread açmaz; tek bir runtime kurar ve gövdeni onda çalıştırır."
  - "Doğru!"
  - "Rust'ta yerleşik runtime yok; runtime'ı tokio getirir."
  - "Yalnızca `main`'i etkiler; diğer fonksiyonların hangisinin async olacağına sen karar verirsin."
```

## async fn bir Future döndürür

`hava_durumu` fonksiyonunun dönüş tipi `i32` gibi görünüyor. Gerçekten öyle mi? `.await`'i unutup sonucu bir `i32`
değişkene koymayı dene:

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:10:23
   |
10 |     let derece: i32 = hava_durumu("Isparta");
   |                 ---   ^^^^^^^^^^^^^^^^^^^^^^ expected `i32`, found future
   |                 |
   |                 expected due to this
   |
note: calling an async function returns a future
  --> src/main.rs:10:23
   |
10 |     let derece: i32 = hava_durumu("Isparta");
   |                       ^^^^^^^^^^^^^^^^^^^^^^
help: consider `await`ing on the `Future`
   |
10 |     let derece: i32 = hava_durumu("Isparta").await;
   |                                             ++++++
```
Derleyici açıkça söylüyor: **async bir fonksiyonu çağırmak bir future döndürür.** Değeri almak için `.await` gerekir.
:::

Yani şu iki imza (neredeyse) aynı şeydir:

```rust
use std::future::Future;

async fn sicaklik() -> i32 {
    23
}

// Derleyicinin yaptığı dönüşüm, kabaca:
fn sicaklik_elle() -> impl Future<Output = i32> {
    async { 23 } // async blok: kendisi de bir future'dır
}

#[tokio::main]
async fn main() {
    println!("{} {}", sicaklik().await, sicaklik_elle().await);
}
```

`impl Future<Output = i32>`, Modül 11'deki **`impl Trait` dönüş tipidir**: "`Future` trait'ini uygulayan,
adını söylemediğim bir tip; bittiğinde `i32` üretir." Tipin gerçek adı derleyicinin ürettiği durum makinesidir ve
kodda yazılamaz. `Output`, `Future` trait'inin **ilişkili tipi (associated type)**: Modül 14'te `Iterator`'ın
`Item`'ında gördüğün yapı (ilişkili tipleri Modül 22'de derinlemesine işleyeceğiz).

**Async bloklar** (`async { ... }`) bir fonksiyon tanımlamadan yerinde bir future oluşturur. Closure'lar gibi
çevrelerindeki değişkenleri ödünç alırlar; `async move { ... }` ise onları **taşır** (Modül 14'teki `move`
closure'larıyla aynı mantık).

```fill
prompt: "`async fn` kullanmadan aynı fonksiyonu yaz: dönüş tipi bir future olsun ve gövde bir async blok olsun."
code: |
  use std::future::Future;

  fn ogrenci_sayisi() -> impl ___0<Output = ___1> {
      ___2 {
          let sinif = vec!["Ali", "Zeynep", "Mert"];
          sinif.len()
      }
  }

  #[tokio::main]
  async fn main() {
      let n = ogrenci_sayisi().___3;
      println!("{n} öğrenci");
  }
blanks:
  - ["Future"]
  - ["usize"]
  - ["async", "async move"]
  - ["await"]
output: 3 öğrenci
explanation: |
  `impl Future<Output = usize>`: "bittiğinde `usize` üreten bir future". Gövdedeki `async { ... }` bloğu o future'ı
  oluşturur; blok içindeki son ifade (`sinif.len()`) future'ın `Output`'udur. Değeri almak için `.await` şart.
```

:::deep async fn argümanlarını ödünç alır
`async fn ortalama(notlar: &[u32]) -> u32` aslında `fn ortalama<'a>(notlar: &'a [u32]) -> impl Future<Output = u32> + 'a`
demektir: dönen future, **referansı içinde saklar**, çünkü gövde henüz çalışmadı. Bu yüzden future, ödünç aldığı
veriden uzun yaşayamaz (Modül 12'deki yaşam süresi kuralları). Aşağıdaki kontrol bunu sınıyor.
:::

Modül 12'den bir soru: bu kod derlenir mi?

```compiles
code: |
  use std::future::Future;

  async fn ortalama(notlar: &[u32]) -> u32 {
      notlar.iter().sum::<u32>() / notlar.len() as u32
  }

  fn hazirla() -> impl Future<Output = u32> {
      let notlar = vec![70, 80, 90];
      ortalama(&notlar)
  }

  #[tokio::main]
  async fn main() {
      println!("{}", hazirla().await);
  }
answer: false
error: E0597
explanation: |
  `ortalama(&notlar)` hemen çalışmaz; `&notlar` referansını **içinde tutan** bir future döndürür. `hazirla` bitince
  `notlar` drop edilir ama future hâlâ ona işaret etmektedir: sarkan referans (dangling). Derleyici `E0597`
  (`notlar` does not live long enough) verir. Çözüm: veriyi future'ın içine taşımak, örneğin
  `async move { ortalama(&notlar).await }` ya da `ortalama`'nın `Vec<u32>` almasını sağlamak.
```

## Future'lar beklenmeden çalışmaz

Önceki derste future'ların **tembel** olduğunu söyledik. Bunu gerçekten içselleştirdin mi? Tahmin et:

```predict
code: |
  async fn siparis_al() -> u32 {
      println!("sipariş alındı");
      3
  }

  #[tokio::main]
  async fn main() {
      let gelecek = siparis_al();
      println!("future oluşturuldu");
      let adet = gelecek.await;
      println!("adet: {adet}");
  }
options:
  - |
    sipariş alındı
    future oluşturuldu
    adet: 3
  - |
    future oluşturuldu
    sipariş alındı
    adet: 3
  - |
    future oluşturuldu
    adet: 3
answer: 1
explanation: |
  `siparis_al()` çağrısı gövdeyi **çalıştırmaz**; yalnızca başlangıç durumundaki bir future üretir. Bu yüzden önce
  "future oluşturuldu" yazılır. Gövde, `gelecek.await` ile future ilk kez yoklandığında çalışır: "sipariş alındı",
  sonra değer döner. Python'daki coroutine'ler de böyle davranır; JavaScript'te ise sıra ilk seçenekteki gibi olurdu.
```

Peki bir future'ı hiç `.await` etmezsen? Gövdesi **hiç çalışmaz**. Derleyici bunu bildiğinden seni uyarır:

:::warning Kullanılmayan future
```text
warning: unused implementer of `Future` that must be used
 --> src/main.rs:7:5
  |
7 |     kaydet();
  |     ^^^^^^^^
  |
  = note: futures do nothing unless you `.await` or poll them
  = note: `#[warn(unused_must_use)]` (part of `#[warn(unused)]`) on by default
```
Bu bir **uyarı**, hata değil; program derlenir ama `kaydet` hiç çalışmaz. "Kaydettim sandım ama veritabanına hiçbir
şey yazılmadı" türünden sinsi hatalar böyle doğar. Async kodda bu uyarıyı **hata gibi** ciddiye al. Uyarıyı
`let _ = kaydet();` ile susturmak da future'ı çalıştırmaz, sadece hatayı gizler.
:::

:::analogy Mektup ve posta kutusu
`kaydet()` çağırmak bir mektup yazıp zarfı kapatmaya benzer: her şey hazırdır ama mektup henüz yola çıkmamıştır.
`.await` mektubu posta kutusuna atmak ve cevabını beklemektir. Zarfı masada unutursan (future'ı drop edersen)
mektup hiç gitmez; postacı da masandaki zarflardan haberdar değildir.
:::

## .await: sırayla bekle, beklerken thread'i bırak

`.await` iki şey yapar: (1) future'ı yoklar; hazırsa değerini verir, (2) hazır değilse **mevcut görevi askıya
alır** ve kontrolü runtime'a bırakır. Runtime o sırada başka görevleri çalıştırır; future'ın beklediği olay
gerçekleşince görev kaldığı yerden devam eder. Kod **sıralı** görünür ama thread hiç boşta beklemez.

Arka arkaya yazılan `.await`'ler **sırayla** çalışır: ikinci iş, birincisi bitmeden başlamaz.

```rust
use std::time::{Duration, Instant};
use tokio::time::sleep;

async fn cay_demle() -> &'static str {
    sleep(Duration::from_millis(120)).await;
    "çay"
}

async fn yumurta_hasla() -> &'static str {
    sleep(Duration::from_millis(80)).await;
    "yumurta"
}

#[tokio::main]
async fn main() {
    let basla = Instant::now();
    let icecek = cay_demle().await; // önce çay (120 ms)
    let yemek = yumurta_hasla().await; // sonra yumurta (80 ms)
    println!("kahvaltı hazır: {icecek} + {yemek}");
    println!("~{} ms", (basla.elapsed().as_millis() + 50) / 100 * 100);
}
```

Toplam ~200 ms: süreler **toplandı**. İkisini aynı anda yapmak (çay demlenirken yumurtayı haşlamak) için bir
sonraki dersteki `join!`'e ihtiyacın var. Önemli olan şu: `.await` kendi başına eşzamanlılık **yaratmaz**; sadece
beklerken thread'i başka **görevlere** açar.

`.await` yalnızca async bağlamda kullanılabilir. Normal bir fonksiyon ya da normal bir closure içinde denersen:

:::error
```text
error[E0728]: `await` is only allowed inside `async` functions and blocks
 --> src/main.rs:6:32
  |
5 | fn main() {
  | --------- this is not `async`
6 |     let derece = hava_durumu().await;
  |                                ^^^^^ only allowed inside `async` functions and blocks
```
Senkron bir fonksiyonun "askıya alınıp sonra devam etmesi" mümkün değildir; bunun için derleyicinin onu bir durum
makinesine çevirmesi, yani fonksiyonun `async` olması gerekir. Senkron koddan bir future çalıştırmak istiyorsan
köprü `block_on`'dur.
:::

```compiles
code: |
  async fn fiyat() -> u32 {
      15
  }

  async fn toplam() -> u32 {
      let hesapla = |adet: u32| {
          let birim = fiyat().await;
          birim * adet
      };
      hesapla(4)
  }

  #[tokio::main]
  async fn main() {
      println!("{}", toplam().await);
  }
answer: false
error: E0728
explanation: |
  `toplam` async olsa da `hesapla` **sıradan bir closure**dur ve içi senkron çalışır; `.await` orada kullanılamaz
  (`E0728`). Async bir fonksiyonun içinde olmak yetmez, `.await`'in doğrudan bulunduğu gövde async olmalı. Çözümler:
  `let birim = fiyat().await;` satırını closure'ın dışına almak ya da Ders 6'da göreceğin **async closure**
  (`async |adet: u32| { ... }`) kullanmak.
```

```parsons
prompt: Sırayla önce kullanıcıyı, sonra onun siparişlerini getiren ve sonucu yazdıran async programı kur.
lines: |
  async fn kullanici_getir(id: u32) -> String {
      format!("kullanıcı#{id}")
  }
  async fn siparis_sayisi(kullanici: &str) -> usize {
      kullanici.len()
  }
  #[tokio::main]
  async fn main() {
      let kullanici = kullanici_getir(7).await;
      let n = siparis_sayisi(&kullanici).await;
      println!("{kullanici}: {n}");
  }
distractors: |
  fn main() {
      let n = siparis_sayisi(&kullanici);
explanation: |
  `#[tokio::main]` öznitelik makrosu `async fn main`'in hemen üstünde olmalı. Siparişleri getirmek için kullanıcı
  adına ihtiyaç olduğundan iki `.await` **sırayla** yazılır. `.await`'siz satır bir future'ı `n`'ye koyardı, `{n}`
  ise `Display` uygulamayan bir future'ı yazdırmaya çalışırdı. Async olmayan `fn main` de `.await` kullanamaz.
```

## Asla bloklama: tokio::time::sleep ve std::thread::sleep

Async'in bir numaralı kuralını keşfetme zamanı. Aşağıdaki programda iki görev `join!` ile **aynı anda**
ilerletiliyor (`join!`'i bir sonraki derste ayrıntısıyla göreceğiz; şimdilik "ikisini birlikte yokla" demek). Ama
dikkat: bekleme için `std::thread::sleep` kullanılmış.

```predict
code: |
  use std::time::Duration;

  async fn gorev(ad: &str, ms: u64) {
      println!("{ad} başladı");
      std::thread::sleep(Duration::from_millis(ms));
      println!("{ad} bitti");
  }

  #[tokio::main]
  async fn main() {
      tokio::join!(gorev("A", 60), gorev("B", 10));
  }
options:
  - |
    A başladı
    B başladı
    B bitti
    A bitti
  - |
    A başladı
    A bitti
    B başladı
    B bitti
  - |
    B başladı
    B bitti
    A başladı
    A bitti
answer: 1
explanation: |
  `std::thread::sleep` **thread'i uyutur**; future'a "beklerken başkasına geç" deme şansı vermez. İçinde hiç `.await`
  olmadığı için `gorev("A", 60)` ilk yoklamada baştan sona çalışır, 60 ms boyunca thread'i kilitler; B ancak sonra
  başlayabilir. Eşzamanlılık tamamen kayboldu. `tokio::time::sleep(..).await` kullansaydın A beklemeye geçtiği anda
  B başlardı ve çıktı ilk seçenekteki gibi olurdu.
```

Şimdi doğru versiyonu çalıştır ve farkı gör:

```rust
use std::time::Duration;

async fn gorev(ad: &str, ms: u64) {
    println!("{ad} başladı");
    tokio::time::sleep(Duration::from_millis(ms)).await; // görevi askıya alır, thread serbest
    println!("{ad} bitti");
}

#[tokio::main]
async fn main() {
    tokio::join!(gorev("A", 60), gorev("B", 10));
}
```

`tokio::time::sleep` bir future döndürür: runtime'ın zamanlayıcısına "beni 60 ms sonra uyandır" diye kayıt düşer ve
`Pending` döner. Thread o sırada başka işleri yürütür. `std::thread::sleep` ise işletim sistemine "bu thread'i
durdur" der: üzerindeki **bütün** görevler donar.

:::warning Async'te bloklayan her şey aynı sorunu yaratır
Sadece `std::thread::sleep` değil: standart kütüphanenin senkron dosya/ağ işlemleri (`std::fs::read_to_string`,
`std::net::TcpStream`), uzun süren hesaplamalar, `std::sync::mpsc::Receiver::recv` gibi bloklayan çağrılar da
executor'ın thread'ini kilitler. Async kodda async karşılıklarını kullan: `tokio::fs`, `tokio::net`,
`tokio::sync`. Kaçınılmaz bloklayan işler için çözüm (`spawn_blocking`) Ders 7'de.
:::

Şimdi öğrendiklerini bir alıştırmada birleştir.

```exercise
id: m19-e-sepet-tutari
title: Async fiyat sorgusuyla sepet tutarı
difficulty: 2
prompt: |
  Bir market uygulamasında fiyatlar uzak bir servisten geliyor: `fiyat_getir(urun)` bir **async** fonksiyon ve
  bilinmeyen ürün için `None` döndürüyor.

  `sepet_tutari` fonksiyonunu tamamla:

  - Sepetteki her `(urun, adet)` çifti için fiyatı **`.await`** ile sor.
  - Fiyat yoksa `Err(format!("{urun} bulunamadı"))` döndür; **ilk** bilinmeyen üründe dur.
  - Hepsi bulunursa `Ok(toplam)` döndür (`fiyat * adet` toplamı). Boş sepet `Ok(0)`'dır.
starter: |
  use std::time::Duration;

  async fn fiyat_getir(urun: &str) -> Option<u32> {
      // Fiyat servisine soruyormuş gibi kısa bir bekleme
      tokio::time::sleep(Duration::from_millis(5)).await;
      match urun {
          "simit" => Some(15),
          "ayran" => Some(20),
          "çay" => Some(10),
          "lahmacun" => Some(90),
          _ => None,
      }
  }

  async fn sepet_tutari(sepet: &[(&str, u32)]) -> Result<u32, String> {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let sepet = [("simit", 2), ("çay", 3)];
      println!("{:?}", sepet_tutari(&sepet).await);
  }
solution: |
  use std::time::Duration;

  async fn fiyat_getir(urun: &str) -> Option<u32> {
      // Fiyat servisine soruyormuş gibi kısa bir bekleme
      tokio::time::sleep(Duration::from_millis(5)).await;
      match urun {
          "simit" => Some(15),
          "ayran" => Some(20),
          "çay" => Some(10),
          "lahmacun" => Some(90),
          _ => None,
      }
  }

  async fn sepet_tutari(sepet: &[(&str, u32)]) -> Result<u32, String> {
      let mut toplam = 0;
      for &(urun, adet) in sepet {
          let fiyat = fiyat_getir(urun)
              .await
              .ok_or(format!("{urun} bulunamadı"))?;
          toplam += fiyat * adet;
      }
      Ok(toplam)
  }

  #[tokio::main]
  async fn main() {
      let sepet = [("simit", 2), ("çay", 3)];
      println!("{:?}", sepet_tutari(&sepet).await);
  }
check: tests
tests: |
  #[tokio::test]
  async fn bilinen_urunlerin_toplami() {
      let sonuc = sepet_tutari(&[("simit", 2), ("çay", 3)]).await;
      assert_eq!(sonuc, Ok(60), "2 simit (30) + 3 çay (30) = 60 TL");
  }

  #[tokio::test]
  async fn tek_urun_cok_adet() {
      let sonuc = sepet_tutari(&[("lahmacun", 4)]).await;
      assert_eq!(sonuc, Ok(360), "4 lahmacun × 90 = 360 TL");
  }

  #[tokio::test]
  async fn bos_sepet_sifirdir() {
      assert_eq!(sepet_tutari(&[]).await, Ok(0), "boş sepetin tutarı 0 olmalı");
  }

  #[tokio::test]
  async fn ilk_bilinmeyen_urunde_hata() {
      let sonuc = sepet_tutari(&[("ayran", 1), ("pizza", 2), ("hamburger", 1)]).await;
      assert_eq!(sonuc, Err(String::from("pizza bulunamadı")), "ilk bilinmeyen ürünün adı hata mesajında olmalı");
  }
hints:
  - "Sepeti `for &(urun, adet) in sepet` ile gez; her ürün için `fiyat_getir(urun).await` bir `Option<u32>` verir."
  - "`Option`'ı `Result`'a çevirmek için Modül 10'daki `ok_or` işini görür; ardından `?` ile ilk hatada fonksiyondan çık."
  - "`let fiyat = fiyat_getir(urun).await.ok_or(format!(\"{urun} bulunamadı\"))?; toplam += fiyat * adet;` ve en sonda `Ok(toplam)`."
explanation: |
  Async fonksiyonlar, bildiğin bütün araçlarla birlikte çalışır: `for` döngüsü, `?` operatörü, `ok_or`...
  Tek fark, değeri almak için future'ı `.await` etmen gerekmesi. `?`, async fonksiyonda da ilk hatada erken dönüş
  yapar; geriye kalan ürünler için fiyat **hiç sorulmaz** (son testteki `"hamburger"`).

  Fiyatlar burada **sırayla** soruluyor: 3 ürünlük bir sepet ≈ 3 × 5 ms. Sıra önemli olmadığına göre hepsini aynı
  anda sorabilirdik. Bir sonraki derste `join!` ve `JoinSet` ile tam olarak bunu yapacağız.

  Not: `ok_or(format!(..))` hata mesajını her ürün için (bulunsa bile) oluşturur; `ok_or_else(|| format!(..))`
  ise yalnızca gerektiğinde oluşturur (Modül 10'daki eager/lazy farkı).
```

## Özet

:::remember
- `async fn f() -> T` gövdesini çalıştırmaz; **`impl Future<Output = T>`** döndürür. Değeri almak için `.await`.
- `.await` yalnızca `async fn` ya da `async { }` blok gövdesinde kullanılabilir → aksi hâlde **E0728**.
- `main` doğrudan async olamaz (**E0752**); `#[tokio::main]` runtime'ı kurar ve gövdeyi `block_on` ile çalıştırır.
- Future **tembeldir**: `.await` edilmeyen future hiç çalışmaz; "unused implementer of `Future`" uyarısını ciddiye al.
- Ardışık `.await`'ler **sırayla** çalışır; eşzamanlılık için `join!`/`spawn` gerekir (Ders 3).
- Async kodda **asla bloklama**: `std::thread::sleep` değil `tokio::time::sleep(..).await`.
:::

```reflect
prompt: "`std::thread::sleep` ve `tokio::time::sleep(..).await` ikisi de \"bekle\" diyor. Async bir görevin içinde aralarındaki fark nedir ve neden önemlidir?"
answer: |
  Model cevap: `std::thread::sleep` işletim sistemine bütün thread'i durdurmasını söyler; o thread üzerinde
  çalışan diğer görevler de donar ve eşzamanlılık kaybolur. `tokio::time::sleep` ise runtime'ın zamanlayıcısına
  bir kayıt düşüp `Pending` döner; görev askıya alınır ama thread serbest kalır ve başka görevleri yürütür. Süre
  dolunca görev uyandırılır ve kaldığı yerden devam eder.
```

```flashcards
- front: "`async fn hesapla() -> u32` çağrıldığında ne döner?"
  back: "Bir future: `impl Future<Output = u32>`. Gövde, future yoklanana (`.await`) kadar çalışmaz."
- front: "`E0728` hatası ne anlama gelir?"
  back: "`.await`, async olmayan bir fonksiyon ya da closure içinde kullanılmış. `.await` yalnızca `async fn` ve `async { }` gövdelerinde geçerlidir."
- front: "`E0752` hatası neden çıkar ve nasıl çözülür?"
  back: "`main` doğrudan `async` yapılmış. Bir runtime gerekir: `#[tokio::main]` (ya da elle `Runtime::block_on`)."
- front: "`#[tokio::main]` arka planda hangi çağrıyı kullanır?"
  back: "Bir tokio `Runtime` kurar ve async gövdeyi `runtime.block_on(...)` ile bitene kadar çalıştırır."
- front: "`.await` edilmeyen bir future'a ne olur?"
  back: "Hiç çalışmaz; drop edilince yok olur. Derleyici \"unused implementer of `Future` that must be used\" uyarısı verir."
- front: Async kodda neden `std::thread::sleep` kullanılmaz?
  back: "Thread'i bloklar; aynı thread'deki bütün görevler donar. Yerine `tokio::time::sleep(..).await` kullan."
- front: "`async { }` ile `async move { }` farkı nedir?"
  back: "`async { }` çevredeki değişkenleri ödünç alır; `async move { }` onları future'ın içine **taşır** (`move` closure gibi)."
```
