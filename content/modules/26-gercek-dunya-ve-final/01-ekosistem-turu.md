---
id: m26-l01
title: Ekosistem turu
minutes: 16
type: lesson
objectives:
  - Standart kütüphanenin neden bilerek küçük tutulduğunu ve bunun bedelini açıklayabilmek
  - CLI, web, async, veritabanı, loglama, GUI, oyun, WASM, gömülü ve veri alanları için yaygın crate'leri sayabilmek
  - Bir crate'i indirme, bakım, belge, `unsafe` kullanımı ve lisans ölçütleriyle değerlendirebilmek
  - Crate'lerin ortak trait'ler sayesinde nasıl birlikte çalıştığını bir örnekle gösterebilmek
keywords: [ekosistem, crates.io, blessed.rs, clap, axum, tokio, serde, reqwest, sqlx, tracing, bevy, wasm-bindgen, embassy, polars, lisans]
---

Yirmi beş modül boyunca dilin kendisini öğrendin: sahiplik, trait'ler, yaşam süreleri, thread'ler,
async, makrolar, hatta `unsafe`. Ama gerçek bir projede yazdığın kodun büyük kısmı **başkalarının
crate'leriyle** konuşur. Bir web servisi yazan Rust geliştiricisi HTTP'yi sıfırdan yazmaz; `axum`'u,
`serde`'yi ve `tokio`'yu birleştirir.

Bu son modülde öğrendiklerini gerçek dünyaya bağlayacağız. İlk durak, Rust ekosisteminin haritası: Hangi
iş için hangi crate kullanılır ve iyi bir crate'i kötüsünden nasıl ayırırsın?

:::ferris
Son modüle hoş geldin! Buraya kadar gelen herkes artık "Rust öğrenen" değil, "Rust yazan" biri. Şimdi
araç kutunu dolduralım. 🦀
:::

## Standart kütüphane neden küçük?

Python'da `import json`, `import random`, `import re` yazarsın; hepsi dilin içinden gelir. Go'nun
standart kütüphanesinde bir HTTP sunucusu bile vardır. Rust'ın `std`'sinde ise **JSON yok, rastgele sayı
üreteci yok, düzenli ifade (regex) yok, HTTP yok.** Neden?

Sebep Rust'ın **kararlılık sözü (stability promise)**. `std`'ye giren her API derleyiciyle birlikte
yayımlanır ve **sonsuza kadar** geriye uyumlu kalmak zorundadır. Rust 1.0'da (2015) yazılmış kod bugünkü
derleyiciyle hâlâ derlenir. Bir API'yi `std`'ye koyarsan, tasarımında hata yaptığını sonradan anlasan
bile onu kaldıramazsın.

Crate'ler ise semver ile **sürüm atlayabilir** (Modül 8): `rand` 0.7'den 0.8'e, 0.9'a geçerken API'sini
defalarca iyileştirdi. Kullanıcılar `Cargo.toml`'daki sürümü değiştirene kadar eski API ile çalışmaya devam
etti. `std`'de bu esneklik yoktur.

| Dil | Yaklaşım | Bedeli |
|---|---|---|
| Python | "Piller dahil (batteries included)": büyük std | Eskiyen modüller std'de kalır (`urllib` yerine herkes `requests` kullanır) |
| Go | Orta boy std, içinde HTTP | Değişmesi zor tasarımlar std'de donar |
| Rust | Küçük, çok kararlı `std` + zengin crate ekosistemi | Yeni başlayan, hangi crate'i seçeceğini bilmek zorunda |

İki dünya arasında bir köprü de var: Ekosistemde kendini kanıtlamış fikirler zamanla `std`'ye girer.
Modül 18'de kullandığın `OnceLock` (1.70) ve `LazyLock` (1.80) önce `once_cell` crate'inde yıllarca
denendi. `std::sync::mpsc`'nin bugünkü gerçeklemesi ise `crossbeam-channel`'dan geldi.

:::analogy Belediye ve çarşı
`std`, şehrin belediyesi gibidir: yollar, su, elektrik. Herkesin her gün ihtiyacı olan, bir kez
döşenince **yıllarca sökülmeyen** altyapı. Crate'ler ise çarşıdır: yüzlerce zanaatkâr, rekabet eden
dükkânlar, hızla değişen ürünler. Belediye çarşıdaki her dükkânı kendisi açmaya kalksaydı hem yavaşlar
hem de kötü bir dükkânı kapatamazdı. İyi bir dükkân yıllarca kendini kanıtlarsa, belediye onun
yöntemini benimseyebilir.
:::

```quiz
question: "Rastgele sayı üretmek için kullanılan `rand` neden Rust'ın standart kütüphanesinde değil?"
options:
  - Rust çekirdek ekibi rastgele sayı üretmeyi güvensiz bulduğu için
  - "`std`'ye giren API sonsuza kadar geriye uyumlu kalmalı; ayrı bir crate ise semver ile sürüm atlayıp tasarımını düzeltebilir"
  - Rastgele sayı üretmek `unsafe` kod gerektirdiği için
  - "`std` yalnızca derleme zamanında çalışan kodu içerebildiği için"
answer: 1
explanation: |
  `std` derleyiciyle birlikte gelir ve kararlılık sözü yüzünden API'si bir daha **kırılamaz**. `rand`
  ise 0.x sürümleri boyunca API'sini birçok kez değiştirdi; bu sayede daha iyi bir tasarıma ulaştı. Bu
  esneklik ancak ayrı bir crate'te mümkündür. Bedeli: Projene bir bağımlılık eklemen gerekir.
feedback:
  - "Güvenlik bir sebep değil; `rand`'in kriptografik olarak güvenli üreteçleri de var."
  - Doğru!
  - "`unsafe` ile ilgisi yok; `std`'nin kendisi de içeride bolca `unsafe` kullanır."
  - "`std` çalışma zamanı kodlarıyla dolu: `Vec`, `HashMap`, `thread::spawn`..."
```

## Alan alan ekosistem haritası

İşte Rust dünyasında sık karşılaşacağın crate'ler. Hepsini ezberlemen gerekmez; amaç, bir ihtiyaç doğduğunda
**nereye bakacağını** bilmek.

| Alan | Yaygın crate'ler | Not |
|---|---|---|
| Komut satırı (CLI) | `clap` | Derive ile argüman ayrıştırma (Modül 15) |
| Async çalışma zamanı | `tokio` | Ağ, zamanlayıcı, async kanallar (Modül 19) |
| Serileştirme | `serde`, `serde_json`, `toml` | Bir sonraki dersin konusu |
| Web sunucusu | `axum`, `actix-web` | `axum`, tokio ekibinden |
| HTTP istemcisi | `reqwest` | `async` ve isteğe bağlı bloklayan API |
| Veritabanı | `sqlx`, `diesel`, `sea-orm` | `sqlx` SQL'i derleme zamanında denetleyebilir |
| Loglama ve izleme | `tracing`, `log` | `tracing` async kodda olayları "span"lere bağlar |
| Hata yönetimi | `thiserror`, `anyhow` | Kütüphane / uygulama ayrımı (Modül 25) |
| Paralellik | `rayon` | `par_iter()` (Modül 18) |
| GUI | `egui`, `iced`, `slint`, `tauri` | `tauri`: web arayüzü + Rust arka uç |
| Oyun | `bevy`, `macroquad` | `bevy` bir ECS (Entity Component System) motoru |
| WebAssembly | `wasm-bindgen`, `leptos`, `yew` | Rust'ı tarayıcıda çalıştırmak |
| Gömülü sistemler | `embassy`, `embedded-hal` | Mikrodenetleyicide async, `no_std` |
| Veri bilimi | `polars`, `ndarray` | `polars` Python'dan da kullanılır |
| Metin ve zaman | `regex`, `chrono`, `time`, `itertools` | Küçük ama her yerde |

Rust'ın etkisi Rust programcılarıyla sınırlı değil. Python dünyasının yeni nesil araçları `ruff` (linter)
ve `uv` (paket yöneticisi) Rust ile yazıldı ve öncüllerinden onlarca kat hızlı. `polars` da Rust'la
yazılmış bir DataFrame kütüphanesi ve en çok Python'dan kullanılıyor.

İki küçük tadım. Önce `regex` ve `itertools` ile bir log dosyasından hataları güne göre gruplayalım:

```rust
use itertools::Itertools;
use regex::Regex;

fn main() {
    let kayitlar = "2024-03-15 HATA disk dolu
2024-03-15 BILGI sunucu başladı
2024-03-16 HATA ağ yok
2024-03-15 HATA bellek az";
    let desen = Regex::new(r"^([0-9]{4}-[0-9]{2}-[0-9]{2}) (HATA|BILGI) (.+)$").unwrap();
    let hatalar = kayitlar
        .lines()
        .filter_map(|satir| desen.captures(satir))
        .filter(|c| &c[2] == "HATA")
        .map(|c| (c[1].to_string(), c[3].to_string()))
        .sorted()
        .collect::<Vec<_>>();
    for (gun, grup) in &hatalar.iter().chunk_by(|(g, _)| g.clone()) {
        println!("{gun} → {}", grup.map(|(_, m)| m).join(", "));
    }
}
```

`sorted()`, `chunk_by()` ve `join()` `std`'de olmayan, `itertools`'un `Itertools` **eklenti trait'i
(extension trait, Modül 20)** ile her iterator'a eklediği metotlardır. `use itertools::Itertools;` satırı
o trait'i kapsama alır.

İkinci tadım, Modül 15'te bahsettiğimiz `clap`'in derive API'si. Bu program komut satırı argümanı okuduğu
için uygulamada çalıştırılmaz:

```rust,norun
use clap::Parser;

/// Bir öğrencinin not ortalamasını hesaplar
#[derive(Parser, Debug)]
struct Argumanlar {
    /// Öğrencinin adı
    #[arg(short, long)]
    isim: String,
    /// Notlar (boşlukla ayır)
    #[arg(required = true)]
    notlar: Vec<u32>,
}

fn main() {
    let a = Argumanlar::parse(); // hatalı girdi → otomatik hata mesajı + --help
    let ortalama = a.notlar.iter().sum::<u32>() as f64 / a.notlar.len() as f64;
    println!("{}: {ortalama:.1}", a.isim);
}
```

`ortalama --isim Ece 80 95 70` yazınca `Ece: 81.7` çıktısını verir; `--help` ise `///` yorumlarından
üretilmiş bir yardım metni gösterir. Argüman ayrıştırma kodunun **tamamı** derive makrosunun ürettiği koddur
(Modül 23).

```quiz
question: |
  Bir arkadaşın bir sıcaklık sensörünü okuyup değeri radyoyla gönderecek, **işletim sistemi olmayan** bir
  mikrodenetleyici için Rust ile firmware yazmak istiyor. Ekosistem haritasında hangi crate onun için en
  doğal başlangıç noktasıdır?
options:
  - "`tokio`, çünkü radyo iletişimi async bir iştir"
  - "`embassy`, çünkü `no_std` gömülü ortamlar için async çalışma zamanı ve donanım sürücüleri sunar"
  - "`bevy`, çünkü sensör verisini ECS ile modellemek kolaydır"
  - "`axum`, çünkü veriyi HTTP ile göndermek gerekir"
answer: 1
explanation: |
  İşletim sistemi yoksa `std` de yoktur (`no_std`): thread, dosya, ağ yığını kullanılamaz. `tokio`
  işletim sisteminin sağladığı I/O olaylarına dayanır. `embassy` ise async/await'i doğrudan donanım
  kesmeleri (interrupt) üzerine kurar; Modül 19'da öğrendiğin `Future` modeli burada da aynıdır.
feedback:
  - "`tokio` bir işletim sistemine (epoll, IOCP) ihtiyaç duyar; çıplak donanımda çalışmaz."
  - Doğru!
  - "`bevy` bir oyun motoru; firmware için değil."
  - "`axum` bir web sunucusu çerçevesi; tokio'ya ve dolayısıyla bir işletim sistemine dayanır."
```

## İyi bir crate nasıl seçilir?

crates.io'da yüz binden fazla crate var. Aynı işi yapan beş crate bulduğunda hangisini seçeceksin? Kör bir
"en çok yıldız alanı seç" yerine şu ölçütlere bak:

| Ölçüt | Nereye bakılır? | Neden önemli? |
|---|---|---|
| Kullanım | crates.io'daki (son 90 gün) indirme sayısı, kaç crate'in ona bağımlı olduğu | Çok kullanılan crate'in hataları daha hızlı bulunur |
| Bakım | Son sürüm tarihi, açık issue/PR'lere yanıt süresi, bakımcı sayısı | Tek bakımcılı terk edilmiş crate bir risk |
| Kararlılık | Sürüm `1.x` mi, `0.x` mi? | `0.x`'te her küçük sürüm kırıcı olabilir (Modül 8) |
| Belgeleme | docs.rs sayfası, örnekler, `README` | Belgesiz crate'i öğrenmek için kaynak kodu okumak zorunda kalırsın |
| `unsafe` kullanımı | Kaynak kod, `cargo geiger` | `unsafe` kötü değildir, ama gerekçeli ve `// SAFETY:` belgeli olmalı (Modül 24) |
| Bağımlılıklar | `cargo tree` (Modül 16) | Her bağımlılık derleme süresi ve tedarik zinciri riski demek |
| Güvenlik | `cargo audit` (RustSec veritabanı) | Bilinen açığı olan sürümleri yakalar |
| Lisans | `Cargo.toml`'daki `license` alanı | Şirketin kodunu kapalı tutması gerekiyorsa bazı lisanslar uygun değildir |

Rust ekosisteminin geleneksel lisansı **`MIT OR Apache-2.0`**'dır: Kullanıcı ikisinden birini seçebilir.
`OR` (veya) ifadesi önemlidir: `GPL-3.0 OR MIT` lisanslı bir crate'i MIT koşullarıyla kullanabilirsin. Ama
yalnızca `GPL-3.0` lisanslı bir crate'i kapalı kaynak bir ürüne eklemek, ürününün kaynağını açma
yükümlülüğü doğurabilir.

:::tip Kısa yollar
- **blessed.rs**: Topluluğun alan alan derlediği "güvenilir crate'ler" listesi. Kararsız kaldığında ilk durak.
- **lib.rs**: crates.io'nun daha iyi aranabilen, kategorilere ayrılmış bir görünümü.
- **"Are we ... yet?"** siteleri: arewewebyet.org, arewegameyet.rs, areweguiyet.com, arewelearningyet.com.
  Bir alanın Rust'ta ne kadar olgun olduğunu gösterirler.
- `cargo deny` lisans ve güvenlik kurallarını CI'da otomatik denetler.
:::

```quiz
question: Aşağıdaki crate'lerden hangisini kapalı kaynak bir ticari ürüne eklemek **en riskli** olanıdır?
options:
  - "`license = \"MIT OR Apache-2.0\"`, sürüm 1.4, son sürüm 2 ay önce"
  - "`license = \"GPL-3.0 OR MIT\"`, sürüm 2.1, son sürüm 1 ay önce"
  - "`license = \"GPL-3.0\"`, sürüm 3.0, son sürüm 1 hafta önce"
  - "`license = \"Apache-2.0\"`, sürüm 0.9, son sürüm 3 ay önce"
answer: 2
explanation: |
  Lisans ifadesindeki `OR`, kullanıcıya seçim hakkı verir. Yalnızca `GPL-3.0` lisanslı bir crate ise
  onu kullanan ürünü de GPL koşullarına bağlayabilir. Kapalı kaynak bir ürün için bu, teknik
  ölçütlerden bağımsız olarak engelleyici bir risktir. `0.9` sürümlü crate'in kırıcı değişiklik riski
  vardır ama bu teknik bir risktir ve yönetilebilir.
feedback:
  - Rust ekosisteminin standart, en serbest ikili lisansı.
  - "`OR` sayesinde MIT'i seçebilirsin."
  - Doğru!
  - "`0.x` dikkat gerektirir ama Apache-2.0 kapalı kaynakta kullanılabilir."
```

## Ekosistemin ortak dili: trait'ler

Bağımsız ekiplerin yazdığı yüzlerce crate nasıl olur da birbirine **tak-çalıştır** uyar? Cevap: Ortak
trait'ler. `std` küçük olabilir ama tanımladığı trait'ler bütün ekosistemin sözleşmesidir:

- `Iterator` → `itertools`, `rayon` gibi crate'ler her iterator'a yeni yetenek ekler.
- `std::io::Read` / `Write` → dosya, TCP bağlantısı, sıkıştırıcı, bellek içi tampon aynı arayüzü paylaşır.
- `Future` → `tokio`, `reqwest`, `axum` aynı async modelini konuşur.
- `std::error::Error` ve `From` → `?` farklı crate'lerin hatalarını tek tipe dönüştürür (Modül 10, 11).
- `serde::Serialize` / `Deserialize` → yüzlerce crate'in tipi JSON, TOML, YAML... ile çalışır.

Bunun gücünü görmek için `Write` trait'ini kullanan bir fonksiyon yazalım. Fonksiyon nereye yazdığını
**bilmiyor**; yalnızca hedefin `Write` olmasını istiyor:

```rust
use std::io::{self, Write};

fn fis_yaz(hedef: &mut impl Write, urunler: &[(&str, u32)]) -> io::Result<()> {
    let mut toplam = 0;
    for (ad, fiyat) in urunler {
        writeln!(hedef, "{ad:<10}{fiyat:>5} TL")?;
        toplam += fiyat;
    }
    writeln!(hedef, "{:<10}{toplam:>5} TL", "TOPLAM")
}

fn main() -> io::Result<()> {
    let sepet = [("simit", 15), ("çay", 10), ("poğaça", 25)];

    // 1) Doğrudan ekrana
    fis_yaz(&mut io::stdout(), &sepet)?;

    // 2) Bellekteki bir bayt tamponuna (test için ideal!)
    let mut tampon: Vec<u8> = Vec::new();
    fis_yaz(&mut tampon, &sepet)?;
    println!("Tamponda {} bayt var", tampon.len());
    Ok(())
}
```

Aynı fonksiyon bir dosyaya (`File`), bir TCP bağlantısına (`TcpStream`) ya da bir `gzip` sıkıştırıcısına da
yazabilir; hepsi `Write`'tır. Bu fikri Final projesi 1'de kullanacağız: Web sunucusunun bağlantı işleyicisini
`Read`/`Write` üzerinden yazınca, **ağ olmadan** test edebileceğiz.

```predict
question: "Bu program ne yazdırır? Dikkat: `Vec<u8>` **bayt** tutar."
code: |
  use std::io::{self, Write};

  fn fis_yaz(hedef: &mut impl Write, urunler: &[(&str, u32)]) -> io::Result<()> {
      let mut toplam = 0;
      for (ad, fiyat) in urunler {
          writeln!(hedef, "{ad:<10}{fiyat:>5} TL")?;
          toplam += fiyat;
      }
      writeln!(hedef, "{:<10}{toplam:>5} TL", "TOPLAM")
  }

  fn main() -> io::Result<()> {
      let sepet = [("çay", 10), ("su", 5)];
      let mut tampon: Vec<u8> = Vec::new();
      fis_yaz(&mut tampon, &sepet)?;
      println!("{}", tampon.len());
      Ok(())
  }
options:
  - "57"
  - "58"
  - "60"
answer: 1
explanation: |
  Üç satır yazılır: `çay`, `su` ve `TOPLAM`. Her satır 10 karakterlik ad alanı, 5 karakterlik fiyat,
  `" TL"` (3) ve satır sonu `\n` (1) içerir: 19 **karakter**. Üç satır 57 karakter eder.

  Ama `Vec<u8>` karakter değil **bayt** sayar ve genişlik (`{:<10}`) karakter üzerinden hesaplanır.
  `"çay"` 3 karakterdir, 7 boşlukla 10 karaktere tamamlanır; ancak `ç` UTF-8'de 2 bayt olduğu için ad
  alanı 11 bayt tutar. Sonuç: 20 + 19 + 19 = **58**. Modül 9'daki "Türkçe harfler 2 bayttır" kuralı,
  bir sonraki derslerde HTTP'nin `Content-Length` başlığını hesaplarken tekrar karşımıza çıkacak.
```

Ekosistemin tak-çalıştır doğasının bir de kuralı var. Bir crate'in tipine (örneğin `chrono`'nun tarih
tipine) başka bir crate'in trait'ini (örneğin `serde`'nin `Serialize`'ını) **sen** uygulayamazsın. Neden?
Önce şu küçük örnekte tahmin et:

```compiles
question: "(Modül 11 tekrarı) Derlenir mi?"
code: |
  use std::fmt;

  impl fmt::Display for Vec<u32> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{} öğe", self.len())
      }
  }

  fn main() {
      println!("{}", vec![1, 2, 3]);
  }
answer: false
error: E0117
explanation: |
  **Orphan rule**: `impl Trait for Tip` yazabilmen için trait'in **ya da** tipin senin crate'inde olması
  gerekir. Burada ikisi de `std`'ye ait. Bu kural, iki farklı crate'in aynı tip için çakışan iki impl
  yazmasını engeller. Çözüm, Modül 11 ve 22'deki **newtype**: `struct Liste(Vec<u32>);`
```

İşte bu yüzden birçok crate isteğe bağlı bir **`serde` feature'ı** sunar (Modül 16). `chrono` kendi
tiplerine `Serialize`'ı **kendi içinde** uygular; sen sadece özelliği açarsın:

```toml
[dependencies]
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
```

```fill
prompt: |
  `selamla` fonksiyonu herhangi bir yazılabilir hedefe yazsın. Testte çıktıyı bellekteki bir tampona
  yazıp `String`'e çeviriyoruz. Boşlukları doldur.
code: |
  use std::io::{self, Write};

  fn selamla(hedef: &mut impl ___0, isim: &str) -> io::Result<()> {
      writeln!(hedef, "Merhaba, {isim}!")
  }

  fn main() {
      let mut tampon: Vec<u8> = Vec::new();
      selamla(&mut tampon, "Ece").unwrap();
      let metin = String::from_utf8(tampon).___1();
      print!("{metin}");
  }
blanks:
  - ["Write", "io::Write", "std::io::Write"]
  - ["unwrap"]
output: "Merhaba, Ece!"
explanation: |
  `impl Write` sınırı, fonksiyonun `stdout`, `File`, `TcpStream` ya da `Vec<u8>` ile çalışmasını sağlar.
  `String::from_utf8` baytların geçerli UTF-8 olup olmadığını denetler ve bir `Result` döndürür; burada
  baytları kendimiz `writeln!` ile yazdığımız için geçerli olduklarını biliyoruz, `unwrap` güvenli.
```

## Alıştırma: crate karnesi

```exercise
title: Crate karnesi
difficulty: 3
prompt: |
  Bir yazılım şirketinde bağımlılık eklemeden önce her crate için bir **karne** çıkarılıyor. `degerlendir`
  fonksiyonunu yaz.

  **1. Lisans kontrolü (önce bu!)** `lisans` alanı `" OR "` ile ayrılmış bir veya daha çok lisans içerir
  (ör. `"MIT OR Apache-2.0"`). Parçalardan **en az biri** `MIT`, `Apache-2.0` veya `BSD-3-Clause` ise lisans
  uygundur. Değilse sonuç `Karar::Kacin(format!("lisans uyumsuz: {lisans}"))` olur ve başka kontrol yapılmaz.

  **2. Uyarılar** (bu sırayla ve tam bu metinlerle):
  - `son_surum_gun > 365` → `"bir yıldan uzun süredir sürüm yok"`
  - `aylik_indirme < 10000` → `"az kullanılıyor"`
  - `surum.0 == 0` → `"1.0 öncesi sürüm"`
  - `unsafe_blok > 0` → `"N unsafe blok içeriyor"` (N yerine sayı)

  **3. Karar:** Uyarı yoksa `Karar::Uygun`; 1 veya 2 uyarı varsa `Karar::Dikkat(uyarilar)`; 3 veya daha
  fazlaysa `Karar::Kacin(format!("çok fazla risk ({n} uyarı)"))`.
starter: |
  #[derive(Debug)]
  struct CrateBilgisi {
      ad: String,
      lisans: String,
      surum: (u32, u32, u32),
      son_surum_gun: u32,
      aylik_indirme: u64,
      unsafe_blok: u32,
  }

  #[derive(Debug, PartialEq)]
  enum Karar {
      Uygun,
      Dikkat(Vec<String>),
      Kacin(String),
  }

  fn degerlendir(c: &CrateBilgisi) -> Karar {
      todo!()
  }

  fn main() {
      let serde = CrateBilgisi {
          ad: String::from("serde"),
          lisans: String::from("MIT OR Apache-2.0"),
          surum: (1, 0, 219),
          son_surum_gun: 20,
          aylik_indirme: 30_000_000,
          unsafe_blok: 0,
      };
      println!("{}: {:?}", serde.ad, degerlendir(&serde));
  }
solution: |
  #[derive(Debug)]
  struct CrateBilgisi {
      ad: String,
      lisans: String,
      surum: (u32, u32, u32),
      son_surum_gun: u32,
      aylik_indirme: u64,
      unsafe_blok: u32,
  }

  #[derive(Debug, PartialEq)]
  enum Karar {
      Uygun,
      Dikkat(Vec<String>),
      Kacin(String),
  }

  const IZINLI: [&str; 3] = ["MIT", "Apache-2.0", "BSD-3-Clause"];

  fn degerlendir(c: &CrateBilgisi) -> Karar {
      let lisans_uygun = c.lisans.split(" OR ").any(|l| IZINLI.contains(&l.trim()));
      if !lisans_uygun {
          return Karar::Kacin(format!("lisans uyumsuz: {}", c.lisans));
      }

      let mut uyarilar = Vec::new();
      if c.son_surum_gun > 365 {
          uyarilar.push(String::from("bir yıldan uzun süredir sürüm yok"));
      }
      if c.aylik_indirme < 10_000 {
          uyarilar.push(String::from("az kullanılıyor"));
      }
      if c.surum.0 == 0 {
          uyarilar.push(String::from("1.0 öncesi sürüm"));
      }
      if c.unsafe_blok > 0 {
          uyarilar.push(format!("{} unsafe blok içeriyor", c.unsafe_blok));
      }

      match uyarilar.len() {
          0 => Karar::Uygun,
          1 | 2 => Karar::Dikkat(uyarilar),
          n => Karar::Kacin(format!("çok fazla risk ({n} uyarı)")),
      }
  }

  fn main() {
      let serde = CrateBilgisi {
          ad: String::from("serde"),
          lisans: String::from("MIT OR Apache-2.0"),
          surum: (1, 0, 219),
          son_surum_gun: 20,
          aylik_indirme: 30_000_000,
          unsafe_blok: 0,
      };
      println!("{}: {:?}", serde.ad, degerlendir(&serde));
  }
check: tests
tests: |
  fn crate_(lisans: &str, surum: (u32, u32, u32), gun: u32, indirme: u64, unsafe_blok: u32) -> CrateBilgisi {
      CrateBilgisi {
          ad: String::from("deneme"),
          lisans: String::from(lisans),
          surum,
          son_surum_gun: gun,
          aylik_indirme: indirme,
          unsafe_blok,
      }
  }

  #[test]
  fn saglam_crate_uygun() {
      let c = crate_("MIT OR Apache-2.0", (1, 2, 0), 30, 5_000_000, 0);
      assert_eq!(degerlendir(&c), Karar::Uygun, "hiç uyarısı olmayan crate Uygun olmalı");
  }

  #[test]
  fn yalniz_gpl_reddedilir_ama_veya_ile_kabul() {
      let gpl = crate_("GPL-3.0", (2, 0, 0), 10, 1_000_000, 0);
      assert_eq!(degerlendir(&gpl), Karar::Kacin(String::from("lisans uyumsuz: GPL-3.0")));
      let ikili = crate_("GPL-3.0 OR MIT", (2, 0, 0), 10, 1_000_000, 0);
      assert_eq!(degerlendir(&ikili), Karar::Uygun, "`OR` ile MIT seçilebiliyorsa lisans uygundur");
      let bsd = crate_("BSD-3-Clause", (1, 0, 0), 10, 1_000_000, 0);
      assert_eq!(degerlendir(&bsd), Karar::Uygun, "BSD-3-Clause de izinli");
  }

  #[test]
  fn iki_uyari_dikkat_sirali() {
      let c = crate_("Apache-2.0", (0, 9, 3), 40, 2_000, 0);
      assert_eq!(
          degerlendir(&c),
          Karar::Dikkat(vec![String::from("az kullanılıyor"), String::from("1.0 öncesi sürüm")]),
          "uyarılar tanımlanan sırada gelmeli"
      );
  }

  #[test]
  fn unsafe_sayisi_mesajda() {
      let c = crate_("MIT", (1, 0, 0), 10, 50_000, 7);
      assert_eq!(degerlendir(&c), Karar::Dikkat(vec![String::from("7 unsafe blok içeriyor")]));
  }

  #[test]
  fn uc_uyari_kacin() {
      let c = crate_("MIT", (0, 1, 0), 800, 300, 2);
      assert_eq!(
          degerlendir(&c),
          Karar::Kacin(String::from("çok fazla risk (4 uyarı)")),
          "4 uyarı varsa crate'ten kaçınılmalı"
      );
      let c = crate_("MIT", (0, 1, 0), 800, 300, 0);
      assert_eq!(degerlendir(&c), Karar::Kacin(String::from("çok fazla risk (3 uyarı)")));
  }
hints:
  - "Lisans için `c.lisans.split(\" OR \")` parçalarından **herhangi biri** izinli listede mi? `iter().any(...)` tam bu iş için."
  - "Lisans uygun değilse hemen `return Karar::Kacin(...)` ile çık. Sonra `let mut uyarilar = Vec::new();` oluştur ve dört koşulu sırayla `if` ile kontrol edip `push` et."
  - "Son adımda `match uyarilar.len() { 0 => ..., 1 | 2 => Karar::Dikkat(uyarilar), n => Karar::Kacin(format!(\"çok fazla risk ({n} uyarı)\")) }`."
explanation: |
  Çözüm iki aşamalı: Önce **engelleyici** kontrol (lisans), sonra **biriktirilen** uyarılar. Engelleyici
  kontrolü erken `return` ile yapmak (Modül 3) fonksiyonun geri kalanını sadeleştirir.

  `split(" OR ").any(...)` SPDX lisans ifadelerinin `OR` kuralını doğrudan modelliyor: Seçeneklerden biri
  uygunsa yeter. `IZINLI.contains(&l.trim())` ifadesinde `contains` bir `&&str` beklediği için `&` gerekiyor.

  `match uyarilar.len()` içindeki `1 | 2` deseni (Modül 21) ve `n =>` bağlaması, sayıyı mesajda yeniden
  kullanmamızı sağlıyor. `Dikkat(uyarilar)` dalında `Vec` enum'un içine **taşınıyor**, kopyalanmıyor.

  Gerçek hayatta bu kontrollerin çoğunu `cargo deny` (lisans, güvenlik açığı, yinelenen bağımlılık) ve
  `cargo geiger` (`unsafe` sayımı) otomatik yapar. Yine de kararı veren sensin: Az indirilen bir crate
  yeni ve harika olabilir, `unsafe` içeren bir crate de çok iyi denetlenmiş olabilir.
```

## Özet

:::remember
- `std` küçüktür çünkü **sonsuza kadar** geriye uyumlu kalmalıdır; crate'ler semver ile sürüm atlayıp gelişebilir.
- Kendini kanıtlamış fikirler `std`'ye girer: `once_cell` → `OnceLock`/`LazyLock`.
- Harita: CLI `clap`, async `tokio`, serileştirme `serde`, web `axum`, HTTP istemcisi `reqwest`, veritabanı
  `sqlx`/`diesel`, log `tracing`, GUI `egui`/`tauri`, oyun `bevy`, WASM `wasm-bindgen`/`leptos`, gömülü `embassy`, veri `polars`.
- Crate seçerken: kullanım, bakım, sürüm (`0.x`?), belgeler, `unsafe`, bağımlılıklar, güvenlik (`cargo audit`), lisans.
- Ekosistemi birbirine bağlayan, `std`'nin ortak trait'leridir: `Iterator`, `Read`/`Write`, `Future`, `Error`, `From`.
:::

```reflect
prompt: |
  Rust'ın küçük `std` + büyük ekosistem yaklaşımını Python'ın "piller dahil" yaklaşımıyla karşılaştır.
  Yeni başlayan biri için ve on yıllık bir proje için hangisinin ne avantajı var?
answer: |
  Python'da yeni başlayan biri hiçbir şey kurmadan JSON okuyabilir, bu çok rahattır. Ama std'deki eski
  modüller (ör. `urllib`) tasarımları eskise bile kaldırılamaz ve topluluk zaten `requests` gibi dış
  paketlere geçer. Rust'ta yeni başlayan biri hangi crate'i seçeceğini öğrenmek zorundadır, bu bir yük.
  Karşılığında `std` çok kararlıdır: On yıllık bir proje derleyiciyi güncelleyince kırılmaz. Crate'ler
  ise semver sayesinde iyileşmeye devam eder ve projeyi istediği zaman yeni sürüme taşır.
```

```flashcards
- front: Rust'ın standart kütüphanesi neden JSON, regex ve HTTP içermez?
  back: "`std` sonsuza kadar geriye uyumlu kalmak zorundadır; ayrı crate'ler ise semver ile sürüm atlayıp tasarımlarını düzeltebilir."
- front: "Önce bir crate'te denenip sonra `std`'ye giren bir özelliğe örnek ver."
  back: "`once_cell` → `std::sync::OnceLock` (1.70) ve `LazyLock` (1.80)."
- front: "Rust'ta komut satırı argümanı, async çalışma zamanı ve serileştirme için standartlaşmış crate'ler hangileri?"
  back: "`clap`, `tokio`, `serde`."
- front: "İşletim sistemi olmayan bir mikrodenetleyicide async Rust için hangi crate kullanılır?"
  back: "`embassy` (`no_std` ortam; `tokio` çalışmaz)."
- front: "`license = \"GPL-3.0 OR MIT\"` olan bir crate'i MIT koşullarıyla kullanabilir misin?"
  back: "Evet. `OR` kullanıcıya lisanslardan birini seçme hakkı verir."
- front: Bir crate'i değerlendirirken bakılacak en az beş ölçüt say.
  back: Kullanım (indirme), bakım (son sürüm, issue yanıtları), kararlılık (1.x / 0.x), belgeler (docs.rs), `unsafe` kullanımı, bağımlılık sayısı, güvenlik (`cargo audit`), lisans.
- front: "Topluluğun alan alan derlediği güvenilir crate listesi hangi sitededir?"
  back: blessed.rs
- front: "Bir fonksiyonu `&mut impl Write` alacak şekilde yazmanın test açısından faydası nedir?"
  back: "Aynı fonksiyon ekrana, dosyaya, TCP bağlantısına ve bellekteki bir `Vec<u8>`'e yazabilir; testte `Vec<u8>` kullanırsın."
```
