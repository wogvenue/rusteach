---
id: m14-l01
title: "Closure'lar, isimsiz fonksiyonlar"
minutes: 18
type: lesson
objectives:
  - "Closure sözdizimini (`|x| x + 1`, bloklu gövde, tip belirtme) okuyup yazabilmek"
  - "Closure parametre tiplerinin ilk kullanımda sabitlendiğini açıklayıp ilgili E0308 hatasını düzeltebilmek"
  - Bir closure'ın ortamını referansla, değiştirilebilir referansla ya da değerle yakaladığını koddan söyleyebilmek
  - "`unwrap_or_else`, `sort_by_key` ve `retain`'e ortamı yakalayan closure'lar verebilmek"
keywords: [closure, kapanış, yakalama, capture, "|x|", E0308, E0434, unwrap_or_else, sort_by_key, retain]
---

Modül 9'da kitapları ada göre sıralarken şöyle bir şey yazmıştın: `raf.sort_by_key(|k| k.ad.clone())`.
O `|k| ...` parçası bir **closure**'dı; onu sıralamaya verilen kısa bir kural olarak kullanmış, asıl
güçlerini bu modüle bırakmıştık. Şimdi zamanı geldi.

Bu derste **closure**'ları, yazıldığı yerde tanımlanan, isimsiz ve **çevresindeki değişkenleri
yakalayabilen** fonksiyonları, tanıyacaksın. Closure'lar Rust'ın fonksiyonel tarafının kapısıdır:
modülün ikinci yarısındaki iterator'ların neredeyse her metodu bir closure ister.

## Yerinde yazılan fonksiyonlar

Önce tanıdık bir fonksiyon ve aynı işi yapan closure'ı yan yana görelim:

```rust
fn bir_ekle_fn(x: i32) -> i32 {
    x + 1
}

fn main() {
    // Tam yazım: parametre tipi, dönüş tipi ve süslü parantezli gövde
    let bir_ekle_uzun = |x: i32| -> i32 { x + 1 };
    // Kısa yazım: tipler çıkarılır, tek ifadelik gövdede {} gerekmez
    let bir_ekle = |x| x + 1;

    println!("{}", bir_ekle_fn(1));
    println!("{}", bir_ekle_uzun(2));
    println!("{}", bir_ekle(3));

    // Birden çok satırlık gövde: bir blok, son ifadesi dönüş değeridir
    let not_harfi = |puan: u32| {
        let harf = if puan >= 85 { 'A' } else if puan >= 70 { 'B' } else { 'C' };
        format!("{puan} → {harf}")
    };
    println!("{}", not_harfi(91));

    // Parametresiz closure: iki dikey çizgi yan yana
    let selam = || println!("Merhaba closure!");
    selam();
}
```

Kurallar kısaca şöyle:

| parça | fonksiyon | closure |
|---|---|---|
| tanım | `fn ad(x: i32) -> i32 { ... }` | `\|x\| ...` (bir değişkene atanabilir) |
| parametreler | `( )` içinde, tipler **zorunlu** | `\| \|` içinde, tipler **isteğe bağlı** |
| dönüş tipi | `->` ile, zorunlu (unit değilse) | isteğe bağlı; yazarsan gövde `{ }` olmalı |
| gövde | her zaman `{ }` | tek ifadeyse `{ }` gerekmez |
| çağırma | `ad(5)` | `degisken(5)`, aynı sözdizimi |

Neden fonksiyonda tipler zorunlu da closure'da değil? Fonksiyonlar bir **arayüzdür**: başka modüller,
başka insanlar çağırır; imza belgedir (Modül 3). Closure'lar ise kısa ömürlü ve **yereldir**; genellikle
tek bir yerde, tek bir amaçla kullanılır. Derleyici gövdeye ve kullanıldığı yere bakarak tipleri rahatça
çıkarabilir, tıpkı `let x = 5;` yazarken tip yazmaman gibi.

:::warning Dönüş tipi yazarsan süslü parantez şart
`|x: i32| -> i32 x + 1` derlenmez: *"explicit return type requires closure body to be enclosed in braces"*.
Doğrusu `|x: i32| -> i32 { x + 1 }`.
:::

:::analogy Masadaki not kâğıdı
Fonksiyon, kütüphanedeki ciltli bir **tarif kitabı** gibidir: adı, içindekiler sayfası, resmî bir yeri vardır;
herkes bulup kullanabilir. Closure ise mutfakta tezgâha yapıştırdığın **yapışkan nottur**: "bu sosa kalan
domatesi ekle". İsmi yoktur, o anki işe özeldir ve en önemlisi, *tezgâhta duran* malzemelere ("kalan
domates") doğrudan atıf yapabilir. Bu son özellik, çevreyi görebilmek, closure'ı fonksiyondan ayıran şeydir.
:::

Diğer dillerden tanıyorsan: Python'daki `lambda x: x + 1`, JavaScript'teki `x => x + 1`, C++'taki
`[](int x) { return x + 1; }` ve Java'daki `x -> x + 1` aynı fikrin farklı yazımlarıdır. Python'un
`lambda`'sı tek ifadeyle sınırlıdır; Rust closure'ı ise istediğin kadar satır içerebilir.

```quiz
question: Aşağıdakilerden hangisi **geçerli** bir Rust closure tanımıdır?
options:
  - "`let f = |a, b| -> i32 a * b;`"
  - "`let f = |a: i32, b: i32| a * b;`"
  - "`let f = (a, b) => a * b;`"
  - "`let f = fn(a, b) { a * b };`"
answer: 1
explanation: |
  Closure parametreleri `| |` arasına yazılır, tipler isteğe bağlıdır ve tek ifadelik gövde süslü
  parantez istemez. Dönüş tipi (`-> i32`) yazılsaydı gövdenin `{ a * b }` olması gerekirdi.
feedback:
  - "Dönüş tipi belirtildiğinde gövde süslü parantez içinde olmalı: `-> i32 { a * b }`."
  - Doğru! Parametre tipleri yazılmış, gövde tek ifade.
  - Bu JavaScript'in ok fonksiyonu sözdizimi; Rust `| |` kullanır.
  - "`fn` bir öğe (item) tanımlar ve adı olmak zorundadır; bir değere bu şekilde atanamaz."
```

## Tip çıkarımı: ilk çağrı kararı verir

Closure parametrelerinin tipini yazmak zorunda olmadığımızı gördük. Peki tip yazmazsak, closure
**her tiple** çalışan generic bir şey mi olur? Tahmin et:

```compiles
code: |
  fn main() {
      let ayna = |x| x;
      let s = ayna(String::from("merhaba"));
      let n = ayna(5);
      println!("{s} {n}");
  }
answer: false
error: E0308
explanation: |
  Closure'lar generic **değildir**. Derleyici `x`'in tipini ilk çağrıdan (`String`) çıkarır ve
  closure'ın tipi o anda **sabitlenir**: artık `ayna` yalnızca `String` alıp `String` döndüren bir
  closure'dır. İkinci çağrıdaki `5` bu yüzden `E0308` verir.
```

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:4:18
  |
4 |     let n = ayna(5);
  |             ---- ^ expected `String`, found integer
  |             |
  |             arguments to this function are incorrect
  |
note: expected because the closure was earlier called with an argument of type `String`
 --> src/main.rs:3:18
  |
3 |     let s = ayna(String::from("merhaba"));
  |             ---- ^^^^^^^^^^^^^^^^^^^^^^^ expected because this argument is of type `String`
  |             |
  |             in this closure call
note: closure parameter defined here
 --> src/main.rs:2:17
  |
2 |     let ayna = |x| x;
  |                 ^
```
Mesaj hikâyeyi üç adımda anlatıyor: **4. satırda** tamsayı verdin ama `String` bekleniyordu; **çünkü**
3. satırda closure zaten `String` ile çağrılmıştı (*"expected because the closure was earlier called with
an argument of type `String`"*); parametre de **2. satırda** tanımlıydı.
:::

Bunun nedeni şu: derleyici her closure için **kendine özgü, isimsiz bir tip** üretir ve bu tipin
parametreleri **tek bir somut tip** olmalıdır. Her tiple çalışan bir şey istiyorsan doğru araç
Modül 11'deki generic fonksiyondur:

```rust
fn ayna<T>(x: T) -> T {
    x
}

fn main() {
    let s = ayna(String::from("merhaba"));
    let n = ayna(5);
    println!("{s} {n}");
}
```

Burada `ayna::<String>` ve `ayna::<i32>` diye **iki ayrı** fonksiyon üretilir (monomorphization). Closure ise
tek bir tiptir; iki farklı imzası olamaz.

:::tip Tip ne zaman yazılmalı?
Çoğu zaman closure'ı bir metoda (`sort_by_key`, `map`...) argüman olarak verirsin ve tipler metodun
imzasından gelir; yazmana gerek kalmaz. Bir değişkene atayıp **sonra** kullanacaksan ya da derleyici
"type annotations needed" diyorsa, parametre tipini yaz: `|fiyat: u32| ...`
:::

## Ortamı yakalamak

İşte closure'ı fonksiyondan gerçekten ayıran özellik. Bir sınıfın geçme notunu bir değişkende tutalım ve
"geçti mi?" sorusunu soran küçük bir fonksiyon yazmaya çalışalım:

```compiles
code: |
  fn main() {
      let esik = 50;

      fn gecti_mi(not: u32) -> bool {
          not >= esik
      }

      println!("{}", gecti_mi(70));
  }
answer: false
error: E0434
explanation: |
  `fn` ile tanımlanan bir fonksiyon, başka bir fonksiyonun içinde yazılsa bile **çevresindeki yerel
  değişkenleri göremez**. Bir `fn`'in tek girdisi parametreleri (ve `const`/`static` gibi global
  öğeler) olabilir. `esik`'i kullanmak için ya parametre olarak geçmeli ya da closure kullanmalıyız.
```

:::error
```text
error[E0434]: can't capture dynamic environment in a fn item
 --> src/main.rs:4:16
  |
4 |         not >= esik
  |                ^^^^
  |
  = help: use the `|| { ... }` closure form instead
```
"Dinamik ortam" (dynamic environment), çalışma anında stack'te yaşayan yerel değişkenler demektir.
Derleyici çözümü de söylüyor: closure biçimini kullan.
:::

Aynı şeyi closure ile yazalım:

```rust
fn main() {
    let esik = 50;
    let gecti_mi = |not: u32| not >= esik; // esik'i "yakalar" (capture)

    println!("70 → {}", gecti_mi(70));
    println!("30 → {}", gecti_mi(30));
    println!("eşik hâlâ burada: {esik}");
}
```

Closure, gövdesinde kullandığı dış değişkenleri **yakalar (capture)**. Buradaki `gecti_mi` `esik`'i sadece
**okuyor**, o yüzden onu `&esik` olarak, yani **değişmez referansla**, yakalıyor. Bu yüzden son satırda
`esik`'i kullanmaya devam edebiliyoruz: aynı anda birden çok `&` olabilir (Modül 5).

Peki bir closure aslında nedir? Derleyici, perde arkasında yakalanan değerleri tutan **isimsiz bir struct**
üretir ve ona "çağrılabilme" yeteneği ekler. `gecti_mi` kabaca şöyle bir şeydir:

```rust,ignore
// Derleyicinin ürettiği şeyin kavramsal hâli (gerçek kod değil)
struct GectiMiClosure<'a> {
    esik: &'a i32,
}
// ...ve çağrıldığında `not >= *self.esik` hesaplayan bir metot.
```

```memory
title: "let gecti_mi = |not: u32| not >= esik;"
steps:
  - caption: "`esik` stack'te bir `i32`. Henüz closure yok."
    stack:
      - frame: main
        vars:
          - { name: esik, type: i32, value: "50" }
  - caption: "Closure oluşturulunca içinde **`esik`'e bir referans** saklanır. Closure, yakaladıklarını tutan küçük bir struct gibidir."
    stack:
      - frame: main
        vars:
          - { name: esik, type: i32, value: "50" }
          - { name: gecti_mi, type: "closure", value: "{ esik: &i32 }", to: esik, note: "değişmez ödünç" }
```

Bu modeli aklında tut; sonraki bütün kurallar buradan çıkıyor. Yakalamak = closure struct'ının bir
alanı olmak. O alan `&T` mi, `&mut T` mi, yoksa `T`'nin kendisi mi? İşte bir sonraki bölümün sorusu.

:::info Diğer dillerde yakalama
C++ lambda'larında yakalama biçimini sen yazarsın: `[&esik]` referansla, `[esik]` kopyayla. Java yalnızca
"fiilen final" (hiç değişmeyen) değişkenlerin yakalanmasına izin verir. JavaScript ve Python her şeyi
referansla yakalar ve çöp toplayıcıya güvenir. Rust ise yakalama biçimini **gövdeden çıkarır** ve
borrow checker'ı devreye sokar: hatalı bir yakalama çalışma anında değil, derleme anında yakalanır.
:::

## Değiştirerek ve sahiplenerek yakalama

Derleyici her yakalanan değişken için, gövdenin ihtiyacını karşılayan **en hafif** yolu seçer:

1. Sadece okuyorsa → **`&T`** (değişmez referans)
2. Değiştiriyorsa → **`&mut T`** (değiştirilebilir referans)
3. Sahipliğini alıp taşıyorsa (ör. `let x = deger;` ya da sahiplik isteyen bir fonksiyona veriyorsa) → **`T`** (değerin kendisi)

Üçüncü maddede bir incelik var: değer **`Copy`** ise (`i32`, `f64`, `bool`, `char`...) `let x = deger;` bir
taşıma değil **kopyadır**; kopyalamak için okumak yeter. Bu yüzden `move` olmayan bir closure, gövdesi
`let m = n;` dese bile bir `i32`'yi **`&` ile** yakalar ve `n` dışarıda kullanılmaya devam eder. Değerle
yakalama yalnızca **`Copy` olmayan** bir değer gövdede gerçekten taşındığında olur.

### `&mut` ile yakalama

```rust
fn main() {
    let mut sepet: Vec<String> = Vec::new();
    let mut ekle = |urun: &str| sepet.push(urun.to_string());

    ekle("elma");
    ekle("ekmek");
    ekle("peynir");
    // `ekle`'nin son kullanımı yukarıdaydı; &mut ödünç burada bitti (NLL)

    println!("Sepette {} ürün: {sepet:?}", sepet.len());
}
```

İki şeye dikkat: `sepet` `mut` olmalı (değişecek), **closure değişkeni de `mut` olmalı**: `let mut ekle`.
Neden? Çünkü `ekle`'yi çağırmak, içindeki `&mut Vec` alanını kullanmak demektir; yani closure'ın kendisi
değişiyor gibi davranır. `mut` unutursan derleyici *"calling `ekle` requires mutable binding due to mutable
borrow of `sepet`"* der (E0596).

Şimdi tahmin et, closure çağrıları arasına bir `println!` koyarsak?

```compiles
code: |
  fn main() {
      let mut sayac = 0;
      let mut artir = || sayac += 1;
      println!("{sayac}");
      artir();
  }
answer: false
error: E0502
explanation: |
  `artir` oluşturulduğu anda `sayac`'ı `&mut` olarak ödünç alır ve bu ödünç `artir`'in **son kullanımına**
  (5. satır) kadar sürer. Arada `sayac`'ı okumak (`&`) "bir `&mut` varken başka ödünç yok" kuralını çiğner.
  `println!` satırını `artir();`'dan sonraya alırsan derlenir.
```

:::error
```text
error[E0502]: cannot borrow `sayac` as immutable because it is also borrowed as mutable
 --> src/main.rs:4:16
  |
3 |     let mut artir = || sayac += 1;
  |                     -- ----- first borrow occurs due to use of `sayac` in closure
  |                     |
  |                     mutable borrow occurs here
4 |     println!("{sayac}");
  |                ^^^^^ immutable borrow occurs here
5 |     artir();
  |     ----- mutable borrow later used here
```
Modül 5'teki E0502'nin aynısı! Tek fark, `&mut` ödüncü alan şeyin bir closure olması. Etiketlere bak:
*mutable borrow occurs here* closure'ın `||` kısmını gösteriyor, ödünç, closure **oluşturulurken** başlar.
:::

### Değerle (sahiplenerek) yakalama

```rust
fn main() {
    let mesaj = String::from("Toplantı 14:00'te");

    let gonder = || {
        let giden = mesaj; // String'in sahipliği closure'ın içinden dışarı taşınıyor
        println!("Gönderildi: {giden}");
    };

    gonder();
    // println!("{mesaj}"); // ← açarsan E0382: mesaj closure'a taşındı
}
```

Gövde `mesaj`'ın **sahipliğini** istiyor (`let giden = mesaj;`). Bir referans bunu sağlayamaz, o yüzden
closure `mesaj`'ı **değeriyle** yakalar: `String` closure'ın içine taşınır. Taşıma closure **oluşturulduğu
anda** olur, çağrıldığında değil. Yorum satırını açarsan alacağın hata: *"value moved into closure here"*.

```memory
title: Üç yakalama biçimi
steps:
  - caption: "Okuyan closure: `esik`'i `&i32` olarak tutar. `esik` serbestçe okunmaya devam edebilir."
    stack:
      - frame: main
        vars:
          - { name: esik, type: i32, value: "50" }
          - { name: gecti_mi, type: closure, value: "{ esik: &i32 }", to: esik }
  - caption: "Değiştiren closure: `sepet`'i `&mut Vec` olarak tutar. Closure yaşadıkça başka kimse `sepet`'e dokunamaz."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<String>", value: "ptr · len=3 · cap=4", mut: true, to: h1 }
          - { name: ekle, type: closure, value: "{ sepet: &mut Vec }", mut: true, to: sepet }
    heap:
      - { id: h1, value: "\"elma\" \"ekmek\" \"peynir\"" }
  - caption: "Sahiplenen closure: `String` başlığının kendisi closure'ın içine taşınır; `mesaj` artık geçersiz."
    stack:
      - frame: main
        vars:
          - { name: mesaj, type: String, value: "ptr · len · cap", moved: true, note: taşındı }
          - { name: gonder, type: closure, value: "{ mesaj: String }", to: h2 }
    heap:
      - { id: h2, value: "T o p l a n t ı ..." }
```

Yakalanan şey closure struct'ının alanı olduğuna göre, closure'ın **boyutu** da yakaladıklarına bağlıdır.
Bunu `std::mem::size_of_val` ile (bir değerin stack'te kaç bayt tuttuğunu söyler) görebilirsin:

```rust
use std::mem::size_of_val;

fn main() {
    let esik = 50;
    let isim = String::from("Deniz");

    let bos = || println!("hiçbir şey yakalamadım");
    let okuyan = || println!("eşik: {esik}");
    let sahiplenen = || {
        let s = isim;
        println!("aldım: {s}");
    };

    println!("bos: {} bayt", size_of_val(&bos));
    println!("okuyan: {} bayt", size_of_val(&okuyan));
    println!("sahiplenen: {} bayt", size_of_val(&sahiplenen));

    bos();
    okuyan();
    sahiplenen();
}
```

Hiçbir şey yakalamayan closure **0 bayttır**; bir referans yakalayan, bir işaretçi kadar; bir
`String`'i sahiplenen, `String` başlığı (işaretçi + uzunluk + kapasite) kadar. 64 bit bir sistemde (ve
Playground'da) bunlar `0`, `8` ve `24` bayttır. Gizli bir maliyet yok: closure tam olarak yakaladığı kadar
yer kaplar, heap ayırması, gizli bir "ortam nesnesi" ya da çöp toplayıcı yoktur.

:::deep Edition 2021+: closure'lar alanları ayrı ayrı yakalar
Closure gövdesi bir struct'ın sadece **bir alanını** kullanıyorsa, Rust 2021'den beri yalnızca o alan
yakalanır (*disjoint capture*). Böylece aynı struct'ın başka bir alanını closure yaşarken kullanabilirsin:

```rust
struct Ogrenci {
    ad: String,
    not: u32,
}

fn main() {
    let mut ogr = Ogrenci { ad: String::from("Can"), not: 70 };
    let mut bonus_ver = || ogr.not += 10; // sadece ogr.not'u &mut yakalar
    println!("{}", ogr.ad); // ogr.ad'i okumak serbest!
    bonus_ver();
    println!("{} {}", ogr.ad, ogr.not);
}
```

Rust 2018'de bu kod E0502 verirdi, çünkü closure `ogr`'un tamamını yakalardı. Bu derste edition 2024
kullanıyoruz; bu davranış varsayılan.
:::

Hatırlamak için bir soru:

```quiz
question: |
  `let mut v = vec![1, 2];` ve `let mut f = || v.push(3);` yazdıktan sonra, `f`'i bir daha çağırmadan
  önce `println!("{v:?}")` yazarsan ne olur?
options:
  - "Derlenmez; `f` `v`'yi `&mut` ödünç aldı ve `f` daha sonra kullanılıyor"
  - "`f` bir daha **hiç** çağrılmıyorsa derlenir; sonra çağrılıyorsa derlenmez"
  - Her durumda derlenir, closure'lar ödünç almaz
  - Her durumda derlenmez, `v` closure'a taşındı
answer: 1
explanation: |
  Ödünç, closure oluşturulduğunda başlar ve closure'ın **son kullanımında** biter (NLL). `f` sonra hiç
  çağrılmıyorsa ödünç hemen biter ve `println!` sorunsuzdur. `println!`'den sonra `f()` çağrılıyorsa,
  `&mut` ödünç hâlâ canlıdır ve E0502 alırsın.
feedback:
  - Sadece `f` daha sonra çağrılıyorsa doğru, cevap buna bağlı.
  - Doğru! Ödünç süresini closure'ın son kullanımı belirler.
  - Closure'lar yakaladıklarını gerçekten ödünç alır; borrow checker kuralları aynen geçerli.
  - "`push` sadece `&mut self` ister; sahiplik gerekmez, o yüzden taşınmaz."
```

## Standart kütüphanede closure'lar

Closure'lar asıl gücünü **başka fonksiyonlara argüman olarak verildiklerinde** gösterir. Daha önce
gördüğün üç yere yeni gözle bakalım.

### `unwrap_or` mu, `unwrap_or_else` mi?

Modül 10'da `Option`/`Result` için ikisini de gördün. Aradaki farkı şimdi tam olarak anlayabilirsin.
Önce tahmin et:

```predict
code: |
  fn varsayilan_isim() -> String {
      println!("(varsayılan hesaplandı)");
      String::from("misafir")
  }

  fn main() {
      let kayitli: Option<String> = Some(String::from("Elif"));
      let a = kayitli.clone().unwrap_or(varsayilan_isim());
      let b = kayitli.unwrap_or_else(|| varsayilan_isim());
      println!("{a} {b}");
  }
options:
  - |
    Elif Elif
  - |
    (varsayılan hesaplandı)
    Elif Elif
  - |
    (varsayılan hesaplandı)
    (varsayılan hesaplandı)
    Elif Elif
answer: 1
explanation: |
  `unwrap_or(varsayilan_isim())` çağrılmadan **önce** argümanı hesaplanır - Rust'ta argümanlar her zaman
  önce değerlendirilir. Yani `Some` olsa bile `varsayilan_isim()` çalışır ve sonucu çöpe gider.
  `unwrap_or_else(|| varsayilan_isim())` ise bir **closure** alır ve onu **yalnızca `None` durumunda**
  çağırır. Değer `Some` olduğu için ikinci satırda hiçbir şey yazdırılmaz.
```

Kural: varsayılan değer **ucuz bir sabitse** (`0`, `""`) `unwrap_or` yeterli. Hesaplaması pahalıysa
(heap ayırma, dosya okuma, karmaşık hesap) ya da yan etkisi varsa, `unwrap_or_else` ile **tembel**
(lazy) davran: closure "gerekirse şunu yap" diye ertelenmiş bir iştir.

:::tip Clippy'nin önerisi: closure yerine fonksiyonun adı
Gövdesi yalnızca bir fonksiyonu aynı argümanlarla çağıran closure gereksizdir. Clippy
`unwrap_or_else(|| varsayilan_isim())` için *"redundant closure"* uyarısı verir ve
`unwrap_or_else(varsayilan_isim)` yazmanı önerir: fonksiyonun **adı** da closure'ın beklendiği yere
verilebilir. Bunun neden çalıştığını bir sonraki derste (fonksiyon işaretçileri) göreceksin.
:::

### `sort_by_key` ve `retain`: artık ortamı da görebilirler

Modül 9'da `sort_by_key` ve `retain`'e sadece elemana bakan closure'lar verdik. Şimdi dışarıdaki bir
değişkeni de kullanalım: sıcaklıkları **hedef sıcaklığa yakınlığa** göre sırala, aralık dışındakileri at.

```rust
fn main() {
    let hedef: i32 = 22;
    let mut sicakliklar = vec![30, 18, 21, 25, 22, 15, 41, -3];

    // 1) Aşırı ölçümleri at: closure `alt` ve `ust`'ü yakalar
    let (alt, ust) = (-10, 40);
    sicakliklar.retain(|&t| t >= alt && t <= ust);
    println!("temiz: {sicakliklar:?}");

    // 2) Hedefe en yakından en uzağa sırala: closure `hedef`'i yakalar
    sicakliklar.sort_by_key(|t| (t - hedef).abs());
    println!("hedefe göre: {sicakliklar:?}");
}
```

:::warning Neden `let hedef: i32 = 22;`?
Tipi yazmasaydık derleyici `hedef`'in ve vektör elemanlarının hangi tamsayı tipi olduğunu henüz bilemezdi
ve `.abs()` çağrısında durup *"error[E0689]: can't call method `abs` on ambiguous numeric type
`{integer}`"* derdi. Tamsayı varsayılanı (`i32`) ancak her şey çözüldükten sonra devreye girer; metot
çağırmak için tipin **o anda** bilinmesi gerekir. Bir tip belirtmek (`22i32` de olurdu) yeterli.
:::

`|&t|` deseni, closure'a gelen `&i32`'yi daha **parametrede açar**; böylece gövdede `t` doğrudan bir
`i32` olur. (Modül 9'daki `retain` örneklerinde aynı işi gövdede `*p` ile yapmıştık; ikisi de geçerli.
Bu açma yalnızca `Copy` tiplerde çalışır.) Ortamdan yakalanan `alt`, `ust` ve `hedef` ise değişmez referansla
yakalanır, closure'lar sadece onları okuyor.

```fill
prompt: |
  Boşlukları doldur: `kdvli` closure'ı `kdv_orani`'nı yakalasın; sepet fiyatları küçükten büyüğe
  sıralansın. Program `48`, `120`, `300` yazdırmalı.
code: |
  fn main() {
      let kdv_orani = 20;
      let kdvli = ___0 fiyat + fiyat * ___1 / 100;

      let mut sepet = vec![250, 100, 40];
      sepet.sort_by_key(___2);

      for f in &sepet {
          println!("{}", kdvli(*f));
      }
  }
blanks:
  - ["|fiyat|", "|fiyat: i32|"]
  - ["kdv_orani"]
  - ["|f| *f", "|&f| f", "|f|*f"]
output: |
  48
  120
  300
explanation: |
  `|fiyat|` parametre listesidir; gövdede kullanılan `kdv_orani` dışarıdan **yakalanır**. `sort_by_key`
  her elemana bir `&i32` verir; anahtar olarak değerin kendisini döndürmek için `*f` ile referansı
  çözeriz ya da `|&f| f` deseniyle parametrede açarız. (Sadece sıralamak için `sort()` de yeterdi;
  burada amaç closure yazmak.)
```

## Alıştırma: hava istasyonu

Önce adımları sıraya koyarak ısın:

```parsons
prompt: |
  Notları, sınıf ortalamasına **yakınlığa** göre sıralayan programı kur. Closure dışarıdaki `ortalama`'yı
  yakalamalı. Program `[75, 72, 64, 90]` yazdırır.
lines: |
  fn main() {
      let mut notlar = vec![90, 64, 72, 75];
      let ortalama: i32 = (notlar[0] + notlar[1] + notlar[2] + notlar[3]) / 4;
      notlar.sort_by_key(|n| (n - ortalama).abs());
      println!("{notlar:?}");
  }
distractors: |
      fn uzaklik(n: &i32) -> i32 { (n - ortalama).abs() }
      let notlar = vec![90, 64, 72, 75];
explanation: |
  `ortalama` `notlar`'dan hesaplandığı için ondan sonra gelmeli: (90 + 64 + 72 + 75) / 4 = 301 / 4 = 75
  (tamsayı bölmesi). `sort_by_key`'e verilen closure `ortalama`'yı yakalar; bir `fn` bunu yapamazdı
  (E0434). `notlar` yerinde sıralandığı için `mut` olmalı; `let notlar` (mut'suz) çeldiricisi
  `sort_by_key` çağrısında E0596 verirdi. Uzaklıklar: 75→0, 72→3, 64→11, 90→15, dolayısıyla sonuç
  `[75, 72, 64, 90]`.
```

Şimdi sıra sende. Bir hava istasyonunun ham ölçümlerini temizleyip analiz için hazırlayacaksın.

````exercise
id: m14-e-hava-istasyonu
title: Hava istasyonu ölçümleri
difficulty: 2
prompt: |
  İki fonksiyonu **closure kullanarak** tamamla:

  1. `araliga_kirp(olcumler, alt, ust)` - `alt` ile `ust` arasında (**ikisi de dahil**) olmayan ölçümleri
     vektörden **siler**. `retain` kullan.
  2. `hedefe_gore_sirala(olcumler, hedef)` - ölçümleri `hedef`'e uzaklıklarına göre (yakından uzağa)
     sıralar. Uzaklıkları **eşit** olan iki ölçümden **küçük olan önce** gelmeli
     (ör. hedef 20 iken 18, 22'den önce). `sort_by_key` kullan.

  İpucu olarak Modül 8'deki sürüm tuple'larını hatırla: tuple'lar sözlük sırasıyla karşılaştırılır (önce ilk eleman, eşitse ikinci).
starter: |
  fn araliga_kirp(olcumler: &mut Vec<i32>, alt: i32, ust: i32) {
      todo!()
  }

  fn hedefe_gore_sirala(olcumler: &mut [i32], hedef: i32) {
      todo!()
  }

  fn main() {
      let mut v = vec![30, 18, 21, 25, 22, 15, 41, -3];
      araliga_kirp(&mut v, 0, 40);
      hedefe_gore_sirala(&mut v, 22);
      println!("{v:?}");
  }
solution: |
  fn araliga_kirp(olcumler: &mut Vec<i32>, alt: i32, ust: i32) {
      olcumler.retain(|&t| t >= alt && t <= ust);
  }

  fn hedefe_gore_sirala(olcumler: &mut [i32], hedef: i32) {
      olcumler.sort_by_key(|&t| ((t - hedef).abs(), t));
  }

  fn main() {
      let mut v = vec![30, 18, 21, 25, 22, 15, 41, -3];
      araliga_kirp(&mut v, 0, 40);
      hedefe_gore_sirala(&mut v, 22);
      println!("{v:?}");
  }
check: tests
tests: |
  #[test]
  fn aralik_disi_silinir() {
      let mut v = vec![-5, 10, 45, 30, 0, 40, 41];
      araliga_kirp(&mut v, 0, 40);
      assert_eq!(v, vec![10, 30, 0, 40], "0 ve 40 dahil, -5/45/41 silinmeli; sıra korunmalı");
  }

  #[test]
  fn hepsi_aralik_disi() {
      let mut v = vec![100, -100];
      araliga_kirp(&mut v, 0, 10);
      assert!(v.is_empty(), "hiçbir ölçüm aralıkta değilse vektör boş kalmalı");
  }

  #[test]
  fn negatif_aralik_da_calisir() {
      let mut v = vec![-20, -10, -5, 0, 5, -1];
      araliga_kirp(&mut v, -10, -1);
      assert_eq!(v, vec![-10, -5, -1], "aralık [-10, -1]: sınırlar dahil, sıra korunmalı");
  }

  #[test]
  fn hedefe_yakinliga_gore() {
      let mut v = vec![30, 18, 21, 25, 22, 15];
      hedefe_gore_sirala(&mut v, 22);
      assert_eq!(v, vec![22, 21, 25, 18, 15, 30], "uzaklıklar: 0, 1, 3, 4, 7, 8");
  }

  #[test]
  fn esit_uzaklikta_kucuk_once() {
      let mut v = vec![22, 18, 25, 15, 20];
      hedefe_gore_sirala(&mut v, 20);
      assert_eq!(v, vec![20, 18, 22, 15, 25], "18 ve 22 eşit uzaklıkta: küçük olan (18) önce gelmeli");
  }

  #[test]
  fn negatif_hedef_ve_bos_dizi() {
      let mut v = vec![3, -3, -7, 0, -5];
      hedefe_gore_sirala(&mut v, -5);
      assert_eq!(v, vec![-5, -7, -3, 0, 3], "hedef -5: uzaklıklar 0, 2, 2, 5, 8; eşitlikte küçük önce");
      let mut bos: Vec<i32> = Vec::new();
      hedefe_gore_sirala(&mut bos, 10);
      assert!(bos.is_empty(), "boş dizi boş kalmalı (panik olmamalı)");
  }
hints:
  - "`retain` closure'ı `true` döndürdüğü elemanları tutar. `alt` ve `ust` closure'ın içinde doğrudan kullanılabilir: closure onları yakalar."
  - "`sort_by_key` her eleman için bir anahtar ister. Anahtar bir tuple olabilir: `(uzaklık, değer)`."
  - "`olcumler.sort_by_key(|&t| ((t - hedef).abs(), t));`, önce uzaklığa, eşitlikte değere bakar."
require:
  - pattern: "\\.retain\\("
    message: "`araliga_kirp`'ı `retain` ile yaz."
  - pattern: "\\.sort(_unstable)?_by(_key)?\\("
    message: "`hedefe_gore_sirala`'yı `sort_by_key` (veya `sort_by`) ile yaz."
explanation: |
  Her iki closure da fonksiyon parametrelerini (`alt`, `ust`, `hedef`) **yakalıyor**. Closure'lar
  onları sadece okuduğu için değişmez referansla yakalanırlar; optimize edilmiş derlemede closure
  çağrıları satır içine alınır (inline) ve geriye elle yazılmış bir karşılaştırma kalır.

  İmzalara dikkat: `retain` eleman **silebildiği** için yalnızca `Vec`'te vardır, bu yüzden
  `araliga_kirp` `&mut Vec<i32>` alır. Sıralama ise uzunluğu değiştirmez ve dilimlerde (`[T]`)
  tanımlıdır; `hedefe_gore_sirala` bu yüzden daha genel olan `&mut [i32]`'yi alır (Modül 5),
  `&mut Vec<i32>` oraya otomatik olarak dönüşür. Clippy de `&mut Vec` yerine dilim önerirdi (`ptr_arg`).

  `((t - hedef).abs(), t)` anahtarı iki kriteri birleştirir: tuple'lar sözlük sırasıyla karşılaştırıldığı
  için önce uzaklık, eşitse değerin kendisi belirleyici olur. Aynı şeyi `sort_by` ile de yazabilirdin:

  ```rust
  olcumler.sort_by(|a, b| {
      let ua = (a - hedef).abs();
      let ub = (b - hedef).abs();
      ua.cmp(&ub).then(a.cmp(b))
  });
  ```

  `sort_by_key` sürümü daha kısa ve niyeti daha net gösteriyor. Not: `sort_by_key` **kararlı** (stable)
  bir sıralamadır; yalnızca uzaklığı anahtar yapsaydın eşit uzaklıktakiler **orijinal sıralarını**
  korurdu - bu yüzden 4. test, ek kriter olmadan geçmezdi.
````

## Özet

:::remember
- Closure: `|parametreler| gövde`. Tipler isteğe bağlı; dönüş tipi yazarsan gövde `{ }` içinde olmalı.
- Closure'lar generic değildir: parametre tipleri **ilk kullanımda sabitlenir** (aksi hâlde E0308).
- `fn` öğeleri yerel değişkenleri göremez (E0434); closure'lar **yakalar (capture)**.
- Derleyici en hafif yakalamayı seçer: okursa `&T`, değiştirirse `&mut T`, sahiplik isterse `T`.
- Yakalama closure **oluşturulurken** olur; ödünç, closure'ın son kullanımına kadar sürer.
- `&mut` yakalayan closure'ın değişkeni de `mut` olmalı: `let mut ekle = || ...`.
- `unwrap_or_else(|| ...)` closure'ı yalnızca gerektiğinde çağırır (tembel); `unwrap_or(x)` `x`'i her zaman hesaplar.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Bir closure'ın içinde dışarıdaki bir değişkeni değiştirdiğinde, o closure
  yaşadığı sürece neden aynı değişkeni okuyamıyorsun? Closure'ı "isimsiz bir struct" olarak düşünerek anlat.
answer: |
  Closure, yakaladığı değişkenleri alan olarak tutan isimsiz bir struct gibidir. Değiştiren bir closure
  değişkeni `&mut` referans olarak saklar. Bu struct yaşadığı ve daha sonra kullanılacağı sürece o `&mut`
  ödünç de canlıdır. Rust'ın kuralı "ya tek bir `&mut` ya da istediğin kadar `&`" olduğu için, aynı
  anda değişkeni okumak (`&` almak) yasaktır. Closure'ın son kullanımından sonra ödünç biter ve değişken
  yeniden serbestçe okunabilir.
```

```flashcards
- front: "`fn` ile closure arasındaki **temel** fark nedir?"
  back: "Closure çevresindeki yerel değişkenleri **yakalayabilir** (capture); `fn` öğesi yakalayamaz (E0434)."
- front: "`let f = |x| x;` sonra `f(String::from(\"a\"))` ve `f(5)`, neden derlenmez?"
  back: "Closure'lar generic değildir; `x`'in tipi ilk çağrıda `String` olarak sabitlenir, `f(5)` E0308 verir."
- front: Derleyici bir değişkeni closure'a hangi üç biçimde yakalayabilir? Nasıl seçer?
  back: "`&T` (sadece okuyorsa), `&mut T` (değiştiriyorsa), `T` (sahiplik istiyorsa). Gövdenin ihtiyacını karşılayan **en hafif** biçimi seçer."
- front: "`let artir = || sayac += 1; artir();` neden derlenmez (`sayac` `mut` olsa bile)?"
  back: "`&mut` yakalayan closure'ı çağırmak closure'ı değiştirir; değişken `let mut artir` olmalı (E0596)."
- front: "Dönüş tipi belirtilen closure'ın gövdesi için kural nedir?"
  back: "Süslü parantez zorunlu: `|x: i32| -> i32 { x + 1 }`."
- front: "`unwrap_or(pahali())` ile `unwrap_or_else(|| pahali())` farkı?"
  back: "İlki `pahali()`'yı **her zaman** hesaplar (argüman önce değerlendirilir); ikincisi closure'ı yalnızca `None`/`Err` durumunda çağırır."
- front: Hiçbir şey yakalamayan bir closure bellekte kaç bayt yer kaplar?
  back: "0 bayt. Closure tam olarak yakaladıkları kadar yer kaplar (ör. 64 bit sistemde bir referans → 8 bayt, bir `String` → 24 bayt)."
```
