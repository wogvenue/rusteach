---
id: m14-l04
title: Iterator adaptörleri
minutes: 22
type: lesson
objectives:
  - "`map`, `filter`, `enumerate`, `zip`, `chain`, `take`, `skip`, `take_while`, `skip_while`, `step_by`, `rev` adaptörlerinin ne ürettiğini tahmin edebilmek"
  - "`flat_map`, `filter_map`, `peekable`, `windows` ve `chunks` ile gerçekçi veri işleme problemlerini çözebilmek"
  - Adaptör zincirlerinin eleman eleman ve tembel çalıştığını bir çıktı tahminiyle gösterebilmek
  - "`filter`'daki `&&T` tuzağını ve `copied()` ile çözümünü açıklayabilmek"
keywords: [adaptör, map, filter, enumerate, zip, chain, take, skip, take_while, skip_while, step_by, rev, flat_map, filter_map, peekable, windows, chunks, copied, tembel]
---

Önceki derste bir iterator'ın "sıradakini ver" diyen bir ayraç olduğunu gördük. Bu derste ayraçları
**birbirine takacağız**. Bir **adaptör (adapter)**, bir iterator alıp ondan **yeni bir iterator** üreten
metottur: "her elemanı ikiyle çarp", "50'nin altındakileri at", "ilk üçünü al"... Adaptörleri zincirleyerek
kurduğun yapıya **boru hattı (pipeline)** denir ve Rust kodunun büyük kısmı böyle yazılır.

Bu derste sonuçları görebilmek için her zincirin sonuna **`collect()`** ekleyeceğiz. `collect`, iterator'ı
sonuna kadar çalıştırıp elemanları bir koleksiyona döken bir **tüketicidir**; ayrıntısını bir sonraki
derste göreceğiz. Şimdilik `let v: Vec<_> = ... .collect();` kalıbını "hepsini bir `Vec`'e topla" diye oku.

## map ve filter: dönüştür ve süz

```rust
fn main() {
    let fiyatlar = vec![120, 45, 300, 80, 15];

    // map: her elemanı closure'dan geçirip dönüştür
    let kdvli: Vec<u32> = fiyatlar.iter().map(|f| f * 120 / 100).collect();
    println!("KDV'li: {kdvli:?}");

    // filter: closure true döndüren elemanları geçir, diğerlerini at
    let pahalilar: Vec<&u32> = fiyatlar.iter().filter(|f| **f >= 100).collect();
    println!("100 TL ve üstü: {pahalilar:?}");

    // ikisi birlikte: önce süz, sonra dönüştür
    let etiketler: Vec<String> = fiyatlar
        .iter()
        .filter(|f| **f < 100)
        .map(|f| format!("{f} TL"))
        .collect();
    println!("{etiketler:?}");
}
```

- **`map(f)`**: her `x` için `f(x)` verir. Eleman sayısı değişmez, **tip** değişebilir (`u32` → `String`).
- **`filter(p)`**: `p(&x)` `true` ise `x`'i geçirir. Tip aynı kalır, eleman sayısı azalabilir.

Bir şey dikkatini çekti mi? `filter`'da `**f` yazdık, `map`'te tek `*` bile yazmadık. Bunun bir nedeni var ve
yeni başlayanların en sık takıldığı yer burası. Tahmin et, bu kod derlenir mi?

```compiles
code: |
  fn main() {
      let notlar = vec![45, 78, 92, 60, 33];
      let gecenler: Vec<i32> = notlar.iter().filter(|n| **n >= 50).collect();
      println!("{gecenler:?}");
  }
answer: false
error: E0277
explanation: |
  `filter` elemanları **geçirir ama değiştirmez**. `notlar.iter()` `&i32` verdiği için filtreden çıkanlar da
  `&i32`'dir ve `&i32`'lerden bir `Vec<i32>` kurulamaz. Ya hedefi `Vec<&i32>` yapmalı ya da zincire
  `.copied()` ekleyip referansları değerlere çevirmeliyiz.
```

Burada iki ayrı katman var:

1. `notlar.iter()` → öğeler **`&i32`**.
2. `filter`'ın closure'ı öğeyi **ödünç** alır (öğeyi tüketirse onu bir sonraki adıma geçiremezdi), yani
   parametresi **`&&i32`** olur. Tek `*` ile `&i32` kalır ve `&i32 >= 50` karşılaştırılamaz:

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:3:61
  |
3 |     let gecenler: Vec<i32> = notlar.iter().filter(|n| *n >= 50).collect();
  |                                                             ^^ expected `&_`, found integer
  |
help: consider dereferencing the borrow
  |
3 |     let gecenler: Vec<i32> = notlar.iter().filter(|n| **n >= 50).collect();
  |                                                       +
```
`expected &_, found integer` → "sol tarafta hâlâ bir referans var". Derleyici ikinci `*`'ı öneriyor.
:::

Üç yaygın çözüm, üçü de idiomatiktir:

```rust
fn main() {
    let notlar = vec![45, 78, 92, 60, 33];

    // 1) İki kez çöz
    let a: Vec<&i32> = notlar.iter().filter(|n| **n >= 50).collect();
    // 2) Desenle aç: |&&n| → n bir i32
    let b: Vec<&i32> = notlar.iter().filter(|&&n| n >= 50).collect();
    // 3) Önce copied() ile &i32 → i32 yap (Copy tipler için); sonra tek katman kalır
    let c: Vec<i32> = notlar.iter().copied().filter(|&n| n >= 50).collect();

    println!("{a:?} {b:?} {c:?}");
}
```

`copied()` (ve `Copy` olmayan tipler için `cloned()`) her `&T`'yi `T`'ye çeviren küçük bir adaptördür.
Sayılarla çalışırken zincirin başına `copied()` koymak hayatı çok kolaylaştırır.

## Tembel boru hattı: eleman eleman akış

Adaptörler tembeldir; peki bir zincir **çalıştığında** sıra nasıldır? Önce bütün elemanlar `map`'ten mi
geçer, sonra hepsi `filter`'a mı? Tahmin et:

```predict
code: |
  fn main() {
      let v = vec![1, 2, 3];
      let sonuc: Vec<i32> = v
          .iter()
          .map(|x| {
              println!("map {x}");
              x * 10
          })
          .filter(|x| {
              println!("filter {x}");
              *x > 15
          })
          .collect();
      println!("{sonuc:?}");
  }
options:
  - |
    map 1
    map 2
    map 3
    filter 10
    filter 20
    filter 30
    [20, 30]
  - |
    map 1
    filter 10
    map 2
    filter 20
    map 3
    filter 30
    [20, 30]
  - |
    [20, 30]
answer: 1
explanation: |
  Zincir **eleman eleman** çalışır. `collect` en dıştaki iterator'a (`filter`) "sıradakini ver" der;
  `filter` de `map`'e sorar, `map` de `iter()`'e. Tek bir eleman bütün zinciri baştan sona geçer, sonra
  sıradaki başlar. Ara sonuçlar için hiçbir geçici `Vec` oluşturulmaz.
```

:::analogy Montaj hattı
Bir fırının iki çalışma şekli düşün. **Toplu üretim**: önce 1000 hamurun hepsini yoğur ve bir masaya yığ,
sonra hepsini şekillendir ve başka bir masaya yığ, sonra hepsini pişir. Masa (bellek) dolar taşar.
**Montaj hattı**: her hamur yoğrulur, hemen şekillendirilir, hemen fırına girer; masada hiç yığın oluşmaz.
JavaScript'in `arr.map(...).filter(...)` zinciri toplu üretimdir: her adımda yeni bir dizi oluşturur.
Rust'ın iterator zinciri ise montaj hattıdır; ve en sondaki işçi (`collect`) "yeter" diyene kadar hat çalışmaz.
:::

Zincir bellekte nasıl görünür? Her adaptör, bir öncekini **içine alan** küçük bir struct'tır:

```memory
title: "let boru = v.iter().map(f).filter(p);"
steps:
  - caption: "Henüz hiçbir eleman işlenmedi. `boru`, iç içe geçmiş üç küçük struct: Filter, içinde Map, içinde Iter. Her biri bir öncekine sorar."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=3 · cap=3", to: h1 }
          - { name: boru, type: "Filter<Map<Iter<i32>, F>, P>", value: "{ Map { Iter { konum → [0] }, f }, p }", to: h1 }
    heap:
      - { id: h1, value: "[0]=1  [1]=2  [2]=3" }
```

Tipin adı uzun ama derleyici onu tamamen bilir; `f` ve `p` closure'ları da bu tipin parçasıdır. Bu yüzden
derleyici bütün zinciri tek bir döngüye **satır içi (inline)** açabilir — son derste bunun performansa
etkisini konuşacağız.

## Sıra, eşleşme ve kesme adaptörleri

### Numaralandır, eşleştir, ekle: `enumerate`, `zip`, `chain`

```rust
fn main() {
    let isimler = ["Ada", "Bora", "Cem"];
    let notlar = [88, 95, 71, 60];

    // enumerate: (indeks, eleman) çiftleri — indeks 0'dan başlar
    for (i, isim) in isimler.iter().enumerate() {
        println!("{}. {isim}", i + 1);
    }

    // zip: iki iterator'ı fermuar gibi birleştirir → (a, b) çiftleri
    for (isim, not) in isimler.iter().zip(notlar.iter()) {
        println!("{isim}: {not}");
    }

    // chain: önce birini, bitince diğerini ver
    let sabah = ["simit", "çay"];
    let aksam = ["mercimek çorbası"];
    let menu: Vec<&str> = sabah.iter().chain(aksam.iter()).copied().collect();
    println!("{menu:?}");
}
```

`zip`'te dikkat: `isimler` 3, `notlar` 4 eleman. Dördüncü not (60) ne oldu?

```quiz
question: "`a.iter().zip(b.iter())` — `a`'da 3, `b`'de 4 eleman varsa sonuç kaç çift üretir?"
options:
  - "3 — kısa olan bitince `zip` durur"
  - "4 — eksik eleman için `None` kullanılır"
  - Program panikler, uzunluklar eşit olmalı
  - Derlenmez, uzunluklar eşit olmalı
answer: 0
explanation: |
  `zip`, iki iterator'dan da bir eleman alabildiği sürece çift üretir; **biri `None` verdiği anda biter**.
  Fazla elemanlar sessizce atlanır. Bu çoğu zaman istediğin şeydir ama veri kaybını gizleyebilir: iki
  listenin aynı uzunlukta olması gerekiyorsa bunu ayrıca kontrol et (`assert_eq!(a.len(), b.len())`).
feedback:
  - Doğru!
  - "`zip` `Option` çiftleri üretmez; elemanlar `(&a, &b)` çiftleridir."
  - "`zip` panik atmaz; kısa olanda durur."
  - Uzunluk çalışma anında bilinir; derleyici bunu kontrol etmez.
```

### Kes, atla, ters çevir: `take`, `skip`, `take_while`, `skip_while`, `step_by`, `rev`

```rust
fn main() {
    // take(n): ilk n eleman — sonsuz iterator'larla harika çalışır
    let ilk_bes: Vec<u32> = (1..).take(5).collect();
    // skip(n): ilk n elemanı atla
    let basliksiz: Vec<&str> = ["ad;not", "Ada;88", "Cem;71"].iter().skip(1).copied().collect();
    // step_by(k): her k'ıncı elemanı al (ilk eleman dahil)
    let ucer: Vec<u32> = (1..).step_by(3).take(4).collect();
    // rev(): ters çevir (iki uçtan gezilebilen iterator'larda)
    let geri_sayim: Vec<u32> = (1..=5).rev().collect();

    println!("{ilk_bes:?}");
    println!("{basliksiz:?}");
    println!("{ucer:?}");
    println!("{geri_sayim:?}");
}
```

`take_while` ve `skip_while` ise sayıya değil bir **koşula** bakar. `filter`'a benziyorlar ama aralarında
çok önemli bir fark var. Tahmin et:

```predict
code: |
  fn main() {
      let sicakliklar = [12, 15, 21, 9, 25];
      let a: Vec<i32> = sicakliklar.iter().copied().filter(|&t| t < 20).collect();
      let b: Vec<i32> = sicakliklar.iter().copied().take_while(|&t| t < 20).collect();
      let c: Vec<i32> = sicakliklar.iter().copied().skip_while(|&t| t < 20).collect();
      println!("{a:?}");
      println!("{b:?}");
      println!("{c:?}");
  }
options:
  - |
    [12, 15, 9]
    [12, 15, 9]
    [21, 25]
  - |
    [12, 15, 9]
    [12, 15]
    [21, 9, 25]
  - |
    [12, 15, 9]
    [12, 15]
    [21, 25]
answer: 1
explanation: |
  `filter` her elemana bakar. `take_while` ise koşul **ilk kez** `false` olduğunda (21) **tamamen durur**;
  sonradan gelen 9 koşulu sağlasa bile alınmaz. `skip_while` tam tersi: koşul doğru olduğu sürece atlar,
  ilk `false`'tan (21) itibaren **her şeyi** verir — 9 dahil, çünkü artık koşula bakılmıyor.
```

`take_while` sıralı verilerde ya da sonsuz iterator'larda çok kullanışlıdır: *"karesi 100'ü geçmeyen doğal
sayılar"* `(1..).take_while(|n| n * n <= 100)` ile yazılır ve `filter` ile yazsaydın program **hiç
bitmezdi** — `filter` sonsuza kadar bir sonraki sayıya bakmaya devam ederdi.

:::warning `rev` her iterator'da çalışmaz
`rev()` iterator'ın **iki uçtan da** gezilebilmesini ister (`DoubleEndedIterator` trait'i). Aralıklar,
`Vec`/dilim iterator'ları, `chars()` iki uçludur. Ama `(1..).rev()` derlenmez: sonsuz bir dizinin sonu yoktur!
:::

## Düzleştir ve süzerek dönüştür: flat_map, filter_map

**`flat_map(f)`**: her eleman için `f` bir iterator (ya da bir koleksiyon) üretir; `flat_map` bunların
elemanlarını **tek bir akışa** düzleştirir. **`filter_map(f)`**: `f` bir `Option` döndürür; `Some(x)`'ler
`x` olarak geçer, `None`'lar atılır — `filter` ve `map` tek adımda.

```rust
fn main() {
    // flat_map: her cümle bir kelime iterator'ı üretir; hepsi tek listeye düzleşir
    let cumleler = ["merhaba dünya", "rust çok güzel"];
    let kelimeler: Vec<&str> = cumleler.iter().flat_map(|c| c.split_whitespace()).collect();
    println!("{kelimeler:?}");

    // map olsaydı: her eleman bir iterator olurdu, iç içe kalırdı
    let ic_ice: Vec<Vec<&str>> = cumleler
        .iter()
        .map(|c| c.split_whitespace().collect())
        .collect();
    println!("{ic_ice:?}");

    // filter_map: ayrıştırılabilenleri al, gerisini sessizce at
    let girdiler = ["42", "on iki", "7", "-3", ""];
    let sayilar: Vec<i32> = girdiler.iter().filter_map(|s| s.parse().ok()).collect();
    println!("{sayilar:?}");
}
```

`s.parse()` bir `Result` döndürür (Modül 10); **`.ok()`** onu `Option`'a çevirir: `Ok(x)` → `Some(x)`,
`Err(_)` → `None`. Böylece `filter_map` geçersiz girdileri atar. (Hataları atmak yerine raporlamak
istediğinde ne yapılacağını bir sonraki derste `collect::<Result<...>>` ile göreceğiz.)

```fill
prompt: |
  Bir sensör bazen bozuk satır gönderiyor. Geçerli ölçümleri `f64` olarak al ve **ters sırada** listele.
  Program `[23.25, 19.0, 21.5]` yazdırmalı.
code: |
  fn main() {
      let satirlar = ["21.5", "HATA", "19.0", "", "23.25"];
      let olcumler: Vec<f64> = satirlar
          .iter()
          .___0(|s| s.parse().___1())
          .___2()
          .collect();
      println!("{olcumler:?}");
  }
blanks:
  - ["filter_map"]
  - ["ok"]
  - ["rev"]
output: "[23.25, 19.0, 21.5]"
explanation: |
  `filter_map` closure'ın `Some` döndürdüklerini tutar; `parse()`'ın `Result`'ını `.ok()` ile `Option`'a
  çeviriyoruz. `parse`'ın hedef tipi (`f64`) en sondaki `Vec<f64>` anotasyonundan çıkarılıyor — tip bilgisi
  zincir boyunca geriye doğru akar. `rev()` `filter_map`'ten sonra da çalışır, çünkü dilim iterator'ı iki
  uçludur ve `FilterMap` bu özelliği korur.
```

## Göz at ve pencerele: peekable, windows, chunks

### `peekable`: sıradakine dokunmadan bak

Bazen bir elemanı **almadan önce** ne olduğuna bakmak istersin. `peekable()` iterator'a bir **`peek()`**
metodu ekler: sıradaki elemanı `Option<&Item>` olarak gösterir ama ilerlemez. Klasik örnek, bir ifadeyi
parçalara ayırmak — çok basamaklı sayıları bir arada tutmak için "sıradaki karakter de rakam mı?" diye
bakmamız gerekir:

```rust
fn main() {
    let ifade = "12+7*305";
    let mut it = ifade.chars().peekable();

    while let Some(c) = it.next() {
        if c.is_ascii_digit() {
            let mut sayi = c.to_digit(10).unwrap();
            // Sıradaki de rakam olduğu sürece onu da sayıya kat
            while let Some(&s) = it.peek() {
                if !s.is_ascii_digit() {
                    break;
                }
                sayi = sayi * 10 + s.to_digit(10).unwrap();
                it.next(); // baktığımızı artık gerçekten al
            }
            println!("sayı: {sayi}");
        } else {
            println!("işlem: {c}");
        }
    }
}
```

`peek()` olmadan, `+`'yı okuduğumuzda onu "tüketmiş" olurduk; geri koymanın yolu yok. `peek` "önce bak,
gerekirse al" demenin yoludur. (`to_digit(10)` bir rakam karakterini sayıya çevirir ve `Option` döndürür;
burada rakam olduğunu kontrol ettiğimiz için `unwrap` güvenli.)

### `windows` ve `chunks`: dilimlerde kaydırma ve bölme

Bu ikisi aslında `Iterator` metodu değil, **dilim (slice)** metotlarıdır ve dilim parçaları (`&[T]`)
üreten iterator'lar döndürür:

```rust
fn main() {
    let gunluk = [12, 15, 11, 18, 18];

    // windows(2): kayan pencere — [12,15], [15,11], [11,18], [18,18]
    for w in gunluk.windows(2) {
        let fark = w[1] - w[0];
        println!("{} → {}: değişim {fark}", w[0], w[1]);
    }

    // chunks(2): örtüşmeyen gruplar — sonuncusu eksik kalabilir
    let ogrenciler = ["Ada", "Bora", "Cem", "Defne", "Ece"];
    for (i, grup) in ogrenciler.chunks(2).enumerate() {
        println!("Grup {}: {grup:?}", i + 1);
    }
}
```

```quiz
question: "`[1, 2, 3, 4, 5]` dilimi için `windows(3)` ve `chunks(3)` kaç parça üretir?"
options:
  - "`windows(3)` → 3 parça, `chunks(3)` → 2 parça"
  - "`windows(3)` → 2 parça, `chunks(3)` → 3 parça"
  - "İkisi de 2 parça"
  - "`windows(3)` → 5 parça, `chunks(3)` → 1 parça"
answer: 0
explanation: |
  `windows(3)` her konumdan başlayan, **örtüşen** 3'lük pencereler verir: `[1,2,3]`, `[2,3,4]`, `[3,4,5]`
  → `n - k + 1 = 3`. `chunks(3)` **örtüşmeyen** gruplar verir: `[1,2,3]`, `[4,5]` → 2 (sonuncusu kısa).
  Eksik son grubu istemiyorsan `chunks_exact(3)` kullan.
feedback:
  - Doğru!
  - Tam tersi — pencereler örtüştüğü için daha fazladır.
  - Pencereler örtüşür, gruplar örtüşmez; sayıları farklı olur.
  - Pencere boyutu 3 olduğu için tek elemanlık pencere olmaz.
```

## Alıştırma: sınıf listesi ve sıkıştırma

Önce adaptörleri zincirlemeye ısın, ardından `peekable` ile bir klasik: **run-length encoding**.

```exercise
id: m14-e-gecenler-listesi
title: Geçenlerin listesi
difficulty: 2
prompt: |
  `isimler` ve `notlar` aynı sıradaki öğrencilere ait iki dilim. `gecenler(isimler, notlar, esik)`
  notu `esik`'e **eşit ya da büyük** olan öğrencileri `"İsim (not)"` biçiminde bir `Vec<String>` olarak
  döndürsün. Uzunluklar farklıysa yalnızca eşleşebilen çiftleri dikkate al.

  Bu alıştırmayı **`for` döngüsü kullanmadan**, bir adaptör zinciriyle çöz (`zip`, `filter`, `map`, `collect`).
starter: |
  fn gecenler(isimler: &[&str], notlar: &[u32], esik: u32) -> Vec<String> {
      todo!()
  }

  fn main() {
      let isimler = ["Ada", "Bora", "Cem"];
      let notlar = [88, 45, 71];
      println!("{:?}", gecenler(&isimler, &notlar, 50));
  }
solution: |
  fn gecenler(isimler: &[&str], notlar: &[u32], esik: u32) -> Vec<String> {
      isimler
          .iter()
          .zip(notlar.iter())
          .filter(|(_, not)| **not >= esik)
          .map(|(isim, not)| format!("{isim} ({not})"))
          .collect()
  }

  fn main() {
      let isimler = ["Ada", "Bora", "Cem"];
      let notlar = [88, 45, 71];
      println!("{:?}", gecenler(&isimler, &notlar, 50));
  }
check: tests
tests: |
  #[test]
  fn esigi_gecenler() {
      let sonuc = gecenler(&["Ada", "Bora", "Cem"], &[88, 45, 71], 50);
      assert_eq!(sonuc, vec!["Ada (88)", "Cem (71)"], "Bora (45) elenmeli, sıra korunmalı");
  }

  #[test]
  fn esige_esit_gecer() {
      let sonuc = gecenler(&["Ece"], &[50], 50);
      assert_eq!(sonuc, vec!["Ece (50)"], "eşik dahil: 50 alan geçer");
  }

  #[test]
  fn kimse_gecemezse_bos() {
      assert!(gecenler(&["Ada", "Bora"], &[10, 20], 50).is_empty(), "kimse geçmezse boş liste dönmeli");
  }

  #[test]
  fn uzunluklar_farkli() {
      let sonuc = gecenler(&["Ada", "Bora", "Cem"], &[90, 95], 50);
      assert_eq!(sonuc, vec!["Ada (90)", "Bora (95)"], "notu olmayan Cem listede olmamalı");
  }
hints:
  - "`isimler.iter().zip(notlar.iter())` sana `(&&str, &u32)` çiftleri verir."
  - "`filter`'ın closure'ı çifti ödünç alır; desenle açabilirsin: `.filter(|(_, not)| **not >= esik)`."
  - "Son adım: `.map(|(isim, not)| format!(\"{isim} ({not})\")).collect()` — dönüş tipi `Vec<String>` olduğu için `collect` neyi kuracağını bilir."
forbid:
  - pattern: "\\bfor\\b"
    message: "Bu alıştırmayı `for` döngüsü olmadan, adaptör zinciriyle çöz."
require:
  - pattern: "\\.zip\\("
    message: "İki dilimi `zip` ile eşleştir."
explanation: |
  Zincir, problemin tarifini neredeyse kelimesi kelimesine okuyor: *isimleri notlarla eşleştir, eşiği
  geçenleri süz, her birini biçimlendir, topla.* Döngülü bir sürümde aynı niyet bir `Vec::new()`, bir `for`,
  bir `if` ve bir `push`'a dağılırdı.

  `filter`'daki `|(_, not)|` deseni ilginç: closure `&(&&str, &u32)` alıyor. Modül 7'de gördüğün
  **varsayılan bağlama kipleri (match ergonomics)** sayesinde bir referansı tuple deseniyle açtığında
  içerdekiler de referans olarak bağlanır; `not` burada `&&u32` olur, bu yüzden `**not`. (Desenlerin geri
  kalan ayrıntılarını Modül 21'de derinlemesine göreceğiz.) `map` ise çifti **değerle** aldığı için `isim: &&str`, `not: &u32`;
  `format!` referansları sorunsuz yazdırır.

  `zip` kısa olanda durduğu için farklı uzunluklar ek kod gerektirmedi.
```

```exercise
id: m14-e-sikistir
title: Run-length sıkıştırma
difficulty: 4
prompt: |
  Ardışık tekrar eden karakterleri sıkıştıran `sikistir(metin: &str) -> String` fonksiyonunu yaz:
  her grup `karakter + tekrar sayısı` olarak yazılır, ama tekrar sayısı **1 ise sayı yazılmaz**.

  | girdi | çıktı |
  |---|---|
  | `"aaabcc"` | `"a3bc2"` |
  | `"şşşük"` | `"ş3ük"` |
  | `""` | `""` |

  `chars().peekable()` kullan: bir karakteri aldıktan sonra, sıradaki **aynı karakter olduğu sürece**
  `peek()` ile bakıp `next()` ile tüket. Türkçe karakterlerin de doğru çalışması gerektiğini unutma
  (bayt değil karakter say).
starter: |
  fn sikistir(metin: &str) -> String {
      todo!()
  }

  fn main() {
      println!("{}", sikistir("aaabcc"));
  }
solution: |
  fn sikistir(metin: &str) -> String {
      let mut sonuc = String::new();
      let mut it = metin.chars().peekable();
      while let Some(c) = it.next() {
          let mut adet = 1;
          while it.peek() == Some(&c) {
              it.next();
              adet += 1;
          }
          sonuc.push(c);
          if adet > 1 {
              sonuc.push_str(&adet.to_string());
          }
      }
      sonuc
  }

  fn main() {
      println!("{}", sikistir("aaabcc"));
  }
check: tests
tests: |
  #[test]
  fn temel_ornek() {
      assert_eq!(sikistir("aaabcc"), "a3bc2", "aaa → a3, b → b, cc → c2");
  }

  #[test]
  fn turkce_karakterler() {
      assert_eq!(sikistir("şşşük"), "ş3ük", "karakterler bayt değil char olarak sayılmalı");
  }

  #[test]
  fn tekrarsiz_metin_degismez() {
      assert_eq!(sikistir("rust"), "rust", "hiç tekrar yoksa metin aynı kalmalı");
  }

  #[test]
  fn ayri_gruplar_ayri_sayilir() {
      assert_eq!(sikistir("aabaa"), "a2ba2", "aynı karakterin ayrı grupları ayrı sayılmalı");
      assert_eq!(sikistir("zzzzzzzzzzzz"), "z12", "iki basamaklı sayılar da yazılmalı");
  }

  #[test]
  fn bos_metin() {
      assert_eq!(sikistir(""), "", "boş girdi boş çıktı");
  }
hints:
  - "İskelet: `let mut it = metin.chars().peekable(); while let Some(c) = it.next() { ... }`."
  - "İç döngü: `while it.peek() == Some(&c) { it.next(); adet += 1; }` — `peek()` `Option<&char>` verdiği için `Some(&c)` ile karşılaştırılır."
  - "Grubu bitirince `sonuc.push(c);` ve `adet > 1` ise `sonuc.push_str(&adet.to_string());`."
require:
  - pattern: "peekable\\(\\)"
    message: "Bu alıştırmada `peekable()` kullan."
explanation: |
  Algoritma "her grubu bir kez gör" ilkesine dayanır: dış `while let` bir grubun **ilk** karakterini alır,
  iç döngü `peek` ile aynı karakterden devam edildiği sürece tüketir. Her karakter tam bir kez `next()` ile
  alındığı için çözüm doğrusal zamanda çalışır.

  `peek()`'in dönüş tipi `Option<&char>`'dır — iterator elemanı henüz vermediği için sana sadece bakma izni
  verir. Bu yüzden `Some(&c)` ile karşılaştırıyoruz. Alternatif olarak `it.next_if_eq(&c)` metodu
  "eşitse al" işini tek adımda yapar: `while it.next_if_eq(&c).is_some() { adet += 1; }`.

  `chars()` Unicode karakterleri (Modül 9'daki *char*) gezdiği için `ş` tek bir eleman olarak sayılır;
  `bytes()` ile yazsaydın `ş`'nin iki baytı ayrı gruplar gibi görünürdü.
```

## Özet

:::remember
- **Adaptör** = iterator alıp iterator döndüren metot. Tembeldir; bir tüketici (`collect`, `for`, `sum`...) çalıştırır.
- Zincirler **eleman eleman** akar; ara koleksiyon oluşturulmaz.
- `map` dönüştürür, `filter` süzer; `filter`'ın closure'ı `&Item` alır → `iter()` üzerinde `&&T` olur.
- `copied()` / `cloned()`: `&T` → `T`. Sayılarla çalışırken zincirin başında çok işe yarar.
- `enumerate` → `(indeks, eleman)` · `zip` → çiftler, **kısa olanda durur** · `chain` → arka arkaya ekler.
- `take`/`skip` sayıya, `take_while`/`skip_while` koşula bakar ve koşul ilk bozulduğunda karar verir.
- `step_by(k)`, `rev()` (iki uçlu iterator ister) · `flat_map` düzleştirir · `filter_map` `Option`'la süzüp dönüştürür.
- `peekable()` + `peek()` almadan bakar · `windows(k)` örtüşen, `chunks(k)` örtüşmeyen dilim parçaları (dilim metotları).
:::

```reflect
prompt: |
  `filter` ile `take_while` arasındaki farkı sonsuz bir iterator (`1..`) örneğiyle açıkla. Hangisini kullanmak
  programın bitip bitmemesini belirler ve neden?
answer: |
  `filter` her elemana tek tek bakar ve koşulu sağlamayanları atlayıp aramaya devam eder; asla "artık
  bitti" demez. `take_while` ise koşul ilk kez `false` olduğunda tamamen durur. `(1..).filter(|n| n * n <= 100)`
  10'dan sonra hiçbir sayı koşulu sağlamasa da sonsuza kadar bir sonraki sayıyı denemeye devam eder ve
  `collect` hiç bitmez. `(1..).take_while(|n| n * n <= 100)` ise 11'e geldiğinde durur ve `[1, ..., 10]`
  verir. Sıralı verilerde "bir noktadan sonra hiçbiri uymaz" biliniyorsa doğru araç `take_while`'dır.
```

```flashcards
- front: Bir iterator adaptörü nedir? Bir örnek ver.
  back: "Bir iterator alıp yeni bir iterator döndüren (tembel) metot, ör. `map`, `filter`, `zip`."
- front: "`v.iter().map(f).filter(p)` zincirinde elemanlar hangi sırayla işlenir?"
  back: "Eleman eleman: 1. eleman `map` → `filter`, sonra 2. eleman `map` → `filter`... Ara koleksiyon oluşmaz."
- front: "`v.iter().filter(|x| ...)` içinde `x`'in tipi nedir (`v: Vec<i32>`)?"
  back: "`&&i32`. `iter()` `&i32` verir, `filter` öğeyi bir kez daha ödünç alır. Çözümler: `**x`, `|&&x|`, ya da önce `.copied()`."
- front: "`zip` iki farklı uzunluktaki iterator'da ne yapar?"
  back: Kısa olan bittiğinde durur; uzun olanın fazla elemanları atlanır.
- front: "`[12, 15, 21, 9].iter().take_while(|&&t| t < 20)` ne verir?"
  back: "`12, 15` — koşul ilk kez bozulduğunda (21) durur; 9'a hiç bakılmaz."
- front: "`filter_map(|s| s.parse().ok())` ne işe yarar?"
  back: "Ayrıştırılabilen girdileri değer olarak geçirir, hatalıları (`None`) atar: `filter` + `map` tek adımda."
- front: "`windows(2)` ile `chunks(2)` farkı?"
  back: "`windows` örtüşen kayan pencereler (`[a,b]`, `[b,c]`...), `chunks` örtüşmeyen gruplar (`[a,b]`, `[c,d]`...) verir. İkisi de dilim metodudur."
- front: "`peekable()` iterator'a ne kazandırır?"
  back: "`peek()`: sıradaki elemanı tüketmeden `Option<&Item>` olarak gösterir."
```
