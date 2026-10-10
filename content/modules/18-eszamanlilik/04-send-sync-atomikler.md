---
id: m18-l04
title: Send, Sync ve atomikler
minutes: 22
type: lesson
objectives:
  - "`Send` ve `Sync` işaret trait'lerinin anlamını açıklayıp yaygın std tiplerini bu açıdan sınıflandırabilmek"
  - "`RwLock` ile okuma ağırlıklı veriyi paylaşabilmek ve `Mutex`'ten farkını söyleyebilmek"
  - "`AtomicUsize`/`AtomicBool` ile `fetch_add`, `load`, `store` kullanarak kilitsiz sayaç ve bayrak yazabilmek"
  - "`Relaxed`, `Acquire`/`Release` ve `SeqCst` sıralamalarının ne zaman seçileceğini anlatabilmek"
keywords: [Send, Sync, "auto trait", RwLock, atomik, AtomicUsize, AtomicBool, "fetch_add", Ordering, Relaxed, SeqCst, Acquire, Release]
---

Şaşırtıcı bir gerçekle başlayalım: Rust **derleyicisi** thread'ler hakkında neredeyse hiçbir şey bilmez.
`thread::spawn`, `Mutex`, `Arc`, kanallar... hepsi standart kütüphanede yazılmış sıradan Rust kodudur.
Peki derleyici önceki derste `Rc`'yi thread'e göndermemize nasıl itiraz etti? Cevap iki küçük trait'te
saklı: **`Send`** ve **`Sync`**. Bu derste korkusuz eşzamanlılığın motorunu açıyoruz, sonra kilitlerin
iki alternatifini öğreniyoruz: okuma ağırlıklı veri için **`RwLock`**, tek bir sayı ya da bayrak için
**atomikler**.

## `Send` ve `Sync`: iki işaret trait'i

İkisi de **işaret trait'leridir (marker traits)**: hiç metotları yoktur, sadece bir tip hakkında bir
**iddia** taşırlar.

- **`T: Send`** → `T` tipindeki bir değerin **sahipliği** başka bir thread'e güvenle **taşınabilir**.
- **`T: Sync`** → `T`'ye **paylaşılan referanslar** (`&T`) birden çok thread'de aynı anda güvenle
  kullanılabilir. Resmî tanım: `T: Sync` ancak ve ancak `&T: Send` ise.

`thread::spawn`'ın imzasındaki `F: Send` şartını hatırla: closure'ın ve yakaladığı **her şeyin** `Send`
olması gerekir. Bir tipin `Send`/`Sync` olup olmadığını genellikle sen yazmazsın: bunlar **otomatik
trait'lerdir (auto traits)**. Bir struct'ın bütün alanları `Send` ise struct da kendiliğinden `Send`
olur; tek bir alan bile değilse struct da değildir. Önce tahmin et:

```compiles
code: |
  use std::rc::Rc;
  use std::thread;

  struct Oturum {
      kullanici_id: u32,
      ad: Rc<String>,
  }

  fn main() {
      let o = Oturum { kullanici_id: 7, ad: Rc::new(String::from("deniz")) };
      let h = thread::spawn(move || {
          println!("{} numaralı kullanıcı: {}", o.kullanici_id, o.ad);
      });
      h.join().unwrap();
  }
answer: false
error: E0277
explanation: |
  `Oturum`'un alanlarından biri `Rc<String>` ve `Rc` `Send` değildir. Otomatik trait kuralı gereği
  `Oturum` da `Send` olmaz; onu `move` ile yakalayan closure da `Send` olmaz ve `thread::spawn` reddeder.
  Senin hiçbir şey işaretlemene gerek kalmadı: güvensiz bir parça, onu içeren her tipe "bulaşır".
  Çözüm: `ad` alanını `Arc<String>` (ya da düz `String`) yapmak.
```

:::analogy Kargo ve vitrin
**`Send`**, bir eşyanın **kargoyla başka birine gönderilebilmesi** gibidir: gönderdikten sonra eşya artık
onundur. Bir kitap gönderilebilir; ama arkasında senin evine bağlı bir hortum olan bir çiçek saksısı
(`Rc`: sayacı hâlâ başkalarıyla ortak) gönderilemez. **`Sync`** ise bir eşyanın **vitrinde herkesin aynı
anda bakabileceği** şekilde durabilmesidir. Bir tabloya yüz kişi aynı anda bakabilir (`i32`, `String`).
Ama kurşun kalemle doldurulan bir **kayıt defterini** (`RefCell`) vitrine koyarsan, iki kişi aynı anda
"bu satır boş" deyip aynı satıra yazar.
:::

Standart kütüphanedeki tiplerin karnesi:

| Tip | `Send`? | `Sync`? | Neden |
|---|---|---|---|
| `i32`, `bool`, `String`, `Vec<T>`* | ✅ | ✅ | Ortak gizli durum yok |
| `Rc<T>` | ❌ | ❌ | Atomik olmayan, paylaşılan referans sayacı |
| `RefCell<T>`, `Cell<T>` | ✅* | ❌ | Ödünç sayacı / içerik eşzamanlı değişirse bozulur |
| `Mutex<T>` | ✅* | ✅* | Erişimi kilitle sıraya sokar (`T: Send` yeter) |
| `RwLock<T>` | ✅* | ✅* | Okuyucular aynı anda `&T` gördüğü için `T: Send + Sync` ister |
| `Arc<T>` | ✅* | ✅* | Sayaç atomik; `T: Send + Sync` ise |
| `MutexGuard<T>` | ❌ | ✅* | Kilidi alan thread bırakmalıdır (bazı işletim sistemleri bunu şart koşar) |
| `*const T`, `*mut T` (ham işaretçi) | ❌ | ❌ | Derleyici neye işaret ettiklerini bilemez (Modül 24) |

\* İçerdiği `T` uygun koşulları sağlıyorsa.

Bu tablodan bir kural çıkıyor: **`Arc<T>`'nin `Send` olması için `T`'nin `Sync` olması gerekir**, çünkü
`Arc` klonlandığında birden çok thread aynı `T`'ye **paylaşılan erişimle** ulaşır:

:::error
```text
error[E0277]: `RefCell<i32>` cannot be shared between threads safely
   --> src/main.rs:8:27
    |
  8 |       let h = thread::spawn(move || {
    |  _____________-------------_^
    | |             |
    | |             required by a bound introduced by this call
  9 | |         *v2.borrow_mut() += 1;
 10 | |     });
    | |_____^ `RefCell<i32>` cannot be shared between threads safely
    |
    = help: the trait `Sync` is not implemented for `RefCell<i32>`
    = note: if you want to do aliasing and mutation between multiple threads, use `std::sync::RwLock` instead
    = note: required for `Arc<RefCell<i32>>` to implement `Send`
```
`Arc<RefCell<i32>>` denemesinin hatası. Zinciri sondan başa oku: `Arc<RefCell<i32>>` `Send` değil, çünkü
`RefCell<i32>` `Sync` değil. Derleyici çözüm de öneriyor: thread'ler arasında "paylaş ve değiştir" için
`RwLock` (ya da `Mutex`).
:::

Kendi generic fonksiyonlarında da bu trait'leri **sınır** olarak kullanabilirsin (Modül 11):

```rust
use std::fmt::Debug;
use std::thread;

fn arka_planda_yazdir<T: Debug + Send + 'static>(deger: T) -> thread::JoinHandle<()> {
    thread::spawn(move || println!("arka planda: {deger:?}"))
}

fn main() {
    arka_planda_yazdir(vec![1, 2, 3]).join().unwrap();
    arka_planda_yazdir(String::from("rapor hazır")).join().unwrap();
}
```

```quiz
question: "`arka_planda_yazdir` fonksiyonuna hangisi **verilemez**?"
options:
  - "`std::sync::Arc::new(5)`"
  - "`std::rc::Rc::new(5)`"
  - "`(String::from(\"a\"), 3.14)`"
  - "`std::sync::Mutex::new(vec![1])`"
answer: 1
explanation: |
  `T: Send + 'static` şartını `Rc` sağlayamaz. `Arc<i32>` (`i32` `Send + Sync`), `Send` alanlardan oluşan
  bir tuple ve `Mutex<Vec<i32>>` ise sorunsuzdur. Derleyici hatayı fonksiyonun içinde değil, **çağrı
  yerinde** verir: "the trait `Send` is not implemented for `Rc<{integer}>`".
feedback:
  - "`Arc<i32>` `Send`'dir; `Rc`'nin thread'ler için yapılmış kardeşi."
  - Doğru! `Rc` `Send` değildir.
  - Tuple'ın her elemanı `Send` olduğu için tuple da `Send` (otomatik trait).
  - "`Mutex<T>`, `T: Send` olduğunda `Send`'dir."
```

:::deep `unsafe impl Send` ve neden nadiren gerekir
Otomatik kurallar bazen fazla temkinlidir: ham işaretçi içeren ama aslında güvenli olan bir tip
(ör. kendi yazdığın bir kilit) kendiliğinden `Send` olmaz. Böyle bir tipin yazarı `unsafe impl Send for
Tipim {}` ile "bunun güvenli olduğunu **ben** garanti ediyorum" diyebilir. `unsafe` kelimesi, derleyicinin
denetleyemediği bir sözü senin verdiğini gösterir; yanlışsa tanımsız davranış olur. Bunu Modül 24'te
göreceksin. Günlük kodda `Send`/`Sync` uygulamak neredeyse hiç gerekmez: hazır tipleri birleştirirsin,
derleyici gerisini çıkarır.
:::

## `RwLock`: çok okuyucu, tek yazar

`Mutex` her erişimi sıraya sokar; iki thread veriyi sadece **okumak** istese bile biri diğerini bekler.
Okumanın çok, yazmanın az olduğu verilerde (ayarlar, döviz kurları, önbellek) bu israftır. **`RwLock<T>`**
(okuma-yazma kilidi) Modül 5'teki ödünç alma kuralını çalışma zamanında, thread'ler arasında uygular:

- `read()` → **aynı anda istediğin kadar** okuyucu (`RwLockReadGuard`, `&T` gibi davranır),
- `write()` → **tek bir** yazar ve o sırada hiç okuyucu yok (`RwLockWriteGuard`, `&mut T` gibi).

```rust
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::thread;

fn main() {
    let kurlar = Arc::new(RwLock::new(HashMap::from([("USD", 41.2), ("EUR", 47.9)])));

    // Bir yazar: kur güncellemesi
    let k = Arc::clone(&kurlar);
    thread::spawn(move || {
        k.write().unwrap().insert("USD", 41.5);
    })
    .join()
    .unwrap();

    // Birçok okuyucu: aynı anda okuyabilirler
    let mut okuyucular = Vec::new();
    for tutar in [100.0, 250.0, 1000.0] {
        let k = Arc::clone(&kurlar);
        okuyucular.push(thread::spawn(move || {
            let tablo = k.read().unwrap();
            tutar * tablo["USD"]
        }));
    }
    for o in okuyucular {
        println!("{:.1} TL", o.join().unwrap());
    }
}
```

`RwLock` de `Mutex` gibi zehirlenebilir ve tekrar girilebilir değildir (aynı thread'de `read()`
tutarken `write()` istemek kilitlenir). `Mutex`'ten biraz daha karmaşık olduğu için kısa okumalarda her
zaman daha hızlı değildir; ayrıca yazarların okuyucular arasında sırasını ne zaman alacağı işletim sistemine
bağlıdır. Kural: okumalar **baskın ve görece uzunsa** `RwLock`, emin değilsen `Mutex`.

```quiz
question: Hangi durumda `RwLock` `Mutex`'e göre en belirgin avantajı sağlar?
options:
  - 8 thread'in sürekli aynı sayacı artırdığı bir ziyaretçi sayacı
  - 16 thread'in saniyede binlerce kez okuduğu, dakikada bir güncellenen bir ayar tablosu
  - İki thread'in sırayla birbirine iş verdiği bir üretici-tüketici kuyruğu
answer: 1
explanation: |
  `RwLock`'ın gücü **eşzamanlı okumalardır**: ayar tablosunu 16 thread aynı anda okuyabilir, yalnızca
  nadir güncellemeler sırayı bekler. Sürekli yazılan bir sayaçta her erişim zaten yazmadır; `RwLock` bir
  şey kazandırmaz (orada birazdan göreceğin atomikler daha iyi). Üretici-tüketici ise kanalların işidir.
feedback:
  - Her işlem bir yazma; `RwLock` burada `Mutex`'ten farksızdır, hatta biraz yavaştır. Sayaç için atomik kullan.
  - Doğru! Okuma baskın, yazma nadir → `RwLock`.
  - Bu bir iş akışı; kanal daha doğal bir araç.
```

## Atomikler: kilitsiz tek değerler

Paylaşılan durum tek bir **sayı** ya da **bayraktan** ibaretse kilide gerek yoktur. `std::sync::atomic`
modülündeki **atomik tipler** (`AtomicUsize`, `AtomicI64`, `AtomicBool`, `AtomicU32`...) işlemcinin özel
komutlarını kullanarak "oku-değiştir-yaz" işlemini **bölünmez (atomic)** bir adımda yapar. `Arc`'ın
referans sayacı da tam olarak böyle bir atomiktir.

Önce küçük bir tahmin:

```predict
code: |
  use std::sync::atomic::{AtomicUsize, Ordering};

  fn main() {
      let sayac = AtomicUsize::new(5);
      let eski = sayac.fetch_add(3, Ordering::Relaxed);
      sayac.fetch_sub(1, Ordering::Relaxed);
      println!("{eski} {}", sayac.load(Ordering::Relaxed));
  }
options:
  - "5 7"
  - "8 7"
  - "8 8"
  - "5 8"
answer: 0
explanation: |
  `fetch_add(3)` değeri atomik olarak 3 artırır ve **önceki** değeri döndürür: `eski = 5`, sayaç `8`.
  `fetch_sub(1)` sayacı `7` yapar. `load` güncel değeri okur: `7`. "Önceki değeri döndürme" özelliği
  çok işe yarar: ör. her thread'e `fetch_add(1)` ile benzersiz bir sıra numarası dağıtabilirsin.
  Dikkat: `sayac` `mut` değil! Atomikler `&self` ile değişir; bu da bir **iç değişkenlik** örneği (Modül 17).
```

`Arc<Mutex<i32>>` ile yazdığımız sayacın atomik hâli:

```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

fn main() {
    let indirme = Arc::new(AtomicUsize::new(0));
    let mut tutamaclar = Vec::new();

    for _ in 0..8 {
        let indirme = Arc::clone(&indirme);
        tutamaclar.push(thread::spawn(move || {
            for _ in 0..1000 {
                indirme.fetch_add(1, Ordering::Relaxed);
            }
        }));
    }
    for t in tutamaclar {
        t.join().unwrap();
    }
    println!("Toplam indirme: {}", indirme.load(Ordering::Relaxed));
}
```

Her zaman `8000`. Atomiklerin `new` fonksiyonu `const` olduğu için bir **`static`** (Modül 2) içinde de
kullanılabilirler; o zaman `Arc`'a bile gerek kalmaz:
`static ZIYARET: AtomicUsize = AtomicUsize::new(0);` ve her yerden `ZIYARET.fetch_add(1, Ordering::Relaxed)`.

Atomik **tek işlemleri** bölünmezdir, işlem **dizileri** değil. Yaygın bir hata:

````quiz
question: |
  Bu fonksiyonu 8 thread aynı `bilet` sayacıyla 1000'er kez çağırıyor. Ne olur?

  ```rust
  fn bilet_sat(bilet: &AtomicUsize) {
      let simdiki = bilet.load(Ordering::SeqCst);
      bilet.store(simdiki + 1, Ordering::SeqCst);
  }
  ```
options:
  - Sonuç her zaman 8000 olur, çünkü her işlem atomik ve en güçlü sıralama (`SeqCst`) kullanılıyor
  - "Derlenmez: `store` için `&mut AtomicUsize` gerekir"
  - Sonuç çoğu zaman 8000'den az olur; iki thread aynı değeri okuyup aynı sonucu yazabilir (yarış durumu)
answer: 2
explanation: |
  `load` ve `store` **ayrı ayrı** atomiktir ama ikisinin arasına başka bir thread girebilir: A `41`'i okur,
  B `41`'i okur, ikisi de `42` yazar; bir satış kaybolur. Bu bir **veri yarışı değildir** (tanımsız
  davranış yok, Rust buna izin verir) ama bir **yarış durumudur** (mantık hatası). Çözüm, oku-değiştir-yaz
  işini tek atomik adımda yapan `fetch_add(1, ...)` ya da daha karmaşık güncellemeler için
  `compare_exchange` / `fetch_update` kullanmaktır.
feedback:
  - Sıralama ne kadar güçlü olursa olsun, iki ayrı işlemin arasına başka thread girebilir.
  - Atomikler `&self` ile değiştirilir (iç değişkenlik); derlenir.
  - Doğru! Bileşik işlemler atomik değildir; `fetch_add` kullan.
````

`AtomicBool` ise thread'lere "dur" demenin en basit yoludur:

```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

fn main() {
    let calis = Arc::new(AtomicBool::new(true));
    let c = Arc::clone(&calis);

    let isci = thread::spawn(move || {
        let mut tur = 0u64;
        while c.load(Ordering::Relaxed) {
            tur += 1; // arka plan işi
            thread::sleep(Duration::from_millis(1));
        }
        tur > 0
    });

    thread::sleep(Duration::from_millis(20));
    calis.store(false, Ordering::Relaxed); // işçiye "dur" de
    println!("işçi en az bir tur çalıştı mı? {}", isci.join().unwrap());
}
```

## Bellek sıralaması: `Ordering` ne anlatıyor?

Her atomik işlemin bir `Ordering` parametresi var. Neden? Çünkü hem derleyici hem işlemci, hızlanmak için
bellek işlemlerini **yeniden sıralayabilir**: tek thread'de sonucu değiştirmediği sürece "önce `a`'yı yaz,
sonra `b`'yi" komutu ters sırada yürüyebilir. Başka bir thread'den bakınca bu yeniden sıralama görünür
hâle gelir. `Ordering`, bir atomik işlemin **çevresindeki diğer bellek işlemleri** hakkında hangi
garantileri verdiğini söyler.

:::warning İki farklı Ordering
`std::sync::atomic::Ordering` (bellek sıralaması: `Relaxed`, `SeqCst`...) ile Modül 9'da `cmp`'nin
döndürdüğü `std::cmp::Ordering` (`Less`, `Equal`, `Greater`) **tamamen farklı** tiplerdir. İkisini aynı
dosyada kullanıyorsan birini `use std::cmp::Ordering as Siralama;` gibi takma adla içe aktar.
:::

| Sıralama | Garanti | Tipik kullanım |
|---|---|---|
| `Relaxed` | Yalnızca **bu** değişken üzerindeki işlem bölünmezdir; çevredeki işlemler hakkında söz yok | Sayaçlar, istatistikler, "kaç tane oldu?" |
| `Release` (yazarken) + `Acquire` (okurken) | `Release` yazmadan **önceki** her şey, o değeri `Acquire` ile okuyan thread'e **görünür** | Bir veriyi hazırlayıp "hazır" bayrağıyla yayımlamak, kilit yazmak |
| `AcqRel` | Oku-değiştir-yaz işlemlerinde ikisi birden | `fetch_add`/`compare_exchange` ile senkronizasyon |
| `SeqCst` | En güçlü: bütün `SeqCst` işlemleri tüm thread'lerin üzerinde anlaştığı **tek bir sırada** görünür | Emin değilsen varsayılan seçim |

`Release`/`Acquire` çiftinin "yayımlama" kalıbı:

```rust
use std::hint;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::thread;

static RAPOR: AtomicU64 = AtomicU64::new(0);
static HAZIR: AtomicBool = AtomicBool::new(false);

fn main() {
    let hazirlayan = thread::spawn(|| {
        RAPOR.store(42, Ordering::Relaxed); // 1) veriyi hazırla
        HAZIR.store(true, Ordering::Release); // 2) "hazır" diye yayımla
    });

    while !HAZIR.load(Ordering::Acquire) {
        hint::spin_loop(); // işlemciye "bekliyorum" ipucu
    }
    // Acquire, Release'ten önceki yazmanın görünmesini garanti eder:
    println!("rapor: {}", RAPOR.load(Ordering::Relaxed));
    hazirlayan.join().unwrap();
}
```

Bu program her zaman `rapor: 42` yazar. Her şeyi `Relaxed` yapsaydık, bazı işlemcilerde (ör. ARM)
okuyucu `HAZIR`'ı `true` görüp `RAPOR`'u hâlâ `0` okuyabilirdi. `static` atomikler `Sync` olduğu için
closure onları `move` olmadan kullanabiliyor: `'static` ömürleri var.

:::deep Daha derine inmek istersen
Bellek modeli, eşzamanlı programlamanın en zor konularından biridir ve Rust, C++20'nin modelini kullanır.
x86 işlemciler doğal olarak güçlü sıralama sağladığı için orada `Relaxed` hataları çoğu zaman görünmez;
aynı kod ARM'da (telefonlar, Apple M serisi) bozulabilir. Bu konuda Rust ekibinden Mara Bos'un
*Rust Atomics and Locks* kitabı (çevrimiçi ücretsiz) en iyi kaynaktır. Pratik tavsiye: sayaçlar için
`Relaxed`, bayrakla veri yayımlamak için `Release`/`Acquire`, emin olmadığın her durumda `SeqCst`, ve
birden fazla değeri birlikte tutarlı tutman gerekiyorsa **atomik değil `Mutex`**.
:::

## Atomik mi, kilit mi, kanal mı?

| İhtiyaç | Araç |
|---|---|
| Tek bir sayaç, toplam, bayrak, sıra numarası | **Atomik** (`fetch_add`, `load`/`store`) |
| Birlikte tutarlı kalması gereken birden çok alan (ör. bakiye + işlem geçmişi) | **`Mutex<T>`** |
| Çok okunan, az yazılan büyük veri | **`RwLock<T>`** |
| Veri bir iş hattında thread'den thread'e akıyor | **Kanal** (`mpsc`) |

```quiz
question: |
  Bir oyun sunucusunda her oyuncunun `can` ve `kalkan` değerleri var; hasar alındığında önce kalkan,
  bitince can düşmeli ve iki değer **asla** tutarsız görünmemeli. Bu iki değeri paylaşmak için en uygun seçim hangisi?
options:
  - "İki ayrı `AtomicU32`: biri can, biri kalkan"
  - "`Mutex<Oyuncu>` (can ve kalkan aynı struct'ta, tek kilit altında)"
  - "`AtomicBool` ile bir \"meşgul\" bayrağı, değerler sıradan alanlarda"
answer: 1
explanation: |
  İki değer bir **değişmez (invariant)** paylaşıyor: birlikte güncellenmeli ve birlikte okunmalı. İki ayrı
  atomikte bir thread kalkanı düşürmüşken henüz canı düşürmemiş olabilir; başka bir thread o arada
  tutarsız bir çift görür. Tek bir `Mutex` her iki alanın güncellemesini tek bir kritik bölgeye koyar.
  "Meşgul bayrağı" ise kendi kilidini elle yazmaya çalışmaktır: hem zor hem hataya açık, üstelik sıradan
  alanları thread'ler arasında değiştirmeye güvenli Rust zaten izin vermez.
feedback:
  - Her atomik tek başına güvenli ama ikisinin **birlikte** tutarlılığı garanti edilmez.
  - Doğru! Birlikte değişmesi gereken veri tek bir kilidin arkasında olmalı.
  - Bu, `Mutex`'i yeniden icat etmektir; güvenli Rust'ta düz alanlar thread'ler arasında bu şekilde paylaşılamaz bile.
```

## Alıştırmalar: derleyiciyi ikna et, kilitsiz say

````exercise
title: Günlük toplayıcıyı thread'lere taşı
difficulty: 2
prompt: |
  Bir stajyer, tek thread'li bir programda çalışan `Rc<RefCell<Vec<String>>>` günlük toplayıcısını
  thread'lere taşımış ama kod derlenmiyor. Paylaşım tiplerini **thread güvenli** karşılıklarıyla
  değiştirerek programı düzelt. Çıktı aynen şu olmalı:

  ```text
  [depo] sayım bitti
  [kargo] paketlendi
  [kasa] gün kapandı
  ```
starter: |
  use std::cell::RefCell;
  use std::rc::Rc;
  use std::thread;

  fn main() {
      let gunluk = Rc::new(RefCell::new(Vec::new()));
      let mut isler = Vec::new();

      for (birim, mesaj) in [("kasa", "gün kapandı"), ("depo", "sayım bitti"), ("kargo", "paketlendi")] {
          let gunluk = Rc::clone(&gunluk);
          isler.push(thread::spawn(move || {
              gunluk.borrow_mut().push(format!("[{birim}] {mesaj}"));
          }));
      }
      for i in isler {
          i.join().unwrap();
      }

      let mut satirlar = gunluk.borrow().clone();
      satirlar.sort();
      for s in satirlar {
          println!("{s}");
      }
  }
starter_compiles: false
solution: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn main() {
      let gunluk = Arc::new(Mutex::new(Vec::new()));
      let mut isler = Vec::new();

      for (birim, mesaj) in [("kasa", "gün kapandı"), ("depo", "sayım bitti"), ("kargo", "paketlendi")] {
          let gunluk = Arc::clone(&gunluk);
          isler.push(thread::spawn(move || {
              gunluk.lock().unwrap().push(format!("[{birim}] {mesaj}"));
          }));
      }
      for i in isler {
          i.join().unwrap();
      }

      let mut satirlar = gunluk.lock().unwrap().clone();
      satirlar.sort();
      for s in satirlar {
          println!("{s}");
      }
  }
check: output
expected_output: |
  [depo] sayım bitti
  [kargo] paketlendi
  [kasa] gün kapandı
hints:
  - "Derleyici önce yalnızca `Rc`'nin `Send` olmadığından şikâyet eder; onu düzeltince sıra `RefCell`'in `Sync` olmamasına gelir. Her birinin thread güvenli karşılığı ne?"
  - "`Rc` → `Arc` (`std::sync::Arc`), `RefCell` → `Mutex` (`std::sync::Mutex`). İçe aktarmaları da güncelle."
  - "`borrow_mut()` ve `borrow()` çağrılarının yerine `lock().unwrap()` gelir."
forbid:
  - pattern: "Rc::|RefCell"
    message: "`Rc` ve `RefCell` tek thread'liktir; onları thread güvenli karşılıklarıyla değiştir."
require:
  - pattern: "Arc::"
    message: "Birden çok sahip için `Arc` kullan."
explanation: |
  Bu, "tek thread'li deseni çok thread'e taşıma" reçetesidir: **`Rc` → `Arc`, `RefCell` → `Mutex`**
  (okuma ağırlıklıysa `RwLock`). Kodun geri kalanı neredeyse aynı kaldı; değişen, bekleme ve sayma
  mekanizmalarının thread güvenli olması.

  Derleyici ilk denemede yalnızca `Rc<..>`'nin `Send` olmadığını söyler. Sadece `Rc`'yi `Arc` yapsaydın
  ikinci bir hata alırdın: `Arc<RefCell<..>>` `Send` değildir çünkü `RefCell` `Sync` değildir. İki
  değişikliği birlikte yapmak gerekiyor.

  `sort()` neden var? Üç thread'in günlüğe yazma sırası belirsiz; çıktıyı deterministik yapmak için
  yazdırmadan önce sıralıyoruz.
````

```exercise
title: Sunucu istatistikleri (kilitsiz)
difficulty: 3
prompt: |
  Bir web sunucusunun işçi thread'leri, işledikleri isteklerin HTTP durum kodlarını sayıyor.
  `istatistik(isciler: Vec<Vec<u16>>) -> (usize, usize)` fonksiyonunu yaz:

  - `isciler[i]`, `i`. işçinin işlediği isteklerin durum kodlarıdır; her işçi **ayrı bir thread**.
  - Paylaşılan iki sayaç kullan: **toplam istek** ve **hata** (durum kodu `400` veya üstü).
  - Sayaçlar `Arc<AtomicUsize>` olsun ve `fetch_add` ile artırılsın; `Mutex` kullanma.
  - `(toplam, hata)` döndür.
starter: |
  use std::sync::Arc;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::thread;

  fn istatistik(isciler: Vec<Vec<u16>>) -> (usize, usize) {
      todo!()
  }

  fn main() {
      let isciler = vec![vec![200, 404, 200], vec![500, 201], vec![302]];
      println!("{:?}", istatistik(isciler));
  }
solution: |
  use std::sync::Arc;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::thread;

  fn istatistik(isciler: Vec<Vec<u16>>) -> (usize, usize) {
      let toplam = Arc::new(AtomicUsize::new(0));
      let hata = Arc::new(AtomicUsize::new(0));
      let mut tutamaclar = Vec::new();

      for kodlar in isciler {
          let toplam = Arc::clone(&toplam);
          let hata = Arc::clone(&hata);
          tutamaclar.push(thread::spawn(move || {
              for kod in kodlar {
                  toplam.fetch_add(1, Ordering::Relaxed);
                  if kod >= 400 {
                      hata.fetch_add(1, Ordering::Relaxed);
                  }
              }
          }));
      }
      for t in tutamaclar {
          t.join().unwrap();
      }

      (toplam.load(Ordering::Relaxed), hata.load(Ordering::Relaxed))
  }

  fn main() {
      let isciler = vec![vec![200, 404, 200], vec![500, 201], vec![302]];
      println!("{:?}", istatistik(isciler));
  }
check: tests
tests: |
  #[test]
  fn kucuk_ornek() {
      let isciler = vec![vec![200, 404, 200], vec![500, 201], vec![302]];
      assert_eq!(istatistik(isciler), (6, 2), "6 istek var; 404 ve 500 hata sayılmalı");
  }

  #[test]
  fn sinir_degerleri() {
      assert_eq!(istatistik(vec![vec![399, 400], vec![599]]), (3, 2), "399 hata değil, 400 ve üstü hatadır");
  }

  #[test]
  fn cok_isci_cok_istek() {
      let isciler: Vec<Vec<u16>> = (0..8).map(|i| vec![if i % 2 == 0 { 200 } else { 503 }; 1000]).collect();
      assert_eq!(istatistik(isciler), (8000, 4000), "8 işçi × 1000 istek; yarısı 503 — hiçbir artış kaybolmamalı");
  }

  #[test]
  fn isci_yoksa() {
      assert_eq!(istatistik(vec![]), (0, 0), "işçi yoksa sayaçlar sıfır kalmalı");
      assert_eq!(istatistik(vec![vec![], vec![]]), (0, 0), "boş işçiler sayaçları değiştirmemeli");
  }
hints:
  - "İki sayaç oluştur: `let toplam = Arc::new(AtomicUsize::new(0));` ve aynısı `hata` için. Her işçi için ikisini de `Arc::clone` et."
  - "Thread içinde her kod için `toplam.fetch_add(1, Ordering::Relaxed);`, `kod >= 400` ise `hata` için de aynısı. Sayaçlar `mut` olmak zorunda değil!"
  - "Bütün tutamaçları `join` ettikten sonra `(toplam.load(Ordering::Relaxed), hata.load(Ordering::Relaxed))` döndür."
forbid:
  - pattern: "Mutex"
    message: Bu alıştırmada kilit yok — atomik sayaçlarla çöz.
require:
  - pattern: "fetch_add"
    message: "Sayaçları `fetch_add` ile atomik olarak artır."
explanation: |
  Her sayaç tek bir sayı olduğu ve iki sayacın birbirine bağlı bir değişmezi olmadığı için atomikler ideal:
  kilit yok, bekleme yok, sadece donanım düzeyinde bölünmez artışlar.

  Neden `Relaxed` yeterli? Sayaçlardan sadece **sonunda** okuyoruz ve okumadan önce bütün thread'leri
  `join` ettik. `join`'in kendisi bir senkronizasyon noktasıdır: thread'in yaptığı her şey `join`'den sonra
  ana thread'e görünür. Bu yüzden ek sıralama garantisine ihtiyaç yok.

  Bir incelik: işlem sürerken başka bir thread `toplam` ve `hata`'yı okusaydı, `toplam` artmış ama `hata`
  henüz artmamış bir an yakalayabilirdi (ör. `(5, 1)` yerine `(5, 0)`). İstatistik için bu kabul edilebilir;
  iki değerin her an birbirine tutarlı görünmesi gerekseydi tek bir `Mutex<(usize, usize)>` gerekirdi.

  Alternatif ve daha hızlı tasarım: her thread kendi yerel `(toplam, hata)` çiftini sayıp `join` ile
  döndürsün, ana thread toplasın. Paylaşılan durum ne kadar azsa çekişme de o kadar az olur.
```

## Özet

:::remember
- **`Send`**: sahiplik başka thread'e taşınabilir. **`Sync`**: `&T` thread'ler arasında paylaşılabilir (`T: Sync` ⇔ `&T: Send`).
- İkisi de **otomatik trait**: bütün alanlar uygunsa tip de uygun; tek bir `Rc` alanı tipi `Send` olmaktan çıkarır.
- `Rc` ikisi de değil; `RefCell`/`Cell` `Sync` değil; `Arc<T>` `Send` olması için `T: Send + Sync` ister.
- `RwLock`: aynı anda çok okuyucu (`read`) ya da tek yazar (`write`) → okuma ağırlıklı veri için.
- Atomikler (`AtomicUsize`, `AtomicBool`): `fetch_add`, `load`, `store` kilitsiz ve `&self` ile çalışır; `load` + `store` dizisi atomik **değildir**.
- `Ordering`: sayaçlar için `Relaxed`, yayımlama için `Release`/`Acquire`, emin değilsen `SeqCst`.
- Birlikte tutarlı kalması gereken birden çok değer → atomik değil, `Mutex`.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — Rust derleyicisi thread'leri "bilmediği" hâlde veri yarışlarını nasıl
  derleme zamanında engelleyebiliyor?
answer: |
  Engelleme iki parçanın birleşiminden doğuyor. Birincisi sahiplik ve ödünç alma kuralları: bir değeri
  değiştirmek için ya sahibi olmalısın ya da `&mut` tutmalısın ve `&mut` tek olmalıdır. İkincisi `Send`
  ve `Sync` işaret trait'leri: `thread::spawn` gibi API'ler imzalarında `Send` şartı koyar; `Rc`, `RefCell`
  ve ham işaretçiler gibi güvensiz tipler bu trait'leri uygulamaz ve otomatik trait kuralıyla onları içeren
  her tip de güvensiz sayılır. Sonuç: thread'ler arasında paylaşılan veriyi değiştirmenin tek yolu `Mutex`,
  `RwLock` ya da atomikler gibi senkronizasyon sağlayan tiplerden geçer. Her şey sıradan tip denetimiyle olur.
```

```flashcards
- front: "`T: Send` ne anlama gelir?"
  back: "`T` tipindeki bir değerin sahipliği başka bir thread'e güvenle taşınabilir."
- front: "`T: Sync` ne anlama gelir?"
  back: "`&T` birden çok thread'de aynı anda güvenle kullanılabilir; yani `&T: Send`."
- front: "Bir struct'ın alanlarından biri `Rc<String>` ise struct `Send` olur mu? Neden?"
  back: "Hayır. `Send` otomatik bir trait'tir; tek bir `Send` olmayan alan bütün struct'ı `Send` olmaktan çıkarır."
- front: "`Arc<RefCell<T>>` neden thread'e gönderilemez?"
  back: "`Arc<T>`'nin `Send` olması için `T: Sync` gerekir; `RefCell` `Sync` değildir."
- front: "`RwLock` hangi kuralı uygular?"
  back: "Aynı anda ya istediğin kadar okuyucu (`read`) ya da tek bir yazar (`write`), Modül 5'teki ödünç kuralının çalışma zamanı ve thread'ler arası hâli."
- front: "`fetch_add(n, ...)` ne döndürür?"
  back: Artırmadan **önceki** değeri; artırma tek bölünmez adımda yapılır.
- front: "`let x = a.load(..); a.store(x + 1, ..);` neden güvenilir bir sayaç değildir?"
  back: İki işlemin arasına başka bir thread girip aynı değeri okuyabilir; artışlar kaybolur. `fetch_add` kullanılmalı.
- front: "Hangi bellek sıralaması basit bir sayaç için yeterlidir, hangisi \"veri hazır\" bayrağı için gerekir?"
  back: "Sayaç: `Relaxed`. Veri yayımlama: yazarken `Release`, okurken `Acquire` (emin değilsen `SeqCst`)."
