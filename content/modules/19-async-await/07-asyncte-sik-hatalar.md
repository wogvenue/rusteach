---
id: m19-l07
title: Async'te sık hatalar
minutes: 22
type: lesson
objectives:
  - "Executor'ı bloklayan kodu (`std::thread::sleep`, ağır hesap, senkron I/O) tanıyıp `spawn_blocking` ile düzeltebilmek"
  - "`.await` boyunca yaşayan `Send` olmayan değerlerin (`MutexGuard`, `Rc`) yol açtığı \"future cannot be sent between threads safely\" hatasını okuyup kapsamla düzeltebilmek"
  - "Unutulan `.await`'i ve `main` bitince kesilen görevleri fark edebilmek"
  - "`select!` içinde iptal güvenliği (cancellation safety) sorununu açıklayıp durumu future dışına taşıyarak ya da future'ı sabitleyerek önleyebilmek"
keywords: [spawn_blocking, block_in_place, Send, MutexGuard, Rc, unused future, JoinHandle, abort, iptal güvenliği, cancellation safety, select!, thread vs async]
---

Async kod derlendiğinde çoğu zaman doğru çalışır; ama derlenip **yanlış** çalıştığı birkaç klasik durum vardır:
program donar, bir mesaj sessizce kaybolur, bir e-posta hiç gönderilmez. Bu derste, gerçek projelerde en çok
zaman kaybettiren beş tuzağı tek tek kuracak, her birinin **neden** oluştuğunu Ders 5'teki "future = durum makinesi"
modeliyle açıklayacak ve düzelteceksin. Son adımda da modülün büyük sorusunu cevaplayacağız: **thread mi, async mi?**

:::ferris
Bu dersteki hataların çoğu derleyiciden kaçar ya da sadece uyarı olarak görünür. O yüzden burada öğrendiklerin,
kod incelemesinde (code review) seni "async'i bilen kişi" yapacak. 🦀
:::

## Tuzak 1: Executor'ı bloklamak

Aşağıdaki programda bir "nabız" görevi her 10 ms'de bir sinyal veriyor; `main` ise 60 ms süren ağır bir hesap yapıyor.
Runtime'ı tek thread'li (`flavor = "current_thread"`) kurduk ki sorun net görünsün. Tahmin et:

```predict
code: |
  use std::time::Duration;
  use tokio::time::sleep;

  fn agir_hesap() -> u64 {
      std::thread::sleep(Duration::from_millis(60)); // 60 ms işlemciyi meşgul eden bir hesap gibi
      42
  }

  #[tokio::main(flavor = "current_thread")]
  async fn main() {
      let nabiz = tokio::spawn(async {
          for i in 1..=3 {
              println!("nabız {i}");
              sleep(Duration::from_millis(10)).await;
          }
      });
      let sonuc = agir_hesap();
      println!("hesap bitti: {sonuc}");
      nabiz.await.unwrap();
  }
options:
  - |
    nabız 1
    nabız 2
    nabız 3
    hesap bitti: 42
  - |
    hesap bitti: 42
    nabız 1
    nabız 2
    nabız 3
  - |
    nabız 1
    hesap bitti: 42
    nabız 2
    nabız 3
answer: 1
explanation: |
  `tokio::spawn` görevi **kuyruğa koyar**; onu çalıştıracak tek thread ise `main` görevini yürütüyor. `agir_hesap()`
  sıradan, senkron bir fonksiyon: içinde `.await` yok, yani `main` 60 ms boyunca thread'i hiç bırakmıyor. Nabız
  görevi ancak `main` ilk kez beklemeye geçtiğinde (`nabiz.await`) başlayabiliyor. 60 ms boyunca hiç nabız atmadı:
  gerçek bir sunucuda bu, o sırada gelen **bütün** isteklerin cevapsız kalması demektir.
```

Async'in temel sözleşmesini hatırla (Ders 1): görevler **işbirlikçidir**, sırayı ancak `.await` noktalarında
bırakırlar. İki `.await` arasında uzun süren her şey, o thread'deki bütün görevleri dondurur. Çok thread'li runtime'da
(varsayılan `#[tokio::main]`, çekirdek sayısı kadar işçi thread'i) tek bir bloklama "sadece" bir işçiyi kilitler;
ama yük altında birkaç bloklayan istek bütün işçileri kilitlemeye yeter. Tokio ekibinin pratik ölçüsü: iki `.await`
arasında **10-100 mikrosaniyeden** uzun kalma.

Bloklayan başlıca şeyler: `std::thread::sleep`, senkron dosya ve ağ işlemleri (`std::fs`, `std::net`),
`std::sync::mpsc::Receiver::recv`, uzun döngüler ve ağır hesaplar (şifre özeti, sıkıştırma, resim işleme).

:::analogy Mutfağa giren garson
Ders 1'deki tek garson on masaya bakıyordu. Bir müşteri "Mantı istiyorum" dedi ve garson **kendisi mutfağa girip
40 dakika hamur açmaya başladı**. O sırada dokuz masa ne su alabilir ne hesap ödeyebilir. Doğrusu siparişi
**aşçıya vermek** (`spawn_blocking`) ve masalara dönmektir; mantı hazır olunca aşçı zili çalar (`Waker`).
:::

Çözüm **`tokio::task::spawn_blocking`**: verilen senkron closure'ı tokio'nun ayrı **bloklama thread havuzunda**
(blocking pool) çalıştırır ve bir `JoinHandle` döndürür. Async taraf onu `.await` ile bekler; beklerken thread'ini
başka görevlere bırakır:

```rust
use std::time::Duration;
use tokio::time::sleep;

fn agir_hesap() -> u64 {
    std::thread::sleep(Duration::from_millis(60)); // 60 ms işlemciyi meşgul eden bir hesap gibi
    42
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let nabiz = tokio::spawn(async {
        for i in 1..=3 {
            println!("nabız {i}");
            sleep(Duration::from_millis(10)).await;
        }
    });
    // Ağır işi bloklama havuzuna ver; bu görev beklerken thread nabız görevini yürütebilir
    let sonuc = tokio::task::spawn_blocking(agir_hesap).await.unwrap();
    println!("hesap bitti: {sonuc}");
    nabiz.await.unwrap();
}
```

| Durum | Çözüm |
|---|---|
| Kaçınılmaz senkron I/O ya da kısa-orta süreli ağır hesap | `tokio::task::spawn_blocking(closure).await` |
| Çok büyük, paralelleştirilebilir CPU işi | `rayon` (Modül 18) + sonucu `oneshot` kanalıyla geri gönder |
| Hiç bitmeyen bloklayan döngü (ör. donanım okuma) | Kendi `std::thread::spawn` thread'i + kanallar |
| Uzun bir async döngü, her tur kısa | Arada `tokio::task::yield_now().await` ile sırayı bırak |
| Async API'si olan iş | Async sürümünü kullan: `tokio::time::sleep`, `tokio::fs`, `tokio::net` |

:::warning Runtime içinde runtime başlatma
Senkron bir yardımcı fonksiyonda "async bir şey çağırmam lazım" diye yeni bir runtime kurup `block_on` çağırmak,
async bir görevin içinden çağrıldığında **panikler**:
```text
Cannot start a runtime from within a runtime. This happens because a function (like `block_on`)
attempted to block the current thread while the thread is being used to drive asynchronous tasks.
```
Doğrusu yardımcı fonksiyonu da `async` yapmak ya da (gerçekten senkron kalması gerekiyorsa) onu `spawn_blocking`
içinden çağırmaktır. Ayrıca `spawn_blocking` ile başlamış bir iş **iptal edilemez**: `abort()` onu durdurmaz, closure
sonuna kadar çalışır.
:::

```fill
prompt: "CSV dosyasını ayrıştırmak gibi ağır, senkron bir işi executor'ı bloklamadan çalıştır ve sonucunu al."
code: |
  fn satir_say(icerik: String) -> usize {
      // Gerçekte büyük bir dosyanın ağır ayrıştırması
      icerik.lines().filter(|s| !s.trim().is_empty()).count()
  }

  #[tokio::main]
  async fn main() {
      let icerik = String::from("ad,not\nAyşe,90\n\nMehmet,75\n");
      let sayi = tokio::task::___0(move || satir_say(icerik))
          .await
          .___1();
      println!("{sayi} dolu satır");
  }
blanks:
  - ["spawn_blocking"]
  - ["unwrap"]
output: "3 dolu satır"
explanation: |
  `spawn_blocking` bir `JoinHandle<usize>` döndürür; `.await` sonucu `Result<usize, JoinError>`'dır (closure
  paniklerse `Err`), bu yüzden `unwrap()`. Closure `'static` olmalı ve başka bir thread'e gidecek: `icerik`'i `move` ile
  içeri **taşıyoruz** (Modül 18'deki `thread::spawn` kuralının aynısı). Boş satır `filter` ile elendiği için 3.
```

Şimdi sıra sende: ağır işi bloklama havuzuna verip birçok işi aynı anda yürüt.

```exercise
id: m19-e-sifre-ozeti
title: Şifre özetlerini executor'ı dondurmadan hesapla
difficulty: 3
prompt: |
  Bir üyelik sisteminde yeni kullanıcıların şifreleri kaydedilmeden önce **özetleniyor** (hash). `ozet_hesapla`
  bilerek yavaş bir fonksiyon (gerçekte argon2/bcrypt gibi algoritmalar saldırganları yavaşlatmak için öyle tasarlanır):
  her çağrı thread'i ~50 ms meşgul ediyor. Onu **değiştirme**.

  1. `ozetle(sifre)`: `ozet_hesapla`'yı `tokio::task::spawn_blocking` ile çalıştırıp sonucunu döndürsün.
     Bu sırada aynı thread'deki diğer görevler donmamalı.
  2. `hepsini_ozetle(sifreler)`: bütün şifreleri **aynı anda** özetlesin (4 şifre sırayla 200 ms sürer; seninki
     150 ms'den kısa sürmeli) ve sonuçları **giriş sırasıyla** döndürsün. Boş liste boş sonuç verir.
starter: |
  use std::time::Duration;

  // Ağır, bloklayan bir iş - bu fonksiyonu değiştirme
  fn ozet_hesapla(sifre: &str) -> u64 {
      std::thread::sleep(Duration::from_millis(50)); // ~50 ms işlemci işi gibi
      sifre.bytes().fold(5381u64, |h, b| h.wrapping_mul(33) ^ b as u64)
  }

  async fn ozetle(sifre: String) -> u64 {
      todo!()
  }

  async fn hepsini_ozetle(sifreler: Vec<String>) -> Vec<u64> {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let ozetler = hepsini_ozetle(vec![String::from("ayse123"), String::from("kedi")]).await;
      println!("{ozetler:?}");
  }
solution: |
  use std::time::Duration;

  // Ağır, bloklayan bir iş - bu fonksiyonu değiştirme
  fn ozet_hesapla(sifre: &str) -> u64 {
      std::thread::sleep(Duration::from_millis(50)); // ~50 ms işlemci işi gibi
      sifre.bytes().fold(5381u64, |h, b| h.wrapping_mul(33) ^ b as u64)
  }

  async fn ozetle(sifre: String) -> u64 {
      tokio::task::spawn_blocking(move || ozet_hesapla(&sifre))
          .await
          .expect("özet görevi panikledi")
  }

  async fn hepsini_ozetle(sifreler: Vec<String>) -> Vec<u64> {
      let mut kollar = Vec::new();
      for sifre in sifreler {
          kollar.push(tokio::spawn(ozetle(sifre))); // hepsi hemen başlar
      }
      let mut sonuclar = Vec::new();
      for kol in kollar {
          sonuclar.push(kol.await.expect("görev panikledi")); // giriş sırasıyla topla
      }
      sonuclar
  }

  #[tokio::main]
  async fn main() {
      let ozetler = hepsini_ozetle(vec![String::from("ayse123"), String::from("kedi")]).await;
      println!("{ozetler:?}");
  }
check: tests
tests: |
  use std::cell::RefCell;
  use std::time::Instant;

  #[tokio::test]
  async fn tek_ozet_dogru() {
      assert_eq!(
          ozetle(String::from("rust")).await,
          ozet_hesapla("rust"),
          "ozetle, ozet_hesapla ile aynı sonucu vermeli"
      );
  }

  #[tokio::test]
  async fn executor_bloklanmaz() {
      // #[tokio::test] tek thread'li bir runtime kurar; ağır iş bu thread'de yapılırsa "tik"ler en sona kalır
      let kayit = RefCell::new(Vec::new());
      tokio::join!(
          async {
              ozetle(String::from("x")).await;
              kayit.borrow_mut().push("özet");
          },
          async {
              for _ in 0..3 {
                  kayit.borrow_mut().push("tik");
                  tokio::task::yield_now().await;
              }
          },
      );
      assert_eq!(
          *kayit.borrow(),
          vec!["tik", "tik", "tik", "özet"],
          "ağır iş spawn_blocking'e verilmeli; yoksa özet bitene kadar diğer işler donar"
      );
  }

  #[tokio::test]
  async fn hepsi_sirali_ve_ayni_anda() {
      let sifreler: Vec<String> = ["a", "bb", "ccc", "dddd"].iter().map(|s| s.to_string()).collect();
      let beklenen: Vec<u64> = sifreler.iter().map(|s| ozet_hesapla(s)).collect();
      let baslangic = Instant::now();
      let sonuc = hepsini_ozetle(sifreler).await;
      let sure = baslangic.elapsed();
      assert_eq!(sonuc, beklenen, "sonuçlar giriş sırasıyla dönmeli");
      assert!(
          sure < Duration::from_millis(150),
          "4 özet aynı anda hesaplanmalı (sırayla 200 ms sürer); ölçülen süre: {sure:?}"
      );
  }

  #[tokio::test]
  async fn bos_liste() {
      assert!(hepsini_ozetle(Vec::new()).await.is_empty(), "boş liste boş sonuç vermeli");
  }
hints:
  - "`ozetle`: `tokio::task::spawn_blocking(move || ozet_hesapla(&sifre))` bir `JoinHandle<u64>` döndürür; onu `.await` et ve `Result`'ı `expect` ile aç."
  - "`hepsini_ozetle`: önce **bütün** işleri başlat, sonra bekle. Bir döngüde her şifre için `tokio::spawn(ozetle(sifre))` ile görev başlatıp `JoinHandle`'ları bir `Vec`'te topla."
  - "İkinci döngüde `for kol in kollar { sonuclar.push(kol.await.expect(\"görev panikledi\")); }`, handle'ları başlatma sırasıyla beklediğin için sonuçlar giriş sırasıyla gelir. `ozetle(sifre).await`'i ilk döngünün içinde yapmak işleri sıraya sokar (200 ms)."
explanation: |
  `ozetle` iki işi birden yapıyor: ağır hesabı bloklama havuzuna gönderiyor ve async tarafta **sırayı bırakarak**
  bekliyor. `executor_bloklanmaz` testi bunu ölçüyor: `#[tokio::test]` tek thread'li bir runtime kurar; hesap bu
  thread'de yapılsaydı `join!`'in ilk kolu 50 ms boyunca thread'i tutar, "tik"ler ancak sonra gelirdi.

  `hepsini_ozetle`'de anahtar "**önce hepsini başlat, sonra bekle**". `tokio::spawn` görevi hemen başlatır;
  `JoinHandle`'ları başlatma sırasıyla `.await` ettiğimiz için sonuç sırası giriş sırasıyla aynı olur. Bekleme
  sırası toplam süreyi değiştirmez: dört iş zaten paralel ilerliyor. Alternatifler:
  `futures::future::join_all(sifreler.into_iter().map(ozetle))` (görev açmadan, tek görevde aynı anda yoklar; ağır
  kısım zaten bloklama havuzunda) ya da `JoinSet` + indeksle sıralama (Ders 3).

  Neden `move || ozet_hesapla(&sifre)`? `spawn_blocking`'in closure'ı başka bir thread'de çalışır, `'static` olmalı;
  `sifre`'yi closure'ın içine taşıyıp orada ödünç veriyoruz.
```

## Tuzak 2: `.await` boyunca Send olmayan değerler

Ders 4'te `std::sync::MutexGuard`'ı `.await` boyunca tutunca `tokio::spawn`'ın reddettiğini görmüştün. Bu sefer
kodu yazan kişi dersini almış görünüyor: kilidi `.await`'ten **önce** `drop` ile bırakıyor. Derlenir mi?

```compiles
code: |
  use std::sync::{Arc, Mutex};

  #[tokio::main]
  async fn main() {
      let sepet = Arc::new(Mutex::new(Vec::new()));
      let s = Arc::clone(&sepet);
      tokio::spawn(async move {
          let mut liste = s.lock().unwrap();
          liste.push("elma");
          drop(liste); // kilidi bıraktım!
          tokio::task::yield_now().await;
      })
      .await
      .unwrap();
      println!("{:?}", sepet.lock().unwrap());
  }
answer: false
explanation: |
  Şaşırtıcı ama derlenmez: "future cannot be sent between threads safely ... has type `std::sync::MutexGuard<'_, Vec<&str>>`
  which is not `Send`". Çalışma anında kilit gerçekten bırakılıyor; ama derleyicinin future'ın içinde neyin
  saklandığına dair analizi **kapsama (scope)** bakar. `liste` değişkeninin kapsamı bloğun sonuna kadar sürdüğü için
  derleyici onu `.await` noktasında "hâlâ yaşıyor olabilir" sayar. Çözüm `drop` değil, **kapsamı daraltmak**:
  kilitli bölgeyi `{ ... }` bloğuna ya da ayrı bir senkron fonksiyona almak.
```

Kural tek cümlede: **`tokio::spawn` edilen bir future, ancak `.await` noktalarında yaşayan her değer `Send` ise
`Send`'dir.** Future bir `.await`'te askıya alınıp başka bir işçi thread'de devam edebilir; o anda içinde saklı olan
her şey thread değiştirebilmelidir. Modül 17-18'den bildiğin `Send` olmayan tipler burada tekrar karşına çıkar:

:::error
```text
error: future cannot be sent between threads safely
   --> src/main.rs:10:17
    |
 10 |       let gorev = tokio::spawn(async {
    |  _________________^
 11 | |         let ayar = Rc::new(String::from("tr-TR"));
 12 | |         kaydet(&ayar).await;
 13 | |         println!("dil: {ayar}");
 14 | |     });
    | |______^ future created by async block is not `Send`
    |
    = help: within `{async block@src/main.rs:10:30: 10:35}`, the trait `Send` is not implemented for `Rc<String>`
note: future is not `Send` as this value is used across an await
   --> src/main.rs:12:23
    |
 11 |         let ayar = Rc::new(String::from("tr-TR"));
    |             ---- has type `Rc<String>` which is not `Send`
 12 |         kaydet(&ayar).await;
    |                       ^^^^^ await occurs here, with `ayar` maybe used later
```
Okuma sırası her zaman aynı: **hangi tip** `Send` değil (`Rc<String>`) → **hangi değişken** (`ayar`) → **hangi
`.await`** noktasında yaşıyor. Hata kodu yok; ama mesaj neyi düzelteceğini tam olarak gösteriyor.
:::

```quiz
question: "Yukarıdaki `Rc` hatasını düzeltmek için en doğru değişiklik hangisi?"
options:
  - "`Rc::new(...)` yerine `Arc::new(...)` kullanmak (ya da paylaşım gerekmiyorsa düz `String`)"
  - "`ayar`'ı `Rc::clone(&ayar)` ile kopyalayıp kopyayı `kaydet`'e vermek"
  - "`tokio::spawn` yerine `std::thread::spawn` kullanmak"
  - "`unsafe impl Send for Rc<String> {}` yazmak"
answer: 0
explanation: |
  `Rc`'nin sayacı atomik değildir; iki thread aynı anda klonlarsa sayaç bozulur (Modül 17-18). Thread değiştirebilen
  bir görevde paylaşılan sahiplik için **`Arc`** kullanılır. Burada aslında paylaşım bile yok; düz bir `String`
  yeterli. Genel çözüm yelpazesi: `Send` bir tip seç (`Arc`, `tokio::sync::Mutex`), değeri `.await`'ten önce biten
  bir bloğa al ya da görevi hiç `spawn` etme (`join!` ve `select!` aynı görevde çalıştığı için `Send` istemez).
feedback:
  - "Doğru!"
  - "Bir `Rc` klonu da `Rc`'dir; yine `Send` değildir."
  - "`std::thread::spawn` async bir bloğu çalıştırmaz, üstelik o da `Send` ister."
  - "Yabancı bir tipe yabancı trait uygulanamaz (orphan kuralı) ve bu, gerçek bir veri yarışını gizlemek olurdu."
```

Doğru kalıp şöyle: `Send` olmayan değerlerle işini **senkron bir bloğun içinde** bitir, sadece `Send` sonuçları
`.await`'in öbür tarafına taşı.

```rust
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let stok = Arc::new(Mutex::new(vec![("simit", 12), ("poğaça", 0)]));
    let s = Arc::clone(&stok);
    let gorev = tokio::spawn(async move {
        let tukenenler: Vec<&str> = {
            let liste = s.lock().unwrap(); // guard bu bloğun içinde yaşıyor...
            liste.iter().filter(|(_, adet)| *adet == 0).map(|(ad, _)| *ad).collect()
        }; // ...ve burada drop ediliyor; .await'e yalnızca Vec<&str> (Send) taşınıyor
        tokio::time::sleep(Duration::from_millis(5)).await; // tedarikçiye sipariş (ağ isteği)
        tukenenler
    });
    println!("sipariş verilenler: {:?}", gorev.await.unwrap());
}
```

:::tip Spawn etmeden de çalışabilirsin
`Send` şartını koyan `tokio::spawn`'dır, `.await`'in kendisi değil. `Send` olmayan bir future'ı `main` içinde doğrudan
`.await` edebilir, `join!`/`select!` ile birleştirebilirsin. `Send` olmayan görevleri bir arada çalıştırmak için tokio
ayrıca `tokio::task::LocalSet` ve `spawn_local` sunar (görevler tek thread'e bağlı kalır).
:::

## Tuzak 3: `.await`'i ve görevleri unutmak

Ders 2'de unutulan `.await`'in sadece bir **uyarı** ürettiğini görmüştün: `kaydet();` yazıp geçersen future hiç
çalışmaz. Sonucu kullanmaya çalışırsan ise tip sistemi seni hemen yakalar:

:::error
```text
error[E0369]: cannot add `{integer}` to `impl Future<Output = u32>`
 --> src/main.rs:8:23
  |
8 |     let toplam = adet + 3;
  |                  ---- ^ - {integer}
  |                  |
  |                  impl Future<Output = u32>
```
`let adet = stok("simit");` satırında `.await` unutulmuş: `adet` bir sayı değil, **henüz çalışmamış bir future**.
Hata mesajında `impl Future<Output = T>` görürsen ilk şüphelin eksik bir `.await`'tir.
:::

Daha sinsi olanı, **başlatılıp beklenmeyen görevler**. Bir sipariş alındığında arka planda onay e-postası
gönderiliyor. Tahmin et:

```predict
code: |
  use std::time::Duration;

  #[tokio::main]
  async fn main() {
      tokio::spawn(async {
          tokio::time::sleep(Duration::from_millis(20)).await; // e-posta sunucusuyla konuşuyor
          println!("e-posta gönderildi");
      });
      println!("sipariş alındı");
  }
options:
  - |
    sipariş alındı
    e-posta gönderildi
  - |
    e-posta gönderildi
    sipariş alındı
  - |
    sipariş alındı
answer: 2
explanation: |
  `tokio::spawn` görevi başlattı ama kimse onu beklemedi. `main` bittiğinde `#[tokio::main]` runtime'ı **kapatır** ve
  hâlâ bekleyen bütün görevleri ilk `.await` noktalarında drop eder. E-posta görevi `sleep`'te beklerken yok edildi;
  derleyici de uyarmadı, çünkü `JoinHandle`'ı kullanmamak bir hata değildir. Modül 18'deki thread'lerde de `main`
  bitince diğer thread'ler ölüyordu; burada aynı kural görevler için geçerli.
```

Çözüm, önemli görevlerin `JoinHandle`'ını saklayıp kapanmadan önce beklemektir (çok sayıda görev için Ders 3'teki
`JoinSet`). İki ayrıntıyı karıştırma:

- `JoinHandle`'ı **drop etmek** görevi iptal **etmez**; görev arka planda çalışmaya devam eder (runtime yaşadığı sürece).
- Bir görevi iptal etmek için `kol.abort()` çağrılır; görev bir sonraki `.await` noktasında durdurulur ve
  `kol.await` `Err(JoinError)` döner (`e.is_cancelled()` true).

## Tuzak 4: İptal güvenliği (cancellation safety)

Ders 3'te `select!`'in kaybeden dalları **drop ettiğini** gördün. Peki drop edilen future'ın içinde yarım kalmış bir iş
varsa? Bu program iki mesajı birleştirip bir "paket" yapıyor; her 40 ms'de bir de zaman aşımı kontrolü var. Gönderen
önce `"a"`'yı, 60 ms sonra `"b"` ve `"c"`'yi gönderiyor. Tahmin et:

```predict
code: |
  use std::time::Duration;
  use tokio::sync::mpsc;
  use tokio::time::sleep;

  // İki mesajı birleştirip tek bir "paket" yapar
  async fn paket_oku(rx: &mut mpsc::Receiver<&'static str>) -> String {
      let ilk = rx.recv().await.unwrap();
      let ikinci = rx.recv().await.unwrap(); // burada beklerken iptal edilirse?
      format!("{ilk}+{ikinci}")
  }

  #[tokio::main]
  async fn main() {
      let (tx, mut rx) = mpsc::channel(10);
      tokio::spawn(async move {
          tx.send("a").await.unwrap();
          sleep(Duration::from_millis(60)).await;
          tx.send("b").await.unwrap();
          tx.send("c").await.unwrap();
      });

      for _ in 0..2 {
          tokio::select! {
              p = paket_oku(&mut rx) => println!("paket: {p}"),
              _ = sleep(Duration::from_millis(40)) => println!("zaman aşımı"),
          }
      }
  }
options:
  - |
    zaman aşımı
    paket: a+b
  - |
    zaman aşımı
    paket: b+c
  - |
    paket: a+b
    zaman aşımı
answer: 1
explanation: |
  1. tur: `paket_oku` `"a"`'yı alıp yerel `ilk` değişkenine koyuyor, ikinci `recv`'de bekliyor. 40 ms'de zaman aşımı
     dalı kazanıyor; `select!` `paket_oku` future'ını **drop ediyor**. `ilk = "a"` future'ın içinde saklıydı, onunla
     birlikte yok oldu.
  2. tur: **yepyeni** bir `paket_oku` future'ı başlıyor; 60 ms'de gelen `"b"` ve `"c"`'yi birleştiriyor.
  `"a"` sessizce kayboldu: ne hata, ne panik, ne uyarı.
```

Ders 5'teki modeli hatırla: `.await` boyunca yaşayan yereller **future'ın içinde** saklanır. Future drop edilince
onlar da gider:

```memory
title: paket_oku future'ı select! içinde iptal ediliyor
steps:
  - caption: "1. tur: `paket_oku` `\"a\"`'yı kanaldan aldı; ikinci `recv`'de bekliyor. `ilk` future'ın içinde saklı."
    stack:
      - frame: main
        vars:
          - { name: rx, type: Receiver, value: "kuyruk: (boş)" }
          - { name: paket_oku(..), type: future, value: "Bekleme2 { ilk }", to: h1 }
    heap:
      - { id: h1, label: "future'ın durumu", value: "ilk = \"a\" | ikinci: bekleniyor" }
  - caption: "40 ms: zaman aşımı dalı kazandı, `select!` future'ı drop etti. `\"a\"` kanaldan çoktan alınmıştı; artık hiçbir yerde yok."
    stack:
      - frame: main
        vars:
          - { name: rx, type: Receiver, value: "kuyruk: (boş)" }
          - { name: paket_oku(..), type: future, value: "drop edildi", moved: true }
    heap:
      - { id: h1, label: "future'ın durumu", value: "ilk = \"a\" | ikinci: bekleniyor", freed: true }
```

Bir future'ı tamamlanmadan drop etmek hiçbir veri ya da etki kaybettirmiyorsa o future **iptal güvenlidir
(cancellation safe)**. `rx.recv()` iptal güvenlidir: mesaj ya alınmıştır ya da kuyrukta durur. Ama iki `recv`'i
birleştiren `paket_oku` değildir. Tokio belgeleri her metot için bunu yazar:

| İptal güvenli | İptal güvenli **değil** |
|---|---|
| `mpsc::Receiver::recv`, `broadcast::Receiver::recv` | `AsyncReadExt::read_exact`, `read_to_end` (yarım okunan veri kaybolur) |
| `JoinSet::join_next`, `tokio::time::sleep` | `tokio::sync::Mutex::lock`, `Semaphore::acquire` (kuyruktaki **sıranı** kaybedersin) |
| `oneshot::Receiver` (`&mut rx` ile beklenirse) | Kendi yazdığın, birden çok `.await` arasında durum biriktiren fonksiyonlar |

İki düzeltme yolu var. **Birincisi: yarım kalan durumu future'ın dışında tut.** `select!`'e yalnızca iptal güvenli
`recv()`'i ver, birikmiş durumu döngünün değişkeninde sakla:

```rust
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::sleep;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel(10);
    tokio::spawn(async move {
        tx.send("a").await.unwrap();
        sleep(Duration::from_millis(60)).await;
        tx.send("b").await.unwrap();
        tx.send("c").await.unwrap();
    });

    // Yarım kalan paket future'ın DIŞINDA, döngünün değişkeninde duruyor
    let mut ilk: Option<&str> = None;
    let mut paket_sayisi = 0;
    while paket_sayisi < 1 {
        tokio::select! {
            Some(mesaj) = rx.recv() => match ilk.take() {
                None => ilk = Some(mesaj),
                Some(a) => {
                    println!("paket: {a}+{mesaj}");
                    paket_sayisi += 1;
                }
            },
            _ = sleep(Duration::from_millis(40)) => println!("zaman aşımı"),
        }
    }
}
```

**İkincisi: future'ı döngüden önce bir kez oluştur, sabitle ve `&mut` ile bekle.** Böylece `select!` her turda
future'ı yeniden yaratıp eskisini drop etmez; kaybeden dal sadece **ödünç verilmiş** olur, future kaldığı yerden devam
eder. Ders 5'teki "cannot be unpinned" hatası tam da bu kullanımda çıkar; ilacı `pin!`.

```parsons
prompt: "Uzun süren bir indirmeyi **iptal etmeden** beklerken her 30 ms'de bir \"hâlâ iniyor...\" yazdıran programı kur."
lines: |
  use std::time::Duration;
  use tokio::time::sleep;
  #[tokio::main]
  async fn main() {
      let mut indirme = std::pin::pin!(async {
          sleep(Duration::from_millis(70)).await;
          "harita.zip"
      });
      loop {
          tokio::select! {
              dosya = &mut indirme => {
                  println!("{dosya} indi");
                  break;
              }
              _ = sleep(Duration::from_millis(30)) => println!("hâlâ iniyor..."),
          }
      }
  }
distractors: |
      let indirme = async {
              dosya = indirme => {
explanation: |
  Future döngüden **önce** bir kez oluşturuluyor ve `pin!` ile sabitleniyor; `select!`'e `&mut indirme` veriliyor.
  Zaman aşımı dalı kazandığında drop edilen şey sadece `&mut` ödünç alma; indirme kaldığı yerden sürüyor ve 70 ms'de
  biter (çıktı: iki kez "hâlâ iniyor...", sonra "harita.zip indi"). `dosya = indirme` yazsaydın future ilk turda
  `select!`'e **taşınırdı** ve ikinci turda kullanılamazdı (E0382). `pin!` olmadan `&mut indirme` ise "cannot be
  unpinned" hatası verir, çünkü async blok `Unpin` değildir.
```

## Thread mi, async mi?

Modülün başındaki soruya artık bilinçli cevap verebilirsin. Async bedava değildir: `Send` sınırları, `Pin`, iptal
güvenliği, iki "renkli" fonksiyon dünyası (async fonksiyon sadece async bağlamdan beklenebilir) ve daha uzun derleme
süreleri. Bu bedeli, **çok sayıda eşzamanlı beklemeniz** olduğunda ödemeye değer.

| Senaryo | Seçim | Neden |
|---|---|---|
| 10.000 eşzamanlı bağlantılı web/sohbet sunucusu | **Async** (tokio) | İş çoğunlukla beklemek; görev başına birkaç KB, thread başına MB'lar |
| 100 URL'yi aynı anda indirmek | **Async** + `buffered`/`Semaphore` | I/O-bound, sınırlı eşzamanlılık kolay |
| Büyük bir resmi 8 çekirdekte filtrelemek | **Thread**'ler / `rayon` | CPU-bound; beklenecek bir şey yok, `.await` hiçbir şey kazandırmaz |
| Dosya okuyup satır sayan küçük bir CLI aracı | **Senkron** kod | Eşzamanlılık yok; async sadece karmaşıklık ekler |
| Async sunucu içinde şifre özeti, sıkıştırma | Async + **`spawn_blocking`** | Ana yapı I/O, ağır parçalar havuza |
| Az sayıda uzun ömürlü arka plan işi | **Thread** + kanallar (Modül 18) | Basit, `Send`/`Pin` derdi yok |

:::deep Diğer diller bu sorunu nasıl çözüyor?
- **Go**: goroutine'ler runtime tarafından **önleyici (preemptive)** zamanlanır, bloklayan çağrılar otomatik
  olarak ayrı thread'e alınır. Fonksiyon "renkleri" yoktur; bedeli, her programda gömülü bir runtime ve çöp
  toplayıcıdır.
- **Java 21 virtual threads (Loom)**: Go'ya benzer; JVM, bloklayan çağrıda sanal thread'i askıya alır.
- **JavaScript**: tek thread'li olay döngüsü; `await` unutulursa bir `Promise` döner, bir `while(true)` döngüsü
  bütün sayfayı dondurur: Tuzak 1'in aynısı.
- **Python asyncio**: Rust'a en yakın model; `time.sleep` yerine `await asyncio.sleep` kuralı ve
  `run_in_executor` (bizim `spawn_blocking`) aynen var.

Rust, runtime'ı dile gömmek yerine kütüphaneye bıraktı: gömülü sistemlerden sunuculara kadar her yerde **sıfır
maliyetli** future'lar, karşılığında bu dersteki kurallara dikkat etme sorumluluğu.
:::

```quiz
question: "Hangi iki senaryoda async (tokio) **en iyi seçim değildir**? (İki seçenek işaretle.)"
options:
  - "Aynı anda binlerce WebSocket bağlantısını yöneten bir oyun sunucusu"
  - "Bir klasördeki 10.000 fotoğrafın küçük resimlerini tüm çekirdekleri kullanarak üretmek"
  - "Bir mikroservisin, cevap vermek için 3 farklı servise aynı anda istek atması"
  - "Tek bir dosyayı okuyup kelime sayan küçük bir komut satırı aracı"
answer: [1, 3]
explanation: |
  Fotoğraf işleme **CPU-bound**'dur: beklenecek I/O yok, `.await` thread'i serbest bırakarak bir şey kazandırmaz;
  `rayon` gibi veri paralelliği araçları (Modül 18) doğrudur. Küçük CLI aracında ise hiç eşzamanlılık yok; senkron
  kod daha basittir (Modül 15'teki `ara` aracını hatırla). Binlerce bağlantı ve aynı anda birkaç servise istek ise
  async'in tam alanıdır: iş çoğunlukla beklemek.
feedback:
  - "Binlerce bağlantı = binlerce bekleme; async'in en güçlü olduğu yer."
  - "Doğru: CPU-bound iş için thread'ler/rayon."
  - "Üç isteği `join!` ile aynı anda beklemek async'in klasik kullanımı."
  - "Doğru: eşzamanlılık yoksa async sadece karmaşıklık ekler."
```

## Özet

:::remember
- **Bloklama yok:** iki `.await` arasında uzun iş yapma. Senkron I/O ve ağır hesap → `spawn_blocking(move || ...).await`; büyük paralel CPU işi → `rayon`. Async içinde yeni runtime + `block_on` panikler.
- **`Send` kuralı:** spawn edilen future'da `.await` boyunca yaşayan her değer `Send` olmalı. `MutexGuard`, `Rc`, `RefCell` borçlarını bir `{ }` bloğunda bitir; `drop(x)` yetmez, **kapsam** belirleyicidir.
- **Unutma:** `impl Future<Output = T>` içeren bir tip hatası = eksik `.await`. `main` bitince beklenmeyen görevler ölür; önemli görevlerin `JoinHandle`'ını bekle. `JoinHandle`'ı drop etmek iptal etmez, `abort()` eder.
- **İptal güvenliği:** `select!` kaybedeni drop eder; future içinde biriken durum kaybolur. Durumu future dışında tut ya da future'ı bir kez oluşturup `pin!` + `&mut fut` ile bekle.
- **Seçim:** çok sayıda bekleme (I/O-bound) → async; CPU-bound → thread/rayon; eşzamanlılık yoksa → senkron kod.
:::

```reflect
prompt: "Bir arkadaşın \"`select!` döngümde bazen mesajlar kayboluyor ama hiç hata yok\" diyor. Ona sorunun nedenini Ders 5'teki durum makinesi modeliyle açıkla ve iki çözüm öner."
answer: |
  Model cevap: `select!` her turda dalları yarıştırır ve kaybeden future'ları drop eder. Bir async fonksiyonun
  `.await` boyunca yaşayan yerel değişkenleri future'ın (durum makinesinin) içinde saklanır; future drop edilince
  onlar da yok olur. Fonksiyon kanaldan bir mesajı alıp yerel bir değişkende tutarken başka bir `.await`'te
  bekliyorsa ve o anda diğer dal kazanırsa mesaj sessizce kaybolur: future iptal güvenli değildir. Çözümler:
  (1) `select!`'e sadece iptal güvenli işlemleri (`rx.recv()` gibi) ver ve birikmiş durumu döngünün değişkeninde
  tut; (2) uzun işi yapan future'ı döngüden önce bir kez oluştur, `pin!` ile sabitle ve `&mut fut` ile beklet ki
  kaybettiği turda drop edilmesin, kaldığı yerden devam etsin.
```

```flashcards
- front: "Async kodda `std::thread::sleep` ya da ağır bir hesap neden tehlikelidir?"
  back: "Görevler sırayı sadece `.await`'te bırakır; bloklayan kod thread'i tutar ve o thread'deki bütün görevler donar."
- front: "Kaçınılmaz senkron/ağır bir işi async kodda nasıl çalıştırırsın?"
  back: "`tokio::task::spawn_blocking(move || is()).await`, ayrı bloklama havuzunda çalışır, sonuç `Result<T, JoinError>` gelir."
- front: "Spawn edilen bir future ne zaman `Send` olur?"
  back: "`.await` noktalarında yaşayan (future'ın içinde saklanan) bütün değerler `Send` ise."
- front: "`let g = m.lock().unwrap(); ...; drop(g); x.await;` neden yine \"future is not `Send`\" hatası verebilir?"
  back: "Derleyicinin analizi kapsama bakar; `g`'nin kapsamı `.await`'i kapsıyor. Çözüm: guard'ı `{ }` bloğunda bitirmek."
- front: "Hata mesajında `cannot add {integer} to impl Future<Output = u32>` görürsen ilk şüphen ne olmalı?"
  back: "Unutulmuş bir `.await`: değişken bir sayı değil, henüz çalışmamış bir future."
- front: "`#[tokio::main]`'in `main`'i bittiğinde beklenmemiş spawn edilmiş görevlere ne olur?"
  back: "Runtime kapanır; görevler bir sonraki `.await` noktalarında drop edilir, işleri yarım kalır."
- front: "İptal güvenli (cancellation safe) future ne demektir?"
  back: "Tamamlanmadan drop edilirse hiçbir veri/etki kaybettirmeyen future. Ör: `mpsc::Receiver::recv` güvenli, `read_exact` güvenli değil."
- front: "`select!` döngüsünde uzun süren bir future'ın her turda yeniden başlamasını nasıl önlersin?"
  back: "Döngüden önce bir kez oluştur, `std::pin::pin!` ile sabitle ve dalda `&mut fut` ile beklet."
```
