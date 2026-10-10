---
id: m22-l05
title: PhantomData, marker trait'ler ve GAT'ler
minutes: 28
type: lesson
objectives:
  - "`PhantomData` ile değeri olmayan tip parametrelerini (ölçü birimi, para birimi) derleme zamanı güvencesine dönüştürebilmek"
  - "Marker trait'leri (`Copy`, `Send`, `Sync`, `Unpin`, `Sized`, `Eq`) tanıyıp `PhantomData` ile bir tipin otomatik trait'lerini kontrol edebilmek"
  - "Sealed trait desenini kurup bir trait'in crate dışından uygulanmasını engelleyebilmek"
  - "GAT'lerin çözdüğü ödünç veren iterator problemini açıklayıp trait'lerde `impl Trait` döndüren (RPITIT) metotlar yazabilmek"
keywords: [PhantomData, marker trait, auto trait, Send, Sync, Unpin, sealed trait, GAT, generic associated types, lending iterator, RPITIT, "impl Trait", "use<>", E0392, E0038, E0562]
---

1999'da NASA'nın 125 milyon dolarlık **Mars Climate Orbiter** sondası Mars'a planlanandan çok fazla yaklaştı ve kayboldu.
Sebep bir yazılım hatasıydı: Bir ekip itkiyi **pound-saniye**, diğeri **newton-saniye** cinsinden
hesaplamıştı. İki sayı da `double`'dı ve hiçbir derleyici birimlerin uyuşmadığını fark edemedi.

Bu derste o hatayı Rust'ta **derlenemez** hâle getireceğiz. Hem de bellekte tek bir bayt bile
harcamadan. Araçlarımız: değeri olmayan tip parametreleri için **`PhantomData`**, metotsuz ama anlam
dolu **marker trait'ler**, dışarıdan uygulanamayan **sealed trait'ler**, ilişkili tiplere generic
parametre veren **GAT'ler** ve trait'lerde **`impl Trait` döndürmek**. Bu, modülün ve tip sistemi
yolculuğunun son dersi.

## PhantomData: kullanılmayan tip parametresi

Fikir basit: Uzunluğu bir `f64` olarak tutalım, ama **birimi** tipte yazsın: `Uzunluk<Metre>` ile
`Uzunluk<Fit>` farklı tipler olsun. Birimlerin değeri yok, yalnızca isimleri var. Derlenir mi?

```compiles
code: |
  enum Metre {}
  enum Fit {}

  struct Uzunluk<Birim> {
      deger: f64,
  }

  fn main() {
      let kanat = Uzunluk::<Metre> { deger: 35.8 };
      let irtifa = Uzunluk::<Fit> { deger: 30000.0 };
      println!("{} {}", kanat.deger, irtifa.deger);
  }
answer: false
error: E0392
explanation: |
  Rust, tanımladığın her tip parametresinin bir **alanda kullanılmasını** ister. `Birim` hiçbir alanda
  geçmiyor. Derleyici bunun bir unutkanlık mı yoksa bilinçli bir tercih mi olduğunu bilemez, o yüzden
  senden bunu açıkça söylemeni bekler.
```

:::error
```text
error[E0392]: type parameter `Birim` is never used
 --> src/main.rs:4:16
  |
4 | struct Uzunluk<Birim> {
  |                ^^^^^ unused type parameter
  |
  = help: consider removing `Birim`, referring to it in a field, or using a marker such as `PhantomData`
```
`help:` satırı üç yol sunuyor; bizim istediğimiz üçüncüsü: **`PhantomData`** adlı bir “işaretçi” (marker).
:::

Rust neden bu kadar titiz? Çünkü bir tip parametresinin struct'la **ilişkisi** derleyici için önemli
bilgidir: `Uzunluk<Birim>` bir `Birim` mi sahipleniyor, ona bir referans mı tutuyor, yoksa hiç mi
ilgilenmiyor? Bu cevap, tipin `Send`/`Sync` olup olmadığını, drop sırasında ne kontrol edileceğini ve
yaşam süresi kurallarını belirler. Kullanılmayan bir parametrede bu bilgi yoktur.

**`std::marker::PhantomData<T>`** bu bilgiyi verir: “Bu struct **sanki** bir `T` tutuyormuş gibi
davranmalı.” Kendisi **sıfır baytlık** bir tiptir. Tek değeri de yine `PhantomData` diye yazılır:

```rust
use std::marker::PhantomData;

// Değeri hiç oluşturulmayacak, yalnızca tip olarak kullanılacak birimler:
// varyantsız enum'lar (önceki dersteki Infallible gibi)
#[derive(Debug, Clone, Copy)]
enum Metre {}
#[derive(Debug, Clone, Copy)]
enum Fit {}

#[derive(Debug, Clone, Copy)]
struct Uzunluk<Birim> {
    deger: f64,
    birim: PhantomData<Birim>,
}

impl Uzunluk<Fit> {
    fn fit(deger: f64) -> Self {
        Uzunluk { deger, birim: PhantomData }
    }

    fn metreye(self) -> Uzunluk<Metre> {
        Uzunluk { deger: self.deger * 0.3048, birim: PhantomData }
    }
}

impl Uzunluk<Metre> {
    fn metre(deger: f64) -> Self {
        Uzunluk { deger, birim: PhantomData }
    }

    fn topla(self, diger: Uzunluk<Metre>) -> Uzunluk<Metre> {
        Uzunluk::metre(self.deger + diger.deger)
    }
}

fn main() {
    let pist = Uzunluk::metre(3000.0);
    let uzatma = Uzunluk::fit(1000.0);
    // pist.topla(uzatma); // E0308: expected `Uzunluk<Metre>`, found `Uzunluk<Fit>`
    let toplam = pist.topla(uzatma.metreye());
    println!("{:.1} m", toplam.deger);
}
```

Yorumdaki satırı açarsan program derlenmez: Fiti metreyle toplamak artık bir **tip hatasıdır**. Mars
sondasındaki hata bu kodda yazılamaz. Birimi tipe kodlamanın çalışma anında bir maliyeti var mı?
Tahmin et:

```predict
code: |
  use std::marker::PhantomData;
  use std::mem::size_of;

  enum Metre {}

  struct Uzunluk<Birim> {
      deger: f64,
      birim: PhantomData<Birim>,
  }

  fn main() {
      println!("{}", size_of::<Uzunluk<Metre>>());
      println!("{}", size_of::<PhantomData<String>>());
  }
options:
  - |
    8
    0
  - |
    16
    24
  - |
    9
    0
answer: 0
explanation: |
  `PhantomData<T>` ne olursa olsun **0 bayttır**; `PhantomData<String>` bile. Bellekte hiçbir şey
  tutmaz, yalnızca derleyiciye bilgi verir. `Uzunluk<Metre>` da tam olarak bir `f64` kadar, yani 8 bayt
  yer kaplar. Birim bilgisi derleme sırasında kontrol edilir ve sonra tamamen silinir. Bu, Rust'ın
  **sıfır maliyetli soyutlama (zero-cost abstraction)** ilkesinin saf bir örneğidir.
```

:::analogy Kavanoz etiketi
Mutfaktaki iki kavanoz aynı camdan yapılmış ve ikisinin içinde de beyaz toz var. Birinin üstünde
“şeker”, diğerinde “tuz” yazıyor. Etiket kavanozun ağırlığına bir gram bile eklemez, ama çaya tuz
atmanı engeller. `PhantomData<Metre>` o etikettir. Rust'ın farkı, etiketi **derleyicinin** okuması:
Yanlış kavanoza uzanan elini daha mutfağa girmeden durdurur.
:::

## Birimleri bir trait'le genellemek

Her birim için ayrı `impl` bloğu yazmak çabuk büyür. Daha iyisi, birimlerin ortak özelliklerini bir
trait'te toplamaktır. Trait'ler metotların yanında **ilişkili sabitler (associated constants)** de
taşıyabilir: `const AD: &'static str;` her impl'in kendi değerini vermesi gereken bir sabittir ve
`B::AD` diye okunur.

```rust
use std::marker::PhantomData;
use std::ops::Add;

trait Birim {
    const AD: &'static str;
    const METRE_KARSILIGI: f64;
}

#[derive(Debug, Clone, Copy)]
enum Metre {}
#[derive(Debug, Clone, Copy)]
enum Fit {}
#[derive(Debug, Clone, Copy)]
enum Mil {}

impl Birim for Metre {
    const AD: &'static str = "m";
    const METRE_KARSILIGI: f64 = 1.0;
}
impl Birim for Fit {
    const AD: &'static str = "ft";
    const METRE_KARSILIGI: f64 = 0.3048;
}
impl Birim for Mil {
    const AD: &'static str = "mi";
    const METRE_KARSILIGI: f64 = 1609.344;
}

#[derive(Debug, Clone, Copy)]
struct Uzunluk<B> {
    deger: f64,
    birim: PhantomData<B>,
}

impl<B: Birim> Uzunluk<B> {
    fn yeni(deger: f64) -> Self {
        Uzunluk { deger, birim: PhantomData }
    }

    fn donustur<H: Birim>(self) -> Uzunluk<H> {
        Uzunluk::yeni(self.deger * B::METRE_KARSILIGI / H::METRE_KARSILIGI)
    }

    fn yaz(&self) -> String {
        format!("{:.2} {}", self.deger, B::AD)
    }
}

// Ders 1'deki Add: yalnızca AYNI birimdeki uzunluklar toplanır
impl<B: Birim> Add for Uzunluk<B> {
    type Output = Uzunluk<B>;

    fn add(self, diger: Self) -> Self {
        Uzunluk::yeni(self.deger + diger.deger)
    }
}

fn main() {
    let irtifa = Uzunluk::<Fit>::yeni(30000.0);
    println!("{} = {}", irtifa.yaz(), irtifa.donustur::<Metre>().yaz());

    let yol = Uzunluk::<Mil>::yeni(2.0) + Uzunluk::<Mil>::yeni(0.5);
    println!("{} = {}", yol.yaz(), yol.donustur::<Metre>().yaz());
}
```

`donustur::<Metre>()` çağrısında turbofish ile hedef birimi seçiyoruz (Modül 11). Dönüşüm katsayıları
**tip parametrelerinden** okunuyor: `B::METRE_KARSILIGI` kaynak birimin, `H::METRE_KARSILIGI` hedefin.
Çalışma anında hiçbir birim bilgisi taşınmıyor; derleyici her `(B, H)` çifti için ayrı ve sabitleri
gömülü bir fonksiyon üretiyor (monomorfizasyon).

:::warning derive ve PhantomData tuzağı
Birimleri neden `#[derive(Clone, Copy)]` ile işaretledik? Çünkü `#[derive(Clone)]` her tip parametresine
**gizli bir sınır** ekler: `impl<B: Clone> Clone for Uzunluk<B>`. Alanın `PhantomData<B>` olması, yani
`B`'nin hiç kopyalanmaması bunu değiştirmez. Birimler `Copy` olmasaydı `Uzunluk<Metre>` da `Copy`
olmazdı:

```text
error[E0382]: borrow of moved value: `a`
...
note: if all bounds were met, you could clone the value
 --> src/main.rs:3:1
  |
2 | #[derive(Debug, Clone, Copy)]
  |                 ----- derived `Clone` adds implicit bounds on type parameters
3 | struct Uzunluk<B> {
  | ^^^^^^^^^^^^^^^-^
  |                |
  |                introduces an implicit `B: Clone` bound
  = help: consider manually implementing `Clone` to avoid undesired bounds
```
İki çözüm var: Marker tiplere de derive eklemek (bizim yaptığımız) ya da `Clone`/`Copy`'yi elle,
`B`'ye sınır koymadan uygulamak.
:::

```fill
prompt: "Sıcaklığı tip düzeyinde birimlendir. `Sicaklik<Kelvin>`'i `Sicaklik<Celsius>`'a çeviren dönüşümü tamamla."
code: |
  use std::marker::PhantomData;

  enum Celsius {}
  enum Kelvin {}

  struct Sicaklik<B> {
      deger: f64,
      birim: ___0,
  }

  impl Sicaklik<Kelvin> {
      fn kelvin(deger: f64) -> Self {
          Sicaklik { deger, birim: ___1 }
      }

      fn celsiusa(self) -> Sicaklik<___2> {
          Sicaklik { deger: self.deger - 273.15, birim: PhantomData }
      }
  }

  fn main() {
      let oda = Sicaklik::kelvin(296.15).celsiusa();
      println!("{:.1}", oda.deger);
  }
blanks:
  - ["PhantomData<B>"]
  - ["PhantomData"]
  - ["Celsius"]
output: "23.0"
explanation: |
  Alanın **tipi** `PhantomData<B>`, **değeri** ise yalnızca `PhantomData`'dır (birim struct gibi;
  `B` tip çıkarımıyla bulunur). Dönüş tipi `Sicaklik<Celsius>` olduğu için ikinci `PhantomData`
  ifadesinin tipi `PhantomData<Celsius>` olarak çıkarıldı. 296.15 K − 273.15 = 23.0 °C.
```

Şimdi aynı fikri paraya uygula. Bankacılık yazılımlarında para birimlerini karıştırmak, birimleri
karıştırmaktan daha da pahalıya patlar:

````exercise
id: m22-l05-e-para
title: Para birimi karışmayan cüzdan
difficulty: 3
prompt: |
  `Para<B>` tutarı **kuruş** (sentin karşılığı) cinsinden bir `i64` olarak tutar; para birimi ise
  yalnızca tipte yazar (`PhantomData<B>`). `Para<Tl> + Para<Euro>` derlenmemeli. Struct ve para
  birimleri hazır. Şunları tamamla:

  1. **`Para::yeni(kurus)`**: verilen kuruşla bir `Para<B>` oluşturur.
  2. **`impl Add for Para<B>`**: aynı birimdeki iki tutarı toplar.
  3. **`impl Display`**: tutarı `lira.kuruş KOD` biçiminde yazar, kuruş hep iki hanelidir:
     `123456` → `1234.56 TL`, `7` → `0.07 EUR`, `-5` → `-0.05 TL` (eksi işaretini unutma!).
  4. **`cevir::<H>(kur_binde)`**: başka bir birime çevirir. `kur_binde`, kaynak birimin **binde
     kaçı** hedef birim ettiğidir: 1 EUR = 35,250 TL ise kur 35250'dir. Sonuç
     `kurus * kur_binde / 1000` (tamsayı bölmesi).
starter: |
  use std::fmt;
  use std::marker::PhantomData;
  use std::ops::Add;

  trait ParaBirimi {
      const KOD: &'static str;
  }

  #[derive(Debug, Clone, Copy, PartialEq)]
  enum Tl {}
  #[derive(Debug, Clone, Copy, PartialEq)]
  enum Euro {}

  impl ParaBirimi for Tl {
      const KOD: &'static str = "TL";
  }
  impl ParaBirimi for Euro {
      const KOD: &'static str = "EUR";
  }

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Para<B> {
      kurus: i64,
      birim: PhantomData<B>,
  }

  impl<B: ParaBirimi> Para<B> {
      fn yeni(kurus: i64) -> Self {
          todo!()
      }

      fn cevir<H: ParaBirimi>(self, kur_binde: i64) -> Para<H> {
          todo!()
      }
  }

  impl<B: ParaBirimi> Add for Para<B> {
      type Output = Para<B>;

      fn add(self, diger: Self) -> Self {
          todo!()
      }
  }

  impl<B: ParaBirimi> fmt::Display for Para<B> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      let maas = Para::<Tl>::yeni(4_500_000);
      let prim = Para::<Tl>::yeni(250_050);
      println!("{}", maas + prim);
      let tatil = Para::<Euro>::yeni(80_000);
      println!("{}", tatil.cevir::<Tl>(35_250));
  }
solution: |
  use std::fmt;
  use std::marker::PhantomData;
  use std::ops::Add;

  trait ParaBirimi {
      const KOD: &'static str;
  }

  #[derive(Debug, Clone, Copy, PartialEq)]
  enum Tl {}
  #[derive(Debug, Clone, Copy, PartialEq)]
  enum Euro {}

  impl ParaBirimi for Tl {
      const KOD: &'static str = "TL";
  }
  impl ParaBirimi for Euro {
      const KOD: &'static str = "EUR";
  }

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Para<B> {
      kurus: i64,
      birim: PhantomData<B>,
  }

  impl<B: ParaBirimi> Para<B> {
      fn yeni(kurus: i64) -> Self {
          Para { kurus, birim: PhantomData }
      }

      fn cevir<H: ParaBirimi>(self, kur_binde: i64) -> Para<H> {
          Para::yeni(self.kurus * kur_binde / 1000)
      }
  }

  impl<B: ParaBirimi> Add for Para<B> {
      type Output = Para<B>;

      fn add(self, diger: Self) -> Self {
          Para::yeni(self.kurus + diger.kurus)
      }
  }

  impl<B: ParaBirimi> fmt::Display for Para<B> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          let isaret = if self.kurus < 0 { "-" } else { "" };
          let mutlak = self.kurus.abs();
          write!(f, "{isaret}{}.{:02} {}", mutlak / 100, mutlak % 100, B::KOD)
      }
  }

  fn main() {
      let maas = Para::<Tl>::yeni(4_500_000);
      let prim = Para::<Tl>::yeni(250_050);
      println!("{}", maas + prim);
      let tatil = Para::<Euro>::yeni(80_000);
      println!("{}", tatil.cevir::<Tl>(35_250));
  }
check: tests
tests: |
  #[test]
  fn yazdirma_bicimi() {
      assert_eq!(Para::<Tl>::yeni(123_456).to_string(), "1234.56 TL");
      assert_eq!(Para::<Euro>::yeni(7).to_string(), "0.07 EUR", "Kuruş iki haneli yazılmalı");
      assert_eq!(Para::<Tl>::yeni(1_000).to_string(), "10.00 TL");
      assert_eq!(Para::<Tl>::yeni(0).to_string(), "0.00 TL");
  }

  #[test]
  fn negatif_tutarlar() {
      assert_eq!(Para::<Tl>::yeni(-5).to_string(), "-0.05 TL", "Eksi işareti lira kısmı 0 olsa da görünmeli");
      assert_eq!(Para::<Euro>::yeni(-1_250).to_string(), "-12.50 EUR");
  }

  #[test]
  fn ayni_birimde_toplama() {
      let toplam = Para::<Tl>::yeni(1_999) + Para::<Tl>::yeni(1);
      assert_eq!(toplam, Para::yeni(2_000));
      assert_eq!((Para::<Euro>::yeni(500) + Para::<Euro>::yeni(-800)).to_string(), "-3.00 EUR");
  }

  #[test]
  fn kur_cevirisi() {
      let tl: Para<Tl> = Para::<Euro>::yeni(1_000).cevir(35_250);
      assert_eq!(tl.to_string(), "352.50 TL", "10 EUR × 35,250 = 352,50 TL");
      let euro: Para<Euro> = Para::<Tl>::yeni(10_000).cevir(28);
      assert_eq!(euro.to_string(), "2.80 EUR", "100 TL × 0,028 = 2,80 EUR");
  }
hints:
  - "`yeni` ve `add` birer satır: `Para { kurus, birim: PhantomData }` ve `Para::yeni(self.kurus + diger.kurus)`. `cevir` de `Para::yeni(...)` döndürebilir; hedef tip dönüş tipinden çıkarılır."
  - "Biçimlendirmede işareti ayrı ele al: `let isaret = if self.kurus < 0 { \"-\" } else { \"\" };` ve `let mutlak = self.kurus.abs();`. Lira `mutlak / 100`, kuruş `mutlak % 100`."
  - "İki haneli yazmak için `{:02}` kullan: `write!(f, \"{isaret}{}.{:02} {}\", mutlak / 100, mutlak % 100, B::KOD)`. Para biriminin kodu tip parametresinden gelir: `B::KOD`."
require:
  - pattern: "B::KOD"
    message: "Para birimi kodunu tip parametresinden (`B::KOD`) oku; elle yazma."
explanation: |
  `Para<Tl>` ile `Para<Euro>` bellekte birebir aynıdır (8 baytlık bir `i64`), ama tip sistemi için
  tamamen farklıdır. `Add` impl'i yalnızca `Para<B> + Para<B>` tanımladığı için `maas + tatil` satırı
  derlenmez:

  ```text
  error[E0308]: mismatched types
     expected `Para<Tl>`, found `Para<Euro>`
  ```

  `cevir` birimler arasındaki **tek** meşru geçittir ve kuru açıkça istemek zorundadır. Tutarlar
  `i64` kuruş olarak tutuldu, çünkü `f64` ile para hesaplamak yuvarlama hatalarına yol açar
  (`0.1 + 0.2 != 0.3`, Modül 2). Negatif tutarlarda `-5 / 100 == 0` olduğu için işareti ayrı yazmak
  gerekti; aksi hâlde `-0.05` yerine `0.-5` gibi saçma bir çıktı alırdın.

  Gerçek dünyada bu desen `uom` (birimler) ve çeşitli para crate'lerinde kullanılır. Bir sonraki
  adımda, birimlerin listesini dışarıya **kapatmayı** da göreceğiz: Sealed trait'ler.
````

## Marker trait'ler: metotsuz sözler

`Copy`'nin hiç metodu yoktur. `Send`, `Sync`, `Unpin`, `Sized` ve hatta `Eq` de öyle. Bu trait'ler bir
şey **yapmaz**, bir tip hakkında bir şey **söyler**. Bunlara **marker trait** (işaret trait'i) denir:

| Trait | Söylediği şey | Nasıl kazanılır? | Tanıştığın yer |
|---|---|---|---|
| `Copy` | Taşıma yerine bit bit kopyalanabilir | `derive` (önce `Clone`) | Modül 4, 11 |
| `Eq` | `PartialEq`'e ek olarak `a == a` her zaman doğrudur | `derive` | Modül 11 |
| `Send` | Sahipliği başka bir thread'e geçebilir | **Otomatik** | Modül 18 |
| `Sync` | `&T` thread'ler arasında paylaşılabilir | **Otomatik** | Modül 18 |
| `Unpin` | Sabitlendikten (pin) sonra da taşınabilir | **Otomatik** | Modül 19 |
| `Sized` | Boyutu derleme zamanında bellidir | Derleyici; generic'lerde örtük | Ders 3 |

`Send`, `Sync` ve `Unpin` **otomatik trait'lerdir (auto traits)**: Bütün alanları uyguluyorsa tip de
kendiliğinden uygular. İşte `PhantomData`'nın ikinci önemli görevi: Otomatik trait hesabında
`PhantomData<T>` **bir `T` alanı gibi sayılır**. Böylece bir tipin hiç tutmadığı bir şey sayesinde
`Send` olmasını engelleyebilirsin.

Diyelim ki bir veritabanı oturumu, altta kullandığı C kütüphanesi yüzünden yalnızca **açıldığı thread'de**
kullanılabiliyor. Alanları (`u32`) masum görünüyor; o yüzden derleyiciye ayrıca söylememiz gerek.
Derlenir mi? (Modül 18 tekrarı)

```compiles
code: |
  use std::marker::PhantomData;
  use std::rc::Rc;
  use std::thread;

  struct Oturum {
      id: u32,
      _tek_thread: PhantomData<Rc<()>>,
  }

  fn kapat(o: Oturum) -> u32 {
      o.id
  }

  fn main() {
      let o = Oturum { id: 7, _tek_thread: PhantomData };
      let h = thread::spawn(move || kapat(o));
      println!("{}", h.join().unwrap());
  }
answer: false
error: E0277
explanation: |
  `Rc<()>` `Send` değildir (Modül 18: sayacı atomik değil). `PhantomData<Rc<()>>` otomatik trait
  hesabında bir `Rc<()>` gibi sayıldığı için `Oturum` da `Send` olmaktan çıkar. `thread::spawn` ise
  `F: Send` ister. Hata mesajı zinciri adım adım gösterir: `Rc<()>` → `PhantomData<Rc<()>>` → `Oturum`
  → closure.
```

:::error
```text
error[E0277]: `Rc<()>` cannot be sent between threads safely
   --> src/main.rs:16:27
    |
 16 |     let h = thread::spawn(move || kapat(o));
    |             ------------- -------^^^^^^^^^
    |             |             |
    |             |             `Rc<()>` cannot be sent between threads safely
    |             |             within this `{closure@src/main.rs:16:27: 16:34}`
    |             required by a bound introduced by this call
    |
    = help: within `{closure@src/main.rs:16:27: 16:34}`, the trait `Send` is not implemented for `Rc<()>`
note: required because it appears within the type `PhantomData<Rc<()>>`
note: required because it appears within the type `Oturum`
```
`note:` satırlarını aşağıdan yukarı oku: Closure `Oturum`'u içeriyor, `Oturum` `PhantomData<Rc<()>>`'yi,
o da `Rc<()>`'yi. Zincirin ucundaki `Rc<()>` `Send` değil.
:::

Neden doğrudan `impl !Send for Oturum {}` yazmıyoruz? Çünkü bu **negatif impl** sözdizimi henüz
kararlı Rust'ta yok. `PhantomData<Rc<()>>` (ya da `PhantomData<*const ()>`) bunun yerleşik
geçici çözümüdür. Tersi, yani elle `Send` **eklemek** (`unsafe impl Send for T {}`), derleyiciye
“güven bana” demektir ve Modül 24'ün konusu.

Kendi marker trait'lerini de tanımlayabilirsin. Metotsuz bir trait, generic sınırlarda bir **söz**
olarak kullanılır:

```rust
use std::fmt::Display;

/// Kullanıcıya gösterilmeden önce HTML kaçışından geçirilmiş metin tipleri.
trait GuvenliMetin: Display {}

struct KacisliHtml(String);

impl Display for KacisliHtml {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl GuvenliMetin for KacisliHtml {}

fn kacis(ham: &str) -> KacisliHtml {
    KacisliHtml(ham.replace('<', "&lt;").replace('>', "&gt;"))
}

fn sayfaya_yaz<T: GuvenliMetin>(icerik: &T) {
    println!("<p>{icerik}</p>");
}

fn main() {
    let yorum = "<script>alert('!')</script>";
    sayfaya_yaz(&kacis(yorum));
    // sayfaya_yaz(&yorum); // E0277: `&str: GuvenliMetin` sağlanmıyor
}
```

`GuvenliMetin`'in tek görevi, Ders 2'deki supertrait `Display`'in yanında “bu metin kaçıştan geçti”
sözünü tipe kazındırmak. Ham bir `&str` bu sözü veremez, o yüzden sayfaya yazılamaz.

```quiz
question: "Aşağıdaki trait'lerden hangileri **otomatik** (auto) trait'tir, yani bir tip, alanları uyguluyorsa onu kendiliğinden uygular?"
options:
  - "`Send`"
  - "`Copy`"
  - "`Sync`"
  - "`Unpin`"
answer: [0, 2, 3]
explanation: |
  `Send`, `Sync` ve `Unpin` otomatik trait'lerdir: Derleyici onları alanlara bakarak kendisi hesaplar ve
  `PhantomData` bu hesaba katılır. `Copy` da bir marker trait'tir ama **otomatik değildir**: Bütün
  alanları `Copy` olsa bile bir struct, sen `#[derive(Clone, Copy)]` yazmadıkça `Copy` olmaz. Bu bilinçli
  bir karardır: Bir tipin kopyalanabilir olması, onun API sözleşmesinin bir parçasıdır. Sonradan
  `Copy`'yi kaldırmak kullanıcıların kodunu kırar.
feedback:
  - "Doğru, `Send` otomatik bir trait'tir."
  - "`Copy` bir marker trait'tir ama `derive` ile açıkça istenmelidir."
  - "Doğru, `Sync` otomatik bir trait'tir."
  - "Doğru, `Unpin` otomatik bir trait'tir; derleyicinin ürettiği `async` future'lar onu uygulamaz."
```

## Sealed trait: dışarıya kapalı trait

Para birimi örneğine geri dönelim. Kütüphaneni yayımladın, `ParaBirimi` trait'i `pub`. Bir kullanıcı
`impl ParaBirimi for Dolar` yazdı ve senin hiç tasarlamadığın bir birimle `cevir` çağırmaya başladı.
Bir yıl sonra trait'e yeni bir zorunlu metot (`fn kurus_basamagi() -> u8`) eklemek istiyorsun.
Eklediğin anda o kullanıcının kodu derlenmez olur: **kırıcı değişiklik (breaking change)**, Modül 16'daki
semver kuralına göre ana sürüm artışı.

Bazen istediğin şey şudur: “Herkes bu trait'i **kullanabilsin** (sınır olarak yazabilsin, metotlarını
çağırabilsin), ama **yalnızca ben** uygulayabileyim.” Rust'ta bunun bir anahtar kelimesi yok, ama
modül gizliliği (Modül 8) ve supertrait'lerle (Ders 2) kurulan bir desen var: **sealed trait** (mühürlü trait).

```rust
mod para {
    // Özel modül: crate'in dışından adı yazılamaz
    mod gizli {
        pub trait Muhur {}
    }

    // Supertrait olarak gizli Muhur: ParaBirimi'ni uygulamak için önce Muhur'u uygulamak gerekir
    pub trait ParaBirimi: gizli::Muhur {
        const KOD: &'static str;
    }

    pub enum Tl {}
    pub enum Euro {}

    impl gizli::Muhur for Tl {}
    impl gizli::Muhur for Euro {}

    impl ParaBirimi for Tl {
        const KOD: &'static str = "TL";
    }
    impl ParaBirimi for Euro {
        const KOD: &'static str = "EUR";
    }

    pub fn kod_yaz<B: ParaBirimi>() -> &'static str {
        B::KOD
    }
}

fn main() {
    // Dışarıdan KULLANMAK serbest:
    println!("{} {}", para::kod_yaz::<para::Tl>(), para::kod_yaz::<para::Euro>());
}
```

Hile şurada: `Muhur` trait'i `pub`, ama **özel** bir modülün (`gizli`) içinde. Bu yüzden `para` modülünün
dışından adı yazılamaz. Adını yazamadığın bir trait'i uygulayamazsın. Supertrait olduğu için de
`ParaBirimi`'ni uygulamanın tek yolu önce `Muhur`'u uygulamaktır. Derlenir mi?

```compiles
code: |
  mod para {
      mod gizli {
          pub trait Muhur {}
      }

      pub trait ParaBirimi: gizli::Muhur {
          const KOD: &'static str;
      }

      pub enum Tl {}
      impl gizli::Muhur for Tl {}
      impl ParaBirimi for Tl {
          const KOD: &'static str = "TL";
      }
  }

  enum Dolar {}

  impl para::ParaBirimi for Dolar {
      const KOD: &'static str = "USD";
  }

  fn main() {
      println!("{}", <para::Tl as para::ParaBirimi>::KOD);
  }
answer: false
error: E0277
explanation: |
  `Dolar`, `ParaBirimi`'nin supertrait'i olan `Muhur`'u uygulamıyor. Uygulamaya çalışsa bu kez
  `para::gizli` modülünün özel olduğunu söyleyen E0603 hatası alırdı. Derleyici bu deseni tanıyor ve
  adını da koyuyor: “`ParaBirimi` is a "sealed trait"”.
```

:::error
```text
error[E0277]: the trait bound `Dolar: Muhur` is not satisfied
  --> src/main.rs:19:27
   |
19 | impl para::ParaBirimi for Dolar {
   |                           ^^^^^ unsatisfied trait bound
   |
note: required by a bound in `ParaBirimi`
  --> src/main.rs:6:27
   |
 6 |     pub trait ParaBirimi: gizli::Muhur {
   |                           ^^^^^^^^^^^^ required by this bound in `ParaBirimi`
   = note: `ParaBirimi` is a "sealed trait", because to implement it you also need to implement `para::gizli::Muhur`, which is not accessible; this is usually done to force you to use one of the provided types that already implement it
   = help: the following type implements the trait:
             para::Tl
```
:::

:::analogy Noter onaylı kulüp
Kulübün kapısındaki görevli (`ParaBirimi`) yalnızca üye kartı (`Muhur`) olanları içeri alır. Kartları
basan makine kulüp yönetiminin kilitli odasındadır (özel modül). Kulübün hizmetlerinden herkes
yararlanabilir ama yeni üyeyi yalnızca yönetim yazabilir.
:::

Sealed trait'in kazandırdıkları: **1)** Trait'e yeni metot eklemek artık kırıcı değil, çünkü bütün
uygulamalar senin elinde. **2)** Tiplerin listesini bildiğin için güvenli varsayımlar yapabilirsin
(ör. “`KOD` her zaman üç harfli”). Standart kütüphane bunu sık kullanır: Dilimlerde `get`'e verilebilen
indeks tiplerini belirleyen `SliceIndex` trait'i
sealed'dır. Bu yüzden onu kendi tiplerin için uygulayamazsın.

## GAT'ler: kendinden ödünç veren iterator

Modül 14'teki `Iterator` trait'ini hatırla: `type Item;` ve `fn next(&mut self) -> Option<Self::Item>`.
`Item` bir **tek** tiptir; iterator'ın kendisinden ödünç alamaz. Bir tamponun üzerinde kayan, her adımda
**değiştirilebilir** bir pencere veren bir iterator yazmaya çalışalım:

```rust,compile_fail
struct Pencereler {
    veri: Vec<i32>,
    bas: usize,
    boy: usize,
}

impl Iterator for Pencereler {
    type Item = &mut [i32]; // hangi yaşam süresi?

    fn next(&mut self) -> Option<Self::Item> {
        let son = self.bas + self.boy;
        if son > self.veri.len() {
            return None;
        }
        let pencere = &mut self.veri[self.bas..son];
        self.bas += 1;
        Some(pencere)
    }
}
```

:::error
```text
error: associated type `Iterator::Item` is declared without lifetime parameters, so using a borrowed type for them requires that lifetime to come from the implemented type
 --> src/main.rs:8:17
  |
8 |     type Item = &mut [i32]; // hangi yaşam süresi?
  |                 ^
  |
note: you can't create an `Iterator` that borrows each `Item` from itself, but you can instead create a new type that borrows your existing type and implement `Iterator` for that new type
 --> src/main.rs:7:19
  |
7 | impl Iterator for Pencereler {
  |                   ^^^^^^^^^^
```
“you can't create an `Iterator` that borrows each `Item` from itself”: Sorun tam olarak bu. `next`'in
imzası, dönen öğenin `&mut self` ödüncüyle bir ilişkisi olduğunu **söyleyemez**. Öyle olsaydı, `collect`
gibi bir tüketici örtüşen iki `&mut` pencereyi aynı anda tutabilir ve Modül 5'in tek-yazar kuralı
çiğnenirdi.
:::

Çözüm, ilişkili tipe **kendi generic parametresini** vermektir: `type Oge<'a>`. Buna **generic
associated type (GAT)** denir ve Rust 1.65'ten beri kararlıdır. Kendi “ödünç veren iterator”
(lending iterator) trait'imizi yazalım:

```rust
trait OdunctenIterator {
    // Öğe, iterator'dan 'a süresince ödünç alınan bir şey olabilir
    type Oge<'a>
    where
        Self: 'a;

    fn sonraki<'a>(&'a mut self) -> Option<Self::Oge<'a>>;
}

struct Pencereler {
    veri: Vec<i32>,
    bas: usize,
    boy: usize,
}

impl OdunctenIterator for Pencereler {
    type Oge<'a> = &'a mut [i32];

    fn sonraki<'a>(&'a mut self) -> Option<&'a mut [i32]> {
        let son = self.bas + self.boy;
        if son > self.veri.len() {
            return None;
        }
        let pencere = &mut self.veri[self.bas..son];
        self.bas += 1;
        Some(pencere)
    }
}

fn main() {
    let mut p = Pencereler { veri: vec![5, 1, 4], bas: 0, boy: 2 };
    while let Some(w) = p.sonraki() {
        w.swap(0, 1); // pencereyi yerinde değiştir
    }
    println!("{:?}", p.veri);
}
```

İmzadaki bağ artık açık: `sonraki<'a>(&'a mut self) -> Option<Self::Oge<'a>>`, yani öğe, `self`'in `'a`
süreli ödüncü kadar yaşar. Bir sonraki `sonraki()` çağrısı yeni bir `&mut self` ister ve bu yalnızca
önceki pencere artık kullanılmıyorsa mümkündür. Borrow checker örtüşmeyi böyle engeller.
`where Self: 'a` ise “`Self` içindeki referanslar en az `'a` kadar yaşamalı” der (Modül 12'deki
`T: 'a`). Bir tipten `'a` süreyle ödünç alabilmek için tipin kendisinin o kadar geçerli olması gerekir.

Bedeli de var: `OdunctenIterator` için `for` döngüsü ve `map`/`collect` gibi adaptörler yok. Elle
`while let` yazdık. Tahmin et:

```predict
code: |
  # trait OdunctenIterator {
  #     type Oge<'a>
  #     where
  #         Self: 'a;
  #     fn sonraki<'a>(&'a mut self) -> Option<Self::Oge<'a>>;
  # }
  # struct Pencereler {
  #     veri: Vec<i32>,
  #     bas: usize,
  #     boy: usize,
  # }
  # impl OdunctenIterator for Pencereler {
  #     type Oge<'a> = &'a mut [i32];
  #     fn sonraki<'a>(&'a mut self) -> Option<&'a mut [i32]> {
  #         let son = self.bas + self.boy;
  #         if son > self.veri.len() {
  #             return None;
  #         }
  #         let pencere = &mut self.veri[self.bas..son];
  #         self.bas += 1;
  #         Some(pencere)
  #     }
  # }
  // Pencereler ve OdunctenIterator yukarıdaki gibi (gizli satırlar)
  fn main() {
      let mut p = Pencereler { veri: vec![1, 2, 3, 4], bas: 0, boy: 2 };
      while let Some(w) = p.sonraki() {
          w[1] += w[0];
      }
      println!("{:?}", p.veri);
  }
options:
  - "[1, 3, 6, 10]"
  - "[1, 3, 5, 7]"
  - "[2, 4, 6, 8]"
answer: 0
explanation: |
  Pencereler **örtüşür** ve her biri bir öncekinin yazdığı değeri görür: `[1,2]` → `[1,3]`, sonra
  `[3,3]` → `[3,6]`, sonra `[6,4]` → `[6,10]`. Sonuç ön ekler toplamıdır (prefix sum). Örtüşen
  `&mut` pencereler ancak **sırayla** var olabildiği için bu güvenlidir; GAT'li imza tam olarak bu
  sıralamayı zorunlu kılar. Seçenek 2 pencerelerin orijinal değerleri gördüğü (örtüşmenin olmadığı)
  bir dünyayı varsayar.
```

GAT'ler yalnızca yaşam süresi değil, tip parametresi de alabilir (`type Kap<T>;`). Bir trait'in “bana
herhangi bir `T` için bir kap ver” diyebilmesi gibi ileri soyutlamalar böyle kurulur. Günlük kodda GAT
yazman nadirdir, ama kütüphanelerin imzalarında görürsün. Ne aradığını artık biliyorsun.

## Trait'lerde impl Trait döndürmek (RPITIT)

Modül 11'den beri `-> impl Iterator<Item = u32>` yazıyorsun: “Somut tipi söylemiyorum ama bir iterator
döndürüyorum.” Rust 1.75'e kadar bunu bir **trait metodunda** yapamıyordun. Ya `Box<dyn Iterator>`
döndürüp heap ve dinamik dispatch bedeli ödüyordun ya da bir ilişkili tip (çoğu zaman da bir GAT) tanımlayıp
her impl'de o isimsiz iterator tipini yazmaya uğraşıyordun. Artık doğrudan yazılıyor: **return-position
impl Trait in traits (RPITIT)**.

```rust
trait Koleksiyon {
    fn ogeler(&self) -> impl Iterator<Item = u32>;

    // Varsayılan metot RPITIT'in üzerine kurulabilir
    fn toplam(&self) -> u32 {
        self.ogeler().sum()
    }
}

struct Liste(Vec<u32>);
struct Aralik {
    bas: u32,
    son: u32,
}

impl Koleksiyon for Liste {
    fn ogeler(&self) -> impl Iterator<Item = u32> {
        self.0.iter().copied() // somut tip: Copied<slice::Iter<u32>>
    }
}

impl Koleksiyon for Aralik {
    fn ogeler(&self) -> impl Iterator<Item = u32> {
        (self.bas..self.son).filter(|n| n % 2 == 0) // somut tip: Filter<Range<u32>, {closure}>
    }
}

fn main() {
    let l = Liste(vec![3, 4, 5]);
    let a = Aralik { bas: 1, son: 10 };
    println!("{} {}", l.toplam(), a.toplam());
}
```

Her impl **farklı** bir somut iterator döndürüyor ve derleyici her birini ayrı ayrı biliyor. Sıfır maliyet,
satır içine alma ve heap ayırmama gibi bütün avantajlar korunuyor. Modül 19'daki `async fn`'i trait'lerde
kullanabilmen de aynı özelliğe dayanır: Bir trait'teki `async fn calis(&self)` aslında
`fn calis(&self) -> impl Future<Output = ()>` demektir.

Peki bedeli ne? Modül 20'den bir soru:

```compiles
question: "(Modül 20 tekrarı) Derlenir mi?"
code: |
  trait Koleksiyon {
      fn ogeler(&self) -> impl Iterator<Item = &u32>;
  }

  struct Liste(Vec<u32>);

  impl Koleksiyon for Liste {
      fn ogeler(&self) -> impl Iterator<Item = &u32> {
          self.0.iter()
      }
  }

  fn main() {
      let k: Box<dyn Koleksiyon> = Box::new(Liste(vec![1, 2]));
      println!("{}", k.ogeler().count());
  }
answer: false
error: E0038
explanation: |
  Vtable'daki her metodun dönüş tipi bütün uygulayıcılar için **aynı** olmalı. Oysa RPITIT'te her impl
  farklı bir gizli tip döndürür; vtable kurulamaz. Derleyici bunu açıkça söylüyor: “method `ogeler`
  references an `impl Trait` type in its return type”. Trait nesnesi gerekiyorsa o metot
  `Box<dyn Iterator<..>>` döndürmeli ya da Modül 20'deki `where Self: Sized` ile vtable'dan çıkarılmalı.
```

Bu da `impl Trait`'in nerelerde kullanılabildiğine dair tabloyu tamamlıyor:

| Konum | Örnek | Anlamı |
|---|---|---|
| Argüman | `fn f(x: impl Display)` | Gizli bir generic parametre (`<T: Display>`); tipi **çağıran** seçer |
| Serbest fonksiyon dönüşü | `fn f() -> impl Iterator<..>` | Tek bir gizli somut tip; tipi **fonksiyon** seçer (Modül 11) |
| Trait metodu dönüşü (RPITIT) | `fn f(&self) -> impl Iterator<..>;` | Her impl kendi gizli tipini seçer; trait dyn uyumlu olmaz |
| `let`, struct alanı, `type` takma adı | `let x: impl Display = 5;` | **İzin yok** (E0562); generic parametre ya da `Box<dyn ..>` kullan |

:::deep Edition 2024: impl Trait hangi yaşam sürelerini yakalar?
Dönüş konumundaki bir `impl Trait`, gizli tipin **hangi** generic parametrelere ve yaşam sürelerine bağlı
olabileceğini de söyler. Edition 2024 ile kural sadeleşti: Kapsamdaki **bütün** generic parametreleri ve
yaşam sürelerini otomatik olarak yakalar. Çoğu zaman istediğin budur, ama bazen fazladır:

```rust,compile_fail,E0597
fn uzunluk_sayaci(v: &[u32]) -> impl Fn() -> usize {
    let n = v.len();
    move || n
}

fn main() {
    let f;
    {
        let gecici = vec![1, 2, 3];
        f = uzunluk_sayaci(&gecici);
    }
    println!("{}", f());
}
```

```text
error[E0597]: `gecici` does not live long enough
  --> src/main.rs:10:28
   |
 9 |         let gecici = vec![1, 2, 3];
   |             ------ binding `gecici` declared here
10 |         f = uzunluk_sayaci(&gecici);
   |                            ^^^^^^^ borrowed value does not live long enough
11 |     }
   |     - `gecici` dropped here while still borrowed
12 |     println!("{}", f());
   |                    - borrow later used here
   |
note: this call may capture more lifetimes than intended, because Rust 2024 has adjusted the `impl Trait` lifetime capture rules
help: use the precise capturing `use<...>` syntax to make the captures explicit
   |
 1 | fn uzunluk_sayaci(v: &[u32]) -> impl Fn() -> usize + use<> {
   |                                                    +++++++
```

Closure `v`'yi değil yalnızca `n`'yi tutuyor, ama dönüş tipi `v`'nin yaşam süresini yakaladığı için
derleyici dönen closure'ı `v` ödünç kaldıkça yaşayan bir şey sayar. **`+ use<>`** (Rust 1.82) yakalanacak
listeyi açıkça yazar; boş liste “hiçbir yaşam süresi yakalama” demektir. `use<'a, T>` gibi seçici de
yazılabilir.
:::

Şimdi RPITIT ile bir envanter soyutlaması kur:

```exercise
id: m22-l05-e-envanter
title: Farklı depolar, tek envanter arayüzü
difficulty: 3
prompt: |
  Bir zincir market iki tür stok kaydı tutuyor: çok ürünlü **`Depo`** ve tek ürün sergileyen
  **`Vitrin`**. Ortak bir `Envanter` trait'i tanımlandı. Ürünleri bir iterator olarak veren
  `urunler` metodu **RPITIT** kullanıyor:

  - `fn urunler(&self) -> impl Iterator<Item = (&str, u32)>;` → (ürün adı, adet) çiftleri
  - `fn toplam_stok(&self) -> u32` → bütün adetlerin toplamı (**varsayılan** metot; `urunler` ile yaz)
  - `fn tukenenler(&self) -> Vec<&str>` → adedi 0 olan ürünlerin adları, sırası korunarak (**varsayılan** metot)

  İki tip için de `urunler`'i uygula. `Depo` kendi vektöründen, `Vitrin` ise tek ürününden çift üretsin.
starter: |
  trait Envanter {
      fn urunler(&self) -> impl Iterator<Item = (&str, u32)>;

      fn toplam_stok(&self) -> u32 {
          todo!()
      }

      fn tukenenler(&self) -> Vec<&str> {
          todo!()
      }
  }

  struct Depo {
      kayitlar: Vec<(String, u32)>,
  }

  struct Vitrin {
      ad: String,
      adet: u32,
  }

  impl Envanter for Depo {
      fn urunler(&self) -> impl Iterator<Item = (&str, u32)> {
          // Yer tutucu: boş bir iterator. Gerçek çiftleri üret.
          Vec::new().into_iter()
      }
  }

  impl Envanter for Vitrin {
      fn urunler(&self) -> impl Iterator<Item = (&str, u32)> {
          // Yer tutucu: boş bir iterator. Gerçek çifti üret.
          Vec::new().into_iter()
      }
  }

  fn main() {
      let depo = Depo {
          kayitlar: vec![(String::from("çay"), 12), (String::from("şeker"), 0)],
      };
      let vitrin = Vitrin { ad: String::from("simit"), adet: 30 };
      println!("{} {:?}", depo.toplam_stok(), depo.tukenenler());
      println!("{} {:?}", vitrin.toplam_stok(), vitrin.tukenenler());
  }
solution: |
  trait Envanter {
      fn urunler(&self) -> impl Iterator<Item = (&str, u32)>;

      fn toplam_stok(&self) -> u32 {
          self.urunler().map(|(_, adet)| adet).sum()
      }

      fn tukenenler(&self) -> Vec<&str> {
          self.urunler()
              .filter(|&(_, adet)| adet == 0)
              .map(|(ad, _)| ad)
              .collect()
      }
  }

  struct Depo {
      kayitlar: Vec<(String, u32)>,
  }

  struct Vitrin {
      ad: String,
      adet: u32,
  }

  impl Envanter for Depo {
      fn urunler(&self) -> impl Iterator<Item = (&str, u32)> {
          self.kayitlar.iter().map(|(ad, adet)| (ad.as_str(), *adet))
      }
  }

  impl Envanter for Vitrin {
      fn urunler(&self) -> impl Iterator<Item = (&str, u32)> {
          [(self.ad.as_str(), self.adet)].into_iter()
      }
  }

  fn main() {
      let depo = Depo {
          kayitlar: vec![(String::from("çay"), 12), (String::from("şeker"), 0)],
      };
      let vitrin = Vitrin { ad: String::from("simit"), adet: 30 };
      println!("{} {:?}", depo.toplam_stok(), depo.tukenenler());
      println!("{} {:?}", vitrin.toplam_stok(), vitrin.tukenenler());
  }
check: tests
tests: |
  fn ornek_depo() -> Depo {
      Depo {
          kayitlar: vec![
              (String::from("çay"), 12),
              (String::from("şeker"), 0),
              (String::from("simit"), 30),
              (String::from("peynir"), 0),
          ],
      }
  }

  #[test]
  fn depo_urunleri_sirayla_verir() {
      let d = ornek_depo();
      let hepsi: Vec<(&str, u32)> = d.urunler().collect();
      assert_eq!(hepsi, vec![("çay", 12), ("şeker", 0), ("simit", 30), ("peynir", 0)]);
  }

  #[test]
  fn depo_toplam_ve_tukenenler() {
      let d = ornek_depo();
      assert_eq!(d.toplam_stok(), 42, "12 + 0 + 30 + 0 = 42");
      assert_eq!(d.tukenenler(), vec!["şeker", "peynir"], "Sıra korunmalı");
  }

  #[test]
  fn vitrin_tek_urun() {
      let v = Vitrin { ad: String::from("ayran"), adet: 0 };
      assert_eq!(v.urunler().count(), 1, "Vitrin tam bir ürün vermeli");
      assert_eq!(v.toplam_stok(), 0);
      assert_eq!(v.tukenenler(), vec!["ayran"]);
      let v2 = Vitrin { ad: String::from("poğaça"), adet: 8 };
      assert_eq!(v2.toplam_stok(), 8);
      assert!(v2.tukenenler().is_empty());
  }

  #[test]
  fn bos_depo() {
      let d = Depo { kayitlar: Vec::new() };
      assert_eq!(d.toplam_stok(), 0);
      assert!(d.tukenenler().is_empty(), "Boş depoda tükenen ürün olmaz");
  }
hints:
  - "`Depo`: `self.kayitlar.iter()` her öğe için `&(String, u32)` verir. `map(|(ad, adet)| (ad.as_str(), *adet))` ile `(&str, u32)`'ye çevir."
  - "`Vitrin`: tek elemanlı bir diziden iterator üretebilirsin: `[(self.ad.as_str(), self.adet)].into_iter()`."
  - "Varsayılan metotlar `self.urunler()` üzerine kurulur: `self.urunler().map(|(_, adet)| adet).sum()` ve `self.urunler().filter(|&(_, adet)| adet == 0).map(|(ad, _)| ad).collect()`."
require:
  - pattern: "self\\.urunler\\(\\)"
    message: "Varsayılan metotları `self.urunler()` üzerine kur; böylece her `Envanter` onları bedavaya alır."
explanation: |
  İki impl'in `urunler`'i tamamen farklı tipler döndürüyor: `Depo` için
  `Map<slice::Iter<(String, u32)>, {closure}>`, `Vitrin` için `array::IntoIter<(&str, u32), 1>`. RPITIT
  sayesinde bu tipleri hiç yazmadık ve hiçbirini kutulamadık. Varsayılan metotlar `toplam_stok` ve
  `tukenenler`, “`urunler` bir iterator döndürür” sözünden başka hiçbir şey bilmeden yazıldı.

  `Item = (&str, u32)`'deki `&str`'nin yaşam süresi elision ile `&self`'e bağlandı: Ürün adları
  envanterin içinden ödünç alınıyor, kopyalanmıyor. `tukenenler`'in `Vec<&str>` döndürebilmesi de bu
  yüzden.

  RPITIT'ten önce aynı şeyi bir GAT ile yazardın:
  `type Iter<'a>: Iterator<Item = (&'a str, u32)> where Self: 'a;` ve `fn urunler(&self) -> Self::Iter<'_>;`.
  Her impl o karmaşık tipi elle yazmak zorunda kalırdı (closure'lu tiplerin adı da yazılamaz!). Bedel:
  `Envanter` artık dyn uyumlu değil. `Vec<Box<dyn Envanter>>` gerekirse `urunler`'i
  `Box<dyn Iterator<Item = (&str, u32)> + '_>` döndürecek şekilde tasarlamak gerekir.
```

## Özet

:::ferris
Operatörlerden GAT'lere kadar tip sisteminin en derin köşelerini gezdin. Artık standart kütüphanenin
imzalarını okurken “bu da ne?” demeyeceksin; “ha, bu bir HRTB” diyeceksin! 🦀
:::

:::remember
- **`PhantomData<T>`**: 0 bayt; struct'a “sanki bir `T` tutuyormuş gibi davran” der. Kullanılmayan tip
  parametresi E0392 verir. Birimler/para birimleri gibi **tip düzeyi etiketler** için ideal; marker tipleri
  varyantsız `enum`'larla tanımla.
- `#[derive(Clone, Copy, ...)]` her tip parametresine gizli sınır ekler (`B: Clone`), `PhantomData<B>`
  olsa bile.
- **Marker trait**: metotsuz söz (`Copy`, `Eq`, `Send`, `Sync`, `Unpin`, `Sized`). `Send`/`Sync`/`Unpin`
  **otomatiktir** ve `PhantomData` bu hesaba girer: `PhantomData<Rc<()>>` bir tipi `!Send` yapar.
- **Sealed trait**: `pub trait A: gizli::Muhur` (özel modülde `pub trait Muhur`). Herkes kullanır, yalnızca
  crate uygular; yeni metot eklemek kırıcı olmaz.
- **GAT**: `type Oge<'a> where Self: 'a;` ilişkili tipin kendi generic parametresi olur. Kendinden ödünç
  veren (lending) iterator'ları mümkün kılar (`for` yok, `while let` var).
- **RPITIT**: `fn f(&self) -> impl Iterator<..>;` trait'lerde (1.75+). Her impl kendi gizli tipini döndürür;
  trait dyn uyumlu olmaz (E0038). `impl Trait` `let`/alan/takma adda yasak (E0562). Edition 2024'te bütün
  yaşam sürelerini yakalar; daraltmak için `+ use<..>`.
:::

```reflect
prompt: |
  `Para<Tl>` ile `Para<Euro>` bellekte birebir aynı (8 bayt) olduğu hâlde Rust onları nasıl ayırt ediyor?
  `PhantomData` olmasaydı neden derleyici `struct Para<B> { kurus: i64 }` tanımını reddederdi? Bu
  yaklaşımın Python ya da C'de bir `birim` alanı tutmaktan farkını açıkla.
answer: |
  Ayrım tamamen **derleme zamanında**, tipler üzerinden yapılır: `Para<Tl>` ve `Para<Euro>` farklı
  tiplerdir. `Add` yalnızca `Para<B> + Para<B>` için tanımlandığı için karışık toplama derlenmez.
  Derlemeden sonra birim bilgisi silinir; çalışma anında ne bir alan ne de bir kontrol vardır.

  `PhantomData` olmadan `B` hiçbir alanda geçmezdi. Derleyici `B`'nin struct'la ilişkisini (sahiplik mi,
  referans mı, hiçbiri mi) bilemez. Bu bilgi `Send`/`Sync` hesabı, drop kontrolü ve yaşam süreleri için
  gerekir; bu yüzden E0392 verir. `PhantomData<B>` “sanki bir `B` tutuyorum” diyerek bu boşluğu sıfır
  maliyetle doldurur.

  Python'da ya da C'de bir `birim` alanı tutsaydık her değer o alan için yer kaplardı ve uyuşmazlık ancak
  **çalışma anında**, biri kontrol etmeyi unutmazsa yakalanırdı. Mars sondasında olduğu gibi kimse kontrol
  etmezse hata sessizce geçerdi. Rust'ta kontrol unutulamaz, çünkü onu derleyici yapar.
```

```flashcards
- front: "`PhantomData<T>` kaç bayttır ve derleyiciye ne söyler?"
  back: "0 bayt. “Bu struct sanki bir `T` tutuyormuş gibi davranmalı” der: otomatik trait'ler, drop kontrolü ve yaşam süreleri buna göre hesaplanır."
- front: "E0392 hatası ne anlama gelir, tipik çözümü nedir?"
  back: "“type parameter is never used”: Bir tip parametresi hiçbir alanda geçmiyor. Çözüm: `birim: PhantomData<B>` gibi bir marker alan eklemek."
- front: "`#[derive(Clone, Copy)] struct Uzunluk<B> { deger: f64, birim: PhantomData<B> }` neden `B` `Copy` değilse `Copy` olmaz?"
  back: "`derive` her tip parametresine gizli sınır ekler: `impl<B: Clone> Clone ...`, `impl<B: Copy> Copy ...`. Alanın `PhantomData` olması bunu değiştirmez."
- front: "Marker trait nedir? Otomatik olan üç tanesini say."
  back: "Metodu olmayan, bir tip hakkında bir şey söyleyen trait. Otomatik olanlar: `Send`, `Sync`, `Unpin` (alanların hepsi uyguluyorsa tip de uygular)."
- front: "Bir struct'ı (negatif impl kullanmadan) `!Send` yapmanın kararlı yolu nedir?"
  back: "`Send` olmayan bir tiple `PhantomData` alanı eklemek: `_tek_thread: PhantomData<Rc<()>>` (ya da `PhantomData<*const ()>`)."
- front: Sealed trait deseni nasıl kurulur ve ne sağlar?
  back: "Özel bir modülde `pub trait Muhur {}` tanımlanır, `pub trait A: gizli::Muhur` yazılır. Dışarıdakiler `A`'yı kullanabilir ama uygulayamaz; trait'e metot eklemek kırıcı değişiklik olmaz."
- front: "GAT nedir? Hangi problemi çözer?"
  back: "Kendi generic parametresi olan ilişkili tip: `type Oge<'a> where Self: 'a;`. Öğeleri iterator'ın kendisinden ödünç veren (lending) iterator'ları yazmayı sağlar."
- front: "RPITIT nedir ve trait'e ne bedeli vardır?"
  back: "Trait metodunda `-> impl Trait` döndürmek (Rust 1.75+). Her impl kendi gizli tipini döndürür. Bedeli: trait dyn uyumlu olmaz (E0038)."
```
