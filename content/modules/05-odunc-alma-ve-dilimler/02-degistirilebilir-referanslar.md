---
id: m05-l02
title: Değiştirilebilir referanslar
minutes: 18
type: lesson
objectives:
  - "`&mut T` ile bir değeri değiştirilebilir olarak ödünç verebilmek ve `*` ile yerinde değiştirebilmek"
  - "\"Ya tek `&mut` ya da istediğin kadar `&`\" kuralını uygulayarak E0499 ve E0502 hatalarını okuyup düzeltebilmek"
  - Bu kuralın veri yarışlarını ve geçersiz kalan referansları nasıl önlediğini açıklayabilmek
  - NLL sayesinde bir ödüncün son kullanımda bittiğini bilerek ödünçleri ayırabilmek
keywords: ["&mut", değiştirilebilir referans, E0499, E0502, E0506, NLL, veri yarışı, aliasing XOR mutation]
---

Geçen derste `&` ile bir değeri **okumak için** ödünç vermeyi öğrendin ve bir duvara çarptın:
`&String` üzerinden `push_str` çağıramıyordun (E0596). Ama gerçek programlar sürekli bir şeyleri
değiştirir: hesaba para yatırılır, sepete ürün eklenir, oyun karakteri hasar alır.

Bu derste **değiştirilebilir referansları (`&mut`)** ve Rust'ın en ünlü kuralını öğreneceksin.
Bu kural ilk bakışta katı görünür, ama C ve C++ programcılarının yıllarca uğraştığı bir hata sınıfını
**tamamen** ortadan kaldırır.

## `&mut` ile değiştirmek için ödünç almak

Bir banka hesabına para yatıran bir fonksiyon yazalım. Fonksiyon bakiyenin **sahibi olmamalı**, ama
onu **değiştirebilmeli**:

```rust
fn para_yatir(hesap: &mut i64, miktar: i64) {
    *hesap += miktar; // hesap'ın gösterdiği değeri artır
}

fn main() {
    let mut bakiye = 100;
    para_yatir(&mut bakiye, 50);
    para_yatir(&mut bakiye, 25);
    println!("Bakiye: {bakiye} TL");
}
```

Değiştirme izni üç yerde açıkça yazılır:

1. **`let mut bakiye`**: Sahibin kendisi değiştirilebilir olmalı. Sende olmayan bir izni başkasına veremezsin.
2. **`&mut bakiye`**: Çağrı yerinde "değiştirilebilir bir referans veriyorum" dersin.
3. **`hesap: &mut i64`**: Fonksiyonun imzası "ben bu değeri değiştireceğim" diye ilan eder.

Değiştirmenin kendisi de `*` ile olur: `*hesap += miktar` "hesap'ın gösterdiği sayıyı artır" demektir.
`*` yazmayı unutursan derleyici seni uyarır:

:::error
```text
error[E0368]: binary assignment operation `+=` cannot be applied to type `&mut i64`
 --> src/main.rs:2:5
  |
2 |     hesap += miktar;
  |     -----^^^^^^^^^^
  |     |
  |     cannot use `+=` on type `&mut i64`
  |
help: `+=` can be used on `i64` if you dereference the left-hand side
  |
2 |     *hesap += miktar;
  |     +
```
Referansın kendisine (bir adrese) sayı eklenemez; eklemeyi gösterilen `i64`'e yapmalısın.
:::

Bellekte olan biten şu:

```memory
title: "para_yatir(&mut bakiye, 50) adım adım"
steps:
  - caption: "`bakiye` değiştirilebilir bir değişken olarak stack'te."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: i64, value: "100", mut: true }
  - caption: "Çağrı: `hesap` parametresi `bakiye`'yi gösteren **değiştirilebilir** bir referans."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: i64, value: "100", mut: true }
      - frame: para_yatir
        vars:
          - { name: hesap, type: "&mut i64", value: "adres", to: bakiye }
          - { name: miktar, type: i64, value: "50" }
  - caption: "`*hesap += miktar;` değeri **yerinde** değiştirir: değişen, `main`'deki `bakiye`'dir."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: i64, value: "150", mut: true, note: "hesap üzerinden değişti" }
      - frame: para_yatir
        vars:
          - { name: hesap, type: "&mut i64", value: "adres", to: bakiye }
          - { name: miktar, type: i64, value: "50" }
  - caption: "Fonksiyon bitti: referans yok oldu, değişiklik kaldı."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: i64, value: "150", mut: true }
```

Geçen dersteki E0596 örneğini de artık düzeltebiliriz. Metot çağrılarında otomatik çözümleme `&mut`
için de çalışır; `push_str`'den önce `*` yazmaya gerek yok:

```rust
fn imza_ekle(kitap: &mut String) {
    kitap.push_str(" (imzalı)");
}

fn main() {
    let mut kitap = String::from("Sefiller");
    imza_ekle(&mut kitap);
    println!("{kitap}");
}
```

Üç `mut`'tan biri eksik olursa ne olur? Tahmin et:

```compiles
code: |
  fn para_yatir(hesap: &mut i64, miktar: i64) {
      *hesap += miktar;
  }

  fn main() {
      let bakiye = 100;
      para_yatir(&mut bakiye, 50);
      println!("Bakiye: {bakiye} TL");
  }
answer: false
error: E0596
explanation: |
  `bakiye` `mut` olmadan tanımlanmış. Değişmez bir değişkenden değiştirilebilir bir referans
  alınamaz: `cannot borrow bakiye as mutable, as it is not declared as mutable`. Derleyici çözümü de
  söyler: `let mut bakiye = 100;`
```

Bir de Modül 3'teki döngülerle birleştirelim:

```predict
code: |
  fn ikiye_katla(x: &mut i32) {
      *x *= 2;
  }

  fn main() {
      let mut n = 1;
      for _ in 0..3 {
          ikiye_katla(&mut n);
      }
      println!("{n}");
  }
options:
  - "1"
  - "6"
  - "8"
answer: 2
explanation: |
  `0..3` aralığı 3 tur döner (0, 1, 2; üst sınır dahil değil). Her turda `ikiye_katla`, `main`'deki
  `n`'yi **yerinde** ikiye katlar: 1 → 2 → 4 → 8.

  "1" diyen, fonksiyonun bir kopya üzerinde çalıştığını düşünmüştür. C veya Java'da bir `int`'i
  fonksiyona verdiğinde gerçekten de kopyası gider. Ama burada fonksiyona `n`'nin kendisine giden bir
  `&mut` referans veriyoruz.
```

## Altın kural: ya tek yazar ya da çok okur

Şimdi asıl konuya geliyoruz. İki kişi aynı belgeyi aynı anda düzenlemek isterse ne olur? Önce tahmin et:

```compiles
code: |
  fn main() {
      let mut belge = String::from("Taslak");
      let yazar1 = &mut belge;
      let yazar2 = &mut belge;
      yazar1.push_str(" + Ali'nin notu");
      yazar2.push_str(" + Ayşe'nin notu");
      println!("{belge}");
  }
answer: false
error: E0499
explanation: |
  Aynı değere aynı anda **iki** değiştirilebilir referans olamaz. `yazar2` oluşturulduğunda `yazar1`
  hâlâ canlı, çünkü bir sonraki satırda kullanılıyor. Hata: `cannot borrow belge as mutable more than
  once at a time`.
```

Peki biri sadece **okuyorsa**?

```compiles
code: |
  fn main() {
      let mut belge = String::from("Taslak");
      let okuyucu = &belge;
      let yazar = &mut belge;
      yazar.push_str(" (düzenlendi)");
      println!("Okuyucu görüyor: {okuyucu}");
  }
answer: false
error: E0502
explanation: |
  `okuyucu` değişmez bir ödünç ve son satırda hâlâ kullanılıyor. O canlıyken `&mut` alınamaz:
  `cannot borrow belge as mutable because it is also borrowed as immutable`. Okuyucu, belgenin kendi
  gözünün önünde değiştiğini görmemeli.
```

İki örneğin arkasında tek bir kural var. Rust'ın **ödünç alma kuralı (borrowing rule)** şudur:

> Herhangi bir anda, bir değer için **ya tek bir `&mut`** referans **ya da istediğin kadar `&`**
> referans olabilir. İkisi aynı anda asla olamaz.

Bu kurala kısaca **"aliasing XOR mutation"** denir: Aynı veriye birden çok yoldan erişim (aliasing) ya
da değişiklik (mutation) olabilir, ama ikisi bir arada olamaz.

:::analogy Müzedeki tablo
Bir müzedeki tabloyu aynı anda yüzlerce ziyaretçi seyredebilir; kimse kimseyi rahatsız etmez (çok
sayıda `&`). Ama restoratör tabloyu onarmaya geldiğinde salon kapatılır. O çalışırken ne ziyaretçi
girebilir ne de ikinci bir restoratör (tek `&mut`). Ziyaretçiler içerideyken boyamaya başlamak, yarım
kalmış bir fırça darbesini "tablonun aslı" sanmalarına yol açardı.
:::

Derleyicinin mesajı bu hikâyeyi üç etiketle anlatır:

:::error
```text
error[E0499]: cannot borrow `belge` as mutable more than once at a time
 --> src/main.rs:4:18
  |
3 |     let yazar1 = &mut belge;
  |                  ---------- first mutable borrow occurs here
4 |     let yazar2 = &mut belge;
  |                  ^^^^^^^^^^ second mutable borrow occurs here
5 |     yazar1.push_str(" + Ali'nin notu");
  |     ------ first borrow later used here
```
1. **first mutable borrow occurs here**: Birinci ödünç burada başladı.
2. **second mutable borrow occurs here**: Çakışma burada (`^^^^` ile işaretli asıl hata noktası).
3. **first borrow later used here**: Birinci ödünç burada **hâlâ gerekli**. Çakışmanın sebebi bu satır!

E0502'de de aynı üçlü vardır: `immutable borrow occurs here`, `mutable borrow occurs here`,
`immutable borrow later used here`. Bu üç satırı bulmak, ödünç hatalarının yarısını çözmek demektir.
:::

Kural **sahibi de** kapsar. Bir `&mut` canlıyken sahibi bile değeri okuyamaz ya da değiştiremez.
`println!("{belge}")` gibi bir okuma yine E0502 verir; `i32` gibi `Copy` bir değeri kopyalayarak okumak
E0503 (`cannot use x because it was mutably borrowed`), yeni bir değer atamak ise E0506 (`cannot
assign to belge because it is borrowed`) verir. Restoratör çalışırken müzenin müdürü de salona giremez!

## Neden bu kadar katı?

İlk bakışta bu kural gereksiz görünebilir: "Ben tek thread'li basit bir program yazıyorum, kime ne
zararı var?" İki önemli cevabı var.

**1) Veri yarışları (data races).** Bir veri yarışı şu üç koşul **aynı anda** sağlandığında oluşur:

- İki ya da daha fazla işaretçi aynı veriye aynı anda erişir,
- bunlardan en az biri **yazar**,
- erişimleri düzenleyen bir senkronizasyon yoktur.

Sonuç öngörülemez. Bazen doğru çalışır, bazen bozuk veri üretir; hata ayıklaması da kâbus gibidir.
Rust'ın kuralı ikinci koşulun birinciyle buluşmasını **derleme zamanında** imkânsız kılar. Modül 18'de
thread'lerle çalışırken bu kural sayesinde "korkusuz eşzamanlılığa" (fearless concurrency) kavuşacağız.

**2) Geçersiz kalan referanslar (iterator invalidation).** Bu, tek thread'li programlarda bile olur.
C++'taki şu kod derlenir ve sessizce **tanımsız davranışa** (undefined behavior) yol açar:

```cpp
std::vector<int> v = {1, 2, 3};
int& ilk = v[0];      // v'nin ilk elemanına referans
v.push_back(4);       // kapasite doluysa vektör yeni bir yere taşınır!
std::cout << ilk;     // ilk artık serbest bırakılmış eski belleği gösteriyor
```

Neden? Bir `Vec` (C++'ta `vector`) elemanlarını heap'te yan yana tutar. Kapasite dolunca daha büyük
yeni bir alan ayırır, elemanları oraya kopyalar ve **eski alanı serbest bırakır**. Eski alanı gösteren
her referans o anda geçersiz kalır:

```memory
title: "let ilk = &v[0]; v.push(4); (Rust izin verseydi)"
steps:
  - caption: "`v`'nin kapasitesi 3 ve dolu. `ilk`, heap'teki ilk elemanı gösteriyor."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=3 · cap=3", to: h1, mut: true }
          - { name: ilk, type: "&i32", value: "adres", to: h1, note: "v[0]'ı gösterir" }
    heap:
      - { id: h1, value: "1 2 3" }
  - caption: "`v.push(4)`: Yer yok! Vec daha büyük bir alan ayırır, elemanları kopyalar, eski alanı **serbest bırakır**. `ilk` artık çöpü gösteriyor."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=6", to: h2, mut: true }
          - { name: ilk, type: "&i32", value: "adres", to: h1, note: "sarkan referans!" }
    heap:
      - { id: h1, value: "1 2 3", freed: true, label: "eski alan" }
      - { id: h2, value: "1 2 3 4 _ _", label: "yeni alan" }
```

Rust bu senaryoyu hiç çalıştırmaz, çünkü kod derlenmez. `push` bir `&mut self` ister, `ilk` ise canlı
bir `&` ödüncüdür. Bu tam olarak E0502'dir:

```rust,compile_fail,E0502
fn main() {
    let mut v = vec![1, 2, 3];
    let ilk = &v[0];
    v.push(4); // HATA: v'yi değiştirmek için &mut gerekiyor, ama ilk hâlâ canlı
    println!("{ilk}");
}
```

```quiz
question: "`let ilk = &v[0];` canlıyken `v.push(4)` çağrısının yasak olmasının **asıl** nedeni nedir?"
options:
  - "`push`, Vec'in elemanlarını yeni bir bellek alanına taşıyıp eskisini serbest bırakabilir; `ilk` serbest bırakılmış belleği gösterebilir"
  - "`push` her zaman Vec'in bütün elemanlarını siler"
  - "Rust'ta bir Vec'e eleman eklemek için önce bütün referansların `clone` edilmesi gerekir"
  - "`ilk` değişmez olduğu için Vec de sonsuza kadar değişmez olur"
answer: 0
explanation: |
  Sorun yeniden ayırma (reallocation). Kapasite dolduğunda Vec elemanlarını yeni bir yere taşır;
  eski adresi tutan referans sarkar. Rust bunu "kapasite dolu mu?" diye çalışma zamanında kontrol
  etmez. Bunun yerine kuralı **her zaman** uygular: Bir `&` canlıyken `&mut` alınamaz. Böylece hata
  hiçbir koşulda oluşamaz.
feedback:
  - "Doğru! Bu C++'ta \"iterator invalidation\" diye bilinen ünlü hata sınıfıdır."
  - "`push` eleman ekler, silmez. Sorun elemanların **yer değiştirebilmesi**."
  - "Böyle bir kural yok. `ilk`'in son kullanımı `push`'tan önce olsaydı kod sorunsuz derlenirdi."
  - "Kısıtlama yalnızca `ilk` canlıyken geçerli; `ilk`'in işi bitince Vec yine değiştirilebilir."
```

:::deep Kuralın gizli ödülü: hız
`&mut` referansın **tek** olduğu garanti edildiği için derleyici, o veriyi başka hiçbir yolun
değiştiremeyeceğini bilir. Bu yüzden değerleri register'da tutmak gibi optimizasyonları güvenle
yapabilir. C'de aynı garantiyi vermek için işaretçilere `restrict` anahtar kelimesini **elle** yazman
gerekir; yanlış yazarsan program tanımsız davranışa girer. Rust bu bilgiyi fonksiyon parametresi olan
her `&mut` için LLVM'e kendisi verir (`noalias`), üstelik doğruluğunu da kanıtlamış olarak.
:::

## NLL: Ödünç, son kullanımda biter

Peki bir ödünç **ne zaman** biter? Tahmin et, bu kod derlenir mi?

```compiles
code: |
  fn main() {
      let mut s = String::from("merhaba");
      let r1 = &s;
      let r2 = &s;
      println!("{r1} ve {r2}");
      let r3 = &mut s;
      r3.push_str(" dünya");
      println!("{r3}");
  }
answer: true
explanation: |
  Derlenir! `r1` ve `r2` en son `println!` satırında kullanılıyor; ondan sonra bir daha kullanılmıyorlar.
  Bu yüzden ödünçleri **orada biter**. `r3` oluşturulduğunda ortada canlı bir `&` kalmamıştır.
  Değişkenlerin kapsamı (scope) daha uzun olsa da önemli olan **son kullanım** yeridir.
```

Bir ödünç, oluşturulduğu yerden **son kullanıldığı yere** kadar yaşar; kapsamın sonuna kadar değil.
Bu davranışın adı **NLL (Non-Lexical Lifetimes, sözcüksel olmayan yaşam süreleri)**. Yukarıdaki
programın zaman çizelgesi şöyle:

```text
let r1 = &s;               ─┐ r1 canlı
let r2 = &s;                │   ─┐ r2 canlı
println!("{r1} ve {r2}");  ─┘   ─┘ ← son kullanım: iki ödünç de biter
let r3 = &mut s;           ─┐ r3 canlı (artık çakışma yok)
r3.push_str(" dünya");      │
println!("{r3}");          ─┘
```

:::info Biraz tarih
NLL'den önce ödünçler kapsamın sonuna kadar sürerdi; yukarıdaki kod derlenmezdi ve programcılar
ödünçleri ayırmak için yapay `{ }` blokları yazardı. NLL, 2018 edisyonuyla birlikte Rust 1.31'de
(Aralık 2018) geldi; bugün bütün edisyonlarda geçerli olan tek ödünç denetleyicisi budur. Eski ders
kitaplarında ve forumlarda "bu derlenmez" diye gösterilen bazı örneklerin artık derlendiğini
görürsen şaşırma.

Küçük bir dipnot: "son kullanım" kuralı bir basitleştirmedir. Referansı **içinde tutan** bir değer
kapsam sonunda temizlik kodu çalıştırıyorsa (ileride göreceğin `Drop`), o temizlik de bir kullanım
sayılır ve ödünç kapsamın sonuna kadar uzar. Düz `&`/`&mut` referanslarda bu durum yoktur.
:::

Yine de ödünçleri bilinçli olarak ayırmak istersen **iç kapsamlar** hâlâ iş görür. İç bloktaki
referans, blok bitince kesin olarak ölür:

```rust
fn main() {
    let mut not_defteri = String::from("Alışveriş:");
    {
        let yazar = &mut not_defteri;
        yazar.push_str(" ekmek");
    } // yazar burada ölür
    let yazar2 = &mut not_defteri; // yeni bir &mut almak güvenli
    yazar2.push_str(", peynir");
    println!("{not_defteri}");
}
```

Sıra sende. Satırları, programın önce `Önce: 50` sonra `Sonra: 60` yazdıracağı ve **derleneceği**
şekilde sırala. Dikkat: Araya çeldirici (yanlış) satırlar karıştırıldı.

```parsons
prompt: "Programı kur: Önce `puan`'ı bir `&` ile oku, sonra bir `&mut` ile 10 artır."
lines: |
  fn main() {
      let mut puan = 50;
      let oku = &puan;
      println!("Önce: {oku}");
      let yaz = &mut puan;
      *yaz += 10;
      println!("Sonra: {puan}");
  }
distractors: |
      let yaz = &puan;
      yaz += 10;
explanation: |
  `oku`'nun son kullanımı ilk `println!`'dir; `&mut` ondan **sonra** alınmalı, yoksa E0502 olur.
  `*yaz += 10` satırında çözümleme şart; `yaz += 10` bir adrese sayı eklemeye çalışır (E0368).
  `let yaz = &puan;` ise değişmez bir referans olurdu ve onunla değişiklik yapamazdın. Son
  `println!` satırında `puan`'ı doğrudan kullanabiliyoruz, çünkü `yaz`'ın işi bitti (NLL).
```

:::deep `&` kopyalanır, `&mut` taşınır
Paylaşılan referans `&T` bir `Copy` tipidir: `let a = r; let b = r;` sorunsuzdur, çünkü çok sayıda
okuyucu zaten serbest. `&mut T` ise **`Copy` değildir**. Kopyalanabilseydi elinde aynı veriye iki
`&mut` olurdu! Bu yüzden `let r2 = r1;` satırı `r1`'i **taşır** ve sonra `r1`'i kullanmak E0382 verir.

Peki `&mut` bir fonksiyona verilince neden kaybolmuyor?

```rust
fn ekle(s: &mut String) {
    s.push_str("!");
}

fn main() {
    let mut s = String::from("selam");
    let r = &mut s;
    ekle(r); // aslında ekle(&mut *r): geçici bir yeniden ödünç
    ekle(r); // r hâlâ kullanılabilir
    println!("{r}");
}
```

Derleyici `&mut` beklenen yerlere verilen `&mut` referansları sessizce **yeniden ödünç alır**
(reborrow): `&mut *r`. Yeni ödünç, çağrı boyunca yaşar ve bitince `r` yeniden kullanılabilir hâle gelir.
:::

## Alıştırmalar

````exercise
title: Oyun karakteri hasar alıyor
difficulty: 2
prompt: |
  Bir RPG oyununda karakterin canı `u32` olarak tutuluyor. `hasar_al` fonksiyonu canı
  **yerinde** azaltmalı:

  - `can`'dan `hasar` kadar düş.
  - Can asla 0'ın altına inmemeli: Hasar candan büyükse can 0 olur.

  Dikkat: `u32` negatif olamaz. `20 - 50` gibi bir çıkarma debug modda **panik** verir. Modül 2'deki
  taşma (overflow) konusunu hatırla!
starter: |
  fn hasar_al(can: &mut u32, hasar: u32) {
      todo!()
  }

  fn main() {
      let mut can = 100;
      hasar_al(&mut can, 30);
      println!("Kalan can: {can}");
      hasar_al(&mut can, 500);
      println!("Kalan can: {can}");
  }
solution: |
  fn hasar_al(can: &mut u32, hasar: u32) {
      if hasar >= *can {
          *can = 0;
      } else {
          *can -= hasar;
      }
  }

  fn main() {
      let mut can = 100;
      hasar_al(&mut can, 30);
      println!("Kalan can: {can}");
      hasar_al(&mut can, 500);
      println!("Kalan can: {can}");
  }
check: tests
tests: |
  #[test]
  fn normal_hasar_cani_azaltir() {
      let mut can = 100;
      hasar_al(&mut can, 30);
      assert_eq!(can, 70, "100 candan 30 hasar sonrası 70 kalmalı");
  }

  #[test]
  fn asiri_hasarda_can_sifirda_durur() {
      let mut can = 20;
      hasar_al(&mut can, 50);
      assert_eq!(can, 0, "hasar candan büyükse can 0 olmalı (negatife inemez)");
  }

  #[test]
  fn tam_hasar_ve_sifir_hasar() {
      let mut can = 50;
      hasar_al(&mut can, 50);
      assert_eq!(can, 0, "50 candan 50 hasar sonrası can tam 0 olmalı");
      let mut can2 = 40;
      hasar_al(&mut can2, 0);
      assert_eq!(can2, 40, "0 hasar canı değiştirmemeli");
  }

  #[test]
  fn arka_arkaya_hasarlar_birikir() {
      let mut can = 100;
      hasar_al(&mut can, 10);
      hasar_al(&mut can, 25);
      hasar_al(&mut can, 1000);
      hasar_al(&mut can, 5);
      assert_eq!(can, 0, "can sıfıra indikten sonra yeni hasarlar panik vermemeli");
  }
hints:
  - "Gösterilen değeri okumak ve değiştirmek için çözümlemen gerekir: `*can`."
  - "Önce karşılaştır: `if hasar >= *can { *can = 0; } else { *can -= hasar; }`"
  - "Daha kısa yol: Modül 2'deki `saturating_add`'in çıkarma kardeşi `saturating_sub`, 0'ın altına inmez: `*can = can.saturating_sub(hasar);`"
explanation: |
  `can` bir `&mut u32` olduğu için değeri okumak (`*can`) ve yazmak (`*can = 0`) için çözümleme
  yaptık. Değişiklik doğrudan çağıranın değişkenine yansıdı; hiçbir şey döndürmemize gerek kalmadı.

  Doğrudan `*can -= hasar;` yazsaydın, `hasar > *can` olduğunda `u32` taşar ve debug modda program
  `attempt to subtract with overflow` ile panik verirdi. Önce karşılaştırmak bu yüzden şart.

  İdiomatik kısa çözüm: `*can = can.saturating_sub(hasar);`. Burada `can.saturating_sub(...)` çağrısı
  otomatik çözümleme sayesinde `(*can).saturating_sub(...)` olarak çalışır.
````

İkinci alıştırmada aynı anda **iki farklı** değişkene `&mut` referans alacaksın. Bu serbest, çünkü
kural **aynı** değer için geçerli.

````exercise
title: Hesaplar arası havale
difficulty: 3
prompt: |
  `havale` fonksiyonu `gonderen` hesaptan `alici` hesaba `miktar` TL aktarır ve işlemin başarılı
  olup olmadığını döndürür:

  - `miktar` 0 ya da negatifse işlem **geçersizdir**: hiçbir hesabı değiştirme, `false` döndür.
  - Gönderenin bakiyesi `miktar`'a yetmiyorsa hiçbir hesabı değiştirme, `false` döndür.
  - Aksi halde gönderenden düş, alıcıya ekle ve `true` döndür.
starter: |
  fn havale(gonderen: &mut i64, alici: &mut i64, miktar: i64) -> bool {
      todo!()
  }

  fn main() {
      let mut ayse = 500;
      let mut mehmet = 100;
      let basarili = havale(&mut ayse, &mut mehmet, 200);
      println!("{basarili}: Ayşe {ayse} TL, Mehmet {mehmet} TL");
  }
solution: |
  fn havale(gonderen: &mut i64, alici: &mut i64, miktar: i64) -> bool {
      if miktar <= 0 || *gonderen < miktar {
          return false;
      }
      *gonderen -= miktar;
      *alici += miktar;
      true
  }

  fn main() {
      let mut ayse = 500;
      let mut mehmet = 100;
      let basarili = havale(&mut ayse, &mut mehmet, 200);
      println!("{basarili}: Ayşe {ayse} TL, Mehmet {mehmet} TL");
  }
check: tests
tests: |
  #[test]
  fn basarili_havale_iki_hesabi_gunceller() {
      let mut ayse = 500;
      let mut mehmet = 100;
      assert!(havale(&mut ayse, &mut mehmet, 200), "500 TL'si olan 200 TL gönderebilmeli");
      assert_eq!((ayse, mehmet), (300, 300), "Ayşe 300, Mehmet 300 TL olmalı");
  }

  #[test]
  fn yetersiz_bakiyede_hicbir_sey_degismez() {
      let mut ali = 50;
      let mut zeynep = 0;
      assert!(!havale(&mut ali, &mut zeynep, 80), "50 TL ile 80 TL gönderilemez");
      assert_eq!((ali, zeynep), (50, 0), "başarısız havalede bakiyeler aynen kalmalı");
  }

  #[test]
  fn bakiyenin_tamami_gonderilebilir() {
      let mut a = 70;
      let mut b = 30;
      assert!(havale(&mut a, &mut b, 70), "bakiyenin tamamı gönderilebilmeli");
      assert_eq!((a, b), (0, 100), "gönderen 0, alıcı 100 TL olmalı");
  }

  #[test]
  fn sifir_ve_negatif_miktar_gecersizdir() {
      let mut a = 100;
      let mut b = 100;
      assert!(!havale(&mut a, &mut b, 0), "0 TL'lik havale geçersiz");
      assert!(!havale(&mut a, &mut b, -20), "negatif miktar geçersiz (yoksa alıcıdan para çekilirdi!)");
      assert_eq!((a, b), (100, 100), "geçersiz havalelerde bakiyeler değişmemeli");
  }
hints:
  - "Önce geçersiz durumları ele al ve erken `return false;` yap (Modül 3: erken dönüş)."
  - "Koşul: `if miktar <= 0 || *gonderen < miktar { return false; }`"
  - "Sonra `*gonderen -= miktar;` ve `*alici += miktar;` yaz; en sonda noktalı virgülsüz `true`."
explanation: |
  Aynı anda iki `&mut` referansımız var, ama **farklı** değerlere (`ayse` ve `mehmet`). Kural
  "bir değer için tek `&mut`" dediği için bu tamamen serbest.

  Asıl ilginç olan, Rust'ın neyi engellediği: Aynı hesaptan aynı hesaba havale yapmaya çalış:

  ```text
  havale(&mut hesap, &mut hesap, 100);
  error[E0499]: cannot borrow `hesap` as mutable more than once at a time
  ```

  C'de `void havale(long *g, long *a, long m)` fonksiyonuna aynı işaretçiyi iki kez verebilirsin.
  Bizim kısa fonksiyonumuzda bu zararsız kalırdı, ama "iki farklı hesap" varsayımıyla yazılmış biraz
  farklı bir kod sessizce bozulur: önce `yeni_g = *g - m; yeni_a = *a + m;` hesaplayıp sonra
  `*g = yeni_g; *a = yeni_a;` yazan bir sürüm, aynı hesap iki kez verilince hesaba **yoktan `m` TL
  ekler**. Rust'ta bu varsayım **imzanın bir parçası**: İki `&mut` parametre, derleyici tarafından
  kanıtlanmış biçimde farklı değerleri gösterir.

  Neden önce kontrol, sonra değişiklik? Böylece başarısız bir işlem hesapları yarım yamalak
  değiştirmiş olarak bırakmaz. Bankacılıkta buna "ya hep ya hiç" (atomiklik) denir.
````

## Özet ve tekrar

:::remember
- `&mut T`: değiştirilebilir referans. Üç yerde `mut` gerekir: `let mut x`, `&mut x`, `p: &mut T`.
- Değiştirmek için çözümle: `*p += 1;`. Metot çağrılarında (`p.push_str(..)`) otomatik çözümleme vardır.
- **Altın kural:** Bir değer için aynı anda **ya tek `&mut` ya da istediğin kadar `&`**.
- E0499 = iki `&mut` çakışması, E0502 = `&` ile `&mut` çakışması, E0506 = ödünçteyken atama.
- Ödünç, **son kullanımda** biter (NLL); kapsam sonunda değil.
- Kuralın sebebi: veri yarışlarını ve yeniden ayırmada sarkan referansları imkânsız kılmak.
:::

```reflect
prompt: |
  Bir arkadaşın "Tek thread'li programda aynı anda bir `&` ve bir `&mut` olsa ne olur ki?" diye
  soruyor. Ona `Vec` örneğiyle kendi cümlelerinle açıkla.
answer: |
  Model cevap: Bir `Vec`'in elemanlarından birine `&` referans tuttuğumuzu düşünelim. Aynı anda
  `&mut` ile `push` yapabilseydik, kapasite dolduğunda Vec elemanlarını yeni bir yere taşıyıp eski
  belleği serbest bırakırdı. Elimizdeki `&` referans artık serbest bırakılmış belleği gösterirdi
  (sarkan referans). C++'ta bu "iterator invalidation" hatasıdır ve tanımsız davranışa yol açar.
  Rust, bir `&` canlıyken `&mut` alınmasını yasaklayarak bunu thread olsun olmasın her durumda
  derleme zamanında engeller.
```

```flashcards
- front: "`&mut` referans alıp kullanmak için hangi üç yerde `mut` yazılır?"
  back: "Değişken tanımında (`let mut x`), çağrıda (`&mut x`) ve parametre tipinde (`p: &mut T`)."
- front: "`p: &mut i32` iken gösterilen değeri 1 artıran satır nedir?"
  back: "`*p += 1;` (`*` olmadan `p += 1` E0368 verir)"
- front: Rust'ın ödünç alma kuralını tek cümleyle söyle.
  back: "Bir değer için aynı anda ya **tek bir `&mut`** ya da **istediğin kadar `&`** olabilir; ikisi birden asla."
- front: E0499 ile E0502 arasındaki fark nedir?
  back: "E0499: aynı değere iki `&mut`. E0502: aynı değere hem `&` hem `&mut`."
- front: NLL (Non-Lexical Lifetimes) ne demektir?
  back: Bir ödünç kapsamın sonunda değil, **son kullanıldığı yerde** biter.
- front: Veri yarışının (data race) üç koşulu nedir?
  back: "İki+ işaretçi aynı veriye aynı anda erişir, en az biri yazar, senkronizasyon yoktur."
- front: "`let ilk = &v[0];` canlıyken `v.push(4)` neden tehlikeli olurdu?"
  back: "Kapasite dolarsa Vec elemanları yeni yere taşıyıp eski belleği serbest bırakır; `ilk` sarkardı."
- front: "`&T` `Copy` mudur? Ya `&mut T`?"
  back: "`&T` `Copy`'dir. `&mut T` değildir; atamada taşınır (fonksiyona verilirken otomatik yeniden ödünç alınır)."
```
