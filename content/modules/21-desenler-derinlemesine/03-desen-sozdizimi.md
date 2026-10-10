---
id: m21-l03
title: "Desen sözdizimi: değerler, aralıklar ve yapı bozma"
minutes: 20
type: lesson
objectives:
  - Değişmez, isim, `|` ve aralık desenlerini doğru yerde kullanabilmek ve "isim desen gölgeler" tuzağını fark edebilmek
  - Struct'ları kısaltma ve yeniden adlandırma yazımıyla, enum'ları ve tuple'ları iç içe desenlerle parçalayabilmek
  - Bir desen içinde sabit değerleri (`Nokta { x: 0, y }`) ve bağlamaları birlikte kullanarak durumları tek kolda ayırt edebilmek
  - E0027, E0408 ve `unreachable pattern` uyarılarını okuyup düzeltebilmek
keywords: [literal, değişmez, gölgeleme, "|", aralık, "..=", struct deseni, iç içe desen, E0027, E0408]
---

Desenlerin nerede yaşadığını ve hangilerinin her değere uyduğunu artık biliyorsun. Bu derste
desenlerin **içine** bakıyoruz: hangi parçalardan kurulurlar, nasıl iç içe geçerler ve en sık hangi
tuzaklara düşülür?

Hedefimiz şu: karmaşık bir veri yapısına baktığında, onu tek bir okunaklı desenle açabilmek. Bir akıllı
ev asistanına gelen "yatak odasının ışığını aç" komutunu düşün: bir enum'un içinde bir struct, onun içinde
başka bir enum... Hepsini tek satırda yakalayacağız.

## Değişmezler ve isimler: gölgeleme tuzağı

En basit desen bir **değişmezdir (literal)**: `0`, `'x'`, `true`, `"evet"`. Değer desenle **eşitse** uyar.

```rust
fn yanit(komut: &str) -> &str {
    match komut {
        "yardım" | "?" => "Komutlar: başla, dur, çık",
        "başla" => "Başlıyoruz!",
        "çık" => "Görüşürüz.",
        _ => "Bilinmeyen komut",
    }
}

fn main() {
    let girdi = String::from("başla");
    // String'i &str desenleriyle eşleştirmek için önce &str'ye çevir
    println!("{}", yanit(girdi.as_str()));
    println!("{}", yanit("?"));
    println!("{}", yanit("uç"));
}
```

`&str` değişmezleri yalnızca `&str` tipindeki bir değerle eşleşir. Bir `String`'i `match`'lerken
`girdi.as_str()` (ya da `&girdi[..]`) ile önce dilime çevirmen gerekir (Modül 9).

Değişmezin karşısında **isim desen** var: tek başına bir isim her değere uyar ve onu o isme bağlar.
Peki dışarıda aynı isimde bir değişken varsa? Tahmin et:

```predict
code: |
  fn main() {
      let hedef = 7;
      let zar = 3;
      match zar {
          hedef => println!("Tuttu! ({hedef})"),
          _ => println!("Tutmadı."),
      }
      # let _ = hedef;
  }
options:
  - "Tutmadı."
  - "Tuttu! (3)"
  - "Tuttu! (7)"
  - Derlenmez
answer: 1
explanation: |
  Program `Tuttu! (3)` yazar. Desendeki `hedef`, dıştaki `hedef`'le **karşılaştırılmaz**: aynı isimde
  **yeni** bir değişken tanımlar ve onu gölgeler (shadowing). Bu yeni `hedef` her değere uyar ve `zar`'ın
  değerini (3) alır. `_` koluna hiçbir değer ulaşamaz.
```

Derleyici bu tuzağı tanıyor ve seni uyarıyor:

:::warning Desen gölgeleme uyarısı
```text
warning: unreachable pattern
 --> src/main.rs:6:9
  |
5 |         hedef => println!("Tuttu! ({hedef})"),
  |         ----- matches any value
6 |         _ => println!("Tutmadı."),
  |         ^ no value can reach this
  |
note: there is a binding of the same name; if you meant to pattern match against the value of
      that binding, that is a feature of constants that is not available for `let` bindings
```
Not bize çözümü de söylüyor: bir değerle desen içinde karşılaştırmak **sabitlerin (`const`)**
özelliğidir. `let` ile tanımlanan bir değişkeni desende kullanamazsın.
:::

Üç doğru yol var:

```rust
const HEDEF: u32 = 7;

fn main() {
    let zar: u32 = 7;

    // 1) const: desen içinde bir sabit, değeriyle karşılaştırılır
    match zar {
        HEDEF => println!("const: Tuttu!"),
        _ => println!("const: Tutmadı."),
    }

    // 2) Basit karşılaştırma için desene hiç gerek yok
    let hedef = 7;
    if zar == hedef {
        println!("if: Tuttu!");
    }

    // 3) match içinde koşul: match guard (5. derste ayrıntılı)
    match zar {
        z if z == hedef => println!("guard: Tuttu!"),
        _ => println!("guard: Tutmadı."),
    }
}
```

`HEDEF` neden yeni bir değişken tanımlamıyor? Rust desende büyük harfle başlayan, kapsamda bir `const`
(ya da enum varyantı, birim struct) olarak **bulunan** isimleri o değer olarak yorumlar. Bulamadığı her
isim yeni bir bağlamadır. İsimlendirme kuralı (`SCREAMING_SNAKE_CASE` sabitler, `snake_case`
değişkenler) bu yüzden yalnızca bir üslup meselesi değildir; desenleri okunaklı tutar.

## Birden çok desen ve aralıklar

`|` ile birden çok deseni "veya" ile bağlarsın. `|` desenin en üst seviyesinde olabileceği gibi
**iç içe** de olabilir:

```rust
fn main() {
    for oy in [Some(1), Some(2), Some(5), None] {
        let yorum = match oy {
            Some(1 | 2) => "kötü", // iç içe |: Some(1) | Some(2) ile aynı
            Some(3) => "orta",
            Some(4 | 5) => "iyi",
            Some(_) => "geçersiz puan",
            None => "oy yok",
        };
        println!("{oy:?} → {yorum}");
    }

    // Aralık desenleri: tamsayılar ve char'lar için
    for derece in [-5, 0, 12, 24, 38] {
        let his = match derece {
            ..0 => "eksi derece, buzlanma!", // 0 hariç, altındaki her şey
            0..10 => "soğuk",                // 0 dahil, 10 hariç
            10..=25 => "ılık",               // 10 ve 25 dahil
            26.. => "sıcak",                 // 26 ve üstü
        };
        println!("{derece}°C: {his}");
    }
}
```

Aralık desenlerinin dört biçimi var: `a..=b` (iki uç dahil), `a..b` (üst uç hariç, Rust 1.80'den beri),
`a..` (alt sınırdan yukarısı) ve `..b` / `..=b` (üst sınırdan aşağısı). Derleyici aralıkların tipi
gerçekten kapsayıp kapsamadığını hesaplar; yukarıdaki dört aralık bütün `i32` değerlerini kapsadığı için
`_` koluna gerek yok.

`|` ile bağlanan alternatiflerin her biri **aynı isimleri** bağlamalıdır. Neden? Kol çalıştığında hangi
alternatifin uyduğunu bilmiyoruz; isimler her durumda var olmalı:

```compiles
code: |
  fn main() {
      let konum = (0, 5);
      match konum {
          (x, 0) | (0, x) => println!("Eksen üstünde, uzaklık {x}"),
          _ => println!("Eksenlerin dışında"),
      }
  }
answer: true
explanation: |
  Derlenir ve `Eksen üstünde, uzaklık 5` yazar. İki alternatif de `x`'i bağlıyor (ve ikisinde de `x`
  aynı tipte). İlki "y sıfırsa x'i al", ikincisi "x sıfırsa y'yi `x` adıyla al" diyor. Alternatiflerden
  biri `x`'i bağlamasaydı **E0408** (*variable `x` is not bound in all patterns*) alırdın:
  `Some(n) | None` böyle bir hatadır.
```

````quiz
question: |
  Aşağıdaki `match` hakkında hangisi doğru?

  ```rust
  match not {
      0..=100 => "geçerli",
      50..=59 => "kıl payı",
      _ => "hatalı",
  }
  ```
options:
  - "`55` için `\"kıl payı\"` döner çünkü daha dar olan aralık kazanır"
  - "Program derlenmez çünkü aralıklar çakışıyor"
  - "Derlenir ama `50..=59` koluna hiçbir değer ulaşamaz; derleyici `unreachable pattern` uyarısı verir"
answer: 2
explanation: |
  Kollar **yukarıdan aşağıya** denenir ve ilk uyan kazanır; "en özel desen" diye bir kural yoktur.
  `0..=100` 50–59'u zaten kapsadığı için ikinci kol ölü koddur. Çakışma hata değildir, ama derleyici
  *matches all the relevant values / no value can reach this* diyerek uyarır. Çözüm: özel aralığı **önce** yaz.
feedback:
  - "Rust'ta \"en özel desen kazanır\" diye bir kural yok; sıra belirleyicidir."
  - "Çakışan aralıklar hata değil, uyarıdır; bazen kasıtlıdır."
  - "Doğru! Özel durumlar her zaman genel durumlardan önce gelmeli."
````

## Struct'ları parçalamak

Struct deseni, struct'ın adını ve alanlarını yazar. Her alan için ya **yeni bir isim** verirsin ya da
alan adını kısaltma (shorthand) olarak kullanırsın:

```rust
struct Nokta {
    x: i32,
    y: i32,
}

fn main() {
    let p = Nokta { x: 3, y: -7 };

    let Nokta { x: yatay, y: dikey } = p; // alan: yeni_isim
    println!("yatay = {yatay}, dikey = {dikey}");

    let Nokta { x, y } = p; // kısaltma: Nokta { x: x, y: y }
    println!("x = {x}, y = {y}");

    // Alan yerine sabit bir değer yazmak o alanı SINAR
    for q in [Nokta { x: 0, y: 4 }, Nokta { x: 2, y: 0 }, Nokta { x: 0, y: 0 }, p] {
        let yer = match q {
            Nokta { x: 0, y: 0 } => String::from("orijinde"),
            Nokta { x: 0, y } => format!("y ekseninde ({y})"),
            Nokta { x, y: 0 } => format!("x ekseninde ({x})"),
            Nokta { x, y } => format!("düzlemde ({x}, {y})"),
        };
        println!("{yer}");
    }
}
```

Struct deseninde `alan: DESEN` yazımındaki sağ taraf **herhangi bir desen** olabilir: bir isim
(`x: yatay`), bir değişmez (`x: 0`), bir aralık (`y: 1..=9`), hatta başka bir struct deseni. Kısaltma
`Nokta { x }` ise `Nokta { x: x }` demektir. (`Nokta` alanlarının hepsi `Copy` olduğu için `p`'yi
defalarca parçalayabildik; taşınan alanlarda ne olduğunu 4. derste göreceğiz.)

Yeniden adlandırma yazımı bir yanılgıya yol açabilir. Tahmin et:

```compiles
code: |
  struct Ogrenci {
      ad: String,
      not: u32,
  }

  fn main() {
      let o = Ogrenci { ad: String::from("Ece"), not: 88 };
      let Ogrenci { ad: isim, not: puan } = o;
      println!("{ad}: {puan}");
  }
answer: false
error: E0425
explanation: |
  Derlenmez: **E0425**, *cannot find value `ad` in this scope*. `ad: isim` yazımında `ad` **alanın**
  adıdır, bağlanan değişken ise `isim`'dir. Desen `ad` diye bir değişken üretmez. Alan adıyla aynı isimde
  bir değişken istiyorsan kısaltmayı kullan: `Ogrenci { ad, not }`.
```

Struct deseni varsayılan olarak **bütün** alanları anmalıdır. Unutursan derleyici çözümleri sıralar:

:::error
```text
error[E0027]: pattern does not mention field `y`
 --> src/main.rs:4:9
  |
4 |     let Nokta { x } = p;
  |         ^^^^^^^^^^^ missing field `y`
  |
help: include the missing field in the pattern
  |
4 |     let Nokta { x, y } = p;
  |                  +++
help: if you don't care about this missing field, you can explicitly ignore it
  |
4 |     let Nokta { x, y: _ } = p;
  |                  ++++++
help: or always ignore missing fields here
  |
4 |     let Nokta { x, .. } = p;
  |                  ++++
```
Üç `help` üç niyeti anlatır: alanı da kullanacaksan ekle; bu alanı bilerek yok sayıyorsan `y: _`;
geri kalan bütün alanlarla ilgilenmiyorsan `..`. Neden varsayılan "hepsini an"? Struct'a ileride yeni bir
alan eklendiğinde, onu hesaba katmayan desenlerin derleyici tarafından gösterilmesi için. `..` yazarak
bu korumadan bilinçli olarak vazgeçersin.
:::

## Enum'lar ve iç içe desenler

Gerçek güç, desenlerin **iç içe** geçebilmesinden gelir. Desenin şekli verinin şeklini birebir izler.
Bir kargo uygulamasında siparişleri düşün:

```rust
#[allow(dead_code)]
enum Durum {
    Hazirlaniyor,
    Kargoda { firma: &'static str, takip: u32 },
    Teslim { gun: u8 },
}

struct Siparis {
    no: u32,
    durum: Durum,
}

fn bilgi(s: Option<Siparis>) -> String {
    match s {
        None => String::from("Sipariş bulunamadı"),
        Some(Siparis { durum: Durum::Hazirlaniyor, no }) => format!("#{no} hazırlanıyor"),
        Some(Siparis { durum: Durum::Kargoda { firma: "Hızlı", takip }, .. }) => {
            format!("Hızlı Kargo, takip: H-{takip}")
        }
        Some(Siparis { durum: Durum::Kargoda { firma, takip }, .. }) => {
            format!("{firma} kargoda, takip: {takip}")
        }
        Some(Siparis { durum: Durum::Teslim { gun: 1..=3 }, no }) => format!("#{no} yeni teslim edildi"),
        Some(Siparis { no, .. }) => format!("#{no} teslim edildi"),
    }
}

fn main() {
    let liste = [
        Some(Siparis { no: 1, durum: Durum::Hazirlaniyor }),
        Some(Siparis { no: 2, durum: Durum::Kargoda { firma: "Hızlı", takip: 4410 } }),
        Some(Siparis { no: 3, durum: Durum::Kargoda { firma: "Yavaş", takip: 77 } }),
        Some(Siparis { no: 4, durum: Durum::Teslim { gun: 2 } }),
        Some(Siparis { no: 5, durum: Durum::Teslim { gun: 9 } }),
        None,
    ];
    for s in liste {
        println!("{}", bilgi(s));
    }
}
```

Tek bir kolda üç katman açılıyor: `Option` → `Siparis` struct'ı → `Durum` enum'u. Aynı desende hem
**sınama** (`firma: "Hızlı"`, `gun: 1..=3`) hem **bağlama** (`takip`, `no`) var. C ya da Java'da bunun
karşılığı iç içe `if (s != null && s.durum instanceof Kargoda && ...)` zincirleri ve tip dönüşümleri
olurdu; Rust'ta desen verinin şeklini doğrudan resmediyor ve derleyici hiçbir durumun unutulmadığını
garanti ediyor.

```predict
code: |
  enum Para {
      Tl(u32),
      Doviz { kod: char, miktar: u32 },
  }

  fn main() {
      let cuzdan = [
          Some(Para::Tl(50)),
          Some(Para::Doviz { kod: '€', miktar: 10 }),
          None,
          Some(Para::Doviz { kod: '$', miktar: 0 }),
      ];
      for p in cuzdan {
          let s = match p {
              Some(Para::Tl(0) | Para::Doviz { miktar: 0, .. }) => String::from("boş"),
              Some(Para::Tl(m)) => format!("{m} TL"),
              Some(Para::Doviz { kod, miktar }) => format!("{miktar}{kod}"),
              None => String::from("cüzdan yok"),
          };
          println!("{s}");
      }
  }
options:
  - |
    50 TL
    10€
    cüzdan yok
    boş
  - |
    50 TL
    10€
    cüzdan yok
    0$
  - |
    boş
    10€
    cüzdan yok
    boş
answer: 0
explanation: |
  İlk kol iç içe bir `|` kullanıyor: "`Some` içinde ya `Tl(0)` ya da miktarı `0` olan herhangi bir döviz".
  `Doviz { kod: '$', miktar: 0 }` bu kola uyar ve `boş` yazar; ikinci ve üçüncü kollara hiç ulaşmaz.
  `Tl(50)` ise ilk kolun `Tl(0)` alternatifine uymaz ve `Some(Para::Tl(m))` koluna düşer.
```

## Tuple'lar ve karışık yapı bozma

Tuple desenleri hem birden çok değeri **aynı anda** eşleştirmenin (Modül 7'deki `match (durum, olay)`)
hem de karışık yapıları tek satırda açmanın aracıdır. Desen sınırsızca karıştırılabilir:

```rust
struct Nokta {
    x: i32,
    y: i32,
}

fn main() {
    let veri = ((180, 75), Nokta { x: 10, y: -3 }, ["kırmızı", "mavi"]);
    let ((boy, kilo), Nokta { x, y: derinlik }, [birinci_renk, ikinci_renk]) = veri;

    println!("Boy {boy} cm, kilo {kilo} kg");
    println!("Konum x={x}, derinlik={derinlik}");
    println!("Takım renkleri: {birinci_renk}-{ikinci_renk}");
}
```

Son parça bir **dizi deseni**: sabit uzunluklu bir diziyi elemanlarına `[a, b]` ile açar (eleman sayısı
tutmalı). Dizilerin ve dilimlerin desenlerini 5. derste ayrıntılı göreceğiz.

Bu satır okunaklı mı? Sınırda. Kural: bir desen **verinin şeklini bir bakışta anlatıyorsa** iyidir. Üç
katmandan derine iniyorsan ya da desen satıra sığmıyorsa, adım adım parçalamak (ya da bir yardımcı
fonksiyon yazmak) genellikle daha anlaşılırdır.

:::analogy Matruşka bebekler
İç içe desen, Rus matruşka bebeklerini açmak gibidir: dıştaki bebeği (`Some`) açarsın, içinden bir sonraki
çıkar (`Siparis`), onu da açarsın (`Durum::Kargoda`) ve en içteki küçük bebeği (`takip`) avucuna alırsın.
Desen, hangi bebeğin içinde hangisinin olduğunu bilen bir talimat listesidir. Bir bebek beklediğin gibi
değilse (örneğin `Teslim` çıkarsa) talimat o noktada "uymadı" der ve bir sonraki kola geçilir.
:::

```fill
prompt: |
  Bir satranç uygulaması hamleyi `(taş, (sütun, satır))` biçiminde alıyor. `match`'i tamamla: kale
  (`'K'`) 1. satırda ya da 8. satırda ise "kenarda kale", herhangi bir taş `'d'` sütununda ise
  "d sütununda", gerisi için konumu yazsın.
code: |
  fn yorumla(hamle: (char, (char, u8))) -> String {
      match hamle {
          ('K', (_, ___0)) => String::from("kenarda kale"),
          (_, (___1, _)) => String::from("d sütununda"),
          (tas, (sutun, satir)) => format!("{tas} → {sutun}{satir}"),
      }
  }

  fn main() {
      println!("{}", yorumla(('K', ('a', 8))));
      println!("{}", yorumla(('V', ('d', 4))));
      println!("{}", yorumla(('A', ('f', 3))));
  }
blanks:
  - ["1 | 8", "8 | 1"]
  - ["'d'"]
output: |
  kenarda kale
  d sütununda
  A → f3
explanation: |
  İlk boşluk iç içe bir `|`: satır `1` **veya** `8`. İkinci boşluk bir `char` değişmezi: yalnızca `'d'`
  sütununa uyar. Son kol bütün parçaları isimlere bağlıyor ve ilk iki kola uymayan her hamleyi
  karşılıyor. Kolların toplamı eksiksiz.
```

Şimdi bütün bunları birleştir:

```exercise
id: m21-e-akilli-ev
title: Akıllı ev asistanı
difficulty: 3
prompt: |
  Bir akıllı ev asistanı komutları `Komut` enum'u olarak alıyor. `yanit` fonksiyonunu **tek bir `match`**
  ile yaz; her kural tek bir desenle ifade edilsin. Kollar yukarıdan aşağıya denenir; sıralamaya dikkat!

  | Komut | Yanıt |
  |---|---|
  | `Isik { oda: YatakOdasi, acik: true }` | `"Yatak odası ışığı loş modda açıldı"` |
  | `Isik { oda, acik: true }` | `"<oda> ışığı açıldı"` |
  | `Isik { oda, acik: false }` | `"<oda> ışığı kapandı"` |
  | `Klima(Sogut(d))`, `d` 15 veya altı / `Klima(Isit(d))`, `d` 31 veya üstü | `"Geçersiz sıcaklık"` |
  | `Klima(Sogut(d))` | `"Klima <d>°C'ye soğutuyor"` |
  | `Klima(Isit(d))` | `"Klima <d>°C'ye ısıtıyor"` |
  | `Klima(Fan)` | `"Klima fan modunda"` |
  | `Perde(0)` | `"Perde kapandı"` |
  | `Perde(100)` | `"Perde tamamen açık"` |
  | `Perde(1..=99)` | `"Perde %<oran> açık"` |
  | `Perde(101..)` | `"Geçersiz perde oranı"` |

  Oda adları için hazır `oda_adi` fonksiyonunu kullan.
starter: |
  #[derive(Clone, Copy)]
  enum Oda {
      Salon,
      Mutfak,
      YatakOdasi,
  }

  enum Mod {
      Sogut(i8),
      Isit(i8),
      Fan,
  }

  enum Komut {
      Isik { oda: Oda, acik: bool },
      Klima(Mod),
      Perde(u8),
  }

  fn oda_adi(oda: Oda) -> &'static str {
      match oda {
          Oda::Salon => "Salon",
          Oda::Mutfak => "Mutfak",
          Oda::YatakOdasi => "Yatak odası",
      }
  }

  fn yanit(komut: Komut) -> String {
      todo!()
  }

  fn main() {
      let komutlar = [
          Komut::Isik { oda: Oda::YatakOdasi, acik: true },
          Komut::Isik { oda: Oda::Salon, acik: false },
          Komut::Klima(Mod::Sogut(12)),
          Komut::Klima(Mod::Isit(24)),
          Komut::Perde(40),
      ];
      for k in komutlar {
          println!("{}", yanit(k));
      }
  }
solution: |
  #[derive(Clone, Copy)]
  enum Oda {
      Salon,
      Mutfak,
      YatakOdasi,
  }

  enum Mod {
      Sogut(i8),
      Isit(i8),
      Fan,
  }

  enum Komut {
      Isik { oda: Oda, acik: bool },
      Klima(Mod),
      Perde(u8),
  }

  fn oda_adi(oda: Oda) -> &'static str {
      match oda {
          Oda::Salon => "Salon",
          Oda::Mutfak => "Mutfak",
          Oda::YatakOdasi => "Yatak odası",
      }
  }

  fn yanit(komut: Komut) -> String {
      match komut {
          Komut::Isik { oda: Oda::YatakOdasi, acik: true } => {
              String::from("Yatak odası ışığı loş modda açıldı")
          }
          Komut::Isik { oda, acik: true } => format!("{} ışığı açıldı", oda_adi(oda)),
          Komut::Isik { oda, acik: false } => format!("{} ışığı kapandı", oda_adi(oda)),
          Komut::Klima(Mod::Sogut(..=15) | Mod::Isit(31..)) => String::from("Geçersiz sıcaklık"),
          Komut::Klima(Mod::Sogut(d)) => format!("Klima {d}°C'ye soğutuyor"),
          Komut::Klima(Mod::Isit(d)) => format!("Klima {d}°C'ye ısıtıyor"),
          Komut::Klima(Mod::Fan) => String::from("Klima fan modunda"),
          Komut::Perde(0) => String::from("Perde kapandı"),
          Komut::Perde(100) => String::from("Perde tamamen açık"),
          Komut::Perde(oran @ 1..=99) => format!("Perde %{oran} açık"),
          Komut::Perde(101..) => String::from("Geçersiz perde oranı"),
      }
  }

  fn main() {
      let komutlar = [
          Komut::Isik { oda: Oda::YatakOdasi, acik: true },
          Komut::Isik { oda: Oda::Salon, acik: false },
          Komut::Klima(Mod::Sogut(12)),
          Komut::Klima(Mod::Isit(24)),
          Komut::Perde(40),
      ];
      for k in komutlar {
          println!("{}", yanit(k));
      }
  }
check: tests
tests: |
  #[test]
  fn isik_komutlari() {
      assert_eq!(yanit(Komut::Isik { oda: Oda::YatakOdasi, acik: true }), "Yatak odası ışığı loş modda açıldı");
      assert_eq!(yanit(Komut::Isik { oda: Oda::Mutfak, acik: true }), "Mutfak ışığı açıldı");
      assert_eq!(yanit(Komut::Isik { oda: Oda::YatakOdasi, acik: false }), "Yatak odası ışığı kapandı", "loş mod yalnızca AÇMA komutu için");
  }

  #[test]
  fn klima_komutlari() {
      assert_eq!(yanit(Komut::Klima(Mod::Sogut(22))), "Klima 22°C'ye soğutuyor");
      assert_eq!(yanit(Komut::Klima(Mod::Isit(27))), "Klima 27°C'ye ısıtıyor");
      assert_eq!(yanit(Komut::Klima(Mod::Fan)), "Klima fan modunda");
  }

  #[test]
  fn klima_sinirlari() {
      assert_eq!(yanit(Komut::Klima(Mod::Sogut(15))), "Geçersiz sıcaklık", "15 ve altı soğutma geçersiz");
      assert_eq!(yanit(Komut::Klima(Mod::Sogut(16))), "Klima 16°C'ye soğutuyor", "16 geçerli bir soğutma derecesi");
      assert_eq!(yanit(Komut::Klima(Mod::Isit(31))), "Geçersiz sıcaklık", "31 ve üstü ısıtma geçersiz");
      assert_eq!(yanit(Komut::Klima(Mod::Isit(10))), "Klima 10°C'ye ısıtıyor", "düşük ısıtma derecesi geçerli");
  }

  #[test]
  fn perde_komutlari() {
      assert_eq!(yanit(Komut::Perde(0)), "Perde kapandı");
      assert_eq!(yanit(Komut::Perde(100)), "Perde tamamen açık");
      assert_eq!(yanit(Komut::Perde(1)), "Perde %1 açık");
      assert_eq!(yanit(Komut::Perde(73)), "Perde %73 açık");
      assert_eq!(yanit(Komut::Perde(101)), "Geçersiz perde oranı", "u8 255'e kadar çıkabilir; 100'ü aşan oranlar geçersiz");
  }
hints:
  - "Özel durumlar genel durumlardan **önce** gelmeli: `Isik { oda: Oda::YatakOdasi, acik: true }` kolu `Isik { oda, acik: true }` kolundan önce."
  - "Geçersiz sıcaklıkları tek kolda yakala: `Komut::Klima(Mod::Sogut(..=15) | Mod::Isit(31..))`. Bu kol, `Sogut(d)` ve `Isit(d)` kollarından önce gelmeli."
  - "Perde için `Perde(0)`, `Perde(100)`, `Perde(101..)` sabit/aralık kolları ve oranı bağlayan bir `Perde(oran)` kolu yeterli; `Perde(oran)`'ı `Perde(101..)`'dan sonraya koy (ya da `oran @ 1..=99` ile sınırla, 5. derste göreceğiz)."
forbid:
  - pattern: "\\bif\\b"
    message: Bu alıştırmayı `if` kullanmadan, yalnızca desenlerle çöz.
explanation: |
  Çözümün tamamı tek bir `match`: her satır bir kuralı **verinin şekliyle** anlatıyor. Bu stilde
  sıralama mantığın bir parçasıdır: yatak odası istisnası genel ışık kolundan, geçersiz sıcaklık kolu
  geçerli soğutma/ısıtma kollarından önce gelmek zorunda.

  `Komut::Klima(Mod::Sogut(..=15) | Mod::Isit(31..))` satırı iç içe `|` ile iki farklı varyantı ve iki
  farklı açık aralığı tek kolda birleştiriyor. Bağlama yapmadığı için E0408 sorunu yok.

  Perde kolundaki `oran @ 1..=99` yazımı bir **@ bağlaması**: "1–99 aralığındaysa değeri `oran`'a da
  bağla". Bunu 5. derste göreceksin; şimdilik `Perde(oran)` kolunu `Perde(101..)`'dan **sonraya** koymak
  aynı sonucu verir. Derleyici her iki durumda da `u8`'in bütün değerlerinin kapsandığını (0, 1–99, 100,
  101–255) kendi hesaplıyor; `_` koluna gerek kalmıyor.
```

## Özet

:::remember
- **Değişmez** desenler (`0`, `'x'`, `true`, `"evet"`) eşitlikle sınar. `String`'i `match`'lerken `.as_str()`.
- Desende tek başına bir isim **yeni bir değişkendir**, dıştakini gölgeler. Bir değerle karşılaştırmak için `const`, `==` ya da match guard.
- `|` alternatifleri birleştirir ve iç içe yazılabilir (`Some(1 | 2)`); her alternatif **aynı isimleri** bağlamalı (**E0408**).
- Aralıklar tamsayı ve `char` için: `a..=b`, `a..b`, `a..`, `..b`, `..=b`. Kollar sırayla denenir, en özel olan değil ilk uyan kazanır.
- Struct deseni: `Nokta { x, y }` (kısaltma), `Nokta { x: yatay, .. }` (yeniden adlandır, gerisini yok say), `Nokta { x: 0, y }` (sına + bağla). Alan eksikse **E0027**.
- Desenler verinin şeklini izleyerek **sınırsız iç içe** geçebilir; bir kol hem sınar hem bağlar.
:::

```reflect
prompt: |
  `match zar { hedef => ..., _ => ... }` yazan bir arkadaşın "Neden her zaman ilk kol çalışıyor?" diye
  soruyor. Ona hem sebebi hem de en az iki düzeltme yolunu nasıl anlatırdın?
answer: |
  Desendeki `hedef` dıştaki değişkenle karşılaştırılmaz; aynı isimde **yeni** bir değişken tanımlar ve
  her değere uyar. Bu yüzden ilk kol her değeri yakalar ve `_` kolu erişilemez olur (derleyici
  `unreachable pattern` uyarısı ve "aynı isimde bir bağlama var" notu verir). Düzeltmeler: değeri bir
  `const HEDEF` yapıp desende onu kullanmak; düz bir `if zar == hedef` yazmak; ya da `z if z == hedef`
  biçiminde bir match guard kullanmak.
```

```flashcards
- front: "`let hedef = 7; match zar { hedef => ... }` neden her zaman ilk kolu çalıştırır?"
  back: "Desendeki `hedef` **yeni** bir değişkendir; dıştakini gölgeler ve her değere uyar."
- front: Desen içinde bir değerle karşılaştırma yapmak için hangi tür isim kullanılabilir?
  back: "Bir `const` (ya da enum varyantı / birim struct). `let` ile tanımlanan değişkenler desen değeri olamaz."
- front: "E0408 hata kodu ne anlama gelir?"
  back: "`|` ile bağlanan alternatiflerden biri, diğerlerinin bağladığı bir ismi bağlamıyor (*not bound in all patterns*)."
- front: "`let Ogrenci { ad: isim, .. } = o;` satırı hangi değişkeni tanımlar?"
  back: "Yalnızca `isim`. `ad` alanın adıdır, değişken değildir."
- front: "Aralık desenlerinin dört biçimi nedir?"
  back: "`a..=b` (iki uç dahil), `a..b` (üst uç hariç), `a..` (alt sınırdan yukarı), `..b` / `..=b` (üst sınırdan aşağı)."
- front: "E0027 hata kodu ne anlama gelir ve üç çözümü nedir?"
  back: "Struct deseni bir alanı anmıyor. Çözümler: alanı ekle, `alan: _` ile yok say, ya da `..` ile gerisini yok say."
- front: "`Some(1 | 2)` deseni neye eşdeğerdir?"
  back: "`Some(1) | Some(2)`: iç içe `|`."
```
