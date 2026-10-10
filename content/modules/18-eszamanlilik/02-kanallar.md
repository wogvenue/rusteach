---
id: m18-l02
title: Kanallarla mesajlaşma
minutes: 18
type: lesson
objectives:
  - "`mpsc::channel` ile thread'ler arasında `send`/`recv` kullanarak veri gönderebilmek"
  - Kanaldan geçen değerin sahipliğinin neden taşındığını açıklayabilmek
  - "`tx.clone()` ile birden çok üretici kurup göndericileri düşürerek kanalı doğru kapatabilmek"
  - "`sync_channel` ile sınırlı (bounded) kanalın üreticiyi nasıl yavaşlattığını açıklayabilmek"
keywords: [kanal, channel, mpsc, Sender, Receiver, send, recv, "sync_channel", "tx.clone", üretici-tüketici]
---

Thread'ler arasında veri taşımanın iki büyük yolu var: ya aynı belleği **paylaşırsın** ve erişimi
kilitlerle düzenlersin (bir sonraki ders), ya da thread'ler birbirine **mesaj gönderir**. Go dilinin
meşhur sözü ikinci yolu özetler:

> *"Belleği paylaşarak iletişim kurma; iletişim kurarak belleği paylaş."*
> (Do not communicate by sharing memory; instead, share memory by communicating.)

Rust'ta bu fikrin aracı **kanallardır (channels)**. Bu derste Rust'ın sahiplik sisteminin kanallarla
nasıl kusursuz bir uyum içinde çalıştığını göreceksin.

## Kanal nedir?

Bir kanalın iki ucu vardır: veriyi koyan **gönderici (transmitter, `tx`)** ve veriyi alan **alıcı
(receiver, `rx`)**. Standart kütüphanedeki kanal `std::sync::mpsc` modülündedir. **mpsc** =
*multiple producer, single consumer*: **birden çok üretici, tek tüketici.**

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let siparis = String::from("2 çay, 1 simit");
        tx.send(siparis).unwrap();
    });

    let gelen = rx.recv().unwrap();
    println!("Mutfağa ulaştı: {gelen}");
}
```

- `mpsc::channel()` bir `(Sender<T>, Receiver<T>)` tuple'ı döndürür; tuple'ı `let (tx, rx)` ile
  parçalıyoruz (Modül 2). `T`'yi derleyici ilk `send`'den çıkarır: burada `String`.
- `tx`'i `move` ile thread'e taşıdık; gönderici artık o thread'in.
- `rx.recv()` **bloklayan (blocking)** bir çağrıdır: mesaj gelene kadar ana thread'i bekletir.
  Burada `join` yazmadık ama mesajı beklediğimiz için çıktı garanti.

:::analogy Pnömatik tüp postası
Eski bankalarda ve hastanelerde gişeden arka ofise kapsül gönderen tüpler vardı. Gişe memuru belgeyi
kapsüle koyup tüpe bırakır; belge artık **onun elinde değildir**, arka ofise aittir. Birden çok gişenin
kendi tüp ağzı olabilir (çok üretici) ama hepsi **tek bir** arka ofise akar (tek tüketici). Gişe
memurları ve arka ofis aynı belgeyi **aynı anda** tutamaz; kavga da çıkmaz.
:::

```quiz
question: "`mpsc::channel()` ile kurulan bir kanal için hangisi doğrudur?"
options:
  - Birden çok thread aynı kanaldan **mesaj alabilir**, ama yalnızca bir thread gönderebilir
  - Birden çok thread **gönderebilir** (göndericiyi klonlayarak), ama mesajları tek bir alıcı alır
  - Kanal yalnızca iki thread arasında kullanılabilir, üçüncü thread eklenemez
answer: 1
explanation: |
  **m**ultiple **p**roducer, **s**ingle **c**onsumer. `Sender` klonlanabilir (`tx.clone()`), her klon
  ayrı bir thread'e verilebilir. `Receiver` ise klonlanamaz; kanalın tek bir "çıkışı" vardır. Birden çok
  thread'in aynı kuyruktan iş çekmesi gerekirse alıcıyı bir kilitle paylaşmak (sonraki ders) ya da çok
  tüketicili bir kanal kütüphanesi (ör. `crossbeam-channel`) kullanmak gerekir.
feedback:
  - Tam tersi; isimdeki "single consumer" alıcı tarafın tek olduğunu söyler.
  - Doğru!
  - Göndericiyi klonlayarak istediğin kadar üretici thread ekleyebilirsin.
```

## `send`, `recv` ve sahiplik

Gönderdiğin bir değeri sonradan kullanmak istersen ne olur? Tahmin et:

```compiles
code: |
  use std::sync::mpsc;
  use std::thread;

  fn main() {
      let (tx, rx) = mpsc::channel();
      thread::spawn(move || {
          let mesaj = String::from("merhaba");
          tx.send(mesaj).unwrap();
          println!("gönderildi: {mesaj}");
      });
      println!("{}", rx.recv().unwrap());
  }
answer: false
error: E0382
explanation: |
  `send(mesaj)` değeri **değerle** alır, yani `mesaj`'ın sahipliğini kanala **taşır**. Sonraki satırda
  `mesaj`'ı kullanmak, taşınmış bir değeri kullanmaktır: `E0382`. Bu bir sınırlama değil, bir **koruma**:
  alıcı thread o `String`'i değiştirebilir ya da drop edebilir; gönderen hâlâ ona dokunabilseydi bu bir
  veri yarışı olurdu.
```

:::error
```text
error[E0382]: borrow of moved value: `mesaj`
 --> src/main.rs:9:32
  |
7 |         let mesaj = String::from("merhaba");
  |             ----- move occurs because `mesaj` has type `String`, which does not implement the `Copy` trait
8 |         tx.send(mesaj).unwrap();
  |                 ----- value moved here
9 |         println!("gönderildi: {mesaj}");
  |                                ^^^^^ value borrowed here after move
```
Modül 4'ten tanıdık bir hata: sahiplik kuralları thread sınırında da aynen geçerli. Çözüm: yazdırmayı
`send`'den **önce** yap ya da gerçekten iki kopya gerekiyorsa bilinçli olarak `clone()` gönder.
:::

Bu, kanalların büyük gücüdür. Go'da bir kanaldan bir işaretçi gönderip ardından aynı veriyi değiştirmeye
devam edebilirsin; derleyici seni durdurmaz ve sessiz bir veri yarışı doğar. Rust'ta gönderilen değer
**gerçekten** el değiştirir. Üstelik taşıma ucuzdur: `String`'in karakterleri kopyalanmaz, sadece stack'teki
küçük başlık (işaretçi, uzunluk, kapasite) kanaldan geçer:

```memory
title: Kanaldan geçen String
steps:
  - caption: "Üretici thread `mesaj`'ı oluşturdu. Karakterler heap'te."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: rx, type: "Receiver<String>", value: "kanal ucu" }
      - frame: "üretici thread"
        vars:
          - { name: mesaj, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "`tx.send(mesaj)`: başlık kanalın kuyruğuna taşındı; üreticinin `mesaj`'ı artık geçersiz."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: rx, type: "Receiver<String>", value: "kanal ucu" }
      - frame: "üretici thread"
        vars:
          - { name: mesaj, type: String, value: "ptr · len=7 · cap=7", moved: true, note: taşındı }
    heap:
      - { id: k, label: kanal kuyruğu, value: "[ String{ptr · len=7} ] → m e r h a b a" }
      - { id: h1, value: "m e r h a b a" }
  - caption: "`rx.recv()`: başlık ana thread'deki `gelen`'e taşındı. Heap verisi hiç yer değiştirmedi."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: rx, type: "Receiver<String>", value: "kanal ucu" }
          - { name: gelen, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: k, label: kanal kuyruğu, value: "[ ]" }
      - { id: h1, value: "m e r h a b a" }
```

`send` ve `recv` başarısız da olabilir; ikisi de `Result` döndürür (Modül 10):

| Çağrı | `Ok` | `Err` ne zaman? |
|---|---|---|
| `tx.send(v)` | değer kuyruğa kondu | **alıcı drop edilmişse** (`SendError(v)` — değer sana geri verilir) |
| `rx.recv()` | `Ok(değer)`, gerekirse bekleyerek | **bütün göndericiler drop edilmiş ve kuyruk boşsa** (`RecvError`) |
| `rx.try_recv()` | hazır mesaj varsa | hemen döner: `Empty` (şu an mesaj yok) ya da `Disconnected` |
| `rx.recv_timeout(süre)` | süre içinde mesaj gelirse | `Timeout` ya da `Disconnected` |

```predict
code: |
  use std::sync::mpsc;

  fn main() {
      let (tx, rx) = mpsc::channel();
      tx.send("çay").unwrap();
      tx.send("simit").unwrap();
      drop(tx);
      println!("{:?}", rx.recv());
      println!("{:?}", rx.recv());
      println!("{:?}", rx.recv());
  }
options:
  - |
    Ok("çay")
    Ok("simit")
    Err(RecvError)
  - |
    Ok("simit")
    Ok("çay")
    Err(RecvError)
  - |
    Err(RecvError)
    Err(RecvError)
    Err(RecvError)
  - Program sonsuza dek bekler
answer: 0
explanation: |
  Üç şey birden görülüyor:
  - Kanal bir **FIFO kuyruğudur**: ilk giren ilk çıkar.
  - `mpsc::channel()` **sınırsızdır (unbounded)**: `send` hiç beklemez, bu yüzden tek thread'de bile iki
    mesajı art arda koyabildik.
  - `drop(tx)` (Modül 17'deki `std::mem::drop`) son göndericiyi düşürdü. Kuyrukta bekleyen mesajlar
    **yine de teslim edilir**; kuyruk boşalıp gönderici kalmayınca `recv` sonsuza dek beklemek yerine
    `Err(RecvError)` döner.
```

## Alıcıyı iterator olarak kullanmak

Her seferinde `recv()` çağırmak yerine alıcının üzerinde `for` ile dönebilirsin. Döngü her turda bir
mesaj bekler ve **bütün göndericiler düşürülünce** kendiliğinden biter:

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() {
    let (tx, rx) = mpsc::channel();

    let istasyon = thread::spawn(move || {
        for derece in [21, 23, 19, 25] {
            tx.send(derece).unwrap();
            thread::sleep(Duration::from_millis(3));
        }
        // closure bitince tx drop edilir → kanal kapanır
    });

    for derece in &rx {
        println!("Yeni ölçüm: {derece}°C");
    }
    println!("İstasyon yayını bitirdi.");
    istasyon.join().unwrap();
}
```

Tek üretici olduğu ve kanal FIFO olduğu için bu çıktı **deterministiktir**: dört ölçüm hep aynı sırayla
gelir. `for derece in &rx` aslında `rx.iter()`'in kısaltmasıdır ve bu bir **iterator** döndürür
(Modül 14). Yani bütün adaptör ve tüketicileri kullanabilirsin:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        for fiyat in [45, 120, 80, 15] {
            tx.send(fiyat).unwrap();
        }
    });

    let pahali_toplam: u32 = rx.iter().filter(|&f| f >= 50).sum();
    println!("50 TL ve üzeri ürünlerin toplamı: {pahali_toplam} TL");
}
```

`sum()` bütün değerleri çeker, yani kanal kapanana kadar bekler. Kanal hiç kapanmasaydı `sum()` da hiç
bitmezdi; bu bir sonraki adımın konusu.

## Birden çok üretici: `tx.clone()`

Birden çok thread'in aynı alıcıya göndermesi için göndericiyi **klonlarsın**. `Sender` klonlamak ucuzdur:
aynı kanala yeni bir uç açar, mesajları kopyalamaz.

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    for garson in ["Ahmet", "Zeynep", "Mert"] {
        let tx = tx.clone(); // her thread'e kendi göndericisi
        thread::spawn(move || {
            tx.send(format!("{garson}: 1 mercimek çorbası")).unwrap();
        });
    }
    drop(tx); // orijinal göndericiyi bırak!

    let mut siparisler: Vec<String> = rx.iter().collect();
    siparisler.sort(); // üreticiler arası sıra belirsiz → sırala
    for s in &siparisler {
        println!("{s}");
    }
}
```

Döngünün içindeki `let tx = tx.clone();` gölgeleme (Modül 2) yoluyla thread'e taşınacak yeni bir
gönderici oluşturur. Peki sondaki `drop(tx)` neden şart?

````quiz
question: |
  Yukarıdaki programdan `drop(tx);` satırını silersen ne olur?
options:
  - Hiçbir şey değişmez; thread'ler bitince kanal kapanır
  - Program siparişleri toplar ama `rx.iter().collect()` hiç bitmez; program sonsuza dek bekler
  - "Derlenmez: `tx` kullanılmayan bir değişken olur"
answer: 1
explanation: |
  Alıcı, **bütün** göndericiler düşürülene kadar "belki yeni mesaj gelir" diye bekler. Thread'lere giden
  üç klon, thread'ler bitince düşürülür; ama `main`'deki **orijinal** `tx` hâlâ yaşıyor ve `main`'in
  sonuna kadar yaşayacak. `collect()` de o yüzden asla bitmez: program kilitlenir. Bu, kanallarla ilgili
  en sık yapılan hatadır.

  Çözümler: orijinal `tx`'i döngüden sonra `drop` etmek ya da orijinali son üreticiye **taşımak**
  (`clone` etmeden).
feedback:
  - Thread'lerdeki klonlar düşer ama orijinal gönderici hâlâ canlı; kanal kapanmaz.
  - Doğru! Kanal, son gönderici düşene kadar açık kalır.
  - "`tx` döngüde `tx.clone()` için kullanılıyor; kullanılmayan değişken uyarısı da olmaz, hata da."
````

```memory
title: Kanal ne zaman kapanır?
steps:
  - caption: "`mpsc::channel()`: bir gönderici, bir alıcı. Kanal içinde gönderici sayacı = 1."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: tx, type: "Sender<String>", value: "uç", to: k }
          - { name: rx, type: "Receiver<String>", value: "uç", to: k }
    heap:
      - { id: k, label: kanal, value: "kuyruk: [ ] · gönderici=1" }
  - caption: "Üç `tx.clone()` üç thread'e taşındı. Sayaç = 4 (orijinal + 3 klon)."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: tx, type: "Sender<String>", value: "uç", to: k }
          - { name: rx, type: "Receiver<String>", value: "uç", to: k }
      - frame: "garson thread'leri (×3)"
        vars:
          - { name: tx, type: "Sender<String>", value: "klon", to: k }
    heap:
      - { id: k, label: kanal, value: "kuyruk: [3 sipariş] · gönderici=4" }
  - caption: "Thread'ler bitti, klonlar drop edildi. `drop(tx)` ile orijinal de gitti: sayaç = 0 → kuyruk boşalınca iterator biter."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: tx, type: "Sender<String>", value: "uç", moved: true, note: drop edildi }
          - { name: rx, type: "Receiver<String>", value: "uç", to: k }
    heap:
      - { id: k, label: kanal, value: "kuyruk: [3 sipariş] · gönderici=0 (kapalı)" }
```

```fill
prompt: |
  Üç sensör thread'i ölçümlerini aynı kanala göndersin, ana thread toplamı yazdırsın. Program sonsuza
  dek beklememeli. Boşlukları doldur.
code: |
  use std::sync::mpsc;
  use std::thread;

  fn main() {
      let (tx, rx) = mpsc::channel();
      for olcum in [12, 7, 30] {
          let tx = tx.___0();
          thread::spawn(move || {
              tx.send(olcum).unwrap();
          });
      }
      ___1(tx);
      let toplam: i32 = rx.iter().sum();
      println!("{toplam}");
  }
blanks:
  - ["clone"]
  - ["drop"]
output: "49"
explanation: |
  Her thread kendi `Sender` klonunu alıyor. Döngüden sonra `drop(tx)` orijinali bırakıyor; üç thread de
  bitince gönderici kalmıyor ve `sum()` sonlanıyor. Toplama sıradan bağımsız olduğu için thread'lerin hangi
  sırayla gönderdiğinin önemi yok: sonuç hep `49`.
```

## Sınırlı kanallar: `sync_channel`

`mpsc::channel()` sınırsızdır: üretici tüketiciden çok hızlıysa kuyruk durmadan büyür ve bellek tükenebilir.
`mpsc::sync_channel(kapasite)` ise **sınırlı (bounded)** bir kanal kurar: kuyrukta `kapasite` kadar mesaj
varken `send` **bekler**, ta ki tüketici bir yer açana kadar. Buna **geri basınç (backpressure)** denir:
yavaş tüketici, hızlı üreticiyi kendi hızına çeker.

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() {
    let (tx, rx) = mpsc::sync_channel(2); // tezgâhta en fazla 2 tepsi bekleyebilir

    let firinci = thread::spawn(move || {
        for tepsi in 1..=5 {
            tx.send(tepsi).unwrap(); // tezgâh doluysa burada bekler
        }
    });

    for tepsi in rx {
        thread::sleep(Duration::from_millis(5)); // kasiyer yavaş
        println!("{tepsi}. tepsi simit satıldı");
    }
    firinci.join().unwrap();
}
```

:::analogy Fırının tezgâhı
Fırıncı tepsileri çok hızlı çıkarıyor ama tezgâhta yalnızca iki tepsilik yer var. Tezgâh doluysa fırıncı
yeni tepsiyi elinde tutup **bekler**; kasiyer bir tepsiyi satınca yer açılır. Sınırsız kanal ise tepsilerin
yere yığılmasına izin veren, dibi olmayan bir tezgâhtır: bir gün dükkân tepsiyle dolar.
:::

`sync_channel(0)` özel bir durumdur: kuyruk yoktur, her `send` bir `recv` onu **elden ele** alana kadar
bekler (buluşma, rendezvous). İki thread'in belirli bir noktada "el sıkışması" için kullanılır.

````quiz
question: |
  Bu program ne yapar?

  ```rust
  use std::sync::mpsc;

  fn main() {
      let (tx, rx) = mpsc::sync_channel(1);
      tx.send(1).unwrap();
      tx.send(2).unwrap();
      println!("{}", rx.recv().unwrap());
  }
  ```
options:
  - "`1` yazdırır"
  - "`2` yazdırır"
  - İkinci `send`'de sonsuza dek bekler; hiçbir şey yazdırmaz
  - "Derlenmez: `sync_channel` yalnızca thread'lerle kullanılabilir"
answer: 2
explanation: |
  Kapasite 1: ilk `send` kuyruğa yer bulur. İkinci `send` kuyruk dolu olduğu için tüketicinin yer açmasını
  bekler; ama tüketici **aynı thread** ve o satıra hiç gelemiyor. Program kilitlenir. Sınırsız
  `mpsc::channel()` ile aynı kod `1` yazdırırdı ("`send`, `recv` ve sahiplik" bölümündeki tahmin sorusunu hatırla). Sınırlı kanallarda
  üretici ve tüketici **ayrı thread'lerde** olmalı.
feedback:
  - Program `println!`'e hiç ulaşamaz; ikinci `send` takılır.
  - Program `println!`'e hiç ulaşamaz; ayrıca kanal FIFO olduğu için ilk gelen `1` olurdu.
  - Doğru! Dolu sınırlı kanala aynı thread'den göndermek kilitlenmeye yol açar.
  - Derlenir; derleyici bu tür kilitlenmeleri yakalayamaz.
````

:::deep Standart kanalın arkası ve alternatifler
Rust 1.67'den beri `std::sync::mpsc`, popüler `crossbeam-channel` kütüphanesinin algoritmasını kullanır;
hızlı ve güvenilirdir. `Receiver` klonlanamadığı için çok tüketicili (mpmc) bir kanal gerekiyorsa
`crossbeam-channel` ya da `flume` gibi crate'ler tercih edilir. Async kodda ise `tokio::sync::mpsc`
kullanılır (Modül 19). Kanallar ile paylaşılan durum arasında seçim yaparken genel kural şudur: veri
bir **iş hattında** ilerliyorsa (üret → işle → tüket) kanal; birçok thread'in **aynı** veriyi okuyup
güncellemesi gerekiyorsa kilit.
:::

## Alıştırma: mutfak siparişleri ve iş hattı

```exercise
title: Garsonlardan mutfağa
difficulty: 3
prompt: |
  Bir lokantada her masanın garsonu siparişleri mutfağa **kanal** üzerinden iletiyor.

  `siparisleri_topla(masalar: Vec<Vec<String>>) -> Vec<String>` fonksiyonunu yaz:

  - `masalar[i]`, `i + 1` numaralı masanın siparişleridir.
  - Her masa için **ayrı bir thread** aç; thread o masanın her yemeği için `"Masa N: yemek"` biçiminde
    bir mesajı kanala göndersin.
  - Ana thread bütün mesajları toplayıp **alfabetik sıralı** bir `Vec` olarak döndürsün.

  Dikkat: göndericileri doğru düşürmezsen fonksiyon hiç bitmez ve test zaman aşımına uğrar.
starter: |
  use std::sync::mpsc;
  use std::thread;

  fn siparisleri_topla(masalar: Vec<Vec<String>>) -> Vec<String> {
      todo!()
  }

  fn main() {
      let masalar = vec![
          vec![String::from("kuru fasulye"), String::from("pilav")],
          vec![String::from("lahmacun")],
      ];
      for s in siparisleri_topla(masalar) {
          println!("{s}");
      }
  }
solution: |
  use std::sync::mpsc;
  use std::thread;

  fn siparisleri_topla(masalar: Vec<Vec<String>>) -> Vec<String> {
      let (tx, rx) = mpsc::channel();
      for (i, yemekler) in masalar.into_iter().enumerate() {
          let tx = tx.clone();
          thread::spawn(move || {
              for yemek in yemekler {
                  tx.send(format!("Masa {}: {yemek}", i + 1)).unwrap();
              }
          });
      }
      drop(tx);

      let mut hepsi: Vec<String> = rx.iter().collect();
      hepsi.sort();
      hepsi
  }

  fn main() {
      let masalar = vec![
          vec![String::from("kuru fasulye"), String::from("pilav")],
          vec![String::from("lahmacun")],
      ];
      for s in siparisleri_topla(masalar) {
          println!("{s}");
      }
  }
check: tests
tests: |
  fn s(x: &str) -> String {
      String::from(x)
  }

  #[test]
  fn iki_masa_siparisleri() {
      let sonuc = siparisleri_topla(vec![vec![s("pilav"), s("ayran")], vec![s("lahmacun")]]);
      assert_eq!(
          sonuc,
          vec![s("Masa 1: ayran"), s("Masa 1: pilav"), s("Masa 2: lahmacun")],
          "her yemek \"Masa N: yemek\" biçiminde gelmeli ve sonuç sıralı olmalı"
      );
  }

  #[test]
  fn cok_masa_hepsi_gelir() {
      let masalar: Vec<Vec<String>> = (1..=6).map(|i| vec![format!("çorba{i}"); i]).collect();
      let sonuc = siparisleri_topla(masalar);
      assert_eq!(sonuc.len(), 21, "1+2+...+6 = 21 sipariş gelmeli; hiçbiri kaybolmamalı");
      assert_eq!(sonuc[0], "Masa 1: çorba1", "sıralı sonucun ilki 1. masa olmalı");
      assert_eq!(sonuc[20], "Masa 6: çorba6", "sıralı sonucun sonuncusu 6. masa olmalı");
  }

  #[test]
  fn siparissiz_masa_ve_bos_liste() {
      assert!(siparisleri_topla(vec![]).is_empty(), "masa yoksa sipariş de yok");
      let sonuc = siparisleri_topla(vec![vec![], vec![s("künefe")]]);
      assert_eq!(sonuc, vec![s("Masa 2: künefe")], "boş masa mesaj göndermez ama numaralandırmayı bozmaz");
  }
hints:
  - "Masa numarası için `masalar.into_iter().enumerate()` kullan: `(i, yemekler)` çiftleri gelir, numara `i + 1`."
  - "Her thread için `let tx = tx.clone();` yaz, sonra `thread::spawn(move || ...)` içinde her yemeği `tx.send(format!(...))` ile gönder."
  - "Döngüden sonra `drop(tx);` yazmayı unutma — yoksa `rx.iter().collect()` hiç bitmez. Sonra `sort()` ile sırala."
require:
  - pattern: "mpsc::"
    message: Siparişleri bir `mpsc` kanalı üzerinden ilet.
  - pattern: "thread::spawn"
    message: Her masa için ayrı bir thread açmalısın.
explanation: |
  Bu, **çok üreticili kanalın** ders kitabı örneğidir: her üreticiye bir `Sender` klonu, tek bir `Receiver`,
  ve **orijinal göndericinin düşürülmesi**. `drop(tx)` olmadan alıcı, `main`'deki orijinal gönderici yüzünden
  kanalı hâlâ açık sanar ve `collect()` sonsuza dek bekler.

  Thread'leri `join` etmedik; buna gerek yok çünkü `rx.iter()` kanal kapanana kadar bekliyor ve kanal ancak
  bütün thread'ler göndericilerini bıraktığında kapanıyor. Yine de bir thread paniğe kapılırsa bunu fark
  etmek istersen tutamaçları toplayıp `join` etmek daha sağlamdır.

  Alternatif: orijinal `tx`'i `drop` etmek yerine son masaya `clone`'suz taşıyabilirdin, ama döngüde
  "son mu?" kontrolü kodu karmaşıklaştırır; `drop(tx)` hem açık hem okunaklı.
```

Şimdi iki kanalı arka arkaya bağlayarak bir **iş hattı (pipeline)** kur:

```exercise
title: İki aşamalı iş hattı
difficulty: 4
prompt: |
  Bir fabrikada parçalar iki istasyondan geçiyor. `boru_hatti(sayilar: Vec<i64>) -> Vec<i64>` fonksiyonunu
  **iki thread ve iki kanal** ile yaz:

  1. **Ayıklama thread'i:** `sayilar`'ı sırayla dolaşır, yalnızca **çift** olanları birinci kanala gönderir.
  2. **Kare thread'i:** birinci kanaldan gelen her sayının karesini ikinci kanala gönderir.
  3. **Ana thread:** ikinci kanaldan gelenleri toplayıp döndürür.

  Tek üretici ve FIFO kanallar sayesinde sonuç, girdideki sırayı korumalıdır.
starter: |
  use std::sync::mpsc;
  use std::thread;

  fn boru_hatti(sayilar: Vec<i64>) -> Vec<i64> {
      todo!()
  }

  fn main() {
      println!("{:?}", boru_hatti(vec![1, 2, 3, 4, 5, 6]));
  }
solution: |
  use std::sync::mpsc;
  use std::thread;

  fn boru_hatti(sayilar: Vec<i64>) -> Vec<i64> {
      let (ayik_tx, ayik_rx) = mpsc::channel();
      let (kare_tx, kare_rx) = mpsc::channel();

      thread::spawn(move || {
          for n in sayilar {
              if n % 2 == 0 {
                  ayik_tx.send(n).unwrap();
              }
          }
      });

      thread::spawn(move || {
          for n in ayik_rx {
              kare_tx.send(n * n).unwrap();
          }
      });

      kare_rx.iter().collect()
  }

  fn main() {
      println!("{:?}", boru_hatti(vec![1, 2, 3, 4, 5, 6]));
  }
check: tests
tests: |
  #[test]
  fn ciftlerin_kareleri_sirali() {
      assert_eq!(boru_hatti(vec![1, 2, 3, 4, 5, 6]), vec![4, 16, 36], "2, 4, 6'nın kareleri bu sırayla gelmeli");
  }

  #[test]
  fn sira_korunur() {
      assert_eq!(boru_hatti(vec![10, 3, 2, 8]), vec![100, 4, 64], "girdideki sıra korunmalı (sıralama yok!)");
  }

  #[test]
  fn negatif_ve_sifir() {
      assert_eq!(boru_hatti(vec![-4, 0, 7, -3]), vec![16, 0], "-4 ve 0 çifttir");
  }

  #[test]
  fn bos_girdi() {
      assert!(boru_hatti(vec![]).is_empty(), "boş girdi boş sonuç vermeli ve fonksiyon bitmeli");
  }
hints:
  - "İki ayrı `mpsc::channel()` kur: biri ayıklama → kare, diğeri kare → main arasında."
  - "İkinci thread birinci kanalın alıcısını `for n in ayik_rx` ile dolaşabilir; birinci thread bitince bu döngü kendiliğinden biter."
  - "Burada `clone` gerekmez: her gönderici tek bir thread'e `move` ile taşınır ve o thread bitince düşer. Ana thread `kare_rx.iter().collect()` ile sonucu toplar."
require:
  - pattern: "channel\\(\\)[\\s\\S]*channel\\(\\)"
    message: İki ayrı kanal kurmalısın (ayıklama → kare → ana thread).
  - pattern: "thread::spawn[\\s\\S]*thread::spawn"
    message: İki istasyonun her biri ayrı bir thread'de çalışmalı.
explanation: |
  Her aşama bir öncekinin çıktısını kanaldan okuyup bir sonrakine yazıyor; bu, Unix'teki
  `cat dosya | grep x | sort` boru hattının thread'li karşılığıdır. Aşamalar **aynı anda** çalışır: kare
  thread'i ilk çift sayıyı alır almaz işlemeye başlar, ayıklama thread'inin bitmesini beklemez.

  Kapanma **zincirleme** gerçekleşir: ayıklama thread'i bitince `ayik_tx` düşer → kare thread'inin
  `for` döngüsü biter → `kare_tx` düşer → ana thread'in `collect()`'i biter. Hiç `drop` çağırmadık çünkü
  her gönderici, sahibi olan thread bitince otomatik düşüyor (RAII, Modül 4 ve 17).

  Sıra neden korunuyor? Her kanalın **tek üreticisi** var ve kanallar FIFO. Birden çok kare thread'i
  açsaydık iş daha hızlı biterdi ama sıra bozulabilirdi; o zaman sonuçlara indeks eklemek ya da sıralamak
  gerekirdi.
```

## Özet

:::remember
- `let (tx, rx) = mpsc::channel();` → `Sender<T>` ve `Receiver<T>`; **mpsc** = çok üretici, tek tüketici.
- `send` değerin **sahipliğini taşır** → gönderdikten sonra kullanmak `E0382`.
- `recv` mesaj gelene kadar bekler; göndericilerin hepsi düşüp kuyruk boşalınca `Err(RecvError)`.
- `for m in rx` / `rx.iter()` kanal kapanınca biter → orijinal `tx`'i `drop` etmeyi unutma!
- Çok üretici için `tx.clone()`; üreticiler arası sıra belirsiz, tek üreticide FIFO.
- `sync_channel(n)` sınırlıdır: kuyruk doluysa `send` bekler (geri basınç); `n = 0` → elden ele buluşma.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — `send` değerin sahipliğini neden taşıyor? Değeri kopyalasaydı ya da
  referans gönderseydi ne gibi sorunlar çıkardı?
answer: |
  Sahiplik taşındığı için, gönderdikten sonra o değere yalnızca alıcı dokunabilir; iki thread aynı veriyi
  aynı anda değiştiremez, yani veri yarışı imkânsız olur. Referans gönderilseydi, gönderen thread veriyi
  değiştirmeye ya da drop etmeye devam edebilirdi (yarış veya sarkan referans). Her mesajı kopyalamak ise
  güvenli ama pahalı olurdu; taşıma sadece küçük başlığı geçirdiği için hem güvenli hem ucuz.
```

```flashcards
- front: "**mpsc** neyin kısaltmasıdır ve ne anlama gelir?"
  back: "*multiple producer, single consumer*: göndericiler klonlanabilir (çok üretici), alıcı tektir."
- front: "`tx.send(mesaj)` çağrısından sonra `mesaj` kullanılabilir mi?"
  back: "Hayır (`Copy` değilse). `send` sahipliği kanala taşır; kullanmak `E0382` verir."
- front: "`rx.recv()` ne zaman `Err(RecvError)` döndürür?"
  back: Bütün göndericiler drop edilmişken ve kuyrukta bekleyen mesaj kalmamışken.
- front: "`for m in rx` döngüsü hiç bitmiyorsa en olası sebep nedir?"
  back: "Bir gönderici (genellikle `main`'deki orijinal `tx`) hâlâ yaşıyor; `drop(tx)` unutulmuş."
- front: "`tx.send(v)` ne zaman `Err` döndürür?"
  back: "Alıcı drop edildiyse; `SendError` içinde gönderilemeyen değer geri verilir."
- front: "`mpsc::channel()` ile `mpsc::sync_channel(n)` arasındaki fark nedir?"
  back: İlki sınırsızdır, `send` hiç beklemez; ikincisinde kuyrukta `n` mesaj varken `send` yer açılana kadar bekler (geri basınç).
- front: Birden çok üreticili bir kanaldan gelen mesajların sırası hakkında ne söylenebilir?
  back: Aynı üreticinin mesajları gönderildiği sırayla gelir (FIFO); farklı üreticiler arasındaki sıra belirsizdir.
