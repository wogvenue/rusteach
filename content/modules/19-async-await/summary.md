# Özet Kartı: Async/Await

## Neden async, temel model

- **I/O-bound** iş (ağ, disk, zamanlayıcı) = çoğunlukla beklemek → async. **CPU-bound** iş → thread'ler / `rayon`.
- Thread başına MB'larca yığın; async görev başına birkaç KB. Birkaç işçi thread binlerce görevi ilerletir.
- Görevler **işbirlikçidir** (cooperative): sırayı yalnızca `.await` noktalarında bırakır.
- **Future = tembel durum makinesi.** Oluşturmak hiçbir şey çalıştırmaz; biri `.await` edene (yoklayana) kadar bekler.
- Dil `Future` + `async`/`.await` verir; **runtime** (executor + reaktör) kütüphaneden gelir: `tokio`, `smol`...

```rust
use std::time::Duration;

async fn selamla(ad: &str) -> String {
    tokio::time::sleep(Duration::from_millis(10)).await; // görevi askıya alır, thread serbest
    format!("Merhaba {ad}")
}

#[tokio::main] // runtime kurar, main'i onun üzerinde çalıştırır
async fn main() {
    let f = selamla("Ayşe"); // future oluştu, gövde HENÜZ çalışmadı
    println!("{}", f.await); // şimdi çalıştı
}
```

- `async fn f() -> T` ≈ `fn f() -> impl Future<Output = T>`. `.await` sadece async fonksiyon/blok içinde (**E0728**).
- Sıralı `.await`'ler sırayla çalışır; aynı anda beklemek için `join!`/`spawn` gerekir.
- Unutulan `.await` → "unused implementer of `Future`" uyarısı; sonucu kullanırsan `impl Future<Output = T>` içeren tip hatası.

## Eşzamanlılık araçları

| Araç | Ne yapar? | Not |
|---|---|---|
| `tokio::spawn(fut)` | Ayrı **görev** başlatır → `JoinHandle<T>` | `Send + 'static` ister (`async move`, **E0373**); `.await` → `Result<T, JoinError>` |
| `join!(a, b)` | Aynı görevde aynı anda yoklar, **hepsini** bekler | Yerelleri ödünç alabilir; sonuç tuple |
| `try_join!(a, b)` | `join!` + **ilk `Err`'de** vazgeçer | Diğerleri drop edilir |
| `select! { x = a => .., y = b => .. }` | **İlk biteni** alır | Kaybedenler drop edilir (iptal); `biased;` sırayla dener |
| `JoinSet` | Sayısı belirsiz görevler; `join_next().await` | Sonuçlar bitiş sırasıyla → topla, sonra sırala |
| `futures::future::join_all(vec)` | Bir koleksiyon future'ı aynı anda bekler | Sonuçlar giriş sırasıyla |
| `tokio::time::timeout(süre, fut)` | Süre sınırı | `Ok(v)` ya da `Err(Elapsed)`; süre dolunca future drop edilir |

## Kanallar ve paylaşılan durum

| Araç | Kullanım |
|---|---|
| `mpsc::channel(n)` | Çok üretici → tek tüketici; `send(..).await` (dolu kuyrukta bekler: geri basınç), `while let Some(m) = rx.recv().await` |
| `oneshot::channel()` | Tek cevap; istek içine konur → **aktör deseni** |
| `broadcast::channel(n)` | Her alıcı her mesajı alır; yavaş alıcı `Lagged` |
| `std::sync::Mutex` | Kilitliyken `.await` **yoksa** (varsayılan seçim); guard'ı `{ }` bloğunda bitir |
| `tokio::sync::Mutex` | Kilidi `.await` boyunca tutman **şartsa**; `lock().await` |
| `Semaphore::new(n)` | Aynı anda en fazla `n` iş; `acquire().await` ile izin al, izin drop edilince geri verilir |

## Perde arkası: `Future`, `poll`, `Pin`

```rust,ignore
trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
// Poll::Ready(v) = bitti · Poll::Pending = henüz değil
```

- `Pending` döndüren future, olay gerçekleşince `cx.waker().wake()` çağrılmasını **ayarlamak zorundadır**; yoksa görev sonsuza dek bekler.
- Executor: hazır görevleri yoklar, uyandırılanları yeniden kuyruğa alır; boşuna yoklamaz.
- `.await` boyunca yaşayan yereller future'ın **içinde** saklanır → future kendine referans verebilir → taşınmamalı → **`Pin`**.
- **`Unpin`**: taşınması her zaman güvenli tipler (neredeyse hepsi). `async fn`/`async {}` future'ları `Unpin` **değildir**.
- Sabitleme: `Box::pin(f)` (heap, taşınabilir) · `std::pin::pin!(f)` (stack, yerel). "cannot be unpinned" (**E0277**) ve özyinelemeli async fn (**E0733** → `Box::pin(f(..)).await`) bunlarla çözülür.

## Stream'ler, async trait'ler, async closure'lar

```rust
use futures::stream::{self, StreamExt};

#[tokio::main]
async fn main() {
    let mut akis = std::pin::pin!(stream::iter(1..=4).then(|x| async move { x * 10 }));
    while let Some(x) = akis.next().await { // stream'de for yok
        print!("{x} ");
    }
    println!();
}
```

- `Stream` = async `Iterator`: `poll_next` → `Ready(Some(x))` / `Ready(None)` / `Pending`. `use futures::StreamExt;`
- Adaptörler tembel: `map`, `then` (sıralı async), `filter` (future döndüren yüklem), `take`, `collect`, `fold`.
- `.map(f).buffered(n)` → en fazla `n` future aynı anda, sıra korunur; `buffer_unordered(n)` → bitiş sırası.
- Kendi stream'in: `stream::unfold(durum, |d| async move { Some((eleman, yeni_d)) })`.
- Trait'te `async fn` (1.75) = `-> impl Future<Output = T>`. `Send` sözü yok → `spawn` için `fn f(..) -> impl Future<Output = T> + Send;` yaz. `dyn` ile kullanılamaz.
- Async closure (1.85): `async |x| { .. }`; sınırlar `AsyncFn` / `AsyncFnMut` / `AsyncFnOnce`. Eski `F: FnMut() -> Fut` kalıbı yakalananları ödünç alan future döndüremez.

## Sık hatalar ve çözümleri

| Belirti | Neden | Çözüm |
|---|---|---|
| Diğer görevler donuyor, gecikme artıyor | `std::thread::sleep`, senkron I/O, ağır hesap executor'ı blokluyor | `tokio::time::sleep`, `tokio::fs`/`net`; ağır iş → `spawn_blocking(move \|\| ..).await` |
| "future cannot be sent between threads safely" | `.await` boyunca `Send` olmayan değer (`MutexGuard`, `Rc`, `RefCell` borcu) | Değeri `{ }` bloğunda bitir (`drop()` yetmez), `Arc`/`tokio::sync::Mutex` kullan |
| `cannot add .. to impl Future<Output = T>` | `.await` unutuldu | `.await` ekle |
| Arka plan işi hiç bitmiyor | `main` bitti, runtime görevleri drop etti | `JoinHandle`/`JoinSet`'i bekle |
| `select!` döngüsünde veri kayboluyor | Future iptal güvenli değil; içindeki durum drop edildi | Durumu döngü değişkeninde tut ya da `pin!` + `&mut fut` |
| "Cannot start a runtime from within a runtime" | Async görev içinden `block_on` | Fonksiyonu async yap ya da `spawn_blocking` içinden çağır |
| **E0373** async block may outlive the current function | `spawn` edilen blok yereli ödünç alıyor | `async move` |
| **E0728** `await` is only allowed inside `async` | Sıradan `fn`/closure içinde `.await` | `async fn`, `async { }`, `async \|\| { }` |

## Thread mi, async mi?

| Durum | Seçim |
|---|---|
| Binlerce eşzamanlı bağlantı / bekleme | Async (tokio) |
| Çok sayıda isteği sınırlı paralellikle atmak | Async + `buffered(n)` / `Semaphore` |
| Ağır, paralelleştirilebilir CPU işi | Thread'ler / `rayon` |
| Async uygulama içinde ağır parça | `spawn_blocking` |
| Eşzamanlılık yok, basit araç | Senkron kod |
