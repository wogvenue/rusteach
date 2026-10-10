# Özet Kartı: Gerçek Dünya Rust ve Final

## 1. Ekosistem

- `std` küçüktür çünkü **sonsuza kadar** geriye uyumlu kalmak zorundadır; crate'ler semver ile sürüm atlayıp
  gelişebilir. Kendini kanıtlamış fikirler sonunda `std`'ye girer (`once_cell` → `OnceLock` / `LazyLock`).
- Ekosistemi birbirine bağlayan, `std`'nin ortak trait'leridir: `Iterator`, `Read` / `Write`, `Future`,
  `Error`, `From`, `Display`.

| Alan | Crate | Alan | Crate |
|---|---|---|---|
| CLI | `clap` | Log / izleme | `tracing` |
| Async çalışma zamanı | `tokio` | GUI | `egui`, `tauri` |
| Serileştirme | `serde` (+ `serde_json`) | Oyun | `bevy` |
| Web sunucusu | `axum` | WASM | `wasm-bindgen`, `leptos` |
| HTTP istemcisi | `reqwest` | Gömülü | `embassy` |
| Veritabanı | `sqlx`, `diesel` | Veri | `polars` |

**Crate karnesi:** kullanım (indirme, bağımlı crate'ler) · bakım (son sürüm, açık issue'lar) · sürüm (`0.x` mi?)
· belgeler · `unsafe` kullanımı · bağımlılık sayısı · güvenlik (`cargo audit`) · lisans.

## 2. serde ile serileştirme

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Siparis {
    musteri_adi: String,
    #[serde(default)]
    adet: u32,                                  // eksikse 0
    #[serde(skip_serializing_if = "Option::is_none")]
    not: Option<String>,                        // eksikse None, None ise yazılmaz
}

fn main() -> Result<(), serde_json::Error> {
    let s: Siparis = serde_json::from_str(r#"{"musteriAdi":"Ayşe"}"#)?; // dönüş tipini SEN söylersin
    println!("{}", serde_json::to_string(&s)?); // {"musteriAdi":"Ayşe","adet":0}
    Ok(())
}
```

| İhtiyaç | Araç |
|---|---|
| Alan adını değiştir | `#[serde(rename = "x")]`, kapta `rename_all = "camelCase"` / `"snake_case"` |
| Eksik alan | `Option<T>` → `None`; `#[serde(default)]` ya da `default = "fonksiyon_adi"` |
| Yazma sırasında atla | `skip_serializing_if = "Option::is_none"`, tamamen yok say: `skip` |
| Bilinmeyen alanları reddet | kapta `deny_unknown_fields` |
| Enum biçimi | varsayılan `{"Varyant": ...}` · `tag = "tur"` · `tag` + `content` · `untagged` |
| Şeması belirsiz veri | `serde_json::Value` + `json!`; `v["yok"]` panik değil `Null` döner |
| Kopyasız okuma | `&'a str` alan (kaçışlı metinde hata!) → güvenlisi `String` ya da `Cow<'a, str>` |

- `from_str` çağrısında hedef tip yoksa **E0283** (tip çıkarılamıyor): `let x: T = ...` ya da `from_str::<T>(..)`.
- Hatalar satır/sütun taşır; `e.classify()` → `Syntax` / `Data` / `Eof` / `Io`. `?` ile yay.

## 3. Final projesi 1: web sunucusu

```text
İstek:  GET /menu HTTP/1.1\r\n      ← istek satırı: YÖNTEM YOL SÜRÜM
        Host: 127.0.0.1\r\n         ← başlıklar
        \r\n                        ← boş satır = başlıklar bitti
Yanıt:  HTTP/1.1 200 OK\r\n
        Content-Length: 17\r\n      ← BAYT sayısı: govde.len(), chars().count() DEĞİL
        \r\n
        <h1>Merhaba!</h1>
```

| Parça | Kalıp |
|---|---|
| Dinlemek | `TcpListener::bind("127.0.0.1:7878")?` + `for akis in dinleyici.incoming()` |
| Okumak | `BufReader::new(&akis).lines()` → `\r\n`'siz satırlar; başlıklar için `take_while(\|l\| !l.is_empty())` |
| Yazmak | `akis.write_all(yanit.as_bytes())`; `TcpStream` drop edilince bağlantı kapanır |
| Test etmek | mantığı `&str` / `impl BufRead` alan **saf fonksiyonlara** koy; ağsız test et |
| Hata | tek kötü bağlantı sunucuyu düşürmemeli: `unwrap` yerine `let-else` / `if let Err` |

- Tek thread'li sunucu bağlantıları **sırayla** işler: yavaş bir istek bütün kuyruğu bekletir.
  Her bağlantıya bir thread ise sınırsızdır (hizmet engelleme riski) → **sabit boyutlu thread havuzu**.

## 4. Final projesi 2: ThreadPool

```rust
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>; // her closure'ın tipi farklı → trait nesnesi

struct Worker {
    id: usize,
    thread: thread::JoinHandle<()>,
}

pub struct ThreadPool {
    workers: Vec<Worker>,
    gonderici: Option<mpsc::Sender<Job>>, // Drop'ta take() edebilmek için Option
}

impl ThreadPool {
    pub fn new(boyut: usize) -> ThreadPool {
        assert!(boyut > 0);
        let (gonderici, alici) = mpsc::channel::<Job>();
        let alici = Arc::new(Mutex::new(alici)); // Receiver Sync değil → Mutex; paylaşım → Arc
        let workers = (0..boyut)
            .map(|id| {
                let alici = Arc::clone(&alici);
                let thread = thread::spawn(move || loop {
                    let mesaj = alici.lock().unwrap().recv(); // kilit bu satırın sonunda bırakılır
                    match mesaj {
                        Ok(is) => is(),
                        Err(_) => break, // kanal kapandı → çık
                    }
                });
                Worker { id, thread }
            })
            .collect();
        ThreadPool { workers, gonderici: Some(gonderici) }
    }

    pub fn execute<F: FnOnce() + Send + 'static>(&self, f: F) { // thread::spawn ile aynı sınırlar
        self.gonderici.as_ref().unwrap().send(Box::new(f)).unwrap();
    }
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
        drop(self.gonderici.take());              // 1) kanalı kapat
        for worker in self.workers.drain(..) {    // 2) sahipli al, bekle
            worker.thread.join().unwrap();
            println!("worker {} kapandı", worker.id);
        }
    }
}

fn main() {
    let havuz = ThreadPool::new(2);
    havuz.execute(|| println!("iş çalıştı"));
}
```

| Tuzak | Belirti | Çözüm |
|---|---|---|
| `while let Ok(is) = alici.lock().unwrap().recv()` | kilit iş boyunca tutulur, işler **sırayla** çalışır | kilidi ayrı bir `let`'te al |
| `Receiver`'ı thread'lere paylaştırmak | E0277: `Receiver<Job>` `Sync` değil | `Arc<Mutex<Receiver<Job>>>` |
| `drop(&mut self)` içinde `worker.thread.join()` | E0507: referansın arkasından taşıma | `drain(..)` ya da `Option::take` |
| Önce `join`, sonra göndericiyi kapatmak | **kilitlenme**: worker'lar `recv`'de sonsuza dek bekler | önce kanalı kapat, sonra `join` |
| Worker başına `Kapat` mesajı gönder-bekle | yanlış worker mesajı alır → kilitlenme | önce hepsini gönder ya da kanalı kapat |

- Havuz **CPU işini** sınırlı sayıda thread'e paylaştırır; binlerce **bekleyen** bağlantı için async (`tokio`) daha uygundur.

## 5. Sırada ne var?

- **Kaynaklar:** the Book, Rust by Example → Rustlings, Exercism → *Rust for Rustaceans*, *Rust Atomics and Locks*,
  Async Book → Rustonomicon (`unsafe`'ten önce) → *Zero To Production* (backend).
- **Alan seç, küçük ama bitmiş bir proje yap:** backend (`axum`), CLI (`clap`), gömülü (`embassy`),
  WASM (`wasm-bindgen`), oyun (`bevy`), veri (`polars`, Python için `PyO3`).
- **Açık kaynak:** `good first issue` → issue'ya yaz → küçük PR → `cargo fmt` + `cargo clippy` + `cargo test` → incelemeden öğren.
- **30-60-90 gün:** pekiştir (Rustlings, Exercism, küçük CLI) → derinleş (alan + orta boy proje + CI) → paylaş
  (crate yayınla, katkı yap, yazı yaz).
- **Takıldığında:** derleyici mesajını sonuna kadar oku → `rustc --explain E0XXX` → std belgeleri → topluluk.
