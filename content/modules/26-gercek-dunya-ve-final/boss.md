---
id: m26-boss
title: "Final Boss: Gerçek Dünya Rust"
minutes: 50
type: boss
objectives:
  - Ekosistem, serde, HTTP ve thread havuzu bilgisini karışık sorularla uygulayabilmek
  - serde özniteliklerinin ürettiği JSON'u ve sunucu/havuz kodunun davranışını öngörebilmek
  - JSON okuyan, HTTP isteği ayrıştıran ve bir thread havuzunda sıralı paralel hesap yapan kodu sıfırdan yazabilmek
keywords: [boss, final, serde, serde_json, HTTP, "Content-Length", ThreadPool, Drop, Arc, mpsc, paralel]
---

Son boss! Bu sınav, Rusteach yolculuğunun son kapısı. Sorular bu modülün beş dersini karıştırarak geliyor,
aralarda önceki modüllerden (ödünç alma, hata yönetimi, `Send`) tanıdık yüzler de var. En sonda üç
alıştırma seni bekliyor: Bir JSON sepeti, bir HTTP ayrıştırıcısı ve bir thread havuzunda sırayı koruyan
paralel bir `map`. Geçmek için **%80** gerekiyor.

Acele etme. Her soruda önce kendi cevabını kafanda kur, sonra seçeneklere bak.

## Ekosistem ve serde

```quiz
question: |
  Bir async web servisinde her isteğin hangi adımlarda ne kadar zaman harcadığını, iç içe "span"ler
  hâlinde ve yapılandırılmış (anahtar-değer) loglarla izlemek istiyorsun. Ekosistemdeki standart seçim hangisi?
options:
  - "`serde`"
  - "`tracing`"
  - "`clap`"
  - "`rayon`"
answer: 1
explanation: |
  `tracing`, olayları **span**'lere bağlar; async kodda bir görev thread'ler arasında gezse bile hangi
  isteğe ait olduğu kaybolmaz. `tracing-subscriber` ile çıktıyı konsola, JSON'a ya da bir izleme
  sistemine yönlendirirsin. `log` crate'i daha basit, düz bir arayüzdür.
feedback:
  - "`serde` serileştirme içindir; log yazmaz."
  - Doğru!
  - "`clap` komut satırı argümanlarını ayrıştırır."
  - "`rayon` veri paralelliği içindir."
```

```predict
code: |
  use serde::Serialize;

  #[derive(Serialize)]
  #[serde(rename_all = "camelCase")]
  struct Siparis {
      masa_no: u8,
      urunler: Vec<String>,
      #[serde(skip_serializing_if = "Option::is_none")]
      aciklama: Option<String>,
      #[serde(rename = "odendi")]
      hesap_kapandi: bool,
  }

  fn main() {
      let s = Siparis {
          masa_no: 4,
          urunler: vec![String::from("çay"), String::from("simit")],
          aciklama: None,
          hesap_kapandi: false,
      };
      println!("{}", serde_json::to_string(&s).unwrap());
  }
options:
  - "{\"masaNo\":4,\"urunler\":[\"çay\",\"simit\"],\"odendi\":false}"
  - "{\"masaNo\":4,\"urunler\":[\"çay\",\"simit\"],\"aciklama\":null,\"odendi\":false}"
  - "{\"masa_no\":4,\"urunler\":[\"çay\",\"simit\"],\"odendi\":false}"
  - "{\"masaNo\":4,\"urunler\":[\"çay\",\"simit\"],\"hesapKapandi\":false}"
answer: 0
explanation: |
  `rename_all = "camelCase"` bütün alanlara uygulanır (`masa_no` → `masaNo`). Alana özel `rename` ise onu
  **geçersiz kılar**: `hesap_kapandi` → `odendi`. `skip_serializing_if = "Option::is_none"` olmasaydı
  `None` alan `null` olarak yazılırdı. Türkçe harfler JSON'da olduğu gibi kalır, çünkü JSON UTF-8'dir.
```

```predict
code: |
  use serde::Serialize;

  #[derive(Serialize)]
  #[serde(tag = "tur", rename_all = "snake_case")]
  enum Bildirim {
      YeniSiparis { masa: u8 },
      HesapIstendi { masa: u8, tutar: u32 },
      Kapanis,
  }

  fn main() {
      let liste = [
          Bildirim::YeniSiparis { masa: 3 },
          Bildirim::HesapIstendi { masa: 3, tutar: 85 },
          Bildirim::Kapanis,
      ];
      for b in &liste {
          println!("{}", serde_json::to_string(b).unwrap());
      }
  }
options:
  - |
    {"YeniSiparis":{"masa":3}}
    {"HesapIstendi":{"masa":3,"tutar":85}}
    "Kapanis"
  - |
    {"tur":"yeni_siparis","masa":3}
    {"tur":"hesap_istendi","masa":3,"tutar":85}
    {"tur":"kapanis"}
  - |
    {"tur":"yeni_siparis","masa":3}
    {"tur":"hesap_istendi","masa":3,"tutar":85}
    "kapanis"
answer: 1
explanation: |
  `#[serde(tag = "tur")]` **içeriden etiketli** gösterimi seçer: Varyant adı, alanların yanına `"tur"`
  anahtarıyla eklenir. Enum'da `rename_all` varyant adlarına uygulanır (`HesapIstendi` → `hesap_istendi`).
  Verisiz varyant da bir nesne olur (`{"tur":"kapanis"}`), çünkü etiketin konacağı bir nesne gerekir.
  İlk seçenek varsayılan (dışarıdan etiketli) gösterimdir.
```

```compiles
code: |
  use serde::Deserialize;

  #[derive(Debug, Deserialize)]
  struct Urun {
      ad: String,
      stok: u32,
  }

  fn main() {
      let u = Urun { ad: String::from("defter"), stok: 3 };
      println!("{}", serde_json::to_string(&u).unwrap());
  }
answer: false
error: E0277
explanation: |
  `Urun` yalnızca `Deserialize` türetiyor; JSON'dan **okunabilir** ama JSON'a **yazılamaz**.
  `serde_json::to_string<T: Serialize>` sınırı sağlanmadığı için derleyici
  ``the trait bound `Urun: serde::Serialize` is not satisfied`` (E0277) der. Çözüm:
  `#[derive(Debug, Serialize, Deserialize)]`. İki yön bilerek ayrı trait'lerdir: Yalnızca okuduğun bir
  API yanıtına `Serialize` eklemek gereksiz kod üretir.
```

```fill
prompt: "(Modül 10 tekrarı) `port_oku` hem serde hatasını hem kendi hata mesajını aynı tipte döndürsün. Boşlukları doldur."
code: |
  use serde::Deserialize;
  use std::error::Error;

  #[derive(Debug, Deserialize)]
  struct Ayar {
      port: u16,
  }

  fn port_oku(json: &str) -> Result<u16, ___0> {
      let ayar: Ayar = serde_json::from_str(json)___1;
      if ayar.port < 1024 {
          return Err("1024'ten küçük portlar yönetici izni ister".into());
      }
      Ok(ayar.port)
  }

  fn main() {
      println!("{:?}", port_oku(r#"{"port": 7878}"#).ok());
      println!("{}", port_oku(r#"{"port": 80}"#).unwrap_err());
      println!("{}", port_oku(r#"{"port": "yok"}"#).is_err());
  }
blanks:
  - ["Box<dyn Error>", "Box<dyn std::error::Error>", "Box<dyn Error + 'static>"]
  - ["?"]
output: |
  Some(7878)
  1024'ten küçük portlar yönetici izni ister
  true
explanation: |
  `Box<dyn Error>` her hata tipini taşıyabilen bir trait nesnesidir. `?`, `serde_json::Error`'ı `From`
  aracılığıyla kutuya çevirip erken döner. `"...".into()` ise bir `&str`'yi `Box<dyn Error>`'a çevirir
  (std bunun için bir `From` impl'i sağlar). Bir kütüphanede bunun yerine `thiserror` ile tipli bir hata
  enum'u tercih ederdik (Modül 25).
```

## Web sunucusu

```quiz
question: |
  Gövdesi `Günaydın` olan bir HTTP yanıtı üretiyorsun. Aşağıdakilerden hangisi **tam olarak doğru**
  bir yanıttır? (`\r\n` CRLF'tir.)
options:
  - "`HTTP/1.1 200 OK\\r\\nContent-Length: 8\\r\\n\\r\\nGünaydın`"
  - "`HTTP/1.1 200 OK\\r\\nContent-Length: 10\\r\\nGünaydın`"
  - "`HTTP/1.1 200 OK\\r\\nContent-Length: 10\\r\\n\\r\\nGünaydın`"
  - "`HTTP/1.1 OK 200\\r\\nContent-Length: 10\\r\\n\\r\\nGünaydın`"
answer: 2
explanation: |
  `Günaydın` 8 karakterdir ama `ü` ve `ı` UTF-8'de ikişer bayt tutar: 10 bayt. `Content-Length` bayt
  sayar, yani `govde.len()`. Başlıklardan sonra **boş bir satır** (`\r\n\r\n`) gelmelidir. Durum satırının
  sırası da sabittir: `SÜRÜM KOD AÇIKLAMA`.
feedback:
  - "8 karakter sayısıdır; tarayıcı son iki baytı okumaz."
  - Başlıkları gövdeden ayıran boş satır eksik.
  - Doğru!
  - "Durum satırında kod açıklamadan önce gelir: `HTTP/1.1 200 OK`."
```

```predict
code: |
  use std::io::{BufRead, BufReader};

  fn main() {
      let ham = "GET /menu?dil=tr HTTP/1.1\r\nHost: lokanta\r\nAccept: text/html\r\n\r\ngövde\r\n";
      let satirlar: Vec<String> = BufReader::new(ham.as_bytes())
          .lines()
          .map(|s| s.unwrap())
          .take_while(|s| !s.is_empty())
          .collect();
      let yol = satirlar[0].split(' ').nth(1).unwrap();
      let (yol, sorgu) = yol.split_once('?').unwrap_or((yol, ""));
      println!("{} {yol} {sorgu}", satirlar.len());
  }
options:
  - "3 /menu dil=tr"
  - "4 /menu dil=tr"
  - "3 /menu?dil=tr"
  - "5 /menu dil=tr"
answer: 0
explanation: |
  `take_while` ilk boş satırda durur: İstek satırı ve iki başlık, toplam 3 satır. Gövde hiç okunmaz.
  `nth(1)` ikinci parçayı (yolu) verir ve `split_once('?')` yolu sorgu dizgisinden (query string) ayırır.
  Gerçek bir yönlendirici `/menu?dil=tr` ile `/menu`'yü aynı sayfaya götürmeli; bu ayrımı yapmazsan
  sorgu parametreli her istek 404'e düşer.
```

```compiles
question: "(Modül 5 tekrarı) Bir yönlendirici yardımcısı. Derlenir mi?"
code: |
  fn govde_sec(yol: &str) -> &str {
      let sayfa = format!("<h1>{yol}</h1>");
      &sayfa
  }

  fn main() {
      println!("{}", govde_sec("/menu"));
  }
answer: false
error: E0515
explanation: |
  `sayfa` fonksiyonun içinde oluşturulan bir `String`; fonksiyon bitince drop edilir. Ona bir referans
  döndürmek sarkan bir referans (dangling reference) olurdu: ``cannot return reference to local variable `sayfa` ``.
  Çözüm sahipliği çağırana vermek: dönüş tipi `String`, son ifade `sayfa`. Elision kuralı dönüş
  referansını `yol`'a bağlar, ama `sayfa` `yol`'dan ödünç alınmış değil.
```

## Thread havuzu ve yol haritası

```compiles
question: "(Modül 17 ve 18 tekrarı) Derlenir mi?"
code: |
  use std::rc::Rc;
  use std::thread;

  fn execute<F>(f: F)
  where
      F: FnOnce() + Send + 'static,
  {
      thread::spawn(f).join().unwrap();
  }

  fn main() {
      let sayac = Rc::new(5);
      let kopya = Rc::clone(&sayac);
      execute(move || println!("{kopya}"));
  }
answer: false
error: E0277
explanation: |
  `move` ile `kopya` closure'a taşındı, `'static` sağlandı. Ama `Rc`'nin referans sayacı atomik
  **değildir**: İki thread aynı anda sayacı değiştirirse sayı bozulur. Bu yüzden `Rc<T>` `Send` değildir ve
  `F: Send` sınırı sağlanmaz: `` `Rc<i32>` cannot be sent between threads safely ``. Çözüm: `Arc`.
```

```quiz
question: "Havuzumuzda gönderici neden `gonderici: Option<mpsc::Sender<Job>>` olarak tutuluyor?"
options:
  - "`Sender` `Clone` olmadığı için başka türlü saklanamaz"
  - "`Drop` yalnızca `&mut self` verir; göndericiyi `take()` ile çıkarıp drop ederek kanalı kapatmak, böylece worker'ların `recv`'den `Err` alıp döngüden çıkmasını sağlamak için"
  - "Havuz bazen göndericisiz oluşturulabilsin diye"
  - "`execute` içinde göndericiyi tüketmek gerektiği için"
answer: 1
explanation: |
  Kanal, **bütün** göndericiler drop edilince kapanır. `drop(&mut self)` içinde bir alanı doğrudan
  taşıyamayız (E0507); `Option::take` değeri çıkarıp yerine `None` bırakır. Göndericiyi drop etmek **önce**
  gelmeli; aksi hâlde `join` sonsuza dek `recv`'de bekleyen bir worker'ı bekler.
feedback:
  - "`Sender` `Clone`'dur; çok üretici zaten bu sayede mümkün."
  - Doğru!
  - "`new` her zaman `Some(gonderici)` ile kurar; `None` yalnızca kapanışta oluşur."
  - "`execute` `as_ref()` ile ödünç alır; göndericiyi tüketmez."
```

```predict
question: "Havuz önceki dersteki gibi (kanal, `Arc<Mutex<Receiver>>`, `Drop`'ta `take` + `drain` + `join`). Program ne yazdırır?"
code: |
  # use std::sync::{Arc, Mutex, mpsc};
  # use std::thread;
  # type Job = Box<dyn FnOnce() + Send + 'static>;
  # pub struct ThreadPool {
  #     workers: Vec<thread::JoinHandle<()>>,
  #     gonderici: Option<mpsc::Sender<Job>>,
  # }
  # impl ThreadPool {
  #     pub fn new(boyut: usize) -> ThreadPool {
  #         let (gonderici, alici) = mpsc::channel::<Job>();
  #         let alici = Arc::new(Mutex::new(alici));
  #         let workers = (0..boyut)
  #             .map(|_| {
  #                 let alici = Arc::clone(&alici);
  #                 thread::spawn(move || {
  #                     loop {
  #                         let mesaj = alici.lock().unwrap().recv();
  #                         match mesaj {
  #                             Ok(is) => is(),
  #                             Err(_) => break,
  #                         }
  #                     }
  #                 })
  #             })
  #             .collect();
  #         ThreadPool { workers, gonderici: Some(gonderici) }
  #     }
  #     pub fn execute<F: FnOnce() + Send + 'static>(&self, f: F) {
  #         self.gonderici.as_ref().unwrap().send(Box::new(f)).unwrap();
  #     }
  # }
  # impl Drop for ThreadPool {
  #     fn drop(&mut self) {
  #         drop(self.gonderici.take());
  #         for w in self.workers.drain(..) {
  #             w.join().unwrap();
  #         }
  #     }
  # }
  #
  fn main() {
      let sonuclar = Arc::new(Mutex::new(Vec::new()));
      let havuz = ThreadPool::new(2);
      for i in 1..=4 {
          let sonuclar = Arc::clone(&sonuclar);
          havuz.execute(move || sonuclar.lock().unwrap().push(i * 10));
      }
      drop(havuz);
      let mut v = sonuclar.lock().unwrap().clone();
      v.sort();
      println!("{v:?} {}", Arc::strong_count(&sonuclar));
  }
options:
  - "[10, 20, 30, 40] 1"
  - "[10, 20, 30, 40] 5"
  - "[] 1"
  - Sıra ve sayı her çalıştırmada değişir
answer: 0
explanation: |
  `drop(havuz)` zarif kapanmadır: Kanal kapanır, kuyruktaki dört iş bitirilir ve iki worker da `join`
  edilir. Böylece vektörde dört sonuç vardır; **hangi sırayla** eklendikleri belirsizdir ama `sort`
  sırayı sabitler. Her iş closure'ı bir `Arc` kopyası taşıyordu; `FnOnce` çağrısı closure'ı tükettiği
  için o kopyalar iş bitince drop edildi. Geriye yalnızca `main`'deki `sonuclar` kalır: güçlü sayaç 1.
```

```quiz
question: |
  Zeynep bu modülü bitirdi. Kodunun **idiomatik** olup olmadığı hakkında deneyimli bir insandan geri
  bildirim almak istiyor. Hangi kaynak bunu en doğrudan sağlar?
options:
  - Rustlings
  - Exercism'in Rust yolu
  - The Rustonomicon
  - Advent of Code
answer: 1
explanation: |
  Exercism'de çözümünü gönderdikten sonra gönüllü bir mentordan kod incelemesi isteyebilirsin. Rustlings
  ve Advent of Code harika pratik kaynaklarıdır ama geri bildirim derleyiciden ya da cevabın doğruluğundan
  gelir, bir insandan değil. Bir sonraki adım, açık kaynak bir projeye PR göndermek ve bakımcının
  incelemesinden öğrenmektir.
feedback:
  - Rustlings'te geri bildirim derleyiciden ve testlerden gelir.
  - Doğru!
  - "Rustonomicon `unsafe` kuralları için bir kitaptır."
  - Advent of Code yalnızca cevabın doğru olup olmadığını söyler.
```

## Uygulama

```exercise
title: Sepet özeti (serde)
difficulty: 3
prompt: |
  Bir lokantanın sipariş servisi sepeti şu biçimde JSON olarak gönderiyor:

  `[{"urun": "çay", "birimFiyat": 15, "adet": 4}, {"urun": "künefe", "birimFiyat": 90}]`

  `Kalem` yapısını serde ile tanımla ve `sepet_ozeti` fonksiyonunu yaz. Fonksiyon şunu döndürsün:
  `(toplam_tutar, en_yüksek_tutarlı_kalemin_ürün_adı)`.

  - JSON anahtarları **camelCase** (`birimFiyat`), Rust alanları snake_case (`birim_fiyat`) olmalı.
  - `adet` yoksa **1** kabul edilir.
  - Kalem tutarı `birim_fiyat * adet`. Boş sepette en pahalı kalem `None`.
  - Tanınmayan alanlar yok sayılır. Bozuk JSON ya da yanlış tip `Err` olmalı (hatayı `?` ile yay).
starter: |
  use serde::Deserialize;

  // Kalem yapısını burada tanımla.

  fn sepet_ozeti(json: &str) -> Result<(u32, Option<String>), serde_json::Error> {
      todo!()
  }

  fn main() {
      let sepet = r#"[
          {"urun": "çay", "birimFiyat": 15, "adet": 4},
          {"urun": "simit", "birimFiyat": 20, "adet": 2},
          {"urun": "künefe", "birimFiyat": 90}
      ]"#;
      println!("{:?}", sepet_ozeti(sepet));
  }
solution: |
  use serde::Deserialize;

  #[derive(Debug, Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct Kalem {
      urun: String,
      birim_fiyat: u32,
      #[serde(default = "bir")]
      adet: u32,
  }

  fn bir() -> u32 {
      1
  }

  fn sepet_ozeti(json: &str) -> Result<(u32, Option<String>), serde_json::Error> {
      let kalemler: Vec<Kalem> = serde_json::from_str(json)?;
      let toplam = kalemler.iter().map(|k| k.birim_fiyat * k.adet).sum();
      let en_pahali = kalemler
          .into_iter()
          .max_by_key(|k| k.birim_fiyat * k.adet)
          .map(|k| k.urun);
      Ok((toplam, en_pahali))
  }

  fn main() {
      let sepet = r#"[
          {"urun": "çay", "birimFiyat": 15, "adet": 4},
          {"urun": "simit", "birimFiyat": 20, "adet": 2},
          {"urun": "künefe", "birimFiyat": 90}
      ]"#;
      println!("{:?}", sepet_ozeti(sepet));
  }
check: tests
tests: |
  #[test]
  fn toplam_ve_en_pahali_kalem() {
      let sepet = r#"[{"urun":"çay","birimFiyat":15,"adet":4},{"urun":"künefe","birimFiyat":90,"adet":1}]"#;
      assert_eq!(sepet_ozeti(sepet).unwrap(), (150, Some(String::from("künefe"))));
  }

  #[test]
  fn adet_yoksa_bir_sayilir() {
      let sepet = r#"[{"urun":"simit","birimFiyat":20},{"urun":"ayran","birimFiyat":25,"adet":3}]"#;
      assert_eq!(
          sepet_ozeti(sepet).unwrap(),
          (95, Some(String::from("ayran"))),
          "adet alanı yoksa 1 kabul edilmeli: 20 + 25*3 = 95"
      );
  }

  #[test]
  fn bos_sepet_ve_fazla_alan() {
      assert_eq!(sepet_ozeti("[]").unwrap(), (0, None), "boş sepetin toplamı 0, en pahalı kalemi yok");
      let sepet = r#"[{"urun":"su","birimFiyat":10,"kampanya":true}]"#;
      assert_eq!(sepet_ozeti(sepet).unwrap(), (10, Some(String::from("su"))), "tanınmayan alanlar yok sayılmalı");
  }

  #[test]
  fn bozuk_girdiler_hata_verir() {
      assert!(sepet_ozeti(r#"[{"urun":"su","birim_fiyat":10}]"#).is_err(), "anahtar camelCase olmalı: birimFiyat");
      assert!(sepet_ozeti(r#"[{"urun":"su","birimFiyat":"on"}]"#).is_err(), "fiyat sayı olmalı");
      assert!(sepet_ozeti(r#"[{"urun":"su","birimFiyat":10}"#).is_err(), "yarım JSON hata vermeli");
  }
hints:
  - "`#[derive(Deserialize)]` ve tipin üstüne `#[serde(rename_all = \"camelCase\")]`. Alanlar: `urun: String`, `birim_fiyat: u32`, `adet: u32`."
  - "`adet` için `#[serde(default = \"bir\")]` ve `fn bir() -> u32 { 1 }`. Düz `#[serde(default)]` 0 verirdi!"
  - "`let kalemler: Vec<Kalem> = serde_json::from_str(json)?;` sonra toplam için `iter().map(...).sum()`, en pahalı için `into_iter().max_by_key(...).map(|k| k.urun)`."
explanation: |
  `rename_all = "camelCase"` sayesinde Rust tarafı Rust'ça (`birim_fiyat`), JSON tarafı JavaScript'çe
  (`birimFiyat`) kalıyor. `#[serde(default)]` burada **yanlış** olurdu: `u32`'nin varsayılanı 0'dır ve
  adetsiz kalemler bedavaya giderdi. Bu yüzden `default = "bir"` ile bir fonksiyon verdik.

  Önce `iter()` ile toplamı hesaplayıp sonra `into_iter()` ile vektörü tüketmek, kazanan kalemin
  `String`'ini **klonlamadan** taşımamızı sağlıyor (Modül 25). `max_by_key` boş iterator'da `None` döndürür;
  boş sepet durumu kendiliğinden çözülür. Eşit tutarlarda `max_by_key` **sonuncuyu** seçer; bir iş kuralı
  olarak önemliyse bunu belgelemek gerekir.
```

```exercise
title: HTTP isteği ayrıştırıcı
difficulty: 4
prompt: |
  Ham bir HTTP isteğini (`&str`) bir `Istek`'e çeviren `istek_ayristir` fonksiyonunu yaz. Herhangi bir kural
  bozulursa `None` döndür.

  1. Başlık bölümü ile gövde **ilk** `\r\n\r\n` ile ayrılır. Yoksa istek eksiktir.
  2. Başlık bölümünün satırları `\r\n` ile ayrılır. İlk satır tek boşluklarla ayrılmış tam 3 parçadır:
     `YÖNTEM YOL SÜRÜM`.
  3. Kalan her satır `Ad: değer` biçimindedir ve **ilk** `:`'dan bölünür (değerde `:` olabilir:
     `Host: 127.0.0.1:7878`). Ad **küçük harfe** çevrilir, ad ve değerin kenar boşlukları atılır.
     `:` içermeyen satır bozuktur.
  4. `content-length` başlığı varsa sayı olmalı ve gövdeden **tam o kadar bayt** alınır (fazlası
     atılır). Gövde daha kısaysa ya da kesim bir UTF-8 karakterinin ortasına denk geliyorsa `None`.
     Başlık yoksa gövde boş string'dir.
starter: |
  use std::collections::HashMap;

  #[derive(Debug, PartialEq)]
  struct Istek {
      yontem: String,
      yol: String,
      basliklar: HashMap<String, String>,
      govde: String,
  }

  fn istek_ayristir(ham: &str) -> Option<Istek> {
      todo!()
  }

  fn main() {
      let ham = "POST /siparis HTTP/1.1\r\nHost: lokanta\r\nContent-Length: 8\r\n\r\n2 çorba";
      match istek_ayristir(ham) {
          Some(i) => println!("{} {} → {:?}", i.yontem, i.yol, i.govde),
          None => println!("bozuk istek"),
      }
  }
solution: |
  use std::collections::HashMap;

  #[derive(Debug, PartialEq)]
  struct Istek {
      yontem: String,
      yol: String,
      basliklar: HashMap<String, String>,
      govde: String,
  }

  fn istek_ayristir(ham: &str) -> Option<Istek> {
      let (bas, kalan) = ham.split_once("\r\n\r\n")?;
      let mut satirlar = bas.split("\r\n");
      let ilk = satirlar.next()?;
      let parcalar: Vec<&str> = ilk.split(' ').collect();
      let [yontem, yol, _surum] = parcalar[..] else {
          return None;
      };

      let mut basliklar = HashMap::new();
      for satir in satirlar {
          let (ad, deger) = satir.split_once(':')?;
          basliklar.insert(ad.trim().to_lowercase(), deger.trim().to_string());
      }

      let govde = match basliklar.get("content-length") {
          Some(uzunluk) => {
              let n: usize = uzunluk.parse().ok()?;
              kalan.get(..n)?.to_string()
          }
          None => String::new(),
      };

      Some(Istek {
          yontem: yontem.to_string(),
          yol: yol.to_string(),
          basliklar,
          govde,
      })
  }

  fn main() {
      let ham = "POST /siparis HTTP/1.1\r\nHost: lokanta\r\nContent-Length: 8\r\n\r\n2 çorba";
      match istek_ayristir(ham) {
          Some(i) => println!("{} {} → {:?}", i.yontem, i.yol, i.govde),
          None => println!("bozuk istek"),
      }
  }
check: tests
tests: |
  #[test]
  fn govdesiz_get() {
      let i = istek_ayristir("GET /menu HTTP/1.1\r\nHost: lokanta\r\nAccept: */*\r\n\r\n").unwrap();
      assert_eq!((i.yontem.as_str(), i.yol.as_str()), ("GET", "/menu"));
      assert_eq!(i.basliklar.get("host").map(String::as_str), Some("lokanta"), "başlık adları küçük harfe çevrilmeli");
      assert_eq!(i.basliklar.len(), 2);
      assert_eq!(i.govde, "", "Content-Length yoksa gövde boştur");
  }

  #[test]
  fn content_length_bayt_sayar() {
      let ham = "POST /siparis HTTP/1.1\r\ncontent-LENGTH:  8 \r\n\r\n2 çorbaFAZLA";
      let i = istek_ayristir(ham).unwrap();
      assert_eq!(i.govde, "2 çorba", "\"2 çorba\" 7 karakter ama 8 bayttır; fazlası alınmamalı");
      assert_eq!(i.basliklar.get("content-length").map(String::as_str), Some("8"), "değerin boşlukları kırpılmalı");
  }

  #[test]
  fn deger_iki_nokta_icerebilir() {
      let i = istek_ayristir("GET / HTTP/1.1\r\nHost: 127.0.0.1:7878\r\n\r\n").unwrap();
      assert_eq!(i.basliklar["host"], "127.0.0.1:7878", "yalnızca İLK ':' işaretinden bölünmeli");
  }

  #[test]
  fn bozuk_istekler_none() {
      assert_eq!(istek_ayristir("GET / HTTP/1.1\r\nHost: x\r\n"), None, "boş satır yoksa başlıklar bitmemiştir");
      assert_eq!(istek_ayristir("GET /\r\n\r\n"), None, "istek satırı 3 parça olmalı");
      assert_eq!(istek_ayristir("GET / HTTP/1.1\r\nBozukBaslik\r\n\r\n"), None, "':' içermeyen başlık bozuktur");
      assert_eq!(
          istek_ayristir("POST / HTTP/1.1\r\nContent-Length: 50\r\n\r\nkısa"),
          None,
          "gövde Content-Length'ten kısaysa istek eksiktir"
      );
      assert_eq!(istek_ayristir("POST / HTTP/1.1\r\nContent-Length: on\r\n\r\n"), None, "uzunluk sayı olmalı");
      assert_eq!(
          istek_ayristir("POST / HTTP/1.1\r\nContent-Length: 1\r\n\r\nçay"),
          None,
          "1 bayt, 2 baytlık 'ç' harfinin ortasında biter; böyle bir kesim panik değil None vermeli"
      );
      let cay = istek_ayristir("POST / HTTP/1.1\r\nContent-Length: 2\r\n\r\nçay").unwrap();
      assert_eq!(cay.govde, "ç", "2 bayt tam olarak 'ç' harfidir");
  }
hints:
  - "`let (bas, kalan) = ham.split_once(\"\\r\\n\\r\\n\")?;` ile başla; `?` bir `Option` döndüren fonksiyonda `None`'ı erken döndürür."
  - "İlk satır için önceki dersteki let-else + dilim desenini kullan. Başlıklar için `satir.split_once(':')?` ve `ad.trim().to_lowercase()`."
  - "Gövde: `basliklar.get(\"content-length\")` varsa `let n: usize = uzunluk.parse().ok()?;` ve `kalan.get(..n)?.to_string()`. `str::get` aralık dışında **ya da** karakter sınırı dışında `None` döner."
explanation: |
  Fonksiyon `Option` döndürdüğü için `?` her adımda "bozuksa çık" demenin en kısa yolu: `split_once`,
  `next`, `parse().ok()` ve `get(..n)` hepsi `Option` üretiyor (Modül 10).

  Gövdeyi `&kalan[..n]` ile kesmek **panik** riski taşırdı: `n` gövdeden uzunsa ya da bir UTF-8 karakterinin
  ortasına denk gelirse dilimleme paniğe girer (Modül 9). İnternetten gelen veriyle sunucunun çökmesi kabul
  edilemez; `str::get` aynı işi panik yerine `None` ile yapar.

  `split_once(':')` yalnızca ilk `:`'dan böler; `split(':')` kullansaydın `Host: 127.0.0.1:7878` üç parçaya
  bölünürdü. Başlık adlarını küçük harfe çevirmek HTTP'nin kuralıdır: Başlık adları büyük/küçük harfe
  duyarsızdır (`Content-Length` = `content-length`). Gerçek bir sunucu bunlara ek olarak başlık sayısını ve
  toplam boyutu sınırlar; aksi hâlde tek bir istemci sonsuz başlık göndererek belleği tüketebilir.
```

```exercise
title: Sırayı koruyan paralel map
difficulty: 5
prompt: |
  Havuz hazır. `paralel_map(havuz, girdiler, f)` fonksiyonunu yaz: Her girdiyi **ayrı bir iş olarak**
  havuzda `f`'ten geçirsin ve sonuçları **girdilerin sırasıyla** bir `Vec`'te döndürsün. İşler farklı
  hızlarda bitebilir; sıra yine de korunmalı.

  - `f` bütün işler arasında **paylaşılacak** (her girdi için bir kez çağrılır). Starter'daki sınırlar
    yetmeyebilir; derleyici eksik olanı söyleyecek.
  - Fonksiyon, bütün sonuçlar gelene kadar beklemeli (havuzu drop etmeden!).
starter: |
  use std::sync::{Arc, Mutex, mpsc};
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  pub struct ThreadPool {
      workers: Vec<thread::JoinHandle<()>>,
      gonderici: Option<mpsc::Sender<Job>>,
  }

  impl ThreadPool {
      pub fn new(boyut: usize) -> ThreadPool {
          assert!(boyut > 0);
          let (gonderici, alici) = mpsc::channel::<Job>();
          let alici = Arc::new(Mutex::new(alici));
          let workers = (0..boyut)
              .map(|_| {
                  let alici = Arc::clone(&alici);
                  thread::spawn(move || {
                      loop {
                          let mesaj = alici.lock().unwrap().recv();
                          match mesaj {
                              Ok(is) => is(),
                              Err(_) => break,
                          }
                      }
                  })
              })
              .collect();
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
          for w in self.workers.drain(..) {
              w.join().unwrap();
          }
      }
  }

  fn paralel_map<T, U, F>(havuz: &ThreadPool, girdiler: Vec<T>, f: F) -> Vec<U>
  where
      T: Send + 'static,
      U: Send + 'static,
      F: Fn(T) -> U + Send + 'static,
  {
      todo!()
  }

  fn main() {
      let havuz = ThreadPool::new(3);
      let kelimeler = vec!["çay", "simit", "poğaça", "ayran"];
      let uzunluklar = paralel_map(&havuz, kelimeler, |k| k.chars().count());
      println!("{uzunluklar:?}");
  }
solution: |
  use std::sync::{Arc, Mutex, mpsc};
  use std::thread;

  type Job = Box<dyn FnOnce() + Send + 'static>;

  pub struct ThreadPool {
      workers: Vec<thread::JoinHandle<()>>,
      gonderici: Option<mpsc::Sender<Job>>,
  }

  impl ThreadPool {
      pub fn new(boyut: usize) -> ThreadPool {
          assert!(boyut > 0);
          let (gonderici, alici) = mpsc::channel::<Job>();
          let alici = Arc::new(Mutex::new(alici));
          let workers = (0..boyut)
              .map(|_| {
                  let alici = Arc::clone(&alici);
                  thread::spawn(move || {
                      loop {
                          let mesaj = alici.lock().unwrap().recv();
                          match mesaj {
                              Ok(is) => is(),
                              Err(_) => break,
                          }
                      }
                  })
              })
              .collect();
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
          for w in self.workers.drain(..) {
              w.join().unwrap();
          }
      }
  }

  fn paralel_map<T, U, F>(havuz: &ThreadPool, girdiler: Vec<T>, f: F) -> Vec<U>
  where
      T: Send + 'static,
      U: Send + 'static,
      F: Fn(T) -> U + Send + Sync + 'static,
  {
      let f = Arc::new(f);
      let (tx, rx) = mpsc::channel();
      for (i, girdi) in girdiler.into_iter().enumerate() {
          let tx = tx.clone();
          let f = Arc::clone(&f);
          havuz.execute(move || {
              let _ = tx.send((i, f(girdi)));
          });
      }
      drop(tx); // yoksa rx.iter() hiç bitmez
      let mut sonuclar: Vec<(usize, U)> = rx.iter().collect();
      sonuclar.sort_by_key(|(i, _)| *i);
      sonuclar.into_iter().map(|(_, u)| u).collect()
  }

  fn main() {
      let havuz = ThreadPool::new(3);
      let kelimeler = vec!["çay", "simit", "poğaça", "ayran"];
      let uzunluklar = paralel_map(&havuz, kelimeler, |k| k.chars().count());
      println!("{uzunluklar:?}");
  }
check: tests
tests: |
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::time::Duration;

  #[test]
  fn sira_korunur_yavas_isler_once_gelse_bile() {
      let havuz = ThreadPool::new(4);
      let sonuc = paralel_map(&havuz, vec![40u64, 30, 20, 10, 0], |ms| {
          thread::sleep(Duration::from_millis(ms));
          ms * 2
      });
      assert_eq!(sonuc, vec![80, 60, 40, 20, 0], "sonuçlar girdi sırasında dönmeli, bitiş sırasında değil");
  }

  #[test]
  fn worker_threadlerinde_calisir() {
      let havuz = ThreadPool::new(2);
      let ana = thread::current().id();
      let idler = paralel_map(&havuz, vec![1, 2, 3, 4], |_| thread::current().id());
      assert_eq!(idler.len(), 4);
      assert!(idler.iter().all(|id| *id != ana), "işler çağıranın thread'inde değil, havuzda çalışmalı");
  }

  #[test]
  fn bos_girdi_ve_tip_donusumu() {
      let havuz = ThreadPool::new(2);
      let bos: Vec<String> = paralel_map(&havuz, Vec::<u32>::new(), |x| x.to_string());
      assert!(bos.is_empty(), "boş girdi boş çıktı vermeli");
      let metin = paralel_map(&havuz, vec![1, 22, 333], |x: u32| format!("#{x}"));
      assert_eq!(metin, vec!["#1", "#22", "#333"]);
  }

  #[test]
  fn her_girdi_bir_kez_islenir() {
      let havuz = ThreadPool::new(3);
      let sayac = Arc::new(AtomicUsize::new(0));
      let s = Arc::clone(&sayac);
      let kareler = paralel_map(&havuz, (1..=50u64).collect(), move |x| {
          s.fetch_add(1, Ordering::SeqCst);
          x * x
      });
      assert_eq!(sayac.load(Ordering::SeqCst), 50, "f her girdi için tam bir kez çağrılmalı");
      assert_eq!(kareler.iter().sum::<u64>(), 42925, "1²+2²+...+50² = 42925");
  }
hints:
  - "`f`'i her işe ayrı ayrı veremezsin (taşınır). `let f = Arc::new(f);` yap ve her iş için `Arc::clone(&f)`. Derleyici bu durumda `F: Sync` sınırını isteyecek: `Arc<F>`'nin thread'ler arasında gezmesi için `F` paylaşılabilir olmalı."
  - "Sonuçları bir kanalla topla: Her iş `(sira, f(girdi))` göndersin. Her iş için `tx.clone()`, döngüden sonra orijinal `tx`'i `drop` et."
  - "`let mut sonuclar: Vec<(usize, U)> = rx.iter().collect();` sonra `sort_by_key(|(i, _)| *i)` ve `into_iter().map(|(_, u)| u).collect()`."
explanation: |
  Üç kritik fikir var:

  1. **`Arc<F>` ve `F: Sync`.** `f` birden çok işte kullanılacak; onu `Arc`'a koyup her işe bir kopya
     veriyoruz. `Arc<F>: Send` için `F: Send + Sync` gerekir (Modül 18). Alternatif: `F: Clone` isteyip her
     işe `f.clone()` vermek. Ama bu, closure'ın yakaladığı her şeyi kopyalar.
  2. **Sırayı veriyle taşı.** İşler hangi sırada biterse bitsin, her sonuç kendi `enumerate` indeksiyle
     geliyor. Sonra indekse göre sıralamak sırayı geri kuruyor. Daha verimli bir yol: `Vec<Option<U>>`
     ayırıp her sonucu `sonuclar[i] = Some(u)` ile yerine koymak (sıralama gerekmez).
  3. **`drop(tx)` şart.** `rx.iter()` ancak bütün göndericiler drop edilince biter. İşlerdeki kopyalar iş
     bitince drop ediliyor, ama orijinal `tx` `paralel_map`'te yaşıyorsa döngü sonsuza dek bekler.
     Havuzun `Drop`'undaki kalıbın aynısı!

  `rayon`'un `par_iter().map(f).collect()` çağrısı tam olarak bu sözleşmeyi (sıra korunur) çok daha verimli
  bir iş çalma (work stealing) havuzuyla sağlar (Modül 18). Artık arkasında ne olduğunu biliyorsun.
```
