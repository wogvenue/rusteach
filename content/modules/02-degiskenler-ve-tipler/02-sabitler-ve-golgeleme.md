---
id: m02-l02
title: Sabitler ve Gölgeleme
minutes: 15
type: lesson
objectives:
  - "`const` ile tipi belirtilmiş, `SCREAMING_SNAKE_CASE` isimli sabitler tanımlayabilmek"
  - "`let`, `const` ve `static` arasındaki farkları açıklayıp bir duruma uygun olanı seçebilmek"
  - Gölgelemenin (shadowing) `mut`'tan farkını tip değiştirme örneğiyle açıklayabilmek
  - İç içe kapsamlarda (scope) bir değişkenin hangi değeri taşıdığını tahmin edebilmek
keywords: [const, static, gölgeleme, shadowing, kapsam, scope, SCREAMING_SNAKE_CASE, E0435]
---

Bir oyunda en yüksek seviye 50'dir, bir günde her zaman 86 400 saniye vardır, KDV oranı da bütün
program boyunca aynıdır. Bazı değerler **hiç değişmez** ve programın her yerinde aynı anlamı taşır.

Bazen de bir değeri **adım adım dönüştürürsün**: kullanıcının yazdığı `"  27  "` metni önce
boşluklarından temizlenir, sonra sayıya çevrilir. Her adımda "aynı şeyin" yeni bir hâli ortaya çıkar.

Bu derste bu iki durum için Rust'ın araçlarını öğreneceksin: **sabitler (constants)** ve **gölgeleme
(shadowing)**.

## const ile sabitler

Önce örnek:

```rust
const MAKS_SEVIYE: u32 = 50;
const BIR_GUNDEKI_SANIYE: u32 = 60 * 60 * 24;

fn main() {
    let seviye = 12;
    let kalan = MAKS_SEVIYE - seviye;
    println!("Maksimum seviyeye {kalan} seviye kaldı.");
    println!("Bir günde {BIR_GUNDEKI_SANIYE} saniye var.");
}
```

Bir **sabit (constant)** `const` anahtar kelimesiyle tanımlanır ve `let`'ten şu kurallarla ayrılır:

- **Tip yazmak zorunludur.** `: u32`, "32 bitlik işaretsiz (negatif olmayan) tamsayı" demektir. Tamsayı
  tiplerini bir sonraki derste ayrıntılı göreceksin.
- **İsim `SCREAMING_SNAKE_CASE` yazılır**: tamamı büyük harf, kelimeler alt çizgiyle ayrılır.
  (Küçük harfle yazarsan program derlenir ama derleyici `non_upper_case_globals` uyarısı verir.)
- **Asla `mut` olamaz.** `const mut` diye bir şey yoktur.
- **Değeri derleme zamanında (compile time) hesaplanabilmelidir** (bir sonraki adımda). Sayılar,
  başka sabitler, aritmetik işlemler ve derleme zamanında çalışabilen (`const fn`) fonksiyonlar
  kullanılabilir: `const KB: u32 = 2_u32.pow(10);` geçerlidir.
- Genellikle `fn main()`'in dışında, dosyanın en üstünde tanımlanır; böylece programın her yerinden
  kullanılabilir. İstersen bir fonksiyonun içinde de tanımlayabilirsin.

Peki tipi yazmayı unutursan ne olur?

````compiles
code: |
  const MAKS = 100;

  fn main() {
      println!("{MAKS}");
  }
answer: false
explanation: |
  Derlenmez! `let`'te tipi derleyici çıkarabilir, ama `const`'ta tip **zorunludur**:

  ```text
  error: missing type for `const` item
   --> src/main.rs:1:11
    |
  1 | const MAKS = 100;
    |           ^ help: provide a type for the constant: `: i32`
  ```

  Doğrusu: `const MAKS: u32 = 100;` (ya da derleyicinin önerdiği gibi `: i32`).
````

**Neden zorunlu?** Bir sabit programın her yerinden kullanılabilir. Rust, dosyanın en üstündeki
tanımlar (sabitler, fonksiyon imzaları) için tip çıkarımı yapmaz; bunlar programın parçaları arasındaki
**sözleşmelerdir** ve açıkça yazılmalıdır. Böylece bir sabitin tipi, onu kullanan kodun bir yerinde
yapılan değişiklik yüzünden sessizce değişemez.

Diğer dillerde sabitler şöyle yazılır:

| Dil | Sabit tanımı | Not |
|---|---|---|
| C | `#define MAKS 100` veya `const int MAKS = 100;` | `#define` tipsiz bir metin değiştirmedir |
| Java | `static final int MAKS = 100;` | |
| JavaScript | `const MAKS = 100;` | |
| Python | `MAKS = 100` | gerçek sabit yok, büyük harf sadece bir gelenek |
| **Rust** | `const MAKS: u32 = 100;` | tip zorunlu, değer derleme zamanında belli |

:::tip Sihirli sayılara veda
Kodun içine gömülü, anlamı belirsiz sayılara **sihirli sayı (magic number)** denir:
`let toplam = fiyat * 120 / 100;` satırındaki `120` ne? Bunun yerine
`const KDV_YUZDESI: u32 = 20;` tanımla ve `fiyat * (100 + KDV_YUZDESI) / 100` yaz. Kod kendini anlatır,
oran değişirse de tek bir satırı güncellersin.
:::

## Derleme zamanı, static ve doğru seçim

Sabitlerin değeri program **çalışmadan önce**, derleyici tarafından hesaplanır. `60 * 60 * 24` işlemini
program her çalıştığında yapmaz; derleyici `86400` sonucunu doğrudan programın içine yazar. Bu yüzden
bir sabitin değerinde yalnızca derleme zamanında bilinen şeyler kullanılabilir. Tahmin et:

````compiles
code: |
  fn main() {
      let indirim = 15;
      const FIYAT: u32 = 100 - indirim;
      println!("İndirimli fiyat: {FIYAT}");
  }
answer: false
error: E0435
explanation: |
  Derlenmez! `indirim` bir `let` değişkenidir ve değeri ancak program **çalışırken** oluşur. `FIYAT` ise
  derleme sırasında hesaplanmak zorunda. Derleyici bunu açıkça söyler:

  ```text
  error[E0435]: attempt to use a non-constant value in a constant
   --> src/main.rs:3:30
    |
  3 |     const FIYAT: u32 = 100 - indirim;
    |                              ^^^^^^^ non-constant value
    |
  help: consider using `let` instead of `const`
  ```

  Çözüm: `FIYAT`'ı `let` ile tanımla ya da `indirim`'i de bir `const` yap.
````

Derleyici sabitleri gerçekten **hesaplar**. Bu yüzden bir sabitin değerinde bir hata varsa, program daha
çalışmadan yakalanır. Örneğin `u8` tipi en fazla 255 tutabilir (Ders 3'te göreceksin) ve şu satır
**derlenmez**:

:::error
```text
error[E0080]: attempt to compute `200_u8 + 100_u8`, which would overflow
 --> src/main.rs:1:15
  |
1 | const X: u8 = 200 + 100;
  |               ^^^^^^^^^ evaluation of `X` failed here
```
Derleyici `200 + 100` işlemini derleme sırasında yaptı ve sonucun `u8`'e sığmadığını fark etti. Hata,
programı çalıştıran kullanıcıya değil, programı yazan sana gösterildi.
:::

### static: programın ömrü boyunca tek bir yer

Rust'ta bir de **`static`** vardır. Yazımı `const`'a çok benzer: tip zorunlu, isim
`SCREAMING_SNAKE_CASE`.

```rust
static UYGULAMA_SURUMU: u32 = 3;
const MAKS_OYUNCU: u32 = 4;

fn main() {
    println!("Rusteach sürüm {UYGULAMA_SURUMU}");
    println!("En fazla {MAKS_OYUNCU} oyuncu katılabilir.");
}
```

Fark, değerin bellekte **nerede** durduğundadır. Bir `const`'un kendine ait bir adresi yoktur; derleyici
onun değerini kullanıldığı her yere ayrı ayrı yerleştirir. `static` ise program çalıştığı sürece
bellekte **tek bir sabit adreste** durur ve her kullanım o tek yere bakar.

:::analogy Fotokopi ve ilan panosu
`const`, öğretmenin sınav kurallarını her öğrenciye **fotokopi** olarak dağıtması gibidir: herkesin
elinde kendi kopyası vardır. `static` ise koridordaki tek bir **ilan panosu** gibidir: herkes aynı
panoya bakar, pano okul açık olduğu sürece hep aynı yerde durur.
:::

`static mut` diye değiştirilebilir bir `static` de yazılabilir. Ama birden çok thread'in aynı anda
değiştirebileceği bir değer veri yarışına davetiye çıkarır. Bu yüzden Rust, ona her erişimi bir
`unsafe` (güvensiz) bloğuna yazmanı şart koşar (`E0133`; ayrıntılar Modül 24'te). Rust 2024
sürümünde (edition) daha da sıkı: bir `static mut`'a referans almak (`&SAYAC`) bile varsayılan olarak
derleme hatasıdır (`static_mut_refs`). Modern kodda değişebilen global veri için `static mut` değil,
Modül 18'de göreceğin atomik tipler, `Mutex` ve `LazyLock` kullanılır.

Kısacası: **sabit bir değer için `const` kullan**. `static`'e ancak tek bir bellek adresi gerçekten
gerektiğinde (ya da Modül 18'deki güvenli paylaşılan global değerlerde) başvurursun.

| | `let` | `const` | `static` |
|---|---|---|---|
| Nerede tanımlanır? | fonksiyon içinde | her yerde (genelde dosyanın başında) | her yerde |
| Tip yazmak | isteğe bağlı | **zorunlu** | **zorunlu** |
| Değer ne zaman belli olur? | çalışma zamanında | derleme zamanında | derleme zamanında |
| Değiştirilebilir mi? | `let mut` ile | asla | `static mut` + `unsafe` ile (kaçın!) |
| Bellekte | fonksiyonun alanında | kullanıldığı her yere kopyalanır | tek, sabit bir adreste |
| İsim stili | `snake_case` | `SCREAMING_SNAKE_CASE` | `SCREAMING_SNAKE_CASE` |

```quiz
question: |
  Bir oyunda en fazla 4 oyuncu olabilir. Bu sayı program boyunca hiç değişmeyecek ve programın birçok
  yerinde kullanılacak. En uygun tanım hangisi?
options:
  - "`let maks_oyuncu = 4;`"
  - "`let mut MAKS_OYUNCU = 4;`"
  - "`const MAKS_OYUNCU: u32 = 4;`"
  - "`const maks_oyuncu = 4;`"
answer: 2
explanation: |
  Hiç değişmeyen ve programın her yerinde aynı anlamı taşıyan bir değer için `const` biçilmiş kaftandır.
  Tip (`: u32`) zorunludur, isim de `SCREAMING_SNAKE_CASE` yazılır.
feedback:
  - "`let` ile tanımlanan bir değişken yalnızca tanımlandığı fonksiyonun içinde görünür. Programın her yerinde kullanılacak, hiç değişmeyecek bir değer için `const` daha doğru."
  - "Değişmeyecek bir değere `mut` vermek yanlış bir mesaj verir. Üstelik `let` ile büyük harfli isim de `non_snake_case` uyarısı alır."
  - Doğru! Tip belirtilmiş, değişmez ve her yerden erişilebilir.
  - "`const`'ta tip **zorunludur**; bu satır `missing type for const item` hatası verir. İsim de büyük harfle yazılmalıydı."
```

## Gölgeleme (shadowing)

Şimdi bambaşka bir özellik. Bu programda `let puan` **üç kez** yazılmış. Derlenir mi, derlenirse ne
yazdırır?

```predict
code: |
  fn main() {
      let puan = 5;
      let puan = puan + 1;
      let puan = puan * 2;
      println!("Puan: {puan}");
  }
options:
  - "Puan: 12"
  - "Puan: 5"
  - "Puan: 10"
  - "Derlenmez (E0384)"
answer: 0
explanation: |
  Derlenir ve `Puan: 12` yazdırır! Burada hiçbir değişken **değiştirilmiyor**. Her `let puan`, aynı isimde
  **yepyeni bir değişken** tanımlıyor ve önceki değişken bu yenisinin **gölgesinde** kalıyor. Buna
  **gölgeleme (shadowing)** denir: `5` → `5 + 1 = 6` → `6 * 2 = 12`.
  `E0384`, **aynı** değişkene ikinci kez atama yapıldığında çıkar; burada her seferinde yeni bir değişken var.
```

Bellekte olan biten şu:

```memory
title: Üç ayrı puan değişkeni
steps:
  - caption: "`let puan = 5;` ilk değişken oluşur."
    stack:
      - frame: main
        vars:
          - { name: "puan (1)", type: i32, value: "5" }
  - caption: "`let puan = puan + 1;` sağ taraf **eski** `puan` ile hesaplanır (`5 + 1`), sonuç **yeni** bir değişkene konur."
    stack:
      - frame: main
        vars:
          - { name: "puan (1)", type: i32, value: "5", note: "gölgede: bu isimle artık ulaşılamaz" }
          - { name: "puan (2)", type: i32, value: "6" }
  - caption: "`let puan = puan * 2;` yine yeni bir değişken. `puan` yazınca artık hep en sondaki kastedilir."
    stack:
      - frame: main
        vars:
          - { name: "puan (1)", type: i32, value: "5", note: "gölgede" }
          - { name: "puan (2)", type: i32, value: "6", note: "gölgede" }
          - { name: "puan (3)", type: i32, value: "12" }
```

Eski değişkenler silinmez; yalnızca adları yenileri tarafından "örtülür". Kapsamları bittiğinde
hepsi birlikte temizlenir.

:::analogy Üst üste yapışkan notlar
Gölgelemeyi panoya yapıştırılmış notlar gibi düşün. `let puan = 6;` dediğinde eski notun **üstüne**
aynı başlıklı yeni bir not yapıştırırsın. Eski not hâlâ oradadır ama artık görünmez; "puan" diye
baktığında hep en üstteki notu okursun.
:::

**Gölgeleme değişmezliği bozmaz mı?** Hayır. Ders 1'deki garanti hâlâ geçerli: `mut` olmayan hiçbir
değişkenin değeri değişmedi. `puan (1)` baştan sona `5` olarak kaldı. Değişen tek şey, `puan`
**isminin** hangi değişkeni gösterdiği. Bu yüzden gölgelemeyi okurken hep `let`'e bak: `let` varsa
yeni bir değişken doğmuştur.

Diğer dillerin çoğu, aynı kapsamda aynı isimle ikinci bir değişken tanımlamana izin vermez. C'de
`redefinition of 'puan'`, Java'da `variable puan is already defined`, JavaScript'te
`Identifier 'puan' has already been declared` hatası alırsın. Python'da `puan = puan + 1` çalışır ama
orada her şey çalışma zamanında çözülür. Rust ise bu kolaylığı **derleme zamanında tip güvenliğini
koruyarak** sunar.

## Gölgeleme mi, mut mu?

Gölgelemenin `mut`'un yapamadığı bir süper gücü var: yeni değişken **farklı bir tipte** olabilir.

```rust
fn main() {
    let bosluklar = "   ";
    let bosluklar = bosluklar.len();
    println!("{bosluklar} boşluk var");
}
```

İlk `bosluklar` bir metin, ikincisi bir sayı. (`.len()` bir metnin uzunluğunu **bayt** cinsinden
verir. İngilizce harfler, rakamlar ve boşluk 1'er bayt olduğu için bu örneklerde bayt sayısı karakter
sayısına eşittir; ama `ş`, `ğ` gibi harfler 2 bayt tutar, yani `"şeker".len()` 6'dır. Nedenini Ders 4'te,
metinleri Modül 4'te ve Modül 9'da ayrıntılı göreceğiz.) Aynı şeyi `mut` ile yapmayı deneyelim:

````compiles
code: |
  fn main() {
      let mut bosluklar = "   ";
      bosluklar = bosluklar.len();
      println!("{bosluklar} boşluk var");
  }
answer: false
error: E0308
explanation: |
  Derlenmez! `mut` bir değişkenin **değerini** değiştirmene izin verir, **tipini** değil. Bir değişkenin
  tipi, tanımlandığı anda sonsuza dek belirlenir:

  ```text
  error[E0308]: mismatched types
   --> src/main.rs:3:17
    |
  2 |     let mut bosluklar = "   ";
    |                         ----- expected due to this value
  3 |     bosluklar = bosluklar.len();
    |                 ^^^^^^^^^^^^^^^ expected `&str`, found `usize`
  ```

  `&str` metin tipidir (Modül 5'te), `usize` ise bir tamsayı tipi (Ders 3'te). Derleyici "metin
  bekliyordum, sayı geldi" diyor. **E0308 (mismatched types)**, Rust'ta en sık göreceğin hatadır.
  Ders 6'da onu yakından inceleyeceğiz.
````

| | Gölgeleme (`let x = ...;` yeniden) | `mut` (`x = ...;`) |
|---|---|---|
| Yeni değişken mi oluşur? | Evet, her `let` yeni bir değişkendir | Hayır, aynı değişken güncellenir |
| Tip değişebilir mi? | **Evet** | Hayır |
| Sonuç değişmez mi? | Evet (`let mut` yazmadıkça yeni değişken de değişmezdir) | Hayır, değişken değiştirilebilir kalır |
| Ne zaman? | Bir değeri adım adım **dönüştürürken** | Bir değer zaman içinde **güncellenirken** (sayaç, toplam, bakiye) |

Gölgelemenin en yaygın kullanımı, gelen veriyi aşama aşama işlemektir. Her aşamaya yeni bir isim
(`yas_metni`, `yas_temiz`, `yas_sayi`...) uydurmak yerine aynı ismi kullanırsın:

```rust
fn main() {
    let yas = "  27  "; // kullanıcıdan gelen ham metin
    let yas = yas.trim(); // baştaki ve sondaki boşluklar atıldı
    let yas: u32 = yas.parse().unwrap(); // metin -> sayı
    println!("Gelecek yıl {} yaşında olacaksın.", yas + 1);
}
```

Bu örnekte iki **önizleme (preview)** var: `.trim()` metnin başındaki ve sonundaki boşlukları atar
(Modül 9), `.parse().unwrap()` ise metni sayıya çevirir. `.parse()`'ı bu modülün 6. dersinde,
`.unwrap()`'ı da Modül 10'da ayrıntılı göreceğiz. Şimdilik önemli olan şu: üç aşamada `yas`'ın tipi
metinden sayıya döndü, ama biz hep aynı anlamlı ismi kullandık.

Gölgelemeyi **kullanmaman** gereken yerler de var:

- Değer gerçekten zaman içinde değişiyorsa (sayaç, bakiye) `mut` kullan. Bu, okuyana "bu değer
  güncellenir" mesajını verir.
- Yeni değerin anlamı farklıysa gölgeleme yapma, yeni bir isim ver. `let fiyat = 120;` satırından sonra
  `let fiyat = "pahalı";` yazmak okuyanı şaşırtır; `let yorum = "pahalı";` çok daha açık.

Sıra sende. Bir kullanıcı adının çevresindeki boşlukları temizleyip uzunluğunu bulan programı tamamla:

```fill
prompt: Boşlukları doldurarak `ad` değişkenini gölgele ve uzunluğunu hesapla.
code: |
  fn main() {
      let ad = "   ferris42   ";
      let ad = ad.trim();
      ___0 ad = ad.___1();
      println!("Kullanıcı adın {ad} karakter uzunluğunda.");
  }
blanks:
  - ["let"]
  - ["len"]
output: Kullanıcı adın 8 karakter uzunluğunda.
explanation: |
  `let ad = ad.len();` önceki `ad`'ı (bir metin) gölgeleyen, **sayı** tipinde yeni bir `ad` tanımlar.
  `mut` ile bu mümkün olmazdı, çünkü tip değişiyor.
```

## Kapsamlar ve iç içe gölgeleme

Süslü parantezler `{ }` bir **kapsam (scope)** oluşturur. Bir kapsam içinde tanımlanan değişken,
yalnızca o kapsamın sonuna (kapanan `}` işaretine) kadar yaşar. Kapsam içinde yapılan gölgeleme de
kapsamla birlikte sona erer:

```rust
fn main() {
    let hava = 18;
    {
        let hava = 28; // sadece bu blok içinde geçerli
        println!("Öğlen: {hava}");
    }
    println!("Akşam: {hava}");
}
```

Yapışkan not benzetmesine dönersek: iç blokta eski notun üstüne yeni bir not yapıştırdın. Blok bitince
üstteki not sökülür ve alttaki not (`18`) yeniden görünür.

Peki `mut` ile değiştirme ve gölgeleme aynı blokta olursa? Dikkatlice tahmin et:

```predict
code: |
  fn main() {
      let mut a = 1;
      let b = 10;
      {
          a = a + 1;
          let b = b * 2;
          println!("{a} {b}");
      }
      println!("{a} {b}");
  }
options:
  - "2 20\n2 10"
  - "2 20\n1 10"
  - "2 20\n2 20"
  - "1 20\n1 10"
answer: 0
explanation: |
  İki satır farklı davranıyor:

  - `a = a + 1;` **aynı** `a` değişkenini değiştirir (`let` yok!). Değişiklik blok bitince de kalır: `a` artık `2`.
  - `let b = b * 2;` iç blokta **yeni** bir `b` (`20`) tanımlar. Blok bitince bu gölge kaybolur ve dıştaki `b` yine `10`'dur.
```

Bir değişkeni tanımlandığı kapsamın dışında kullanmaya kalkarsan:

````compiles
code: |
  fn main() {
      {
          let gizli = 42;
          println!("İçeride: {gizli}");
      }
      println!("Dışarıda: {gizli}");
  }
answer: false
error: E0425
explanation: |
  Derlenmez! `gizli` iç blokta doğdu ve blok bitince yok oldu. Modül 1'den tanıdığın `E0425` hatası
  gelir. Derleyici nedenini bile söyler:

  ```text
  error[E0425]: cannot find value `gizli` in this scope
   --> src/main.rs:6:26
    |
  6 |     println!("Dışarıda: {gizli}");
    |                          ^^^^^
    |
  help: the binding `gizli` is available in a different scope in the same function
  ```
````

:::ferris
Kapsam fikri şimdilik küçük bir ayrıntı gibi görünebilir, ama Rust'ın kalbindeki **sahiplik
(ownership)** sistemi tam olarak bunun üstüne kurulur: bir değer, kapsamı bitince otomatik olarak
temizlenir. Modül 4'te bu fikre geri döneceğiz!
:::

## Alıştırmalar

İlk alıştırmada `mut` ile gölgeleme arasındaki farkı kullanarak bir hatayı düzelteceksin, ikincisinde
sabitlerle ve gölgelemeyle bir hesap yapacaksın.

````exercise
id: m02-e-sifre-uzunlugu
title: Şifre uzunluğu
difficulty: 1
prompt: |
  Bu program bir şifrenin uzunluğunu yazdırmak istiyor ama `E0308` hatası veriyor. Programı **`mut`
  kullanmadan**, gölgeleme ile düzelt. Çıktı şu olmalı:

  ```text
  Şifren 13 karakter uzunluğunda.
  ```
starter: |
  fn main() {
      let mut sifre = "rustacean2024";
      sifre = sifre.len();
      println!("Şifren {sifre} karakter uzunluğunda.");
  }
starter_compiles: false
solution: |
  fn main() {
      let sifre = "rustacean2024";
      let sifre = sifre.len();
      println!("Şifren {sifre} karakter uzunluğunda.");
  }
check: output
expected_output: Şifren 13 karakter uzunluğunda.
hints:
  - "`mut` bir değişkenin **tipini** değiştirmene izin vermez. Metin olan `sifre`, sayıya dönüşemez."
  - "Tipi değiştirmek için aynı isimle **yeni** bir değişken tanımlaman gerekir. Hangi anahtar kelime yeni bir değişken tanımlıyordu?"
  - "İkinci satırı `let sifre = sifre.len();` yap ve ilk satırdaki artık gereksiz olan `mut`'u sil."
require:
  - pattern: "let\\s+sifre\\s*(:\\s*usize\\s*)?=\\s*sifre\\s*\\.\\s*len\\s*\\(\\s*\\)"
    message: "`sifre`'yi `let sifre = sifre.len();` ile gölgelemelisin."
forbid:
  - pattern: "let\\s+mut"
    message: Bu alıştırmayı `mut` kullanmadan, gölgeleme ile çöz.
  - pattern: "\\b13\\b"
    message: Uzunluğu elle yazma; `.len()` hesaplasın!
explanation: |
  `let sifre = sifre.len();` eski `sifre`'yi (metin) gölgeleyen, `usize` tipinde **yeni** bir değişken
  tanımlar. İlk satırdaki `mut` artık gereksizdir. Bıraksaydın program derlenirdi ama derleyici
  `variable does not need to be mutable` uyarısı verirdi.

  Küçük bir uyarı: `.len()` aslında **bayt** sayar. `rustacean2024` yalnızca ASCII karakterlerden
  oluştuğu için 13 bayt = 13 karakter. `"şifre".len()` ise 5 değil 6 verir (`ş` 2 bayttır, Ders 4).
````

````exercise
id: m02-e-kafe-hesabi
title: Kafe hesabı
difficulty: 2
prompt: |
  Bir kafede çay **15 TL**, tost **60 TL**. Arkadaş grubu **3 çay** ve **2 tost** söyledi, bir de
  **10 TL**'lik indirim kuponları var.

  - Fiyatları `CAY_FIYATI` ve `TOST_FIYATI` adlı, `u32` tipinde **sabitler** olarak tanımla.
  - Hesabı **üç ayrı `let hesap` satırıyla** (bir tanım ve onu izleyen iki gölgeleme) hesapla: önce
    çayların tutarı, sonra tostların eklenmesi, en son kuponun düşülmesi. `mut` kullanma.

  Çıktı tam olarak şöyle olmalı:

  ```text
  Ödenecek tutar: 155 TL
  ```
starter: |
  // Fiyatları burada sabit olarak tanımla.

  fn main() {
      let cay_adedi = 3;
      let tost_adedi = 2;
      let kupon = 10;

      // `hesap` değişkenini üç adımda gölgeleyerek hesapla,
      // sonra "Ödenecek tutar: ... TL" satırını yazdır.
  }
solution: |
  const CAY_FIYATI: u32 = 15;
  const TOST_FIYATI: u32 = 60;

  fn main() {
      let cay_adedi = 3;
      let tost_adedi = 2;
      let kupon = 10;

      let hesap = cay_adedi * CAY_FIYATI;
      let hesap = hesap + tost_adedi * TOST_FIYATI;
      let hesap = hesap - kupon;
      println!("Ödenecek tutar: {hesap} TL");
  }
check: output
expected_output: "Ödenecek tutar: 155 TL"
hints:
  - "Sabitler `fn main()`'in üstüne yazılır ve tip ister: `const CAY_FIYATI: u32 = 15;`"
  - "İlk adım: `let hesap = cay_adedi * CAY_FIYATI;` Sonraki adımlarda sağ tarafta önceki `hesap`'ı kullan."
  - |
    Son iki adım:
    `let hesap = hesap + tost_adedi * TOST_FIYATI;` ve `let hesap = hesap - kupon;`
require:
  - pattern: "const\\s+CAY_FIYATI\\s*:\\s*u32\\s*=\\s*15\\s*;"
    message: "`const CAY_FIYATI: u32 = 15;` sabitini tanımlamalısın."
  - pattern: "const\\s+TOST_FIYATI\\s*:\\s*u32\\s*=\\s*60\\s*;"
    message: "`const TOST_FIYATI: u32 = 60;` sabitini tanımlamalısın."
  - pattern: "let\\s+hesap\\b[\\s\\S]*let\\s+hesap\\b[\\s\\S]*let\\s+hesap\\b"
    message: "`let hesap` satırını üç kez yazmalısın (bir tanım + iki gölgeleme)."
  - pattern: "CAY_FIYATI\\s*\\*|\\*\\s*CAY_FIYATI"
    message: Çayların tutarını `CAY_FIYATI` sabitini kullanarak hesapla.
  - pattern: "TOST_FIYATI\\s*\\*|\\*\\s*TOST_FIYATI"
    message: Tostların tutarını `TOST_FIYATI` sabitini kullanarak hesapla.
forbid:
  - pattern: "let\\s+mut"
    message: Bu alıştırmada `mut` yok; gölgeleme kullan.
  - pattern: "\\b(155|165|45|120)\\b"
    message: Ara sonuçları elle yazma; hesabı Rust yapsın!
explanation: |
  Fiyatlar hiç değişmeyen, programın her yerinde aynı anlamı taşıyan değerler, bu yüzden `const`.
  `hesap` ise adım adım dönüşen bir değer: her `let hesap`, bir öncekinin üstüne kurulan yeni bir
  değişken. Hiçbir değişken değiştirilmediği için `mut`'a gerek yok.

  Dikkat ettin mi? `cay_adedi` için tip yazmadın, ama `cay_adedi * CAY_FIYATI` işleminden dolayı
  derleyici onun da `u32` olması gerektiğini çıkardı. Bu **tip çıkarımını** Ders 6'da göreceksin.
````

## Özet

:::remember
- `const AD: Tip = değer;` sabit tanımlar: tip **zorunlu**, isim `SCREAMING_SNAKE_CASE`, değer
  **derleme zamanında** hesaplanır, asla `mut` olamaz.
- `static` da tip ister ama bellekte tek, sabit bir adreste durur. `static mut` ancak `unsafe` ile
  kullanılabilir. Sabit bir değer için önce `const`'u düşün.
- **Gölgeleme:** aynı isimle yeniden `let` yazmak **yeni** bir değişken tanımlar. Yeni değişken
  **farklı tipte** olabilir; `mut` ise yalnızca değeri değiştirir, tipi asla.
- Değeri adım adım dönüştürürken gölgeleme, zaman içinde güncellerken `mut` kullan.
- `{ }` bir kapsam açar. İçeride tanımlanan değişkenler ve gölgeler `}` ile birlikte biter.
:::

```reflect
prompt: |
  Bir değeri adım adım dönüştürürken neden `mut` yerine gölgelemeyi tercih edebilirsin? Hangi durumda
  ise `mut` daha doğru bir seçimdir? Birer örnekle açıkla.
answer: |
  Model cevap: Gölgelemede her adım yeni bir değişken tanımlar. Bu yüzden tip değişebilir (metin →
  sayı) ve sonuçta elimde yine değişmez bir değişken kalır; kimse onu yanlışlıkla değiştiremez. Örneğin
  `let yas = yas.trim(); let yas: u32 = yas.parse().unwrap();` Ama değer zaman içinde güncelleniyorsa,
  örneğin bir alışveriş sepetinin toplamı ya da bir oyundaki skor gibi, `mut` daha doğrudur: aynı şeyin
  güncellendiğini açıkça gösterir ve tipi de zaten değişmez.
```

````flashcards
- front: "`const MAKS = 100;` neden derlenmez?"
  back: "Sabitlerde tip **zorunludur**: `const MAKS: u32 = 100;`"
- front: Sabit isimleri hangi stilde yazılır?
  back: "`SCREAMING_SNAKE_CASE`: tamamı büyük harf, kelimeler alt çizgiyle ayrılır (`MAKS_PUAN`)."
- front: "`E0435` hatası ne zaman çıkar?"
  back: "Bir `const`'un değerinde, çalışma zamanında belli olan bir `let` değişkeni kullanıldığında: *attempt to use a non-constant value in a constant*."
- front: "`const` ile `static` arasındaki temel fark nedir?"
  back: "`const`'un değeri kullanıldığı her yere kopyalanır; `static` ise program boyunca bellekte **tek, sabit bir adreste** durur."
- front: Gölgeleme (shadowing) nedir?
  back: "Aynı isimle yeniden `let` yazarak **yeni** bir değişken tanımlamak. Önceki değişken bu isimle artık görünmez."
- front: Gölgelemenin yapabildiği ama `mut`'un yapamadığı şey nedir?
  back: "Tipi değiştirmek: `let x = \"   \"; let x = x.len();` derlenir, `mut` ile aynısı `E0308` verir."
- front: |
    Bu kod ne yazdırır?
    ```rust
    let x = 5;
    {
        let x = x * 2;
        println!("{x}");
    }
    println!("{x}");
    ```
  back: "Önce `10`, sonra `5`. İç bloktaki gölge, blok bitince kaybolur."
- front: Bir blok içinde tanımlanan değişkeni bloğun dışında kullanırsan ne olur?
  back: "Derlenmez: `E0425: cannot find value in this scope`. Değişken, kapsamı bitince yok olur."
````
