---
id: m18-boss
title: "Boss: Eşzamanlılık Ustası"
minutes: 35
type: boss
objectives:
  - Modül 18'in bütün araçlarını (thread, kanal, Mutex/Arc, Send/Sync, atomikler, scope, rayon) karışık sorularla uygulayabilmek
  - Eşzamanlı kodun derlenip derlenmeyeceğini ve deterministik çıktısını çalıştırmadan öngörebilmek
  - Kanal ve paylaşılan durum kullanan, testleri geçen eşzamanlı fonksiyonları sıfırdan yazabilmek
keywords: [boss, thread, kanal, Mutex, Arc, Send, Sync, atomik, "thread::scope", rayon]
---

Dağın zirvesine az kaldı! Bu sınav, thread'lerle derleyiciyi yanına alarak çalışabildiğini gösterecek.
Sorular karışık geliyor; aralarda önceki modüllerden (closure'lar, hata yönetimi, String'ler) de sorular
var. Geçmek için **%80** gerekiyor. Her kodda iki soru sor: *"Kim sahip, kim paylaşıyor?"* ve *"Bu
çıktı zamanlamaya bağlı mı?"*

## Thread'ler ve kanallar

```predict
code: |
  use std::thread;

  fn main() {
      let siparisler = vec![vec![30, 20], vec![50], vec![10, 10, 10]];
      let tutamaclar: Vec<_> = siparisler
          .into_iter()
          .map(|s| thread::spawn(move || s.iter().sum::<i32>()))
          .collect();
      let toplamlar: Vec<i32> = tutamaclar.into_iter().map(|h| h.join().unwrap()).collect();
      println!("{toplamlar:?}");
  }
options:
  - "[50, 50, 30]"
  - "[30, 50, 50]"
  - Her çalıştırmada farklı sırada
  - "Derlenmez: `s` closure'a taşınamaz"
answer: 0
explanation: |
  Her iç `Vec` kendi thread'ine **taşınıyor** (`move`). Tutamaçlar önce `collect` ile toplandığı için üç
  thread aynı anda çalışabilir; sonuçlar ise tutamaçların sırasıyla `join` edildiğinden her zaman
  girdinin sırasında gelir: `30+20`, `50`, `10+10+10`. Sıralama yapılmadı, bu yüzden `[30, 50, 50]` değil.
```

```compiles
code: |
  use std::thread;

  fn main() {
      let mut tutamaclar = Vec::new();
      for i in 0..3 {
          tutamaclar.push(thread::spawn(|| i * 100));
      }
      for t in tutamaclar {
          println!("{}", t.join().unwrap());
      }
  }
answer: false
error: E0373
explanation: |
  `i` bir `i32` ve `Copy` olsa da, `move` olmayan closure onu **referansla** yakalar. Döngü değişkeni her
  turun sonunda ölür ama thread daha uzun yaşayabilir; `spawn`'ın `'static` şartı bunu reddeder:
  `E0373: closure may outlive the current function`. Çözüm `thread::spawn(move || i * 100)`: `Copy` tiplerde
  `move` değeri kopyalar.
```

```predict
question: Bu program ne yazdırır (ya da yazdırır mı)?
code: |
  use std::sync::mpsc;
  use std::thread;

  fn main() {
      let (tx, rx) = mpsc::channel();
      let tx2 = tx.clone();
      thread::spawn(move || {
          for i in 1..=3 {
              tx.send(i).unwrap();
          }
      });
      thread::spawn(move || {
          for i in 10..=12 {
              tx2.send(i).unwrap();
          }
      });
      let mut hepsi: Vec<i32> = rx.iter().collect();
      hepsi.sort();
      println!("{} {:?}", hepsi.len(), &hepsi[..2]);
  }
options:
  - "6 [1, 2]"
  - Hiç bitmez, çünkü `drop(tx)` unutulmuş
  - "6 [1, 10]"
  - Çıktı zamanlamaya bağlıdır
answer: 0
explanation: |
  Burada `drop` gerekmiyor: orijinal `tx` **klonlanmadan** birinci thread'e taşındı, klonu `tx2` ise ikinci
  thread'e. `main`'de hiç gönderici kalmadı; iki thread bitince iki gönderici de drop edilir ve
  `rx.iter()` sonlanır. Altı değer gelir, hangi sırayla geldiği belirsizdir ama `sort()` sonrası ilk ikisi
  hep `1` ve `2`.
```

```quiz
question: Bir üretici thread'de `tx.send(paket)` çağrısı `Err` döndürdü. Büyük ihtimalle ne olmuştur?
options:
  - Kanal doldu; sınırsız kanalda da bir sınır vardır
  - "Alıcı (`Receiver`) drop edildi; mesajı alacak kimse kalmadı"
  - Diğer bütün göndericiler drop edildi
  - Gönderilen değer `Copy` değil
answer: 1
explanation: |
  `send` yalnızca **alıcı yok olduğunda** başarısız olur ve `SendError` içinde gönderilemeyen değeri sana geri
  verir. Sınırsız `mpsc::channel()` hiç dolmaz; sınırlı `sync_channel`'da ise dolu kanal `send`'i
  **bekletir**, hata döndürmez. Diğer göndericilerin durumu `send`'i etkilemez; o, alıcının `recv`'ini
  ilgilendirir.
feedback:
  - "Sınırsız kanal dolmaz; `sync_channel` dolunca da `send` bekler, `Err` dönmez."
  - Doğru!
  - Göndericilerin hepsinin gitmesi alıcı tarafı ilgilendirir (`recv` → `Err`).
  - "`send` `Copy` olmayan değerleri taşıyarak gönderir; bu bir hata sebebi değildir."
```

## Paylaşılan durum

```compiles
code: |
  use std::sync::Arc;
  use std::thread;

  fn main() {
      let liste = Arc::new(vec![1, 2, 3]);
      let l2 = Arc::clone(&liste);
      thread::spawn(move || {
          l2.push(4);
      })
      .join()
      .unwrap();
      println!("{liste:?}");
  }
answer: false
error: E0596
explanation: |
  `Arc<T>`, tıpkı `Rc<T>` gibi, içindeki değere yalnızca **paylaşılan** erişim verir (`Deref` var,
  `DerefMut` yok): *"cannot borrow data in an `Arc` as mutable"*. Birden çok sahip aynı anda değiştirebilseydi
  veri yarışı olurdu. Değiştirmek için iç değişkenlik gerekir: `Arc<Mutex<Vec<i32>>>` ve `l2.lock().unwrap().push(4)`.
```

```predict
code: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn main() {
      let kasa = Arc::new(Mutex::new(100));
      let k = Arc::clone(&kasa);
      let _ = thread::spawn(move || {
          let mut para = k.lock().unwrap();
          *para -= 30;
          panic!("elektrik kesildi");
      })
      .join();

      let sonuc = kasa.lock();
      println!("{}", sonuc.is_err());
      let para = sonuc.unwrap_or_else(|zehir| zehir.into_inner());
      println!("{}", *para);
  }
options:
  - |
    true
    70
  - |
    false
    100
  - |
    true
    100
  - Program `main` içinde paniğe kapılır
answer: 0
explanation: |
  Thread kilidi tutarken paniğe kapıldı: bekçi drop edilirken mutex **zehirlendi**. Bu yüzden `lock()`
  `Err(PoisonError)` döndürür ve ilk satır `true`. Panikten önce yapılan `-= 30` geri alınmaz; veri yarım
  kalmış bir güncellemeyi taşıyor olabilir, zehrin sebebi de bu. `into_inner()` "riski biliyorum" diyerek
  bekçiyi yine de verir: `70`. `unwrap()` deseydik `main` de paniğe kapılırdı.
```

```quiz
question: Aşağıdakilerden hangisini Rust derleyicisi güvenli kodda **derleme zamanında** engeller?
options:
  - İki thread'in kilitleri ters sırayla alıp birbirini sonsuza dek beklemesi (deadlock)
  - İki thread'in aynı `Vec`'e senkronizasyon olmadan aynı anda yazması (data race)
  - "Bir atomikte `load` ardından `store` yapılırken arada başka thread'in araya girmesi"
  - "`Arc<Mutex<..>>` ile kurulmuş bir referans döngüsünün belleği sızdırması"
answer: 1
explanation: |
  Rust'ın "korkusuz eşzamanlılık" sözü **veri yarışları** içindir: sahiplik, ödünç kuralları ve `Send`/`Sync`
  sayesinde senkronizasyonsuz eşzamanlı yazma derlenmez. Kilitlenme, atomik işlem dizilerindeki **yarış
  durumları** (mantık hataları) ve referans döngüsü sızıntıları (Modül 17) ise bellek güvenliğini bozmaz;
  derleyici bunları yakalamaz, tasarımla önlemen gerekir.
feedback:
  - Kilitlenme derlenir; sabit kilit sırası gibi disiplinlerle önlenir.
  - Doğru! Veri yarışı güvenli Rust'ta derlenmez.
  - Bu bir yarış durumu (mantık hatası); `fetch_add`/`compare_exchange` kullanman gerekir.
  - Döngüsel `Arc`'lar `Rc` döngüleri gibi sızdırabilir; çözüm `Weak` (Modül 17).
```

```fill
prompt: Dört gişe 250'şer bilet okutuyor. Kilitsiz bir sayaçla toplamı doğru hesapla.
code: |
  use std::sync::Arc;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::thread;

  fn main() {
      let okutulan = Arc::new(AtomicUsize::new(0));
      let mut gise = Vec::new();
      for _ in 0..4 {
          let o = Arc::clone(&okutulan);
          gise.push(thread::spawn(move || {
              for _ in 0..250 {
                  o.___0(1, Ordering::___1);
              }
          }));
      }
      for g in gise {
          g.join().unwrap();
      }
      println!("{}", okutulan.load(Ordering::SeqCst));
  }
blanks:
  - ["fetch_add"]
  - ["Relaxed", "SeqCst", "AcqRel"]
output: "1000"
explanation: |
  `fetch_add` oku-artır-yaz işini tek bölünmez adımda yapar; hiçbir artış kaybolmaz. Basit bir sayaç için
  `Relaxed` yeterlidir: sonucu ancak bütün thread'leri `join` ettikten sonra okuyoruz ve `join` zaten bir
  senkronizasyon noktası. `SeqCst` de doğru sonucu verir, sadece gereğinden güçlüdür.
```

## Send, Sync, paralel araçlar ve tekrar

```compiles
code: |
  use std::cell::Cell;
  use std::sync::Arc;
  use std::thread;

  struct Istatistik {
      ziyaret: Cell<u32>,
  }

  fn main() {
      let ist = Arc::new(Istatistik { ziyaret: Cell::new(0) });
      let i2 = Arc::clone(&ist);
      thread::spawn(move || i2.ziyaret.set(i2.ziyaret.get() + 1))
          .join()
          .unwrap();
      println!("{}", ist.ziyaret.get());
  }
answer: false
error: E0277
explanation: |
  `Cell<u32>` `Sync` değildir: iki thread aynı anda `get`/`set` yapsaydı artışlar kaybolurdu. `Istatistik`'in
  tek alanı `Sync` olmadığı için struct da otomatik olarak `Sync` değil; `Arc<Istatistik>`'in `Send` olması
  için `Istatistik: Sync` gerekir. Thread güvenli karşılığı `AtomicU32` (ya da `Mutex<u32>`).
```

```quiz
question: Hangisi `Send` **olup** `Sync` **olmayan** bir tiptir (içindeki `T = i32` için)?
options:
  - "`Rc<i32>`"
  - "`RefCell<i32>`"
  - "`Mutex<i32>`"
  - "`Arc<i32>`"
answer: 1
explanation: |
  Bir `RefCell`'i başka bir thread'e **taşımak** güvenlidir (artık tek sahibi o thread), bu yüzden `Send`'dir.
  Ama ona birden çok thread'den `&RefCell` ile aynı anda erişmek, atomik olmayan ödünç sayacını bozabilir:
  `Sync` değildir. `Rc` ikisi de değildir; `Mutex<i32>` ve `Arc<i32>` ise ikisi birden.
feedback:
  - "`Rc` ne `Send` ne `Sync`; ortak sayaç taşınınca bile başka klonlarla paylaşılmaya devam eder."
  - Doğru!
  - "`Mutex<T>`, `T: Send` olduğunda hem `Send` hem `Sync`'tir; kilidin bütün amacı paylaşılmak."
  - "`Arc<i32>` hem `Send` hem `Sync`."
```

```predict
code: |
  use std::thread;

  fn main() {
      let kelimeler = vec!["rust", "güvenli", "hızlı"];
      let mut olcumler = Vec::new();
      thread::scope(|s| {
          let h = s.spawn(|| kelimeler.iter().map(|k| k.chars().count()).sum::<usize>());
          olcumler.push(kelimeler.len());
          olcumler.push(h.join().unwrap());
      });
      println!("{olcumler:?} {}", kelimeler[0]);
  }
options:
  - "[3, 16] rust"
  - "[3, 19] rust"
  - "Derlenmez: `kelimeler` thread'e taşınmadan kullanılıyor (`E0373`)"
  - "Derlenmez: `olcumler` kapsam içinde değiştirilemez"
answer: 0
explanation: |
  `thread::scope` içinde açılan thread `kelimeler`'i **ödünç** alabilir; kapsam onu `main`'in devamından önce
  bitirmeyi garanti eder. Ana thread de bu sırada `olcumler`'i değiştirebilir, çünkü kapsamlı thread
  `olcumler`'e hiç dokunmuyor. `chars().count()` **karakter** sayar: 4 + 7 + 5 = 16. `len()` kullansaydık
  `ü` ve iki `ı` 2'şer bayt olduğu için 4 + 8 + 7 = 19 çıkardı (Modül 9).
```

```parsons
prompt: Notların iki yarısını iki kapsamlı thread'de topla ve genel toplamı yazdır (çıktı `340`).
lines: |
  use std::thread;
  fn main() {
      let notlar = [70, 80, 90, 100];
      let (ilk, son) = notlar.split_at(2);
      let toplam = thread::scope(|s| {
          let a = s.spawn(|| ilk.iter().sum::<i32>());
          let b = s.spawn(|| son.iter().sum::<i32>());
          a.join().unwrap() + b.join().unwrap()
      });
      println!("{toplam}");
  }
distractors: |
          let a = thread::spawn(|| ilk.iter().sum::<i32>());
          a.join() + b.join()
explanation: |
  `scope`'un closure'ı bir değer döndürebilir; `thread::scope` o değeri geri verir. `ilk` ve `son` yerel
  dizinin dilimleri; `'static` olmadıkları için `thread::spawn`'a verilemezler (`E0373`/`E0597`), ama
  `s.spawn` ile ödünç verilebilirler. `join()` bir `Result` döndürdüğü için doğrudan toplanamaz; `unwrap` şart.
```

```quiz
question: "`thread::spawn` closure'ı için neden `Fn` değil **`FnOnce`** ister?"
options:
  - "`FnOnce` daha hızlı çalışır"
  - Closure tam olarak bir kez çağrılacağı için yakaladığı değerleri **tüketmesine** (ör. dışarı taşıyıp döndürmesine) izin verilir; bu en esnek şarttır
  - "`Fn` closure'lar thread'lerde hiç kullanılamaz"
answer: 1
explanation: |
  Modül 14'ten: `FnOnce` en **gevşek** şarttır, her closure en az bir kez çağrılabilir. Thread closure'ı
  yalnızca bir kez çalıştırıldığı için `spawn` bundan fazlasını istemez; böylece `move || { veri }` gibi
  yakaladığı değeri dışarı taşıyan closure'lar da kabul edilir. Öte yandan `rayon`'un `for_each`'i aynı
  closure'ı birçok thread'den çağırdığı için `Fn` ister.
feedback:
  - Hız ile ilgisi yok; mesele closure'dan ne kadar şey istendiği.
  - Doğru!
  - "`Fn` closure'lar `FnOnce`'ı da uygular; elbette kullanılabilir."
```

```predict
code: |
  use std::num::ParseIntError;
  use std::thread;

  fn ikiye_katla(girdi: &str) -> Result<i32, ParseIntError> {
      let n: i32 = girdi.trim().parse()?;
      Ok(n * 2)
  }

  fn main() {
      let girdiler = ["21", " 5 ", "on"];
      let tutamaclar: Vec<_> = girdiler
          .into_iter()
          .map(|g| thread::spawn(move || ikiye_katla(g)))
          .collect();
      for t in tutamaclar {
          match t.join().unwrap() {
              Ok(n) => println!("{n}"),
              Err(_) => println!("hatalı girdi"),
          }
      }
  }
options:
  - |
    42
    10
    hatalı girdi
  - |
    42
    hatalı girdi
    hatalı girdi
  - Üçüncü thread paniğe kapıldığı için `join().unwrap()` main'i çökertir
answer: 0
explanation: |
  Modül 10'dan: `?` hatayı fonksiyonun çağıranına **değer olarak** döndürür, panik üretmez. Thread'in dönüş
  tipi `Result<i32, ParseIntError>`; `join()` bunu `Ok(...)` içinde verir (thread paniklemedi), `unwrap` güvenle
  çalışır ve iç `Result`'ı `match` ile ayırırız. `trim()` sayesinde `" 5 "` başarıyla `5`'e dönüşür.
  `"on"` ise sayı değil: `Err`. Thread hatası (`join`'in `Err`'i) ile iş hatası (iç `Result`) ayrı katmanlardır.
```

## Uygulama

```exercise
title: İstasyonların en yüksek sıcaklıkları
difficulty: 3
prompt: |
  Meteoroloji ağındaki her istasyon kendi ölçümlerini **ayrı bir thread'de** işleyip sonucunu bir
  **kanal** üzerinden merkeze gönderiyor.

  `en_yuksekler(istasyonlar: Vec<(String, Vec<i32>)>) -> Vec<(String, i32)>` fonksiyonunu yaz:

  - Her `(ad, olcumler)` için bir thread aç; thread `(ad, en_yuksek_olcum)` çiftini kanala göndersin.
  - Hiç ölçümü olmayan istasyon **mesaj göndermesin**.
  - Merkez (ana thread) gelenleri toplayıp istasyon adına göre **sıralı** döndürsün.
starter: |
  use std::sync::mpsc;
  use std::thread;

  fn en_yuksekler(istasyonlar: Vec<(String, Vec<i32>)>) -> Vec<(String, i32)> {
      todo!()
  }

  fn main() {
      let istasyonlar = vec![
          (String::from("Van"), vec![8, 14, 11]),
          (String::from("Antalya"), vec![27, 31, 29]),
      ];
      println!("{:?}", en_yuksekler(istasyonlar));
  }
solution: |
  use std::sync::mpsc;
  use std::thread;

  fn en_yuksekler(istasyonlar: Vec<(String, Vec<i32>)>) -> Vec<(String, i32)> {
      let (tx, rx) = mpsc::channel();
      for (ad, olcumler) in istasyonlar {
          let tx = tx.clone();
          thread::spawn(move || {
              if let Some(&en) = olcumler.iter().max() {
                  tx.send((ad, en)).unwrap();
              }
          });
      }
      drop(tx);

      let mut sonuc: Vec<(String, i32)> = rx.iter().collect();
      sonuc.sort();
      sonuc
  }

  fn main() {
      let istasyonlar = vec![
          (String::from("Van"), vec![8, 14, 11]),
          (String::from("Antalya"), vec![27, 31, 29]),
      ];
      println!("{:?}", en_yuksekler(istasyonlar));
  }
check: tests
tests: |
  fn ist(ad: &str, olcumler: &[i32]) -> (String, Vec<i32>) {
      (ad.to_string(), olcumler.to_vec())
  }

  #[test]
  fn uc_istasyon_sirali() {
      let sonuc = en_yuksekler(vec![ist("Van", &[8, 14, 11]), ist("Antalya", &[27, 31, 29]), ist("Rize", &[19, 22])]);
      assert_eq!(
          sonuc,
          vec![("Antalya".to_string(), 31), ("Rize".to_string(), 22), ("Van".to_string(), 14)],
          "her istasyonun en yüksek ölçümü, ada göre sıralı gelmeli"
      );
  }

  #[test]
  fn negatif_sicakliklar() {
      let sonuc = en_yuksekler(vec![ist("Erzurum", &[-12, -3, -8]), ist("Kars", &[-20])]);
      assert_eq!(sonuc, vec![("Erzurum".to_string(), -3), ("Kars".to_string(), -20)], "eksi değerlerde de en büyük seçilmeli");
  }

  #[test]
  fn olcumsuz_istasyon_ve_bos_ag() {
      let sonuc = en_yuksekler(vec![ist("Bozuk", &[]), ist("Sinop", &[17])]);
      assert_eq!(sonuc, vec![("Sinop".to_string(), 17)], "ölçümü olmayan istasyon listede yer almamalı");
      assert!(en_yuksekler(vec![]).is_empty(), "istasyon yoksa sonuç boş olmalı (ve fonksiyon bitmeli!)");
  }
hints:
  - "Bir kanal kur; her istasyon için `let tx = tx.clone();` yapıp thread'e `move` ile taşı. `olcumler.iter().max()` bir `Option<&i32>` döndürür."
  - "`if let Some(&en) = olcumler.iter().max() { tx.send((ad, en)).unwrap(); }` — boş istasyon hiçbir şey göndermez."
  - "Döngüden sonra `drop(tx);` yoksa `rx.iter()` hiç bitmez. Son olarak `collect` edip `sort()` uygula: tuple'lar önce ilk elemana (ada) göre sıralanır."
require:
  - pattern: "mpsc::"
    message: Sonuçları merkeze bir `mpsc` kanalıyla gönder.
  - pattern: "thread::spawn"
    message: Her istasyon kendi thread'inde işlenmeli.
explanation: |
  Modülün iki dersini birleştiren bir çözüm: **çok üreticili kanal** (her istasyona bir `Sender` klonu,
  sonunda `drop(tx)`) ve **`Option` ile boş durumu ele almak** (Modül 7'deki `if let`). `max()` boş bir
  iterator'da `None` verir; panik ya da yapay bir "en düşük değer" yok.

  `sort()` tuple'ları sözlük sırasıyla (lexicographic) karşılaştırır: önce `String` ad, eşitse sıcaklık
  (Modül 11'deki `Ord` türetme kuralı). Thread'lerin gönderme sırası belirsiz olduğu için sıralama, çıktıyı
  deterministik yapan adım.

  Testlerdeki "fonksiyon bitmeli" notu ciddi: `drop(tx)` unutulursa yalnızca dolu ağ testleri değil,
  **boş ağ** testi bile asılı kalır; hiç thread açılmasa da `main`'deki orijinal gönderici kanalı açık tutar.
```

```exercise
title: Konser biletleri — fazla satış yok!
difficulty: 4
prompt: |
  Bir konserin `kapasite` kadar bileti var ve birkaç gişe aynı anda satış yapıyor. `gise_istekleri[i]`,
  `i`. gişeye gelen **tek biletlik** isteklerin sayısı.

  `bilet_sat(kapasite: usize, gise_istekleri: Vec<usize>) -> (usize, usize)` fonksiyonunu yaz:

  - Her gişe **ayrı bir thread**; isteklerini tek tek işler.
  - Bilet kaldıysa satar, kalmadıysa isteği reddeder.
  - **Hiçbir koşulda** kapasiteden fazla bilet satılmamalı (eşzamanlı satışlarda bile).
  - `(satilan, reddedilen)` döndür.

  Paylaşılan "kalan bilet" sayacı için `Arc<Mutex<usize>>` ya da bir atomik kullanabilirsin; ama "önce oku,
  sonra ayrı bir adımda yaz" tuzağına düşme!
starter: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn bilet_sat(kapasite: usize, gise_istekleri: Vec<usize>) -> (usize, usize) {
      todo!()
  }

  fn main() {
      println!("{:?}", bilet_sat(100, vec![50, 50, 50, 50]));
  }
solution: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn bilet_sat(kapasite: usize, gise_istekleri: Vec<usize>) -> (usize, usize) {
      let toplam_istek: usize = gise_istekleri.iter().sum();
      let kalan = Arc::new(Mutex::new(kapasite));
      let mut giseler = Vec::new();

      for istek in gise_istekleri {
          let kalan = Arc::clone(&kalan);
          giseler.push(thread::spawn(move || {
              let mut satilan = 0;
              for _ in 0..istek {
                  let mut k = kalan.lock().unwrap(); // kontrol ve azaltma AYNI kilit altında
                  if *k > 0 {
                      *k -= 1;
                      satilan += 1;
                  }
              }
              satilan
          }));
      }

      let satilan: usize = giseler.into_iter().map(|g| g.join().unwrap()).sum();
      (satilan, toplam_istek - satilan)
  }

  fn main() {
      println!("{:?}", bilet_sat(100, vec![50, 50, 50, 50]));
  }
check: tests
tests: |
  #[test]
  fn kapasite_asilmaz() {
      assert_eq!(bilet_sat(100, vec![50, 50, 50, 50]), (100, 100), "200 istek, 100 bilet: 100 satış, 100 ret");
  }

  #[test]
  fn yeterli_bilet_varsa_ret_yok() {
      assert_eq!(bilet_sat(10, vec![3, 4]), (7, 0), "7 istek, 10 bilet: hepsi satılmalı");
  }

  #[test]
  fn sinir_durumlari() {
      assert_eq!(bilet_sat(0, vec![5, 2]), (0, 7), "bilet yoksa her istek reddedilmeli");
      assert_eq!(bilet_sat(5, vec![]), (0, 0), "gişe yoksa satış da ret de yok");
  }

  #[test]
  fn yogun_eszamanli_satis() {
      for _ in 0..3 {
          let (satilan, reddedilen) = bilet_sat(1000, vec![300; 8]);
          assert_eq!(satilan, 1000, "kapasite tam dolmalı ve ASLA aşılmamalı");
          assert_eq!(reddedilen, 1400, "2400 isteğin 1400'ü reddedilmeli");
      }
  }
hints:
  - "Toplam istek sayısını en başta hesapla: `gise_istekleri.iter().sum()` (vektörü thread'lere dağıtmadan önce). Kalan bilet: `Arc::new(Mutex::new(kapasite))`."
  - "Her gişe thread'i kendi `satilan` sayısını döndürsün; ana thread `join` sonuçlarını toplasın. Reddedilen = toplam istek − satılan."
  - "Kritik nokta: `if *k > 0 { *k -= 1; ... }` kontrolü ve azaltma **aynı** `lock()` bekçisi yaşarken yapılmalı. Kilidi kontrol için alıp bırakıp sonra tekrar almak fazla satışa yol açar."
require:
  - pattern: "thread::spawn"
    message: Her gişe ayrı bir thread'de çalışmalı.
explanation: |
  Bu, klasik **kontrol-sonra-kullan (TOCTOU)** sorusudur. "Bilet var mı?" kontrolü ile "bir bilet düş"
  güncellemesi **tek bir kritik bölgede** olmalı; aksi hâlde iki gişe aynı anda son bileti "var" görür ve
  ikisi de satar. Rust burada bir veri yarışına izin vermez (sayaca kilitsiz dokunamazsın) ama yanlış
  kilit kapsamı seçersen mantık hatasını engelleyemez; doğru kapsam tasarımın işi.

  Atomik alternatif: `AtomicUsize` üzerinde
  `kalan.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |k| k.checked_sub(1)).is_ok()`. `fetch_update`
  "değer hâlâ okuduğum gibiyse güncelle, değilse yeniden dene" döngüsünü (`compare_exchange`) senin yerine
  yazar; `checked_sub` (Modül 2) sıfırın altına inmeyi `None` ile reddeder. Ayrı bir `load` + `store` ise
  4. dersteki bilet hatasını tekrarlardı.

  Her gişenin kendi `satilan` sayısını **döndürmesi** (paylaşılan ikinci bir sayaç yerine) paylaşılan durumu
  en aza indirir: tek paylaşılan şey gerçekten paylaşılması gereken "kalan bilet".
```
