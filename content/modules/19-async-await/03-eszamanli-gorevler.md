---
id: m19-l03
title: Eşzamanlı görevler
minutes: 20
type: lesson
objectives:
  - "`tokio::spawn` ile görev başlatıp `JoinHandle` üzerinden sonucunu alabilmek ve `Send + 'static` şartını açıklayabilmek"
  - "`join!`, `try_join!` ve `select!` arasındaki farkı (hepsi / ilk hata / ilk biten) çıktı tahminiyle gösterebilmek"
  - "`tokio::time::timeout` ile bir işe süre sınırı koyabilmek"
  - "`JoinSet` ile sayısı çalışma zamanında belli olan görevleri başlatıp sonuçlarını deterministik biçimde toplayabilmek"
keywords: [tokio::spawn, JoinHandle, join!, try_join!, select!, timeout, JoinSet, iptal, eşzamanlılık]
---

Önceki dersin kahvaltısında çay ve yumurta **sırayla** hazırlandı: 120 + 80 = 200 ms. Gerçek bir mutfakta çay
demlenirken yumurtayı haşlarsın. Bu derste tam olarak bunu öğreneceksin: birden fazla future'ı **aynı anda**
ilerletmek. Elinde dört araç olacak: **`spawn`** (arka planda bağımsız görev), **`join!`** (hepsini bekle),
**`select!`** (ilk biteni al) ve **`JoinSet`** (sayısı belirsiz görev grubu). Bir de bonus: **zaman aşımı**.

## tokio::spawn ve JoinHandle

`tokio::spawn`, bir future'ı runtime'a **yeni bir görev (task)** olarak teslim eder ve hemen döner. Görev arka
planda, çağıran koddan bağımsız ilerler. Dönen **`JoinHandle<T>`**, Modül 18'deki `thread::spawn`'ın döndürdüğü
tutamacın async kardeşidir: `.await` edersen görevin sonucunu alırsın.

```rust
use std::time::Duration;
use tokio::time::sleep;

async fn kargo_sorgula(takip_no: u32, ms: u64) -> String {
    sleep(Duration::from_millis(ms)).await; // kargo firmasının API'si
    format!("#{takip_no}: dağıtımda")
}

#[tokio::main]
async fn main() {
    let mut kollar = Vec::new();
    for (takip_no, ms) in [(101, 60), (102, 10), (103, 30)] {
        // spawn hemen döner; görev arka planda çalışmaya başlar
        kollar.push(tokio::spawn(kargo_sorgula(takip_no, ms)));
    }
    // Tutamaçları başlatma sırasıyla bekliyoruz → çıktı sırası deterministik
    for kol in kollar {
        let durum = kol.await.unwrap(); // Result<String, JoinError>
        println!("{durum}");
    }
}
```

Görevler farklı sürelerde bitse de çıktı her zaman 101, 102, 103 sırasındadır, çünkü tutamaçları o sırayla
bekliyoruz. Sonuçları yazdırmadan önce bu şekilde **toplamak**, eşzamanlı programlarda deterministik çıktı almanın
en basit yoludur.

`kol.await` neden doğrudan `String` değil de `Result<String, JoinError>` veriyor? Çünkü görev **panik** atmış ya da
**iptal edilmiş** (`kol.abort()`) olabilir. Thread'lerdeki `join()` gibi, görevdeki panik bütün programı çökertmez;
sonuç `Err(JoinError)` olarak sana gelir.

**Görevler çok ucuzdur.** Bir görev OS thread'i değildir; runtime'ın kuyruğundaki küçük bir durum makinesidir.
10.000 thread açmak sistemini zorlardı; 10.000 görev ise sıradan bir iştir:

```rust
use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    let basla = Instant::now();
    let mut kollar = Vec::new();
    for i in 0..10_000u64 {
        kollar.push(tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            i
        }));
    }
    let mut toplam = 0;
    for kol in kollar {
        toplam += kol.await.unwrap();
    }
    println!("10.000 görevin toplamı: {toplam}");
    println!("~{} ms", (basla.elapsed().as_millis() + 50) / 100 * 100);
}
```

**`spawn`'ın iki şartı var: `Send` ve `'static`.** İmzası şöyle:
`pub fn spawn<F>(future: F) -> JoinHandle<F::Output> where F: Future + Send + 'static, F::Output: Send + 'static`

- **`'static`**: Görev, onu başlatan fonksiyondan uzun yaşayabilir. Bu yüzden yerel değişkenleri **ödünç alamaz**;
  ya sahipliğini alır (`async move`) ya da `Arc` ile paylaşır. Ödünç almaya çalışırsan Modül 18'deki hatanın
  aynısını görürsün:

:::error
```text
error[E0373]: async block may outlive the current function, but it borrows `isim`, which is owned by the current function
 --> src/main.rs:4:30
  |
4 |     let gorev = tokio::spawn(async {
  |                              ^^^^^ may outlive borrowed value `isim`
5 |         println!("Merhaba {isim}");
  |                            ---- `isim` is borrowed here
  |
  = note: async blocks are not executed immediately and must either take a reference or ownership of outside variables they use
help: to force the async block to take ownership of `isim` (and any other referenced variables), use the `move` keyword
  |
4 |     let gorev = tokio::spawn(async move {
  |                                    ++++
```
:::

- **`Send`**: Çok thread'li runtime, bir görevi bir `.await` noktasında askıya alıp **başka bir thread'de**
  devam ettirebilir. Bu yüzden görevin `.await` boyunca tuttuğu her şey `Send` olmalıdır (Modül 18). `Rc` ya da
  `std::sync::MutexGuard` tutarsan derleyici durdurur; bunu Ders 4 ve 7'de ayrıntısıyla göreceğiz.

Modül 4'ten bir soru: `async move` sahipliği taşır. Bu kod derlenir mi?

```compiles
code: |
  #[tokio::main]
  async fn main() {
      let sepet = vec!["elma", "armut"];
      let kol = tokio::spawn(async move {
          println!("görev: {} ürün", sepet.len());
      });
      kol.await.unwrap();
      println!("main: {sepet:?}");
  }
answer: false
error: E0382
explanation: |
  `async move` bloğu `sepet`'in sahipliğini **taşıdı**; artık o vektör görevin malıdır. `main`'de tekrar kullanmak
  `E0382` (borrow of moved value) verir. Görevden sonra da kullanmak istiyorsan: sonucu görevden geri döndür
  (`async move { ...; sepet }` ve `let sepet = kol.await.unwrap();`), önceden `clone()` al ya da `Arc` ile paylaş.
```

## join!: tek görevde, aynı anda

`tokio::join!(a, b, c)`, verdiğin future'ların **hepsini birlikte yoklar** ve hepsi bitince sonuçları bir tuple
olarak verir. Tahmin et:

```predict
code: |
  use std::time::Duration;
  use tokio::time::sleep;

  async fn hazirla(ad: &str, ms: u64) -> usize {
      sleep(Duration::from_millis(ms)).await;
      println!("{ad} hazır");
      ad.len()
  }

  #[tokio::main]
  async fn main() {
      let (a, b, c) = tokio::join!(
          hazirla("çay", 120),
          hazirla("yumurta", 80),
          hazirla("ekmek", 20),
      );
      println!("{a} {b} {c}");
  }
options:
  - |
    çay hazır
    yumurta hazır
    ekmek hazır
    4 7 5
  - |
    ekmek hazır
    yumurta hazır
    çay hazır
    4 7 5
  - |
    ekmek hazır
    yumurta hazır
    çay hazır
    5 7 4
answer: 1
explanation: |
  Üç future aynı anda bekliyor; **önce biten önce yazar**: ekmek (20 ms), yumurta (80 ms), çay (120 ms). Ama
  `join!`'in döndürdüğü tuple, bitiş sırasına değil **yazdığın sıraya** göredir: `(çay, yumurta, ekmek)`. `"çay"`
  4 bayttır (`ç` UTF-8'de 2 bayt, Modül 9). Toplam süre ≈ en uzun iş = 120 ms.
```

`join!` ile `spawn` arasındaki fark ince ama önemli:

| | `join!(a, b)` | `tokio::spawn(a)` |
|---|---|---|
| Yeni görev oluşturur mu? | Hayır; future'lar **mevcut görevin içinde** sırayla yoklanır | Evet; runtime'a bağımsız bir görev eklenir |
| Paralel (aynı anda iki çekirdekte) çalışabilir mi? | Hayır, yalnızca **eşzamanlı** (concurrent) | Çok thread'li runtime'da evet |
| `Send + 'static` şartı | Yok; **yerel değişkenleri ödünç alabilir** | Var |
| Sonuç | Doğrudan değerler (tuple) | `Result<T, JoinError>` |

Modül 18'deki ayrımı hatırla: **eşzamanlılık (concurrency)**, birden fazla işin aynı zaman diliminde ilerlemesidir;
**paralellik (parallelism)**, aynı anda farklı çekirdeklerde çalışmasıdır. `join!` saf eşzamanlılıktır: tek
garson, birden fazla masa. Beklemeleri çakıştırmak için bu yeterlidir; işlemci gücüne ihtiyacın varsa `spawn`
(ya da Ders 7'deki `spawn_blocking`) gerekir.

:::analogy Mutfakta üç strateji
- **`join!`**: Tek aşçı, ocakta üç tencere. Çayı demlemeye koyar, yumurtayı suya atar, ekmeği kızartmaya bırakır;
  hangisi hazırsa onunla ilgilenir. Ocakta ne varsa hepsi bitmeden servis yapmaz.
- **`spawn`**: Mutfağa **yardımcı aşçı** almak. Yardımcı kendi tezgâhında bağımsız çalışır (gerçekten aynı anda);
  ama ona verdiğin malzemeyi geri alamazsın (`move`) ve işini bitirince sana bir fiş (`JoinHandle`) teslim eder.
- **`select!`**: İki taksi durağını birden aramak. Hangi taksi önce gelirse ona binersin, diğerini **iptal edersin**.
:::

:::tip Sayısı belli olmayan future'lar
`join!` bir makrodur; future sayısını derleme zamanında bilmesi gerekir. Bir `Vec` dolusu future'ı birlikte
beklemek için `futures::future::join_all(vec)` ya da bu dersin sonundaki `JoinSet` kullanılır.
:::

## try_join!: ilk hatada vazgeç

Future'lar `Result` döndürüyorsa ve biri başarısız olunca diğerlerini beklemenin anlamı yoksa, `try_join!` kullan.
Hepsi `Ok` olursa `Ok((a, b, ...))`, herhangi biri `Err` olursa **hemen** o `Err` döner. Bütün future'ların hata
tipi aynı olmalıdır. Tahmin et:

```predict
code: |
  use std::time::Duration;
  use tokio::time::sleep;

  async fn profil_getir() -> Result<String, String> {
      sleep(Duration::from_millis(80)).await;
      println!("profil geldi");
      Ok(String::from("Elif"))
  }

  async fn siparisleri_getir() -> Result<Vec<u32>, String> {
      sleep(Duration::from_millis(20)).await;
      Err(String::from("sipariş servisi kapalı"))
  }

  #[tokio::main]
  async fn main() {
      match tokio::try_join!(profil_getir(), siparisleri_getir()) {
          Ok((ad, siparisler)) => println!("{ad}: {siparisler:?}"),
          Err(e) => println!("hata: {e}"),
      }
      sleep(Duration::from_millis(100)).await; // profil hâlâ çalışıyor mu?
      println!("son");
  }
options:
  - |
    hata: sipariş servisi kapalı
    son
  - |
    hata: sipariş servisi kapalı
    profil geldi
    son
  - |
    profil geldi
    hata: sipariş servisi kapalı
    son
answer: 0
explanation: |
  Sipariş servisi 20 ms'de hata verir; `try_join!` o anda `Err` ile döner ve henüz bitmemiş `profil_getir`
  future'ını **drop eder**. Drop edilen future bir daha yoklanmaz, yani **iptal edilmiş** olur: "profil geldi" hiç
  yazılmaz, sonradan 100 ms beklesek bile. Async Rust'ta iptal bu kadar basittir: **future'ı drop etmek = iptal**.
```

Bu davranış hem güç hem sorumluluktur: future, herhangi bir `.await` noktasında sessizce durdurulabilir. Yarım kalan
bir işin (örneğin iki adımlı bir güncellemenin) tutarsız durum bırakmaması gerekir. Buna **iptal güvenliği
(cancellation safety)** denir; Ders 7'de geri döneceğiz.

## select!: yarıştır, kazananı al

`tokio::select!`, birkaç future'ı yarıştırır: **ilk biten** dalın kodu çalışır, diğer future'lar **drop edilir**
(iptal). Örnek: aynı dosyayı iki farklı sunucudan (ayna/mirror) istiyoruz, hangisi önce cevap verirse onu alıyoruz.
Kaybedenin gerçekten iptal edildiğini görmek için, Modül 17'deki `Drop` trait'iyle bir iz bırakıyoruz. Tahmin et:

```predict
code: |
  use std::time::Duration;
  use tokio::time::sleep;

  struct Iz(&'static str);

  impl Drop for Iz {
      fn drop(&mut self) {
          println!("{} future'ı drop edildi", self.0);
      }
  }

  async fn ayna(ad: &'static str, ms: u64) -> String {
      let _iz = Iz(ad); // future yok olunca (bitince ya da iptal edilince) drop edilir
      sleep(Duration::from_millis(ms)).await;
      format!("{ad} aynasından indirildi")
  }

  #[tokio::main]
  async fn main() {
      tokio::select! {
          s = ayna("İstanbul", 80) => println!("kazanan: {s}"),
          s = ayna("Frankfurt", 20) => println!("kazanan: {s}"),
      }
      println!("select! bitti");
  }
options:
  - |
    kazanan: Frankfurt aynasından indirildi
    select! bitti
  - |
    Frankfurt future'ı drop edildi
    İstanbul future'ı drop edildi
    kazanan: Frankfurt aynasından indirildi
    select! bitti
  - |
    kazanan: Frankfurt aynasından indirildi
    İstanbul future'ı drop edildi
    select! bitti
  - |
    Frankfurt future'ı drop edildi
    kazanan: Frankfurt aynasından indirildi
    select! bitti
    İstanbul future'ı drop edildi
answer: 1
explanation: |
  1. Frankfurt 20 ms'de biter; `ayna` fonksiyonu dönerken yerel `_iz` değişkeni drop edilir → ilk satır.
  2. `select!` kazananın değerini aldıktan sonra, dalın kodunu çalıştırmadan **önce** kaybeden İstanbul future'ını
     drop eder. İstanbul hâlâ `sleep`'te bekliyordu; o `.await` noktasında sonsuza dek durduruldu ve `_iz`'i drop
     edildi → ikinci satır. "İstanbul aynasından indirildi" hiçbir zaman oluşmaz.
  3. Sonra kazanan dalın kodu (`println!("kazanan: ...")`) çalışır.
```

:::info select! ayrıntıları
- Birden fazla dal **aynı anda** hazırsa tokio **rastgele** birini seçer (bir dalın sürekli öncelik alıp
  diğerlerini aç bırakmaması için). Sırayla denemesini istersen bloğun başına `biased;` yaz.
- Dal sözdizimi: `desen = future => ifade,`. Desen eşleşmezse (örneğin `Some(x) = rx.recv()` ve kanal kapanmışsa
  `None` gelir) o dal devre dışı kalır, diğerleri beklenmeye devam eder.
- Bütün dallar devre dışı kalabiliyorsa `else => ...` dalı ekle; yoksa `select!` panikler.
:::

```quiz
question: "`tokio::select!` ve `tokio::join!` için hangisi doğrudur?"
options:
  - "İkisi de bütün future'lar bitene kadar bekler; `select!` sadece sonuçları farklı sırada verir"
  - "`select!` ilk biten future'ın dalını çalıştırır ve diğerlerini drop eder; `join!` hepsinin bitmesini bekler"
  - "`select!` future'ları ayrı thread'lerde çalıştırır, `join!` aynı thread'de"
  - "`select!` kaybeden future'ları arka planda çalışmaya devam ettirir; sonuçları kaybolur ama işleri tamamlanır"
answer: 1
explanation: |
  `join!` "hepsi", `select!` "ilk biten" demektir. `select!`'te kaybedenler **drop edilir**: bir daha yoklanmazlar,
  işleri yarıda kalır. Arka planda devam etmesini istediğin bir iş varsa onu `tokio::spawn` ile ayrı bir görev
  yapmalısın; `JoinHandle`'ı drop etmek görevi iptal etmez.
feedback:
  - "`select!` hepsini beklemez; ilk sonuç gelince biter."
  - "Doğru!"
  - "İkisi de yeni thread ya da görev oluşturmaz; future'lar mevcut görevde yoklanır."
  - "Drop edilen future çalışmaya devam etmez; bir future ancak yoklanınca ilerler."
```

## Zaman aşımı: tokio::time::timeout

En sık `select!` kullanımlarından biri "bu iş X sürede bitmezse vazgeç" demektir. Bunun için hazır bir araç var:
`tokio::time::timeout(süre, future)`. Sonuç `Result<T, Elapsed>` olur: süre içinde biterse `Ok(değer)`, bitmezse
`Err(Elapsed)`; bitmeyen future da drop edilir.

```rust
use std::time::Duration;
use tokio::time::{sleep, timeout};

async fn odeme_servisi(ms: u64) -> &'static str {
    sleep(Duration::from_millis(ms)).await;
    "ödeme onaylandı"
}

#[tokio::main]
async fn main() {
    for ms in [20, 300] {
        match timeout(Duration::from_millis(100), odeme_servisi(ms)).await {
            Ok(cevap) => println!("{ms} ms: {cevap}"),
            Err(e) => println!("{ms} ms: vazgeçildi ({e})"),
        }
    }
}
```

`timeout` aslında `select!` ile yazabileceğin bir şeyin kısaltmasıdır:
`select! { v = is => Ok(v), _ = sleep(sure) => Err(..) }`. Gerçek servislerde **her** ağ çağrısına bir süre sınırı
koymak iyi bir alışkanlıktır: cevap vermeyen tek bir servis, sınır yoksa bütün sistemini kilitleyebilir.

```fill
prompt: Hava durumu servisine en fazla 50 ms tanı; bitmezse "servis yavaş" yazdır.
code: |
  use std::time::Duration;
  use tokio::time::sleep;

  async fn sicaklik() -> i32 {
      sleep(Duration::from_millis(500)).await;
      21
  }

  #[tokio::main]
  async fn main() {
      match tokio::time::___0(Duration::from_millis(50), sicaklik()).___1 {
          ___2(d) => println!("{d}°C"),
          ___3(_) => println!("servis yavaş"),
      }
  }
blanks:
  - ["timeout"]
  - ["await"]
  - ["Ok"]
  - ["Err"]
output: servis yavaş
explanation: |
  `timeout(süre, future)` kendisi de bir future döndürür; `.await` ile beklenir ve `Result<i32, Elapsed>` verir.
  Servis 500 ms sürdüğü için 50 ms'lik sınır dolar, `Err(Elapsed)` gelir ve `sicaklik()` future'ı iptal edilir.
```

## JoinSet: sayısı belirsiz görevler

Kaç görev başlatacağını çalışma zamanında öğreniyorsan (kullanıcının seçtiği şehirler, bir listedeki URL'ler)
`tokio::task::JoinSet` en temiz araçtır:

- `set.spawn(future)`: Kümeye yeni bir görev ekler (`tokio::spawn` gibi, aynı `Send + 'static` şartıyla).
- `set.join_next().await`: **İlk biten** görevin sonucunu verir: `Some(Ok(değer))`, görev panik attıysa
  `Some(Err(JoinError))`, küme boşaldıysa `None`. Bu yüzden `while let` ile mükemmel çalışır.
- `JoinSet` drop edilince içindeki bitmemiş görevlerin **hepsi iptal edilir** (`abort`). Tek tek `JoinHandle`'lar
  ise drop edilince görevi iptal etmez, sadece "sahipsiz" bırakır.

```rust
use std::time::Duration;
use tokio::task::JoinSet;

async fn stok_say(depo: &str) -> u32 {
    let ms = 10 * depo.len() as u64; // depo adına göre farklı gecikme
    tokio::time::sleep(Duration::from_millis(ms)).await;
    depo.len() as u32 * 100
}

#[tokio::main]
async fn main() {
    let depolar = vec!["Isparta", "Ankara", "Eskişehir", "Bursa"];
    let mut set = JoinSet::new();
    for depo in depolar {
        set.spawn(async move { (depo, stok_say(depo).await) });
    }

    let mut sonuclar = Vec::new();
    while let Some(sonuc) = set.join_next().await {
        sonuclar.push(sonuc.unwrap()); // bitiş sırasıyla gelir
    }
    sonuclar.sort(); // deterministik çıktı için sırala
    for (depo, stok) in &sonuclar {
        println!("{depo}: {stok}");
    }
}
```

`join_next` sonuçları **bitiş sırasıyla** verir; bu sıra ağın, zamanlayıcının keyfine bağlıdır. Çıktıyı
deterministik yapmanın yolu: **önce topla, sonra sırala.** (Burada `&str` sabitleri `'static` olduğu için doğrudan
görevlere taşınabildi; sıradaki alıştırmada öyle değil.)

```parsons
prompt: "Bir sayı listesinin her elemanının karesini ayrı bir görevde hesaplayan, sonuçları toplayıp sıralayan ve yazdıran programı kur."
lines: |
  use tokio::task::JoinSet;
  #[tokio::main]
  async fn main() {
      let mut set = JoinSet::new();
      for n in [3u32, 1, 2] {
          set.spawn(async move { n * n });
      }
      let mut kareler = Vec::new();
      while let Some(sonuc) = set.join_next().await {
          kareler.push(sonuc.unwrap());
      }
      kareler.sort();
      println!("{kareler:?}");
  }
distractors: |
      while let Some(sonuc) = set.join_next() {
          set.spawn(async { n * n });
explanation: |
  Döngü değişkeni `n` her turda yeni bir değerdir; görevin `'static` olması için `async move` ile görevin içine
  taşınmalı (`u32` `Copy` olduğundan kopyalanır). `join_next()` bir future döndürür; `.await` olmadan `while let`
  bir future'ı `Some(..)` desenine eşlemeye çalışır ve derlenmez. Sonuçlar bitiş sırasıyla gelir, bu yüzden yazdırmadan
  önce sıralıyoruz: `[1, 4, 9]`.
```

Şimdi `JoinSet`, `timeout` ve sonuç toplama tekniklerini bir arada kullan.

```exercise
id: m19-e-hava-raporu
title: Eşzamanlı hava durumu raporu
difficulty: 3
prompt: |
  Meteoroloji istasyonlarına sıcaklık soran bir rapor aracı yazıyorsun. `sicaklik(sehir)` hazır: bilinmeyen şehir
  için `None` döner, bazı istasyonlar da çok yavaş cevap veriyor.

  `rapor` fonksiyonunu tamamla:

  - Her şehir için **`JoinSet`** ile ayrı bir görev başlat (sorgular aynı anda yapılmalı).
  - Her sorguyu **100 ms**'lik bir `timeout` ile sınırla; süreyi aşan istasyonu rapora alma.
  - Bilinmeyen şehirleri (`None`) de rapora alma.
  - Sonucu `(şehir, derece)` çiftleri olarak, **şehir adına göre sıralı** döndür.

  Dikkat: `sehirler` bir `&[&str]`; bu referanslar `'static` değil. Görevlere taşımadan önce sahipli bir `String`'e
  çevirmen gerekecek.
starter: |
  use std::time::Duration;
  use tokio::task::JoinSet;
  use tokio::time::{sleep, timeout};

  async fn sicaklik(sehir: &str) -> Option<i32> {
      let (gecikme, derece) = match sehir {
          "Ankara" => (30, 12),
          "Antalya" => (40, 27),
          "Isparta" => (20, 15),
          "Trabzon" => (50, 17),
          "Erzurum" => (400, -8), // istasyon çok yavaş
          _ => return None,
      };
      sleep(Duration::from_millis(gecikme)).await;
      Some(derece)
  }

  async fn rapor(sehirler: &[&str]) -> Vec<(String, i32)> {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let r = rapor(&["Trabzon", "Ankara", "Erzurum", "Atlantis"]).await;
      println!("{r:?}");
  }
solution: |
  use std::time::Duration;
  use tokio::task::JoinSet;
  use tokio::time::{sleep, timeout};

  async fn sicaklik(sehir: &str) -> Option<i32> {
      let (gecikme, derece) = match sehir {
          "Ankara" => (30, 12),
          "Antalya" => (40, 27),
          "Isparta" => (20, 15),
          "Trabzon" => (50, 17),
          "Erzurum" => (400, -8), // istasyon çok yavaş
          _ => return None,
      };
      sleep(Duration::from_millis(gecikme)).await;
      Some(derece)
  }

  async fn rapor(sehirler: &[&str]) -> Vec<(String, i32)> {
      let mut set = JoinSet::new();
      for &sehir in sehirler {
          let ad = sehir.to_string(); // görev 'static olmalı: sahipli kopya
          set.spawn(async move {
              let sonuc = timeout(Duration::from_millis(100), sicaklik(&ad)).await;
              (ad, sonuc)
          });
      }

      let mut rapor = Vec::new();
      while let Some(gorev_sonucu) = set.join_next().await {
          // Ok(görev bitti) → (ad, Ok(süre içinde) → Some(bilinen şehir))
          if let Ok((ad, Ok(Some(derece)))) = gorev_sonucu {
              rapor.push((ad, derece));
          }
      }
      rapor.sort();
      rapor
  }

  #[tokio::main]
  async fn main() {
      let r = rapor(&["Trabzon", "Ankara", "Erzurum", "Atlantis"]).await;
      println!("{r:?}");
  }
check: tests
tests: |
  use std::time::Instant;

  #[tokio::test]
  async fn sirali_rapor() {
      let r = rapor(&["Trabzon", "Ankara", "Isparta"]).await;
      let beklenen = vec![
          (String::from("Ankara"), 12),
          (String::from("Isparta"), 15),
          (String::from("Trabzon"), 17),
      ];
      assert_eq!(r, beklenen, "rapor şehir adına göre sıralı olmalı");
  }

  #[tokio::test]
  async fn yavas_ve_bilinmeyen_sehirler_atlanir() {
      let r = rapor(&["Erzurum", "Antalya", "Atlantis"]).await;
      assert_eq!(r, vec![(String::from("Antalya"), 27)], "Erzurum zaman aşımına uğramalı, Atlantis bilinmiyor");
  }

  #[tokio::test]
  async fn bos_liste_bos_rapor() {
      assert!(rapor(&[]).await.is_empty(), "şehir yoksa rapor boş olmalı");
  }

  #[tokio::test]
  async fn sorgular_ayni_anda_yapilir() {
      let basla = Instant::now();
      let r = rapor(&["Ankara", "Antalya", "Isparta", "Trabzon"]).await;
      let sure = basla.elapsed();
      assert_eq!(r.len(), 4);
      assert!(
          sure < Duration::from_millis(120),
          "4 sorgu sırayla ~140 ms sürer; aynı anda ~50 ms sürmeli (ölçülen: {sure:?})"
      );
  }
hints:
  - "Döngüde her şehir için `let ad = sehir.to_string();` yap ve `set.spawn(async move { ... })` içinde `timeout(Duration::from_millis(100), sicaklik(&ad)).await` çağır. Görevden `(ad, sonuc)` döndür."
  - "`join_next().await` sonucu iç içe sarılıdır: `Option<Result<(String, Result<Option<i32>, Elapsed>), JoinError>>`. `while let Some(x) = set.join_next().await` ile dış `Option`'ı aç."
  - "İçteki üç katmanı tek desenle aç: `if let Ok((ad, Ok(Some(derece)))) = x { rapor.push((ad, derece)); }`. En sonda `rapor.sort();` ve `rapor` döndür."
require:
  - pattern: "JoinSet"
    message: "Bu alıştırmada görevleri `JoinSet` ile başlatmalısın."
  - pattern: "timeout\\("
    message: "Her sorguyu `timeout(...)` ile sınırlamalısın."
explanation: |
  Çözümün üç katmanı var:

  1. **Sahiplik:** `sehirler` içindeki `&str`'ler çağıranın verisine işaret eder ve görevden kısa yaşayabilir;
     `spawn` ise `'static` ister. `sehir.to_string()` ile sahipli bir kopya oluşturup `async move` ile görevin
     içine taşıyoruz. Görevin içinde `sicaklik(&ad)` yazabiliyoruz, çünkü `ad` artık görevin kendi verisi.
  2. **Zaman aşımı:** Erzurum 400 ms sürüyor; `timeout` 100 ms'de `Err(Elapsed)` döner ve o sorguyu iptal eder.
     Rapor en yavaş istasyonu beklemek zorunda kalmaz.
  3. **Toplama:** `join_next` bitiş sırasıyla sonuç verir. İç içe deseni (`Ok((ad, Ok(Some(d))))`) tek `if let`
     ile açıp yalnızca başarılı ölçümleri tutuyoruz; sonra `sort()`. Tuple'lar önce ilk elemana (şehir adı) göre
     sıralanır.

  Alternatifler: `JoinHandle`'ları bir `Vec`'te toplayıp sırayla beklemek de olurdu, ama `JoinSet` drop edilince
  bütün görevleri iptal ettiği için daha güvenlidir (erken `return`'de arka planda sahipsiz görev kalmaz).
  Görev açmadan aynı eşzamanlılığı `futures::future::join_all` ile de sağlayabilirdin; o durumda `'static` şartı
  olmaz ve `&str`'leri doğrudan kullanabilirdin. Bunun bedeli, bütün sorguların tek görevde yoklanması ve bu
  yüzden paralel çalışamamasıdır.
```

## Özet

:::remember
- `tokio::spawn(fut)` → bağımsız bir **görev**; `JoinHandle.await` → `Result<T, JoinError>`. Şart: `Send + 'static` (gerekirse `async move`).
- `join!(a, b)` → hepsini **aynı görevde** eşzamanlı yokla, sonuçlar yazdığın sırayla gelir; ödünç alma serbest.
- `try_join!` → hepsi `Ok` ise tuple, ilk `Err`'de hemen döner ve diğerlerini iptal eder.
- `select!` → **ilk biten** dal çalışır, diğerleri drop edilir. Drop = iptal.
- `timeout(süre, fut)` → `Result<T, Elapsed>`; her dış çağrıya süre sınırı koy.
- `JoinSet` → dinamik sayıda görev; `join_next()` bitiş sırasıyla verir: **önce topla, sonra sırala**. Drop edilince görevleri iptal eder.
:::

```reflect
prompt: "Bir future'ı drop etmenin onu iptal etmek anlamına gelmesi neden mümkün? (İpucu: future'lar tembeldir ve yalnızca yoklanınca ilerler.) Bu durum hangi riski doğurur?"
answer: |
  Model cevap: Bir future kendi başına çalışmaz; yalnızca biri onu yokladıkça bir sonraki `.await` noktasına kadar
  ilerler. Future drop edilirse artık onu yoklayacak kimse kalmaz; iş, en son beklediği `.await` noktasında kalır ve
  yerel değişkenleri drop edilir. Bu, iptali ucuz ve basit yapar ama riski şudur: iş yarıda kalabilir. İki adımlı
  bir işlemin ilk adımı yapılmış, ikincisi yapılmamış olabilir; bu yüzden `select!`/`timeout` içinde kullanılan
  işlerin yarıda kesildiğinde tutarsız durum bırakmaması (iptal güvenliği) gerekir.
```

```flashcards
- front: "`tokio::spawn` ile başlatılan bir future hangi iki şartı sağlamalıdır?"
  back: "`Send` (görev thread'ler arasında taşınabilir) ve `'static` (yerel değişkenleri ödünç alamaz, gerekirse `async move`)."
- front: "`JoinHandle<T>`'yi `.await` etmek ne döndürür?"
  back: "`Result<T, JoinError>`: görev panik atarsa ya da iptal edilirse `Err`."
- front: "`join!` ile `tokio::spawn` arasındaki temel fark nedir?"
  back: "`join!` future'ları **mevcut görevde** eşzamanlı yoklar (paralellik yok, ödünç alabilir); `spawn` bağımsız, paralel çalışabilen yeni bir görev oluşturur."
- front: "`try_join!` bir future `Err` döndürünce ne yapar?"
  back: "Hemen o `Err`'i döndürür ve henüz bitmemiş diğer future'ları drop eder (iptal)."
- front: "`select!`'te kaybeden future'lara ne olur?"
  back: "Drop edilirler: bir daha yoklanmazlar, en son `.await` noktalarında iptal olurlar."
- front: "`tokio::time::timeout(d, f).await` hangi tipi döndürür?"
  back: "`Result<T, Elapsed>`: süre içinde biterse `Ok(değer)`, bitmezse `Err(Elapsed)` (ve `f` iptal edilir)."
- front: "`JoinSet::join_next` sonuçları hangi sırayla verir? Deterministik çıktı için ne yapılır?"
  back: "**Bitiş sırasıyla**. Önce bütün sonuçları topla, sonra sırala."
```
