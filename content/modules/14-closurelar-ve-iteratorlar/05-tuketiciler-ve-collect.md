---
id: m14-l05
title: Iterator tüketicileri ve collect
minutes: 22
type: lesson
objectives:
  - "`sum`, `product`, `count`, `fold`, `any`, `all`, `find`, `position`, `min`/`max`, `min_by_key`/`max_by_key`, `last`, `nth` tüketicilerini doğru durumda seçebilmek"
  - Kısa devre (short-circuit) yapan tüketicilerin iterator'ı ne zaman durdurduğunu tahmin edebilmek
  - "`collect` ile `Vec`, `String`, `HashMap`, `HashSet` kurabilmek ve tip bilgisini (anotasyon ya da turbofish) verebilmek"
  - "`collect::<Result<Vec<_>, _>>()` ile ilk hatada duran bir ayrıştırma yazabilmek"
keywords: [tüketici, consumer, sum, product, count, fold, any, all, find, position, max_by_key, min_by_key, nth, last, collect, FromIterator, turbofish, E0283]
---

Adaptörler bir boru hattı kurar ama musluğu açmaz. Musluğu açan, yani iterator'dan `None` gelene kadar
(ya da yeterince bilgi toplayana kadar) `next()` çağıran metotlara **tüketici (consumer)** denir. Bu derste
standart kütüphanenin en çok kullanılan tüketicilerini ve hepsinin en esnek olanını, **`collect`**'i,
öğreneceksin. Ders bittiğinde yazdığın döngülerin yarısını tek bir satırla ifade edebileceksin.

## Topla, çarp, say: sum, product, count

```rust
fn main() {
    let sepet = [45, 120, 15, 80];

    let toplam: u32 = sepet.iter().sum();
    let adet = sepet.iter().count();
    let pahali_adet = sepet.iter().filter(|&&f| f >= 50).count();
    println!("toplam {toplam} TL, {adet} ürün, {pahali_adet} tanesi 50 TL ve üstü");

    // Faktöriyel: 1'den n'ye kadar çarp
    let n = 10;
    let faktoriyel: u64 = (1..=n).product();
    println!("{n}! = {faktoriyel}");
}
```

Tüketicilerin hepsi iterator'ı **`self` ile** alır, yani iterator'ı tüketir. Bir iterator'ı saydıktan sonra
onunla bir daha işlem yapamazsın, ama koleksiyonun kendisi duruyor, yeni bir `iter()` alabilirsin.

`sum` ve `product`'ta neden `let toplam: u32` diye tip yazdık? Çünkü `&u32`'lerin toplamı farklı tiplerde
olabilir (`u32`, `u64`, hatta `Option<u32>`...) ve derleyici hangisini istediğini tahmin etmez:

:::error
```text
error[E0283]: type annotations needed
    --> src/main.rs:3:9
     |
   3 |     let toplam = v.iter().sum();
     |         ^^^^^^            --- type must be known at this point
     |
     = note: the type must implement `Sum<&i32>`
help: consider giving `toplam` an explicit type
     |
   3 |     let toplam: /* Type */ = v.iter().sum();
     |               ++++++++++++
```
`sum` generic bir dönüş tipine sahiptir: `fn sum<S: Sum<Self::Item>>(self) -> S`. Hangi `S` olduğunu ya
değişkene tip yazarak ya da turbofish ile (`.sum::<u32>()`) söylersin. Bu, bu derste çok göreceğin bir kalıp.
:::

Boş bir iterator'da ne olur? Tahmin et:

```predict
code: |
  fn main() {
      let bos: Vec<i32> = Vec::new();
      let t: i32 = bos.iter().sum();
      let c: i32 = bos.iter().product();
      let n = bos.iter().count();
      println!("{t} {c} {n}");
  }
options:
  - "0 0 0"
  - "0 1 0"
  - Panikler, boş iterator toplanamaz
answer: 1
explanation: |
  Boş toplamın sonucu toplamanın **etkisiz elemanı** olan 0, boş çarpımınki çarpmanın etkisiz elemanı olan
  1'dir. Matematikteki tanımla aynı: böylece `toplam(a ++ b) = toplam(a) + toplam(b)` boş listeler için de
  doğru kalır. Panik yok, `Option` yok - her zaman bir sonuç var.
```

:::warning Taşma
`sum` ve `product` sonuç tipinde hesap yapar ve debug modda taşarsa **panikler** (Modül 2). `(1..=25u64).product()`
`u64`'e sığmaz. Büyük sayılarla çalışırken sonuç tipini geniş seç ya da taşmayı yakalamak için Modül 2'deki
`checked_mul`'u kendi biriktirmende kullan; bunun aracı olan `fold`'u hemen aşağıda göreceksin.
:::

## fold: hepsinin atası

`sum`, `product`, `count`, `max`... hepsi aynı şablonun özel hâlleridir: *bir başlangıç değeri al, her
elemanla güncelle, sonunda sonucu ver.* Bu şablonun kendisi **`fold`**'dur:

```rust,ignore
fn fold<B, F>(self, baslangic: B, f: F) -> B
where
    F: FnMut(B, Self::Item) -> B,
```

Closure iki şey alır: **biriktirici (accumulator)**, şimdiye kadarki sonuç, ve sıradaki eleman; yeni
biriktiriciyi döndürür.

```rust
use std::collections::BTreeMap;

fn main() {
    let notlar = [70, 85, 90];

    // sum'ı fold ile yazmak: 0 → 70 → 155 → 245
    let toplam = notlar.iter().fold(0, |acc, n| acc + n);
    println!("toplam: {toplam}");

    // En uzun kelime (eşitlikte ilki): biriktirici bir &str
    let kelimeler = ["elma", "karpuz", "üzüm", "portakal", "ayva"];
    let en_uzun = kelimeler
        .iter()
        .copied()
        .fold("", |acc, k| if k.chars().count() > acc.chars().count() { k } else { acc });
    println!("en uzun: {en_uzun}");

    // Kelime frekansı: biriktirici bir harita (Modül 9'daki entry API ile)
    let metin = "bir berber bir berbere gel beraber bir berber dükkânı açalım demiş";
    let frekans = metin.split_whitespace().fold(BTreeMap::new(), |mut m, k| {
        *m.entry(k).or_insert(0) += 1;
        m
    });
    println!("{frekans:?}");
}
```

`fold`'un adımlarını bir tabloyla izleyelim, `notlar.iter().fold(0, |acc, n| acc + n)`:

| adım | `acc` (gelen) | `n` | dönen `acc` |
|---|---|---|---|
| 1 | 0 | 70 | 70 |
| 2 | 70 | 85 | 155 |
| 3 | 155 | 90 | **245** |

:::analogy Kartopu
`fold` yokuştan aşağı yuvarlanan bir **kartopudur**. Elindeki küçük top başlangıç değeridir; her
yuvarlanışta yoldaki karı (sıradaki eleman) kendine katar ve büyür. Yokuşun sonunda elinde tek bir büyük
top kalır. Topun ne olduğuna sen karar verirsin: bir sayı, bir `String`, bir harita...
:::

Diğer dillerden tanıyorsan: JavaScript'te `arr.reduce((acc, x) => acc + x, 0)`, Python'da
`functools.reduce(lambda acc, x: acc + x, liste, 0)`. Rust'ta biriktiricinin tipi (`B`) eleman tipinden
tamamen farklı olabilir; frekans örneğinde elemanlar `&str`, biriktirici bir `BTreeMap`.

:::tip fold mu, döngü mü?
Biriktirici basitse (`toplam`, `en_buyuk`) `fold` zariftir. Ama closure uzayıp içinde birden çok değişken
güncellemeye başlarsan, düz bir `for` döngüsü genellikle daha okunaklıdır. Önce hazır tüketicilere bak
(`sum`, `max`, `count`); hiçbiri uymuyorsa `fold`; o da karışık görünüyorsa döngü.
:::

```parsons
prompt: |
  `fold` kullanarak sepetteki ürünlerin **toplam fiyatını** hesaplayan programı kur. Program `"Toplam: 240 TL"`
  yazdırır.
lines: |
  fn main() {
      let sepet = [("çay", 60), ("peynir", 150), ("simit", 30)];
      let toplam = sepet
          .iter()
          .fold(0, |acc, (_, fiyat)| acc + fiyat);
      println!("Toplam: {toplam} TL");
  }
distractors: |
          .fold(|acc, (_, fiyat)| acc + fiyat);
          .fold(0, |(_, fiyat), acc| acc + fiyat);
explanation: |
  `fold`'un ilk argümanı başlangıç değeri (`0`), ikincisi closure'dır. Closure'ın parametre sırası önemli:
  **önce biriktirici**, sonra eleman. Elemanlar `&(&str, i32)` olduğu için `(_, fiyat)` deseni `fiyat`'ı
  `&i32` olarak bağlar; `i32 + &i32` tanımlı olduğundan toplama doğrudan çalışır.
```

## Arama: any, all, find, position

Bu dört tüketici bir **koşul** arar ve cevabı bulduğu anda durur. Buna **kısa devre (short-circuit)** denir,
`&&` ve `||` operatörlerindeki gibi. Tahmin et:

```predict
code: |
  fn main() {
      let notlar = [45, 72, 38, 90];
      let ilk_dusuk = notlar.iter().find(|&&n| {
          println!("bakılıyor: {n}");
          n < 40
      });
      println!("{ilk_dusuk:?}");
  }
options:
  - |
    bakılıyor: 45
    bakılıyor: 72
    bakılıyor: 38
    Some(38)
  - |
    bakılıyor: 45
    bakılıyor: 72
    bakılıyor: 38
    bakılıyor: 90
    Some(38)
  - |
    bakılıyor: 45
    None
answer: 0
explanation: |
  `find` koşulu sağlayan **ilk** elemanı bulduğu anda durur ve onu `Some` içinde döndürür; 90'a hiç
  bakılmaz. Hiçbir eleman uymasaydı dört elemanın hepsine bakıp `None` dönerdi. `find`'ın closure'ı,
  `filter` gibi, öğeyi ödünç alır: burada `&&i32` → `|&&n|` deseniyle açtık.
```

```rust
fn main() {
    let sicakliklar = [18, 22, 31, 27, 35];

    let sicak_gun_var = sicakliklar.iter().any(|&t| t > 30); // en az biri mi?
    let hepsi_ilik = sicakliklar.iter().all(|&t| t > 15); // hepsi mi?
    let ilk_sicak = sicakliklar.iter().find(|&&t| t > 30); // ilk uyan eleman: Option<&i32>
    let ilk_sicak_gun = sicakliklar.iter().position(|&t| t > 30); // ilk uyanın indeksi: Option<usize>

    println!("{sicak_gun_var} {hepsi_ilik} {ilk_sicak:?} {ilk_sicak_gun:?}");

    // Option'ları Modül 7'deki gibi işle
    match ilk_sicak_gun {
        Some(i) => println!("ilk sıcak gün: {}. gün", i + 1),
        None => println!("hiç sıcak gün yok"),
    }
}
```

`any` ve `all`'ın closure'ı öğeyi **değerle** alır (`|&t|` tek `&`), `find` ise **ödünç** alır (`|&&t|`).
Neden? `find` bulduğu elemanı sana geri vermek zorunda; closure onu tüketseydi verecek bir şey kalmazdı.
`any`/`all` ise sadece `bool` döndürür, elemanı saklaması gerekmez.

```quiz
question: "Boş bir iterator için `any(...)` ve `all(...)` ne döndürür?"
options:
  - "`any` → `false`, `all` → `true`"
  - "`any` → `false`, `all` → `false`"
  - "`any` → `true`, `all` → `true`"
  - İkisi de panikler
answer: 0
explanation: |
  `any` "koşulu sağlayan **bir** eleman var mı?" diye sorar - boş kümede yoktur: `false`. `all` "koşulu
  **sağlamayan** bir eleman var mı?" sorusunun tersidir - boş kümede sağlamayan da yoktur: `true`.
  Mantıkta buna *boş doğruluk (vacuous truth)* denir. Pratikte önemlidir: "bütün ödevler teslim edildi mi?"
  sorusu hiç ödev yokken `true` döner; iş kuralın farklıysa boşluğu ayrıca kontrol et.
feedback:
  - Doğru! `all` boş kümede `true` döner.
  - "`all` boş kümede `true` döner: aksini gösteren tek bir eleman yok."
  - "`any` boş kümede `false` döner: koşulu sağlayan tek bir eleman yok."
  - Panik yok; iki metot da her zaman bir `bool` döndürür.
```

## En büyük, en küçük, son ve n'inci: max, min, *_by_key, last, nth

```rust
#[derive(Debug)]
struct Ogrenci {
    ad: String,
    puan: u32,
}

fn main() {
    let puanlar = [72, 95, 61, 88];
    println!("{:?} {:?}", puanlar.iter().max(), puanlar.iter().min()); // Option<&i32>

    let sinif = vec![
        Ogrenci { ad: String::from("Ada"), puan: 88 },
        Ogrenci { ad: String::from("Bora"), puan: 95 },
        Ogrenci { ad: String::from("Cem"), puan: 61 },
    ];
    // max_by_key: anahtara göre en büyük *elemanı* verir (anahtarı değil)
    if let Some(birinci) = sinif.iter().max_by_key(|o| o.puan) {
        println!("birinci: {} ({})", birinci.ad, birinci.puan);
    }
    let en_kisa_ad = sinif.iter().min_by_key(|o| o.ad.len()).map(|o| &o.ad);
    println!("en kısa ad: {en_kisa_ad:?}");

    // f64 Ord değildir (NaN yüzünden, Modül 9) → max_by + total_cmp
    let boylar: [f64; 3] = [1.72, 1.85, 1.64];
    let en_uzun = boylar.iter().copied().max_by(|a, b| a.total_cmp(b));
    println!("en uzun boy: {en_uzun:?}");

    println!("son: {:?}", puanlar.iter().last());
}
```

Hepsi `Option` döndürür, çünkü boş bir koleksiyonun en büyüğü yoktur. Yukarıdaki `.map(|o| &o.ad)`'a dikkat:
`Option`'ın da bir `map` metodu var (Modül 10'da `Result`'ın `map`/`map_err` ikilisini görmüştün); `Some` içindekini dönüştürür.

```quiz
question: |
  `let v = [("Ada", 90), ("Cem", 90), ("Ece", 70)];` için `v.iter().max_by_key(|(_, p)| *p)` hangi elemanı verir?
options:
  - "`Some((\"Ada\", 90))`, eşitlikte ilk gelen"
  - "`Some((\"Cem\", 90))`, eşitlikte son gelen"
  - "`Some(90)`, en büyük anahtar"
  - "`None`, en büyük tek değil"
answer: 1
explanation: |
  Belgelenmiş kural: birden çok eleman eşit derecede en büyükse `max`/`max_by_key` **sonuncusunu**,
  `min`/`min_by_key` ise **ilkini** döndürür. (Sonuç aslında bir `&(&str, i32)`, yani `Some(&("Cem", 90))`.)
  "İlk en büyüğü" istiyorsan bunu açıkça kodla; örneğin `v.iter().rev().max_by_key(...)`.
feedback:
  - Bu `min_by_key`'in eşitlik kuralı; `max` sonuncuyu verir.
  - Doğru! Bu davranış belgelerde garanti edilmiştir.
  - "`max_by_key` anahtarı değil, anahtarı en büyük olan **elemanı** döndürür."
  - Eşitlik `None` sebebi değildir; `None` yalnızca iterator boşsa döner.
```

`nth(n)` ise `n`'inci elemanı (0'dan başlayarak) verir, ama dikkat, bir tüketici gibi davranır ve
**önündeki elemanları da tüketir**. Tahmin et:

```predict
code: |
  fn main() {
      let mut it = [10, 20, 30, 40, 50].iter();
      println!("{:?}", it.nth(1));
      println!("{:?}", it.nth(1));
      println!("{:?}", it.next());
  }
options:
  - |
    Some(20)
    Some(20)
    Some(10)
  - |
    Some(20)
    Some(40)
    Some(50)
  - |
    Some(20)
    Some(30)
    Some(40)
answer: 1
explanation: |
  İlk `nth(1)` 10'u atlar, 20'yi verir; iterator artık 30'da. İkinci `nth(1)` **kaldığı yerden** sayar:
  30'u atlar, 40'ı verir. Sonra `next()` 50'yi verir. `nth` "baştan n'inci" değil, "şu andan itibaren
  n'inci"dir. Rastgele erişim istiyorsan dilimde indeks ya da `get(i)` kullan.
```

## collect: istediğin koleksiyona dök

`collect` en esnek tüketicidir: iterator'ı **herhangi bir koleksiyona** çevirebilir. Nasıl? İmzasına bak:

```rust,ignore
fn collect<B: FromIterator<Self::Item>>(self) -> B
```

Hedef tip `B`, `FromIterator` trait'ini uygulayan herhangi bir şey olabilir: `Vec`, `String`, `HashMap`,
`HashSet`, `BTreeMap`, `VecDeque`... Ama bu esnekliğin bedeli var: **hangi tipi istediğini söylemelisin.**
Söylemezsen `sum`'daki E0283'ü alırsın:

:::error
```text
error[E0283]: type annotations needed
    --> src/main.rs:3:9
     |
   3 |     let iki_kat = v.iter().map(|x| x * 2).collect();
     |         ^^^^^^^                           ------- type must be known at this point
     |
     = note: the type must implement `FromIterator<i32>`
help: consider giving `iki_kat` an explicit type
     |
   3 |     let iki_kat: Vec<_> = v.iter().map(|x| x * 2).collect();
     |                ++++++++
```
Derleyicinin önerisi güzel bir kısaltma kullanıyor: `Vec<_>`. *"Bir `Vec` istiyorum, eleman tipini sen
çıkar."* `_` tip çıkarımına "burayı sen doldur" demektir.
:::

Tipi söylemenin iki yolu var:

```rust
use std::collections::{BTreeMap, HashMap, HashSet};

fn main() {
    let v = vec![3, 1, 3, 2, 1];

    // 1) Değişkene anotasyon
    let iki_kat: Vec<i32> = v.iter().map(|x| x * 2).collect();
    // 2) Turbofish (Modül 2'deki parse::<i32>() gibi)
    let tekrarsiz = v.iter().collect::<HashSet<_>>();
    println!("{iki_kat:?}, {} farklı değer", tekrarsiz.len());

    // String'e: char'lardan ya da &str'lerden
    let ters: String = "kapak".chars().rev().collect();
    let birlesik: String = ["Rust", "çok", "hızlı"].iter().map(|s| s.to_uppercase()).collect();
    println!("{ters} {birlesik}");

    // HashMap / BTreeMap'e: (anahtar, değer) çiftlerinden
    let urunler = ["çay", "kahve", "su"];
    let fiyatlar = [25, 60, 10];
    let menu: HashMap<&str, u32> = urunler.iter().copied().zip(fiyatlar.iter().copied()).collect();
    println!("kahve: {:?}", menu.get("kahve"));

    let sirali: BTreeMap<_, _> = menu.into_iter().collect(); // anahtara göre sıralı
    println!("{sirali:?}");
}
```

`collect` sonucu genellikle bir **fonksiyonun dönüş tipinden** de çıkarılabilir: dönüş tipi `Vec<String>` olan
bir fonksiyonun son ifadesi `...collect()` ise anotasyona gerek yoktur (önceki dersin alıştırmasında böyle yaptık).

```fill
prompt: |
  Bir metindeki **farklı** harfleri alfabetik sırayla tek bir `String`'de topla. Boşluklar sayılmasın.
  Program `aeiklmrsy` yazdırmalı.
code: |
  use std::collections::BTreeSet;

  fn main() {
      let metin = "sesli kelimeler ay";
      let harfler = metin
          .chars()
          .filter(|c| !c.is_whitespace())
          .collect::<___0>();
      let sonuc: ___1 = harfler.into_iter().collect();
      println!("{sonuc}");
  }
blanks:
  - ["BTreeSet<_>", "BTreeSet<char>"]
  - ["String"]
output: aeiklmrsy
explanation: |
  `BTreeSet` hem tekrarları atar hem de elemanları sıralı tutar (Modül 9). İlk `collect` turbofish ile
  `BTreeSet<_>`'e, ikincisi değişken anotasyonuyla `String`'e toplar. `char`'lardan `String` kurmak için
  `FromIterator<char>` uygulaması kullanılır. Aynı tip hedefi, aynı veri - farklı koleksiyonlar: `collect`'in
  gücü buradadır.
```

## Result'a toplamak: ilk hatada dur

`collect`'in en zekice uygulamalarından biri: `Result<T, E>` öğeleri veren bir iterator'ı
**`Result<Vec<T>, E>`**'ye toplayabilirsin. Hepsi `Ok` ise `Ok(vektör)`, biri bile `Err` ise **ilk hatayı**
alırsın. Tahmin et:

```predict
code: |
  fn main() {
      let girdiler = ["3", "x", "5", "y"];
      let sonuc: Result<Vec<i32>, _> = girdiler
          .iter()
          .map(|s| {
              println!("ayrıştırılıyor: {s}");
              s.parse::<i32>()
          })
          .collect();
      match sonuc {
          Ok(v) => println!("hepsi tamam: {v:?}"),
          Err(e) => println!("hata: {e}"),
      }
  }
options:
  - |
    ayrıştırılıyor: 3
    ayrıştırılıyor: x
    ayrıştırılıyor: 5
    ayrıştırılıyor: y
    hata: invalid digit found in string
  - |
    ayrıştırılıyor: 3
    ayrıştırılıyor: x
    hata: invalid digit found in string
  - |
    ayrıştırılıyor: 3
    ayrıştırılıyor: x
    ayrıştırılıyor: 5
    ayrıştırılıyor: y
    hepsi tamam: [3, 5]
answer: 1
explanation: |
  `Result`'a `collect` **kısa devre** yapar: ilk `Err` geldiğinde durur ve onu döndürür. `"5"` ve `"y"`
  hiç ayrıştırılmaz - tembel boru hattı sayesinde iş boşa yapılmaz. Hataları sessizce atmak isteseydin
  önceki dersteki `filter_map(|s| s.parse().ok())` kullanırdın; burada ise hata **raporlanıyor**.
```

Bu kalıp Modül 10'daki `?` ile birleşince çok güçlü olur:

```rust
fn notlari_ayristir(girdi: &str) -> Result<Vec<u32>, std::num::ParseIntError> {
    girdi.split(',').map(|parca| parca.trim().parse::<u32>()).collect()
}

fn ortalama(girdi: &str) -> Result<f64, std::num::ParseIntError> {
    let notlar = notlari_ayristir(girdi)?; // hata varsa hemen yukarı ilet
    let toplam: u32 = notlar.iter().sum();
    Ok(toplam as f64 / notlar.len() as f64)
}

fn main() {
    println!("{:?}", ortalama("70, 85, 90"));
    println!("{:?}", ortalama("70, seksen, 90").is_err());
}
```

Aynısı `Option` için de geçerli: `Option<T>` öğeleri `Option<Vec<T>>`'ye toplanır; biri `None` ise sonuç `None`.

### Alıştırma: market ve not defteri

Şimdi bu dersteki tüketicileri kendin kullan. İlki ısınma, ikincisi az önceki `Result` kalıbını
kendi doğrulama kurallarınla birleştiriyor.

```exercise
id: m14-e-market-sepeti
title: Market sepeti raporu
difficulty: 3
prompt: |
  Sepetteki her kalem bir `Kalem { ad, birim_fiyat, adet }`. İki fonksiyon yaz - ikisi de **döngüsüz**,
  tüketicilerle:

  1. `toplam_tutar(sepet: &[Kalem]) -> u32` - her kalem için `birim_fiyat * adet`'in toplamı.
  2. `en_pahali_kalem(sepet: &[Kalem]) -> Option<&str>` - **kalem tutarı** (`birim_fiyat * adet`) en yüksek
     olan kalemin adı. Sepet boşsa `None`. Eşitlikte hangisinin döneceği testlerde kontrol edilmiyor.
starter: |
  struct Kalem {
      ad: String,
      birim_fiyat: u32,
      adet: u32,
  }

  fn toplam_tutar(sepet: &[Kalem]) -> u32 {
      todo!()
  }

  fn en_pahali_kalem(sepet: &[Kalem]) -> Option<&str> {
      todo!()
  }

  fn main() {
      let sepet = vec![
          Kalem { ad: String::from("ekmek"), birim_fiyat: 15, adet: 3 },
          Kalem { ad: String::from("peynir"), birim_fiyat: 180, adet: 1 },
      ];
      println!("{} {:?}", toplam_tutar(&sepet), en_pahali_kalem(&sepet));
  }
solution: |
  struct Kalem {
      ad: String,
      birim_fiyat: u32,
      adet: u32,
  }

  fn toplam_tutar(sepet: &[Kalem]) -> u32 {
      sepet.iter().map(|k| k.birim_fiyat * k.adet).sum()
  }

  fn en_pahali_kalem(sepet: &[Kalem]) -> Option<&str> {
      sepet
          .iter()
          .max_by_key(|k| k.birim_fiyat * k.adet)
          .map(|k| k.ad.as_str())
  }

  fn main() {
      let sepet = vec![
          Kalem { ad: String::from("ekmek"), birim_fiyat: 15, adet: 3 },
          Kalem { ad: String::from("peynir"), birim_fiyat: 180, adet: 1 },
      ];
      println!("{} {:?}", toplam_tutar(&sepet), en_pahali_kalem(&sepet));
  }
check: tests
tests: |
  fn k(ad: &str, birim_fiyat: u32, adet: u32) -> Kalem {
      Kalem { ad: ad.to_string(), birim_fiyat, adet }
  }

  #[test]
  fn toplam_dogru() {
      let s = vec![k("ekmek", 15, 3), k("peynir", 180, 1), k("su", 10, 6)];
      assert_eq!(toplam_tutar(&s), 45 + 180 + 60, "her kalem için fiyat × adet toplanmalı");
  }

  #[test]
  fn bos_sepet() {
      assert_eq!(toplam_tutar(&[]), 0, "boş sepetin toplamı 0");
      assert_eq!(en_pahali_kalem(&[]), None, "boş sepette en pahalı kalem yok");
  }

  #[test]
  fn adet_hesaba_katilir() {
      let s = vec![k("peynir", 180, 1), k("zeytinyağı", 95, 3), k("ekmek", 15, 2)];
      assert_eq!(en_pahali_kalem(&s), Some("zeytinyağı"), "95 × 3 = 285, 180 × 1'den büyük: birim fiyat değil kalem tutarı");
  }

  #[test]
  fn tek_kalem() {
      let s = vec![k("çay", 60, 2)];
      assert_eq!(en_pahali_kalem(&s), Some("çay"));
      assert_eq!(toplam_tutar(&s), 120);
  }
hints:
  - "`toplam_tutar`: önce her kalemi tutarına `map`'le, sonra `sum()`. Dönüş tipi `u32` olduğu için `sum`'ın hedefi belli."
  - "`en_pahali_kalem`: `max_by_key(|k| k.birim_fiyat * k.adet)` bir `Option<&Kalem>` verir."
  - "`Option<&Kalem>`'ı `Option<&str>`'ye çevirmek için `Option::map`: `.map(|k| k.ad.as_str())`."
forbid:
  - pattern: "\\bfor\\b|\\bwhile\\b"
    message: "Bu alıştırmayı döngü yazmadan, iterator tüketicileriyle çöz."
require:
  - pattern: "max_by_key|max_by|fold"
    message: "En pahalı kalemi bir tüketiciyle (`max_by_key` gibi) bul."
explanation: |
  `map(...).sum()` "dönüştür ve topla" kalıbının en saf hâli. `en_pahali_kalem`'de iki farklı `map` var:
  biri iterator'ın (her elemanı dönüştürür), diğeri `Option`'ın (varsa içindekini dönüştürür). İkisi de aynı
  fikir: "kutunun içindekine bir fonksiyon uygula."

  Dönüş tipi `Option<&str>` ve tek bir referans parametresi (`&[Kalem]`) olduğu için yaşam süresi elision
  kuralları (Modül 12) dönen `&str`'yi `sepet`'e bağlar: sonuç, sepet yaşadığı sürece geçerlidir.

  Gerçek bir uygulamada `birim_fiyat * adet` taşabilir; `checked_mul` ve `Option` döndüren bir `try_fold`
  ile bunu da güvenceye alabilirdin.
```

```exercise
id: m14-e-not-defteri
title: Not defterini ayrıştır
difficulty: 4
prompt: |
  Öğretmen notları virgülle ayrılmış tek bir satır olarak giriyor: `"85, 92,70 , 100"`.
  `notlari_oku(girdi: &str) -> Result<Vec<u32>, String>` fonksiyonunu yaz:

  - Her parçanın etrafındaki boşlukları at ve `u32`'ye ayrıştır.
  - Ayrıştırılamayan bir parça varsa `Err(format!("geçersiz not: {parca}"))` döndür (boşlukları atılmış hâliyle).
  - 100'den büyük bir not varsa `Err(format!("not 100'den büyük olamaz: {n}"))` döndür.
  - **İlk** hatada dur. Hata yoksa `Ok(notlar)`.

  `map` + `collect::<Result<Vec<_>, _>>()` kalıbını kullan. İpucu: `map`'in closure'ı bir `Result` döndürebilir
  ve içinde `?` kullanabilirsin!
starter: |
  fn notlari_oku(girdi: &str) -> Result<Vec<u32>, String> {
      todo!()
  }

  fn main() {
      println!("{:?}", notlari_oku("85, 92,70 , 100"));
      println!("{:?}", notlari_oku("85, doksan, 70"));
  }
solution: |
  fn notlari_oku(girdi: &str) -> Result<Vec<u32>, String> {
      girdi
          .split(',')
          .map(|parca| {
              let parca = parca.trim();
              let n: u32 = parca.parse().map_err(|_| format!("geçersiz not: {parca}"))?;
              if n > 100 {
                  return Err(format!("not 100'den büyük olamaz: {n}"));
              }
              Ok(n)
          })
          .collect()
  }

  fn main() {
      println!("{:?}", notlari_oku("85, 92,70 , 100"));
      println!("{:?}", notlari_oku("85, doksan, 70"));
  }
check: tests
tests: |
  #[test]
  fn gecerli_satir() {
      assert_eq!(notlari_oku("85, 92,70 , 100"), Ok(vec![85, 92, 70, 100]), "boşluklar atılmalı, 100 geçerli");
  }

  #[test]
  fn tek_not() {
      assert_eq!(notlari_oku("42"), Ok(vec![42]));
  }

  #[test]
  fn gecersiz_parca() {
      assert_eq!(
          notlari_oku("85, doksan, 70"),
          Err(String::from("geçersiz not: doksan")),
          "hata mesajı boşlukları atılmış parçayı içermeli"
      );
  }

  #[test]
  fn yuzden_buyuk() {
      assert_eq!(notlari_oku("90, 101"), Err(String::from("not 100'den büyük olamaz: 101")));
  }

  #[test]
  fn ilk_hatada_durur() {
      assert_eq!(
          notlari_oku("150, x"),
          Err(String::from("not 100'den büyük olamaz: 150")),
          "ilk hata (150) raporlanmalı, x'e gelinmemeli"
      );
      assert_eq!(notlari_oku("85, , 70"), Err(String::from("geçersiz not: ")), "boş parça da geçersizdir");
  }
hints:
  - "İskelet: `girdi.split(',').map(|parca| { ... }).collect()`, dönüş tipi `Result<Vec<u32>, String>` olduğu için `collect` neyi kuracağını bilir."
  - "Closure'ın içinde: `let parca = parca.trim(); let n: u32 = parca.parse().map_err(|_| format!(\"geçersiz not: {parca}\"))?;` - `?` closure'dan `Err` döndürür, fonksiyondan değil!"
  - "Sonra `if n > 100 { return Err(...); }` ve son ifade `Ok(n)`. Closure'ın dönüş tipi `Result<u32, String>` olur."
require:
  - pattern: "\\.collect"
    message: "Sonuçları `collect` ile `Result<Vec<_>, _>`'ye topla."
explanation: |
  Buradaki ince nokta, `?` ve `return`'ün **closure'ın içinde** olması: closure kendi başına bir fonksiyondur,
  bu yüzden `?` ve `return` closure'dan çıkar ve o eleman için bir `Err` üretir. Ardından `collect`, ilk `Err`'i
  görünce durur ve onu `notlari_oku`'nun sonucu yapar.

  `map_err` (Modül 10) `ParseIntError`'ı kendi mesajımıza çeviriyor. `parca`'yı closure'ın içinde gölgelemek
  (`let parca = parca.trim();`) hem ayrıştırmada hem de hata mesajında aynı, temizlenmiş metni kullanmamızı sağlıyor.

  Aynı işi bir `for` döngüsü ve erken `return`'lerle de yazabilirdin; `collect::<Result<...>>` sürümü ise
  "her parçayı doğrula, hepsini topla, ilk hatada dur" niyetini tek bir zincirde gösteriyor. Hataları sadece
  saymak ya da hepsini toplamak isteseydin farklı bir yaklaşım (ör. `partition`) gerekirdi.
```

## Özet

:::remember
- **Tüketiciler** iterator'ı `self` ile alıp çalıştırır: `sum`, `product`, `count`, `fold`, `collect`, `for`...
- `sum`/`product`/`collect` generic dönüş tipine sahiptir → tip ver: `let t: u32 = ...` ya da `.sum::<u32>()` (aksi hâlde E0283).
- Boş iterator: `sum` = 0, `product` = 1, `count` = 0, `any` = `false`, `all` = `true`, `max`/`min`/`find` = `None`.
- `fold(baslangic, |acc, x| ...)` her şeyin genel biçimi; closure'da **önce biriktirici**.
- `any`, `all`, `find`, `position` **kısa devre** yapar: cevap belli olunca durur.
- `max`/`min`, `*_by_key`, `last`, `nth`, `find` → `Option`. Eşitlikte `max` sonuncuyu, `min` ilkini verir. `nth` önündekileri tüketir.
- `collect` → `Vec<_>`, `String`, `HashMap`, `HashSet`, `BTreeMap`... (`FromIterator`).
- `Result`'lar `Result<Vec<T>, E>`'ye toplanır: ilk `Err`'de durur. `Option` için de aynısı.
:::

```reflect
prompt: |
  `collect` nasıl oluyor da aynı iterator'dan bazen `Vec`, bazen `String`, bazen `HashMap`, bazen de
  `Result<Vec<_>, _>` üretebiliyor? Generic'ler ve trait'ler (Modül 11) açısından açıkla.
answer: |
  `collect`'in imzası `fn collect<B: FromIterator<Self::Item>>(self) -> B` şeklindedir: dönüş tipi `B` bir
  generic parametredir ve tek şartı `FromIterator<Item>` trait'ini uygulamasıdır. `Vec<T>`, `String`
  (`char` ya da `&str` öğelerden), `HashMap<K, V>` (`(K, V)` çiftlerinden) ve `Result<V, E>` (`V` de
  `FromIterator` ise, `Result<T, E>` öğelerden) bu trait'i uygular. Hangi `B` olduğu çağrı yerindeki tip
  bilgisinden (anotasyon, turbofish ya da fonksiyonun dönüş tipi) çıkarılır ve derleyici o tipin
  `from_iter` uygulamasını çağırır. Tip bilgisi yoksa derleyici seçemez ve E0283 verir.
```

```flashcards
- front: "`let t = v.iter().sum();` neden derlenmez, nasıl düzeltilir?"
  back: "`sum`'ın dönüş tipi generic'tir; derleyici seçemez (E0283). `let t: i32 = ...` ya da `.sum::<i32>()`."
- front: Boş bir iterator için `sum` ve `product` ne döndürür?
  back: "`sum` → 0, `product` → 1 (toplama ve çarpmanın etkisiz elemanları)."
- front: "`fold`'un closure'ının parametre sırası nedir?"
  back: "Önce biriktirici, sonra eleman: `fold(0, |acc, x| acc + x)`."
- front: "`find` ile `position` farkı?"
  back: "`find` ilk uyan **elemanı** (`Option<&T>`), `position` ilk uyanın **indeksini** (`Option<usize>`) verir. İkisi de kısa devre yapar."
- front: "Boş iterator'da `all(...)` ne döndürür?"
  back: "`true` (boş doğruluk): koşulu sağlamayan hiçbir eleman yoktur."
- front: "`it.nth(1)` iki kez üst üste çağrılırsa (`[10,20,30,40,50]`) ne verir?"
  back: "`Some(20)` sonra `Some(40)`: `nth` önündeki elemanları tüketir ve kaldığı yerden sayar."
- front: "`[\"3\", \"x\", \"5\"].iter().map(|s| s.parse::<i32>()).collect::<Result<Vec<_>, _>>()` ne verir?"
  back: "`Err(...)`, `\"x\"`'in ayrıştırma hatası. `collect` ilk `Err`'de durur; `\"5\"` hiç işlenmez."
- front: "`collect::<Vec<_>>()` içindeki `_` ne demek?"
  back: "\"Eleman tipini sen çıkar\": koleksiyon tipini söylerim, içindekini derleyici bulur."
```
