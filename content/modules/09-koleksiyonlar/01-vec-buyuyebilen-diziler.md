---
id: m09-l01
title: Vec — büyüyebilen diziler
minutes: 25
type: lesson
objectives:
  - "`Vec` oluşturup `push`, `pop`, indeksleme ve `get` ile eleman ekleyip güvenle okuyabilmek"
  - "Bir vektörü `&v`, `&mut v` ve `v` ile dolaşmanın sahiplik açısından farkını açıklayabilmek"
  - Referans tutarken `push` yapmanın neden E0502 verdiğini yeniden tahsis (reallocation) üzerinden açıklayabilmek
  - "`len` ile `capacity` farkını açıklayıp `with_capacity`'yi doğru yerde kullanabilmek"
keywords: [Vec, vektör, push, pop, get, capacity, with_capacity, E0502, E0507]
---

Modül 2'de **dizileri (array)** öğrendin: `[i32; 5]` tam beş eleman tutar — ne bir eksik ne bir fazla — ve
bu sayının derleme zamanında bilinmesi gerekir. Ama gerçek hayattaki listelerin çoğunun boyunu önceden
bilemezsin: Market sepetine kaç ürün atılacak? Sınıfa kaç öğrenci kaydolacak? Oyunda kaç düşman doğacak?

Bu derste Rust'ın en çok kullanılan koleksiyonunu, çalışma zamanında büyüyüp küçülebilen **`Vec<T>`**'yi
(vektör) kaputunu açarak öğreneceksin. Modül 4'ten beri `vec![]` ve `push`'u "önizleme" olarak
kullanıyordun; şimdi bellekte gerçekte ne olduğunu ve borrow checker'ın vektörlerde seni hangi **gerçek**
hatalardan koruduğunu göreceksin.

:::ferris
Bu derste borrow checker'ın "neden" bu kadar titiz olduğunu bir bellek diyagramında kendi gözünle
göreceksin. O andan sonra E0502 hatası sana bir engel değil, bir hayat kurtarıcı gibi görünecek! 🦀
:::

## Vektör oluşturmak ve büyütmek

**Vektör (vector)**, aynı tipten değerleri bellekte **yan yana** tutan, büyüyebilen bir listedir. Tipi
`Vec<T>` diye yazılır: açılı parantezdeki `T`, "eleman tipi" için bir yer tutucudur. `Vec<i32>`
tamsayılardan, `Vec<String>` metinlerden oluşan bir vektördür. (Bu `<...>` yazımını `Option<T>`'den
tanıyorsun; adı **generic**'tir ve Modül 11'de kendi generic tiplerini yazacaksın.)

Vektör oluşturmanın üç yaygın yolu var:

```rust
fn main() {
    // 1) Boş vektör + push. Eleman tipi ilk push'tan çıkarılır: Vec<&str>
    let mut sepet = Vec::new();
    sepet.push("ekmek");
    sepet.push("süt");
    sepet.push("peynir");
    println!("Sepet: {sepet:?} ({} ürün)", sepet.len());

    // 2) vec! makrosu: başlangıç elemanlarıyla
    let fiyatlar = vec![15, 42, 180];
    println!("Fiyatlar: {fiyatlar:?}");

    // 3) [değer; adet] biçimi: aynı değerden n tane (dizilerdeki gibi)
    let puanlar = vec![0; 5];
    println!("Puanlar: {puanlar:?}");

    // pop: SONDAKİ elemanı çıkarır ve Option döndürür
    let son = sepet.pop();
    println!("Çıkarılan: {son:?}, kalan: {sepet:?}");
    println!("Sepet boş mu? {}", sepet.is_empty());
}
```

Birkaç önemli nokta:

- `push` ve `pop` vektörü **değiştirir**; bu yüzden değişken `let mut` ile tanımlanmalıdır. Unutursan
  derleyici `E0596: cannot borrow as mutable` der ve `mut` eklemeni önerir.
- `Vec::new()` yazıp hiç eleman eklemezsen derleyici eleman tipini çıkaramaz (`E0282: type annotations
  needed`). O zaman tipi sen söylersin: `let mut v: Vec<i32> = Vec::new();`
- `pop` neden doğrudan `T` değil de `Option<T>` döndürüyor? Çünkü vektör **boş olabilir**. C++'ta boş bir
  `std::vector` üzerinde `pop_back()` çağırmak tanımsız davranıştır (undefined behavior); Python'da
  `list.pop()` bir `IndexError` fırlatır. Rust'ta cevap `None`'dır: "çıkaracak bir şey yoktu." Modül 7'den
  hatırla: `Option`, bu durumu **unutmanı imkânsız** kılar.

Sık kullanacağın diğer metotlar:

| Metot | Ne yapar? |
|---|---|
| `v.len()` / `v.is_empty()` | eleman sayısı / boş mu? |
| `v.insert(i, x)` | `i` konumuna ekler, sonrakileri bir sağa **kaydırır** (O(n); `i > len` ise panik) |
| `v.remove(i)` | `i` konumundakini çıkarıp döndürür, sonrakileri bir sola kaydırır (O(n); sınır dışıysa panik) |
| `v.swap_remove(i)` | `i`'yi çıkarır, yerine **son** elemanı koyar (kaydırma yok, O(1), ama sıra bozulur) |
| `v.clear()` / `v.truncate(n)` | hepsini siler / ilk `n` tanesini bırakır (ayrılmış bellek, yani kapasite, **aynen kalır**) |
| `v.extend_from_slice(&[..])` | bir dilimdeki elemanları sona kopyalar (`clone`'lar) |

```predict
question: Bu program ne yazdırır?
code: |
  fn main() {
      let mut yigin = vec![10, 20];
      yigin.push(30);
      let a = yigin.pop();
      let b = yigin.pop();
      yigin.push(40);
      println!("{a:?} {b:?} {yigin:?}");
  }
options:
  - "Some(30) Some(20) [10, 40]"
  - "Some(10) Some(20) [30, 40]"
  - "30 20 [10, 40]"
  - "Some(30) Some(20) [40, 10]"
answer: 0
explanation: |
  `push` sona ekler, `pop` **sondan** çıkarır: son giren ilk çıkar. Bu davranışa **LIFO** (last in, first
  out — son giren ilk çıkar) denir; vektörü bir **yığın (stack)** gibi kullanmış olduk.
  `[10, 20, 30]` → `pop` → `Some(30)` → `pop` → `Some(20)` → kalan `[10]` → `push(40)` → `[10, 40]`.
  `pop` bir `Option<i32>` döndürdüğü için `{a:?}` çıktısı `30` değil `Some(30)` olur.
```

## Elemanlara erişmek — `v[i]` mi, `get(i)` mi?

Bir vektörün elemanını okumanın iki yolu var ve aralarındaki fark, programının **bir şeyler ters gittiğinde**
nasıl davranacağını belirler:

```rust
fn main() {
    let notlar: Vec<i32> = vec![85, 92, 78];

    // 1) İndeksleme: doğrudan eleman (i32 Copy olduğu için kopyalanır)
    let ikinci = notlar[1];
    println!("İkinci not: {ikinci}");

    // 2) get: Option<&T> döndürür; sınır dışında None
    match notlar.get(5) {
        Some(not) => println!("Altıncı not: {not}"),
        None => println!("Altıncı öğrenci yok!"),
    }

    // first / last da Option<&T> döndürür (vektör boş olabilir)
    if let Some(son) = notlar.last() {
        println!("Son not: {son}");
    }
}
```

Peki sınırın dışına `[]` ile uzansaydık? Program derlenir ama çalışırken **panikler** (panic), yani kontrollü
biçimde durur:

```rust,should_panic
fn main() {
    let notlar: Vec<i32> = vec![85, 92, 78];
    let onuncu = notlar[10];
    println!("{onuncu}");
}
```

:::error
```text
thread 'main' (14) panicked at src/main.rs:3:24:
index out of bounds: the len is 3 but the index is 10
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Mesaj her şeyi söylüyor: vektörün uzunluğu (`len`) 3, sen ise 10 numaralı indeksi istedin.
`src/main.rs:3:24` paniğin yerini (3. satır, 24. sütun) gösterir. Paniği Modül 10'da ayrıntılı göreceğiz.
:::

Diğer dillerle karşılaştır:

| Dil | Sınır dışı okuma |
|---|---|
| C / C++ (`arr[10]`) | **Tanımsız davranış**: çöp değer okunur, program çöker ya da sessizce yanlış çalışır. 2014'teki ünlü *Heartbleed* güvenlik açığı tam da böyle bir sınır dışı okumaydı. |
| Python | `IndexError` istisnası |
| Java | `ArrayIndexOutOfBoundsException` |
| JavaScript | Sessizce `undefined` döner; hata ileride bambaşka bir yerde patlar |
| Rust | `v[i]` → kontrollü panik, `v.get(i)` → `None` |

Rust her indekslemede sınırı kontrol eder, bu yüzden bellek güvenliği **asla** bozulmaz. (Endişelenme:
optimize derlemelerde derleyici, gereksiz olduğunu kanıtlayabildiği kontrolleri zaten kaldırır.)

**Hangisini ne zaman?** Sınır dışı bir indeks programında bir **hata (bug)** anlamına geliyorsa `v[i]`
kullan; panik, hatayı erkenden ve yüksek sesle yakalar. Elemanın olmaması **normal bir ihtimalse**
(kullanıcı girdisi, arama sonucu) `get` kullan ve `None` durumunu ele al.

```compiles
code: |
  fn main() {
      let isimler = vec![String::from("Ayşe"), String::from("Mehmet")];
      let ilk = isimler[0];
      println!("{ilk}");
  }
answer: false
error: E0507
explanation: |
  `isimler[0]` vektörün **içindeki** `String`'i belirtir; `let ilk = ...` ise onu dışarı **taşımaya**
  çalışır. Ama o `String`'in sahibi hâlâ vektör! Taşımaya izin verilseydi vektörde geçersiz bir "delik"
  kalırdı ve kapsam sonunda vektör o `String`'i bir kez daha serbest bırakmaya çalışırdı (double free).
  Derleyici: `cannot move out of index of Vec<String>`.

  Yukarıdaki örnekte `let ikinci = notlar[1];` çalışmıştı, çünkü `i32` bir `Copy` tipidir: değer
  kopyalanır, taşınmaz (Modül 4). `String` ise `Copy` değildir. Çözümler:

  - Ödünç al: `let ilk = &isimler[0];`
  - Bilinçli kopyala: `let ilk = isimler[0].clone();`
  - Elemanı vektörden gerçekten çıkar: `isimler.remove(0)` (sondaki eleman içinse `isimler.pop()`);
    ikisi de vektörü değiştirdiği için `let mut isimler` gerekir
```

```quiz
question: |
  Kütüphane uygulamanda kullanıcı, görmek istediği kitabın sıra numarasını **kendisi yazıyor**
  (`n: usize`). Kitabı `kitaplar` vektöründen okumanın en doğru yolu hangisi?
options:
  - "`kitaplar[n]` — kısa ve hızlı"
  - "`kitaplar.get(n)` ile `Option` almak ve `None` durumunda \"böyle bir kitap yok\" demek"
  - "Önce `kitaplar[n]` dene; panik olursa programı yeniden başlat"
answer: 1
explanation: |
  Kullanıcı girdisi **her zaman** yanlış olabilir; bu bir bug değil, beklenen bir durum. `get` sana bir
  `Option<&Kitap>` verir ve `match` / `if let` ile iki durumu da ele almaya zorlar. `kitaplar[n]` ise
  kullanıcı 999 yazdığında tüm programı durdurur.
feedback:
  - "Kısa ama kullanıcı 999 yazarsa program panikler. Sınır dışı indeks burada **beklenen** bir durum."
  - "Doğru! Olmayabilecek bir elemanı `get` ile iste, `None`'ı ele al."
  - "Panik bir hata yönetimi stratejisi değildir; olası bir durumu `Option` ile önceden ele almak gerekir."
```

## Vektörü dolaşmak — `&v`, `&mut v` ve `v`

Bir vektörü `for` ile dolaşmanın üç yolu var. Bunlar, Modül 4-5'te bir değeri fonksiyona vermenin üç
yoluyla **birebir aynıdır**: ödünç vermek, değiştirilebilir ödünç vermek, sahipliği devretmek.

| Yazım | `x`'in tipi | Vektöre ne olur? |
|---|---|---|
| `for x in &v` (ya da `v.iter()`) | `&T` | Sadece okunur; döngüden sonra `v` kullanılabilir |
| `for x in &mut v` | `&mut T` | Elemanlar **yerinde** değiştirilebilir (`*x = ...`) |
| `for x in v` | `T` | Vektör **tüketilir** (taşınır); döngüden sonra kullanılamaz |

```rust
fn main() {
    let mut fiyatlar = vec![100, 250, 40];

    // 1) Okumak: her eleman bir &i32
    let mut toplam = 0;
    for fiyat in &fiyatlar {
        toplam += *fiyat; // * ile referansın gösterdiği değere ulaş (Modül 5)
    }
    println!("Toplam: {toplam} TL");

    // 2) Değiştirmek: her eleman bir &mut i32
    for fiyat in &mut fiyatlar {
        *fiyat += 10;
    }
    println!("Zamlı: {fiyatlar:?}");

    // 3) Sıra numarasıyla: .iter().enumerate() → (indeks, eleman) çiftleri
    for (i, fiyat) in fiyatlar.iter().enumerate() {
        println!("{}. ürün: {fiyat} TL", i + 1);
    }

    // 4) Tüketmek: fiyatlar döngüye taşınır, sonra kullanılamaz
    for fiyat in fiyatlar {
        println!("Kasada: {fiyat}");
    }
}
```

`.iter()` ve `.enumerate()` birer **iterator** metodudur; iterator'ları Modül 14'te derinlemesine
göreceğiz. Şimdilik kalıbı bilmen yeter: `for (i, x) in v.iter().enumerate()` sana hem sırayı hem elemanı
verir. Bir de küçük bir kısayol: `Copy` tiplerde `for &fiyat in &fiyatlar` yazarsan `&fiyat` **deseni**
referansı açar ve `fiyat` doğrudan `i32` olur; `*` yazmana gerek kalmaz.

Üçüncü yolun tuzağına dikkat — bu, Modül 4'teki taşıma (move) kuralının ta kendisi:

```rust,compile_fail,E0382
fn main() {
    let sehirler = vec![String::from("Rize"), String::from("Van")];
    for sehir in sehirler {
        println!("{sehir}");
    }
    println!("{} şehir yazdırıldı", sehirler.len());
}
```

:::error
```text
error[E0382]: borrow of moved value: `sehirler`
 --> src/main.rs:6:37
  |
2 |     let sehirler = vec![String::from("Rize"), String::from("Van")];
  |         -------- move occurs because `sehirler` has type `Vec<String>`, which does not implement the `Copy` trait
3 |     for sehir in sehirler {
  |                  -------- `sehirler` moved due to this implicit call to `.into_iter()`
...
6 |     println!("{} şehir yazdırıldı", sehirler.len());
  |                                     ^^^^^^^^ value borrowed here after move
  |
help: consider iterating over a slice of the `Vec<String>`'s content to avoid moving into the `for` loop
  |
3 |     for sehir in &sehirler {
  |                  +
```
Derleyici hem nedeni (`for` döngüsü gizlice `.into_iter()` çağırıp sahipliği alıyor) hem de çözümü
(`&sehirler`) söylüyor. Kural basit: **sonra kullanacaksan ödünç ver.**
:::

```fill
prompt: Her öğrencinin notuna 5 puan **bonus** ekle — vektörü yerinde değiştirerek.
code: |
  fn main() {
      let mut notlar = vec![70, 85, 60];
      for not in ___0 notlar {
          ___1 += 5;
      }
      println!("{notlar:?}");
  }
blanks:
  - ["&mut"]
  - ["*not"]
output: "[75, 90, 65]"
explanation: |
  Elemanları değiştirmek için **değiştirilebilir ödünç** gerekir: `&mut notlar`. Döngü değişkeni `not`
  bu durumda bir `&mut i32`'dir; gösterdiği değere ulaşmak için `*not` yazarız. `not += 5` yazsaydın
  derleyici bir referansa sayı eklenemeyeceğini söylerdi (`E0368`).
```

```exercise
id: m09-e-baraj
title: Barajı geçenler
difficulty: 2
prompt: |
  Üniversite sınavında bir bölüme başvurabilmek için **baraj puanını** geçmek gerekiyor.
  `baraji_gecenler` fonksiyonu adayların puanlarını ve baraj puanını alsın; puanı baraja **eşit veya
  büyük** olanları, **orijinal sıralarını koruyarak** yeni bir vektörde döndürsün.

  Orijinal liste değişmemeli; bu yüzden parametre `&[u32]` (bir dilim) olarak alınıyor. Modül 5'teki
  `&str` kuralının aynısı: `&Vec<u32>` otomatik olarak `&[u32]`'ye dönüşür, böylece fonksiyonun hem
  vektörlerle hem dizilerle çalışır.
starter: |
  fn baraji_gecenler(puanlar: &[u32], baraj: u32) -> Vec<u32> {
      todo!()
  }

  fn main() {
      let puanlar = vec![320, 180, 455, 150, 275];
      let gecenler = baraji_gecenler(&puanlar, 200);
      println!("Barajı geçenler: {gecenler:?}");
      println!("Tüm puanlar hâlâ burada: {puanlar:?}");
  }
solution: |
  fn baraji_gecenler(puanlar: &[u32], baraj: u32) -> Vec<u32> {
      let mut gecenler = Vec::new();
      for &puan in puanlar {
          if puan >= baraj {
              gecenler.push(puan);
          }
      }
      gecenler
  }

  fn main() {
      let puanlar = vec![320, 180, 455, 150, 275];
      let gecenler = baraji_gecenler(&puanlar, 200);
      println!("Barajı geçenler: {gecenler:?}");
      println!("Tüm puanlar hâlâ burada: {puanlar:?}");
  }
check: tests
tests: |
  #[test]
  fn sirayi_koruyarak_secer() {
      let sonuc = baraji_gecenler(&[320, 180, 455, 150, 275], 200);
      assert_eq!(sonuc, vec![320, 455, 275], "barajı geçenler geliş sırasıyla dönmeli");
  }

  #[test]
  fn baraja_esit_puan_gecer() {
      assert_eq!(baraji_gecenler(&[200, 199, 201], 200), vec![200, 201], "baraja eşit olan puan da geçer (>=)");
  }

  #[test]
  fn kimse_gecemezse_bos_vektor() {
      assert_eq!(baraji_gecenler(&[10, 20, 30], 100), Vec::<u32>::new(), "kimse geçemezse boş vektör dönmeli");
  }

  #[test]
  fn bos_liste() {
      assert!(baraji_gecenler(&[], 50).is_empty(), "aday yoksa sonuç da boş olmalı");
  }
hints:
  - "Önce sonuçları toplayacağın boş ve değiştirilebilir bir vektör oluştur: `let mut gecenler = Vec::new();`"
  - "Puanları `for &puan in puanlar` ile dolaş; `&puan` deseni sayesinde `puan` doğrudan bir `u32` olur. Koşul sağlanınca `push` et."
  - "Döngüden sonra fonksiyonun son satırı noktalı virgülsüz `gecenler` olmalı; böylece vektörün sahipliği çağırana geçer."
explanation: |
  Fonksiyon girdiyi sadece **okuduğu** için ödünç alıyor (`&[u32]`) ve sonuç için **yeni** bir vektör
  oluşturup sahipliğini çağırana veriyor. Orijinal `puanlar` vektörü bu yüzden `main`'de kullanılmaya devam
  edebiliyor.

  `for &puan in puanlar` yerine `for puan in puanlar` yazıp `*puan >= baraj` ve `gecenler.push(*puan)`
  diyebilirdin; ikisi de aynı işi yapar.

  Bu "bir listeden koşula uyanları yeni listeye topla" kalıbı o kadar yaygındır ki Rust'ta tek satırlık bir
  kısayolu vardır: `puanlar.iter().filter(...).collect()`. Bunu Modül 14'te iterator'larla öğreneceksin;
  önce döngüyle elle yazmak, o kısayolun **ne yaptığını** anlamanı sağlar.
```

## Kaputun altı — `len`, `capacity` ve yeniden tahsis

Bir `Vec` aslında üç küçük parçadan oluşur ve bu parçalar **stack'te** durur: heap'teki elemanlara bir
**işaretçi (pointer)**, eleman sayısı olan **uzunluk (len)** ve heap'te ayrılmış yerin kaç eleman
alabildiğini gösteren **kapasite (capacity)**. Tanıdık geldi mi? `String` de tam olarak böyledir — çünkü
`String` aslında içi UTF-8 baytlarla dolu bir `Vec<u8>`'dir!

Uzunluk kapasiteye ulaştığında ve sen bir `push` daha yaptığında, vektör **yeniden tahsis
(reallocation)** yapar. Adım adım izle:

```memory
title: push ve yeniden tahsis (reallocation)
steps:
  - caption: "`Vec::with_capacity(4)` ve üç `push` sonrası: stack'te işaretçi + uzunluk + kapasite, heap'te 4 elemanlık yer (biri boş)."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=3 · cap=4", to: h1, mut: true }
    heap:
      - { id: h1, value: "10 | 20 | 30 | _", label: "kapasite 4" }
  - caption: "4. `push(40)`: boş yer vardı, eleman sona yazıldı. Artık `len == cap`, vektör dolu."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4", to: h1, mut: true }
    heap:
      - { id: h1, value: "10 | 20 | 30 | 40", label: "kapasite 4" }
  - caption: "5. `push(50)`: yer yok! Rust iki kat büyük **yeni** bir alan ayırır, eski elemanları oraya kopyalar, yenisini ekler ve **eski alanı serbest bırakır**. İşaretçi artık yeni adresi gösterir."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=5 · cap=8", to: h2, mut: true }
    heap:
      - { id: h1, value: "10 | 20 | 30 | 40", label: "serbest bırakıldı", freed: true }
      - { id: h2, value: "10 | 20 | 30 | 40 | 50 | _ | _ | _", label: "kapasite 8" }
```

Kendin de gözlemleyebilirsin:

```rust
fn main() {
    let mut v: Vec<i32> = Vec::new();
    println!("başta: len={} cap={}", v.len(), v.capacity());
    for i in 1..=9 {
        v.push(i);
        println!("push({i}) → len={} cap={}", v.len(), v.capacity());
    }

    // Kaç eleman geleceğini biliyorsan yeri baştan ayır:
    let mut hazir: Vec<i32> = Vec::with_capacity(1000);
    println!("with_capacity: len={} cap={}", hazir.len(), hazir.capacity());
    for i in 0..1000 {
        hazir.push(i); // hiç yeniden tahsis olmaz
    }
    println!("1000 push sonrası: len={} cap={}", hazir.len(), hazir.capacity());
}
```

Çıktıda iki şey göreceksin. Birincisi, `Vec::new()` **hiç bellek ayırmaz** (`cap=0`); ilk tahsis ilk
`push`'ta yapılır, yani boş bir vektör oluşturmak bedavadır. İkincisi, kapasite `0 → 4 → 8 → 16` diye
**ikiye katlanarak** büyür. (Tam sayılar standart kütüphanenin bugünkü tercihi; belgeler belirli bir
büyüme stratejisini garanti etmez. Garanti edilen şey, `push`'un **ortalamada** sabit sürede
çalışmasıdır.) Neden her seferinde bir eleman büyütmüyor? Çünkü bir yeniden tahsis, en kötü durumda
**tüm** elemanları kopyalar. Bir bir büyüseydi 1000 `push` yaklaşık 500.000 eleman kopyalardı; ikiye katlayınca toplam
kopya sayısı 2000'in altında kalır. Bu yüzden `push` **amortize (ortalama) O(1)** sayılır: arada bir
pahalı, ama ortalamada ucuz.

:::analogy Kalabalıklaşan aile
Büyüyen bir aile, her yeni bebekte değil, **ev dolduğunda** iki kat büyük bir eve taşınır. Taşınmak
yorucudur (tüm eşyalar tek tek yeni eve kopyalanır) ama seyrek olur. Bir de önemli bir ayrıntı var:
taşınmadan sonra **eski adres geçersizdir**. Eski adrese mektup gönderen kişi, boş bir eve yazar...
Bu ayrıntı, bir sonraki adımın konusu.
:::

Diyagram bir **basitleştirme** içeriyor: gerçekte vektör büyürken bellek ayırıcıdan (allocator) eski
bloğu genişletmesini ister (`realloc`). Ayırıcı bazen bloğu **yerinde** büyütebilir; o zaman elemanlar
hiç kopyalanmaz ve adres değişmez. Ama bunun hiçbir garantisi yoktur. Bu yüzden hem sen hem derleyici
her yeniden tahsiste **adresin değişebileceğini** varsaymak zorundasınız.

Yer ayırmayla ilgili üç araç:

- `Vec::with_capacity(n)`: en az `n` eleman için yeri baştan ayırır. Eleman sayısını kabaca biliyorsan
  kullan (ör. 10.000 satırlık bir dosyayı okurken).
- `v.reserve(n)`: mevcut vektörde en az `n` ek eleman için yer açar.
- `v.shrink_to_fit()`: kullanılmayan kapasiteyi mümkün olduğunca geri verir (artık büyümeyecek dev bir
  vektörde). `clear`, `truncate`, `pop` ve `remove` ise kapasiteye **dokunmaz**; bellek kendiliğinden
  geri verilmez.

```quiz
question: "`let mut v: Vec<u8> = Vec::with_capacity(10);` satırından hemen sonra `v[0] = 1;` yazarsan ne olur?"
options:
  - "Çalışır; 10 elemanlık yer ayrıldığı için ilk eleman 1 olur"
  - "Panik: `len` hâlâ 0'dır; kapasite sadece ayrılmış **boş yer**, eleman değil"
  - "Derlenmez: `with_capacity` ile oluşturulan vektöre indeksle yazılamaz"
answer: 1
explanation: |
  `with_capacity` yer **ayırır** ama eleman **eklemez**: `len` 0, `capacity` 10'dur. İndeksleme `len`'e
  göre kontrol edilir; bu yüzden `v[0]` şu panikle durur: `index out of bounds: the len is 0 but the index
  is 0`. Eleman eklemek için `push` kullanmalısın. Önceden doldurulmuş bir vektör istiyorsan
  `vec![0; 10]` yaz: bu durumda `len` de 10 olur.
feedback:
  - "Kapasite elemanların **sığacağı** yerdir; o yerlerde henüz geçerli bir eleman yok."
  - "Doğru! `len` ve `capacity` ayrı kavramlar."
  - "Derleyici bu durumu yakalamaz; vektörün uzunluğu çalışma zamanında belli olur."
```

## Borrow checker ve vektörler — E0502'nin asıl sebebi

Şimdi Modül 5'teki ödünç alma kurallarının vektörlerde neden **hayati** olduğunu göreceğiz. Önce tahmin et:

```compiles
code: |
  fn main() {
      let mut notlar = vec![85, 92, 78];
      let ilk = &notlar[0];
      notlar.push(100);
      println!("İlk not: {ilk}");
  }
answer: false
error: E0502
explanation: |
  `ilk`, vektörün **içindeki** bir elemana işaret eden paylaşımlı bir referans (`&`). `push` ise vektörü
  değiştirmek için `&mut` ödünç alma ister. `ilk` hâlâ kullanılacakken (`println!` satırı) aynı vektörün
  `&mut` ödüncü alınamaz: **ya bir `&mut` ya da istediğin kadar `&`**. Peki bu kural burada neden bu
  kadar önemli? Aşağıdaki diyagram cevabı veriyor.
```

Rust bu programa izin verseydi bellekte şunlar olurdu:

```memory
title: "Rust izin verseydi: sarkan referans (dangling reference)"
steps:
  - caption: "`let ilk = &notlar[0];` — `ilk`, heap'teki ilk elemanın adresini tutuyor. Vektör dolu: `len == cap == 3`."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=3 · cap=3", to: h1, mut: true }
          - { name: ilk, type: "&i32", value: "→ notlar[0]", to: h1 }
    heap:
      - { id: h1, value: "85 | 92 | 78" }
  - caption: "`notlar.push(100)` — yer yok: yeni ve büyük bir alan ayrılır, elemanlar kopyalanır, **eski alan serbest bırakılır**. `ilk` ise hâlâ eski adresi gösteriyor!"
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=4 · cap=6", to: h2, mut: true }
          - { name: ilk, type: "&i32", value: "→ ???", to: h1, note: "sarkan referans!" }
    heap:
      - { id: h1, value: "85 | 92 | 78", label: "serbest bırakıldı", freed: true }
      - { id: h2, value: "85 | 92 | 78 | 100 | _ | _" }
  - caption: "`println!(\"{ilk}\")` artık **serbest bırakılmış** belleği okurdu: buna *use-after-free* denir ve en tehlikeli güvenlik açıklarından biridir. Rust bu programı **derlemeyerek** bu senaryoyu imkânsız kılar."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=4 · cap=6", to: h2, mut: true }
          - { name: ilk, type: "&i32", value: "→ ???", to: h1, note: "okunsaydı: use-after-free" }
    heap:
      - { id: h1, value: "?? | ?? | ??", label: "başka biri kullanıyor olabilir", freed: true }
      - { id: h2, value: "85 | 92 | 78 | 100 | _ | _" }
```

Derleyicinin mesajı bu hikâyeyi üç etiketle anlatır:

:::error
```text
error[E0502]: cannot borrow `notlar` as mutable because it is also borrowed as immutable
 --> src/main.rs:4:5
  |
3 |     let ilk = &notlar[0];
  |                ------ immutable borrow occurs here
4 |     notlar.push(100);
  |     ^^^^^^^^^^^^^^^^ mutable borrow occurs here
5 |     println!("İlk not: {ilk}");
  |                         --- immutable borrow later used here
```
Oku: **1)** paylaşımlı ödünç 3. satırda başladı, **2)** 4. satırda değiştirilebilir ödünç istendi,
**3)** paylaşımlı ödünç 5. satırda hâlâ kullanılıyor. Üçüncü etiket kilit noktadır: `ilk`'i `push`'tan
sonra kullanmasaydın, ödünç orada biterdi (NLL) ve kod derlenirdi.
:::

C++'ta aynı kod **derlenir** ve çoğu zaman "çalışıyor gibi" görünür — ta ki bir gün yeniden tahsis olup
program saçma bir değer yazdırana ya da çökene kadar:

```cpp
std::vector<int> notlar = {85, 92, 78};
int& ilk = notlar[0];
notlar.push_back(100);   // yeniden tahsis olabilir
std::cout << ilk;        // tanımsız davranış: derleyici uyarmaz bile
```

C++ dünyasında bu hata sınıfının bir adı bile var: **iterator invalidation** (geçersizleşen yineleyiciler).
Rust'ta ise bu sınıf, ödünç alma kuralları sayesinde **derleme zamanında** tamamen ortadan kalkar.

Aynı kural, en sık yapılan çeşidini de yakalar: bir vektörü **dolaşırken** ona eleman eklemek. `for x in
&v` döngüsü, döngü boyunca `v`'yi paylaşımlı olarak ödünç alır; içerideki `push` ise `&mut` ister:

```rust,compile_fail,E0502
fn main() {
    let mut notlar = vec![40, 85, 92];
    for not in &notlar {
        if *not < 50 {
            notlar.push(50); // telafi sınavı notu ekle
        }
    }
    println!("{notlar:?}");
}
```

Derleyici burada `this for loop borrows notlar immutably, preventing mutation within its body` der ve
iki çözüm önerir: indeksle dolaşmak ya da eklenecekleri **ayrı bir vektörde toplayıp** döngüden sonra
eklemek. (Java'da aynı kod çalışma zamanında `ConcurrentModificationException` fırlatır, Python'da
sonsuz döngüye girebilir; Rust ise hatayı program hiç çalışmadan yakalar.)

Çözüm yolları:

```rust
fn main() {
    let mut notlar = vec![85, 92, 78];

    // Çözüm 1: Referansı push'tan ÖNCE kullanıp bitir (ödünç son kullanımda biter)
    let ilk = &notlar[0];
    println!("İlk not: {ilk}");
    notlar.push(100); // ilk artık kullanılmıyor → sorun yok

    // Çözüm 2: Copy tiplerde değeri kopyala; ortada ödünç kalmaz
    let ilk_kopya = notlar[0];
    notlar.push(64);
    println!("Kopya: {ilk_kopya}");

    // Çözüm 3: Referans yerine indeksi sakla, ihtiyaç anında yeniden oku
    let ilk_indeks = 0;
    notlar.push(71);
    println!("İndeksle: {}", notlar[ilk_indeks]);
    println!("Tüm notlar: {notlar:?}");
}
```

```quiz
question: |
  Kapasitesi zaten 100 olan (yani `push`'un yeniden tahsis **yapmayacağı**) bir vektörde
  `let r = &v[0]; v.push(1); println!("{r}");` derlenir mi?
options:
  - "Evet; yeniden tahsis olmayacağı için referans güvende"
  - "Hayır; borrow checker kapasiteye bakmaz, `&` yaşarken `&mut` ödünç almayı kural gereği reddeder"
  - "Derlenir ama çalışma zamanında panik olur"
answer: 1
explanation: |
  Borrow checker **derleme zamanında** çalışır; kapasitenin çalışma zamanında kaç olacağını bilemez ve
  bilmeye de çalışmaz. Kural yerel ve basittir: aynı anda **ya bir `&mut` ya da istediğin kadar `&`**.
  Bu sadelik bir özelliktir: kuralı sen de kafanda çalıştırabilirsin ve bir kütüphanenin iç ayrıntısı
  (ör. büyüme stratejisi) değiştiğinde kodun aniden güvensiz hâle gelmez.
feedback:
  - "Mantıklı bir tahmin ama derleyici çalışma zamanındaki kapasiteyi bilemez; kural tiplere ve ödünçlere bakar."
  - "Doğru! Kural kapasiteden bağımsızdır."
  - "Borrow checker hataları derleme hatasıdır; program hiç çalışmaz."
```

## Karışık verileri saklamak — `Vec` ve `enum`

Bir vektörün tüm elemanları **aynı tipte** olmak zorundadır. Bunun teknik bir nedeni var: elemanlar
bellekte yan yana durduğu için `v[i]`'nin adresi basitçe `başlangıç + i × eleman_boyutu` diye hesaplanır.
Bu hesap, her elemanın aynı boyutta olmasına dayanır ve indekslemeyi O(1) (sabit süreli) yapar.

Peki bir tablo satırında metin, tamsayı ve ondalık sayıyı **birlikte** tutmak istersen? Modül 7'den
cevabı biliyorsun: **enum**. Her varyant farklı veri taşıyabilir ama hepsi tek bir tiptir:

```rust
enum Hucre {
    Tamsayi(i64),
    Ondalik(f64),
    Metin(String),
    Bos,
}

fn main() {
    // Bir tablonun (ör. Excel) tek satırı: ad, yaş, not ortalaması, boş hücre
    let satir = vec![
        Hucre::Metin(String::from("Ayşe Yılmaz")),
        Hucre::Tamsayi(17),
        Hucre::Ondalik(92.5),
        Hucre::Bos,
    ];

    for hucre in &satir {
        match hucre {
            Hucre::Tamsayi(n) => println!("Tamsayı: {n}"),
            Hucre::Ondalik(x) => println!("Ondalık: {x:.1}"),
            Hucre::Metin(s) => println!("Metin: {s}"),
            Hucre::Bos => println!("(boş hücre)"),
        }
    }
    println!("Satırda {} hücre var", satir.len());
}
```

Her `Hucre` değeri bellekte **aynı boyutta** yer kaplar: en az en büyük varyant kadar, artı hangi
varyant olduğunu gösteren küçük bir **etiket (tag)**. (Derleyici bu etiketi çoğu zaman akıllıca
sıkıştırır: burada `String`'in hiçbir zaman kullanmadığı değerlere gizler ve `size_of::<Hucre>()`,
tıpkı `size_of::<String>()` gibi, 64 bit sistemlerde 24 bayt çıkar. Bu ayrıntıya *niche optimization*
denir.) Böylece hem farklı türde veriler bir arada durur hem de
`match`'in **kapsayıcılık (exhaustiveness)** kontrolü sayesinde hiçbir varyantı ele almayı unutamazsın.
(Tip kümesi kapalı değil de açıksa — örneğin başkalarının ekleyeceği eklentiler — **trait nesneleri**
kullanılır: `Vec<Box<dyn Trait>>`. Bunu Modül 20'de göreceğiz.)

```predict
code: |
  enum Hareket {
      Yatir(u32),
      Cek(u32),
      Sorgu,
  }

  fn main() {
      let islemler = vec![
          Hareket::Yatir(500),
          Hareket::Cek(200),
          Hareket::Sorgu,
          Hareket::Cek(100),
          Hareket::Yatir(50),
      ];
      let mut bakiye = 1000;
      let mut sorgu_sayisi = 0;
      for islem in &islemler {
          match islem {
              Hareket::Yatir(miktar) => bakiye += miktar,
              Hareket::Cek(miktar) => bakiye -= miktar,
              Hareket::Sorgu => sorgu_sayisi += 1,
          }
      }
      println!("{bakiye} {sorgu_sayisi}");
  }
options:
  - "1250 1"
  - "1450 1"
  - "1250 0"
  - "1550 1"
answer: 0
explanation: |
  Banka hesabı 1000 ile başlıyor: +500 → 1500, −200 → 1300, sorgu (bakiye değişmez, sayaç 1),
  −100 → 1200, +50 → 1250. Vektörü `&islemler` ile dolaştığımız için `islem` bir `&Hareket`;
  `match` içindeki `miktar` da bir `&u32` olur. `u32`'ye bir `&u32` eklemek (`bakiye += miktar`)
  standart kütüphanede tanımlı olduğu için ayrıca `*` yazmamız gerekmedi.
```

Şimdi vektörü bir **yığın** olarak, enum'la birlikte kullanma sırası sende. Hemen her metin editöründeki
"Geri Al" (Ctrl+Z) özelliği, tam olarak bir yığınla çalışır.

```exercise
id: m09-e-geri-al
title: Geri alma yığını
difficulty: 3
prompt: |
  Küçük bir metin editörü yazıyoruz. Kullanıcının komutları bir `Komut` dizisi olarak geliyor:

  - `Komut::Yaz(metin)` — metni, mevcut yazının **sonuna** ekler.
  - `Komut::GeriAl` — **en son** yazılan parçayı geri alır. Geri alınacak bir şey yoksa hiçbir şey olmaz.

  `editor` fonksiyonu tüm komutları sırayla uygulasın ve ortaya çıkan son metni döndürsün. Örnek:
  `Yaz("Merhaba")`, `Yaz(" dünya")`, `GeriAl`, `Yaz(" Rust")` → `"Merhaba Rust"`.
starter: |
  enum Komut {
      Yaz(String),
      GeriAl,
  }

  fn editor(komutlar: &[Komut]) -> String {
      todo!()
  }

  fn main() {
      let komutlar = vec![
          Komut::Yaz(String::from("Merhaba")),
          Komut::Yaz(String::from(" dünya")),
          Komut::GeriAl,
          Komut::Yaz(String::from(" Rust")),
      ];
      println!("{}", editor(&komutlar));
  }
solution: |
  enum Komut {
      Yaz(String),
      GeriAl,
  }

  fn editor(komutlar: &[Komut]) -> String {
      // Yazılan parçaları bir yığında tutuyoruz (sahiplik komutlarda kalıyor, biz ödünç alıyoruz)
      let mut parcalar: Vec<&str> = Vec::new();
      for komut in komutlar {
          match komut {
              Komut::Yaz(metin) => parcalar.push(metin),
              Komut::GeriAl => {
                  parcalar.pop(); // boşsa None döner, bir şey olmaz
              }
          }
      }
      let mut sonuc = String::new();
      for parca in &parcalar {
          sonuc.push_str(parca);
      }
      sonuc
  }

  fn main() {
      let komutlar = vec![
          Komut::Yaz(String::from("Merhaba")),
          Komut::Yaz(String::from(" dünya")),
          Komut::GeriAl,
          Komut::Yaz(String::from(" Rust")),
      ];
      println!("{}", editor(&komutlar));
  }
check: tests
tests: |
  #[test]
  fn yaz_ve_geri_al() {
      let komutlar = vec![
          Komut::Yaz(String::from("Merhaba")),
          Komut::Yaz(String::from(" dünya")),
          Komut::GeriAl,
          Komut::Yaz(String::from(" Rust")),
      ];
      assert_eq!(editor(&komutlar), "Merhaba Rust", "GeriAl en son yazılan parçayı silmeli");
  }

  #[test]
  fn ust_uste_geri_al() {
      let komutlar = vec![
          Komut::Yaz(String::from("Bir")),
          Komut::Yaz(String::from("İki")),
          Komut::Yaz(String::from("Üç")),
          Komut::GeriAl,
          Komut::GeriAl,
          Komut::Yaz(String::from("Dört")),
      ];
      assert_eq!(editor(&komutlar), "BirDört", "iki GeriAl son iki parçayı silmeli");
  }

  #[test]
  fn bosken_geri_al_bir_sey_yapmaz() {
      let komutlar = vec![
          Komut::GeriAl,
          Komut::Yaz(String::from("a")),
          Komut::GeriAl,
          Komut::GeriAl,
      ];
      assert_eq!(editor(&komutlar), "", "fazladan GeriAl panik yaratmamalı; metin boş kalmalı");
  }

  #[test]
  fn komut_yoksa_bos_metin() {
      assert_eq!(editor(&[]), "", "hiç komut yoksa sonuç boş bir String olmalı");
  }
hints:
  - "Yazılan parçaları bir **yığında** (vektörde) biriktir: `Yaz` gelince `push`, `GeriAl` gelince `pop`."
  - "`pop` bir `Option` döndürür ve boş vektörde sadece `None` verir — panik yok. Dönen değeri kullanmana gerek yok: `parcalar.pop();`"
  - "Komutları `for komut in komutlar` ile dolaşıp `match komut { Komut::Yaz(metin) => ..., Komut::GeriAl => ... }` yaz. En sonda boş bir `String` oluşturup parçaları `push_str` ile birleştir."
explanation: |
  Yığın (LIFO) tam bu iş için biçilmiş kaftandır: geri alınması gereken şey her zaman **en son** yapılan
  iştir ve `pop` tam olarak onu verir. Boş yığında `pop` sadece `None` döndürdüğü için "geri alınacak bir
  şey yok" durumu ek bir `if` gerektirmeden doğal olarak ele alındı.

  Çözümde parçaları `Vec<&str>` içinde **ödünç** olarak tuttuk: metinlerin sahibi hâlâ `komutlar`
  dizisi, biz sadece onlara bakıyoruz. `parcalar.push(metin)` satırında `metin` bir `&String`'di; Rust onu
  otomatik olarak `&str`'ye dönüştürdü. İstersen `Vec<String>` kullanıp `metin.clone()` da
  diyebilirdin — çalışır ama her parça için gereksiz bir kopya üretir.

  Son birleştirme için bir kısayol daha var: `parcalar.concat()`, bir `&str` diliminin tüm parçalarını
  tek bir `String`'de birleştirir.
```

## Özet

:::remember
- `Vec<T>` aynı tipten elemanları heap'te **yan yana** tutar; stack'te sadece işaretçi + `len` + `capacity`.
- `push` sona ekler, `pop` sondan çıkarır ve `Option<T>` döndürür (vektör boş olabilir).
- `v[i]` sınır dışında **panikler**; `v.get(i)` ise `Option<&T>` döndürür. Olmayabilecek elemanı `get` ile iste.
- `for x in &v` okur, `for x in &mut v` yerinde değiştirir (`*x`), `for x in v` vektörü **tüketir**.
- `len == capacity` iken `push` **yeniden tahsis** yapar: elemanlar yeni bir adrese taşınabilir, eski alan serbest kalır.
  Bu yüzden bir elemana `&` tutarken (ya da `for x in &v` içinde) `push` yapamazsın (**E0502**).
- `String` gibi `Copy` olmayan elemanları indeksle dışarı taşıyamazsın (**E0507**): `&v[i]`, `.clone()` ya da `remove`.
- `Vec::new()` bellek ayırmaz; `clear`/`truncate`/`pop` kapasiteyi küçültmez (gerekirse `shrink_to_fit`).
- Farklı türde verileri tek vektörde tutmak için bir `enum` tanımla.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Bir vektörün elemanına referans tutarken neden `push` yapamazsın?
  Aynı durumda C++ ne yapar ve Rust'ın yaklaşımı neden daha güvenlidir?
answer: |
  Model cevap: `push`, vektör doluysa (`len == capacity`) yeniden tahsis yapar: elemanları daha büyük,
  yeni bir alana kopyalar ve eski alanı serbest bırakır. Elimdeki referans hâlâ eski adresi gösterdiği
  için sarkan bir referansa dönüşür; onu okumak *use-after-free* olur. Rust, bir değerin `&` ödüncü
  yaşarken `&mut` ödünç verilmesini yasaklayarak bu durumu **derleme zamanında** engeller (E0502).
  C++ aynı kodu derler; sonuç tanımsız davranıştır ve hata belki aylar sonra, bambaşka bir yerde
  ortaya çıkar (iterator invalidation).
```

```flashcards
- front: "`v.pop()` ne döndürür ve neden?"
  back: "`Option<T>`: vektör boşsa `None`, değilse `Some(son_eleman)`. Vektör boş olabileceği için."
- front: "`notlar` 3 elemanlıyken `notlar[10]` ve `notlar.get(10)` ne yapar?"
  back: "`notlar[10]` panikler (*index out of bounds*); `notlar.get(10)` ise `None` döndürür."
- front: "`for x in &mut v` döngüsünde elemana 1 eklemek için ne yazarsın?"
  back: "`*x += 1;` — `x` bir `&mut T` olduğu için `*` ile gösterdiği değere ulaşılır."
- front: "`for s in v { ... }` döngüsünden sonra `v.len()` yazabilir misin?"
  back: "Hayır. Döngü vektörü tüketti (sahiplik taşındı) → **E0382**. Sonra kullanacaksan `&v` ile dolaş."
- front: "`len` ile `capacity` arasındaki fark nedir?"
  back: "`len`: vektördeki eleman sayısı. `capacity`: yeniden tahsis gerekmeden sığabilecek eleman sayısı (ayrılmış yer)."
- front: "Neden `let r = &v[0]; v.push(1); println!(\"{r}\");` derlenmez?"
  back: "`push` yeniden tahsis yapıp eski belleği serbest bırakabilir; `r` sarkardı. `&` yaşarken `&mut` ödünç alınamaz → **E0502**."
- front: "`let ilk = isimler[0];` (`isimler: Vec<String>`) neden **E0507** verir?"
  back: "Vektörün içindeki `String` dışarı taşınamaz. Çözüm: `&isimler[0]`, `.clone()` ya da `remove`/`pop`."
- front: Farklı türde verileri (sayı, metin, boş) tek bir vektörde nasıl tutarsın?
  back: "Her türü bir varyant yapan bir `enum` tanımlarsın: `Vec<Hucre>` gibi; okurken `match` kullanırsın."
```
