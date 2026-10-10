---
id: m19-l04
title: Async kanallar ve paylaşılan durum
minutes: 20
type: lesson
objectives:
  - "`tokio::sync::mpsc` ile üretici/tüketici yapısı kurup kanalın ne zaman kapandığını açıklayabilmek"
  - "`oneshot` kanallarla istek/cevap (aktör) deseni uygulayabilmek"
  - "`std::sync::Mutex` ile `tokio::sync::Mutex` arasında `.await` kuralına göre doğru seçimi yapabilmek"
  - "`Semaphore` ile aynı anda çalışan iş sayısını sınırlayabilmek"
keywords: [tokio::sync::mpsc, oneshot, broadcast, Mutex, Semaphore, aktör, backpressure, geri basınç]
---

Görevleri başlatmayı öğrendin; şimdi onları **konuşturma** zamanı. Modül 18'de thread'ler arasında iki yol vardı:
mesajlaşmak (kanallar) ya da durumu paylaşmak (`Arc<Mutex<T>>`). Async dünyada da aynı iki yol var, ama küçük ve
önemli bir farkla: **bekleyen bir görev thread'i bloklamamalı.** `std::sync::mpsc::Receiver::recv()` thread'i
uyutur; async'te bunun yerine `.await` edilebilen araçlar kullanırız. Hepsi `tokio::sync` modülünde.

## tokio::sync::mpsc — üretici ve tüketici

```rust
use std::time::Duration;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    // Kapasitesi 8 olan, sınırlı (bounded) bir kanal
    let (tx, mut rx) = mpsc::channel::<(String, i32)>(8);

    for (sensor, ms) in [("salon", 30), ("mutfak", 10), ("balkon", 20)] {
        let tx = tx.clone(); // her üreticinin kendi göndericisi
        tokio::spawn(async move {
            for olcum in 0..2 {
                tokio::time::sleep(Duration::from_millis(ms)).await;
                // send bir future'dır: kanal doluysa yer açılana kadar bekler
                tx.send((sensor.to_string(), 20 + olcum)).await.unwrap();
            }
        }); // görev bitince bu tx kopyası drop edilir
    }
    drop(tx); // main'in elindeki orijinal göndericiyi bırak!

    let mut olcumler = Vec::new();
    // recv: mesaj gelince Some, bütün göndericiler drop edilince None
    while let Some(olcum) = rx.recv().await {
        olcumler.push(olcum);
    }
    olcumler.sort();
    for (sensor, derece) in &olcumler {
        println!("{sensor}: {derece}°C");
    }
}
```

Modül 18'deki `std::sync::mpsc` ile neredeyse aynı, farklar şunlar:

| | `std::sync::mpsc` | `tokio::sync::mpsc` |
|---|---|---|
| Alıcıyı beklemek | `rx.recv()` **thread'i bloklar** | `rx.recv().await` **görevi askıya alır** |
| Kapasite | `channel()` sınırsız, `sync_channel(n)` sınırlı | `channel(n)` sınırlı, `unbounded_channel()` sınırsız |
| Göndermek | `tx.send(v)` (senkron) | `tx.send(v).await` (sınırlı kanalda dolunca bekler) |
| Kanal kapanınca | `recv()` → `Err` | `recv().await` → `None` |

**Kanal ne zaman kapanır?** Bütün `Sender` kopyaları drop edildiğinde. Alıcı önce tampondaki mesajları alır, sonra
`None` görür ve `while let` döngüsü biter. Bu yüzden yukarıdaki `drop(tx)` satırı hayati önemdedir:

```quiz
question: "Yukarıdaki programda `drop(tx);` satırını silersen ne olur?"
options:
  - Hiçbir şey değişmez; tokio göndericileri otomatik kapatır
  - "Program 6 ölçümü alır, sonra `rx.recv().await` sonsuza dek bekler ve program hiç bitmez"
  - Derleme hatası alırsın çünkü `tx` kullanılmamış olur
  - "İlk ölçümden sonra `recv` hemen `None` döner"
answer: 1
explanation: |
  `main`'in elindeki orijinal `tx` hâlâ yaşıyorsa kanal "açık" sayılır: alıcı, birinin daha mesaj
  gönderebileceğini varsayar. Üretici görevler bitip kendi kopyalarını drop etse bile, `main`'deki kopya
  `while let` döngüsünün içinde beklerken drop edilmez. Sonuç: tüketici sonsuza dek bekler. Async'te bu tür
  "asılı kalma" bir panik ya da hata vermez, program sessizce takılır. Thread'lerdeki kanallarda da aynı tuzak vardı.
feedback:
  - "Göndericiyi ne zaman bırakacağını derleyici ya da tokio bilemez; drop sorumluluğu sende."
  - "Doğru! Alıcı, son gönderici drop edilene kadar yeni mesaj bekler."
  - "`tx` daha önce `tx.clone()` için kullanıldı; derleme hatası yok."
  - "`None` yalnızca bütün göndericiler gidince gelir."
```

## Kapasite ve geri basınç (backpressure)

Neden kapasite seçmek zorundasın? Üretici, tüketiciden hızlıysa sınırsız bir kanalın tamponu durmadan büyür;
sonunda bellek biter. **Sınırlı kanal**, kanal dolunca `send().await`'i bekleterek hızlı üreticiyi **otomatik
olarak yavaşlatır**. Buna **geri basınç (backpressure)** denir.

:::analogy Kasadaki bant
Marketin kasa bandına en fazla 8 ürün sığıyor. Müşteri ürünleri banta diziyor (üretici), kasiyer okutuyor
(tüketici). Bant dolunca müşteri **bekler**; ürünleri yere yığmaz. Sınırsız bir bant olsaydı, yavaş bir kasiyerin
önünde market kadar uzun bir ürün yığını birikirdi. Sınırlı kanal, sistemin en yavaş halkasının hızına kendiliğinden
uyum sağlamasıdır.
:::

Beklemek istemiyorsan `try_send` hemen döner: yer varsa `Ok(())`, kanal doluysa `Err(TrySendError::Full(..))`.
Tahmin et:

```predict
code: |
  use tokio::sync::mpsc;

  #[tokio::main]
  async fn main() {
      let (tx, mut rx) = mpsc::channel::<&str>(2);
      for siparis in ["çay", "simit", "ayran"] {
          let kabul = tx.try_send(siparis).is_ok();
          println!("{siparis}: {kabul}");
      }
      println!("alındı: {:?}", rx.recv().await);
      println!("ayran tekrar: {}", tx.try_send("ayran").is_ok());
      drop(tx);
      while let Some(s) = rx.recv().await {
          println!("kalan: {s}");
      }
  }
options:
  - |
    çay: true
    simit: true
    ayran: false
    alındı: Some("çay")
    ayran tekrar: true
    kalan: simit
    kalan: ayran
  - |
    çay: true
    simit: true
    ayran: true
    alındı: Some("çay")
    ayran tekrar: true
    kalan: simit
    kalan: ayran
    kalan: ayran
  - |
    çay: true
    simit: true
    ayran: false
    alındı: Some("ayran")
    ayran tekrar: true
    kalan: simit
    kalan: çay
answer: 0
explanation: |
  Kapasite 2: "çay" ve "simit" tampona girer, "ayran" için yer yoktur ve `try_send` beklemek yerine hemen `Err`
  döner. `recv` sırayla (FIFO) ilk mesajı, "çay"ı verir ve bir yer açılır; ikinci "ayran" denemesi başarılı olur.
  `drop(tx)` sonrasında alıcı tampondaki "simit" ve "ayran"ı alır, ardından `None` görüp döngüden çıkar.
```

`mpsc::unbounded_channel()` da vardır: `send` async değildir ve hiç beklemez. Üreticinin hızının doğal olarak
sınırlı olduğundan eminsen (örneğin kullanıcı tıklamaları) kullanılabilir; emin değilsen **sınırlı kanal** seç.

## oneshot — tek seferlik cevap ve aktör deseni

`mpsc` tek yönlüdür: gönderen, cevap alamaz. Peki bir göreve "bakiye ne kadar?" diye sorup **cevabını** almak
istersen? Cevap için tek kullanımlık bir kanal yaratıp isteğin içine koyarsın: **`tokio::sync::oneshot`**.

- `let (cevap_tx, cevap_rx) = oneshot::channel();`
- `cevap_tx.send(değer)` senkrondur (beklemez) ve göndericiyi **tüketir**: tek seferlik.
- `cevap_rx` kendisi bir future'dır: `cevap_rx.await` → `Result<T, RecvError>` (gönderici cevap vermeden drop
  edildiyse `Err`).

Bu ikisini birleştirince Rust'ta (ve Erlang/Elixir'de) çok sevilen **aktör (actor)** deseni çıkar: durumun **tek
sahibi** bir görevdir; diğerleri durumu doğrudan değil, **mesajla** değiştirir. Kilit yok, veri yarışı ihtimali yok.

```rust
use tokio::sync::{mpsc, oneshot};

enum Komut {
    Yatir { tutar: u64, cevap: oneshot::Sender<u64> },
    Bakiye { cevap: oneshot::Sender<u64> },
}

// Bakiyenin tek sahibi bu görev
async fn hesap_aktoru(mut rx: mpsc::Receiver<Komut>) {
    let mut bakiye = 0;
    while let Some(komut) = rx.recv().await {
        match komut {
            Komut::Yatir { tutar, cevap } => {
                bakiye += tutar;
                let _ = cevap.send(bakiye); // soran vazgeçtiyse (drop) hata önemsiz
            }
            Komut::Bakiye { cevap } => {
                let _ = cevap.send(bakiye);
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let (tx, rx) = mpsc::channel(16);
    tokio::spawn(hesap_aktoru(rx));

    let (cevap_tx, cevap_rx) = oneshot::channel();
    tx.send(Komut::Yatir { tutar: 250, cevap: cevap_tx }).await.unwrap();
    println!("yatırıldı, yeni bakiye: {}", cevap_rx.await.unwrap());

    let (cevap_tx, cevap_rx) = oneshot::channel();
    tx.send(Komut::Bakiye { cevap: cevap_tx }).await.unwrap();
    println!("bakiye sorgusu: {}", cevap_rx.await.unwrap());
}
```

Modül 7'deki "enum'larla modelleme" burada parlıyor: her komut bir varyant, cevap kanalı varyantın verisi. Komut
listesi `match` ile **eksiksiz** işlenir; yeni bir komut eklersen derleyici aktörü güncellemeni ister (E0004).

```fill
prompt: Bir göreve hesaplama yaptır ve cevabını tek seferlik bir kanalla geri al.
code: |
  use tokio::sync::oneshot;

  #[tokio::main]
  async fn main() {
      let (cevap_tx, cevap_rx) = oneshot::___0();
      tokio::spawn(async move {
          let toplam: u32 = (1..=10).sum();
          let _ = cevap_tx.___1(toplam);
      });
      let sonuc = cevap_rx.___2.unwrap();
      println!("toplam: {sonuc}");
  }
blanks:
  - ["channel"]
  - ["send"]
  - ["await"]
output: "toplam: 55"
explanation: |
  `oneshot::channel()` bir (gönderici, alıcı) çifti verir. `send` senkrondur ve göndericiyi tüketir; alıcı
  doğrudan `.await` edilir ve `Result<u32, RecvError>` döner. Görev cevap göndermeden biterse (ya da panik atarsa)
  `Err` gelir, bu yüzden `unwrap` burada "cevap mutlaka gelir" varsayımıdır.
```

## broadcast — herkese duyuru

`mpsc`'de her mesajı **tek** bir alıcı alır. Bir mesajın **bütün** dinleyicilere ulaşmasını istiyorsan
`tokio::sync::broadcast` kullanılır: her `subscribe()` çağrısı yeni bir alıcı verir ve her alıcı, abone olduktan
sonra gönderilen her mesajın bir kopyasını alır (bu yüzden mesaj tipi `Clone` olmalıdır).

```rust
use tokio::sync::broadcast;

#[tokio::main]
async fn main() {
    let (tx, mut ekran_rx) = broadcast::channel::<String>(16);
    let mut kayit_rx = tx.subscribe();

    let ekran = tokio::spawn(async move {
        let mut gorulen = Vec::new();
        while let Ok(olay) = ekran_rx.recv().await {
            gorulen.push(olay);
        }
        format!("ekran: {gorulen:?}")
    });
    let kayit = tokio::spawn(async move {
        let mut yazilan = Vec::new();
        while let Ok(olay) = kayit_rx.recv().await {
            yazilan.push(olay);
        }
        format!("kayıt: {yazilan:?}")
    });

    for olay in ["kapı açıldı", "ışık yandı"] {
        tx.send(olay.to_string()).unwrap();
    }
    drop(tx); // göndericiler bitince alıcılar Err(Closed) alır ve döngüler biter
    println!("{}", ekran.await.unwrap());
    println!("{}", kayit.await.unwrap());
}
```

Kapasiteyi aşacak kadar geride kalan yavaş bir alıcı, kaçırdığı mesajlar için `Err(RecvError::Lagged(n))` alır:
broadcast hızlı göndericiyi yavaşlatmaz, yavaş alıcıyı **atlatır**. Sadece "en son değer" önemliyse (ayarlar,
durum göstergesi) kardeşi `tokio::sync::watch` daha uygundur.

## Mutex: std mi, tokio mu?

Kanallar yerine durumu paylaşmak da meşrudur: `Arc<Mutex<T>>`. Async'te iki `Mutex` var ve hangisini seçeceğin tek
bir soruya bağlı: **kilidi tutarken `.await` edecek misin?**

Önce tahmin et, Modül 18'deki `Send` bilgini kullan: bu kod derlenir mi?

```compiles
code: |
  use std::sync::{Arc, Mutex};
  use std::time::Duration;

  #[tokio::main]
  async fn main() {
      let sepet = Arc::new(Mutex::new(Vec::new()));
      let s = Arc::clone(&sepet);
      let gorev = tokio::spawn(async move {
          let mut liste = s.lock().unwrap();
          liste.push("elma");
          tokio::time::sleep(Duration::from_millis(10)).await;
          liste.push("armut");
      });
      gorev.await.unwrap();
      println!("{:?}", sepet.lock().unwrap());
  }
answer: false
explanation: |
  `std::sync::MutexGuard` `Send` **değildir** (kilit, onu alan thread'de bırakılmalıdır). Guard `liste`, `.await`
  boyunca yaşıyor; görev o noktada askıya alınıp başka bir thread'de devam edebileceği için future `Send` olmaz ve
  `tokio::spawn` onu reddeder. Derleyici mesajı: "future cannot be sent between threads safely ... has type
  `std::sync::MutexGuard<'_, Vec<&str>>` which is not `Send`".
```

:::error
```text
error: future cannot be sent between threads safely
   --> src/main.rs:8:17
    |
  8 |       let gorev = tokio::spawn(async move {
    |  _________________^
  9 | |         let mut liste = s.lock().unwrap();
 10 | |         liste.push("elma");
 11 | |         tokio::time::sleep(Duration::from_millis(10)).await;
 12 | |         liste.push("armut");
 13 | |     });
    | |______^ future created by async block is not `Send`
    |
    = help: within `{async block@src/main.rs:8:30: 8:40}`, the trait `Send` is not implemented for `std::sync::MutexGuard<'_, Vec<&str>>`
note: future is not `Send` as this value is used across an await
   --> src/main.rs:11:55
    |
  9 |         let mut liste = s.lock().unwrap();
    |             --------- has type `std::sync::MutexGuard<'_, Vec<&str>>` which is not `Send`
 10 |         liste.push("elma");
 11 |         tokio::time::sleep(Duration::from_millis(10)).await;
    |                                                       ^^^^^ await occurs here, with `mut liste` maybe used later
note: required by a bound in `tokio::spawn`
```
Hata kodu yok ama mesaj çok net: **hangi değer** (`liste`), **hangi tip** (`MutexGuard`), **hangi `.await`
noktasında** sorun çıkarıyor. Okuma sırası: "is not `Send`" → "has type ..." → "await occurs here".
:::

Bu derleyicinin seni bir **mantık hatasından** da kurtarmasıdır: kilidi tutarken uyumak, o 10 ms boyunca sepete
erişmek isteyen herkesi bekletir. Bu durumda iki çözüm var:

**1. Kilidi `.await`'ten önce bırak (en sık doğru cevap).** Kilitli bölgeyi bir bloğa al; blok bitince guard
drop edilir:

```rust
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let sayac = Arc::new(Mutex::new(0u32)); // std::sync::Mutex
    let mut kollar = Vec::new();
    for _ in 0..100 {
        let sayac = Arc::clone(&sayac);
        kollar.push(tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(5)).await;
            {
                let mut n = sayac.lock().unwrap();
                *n += 1;
            } // guard burada drop edildi; aşağıdaki .await'te kilit tutulmuyor
            tokio::time::sleep(Duration::from_millis(5)).await;
        }));
    }
    for kol in kollar {
        kol.await.unwrap();
    }
    println!("ziyaretçi: {}", *sayac.lock().unwrap());
}
```

**2. Kilidi gerçekten `.await` boyunca tutman gerekiyorsa `tokio::sync::Mutex` kullan.** `lock()` kendisi bir
future'dır (`lock().await`): kilit meşgulse thread'i değil, **görevi** bekletir. Guard'ı `Send`'dir ve `.await`
boyunca tutulabilir. Örnek: iki parçalı bir kaydın satırlarının başkasıyla karışmaması:

```rust
use std::time::Duration;
use tokio::sync::Mutex;

async fn kaydet(gunluk: &Mutex<Vec<String>>, kim: &str) {
    let mut satirlar = gunluk.lock().await; // async kilit
    satirlar.push(format!("{kim}: başlık"));
    tokio::time::sleep(Duration::from_millis(20)).await; // kilit tutularak bekleniyor
    satirlar.push(format!("{kim}: gövde"));
}

#[tokio::main]
async fn main() {
    let gunluk = Mutex::new(Vec::new());
    tokio::join!(kaydet(&gunluk, "A"), kaydet(&gunluk, "B")); // join! ödünç alabilir
    for satir in gunluk.lock().await.iter() {
        println!("{satir}");
    }
}
```

:::remember Hangi Mutex?
- Kilitli bölgede **`.await` yoksa** (kısa bir okuma/yazma): **`std::sync::Mutex`**. Daha hızlıdır; tokio
  belgeleri de bunu önerir. Kilidi bir blokla ya da yardımcı bir senkron fonksiyonla sınırla.
- Kilidi **`.await` boyunca tutman şartsa** (ör. paylaşılan bir bağlantı üzerinden sıralı I/O): **`tokio::sync::Mutex`**.
- Çoğu zaman en iyisi hiç kilit paylaşmamak: durumu bir **aktör** göreve ver ve kanallarla konuş.
:::

## Semaphore — eşzamanlılığı sınırla

10.000 görevi aynı anda başlatabilmek harika; ama karşı taraftaki servis aynı anda yalnızca 5 isteğe izin veriyorsa?
**`tokio::sync::Semaphore`** (semafor) belirli sayıda **izin (permit)** dağıtır. Bir iş başlamadan önce
`acquire().await` ile izin alır; izin kalmadıysa biri bırakana kadar bekler. İzin, guard'ı drop edilince geri döner.

Aşağıda 6 indirme var ama aynı anda en fazla 2'si çalışıyor. Aynı anda kaç işin çalıştığını Modül 18'deki
atomiklerle ölçüyoruz (`fetch_max`: değeri, mevcut değer ile verilen değerin büyüğü yapar):

```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

#[tokio::main]
async fn main() {
    let izinler = Arc::new(Semaphore::new(2)); // aynı anda en fazla 2 indirme
    let aktif = Arc::new(AtomicUsize::new(0));
    let en_fazla = Arc::new(AtomicUsize::new(0));

    let mut set = JoinSet::new();
    for dosya in 1..=6 {
        let izinler = Arc::clone(&izinler);
        let aktif = Arc::clone(&aktif);
        let en_fazla = Arc::clone(&en_fazla);
        set.spawn(async move {
            let _izin = izinler.acquire().await.unwrap(); // izin yoksa burada bekle
            let simdi = aktif.fetch_add(1, Ordering::SeqCst) + 1;
            en_fazla.fetch_max(simdi, Ordering::SeqCst);
            tokio::time::sleep(Duration::from_millis(20)).await; // indiriliyor...
            aktif.fetch_sub(1, Ordering::SeqCst);
            dosya
        }); // _izin burada drop edilir → bekleyen bir sonraki görev başlar
    }

    let mut biten = Vec::new();
    while let Some(sonuc) = set.join_next().await {
        biten.push(sonuc.unwrap());
    }
    biten.sort();
    println!("indirilen: {biten:?}");
    println!("aynı anda en fazla: {}", en_fazla.load(Ordering::SeqCst));
}
```

`let _izin = ...` yazımına dikkat: değişkene bir isim (alt çizgiyle başlasa da) vermek guard'ı kapsam sonuna kadar
yaşatır. `let _ = izinler.acquire().await;` yazsaydın izin **hemen** drop edilirdi ve sınır hiç işlemezdi
(Modül 17'deki RAII guard'larıyla aynı tuzak).

```parsons
prompt: "Üç üretici görevden gelen sayıları toplayan bir tüketici kur. Kanal kapanınca toplamı yazdır (beklenen: 60)."
lines: |
  use tokio::sync::mpsc;
  #[tokio::main]
  async fn main() {
      let (tx, mut rx) = mpsc::channel::<u32>(4);
      for n in [10, 20, 30] {
          let tx = tx.clone();
          tokio::spawn(async move { tx.send(n).await.unwrap() });
      }
      drop(tx);
      let mut toplam = 0;
      while let Some(n) = rx.recv().await {
          toplam += n;
      }
      println!("{toplam}");
  }
distractors: |
      while let Some(n) = rx.recv() {
          let tx = tx;
explanation: |
  Her üretici `tx.clone()` ile kendi göndericisini alır ve `async move` ile göreve taşır. Döngüden sonra
  `drop(tx)` ile orijinal gönderici bırakılır; böylece üç görev bitince kanal kapanır ve `recv().await` `None`
  döndürüp döngüyü bitirir. `let tx = tx;` ilk turda orijinali taşırdı (E0382); `.await`'siz `recv()` ise bir
  future'ı `Some(..)` ile eşlemeye çalışırdı.
```

Şimdi aktör desenini kendin genişlet.

```exercise
id: m19-e-banka-aktoru
title: Banka hesabı aktörü
difficulty: 3
prompt: |
  Bir banka hesabının bakiyesini, **tek sahibi** olan bir aktör görev yönetiyor. Komutlar `mpsc` kanalından,
  cevaplar her komuttaki `oneshot` kanalından gidiyor. `hesap_aktoru` fonksiyonunu tamamla:

  - `Yatir { tutar, cevap }`: bakiyeye ekle, **yeni bakiyeyi** cevap olarak gönder.
  - `Cek { tutar, cevap }`: bakiye yetiyorsa düş ve `Ok(yeni_bakiye)` gönder; yetmiyorsa bakiyeye **dokunmadan**
    `Err(format!("yetersiz bakiye: {bakiye} TL var, {tutar} TL istendi"))` gönder.
  - `Bakiye { cevap }`: mevcut bakiyeyi gönder.
  - Bütün göndericiler drop edilip kanal kapanınca döngüden çık ve **son bakiyeyi döndür**.
starter: |
  use tokio::sync::{mpsc, oneshot};

  enum Komut {
      Yatir { tutar: u64, cevap: oneshot::Sender<u64> },
      Cek { tutar: u64, cevap: oneshot::Sender<Result<u64, String>> },
      Bakiye { cevap: oneshot::Sender<u64> },
  }

  async fn hesap_aktoru(mut rx: mpsc::Receiver<Komut>, mut bakiye: u64) -> u64 {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let (tx, rx) = mpsc::channel(8);
      let aktor = tokio::spawn(hesap_aktoru(rx, 100));

      let (c_tx, c_rx) = oneshot::channel();
      tx.send(Komut::Cek { tutar: 500, cevap: c_tx }).await.unwrap();
      println!("{:?}", c_rx.await.unwrap());

      drop(tx);
      println!("son bakiye: {}", aktor.await.unwrap());
  }
solution: |
  use tokio::sync::{mpsc, oneshot};

  enum Komut {
      Yatir { tutar: u64, cevap: oneshot::Sender<u64> },
      Cek { tutar: u64, cevap: oneshot::Sender<Result<u64, String>> },
      Bakiye { cevap: oneshot::Sender<u64> },
  }

  async fn hesap_aktoru(mut rx: mpsc::Receiver<Komut>, mut bakiye: u64) -> u64 {
      while let Some(komut) = rx.recv().await {
          match komut {
              Komut::Yatir { tutar, cevap } => {
                  bakiye += tutar;
                  let _ = cevap.send(bakiye);
              }
              Komut::Cek { tutar, cevap } => {
                  let sonuc = if tutar > bakiye {
                      Err(format!("yetersiz bakiye: {bakiye} TL var, {tutar} TL istendi"))
                  } else {
                      bakiye -= tutar;
                      Ok(bakiye)
                  };
                  let _ = cevap.send(sonuc);
              }
              Komut::Bakiye { cevap } => {
                  let _ = cevap.send(bakiye);
              }
          }
      }
      bakiye
  }

  #[tokio::main]
  async fn main() {
      let (tx, rx) = mpsc::channel(8);
      let aktor = tokio::spawn(hesap_aktoru(rx, 100));

      let (c_tx, c_rx) = oneshot::channel();
      tx.send(Komut::Cek { tutar: 500, cevap: c_tx }).await.unwrap();
      println!("{:?}", c_rx.await.unwrap());

      drop(tx);
      println!("son bakiye: {}", aktor.await.unwrap());
  }
check: tests
tests: |
  async fn yatir(tx: &mpsc::Sender<Komut>, tutar: u64) -> u64 {
      let (c_tx, c_rx) = oneshot::channel();
      tx.send(Komut::Yatir { tutar, cevap: c_tx }).await.unwrap();
      c_rx.await.expect("aktör Yatir komutuna cevap vermedi")
  }

  async fn cek(tx: &mpsc::Sender<Komut>, tutar: u64) -> Result<u64, String> {
      let (c_tx, c_rx) = oneshot::channel();
      tx.send(Komut::Cek { tutar, cevap: c_tx }).await.unwrap();
      c_rx.await.expect("aktör Cek komutuna cevap vermedi")
  }

  async fn bakiye(tx: &mpsc::Sender<Komut>) -> u64 {
      let (c_tx, c_rx) = oneshot::channel();
      tx.send(Komut::Bakiye { cevap: c_tx }).await.unwrap();
      c_rx.await.expect("aktör Bakiye komutuna cevap vermedi")
  }

  #[tokio::test]
  async fn yatir_ve_cek() {
      let (tx, rx) = mpsc::channel(8);
      tokio::spawn(hesap_aktoru(rx, 100));
      assert_eq!(yatir(&tx, 50).await, 150, "100 + 50 = 150 olmalı");
      assert_eq!(cek(&tx, 120).await, Ok(30), "150 - 120 = 30 olmalı");
      assert_eq!(bakiye(&tx).await, 30);
  }

  #[tokio::test]
  async fn yetersiz_bakiye_dokunmaz() {
      let (tx, rx) = mpsc::channel(8);
      tokio::spawn(hesap_aktoru(rx, 50));
      assert_eq!(
          cek(&tx, 80).await,
          Err(String::from("yetersiz bakiye: 50 TL var, 80 TL istendi")),
          "yetersiz bakiyede hata mesajı tam bu biçimde olmalı"
      );
      assert_eq!(bakiye(&tx).await, 50, "başarısız çekim bakiyeyi değiştirmemeli");
      assert_eq!(cek(&tx, 50).await, Ok(0), "bakiyenin tamamı çekilebilmeli");
  }

  #[tokio::test]
  async fn kanal_kapaninca_son_bakiye_doner() {
      let (tx, rx) = mpsc::channel(8);
      let aktor = tokio::spawn(hesap_aktoru(rx, 10));
      yatir(&tx, 5).await;
      drop(tx);
      assert_eq!(aktor.await.unwrap(), 15, "kanal kapanınca aktör son bakiyeyi döndürmeli");
  }

  #[tokio::test]
  async fn eszamanli_cekimler_tutarli() {
      let (tx, rx) = mpsc::channel(8);
      let aktor = tokio::spawn(hesap_aktoru(rx, 1000));
      let mut set = tokio::task::JoinSet::new();
      for _ in 0..10 {
          let tx = tx.clone();
          set.spawn(async move { cek(&tx, 150).await.is_ok() });
      }
      let mut basarili = 0;
      while let Some(sonuc) = set.join_next().await {
          if sonuc.unwrap() {
              basarili += 1;
          }
      }
      drop(tx);
      assert_eq!(basarili, 6, "1000 TL'den 150'şer TL en fazla 6 kez çekilebilir");
      assert_eq!(aktor.await.unwrap(), 100, "son bakiye 1000 - 6 × 150 = 100 olmalı");
  }
hints:
  - "İskelet: `while let Some(komut) = rx.recv().await { match komut { ... } }` ve döngüden sonra `bakiye` döndür."
  - "Her kolda varyantın alanlarını desenle aç: `Komut::Cek { tutar, cevap } => { ... }`. Cevabı `let _ = cevap.send(...);` ile gönder."
  - "`Cek` kolunda önce `if tutar > bakiye { Err(format!(...)) } else { bakiye -= tutar; Ok(bakiye) }` ile sonucu hesapla, sonra `cevap.send(sonuc)`."
explanation: |
  Aktör deseninde bakiyenin **tek sahibi** aktör görevdir: `mut bakiye` onun yerel değişkenidir. Komutlar kanaldan
  **birer birer** geldiği için iki çekim asla aynı anda işlenmez; son testteki 10 eşzamanlı çekimde bile tam 6'sı
  başarılı olur ve bakiye hiçbir zaman eksiye düşmez. `Mutex` yok, kilit yok, veri yarışı ihtimali yok.

  `let _ = cevap.send(..)`: `oneshot::Sender::send`, alıcı vazgeçip drop edildiyse `Err` döner. Soran gitmişse
  aktörün yapacak bir şeyi yoktur; hatayı bilerek yok sayıyoruz (Modül 10'daki `#[must_use]` uyarısı).

  Kapanış: `rx.recv().await`, bütün `Sender`'lar drop edilince `None` döner, `while let` biter ve aktör son
  bakiyeyi döndürür. Gerçek uygulamalarda aktörün etrafına `Komut` gönderen metotları olan bir `HesapTutamaci`
  struct'ı yazılır (`async fn yatir(&self, tutar) -> u64`); testlerdeki yardımcı fonksiyonlar bunun küçük bir hâli.
```

## Özet

:::remember
- `mpsc::channel(n)`: sınırlı kanal; `send(v).await` dolunca bekler (**geri basınç**), `recv().await` kanal kapanınca `None`.
- Kanal, **bütün** `Sender`'lar drop edilince kapanır; orijinal `tx`'i `drop` etmeyi unutma.
- `oneshot`: tek seferlik cevap; `send` senkron ve tüketici, alıcı doğrudan `.await` edilir. `mpsc` + `oneshot` = **aktör** deseni.
- `broadcast`: her alıcı her mesajı alır (`T: Clone`), yavaş alıcı `Lagged` olur; son değer için `watch`.
- `.await` boyunca kilit tutmuyorsan `std::sync::Mutex` (bloğa al); tutman şartsa `tokio::sync::Mutex` (`lock().await`).
- `Semaphore::new(n)` + `acquire().await`: aynı anda en fazla `n` iş. İzni `let _izin` ile yaşat, `let _` ile değil.
:::

```reflect
prompt: "Banka hesabını `Arc<Mutex<u64>>` ile paylaşmak yerine bir aktör görevle yönetmenin avantajları ve dezavantajları neler olabilir?"
answer: |
  Model cevap: Aktörde durumun tek sahibi vardır; komutlar sırayla işlendiği için kilit, deadlock ya da `.await`
  boyunca guard tutma sorunu olmaz. Bütün iş mantığı tek yerde toplanır, test etmesi kolaydır. Dezavantajları:
  her istek bir mesaj ve bir cevap kanalı gerektirir (biraz daha fazla kod ve küçük bir maliyet), aktör tek görev
  olduğu için çok yoğun yükte darboğaz olabilir ve kanal kapanma/cevapsız kalma durumlarını ele almak gerekir.
  Basit bir sayaç için `Mutex` (hatta atomik) yeterlidir; karmaşık durum ve kurallar için aktör daha temizdir.
```

```flashcards
- front: "`tokio::sync::mpsc` alıcısında `rx.recv().await` ne zaman `None` döner?"
  back: Bütün `Sender` kopyaları drop edildiğinde ve tamponda mesaj kalmadığında.
- front: Geri basınç (backpressure) nedir, sınırlı kanal bunu nasıl sağlar?
  back: "Hızlı üreticinin yavaş tüketiciye göre yavaşlatılması. Kanal dolunca `send().await` yer açılana kadar bekler."
- front: "`oneshot::Sender::send` async mi? Alıcı nasıl beklenir?"
  back: "Hayır, senkrondur ve göndericiyi tüketir. Alıcı doğrudan `.await` edilir: `Result<T, RecvError>`."
- front: Aktör (actor) deseninin özü nedir?
  back: "Durumun **tek sahibi** bir görevdir; diğerleri durumu mesajlarla (`mpsc`) değiştirir, cevapları `oneshot` ile alır. Kilit gerekmez."
- front: "`std::sync::MutexGuard`'ı `.await` boyunca tutan bir future neden `tokio::spawn` edilemez?"
  back: "`MutexGuard` `Send` değildir; `.await`'te askıya alınan görev başka thread'de devam edebileceği için future `Send` olmaz."
- front: "Ne zaman `tokio::sync::Mutex` seçilir?"
  back: "Kilidi `.await` boyunca tutmak **zorunda** olduğunda. Aksi hâlde daha hızlı olan `std::sync::Mutex` tercih edilir."
- front: "`let _ = sem.acquire().await;` neden bir semaforu işe yaramaz hâle getirir?"
  back: "`_` deseni değeri hemen drop eder; izin anında geri verilir. İzni `let _izin = ...` ile kapsam sonuna kadar tut."
```
