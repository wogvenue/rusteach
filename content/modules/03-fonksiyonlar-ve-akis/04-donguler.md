---
id: m03-l04
title: "Döngüler: loop, while ve for"
minutes: 22
type: lesson
objectives:
  - "`loop`, `while` ve `for` döngülerini yazıp duruma göre doğru olanı seçebilmek"
  - "`break` ile döngüden çıkmak, `loop`'tan değer döndürmek ve `E0571` hatasını açıklayabilmek"
  - "Aralıklar (`1..5`, `1..=5`, `.rev()`) ve diziler üzerinde `for` ile dolaşabilmek"
  - "`continue` ve döngü etiketleriyle iç içe döngüleri yönetip bir-eksik/bir-fazla (off-by-one) hatalarından kaçınabilmek"
keywords: [loop, while, for, break, continue, aralık, range, rev, etiket, label, off-by-one, E0571]
---

Bilgisayarlar sıkılmaz. 1'den 1000'e kadar sayıları kâğıda yazmanı istesem, yüzüncü sayı civarında
sıkılır ve hata yapmaya başlarsın. Bir bilgisayar ise saniyede milyarlarca işlemi şikâyet etmeden yapar.
Programların asıl gücü buradan gelir: Bir fotoğrafın her pikselini işlemek, bir banka dökümünün her
satırını toplamak, kullanıcı doğru şifreyi girene kadar tekrar sormak...

Rust'ta üç tür döngü var: `loop`, `while` ve `for`. Bu derste üçünü de, hangisinin ne zaman seçileceğini
ve programcıların en sık yaptığı döngü hatasını öğreneceksin.

## loop: dur diyene kadar

```rust
fn main() {
    let mut tur = 1;

    loop {
        println!("{tur}. tur koşuldu");
        if tur == 3 {
            break;
        }
        tur += 1;
    }

    println!("Antrenman bitti!");
}
```

`loop`, gövdesini **sonsuza kadar** tekrarlar. Döngüden çıkmanın yolu `break`'tir: `break` çalıştığı
anda döngü biter ve program döngünün altındaki satırdan devam eder. Burada `tur` 3 olunca `break`
çalışıyor. Peki `break` hiç olmasaydı? Program kendi kendine hiç bitmezdi:

```rust,norun
fn main() {
    loop {
        println!("Sonsuza dek!");
    }
}
```

:::ferris
Programın donmuş gibi hiç bitmiyorsa, büyük ihtimalle `break`'i unutulmuş bir döngünün içindesin.
Terminalde **Ctrl+C** ile durdurabilirsin. Bu uygulamadaki çalıştırıcı da süre sınırını aşan
programları kendisi durdurur.
:::

C, Java ve JavaScript'te sonsuz döngü `while (true) { ... }` diye yazılır. Rust'ta `while true` yazarsan
derlenir, ama derleyici *denote infinite loops with `loop { ... }`* diye uyarır: "Sonsuz döngüler için
`loop` kullan." Ayrı bir anahtar kelimenin iki faydası var: Niyetin ilk bakışta okunur ve derleyici
döngünün **yalnızca `break` ile bitebileceğini** bilir. Bu bilgi ona yeni bir kapı açar. Önce tahmin et:

```predict
question: "`break`'in yanına bir değer yazılmış. Program ne yazdırır?"
code: |
  fn main() {
      let mut sayac = 0;
      let sonuc = loop {
          sayac += 1;
          if sayac == 4 {
              break sayac * 10;
          }
      };
      println!("sayac = {sayac}, sonuc = {sonuc}");
  }
options:
  - "sayac = 4, sonuc = 40"
  - "sayac = 4, sonuc = 4"
  - "sayac = 5, sonuc = 50"
  - "sayac = 4, sonuc = ()"
answer: 0
explanation: |
  `loop` da bir **ifadedir** (önceki dersi hatırla: Rust'ta neredeyse her şey bir değer üretir).
  `break sayac * 10;` hem döngüyü bitirir hem de `sayac * 10` değerini, yani 40'ı, bütün `loop`
  ifadesinin değeri yapar; bu değer `sonuc` değişkenine bağlanır. `break`'ten sonra döngüde başka hiçbir
  şey çalışmadığı için `sayac` 4'te kalır.
```

Bu kalıp şöyle okunur: **"Bir şeyi bulana kadar dene; bulunca onu getir."** Gerçek bir örnek:

```rust
fn main() {
    // Bir bakteri kolonisi her saat ikiye katlanıyor.
    // Sayıları kaçıncı saatte 1 milyonu geçer?
    let mut bakteri: u64 = 1;
    let mut saat = 0;

    let gecilen_saat = loop {
        bakteri *= 2;
        saat += 1;
        if bakteri > 1_000_000 {
            break saat;
        }
    };

    println!("{gecilen_saat}. saatte bakteri sayısı {bakteri} oldu.");
}
```

`let gecilen_saat = loop { ... };` satırının sonundaki noktalı virgüle dikkat: `if` ifadesinde olduğu
gibi, bütün satır bir `let` deyimidir. Değersiz bir `break;` kullanırsan döngünün değeri `()` olur.

## while: koşul doğru oldukça

Çoğu zaman döngünün "bir koşul doğru olduğu sürece" dönmesini isteriz. Bunu `loop`, `if` ve `break` ile
yazabilirsin, ama `while` aynı şeyi tek satırda söyler:

```rust
fn main() {
    let sayi = 2024;
    let mut kalan = sayi;
    let mut basamak = 0;

    while kalan > 0 {
        kalan /= 10; // son basamağı at: 2024 → 202 → 20 → 2 → 0
        basamak += 1;
    }

    println!("{sayi} sayısı {basamak} basamaklı.");
}
```

Koşul **her turdan önce** sınanır: Doğruysa gövde bir kez daha çalışır, yanlışsa döngü biter. Koşul,
`if`'te olduğu gibi mutlaka `bool` olmalıdır ve etrafında parantez gerekmez.

Peki `sayi` 0 olsaydı? Koşul daha ilk turdan önce yanlış olurdu; döngü **hiç çalışmaz** ve program
"0 sayısı 0 basamaklı" derdi. Yanlış: 0 tek basamaklı bir sayıdır! Bir `while` döngüsü sıfır kez
çalışabilir. C, Java ve JavaScript'te gövdeyi en az bir kez çalıştıran `do { ... } while (kosul);`
döngüsü vardır. Rust'ta yoktur; onun yerine `break`'i sona koyduğun bir `loop` yazarsın:

```rust
fn basamak_sayisi(sayi: u32) -> u32 {
    let mut kalan = sayi;
    let mut basamak = 0;
    loop {
        kalan /= 10;
        basamak += 1;
        if kalan == 0 {
            break basamak;
        }
    }
}

fn main() {
    println!("{} {} {}", basamak_sayisi(2024), basamak_sayisi(7), basamak_sayisi(0));
}
```

Fonksiyonun gövdesi tek bir `loop` ifadesinden oluşuyor ve `break basamak` ile ürettiği değer,
fonksiyonun dönüş değeri oluyor. Peki aynı numara `while` ile de yapılabilir mi?

```compiles
code: |
  fn main() {
      let mut kova = 0;
      let dolu_kova = while kova < 10 {
          kova += 3;
          if kova >= 10 {
              break kova;
          }
      };
      println!("{dolu_kova:?}");
  }
answer: false
error: E0571
explanation: |
  Döngüler arasında `break` ile değer döndürmek **yalnızca `loop`** içinde mümkündür. Neden? `while`'ın
  koşulu daha ilk turdan önce yanlış olabilir (örneğin `kova` 50'den başlasaydı); o zaman gövde hiç
  çalışmaz ve `break kova` satırına hiç gelinmez. `dolu_kova` hangi değeri alacaktı? Belirsiz! `loop`
  ise yalnızca `break` ile bitebildiği için (ya da hiç bitmediği için) değer üretmeden sona eremez.
  Çözüm: `loop` kullanmak ya da döngü bittikten sonra sonucu doğrudan `kova` değişkeninden okumak.
  (`while` ve `for` döngülerinin kendi değeri her zaman `()`'dir.)
```

:::error
```text
error[E0571]: `break` with value from a `while` loop
 --> src/main.rs:6:13
  |
3 |     let dolu_kova = while kova < 10 {
  |                     --------------- you can't `break` with a value in a `while` loop
...
6 |             break kova;
  |             ^^^^^^^^^^ can only break with a value inside `loop` or breakable block
  |
help: use `break` on its own without a value inside this `while` loop
  |
6 -             break kova;
6 +             break;
  |
```
Mesaj iki yeri birden gösteriyor: hatanın yapıldığı satırı (`^^^`) ve sebebini (`---`, "bu bir `while`
döngüsü"). `...` satırı, aradaki satırların atlandığını anlatır. Mesajdaki *breakable block*
(kırılabilir blok) ifadesini merak ettiysen, cevabı bu dersin sonundaki etiketler bölümünde.
:::

Şimdi Modül 2'den bir bilgiyi döngülerle birleştirelim:

````quiz
question: |
  Bu geri sayım programı çalıştırılınca ne olur?
  ```rust
  fn main() {
      let mut geri_sayim: u32 = 3;
      while geri_sayim >= 0 {
          println!("{geri_sayim}");
          geri_sayim -= 1;
      }
      println!("Kalkış!");
  }
  ```
options:
  - 3, 2, 1, 0 yazar, ardından "Kalkış!" yazar
  - "3, 2, 1, 0 yazar, sonra panikler: *attempt to subtract with overflow*"
  - Durmadan sayı yazar; sonsuz döngüye girer
  - "Derlenmez, çünkü `geri_sayim >= 0` her zaman doğrudur"
answer: 1
explanation: |
  `u32` **işaretsiz** bir tamsayıdır: Negatif olamaz. Bu yüzden `geri_sayim >= 0` **her zaman**
  doğrudur ve döngü kendi kendine hiç bitmez. `geri_sayim` 0 olduğunda `geri_sayim -= 1` işlemi -1
  üretmeye çalışır; Modül 2'den hatırladığın gibi, debug derlemesinde bu **taşma (overflow)** programı
  paniğe sokar. Derleyici aslında seni uyarmıştı: *comparison is useless due to type limits* ("Bu
  karşılaştırma, tipin sınırları yüzünden anlamsız"). Uyarıları ciddiye al; çoğu zaman bir hatanın
  habercisidirler! Doğrusu: `while geri_sayim > 0` ya da bir sonraki adımda göreceğin `(0..=3).rev()`.
feedback:
  - "Döngü `geri_sayim >= 0` doğru olduğu sürece döner; `u32` için bu koşul asla yanlış olmaz."
  - Doğru! Önce 0 yazılır, ardından 0 - 1 hesaplanmaya çalışılır ve taşma paniği oluşur.
  - "Release derlemesinde taşma sarmalanırdı (wrap) ve sayım 4294967295'ten sürerdi; ama varsayılan debug derlemesinde program panikler."
  - "Derlenir; derleyici yalnızca bir **uyarı** verir: *comparison is useless due to type limits*."
````

## for: aralıklar ve diziler üzerinde

Rust programcılarının en çok kullandığı döngü `for`'dur. Bir koleksiyonun her elemanı için gövdeyi bir
kez çalıştırır:

```rust
fn main() {
    let notlar = [85, 92, 78, 64];
    let mut toplam = 0;

    for not in notlar {
        println!("Not: {not}");
        toplam += not;
    }

    // .len() bir usize döndürür (Modül 2); bölmeden önce ikisini de f64'e çeviriyoruz.
    let ortalama = toplam as f64 / notlar.len() as f64;
    println!("Ortalama: {ortalama:.2}");
}
```

`for not in notlar` şöyle okunur: "`notlar`'daki her eleman için, o elemana `not` de ve gövdeyi çalıştır."
Python'daki `for not in notlar:` ile aynı fikir. C'deki `for (int i = 0; i < 4; i++)` gibi bir sayaç,
koşul ve artırma üçlüsü **yoktur**; Rust'ın `for`'u her zaman bir şeyin üzerinden geçer.

```memory
title: "for not in notlar: tur tur"
steps:
  - caption: Döngüden önce `toplam` 0.
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "[i32; 4]", value: "[85, 92, 78, 64]" }
          - { name: toplam, type: i32, value: "0", mut: true }
  - caption: "1. tur: `not` dizinin ilk elemanını alır (85) ve `toplam` 85 olur."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "[i32; 4]", value: "[85, 92, 78, 64]" }
          - { name: toplam, type: i32, value: "85", mut: true }
          - { name: not, type: i32, value: "85", note: her turda yeni değer }
  - caption: "2. tur: `not` = 92, `toplam` = 85 + 92 = 177."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "[i32; 4]", value: "[85, 92, 78, 64]" }
          - { name: toplam, type: i32, value: "177", mut: true }
          - { name: not, type: i32, value: "92", note: her turda yeni değer }
  - caption: "3. ve 4. turlar: 78 ve 64 de eklenir; `toplam` = 319."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "[i32; 4]", value: "[85, 92, 78, 64]" }
          - { name: toplam, type: i32, value: "319", mut: true }
          - { name: not, type: i32, value: "64", note: son tur }
  - caption: "Döngü bitti: `not` yalnızca döngünün içinde yaşıyordu, artık yok. `toplam` 319 olarak kaldı."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "[i32; 4]", value: "[85, 92, 78, 64]" }
          - { name: toplam, type: i32, value: "319", mut: true }
```

Belli bir sayı kadar tekrar için bir **aralık (range)** üzerinden geçersin:

| Yazım | Ürettiği sayılar | Python karşılığı |
|---|---|---|
| `1..5` | 1, 2, 3, 4 (**son hariç**) | `range(1, 5)` |
| `1..=5` | 1, 2, 3, 4, 5 (son dahil) | `range(1, 6)` |
| `(1..=5).rev()` | 5, 4, 3, 2, 1 | `range(5, 0, -1)` |

```rust
fn main() {
    for i in (1..=3).rev() {
        println!("{i}...");
    }
    println!("Kalkış!");
}
```

`.rev()` (İngilizce *reverse*, ters çevir) bir aralığı tersten dolaşır. Aralığın etrafındaki parantezleri
unutma:

:::error
```text
error[E0689]: can't call method `rev` on type `{integer}`
 --> src/main.rs:2:19
  |
2 |     for i in 1..4.rev() {
  |                   ^^^ can't call method `rev` on type `{integer}`
  |
help: you must surround the range in parentheses to call its `rev` function
  |
2 |     for i in (1..4).rev() {
  |              +    +
```
Parantez olmadan `.rev()` aralığa değil, yalnızca `4` sayısına uygulanmaya çalışılır. Metot çağrısı
`..` operatöründen önce işlenir.
:::

:::tip İki küçük kalıp
- Sayaca ihtiyacın yoksa değişken adı yerine `_` yaz: `for _ in 0..3 { println!("Hip hip hurra!"); }`.
  Böylece hem niyetini belli edersin hem de derleyicinin *unused variable* uyarısından kurtulursun.
- İkişer, üçer atlamak için aralığa `.step_by(adim)` eklenir: `for i in (0..10).step_by(3)` sırasıyla
  0, 3, 6, 9 verir. `.rev()` gibi burada da parantezler şart. (Bu ve benzeri araçları Modül 14'te toplu
  göreceksin.)
:::

```predict
code: |
  fn main() {
      for i in (1..4).rev() {
          println!("{i}");
      }
      for i in 4..1 {
          println!("{i}");
      }
      println!("son");
  }
options:
  - |
    3
    2
    1
    son
  - |
    4
    3
    2
    1
    son
  - |
    3
    2
    1
    4
    3
    2
    son
  - |
    1
    2
    3
    son
answer: 0
explanation: |
  `1..4` sonu hariç tuttuğu için 1, 2, 3 üretir; `.rev()` bunları 3, 2, 1 sırasıyla verir. `4..1` ise
  **boş** bir aralıktır: Aralıklar yalnızca yukarı doğru sayar; `a..b`, `a` `b`'den küçük değilse
  (`a..=b` ise `a` `b`'den büyükse) hiç eleman üretmez. İkinci döngünün gövdesi hiç çalışmaz, üstelik
  derleyici hata ya da uyarı da vermez:
  sessiz bir hata! (Modül 1'de tanıdığın `cargo clippy` ise bunu `reversed_empty_ranges` adıyla
  yakalar; Clippy'yi sık çalıştırmak için bir sebep daha.) Geriye saymak için her zaman `(1..=4).rev()`
  gibi bir yazım kullan.
```

```fill
prompt: |
  Rivayete göre küçük Gauss'un öğretmeni sınıfı oyalamak için 1'den 100'e kadar bütün sayıları
  toplamalarını istemiş. Boşlukları doldurup bu toplamı bir `for` döngüsüyle hesapla. Program `5050`
  yazdırmalı.
code: |
  fn main() {
      let ___0 toplam = 0;
      for sayi in ___1 {
          toplam += sayi;
      }
      println!("{toplam}");
  }
blanks:
  - ["mut"]
  - ["1..=100", "1..101", "0..=100", "0..101"]
output: "5050"
explanation: |
  `toplam` her turda değiştiği için `mut` olmalı (Modül 2). `1..=100` 100'ü **dahil eder**; `1..100`
  yazsaydın son sayı 99 olur ve sonuç 4950 çıkardı. `1..101` de doğru sonucu verir, ama niyeti daha az
  açık anlatır. (Küçük Gauss bu toplamı döngüsüz bulmuş: 1 + 100, 2 + 99, ... her biri 101 eden 50 çift,
  50 × 101 = 5050!)
```

:::deep `for` perde arkasında ne yapar?
`for x in koleksiyon`, aslında bir **iterator**'dan (yineleyici) sıradaki elemanı tekrar tekrar isteyen
ve eleman kalmadığında duran bir `loop`'un kısaltmasıdır. Aralıklar zaten birer iterator'dır; diziler
ise `for`'a verildiğinde bir iterator'a dönüştürülür. `for` ile dolaşılabilmelerinin sebebi budur.
Iterator'ları Modül 14'te ayrıntısıyla göreceksin; vektörler ve metinler üzerinde `for` ise Modül 9'da
gelecek.

Bir ayrıntı: Döngü değişkeni her turda iterator'dan gelen **yeni** değere bağlanır. Gövdenin içinde
`i`'yi değiştirmeye çalışmak (C'deki `i += 2` hilesi gibi) sıradaki turu etkilemez; zaten `mut` olmadığı
için derlenmez bile. Atlayarak ilerlemek istiyorsan `.step_by()` kullan.
:::

## continue ve döngü etiketleri

`break` döngüyü tamamen bitirir. Bazen ise yalnızca **o anki turu** atlayıp sıradakine geçmek istersin.
Bunun için `continue` var:

```rust
fn main() {
    // Bazı binalarda, uğursuz sayıldığı için 13. kat düğmesi yoktur.
    for kat in 10..=15 {
        if kat == 13 {
            continue; // bu turun geri kalanını atla, sıradaki kata geç
        }
        println!("Asansör {kat}. katta durdu");
    }
}
```

| Komut | Ne yapar? |
|---|---|
| `break` | Döngüyü **tamamen** bitirir; program döngünün altından devam eder. |
| `continue` | Yalnızca bu turun geri kalanını atlar; döngü sıradaki turla sürer. |

İç içe döngülerde `break` ve `continue` **en içteki** döngüyü etkiler. Dıştaki bir döngüyü yönetmek
istiyorsan ona bir **etiket (label)** verirsin. Etiketler kesme işaretiyle (`'`) başlar ve döngünün önüne
iki nokta ile yazılır:

```rust
fn dolu_mu(kat: u32, yer: u32) -> bool {
    // Gerçek bir otoparkta bu bilgi sensörlerden gelirdi.
    !((kat == 2 && yer == 3) || (kat == 3 && yer == 1))
}

fn main() {
    'katlar: for kat in 1..=3 {
        for yer in 1..=4 {
            if dolu_mu(kat, yer) {
                continue; // içteki döngü: sıradaki yere bak
            }
            println!("İlk boş yer: {kat}. kat, {yer} numara");
            break 'katlar; // dıştaki döngüyü de bitir
        }
    }
    println!("Arama bitti.");
}
```

Etiketsiz bir `break` yalnızca içteki döngüden çıkardı: Arama 3. katta sürer ve ikinci bir "ilk boş yer"
bulunurdu. `break 'katlar` ise iki döngüyü birden bitirir. Aynı şekilde `continue 'katlar` da dıştaki
döngünün sıradaki turuna (bir sonraki kata) atlar.

Java ve JavaScript'te de etiketli `break` vardır; Python'da ve klasik C'de ise yoktur, oralarda aynı iş
için yardımcı "bulundu mu?" değişkenleri kullanılır. (Kesme işaretini Modül 12'de **yaşam süreleri
(lifetimes)** konusunda yeniden göreceksin; işaret aynı olsa da orada bambaşka bir anlamı var.)

```predict
code: |
  fn main() {
      'dis: for i in 1..=3 {
          for j in 1..=3 {
              if j == 3 {
                  continue 'dis;
              }
              if i * j == 4 {
                  break 'dis;
              }
              println!("{i}x{j}");
          }
      }
  }
options:
  - |
    1x1
    1x2
    2x1
  - |
    1x1
    1x2
    2x1
    3x1
    3x2
  - |
    1x1
    1x2
    1x3
    2x1
  - |
    1x1
    1x2
answer: 0
explanation: |
  `i = 1`: `1x1` ve `1x2` yazılır; `j = 3` olunca `continue 'dis` içteki döngünün geri kalanını atlar ve
  dıştaki döngü `i = 2` ile sürer. `i = 2`: `2x1` yazılır; `j = 2` için `i * j == 4` doğru olur ve
  `break 'dis` **iki döngüyü birden** bitirir. Etiket olmasaydı `break` yalnızca içteki döngüyü bitirirdi
  ve `i = 3` turunda `3x1` ile `3x2` de yazılırdı.
```

```parsons
prompt: |
  Satırları sıraya koy: Program 1'den 10'a kadar (10 dahil) **çift** sayıların toplamını `continue`
  kullanarak hesaplasın ve `30` yazdırsın.
lines: |
  fn main() {
      let mut toplam = 0;
      for sayi in 1..=10 {
          if sayi % 2 == 1 {
              continue;
          }
          toplam += sayi;
      }
      println!("{toplam}");
  }
distractors: |2
      for sayi in 1..10 {
              break;
explanation: |
  Tek sayılarda (`sayi % 2 == 1`) `continue` turun geri kalanını atlar, böylece `toplam += sayi;`
  yalnızca çift sayılar için çalışır: 2 + 4 + 6 + 8 + 10 = 30. `1..10` 10'u dışarıda bırakırdı (sonuç
  20). `break` ise ilk tek sayıda, yani daha 1'de döngüyü bitirir ve sonuç 0 olurdu.
```

## Doğru döngüyü seçmek

| Durum | Döngü | Örnek |
|---|---|---|
| Bir koleksiyonun her elemanı ya da belli sayıda tekrar | `for` | `for not in notlar`, `for i in 1..=10` |
| Bir koşul doğru olduğu sürece | `while` | `while bakiye < hedef` |
| Bitiş anı ancak gövdenin içinde anlaşılıyor; en az bir tur gerekli ya da bir değer bulunacak | `loop` | doğru tahmin gelene kadar sormak, ilk uygun sayıyı bulmak |

Pratik kural: **Önce `for`'u düşün.** Olmuyorsa `while`'ı, o da olmuyorsa `loop`'u. `for` en güvenlisidir:
Sayaç yoktur, dolayısıyla sayacı artırmayı unutmak ya da diziyi aşmak da yoktur.

:::analogy Bir yemek tarifindeki üç talimat
Yemek tarifleri de döngülerle doludur ve her döngü türünün tarifte bir karşılığı var:
- "Yumurtaların **her birini** kır" → `for`: Kaç tekrar olacağını eldeki malzeme belirler.
- "Süt kaynamadığı **sürece** ocakta tut" → `while`: Her seferinde önce koşula bakarsın; süt baştan
  kaynıyorsa hiç beklemezsin.
- "Kıvam alana **kadar** karıştır" → `loop` + `break`: Önce karıştırırsın, sonra kontrol edersin; kıvam
  geldiyse durursun.
:::

### Bir eksik, bir fazla

10 metrelik düz bir çit kuracaksın ve her metrede bir direk olacak. Kaç direk gerekir? Çoğu insan hemen "10" der;
doğrusu 11'dir, çünkü iki ucun ikisine de direk gerekir. Programcılıkta bu tür hatalara
**bir-eksik/bir-fazla hatası (off-by-one error)** denir ve en sık yapılan hatalar arasındadır.

Döngülerde bu hata genellikle aralığın sınırında gizlenir. Aralıklarda `a..b` tam olarak `b - a` eleman
üretir; `a..=b` ise bir fazlasını. Bir dizinin geçerli indeksleri `0`'dan `len - 1`'e kadardır, yani
`0..dizi.len()`. Sınırı bir fazla yazarsan Modül 2'den tanıdığın panik gelir:

```rust,should_panic
fn main() {
    let notlar = [70, 85, 90];
    for i in 0..=notlar.len() {
        println!("{}. not: {}", i + 1, notlar[i]);
    }
}
```

Program üç notu yazdırır, ardından dördüncü turda `notlar[3]` için panikler: *index out of bounds: the
len is 3 but the index is 3*. Bu yüzden elemanları dolaşmak için indeks yerine doğrudan `for not in
notlar` yazmak daha güvenlidir: Aşılacak bir sınır yoktur.

```quiz
question: Aşağıdaki döngülerden hangileri gövdeyi **tam olarak 10 kez** çalıştırır? (Birden fazla seçenek doğru olabilir.)
options:
  - "`for i in 0..10`"
  - "`for i in 1..=10`"
  - "`for i in 1..10`"
  - "`for i in 0..=10`"
  - "`for i in (1..=10).rev()`"
answer: [0, 1, 4]
explanation: |
  `a..b` aralığında `b - a` eleman vardır: `0..10` → 10, `1..10` → 9. `a..=b` aralığında bir fazlası:
  `1..=10` → 10, `0..=10` → 11. `.rev()` eleman sayısını değiştirmez, yalnızca sırayı ters çevirir.
  Şüphe duyduğunda en küçük örnekle dene: `0..2` hangi sayıları verir? 0 ve 1, yani 2 tane.
feedback:
  - "Doğru: 0, 1, ..., 9 → 10 tur."
  - "Doğru: 1, 2, ..., 10 → 10 tur."
  - "`..` sonu hariç tutar: 1, ..., 9 → yalnızca 9 tur."
  - "`..=` sonu dahil eder: 0, 1, ..., 10 → 11 tur."
  - "Doğru: 10, 9, ..., 1 → yine 10 tur."
```

## Alıştırmalar

İki alıştırma: İlkinde bitiş anı önceden belli olmayan bir döngü, ikincisinde iç içe çalışan döngüler
ve erken dönüş var.

````exercise
id: m03-e-collatz
title: Collatz yolculuğu
difficulty: 2
prompt: |
  Matematiğin en ünlü çözülmemiş problemlerinden biri **Collatz sanısı**dır. Pozitif bir tamsayıyla
  başla ve şu kuralı tekrar tekrar uygula:

  - Sayı **çiftse** ikiye böl.
  - Sayı **tekse** 3 ile çarpıp 1 ekle.

  Sanıya göre hangi sayıdan başlarsan başla, sonunda hep 1'e ulaşırsın. Bilgisayarlar bunu çok büyük
  sayılara kadar denedi, ama henüz kimse ispatlayamadı!

  Örneğin 6'dan başlarsak: 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1. Bu yolculuk **8 adımdır**.

  `collatz_adim_sayisi(n: u64) -> u32` fonksiyonunu yaz: `n`'den başlayıp 1'e ulaşmak için kaç adım
  gerektiğini döndürsün. `n` her zaman en az 1'dir; 1 için cevap 0'dır.
starter: |
  fn collatz_adim_sayisi(n: u64) -> u32 {
      todo!()
  }

  fn main() {
      println!("6 → {} adım", collatz_adim_sayisi(6));
      println!("27 → {} adım", collatz_adim_sayisi(27));
  }
solution: |
  fn collatz_adim_sayisi(n: u64) -> u32 {
      let mut sayi = n;
      let mut adim = 0;
      while sayi != 1 {
          if sayi % 2 == 0 {
              sayi /= 2;
          } else {
              sayi = 3 * sayi + 1;
          }
          adim += 1;
      }
      adim
  }

  fn main() {
      println!("6 → {} adım", collatz_adim_sayisi(6));
      println!("27 → {} adım", collatz_adim_sayisi(27));
  }
check: tests
tests: |
  #[test]
  fn bir_zaten_hedefte() {
      assert_eq!(collatz_adim_sayisi(1), 0, "1'den başlayınca hiç adım gerekmez");
  }

  #[test]
  fn kisa_yolculuklar() {
      assert_eq!(collatz_adim_sayisi(2), 1, "2 → 1: tek adım");
      assert_eq!(collatz_adim_sayisi(6), 8, "6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1: 8 adım");
      assert_eq!(collatz_adim_sayisi(7), 16, "7'den başlayan yolculuk 16 adımdır");
  }

  #[test]
  fn uzun_yolculuklar() {
      assert_eq!(collatz_adim_sayisi(27), 111, "27'den başlayan yolculuk 111 adımdır");
      assert_eq!(collatz_adim_sayisi(97), 118, "97'den başlayan yolculuk 118 adımdır");
      assert_eq!(collatz_adim_sayisi(871), 178, "871'den başlayan yolculuk 178 adımdır");
  }
hints:
  - "Parametreler değişmezdir; önce değiştirilebilir bir kopya ve bir sayaç oluştur: `let mut sayi = n;` ve `let mut adim = 0;`"
  - "Sayı 1 olmadığı sürece dön: `while sayi != 1 { ... }`. İçeride `if sayi % 2 == 0` ile çift mi tek mi olduğuna bak ve her turun sonunda `adim += 1;` yap."
  - "İskelet: `while sayi != 1 { if sayi % 2 == 0 { sayi /= 2; } else { sayi = 3 * sayi + 1; } adim += 1; }` ve döngüden sonra noktalı virgülsüz `adim`."
explanation: |
  Döngünün kaç tur süreceğini önceden bilmiyoruz; tek bildiğimiz bitiş koşulu: "Sayı 1 olana kadar". Bu
  tam bir `while` işi. 1 için koşul baştan yanlış olduğundan döngü hiç çalışmaz ve 0 döner; ayrı bir
  kontrol gerekmez.

  Aynı fonksiyonu `loop` ve `break` değeriyle de yazabilirdin:

  ```rust
  fn collatz_adim_sayisi(n: u64) -> u32 {
      let mut sayi = n;
      let mut adim = 0;
      loop {
          if sayi == 1 {
              break adim;
          }
          sayi = if sayi % 2 == 0 { sayi / 2 } else { 3 * sayi + 1 };
          adim += 1;
      }
  }
  ```

  Parametreyi `fn collatz_adim_sayisi(mut n: u64)` diye `mut` yapıp kopya almadan doğrudan `n` üzerinde
  de çalışabilirdin (bu modülün ilk dersi). Neden `u64`? Sayılar yolculuk sırasında çok büyüyebilir:
  27'den başlayan yolculuk 9232'ye kadar tırmanır! Çok büyük başlangıç sayılarında küçük bir tip taşabilir
  (Modül 2).
````

````exercise
id: m03-e-asal
title: Asal sayı avcısı
difficulty: 3
prompt: |
  Bir sayı 1'den büyükse ve yalnızca 1'e ve kendisine bölünebiliyorsa **asaldır**: 2, 3, 5, 7, 11...
  İnternetteki şifrelemenin (HTTPS) temelinde dev asal sayılar yatar. İki fonksiyon yaz:

  1. `asal_mi(n: u32) -> bool` - `n` asalsa `true` döndürsün. 0 ve 1 asal değildir.
  2. `asal_sayisi(sinir: u32) -> u32` - 0'dan `sinir`'e kadar (`sinir` dahil) kaç asal sayı olduğunu
     döndürsün. İçinde `asal_mi` fonksiyonunu kullan.

  Örnek: 10'a kadar 4 asal sayı vardır (2, 3, 5, 7).
starter: |
  fn asal_mi(n: u32) -> bool {
      todo!()
  }

  fn asal_sayisi(sinir: u32) -> u32 {
      todo!()
  }

  fn main() {
      println!("97 asal mı? {}", asal_mi(97));
      println!("100'e kadar {} asal sayı var.", asal_sayisi(100));
  }
solution: |
  fn asal_mi(n: u32) -> bool {
      if n < 2 {
          return false;
      }
      let mut bolen = 2;
      while bolen * bolen <= n {
          if n % bolen == 0 {
              return false;
          }
          bolen += 1;
      }
      true
  }

  fn asal_sayisi(sinir: u32) -> u32 {
      let mut adet = 0;
      for sayi in 0..=sinir {
          if asal_mi(sayi) {
              adet += 1;
          }
      }
      adet
  }

  fn main() {
      println!("97 asal mı? {}", asal_mi(97));
      println!("100'e kadar {} asal sayı var.", asal_sayisi(100));
  }
check: tests
tests: |
  #[test]
  fn sifir_ve_bir_asal_degildir() {
      assert!(!asal_mi(0), "0 asal değildir");
      assert!(!asal_mi(1), "1 asal değildir");
  }

  #[test]
  fn kucuk_asallar() {
      assert!(asal_mi(2), "2 asaldır (tek çift asal)");
      assert!(asal_mi(3), "3 asaldır");
      assert!(asal_mi(97), "97 asaldır");
  }

  #[test]
  fn bilesik_sayilar() {
      assert!(!asal_mi(4), "4 = 2 × 2, asal değildir");
      assert!(!asal_mi(25), "25 = 5 × 5, asal değildir");
      assert!(!asal_mi(91), "91 = 7 × 13, asal değildir");
      assert!(!asal_mi(7917), "7917 = 3 × 7 × 13 × 29, asal değildir");
  }

  #[test]
  fn buyuk_asallar() {
      assert!(asal_mi(7919), "7919 asaldır (1000. asal sayı)");
      assert!(asal_mi(65521), "65521 asaldır");
  }

  #[test]
  fn asal_sayilarini_saymak() {
      assert_eq!(asal_sayisi(1), 0, "1'e kadar hiç asal yoktur");
      assert_eq!(asal_sayisi(2), 1, "2'ye kadar (2 dahil) 1 asal vardır");
      assert_eq!(asal_sayisi(10), 4, "10'a kadar 4 asal vardır: 2, 3, 5, 7");
      assert_eq!(asal_sayisi(100), 25, "100'e kadar 25 asal vardır");
      assert_eq!(asal_sayisi(1000), 168, "1000'e kadar 168 asal vardır");
  }
hints:
  - "`asal_mi` için önce küçük sayıları bir koruma koşuluyla ele al: `if n < 2 { return false; }`. Sonra 2'den başlayarak olası bölenleri tek tek dene."
  - "Bir bölen bulduğun anda `return false;` ile fonksiyondan çık. Döngü hiç bölen bulamadan biterse sayı asaldır: Döngüden sonra `true` yaz. Döngü olarak `for bolen in 2..n` yeterli."
  - "`asal_sayisi`: `let mut adet = 0;` ile başla, `for sayi in 0..=sinir` içinde `if asal_mi(sayi) { adet += 1; }` yap ve sonda `adet` döndür. `..=` ile sınırı dahil etmeyi unutma."
explanation: |
  `asal_mi` iki yerde erken dönüş yapıyor: Baştaki koruma koşulu (önceki ders) ve döngünün içindeki
  `return false`. Dikkat: Döngünün içindeki `return` yalnızca döngüden değil, **bütün fonksiyondan**
  çıkar. Döngü hiç bölen bulamadan biterse en alttaki `true` döndürülür.

  Neden `bolen * bolen <= n`? `n` sayısının karekökünden büyük bir böleni varsa, karekökünden küçük bir
  böleni de vardır (örneğin 91 = 7 × 13: 13'ü aramadan 7'yi zaten bulursun). Bu yüzden karekökün ötesine
  bakmaya gerek yok: 7919 için 7917 bölme yerine yalnızca 87 bölme (2'den 88'e kadar) yapılır. `for bolen in 2..n` de doğru
  sonuç verir, yalnızca daha yavaştır.

  Bir uzman detayı: `u32`'nin sınırına yakın çok büyük sayılarda `bolen * bolen` taşabilir (Modül 2).
  Bunu önlemek için koşul `bolen <= n / bolen` şeklinde yazılabilir.

  `asal_sayisi` ise her sayı için `asal_mi`'yi çağırıyor: Bir döngünün içinde, kendi döngüsü olan bir
  fonksiyon. Yani iç içe döngüler, ama her biri kendi küçük ve okunaklı fonksiyonunda. Büyük işleri küçük
  fonksiyonlara bölmenin güzel bir örneği!
````

## Özet

:::remember
- `loop { ... }` sonsuza kadar döner; `break` ile çıkılır. `let x = loop { ... break deger; };` ile
  döngüden **değer** döndürülür.
- `while kosul { ... }` koşul doğru oldukça döner; koşul her turdan önce sınanır, yani gövde hiç
  çalışmayabilir. `while`'dan değerle `break` yapılamaz (`E0571`).
- `for x in koleksiyon` her eleman için bir kez döner: `for not in notlar`, `for i in 1..=10`,
  `for i in (1..=3).rev()`.
- `a..b` sonu **hariç** tutar (`b - a` eleman), `a..=b` dahil eder. `5..1` gibi ters bir aralık boştur.
- `continue` turun geri kalanını atlar; `'etiket:` ile işaretlenmiş dış döngü `break 'etiket` /
  `continue 'etiket` ile yönetilir.
- Önce `for`'u düşün; sınırları en küçük örnekle sınayarak bir-eksik/bir-fazla hatalarından kaçın.
:::

```reflect
prompt: |
  `loop`, `while` ve `for` arasında nasıl seçim yaparsın? Her biri için, bu dersteki örneklerden farklı,
  günlük hayattan ya da yazmak istediğin bir programdan bir örnek ver.
answer: |
  Model cevap: Elimde bir koleksiyon ya da belli bir tekrar sayısı varsa `for` kullanırım; örneğin bir
  sınıftaki her öğrencinin notunu yazdırmak. Bir koşul doğru olduğu sürece tekrar gerekiyorsa `while`
  kullanırım; örneğin depodaki su belli bir seviyenin altında kaldığı sürece pompayı çalıştırmak. Bitiş
  anı ancak döngünün içinde anlaşılıyorsa ya da bir değer arıyorsam `loop` kullanırım; örneğin kullanıcı
  geçerli bir sayı girene kadar tekrar sormak ve sonunda o sayıyı döndürmek.
```

```flashcards
- front: Bir `loop`'tan nasıl değer döndürülür?
  back: "`break deger;` ile: `let x = loop { ... break 42; };`, `loop` da bir ifadedir."
- front: "`while` döngüsünden neden `break` ile değer döndürülemez (`E0571`)?"
  back: "`while` daha ilk turdan önce bitebilir; o zaman döngünün değeri belirsiz kalırdı. Yalnızca `loop` her zaman `break` ile biter."
- front: "`1..5` ve `1..=5` aralıkları hangi sayıları üretir?"
  back: "`1..5`: 1, 2, 3, 4 (son hariç). `1..=5`: 1, 2, 3, 4, 5 (son dahil)."
- front: 3'ten 1'e geri sayan bir `for` döngüsü nasıl yazılır?
  back: "`for i in (1..=3).rev()`, parantezler şart; yoksa `.rev()` yalnızca `3`'e uygulanır (`E0689`)."
- front: "`continue` ile `break` arasındaki fark nedir?"
  back: "`continue` yalnızca bu turun geri kalanını atlayıp sıradaki tura geçer; `break` döngüyü tamamen bitirir."
- front: İç içe iki döngüde, içteki döngüden dıştakini nasıl bitirirsin?
  back: "Dış döngüye bir etiket verip onu kırarak: `'dis: for ... { for ... { break 'dis; } }`"
- front: "`for i in 5..1 { ... }` ne yapar?"
  back: "Hiçbir şey. Aralık boştur, gövde hiç çalışmaz; `rustc` uyarmaz (yalnızca Clippy yakalar). Geri saymak için `.rev()` kullanılır, örneğin `(1..=5).rev()`."
- front: Uzunluğu `n` olan bir dizinin geçerli indeksleri hangi aralıktadır?
  back: "`0..n`, yani 0'dan n - 1'e kadar. `0..=n` son turda panik verir: index out of bounds."
```
