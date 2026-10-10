---
id: m17-l04
title: "Rc<T> — paylaşılan sahiplik"
minutes: 21
type: lesson
objectives:
  - "Bir değerin birden çok sahibe ihtiyaç duyduğu durumları (paylaşılan liste kuyruğu, graf, ortak kayıt) tanıyıp `Rc<T>` ile modelleyebilmek"
  - "`Rc::clone`'un derin kopya değil sayaç artırımı olduğunu açıklayıp `Rc::strong_count` değerlerini önceden hesaplayabilmek"
  - "`Rc`'nin neden yalnızca paylaşılan (değişmez) erişim verdiğini `E0594` üzerinden açıklayabilmek"
  - "`Rc::ptr_eq` ile iki `Rc`'nin aynı değeri paylaşıp paylaşmadığını kontrol edebilmek"
keywords: [Rc, "Rc::new", "Rc::clone", strong_count, ptr_eq, paylaşılan sahiplik, referans sayımı, reference counting, E0594, make_mut]
---

Sahipliğin ilk kuralı "her değerin **tek** bir sahibi vardır" diyordu. Çoğu program için bu kural
mükemmeldir. Ama bazı yapılar doğası gereği **paylaşımlıdır**: bir şarkı birden çok çalma listesinde
bulunur, bir graf düğümüne birçok kenar ulaşır, birkaç nesne aynı ayar kaydını kullanır. Bunların hangisi
"asıl sahip"? Hiçbiri. Değer, **son kullanıcı** onu bırakana kadar yaşamalıdır.

Rust'ın bu soruna cevabı `Rc<T>`: **referans sayımlı (reference counted)** akıllı işaretçi.

## Tek sahip yetmediğinde

İki listenin aynı kuyruğu paylaşmasını istiyoruz: `b = 3 → (5 → 10)` ve `c = 4 → (5 → 10)`. Önceki
dersin `Box`'lı listesiyle dene:

```compiles
code: |
  enum Liste {
      Dugum(i32, Box<Liste>),
      Bos,
  }

  use Liste::{Bos, Dugum};

  fn main() {
      let a = Dugum(5, Box::new(Dugum(10, Box::new(Bos))));
      let _b = Dugum(3, Box::new(a));
      let _c = Dugum(4, Box::new(a));
  }
answer: false
error: E0382
explanation: |
  `Box::new(a)` `a`'yı kutunun içine **taşır**; `a`'nın yeni ve tek sahibi `_b`'nin kutusudur. İkinci kez
  `Box::new(a)` demek, taşınmış bir değeri kullanmaktır. `Box` tek sahip demektir; iki listenin aynı
  kuyruğa **sahip** olması mümkün değil.
```

:::error
```text
error[E0382]: use of moved value: `a`
  --> src/main.rs:11:32
   |
 9 |     let a = Dugum(5, Box::new(Dugum(10, Box::new(Bos))));
   |         - move occurs because `a` has type `Liste`, which does not implement the `Copy` trait
10 |     let _b = Dugum(3, Box::new(a));
   |                                - value moved here
11 |     let _c = Dugum(4, Box::new(a));
   |                                ^ value used here after move
```
Derleyici `Liste`'ye `Clone` eklemeyi de önerir. Bu çalışır ama kuyruğun **iki ayrı kopyası** olur, yani
paylaşım olmaz. Kuyrukta bir milyon eleman olsaydı bir milyonu da kopyalanırdı.
:::

Referanslarla (`&Liste`) yazmak da mümkün ama o zaman her şeyin yaşam süresini (Modül 12) elle
ayarlaman ve kuyruğun listelerden **daha uzun** yaşamasını garanti etmen gerekir. Çoğu zaman kimin en
son biteceğini derleme zamanında bilemeyiz bile.

:::analogy Toplantı odasındaki projektör
Bir toplantı odasında projektör, içeride en az bir kişi olduğu sürece açık kalır. Kapıdaki sayaç kaç
kişinin içeride olduğunu tutar: biri girince artar, biri çıkınca azalır. Sayaç **sıfıra** indiğinde son
çıkan projektörü kapatır. Kimse "projektörün sahibi benim" demez; sorumluluk paylaşılır ve son kişiye
kalır. `Rc` tam olarak bu sayacı tutar.
:::

## Rc::new ve Rc::clone

```rust
use std::rc::Rc;

#[derive(Debug)]
enum Liste {
    Dugum(i32, Rc<Liste>),
    Bos,
}

use Liste::{Bos, Dugum};

fn toplam(liste: &Liste) -> i32 {
    match liste {
        Dugum(deger, kalan) => deger + toplam(kalan), // &Rc<Liste> → &Liste (deref zorlaması)
        Bos => 0,
    }
}

fn main() {
    let a = Rc::new(Dugum(5, Rc::new(Dugum(10, Rc::new(Bos)))));
    let b = Dugum(3, Rc::clone(&a)); // a'nın kuyruğunu PAYLAŞ, kopyalama
    let c = Dugum(4, Rc::clone(&a));
    println!("b = {b:?}, toplam {}", toplam(&b));
    println!("c = {c:?}, toplam {}", toplam(&c));
    println!("a'nın sahip sayısı: {}", Rc::strong_count(&a));
}
```

```memory
title: Paylaşılan kuyruk
steps:
  - caption: "`a`, `b` ve `c` aynı heap düğümünü gösterir. Düğümün yanında `Rc`'nin tuttuğu **sayaç** var: 3 sahip."
    stack:
      - frame: main
        vars:
          - { name: a, type: "Rc<Liste>", value: "ptr", to: h1 }
          - { name: b, type: Liste, value: "Dugum(3, ptr)", to: h1 }
          - { name: c, type: Liste, value: "Dugum(4, ptr)", to: h1 }
    heap:
      - { id: h1, value: "strong=3 · Dugum(5, ptr)", label: "Rc kutusu", to: h2 }
      - { id: h2, value: "strong=1 · Dugum(10, ptr)", label: "Rc kutusu" }
```

İki şeye dikkat et:

1. **`Rc::clone(&a)` derin kopya yapmaz.** Heap'teki veriye dokunmaz; yalnızca sayacı bir artırır ve
   aynı adresi gösteren yeni bir `Rc` verir. Maliyeti bir tamsayı artırımıdır.
2. `a.clone()` yazmak da **aynı şeyi** yapar. Ama Rust topluluğu bilinçli olarak `Rc::clone(&a)` yazar:
   kodu okuyan kişi "bu ucuz bir sayaç artırımı, pahalı bir derin kopya değil" diye hemen anlar. Performans
   sorunu ararken `.clone()` çağrılarına bakarsın, `Rc::clone`'ları atlayabilirsin.

Bir `Rc<T>`'nin heap'teki kutusunda değerin yanında iki sayaç durur: **güçlü (strong)** sayaç (sahip
sayısı) ve **zayıf (weak)** sayaç (son derste göreceğiz). Stack'teki `Rc` ise `Box` gibi tek bir adrestir.
`Rc<T>` de `Deref<Target = T>` uygular; bu yüzden `*a`, `a.metot()` ve deref zorlaması aynen çalışır.

```predict
code: |
  use std::rc::Rc;

  fn main() {
      let ayar = Rc::new(String::from("koyu tema"));
      let kopyalar: Vec<Rc<String>> = (0..3).map(|_| Rc::clone(&ayar)).collect();
      println!("{} {}", Rc::strong_count(&ayar), kopyalar.len());
      println!("{}", kopyalar[2].to_uppercase());
  }
options:
  - |
    4 3
    KOYU TEMA
  - |
    1 3
    KOYU TEMA
  - |
    3 3
    KOYU TEMA
  - Derlenmez, çünkü `ayar` closure'a taşınır
answer: 0
explanation: |
  Modül 14'teki iterator zinciri her adımda `Rc::clone(&ayar)` çağırır: 3 yeni sahip + `ayar`'ın kendisi =
  **4**. Closure `ayar`'ı yalnızca **ödünç** alır (`&ayar`), taşımaz. `kopyalar[2]` bir `Rc<String>`'dir;
  `to_uppercase` çağrısı auto-deref ile `String`'in (aslında `str`'in) metoduna ulaşır. Bu sırada heap'te
  hâlâ **tek bir** `String` vardır.
```

## Sayaç nasıl değişir?

Her `Rc` drop edildiğinde sayaç bir azalır. Sayaç sıfıra indiği an değer de drop edilir. Görmek için
değere bir `Drop` ekleyelim (önceki ders):

```predict
code: |
  use std::rc::Rc;

  struct Projektor;

  impl Drop for Projektor {
      fn drop(&mut self) {
          println!("projektör kapandı");
      }
  }

  fn main() {
      let ali = Rc::new(Projektor);
      println!("1) {}", Rc::strong_count(&ali));
      {
          let _ayse = Rc::clone(&ali);
          let _can = Rc::clone(&ali);
          println!("2) {}", Rc::strong_count(&ali));
      }
      println!("3) {}", Rc::strong_count(&ali));
      drop(ali);
      println!("4) toplantı bitti");
  }
options:
  - |
    1) 1
    2) 3
    3) 1
    projektör kapandı
    4) toplantı bitti
  - |
    1) 1
    2) 3
    projektör kapandı
    3) 1
    4) toplantı bitti
  - |
    1) 1
    2) 3
    3) 3
    4) toplantı bitti
    projektör kapandı
  - |
    1) 0
    2) 2
    3) 0
    projektör kapandı
    4) toplantı bitti
answer: 0
explanation: |
  `Rc::new` sayacı **1** ile başlatır (`ali` ilk sahiptir, 0 değil). İç blokta iki klon → 3. Blok bitince
  `_can` ve `_ayse` drop edilir, sayaç 1'e iner; ama değer **yaşamaya devam eder**, çünkü hâlâ bir sahip
  var. `drop(ali)` son sahibi bırakır, sayaç 0 olur ve `Projektor`'un `drop`'u tam o an çalışır: "4)"ten
  **önce**.
```

```memory
title: Sayacın yolculuğu
steps:
  - caption: "`Rc::new`: tek sahip, sayaç 1."
    stack:
      - frame: main
        vars:
          - { name: ali, type: "Rc<Projektor>", value: "ptr", to: h1 }
    heap:
      - { id: h1, value: "strong=1 · Projektor" }
  - caption: "İç blokta iki `Rc::clone`: üç `Rc` aynı kutuyu gösterir, sayaç 3."
    stack:
      - frame: main
        vars:
          - { name: ali, type: "Rc<Projektor>", value: "ptr", to: h1 }
          - { name: _ayse, type: "Rc<Projektor>", value: "ptr", to: h1 }
          - { name: _can, type: "Rc<Projektor>", value: "ptr", to: h1 }
    heap:
      - { id: h1, value: "strong=3 · Projektor" }
  - caption: "Blok bitti: iki klon drop edildi, sayaç 1. Değer hâlâ yaşıyor."
    stack:
      - frame: main
        vars:
          - { name: ali, type: "Rc<Projektor>", value: "ptr", to: h1 }
    heap:
      - { id: h1, value: "strong=1 · Projektor" }
  - caption: "`drop(ali)`: sayaç 0, değer drop edildi ve heap kutusu serbest bırakıldı."
    stack:
      - frame: main
        vars:
          - { name: ali, type: "Rc<Projektor>", value: "ptr", moved: true, note: drop edildi }
    heap:
      - { id: h1, value: "strong=0 · Projektor", freed: true }
```

:::info Diğer dillerle karşılaştırma
- **C++**'taki `std::shared_ptr<T>` aynı fikirdir (`use_count()` = `strong_count`).
- **Python** ve **Swift** bellek yönetimini temelde referans sayımıyla yapar. Python bunu her nesne için
  otomatik ve görünmez biçimde yapar.
- Rust'ta referans sayımı **isteğe bağlıdır**: yalnızca `Rc` yazdığın yerde maliyetini ödersin; geri kalan
  her şey hâlâ sayaçsız, sıfır maliyetli sahiplikle çalışır.
:::

## Rc yalnızca paylaşılan okuma verir

Birden çok sahip varsa, içerideki değeri değiştirmek mümkün mü? Tahmin et:

```compiles
code: |
  use std::rc::Rc;

  fn main() {
      let sayac = Rc::new(0);
      let diger = Rc::clone(&sayac);
      *diger += 1;
      println!("{sayac}");
  }
answer: false
error: E0594
explanation: |
  `Rc<T>` yalnızca `Deref` uygular, `DerefMut` uygulamaz (2. ders). Yani bir `Rc` sana içerideki
  değere en fazla bir **`&T`** verir. Sebep Modül 5'in temel kuralı: aynı veriye birden çok yol (sahip)
  varken birinin değiştirmesine izin vermek, diğerlerinin ayağının altındaki halıyı çekmek demektir.
```

:::error
```text
error[E0594]: cannot assign to data in an `Rc`
 --> src/main.rs:6:5
  |
6 |     *diger += 1;
  |     ^^^^^^^^^^^ cannot assign
  |
  = help: trait `DerefMut` is required to modify through a dereference, but it is not implemented for `Rc<i32>`
```
2. dersteki E0596'nın kardeşi: "açarak değiştirmek için `DerefMut` gerekir ve `Rc`'de yok."
:::

Bu bir eksiklik değil, bilinçli bir tasarım: `Rc` = **paylaşım**, paylaşım = **salt okuma**. Paylaşılan bir
değeri değiştirmen gerekiyorsa `Rc`'yi bir sonraki dersin aracıyla birleştirirsin: `Rc<RefCell<T>>`.

:::deep Rc::get_mut ve Rc::make_mut
İki yardımcı, "değiştirme" ihtiyacını güvenli biçimde çözer:

- `Rc::get_mut(&mut rc)` → `Option<&mut T>`: **yalnızca tek sahip varsa** (`strong_count == 1`)
  `Some(&mut T)` verir; aksi hâlde `None`. Kimse görmüyorsa değiştirmek güvenlidir.
- `Rc::make_mut(&mut rc)` → `&mut T`: tek sahip varsa doğrudan verir; değilse değeri **klonlar**, bu `Rc`'yi
  yeni kopyaya bağlar ve onu verir. Buna **yazınca kopyala (clone-on-write)** denir.

```rust
use std::rc::Rc;

fn main() {
    let mut a = Rc::new(vec![1, 2]);
    let b = Rc::clone(&a);
    Rc::make_mut(&mut a).push(3); // b de paylaştığı için önce kopyalanır
    println!("{a:?} {b:?}"); // [1, 2, 3] [1, 2]
}
```
:::

`Rc`'nin bilmen gereken üç sınırı daha var:

| Konu | Açıklama |
|---|---|
| **Tek thread** | Sayaç sıradan (atomik olmayan) bir tamsayıdır. Bu yüzden `Rc` thread'ler arasında gönderilemez; derleyici bunu engeller. Çok thread için atomik sayaçlı `Arc<T>` vardır (Modül 18). |
| **Maliyet** | `Rc::new` bir heap tahsisi yapar. Her klon ve drop bir sayaç güncellemesidir. Her erişim bir adres takibidir. Küçük ama sıfır değil. |
| **Kimlik** | `Rc::ptr_eq(&a, &b)`: iki `Rc` **aynı** değeri mi paylaşıyor? `a == b` ise içerikleri karşılaştırır (değerler eşit mi?). |

```quiz
question: |
  `let a = Rc::new(String::from("ankara")); let b = Rc::new(String::from("ankara")); let c = Rc::clone(&a);`
  Bu satırlardan sonra hangisi **yanlıştır**?
options:
  - "`a == b` ifadesi `true`'dur"
  - "`Rc::ptr_eq(&a, &c)` ifadesi `true`'dur"
  - "`Rc::ptr_eq(&a, &b)` ifadesi `true`'dur"
  - "`Rc::strong_count(&a)` değeri 2'dir"
answer: 2
explanation: |
  `a` ve `b` iki ayrı `Rc::new` çağrısıyla oluşturuldu: heap'te **iki ayrı** `"ankara"` var. İçerikleri
  eşit olduğu için `a == b` doğrudur (karşılaştırma `Deref` ile içteki `String`'lere iner). Ama aynı
  değeri **paylaşmazlar**, bu yüzden `ptr_eq` false döner. `c` ise `a`'nın klonudur: aynı kutu, sayaç 2.
feedback:
  - "Bu doğru: `==` içerikleri karşılaştırır ve ikisi de \"ankara\"."
  - "Bu doğru: `c`, `a`'nın klonu; aynı kutuyu gösterirler."
  - "Doğru tespit! Ayrı `Rc::new` = ayrı kutu; `ptr_eq` false."
  - "Bu doğru: `a` ve `c`, iki sahip."
```

## Pratik: paylaşılan şarkılar

Bir müzik uygulamasında aynı şarkı birçok çalma listesinde bulunabilir. Şarkının verisini (ad, sanatçı,
belki büyük bir kapak resmi) her listeye kopyalamak yerine paylaşalım:

```rust
use std::rc::Rc;

#[derive(Debug)]
struct Sarki {
    ad: String,
    sanatci: String,
}

struct CalmaListesi {
    ad: String,
    sarkilar: Vec<Rc<Sarki>>,
}

impl CalmaListesi {
    fn yeni(ad: &str) -> Self {
        CalmaListesi { ad: ad.to_string(), sarkilar: Vec::new() }
    }

    fn ekle(&mut self, sarki: &Rc<Sarki>) {
        self.sarkilar.push(Rc::clone(sarki));
    }
}

fn main() {
    let sarki = Rc::new(Sarki {
        ad: String::from("Uzun İnce Bir Yoldayım"),
        sanatci: String::from("Âşık Veysel"),
    });

    let mut sabah = CalmaListesi::yeni("Sabah");
    let mut yolculuk = CalmaListesi::yeni("Yolculuk");
    sabah.ekle(&sarki);
    yolculuk.ekle(&sarki);

    for liste in [&sabah, &yolculuk] {
        println!("{}: {} şarkı", liste.ad, liste.sarkilar.len());
    }
    println!("'{}' ({}) {} yerde kayıtlı", sarki.ad, sarki.sanatci, Rc::strong_count(&sarki));
    drop(sabah);
    println!("sabah listesi silindi, şimdi {} yerde", Rc::strong_count(&sarki));
}
```

`ekle`'nin `&Rc<Sarki>` alması bilinçli: çağıran kendi `Rc`'sini korur, fonksiyon ihtiyaç duyduğu kadar
klonlar. `Rc<Sarki>` (sahiplikle) alsaydı, çağıran her seferinde `Rc::clone` yazmak zorunda kalırdı.

```fill
prompt: |
  Bir şirketteki birkaç rapor, aynı `Sirket` bilgisini paylaşıyor. Boşlukları doldur. Program
  `2 rapor, Ekin Yazılım: 3 sahip` yazdırmalı.
code: |
  use std::rc::Rc;

  struct Sirket {
      ad: String,
  }

  struct Rapor {
      sirket: Rc<Sirket>,
  }

  fn main() {
      let sirket = ___0(Sirket { ad: String::from("Ekin Yazılım") });
      let raporlar = vec![
          Rapor { sirket: Rc::clone(&sirket) },
          Rapor { sirket: ___1 },
      ];
      println!(
          "{} rapor, {}: {} sahip",
          raporlar.len(),
          raporlar[0].sirket.ad,
          ___2(&sirket)
      );
  }
blanks:
  - ["Rc::new"]
  - ["Rc::clone(&sirket)", "sirket.clone()"]
  - ["Rc::strong_count"]
explanation: |
  `Rc::new` sayacı 1 ile başlatır, iki `Rc::clone` onu 3'e çıkarır. `raporlar[0].sirket.ad` ifadesinde
  `Rc<Sirket>`'ten `ad` alanına auto-deref ile ulaşılır. `sirket.clone()` de doğru çalışır, ama
  `Rc::clone(&sirket)` "bu ucuz bir klon" niyetini daha açık gösterir.
```

```exercise
id: m17-e-kutuphane-rc
title: Ortak kitaplar
difficulty: 3
prompt: |
  Kütüphanedeki her kitap rafta **tek bir** `Rc<Kitap>` olarak tutuluyor. Üyelerin okuma listeleri aynı
  kitapları **paylaşıyor** (kopyalamıyor). Üç fonksiyonu tamamla:

  - `Kutuphane::bul(&self, baslik) -> Option<Rc<Kitap>>`: başlığı eşleşen raf kitabının **paylaşılan**
    bir klonunu döndürür (yeni bir `Kitap` oluşturma!).
  - `okuyan_sayisi(kitap: &Rc<Kitap>) -> usize`: kitabı okuma listesine eklemiş üye sayısı. Kitap rafta
    durduğu için raftaki sahiplik **sayılmaz**.
  - `ortak_kitaplar(a: &Uye, b: &Uye) -> Vec<String>`: iki üyenin listesinde de bulunan **aynı fiziksel
    kitapların** başlıkları, `a`'nın listesindeki sırayla. Aynı başlıklı ama ayrı bir `Rc` (başka bir
    baskı) ortak sayılmaz; `Rc::ptr_eq` kullan.
starter: |
  use std::rc::Rc;

  struct Kitap {
      baslik: String,
  }

  struct Kutuphane {
      raf: Vec<Rc<Kitap>>,
  }

  struct Uye {
      okuma_listesi: Vec<Rc<Kitap>>,
  }

  impl Kutuphane {
      fn ekle(&mut self, baslik: &str) {
          self.raf.push(Rc::new(Kitap { baslik: baslik.to_string() }));
      }

      fn bul(&self, baslik: &str) -> Option<Rc<Kitap>> {
          todo!()
      }
  }

  fn okuyan_sayisi(kitap: &Rc<Kitap>) -> usize {
      todo!()
  }

  fn ortak_kitaplar(a: &Uye, b: &Uye) -> Vec<String> {
      todo!()
  }

  fn main() {
      let mut kutuphane = Kutuphane { raf: Vec::new() };
      kutuphane.ekle("Kürk Mantolu Madonna");
      kutuphane.ekle("Tutunamayanlar");

      let mut zeynep = Uye { okuma_listesi: Vec::new() };
      let mut emre = Uye { okuma_listesi: Vec::new() };
      if let Some(k) = kutuphane.bul("Kürk Mantolu Madonna") {
          zeynep.okuma_listesi.push(Rc::clone(&k));
          emre.okuma_listesi.push(k);
      }
      println!("okuyan: {}", okuyan_sayisi(&kutuphane.raf[0]));
      println!("ortak: {:?}", ortak_kitaplar(&zeynep, &emre));
  }
solution: |
  use std::rc::Rc;

  struct Kitap {
      baslik: String,
  }

  struct Kutuphane {
      raf: Vec<Rc<Kitap>>,
  }

  struct Uye {
      okuma_listesi: Vec<Rc<Kitap>>,
  }

  impl Kutuphane {
      fn ekle(&mut self, baslik: &str) {
          self.raf.push(Rc::new(Kitap { baslik: baslik.to_string() }));
      }

      fn bul(&self, baslik: &str) -> Option<Rc<Kitap>> {
          self.raf.iter().find(|k| k.baslik == baslik).map(Rc::clone)
      }
  }

  fn okuyan_sayisi(kitap: &Rc<Kitap>) -> usize {
      Rc::strong_count(kitap) - 1
  }

  fn ortak_kitaplar(a: &Uye, b: &Uye) -> Vec<String> {
      let mut ortak = Vec::new();
      for kitap in &a.okuma_listesi {
          if b.okuma_listesi.iter().any(|diger| Rc::ptr_eq(kitap, diger)) {
              ortak.push(kitap.baslik.clone());
          }
      }
      ortak
  }

  fn main() {
      let mut kutuphane = Kutuphane { raf: Vec::new() };
      kutuphane.ekle("Kürk Mantolu Madonna");
      kutuphane.ekle("Tutunamayanlar");

      let mut zeynep = Uye { okuma_listesi: Vec::new() };
      let mut emre = Uye { okuma_listesi: Vec::new() };
      if let Some(k) = kutuphane.bul("Kürk Mantolu Madonna") {
          zeynep.okuma_listesi.push(Rc::clone(&k));
          emre.okuma_listesi.push(k);
      }
      println!("okuyan: {}", okuyan_sayisi(&kutuphane.raf[0]));
      println!("ortak: {:?}", ortak_kitaplar(&zeynep, &emre));
  }
check: tests
tests: |
  fn ornek() -> Kutuphane {
      let mut k = Kutuphane { raf: Vec::new() };
      k.ekle("Kürk Mantolu Madonna");
      k.ekle("Tutunamayanlar");
      k.ekle("Saatleri Ayarlama Enstitüsü");
      k
  }

  #[test]
  fn bul_paylasilan_kitabi_dondurur() {
      let k = ornek();
      let bulunan = k.bul("Tutunamayanlar").expect("kitap rafta var");
      assert_eq!(bulunan.baslik, "Tutunamayanlar");
      assert!(Rc::ptr_eq(&bulunan, &k.raf[1]), "bul, raftaki kitabın klonunu döndürmeli, yeni bir Kitap oluşturmamalı");
      assert_eq!(Rc::strong_count(&k.raf[1]), 2, "raf + bulunan = 2 sahip");
  }

  #[test]
  fn olmayan_kitap() {
      assert!(ornek().bul("Yok Böyle Bir Kitap").is_none(), "rafta olmayan kitap için None");
  }

  #[test]
  fn okuyanlari_sayar() {
      let k = ornek();
      assert_eq!(okuyan_sayisi(&k.raf[0]), 0, "henüz kimse eklemedi");
      let a = Uye { okuma_listesi: vec![k.bul("Kürk Mantolu Madonna").unwrap()] };
      let b = Uye { okuma_listesi: vec![k.bul("Kürk Mantolu Madonna").unwrap()] };
      assert_eq!(okuyan_sayisi(&k.raf[0]), 2, "iki üyenin listesinde var");
      drop(a);
      assert_eq!(okuyan_sayisi(&k.raf[0]), 1, "bir üye ayrılınca sayı düşmeli");
      drop(b);
  }

  #[test]
  fn ortak_kitaplar_kimlige_bakar() {
      let k = ornek();
      let baska_baski = Rc::new(Kitap { baslik: String::from("Tutunamayanlar") });
      let a = Uye {
          okuma_listesi: vec![
              k.bul("Saatleri Ayarlama Enstitüsü").unwrap(),
              k.bul("Tutunamayanlar").unwrap(),
              k.bul("Kürk Mantolu Madonna").unwrap(),
          ],
      };
      let b = Uye {
          okuma_listesi: vec![
              k.bul("Kürk Mantolu Madonna").unwrap(),
              baska_baski,
              k.bul("Saatleri Ayarlama Enstitüsü").unwrap(),
          ],
      };
      assert_eq!(
          ortak_kitaplar(&a, &b),
          ["Saatleri Ayarlama Enstitüsü", "Kürk Mantolu Madonna"],
          "başka baskı ortak sayılmamalı; sıra a'nın listesine göre olmalı"
      );
      assert!(ortak_kitaplar(&a, &Uye { okuma_listesi: Vec::new() }).is_empty(), "boş listeyle ortak kitap yok");
  }
hints:
  - "`bul`: rafı dolaş, başlığı eşleşen kitabı bulunca `Some(Rc::clone(kitap))` döndür. Iterator'larla tek satır: `self.raf.iter().find(|k| k.baslik == baslik).map(Rc::clone)`."
  - "`okuyan_sayisi`: `Rc::strong_count(kitap)` bütün sahipleri sayar; raf da onlardan biri."
  - "`ortak_kitaplar`: `a`'nın her kitabı için `b.okuma_listesi.iter().any(|d| Rc::ptr_eq(kitap, d))` diye sor; doğruysa `kitap.baslik.clone()`'u sonuca ekle."
explanation: |
  `Rc` burada iki farklı soruya cevap veriyor. `strong_count` "bu kitabı kaç yer tutuyor?" sorusunu
  **sayaç** üzerinden yanıtlıyor (raf + üyeler, bu yüzden `- 1`). `ptr_eq` ise "bu iki kayıt **aynı**
  kitap mı?" sorusunu **adres** üzerinden yanıtlıyor. Başlıkları karşılaştırsaydık (`==`), son testteki
  "başka baskı" yanlışlıkla ortak sayılırdı.

  `.map(Rc::clone)`'da fonksiyonun adını doğrudan `map`'e verdik: `find` bir `Option<&Rc<Kitap>>`
  döndürür, `Rc::clone` da tam olarak `&Rc<T>` alıp `Rc<T>` döndürür. `.map(|k| Rc::clone(k))` ile
  aynıdır. Option'ın kendi `.cloned()` metodu da burada aynı işi görür.

  Dikkat: `okuyan_sayisi` gibi `strong_count`'a dayanan mantık kırılgandır. Kodun başka bir yerinde geçici
  bir klon tutulursa (örneğin bir değişkende `bul`'un sonucu), sayı bir fazla çıkar. Gerçek bir sistemde
  okuyanları açıkça saymak daha sağlam olurdu. `strong_count` en çok hata ayıklama ve testler içindir.
```

## Özet

:::remember
- `Rc<T>` (*reference counted*): bir değerin **birden çok sahibi** olmasını sağlar. Son sahip drop edilince değer de drop edilir.
- `Rc::new(x)` sayacı 1 ile başlatır. `Rc::clone(&a)` derin kopya **değildir**: sayacı artırır, aynı kutuyu paylaşır (`a.clone()` ile aynı, ama niyeti açık).
- `Rc::strong_count(&a)` sahip sayısını verir. `Rc::ptr_eq(&a, &b)` aynı kutu mu diye bakar; `==` içerikleri karşılaştırır.
- `Rc` yalnızca `Deref` uygular: içeriği **değiştiremezsin** (**E0594**). Değiştirmek için `Rc<RefCell<T>>` (sonraki ders) ya da `Rc::make_mut`.
- `Rc` tek thread içindir. Thread'ler arası paylaşım için `Arc<T>` (Modül 18).
:::

```reflect
prompt: Kendi cümlelerinle açıkla — `Rc<T>`, "her değerin tek bir sahibi vardır" kuralını çiğniyor mu? Bellek güvenliğini nasıl koruyor?
answer: |
  Model cevap: Bir anlamda kuralı esnetiyor ama güvenliği bozmuyor. Teknik olarak heap'teki değerin tek
  sahibi `Rc`'nin kutusudur; her `Rc` işaretçisi o kutunun "hissedarı" gibidir ve kutu, sayaç sıfıra
  inene kadar yaşar. Böylece hiçbir `Rc` serbest bırakılmış belleği gösteremez (use-after-free yok) ve
  bellek yalnızca bir kez serbest bırakılır (double free yok). Ayrıca `Rc` yalnızca paylaşılan `&T` erişimi
  verdiği için "birden çok yol varken değiştirme" de engellenir. Bedeli küçük bir çalışma zamanı maliyetidir:
  heap tahsisi ve sayaç güncellemeleri.
```

```flashcards
- front: "`Rc::clone(&a)` heap'teki değeri kopyalar mı?"
  back: "Hayır. Sayacı bir artırır ve aynı kutuyu gösteren yeni bir `Rc` döndürür. Maliyeti bir tamsayı artırımıdır."
- front: "`Rc::new(x)` hemen sonra `Rc::strong_count` kaçtır?"
  back: "1 — oluşturan değişken ilk sahiptir."
- front: "Neden `a.clone()` yerine `Rc::clone(&a)` yazılır?"
  back: "İkisi aynı işi yapar; `Rc::clone` okuyana \"bu ucuz bir sayaç artırımı, derin kopya değil\" niyetini açıkça gösterir."
- front: "`E0594: cannot assign to data in an Rc` neden olur?"
  back: "`Rc` yalnızca `Deref` (salt okuma) uygular, `DerefMut` uygulamaz; paylaşılan veri doğrudan değiştirilemez."
- front: "`Rc::ptr_eq(&a, &b)` ile `a == b` arasındaki fark nedir?"
  back: "`ptr_eq` aynı kutuyu (kimlik) paylaşıp paylaşmadıklarına bakar; `==` içteki değerleri (içerik) karşılaştırır."
- front: "`Rc` neden thread'ler arasında kullanılamaz, alternatifi nedir?"
  back: "Sayacı atomik değildir; aynı anda iki thread güncellerse bozulur. Alternatif: `Arc<T>` (Modül 18)."
- front: "Bir `Rc`'nin değeri ne zaman drop edilir?"
  back: "Son `Rc` drop edildiğinde, yani güçlü sayaç 0'a indiğinde."
```
