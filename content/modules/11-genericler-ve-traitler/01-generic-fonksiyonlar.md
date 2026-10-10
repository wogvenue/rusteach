---
id: m11-l01
title: Generic fonksiyonlar
minutes: 19
type: lesson
objectives:
  - Aynı mantığı farklı tipler için tekrarlayan fonksiyonları tek bir generic fonksiyonda birleştirebilmek
  - "`<T>` tip parametresini bildirip parametre ve dönüş tiplerinde kullanabilmek"
  - "`E0369` hatasını okuyup gereken trait sınırını (`T: PartialOrd`, `T: PartialEq`) ekleyebilmek"
  - Derleyici `T`'yi çıkaramadığında turbofish (`::<T>`) ya da tip notasyonu kullanabilmek
keywords: [generic, tip parametresi, "<T>", trait sınırı, PartialOrd, E0369, E0508, turbofish, E0282]
---

Modül 9'dan beri `Vec<i32>`, `Vec<String>`, `HashMap<String, u32>` yazıyorsun. Hiç düşündün mü:
`Vec`'i yazan Rust ekibi, senin içine hangi tipi koyacağını nereden biliyordu? **Bilmiyordu!**
`Vec<T>` bir **generic** tiptir: `T` yerine istediğin tipi koyarsın, derleyici gerisini halleder.
`Option<T>` ve `Result<T, E>` de öyle.

Bu modülde Rust'ın iki büyük soyutlama aracını öğreneceksin: **generic'ler** (tipten bağımsız kod) ve
**trait'ler** (tipler arası ortak davranış). İlk adım: kendi generic fonksiyonlarını yazmak.

:::ferris
Generic'ler ilk bakışta açılı parantez çorbası gibi görünebilir: `<T: PartialOrd>`... Korkma! Her parçayı
tek tek söküp anlamlandıracağız. Ders bittiğinde bu imzaları bir cümle gibi okuyacaksın. 🦀
:::

## Aynı kod, farklı tip

Bir hava durumu uygulamasında haftanın en yüksek sıcaklığını, bir kelime oyununda da alfabede en sonda
gelen harfi bulman gerekiyor. Modül 5'teki dilimlerle iki fonksiyon yazarsın:

```rust
fn en_buyuk_i32(liste: &[i32]) -> &i32 {
    let mut en_buyuk = &liste[0];
    for oge in liste {
        if oge > en_buyuk {
            en_buyuk = oge;
        }
    }
    en_buyuk
}

fn en_buyuk_char(liste: &[char]) -> &char {
    let mut en_buyuk = &liste[0];
    for oge in liste {
        if oge > en_buyuk {
            en_buyuk = oge;
        }
    }
    en_buyuk
}

fn main() {
    let sicakliklar = vec![18, 24, 31, 27, 22];
    println!("En yüksek sıcaklık: {}", en_buyuk_i32(&sicakliklar));

    let harfler = ['r', 'u', 's', 't'];
    println!("En büyük harf: {}", en_buyuk_char(&harfler));
}
```

İki gövde **harfi harfine aynı**; tek fark imzadaki tip. Yarın `f64` için, ertesi gün `&str` için bir kopya
daha mı yazacaksın? Kopyala-yapıştırın asıl bedeli yazma zahmeti değil, **bakımdır**: bir hatayı bir
kopyada düzeltir, ötekinde unutursun.

Diğer diller bu sorunu farklı yollarla çözer:

| Dil | Yaklaşım | Bedeli |
|---|---|---|
| Python / JavaScript | Tip denetimi yok; fonksiyon her şeyi kabul eder | `>` desteklemeyen bir değer verirsen hata **çalışma zamanında** patlar |
| C | Her tip için ayrı fonksiyon ya da `void*` | Ya tekrar ya da tip güvenliğinden vazgeçmek |
| Java | Generic'ler var ama derlemeden sonra tip bilgisi silinir (*type erasure*) | `int` gibi ilkel tipler doğrudan kullanılamaz, kutulama (boxing) gerekir |
| C++ | Şablonlar (*templates*) | Rust'a en yakın akraba; farkını birazdan göreceğiz |

Rust'ın cevabı: **generic fonksiyonlar**. Ama önce dilimleri hatırlayalım — generic fonksiyonlarımız
hep dilimlerle çalışacak.

```quiz
question: |
  (Modül 5 tekrarı) `fn en_buyuk_i32(liste: &[i32]) -> &i32` fonksiyonuna aşağıdakilerden **hangileri**
  doğrudan argüman olarak verilebilir? (`v` bir `Vec<i32>`, `d` bir `[i32; 4]` dizisi)
options:
  - "`&v`"
  - "`&d`"
  - "`&v[1..3]`"
  - "`v`"
answer: [0, 1, 2]
explanation: |
  `&[i32]` bir **dilimdir** (slice): başlangıç işaretçisi + uzunluk. `&v` (yani `&Vec<i32>`) deref
  zorlamasıyla, `&d` (yani `&[i32; 4]`) ise diziden dilime otomatik dönüşümle `&[i32]` olur; ikisi de
  bütün elemanları gösterir. `&v[1..3]` zaten bir bölümü gösteren bir dilimdir. `v` ise **sahipli** bir
  `Vec<i32>`'dir; referans değildir, tip uyuşmaz (`E0308`).
feedback:
  - "Doğru: `&Vec<i32>` otomatik olarak `&[i32]`'ye dönüşür."
  - "Doğru: dizi referansı da dilime dönüşür."
  - "Doğru: aralıkla alınan parça zaten bir `&[i32]` dilimidir."
  - "`v` sahipli bir `Vec`; fonksiyon ise referans bekliyor. `&v` yazmalısın."
```

## Tip parametresi: `<T>`

Çözüm, tipi de bir **parametre** yapmaktır. Normal parametreler *değerler* üzerinde soyutlama yapar
(`fn kare(x: i32)` her `x` için çalışır); **tip parametreleri (type parameters)** ise *tipler* üzerinde.

```text
fn ortadaki<T>(liste: &[T]) -> Option<&T>
           ───        ───             ──
            │          │              └── dönüş tipinde T
            │          └── parametre tipinde T
            └── T'yi BİLDİR: "bu fonksiyon her T tipi için yazıldı"
```

Bir değişkeni kullanmadan önce `let` ile bildirdiğin gibi, tip parametresini de kullanmadan önce fonksiyon
adının hemen ardından **açılı parantez** içinde bildirirsin. Okunuşu: *“`ortadaki`, herhangi bir `T` tipi
için: `T`'lerden oluşan bir dilim alır, bir `T` referansı içeren `Option` döndürür.”*

**Adlandırma geleneği:** tip parametreleri kısa ve `UpperCamelCase` olur. Tek parametre için `T` (*type*),
ikincisi için `U`; anlamlı harfler de yaygındır: `K`/`V` (*key/value* — `HashMap<K, V>`), `E` (*error* —
`Result<T, E>`).

```rust
fn ortadaki<T>(liste: &[T]) -> Option<&T> {
    if liste.is_empty() {
        None
    } else {
        Some(&liste[liste.len() / 2])
    }
}

fn takas<T, U>(cift: (T, U)) -> (U, T) {
    (cift.1, cift.0)
}

fn main() {
    let notlar = [55, 70, 85, 90, 100];
    let sehirler = vec!["Adana", "Bursa", "Çorum", "Denizli"];
    let bos: [f64; 0] = [];

    println!("{:?}", ortadaki(&notlar));
    println!("{:?}", ortadaki(&sehirler));
    println!("{:?}", ortadaki(&bos));
    println!("{:?}", takas((1, "bir")));
}
```

`ortadaki`'nin gövdesi `T` hakkında **hiçbir şey varsaymıyor**: sadece dilimin uzunluğuna bakıp bir
elemana referans veriyor. Bu yüzden her tiple çalışır. `takas` ise iki **bağımsız** tip parametresi
kullanıyor: `T` ile `U` aynı tip *olabilir* ama *zorunda değildir*.

Modül 2'deki **tip çıkarımı** burada da iş başında: `ortadaki(&notlar)` çağrısında derleyici
`T = i32` olduğunu argümandan anlar; senin bir şey yazmana gerek yoktur.

```predict
code: |
  fn takas<T, U>(cift: (T, U)) -> (U, T) {
      (cift.1, cift.0)
  }

  fn main() {
      let a = takas((7, 'z'));
      let b = takas((a.0, a.1 + 1));
      println!("{a:?} {b:?}");
  }
options:
  - "('z', 7) (8, 'z')"
  - "('z', 7) ('z', 8)"
  - "(7, 'z') ('z', 8)"
  - Derlenmez — `T` ile `U` aynı tip olmalı
answer: 0
explanation: |
  İlk çağrıda `T = i32`, `U = char` olur ve sonuç `('z', 7)` gelir. İkinci çağrıya `a.0` (`'z'`) ve
  `a.1 + 1` (`8`) verilir; bu kez `T = char`, `U = i32` seçilir ve takas sonucu `(8, 'z')` olur.
  **Her çağrı kendi `T` ve `U`'sunu seçer.** Farklı harfler farklı tipler *olabileceğini* söyler,
  *olmak zorunda olduklarını* değil.
```

## İlk deneme: generic `en_buyuk`

Şimdi iki kopyayı tek fonksiyonda birleştirelim: `i32` ve `char` yazan yerlere `T` koyuyoruz.
Açıklamayı okumadan önce tahmin et:

```compiles
code: |
  fn en_buyuk<T>(liste: &[T]) -> &T {
      let mut en_buyuk = &liste[0];
      for oge in liste {
          if oge > en_buyuk {
              en_buyuk = oge;
          }
      }
      en_buyuk
  }

  fn main() {
      println!("{}", en_buyuk(&[18, 24, 31]));
      println!("{}", en_buyuk(&['r', 'u', 's', 't']));
  }
answer: false
error: E0369
explanation: |
  Derlenmez! `i32` ve `char` karşılaştırılabilir, ama derleyici gövdeyi **her olası `T` için** kontrol eder.
  Ya `T` karşılaştırılamayan bir tipse — örneğin bir `Kitap` struct'ı? “Hangi kitap daha büyük?” sorusunun
  bir anlamı yok. Bu yüzden `>` kullanımı reddedilir.
```

:::error
```text
error[E0369]: binary operation `>` cannot be applied to type `&T`
 --> src/main.rs:4:16
  |
4 |         if oge > en_buyuk {
  |            --- ^ -------- &T
  |            |
  |            &T
  |
help: consider restricting type parameter `T` with trait `PartialOrd`
  |
1 | fn en_buyuk<T: std::cmp::PartialOrd>(liste: &[T]) -> &T {
  |              ++++++++++++++++++++++
```
Derleyici sorunu söylemekle kalmıyor, çözümü de öneriyor: **`T`'yi `PartialOrd` trait'iyle sınırla.**
`help:` satırındaki `+` işaretleri, eklemen gereken karakterleri gösterir.
:::

`PartialOrd`, standart kütüphanede tanımlı bir **trait**'tir ve “bu tipin değerleri `<`, `>`, `<=`, `>=`
ile karşılaştırılabilir” anlamına gelir. Trait'leri 3. derste ayrıntılı göreceğiz; şimdilik trait'i
**bir tipin sahip olduğu bir yetenek** gibi düşün. `T: PartialOrd` yazmak bir **trait sınırı (trait bound)**
koymaktır: *“`T` her tip olabilir — yeter ki karşılaştırılabilsin.”* (`PartialOrd` her Rust programında
otomatik olarak görünür olduğu için `std::cmp::` önekini yazmana gerek yok.)

```rust
fn en_buyuk<T: PartialOrd>(liste: &[T]) -> &T {
    let mut en_buyuk = &liste[0];
    for oge in liste {
        if oge > en_buyuk {
            en_buyuk = oge;
        }
    }
    en_buyuk
}

fn main() {
    println!("{}", en_buyuk(&[18, 24, 31, 27, 22]));
    println!("{}", en_buyuk(&['r', 'u', 's', 't']));
    println!("{}", en_buyuk(&[36.6, 38.2, 37.1]));
    println!("{}", en_buyuk(&["elma", "zeytin", "kiraz"]));
}
```

Tek fonksiyon; tam sayılar, harfler, ondalıklı sayılar ve metinler için çalışıyor.

:::analogy İş ilanı
Bir şirket ilan veriyor: *“B sınıfı ehliyeti olan şoför aranıyor.”* Adayın adı, yaşı, memleketi önemli
değil — yeter ki ehliyeti olsun. İşe alındıktan sonra şirket ondan yalnızca **ilanda yazan** şeyi
isteyebilir: araba kullanmak. Yemek pişirmesini bekleyemez; ilanda böyle bir şart yoktu.

`fn en_buyuk<T: PartialOrd>` de bir ilandır: *“Karşılaştırılabilen her tip başvurabilir.”* Fonksiyonun
gövdesi de `T`'den yalnızca sınırda söz verilen yeteneği (`>`) isteyebilir.
:::

**C++ ile fark — işin “neden” kısmı:** C++ şablonları gövdeyi ancak şablon belirli bir tiple *kullanıldığı
anda* denetler. Karşılaştırılamayan bir tiple çağırırsan hata, şablonun derinliklerinden sayfalarca
mesajla gelir. (C++20'deki *concepts* buna benzer sınırlar getirir, ama isteğe bağlıdır ve gövdeyi
sınırlara göre denetlemez.) Rust ise generic gövdeyi **tanımlandığı yerde, bir kez** ve yalnızca
sınırlara bakarak denetler; sınır yazmak zorunludur. Sonuç: **imza bir sözleşmedir.** Çağıran yalnızca
imzaya bakar (“`T` karşılaştırılabilir olmalı”), fonksiyonu yazan da yalnızca imzanın verdiği izinlerle
çalışır. Hatalar doğru yerde, kısa ve net çıkar.

```quiz
question: "`fn en_buyuk<T: PartialOrd>(liste: &[T]) -> &T` gövdesinde aşağıdakilerden hangisini **yapamazsın**?"
options:
  - "İki `&T` değerini `>` ile karşılaştırmak"
  - "`liste.len()` ile dilimin uzunluğunu almak"
  - "`println!(\"{}\", oge)` ile bir elemanı yazdırmak"
  - "`&liste[0]` ile bir elemana referans almak"
answer: 2
explanation: |
  Gövde `T` hakkında yalnızca **sınırların söylediklerini** bilir. `T: PartialOrd` karşılaştırma iznini verir;
  `len()` ve indeksleme ise dilimin kendi yetenekleridir, `T`'ye bağlı değildir. Ama `{}` ile yazdırmak
  `T`'nin `Display` trait'ini uygulamasını gerektirir ve bu sınırda yok (`E0277`). Yazdırmak istersen
  sınırı genişletirsin: `T: PartialOrd + std::fmt::Display` — çoklu sınırlar 4. dersin konusu.
feedback:
  - "Bunu tam olarak `PartialOrd` sınırı mümkün kılıyor."
  - "`len()` dilimin metodudur; `T` ne olursa olsun çalışır."
  - "Doğru! `{}` için `T: Display` gerekir; sınırda yok."
  - "İndeksleme ve `&` dilimin işidir; `T`'nin bir yeteneğine ihtiyaç duymaz."
```

## Değer mi, referans mı?

Bizim `en_buyuk` bir **referans** (`&T`) döndürüyor. Peki elemanın kendisini, yani bir `T` döndürmek
isteseydik? Modül 4 ve 5'te öğrendiklerini kullanarak tahmin et:

```compiles
code: |
  fn en_buyuk<T: PartialOrd>(liste: &[T]) -> T {
      let mut en_buyuk = liste[0];
      for &oge in liste {
          if oge > en_buyuk {
              en_buyuk = oge;
          }
      }
      en_buyuk
  }

  fn main() {
      println!("{}", en_buyuk(&[18, 24, 31]));
  }
answer: false
error: E0508
explanation: |
  `liste[0]` ifadesi elemanı dilimden **dışarı taşımaya** (move) çalışır. Ama `liste` ödünç alınmış bir
  dilimdir ve ödünç aldığın bir şeyin içinden değer taşıyamazsın. `i32` için sorun olmazdı (`Copy`'dir),
  ama `T` bir `String` de olabilir! Derleyici her `T` için düşündüğünden reddeder. Aynı sebeple
  `for &oge in liste` satırı da ikinci bir hata verir (`E0507`): `&oge` deseni de elemanı referansın
  içinden dışarı almaya çalışır.
```

:::error
```text
error[E0508]: cannot move out of type `[T]`, a non-copy slice
 --> src/main.rs:2:24
  |
2 |     let mut en_buyuk = liste[0];
  |                        ^^^^^^^^
  |                        |
  |                        cannot move out of here
  |                        move occurs because `liste[_]` has type `T`, which does not implement the `Copy` trait
  |
help: consider borrowing here
  |
2 |     let mut en_buyuk = &liste[0];
  |                        +
```
Mesaj, sorunun generic'lerle değil **sahiplikle** ilgili olduğunu söylüyor: `T` `Copy` değil, o zaman
kopyalanamaz; taşınamaz da, çünkü dilim senin değil. Önerilen çözüm: ödünç al (`&liste[0]`).
:::

Referans döndürmenin bellekte neden bu kadar ucuz olduğuna bak:

```memory
title: en_buyuk(&sicakliklar) — referans döndürmek hiçbir şeyi kopyalamaz
steps:
  - caption: "`en_buyuk` çağrıldı. `liste` parametresi `main`'deki diziyi gösteren bir **dilimdir** (işaretçi + uzunluk). Döngü başında yerel `en_buyuk` referansı ilk elemanı gösteriyor."
    stack:
      - frame: main
        vars:
          - { name: sicakliklar, type: "[i32; 5]", value: "18 | 24 | 31 | 27 | 22" }
      - frame: en_buyuk
        vars:
          - { name: liste, type: "&[i32]", value: "ptr · len=5", to: sicakliklar }
          - { name: en_buyuk, type: "&i32", value: "ptr", to: sicakliklar, note: "şu an `sicakliklar[0]` (18)" }
  - caption: "Döngü bitince `en_buyuk` 31'i gösteriyor. Fonksiyon yalnızca bu **adresi** döndürür; hiçbir eleman kopyalanmaz ya da taşınmaz."
    stack:
      - frame: main
        vars:
          - { name: sicakliklar, type: "[i32; 5]", value: "18 | 24 | 31 | 27 | 22" }
          - { name: sonuc, type: "&i32", value: "ptr", to: sicakliklar, note: "`sicakliklar[2]` (31)" }
```

Kısacası en büyük elemanı çağırana vermenin üç yolu var:

1. **Referans döndür** (`-> &T`) — çoğu zaman en iyisi: hiçbir şey kopyalanmaz, her tiple çalışır.
   Elemanın kendisi değil, ona bakan bir referans döner.
2. **`T: PartialOrd + Copy`** — `+` ile ikinci bir sınır ekleyip yalnızca `Copy` tiplere izin verirsin.
   `i32`, `char`, `f64` çalışır; `String` artık kabul edilmez.
3. **`T: PartialOrd + Clone`** ve `liste[0].clone()` — her tiple çalışır ama `String` gibi tiplerde
   heap kopyası yapar (Modül 4: `clone` bilinçli bir karardır).

```rust
fn en_buyuk_kopya<T: PartialOrd + Copy>(liste: &[T]) -> T {
    let mut en_buyuk = liste[0]; // Copy olduğu için kopyalanır
    for &oge in liste {
        if oge > en_buyuk {
            en_buyuk = oge;
        }
    }
    en_buyuk
}

fn main() {
    let sicakliklar = [18, 24, 31, 27, 22];
    let en_sicak = en_buyuk_kopya(&sicakliklar);
    println!("{en_sicak}");
    println!("{}", en_buyuk_kopya(&['r', 'u', 's', 't']));
    // en_buyuk_kopya(&[String::from("a")]); // ← açarsan E0277: String, Copy değil
}
```

## Turbofish: tipi açıkça söylemek

Çoğu zaman derleyici `T`'yi argümanlardan çıkarır. Peki `T` hiçbir argümanda geçmiyorsa?

```rust,compile_fail,E0282
fn bos_liste<T>() -> Vec<T> {
    Vec::new()
}

fn main() {
    let liste = bos_liste();
    println!("{}", liste.len());
}
```

:::error
```text
error[E0282]: type annotations needed for `Vec<_>`
 --> src/main.rs:6:9
  |
6 |     let liste = bos_liste();
  |         ^^^^^   ----------- type must be known at this point
  |
help: consider giving `liste` an explicit type, where the type for type parameter `T` is specified
  |
6 |     let liste: Vec<T> = bos_liste();
  |              ++++++++
```
`Vec<_>`'deki `_`, derleyicinin “burada bir tip var ama ne olduğunu bilmiyorum” deme şeklidir.
Boş bir listenin elemanlarına hiç bakılmadığı için `T` hakkında hiçbir ipucu yok.
:::

İki çözüm var: değişkene tip yazmak ya da fonksiyon adının arkasına `::<Tip>` eklemek.

```rust
# fn bos_liste<T>() -> Vec<T> {
#     Vec::new()
# }
fn main() {
    let a: Vec<i32> = bos_liste(); // 1) değişkene tip notasyonu
    let b = bos_liste::<String>(); // 2) turbofish
    println!("{} {}", a.len(), b.len());
}
```

`::<>` sözdizimine, yan yatmış bir balığa benzediği için **turbofish** denir. Tanıdık geldi mi? Modül 2'de
`"42".parse::<i32>()` yazmıştın. Artık nedenini biliyorsun: `parse` generic bir metottur ve dönüş tipini
argümanlardan çıkaramaz; hangi tipe çevireceğini sen söylersin. (`parse`'ın arkasındaki `FromStr` trait'ini
7. derste kendi tiplerin için uygulayacaksın.)

Standart kütüphane generic fonksiyonlarla doludur. Birkaçının imzası yorumlarda:

```rust
fn main() {
    let mut sol = String::from("sol");
    let mut sag = String::from("sağ");
    std::mem::swap(&mut sol, &mut sag); // fn swap<T>(x: &mut T, y: &mut T)
    println!("{sol} {sag}");

    println!("{}", std::cmp::max(3, 7)); // fn max<T: Ord>(v1: T, v2: T) -> T
    println!("{}", std::cmp::min('k', 'c')); // fn min<T: Ord>(v1: T, v2: T) -> T

    let pi = "3.14".parse::<f64>().unwrap();
    let harfler = Vec::<char>::with_capacity(10); // turbofish tip adında da olur
    println!("{pi} {}", harfler.capacity() >= 10);
}
```

:::tip `max` neden `PartialOrd` değil de `Ord` istiyor?
`std::cmp::max(1.5, 2.5)` derlenmez, çünkü `f64` `Ord` değildir. Modül 9'da `Vec<f64>`'ü `sort()` ile
sıralayamamanın sebebi de buydu. Kısa cevap: `NaN` yüzünden. Uzun cevabı 5. derste, `PartialOrd` ile
`Ord` arasındaki farkı öğrenirken göreceksin.
:::

```fill
prompt: |
  Boşlukları doldur: `ilk_veya` fonksiyonu dilim boşsa `yedek`'i, değilse ilk elemanın **kopyasını**
  döndürsün. Sonra fonksiyonu turbofish ile açıkça `f64` için çağır.
code: |
  fn ilk_veya<___0>(liste: &[T], yedek: T) -> T {
      if liste.is_empty() {
          yedek
      } else {
          liste[0]
      }
  }

  fn main() {
      let bos: Vec<f64> = Vec::new();
      let x = ilk_veya::<___1>(&bos, 0.5);
      let y = ilk_veya(&['a', 'b'], 'z');
      println!("{x} {y}");
  }
blanks:
  - ["T: Copy", "T: Clone + Copy", "T: Copy + Clone"]
  - ["f64"]
output: 0.5 a
explanation: |
  `liste[0]` elemanı dilimden dışarı alır; ödünç alınmış bir dilimden bunu ancak **kopyalayarak**
  yapabilirsin, o yüzden `T: Copy` şart (yoksa `E0508`). `ilk_veya::<f64>` ise turbofish'tir: derleyiciye
  `T = f64` dediğini açıkça söyler. Burada aslında zorunlu değil (`0.5`'ten çıkarılabilirdi) ama
  `bos_liste::<String>()` gibi durumlarda tek çaredir.
```

## Alıştırmalar

Önce derleyiciyle birlikte çalışacağın kısa bir ısınma, sonra biraz daha düşündüren bir problem.

```exercise
id: m11-l01-e-kac-kez
title: Sandıktaki oylar
difficulty: 2
prompt: |
  Okulda sınıf başkanlığı seçimi var; oy pusulaları bir dilimde tutuluyor. `kac_kez` fonksiyonu,
  dilimde `aranan` değerin **kaç kez** geçtiğini saysın. Fonksiyon generic olmalı: aynı kod oy pusulaları
  (`&str`), zar atışları (`i32`) ve harfler (`char`) için çalışmalı.

  Başlangıç kodundaki imzada `T` için **hiçbir sınır yok**. Gövdeyi yazınca derleyici sana hangi
  trait'in gerektiğini söyleyecek — mesajı oku ve sınırı ekle!
starter: |
  fn kac_kez<T>(liste: &[T], aranan: &T) -> usize {
      todo!()
  }

  fn main() {
      let oylar = ["Elif", "Mert", "Elif", "Can", "Elif"];
      println!("Elif: {} oy", kac_kez(&oylar, &"Elif"));

      let zarlar = [6, 2, 6, 6, 1, 4];
      println!("Altı: {} kez", kac_kez(&zarlar, &6));
  }
solution: |
  fn kac_kez<T: PartialEq>(liste: &[T], aranan: &T) -> usize {
      let mut sayac = 0;
      for oge in liste {
          if oge == aranan {
              sayac += 1;
          }
      }
      sayac
  }

  fn main() {
      let oylar = ["Elif", "Mert", "Elif", "Can", "Elif"];
      println!("Elif: {} oy", kac_kez(&oylar, &"Elif"));

      let zarlar = [6, 2, 6, 6, 1, 4];
      println!("Altı: {} kez", kac_kez(&zarlar, &6));
  }
check: tests
tests: |
  #[test]
  fn oylari_sayar() {
      let oylar = ["Elif", "Mert", "Elif", "Can", "Elif"];
      assert_eq!(kac_kez(&oylar, &"Elif"), 3, "Elif 3 oy almıştı");
      assert_eq!(kac_kez(&oylar, &"Can"), 1, "Can 1 oy almıştı");
      assert_eq!(kac_kez(&oylar, &"Zeynep"), 0, "Hiç geçmeyen aday için 0 dönmeli");
  }

  #[test]
  fn sayilarla_ve_harflerle_calisir() {
      assert_eq!(kac_kez(&[6, 2, 6, 6, 1, 4], &6), 3, "6 üç kez gelmişti");
      assert_eq!(kac_kez(&['k', 'a', 'y', 'a', 'k'], &'k'), 2, "\"kayak\" kelimesinde 2 tane 'k' var");
  }

  #[test]
  fn bos_dilimde_sifir() {
      let bos: [i32; 0] = [];
      assert_eq!(kac_kez(&bos, &1), 0, "Boş dilimde hiçbir şey bulunamaz");
  }

  #[test]
  fn string_ile_de_calisir() {
      let isimler = vec![String::from("Ada"), String::from("ada"), String::from("Ada")];
      assert_eq!(kac_kez(&isimler, &String::from("Ada")), 2, "Büyük/küçük harf farkı önemli: 2 tane \"Ada\" var");
  }
hints:
  - "Bir sayaçla başla (`let mut sayac = 0;`) ve `for oge in liste` ile dilimi dolaş."
  - "`oge` ve `aranan` ikisi de `&T`; `oge == aranan` ile karşılaştırabilirsin. Derleyici `E0369` verirse `help:` satırını oku."
  - "`==` için gereken trait: `PartialEq`. İmza `fn kac_kez<T: PartialEq>(liste: &[T], aranan: &T) -> usize` olmalı."
explanation: |
  `==` operatörü `PartialEq` trait'inden gelir; `>` için `PartialOrd` gerektiği gibi. Sınırı eklemeden
  `oge == aranan` yazınca derleyici `E0369` ile durur ve `T: std::cmp::PartialEq` eklemeni önerir.
  Rust'ta bu döngüye **derleyici güdümlü geliştirme** denir: hatayı oku, isteneni ver, tekrar derle.

  `oge` ve `aranan` aynı tipte (`&T`) oldukları için doğrudan karşılaştırılabildi. Bir incelik:
  `String::from("Ada") == "Ada"` gibi bir `String`'i bir `&str` ile karşılaştırabilmen de standart
  kütüphanedeki bir `PartialEq` uygulaması sayesindedir — trait'ler farklı tipler arasında da tanımlanabilir!

  Modül 14'te aynı işi tek satırda yapmayı öğreneceksin: `liste.iter().filter(|x| *x == aranan).count()`.
```

```exercise
id: m11-l01-e-uc-degerler
title: Haftanın en soğuk ve en sıcak günü
difficulty: 3
prompt: |
  Meteoroloji uygulaman için generic bir `uc_degerler` fonksiyonu yaz. Fonksiyon bir dilim alsın ve
  **en küçük** ile **en büyük** elemana referansları bir tuple içinde döndürsün: `(en_kucuk, en_buyuk)`.

  Dilim boşsa ortada ne en küçük ne en büyük vardır: bu durumda `None` döndür (Modül 7'deki `Option`).
  Böylece `en_buyuk`'taki `&liste[0]` paniğinden de kurtulmuş olursun. Eşit değerler varsa hangisinin
  referansını döndürdüğün önemli değil.
starter: |
  fn uc_degerler<T: PartialOrd>(liste: &[T]) -> Option<(&T, &T)> {
      todo!()
  }

  fn main() {
      let sicakliklar = [12.5, 8.0, 15.5, 21.0, 9.5];
      println!("{:?}", uc_degerler(&sicakliklar));
  }
solution: |
  fn uc_degerler<T: PartialOrd>(liste: &[T]) -> Option<(&T, &T)> {
      if liste.is_empty() {
          return None;
      }
      let mut en_kucuk = &liste[0];
      let mut en_buyuk = &liste[0];
      for oge in liste {
          if oge < en_kucuk {
              en_kucuk = oge;
          }
          if oge > en_buyuk {
              en_buyuk = oge;
          }
      }
      Some((en_kucuk, en_buyuk))
  }

  fn main() {
      let sicakliklar = [12.5, 8.0, 15.5, 21.0, 9.5];
      println!("{:?}", uc_degerler(&sicakliklar));
  }
check: tests
tests: |
  #[test]
  fn sicakliklarda_calisir() {
      let s = [12.5, 8.0, 15.5, 21.0, 9.5];
      assert_eq!(uc_degerler(&s), Some((&8.0, &21.0)), "En soğuk 8.0, en sıcak 21.0 olmalı");
  }

  #[test]
  fn negatif_sayilar() {
      assert_eq!(uc_degerler(&[-3, -15, 4, 0]), Some((&-15, &4)), "Negatif sayılar da doğru karşılaştırılmalı");
  }

  #[test]
  fn bos_dilimde_none() {
      let bos: [i32; 0] = [];
      assert_eq!(uc_degerler(&bos), None, "Boş dilimde None dönmeli (panik değil!)");
  }

  #[test]
  fn tek_eleman() {
      assert_eq!(uc_degerler(&['ş']), Some((&'ş', &'ş')), "Tek elemanlı dilimde en küçük de en büyük de o elemandır");
  }

  #[test]
  fn metinlerde_alfabetik() {
      let iller = ["Muş", "Bolu", "Van", "Aydın"];
      assert_eq!(uc_degerler(&iller), Some((&"Aydın", &"Van")), "&str değerleri sözlük sırasıyla karşılaştırılır");
  }
hints:
  - "Önce boş dilim durumunu ele al: `if liste.is_empty() { return None; }`"
  - "İki aday referans tut: `let mut en_kucuk = &liste[0];` ve `let mut en_buyuk = &liste[0];` Sonra dilimi dolaşıp `<` ve `>` ile güncelle."
  - "Sonunda iki referansı bir tuple'a koyup `Some` ile sar: `Some((en_kucuk, en_buyuk))` — çift parantez dikkat!"
explanation: |
  Fonksiyon hiçbir elemanı kopyalamıyor: iki referans tutuyor ve sonunda onları döndürüyor. Bu yüzden
  `T` için `Copy` ya da `Clone` istemedik; sadece `PartialOrd` yetti. İmzadaki referanslar dilimin
  kendisine bağlı olduğu için derleyici fazladan bir şey yazmamızı istemedi (bunun kurallarını
  Modül 12'de, yaşam sürelerinde göreceğiz).

  `Option` döndürmek, boş dilim durumunu **tipin içine** yazar: çağıran `None` ihtimalini ele almak
  zorundadır. `&liste[0]` ile panik yapan sürümden çok daha güvenli.

  Standart kütüphanede bu işin hazırı var: `liste.iter().min()` ve `liste.iter().max()` (Modül 9).
  Ama onlar `T: Ord` ister — yani `f64` dizisiyle çalışmazlar. Senin `PartialOrd` sürümün çalışır!
```

## Özet

:::remember
- `fn ad<T>(...)`: tip parametresi fonksiyon adından sonra `<...>` içinde **bildirilir**, sonra parametre
  ve dönüş tiplerinde kullanılır. Gelenek: `T`, `U`, `K`, `V`, `E`.
- Rust generic gövdeyi **bir kez, tüm `T`'ler için** denetler → `T` ile yalnızca **sınırların izin
  verdiğini** yapabilirsin. İmza bir sözleşmedir.
- `T: PartialOrd` → `<` `>`; `T: PartialEq` → `==` `!=`; `T: Copy` → değeri kopyalayarak dışarı alma.
  Birden fazla sınır `+` ile: `T: PartialOrd + Copy`.
- Mümkünse `&T` döndür: kopya ya da taşıma gerekmez.
- `T` argümanlardan çıkarılamıyorsa (`E0282`): `let x: Tip = f();` ya da turbofish `f::<Tip>()`.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — Rust neden `fn en_buyuk<T>(liste: &[T]) -> &T` gövdesinde `>` kullanmana
  izin vermiyor, ama `T: PartialOrd` ekleyince izin veriyor? C++ şablonlarının yaklaşımına göre
  bunun avantajı ne?
answer: |
  Rust generic gövdeyi tanımlandığı yerde ve **olası her `T` için** denetler. Sınırsız bir `T`
  karşılaştırılamayan bir tip de olabilir, bu yüzden `>` reddedilir. `T: PartialOrd` sınırı bir
  sözleşmedir: “bu fonksiyona yalnızca karşılaştırılabilen tipler verilebilir.” Gövde bu sözleşmeye
  güvenerek `>` kullanır, çağıran da sözleşmeye uyan bir tip vermek zorundadır.

  C++ şablonları gövdeyi her kullanımda ayrı ayrı denetler; hatalar şablonun içinden, uzun ve karışık
  mesajlarla gelir. Rust'ta hatalar imza düzeyinde, kısa ve net çıkar; çağıran fonksiyonun içine
  bakmadan, sadece imzayı okuyarak ne vermesi gerektiğini bilir.
```

```flashcards
- front: Bir generic fonksiyonda tip parametresi nerede bildirilir?
  back: "Fonksiyon adının hemen ardından açılı parantez içinde: `fn ad<T>(x: T) -> T`."
- front: "`E0369: binary operation > cannot be applied to type &T` ne demek, nasıl düzelir?"
  back: "`T`'nin karşılaştırılabileceği garanti değil. `T: PartialOrd` sınırı eklenir."
- front: "`==` kullanmak için `T`'ye hangi sınır eklenir?"
  back: "`T: PartialEq`"
- front: Rust generic bir fonksiyonun gövdesini ne zaman ve neye göre denetler?
  back: Tanımlandığı yerde, bir kez, yalnızca trait sınırlarına bakarak — her olası `T` için geçerli olmalı. (C++ şablonları ise her kullanımda ayrı denetlenir.)
- front: |
    Neden derlenmez?
    ```rust
    fn ilk<T>(liste: &[T]) -> T { liste[0] }
    ```
  back: "`liste[0]` elemanı ödünç alınmış dilimden dışarı taşımaya çalışır (`E0508`). Çözüm: `&T` döndür ya da `T: Copy` / `T: Clone` sınırı ekle."
- front: Derleyici `T`'yi çıkaramazsa (`E0282`) hangi iki çözüm var?
  back: "Tip notasyonu (`let v: Vec<i32> = f();`) ya da turbofish (`f::<i32>()`)."
- front: "`fn takas<T, U>(c: (T, U)) -> (U, T)` için `takas((1, 'a'))` ne döndürür?"
  back: "`('a', 1)` — burada `T = i32`, `U = char`."
```
