# Özet Kartı: Korkusuz Eşzamanlılık

## Thread'ler: aç, taşı, topla

```rust
use std::thread;

fn main() {
    let subeler = vec![vec![120, 80], vec![45], vec![10, 20, 30]];

    // 1) Önce HEPSİNİ başlat (collect), 2) sonra sabit sırayla join et
    let tutamaclar: Vec<_> = subeler
        .into_iter()
        .map(|satislar| thread::spawn(move || satislar.iter().sum::<i32>())) // move: veri thread'e taşınır
        .collect();

    let toplamlar: Vec<i32> = tutamaclar.into_iter().map(|t| t.join().unwrap()).collect();
    println!("{toplamlar:?}"); // [200, 45, 60] - girdi sırasıyla, her çalıştırmada aynı
}
```

- **Eşzamanlılık (concurrency):** işler aynı zaman diliminde ilerler. **Paralellik (parallelism):** farklı
  çekirdeklerde gerçekten aynı anda çalışır.
- `thread::spawn(f)` → `JoinHandle<T>`. Closure şartı: `FnOnce() -> T + Send + 'static`.
- `join()` → `Result<T, _>`: thread paniklediyse `Err`. `main` bitince bütün thread'ler **kesilir**.
- Thread'ler arası sıra belirsizdir: deterministik sonuç için sabit sırayla `join` et ya da sonuçları sırala.
- `map(spawn).map(join)` tek zincirde **paralel değildir** (iterator tembel); önce tutamaçları `collect` et.

## Kanallar: belleği paylaşma, mesajla paylaş

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    for garson in 1..=3 {
        let tx = tx.clone(); // her üreticiye bir Sender
        thread::spawn(move || tx.send(format!("masa {garson}")).unwrap());
    }
    drop(tx); // orijinal göndericiyi bırak, yoksa döngü hiç bitmez

    let mut siparisler: Vec<String> = rx.iter().collect(); // bütün Sender'lar düşünce biter
    siparisler.sort();
    println!("{siparisler:?}");
}
```

| Durum | Sonuç |
|---|---|
| `tx.send(v)` | `v`'nin sahipliği kanala taşınır (sonra kullanmak **E0382**) |
| Alıcı drop edildi | `send` → `Err(SendError(v))`, değer geri verilir |
| Bütün göndericiler drop edildi + kuyruk boş | `recv` → `Err(RecvError)`, `for m in rx` biter |
| `mpsc::sync_channel(n)` | Sınırlı kuyruk: doluysa `send` **bekler** (geri basınç); `n = 0` → elden ele |
| Tek üretici / çok üretici | Tek üreticide FIFO; üreticiler arasında sıra belirsiz |

## Paylaşılan durum: `Arc<Mutex<T>>`

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let kasa = Arc::new(Mutex::new(0));
    let mut tutamaclar = Vec::new();
    for _ in 0..4 {
        let kasa = Arc::clone(&kasa); // sayaç +1, veri kopyalanmaz
        tutamaclar.push(thread::spawn(move || {
            for _ in 0..250 {
                *kasa.lock().unwrap() += 1; // geçici bekçi `;` ile düşer → kilit hemen açılır
            }
        }));
    }
    for t in tutamaclar {
        t.join().unwrap();
    }
    println!("{}", *kasa.lock().unwrap()); // 1000
}
```

| Tek thread | Çok thread | Görev |
|---|---|---|
| `Rc<T>` | `Arc<T>` | Ortak sahiplik (`Arc`'ın sayacı atomik) |
| `RefCell<T>` | `Mutex<T>` / `RwLock<T>` | İç değişkenlik |
| `Cell<u32>` | `AtomicU32` | Tek değer, kilitsiz |
| `Rc<RefCell<T>>` | `Arc<Mutex<T>>` | Çok sahipli + değiştirilebilir |

- `lock()` → `LockResult<MutexGuard<T>>`. Kilit, **bekçi drop edilince** açılır (RAII). Kilidi kısa tut.
- `std`'nin `Mutex`'i tekrar girilebilir değildir: aynı thread iki kez `lock()` ederse kendini kilitler.
- **Kilitlenme (deadlock)** derlenir! Birden çok kilit gerekiyorsa herkes **aynı sırayla** alsın.
- Kilit tutulurken panik → **zehirlenme (poisoning)**: `lock()` `Err(PoisonError)`; `e.into_inner()` ile veriye yine ulaşılır.
- **TOCTOU tuzağı:** "kontrol et" ve "güncelle" aynı kilit altında olmalı; kilidi bırakıp yeniden almak mantık hatasıdır.

## `Send`, `Sync`, `RwLock` ve atomikler

- **`Send`:** sahiplik başka thread'e taşınabilir. **`Sync`:** `&T` thread'ler arasında paylaşılabilir (`T: Sync` ⇔ `&T: Send`).
- İkisi de **otomatik (auto) trait**: tek bir uygunsuz alan bütün struct'ı uygunsuz yapar.

| Tip | `Send` | `Sync` |
|---|---|---|
| `i32`, `String`, `Vec<T>` (`T` uygunsa) | ✅ | ✅ |
| `Rc<T>` | ❌ | ❌ |
| `Cell<T>`, `RefCell<T>` | ✅ | ❌ |
| `Mutex<T>` (`T: Send`) | ✅ | ✅ |
| `Arc<T>` | `T: Send + Sync` ise | `T: Send + Sync` ise |

- `RwLock<T>`: aynı anda **çok okuyucu** (`read()`) ya da **tek yazar** (`write()`). Okuma baskınsa seç.
- Atomikler (`AtomicUsize`, `AtomicBool`...) `&self` ile çalışır, `Arc` içinde paylaşılır:
  `fetch_add` (önceki değeri döndürür), `load`, `store`, `compare_exchange`, `fetch_update`.
- `load` + `store` **ayrı adımlardır** → araya başka thread girer, artış kaybolur. Oku-değiştir-yaz için `fetch_*`.
- `Ordering`: sayaç → `Relaxed`; veri yayımlama → `Release` (yazan) / `Acquire` (okuyan); emin değilsen `SeqCst`.

## Kapsamlı thread'ler, `rayon`, global değerler

```rust
use std::thread;

fn main() {
    let mut notlar = [70, 80, 90, 100];
    let (ilk, son) = notlar.split_at_mut(2); // ayrık &mut dilimler

    thread::scope(|s| {
        s.spawn(|| ilk.iter_mut().for_each(|n| *n += 5)); // yerel veriyi ÖDÜNÇ al
        s.spawn(|| son.iter_mut().for_each(|n| *n += 5)); // Arc yok, 'static yok
    }); // kapsam, bütün thread'ler bitmeden dönmez

    println!("{notlar:?}"); // [75, 85, 95, 105]
}
```

```rust
use rayon::prelude::*;

fn main() {
    let kareler: Vec<u64> = (1..=5u64).into_par_iter().map(|x| x * x).collect(); // sıra korunur
    let toplam: u64 = kareler.par_iter().sum();
    println!("{kareler:?} {toplam}"); // [1, 4, 9, 16, 25] 55
}
```

- `rayon`: `iter()` → `par_iter()` / `into_par_iter()` / `par_iter_mut()`; iş çalan (work stealing) bir thread havuzu.
  Closure'lar **`Fn`** olmalı: dışarıdaki `Vec`'e `push` derlenmez, sonucu `collect` et.
- `static AYAR: LazyLock<T> = LazyLock::new(|| ...);` → ilk erişimde bir kez başlatılır.
- `static AD: OnceLock<T> = OnceLock::new();` → sonradan `get_or_init(|| ...)` / `set(..)` ile bir kez konur.
- `Condvar`: koşul gerçekleşene kadar CPU harcamadan bekle (`wait_while`, sahte uyanmalara karşı).
  `Barrier::new(n)`: `n` thread gelene kadar herkes bekler.

## Hangi aracı seçmeli?

| İhtiyaç | Araç |
|---|---|
| Bağımsız elemanlarda aynı CPU yoğun iş | `rayon` `par_iter` |
| Yerel veriyi bölüp hepsinin bitmesini beklemek | `thread::scope` |
| Aşamadan aşamaya akan veri (üretici → tüketici) | `mpsc` kanal (`sync_channel` ile sınırlı) |
| Uzun yaşayan thread'lerin ortak durumu | `Arc<Mutex<T>>`, okuma ağırlıklıysa `Arc<RwLock<T>>` |
| Tek sayaç ya da bayrak | Atomik (`AtomicUsize`, `AtomicBool`) |
| Bir kez hesaplanan global değer | `LazyLock` / `OnceLock` |

## Sık hatalar

| Hata | Neden | Çözüm |
|---|---|---|
| `E0373` closure may outlive the current function | `spawn` closure'ı yereli referansla yakalıyor | `move` closure ya da `thread::scope` |
| `E0277` `Rc<..>` cannot be sent between threads safely | `Rc` `Send` değil | `Arc` |
| `E0277` `RefCell<..>` / `Cell<..>` cannot be shared between threads safely | `Sync` değil | `Mutex` / `RwLock` / atomik |
| `E0596` cannot borrow data in an `Arc` as mutable | `Arc` yalnızca paylaşılan erişim verir | `Arc<Mutex<T>>` |
| `E0382` borrow of moved value | `send` ya da `move` sonrası değeri kullanmak | Önce klonla ya da sırayı değiştir |
| `E0499` (kapsam içinde) | İki thread aynı veriye `&mut` | `split_at_mut`, kanal ya da kilit |
| Program hiç bitmiyor | `drop(tx)` unutuldu ya da kilitlenme | Orijinal göndericiyi bırak; kilit sırasını sabitle |
| Sayaç eksik çıkıyor | `load` + `store` ya da kilit dışında kontrol | `fetch_add` / tek kritik bölge |
