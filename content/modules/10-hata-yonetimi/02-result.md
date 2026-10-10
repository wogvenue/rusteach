---
id: m10-l02
title: Result ile Kurtarılabilir Hatalar
minutes: 16
type: lesson
objectives:
  - "`Result<T, E>`'nin ne olduğunu ve hatayı neden tipin bir parçası yaptığını açıklayabilmek"
  - "`match` ile `Ok` ve `Err` durumlarını, gerektiğinde hata türlerine göre ayırarak ele alabilmek"
  - "`unwrap`, `expect`, `unwrap_or`, `unwrap_or_else` ve `unwrap_or_default` arasından duruma uygun olanı seçebilmek"
keywords: [Result, Ok, Err, match, unwrap, expect, unwrap_or, unwrap_or_else, unwrap_or_default, is_ok, is_err, ParseIntError]
---

Modül 2'den beri metni sayıya çevirirken `"42".parse::<i32>().unwrap()` yazıyor ve `unwrap`'a "şimdilik"
diyorduk. Bu derste o kutuyu açıyoruz: `parse` aslında ne döndürüyor, `unwrap` ne yapıyor ve hata olasılığı
olan bir işlemi **paniksiz** nasıl ele alırsın?

Önceki dersteki panikler programlama hatalarıyla ilgiliydi. Kullanıcının "yirmi" yazması ise bir bug değil,
hayatın kendisi. Bu tür **beklenen** hatalar için Rust'ın aracı `Result`.

## Önce tahmin et: parse aslında ne döndürür?

`unwrap`'ı çıkarıp `parse`'ın sonucunu doğrudan yazdıralım:

```predict
code: |
  fn main() {
      let a = "42".parse::<i32>();
      let b = "kırk iki".parse::<i32>();
      println!("{a:?}");
      println!("{b:?}");
  }
options:
  - |
    Ok(42)
    Err(ParseIntError { kind: InvalidDigit })
  - |
    42
    0
  - |
    Some(42)
    None
  - |
    42
    Err
answer: 0
explanation: |
  `parse` bir sayı değil, bir **`Result`** döndürür: dönüşüm başarılıysa `Ok(42)`, değilse `Err(...)`.
  Hata tarafı boş da değil: `ParseIntError { kind: InvalidDigit }`, yani "geçersiz rakam". `0` döndürmek
  C'deki `atoi`'nin yaptığı şeydir ve büyük bir sorundur: `"0"` metniyle hatalı metni birbirinden ayıramazsın.
  `Option` ise yalnızca "yok" diyebilirdi; `Result` "yok, **çünkü**…" der.
```

`Result`, standart kütüphanede tanımlı sıradan bir enum'dur (Modül 7'yi hatırla):

```rust
# #![allow(dead_code)]
enum Result<T, E> {
    Ok(T),  // başarı: içinde T tipinde bir değer taşır
    Err(E), // başarısızlık: içinde E tipinde bir hata taşır
}
```

`T` ve `E` birer **tip parametresi (type parameter)**: `Option<T>`'deki `T` gibi "buraya bir tip gelecek"
diyen yer tutuculardır (generic'leri Modül 11'de ayrıntılı göreceğiz). `"42".parse::<i32>()`'nin tipi
`Result<i32, ParseIntError>`: başarıda bir `i32`, başarısızlıkta bir `ParseIntError`. `Option` gibi `Result`,
`Ok` ve `Err` de **prelude**'dadır, yani `use` yazmadan kullanırsın.

Standart kütüphanede başarısız olabilen her işlem `Result` döndürür:

| Çağrı | Dönüş tipi | Ne zaman `Err`? |
|---|---|---|
| `"42".parse::<i32>()` | `Result<i32, ParseIntError>` | metin geçerli bir sayı değilse |
| `File::open("ayarlar.toml")` | `Result<File, io::Error>` | dosya yoksa, okuma izni yoksa… |
| `String::from_utf8(baytlar)` | `Result<String, FromUtf8Error>` | baytlar geçerli UTF-8 değilse |
| `v.binary_search(&x)` (Modül 9) | `Result<usize, usize>` | eleman yoksa (`Err` eklenebileceği yeri söyler) |

**Neden böyle?** Java'da `Integer.parseInt("abc")` bir istisna (`NumberFormatException`) fırlatır. Bu istisna
"unchecked" türden olduğu için derleyici onu ele almanı istemez; `try/catch`'i unutursan program çalışırken
çöker. C'de `atoi("abc")`
sessizce `0` döndürür. Go'da `n, err := strconv.Atoi("abc")` yazarsın, ama `err`'i yok sayıp `n`'yi
kullanmana kimse engel olmaz. Rust'ta ise sayı **zarfın içindedir**: `Err` durumunda ne yapacağına karar
vermeden `i32`'ye ulaşamazsın. Hata olasılığı imzada görünür ve derleyici onu ele almanı ister.

:::analogy Sınav sonuç zarfı
Sınav sonucun kapalı bir zarfla gelir. Zarfı açmadan puanını öğrenemezsin. İçinden ya
"Puanınız: 452" (`Ok(452)`) ya da "Sınavınız geçersiz sayıldı — gerekçe: optik form okunamadı"
(`Err(gerekçe)`) çıkar. Zarf, hem sonucun olup olmadığını hem de yoksa **nedenini** taşır. `Result` da
böyle bir zarftır; `match` ise zarfı açmaktır.
:::

```rust
fn main() {
    let basarili: Result<u32, String> = Ok(42);
    let basarisiz: Result<u32, String> = Err(String::from("geçersiz"));
    println!("{basarili:?}");
    println!("{basarisiz:?}");
}
```

```memory
title: "Result<u32, String> bellekte"
steps:
  - caption: "Bir `Result` değeri hangi varyant olduğunu söyleyen küçük bir **etiket (tag)** ve o varyantın verisini taşır. `Err` içindeki `String`'in karakterleri her `String`'de olduğu gibi heap'te: \"geçersiz\" 8 harf ama 9 bayt, çünkü `ç` UTF-8'de 2 bayt tutar (Modül 9)."
    stack:
      - frame: main
        vars:
          - { name: basarili, type: "Result<u32, String>", value: "Ok | 42" }
          - { name: basarisiz, type: "Result<u32, String>", value: "Err | ptr · len=9 · cap=9", to: h1 }
    heap:
      - { id: h1, value: "g e ç e r s i z" }
```

Şimdi Modül 7'den bir bilgiyi yokla. `parse`'ın sonucunu doğrudan bir sayı gibi kullanırsak?

```compiles
code: |
  fn main() {
      let yas = "17".parse::<u32>();
      let gelecek_yil = yas + 1;
      println!("Seneye {gelecek_yil} yaşında olacaksın");
  }
answer: false
error: E0369
explanation: |
  Derlenmez: **E0369** — *cannot add `{integer}` to `Result<u32, ParseIntError>`*. `yas` bir `u32` değil,
  bir zarf: `Result<u32, ParseIntError>`. Modül 7'de bir `i32`'den `Option<i32>` çıkarmaya çalıştığımızda
  da aynı duvara çarpmıştık. Önce zarfı açman gerek: `match`, `unwrap_or` ya da bu dersteki diğer yollarla.

  Hata kodları neden farklı? Modül 7'de solda bir `i32` vardı: `i32` için `-` tanımlı, yalnızca sağdaki tip
  uymuyordu (**E0277**). Burada ise solda bir `Result` var ve onun için `+` **hiç** tanımlı değil (**E0369**).
```

Tipi açıkça yazarsan derleyici bir adım daha ileri gider ve sana yol bile gösterir:

:::error Derleyici hatası
```text
error[E0308]: mismatched types
 --> src/main.rs:2:20
  |
2 |     let yas: u32 = "17".parse::<u32>();
  |              ---   ^^^^^^^^^^^^^^^^^^^ expected `u32`, found `Result<u32, ParseIntError>`
  |              |
  |              expected due to this
  |
  = note: expected type `u32`
             found enum `Result<u32, ParseIntError>`
help: consider using `Result::expect` to unwrap the `Result<u32, ParseIntError>` value, panicking if the value is a `Result::Err`
  |
2 |     let yas: u32 = "17".parse::<u32>().expect("REASON");
  |                                       +++++++++++++++++
```
"`u32` bekledim, `Result<u32, ParseIntError>` buldum." Derleyicinin önerisi `expect`: zarfı açmanın bir yolu,
ama `Err` gelirse **panikler**. Öneriyi düşünmeden kabul etme; ne zaman doğru seçim olduğunu bu dersin
"unwrap ve expect" bölümünde göreceğiz.
:::

## Result'ı açmak: match

Zarfı açmanın en temel ve en açık yolu `match`: iki durumu da sen ele alırsın.

```rust
fn yas_mesaji(girdi: &str) -> String {
    match girdi.trim().parse::<u8>() {
        Ok(yas) => {
            if yas >= 18 {
                format!("{yas} yaşındasın, oy kullanabilirsin.")
            } else {
                format!("{yas} yaşındasın, {} yıl sonra oy kullanabilirsin.", 18 - yas)
            }
        }
        Err(hata) => format!("'{girdi}' bir yaş değil: {hata}"),
    }
}

fn main() {
    for girdi in ["21", " 16 ", "yirmi", ""] {
        println!("{}", yas_mesaji(girdi));
    }
}
```

`Ok(yas)` kolunda `yas` artık sıradan bir `u8`. `Err(hata)` kolunda `hata` bir `ParseIntError`: `{hata}` ile
yazdırınca insanın okuyabileceği (İngilizce) bir açıklama verir (`invalid digit found in string`,
`cannot parse integer from empty string`), `{hata:?}` ise yapıyı gösterir (`ParseIntError { kind: InvalidDigit }`).
Kullanıcıya gösterilecek mesajı kendin yazdığına dikkat et: hata bir **değer**, onunla ne istersen yapabilirsin.

```compiles
code: |
  fn main() {
      match "42".parse::<u8>() {
          Ok(sayi) => println!("Sayı: {sayi}"),
      }
  }
answer: false
error: E0004
explanation: |
  Derlenmez: **E0004** — *non-exhaustive patterns: `Err(_)` not covered*. Modül 7'den hatırla: `match`
  **kapsayıcı (exhaustive)** olmak zorunda, enum'un her varyantı ele alınmalı. `Result` da bir enum olduğu için
  `Err` kolunu yazmadan derleyemezsin. Rust'ın seni hatayı düşünmeye zorladığı yer tam olarak burası:
  "mutlu yolu" yazıp hatayı unutmak mümkün değil.
```

Peki `match` hiç yazmaz, sonucu tamamen görmezden gelirsen? Derleyici yine de sesini çıkarır:

:::warning Sonucu yok saymak
```text
warning: unused `Result` that must be used
 --> src/main.rs:3:5
  |
3 |     yas_metni.parse::<u32>();
  |     ^^^^^^^^^^^^^^^^^^^^^^^^
  |
  = note: this `Result` may be an `Err` variant, which should be handled
  = note: `#[warn(unused_must_use)]` (part of `#[warn(unused)]`) on by default
help: use `let _ = ...` to ignore the resulting value
  |
3 |     let _ = yas_metni.parse::<u32>();
  |     +++++++
```
`Result` tipi `#[must_use]` olarak işaretlidir: kullanılmayan bir `Result` gördüğünde derleyici uyarır. C'de
`fclose` ya da `write` gibi fonksiyonların dönüş kodunu yok saymak çok yaygın bir hata kaynağıdır; Rust bunu
daha derleme aşamasında yakalar. Sonucu **bilerek** yok sayıyorsan `let _ = ...;` yaz. Böylece kodu okuyan
kişi bunun bir unutkanlık değil, bir karar olduğunu anlar.
:::

## Hataları türüne göre ayırmak

Bazen "hata oldu" bilgisi yetmez; hatanın **türüne** göre farklı davranmak istersin. Bir ayar dosyası hiç
yoksa varsayılan ayarlarla devam etmek makuldür, ama dosya var da okuma iznin yoksa kullanıcıyı uyarmak
gerekir. `io::Error`'ın `kind()` metodu bu bilgiyi bir enum olarak verir:

```rust,norun
use std::fs::File;
use std::io::ErrorKind;

fn main() {
    match File::open("ayarlar.toml") {
        Ok(_dosya) => println!("Ayarlar açıldı."),
        Err(hata) => match hata.kind() {
            ErrorKind::NotFound => println!("ayarlar.toml yok; varsayılan ayarlar kullanılacak."),
            ErrorKind::PermissionDenied => println!("ayarlar.toml'u okuma iznim yok!"),
            _ => println!("Beklenmeyen bir hata: {hata}"),
        },
    }
}
```

(Bu örnek dosya sistemine eriştiği için uygulamada çalıştırılmıyor; kendi bilgisayarında `cargo run` ile
deneyebilirsin. Dosya okumayı Modül 15'teki komut satırı projesinde göreceğiz.)

Aynı fikir sayılarda da var: `ParseIntError`'ın `kind()` metodu bir `IntErrorKind` döndürür.

```rust
use std::num::IntErrorKind;

fn main() {
    for girdi in ["", "12a", "300", "250"] {
        match girdi.parse::<u8>() {
            Ok(sayi) => println!("'{girdi}' → {sayi}"),
            Err(hata) => {
                let neden = match hata.kind() {
                    IntErrorKind::Empty => "boş metin",
                    IntErrorKind::InvalidDigit => "geçersiz rakam",
                    IntErrorKind::PosOverflow => "u8 için çok büyük",
                    IntErrorKind::NegOverflow => "u8 için çok küçük",
                    _ => "başka bir sorun",
                };
                println!("'{girdi}' → hata: {neden}");
            }
        }
    }
}
```

:::tip `_` kolu neden şart?
`IntErrorKind` ve `ErrorKind`, standart kütüphanede `#[non_exhaustive]` olarak işaretlidir: "ileride yeni
varyantlar eklenebilir" demektir. Bu yüzden onlarla `match` yaparken, bütün mevcut varyantları yazmış olsan
bile bir `_` kolu eklemen gerekir. Böylece Rust'ın yeni bir sürümü yeni bir hata türü eklediğinde kodun
bozulmaz.
:::

Şimdi aynı fonksiyonu sınır değerlerle zorlayalım:

```predict
code: |
  use std::num::IntErrorKind;

  fn tur(girdi: &str) -> &str {
      match girdi.parse::<u8>() {
          Ok(_) => "tamam",
          Err(hata) => match hata.kind() {
              IntErrorKind::PosOverflow => "çok büyük",
              IntErrorKind::NegOverflow => "çok küçük",
              IntErrorKind::InvalidDigit => "geçersiz rakam",
              _ => "diğer",
          },
      }
  }

  fn main() {
      println!("{}", tur("255"));
      println!("{}", tur("256"));
      println!("{}", tur("-5"));
  }
options:
  - |
    tamam
    çok büyük
    geçersiz rakam
  - |
    tamam
    çok büyük
    çok küçük
  - |
    çok büyük
    çok büyük
    çok küçük
  - |
    tamam
    diğer
    geçersiz rakam
answer: 0
explanation: |
  `255`, `u8`'in en büyük değeri (Modül 2): sığar. `256` sığmaz, `PosOverflow`. Sürpriz, `-5`'te: `u8`
  **işaretsiz** bir tip olduğu için `-` onun gözünde bir rakam bile değildir, sonuç `InvalidDigit` olur.
  `NegOverflow` yalnızca işaretli tiplerde, sayı çok küçük olduğunda çıkar: `"-200".parse::<i8>()` gibi.
  (Tersine bir sürpriz: baştaki `+` işaretine izin verilir, `"+5".parse::<u8>()` → `Ok(5)`. Boşluklara ise
  izin verilmez: `" 5"` → `InvalidDigit`; önce `trim` gerekir.)
```

## unwrap ve expect: "Eminim" demek

Modül 2'den beri kullandığın `unwrap`, aslında küçük bir `match`'tir. Kabaca şuna eşdeğerdir:

```rust
# fn main() {
let sonuc: Result<u8, std::num::ParseIntError> = "42".parse();
let sayi = match sonuc {
    Ok(deger) => deger,
    Err(hata) => panic!("called `Result::unwrap()` on an `Err` value: {hata:?}"),
};
println!("{sayi}");
# }
```

Yani `unwrap` "`Ok` ise değeri ver, `Err` ise **panikle**" der. Panik mesajı hatayı `{:?}` ile yazdığı için
`Result`'ta `unwrap`/`expect` ancak hata tipi `Debug` ise çağrılabilir (beşinci derste kendi hata tiplerine
bu yüzden `#[derive(Debug)]` ekleyeceğiz). `"yirmi".parse::<u8>().unwrap()` şunu üretir:

:::error Panik mesajı
```text
thread 'main' (10) panicked at src/main.rs:2:35:
called `Result::unwrap()` on an `Err` value: ParseIntError { kind: InvalidDigit }
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Mesaj, hatanın `Debug` görünümünü içerir ama **neden** başarı beklediğini söylemez. Yüz tane `unwrap` olan bir
programda bu mesaj tek başına pek yol göstermez.
:::

`expect` aynı işi yapar, ama panik mesajının başına **senin** cümleni koyar. Ayar dosyasına yanlışlıkla bir
sıfır fazla yazılmış bir port numarası düşün:

```rust,should_panic
fn main() {
    let ayar = "80800";
    let port: u16 = ayar.parse().expect("port ayarı 0-65535 arası bir sayı olmalı");
    println!("Sunucu {port} portunda");
}
```

:::error Panik mesajı
```text
thread 'main' (14) panicked at src/main.rs:3:34:
port ayarı 0-65535 arası bir sayı olmalı: ParseIntError { kind: PosOverflow }
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Önce senin mesajın, iki noktadan sonra da asıl hata. Hangi varsayımın çöktüğü ilk bakışta belli.
:::

**İyi bir `expect` mesajı nasıl yazılır?** "Expect" İngilizcede "beklemek" demek. Rust topluluğunun önerisi,
mesajı "ne ters gitti" diye değil, "neden başarılı olmasını **bekliyordun**" diye yazmak:
`.expect("VARSAYILAN_PORT sabiti geçerli bir u16 olmalı")`. Panik olduğunda bu cümle doğrudan çöken varsayımı
gösterir. Panik mesajları kullanıcı için değil, **programcı** için yazılır.

```quiz
question: "Aşağıdaki `expect` mesajlarından hangisi en faydalıdır?"
options:
  - "`.expect(\"hata\")`"
  - "`.expect(\"parse başarısız oldu\")`"
  - "`.expect(\"VARSAYILAN_PORT sabiti geçerli bir u16 olmalı\")`"
  - "`.expect(\"Bir sorun oluştu, lütfen tekrar deneyin\")`"
answer: 2
explanation: |
  İyi bir `expect` mesajı, kodun **hangi varsayıma** güvendiğini anlatır. Panik olduğunda okuyan kişi neyin
  bozulduğunu ve nereye bakması gerektiğini hemen anlar. "Hata" ya da "parse başarısız" zaten panik
  mesajının kendisinden belli; yeni bir bilgi vermez.
feedback:
  - Bu mesaj hiçbir bilgi taşımıyor; panik olduğu zaten belli.
  - "Asıl hata (`ParseIntError`) mesajın sonuna zaten eklenir. Bu cümle, neden başarı beklediğini söylemiyor."
  - Doğru! Hangi varsayımın çöktüğünü tek cümlede söylüyor.
  - "Panik mesajları kullanıcıya değil, programcıya yöneliktir. Kullanıcıya gösterilecek bir mesaj varsa hata `Result` ile ele alınmalı."
```

:::ferris
`unwrap` kötü değil: hızlı denemelerde, örneklerde ve testlerde çok işe yarar. Ama her `unwrap`, "burada hata
olamaz" diye imzaladığın küçük bir senettir. Hangi senetlerin güvenli olduğunu altıncı derste konuşacağız. 🦀
:::

## Varsayılan değerle devam etmek: unwrap_or ailesi

Çoğu zaman hata durumunda programı durdurmak değil, makul bir **varsayılan değerle** devam etmek istersin.
Modül 7'de `Option` için `unwrap_or`'u görmüştün; `Result`'ta da aynısı ve iki kardeşi var:

```rust
fn main() {
    for g in ["12", "on", "7"] {
        let a = g.parse::<u32>().unwrap_or(1);
        let b = g.parse::<u32>().unwrap_or_default();
        let c = g.parse::<u32>().unwrap_or_else(|hata| {
            println!("  ('{g}' okunamadı: {hata})");
            0
        });
        println!("{g}: {a} {b} {c}");
    }
}
```

- `unwrap_or(1)`: `Err` ise verdiğin değeri (`1`) kullanır.
- `unwrap_or_default()`: `Err` ise tipin **varsayılan değerini** kullanır: sayılar için `0`, `String` için boş
  metin, `Vec` için boş vektör (bu varsayılanları sağlayan `Default` trait'ini Modül 11'de göreceğiz).
- `unwrap_or_else(|hata| { ... })`: `Err` ise verdiğin **closure**'ı hatayla birlikte çağırır ve onun
  sonucunu kullanır. Closure, yerinde yazılan küçük ve isimsiz bir fonksiyondur. Modül 9'da `sort_by_key`
  ile önizlemiştik, Modül 14'te derinlemesine göreceğiz.

Peki `unwrap_or` dururken `unwrap_or_else`'e neden ihtiyaç var? Tahmin et:

```predict
code: |
  fn yedek() -> u32 {
      println!("yedek hesaplandı");
      7
  }

  fn main() {
      let a = "5".parse::<u32>().unwrap_or(yedek());
      let b = "5".parse::<u32>().unwrap_or_else(|_| yedek());
      println!("{a} {b}");
  }
options:
  - |
    5 5
  - |
    yedek hesaplandı
    5 5
  - |
    yedek hesaplandı
    yedek hesaplandı
    5 5
  - |
    yedek hesaplandı
    7 5
answer: 1
explanation: |
  Rust bir fonksiyonu çağırmadan **önce** argümanlarını hesaplar. `unwrap_or(yedek())` satırında `yedek()`,
  `parse` başarılı olsa bile çalışır (buna **eager**, yani hevesli değerlendirme denir); sonuç yine `5` olur,
  hesaplanan `7` çöpe gider. `unwrap_or_else(|_| yedek())` ise closure'ı yalnızca `Err` durumunda çağırır
  (**lazy**, tembel). `|_|` "hata parametresini kullanmayacağım" demektir.
  Kural: Yedek değer sabit ve ucuzsa (`0`, `"?"`) `unwrap_or`; hesaplanması pahalıysa ya da yan etkisi
  varsa `unwrap_or_else`.
```

| Metot | `Ok(v)` ise | `Err(e)` ise | Ne zaman? |
|---|---|---|---|
| `unwrap()` | `v` | panik (hatanın `Debug` hâliyle) | hızlı denemeler, testler |
| `expect("…")` | `v` | panik (senin mesajın + hata) | `Err`'in imkânsız olduğundan eminsen, gerekçesiyle |
| `unwrap_or(yedek)` | `v` | `yedek` | yedek, sabit ve ucuz bir değerse |
| `unwrap_or_else(closure)` | `v` | closure'ın sonucu | yedek hesaplanıyorsa ya da hataya bakmak gerekiyorsa |
| `unwrap_or_default()` | `v` | tipin varsayılanı (`0`, `""`…) | "olmazsa sıfır/boş" yeterliyse |
| `is_ok()` / `is_err()` | `true` / `false` | `false` / `true` | sadece başarılı olup olmadığını soruyorsan |

```fill
prompt: |
  Bir depo görevlisi, sayım sırasında raflardaki ürün adetlerini metin olarak girmiş; bazı girişler hatalı.
  Program hatalı girişleri **saysın** ve onları toplama `0` olarak katsın. Boşlukları doldur.
code: |
  fn main() {
      let adetler = ["3", "iki", "5", "", "0"];
      let mut toplam = 0;
      let mut hatali = 0;
      for metin in adetler {
          let sonuc = metin.parse::<u32>();
          if sonuc.___0() {
              hatali += 1;
          }
          toplam += sonuc.___1;
      }
      println!("toplam: {toplam}, hatalı: {hatali}");
  }
blanks:
  - ["is_err"]
  - ["unwrap_or_default()", "unwrap_or(0)"]
output: |
  toplam: 8, hatalı: 2
explanation: |
  `is_err()` yalnızca soru sorar, `Result`'ı **tüketmez** (`&self` alır), bu yüzden `sonuc`'u sonraki satırda
  hâlâ kullanabiliyoruz. `unwrap_or_default()` ise `self` alır ve `Result`'ı tüketir: `Ok(v)` ise `v`'yi,
  `Err` ise `u32`'nin varsayılanı olan `0`'ı verir. `unwrap_or(0)` da aynı sonucu verir. `"iki"` ve `""`
  hatalı; geçerli adetlerin toplamı 3 + 5 + 0 = 8.
```

```exercise
id: m10-e-not-ayikla
title: Not tablosunu ayıkla
difficulty: 2
prompt: |
  Bir öğretmen, notları bir tablodan metin olarak dışa aktarmış. Hücrelerin bazıları sorunlu: `"GR"`
  (girmedi), boş hücreler, `"105"` gibi aralık dışı değerler, `"-3"` gibi yazım hataları. Bazı hücrelerin
  başında ya da sonunda boşluk da var.

  `notlari_ayikla(hucreler)` fonksiyonunu yaz. Fonksiyon şunları döndürsün:
  - geçerli notları (baştaki/sondaki boşluklar temizlendikten sonra **0-100** arası tam sayılar) geliş
    sırasıyla bir `Vec<u8>` içinde,
  - geçersiz hücre **sayısını** bir `usize` olarak.

  Panik yok: `unwrap` ve `expect` kullanma.
starter: |
  fn notlari_ayikla(hucreler: &[&str]) -> (Vec<u8>, usize) {
      todo!()
  }

  fn main() {
      let tablo = ["85", " 92 ", "GR", "", "105", "70"];
      let (notlar, hatali) = notlari_ayikla(&tablo);
      println!("Geçerli notlar: {notlar:?}");
      println!("Hatalı hücre: {hatali}");
  }
solution: |
  fn notlari_ayikla(hucreler: &[&str]) -> (Vec<u8>, usize) {
      let mut notlar = Vec::new();
      let mut hatali = 0;
      for hucre in hucreler {
          match hucre.trim().parse::<u8>() {
              Ok(not) => {
                  if not <= 100 {
                      notlar.push(not);
                  } else {
                      hatali += 1;
                  }
              }
              Err(_) => hatali += 1,
          }
      }
      (notlar, hatali)
  }

  fn main() {
      let tablo = ["85", " 92 ", "GR", "", "105", "70"];
      let (notlar, hatali) = notlari_ayikla(&tablo);
      println!("Geçerli notlar: {notlar:?}");
      println!("Hatalı hücre: {hatali}");
  }
check: tests
tests: |
  #[test]
  fn karisik_tablo() {
      let (notlar, hatali) = notlari_ayikla(&["85", " 92 ", "GR", "", "100", "0"]);
      assert_eq!(notlar, vec![85, 92, 100, 0], "geçerli notlar geliş sırasıyla, boşlukları temizlenmiş olmalı");
      assert_eq!(hatali, 2, "\"GR\" ve boş hücre hatalı sayılmalı");
  }

  #[test]
  fn aralik_disi_ve_negatifler_hatali() {
      let (notlar, hatali) = notlari_ayikla(&["101", "255", "256", "-3", "7"]);
      assert_eq!(notlar, vec![7], "yalnızca 7 geçerli: 101 ve 255 aralık dışı, 256 ve -3 u8'e bile çevrilemez");
      assert_eq!(hatali, 4, "dört hücre hatalı olmalı");
  }

  #[test]
  fn bos_tablo() {
      assert_eq!(notlari_ayikla(&[]), (vec![], 0), "boş tabloda ne not ne hata olur");
  }

  #[test]
  fn hepsi_gecerli() {
      assert_eq!(notlari_ayikla(&["50", "60"]), (vec![50, 60], 0), "hatasız tabloda hatalı sayısı 0 olmalı");
  }
hints:
  - "Her hücre için `hucre.trim().parse::<u8>()` dene. Sonuç bir `Result<u8, ParseIntError>`."
  - "`match` ile iki kolu ayır: `Ok(not)` kolunda ayrıca `not <= 100` kontrolü yap; `Err(_)` kolunda yalnızca hatalı sayacını artır."
  - "İki değişken tut: `let mut notlar = Vec::new();` ve `let mut hatali = 0;`. Döngüden sonra `(notlar, hatali)` döndür."
forbid:
  - pattern: "\\.unwrap\\(|\\.expect\\("
    message: "Bu alıştırma paniksiz olmalı: `unwrap`/`expect` yerine `match` kullan."
explanation: |
  `parse::<u8>()`, 255'ten büyük sayıları ve eksi işaretli metinleri zaten `Err` olarak reddeder. 101-255
  arasını ise biz eledik: `u8`'e sığıyorlar ama not değiller. Burada iki ayrı katman var: **tip** düzeyinde
  geçerlilik (`u8`'e çevrilebiliyor mu?) ve **iş kuralı** düzeyinde geçerlilik (0-100 arasında mı?).

  Hatalı hücreler programı durdurmuyor, sadece sayılıyor. Kullanıcı girdisi için doğru tavır budur:
  `"GR"` bir bug değil, beklenen bir durum. `for hucre in hucreler` döngüsünde `hucre`'nin tipi `&&str`'dir;
  `trim()` gibi metot çağrılarında Rust referansları kendiliğinden takip eder (Modül 5).
```

## Özet

:::remember
- Beklenen başarısızlıklar `Result<T, E>` ile döner: `Ok(değer)` ya da `Err(hata)`. Hata bir **değerdir**.
- Değer zarfın içindedir: `Err` durumunda ne olacağına karar vermeden `T`'ye ulaşamazsın.
- `match` iki kolu da ister (E0004); kullanılmayan bir `Result` uyarı üretir (`#[must_use]`).
- `kind()` ile hataları türüne göre ayırabilirsin (`ErrorKind`, `IntErrorKind`); `_` kolu şart.
- `unwrap`/`expect` `Err`'de panikler. `expect` mesajında neden başarı **beklediğini** yaz.
- Varsayılanla devam: `unwrap_or` (sabit ve ucuz), `unwrap_or_else` (hesaplanan, lazy), `unwrap_or_default`.
:::

```reflect
prompt: "Go'da `n, err := strconv.Atoi(s)` yazıp `err`'i hiç kontrol etmeden `n`'yi kullanabilirsin. Rust'ta ise `Result<i32, ParseIntError>`'ın içindeki `i32`'ye hatayı ele almadan ulaşamazsın. Bu tasarım farkı ne tür hataları önler? Bedeli nedir?"
answer: |
  Model cevap: Go'da hata kontrolünü unutursan program hatalı bir varsayılan değerle (0) sessizce devam eder
  ve yanlış sonuç, çok daha sonra ve alakasız bir yerde ortaya çıkar. Rust'ta değer `Result`'ın içinde
  olduğu için ona ulaşmanın her yolu (`match`, `unwrap_or`, `expect`...) `Err` durumunda ne olacağına dair
  açık bir karar içerir. "Kontrol etmeyi unuttum" diye bir hata türü ortadan kalkar; `unwrap` bile bilinçli
  ve kod incelemesinde göze batan bir karardır. Bedeli biraz daha fazla yazmaktır, ama bu yükü `?` operatörü
  (sonraki ders) ve `unwrap_or` ailesi büyük ölçüde hafifletir.
```

```flashcards
- front: "`Result<T, E>`'nin iki varyantı nedir, her biri ne taşır?"
  back: "`Ok(T)`: başarı ve değer; `Err(E)`: başarısızlık ve hata (nedeni)."
- front: "`\"abc\".parse::<i32>()` ifadesinin tipi ve değeri nedir?"
  back: "Tipi `Result<i32, ParseIntError>`, değeri `Err(ParseIntError { kind: InvalidDigit })`."
- front: Kullanılmayan bir `Result` için derleyici ne yapar? Bilerek yok saymak için ne yazarsın?
  back: "`unused_must_use` uyarısı verir (`Result` `#[must_use]`'dur). Bilerek yok saymak için `let _ = ...;`"
- front: "`unwrap` ile `expect(\"…\")` arasındaki fark nedir?"
  back: "İkisi de `Ok`'ta değeri verir, `Err`'de panikler. `expect` panik mesajının başına senin cümleni ekler."
- front: İyi bir `expect` mesajı neyi anlatır?
  back: "Neden başarı **beklediğini**, yani kodun güvendiği varsayımı. Örnek: `\"VARSAYILAN_PORT sabiti geçerli bir u16 olmalı\"`"
- front: "`r.unwrap_or(f())` ile `r.unwrap_or_else(|_| f())` arasındaki fark nedir?"
  back: "`unwrap_or`'da `f()` her durumda çalışır (eager); `unwrap_or_else`'te closure yalnızca `Err` durumunda çağrılır (lazy)."
- front: "`\"x\".parse::<u32>().unwrap_or_default()` neyi döndürür?"
  back: "`0`: `u32`'nin varsayılan değeri."
- front: "`\"-5\".parse::<u8>()` hangi hata türünü (`IntErrorKind`) verir?"
  back: "`InvalidDigit`: `u8` işaretsiz olduğu için `-` geçersiz bir rakamdır. (`NegOverflow` yalnızca işaretli tiplerde çıkar.)"
```
