---
id: m09-l05
title: Sıralama, arama ve filtreleme
minutes: 28
type: lesson
objectives:
  - "`sort`, `sort_unstable`, `sort_by` ve `sort_by_key` arasından duruma uygun olanı seçip kararlı ve kararsız sıralamanın farkını açıklayabilmek"
  - "`Ordering`, `cmp` ve `then` ile çok kriterli karşılaştırma kuralları yazabilmek"
  - "`contains`, `binary_search`, `retain`, `dedup`, `max` ve `min` ile veride arama ve filtreleme yapabilmek"
  - "`f64`'ün neden `Ord` olmadığını açıklayıp ondalık sayıları `total_cmp` ile güvenle sıralayabilmek"
keywords: [sort, sort_unstable, sort_by, sort_by_key, Ordering, cmp, closure, binary_search, retain, dedup, total_cmp, NaN]
---

Bir alışveriş sitesine girdiğinde ilk yaptığın şeyleri düşün: **"fiyata göre sırala"**, **"bu ürün
var mı?"** diye **ara**, **"stokta olmayanları gizle"** diye **filtrele**. Bir okulun not sistemi, bir
spor ligi tablosu, bir hava istasyonunun ölçüm kayıtları... Hepsi bu üç işlemin etrafında döner.

Önceki derslerde veriyi **saklamayı** öğrendin. Bu derste onu **düzenlemeyi** öğreneceksin. Bu
metotların neredeyse hepsi aslında **dilimlerin (`[T]`)** metotlarıdır. Modül 5'ten hatırla: bir
`Vec<T>`, gerektiğinde kendiliğinden `&[T]` ya da `&mut [T]` gibi davranır. Bu yüzden bu derste
öğreneceğin her şey dizilerde, vektörlerde ve dilimlerde aynen çalışır.

:::ferris
Bu ders modülün son taşı. Sıralamayı Rust'ın gözünden görünce, başka dillerdeki birçok sinsi hatanın
neden burada hiç yaşanmadığını da anlayacaksın. Hadi başlayalım! 🦀
:::

## `sort` — yerinde sıralama

Önce tahmin et. Bir manav listesini alfabetik sıraya koymak istiyoruz:

```predict
code: |
  fn main() {
      let mut meyveler = vec!["şeker", "zeytin", "çay", "armut", "ıhlamur", "Elma"];
      meyveler.sort();
      println!("{meyveler:?}");
  }
options:
  - '["armut", "çay", "Elma", "ıhlamur", "şeker", "zeytin"]'
  - '["Elma", "armut", "zeytin", "çay", "ıhlamur", "şeker"]'
  - '["armut", "Elma", "zeytin", "çay", "ıhlamur", "şeker"]'
answer: 1
explanation: |
  `sort` metinleri **Türk alfabesine göre değil**, **bayt bayt** karşılaştırır. Ders 2'den hatırla:
  `&str` bir UTF-8 bayt dizisidir. Bu karşılaştırma da Unicode kod noktası sırasıyla aynıdır.
  Büyük `'E'` (69), küçük `'a'`'dan (97) önce gelir. `ç` (U+00E7), `ı` (U+0131) ve `ş` (U+015F) ise
  ASCII'nin dışında kalır, bu yüzden `z`'den (U+007A) bile sonra gelirler. Sonuç bilgisayara mantıklı,
  bir Türk okura ise tuhaf görünür.
```

Sürpriz, karakterlerin sırasından geliyor. Ama asıl önemli olan `sort`'un **nasıl** çalıştığı:

- `v.sort()` vektörü **yerinde (in place)** sıralar. Yeni bir vektör oluşturmaz, var olanı yeniden
  düzenler. İmzası `fn sort(&mut self)` şeklindedir, yani `v`'yi **değiştirilebilir ödünç** alır ve
  `()` döndürür.
- Sıralama, tipin **doğal sırasına** göre yapılır. Sayılar büyüklüklerine, metinler baytlarına,
  `char`'lar kod noktalarına göre dizilir. `false < true` sayılır. Tuple'lar soldan sağa karşılaştırılır
  (Ders 4). `Option`'da ise `None`, her `Some`'dan küçüktür.
- Maliyeti en kötü durumda bile O(n log n)'dir.

```memory
title: v.sort() yerinde sıralar
steps:
  - caption: "Sıralamadan önce: `v` stack'te (işaretçi, uzunluk, kapasite), sayılar heap'te."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=5 · cap=5", to: h1, mut: true }
    heap:
      - { id: h1, value: "42 7 19 3 25" }
  - caption: "`v.sort()` sonrası: **aynı** heap bloğu, aynı işaretçi. Yalnızca elemanların yerleri değişti. Yeni bir `Vec` oluşmadı."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=5 · cap=5", to: h1, mut: true }
    heap:
      - { id: h1, value: "3 7 19 25 42" }
```

```rust
fn main() {
    let mut notlar = vec![72, 45, 90, 61, 88];
    notlar.sort();
    println!("artan:  {notlar:?}");

    notlar.reverse(); // sıralamaz! sadece mevcut sırayı ters çevirir
    println!("azalan: {notlar:?}");

    // Tuple'lar soldan sağa karşılaştırılır: önce sınıf, sonra numara
    let mut ogrenciler = vec![(10, 512), (9, 233), (10, 101), (9, 870)];
    ogrenciler.sort();
    println!("{ogrenciler:?}");

    // sort bir dilim metodu: dizilerde ve bir dilimin PARÇASINDA da çalışır
    let mut dizi = [9, 8, 7, 6, 5, 4];
    dizi[1..5].sort(); // yalnızca ortadaki dört eleman sıralanır
    println!("{dizi:?}");
}
```

Başka dillerle karşılaştır. Python'da `liste.sort()` yerinde sıralar ve `None` döndürür; `sorted(liste)`
ise yeni bir liste üretir. JavaScript'te `[10, 9, 1].sort()` sonucu `[1, 10, 9]` olur, çünkü
JavaScript varsayılan olarak her şeyi **metne çevirip** karşılaştırır. Rust'ta böyle bir sürpriz yoktur:
`Vec<i32>` sayı olarak, `Vec<&str>` metin olarak sıralanır. Neye göre sıralanacağına tip karar verir.

:::warning Üç klasik tuzak
1. **`let mut` unutmak.** `sort` değiştirilebilir ödünç ister. `let puanlar = vec![..]; puanlar.sort();`
   yazarsan derleyici `E0596: cannot borrow puanlar as mutable, as it is not declared as mutable`
   der ve `let mut` eklemeyi önerir.
2. **Sonucu bir değişkene atamak.** `let sirali = v.sort();` derlenir, ama `sirali`'nin tipi `()`'dir!
   Sıralanan şey `v`'nin kendisidir.
3. **Orijinali kaybetmek.** Hem sırasız hem sıralı hâl lazımsa, önce bilinçli bir kopya al:
   `let mut sirali = v.clone(); sirali.sort();` (Modül 4: `clone` bilinçli bir maliyettir).
:::

:::info Türkçe alfabetik sıralama
Gerçek Türkçe sıralama (`ç` harfi `c`'den hemen sonra, `İ`/`ı` ayrımı, büyük/küçük harf eşitliği) bir
**dil kuralları (collation)** meselesidir. Bayt sırasıyla çözülmez. Üretim kodunda bunun için
`icu_collator` gibi crate'ler kullanılır. Basit durumlarda biraz sonra göreceğin `sort_by_key` ile kendi
anahtarını üretebilirsin.
:::

## `Ordering` ve `sort_by` — kuralı sen koy

Sıralama algoritması her adımda tek bir soru sorar: "Bu ikisinden hangisi önce gelmeli?" Rust'ta bu
sorunun cevabı bir enum'dur. Bu enum'u Modül 3'teki tahmin oyunundan ve Modül 7'den tanıyorsun.

```quiz
question: |
  `cmp` metodu iki değeri karşılaştırır: `a.cmp(&b)`.
  `"elma".cmp("armut")` ifadesi ne döndürür?
options:
  - "`Ordering::Less`"
  - "`Ordering::Greater`"
  - "`1` (C'deki `strcmp` gibi pozitif bir sayı)"
  - "`true`"
answer: 1
explanation: |
  `cmp`, `std::cmp::Ordering` enum'unu döndürür. Bu enum'un üç varyantı vardır: `Less`, `Equal`,
  `Greater`. Soru "**sol taraf** sağa göre nerede?" sorusudur. `"elma"`, `'e'` > `'a'` olduğu için
  `"armut"`tan sonra gelir, yani `Greater`. Modül 3'teki tahmin oyununda `tahmin.cmp(&gizli)` ile
  aynı enum'u `match` etmiştik.
feedback:
  - "Yön ters: `Less`, **soldaki** değerin önce geldiğini söyler. `'e'` harfi `'a'`'dan sonra gelir."
  - "Doğru!"
  - "C, Java ve JavaScript böyle bir tamsayı döndürür. Rust ise hiçbir zaman yanlış okunamayacak bir enum döndürür."
  - "`<` gibi operatörler `bool` döndürür; `cmp` ise üç olasılığı da ayırt eder."
```

C'nin `qsort`'u, Java'nın `compareTo`'su ve JavaScript'in `sort` fonksiyonu karşılaştırma sonucunu bir
**tamsayıyla** ifade eder: negatifse önce, sıfırsa eşit, pozitifse sonra. Bu yöntem yıllardır sinsi
hatalar doğurur. Örneğin `return a - b;` yazmak, büyük sayılarda taşma (overflow) yüzünden **yanlış
işaret** üretebilir. Rust'ın `Ordering`'i ise yanlış okunamaz. `match` ile kullandığında üç durumu da
ele almak zorundasın.

Kendi sıralama kuralını vermek için **`sort_by`** kullanılır. Bu metot, iki elemanı alıp bir
`Ordering` döndüren küçük bir fonksiyon ister. Bu fonksiyonu yerinde, isimsiz olarak yazarız:

```rust
fn main() {
    let mut fiyatlar = vec![120, 35, 990, 35, 410];

    // |a, b| b.cmp(a)  →  "a ile b'yi karşılaştırırken b'nin cmp'ine bak": azalan sıra
    fiyatlar.sort_by(|a, b| b.cmp(a));
    println!("pahalıdan ucuza: {fiyatlar:?}");

    // Aynı kural, isimli bir fonksiyon olarak da yazılabilirdi:
    // fn azalan(a: &i32, b: &i32) -> std::cmp::Ordering { b.cmp(a) }
    // fiyatlar.sort_by(azalan);
}
```

`|a, b| b.cmp(a)` bir **closure**'dır, yani yazıldığı yerde tanımlanan **isimsiz bir fonksiyon**.
Parametreler iki dikey çizgi `| |` arasına yazılır, ardından gövde gelir. Parametre ve dönüş tiplerini
derleyici çıkarır: `sort_by`, `a` ve `b`'nin `&i32` olduğunu ve sonucun bir `Ordering` olacağını zaten
bilir. Bu derste closure'ları yalnızca bu tür kısa kurallar için kullanacağız. Ortamdaki değişkenleri
yakalamaları, `Fn` trait'leri gibi asıl güçlerini **Modül 14**'te göreceksin.

:::analogy Hakeme verilen kural kartı
Sıralama algoritmasını bir yarışma hakemi gibi düşün. Hakem kimin kimle karşılaştırılacağına ve kaç
tur yapılacağına kendisi karar verir. Bilmediği tek şey, iki yarışmacıdan **hangisinin önde**
sayılacağıdır. Closure, hakemin cebine koyduğun **kural kartıdır**: "İkisini sana verdiğimde bana
`Less`, `Equal` ya da `Greater` de." Hakem bu kartı ihtiyaç duydukça, belki yüzlerce kez okur.
:::

### Birden fazla kriter: `then`

Gerçek hayatta tek kriter nadiren yeter. Bir sınıf listesinde önce puana göre **azalan**, eşit puanda
ise ada göre **artan** sıralama isteyelim. `Ordering`'in yardımcı metotları tam bunun için var:

| Metot | Ne yapar? |
|---|---|
| `o.reverse()` | `Less` ↔ `Greater` yer değiştirir (`Equal` aynı kalır) |
| `o.then(diger)` | `o` `Equal` ise `diger`'i, değilse `o`'yu döndürür |
| `o.then_with(\|\| ...)` | `then` gibi, ama ikinci karşılaştırmayı **yalnızca gerekirse** hesaplar |

```rust
struct Ogrenci {
    ad: String,
    puan: u32,
}

fn main() {
    let mut sinif = vec![
        Ogrenci { ad: String::from("Mert"), puan: 78 },
        Ogrenci { ad: String::from("Ayla"), puan: 92 },
        Ogrenci { ad: String::from("Deniz"), puan: 78 },
        Ogrenci { ad: String::from("Burak"), puan: 92 },
    ];

    sinif.sort_by(|a, b| {
        b.puan.cmp(&a.puan) // 1. kriter: puan, AZALAN (b ile a yer değiştirdi)
            .then(a.ad.cmp(&b.ad)) // 2. kriter: eşitse ad, ARTAN
    });

    for o in &sinif {
        println!("{:<6} {}", o.ad, o.puan);
    }
}
```

`cmp` her zaman bir **referans** alır (`a.puan.cmp(&b.puan)`). Bunun sebebi, büyük bir değeri, örneğin
bir `String`'i, karşılaştırmak için taşımak ya da kopyalamak istemememizdir. Modül 5'teki ödünç
alma mantığının aynısı. Şimdi sıra sende:

```parsons
prompt: |
  Lig tablosunu **puana göre azalan**, eşit puanda **takım adına göre artan** sırada yazdıran programı
  kur. Dikkat: iki satır çeldirici.
lines: |
  fn main() {
      let mut tablo = vec![("Kartallar", 61), ("Aslanlar", 70), ("Martılar", 61)];
      tablo.sort_by(|a, b| {
          b.1.cmp(&a.1)
              .then(a.0.cmp(b.0))
      });
      println!("{tablo:?}");
  }
distractors: |
          a.1.cmp(&b.1)
              .then(b.0.cmp(a.0))
explanation: |
  Azalan sıra için ilk karşılaştırmada `b` solda olmalı: `b.1.cmp(&a.1)`. Eşitlik durumunda adlar
  **artan** sırada istendiği için ikinci karşılaştırmada `a` solda kalır: `a.0.cmp(b.0)`. (Takım adı
  zaten bir `&str` olduğu için başına bir `&` daha eklemeye gerek yok.) Sonuç:
  `[("Aslanlar", 70), ("Kartallar", 61), ("Martılar", 61)]`. Çeldiriciler yönleri tersine çevirir.
  `a.1.cmp(&b.1)` en düşük puanlıyı başa koyardı.
```

## `sort_by_key`, kararlılık ve `sort_unstable`

Çoğu zaman "karşılaştırma kuralı" aslında "şu alana göre sırala" demektir. Bunun için daha kısa bir yol
var: **`sort_by_key`**. Bu metodun closure'ı tek bir elemana bakar ve bir **anahtar (key)** döndürür.
Elemanlar bu anahtarlara göre sıralanır. Önce tahmin et. Puanı eşit olan adaylara ne olacak?

```predict
code: |
  fn main() {
      let mut adaylar = vec![("Zeynep", 85), ("Ali", 90), ("Can", 85), ("Ece", 90), ("Bora", 70)];
      adaylar.sort_by_key(|aday| aday.1);
      for (ad, _) in &adaylar {
          print!("{ad} ");
      }
      println!();
  }
options:
  - "Bora Zeynep Can Ali Ece"
  - "Bora Can Zeynep Ali Ece"
  - "Ece Ali Can Zeynep Bora"
  - "Bora Zeynep Can Ece Ali"
answer: 0
explanation: |
  Anahtar puandır (`aday.1`), sıralama artandır: 70, 85, 85, 90, 90. Peki eşit puanlılar neden
  "Zeynep Can" ve "Ali Ece" sırasında? Çünkü `sort` ailesi **kararlıdır (stable)**: eşit anahtarlı
  elemanların **orijinal sırası korunur**. Listede Zeynep, Can'dan; Ali de Ece'den önceydi. Ad
  alfabetik sıraya hiç bakılmadı.
```

**Kararlı sıralama (stable sort)**, eşit sayılan elemanların aralarındaki sırayı bozmaz. Bunun pratik
bir faydası var. Bir tabloyu önce **ada**, sonra **puana** göre kararlı biçimde sıralarsan, aynı
puanlılar alfabetik kalır. Kullanıcı arayüzlerinde "önce şuna, sonra buna göre sırala" tıklamaları
tam olarak böyle çalışır.

Kararsız (unstable) kardeşleri de vardır: **`sort_unstable`**, **`sort_unstable_by`** ve
**`sort_unstable_by_key`**. Bunlar eşit elemanların sırasını garanti etmez. Karşılığında genellikle
**daha hızlıdırlar** ve **ek bellek ayırmazlar**. Kararlı `sort` ise geçici bir tampon tahsis edebilir.

| | Kararlı | Kararsız |
|---|---|---|
| Doğal sıra | `sort()` | `sort_unstable()` |
| Kendi kuralın | `sort_by(\|a, b\| ...)` | `sort_unstable_by(\|a, b\| ...)` |
| Anahtara göre | `sort_by_key(\|x\| ...)` | `sort_unstable_by_key(\|x\| ...)` |

Seçim kuralı basit: **eşit elemanlar birbirinden ayırt edilemiyorsa** kararlılık hiçbir şey kazandırmaz.
Örneğin `Vec<i32>`'deki iki `85` arasında hiçbir fark yoktur, bu yüzden `sort_unstable` güvenle
kullanılabilir. Eşit anahtarlı elemanlar başka alanlarda farklıysa (yukarıdaki adlar gibi) ve sıraları
önemliyse kararlı olanı seç. Başka dillerde de durum benzer. C++'ın `std::sort`'u kararsızdır, kararlı
olanı `std::stable_sort`'tur. Python'ın `sort`'u ve Java'nın nesne sıralaması ise kararlıdır.

Azalan sıra için anahtarı Ders 4'teki **`Reverse`** ile sarmalayabilirsin. `Reverse(x)`
karşılaştırmayı ters çevirir. Bunu kendin dene:

```fill
prompt: Ürünleri **stok adedine göre azalan** sırala. Stoku eşit olanlar listedeki sıralarını korusun.
code: |
  use std::cmp::Reverse;

  fn main() {
      let mut urunler = vec![("çay", 40), ("simit", 120), ("ayran", 40), ("su", 300)];
      urunler.___0(|u| ___1);
      println!("{urunler:?}");
  }
blanks:
  - ["sort_by_key"]
  - ["Reverse(u.1)"]
explanation: |
  `sort_by_key(|u| Reverse(u.1))` stok adedini anahtar yapar ama sırayı tersine çevirir. Sonuç:
  `[("su", 300), ("simit", 120), ("çay", 40), ("ayran", 40)]`. Çay ve ayranın sırası korundu, çünkü
  `sort_by_key` kararlıdır. `sort_unstable_by_key` bu ikisinin yerini değiştirebilirdi. Aynı sonucu
  `sort_by(|a, b| b.1.cmp(&a.1))` ile de alabilirdin.
```

### Tuzak: anahtar, elemanın içini ödünç alan bir referans olamaz

Kitapları ada göre sıralamak için akla ilk gelen şey `raf.sort_by_key(|k| &k.ad)` yazmaktır. Ama:

:::error
```text
error: lifetime may not live long enough
  --> src/main.rs:11:25
   |
11 |     raf.sort_by_key(|k| &k.ad);
   |                      -- ^^^^^ returning this value requires that `'1` must outlive `'2`
   |                      ||
   |                      |return type of closure is &'2 String
   |                      has type `&'1 Kitap`
```
Closure, elemana **geçici** bir referans alır (`&'1 Kitap`). Sıralama sırasında elemanlar sürekli yer
değiştirdiği için, onların **içini gösteren** bir referansı anahtar olarak döndürmesine izin verilmez.
`'1` ve `'2` birer **yaşam süresi (lifetime)** etiketidir; bunları Modül 12'de okumayı öğreneceksin.
Şimdilik kural şu: `sort_by_key`'in anahtarı, closure'a verilen elemanı **ödünç almayan** bağımsız bir
değer olmalı. Sayılar ve `Copy` tipler bu yüzden sorunsuz çalışır. Elemanın içinde zaten bir `&str`
saklanıyorsa (ör. `("Ali", 90)` tuple'ı) `|k| k.0` da çalışır: dönen `&str` elemana değil, metnin asıl
sahibine (burada programın içindeki sabite) işaret eder.
:::

Üç çözüm var ve aralarındaki fark performans:

```rust
struct Kitap {
    ad: String,
    sayfa: u32,
}

fn main() {
    let mut raf = vec![
        Kitap { ad: String::from("Sefiller"), sayfa: 1500 },
        Kitap { ad: String::from("Kürk Mantolu Madonna"), sayfa: 160 },
        Kitap { ad: String::from("Saatleri Ayarlama Enstitüsü"), sayfa: 400 },
    ];

    // 1) En iyisi: sort_by ile alanları referansla karşılaştır. Hiç kopya yok.
    raf.sort_by(|a, b| a.ad.cmp(&b.ad));

    // 2) Çalışır ama pahalı: HER karşılaştırmada iki String kopyalanır.
    raf.sort_by_key(|k| k.ad.clone());

    // 3) Anahtar pahalıysa: her eleman için anahtarı YALNIZCA BİR KEZ hesaplar.
    raf.sort_by_cached_key(|k| k.ad.to_lowercase());

    for k in &raf {
        println!("{} ({} sayfa)", k.ad, k.sayfa);
    }
}
```

`sort_by_key`, anahtar fonksiyonunu her karşılaştırmada yeniden çağırır. Bu da n log n mertebesinde
çağrı demektir. Anahtar bir sayıysa bu bedavadır. Ama her çağrı bir `String` tahsis ediyorsa, bir
milyon elemanda on milyonlarca tahsis yapılır. `sort_by_cached_key` ise anahtarları önce bir kez
hesaplayıp saklar (n tahsis), sonra onları sıralar.

````exercise
id: m09-e-yarisma
title: Bilgi yarışması sonuçları
difficulty: 3
prompt: |
  Okulunun bilgi yarışmasında sonuç tablosunu hazırlıyorsun. `sirala` fonksiyonu yarışmacıları
  **yerinde** şu kurallarla sıralasın:

  1. **Puanı yüksek** olan önce gelir.
  2. Puanlar eşitse, soruları **daha kısa sürede** (`sure`, saniye) bitiren önce gelir.
  3. Puan ve süre de eşitse **ada göre alfabetik** (artan) sıra kullanılır.

  Fonksiyon bir `&mut [Yarismaci]` dilimi alıyor. Bu yüzden hem bir `Vec`'i hem de bir diziyi
  sıralayabilir.
starter: |
  struct Yarismaci {
      ad: String,
      puan: u32,
      sure: u32,
  }

  fn sirala(liste: &mut [Yarismaci]) {
      todo!()
  }

  fn main() {
      let mut liste = vec![
          Yarismaci { ad: String::from("Elif"), puan: 80, sure: 310 },
          Yarismaci { ad: String::from("Kaan"), puan: 95, sure: 400 },
          Yarismaci { ad: String::from("Arda"), puan: 80, sure: 250 },
          Yarismaci { ad: String::from("Ceren"), puan: 80, sure: 250 },
      ];
      sirala(&mut liste);
      for (i, y) in liste.iter().enumerate() {
          println!("{}. {} — {} puan, {} sn", i + 1, y.ad, y.puan, y.sure);
      }
  }
solution: |
  struct Yarismaci {
      ad: String,
      puan: u32,
      sure: u32,
  }

  fn sirala(liste: &mut [Yarismaci]) {
      liste.sort_by(|a, b| {
          b.puan
              .cmp(&a.puan)
              .then(a.sure.cmp(&b.sure))
              .then(a.ad.cmp(&b.ad))
      });
  }

  fn main() {
      let mut liste = vec![
          Yarismaci { ad: String::from("Elif"), puan: 80, sure: 310 },
          Yarismaci { ad: String::from("Kaan"), puan: 95, sure: 400 },
          Yarismaci { ad: String::from("Arda"), puan: 80, sure: 250 },
          Yarismaci { ad: String::from("Ceren"), puan: 80, sure: 250 },
      ];
      sirala(&mut liste);
      for (i, y) in liste.iter().enumerate() {
          println!("{}. {} — {} puan, {} sn", i + 1, y.ad, y.puan, y.sure);
      }
  }
check: tests
tests: |
  fn y(ad: &str, puan: u32, sure: u32) -> Yarismaci {
      Yarismaci { ad: String::from(ad), puan, sure }
  }

  fn adlar(liste: &[Yarismaci]) -> Vec<&str> {
      let mut sonuc = Vec::new();
      for k in liste {
          sonuc.push(k.ad.as_str());
      }
      sonuc
  }

  #[test]
  fn yuksek_puan_once_gelir() {
      let mut l = vec![y("Ali", 50, 100), y("Banu", 90, 100), y("Cem", 70, 100)];
      sirala(&mut l);
      assert_eq!(adlar(&l), vec!["Banu", "Cem", "Ali"], "puanı en yüksek olan en başta olmalı (azalan sıra)");
  }

  #[test]
  fn esit_puanda_hizli_olan_once() {
      let mut l = vec![y("Ali", 80, 300), y("Banu", 80, 120), y("Cem", 80, 200)];
      sirala(&mut l);
      assert_eq!(adlar(&l), vec!["Banu", "Cem", "Ali"], "puan eşitse süresi KISA olan önce gelmeli");
  }

  #[test]
  fn tam_esitlikte_alfabetik() {
      let mut l = vec![y("Zehra", 60, 90), y("Mert", 60, 90), y("Aylin", 60, 90)];
      sirala(&mut l);
      assert_eq!(adlar(&l), vec!["Aylin", "Mert", "Zehra"], "puan ve süre eşitse ad alfabetik (artan) olmalı");
  }

  #[test]
  fn karisik_tablo() {
      let mut l = vec![
          y("Elif", 80, 310),
          y("Kaan", 95, 400),
          y("Ceren", 80, 250),
          y("Arda", 80, 250),
          y("Deniz", 40, 100),
          y("Burak", 95, 380),
      ];
      sirala(&mut l);
      assert_eq!(
          adlar(&l),
          vec!["Burak", "Kaan", "Arda", "Ceren", "Elif", "Deniz"],
          "üç kural birlikte uygulanmalı: puan azalan, süre artan, ad artan"
      );
  }

  #[test]
  fn bos_ve_tek_elemanli() {
      let mut bos: Vec<Yarismaci> = Vec::new();
      sirala(&mut bos);
      assert!(bos.is_empty(), "boş liste boş kalmalı");
      let mut tek = [y("Tek", 10, 10)];
      sirala(&mut tek);
      assert_eq!(adlar(&tek), vec!["Tek"], "tek elemanlı dizi değişmemeli");
  }
hints:
  - "Üç kriterin hepsini tek bir karşılaştırma kuralında birleştirmen gerekiyor. `sort_by(|a, b| ...)` kullan ve `Ordering`'leri `.then(...)` ile zincirle."
  - "Yön kuralı: **artan** için `a.alan.cmp(&b.alan)`, **azalan** için `b.alan.cmp(&a.alan)`. Puan azalan, süre ve ad artan olmalı."
  - "`liste.sort_by(|a, b| b.puan.cmp(&a.puan).then(a.sure.cmp(&b.sure)).then(a.ad.cmp(&b.ad)));`"
explanation: |
  `then` zinciri soldan sağa okunur: önce puan karşılaştırılır. Sonuç `Equal` değilse diğer
  kriterlere hiç bakılmaz. `Equal` ise süreye, o da eşitse ada geçilir. Bu, tuple'ların
  karşılaştırılma biçimiyle (Ders 4) aynıdır. Bu yüzden şöyle bir alternatif de yazılabilirdi:

  ```rust
  liste.sort_by_key(|y| (std::cmp::Reverse(y.puan), y.sure, y.ad.clone()));
  ```

  Bu da çalışır, ama `y.ad.clone()` her karşılaştırmada bir `String` kopyalar. `sort_by` sürümü ise
  sadece referanslarla çalışır, hiç tahsis yapmaz.

  Ufak bir ayrıntı: `.then(a.ad.cmp(&b.ad))` ad karşılaştırmasını **her seferinde** yapar.
  `.then_with(|| a.ad.cmp(&b.ad))` ise bu karşılaştırmayı yalnızca puan ve süre eşitken çalıştırır.
  Pahalı karşılaştırmalarda `then_with` tercih edilir. Burada `sort` ya da `sort_unstable` seçimi de
  önemli değil: üçüncü kriter iki yarışmacının hâlâ eşit olduğu bir durum bırakmıyor (adlar
  farklıysa). Yine de kararlı `sort_by` güvenli varsayılandır.
````

## Aramak — `contains` ve `binary_search`

En basit arama **`contains`**'tir: `v.contains(&x)` baştan sona bakar ve `bool` döndürür. Bu metot
liste sıralı olsun olmasın çalışır, ama maliyeti O(n)'dir. Bir milyon elemanda, en kötü ihtimalle bir
milyon karşılaştırma yapar.

Liste **sıralıysa** çok daha iyisini yapabilirsin. **İkili arama (binary search)** ortadaki elemana
bakar ve aradığın değerin hangi yarıda olduğuna karar verir. Sonra o yarının ortasına bakar, ve böyle
devam eder. Her adımda arama alanı yarıya iner. Bir milyon eleman için yaklaşık **20** adım yeter.

:::analogy Sözlükte kelime aramak
Kâğıt bir sözlükte "kiraz" kelimesini ararken ilk sayfadan başlamazsın. Ortalardan bir yer açarsın,
"m" harfini görünce geriye dönersin, sonra "j"'yi görünce biraz ileri gidersin... Bunu yapabilmenin tek
sebebi sözlüğün **alfabetik sıralı** olmasıdır. Sayfaları karışık bir sözlükte bu yöntem işe yaramaz.
Üstelik kimse seni uyarmaz, sadece yanlış sayfada kalırsın.
:::

`binary_search` bir **`Result`** döndürür. `Result` da `Option` gibi iki varyantlı bir enum'dur:
`Ok(..)` ve `Err(..)`. Ayrıntısını Modül 10'da göreceksin. Önce tahmin et, `Err` neyi taşıyor olabilir?

```predict
code: |
  fn main() {
      let saatler = [900, 1030, 1200, 1415, 1600];
      println!("{:?}", saatler.binary_search(&1200));
      println!("{:?}", saatler.binary_search(&1100));
      println!("{:?}", saatler.binary_search(&1700));
  }
options:
  - |
    Ok(2)
    Err(2)
    Err(5)
  - |
    Ok(2)
    Err(-1)
    Err(-1)
  - |
    Some(2)
    None
    None
  - |
    Ok(3)
    Err(3)
    Err(6)
answer: 0
explanation: |
  Bulunursa `Ok(indeks)` döner: `1200` 2. indekste. Bulunamazsa `Err` boş elle dönmez, değerin
  **sıra bozulmadan nereye eklenebileceğini** söyler. `1100`, `1030` ile `1200` arasına, yani 2.
  indekse girmeli. `1700` ise en sona, 5. indekse. (Java'nın `binarySearch`'ü bu bilgiyi
  `-(ekleme noktası) - 1` gibi negatif bir sayıya gizler. Rust ayrı bir varyant kullanır.)
```

`Err(i)`'nin bu bilgiyi taşıması, sıralı bir listeye **sırayı bozmadan ekleme** yapmayı kolaylaştırır.
Her eklemeden sonra `push` + `sort` yapmak yerine doğru yeri O(log n)'de bulur ve oraya `insert`
edersin. `insert` elemanları kaydırdığı için O(n)'dir, ama bu bile her seferinde yeniden sıralamaktan
çok daha ucuzdur. `Result` bir enum olduğu için onu Modül 7'deki gibi `match` ile açıyoruz:

```rust
fn main() {
    // Bir kuaförün günlük randevu defteri: "SS:DD" metinleri sıfır dolgulu olduğu için
    // bayt sırası saat sırasıyla aynıdır. Bu yüzden sort ve binary_search doğru çalışır.
    let mut randevular = vec!["09:00", "10:30", "14:15", "16:00"];

    for istek in ["11:00", "14:15", "08:30"] {
        match randevular.binary_search(&istek) {
            Ok(_) => println!("{istek} dolu, başka saat seçin"),
            Err(yer) => {
                randevular.insert(yer, istek);
                println!("{istek} eklendi ({yer}. sıraya)");
            }
        }
    }
    println!("{randevular:?}");

    // Sırasız veride arama: contains (O(n))
    let sepet = ["süt", "ekmek", "peynir"];
    println!("sepette ekmek var mı? {}", sepet.contains(&"ekmek"));
}
```

:::warning binary_search'ün iki kuralı
1. **Liste sıralı olmalı.** Hem de aynı sırayla, yani artan sırada. Sırasız bir listede
   `binary_search` hata da vermez, panik de yapmaz; sadece **anlamsız** bir sonuç döndürür. Kâğıt
   sözlük örneğindeki gibi. Emin değilsen `v.is_sorted()` (Rust 1.82+) ile kontrol edebilirsin; ama bu
   kontrol de O(n)'dir, sıcak döngülerde değil testlerde kullan.
2. **Tekrar eden değerlerde hangi indeksin döneceği belli değildir.** `[1, 2, 2, 2, 3]` içinde `2`'yi
   ararsan 1, 2 ya da 3 dönebilir. Kesin bir sınır gerekiyorsa `partition_point` metoduna bak.
:::

Struct'lardan oluşan, bir alana göre sıralı listelerde **`binary_search_by_key`** kullanılır.
`liste.binary_search_by_key(&85, |o| o.puan)` çağrısı "puanı 85 olanı ara" demektir. Bu çağrı yalnızca
liste zaten `puan`'a göre sıralıysa doğru çalışır.

Hangisini ne zaman kullanmalı? Tek seferlik bir arama için `contains` yeter. Az değişen, sıralı bir
listede çok arama yapıyorsan `binary_search` kullan. Hem çok arama hem çok ekleme/silme varsa Ders
4'teki `HashSet` (ortalama O(1)) ya da `BTreeSet` (O(log n), sıralı) daha doğru seçimdir.

## Filtrelemek — `retain`, `dedup`, `max` ve `min`

Bir listeden istemediğin elemanları atmanın yolu **`retain`**'dir. Adı "tut, alıkoy" demektir: verdiğin
closure `true` döndürdüğü elemanlar **kalır**, diğerleri silinir. Tahmin et, bu kod derlenir mi?

```compiles
code: |
  fn main() {
      let mut puanlar = vec![45, 80, 62, 30, 95];
      puanlar.retain(|p| p >= 50);
      println!("{puanlar:?}");
  }
answer: false
error: E0308
explanation: |
  `retain` elemanları closure'a **ödünç** verir. Elemanı sahiplenip geri vermek yerine sadece ona bakar
  ve kalıp kalmayacağına karar verir. Yani `p`'nin tipi `i32` değil, `&i32`'dir. Bir referansı bir
  tamsayıyla karşılaştıramazsın. Modül 5'teki gibi `*` ile referansı çözmen gerekir: `*p >= 50`.
```

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:3:29
  |
3 |     puanlar.retain(|p| p >= 50);
  |                             ^^ expected `&_`, found integer
  |
  = note: expected reference `&_`
                  found type `{integer}`
help: consider dereferencing the borrow
  |
3 |     puanlar.retain(|p| *p >= 50);
  |                        +
```
`expected &_, found integer`: solda bir referans var, sağda düz bir sayı. `help` satırı çözümü tek
karakterle gösteriyor. Bu derste gördüğün closure'lar genellikle elemanlara **referans** alır:
`sort_by`'ın `a` ve `b`'si, `sort_by_key`'in ve `retain`'in parametresi de birer referanstır.
:::

`retain` de **yerinde** çalışır. Kalan elemanların sırası korunur ve iş tek geçişte, O(n)'de biter.
Ders 1'den hatırladığın bir ayrıntıya dikkat et. Uzunluk azalır, ama ayrılmış kapasite **olduğu gibi
kalır**. Bellek kendiliğinden geri verilmez:

```memory
title: puanlar.retain(|p| *p >= 50)
steps:
  - caption: "Önce: 5 eleman, kapasite 5."
    stack:
      - frame: main
        vars:
          - { name: puanlar, type: "Vec<i32>", value: "ptr · len=5 · cap=5", to: h1, mut: true }
    heap:
      - { id: h1, value: "45 80 62 30 95" }
  - caption: "Sonra: kalanlar öne kaydırıldı, `len` 3 oldu. `cap` hâlâ 5, aynı heap bloğu kullanılıyor. Belleği geri vermek istersen `shrink_to_fit()` çağırabilirsin."
    stack:
      - frame: main
        vars:
          - { name: puanlar, type: "Vec<i32>", value: "ptr · len=3 · cap=5", to: h1, mut: true }
    heap:
      - { id: h1, value: "80 62 95 · · (boş)" }
```

Python'da `[p for p in puanlar if p >= 50]`, JavaScript'te `puanlar.filter(...)` **yeni** bir liste
üretir. Rust'ın `retain`'i ise mevcut vektörü değiştirir, ek tahsis yapmaz. Yeni bir koleksiyon üreten
`filter` yolunu Modül 14'te iterator'larla göreceksin.

İki yardımcı daha var:

- **`dedup`**, **ardışık** tekrarları siler: `[1, 1, 2, 3, 3, 1]` → `[1, 2, 3, 1]`. Sondaki `1` kalır,
  çünkü önceki `1`'lerin hemen yanında değil. Tüm tekrarları silmek için önce **sırala, sonra dedup**
  et. (İlk görülme sırasını korumak istiyorsan Ders 4'teki `HashSet` yöntemini kullan.)
- **`iter().max()`** ve **`iter().min()`** en büyük ve en küçük elemanı **`Option<&T>`** olarak verir.
  Neden `Option`? Çünkü boş bir listenin en büyüğü **yoktur**. Python'da `max([])` istisna fırlatır,
  JavaScript'te `Math.max()` sessizce `-Infinity` döndürür. Rust ise bu olasılığı tipe yazar ve seni
  `None`'u ele almaya zorlar (Modül 7).

```rust
use std::collections::HashMap;

fn main() {
    // 1) Vec::retain: barajı geçemeyenleri ele
    let mut puanlar = vec![45, 80, 62, 30, 95, 80];
    puanlar.retain(|p| *p >= 50);
    println!("geçenler: {puanlar:?}");

    // 2) max / min → Option<&T>
    if let Some(en_yuksek) = puanlar.iter().max() {
        println!("en yüksek: {en_yuksek}");
    }
    let bos: Vec<i32> = Vec::new();
    println!("boş listenin en küçüğü: {:?}", bos.iter().min());

    // 3) sırala + dedup = benzersiz ve sıralı
    let mut sehirler = vec!["Van", "Bursa", "Van", "Adana", "Bursa"];
    sehirler.sort();
    sehirler.dedup();
    println!("şehirler: {sehirler:?}");

    // 4) String::retain: closure her char'ı (kopya olarak) alır
    let mut telefon = String::from("0 (532) 123-45-67");
    telefon.retain(|c| c.is_ascii_digit());
    println!("telefon: {telefon}");

    // 5) HashMap::retain: closure hem anahtarı hem değeri alır
    let mut stok = HashMap::from([("kalem", 12), ("silgi", 0), ("defter", 3)]);
    stok.retain(|_, adet| *adet > 0);
    println!("stokta {} çeşit ürün var", stok.len());
}
```

:::tip Eşitlik durumunda hangisi?
Birden çok eleman eşit derecede en büyükse `max` **sonuncusunu**, `min` ise **ilkini** döndürür. Bir
`Copy` değer olarak almak istersen Ders 3'teki `.copied()` işini görür:
`let en: Option<i32> = puanlar.iter().max().copied();`
:::

## Ondalık sayıları sıralamak — `NaN` sorunu

Şimdiye kadar her şey yolunda gitti. Şimdi bir sınıfın boy ölçümlerini sıralayalım:

```compiles
code: |
  fn main() {
      let mut boylar = vec![1.72, 1.65, 1.80, 1.58];
      boylar.sort();
      println!("{boylar:?}");
  }
answer: false
error: E0277
explanation: |
  `sort`, elemanların **tam bir sıralamaya (`Ord`)** sahip olmasını ister. `f64` ve `f32` ise bu
  şartı karşılamaz. Sebebi `NaN` ("Not a Number", sayı değil): `0.0 / 0.0` gibi işlemlerin sonucu
  olan bu özel değer hiçbir şeyden büyük, küçük ya da ona eşit değildir. Kendisine bile eşit değildir!
```

:::error
```text
error[E0277]: the trait bound `{float}: Ord` is not satisfied
   --> src/main.rs:3:12
    |
  3 |     boylar.sort();
    |            ^^^^ the trait `Ord` is not implemented for `{float}`
    |
    = help: the following other types implement trait `Ord`:
              i128
              i16
              i32
              ...
note: required by a bound in `slice::<impl [T]>::sort`
```
`Ord` bir **trait**'tir, yani bir tipin sahip olduğu bir yetenek. "Her iki değer de kesin olarak
karşılaştırılabilir" anlamına gelir. Trait'leri Modül 11'de öğreneceksin. Mesajın söylediği şu: `sort`,
`Ord` yeteneği olan tipleri kabul eder; ondalık sayıların bu yeteneği yok. Aynı sebeple
`boylar.iter().max()` de derlenmez.
:::

Ondalık sayılar yalnızca **kısmi sıralamaya (`PartialOrd`)** sahiptir. Onların `partial_cmp` metodu
`Ordering` değil, **`Option<Ordering>`** döndürür. İki taraftan biri `NaN` ise sonuç `None` olur.
C ve Python bu durumu sessizce geçiştirir: `NaN` içeren bir dizinin sıralanmış hâli **tutarsız**
olabilir ve kimse fark etmez. (Java'nın `Arrays.sort(double[])`'ı ise, aşağıda göreceğin `total_cmp`'e
benzer gizli bir tam sıra kullanır.) Rust ise kararı **açıkça** sana bırakır. Üç seçeneğin var:

```rust,should_panic
fn main() {
    let nan = f64::NAN;
    let yine_nan = f64::NAN;
    println!("NaN == NaN? {}", nan == yine_nan); // false!
    println!("{:?}", nan.partial_cmp(&1.0)); // None

    // Seçenek 1: partial_cmp + unwrap — NaN yoksa çalışır, varsa PANİK
    let mut olcumler = vec![3.2, f64::NAN, 1.5];
    olcumler.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("{olcumler:?}"); // buraya hiç gelinmez
}
```

```rust
fn main() {
    // Seçenek 2: total_cmp — her f64 için TAM bir sıra tanımlar, asla panik yapmaz
    let mut olcumler = vec![2.5, f64::NAN, -0.0, 0.0, -1.0, f64::INFINITY];
    olcumler.sort_by(|a, b| a.total_cmp(b));
    println!("{olcumler:?}");

    // Seçenek 3: önce anlamsız değerleri at, sonra sırala (çoğu zaman en doğrusu)
    let mut sicakliklar = vec![21.5, f64::NAN, 18.0, 25.25];
    sicakliklar.retain(|t| !t.is_nan());
    sicakliklar.sort_by(|a, b| a.total_cmp(b));
    println!("{sicakliklar:?}");

    // En büyük ondalık: iter().max() derlenmez. Yol 1: basit bir döngü
    let mut en_sicak = f64::NEG_INFINITY;
    for t in &sicakliklar {
        en_sicak = en_sicak.max(*t);
    }
    println!("en sıcak: {en_sicak}");

    // Yol 2: max_by / min_by, kuralı sort_by gibi bir closure ile alır → Option<&f64>
    let en_serin = sicakliklar.iter().min_by(|a, b| a.total_cmp(b));
    println!("en serin: {en_serin:?}");
}
```

**`total_cmp`** (Rust 1.62'den beri), IEEE 754 standardındaki "totalOrder" sırasını uygular:
`-NaN < -∞ < negatifler < -0.0 < +0.0 < pozitifler < +∞ < +NaN`. Her değer çiftinin kesin bir sırası
vardır. Bu yüzden `sort_by(|a, b| a.total_cmp(b))` hiçbir zaman panik yapmaz ve her zaman tutarlıdır.
`NaN`'lar uçlara toplanır, `-0.0` da `0.0`'dan önce gelir. `partial_cmp(..).unwrap()` ise "listede
`NaN` olmadığına eminim" demektir. Bu söz yanlış çıkarsa program çöker.

:::deep Sıralama algoritmaları ve tutarsız karşılaştırmalar
Rust 1.81'den beri `sort` **driftsort**, `sort_unstable` ise **ipnsort** algoritmasını kullanır. İkisi de
en kötü durumda O(n log n)'dir ve gerçek verideki önceden sıralı parçaları fark edip hızlanır. Aynı
sürümle gelen bir değişiklik daha var: karşılaştırma kuralın **tutarsızsa** (örneğin hem `a < b` hem
`b < a` diyorsa), sıralama artık bunu fark edip **panik yapabilir**. Bellek güvenliği hiçbir durumda
bozulmaz. Ama sonuç sıralı olmayabilir ya da program durabilir. `NaN`'ı `Equal` sayan
`a.partial_cmp(b).unwrap_or(Ordering::Equal)` gibi "çözümler" tam da bu tür tutarsız kurallardır.
`total_cmp` kullan.
:::

Şimdi hepsini bir araya getirme zamanı. Bir ipucu: bir dilimin **sahipli kopyasını** almak için
`dilim.to_vec()` kullanılır. Bu çağrı yeni bir `Vec` oluşturur ve orijinal dilime dokunmaz.

```exercise
id: m09-e-medyan
title: Hava istasyonu medyanı
difficulty: 3
prompt: |
  Bir hava istasyonu gün boyunca sıcaklık ölçümleri gönderiyor. Arızalanan sensör ise ölçüm yerine
  `NaN` gönderiyor. Ortalama, tek bir uç değerden çok etkilenir. Bu yüzden meteorologlar **medyanı**
  (sıralanmış verinin ortasındaki değeri) tercih eder.

  `medyan` fonksiyonunu yaz:

  - `NaN` değerleri **yok say** (`x.is_nan()` bir `f64`'ün `NaN` olup olmadığını söyler).
  - Geçerli ölçüm hiç yoksa `None` döndür.
  - Geçerli ölçüm sayısı **tekse** sıralanmış verinin tam ortasındaki değeri, **çiftse** ortadaki iki
    değerin ortalamasını döndür.
  - Girdi dilimini değiştirme (zaten `&[f64]` olduğu için değiştiremezsin; kopya üzerinde çalış).
starter: |
  fn medyan(olcumler: &[f64]) -> Option<f64> {
      todo!()
  }

  fn main() {
      let gun = [14.5, f64::NAN, 9.0, 21.0, 17.5];
      match medyan(&gun) {
          Some(m) => println!("günün medyanı: {m} °C"),
          None => println!("geçerli ölçüm yok"),
      }
  }
solution: |
  fn medyan(olcumler: &[f64]) -> Option<f64> {
      let mut gecerli = olcumler.to_vec();
      gecerli.retain(|x| !x.is_nan());
      if gecerli.is_empty() {
          return None;
      }
      gecerli.sort_by(|a, b| a.total_cmp(b));

      let n = gecerli.len();
      if n % 2 == 1 {
          Some(gecerli[n / 2])
      } else {
          Some((gecerli[n / 2 - 1] + gecerli[n / 2]) / 2.0)
      }
  }

  fn main() {
      let gun = [14.5, f64::NAN, 9.0, 21.0, 17.5];
      match medyan(&gun) {
          Some(m) => println!("günün medyanı: {m} °C"),
          None => println!("geçerli ölçüm yok"),
      }
  }
check: tests
tests: |
  #[test]
  fn tek_sayida_olcum() {
      assert_eq!(medyan(&[12.5, 3.0, 8.0]), Some(8.0), "sıralı hâl [3.0, 8.0, 12.5]; ortadaki 8.0");
  }

  #[test]
  fn cift_sayida_olcum_ortalama_alir() {
      assert_eq!(medyan(&[4.0, 1.0, 3.0, 2.0]), Some(2.5), "sıralı hâl [1, 2, 3, 4]; ortadaki ikisi 2 ve 3, ortalaması 2.5");
  }

  #[test]
  fn nan_degerler_yok_sayilir() {
      let olcumler = [f64::NAN, 5.0, -1.0, f64::NAN, 2.0];
      assert_eq!(medyan(&olcumler), Some(2.0), "NaN'lar atılınca [-1, 2, 5] kalır; medyan 2.0");
  }

  #[test]
  fn negatif_sicakliklar() {
      assert_eq!(medyan(&[-3.5, -0.5, -10.0, 0.0]), Some(-2.0), "sıralı hâl [-10, -3.5, -0.5, 0]; (-3.5 + -0.5) / 2 = -2.0");
  }

  #[test]
  fn gecerli_olcum_yoksa_none() {
      assert_eq!(medyan(&[]), None, "boş listede medyan yoktur");
      assert_eq!(medyan(&[f64::NAN, f64::NAN]), None, "yalnızca NaN varsa geçerli ölçüm yoktur");
  }
hints:
  - "Üç adım var: (1) `to_vec()` ile bir kopya al ve `retain` ile `NaN`'ları at, (2) boşsa `None` döndür, (3) kopyayı sırala ve ortaya bak."
  - "`f64` için `sort()` derlenmez, `sort_by(|a, b| a.total_cmp(b))` kullan. `retain`'in closure'ı `&f64` alır ama `x.is_nan()` gibi metot çağrıları referansı kendiliğinden çözer."
  - "`let n = gecerli.len();` ve sonra `if n % 2 == 1 { Some(gecerli[n / 2]) } else { Some((gecerli[n / 2 - 1] + gecerli[n / 2]) / 2.0) }`"
explanation: |
  Çözüm dersin araçlarını birleştiriyor. `to_vec` ile girdiyi koruyarak bir kopya alıyoruz, `retain`
  ile filtreliyoruz, `total_cmp` ile sıralıyoruz ve indeksle ortaya erişiyoruz. Boşluk kontrolü
  şart: o olmasa boş bir listede `n` sıfır (çift) olur ve `n / 2 - 1` ifadesi `0 - 1` hesaplamaya
  çalışırdı. `usize` negatif olamaz (Modül 2): debug derlemede bu bir **taşma paniğidir**
  (`attempt to subtract with overflow`); release derlemede ise sayı sessizce `usize::MAX`'e sarar ve
  program bu kez indeksleme sırasında **sınır dışı paniğiyle** durur. İki durumda da boşluk kontrolü
  doğru çözümdür.

  `NaN`'ları attıktan sonra `partial_cmp(b).unwrap()` da artık güvenli olurdu. Ama `total_cmp` hem
  daha kısa, hem de kodu sonradan değiştiren biri filtreyi kaldırsa bile çökmeyen bir sürüm sunar.

  İleri bir not: medyan için bütün listeyi sıralamak aslında gereğinden fazla iş. Standart kütüphanedeki
  `select_nth_unstable_by`, yalnızca n. elemanı doğru yerine koyar (küçükler soluna, büyükler sağına)
  ve bunu O(n)'de yapar. Büyük veri setlerinde O(n log n)'lik tam sıralamaya göre belirgin biçimde
  hızlıdır.
```

## Özet

:::remember
- **`sort()`** yerinde, **kararlı** ve O(n log n)'dir. `&mut self` alır, `()` döndürür. `let mut` unutma (**E0596**).
- **`sort_unstable*`**: eşitlerin sırası garanti değil, ama daha hızlı ve ek bellek ayırmaz. Eşitler ayırt edilemiyorsa (sayılar gibi) bunu tercih et.
- **`cmp`**, `Ordering::{Less, Equal, Greater}` döndürür. **`sort_by(|a, b| ...)`** ile kural senin: azalan için `b.cmp(a)`, çok kriter için `.then(...)` / `.then_with(|| ...)`.
- **`sort_by_key(|x| anahtar)`**: anahtar elemanı ödünç alamaz (`|k| &k.ad` derlenmez). Azalan için `Reverse(anahtar)`, pahalı anahtar için `sort_by_cached_key`.
- **`contains`** O(n) ve sırasız veride çalışır. **`binary_search`** O(log n) ve **yalnızca sıralı** veride çalışır. `Ok(i)` bulunduğunu, `Err(i)` ekleme yerini bildirir.
- **`retain(|x| ...)`**: `true` dönenleri tutar, yerinde çalışır, kapasiteyi korur. **`dedup`** yalnızca **ardışık** tekrarları siler (önce `sort`).
- **`iter().max()` / `min()`** → `Option<&T>`, çünkü boş listenin en büyüğü yoktur.
- `f64` **`Ord` değildir** (`NaN` yüzünden): `sort_by(|a, b| a.total_cmp(b))` kullan ya da önce `retain(|x| !x.is_nan())`.
:::

```reflect
prompt: |
  Bir e-ticaret sitesinde kullanıcı ürünleri önce "en çok değerlendirilen"e, ardından "fiyata göre
  artan"a göre sıralıyor. Rust'ın `sort` ailesinin **kararlı** olması bu senaryoda neden önemli? Hangi
  durumda `sort_unstable` kullanmak hiçbir şey kaybettirmez?
answer: |
  Model cevap: İkinci sıralama (fiyat) kararlı olduğunda, **aynı fiyatlı** ürünler bir önceki
  sıralamadaki yerlerini, yani değerlendirme sırasını korur. Kullanıcı "aynı fiyattakiler arasında en
  çok değerlendirilen önde" sonucunu bedavaya alır. Kararsız bir sıralama aynı fiyatlı ürünleri rastgele
  karıştırabilir ve kullanıcının ilk tıklaması boşa gider. `sort_unstable`, eşit sayılan elemanların
  birbirinden **ayırt edilemediği** durumlarda hiçbir şey kaybettirmez. Örneğin bir `Vec<u32>`'deki iki
  `40` tamamen aynıdır; onların yer değiştirmesi gözlemlenemez. O zaman daha hızlı ve tahsis yapmayan
  kararsız sürüm iyi bir seçimdir.
```

```flashcards
- front: "`let x = v.sort();` satırından sonra `x`'in tipi nedir? Sıralanan ne?"
  back: "`()`. `sort` yerinde sıralar; sıralanan `v`'nin kendisidir."
- front: Kararlı (stable) sıralama ne demektir?
  back: Eşit sayılan elemanların orijinal sıraları korunur. `sort`, `sort_by` ve `sort_by_key` kararlıdır, `sort_unstable*` değildir.
- front: "Bir `Vec<Ogrenci>`'yi `puan`'a göre AZALAN sıralamanın iki yolu?"
  back: "`v.sort_by(|a, b| b.puan.cmp(&a.puan))` ya da `v.sort_by_key(|o| Reverse(o.puan))`."
- front: "`a.cmp(&b).then(x.cmp(&y))` ne yapar?"
  back: "Önce `a` ile `b`'yi karşılaştırır; sonuç `Equal` ise `x` ile `y`'nin karşılaştırmasını döndürür (ikinci kriter)."
- front: "Neden `v.sort_by_key(|k| &k.ad)` derlenmez? Doğru alternatif?"
  back: "Anahtar, elemanın içine işaret eden bir referans olamaz (lifetime hatası). `v.sort_by(|a, b| a.ad.cmp(&b.ad))` kullan."
- front: "`[10, 20, 30].binary_search(&25)` ne döndürür?"
  back: "`Err(2)`: bulunamadı; sırayı bozmadan 2. indekse eklenebilir."
- front: "`let mut v = vec![1, 1, 2, 1]; v.dedup();` sonrası `v` nedir?"
  back: "`[1, 2, 1]`. `dedup` yalnızca **ardışık** tekrarları siler; tüm tekrarlar için önce sırala."
- front: "Neden `Vec<f64>` üzerinde `sort()` çağrılamaz? Ne kullanılır?"
  back: "`f64` `Ord` değildir, çünkü `NaN` hiçbir şeyle karşılaştırılamaz (E0277). `sort_by(|a, b| a.total_cmp(b))` kullanılır."
```
