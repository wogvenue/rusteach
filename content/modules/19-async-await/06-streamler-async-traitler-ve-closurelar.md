---
id: m19-l06
title: "Stream'ler, async trait'ler ve async closure'lar"
minutes: 22
type: lesson
objectives:
  - "Bir stream'i `while let Some(x) = akis.next().await` döngüsüyle ve `map`/`then`/`buffered`/`collect` adaptörleriyle işleyebilmek"
  - "`stream::unfold` ile kendi stream'ini üretip gerektiğinde `pin!` ile sabitleyebilmek"
  - "Trait'lerde `async fn` tanımlayıp `tokio::spawn` için gereken `Send` sınırını `impl Future<Output = T> + Send` ile ifade edebilmek"
  - "Async closure'ları (`async |x| ...`) ve `AsyncFn`/`AsyncFnMut` sınırlarını kullanarak tekrar deneme gibi yardımcılar yazabilmek"
keywords: [Stream, StreamExt, next, then, buffered, unfold, async trait, RPITIT, Send, async closure, AsyncFn, AsyncFnMut]
---

Bir future **tek bir** değeri "sonra" verir. Peki değerler zamana yayılarak **birer birer** geliyorsa? Kargo
takip bildirimleri, bir sensörün her saniye gönderdiği ölçümler, bir sohbet odasına düşen mesajlar... Bunlar için
async dünyanın `Iterator`'ı olan **stream**'i öğreneceksin. Ardından async kodu soyutlamanın iki modern aracına
geçeceğiz: trait'lerde `async fn` (Rust 1.75) ve **async closure**'lar (Rust 1.85). Ders 2'de "`.await` sıradan bir
closure'ın içinde kullanılamaz" demiştik; bu dersin sonunda o kapıyı da açıyoruz.

## Stream: async dünyanın iterator'ı

Elimizde artık dört "değer üreticisi" var. Tabloya bak, boş köşeyi stream dolduruyor:

| | **tek** değer | **çok** değer |
|---|---|---|
| **Senkron** (hemen) | `T` | `Iterator<Item = T>` (Modül 14) |
| **Async** (zamanla) | `Future<Output = T>` | **`Stream<Item = T>`** |

`Stream` trait'i, Ders 5'teki `Future` ile `Iterator`'ın birleşimidir:

```rust,ignore
pub trait Stream {
    type Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>>;
}
```

`poll_next` üç şey söyleyebilir: `Ready(Some(x))` "yeni eleman geldi", `Ready(None)` "akış bitti",
`Pending` "henüz yeni eleman yok, seni uyandıracağım". Bu trait henüz standart kütüphanede **kararlı değil**;
ekosistem `futures` crate'indeki tanımı kullanır (tokio'nun `tokio_stream` crate'i de aynı trait'i kullanır).
Günlük kodda `poll_next`'i hiç çağırmazsın: **`StreamExt`** uzantı trait'i (extension trait) sana `next()`, `map`,
`filter`, `collect` gibi tanıdık metotlar verir. Modül 11'deki kuralı hatırla: bir trait'in metodunu kullanmak için
trait **kapsamda** olmalı, yani `use futures::StreamExt;` şart.

```rust
use futures::stream::{self, StreamExt};
use std::time::Duration;

#[tokio::main]
async fn main() {
    // stream::iter: herhangi bir iterator'dan hemen hazır elemanlı bir stream yapar
    let mut akis = stream::iter(["Hazırlanıyor", "Kargoya verildi", "Dağıtımda"]);

    // Stream'deki for döngüsü: while let + next().await
    while let Some(durum) = akis.next().await {
        println!("kargo: {durum}");
        tokio::time::sleep(Duration::from_millis(5)).await; // bildirimler arasında zaman geçiyor
    }
    println!("akış bitti");
}
```

`for` döngüsü stream'lerle **çalışmaz**: `for`, senkron `IntoIterator` ister. Stream'de kalıp her zaman
`while let Some(x) = akis.next().await` olur: her turda bir sonraki elemanı **bekle**, `None` gelince çık. Ders 4'teki
`while let Some(m) = rx.recv().await` döngüsü aynı fikirdi: bir `mpsc::Receiver` de aslında bir mesaj akışıdır.

:::analogy Paket siparişi ve gazete aboneliği
**Future**, internetten verdiğin **tek bir sipariş** gibidir: bir kez gelir, iş biter. **Stream** ise bir
**gazete aboneliğidir**: her sabah kapına yeni bir sayı düşer (`Some(gazete)`), arada beklersin (`Pending`),
abonelik bittiğinde artık hiçbir şey gelmez (`None`). Kapıyı her dakika açıp bakmazsın; dağıtıcı zili çalar
(`Waker`).
:::

Stream adaptörleri iterator adaptörleri gibi davranır mı? Modül 14'ü hatırlayarak tahmin et:

```predict
code: |
  use futures::stream::{self, StreamExt};

  #[tokio::main]
  async fn main() {
      let akis = stream::iter(1..=3).map(|x| {
          println!("işleniyor {x}");
          x * 10
      });
      println!("akış hazır");
      let sonuc: Vec<i32> = akis.collect().await;
      println!("{sonuc:?}");
  }
options:
  - |
    işleniyor 1
    işleniyor 2
    işleniyor 3
    akış hazır
    [10, 20, 30]
  - |
    akış hazır
    işleniyor 1
    işleniyor 2
    işleniyor 3
    [10, 20, 30]
  - |
    akış hazır
    [10, 20, 30]
answer: 1
explanation: |
  Modül 14'teki iterator'lar gibi stream adaptörleri de **tembeldir (lazy)**: `map` sadece bir tarif kaydeder,
  closure'ı çalıştırmaz. Hiçbir şey, biri elemanları **çekene** kadar olmaz. Burada çeken `collect().await`'tir: her
  elemanı sırayla ister, `map` closure'ı o anda çalışır. Üstelik bu tembellik iki katlıdır: `collect()` da bir
  future döndürür ve o da ancak `.await` edilince çalışır (Ders 2). Üçüncü seçenek olamaz; `[10, 20, 30]`'u
  üretmek için `map` closure'ının her eleman için bir kez çalışması gerekir.
```

## Stream adaptörleri ve sınırlı eşzamanlılık

`StreamExt` iterator'dan tanıdığın adaptörlerin çoğunu sunar, ama bazılarında async'e özgü bir fark vardır:

| Adaptör | Ne yapar? | Dikkat |
|---|---|---|
| `map(f)` | Her elemanı **senkron** bir fonksiyonla dönüştürür | `f` içinde `.await` yok |
| `then(f)` | Her eleman için bir **future** çalıştırır, sonucunu verir | Sıralı: biri bitmeden diğeri başlamaz |
| `filter(f)` | Elemanları süzer | `f` bir `bool` değil, **future** döndürmeli: `\|x\| future::ready(*x > 0)` |
| `take(n)`, `skip(n)` | İlk `n` elemanı al / atla | Sonsuz stream'leri sınırlamak için ideal |
| `collect()`, `fold(..)`, `count()` | Akışı tüketir | Hepsi future döndürür, `.await` gerekir |
| `buffered(n)` | Future üreten bir stream'den aynı anda en fazla `n` tanesini yürütür | Sonuç **giriş sırasıyla** gelir |
| `buffer_unordered(n)` | Aynısı, ama sonuçlar **bitiş sırasıyla** gelir | Daha hızlı olabilir; sıra rastgeledir |

Son iki satır stream'lerin süper gücüdür. Ders 4'te eşzamanlılığı `Semaphore` ile sınırlamıştık; stream'lerde aynı
iş tek bir satırdır. Dört şehrin hava durumunu, sunucuyu boğmamak için **en fazla ikişer ikişer** soralım:

```rust
use futures::stream::{self, StreamExt};
use std::time::{Duration, Instant};

async fn hava(sehir: &str) -> String {
    tokio::time::sleep(Duration::from_millis(50)).await; // her sorgu 50 ms sürüyor
    format!("{sehir}: güneşli")
}

#[tokio::main]
async fn main() {
    let baslangic = Instant::now();
    let raporlar: Vec<String> = stream::iter(["Ankara", "Isparta", "İzmir", "Van"])
        .map(hava) // her şehir için bir future üretir (henüz çalışmıyor!)
        .buffered(2) // bu future'lardan aynı anda en fazla 2'sini yürütür
        .collect()
        .await;
    for r in &raporlar {
        println!("{r}");
    }
    // Sırayla 4 × 50 = 200 ms sürerdi; ikişer ikişer ~100 ms sürer
    println!("Sıralı sürümden (200 ms) hızlı mı? {}", baslangic.elapsed() < Duration::from_millis(180));
}
```

`.map(hava)` her şehri bir **future**'a çevirir (çağrılmış ama beklenmemiş bir `async fn`, Ders 2), `.buffered(2)` ise
bu future'ları ikişer ikişer yürütür. `.then(hava)` yazsaydık her sorgu bir öncekini bekler ve toplam 200 ms sürerdi.
`buffered` sonuçları giriş sırasıyla verdiği için çıktı deterministiktir; `buffer_unordered` kullansaydın
çıktıyı yazdırmadan önce sıralaman gerekirdi (Ders 3'teki "topla, sonra sırala" kuralı).

### Kendi stream'ini üretmek: `stream::unfold`

Modül 14'te `Iterator`'ı bir struct için elle uygulamıştın. Stream'i elle uygulamak (`poll_next`) Ders 5'teki
`poll` kadar zahmetlidir; neyse ki çoğu zaman gerekmez. `stream::unfold(baslangic_durumu, f)` bir **durumdan**
stream üretir: `f` durumu alıp bir future döndürür; o future `Some((eleman, yeni_durum))` verirse eleman yayılır,
`None` verirse akış biter.

```rust
use futures::stream::{self, StreamExt};
use std::time::Duration;

#[tokio::main]
async fn main() {
    // Durum: (önceki, şimdiki) - sonsuz bir Fibonacci akışı
    let fibonacci = stream::unfold((0u64, 1u64), |(a, b)| async move {
        tokio::time::sleep(Duration::from_millis(1)).await; // her eleman "zamanla" geliyor
        Some((a, (b, a + b)))
    });

    // unfold'un içindeki async blok Unpin değil → next() için önce sabitle (Ders 5)
    let mut fibonacci = std::pin::pin!(fibonacci.take(8));
    while let Some(sayi) = fibonacci.next().await {
        print!("{sayi} ");
    }
    println!();
}
```

`pin!` satırını silersen Ders 5'te tanıştığın hata gelir: "`{async block@...}` cannot be unpinned ... required by a
bound in `futures::StreamExt::next`". `next()`, stream'i `&mut` ile ödünç alıp tekrar tekrar yokladığı için onun
`Unpin` olmasını ister. `collect`, `fold`, `for_each` gibi akışı **sahiplenerek** tüketen metotlar ise sabitlemeyi
kendileri yapar; onlarda `pin!` gerekmez.

```fill
prompt: "Ders 4'teki `mpsc::Receiver`'ı `unfold` ile bir stream'e çevir ve akışı `while let` ile tüket."
code: |
  use futures::stream::{self, StreamExt};
  use tokio::sync::mpsc;

  #[tokio::main]
  async fn main() {
      let (tx, rx) = mpsc::channel(8);
      tokio::spawn(async move {
          for skor in ["1-0", "1-1", "2-1"] {
              tx.send(skor).await.unwrap();
          }
      }); // tx burada drop edilir → kanal kapanır

      let akis = stream::unfold(rx, |mut rx| async move {
          let mesaj = rx.recv().await?; // kanal kapandıysa None → akış biter
          Some((mesaj, rx))
      });
      let mut akis = std::pin::___0!(akis);
      while let Some(skor) = akis.___1().___2 {
          println!("canlı skor: {skor}");
      }
  }
blanks:
  - ["pin"]
  - ["next"]
  - ["await"]
output: |
  canlı skor: 1-0
  canlı skor: 1-1
  canlı skor: 2-1
explanation: |
  Durum olarak `Receiver`'ın kendisini taşıyoruz: her adımda bir mesaj alıp `(mesaj, rx)` döndürüyoruz, böylece alıcı
  bir sonraki adıma devredilir. `?` operatörü Modül 10'daki gibi `Option` üzerinde de çalışır: `recv()` `None`
  döndürürse (bütün gönderenler drop edildi) async blok `None` verir ve akış biter. `unfold`'un içindeki async blok
  `Unpin` olmadığı için `next()`'ten önce `pin!` gerekir. Gerçek projelerde aynı işi
  `tokio_stream::wrappers::ReceiverStream::new(rx)` tek satırda yapar.
```

Şimdi bir stream'i baştan sona işleyen bir fonksiyon yaz.

````exercise
id: m19-e-kasa-fisi
title: "Market kasası: barkod akışından fiş"
difficulty: 3
prompt: |
  Bir market kasasında barkod okuyucu, okuttuğun ürünleri bir **stream** olarak gönderiyor. Fiyatlar uzak bir
  servisten geliyor: `fiyat_sor(barkod)` bir **async** fonksiyon ve tanınmayan barkod için `None` döndürüyor.

  `fis_kes` fonksiyonunu tamamla. Akıştaki her barkod için fiyatı `.await` ile sor:

  - Fiyat varsa `toplam`'a ekle ve `okunan`'ı 1 artır.
  - Fiyat yoksa barkodu `bilinmeyen` listesine **geliş sırasıyla** ekle.

  Boş bir akış `Fis { toplam: 0, okunan: 0, bilinmeyen: vec![] }` vermeli. Dikkat: parametre herhangi bir stream
  olabilir; `Unpin` olmayan bir stream de gelebilir (testlerden biri öyle).
starter: |
  use futures::stream::{self, Stream, StreamExt};

  // Uzak fiyat servisi (simülasyon)
  async fn fiyat_sor(barkod: &str) -> Option<u32> {
      tokio::task::yield_now().await; // ağ gecikmesi yerine
      match barkod {
          "8690001" => Some(15),  // simit
          "8690002" => Some(40),  // ayran
          "8690003" => Some(120), // beyaz peynir
          _ => None,
      }
  }

  #[derive(Debug, PartialEq)]
  struct Fis {
      toplam: u32,
      okunan: usize,
      bilinmeyen: Vec<String>,
  }

  async fn fis_kes(barkodlar: impl Stream<Item = &'static str>) -> Fis {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let okuyucu = stream::iter(["8690001", "8690002", "1234567", "8690001"]);
      let fis = fis_kes(okuyucu).await;
      println!("{fis:?}");
  }
solution: |
  use futures::stream::{self, Stream, StreamExt};

  // Uzak fiyat servisi (simülasyon)
  async fn fiyat_sor(barkod: &str) -> Option<u32> {
      tokio::task::yield_now().await; // ağ gecikmesi yerine
      match barkod {
          "8690001" => Some(15),  // simit
          "8690002" => Some(40),  // ayran
          "8690003" => Some(120), // beyaz peynir
          _ => None,
      }
  }

  #[derive(Debug, PartialEq)]
  struct Fis {
      toplam: u32,
      okunan: usize,
      bilinmeyen: Vec<String>,
  }

  async fn fis_kes(barkodlar: impl Stream<Item = &'static str>) -> Fis {
      let mut fis = Fis { toplam: 0, okunan: 0, bilinmeyen: Vec::new() };
      let mut barkodlar = std::pin::pin!(barkodlar);
      while let Some(barkod) = barkodlar.next().await {
          match fiyat_sor(barkod).await {
              Some(fiyat) => {
                  fis.toplam += fiyat;
                  fis.okunan += 1;
              }
              None => fis.bilinmeyen.push(barkod.to_string()),
          }
      }
      fis
  }

  #[tokio::main]
  async fn main() {
      let okuyucu = stream::iter(["8690001", "8690002", "1234567", "8690001"]);
      let fis = fis_kes(okuyucu).await;
      println!("{fis:?}");
  }
check: tests
tests: |
  #[tokio::test]
  async fn karisik_sepet() {
      let fis = fis_kes(stream::iter(["8690001", "8690002", "1234567", "8690001", "8690003"])).await;
      assert_eq!(fis.toplam, 15 + 40 + 15 + 120, "simit + ayran + simit + peynir = 190 TL");
      assert_eq!(fis.okunan, 4, "tanınan 4 ürün okundu");
      assert_eq!(fis.bilinmeyen, vec![String::from("1234567")], "tanınmayan barkod listeye eklenmeli");
  }

  #[tokio::test]
  async fn bos_akis() {
      let fis = fis_kes(stream::iter(Vec::<&'static str>::new())).await;
      assert_eq!(fis, Fis { toplam: 0, okunan: 0, bilinmeyen: vec![] }, "boş akış boş fiş vermeli");
  }

  #[tokio::test]
  async fn hepsi_bilinmeyen_ve_sira_korunur() {
      let fis = fis_kes(stream::iter(["999", "111", "555"])).await;
      assert_eq!(fis.toplam, 0, "tanınan ürün yoksa toplam 0 olmalı");
      assert_eq!(fis.okunan, 0);
      assert_eq!(fis.bilinmeyen, vec!["999", "111", "555"], "bilinmeyenler geliş sırasıyla tutulmalı");
  }

  #[tokio::test]
  async fn unpin_olmayan_akis() {
      // unfold + async blok: Unpin olmayan, zamanla eleman üreten bir stream
      let liste = vec!["8690003", "000", "8690002"];
      let akis = stream::unfold(0usize, move |i| {
          let liste = liste.clone();
          async move {
              tokio::task::yield_now().await;
              if i < liste.len() { Some((liste[i], i + 1)) } else { None }
          }
      });
      let fis = fis_kes(akis).await;
      assert_eq!(fis.toplam, 160, "peynir + ayran = 160 TL");
      assert_eq!(fis.okunan, 2);
      assert_eq!(fis.bilinmeyen, vec!["000"]);
  }
hints:
  - "Önce boş bir `Fis` oluştur, akışı baştan sona dolaş ve sonunda `Fis`'i döndür. Stream'de döngü kalıbı: `while let Some(barkod) = barkodlar.next().await { ... }`."
  - "`next()` için stream'in `Unpin` olması gerekir; parametre her stream olabileceği için önce sabitle: `let mut barkodlar = std::pin::pin!(barkodlar);`"
  - "Döngü gövdesi: `match fiyat_sor(barkod).await { Some(fiyat) => { fis.toplam += fiyat; fis.okunan += 1; } None => fis.bilinmeyen.push(barkod.to_string()), }`"
explanation: |
  `impl Stream<Item = &'static str>` parametresi, Modül 11'deki `impl Trait` argümanıdır: çağıran istediği stream'i
  verebilir. Bu genellik bir bedel getirir: verilen stream `Unpin` olmayabilir, bu yüzden `next()` kullanmadan önce
  `pin!` ile stack'te sabitliyoruz. Döngü her turda bir barkodu bekliyor, sonra o barkodun fiyatını bekliyor:
  ürünler **sırayla** işleniyor, kasadaki gibi.

  Alternatif, adaptörlerle yazmaktır:

  ```rust
  barkodlar
      .then(|b| async move { (b, fiyat_sor(b).await) })
      .fold(bos_fis, |mut fis, (b, fiyat)| async move { /* güncelle */ fis })
      .await
  ```

  `fold` akışı sahiplenerek tükettiği için `pin!` gerektirmez. Barkod sayısı çoksa ve fiyat servisi paralel istek
  kaldırabiliyorsa `.map(|b| async move { (b, fiyat_sor(b).await) }).buffered(4)` ile sorguları dörder dörder
  yapıp sırayı yine de koruyabilirsin.
````

## Trait'lerde async fn

Modül 11'de trait'lerle davranışı soyutlamıştın. Rust 1.75'ten beri trait metotları da `async` olabilir. Bir hava
durumu uygulamasının veriyi farklı kaynaklardan alabildiğini düşün:

```rust
use std::collections::HashMap;
use std::time::Duration;

trait HavaServisi {
    async fn sicaklik(&self, sehir: &str) -> Option<i32>;
}

// Testlerde ve geliştirmede: bellekteki sabit veri
struct SahteServis {
    veri: HashMap<String, i32>,
}

impl HavaServisi for SahteServis {
    async fn sicaklik(&self, sehir: &str) -> Option<i32> {
        self.veri.get(sehir).copied()
    }
}

// Üretimde: yavaş bir uzak servis (burada sleep ile taklit ediyoruz)
struct UzakServis;

impl HavaServisi for UzakServis {
    async fn sicaklik(&self, sehir: &str) -> Option<i32> {
        tokio::time::sleep(Duration::from_millis(10)).await;
        if sehir == "Isparta" { Some(18) } else { None }
    }
}

// Her HavaServisi ile çalışan generic async fonksiyon (statik dispatch, Modül 11)
async fn rapor<S: HavaServisi>(servis: &S, sehir: &str) -> String {
    match servis.sicaklik(sehir).await {
        Some(d) => format!("{sehir}: {d}°C"),
        None => format!("{sehir}: veri yok"),
    }
}

#[tokio::main]
async fn main() {
    let sahte = SahteServis { veri: HashMap::from([(String::from("Isparta"), 25)]) };
    println!("{}", rapor(&sahte, "Isparta").await);
    println!("{}", rapor(&UzakServis, "Isparta").await);
    println!("{}", rapor(&UzakServis, "Van").await);
}
```

Perde arkasında `async fn sicaklik(...)` trait içinde şuna dönüşür:
`fn sicaklik(&self, sehir: &str) -> impl Future<Output = Option<i32>>`. Yani "her uygulama kendi future tipini
döndürür" (trait'te dönüş konumunda `impl Trait`; adı RPITIT, Modül 22'de derinlemesine). Her uygulayıcının future'ı
farklı bir tiptir ve derleyici `rapor::<SahteServis>` ile `rapor::<UzakServis>`'i ayrı ayrı derler: sıfır maliyet,
heap tahsisi yok.

1.75'ten önce bunun için `async-trait` crate'i kullanılırdı; her çağrıda future'ı `Box::pin` ile heap'e koyuyordu.
Eski kod tabanlarında `#[async_trait]` özniteliğini hâlâ görürsün.

Şimdi bu servisi `tokio::spawn` ile arka planda kullanmak isteyelim. Derlenir mi?

```compiles
code: |
  use std::sync::Arc;

  trait Depo {
      async fn getir(&self, id: u32) -> Option<String>;
  }

  struct BellekDepo;

  impl Depo for BellekDepo {
      async fn getir(&self, id: u32) -> Option<String> {
          if id == 1 { Some(String::from("Ayşe")) } else { None }
      }
  }

  async fn arka_planda<D: Depo + Send + Sync + 'static>(depo: Arc<D>) {
      let gorev = tokio::spawn(async move { depo.getir(1).await });
      println!("{:?}", gorev.await.unwrap());
  }

  #[tokio::main]
  async fn main() {
      arka_planda(Arc::new(BellekDepo)).await;
  }
answer: false
explanation: |
  `D: Send + Sync` deposunun kendisinin thread'ler arası taşınabileceğini söyler, ama `getir`'in döndürdüğü
  **future**'ın `Send` olduğunu söylemez. Trait'teki `async fn`, uygulayıcılara future'ları için hiçbir söz
  vermez; bir uygulama içinde `Rc` tutup `.await` edebilir (Ders 7). Generic `D` için derleyici bunu bilemediğinden
  future'ı `Send` kabul edemez ve `tokio::spawn` (`F: Future + Send + 'static`) reddeder.
```

:::error
```text
error: future cannot be sent between threads safely
   --> src/main.rs:16:17
    |
 16 |     let gorev = tokio::spawn(async move { depo.getir(1).await });
    |                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ future created by async block is not `Send`
    |
    = help: within `{async block@src/main.rs:16:30: 16:40}`, the trait `Send` is not implemented for `impl Future<Output = Option<String>>`
note: future is not `Send` as it awaits another future which is not `Send`
help: `Send` can be made part of the associated future's guarantees for all implementations of `Depo::getir`
    |
  4 -     async fn getir(&self, id: u32) -> Option<String>;
  4 +     fn getir(&self, id: u32) -> impl std::future::Future<Output = Option<String>> + Send;
```
Derleyici çözümü kelimesi kelimesine veriyor: trait'teki imzayı, `async fn`'in açık hâline çevirip **`+ Send`**
ekle. Bu, **bütün** uygulayıcılara "future'ın `Send` olmak zorunda" şartını koyar.
:::

Düzeltilmiş hâli şöyle. Dikkat: trait'te açık imza yazsak da uygulamalar rahatça `async fn` kullanmaya devam edebilir.

```rust
use std::future::Future;
use std::sync::Arc;

trait Depo {
    // "Bu metodun döndürdüğü future her uygulamada Send olmalı"
    fn getir(&self, id: u32) -> impl Future<Output = Option<String>> + Send;
}

struct BellekDepo;

impl Depo for BellekDepo {
    async fn getir(&self, id: u32) -> Option<String> {
        if id == 1 { Some(String::from("Ayşe")) } else { None }
    }
}

async fn arka_planda<D: Depo + Send + Sync + 'static>(depo: Arc<D>) {
    let gorev = tokio::spawn(async move { depo.getir(1).await });
    println!("{:?}", gorev.await.unwrap());
}

#[tokio::main]
async fn main() {
    arka_planda(Arc::new(BellekDepo)).await;
}
```

:::warning async fn'li trait'lerin iki sınırı
1. **`Send` sözü yok.** Kütüphane yazıyorsan (`pub trait`) derleyici seni `async_fn_in_pub_trait` uyarısıyla
   tam olarak bu konuda uyarır. Kullanıcıların `tokio::spawn` kullanacaksa imzayı `-> impl Future<Output = T> + Send`
   olarak yaz.
2. **`dyn` ile kullanılamaz.** `Box<dyn HavaServisi>` gibi bir **trait nesnesi** yapamazsın, çünkü her uygulamanın
   future tipi farklıdır ve boyutu bilinmez. Trait nesnelerini Modül 20'de göreceğiz; o gün gerekirse çözüm yine
   `Box::pin` ile future'ı kutulamaktır (`async-trait` crate'inin yaptığı da budur).
:::

```quiz
question: "`trait Bildirim { async fn gonder(&self, mesaj: &str) -> bool; }` tanımı için hangisi **doğrudur**?"
options:
  - "Her `gonder` çağrısı future'ı `Box::pin` ile heap'e koyar; bu yüzden yavaştır"
  - "`gonder`, `fn gonder(&self, mesaj: &str) -> impl Future<Output = bool>` gibi davranır; her uygulayıcı kendi future tipini döndürür ve bu future'ın `Send` olacağı garanti edilmez"
  - "Trait'lerde `async fn` yazmak için hâlâ `async-trait` crate'i gerekir"
  - "`Vec<Box<dyn Bildirim>>` içinde farklı bildirim türlerini rahatça saklayabilirsin"
answer: 1
explanation: |
  Trait'teki `async fn`, dönüş konumunda `impl Future` olan bir metodun kısaltmasıdır. Statik dispatch ile çalışır
  (heap yok), ama iki sınırı vardır: future'ın `Send` olduğu söylenmez (`tokio::spawn` için gerekiyorsa imzaya
  `+ Send` eklenir) ve trait `dyn` ile kullanılamaz.
feedback:
  - "Kutulama eski `async-trait` crate'inin yöntemiydi; yerleşik async fn'de tahsis yok."
  - "Doğru!"
  - "Rust 1.75'ten beri dilin parçası; crate gerekmez."
  - "Uygulayıcıların future tipleri farklı olduğu için bu trait `dyn` ile kullanılamaz (Modül 20)."
```

## Async closure'lar

Ders 2'de şu kod `E0728` vermişti, çünkü `.await` sıradan bir closure'ın içinde kullanılamaz:

```rust,ignore
let hesapla = |adet: u32| {
    let birim = fiyat().await; // E0728: sıradan closure async değil
    birim * adet
};
```

Rust 1.85'ten beri çözüm, closure'ın başına `async` koymaktır: **`async |adet: u32| { ... }`**. Çağırınca gövdeyi
çalıştırmaz, bir **future** döndürür; `async fn`'in isimsiz hâli gibi düşünebilirsin.

Fonksiyonlar async closure'ları Modül 14'teki üçlünün async ikizleriyle kabul eder:

| Senkron (Modül 14) | Async (1.85) | Ne zaman? |
|---|---|---|
| `Fn(A) -> R` | `AsyncFn(A) -> R` | Yakaladıklarını sadece okur, birçok kez çağrılabilir |
| `FnMut(A) -> R` | `AsyncFnMut(A) -> R` | Yakaladıklarını değiştirir |
| `FnOnce(A) -> R` | `AsyncFnOnce(A) -> R` | Yakaladığını tüketir, bir kez çağrılır |

Dikkat: `R` burada future'ın **çıktısıdır** (`.await` sonrası değer), future'ın kendisi değil. Klasik örnek, başarısız
olan bir işlemi birkaç kez deneyen bir yardımcı:

```rust
async fn tekrar_dene<T, F>(deneme: u32, mut islem: F) -> Result<T, String>
where
    F: AsyncFnMut() -> Result<T, String>,
{
    let mut son_hata = String::from("hiç denenmedi");
    for _ in 0..deneme {
        match islem().await {
            Ok(deger) => return Ok(deger),
            Err(e) => son_hata = e,
        }
    }
    Err(son_hata)
}

#[tokio::main]
async fn main() {
    let mut sayac = 0; // closure bunu &mut ile yakalıyor
    let sonuc = tekrar_dene(5, async || {
        sayac += 1;
        tokio::task::yield_now().await; // ağ isteği yerine
        if sayac < 3 { Err(format!("{sayac}. deneme: zaman aşımı")) } else { Ok("ödeme onaylandı") }
    })
    .await;
    println!("{sonuc:?} ({sayac} denemede)");
}
```

Bu neden yeni bir özellik gerektirdi? 1.85'ten önce aynı şey `F: FnMut() -> Fut, Fut: Future<Output = ...>` sınırıyla
ve `|| async { ... }` closure'ıyla yazılırdı. Ama o kalıpta closure'ın döndürdüğü future, closure'ın yakaladığı
`sayac`'a **referans** tutamaz:

:::error
```text
error: captured variable cannot escape `FnMut` closure body
  --> src/main.rs:19:35
   |
18 |       let mut sayac = 0;
   |           --------- variable defined here
19 |       let sonuc = tekrar_dene(5, || async {
   |  _________________________________-_^
   | |                                 |
   | |                                 inferred to be a `FnMut` closure
20 | |         sayac += 1;
   | |         ----- variable captured here
...
22 | |     })
   | |_____^ returns an `async` block that contains a reference to a captured variable, which then escapes the closure body
```
`|| async { ... }` iki ayrı şeydir: bir closure ve onun **döndürdüğü** bağımsız bir future. `Fut` tipi closure'dan
bağımsız olduğu için, closure'ın yakaladığı `&mut sayac`'ı ödünç alan bir future döndürmek mümkün değildir. Async
closure'da ise future, **closure'ı ödünç alarak** yaşar; ödünç alma `.await` bitince sona erer ve bir sonraki çağrı
serbest kalır.
:::

```memory
title: async closure çağrısı ve ödünç alma
steps:
  - caption: "`islem` closure'ı `sayac`'ı `&mut` ile yakaladı. Henüz hiçbir future yok."
    stack:
      - frame: main
        vars:
          - { name: sayac, type: i32, value: "0", mut: true }
      - frame: tekrar_dene
        vars:
          - { name: islem, type: "async closure", value: "&mut sayac", to: sayac }
  - caption: "`islem()` bir future döndürdü; future **closure'ı ödünç alıyor** ve onun üzerinden `sayac`'a ulaşıyor. Bu sırada `islem` tekrar çağrılamaz."
    stack:
      - frame: main
        vars:
          - { name: sayac, type: i32, value: "1", mut: true }
      - frame: tekrar_dene
        vars:
          - { name: islem, type: "async closure", value: "&mut sayac", to: sayac, note: ödünç verildi }
          - { name: "islem()", type: future, value: "&mut islem", to: islem }
  - caption: "`.await` bitti, future yok oldu, ödünç alma sona erdi. Döngünün bir sonraki turunda `islem()` yeniden çağrılabilir."
    stack:
      - frame: main
        vars:
          - { name: sayac, type: i32, value: "1", mut: true }
      - frame: tekrar_dene
        vars:
          - { name: islem, type: "async closure", value: "&mut sayac", to: sayac }
```

Modül 14'teki kuralı hatırla. Bu kod derlenir mi?

```compiles
code: |
  async fn uc_kez<F: AsyncFn()>(f: F) {
      f().await;
      f().await;
      f().await;
  }

  #[tokio::main]
  async fn main() {
      let mut zil = 0;
      uc_kez(async || {
          zil += 1;
      })
      .await;
      println!("zil {zil} kez çaldı");
  }
answer: false
error: E0596
explanation: |
  Closure `zil`'i **değiştiriyor**, yani yakaladığını `&mut` ile kullanıyor. Modül 14'teki gibi böyle bir closure
  yalnızca `FnMut` (burada `AsyncFnMut`) olabilir; `AsyncFn` ise yakaladıklarını sadece okuyan closure'ları kabul eder.
  Derleyici: "cannot borrow `zil` as mutable, as it is a captured variable in a `Fn` closure" ve ipucu olarak
  "change this to accept `FnMut` instead of `Fn`". Çözüm: `F: AsyncFnMut()` ve parametreyi `mut f: F` yapmak.
```

Şimdi tekrar deneme yardımcısını, bütün hataları raporlayan bir sürümle kendin yaz.

```exercise
id: m19-e-sms-tekrar
title: SMS gönderimini tekrar dene
difficulty: 4
prompt: |
  Bir kargo uygulaması, teslimat kodunu SMS ile gönderiyor; SMS sağlayıcısı ara sıra hata veriyor. `tekrar_dene`
  fonksiyonunu tamamla:

  - `islem` bir **async closure**; deneme numarasını (1'den başlayarak) alır ve `Result<T, String>` döndürür.
  - En fazla `deneme` kez çağır. İlk `Ok(deger)`'de **hemen** `Ok(deger)` döndür (başarıdan sonra bir daha çağırma).
  - Hiçbiri başarılı olmazsa bütün hata mesajlarını **deneme sırasıyla** bir `Vec<String>` içinde `Err` olarak döndür.
  - `deneme` 0 ise `islem`'i hiç çağırmadan `Err(vec![])` döndür.

  Fonksiyon imzası hazır: `F: AsyncFnMut(u32) -> Result<T, String>`.
starter: |
  async fn tekrar_dene<T, F>(deneme: u32, mut islem: F) -> Result<T, Vec<String>>
  where
      F: AsyncFnMut(u32) -> Result<T, String>,
  {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let mut gonderilen = Vec::new();
      let sonuc = tekrar_dene(3, async |no| {
          tokio::task::yield_now().await; // SMS sağlayıcısına istek
          if no < 2 {
              Err(format!("{no}. deneme: sağlayıcı meşgul"))
          } else {
              gonderilen.push(no);
              Ok("kod gönderildi")
          }
      })
      .await;
      println!("{sonuc:?}, başarılı deneme: {gonderilen:?}");
  }
solution: |
  async fn tekrar_dene<T, F>(deneme: u32, mut islem: F) -> Result<T, Vec<String>>
  where
      F: AsyncFnMut(u32) -> Result<T, String>,
  {
      let mut hatalar = Vec::new();
      for no in 1..=deneme {
          match islem(no).await {
              Ok(deger) => return Ok(deger),
              Err(e) => hatalar.push(e),
          }
      }
      Err(hatalar)
  }

  #[tokio::main]
  async fn main() {
      let mut gonderilen = Vec::new();
      let sonuc = tekrar_dene(3, async |no| {
          tokio::task::yield_now().await; // SMS sağlayıcısına istek
          if no < 2 {
              Err(format!("{no}. deneme: sağlayıcı meşgul"))
          } else {
              gonderilen.push(no);
              Ok("kod gönderildi")
          }
      })
      .await;
      println!("{sonuc:?}, başarılı deneme: {gonderilen:?}");
  }
check: tests
tests: |
  #[tokio::test]
  async fn ucuncu_denemede_basarir() {
      let mut cagri = 0;
      let sonuc = tekrar_dene(5, async |no| {
          cagri += 1;
          tokio::task::yield_now().await;
          if no == 3 { Ok(no * 100) } else { Err(format!("{no}. hata")) }
      })
      .await;
      assert_eq!(sonuc, Ok(300), "3. deneme başarılı olmalı ve değeri dönmeli");
      assert_eq!(cagri, 3, "başarıdan sonra closure bir daha çağrılmamalı");
  }

  #[tokio::test]
  async fn hepsi_basarisiz_hatalar_sirali() {
      let sonuc: Result<u32, Vec<String>> =
          tekrar_dene(3, async |no| Err(format!("{no}. deneme: ağ hatası"))).await;
      assert_eq!(
          sonuc,
          Err(vec![
              String::from("1. deneme: ağ hatası"),
              String::from("2. deneme: ağ hatası"),
              String::from("3. deneme: ağ hatası"),
          ]),
          "bütün hatalar deneme sırasıyla toplanmalı; deneme numarası 1'den başlamalı"
      );
  }

  #[tokio::test]
  async fn sifir_deneme_hic_cagirmaz() {
      let mut cagri = 0;
      let sonuc: Result<(), Vec<String>> = tekrar_dene(0, async |_| {
          cagri += 1;
          Ok(())
      })
      .await;
      assert_eq!(sonuc, Err(vec![]), "0 denemede sonuç boş hata listesi olmalı");
      assert_eq!(cagri, 0, "0 denemede closure hiç çağrılmamalı");
  }

  #[tokio::test]
  async fn ilk_denemede_basari() {
      let mut cagri = 0;
      let sonuc = tekrar_dene(4, async |_| {
          cagri += 1;
          Ok::<&str, String>("tamam")
      })
      .await;
      assert_eq!(sonuc, Ok("tamam"));
      assert_eq!(cagri, 1, "ilk denemede başarı varsa yalnızca bir çağrı yapılmalı");
  }
hints:
  - "Hataları toplamak için bir `Vec` aç; `1..=deneme` aralığında dön (aralık boşsa döngü hiç çalışmaz, 0 denemede tam istediğimiz bu)."
  - "Her turda `islem(no).await` sonucunu `match` ile incele: `Ok` ise `return Ok(deger)`, `Err(e)` ise `hatalar.push(e)`."
  - "Döngüden çıkınca `Err(hatalar)` döndür. `islem` bir `AsyncFnMut` olduğu için parametre `mut islem` olarak zaten işaretli; çağrı `islem(no).await`."
explanation: |
  `AsyncFnMut(u32) -> Result<T, String>` sınırı, "her çağrıda `u32` alıp sonunda `Result` üreten bir future döndüren,
  yakaladıklarını değiştirebilen closure" demektir. Testlerdeki closure'lar `cagri` sayacını `&mut` ile yakalıyor;
  1.85 öncesindeki `F: FnMut(u32) -> Fut` kalıbıyla bu mümkün değildi ("captured variable cannot escape `FnMut`
  closure body"). Async closure'da her çağrının future'ı closure'ı ödünç alır; `.await` bitince ödünç alma sona erer
  ve döngünün sonraki turu `islem`'i tekrar çağırabilir.

  `for no in 1..=deneme` aralığı `deneme == 0` iken boştur; özel bir `if` gerekmez. Erken `return`, başarıdan sonra
  gereksiz çağrı yapılmamasını garanti eder. Gerçek bir sistemde denemeler arasına artan bir bekleme
  (**exponential backoff**) eklenir: `tokio::time::sleep(Duration::from_millis(100 * 2u64.pow(no))).await;`. Böylece
  zaten zorlanan servisi art arda isteklerle boğmazsın.
```

## Özet

:::remember
- **Stream** = zamanla gelen çok değer: `poll_next` → `Ready(Some(x))` / `Ready(None)` / `Pending`. Trait `futures` crate'inde; metotlar `use futures::StreamExt;` ile gelir.
- Döngü kalıbı: `while let Some(x) = akis.next().await { ... }` (`for` çalışmaz). `next()` `Unpin` ister → gerekirse `std::pin::pin!(akis)`.
- Adaptörler tembeldir. `then` sıralı async dönüşüm; `buffered(n)` / `buffer_unordered(n)` en fazla `n` future'ı aynı anda yürütür.
- `stream::unfold(durum, |durum| async move { ... Some((eleman, yeni_durum)) })` ile kendi stream'ini üret.
- Trait'te `async fn` (1.75) = `fn f(..) -> impl Future<Output = T>`. `Send` sözü yok → `tokio::spawn` için imzayı `-> impl Future<Output = T> + Send` yap. `dyn` ile kullanılamaz.
- Async closure (1.85): `async |x| { ... }`; sınırlar `AsyncFn` / `AsyncFnMut` / `AsyncFnOnce`. Yakaladıklarını ödünç alan future'lar döndürebilir.
:::

```reflect
prompt: "`F: FnMut() -> Fut, Fut: Future` kalıbı ile `F: AsyncFnMut()` arasındaki farkı, yakalanan bir `&mut sayac` örneği üzerinden kendi cümlelerinle açıkla."
answer: |
  Model cevap: Eski kalıpta closure ile döndürdüğü future iki bağımsız şeydir; `Fut` tipi closure'a bağlı değildir.
  Bu yüzden future, closure'ın yakaladığı `sayac`'a referans tutamaz: referans closure gövdesinden "kaçmış" olur ve
  bir sonraki çağrıda iki `&mut` aynı anda yaşayabilirdi. `AsyncFnMut` ise çağrının döndürdüğü future'ın closure'ı
  ödünç almasına izin verir; future `.await` ile bitene kadar closure tekrar çağrılamaz, bittiğinde ödünç alma sona
  erer. Böylece `sayac += 1` yapan bir async closure'ı tekrar deneme döngüsünde güvenle kullanabiliriz.
```

```flashcards
- front: "Senkron/async ve tek/çok değer tablosunda `Stream<Item = T>` hangi köşededir?"
  back: "Async + çok değer. (Senkron tek: `T`, senkron çok: `Iterator`, async tek: `Future`.)"
- front: "Bir stream'in bütün elemanlarını işlemek için döngü kalıbı nedir?"
  back: "`while let Some(x) = akis.next().await { ... }`, `next()` için `use futures::StreamExt;` gerekir; `for` stream'le çalışmaz."
- front: "`akis.next()` neden bazen \"cannot be unpinned\" (E0277) hatası verir, çözüm nedir?"
  back: "`next()` stream'i `&mut` ile ödünç alıp tekrar yokladığı için `Unpin` ister. Çözüm: `let mut akis = std::pin::pin!(akis);`"
- front: "`then(f)` ile `buffered(n)` arasındaki fark nedir?"
  back: "`then` future'ları sırayla (biri bitince diğeri) çalıştırır; `.map(f).buffered(n)` en fazla `n` tanesini aynı anda yürütür ve sonuçları giriş sırasıyla verir."
- front: "Trait'teki `async fn getir(&self) -> T` neye denktir?"
  back: "`fn getir(&self) -> impl Future<Output = T>`, her uygulayıcı kendi future tipini döndürür (statik dispatch, heap yok)."
- front: "Trait'teki bir async metodun future'ını `tokio::spawn` içinde kullanabilmek için trait'te ne yazılır?"
  back: "`fn getir(&self) -> impl Future<Output = T> + Send;`, böylece bütün uygulamaların future'ı `Send` olmak zorundadır."
- front: "Async closure sözdizimi ve onu kabul eden üç trait nedir? (Rust 1.85)"
  back: "`async |x| { ... }`; `AsyncFn`, `AsyncFnMut`, `AsyncFnOnce` (Fn/FnMut/FnOnce'ın async ikizleri)."
- front: "`|| async { sayac += 1 }` neden `FnMut() -> Fut` sınırına verilemez?"
  back: "Döndürülen future, closure'ın yakaladığı `&mut sayac`'a referans tutamaz (\"captured variable cannot escape `FnMut` closure body\"). Async closure (`AsyncFnMut`) bunu çözer."
```
