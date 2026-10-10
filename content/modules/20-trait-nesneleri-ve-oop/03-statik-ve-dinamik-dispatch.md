---
id: m20-l03
title: Statik ve dinamik dispatch
minutes: 22
type: lesson
objectives:
  - Statik dispatch (monomorphization) ile dinamik dispatch'in (vtable) performans ve kod boyutu bedellerini karşılaştırabilmek
  - Bir trait'in dyn uyumlu olup olmadığını kurallara bakarak söyleyebilmek ve `E0038` hatasını düzeltebilmek
  - "`where Self: Sized` ile bir metodu trait nesnelerinden hariç tutabilmek ve `kutu_kopyala` desenini uygulayabilmek"
  - Kapalı tip kümeleri için enum'u, açık kümeler için `dyn`'ı gerekçesiyle seçebilmek
keywords: [dispatch, statik dispatch, dinamik dispatch, monomorphization, vtable, dyn uyumluluğu, E0038, "where Self: Sized", Any, downcast]
---

Son iki derste çok biçimliliğin iki yolunu gördün: `impl Trait` / generic'ler ve `dyn Trait`. İkisi de
aynı programı yazdırıyor; peki makinede aynı şey mi oluyor? Hangisi hızlı, hangisi küçük? Ve neden
bazı trait'ler (mesela her gün kullandığın `Clone`) asla `dyn` olamıyor?

Bu dersin konusu **dispatch**: bir metot çağrısında **hangi fonksiyonun** çalışacağına karar verilmesi.
Karar derleme zamanında verilirse **statik**, çalışma zamanında verilirse **dinamik** dispatch denir.
Bu farkı bilmek, Rust'ta performanslı ve esnek API tasarlamanın anahtarıdır.

## Statik dispatch: her tip için ayrı bir kopya

Modül 11'den hatırla: generic bir fonksiyon, kullanıldığı her somut tip için ayrı ayrı derlenir. Buna
**monomorphization** demiştik. Önce bir hatırlatma sorusu:

```quiz
question: |
  (Modül 11 tekrarı) `fn yazdir<T: std::fmt::Display>(x: T)` fonksiyonu bir programda
  `yazdir(5)`, `yazdir(7)`, `yazdir("çay")` ve `yazdir(2.5)` olarak çağrılıyor. Derleyici `yazdir`'ın
  kaç farklı makine kodu kopyasını üretir?
options:
  - "1: generic fonksiyonun tek bir kopyası vardır, tip çalışma zamanında kontrol edilir"
  - "3: `i32`, `&str` ve `f64` için birer tane"
  - "4: her çağrı için bir tane"
  - "0: generic fonksiyonlar satır içine alınır, hiç kopya üretilmez"
answer: 1
explanation: |
  Monomorphization **tip başına** bir kopya üretir, çağrı başına değil. `5` ve `7` ikisi de `i32`, bu yüzden
  aynı `yazdir::<i32>` kopyasını kullanır. Toplam üç kopya: `yazdir::<i32>`, `yazdir::<&str>`,
  `yazdir::<f64>`. Her kopyada `x`'in tipi kesin olarak bilindiğinden, içerideki her metot çağrısı **doğrudan**
  doğru fonksiyona gider.
feedback:
  - Bu dinamik dispatch'in yaklaşımı; generic'ler böyle çalışmaz.
  - Doğru!
  - Aynı tip için aynı kopya yeniden kullanılır.
  - Satır içine alma (inlining) bir optimizasyondur ve kopyalar üretildikten sonra uygulanır; kopyalar yine de vardır.
```

Bir şekil uygulamasında bunun ne anlama geldiğine bakalım:

```rust
trait Sekil {
    fn alan(&self) -> f64;
}

struct Kare {
    kenar: f64,
}

struct Daire {
    yaricap: f64,
}

impl Sekil for Kare {
    fn alan(&self) -> f64 {
        self.kenar * self.kenar
    }
}

impl Sekil for Daire {
    fn alan(&self) -> f64 {
        3.14159 * self.yaricap * self.yaricap
    }
}

// statik dispatch: T her kopyada tek ve belli bir tip
fn toplam_alan<T: Sekil>(sekiller: &[T]) -> f64 {
    let mut toplam = 0.0;
    for s in sekiller {
        toplam += s.alan();
    }
    toplam
}

fn main() {
    let kareler = [Kare { kenar: 2.0 }, Kare { kenar: 3.0 }];
    let daireler = [Daire { yaricap: 1.0 }];
    println!("Kareler: {}", toplam_alan(&kareler));
    println!("Daireler: {:.2}", toplam_alan(&daireler));
}
```

Derleyici bu programdan kabaca şu iki fonksiyonu üretir (gerçek adlar daha karışıktır):

```text
fn toplam_alan_Kare(sekiller: &[Kare]) -> f64   { ... toplam += s.kenar * s.kenar ... }
fn toplam_alan_Daire(sekiller: &[Daire]) -> f64 { ... toplam += 3.14159 * s.yaricap * s.yaricap ... }
```

Dikkat et: `s.alan()` çağrısı ortadan kayboldu. Hangi `alan`'ın çağrılacağı belli olduğu için derleyici
fonksiyonun gövdesini çağrının yerine koyabildi. Buna **satır içine alma (inlining)** denir. Bu, statik
dispatch'in asıl gücüdür: inlining'den sonra döngü açma, vektörleştirme (SIMD) gibi başka optimizasyonların
da önü açılır. Modül 14'teki “sıfır maliyetli soyutlama (zero-cost abstraction)” vaadi tam olarak buradan
gelir.

## Dinamik dispatch: tek kopya, çalışma zamanında karar

Şimdi aynı işi trait nesneleriyle yapalım:

```rust
trait Sekil {
    fn alan(&self) -> f64;
}

struct Kare {
    kenar: f64,
}

struct Daire {
    yaricap: f64,
}

impl Sekil for Kare {
    fn alan(&self) -> f64 {
        self.kenar * self.kenar
    }
}

impl Sekil for Daire {
    fn alan(&self) -> f64 {
        3.14159 * self.yaricap * self.yaricap
    }
}

// dinamik dispatch: tek bir kopya, her eleman farklı tipte olabilir
fn toplam_alan(sekiller: &[Box<dyn Sekil>]) -> f64 {
    let mut toplam = 0.0;
    for s in sekiller {
        toplam += s.alan(); // vtable'dan fonksiyon adresini oku, onu çağır
    }
    toplam
}

fn main() {
    let karisik: Vec<Box<dyn Sekil>> = vec![
        Box::new(Kare { kenar: 2.0 }),
        Box::new(Daire { yaricap: 1.0 }),
        Box::new(Kare { kenar: 3.0 }),
    ];
    println!("Toplam: {:.2}", toplam_alan(&karisik));
}
```

Bu kez derleyici `toplam_alan`'ın **tek** bir kopyasını üretir. Döngüdeki `s.alan()` şuna dönüşür:

```text
fonksiyon = s.vtable.alan     // 1) geniş işaretçinin ikinci kelimesinden vtable'ı, oradan adresi oku
toplam += fonksiyon(s.veri)   // 2) dolaylı (indirect) çağrı: adres ancak çalışma anında belli
```

İki yaklaşımın bedelleri:

| | Statik dispatch (generic) | Dinamik dispatch (`dyn`) |
|---|---|---|
| Çağrı | Doğrudan; çoğu zaman satır içine alınır | Dolaylı (vtable'dan adres okunur); satır içine alınamaz |
| Derlenmiş kod | Tip başına bir kopya → ikili dosya büyür, derleme uzar | Tek kopya → küçük ikili, hızlı derleme |
| Bellek düzeni | Değerler yan yana durabilir (`[Kare]`) | Genelde her eleman ayrı bir `Box` → heap'te dağınık, önbellek (cache) dostu değil |
| Esneklik | Tipler derleme zamanında belli olmalı | Karışık ve çalışma zamanında seçilen tipler |

:::analogy Çevrilmiş baskılar ve canlı tercüman
Bir kitabı on dilde okutmak istiyorsun. Birinci yol: her dil için **ayrı bir baskı** basmak. Okurlar
hiç beklemeden okur, ama raflarda on kat kâğıt vardır (statik dispatch: hızlı ama kod büyür). İkinci
yol: **tek bir baskı** ve yanında, her cümlede sözlüğe bakan **canlı bir tercüman**. Raf yeri az, ama her
cümlede küçük bir gecikme olur ve tercüman cümleleri birleştirip akıcı hâle getiremez (dinamik dispatch:
tek kopya, çağrı başına küçük maliyet, inlining yok).
:::

**Ne kadar fark eder?** Dolaylı bir çağrının kendisi çok ucuzdur (modern işlemciler çoğu zaman adresi
doğru tahmin eder). Asıl maliyet çoğu zaman **kaçırılan inlining** ve **dağınık `Box`'ların** önbellek
kaçırmalarıdır. Saniyede milyonlarca kez dönen sıkı bir döngüde bu fark hissedilir; bir arayüz bileşenini
çizmek ya da bir ağ isteği göndermek gibi işlerde ise ölçülemeyecek kadar küçüktür. Kural: **tahmin etme,
ölç** (Modül 16'daki release profili ve benchmark araçlarıyla).

Diğer dillerle kıyas: Java ve C#'ta `final` olmayan her metot varsayılan olarak sanaldır (dinamik); JIT
derleyici sonradan “devirtualization” ile bunu geri almaya çalışır. C++'ta `virtual` yazdığın metotlar
dinamiktir. Rust'ta varsayılan **statiktir**; dinamik dispatch'i her seferinde `dyn` yazarak açıkça seçersin.

```quiz
question: Hangi ifade **yanlıştır**?
options:
  - Generic bir fonksiyonu çok sayıda farklı tiple kullanmak ikili dosyanın boyutunu artırabilir
  - "`dyn Trait` üzerinden yapılan çağrılar derleyici tarafından genellikle satır içine alınamaz"
  - "Dinamik dispatch, her `dyn Trait` çağrısında trait'in bütün implementasyonlarını tek tek deneyip doğru olanı bulur"
  - "`Vec<Box<dyn Sekil>>`'deki elemanlar heap'te dağınık durabildiği için önbellek performansı düşebilir"
answer: 2
explanation: |
  Arama yapılmaz: geniş işaretçinin içindeki vtable adresi **doğrudan** doğru tabloyu gösterir ve metodun
  adresi tablodaki sabit bir satırdan okunur. Bu, sabit süreli iki bellek okuması ve bir dolaylı çağrıdır;
  kaç tane implementasyon olduğundan bağımsızdır. Diğer üç ifade dispatch seçiminin gerçek bedelleridir.
feedback:
  - Doğru bir ifade; monomorphization tip başına kopya üretir.
  - Doğru bir ifade; adres çalışma anında belli olduğu için inlining yapılamaz.
  - Yanlış olan bu!
  - Doğru bir ifade; her `Box` ayrı bir heap tahsisidir.
```

## Her trait dyn olamaz: dyn uyumluluğu

Şekillerimize bir kopyalama metodu ekleyelim. Tahmin et:

```compiles
code: |
  trait Sekil {
      fn alan(&self) -> f64;
      fn kopyala(&self) -> Self;
  }

  struct Kare(f64);

  impl Sekil for Kare {
      fn alan(&self) -> f64 {
          self.0 * self.0
      }
      fn kopyala(&self) -> Self {
          Kare(self.0)
      }
  }

  fn main() {
      let sekiller: Vec<Box<dyn Sekil>> = vec![Box::new(Kare(2.0))];
      println!("{}", sekiller.len());
  }
answer: false
error: E0038
explanation: |
  `Sekil` artık **dyn uyumlu değil**. `kopyala` metodu `Self` döndürüyor. Bir `dyn Sekil` üzerinden
  `kopyala()` çağrılsaydı, dönen değerin tipi (ve boyutu) ne olurdu? Bir `Kare` mi, bir `Daire` mi?
  Derleyici bunu bilemez; dönüş değeri için stack'te ne kadar yer ayıracağını hesaplayamaz.
```

:::error
```text
error[E0038]: the trait `Sekil` is not dyn compatible
  --> src/main.rs:18:31
   |
18 |     let sekiller: Vec<Box<dyn Sekil>> = vec![Box::new(Kare(2.0))];
   |                               ^^^^^ `Sekil` is not dyn compatible
   |
note: for a trait to be dyn compatible it needs to allow building a vtable
  --> src/main.rs:3:26
   |
 1 | trait Sekil {
   |       ----- this trait is not dyn compatible...
 2 |     fn alan(&self) -> f64;
 3 |     fn kopyala(&self) -> Self;
   |                          ^^^^ ...because method `kopyala` references the `Self` type in its return type
   = help: consider moving `kopyala` to another trait
```
Notun ilk cümlesi bütün kuralların özeti: *bir trait'in dyn olabilmesi için ondan bir **vtable** kurulabilmeli.*
Hata, sorunlu metodu ve **nedenini** (`...because`) gösteriyor. (Eski kaynaklarda bu kavramın adı **nesne
güvenliği (object safety)** idi; Rust 2024 döneminde adı **dyn uyumluluğu (dyn compatibility)** oldu.)
:::

vtable'ı düşün: her metot için **tek bir satır**, o satırda **tek bir fonksiyon adresi** ve o adresin
**sabit bir imzası** olmalı. Kuralların hepsi bu gerekçeden çıkar:

| Trait'te bunu yaparsan | Neden vtable kurulamaz | Örnek |
|---|---|---|
| Metot `Self` döndürür ya da alıcı dışındaki bir parametrede `Self` alır | Somut tipin boyutu bilinmiyor; iki nesnenin aynı tipte olduğu garanti edilemez | `fn kopyala(&self) -> Self;`, `fn esit_mi(&self, d: &Self) -> bool;` |
| Metot generic'tir | Her `T` için ayrı bir kopya gerekir; vtable'a sonsuz satır sığmaz | `fn kaydet<T: Debug>(&self, x: T);` |
| `self` almayan ilişkili fonksiyon | Çağrılacak bir nesne (ve onun vtable'ı) yok | `fn yeni() -> Self;` |
| İlişkili sabit (`const`) | vtable'da sabitlere yer yok | `const AD: &str;` |
| Trait `Self: Sized` ister | `dyn Trait` tanımı gereği boyutu bilinmeyen bir tiptir | `trait Clone: Sized` |

Son satır şaşırtıcı bir sonuç doğurur: **`Clone` dyn uyumlu değildir.** `Vec<Box<dyn Clone>>` yazarsan
`the trait Clone is not dyn compatible ... because it requires Self: Sized` alırsın. Bu yüzden bir trait'e
`trait Sekil: Clone` yazmak onu `dyn`'dan mahrum bırakır. Bunun çaresini birazdan göreceğiz.

`&self`, `&mut self`, `self: Box<Self>` (ve `Rc<Self>`, `Arc<Self>`) alıcıları serbesttir: bunlarda `Self`
yalnızca alıcı konumundadır ve çağrı anında elimizde zaten bir işaretçi vardır.

```quiz
question: Aşağıdaki trait'lerden hangisi **dyn uyumludur**?
options:
  - |
    `trait Kaydet { fn yaz(&self, satir: &str); fn temizle(&mut self); fn adet(&self) -> usize; }`
  - |
    `trait Uret { fn yeni() -> Self; fn ad(&self) -> String; }`
  - |
    `trait Esitlik { fn esit_mi(&self, diger: &Self) -> bool; }`
  - |
    `trait Isle { fn uygula<F: Fn(i32) -> i32>(&self, f: F) -> i32; }`
answer: 0
explanation: |
  `Kaydet`'in bütün metotları `&self` / `&mut self` alıyor, generic değil ve `Self`'i başka hiçbir yerde
  kullanmıyor: vtable'ı rahatça kurulur. `Uret`'in `yeni`'si `self` almıyor; `Esitlik` parametrede `Self`
  kullanıyor (“diğeri de aynı somut tipte olmalı” garantisi `dyn` ile verilemez); `Isle` ise generic bir
  metot içeriyor. (`Isle`'yi kurtarmanın bir yolu: `F` yerine `&dyn Fn(i32) -> i32` almak. Böylece metot
  generic olmaktan çıkar.)
feedback:
  - Doğru!
  - "`self` almayan `yeni` için vtable'a gidecek bir nesne yok (`...has no self parameter`)."
  - "Parametrede `&Self`: `...references the Self type in this parameter`."
  - "Generic metot: `...has generic type parameters`."
```

## Kaçış kapısı: where Self: Sized

Bir trait'in büyük kısmı dyn uyumluysa ve yalnızca bir-iki metodu sorun çıkarıyorsa, o metotları
trait nesnelerinden **hariç tutabilirsin**: metoda `where Self: Sized` ekle. Anlamı: “*Bu metot yalnızca boyutu
bilinen (yani somut) tipler için var.*” `dyn Sekil` `Sized` olmadığı için metot vtable'a girmez ve trait yeniden
dyn uyumlu olur.

```rust
trait Sekil {
    fn alan(&self) -> f64;

    fn kopyala(&self) -> Self
    where
        Self: Sized; // vtable'a girmez

    fn birim() -> Self
    where
        Self: Sized; // vtable'a girmez
}

#[derive(Debug)]
struct Kare(f64);

impl Sekil for Kare {
    fn alan(&self) -> f64 {
        self.0 * self.0
    }
    fn kopyala(&self) -> Self {
        Kare(self.0)
    }
    fn birim() -> Self {
        Kare(1.0)
    }
}

fn main() {
    // somut tiple: bütün metotlar kullanılabilir
    let k = Kare(3.0);
    let k2 = k.kopyala();
    println!("{k2:?}, birim: {:?}", Kare::birim());

    // trait nesnesiyle: yalnızca vtable'daki metotlar
    let sekiller: Vec<Box<dyn Sekil>> = vec![Box::new(k), Box::new(Kare::birim())];
    for s in &sekiller {
        println!("alan = {}", s.alan());
    }
}
```

Standart kütüphane bu kapıyı her yerde kullanır. Örneğin `Iterator` dyn uyumludur (`Box<dyn Iterator<Item = i32>>`
yazabilirsin), oysa `map`, `filter`, `collect` gibi generic metotları vardır. Hepsi `where Self: Sized` ile
işaretlidir. `Box<dyn Iterator>` üzerinde yine de `map` çağırabilmenin sebebi ise `Box<I>`'nin kendisinin de
`Iterator`'ı uygulaması ve `Sized` olmasıdır.

Peki bu metodu bir trait nesnesi üzerinden çağırmaya çalışırsan?

```compiles
code: |
  trait Sekil {
      fn alan(&self) -> f64;
      fn kopyala(&self) -> Self
      where
          Self: Sized;
  }

  struct Kare(f64);

  impl Sekil for Kare {
      fn alan(&self) -> f64 {
          self.0 * self.0
      }
      fn kopyala(&self) -> Self {
          Kare(self.0)
      }
  }

  fn main() {
      let s: &dyn Sekil = &Kare(2.0);
      let k = s.kopyala();
      println!("{}", k.alan());
  }
answer: false
explanation: |
  Trait artık dyn uyumlu, yani `&dyn Sekil` satırı sorun değil. Ama `kopyala` vtable'da **yok**; derleyici
  `the kopyala method cannot be invoked on a trait object` der ve `Self: Sized` gereksinimini gösterir.
  Bu bilinçli bir takas: trait nesnesi kurabilmek için o metottan trait nesneleri üzerinde vazgeçtin.
```

`kopyala` trait nesnelerinde yoksa, karışık bir şekil listesini nasıl kopyalarız? Hile şu: `Self` yerine
**`Box<dyn Sekil>`** döndüren bir metot yaz. Dönüş tipinin boyutu artık bellidir (16 baytlık bir geniş
işaretçi), metot vtable'a girebilir:

```fill
prompt: |
  `Sekil` dyn uyumlu kalsın ama her şekil kendini kutulu olarak kopyalayabilsin. Boşlukları doldur.
code: |
  trait Sekil {
      fn alan(&self) -> f64;
      fn kutu_kopyala(&self) -> ___0;
  }

  #[derive(Clone)]
  struct Kare(f64);

  impl Sekil for Kare {
      fn alan(&self) -> f64 {
          self.0 * self.0
      }
      fn kutu_kopyala(&self) -> Box<dyn Sekil> {
          Box::new(self.___1())
      }
  }

  fn main() {
      let asil: Box<dyn Sekil> = Box::new(Kare(4.0));
      let kopya = asil.kutu_kopyala();
      println!("{} {}", asil.alan(), kopya.alan());
  }
blanks:
  - ["Box<dyn Sekil>"]
  - ["clone"]
output: "16 16"
explanation: |
  `kutu_kopyala` `Self` değil `Box<dyn Sekil>` döndürüyor; bu boyutu bilinen, sabit bir tip, yani vtable'da
  bir satırı olabilir. Her somut tip kendi implementasyonunda kendini `clone` edip kutuya koyuyor:
  `Kare`'nin vtable'ındaki `kutu_kopyala` bir `Kare` üretir, `Daire`'ninki bir `Daire`. Bu desene
  topluluk arasında **clone_box** denir.
```

## Alıştırma: kopyalanabilen şekil paleti

```exercise
id: m20-l03-e-kutu-kopyala
title: Çizim paletini çoğalt
difficulty: 4
prompt: |
  Bir çizim programında kullanıcı şekillerden oluşan bir paleti **çoğaltabilmeli** (“kopya oluştur”). Palet
  bir `Vec<Box<dyn Sekil>>`. `Vec`'in `clone()` metodu elemanların `Clone` olmasını ister, ama
  `trait Sekil: Clone` yazamayız (Clone dyn uyumlu değil). Çözüm: clone_box deseni.

  1. `Kare` ve `Daire` için `kutu_kopyala`'yı yaz: şeklin **bağımsız** bir kopyasını kutulu döndürsün.
  2. `impl Clone for Box<dyn Sekil>` bloğunu tamamla: kutudaki nesnenin `kutu_kopyala`'sını kullan.
     Bundan sonra `palet.clone()` kendiliğinden çalışır!
  3. `toplam_alan(sekiller)`: paletteki şekillerin alanları toplamı.

  Kopya **derin** olmalı: orijinal paletteki bir şekli ölçeklemek kopyayı etkilememeli.
starter: |
  trait Sekil {
      fn ad(&self) -> String;
      fn alan(&self) -> f64;
      fn olcekle(&mut self, kat: f64);
      fn kutu_kopyala(&self) -> Box<dyn Sekil>;
  }

  #[derive(Clone)]
  struct Kare {
      kenar: f64,
  }

  #[derive(Clone)]
  struct Daire {
      yaricap: f64,
  }

  impl Sekil for Kare {
      fn ad(&self) -> String {
          format!("Kare({})", self.kenar)
      }
      fn alan(&self) -> f64 {
          self.kenar * self.kenar
      }
      fn olcekle(&mut self, kat: f64) {
          self.kenar *= kat;
      }
      fn kutu_kopyala(&self) -> Box<dyn Sekil> {
          todo!()
      }
  }

  impl Sekil for Daire {
      fn ad(&self) -> String {
          format!("Daire({})", self.yaricap)
      }
      fn alan(&self) -> f64 {
          3.0 * self.yaricap * self.yaricap // basitlik için π ≈ 3
      }
      fn olcekle(&mut self, kat: f64) {
          self.yaricap *= kat;
      }
      fn kutu_kopyala(&self) -> Box<dyn Sekil> {
          todo!()
      }
  }

  impl Clone for Box<dyn Sekil> {
      fn clone(&self) -> Self {
          todo!()
      }
  }

  fn toplam_alan(sekiller: &[Box<dyn Sekil>]) -> f64 {
      todo!()
  }

  fn main() {
      let mut palet: Vec<Box<dyn Sekil>> = vec![
          Box::new(Kare { kenar: 2.0 }),
          Box::new(Daire { yaricap: 1.0 }),
      ];
      let yedek = palet.clone();
      palet[0].olcekle(10.0);
      println!("Palet: {} → {}", palet[0].ad(), toplam_alan(&palet));
      println!("Yedek: {} → {}", yedek[0].ad(), toplam_alan(&yedek));
  }
solution: |
  trait Sekil {
      fn ad(&self) -> String;
      fn alan(&self) -> f64;
      fn olcekle(&mut self, kat: f64);
      fn kutu_kopyala(&self) -> Box<dyn Sekil>;
  }

  #[derive(Clone)]
  struct Kare {
      kenar: f64,
  }

  #[derive(Clone)]
  struct Daire {
      yaricap: f64,
  }

  impl Sekil for Kare {
      fn ad(&self) -> String {
          format!("Kare({})", self.kenar)
      }
      fn alan(&self) -> f64 {
          self.kenar * self.kenar
      }
      fn olcekle(&mut self, kat: f64) {
          self.kenar *= kat;
      }
      fn kutu_kopyala(&self) -> Box<dyn Sekil> {
          Box::new(self.clone())
      }
  }

  impl Sekil for Daire {
      fn ad(&self) -> String {
          format!("Daire({})", self.yaricap)
      }
      fn alan(&self) -> f64 {
          3.0 * self.yaricap * self.yaricap // basitlik için π ≈ 3
      }
      fn olcekle(&mut self, kat: f64) {
          self.yaricap *= kat;
      }
      fn kutu_kopyala(&self) -> Box<dyn Sekil> {
          Box::new(self.clone())
      }
  }

  impl Clone for Box<dyn Sekil> {
      fn clone(&self) -> Self {
          self.kutu_kopyala()
      }
  }

  fn toplam_alan(sekiller: &[Box<dyn Sekil>]) -> f64 {
      sekiller.iter().map(|s| s.alan()).sum()
  }

  fn main() {
      let mut palet: Vec<Box<dyn Sekil>> = vec![
          Box::new(Kare { kenar: 2.0 }),
          Box::new(Daire { yaricap: 1.0 }),
      ];
      let yedek = palet.clone();
      palet[0].olcekle(10.0);
      println!("Palet: {} → {}", palet[0].ad(), toplam_alan(&palet));
      println!("Yedek: {} → {}", yedek[0].ad(), toplam_alan(&yedek));
  }
check: tests
tests: |
  fn palet() -> Vec<Box<dyn Sekil>> {
      vec![Box::new(Kare { kenar: 2.0 }), Box::new(Daire { yaricap: 1.0 })]
  }

  #[test]
  fn kutu_kopyala_ayni_sekli_uretir() {
      let k: Box<dyn Sekil> = Box::new(Kare { kenar: 5.0 });
      let kopya = k.kutu_kopyala();
      assert_eq!(kopya.ad(), "Kare(5)", "Kopya aynı tipte ve aynı boyutta olmalı");
      let d = Daire { yaricap: 2.0 }.kutu_kopyala();
      assert_eq!(d.ad(), "Daire(2)", "Daire kendini Daire olarak kopyalamalı");
  }

  #[test]
  fn palet_klonu_derin_kopyadir() {
      let mut asil = palet();
      let yedek = asil.clone();
      asil[0].olcekle(10.0);
      asil[1].olcekle(2.0);
      assert_eq!(asil[0].ad(), "Kare(20)");
      assert_eq!(yedek[0].ad(), "Kare(2)", "Orijinali ölçeklemek yedeği değiştirmemeli");
      assert_eq!(yedek[1].ad(), "Daire(1)", "Yedekteki daire de bağımsız olmalı");
  }

  #[test]
  fn toplam_alan_dogru() {
      assert_eq!(toplam_alan(&palet()), 7.0, "Kare(2) = 4, Daire(1) = 3 → 7");
      assert_eq!(toplam_alan(&[]), 0.0, "Boş paletin alanı 0");
  }

  #[derive(Clone)]
  struct Ucgen {
      taban: f64,
      yukseklik: f64,
  }

  impl Sekil for Ucgen {
      fn ad(&self) -> String {
          format!("Üçgen({}x{})", self.taban, self.yukseklik)
      }
      fn alan(&self) -> f64 {
          self.taban * self.yukseklik / 2.0
      }
      fn olcekle(&mut self, kat: f64) {
          self.taban *= kat;
          self.yukseklik *= kat;
      }
      fn kutu_kopyala(&self) -> Box<dyn Sekil> {
          Box::new(self.clone())
      }
  }

  #[test]
  fn yeni_sekil_tipiyle_de_calisir() {
      let mut asil = palet();
      asil.push(Box::new(Ucgen { taban: 4.0, yukseklik: 3.0 }));
      let yedek = asil.clone();
      asil[2].olcekle(2.0);
      assert_eq!(toplam_alan(&yedek), 13.0, "4 + 3 + 6 = 13");
      assert_eq!(toplam_alan(&asil), 31.0, "Ölçeklenen üçgenin alanı 4 katına çıkar: 4 + 3 + 24");
  }
hints:
  - "Somut tiplerin hepsi `#[derive(Clone)]`'lı. `kutu_kopyala` içinde `self.clone()` bir `Kare` (ya da `Daire`) üretir; onu `Box::new(...)` ile kutula."
  - "`impl Clone for Box<dyn Sekil>` içinde `self` bir `&Box<dyn Sekil>`. Kutudaki nesnenin metodunu çağır: `self.kutu_kopyala()`. Dikkat: `self.clone()` yazarsan fonksiyon kendini sonsuza kadar çağırır (stack overflow)!"
  - "`toplam_alan`: `sekiller.iter().map(|s| s.alan()).sum()` ya da bir `for` döngüsüyle `toplam += s.alan();`."
explanation: |
  Zinciri adım adım izleyelim. `palet.clone()` → `Vec::clone` her eleman için `Box<dyn Sekil>::clone`'u
  çağırır → senin impl'in `self.kutu_kopyala()` der → bu çağrı vtable üzerinden gider ve elemanın **gerçek**
  tipine ait `kutu_kopyala` çalışır → o da `Kare::clone` (ya da `Daire::clone`, `Ucgen::clone`) ile yepyeni,
  bağımsız bir nesne üretip kutular. Böylece hem trait dyn uyumlu kaldı hem de karışık bir liste derin
  kopyalanabildi.

  `impl Clone for Box<dyn Sekil>` neden yetim kuralına (Modül 11) takılmadı? `Clone` da `Box` da yabancı ama
  `dyn Sekil` **bizim** trait'imizden oluşan yerel bir tiptir ve `Box` bu konuda özel (*fundamental*) bir tip
  olduğu için `Box<dyn Sekil>` yerel sayılır.

  Her tipte aynı `Box::new(self.clone())` satırını yazmak tekrar gibi görünüyor. Bunu tek seferde, bütün
  `Clone` tipler için yazan bir **blanket impl** de mümkün, ama bir **supertrait** gerektirir (Modül 22).
  Gerçek projelerde `dyn-clone` crate'i bu deseni hazır sunar.
```

## Üçüncü yol: enum'lar ve kapalı kümeler

Bütün şekil tiplerini **sen** biliyorsan ve liste sabitse, ne generic ne `dyn` gerekir: bir **enum** yeter
(Modül 7).

```rust
enum Sekil {
    Kare { kenar: f64 },
    Daire { yaricap: f64 },
    Dikdortgen { en: f64, boy: f64 },
}

impl Sekil {
    fn alan(&self) -> f64 {
        match self {
            Sekil::Kare { kenar } => kenar * kenar,
            Sekil::Daire { yaricap } => 3.14159 * yaricap * yaricap,
            Sekil::Dikdortgen { en, boy } => en * boy,
        }
    }
}

fn main() {
    // karışık liste, ama Box yok: elemanlar Vec içinde yan yana duruyor
    let sekiller = vec![
        Sekil::Kare { kenar: 2.0 },
        Sekil::Daire { yaricap: 1.0 },
        Sekil::Dikdortgen { en: 2.0, boy: 5.0 },
    ];
    let toplam: f64 = sekiller.iter().map(|s| s.alan()).sum();
    println!("Toplam alan: {toplam:.2}");
}
```

Enum, dinamik dispatch'in esnekliğinin bir kısmını statik dispatch'in hızıyla verir: `match` derleme zamanında
bilinen kollara dallanır, satır içine alınabilir, `Box` ya da vtable gerekmez, elemanlar yan yana durur. Somut
tipe ihtiyaç olduğunda da `match` ile ona doğrudan ulaşırsın; `dyn`'daki E0599 sorunu yoktur. Yeni bir varyant
eklediğinde, onu ele almayan her `match`'i derleyici `E0004` ile sana gösterir (Modül 7).

Bedeli **kapalılıktır**: yeni bir şekil eklemek için enum'u (ve bütün `match`'leri) **değiştirmen** gerekir;
kütüphaneni kullanan biri bunu yapamaz. İki yaklaşımın kolay ve zor yanları birbirinin tam tersidir:

| | Yeni bir **tip** eklemek | Yeni bir **işlem** eklemek |
|---|---|---|
| Enum | Zor: enum'u ve her `match`'i değiştir | Kolay: yeni bir `fn` + `match` yaz |
| Trait (`dyn`) | Kolay: yeni bir `impl` yaz, kimseye dokunma | Zor: trait'e metot ekle, her impl'i güncelle |

Karar özeti: **tipler derleme zamanında belli ve tek tipse → generic. Tipler karışık ama liste kapalı ve senin
elindeyse → enum. Liste açıksa (eklentiler, kullanıcı tipleri) → `dyn`.**

:::deep Any: trait nesnesinden somut tipe geri dönmek
Bazen elinde gerçekten “herhangi bir şey” vardır ve somut tipini sorman gerekir. `std::any::Any` trait'i her
`'static` tip için otomatik olarak uygulanır ve çalışma zamanı tip kimliği taşır. `downcast_ref::<T>()` bir
`Option<&T>` döndürür: tip uyuyorsa `Some`, uymuyorsa `None`.

```rust
use std::any::Any;

fn tanimla(deger: &dyn Any) -> String {
    if let Some(n) = deger.downcast_ref::<i32>() {
        format!("bir tam sayı: {n}")
    } else if let Some(s) = deger.downcast_ref::<String>() {
        format!("bir metin: {s}")
    } else {
        String::from("tanımadığım bir şey")
    }
}

fn main() {
    println!("{}", tanimla(&42));
    println!("{}", tanimla(&String::from("simit")));
    println!("{}", tanimla(&3.5));
}
```

Bunu aslında görmüştün: Modül 18'de `JoinHandle::join()` panik eden bir thread için
`Err(Box<dyn Any + Send>)` döndürüyordu; panik mesajını `downcast_ref::<&str>()` ile okursun. `Any` bir
**kaçış kapısıdır**: tip sistemi yerine çalışma zamanı kontrolüne güvenirsin ve yeni bir tip eklendiğinde
derleyici seni uyarmaz. Somut tiplere sıkça ihtiyaç duyuyorsan, o küme büyük ihtimalle kapalıdır ve bir
**enum** daha doğrudur.
:::

```predict
code: |
  use std::any::Any;

  fn main() {
      let kutular: Vec<Box<dyn Any>> = vec![Box::new(7_u8), Box::new("çay"), Box::new(7_i32)];
      let mut sayac = 0;
      for k in &kutular {
          if let Some(n) = k.downcast_ref::<i32>() {
              sayac += n;
          }
      }
      println!("{sayac} {}", kutular[1].is::<&str>());
  }
options:
  - "14 true"
  - "7 true"
  - "7 false"
  - "0 true"
answer: 1
explanation: |
  `downcast_ref` tipi **birebir** karşılaştırır: `7_u8` bir `u8`'dir, `i32` değil, bu yüzden `None` döner ve
  sayılmaz. Otomatik sayı dönüşümü yok (Modül 2'deki `as` gibi). Yalnızca `7_i32` eşleşir → `sayac = 7`.
  `"çay"` bir `&'static str`'dir, yani `is::<&str>()` `true` verir.
```

## Özet

:::remember
- **Statik dispatch** (generic, `impl Trait`): tip başına bir kopya, doğrudan çağrı, inlining → en hızlı;
  bedeli kod boyutu ve derleme süresi.
- **Dinamik dispatch** (`dyn Trait`): tek kopya, vtable'dan dolaylı çağrı, inlining yok, genelde `Box`'lar;
  karşılığında karışık ve açık tip kümeleri. Tahmin etme, ölç.
- **dyn uyumluluğu**: vtable kurulabilmeli. Generic metot, `Self` döndüren/alan metot, `self`'siz fonksiyon,
  ilişkili sabit ya da `Self: Sized` (ör. `Clone`) → `E0038`.
- `where Self: Sized` bir metodu vtable'dan çıkarır; trait yeniden dyn uyumlu olur ama o metot trait
  nesnesinde çağrılamaz.
- clone_box: `fn kutu_kopyala(&self) -> Box<dyn Trait>` + `impl Clone for Box<dyn Trait>`.
- Kapalı küme → **enum** (hızlı, `match`, kapsamlılık kontrolü); açık küme → `dyn`; tek tip → generic.
  `Any` + `downcast_ref` son çaredir.
:::

```reflect
prompt: |
  Bir oyun motorunda saniyede 60 kez çalışan bir döngüde 100 000 parçacığın konumu güncelleniyor; parçacık
  tipleri (duman, kıvılcım, yağmur) motorla birlikte geliyor. Ayrıca kullanıcıların kendi yazdığı “eklenti”
  efektleri yüklenebiliyor. Bu iki ihtiyaç için hangi çok biçimlilik yöntemlerini seçerdin? Gerekçelendir.
answer: |
  Parçacıklar için enum ya da tip başına ayrı generic/homojen listeler seçerdim. Tipler motorla birlikte gelen
  kapalı bir küme ve döngü çok sıcak (saniyede milyonlarca güncelleme). Enum'da `Box` ve vtable yok, elemanlar
  bellekte yan yana duruyor, `match` satır içine alınabiliyor; bu hem dolaylı çağrıdan hem de önbellek
  kaçırmalarından kurtarır.

  Kullanıcı eklentileri ise derleme zamanında bilinmeyen, açık bir küme. Onları `Vec<Box<dyn Efekt>>` olarak
  tutardım. Eklenti sayısı az ve kare başına birkaç çağrı yapılıyorsa dinamik dispatch'in maliyeti önemsizdir.
  Emin olmak için iki yaklaşımı da ölçerdim.
```

```flashcards
- front: Statik ve dinamik dispatch arasındaki temel fark nedir?
  back: Statikte çağrılacak fonksiyon derleme zamanında belli olur (monomorphization); dinamikte çalışma zamanında vtable'dan okunur.
- front: Dinamik dispatch'in en önemli performans bedeli genelde nedir?
  back: Kaçırılan inlining (ve onun açtığı optimizasyonlar) ile dağınık `Box`'ların önbellek kaçırmaları. Dolaylı çağrının kendisi ucuzdur.
- front: "`E0038: the trait ... is not dyn compatible` ne demektir?"
  back: Trait'ten vtable kurulamıyor, yani trait nesnesi (`dyn Trait`) yapılamıyor.
- front: Bir trait'i dyn uyumsuz yapan üç metot özelliği say.
  back: "Generic metot (`fn f<T>`), `Self` döndüren ya da parametrede `Self` alan metot, `self` almayan ilişkili fonksiyon (`fn yeni() -> Self`)."
- front: "`Box<dyn Clone>` neden yazılamaz?"
  back: "`Clone` trait'i `Self: Sized` gerektirir (`clone` `Self` döndürür); `dyn Clone` boyutsuz olduğundan dyn uyumlu değildir."
- front: "`where Self: Sized` bir trait metoduna eklenince ne olur?"
  back: Metot vtable'dan çıkar; trait dyn uyumlu olabilir ama o metot trait nesnesi üzerinden çağrılamaz, yalnızca somut tiplerde çağrılır.
- front: Karışık bir `Vec<Box<dyn Sekil>>`'i kopyalamak için hangi desen kullanılır?
  back: "clone_box: trait'e `fn kutu_kopyala(&self) -> Box<dyn Sekil>` eklenir ve `impl Clone for Box<dyn Sekil>` bu metodu çağırır."
- front: Ne zaman `dyn` yerine enum tercih edilir?
  back: Tip kümesi kapalıysa ve senin kontrolündeyse. Box ve vtable gerekmez, `match` hızlıdır, yeni varyant eksik `match`'leri E0004 ile yakalatır.
```
