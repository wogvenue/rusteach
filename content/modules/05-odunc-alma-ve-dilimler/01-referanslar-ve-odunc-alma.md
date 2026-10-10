---
id: m05-l01
title: Referanslar ve ödünç alma
minutes: 16
type: lesson
objectives:
  - "`&` ile bir değere referans oluşturup sahipliği devretmeden fonksiyona ödünç verebilmek"
  - Bir referansın bellekte neyi gösterdiğini stack/heap diyagramıyla açıklayabilmek
  - "`*` ile bir referansı çözümleyebilmek ve metot çağrılarındaki otomatik çözümlemeyi tanıyabilmek"
  - Değişmez bir referans üzerinden değişiklik denemesinin neden E0596 verdiğini açıklayabilmek
keywords: [referans, ödünç alma, borrowing, "&", "*", dereference, E0596, E0507]
---

Modül 4'ün sonunda bir şey canını sıkmış olmalı: bir fonksiyona `String` verdiğinde sahiplik gidiyor,
geri almak için de tuple döndürmek gerekiyordu: `let (s, n) = uzunluk_ve_kendisi(s);`. Bu, bir
arkadaşın kitabına sadece göz atmak istediğinde ona kitabı **hediye edip** sonra geri istemeye benzer.

Bu derste Rust'ın bu soruna getirdiği zarif çözümü öğreneceksin: **referanslar (references)** ve
**ödünç alma (borrowing)**. Gerçek Rust kodunun büyük kısmı bu fikrin üzerine kurulu.

:::ferris
Sahiplik bir tapuysa, referans bir **ödünç kartıdır**. Bu modülün sonunda borrow checker'ın sana neden
kızdığını değil, seni neyden koruduğunu göreceksin! 🦀
:::

## Sahipliği geri verme yorgunluğu

Önce Modül 4'ten küçük bir hatırlatma. Aşağıdaki kod derlenir mi?

```compiles
code: |
  fn bayt_sayisi(metin: String) -> usize {
      metin.len()
  }

  fn main() {
      let kitap = String::from("Sefiller");
      let n = bayt_sayisi(kitap);
      println!("{kitap}: {n} bayt");
  }
answer: false
error: E0382
explanation: |
  `kitap` bir `String` ve `String` `Copy` değildir. `bayt_sayisi(kitap)` çağrısı sahipliği fonksiyonun
  `metin` parametresine **taşır** (move). Fonksiyon bitince `metin` drop edilir ve heap'teki metin
  serbest kalır. Ardından `println!` satırında `kitap`'ı kullanmak `E0382: borrow of moved value`
  hatası verir. Modül 4'teki çözüm `String`'i bir tuple içinde geri döndürmekti: çalışır ama zahmetlidir.
```

Aslında istediğimiz şey çok basit: fonksiyon `kitap`'ı **okusun**, ama sahibi `main` kalsın. Rust'ta
bunun için tek bir karakter yeter: `&`.

```rust
fn bayt_sayisi(metin: &String) -> usize {
    metin.len()
}

fn main() {
    let kitap = String::from("Sefiller");
    let n = bayt_sayisi(&kitap); // kitap'ı ödünç veriyoruz
    println!("{kitap}: {n} bayt"); // kitap hâlâ bizim!
}
```

Sadece iki şeyi değiştirdik:

- Parametrenin tipi `String` yerine **`&String`** oldu. Bunu "bir `String`'e referans" diye oku.
- Çağrıda `kitap` yerine **`&kitap`** yazdık: "`kitap`'a bir referans oluştur ve onu ver".

`&kitap` ifadesi bir **referans (reference)** üretir. Referans, değerin kendisi değildir; değerin
**nerede** durduğunu gösteren bir işarettir. Referans oluşturma eylemine de **ödünç alma (borrowing)**
denir. Ödünç alan taraf değeri kullanabilir ama **sahibi olmaz**. Bu yüzden `bayt_sayisi` bittiğinde
hiçbir şey drop edilmez ve `kitap` geçerli kalır.

:::analogy Kütüphaneden kitap ödünç almak
Kütüphaneden ödünç aldığın bir kitabı okuyabilirsin, ama kitap **kütüphanenin** malı olarak kalır.
Onu satamazsın, karalayamazsın; işin bitince geri döner. Kütüphane de sen okurken kitabı imha edemez.
Rust'ta sahip (`kitap` değişkeni) kütüphanedir, `&kitap` bir ödünç kartıdır. Bu kuralların hepsini
derleme zamanında **borrow checker (ödünç denetleyicisi)** denetler.
:::

## Referans bellekte neye benzer?

Bir `String`'in stack'te üç parçalı bir başlığı (işaretçi, uzunluk, kapasite), heap'te de karakterleri
olduğunu Modül 4'ten biliyorsun. Peki `&String` nerede durur ve neyi gösterir? Adım adım izle:

```memory
title: "bayt_sayisi(&kitap) çağrısı adım adım"
steps:
  - caption: "`kitap` oluşturuldu: stack'te işaretçi + uzunluk + kapasite, heap'te karakterler."
    stack:
      - frame: main
        vars:
          - { name: kitap, type: String, value: "ptr · len=8 · cap=8", to: h1 }
    heap:
      - { id: h1, value: "S e f i l l e r" }
  - caption: "Çağrı sırasında `metin` yalnızca **`kitap`'ın adresini** tutar. Heap'i değil, `kitap` değişkenini gösterir."
    stack:
      - frame: main
        vars:
          - { name: kitap, type: String, value: "ptr · len=8 · cap=8", to: h1 }
      - frame: bayt_sayisi
        vars:
          - { name: metin, type: "&String", value: "adres (8 bayt)", to: kitap }
    heap:
      - { id: h1, value: "S e f i l l e r" }
  - caption: "Fonksiyon bitti: `metin` yok oldu ama **hiçbir şey serbest bırakılmadı**. Sahip hâlâ `kitap`."
    stack:
      - frame: main
        vars:
          - { name: kitap, type: String, value: "ptr · len=8 · cap=8", to: h1 }
          - { name: n, type: usize, value: "8" }
    heap:
      - { id: h1, value: "S e f i l l e r" }
```

Diyagramdaki zincire dikkat et: `metin` → `kitap` → heap. `&String` gibi bir referans, 64 bitlik bir
bilgisayarda sadece **8 baytlık bir adrestir**. `String`'in başlığı da, heap'teki karakterler de yerinde
kalır. Yani ödünç vermek yalnızca bu adresi kopyalar; 24 baytlık `String` başlığını taşımaktan bile
ucuzdur. (Ders 4'te göreceğin **dilim** referansları adresin yanında bir de uzunluk taşır: 16 bayt.)

Diğer dillerle karşılaştıralım:

- **C**'deki işaretçiler (pointer) de adres tutar, ama C işaretçisi her yeri gösterebilir: `NULL`'u,
  çoktan serbest bırakılmış belleği, rastgele bir adresi... Rust referansı ise bir **sözle** gelir:
  her zaman geçerli, canlı bir değeri gösterir.
- **Java** ve **Python**'da nesnelere zaten hep referanslarla erişirsin, ama orada nesneyi canlı tutan
  şey çalışma zamanında çalışan çöp toplayıcıdır (GC). Rust aynı güvenliği **derleme zamanında**
  kanıtlar; çalışma zamanında hiçbir ek maliyet yoktur.

```quiz
question: "`bayt_sayisi(&kitap)` çağrısı bitince `metin` parametresi kapsamdan çıkar. O anda ne olur?"
options:
  - "Heap'teki \"Sefiller\" metni serbest bırakılır"
  - "Yalnızca `metin` referansı yok olur; değerin sahibi `kitap` olduğu için hiçbir şey serbest bırakılmaz"
  - "`kitap` geçersiz hâle gelir, çünkü değer fonksiyona verilmişti"
  - "`metin` kendi kopyasını serbest bırakır, `kitap`'ınki kalır"
answer: 1
explanation: |
  Belleği serbest bırakma (drop) sorumluluğu **yalnızca sahibe** aittir. `metin` sahip değil, sadece
  ödünç alan bir referanstır; kapsamdan çıkması "ödünç kartının iade edilmesi" demektir. Heap'teki veri,
  `kitap` `main`'in sonunda kapsamdan çıkınca serbest kalır.
feedback:
  - "Öyle olsaydı `kitap` sarkan (geçersiz belleği gösteren) bir değişkene dönüşürdü. Drop, sahibin işidir."
  - "Doğru! Referans sahip değildir; kapsamdan çıkınca sadece kendisi yok olur."
  - "Bu, **taşıma** (`String` parametre) olsaydı doğruydu. `&kitap` ile sahiplik hiç el değiştirmez."
  - "Ödünç almak kopya oluşturmaz; ortada tek bir `String` vardır."
```

:::deep Bir referans gerçekten bir adres mi?
`{:p}` biçimlendiricisi (p = pointer) bir referansın tuttuğu adresi yazdırır:

```rust
fn main() {
    let x = 42;
    let r = &x;
    println!("r'nin gösterdiği değer: {r}");
    println!("r'nin tuttuğu adres: {r:p}");
}
```

Çıktı `0x7ffd5b353c84` gibi bir şey olur; işletim sistemi programı güvenlik için her çalıştırmada farklı
bir adrese yerleştirdiğinden (ASLR) senin sayın farklı olacaktır. Dikkat: `{r}` adresi değil, **gösterilen
değeri** yazdırır. `println!` referansı senin yerine çözer.
:::

## Referanslar varsayılan olarak değişmezdir

Ödünç aldığın bir kütüphane kitabının sayfalarına not yazabilir misin? Rust'ın cevabını tahmin et:

```compiles
code: |
  fn imza_ekle(kitap: &String) {
      kitap.push_str(" (imzalı)");
  }

  fn main() {
      let mut kitap = String::from("Sefiller");
      imza_ekle(&kitap);
      println!("{kitap}");
  }
answer: false
error: E0596
explanation: |
  `kitap` değişkeni `mut` olsa bile fonksiyona verilen `&kitap` **değişmez (immutable) bir referanstır**.
  `&String` üzerinden yalnızca okuyabilirsin; `push_str` ise metni değiştirmek ister. Değişkenin
  değiştirilebilir olması ile referansın değiştirme izni taşıması **ayrı** şeylerdir.
```

Derleyicinin mesajı sorunu ve çözümü birlikte söylüyor:

:::error
```text
error[E0596]: cannot borrow `*kitap` as mutable, as it is behind a `&` reference
 --> src/main.rs:2:5
  |
2 |     kitap.push_str(" (imzalı)");
  |     ^^^^^ `kitap` is a `&` reference, so it cannot be borrowed as mutable
  |
help: consider changing this to be a mutable reference
  |
1 | fn imza_ekle(kitap: &mut String) {
  |                      +++
```
Tercümesi: "`*kitap`'ı (yani `kitap`'ın gösterdiği `String`'i) değiştirmek için ödünç alamazsın, çünkü o
bir `&` referansının arkasında." `help` satırı `&mut String` öneriyor: bu, **değiştirilebilir
referans** demek ve bir sonraki dersin konusu.
:::

Bu kısıtlama bir eksiklik değil, bir **güvence**. Bir değeri `&` ile ödünç verdiğinde, geri geldiğinde
**aynen** duracağını bilirsin. Fonksiyonun gövdesini okumana gerek yok, imzası yeter:
`fn imza_ekle(kitap: &String)` "ben sadece okurum" der.

Karşılaştır: C++'ta bu güvence için parametreye `const std::string&` yazmayı **hatırlaman** gerekir;
unutmak çok yaygındır. Java ve Python'da ise bir listeyi bir fonksiyona verdiğinde, fonksiyonun onu
değiştirip değiştirmeyeceğini imzadan anlayamazsın. Rust'ta değişmezlik, tıpkı `let`'te olduğu gibi,
**varsayılandır**.

## `*` ile referansın gösterdiği değere ulaşmak

Referansın gösterdiği değeri kullanmak istediğinde ne olur? Önce tahmin et:

```compiles
code: |
  fn main() {
      let puan = 90;
      let r = &puan;
      if r == 90 {
          println!("Tam not!");
      }
  }
answer: false
error: E0277
explanation: |
  `r`'nin tipi `&i32`, yani "bir `i32`'ye referans". `90` ise düz bir `i32`. Rust bir adresle bir
  sayıyı karşılaştırmaz: `can't compare &{integer} with {integer}`. Doğrusu `*r == 90` yazmaktır;
  derleyici de `help: consider dereferencing here` diyerek tam bunu önerir.
```

Bir referansın gösterdiği değere ulaşmak için **çözümleme (dereference)** operatörü `*` kullanılır.
`*r` "r'nin gösterdiği yere git, oradaki değeri al" demektir:

```rust
fn main() {
    let puan = 90;
    let r = &puan; // r: &i32, puan'ı gösteren referans

    let iki_kat = *r * 2; // *r: r'nin gösterdiği değer (90)
    println!("puan = {puan}, *r = {}, iki kat = {iki_kat}", *r);

    if *r >= 50 {
        println!("Geçti!");
    }
    println!("r'yi doğrudan yazdırınca: {r}"); // println! referansı kendisi çözer
}
```

`&` ile `*` birbirinin tersidir: `&` "adresini al", `*` "adresteki değeri al" der. Bu yüzden `*&puan`
yine `puan` demektir.

:::tip Ne zaman `*` yazmalıyım?
`println!` referansın arkasındaki değeri kendisi yazdırır. `r + 1` gibi aritmetik de çalışır, çünkü
standart kütüphane `+` operatörünü referanslar için de tanımlar. Ama **karşılaştırmalarda** iki tarafın
aynı "seviyede" olması gerekir: `*r == 90` (ya da `r == &90`). Kural basit: şüphedeysen `*` yaz.
Referans olmayan bir değere `*` koyarsan derleyici hata verir (E0614: `cannot be dereferenced`),
yani yanlış yere yazdığını hemen öğrenirsin.

Java'dan gelenler için bir tuzak: iki referansı `r1 == r2` ile karşılaştırmak **adresleri değil,
gösterilen değerleri** karşılaştırır. İki farklı `String` aynı metni tutuyorsa `&a == &b` `true` olur.
:::

`i32` gibi `Copy` tiplerde `*r` değeri **kopyalar**. Peki `String` gibi `Copy` olmayan bir tipte
`*r` ile değeri almaya çalışırsan?

```rust,compile_fail,E0507
fn main() {
    let kitap = String::from("Sefiller");
    let r = &kitap;
    let benim = *r; // ödünç alınan kitabı sahiplenmeye çalışmak!
    println!("{benim}");
}
```

:::error
```text
error[E0507]: cannot move out of `*r` which is behind a shared reference
 --> src/main.rs:4:17
  |
4 |     let benim = *r;
  |                 ^^ move occurs because `*r` has type `String`, which does not implement the `Copy` trait
```
`let benim = *r;` bir **taşıma** olurdu: `String` sahibinin elinden alınıp `benim`'e geçerdi. Ama
ödünç aldığın bir şeyin sahibi olamazsın; kütüphane kitabını evine mal edemezsin. Derleyici iki çıkış
önerir: ya referansı kullanmaya devam et (`let benim = r;`), ya da gerçekten kendi kopyan gerekiyorsa
bilinçli olarak `r.clone()` çağır (Modül 4).
:::

Şimdi bir de gölgelemeyle (shadowing, Modül 2) karıştıralım:

```predict
code: |
  fn main() {
      let x = 5;
      let r = &x;
      let x = x + 10;
      println!("{} {}", *r, x);
  }
options:
  - "5 15"
  - "15 15"
  - "Derlenmez"
answer: 0
explanation: |
  Gölgeleme eski değişkeni **değiştirmez**; aynı isimle **yeni** bir değişken oluşturur. `r` hâlâ ilk
  `x`'i (değeri 5) gösteriyor. İlk `x` gölgelendi ama yaşamaya devam ediyor; sadece artık ona `x`
  ismiyle ulaşamıyoruz. Yeni `x` ise 15. Kod derlenir, çünkü hiçbir değer değiştirilmedi.
```

## Metot çağrılarında otomatik çözümleme

`bayt_sayisi` fonksiyonunda `metin.len()` yazdık ve çalıştı. Ama `metin` bir `&String`'di; neden
`(*metin).len()` yazmamız gerekmedi? Çünkü nokta (`.`) ile metot çağırdığında derleyici, metodu bulana
kadar gerektiği kadar `*` ekler. Buna **otomatik çözümleme (auto-deref)** denir. Tersi de olur: metot
`&self` istiyorsa ve elinde düz bir `String` varsa derleyici `&`'yi de kendisi ekler (**auto-ref**).
`roman.len()` yazdığında aslında `String::len(&roman)` çağrılır; yani `.len()` hiçbir zaman sahipliği almaz:

```rust
fn bilgi(kitap: &String) {
    let a = kitap.len(); // (*kitap).len() ile aynı şey: derleyici halleder
    let b = (*kitap).len(); // elle çözümleme: aynı sonuç
    println!("{a} {b}");
}

fn main() {
    let roman = String::from("Kuyucaklı Yusuf");
    bilgi(&roman);

    let r = &roman;
    let rr = &r; // referansa referans: &&String
    println!("{}", rr.len()); // yine çalışır: derleyici gereken kadar * ekler
}
```

(`16` çıkmasına şaşırma: `len()` bayt sayar ve `ı` harfi 2 bayttır. Bu konuya Ders 4'te döneceğiz.)

C ve C++'ta bir değer için `s.len`, bir işaretçi için `p->len` yazarsın; iki ayrı operatörü doğru
yerde kullanmak senin işindir. Rust'ta yalnızca `.` vardır; gerisini derleyici halleder. Ama bu
kolaylık sadece **metot çağrıları** içindir. Karşılaştırma ve atama gibi işlemlerde `*`'ı kendin
yazarsın; bir sonraki derste `*p += 1` gibi satırlarla bunu sık sık göreceksin.

```quiz
question: "`r` değişkeninin tipi `&String`. Aşağıdakilerden hangisi **derlenmez**?"
options:
  - "`let n = r.len();`"
  - "`let n = (*r).len();`"
  - "`let s: String = *r;`"
  - "`println!(\"{r}\");`"
answer: 2
explanation: |
  `*r` ile `String`'in kendisine ulaşırsın, ama onu bir değişkene atamak **taşıma** olur: sahiplik
  referansın arkasından çekilip alınamaz (`E0507`). Diğer üçü sorunsuzdur: ilki otomatik çözümleme,
  ikincisi elle çözümleme, sonuncusu da `println!`'in referansı kendisi çözmesidir.
feedback:
  - "Derlenir: metot çağrısında derleyici otomatik olarak çözümler."
  - "Derlenir: `(*r).len()` elle çözümlemedir, `r.len()` ile aynı şeydir."
  - "Doğru! Ödünç alınmış bir `String`'in sahipliği `*r` ile alınamaz (E0507)."
  - "Derlenir: `println!` referansın gösterdiği değeri yazdırır."
```

Şimdi sıra sende. Boşlukları doldurarak `ozetle` fonksiyonunun `yazi`'yı **ödünç almasını** sağla:

```fill
prompt: "`ozetle` metni ödünç alsın ki `main` onu çağrıdan sonra da kullanabilsin."
code: |
  fn ozetle(metin: ___0) -> usize {
      metin.len()
  }

  fn main() {
      let yazi = String::from("Rust");
      let n = ozetle(___1);
      println!("{yazi}: {n}");
  }
blanks:
  - ["&String", "&str"]
  - ["&yazi"]
output: "Rust: 4"
explanation: |
  Parametre tipi `&String` (bir `String`'e referans), çağrıdaki argüman da `&yazi` olmalı. İkisi de
  gerekli: imza "referans bekliyorum" der, çağrı da "referans veriyorum" der. Sahiplik `main`'de
  kaldığı için `println!` satırında `yazi` sorunsuz kullanılır. (`&str` de çalışır; nedenini Ders 4'te
  göreceksin.)
```

## Alıştırmalar

İlk alıştırmada Modül 4 tarzı, sahipliği taşıyan bir programı ödünç almaya çevireceksin.

````exercise
title: Kitabı rafa geri koy
difficulty: 1
prompt: |
  Bu program derlenmiyor: `kitap` önce `baslik_yazdir`'a, sonra `bayt_say`'a **taşınıyor** ve en
  sonda rafa geri konamıyor.

  İki fonksiyonu da kitabı **ödünç alacak** şekilde düzelt; `main`'deki çağrıları da buna göre
  değiştir. Program şu çıktıyı vermeli:

  ```text
  Kitap: Kürk Mantolu Madonna
  21 bayt
  Rafa geri konan kitap: Kürk Mantolu Madonna
  ```
starter: |
  fn baslik_yazdir(kitap: String) {
      println!("Kitap: {kitap}");
  }

  fn bayt_say(kitap: String) -> usize {
      kitap.len()
  }

  fn main() {
      let kitap = String::from("Kürk Mantolu Madonna");
      baslik_yazdir(kitap);
      let n = bayt_say(kitap);
      println!("{n} bayt");
      println!("Rafa geri konan kitap: {kitap}");
  }
solution: |
  fn baslik_yazdir(kitap: &String) {
      println!("Kitap: {kitap}");
  }

  fn bayt_say(kitap: &String) -> usize {
      kitap.len()
  }

  fn main() {
      let kitap = String::from("Kürk Mantolu Madonna");
      baslik_yazdir(&kitap);
      let n = bayt_say(&kitap);
      println!("{n} bayt");
      println!("Rafa geri konan kitap: {kitap}");
  }
starter_compiles: false
check: output
expected_output: |
  Kitap: Kürk Mantolu Madonna
  21 bayt
  Rafa geri konan kitap: Kürk Mantolu Madonna
hints:
  - "Bir değeri ödünç vermek için önüne `&` koyarsın: `&kitap`."
  - "Fonksiyonların parametre tipleri de referans olmalı: `String` yerine `&String`."
  - "Dört yer değişecek: iki imza (`kitap: &String`) ve iki çağrı (`baslik_yazdir(&kitap)`, `bayt_say(&kitap)`)."
require:
  - pattern: "fn\\s+baslik_yazdir\\s*\\(\\s*\\w+\\s*:\\s*&"
    message: "`baslik_yazdir` kitabı ödünç almalı: parametre tipi bir referans (`&String`) olmalı."
  - pattern: "fn\\s+bayt_say\\s*\\(\\s*\\w+\\s*:\\s*&"
    message: "`bayt_say` kitabı ödünç almalı: parametre tipi bir referans (`&String`) olmalı."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: "`clone` kullanmadan çöz. Amaç kopyalamak değil, ödünç vermek!"
  - pattern: "String::from[\\s\\S]*String::from"
    message: "İkinci bir `String` oluşturma; aynı kitabı ödünç vererek çöz."
explanation: |
  Fonksiyonlar artık `&String` alıyor, yani kitabı yalnızca **ödünç** alıyorlar. `main` her çağrıda
  `&kitap` ile bir referans veriyor; sahiplik hiç el değiştirmediği için son `println!` satırında
  `kitap` hâlâ geçerli.

  Neden `clone` yasaktı? `baslik_yazdir(kitap.clone())` da derlenirdi, ama her çağrıda heap'te yeni
  bir kopya oluşturur ve hemen çöpe atardı. Sadece okuyacak bir fonksiyon için bu boşa harcanan iştir.
  Ödünç verme ise sadece 8 baytlık bir adres geçirir.

  Bir de `21`'e dikkat: "Kürk Mantolu Madonna" 20 karakterdir, ama `ü` UTF-8'de 2 bayt tuttuğu için
  `len()` 21 döndürür.
````

İkinci alıştırmada sıfırdan, referans alan bir fonksiyon yazacaksın. Bunun için yeni bir araç lazım:
`kelime.chars()` bir metnin karakterlerini sırayla verir, yani `for c in kelime.chars()` döngüsünde `c`
sırasıyla her bir `char` olur. (Metinleri karakter karakter gezmeyi Modül 9'da derinlemesine göreceğiz.)

```exercise
title: Adam asmaca — harf kaç kez geçiyor?
difficulty: 2
prompt: |
  Bir adam asmaca oyunu yazıyorsun. Oyuncu bir harf tahmin ettiğinde, o harfin gizli kelimede
  **kaç kez** geçtiğini bulman gerekiyor.

  `kac_kez` fonksiyonunu tamamla:
  - Kelimeyi **ödünç alır** (`&String`), çünkü sadece okuması yeterli.
  - `harf` karakterinin kelimede kaç kez geçtiğini döndürür.
  - Büyük ve küçük harf ayrı sayılır: `'A'` ile `'a'` farklıdır.
starter: |
  fn kac_kez(kelime: &String, harf: char) -> usize {
      todo!()
  }

  fn main() {
      let kelime = String::from("ankara");
      let n = kac_kez(&kelime, 'a');
      println!("'{kelime}' kelimesinde 'a' harfi {n} kez geçiyor");
  }
solution: |
  fn kac_kez(kelime: &String, harf: char) -> usize {
      let mut sayac = 0;
      for c in kelime.chars() {
          if c == harf {
              sayac += 1;
          }
      }
      sayac
  }

  fn main() {
      let kelime = String::from("ankara");
      let n = kac_kez(&kelime, 'a');
      println!("'{kelime}' kelimesinde 'a' harfi {n} kez geçiyor");
  }
check: tests
tests: |
  #[test]
  fn ankara_kelimesinde_uc_a_var() {
      let kelime = String::from("ankara");
      assert_eq!(kac_kez(&kelime, 'a'), 3, "\"ankara\" kelimesinde 3 tane 'a' var");
      assert_eq!(kelime, "ankara", "kelime ödünç verildi; çağrıdan sonra da kullanılabilmeli");
  }

  #[test]
  fn turkce_harfleri_sayar() {
      let kelime = String::from("şişe");
      assert_eq!(kac_kez(&kelime, 'ş'), 2, "\"şişe\" kelimesinde 2 tane 'ş' var");
      assert_eq!(kac_kez(&kelime, 'i'), 1, "\"şişe\" kelimesinde 1 tane 'i' var");
  }

  #[test]
  fn olmayan_harf_ve_bos_kelime_sifir_verir() {
      assert_eq!(kac_kez(&String::from("rust"), 'z'), 0, "kelimede olmayan harf için 0 dönmeli");
      assert_eq!(kac_kez(&String::from(""), 'a'), 0, "boş kelimede hiçbir harf yoktur");
  }

  #[test]
  fn buyuk_kucuk_harf_ayri_sayilir() {
      let kelime = String::from("Ankara");
      assert_eq!(kac_kez(&kelime, 'a'), 2, "'A' ile 'a' farklı karakterlerdir; \"Ankara\"da 2 küçük 'a' var");
      assert_eq!(kac_kez(&kelime, 'A'), 1, "\"Ankara\"da 1 büyük 'A' var");
  }
hints:
  - "Bir sayaç değişkeni tut: `let mut sayac = 0;`"
  - "`for c in kelime.chars() { ... }` ile her karakteri gez; `c == harf` ise sayacı artır."
  - "Döngüden sonra sayacı noktalı virgülsüz son ifade olarak döndür: `sayac`."
explanation: |
  `kelime` bir `&String` olduğu halde `kelime.chars()` yazabildik: metot çağrısında derleyici
  referansı otomatik çözümler. Fonksiyon kelimenin sahibi olmadığı için çağrıdan sonra `main` (ve
  testler) kelimeyi kullanmaya devam edebiliyor.

  Baytları değil `chars()` ile **karakterleri** gezmemiz de önemli: `"şişe"` 4 karakterdir ama 6
  bayttır (`len()` 6 döndürür). Bayt bayt gezseydik `'ş'`'yi hiç bulamazdık, çünkü `'ş'` tek bir bayt
  değil, iki bayttan oluşur.

  İleride bu fonksiyonu tek satırda yazmayı öğreneceksin: `kelime.chars().filter(|c| *c == harf).count()`
  (Modül 14, iterator'lar). Bir de parametrede `&String` yerine `&str` kullanmak daha esnektir;
  nedenini Ders 4'te göreceksin.
```

## Özet ve tekrar

:::remember
- `&x` ifadesi `x`'e bir **referans** üretir. Referans oluşturmaya **ödünç alma** denir; sahiplik değişmez.
- `&T` referansı varsayılan olarak **değişmezdir**: okuyabilirsin, değiştiremezsin (E0596).
- Referans kapsamdan çıkınca **hiçbir şey serbest bırakılmaz**; drop yalnızca sahibin işidir.
- `*r`, `r`'nin gösterdiği değerdir. Karşılaştırmada `*r == 90` yaz.
- `Copy` olmayan bir değerin sahipliği `*r` ile alınamaz (E0507); gerekiyorsa bilinçli olarak `r.clone()`.
- Metot çağrılarında (`r.len()`) derleyici otomatik çözümler.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Bir fonksiyonun parametresini `String` yerine `&String` yapmak, hem
  fonksiyonu yazan hem de onu çağıran kişi için neyi değiştirir?
answer: |
  Model cevap: `String` parametresi sahipliği fonksiyona taşır; çağıran taraf o değeri bir daha
  kullanamaz (ya da fonksiyonun onu geri döndürmesi gerekir). `&String` ise değeri sadece ödünç
  verir: sahip çağıran tarafta kalır, fonksiyon bitince hiçbir şey drop edilmez ve değer kullanılmaya
  devam eder. Fonksiyonu yazan için de bir sözdür: `&String` ile değeri yalnızca okuyabilir,
  değiştiremez. Üstelik hiçbir kopya yapılmaz; sadece bir adres geçirilir.
```

```flashcards
- front: "`&x` ifadesi ne üretir ve sahipliğe ne olur?"
  back: "`x`'e bir **referans** (adres) üretir. Buna ödünç alma denir; sahiplik `x`'te kalır."
- front: Bir referans kapsamdan çıktığında gösterdiği değer drop edilir mi?
  back: "Hayır. Referans sahip değildir; drop yalnızca **sahip** kapsamdan çıkınca olur."
- front: "`fn f(s: &String)` içinde `s.push_str(\"x\")` neden derlenmez? Hata kodu?"
  back: "`&String` değişmez bir referanstır, üzerinden değişiklik yapılamaz: **E0596**."
- front: "`r: &i32` iken `if r == 90` neden derlenmez? Nasıl düzeltilir?"
  back: "`&i32` ile `i32` karşılaştırılamaz (**E0277**). Çözümle: `if *r == 90`."
- front: "`r: &String` iken `let s = *r;` neden derlenmez?"
  back: "Ödünç alınan değerden taşıma yapılamaz (**E0507**). Ya `r`'yi kullan ya da `r.clone()` çağır."
- front: "`r: &String` iken `r.len()` neden `*` gerektirmez?"
  back: Metot çağrılarında derleyici **otomatik çözümleme** (auto-deref) yapar.
- front: Rust referansını C işaretçisinden ayıran temel güvence nedir?
  back: Rust referansı her zaman **geçerli, canlı** bir değeri gösterir (NULL ya da serbest bırakılmış bellek olamaz); bunu derleyici kanıtlar.
```
