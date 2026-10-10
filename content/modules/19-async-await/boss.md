---
id: m19-boss
title: "Boss: Async Ustası"
minutes: 40
type: boss
objectives:
  - "Modül 19'un bütün araçlarını (future, `.await`, `spawn`, `join!`/`try_join!`/`select!`, kanallar, `Pin`, stream, async trait ve closure) karışık sorularla uygulayabilmek"
  - Async kodun derlenip derlenmeyeceğini ve hangi sırayla ne yazdıracağını çalıştırmadan öngörebilmek
  - Eşzamanlılığı sınırlanmış, hataları doğru yayan, testleri geçen async fonksiyonları sıfırdan yazabilmek
keywords: [boss, future, await, tokio, spawn, join, select, stream, Pin, async trait, spawn_blocking, iptal güvenliği]
---

Eşzamanlılık Dağları'nın son zirvesi! Bu sınav, async kodu **zihninde çalıştırabildiğini** gösterecek: hangi future
ne zaman yoklanır, hangisi drop edilir, hangi değer `.await` boyunca yaşar? Sorular karışık geliyor; aralarda önceki
modüllerden (hata yönetimi, `Rc`/`Send`, iterator'lar) de sorular var. Geçmek için **%80** gerekiyor. Her kodda iki
soru sor: *"Bu future'ı kim, ne zaman yokluyor?"* ve *"Burada neler `.await` boyunca yaşıyor?"*

## Future'lar ve görevler

```predict
code: |
  async fn adim(ad: &str) -> &str {
      println!("{ad} çalıştı");
      ad
  }

  #[tokio::main]
  async fn main() {
      let a = adim("A");
      let b = adim("B");
      println!("future'lar hazır");
      let y = b.await;
      let x = a.await;
      println!("{x}{y}");
  }
options:
  - |
    A çalıştı
    B çalıştı
    future'lar hazır
    AB
  - |
    future'lar hazır
    B çalıştı
    A çalıştı
    AB
  - |
    future'lar hazır
    A çalıştı
    B çalıştı
    BA
answer: 1
explanation: |
  `adim("A")` gövdeyi çalıştırmaz, sadece bir future oluşturur: future'lar **tembeldir**. Gövdeler ancak `.await`
  edildiklerinde, await sırasıyla çalışır: önce `b`, sonra `a`. Son satır `x` ("A") ile `y` ("B")'yi birleştirir: `AB`.
  JavaScript'teki `Promise`'ten farkı tam olarak bu: `Promise` oluşturulduğu anda çalışmaya başlar.
```

```compiles
code: |
  async fn hesapla() -> u32 {
      42
  }

  fn main() {
      let sonuc = hesapla().await;
      println!("{sonuc}");
  }
answer: false
error: E0728
explanation: |
  `.await` yalnızca `async` bir fonksiyonun ya da bloğun içinde kullanılabilir (`E0728`). Sıradan `fn main`'in
  future'ları yoklayacak bir executor'ı yoktur. Çözüm: `#[tokio::main]` ile `async fn main` yazmak; bu makro bir
  runtime kurar ve `main`'in gövdesini onun üzerinde `block_on` ile çalıştırır.
```

```compiles
code: |
  #[tokio::main]
  async fn main() {
      let musteri = String::from("Zeynep");
      let gorev = tokio::spawn(async {
          println!("{musteri} için fatura hazırlanıyor");
      });
      gorev.await.unwrap();
  }
answer: false
error: E0373
explanation: |
  `tokio::spawn` future'ın `'static` olmasını ister: görev, onu başlatan fonksiyondan **uzun yaşayabilir**. `async { }`
  bloğu `musteri`'yi ödünç alıyor (E0373: "async block may outlive the current function, but it borrows `musteri`").
  Modül 18'deki `thread::spawn` ile aynı çözüm: `async move { ... }` ile `musteri`'yi görevin içine taşımak.
  `join!` ise aynı görevde çalıştığı için yerel değişkenleri ödünç alabilirdi.
```

```predict
code: |
  use std::time::Duration;
  use tokio::time::sleep;

  async fn kontrol(ad: &str, ms: u64, gecerli: bool) -> Result<&str, String> {
      sleep(Duration::from_millis(ms)).await;
      println!("{ad} kontrolü bitti");
      if gecerli { Ok(ad) } else { Err(format!("{ad} reddedildi")) }
  }

  #[tokio::main]
  async fn main() {
      let sonuc = tokio::try_join!(kontrol("stok", 60, true), kontrol("ödeme", 10, false));
      println!("{sonuc:?}");
  }
options:
  - |
    ödeme kontrolü bitti
    stok kontrolü bitti
    Err("ödeme reddedildi")
  - |
    ödeme kontrolü bitti
    Err("ödeme reddedildi")
  - |
    stok kontrolü bitti
    ödeme kontrolü bitti
    Err("ödeme reddedildi")
answer: 1
explanation: |
  `try_join!` future'ları aynı anda yoklar; ödeme 10 ms'de biter ve `Err` döner. `try_join!` **ilk hatada** vazgeçer:
  hâlâ `sleep`'te bekleyen stok future'ını drop eder, o yüzden "stok kontrolü bitti" hiç yazılmaz. Sonuç doğrudan o
  `Err`'dir. `join!` kullansaydın iki satır da yazılır ve sonuç bir tuple olurdu: `(Ok("stok"), Err(..))`.
```

```quiz
question: "Bir chat sunucusu her bağlantı için bir **işletim sistemi thread'i** açıyor ve 10.000 kullanıcıda zorlanıyor. Async/await'e geçmenin asıl kazancı nedir?"
options:
  - "Async kod işlemciyi daha hızlı kullanır; her mesaj daha az CPU komutuyla işlenir"
  - "Bağlantılar çoğunlukla **bekler**; async görevler beklerken thread tutmaz, birkaç thread binlerce görevi sırayla ilerletir, görev başına bellek de birkaç KB'dır"
  - "Async görevler işletim sistemi tarafından önleyici (preemptive) olarak zamanlanır, bu yüzden adildir"
  - "Async ile veri yarışları çalışma zamanında otomatik olarak çözülür"
answer: 1
explanation: |
  Sunucunun işi **I/O-bound**'dur: zamanın çoğu ağdan veri beklemekle geçer. Her thread'in kendi yığını (MB'larca) ve
  bağlam değiştirme maliyeti vardır. Async görevler ise küçük durum makineleridir; bekleyen görev `Pending` döner ve
  thread'i başka bir göreve bırakır. Görevler **işbirlikçidir** (cooperative), sırayı `.await`'te kendileri bırakır.
feedback:
  - "Async, CPU işini hızlandırmaz; beklemeyi verimli hâle getirir."
  - "Doğru!"
  - "Tersine: async görevler işbirlikçidir, sırayı yalnızca `.await`'te bırakır."
  - "Veri yarışlarını tip sistemi (`Send`/`Sync`) derleme zamanında engeller; bu async'e özgü değil."
```

## Kanallar, paylaşılan durum ve zaman

```fill
prompt: "Yavaş bir kur servisini en fazla 50 ms bekle; süre dolarsa varsayılan kuru kullan."
code: |
  use std::time::Duration;

  async fn kur_getir() -> f64 {
      tokio::time::sleep(Duration::from_millis(200)).await; // servis çok yavaş
      34.5
  }

  #[tokio::main]
  async fn main() {
      let kur = match tokio::time::___0(Duration::from_millis(50), kur_getir()).await {
          ___1(deger) => deger,
          ___2(_) => 34.0, // süre doldu: önbellekteki son kur
      };
      println!("kur: {kur}");
  }
blanks:
  - ["timeout"]
  - ["Ok"]
  - ["Err"]
output: "kur: 34"
explanation: |
  `tokio::time::timeout(süre, future)` future'ı sarar ve `Result<T, Elapsed>` döndürür: future zamanında biterse
  `Ok(değer)`, süre dolarsa `Err(Elapsed)`. Süre dolduğunda içteki `kur_getir` future'ı **drop edilir** (iptal).
  `34.0`'ın `{kur}` ile `34` olarak yazdırılması `f64` biçimlendirmesindendir (Modül 2).
```

```quiz
question: "Birden çok görevin paylaştığı bir `HashMap` önbelleğin var. Her görev önbelleğe kısa bir okuma/yazma yapıyor, kilitliyken hiç `.await` yok. Hangisi en doğru seçim?"
options:
  - "`Arc<std::sync::Mutex<HashMap<..>>>` — kilitli bölgeyi bir blokla sınırla"
  - "`Arc<tokio::sync::Mutex<HashMap<..>>>` — async kodda her zaman tokio'nun Mutex'i kullanılmalı"
  - "`Rc<RefCell<HashMap<..>>>` — tek runtime içinde olduğumuz için yeterli"
  - "Kilide gerek yok; görevler aynı anda çalışmaz"
answer: 0
explanation: |
  Kural: kilit **`.await` boyunca tutulmayacaksa** `std::sync::Mutex` daha hızlı ve yeterlidir; tokio belgeleri de bunu
  önerir. `tokio::sync::Mutex` ancak kilidi bir `.await` boyunca tutmak zorundaysan gerekir. `Rc<RefCell<..>>`
  `Send` olmadığı için `tokio::spawn` edilen görevlerde kullanılamaz.
feedback:
  - "Doğru!"
  - "tokio'nun Mutex'i daha yavaştır; yalnızca kilidi `.await` boyunca tutman gerekiyorsa seçilir."
  - "`Rc` ve `RefCell` `Send` değildir; çok thread'li runtime'da görevler thread değiştirebilir."
  - "Çok thread'li runtime'da görevler gerçekten paralel çalışabilir; kilit şart."
```

Bu soru **Modül 17-18**'den: derlenir mi?

```compiles
code: |
  use std::rc::Rc;

  async fn kaydet(satir: &str) {
      tokio::task::yield_now().await;
      println!("kaydedildi: {satir}");
  }

  #[tokio::main]
  async fn main() {
      let gorev = tokio::spawn(async {
          let ayar = Rc::new(String::from("tr-TR"));
          kaydet(&ayar).await;
          println!("dil: {ayar}");
      });
      gorev.await.unwrap();
  }
answer: false
explanation: |
  `Rc<String>` `Send` değildir (sayacı atomik değil, Modül 17-18) ve `ayar` `.await` boyunca yaşıyor; dolayısıyla
  future da `Send` olmaz ve `tokio::spawn` onu reddeder: "future cannot be sent between threads safely". Çözüm `Arc`
  ya da (paylaşım yoksa) düz bir `String`.
```

## Perde arkası: poll, Pin ve stream'ler

```quiz
question: "`Future::poll`'un imzasında `self` neden `&mut Self` değil de `Pin<&mut Self>`'tir?"
options:
  - "Future'ların heap'te yaşaması zorunlu olduğu için"
  - "`async fn`'lerden üretilen durum makineleri kendi içlerine referans tutabilir; yoklanmaya başladıktan sonra bellekte taşınırlarsa bu referanslar sarkar. `Pin` taşınmamayı garanti eder"
  - "Aynı future'ın iki thread'den aynı anda yoklanmasını engellemek için"
  - "`Pin`, future'ın yalnızca bir kez yoklanabileceğini garanti eder"
answer: 1
explanation: |
  `.await` boyunca yaşayan yereller ve onlara verilen referanslar aynı future'ın içinde saklanır: future kendine
  referans veren (self-referential) bir yapı olabilir. `Pin<&mut Self>` "bu değer drop edilene kadar yer
  değiştirmeyecek" sözüdür. Çoğu sıradan tip `Unpin`'dir ve onlar için bu kısıt hiçbir şey değiştirmez.
feedback:
  - "`pin!` ile stack'te de sabitlenebilir; heap şart değil."
  - "Doğru!"
  - "Bunu `&mut`'un kendisi zaten engeller; `Pin`'in konusu taşınma."
  - "Future'lar birçok kez yoklanır (`Pending` döndükçe)."
```

```compiles
code: |
  async fn kategori_derinligi(yol: &[&str]) -> usize {
      if yol.is_empty() {
          0
      } else {
          1 + kategori_derinligi(&yol[1..]).await
      }
  }

  #[tokio::main]
  async fn main() {
      println!("{}", kategori_derinligi(&["elektronik", "telefon", "aksesuar"]).await);
  }
answer: false
error: E0733
explanation: |
  Özyinelemeli bir `async fn`'in future'ı kendi türünden bir future'ı içinde saklamak zorundadır: sonsuz boyutlu bir
  tip (Modül 17'deki E0072'nin async hâli). Çözüm bir dolaylılık katmanı: `Box::pin(kategori_derinligi(&yol[1..])).await`.
```

```predict
code: |
  use futures::future;
  use futures::stream::{self, StreamExt};

  #[tokio::main]
  async fn main() {
      let sonuc: Vec<i32> = stream::iter(1..=10)
          .filter(|x| future::ready(x % 3 == 0))
          .map(|x| x * x)
          .take(2)
          .collect()
          .await;
      println!("{sonuc:?}");
  }
options:
  - "[9, 36]"
  - "[1, 4]"
  - "[9, 36, 81]"
  - "[3, 6]"
answer: 0
explanation: |
  Stream adaptörleri iterator adaptörleri gibi çalışır: `filter` 3'ün katlarını (3, 6, 9) bırakır, `map` karelerini
  alır (9, 36, 81), `take(2)` ilk ikisinde durur. Tek fark, `filter`'ın bir `bool` değil bir **future** döndürmesidir
  (`future::ready(..)` hemen hazır bir future). Tembellik sayesinde `take(2)` dolduktan sonra 9 ve sonrası hiç
  işlenmez.
```

```parsons
prompt: "Async metodu olan bir `Bildirim` trait'i tanımla, `Sms` için uygula ve `main`'de kullan."
lines: |
  trait Bildirim {
      async fn gonder(&self, mesaj: &str) -> String;
  }
  struct Sms;
  impl Bildirim for Sms {
      async fn gonder(&self, mesaj: &str) -> String {
          format!("SMS: {mesaj}")
      }
  }
  #[tokio::main]
  async fn main() {
      println!("{}", Sms.gonder("kargonuz yolda").await);
  }
distractors: |
      fn gonder(&self, mesaj: &str) -> String {
      println!("{}", Sms.gonder("kargonuz yolda"));
explanation: |
  Rust 1.75'ten beri trait'lerde `async fn` yazılabilir; uygulama da `async fn` olmalıdır (senkron bir `fn` imzası
  trait'teki `impl Future` dönüşüyle uyuşmaz). Çağrı bir future döndürür; `.await` olmadan `println!` future'ı
  yazdırmaya çalışır ve derlenmez (future `Display` değildir). Bu trait'i `tokio::spawn` içinde generic olarak
  kullanacaksan imzayı `fn gonder(..) -> impl Future<Output = String> + Send` yapman gerekir.
```

## Tuzaklar ve tekrar

Bu soru **Modül 10**'dan: `?` operatörü async fonksiyonlarda da çalışır. Tahmin et:

```predict
code: |
  async fn toplam(girdiler: &[&str]) -> Result<u32, std::num::ParseIntError> {
      let mut t = 0;
      for g in girdiler {
          t += g.parse::<u32>()?;
          println!("{g} eklendi");
          tokio::task::yield_now().await;
      }
      Ok(t)
  }

  #[tokio::main]
  async fn main() {
      println!("{:?}", toplam(&["3", "4"]).await);
      println!("{}", toplam(&["5", "x", "7"]).await.is_err());
  }
options:
  - |
    3 eklendi
    4 eklendi
    Ok(7)
    5 eklendi
    true
  - |
    3 eklendi
    4 eklendi
    Ok(7)
    5 eklendi
    7 eklendi
    true
  - |
    Ok(7)
    true
answer: 0
explanation: |
  `?` async fonksiyonda da aynı anlama gelir: hata varsa fonksiyondan (yani future'dan) hemen `Err` ile **dön**.
  İkinci çağrıda `"5"` eklenir, `"x"` ayrıştırılamaz ve future `Err(ParseIntError)` ile biter; `"7"`'ye hiç
  gelinmez. `.await` sonucu doğrudan `Result`'tır; `is_err()` `true` verir.
```

```quiz
question: "Bir `select!` döngüsünde her turda `paket_oku(&mut rx)` çağrılıyor; `paket_oku` kanaldan iki mesaj alıp birleştiriyor. Diğer dal (zaman aşımı) bazen kazanıyor ve mesajlar kayboluyor. Kök neden nedir?"
options:
  - "`mpsc::Receiver::recv` iptal güvenli değildir; mesajı kanaldan alır ve kaybeder"
  - "`paket_oku` iptal güvenli değildir: ilk mesajı alıp yerel bir değişkende tutarken drop edilirse o mesaj future'la birlikte yok olur"
  - "`select!` kaybeden future'ları arka planda bitirir ama sonuçlarını atar"
  - "Kanalın kapasitesi küçük olduğu için gönderici mesajları düşürür"
answer: 1
explanation: |
  `recv()`'in kendisi iptal güvenlidir: mesaj ya alınmıştır ya da kuyrukta durur. Ama iki `recv`'i birleştiren
  `paket_oku`, ilk mesajı **future'ın içinde** (yerel değişkende) tutar. `select!` onu drop ettiğinde o mesaj da gider.
  Çözüm: birikmiş durumu döngünün değişkeninde tutmak ya da future'ı döngüden önce bir kez oluşturup `pin!` +
  `&mut fut` ile beklemek.
feedback:
  - "`recv` iptal güvenlidir; sorun iki çağrıyı birleştiren fonksiyonda."
  - "Doğru!"
  - "Drop edilen future bir daha yoklanmaz; arka planda devam etmez."
  - "`mpsc` sınırlı kanalda gönderici mesaj düşürmez, bekler (geri basınç)."
```

## Uygulama

```exercise
id: m19-boss-e-sube-stok
title: Şube stoklarını aynı anda topla
difficulty: 3
prompt: |
  Bir zincir marketin stok paneli, bir ürünün toplam stoğunu bütün şubelere sorarak hesaplıyor. `stok_sor(sube)`
  hazır: her şube farklı hızda cevap veriyor, tanınmayan şube için `Err` döndürüyor.

  `toplam_stok` fonksiyonunu tamamla:

  - Bütün şubeleri **aynı anda** sorgula (sırayla sorgulamak 100 ms'den uzun sürer; seninki sürmemeli).
  - Bütün cevaplar `Ok` ise toplamı `Ok(toplam)` olarak döndür; boş liste `Ok(0)`'dır.
  - Herhangi bir şube `Err` döndürürse o hatayı döndür.
starter: |
  use std::time::Duration;

  async fn stok_sor(sube: &str) -> Result<u32, String> {
      let (gecikme, adet) = match sube {
          "Kadıköy" => (40, 12),
          "Çankaya" => (30, 7),
          "Konak" => (50, 20),
          "Merkez" => (10, 3),
          _ => {
              tokio::time::sleep(Duration::from_millis(5)).await;
              return Err(format!("{sube} şubesi bulunamadı"));
          }
      };
      tokio::time::sleep(Duration::from_millis(gecikme)).await;
      Ok(adet)
  }

  async fn toplam_stok(subeler: &[&str]) -> Result<u32, String> {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      println!("{:?}", toplam_stok(&["Kadıköy", "Çankaya", "Konak"]).await);
      println!("{:?}", toplam_stok(&["Merkez", "Bornova"]).await);
  }
solution: |
  use std::time::Duration;

  async fn stok_sor(sube: &str) -> Result<u32, String> {
      let (gecikme, adet) = match sube {
          "Kadıköy" => (40, 12),
          "Çankaya" => (30, 7),
          "Konak" => (50, 20),
          "Merkez" => (10, 3),
          _ => {
              tokio::time::sleep(Duration::from_millis(5)).await;
              return Err(format!("{sube} şubesi bulunamadı"));
          }
      };
      tokio::time::sleep(Duration::from_millis(gecikme)).await;
      Ok(adet)
  }

  async fn toplam_stok(subeler: &[&str]) -> Result<u32, String> {
      // Bütün sorguları aynı görevde, aynı anda yokla
      let cevaplar = futures::future::join_all(subeler.iter().map(|s| stok_sor(s))).await;
      let mut toplam = 0;
      for cevap in cevaplar {
          toplam += cevap?; // ilk Err'de dön
      }
      Ok(toplam)
  }

  #[tokio::main]
  async fn main() {
      println!("{:?}", toplam_stok(&["Kadıköy", "Çankaya", "Konak"]).await);
      println!("{:?}", toplam_stok(&["Merkez", "Bornova"]).await);
  }
check: tests
tests: |
  use std::time::Instant;

  #[tokio::test]
  async fn uc_subenin_toplami_ve_hiz() {
      let baslangic = Instant::now();
      let sonuc = toplam_stok(&["Kadıköy", "Çankaya", "Konak"]).await;
      let sure = baslangic.elapsed();
      assert_eq!(sonuc, Ok(39), "12 + 7 + 20 = 39 olmalı");
      assert!(
          sure < Duration::from_millis(100),
          "şubeler aynı anda sorgulanmalı (sırayla 120 ms sürer); ölçülen: {sure:?}"
      );
  }

  #[tokio::test]
  async fn bilinmeyen_sube_hata_verir() {
      let sonuc = toplam_stok(&["Merkez", "Bornova", "Konak"]).await;
      assert_eq!(sonuc, Err(String::from("Bornova şubesi bulunamadı")), "bilinmeyen şubenin hatası dönmeli");
  }

  #[tokio::test]
  async fn bos_liste_sifir() {
      assert_eq!(toplam_stok(&[]).await, Ok(0), "şube yoksa toplam 0 olmalı");
  }

  #[tokio::test]
  async fn tek_sube() {
      assert_eq!(toplam_stok(&["Merkez"]).await, Ok(3));
  }
hints:
  - "Sırayla `stok_sor(s).await` yapmak doğru sonucu verir ama yavaştır. Sayısı belli olmayan future'ları aynı anda beklemek için Ders 3'teki ipucunu hatırla: `futures::future::join_all`."
  - "`futures::future::join_all(subeler.iter().map(|s| stok_sor(s))).await` bir `Vec<Result<u32, String>>` verir; her şube sırayla bir eleman."
  - "Sonra bir döngüde `toplam += cevap?;` yap ve sonunda `Ok(toplam)` döndür. `?`, ilk `Err`'de fonksiyondan o hatayla çıkar."
explanation: |
  `join_all`, bir future koleksiyonunu tek bir future'da **aynı anda** yoklar (ayrı görev açmaz; `join!`'in dinamik
  sayılı hâli). Toplam süre en yavaş şube kadar (~50 ms) olur. Sonuçlar **giriş sırasıyla** gelir; ardından Modül
  10'daki `?` ile hatayı yayıyoruz.

  Alternatifler: `futures::future::try_join_all(...)` aynı işi tek satırda yapar ve **ilk hatada** diğer sorguları
  iptal eder (`try_join!`'in dinamik hâli): `Ok(try_join_all(..).await?.into_iter().sum())`. `JoinSet` de olurdu,
  ama `&str`'ler `'static` olmadığı için önce `String`'e çevirmek gerekirdi. Şube sayısı çok fazlaysa
  `stream::iter(subeler).map(stok_sor).buffered(8)` ile eşzamanlılığı sınırlamak sunucuyu korur.
```

```exercise
id: m19-boss-e-sinirli-indirici
title: Sınırlı eşzamanlı indirici
difficulty: 4
prompt: |
  Bir harita uygulaması çevrimdışı kullanım için çok sayıda harita parçası indiriyor. Sunucu aynı anda çok fazla
  istek gelirse kullanıcıyı engelliyor; bu yüzden **en fazla `limit` indirme aynı anda** yapılmalı. `Sunucu` hazır:
  `indir` her çağrıda aynı anda kaç indirme olduğunu ölçüyor (`en_fazla`), `.exe` uzantılı dosyaları reddediyor.

  `hepsini_indir(sunucu, dosyalar, limit)` fonksiyonunu tamamla ve `(toplam_bayt, basarisizlar)` döndür:

  - Aynı anda en fazla `limit` indirme olsun, ama `limit` kadar paralellikten de **yararlan** (testler
    `en_fazla == limit` olmasını bekliyor).
  - Başarılı indirmelerin bayt sayılarını topla.
  - Başarısız dosyaların adlarını **giriş sırasıyla** `basarisizlar` listesine koy.
  - Boş liste `(0, vec![])` verir. `limit` her zaman en az 1'dir.
starter: |
  use futures::stream::{self, StreamExt};
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::time::Duration;

  struct Sunucu {
      aktif: AtomicUsize,
      en_fazla: AtomicUsize,
  }

  impl Sunucu {
      fn new() -> Sunucu {
          Sunucu { aktif: AtomicUsize::new(0), en_fazla: AtomicUsize::new(0) }
      }

      async fn indir(&self, dosya: &str) -> Result<usize, String> {
          let simdi = self.aktif.fetch_add(1, Ordering::SeqCst) + 1;
          self.en_fazla.fetch_max(simdi, Ordering::SeqCst);
          tokio::time::sleep(Duration::from_millis(20)).await;
          self.aktif.fetch_sub(1, Ordering::SeqCst);
          if dosya.ends_with(".exe") {
              Err(format!("{dosya}: güvenlik nedeniyle engellendi"))
          } else {
              Ok(dosya.len() * 100)
          }
      }
  }

  async fn hepsini_indir(sunucu: &Sunucu, dosyalar: Vec<String>, limit: usize) -> (usize, Vec<String>) {
      todo!()
  }

  #[tokio::main]
  async fn main() {
      let sunucu = Sunucu::new();
      let dosyalar = vec![String::from("isparta.png"), String::from("virus.exe"), String::from("egirdir.png")];
      let (bayt, hatalar) = hepsini_indir(&sunucu, dosyalar, 2).await;
      println!("{bayt} bayt indirildi, başarısız: {hatalar:?}");
      println!("aynı anda en fazla: {}", sunucu.en_fazla.load(Ordering::SeqCst));
  }
solution: |
  use futures::stream::{self, StreamExt};
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::time::Duration;

  struct Sunucu {
      aktif: AtomicUsize,
      en_fazla: AtomicUsize,
  }

  impl Sunucu {
      fn new() -> Sunucu {
          Sunucu { aktif: AtomicUsize::new(0), en_fazla: AtomicUsize::new(0) }
      }

      async fn indir(&self, dosya: &str) -> Result<usize, String> {
          let simdi = self.aktif.fetch_add(1, Ordering::SeqCst) + 1;
          self.en_fazla.fetch_max(simdi, Ordering::SeqCst);
          tokio::time::sleep(Duration::from_millis(20)).await;
          self.aktif.fetch_sub(1, Ordering::SeqCst);
          if dosya.ends_with(".exe") {
              Err(format!("{dosya}: güvenlik nedeniyle engellendi"))
          } else {
              Ok(dosya.len() * 100)
          }
      }
  }

  async fn hepsini_indir(sunucu: &Sunucu, dosyalar: Vec<String>, limit: usize) -> (usize, Vec<String>) {
      let sonuclar: Vec<(String, Result<usize, String>)> = stream::iter(dosyalar)
          .map(|dosya| async move {
              let sonuc = sunucu.indir(&dosya).await;
              (dosya, sonuc)
          })
          .buffered(limit) // en fazla `limit` indirme aynı anda; sonuçlar giriş sırasıyla
          .collect()
          .await;

      let mut toplam = 0;
      let mut basarisizlar = Vec::new();
      for (dosya, sonuc) in sonuclar {
          match sonuc {
              Ok(bayt) => toplam += bayt,
              Err(_) => basarisizlar.push(dosya),
          }
      }
      (toplam, basarisizlar)
  }

  #[tokio::main]
  async fn main() {
      let sunucu = Sunucu::new();
      let dosyalar = vec![String::from("isparta.png"), String::from("virus.exe"), String::from("egirdir.png")];
      let (bayt, hatalar) = hepsini_indir(&sunucu, dosyalar, 2).await;
      println!("{bayt} bayt indirildi, başarısız: {hatalar:?}");
      println!("aynı anda en fazla: {}", sunucu.en_fazla.load(Ordering::SeqCst));
  }
check: tests
tests: |
  fn liste(adlar: &[&str]) -> Vec<String> {
      adlar.iter().map(|s| s.to_string()).collect()
  }

  #[tokio::test]
  async fn limit_iki_ve_toplam() {
      let sunucu = Sunucu::new();
      let dosyalar = liste(&["a.png", "bb.png", "ccc.png", "d.png", "ee.png", "f.png"]);
      let (bayt, hatalar) = hepsini_indir(&sunucu, dosyalar, 2).await;
      assert_eq!(bayt, (5 + 6 + 7 + 5 + 6 + 5) * 100, "bütün dosyaların bayt toplamı");
      assert!(hatalar.is_empty(), "hiçbir dosya başarısız olmamalı");
      assert_eq!(
          sunucu.en_fazla.load(Ordering::SeqCst),
          2,
          "aynı anda tam olarak 2 indirme olmalı: daha fazlası limiti aşar, daha azı paralellikten yararlanmaz"
      );
  }

  #[tokio::test]
  async fn basarisizlar_giris_sirasiyla() {
      let sunucu = Sunucu::new();
      let dosyalar = liste(&["kur.exe", "harita.png", "oyun.exe", "yol.png"]);
      let (bayt, hatalar) = hepsini_indir(&sunucu, dosyalar, 3).await;
      assert_eq!(bayt, (10 + 7) * 100, "yalnızca .png'ler sayılmalı");
      assert_eq!(hatalar, liste(&["kur.exe", "oyun.exe"]), "başarısızlar giriş sırasıyla listelenmeli");
      assert!(sunucu.en_fazla.load(Ordering::SeqCst) <= 3, "limit 3 aşılmamalı");
  }

  #[tokio::test]
  async fn limit_bir_sirali_indirir() {
      let sunucu = Sunucu::new();
      let (bayt, _) = hepsini_indir(&sunucu, liste(&["x.png", "y.png", "z.png"]), 1).await;
      assert_eq!(bayt, 1500);
      assert_eq!(sunucu.en_fazla.load(Ordering::SeqCst), 1, "limit 1 iken indirmeler tek tek yapılmalı");
  }

  #[tokio::test]
  async fn bos_liste() {
      let sunucu = Sunucu::new();
      assert_eq!(hepsini_indir(&sunucu, Vec::new(), 4).await, (0, vec![]), "boş liste (0, []) vermeli");
  }
hints:
  - "Ders 6'daki tabloyu hatırla: future üreten bir stream'den aynı anda en fazla `n` tanesini yürüten adaptör `buffered(n)`'dir ve sonuçları giriş sırasıyla verir."
  - "`stream::iter(dosyalar).map(|dosya| async move { let sonuc = sunucu.indir(&dosya).await; (dosya, sonuc) })` her dosyayı, adını ve sonucunu veren bir future'a çevirir. `sunucu` bir `&Sunucu` olduğu için `async move` onun **referansını** kopyalar."
  - "Ardından `.buffered(limit).collect::<Vec<_>>().await` ile `(String, Result<usize, String>)` çiftlerini topla; bir döngüde `Ok(bayt)` ise toplama ekle, `Err` ise dosya adını listeye koy."
explanation: |
  `.map(...)` her dosyayı henüz çalışmayan bir future'a çevirir; `.buffered(limit)` bu future'lardan **en fazla
  `limit` tanesini aynı anda** yoklar, biri bitince sıradakini başlatır ve sonuçları **giriş sırasıyla** verir. Bu
  yüzden başarısızlar listesi ayrıca sıralama gerektirmez. Dosya adını sonuçla birlikte taşıdık, çünkü hata
  durumunda hangi dosyanın başarısız olduğunu bilmemiz gerekiyor.

  `async move` closure'ı neden derleniyor? `dosya` (`String`) future'a taşınıyor; `sunucu` ise bir `&Sunucu` ve
  referanslar `Copy` olduğu için future'a referansın kopyası gidiyor. Görev açmadığımız (`spawn` yok) için `'static`
  şartı da yok; future'lar `sunucu`'yu rahatça ödünç alabiliyor.

  Alternatif: Ders 4'teki `Semaphore` (`acquire().await` ile izin alıp indirmek) ve `join_all`. Aynı sonucu verir
  ama daha uzundur. `buffer_unordered(limit)` de olurdu; sonuçlar bitiş sırasıyla geleceği için başarısızları
  giriş sırasına göre yeniden düzenlemen gerekirdi. Sınırsız `join_all` ise `en_fazla`'yı dosya sayısına çıkarır ve
  gerçek bir sunucuda seni engellenmeye götürürdü.
```
