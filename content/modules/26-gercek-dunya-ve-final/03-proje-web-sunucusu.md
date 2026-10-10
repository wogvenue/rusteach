---
id: m26-l03
title: "Final projesi 1: Web sunucusu temelleri"
minutes: 24
type: project
objectives:
  - Bir HTTP isteğinin ve yanıtının satır satır yapısını (başlangıç satırı, başlıklar, boş satır, gövde) açıklayabilmek
  - "`TcpListener::bind` ve `incoming()` ile bağlantı kabul eden, `BufReader` ile isteği okuyan bir sunucu kurabilmek"
  - İstek satırını ayrıştıran ve doğru `Content-Length` ile yanıt üreten saf fonksiyonları ağ olmadan test edebilmek
  - Tek thread'li bir sunucunun yavaş bir istekte neden tıkandığını zaman çizelgesiyle açıklayabilmek
keywords: [TcpListener, TcpStream, HTTP, BufReader, "Content-Length", "404", yönlendirme, routing, proje]
---

Tarayıcının adres çubuğuna bir adres yazıp Enter'a bastığında arka planda ne olur? Bu derste ve bir
sonrakinde bunu **kendi ellerinle** kuracaksın: Yalnızca standart kütüphaneyle, hiçbir framework
kullanmadan, tarayıcından bağlanabileceğin çok thread'li bir web sunucusu. Bu proje, The Rust
Programming Language kitabının son projesiyle aynı ruhu taşıyor ve yolculuğun boyunca öğrendiklerini
bir araya getiriyor: sahiplik, ödünç alma, `Result`, trait'ler, iterator'lar, testler ve thread'ler.

Gerçek projelerde `axum` ya da `actix-web` kullanırsın. Ama altta ne olduğunu bir kez görmüş olmak, o
framework'lerin hata mesajlarını, performans davranışlarını ve tasarım kararlarını anlamanı sağlar.

:::ferris
Bu bir proje dersi: Kodu kendi bilgisayarında `cargo new merhaba-sunucu` ile kurup tarayıcıdan denemeni
çok öneririm. Ağ kullanan parçalar uygulamada çalıştırılamıyor ama saf mantığı burada test edeceğiz. 🦀
:::

## TCP ve HTTP: iki katman

Web iki protokolün üst üste binmesiyle çalışır:

- **TCP (Transmission Control Protocol)** iki bilgisayar arasında **güvenilir bir bayt akışı** kurar:
  Baytlar kaybolmaz, sıraları karışmaz. TCP baytların ne anlama geldiğiyle ilgilenmez.
- **HTTP (Hypertext Transfer Protocol)** bu akışın içinde **ne konuşulacağını** tanımlar: istemci bir
  **istek (request)** gönderir, sunucu bir **yanıt (response)** döner. HTTP/1.1 düz metin bir protokoldür.

Tarayıcın `http://127.0.0.1:7878/merhaba` adresine gittiğinde TCP bağlantısının içinden şuna benzer bir
metin gönderir:

```text
GET /merhaba HTTP/1.1\r\n
Host: 127.0.0.1:7878\r\n
User-Agent: Mozilla/5.0 ...\r\n
Accept: text/html\r\n
\r\n
```

Sunucunun cevabı da aynı kalıptadır:

```text
HTTP/1.1 200 OK\r\n
Content-Type: text/html; charset=utf-8\r\n
Content-Length: 17\r\n
\r\n
<h1>Merhaba!</h1>
```

| Parça | İstekte | Yanıtta |
|---|---|---|
| **Başlangıç satırı** | İstek satırı: `YÖNTEM YOL SÜRÜM` (`GET /merhaba HTTP/1.1`) | Durum satırı: `SÜRÜM KOD AÇIKLAMA` (`HTTP/1.1 200 OK`) |
| **Başlıklar (headers)** | `Ad: değer` satırları | `Content-Type`, `Content-Length`... |
| **Boş satır** | Başlıkların bittiğini söyler | Aynı |
| **Gövde (body)** | `POST`'ta gönderilen veri (`GET`'te genelde yok) | HTML, JSON, resim... |

Her satır **CRLF** (`\r\n`, "satır başı + satır sonu") ile biter; bu, daktilo çağından kalma bir
alışkanlık. Sık göreceğin durum kodları: `200 OK`, `400 Bad Request` (istek bozuk), `404 Not Found`
(böyle bir sayfa yok), `405 Method Not Allowed` (bu adreste bu yöntem desteklenmiyor),
`500 Internal Server Error` (sunucuda hata).

:::analogy Telefon hattı ve resmî yazışma
TCP bir telefon hattıdır: Bağlantı kurulur, ses kesintisiz ve sırayla iletilir. Ama hat, konuşulanın
anlamını bilmez. HTTP ise o hatta uyulan **resmî yazışma kuralıdır**: Önce konu satırı ("GET /merhaba"),
sonra künye bilgileri (başlıklar), bir satır boşluk ve ardından asıl metin. Kurala uymayan bir mektubu
memur geri çevirir (`400 Bad Request`).
:::

```quiz
question: Bir HTTP isteğinde başlıkların bittiğini ve gövdenin başladığını sunucu nasıl anlar?
options:
  - "`Content-Type` başlığından sonra gövde başlar"
  - "Boş bir satır (art arda iki CRLF: `\\r\\n\\r\\n`) başlıkları gövdeden ayırır"
  - "Gövde her zaman ayrı bir TCP bağlantısıyla gönderilir"
  - İstemci bağlantıyı kapattığında başlıklar biter
answer: 1
explanation: |
  Başlıkların sayısı ve sırası serbesttir; bu yüzden sonlarını işaretleyen ayrı bir şeye ihtiyaç var: boş
  satır. Sunucu satırları okurken ilk boş satırda durur. Gövdenin **ne kadar** uzun olduğunu ise
  `Content-Length` başlığı söyler. Bu iki kural, birazdan yazacağımız okuma döngüsünün temeli.
feedback:
  - Başlıkların sırası serbesttir; `Content-Type` hiç olmayabilir de.
  - Doğru!
  - "HTTP/1.1'de istek tek bir bağlantıda, tek parça metin olarak gelir."
  - "HTTP/1.1 bağlantıyı açık tutar (keep-alive); kapanmayı beklersek sonsuza dek bekleyebiliriz."
```

## Bağlantıları dinlemek: `TcpListener`

Önce bağlantı kabul eden en küçük sunucuyu yazalım. `src/main.rs`:

```rust,norun
use std::net::TcpListener;

fn main() {
    let dinleyici = TcpListener::bind("127.0.0.1:7878").unwrap();
    println!("Dinleniyor: http://127.0.0.1:7878");

    for akis in dinleyici.incoming() {
        let akis = akis.unwrap();
        println!("Bağlantı kuruldu: {:?}", akis.peer_addr());
    } // akis burada drop edilir → bağlantı kapanır
}
```

- `TcpListener::bind(adres)` bir **portu** dinlemeye başlar ve `Result` döndürür: Port başka bir program
  tarafından kullanılıyorsa ya da (Linux/macOS'ta) 1024'ün altındaki bir port için yönetici izni yoksa
  `Err` gelir. `7878`, telefon tuş takımında "rust" yazar.
- `incoming()`, her yeni bağlantı **girişimi** için bir `Result<TcpStream>` üreten **sonsuz bir
  iterator**dır (Modül 14). Bağlantı gelene kadar bekler; bu yüzden program kendiliğinden bitmez.
- Her `TcpStream` açık bir bağlantıdır. Döngü turu bitince `akis` **drop edilir** ve `Drop` bağlantıyı
  kapatır: Modül 4 ve 17'deki RAII fikri, ağda.

`cargo run` ile başlatıp tarayıcıda adresi açarsan terminalde birkaç satır görürsün; tarayıcı ise "boş
yanıt" hatası verir, çünkü henüz hiçbir şey yazmadık. Birden çok "Bağlantı kuruldu" satırı görmen de
normaldir: Tarayıcılar yeniden deneyebilir ya da `/favicon.ico` için ayrı bir istek açabilir.

## İsteği okumak: `BufReader`

`TcpStream` `Read` trait'ini uygular, ama ham `read` çağrıları bize keyfi büyüklükte bayt parçaları verir.
Biz **satır satır** okumak istiyoruz. `BufReader` bir okuyucuyu sarar, içine bir tampon (buffer) koyar ve
`BufRead` trait'inin `lines()` metodunu kazandırır.

İşte önceki dersteki fikir: Okuma fonksiyonunu `TcpStream`'e değil, `impl BufRead`'e yazarsak, onu
**ağ olmadan**, bellekteki baytlarla çalıştırabiliriz. `&[u8]` de `Read` uygular:

```rust
use std::io::{BufRead, BufReader};

fn istek_oku(okuyucu: impl BufRead) -> Vec<String> {
    okuyucu
        .lines()
        .map(|satir| satir.unwrap())
        .take_while(|satir| !satir.is_empty())
        .collect()
}

fn main() {
    let ham = "GET /merhaba HTTP/1.1\r\nHost: 127.0.0.1:7878\r\nUser-Agent: curl/8.5.0\r\n\r\n";
    let satirlar = istek_oku(BufReader::new(ham.as_bytes()));
    println!("{satirlar:#?}");
}
```

Gerçek sunucuda aynı fonksiyonu `istek_oku(BufReader::new(&akis))` diye çağıracağız. Peki gövde içeren bir
istekte ne olur? Tahmin et:

```predict
code: |
  use std::io::{BufRead, BufReader};

  fn istek_oku(okuyucu: impl BufRead) -> Vec<String> {
      okuyucu
          .lines()
          .map(|satir| satir.unwrap())
          .take_while(|satir| !satir.is_empty())
          .collect()
  }

  fn main() {
      let ham = "POST /siparis HTTP/1.1\r\nContent-Length: 9\r\n\r\n2 simit\r\n";
      let satirlar = istek_oku(BufReader::new(ham.as_bytes()));
      println!("{}", satirlar.len());
      println!("{}", satirlar[1]);
  }
options:
  - |
    2
    Content-Length: 9
  - |
    3
    Content-Length: 9
  - |
    2
    Content-Length: 9\r
  - |
    4
    2 simit
answer: 0
explanation: |
  `lines()` her satırın sonundaki `\n`'i **ve** varsa ondan önceki `\r`'yi atar; bu yüzden üçüncü seçenekteki
  gibi bir `\r` kalmaz. `take_while` ilk boş satırda durur: Gövde (`2 simit`) hiç okunmaz. Bu bilinçli bir
  tasarım: Gövdeyi okumak için `Content-Length` kadar bayt okumak gerekir, satır satır değil.

  `take_while` olmasaydı ne olurdu? Gerçek bir TCP bağlantısında tarayıcı bağlantıyı açık tutar ve
  yanıtımızı bekler. `lines()` bir sonraki satırı beklerken **sonsuza kadar** bloklanır; ikimiz de
  birbirimizi bekleriz.
```

`BufReader`'ın içinde ne var? Neden doğrudan `TcpStream`'den okumuyoruz?

```memory
title: "BufReader<&TcpStream> bellekte"
steps:
  - caption: "`akis` bir işletim sistemi soketini temsil ediyor. Her `read` çağrısı bir sistem çağrısıdır (pahalı)."
    stack:
      - frame: baglanti_isle
        vars:
          - { name: akis, type: TcpStream, value: "soket #5", to: s }
    heap:
      - { id: s, label: işletim sistemi, value: "soket tamponu: GET /merhaba HTTP/1.1\\r\\nHost: ..." }
  - caption: "`BufReader::new(&akis)` akışı **ödünç alır** ve heap'te 8 KiB'lık bir tampon ayırır."
    stack:
      - frame: baglanti_isle
        vars:
          - { name: akis, type: TcpStream, value: "soket #5", to: s }
          - { name: okuyucu, type: "BufReader<&TcpStream>", value: "inner=&akis · buf · pos=0 · filled=0", to: b }
    heap:
      - { id: s, label: işletim sistemi, value: "soket tamponu: GET /merhaba HTTP/1.1\\r\\nHost: ..." }
      - { id: b, label: "tampon (8192 bayt)", value: "[ boş ]" }
  - caption: "İlk `lines()` çağrısı tek bir sistem çağrısıyla mümkün olduğunca çok baytı tampona çeker. Sonraki satırlar bellekten, sistem çağrısı olmadan gelir."
    stack:
      - frame: baglanti_isle
        vars:
          - { name: akis, type: TcpStream, value: "soket #5", to: s }
          - { name: okuyucu, type: "BufReader<&TcpStream>", value: "inner=&akis · buf · pos=23 · filled=78", to: b }
    heap:
      - { id: s, label: işletim sistemi, value: "[ boşaldı ]" }
      - { id: b, label: "tampon (8192 bayt)", value: "GET /merhaba HTTP/1.1\\r\\n|Host: ... \\r\\n\\r\\n" }
```

Okuyucu akışı **paylaşılan referansla** ödünç alıyor. Yanıtı yazmak için ise `write_all` `&mut` ister.
İkisi aynı anda yaşarsa ne olur?

```compiles
question: "(Modül 5 tekrarı) Derlenir mi?"
code: |
  use std::io::{BufRead, BufReader, Write};
  use std::net::TcpStream;

  fn baglanti_isle(mut akis: TcpStream) {
      let okuyucu = BufReader::new(&akis);
      akis.write_all(b"HTTP/1.1 200 OK\r\n\r\n").unwrap();
      let ilk_satir = okuyucu.lines().next();
      println!("{ilk_satir:?}");
  }

  fn main() {}
answer: false
error: E0502
explanation: |
  `okuyucu`, `&akis` ödünç almasını taşıyor ve son kullanımı `write_all`'dan **sonra**. Bu sırada
  `write_all` için `&mut akis` alınamaz: "aliasing XOR mutation" kuralı (Modül 5). Çözüm doğal olanı:
  Önce isteği oku, okuyucuyu kullanmayı bitir, sonra yaz. NLL sayesinde okuyucunun ödünç alması son
  kullanımında biter; ayrıca bir blok açmana gerek kalmaz.
```

## İstek satırını ayrıştırmak

Okuduğumuz ilk satır, sunucunun ne yapacağına karar vermek için ihtiyacı olan her şeyi içeriyor. Onu bir
tipe dönüştürelim; işte burada "geçersiz durumları temsil edilemez kıl" (Modül 7 ve 10) fikri devreye
giriyor. Bir `&str` ile her şey mümkündür; bir `IstekSatiri` ise yalnızca geçerli istekleri temsil eder.

```exercise
title: İstek satırı ayrıştırıcı
difficulty: 3
prompt: |
  `istek_satiri_ayristir` fonksiyonunu yaz. Bir HTTP istek satırını (ör. `"GET /menu HTTP/1.1"`) alıp
  `IstekSatiri` döndürsün. Kontroller **bu sırayla** yapılmalı:

  1. Satır **tek boşluklarla** ayrılmış tam olarak 3 parça değilse → `IstekHatasi::BicimHatasi`.
     (`"GET  / HTTP/1.1"` gibi çift boşluklu bir satır da bozuktur; `split(' ')` kullan.)
  2. Yöntem `GET`, `POST`, `PUT` veya `DELETE` değilse → `BilinmeyenYontem(yontem)`. HTTP yöntemleri büyük/küçük
     harfe duyarlıdır: `"get"` geçersizdir.
  3. Yol `/` ile başlamıyorsa → `GecersizYol`.
  4. Sürüm `HTTP/1.1` veya `HTTP/1.0` değilse → `DesteklenmeyenSurum(surum)`.

  `yol` ve `surum` alanları girdinin içinden ödünç alınan `&str`'lerdir (Modül 12).
starter: |
  #[derive(Debug, PartialEq)]
  enum Yontem {
      Get,
      Post,
      Put,
      Delete,
  }

  #[derive(Debug, PartialEq)]
  struct IstekSatiri<'a> {
      yontem: Yontem,
      yol: &'a str,
      surum: &'a str,
  }

  #[derive(Debug, PartialEq)]
  enum IstekHatasi {
      BicimHatasi,
      BilinmeyenYontem(String),
      GecersizYol,
      DesteklenmeyenSurum(String),
  }

  fn istek_satiri_ayristir(satir: &str) -> Result<IstekSatiri<'_>, IstekHatasi> {
      todo!()
  }

  fn main() {
      println!("{:?}", istek_satiri_ayristir("GET /menu HTTP/1.1"));
      println!("{:?}", istek_satiri_ayristir("BREW /cay HTTP/1.1"));
  }
solution: |
  #[derive(Debug, PartialEq)]
  enum Yontem {
      Get,
      Post,
      Put,
      Delete,
  }

  #[derive(Debug, PartialEq)]
  struct IstekSatiri<'a> {
      yontem: Yontem,
      yol: &'a str,
      surum: &'a str,
  }

  #[derive(Debug, PartialEq)]
  enum IstekHatasi {
      BicimHatasi,
      BilinmeyenYontem(String),
      GecersizYol,
      DesteklenmeyenSurum(String),
  }

  fn istek_satiri_ayristir(satir: &str) -> Result<IstekSatiri<'_>, IstekHatasi> {
      let parcalar: Vec<&str> = satir.split(' ').collect();
      let [yontem, yol, surum] = parcalar[..] else {
          return Err(IstekHatasi::BicimHatasi);
      };

      let yontem = match yontem {
          "GET" => Yontem::Get,
          "POST" => Yontem::Post,
          "PUT" => Yontem::Put,
          "DELETE" => Yontem::Delete,
          diger => return Err(IstekHatasi::BilinmeyenYontem(diger.to_string())),
      };
      if !yol.starts_with('/') {
          return Err(IstekHatasi::GecersizYol);
      }
      if surum != "HTTP/1.1" && surum != "HTTP/1.0" {
          return Err(IstekHatasi::DesteklenmeyenSurum(surum.to_string()));
      }
      Ok(IstekSatiri { yontem, yol, surum })
  }

  fn main() {
      println!("{:?}", istek_satiri_ayristir("GET /menu HTTP/1.1"));
      println!("{:?}", istek_satiri_ayristir("BREW /cay HTTP/1.1"));
  }
check: tests
tests: |
  #[test]
  fn gecerli_istekler() {
      assert_eq!(
          istek_satiri_ayristir("GET / HTTP/1.1"),
          Ok(IstekSatiri { yontem: Yontem::Get, yol: "/", surum: "HTTP/1.1" })
      );
      assert_eq!(
          istek_satiri_ayristir("POST /api/siparis HTTP/1.0"),
          Ok(IstekSatiri { yontem: Yontem::Post, yol: "/api/siparis", surum: "HTTP/1.0" })
      );
      let sil = istek_satiri_ayristir("DELETE /sepet/3 HTTP/1.1").unwrap();
      assert_eq!((sil.yontem, sil.yol), (Yontem::Delete, "/sepet/3"));
  }

  #[test]
  fn bilinmeyen_ve_kucuk_harf_yontem() {
      assert_eq!(istek_satiri_ayristir("PATCH /x HTTP/1.1"), Err(IstekHatasi::BilinmeyenYontem(String::from("PATCH"))));
      assert_eq!(
          istek_satiri_ayristir("get / HTTP/1.1"),
          Err(IstekHatasi::BilinmeyenYontem(String::from("get"))),
          "HTTP yöntemleri büyük/küçük harfe duyarlıdır"
      );
  }

  #[test]
  fn gecersiz_yol_ve_surum() {
      assert_eq!(istek_satiri_ayristir("GET menu HTTP/1.1"), Err(IstekHatasi::GecersizYol), "yol / ile başlamalı");
      assert_eq!(istek_satiri_ayristir("GET / HTTP/2"), Err(IstekHatasi::DesteklenmeyenSurum(String::from("HTTP/2"))));
  }

  #[test]
  fn bicim_hatalari() {
      assert_eq!(istek_satiri_ayristir(""), Err(IstekHatasi::BicimHatasi), "boş satır bozuktur");
      assert_eq!(istek_satiri_ayristir("GET /"), Err(IstekHatasi::BicimHatasi), "sürüm eksik");
      assert_eq!(istek_satiri_ayristir("GET / HTTP/1.1 fazla"), Err(IstekHatasi::BicimHatasi), "4 parça bozuktur");
      assert_eq!(
          istek_satiri_ayristir("GET  / HTTP/1.1"),
          Err(IstekHatasi::BicimHatasi),
          "çift boşluk split(' ') ile boş bir parça üretir; bu satır bozuktur"
      );
  }

  #[test]
  fn kontrol_sirasi() {
      assert_eq!(
          istek_satiri_ayristir("FOO bar HTTP/9"),
          Err(IstekHatasi::BilinmeyenYontem(String::from("FOO"))),
          "önce yöntem kontrol edilmeli"
      );
      assert_eq!(istek_satiri_ayristir("GET bar HTTP/9"), Err(IstekHatasi::GecersizYol), "yol, sürümden önce kontrol edilmeli");
  }
hints:
  - "`let parcalar: Vec<&str> = satir.split(' ').collect();` ile başla. Parça sayısı 3 değilse `BicimHatasi`. Boş string bile `split` ile tek bir boş parça üretir."
  - "Dilim deseni (Modül 21) ve let-else (Modül 7) burada çok işe yarar: `let [yontem, yol, surum] = parcalar[..] else { return Err(...) };`"
  - "Yöntemi `match yontem { \"GET\" => Yontem::Get, ..., diger => return Err(IstekHatasi::BilinmeyenYontem(diger.to_string())) }` ile çevir. Sonra `yol.starts_with('/')` ve sürümü kontrol et."
explanation: |
  `let [yontem, yol, surum] = parcalar[..] else { ... };` satırı üç şeyi birden yapıyor: Parça sayısını
  denetliyor, üç parçayı isimlendiriyor ve uyuşmazlıkta erken dönüyor. Dilim deseni tam olarak 3 eleman
  ister; 2 ya da 4 elemanlı dilim `else` dalına düşer.

  Dönüş tipindeki `IstekSatiri<'_>`, elision kuralıyla (Modül 12) "girdiyle aynı yaşam süresi" demektir:
  `yol` ve `surum` yeni `String`'ler değil, `satir`'ın içine işaret eden dilimlerdir. Hata
  varyantlarında ise `String` kullandık; hata değeri girdiden daha uzun yaşayabilsin (örneğin loglara
  yazılırken) diye.

  `split(' ')` yerine `split_whitespace()` kullansaydın çift boşluklu satır "düzeltilmiş" olurdu. Bir
  ayrıştırıcıda bu hoşgörü tehlikelidir: Farklı sunucuların aynı bozuk isteği farklı yorumlaması,
  "request smuggling" gibi gerçek güvenlik açıklarının kaynağıdır. Katı ol, belirsizliği reddet.
```

## Yanıt yazmak ve yönlendirme

Yanıt da sadece bir metin. Tek dikkat edilecek nokta `Content-Length`: Tarayıcı gövdeden **tam bu kadar
bayt** okur.

```quiz
question: |
  Bir geliştirici `Content-Length` başlığını `govde.chars().count()` ile hesaplıyor. Gövde
  `"<p>Güle güle, çiçeğim</p>"` olduğunda ne olur?
options:
  - Hiçbir sorun olmaz; HTTP karakter sayar
  - "Bildirilen uzunluk gerçek bayt sayısından **küçük** olur; tarayıcı gövdenin sonunu keser (`</p>` eksik kalabilir)"
  - Bildirilen uzunluk gerçek bayt sayısından büyük olur; tarayıcı fazladan boşluk ekler
answer: 1
explanation: |
  `Content-Length` **bayt (octet)** sayısıdır. `ü`, `ç`, `ğ`... gibi harfler UTF-8'de 2 bayttır (Modül 9);
  `chars().count()` onları 1 sayar. Bu gövdede 5 tane 2 baytlık harf var (`ü`, `ü`, `ç`, `ç`, `ğ`), yani
  başlık 5 bayt eksik söyler; tarayıcı son 5 baytı (`m</p>`) okumaz. Doğrusu `govde.len()`'dir: `String::len` zaten bayt sayısını
  verir. İngilizce metinlerle test edilen kodda bu hata yıllarca fark edilmeyebilir!
feedback:
  - "HTTP baytlarla çalışır; karakter kavramı başlıktaki `charset`'e bağlıdır."
  - Doğru!
  - "`chars().count()` hiçbir zaman `len()`'den büyük olamaz: Her karakter en az 1 bayttır."
```

Farkı kendi gözünle gör; `as_bytes()` ile gövdenin içindeki baytlara da bakabilirsin:

```rust
fn main() {
    for govde in ["<p>Merhaba</p>", "<p>Güle güle, çiçeğim</p>"] {
        let bayt = govde.len();
        let karakter = govde.chars().count();
        println!("{govde:<28} bayt={bayt:>2} karakter={karakter:>2} fark={}", bayt - karakter);
    }
    let cay = "çay";
    println!("{cay} baytları: {:?}", cay.as_bytes());
}
```

`ç` harfi `[195, 167]` olmak üzere iki bayt tutuyor. ASCII'den oluşan ilk gövdede fark 0; bu yüzden hatalı
`chars().count()` kodu İngilizce testlerden sorunsuz geçer.

Şimdi yanıt üretmeyi saf bir fonksiyon olarak kur. Satırları doğru sıraya koy:

```parsons
prompt: Bir durum satırı, iki başlık, boş satır ve gövdeden oluşan yanıtı üreten fonksiyonu kur.
lines: |
  fn yanit(durum: &str, govde: &str) -> String {
      let uzunluk = govde.len();
      format!(
          "HTTP/1.1 {durum}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {uzunluk}\r\n\r\n{govde}"
      )
  }
  fn main() {
      let y = yanit("200 OK", "<h1>Merhaba!</h1>");
      println!("{}", y.len());
  }
distractors: |
  fn yanit(durum: &str, govde: &str) {
      let uzunluk = govde.chars().count();
explanation: |
  Başlıklar `\r\n` ile ayrılır, başlıkların sonu `\r\n\r\n` ile işaretlenir ve ardından gövde gelir.
  Uzunluk `govde.len()` (bayt) ile hesaplanmalı. Fonksiyon bir `String` döndürmeli; dönüş tipsiz sürüm
  `()` döndürür ve `format!`'ın sonucu kaybolur.
```

Artık bir **yönlendirici (router)** yazabiliriz: İstek satırına bakıp hangi yanıtın döneceğine karar veren
fonksiyon. Önce tam ve çalışan küçük bir örnek:

```rust
fn yanit(durum: &str, govde: &str) -> String {
    let uzunluk = govde.len();
    format!("HTTP/1.1 {durum}\r\nContent-Length: {uzunluk}\r\n\r\n{govde}")
}

fn yonlendir(istek_satiri: &str) -> String {
    match istek_satiri {
        "GET / HTTP/1.1" => yanit("200 OK", "<h1>Ana sayfa</h1>"),
        "GET /menu HTTP/1.1" => yanit("200 OK", "<ul><li>Çay</li><li>Simit</li></ul>"),
        _ => yanit("404 Not Found", "<h1>Sayfa bulunamadı</h1>"),
    }
}

fn main() {
    for istek in ["GET / HTTP/1.1", "GET /menu HTTP/1.1", "GET /favicon.ico HTTP/1.1"] {
        let cevap = yonlendir(istek);
        let durum_satiri = cevap.lines().next().unwrap();
        println!("{istek:<28} → {durum_satiri}");
    }
}
```

Bu sürüm string'leri doğrudan eşleştiriyor; hızlı bir başlangıç ama `GET /menu HTTP/1.0` gibi bir isteği
404'e düşürür. Alıştırmada bunu ayrıştırılmış istek üzerinden, düzgün yapacaksın.

```fill
prompt: |
  Yönlendiricide `(yöntem, yol)` çiftine göre eşleştirme yapalım. Tanınan bir yol yanlış bir yöntemle
  istenirse `405` dönsün. Boşlukları doldur.
code: |
  fn durum(yontem: &str, yol: &str) -> u16 {
      match (yontem, yol) {
          ("GET", "/") | ("GET", "/menu") => 200,
          (_, "/") | (_, "/menu") => ___0,
          ___1 => 404,
      }
  }

  fn main() {
      println!("{} {} {}", durum("GET", "/menu"), durum("POST", "/"), durum("GET", "/yok"));
  }
blanks:
  - ["405"]
  - ["_", "(_, _)"]
output: "200 405 404"
explanation: |
  Tuple üzerinde `match` (Modül 21) yönlendirme için doğal bir araç: Kollar yukarıdan aşağı denenir. İkinci
  kol, ilk kola uymamış (yani `GET` olmayan) her yöntemi yakalar. Son kol her şeyi yakalayan `_` (ya da
  `(_, _)`) desenidir; `match`'in kapsayıcılık (exhaustiveness) kuralı onsuz derlemeye izin vermez.
```

````exercise
title: Yanıt üretici ve yönlendirici
difficulty: 4
prompt: |
  Sunucunun saf çekirdeğini yaz. Basit bir ayrıştırıcı (`ayristir`) hazır veriliyor.

  **1. `yanit_olustur(durum: u16, govde: &str) -> String`** şu biçimde bir yanıt üretsin:

  ```text
  HTTP/1.1 {durum} {aciklama}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {bayt}\r\n\r\n{govde}
  ```

  Açıklamalar: `200 OK`, `400 Bad Request`, `404 Not Found`, `405 Method Not Allowed`; diğer her kod için
  `Unknown`. `{bayt}` gövdenin **bayt** uzunluğu.

  **2. `yonlendir(istek_satiri: &str) -> String`**:
  - `ayristir` `None` dönerse → `400`, gövde `<h1>Hatalı istek</h1>`
  - `GET /` → `200`, gövde `<h1>Hoş geldin!</h1>`
  - `GET /menu` → `200`, gövde `<p>Çay 15 TL, simit 20 TL</p>`
  - `/` veya `/menu` başka bir yöntemle → `405`, gövde `<h1>Yönteme izin verilmiyor</h1>`
  - diğer her yol → `404`, gövde `<h1>Sayfa bulunamadı</h1>`
starter: |
  /// "YÖNTEM YOL SÜRÜM" biçimini kabaca ayırır (hazır).
  fn ayristir(satir: &str) -> Option<(&str, &str)> {
      let mut parcalar = satir.split(' ');
      let yontem = parcalar.next()?;
      let yol = parcalar.next()?;
      let surum = parcalar.next()?;
      if parcalar.next().is_some() || !surum.starts_with("HTTP/") {
          return None;
      }
      Some((yontem, yol))
  }

  fn yanit_olustur(durum: u16, govde: &str) -> String {
      todo!()
  }

  fn yonlendir(istek_satiri: &str) -> String {
      todo!()
  }

  fn main() {
      print!("{}", yonlendir("GET /menu HTTP/1.1"));
  }
solution: |
  /// "YÖNTEM YOL SÜRÜM" biçimini kabaca ayırır (hazır).
  fn ayristir(satir: &str) -> Option<(&str, &str)> {
      let mut parcalar = satir.split(' ');
      let yontem = parcalar.next()?;
      let yol = parcalar.next()?;
      let surum = parcalar.next()?;
      if parcalar.next().is_some() || !surum.starts_with("HTTP/") {
          return None;
      }
      Some((yontem, yol))
  }

  fn yanit_olustur(durum: u16, govde: &str) -> String {
      let aciklama = match durum {
          200 => "OK",
          400 => "Bad Request",
          404 => "Not Found",
          405 => "Method Not Allowed",
          _ => "Unknown",
      };
      let bayt = govde.len();
      format!(
          "HTTP/1.1 {durum} {aciklama}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {bayt}\r\n\r\n{govde}"
      )
  }

  fn yonlendir(istek_satiri: &str) -> String {
      let Some(istek) = ayristir(istek_satiri) else {
          return yanit_olustur(400, "<h1>Hatalı istek</h1>");
      };
      let (durum, govde) = match istek {
          ("GET", "/") => (200, "<h1>Hoş geldin!</h1>"),
          ("GET", "/menu") => (200, "<p>Çay 15 TL, simit 20 TL</p>"),
          (_, "/") | (_, "/menu") => (405, "<h1>Yönteme izin verilmiyor</h1>"),
          _ => (404, "<h1>Sayfa bulunamadı</h1>"),
      };
      yanit_olustur(durum, govde)
  }

  fn main() {
      print!("{}", yonlendir("GET /menu HTTP/1.1"));
  }
check: tests
tests: |
  fn durum_satiri(y: &str) -> &str {
      y.split("\r\n").next().unwrap()
  }

  fn govde(y: &str) -> &str {
      y.split_once("\r\n\r\n").map(|(_, g)| g).unwrap_or("")
  }

  #[test]
  fn yanit_bicimi_tam_olarak_dogru() {
      assert_eq!(
          yanit_olustur(200, "<b>ok</b>"),
          "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 9\r\n\r\n<b>ok</b>"
      );
      assert_eq!(durum_satiri(&yanit_olustur(418, "")), "HTTP/1.1 418 Unknown", "bilinmeyen kodlar için Unknown");
  }

  #[test]
  fn content_length_bayt_sayar() {
      let y = yanit_olustur(200, "çiğ köfte");
      assert!(
          y.contains("Content-Length: 12\r\n"),
          "\"çiğ köfte\" 9 karakter ama 12 bayttır (ç, ğ ve ö ikişer bayt)"
      );
  }

  #[test]
  fn yonlendirme_200_ve_404() {
      let ana = yonlendir("GET / HTTP/1.1");
      assert_eq!(durum_satiri(&ana), "HTTP/1.1 200 OK");
      assert_eq!(govde(&ana), "<h1>Hoş geldin!</h1>");
      let menu = yonlendir("GET /menu HTTP/1.0");
      assert_eq!(govde(&menu), "<p>Çay 15 TL, simit 20 TL</p>", "HTTP/1.0 istekleri de yönlendirilmeli");
      assert_eq!(durum_satiri(&yonlendir("GET /favicon.ico HTTP/1.1")), "HTTP/1.1 404 Not Found");
  }

  #[test]
  fn yanlis_yontem_405_bozuk_istek_400() {
      assert_eq!(durum_satiri(&yonlendir("POST /menu HTTP/1.1")), "HTTP/1.1 405 Method Not Allowed");
      assert_eq!(durum_satiri(&yonlendir("DELETE / HTTP/1.1")), "HTTP/1.1 405 Method Not Allowed");
      assert_eq!(durum_satiri(&yonlendir("POST /yok HTTP/1.1")), "HTTP/1.1 404 Not Found", "bilinmeyen yol 404");
      let bozuk = yonlendir("merhaba");
      assert_eq!(durum_satiri(&bozuk), "HTTP/1.1 400 Bad Request");
      assert_eq!(govde(&bozuk), "<h1>Hatalı istek</h1>");
  }
hints:
  - "`yanit_olustur`'da önce `match durum { 200 => \"OK\", ... _ => \"Unknown\" }` ile açıklamayı bul, sonra tek bir `format!` ile yanıtı kur. Uzunluk için `govde.len()`."
  - "`yonlendir`'de `let Some(istek) = ayristir(istek_satiri) else { return yanit_olustur(400, ...); };` ile başla."
  - "Sonra `match istek { (\"GET\", \"/\") => ..., (\"GET\", \"/menu\") => ..., (_, \"/\") | (_, \"/menu\") => ..., _ => ... }` ile `(durum, govde)` çiftini seç ve `yanit_olustur`'a ver."
explanation: |
  Bu iki fonksiyon sunucunun **saf çekirdeği**: Girdi bir string, çıktı bir string; ağ, thread, dosya
  yok. Bu yüzden onları milisaniyeler içinde, yüzlerce durumla test edebiliyoruz. Ağla konuşan kısım
  ("kabuk") ise birkaç satırdan ibaret kalacak. Bu desene **"saf çekirdek, ince kabuk" (functional core,
  imperative shell)** denir; Modül 15'te `main.rs`'i ince tutup mantığı `lib.rs`'e taşırken yaptığın da
  buydu.

  `match`'in kolları `(durum, govde)` tuple'ı döndürüyor ve `yanit_olustur` tek bir yerde çağrılıyor;
  her kolda ayrı ayrı `yanit_olustur(...)` yazmaktan daha az tekrar içerir. `405` kolunun `404` kolundan
  **önce** gelmesi şart: `match` kolları sırayla dener.

  Gerçek framework'ler (`axum`) bu fikri genelleştirir: `Router::new().route("/menu", get(menu))` yazarsın,
  yöntem uyuşmazlığında 405'i ve bilinmeyen yolda 404'ü kendisi döndürür.
````

## Hepsini birleştirmek ve tek thread'in sınırı

Artık bütün parçalar hazır. Gerçek sunucu, saf çekirdeğin etrafındaki ince bir kabuk:

```rust,norun,title=src/main.rs
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::Duration;

fn yanit(durum: &str, govde: &str) -> String {
    let uzunluk = govde.len();
    format!("HTTP/1.1 {durum}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {uzunluk}\r\n\r\n{govde}")
}

fn yonlendir(istek_satiri: &str) -> String {
    match istek_satiri {
        "GET / HTTP/1.1" => yanit("200 OK", "<h1>Merhaba!</h1>"),
        "GET /uyu HTTP/1.1" => {
            thread::sleep(Duration::from_secs(5)); // yavaş bir işi taklit et
            yanit("200 OK", "<h1>Günaydın! 5 saniye uyudum.</h1>")
        }
        _ => yanit("404 Not Found", "<h1>Sayfa bulunamadı</h1>"),
    }
}

fn baglanti_isle(mut akis: TcpStream) {
    let okuyucu = BufReader::new(&akis);
    let Some(Ok(istek_satiri)) = okuyucu.lines().next() else {
        return; // boş ya da bozuk bağlantı: sessizce kapat
    };
    println!("{istek_satiri}");
    let cevap = yonlendir(&istek_satiri);
    if let Err(e) = akis.write_all(cevap.as_bytes()) {
        eprintln!("yazılamadı: {e}");
    }
}

fn main() {
    let dinleyici = TcpListener::bind("127.0.0.1:7878").expect("7878 portu kullanımda olabilir");
    println!("Dinleniyor: http://127.0.0.1:7878");
    for akis in dinleyici.incoming() {
        match akis {
            Ok(akis) => baglanti_isle(akis),
            Err(e) => eprintln!("bağlantı hatası: {e}"),
        }
    }
}
```

Birkaç ayrıntı: `baglanti_isle` artık hiçbir yerde `unwrap` ile çökmüyor. Tek bir kötü bağlantının bütün
sunucuyu düşürmesi kabul edilemez (Modül 10'daki "beklenen hatalar için `Result`" kuralı). Yalnızca istek
satırını okuyoruz; kalan başlıklar tamponda kalıyor ve bağlantıyla birlikte atılıyor. Bu küçük sunucu için
yeterli.

Şimdi deney: İki tarayıcı sekmesi aç. Birinde `/uyu`'ya, hemen ardından diğerinde `/`'a git. Ne görürsün?
`/` sayfası da yaklaşık 5 saniye bekler. Çünkü `for akis in dinleyici.incoming()` döngüsü bağlantıları
**sırayla** işliyor; `baglanti_isle` bitmeden bir sonraki bağlantıya geçilmiyor:

```text
zaman (sn) →  0         1         2         3         4         5
/uyu          [=============== uyuyor ==================]
/             ......................bekliyor..............[✓]
```

:::analogy Tek kasalı market
Tek kasası olan bir markette, sepeti tepeleme dolu bir müşteri kasaya geçtiğinde arkasındaki sadece
ekmek alacak müşteri de beklemek zorundadır. Kasiyer hızlı olsa bile **sıra** sorundur. Çözüm, daha
fazla kasa açmaktır; ama her müşteriye ayrı bir kasa açmaya kalkarsan market kasayla dolar, kasiyerlerin
maaşını ödeyemezsin. Sabit sayıda kasa, uzun bir kuyruk: Bir sonraki derste kuracağımız **thread havuzu** tam olarak bu.
:::

```quiz
question: |
  Tek thread'li sunucuya **aynı anda** önce 3 tane `/uyu` (her biri 5 sn), hemen ardından 1 tane `/`
  isteği geliyor. `/` isteği yaklaşık ne kadar bekler? Peki **her bağlantı için yeni bir thread**
  (`thread::spawn`) açılsaydı?
options:
  - Tek thread'de ~5 sn; thread başına bağlantıda ~0 sn
  - Tek thread'de ~15 sn; thread başına bağlantıda ~0 sn
  - Tek thread'de ~15 sn; thread başına bağlantıda yine ~15 sn
  - Tek thread'de ~0 sn; işletim sistemi istekleri zaten paralel yürütür
answer: 1
explanation: |
  Bağlantılar sırayla işlendiği için `/` üç `/uyu`'nun **toplamı** kadar bekler: 15 sn. Her bağlantıya bir
  thread açılsaydı (Modül 18) `/` beklemeden yanıtlanırdı. Ama bu sefer başka bir sorun doğar: Saniyede 10.000
  istek gönderen biri 10.000 thread açtırır; bellek ve zamanlayıcı çöker. Bu bir **hizmet engelleme
  (denial of service)** saldırısı yoludur. Çözüm: Sabit boyutlu bir thread havuzu (sonraki ders) ya da
  async (Modül 19; `tokio` ve `axum` bunu yapar).
feedback:
  - Bekleme süreleri birikir; `/` üç uyku isteğinin de bitmesini bekler.
  - Doğru!
  - Her bağlantı ayrı thread'deyse `/` uyuyan thread'leri beklemez.
  - "İşletim sistemi bağlantıları kuyruklar, ama `accept` edilen bağlantıyı işleyen tek thread biziz."
```

## Özet

:::remember
- **TCP** güvenilir bir bayt akışıdır; **HTTP/1.1** onun üzerinde düz metin bir protokoldür.
- İstek: `YÖNTEM YOL SÜRÜM\r\n` + başlıklar + **boş satır** + (gövde). Yanıt: `HTTP/1.1 200 OK\r\n` + başlıklar + boş satır + gövde.
- `Content-Length` **bayt** sayısıdır → `govde.len()`, `chars().count()` değil.
- `TcpListener::bind(adres)?` + `for akis in dinleyici.incoming()`; `TcpStream` drop edilince bağlantı kapanır.
- `BufReader::new(&akis).lines()` satırları `\r\n`'siz verir; başlıkları ilk boş satırda bırak (`take_while`).
- Mantığı `impl BufRead` / `&str` alan **saf fonksiyonlara** koy; ağ olmadan test et.
- Tek thread'li sunucu yavaş bir istekte bütün kuyruğu bekletir; her bağlantıya bir thread ise sınırsızdır → thread havuzu.
:::

```reflect
prompt: |
  Bu derste sunucunun mantığını ağdan ayırıp `&str` alan saf fonksiyonlara koyduk. Bunun test
  edilebilirlik dışında hangi faydaları var? Sunucuyu ileride `axum`'a taşımak isteseydin ne kadarını
  yeniden yazman gerekirdi?
answer: |
  Saf fonksiyonlar her ortamda aynı davranır: hızlı, deterministik test edilir, hata ayıklaması kolaydır,
  yeniden kullanılabilir. Ağ, thread ve hata yönetimi gibi "kirli" işler ince kabukta toplanır, bu yüzden
  kabukta hata yapma yüzeyi de küçüktür. `axum`'a geçerken yalnızca kabuğu (`TcpListener`, `BufReader`,
  `write_all`) değiştirirsin; yönlendirme kuralları, istek ayrıştırma ve yanıt üretme mantığı büyük ölçüde
  aynen taşınabilir. Saf çekirdek bir framework'e değil, senin alanına aittir.
```

```flashcards
- front: Bir HTTP isteğinin dört parçası nedir?
  back: "İstek satırı (`GET /yol HTTP/1.1`), başlıklar (`Ad: değer`), boş satır, (isteğe bağlı) gövde."
- front: HTTP'de satırlar hangi karakterlerle biter?
  back: "CRLF: `\\r\\n`. Başlıkların sonu `\\r\\n\\r\\n` ile işaretlenir."
- front: "`Content-Length` neyi sayar ve Rust'ta nasıl hesaplanır?"
  back: "Gövdenin **bayt** sayısını; `govde.len()` (`chars().count()` Türkçe harflerde yanlış olur)."
- front: "`TcpListener::incoming()` ne döndürür ve döngü ne zaman biter?"
  back: "Her bağlantı girişimi için `Result<TcpStream>` üreten sonsuz bir iterator; kendiliğinden bitmez."
- front: "`TcpStream` kapsam dışına çıkınca ne olur?"
  back: "`Drop` edilir ve TCP bağlantısı kapanır (RAII)."
- front: "İstek okurken neden `lines()`'ı `take_while(|s| !s.is_empty())` ile sınırlarız?"
  back: "Tarayıcı bağlantıyı açık tutar; boş satırda durmazsak `lines()` yeni satır beklerken sonsuza dek bloklanır."
- front: "Sık kullanılan HTTP durum kodları: 200, 400, 404, 405 ne anlama gelir?"
  back: "OK; Bad Request (bozuk istek); Not Found (yol yok); Method Not Allowed (yol var ama bu yöntem desteklenmiyor)."
- front: Tek thread'li sunucunun temel sorunu nedir? Her bağlantıya bir thread açmak neden de kötü?
  back: Yavaş bir istek arkasındaki herkesi bekletir. Sınırsız thread ise çok sayıda istekle belleği ve zamanlayıcıyı tüketir (DoS).
```
