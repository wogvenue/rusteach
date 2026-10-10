---
id: m10-l03
title: "? Operatörü ile Hata Yayma"
minutes: 16
type: lesson
objectives:
  - Bir hatayı önce `match` ile elle, sonra `?` ile çağırana iletebilmek (hata yayma)
  - "`?`'nin hangi fonksiyonlarda kullanılabildiğini bilip E0277 ve E0308 hatalarını okuyup düzeltebilmek"
  - "`main`'i `Result` döndürecek şekilde yazabilmek ve `Box<dyn Error>`'ın neden işe yaradığını açıklayabilmek"
keywords: ["?", hata yayma, error propagation, E0277, E0308, "Box<dyn Error>", main, From]
---

Önceki derste hatayı, oluştuğu yerde ele aldık: `match` ile açtık, varsayılan değer verdik. Ama çoğu zaman
hatayı gören fonksiyon, onunla ne yapılacağını **bilemez**. Bir fiş satırını okuyan fonksiyon hatalı bir
fiyat gördüğünde kullanıcıya mesaj mı göstermeli, satırı mı atlamalı, programı mı durdurmalı? Bu kararı
verecek olan, onu **çağıran** koddur.

Hatayı yukarıya, çağırana iletmeye **hata yayma (error propagation)** denir. Rust'ta bunun tek karakterlik
bir yolu var: `?`.

## Hatayı çağırana iletmek

Bir market fişinin satırlarını okuyoruz: adet ve birim fiyat metin olarak geliyor. Fonksiyon, hata
olasılığını imzasında açıkça söylüyor: `Result<u32, ParseIntError>`.

```rust
use std::num::ParseIntError;

fn satir_tutari(adet: &str, birim_fiyat: &str) -> Result<u32, ParseIntError> {
    let adet = match adet.trim().parse::<u32>() {
        Ok(sayi) => sayi,
        Err(hata) => return Err(hata), // hatayı olduğu gibi çağırana ilet
    };
    let fiyat = match birim_fiyat.trim().parse::<u32>() {
        Ok(sayi) => sayi,
        Err(hata) => return Err(hata),
    };
    Ok(adet * fiyat)
}

fn main() {
    println!("{:?}", satir_tutari("3", "25"));
    println!("{:?}", satir_tutari("üç", "25"));
    match satir_tutari("2", "") {
        Ok(tutar) => println!("Tutar: {tutar} TL"),
        Err(hata) => println!("Fiş satırı okunamadı: {hata}"),
    }
}
```

Her `match`'in iki işi var: `Ok` ise değeri çıkarıp bir değişkene koymak, `Err` ise fonksiyondan **hemen**
`return Err(hata)` ile çıkmak. Her şey yolundaysa son satır sonucu `Ok(...)` ile sarıp döndürür.
`satir_tutari` hatayı kendisi ele almaz; onu bir **değer** olarak yukarı iletir. Ne yapılacağına `main` karar
verir: ilk iki çağrıda sonucu olduğu gibi yazdırır, üçüncüsünde kullanıcıya bir mesaj gösterir.

```quiz
question: "Bu tasarımda, hatalı bir fiş satırıyla karşılaşıldığında **ne yapılacağına** kim karar veriyor?"
options:
  - "`satir_tutari`: hatayı gören o, karar da onun"
  - "`satir_tutari`'yı çağıran kod (burada `main`)"
  - "Derleyici: `Result` döndüren her fonksiyonda hatayı otomatik olarak ele alır"
  - "Kimse: `return Err(hata)` hatayı yok eder"
answer: 1
explanation: |
  `satir_tutari` yalnızca "başarısız oldum, nedeni de bu" der ve hatayı bir **değer** olarak döndürür. Bu
  hatayla ne yapılacağına çağıran karar verir: kullanıcıya mesaj göstermek, satırı atlamak, varsayılan
  kullanmak... Aynı fonksiyon, bir yerde mesaj gösteren, başka bir yerde satırı atlayan kodlar tarafından
  rahatça kullanılabilir. Hata yaymanın asıl gücü bu esneklik.
feedback:
  - "Hatayı **gören** `satir_tutari`, ama bağlamı bilmiyor: bir terminal programında mı, bir web sunucusunda mı çalıştığını bilemez."
  - Doğru! Fonksiyon hatayı bildirir, kararı çağıran verir.
  - "Derleyici yalnızca `Result`'ı ele almanı **ister**, ne yapacağına karar vermez."
  - "`return Err(hata)` hatayı yok etmez; onu çağırana bir değer olarak teslim eder."
```

## ? operatörü

Yukarıdaki iki `match`, Rust'ta o kadar sık yazılır ki bunun için tek karakterlik bir operatör var. Aynı
fonksiyon `?` ile:

```rust
use std::num::ParseIntError;

fn satir_tutari(adet: &str, birim_fiyat: &str) -> Result<u32, ParseIntError> {
    let adet = adet.trim().parse::<u32>()?;
    let fiyat = birim_fiyat.trim().parse::<u32>()?;
    Ok(adet * fiyat)
}

fn main() {
    println!("{:?}", satir_tutari("3", "25"));
    println!("{:?}", satir_tutari("üç", "25"));
}
```

Peki `?` tam olarak ne yapıyor? Açıklamadan önce tahmin et:

```predict
code: |
  use std::num::ParseIntError;

  fn topla(a: &str, b: &str) -> Result<i32, ParseIntError> {
      println!("a okunuyor");
      let x = a.parse::<i32>()?;
      println!("b okunuyor");
      let y = b.parse::<i32>()?;
      Ok(x + y)
  }

  fn main() {
      println!("{:?}", topla("x", "2"));
  }
options:
  - |
    a okunuyor
    Err(ParseIntError { kind: InvalidDigit })
  - |
    a okunuyor
    b okunuyor
    Err(ParseIntError { kind: InvalidDigit })
  - |
    a okunuyor
    b okunuyor
    Ok(2)
answer: 0
explanation: |
  `a.parse::<i32>()` bir `Err` döndürdüğü anda `?` fonksiyondan **hemen** çıkar ve bu `Err`'i çağırana
  döndürür. `b okunuyor` satırına hiç gelinmez. `?` hatalı değeri atlayıp devam etmez (o zaman sonuç
  `Ok(2)` olurdu); işi orada keser.
```

`ifade?` şu anlama gelir: **`Ok(v)` ise ifadenin değeri `v` olur; `Err(e)` ise fonksiyondan hemen
`Err(e)` ile dönülür.** Kabaca şu `match`'e dönüşür:

```rust
# use std::num::ParseIntError;
# pub fn adet_oku(metin: &str) -> Result<u32, ParseIntError> {
// let adet = metin.parse::<u32>()?;  satırı kabaca şuna dönüşür:
let adet = match metin.parse::<u32>() {
    Ok(deger) => deger,
    Err(hata) => return Err(From::from(hata)),
};
#     Ok(adet)
# }
```

Elle yazdığımız `match`'ten tek farkı `From::from(hata)`: `?`, hatayı fonksiyonun dönüş tipindeki hata tipine
**dönüştürmeyi** dener. Şimdilik ikisi de `ParseIntError`, yani hiçbir şey değişmez. Bu küçük ayrıntı, bu
dersin sonunda `Box<dyn Error>` ile çok işimize yarayacak.

:::analogy Kalite kontrol bandı
Bir üretim bandında her istasyon parçayı işleyip bir sonrakine aktarır. Bir istasyon kusurlu bir parça
görürse onu kendisi tamir etmeye çalışmaz; parçayı "kusurlu" etiketiyle doğrudan çıkış rampasına gönderir ve
sonraki istasyonlar o parça için hiç çalışmaz. Ne yapılacağına (tamir, iade, hurda) vardiya amiri karar
verir. `?` bu çıkış rampasıdır: sağlam parça (`Ok`) yoluna devam eder, kusurlu parça (`Err`) hemen
çağırana gider.
:::

**Diğer dillerle karşılaştır.** Java ya da Python'daki istisnalar (exception) da hatayı kendiliğinden yukarı
taşır, ama çoğu zaman **görünmez** biçimde: hangi satırın istisna fırlatabileceği kodda işaretli değildir.
Python'da imza bunu hiç söylemez; Java'da yalnızca "checked" istisnalar imzada (`throws`) görünür,
`NumberFormatException` gibi "unchecked" olanlar görünmez. Go'da ise her çağrıdan sonra `if err != nil { return err }` yazarsın: görünür, ama her seferinde
üç satır. Rust'ın `?`'si ikisinin iyi yanlarını birleştirir: hata **görünür** (hata çıkabilecek her nokta
`?` ile işaretli, hata tipi imzada yazılı), ama yük yalnızca tek bir karakter.

:::ferris
Tek bir karakter, dört satırlık bir `match`'in yerini aldı! Rust kodunda `?`'yi her yerde göreceksin. Artık
gördüğün her `?`'yi şöyle okuyabilirsin: "burada hata çıkabilir; çıkarsa çağırana ilet". 🦀
:::

## ?'nin kuralları

`?` bir `Err` gördüğünde fonksiyondan `return Err(...)` ile çıkar. Peki fonksiyonun dönüş tipi `Result`
değilse ne olur?

```compiles
code: |
  fn main() {
      let yas: u8 = "21".parse()?;
      println!("Yaşın: {yas}");
  }
answer: false
error: E0277
explanation: |
  Derlenmez. `main`'in dönüş tipi `()`: `?` bir `Err` ile karşılaşsa, fonksiyondan bir `Err` döndürmesi
  gerekirdi, ama `main` `Result` döndürmüyor. **Kural 1:** `?` yalnızca `Result` (ya da sonraki derste
  göreceğimiz gibi `Option`) döndüren fonksiyonlarda kullanılabilir.
```

:::error Derleyici hatası
```text
error[E0277]: the `?` operator can only be used in a function that returns `Result` or `Option` (or another type that implements `FromResidual`)
 --> src/main.rs:2:31
  |
1 | fn main() {
  | --------- this function should return `Result` or `Option` to accept `?`
2 |     let yas: u8 = "21".parse()?;
  |                               ^ cannot use the `?` operator in a function that returns `()`
  |
help: consider adding return type
  |
1 ~ fn main() -> Result<(), Box<dyn std::error::Error>> {
2 |     let yas: u8 = "21".parse()?;
3 |     println!("Yaşın: {yas}");
4 +     Ok(())
  |
```
Mesajın özü ilk satırda: "`?` yalnızca `Result` ya da `Option` döndüren bir fonksiyonda kullanılabilir".
Alt kısımdaki `help`, `main`'in imzasını değiştirmeyi öneriyor: bu dersin "main de Result döndürebilir"
bölümünde tam olarak bunu yapacağız. (`FromResidual`, `?`'yi destekleyen tiplerin arkasındaki trait'in adı; şimdilik görmezden gel.)
:::

**Kural 2:** `?` kullanan bir fonksiyon, başarı durumunda da bir `Result` döndürmelidir. Bu yüzden son satır
`Ok(...)` ile sarılır. Modül 3'ten bir tuzağı hatırlayalım:

```compiles
code: |
  use std::num::ParseIntError;

  fn kare(metin: &str) -> Result<i64, ParseIntError> {
      let n = metin.parse::<i64>()?;
      Ok(n * n);
  }

  fn main() {
      println!("{:?}", kare("12"));
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308** — *expected `Result<i64, ParseIntError>`, found `()`*. Modül 3'teki tuzak:
  `Ok(n * n);` sonundaki noktalı virgül yüzünden bir **ifade (expression)** değil, bir **deyim (statement)**
  oldu. Fonksiyonun gövdesi bir değerle bitmediği için `()` döndürüyor. Derleyici çözümü de söylüyor:
  *help: remove this semicolon to return this value*.
```

`Ok`'u tamamen unutursan da derleyici ne yapman gerektiğini söyler:

:::error Derleyici hatası
```text
error[E0308]: mismatched types
 --> src/main.rs:5:5
  |
3 | fn kare(metin: &str) -> Result<i64, ParseIntError> {
  |                         -------------------------- expected `Result<i64, ParseIntError>` because of return type
4 |     let n = metin.parse::<i64>()?;
5 |     n * n
  |     ^^^^^ expected `Result<i64, ParseIntError>`, found `i64`
  |
  = note: expected enum `Result<i64, ParseIntError>`
             found type `i64`
help: try wrapping the expression in `Ok`
  |
5 |     Ok(n * n)
  |     +++     +
```
`n * n` bir `i64`, ama fonksiyon bir `Result` vaat etti. Çözüm: *try wrapping the expression in `Ok`*.
:::

## Döngülerde ve zincirlerde ?

`?` bir ifadenin sonuna eklenen bir operatör; bu yüzden her yerde kullanılabilir. Bir döngünün içinde
kullanıldığında **ilk** hatada hem döngü hem de fonksiyon biter. Açılan değerin bir metodunu da hemen
çağırabilirsin:

```rust
use std::num::ParseIntError;

// Döngüde ?: ilk hatalı satırda döngü de fonksiyon da biter.
fn toplam_adet(satirlar: &[&str]) -> Result<u32, ParseIntError> {
    let mut toplam = 0;
    for satir in satirlar {
        toplam += satir.trim().parse::<u32>()?;
    }
    Ok(toplam)
}

// Zincirde ?: açılan değerin metodunu hemen çağırabilirsin.
fn kare_toplami(a: &str, b: &str) -> Result<i64, ParseIntError> {
    Ok(a.trim().parse::<i64>()?.pow(2) + b.trim().parse::<i64>()?.pow(2))
}

fn main() {
    println!("{:?}", toplam_adet(&["3", "4", "5"]));
    println!("{:?}", toplam_adet(&["3", "dört", "5"]));
    println!("{:?}", toplam_adet(&[]));
    println!("{:?}", kare_toplami("3", " 4 "));
}
```

Bu bir **politika** seçimidir: `toplam_adet` ilk hatada durur ("ya hepsi ya hiç"). Önceki dersin
alıştırmasındaki `notlari_ayikla` ise hatalı hücreleri sayıp devam ediyordu. İkisi de doğru olabilir. Bir
banka havalesi listesinde tek bir hatalı satır bütün işlemi durdurmalıdır; bir not tablosunda ise
hatalı hücreleri raporlayıp gerisini işlemek daha kullanışlıdır.

```parsons
prompt: |
  Satırları sıraya koyarak `kalan_butce` fonksiyonunu kur: aylık bütçeden bütün harcamaları düşsün ve
  okunamayan ilk değerde hatayı çağırana iletsin. Dikkat: aralarına üç hatalı satır karışmış.
lines: |
  fn kalan_butce(butce: &str, harcamalar: &[&str]) -> Result<i64, std::num::ParseIntError> {
      let mut kalan = butce.trim().parse::<i64>()?;
      for harcama in harcamalar {
          kalan -= harcama.trim().parse::<i64>()?;
      }
      Ok(kalan)
  }
distractors: |
      let kalan = butce.trim().parse::<i64>()?;
          kalan -= harcama.trim().parse::<i64>();
      Ok(kalan);
explanation: |
  `kalan` döngüde değiştiği için `mut` olmalı. Döngüdeki `?` olmadan `parse` bir `Result` döndürür ve bir
  `i64`'ten bir `Result` çıkarılamaz. Son satırda noktalı virgül olursa fonksiyon `()` döndürür (E0308). Hata
  tipini `use` yazmadan, tam yoluyla (`std::num::ParseIntError`) da belirtebilirsin (Modül 8).
```

## main de Result döndürebilir

`main`'de `?` kullanmanın yolu, `main`'in kendisinin `Result` döndürmesidir:

```rust
use std::num::ParseIntError;

fn main() -> Result<(), ParseIntError> {
    let ogrenci: u32 = "28".parse()?;
    let grup: u32 = "4".parse()?;
    println!("Her grupta {} öğrenci var.", ogrenci / grup);
    Ok(())
}
```

`Ok(())`, "başarılı, ama döndürecek bir değerim yok" demektir: `()` **birim tipidir (unit type)**, Modül 3'te
gördüğün "boş değer". `"4"` yerine `"dört"` yazıp çalıştırırsan program panik atmadan şunu yazar:

:::error Program çıktısı (stderr)
```text
Error: ParseIntError { kind: InvalidDigit }
```
`main` bir `Err` döndürdüğünde Rust hatayı `Debug` görünümüyle stderr'e yazar ve programı **1** çıkış koduyla
bitirir. Panik mesajı ve backtrace ipucu yoktur; çıkış kodu da panikteki 101 değil, 1'dir. Komut satırı
araçlarının çoğu hatayla bittiğinde 1 döndürür.
:::

Bir sorun var: gerçek programlarda farklı işlemler **farklı** hata tipleri üretir. Adet tam sayı, fiyat
ondalıklı olsun:

```rust,compile_fail,E0277
use std::num::ParseIntError;

fn main() -> Result<(), ParseIntError> {
    let adet: u32 = "3".parse()?;
    let fiyat = "12.5".parse::<f64>()?;
    println!("Tutar: {} TL", adet as f64 * fiyat);
    Ok(())
}
```

:::error Derleyici hatası
```text
error[E0277]: `?` couldn't convert the error to `ParseIntError`
 --> src/main.rs:5:38
  |
3 | fn main() -> Result<(), ParseIntError> {
  |              ------------------------- expected `ParseIntError` because of this
4 |     let adet: u32 = "3".parse()?;
5 |     let fiyat = "12.5".parse::<f64>()?;
  |                        --------------^ the trait `From<ParseFloatError>` is not implemented for `ParseIntError`
  |                        |
  |                        this can't be annotated with `?` because it has type `Result<_, ParseFloatError>`
  |
  = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
```
`f64` okumak bir `ParseFloatError` üretir, ama `main` yalnızca `ParseIntError` döndürebileceğini söylemiş.
`?`, `From::from` ile dönüştürmeyi denedi ama `ParseFloatError`'ı `ParseIntError`'a çevirmenin bir yolu yok.
Dönüştürmenin `?`'nin içinde gizli olduğunu, son satırdaki `note` açıkça söylüyor.
:::

Çözüm, "**her türlü** hatayı taşıyabilen" bir hata tipi kullanmak:

```rust
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let adet: u32 = "3".parse()?;
    let fiyat = "12.5".parse::<f64>()?;
    println!("Tutar: {} TL", adet as f64 * fiyat);
    Ok(())
}
```

:::info Önizleme: `Box<dyn Error>`
`Box<dyn Error>`'ı şimdilik "**her türlü hatayı taşıyabilen bir kutu**" olarak düşün. Üç parçası var ve her
birini ileride ayrıntılı göreceğiz:
- `Error`: standart kütüphanedeki bütün hata tiplerinin uyguladığı ortak bir **trait** (Modül 11).
- `dyn Error`: "`Error` trait'ini uygulayan herhangi bir tip", hangisi olduğu derleme zamanında bilinmez (Modül 20).
- `Box`: değeri heap'e koyan akıllı işaretçi (Modül 17). Farklı hata tiplerinin boyutları farklı olduğu için
  hata heap'e konur ve stack'te yalnızca onu gösteren işaretçi kalır.

`?`'nin içindeki `From::from`, her standart hatayı bu kutuya kendiliğinden koyar. Bu imza
`main` için ve hızlı denemeler için idealdir. Kütüphane kodunda ise beşinci dersteki gibi **kendi hata
tiplerini** tasarlamak daha iyidir; çağıran, hatanın ne olduğunu tam olarak bilmeli.
:::

Fiyatı Türkçe alışkanlığıyla virgülle, `"12,5"` diye yazarsan ne olur? `f64` ondalık ayırıcı olarak yalnızca
noktayı tanır, yani `parse` başarısız olur ve `?` hatayı kutuya koyup `main`'den döndürür:

```memory
title: "? hatayı kutulayıp main'den döndürür"
steps:
  - caption: "`\"12,5\".parse::<f64>()` başarısız oldu. Sonuç, `main`'in çerçevesinde geçici bir değer: `Err(ParseFloatError)`. `?` bu değeri inceliyor."
    stack:
      - frame: main
        vars:
          - { name: adet, type: u32, value: "3" }
          - { name: "(parse sonucu)", type: "Result<f64, ParseFloatError>", value: "Err | ParseFloatError { kind: Invalid }" }
    heap: []
  - caption: "`?`, `Err`'i görünce `From::from(hata)` çağırır ve hata heap'teki bir kutuya taşınır. `Box<dyn Error>` stack'te iki işaretçi tutar: verinin adresi ve bu hata tipinin davranış tablosu (vtable, Modül 20)."
    stack:
      - frame: main
        vars:
          - { name: adet, type: u32, value: "3" }
          - { name: "(dönüş değeri)", type: "Result<(), Box<dyn Error>>", value: "Err | ptr · vtable", to: h1 }
    heap:
      - { id: h1, value: "ParseFloatError { kind: Invalid }", label: kutulanmış hata }
  - caption: "`main` `Err` ile döndü. Rust `Error: ParseFloatError { kind: Invalid }` yazar, kutuyu serbest bırakır ve programı **1** çıkış koduyla bitirir."
    stack: []
    heap:
      - { id: h1, value: "ParseFloatError { kind: Invalid }", label: kutulanmış hata, freed: true }
```

```quiz
question: "`main` `Result<(), Box<dyn Error>>` döndürüyor ve bir `?`, `Err` ile karşılaştı. Ne olur?"
options:
  - "Program panikler: `thread 'main' panicked` mesajı yazılır ve çıkış kodu 101 olur"
  - "Hata `Error: ...` biçiminde (`Debug` görünümüyle) stderr'e yazılır ve program 1 çıkış koduyla biter"
  - Hata sessizce yutulur ve program 0 çıkış koduyla biter
  - "Derlenmez: `main`'de `?` hiçbir koşulda kullanılamaz"
answer: 1
explanation: |
  `main`'den dönen `Err`, bir panik değil, programın **düzgün** bir hata ile bitmesidir: Rust hatayı
  `Error: ...` diye yazar, çıkış kodunu 1 yapar. Panik (101) bir bug'ı, `Err` ile bitmek ise beklenen bir
  başarısızlığı (yanlış girdi, eksik dosya) bildirir. Betikler ve CI sistemleri bu çıkış kodlarına bakarak
  programın başarıyla bitip bitmediğini anlar.
feedback:
  - "Panik değil: `?` paniklemez, yalnızca `Err`'i döndürür. `main`'den dönen `Err` 1 koduyla biter."
  - Doğru!
  - "Hata yutulmaz: `Error:` ile yazılır ve çıkış kodu 1 olur, yani başarısızlık dışarıdan görülebilir."
  - "`main` `Result` döndürdüğü sürece `?` kullanılabilir. Derleyicinin önerisi de tam olarak buydu."
```

Kutuya yalnızca standart hatalar girmez; **kendi mesajını** da koyabilirsin. Bir `String` ya da `&str`,
`.into()` ile `Box<dyn Error>`'a dönüşür (`into`, Modül 11'de göreceğin dönüşüm trait'lerinden gelir; şimdilik
"uygun tipe çevir" diye oku). Tahmin et:

```predict
code: |
  use std::error::Error;

  fn yas_oku(metin: &str) -> Result<u8, Box<dyn Error>> {
      let yas: u8 = metin.trim().parse()?;
      if yas > 130 {
          return Err(format!("{yas} geçerli bir yaş değil").into());
      }
      Ok(yas)
  }

  fn main() {
      for girdi in ["42", "200", "yüz"] {
          match yas_oku(girdi) {
              Ok(yas) => println!("{yas}"),
              Err(hata) => println!("{hata}"),
          }
      }
  }
options:
  - |
    42
    200 geçerli bir yaş değil
    invalid digit found in string
  - |
    42
    "200 geçerli bir yaş değil"
    ParseIntError { kind: InvalidDigit }
  - |
    42
    Error: 200 geçerli bir yaş değil
  - |
    42
    invalid digit found in string
    invalid digit found in string
answer: 0
explanation: |
  `"200"` bir `u8`'e sığar (en fazla 255), `parse` başarılı olur; ama iş kuralı (130'dan büyük) bizim
  mesajımızı `.into()` ile kutuya koyup döndürür. `"yüz"` ise `parse`'ta takılır ve `?` `ParseIntError`'ı
  kutuya koyar. İki farklı hata aynı kutuda, ve `{hata}` her birinin **okunaklı** (`Display`) hâlini yazar.
  `Error: ...` önekini yalnızca `main`'den dönen bir `Err` alır; burada hatayı `main` içinde kendimiz yazdırdık.
```

:::warning `main`'den dönen hata `Debug` ile yazılır
`main` bir `Err` döndürürse Rust onu `{:?}` ile yazar: `Error: ParseIntError { kind: InvalidDigit }` ya da
kendi mesajın için tırnaklı `Error: "200 geçerli bir yaş değil"`. Bu, programcı için yeterlidir ama kullanıcı
için kaba görünür. Kullanıcıya güzel bir mesaj göstermek istiyorsan hatayı `main` içinde `match` ile yakala,
`eprintln!("Hata: {hata}")` ile kendin yazdır. Gerekirse `std::process::exit(1)` ile 1 koduyla çık; ama bu
fonksiyonun programı **hemen** bitirdiğini, stack'teki değerlerin `drop`'larını çalıştırmadığını unutma.
:::

````exercise
id: m10-e-fis-toplami
title: Market fişinin toplamı
difficulty: 2
prompt: |
  Bir kasa yazılımı, fiş satırlarını `(adet, birim_fiyat)` metin çiftleri olarak veriyor. Değerlerin
  başında ya da sonunda boşluk olabilir.

  `fis_toplami(satirlar)` fonksiyonunu yaz:
  - Her satırın tutarı `adet × birim_fiyat`; fonksiyon bütün satırların toplamını `Ok(toplam)` olarak döndürsün.
  - Okunamayan **ilk** değerde dursun ve o hatayı `?` ile çağırana iletsin.
  - Boş bir fişin toplamı `0`'dır.

  `unwrap`, `expect` ve `unwrap_or` yasak; `?` kullan.
starter: |
  use std::num::ParseIntError;

  fn fis_toplami(satirlar: &[(&str, &str)]) -> Result<u32, ParseIntError> {
      todo!()
  }

  fn main() {
      let fis = [("3", "25"), ("2", " 40 ")];
      println!("{:?}", fis_toplami(&fis)); // Ok(155)
      let hatali = [("1", "10"), ("iki", "40")];
      println!("{:?}", fis_toplami(&hatali)); // Err(ParseIntError { kind: InvalidDigit })
  }
solution: |
  use std::num::ParseIntError;

  fn fis_toplami(satirlar: &[(&str, &str)]) -> Result<u32, ParseIntError> {
      let mut toplam = 0;
      for (adet, fiyat) in satirlar {
          let adet = adet.trim().parse::<u32>()?;
          let fiyat = fiyat.trim().parse::<u32>()?;
          toplam += adet * fiyat;
      }
      Ok(toplam)
  }

  fn main() {
      let fis = [("3", "25"), ("2", " 40 ")];
      println!("{:?}", fis_toplami(&fis)); // Ok(155)
      let hatali = [("1", "10"), ("iki", "40")];
      println!("{:?}", fis_toplami(&hatali)); // Err(ParseIntError { kind: InvalidDigit })
  }
check: tests
tests: |
  use std::num::IntErrorKind;

  fn hata_turu(sonuc: Result<u32, ParseIntError>) -> Option<IntErrorKind> {
      match sonuc {
          Ok(_) => None,
          Err(hata) => Some(hata.kind().clone()),
      }
  }

  #[test]
  fn satirlar_toplanir() {
      assert_eq!(fis_toplami(&[("3", "25"), ("2", "40")]), Ok(155), "3 × 25 + 2 × 40 = 155");
      assert_eq!(fis_toplami(&[(" 2 ", " 10 ")]), Ok(20), "boşluklar temizlenmeli: 2 × 10 = 20");
  }

  #[test]
  fn bos_fis_sifirdir() {
      assert_eq!(fis_toplami(&[]), Ok(0), "boş fişin toplamı 0 olmalı");
  }

  #[test]
  fn ilk_hata_cagirana_iletilir() {
      assert_eq!(
          hata_turu(fis_toplami(&[("3", "25"), ("iki", "40"), ("1", "")])),
          Some(IntErrorKind::InvalidDigit),
          "ilk hata \"iki\" (geçersiz rakam) olmalı; sonraki boş fiyata hiç gelinmemeli"
      );
      assert_eq!(
          hata_turu(fis_toplami(&[("1", ""), ("x", "1")])),
          Some(IntErrorKind::Empty),
          "ilk hata boş fiyat olmalı"
      );
  }
hints:
  - "`for (adet, fiyat) in satirlar { ... }` ile her çifti iki değişkene ayırabilirsin."
  - "Her değeri `trim()` ettikten sonra `parse::<u32>()?` ile oku. `?`, hata olursa fonksiyondan hemen çıkar."
  - |
    Döngüden önce `let mut toplam = 0;`, döngüde `toplam += adet * fiyat;`, en sonda `Ok(toplam)`. Fonksiyonun son satırı şöyle olmalı:
    ```rust
    Ok(toplam)
    ```
forbid:
  - pattern: "\\.unwrap\\(|\\.expect\\(|\\.unwrap_or"
    message: "Bu alıştırmada hatayı `?` ile çağırana iletmelisin."
require:
  - pattern: "\\)\\s*\\?"
    message: "Hatayı `?` operatörüyle yay: örneğin `parse::<u32>()?`"
explanation: |
  Her `?` bir "erken çıkış" noktasıdır: ilk hatalı değerde fonksiyon o hatayla döner ve sonraki satırlara hiç
  bakılmaz. Testteki `("1", "")` satırına bu yüzden hiç gelinmedi.

  Dersin başındaki `satir_tutari`'yı yardımcı fonksiyon olarak kullanırsan hata **iki kat** yayılır:
  `satir_tutari` hatayı `fis_toplami`'ya, o da `main`'e iletir. Her katmanda yalnızca bir `?` yeter:

  ```rust
  for (adet, fiyat) in satirlar {
      toplam += satir_tutari(adet, fiyat)?;
  }
  ```

  `for (adet, fiyat) in satirlar` satırında `satirlar` bir dilim referansı olduğu için `adet` ve `fiyat`
  aslında `&&str`'dir. `trim()` gibi metot çağrılarında Rust referansları kendiliğinden takip eder (Modül 5).
````

## Özet

:::remember
- **Hata yayma**: hatayı ele almak yerine, ne yapılacağına karar verebilecek olan çağırana iletmek.
- `ifade?` → `Ok(v)` ise `v`; `Err(e)` ise fonksiyondan hemen `return Err(From::from(e))`.
- `?` yalnızca `Result` (ya da `Option`) döndüren fonksiyonlarda kullanılır, yoksa **E0277**.
- `?` kullanan fonksiyon başarıda `Ok(...)` döndürür, sonda noktalı virgül olmaz (**E0308**).
- `fn main() -> Result<(), Box<dyn Error>>`: `main`'de `?` kullanılabilir. `Err` olursa `Error: ...` yazılır
  ve çıkış kodu **1** olur.
- Farklı hata tipleri tek bir fonksiyonda karışınca `Box<dyn Error>` hepsini taşır (önizleme). Kendi mesajın
  için: `return Err(format!("...").into());`. `main`'den dönen hata `Debug` ile yazılır; okunaklı mesaj için
  hatayı `main`'de `match` ile yakalayıp `{hata}` ile yazdır.
:::

```reflect
prompt: "`?` hatayı her zaman bir üst katmana iletir. Hangi durumlarda hatayı `?` ile yaymak yerine olduğu yerde (`match`, `unwrap_or`...) ele almak daha doğru olur? Bir örnekle açıkla."
answer: |
  Model cevap: Hatayı, onunla ne yapılacağını bilen ilk katmanda ele almak gerekir. Bir fonksiyon hata
  durumunda ne yapılacağını kendisi biliyorsa (örneğin ayar dosyasında `yazi_boyutu` okunamazsa varsayılan
  olarak 14 kullanmak makulse) `unwrap_or(14)` ile orada çözmek daha temizdir; hatayı yukarı taşımanın bir
  anlamı yoktur. Kullanıcıyla konuşan katmanda da (`main` ya da arayüz kodu) hata artık yayılmaz: anlaşılır
  bir mesaja çevrilip gösterilir. Kısacası: "karar verecek bilgiye sahip olana kadar yay, sahip olunca ele al".
```

```flashcards
- front: "`ifade?` ne yapar?"
  back: "`Ok(v)` ise ifadenin değeri `v` olur; `Err(e)` ise fonksiyondan hemen `Err(e)` döner (hata `From::from` ile dönüştürülerek)."
- front: "`fn main() { let x: u8 = \"5\".parse()?; }` neden derlenmez?"
  back: "`main` `()` döndürüyor; `?` yalnızca `Result`/`Option` döndüren fonksiyonlarda kullanılabilir (E0277)."
- front: "`?` kullanan bir fonksiyonun son satırı başarı durumunda nasıl olmalı?"
  back: "`Ok(değer)`, sonunda noktalı virgül olmadan. Noktalı virgül koyarsan fonksiyon `()` döndürür (E0308)."
- front: "`main`'den `Err` dönerse ne olur?"
  back: "Hata `Error: {hata:?}` biçiminde stderr'e yazılır ve program **1** çıkış koduyla biter (panik değil)."
- front: "`Ok(())` ne anlama gelir?"
  back: "Başarılı, ama taşınacak bir değer yok: `()` birim tipidir (unit)."
- front: "Bir fonksiyonda hem `ParseIntError` hem `ParseFloatError` üreten `?`'ler varsa ne olur, nasıl çözülür?"
  back: "E0277: `?` couldn't convert the error. Çözüm: dönüş tipini `Result<_, Box<dyn Error>>` yapmak (ya da kendi hata tipini tasarlamak)."
- front: "`Result<u8, Box<dyn Error>>` döndüren bir fonksiyondan **kendi mesajınla** nasıl hata döndürürsün?"
  back: "`return Err(format!(\"{yas} geçerli değil\").into());`: `String` ve `&str`, `.into()` ile `Box<dyn Error>`'a dönüşür."
- front: "`?`'nin istisnalara (exceptions) göre üstünlüğü nedir?"
  back: "Hata çıkabilecek her nokta `?` ile görünür ve hata tipi imzada yazılıdır; yine de yükü tek bir karakterdir."
```
