---
id: m26-l05
title: Sırada ne var?
minutes: 18
type: lesson
objectives:
  - Rust'ı derinleştirmek için doğru kaynağı (Book, Rustlings, Rustonomicon, Rust for Rustaceans...) ihtiyaca göre seçebilmek
  - Backend, sistem, gömülü, WASM, oyun ve veri gibi uzmanlık alanlarını ve her birinin temel crate'lerini eşleştirebilmek
  - Açık kaynak bir Rust projesine ilk katkıyı adım adım planlayabilmek
  - Kendine ölçülebilir hedefleri olan bir 30-60-90 günlük öğrenme planı çıkarabilmek
keywords: [yol haritası, kaynaklar, Rustlings, Rustonomicon, "Rust for Rustaceans", "Zero To Production", Exercism, "Advent of Code", açık kaynak, uzmanlaşma, final]
---

Buraya kadar geldin. İlk derste ekrana `Merhaba, dünya!` yazdırıyordun. Şimdi sahiplik, yaşam süreleri,
trait nesneleri, async, makrolar ve `unsafe` ile çalıştın. Standart kütüphaneden başka hiçbir şey
kullanmadan çok thread'li bir web sunucusu da yazdın. Bu son derste geriye bakacak, sonra ileriye doğru
**somut** bir plan çıkaracağız.

:::ferris
Tebrikler! Sana bir sır vereyim: Rust'ı "bitiren" kimse yok. Derleyiciyi yazanlar bile her gün yeni bir
şey öğreniyor. Ama artık soruları doğru sorabilen, cevapları kendi başına bulabilen biri oldun. 🦀🎉
:::

## Yolculuğuna bir bak

Uygulamanın haritasındaki sekiz bölgeyi tek tek geçtin. Bu haritayı, öğrendiğin parçalarla yazılmış bir
programla çizelim:

```rust
use std::fmt;

struct Bolge {
    ad: &'static str,
    moduller: u32,
    biten: u32,
}

impl fmt::Display for Bolge {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let cubuk: String = (0..self.moduller)
            .map(|i| if i < self.biten { '■' } else { '□' })
            .collect();
        write!(f, "{:<22}{cubuk}", self.ad)
    }
}

fn main() {
    let harita = [
        Bolge { ad: "Başlangıç Koyu", moduller: 3, biten: 3 },
        Bolge { ad: "Sahiplik Adası", moduller: 4, biten: 4 },
        Bolge { ad: "Yapı Limanı", moduller: 3, biten: 3 },
        Bolge { ad: "Soyutlama Ormanı", moduller: 3, biten: 3 },
        Bolge { ad: "Fonksiyonel Vadi", moduller: 3, biten: 3 },
        Bolge { ad: "Eşzamanlılık Dağları", moduller: 3, biten: 3 },
        Bolge { ad: "Desen Kanyonu", moduller: 3, biten: 3 },
        Bolge { ad: "Uzman Zirvesi", moduller: 4, biten: 3 },
    ];
    for bolge in &harita {
        println!("{bolge}");
    }
    let toplam: u32 = harita.iter().map(|b| b.moduller).sum();
    let biten: u32 = harita.iter().map(|b| b.biten).sum();
    println!("{biten}/{toplam} modül bitti.");
    if let Some(b) = harita.iter().find(|b| b.biten < b.moduller) {
        println!("Son durak: {} — tam şu an buradasın!", b.ad);
    }
}
```

Bu kısa programı satır satır okuyabildiğini fark et: bir `struct`, bir `Display` gerçeklemesi (Modül 11),
`&'static str` (Modül 12), closure'lar ve iterator zincirleri (Modül 14), `collect` ile `String`
üretmek, `if let` ile `Option` (Modül 7). İlk modülde bu kodun her satırı bir bilmeceydi.

Kas hafızanı iki küçük soruyla yokla. Ama dikkat, ikisi de klasik tuzak:

```predict
question: "(Modül 14 tekrarı) Bu program ne yazdırır?"
code: |
  fn main() {
      let mut sayac = 0;
      let kareler: Vec<i32> = (1..=5)
          .map(|x| {
              sayac += 1;
              x * x
          })
          .filter(|x| x % 2 == 1)
          .take(2)
          .collect();
      println!("{kareler:?} {sayac}");
  }
options:
  - "[1, 9] 5"
  - "[1, 9] 3"
  - "[1, 9, 25] 5"
  - "[1, 9] 2"
answer: 1
explanation: |
  Iterator'lar **tembeldir (lazy)**: `collect` her seferinde bir sonraki elemanı **ister**, zincir
  yalnızca o kadar çalışır. `take(2)` iki eleman aldıktan sonra kaynaktan hiçbir şey istemez:
  `x=1` → 1 (tek, alındı), `x=2` → 4 (çift, elendi), `x=3` → 9 (tek, alındı, dur). `map` üç kez çalıştı.
  Python'un generator'ları da böyledir. Java'nın Stream'leri de tembeldir, ama Rust'ta bu soyutlamanın
  maliyeti elle yazılmış bir döngüyle aynıdır (zero-cost, Modül 25).
```

```compiles
question: "(Modül 12 tekrarı) Derlenir mi?"
code: |
  fn daha_uzun(a: &str, b: &str) -> &str {
      if a.len() >= b.len() { a } else { b }
  }

  fn main() {
      println!("{}", daha_uzun("Rust", "Ferris"));
  }
answer: false
error: E0106
explanation: |
  Dönüş değeri bir referans, ama `a`'dan mı `b`'den mi ödünç alındığı belli değil. İki girdi referansı
  olduğu için elision kuralları (Modül 12) yaşam süresini çıkaramıyor. Çözüm:
  `fn daha_uzun<'a>(a: &'a str, b: &'a str) -> &'a str`. Bu hatayı ilk gördüğünde korkutucuydu; şimdi
  derleyicinin sana "sözleşmeyi yaz" dediğini biliyorsun.
```

:::analogy Ehliyet
Bu uygulamayı bitirmek **ehliyet almak** gibi. Kuralları biliyorsun, direksiyonu çevirebiliyorsun,
park edebiliyorsun. Ama iyi bir sürücü olmak, ehliyetten sonraki binlerce kilometrede gerçekleşir: yağmurda,
gece, bilmediğin şehirlerde. Bundan sonraki her proje bir yolculuk. İlk kilometrelerde yavaş gitmek, harita
açmak ve yolu sormak tamamen normal.
:::

## Bundan sonra ne okumalı, ne çözmeli?

Rust topluluğunun en büyük gücü, ücretsiz ve çok kaliteli öğrenme kaynakları. İşte ne zaman hangisine
başvuracağın:

| Kaynak | Ne için? | Ne zaman? |
|---|---|---|
| **The Rust Programming Language** ("the Book") | Dilin resmî, eksiksiz anlatımı | Hemen. Bu uygulamanın konularını ikinci bir anlatımla pekiştirir |
| **Rust by Example** | Her konuyu çalıştırılabilir kısa örneklerle gösterir | Bir sözdizimini hızla hatırlamak istediğinde |
| **Rustlings** | Terminalde, derleyici hatalarını düzelterek ilerlenen küçük alıştırmalar | İlk 30 gün, her gün biraz |
| **Exercism (Rust yolu)** | Gerçek mentorlardan kod incelemesi alınan alıştırmalar | İdiomatik kod yazmayı öğrenirken |
| **Advent of Code** | Her aralık ayı, 25 günlük algoritma bulmacaları | Iterator, koleksiyon ve ayrıştırma pratiği için |
| **Rust Atomics and Locks** (Mara Bos) | Atomikler, bellek sıralaması, kilitlerin içi | Modül 18'i derinleştirmek istediğinde |
| **Asynchronous Programming in Rust** (Async Book) | `Future`, `Pin`, çalışma zamanlarının içi | Async'te "neden"leri merak ettiğinde |
| **Rust for Rustaceans** (Jon Gjengset) | Orta seviyeden ileriye: API tasarımı, `unsafe`, makrolar, async'in derinlikleri | Birkaç projeden sonra |
| **Zero To Production in Rust** (Luca Palmieri) | Testleri, CI'ı ve gözlemlenebilirliğiyle gerçek bir backend servisi | Backend'e yöneldiğinde |
| **The Rustonomicon** | `unsafe` Rust'ın karanlık sanatları: UB, varyans, `drop` kontrolü | `unsafe` yazmadan **önce** |
| **std belgeleri** ve **The Rust Reference** | Her tipin, her trait'in, dilin her kuralının kesin tanımı | Her gün. `rustup doc --std` çevrimdışı açar |

Advent of Code'un neden bu kadar sevildiğini küçük bir örnekle gör. Bir kervandaki her devenin taşıdığı
yükler alt alta yazılmış, develer boş satırla ayrılmış. En ağır yükü taşıyan deve hangisi? Bu tür
bulmacalar tam da Modül 9 ve 14'te öğrendiklerinle çözülür:

```rust
fn main() {
    let girdi = "1200
800

3000

450
450
450

2100
900";
    let mut yukler: Vec<u32> = girdi
        .split("\n\n")
        .map(|deve| deve.lines().map(|s| s.parse::<u32>().unwrap()).sum())
        .collect();
    yukler.sort_unstable_by(|a, b| b.cmp(a)); // büyükten küçüğe
    println!("en ağır deve: {} kg", yukler[0]);
    println!("en ağır üç devenin toplamı: {} kg", yukler.iter().take(3).sum::<u32>());
}
```

Gerçek bulmacada girdi bir dosyadan okunur ve binlerce satırdır. Her bulmacanın ikinci yarısı, ilk
çözümünü genelleştirmeye zorlar; tıpkı yukarıdaki "ilk üç" sorusu gibi. `unwrap` yerine `Result`
döndürmek, `sort` yerine `BinaryHeap` kullanmak gibi iyileştirmeler de iyi bir alıştırmadır.

```quiz
question: |
  Ayşe bir C kütüphanesini saran ve içinde `unsafe` bloklar olan bir crate yazacak. Tanımsız davranışa
  (UB) yol açmamak için hangi kaynağı **önce** okumalı?
options:
  - Rust by Example
  - The Rustonomicon
  - Zero To Production in Rust
  - Advent of Code
answer: 1
explanation: |
  Rustonomicon, `unsafe` Rust'ın sözleşmelerini anlatan resmî kitaptır: hangi işlemler UB'dir, ham
  işaretçilerin kuralları, `Send`/`Sync`'i elle uygulamak, `repr(C)` ve FFI... Modül 24'te ondan
  bahsetmiştik. Yanına Miri'yi (`cargo miri test`) de ekle: UB'yi çalışma zamanında yakalar.
feedback:
  - Rust by Example sözdizimini gösterir ama `unsafe` sözleşmelerine derinlemesine girmez.
  - Doğru!
  - Zero To Production bir backend kitabıdır; `unsafe` ile ilgilenmez.
  - Advent of Code algoritma pratiği içindir.
```

## Uzmanlık alanları

Rust'ın "genel amaçlı" olması, her alanda kullanılabileceği anlamına gelir. Ama derinleşmek için bir
alan seçmek gerekir. İlk dersteki ekosistem haritasını bu kez **kariyer** gözüyle oku:

| Alan | Ne yaparsın? | Başlangıç noktası |
|---|---|---|
| **Backend / web servisleri** | API'ler, mikroservisler, yüksek trafikli sistemler | `tokio`, `axum`, `sqlx`, `serde`, `tracing` + Zero To Production |
| **Sistem ve komut satırı araçları** | `ripgrep`, `fd`, `bat` gibi hızlı araçlar, derleyiciler, veritabanları | `clap`, `anyhow`, std'nin kendisi + Rust for Rustaceans |
| **Gömülü sistemler** | Mikrodenetleyiciler, IoT, sensörler (`no_std`) | `embassy`, `embedded-hal`, The Embedded Rust Book |
| **WebAssembly** | Tarayıcıda çalışan hızlı modüller, tam Rust ön yüzleri | `wasm-bindgen`, `wasm-pack`, `leptos`, `yew` |
| **Oyun geliştirme** | Oyun motorları, simülasyonlar | `bevy` (ECS), `macroquad` |
| **Veri ve yapay zekâ altyapısı** | Veri işleme hatları, hızlı Python eklentileri | `polars`, `PyO3` + `maturin`, `candle` |
| **İşletim sistemleri ve çekirdek** | Sürücüler, çekirdek modülleri | Rust for Linux, `no_std`, Rustonomicon |
| **Blokzincir** | Akıllı sözleşmeler, düğüm yazılımları | Solana programları, Polkadot SDK |

Bir alanı seçmenin en iyi yolu, o alanda **küçük ama bitmiş** bir proje yapmaktır. Bir hafta sonunda
`bevy` ile bir yılan oyunu, `axum` ile bir kısa link servisi, `embassy` ile bir LED'i yakıp söndüren
firmware. Hangisinden zevk aldığını ancak denerken anlarsın.

:::tip Python'cular için gizli kapı
`PyO3` ile yazdığın bir Rust fonksiyonunu, Python'dan normal bir modül gibi `import` edebilirsin. Python
projesinin yavaş bir döngüsünü Rust'a taşımak, Rust'ı iş yerinde kullanmaya başlamanın en kolay yoludur.
`polars` ve `pydantic-core` Python'a bu yolla ulaşıyor; `ruff` ve `uv` de Rust ile yazılıp `maturin` ile
pip paketi olarak dağıtılıyor.
:::

```quiz
question: |
  Mert, tarayıcıda çalışan bir görüntü filtreleme uygulamasının yavaş JavaScript kısmını Rust'a taşımak
  istiyor; geri kalan arayüz JavaScript'te kalacak. Hangi araç seti onun için doğru başlangıç?
options:
  - "`tokio` ve `axum`"
  - "`wasm-bindgen` ve `wasm-pack`"
  - "`embassy` ve `embedded-hal`"
  - "`PyO3` ve `maturin`"
answer: 1
explanation: |
  `wasm-bindgen`, Rust ile JavaScript arasındaki köprüyü kurar: Rust fonksiyonlarını JS'ten çağırmayı,
  JS nesnelerini Rust'tan kullanmayı sağlar. `wasm-pack` ise bunu bir npm paketi olarak derleyip
  paketler. Yalnızca hesaplama yoğun kısmı WebAssembly'ye taşımak, Rust'ı web ön yüzüne sokmanın en yaygın
  yoludur.
feedback:
  - Bunlar sunucu tarafı içindir; tarayıcıda çalışmaz.
  - Doğru!
  - Bunlar mikrodenetleyiciler içindir.
  - "`PyO3` Python ile köprü kurar, JavaScript ile değil."
```

## Açık kaynağa ilk katkın

Rust'ın kendisi, `cargo`, `clippy`, `rustfmt` ve bu derslerde kullandığın crate'lerin hepsi **açık
kaynak**. Bunların hepsini gönüllüler ve şirket destekli ekipler birlikte geliştiriyor. Katkı yapmak hem
öğrenmenin en hızlı yolu (deneyimli birinin kodunu incelemesi), hem de iş başvurularında en güçlü
referanstır.

İlk katkın için izleyeceğin yol:

1. **Kullandığın bir projeyi seç.** Hiç tanımadığın dev bir projeden çok, belgelerinde bir eksik
   gördüğün küçük bir crate daha iyidir.
2. **`good first issue` / `E-easy` etiketli issue'lara bak.** This Week in Rust bülteninin "Call for
   Participation" bölümü her hafta katkı bekleyen işleri listeler.
3. **`CONTRIBUTING.md`'yi oku**, issue'ya "Bunun üzerinde çalışmak istiyorum" diye yaz. Böylece iki
   kişinin aynı işi yapmasını önlersin.
4. **Küçük başla:** bir yazım hatası, eksik bir doc örneği, belirsiz bir hata mesajı. Doc testleri
   (Modül 13) bile değerli bir katkıdır.
5. **Göndermeden önce** Modül 25'teki CI listesini kendin çalıştır: `cargo fmt --check`,
   `cargo clippy -- -D warnings`, `cargo test`.
6. **İnceleme yorumlarını hediye gibi karşıla.** Bakımcının istediği değişiklik, birinin sana ücretsiz
   ders vermesidir.

Toplulukla bağ kurmak için: users.rust-lang.org forumu, Rust'ın Zulip sohbeti (derleyiciye katkı
için), yerel Rust buluşmaları ve RustConf / EuroRust / RustNation gibi konferansların ücretsiz
yayımlanan konuşmaları. Öğrendiğin bir şeyi Türkçe bir blog yazısıyla anlatmak da hem sana hem
topluluğa katkıdır.

```quiz
question: "İlk açık kaynak katkını yapmak istiyorsun. Aşağıdakilerden hangisi **en iyi** başlangıç stratejisidir?"
options:
  - Rust derleyicisinin borrow checker'ını yeniden yazan büyük bir PR göndermek
  - "Kullandığın bir crate'in `good first issue` etiketli bir issue'sunu üstlendiğini yazıp küçük bir PR göndermek; öncesinde `fmt`, `clippy` ve testleri çalıştırmak"
  - Haber vermeden, projede beğenmediğin her şeyi düzelten 40 dosyalık bir PR açmak
  - Önce Rust'ı tamamen öğrenip ancak ondan sonra katkıya başlamak
answer: 1
explanation: |
  Küçük, odaklı ve önceden konuşulmuş bir PR'ın kabul edilme şansı çok yüksektir ve sana inceleme deneyimi
  kazandırır. Büyük ve habersiz PR'ları incelemek bakımcıya ağır bir yük getirir; çoğu kapanır.
  "Tamamen öğrenmek" diye bir eşik yok: Belgelerdeki bir hatayı düzeltmek için bugün yeterince
  biliyorsun.
feedback:
  - Büyük değişiklikler önce bir RFC ya da tartışmayla başlar; ilk katkı için uygun değildir.
  - Doğru!
  - Habersiz ve kapsamı geniş PR'lar genelde incelenmeden kapanır.
  - Bu eşik hiçbir zaman gelmez; katkı yapmak öğrenmenin bir parçasıdır.
```

## 30-60-90 günlük planın

Hedefler ölçülebilir olmazsa "Rust çalışacağım" sözü birkaç hafta içinde unutulur. İşte üç evreli bir
plan. Kendi alanına ve zamanına göre uyarla:

| Evre | Günler | Hedef | Somut çıktı |
|---|---|---|---|
| **Pekiştirme** | 1-30 | Temelleri otomatikleştirmek | Rustlings'i bitir · Exercism'de 15 alıştırma ve mentor yorumu · her gün Rusteach `/tekrar` · `clap` + `serde` ile küçük bir CLI (ör. JSON tutan bir harcama takipçisi) |
| **Derinleşme** | 31-60 | Bir alanı seçip orta boy bir proje yapmak | Alanına göre bir proje (ör. `axum` + `sqlx` ile kütüphane API'si) · testler + CI · alanının kitabından en az 4 bölüm |
| **Paylaşma** | 61-90 | Öğrendiğini dünyaya açmak | Projeyi belgeleriyle GitHub'a ya da crates.io'ya koy · 1-3 açık kaynak katkı · öğrendiğin bir konuyu anlatan bir blog yazısı |

Planını bir dosyada tutup kendi aracınla izlemek tam bir Rustçı hareketi olur. Önce gün numarasını evreye
çeviren parça. Modül 21'deki aralık desenleriyle tek bir `match`:

```rust
#[derive(Debug)]
enum Evre {
    Pekistirme,
    Derinlesme,
    Paylasma,
}

fn evre(gun: u32) -> Option<Evre> {
    match gun {
        1..=30 => Some(Evre::Pekistirme),
        31..=60 => Some(Evre::Derinlesme),
        61..=90 => Some(Evre::Paylasma),
        _ => None, // 0. gün ya da 90'dan sonrası planın dışında
    }
}

fn main() {
    for gun in [1, 30, 31, 75, 91] {
        println!("{gun:>2}. gün → {:?}", evre(gun));
    }
}
```

Plan dosyasının her satırı `GÜN | SAAT | BAŞLIK` biçiminde olsun. Bir satırı çözen fonksiyonu tamamla:

```fill
prompt: "Bir plan satırını `(gün, saat)` çiftine çevir; biçim bozuksa ya da sayılar okunamıyorsa `None` döndür."
code: |
  fn satir_coz(satir: &str) -> Option<(u32, u32)> {
      let parcalar: Vec<&str> = satir.split('|').map(str::trim).collect();
      let [gun, saat, _baslik] = parcalar[..] ___0 {
          return None;
      };
      let gun = gun.parse::<u32>().___1()?;
      let saat = saat.parse::<u32>().ok()?;
      Some((gun, saat))
  }

  fn main() {
      println!("{:?}", satir_coz("12 | 2 | Rustlings"));
      println!("{:?}", satir_coz("12 | iki | Rustlings"));
      println!("{:?}", satir_coz("12 | 2"));
  }
blanks:
  - ["else"]
  - ["ok"]
output: |
  Some((12, 2))
  None
  None
explanation: |
  `let [a, b, c] = dilim[..] else { ... };` bir let-else (Modül 7) ile dilim desenini (Modül 21)
  birleştirir: Tam 3 parça yoksa erken döner. `parse` bir `Result` döndürür; `.ok()` onu `Option`'a
  çevirir ve `?` (Modül 10) `None` gelirse fonksiyondan çıkar. `map(str::trim)` ise closure yerine bir
  fonksiyon yolunun (Modül 22) doğrudan geçirildiği küçük bir inceliktir.
```

Şimdi her şeyi birleştir. Bu alıştırma yolculuğunun neredeyse bütün modüllerinden bir parça istiyor:

```exercise
title: 90 günlük plan özeti
difficulty: 4
prompt: |
  `plan_ozeti(girdi)` fonksiyonunu yaz. Fonksiyon bir plan metnini okuyup **her evrenin toplam çalışma
  saatini** bir `BTreeMap<Evre, u32>` içinde döndürsün. Önce `evre(gun)` fonksiyonunu da tamamla
  (1-30 `Pekistirme`, 31-60 `Derinlesme`, 61-90 `Paylasma`, diğerleri `None`).

  Kurallar:
  - Satırlar 1'den numaralanır. **Boş** (yalnızca boşluk da olabilir) ve `#` ile başlayan satırlar atlanır,
    ama satır numarasına **sayılır**.
  - Her görev satırı `|` ile ayrılmış tam **3** parçadır (parçaların başındaki ve sonundaki boşlukları at).
    Değilse → `PlanHatasi::Bicim { satir }`.
  - Gün bir sayı değilse ya da 1-90 aralığında değilse → `GecersizGun { satir }`.
  - Saat bir sayı değilse ya da 1-8 aralığında değilse → `GecersizSaat { satir }`.
  - Kontroller bu sırayla yapılır ve **ilk hatalı satırda** durulur.
  - Hiç görevi olmayan evre haritada yer almaz.
starter: |
  use std::collections::BTreeMap;

  #[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Clone, Copy)]
  enum Evre {
      Pekistirme,
      Derinlesme,
      Paylasma,
  }

  #[derive(Debug, PartialEq)]
  enum PlanHatasi {
      Bicim { satir: usize },
      GecersizGun { satir: usize },
      GecersizSaat { satir: usize },
  }

  fn evre(gun: u32) -> Option<Evre> {
      todo!()
  }

  fn plan_ozeti(girdi: &str) -> Result<BTreeMap<Evre, u32>, PlanHatasi> {
      todo!()
  }

  fn main() {
      let plan = "# 90 günlük Rust planım
  1 | 2 | Rustlings: değişkenler
  15 | 3 | Exercism: 5 alıştırma
  40 | 4 | axum ile kütüphane API'si
  75 | 2 | İlk açık kaynak PR'ım";
      match plan_ozeti(plan) {
          Ok(ozet) => {
              for (evre, saat) in &ozet {
                  println!("{evre:?}: {saat} saat");
              }
          }
          Err(e) => println!("plan hatalı: {e:?}"),
      }
  }
solution: |
  use std::collections::BTreeMap;

  #[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Clone, Copy)]
  enum Evre {
      Pekistirme,
      Derinlesme,
      Paylasma,
  }

  #[derive(Debug, PartialEq)]
  enum PlanHatasi {
      Bicim { satir: usize },
      GecersizGun { satir: usize },
      GecersizSaat { satir: usize },
  }

  fn evre(gun: u32) -> Option<Evre> {
      match gun {
          1..=30 => Some(Evre::Pekistirme),
          31..=60 => Some(Evre::Derinlesme),
          61..=90 => Some(Evre::Paylasma),
          _ => None,
      }
  }

  fn plan_ozeti(girdi: &str) -> Result<BTreeMap<Evre, u32>, PlanHatasi> {
      let mut ozet = BTreeMap::new();
      for (i, satir) in girdi.lines().enumerate() {
          let satir_no = i + 1;
          let satir = satir.trim();
          if satir.is_empty() || satir.starts_with('#') {
              continue;
          }
          let parcalar: Vec<&str> = satir.split('|').map(str::trim).collect();
          let [gun, saat, _baslik] = parcalar[..] else {
              return Err(PlanHatasi::Bicim { satir: satir_no });
          };
          let evre = gun
              .parse::<u32>()
              .ok()
              .and_then(evre)
              .ok_or(PlanHatasi::GecersizGun { satir: satir_no })?;
          let saat = match saat.parse::<u32>() {
              Ok(s @ 1..=8) => s,
              _ => return Err(PlanHatasi::GecersizSaat { satir: satir_no }),
          };
          *ozet.entry(evre).or_insert(0) += saat;
      }
      Ok(ozet)
  }

  fn main() {
      let plan = "# 90 günlük Rust planım
  1 | 2 | Rustlings: değişkenler
  15 | 3 | Exercism: 5 alıştırma
  40 | 4 | axum ile kütüphane API'si
  75 | 2 | İlk açık kaynak PR'ım";
      match plan_ozeti(plan) {
          Ok(ozet) => {
              for (evre, saat) in &ozet {
                  println!("{evre:?}: {saat} saat");
              }
          }
          Err(e) => println!("plan hatalı: {e:?}"),
      }
  }
check: tests
tests: |
  #[test]
  fn evre_sinirlari() {
      assert_eq!(evre(1), Some(Evre::Pekistirme));
      assert_eq!(evre(30), Some(Evre::Pekistirme), "30. gün hâlâ pekiştirme evresi");
      assert_eq!(evre(31), Some(Evre::Derinlesme));
      assert_eq!(evre(60), Some(Evre::Derinlesme));
      assert_eq!(evre(61), Some(Evre::Paylasma));
      assert_eq!(evre(90), Some(Evre::Paylasma));
      assert_eq!(evre(0), None, "0. gün yoktur");
      assert_eq!(evre(91), None, "plan 90 gün sürer");
  }

  #[test]
  fn saatler_evrelere_gore_toplanir() {
      let plan = "3 | 2 | Rustlings\n29 | 1 | Exercism\n45 | 4 | axum projesi\n31 | 3 | sqlx\n";
      let ozet = plan_ozeti(plan).unwrap();
      let beklenen = BTreeMap::from([(Evre::Pekistirme, 3), (Evre::Derinlesme, 7)]);
      assert_eq!(ozet, beklenen, "görevi olmayan evre (Paylasma) haritada hiç olmamalı");
  }

  #[test]
  fn yorum_ve_bos_satirlar_atlanir_ama_sayilir() {
      let plan = "# başlık\n\n   \n10 | 2 | Rustlings\n70 | 5 | blog yazısı\n#son";
      let ozet = plan_ozeti(plan).unwrap();
      assert_eq!(ozet.get(&Evre::Paylasma), Some(&5));
      let hatali = "# başlık\n\n10 | 2 | Rustlings\n10 ; 2 ; noktalı virgül";
      assert_eq!(
          plan_ozeti(hatali),
          Err(PlanHatasi::Bicim { satir: 4 }),
          "satır numarası yorum ve boş satırlar dahil 1'den sayılmalı"
      );
  }

  #[test]
  fn bicim_ve_gun_hatalari() {
      assert_eq!(plan_ozeti("10 | 2"), Err(PlanHatasi::Bicim { satir: 1 }), "3 parça olmalı");
      assert_eq!(plan_ozeti("1 | 1 | a | b"), Err(PlanHatasi::Bicim { satir: 1 }), "4 parça da bozuk");
      assert_eq!(plan_ozeti("1 | 1 | a\n0 | 2 | sıfırıncı gün"), Err(PlanHatasi::GecersizGun { satir: 2 }));
      assert_eq!(plan_ozeti("91 | 2 | fazla"), Err(PlanHatasi::GecersizGun { satir: 1 }));
      assert_eq!(plan_ozeti("on | 2 | yazıyla"), Err(PlanHatasi::GecersizGun { satir: 1 }), "gün bir sayı olmalı");
  }

  #[test]
  fn saat_hatalari_ve_ilk_hata_kazanir() {
      assert_eq!(plan_ozeti("5 | 0 | hiç"), Err(PlanHatasi::GecersizSaat { satir: 1 }), "0 saat geçersiz");
      assert_eq!(plan_ozeti("5 | 9 | çok"), Err(PlanHatasi::GecersizSaat { satir: 1 }), "günde en fazla 8 saat");
      assert_eq!(plan_ozeti("5 | 8 | tam sınır"), Ok(BTreeMap::from([(Evre::Pekistirme, 8)])));
      assert_eq!(
          plan_ozeti("0 | 99 | iki hata birden\n5 | x | y"),
          Err(PlanHatasi::GecersizGun { satir: 1 }),
          "önce gün kontrol edilir ve ilk hatalı satırda durulur"
      );
  }
hints:
  - "`for (i, satir) in girdi.lines().enumerate()` ile dön; satır numarası `i + 1`. `satir.trim()` boşsa ya da `#` ile başlıyorsa `continue`."
  - "Parçalar için `fill` alıştırmasındaki let-else'i kullan. Gün için `gun.parse::<u32>().ok().and_then(evre)` bir `Option<Evre>` verir; `.ok_or(PlanHatasi::GecersizGun { satir: satir_no })?` ile hataya çevir."
  - "Saat için `match saat.parse::<u32>() { Ok(s @ 1..=8) => s, _ => return Err(...) }`. Toplama: `*ozet.entry(evre).or_insert(0) += saat;`"
explanation: |
  Bu çözüm küçük ama yolculuğun bir özeti gibi:

  - **Enum + derive** (Modül 6, 7): `Evre`'nin `Ord` türetmesi `BTreeMap`'in anahtarı olabilmesini ve
    evrelerin **tanım sırasıyla** listelenmesini sağlar.
  - **`match` aralıkları ve `@` bağlaması** (Modül 21): `Ok(s @ 1..=8)` hem aralığı denetler hem değeri bağlar.
  - **`Option` ↔ `Result` köprüsü** (Modül 10): `.ok()`, `.and_then(evre)`, `.ok_or(...)?` zinciri üç ayrı
    hata durumunu (sayı değil, aralık dışı, ...) tek bir okunaklı satırda topluyor. `and_then(evre)`
    fonksiyonu doğrudan geçiriyor (Modül 22).
  - **entry API** (Modül 9): `entry(evre).or_insert(0)` "varsa al, yoksa sıfırla" işini tek aramayla yapar.
  - **let-else ve dilim deseni** (Modül 7, 21): biçim denetimini bir satıra indiriyor.

  Daha da ileri götürmek istersen: `PlanHatasi` için `Display` ve `std::error::Error` uygula (ya da
  `thiserror`, Modül 25), dosyayı `std::fs::read_to_string` ile oku, `clap` ile bir `--evre` filtresi ekle ve
  sonucu `serde_json` ile yazdır. İşte 30 günlük planın ilk CLI projesi!
```

## Final: Özet ve kutlama

:::remember
- **Kaynaklar:** the Book ve Rust by Example (temel) → Rustlings ve Exercism (pratik) → Rust for Rustaceans,
  Rust Atomics and Locks, Async Book (derinlik) → Rustonomicon (`unsafe`'ten önce) → Zero To Production (backend).
- **Alan seç, küçük ama bitmiş bir proje yap:** backend (`axum`), CLI (`clap`), gömülü (`embassy`), WASM
  (`wasm-bindgen`), oyun (`bevy`), veri (`polars`, `PyO3`).
- **Açık kaynak:** `good first issue` → issue'ya yaz → küçük PR → `fmt` + `clippy` + `test` → incelemeden öğren.
- **30-60-90:** Pekiştir (Rustlings, Exercism, küçük CLI) → Derinleş (alan + orta proje + CI) → Paylaş
  (yayınla, katkı yap, yaz).
- Takıldığında: derleyici mesajını **sonuna kadar** oku, `rustc --explain`, std belgeleri, sonra topluluk.
:::

Son bir şey: Bu uygulamanın `/tekrar` bölümü sen burada olmasan da çalışmaya devam ediyor. Bilgi kartların
aralıklı tekrar takviminde. Haftada birkaç kez uğramak, öğrendiklerinin kalıcı olmasının en ucuz yolu.

```reflect
prompt: |
  Bütün yolculuğuna bak. Seni en çok zorlayan kavram hangisiydi ve onu ne zaman "anladım" dedin? Şimdi
  sıfırdan başlayan bir arkadaşına Rust öğrenirken tek bir tavsiye verecek olsan ne derdin?
answer: |
  Örnek cevap: Beni en çok sahiplik ve yaşam süreleri zorladı. Borrow checker'ı bir düşman gibi gördüğüm
  dönemde her hata beni sinirlendiriyordu. Hatanın aslında bir hatayı **önlediğini** (ör. bir
  vektöre eleman eklerken eski referansın geçersizleşmesini) bellek diyagramında gördüğümde anladım.
  Arkadaşıma tavsiyem: "Derleyiciyle kavga etme, onu oku. Hata mesajındaki her etiket bir hikâye anlatır;
  tahmin et, çalıştır, yanılırsan nedenini bul. Her gün az ama düzenli çalış."
```

```flashcards
- front: "`unsafe` kod yazmadan önce okunması önerilen resmî kitap hangisidir?"
  back: The Rustonomicon (yanında Miri ile `cargo miri test`).
- front: "Terminalde derleyici hatalarını düzelterek ilerlenen küçük Rust alıştırmalarının adı nedir?"
  back: Rustlings.
- front: "Gerçek mentorlardan kod incelemesi alabileceğin Rust alıştırma platformu hangisidir?"
  back: Exercism (Rust yolu).
- front: Orta seviyeden ileri seviyeye geçmek için yazılmış, Jon Gjengset'in kitabının adı nedir?
  back: Rust for Rustaceans.
- front: "Rust ile bir Python modülü yazmak için hangi araçlar kullanılır?"
  back: "`PyO3` (bağlama) ve `maturin` (derleme ve paketleme)."
- front: "Tarayıcıda çalışacak Rust kodu ile JavaScript arasındaki köprüyü hangi crate kurar?"
  back: "`wasm-bindgen` (paketlemek için `wasm-pack`; tam ön yüz için `leptos`/`yew`)."
- front: Açık kaynağa ilk katkı için hangi etiketli issue'lar aranır ve PR'dan önce hangi üç komut çalıştırılır?
  back: "`good first issue` / `E-easy`; `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`."
- front: 30-60-90 günlük planın üç evresi nedir?
  back: "Pekiştirme (temeller ve pratik) → Derinleşme (alan seç, orta boy proje) → Paylaşma (yayınla, katkı yap, yaz)."
```

:::ferris
Yolculuğun başında borrow checker sana bir engel gibi görünmüş olabilir. Umarım artık bir yol arkadaşıdır. Bu
uygulamadan mezun oldun, ama Rust maceran yeni başlıyor. Bir gün bir crate'inin README'sinde ya da bir
PR'ında karşılaşırsak, bana "Merhaba!" demeyi unutma. 🦀🏆
:::
