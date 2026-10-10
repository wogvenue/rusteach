---
id: m26-l04
title: "Final projesi 2: İş parçacığı havuzu (ThreadPool)"
minutes: 28
type: project
objectives:
  - "`ThreadPool::new` ve `execute` API'sini önce tasarlayıp derleyici hatalarıyla adım adım gerçekleyebilmek"
  - "İşleri `Box<dyn FnOnce() + Send + 'static>` olarak bir kanala koyup `Arc<Mutex<Receiver>>` ile worker'lara dağıtabilmek"
  - "`Drop` içinde göndericiyi kapatıp worker'ları `join` ederek zarif kapanma kurabilmek"
  - Havuzu ağ olmadan bir sayaçla test edip web sunucusuna bağlayabilmek
keywords: [ThreadPool, Worker, JoinHandle, mpsc, "Arc<Mutex<Receiver>>", "Box<dyn FnOnce>", Drop, zarif kapanma, graceful shutdown, proje]
---

Önceki derste tek thread'li sunucunun zaafını gördün: Yavaş bir istek, arkasındaki herkesi bekletiyor.
Her bağlantıya yeni bir thread açmak ise kapıyı sonsuz sayıda misafire açmak demek. Bu derste ikisinin
ortasını kuracaksın: **sabit sayıda** thread'in, bir kuyruktan sırayla iş çektiği bir **iş parçacığı havuzu
(thread pool)**.

Bu proje Modül 14'ten (closure'lar, `FnOnce`), Modül 17'den (`Box`, `Drop`), Modül 18'den (thread'ler,
kanallar, `Arc<Mutex<T>>`, `Send`) ve Modül 20'den (trait nesneleri) birer parçayı aynı anda kullanıyor.
Şimdiye kadarki en "Rust'ça" kodun olacak.

:::ferris
Bu ders yolculuğunun final sınavı gibi: Her satırda daha önce öğrendiğin bir şeyi göreceksin. Bir yerde
takılırsan, hatırlatılan modüle dönmekten çekinme. 🦀
:::

## Önce API'yi tasarla

Gerçekleştirmeye nereden başlarsın? Rust topluluğunda sevilen bir yöntem: **Önce kullanmak istediğin kodu
yaz, sonra derleyicinin hatalarını tek tek düzelt.** Buna **derleyici güdümlü geliştirme (compiler-driven
development)** denir. Modül 13'teki TDD'nin kardeşidir: Orada başarısız bir test seni yönlendiriyordu,
burada derleyici hatası.

Sunucunun `main`'inde görmek istediğimiz kod şu:

```rust,ignore
let havuz = ThreadPool::new(4);
for akis in dinleyici.incoming() {
    let akis = akis.unwrap();
    havuz.execute(|| {
        baglanti_isle(akis);
    });
}
```

Sadece `ThreadPool::new(4)` ve `execute(closure)`. `execute`'u bilerek `thread::spawn`'a benzettik:
Kullanıcı zaten o API'yi biliyor. İlk derlemede derleyici bize ilk eksiği söylüyor:

:::error
```text
error[E0599]: no associated function or constant named `new` found for struct `ThreadPool` in the current scope
 --> src/main.rs:4:29
  |
1 | pub struct ThreadPool;
  | --------------------- associated function or constant `new` not found for this struct
...
4 |     let havuz = ThreadPool::new(4);
  |                             ^^^ associated function or constant not found in `ThreadPool`
```
Tip var ama `new` yok. Ekleyince sıradaki hata `execute` için gelecek. Her hata bir sonraki adımı söyler.
:::

`execute` imzası için standart kütüphaneye bakarız. `thread::spawn` şöyle tanımlı:

```rust,ignore
pub fn spawn<F, T>(f: F) -> JoinHandle<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
```

Bizim işlerimiz bir değer döndürmüyor, bu yüzden `F: FnOnce() + Send + 'static` yeterli. Hataları
susturmanın en kısa yolu, işi hemen çağıranın thread'inde çalıştıran bir sahte gerçekleme. API'nin
şeklini kilitler; paralellik henüz yok:

```rust
struct ThreadPool;

impl ThreadPool {
    fn new(_boyut: usize) -> ThreadPool {
        ThreadPool
    }

    fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        f(); // şimdilik: hemen, çağıranın thread'inde çalıştır
    }
}

fn main() {
    let havuz = ThreadPool::new(4);
    for siparis in ["2 çay", "1 simit", "3 poğaça"] {
        havuz.execute(move || println!("hazırlanıyor: {siparis}"));
    }
    println!("tüm siparişler alındı");
}
```

Program derleniyor ve çalışıyor, ama siparişler hâlâ sırayla hazırlanıyor. Şimdi imzadaki üç sınırın
neden orada olduğunu düşün:

```quiz
question: "`execute<F>(&self, f: F)` imzasındaki `F: FnOnce() + Send + 'static` sınırlarından hangisinin gerekçesi **yanlış** verilmiş?"
options:
  - "`FnOnce`: Her iş tam olarak bir kez çalıştırılacak; closure yakaladığı değerleri (ör. `TcpStream`) tüketebilmeli"
  - "`Send`: Closure, oluşturulduğu thread'den bir worker thread'ine taşınacak"
  - "`'static`: Closure programın sonuna kadar bellekte kalmak zorunda"
  - "Üçü de doğru gerekçelendirilmiş"
answer: 2
explanation: |
  `'static` sınırı "sonsuza kadar yaşar" demek **değildir**. "Bu closure, ödünç aldığı kısa ömürlü bir
  referans **içermez**" demektir (Modül 12). Sahipli bir `String`'i ya da `TcpStream`'i taşıyan bir closure
  `'static`'tir ve iş bitince hemen drop edilir. Sınır gereklidir çünkü havuzdaki thread işi ne zaman
  çalıştıracağını bilmeyiz; `execute`'u çağıran fonksiyon çoktan bitmiş olabilir.

  `FnOnce` en esnek seçimdir: `Fn` ve `FnMut` closure'lar da `FnOnce`'tır (Modül 14). Böylece en çok
  closure'ı kabul ederiz.
feedback:
  - "Bu doğru: `FnOnce` en geniş closure kümesini kabul eder ve tüketmeye izin verir."
  - "Bu doğru: Başka thread'e geçen her değer `Send` olmalı (Modül 18)."
  - "Doğru cevap bu. `'static` bir **yaşam süresi sınırıdır**: Closure kısa ömürlü referans tutamaz. Değerin kendisi istediği zaman drop edilebilir."
  - "Seçeneklerden biri `'static`'i yanlış yorumluyor."
```

Bu sınırın pratikte ne demek olduğunu görelim:

```compiles
question: "(Modül 14 ve 18 tekrarı) Derlenir mi?"
code: |
  struct ThreadPool;

  impl ThreadPool {
      fn execute<F>(&self, f: F)
      where
          F: FnOnce() + Send + 'static,
      {
          std::thread::spawn(f);
      }
  }

  fn main() {
      let havuz = ThreadPool;
      let siparis = String::from("2 çay");
      havuz.execute(|| println!("{siparis}"));
  }
answer: false
error: E0373
explanation: |
  Closure `siparis`'i **ödünç alıyor** (`println!` için `&siparis` yeterli). Ama `F: 'static` sınırı, closure'ın
  `main`'in yerel değişkenine işaret eden bir referans tutmasını yasaklıyor; iş, `main` bittikten sonra
  çalışabilir. Derleyicinin önerisi Modül 18'deki gibi: `move || ...` ile `siparis`'in sahipliğini
  closure'a taşı. `thread::spawn` ile aynı hata kodu (E0373), çünkü aynı sınır.
```

:::analogy Mutfak, aşçılar ve fiş askısı
Bir lokantanın mutfağını düşün. Garson her siparişi bir **fişe** yazıp **askıya** asıyor (`execute`). Mutfakta
sabit sayıda **aşçı** var (worker'lar). Boşta olan aşçı askıdan sıradaki fişi alıyor, yemeği yapıyor, sonra
yeni fiş almaya dönüyor. Her müşteri için yeni aşçı işe alınmıyor (sınırsız thread), tek aşçı da bütün
salona yetişmeye çalışmıyor (tek thread). Askıya aynı anda sadece bir aşçı uzanabiliyor (`Mutex`). Akşam
kapanışta garson yeni fiş asmayı bırakıyor (kanalı kapatma), aşçılar ellerindeki işi bitirip çıkıyor
(`join`).
:::

## İşleri taşımak: kanal ve `Box<dyn FnOnce>`

Neden `thread::spawn`'ı `execute`'un içinde her seferinde çağırmıyoruz? Çünkü o zaman her iş yeni bir thread
olurdu. Havuzda thread'ler **önceden**, `new` içinde açılır. Ama `thread::spawn` bir closure'ı **hemen**
çalıştırmaya başlar; açılış anında henüz iş yoktur. Demek ki worker thread'leri bir döngüde **iş beklemeli**
ve işler onlara sonradan **iletilmeli**. Modül 18'den bu işin aracını biliyorsun: **kanal (channel)**.

Peki kanalın tipi ne olacak? `mpsc::Sender<T>` tek bir `T` taşır, ama her closure'ın **kendine özgü, isimsiz
bir tipi** vardır. Çözüm Modül 20'deki trait nesnesi:

```rust
use std::sync::mpsc;
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>; // tip takma adı (Modül 22)

fn main() {
    let (gonderici, alici) = mpsc::channel::<Job>();

    let asci = thread::spawn(move || {
        let mut yapilan = 0;
        for is in alici {
            // kanal kapanana kadar sırayla iş al
            is();
            yapilan += 1;
        }
        yapilan
    });

    let masa = 5;
    gonderici.send(Box::new(move || println!("masa {masa}: 2 çay"))).unwrap();
    gonderici.send(Box::new(|| println!("paket: 1 simit"))).unwrap();
    let siparisler = vec!["tost", "ayran"];
    gonderici
        .send(Box::new(move || println!("masa 2: {}", siparisler.join(" + "))))
        .unwrap();

    drop(gonderici); // fiş asmayı bırak → for döngüsü biter
    println!("aşçı {} iş yaptı", asci.join().unwrap());
}
```

Üç closure'ın üçü de farklı tipte: biri bir `i32` yakalıyor, biri hiçbir şey, biri bir `Vec`. Hepsi
`Box<dyn FnOnce() + Send>` arkasında **aynı tipe** dönüşüp aynı kanaldan geçiyor. `is()` çağrısı kutudaki
closure'ı tüketir; `Box<dyn FnOnce()>` doğrudan çağrılabilir.

Bu örnekte tek bir aşçı var. Havuzda ise **birden çok** worker aynı alıcıyı paylaşmalı. `mpsc` "çok üretici,
**tek tüketici**" demek: `Receiver` klonlanamaz. Paylaşmak için Modül 18'in aracı `Arc` geliyor akla:

```compiles
question: "(Modül 18 tekrarı) İki worker aynı alıcıyı `Arc` ile paylaşıyor. Derlenir mi?"
code: |
  use std::sync::{Arc, mpsc};
  use std::thread;

  fn main() {
      let (gonderici, alici) = mpsc::channel::<u32>();
      let alici = Arc::new(alici);
      let mut workerlar = Vec::new();
      for _ in 0..2 {
          let alici = Arc::clone(&alici);
          workerlar.push(thread::spawn(move || {
              let is = alici.recv();
              println!("{is:?}");
          }));
      }
      gonderici.send(1).unwrap();
      gonderici.send(2).unwrap();
      for w in workerlar {
          w.join().unwrap();
      }
  }
answer: false
error: E0277
explanation: |
  `Arc<T>`'nin başka thread'e gönderilebilmesi (`Send`) için `T`'nin hem `Send` hem `Sync` olması gerekir;
  çünkü `Arc` ile birden çok thread **aynı** `T`'ye aynı anda erişir. `Receiver` `Send`'dir ama `Sync`
  **değildir**: İki thread'in aynı anda `recv` çağırmasına göre tasarlanmamıştır. Çözüm `Mutex`:
  `Mutex<T>`, `T: Send` olduğu sürece `Sync`'tir, çünkü erişimi sıraya sokar. İşte `Arc<Mutex<Receiver<Job>>>`
  böyle doğuyor.
```

:::error
```text
error[E0277]: `std::sync::mpsc::Receiver<u32>` cannot be shared between threads safely
  |
  = help: the trait `Sync` is not implemented for `std::sync::mpsc::Receiver<u32>`
  = note: required for `Arc<std::sync::mpsc::Receiver<u32>>` to implement `Send`
```
Hatayı sondan başa oku: `spawn` closure'ın `Send` olmasını istiyor → closure bir `Arc<Receiver>` taşıyor →
`Arc<Receiver>`'ın `Send` olması için `Receiver`'ın `Sync` olması lazım → değil. Derleyici bir **veri
yarışını (data race)** daha programı çalıştırmadan yakaladı.
:::

Havuz kurulduktan ve iki iş gönderildikten sonra bellek şöyle görünecek:

```memory
title: "ThreadPool::new(3) ve iki execute çağrısı"
steps:
  - caption: "`new(3)`: Bir kanal açıldı, alıcı `Arc<Mutex<..>>` içine kondu ve her worker thread'ine bir `Arc` kopyası verildi. Güçlü sayaç 3."
    stack:
      - frame: main
        vars:
          - { name: havuz, type: ThreadPool, value: "workers · gonderici: Some(..)", to: w }
      - frame: "worker 0 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
      - frame: "worker 1 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
      - frame: "worker 2 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
    heap:
      - { id: w, label: "Vec<Worker>", value: "Worker{id:0, thread} | Worker{id:1, thread} | Worker{id:2, thread}" }
      - { id: a, label: "Arc bloğu", value: "strong=3 | Mutex{kilit: serbest} | Receiver" }
      - { id: k, label: kanal kuyruğu, value: "[ boş ]" }
  - caption: "İki `execute`: Her closure heap'e kutulandı; kuyrukta yalnızca `Box<dyn FnOnce>` şişman işaretçileri (veri + vtable) duruyor."
    stack:
      - frame: main
        vars:
          - { name: havuz, type: ThreadPool, value: "workers · gonderici: Some(..)", to: w }
      - frame: "worker 0 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
      - frame: "worker 1 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
      - frame: "worker 2 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
    heap:
      - { id: w, label: "Vec<Worker>", value: "Worker{id:0, thread} | Worker{id:1, thread} | Worker{id:2, thread}" }
      - { id: a, label: "Arc bloğu", value: "strong=3 | Mutex{kilit: serbest} | Receiver" }
      - { id: k, label: kanal kuyruğu, value: "[ Job(ptr, vtable) | Job(ptr, vtable) ]" }
      - { id: c1, label: closure 1, value: "akis: TcpStream" }
      - { id: c2, label: closure 2, value: "akis: TcpStream" }
  - caption: "Worker 1 kilidi aldı, ilk işi kuyruktan çekti ve **kilidi bıraktı**. Şimdi işi çalıştırıyor; bu sırada worker 0 ikinci işi alabilir."
    stack:
      - frame: main
        vars:
          - { name: havuz, type: ThreadPool, value: "workers · gonderici: Some(..)", to: w }
      - frame: "worker 0 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
      - frame: "worker 1 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
          - { name: is, type: Job, value: "Box<dyn FnOnce>", to: c1, note: çalışıyor }
      - frame: "worker 2 thread'i"
        vars:
          - { name: alici, type: "Arc<Mutex<Receiver<Job>>>", value: "ptr", to: a }
    heap:
      - { id: w, label: "Vec<Worker>", value: "Worker{id:0, thread} | Worker{id:1, thread} | Worker{id:2, thread}" }
      - { id: a, label: "Arc bloğu", value: "strong=3 | Mutex{kilit: serbest} | Receiver" }
      - { id: k, label: kanal kuyruğu, value: "[ Job(ptr, vtable) ]" }
      - { id: c1, label: closure 1, value: "akis: TcpStream" }
      - { id: c2, label: closure 2, value: "akis: TcpStream" }
```

## Worker döngüsü ve kilit tuzağı

Her worker'ın thread'i sonsuz bir döngüde şunu yapacak: kilidi al, kanaldan bir iş çek, **kilidi bırak**,
işi çalıştır. Son iki adımın sırası hayati. Şu iki döngü aynı şeyi yapıyor gibi görünüyor. Tahmin et:

```predict
question: "Bu program ne yazdırır? (`try_lock`, beklemeden kilidi almayı dener; kilit doluysa `Err` döner.)"
code: |
  use std::sync::Mutex;

  fn main() {
      let kuyruk = Mutex::new(vec!["simit", "çay"]);
      while let Some(is) = kuyruk.lock().unwrap().pop() {
          println!("A {is}: {}", kuyruk.try_lock().is_ok());
      }

      let kuyruk = Mutex::new(vec!["simit", "çay"]);
      loop {
          let is = kuyruk.lock().unwrap().pop();
          let Some(is) = is else { break };
          println!("B {is}: {}", kuyruk.try_lock().is_ok());
      }
  }
options:
  - |
    A çay: true
    A simit: true
    B çay: true
    B simit: true
  - |
    A çay: false
    A simit: false
    B çay: true
    B simit: true
  - |
    A çay: false
    A simit: false
    B çay: false
    B simit: false
  - |
    A simit: true
    A çay: true
    B simit: true
    B çay: true
answer: 1
explanation: |
  `kuyruk.lock().unwrap()` bir **geçici değer (temporary)** olan `MutexGuard` üretir ve kilit, guard drop
  edilene kadar tutulur (Modül 18). Geçici değerlerin ne zaman drop edildiği ifadenin türüne bağlıdır:

  - `let is = ...;` satırında geçici guard **satırın sonunda** drop edilir. `B` döngüsünün gövdesinde kilit
    serbesttir.
  - `while let` (ve `if let`) koşulundaki geçici değerler ise **gövdenin sonuna kadar** yaşar. `A`
    döngüsünün gövdesi çalışırken kilit hâlâ tutuluyor.

  `pop` sondan aldığı için önce `çay` gelir. Havuzda bunun anlamı şu: `while let Ok(is) = alici.lock().unwrap().recv() { is(); }`
  yazarsan iş **çalışırken** kilit tutulur ve diğer worker'lar kuyruğa uzanamaz. Kod derlenir, testler
  geçer ama havuz gizlice tek thread'li bir sunucuya döner!
```

Doğru worker, kilidi ayrı bir `let` satırında alıp bırakır. Kanal kapanınca `recv` `Err` döner; bu da
worker'ın çıkış kapısıdır:

```rust
# use std::sync::{Arc, Mutex, mpsc};
# use std::thread;
#
# type Job = Box<dyn FnOnce() + Send + 'static>;
#
struct Worker {
    id: usize,
    thread: thread::JoinHandle<()>,
}

impl Worker {
    fn new(id: usize, alici: Arc<Mutex<mpsc::Receiver<Job>>>) -> Worker {
        let thread = thread::spawn(move || {
            loop {
                let mesaj = alici.lock().unwrap().recv(); // kilit bu satırın sonunda bırakılır
                match mesaj {
                    Ok(is) => is(),
                    Err(_) => break, // tüm göndericiler drop edildi: kanal kapandı
                }
            }
        });
        Worker { id, thread }
    }
}

pub struct ThreadPool {
    workers: Vec<Worker>,
    gonderici: Option<mpsc::Sender<Job>>,
}

impl ThreadPool {
    /// Yeni bir havuz oluşturur.
    ///
    /// # Panics
    ///
    /// `boyut` 0 ise panikler.
    pub fn new(boyut: usize) -> ThreadPool {
        assert!(boyut > 0, "havuz en az bir worker içermeli");
        let (gonderici, alici) = mpsc::channel();
        let alici = Arc::new(Mutex::new(alici));
        let mut workers = Vec::with_capacity(boyut);
        for id in 0..boyut {
            workers.push(Worker::new(id, Arc::clone(&alici)));
        }
        ThreadPool { workers, gonderici: Some(gonderici) }
    }

    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        let is: Job = Box::new(f);
        self.gonderici.as_ref().unwrap().send(is).unwrap();
    }
}
#
# impl Drop for ThreadPool {
#     fn drop(&mut self) {
#         drop(self.gonderici.take());
#         for worker in self.workers.drain(..) {
#             let _ = worker.id;
#             worker.thread.join().unwrap();
#         }
#     }
# }
```

Birkaç tasarım kararı:

- **`assert!(boyut > 0)`**: Sıfır worker'lı bir havuz işleri sonsuza dek bekletir. Bu bir programcı hatası
  olduğu için `panic` uygun (Modül 10) ve doc yorumundaki `# Panics` bölümü bunu belgeliyor (Modül 13).
  Alternatif: `Result<ThreadPool, HavuzHatasi>` döndüren bir `build` fonksiyonu.
- **`Vec::with_capacity(boyut)`**: Kaç worker olacağını biliyoruz; vektör bir kez ayırır (Modül 25).
- **`gonderici: Option<Sender<Job>>`**: Neden `Option`? Bir sonraki adımda, `Drop`'ta göndericiyi
  kapatabilmek için. `execute` içindeki `as_ref().unwrap()` bu yüzden var.
- **`Worker` ayrı bir tip**: `id` ile loglama yapabiliyor, `JoinHandle`'ı saklıyoruz. `JoinHandle<()>`
  çünkü worker thread'i bir değer döndürmüyor.

Eski bir tasarım (The Rust Programming Language kitabının ilk baskıları) worker'ları kanal kapatarak değil,
açık bir **"kapat" mesajıyla** durduruyordu. Şimdi onu kendin yaz:

````exercise
title: Mesajla kapanan, iş sayan worker
difficulty: 3
prompt: |
  Bu sürümde kanaldan `Job` değil `Mesaj` geçiyor:

  ```rust
  enum Mesaj { Is(Job), Kapat }
  ```

  `Worker::new(id, alici)` fonksiyonunu yaz. Worker'ın thread'i bir döngüde:

  1. Kilidi alıp kanaldan **bir** mesaj çeksin ve kilidi **işi çalıştırmadan önce** bıraksın.
  2. `Mesaj::Is(is)` gelirse işi çalıştırıp bir sayacı artırsın.
  3. `Mesaj::Kapat` gelirse **ya da** kanal kapanırsa (`recv` → `Err`) döngüden çıksın. `Kapat`'tan
     sonra kuyrukta kalan işler bu worker tarafından çalıştırılmamalı.
  4. Thread'in dönüş değeri, çalıştırdığı **iş sayısı** olsun; bu yüzden `thread: JoinHandle<usize>`.
starter: |
  use std::sync::{Arc, Mutex, mpsc};
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  enum Mesaj {
      Is(Job),
      Kapat,
  }

  struct Worker {
      id: usize,
      thread: thread::JoinHandle<usize>,
  }

  impl Worker {
      fn new(id: usize, alici: Arc<Mutex<mpsc::Receiver<Mesaj>>>) -> Worker {
          todo!()
      }
  }

  fn main() {
      let (gonderici, alici) = mpsc::channel();
      let alici = Arc::new(Mutex::new(alici));
      let worker = Worker::new(7, Arc::clone(&alici));
      gonderici.send(Mesaj::Is(Box::new(|| println!("çay demlendi")))).unwrap();
      gonderici.send(Mesaj::Kapat).unwrap();
      let sayi = worker.thread.join().unwrap();
      println!("worker {} kapandı, {sayi} iş yaptı", worker.id);
  }
solution: |
  use std::sync::{Arc, Mutex, mpsc};
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  enum Mesaj {
      Is(Job),
      Kapat,
  }

  struct Worker {
      id: usize,
      thread: thread::JoinHandle<usize>,
  }

  impl Worker {
      fn new(id: usize, alici: Arc<Mutex<mpsc::Receiver<Mesaj>>>) -> Worker {
          let thread = thread::spawn(move || {
              let mut calisan = 0;
              loop {
                  let mesaj = alici.lock().unwrap().recv(); // guard bu satırda drop edilir
                  match mesaj {
                      Ok(Mesaj::Is(is)) => {
                          is();
                          calisan += 1;
                      }
                      Ok(Mesaj::Kapat) | Err(_) => break,
                  }
              }
              calisan
          });
          Worker { id, thread }
      }
  }

  fn main() {
      let (gonderici, alici) = mpsc::channel();
      let alici = Arc::new(Mutex::new(alici));
      let worker = Worker::new(7, Arc::clone(&alici));
      gonderici.send(Mesaj::Is(Box::new(|| println!("çay demlendi")))).unwrap();
      gonderici.send(Mesaj::Kapat).unwrap();
      let sayi = worker.thread.join().unwrap();
      println!("worker {} kapandı, {sayi} iş yaptı", worker.id);
  }
check: tests
tests: |
  use std::sync::atomic::{AtomicUsize, Ordering};

  fn kanal() -> (mpsc::Sender<Mesaj>, Arc<Mutex<mpsc::Receiver<Mesaj>>>) {
      let (tx, rx) = mpsc::channel();
      (tx, Arc::new(Mutex::new(rx)))
  }

  fn sayan_is(sayac: &Arc<AtomicUsize>) -> Mesaj {
      let sayac = Arc::clone(sayac);
      Mesaj::Is(Box::new(move || {
          sayac.fetch_add(1, Ordering::SeqCst);
      }))
  }

  #[test]
  fn kapat_mesajinda_durur_ve_sonrakileri_calistirmaz() {
      let (tx, alici) = kanal();
      let sayac = Arc::new(AtomicUsize::new(0));
      for _ in 0..3 {
          tx.send(sayan_is(&sayac)).unwrap();
      }
      tx.send(Mesaj::Kapat).unwrap();
      for _ in 0..2 {
          tx.send(sayan_is(&sayac)).unwrap();
      }
      let w = Worker::new(1, alici);
      let n = w.thread.join().unwrap();
      assert_eq!(n, 3, "Kapat'tan önce 3 iş vardı; thread 3 döndürmeli");
      assert_eq!(sayac.load(Ordering::SeqCst), 3, "Kapat'tan sonraki işler çalıştırılmamalı");
  }

  #[test]
  fn kanal_kapaninca_da_durur() {
      let (tx, alici) = kanal();
      let sayac = Arc::new(AtomicUsize::new(0));
      let w = Worker::new(2, alici);
      for _ in 0..5 {
          tx.send(sayan_is(&sayac)).unwrap();
      }
      drop(tx);
      assert_eq!(w.thread.join().unwrap(), 5, "gönderici drop edilince worker işleri bitirip durmalı");
      assert_eq!(sayac.load(Ordering::SeqCst), 5);
  }

  #[test]
  fn is_calisirken_kilit_serbest() {
      let (tx, alici) = kanal();
      let (sonuc_tx, sonuc_rx) = mpsc::channel();
      let kopya = Arc::clone(&alici);
      let w = Worker::new(3, alici);
      tx.send(Mesaj::Is(Box::new(move || {
          sonuc_tx.send(kopya.try_lock().is_ok()).unwrap();
      })))
      .unwrap();
      tx.send(Mesaj::Kapat).unwrap();
      w.thread.join().unwrap();
      assert!(
          sonuc_rx.recv().unwrap(),
          "iş çalışırken Mutex kilitli kaldı: `while let ... = alici.lock()...` geçici guard'ı gövde boyunca tutar"
      );
  }

  #[test]
  fn iki_worker_isleri_paylasir() {
      let (tx, alici) = kanal();
      let sayac = Arc::new(AtomicUsize::new(0));
      let w1 = Worker::new(10, Arc::clone(&alici));
      let w2 = Worker::new(11, alici);
      for _ in 0..20 {
          tx.send(sayan_is(&sayac)).unwrap();
      }
      tx.send(Mesaj::Kapat).unwrap();
      tx.send(Mesaj::Kapat).unwrap();
      let toplam = w1.thread.join().unwrap() + w2.thread.join().unwrap();
      assert_eq!(toplam, 20, "iki worker'ın saydığı işlerin toplamı 20 olmalı");
      assert_eq!((w1.id, w2.id), (10, 11), "id alanı saklanmalı");
  }
hints:
  - "İskelet: `let thread = thread::spawn(move || { let mut calisan = 0; loop { ... } calisan });` ve sonunda `Worker { id, thread }`. Thread closure'ının son ifadesi `calisan` olduğu için `JoinHandle<usize>` elde edersin."
  - "Döngünün ilk satırı ayrı bir `let` olmalı: `let mesaj = alici.lock().unwrap().recv();`. Böylece `MutexGuard` satır sonunda drop edilir. `while let` kullanırsan kilit iş boyunca tutulur."
  - "`match mesaj { Ok(Mesaj::Is(is)) => { is(); calisan += 1; } Ok(Mesaj::Kapat) | Err(_) => break }`."
explanation: |
  Çözümün kalbi tek satır: `let mesaj = alici.lock().unwrap().recv();`. Guard bu satırın sonunda drop
  edildiği için kilit yalnızca kuyruktan **çekme** anında tutulur, işin **çalıştırılması** sırasında
  tutulmaz. Üçüncü test bunu ölçüyor: İşin içinden `try_lock` deneniyor ve kilit serbest olmalı.

  `Ok(Mesaj::Kapat) | Err(_) => break` iç içe desen ve `|` birleşimiyle (Modül 21) iki çıkış nedenini tek
  kolda topluyor. `loop` bir `break` ile bittiği için ardından gelen `calisan` thread'in dönüş değeri olur;
  `join()` bunu `Result<usize, _>` içinde geri verir (Modül 18).

  Bu tasarımın kapanış maliyeti: Havuz, **her worker için bir** `Kapat` göndermek zorunda. Birazdan bunun
  neden bir tuzak barındırdığını ve kanalı kapatmanın neden daha zarif olduğunu göreceksin.
````

## `Drop` ile zarif kapanma

`main` bittiğinde ya da sunucu kapatıldığında havuza ne olmalı? Ani bir kesinti, yarım kalmış yanıtlar ve
bozuk dosyalar demek. **Zarif kapanma (graceful shutdown)**: yeni iş kabul etme, elindekileri bitir, sonra
çık. Bunun doğal yeri `Drop` (Modül 17): Havuz kapsamdan çıktığı anda kendiliğinden çalışır. İlk deneme:

```compiles
question: "(Modül 4 ve 17 tekrarı) Derlenir mi?"
code: |
  use std::thread;

  struct Worker {
      id: usize,
      thread: thread::JoinHandle<()>,
  }

  struct ThreadPool {
      workers: Vec<Worker>,
  }

  impl Drop for ThreadPool {
      fn drop(&mut self) {
          for worker in &mut self.workers {
              println!("worker {} kapatılıyor", worker.id);
              worker.thread.join().unwrap();
          }
      }
  }

  fn main() {
      let w = Worker { id: 0, thread: thread::spawn(|| {}) };
      let _havuz = ThreadPool { workers: vec![w] };
  }
answer: false
error: E0507
explanation: |
  `JoinHandle::join(self)` tanıtıcıyı **tüketir** (sahipliğini alır). Ama `drop(&mut self)` bize yalnızca
  değişebilir bir **referans** veriyor; ödünç alınmış bir şeyin içinden değer taşıyamazsın.
```

:::error
```text
error[E0507]: cannot move out of `worker.thread` which is behind a mutable reference
   --> src/main.rs:16:13
    |
 16 |             worker.thread.join().unwrap();
    |             ^^^^^^^^^^^^^ ------ `worker.thread` moved due to this method call
    |             |
    |             move occurs because `worker.thread` has type `JoinHandle<()>`, which does not implement the `Copy` trait
    |
note: `std::thread::JoinHandle::<T>::join` takes ownership of the receiver `self`, which moves `worker.thread`
    |
149 |     pub fn join(self) -> Result<T> {
    |                 ^^^^
```
Not satırı anahtarı veriyor: `join` `self` alıyor. Bir referansın arkasından değer çıkarmanın iki
klasik yolu var: `Option` içinde tutup `take()` ile almak (değerin yerine `None` bırakır) ya da
koleksiyonu `drain(..)` ile boşaltmak (elemanları **sahipli** olarak verir, vektörü boş bırakır).
:::

İki adımın **sırası** da hayati:

1. **Önce göndericiyi drop et.** `self.gonderici.take()` göndericiyi `Option`'dan çıkarır; `drop` edince
   kanal kapanır. Kuyruktaki işler yine de alınır. Kuyruk boşalınca her worker'ın `recv`'i `Err` döner ve
   döngülerden çıkılır.
2. **Sonra her worker'ı `join` et.** Bu, işlerin bitmesini bekler.

Sırayı ters çevirirsen ne olur? İlk `join`, gönderici hâlâ açık olduğu için sonsuza dek `recv`'de bekleyen
bir worker'ı bekler. Program **kilitlenir (deadlock)**.

````quiz
question: |
  Alıştırmadaki `Kapat` mesajlı tasarımda, 4 worker'lı bir havuzun `drop` metodu şöyle yazılmış:

  ```text
  for worker in self.workers.drain(..) {
      gonderici.send(Mesaj::Kapat).unwrap();
      worker.thread.join().unwrap();
  }
  ```

  Ne olabilir?
options:
  - Her şey yolunda; her worker kendi `Kapat` mesajını alıp kapanır
  - "Kilitlenebilir: Worker 0 için gönderilen `Kapat`'ı worker 2 alabilir; worker 0 hiç `Kapat` almadığı için `join` sonsuza dek bekler"
  - "Derlenmez, çünkü `drain` `&mut self` ile kullanılamaz"
  - Panik olur, çünkü bir worker iki `Kapat` alır
answer: 1
explanation: |
  Kanal **hangi** worker'ın mesajı alacağını seçmez; boşta olan herhangi biri alır. Gönder-bekle-gönder-bekle
  sırası bu yüzden kırılgan. Kitabın eski sürümündeki çözüm, önce **bütün** `Kapat` mesajlarını gönderip
  **sonra** hepsini `join` etmekti.

  Göndericiyi drop etmek bu sorunu kökten çözer: Kapanmış bir kanal **bütün** bekleyen worker'lara aynı anda
  `Err` döndürür; kaç worker olduğunu saymaya gerek kalmaz. "Mesaj say" yerine "kanalı kapat" fikri,
  kanalların sahiplik semantiğinin bir hediyesidir.
feedback:
  - "Mesajın hangi worker'a gideceğini kanal belirler, biz değil."
  - Doğru!
  - "`drain(..)` `&mut Vec` ister; `&mut self` üzerinden `self.workers`'a erişmek tam olarak bunu sağlar."
  - Bir worker ilk `Kapat`'ta döngüden çıkar; ikinciyi alamaz.
````

```fill
prompt: |
  Zarif kapanmayı tamamla: Önce göndericiyi `Option`'dan **çıkarıp** drop et, sonra worker'ları
  vektörden **sahipli olarak** alıp `join` et.
code: |
  use std::sync::mpsc;
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  struct Worker {
      id: usize,
      thread: thread::JoinHandle<()>,
  }

  struct ThreadPool {
      workers: Vec<Worker>,
      gonderici: Option<mpsc::Sender<Job>>,
  }

  impl Drop for ThreadPool {
      fn drop(&mut self) {
          drop(self.gonderici.___0());
          for worker in self.workers.___1(..) {
              worker.thread.___2().unwrap();
              println!("worker {} kapandı", worker.id);
          }
      }
  }

  fn main() {
      let (gonderici, _alici) = mpsc::channel::<Job>();
      let w = Worker { id: 0, thread: thread::spawn(|| {}) };
      let havuz = ThreadPool { workers: vec![w], gonderici: Some(gonderici) };
      drop(havuz);
      println!("havuz kapandı");
  }
blanks:
  - ["take"]
  - ["drain"]
  - ["join"]
output: |
  worker 0 kapandı
  havuz kapandı
explanation: |
  `Option::take` değeri çıkarıp yerine `None` koyar; böylece `&mut self` üzerinden sahipliği alabiliriz.
  `drop(...)` göndericiyi hemen yok eder ve kanal kapanır. `drain(..)` vektörün bütün elemanlarını
  **sahipli** olarak veren bir iterator'dır; `worker.thread.join()` artık bir referansın arkasından değil,
  sahip olduğumuz bir değerden taşıma yapıyor. Alternatif: `thread: Option<JoinHandle<()>>` yapıp
  `worker.thread.take()` ile almak (kitabın bir önceki sürümü böyleydi).
```

## Havuzu sına ve sunucuya bağla

Ağ olmadan havuzu sınamanın en iyi yolu bir **sayaç**: 1'den 100'e kadar sayıları ayrı işler olarak
toplayan 4 worker. Sonuç her çalıştırmada aynı olmalı: 5050. Bütün parçalar bir arada:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;

struct Worker {
    id: usize,
    thread: thread::JoinHandle<()>,
}

impl Worker {
    fn new(id: usize, alici: Arc<Mutex<mpsc::Receiver<Job>>>) -> Worker {
        let thread = thread::spawn(move || {
            loop {
                let mesaj = alici.lock().unwrap().recv();
                match mesaj {
                    Ok(is) => is(),
                    Err(_) => break,
                }
            }
        });
        Worker { id, thread }
    }
}

pub struct ThreadPool {
    workers: Vec<Worker>,
    gonderici: Option<mpsc::Sender<Job>>,
}

impl ThreadPool {
    pub fn new(boyut: usize) -> ThreadPool {
        assert!(boyut > 0, "havuz en az bir worker içermeli");
        let (gonderici, alici) = mpsc::channel();
        let alici = Arc::new(Mutex::new(alici));
        let mut workers = Vec::with_capacity(boyut);
        for id in 0..boyut {
            workers.push(Worker::new(id, Arc::clone(&alici)));
        }
        ThreadPool { workers, gonderici: Some(gonderici) }
    }

    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        self.gonderici.as_ref().unwrap().send(Box::new(f)).unwrap();
    }
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
        drop(self.gonderici.take());
        for worker in self.workers.drain(..) {
            worker.thread.join().unwrap();
            println!("worker {} kapandı", worker.id);
        }
    }
}

fn main() {
    let toplam = Arc::new(AtomicUsize::new(0));
    let havuz = ThreadPool::new(4);
    for i in 1..=100 {
        let toplam = Arc::clone(&toplam);
        havuz.execute(move || {
            toplam.fetch_add(i, Ordering::Relaxed);
        });
    }
    drop(havuz); // zarif kapanma: bütün işler bitene kadar bekler
    println!("toplam = {}", toplam.load(Ordering::Relaxed));
}
```

Çıktının deterministik olduğuna dikkat et. İşlerin **hangi** worker'da çalıştığı her seferinde değişir, ama
`drop(havuz)` bütün işlerin bittiğini garanti ettiği için toplam her zaman 5050'dir. Kapanış mesajları da
sıralı, çünkü `join`'ler sırayla yapılıyor. `drop(havuz)` satırını silip `println!`'i havuz hâlâ
yaşarken çalıştırırsan, toplamın 5050'den küçük çıkabildiğini görürsün. Dene!

Sunucuya bağlamak artık birkaç satır. `ThreadPool`'u `src/lib.rs`'e taşı (Modül 15'teki ince `main.rs`
deseni) ve `main.rs`'i şöyle değiştir:

```rust,norun,title=src/main.rs
# mod merhaba_sunucu {
#     use std::sync::{Arc, Mutex, mpsc};
#     use std::thread;
#     type Job = Box<dyn FnOnce() + Send + 'static>;
#     pub struct ThreadPool { workers: Vec<thread::JoinHandle<()>>, gonderici: Option<mpsc::Sender<Job>> }
#     impl ThreadPool {
#         pub fn new(boyut: usize) -> ThreadPool {
#             let (gonderici, alici) = mpsc::channel::<Job>();
#             let alici = Arc::new(Mutex::new(alici));
#             let workers = (0..boyut).map(|_| { let a = Arc::clone(&alici); thread::spawn(move || loop {
#                 let m = a.lock().unwrap().recv();
#                 match m { Ok(is) => is(), Err(_) => break }
#             }) }).collect();
#             ThreadPool { workers, gonderici: Some(gonderici) }
#         }
#         pub fn execute<F: FnOnce() + Send + 'static>(&self, f: F) {
#             self.gonderici.as_ref().unwrap().send(Box::new(f)).unwrap();
#         }
#     }
#     impl Drop for ThreadPool {
#         fn drop(&mut self) {
#             drop(self.gonderici.take());
#             for w in self.workers.drain(..) { w.join().unwrap(); }
#         }
#     }
# }
use merhaba_sunucu::ThreadPool;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::Duration;

fn yanit(durum: &str, govde: &str) -> String {
    let uzunluk = govde.len();
    format!("HTTP/1.1 {durum}\r\nContent-Length: {uzunluk}\r\n\r\n{govde}")
}

fn baglanti_isle(mut akis: TcpStream) {
    let Some(Ok(istek_satiri)) = BufReader::new(&akis).lines().next() else {
        return;
    };
    let cevap = match istek_satiri.as_str() {
        "GET / HTTP/1.1" => yanit("200 OK", "<h1>Merhaba!</h1>"),
        "GET /uyu HTTP/1.1" => {
            thread::sleep(Duration::from_secs(5));
            yanit("200 OK", "<h1>Günaydın!</h1>")
        }
        _ => yanit("404 Not Found", "<h1>Sayfa bulunamadı</h1>"),
    };
    let _ = akis.write_all(cevap.as_bytes());
}

fn main() {
    let dinleyici = TcpListener::bind("127.0.0.1:7878").expect("7878 portu kullanımda olabilir");
    let havuz = ThreadPool::new(4);

    // Kapanışı görmek için yalnızca 6 bağlantı kabul et; gerçek sunucuda .take(6) olmaz.
    for akis in dinleyici.incoming().take(6) {
        match akis {
            Ok(akis) => havuz.execute(|| baglanti_isle(akis)),
            Err(e) => eprintln!("bağlantı hatası: {e}"),
        }
    }
    println!("Kapanıyor...");
} // havuz burada drop edilir → zarif kapanma
```

`execute(|| baglanti_isle(akis))` neden `move` olmadan derleniyor? `baglanti_isle` `akis`'i **değer olarak**
istiyor; closure onu tüketmek zorunda olduğu için derleyici `akis`'i zaten taşıyarak yakalıyor (Modül 14).
Şimdi deneyi tekrarla: Bir sekmede `/uyu`, diğerinde `/`. İkinci sekme anında açılır, çünkü başka bir worker
boştadır. Aynı anda beşinci bir `/uyu` gelirse o kuyrukta bekler: Havuz **sınırlıdır** ve bu bir özelliktir.

```quiz
question: "(Modül 19 tekrarı) Sunucuna aynı anda 10.000 yavaş istemci bağlanıyor ve her biri verisini çok yavaş gönderiyor. 4 worker'lı havuzun ne olur, sektör bu sorunu genelde nasıl çözer?"
options:
  - Sorun olmaz; havuz yeni thread'ler açarak büyür
  - "İlk 4 bağlantı 4 worker'ı da `read`'de **bloklar**; kalanlar kuyrukta bekler. Async (`tokio`/`axum`) birkaç thread ile binlerce bekleyen bağlantıyı yönetir"
  - "Program derlenmez, çünkü 10.000 `TcpStream` `Send` değildir"
  - Havuz boyutunu 10.000 yapmak en iyi ve en ucuz çözümdür
answer: 1
explanation: |
  Thread havuzu **CPU'yu** paylaştırmada iyidir, ama bloklayan I/O'da her bekleyen bağlantı bir thread'i
  tamamen işgal eder. Modül 19'da gördüğün gibi async görevler `await` noktalarında thread'i bırakır; bu
  yüzden `tokio` birkaç işletim sistemi thread'iyle on binlerce bağlantıyı idare eder. Bizim havuzumuz,
  `tokio`'nun `spawn_blocking` için kullandığı bloklayan iş havuzunun ve `rayon`'un temel fikrinin küçük
  bir modeli.
feedback:
  - Bizim havuzumuz sabit boyutludur; zaten amacı sınırsız büyümemekti.
  - Doğru!
  - "`TcpStream` `Send`'dir; onu worker'lara gönderiyoruz."
  - "10.000 thread her birinin yığını (stack) için bellek ve zamanlayıcı yükü demektir; asıl kaçtığımız durum buydu."
```

Son olarak havuza bir yetenek ekle: Sonuç döndüren işler.

````exercise
title: Sonuç döndüren havuz
difficulty: 4
prompt: |
  Havuz hazır. Şimdi ona `hesapla` metodunu ekle: Bir **değer döndüren** closure alsın, onu havuzda
  çalıştırsın ve sonucun geleceği bir `mpsc::Receiver<T>` döndürsün. Çağıran istediği zaman `recv()` ile
  sonucu alabilir:

  ```rust
  let rx = havuz.hesapla(|| 6 * 7);
  // ... başka işler ...
  assert_eq!(rx.recv().unwrap(), 42);
  ```

  - İş **havuzdaki bir worker'da** çalışmalı, çağıranın thread'inde değil.
  - Havuz drop edilse bile, önceden gönderilmiş işin sonucu kaybolmamalı.
  - İmza (sınırları sen bul): `fn hesapla<F, T>(&self, f: F) -> mpsc::Receiver<T>`
starter: |
  use std::sync::{Arc, Mutex, mpsc};
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  struct Worker {
      thread: thread::JoinHandle<()>,
  }

  impl Worker {
      fn new(alici: Arc<Mutex<mpsc::Receiver<Job>>>) -> Worker {
          let thread = thread::spawn(move || {
              loop {
                  let mesaj = alici.lock().unwrap().recv();
                  match mesaj {
                      Ok(is) => is(),
                      Err(_) => break,
                  }
              }
          });
          Worker { thread }
      }
  }

  pub struct ThreadPool {
      workers: Vec<Worker>,
      gonderici: Option<mpsc::Sender<Job>>,
  }

  impl ThreadPool {
      pub fn new(boyut: usize) -> ThreadPool {
          assert!(boyut > 0, "havuz en az bir worker içermeli");
          let (gonderici, alici) = mpsc::channel();
          let alici = Arc::new(Mutex::new(alici));
          let workers = (0..boyut).map(|_| Worker::new(Arc::clone(&alici))).collect();
          ThreadPool { workers, gonderici: Some(gonderici) }
      }

      pub fn execute<F>(&self, f: F)
      where
          F: FnOnce() + Send + 'static,
      {
          self.gonderici.as_ref().unwrap().send(Box::new(f)).unwrap();
      }

      pub fn hesapla<F, T>(&self, f: F) -> mpsc::Receiver<T>
      where
          F: FnOnce() -> T + Send + 'static,
          T: Send + 'static,
      {
          todo!()
      }
  }

  impl Drop for ThreadPool {
      fn drop(&mut self) {
          drop(self.gonderici.take());
          for worker in self.workers.drain(..) {
              worker.thread.join().unwrap();
          }
      }
  }

  fn main() {
      let havuz = ThreadPool::new(3);
      let alicilar: Vec<_> = (1..=5u64).map(|n| havuz.hesapla(move || n * n)).collect();
      let kareler: Vec<u64> = alicilar.iter().map(|rx| rx.recv().unwrap()).collect();
      println!("{kareler:?}");
  }
solution: |
  use std::sync::{Arc, Mutex, mpsc};
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  struct Worker {
      thread: thread::JoinHandle<()>,
  }

  impl Worker {
      fn new(alici: Arc<Mutex<mpsc::Receiver<Job>>>) -> Worker {
          let thread = thread::spawn(move || {
              loop {
                  let mesaj = alici.lock().unwrap().recv();
                  match mesaj {
                      Ok(is) => is(),
                      Err(_) => break,
                  }
              }
          });
          Worker { thread }
      }
  }

  pub struct ThreadPool {
      workers: Vec<Worker>,
      gonderici: Option<mpsc::Sender<Job>>,
  }

  impl ThreadPool {
      pub fn new(boyut: usize) -> ThreadPool {
          assert!(boyut > 0, "havuz en az bir worker içermeli");
          let (gonderici, alici) = mpsc::channel();
          let alici = Arc::new(Mutex::new(alici));
          let workers = (0..boyut).map(|_| Worker::new(Arc::clone(&alici))).collect();
          ThreadPool { workers, gonderici: Some(gonderici) }
      }

      pub fn execute<F>(&self, f: F)
      where
          F: FnOnce() + Send + 'static,
      {
          self.gonderici.as_ref().unwrap().send(Box::new(f)).unwrap();
      }

      pub fn hesapla<F, T>(&self, f: F) -> mpsc::Receiver<T>
      where
          F: FnOnce() -> T + Send + 'static,
          T: Send + 'static,
      {
          let (sonuc_tx, sonuc_rx) = mpsc::channel();
          self.execute(move || {
              let sonuc = f();
              // Çağıran alıcıyı çoktan bırakmış olabilir; o zaman sonucu sessizce at.
              let _ = sonuc_tx.send(sonuc);
          });
          sonuc_rx
      }
  }

  impl Drop for ThreadPool {
      fn drop(&mut self) {
          drop(self.gonderici.take());
          for worker in self.workers.drain(..) {
              worker.thread.join().unwrap();
          }
      }
  }

  fn main() {
      let havuz = ThreadPool::new(3);
      let alicilar: Vec<_> = (1..=5u64).map(|n| havuz.hesapla(move || n * n)).collect();
      let kareler: Vec<u64> = alicilar.iter().map(|rx| rx.recv().unwrap()).collect();
      println!("{kareler:?}");
  }
check: tests
tests: |
  #[test]
  fn tek_sonuc() {
      let havuz = ThreadPool::new(2);
      let rx = havuz.hesapla(|| 6 * 7);
      assert_eq!(rx.recv().unwrap(), 42, "6 * 7 = 42 sonucu alıcıdan okunabilmeli");
  }

  #[test]
  fn sonuclar_istek_sirasinda_eslesir() {
      let havuz = ThreadPool::new(4);
      let alicilar: Vec<_> = (0..20u64).map(|i| havuz.hesapla(move || i * 3)).collect();
      let sonuclar: Vec<u64> = alicilar.iter().map(|rx| rx.recv().unwrap()).collect();
      let beklenen: Vec<u64> = (0..20).map(|i| i * 3).collect();
      assert_eq!(sonuclar, beklenen, "her alıcı kendi işinin sonucunu vermeli");
  }

  #[test]
  fn sahipli_veri_ve_string_sonuc() {
      let havuz = ThreadPool::new(1);
      let ad = String::from("Ece");
      let rx = havuz.hesapla(move || format!("Merhaba, {ad}!"));
      assert_eq!(rx.recv().unwrap(), "Merhaba, Ece!");
  }

  #[test]
  fn is_worker_threadinde_calisir() {
      let havuz = ThreadPool::new(2);
      let rx = havuz.hesapla(|| thread::current().id());
      assert_ne!(
          rx.recv().unwrap(),
          thread::current().id(),
          "iş çağıranın thread'inde değil, havuzdaki bir worker'da çalışmalı"
      );
  }

  #[test]
  fn havuz_kapansa_da_sonuc_kaybolmaz() {
      let havuz = ThreadPool::new(2);
      let rx = havuz.hesapla(|| {
          thread::sleep(std::time::Duration::from_millis(20));
          "bitti"
      });
      drop(havuz);
      assert_eq!(rx.recv(), Ok("bitti"), "Drop işlerin bitmesini bekler; sonuç kanalda durmalı");
  }
hints:
  - "Her `hesapla` çağrısı için **yeni** bir kanal aç: `let (sonuc_tx, sonuc_rx) = mpsc::channel();`. Alıcıyı çağırana döndüreceksin."
  - "Kullanıcının `f`'ini sonucu döndürmeyen bir işe sar: `self.execute(move || { ... })`. Bu closure `f`'i ve `sonuc_tx`'i sahiplenmeli."
  - "Sarmalayıcının içi: `let sonuc = f(); let _ = sonuc_tx.send(sonuc);`. Fonksiyonun son ifadesi `sonuc_rx`."
explanation: |
  Çözüm iki closure'ı iç içe koyuyor: Kullanıcının `FnOnce() -> T` closure'ı, havuzun anladığı
  `FnOnce()` biçiminde bir **sarmalayıcı** closure'ın içine taşınıyor. Sarmalayıcı `f`'i ve `sonuc_tx`'i
  `move` ile yakalıyor. İkisi de `Send + 'static` olduğu için sarmalayıcı da öyle; derleyici bunu sınırlar
  üzerinden kendisi çıkarıyor. `T: Send` sınırı şart, çünkü sonuç worker thread'inden çağıranın thread'ine
  geçiyor.

  `let _ = sonuc_tx.send(sonuc);` bilinçli bir seçim: Çağıran `Receiver`'ı drop etmişse `send` `Err` döner.
  `unwrap` etseydik, sonucu kimsenin beklemediği bir iş yüzünden **worker thread'i panikler** ve havuz bir
  worker kaybederdi. Sonuç kanalda tamponlandığı için havuz kapandıktan sonra bile okunabiliyor.

  Bu desen, async dünyasında `tokio::spawn`'ın `JoinHandle`'ının ve `tokio::sync::oneshot` kanalının
  (Modül 19) temel fikridir: "İşi başlat, sonucu sonra al." Tek sonuçluk bir iş için `mpsc` biraz fazlası;
  gerçek bir kütüphane burada `oneshot` benzeri hafif bir kanal kullanırdı.
````

## Özet

:::remember
- **Derleyici güdümlü geliştirme**: Önce istediğin API'yi kullan, sonra hataları sırayla düzelt.
  `execute`, `thread::spawn`'ı taklit eder: `F: FnOnce() + Send + 'static`.
- İşler kanaldan `type Job = Box<dyn FnOnce() + Send + 'static>` olarak geçer: Her closure'ın tipi farklıdır.
- Çok worker tek alıcıyı **`Arc<Mutex<Receiver<Job>>>`** ile paylaşır. `Receiver` `Sync` değildir (E0277).
- Kilidi **ayrı bir `let`'te** al: `let mesaj = alici.lock().unwrap().recv();`. `while let` guard'ı gövde boyunca tutar.
- Zarif kapanma `Drop`'ta: **1)** `drop(self.gonderici.take())` ile kanalı kapat, **2)** `drain(..)` ile
  worker'ları alıp `join` et. Sıra ters olursa kilitlenme olur.
- `join(self)` tüketir; `&mut self` arkasından çıkarmak için `Option::take` ya da `drain` (E0507).
- Havuz CPU işini sınırlı thread'e paylaştırır; binlerce bekleyen bağlantı için async daha uygundur.
:::

```reflect
prompt: |
  Bu havuzu yazarken Rust derleyicisi hangi hataları **çalışma zamanından önce** yakaladı? Aynı havuzu C++
  ya da Java'da yazsaydın bu hataların her biri nasıl ortaya çıkardı?
answer: |
  Derleyici en az üç hatayı derleme zamanında yakaladı: Kısa ömürlü bir referansı yakalayan iş (E0373,
  `'static` sınırı), `Sync` olmayan alıcıyı kilitsiz paylaşmak (E0277, veri yarışı) ve `Drop` içinde
  ödünç alınmış `JoinHandle`'ı tüketmek (E0507). C++'ta ilki "dangling reference" olurdu: İş, yok olmuş
  bir yığın değişkenini okur ve tanımsız davranış (undefined behavior) oluşur. İkincisi, ara sıra ortaya
  çıkan ve yeniden üretmesi çok zor bir veri yarışı olurdu. Java'da bellek güvenliği olurdu ama veri
  yarışını derleyici yakalamaz. Kilidi gereğinden uzun tutmak (`while let` tuzağı) ise Rust'ta bile mantık
  hatasıdır; onu bir testle yakaladık. Derleyici her şeyi değil, ama en pahalı hataları yakalıyor.
```

```flashcards
- front: "`execute` closure'ı için hangi trait sınırları gerekir ve neden?"
  back: "`FnOnce()` (bir kez çalışır), `Send` (başka thread'e geçer), `'static` (kısa ömürlü referans tutmaz; iş ne zaman çalışacak belli değil)."
- front: "Havuzdaki işlerin kanal tipi neden `Box<dyn FnOnce() + Send + 'static>`'tir?"
  back: Her closure'ın kendine özgü bir tipi vardır; trait nesnesi hepsini tek bir tipe çevirip aynı kanaldan geçirir.
- front: "`Arc<Receiver<Job>>` başka thread'e neden gönderilemez (E0277)?"
  back: "`Arc<T>: Send` için `T: Sync` gerekir; `Receiver` `Sync` değildir. `Mutex` ile sarınca (`Arc<Mutex<Receiver>>`) çözülür."
- front: "`while let Ok(is) = alici.lock().unwrap().recv() { is(); }` neden yanlıştır?"
  back: "`while let` koşulundaki geçici `MutexGuard` gövde boyunca yaşar; iş çalışırken kilit tutulur ve havuz fiilen tek thread'e iner."
- front: Havuzun `Drop`'unda göndericiyi drop etmek neden worker'ları `join` etmekten **önce** gelmelidir?
  back: "Kanal kapanmazsa worker'lar `recv`'de sonsuza dek bekler; `join` hiç dönmez (deadlock)."
- front: "`Drop` içinde `worker.thread.join()` neden E0507 verir ve iki çözümü nedir?"
  back: "`join(self)` sahipliği ister ama elimizde `&mut self` var. Çözüm: `Option<JoinHandle>` + `take()` ya da `self.workers.drain(..)`."
- front: "\"Kapat mesajı\" yerine göndericiyi drop ederek kapatmanın avantajı nedir?"
  back: "Kapanmış kanal bütün worker'lara aynı anda `Err` döndürür; worker sayısı kadar mesaj göndermeye ve sıraya dikkat etmeye gerek kalmaz."
```
