---
id: m02-l03
title: Tamsayılar ve Taşma
minutes: 20
type: lesson
objectives:
  - Bir değer aralığı için uygun tamsayı tipini (`i8`…`i128`, `u8`…`u128`, `isize`/`usize`) seçebilmek
  - Onluk, onaltılık, sekizlik ve ikilik tamsayı sabitlerini okuyup yazabilmek
  - "Taşmanın (overflow) debug ve release modlarında ne yaptığını açıklayıp `wrapping_`, `checked_`, `saturating_`, `overflowing_` metotlarından uygun olanı seçebilmek"
  - Tamsayı bölmesinin ve `%` kalan işleminin sonucunu negatif sayılarda da hesaplayabilmek
keywords: [tamsayı, integer, i32, u8, usize, taşma, overflow, wrapping_add, checked_add, saturating_add, kalan]
---

Aralık 2014'te PSY'nin "Gangnam Style" videosu YouTube'da **2 147 483 647** izlenmeye yaklaştı. Bu
sayı tesadüf değil: 32 bitlik işaretli bir tamsayının tutabileceği **en büyük** değer. YouTube, bir
videonun bu kadar izleneceğini hiç düşünmediklerini söyleyerek sayacı 64 bitlik bir tamsayıya
yükselttiğini esprili bir dille duyurdu.

Bilgisayarda sayılar sınırsız değildir; her tamsayı tipinin bir **kapasitesi** vardır. Bu derste
Rust'ın tamsayı tiplerini, sınırlarını ve bir sınır aşıldığında (**taşma, overflow**) Rust'ın seni nasıl
koruduğunu öğreneceksin.

## Tamsayı tipleri ailesi

Rust'ta tamsayı tipinin adı her şeyi söyler: **`i`** işaretli (signed, negatif olabilir), **`u`**
işaretsiz (unsigned, yalnızca 0 ve pozitif), yanındaki sayı da kaç **bit** yer kapladığı.

| Bit | İşaretli | İşaretsiz | İşaretli aralık | İşaretsiz aralık |
|---|---|---|---|---|
| 8 | `i8` | `u8` | -128 … 127 | 0 … 255 |
| 16 | `i16` | `u16` | -32 768 … 32 767 | 0 … 65 535 |
| 32 | `i32` | `u32` | ≈ ±2,1 milyar | 0 … ≈ 4,29 milyar |
| 64 | `i64` | `u64` | ≈ ±9,2 × 10¹⁸ | 0 … ≈ 1,8 × 10¹⁹ |
| 128 | `i128` | `u128` | ≈ ±1,7 × 10³⁸ | 0 … ≈ 3,4 × 10³⁸ |
| mimariye bağlı | `isize` | `usize` | 64 bitlik bilgisayarda `i64` gibi | 64 bitlik bilgisayarda `u64` gibi |

Kural basit: `n` bitlik işaretsiz bir tip `0` ile `2ⁿ - 1` arasını, işaretli bir tip `-2ⁿ⁻¹` ile
`2ⁿ⁻¹ - 1` arasını tutar. Sınırları ezberlemene gerek yok, Rust sana söyler:

```rust
fn main() {
    println!("u8:   {} ile {} arası", u8::MIN, u8::MAX);
    println!("i8:   {} ile {} arası", i8::MIN, i8::MAX);
    println!("i32:  {} ile {} arası", i32::MIN, i32::MAX);
    println!("u64:  {} ile {} arası", u64::MIN, u64::MAX);
    println!("i128: {} ile {} arası", i128::MIN, i128::MAX);
}
```

**Neden bu kadar çok tip var?** Çünkü boyut önemlidir. 1920×1080 bir fotoğrafta yaklaşık 6,2 milyon
renk değeri (her pikselde kırmızı, yeşil, mavi) vardır. Her biri `u8` ile tutulursa fotoğraf yaklaşık
6 MB, `i64` ile tutulursa 50 MB yer kaplar. Tip ayrıca **niyeti** anlatır: bir yaşı `u8` ile tutmak
"bu değer negatif olamaz" demektir.

```memory
title: Aynı sayı, farklı boyutlar
steps:
  - caption: Üç değişken de `200` değerini tutuyor ama bellekte farklı miktarda yer kaplıyor. Fazla bitler sıfırla dolar.
    stack:
      - frame: main
        vars:
          - { name: a, type: u8, value: "200", note: "1 bayt: 11001000" }
          - { name: b, type: i32, value: "200", note: "4 bayt: 00000000 00000000 00000000 11001000" }
          - { name: c, type: i64, value: "200", note: "8 bayt (64 bit)" }
```

Diğer dillerle karşılaştıralım:

- **Python:** `int` sınırsız büyür, taşma olmaz. Bedeli, her sayının daha çok bellek ve zaman harcamasıdır.
- **JavaScript:** sayılar (ayrı bir `BigInt` tipi dışında) 64 bitlik ondalıklı sayıdır; 2⁵³'ten büyük
  tamsayılarda hassasiyet kaybolur.
- **Java:** `byte`, `short`, `int`, `long` sabit boyutludur ama işaretsiz tamsayı tipleri yoktur.
- **C:** `int`'in boyutu platforma göre değişebilir.
- **Rust:** boyut ve işaret tipin adında yazılıdır. `u8` her bilgisayarda 8 bit ve işaretsizdir.

Tip belirtmezsen ve derleyici başka bir ipucu bulamazsa tamsayılar **`i32`** olur: çoğu işlemcide
hızlıdır ve gündelik sayılar için yeterince geniştir.

```quiz
question: |
  Dünya nüfusunu (yaklaşık 8,2 milyar) tutacak bir değişken için aşağıdakilerden hangisi
  **yeterli olan en küçük** tiptir?
options:
  - "`i32`"
  - "`u32`"
  - "`u64`"
  - "`u128`"
answer: 2
explanation: |
  `u32` en fazla yaklaşık 4,29 milyar tutabilir; 8,2 milyar sığmaz. `u64` ise 18 kentilyona kadar
  çıkar, fazlasıyla yeterli. Nüfus negatif olamayacağı için işaretsiz bir tip de niyeti iyi anlatır.
feedback:
  - "`i32` en fazla yaklaşık 2,1 milyar tutabilir, nüfusun dörtte birinden bile az."
  - "Yakın ama değil: `u32`'nin sınırı yaklaşık 4,29 milyar."
  - Doğru! 8,2 milyar `u32`'ye sığmaz ama `u64`'e rahatça sığar.
  - "`u128` de çalışır ama gereğinden 2 kat büyük. Soru **en küçük** yeterli tipi soruyordu."
```

**`isize` ve `usize`** biraz farklıdır: boyutları, programın derlendiği **hedef** mimariye bağlıdır.
64 bitlik bir sistem için derlenen programda 64, 32 bitlik bir sistem için derlenende 32 bittir; yani
her zaman bir **bellek adresinin (pointer)** boyutuyla aynıdır. Bu yüzden `usize`, bellekteki şeyleri
saymak ve numaralandırmak için kullanılır: bir metnin uzunluğu (`.len()`) ve dizilerdeki sıra
numaraları (indeksler, Ders 5) hep `usize`'dır.

```rust
fn main() {
    println!("Bu programda usize {} bit.", usize::BITS);
    let kelime = "Ferris";
    let uzunluk = kelime.len(); // .len() her zaman usize döndürür
    println!("\"{kelime}\" {uzunluk} bayt.");
}
```

`.len()` bir metnin **bayt** sayısını verir. `"Ferris"` gibi yalnızca ASCII harflerden oluşan bir
metinde her harf 1 bayt olduğu için bu, harf sayısına eşittir; Türkçe harflerde ise farklıdır (Ders 4).

Peki farklı tamsayı tiplerini karıştırırsan? Tahmin et:

````compiles
code: |
  fn main() {
      let uzunluk = "Rust".len();
      let duzeltme: i32 = -1;
      let sonuc = uzunluk + duzeltme;
      println!("{sonuc}");
  }
answer: false
error: E0308
explanation: |
  Derlenmez! `uzunluk` bir `usize`, `duzeltme` bir `i32`. Rust farklı tamsayı tiplerini **asla
  kendiliğinden karıştırmaz**:

  ```text
  error[E0308]: mismatched types
   --> src/main.rs:4:27
    |
  4 |     let sonuc = uzunluk + duzeltme;
    |                           ^^^^^^^^ expected `usize`, found `i32`
  ```

  Bu bir kapris değil. C'de `-1 < 1u` karşılaştırmasının sonucu **yanlış** çıkar, çünkü `-1` sessizce
  işaretsiz bir tipe çevrilip 4 milyardan büyük bir sayıya dönüşür. Rust seni açıkça karar vermeye
  zorlar. Tipler arasında `as` ile dönüşümü Ders 4'te göreceksin. (Derleyici bir de uzun bir `E0277`
  mesajı ekler; aynı sorunu farklı bir açıdan anlatır.)
````

## Tamsayı sabitlerini yazmak

Kodun içine doğrudan yazdığın sayılara **sabit değer (literal)** denir. Rust'ta bir tamsayıyı birkaç
farklı biçimde yazabilirsin:

| Yazım | Örnek | Değeri | Nerede işe yarar? |
|---|---|---|---|
| Onluk (decimal) | `85_000_000` | 85000000 | gündelik sayılar |
| Onaltılık (hexadecimal) | `0xff` | 255 | renk kodları, bellek adresleri |
| Sekizlik (octal) | `0o755` | 493 | Linux dosya izinleri |
| İkilik (binary) | `0b1010` | 10 | bit bayrakları |
| Bayt (yalnızca `u8`) | `b'A'` | 65 | ASCII karakter kodları |
| Tip son eki (suffix) | `5u8`, `1_000i64` | 5, 1000 | tipi sabitin üstüne yazmak |

Alt çizgiler (`_`) yalnızca okunabilirlik içindir; derleyici onları yok sayar. Türkçede binlik ayırıcı
olarak nokta kullanırız (1.000.000), ama Rust'ta nokta ondalık ayırıcıdır (Ders 4). Bu yüzden alt çizgi
kullanılır. Bayt sabitleri (`b'A'`) yalnızca ASCII karakterler için geçerlidir; `b'ş'` derlenmez.

```rust
fn main() {
    let nufus = 85_000_000; // alt çizgiler sadece okunabilirlik için
    let renk = 0xff; // onaltılık (hexadecimal)
    let izin = 0o755; // sekizlik (octal)
    let bayraklar = 0b1010; // ikilik (binary)
    let harf = b'A'; // 'A' harfinin ASCII kodu, tipi u8
    let kucuk = 5u8; // son ek (suffix) ile tip: u8
    println!("{nufus} {renk} {izin} {bayraklar} {harf} {kucuk}");
    println!("{renk:x} {renk:#x} {bayraklar:b} {bayraklar:#b} {izin:o}");
}
```

İkinci satırdaki biçimlendirme işaretleri sayıyı başka bir tabanda **yazdırır**: `{:x}` onaltılık,
`{:b}` ikilik, `{:o}` sekizlik. Başa `#` eklersen önek de gelir (`0xff`, `0b1010`).

Son eki olmayan ve tipi başka bir yerden anlaşılamayan bir tamsayı sabiti `i32` kabul edilir. Peki bu
satır derlenir mi?

````compiles
code: |
  fn main() {
      let nufus = 3_000_000_000;
      println!("{nufus}");
  }
answer: false
explanation: |
  Derlenmez! `3_000_000_000` için bir tip belirtilmediği için derleyici onu `i32` kabul eder. Ama
  `i32`'nin sınırı yaklaşık 2,1 milyardır:

  ```text
  error: literal out of range for `i32`
   --> src/main.rs:2:17
    |
  2 |     let nufus = 3_000_000_000;
    |                 ^^^^^^^^^^^^^
    |
    = note: the literal `3_000_000_000` does not fit into the type `i32` whose range is `-2147483648..=2147483647`
    = help: consider using the type `u32` instead
  ```

  Çözüm derleyicinin önerisinde: `let nufus: u32 = 3_000_000_000;` ya da `3_000_000_000u32` (veya
  daha büyük bir tip, örneğin `u64`).
````

## Taşma (overflow)

Bir `u8` en fazla 255 tutabilir. 255'e 1 eklersen ne olur? Önce derleyiciye soralım:

````compiles
code: |
  fn main() {
      let x: u8 = 255;
      let y = x + 1;
      println!("{y}");
  }
answer: false
explanation: |
  Derlenmez! Derleyici `x`'in değerini biliyor ve sonucun `u8`'e sığmayacağını program daha çalışmadan
  fark ediyor:

  ```text
  error: this arithmetic operation will overflow
   --> src/main.rs:3:13
    |
  3 |     let y = x + 1;
    |             ^^^^^ attempt to compute `u8::MAX + 1_u8`, which would overflow
    |
    = note: `#[deny(arithmetic_overflow)]` on by default
  ```
````

Ama değerler çoğu zaman derleme anında belli değildir: kullanıcıdan gelir, bir dosyadan okunur ya da
program çalıştıkça artan bir sayaçtır. O zaman taşma **çalışma zamanında** olur:

```rust,should_panic
fn main() {
    let mut ziyaretci: u8 = 254;
    ziyaretci = ziyaretci + 1;
    println!("Ziyaretçi: {ziyaretci}");
    ziyaretci = ziyaretci + 1; // 256 bir u8'e sığmaz!
    println!("Ziyaretçi: {ziyaretci}");
}
```

:::error Panik!
```text
Ziyaretçi: 255
thread 'main' (14) panicked at src/main.rs:5:17:
attempt to add with overflow
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Program ilk satırı yazdırdı, sonra **panik (panic)** yaparak durdu: Rust devam etmektense programı
güvenli biçimde sonlandırdı. Mesaj nerede (`5:17` → 5. satır, 17. sütun) ve ne olduğunu
(*toplamada taşma*) söylüyor. Parantez içindeki sayı thread'in numarasıdır, önemli değil.
:::

Burada Modül 1'de gördüğün **debug** ve **release** ayrımı devreye girer:

- **Debug** (`cargo run`, `cargo build`): taşma kontrolleri **açıktır**. Taşma olursa program panik yapar.
  Geliştirirken hatayı hemen görürsün.
- **Release** (`cargo run --release`): hız için kontroller **kapalıdır**. Taşan değer **başa sarar**:
  `255 + 1` sonucu `0` olur.

Release'teki bu başa sarma bile **tanımsız davranış değildir**; sonuç her zaman tam olarak bellidir
(Rust'ın kuralı: taşma ya panik yapar ya da başa sarar, başka hiçbir şey olamaz).
C'de ise işaretli tamsayı taşması tanımsız davranıştır: derleyici "bu asla olmaz" varsayıp kodunu
beklenmedik biçimde değiştirebilir. İstersen release'te de kontrolleri açabilirsin
(`Cargo.toml` içinde `overflow-checks = true`; profilleri Modül 16'da göreceğiz).

:::analogy Kilometre sayacı
Eski arabaların mekanik kilometre sayacını düşün: 999 999'dan sonra bir kilometre daha gidersen sayaç
000 000'a döner. Araba bir anda "sıfır kilometre" olmadı; sayacın **basamağı** bitti. Tamsayılar da
böyledir: `u8`'in sekiz biti dolunca sayı başa sarar.
:::

:::deep İkiye tümleyen (two's complement) ve gerçek hayattan taşmalar
İşaretli tamsayılar bellekte **ikiye tümleyen** biçiminde tutulur. `i8` için:

```text
0000_0000 =    0        1000_0000 = -128
0000_0001 =    1        1000_0001 = -127
0111_1111 =  127        1111_1111 =   -1
```

Bu yüzden `i8` için `127 + 1` başa sarınca `-128` olur: `0111_1111 + 1 = 1000_0000`.

Taşmanın gerçek hayattan iki ünlü örneği:

- **Pac-Man (1980):** seviye sayacı tek bir baytta tutulduğu için 256. seviyede ekranın sağ yarısı
  anlamsız karakterlerle dolar ve oyun oynanamaz hâle gelir.
- **Boeing 787 (2015):** ABD Havacılık İdaresi (FAA), 248 gün kesintisiz açık kalan bir uçağın
  jeneratör kontrol birimlerinin kapanabileceğini duyurdu. Nedeninin, saniyenin yüzde birlerini sayan
  32 bitlik işaretli bir sayacın taşması olduğu düşünülüyor: 2³¹ / 100 saniye ≈ 248,5 gün.
:::

## Taşmayı bilinçli yönetmek

Bazen taşma bir hata değil, beklenen bir durumdur. O zaman `+` ve `-` yerine, taşmada **ne olacağını
açıkça söyleyen** metotları kullanırsın:

| Metot ailesi | Taşma olursa | `250u8` + `10` |
|---|---|---|
| `wrapping_add` | başa sarar (release'teki gibi) | `4` |
| `checked_add` | `None` döner; taşma yoksa `Some(sonuç)` | `None` |
| `saturating_add` | sınırda durur (en küçük ya da en büyük değer) | `255` |
| `overflowing_add` | (sonuç, taştı mı?) ikilisi döner | `(4, true)` |

Her ailenin `_sub` (çıkarma), `_mul` (çarpma) ve `_pow` (üs alma) gibi kardeşleri de vardır:
`saturating_sub`, `checked_mul`...

```rust
fn main() {
    let a: u8 = 250;
    println!("wrapping:    {}", a.wrapping_add(10));
    println!("checked:     {:?}", a.checked_add(10));
    println!("checked (5): {:?}", a.checked_add(5));
    println!("saturating:  {}", a.saturating_add(10));
    println!("overflowing: {:?}", a.overflowing_add(10));
}
```

`checked_add`'in döndürdüğü `Some(255)` ve `None`, Rust'ın "belki bir değer vardır, belki yoktur"
demenin yoludur. Bu tipe **`Option`** denir ve Modül 7'de ayrıntılı göreceğiz; şimdilik `{:?}` ile
yazdırmak yeterli. `overflowing_add`'in döndürdüğü `(4, true)` ise bir **tuple**'dır (Ders 5).

Şimdi bir telefonun pil yüzdesiyle deneyelim:

```predict
code: |
  fn main() {
      let pil: u8 = 5;
      println!("{}", pil.saturating_sub(10));
      println!("{:?}", pil.checked_sub(10));
      println!("{}", pil.wrapping_sub(10));
  }
options:
  - "0\nNone\n251"
  - "-5\nNone\n251"
  - "0\n0\n0"
  - "0\nNone\n-5"
answer: 0
explanation: |
  `5 - 10` bir `u8`'e sığmaz, çünkü `u8` negatif olamaz:

  - `saturating_sub` en küçük değerde, yani `0`'da durur.
  - `checked_sub` taşmayı fark eder ve `None` döndürür.
  - `wrapping_sub` başa sarar: `0`'ın altına inince `255`'ten devam eder; 5 adım geri `0`, 10 adım geri `251`.

  `-5` hiçbir zaman çıkamaz: bir `u8` negatif bir değer tutamaz.
```

Hangisini ne zaman kullanırsın?

- **`checked_`**: taşma bir **hata** ise (para, stok, kimlik numaraları). Sonucu kontrol edip hatayı
  ele alırsın.
- **`saturating_`**: sınırda durmak doğal ise (oyun karakterinin canı, ses seviyesi, pil yüzdesi).
- **`wrapping_`**: döngüsel davranış isteniyorsa (renk tonu çarkı, bazı şifreleme ve hash hesapları).
- **`overflowing_`**: hem sonuca hem taşma bilgisine ihtiyaç varsa (büyük sayı aritmetiğindeki elde gibi).

```quiz
question: |
  Bir bankacılık uygulamasında iki bakiyeyi topluyorsun. Taşma olursa işlem **iptal edilmeli** ve
  kullanıcıya hata gösterilmeli. Hangisini kullanırsın?
options:
  - "`bakiye1.wrapping_add(bakiye2)`"
  - "`bakiye1.checked_add(bakiye2)`"
  - "`bakiye1.saturating_add(bakiye2)`"
  - "`bakiye1 + bakiye2`"
answer: 1
explanation: |
  `checked_add` taşmayı **haber verir** (`None`), böylece işlemi iptal edip kullanıcıya bir hata
  gösterebilirsin. Parayla ilgili bir hesapta sessizce yanlış bir sonuçla devam etmek felakettir.
feedback:
  - Başa sarma, devasa bir bakiyeyi bir anda küçük bir sayıya çevirir. Bu, bir bankanın göreceği en kötü hata olurdu!
  - Doğru! `None` gelirse işlemi iptal edersin.
  - Sınırda durmak sessizce para "kaybettirir". Hata bildirilmeden yanlış bir sonuçla devam edilir.
  - Debug'da program panik yapıp çöker, release'te ise sessizce başa sarar. İkisi de bu senaryo için kabul edilemez.
```

## Bölme ve kalan

İki tamsayıyı böldüğünde sonuç da **tamsayıdır**; ondalık kısım **atılır**. Kalanı ise `%`
operatörü verir:

```rust
fn main() {
    let film_suresi = 125; // dakika
    let saat = film_suresi / 60;
    let dakika = film_suresi % 60;
    println!("Film {saat} saat {dakika} dakika sürüyor.");

    let yil = 2024;
    println!("Son basamak: {}", yil % 10);

    let ogrenci: u32 = 45;
    let otobus_kapasitesi = 20;
    println!("Gereken otobüs: {}", ogrenci.div_ceil(otobus_kapasitesi));
}
```

`div_ceil` bölümü **yukarı yuvarlar**: 45 öğrenci için 20 kişilik 2 otobüs yetmez, 3 gerekir. Bu metot
kararlı (stable) Rust'ta yalnızca işaretsiz tiplerde vardır; bu yüzden `ogrenci`'nin tipini `u32` olarak
yazdık. Negatif sayılarda ne olur? Tahmin et:

```predict
code: |
  fn main() {
      println!("{}", 17 / 5);
      println!("{}", 17 % 5);
      println!("{}", -17 / 5);
      println!("{}", -17 % 5);
  }
options:
  - "3\n2\n-3\n-2"
  - "3\n2\n-4\n3"
  - "3.4\n2\n-3.4\n-2"
  - "3\n2\n-3\n2"
answer: 0
explanation: |
  Rust'ta tamsayı bölmesi **sıfıra doğru** keser: `17 / 5 = 3`, `-17 / 5 = -3`. Kalanın işareti
  **bölünenle** aynıdır: `-17 % 5 = -2`, çünkü `-3 × 5 + (-2) = -17`.

  İkinci seçenek Python'un cevabıdır! Python `//` ile **aşağıya** yuvarlar (`-17 // 5 == -4`) ve
  kalanı hep bölenle aynı işaretli verir (`-17 % 5 == 3`). Diller arasında geçiş yaparken buna dikkat et.
```

Her zaman **negatif olmayan** bir kalan istiyorsan (örneğin "bugünden 17 gün önce haftanın hangi
günüydü?" gibi döngüsel hesaplarda) `rem_euclid` kullan: `(-17_i32).rem_euclid(5)` sonucu `3`'tür.

:::warning Eksi işaretinin önceliği
`-17_i32.rem_euclid(5)` yazarsan sonuç `3` değil, `-2` olur! Metot çağrısı eksi işaretinden **önce**
yapılır; yani bu ifade `-(17_i32.rem_euclid(5))` demektir. Negatif bir sayı üzerinde metot çağırırken
parantez kullan: `(-17_i32).rem_euclid(5)`.
:::

**Sıfıra bölme** matematikte tanımsızdır. Derleyici bölenin sıfır olduğunu görebiliyorsa programı
derlemez (`this operation will panic at runtime`). Bölen çalışma zamanında sıfır olursa program
`attempt to divide by zero` mesajıyla panik yapar.

:::warning Bölme kontrolleri release'te de açıktır
Toplama ve çarpmadaki taşma kontrolleri release'te kapanır, ama `/` ve `%` için kontroller **hiç
kapanmaz**. Sıfıra bölme release'te de panik yapar. Bir de az bilinen bir tuzak var: `i32::MIN / -1`
sonucu (`2 147 483 648`) bir `i32`'ye sığmaz ve her modda `attempt to divide with overflow` paniği
verir. Aynı nedenle `i32::MIN.abs()` debug modunda panik yapar.
:::

Birkaç kullanışlı metot daha:

| Metot | Ne yapar? | Örnek → sonuç |
|---|---|---|
| `pow` | üs alır | `2_u32.pow(10)` → `1024` |
| `abs` | mutlak değer | `(-7_i32).abs()` → `7` |
| `min` / `max` | iki sayıdan küçüğü / büyüğü | `3.min(8)` → `3`, `3.max(8)` → `8` |
| `abs_diff` | iki sayı arasındaki fark (hep pozitif, işaretsiz döner) | `7_u8.abs_diff(10)` → `3` |

Şimdi sıra sende: 200 dakikalık bir maçı saat ve dakikaya çevir.

```fill
prompt: Boşlukları doğru operatörlerle doldur.
code: |
  fn main() {
      let toplam_dakika = 200;
      let saat = toplam_dakika ___0 60;
      let dakika = toplam_dakika ___1 60;
      println!("{saat} saat {dakika} dakika");
  }
blanks:
  - ["/"]
  - ["%"]
output: 3 saat 20 dakika
explanation: |
  `200 / 60 = 3` (ondalık kısım atılır), `200 % 60 = 20` (geriye kalan dakikalar). Bölme ve kalan
  ikilisi; saat, para, sayfa gibi birimleri parçalara ayırmanın en temel aracıdır.
```

## Alıştırmalar

:::info Fonksiyon kabuğu (önizleme)
Bu alıştırmalarda kodunu bir **fonksiyonun** içine yazacaksın. Fonksiyonları Modül 3'te ayrıntılı
öğreneceksin; şimdilik bu kadarı yeterli:

```rust
fn ucgen_alani(taban: u32, yukseklik: u32) -> u32 {
    taban * yukseklik / 2
}

fn main() {
    let alan = ucgen_alani(10, 6);
    println!("Üçgenin alanı: {alan}");
}
```

- Parantez içindeki `taban` ve `yukseklik` sana **verilmiş** değişkenlerdir (parametre). Değerlerini
  fonksiyonu çağıran belirler: burada `10` ve `6`.
- `-> u32` fonksiyonun ürettiği **sonucun** tipidir.
- Gövdenin son satırı **noktalı virgülsüz** yazılırsa fonksiyonun sonucu olur.
- Başlangıç kodundaki `todo!()` "henüz yazılmadı" demektir; çalışırsa program panik yapar. Onu silip
  yerine kendi kodunu yaz.

Testler fonksiyonunu farklı değerlerle çağırıp sonuçlarını kontrol edecek.
:::

````exercise
id: m02-e-8bit-oyun
title: 8-bit oyun
difficulty: 2
prompt: |
  Retro bir oyun yazıyorsun ve bütün değerler `u8` (0-255). Üç fonksiyonu tamamla:

  - `hasar_al(can, hasar)`: can, hasar kadar azalır ama **0'ın altına inmez**.
  - `iksir_ic(can, iyilesme)`: can artar ama **255'i geçmez**.
  - `renk_kaydir(renk, adim)`: karakterin renk tonu ilerler; 255'ten sonra **0'dan devam eder**
    (renk çarkı gibi).

  Normal `+` ve `-` taşmada panik yapar. Her fonksiyon için doğru taşma davranışını seç!
starter: |
  fn hasar_al(can: u8, hasar: u8) -> u8 {
      todo!()
  }

  fn iksir_ic(can: u8, iyilesme: u8) -> u8 {
      todo!()
  }

  fn renk_kaydir(renk: u8, adim: u8) -> u8 {
      todo!()
  }

  fn main() {
      println!("Tuzaktan sonra can: {}", hasar_al(100, 30));
      println!("İksirden sonra can: {}", iksir_ic(250, 10));
      println!("Yeni renk tonu: {}", renk_kaydir(250, 10));
  }
solution: |
  fn hasar_al(can: u8, hasar: u8) -> u8 {
      can.saturating_sub(hasar)
  }

  fn iksir_ic(can: u8, iyilesme: u8) -> u8 {
      can.saturating_add(iyilesme)
  }

  fn renk_kaydir(renk: u8, adim: u8) -> u8 {
      renk.wrapping_add(adim)
  }

  fn main() {
      println!("Tuzaktan sonra can: {}", hasar_al(100, 30));
      println!("İksirden sonra can: {}", iksir_ic(250, 10));
      println!("Yeni renk tonu: {}", renk_kaydir(250, 10));
  }
check: tests
tests: |
  #[test]
  fn hasar_cani_azaltir() {
      assert_eq!(hasar_al(100, 30), 70, "100 candan 30 hasar sonra 70 can kalmalı");
  }

  #[test]
  fn can_sifirin_altina_inmez() {
      assert_eq!(hasar_al(20, 50), 0, "can 0'ın altına inemez: 20 can, 50 hasar sonucu 0 olmalı");
      assert_eq!(hasar_al(0, 255), 0, "zaten 0 olan can 0 kalmalı");
      assert_eq!(hasar_al(30, 30), 0, "can tam hasar kadarsa 0 kalmalı");
      assert_eq!(hasar_al(255, 0), 255, "0 hasar canı değiştirmemeli");
  }

  #[test]
  fn iksir_cani_artirir_ama_255te_durur() {
      assert_eq!(iksir_ic(100, 55), 155, "100 + 55 = 155 olmalı");
      assert_eq!(iksir_ic(250, 10), 255, "can 255'i geçemez: 250 + 10 sonucu 255 olmalı");
      assert_eq!(iksir_ic(255, 255), 255, "dolu can dolu kalmalı");
  }

  #[test]
  fn renk_255ten_sonra_basa_sarar() {
      assert_eq!(renk_kaydir(250, 10), 4, "renk çarkı 255'ten sonra 0'dan devam eder: 250 + 10 → 4");
      assert_eq!(renk_kaydir(0, 100), 100, "0 + 100 = 100 olmalı");
      assert_eq!(renk_kaydir(255, 1), 0, "255'ten bir adım sonra 0 gelmeli");
      assert_eq!(renk_kaydir(200, 255), 199, "200 + 255 = 455 → 455 - 256 = 199 olmalı");
  }
hints:
  - Normal `-` ve `+` taşmada panik yapar. Bu derste taşmanın ne olacağını açıkça söyleyen hangi metot ailelerini gördün?
  - "Sınırda durmak için `saturating_`, başa sarmak için `wrapping_` ailesi var. Toplama için `_add`, çıkarma için `_sub`."
  - "Üç gövde de tek satır: `can.saturating_sub(hasar)`, `can.saturating_add(iyilesme)` ve `renk.wrapping_add(adim)`."
explanation: |
  - Can bir **sınırda durmalı**, bu yüzden `saturating_sub` ve `saturating_add`. 20 canlı bir karakter
    50 hasar alınca 0'da kalır.
  - Renk tonu **döngüsel**, bu yüzden `wrapping_add`: 250'den 10 adım ileri, 255'ten sonra başa sarıp 4'e
    gelir.

  `can - hasar` yazsaydın `hasar_al(20, 50)` testi `attempt to subtract with overflow` panikiyle
  başarısız olurdu. Release modunda ise daha kötüsü olurdu: 20 - 50 başa sarıp **226** can verirdi.
  Ölmek üzere olan karakter bir anda neredeyse tam cana kavuşurdu!

  **Alternatifler:** Modül 3'teki `if` ile `if hasar > can { 0 } else { can - hasar }` de doğru çalışır,
  ama niyeti `saturating_sub` kadar kısa ve açık anlatmaz. `renk_kaydir` için Ders 4'te göreceğin
  `as` dönüşümüyle `((renk as u16 + adim as u16) % 256) as u8` de olurdu (geniş tipte hesapla, sonra
  daralt), ama `wrapping_add` tam olarak "256'ya göre başa sar" demektir.
````

````exercise
id: m02-e-kronometre
title: Dijital kronometre
difficulty: 3
prompt: |
  Bir kronometre uygulaması geçen süreyi toplam **saniye** olarak tutuyor. `saat_formatla`
  fonksiyonunu tamamla: toplam saniyeyi `"SS:DD:ss"` biçiminde bir metne çevirsin.

  - `3725` → `"01:02:05"` (1 saat, 2 dakika, 5 saniye)
  - `59` → `"00:00:59"`

  Her alan **en az iki basamaklı** ve başında sıfırla yazılmalı. Modül 1'deki `{:02}`'yi hatırla!
  `format!` bir `String` döndürür; fonksiyonun sonuç tipi bu yüzden `String` (`String`'i Modül 4'te
  ayrıntılı göreceksin). Hazır verilen sabitleri kullan.
starter: |
  const DAKIKADAKI_SANIYE: u32 = 60;
  const SAATTEKI_SANIYE: u32 = 60 * DAKIKADAKI_SANIYE;

  fn saat_formatla(toplam_saniye: u32) -> String {
      // 1) saat, dakika ve saniyeyi `/` ve `%` ile hesapla
      // 2) format! ile "SS:DD:ss" biçiminde birleştir
      todo!()
  }

  fn main() {
      println!("{}", saat_formatla(3725));
  }
solution: |
  const DAKIKADAKI_SANIYE: u32 = 60;
  const SAATTEKI_SANIYE: u32 = 60 * DAKIKADAKI_SANIYE;

  fn saat_formatla(toplam_saniye: u32) -> String {
      let saat = toplam_saniye / SAATTEKI_SANIYE;
      let dakika = toplam_saniye % SAATTEKI_SANIYE / DAKIKADAKI_SANIYE;
      let saniye = toplam_saniye % DAKIKADAKI_SANIYE;
      format!("{saat:02}:{dakika:02}:{saniye:02}")
  }

  fn main() {
      println!("{}", saat_formatla(3725));
  }
check: tests
tests: |
  #[test]
  fn bir_saat_iki_dakika_bes_saniye() {
      assert_eq!(saat_formatla(3725), "01:02:05", "3725 saniye = 1 saat 2 dakika 5 saniye");
  }

  #[test]
  fn bir_dakikadan_kisa_sureler() {
      assert_eq!(saat_formatla(59), "00:00:59", "59 saniye bir dakikadan kısadır");
      assert_eq!(saat_formatla(0), "00:00:00", "0 saniyede her alan 00 olmalı");
  }

  #[test]
  fn bucuk_saat() {
      assert_eq!(saat_formatla(5400), "01:30:00", "5400 saniye = 1 buçuk saat");
  }

  #[test]
  fn gun_bitmeden_bir_saniye_once() {
      assert_eq!(saat_formatla(86399), "23:59:59", "86399 saniye = 23 saat 59 dakika 59 saniye");
  }
hints:
  - "Saat: toplam saniyeyi bir saatteki saniye sayısına **böl**. Saniye: toplam saniyenin 60'a bölümünden **kalan**."
  - "Dakika için önce tam saatlerden arta kalan saniyeleri bul (`toplam_saniye % SAATTEKI_SANIYE`), sonra bunu 60'a böl."
  - "`format!(\"{saat:02}:{dakika:02}:{saniye:02}\")` her sayıyı en az iki basamaklı, gerekirse başına sıfır ekleyerek yazar. Bu satırı noktalı virgülsüz bırak ki fonksiyonun sonucu olsun."
require:
  - pattern: "%"
    message: Kalanları hesaplamak için `%` operatörünü kullanmalısın.
explanation: |
  Bölme ve kalan birlikte bir sayıyı birimlerine ayırır:

  - `saat = 3725 / 3600 = 1`
  - `dakika = 3725 % 3600 / 60 = 125 / 60 = 2` (`%` ve `/` aynı önceliktedir, soldan sağa yapılır)
  - `saniye = 3725 % 60 = 5`

  `{saat:02}` "en az 2 basamak, eksikse başa 0" demektir. Sabitler sayesinde kodda "sihirli" 3600 yok;
  okuyan herkes ne hesaplandığını anlıyor.

  **Alternatif:** dakikayı `toplam_saniye / DAKIKADAKI_SANIYE % 60` ile de hesaplayabilirdin: önce
  toplam dakikayı bul, sonra saatlere sığmayan kısmını al.
````

## Özet

:::remember
- Tamsayılar: `i8`…`i128` (işaretli), `u8`…`u128` (işaretsiz), `isize`/`usize` (adres boyutunda).
  Varsayılan tip **`i32`**; uzunluklar ve indeksler **`usize`**.
- Sabit yazımları: `1_000_000`, `0xff`, `0o77`, `0b1010`, `b'A'`, `5u8`.
- Rust farklı tamsayı tiplerini kendiliğinden karıştırmaz (`E0308`).
- Taşma: derleyici görebiliyorsa **derleme hatası**, debug'da **panik**, release'te **başa sarma**.
- Taşmayı açıkça yönet: `checked_` (hata ise), `saturating_` (sınırda dur), `wrapping_` (döngüsel),
  `overflowing_` (sonuç + bilgi).
- Tamsayı bölmesi sıfıra doğru keser; `%` kalanının işareti bölünenle aynıdır; `rem_euclid` hep
  negatif olmayan kalan verir.
- Sıfıra bölme ve `i32::MIN / -1` **her modda** (release'te de) panik yapar.
:::

```reflect
prompt: |
  Taşma (overflow) neden tehlikelidir? Rust'ın debug modunda panik yapması, release modunda başa
  sarması ve `checked_add` gibi metotlar sunması bu tehlikeye karşı nasıl bir denge kuruyor?
answer: |
  Model cevap: Taşma, programın hiçbir uyarı vermeden yanlış bir sayıyla devam etmesine yol açabilir:
  bir bakiye ya da sayaç bir anda anlamsız bir değere döner. Rust, geliştirme sırasında (debug) taşmayı
  panikle hemen görünür kılar; böylece hatayı erkenden yakalarım. Release'te performans için kontroller
  kapalıdır ama sonuç yine de tanımlıdır (başa sarma), C'deki gibi tanımsız davranış yoktur. Taşmanın
  mümkün olduğu yerlerde ise `checked_`, `saturating_` veya `wrapping_` ile ne olacağını açıkça
  seçerim; böylece davranış derleme moduna bağlı olmaktan çıkar.
```

```flashcards
- front: "`u8` tipinin değer aralığı nedir?"
  back: "0 ile 255 arası (2⁸ = 256 farklı değer)."
- front: Tip belirtilmemiş bir tamsayı sabitinin varsayılan tipi nedir?
  back: "`i32`"
- front: "`usize` nedir, nerede kullanılır?"
  back: "Boyutu bellek adresi (pointer) kadar olan işaretsiz tamsayı (64 bitlik hedefte 64 bit). Uzunluklar (`.len()`) ve indeksler için kullanılır."
- front: Tamsayı taşması debug modunda ne olur? Release modunda?
  back: "Debug'da program panik yapar (`attempt to add with overflow`). Release'te değer sessizce başa sarar (`255u8 + 1` → `0`)."
- front: "`250u8.checked_add(10)` ne döndürür?"
  back: "`None` (taşma oldu). Taşma olmasaydı `Some(sonuç)` dönerdi."
- front: "`250u8.wrapping_add(10)` ne döndürür?"
  back: "`4`: 255'ten sonra 0'dan devam eder."
- front: "Rust'ta `-17 / 5` ve `-17 % 5` kaçtır?"
  back: "`-3` ve `-2`. Bölme sıfıra doğru keser, kalanın işareti bölünenle aynıdır."
- front: "`0xff`, `0o77` ve `0b1010` hangi sayılardır?"
  back: "255, 63 ve 10."
```
