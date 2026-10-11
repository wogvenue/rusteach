---
id: m03-l05
title: "Proje: Sayı tahmin oyunu"
minutes: 35
type: project
objectives:
  - "Bir Cargo projesine dış bir crate (`rand`) ekleyip kullanabilmek"
  - "`std::io::stdin().read_line` ile girdi okuyup `trim` ve `parse` ile sayıya çevirebilmek"
  - "`loop`, `if`/`else`, `continue` ve `break` ile baştan sona çalışan bir oyun döngüsü kurabilmek"
  - Oyun mantığını girdi/çıktı kodundan ayırıp test edilebilir saf fonksiyonlara bölebilmek
keywords: [proje, sayı tahmin oyunu, stdin, read_line, trim, parse, rand, crate, Cargo.toml, Ordering, match, saf fonksiyon, ikili arama]
---

Dört derstir alet çantanı dolduruyorsun: fonksiyonlar, ifadeler, `if` ve döngüler. Şimdi bu aletlerle
ilk **gerçek** programını kuracaksın; kendi bilgisayarında çalışan, seninle konuşan bir oyun. Bilgisayar
1 ile 100 arasında gizli bir sayı tutacak, sen tahmin edeceksin, o da "daha büyük" ya da "daha küçük"
diyerek sana yol gösterecek:

```text
=== Sayı Tahmin Oyunu ===
1 ile 100 arasında bir sayı tuttum. Bil bakalım!
Tahminin:
50
Daha küçük bir sayı söyle.
Tahminin:
25
Daha büyük bir sayı söyle.
Tahminin:
otuz
Bu bir sayı değil, tekrar dene.
Tahminin:
37
Bildin! 3 denemede buldun.
```

Bu oyun, Rust'ın resmî kitabı *The Rust Programming Language*'in ünlü ilk projesidir. Yol boyunca üç yeni
şey göreceksin: klavyeden girdi okumak, metni sayıya çevirmek ve projene başkasının yazdığı bir kütüphaneyi
(crate) eklemek.

:::info Bu derste kod nerede çalışır?
Oyun klavyeden girdi okuyor. Uygulamanın içindeki çalıştırıcı sana klavye veremez; bu yüzden girdi okuyan
programlar **"çalıştırılamaz"** (yalnızca derlenen) örnek olarak gösteriliyor. Onları kendi bilgisayarında
`cargo run` ile çalıştır. Oyunun **mantığını** ise girdiden bağımsız fonksiyonlara ayıracağız; o kısımları
burada çalıştırıp test edebileceksin.
:::

## Projeyi kur ve gizli sayıyı tut

Modül 1'de öğrendiğin gibi, yeni bir Cargo projesi oluşturarak başla:

```console
> cargo new tahmin_oyunu
> cd tahmin_oyunu
> cargo run
Hello, world!
```

Ekrana gelen `Hello, world!` (Cargo'nun hazır şablonu), projenin sağlıklı kurulduğunu gösterir. Şimdi
oyunun ilk parçası: **gizli sayı**. Rust'ın standart kütüphanesinde (std) rastgele sayı üreten bir araç
**yoktur**. Python'da `import random` yazmak yeterlidir; Rust ise standart kütüphanesini bilerek küçük
tutar. Rastgelelik gibi işler, topluluğun yazdığı ve **crates.io** sitesinde paylaştığı **crate**'lere
bırakılır. Crate, Rust'taki paket ya da kütüphane birimidir ve rastgele sayılar için en çok kullanılanı
`rand`'dir.

Bir crate'i projene eklemek için `Cargo.toml` dosyasının `[dependencies]` (bağımlılıklar) bölümüne adını
ve sürümünü yazarsın:

```toml
[package]
name = "tahmin_oyunu"
version = "0.1.0"
edition = "2024"

[dependencies]
rand = "0.10"
```

Bu satırı elle yazmak yerine terminalde `cargo add rand` komutunu da çalıştırabilirsin; Cargo, crate'in en
güncel sürümünü bulup satırı kendisi ekler. Sonraki `cargo build` ya da `cargo run`'da Cargo, `rand`'i ve
onun ihtiyaç duyduğu diğer crate'leri internetten indirip derler:

```console
> cargo build
    Updating crates.io index
     Locking ... packages to latest compatible versions
  Downloaded rand v0.10.x
   Compiling rand v0.10.x
   Compiling tahmin_oyunu v0.1.0
    Finished `dev` profile [unoptimized + debuginfo] target(s)
```

İndirilen tam sürümler `Cargo.lock` dosyasına yazılır. Böylece projeyi bir yıl sonra derlediğinde de
(ya da bir arkadaşın derlediğinde) **aynı** sürümler kullanılır. `"0.10"` ise "0.10 serisiyle uyumlu
herhangi bir sürüm" demektir. Sürüm numaralarının bu dilini (semantic versioning) Modül 8'de ayrıntısıyla
göreceğiz.

:::analogy Market listesi ve fiş
`Cargo.toml` bir **market listesi** gibidir: "1 paket makarna (hangi marka olursa)". `Cargo.lock` ise
kasadan aldığın **fiş**: "X marka, 500 g, şu tarihte". Liste esnektir; fiş, tam olarak ne aldığını kayda
geçirir. Yarın aynı yemeği aynı tadda yapmak istiyorsan fişe bakarsın.
:::

Artık gizli sayıyı üretebiliriz:

```rust,norun
fn main() {
    let gizli: u32 = rand::random_range(1..=100);
    println!("Gizli sayı: {gizli}");
}
```

`rand::random_range(1..=100)`, `rand` crate'inin içindeki `random_range` fonksiyonunu çağırır ve ona bir
önceki dersten tanıdığın bir **aralık** verir. Dikkat: `1..=100` yazdık, çünkü 100 de gizli sayı
olabilmeli; `1..100` yazsaydık 100 hiç gelmezdi. Bu örnek her çalıştırmada farklı bir sayı yazdırdığı için
"çalıştırılamaz" olarak işaretli; kendi bilgisayarında birkaç kez dene.

:::warning Eski örneklere dikkat
İnternette ve eski kitaplarda `rand::thread_rng().gen_range(1..=100)` yazımını göreceksin. Bu, `rand`'in
**0.8** sürümünün yazımıdır; 0.10'da bu fonksiyon yoktur:

```text
error[E0425]: cannot find function `thread_rng` in crate `rand`
 --> src/main.rs:3:28
  |
3 |     let gizli: u32 = rand::thread_rng().gen_range(1..=100);
  |                            ^^^^^^^^^^ not found in `rand`
```

Crate'ler büyük sürüm değişikliklerinde yazımlarını değiştirebilir. Her zaman kullandığın sürümün
belgelerine bak: **docs.rs/rand** sitesinde her sürümün kendi belgesi vardır.
:::

```quiz
question: |
  `Cargo.toml`'a `rand` ekledin ve kodun yalnızca **hatasız derlenip derlenmediğini** en hızlı şekilde
  öğrenmek istiyorsun; programı çalıştırman gerekmiyor. Hangi komutu kullanırsın?
options:
  - "`cargo run`"
  - "`cargo check`"
  - "`cargo build --release`"
  - "`cargo new`"
answer: 1
explanation: |
  Modül 1'den hatırla: `cargo check` kodu derleyicinin bütün denetimlerinden geçirir, ama çalıştırılabilir
  dosya üretmez; bu yüzden en hızlısıdır. `cargo run` derler **ve** çalıştırır; `--release` ise
  optimizasyonlar yüzünden en yavaş derlemedir. Yazarken sık sık `cargo check`, denemek için `cargo run`
  kullanmak iyi bir alışkanlıktır.
feedback:
  - "`cargo run` önce derler, sonra programı başlatır; sadece hata aramak için fazladan iş yapar."
  - Doğru!
  - "`--release` derlemesi optimizasyon yaptığı için daha da yavaştır; yayın içindir."
  - "`cargo new` yeni bir proje oluşturur, mevcut kodu denetlemez."
```

## Oyuncudan girdi almak

Şimdi oyuncunun tahminini klavyeden okuyalım. Kod kısa, ama her parçasının bir hikâyesi var:

```rust,norun
use std::io;

fn main() {
    println!("Tahminin:");

    let mut girdi = String::new();

    io::stdin()
        .read_line(&mut girdi)
        .expect("Satır okunamadı");

    println!("Yazdığın: {girdi}");
}
```

Satır satır inceleyelim:

- **`use std::io;`**, standart kütüphanenin girdi/çıktı (input/output) bölümünü kullanacağımızı söyler.
  Bu satır olmasaydı her seferinde `std::io::stdin()` diye uzun adı yazardık. (`use` ve modül sistemi:
  Modül 8.)
- **`let mut girdi = String::new();`**, boş bir **`String`** oluşturur. Şimdiye kadar kullandığın
  `"merhaba"` gibi metin sabitleri programın içine gömülüdür ve değiştirilemez. `String` ise
  **büyüyebilen** bir metindir; oyuncunun ne yazacağını önceden bilmediğimiz için ona ihtiyacımız var.
  `String`'i Modül 4'te derinlemesine göreceksin. `mut` şart, çünkü birazdan içine yazılacak.
- **`io::stdin()`**, klavyeye bağlı **standart girdiye (standard input)** erişim verir.
- **`.read_line(&mut girdi)`**, oyuncu Enter'a basana kadar bekler, yazılanı `girdi`'nin **sonuna ekler**.
  `&mut girdi`, "`girdi` değişkenini sana **ödünç veriyorum**, içini değiştirebilirsin; ama değişken hâlâ
  benim" demektir. Buna **değiştirilebilir referans (mutable reference)** denir ve Modül 5'in konusudur.
  Şimdilik kalıp olarak öğren.
- **`.expect("Satır okunamadı")`**, okuma nadiren de olsa başarısız olabilir (örneğin girdi kaynağı
  kapanmışsa). `expect`, Modül 2'de `parse` ile tanıdığın "başarısız olursa bu mesajla programı durdur"
  aracıdır. Hata yönetiminin doğrusunu Modül 10'da öğreneceğiz.

Uzun bir metot zincirini her `.` başında yeni satıra bölmek Rust'ta yaygın bir stildir; derleyici için
`io::stdin().read_line(&mut girdi).expect("Satır okunamadı");` ile tamamen aynıdır.

:::analogy Boş form ve anketör
Bir anketöre boş bir form ve kalem uzatıyorsun: "Buraya yaz." Anketör formu doldurur ve geri verir; form
hep **senindi**, o sadece bir süreliğine üzerine yazdı. `read_line(&mut girdi)` de böyledir: `girdi`
senin değişkenin; `read_line` onu ödünç alır, içine yazar ve bırakır.
:::

```memory
title: read_line(&mut girdi) öncesi ve sonrası
steps:
  - caption: "`String::new()` boş bir metin oluşturur: uzunluk 0, henüz heap'te yer ayrılmamış."
    stack:
      - frame: main
        vars:
          - { name: girdi, type: String, value: "ptr · len=0 · cap=0", mut: true }
  - caption: "Oyuncu `42` yazıp Enter'a bastı. `read_line` metni `girdi`'ye ekledi. Enter tuşu da metne girdi: Windows'ta `\\r\\n`, Linux ve macOS'ta yalnızca `\\n`."
    stack:
      - frame: main
        vars:
          - { name: girdi, type: String, value: "ptr · len=4 · cap=8", mut: true, to: h1 }
    heap:
      - { id: h1, value: "4 2 \\r \\n", label: "Windows'ta okunan baytlar" }
```

Diyagramın ikinci adımındaki ayrıntı önemli: Enter'a bastığında oluşan **satır sonu karakteri** de
`girdi`'nin içindedir. Bunun sonucunu tahmin et. Aşağıdaki programda klavye yerine, `read_line`'ın
verdiği metni taklit eden hazır bir `String` kullanıyoruz:

````predict
code: |
  fn main() {
      // read_line'ın Linux'ta döndürdüğü metni taklit ediyoruz.
      let girdi = String::from("42\n");
      println!("[{girdi}]");
  }
options:
  - |
    [42]
  - |
    [42
    ]
  - |
    [42\n]
answer: 1
explanation: |
  `\n` iki ayrı karakter (`\` ve `n`) değil, tek bir **satır sonu** karakteridir. Yazdırıldığında imleci
  alt satıra geçirir; bu yüzden kapanan köşeli parantez bir alt satıra düşer. Yani oyuncu `42` yazdığında
  elimizdeki metin `"42"` değil, `"42\n"`'dir (Windows'ta `"42\r\n"`). Bu görünmez karakter, bir sonraki
  adımda başımızı ağrıtacak.
````

## Metinden sayıya: trim ve parse

Elimizde oyuncunun yazdığı bir `String`, bir de `u32` türünde gizli sayı var. Hemen karşılaştıralım mı?

```compiles
code: |
  fn main() {
      let tahmin = String::from("50");
      let gizli: u32 = 42;
      if tahmin < gizli {
          println!("Daha büyük bir sayı söyle.");
      }
  }
answer: false
error: E0308
explanation: |
  `tahmin` bir **metin**, `gizli` bir **sayı**. Modül 2'den hatırla: Rust statik ve katı tiplidir;
  farklı tipleri karşılaştırmaz, birini diğerine sessizce çevirmez. JavaScript'te `"50" < 42` yazınca dil
  metni gizlice sayıya çevirir; Rust bu tür sürprizlere izin vermez.
```

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:4:17
  |
4 |     if tahmin < gizli {
  |        ------   ^^^^^ expected `String`, found `u32`
  |        |
  |        expected because this is `String`
  |
help: try using a conversion method
  |
4 |     if tahmin < gizli.to_string() {
  |                      ++++++++++++
```
Derleyici `help` satırında `gizli`'yi metne çevirmeyi öneriyor. Bu öneri kodu derletir, ama **yanlış**
sonuç verir: Metinler sözlük sırasıyla, harf harf karşılaştırılır. Önerileri her zaman düşünerek uygula;
derleyici tipleri bilir, senin niyetini değil.
:::

Metinlerin sözlük sırasıyla karşılaştırılması ne demek? Kendin gör:

```rust
fn main() {
    println!("{}", "9" < "10"); // metin olarak
    println!("{}", 9 < 10); // sayı olarak
}
```

Metin olarak `"9"`, `"10"`'dan **büyüktür**, çünkü ilk karakterler karşılaştırılır ve `'9'` > `'1'`'dir.
Doğru yol, metni sayıya çevirmektir. Modül 2'de `"42".parse::<i32>()` görmüştün; burada aynı aracı
kullanacağız. Ama önce bir tuzak:

```rust,should_panic
fn main() {
    let girdi = String::from("42\n"); // read_line böyle bir metin verir
    let tahmin: u32 = girdi.parse().expect("Lütfen bir sayı yaz!");
    println!("{tahmin}");
}
```

```text
thread 'main' (13) panicked at src/main.rs:3:37:
Lütfen bir sayı yaz!: ParseIntError { kind: InvalidDigit }
```

`InvalidDigit` (geçersiz rakam): `parse`, `\n`'yi bir rakam olarak okuyamadı. Çözüm, önce metnin
başındaki ve sonundaki boşlukları, sekmeleri ve satır sonlarını silen **`trim`** metodunu çağırmaktır:

```rust
fn main() {
    let tahmin = String::from("  42\r\n"); // oyuncu önce boşluk bıraktı, sonra Enter'a bastı
    let tahmin: u32 = tahmin.trim().parse().expect("Lütfen bir sayı yaz!");
    let gizli: u32 = 42;

    if tahmin == gizli {
        println!("Bildin!");
    }
}
```

İkinci satırda üç tanıdık fikir birden var:

1. **Gölgeleme (shadowing, Modül 2):** Yeni `tahmin`, eski `String` olan `tahmin`'i gölgeler. Rust
   programcıları bu kalıbı tam da bu iş için sever: "Aynı bilginin metin hâli artık gerekmiyor, sayı
   hâline aynı adı verelim." Böylece `tahmin_metni`, `tahmin_sayisi` gibi iki ayrı isim uydurmayız.
2. **Tip belirtme:** `parse` pek çok tipe çevirebilir (`i32`, `u8`, `f64`...). Hangisini istediğimizi
   `: u32` ile söylüyoruz. `parse::<u32>()` (turbofish) yazmak da aynı işi görür.
3. **`expect`:** Oyuncu `otuz` yazarsa çeviri başarısız olur ve program bu mesajla durur. Bir sonraki
   adımlarda programı durdurmak yerine oyuncuya tekrar soracağız.

Neden `u32`? Gizli sayı 1 ile 100 arasında; negatif bir tahmin anlamsız. `u32` seçince `-5` gibi bir
girdi daha çeviri aşamasında reddedilir.

```quiz
question: |
  Aşağıdaki metinlerin hangileri **`trim` yapılmadan** `.parse::<u32>()` ile başarıyla sayıya çevrilir?
  (Birden fazla seçenek doğru olabilir.)
options:
  - '`"42"`'
  - '`" 42"`'
  - '`"+42"`'
  - '`"-42"`'
  - '`"042"`'
  - '`"4 2"`'
answer: [0, 2, 4]
explanation: |
  `parse` katıdır: Metnin **tamamı** geçerli bir sayı olmalı. `"42"` elbette çevrilir. Baştaki `+`
  işareti kabul edilir (`"+42"` → 42), baştaki sıfırlar da (`"042"` → 42). Ama tek bir boşluk bile
  (`" 42"`, `"4 2"`) çeviriyi bozar; `trim` bu yüzden şart. `"-42"` ise `u32` için geçersizdir: İşaretsiz
  bir tip eksi işareti kabul etmez (Modül 2). Aynı metin `i32`'ye çevrilseydi -42 olurdu.
feedback:
  - Doğru, en temiz durum.
  - "Baştaki boşluk geçersiz bir karakterdir: `InvalidDigit`. Önce `trim` gerekir."
  - Doğru! Artı işareti işaretsiz tiplerde de kabul edilir.
  - "`u32` işaretsizdir; eksi işareti `InvalidDigit` hatası verir."
  - Doğru! Baştaki sıfırlar sorun değildir.
  - Ortadaki boşluğu `trim` bile silmez; bu metin hiçbir zaman sayıya çevrilemez.
```

```fill
prompt: |
  Boşlukları doldur: Program, oyuncunun yazdığı metni temizleyip `u32`'ye çevirsin ve bir fazlasını, yani
  `74` yazdırsın.
code: |
  fn main() {
      let girdi = String::from("  73\n");
      let tahmin: ___0 = girdi.___1().___2().expect("Sayı bekleniyordu");
      println!("{}", tahmin + 1);
  }
blanks:
  - ["u32", "u64", "u16", "u8", "i32", "i64", "i16"]
  - ["trim"]
  - ["parse"]
output: "74"
explanation: |
  Sıra önemli: Önce `trim()` ile baştaki boşluklar ve sondaki `\n` silinir, sonra `parse()` temiz metni
  (`"73"`) sayıya çevirir. Tersini yazamazsın; `parse` sonucu artık metin değildir ve `trim` diye bir
  metodu yoktur. Hangi tipe çevrileceğini `let tahmin: u32` belirtir; 73 sığdığı için diğer tamsayı
  tipleri de çalışırdı.
```

## Karşılaştırmak: saf bir fonksiyon

Artık iki sayımız var: `tahmin` ve `gizli`. Karşılaştırmayı doğrudan `main`'in içine yazabilirdik; ama
onu kendi fonksiyonuna koymak için çok iyi bir sebep var. Önce koda bak:

```rust
fn karsilastir(tahmin: u32, gizli: u32) -> &'static str {
    if tahmin < gizli {
        "Daha büyük bir sayı söyle."
    } else if tahmin > gizli {
        "Daha küçük bir sayı söyle."
    } else {
        "Bildin!"
    }
}

fn main() {
    println!("{}", karsilastir(30, 42));
    println!("{}", karsilastir(77, 42));
    println!("{}", karsilastir(42, 42));
}
```

Fonksiyon gövdesi tek bir `if` ifadesinden oluşuyor ve her dal bir metin sabiti üretiyor (bu modülün 3.
dersi: Dalların hepsi aynı tipte olmalı). Dönüş tipi `&'static str`, metin sabitlerinin tipidir: "Programın
içine gömülü, program çalıştığı sürece yaşayan, değiştirilemeyen metin". Bu yazımın parçalarını Modül 4,
5 ve 12'de tek tek açacağız; şimdilik "metin sabiti döndüren fonksiyonun dönüş tipi" olarak bil.

Peki neden ayrı bir fonksiyon? `karsilastir` bir **saf fonksiyon (pure function)**:

- Klavyeden okumaz, ekrana yazmaz, rastgele sayı üretmez.
- **Aynı girdilere her zaman aynı cevabı** verir: `karsilastir(30, 42)` bugün de, yarın da aynıdır.

Bu sayede onu test etmek çok kolaydır: Rastgele bir sayıyı tahmin etmeye ya da klavyeden bir şey yazmaya
gerek kalmadan `karsilastir(30, 42)` çağırıp sonuca bakarsın. Bu dersin alıştırmaları da tam olarak böyle
test edilecek. Profesyonel yazılımda bu yaklaşımın bir adı bile var: Mantığı saf bir **çekirdeğe**
koy, klavye, ekran, dosya gibi dış dünyayla konuşan kodu ise ince bir **kabukta** tut.

:::analogy Test tezgâhındaki motor
Bir araba motoru üretilirken önce arabaya takılmaz; fabrikada bir **test tezgâhına** bağlanır.
Mühendisler ona istedikleri yakıtı, istedikleri devri verip ölçüm yapar. Motor arabanın içindeyken bunu
yapmak çok daha zordur. `karsilastir` bizim motorumuz; testler ise tezgâh.
:::

Gerçek bir oyun turu nasıl görünür? Aşağıda oyuncunun yazacağı tahminleri bir diziye koyarak bir oyunu
**simüle ediyoruz**. Programın çıktısını tahmin et:

````predict
code: |
  # fn karsilastir(tahmin: u32, gizli: u32) -> &'static str {
  #     if tahmin < gizli {
  #         "Daha büyük bir sayı söyle."
  #     } else if tahmin > gizli {
  #         "Daha küçük bir sayı söyle."
  #     } else {
  #         "Bildin!"
  #     }
  # }
  #
  // karsilastir fonksiyonu yukarıdakiyle aynı.
  fn main() {
      let gizli = 42;
      let mut deneme = 0;
      for tahmin in [50, 25, 42, 60] {
          deneme += 1;
          println!("{tahmin}: {}", karsilastir(tahmin, gizli));
          if tahmin == gizli {
              break;
          }
      }
      println!("{deneme} deneme");
  }
options:
  - |
    50: Daha küçük bir sayı söyle.
    25: Daha büyük bir sayı söyle.
    42: Bildin!
    3 deneme
  - |
    50: Daha küçük bir sayı söyle.
    25: Daha büyük bir sayı söyle.
    42: Bildin!
    60: Daha küçük bir sayı söyle.
    4 deneme
  - |
    50: Daha büyük bir sayı söyle.
    25: Daha küçük bir sayı söyle.
    42: Bildin!
    3 deneme
answer: 0
explanation: |
  50 gizli sayıdan büyük, o yüzden "daha küçük" önerilir; 25 küçük, o yüzden "daha büyük". 42'de
  "Bildin!" yazıldıktan sonra `break` döngüyü bitirir; 60 hiç işlenmez ve `deneme` 3'te kalır. Mesajların
  yönüne dikkat: Mesaj, **tahminin** değil, oyuncunun bir sonraki tahmininin nereye gitmesi gerektiğini
  söylüyor.
````

### Önizleme: `Ordering` ve `match`

Rust kitabı aynı karşılaştırmayı farklı bir araçla yazar. Bunu şimdi sadece **tanıman** için gösteriyoruz;
`match`'i ve `enum`'ları Modül 7'de baştan, ayrıntısıyla öğreneceksin:

```rust
use std::cmp::Ordering;

fn karsilastir(tahmin: u32, gizli: u32) -> &'static str {
    match tahmin.cmp(&gizli) {
        Ordering::Less => "Daha büyük bir sayı söyle.",
        Ordering::Greater => "Daha küçük bir sayı söyle.",
        Ordering::Equal => "Bildin!",
    }
}

fn main() {
    println!("{}", karsilastir(10, 20));
    println!("{}", karsilastir(20, 20));
}
```

Okunuşu şöyle:

- `tahmin.cmp(&gizli)` iki sayıyı karşılaştırır ve üç olası cevaptan birini verir: `Ordering::Less`
  (küçük), `Ordering::Greater` (büyük) ya da `Ordering::Equal` (eşit). `&gizli`'deki `&`, sayıyı
  "ödünç vermek" demektir (Modül 5).
- `match`, gelen cevabı sırayla kollarla (`=>` öncesindeki desenlerle) karşılaştırır ve eşleşen kolun
  değerini üretir. `if` gibi `match` da bir **ifadedir**; burada fonksiyonun dönüş değeri o.
- En güzel yanı: Üç durumdan birini unutursan kod **derlenmez** (`E0004: non-exhaustive patterns`).
  Derleyici "Eşit olma durumunu ele almadın" der. Bir `else if` zincirinde ise unutulan durum sessizce
  geçip gider.

Bu modülde `if`/`else` sürümüyle devam edeceğiz; iki sürüm de aynı işi görür.

## Oyun döngüsü: hepsini birleştir

Parçalar hazır. Oyuncu doğru sayıyı bulana kadar tekrar sormak için bir döngü gerekiyor. Kaç tur süreceği
belli değil ve en az bir kez sormamız gerekiyor: Bu tam bir **`loop`** işi (bir önceki dersteki seçim
tablosunu hatırla). İşte oyunun tamamı:

```rust,norun
use std::io;

fn karsilastir(tahmin: u32, gizli: u32) -> &'static str {
    if tahmin < gizli {
        "Daha büyük bir sayı söyle."
    } else if tahmin > gizli {
        "Daha küçük bir sayı söyle."
    } else {
        "Bildin!"
    }
}

fn main() {
    println!("=== Sayı Tahmin Oyunu ===");
    println!("1 ile 100 arasında bir sayı tuttum. Bil bakalım!");

    let gizli: u32 = rand::random_range(1..=100);
    let mut deneme = 0;

    loop {
        println!("Tahminin:");

        let mut girdi = String::new();
        io::stdin()
            .read_line(&mut girdi)
            .expect("Satır okunamadı");

        let sonuc = girdi.trim().parse::<u32>();
        if sonuc.is_err() {
            println!("Bu bir sayı değil, tekrar dene.");
            continue;
        }
        let tahmin = sonuc.unwrap();

        if tahmin < 1 || tahmin > 100 {
            println!("Lütfen 1 ile 100 arasında bir sayı yaz.");
            continue;
        }

        deneme += 1;

        if tahmin == gizli {
            println!("Bildin! {deneme} denemede buldun.");
            break;
        }
        println!("{}", karsilastir(tahmin, gizli));
    }
}
```

Bu programı kendi bilgisayarındaki `tahmin_oyunu` projesinin `src/main.rs` dosyasına yaz ve `cargo run`
ile oyna. Yeni olan tek parça, geçersiz girdiyi ele alış biçimi:

- `parse` bize doğrudan bir sayı değil, içinde **ya bir sayı ya da bir hata** bulunan bir kutu verir
  (bu kutunun adı `Result`; Modül 10'un konusu). Şimdiye kadar `expect` ile "hata varsa programı durdur"
  diyorduk. Burada önce kutuya soruyoruz: `sonuc.is_err()`, yani "içinde hata mı var?"
- Hata varsa oyuncuyu uyarır ve **`continue`** ile döngünün başına, yeni bir tahmin istemeye döneriz.
  Program çökmez.
- Hata yoksa `sonuc.unwrap()` kutudaki sayıyı çıkarır. Hemen önceki satırda hata olmadığını kontrol
  ettiğimiz için bu `unwrap` asla panik yapmaz.

Aralık dışı tahminler de `continue` ile reddediliyor ve `deneme`'yi artırmıyor; `deneme += 1;`
satırının **iki kontrolden sonra** gelmesinin sebebi bu.

:::deep Rust kitabındaki deyimsel yazım
Rust programcıları geçersiz girdiyi genellikle `match` ile ele alır:

```rust,ignore
let tahmin: u32 = match girdi.trim().parse() {
    Ok(sayi) => sayi,
    Err(_) => {
        println!("Bu bir sayı değil, tekrar dene.");
        continue;
    }
};
```

`Ok(sayi)` kolu kutudan sayıyı çıkarıp ona `sayi` adını verir; `Err(_)` kolu "hata ne olursa olsun"
anlamına gelir. `is_err` ve `unwrap` ikilisinden daha güvenlidir, çünkü kontrolü unutup `unwrap`
yazmak mümkün değildir. Bu yazımın her parçasını Modül 7 ve 10'da öğreneceksin.
:::

```quiz
question: |
  Bir arkadaşın kodu "sadeleştirmek" için `let mut girdi = String::new();` satırını `loop`'un **dışına**,
  döngüden hemen önceye taşıdı. Oyuncu önce `50`, sonra `42` yazarsa ikinci turda ne olur? (Varsayım:
  Linux, satır sonu `\n`.)
options:
  - Hiçbir şey değişmez; `read_line` her turda `girdi`'nin içeriğini yeni satırla değiştirir
  - "`girdi` artık `\"50\\n42\\n\"` olur; `trim` ortadaki satır sonunu silmediği için çeviri başarısız olur ve oyun her turda \"Bu bir sayı değil\" der"
  - "Kod derlenmez, çünkü `girdi` döngüden önce tanımlanamaz"
answer: 1
explanation: |
  `read_line` metni **değiştirmez**, sonuna **ekler**. Döngünün dışında bir kez oluşturulan `girdi` turdan
  tura büyür: `"50\n"`, sonra `"50\n42\n"`. `trim` yalnızca baştaki ve sondaki boşlukları siler; ortadaki
  `\n` kalır, `parse` başarısız olur ve oyuncu ne yazarsa yazsın oyun ilerlemez. Bu yüzden `girdi`'yi her
  turda yeniden oluşturuyoruz. (`String`'i yeniden kullanmanın diğer yolu, her tur başında içini
  boşaltmaktır; bunu Modül 9'da göreceksin.)
feedback:
  - "`read_line`'ın belgesi açıkça söyler: Okunan veri mevcut içeriğin **sonuna eklenir** (*appended*)."
  - Doğru! Görünüşte zararsız bir değişiklik, oyunu kilitledi.
  - Derlenir; `girdi` mut olduğu için döngü içinde değiştirilebilir. Sorun çalışma zamanında çıkar.
```

```parsons
prompt: |
  Satırları sıraya koy: Program, bir dizi tahminle oyunu simüle etsin. 1-100 aralığı dışındaki tahminler
  sayılmadan atlansın, doğru tahminde döngü bitsin ve program `3 denemede bulundu` yazdırsın.
lines: |
  fn main() {
      let gizli = 64;
      let mut deneme = 0;
      for tahmin in [50, 0, 75, 64, 80] {
          if tahmin < 1 || tahmin > 100 {
              continue;
          }
          deneme += 1;
          if tahmin == gizli {
              break;
          }
      }
      println!("{deneme} denemede bulundu");
  }
distractors: |2
          if tahmin = gizli {
      let deneme = 0;
explanation: |
  Geçersiz tahmin (0) `continue` ile atlanır ve sayılmaz; 50, 75 ve 64 sayılır. 64'te `break` döngüyü
  bitirir, 80'e hiç gelinmez: Sonuç 3. `let deneme = 0;` olmazdı, çünkü değişken her turda değişiyor
  (Modül 2'deki `E0384`). `if tahmin = gizli` ise C'nin en ünlü hatalarındandır: Karşılaştırma (`==`)
  yerine atama (`=`). C bunu sessizce derler; Rust'ta ise atama `()` ürettiği ve `if` bir `bool`
  beklediği için derlenmez (`E0308`).
```

:::tip Oyunu geliştir
Oyun çalıştıktan sonra kendini dene. Her biri bu modülde öğrendiklerinle yapılabilir:
- Oyuncuya **7 deneme hakkı** ver; haklar bitince gizli sayıyı açıkla ve oyunu bitir.
- Oyun bitince "Tekrar oynamak ister misin? (e/h)" diye sor; `e` yazılırsa yeni bir gizli sayıyla baştan
  başla. İpucu: Dış bir `loop` ve bir etiket.
- Zorluk seviyeleri ekle: kolay 1-10, orta 1-100, zor 1-1000.
:::

## Alıştırmalar

İki alıştırma da oyunun **saf çekirdeği** üzerinde: Klavye yok, rastgelelik yok; gizli sayı ve tahminler
parametre olarak geliyor. İlkinde daha akıllı ipuçları üreteceksin, ikincisinde oyunu senin yerine
oynayan bir bot yazacaksın.

````exercise
id: m03-e-sicak-soguk
title: Sıcak mı, soğuk mu?
difficulty: 2
prompt: |
  Çocukken oynadığın "sıcak-soğuk" oyununu tahmin oyununa ekleyelim. `ipucu(tahmin: u32, gizli: u32)`
  fonksiyonunu yaz. Fonksiyon, tahminle gizli sayı arasındaki **farka** göre şu metinlerden birini
  döndürsün (metinler birebir aynı olmalı):

  | Durum | Döndürülecek metin |
  |---|---|
  | Tahmin doğru | `"Bildin!"` |
  | Tahmin küçük, fark **5 veya daha az** | `"Sıcak! Biraz daha büyük."` |
  | Tahmin küçük, fark 5'ten fazla | `"Soğuk! Çok daha büyük."` |
  | Tahmin büyük, fark **5 veya daha az** | `"Sıcak! Biraz daha küçük."` |
  | Tahmin büyük, fark 5'ten fazla | `"Soğuk! Çok daha küçük."` |

  Örnek: Gizli sayı 42 ise `ipucu(37, 42)` → `"Sıcak! Biraz daha büyük."` (fark tam 5),
  `ipucu(36, 42)` → `"Soğuk! Çok daha büyük."` (fark 6).

  Dikkat: Parametreler `u32`. Küçük bir sayıdan büyük bir sayıyı çıkarırsan ne olacağını Modül 2'den
  hatırla!
starter: |
  fn ipucu(tahmin: u32, gizli: u32) -> &'static str {
      todo!()
  }

  fn main() {
      println!("{}", ipucu(40, 42));
      println!("{}", ipucu(90, 42));
      println!("{}", ipucu(42, 42));
  }
solution: |
  fn ipucu(tahmin: u32, gizli: u32) -> &'static str {
      if tahmin == gizli {
          return "Bildin!";
      }

      if tahmin < gizli {
          let fark = gizli - tahmin;
          if fark <= 5 {
              "Sıcak! Biraz daha büyük."
          } else {
              "Soğuk! Çok daha büyük."
          }
      } else {
          let fark = tahmin - gizli;
          if fark <= 5 {
              "Sıcak! Biraz daha küçük."
          } else {
              "Soğuk! Çok daha küçük."
          }
      }
  }

  fn main() {
      println!("{}", ipucu(40, 42));
      println!("{}", ipucu(90, 42));
      println!("{}", ipucu(42, 42));
  }
check: tests
tests: |
  #[test]
  fn dogru_tahmin() {
      assert_eq!(ipucu(42, 42), "Bildin!", "tahmin gizli sayıya eşitse \"Bildin!\" dönmeli");
      assert_eq!(ipucu(1, 1), "Bildin!", "1 = 1, bildin");
      assert_eq!(ipucu(100, 100), "Bildin!", "100 = 100, bildin");
  }

  #[test]
  fn kucuk_tahminler() {
      assert_eq!(ipucu(40, 42), "Sıcak! Biraz daha büyük.", "40, 42'ye 2 uzakta: sıcak");
      assert_eq!(ipucu(37, 42), "Sıcak! Biraz daha büyük.", "fark tam 5 ise hâlâ sıcak sayılır");
      assert_eq!(ipucu(36, 42), "Soğuk! Çok daha büyük.", "fark 6: artık soğuk");
      assert_eq!(ipucu(1, 100), "Soğuk! Çok daha büyük.", "1 ile 100 arasındaki fark 99: çok soğuk");
  }

  #[test]
  fn buyuk_tahminler() {
      assert_eq!(ipucu(44, 42), "Sıcak! Biraz daha küçük.", "44, 42'ye 2 uzakta: sıcak");
      assert_eq!(ipucu(47, 42), "Sıcak! Biraz daha küçük.", "fark tam 5 ise hâlâ sıcak sayılır");
      assert_eq!(ipucu(48, 42), "Soğuk! Çok daha küçük.", "fark 6: artık soğuk");
      assert_eq!(ipucu(100, 1), "Soğuk! Çok daha küçük.", "100 ile 1 arasındaki fark 99: çok soğuk");
  }
hints:
  - "Önce en kolay durumu ele al: `if tahmin == gizli { return \"Bildin!\"; }`. Geriye iki durum kalır: tahmin küçük ya da büyük."
  - "`u32`'de `tahmin - gizli` yazarsan ve `tahmin` küçükse program **taşma paniği** verir. Farkı, hangi sayının büyük olduğunu bildiğin dalın içinde hesapla: Tahmin küçükse `gizli - tahmin`, büyükse `tahmin - gizli`."
  - "İskelet: `if tahmin < gizli { let fark = gizli - tahmin; if fark <= 5 { \"Sıcak! Biraz daha büyük.\" } else { \"Soğuk! Çok daha büyük.\" } } else { ... }`, `else` dalı aynısının küçük için olan hâli."
explanation: |
  Çözümde bu modülün bütün parçaları var: Erken dönüşle (`return`) en kolay durum en başta ayıklanıyor,
  geri kalanı ise iç içe `if` **ifadeleriyle** değer üretiyor. Fonksiyonun son ifadesi dıştaki
  `if`/`else`; her iki dal da bir `&'static str` üretiyor.

  Asıl tuzak **çıkarma**: `u32` negatif olamaz. `let fark = tahmin - gizli;` satırını iki dalın
  dışına yazsaydın, `ipucu(40, 42)` çağrısında 40 - 42 hesaplanır ve debug derlemesinde program
  *attempt to subtract with overflow* paniği verirdi (Modül 2). Farkı, hangi sayının büyük olduğunu
  bildiğimiz dalın içinde hesaplayarak bundan kaçındık.

  Rust'ta bu iş için hazır bir metot da var: `tahmin.abs_diff(gizli)`, iki sayı arasındaki farkı her
  zaman pozitif olarak, taşma olmadan verir. Onunla çözüm şöyle kısalır:

  ```rust
  fn ipucu(tahmin: u32, gizli: u32) -> &'static str {
      let fark = tahmin.abs_diff(gizli);
      if fark == 0 {
          "Bildin!"
      } else if tahmin < gizli {
          if fark <= 5 { "Sıcak! Biraz daha büyük." } else { "Soğuk! Çok daha büyük." }
      } else if fark <= 5 {
          "Sıcak! Biraz daha küçük."
      } else {
          "Soğuk! Çok daha küçük."
      }
  }
  ```

  Bu fonksiyonu oyuna takmak için oyun döngüsündeki `karsilastir(tahmin, gizli)` çağrısını
  `ipucu(tahmin, gizli)` ile değiştirmen yeterli. Saf fonksiyonların güzelliği: Oyunun geri kalanına
  dokunmadan beynini değiştirdin.
````

````exercise
id: m03-e-tahmin-botu
title: Hiç kaybetmeyen bot
difficulty: 3
prompt: |
  Bilgisayarın 1 ile 100 arasında tuttuğu sayıyı **en az denemede** bulan bir bot yaz. Botun stratejisi
  **ikili arama (binary search)**: Her zaman kalan aralığın tam ortasını söyler, aldığı cevaba göre
  aralığın yarısını eler.

  - Başta olası aralık `alt = 1`, `ust = 100`.
  - Her turda tahmin: `(alt + ust) / 2` (tamsayı bölmesi, yani aşağı yuvarlanır).
  - Tahmin doğruysa oyun biter.
  - Tahmin gizli sayıdan küçükse cevap tahminin üstündedir: `alt = tahmin + 1`.
  - Tahmin gizli sayıdan büyükse cevap tahminin altındadır: `ust = tahmin - 1`.

  `bot_deneme_sayisi(gizli: u32) -> u32` fonksiyonu, botun gizli sayıyı **kaçıncı tahminde** bulduğunu
  döndürsün. `gizli` her zaman 1 ile 100 arasındadır.

  Örnek: `gizli = 25` ise bot önce 50 der (büyük), sonra 1..=49 aralığının ortası olan 25'i söyler ve
  bulur. Cevap 2.
starter: |
  fn bot_deneme_sayisi(gizli: u32) -> u32 {
      todo!()
  }

  fn main() {
      println!("25 → {} tahmin", bot_deneme_sayisi(25));
      println!("100 → {} tahmin", bot_deneme_sayisi(100));
  }
solution: |
  fn bot_deneme_sayisi(gizli: u32) -> u32 {
      let mut alt = 1;
      let mut ust = 100;
      let mut deneme = 0;

      loop {
          let tahmin = (alt + ust) / 2;
          deneme += 1;

          if tahmin == gizli {
              break deneme;
          } else if tahmin < gizli {
              alt = tahmin + 1;
          } else {
              ust = tahmin - 1;
          }
      }
  }

  fn main() {
      println!("25 → {} tahmin", bot_deneme_sayisi(25));
      println!("100 → {} tahmin", bot_deneme_sayisi(100));
  }
check: tests
tests: |
  #[test]
  fn ilk_tahminde_bulur() {
      assert_eq!(bot_deneme_sayisi(50), 1, "ilk tahmin (1 + 100) / 2 = 50'dir");
  }

  #[test]
  fn ikinci_tahminde_bulur() {
      assert_eq!(bot_deneme_sayisi(25), 2, "50 büyük → aralık 1..=49 → ortası 25");
      assert_eq!(bot_deneme_sayisi(75), 2, "50 küçük → aralık 51..=100 → ortası 75");
  }

  #[test]
  fn uclardaki_sayilar() {
      assert_eq!(bot_deneme_sayisi(1), 6, "1 için tahminler: 50, 25, 12, 6, 3, 1");
      assert_eq!(bot_deneme_sayisi(100), 7, "100 için tahminler: 50, 75, 88, 94, 97, 99, 100");
  }

  #[test]
  fn hicbir_sayi_yediden_fazla_surmez() {
      for gizli in 1..=100 {
          let d = bot_deneme_sayisi(gizli);
          assert!(d >= 1 && d <= 7, "{gizli} için {d} tahmin yapıldı; ikili arama 1 ile 7 arasında bulmalı");
      }
  }

  #[test]
  fn toplam_deneme_sayisi() {
      let mut toplam = 0;
      for gizli in 1..=100 {
          toplam += bot_deneme_sayisi(gizli);
      }
      assert_eq!(toplam, 580, "1'den 100'e bütün sayılar için toplam 580 tahmin yapılmalı (ortalama 5,8); tahmin her zaman (alt + ust) / 2 olmalı");
  }
hints:
  - "Üç değiştirilebilir değişkene ihtiyacın var: `let mut alt = 1;`, `let mut ust = 100;` ve bir sayaç `let mut deneme = 0;`. Kaç tur süreceği belli değil ve bulunca bir değer döndürmek istiyorsun: `loop` ve `break deger`."
  - "Her turda: `let tahmin = (alt + ust) / 2;` ve `deneme += 1;`. Sonra üç durum: eşitse `break deneme;`, küçükse `alt = tahmin + 1;`, büyükse `ust = tahmin - 1;`."
  - "İskelet: `loop { let tahmin = (alt + ust) / 2; deneme += 1; if tahmin == gizli { break deneme; } else if tahmin < gizli { alt = tahmin + 1; } else { ust = tahmin - 1; } }`, bu `loop` fonksiyonun son ifadesi olsun (sonuna noktalı virgül koyma)."
explanation: |
  Fonksiyonun gövdesi bir `loop` ifadesiyle bitiyor ve `break deneme` ile ürettiği değer fonksiyonun dönüş
  değeri oluyor (bu modülün 2. ve 4. dersleri bir arada). `while` kullanamazdık, çünkü `while`'dan değerle
  `break` yapılamaz (`E0571`).

  **Neden hiçbir zaman 7'den fazla sürmüyor?** Her tahmin, kalan aralığı yarıya indirir: 100 → 50 → 25 →
  12 → 6 → 3 → 1. Yedi yarılamadan sonra tek bir aday kalır, çünkü 2⁷ = 128 ≥ 100. Sayıları 1, 2, 3... diye
  tek tek deneyen bir oyuncu ise en kötü durumda 100 tahmin yapar. 1 ile 1.000.000 arasında bile ikili
  arama en fazla 20 tahmin yapar (2²⁰ ≈ 1 milyon). Sözlükte kelime ararken yaptığın da budur: Ortadan açar,
  hangi yarıda olduğuna bakarsın.

  `ust = tahmin - 1` satırı taşabilir mi? Bu dala yalnızca `tahmin > gizli` iken girilir ve `gizli` en az
  1 olduğu için `tahmin` en az 2'dir; yani sonuç asla negatif olmaz. Bir uzman notu: Çok büyük aralıklarda
  `alt + ust` toplamı tipin sınırını aşabilir. Java'nın standart kütüphanesindeki ikili arama, yıllarca
  fark edilmeyen tam bu hatayı içeriyordu (2006'da bulundu). Güvenli yazım:
  `alt + (ust - alt) / 2`.
````

## Özet

:::remember
- Dış crate eklemek: `Cargo.toml`'da `[dependencies]` altına `rand = "0.10"` (ya da `cargo add rand`).
  Tam sürümler `Cargo.lock`'a yazılır. Gizli sayı: `rand::random_range(1..=100)`.
- Girdi okumak: `let mut girdi = String::new();` ve
  `io::stdin().read_line(&mut girdi).expect("...");`. `read_line` metni **sonuna ekler** ve satır sonunu
  (`\n` ya da `\r\n`) da içerir.
- Metinden sayıya: `let tahmin: u32 = girdi.trim().parse().expect("...");`, önce `trim`, sonra `parse`;
  hedef tipi belirtmek şart. Aynı adı gölgeleme (shadowing) ile yeniden kullanmak deyimseldir.
- Metin ve sayı karşılaştırılamaz (`E0308`); metinler sözlük sırasıyla karşılaştırılır (`"9" > "10"`).
- Oyun döngüsü `loop`: geçersiz girdide `continue`, doğru tahminde `break`.
- Mantığı **saf fonksiyonlara** ayır (`karsilastir(tahmin, gizli)`): Aynı girdiye aynı çıktı, klavye ve
  rastgelelik yok, dolayısıyla kolayca test edilir.
- Önizleme: `match tahmin.cmp(&gizli) { Ordering::Less => ..., ... }` bütün durumları ele almayı zorunlu
  kılar (Modül 7).
:::

:::ferris
Tebrikler, ilk gerçek Rust programını yazdın! Şimdi onu bozmayı dene: harf yaz, boş bırakıp Enter'a bas,
1000 yaz. Programının hepsine nasıl tepki verdiğini görmek, iyi bir programcının en sevdiği eğlencedir. 🦀
:::

```reflect
prompt: |
  Gizli sayıyı `karsilastir` ya da `bot_deneme_sayisi` fonksiyonunun içinde `rand` ile üretmek yerine neden
  **parametre olarak** alıyoruz? Bu kararın oyunu test etmeye ve değiştirmeye etkisini kendi cümlelerinle
  açıkla.
answer: |
  Model cevap: Fonksiyon gizli sayıyı içeride rastgele üretseydi her çağrıda farklı davranırdı; bir testte
  "25 için cevap 2 olmalı" diyemezdim, çünkü 25'i ben seçemezdim. Gizli sayıyı parametre yapınca fonksiyon
  saf hâle geliyor: Aynı girdiye her zaman aynı çıktıyı veriyor, klavyeye ya da rastgeleliğe bağlı
  değil. Rastgele sayı üretmek ve klavyeden okumak gibi "dış dünya" işlerini `main`'deki ince kabukta
  bırakıyorum. Böylece mantığı ayrı ayrı test edebiliyorum ve örneğin `karsilastir`'ı `ipucu` ile
  değiştirmek gibi bir değişikliği oyunun geri kalanına dokunmadan yapabiliyorum.
```

```flashcards
- front: Klavyeden bir satır okuyup `girdi` değişkenine koyan iki satırı yaz.
  back: "`let mut girdi = String::new();` ve `io::stdin().read_line(&mut girdi).expect(\"Satır okunamadı\");` (en üstte `use std::io;`)"
- front: "Oyuncu `42` yazıp Enter'a bastığında `read_line`'ın verdiği metin tam olarak nedir?"
  back: "`\"42\\n\"` (Windows'ta `\"42\\r\\n\"`). Satır sonu da metne dahildir; bu yüzden `parse`'tan önce `trim` gerekir."
- front: "`\" 42\".parse::<u32>()` neden başarısız olur ve nasıl düzeltilir?"
  back: "Baştaki boşluk geçersiz bir karakterdir (`InvalidDigit`). Düzeltme: `\" 42\".trim().parse::<u32>()`."
- front: "`let tahmin: u32 = tahmin.trim().parse().expect(\"...\");` satırında `tahmin` adı neden iki kez kullanılabiliyor?"
  back: "Gölgeleme (shadowing): Yeni `u32` değişkeni, aynı adlı eski `String` değişkenini gölgeler."
- front: "Bir projeye `rand` crate'i nasıl eklenir?"
  back: "`Cargo.toml`'da `[dependencies]` altına `rand = \"0.10\"` yazarak ya da `cargo add rand` komutuyla."
- front: "`Cargo.toml` ile `Cargo.lock` arasındaki fark nedir?"
  back: "`Cargo.toml` istenen sürüm aralığını (`\"0.10\"`), `Cargo.lock` gerçekten kullanılan tam sürümleri kaydeder."
- front: "`read_line` aynı `String` ile iki kez çağrılırsa ne olur?"
  back: "İkinci satır öncekinin **sonuna eklenir** (`\"50\\n42\\n\"`); içerik değişmez, büyür."
- front: Saf fonksiyon (pure function) nedir ve neden kolay test edilir?
  back: "Yalnızca parametrelerine bakarak sonuç üreten, girdi/çıktı ya da rastgelelik kullanmayan fonksiyon. Aynı girdiye hep aynı cevabı verdiği için sonucu önceden bilinebilir."
```
