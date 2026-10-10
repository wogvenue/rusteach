---
id: m22-l03
title: "İleri tipler: takma adlar, !, DST'ler ve Sized"
minutes: 25
type: lesson
objectives:
  - "Tip takma adı (`type`) ile newtype arasındaki farkı açıklayıp uzun tipleri ve `Result` takma adlarını sadeleştirebilmek"
  - "Never tipinin (`!`) `continue`, `panic!`, `loop` ve `todo!()` ile nasıl her tipe uyduğunu açıklayabilmek"
  - "`str`, `[T]` ve `dyn Trait`'in neden dinamik boyutlu olduğunu ve neden hep bir işaretçinin arkasında durduğunu fat pointer diyagramıyla gösterebilmek"
  - "Örtük `Sized` sınırını tanıyıp `?Sized` ile `str` ve `dyn Trait` kabul eden generic fonksiyonlar yazabilmek"
keywords: [type alias, tip takma adı, never type, "!", Infallible, DST, dinamik boyutlu tip, Sized, "?Sized", fat pointer, E0116, E0277]
---

Modül 2'den beri `&str` yazıyorsun ama hiç `str` yazmadın. Modül 7'den beri `let ... else { continue; }`
yazıyorsun; `else` bloğu hiçbir değer üretmediği hâlde derleniyor. Her alıştırmanın başlangıç kodundaki `todo!()`,
hangi dönüş tipi beklenirse beklensin derleniyor. Bunlar tesadüf değil; arkalarında tip sisteminin
az bilinen ama her yerde iş başında olan köşeleri var.

Bu derste o köşeleri aydınlatacağız: **tip takma adları (type aliases)**, hiç dönmeyen **never tipi
(`!`)**, **dinamik boyutlu tipler (dynamically sized types, DST)** ve hepsini birbirine bağlayan
**`Sized`** trait'i.

## Tip takma adları

`type` anahtar kelimesi var olan bir tipe **ikinci bir isim** verir. Tahmin et:

```predict
code: |
  type Kilometre = u32;

  fn main() {
      let ankara_istanbul: Kilometre = 450;
      let ek_yol: u32 = 30;
      let toplam = ankara_istanbul + ek_yol;
      println!("{toplam}");
  }
options:
  - "480"
  - Derlenmez; `Kilometre` ile `u32` toplanamaz
  - "450"
answer: 0
explanation: |
  `Kilometre` yeni bir tip **değildir**; `u32`'nin başka bir adıdır. Derleyici için ikisi tamamen aynı
  şey, bu yüzden toplanabilirler. Önceki dersteki newtype (`struct Kilometre(u32);`) olsaydı derlenmezdi.
```

Takma ad tip güvenliği getirmez, o hâlde ne işe yarar? **Okunabilirliğe**. Uzun bir tip tekrar tekrar
yazılıyorsa ona bir isim vermek hem yazımı kısaltır hem de niyeti anlatır. En yaygın iki kullanım:

```rust
use std::fmt;

// 1) Uzun tiplere kısa isim (Box<dyn Fn>: Modül 14 ve 20)
type IndirimKurali = Box<dyn Fn(u32) -> u32>;

fn kurallari_uygula(fiyat: u32, kurallar: &[IndirimKurali]) -> u32 {
    let mut sonuc = fiyat;
    for kural in kurallar {
        sonuc = kural(sonuc);
    }
    sonuc
}

// 2) Modülün hata tipini sabitleyen generic Result takma adı
#[derive(Debug)]
enum HesapHatasi {
    YetersizBakiye { eksik: u32 },
}

impl fmt::Display for HesapHatasi {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            HesapHatasi::YetersizBakiye { eksik } => write!(f, "{eksik} TL eksik"),
        }
    }
}

type Sonuc<T> = Result<T, HesapHatasi>;

fn cek(bakiye: u32, miktar: u32) -> Sonuc<u32> {
    if miktar > bakiye {
        return Err(HesapHatasi::YetersizBakiye { eksik: miktar - bakiye });
    }
    Ok(bakiye - miktar)
}

fn main() {
    let kurallar: Vec<IndirimKurali> = vec![
        Box::new(|f| f - f / 10), // %10 indirim
        Box::new(|f| if f > 500 { f - 50 } else { f }), // 500 üstüne 50 TL
    ];
    println!("Sepet: {} TL", kurallari_uygula(1000, &kurallar));

    match cek(300, 450) {
        Ok(kalan) => println!("Kalan: {kalan}"),
        Err(e) => println!("Hata: {e}"),
    }
}
```

`Sonuc<T>` kalıbını standart kütüphanede defalarca gördün: `fmt::Result`, `Result<(), fmt::Error>`'un
takma adıdır (her `Display` impl'inde onu döndürdün). `std::io::Result<T>` da `Result<T, io::Error>`'dur.
Bir modülün bütün fonksiyonları aynı hata tipini döndürüyorsa bu, imzaları belirgin biçimde kısaltır.

Takma adın sınırı, yeni bir tip olmamasıdır. Bunu orphan rule ile görmek kolay:

```compiles
code: |
  type Liste = Vec<String>;

  impl Liste {
      fn ilk(&self) -> &str {
          &self[0]
      }
  }

  fn main() {
      let l: Liste = vec![String::from("ayran")];
      println!("{}", l.ilk());
  }
answer: false
error: E0116
explanation: |
  `impl Liste` aslında `impl Vec<String>` demektir ve başka bir crate'in tipine kendi (inherent)
  metotlarını ekleyemezsin. Derleyici bunu açıkça söylüyor: “`Liste` does not define a new type, only an
  alias of `Vec<String>`”.
```

:::error
```text
error[E0116]: cannot define inherent `impl` for a type outside of the crate where the type is defined
 --> src/main.rs:3:1
  |
3 | impl Liste {
  | ^^^^^^^^^^ impl for type defined outside of crate
  |
  = help: consider defining a trait and implementing it for the type or using a newtype wrapper like `struct MyType(ExternalType);` and implement it
note: `Liste` does not define a new type, only an alias of `Vec<String>` defined here
 --> src/main.rs:1:1
  |
1 | type Liste = Vec<String>;
  | ^^^^^^^^^^
```
Önerilen iki çözüm de tanıdık: bir trait tanımla ya da **newtype** kullan.
:::

:::analogy Lakap ve kimlik kartı
Mehmet'e mahallede “Memo” denmesi yeni bir insan yaratmaz; Memo'ya yazılan mektup Mehmet'e gider.
Tip takma adı bir **lakaptır**. Newtype ise yeni bir **kimlik kartı** çıkarmaktır: Aynı kişi bile
olsa, kart üzerinde başka bir isim ve numara vardır ve birinin yerine diğeri kabul edilmez.
:::

| | `type Kilometre = u32;` | `struct Kilometre(u32);` |
|---|---|---|
| Yeni tip mi? | Hayır, aynı tip | Evet |
| `u32` ile karıştırılabilir mi? | Evet | Hayır (`E0308`) |
| Yabancı tipe impl/trait eklenebilir mi? | Hayır (`E0116`/`E0117`) | Evet |
| Ne için? | Uzun tipleri kısaltmak, niyeti adlandırmak | Tip güvenliği, kapsülleme, orphan rule |

## Hiç dönmeyen tip: !

Bazı ifadeler hiçbir zaman bir değer üretmez: `panic!` programı durdurur, `return` fonksiyondan çıkar,
`continue` döngünün başına atlar, `break`'siz bir `loop` sonsuza kadar döner. Rust'ta bu ifadelerin
tipi **never tipi**dir ve `!` ile yazılır. Bir fonksiyonun asla dönmeyeceğini de imzasında
söyleyebilirsin:

```rust,norun
fn sunucuyu_calistir() -> ! {
    loop {
        // gelen bağlantıları sonsuza kadar dinle...
    }
}

fn main() {
    sunucuyu_calistir();
}
```

`!`'in sihri şudur: **Her tipe dönüşebilir (coerce).** Hiç oluşmayacak bir değer, istediğin tipte
kabul edilebilir. Modül 3'teki tahmin oyununda geçersiz girdiyi `continue` ile atlamıştın; bu kez aynı
işi bir `match` kolunda yapalım. Tahmin et:

```predict
code: |
  fn main() {
      let girdiler = ["12", "x", "7", "", "30"];
      let mut toplam = 0;
      for g in girdiler {
          let n: u32 = match g.parse() {
              Ok(n) => n,
              Err(_) => continue,
          };
          toplam += n;
      }
      println!("{toplam}");
  }
options:
  - "49"
  - "Derlenmez; `match` kolları farklı tipte (`u32` ve `continue`)"
  - "Panik: `\"x\"` sayıya çevrilemez"
  - "42"
answer: 0
explanation: |
  `"x"` ve `""` çevrilemez; `Err` kolu `continue` ile o turu atlar: `12 + 7 + 30 = 49`. Peki `match`'in
  iki kolu nasıl aynı tipte? İlk kol `u32`, ikincisi `continue`. `continue`'nun tipi `!`'dir ve `!` her
  tipe, burada `u32`'ye dönüşebilir. `match`'in tipi bu yüzden `u32` olur.
```

Aynı kural, şu ana kadar yazdığın pek çok satırı açıklıyor:

```rust
fn bolum(a: u32, b: u32) -> u32 {
    if b == 0 {
        panic!("sıfıra bölme"); // tipi !: bu satırdan sonrası hiç çalışmaz
    }
    a / b
}

fn not_harfi(puan: u8) -> char {
    match puan {
        90..=100 => 'A',
        70..=89 => 'B',
        0..=69 => 'C',
        _ => unreachable!("puan 100'ü geçemez"), // tipi !, char yerine geçer
    }
}

fn main() {
    println!("{} {}", bolum(10, 3), not_harfi(85));
    let sayi: u32 = "15".parse().unwrap_or_else(|_| std::process::exit(1));
    println!("{sayi}");
}
```

Alıştırmaların başlangıç kodlarındaki `todo!()` da aynı kuraldan yararlanır: Tipi `!` olduğu için `Vec<String>`, `f64` ya da hangi dönüş tipi beklenirse onun yerine geçer. `std::process::exit`'in imzası `fn exit(code: i32) -> !`'dır; bu yüzden `unwrap_or_else`'in `u32`
bekleyen closure'unda kullanılabildi. `Option::unwrap`'ın içinde de aslında `None => panic!(...)`
kolu vardır.

:::info Kendi kodunda ! tipini kullanmak
Dönüş tipi olarak `-> !` kararlı Rust'tadır. Ama `!`'i bir tipin **parametresi** olarak (ör.
`Result<u32, !>`, “asla hata vermeyen sonuç”) kullanmak henüz kararlı değil. Onun yerine standart
kütüphane boş bir enum kullanır: `enum Infallible {}`. Hiç varyantı olmayan bir enum'un değeri
oluşturulamaz, yani `Result<String, Infallible>` hiçbir zaman `Err` olamaz. `String`'in `FromStr`
impl'i tam olarak bunu döndürür: Bir `&str`'yi `String`'e çevirmek asla başarısız olmaz.
:::

```quiz
question: "Başlangıç kodundaki `fn ortalama(v: &[f64]) -> f64 { todo!() }` neden derlenir?"
options:
  - "`todo!()` derleme zamanında `0.0` değerine dönüşür"
  - "`todo!()`'nun tipi `!`'dir; hiç dönmeyen bir ifade her tipin yerine geçebilir"
  - "Derleyici, `todo!()` içeren fonksiyonların dönüş tipini kontrol etmez"
  - "`todo!()` aslında `f64` döndüren özel bir fonksiyondur"
answer: 1
explanation: |
  `todo!()` çalışınca panik atar (“not yet implemented”), yani asla bir değer döndürmez. Tipi `!` olduğu
  için `f64`'e, `Vec<String>`'e ya da başka bir tipe dönüşebilir. Derleyici dönüş tipini kontrol eder;
  `!` ise bu kontrolden her zaman geçer.
feedback:
  - "`todo!()` hiçbir değere dönüşmez; çalıştığında panik atar."
  - "Doğru!"
  - "Derleyici her zaman kontrol eder; `!`'in her tipe uyması bu kontrolün bir kuralıdır."
  - "`todo!` bir makrodur ve `panic!`'e açılır; her tipte kullanılabilir, tek bir tipe bağlı değildir."
```

Şimdi `type` takma adı ve `!` ile bir sensör okuyucu yaz:

```exercise
id: m22-l03-e-sensor
title: Bozuk sensör satırlarını atlamak
difficulty: 3
prompt: |
  Bir hava istasyonunun sıcaklık sensörü her satıra bir ölçüm yazıyor, ama bazı satırlar boş ya da
  bozuk geliyor. Şunları yaz:

  1. Bu modülün hata tipi için bir takma ad: **`type Sonuc<T> = Result<T, OkumaHatasi>;`**
  2. **`fn oku(satir: &str) -> Sonuc<f64>`**: satırı kırp (`trim`); boşsa `Err(OkumaHatasi::Bos)`,
     sayıya çevrilemiyorsa `Err(OkumaHatasi::Gecersiz(kırpılmış_satır))`, değilse `Ok(değer)`.
  3. **`fn ortalama(satirlar: &[&str]) -> Option<f64>`**: okunamayan satırları `continue` ile atlayıp
     geçerlilerin ortalamasını döndürür; hiç geçerli satır yoksa `None`.
  4. **`fn kesin_oku(satir: &str) -> f64`**: satır okunamazsa hiç dönmeyen
     `fn gecersiz_veri(satir: &str) -> !` fonksiyonunu çağırır. O fonksiyon
     `geçersiz sensör verisi: <satır>` mesajıyla panik atmalı.
starter: |
  #[derive(Debug, PartialEq)]
  enum OkumaHatasi {
      Bos,
      Gecersiz(String),
  }

  // TODO: Sonuc<T> takma adını tanımla ve aşağıdaki imzalarda kullan

  fn oku(satir: &str) -> Result<f64, OkumaHatasi> {
      todo!()
  }

  fn ortalama(satirlar: &[&str]) -> Option<f64> {
      todo!()
  }

  fn gecersiz_veri(satir: &str) -> ! {
      todo!()
  }

  fn kesin_oku(satir: &str) -> f64 {
      todo!()
  }

  fn main() {
      let gunluk = ["21.5", "", "hata!", "23.5"];
      println!("{:?}", ortalama(&gunluk));
      println!("{}", kesin_oku(" 19 "));
  }
solution: |
  #[derive(Debug, PartialEq)]
  enum OkumaHatasi {
      Bos,
      Gecersiz(String),
  }

  type Sonuc<T> = Result<T, OkumaHatasi>;

  fn oku(satir: &str) -> Sonuc<f64> {
      let satir = satir.trim();
      if satir.is_empty() {
          return Err(OkumaHatasi::Bos);
      }
      match satir.parse::<f64>() {
          Ok(deger) => Ok(deger),
          Err(_) => Err(OkumaHatasi::Gecersiz(satir.to_string())),
      }
  }

  fn ortalama(satirlar: &[&str]) -> Option<f64> {
      let mut toplam = 0.0;
      let mut adet = 0;
      for satir in satirlar {
          let deger = match oku(satir) {
              Ok(d) => d,
              Err(_) => continue,
          };
          toplam += deger;
          adet += 1;
      }
      if adet == 0 {
          None
      } else {
          Some(toplam / adet as f64)
      }
  }

  fn gecersiz_veri(satir: &str) -> ! {
      panic!("geçersiz sensör verisi: {satir}")
  }

  fn kesin_oku(satir: &str) -> f64 {
      match oku(satir) {
          Ok(d) => d,
          Err(_) => gecersiz_veri(satir),
      }
  }

  fn main() {
      let gunluk = ["21.5", "", "hata!", "23.5"];
      println!("{:?}", ortalama(&gunluk));
      println!("{}", kesin_oku(" 19 "));
  }
check: tests
tests: |
  #[test]
  fn gecerli_satirlar() {
      let a: Sonuc<f64> = oku("21.5");
      assert_eq!(a, Ok(21.5));
      assert_eq!(oku("  -3 "), Ok(-3.0), "Satır kırpılmalı ve negatifler okunmalı");
  }

  #[test]
  fn hatali_satirlar() {
      assert_eq!(oku(""), Err(OkumaHatasi::Bos), "Boş satır Bos hatası vermeli");
      assert_eq!(oku("   "), Err(OkumaHatasi::Bos), "Yalnızca boşluk da boş sayılır");
      assert_eq!(oku(" 2x5 "), Err(OkumaHatasi::Gecersiz(String::from("2x5"))), "Gecersiz kırpılmış satırı taşımalı");
  }

  #[test]
  fn ortalama_bozuklari_atlar() {
      assert_eq!(ortalama(&["20", "x", "", "24", "22"]), Some(22.0), "(20 + 24 + 22) / 3 = 22");
      assert_eq!(ortalama(&["-5", "5"]), Some(0.0));
      assert_eq!(ortalama(&["?", ""]), None, "Hiç geçerli satır yoksa None");
      assert_eq!(ortalama(&[]), None, "Boş günlük için None");
  }

  #[test]
  fn kesin_oku_gecerli() {
      assert_eq!(kesin_oku(" 19 "), 19.0);
  }

  #[test]
  #[should_panic(expected = "geçersiz sensör verisi: abc")]
  fn kesin_oku_bozukta_panik() {
      kesin_oku("abc");
  }
hints:
  - "Takma ad tek satır: `type Sonuc<T> = Result<T, OkumaHatasi>;`. Sonra `oku`'nun dönüş tipini `Sonuc<f64>` yap. `oku`'da önce `let satir = satir.trim();` ile gölgele."
  - "`ortalama`'da yukarıdaki tahmin sorusunun kalıbı: `let deger = match oku(satir) { Ok(d) => d, Err(_) => continue };`. Toplamı ve adedi ayrı tut; sonda `adet == 0` ise `None`."
  - "`gecersiz_veri`: `panic!(\"geçersiz sensör verisi: {satir}\")`. `kesin_oku`: `match oku(satir) { Ok(d) => d, Err(_) => gecersiz_veri(satir) }`; ikinci kolun tipi `!` olduğu için `f64` ile uyumlu."
require:
  - pattern: "type\\s+Sonuc\\s*<\\s*T\\s*>"
    message: "`type Sonuc<T> = Result<T, OkumaHatasi>;` takma adını tanımlamalısın."
  - pattern: "continue"
    message: "`ortalama`'da bozuk satırları `continue` ile atla."
explanation: |
  `ortalama`'daki `match`'in iki kolu `f64` ve `!` tipinde; `!` `f64`'e dönüştüğü için `deger` bir
  `f64` oldu. `kesin_oku`'da da aynı şey oldu, bu sefer `!`'i kendi yazdığın bir fonksiyon üretti.
  `-> !` imzası derleyiciye “bu çağrıdan sonra kod devam etmez” sözü verir. Sözü tutmayan bir gövde
  (ör. sonunda bir değer döndüren) derlenmez.

  `Sonuc<T>` testlerde de kullanıldı: `let a: Sonuc<f64> = oku("21.5");`. `Result<f64, OkumaHatasi>`
  ile karşılaştırılabildi, çünkü ikisi **aynı tiptir**.

  Modül 14 sonrası alternatif: `satirlar.iter().filter_map(|s| oku(s).ok())` ile geçerli değerleri
  toplayıp `sum` ve `count` almak. İki çözüm de doğru; `continue`'lu döngü bu derste `!`'i görmek için.
```

## Dinamik boyutlu tipler: str, [T] ve dyn Trait

Rust her değişkenin boyutunu **derleme zamanında** bilmek ister: Bir fonksiyon çağrıldığında stack'te
ne kadar yer ayrılacağı önceden hesaplanır (Modül 4). Peki boyutu çalışma anına kadar bilinemeyen bir tip
olursa? Tahmin et:

```compiles
code: |
  fn main() {
      let s: str = *"merhaba";
      println!("{}", s.len());
  }
answer: false
error: E0277
explanation: |
  `str` “bir miktar UTF-8 bayt” demektir; `"merhaba"` 7 bayt, `"ş"` 2 bayt. Kaç bayt olduğu tipin
  içinde yazmaz. Derleyici `s` için stack'te ne kadar yer ayıracağını bilemez ve reddeder:
  “all local variables must have a statically known size”.
```

:::error
```text
error[E0277]: the size for values of type `str` cannot be known at compilation time
 --> src/main.rs:2:9
  |
2 |     let s: str = *"merhaba";
  |         ^ doesn't have a size known at compile-time
  |
  = help: the trait `Sized` is not implemented for `str`
  = note: all local variables must have a statically known size
help: consider borrowing here
  |
2 |     let s: &str = *"merhaba";
  |            +
```
Mesajda iki ipucu var: Boyutu bilinen tipler `Sized` trait'ini uygular (`str` uygulamaz) ve çözüm
**ödünç almaktır**: `&str`.
:::

`str` gibi tiplere **dinamik boyutlu tip (DST)** denir. Rust'ta üç aile vardır:

| DST | Ne? | Boyutu ne zaman belli olur? |
|---|---|---|
| `str` | Belirsiz uzunlukta UTF-8 bayt dizisi | Çalışma anında (her metinde farklı) |
| `[T]` | Belirsiz uzunlukta `T` dizisi (dilim) | Çalışma anında |
| `dyn Trait` | Trait'i uygulayan **herhangi** bir tip (Modül 20) | Çalışma anında (gerçek tipe göre) |

Bir DST'nin değerini doğrudan bir değişkende, parametrede ya da dönüş değerinde tutamazsın. Onu her zaman
bir **işaretçinin arkasında** kullanırsın: `&str`, `&[T]`, `&dyn Trait`, `Box<str>`, `Box<[T]>`,
`Box<dyn Trait>`, `Rc<str>`... Bu işaretçiler, DST'nin eksik bilgisini (uzunluğu ya da hangi tip
olduğunu) **kendi içlerinde** taşır.

Karşılaştırma için: `[i32; 3]` bir DST değildir. Uzunluk tipin parçasıdır (Modül 2, Modül 11'deki const
generic'ler) ve boyutu derleme zamanında bellidir: 12 bayt.

## Fat pointer'ın içi

Bir DST'ye işaret eden referans iki kelimeden (64 bit sistemde 2 × 8 bayt) oluşur: veri adresi +
**ek bilgi (metadata)**. Buna **fat pointer** (şişman işaretçi) denir:

- `&str` ve `&[T]`: adres + **uzunluk**
- `&dyn Trait`: adres + **vtable** adresi (Modül 20)

Boyutu belli bir tipe referans ise tek bir adresten ibarettir (thin pointer). Kendin ölç
(`std::mem::size_of::<T>()` bir tipin bayt cinsinden boyutunu verir; bellek düzenini Modül 24'te
ayrıntılı göreceğiz):

```rust
use std::fmt::Display;
use std::mem::size_of;

fn main() {
    println!("&u8          : {} bayt", size_of::<&u8>());
    println!("&String      : {} bayt", size_of::<&String>());
    println!("&str         : {} bayt", size_of::<&str>());
    println!("&[i32]       : {} bayt", size_of::<&[i32]>());
    println!("&[i32; 1000] : {} bayt", size_of::<&[i32; 1000]>());
    println!("Box<str>     : {} bayt", size_of::<Box<str>>());
    println!("&dyn Display : {} bayt", size_of::<&dyn Display>());
    println!("String       : {} bayt", size_of::<String>());
}
```

`&String` 8 bayt, çünkü `String`'in boyutu bellidir (24 bayt: işaretçi, uzunluk, kapasite). `&str` ise
16 bayt, çünkü uzunluğu kendisi taşımak zorunda. Bellekte şöyle görünür:

```memory
title: Thin ve fat pointer'lar
steps:
  - caption: "`let s = String::from(\"merhaba\");` — `String` stack'te 24 bayt (ptr, len, cap), metin heap'te."
    stack:
      - frame: main
        vars:
          - { name: s, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "`let r = &s;` — `&String` tek bir adres (8 bayt): `s`'yi gösterir. Uzunluğu `s`'nin içinden okur."
    stack:
      - frame: main
        vars:
          - { name: s, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: r, type: "&String", value: "ptr", to: s, note: "thin, 8 bayt" }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "`let d = &s[3..];` — `&str` doğrudan heap'teki 4. bayta işaret eder ve uzunluğu (4) **yanında taşır**: 16 bayt."
    stack:
      - frame: main
        vars:
          - { name: s, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: r, type: "&String", value: "ptr", to: s, note: "thin, 8 bayt" }
          - { name: d, type: "&str", value: "ptr+3 · len=4", to: h1, note: "fat, 16 bayt" }
    heap:
      - { id: h1, value: "m e r [h a b a]" }
  - caption: "`let g: Box<dyn Display> = Box::new(42);` — veri adresi + vtable adresi. Vtable, `i32`'nin `fmt` fonksiyonunu ve boyut bilgisini tutar."
    stack:
      - frame: main
        vars:
          - { name: g, type: "Box<dyn Display>", value: "ptr · vtable", to: h2, note: "fat, 16 bayt" }
    heap:
      - { id: h2, value: "42", label: "i32 (4 bayt)" }
      - { id: v1, value: "drop · size=4 · align=4 · fmt", label: "vtable: i32 as Display (statik)" }
```

Bu, Modül 5'teki bir ayrıntıyı da açıklıyor: `&String` alan bir fonksiyona `&str` veremezsin, ama
`&str` alan fonksiyona `&String` verebilirsin. Derleyici `&String`'i deref zorlamasıyla `&str`'ye
çevirirken `String`'in içinden adresi ve uzunluğu okuyup fat pointer'ı **oluşturur**. Tersi mümkün
değildir: `&str`'nin işaret ettiği yerde bir `String` başlığı yoktur.

Benzer bir dönüşüm dizilerde de var: `let d: &[i32] = &[1, 2, 3];` satırında uzunluk (3) **tipten**
çıkıp **işaretçiye** taşınır. Buna **boyut silme dönüşümü (unsizing coercion)** denir.
`Box::new(42)`'yi `Box<dyn Display>`'e çevirmek de aynı türden bir dönüşümdür; o seferinde işaretçiye
vtable eklenir.

```quiz
question: "64 bit bir sistemde `size_of::<Box<[u8]>>()` ile `size_of::<Vec<u8>>()` sırasıyla kaç bayttır?"
options:
  - "8 ve 24"
  - "16 ve 24"
  - "24 ve 24"
  - "16 ve 16"
answer: 1
explanation: |
  `Box<[u8]>` bir DST'ye işaret eden kutudur, yani fat pointer: adres + uzunluk = 16 bayt. `Vec<u8>` ise
  boyutu belli bir struct: adres + uzunluk + **kapasite** = 24 bayt. `Box<[u8]>` büyüyemez, bu yüzden
  kapasiteye ihtiyacı yoktur. Büyümesi bitmiş bir veriyi `vec.into_boxed_slice()` ile ona çevirip 8
  bayt kazanabilirsin (Modül 25'te bu tür kazançlara döneceğiz).
feedback:
  - "Box tek bir adres olurdu ama `[u8]` bir DST; uzunluk da işaretçide taşınmalı."
  - "Doğru!"
  - "`Box<[u8]>` kapasite taşımaz; büyüyemez."
  - "`Vec` kapasiteyi de tutar: 3 kelime."
```

:::deep Kendi DST'n
Bir struct'ın **son** alanı DST olabilir; o zaman struct'ın kendisi de DST olur. Pratikte bunu generic
bir tiple ve boyut silme dönüşümüyle kurarsın:

```rust
#[derive(Debug)]
struct Kutu<T: ?Sized> {
    etiket: u32,
    icerik: T, // yalnızca SON alan ?Sized olabilir
}

fn main() {
    let k: &Kutu<[i32]> = &Kutu { etiket: 7, icerik: [1, 2, 3] };
    println!("{} {:?} {}", k.etiket, &k.icerik, k.icerik.len());
}
```

`&Kutu<[i32; 3]>` → `&Kutu<[i32]>` dönüşümünde uzunluk tipten işaretçiye taşındı. Standart
kütüphanedeki `Rc<str>` ve `Arc<[T]>` içeride tam olarak bu tekniği kullanır: sayaçlar + DST veri.
:::

## Sized ve ?Sized

Derleyicinin “boyutu derleme zamanında belli” bilgisi bir trait'tir: **`Sized`**. Neredeyse her tip onu
otomatik olarak uygular; uygulamayanlar az önceki DST'lerdir. Önemli bir sürpriz: Rust her generic
parametreye **görünmez** bir `Sized` sınırı ekler. `fn yaz<T: Display>(x: &T)` aslında
`fn yaz<T: Display + Sized>(x: &T)` demektir. Çünkü çoğu generic kod `T`'yi değer olarak taşır,
kopyalar ya da döndürür ve bunlar için boyut gerekir. Bu varsayılan bazen fazla katıdır:

:::error
```text
error[E0277]: the size for values of type `str` cannot be known at compilation time
 --> src/main.rs:9:9
  |
9 |     yaz("merhaba");
  |     --- ^^^^^^^^^ doesn't have a size known at compile-time
  |     |
  |     required by a bound introduced by this call
  |
  = help: the trait `Sized` is not implemented for `str`
note: required by an implicit `Sized` bound in `yaz`
 --> src/main.rs:3:8
  |
3 | fn yaz<T: Display>(x: &T) {
  |        ^ required by the implicit `Sized` requirement on this type parameter in `yaz`
help: consider relaxing the implicit `Sized` restriction
  |
3 | fn yaz<T: Display + ?Sized>(x: &T) {
  |                   ++++++++
```
`yaz("merhaba")` çağrısında `x: &T` ile `"merhaba": &str` eşleşir, yani `T = str`. `str` `Sized`
olmadığı için örtük sınır (“implicit `Sized` bound”) çiğnenir. `help:` satırı çözümü veriyor.
:::

`?Sized` (“belki Sized”) bu örtük sınırı **kaldırır**: “`T`'nin boyutu belli olabilir de, olmayabilir
de.” Bu, Rust'ta bir sınırı genişleten tek sözdizimidir; `?Clone` ya da `?Debug` diye bir şey yoktur.
Karşılığında `T`'yi yalnızca bir işaretçinin arkasında kullanabilirsin (`&T`, `Box<T>`):

```rust
use std::fmt::{self, Display};

fn yaz<T: Display + ?Sized>(x: &T) {
    println!("<{x}>");
}

struct Para(u32);

impl Display for Para {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{} TL", self.0)
    }
}

fn main() {
    yaz(&42); // T = i32 (Sized)
    yaz("merhaba"); // T = str (DST)
    let s = String::from("dünya");
    yaz(&s); // T = String
    let nesne: Box<dyn Display> = Box::new(Para(150));
    yaz(&*nesne); // T = dyn Display (DST)
}
```

Standart kütüphane `?Sized`'ı her yerde kullanır; böylece `Box<str>`, `Rc<[T]>`, `&dyn Trait` mümkün
olur: `struct Box<T: ?Sized>`, `trait Deref { type Target: ?Sized; }`, önceki derslerdeki
`Index<Idx: ?Sized> { type Output: ?Sized; }` ve `PartialEq<Rhs: ?Sized = Self>`. Bir istisna:
Trait tanımlarındaki **`Self` varsayılan olarak `?Sized`'dır**. Bu yüzden `impl Ozet for str` yazıp
`"metin".ozet()` diyebilirsin.

Modül 20'deki trait nesneleriyle bir araya getirelim. Derlenir mi?

```compiles
question: "(Modül 20 tekrarı) Derlenir mi?"
code: |
  trait Ciz {
      fn ciz(&self) -> String;
  }

  struct Daire;

  impl Ciz for Daire {
      fn ciz(&self) -> String {
          String::from("○")
      }
  }

  fn iki_kez<T: Ciz>(sekil: &T) -> String {
      format!("{}{}", sekil.ciz(), sekil.ciz())
  }

  fn main() {
      let sekil: Box<dyn Ciz> = Box::new(Daire);
      println!("{}", iki_kez(&*sekil));
  }
answer: false
error: E0277
explanation: |
  `&*sekil` bir `&dyn Ciz`'dir, yani `T = dyn Ciz`. `dyn Ciz` derleyici tarafından otomatik olarak `Ciz`'i
  uygular, ama bir DST'dir; generic `T`'nin örtük `Sized` sınırını sağlamaz. `fn iki_kez<T: Ciz + ?Sized>`
  yazınca hem `&Daire` hem `&dyn Ciz` kabul edilir; böylece aynı fonksiyon statik ve dinamik dispatch'le
  çalışır.
```

```fill
prompt: "`toplam_uzunluk` fonksiyonu hem `&[&str]` hem `&[&String]` kabul etsin. Boşlukları doldur."
code: |
  fn toplam_uzunluk<T: AsRef<str> + ___0>(parcalar: &[&T]) -> usize {
      let mut n = 0;
      for p in parcalar {
          n += p.as_ref().chars().count();
      }
      n
  }

  fn main() {
      let a = toplam_uzunluk::<___1>(&["çay", "simit"]);
      let s = String::from("ayran");
      let b = toplam_uzunluk(&[&s]);
      println!("{a} {b}");
  }
blanks:
  - ["?Sized"]
  - ["str"]
output: "8 5"
explanation: |
  `&["çay", "simit"]` bir `&[&str; 2]` dizisidir; `&[&T]` ile eşleşince `T = str` olur. `str` DST olduğu
  için `T`'ye `?Sized` gerekir. Turbofish'te de `T`'yi `str` olarak yazdık (`&str` değil!). `AsRef<str>`
  Modül 11'den: `str` ve `String` ikisi de onu uygular. `çay` 3, `simit` 5 karakter (bayt değil
  karakter saydık).
```

```exercise
id: m22-l03-e-gunluk
title: Her şeyi kabul eden günlük kaydı
difficulty: 3
prompt: |
  Bir uygulamanın günlük (log) sistemi için iki yardımcı yazıyoruz. İkisi de `str`, `String`, sayılar ve
  `dyn Display` trait nesneleri dâhil **her `Display` tipini** kabul etmeli:

  1. **`fn etiketle<T>(etiket: &str, deger: &T) -> String`**: `[etiket] değer` döndürür. Etiket
     **büyük harfe** çevrilir: `etiketle("uyarı", "disk dolu")` → `[UYARI] disk dolu`.
  2. **`struct Kayit<'a, T>`**: bir seviye (`&'a str`) ve bir içerik (`&'a T`) tutar. `Display` impl'i
     `etiketle` ile aynı biçimi üretir.

  Başlangıç kodundaki sınırlar yalnızca boyutu belli tipleri kabul ediyor; testler `str` ve
  `dyn Display` ile çağıracak. Sınırları da düzelt!
starter: |
  use std::fmt;

  fn etiketle<T: fmt::Display>(etiket: &str, deger: &T) -> String {
      todo!()
  }

  struct Kayit<'a, T> {
      seviye: &'a str,
      icerik: &'a T,
  }

  impl<T: fmt::Display> fmt::Display for Kayit<'_, T> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      println!("{}", etiketle("bilgi", &42));
      let k = Kayit { seviye: "hata", icerik: &3.5 };
      println!("{k}");
  }
solution: |
  use std::fmt;

  fn etiketle<T: fmt::Display + ?Sized>(etiket: &str, deger: &T) -> String {
      format!("[{}] {deger}", etiket.to_uppercase())
  }

  struct Kayit<'a, T: ?Sized> {
      seviye: &'a str,
      icerik: &'a T,
  }

  impl<T: fmt::Display + ?Sized> fmt::Display for Kayit<'_, T> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}", etiketle(self.seviye, self.icerik))
      }
  }

  fn main() {
      println!("{}", etiketle("bilgi", &42));
      let k = Kayit { seviye: "hata", icerik: &3.5 };
      println!("{k}");
  }
check: tests
tests: |
  struct Sicaklik(i32);

  impl fmt::Display for Sicaklik {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}°C", self.0)
      }
  }

  #[test]
  fn sized_tiplerle() {
      assert_eq!(etiketle("bilgi", &42), "[BILGI] 42", "Etiket büyük harfe çevrilmeli (to_uppercase Türkçe kuralını bilmez: i → I)");
      assert_eq!(etiketle("hava", &Sicaklik(-4)), "[HAVA] -4°C");
  }

  #[test]
  fn str_ile() {
      assert_eq!(etiketle("uyarı", "disk dolu"), "[UYARI] disk dolu", "T = str olabilmeli (?Sized)");
  }

  #[test]
  fn trait_nesnesiyle() {
      let nesne: Box<dyn fmt::Display> = Box::new(Sicaklik(31));
      assert_eq!(etiketle("hava", &*nesne), "[HAVA] 31°C", "T = dyn Display olabilmeli (?Sized)");
  }

  #[test]
  fn kayit_display() {
      let k = Kayit { seviye: "hata", icerik: "bağlantı koptu" };
      assert_eq!(k.to_string(), "[HATA] bağlantı koptu", "Kayit<str> de çalışmalı");
      let s = String::from("yeniden deneniyor");
      let k2 = Kayit { seviye: "bilgi", icerik: &s };
      assert_eq!(k2.to_string(), "[BILGI] yeniden deneniyor");
  }
hints:
  - "Testlerdeki `etiketle(\"uyarı\", \"disk dolu\")` çağrısında `T = str` olur. Generic parametreye `?Sized` ekle: `T: fmt::Display + ?Sized`."
  - "`etiketle`'nin gövdesi tek satır: `format!(\"[{}] {deger}\", etiket.to_uppercase())`. `to_uppercase` Unicode'un dilden bağımsız kuralını uygular: hem `ı` hem `i` → `I`."
  - "`struct Kayit<'a, T: ?Sized>` ve `impl<T: fmt::Display + ?Sized> fmt::Display for Kayit<'_, T>` yaz; `fmt` içinde `write!(f, \"{}\", etiketle(self.seviye, self.icerik))`."
explanation: |
  `?Sized` üç yerde gerekti: fonksiyonun generic parametresi, struct'ın tip parametresi ve impl'in tip
  parametresi. Her biri ayrı bir generic bildirimidir ve örtük `Sized` sınırı her birine ayrı ayrı
  eklenir. `T`'yi yalnızca `&T` (ya da `&'a T`) olarak kullandığımız için bu güvenli: Referansın kendisi
  her zaman bellidir (thin ya da fat).

  `Kayit<'a, T: ?Sized>`'ın alanı `T` değil `&'a T` olduğu için `T` son alan olmak zorunda bile değildi.
  Alan doğrudan `icerik: T` olsaydı, o alan struct'ın **son** alanı olmalıydı (Derinlemesine kutusundaki
  `Kutu` gibi).

  Testlerdeki `[BILGI]` bir tuzağı hatırlatıyor (Modül 9): `to_uppercase` Unicode'un dilden bağımsız
  kuralını uygular, Türkçe'yi bilmez. `"bilgi"` → `"BILGI"` olur, `"BİLGİ"` değil. Türkçe metinleri
  doğru büyütmek için `i`'yi önce elle `İ`'ye çevirmen ya da yerel ayarı bilen bir crate kullanman gerekir.
```

## Özet

:::remember
- **`type Ad = Tip;`** bir takma addır, yeni tip değil: karışabilir, impl eklenemez (`E0116`). Uzun
  tipleri (`Box<dyn Fn..>`) ve `type Sonuc<T> = Result<T, Hata>;` kalıbını sadeleştirmek için.
- **`!` (never)**: `panic!`, `continue`, `break`, `return`, `loop {}`, `todo!()`, `unreachable!()`,
  `process::exit` hiç dönmez; `!` her tipe dönüşür. Fonksiyonda `-> !`. Tip parametresi olarak
  kararlı değil; yerine `Infallible`.
- **DST**: `str`, `[T]`, `dyn Trait`. Boyut çalışma anında belli olur; değeri ancak işaretçi arkasında
  (`&`, `Box`, `Rc`) tutulur.
- **Fat pointer** = adres + uzunluk (`&str`, `&[T]`) ya da adres + vtable (`&dyn Trait`): 16 bayt.
- Her generic parametrede **örtük `T: Sized`** vardır. `T: ?Sized` onu kaldırır; `T` artık yalnızca
  `&T`/`Box<T>` gibi işaretçi arkasında kullanılabilir. Trait'lerde `Self` zaten `?Sized`'dır.
:::

```reflect
prompt: |
  `&str` neden 16 bayt da `&String` 8 bayt? Bu fark, `&String` alan bir fonksiyona `&str`
  verilememesini ama tersinin mümkün olmasını nasıl açıklıyor? Kendi cümlelerinle anlat.
answer: |
  `String`'in boyutu bellidir (24 bayt: heap adresi, uzunluk, kapasite). Ona işaret eden `&String`'in
  yalnızca `String`'in adresini tutması yeter; uzunluğu gerektiğinde `String`'in içinden okur. `str` ise
  bir DST'dir: Uzunluk tipte yazmaz. Bu yüzden `&str` uzunluğu kendisi taşımak zorundadır: adres +
  uzunluk = 16 bayt (fat pointer).

  `&String`'den `&str` oluşturmak kolaydır: Derleyici `String`'in içindeki heap adresini ve uzunluğu
  okuyup yeni bir fat pointer kurar (deref zorlaması). Tersi imkânsızdır: Bir `&str` herhangi bir yere,
  örneğin programın içindeki bir literal'e ya da bir `String`'in ortasına işaret edebilir. Orada bir
  `String` başlığı (kapasite vb.) yoktur, yani `&String` oluşturacak bir şey yoktur.
```

```flashcards
- front: "`type Kilometre = u32;` ile `struct Kilometre(u32);` arasındaki fark nedir?"
  back: "İlki bir takma addır: `u32` ile aynı tiptir, karıştırılabilir. İkincisi newtype'tır: yeni bir tiptir, `u32` yerine geçmez ve ona trait/impl eklenebilir."
- front: "`fmt::Result` ve `io::Result<T>` nedir?"
  back: "Takma adlar: `Result<(), fmt::Error>` ve `Result<T, io::Error>`. Bir modülün hata tipini sabitlemek için kullanılan kalıp."
- front: "`let n: u32 = match s.parse() { Ok(n) => n, Err(_) => continue };` neden derlenir?"
  back: "`continue`'nun tipi `!`'dir (never) ve `!` her tipe, burada `u32`'ye dönüşebilir."
- front: Tipi `!` olan beş ifade say.
  back: "`panic!(..)`, `continue`, `break`, `return`, `break`'siz `loop {}` (ayrıca `todo!()`, `unreachable!()`, `std::process::exit(..)`)."
- front: "Rust'taki üç dinamik boyutlu tip (DST) ailesi nedir?"
  back: "`str`, `[T]` (dilim) ve `dyn Trait`."
- front: "Fat pointer nedir? İki örnek ver."
  back: "Adres + ek bilgi taşıyan iki kelimelik işaretçi: `&str`/`&[T]` (adres + uzunluk), `&dyn Trait` (adres + vtable)."
- front: "`fn yaz<T: Display>(x: &T)` neden `yaz(\"merhaba\")` ile derlenmez? Düzeltmesi nedir?"
  back: "Her generic parametrede örtük `T: Sized` vardır, `T = str` ise DST'dir (`E0277`). Düzeltme: `T: Display + ?Sized`."
- front: "`?Sized` ne anlama gelir ve neyi yasaklar?"
  back: "“Belki Sized”: örtük `Sized` sınırını kaldırır. Karşılığında `T` değer olarak tutulamaz; yalnızca `&T`, `Box<T>` gibi işaretçi arkasında kullanılır."
```
