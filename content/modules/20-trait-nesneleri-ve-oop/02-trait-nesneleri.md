---
id: m20-l02
title: "Trait nesneleri, dyn Trait"
minutes: 20
type: lesson
objectives:
  - "Farklı tipleri `Vec<Box<dyn Trait>>` ile tek bir koleksiyonda tutup ortak arayüz üzerinden kullanabilmek"
  - "`&dyn Trait` ve `Box<dyn Trait>` parametreleri yazabilmek; trait nesnesinin neden hep bir işaretçi arkasında durduğunu açıklayabilmek"
  - Bir trait nesnesinin bellekteki hâlini (veri işaretçisi + vtable işaretçisi) çizebilmek
  - Bir problem için generic mi trait nesnesi mi kullanılacağına kapalı/açık tip kümesi ölçütüyle karar verebilmek
keywords: [dyn, trait nesnesi, "Box<dyn Trait>", "&dyn Trait", vtable, geniş işaretçi, E0782, E0599]
---

Bir arayüz (GUI) kütüphanesi yazıyorsun. Ekranda düğmeler, metinler, seçim kutuları olacak ve
kütüphanen her birine sırayla “kendini çiz” diyecek. İşin zor kısmı şu: kütüphaneni kullanan
programcılar **senin hiç görmediğin** bileşenler de ekleyecek: bir takvim, bir harita, bir
`Yildiz` puanlama widget'ı... Sen bu tipleri bugünden bilemezsin, ama hepsini aynı listede tutup
aynı döngüde çizmen gerekiyor.

Önceki derste bu sorunun cevabını bir satırla görmüştün: `Vec<Box<dyn Ses>>`. Bu derste **trait
nesnelerini (trait objects)** derinlemesine öğreneceksin: neden gerekli oldukları, bellekte nasıl
göründükleri ve ne zaman generic'lerin yerine tercih edilmeleri gerektiği.

## Generic bir ekran neden yetmez?

Modül 11'deki araçlarla ilk denemeyi yapalım: bileşenleri generic bir `Ekran<T>` içinde tutalım.
Tahmin et:

```compiles
code: |
  trait Ciz {
      fn ciz(&self) -> String;
  }

  struct Dugme {
      etiket: String,
  }

  struct Metin {
      icerik: String,
  }

  impl Ciz for Dugme {
      fn ciz(&self) -> String {
          format!("[ {} ]", self.etiket)
      }
  }

  impl Ciz for Metin {
      fn ciz(&self) -> String {
          self.icerik.clone()
      }
  }

  struct Ekran<T: Ciz> {
      bilesenler: Vec<T>,
  }

  fn main() {
      let ekran = Ekran {
          bilesenler: vec![
              Dugme { etiket: String::from("Tamam") },
              Metin { icerik: String::from("Kayıt başarılı") },
          ],
      };
      for b in &ekran.bilesenler {
          println!("{}", b.ciz());
      }
  }
answer: false
error: E0308
explanation: |
  `Ekran<T>`'de `T` **tek bir** tip yerine geçer. Derleyici ilk elemana bakıp `T = Dugme` kararını verir;
  ikinci eleman `Metin` olduğu için `expected Dugme, found Metin` hatası gelir. Bir `Vec<T>`'nin bütün
  elemanları aynı tipte olmak zorundadır, çünkü hepsi bellekte yan yana, aynı boyutta durur (Modül 9).
```

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:33:13
   |
33 |             Metin { icerik: String::from("Kayıt başarılı") },
   |             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ expected `Dugme`, found `Metin`
```
Generic'ler “**herhangi bir** tip, ama **tek** bir tip” demektir. `Ekran<Dugme>` yalnızca düğmeler,
`Ekran<Metin>` yalnızca metinler tutabilir. Karışık bir ekran bu şekilde kurulamaz.
:::

Peki bir enum yapsak? `enum Bilesen { Dugme(Dugme), Metin(Metin) }` gerçekten çalışır, ama yalnızca
**senin** bildiğin tipler için. Kütüphaneni kullanan biri kendi `Yildiz` tipini enum'a ekleyemez, çünkü
enum senin crate'inde tanımlı ve **kapalı** bir listedir. İhtiyacımız olan şey şu: “*`Ciz`'i uygulayan
herhangi bir tip, tipi ne olursa olsun.*”

## Box<dyn Ciz>: tipi unut, davranışı hatırla

Rust'taki cevap trait nesnesidir. `dyn Ciz`, “`Ciz` trait'ini uygulayan, somut tipi çalışma zamanında
belli olacak bir değer” anlamına gelir. Onu bir işaretçinin arkasına koyarız: `Box<dyn Ciz>`.

```rust
trait Ciz {
    fn ciz(&self) -> String;
}

struct Dugme {
    etiket: String,
}

struct Metin {
    icerik: String,
}

impl Ciz for Dugme {
    fn ciz(&self) -> String {
        format!("[ {} ]", self.etiket)
    }
}

impl Ciz for Metin {
    fn ciz(&self) -> String {
        self.icerik.clone()
    }
}

struct Ekran {
    bilesenler: Vec<Box<dyn Ciz>>,
}

impl Ekran {
    fn goster(&self) {
        for b in &self.bilesenler {
            println!("{}", b.ciz()); // hangi ciz()? çalışma zamanında belli olur
        }
    }
}

// --- Kütüphaneyi KULLANAN birinin kodu: senin hiç görmediğin bir tip ---
struct Yildiz {
    puan: usize,
}

impl Ciz for Yildiz {
    fn ciz(&self) -> String {
        "★".repeat(self.puan) + &"☆".repeat(5 - self.puan)
    }
}

fn main() {
    let ekran = Ekran {
        bilesenler: vec![
            Box::new(Metin { icerik: String::from("Siparişin hazır!") }),
            Box::new(Yildiz { puan: 4 }),
            Box::new(Dugme { etiket: String::from("Değerlendir") }),
        ],
    };
    ekran.goster();
}
```

`Ekran` artık generic değil; `Vec<Box<dyn Ciz>>` her elemanı ayrı bir tipte olabilen bir liste. `Ekran`'ı
yazarken `Yildiz` diye bir tipin varlığından haberin bile yoktu, yine de onu çizebiliyorsun. Buna **açık
(open) tip kümesi** denir: trait'i uygulayan herkes, sonradan bile, listeye katılabilir.

`Box::new(Yildiz { .. })` aslında `Box<Yildiz>` üretir. Değer `Vec<Box<dyn Ciz>>`'e girerken derleyici onu
kendiliğinden `Box<dyn Ciz>`'e çevirir. Buna **boyut silme dönüşümü (unsizing coercion)** denir ve yalnızca
`Yildiz` gerçekten `Ciz`'i uyguluyorsa izin verilir. Uygulamıyorsa `the trait bound `Yildiz: Ciz` is not
satisfied` (E0277) alırsın.

:::warning dyn anahtar kelimesini unutma
Eski (2015) Rust kodunda `Box<Ciz>` yazıldığını görebilirsin. 2021 ve 2024 sürümlerinde bu bir hatadır:

```text
error[E0782]: expected a type, found a trait
 --> src/main.rs:9:16
  |
9 |     let b: Box<Ciz> = Box::new(Dugme);
  |                ^^^
  |
help: you can add the `dyn` keyword if you want a trait object
  |
9 |     let b: Box<dyn Ciz> = Box::new(Dugme);
  |                +++
```
`dyn` kelimesi okuyucuya “burada dinamik dispatch, yani çalışma zamanı maliyeti var” diye bağırır. Bu
yüzden zorunlu hâle getirildi: `impl Ciz` (statik) ile `dyn Ciz` (dinamik) bir bakışta ayırt edilebilsin.
:::

Trait nesnesinin bir bedeli var: somut tip **unutulur**. Tahmin et:

```compiles
code: |
  trait Ciz {
      fn ciz(&self) -> String;
  }

  struct Dugme {
      etiket: String,
  }

  impl Dugme {
      fn tikla(&self) -> String {
          format!("{} tıklandı", self.etiket)
      }
  }

  impl Ciz for Dugme {
      fn ciz(&self) -> String {
          format!("[ {} ]", self.etiket)
      }
  }

  fn main() {
      let b: Box<dyn Ciz> = Box::new(Dugme { etiket: String::from("Gönder") });
      println!("{}", b.ciz());
      println!("{}", b.tikla());
  }
answer: false
error: E0599
explanation: |
  `b`'nin tipi `Box<dyn Ciz>`. Derleyici bu değer hakkında yalnızca bir şey biliyor: `Ciz`'i uyguluyor.
  İçinde bir `Dugme` olduğunu **bilmiyor**. Bu yüzden `b` üzerinde yalnızca `Ciz` trait'inin metotlarını
  çağırabilirsin; `tikla` gibi `Dugme`'ye özgü metotlar görünmez olur.
```

:::error
```text
error[E0599]: no method named `tikla` found for struct `Box<dyn Ciz>` in the current scope
  --> src/main.rs:24:22
   |
24 |     println!("{}", b.tikla());
   |                      ^^^^^ method not found in `Box<dyn Ciz>`
```
Mesajdaki tip önemli: `Dugme` değil `Box<dyn Ciz>`. Bir trait nesnesi üzerinden yalnızca trait'in
sözleşmesine erişirsin. Somut tipe ihtiyacın varsa ya trait'e bir metot eklersin ya da trait nesnesi
yerine bir enum kullanırsın (3. ders). `Any` ile somut tipi geri sorgulamak da mümkün, ama o bir kaçış
kapısıdır (yine 3. derste).
:::

:::analogy Kargo kolisi ve kullanım kılavuzu
Bir kargo deposu düşün. Raflarda her boyutta koli var: içinde süpürge, kahve makinesi ya da matkap
olabilir. Depo görevlisi kolilerin içini bilmez ve bilmesine gerek yoktur. Her kolinin üstünde iki şey
yazar: **ürünün durduğu raf adresi** ve **o ürüne ait kullanım kılavuzunun adresi**. “Çalıştır” komutu
gelince görevli kılavuza bakar ve o modelin “çalıştır” tuşuna basar.

Trait nesnesi de böyledir: verinin adresi + o tipe ait “kılavuz”un (vtable) adresi. Görevli yalnızca
kılavuzda yazan işlemleri yapabilir. Süpürgenin özel “hortum uzat” tuşu kılavuzda yoksa, görevli onu
bulamaz (E0599).
:::

## &dyn Trait ve trait nesnesinin diğer biçimleri

Trait nesnesi her zaman bir **işaretçinin arkasında** durur. `Box<dyn Ciz>` sahip olan biçimdir; sadece
ödünç almak istiyorsan `&dyn Ciz`, değiştirmek istiyorsan `&mut dyn Ciz` yazarsın:

```rust
use std::rc::Rc;

trait Ciz {
    fn ciz(&self) -> String;
}

trait Sayac {
    fn artir(&mut self);
    fn deger(&self) -> u32;
}

struct Dugme {
    etiket: String,
}

impl Ciz for Dugme {
    fn ciz(&self) -> String {
        format!("[ {} ]", self.etiket)
    }
}

struct TiklamaSayaci {
    adet: u32,
}

impl Sayac for TiklamaSayaci {
    fn artir(&mut self) {
        self.adet += 1;
    }
    fn deger(&self) -> u32 {
        self.adet
    }
}

// ödünç alan trait nesnesi: sahiplik almaz, kopyalamaz
fn cerceveli(b: &dyn Ciz) -> String {
    let ic = b.ciz();
    let cizgi = "-".repeat(ic.chars().count());
    format!("{cizgi}\n{ic}\n{cizgi}")
}

// değiştiren trait nesnesi
fn uc_kez_tikla(s: &mut dyn Sayac) {
    for _ in 0..3 {
        s.artir();
    }
}

fn main() {
    let d = Dugme { etiket: String::from("Kaydet") };
    println!("{}", cerceveli(&d)); // &Dugme → &dyn Ciz kendiliğinden

    let mut sayac = TiklamaSayaci { adet: 0 };
    uc_kez_tikla(&mut sayac);
    println!("Tıklama: {}", sayac.deger());

    // paylaşılan sahiplik (Modül 17): iki liste aynı bileşeni tutuyor
    let ortak: Rc<dyn Ciz> = Rc::new(Dugme { etiket: String::from("Çıkış") });
    let ust_menu = vec![Rc::clone(&ortak)];
    let alt_menu = vec![Rc::clone(&ortak)];
    println!("{} {} (sahip sayısı: {})", ust_menu[0].ciz(), alt_menu[0].ciz(), Rc::strong_count(&ortak));
}
```

`cerceveli(&d)` çağrısında `&Dugme` kendiliğinden `&dyn Ciz`'e dönüştü. `Box<dyn ...>`, `&dyn ...`,
`&mut dyn ...`, `Rc<dyn ...>`, `Arc<dyn ...>`: hepsi aynı fikrin farklı sahiplik biçimleridir. Hangisini
seçeceğine, Modül 4-5 ve 17'de öğrendiğin sahiplik sorusu karar verir: *sahip mi olacağım, ödünç mü
alacağım, paylaşacak mıyım?*

Peki neden çıplak bir `dyn Ciz` değişkeni tutamıyoruz?

```quiz
question: "`let b: dyn Ciz = Dugme { .. };` satırı neden derlenmez?"
options:
  - "`dyn` yalnızca `Box` ile birlikte kullanılabilen özel bir sözdizimidir"
  - "`dyn Ciz`'in boyutu derleme zamanında bilinmez (bir `Dugme` 24 bayt, bir `Yildiz` 8 bayt olabilir); stack'teki her değişkenin boyutu ise bilinmek zorundadır"
  - "`Dugme`'nin `Ciz`'i uyguladığı derleme zamanında kontrol edilemez"
  - Trait nesneleri yalnızca heap'te yaşayabilir
answer: 1
explanation: |
  Derleyici her yerel değişken için stack'te sabit bir yer ayırmak zorunda. `dyn Ciz` ise “*`Ciz`'i
  uygulayan herhangi bir şey*” demek, yani boyutu tipe göre değişir. Böyle tiplere **dinamik boyutlu tip
  (dynamically sized type, DST)** denir; `str` ve `[T]` da öyledir. Bu yüzden `&str` ve `&[T]` kullanıyorduk
  (Modül 5). Hata: `E0277: the size for values of type dyn Ciz cannot be known at compilation time`.
  Çözüm: boyutu belli bir işaretçi: `&dyn Ciz`, `Box<dyn Ciz>`. (`Sized` trait'ini Modül 22'de
  inceleyeceğiz.)
feedback:
  - "`&dyn`, `Rc<dyn>`, `Arc<dyn>` da geçerlidir; `Box` zorunlu değil."
  - Doğru!
  - Derleyici bunu kontrol eder; sorun boyut.
  - "`&dyn Ciz` stack'teki bir değeri de gösterebilir (yukarıdaki `cerceveli(&d)` gibi); heap şart değil."
```

```fill
prompt: |
  `rapor` fonksiyonu herhangi bir `Ciz` uygulayıcısını **ödünç alarak** çizsin; `liste` ise sahip olduğu
  karışık bileşenleri tutsun. Boşlukları doldur.
code: |
  trait Ciz {
      fn ciz(&self) -> String;
  }

  struct Dugme;
  struct Cizgi;

  impl Ciz for Dugme {
      fn ciz(&self) -> String {
          String::from("[ OK ]")
      }
  }

  impl Ciz for Cizgi {
      fn ciz(&self) -> String {
          String::from("------")
      }
  }

  fn rapor(b: ___0) -> String {
      format!("> {}", b.ciz())
  }

  fn main() {
      let liste: Vec<___1> = vec![Box::new(Cizgi), Box::new(Dugme)];
      for b in &liste {
          println!("{}", rapor(b.as_ref()));
      }
  }
blanks:
  - ["&dyn Ciz", "&(dyn Ciz)"]
  - ["Box<dyn Ciz>"]
output: |
  > ------
  > [ OK ]
explanation: |
  `rapor` ödünç aldığı için `&dyn Ciz` alıyor; `liste` ise elemanlarına sahip olduğu için
  `Vec<Box<dyn Ciz>>`. `b.as_ref()` bir `&Box<dyn Ciz>`'den içteki `&dyn Ciz`'i çıkarır. (Deref zorlaması
  sayesinde `rapor(b)` da çoğu durumda çalışırdı. Modül 17'den hatırla: `&Box<T>` → `&T`.)

  `&impl Ciz` yazsaydın kod **derlenmezdi**: `impl Ciz` gizli bir generic `T`'dir ve generic parametreler
  varsayılan olarak boyutu bilinen (`Sized`) tipleri kabul eder; `dyn Ciz` ise öyle değildir (az önceki
  soru). Bu kısıtın nasıl gevşetildiğini (`?Sized`) Modül 22'de göreceğiz.
```

## Bellekte bir trait nesnesi: geniş işaretçi ve vtable

Bir `&dyn Ciz`, sıradan bir `&Dugme`'den farklı mı? Tahmin et (64 bitlik bir makinede bir işaretçi 8
bayttır):

```predict
code: |
  use std::mem::size_of;

  trait Ciz {
      fn ciz(&self) -> String;
  }

  struct Dugme {
      etiket: String,
  }

  impl Ciz for Dugme {
      fn ciz(&self) -> String {
          self.etiket.clone()
      }
  }

  fn main() {
      println!("{}", size_of::<&Dugme>());
      println!("{}", size_of::<&dyn Ciz>());
      println!("{}", size_of::<Box<dyn Ciz>>());
      println!("{}", size_of::<&str>());
      # let _ = Dugme { etiket: String::new() }.ciz();
  }
options:
  - |
    8
    8
    8
    8
  - |
    8
    16
    16
    16
  - |
    8
    16
    8
    16
  - |
    24
    24
    24
    16
answer: 1
explanation: |
  `&Dugme` sıradan (ince) bir işaretçidir: 8 bayt. `&dyn Ciz` ve `Box<dyn Ciz>` ise **geniş işaretçidir
  (fat pointer)**: iki kelime, 16 bayt. Birinci kelime verinin adresi, ikincisi o tipe ait **vtable**'ın
  adresi. `&str` de geniş bir işaretçidir (Modül 5), ama ikinci kelimesi vtable değil **uzunluktur**.
  (`std::mem::size_of::<T>()` bir tipin bayt cinsinden boyutunu verir.)
```

**vtable (virtual method table)**, derleyicinin her “*tip + trait*” çifti için **bir kez** ürettiği,
programın salt okunur statik belleğinde duran küçük bir tablodur. İçinde şunlar vardır:

- değeri yok etmek için çağrılacak `drop` fonksiyonunun adresi,
- tipin boyutu ve hizalaması (`size`, `align`),
- trait'in her metodu için o tipe ait fonksiyonun adresi (`Dugme`'nin `ciz`'i, `Metin`'in `ciz`'i...).

`b.ciz()` çağrısı perde arkasında şuna dönüşür: “*vtable'daki `ciz` satırından fonksiyon adresini oku,
o fonksiyonu veri işaretçisiyle çağır.*” Adım adım:

```memory
title: Sıradan değer, &dyn ve Box<dyn>
steps:
  - caption: "Sıradan bir `Dugme`: stack'te yalnızca `String` başlığı var. Değerin içinde vtable **yok**; ek maliyet sıfır."
    stack:
      - frame: main
        vars:
          - { name: d, type: Dugme, value: "etiket: ptr · len=6 · cap=6", to: h1 }
    heap:
      - { id: h1, value: "K a y d e t" }
  - caption: "`let r: &dyn Ciz = &d;` → `r` iki kelimedir: `d`'nin adresi + `Dugme as Ciz` vtable'ının adresi."
    stack:
      - frame: main
        vars:
          - { name: d, type: Dugme, value: "etiket: ptr · len=6 · cap=6", to: h1 }
          - { name: r, type: "&dyn Ciz", value: "veri ptr · vtable ptr", to: d, note: "16 bayt" }
    heap:
      - { id: h1, value: "K a y d e t" }
      - { id: vt1, label: "vtable: Dugme as Ciz (statik bellek)", value: "drop · size=24 · align=8 · ciz → Dugme::ciz" }
  - caption: "`let b: Box<dyn Ciz> = Box::new(Metin { .. });` → veri heap'te; `b` yine iki kelime: heap adresi + `Metin as Ciz` vtable'ı. Her tipin **kendi** vtable'ı vardır."
    stack:
      - frame: main
        vars:
          - { name: d, type: Dugme, value: "etiket: ptr · len=6 · cap=6", to: h1 }
          - { name: r, type: "&dyn Ciz", value: "veri ptr · vtable ptr", to: d }
          - { name: b, type: "Box<dyn Ciz>", value: "veri ptr · vtable ptr", to: h2, note: "16 bayt" }
    heap:
      - { id: h1, value: "K a y d e t" }
      - { id: h2, label: "Metin (heap'te)", value: "icerik: ptr · len · cap" }
      - { id: vt1, label: "vtable: Dugme as Ciz (statik bellek)", value: "drop · size=24 · align=8 · ciz → Dugme::ciz" }
      - { id: vt2, label: "vtable: Metin as Ciz (statik bellek)", value: "drop · size=24 · align=8 · ciz → Metin::ciz" }
```

:::info C++ ile önemli bir fark
C++'ta sanal (`virtual`) metodu olan her nesnenin **içinde** gizli bir vtable işaretçisi (`vptr`) bulunur;
nesneyi hiç çok biçimli kullanmasan bile her nesne bu 8 baytı taşır. Rust'ta vtable adresi nesnenin
içinde değil, **işaretçinin** içindedir. Bir `Dugme` her zaman sadece `Dugme` kadar yer kaplar. Bedeli
yalnızca onu `dyn Ciz` olarak kullandığın yerde ödersin. Bu yüzden aynı tip, aynı anda hem statik hem
dinamik çok biçimli kullanılabilir.
:::

## Generic mi, trait nesnesi mi?

İkisi de çok biçimlilik sağlar ama farklı sorulara cevap verir:

| | Generic (`T: Ciz`, `impl Ciz`) | Trait nesnesi (`dyn Ciz`) |
|---|---|---|
| Bir koleksiyondaki tipler | **Tek** tip (homojen) | **Karışık** tipler (heterojen) |
| Somut tip ne zaman belli? | Derleme zamanında | Çalışma zamanında |
| Metot çağrısı | Doğrudan, satır içine alınabilir (statik dispatch) | vtable üzerinden (dinamik dispatch) |
| Derlenmiş kod | Her tip için ayrı kopya (kod büyür) | Tek kopya |
| Somut tipe özgü metotlar | Kullanılabilir (`T`'nin sınırları kadar) | Yalnızca trait'in metotları |
| Trait'te kısıtlar | Yok | Trait **dyn uyumlu** olmalı (3. ders) |

Pratik kural: **önce generic düşün**. Gerçekten karışık tipleri bir arada tutman gerekiyorsa ya da derleme
zamanında bilinemeyen (eklenti, kullanıcı tanımlı, ayardan seçilen) tiplerle çalışıyorsan `dyn` kullan.
İkisini birleştirmek de çok yaygındır. Dışarıya generic, rahat bir API açıp içeride kutularsın:

```rust
trait Ciz {
    fn ciz(&self) -> String;
}

struct Dugme(&'static str);
struct Bosluk;

impl Ciz for Dugme {
    fn ciz(&self) -> String {
        format!("[{}]", self.0)
    }
}

impl Ciz for Bosluk {
    fn ciz(&self) -> String {
        String::from("   ")
    }
}

struct Satir {
    parcalar: Vec<Box<dyn Ciz>>,
}

impl Satir {
    fn new() -> Satir {
        Satir { parcalar: Vec::new() }
    }

    // generic giriş: çağıran Box::new yazmak zorunda kalmaz
    fn ekle(&mut self, parca: impl Ciz + 'static) -> &mut Satir {
        self.parcalar.push(Box::new(parca));
        self
    }

    fn ciz(&self) -> String {
        let mut s = String::new();
        for p in &self.parcalar {
            s.push_str(&p.ciz());
        }
        s
    }
}

fn main() {
    let mut satir = Satir::new();
    satir.ekle(Dugme("Geri")).ekle(Bosluk).ekle(Dugme("İleri"));
    println!("{}", satir.ciz());
}
```

`ekle` içindeki `+ 'static` ne işe yarıyor? Aşağıdaki “Derinlemesine” kutusu anlatıyor.

:::deep Box<dyn Trait> aslında Box<dyn Trait + 'static> demektir
Bir trait nesnesinin içindeki somut tip **referans** tutabilir (Modül 12): `struct Etiket<'a> { metin: &'a str }`.
Derleyici bu yüzden her trait nesnesine bir yaşam süresi sınırı ekler. Yazmazsan varsayılanlar devreye girer:
`Box<dyn Ciz>` → `Box<dyn Ciz + 'static>`, `&'a dyn Ciz` → `&'a (dyn Ciz + 'a)`. Yani `Vec<Box<dyn Ciz>>`
yalnızca ödünç veri **tutmayan** (ya da yalnızca `'static` veri tutan) bileşenleri kabul eder. Yerel bir
`String`'i ödünç alan `Etiket`'i koymaya çalışırsan derleyici bunu açıkça söyler:

```text
error[E0597]: `yazi` does not live long enough
   = note: due to object lifetime defaults, `Box<dyn Ciz>` actually means `Box<(dyn Ciz + 'static)>`
```
Çözümler: bileşenin veriye sahip olması (`String` tutması), ya da yapının yaşam süresini açıkça yazmak:
`struct Ekran<'a> { bilesenler: Vec<Box<dyn Ciz + 'a>> }`.

Aynı sözdizimiyle **ek trait'ler** de istenebilir: `Box<dyn Ciz + Send>` bu nesnenin başka bir thread'e
gönderilebileceğini garanti eder (Modül 18). `+` ile yalnızca `Send`, `Sync` gibi **otomatik (auto)**
trait'ler eklenebilir; `dyn Ciz + Debug` gibi iki normal trait'i birleştirmek için ortak bir üst trait
gerekir (supertrait'ler Modül 22'de).
:::

```quiz
question: |
  Hangi senaryoda trait nesnesi (`dyn`) kullanmak generic'ten **açıkça daha uygundur**?
options:
  - "Bir sıralama fonksiyonu yazıyorsun: `i32` listesi de `String` listesi de sıralanabilsin"
  - Bir müzik uygulamasında efekt zinciri: kullanıcı çalışma anında menüden “yankı”, “bozulma”, “ekolayzer” gibi efektleri istediği sırayla ekleyip çıkarıyor
  - "`Nokta<f64>` ve `Nokta<i32>` için aynı `uzaklik` metodunu yazmak"
  - "Bir `HashMap<String, u32>` içindeki değerlerin toplamını alan bir fonksiyon"
answer: 1
explanation: |
  Efekt zincirinde **karışık** tipler (Yanki, Bozulma, Ekolayzer...) tek bir listede, **çalışma zamanında**
  belirlenen bir sırayla tutuluyor; derleyici hangi tiplerin geleceğini bilemez. Bu tam olarak
  `Vec<Box<dyn Efekt>>` problemidir. Diğer seçeneklerde her çağrıda tek bir somut tip var ve derleme
  zamanında belli; generic'ler (ya da hiçbir soyutlama) hem daha hızlı hem daha esnektir.
feedback:
  - "Her çağrıda liste homojen: `Vec<i32>` ya da `Vec<String>`. Klasik generic problemi (`T: Ord`)."
  - Doğru!
  - Generic struct metotlarının işi (Modül 11).
  - Tek bir somut tip var; soyutlamaya bile gerek yok.
```

## Alıştırma: bildirim kanalları

```exercise
id: m20-l02-e-bildirim
title: Okul bildirim sistemi
difficulty: 3
prompt: |
  Bir okulun veli bilgilendirme sistemi; duyurular farklı **kanallardan** gönderiliyor. Her kanal `Kanal`
  trait'ini uygular. `Eposta` hazır; sen şunları yaz:

  **1) `Sms` için `Kanal`'ı uygula:**
  - `gonder` → `"SMS 05321234567: <mesaj>"` (numara alandan gelir).
  - `maliyet` → SMS her **160 karakterlik** parça için 25 kuruş tutar; kısmi parça tam sayılır ve boş mesaj
    bile 1 parçadır. Dikkat: *bayt* değil **karakter** say. `ş`, `ğ` gibi harfler UTF-8'de 2 bayttır (Modül 9).

  **2) Trait nesneleriyle çalışan iki fonksiyonu yaz:**
  - `toplu_gonder(kanallar, mesaj)`: her kanalın `gonder` çıktısını, **sırayı koruyarak** bir `Vec<String>`'e topla.
  - `toplam_maliyet(kanallar, mesaj)`: bütün kanalların maliyetlerinin toplamı (kuruş).

  Testler senin hiç görmediğin yeni bir kanal tipi de ekleyecek; fonksiyonların onunla da çalışmalı.
starter: |
  trait Kanal {
      fn gonder(&self, mesaj: &str) -> String;

      fn maliyet(&self, _mesaj: &str) -> u32 {
          0 // varsayılan: ücretsiz
      }
  }

  struct Eposta {
      adres: String,
  }

  impl Kanal for Eposta {
      fn gonder(&self, mesaj: &str) -> String {
          format!("E-posta {}: {mesaj}", self.adres)
      }
  }

  struct Sms {
      numara: String,
  }

  impl Kanal for Sms {
      fn gonder(&self, mesaj: &str) -> String {
          todo!()
      }

      fn maliyet(&self, mesaj: &str) -> u32 {
          todo!()
      }
  }

  fn toplu_gonder(kanallar: &[Box<dyn Kanal>], mesaj: &str) -> Vec<String> {
      todo!()
  }

  fn toplam_maliyet(kanallar: &[Box<dyn Kanal>], mesaj: &str) -> u32 {
      todo!()
  }

  fn main() {
      let kanallar: Vec<Box<dyn Kanal>> = vec![
          Box::new(Sms { numara: String::from("05321234567") }),
          Box::new(Eposta { adres: String::from("veli@ornek.com") }),
      ];
      let mesaj = "Yarın veli toplantısı var.";
      for satir in toplu_gonder(&kanallar, mesaj) {
          println!("{satir}");
      }
      println!("Maliyet: {} kuruş", toplam_maliyet(&kanallar, mesaj));
  }
solution: |
  trait Kanal {
      fn gonder(&self, mesaj: &str) -> String;

      fn maliyet(&self, _mesaj: &str) -> u32 {
          0 // varsayılan: ücretsiz
      }
  }

  struct Eposta {
      adres: String,
  }

  impl Kanal for Eposta {
      fn gonder(&self, mesaj: &str) -> String {
          format!("E-posta {}: {mesaj}", self.adres)
      }
  }

  struct Sms {
      numara: String,
  }

  impl Kanal for Sms {
      fn gonder(&self, mesaj: &str) -> String {
          format!("SMS {}: {mesaj}", self.numara)
      }

      fn maliyet(&self, mesaj: &str) -> u32 {
          let karakter = mesaj.chars().count();
          let parca = karakter.div_ceil(160).max(1);
          parca as u32 * 25
      }
  }

  fn toplu_gonder(kanallar: &[Box<dyn Kanal>], mesaj: &str) -> Vec<String> {
      kanallar.iter().map(|k| k.gonder(mesaj)).collect()
  }

  fn toplam_maliyet(kanallar: &[Box<dyn Kanal>], mesaj: &str) -> u32 {
      kanallar.iter().map(|k| k.maliyet(mesaj)).sum()
  }

  fn main() {
      let kanallar: Vec<Box<dyn Kanal>> = vec![
          Box::new(Sms { numara: String::from("05321234567") }),
          Box::new(Eposta { adres: String::from("veli@ornek.com") }),
      ];
      let mesaj = "Yarın veli toplantısı var.";
      for satir in toplu_gonder(&kanallar, mesaj) {
          println!("{satir}");
      }
      println!("Maliyet: {} kuruş", toplam_maliyet(&kanallar, mesaj));
  }
check: tests
tests: |
  fn sms() -> Sms {
      Sms { numara: String::from("05321234567") }
  }

  #[test]
  fn sms_metni_dogru() {
      assert_eq!(sms().gonder("Merhaba"), "SMS 05321234567: Merhaba");
  }

  #[test]
  fn sms_maliyeti_karakter_sayisina_gore() {
      assert_eq!(sms().maliyet("Merhaba"), 25, "Kısa mesaj 1 parça = 25 kuruş");
      assert_eq!(sms().maliyet(""), 25, "Boş mesaj bile 1 parça sayılır");
      assert_eq!(sms().maliyet(&"a".repeat(160)), 25, "Tam 160 karakter hâlâ 1 parça");
      assert_eq!(sms().maliyet(&"a".repeat(161)), 50, "161 karakter 2 parça = 50 kuruş");
      assert_eq!(
          sms().maliyet(&"ş".repeat(100)),
          25,
          "100 tane 'ş' 200 bayttır ama 100 KARAKTERDİR: len() değil chars().count() kullan"
      );
  }

  #[test]
  fn toplu_gonder_sirayi_korur() {
      let kanallar: Vec<Box<dyn Kanal>> = vec![
          Box::new(Eposta { adres: String::from("a@b.com") }),
          Box::new(sms()),
      ];
      assert_eq!(
          toplu_gonder(&kanallar, "Okul tatil"),
          vec!["E-posta a@b.com: Okul tatil", "SMS 05321234567: Okul tatil"],
          "Çıktılar kanalların sırasıyla gelmeli"
      );
      assert!(toplu_gonder(&[], "x").is_empty(), "Kanal yoksa liste boş olmalı");
  }

  struct Guvercin;

  impl Kanal for Guvercin {
      fn gonder(&self, mesaj: &str) -> String {
          format!("Güvercin: {mesaj}")
      }
      fn maliyet(&self, _mesaj: &str) -> u32 {
          1000
      }
  }

  #[test]
  fn yeni_kanal_tipi_eklenebilir() {
      let kanallar: Vec<Box<dyn Kanal>> = vec![
          Box::new(sms()),
          Box::new(Guvercin),
          Box::new(Eposta { adres: String::from("a@b.com") }),
          Box::new(sms()),
      ];
      let mesaj = "x".repeat(200);
      assert_eq!(toplam_maliyet(&kanallar, &mesaj), 1100, "50 + 1000 + 0 + 50 = 1100 kuruş");
      assert_eq!(toplu_gonder(&kanallar, "Selam")[1], "Güvercin: Selam");
  }
hints:
  - "Karakter sayısı için `mesaj.chars().count()`. Parça sayısı yukarı yuvarlanmış bölme: `(n + 159) / 160` ya da `n.div_ceil(160)`. Boş mesaj için en az 1: `.max(1)`."
  - "`kanallar` bir `&[Box<dyn Kanal>]`; `for k in kanallar { ... k.gonder(mesaj) ... }` ile her kutudaki nesnenin metodunu çağırabilirsin. Sonuçları bir `Vec`'e `push` et."
  - "Iterator'larla (Modül 14) tek satır: `kanallar.iter().map(|k| k.gonder(mesaj)).collect()` ve `kanallar.iter().map(|k| k.maliyet(mesaj)).sum()`."
explanation: |
  `toplu_gonder` ve `toplam_maliyet` hangi kanal tiplerinin var olduğunu **bilmiyor**; yalnızca `Kanal`
  sözleşmesini biliyor. Testteki `Guvercin` sen fonksiyonları yazdıktan sonra ortaya çıktı, yine de hiçbir
  değişiklik gerekmeden çalıştı. Trait nesnelerinin “açık tip kümesi” vaadi budur. Her `k.gonder(...)`
  çağrısı o elemanın vtable'ından doğru fonksiyonu bulur.

  Parametre tipi olarak `&Vec<Box<dyn Kanal>>` yerine `&[Box<dyn Kanal>]` (dilim) seçmek daha esnektir
  (Modül 5): dizi, `Vec` ya da bir parçası verilebilir; testteki `toplu_gonder(&[], "x")` de bu sayede
  çalışıyor.

  SMS maliyetinde `mesaj.len()` kullansaydın Türkçe karakterli mesajlar iki kat pahalı hesaplanırdı.
  Gerçek SMS sistemlerinde Türkçe karakterler mesajı başka bir kodlamaya geçirip parça boyunu 70'e de
  düşürebilir. Gerçek dünya her zaman biraz daha karışıktır!
```

## Özet

:::remember
- `dyn Trait` = “trait'i uygulayan, tipi çalışma zamanında belli olan bir değer”. Her zaman bir işaretçi
  arkasında: `Box<dyn T>` (sahip), `&dyn T` / `&mut dyn T` (ödünç), `Rc<dyn T>` / `Arc<dyn T>` (paylaşılan).
- `Vec<Box<dyn T>>` karışık (heterojen) koleksiyon kurar ve **açık** bir tip kümesini destekler: trait'i
  uygulayan her tip, sonradan bile, katılabilir.
- Trait nesnesi bir **geniş işaretçidir**: veri adresi + vtable adresi (16 bayt). vtable her *tip + trait*
  çifti için bir kez üretilir; nesnenin içinde vtable yoktur.
- Somut tip unutulur: yalnızca trait'in metotları çağrılabilir (`E0599`). `dyn` yazmamak → `E0782`.
- `Box<dyn T>` aslında `Box<dyn T + 'static>`'tır; `+ Send` gibi auto trait'ler eklenebilir.
- Önce generic düşün; karışık ya da çalışma zamanında belirlenen tipler için `dyn` kullan.
:::

```reflect
prompt: |
  Bir `Vec<Box<dyn Ciz>>` içindeki bir elemana `b.ciz()` dediğinde, doğru `ciz` fonksiyonu nasıl bulunur?
  Geniş işaretçiyi ve vtable'ı kullanarak adım adım anlat. Bu tasarımın C++'taki yaklaşımdan farkı ne?
answer: |
  `Box<dyn Ciz>` iki kelimelik bir geniş işaretçidir: birinci kelime heap'teki verinin adresi, ikincisi o
  verinin somut tipine (örneğin `Dugme`) ait `Ciz` vtable'ının adresi. `b.ciz()` çağrısında program
  vtable'daki `ciz` satırından fonksiyon adresini okur ve o fonksiyonu veri işaretçisiyle (`&self` olarak)
  çağırır. Böylece listedeki her eleman kendi tipinin metodunu çalıştırır.

  C++'ta vtable işaretçisi nesnenin içinde saklanır, her çok biçimli nesne bunu taşır. Rust'ta ise vtable
  adresi işaretçinin içindedir; değerin kendisi ek bir alan taşımaz ve maliyet yalnızca `dyn` olarak
  kullanıldığı yerde ödenir.
```

```flashcards
- front: "`Vec<T>` (generic) ile `Vec<Box<dyn Trait>>` arasındaki temel fark nedir?"
  back: "`Vec<T>`'nin bütün elemanları aynı somut tiptedir; `Vec<Box<dyn Trait>>` trait'i uygulayan farklı tipleri bir arada tutabilir."
- front: "`size_of::<&dyn Ciz>()` 64 bitlik makinede kaç bayttır? Neden?"
  back: "16 bayt: veri işaretçisi (8) + vtable işaretçisi (8). Bu bir geniş işaretçidir (fat pointer)."
- front: Bir vtable'da neler bulunur?
  back: "`drop` fonksiyonunun adresi, tipin boyutu ve hizalaması, trait'in her metodu için o tipe ait fonksiyonun adresi."
- front: "`let b: dyn Ciz = Dugme;` neden derlenmez?"
  back: "`dyn Ciz`'in boyutu derleme zamanında bilinmez (dinamik boyutlu tip); yerel değişkenlerin boyutu bilinmeli. `&dyn Ciz` ya da `Box<dyn Ciz>` kullan."
- front: "`Box<dyn Ciz>` üzerinde `Dugme`'ye özgü bir metodu çağırınca hangi hata gelir?"
  back: "`E0599: no method named ... found for struct Box<dyn Ciz>`, trait nesnesinde yalnızca trait'in metotları görünür."
- front: "`Box<dyn Ciz>` aslında hangi tipin kısaltmasıdır?"
  back: "`Box<dyn Ciz + 'static>` (varsayılan nesne yaşam süresi kuralı)."
- front: "`E0782: expected a type, found a trait` neyi düzeltmeni ister?"
  back: "Trait nesnesi tipinde `dyn` anahtar kelimesini eklemeyi: `Box<Ciz>` → `Box<dyn Ciz>`."
- front: Trait nesnesi kullanmak hangi durumda generic'ten daha uygundur?
  back: Karışık tipleri tek koleksiyonda tutmak ya da derleme zamanında bilinmeyen (açık küme, çalışma zamanında seçilen) tiplerle çalışmak gerektiğinde.
```
