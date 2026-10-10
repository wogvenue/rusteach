---
id: m02-l04
title: Ondalık Sayılar, bool ve char
minutes: 22
type: lesson
objectives:
  - "`f64` ile `f32` arasındaki farkı açıklayıp kayan noktalı sayıları güvenle karşılaştırabilmek"
  - Aritmetik, bileşik atama, karşılaştırma ve mantıksal operatörlerle doğru ifadeler kurabilmek
  - "`char` tipinin 4 baytlık bir Unicode değeri olduğunu açıklayıp `'ş'`, `'🦀'` gibi karakterlerle çalışabilmek"
  - "`as` ile tipler arasında dönüşüm yapıp kayıplı dönüşümlerin (kesme, sınırda durma) sonucunu önceden söyleyebilmek"
keywords: [f64, f32, kayan nokta, float, bool, char, Unicode, as, dönüşüm, "&&", "||", "+="]
---

1991'de Körfez Savaşı'nda bir Patriot füze savunma bataryası, gelen bir füzeyi ıskaladı. Nedeni bir
**yuvarlama hatasıydı**: sistem zamanı saniyenin onda biri (0,1) adımlarla sayıyordu ve 0,1 sayısı
bilgisayarın ikilik sisteminde **tam olarak yazılamaz**. Her adımda çok küçük bir hata birikti; 100 saat
sonra saat yaklaşık 0,34 saniye kaymıştı. Bu, hızla giden bir füzenin yüzlerce metre ötede aranması
demekti.

Ondalık sayılar, doğru/yanlış değerleri ve karakterler her programın ham maddesidir. Bu derste onları
tanıyacak, tuzaklarını öğrenecek ve tipler arasında nasıl dönüşüm yapıldığını göreceksin.

## Ondalık sayılar ve aritmetik

Ondalık kısmı olan sayılar için Rust'ın iki tipi vardır: **`f64`** (64 bit) ve **`f32`** (32 bit).
`f`, *floating point* yani **kayan noktalı sayı** demektir. Sayıda bir nokta (`.`) varsa ve başka bir
ipucu yoksa tip **`f64`** olur:

```rust
fn main() {
    let boy = 1.75; // f64 (varsayılan)
    let yaricap: f32 = 2.5; // açıkça f32
    let sicaklik = -4.5_f64; // son ek (suffix) ile
    let avogadro = 6.022e23; // bilimsel gösterim: 6,022 × 10²³
    let alan = std::f64::consts::PI * 2.5 * 2.5; // π hazır bir sabit
    println!("{boy} {yaricap} {sicaklik} {avogadro:e}");
    println!("Alan: {alan:.2}"); // Modül 1: virgülden sonra 2 basamak
    println!("{} ile {}", 7 / 2, 7.0 / 2.0);
}
```

Son satıra dikkat: `7 / 2` iki **tamsayının** bölmesidir ve `3` verir (Ders 3). `7.0 / 2.0` ise ondalık
bölmedir ve `3.5` verir. Türkçede ondalık ayırıcı virgüldür ama Rust'ta (ve neredeyse tüm programlama
dillerinde) **noktadır**: `3,5` değil `3.5`.

İki küçük not: `{avogadro:e}` sayıyı bilimsel gösterimle (`6.022e23`) yazdırır; düz `{avogadro}`
yazsaydın `602200000000000000000000` görürdün. π gibi matematik sabitlerini de elle yazma:
`std::f64::consts::PI` hazırdır. (Clippy, `3.14159` gibi elle yazılmış yaklaşık değerleri hata olarak
işaretler.)

**Neden varsayılan `f64`?** Modern işlemcilerde `f64` neredeyse `f32` kadar hızlıdır ama çok daha
hassastır:

| Tip | Boyut | Güvenilir basamak | `1.0 / 3.0` |
|---|---|---|---|
| `f32` | 4 bayt | yaklaşık 7 | `0.33333334` |
| `f64` | 8 bayt | yaklaşık 15-16 | `0.3333333333333333` |

`f32`'yi yalnızca bellek gerçekten önemliyse seçersin: oyunlardaki milyonlarca köşe koordinatı, ekran
kartı hesapları, sensör verileri. Kararsızsan **`f64`** kullan.

Şimdi bir market hesabı yapalım. Bu program derlenir mi?

````compiles
code: |
  fn main() {
      let fiyat = 2.5;
      let adet = 4;
      let toplam = fiyat * adet;
      println!("{toplam}");
  }
answer: false
error: E0277
explanation: |
  Derlenmez! `fiyat` ondalıklı, `adet` tamsayı. Rust tamsayı ile ondalık sayıyı **kendiliğinden
  karıştırmaz**:

  ```text
  error[E0277]: cannot multiply `{float}` by `{integer}`
   --> src/main.rs:4:24
    |
  4 |     let toplam = fiyat * adet;
    |                        ^ no implementation for `{float} * {integer}`
  ```

  `{float}` ve `{integer}`, derleyicinin "henüz kesin tipini seçmediğim ondalık/tamsayı" deme
  biçimidir. Çözüm: `let adet = 4.0;` yazmak ya da dönüşüm yapmak (`adet as f64`, bu dersin sonunda).
  JavaScript veya Python bu işlemi sessizce yapar; Rust ise dönüşümü **görünür** kılmanı ister.
````

Aritmetik operatörler tamsayılarda ve ondalık sayılarda aynıdır. Öncelikleri matematikteki gibidir:
`*`, `/`, `%` önce; `+`, `-` sonra yapılır. Emin değilsen parantez kullan.

| Operatör | Anlamı | Bileşik atama | Örnek (`x` başta 10) |
|---|---|---|---|
| `+` | toplama | `x += 3` | `13` |
| `-` | çıkarma | `x -= 3` | `7` |
| `*` | çarpma | `x *= 3` | `30` |
| `/` | bölme | `x /= 3` | `3` (tamsayı) |
| `%` | kalan | `x %= 3` | `1` |

**Bileşik atama (compound assignment)** `x += 3`, `x = x + 3`'ün kısa yazımıdır. Değişkeni
değiştirdiği için değişken **`mut`** olmalıdır (yoksa Ders 1'deki `E0384` hatasını alırsın).
C, Java veya JavaScript'ten gelen biri `x++` yazmayı dener; Rust'ta bu operatör **yoktur**:

:::error x++ yok
```text
error: Rust has no postfix increment operator
 --> src/main.rs:3:6
  |
3 |     x++;
  |      ^^ not a valid postfix operator
  |
help: use `+= 1` instead
```
Neden yok? `x++` ve `++x` arasındaki ince fark ("önce mi artır, sonra mı kullan?") C'de yıllarca hataya
yol açtı. Rust tek ve açık bir yol seçti: `x += 1`.
:::

Ondalık sayıların kullanışlı metotları da vardır: `sqrt` (karekök), `powi` (tamsayı üs), `powf`
(ondalık üs), `round` (en yakına yuvarla), `floor` (aşağı), `ceil` (yukarı), `trunc` (ondalığı at),
`abs` (mutlak değer).

```rust
fn main() {
    let x: f64 = 2.0;
    println!("√2 = {}", x.sqrt());
    println!("2¹⁰ = {}", x.powi(10));
    let fiyat = 19.99_f64;
    println!("{} {} {} {}", fiyat.round(), fiyat.floor(), fiyat.ceil(), fiyat.trunc());
}
```

:::warning Metot çağırmak için tip belli olmalı
`let x = 2.0;` yazıp `x.sqrt()` dersen derleyici şikâyet eder:

```text
error[E0689]: can't call method `sqrt` on ambiguous numeric type `{float}`
help: you must specify a type for this binding, like `f32`
  |
2 |     let x: f32 = 2.0;
  |          +++++
```
`x` hem `f32` hem `f64` olabilir; derleyici hangi tipin `sqrt`'unu çağıracağını bilemez. Tipi yaz
(`let x: f64 = 2.0;`) ya da son ek kullan (`2.0_f64.sqrt()`).
:::

Şimdi sıra sende. Bir koşucunun haftalık mesafesini hesaplayan programı tamamla:

```fill
prompt: Boşlukları doldur. Sabah 5 km koşuldu, akşam 3,5 km yürüyüldü ve bu her gün tekrarlanacak.
code: |
  fn main() {
      let ___0 mesafe_km = 0.0;
      mesafe_km ___1 5.0; // sabah koşusu
      mesafe_km += 3.5; // akşam yürüyüşü
      mesafe_km ___2 7.0; // haftanın 7 günü
      println!("Haftalık: {mesafe_km:.1} km");
  }
blanks:
  - ["mut"]
  - ["+="]
  - ["*="]
output: "Haftalık: 59.5 km"
explanation: |
  Değişken güncelleneceği için `mut` gerekir. `+= 5.0` mesafeyi 5 artırır, `*= 7.0` ise 7 ile çarpar:
  `(0 + 5 + 3,5) × 7 = 59,5`. Dikkat: `*= 7` yazsaydın derlenmezdi, çünkü `mesafe_km` ondalıklı;
  ondalıklı bir değişkeni tamsayıyla çarpamazsın.
```

## Kayan noktanın tuzakları

Matematikte 0,1 + 0,2 = 0,3'tür. Peki bilgisayarda? Tahmin et:

```predict
code: |
  fn main() {
      let toplam = 0.1 + 0.2;
      println!("{toplam}");
      println!("{}", toplam == 0.3);
  }
options:
  - "0.3\ntrue"
  - "0.30000000000000004\nfalse"
  - "0.3\nfalse"
  - "0.30000000000000004\ntrue"
answer: 1
explanation: |
  Şaşırtıcı ama doğru: `0.1 + 0.2` sonucu `0.30000000000000004`'tür ve `0.3`'e **eşit değildir**.
  Bu Rust'ın hatası değil; Python, JavaScript, Java ve C'de de aynı değer çıkar, çünkü hepsi aynı
  **IEEE 754** kayan nokta standardını kullanır. Nedeni aşağıda.
```

Bilgisayar sayıları **ikilik (binary)** sistemde tutar. 1/2, 1/4, 1/8 gibi kesirler ikilikte tam
yazılır. Ama 1/10 yazılamaz; sonsuza kadar tekrar eder: `0.000110011001100110011...` Bellek sınırlı
olduğu için bir yerde **kesilir** ve küçük bir yuvarlama hatası oluşur. `0.1` ile `0.2`'nin hataları
toplanınca, `0.3`'ün kendi yuvarlanmış hâlinden çok az farklı bir sayı çıkar.

:::analogy Defterde 1/3
Bir defterde 1/3'ü ondalık olarak yazmaya çalış: `0,3333333...` Sayfa bittiğinde durmak zorundasın.
Üç tane `0,3333` toplarsan `1` değil `0,9999` elde edersin. Bilgisayarın 1/10 ile yaşadığı sorun
tam olarak budur. Tek fark, onun defteri **ikilik** sistemde yazılmış olması.
:::

Bu yüzden **hesaplama sonucu çıkan** iki ondalık sayıyı `==` ile karşılaştırma. Bunun yerine
farklarının çok küçük olup olmadığına bak:

```rust
fn main() {
    let toplam: f64 = 0.1 + 0.2;
    let fark = (toplam - 0.3).abs();
    println!("== ile: {}", toplam == 0.3);
    println!("Fark: {fark}");
    println!("Yeterince yakın mı? {}", fark < 1e-9);
}
```

`1e-9` (milyarda bir) burada **tolerans** görevi görür; ne kadar küçük seçeceğin uygulamaya bağlıdır.
`f64::EPSILON` sabiti de vardır (yaklaşık 2,2 × 10⁻¹⁶), ama o yalnızca 1,0 civarındaki sayılar için
anlamlıdır. Büyük sayılarda iki komşu `f64` arasındaki boşluk çok daha geniştir.

:::deep Sonsuz ve NaN
Tamsayıları sıfıra bölmek panik yaratır (Ders 3). Ondalık sayılarda ise IEEE 754 standardı özel
değerler tanımlar ve program **panik yapmaz**:

```text
1.0 / 0.0   →  inf   (sonsuz)
-1.0 / 0.0  →  -inf
0.0 / 0.0   →  NaN   (Not a Number, "sayı değil")
```

NaN tuhaf bir değerdir: **kendisine bile eşit değildir** (`f64::NAN == f64::NAN` sonucu `false`).
Bir değerin NaN olup olmadığını `x.is_nan()` ile sorarsın. Bu tuhaflık yüzünden ondalık sayılar,
tamsayılar gibi kendiliğinden sıralanamaz; Modül 9'da `total_cmp` ile nasıl sıralandıklarını
göreceksin.
:::

Peki para gibi **kuruşu kuruşuna** doğru olması gereken değerler? Onları ondalık sayıyla tutmazsın:

```quiz
question: |
  Bir market uygulamasında ürün fiyatlarını ve sepet toplamını tutacaksın. 1 kuruşluk hata bile kabul
  edilemez. En güvenli seçim hangisi?
options:
  - "Fiyatları `f32` olarak tutmak (`12.99`)"
  - "Fiyatları `f64` olarak tutmak; daha hassas olduğu için yeterlidir"
  - "Fiyatları kuruş cinsinden tamsayı olarak tutmak (`1299` kuruş, `u64`)"
  - "Fiyatları `f64` tutup her toplamadan sonra `round()` çağırmak"
answer: 2
explanation: |
  Tamsayılar **tam**dır: 1299 + 1 her zaman 1300'dür. Kuruş cinsinden tamsayı tutup yalnızca ekrana
  yazarken `{}.{:02}` biçiminde TL'ye çevirirsin. Bankalar ve ödeme sistemleri de böyle yapar (ya da
  özel ondalık tipler kullanır).
feedback:
  - "`f32` sadece 7 basamak hassasiyet verir; büyük tutarlarda kuruşlar bile kaybolur."
  - "`f64` çok daha hassastır ama yine de `0.1 + 0.2` problemini yaşar. Hatalar binlerce işlemde birikir."
  - Doğru! Tamsayılarda yuvarlama hatası yoktur.
  - Hatalar her işlemde yeniden oluşur. Sürekli yuvarlamak sorunu gizler, çözmez.
```

## bool, karşılaştırma ve mantıksal operatörler

**`bool`** tipinin yalnızca iki değeri vardır: `true` (doğru) ve `false` (yanlış). Bellekte 1 bayt
yer kaplar. Bir `bool`'u çoğunlukla bir **karşılaştırmanın** sonucu olarak elde edersin:

| Operatör | Anlamı | Örnek | Sonuç |
|---|---|---|---|
| `==` | eşit mi | `5 == 5` | `true` |
| `!=` | eşit değil mi | `5 != 3` | `true` |
| `<` / `>` | küçük / büyük | `3 > 5` | `false` |
| `<=` / `>=` | küçük eşit / büyük eşit | `5 >= 5` | `true` |

Birden fazla koşulu **mantıksal operatörlerle** birleştirirsin:

- `a && b` (**ve**): ikisi de `true` ise `true`.
- `a || b` (**veya**): en az biri `true` ise `true`.
- `!a` (**değil**): `true`'yu `false`'a, `false`'u `true`'ya çevirir.

```rust
fn main() {
    let sicaklik = 28;
    let yagmur_var = false;
    let sicak = sicaklik > 25;
    let piknik_havasi = sicak && !yagmur_var;
    let mont_gerekli = sicaklik < 10 || yagmur_var;
    println!("Sıcak mı? {sicak}");
    println!("Piknik havası mı? {piknik_havasi}");
    println!("Mont gerekli mi? {mont_gerekli}");
}
```

Öncelik sırası şöyledir: önce `!`, sonra karşılaştırmalar, sonra `&&`, en son `||`. Yani `&&`,
matematikteki çarpma gibi, `||`'den **önce** yapılır. Bunu aklında tutarak tahmin et:

```predict
code: |
  fn main() {
      let yas = 17;
      let veli_izni = true;
      let bilet_var = false;
      println!("{}", yas >= 18 || veli_izni);
      println!("{}", (yas >= 18 || veli_izni) && bilet_var);
      println!("{}", !bilet_var && yas > 12);
      println!("{}", veli_izni || bilet_var && yas >= 18);
  }
options:
  - "true\nfalse\ntrue\ntrue"
  - "true\nfalse\ntrue\nfalse"
  - "false\nfalse\ntrue\nfalse"
  - "true\ntrue\nfalse\ntrue"
answer: 0
explanation: |
  1. `false || true` → `true`.
  2. `(true) && false` → `false`: parantez önce `||`'yi hesaplattı.
  3. `!false && true` → `true && true` → `true`.
  4. `&&` önce yapılır: `veli_izni || (bilet_var && yas >= 18)` → `true || false` → `true`.
     Soldan sağa okuyup `(true || false) && false` hesaplasaydın `false` bulurdun (ikinci seçenek).
     Okuyanın kafası karışmasın diye böyle ifadelerde **parantez kullan**.
```

`&&` ve `||` **kısa devre (short-circuit)** yapar: sonuç sol taraftan belli oluyorsa sağ taraf hiç
hesaplanmaz. `false && ...` her zaman `false`, `true || ...` her zaman `true`'dur. Bu, sağ taraf
tehlikeli olduğunda hayat kurtarır:

```rust
fn main() {
    let ogrenci_sayisi = 0;
    let toplam_puan = 0;
    // Sol taraf false olduğu için bölme HİÇ yapılmaz; sıfıra bölme paniği olmaz.
    let ortalama_yuksek = ogrenci_sayisi > 0 && toplam_puan / ogrenci_sayisi > 70;
    println!("Ortalama 70'ten yüksek mi? {ortalama_yuksek}");
}
```

İki önemli fark daha var. Birincisi, Rust'ta karşılaştırmalar **zincirlenemez**. Matematikteki
`1 < x < 10` yazımı derlenmez; derleyici çözümü de söyler:

:::error Zincirleme karşılaştırma
```text
error: comparison operators cannot be chained
 --> src/main.rs:5:22
  |
5 |     println!("{}", a < b < c);
  |                      ^   ^
help: split the comparison into two
  |
5 |     println!("{}", a < b && b < c);
  |                          ++++
```
:::

İkincisi, Rust'ta sayılar **doğruluk değeri değildir**. C, Python ve JavaScript'te `0` "yanlış", diğer
sayılar "doğru" sayılır (*truthiness*). Rust'ta `let acik: bool = 1;` satırı
`E0308: expected bool, found integer` hatası verir. Bir sayının sıfır olup olmadığını merak ediyorsan
bunu açıkça sor: `sayi != 0`. Aynı şekilde `5 == 5.0` da derlenmez: bir tamsayıyı ondalık sayıyla
karşılaştıramazsın.

:::tip İki bool farklı mı?
İki koşuldan **yalnızca birinin** doğru olup olmadığını (XOR, "ya biri ya öteki") sormak için `!=`
kullanabilirsin: `kahve_istiyor != cay_istiyor` sonucu, ikisinden sadece biri `true` ise `true`'dur.
(`bool` için `^` operatörü de aynı işi yapar: `kahve_istiyor ^ cay_istiyor`.)
:::

## char — tek bir Unicode karakteri

**`char`** tek bir karakteri tutar ve **tek tırnakla** yazılır: `'a'`. Çift tırnak (`"a"`) ise bir
**metindir** (string). Rust'ın `char`'ı İngilizce harflerle sınırlı değildir:

```rust
fn main() {
    let harf = 'ş';
    let yengec = '🦀';
    let rakam = '7';
    let japonca = 'あ';
    println!("{harf} {yengec} {rakam} {japonca}");
    println!("'ş' bir harf mi? {}", harf.is_alphabetic());
    println!("'7' bir rakam mı? {}", rakam.is_ascii_digit());
    println!("'Ş' büyük harf mi? {}", 'Ş'.is_uppercase());
    println!("'a' büyütülünce: {}", 'a'.to_ascii_uppercase());
}
```

Bir `char` bellekte her zaman **4 bayt** yer kaplar, çünkü bir **Unicode skaler değeri (Unicode scalar
value)** tutar. Unicode, dünyadaki neredeyse bütün yazı sistemlerine, sembollere ve emojilere bir
numara verir: `'A'` 65, `'ş'` 351, `'🦀'` 129408 numaralıdır. En büyük numara (`0x10FFFF`) bir milyonu
aştığı için 1 ya da 2 bayt yetmez; Rust en büyük numaranın da sığacağı 4 baytı ayırır. "Skaler değer"
ifadesindeki ince ayrıntı: `0xD800`-`0xDFFF` arasındaki numaralar UTF-16'nın iç işleri için ayrılmıştır
(*surrogate*) ve hiçbir `char` bu aralıkta olamaz.

```memory
title: char her zaman 4 bayt
steps:
  - caption: "Üç `char` değişkeni de 4 bayt yer kaplıyor; içlerinde karakterin Unicode numarası duruyor."
    stack:
      - frame: main
        vars:
          - { name: a, type: char, value: "'A'", note: "4 bayt · numara 65" }
          - { name: s, type: char, value: "'ş'", note: "4 bayt · numara 351" }
          - { name: y, type: char, value: "'🦀'", note: "4 bayt · numara 129408" }
  - caption: "Bir **metnin** içinde ise karakterler UTF-8 ile sıkıştırılır: `A` 1, `ş` 2, `🦀` 4 bayt. Bu yüzden `\"şey\".len()` 4 verir."
    stack:
      - frame: main
        vars:
          - { name: metin, type: "&str", value: "\"şey\"", to: h1, note: "len = 4 bayt" }
    heap:
      - { id: h1, label: "programın içinde (salt okunur)", value: "[ş: 2 bayt][e: 1][y: 1]" }
```

Diğer dillerle karşılaştır: C'nin `char`'ı 1 bayttır ve sadece ASCII'yi rahat tutar; `'ş'` oraya
sığmaz. Java'nın `char`'ı 2 bayttır; `'🦀'` gibi emojiler ona sığmaz ve iki parçaya bölünür. Rust'ın
`char`'ı ise **her** Unicode skaler değerini tek başına tutabilir.

```quiz
question: "`let c = 'ş';` satırındaki `c` değişkeni bellekte kaç bayt yer kaplar?"
options:
  - "1 bayt"
  - "2 bayt"
  - "4 bayt"
  - "Karaktere göre değişir: 1 ile 4 arası"
answer: 2
explanation: |
  `char` her zaman 4 bayttır, içinde hangi karakter olursa olsun. `'ş'` bir **metnin** içinde UTF-8
  ile 2 bayt yer kaplar (`'ş'.len_utf8()` 2 verir), ama tek başına bir `char` değişkeni hep 4 bayttır.
feedback:
  - 1 bayt C'nin `char`'ıdır. Rust'ta 1 baytlık tip `u8`'dir (ve `bool`).
  - "2 bayt, `'ş'`'nin bir metin içinde UTF-8 ile kapladığı yerdir; `char` değişkeninin değil."
  - Doğru! Rust'ın `char`'ı sabit boyutludur.
  - "Bu, karakterlerin metin içindeki (UTF-8) boyutu için doğru. `char` tipi ise sabit 4 bayttır."
```

Peki ekranda tek bir şekil gibi görünen her şey bir `char` mıdır? Tahmin et:

```compiles
code: |
  fn main() {
      let bayrak = '🇹🇷';
      println!("{bayrak}");
  }
answer: false
explanation: |
  Derlenmez! Bayrak emojisi ekranda tek bir şekil gibi görünse de aslında **iki** Unicode değerinden
  oluşur: 🇹 ve 🇷 ("bölgesel gösterge" harfleri T ve R). Derleyici şöyle der:

  ```text
  error: character literal may only contain one codepoint
  help: if you meant to write a string literal, use double quotes
  ```

  Çift tırnakla yazarsan (`"🇹🇷"`) bir metin olur ve sorunsuz çalışır. Ekranda görünen "karakter" ile
  Unicode değeri her zaman aynı şey değildir; bu ince konuya Modül 9'da `String`'leri incelerken
  döneceğiz.
```

:::warning Türkçe büyük-küçük harf
`to_ascii_uppercase` yalnızca İngilizce harfleri değiştirir: `'ç'.to_ascii_uppercase()` yine `'ç'`
döndürür. Unicode'a uygun büyütme ve Türkçedeki ünlü `i`/`İ`, `ı`/`I` tuzağı Modül 9'un konusu.
:::

## as ile tip dönüşümü

Rust tipleri kendiliğinden dönüştürmez, ama sen açıkça istersen dönüştürür. Bunun en basit yolu
**`as`** anahtar kelimesidir: `deger as HedefTip`. Önce tahmin et:

```predict
code: |
  fn main() {
      let a = 7.9_f64 as i32;
      let b = (-7.9_f64) as i32;
      let c = 300_i32 as u8;
      let d = 'A' as u8;
      println!("{a} {b} {c} {d}");
  }
options:
  - "7 -7 44 65"
  - "8 -8 44 65"
  - "7 -8 255 65"
  - "8 -8 255 65"
answer: 0
explanation: |
  - Ondalıktan tamsayıya `as` **yuvarlamaz**, ondalık kısmı **atar** (sıfıra doğru keser):
    `7.9 → 7`, `-7.9 → -7`.
  - `300` bir `u8`'e sığmaz. Tamsayıyı daha küçük bir tamsayı tipine çevirirken `as`, sayının yalnızca
    **son 8 bitini** alır: `300 = 256 + 44`, geriye `44` kalır.
  - `'A'`'nın Unicode (ve ASCII) numarası `65`'tir.
```

```memory
title: 300_i32 as u8 bit düzeyinde
steps:
  - caption: "`300`, 32 bitlik bir `i32` olarak bellekte böyle durur."
    stack:
      - frame: main
        vars:
          - { name: x, type: i32, value: "300", note: "00000000 00000000 00000001 00101100" }
  - caption: "`x as u8` yalnızca son 8 biti alır. Baştaki `1` (256 değerindeki bit) sessizce atılır, geriye `00101100` = 44 kalır."
    stack:
      - frame: main
        vars:
          - { name: x, type: i32, value: "300", note: "00000000 00000000 00000001 00101100" }
          - { name: y, type: u8, value: "44", note: "00101100" }
```

`as`'ın kurallarını gruplayalım:

| Dönüşüm | Ne olur? | Örnek |
|---|---|---|
| küçük tamsayı → büyük tamsayı | kayıpsız | `200_u8 as u32` → `200` |
| büyük tamsayı → küçük tamsayı | son bitler kalır (başa sarma gibi) | `300_i32 as u8` → `44`, `-1_i32 as u8` → `255` |
| işaretli ↔ işaretsiz (aynı boyut) | bitler aynen, anlam değişir | `200_u8 as i8` → `-56` |
| tamsayı → ondalık | çoğunlukla kayıpsız, çok büyük sayılarda yuvarlanır | `5_i32 as f64` → `5.0` |
| ondalık → tamsayı | ondalık atılır; sığmazsa **sınırda durur**, NaN → 0 | `300.7 as u8` → `255`, `-5.0 as u8` → `0` |
| `u8` → `char` | ASCII/Latin-1 karakteri | `65_u8 as char` → `'A'` |
| `char` → `u32` | Unicode numarası | `'ş' as u32` → `351` |
| `char` → `u8` | **yalnızca son 8 bit!** ASCII dışı harfler bozulur | `'A' as u8` → `65`, ama `'ş' as u8` → `95` (`'_'`) |
| `bool` → tamsayı | `false` → 0, `true` → 1 | `true as i32` → `1` |

:::analogy Dar bir çerçeve
`as` ile büyük bir değeri küçük bir tipe sokmak, büyük bir fotoğrafı küçük bir çerçeveye sığdırmak
için kenarlarını **makasla kesmeye** benzer. Çerçeve dolar, fotoğraf "sığmış" olur; ama kesilen
parçaları kimse sana haber vermez. Fotoğrafın ne kadarının kaldığını sen düşünmelisin.
:::

En önemli ders şu: **`as` çalışma zamanında asla hata vermez ve asla panik yapmaz.** Sığmayan bir
değeri sessizce keser ya da sınıra yapıştırır. (Derleyici yalnızca anlamsız dönüşümleri reddeder;
aşağıdaki `E0604` gibi.) Bu yüzden `as`'ı yalnızca sonucun sığacağından emin olduğunda kullan. Modül
11'de iki güvenli kardeşini göreceksin: yalnızca kayıpsız dönüşümlerde derlenen `u32::from(x)` ve
değerin sığıp sığmadığını kontrol eden `u8::try_from(300)`.

Birkaç pratik kural daha:

```rust
fn main() {
    let notlar_toplami = 247;
    let ogrenci = 3;
    // Önce ondalığa çevir, SONRA böl: yoksa tamsayı bölmesi ondalığı yutar.
    let yanlis = (notlar_toplami / ogrenci) as f64;
    let dogru = notlar_toplami as f64 / ogrenci as f64;
    println!("Yanlış: {yanlis}, doğru: {dogru:.2}");

    // Yuvarlamak istiyorsan as'tan ÖNCE round() çağır.
    let puan = 82.6_f64;
    println!("Kesilmiş: {}, yuvarlanmış: {}", puan as i32, puan.round() as i32);
}
```

`as` öncelikli bir operatördür: `notlar_toplami as f64 / ogrenci as f64` ifadesinde iki dönüşüm de
bölmeden **önce** yapılır. Ama eksi işareti `as`'tan da önce gelir, bu yüzden `-7.9_f64 as i32`
de `-7` verir; yine de okunabilirlik için parantez kullanmak iyi bir alışkanlıktır.

:::error Her tip char'a çevrilemez
```text
error[E0604]: only `u8` can be cast as `char`, not `i32`
 --> src/main.rs:3:13
  |
3 |     let c = x as char;
  |             ^^^^^^^^^ invalid cast
help: consider using `char::from_u32` instead (via a `u32`)
```
Her `u8` geçerli bir karakter numarasıdır, ama her `i32` (hatta her `u32`) değildir: örneğin `-5`,
`0x110000` ya da surrogate aralığındaki `55296` (`0xD800`). Rust, geçersiz bir `char` oluşabilecek
dönüşüme `as` ile izin vermez. `char::from_u32` ise "belki geçerli, belki değil" anlamında bir
`Option` döndürür (Modül 7).
:::

:::ferris
Rust'ın "her dönüşümü açıkça yaz" kuralı ilk başta yorucu gelebilir. Ama bir dahaki sefere `as`
yazarken "bu değer sığar mı?" diye bir saniye düşüneceksin. İşte o bir saniye, gece yarısı hata
ayıklamaktan kurtaran saniyedir. 🦀
:::

## Alıştırmalar

İki alıştırmada da Ders 3'teki **fonksiyon kabuğunu** kullanacaksın: parametreler sana verilir,
gövdenin son satırı noktalı virgülsüz yazılır ve fonksiyonun sonucu olur.

````exercise
id: m02-e-not-ortalamasi
title: Vize, final ve geçme notu
difficulty: 2
prompt: |
  Bir üniversitede ders notu şöyle hesaplanıyor: **vize %40**, **final %60** ağırlıklı. Öğrencinin
  dersi geçmesi için iki şart var:

  - Ağırlıklı ortalama **en az 50** olmalı.
  - Final notu **en az 45** olmalı (final barajı).

  Notlar `u8` olarak geliyor (0-100). İki fonksiyonu tamamla:

  - `ortalama(vize, final_notu)`: ağırlıklı ortalamayı `f64` olarak döndürsün.
    Örnek: `ortalama(70, 80)` → `76.0`
  - `gecti_mi(vize, final_notu)`: iki şart da sağlanıyorsa `true` döndürsün. İçinde `ortalama`'yı
    çağırabilirsin.
starter: |
  fn ortalama(vize: u8, final_notu: u8) -> f64 {
      todo!()
  }

  fn gecti_mi(vize: u8, final_notu: u8) -> bool {
      todo!()
  }

  fn main() {
      println!("Ortalama: {:.1}", ortalama(70, 80));
      println!("Geçti mi? {}", gecti_mi(70, 80));
  }
solution: |
  fn ortalama(vize: u8, final_notu: u8) -> f64 {
      (vize as f64 * 40.0 + final_notu as f64 * 60.0) / 100.0
  }

  fn gecti_mi(vize: u8, final_notu: u8) -> bool {
      ortalama(vize, final_notu) >= 50.0 && final_notu >= 45
  }

  fn main() {
      println!("Ortalama: {:.1}", ortalama(70, 80));
      println!("Geçti mi? {}", gecti_mi(70, 80));
  }
check: tests
tests: |
  #[test]
  fn ortalama_agirlikli_hesaplanir() {
      let sonuc = ortalama(70, 80);
      assert!((sonuc - 76.0).abs() < 1e-9, "70 vize, 80 final: 70×0,4 + 80×0,6 = 76 olmalı, {sonuc} bulundu");
      let sonuc = ortalama(0, 84);
      assert!((sonuc - 50.4).abs() < 1e-9, "0 vize, 84 final: 84×0,6 = 50,4 olmalı, {sonuc} bulundu");
  }

  #[test]
  fn ortalama_ucta_dogru() {
      assert!((ortalama(100, 100) - 100.0).abs() < 1e-9, "iki not da 100 ise ortalama 100 olmalı");
      assert!(ortalama(0, 0).abs() < 1e-9, "iki not da 0 ise ortalama 0 olmalı");
  }

  #[test]
  fn ortalama_ve_baraj_saglaninca_gecer() {
      assert!(gecti_mi(70, 80), "ortalama 76, final 80: geçmeli");
      assert!(gecti_mi(50, 50), "ortalama tam 50, final 50: geçmeli (en az 50 yeterli)");
      assert!(gecti_mi(100, 45), "ortalama 67, final tam 45: geçmeli (baraj en az 45)");
  }

  #[test]
  fn ortalama_dusukse_kalir() {
      assert!(!gecti_mi(30, 60), "ortalama 48: 50'nin altında, kalmalı");
  }

  #[test]
  fn final_barajinin_altinda_kalir() {
      assert!(!gecti_mi(100, 44), "ortalama 66,4 ama final 44: barajın altında, kalmalı");
  }
hints:
  - "`u8` ile `f64` doğrudan çarpılamaz. Önce notları `as f64` ile ondalığa çevir."
  - "Ortalama: `vize as f64 * 0.4 + final_notu as f64 * 0.6`. Geçme: iki koşulu `&&` ile birleştir."
  - "`gecti_mi` gövdesi tek satır: `ortalama(vize, final_notu) >= 50.0 && final_notu >= 45`"
explanation: |
  `vize as f64` dönüşümü kayıpsızdır (her `u8` bir `f64`'e tam sığar). Çözümde `0.4` ve `0.6` yerine
  önce `40.0` ve `60.0` ile çarpıp sonra `100.0`'e böldük. Neden? `0.4` ve `0.6` ikilik sistemde tam
  yazılamaz; `40.0`, `60.0` ve `100.0` ise tam yazılır. Böylece `ortalama(70, 80)` tam olarak `76.0`
  çıkar. `0.4`/`0.6` ile yazdıysan da testler geçer, çünkü testler `==` yerine **tolerans** ile
  karşılaştırıyor (`(sonuc - 76.0).abs() < 1e-9`). Ondalık sayıları test ederken hep böyle yap.

  `gecti_mi`'de iki koşulu `&&` ile bağladık. `final_notu >= 45` karşılaştırması `u8` ile tamsayı
  sabiti arasında; burada dönüşüme gerek yok, `45` sabiti kendiliğinden `u8` kabul edilir.

  Parametrenin adı neden `final` değil de `final_notu`? Çünkü `final`, Rust'ta ileride kullanılmak
  üzere **ayrılmış** bir anahtar kelimedir (Ders 1); değişken adı olamaz.
````

Şimdi biraz daha zorlu bir problem: `char`, `u8`, `%` ve taşma bilgisini birleştireceksin.

````exercise
id: m02-e-sezar-sifresi
title: Sezar şifresi
difficulty: 3
prompt: |
  Jül Sezar mektuplarını her harfi alfabede birkaç adım **kaydırarak** şifrelermiş: 3 adımla `a → d`,
  `b → e`... Alfabenin sonuna gelince başa dönülür: `x → a`, `y → b`, `z → c`.

  `kaydir(harf, adim)` fonksiyonunu tamamla. `harf` her zaman İngilizce alfabeden (`'a'`-`'z'`) küçük
  bir harftir; `adim` 0 ile 255 arasında herhangi bir `u8` olabilir.

  - `kaydir('a', 3)` → `'d'`
  - `kaydir('x', 3)` → `'a'`
  - `kaydir('b', 255)` → `'w'`

  İpucu: harfi bir sayıya çevir, `'a'`'ya göre sırasını bul (0-25), kaydır, `% 26` ile başa sar,
  sonra tekrar `char`'a çevir. Ama dikkat: `u8` en fazla 255 tutar!
starter: |
  fn kaydir(harf: char, adim: u8) -> char {
      todo!()
  }

  fn main() {
      println!("{}{}{}{}", kaydir('r', 3), kaydir('u', 3), kaydir('s', 3), kaydir('t', 3));
  }
solution: |
  fn kaydir(harf: char, adim: u8) -> char {
      let sira = harf as u8 - b'a'; // 0..=25
      let yeni_sira = (sira + adim % 26) % 26; // en fazla 25 + 25 = 50, taşmaz
      (b'a' + yeni_sira) as char
  }

  fn main() {
      println!("{}{}{}{}", kaydir('r', 3), kaydir('u', 3), kaydir('s', 3), kaydir('t', 3));
  }
check: tests
tests: |
  #[test]
  fn basit_kaydirma() {
      assert_eq!(kaydir('a', 3), 'd', "'a' 3 adım kayınca 'd' olmalı");
      assert_eq!(kaydir('m', 1), 'n', "'m' 1 adım kayınca 'n' olmalı");
      assert_eq!(kaydir('k', 0), 'k', "0 adım kaydırma harfi değiştirmemeli");
  }

  #[test]
  fn alfabenin_sonunda_basa_doner() {
      assert_eq!(kaydir('x', 3), 'a', "'x' 3 adım kayınca başa dönüp 'a' olmalı");
      assert_eq!(kaydir('z', 1), 'a', "'z' 1 adım kayınca 'a' olmalı");
      assert_eq!(kaydir('a', 25), 'z', "'a' 25 adım kayınca alfabenin son harfi 'z' olmalı");
  }

  #[test]
  fn tam_tur_ayni_harfi_verir() {
      assert_eq!(kaydir('q', 26), 'q', "26 adım tam bir turdur, harf değişmemeli");
      assert_eq!(kaydir('c', 52), 'c', "52 adım iki tam turdur");
  }

  #[test]
  fn buyuk_adimlarda_tasma_olmaz() {
      assert_eq!(kaydir('b', 255), 'w', "255 adım = 9 tur + 21 adım; 'b' → 'w' olmalı (u8 taşmasına dikkat!)");
      assert_eq!(kaydir('z', 250), 'p', "250 adım = 9 tur + 16 adım; 'z' → 'p' olmalı");
  }
hints:
  - "`harf as u8` harfin ASCII kodunu verir (`'a'` → 97). `b'a'` da 97'dir; ikisinin farkı harfin alfabedeki sırasıdır (0-25)."
  - "`(sira + adim) % 26` mantıken doğru ama `sira + adim` 255'i aşabilir ve `u8` taşar (panik!). Önce `adim % 26` ile adımı 0-25 arasına indir."
  - "Son adım: `(b'a' + yeni_sira) as char`. `u8` → `char` dönüşümüne `as` izin verir."
forbid:
  - pattern: "wrapping_|saturating_|overflowing_|checked_"
    message: Bu alıştırmayı taşma metotları olmadan, `%` ile taşmayı önleyerek çöz.
explanation: |
  Çözüm üç adımda çalışır:

  1. **Harften sayıya:** `harf as u8 - b'a'` harfin sırasını verir (`'a'` → 0, `'z'` → 25). Harf hep
     küçük İngilizce harf (ASCII) olduğu için `as u8` hiçbir bilgi kaybetmez. Türkçe bir harf gelseydi
     durum farklı olurdu: `'ş' as u8` sessizce `95` verir.
  2. **Kaydır ve başa sar:** `% 26` alfabenin "kilometre sayacıdır". `adim % 26` önce adımı küçültür,
     böylece toplam en fazla `25 + 25 = 50` olur ve `u8`'e rahatça sığar. Doğrudan `sira + adim`
     yazsaydın `kaydir('b', 255)` hesabında `1 + 255 = 256` olur ve debug modunda program
     `attempt to add with overflow` ile panik yapardı.
  3. **Sayıdan harfe:** `(b'a' + yeni_sira) as char`. Rust yalnızca `u8`'den `char`'a `as` izni verir,
     tam da bu iş için.

  **Alternatif:** Hesabı daha geniş bir tipte de yapabilirdin:
  `((harf as u32 - 'a' as u32 + adim as u32) % 26) as u8`. Geniş tipte taşma olmaz, sonucu `u8`'e
  çevirmek de güvenlidir çünkü `% 26` sonucu her zaman 26'dan küçüktür.
````

## Özet

:::remember
- Ondalık sayılar: **`f64`** (varsayılan, ~15-16 basamak) ve `f32` (~7 basamak). Ondalık ayırıcı
  noktadır: `3.5`.
- `0.1 + 0.2 != 0.3`: ondalık sayıları `==` ile değil, `(a - b).abs() < tolerans` ile karşılaştır.
  Para gibi tam değerler için kuruş cinsinden **tamsayı** kullan.
- Tamsayı ile ondalık sayı karışmaz (`E0277`). `x += 1` var, `x++` yok.
- `bool`: `true`/`false`. `&&` ve `||` kısa devre yapar; `&&`, `||`'den önce gelir. Sayılar `bool`
  yerine geçmez.
- `char`: tek tırnak, **4 bayt**, bir Unicode skaler değeri (`'ş'`, `'🦀'`).
- `as` açık dönüşüm yapar ama çalışma zamanında **asla hata vermez**: ondalık → tamsayı keser
  (`7.9 → 7`) ve sınırda durur; büyük → küçük tamsayı son bitleri alır (`300 → 44`, `'ş' as u8 → 95`).
  `as char` yalnızca `u8`'den olur.
:::

```reflect
prompt: |
  Rust, `2.5 * 4` gibi bir ifadeyi derlemeyi reddediyor ve senden dönüşümü `as` ile açıkça yazmanı
  istiyor. Bu kuralın avantajı ve dezavantajı nedir? `as`'ın kendisi neden yine de dikkat gerektirir?
answer: |
  Model cevap: Avantajı, her tip dönüşümünün kodda görünür olmasıdır. C'deki gibi bir sayı sessizce
  başka bir tipe dönüp yanlış bir sonuç üretemez; dönüşüm olan her yeri okuyarak bulabilirim.
  Dezavantajı biraz daha fazla yazı yazmak. Ama `as` da güvenli değildir: değer hedef tipe sığmazsa
  hata vermez, sessizce keser (`300 as u8` → 44) ya da sınırda durur (`300.7 as u8` → 255). Bu yüzden
  `as` yazarken değerin sığacağından emin olmalıyım; emin değilsem ileride göreceğim kontrol eden
  dönüşümleri (`try_from`) kullanmalıyım.
```

```flashcards
- front: Rust'ta ondalıklı bir sabitin (örneğin `2.5`) varsayılan tipi nedir?
  back: "`f64`"
- front: "`0.1 + 0.2 == 0.3` ifadesi neden `false` verir?"
  back: "0,1 ve 0,2 ikilik sistemde tam yazılamaz; yuvarlama hataları toplanınca sonuç `0.30000000000000004` olur."
- front: İki `f64` değerini güvenli biçimde nasıl karşılaştırırsın?
  back: "Farklarının mutlak değerini küçük bir toleransla karşılaştırarak: `(a - b).abs() < 1e-9`"
- front: "`true || false && false` ifadesinin sonucu nedir? Neden?"
  back: "`true`. `&&`, `||`'den önce yapılır: `true || (false && false)`."
- front: "`&&` operatöründe sol taraf `false` ise sağ tarafa ne olur?"
  back: Hiç hesaplanmaz (kısa devre, short-circuit). Sonuç zaten `false`'tur.
- front: Bir `char` bellekte kaç bayt yer kaplar? Neden?
  back: "4 bayt. Her Unicode skaler değerini (en büyüğü bir milyonu aşar) tutabilmesi gerekir."
- front: "`7.9_f64 as i32` ve `300_i32 as u8` kaç verir?"
  back: "`7` (ondalık atılır, yuvarlanmaz) ve `44` (yalnızca son 8 bit kalır: 300 − 256)."
- front: "`let c = x as char;` (`x: i32`) neden derlenmez?"
  back: "`E0604`: `as` ile yalnızca `u8` → `char` dönüşümü yapılabilir; her `i32` geçerli bir karakter değildir."
```
