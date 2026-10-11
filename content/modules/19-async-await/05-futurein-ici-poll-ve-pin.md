---
id: m19-l05
title: "Future'ın içi, poll, Waker ve Pin"
minutes: 22
type: lesson
objectives:
  - "`Future` trait'ini, `Poll::Ready`/`Poll::Pending` ve `Waker` sözleşmesini elle yazılmış bir future ile uygulayabilmek"
  - Bir executor'ın future'ları nasıl yokladığını küçük bir döngüyle gösterebilmek
  - "`async fn`'in yerel değişkenleri saklayan bir durum makinesine dönüştüğünü ve bunun `Pin`'i neden gerektirdiğini açıklayabilmek"
  - "`Unpin`, `Box::pin` ve `pin!` ile E0277 (cannot be unpinned) ve E0733 (özyinelemeli async fn) hatalarını düzeltebilmek"
keywords: [Future, poll, Poll, Waker, Context, Pin, Unpin, Box::pin, pin!, executor, E0733]
---

Şimdiye kadar `.await` yazdın ve sihir kendiliğinden gerçekleşti. Bu derste perdeyi kaldırıyoruz: bir future'ı
**elle** yazacak, onu yoklayan küçücük bir **executor** kuracak ve Rust async'inin en çok korkulan kavramı olan
**`Pin`**'in aslında neden gerekli olduğunu göreceksin. Çoğu gün bunları doğrudan kullanmazsın; ama bir hata
mesajında `Pin`, `Unpin` ya da `poll` gördüğünde ne olduğunu bilmek seni çok rahatlatacak.

## Future trait'i

Standart kütüphanedeki tanım (`std::future::Future`) şaşırtıcı derecede kısadır:

```rust,ignore
pub trait Future {
    type Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

pub enum Poll<T> {
    Ready(T),
    Pending,
}
```

Modül 14'teki `Iterator` ile karşılaştır:

| | `Iterator` | `Future` |
|---|---|---|
| Ürettiği | `type Item` (çok sayıda değer) | `type Output` (tek bir değer) |
| İlerletme | `fn next(&mut self) -> Option<Item>` | `fn poll(self: Pin<&mut Self>, cx) -> Poll<Output>` |
| "Daha yok" | `None`: **bitti**, bir daha değer yok | `Pending`: **henüz değil**, sonra tekrar sor |
| Kim çağırır? | `for` döngüsü, tüketiciler | executor (`.await`'ler aracılığıyla) |

İki yeni parça var:

- **`Context` ve `Waker`**: `cx.waker()` bir **uyandırıcı** verir. Future `Pending` döndürüyorsa, beklediği olay
  gerçekleşince bu uyandırıcının `wake()` metodunun çağrılmasını **sağlamak zorundadır**. Executor, uyandırılmayan
  bir görevi bir daha yoklamaz.
- **`self: Pin<&mut Self>`**: "Yerinden oynatılmayacağı garanti edilmiş bir `&mut Self`." Bunun nedenini bu dersin
  ortasında göreceğiz; şimdilik kendi yazdığımız sıradan struct'lar için `&mut self` gibi davrandığını bil.

:::analogy Kafedeki çağrı cihazı
Kahve siparişi verdin; kasiyer sana titreşimli bir **çağrı cihazı** verdi. Her 10 saniyede bir tezgâha gidip
"Hazır mı?" diye sormazsın (bu, executor'ın boşa dönen döngüsü olurdu). Masana oturursun; kahve hazır olunca cihaz
titrer, sen de gidip alırsın. `poll` = "hazır mı?" sorusu, `Pending` = "henüz değil, cihazını al",
**`Waker`** = çağrı cihazı, `wake()` = cihazın titremesi. Barista cihazı titretmeyi unutursa kahveni sonsuza dek
beklersin: `Waker` sözleşmesini çiğneyen bir future'ın görevi de böyle **sonsuza dek asılı kalır**.
:::

```quiz
question: "Bir future'ın `poll` metodu `Poll::Pending` döndürüyor ama hiçbir yerde `cx.waker()` saklanmıyor ya da `wake` çağrılmıyor. Tokio'da bu future'ı `.await` eden görev ne olur?"
options:
  - Tokio onu birkaç milisaniyede bir otomatik olarak tekrar yoklar, sonunda biter
  - "Görev bir daha yoklanmaz ve sonsuza dek bekler; panik ya da hata olmaz"
  - "Derleyici `Waker` kullanılmadığı için derleme hatası verir"
  - "`Pending`, `None` gibi \"bitti\" demektir; görev boş bir değerle devam eder"
answer: 1
explanation: |
  Gerçek executor'lar boşa dönen döngüler değildir: `Pending` dönen görevi kenara koyar ve ancak **`wake`
  çağrılınca** tekrar kuyruğa alır. Kimse uyandırmazsa görev unutulur. Derleyici bunu yakalayamaz; bu, `Future`'ı
  elle uygulayanların sorumluluğundadır (`.await` kullanan sıradan kod için endişelenmene gerek yok).
feedback:
  - "Tokio bekleyen görevleri tekrar tekrar yoklamaz; uyandırılmayı bekler."
  - "Doğru! Bu yüzden `Pending` döndüren her future uyandırmayı ayarlamak zorundadır."
  - "Bu bir çalışma zamanı sözleşmesidir, tip sistemi onu denetlemez."
  - "`Pending` \"henüz değil\" demektir; future bitmemiştir."
```

## Elle yazılmış future'lar

En basit future, her yoklandığında bir adım ilerleyen ve kendini **hemen** yeniden uyandıran bir geri sayımdır:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

struct GeriSayim {
    kalan: u32,
}

impl Future for GeriSayim {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        if self.kalan == 0 {
            Poll::Ready("kalkış!")
        } else {
            println!("poll: kalan {}", self.kalan);
            self.kalan -= 1;
            cx.waker().wake_by_ref(); // "beni hemen tekrar yokla"
            Poll::Pending
        }
    }
}

#[tokio::main]
async fn main() {
    let mesaj = GeriSayim { kalan: 3 }.await; // .await, poll'u bizim yerimize çağırır
    println!("{mesaj}");
}
```

`GeriSayim` sıradan bir struct; `Future`'ı uyguladığı için `.await` edilebiliyor. `mut self: Pin<&mut Self>` sayesinde
`self.kalan`'a sanki `&mut self` varmış gibi erişiyoruz (bunun neden mümkün olduğunu aşağıdaki `Pin` bölümünde göreceksin).

Gerçek bir future ise kendini hemen uyandırmaz; olay gerçekleşince **başka biri** uyandırır. Aşağıdaki zamanlayıcı,
ayrı bir thread'de uyuyup süre dolunca `Waker`'ı çağırıyor. Durum, Modül 18'deki `Arc<Mutex<T>>` ile paylaşılıyor:

```rust
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Waker};
use std::thread;
use std::time::Duration;

struct Ortak {
    bitti: bool,
    waker: Option<Waker>,
}

struct Zamanlayici {
    ortak: Arc<Mutex<Ortak>>,
    yoklama: u32,
}

impl Zamanlayici {
    fn new(sure: Duration) -> Zamanlayici {
        let ortak = Arc::new(Mutex::new(Ortak { bitti: false, waker: None }));
        let thread_payi = Arc::clone(&ortak);
        thread::spawn(move || {
            thread::sleep(sure);
            let mut durum = thread_payi.lock().unwrap();
            durum.bitti = true;
            if let Some(waker) = durum.waker.take() {
                waker.wake(); // çağrı cihazını titret
            }
        });
        Zamanlayici { ortak, yoklama: 0 }
    }
}

impl Future for Zamanlayici {
    type Output = u32;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<u32> {
        self.yoklama += 1;
        let mut durum = self.ortak.lock().unwrap();
        if durum.bitti {
            Poll::Ready(self.yoklama)
        } else {
            // En güncel waker'ı sakla: görev başka bir thread'e taşınmış olabilir
            durum.waker = Some(cx.waker().clone());
            Poll::Pending
        }
    }
}

#[tokio::main]
async fn main() {
    println!("zamanlayıcı kuruldu");
    let kac_kez = Zamanlayici::new(Duration::from_millis(50)).await;
    println!("50 ms doldu; future {kac_kez} kez yoklandı");
}
```

Future yalnızca **iki kez** yoklandı: bir kez başta (`Pending`), bir kez de uyandırıldıktan sonra (`Ready`). Arada
50 ms boyunca görev hiç işlemci harcamadı. `tokio::time::sleep` de aynı fikirle çalışır; sadece her zamanlayıcı için
thread açmak yerine tek bir zamanlayıcı çarkı (timer wheel) kullanır. Ağ soketlerinde ise uyandırmayı işletim
sisteminin olay bildirim mekanizması (Linux'ta epoll, Windows'ta IOCP) tetikler.

## Executor: future'ları yoklayan döngü

`.await` nasıl çalışıyor? Bir executor'ın en basit hâli, future'ı `Ready` dönene kadar yoklayan bir döngüdür.
Kendimiz yazalım. `Waker::noop()`, hiçbir şey yapmayan bir uyandırıcıdır (Rust 1.85'ten beri standart
kütüphanede); `pin!` makrosunu biraz sonra açıklayacağız. Tahmin et:

```predict
code: |
  use std::future::Future;
  use std::pin::{Pin, pin};
  use std::task::{Context, Poll, Waker};

  struct GeriSayim {
      kalan: u32,
  }

  impl Future for GeriSayim {
      type Output = &'static str;

      fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
          if self.kalan == 0 {
              Poll::Ready("kalkış!")
          } else {
              println!("poll: kalan {}", self.kalan);
              self.kalan -= 1;
              cx.waker().wake_by_ref();
              Poll::Pending
          }
      }
  }

  // Dünyanın en basit (ve en savurgan) executor'ı
  fn calistir<F: Future>(gelecek: F) -> F::Output {
      let mut gelecek = pin!(gelecek);
      let mut cx = Context::from_waker(Waker::noop());
      let mut tur = 0;
      loop {
          tur += 1;
          if let Poll::Ready(deger) = gelecek.as_mut().poll(&mut cx) {
              println!("{tur}. turda hazır");
              return deger;
          }
      }
  }

  fn main() {
      let mesaj = calistir(GeriSayim { kalan: 2 });
      println!("{mesaj}");
      let uzunluk = calistir(async {
          let m = GeriSayim { kalan: 1 }.await;
          m.len()
      });
      println!("{uzunluk}");
  }
options:
  - |
    poll: kalan 2
    poll: kalan 1
    3. turda hazır
    kalkış!
    poll: kalan 1
    2. turda hazır
    9
  - |
    poll: kalan 2
    poll: kalan 1
    2. turda hazır
    kalkış!
    poll: kalan 1
    1. turda hazır
    7
  - |
    3. turda hazır
    kalkış!
    2. turda hazır
    9
answer: 0
explanation: |
  `GeriSayim { kalan: 2 }` iki kez `Pending` (ve ekrana yazı), üçüncü yoklamada `Ready` döner: 3 tur. İkinci
  çağrıda `async` bloğu dışarıdaki future'dır; onu her yoklamak, içindeki `.await` aracılığıyla `GeriSayim`'i
  yoklar. İç future `Pending` dönünce async blok da `Pending` döner: 2 tur. Ayrıca `"kalkış!".len()` 9'dur:
  `ı` ve `ş` UTF-8'de 2'şer bayt (Modül 9). Not: tokio olmadan, düz `fn main` içinde bir future çalıştırdık!
```

Bu oyuncak executor **çalışıyor**, ama `Pending` dönen future'ı durmadan yoklayarak işlemciyi %100 yakıyor.
Gerçek executor'lar (`tokio`, `futures::executor::block_on`) farklıdır: `Pending` dönen görevi kenara koyar, thread'i
uyutur ve ancak `wake()` çağrıldığında görevi yeniden **hazır kuyruğuna** alır. Ders 1'deki zamanlayıcı
alıştırmanın eksik parçası buydu: "boşa dürtme, uyandırılınca dürt."

Şimdi sıra sende: Waker sözleşmesine uyan bir future yaz.

```exercise
id: m19-e-pide-future
title: "Fırındaki pide: elle Future"
difficulty: 3
prompt: |
  Fırındaki bir pideyi temsil eden `Pide` future'ını uygula. Her **yoklama** (poll) bir dakika pişirme demek:

  - Her `poll` çağrısında önce `yoklama` sayacını 1 artır.
  - `kalan_dakika` 0 ise `Poll::Ready(format!("pide hazır ({} yoklama)", yoklama))` döndür.
  - Değilse `kalan_dakika`'yı 1 azalt, **kendini yeniden uyandır** (`cx.waker().wake_by_ref()`) ve
    `Poll::Pending` döndür.

  Örnek: `Pide::new(3).await` → `"pide hazır (4 yoklama)"`. `Pide::new(0).await` → `"pide hazır (1 yoklama)"`.
  Uyandırmayı unutursan tokio görevi bir daha yoklamaz ve test zaman aşımına uğrar.
starter: |
  use std::future::Future;
  use std::pin::Pin;
  use std::task::{Context, Poll};

  struct Pide {
      kalan_dakika: u32,
      yoklama: u32,
  }

  impl Pide {
      fn new(dakika: u32) -> Pide {
          Pide { kalan_dakika: dakika, yoklama: 0 }
      }
  }

  impl Future for Pide {
      type Output = String;

      fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<String> {
          todo!()
      }
  }

  #[tokio::main]
  async fn main() {
      let mesaj = Pide::new(3).await;
      println!("{mesaj}");
  }
solution: |
  use std::future::Future;
  use std::pin::Pin;
  use std::task::{Context, Poll};

  struct Pide {
      kalan_dakika: u32,
      yoklama: u32,
  }

  impl Pide {
      fn new(dakika: u32) -> Pide {
          Pide { kalan_dakika: dakika, yoklama: 0 }
      }
  }

  impl Future for Pide {
      type Output = String;

      fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<String> {
          self.yoklama += 1;
          if self.kalan_dakika == 0 {
              Poll::Ready(format!("pide hazır ({} yoklama)", self.yoklama))
          } else {
              self.kalan_dakika -= 1;
              cx.waker().wake_by_ref();
              Poll::Pending
          }
      }
  }

  #[tokio::main]
  async fn main() {
      let mesaj = Pide::new(3).await;
      println!("{mesaj}");
  }
check: tests
tests: |
  use std::sync::Arc;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::task::{Wake, Waker};
  use std::time::Duration;

  struct SayanWaker(AtomicUsize);

  impl Wake for SayanWaker {
      fn wake(self: Arc<Self>) {
          self.0.fetch_add(1, Ordering::SeqCst);
      }
      fn wake_by_ref(self: &Arc<Self>) {
          self.0.fetch_add(1, Ordering::SeqCst);
      }
  }

  #[tokio::test]
  async fn uc_dakikalik_pide() {
      let sonuc = tokio::time::timeout(Duration::from_secs(1), Pide::new(3)).await.expect(
          "future hiç bitmedi: Pending döndürmeden önce cx.waker().wake_by_ref() çağırdın mı?",
      );
      assert_eq!(sonuc, "pide hazır (4 yoklama)", "3 dakikalık pide 4. yoklamada hazır olmalı");
  }

  #[tokio::test]
  async fn hemen_hazir_pide() {
      let sonuc = tokio::time::timeout(Duration::from_secs(1), Pide::new(0)).await.expect("future bitmedi");
      assert_eq!(sonuc, "pide hazır (1 yoklama)", "0 dakikalık pide ilk yoklamada hazır olmalı");
  }

  #[test]
  fn elle_yoklama_ve_uyandirma() {
      let sayac = Arc::new(SayanWaker(AtomicUsize::new(0)));
      let waker = Waker::from(Arc::clone(&sayac));
      let mut cx = Context::from_waker(&waker);
      let mut pide = std::pin::pin!(Pide::new(2));

      assert!(pide.as_mut().poll(&mut cx).is_pending(), "1. yoklamada pide hazır olmamalı");
      assert!(pide.as_mut().poll(&mut cx).is_pending(), "2. yoklamada pide hazır olmamalı");
      assert_eq!(sayac.0.load(Ordering::SeqCst), 2, "her Pending'den önce waker bir kez uyandırılmalı");
      assert_eq!(pide.as_mut().poll(&mut cx), Poll::Ready(String::from("pide hazır (3 yoklama)")));
      assert_eq!(sayac.0.load(Ordering::SeqCst), 2, "Ready dönerken uyandırma gerekmez");
  }
hints:
  - "`self` bir `Pin<&mut Pide>`; `Pide` sıradan (Unpin) bir struct olduğu için `self.yoklama += 1;` gibi alanlara doğrudan erişebilirsin."
  - "İlk iş `self.yoklama += 1;`. Sonra `if self.kalan_dakika == 0 { ... } else { ... }`."
  - "`else` kolu üç satır: `self.kalan_dakika -= 1;`, `cx.waker().wake_by_ref();`, `Poll::Pending`. `if` kolu: `Poll::Ready(format!(\"pide hazır ({} yoklama)\", self.yoklama))`."
explanation: |
  `poll`, durum makinesini bir adım ilerletir: sayaç güncellenir, iş bittiyse `Ready(değer)`, bitmediyse `Pending`.
  Kritik satır `cx.waker().wake_by_ref()`: `Pending` döndüren her future, birinin onu uyandıracağını **garanti
  etmek** zorundadır. Burada "olay" hemen gerçekleştiği için kendimizi uyandırıyoruz. Bu, uzun bir hesabı parçalara
  bölüp her parçadan sonra sırayı başkalarına veren `tokio::task::yield_now()`'ın da çalışma şeklidir.

  Testler sözleşmeyi iki açıdan sınıyor: tokio içinde `timeout` ile (uyandırma yoksa görev asılı kalır ve süre
  dolar) ve `std::task::Wake` trait'iyle yazılmış, çağrıları sayan bir waker'la (her `Pending` tam bir uyandırma).

  `wake_by_ref` waker'ı ödünç alarak uyandırır; `cx.waker().clone().wake()` da olurdu ama gereksiz bir kopya
  oluşturur. Gerçek bir I/O future'ı ise waker'ı **saklar** (`cx.waker().clone()`), olay gelince `wake()` çağırır;
  `Zamanlayici` örneğinde olduğu gibi.
```

## async fn bir durum makinesine dönüşür

Derleyici şu fonksiyonu gördüğünde ne üretiyor?

```rust,ignore
async fn selamla(isim: String) -> usize {
    let mesaj = format!("Merhaba {isim}");
    bekle(10).await;            // 1. bekleme noktası
    println!("{mesaj}");
    bekle(20).await;            // 2. bekleme noktası
    mesaj.len()
}
```

Kabaca şöyle bir `enum` ve onun için bir `poll` (gerçek kod biraz farklı ama fikir bu):

```rust,ignore
enum SelamlaFuture {
    Basladi { isim: String },
    // .await boyunca kapsamı süren değişkenler burada saklanır
    Bekleme1 { isim: String, mesaj: String, alt: BekleFuture },
    Bekleme2 { isim: String, mesaj: String, alt: BekleFuture },
    Bitti,
}
```

`isim` ilk satırdan sonra kullanılmıyor ama yine de saklanıyor: `String` bir `Drop` tipidir ve drop anı
**kapsamın sonudur** (Modül 4), yani `isim` fonksiyonun sonuna kadar yaşar.

Önemli sonuç: **bir `.await` boyunca yaşayan her yerel değişken, future'ın içinde saklanır.** Future'ın boyutu
derleme zamanında bellidir ve en büyük durumun boyutu kadardır. Bunu ölçebilirsin:

```rust
use std::time::Duration;

async fn kucuk() {
    tokio::time::sleep(Duration::from_millis(1)).await;
}

async fn buyuk() {
    let tampon = [7u8; 1024]; // .await boyunca yaşıyor → future'ın içinde
    tokio::time::sleep(Duration::from_millis(1)).await;
    println!("{}", tampon[0]);
}

async fn blokta() {
    {
        let tampon = [7u8; 1024]; // blok .await'ten önce bitiyor → saklanmaz
        println!("{}", tampon[0]);
    }
    tokio::time::sleep(Duration::from_millis(1)).await;
}

#[tokio::main]
async fn main() {
    println!("kucuk : {} bayt", std::mem::size_of_val(&kucuk()));
    println!("buyuk : {} bayt", std::mem::size_of_val(&buyuk()));
    println!("blokta: {} bayt", std::mem::size_of_val(&blokta()));
}
```

`buyuk`'un future'ı 1 KB'den büyük; `blokta` ise `kucuk` kadar. Ders 4'teki `MutexGuard` kuralıyla aynı ilke:
**neyin `.await` boyunca yaşadığına kapsam karar verir.** Büyük bir future'ı (örneğin dev bir tamponu) `tokio::spawn`
ile göreve verince heap'e konur; çok büyük future'ları kendin de `Box::pin` ile heap'e koyabilirsin.

```memory
title: selamla("Ayşe") future'ı, durum makinesi
steps:
  - caption: "`let f = selamla(isim);`, future oluştu ama gövde çalışmadı. İçinde yalnızca argüman var."
    stack:
      - frame: main
        vars:
          - { name: f, type: SelamlaFuture, value: "Basladi { isim }", to: h1 }
    heap:
      - { id: h1, label: "isim: String", value: "A y ş e" }
  - caption: "İlk yoklama: gövde ilk `.await`'e kadar çalıştı. `mesaj` ve hâlâ kapsamda olan `isim` future'ın **içinde** saklanıyor."
    stack:
      - frame: main
        vars:
          - { name: f, type: SelamlaFuture, value: "Bekleme1 { isim, mesaj, alt }", to: h2 }
    heap:
      - { id: h1, label: "isim: String", value: "A y ş e" }
      - { id: h2, label: "mesaj: String", value: "M e r h a b a   A y ş e" }
  - caption: "Son yoklama: `Ready(13)` döndü, future `Bitti` durumunda; kapsam bitti, `isim` ve `mesaj` serbest bırakıldı."
    stack:
      - frame: main
        vars:
          - { name: f, type: SelamlaFuture, value: "Bitti" }
    heap:
      - { id: h1, label: "isim: String", value: "A y ş e", freed: true }
      - { id: h2, label: "mesaj: String", value: "M e r h a b a   A y ş e", freed: true }
```

## Pin: neden future'lar yerinden oynamamalı?

Şimdi asıl soruya gelelim. Şu async bloğa bak:

```rust
#[tokio::main]
async fn main() {
    let gelecek = async {
        let sehir = String::from("Isparta");
        let ref_sehir = &sehir; // future'ın içindeki bir değere referans
        tokio::task::yield_now().await; // .await boyunca ikisi de yaşıyor
        println!("{ref_sehir}");
    };
    gelecek.await;
}
```

`sehir` ve `ref_sehir` ikisi de `.await` boyunca yaşıyor, yani ikisi de **future'ın içinde** saklanıyor. Ama
`ref_sehir`, aynı future'ın içindeki `sehir` alanına işaret ediyor: future **kendine referans veren
(self-referential)** bir yapı. Güvenli Rust'ta böyle bir struct'ı elle yazamazsın (bir alanın ödüncünü aynı struct'ın
başka bir alanına bağlayan bir yaşam süresi yoktur); derleyici ise async bloklar için tam olarak bunu üretir. Sorun ne?
**Taşıma (move)**. Future bellekte başka bir yere taşınırsa `ref_sehir` eski adresi göstermeye devam eder:

```memory
title: Kendine referans veren bir future taşınırsa
steps:
  - caption: "Future yoklandı: `ref_sehir`, future'ın içindeki `sehir` alanını gösteriyor."
    stack:
      - frame: "future (adres A)"
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: ref_sehir, type: "&String", value: "→ A.sehir", to: sehir }
    heap:
      - { id: h1, value: "I s p a r t a" }
  - caption: "Future B adresine taşındı (bitler kopyalandı). `ref_sehir` hâlâ **A**'yı gösteriyor: sarkan referans!"
    stack:
      - frame: "future (adres A, artık geçersiz)"
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", moved: true, note: taşındı }
      - frame: "future (adres B)"
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: ref_sehir, type: "&String", value: "→ A.sehir ✗", note: "sarkan!" }
    heap:
      - { id: h1, value: "I s p a r t a" }
  - caption: "Çözüm `Pin`: future yoklanmaya başladıktan sonra **yerinden oynatılamaz**. `Box::pin` onu heap'e sabitler; kutuyu taşımak future'ı taşımaz."
    stack:
      - frame: main
        vars:
          - { name: kutu, type: "Pin<Box<..>>", value: "ptr", to: h2 }
    heap:
      - { id: h2, label: "future (sabit adres)", value: "sehir | ref_sehir → kendi içi ✓" }
      - { id: h1, value: "I s p a r t a" }
```

**`Pin<P>`** bir işaretçiyi (`&mut T`, `Box<T>`) saran ve şu sözü veren bir tiptir: "İşaret edilen `T`, drop
edilene kadar **bellekte yer değiştirmeyecek**." `poll`'un `self: Pin<&mut Self>` alması bu yüzdendir: executor,
future'ı ilk yoklamadan sonra bir daha taşımayacağına söz verir. Böylece derleyici kendine referans veren durum
makineleri üretebilir ve sen `.await` boyunca yerel değişkenleri ödünç almaya devam edebilirsin.

**`Unpin`** ise "bu tipi taşımak her zaman güvenli, `Pin` umurumda değil" diyen otomatik bir marker trait'tir
(`Send`/`Sync` gibi, Modül 18). Neredeyse her şey `Unpin`'dir: `i32`, `String`, `Vec<T>`, `Box<T>`, senin
struct'ların (alanları `Unpin` ise). `GeriSayim` ve `Pide`'de `self.kalan`'a rahatça erişebilmenin nedeni de bu:
`Unpin` tipler için `Pin<&mut T>`, `&mut T` gibi davranır. **`Unpin` olmayan** başlıca tipler derleyicinin ürettiği
`async fn`/`async {}` future'larıdır, çünkü kendilerine referans verebilirler.

Bir future'ı **sabitlemenin (pin)** iki yolu var:

| | `Box::pin(f)` | `std::pin::pin!(f)` |
|---|---|---|
| Nereye | Heap | Stack (mevcut fonksiyon) |
| Tip | `Pin<Box<F>>` | `Pin<&mut F>` |
| Taşınabilir mi? | Evet; kutu taşınır, future yerinde kalır. Döndürülebilir, saklanabilir | Hayır; yalnızca o kapsamda kullanılır |
| Maliyet | Bir heap tahsisi | Ücretsiz |

Bu kod derlenir mi?

```compiles
code: |
  use std::future::Future;

  async fn bekle_ve_al<F: Future<Output = u32> + Unpin>(mut f: F) -> u32 {
      (&mut f).await
  }

  #[tokio::main]
  async fn main() {
      let gelecek = async { 5 };
      println!("{}", bekle_ve_al(gelecek).await);
  }
answer: false
error: E0277
explanation: |
  `bekle_ve_al`, future'ı `&mut f` ile ödünç alarak beklemek istiyor; bu yalnızca `Unpin` future'larda güvenlidir
  (sonradan `f` taşınabilir). `async { 5 }` bloğu `Unpin` değildir: "`{async block}` cannot be unpinned" (E0277).
  Derleyici çözümü de söylüyor: "consider using the `pin!` macro ... or `Box::pin`". `bekle_ve_al(Box::pin(gelecek))`
  ya da `bekle_ve_al(std::pin::pin!(gelecek))` derlenir, çünkü `Pin<Box<F>>` ve `Pin<&mut F>` `Unpin`'dir.
```

:::error
```text
error[E0277]: `{async block@src/main.rs:9:19: 9:24}` cannot be unpinned
  --> src/main.rs:10:32
   |
10 |     println!("{}", bekle_ve_al(gelecek).await);
   |                    ----------- ^^^^^^^ the trait `Unpin` is not implemented for `{async block@src/main.rs:9:19: 9:24}`
   |                    |
   |                    required by a bound introduced by this call
   |
   = note: consider using the `pin!` macro
           consider using `Box::pin` if you need to access the pinned value outside of the current scope
```
Bu hatayı en sık, aynı future'ı bir döngüde `select!` ile tekrar tekrar beklemek istediğinde (`&mut gelecek`)
görürsün. Çözüm: döngüden önce `let mut gelecek = std::pin::pin!(gelecek);` (ya da `tokio::pin!(gelecek);`).
:::

:::tip Pin ile ne zaman uğraşırsın?
Günlük kodda neredeyse hiç: `.await` sabitlemeyi senin yerine yapar. Karşılaşacağın durumlar şunlardır:
(1) aynı future'ı `&mut` ile birden çok kez beklemek (`select!` döngüleri), (2) future'ları bir koleksiyonda saklamak
(`Vec<Pin<Box<dyn Future<Output = T>>>>`; `dyn` trait nesnelerini Modül 20'de göreceğiz), (3) özyinelemeli async
fonksiyonlar, (4) `Future`'ı elle uygulamak. `unsafe` (Modül 24) gerektiren "pin projeksiyonu" konusu bu kursun
kapsamı dışında; `pin-project` gibi crate'ler onu güvenli hâle getirir.
:::

## Özyinelemeli async fn ve Box::pin

Bir `async fn` kendini çağırırsa ne olur? Future'ın içinde kendi türünden bir future saklanması gerekir; o da içinde
bir tane daha... Sonsuz boyutlu bir tip: Modül 17'deki özyinelemeli `enum`'un (E0072) aynısı.

:::error
```text
error[E0733]: recursion in an async fn requires boxing
 --> src/main.rs:1:1
  |
1 | async fn faktoriyel(n: u64) -> u64 {
  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
2 |     if n == 0 { 1 } else { n * faktoriyel(n - 1).await }
  |                                ----------------------- recursive call here
  |
  = note: a recursive `async fn` call must introduce indirection such as `Box::pin` to avoid an infinitely sized future
```
Çözüm de Modül 17'dekiyle aynı: bir **dolaylılık (indirection)** katmanı. Özyinelemeli çağrının future'ını
`Box::pin` ile heap'e koyarsan, dıştaki future içinde yalnızca sabit boyutlu bir işaretçi tutar.
:::

```fill
prompt: "Özyinelemeli async fonksiyonu derlenir hâle getir: alt çağrının future'ını heap'e sabitle."
code: |
  async fn klasor_derinligi(seviyeler: &[&str]) -> usize {
      if seviyeler.is_empty() {
          0
      } else {
          1 + ___0::___1(klasor_derinligi(&seviyeler[1..])).___2
      }
  }

  #[tokio::main]
  async fn main() {
      let yol = ["home", "ayse", "projeler", "rusteach"];
      println!("derinlik: {}", klasor_derinligi(&yol).await);
  }
blanks:
  - ["Box"]
  - ["pin"]
  - ["await"]
output: "derinlik: 4"
explanation: |
  `Box::pin(klasor_derinligi(&seviyeler[1..]))` alt future'ı heap'e koyar ve `Pin<Box<..>>` döndürür; o da bir
  future'dır ve `.await` edilebilir. Böylece her seviyenin future'ı sabit boyutlu kalır. `&seviyeler[1..]`, Modül
  5'teki dilimlerle "ilk eleman hariç geri kalanı" alır.
```

## Özet

:::remember
- `trait Future { type Output; fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>; }`
- `Poll::Ready(v)` = bitti; `Poll::Pending` = henüz değil. `Pending` dönen future, `cx.waker()` ile **uyandırılmayı ayarlamak zorundadır**.
- Executor = hazır görevleri yoklayan, uyandırılanları yeniden kuyruğa alan döngü.
- `async fn` → durum makinesi; `.await` boyunca yaşayan yereller future'ın **içinde** saklanır (kapsam boyutu belirler).
- Bu durum makineleri kendine referans verebilir → taşınmamalı → **`Pin`**. `Unpin` tipler (çoğu tip) için `Pin` fark etmez.
- Sabitlemek için `Box::pin` (heap, taşınabilir) ya da `pin!` (stack, yerel). "cannot be unpinned" (E0277) ve E0733'ün ilacı bunlar.
:::

```reflect
prompt: "Rust neden `poll`'un `&mut self` yerine `Pin<&mut Self>` almasını şart koşuyor? Cevabında \"kendine referans veren durum makinesi\" ifadesini kullan."
answer: |
  Model cevap: `async fn`'ler, `.await` boyunca yaşayan yerel değişkenleri ve onlara verilen referansları aynı
  durum makinesinin içinde saklar; yani future kendine referans veren bir yapı olabilir. Böyle bir değer bellekte
  taşınırsa içindeki referanslar eski adresi gösterir ve sarkar. `Pin<&mut Self>`, executor'ın future'ı ilk
  yoklamadan sonra bir daha taşımayacağının tip düzeyinde garantisidir. Böylece derleyici bu durum makinelerini
  güvenle üretebilir; taşınması her zaman güvenli olan (`Unpin`) tipler için bu kısıt hiçbir şeyi değiştirmez.
```

```flashcards
- front: "`Future::poll` hangi iki değerden birini döndürür ve anlamları nedir?"
  back: "`Poll::Ready(değer)`: bitti. `Poll::Pending`: henüz değil, uyandırılınca tekrar yokla."
- front: "`Pending` döndüren bir future'ın Waker'a karşı sorumluluğu nedir?"
  back: "Beklediği olay gerçekleşince `cx.waker()`'ın `wake()`'inin çağrılmasını sağlamak. Aksi hâlde görev sonsuza dek bekler."
- front: Bir async fn'in future'ının boyutunu ne belirler?
  back: "En büyük durumu: `.await` noktaları boyunca **yaşayan** yerel değişkenler future'ın içinde saklanır."
- front: Async future'lar neden yerinden oynatılmamalı (Pin)?
  back: "Kendine referans verebilirler (bir alan, aynı future'daki başka bir alanı gösterir); taşınırlarsa referans sarkar."
- front: "`Unpin` ne demektir? Hangi tipler `Unpin` değildir?"
  back: "\"Sabitlenmiş olsa bile taşınması güvenli\" anlamına gelen otomatik marker trait. Derleyicinin ürettiği `async fn`/`async {}` future'ları `Unpin` değildir."
- front: "`Box::pin(f)` ile `pin!(f)` arasındaki fark nedir?"
  back: "`Box::pin` future'ı heap'e sabitler (`Pin<Box<F>>`, taşınabilir/döndürülebilir); `pin!` stack'te sabitler (`Pin<&mut F>`, yalnızca o kapsamda)."
- front: "`E0733` hatası ne anlama gelir, çözümü nedir?"
  back: "Özyinelemeli async fn sonsuz boyutlu bir future gerektirir. Çözüm: özyinelemeli çağrıyı `Box::pin(f(..)).await` ile sarmak."
```
