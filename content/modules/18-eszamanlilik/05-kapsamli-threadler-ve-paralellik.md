---
id: m18-l05
title: Kapsamlı thread'ler ve paralellik araçları
minutes: 24
type: lesson
objectives:
  - "`thread::scope` ile yerel veriyi `Arc` ve kopya olmadan thread'lere ödünç verebilmek"
  - "`rayon`'un `par_iter`'i ile sıralı bir iterator zincirini paralelleştirebilmek"
  - "`OnceLock` ve `LazyLock` ile thread güvenli global değerleri bir kez başlatabilmek"
  - "`Condvar` ve `Barrier`'ın hangi koordinasyon sorununu çözdüğünü açıklayabilmek"
keywords: ["thread::scope", rayon, "par_iter", OnceLock, LazyLock, Condvar, Barrier, "veri paralelliği", "work stealing"]
---

Şimdiye kadar her thread'e verdiğimiz veri ya **taşındı** (`move`), ya **kopyalandı** (`to_vec`), ya da
`Arc` ile **paylaşıldı**. Hepsinin sebebi aynıydı: `thread::spawn`'ın `'static` şartı. Ama çoğu zaman
istediğimiz çok basit: "Şu yerel diziyi dört parçaya böl, dört thread aynı anda işlesin, hepsi bitince
devam edeyim." Bu son derste bunu **tek satır `Arc` yazmadan** yapmayı, `rayon` ile bir iterator'ı tek
kelimeyle paralelleştirmeyi ve birkaç koordinasyon aracını öğreneceksin. Sonunda da bütün modülü bir araya
getiren paralel bir kelime sayacı yazacaksın.

## `thread::scope`: yerel veriyi ödünç vermek

Rust 1.63'ten beri standart kütüphanede **kapsamlı thread'ler (scoped threads)** var:

```rust
use std::thread;

fn main() {
    let sicakliklar = vec![12.5, 14.0, 9.5, 18.0, 21.5, 16.0];

    let (en_dusuk, ortalama) = thread::scope(|s| {
        let h1 = s.spawn(|| sicakliklar.iter().cloned().fold(f64::MAX, f64::min));
        let h2 = s.spawn(|| sicakliklar.iter().sum::<f64>() / sicakliklar.len() as f64);
        (h1.join().unwrap(), h2.join().unwrap())
    }); // ← kapsam burada biter: içinde açılan bütün thread'ler bitmiş olmak ZORUNDA

    println!("En düşük: {en_dusuk}, ortalama: {ortalama:.2}");
    println!("Veri hâlâ bizim: {} ölçüm", sicakliklar.len());
}
```

`move` yok, `Arc` yok, kopya yok; iki thread de `sicakliklar`'ı doğrudan **ödünç** alıyor. Nasıl mümkün?

- `thread::scope(|s| { ... })` bir **kapsam** açar ve `s` ile bu kapsama bağlı thread'ler başlatırsın.
- `scope` fonksiyonu, içinde açılan **bütün thread'ler bitene kadar dönmez**; `join` etmediklerini kendisi
  `join` eder.
- Bu garanti sayesinde derleyici, thread'lerin `sicakliklar`'dan **daha kısa** yaşadığını kanıtlayabilir.
  Böylece `'static` yerine kapsamın ömrü (`'scope`) yeterli olur: `F: FnOnce() -> T + Send + 'scope`.

```memory
title: thread::scope içinde ödünç alma
steps:
  - caption: "`sicakliklar` `main`'in stack'inde, elemanlar heap'te."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: sicakliklar, type: "Vec<f64>", value: "ptr · len=6 · cap=6", to: h1 }
    heap:
      - { id: h1, value: "12.5 14.0 9.5 18.0 21.5 16.0" }
  - caption: "Kapsam içinde iki thread de `&sicakliklar` tutuyor. Sahip hâlâ `main`; ikisi de sadece okuyor."
    stack:
      - frame: "ana thread · main (scope'ta bekliyor)"
        vars:
          - { name: sicakliklar, type: "Vec<f64>", value: "ptr · len=6 · cap=6", to: h1 }
      - frame: "kapsamlı thread #1"
        vars:
          - { name: "&sicakliklar", type: "&Vec<f64>", value: "ödünç", to: sicakliklar }
      - frame: "kapsamlı thread #2"
        vars:
          - { name: "&sicakliklar", type: "&Vec<f64>", value: "ödünç", to: sicakliklar }
    heap:
      - { id: h1, value: "12.5 14.0 9.5 18.0 21.5 16.0" }
  - caption: "`scope` döndü: thread'ler ve ödünçler bitti. `main` veriyi kullanmaya devam ediyor."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: sicakliklar, type: "Vec<f64>", value: "ptr · len=6 · cap=6", to: h1 }
          - { name: ortalama, type: f64, value: "15.25" }
    heap:
      - { id: h1, value: "12.5 14.0 9.5 18.0 21.5 16.0" }
```

:::analogy Kütüphanenin okuma salonu
Normal thread, kitabı **eve götüren** okuyucu gibidir: ne zaman getireceği belli olmadığı için kütüphane
ya kitabı ona hediye eder (`move`), ya fotokopisini verir (`clone`), ya da ortak mülkiyete geçirir (`Arc`).
Kapsamlı thread ise **okuma salonundaki** okuyucudur: salon kapanmadan herkes kitabı masaya bırakmak
zorundadır. Kütüphaneci bunu bildiği için kitabı gönül rahatlığıyla ödünç verir.
:::

Ödünç alma kuralları (Modül 5) thread'ler arasında da **aynen** geçerli. Tahmin et:

```compiles
code: |
  use std::thread;

  fn main() {
      let mut toplam = 0;
      thread::scope(|s| {
          s.spawn(|| toplam += 1);
          s.spawn(|| toplam += 2);
      });
      println!("{toplam}");
  }
answer: false
error: E0499
explanation: |
  İki closure da `toplam`'ı **değiştirmek** için yakalıyor, yani ikisi de `&mut toplam` tutuyor ve iki
  thread aynı anda yaşıyor. Aynı anda iki `&mut`: `E0499`. Bu, tam olarak bir **veri yarışı**: iki thread
  aynı değişkene eşzamanlı yazıyor. Tek thread'de öğrendiğin kural, çok thread'de veri yarışı korumasına
  dönüşüyor. Çözüm: bir `AtomicI32` ya da `Mutex` kullanmak veya her thread'in kendi sonucunu döndürüp
  toplamayı ana thread'de yapmak.
```

:::error
```text
error[E0499]: cannot borrow `toplam` as mutable more than once at a time
   --> src/main.rs:7:17
    |
  5 |     thread::scope(|s| {
    |                    - has type `&'1 Scope<'1, '_>`
  6 |         s.spawn(|| toplam += 1);
    |         -----------------------
    |         |       |  |
    |         |       |  first borrow occurs due to use of `toplam` in closure
    |         |       first mutable borrow occurs here
    |         argument requires that `toplam` is borrowed for `'1`
  7 |         s.spawn(|| toplam += 2);
    |                 ^^ ------ second borrow occurs due to use of `toplam` in closure
    |                 |
    |                 second mutable borrow occurs here
```
"argument requires that `toplam` is borrowed for `'1`": ödünç, kapsamın sonuna kadar sürmek zorunda;
o yüzden ikinci `&mut` ilkinin bitmesini bekleyemez.
:::

Ama **ayrık** parçaları değiştirmek serbest. Modül 5'teki `split_at_mut`'ı hatırla:

```predict
code: |
  use std::thread;

  fn main() {
      let mut fiyatlar = [100, 200, 300, 400];
      let (sol, sag) = fiyatlar.split_at_mut(2);
      thread::scope(|s| {
          s.spawn(|| {
              for f in sol.iter_mut() {
                  *f += 10;
              }
          });
          s.spawn(|| {
              for f in sag.iter_mut() {
                  *f *= 2;
              }
          });
      });
      println!("{fiyatlar:?}");
  }
options:
  - "[110, 210, 600, 800]"
  - "[220, 420, 600, 800]"
  - "Her çalıştırmada farklı bir sonuç"
  - "Derlenmez: `fiyatlar` iki thread'de aynı anda değiştirilemez"
answer: 0
explanation: |
  `split_at_mut(2)` diziyi **çakışmayan** iki `&mut` dilime ayırır: `sol = [100, 200]`, `sag = [300, 400]`.
  Her thread yalnızca kendi dilimine yazıyor; aynı belleğe iki yazar yok, yani veri yarışı yok ve derleyici
  bunu kanıtlayabildiği için kabul ediyor. Sonuç deterministik: sol +10, sağ ×2. `scope` bitince iki ödünç de
  biter ve `fiyatlar` yeniden yazdırılabilir.
```

## `rayon`: veri paralelliği tek kelimeyle

Bir koleksiyonun her elemanına aynı işi uygulamak (**veri paralelliği, data parallelism**) o kadar yaygındır
ki bunun için Rust ekosisteminin en sevilen crate'lerinden biri var: **`rayon`**. Projene `cargo add rayon`
ile eklersin (Modül 8); bu uygulamada çevrimiçi çalıştırıldığında hazır gelir.

```rust
use rayon::prelude::*;

fn agir_puan(n: u64) -> u64 {
    // yapay olarak "pahalı" bir hesap
    (0..n % 200).fold(n, |acc, i| (acc ^ i).wrapping_mul(31) % 1_000_007)
}

fn main() {
    let kimlikler: Vec<u64> = (1..=50_000).collect();

    let sirali: u64 = kimlikler.iter().map(|&k| agir_puan(k)).sum();
    let paralel: u64 = kimlikler.par_iter().map(|&k| agir_puan(k)).sum();

    println!("Aynı sonuç mu? {}", sirali == paralel);
    println!("rayon {} thread kullanıyor", if rayon::current_num_threads() > 1 { "birden çok" } else { "tek" });
}
```

Tek fark: `iter()` → `par_iter()`. `rayon` arka planda çekirdek sayısı kadar thread'lik bir **havuz (thread
pool)** kurar ve işi parçalara böler. Bir thread kendi işini bitirince başkasının kuyruğundan iş **çalar**
(**work stealing**); böylece bazı elemanlar diğerlerinden pahalı olsa bile çekirdekler boş kalmaz.

- `into_par_iter()` sahipliği alır, `par_iter_mut()` elemanları değiştirir; aralıklar da çalışır:
  `(1..=n).into_par_iter()`.
- `map`, `filter`, `sum`, `count`, `min`, `max`, `any`, `find_any`... iterator API'sinin büyük kısmı aynı.
- Dizinli (indexed) kaynaklarda `collect()` **sırayı korur**: `v.par_iter().map(f).collect::<Vec<_>>()`
  sonucu `v`'nin sırasıyla verir. Paralellik çıktının sırasını bozmaz!
- `par_sort()`, `par_sort_unstable()` büyük dilimleri paralel sıralar; `rayon::join(a, b)` iki closure'ı
  paralel çalıştırır.

```fill
prompt: Sınav notlarını paralel işle, geçen öğrencileri say ve notların toplamını bul.
code: |
  use rayon::prelude::*;

  fn main() {
      let notlar: Vec<u32> = vec![72, 85, 90, 45, 60, 98];
      let gecen = notlar.___0().filter(|&&n| n >= 60).count();
      let toplam: u32 = notlar.par_iter().___1();
      println!("{gecen} {toplam}");
  }
blanks:
  - ["par_iter"]
  - ["sum"]
output: "5 450"
explanation: |
  `par_iter()` `&u32` elemanları üreten paralel bir iterator verir; bu yüzden `filter` closure'ı `&&u32`
  alıyor (`iter().filter` ile aynı durum, Modül 14). `sum()` da paralel çalışır: her thread kendi parçasını
  toplar, sonra ara toplamlar birleştirilir. Toplama sıradan bağımsız olduğu için sonuç hep `450`.
```

`rayon` sana thread güvenliğinden taviz verdirmez. Sıralı kodda masum görünen bir şeyi dene:

```compiles
code: |
  use rayon::prelude::*;

  fn main() {
      let sayilar: Vec<u64> = (1..=10).collect();
      let mut ciftler = Vec::new();
      sayilar.par_iter().for_each(|&n| {
          if n % 2 == 0 {
              ciftler.push(n);
          }
      });
      println!("{ciftler:?}");
  }
answer: false
error: E0596
explanation: |
  `rayon`'un `for_each`'i bir **`Fn`** closure ister (Modül 14), çünkü aynı closure birçok thread'den
  **aynı anda** çağrılır. `ciftler.push` ise `&mut ciftler` gerektirir; bu da closure'ı `FnMut` yapar. Derleyici:
  *"cannot borrow `ciftler` as mutable, as it is a captured variable in a `Fn` closure"*. Birden çok thread'in
  aynı `Vec`'e kilitsiz `push` yapması bir veri yarışı olurdu. İdiomatik çözüm, yan etkiyi bırakıp
  sonucu **toplamak**: `let ciftler: Vec<u64> = sayilar.par_iter().filter(|&&n| n % 2 == 0).cloned().collect();`
```

:::tip Paralellik her zaman hızlandırmaz
İş parçası çok küçükse (ör. 100 sayının toplamı) iş bölme ve birleştirme maliyeti kazancı yer; paralel kod
**daha yavaş** olabilir. Önce sıralı yaz, ölç (Modül 16'daki `--release`'i unutma), darboğaz gerçekten
CPU'daysa `par_iter`'e geç. Ağ ve disk bekleyen (I/O) işler için doğru araç thread havuzu değil, **async**'tir
(Modül 19).
:::

## Global değerleri bir kez başlatmak: `OnceLock` ve `LazyLock`

`static` değerlerin (Modül 2) başlangıç değeri **derleme zamanında** hesaplanabilmelidir: `HashMap::new()`
ya da bir dosyadan okunan ayarlar `static`'e doğrudan yazılamaz. Çözüm, değeri **ilk kullanıldığı anda,
yalnızca bir kez** hesaplamak. Birden çok thread aynı anda "ilk" olmaya çalışırsa ne olacak? Standart
kütüphane bunu senin yerine çözer:

- **`LazyLock<T>`** (Rust 1.80): başlatma fonksiyonunu tanımda verirsin; ilk erişimde çalışır.
- **`OnceLock<T>`** (Rust 1.70): boş başlar; değeri sonradan `get_or_init(|| ...)` ya da `set(...)` ile bir kez
  koyarsın. `set` ikinci kez çağrılırsa `Err` döner.

Bunlar eskiden `lazy_static` ve `once_cell` crate'leriyle yapılırdı; artık standart kütüphanede.

```predict
code: |
  use std::collections::HashMap;
  use std::sync::LazyLock;

  static IL_KODLARI: LazyLock<HashMap<u8, &str>> = LazyLock::new(|| {
      println!("tablo hazırlanıyor");
      HashMap::from([(6, "Ankara"), (34, "İstanbul"), (35, "İzmir")])
  });

  fn main() {
      println!("program başladı");
      println!("{}", IL_KODLARI[&34]);
      println!("{}", IL_KODLARI[&6]);
  }
options:
  - |
    tablo hazırlanıyor
    program başladı
    İstanbul
    Ankara
  - |
    program başladı
    tablo hazırlanıyor
    İstanbul
    Ankara
  - |
    program başladı
    tablo hazırlanıyor
    İstanbul
    tablo hazırlanıyor
    Ankara
answer: 1
explanation: |
  `LazyLock` **tembeldir**: program başladığında hiçbir şey yapmaz. `IL_KODLARI`'na ilk erişildiği anda
  (`[&34]`) başlatma closure'ı çalışır ve sonuç saklanır; sonraki erişimler aynı tabloyu kullanır, closure
  bir daha çalışmaz. Birden çok thread aynı anda ilk erişimi yapsaydı da closure yalnızca **bir kez** çalışır,
  diğerleri onun bitmesini bekler.
```

```rust
use std::sync::OnceLock;
use std::thread;

static SUNUCU_ADI: OnceLock<String> = OnceLock::new();

fn sunucu_adi() -> &'static str {
    SUNUCU_ADI.get_or_init(|| {
        println!("(ayar bir kez okunuyor)");
        String::from("istanbul-01")
    })
}

fn main() {
    let isciler: Vec<_> = (0..4).map(|_| thread::spawn(|| sunucu_adi().len())).collect();
    let uzunluklar: Vec<usize> = isciler.into_iter().map(|h| h.join().unwrap()).collect();
    println!("{uzunluklar:?}");
    println!("ikinci set denemesi: {:?}", SUNUCU_ADI.set(String::from("ankara-02")));
}
```

Dört thread aynı anda `get_or_init` çağırsa da "(ayar bir kez okunuyor)" yalnızca **bir kez** yazılır.
`get_or_init` bir `&'static str` döndürebiliyor çünkü değer `static`'in içinde, programın sonuna kadar yaşıyor
(Modül 12).

## Koordinasyon: `Condvar` ve `Barrier` (kısaca)

Bazen veri paylaşmak değil, thread'leri **zamanlamak** gerekir.

**`Condvar` (koşul değişkeni)**, bir thread'in bir koşul gerçekleşene kadar **CPU harcamadan uyumasını**
sağlar. Her zaman bir `Mutex` ile birlikte kullanılır: koşul mutex'in içindeki veridir.

```rust
use std::sync::{Arc, Condvar, Mutex};
use std::thread;

fn main() {
    let durum = Arc::new((Mutex::new(false), Condvar::new()));

    let d = Arc::clone(&durum);
    let garson = thread::spawn(move || {
        let (hazir, sinyal) = &*d;
        // Koşul sağlanana kadar uyu (kilit uyurken bırakılır, uyanınca geri alınır)
        let _bekci = sinyal.wait_while(hazir.lock().unwrap(), |h| !*h).unwrap();
        "Garson: sipariş masaya götürüldü"
    });

    {
        let (hazir, sinyal) = &*durum;
        *hazir.lock().unwrap() = true; // aşçı: yemek hazır
        sinyal.notify_one(); // bekleyen bir thread'i uyandır
    }
    println!("{}", garson.join().unwrap());
}
```

**`Barrier` (bariyer)** ise "herkes buraya gelene kadar kimse devam etmesin" der: `Barrier::new(n)` ve her
thread'de `bariyer.wait()`. `n`. thread gelince hepsi aynı anda yola çıkar. Aşamalı paralel algoritmalarda
(herkes 1. aşamayı bitirmeden 2. aşama başlamasın) kullanılır.

```rust
use std::sync::{Arc, Barrier};
use std::thread;

fn main() {
    let start = Arc::new(Barrier::new(3));
    let kosucular: Vec<_> = ["Ece", "Burak", "Selin"]
        .into_iter()
        .map(|ad| {
            let start = Arc::clone(&start);
            thread::spawn(move || {
                // ... ısınma ...
                let sonuc = start.wait(); // üçü de gelene kadar bekle
                (ad, sonuc.is_leader())
            })
        })
        .collect();

    let mut lider_sayisi = 0;
    for k in kosucular {
        let (_ad, lider) = k.join().unwrap();
        if lider {
            lider_sayisi += 1;
        }
    }
    println!("Herkes aynı anda çıktı; bariyerin tek bir lideri var: {lider_sayisi}");
}
```

````quiz
question: |
  `Condvar` ile beklerken neden `wait` yerine `wait_while` (ya da bir `while` döngüsü içinde `wait`)
  kullanılır?

  ```rust
  while !*hazir {
      hazir = sinyal.wait(hazir).unwrap();
  }
  ```
options:
  - Çünkü `wait` yalnızca bir kez çalışabilir, döngü onu tekrar tekrar çağırır
  - "Çünkü bir thread **sahte uyanma (spurious wakeup)** ile ya da koşul başkası tarafından tekrar bozulmuşken uyanabilir; koşulu uyanınca yeniden kontrol etmek gerekir"
  - Çünkü döngü olmadan derleyici `E0382` hatası verir
answer: 1
explanation: |
  İşletim sistemleri, bir `Condvar` üzerinde bekleyen thread'i ortada bir `notify` yokken de uyandırabilir
  (**sahte uyanma**). Ayrıca `notify_all` ile birden çok thread uyanmışsa, ilk uyanan koşulu tekrar
  değiştirmiş olabilir. Bu yüzden kural: **uyanınca koşulu yeniden kontrol et.** `wait_while(bekci, |h| !*h)`
  bu döngüyü senin yerine yazar.
feedback:
  - "`wait` istediğin kadar çağrılabilir; asıl mesele uyanışın koşulun sağlandığını garanti etmemesi."
  - Doğru! Uyanmak, koşulun doğru olduğu anlamına gelmez.
  - Bu bir derleme kuralı değil; döngüsüz kod derlenir ama yanlış çalışabilir.
````

## Alıştırmalar: paralel asal tablosu ve kelime sayacı

İlk alıştırma ısınma: sıralı bir iterator zincirini `rayon` ile paralelleştir.

```exercise
title: Asal sayı tablosu (rayon)
difficulty: 2
prompt: |
  Şifreleme ekibi `sinir`'e kadar (dahil) kaç asal sayı olduğunu hızlıca bilmek istiyor. `asal_mi` hazır.
  `asal_say(sinir: u64) -> usize` fonksiyonunu **`rayon` ile paralel** yaz.
starter: |
  use rayon::prelude::*;

  fn asal_mi(n: u64) -> bool {
      if n < 2 {
          return false;
      }
      let mut d = 2;
      while d * d <= n {
          if n % d == 0 {
              return false;
          }
          d += 1;
      }
      true
  }

  fn asal_say(sinir: u64) -> usize {
      todo!()
  }

  fn main() {
      println!("{}", asal_say(100));
  }
solution: |
  use rayon::prelude::*;

  fn asal_mi(n: u64) -> bool {
      if n < 2 {
          return false;
      }
      let mut d = 2;
      while d * d <= n {
          if n % d == 0 {
              return false;
          }
          d += 1;
      }
      true
  }

  fn asal_say(sinir: u64) -> usize {
      (0..=sinir).into_par_iter().filter(|&n| asal_mi(n)).count()
  }

  fn main() {
      println!("{}", asal_say(100));
  }
check: tests
tests: |
  #[test]
  fn kucuk_sinirlar() {
      assert_eq!(asal_say(10), 4, "10'a kadar asallar: 2, 3, 5, 7");
      assert_eq!(asal_say(2), 1, "sınır dahil olmalı: 2 asaldır");
  }

  #[test]
  fn asal_olmayan_kenarlar() {
      assert_eq!(asal_say(0), 0, "0'a kadar asal yok");
      assert_eq!(asal_say(1), 0, "1 asal değildir");
  }

  #[test]
  fn buyuk_sinir() {
      assert_eq!(asal_say(100), 25, "100'e kadar 25 asal var");
      assert_eq!(asal_say(20_000), 2262, "20 000'e kadar 2262 asal var");
  }
hints:
  - "Sıralı hâli şöyle olurdu: `(0..=sinir).filter(|&n| asal_mi(n)).count()`."
  - "Bir aralığı paralel iterator'a çevirmek için `into_par_iter()` kullanılır (aralık kendi elemanlarını üretir, ödünç alınacak bir koleksiyon yok)."
  - "`(0..=sinir).into_par_iter().filter(|&n| asal_mi(n)).count()`"
require:
  - pattern: "par_iter"
    message: "Hesabı `rayon` ile paralel yap (`par_iter` / `into_par_iter`)."
explanation: |
  Sıralı çözümden tek farkı `into_par_iter()`. `asal_mi` saf bir fonksiyon (dış duruma dokunmuyor), bu yüzden
  her sayıyı hangi thread'in kontrol ettiği önemsiz ve `count()` sıradan bağımsız. Paralelleştirilecek ideal
  iş tam olarak budur: **bağımsız, CPU yoğun, yan etkisiz** parçalar.

  İş yükünün dengesiz olduğuna dikkat et: büyük sayıları kontrol etmek küçükleri kontrol etmekten pahalı.
  Elle dört eşit parçaya bölseydin son parçayı alan thread en geç biterdi; `rayon`'un iş çalma (work
  stealing) düzeni bu dengesizliği kendiliğinden giderir.
```

Şimdi modülün bütün araçlarını birleştiren büyük alıştırma:

```exercise
title: Paralel kelime sayacı
difficulty: 4
prompt: |
  Büyük bir metindeki kelimelerin kaç kez geçtiğini **`thread::scope`** ile paralel say.
  `kelime_say(metin: &str, parca_sayisi: usize) -> HashMap<String, usize>`:

  - Metni satırlara ayır (`lines()`), satırları `parca_sayisi` parçaya böl (parça boyutu yukarı yuvarlanır;
    `parca_sayisi` 0 ise 1 kabul et).
  - Her parçayı kapsamlı bir thread işlesin ve **kendi yerel** `HashMap`'ini döndürsün; ana thread bunları
    birleştirsin. (Paylaşılan kilit yok!)
  - Kelimeler `split_whitespace` ile ayrılır, baştaki/sondaki harf-rakam olmayan karakterler (`,` `.` `!` `?`
    gibi) atılır ve küçük harfe çevrilir. Geriye boş kalan parçalar sayılmaz.
  - Sonuç `parca_sayisi`'na bağlı olmamalı.
starter: |
  use std::collections::HashMap;
  use std::thread;

  fn kelime_say(metin: &str, parca_sayisi: usize) -> HashMap<String, usize> {
      todo!()
  }

  fn main() {
      let metin = "Bir varmış, bir yokmuş.\nEvvel zaman içinde\nkalbur saman içinde!";
      let sayim = kelime_say(metin, 2);
      println!("bir: {:?}, içinde: {:?}", sayim.get("bir"), sayim.get("içinde"));
  }
solution: |
  use std::collections::HashMap;
  use std::thread;

  fn kelime_say(metin: &str, parca_sayisi: usize) -> HashMap<String, usize> {
      let satirlar: Vec<&str> = metin.lines().collect();
      if satirlar.is_empty() {
          return HashMap::new();
      }
      let boyut = satirlar.len().div_ceil(parca_sayisi.max(1));

      let mut toplam = HashMap::new();
      thread::scope(|s| {
          let tutamaclar: Vec<_> = satirlar
              .chunks(boyut)
              .map(|parca| {
                  s.spawn(move || {
                      let mut yerel: HashMap<String, usize> = HashMap::new();
                      for satir in parca {
                          for ham in satir.split_whitespace() {
                              let kelime = ham.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                              if !kelime.is_empty() {
                                  *yerel.entry(kelime).or_insert(0) += 1;
                              }
                          }
                      }
                      yerel
                  })
              })
              .collect();

          for t in tutamaclar {
              for (kelime, adet) in t.join().unwrap() {
                  *toplam.entry(kelime).or_insert(0) += adet;
              }
          }
      });
      toplam
  }

  fn main() {
      let metin = "Bir varmış, bir yokmuş.\nEvvel zaman içinde\nkalbur saman içinde!";
      let sayim = kelime_say(metin, 2);
      println!("bir: {:?}, içinde: {:?}", sayim.get("bir"), sayim.get("içinde"));
  }
check: tests
tests: |
  #[test]
  fn basit_sayim() {
      let s = kelime_say("elma armut\nelma kiraz\narmut elma", 2);
      assert_eq!(s.get("elma"), Some(&3), "elma 3 kez geçiyor");
      assert_eq!(s.get("armut"), Some(&2), "armut 2 kez geçiyor");
      assert_eq!(s.get("kiraz"), Some(&1), "kiraz 1 kez geçiyor");
      assert_eq!(s.len(), 3, "yalnızca 3 farklı kelime olmalı");
  }

  #[test]
  fn buyuk_kucuk_harf_ve_noktalama() {
      let s = kelime_say("Çay, çay! ÇAY?\n(simit)  ve... çay.", 3);
      assert_eq!(s.get("çay"), Some(&4), "büyük/küçük harf ve noktalama fark etmemeli");
      assert_eq!(s.get("simit"), Some(&1), "parantezler atılmalı");
      assert_eq!(s.get("ve"), Some(&1), "sondaki üç nokta atılmalı");
      assert_eq!(s.len(), 3, "boş parça kelime sayılmamalı");
  }

  #[test]
  fn sonuc_parca_sayisindan_bagimsiz() {
      let metin: String = (0..50).map(|i| format!("satır{} ortak kelime{}\n", i % 7, i % 3)).collect();
      let tek = kelime_say(&metin, 1);
      assert_eq!(tek.get("ortak"), Some(&50), "her satırda bir 'ortak' var");
      for p in [0, 2, 3, 8, 100] {
          assert_eq!(kelime_say(&metin, p), tek, "{p} parçayla sonuç 1 parçayla aynı olmalı");
      }
  }

  #[test]
  fn bos_metinler() {
      assert!(kelime_say("", 4).is_empty(), "boş metin boş sonuç vermeli");
      assert!(kelime_say("... !!\n  ?  ", 2).is_empty(), "yalnızca noktalama varsa kelime yok");
  }
hints:
  - "Önce `let satirlar: Vec<&str> = metin.lines().collect();`, boşsa hemen boş `HashMap` döndür (`chunks(0)` panikler). Parça boyutu: `satirlar.len().div_ceil(parca_sayisi.max(1))`."
  - "`thread::scope(|s| { ... })` içinde `satirlar.chunks(boyut)` üzerinde dönüp her parça için `s.spawn(move || { ... yerel HashMap ... yerel })` aç ve tutamaçları bir `Vec`'e topla. `move` burada sadece `parca` dilim referansını (ucuz, `Copy`) taşır."
  - "Kelimeyi temizlemek: `ham.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase()`. Birleştirme: her `t.join().unwrap()` haritası için `*toplam.entry(kelime).or_insert(0) += adet;`."
require:
  - pattern: "thread::scope"
    message: "Satır parçalarını `thread::scope` ile ödünç vererek işle."
forbid:
  - pattern: "Mutex|Arc::"
    message: Bu alıştırmada paylaşılan kilit yok, her thread yerel sayım döndürsün.
explanation: |
  Bu çözüm modülün özeti gibi:

  1. **`thread::scope`** sayesinde `satirlar` (ve onun gösterdiği `metin`) kopyalanmadan ödünç veriliyor.
     1. dersteki `to_vec()` kopyasına artık gerek yok.
  2. Tutamaçlar önce **toplanıyor**, sonra `join` ediliyor (1. dersteki tembel iterator tuzağı).
  3. Her thread **yerel** bir `HashMap` dolduruyor; paylaşılan durum yok, kilit yok, çekişme yok. Bu
     **map-reduce** düzenidir: paralel *map* (yerel sayım), sıralı *reduce* (birleştirme).
  4. `join` sıradan bağımsız birleştirme yapıyor; sonuç parça sayısından ve zamanlamadan bağımsız.

  `Arc<Mutex<HashMap>>` ile de çözülebilirdi (3. ders), ama her kelimede kilit almak thread'leri sürekli
  bekletir. "Önce yerelde topla, sonra birleştir" neredeyse her zaman daha hızlıdır.

  `rayon` ile aynı iş: satır parçaları üzerinde `par_iter().map(yerel_say).reduce(HashMap::new, birlestir)`.
  Bir uyarı: `to_lowercase` Türkçe `İ`'yi `i̇` (noktalı i + birleşik nokta) yapar (Modül 9); gerçek bir Türkçe
  metin işleyicisinde bu harf için özel kural gerekir.
```

## Özet

:::remember
- `thread::scope(|s| { s.spawn(...) })`: kapsam bitmeden bütün thread'ler bitmek zorunda → yerel veriyi **ödünç** verebilirsin (`'static` gerekmez, `Arc` gerekmez).
- Ödünç kuralları thread'ler arasında da geçerli: aynı veriye iki `&mut` → `E0499`; ayrık dilimler (`split_at_mut`) serbest.
- `rayon`: `iter()` → `par_iter()` (veya `into_par_iter()`); iş çalan bir thread havuzu. Dizinli kaynakta `collect` sırayı korur.
- `rayon` closure'ları `Fn` olmalı → paylaşılan `Vec`'e `push` derlenmez (`E0596`); sonucu `collect` et.
- `LazyLock` (tanımda başlatma) ve `OnceLock` (`get_or_init`/`set`): thread güvenli, **bir kez** başlatılan global değerler.
- `Condvar`: bir koşulu CPU harcamadan bekle, uyanınca koşulu yeniden kontrol et (`wait_while`). `Barrier`: herkes gelene kadar bekle.
:::

```reflect
prompt: |
  Modül boyunca thread'ler arasında veri paylaşmanın birçok yolunu gördün: `move`, kanal, `Arc<Mutex<T>>`,
  atomik, `thread::scope`, `rayon`. Yeni bir paralel görevle karşılaştığında hangisini seçeceğine nasıl karar
  verirsin? Kendi karar listeni yaz.
answer: |
  Örnek bir karar listesi:
  1. Bağımsız elemanlar üzerinde aynı CPU yoğun iş mi? → `rayon` `par_iter`.
  2. Yerel veriyi birkaç thread'e bölüp hepsinin bitmesini mi bekleyeceğim? → `thread::scope` (kopya/`Arc` yok).
  3. Veri bir aşamadan diğerine mi akıyor (üretici → tüketici)? → kanal (`mpsc`, gerekirse `sync_channel`).
  4. Uzun yaşayan thread'ler ortak bir durumu mu güncelliyor? → `Arc<Mutex<T>>`, okuma ağırlıklıysa `Arc<RwLock<T>>`.
  5. Paylaşılan şey tek bir sayaç ya da bayrak mı? → atomik.
  6. Bir kez hesaplanıp her yerden okunacak global bir değer mi? → `LazyLock`/`OnceLock`.
  Mümkün olduğunca paylaşılan değiştirilebilir durumdan kaçınıp "yerelde hesapla, sonra birleştir" düzenini seçerim.
```

```flashcards
- front: "`thread::scope` neden `'static` olmayan (yerel) veriyi thread'lere ödünç vermeye izin verir?"
  back: Kapsam, içinde açılan bütün thread'ler bitmeden dönmez; bu yüzden derleyici thread'lerin veriden kısa yaşadığını kanıtlayabilir.
- front: "İki kapsamlı thread aynı değişkeni `+=` ile değiştirmeye çalışırsa hangi hata alınır?"
  back: "`E0499`: aynı anda iki `&mut` ödünç, yani bir veri yarışı girişimi."
- front: Sıralı bir iterator zincirini `rayon` ile paralelleştirmek için ne değiştirilir?
  back: "`iter()` → `par_iter()` (sahiplik için `into_par_iter()`, değiştirmek için `par_iter_mut()`); başa `use rayon::prelude::*;`."
- front: "`rayon`'un **work stealing** yaklaşımı ne demektir?"
  back: İşini bitiren thread, başka bir thread'in kuyruğundan iş alır; dengesiz iş yüklerinde çekirdekler boş kalmaz.
- front: "`par_iter().for_each` içinde dışarıdaki bir `Vec`'e `push` neden derlenmez?"
  back: "`for_each` bir `Fn` closure ister (birçok thread'den aynı anda çağrılır); `push` `&mut` gerektirir (`E0596`). Bunun yerine `collect` kullanılır."
- front: "`LazyLock` ile `OnceLock` arasındaki fark nedir?"
  back: "`LazyLock` başlatma fonksiyonunu tanımda alır ve ilk erişimde çalıştırır; `OnceLock` boş başlar, değer sonradan `get_or_init`/`set` ile bir kez konur."
- front: "`Condvar` ile beklerken neden koşul bir döngüde (veya `wait_while` ile) kontrol edilir?"
  back: Sahte uyanmalar (spurious wakeup) ve başka thread'lerin koşulu yeniden bozması yüzünden; uyanmak koşulun doğru olduğunu garanti etmez.
- front: "`Barrier::new(3)` ne yapar?"
  back: "`wait()` çağıran thread'leri üçüncüsü gelene kadar bekletir, sonra hepsini birlikte bırakır (biri `is_leader()` olur)."
