---
id: m18-l03
title: "Paylaşılan durum, Mutex ve Arc"
minutes: 22
type: lesson
objectives:
  - "`Mutex<T>` ile veriye kilitli erişim sağlayıp `MutexGuard`'ın kilidi ne zaman açtığını söyleyebilmek"
  - "`Rc`'nin thread'ler arasında neden derlenmediğini (`E0277`) açıklayıp `Arc` ile düzeltebilmek"
  - "`Arc<Mutex<T>>` ile birden çok thread'in aynı veriyi güvenle güncellediği programlar yazabilmek"
  - Kilitlenme (deadlock) ve zehirlenme (poisoning) durumlarını tanıyıp önleyebilmek
keywords: [Mutex, MutexGuard, lock, Arc, "Arc<Mutex<T>>", deadlock, kilitlenme, poisoning, E0277, Send]
---

Kanallarda her mesajın **tek bir sahibi** vardı: veri el değiştiriyordu. Ama bazen birçok thread'in
**aynı** veriyi görmesi ve güncellemesi gerekir: bir web sitesinin ziyaretçi sayacı, bir bankanın hesap
bakiyeleri, ortak bir önbellek. Bu derste **paylaşılan durum (shared state)** ile tanışacaksın: veriyi bir
**kilit (lock)** arkasına koyup aynı anda yalnızca bir thread'in dokunmasına izin vermek. Modül 17'deki
`Rc<RefCell<T>>`'nin thread'li kardeşi **`Arc<Mutex<T>>`** bu dersin yıldızı.

## `Mutex<T>`: veri kilidin içinde

**Mutex**, *mutual exclusion* (karşılıklı dışlama) kelimelerinden gelir: korunan veriye **aynı anda
yalnızca bir** thread erişebilir. Önce tek thread'de nasıl çalıştığına bakalım ve küçük bir sürprize
hazırlıklı ol:

```predict
code: |
  use std::sync::Mutex;

  fn main() {
      let m = Mutex::new(5);
      {
          let mut sayi = m.lock().unwrap();
          *sayi += 1;
          println!("{m:?}");
      }
      println!("{m:?}");
  }
options:
  - |
    Mutex { data: 6, poisoned: false, .. }
    Mutex { data: 6, poisoned: false, .. }
  - |
    Mutex { data: "<locked>", poisoned: false, .. }
    Mutex { data: 6, poisoned: false, .. }
  - |
    Mutex { data: 5, poisoned: false, .. }
    Mutex { data: 6, poisoned: false, .. }
  - Program kilitlenir; içteki `println!` mutex'i kilitli bulur ve sonsuza dek bekler
answer: 1
explanation: |
  `m.lock()` kilidi alır ve bir **`MutexGuard`** (kilit bekçisi) döndürür. Bekçi yaşadığı sürece kilit
  kapalıdır. İçteki `println!`, mutex'i `Debug` ile yazdırırken veriyi okumayı **dener** ama kilit dolu
  olduğu için içeriği göremez; beklemek yerine `"<locked>"` yazar. Süslü parantez kapanınca `sayi` drop
  edilir ve **kilit kendiliğinden açılır**; dıştaki `println!` artık `6`'yı görür.
```

Kodda olan biteni adım adım okuyalım:

- `Mutex::new(5)` veriyi (`5`) mutex'in **içine** koyar. Tipi `Mutex<i32>`.
- `m.lock()` kilidi almak için gerekirse **bekler**, sonra bir `LockResult<MutexGuard<i32>>` döndürür.
  `unwrap`'ın sebebi **zehirlenme**: dersin sonunda göreceğiz.
- `MutexGuard` bir akıllı işaretçidir (Modül 17): `Deref`/`DerefMut` uyguladığı için `*sayi += 1`
  yazabiliyoruz; `Drop` uyguladığı için kapsamdan çıkınca **kilidi açıyor** (RAII).

Rust'ın `Mutex`'i ile C'deki `pthread_mutex_t` veya Java'daki `synchronized` arasında önemli bir fark var.
Onlarda kilit ve veri **ayrı** şeylerdir: kilidi almayı unutup veriye dokunabilirsin, derleyici fark etmez.
Rust'ta veri kilidin **içindedir**; kilidi almadan veriye ulaşmanın yolu yoktur:

```compiles
code: |
  use std::sync::Mutex;

  fn main() {
      let m = Mutex::new(5);
      m += 1;
      println!("{m:?}");
  }
answer: false
error: E0368
explanation: |
  `m` bir `i32` değil, bir `Mutex<i32>`. `+=` işlemi bir mutex üzerinde tanımlı değildir
  (`E0368: binary assignment operation += cannot be applied to type std::sync::Mutex<{integer}>`). İçerideki sayıya
  ancak `m.lock()` ile bir bekçi alarak ulaşabilirsin. "Kilidi almayı unuttum" hatası Rust'ta **tip
  hatasıdır**, çalışma zamanında saklanan bir hata değil.
```

:::analogy Kafedeki anahtarlı tuvalet
Bazı kafelerde tuvaletin anahtarı kasada durur. İçeri girmek isteyen anahtarı alır (`lock`), işini bitirip
anahtarı geri bırakır (bekçinin `drop` edilmesi). Anahtar başkasındaysa kapının önünde **beklersin**. Rust'ın
mutex'i bir adım daha ileri gider: anahtarın kendisi kapıyı açan tek şeydir ve sen anahtarı bırakmayı
**unutamazsın**, çünkü kapsamdan çıktığın anda anahtar kendiliğinden kasaya döner.
:::

## Bekçinin ömrü: kilit ne zaman açılır?

Kilit, `MutexGuard` drop edildiğinde açılır. Bu yüzden bekçinin ne kadar yaşadığı çok önemlidir:

```rust
use std::sync::Mutex;

fn main() {
    let stok = Mutex::new(vec![String::from("çay"), String::from("kahve")]);

    // 1) Geçici bekçi: ifadenin sonunda (;) drop edilir → kilit hemen açılır
    stok.lock().unwrap().push(String::from("salep"));

    // 2) Değişkene bağlı bekçi: kapsamın sonuna kadar yaşar
    {
        let mut liste = stok.lock().unwrap();
        liste.retain(|u| u != "kahve");
    } // ← kilit burada açılır

    // 3) Elle erken bırakmak
    let liste = stok.lock().unwrap();
    let adet = liste.len();
    drop(liste); // kilit açıldı; uzun işler artık kilitsiz yapılabilir
    println!("Stokta {adet} ürün var: {:?}", stok.lock().unwrap());
}
```

Altın kural: **kilidi olabildiğince kısa tut.** Kilit tutulurken diğer thread'ler bekler; uzun hesaplamaları,
yazdırmaları, dosya işlemlerini kilidin dışında yap. Bir şeyi daha bil: standart `Mutex` **tekrar girilebilir
(reentrant) değildir**.

````quiz
question: |
  Bu fonksiyon çağrılınca ne olur?

  ```rust
  fn ikiye_katla(m: &Mutex<i32>) {
      let a = m.lock().unwrap();
      let b = m.lock().unwrap();
      println!("{}", *a + *b);
  }
  ```
options:
  - "Aynı thread zaten kilidin sahibi olduğu için ikinci `lock` hemen başarılı olur ve `2 * değer` yazdırılır"
  - "İkinci `lock` asla başarıyla dönmez: thread kendi tuttuğu kilidi bekleyerek kilitlenir (ya da panikler)"
  - "Derlenmez: aynı mutex iki kez ödünç alınamaz (`E0499`)"
answer: 1
explanation: |
  `lock` yalnızca `&self` ister; derleyici açısından iki çağrı da geçerlidir. Ama çalışma zamanında
  `a` kilidi tutarken `b` için ikinci `lock`, kilidin açılmasını bekler, oysa onu açacak olan **aynı
  thread**. Standart kütüphane bu durumda davranışı belirtmez; tek garanti ikinci çağrının **başarıyla
  dönmeyeceğidir** (kilitlenme ya da panik). Çözüm: tek bir bekçi alıp onu kullanmak, ya da ilkini
  `drop` ettikten sonra yeniden kilitlemek.
feedback:
  - Java'nın `synchronized` blokları tekrar girilebilir; Rust'ın standart `Mutex`'i değildir.
  - Doğru! Kendi kendini kilitleyen bir thread.
  - "`lock` `&self` aldığı için derleyici bunu yakalamaz; `RefCell`'in `borrow_mut`'ı gibi kontrol çalışma zamanında."
````

:::warning Geçici bekçi tuzağı
`match` ifadesinin koşulunda oluşan geçici değerler **bütün `match` bitene kadar** yaşar. Yani
`match kuyruk.lock().unwrap().pop() { Some(is) => isle(is), None => {} }` yazarsan kilit, `isle` çalışırken
de tutulur; `isle` aynı mutex'i kilitlemeye çalışırsa kendi kendini kilitler. Güvenli yol: önce
`let is = kuyruk.lock().unwrap().pop();` ile değeri al (bekçi `;`'da drop edilir), sonra `match is { ... }`.
:::

## Thread'ler arasında paylaşmak: `Rc` değil, `Arc`

Şimdi mutex'i on thread arasında paylaşalım. İlk deneme: mutex'i her thread'e `move` etmek.

```rust,compile_fail,E0382
use std::sync::Mutex;
use std::thread;

fn main() {
    let sayac = Mutex::new(0);
    let mut tutamaclar = vec![];
    for _ in 0..10 {
        let h = thread::spawn(move || {
            *sayac.lock().unwrap() += 1;
        });
        tutamaclar.push(h);
    }
    for h in tutamaclar {
        h.join().unwrap();
    }
    println!("{}", *sayac.lock().unwrap());
}
```

:::error
```text
error[E0382]: borrow of moved value: `sayac`
  --> src/main.rs:16:21
   |
 5 |     let sayac = Mutex::new(0);
   |         ----- move occurs because `sayac` has type `std::sync::Mutex<i32>`, which does not implement the `Copy` trait
 6 |     let mut tutamaclar = vec![];
 7 |     for _ in 0..10 {
   |     -------------- inside of this loop
 8 |         let h = thread::spawn(move || {
   |                               ------- value moved into closure here, in previous iteration of loop
...
16 |     println!("{}", *sayac.lock().unwrap());
   |                     ^^^^^ value borrowed here after move
```
"value moved into closure here, **in previous iteration of loop**": mutex ilk turda ilk thread'e taşındı;
ikinci tur ve `main` artık onu kullanamaz. Tek bir değerin **birden çok sahibi** olması gerekiyor.
:::

"Birden çok sahip" deyince Modül 17'den aklına `Rc<T>` geliyor olmalı. Deneyelim:

```compiles
code: |
  use std::rc::Rc;
  use std::sync::Mutex;
  use std::thread;

  fn main() {
      let sayac = Rc::new(Mutex::new(0));
      let mut tutamaclar = vec![];
      for _ in 0..10 {
          let sayac = Rc::clone(&sayac);
          tutamaclar.push(thread::spawn(move || {
              *sayac.lock().unwrap() += 1;
          }));
      }
      for h in tutamaclar {
          h.join().unwrap();
      }
      println!("{}", *sayac.lock().unwrap());
  }
answer: false
error: E0277
explanation: |
  `Rc<T>`'nin referans sayacı sıradan (atomik olmayan) bir tamsayıdır. İki thread aynı anda `Rc::clone`
  ya da drop yapsaydı sayaç güncellemelerinden biri kaybolabilirdi: sayaç yanlış çıkar, veri ya hiç
  serbest bırakılmaz ya da hâlâ kullanılırken serbest bırakılır. Rust bunu önlemek için `Rc`'yi **`Send`
  olmayan** bir tip olarak işaretler; `thread::spawn` ise `Send` ister.
```

:::error
```text
error[E0277]: `Rc<std::sync::Mutex<i32>>` cannot be sent between threads safely
   --> src/main.rs:10:39
    |
 10 |           tutamaclar.push(thread::spawn(move || {
    |                           ------------- ^------
    |                           |             |
    |  _________________________|_____________within this `{closure@src/main.rs:10:39: 10:46}`
    | |                         |
    | |                         required by a bound introduced by this call
 11 | |             *sayac.lock().unwrap() += 1;
 12 | |         }));
    | |_________^ `Rc<std::sync::Mutex<i32>>` cannot be sent between threads safely
    |
    = help: within `{closure@src/main.rs:10:39: 10:46}`, the trait `Send` is not implemented for `Rc<std::sync::Mutex<i32>>`
note: required because it's used within this closure
note: required by a bound in `spawn`
   --> .../library/std/src/thread/functions.rs:128:8
    |
125 | pub fn spawn<F, T>(f: F) -> JoinHandle<T>
    |        ----- required by a bound in this function
...
128 |     F: Send + 'static,
    |        ^^^^ required by this bound in `spawn`
```
Önce "**ne** gönderilemiyor" (`Rc<Mutex<i32>>`), sonra "**neden** gerekiyor" (`spawn`'ın `F: Send`
sınırı). `Send`'i bir sonraki derste derinlemesine inceleyeceğiz.
:::

Çözüm **`Arc<T>`**: *atomically reference counted* (atomik referans sayımlı). API'si `Rc` ile aynıdır
(`Arc::new`, `Arc::clone`, `Arc::strong_count`), tek fark sayacın **atomik işlemlerle** güncellenmesidir.
Atomik işlemler, işlemcinin "bu sayıyı tek seferde, bölünmeden artır" garantisi verdiği özel komutlardır.
Biraz daha pahalıdırlar; bu yüzden Rust her yerde `Arc` kullanmaz, tek thread'de `Rc` yeterlidir.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let ziyaretci = Arc::new(Mutex::new(0));
    let mut tutamaclar = vec![];

    for _ in 0..10 {
        let ziyaretci = Arc::clone(&ziyaretci);
        tutamaclar.push(thread::spawn(move || {
            for _ in 0..100 {
                *ziyaretci.lock().unwrap() += 1;
            }
        }));
    }
    for h in tutamaclar {
        h.join().unwrap();
    }

    println!("Toplam ziyaretçi: {}", *ziyaretci.lock().unwrap());
}
```

10 thread × 100 artış = **her zaman 1000**. Mutex olmasaydı (ve dil izin verseydi) iki thread aynı anda
"değeri oku → 1 ekle → geri yaz" yapıp birbirinin artışını ezebilirdi; C'de bu kod çoğu zaman 1000'den
küçük, her seferinde farklı bir sayı yazdırır.

```memory
title: Arc<Mutex<i32>> bellekte
steps:
  - caption: "`Arc::new(Mutex::new(0))`: mutex ve sayaç heap'te tek bir blokta; `main` bir işaretçi tutuyor. (Basitleştirilmiş: iki thread, her biri sayacı bir kez artırıyor.)"
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
    heap:
      - { id: h1, label: "Arc bloğu", value: "strong=1 · Mutex{ açık · 0 }" }
  - caption: "`Arc::clone` iki kez çağrıldı: veri kopyalanmadı, sadece **atomik** sayaç arttı. Her thread kendi işaretçisine sahip."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
      - frame: "thread #2"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
      - frame: "thread #3"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
    heap:
      - { id: h1, label: "Arc bloğu", value: "strong=3 · Mutex{ açık · 0 }" }
  - caption: "Thread #2 kilidi aldı ve artırıyor; thread #3 `lock()`'ta bekliyor."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
      - frame: "thread #2"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
          - { name: bekci, type: "MutexGuard<i32>", value: "&mut 0 → 1", to: h1, mut: true }
      - frame: "thread #3"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1, note: "lock() bekliyor" }
    heap:
      - { id: h1, label: "Arc bloğu", value: "strong=3 · Mutex{ KİLİTLİ · 1 }" }
  - caption: "Thread'ler bitti, klonları drop edildi: strong=1. Son `Arc` da düşünce blok serbest bırakılır."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: ziyaretci, type: "Arc<Mutex<i32>>", value: "ptr", to: h1 }
    heap:
      - { id: h1, label: "Arc bloğu", value: "strong=1 · Mutex{ açık · 2 }" }
```

`Arc` tek başına yalnızca **paylaşılan (değişmez)** erişim verir, tıpkı `Rc` gibi. Değiştirme yeteneğini
içerideki `Mutex` sağlar. Yani bildiğin desenin thread'li karşılığı:

| Tek thread (Modül 17) | Çok thread (bu ders) | Görevi |
|---|---|---|
| `Rc<T>` | `Arc<T>` | Birden çok sahip (sayaç: düz / atomik) |
| `RefCell<T>` | `Mutex<T>` (veya `RwLock<T>`) | İç değişkenlik (ihlalde: panik / bekleme) |
| `Rc<RefCell<T>>` | `Arc<Mutex<T>>` | Paylaşılan, değiştirilebilir veri |

```predict
code: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn main() {
      let sepet = Arc::new(Mutex::new(Vec::new()));
      let mut tutamaclar = Vec::new();

      for meyve in ["elma", "armut", "ayva"] {
          let sepet = Arc::clone(&sepet);
          tutamaclar.push(thread::spawn(move || {
              sepet.lock().unwrap().push(meyve);
          }));
      }

      for h in tutamaclar {
          h.join().unwrap();
      }
      let mut icerik = sepet.lock().unwrap().clone();
      icerik.sort();
      println!("{icerik:?} sahip sayısı: {}", Arc::strong_count(&sepet));
  }
options:
  - |
    ["armut", "ayva", "elma"] sahip sayısı: 1
  - |
    ["armut", "ayva", "elma"] sahip sayısı: 4
  - |
    ["elma", "armut", "ayva"] sahip sayısı: 1
answer: 0
explanation: |
  `join`'lerden sonra üç thread de bitmiş ve closure'larıyla birlikte içlerindeki `Arc` klonları drop
  edilmiştir: sayaç yeniden **1** (yalnızca `main`'in kopyası). Thread'ler çalışırken sayaç 4'e kadar
  çıkabilirdi ama o anki değer zamanlamaya bağlı olduğu için güvenilir değildir. Meyvelerin sepete giriş
  sırası da belirsizdi; `sort()` sayesinde çıktı hep `["armut", "ayva", "elma"]`. `sepet.lock().unwrap().clone()`
  vektörün bir kopyasını alıp kilidi hemen bırakıyor; sıralamayı kilit dışında yapıyoruz.
```

```fill
prompt: |
  Dört kasa aynı hasılat defterine satış eklesin. Paylaşılan durumu doğru kur ve kilidi al.
code: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn main() {
      let hasilat = Arc::new(Mutex::new(0u32));
      let mut kasalar = Vec::new();
      for satis in [150, 75, 320, 55] {
          let hasilat = ___0(&hasilat);
          kasalar.push(thread::spawn(move || {
              *hasilat.___1().unwrap() += satis;
          }));
      }
      for k in kasalar {
          k.join().unwrap();
      }
      println!("{}", *hasilat.lock().unwrap());
  }
blanks:
  - ["Arc::clone"]
  - ["lock"]
output: "600"
explanation: |
  `Arc::clone(&hasilat)` her kasaya aynı deftere işaret eden yeni bir sahip verir (`hasilat.clone()` da
  çalışır ama `Arc::clone` yazımı "bu ucuz bir sayaç artışı, derin kopya değil" mesajını açıkça verir,
  Modül 17'deki `Rc::clone` geleneği gibi). `lock()` bekçiyi verir; `*` ile içerideki `u32`'ye ulaşıp
  ekliyoruz. Bekçi geçici olduğu için kilit `;`'da hemen açılıyor.
```

## Kilitlenme (deadlock)

Rust veri yarışlarını önler ama **her** eşzamanlılık hatasını değil. Klasik örnek: iki banka hesabı
arasında havale. Thread A önce `hesap1`'i sonra `hesap2`'yi kilitler; thread B ters sırayla. Kötü bir
zamanlamada A `hesap1`'i, B `hesap2`'yi tutar ve ikisi de diğerinin kilidini sonsuza dek bekler:

```rust,norun
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    let hesap1 = Arc::new(Mutex::new(1000));
    let hesap2 = Arc::new(Mutex::new(1000));

    let (h1, h2) = (Arc::clone(&hesap1), Arc::clone(&hesap2));
    let a = thread::spawn(move || {
        let mut kaynak = h1.lock().unwrap();
        thread::sleep(Duration::from_millis(10)); // kötü zamanlamayı garantile
        let mut hedef = h2.lock().unwrap(); // B'nin bırakmasını bekler...
        *kaynak -= 100;
        *hedef += 100;
    });

    let (h1, h2) = (Arc::clone(&hesap1), Arc::clone(&hesap2));
    let b = thread::spawn(move || {
        let mut kaynak = h2.lock().unwrap();
        thread::sleep(Duration::from_millis(10));
        let mut hedef = h1.lock().unwrap(); // ...A'nın bırakmasını bekler
        *kaynak -= 50;
        *hedef += 50;
    });

    a.join().unwrap(); // asla dönmez
    b.join().unwrap();
}
```

Bu program **derlenir** ama hiç bitmez (bu yüzden uygulamada çalıştırılamıyor). Kilitlenme bir bellek
güvenliği sorunu değildir; Rust'ın derleme zamanı garantilerinin kapsamı dışındadır.

:::analogy Dar köprüdeki iki araba
Tek şeritli bir köprüye iki uçtan iki araba aynı anda girer. Her biri ortada durup diğerinin geri
çekilmesini bekler; ikisi de inatçıysa sonsuza dek orada kalırlar. Çözüm bir **trafik kuralıdır**:
"köprüye her zaman önce kuzeyden gelen girer." Kilitlerde de kural aynıdır: herkes kilitleri **aynı
sırayla** alırsa döngüsel bekleme oluşamaz.
:::

Kilitlenmeden kaçınmanın pratik kuralları:

1. **Sabit kilit sırası:** birden çok kilit gerekiyorsa hep aynı sırayla al (ör. küçük hesap numarasından büyüğe).
2. **Aynı anda tek kilit:** mümkünse bir kilidi bırakmadan diğerini alma.
3. **Kısa kritik bölge:** kilit tutarken başka fonksiyonları, özellikle başka kilit alabilecek kodları çağırma.
4. **`try_lock`:** beklemek yerine hemen `Err` dönen sürümle "alamazsam vazgeçip tekrar denerim" stratejisi.

```quiz
question: Yukarıdaki havale programındaki kilitlenmeyi hangi değişiklik **kesin olarak** önler?
options:
  - "`thread::sleep` satırlarını silmek"
  - İki thread'in de havale yönünden bağımsız olarak **önce `hesap1`'i, sonra `hesap2`'yi** kilitlemesi
  - "`Mutex` yerine `Arc<Arc<Mutex<i32>>>` kullanmak"
  - "`join` çağrılarının sırasını değiştirmek (`b` önce)"
answer: 1
explanation: |
  Kilitlenme, thread'lerin kilitleri **farklı sırayla** alıp birbirini döngüsel olarak beklemesinden doğar.
  Herkes aynı sırayla kilitlerse `hesap2`'yi tutan biri `hesap1`'i zaten almış olur; döngü kurulamaz.
  `sleep`'i silmek kilitlenmeyi yalnızca **daha nadir** yapar; bu en tehlikeli türden hatadır, çünkü
  testlerde görünmez, üretimde ortaya çıkar.
feedback:
  - Zamanlama değişir ama kötü sıralama hâlâ mümkün; hata sadece nadirleşir.
  - Doğru! Sabit kilit sırası döngüsel beklemeyi imkânsız kılar.
  - "Fazladan bir `Arc` katmanı kilitleme sırasını değiştirmez."
  - Kilitlenme thread'lerin içinde oluşuyor; `main`'in hangisini önce beklediği bunu çözmez.
```

## Zehirlenme (poisoning)

Bir thread kilidi tutarken **paniğe kapılırsa** ne olur? Bekçi drop edilir (panik sırasında da drop'lar
çalışır), kilit açılır; ama veri yarım kalmış bir güncellemenin ortasında olabilir. Rust bu durumda mutex'i
**zehirli (poisoned)** olarak işaretler: sonraki `lock()` çağrıları `Ok` yerine `Err(PoisonError)` döner.
İşte `unwrap`'ın sebebi buydu.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let envanter = Arc::new(Mutex::new(vec![10, 20, 30]));

    let e = Arc::clone(&envanter);
    let sonuc = thread::spawn(move || {
        let mut liste = e.lock().unwrap();
        liste.push(40);
        panic!("sayım sırasında beklenmedik hata!"); // kilit tutulurken panik
    })
    .join();

    println!("thread paniğe kapıldı mı? {}", sonuc.is_err());
    println!("mutex zehirli mi? {}", envanter.is_poisoned());

    // Veriyi yine de kurtarmak mümkün:
    let liste = match envanter.lock() {
        Ok(bekci) => bekci,
        Err(zehir) => zehir.into_inner(), // "riski biliyorum, veriyi ver"
    };
    println!("kurtarılan veri: {:?}", *liste);
}
```

Çoğu programda `lock().unwrap()` doğru seçimdir: bir thread kilitliyken paniklediyse veri tutarsız olabilir
ve paniği yaymak en güvenli davranıştır (Modül 10: panik = hata). Veriyi her durumda tutarlı tutabildiğinden
eminsen `into_inner()` ile kurtarabilir, `clear_poison()` ile zehri temizleyebilirsin.

## Alıştırmalar: sandık sayımı ve güvenli havale

```exercise
title: Paralel sandık sayımı
difficulty: 3
prompt: |
  Seçim gecesi her sandık **ayrı bir thread'de** sayılıyor ve bütün sonuçlar ortak bir tabloda toplanıyor.

  `oylari_say(sandiklar: Vec<Vec<String>>) -> HashMap<String, u32>` fonksiyonunu yaz:

  - Ortak tablo `Arc<Mutex<HashMap<String, u32>>>` olsun.
  - Her sandık için bir thread aç; thread sandıktaki her oy için adayın sayısını 1 artırsın.
  - Bütün thread'leri `join` ettikten sonra tabloyu döndür.
starter: |
  use std::collections::HashMap;
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn oylari_say(sandiklar: Vec<Vec<String>>) -> HashMap<String, u32> {
      todo!()
  }

  fn main() {
      let sandiklar = vec![
          vec![String::from("Ayşe"), String::from("Mehmet"), String::from("Ayşe")],
          vec![String::from("Elif"), String::from("Ayşe")],
      ];
      let sonuc = oylari_say(sandiklar);
      println!("Ayşe: {:?}", sonuc.get("Ayşe"));
  }
solution: |
  use std::collections::HashMap;
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn oylari_say(sandiklar: Vec<Vec<String>>) -> HashMap<String, u32> {
      let tablo = Arc::new(Mutex::new(HashMap::new()));
      let mut tutamaclar = Vec::new();

      for sandik in sandiklar {
          let tablo = Arc::clone(&tablo);
          tutamaclar.push(thread::spawn(move || {
              for oy in sandik {
                  *tablo.lock().unwrap().entry(oy).or_insert(0) += 1;
              }
          }));
      }
      for t in tutamaclar {
          t.join().unwrap();
      }

      Arc::try_unwrap(tablo)
          .expect("bütün thread'ler bitti, tek sahip kalmalı")
          .into_inner()
          .unwrap()
  }

  fn main() {
      let sandiklar = vec![
          vec![String::from("Ayşe"), String::from("Mehmet"), String::from("Ayşe")],
          vec![String::from("Elif"), String::from("Ayşe")],
      ];
      let sonuc = oylari_say(sandiklar);
      println!("Ayşe: {:?}", sonuc.get("Ayşe"));
  }
check: tests
tests: |
  fn sandik(oylar: &[&str]) -> Vec<String> {
      oylar.iter().map(|o| o.to_string()).collect()
  }

  #[test]
  fn uc_sandik_dogru_sayilir() {
      let s = oylari_say(vec![
          sandik(&["Ayşe", "Mehmet", "Ayşe"]),
          sandik(&["Elif", "Ayşe"]),
          sandik(&["Mehmet"]),
      ]);
      assert_eq!(s.get("Ayşe"), Some(&3), "Ayşe 3 oy almalı");
      assert_eq!(s.get("Mehmet"), Some(&2), "Mehmet 2 oy almalı");
      assert_eq!(s.get("Elif"), Some(&1), "Elif 1 oy almalı");
      assert_eq!(s.len(), 3, "tabloda yalnızca oy alan 3 aday olmalı");
  }

  #[test]
  fn cok_sandikta_oy_kaybolmaz() {
      let sandiklar: Vec<Vec<String>> = (0..8).map(|_| sandik(&["Can"; 250])).collect();
      let s = oylari_say(sandiklar);
      assert_eq!(s.get("Can"), Some(&2000), "8 sandık × 250 oy = 2000; eşzamanlı artışlar kaybolmamalı");
  }

  #[test]
  fn bos_secim() {
      assert!(oylari_say(vec![]).is_empty(), "sandık yoksa tablo boş olmalı");
      assert!(oylari_say(vec![vec![], vec![]]).is_empty(), "boş sandıklar tabloya aday eklememeli");
  }
hints:
  - "Önce `let tablo = Arc::new(Mutex::new(HashMap::new()));`. Her sandık için `let tablo = Arc::clone(&tablo);` yazıp `thread::spawn(move || ...)` aç."
  - "Thread içinde her oy için: `*tablo.lock().unwrap().entry(oy).or_insert(0) += 1;` (entry API, Modül 9). Tutamaçları biriktirip hepsini `join` et."
  - "Sonucu çıkarmanın iki yolu var: `tablo.lock().unwrap().clone()` ya da kopyasız `Arc::try_unwrap(tablo).unwrap().into_inner().unwrap()`."
require:
  - pattern: "Arc::"
    message: Tabloyu thread'ler arasında `Arc` ile paylaş.
  - pattern: "Mutex"
    message: Ortak tabloyu bir `Mutex` ile koru.
  - pattern: "thread::spawn"
    message: Her sandık ayrı bir thread'de sayılmalı.
explanation: |
  Kalıp yine aynı: **`Arc::new(Mutex::new(veri))` → her thread'e `Arc::clone` → içeride `lock()` → `join`.**
  `entry(oy).or_insert(0)` (Modül 9) adayı ilk oyunda tabloya ekliyor ve sayacına `&mut` veriyor.

  Sonucu çıkarırken `Arc::try_unwrap(tablo)` kullandık: `Arc`'ın **tek** sahibi kaldıysa içindeki değeri
  `Ok` ile geri verir (yoksa `Err`). Bütün thread'ler `join` edildiği için klonların hepsi drop edildi,
  yani bu güvenli. Ardından `Mutex::into_inner()` mutex'i tüketip `HashMap`'i kopyasız teslim ediyor.
  Daha basit alternatif `tablo.lock().unwrap().clone()` da doğru, sadece tabloyu bir kez kopyalar.

  **Performans notu:** her oy için kilit almak, thread'leri sürekli birbirini bekletir (kilit çekişmesi,
  lock contention). Daha hızlı bir tasarım: her thread önce **kendi yerel** `HashMap`'inde sayar, en sonda
  kilidi **bir kez** alıp sonuçlarını ortak tabloya ekler. Hatta hiç kilit kullanmadan her thread yerel
  tablosunu `join` ile döndürebilir ve ana thread birleştirir; bu, 5. dersteki paralel kelime sayımının fikri.
```

```exercise
title: Kilitlenmeyen havale
difficulty: 4
prompt: |
  Her `Hesap`'ın bir numarası (`id`) ve `Mutex` ile korunan bir bakiyesi var. Aynı anda birçok thread iki
  yönlü havale yapıyor. `transfer(kaynak: &Hesap, hedef: &Hesap, miktar: i64) -> Result<(), String>`
  fonksiyonunu **kilitlenme olmadan** yaz:

  - `miktar` pozitif değilse `Err` döndür.
  - `kaynak` ve `hedef` aynı hesapsa (`id`'leri eşit) `Err` döndür. (Neden kilitlemeden önce kontrol etmen
    gerektiğini düşün!)
  - İki kilidi de tutarken bakiye yetmiyorsa `Err` döndür ve hiçbir bakiyeyi değiştirme.
  - Yetiyorsa kaynaktan düş, hedefe ekle, `Ok(())` döndür.
  - Kilitlenmeyi önlemek için iki hesabı **her zaman küçük `id`'den büyüğe** doğru kilitle.
starter: |
  use std::sync::Mutex;

  struct Hesap {
      id: u32,
      bakiye: Mutex<i64>,
  }

  impl Hesap {
      fn yeni(id: u32, bakiye: i64) -> Hesap {
          Hesap { id, bakiye: Mutex::new(bakiye) }
      }

      fn bakiye(&self) -> i64 {
          *self.bakiye.lock().unwrap()
      }
  }

  fn transfer(kaynak: &Hesap, hedef: &Hesap, miktar: i64) -> Result<(), String> {
      todo!()
  }

  fn main() {
      let a = Hesap::yeni(1, 500);
      let b = Hesap::yeni(2, 100);
      println!("{:?}", transfer(&a, &b, 200));
      println!("{} {}", a.bakiye(), b.bakiye());
  }
solution: |
  use std::sync::Mutex;

  struct Hesap {
      id: u32,
      bakiye: Mutex<i64>,
  }

  impl Hesap {
      fn yeni(id: u32, bakiye: i64) -> Hesap {
          Hesap { id, bakiye: Mutex::new(bakiye) }
      }

      fn bakiye(&self) -> i64 {
          *self.bakiye.lock().unwrap()
      }
  }

  fn transfer(kaynak: &Hesap, hedef: &Hesap, miktar: i64) -> Result<(), String> {
      if miktar <= 0 {
          return Err(format!("geçersiz miktar: {miktar}"));
      }
      if kaynak.id == hedef.id {
          return Err(String::from("aynı hesaba havale yapılamaz"));
      }

      // Kilitleri her zaman küçük id'den büyüğe doğru al.
      let kaynak_once = kaynak.id < hedef.id;
      let (ilk, ikinci) = if kaynak_once { (kaynak, hedef) } else { (hedef, kaynak) };
      let mut ilk_bekci = ilk.bakiye.lock().unwrap();
      let mut ikinci_bekci = ikinci.bakiye.lock().unwrap();
      let (k, h) = if kaynak_once {
          (&mut *ilk_bekci, &mut *ikinci_bekci)
      } else {
          (&mut *ikinci_bekci, &mut *ilk_bekci)
      };

      if *k < miktar {
          return Err(format!("yetersiz bakiye: {} TL var, {miktar} TL isteniyor", *k));
      }
      *k -= miktar;
      *h += miktar;
      Ok(())
  }

  fn main() {
      let a = Hesap::yeni(1, 500);
      let b = Hesap::yeni(2, 100);
      println!("{:?}", transfer(&a, &b, 200));
      println!("{} {}", a.bakiye(), b.bakiye());
  }
check: tests
tests: |
  use std::sync::Arc;
  use std::thread;

  #[test]
  fn basarili_havale_iki_yonde() {
      let a = Hesap::yeni(1, 500);
      let b = Hesap::yeni(2, 100);
      assert!(transfer(&a, &b, 200).is_ok(), "500 TL'den 200 TL gönderilebilmeli");
      assert_eq!((a.bakiye(), b.bakiye()), (300, 300), "kaynaktan düşülmeli, hedefe eklenmeli");
      assert!(transfer(&b, &a, 50).is_ok(), "büyük id'den küçüğe havale de çalışmalı");
      assert_eq!((a.bakiye(), b.bakiye()), (350, 250));
  }

  #[test]
  fn hatali_havaleler_bakiyeye_dokunmaz() {
      let a = Hesap::yeni(7, 100);
      let b = Hesap::yeni(3, 0);
      assert!(transfer(&a, &b, 150).is_err(), "bakiye yetmiyorsa Err dönmeli");
      assert!(transfer(&a, &b, 0).is_err(), "0 TL havale geçersiz");
      assert!(transfer(&a, &b, -20).is_err(), "negatif miktar geçersiz");
      assert_eq!((a.bakiye(), b.bakiye()), (100, 0), "başarısız havaleler bakiyeyi değiştirmemeli");
  }

  #[test]
  fn ayni_hesaba_havale_kilitlenmez() {
      let a = Hesap::yeni(5, 100);
      assert!(transfer(&a, &a, 10).is_err(), "aynı hesaba havale Err dönmeli (ve asla kilitlenmemeli)");
      assert_eq!(a.bakiye(), 100);
  }

  #[test]
  fn ters_yonlu_eszamanli_havaleler() {
      let a = Arc::new(Hesap::yeni(1, 1000));
      let b = Arc::new(Hesap::yeni(2, 1000));
      let mut isler = Vec::new();
      for i in 0..4 {
          let (a, b) = (Arc::clone(&a), Arc::clone(&b));
          isler.push(thread::spawn(move || {
              for _ in 0..2000 {
                  if i % 2 == 0 {
                      let _ = transfer(&a, &b, 1);
                  } else {
                      let _ = transfer(&b, &a, 1);
                  }
              }
          }));
      }
      for t in isler {
          t.join().unwrap();
      }
      assert_eq!(a.bakiye() + b.bakiye(), 2000, "toplam para korunmalı: yoktan para çıkmamalı, kaybolmamalı");
  }
hints:
  - "Önce ucuz kontrolleri yap: `miktar <= 0` ve `kaynak.id == hedef.id`. Aynı mutex'i iki kez kilitlemek kendi kendini kilitler; bu yüzden aynı hesap kontrolü kilitlerden **önce** gelmeli."
  - "Hangi hesabın önce kilitleneceğini id'ye göre seç: `let (ilk, ikinci) = if kaynak.id < hedef.id { (kaynak, hedef) } else { (hedef, kaynak) };` Sonra iki bekçiyi bu sırayla al."
  - "Bekçilerden kaynak ve hedef için `&mut i64` elde et: `(&mut *ilk_bekci, &mut *ikinci_bekci)` ya da ters sırası. Bakiye yetmiyorsa `return Err(...)`; yetiyorsa `*k -= miktar; *h += miktar;`."
explanation: |
  İki thread aynı iki hesabı ters yönlerde havale ederken, kilitleri "önce kaynak, sonra hedef" sırasıyla
  alsaydık klasik kilitlenme oluşurdu: biri `1`'i, diğeri `2`'yi tutup birbirini beklerdi. Kilit sırasını
  **havale yönünden bağımsız** bir kurala (küçük `id` önce) bağlayınca döngüsel bekleme imkânsızlaşır.
  Son test 8000 eşzamanlı havaleyle bunu zorluyor.

  Aynı hesap kontrolü neden önemli? `transfer(&a, &a, 10)` çağrısında iki bekçi de **aynı mutex**'i
  isterdi; ikinci `lock` kendi tuttuğun kilidi beklerdi. Bu yüzden kontrol kilitlerden önce.

  Bakiyeyi kontrol ederken iki kilidi de **tutuyoruz**. Önce kaynağı kilitleyip kontrol edip bırakıp sonra
  iki kilidi alsaydık, arada başka bir thread aynı parayı çekebilirdi (**kontrol-sonra-kullan yarışı**,
  TOCTOU). Rust bu tür mantık yarışlarını yakalayamaz; doğru kilit kapsamını seçmek tasarımın işi.

  Rust'ın garantisi şu: bu kodda **veri yarışı** olamaz; bakiyeye kilit almadan dokunmanın yolu yok.
  Kilitlenmeyi önlemek ise sabit kilit sırası gibi disiplinlerle senin görevin.
```

## Özet

:::remember
- `Mutex<T>` veriyi **içinde** tutar; `lock()` → `LockResult<MutexGuard<T>>`. Kilit almadan veriye ulaşılamaz.
- `MutexGuard` drop edilince kilit açılır (RAII). Kilidi kısa tut; standart `Mutex` tekrar girilebilir değildir.
- `Rc` `Send` değildir (atomik olmayan sayaç) → thread'lerde `E0277`. Çözüm: **`Arc`** (atomik sayaç).
- Paylaşılan değiştirilebilir veri: `Arc<Mutex<T>>` (tek thread'deki `Rc<RefCell<T>>`'nin karşılığı).
- Rust veri yarışını önler, **kilitlenmeyi** değil → kilitleri hep aynı sırayla al.
- Kilit tutulurken panik → mutex **zehirlenir**; `lock()` `Err(PoisonError)` döner (`into_inner` ile kurtarılabilir).
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla - `Arc<Mutex<T>>` içindeki iki katmanın her biri hangi sorunu çözüyor?
  Yalnızca `Arc<T>` ya da yalnızca `Mutex<T>` neden yetmez?
answer: |
  `Arc` **sahiplik** sorununu çözer: aynı veriye birden çok thread'in sahip olmasını sağlar ve son sahip
  bırakınca veriyi serbest bırakır; sayacı atomik olduğu için thread'ler arasında güvenlidir. Ama `Arc`
  yalnızca paylaşılan (değişmez) erişim verir. `Mutex` ise **erişim** sorununu çözer: aynı anda yalnızca
  bir thread'in veriyi değiştirmesine izin verir. Tek başına `Mutex` thread'lere taşınınca ilk thread'e
  geçer (tek sahip); tek başına `Arc` ise veriyi değiştirmeye izin vermez. İkisi birlikte "çok sahipli +
  güvenle değiştirilebilir" veri sağlar.
```

```flashcards
- front: "`m.lock()` ne döndürür?"
  back: "`LockResult<MutexGuard<T>>`: başarıda bekçi (`Ok`), mutex zehirliyse `Err(PoisonError)`."
- front: Bir `Mutex`'in kilidi ne zaman açılır?
  back: "`lock()`'un döndürdüğü `MutexGuard` drop edildiğinde (kapsam sonu, `;` sonundaki geçici değer ya da `drop(bekci)`)."
- front: "`Rc<T>` neden thread'ler arasında gönderilemez?"
  back: "Referans sayacı atomik değildir; eşzamanlı clone/drop sayacı bozabilir. Bu yüzden `Rc` `Send` değildir (`E0277`)."
- front: "`Arc` ile `Rc` arasındaki tek fark nedir?"
  back: "`Arc`'ın referans sayacı atomik işlemlerle güncellenir: thread'ler arasında güvenli ama biraz daha pahalı."
- front: "`Rc<RefCell<T>>`'nin çok thread'li karşılığı nedir?"
  back: "`Arc<Mutex<T>>` (okuma ağırlıklı veride `Arc<RwLock<T>>`)."
- front: İki thread'in kilitlenmesini (deadlock) önlemenin en temel kuralı nedir?
  back: Birden çok kilit gerektiğinde herkesin kilitleri her zaman aynı sırayla alması.
- front: Mutex zehirlenmesi (poisoning) ne zaman olur?
  back: Bir thread kilidi tutarken paniğe kapıldığında; sonraki `lock()` çağrıları `Err(PoisonError)` döndürür.
- front: Aynı thread aynı `Mutex`'i iki kez `lock()` ederse ne olur?
  back: İkinci çağrı başarıyla dönmez (kilitlenir ya da panikler); standart `Mutex` tekrar girilebilir değildir.
