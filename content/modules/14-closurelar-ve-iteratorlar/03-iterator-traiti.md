---
id: m14-l03
title: Iterator trait'i
minutes: 18
type: lesson
objectives:
  - "`Iterator` trait'inin tanımını (`type Item`, `next`) okuyup `next`'i elle çağırarak bir iterator'ı adım adım ilerletebilmek"
  - "`for` döngüsünün `IntoIterator` üzerinden nasıl çalıştığını açıklayabilmek"
  - "`iter()`, `iter_mut()` ve `into_iter()` arasında ürettikleri öğe tipine (`&T`, `&mut T`, `T`) göre seçim yapabilmek"
  - Rust'ın iterator geçersizleşmesini derleme zamanında nasıl engellediğini açıklayabilmek
keywords: [Iterator, next, "type Item", IntoIterator, iter, iter_mut, into_iter, tembel, lazy, E0382, E0502, E0596]
---

Modül 3'ten beri yüzlerce `for` döngüsü yazdın: `for i in 1..=5`, `for x in &v`, `for c in s.chars()`...
Hepsinin arkasında **tek bir trait** çalışıyor: `Iterator`. Bu derste perdeyi kaldırıyoruz. Bir iterator'ın
aslında ne olduğunu, `for`'un onu nasıl kullandığını ve Rust'ın, C++'ta yıllarca hata kaynağı olan
"döngü sırasında koleksiyonu değiştirme" problemini nasıl derleme anında bitirdiğini göreceksin.

## Tek zorunlu metot: next

Bir vektörden bir iterator alıp onu **elle** ilerletelim. Tahmin et:

```predict
code: |
  fn main() {
      let notlar = vec![85, 92];
      let mut it = notlar.iter();
      println!("{:?}", it.next());
      println!("{:?}", it.next());
      println!("{:?}", it.next());
      println!("{:?}", it.next());
  }
options:
  - |
    Some(85)
    Some(92)
    None
    None
  - |
    Some(85)
    Some(92)
    None
    Some(85)
  - |
    85
    92
    0
    0
answer: 0
explanation: |
  Her `next()` çağrısı sıradaki elemanı `Some(...)` içinde verir. Elemanlar bitince `None` döner ve
  bundan sonra da `None` dönmeye devam eder; iterator başa sarmaz. (Burada `Some(85)` aslında
  `Some(&85)`'tir — `iter()` referans verir — ama `{:?}` referansları görünmez biçimde yazdırır.)
```

İşte standart kütüphanedeki tanımın özü:

```rust,ignore
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;

    // ...ve varsayılan gövdesi olan 70'ten fazla metot: map, filter, sum, count, zip...
}
```

İki yeni ayrıntı var:

- **`type Item;`** bir **ilişkili tip (associated type)**. Modül 11'de `TryFrom`'daki `type Error`'ı görmüştün:
  trait'i uygulayan tip "benim öğelerim şu tipte" der. `Vec<i32>`'nin `iter()`'i için `Item = &i32`'dir.
  İlişkili tiplerin generic parametrelerden farkını Modül 22'de derinlemesine göreceğiz.
- **`next` tek zorunlu metottur.** Trait'i uygulamak isteyen bir tip sadece "sıradakini ver" sorusuna cevap
  verir; geri kalan 70+ metot `next` üzerine kurulu varsayılan metotlardır (Modül 11'deki *default methods*).
  Bunu son derste kendi iterator'ımızı yazarken bizzat yaşayacağız.

Dönüş tipi neden `Option`? Çünkü "eleman bitti" durumunu ifade etmenin en dürüst yolu bu (Modül 7). Diğer
dillere bak: Java iki metot kullanır (`hasNext()` sonra `next()`) ve sırayı karıştırırsan çalışma anında
istisna alırsın; Python bitişi `StopIteration` **istisnası** fırlatarak bildirir; C++ iki işaretçi (`begin`,
`end`) ile çalışır ve `end`'i geçersen tanımsız davranış başlar. Rust'ta tek metot, tek tip ve
derleyicinin kontrol ettiği bir `None`.

:::analogy Kitap ayracı
Koleksiyon bir **kitaptır**, iterator ise içine koyduğun **ayraç**. `notlar.iter()` kitaba yeni bir ayraç
yerleştirir — kitabın kendisi değişmez. `next()` "ayracın gösterdiği sayfayı oku ve ayracı bir sayfa ilerlet"
demektir. Kitap bitince ayraç arka kapakta durur: kaç kez bakarsan bak, "bitti" (`None`) dersin. Aynı kitaba
birden çok ayraç koyabilirsin; her biri kendi yerini bilir.
:::

```memory
title: "let mut it = notlar.iter(); it.next();"
steps:
  - caption: "`iter()` heap'teki ilk elemanı gösteren küçük bir yapı oluşturur: konum + bitiş. Elemanlar kopyalanmaz."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=2 · cap=2", to: h1 }
          - { name: it, type: "Iter<i32>", value: "konum → [0] · bitiş → [2]", mut: true, to: h1 }
    heap:
      - { id: h1, value: "[0]=85  [1]=92" }
  - caption: "İlk `next()`: `Some(&85)` döner, konum bir ilerler. İkinciden sonra konum == bitiş; artık hep `None`."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=2 · cap=2", to: h1 }
          - { name: it, type: "Iter<i32>", value: "konum → [1] · bitiş → [2]", mut: true, to: h1, note: ödünç alıyor }
    heap:
      - { id: h1, value: "[0]=85  [1]=92" }
```

`next` neden `&mut self` alıyor? Çünkü iterator'ın **içindeki konum** değişiyor. Bu yüzden şu kod derlenmez:

```compiles
code: |
  fn main() {
      let v = vec![10, 20];
      let it = v.iter();
      println!("{:?}", it.next());
  }
answer: false
error: E0596
explanation: |
  `next(&mut self)` iterator'ı değiştirir (ayracı ilerletir), dolayısıyla `it` `mut` olmalı:
  `let mut it = v.iter();`. Dikkat: değişen şey **iterator**, vektör değil — `v` hâlâ `mut` değil ve
  olması da gerekmiyor.
```

## Tembellik: iterator'lar istenmeden çalışmaz

Iterator oluşturmak **hiçbir iş yapmaz**; iş, biri `next()` dediğinde yapılır. Bunu en net aralıklarda
(range) görürsün — `1..4` aslında kendi durumunu taşıyan bir iterator'dır:

```rust
fn main() {
    let mut r = 1..4;
    println!("{:?}", r.next()); // Some(1)
    println!("kalan aralık: {r:?}"); // 2..4 — aralığın kendisi ilerledi!

    // Sonsuz bir aralık bile sorun değil: kimse hepsini istemiyor
    let mut sonsuz = 1..;
    println!("{:?} {:?}", sonsuz.next(), sonsuz.next());

    let v = vec![1, 2, 3];
    let mut it = v.iter();
    it.next();
    println!("kalanlar: {:?}", it.as_slice()); // [2, 3]
}
```

`1..` hiç bitmeyen bir sayı dizisidir. Bellekte sonsuz sayı tutsaydık program çökerdi; ama iterator sadece
"sıradaki sayı" bilgisini tutar ve her `next()`'te bir sonrakini **o anda hesaplar**. Buna **tembel
değerlendirme (lazy evaluation)** denir.

Şimdi bir önizleme: bir sonraki derste her elemanı bir closure'dan geçiren `map` adaptörünü göreceğiz.
`map` de tembeldir. Tahmin et:

```predict
code: |
  fn main() {
      let v = vec![1, 2, 3];
      let _iki_katlar = v.iter().map(|x| {
          println!("işleniyor: {x}");
          x * 2
      });
      println!("bitti");
  }
options:
  - |
    işleniyor: 1
    işleniyor: 2
    işleniyor: 3
    bitti
  - |
    bitti
  - |
    bitti
    işleniyor: 1
    işleniyor: 2
    işleniyor: 3
answer: 1
explanation: |
  `map` closure'ı **hemen çalıştırmaz**; sadece "biri eleman isterse önce bu closure'dan geçir" diyen yeni bir
  iterator kurar. Hiç kimse `next()` çağırmadığı için closure bir kez bile çalışmaz. JavaScript'teki
  `[1,2,3].map(...)` hemen çalışıp yeni bir dizi üretir; Rust'ın (ve Python 3'ün `map`'inin) iterator'ları
  ise tembeldir.
```

Derleyici bu tuzağı bildiği için seni uyarır (sonucu bir değişkene atamasaydık):

:::error
```text
warning: unused `Map` that must be used
 --> src/main.rs:3:5
  |
3 | /     v.iter().map(|x| {
4 | |         println!("işleniyor: {x}");
5 | |         x * 2
6 | |     });
  | |______^
  |
  = note: iterators are lazy and do nothing unless consumed
```
*"iterators are lazy and do nothing unless consumed"* — iterator'lar tembeldir ve **tüketilmedikçe** hiçbir
şey yapmazlar. Bir iterator'ı sonuna kadar çalıştıran şeylere **tüketici (consumer)** denir: `for` döngüsü,
`sum`, `collect`... Onları 5. derste göreceğiz.
:::

## for döngüsünün sırrı: IntoIterator

`for` aslında bir **sözdizimi şekeridir**. Şu döngü:

```rust,ignore
for x in koleksiyon {
    govde(x);
}
```

derleyici tarafından kabaca şuna çevrilir:

```rust,ignore
let mut it = IntoIterator::into_iter(koleksiyon);
while let Some(x) = it.next() {
    govde(x);
}
```

Yani `for`, önce koleksiyonu bir iterator'a **çevirir** (`into_iter`), sonra Modül 7'deki `while let` ile
`None` gelene kadar `next()` çağırır. "İterator'a çevrilebilen şeyler" için ayrı bir trait vardır:

```rust,ignore
pub trait IntoIterator {
    type Item;
    type IntoIter: Iterator<Item = Self::Item>;
    fn into_iter(self) -> Self::IntoIter;
}
```

Standart kütüphanede her `Iterator` için `IntoIterator`'ı uygulayan bir **blanket impl** (Modül 11) var; bu
yüzden `for x in v.iter()` de, `for x in 1..5` de çalışır. Şimdi `into_iter`'in imzasına bak: **`self`**
alıyor. Tahmin et:

```compiles
code: |
  fn main() {
      let isimler = vec![String::from("Ali"), String::from("Ayşe")];
      for isim in isimler {
          println!("{isim}");
      }
      println!("{}", isimler.len());
  }
answer: false
error: E0382
explanation: |
  `for isim in isimler` → `IntoIterator::into_iter(isimler)` çağrısıdır ve `into_iter(self)` vektörün
  **sahipliğini alır**. Döngü bittiğinde vektör tüketilmiş olur; `isimler.len()` taşınmış bir değeri
  kullanmaya çalışır.
```

:::error
```text
error[E0382]: borrow of moved value: `isimler`
   --> src/main.rs:6:20
    |
  2 |     let isimler = vec![String::from("Ali"), String::from("Ayşe")];
    |         ------- move occurs because `isimler` has type `Vec<String>`, which does not implement the `Copy` trait
  3 |     for isim in isimler {
    |                 ------- `isimler` moved due to this implicit call to `.into_iter()`
...
  6 |     println!("{}", isimler.len());
    |                    ^^^^^^^ value borrowed here after move
    |
note: the `for` loop is desugared into a call to `std::iter::IntoIterator::into_iter`, which takes ownership of the receiver `self`, which moves `isimler`
help: consider iterating over a slice of the `Vec<String>`'s content to avoid moving into the `for` loop
    |
  3 |     for isim in &isimler {
    |                 +
```
Derleyici az önce anlattığımız çeviriyi kendisi söylüyor: *"the `for` loop is desugared into a call to
`IntoIterator::into_iter`"*. Çözüm `&isimler` üzerinde dönmek — ki bu bizi aşağıdaki "Üç yol" bölümüne götürüyor.
:::

Çeviriyi kendin kur:

```parsons
prompt: |
  `for s in &sehirler { println!("{s}"); }` döngüsünü `for` kullanmadan, iterator'ı elle ilerleterek yaz.
lines: |
  fn main() {
      let sehirler = vec!["Rize", "Van", "Muş"];
      let mut it = sehirler.iter();
      while let Some(s) = it.next() {
          println!("{s}");
      }
  }
distractors: |
      let it = sehirler.iter();
      while let Some(s) = sehirler.next() {
      if let Some(s) = it.next() {
explanation: |
  `next` iterator'ı değiştirdiği için `let mut it` gerekir. Vektörün kendisinin `next` metodu yoktur;
  `next` iterator'da tanımlıdır. `if let` sadece bir kez denerdi; döngü için `while let` gerekir.
```

## Üç yol: iter, iter_mut, into_iter

Bir koleksiyonu üç farklı şekilde gezebilirsin. Fark, iterator'ın **ne verdiğinde**:

| metot | `for` kısayolu | `Item` (`Vec<T>` için) | koleksiyona ne olur? |
|---|---|---|---|
| `v.iter()` | `for x in &v` | `&T` | ödünç alınır, sonra yine kullanılabilir |
| `v.iter_mut()` | `for x in &mut v` | `&mut T` | değiştirilebilir ödünç; elemanlar yerinde değişebilir |
| `v.into_iter()` | `for x in v` | `T` | **tüketilir**; elemanların sahipliği sana geçer |

`&v` için `IntoIterator` uygulaması `v.iter()`'i, `&mut v` için olan `v.iter_mut()`'u çağırır. Yani tablonun
ikinci sütunu birinci sütunun kısa yazımıdır.

```rust
fn main() {
    let mut kitaplar = vec![String::from("Tutunamayanlar"), String::from("Kürk Mantolu Madonna")];

    // 1) iter(): &String — sadece oku
    for k in kitaplar.iter() {
        println!("okunuyor: {k} ({} bayt)", k.len());
    }

    // 2) iter_mut(): &mut String — yerinde değiştir
    for k in kitaplar.iter_mut() {
        k.push_str(" ★");
    }
    println!("{kitaplar:?}");

    // 3) into_iter(): String — sahipliği al, başka yere taşı
    let mut raf: Vec<String> = Vec::new();
    for k in kitaplar.into_iter() {
        raf.push(k); // k bir String; kopyalamadan taşıyoruz
    }
    println!("raf: {raf:?}");
    // println!("{kitaplar:?}"); // ← E0382: kitaplar tüketildi
}
```

Yanlış iterator'ı seçersen derleyici fark eder:

```compiles
code: |
  fn main() {
      let mut isimler = vec![String::from("ali"), String::from("ayşe")];
      for isim in isimler.iter() {
          isim.push_str("!");
      }
      println!("{isimler:?}");
  }
answer: false
error: E0596
explanation: |
  `iter()` `&String` verir; bir `&` referansın arkasındaki değeri değiştiremezsin. Derleyicinin önerisi
  tam yerinde: *"this iterator yields `&` references"* ve *"help: use mutable method"* → `iter_mut()`.
```

Hangisi ne zaman? Kural basit: **sadece okuyorsan `iter()`, yerinde değiştiriyorsan `iter_mut()`,
elemanların sahipliğine gerçekten ihtiyacın varsa (ve koleksiyonla işin bittiyse) `into_iter()`.**
Tereddütte `iter()` ile başla; derleyici gerekirse seni düzeltir.

Bu kalıp sadece `Vec`'e özgü değil. Modül 9'daki koleksiyonları ve string metotlarını hatırla:

```quiz
question: |
  `let stok: HashMap<String, u32> = ...;` için `for oge in stok.iter()` döngüsünde `oge`'nin tipi nedir?
options:
  - "`(String, u32)`"
  - "`(&String, &u32)`"
  - "`&(String, u32)`"
  - "`&String` (sadece anahtarlar)"
answer: 1
explanation: |
  `HashMap::iter()` her anahtar-değer çiftini **iki referanstan oluşan bir tuple** olarak verir:
  `(&K, &V)`. Bu yüzden genellikle `for (urun, adet) in &stok` diye açarak yazarız. Sahipliği almak
  istersen `into_iter()` `(K, V)` verir; sadece anahtarlar için `keys()`, değerler için `values()` vardır.
  (Ve unutma: `HashMap`'te sıra garanti değildir.)
feedback:
  - Bu `into_iter()`'in verdiği tiptir; `iter()` ödünç alır.
  - Doğru! Anahtar ve değere ayrı ayrı referanslar.
  - "`HashMap` elemanlarını içeride tuple olarak saklamaz; iterator her seferinde iki referanstan yeni bir tuple üretir."
  - "Sadece anahtarlar için `stok.keys()` kullanılır."
```

:::tip Tanıdık iterator'lar
`s.chars()`, `s.bytes()`, `s.split_whitespace()`, `s.lines()`, `s.split(',')` (Modül 9), `m.keys()`,
`m.values()`, `0..n`, `(0..n).rev()` — hepsi `Iterator` uygulayan tipler döndürür. Bir dizi `[1, 2, 3]`
üzerinde `for x in dizi` ise (edition 2021'den beri) elemanları **değerle** verir.
:::

## Iterator geçersizleşmesi Rust'ta imkânsız

C++'ta çok bilinen bir hata türü vardır. Bir vektörü gezerken ona eleman eklersin:

```text
// C++ — derlenir, ama tanımsız davranış!
for (int& x : v) {
    if (x == 2) v.push_back(4);   // vektör yeniden boyutlanırsa x sarkan bir referans olur
}
```

`push_back` kapasite dolduğunda vektörü **yeni bir adrese taşır** (Modül 9'daki yeniden ayırma diyagramını
hatırla). Döngünün elindeki iterator eski, artık serbest bırakılmış belleği göstermeye devam eder: buna
**iterator geçersizleşmesi (iterator invalidation)** denir. Program bazen çalışır, bazen çöker, bazen
sessizce yanlış sonuç üretir. Java bunu çalışma anında `ConcurrentModificationException` ile yakalar;
Python'da listeyi gezerken silmek elemanların atlanmasına yol açar. Rust'ta ne olur?

```compiles
code: |
  fn main() {
      let mut v = vec![1, 2, 3];
      for x in &v {
          if *x == 2 {
              v.push(4);
          }
      }
      println!("{v:?}");
  }
answer: false
error: E0502
explanation: |
  `for x in &v` döngü boyunca `v`'yi `&` ile ödünç alır. Döngünün içinde `v.push(4)` bir `&mut` ister.
  "Ya bir `&mut` ya da istediğin kadar `&`" kuralı (Modül 5) iterator geçersizleşmesini **derleme anında**
  imkânsız kılar. Ek bir kural gerekmedi: ödünç alma kuralları yeterli.
```

:::error
```text
error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable
 --> src/main.rs:5:13
  |
3 |       for x in &v {
  |       -        --
  |       |        |
  |       |        immutable borrow occurs here
  |  _____|        immutable borrow later used here
  | |
4 | |         if *x == 2 {
5 | |             v.push(4);
  | |             ^^^^^^^^^ mutable borrow occurs here
6 | |         }
7 | |     }
  | |_____- this for loop borrows `v` immutably, preventing mutation within its body
  |
  = help: consider using an index-based loop instead, or collecting modifications into a separate collection
```
Son `help` satırı iki klasik çözümü veriyor: indeksle dönmek ya da değişiklikleri **ayrı bir koleksiyonda
toplayıp** döngüden sonra uygulamak.
:::

```rust
fn main() {
    let mut v = vec![1, 2, 3];

    // Çözüm: eklenecekleri ayrı topla, döngü bitince ekle
    let mut eklenecekler = Vec::new();
    for x in &v {
        if *x == 2 {
            eklenecekler.push(4);
        }
    }
    for e in eklenecekler {
        v.push(e);
    }
    println!("{v:?}");

    // Silmek içinse zaten güvenli bir araç var (Modül 9): retain
    v.retain(|&x| x != 1);
    println!("{v:?}");
}
```

:::ferris
C++ programcılarının yıllarca kod incelemelerinde aradığı bir hatayı, Rust'ın derleyicisi senin yerine her
derlemede arıyor. Hem de yeni bir kural uydurmadan — Modül 5'te öğrendiğin ödünç alma kurallarıyla! 🦀
:::

## Alıştırma: depo ve sınav kâğıdı

İlk alıştırmada `iter_mut()` ile elemanları **yerinde** değiştireceksin. Desen eşleştirmenin (Modül 7)
referanslarla nasıl birleştiğine dikkat et.

```exercise
id: m14-e-stok-guncelle
title: Depo stok güncellemesi
difficulty: 2
prompt: |
  Bir deponun stoğu `(ürün adı, adet)` çiftlerinden oluşan bir dilimde tutuluyor.
  `satis_yap(stok, urun, adet)` fonksiyonunu yaz:

  - Ürün bulunur ve stokta **yeterli** adet varsa adedi düş ve `true` döndür.
  - Ürün yoksa ya da stok yetmiyorsa **hiçbir şeyi değiştirme** ve `false` döndür.

  Dilimi `iter_mut()` ile gez. Desen ipucu: `for (ad, miktar) in stok.iter_mut()` yazdığında `ad: &mut String`,
  `miktar: &mut u32` olur.
starter: |
  fn satis_yap(stok: &mut [(String, u32)], urun: &str, adet: u32) -> bool {
      todo!()
  }

  fn main() {
      let mut stok = vec![(String::from("çay"), 10), (String::from("şeker"), 3)];
      println!("{}", satis_yap(&mut stok, "çay", 4));
      println!("{stok:?}");
  }
solution: |
  fn satis_yap(stok: &mut [(String, u32)], urun: &str, adet: u32) -> bool {
      for (ad, miktar) in stok.iter_mut() {
          if ad == urun {
              if *miktar >= adet {
                  *miktar -= adet;
                  return true;
              }
              return false;
          }
      }
      false
  }

  fn main() {
      let mut stok = vec![(String::from("çay"), 10), (String::from("şeker"), 3)];
      println!("{}", satis_yap(&mut stok, "çay", 4));
      println!("{stok:?}");
  }
check: tests
tests: |
  fn ornek_stok() -> Vec<(String, u32)> {
      vec![(String::from("çay"), 10), (String::from("şeker"), 3), (String::from("un"), 0)]
  }

  #[test]
  fn yeterli_stok_dusulur() {
      let mut s = ornek_stok();
      assert!(satis_yap(&mut s, "çay", 4), "10 çaydan 4'ü satılabilmeli");
      assert_eq!(s[0].1, 6, "çay stoğu 6'ya düşmeli");
      assert_eq!(s[1].1, 3, "diğer ürünlere dokunulmamalı");
  }

  #[test]
  fn tam_stok_satilabilir() {
      let mut s = ornek_stok();
      assert!(satis_yap(&mut s, "şeker", 3), "stoktaki son 3 şeker satılabilmeli");
      assert_eq!(s[1].1, 0);
  }

  #[test]
  fn yetersiz_stok_degistirmez() {
      let mut s = ornek_stok();
      assert!(!satis_yap(&mut s, "şeker", 5), "3 şeker varken 5 satılamaz");
      assert_eq!(s, ornek_stok(), "başarısız satış stoğu değiştirmemeli");
  }

  #[test]
  fn olmayan_urun() {
      let mut s = ornek_stok();
      assert!(!satis_yap(&mut s, "pirinç", 1), "depoda olmayan ürün satılamaz");
      assert_eq!(s, ornek_stok());
  }
hints:
  - "`for (ad, miktar) in stok.iter_mut()` ile her çifte değiştirilebilir referans al. `ad == urun` ile `&mut String` ve `&str` karşılaştırılabilir."
  - "Ürünü bulduğunda iki durum var: yeterli adet (`*miktar >= adet`) → düş ve `return true`; değilse `return false`."
  - "Döngü bittiyse ürün hiç bulunmamıştır: fonksiyonun son ifadesi `false` olmalı. Değeri değiştirmek için `*miktar -= adet;` yaz."
require:
  - pattern: "iter_mut\\(\\)|&mut \\*?stok|in stok"
    message: "Dilimi `iter_mut()` (veya `for ... in stok`) ile gez."
explanation: |
  `iter_mut()` her eleman için bir `&mut (String, u32)` verir; `(ad, miktar)` deseni bunu iki ayrı
  değiştirilebilir referansa böler (Modül 7'deki desen eşleştirme referanslarla da çalışır). Değeri
  değiştirmek için `*miktar -= adet` ile referansın arkasına yazarız.

  `return` ile erken çıkmak burada en okunaklı çözüm. Bir sonraki derslerde göreceğin `find` ile de
  yazılabilir: `if let Some((_, m)) = stok.iter_mut().find(|(ad, _)| ad == urun) { ... }`.

  Ödünç alma kuralları sayesinde bu fonksiyon çalışırken başka hiçbir kod `stok`'u okuyamaz ya da
  değiştiremez; "yarım güncellenmiş stok" gibi bir durum gözlemlenemez.
```

İkinci alıştırmada `next()`'in güzel bir özelliğini kullanacaksın: bir iterator'dan birkaç eleman elle
aldıktan sonra, **geri kalanını** `for` ile gezmeye devam edebilirsin — ayraç kaldığı yerden devam eder.

```exercise
id: m14-e-sinav-kagidi
title: Optik okuyucu
difficulty: 3
prompt: |
  Bir optik okuyucu her sınav kâğıdını sayılar dizisi olarak veriyor: **ilk sayı öğrenci numarası**,
  geri kalanlar soru puanları. `kagidi_oku(veri: &[u32]) -> Option<(u32, u32)>` fonksiyonu
  `(öğrenci numarası, toplam puan)` döndürsün.

  - Veri boşsa `None` döndür.
  - Sadece numara varsa (hiç puan yoksa) toplam 0'dır.

  **İndeks (`veri[0]`) kullanmadan** çöz: bir iterator al, numarayı `next()` ile çek, kalanları aynı
  iterator üzerinde `for` ile topla. Modül 10'daki `?`'nın `Option` ile de çalıştığını hatırla.
starter: |
  fn kagidi_oku(veri: &[u32]) -> Option<(u32, u32)> {
      todo!()
  }

  fn main() {
      println!("{:?}", kagidi_oku(&[2024017, 10, 15, 20]));
      println!("{:?}", kagidi_oku(&[]));
  }
solution: |
  fn kagidi_oku(veri: &[u32]) -> Option<(u32, u32)> {
      let mut it = veri.iter();
      let numara = *it.next()?;
      let mut toplam = 0;
      for puan in it {
          toplam += puan;
      }
      Some((numara, toplam))
  }

  fn main() {
      println!("{:?}", kagidi_oku(&[2024017, 10, 15, 20]));
      println!("{:?}", kagidi_oku(&[]));
  }
check: tests
tests: |
  #[test]
  fn numara_ve_toplam() {
      assert_eq!(kagidi_oku(&[2024017, 10, 15, 20]), Some((2024017, 45)), "numara 2024017, puanlar 10+15+20");
  }

  #[test]
  fn ilk_sayi_toplama_katilmaz() {
      assert_eq!(kagidi_oku(&[7, 1]), Some((7, 1)), "öğrenci numarası puan toplamına eklenmemeli");
  }

  #[test]
  fn bos_veri() {
      assert_eq!(kagidi_oku(&[]), None, "boş kâğıt için None dönmeli");
  }

  #[test]
  fn sadece_numara() {
      assert_eq!(kagidi_oku(&[99]), Some((99, 0)), "puan yoksa toplam 0");
  }
hints:
  - "`let mut it = veri.iter();` sonra `it.next()` bir `Option<&u32>` verir. Boşsa `None` olur."
  - "`let numara = *it.next()?;` — `?` `None` ise fonksiyondan hemen `None` döndürür; `*` ise `&u32`'yi `u32`'ye çevirir."
  - "Numarayı aldıktan sonra `for puan in it { toplam += puan; }` kalan elemanları gezer: `it` zaten bir iterator, `for` onu kaldığı yerden sürdürür."
forbid:
  - pattern: "veri\\s*\\["
    message: "Bu alıştırmada indeks kullanmadan, iterator'ı `next()` ile ilerleterek çöz."
require:
  - pattern: "\\.next\\(\\)"
    message: "Öğrenci numarasını `next()` ile al."
explanation: |
  Çözüm iterator'ın bir **durum** taşıdığını gösteriyor: `next()` ilk elemanı tüketti, `for puan in it`
  ise `IntoIterator::into_iter(it)` çağırır — bir iterator'ın `into_iter`'i kendisini döndürür — ve kalan
  elemanlardan devam eder. Numara iki kez sayılmaz.

  `*it.next()?` küçük ama yoğun bir ifade: `next()` → `Option<&u32>`, `?` → `None` ise erken dönüş, değilse
  `&u32`, `*` → `u32`. `toplam += puan` satırında `puan` bir `&u32`'dir; `u32 += &u32` standart kütüphanede
  tanımlı olduğu için ayrıca `*` gerekmez.

  Bir sonraki derslerde kalan kısmı tek satırda yazmayı öğreneceksin: `let toplam: u32 = it.sum();`.
```

## Özet

:::remember
- `Iterator` trait'i: `type Item;` + `fn next(&mut self) -> Option<Self::Item>`. Gerisi (70+ metot) bedava gelir.
- `next` iterator'ı değiştirir → iterator değişkeni `mut` olmalı (koleksiyon değil).
- Iterator'lar **tembeldir**: oluşturmak iş yapmaz, biri `next()` diyene kadar hiçbir şey olmaz.
- `for x in k` = `let mut it = k.into_iter(); while let Some(x) = it.next() { ... }`.
- `iter()` → `&T` · `iter_mut()` → `&mut T` · `into_iter()` → `T` (koleksiyonu tüketir).
- `for x in &v` = `v.iter()`, `for x in &mut v` = `v.iter_mut()`, `for x in v` = `v.into_iter()`.
- Gezerken koleksiyonu değiştirmek E0502 verir: iterator geçersizleşmesi derleme anında engellenir.
:::

```reflect
prompt: |
  C++'ta bir vektörü gezerken ona eleman eklemek tanımsız davranışa yol açabilir. Rust'ta aynı kodu yazdığında
  neden derleme hatası alırsın? Iterator'ın vektörle ilişkisini ödünç alma kuralları üzerinden anlat.
answer: |
  `for x in &v` döngüsü, döngü boyunca yaşayan bir iterator oluşturur ve bu iterator `v`'yi `&` ile ödünç
  alır (içinde vektörün elemanlarını gösteren bir konum tutar). Döngünün içinde `v.push(...)` çağırmak
  `&mut v` gerektirir. Rust'ın "aynı anda ya tek bir `&mut` ya da istediğin kadar `&`" kuralı bu iki ödüncün
  çakışmasına izin vermez ve E0502 verir. C++'ta `push_back` belleği yeniden ayırıp iterator'ı sarkan bir
  işaretçiye çevirebilirdi; Rust'ta bu durum hiç oluşamaz, çünkü kod derlenmez.
```

```flashcards
- front: "`Iterator` trait'inin tek zorunlu metodunun imzası nedir?"
  back: "`fn next(&mut self) -> Option<Self::Item>`"
- front: "`let it = v.iter(); it.next();` neden derlenmez?"
  back: "`next` `&mut self` alır (iterator'ın konumu değişir); `it` `mut` olmalı (E0596). `v`'nin `mut` olması gerekmez."
- front: "`for x in koleksiyon { ... }` derleyici tarafından neye çevrilir?"
  back: "`let mut it = IntoIterator::into_iter(koleksiyon); while let Some(x) = it.next() { ... }`"
- front: "`Vec<T>` için `iter()`, `iter_mut()`, `into_iter()` sırasıyla hangi tipte öğe verir?"
  back: "`&T`, `&mut T`, `T` (son ikisinden `into_iter` vektörü tüketir)."
- front: "`for isim in isimler { }` sonrasında `isimler.len()` neden E0382 verir?"
  back: "`for` `into_iter(self)` çağırır ve vektörün sahipliğini alır. Çözüm: `for isim in &isimler`."
- front: "\"Iterator'lar tembeldir\" ne demektir?"
  back: Oluşturulduklarında iş yapmazlar; her eleman ancak biri `next()` çağırdığında (bir tüketici tarafından) hesaplanır.
- front: Rust iterator geçersizleşmesini (gezerken koleksiyonu değiştirme) nasıl engeller?
  back: "Iterator koleksiyonu `&` ile ödünç alır; döngü içinde `&mut` isteyen işlem E0502 verir. Ödünç alma kuralları yeterlidir."
```
