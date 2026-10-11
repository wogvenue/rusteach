---
id: m07-l03
title: match ifadesi
minutes: 25
type: lesson
objectives:
  - "`match` ifadesinin kollarını ve desenlerini okuyabilmek, bir değer üreten `match` yazabilmek"
  - Eksiksizlik (exhaustiveness) hatasını (E0004) okuyup eksik kolları ekleyerek düzeltebilmek
  - Desenlerle varyantların içindeki değerleri yakalayabilmek ve hepsini yakalayan kolları (`_`, değişken) doğru sırada yazabilmek
  - Tamsayılar, aralıklar, karakterler ve tuple'lar üzerinde `match` kullanabilmek
keywords: [match, desen, pattern, kol, arm, eksiksizlik, exhaustiveness, E0004, catch-all, aralık, range]
---

Önceki iki derste `match`'i hep yan rolde kullandın: bir enum'un hangi varyant olduğuna bakmak, bir
`Option`'ı açmak için. Şimdi başrolde. `match`, Rust'ta en sık kullanacağın kontrol akışı aracı olacak;
çünkü yalnızca "hangi durumdayız?" diye sormakla kalmaz, **hiçbir durumu unutmadığından da emin olur.**

Gerçek bir senaryo düşün: bir alışveriş uygulamasına yeni bir ödeme yöntemi ekleniyor. Kodda ödeme
yöntemine göre karar veren on dört yer var: fatura, iade, kargo, raporlama... Kaçını güncellemeyi
unutursun? Çoğu dilde bunu ancak bir müşteri şikâyet ettiğinde öğrenirsin. Rust'ta ise program, sen
hepsini güncelleyene kadar **derlenmez**. Bu derste bunun nasıl çalıştığını ve desenlerin neler
yapabildiğini göreceksin.

## match'in anatomisi

Bir kumbarayı boşalttığını ve paraları saydığını düşün. Her bozuk paranın değeri türüne bağlı:

```rust
enum Madeni {
    Kurus5,
    Kurus10,
    Kurus25,
    Kurus50,
    Lira1,
}

fn kurus_degeri(para: Madeni) -> u32 {
    match para {
        Madeni::Kurus5 => 5,
        Madeni::Kurus10 => 10,
        Madeni::Kurus25 => 25,
        Madeni::Kurus50 => 50,
        Madeni::Lira1 => {
            println!("Bir lira bulundu!");
            100
        }
    }
}

fn main() {
    let kumbara = [
        Madeni::Kurus25,
        Madeni::Lira1,
        Madeni::Kurus5,
        Madeni::Kurus50,
        Madeni::Kurus10,
        Madeni::Lira1,
    ];
    let mut toplam = 0;
    for para in kumbara {
        toplam += kurus_degeri(para);
    }
    println!("Kumbarada {toplam} kuruş var");
}
```

Bir `match`'in genel şekli şöyledir:

```text
match deger {
    DESEN_1 => IFADE_1,
    DESEN_2 => IFADE_2,
    ...
}
```

- `match`'ten sonra incelenecek değer gelir: burada `para`.
- Her **kol (arm)** iki parçadan oluşur: `=>` işaretinin solunda bir **desen (pattern)**, sağında bir
  ifade. Kollar virgülle ayrılır.
- Rust kolları **yukarıdan aşağıya** dener; değere uyan **ilk** kolun ifadesi çalışır ve diğer kollara
  hiç bakılmaz.
- Kolun sağında birden fazla iş yapacaksan süslü parantezli bir **blok** yaz (`Madeni::Lira1 => { ... }`).
  Modül 3'ten hatırla: bir bloğun değeri, sonundaki noktalı virgülsüz ifadedir; burada `100`. Bloktan
  sonraki virgül isteğe bağlıdır.
- `match` bir **ifadedir**, yani bir değer üretir. Burada ürettiği değer fonksiyonun dönüş değeri oluyor;
  istersen bir değişkene de atayabilirsin: `let deger = match para { ... };`

:::analogy Para ayırma makinesi
Bankalardaki bozuk para ayırma makinelerini düşün: para eğimli bir oluktan kayar ve sığdığı **ilk**
deliğe düşer. Her delik bir desendir. Her para tam olarak bir deliğe düşer ve düştükten sonra diğer
deliklere bakılmaz. Rust'ın makinesinin bir farkı var: daha çalışmaya başlamadan her para türü için bir
delik açıldığını da kontrol eder. Bunu bir sonraki adımda göreceksin.
:::

`match` bir değer üretiyorsa, o değerin tipi ne olur? Bu kod derlenir mi?

```compiles
code: |
  enum Madeni {
      Kurus50,
      Lira1,
  }

  fn main() {
      let para = Madeni::Lira1;
      let deger = match para {
          Madeni::Kurus50 => 50,
          Madeni::Lira1 => "bir lira",
      };
      println!("{deger}");
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308**, *`match` arms have incompatible types* ("kolların tipleri uyumsuz").
  `match` tek bir değer üretir ve her değerin tek bir tipi vardır; bu yüzden **bütün kollar aynı tipte
  değer üretmelidir**. İlk kol bir tamsayı üretiyor, ikincisi bir `&str`. Derleyici ilk kolun tipini
  esas alır ve ikinci kol için *expected integer, found `&str`* der. Modül 3'te `if` ile `else`
  dallarının aynı tipte olması gerektiğini görmüştün; kural aynı. Çözüm, kolları aynı tipe getirmek:
  ya ikisi de sayı (`100`) ya da ikisi de metin (`"50 kuruş"`).
```

:::info Başka dillerde switch
C, Java ve JavaScript'te benzer işi `switch` yapar. İki önemli fark var:

- `switch`'te bir `case`'in sonuna `break` yazmayı unutursan program bir sonraki `case`'e de "düşer"
  (fallthrough). Bu, yıllardır bilinen bir hata kaynağıdır. `match`'te düşme yoktur: yalnızca uyan kol çalışır.
- `switch` çoğu zaman bir deyimdir (statement), değer üretmez. `match` ise bir ifadedir.

Üçüncü ve en önemli fark bir sonraki adımda.
:::

## Eksiksizlik: hiçbir durum unutulmaz

1. dersteki `adim` fonksiyonunu hatırla. Kollardan birini sildik. Bu kod derlenir mi?

```compiles
code: |
  enum Yon {
      Kuzey,
      Guney,
      Dogu,
      Bati,
  }

  fn adim(yon: Yon) -> (i32, i32) {
      match yon {
          Yon::Kuzey => (0, 1),
          Yon::Guney => (0, -1),
          Yon::Dogu => (1, 0),
      }
  }

  fn main() {
      let (dx, dy) = adim(Yon::Kuzey);
      println!("{dx} {dy}");
  }
answer: false
error: E0004
explanation: |
  Derlenmez: **E0004**. `Yon`'un dört varyantı var ama `match` yalnızca üçünü ele alıyor. `yon`
  değeri `Yon::Bati` olursa fonksiyon ne döndürecek? Bu sorunun cevabı olmadığı için Rust programı
  derlemez. Hata mesajını hemen aşağıda birlikte okuyalım.
```

:::error
```text
error[E0004]: non-exhaustive patterns: `Yon::Bati` not covered
  --> src/main.rs:9:11
   |
 9 |     match yon {
   |           ^^^ pattern `Yon::Bati` not covered
   |
note: `Yon` defined here
  --> src/main.rs:1:6
   |
 1 | enum Yon {
   |      ^^^
...
 5 |     Bati,
   |     ---- not covered
   = note: the matched value is of type `Yon`
help: ensure that all possible cases are being handled by adding a match arm with a wildcard pattern or an explicit pattern as shown
   |
12 ~         Yon::Dogu => (1, 0),
13 ~         Yon::Bati => todo!(),
```
- *non-exhaustive patterns*: "desenler bütün durumları kapsamıyor." Eksik olanı adıyla söyler:
  `Yon::Bati`.
- *note*: enum'un nerede tanımlandığını ve hangi varyantın açıkta kaldığını (`---- not covered`) gösterir.
- *help*: düzeltmeyi bile yazar: eksik varyant için bir kol ekle. Önerdiği `todo!()`, alıştırmaların
  başlangıç kodlarından tanıdığın "burası henüz yazılmadı" makrosudur: kod derlenir ama o kola gelinirse
  program panikler. Hiçbir zaman bir değer üretmediği için her tipin yerine geçebilir.
:::

Bu denetime **eksiksizlik denetimi (exhaustiveness checking)** denir: bir `match`, incelediği tipin
**bütün** olası değerlerini kapsamak zorundadır. Derleyici bunu yapabilir, çünkü enum'lar kapalı
kümelerdir (1. ders): bütün varyantlar tek bir yerde tanımlıdır, gizli bir beşinci yön yoktur.

Bunun gücü program büyüdükçe ortaya çıkar. Altı ay sonra oyununa çapraz hareket eklemek istediğini düşün
ve `Yon`'a `KuzeyDogu` varyantını ekle. O anda `Yon` üzerinde yazılmış **her** `match` (yürüme, çizim,
kaydetme...) bu hatayı verir ve derleyici sana dosya ve satır numarasıyla bir yapılacaklar listesi çıkarır.
Unutulan bir durum, kullanıcının karşılaştığı bir hata (bug) olmak yerine bir derleme hatası olur. Rust
programcılarının "derleniyorsa büyük ihtimalle çalışır" demesinin önemli bir nedeni budur.

Aynı koruma `Option` için de geçerli ve 2. dersteki null sorununun asıl çözümü bu. `None` kolunu unutursan:

```rust,compile_fail,E0004
fn main() {
    let indirim: Option<u32> = Some(20);
    match indirim {
        Some(oran) => println!("%{oran} indirim"),
    }
}
```

:::error
```text
error[E0004]: non-exhaustive patterns: `None` not covered
   --> src/main.rs:3:11
    |
  3 |     match indirim {
    |           ^^^^^^^ pattern `None` not covered
    |
...
    = note: the matched value is of type `Option<u32>`
help: ensure that all possible cases are being handled by adding a match arm with a wildcard pattern or an explicit pattern as shown
    |
  4 ~         Some(oran) => println!("%{oran} indirim"),
  5 ~         None => todo!(),
```
Java'da `null` kontrolünü unutmak, programın çalışırken `NullPointerException` ile çökmesi demekti.
Rust'ta `None`'u unutmak bir **derleme hatasıdır**: hata kullanıcıya ulaşmadan yakalanır.
:::

:::ferris
Bu hata seni azarlamak için değil: derleyici senin yerine yoklama alıyor. Listede adı olup da
"burada!" demeyen bir varyant varsa hemen söylüyor. 🦀
:::

:::info Bir istisna: #[non_exhaustive]
Kütüphaneler bazen bir enum'u `#[non_exhaustive]` niteliğiyle işaretler: "İleride yeni varyantlar
ekleyebilirim." Böyle bir enum'u **başka bir crate'ten** eşleştirirken bütün varyantları tek tek yazsan
bile bir `_` kolu zorunludur; yoksa E0004 alırsın ve derleyici nedenini yazar: *`ErrorKind` is marked as
non-exhaustive, so a wildcard `_` is necessary*. Standart kütüphanedeki `std::io::ErrorKind` (Modül 10)
böyle bir enum'dur. Bedeli şu: kütüphane yeni bir varyant eklediğinde kodun derlenmeye devam eder, ama
derleyici seni yeni durum için uyaramaz. Kendi crate'inin içinde bu nitelik eksiksizlik denetimini
etkilemez.
:::

## Desenlerle değer yakalamak

1. derste `Mesaj::Yaz(metin)` gibi desenlerin varyantın içindeki değeri yakaladığını gördün. `Option` da
bir enum olduğuna göre aynı şey `Some` için de geçerli. Üstelik desenin içine bir değişken adı yerine
**sabit bir değer** de yazabilirsin; o zaman desen yalnızca o değere uyar:

```rust
fn stok_mesaji(adet: Option<u32>) -> String {
    match adet {
        None => String::from("Bu ürünü satmıyoruz"),
        Some(0) => String::from("Tükendi"),
        Some(1) => String::from("Son 1 ürün!"),
        Some(n) => format!("Stokta {n} adet var"),
    }
}

fn main() {
    for adet in [Some(12), Some(1), Some(0), None] {
        println!("{}", stok_mesaji(adet));
    }
}
```

- `Some(n)`: "içinde bir değer varsa onu `n` adlı yeni değişkene **bağla**." `n` yalnızca o kolda geçerlidir.
- `Some(0)`: "içinde değer var **ve** o değer `0`." Bu desen hem varyantı hem içindeki değeri sınar.
- Sıra önemli: `Some(0)` ve `Some(1)`, `Some(n)`'den **önce** gelmeli. `Some(n)` her `Some`'a uyar;
  önde olsaydı 0 ve 1 de ona takılırdı. Kural basit: **özel durumlar önce, genel durum sonra.**

Şimdi sıra sende. Bu sefer fonksiyon yeniden bir `Option` döndürüyor: "kutuyu aç, içindekiyle hesap
yap, sonucu yine kutuya koy." Rust'ta çok sık yazacağın bir kalıptır bu.

```fill
prompt: |
  Boşlukları doldur: fiyat biliniyorsa indirimli fiyatı döndür, bilinmiyorsa "fiyat yok" anlamına gelen değeri döndür.
code: |
  fn indirimli_fiyat(fiyat: Option<u32>, yuzde: u32) -> Option<u32> {
      match fiyat {
          ___0 => Some(f - f * yuzde / 100),
          None => ___1,
      }
  }

  fn main() {
      let a = indirimli_fiyat(Some(200), 25);
      let b = indirimli_fiyat(None, 25);
      println!("{a:?} {b:?}");
  }
blanks:
  - ["Some(f)"]
  - ["None"]
output: "Some(150) None"
explanation: |
  Kolun sağında `f` kullanıldığı için desen, değeri `f` adıyla yakalamalı: `Some(f)`. Fiyat yoksa
  hesaplanacak bir şey de yoktur; dönüş tipi `Option<u32>` olduğu için "yok"un karşılığı `None`'dır.
  Hesap: `200 - 200 * 25 / 100 = 150`. (Option'ın bu "aç, hesapla, yeniden sar" işini tek satırda yapan
  `map` metodunu Modül 10'da göreceksin; içine verilen closure'ları Modül 14'te derinlemesine öğreneceksin.)
```

Desenlerin sahiplikle de bir ilişkisi var. Modül 4'ü hatırlayarak tahmin et: bu kod derlenir mi?

```compiles
code: |
  #[derive(Debug)]
  enum Mesaj {
      Yaz(String),
      Cik,
  }

  fn main() {
      let m = Mesaj::Yaz(String::from("selam"));
      match m {
          Mesaj::Yaz(metin) => println!("Gelen: {metin}"),
          Mesaj::Cik => println!("Çıkış"),
      }
      println!("{m:?}");
  }
answer: false
error: E0382
explanation: |
  Derlenmez: **E0382**, *borrow of partially moved value: `m`*. `Mesaj::Yaz(metin)` deseni, `m`'nin
  içindeki `String`'i `metin` değişkenine **taşır** (move); tıpkı `let metin = ...;` gibi. `String`
  `Copy` olmadığı için `m`'nin bir parçası artık başkasına ait: `m` **kısmen taşınmış (partially moved)**
  durumda ve son satırda kullanılamaz. Derleyici nedenini de yazar: *partial move occurs because value
  has type `String`, which does not implement the `Copy` trait*.
```

Çözüm, değeri sahiplenmek yerine **ödünç almak**: `match m` yerine `match &m` yaz.

```rust
# #[allow(dead_code)]
#[derive(Debug)]
enum Mesaj {
    Yaz(String),
    Cik,
}

fn main() {
    let m = Mesaj::Yaz(String::from("selam"));
    match &m {
        Mesaj::Yaz(metin) => println!("Gelen: {metin} ({} harf)", metin.len()),
        Mesaj::Cik => println!("Çıkış"),
    }
    println!("{m:?}"); // m hâlâ bizim
}
```

Bir referans üzerinde `match` yaptığında desenin bağladığı `metin` de bir referans olur: `&String`. Bu,
1. derste `&self` alan metotlarda bağlanan değerlerin neden referans olduğunun da açıklaması. İki durumu
yan yana görelim:

```memory
title: "`match m` ile `match &m` arasındaki fark"
steps:
  - caption: "Başlangıç: `m` bir `Mesaj::Yaz`. String'in başlığı (işaretçi, uzunluk, kapasite) `m`'nin kutusunda, harfler heap'te."
    stack:
      - frame: main
        vars:
          - { name: m, type: Mesaj, value: "etiket: Yaz │ ptr · len=5 · cap=5", to: h1 }
    heap:
      - { id: h1, value: "s e l a m" }
  - caption: "`match m { Mesaj::Yaz(metin) => ... }`: String `metin`'e taşındı. `m` kısmen taşınmış (gri) ve match'ten sonra kullanılamaz."
    stack:
      - frame: main
        vars:
          - { name: m, type: Mesaj, value: "etiket: Yaz │ (taşındı)", moved: true }
          - { name: metin, type: String, value: "ptr · len=5 · cap=5", to: h1 }
    heap:
      - { id: h1, value: "s e l a m" }
  - caption: "Diğer yol, `match &m { Mesaj::Yaz(metin) => ... }`: `metin` yalnızca `m`'nin içindeki String'i gösteren bir `&String`. Sahiplik `m`'de kalıyor."
    stack:
      - frame: main
        vars:
          - { name: m, type: Mesaj, value: "etiket: Yaz │ ptr · len=5 · cap=5", to: h1 }
          - { name: metin, type: "&String", value: "referans", to: m }
    heap:
      - { id: h1, value: "s e l a m" }
```

:::deep ref ne demek? Varsayılan bağlama kipleri
Derleyici E0382'de `Mesaj::Yaz(ref metin)` yazmayı da önerir. `ref`, desende "bu değeri taşıma, ona bir
referans bağla" demenin eski yoludur. Bugün çoğu zaman gerekmez: bir **referans** üzerinde `match`
yaptığında (`match &m`, `&self` metotlarında `match self`, `for m in &liste` içindeki `m`), Rust deseni
referansın gösterdiği değere uygular ve bağladığı her değişkeni otomatik olarak referans yapar. Buna
**varsayılan bağlama kipleri (default binding modes)** denir; İngilizce kaynaklarda *match ergonomics*
adıyla da geçer. Ayrıntılarını Modül 21'de göreceğiz.
:::

## Geriye kalanlar: hepsini yakalayan kollar

Enum'larda her varyantı tek tek yazabiliyordun. Ama tamsayılar öyle değil: bir zar yalnızca 1–6 arası
değer alsa da onu tutan `i32` tipinin dört milyardan fazla olası değeri var ve derleyici yalnızca tipe
bakar. Hepsini yazamazsın, eksiksizlik kuralı da hâlâ geçerli. Çözüm, **geriye kalan her şeyi yakalayan
(catch-all)** bir kol:

```rust
fn main() {
    for zar in [6, 3, 1, 4] {
        let mesaj = match zar {
            6 => String::from("Bir tur daha at!"),
            1 => String::from("Sıra rakibe geçti"),
            diger => format!("{diger} kare ilerle"),
        };
        println!("{zar}: {mesaj}");
    }
}
```

- Desen olarak yalnızca bir değişken adı yazarsan (`diger`), o desen **her değere uyar** ve değeri o ada bağlar.
- Değere ihtiyacın yoksa `_` yaz: o da her şeye uyar ama hiçbir şey bağlamaz; örneğin
  `_ => String::from("Normal hamle")`. Kullanmadığın bir değişken adı yazarsan derleyici *unused variable*
  uyarısı verip `_` önerir.
- Hepsini yakalayan kol **en sona** yazılır. Önce yazarsan sonraki kollara hiçbir değer ulaşamaz;
  derleyici *unreachable pattern* ("ulaşılamaz desen") uyarısı verir.

Şimdi sinsi bir tuzak. Modül 2'deki gölgelemeyi (shadowing) hatırlayarak tahmin et:

```predict
code: |
  fn main() {
      let hedef = 7;
      let zar = 3;
      let sonuc = match zar {
          hedef => "kazandın!",
          _ => "kaybettin",
      };
      println!("{sonuc}");
  }
options:
  - "kaybettin"
  - "kazandın!"
  - "Derlenmez"
answer: 1
explanation: |
  Şaşırtıcı ama sonuç `kazandın!`. Desendeki `hedef`, yukarıdaki `hedef` değişkeniyle
  **karşılaştırılmaz**. Desende tek başına duran bir ad **yeni bir değişken** tanımlar ve her değere uyar.
  Yani bu kol "zar 7 ise" demiyor; "zar ne olursa olsun, onu `hedef` adlı yeni bir değişkene bağla"
  diyor. Modül 2'deki gölgelemede olduğu gibi, yeni `hedef` dıştakini gizler.

  Program derlenir, ama derleyici üç uyarı verir: `_` koluna ulaşılamadığını (*unreachable pattern*),
  iki `hedef`'in de kullanılmadığını ve şu notu: *if you meant to pattern match against the value of that
  binding, that is a feature of constants that is not available for `let` bindings*. Yani bir değerle
  karşılaştırmak istiyorsan bir **sabit** (`const`) kullanmalısın.
```

Sabitler (Modül 2) desenlerde **değer olarak** kullanılabilir. `SCREAMING_SNAKE_CASE` yazımı da hem sana
hem derleyiciye "bu yeni bir değişken değil, bir sabit" der:

```rust
const HEDEF: u8 = 7;

fn sonuc(zar: u8) -> &'static str {
    match zar {
        HEDEF => "kazandın!",
        _ => "kaybettin",
    }
}

fn main() {
    for zar in [3, 7] {
        println!("{zar}: {}", sonuc(zar));
    }
}
```

Program çalışırken belirlenen bir değerle karşılaştırman gerekiyorsa `if` kullan; Modül 21'de bunun için
`match`'in kendi aracını (match guard) da göreceksin. Bu tuzağın enum'lardaki hâlini ise derleyici
doğrudan **hata** olarak yakalar. `Yon::` önekini unutup `match y { Kuzey => ..., Guney => ... }` yazarsan
`Kuzey` bir varyant değil, yeni bir değişken adı olur:

:::error
```text
error[E0170]: pattern binding `Kuzey` is named the same as one of the variants of the type `Yon`
 --> src/main.rs:9:9
  |
9 |         Kuzey => println!("kuzeye"),
  |         ^^^^^ help: to match on the variant, qualify the path: `Yon::Kuzey`
  |
  = note: `#[deny(bindings_with_variant_name)]` on by default
```
"Desendeki `Kuzey` adı, `Yon`'un bir varyantıyla aynı. Varyantı kastediyorsan yolu tam yaz: `Yon::Kuzey`."
:::

:::warning use Yon::*; ve yazım hatası
`use Yon::*;` yazarak varyantları öneksiz kullanabilirsin (bu modülün bir alıştırmasında `use Jeton::*;`
göreceksin). O zaman `Kuzey => ...` gerçekten varyantı eşleştirir. Ama bir varyant adını **yanlış**
yazarsan (`Kuzye`), o ad hiçbir varyanta eşit olmadığı için E0170 de gelmez: desen sessizce her şeye uyan
yeni bir değişken olur. Program derlenir, yalnızca uyarı verir ve `y` `Guney` olsa bile `Kuzye` kolu
çalışır. Uyarıları okumanın neden önemli olduğuna güzel bir örnek; desenlerde `Yon::Kuzey` gibi tam yolu
yazmak bu tuzağı tamamen kapatır.
:::

```quiz
question: |
  `Yon` enum'una yeni bir `KuzeyDogu` varyantı ekledin. Programında `Yon` üzerinde iki `match` var:
  biri dört yönü tek tek ele alıyor, diğeri yalnızca `Yon::Kuzey => ...` ve `_ => ...` kollarından
  oluşuyor. Ne olur?
options:
  - "İki `match` de derlenmez"
  - "Yönleri tek tek yazan `match` derlenmez (E0004); `_` kolu olan derlenir ve `KuzeyDogu`'yu sessizce `_` koluna gönderir"
  - "İkisi de derlenir; program çalışırken `KuzeyDogu` gelince panikler"
  - "İkisi de derlenir; `KuzeyDogu` için hiçbir kol çalışmaz"
answer: 1
explanation: |
  `_` "geriye kalan her şey" demektir ve yeni eklenen varyantlar da bu "her şey"in içindedir. Bu yüzden
  `_` kolu olan `match` derlenmeye devam eder; yeni yön, belki de istemediğin bir davranışla `_` koluna
  düşer. Varyantları tek tek yazan `match` ise E0004 verir ve seni yeni varyantı düşünmeye zorlar.

  Pratik kural: Enum'larda, gerçekten "geriye kalanların hepsi aynı" değilse `_` yerine varyantları açıkça
  yaz ve derleyicinin yoklamasından yararlan. Sayılar ve karakterler gibi tek tek yazılamayacak tiplerde
  ise `_` ya da değişkenli bir kol kaçınılmazdır.
feedback:
  - "`_` yeni varyantı da kapsadığı için o `match` derlenir."
  - "Doğru! `_` kullanışlıdır ama derleyicinin seni uyarma imkânını da elinden alır."
  - "Rust'ta eksik bir kol çalışma zamanında değil, derleme zamanında yakalanır."
  - "`match` her zaman tam olarak bir kol çalıştırır; eksik kol olsaydı program zaten derlenmezdi."
```

````exercise
id: m07-e-hesap-makinesi
title: Güvenli hesap makinesi
difficulty: 2
prompt: |
  Bir hesap makinesi dört işlemi `Islem` enum'uyla temsil ediyor; her varyant iki sayı taşıyor.
  `hesapla` fonksiyonunu `match` ile tamamla:

  - `Topla`, `Cikar`, `Carp`: sonucu `Some` içinde döndür. `Cikar(a, b)`, `a - b` demektir.
  - `Bol`: tam sayı bölmesi yap (`17 / 5 = 3`, Modül 2). Ama ikinci sayı `0` ise sonuç tanımsızdır;
    bu durumda `None` döndür.

  Sıfıra bölmeyi `if` ile değil, **bir desenle** yakala.
starter: |
  enum Islem {
      Topla(i32, i32),
      Cikar(i32, i32),
      Carp(i32, i32),
      Bol(i32, i32),
  }

  fn hesapla(islem: Islem) -> Option<i32> {
      todo!()
  }

  fn main() {
      let islemler = [
          Islem::Topla(2, 3),
          Islem::Cikar(3, 10),
          Islem::Carp(6, 7),
          Islem::Bol(17, 5),
          Islem::Bol(10, 0),
      ];
      for islem in islemler {
          match hesapla(islem) {
              Some(sonuc) => println!("Sonuç: {sonuc}"),
              None => println!("Hata: sıfıra bölme!"),
          }
      }
  }
solution: |
  enum Islem {
      Topla(i32, i32),
      Cikar(i32, i32),
      Carp(i32, i32),
      Bol(i32, i32),
  }

  fn hesapla(islem: Islem) -> Option<i32> {
      match islem {
          Islem::Topla(a, b) => Some(a + b),
          Islem::Cikar(a, b) => Some(a - b),
          Islem::Carp(a, b) => Some(a * b),
          Islem::Bol(_, 0) => None,
          Islem::Bol(a, b) => Some(a / b),
      }
  }

  fn main() {
      let islemler = [
          Islem::Topla(2, 3),
          Islem::Cikar(3, 10),
          Islem::Carp(6, 7),
          Islem::Bol(17, 5),
          Islem::Bol(10, 0),
      ];
      for islem in islemler {
          match hesapla(islem) {
              Some(sonuc) => println!("Sonuç: {sonuc}"),
              None => println!("Hata: sıfıra bölme!"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn toplama_ve_cikarma() {
      assert_eq!(hesapla(Islem::Topla(2, 3)), Some(5), "2 + 3 = 5 olmalı");
      assert_eq!(hesapla(Islem::Topla(-4, 4)), Some(0), "-4 + 4 = 0 olmalı");
      assert_eq!(hesapla(Islem::Cikar(3, 10)), Some(-7), "Cikar(3, 10) = 3 - 10 = -7 olmalı (sıra önemli!)");
  }

  #[test]
  fn carpma() {
      assert_eq!(hesapla(Islem::Carp(6, 7)), Some(42), "6 x 7 = 42 olmalı");
      assert_eq!(hesapla(Islem::Carp(-4, 5)), Some(-20), "-4 x 5 = -20 olmalı");
  }

  #[test]
  fn bolme_tam_sayi_bolmesidir() {
      assert_eq!(hesapla(Islem::Bol(17, 5)), Some(3), "17 / 5 tam sayı bölmesinde 3'tür");
      assert_eq!(hesapla(Islem::Bol(-9, 3)), Some(-3), "-9 / 3 = -3 olmalı");
      assert_eq!(hesapla(Islem::Bol(0, 4)), Some(0), "0 / 4 = 0: bölünen sıfır olabilir, bölen olamaz");
  }

  #[test]
  fn sifira_bolme_none_dondurur() {
      assert_eq!(hesapla(Islem::Bol(5, 0)), None, "bir sayı sıfıra bölünemez: None bekleniyordu");
      assert_eq!(hesapla(Islem::Bol(0, 0)), None, "0 / 0 da tanımsızdır: None bekleniyordu");
  }
hints:
  - "Her varyant için bir kol yaz ve iki sayıyı desende yakala: `Islem::Topla(a, b) => Some(a + b),`"
  - "Bölme için iki kol gerekir. Desenin içine sabit bir değer yazabilirsin: `Islem::Bol(_, 0)` yalnızca ikinci sayı `0` olduğunda uyar."
  - "Sıra önemli: `Islem::Bol(_, 0) => None,` kolunu `Islem::Bol(a, b) => Some(a / b),` kolundan **önce** yaz. Tersini yaparsan sıfıra bölme de genel kola düşer ve program panikler."
require:
  - pattern: 'Bol\s*\(\s*(\w+|\.\.)\s*,\s*0\s*\)\s*=>'
    message: "Sıfıra bölmeyi `if` ile değil, `Islem::Bol(_, 0) => ...` gibi bir match koluyla yakala."
explanation: |
  `Islem::Bol(_, 0)` deseni iki şeyi birden sınar: varyant `Bol` mu ve ikinci sayı `0` mı? İlk sayıyı
  umursamadığımız için `_` kullandık. Kolların sırası kritik: genel `Islem::Bol(a, b)` kolu önde olsaydı
  `Bol(5, 0)` ona uyardı ve `5 / 0` programı *attempt to divide by zero* paniğiyle çökertirdi. Üstelik
  derleyici, arkada kalan `Bol(_, 0)` koluna hiçbir değerin ulaşamayacağını söyleyen bir uyarı verirdi.

  Dönüş tipinin `Option<i32>` olması "sonuç olmayabilir" bilgisini tipe yazıyor: `hesapla`'yı çağıran
  herkes `None` durumunu ele almak zorunda. `main`'deki `match` da tam olarak bunu yapıyor.

  Bir adım öteye: tamsayı işlemleri taşabilir de (Modül 2). Bölmenin bile bir taşma durumu var:
  `i32::MIN / -1` sonucu (2 147 483 648) `i32`'ye sığmaz ve bu işlem, toplama ile çarpmanın aksine
  **release modunda da** *attempt to divide with overflow* paniği verir. Modül 2'de gördüğün `checked_add`'in
  `checked_sub`, `checked_mul` ve `checked_div` adlı kardeşleri, taşmada ya da sıfıra bölmede panik yerine
  `None` döndürür; gerçekten güvenli bir hesap makinesi şöyle yazılır:

  ```rust
  Islem::Topla(a, b) => a.checked_add(b),
  Islem::Cikar(a, b) => a.checked_sub(b),
  Islem::Carp(a, b) => a.checked_mul(b),
  Islem::Bol(a, b) => a.checked_div(b),
  ```
````

## Sayılar, aralıklar ve tuple'lar

Puanı harf notuna çeviren bir fonksiyon düşün. Her puanı tek tek yazmak yerine **aralık (range)**
desenleri kullanabilirsin: `70..=89` deseni 70 ile 89 arasındaki (ikisi de dahil) her değere uyar. İlk
deneme:

```rust,compile_fail,E0004
fn harf_notu(puan: u8) -> char {
    match puan {
        90..=100 => 'A',
        70..=89 => 'B',
        50..=69 => 'C',
        0..=49 => 'F',
    }
}

fn main() {
    println!("{}", harf_notu(75));
}
```

:::error
```text
error[E0004]: non-exhaustive patterns: `101_u8..=u8::MAX` not covered
 --> src/main.rs:2:11
  |
2 |     match puan {
  |           ^^^^ pattern `101_u8..=u8::MAX` not covered
  |
  = note: the matched value is of type `u8`
help: ensure that all possible cases are being handled by adding a match arm with a wildcard pattern or an explicit pattern as shown
  |
6 ~         0..=49 => 'F',
7 ~         101_u8..=u8::MAX => todo!(),
```
Eksiksizlik denetimi sayılarda da çalışır! Derleyici `u8`'in 0'dan 255'e kadar değer alabildiğini bilir
ve 101 ile `u8::MAX` (255) arasının açıkta kaldığını söyler. "Puan zaten 100'ü geçmez" diye düşünebilirsin,
ama tip bunu garanti etmiyor; `harf_notu(140)` çağrısını hiçbir şey engellemiyor.
:::

Peki 140 puanın harf notu ne olmalı? Hiçbiri! "Sonuç olmayabilir" demenin yolunu 2. derste öğrendin:

```rust
fn harf_notu(puan: u8) -> Option<char> {
    match puan {
        90..=100 => Some('A'),
        70..=89 => Some('B'),
        50..=69 => Some('C'),
        0..=49 => Some('F'),
        _ => None,
    }
}

fn main() {
    for puan in [95, 70, 69, 12, 140] {
        match harf_notu(puan) {
            Some(not) => println!("{puan} puan → {not}"),
            None => println!("{puan} puan → geçersiz puan!"),
        }
    }
}
```

Aralıklar örtüşürse ne olur? Tahmin et:

```predict
code: |
  fn main() {
      for puan in [100, 85, 40] {
          let sonuc = match puan {
              100 => "tam puan!",
              50..=100 => "geçti",
              _ => "kaldı",
          };
          println!("{puan}: {sonuc}");
      }
  }
options:
  - |
    100: tam puan!
    85: geçti
    40: kaldı
  - |
    100: geçti
    85: geçti
    40: kaldı
  - |
    100: tam puan!
    100: geçti
    85: geçti
    40: kaldı
  - Derlenmez
answer: 0
explanation: |
  Kollar yukarıdan aşağıya denenir ve **yalnızca ilk uyan** kol çalışır. `100` hem `100` desenine hem
  de `50..=100` aralığına uyar; önce `100` kolu geldiği için `"tam puan!"` seçilir ve gerisine bakılmaz.
  Desenlerin örtüşmesi hata değildir: "özel durum önce, genel durum sonra" düzeni tam da böyle çalışır.
  Sırayı ters çevirseydin (`50..=100` önce) `100` koluna hiçbir değer ulaşamazdı ve derleyici
  *unreachable pattern* uyarısı verirdi.
```

:::tip Dahil mi, hariç mi?
`1..=5` deseni 5'i **dahil** eder. Rust 1.80'den beri desenlerde `1..5` (5 **hariç**) de yazılabilir;
Modül 3'teki `for i in 1..5` ile aynı anlamdadır. İki aralığın uçları çakışırsa (`0..=10` ve `10..=20`)
derleyici *multiple patterns overlap on their endpoints* uyarısı verir: 10 hangi kola gitmeli? Büyük
ihtimalle bir yazım hatası yaptın.
:::

Birden fazla değere aynı anda bakmak istersen onları bir **tuple**'da topla (Modül 2) ve tuple'ı eşleştir.
Programcıların klasik alıştırması FizzBuzz: 3'e bölünen sayılar yerine "Fizz", 5'e bölünenler yerine "Buzz",
ikisine de bölünenler yerine "FizzBuzz" yaz.

```rust
fn main() {
    for i in 1..=15 {
        let metin = match (i % 3, i % 5) {
            (0, 0) => String::from("FizzBuzz"),
            (0, _) => String::from("Fizz"),
            (_, 0) => String::from("Buzz"),
            _ => format!("{i}"),
        };
        print!("{metin} ");
    }
    println!();
}
```

`(0, _)` deseni "ilki sıfır, ikincisi ne olursa olsun" demektir. `(0, 0)` en üstte olmalı; yoksa 15
sayısı `(0, _)` koluna takılır ve "Fizz" yazılırdı. Bunu bir `if` / `else if` zinciriyle de yazabilirdin;
ama burada dört durum bir tablo gibi okunuyor ve derleyici hiçbirinin unutulmadığını garanti ediyor.

## Karakterler ve birden çok desen

`char` değerleri de eşleştirilebilir. `|` ("veya") ile birden fazla deseni tek bir kolda birleştirebilirsin:

```rust
fn harf_turu(c: char) -> &'static str {
    match c {
        'a' | 'e' | 'ı' | 'i' | 'o' | 'ö' | 'u' | 'ü' => "ünlü",
        'a'..='z' | 'ç' | 'ğ' | 'ş' => "ünsüz",
        '0'..='9' => "rakam",
        ' ' => "boşluk",
        _ => "başka bir şey",
    }
}

fn main() {
    for c in "şu 3!".chars() {
        println!("{c:?} → {}", harf_turu(c));
    }
}
```

- `"şu 3!".chars()` bir metnin karakterlerini sırayla verir. Bunu şimdilik hazır bir araç olarak kullan;
  metinlerin iç yapısını Modül 9'da ayrıntılı göreceğiz.
- `'a'..='z'` aralığı yalnızca İngilizce alfabedeki 26 harfi kapsar. `ç`, `ğ`, `ı`, `ö`, `ş`, `ü`
  Unicode'da bu aralığın dışındadır (Modül 2: `char` bir Unicode değeridir); bu yüzden onları `|` ile
  ayrıca yazdık. Bu ayrıntıyı unutmak, Türkçe metin işleyen programlarda çok yaygın bir hatadır.
- İkinci koldaki `'a'..='z'` ünlüleri de içeriyor, ama ünlüler zaten ilk kolda yakalandığı için buraya
  yalnızca ünsüzler ulaşır. Yine "ilk uyan kazanır" kuralı.

```fill
prompt: |
  Boşlukları doldur: rakamları bir **aralık** deseniyle yakala; geriye kalan her şey için, değeri
  kullanmayacağına göre en uygun deseni yaz.
code: |
  fn ses_turu(c: char) -> &'static str {
      match c {
          'a' | 'ı' | 'o' | 'u' => "kalın ünlü",
          'e' | 'i' | 'ö' | 'ü' => "ince ünlü",
          ___0 => "rakam",
          ___1 => "diğer",
      }
  }

  fn main() {
      for c in ['ı', 'ü', '7', 'ş'] {
          println!("{c}: {}", ses_turu(c));
      }
  }
blanks:
  - ["'0'..='9'"]
  - ["_"]
output: |
  ı: kalın ünlü
  ü: ince ünlü
  7: rakam
  ş: diğer
explanation: |
  `'0'..='9'` on rakamın hepsini tek bir desenle kapsar. Son kol geriye kalan her karakteri yakalamalı;
  değeri kullanmadığımız için `_` en uygunu (`diger` gibi bir ad da çalışırdı ama derleyici *unused
  variable* uyarısı verirdi). `'ş'` hiçbir ünlü koluna ve rakam aralığına uymadığı için `_` koluna düşer.
```

Türkçede kalın ünlüler (`a`, `ı`, `o`, `u`) ve ince ünlüler (`e`, `i`, `ö`, `ü`) ekleri belirler. Şimdi
bunu kullanarak gerçek bir dil kuralını kodlayacaksın.

````exercise
id: m07-e-cogul-eki
title: "Ünlü uyumu: çoğul eki"
difficulty: 3
prompt: |
  Türkçede çoğul eki, kelimenin **son ünlüsüne** göre seçilir (büyük ünlü uyumu):

  | Son ünlü | Ek | Örnek |
  |---|---|---|
  | kalın: `a`, `ı`, `o`, `u` | `"lar"` | kitap → kitap**lar**, kız → kız**lar** |
  | ince: `e`, `i`, `ö`, `ü` | `"ler"` | ev → ev**ler**, göz → göz**ler** |

  `cogul_eki` fonksiyonunu yaz: kelimenin son ünlüsüne göre `Some("lar")` ya da `Some("ler")`
  döndürsün; kelimede hiç ünlü yoksa (`"krş"` ya da boş metin gibi) `None` döndürsün. Kelimeler küçük
  harfle verilecek.

  Dikkat: önemli olan **ilk** değil **son** ünlü. "elma"nın ilk ünlüsü `e`, ama çoğulu "elmalar".
starter: |
  fn cogul_eki(kelime: &str) -> Option<&'static str> {
      todo!()
  }

  fn main() {
      for kelime in ["kitap", "ev", "elma", "kalem", "krş"] {
          match cogul_eki(kelime) {
              Some(ek) => println!("{kelime} → {kelime}{ek}"),
              None => println!("{kelime}: ünlü harf yok"),
          }
      }
  }
solution: |
  fn cogul_eki(kelime: &str) -> Option<&'static str> {
      let mut ek = None;
      for harf in kelime.chars() {
          match harf {
              'a' | 'ı' | 'o' | 'u' => ek = Some("lar"),
              'e' | 'i' | 'ö' | 'ü' => ek = Some("ler"),
              _ => {}
          }
      }
      ek
  }

  fn main() {
      for kelime in ["kitap", "ev", "elma", "kalem", "krş"] {
          match cogul_eki(kelime) {
              Some(ek) => println!("{kelime} → {kelime}{ek}"),
              None => println!("{kelime}: ünlü harf yok"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn kalin_unluyle_biten_kelimeler_lar_alir() {
      assert_eq!(cogul_eki("kitap"), Some("lar"), "kitap → kitaplar (son ünlü 'a')");
      assert_eq!(cogul_eki("kız"), Some("lar"), "kız → kızlar (son ünlü 'ı')");
      assert_eq!(cogul_eki("top"), Some("lar"), "top → toplar (son ünlü 'o')");
      assert_eq!(cogul_eki("okul"), Some("lar"), "okul → okullar (son ünlü 'u')");
  }

  #[test]
  fn ince_unluyle_biten_kelimeler_ler_alir() {
      assert_eq!(cogul_eki("ev"), Some("ler"), "ev → evler (son ünlü 'e')");
      assert_eq!(cogul_eki("kedi"), Some("ler"), "kedi → kediler (son ünlü 'i')");
      assert_eq!(cogul_eki("göz"), Some("ler"), "göz → gözler (son ünlü 'ö')");
      assert_eq!(cogul_eki("gül"), Some("ler"), "gül → güller (son ünlü 'ü')");
  }

  #[test]
  fn ilk_degil_son_unlu_belirler() {
      assert_eq!(cogul_eki("elma"), Some("lar"), "elma → elmalar: ilk ünlü 'e' ama son ünlü 'a'");
      assert_eq!(cogul_eki("kalem"), Some("ler"), "kalem → kalemler: ilk ünlü 'a' ama son ünlü 'e'");
      assert_eq!(cogul_eki("otobüs"), Some("ler"), "otobüs → otobüsler: son ünlü 'ü'");
      assert_eq!(cogul_eki("bilgisayar"), Some("lar"), "bilgisayar → bilgisayarlar: son ünlü 'a'");
  }

  #[test]
  fn unlusuz_kelimede_none() {
      assert_eq!(cogul_eki("krş"), None, "\"krş\" içinde hiç ünlü yok: None bekleniyordu");
      assert_eq!(cogul_eki(""), None, "boş metinde ünlü yok: None bekleniyordu");
  }
hints:
  - |
    `for harf in kelime.chars()` ile harfleri sırayla gez ve her harfi bir `match` ile sınıflandır:
    `'a' | 'ı' | 'o' | 'u' => ...`
  - |
    Döngüden önce `let mut ek = None;` tanımla. Kalın bir ünlü görünce `ek = Some("lar")`, ince bir ünlü
    görünce `ek = Some("ler")` yap. Döngü bittiğinde `ek`, son görülen ünlüye göre ayarlanmış olur.
  - |
    Ünlü olmayan harfler için `_ => {}` kolu yaz: `{}` hiçbir şey yapmayan boş bir bloktur. Fonksiyonun
    sonunda da noktalı virgülsüz `ek` yaz ki değeri döndürülsün.
explanation: |
  Çözüm, son ünlüyü "hatırlamak" için bir `Option` kullanıyor: başta `None` (henüz ünlü görmedik), her
  ünlüde güncelleniyor. Döngü bittiğinde `ek` ya son ünlünün ekini taşıyor ya da hiç ünlü yoksa hâlâ
  `None`; yani ünlüsüz kelime durumu ayrıca bir kontrol gerektirmeden doğru sonucu veriyor.

  Buradaki `match` bir değer üretmiyor, atama yapıyor. Atamanın değeri `()`'dır; `_ => {}` kolu da `()`
  üretir. "Bütün kollar aynı tipte" kuralı yine sağlanıyor.

  Alternatif: kelimeyi sondan başa tarayıp ilk ünlüde hemen dönmek. Modül 3'teki `.rev()` karakterlerde
  de çalışır:

  ```rust
  for harf in kelime.chars().rev() {
      match harf {
          'a' | 'ı' | 'o' | 'u' => return Some("lar"),
          'e' | 'i' | 'ö' | 'ü' => return Some("ler"),
          _ => {}
      }
  }
  None
  ```

  Gerçek Türkçede istisnalar da var: saat → saat**ler**, gol → gol**ler**. Bunları ele almak için bir
  istisna listesi gerekir; koleksiyonları Modül 9'da öğreneceksin.
````

## Özet

:::remember
- `match deger { desen => ifade, ... }`: kollar yukarıdan aşağıya denenir, **ilk uyan** kol çalışır;
  düşme (fallthrough) yoktur.
- `match` bir ifadedir: bütün kollar **aynı tipte** değer üretmelidir (E0308).
- **Eksiksizlik:** kollar, tipin bütün olası değerlerini kapsamalıdır; eksik varsa E0004. Yeni bir varyant
  eklemek, onu ele almayan her `match`'i derleme hatasına çevirir.
- Desenler değer yakalar (`Some(n)`, `Mesaj::Yaz(metin)`) ve sabit değerleri sınayabilir (`Some(0)`,
  `Islem::Bol(_, 0)`). Özel kollar genel kollardan önce yazılır.
- Hepsini yakalayan kol: `diger =>` değeri bağlar, `_ =>` yok sayar; en sona yazılır. Desende tek başına
  duran bir ad **yeni bir değişkendir**; bir değerle karşılaştırmak için `const` kullan.
- `match m`, desenin yakaladığı `String`'i taşır (kısmi taşıma, E0382); sahipliği korumak için `match &m`.
- Sayılarda ve karakterlerde aralıklar (`50..=69`, `'a'..='z'`) ve `|` kullanılır; `'a'..='z'` Türkçe
  harfleri kapsamaz.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla - `match`'in eksiksizlik denetimi büyüyen bir projede sana nasıl yardım
  eder? Bir enum üzerinde `_` kolu kullanmak bu yardımı neden azaltabilir?
answer: |
  Model cevap: Bir enum'a yeni bir varyant eklediğimde, o enum'u varyant varyant ele alan her `match`
  derleme hatası (E0004) verir ve derleyici bana hangi dosyada, hangi satırda neyi eksik bıraktığımı
  söyler. Böylece yeni durumu unutmam imkânsızlaşır; hatayı kullanıcı değil derleyici yakalar. `_` kolu
  ise "geriye kalan her şey" demek olduğu için yeni varyantı da sessizce yakalar: kod derlenmeye devam
  eder ve yeni durum, belki de yanlış bir varsayılan davranışa düşer. Bu yüzden enum'larda, gerçekten
  "gerisi hep aynı" değilse varyantları açıkça yazmak daha güvenlidir.
```

```flashcards
- front: "`match`'te birden fazla kol değere uyuyorsa hangisi çalışır?"
  back: Yukarıdan aşağıya ilk uyan kol. Diğerlerine hiç bakılmaz; düşme (fallthrough) yoktur.
- front: E0004 (non-exhaustive patterns) ne anlama gelir, nasıl düzeltilir?
  back: "`match` tipin bazı değerlerini kapsamıyor. Derleyicinin adını verdiği eksik durum için bir kol ekle ya da gerçekten gerekiyorsa `_ =>` kolu yaz."
- front: "`match`'in bütün kolları neden aynı tipte değer üretmek zorundadır?"
  back: "`match` bir ifadedir ve tek bir değer üretir; bir değerin de tek bir tipi olur. Uyumsuz kollar E0308 verir."
- front: "`diger => ...` ile `_ => ...` arasındaki fark nedir?"
  back: "İkisi de her değere uyar. `diger` değeri bir değişkene bağlar; `_` hiçbir şey bağlamaz, değeri yok sayar."
- front: "`let hedef = 7;` yazdıktan sonra `match zar { hedef => ..., _ => ... }` neden her zaman ilk kolu çalıştırır?"
  back: "Desendeki `hedef` dıştaki değişkenle karşılaştırılmaz; her değere uyan **yeni bir değişken** tanımlar. Karşılaştırma için `const HEDEF` kullanılır."
- front: "`match m { Mesaj::Yaz(metin) => ... }` sonrasında `m` neden kullanılamaz? Çözüm ne?"
  back: "`String`, `metin`'e taşındı ve `m` kısmen taşınmış oldu (E0382). Çözüm `match &m`: `metin` bir `&String` olur."
- front: "`puan: u8` için `0..=49` ve `50..=100` kolları neden yetmez?"
  back: "`u8` 255'e kadar gider; derleyici tipin bütün aralığını bilir ve `101_u8..=u8::MAX` için E0004 verir. `_` kolu ya da kalan aralık gerekir."
- front: "`'a'..='z'` deseni `'ş'` harfine uyar mı?"
  back: "Hayır. Aralık yalnızca İngilizce alfabedeki 26 harfi kapsar; `ç`, `ğ`, `ı`, `ö`, `ş`, `ü` ayrıca (`|` ile) yazılmalıdır."
```
