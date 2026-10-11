---
id: m07-l01
title: "Enum'lar: bir değer, birçok olasılık"
minutes: 20
type: lesson
objectives:
  - Verisiz, tuple benzeri ve struct benzeri varyantları olan bir `enum` tanımlayıp değerlerini oluşturabilmek
  - Bir veriyi struct ile mi enum ile mi modellemen gerektiğine "ve / veya" sorusuyla karar verebilmek
  - Varyantların içindeki veriye desenlerle ulaşıp bir enum'a `impl` bloğuyla metot ekleyebilmek
  - Bir enum değerinin bellekte etiket ve veri olarak nasıl tutulduğunu açıklayabilmek
keywords: [enum, varyant, variant, impl, IpAdresi, Mesaj, OyunKomutu, toplam tipi]
---

Modül 6'da struct'larla bir öğrencinin adını **ve** numarasını **ve** not ortalamasını tek bir tipte
topladın. Ama dünya yalnızca "ve"lerden oluşmuyor: bir trafik ışığı kırmızı **veya** sarı **veya**
yeşildir; bir ödeme nakit **veya** kartla **veya** havaleyle yapılır. Bu derste "veya"yı modellemenin
Rust'taki yolunu öğreneceksin: **enum (numaralandırma, enumeration)**.

Rust'ın enum'ları, C veya Java'dan tanıyor olabileceğin enum'lardan çok daha güçlüdür: her seçenek kendi
verisini taşıyabilir. Modülün sonunda Rust programcılarının neden enum'ları dilin en sevilen özelliklerinden
biri saydığını göreceksin.

:::ferris
Aslında enum'larla tanıştın bile! Modül 3'teki sayı tahmin oyununda gördüğün `Ordering::Less`,
`Ordering::Greater` ve `Ordering::Equal`, standart kütüphanedeki bir enum'un varyantlarıydı. 🦀
:::

## Sınırlı seçenekler: ilk enum'un

Bir oyun karakterinin yönünü saklamak istiyorsun. İlk akla gelen, yönü bir metin olarak tutmak:

```rust
fn main() {
    let yon = "kuzye"; // yazım hatası! derleyici fark etmez
    if yon == "kuzey" {
        println!("Yukarı gidiyoruz");
    } else {
        println!("Bilinmeyen yön: {yon}");
    }
}
```

Derleyici `"kuzye"` hatasını yakalayamaz, çünkü her metin geçerli bir `&str`'dir. Yönü sayıyla kodlamak
(0 = kuzey, 1 = güney...) da aynı derde sahip: `let yon = 7;` hangi yön? Aslında söylemek istediğimiz şey
şu: **"yön, şu dört şeyden biridir, başka hiçbir şey değil."** İşte enum tam olarak bunu söyler:

```rust
#[derive(Debug)]
enum Yon {
    Kuzey,
    Guney,
    Dogu,
    Bati,
}

fn main() {
    let gidis = Yon::Kuzey;
    let donus = Yon::Guney;
    println!("Gidiş: {gidis:?}, dönüş: {donus:?}");

    let pusula = [Yon::Kuzey, Yon::Dogu, Yon::Guney, Yon::Bati];
    println!("Pusula: {pusula:?}");
}
```

- `enum Yon { ... }` yeni bir **tip** tanımlar. Tip adı ve seçeneklerin adları `UpperCamelCase` yazılır.
- Her seçeneğe **varyant (variant)** denir. `Yon` tipinde bir değer, bu dört varyanttan **tam olarak biridir**.
- Bir varyanta `Yon::Kuzey` diye, tip adı ve `::` ile ulaşırsın. Varyantlar enum'un **ad alanında
  (namespace)** yaşar, tıpkı Modül 6'daki `String::from` gibi.
- `gidis`, `donus` ve dizideki her eleman **aynı tiptedir**: `Yon`. Bu yüzden aynı diziye konabilirler.

Artık yazım hatası derleme hatasıdır. `Yon::Kuzye` yazarsan Rust hem hatayı yakalar hem de doğrusunu önerir:

:::error
```text
error[E0599]: no variant, associated function, or constant named `Kuzye` found for enum `Yon` in the current scope
  --> src/main.rs:10:22
   |
 2 | enum Yon {
   | -------- variant, associated function, or constant `Kuzye` not found for this enum
...
10 |     let gidis = Yon::Kuzye;
   |                      ^^^^^ variant, associated function, or constant not found in `Yon`
   |
help: there is a variant with a similar name
   |
10 -     let gidis = Yon::Kuzye;
10 +     let gidis = Yon::Kuzey;
```
"`Yon` içinde `Kuzye` diye bir şey yok; benzer adlı bir varyant var: `Kuzey`." Metinle çalışırken bu hata
ancak program yanlış davrandığında, belki aylar sonra fark edilirdi.
:::

:::analogy Optik form
Sınavlardaki optik formu düşün: her soru için A–E şıklarından **tam olarak birini** işaretlersin. "F"
diye bir şık yoktur; iki şıkkı birden işaretlemek de geçersizdir. Enum, tipine böyle bir şık listesi
verir ve derleyici, optik okuyucu gibi, listede olmayan hiçbir değeri kabul etmez.
:::

C'deki `enum` aslında kılık değiştirmiş bir tamsayıdır: `int x = KUZEY + 7;` ya da `enum Yon y = 42;`
yazabilirsin. Rust'ta `Yon` bir sayı değildir; dört varyanttan başka bir değer alamaz. Peki iki yönü
karşılaştırmak? Tahmin et:

```compiles
code: |
  #[derive(Debug)]
  enum Yon {
      Kuzey,
      Guney,
      Dogu,
      Bati,
  }

  fn main() {
      let y = Yon::Kuzey;
      if y == Yon::Kuzey {
          println!("kuzeye gidiyoruz");
      }
  }
answer: false
error: E0369
explanation: |
  Derlenmez: **E0369** - *binary operation `==` cannot be applied to type `Yon`*. Rust, senin tanımladığın
  bir tipin nasıl karşılaştırılacağını kendiliğinden varsaymaz; eşitlik, tipe açıkça kazandırılan bir
  yetenektir. Derleyici çözümü de söyler: *consider annotating `Yon` with `#[derive(PartialEq)]`*.
  `PartialEq`'i trait'leri öğrenince (Modül 11) ayrıntılı göreceğiz. Bir enum'un hangi varyant olduğunu
  sormanın asıl aracı ise bir sonraki adımda: `match`.
```

:::deep C tarzı enum'lar: sayı karşılıkları ve `as`
Hiçbir varyantı veri taşımayan bir enum'da her varyantın arka planda bir tamsayı karşılığı
(**ayırt edici, discriminant**) vardır: varsayılan olarak 0'dan başlar ve birer artar. İstersen değerleri
kendin de verebilir, Modül 2'deki `as` ile varyantı sayıya çevirebilirsin:

```rust
# #![allow(dead_code)]
enum Gun {
    Pazartesi, // 0
    Sali,      // 1
    Carsamba,  // 2
}

enum HttpDurum {
    Tamam = 200,
    Bulunamadi = 404,
    SunucuHatasi = 500,
}

fn main() {
    println!("{}", Gun::Carsamba as i32);         // 2
    println!("{}", HttpDurum::Bulunamadi as u16); // 404
}
```

İki önemli sınır var:

- Dönüşüm **tek yönlüdür**: `404 as HttpDurum` diye bir şey yoktur, çünkü örneğin 403'ün karşılığı olan
  bir varyant yok. Sayıdan enum'a güvenli dönüşümü bir `match` ile (ya da Modül 11'deki `TryFrom` ile)
  yazar, tanınmayan sayılar için "sonuç yok" döndürürsün (bunun aracı bir sonraki dersin konusu).
- Varyantlardan biri bile veri taşıyorsa (`Yaz(String)` gibi) `as` ile sayıya çeviremezsin.

Bu özellik C kütüphaneleriyle, dosya biçimleriyle ve ağ protokolleriyle konuşurken işe yarar. Sıradan Rust
kodunda varyantlara sayı gibi davranmak nadiren gerekir: enum'un gücü zaten sayılardan bağımsız olmasıdır.
:::

## Hangi varyant? match'e ilk bakış

Bir enum değerini aldın; şimdi hangi varyant olduğuna göre farklı bir şey yapmak istiyorsun. Bunun Rust'taki
yolu `match` ifadesidir. Sayı tahmin oyununda kısaca görmüştün; şimdi biraz daha yakından bakalım:

```rust
enum Yon {
    Kuzey,
    Guney,
    Dogu,
    Bati,
}

fn adim(yon: Yon) -> (i32, i32) {
    match yon {
        Yon::Kuzey => (0, 1),
        Yon::Guney => (0, -1),
        Yon::Dogu => (1, 0),
        Yon::Bati => (-1, 0),
    }
}

fn main() {
    let rota = [Yon::Kuzey, Yon::Kuzey, Yon::Dogu, Yon::Guney, Yon::Bati, Yon::Dogu];
    let mut x = 0;
    let mut y = 0;
    for yon in rota {
        let (dx, dy) = adim(yon);
        x += dx;
        y += dy;
    }
    println!("Son konum: ({x}, {y})");
}
```

- `match yon { ... }`: "`yon`'un değerine bak ve uyan kolu çalıştır."
- `Yon::Kuzey => (0, 1),` satırlarının her birine **kol (arm)** denir. `=>` işaretinin solunda bir
  **desen (pattern)**, sağında bir ifade vardır.
- Kollar yukarıdan aşağıya denenir; ilk uyan kolun ifadesi çalışır.
- `match` bir **ifadedir**, bir değer üretir: Modül 3'te `if`'in bir ifade olabildiğini görmüştün.
  Burada `match`'in ürettiği tuple, fonksiyonun dönüş değeri oluyor.

`match`'in bütün inceliklerini (unutulan varyantlar, `_`, aralıklar...) bu modülün 3. dersinde
öğreneceksin. Şimdilik "hangi varyant olduğuna bak, ona göre davran" demesi yeterli.

Aşağıdaki fonksiyonun dönüş tipi `&'static str`: Modül 4'ten hatırla, programın içine gömülü bir metin
literalinin tipi budur.

```predict
code: |
  enum Isik {
      Kirmizi,
      Sari,
      Yesil,
  }

  fn eylem(isik: Isik) -> &'static str {
      match isik {
          Isik::Kirmizi => "dur",
          Isik::Sari => "hazırlan",
          Isik::Yesil => "geç",
      }
  }

  fn main() {
      let once = eylem(Isik::Yesil);
      let sonra = eylem(Isik::Kirmizi);
      println!("{once}, sonra {sonra}");
  }
options:
  - "geç, sonra dur"
  - "Yesil, sonra Kirmizi"
  - "dur, sonra geç"
  - "Derlenmez"
answer: 0
explanation: |
  `eylem(Isik::Yesil)` çağrısında `match`, `Isik::Yesil` kolunu bulur ve `"geç"` döndürür;
  `Isik::Kirmizi` için `"dur"` döner. Yazdırılan şey varyantın adı değil, kolun sağındaki değerdir.

  Program derlenir. `Isik::Sari` hiç oluşturulmadığı için derleyici bir **uyarı** verir
  (*variant `Sari` is never constructed*); ama Modül 1'den bildiğin gibi uyarılar derlemeyi durdurmaz.
```

## Varyantlar veri taşıyabilir

Şimdi Rust enum'larını özel kılan kısma geldik. Bir ağ adresini düşün: ya **IPv4**'tür (dört sayı:
`127.0.0.1`) ya da **IPv6**'dır (uzun bir metin: `::1`). Modül 6'daki bilgilerinle ilk denemen şöyle olabilir:

```rust
#[derive(Debug)]
enum IpTuru {
    V4,
    V6,
}

struct IpAdresi {
    tur: IpTuru,
    adres: String,
}

fn main() {
    let ev = IpAdresi { tur: IpTuru::V4, adres: String::from("127.0.0.1") };
    // V6 dedik ama adres bir V4 adresi! Derleyici itiraz etmiyor.
    let tuhaf = IpAdresi { tur: IpTuru::V6, adres: String::from("127.0.0.1") };
    println!("{:?} -> {}", ev.tur, ev.adres);
    println!("{:?} -> {}", tuhaf.tur, tuhaf.adres);
}
```

İki sorun var: `tur` ile `adres` birbiriyle **çelişebilir** ve dört küçük sayı gereksiz yere metin olarak
saklanıyor. Rust'ta veriyi doğrudan varyantın içine koyabilirsin:

```rust
# #[allow(dead_code)]
#[derive(Debug)]
enum IpAdresi {
    V4(u8, u8, u8, u8),
    V6(String),
}

fn main() {
    let ev = IpAdresi::V4(127, 0, 0, 1);
    let geri_donus = IpAdresi::V6(String::from("::1"));
    println!("{ev:?}");
    println!("{geri_donus:?}");
}
```

Artık "V6 ama içinde dört sayı" diye bir değer **yazılamaz**. Her varyantın içinde farklı tipte ve sayıda
veri olabilir. Varyant adı bir kurucu fonksiyon gibi davranır: `IpAdresi::V4` dört `u8` alır ve bir
`IpAdresi` döndürür. (Standart kütüphanedeki `std::net::IpAddr` de aynı fikirle kurulmuştur: iki varyantı
vardır, `V4` ve `V6`; ama varyantların içinde dört sayı ya da bir metin değil, bu iş için yazılmış iki
struct durur: `V4(Ipv4Addr)` ve `V6(Ipv6Addr)`. Yani bir varyantın içine her tür veri, başka bir struct
ya da enum bile konabilir.)

Bir enum'da üç tür varyant olabilir; üçü de Modül 6'daki struct türlerine karşılık gelir:

```rust
# #[allow(dead_code)]
enum Mesaj {
    Cik,                      // verisiz
    Tasi { x: i32, y: i32 },  // struct benzeri: isimli alanlar
    Yaz(String),              // tuple benzeri: tek bir String
    RenkDegistir(u8, u8, u8), // tuple benzeri: üç u8
}
```

| Varyant | Benzediği struct (Modül 6) | Değer oluşturma |
|---|---|---|
| `Cik` | birim struct: `struct Cik;` | `Mesaj::Cik` |
| `Tasi { x: i32, y: i32 }` | isimli alanlı struct | `Mesaj::Tasi { x: 10, y: -3 }` |
| `Yaz(String)` | tuple struct | `Mesaj::Yaz(String::from("selam"))` |

Farkı şu: dört ayrı struct tanımlasaydın dört ayrı **tip** olurdu ve "herhangi bir mesajı" alan tek bir
fonksiyon yazamazdın. Enum'da hepsi tek bir tiptir: `Mesaj`.

:::analogy Kargo gönderi formu
Kargo şubesindeki formda önce gönderi türünü işaretlersin: mektup, koli ya da palet. Doldurman gereken
alanlar seçtiğin türe göre değişir: mektup için ek bilgi yok, koli için ağırlık, palet için ağırlık ve
sigorta. Türü işaretlenmemiş ya da "mektup ama palet sigortalı" gibi tutarsız bir form kabul edilmez.
Enum varyantları da böyledir: **önce tür, sonra o türe özgü veri.**
:::

Bellekte bir enum değeri, hangi varyant olduğunu söyleyen bir **etiket (tag)** ile o varyantın verisinden
oluşur. Bütün varyantlar aynı boyutta bir "kutuya" konur:

```memory
title: Üç `Mesaj` değeri, aynı boyutta üç kutu
steps:
  - caption: "`let a = Mesaj::Cik;`, etiket `Cik` diyor; veri alanı ayrılmış ama boş."
    stack:
      - frame: main
        vars:
          - { name: a, type: Mesaj, value: "etiket: Cik │ (boş)" }
  - caption: "`let b = Mesaj::Tasi { x: 10, y: -3 };`, aynı boyutta bir kutu; etiket `Tasi`, içinde iki `i32`."
    stack:
      - frame: main
        vars:
          - { name: a, type: Mesaj, value: "etiket: Cik │ (boş)" }
          - { name: b, type: Mesaj, value: "etiket: Tasi │ x=10 · y=-3" }
  - caption: "`let c = Mesaj::Yaz(String::from(\"Merhaba\"));`, etiket `Yaz`; String'in işaretçisi, uzunluğu ve kapasitesi kutunun içinde, harfler heap'te."
    stack:
      - frame: main
        vars:
          - { name: a, type: Mesaj, value: "etiket: Cik │ (boş)" }
          - { name: b, type: Mesaj, value: "etiket: Tasi │ x=10 · y=-3" }
          - { name: c, type: Mesaj, value: "etiket: Yaz │ ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "M e r h a b a" }
```

:::deep Etiket gerçekte nerede duruyor?
Genel kural: bir enum değeri **en büyük varyantın sığacağı kadar yer + etiket** kaplar. Böylece bütün
varyantlar aynı boyutta olur ve yan yana bir diziye dizilebilir.

Ama derleyici akıllıdır: verinin asla alamayacağı bit desenleri varsa (örneğin bir `String`'in içindeki
bazı alanlar bazı değerleri hiçbir zaman alamaz), etiketi o "imkânsız" değerlerin içine gizler. Buna
**niş optimizasyonu (niche optimization)** denir. Sonuçta `Mesaj`, 64 bit bir sistemde tam bir `String`
kadar yer kaplar. Bu bir derleyici optimizasyonudur: `Option<&T>` gibi belgelenmiş birkaç durum dışında
kesin bir bellek düzeni **garanti edilmez**, bu yüzden kodunu belirli bir boyuta güvenerek yazma. Bellek
düzenini Modül 24'te derinlemesine inceleyeceğiz.

```rust
# #[allow(dead_code)]
enum Mesaj { Cik, Tasi { x: i32, y: i32 }, Yaz(String), RenkDegistir(u8, u8, u8) }
# #[allow(dead_code)]
enum Yon { Kuzey, Guney, Dogu, Bati }

fn main() {
    // Yorumdaki değerler 64 bit bir sistem içindir
    println!("Yon:    {} bayt", std::mem::size_of::<Yon>());    // 1
    println!("String: {} bayt", std::mem::size_of::<String>()); // 24
    println!("Mesaj:  {} bayt", std::mem::size_of::<Mesaj>());  // 24
}
```

Pratikte bilinmesi gereken bir sonuç: kutunun boyutunu **en büyük** varyant belirlediği için tek bir dev
varyant, küçük varyantlardaki değerleri de büyütür. Clippy bunu `large_enum_variant` uyarısıyla yakalar;
çözümü (büyük veriyi `Box` ile heap'e koymak) Modül 17'de göreceksin.
:::

```quiz
question: "`let a = Mesaj::Cik;` ve `let b = Mesaj::Yaz(String::from(\"çok uzun bir metin\"));` için hangisi doğrudur?"
options:
  - "`a` bellekte hiç yer kaplamaz, `b` ise metnin uzunluğu kadar yer kaplar"
  - "İkisi de aynı tiptedir (`Mesaj`) ve stack'te aynı boyutta yer kaplar; metnin karakterleri heap'tedir"
  - "İkisi farklı tiplerdir, bu yüzden aynı diziye konamazlar"
answer: 1
explanation: |
  Her `Mesaj` değeri aynı boyuttaki bir kutudur: etiket + en büyük varyantın verisi. `Yaz` varyantının
  kutusunda yalnızca String'in "başlığı" (işaretçi, uzunluk, kapasite) durur; metin ne kadar uzun olursa
  olsun karakterler heap'tedir (Modül 4). Aynı tip ve aynı boyut sayesinde farklı varyantlar bir dizide
  yan yana durabilir.
feedback:
  - "Verisiz varyant da kutunun tamamını kaplar; kutular varyanta göre küçülüp büyümez."
  - "Doğru! Tip aynı, boyut aynı; değişken uzunluktaki veri heap'te."
  - "Varyantlar ayrı tipler değildir; hepsi `Mesaj` tipinin değerleridir."
```

## Veriye ulaşmak: nokta değil, desen

Struct'larda bir alana `nokta.x` diye ulaşıyordun. Bir enum değeri için de aynısını dene:

```compiles
code: |
  enum Mesaj {
      Cik,
      Tasi { x: i32, y: i32 },
  }

  fn main() {
      let m = Mesaj::Tasi { x: 3, y: 4 };
      println!("x = {}", m.x);
  }
answer: false
error: E0609
explanation: |
  Derlenmez: **E0609** - *no field `x` on type `Mesaj`*. `m`'nin tipi `Mesaj`'dır ve `Mesaj` tipinin
  `x` diye bir alanı yoktur: `x` yalnızca `Tasi` varyantında vardır. Derleyici açısından `m` pekâlâ
  `Cik` de olabilirdi. Bu yüzden önce **hangi varyant olduğunu kontrol etmen** gerekir - o da `match`'in işi.
```

Derleyici haklı: `m`'nin tipi yalnızca "bir `Mesaj`" olduğunu söyler, hangi varyant olduğunu değil. Varyantın
içindeki veriye **desenle (pattern)** ulaşırsın. Desen hem varyantı kontrol eder hem de içindeki değerleri
yeni değişkenlere **bağlar (binding)**:

```rust
enum Mesaj {
    Cik,
    Tasi { x: i32, y: i32 },
    Yaz(String),
    RenkDegistir(u8, u8, u8),
}

fn isle(m: Mesaj) {
    match m {
        Mesaj::Cik => println!("Program kapanıyor"),
        Mesaj::Tasi { x, y } => println!("({x}, {y}) noktasına git"),
        Mesaj::Yaz(metin) => println!("Ekrana yaz: {metin}"),
        Mesaj::RenkDegistir(r, g, b) => println!("Yeni renk: rgb({r}, {g}, {b})"),
    }
}

fn main() {
    isle(Mesaj::Tasi { x: 10, y: -3 });
    isle(Mesaj::Yaz(String::from("Merhaba")));
    isle(Mesaj::RenkDegistir(255, 128, 0));
    isle(Mesaj::Cik);
}
```

- `Mesaj::Tasi { x, y }`: "`m` bir `Tasi` ise, içindeki `x` ve `y` alanlarını aynı adlı değişkenlere bağla."
- `Mesaj::Yaz(metin)`: tuple benzeri varyantta değerler sırayla bağlanır; adı sen seçersin.
- Bağlanan değişkenler yalnızca o kolun içinde geçerlidir.

Bu tasarım bir güvenlik garantisidir: varyantın verisine **ancak desen etiketi kontrol ettikten sonra**
ulaşabilirsin. C'deki `union`'larda yanlış alanı okumak hiçbir uyarı vermeden baytları başka bir tipmiş
gibi yorumlar ve anlamsız bir değer üretir (C++'ta bu düpedüz tanımsız davranıştır). Güvenli Rust'ta böyle
bir kodu yazmanın yolu bile yoktur.

```fill
prompt: "Desenleri tamamla: kare için kenarı, dikdörtgen için en ve boyu yakala."
code: |
  enum Sekil {
      Kare(f64),
      Dikdortgen { en: f64, boy: f64 },
  }

  fn alan(s: Sekil) -> f64 {
      match s {
          Sekil::Kare(___0) => kenar * kenar,
          Sekil::Dikdortgen { ___1 } => en * boy,
      }
  }

  fn main() {
      let a = alan(Sekil::Kare(3.0));
      let b = alan(Sekil::Dikdortgen { en: 2.0, boy: 5.0 });
      println!("{a} {b}");
  }
blanks:
  - ["kenar"]
  - ["en, boy", "boy, en"]
output: "9 10"
explanation: |
  Tuple benzeri varyantta değer sırayla bağlanır; kolun sağında `kenar` kullanıldığı için desendeki
  değişkenin adı da `kenar` olmalı. Struct benzeri varyantta alanları adlarıyla yakalarsın; sıra önemli
  değildir, `{ boy, en }` da olur. `Sekil` burada değer olarak (sahipliğiyle) alındığı için `kenar`, `en`
  ve `boy` düz `f64` değerleridir.
```

## Struct mı, enum mu?

Yeni bir tip tasarlarken kendine şu soruyu sor: **"Bu şeyin parçaları hep birlikte mi var, yoksa
olasılıklardan biri mi?"**

- **VE** → struct. Bir dikdörtgenin eni **ve** boyu vardır.
- **VEYA** → enum. Bir şekil daire **veya** dikdörtgendir.

Yanlış seçimin bedelini bir örnekle gör. Ödeme yöntemini bir struct ile modelleyelim:

```rust
struct Odeme {
    yontem: u8,      // 0 = nakit, 1 = kart, 2 = havale
    kart_no: String, // sadece kartla ödemede anlamlı
    taksit: u32,     // sadece kartla ödemede anlamlı
    iban: String,    // sadece havalede anlamlı
}

fn main() {
    // Nakit ödeme... ama 6 taksitli ve IBAN'lı?! Derleyici itiraz etmez.
    let tuhaf = Odeme {
        yontem: 0,
        kart_no: String::new(),
        taksit: 6,
        iban: String::from("TR00 0000"),
    };
    println!("yöntem {} · taksit {} · iban {} · kart '{}'", tuhaf.yontem, tuhaf.taksit, tuhaf.iban, tuhaf.kart_no);
}
```

Aynı bilgi enum ile:

```rust
# #![allow(dead_code)]
enum Odeme {
    Nakit,
    Kart { numara: String, taksit: u32 },
    Havale { iban: String },
}
```

Artık "nakit ama 6 taksit" diye bir değer **yazılamaz**; her varyant yalnızca kendisi için anlamlı olan
veriyi taşır. Gerçek tasarımlarda ikisi sık sık birlikte kullanılır: bir struct'ın alanı enum olabilir
(`struct Siparis { no: u32, odeme: Odeme }`), bir varyantın içinde de struct olabilir.

:::info Başka dillerde "veya"
- **C:** "Etiketli birleşim (tagged union)" elle kurulur: bir `struct` içinde etiket alanı ve bir `union`.
  Yanlış etikete bakıp yanlış alanı okumanı hiçbir şey engellemez.
- **Java / C#:** Geleneksel çözüm, bir üst sınıf ve alt sınıflardır (kalıtım). Bu küme **açıktır**:
  herkes yeni bir alt sınıf ekleyebilir. (Java 17'den beri `sealed` sınıflarla bu küme kapatılabiliyor;
  sonuç Rust enum'larına epey benzer.)
- **TypeScript:** "Discriminated union" denen yapı Rust enum'larına en çok benzeyen şeydir.
- **Rust:** Enum, derleyicinin denetlediği güvenli bir etiketli birleşimdir. Küme **kapalıdır**: bütün
  varyantlar tek yerde tanımlıdır, bu yüzden derleyici "her durumu ele aldın mı?" diye kontrol edebilir
  (3. ders). Açık kümeler için Rust'ın aracı trait nesneleridir (Modül 20).
:::

:::deep Neden "toplam tipi"?
Struct'lara **çarpım tipi (product type)**, enum'lara **toplam tipi (sum type)** denir. Olası değerleri say:
iki `bool` alanlı bir struct'ın 2 × 2 = 4 farklı değeri vardır. `enum E { A(bool), B }` ise 2 + 1 = 3
değer alabilir. Struct'lar olasılıkları **çarpar**, enum'lar **toplar**. İkisine birlikte **cebirsel veri
tipleri (algebraic data types)** denir; Haskell, OCaml, Swift ve Kotlin'de de benzerleri vardır.
:::

Struct'ın alanı enum olunca, Modül 6'dan bildiğin metotlarla birleşir. Bu kod derlenir mi?

```compiles
code: |
  enum Yon {
      Kuzey,
      Guney,
  }

  struct Karakter {
      y: i32,
      yon: Yon,
  }

  impl Karakter {
      fn yuru(&mut self) {
          match self.yon {
              Yon::Kuzey => self.y += 1,
              Yon::Guney => self.y -= 1,
          }
      }
  }

  fn main() {
      let k = Karakter { y: 0, yon: Yon::Kuzey };
      k.yuru();
      println!("y = {}", k.y);
  }
answer: false
error: E0596
explanation: |
  Derlenmez: **E0596** - *cannot borrow `k` as mutable, as it is not declared as mutable*. Enum'la ilgisi
  yok; Modül 6'daki kural: `yuru` metodu `&mut self` aldığı için, onu çağırabilmek için örneğin kendisi
  `let mut k` ile tanımlanmış olmalı. Derleyici de tam olarak bunu önerir. `Guney` hiç oluşturulmadığı
  için ayrıca bir uyarı verir, ama derlemeyi durduran şey E0596'dır.
```

```quiz
question: Aşağıdakilerden hangileri **enum** ile modellenmeye daha uygundur? (Birden fazla seçenek doğru.)
options:
  - Bir öğrencinin adı, numarası ve not ortalaması
  - "Bir bildirim: e-posta (adresiyle), SMS (telefon numarasıyla) ya da uygulama içi bildirim (ek bilgisiz)"
  - "Dosya sistemindeki bir girdi: ya dosya (boyutuyla) ya da klasör (içindeki girdi sayısıyla)"
  - Bir dikdörtgenin eni ve boyu
answer: [1, 2]
explanation: |
  "Hepsi birden" olan veriler struct'tır: öğrencinin adı **ve** numarası **ve** ortalaması; dikdörtgenin
  eni **ve** boyu. "Biri" olan veriler enum'dur: bildirim e-posta **veya** SMS **veya** uygulama içidir ve
  her türün taşıdığı veri farklıdır. Dosya/klasör ayrımı da tipik bir enum'dur.
feedback:
  - "Bu alanların hepsi aynı anda vardır: VE → struct."
  - "Doğru: türlerden biri, her türün kendine özgü verisi var."
  - "Doğru: girdi ya dosyadır ya klasör; taşıdıkları veri de farklı."
  - "En ve boy hep birlikte vardır: VE → struct."
```

## Enum'lara metot eklemek

Modül 6'da struct'lara `impl` bloğuyla metot eklemiştin. Enum'larda da **aynı şekilde** çalışır: `&self`,
`&mut self`, `self` ve ilişkili fonksiyonlar (associated functions), hatta `Self` anahtar kelimesi de.
Metotların içinde genellikle `match self` ile varyanta göre davranırsın:

```rust
enum OyunKomutu {
    Yuru { adim: u32 },
    Zipla,
    Saldir(String),
    Bekle,
}

impl OyunKomutu {
    // İlişkili fonksiyon (self yok): kısa bir kurucu
    fn saldir(hedef: &str) -> Self {
        Self::Saldir(String::from(hedef))
    }

    // &self: komutu yalnızca okur
    fn enerji(&self) -> u32 {
        match self {
            Self::Yuru { adim } => *adim * 2,
            Self::Zipla => 5,
            Self::Saldir(_) => 10,
            Self::Bekle => 0,
        }
    }

    fn aciklama(&self) -> String {
        match self {
            Self::Yuru { adim } => format!("{adim} adım yürü"),
            Self::Zipla => String::from("zıpla"),
            Self::Saldir(hedef) => format!("{hedef} hedefine saldır"),
            Self::Bekle => String::from("bekle"),
        }
    }
}

fn main() {
    let komutlar = [
        OyunKomutu::Yuru { adim: 3 },
        OyunKomutu::Zipla,
        OyunKomutu::saldir("ejderha"),
        OyunKomutu::Bekle,
    ];
    let mut toplam = 0;
    for komut in &komutlar {
        println!("{} → enerji {}", komut.aciklama(), komut.enerji());
        toplam += komut.enerji();
    }
    println!("Toplam enerji: {toplam}");
}
```

Dikkat edilecek üç ayrıntı:

1. `impl` bloğunun içinde `Self`, `OyunKomutu` demektir; desenlerde de `Self::Zipla` yazabilirsin.
2. `Self::Saldir(_)`: `_` "burada bir değer var ama umurumda değil" demektir; değeri bağlamaz.
3. `self` bir **referans** (`&OyunKomutu`) olduğu için desenin yakaladığı `adim` da bir referanstır:
   `&u32`. Değerin kendisine `*adim` ile ulaşırsın (Modül 5'teki referans çözme). `format!` gibi yerlerde
   `*` gerekmez; referans da yazdırılabilir. Bu "desen referansa uyum sağlar" davranışını 3. derste
   yeniden ele alacağız.

````exercise
title: Kargo ücreti hesaplayıcı
difficulty: 2
prompt: |
  Bir kargo firması üç tür gönderi kabul ediyor. Ücret kuralları şöyle:

  | Gönderi | Ücret |
  |---|---|
  | `Mektup` | 20 TL |
  | `Koli { agirlik_kg }` | 50 TL + kilogram başına 10 TL |
  | `Palet { agirlik_kg, sigortali }` | 400 TL + kilogram başına 2 TL; sigortalıysa ayrıca 150 TL |

  `Gonderi` için `ucret(&self) -> u32` metodunu `match self` kullanarak tamamla.
starter: |
  enum Gonderi {
      Mektup,
      Koli { agirlik_kg: u32 },
      Palet { agirlik_kg: u32, sigortali: bool },
  }

  impl Gonderi {
      fn ucret(&self) -> u32 {
          todo!()
      }
  }

  fn main() {
      let gonderiler = [
          Gonderi::Mektup,
          Gonderi::Koli { agirlik_kg: 3 },
          Gonderi::Palet { agirlik_kg: 100, sigortali: true },
      ];
      for g in &gonderiler {
          println!("{} TL", g.ucret());
      }
  }
solution: |
  enum Gonderi {
      Mektup,
      Koli { agirlik_kg: u32 },
      Palet { agirlik_kg: u32, sigortali: bool },
  }

  impl Gonderi {
      fn ucret(&self) -> u32 {
          match self {
              Gonderi::Mektup => 20,
              Gonderi::Koli { agirlik_kg } => 50 + agirlik_kg * 10,
              Gonderi::Palet { agirlik_kg, sigortali } => {
                  let mut toplam = 400 + agirlik_kg * 2;
                  if *sigortali {
                      toplam += 150;
                  }
                  toplam
              }
          }
      }
  }

  fn main() {
      let gonderiler = [
          Gonderi::Mektup,
          Gonderi::Koli { agirlik_kg: 3 },
          Gonderi::Palet { agirlik_kg: 100, sigortali: true },
      ];
      for g in &gonderiler {
          println!("{} TL", g.ucret());
      }
  }
check: tests
tests: |
  #[test]
  fn mektup_sabit_ucretlidir() {
      assert_eq!(Gonderi::Mektup.ucret(), 20, "mektup her zaman 20 TL olmalı");
  }

  #[test]
  fn koli_agirliga_gore_artar() {
      assert_eq!(Gonderi::Koli { agirlik_kg: 3 }.ucret(), 80, "3 kg koli: 50 + 3 x 10 = 80 TL");
      assert_eq!(Gonderi::Koli { agirlik_kg: 0 }.ucret(), 50, "0 kg koli yalnızca taban ücreti öder: 50 TL");
      assert_eq!(Gonderi::Koli { agirlik_kg: 12 }.ucret(), 170, "12 kg koli: 50 + 12 x 10 = 170 TL");
  }

  #[test]
  fn sigortasiz_palet() {
      let p = Gonderi::Palet { agirlik_kg: 100, sigortali: false };
      assert_eq!(p.ucret(), 600, "100 kg sigortasız palet: 400 + 100 x 2 = 600 TL");
  }

  #[test]
  fn sigortali_palet_150_tl_fazla_oder() {
      let p = Gonderi::Palet { agirlik_kg: 250, sigortali: true };
      assert_eq!(p.ucret(), 1050, "250 kg sigortalı palet: 400 + 250 x 2 + 150 = 1050 TL");
  }
hints:
  - "Her varyant için bir kol yaz. En kolayıyla başla: `Gonderi::Mektup => 20,`"
  - "Alanları desende yakala ve kolun sağında kullan: `Gonderi::Koli { agirlik_kg } => 50 + agirlik_kg * 10,`"
  - "`self` bir referans olduğu için `sigortali` bir `&bool`'dur; `if *sigortali { ... }` yazmalısın. Palet kolunu süslü parantezli bir blok yap: önce `let mut toplam = 400 + agirlik_kg * 2;`, sonra sigortayı ekle ve bloğun sonunda `toplam` döndür."
explanation: |
  Her varyant kendi verisini taşıdığı için ücret hesabı da varyanta göre değişiyor; `match self` bu
  dallanmayı tek yerde ve eksiksiz yapıyor. `Koli` ve `Palet` kollarındaki `agirlik_kg` bir `&u32`'dir;
  `agirlik_kg * 10` yine de çalışır, çünkü Rust sayılarla referanslar arasındaki aritmetiği tanımlar.
  `if` ise gerçek bir `bool` ister; bu yüzden `*sigortali` ile referansı çözmek gerekir. Yazmasaydın
  derleyici *expected `bool`, found `&bool`* derdi ve `*` eklemeyi önerirdi.

  Palet kolu için daha kısa bir alternatif, `if`'in bir ifade olmasından yararlanır (Modül 3):

  ```rust
  Gonderi::Palet { agirlik_kg, sigortali } => {
      let sigorta = if *sigortali { 150 } else { 0 };
      400 + agirlik_kg * 2 + sigorta
  }
  ```

  Testler farklı ağırlıklar ve her iki sigorta durumu için ücreti kontrol ettiği için "sabit sayı döndürme"
  hilesi işe yaramaz. Yeni bir gönderi türü eklendiğinde (örneğin `Zarf`) derleyici bu `match`'i
  güncellemeni zorunlu kılacak - bunun nedenini 3. derste göreceksin.
````

## Özet

:::remember
- `enum` "**veya**"yı modeller: bir enum değeri, varyantlarından **tam olarak biridir**.
- Varyantlar veri taşıyabilir: verisiz (`Cik`), tuple benzeri (`Yaz(String)`), struct benzeri
  (`Tasi { x: i32, y: i32 }`).
- Varyantlara `Tip::Varyant` ile ulaşılır; bütün varyantlar **aynı tiptir** ve aynı boyutta yer kaplar.
- Varyantın verisine nokta ile değil, **desenle** ulaşılır: `Mesaj::Yaz(metin) => ...`
- `impl` enum'larda da çalışır; metotlar genellikle `match self` ile varyanta göre davranır.
  `&self` metotlarında bağlanan değerler referanstır.
- Enum'lar kendiliğinden `==` ile karşılaştırılamaz (E0369); şimdilik `match` kullan.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla - bir ödeme yöntemini neden `yontem: u8` ve birkaç alandan oluşan bir
  struct yerine bir enum ile modellemek daha güvenlidir?
answer: |
  Struct'ta bütün alanlar her zaman vardır; bu yüzden "nakit ama 6 taksitli" ya da "yöntem = 7" gibi
  anlamsız değerler yazılabilir ve derleyici bunları yakalayamaz. Enum'da her varyant yalnızca kendi
  verisini taşır: `Nakit`'in taksiti olamaz, `Kart`'ın da IBAN'ı. Geçersiz durumlar yazılamaz hâle gelir.
  Ayrıca veriye ancak desenle, yani varyant kontrol edildikten sonra ulaşılabildiği için yanlış alanı
  okuma hatası da imkânsızdır.
```

```flashcards
- front: Struct ile enum arasındaki temel fark "ve / veya" ile nasıl özetlenir?
  back: "Struct: alanların **hepsi birden** vardır (VE). Enum: değer varyantlardan **tam olarak biridir** (VEYA)."
- front: Bir enum'da hangi üç tür varyant olabilir? Birer örnek ver.
  back: "Verisiz (`Cik`), tuple benzeri (`Yaz(String)`), struct benzeri (`Tasi { x: i32, y: i32 }`)."
- front: "`IpAdresi::V4(127, 0, 0, 1)` ifadesinde `IpAdresi::V4` nasıl davranır?"
  back: "Bir kurucu fonksiyon gibi: dört `u8` alır ve bir `IpAdresi` değeri döndürür."
- front: "`m: Mesaj` için `m.x` neden derlenmez?"
  back: "`x` yalnızca bir varyantın alanıdır; `Mesaj` tipinin alanı değildir (E0609). Veriye desenle ulaşılır: `Mesaj::Tasi { x, y } => ...`"
- front: "`if yon == Yon::Kuzey` neden derlenmez ve şimdilik ne yaparsın?"
  back: "Enum'lar için `==` kendiliğinden tanımlı değildir (E0369). `match` kullanırsın (ya da Modül 11'de göreceğin `#[derive(PartialEq)]`)."
- front: Bir enum değeri bellekte ne kadar yer kaplar?
  back: En büyük varyantın sığacağı kadar yer + varyantı gösteren etiket. Tüm varyantlar aynı boyuttadır (niş optimizasyonu etiketi bazen verinin kullanmadığı bit desenlerine gizler; bu düzen genelde garanti edilmez).
- front: "`&self` alan bir metotta `match self { Self::Yuru { adim } => ... }` yazınca `adim`'ın tipi nedir?"
  back: "Bir referans: `&u32`. Değerin kendisi için `*adim` kullanılır."
- front: "Veri taşımayan bir enum'un varyantını sayıya nasıl çevirirsin? Tersi (`404 as HttpDurum`) mümkün mü?"
  back: "`as` ile: `Gun::Sali as i32` varyantın ayırt edici değerini (discriminant) verir. Tersi yoktur; sayıdan enum'a `match` ile çevirir, tanınmayan sayılar için \"sonuç yok\" döndürürsün."
```
