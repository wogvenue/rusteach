---
id: m22-l02
title: Tam nitelikli sözdizimi ve supertrait'ler
minutes: 24
type: lesson
objectives:
  - "Aynı isimli metotlar arasındaki belirsizliği `Trait::metot(&x)` ve `<Tip as Trait>::fonksiyon()` ile çözebilmek"
  - "`trait A: B + C` biçiminde supertrait tanımlayıp supertrait'in metotlarını varsayılan metotlarda kullanabilmek"
  - "Newtype desenini yabancı trait uygulamak, anlamsal tip güvenliği ve `Deref` ile sarmalama için doğru yerde kullanabilmek"
keywords: [tam nitelikli sözdizimi, fully qualified syntax, "<T as Trait>", supertrait, newtype, Deref, E0034, E0790, orphan rule]
---

Ayşe Hanım üniversitede hem **doçent** hem de **bölüm başkanı**. Ona “unvanınız nedir?” diye
sorduğunda iki doğru cevap var. Kodda da durum aynı: Bir tip, aynı isimde metodu olan iki trait'i
birlikte uygulayabilir. Rust bu durumda tahmin yürütmez, **sana sorar**. Bu derste o soruyu
cevaplamanın yolunu, yani **tam nitelikli sözdizimini (fully qualified syntax)** öğreneceksin.

Sonra trait'leri birbirine bağlayacağız: “Bu trait'i uygulamak isteyen önce şunu da uygulamalı” demenin
yolu olan **supertrait**'ler. Son olarak Modül 6'da tanıştığın, Modül 11 ve 20'de kullandığın **newtype** desenini derinleştireceğiz.

## Aynı isimde iki metot

Bir insan hem pilot hem de büyücü olabilir mi? Rust'ta olabilir. Tahmin et:

```predict
code: |
  trait Pilot {
      fn uc(&self);
  }

  trait Buyucu {
      fn uc(&self);
  }

  struct Insan;

  impl Pilot for Insan {
      fn uc(&self) {
          println!("Kaptanınız konuşuyor.");
      }
  }

  impl Buyucu for Insan {
      fn uc(&self) {
          println!("Süpürgeye bin!");
      }
  }

  impl Insan {
      fn uc(&self) {
          println!("*kollarını çırpıyor*");
      }
  }

  fn main() {
      let kisi = Insan;
      kisi.uc();
      Pilot::uc(&kisi);
      Buyucu::uc(&kisi);
  }
options:
  - |
    *kollarını çırpıyor*
    Kaptanınız konuşuyor.
    Süpürgeye bin!
  - |
    Kaptanınız konuşuyor.
    Kaptanınız konuşuyor.
    Süpürgeye bin!
  - Derlenmez; `uc` belirsiz
answer: 0
explanation: |
  `kisi.uc()` yazınca derleyici önce tipin **kendi** (inherent) metotlarına bakar: `impl Insan`'daki `uc`
  kazanır. Trait'lerin metotlarını çağırmak için hangi trait'i istediğini söylemelisin:
  `Pilot::uc(&kisi)`. Metot çağrısı sözdizimindeki gizli `&kisi`'yi burada elle veriyoruz.
```

Metot çağrısı (`kisi.uc()`) aslında bir kısaltmadır. Derleyici onu bir **fonksiyon yolu** çağrısına
çevirir ve `self`'i ilk argüman yapar:

| Yazdığın | Derleyicinin gördüğü |
|---|---|
| `kisi.uc()` | `Insan::uc(&kisi)` (kendi metodu varsa o) |
| `Pilot::uc(&kisi)` | `<Insan as Pilot>::uc(&kisi)` |
| `Buyucu::uc(&kisi)` | `<Insan as Buyucu>::uc(&kisi)` |

Peki tipin kendi `uc` metodu olmasaydı? O zaman iki trait metodu da aynı derecede uygun olurdu ve
derleyici seçim yapmayı reddederdi:

:::error
```text
error[E0034]: multiple applicable items in scope
  --> src/main.rs:25:10
   |
25 |     kisi.uc();
   |          ^^ multiple `uc` found
   |
note: candidate #1 is defined in an impl of the trait `Buyucu` for the type `Insan`
  --> src/main.rs:18:5
   |
18 |     fn uc(&self) {
   |     ^^^^^^^^^^^^
note: candidate #2 is defined in an impl of the trait `Pilot` for the type `Insan`
  --> src/main.rs:12:5
   |
12 |     fn uc(&self) {
   |     ^^^^^^^^^^^^
help: disambiguate the method for candidate #1
   |
25 -     kisi.uc();
25 +     Buyucu::uc(&kisi);
```
`help:` satırları çözümü hazır veriyor. Python'daki çoklu kalıtımda (`class Insan(Pilot, Buyucu)`)
böyle bir çakışma sessizce MRO sırasına göre çözülür ve hangisinin çağrıldığını bilmek için sınıf
hiyerarşisini ezberlemen gerekir. Rust ise belirsizliği bir derleme hatasına çevirir.
:::

Bir ayrıntı: Bir trait'in metodunu `x.metot()` biçiminde çağırabilmek için trait'in **kapsamda**
olması gerekir (Modül 8: `use`). İki trait'ten yalnızca birini `use` ile kapsama aldıysan çakışma da
olmaz. Bu yüzden iki farklı crate'in aynı isimli metotları çoğu zaman sorun çıkarmaz.

:::analogy İki kulübün kaptanı
Okulda Ayşe hem basketbol hem satranç takımının kaptanı. Müdür anonsta “Kaptan Ayşe toplantıyı
başlatsın!” derse hangi toplantı olduğu belli değildir. “**Satranç takımının** kaptanı olarak Ayşe”
dendiğinde belirsizlik kalkar. `Buyucu::uc(&kisi)` tam olarak budur: hangi **rolde** çağırdığını
söylemek.
:::

## İlişkili fonksiyonlar: Tip as Trait

`self` almayan ilişkili fonksiyonlarda (Modül 6'daki `String::from` gibi) işler biraz daha zorlaşır,
çünkü derleyicinin tipi çıkarabileceği bir argüman yoktur. Bir hayvan barınağı uygulamasında köpek
yavrusunun adını soralım:

```compiles
code: |
  trait Hayvan {
      fn yavru_adi() -> String;
  }

  struct Kopek;

  impl Kopek {
      fn yavru_adi() -> String {
          String::from("Karabaş") // barınaktaki yavrunun adı
      }
  }

  impl Hayvan for Kopek {
      fn yavru_adi() -> String {
          String::from("enik") // köpek yavrusuna genel olarak verilen ad
      }
  }

  fn main() {
      println!("{}", Hayvan::yavru_adi());
  }
answer: false
error: E0790
explanation: |
  `Hayvan::yavru_adi()` hangi tipin impl'ini istediğini söylemiyor: `Kopek` mu, ileride yazılacak
  `Kedi` mi? `self` olmadığı için derleyicinin tipi çıkarabileceği bir ipucu da yok.
```

:::error
```text
error[E0790]: cannot call associated function on trait without specifying the corresponding `impl` type
  --> src/main.rs:20:20
   |
 2 |     fn yavru_adi() -> String;
   |     ------------------------- `Hayvan::yavru_adi` defined here
...
20 |     println!("{}", Hayvan::yavru_adi());
   |                    ^^^^^^^^^^^^^^^^^^^ cannot call associated function of trait
   |
help: use the fully-qualified path to the only available implementation
   |
20 |     println!("{}", <Kopek as Hayvan>::yavru_adi());
   |                    +++++++++       +
```
:::

Çözüm, derleyicinin de önerdiği **tam nitelikli sözdizimidir**:

```text
<Tip as Trait>::fonksiyon(alıcı_varsa, diğer_argümanlar...)
```

“`Kopek` tipini `Hayvan` olarak ele al ve onun `yavru_adi`'sini çağır” diye okunur. En uzun ama en
kesin yazımdır. Her zaman kullanabilirsin, ama gerektiğinde, yani başka hiçbir yazım belirsizliği
çözemediğinde kullanman yeterli:

```rust
trait Hayvan {
    fn yavru_adi() -> String;
    fn ses(&self) -> String;
}

struct Kopek;

impl Kopek {
    fn yavru_adi() -> String {
        String::from("Karabaş")
    }
}

impl Hayvan for Kopek {
    fn yavru_adi() -> String {
        String::from("enik")
    }

    fn ses(&self) -> String {
        String::from("hav")
    }
}

fn main() {
    println!("Barınaktaki yavru: {}", Kopek::yavru_adi());
    println!("Köpek yavrusuna denir: {}", <Kopek as Hayvan>::yavru_adi());

    let k = Kopek;
    println!("{}", k.ses()); // belirsizlik yok, kısa yazım yeterli
    println!("{}", <Kopek as Hayvan>::ses(&k)); // aynı çağrının en uzun hâli

    // Standart kütüphane trait'leriyle de çalışır:
    let bos: Vec<u8> = <Vec<u8> as Default>::default();
    println!("{bos:?} {}", <i32 as Default>::default());
}
```

Tam nitelikli yazımı bir de ilişkili **tiplerde** görürsün. Generic kodda `T::Item` yazmak, `T`'nin
sınırlarından yalnızca birinde `Item` diye bir ilişkili tip varsa yeterlidir. İki trait'te de `Item`
varsa `<T as Iterator>::Item` yazarak hangisini kastettiğini söylersin. Derleyici hata mesajlarında da
tipleri bu biçimde gösterir; artık `<std::vec::IntoIter<i32> as Iterator>::Item` gibi bir satırı
okuyabilirsin.

```fill
prompt: |
  Barınak uygulamasında `Kedi` için **trait'in** tanımladığı yavru adını yazdır. Tipin kendi
  `yavru_adi` fonksiyonu da var; onu değil, trait'inkini çağır.
code: |
  trait Hayvan {
      fn yavru_adi() -> String;
  }

  struct Kedi;

  impl Kedi {
      fn yavru_adi() -> String {
          String::from("Tekir")
      }
  }

  impl Hayvan for Kedi {
      fn yavru_adi() -> String {
          String::from("yavru kedi")
      }
  }

  fn main() {
      println!("{}", <___0 as ___1>::yavru_adi());
  }
blanks:
  - ["Kedi"]
  - ["Hayvan"]
output: yavru kedi
explanation: |
  `<Kedi as Hayvan>::yavru_adi()`: önce **tip**, `as`'ten sonra **trait**. Yalnızca `Kedi::yavru_adi()`
  yazsaydın tipin kendi fonksiyonu kazanır ve `Tekir` yazılırdı; yalnızca `Hayvan::yavru_adi()`
  yazsaydın `E0790` alırdın.
```

## Supertrait'ler: bir trait'in ön koşulu

Bazen bir trait, işini yapabilmek için başka bir trait'in yeteneklerine ihtiyaç duyar. Bir değeri
yıldızlarla çerçeveleyerek yazdıran bir trait düşün: Çerçeveyi çizmek için değeri önce metne çevirmesi
gerekir, yani tipin `Display` olması şarttır. Bunu `trait Cerceveli: fmt::Display` diye yazarız.
Tahmin et, `Nokta` için derlenir mi?

```compiles
code: |
  use std::fmt;

  trait Cerceveli: fmt::Display {
      fn cerceveli_yaz(&self) {
          let metin = self.to_string();
          println!("* {metin} *");
      }
  }

  struct Nokta {
      x: i32,
      y: i32,
  }

  impl Cerceveli for Nokta {}

  fn main() {
      let n = Nokta { x: 1, y: 3 };
      n.cerceveli_yaz();
      println!("{}", n.x + n.y);
  }
answer: false
error: E0277
explanation: |
  `trait Cerceveli: fmt::Display`, “`Cerceveli`'yi uygulayan her tip `Display`'i de uygulamalı” demektir.
  `Nokta` `Display` uygulamadığı için `impl Cerceveli for Nokta` reddedilir. Gövde boş olsa bile ön koşul
  sağlanmalıdır.
```

:::error
```text
error[E0277]: `Nokta` doesn't implement `std::fmt::Display`
  --> src/main.rs:15:20
   |
15 | impl Cerceveli for Nokta {}
   |                    ^^^^^ unsatisfied trait bound
   |
help: the trait `std::fmt::Display` is not implemented for `Nokta`
  --> src/main.rs:10:1
   |
10 | struct Nokta {
   | ^^^^^^^^^^^^
note: required by a bound in `Cerceveli`
  --> src/main.rs:3:18
   |
 3 | trait Cerceveli: fmt::Display {
   |                  ^^^^^^^^^^^^ required by this bound in `Cerceveli`
```
`required by a bound in Cerceveli`: Sorun impl'in içinde değil, trait'in **tanımındaki** ön koşulda.
:::

`trait Cerceveli: fmt::Display` satırında `Display`, `Cerceveli`'nin **supertrait**'idir (üst trait).
Çözüm iki ayrı impl yazmaktır:

```rust
use std::fmt;

trait Cerceveli: fmt::Display {
    fn cerceveli_yaz(&self) {
        let metin = self.to_string(); // Display'den geliyor
        let genislik = metin.chars().count() + 4;
        println!("{}", "*".repeat(genislik));
        println!("* {metin} *");
        println!("{}", "*".repeat(genislik));
    }
}

struct Nokta {
    x: i32,
    y: i32,
}

impl fmt::Display for Nokta {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

impl Cerceveli for Nokta {} // varsayılan metot yeterli

struct Sehir(String);

impl fmt::Display for Sehir {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Cerceveli for Sehir {}

fn main() {
    Nokta { x: 1, y: 3 }.cerceveli_yaz();
    Sehir(String::from("Şanlıurfa")).cerceveli_yaz();
}
```

`"*".repeat(n)` bir `&str`'yi `n` kez tekrarlayan yeni bir `String` üretir. Genişliği `len()` ile değil
`chars().count()` ile hesapladık: `Şanlıurfa`'da `Ş` ve `ı` ikişer bayt (Modül 9). `len()` kullansaydık
çerçeve iki karakter fazla çıkardı.

Supertrait **kalıtım değildir**. `Cerceveli` uygulamak `Display`'i kendiliğinden uygulamaz; iki impl'i
de sen yazarsın. Kazancın şudur: `Cerceveli`'nin varsayılan metotlarında ve `T: Cerceveli` sınırı
olan her generic fonksiyonda `Display`'in yeteneklerini (`to_string`, `{}`) **ek sınır yazmadan**
kullanabilirsin. Java'daki `interface Cerceveli extends Display` buna benzer; fark, Rust'ta bunun
bir “gereksinim” olarak ifade edilmesi ve yapı (struct) kalıtımı olmamasıdır.

:::analogy Ehliyet sınıfları
Kamyon ehliyeti (C sınıfı) almak için önce otomobil ehliyetine (B sınıfı) sahip olmak gerekir. C sınıfı
ehliyet sana B'yi **vermez**; B'yi önceden ayrıca kazanmış olmalısın. Ama birinin C ehliyeti varsa
otomobil de kullanabildiğini kesin olarak bilirsin. `trait C: B` aynen böyledir: `C`'yi uygulayan
her tipte `B`'nin metotlarının var olduğunu derleyici garanti eder.
:::

## Supertrait'ler her yerde

Supertrait'ler standart kütüphanenin yapı taşlarından biri. Birkaçını zaten kullandın:

| Tanım | Anlamı |
|---|---|
| `trait Copy: Clone` | Her `Copy` tip `Clone`'dur (Modül 11: “Copy, Clone'u gerektirir”) |
| `trait Eq: PartialEq` | Tam eşitlik, kısmi eşitliğin güçlü hâlidir |
| `trait Ord: Eq + PartialOrd` | Birden çok supertrait `+` ile yazılır |
| `trait Error: Debug + Display` | Hata tipleri yazdırılabilmeli (Modül 11) |
| `trait FnMut: FnOnce`, `trait Fn: FnMut` | Modül 14'teki closure trait'lerinin hiyerarşisi |

Supertrait'li trait'ler **trait nesneleriyle** de çalışır (Modül 20). `&dyn Cerceveli`'nin vtable'ı,
supertrait'in metotlarını da içerir; yani `nesne.to_string()` bir `&dyn Cerceveli` üzerinden de
çağrılabilir. Rust 1.86'dan beri bir `&dyn Cerceveli`'yi doğrudan `&dyn fmt::Display`'e dönüştürmek de
mümkündür (*trait upcasting*).

Supertrait'lerin pratik bir kullanımı da sık tekrarlanan sınır listelerine **isim vermektir**. Bir
istatistik modülünde her fonksiyon `T: Add<Output = T> + Copy + PartialOrd + Default` istiyorsa:

```rust
use std::ops::Add;

// "Sayı gibi davranan" tipler için bir isim
trait SayiGibi: Add<Output = Self> + Copy + PartialOrd + Default {}

// Blanket impl (Modül 11): sınırları sağlayan HER tip otomatik olarak SayiGibi olur
impl<T: Add<Output = T> + Copy + PartialOrd + Default> SayiGibi for T {}

fn toplam<T: SayiGibi>(dizi: &[T]) -> T {
    let mut t = T::default();
    for &x in dizi {
        t = t + x;
    }
    t
}

fn en_buyuk<T: SayiGibi>(dizi: &[T]) -> T {
    let mut m = dizi[0];
    for &x in dizi {
        if x > m {
            m = x;
        }
    }
    m
}

fn main() {
    let adimlar = [8_000_u32, 12_500, 6_300];
    let sicakliklar = [21.5, 25.0, 19.75];
    println!("{} adım, en çok {}", toplam(&adimlar), en_buyuk(&adimlar));
    println!("{} toplam, en sıcak {}", toplam(&sicakliklar), en_buyuk(&sicakliklar));
}
```

Gövdede `+` (`Add`), `for &x in` ile kopyalama (`Copy`), `>` (`PartialOrd`) ve `T::default()`
(`Default`) kullanıldı. Hepsi tek bir `T: SayiGibi` sınırından geldi; çünkü supertrait'ler, sınırın
ima ettiği yetenekler olarak generic koda açılır. Bu desene bazen “trait takma adı (trait alias)” denir;
gerçek `trait alias` sözdizimi henüz kararlı değil.

```quiz
question: |
  `trait Hayvan: Ses { fn ad(&self) -> String; }` tanımlı. `Kedi` için yalnızca
  `impl Hayvan for Kedi { fn ad(&self) -> String { String::from("Tekir") } }` yazdın. Ne olur?
options:
  - "Derlenir; `Ses` metotları `Hayvan` üzerinden kalıtımla gelir"
  - "Derlenmez; `Kedi` için ayrıca `impl Ses for Kedi` yazılmalı"
  - "Derlenir ama `Ses` metotları çağrılınca panik olur"
  - "Derlenir; `Ses`'in bütün metotlarının varsayılan gövdesi olduğu varsayılır"
answer: 1
explanation: |
  Supertrait bir **ön koşuldur**, otomatik bir uygulama değil. `Ses` için ayrı bir impl yazmadıkça
  `E0277` (“the trait bound `Kedi: Ses` is not satisfied”) alırsın. `Ses`'in bütün metotlarının
  varsayılan gövdesi olsa bile boş bir `impl Ses for Kedi {}` satırı yine gerekir.
feedback:
  - "Rust'ta kalıtım yok; supertrait yalnızca “önce bunu da uygula” der."
  - "Doğru!"
  - "Rust bu tür sorunları çalışma anına bırakmaz; derleme zamanında yakalanır."
  - "Varsayılan gövdeler bile ancak bir `impl` bloğu yazıldığında devreye girer."
```

Şimdi tam nitelikli sözdizimi ile supertrait'leri bir arada kullan:

```exercise
id: m22-l02-e-kartvizit
title: Çift unvanlı personel kartı
difficulty: 3
prompt: |
  Bir üniversitenin personel sisteminde `Personel` iki rol taşıyor: `Akademik` (ör. `Doç. Dr.`) ve
  `Idari` (ör. `Bölüm Başkanı`). İki trait'in de metodu `unvan` adını taşıyor (impl'ler hazır).

  1. **`Display for Personel`**: akademik unvan + ad, ör. `Doç. Dr. Ayşe Yılmaz`.
  2. **`Kartvizit` trait'inin varsayılan `kartvizit` metodu** (`Display` supertrait'i sayesinde her tipte
     çalışacak): değerin `Display` metnini 3 satırlık bir çerçeveye alır:
     ```text
     +----------------------+
     | Doç. Dr. Ayşe Yılmaz |
     +----------------------+
     ```
     Kenar: `+`, ardından metnin **karakter** sayısı + 2 kadar `-`, sonra `+`. Satırlar `\n` ile
     ayrılır, sonda `\n` yoktur.
  3. **`tam_unvan(p: &Personel) -> String`**: `Doç. Dr. Ayşe Yılmaz (Bölüm Başkanı)`. İki trait'in
     `unvan` metodunu da tam nitelikli sözdizimiyle çağır.
starter: |
  use std::fmt;

  trait Akademik {
      fn unvan(&self) -> String;
  }

  trait Idari {
      fn unvan(&self) -> String;
  }

  trait Kartvizit: fmt::Display {
      fn kartvizit(&self) -> String {
          todo!()
      }
  }

  struct Personel {
      ad: String,
      akademik: String,
      gorev: String,
  }

  impl Akademik for Personel {
      fn unvan(&self) -> String {
          self.akademik.clone()
      }
  }

  impl Idari for Personel {
      fn unvan(&self) -> String {
          self.gorev.clone()
      }
  }

  impl fmt::Display for Personel {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  impl Kartvizit for Personel {}

  fn tam_unvan(p: &Personel) -> String {
      todo!()
  }

  fn main() {
      let ayse = Personel {
          ad: String::from("Ayşe Yılmaz"),
          akademik: String::from("Doç. Dr."),
          gorev: String::from("Bölüm Başkanı"),
      };
      println!("{}", ayse.kartvizit());
      println!("{}", tam_unvan(&ayse));
  }
solution: |
  use std::fmt;

  trait Akademik {
      fn unvan(&self) -> String;
  }

  trait Idari {
      fn unvan(&self) -> String;
  }

  trait Kartvizit: fmt::Display {
      fn kartvizit(&self) -> String {
          let metin = self.to_string();
          let kenar = format!("+{}+", "-".repeat(metin.chars().count() + 2));
          format!("{kenar}\n| {metin} |\n{kenar}")
      }
  }

  struct Personel {
      ad: String,
      akademik: String,
      gorev: String,
  }

  impl Akademik for Personel {
      fn unvan(&self) -> String {
          self.akademik.clone()
      }
  }

  impl Idari for Personel {
      fn unvan(&self) -> String {
          self.gorev.clone()
      }
  }

  impl fmt::Display for Personel {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{} {}", Akademik::unvan(self), self.ad)
      }
  }

  impl Kartvizit for Personel {}

  fn tam_unvan(p: &Personel) -> String {
      format!("{} {} ({})", <Personel as Akademik>::unvan(p), p.ad, <Personel as Idari>::unvan(p))
  }

  fn main() {
      let ayse = Personel {
          ad: String::from("Ayşe Yılmaz"),
          akademik: String::from("Doç. Dr."),
          gorev: String::from("Bölüm Başkanı"),
      };
      println!("{}", ayse.kartvizit());
      println!("{}", tam_unvan(&ayse));
  }
check: tests
tests: |
  fn ornek() -> Personel {
      Personel {
          ad: String::from("Ayşe Yılmaz"),
          akademik: String::from("Doç. Dr."),
          gorev: String::from("Bölüm Başkanı"),
      }
  }

  struct Etiket(&'static str);

  impl fmt::Display for Etiket {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}", self.0)
      }
  }

  impl Kartvizit for Etiket {}

  #[test]
  fn display_akademik_unvan_ve_ad() {
      assert_eq!(ornek().to_string(), "Doç. Dr. Ayşe Yılmaz", "Display: akademik unvan + boşluk + ad");
      let p = Personel { ad: String::from("Can Ak"), akademik: String::from("Prof. Dr."), gorev: String::from("Dekan") };
      assert_eq!(p.to_string(), "Prof. Dr. Can Ak");
  }

  #[test]
  fn tam_unvan_iki_rolu_birlestirir() {
      assert_eq!(tam_unvan(&ornek()), "Doç. Dr. Ayşe Yılmaz (Bölüm Başkanı)");
      let p = Personel { ad: String::from("Can Ak"), akademik: String::from("Prof. Dr."), gorev: String::from("Dekan") };
      assert_eq!(tam_unvan(&p), "Prof. Dr. Can Ak (Dekan)", "İdari unvan parantez içinde olmalı");
  }

  #[test]
  fn kartvizit_turkce_karakterleri_dogru_sayar() {
      let beklenen = "+----------------------+\n| Doç. Dr. Ayşe Yılmaz |\n+----------------------+";
      assert_eq!(ornek().kartvizit(), beklenen, "Genişlik bayt değil karakter sayısına göre hesaplanmalı (ç, ş, ı ikişer bayttır)");
  }

  #[test]
  fn kartvizit_her_display_tipinde_calisir() {
      assert_eq!(Etiket("çay").kartvizit(), "+-----+\n| çay |\n+-----+", "Varsayılan metot yalnızca Display'e dayanmalı");
      assert_eq!(Etiket("").kartvizit(), "+--+\n|  |\n+--+", "Boş metinde bile çerçeve çizilmeli");
  }
hints:
  - "`Display`: `write!(f, \"{} {}\", Akademik::unvan(self), self.ad)`. `self.unvan()` yazarsan iki trait arasında kalırsın (`E0034`)."
  - "`kartvizit` içinde `self.to_string()` kullanabilirsin, çünkü `Display` supertrait. Genişlik için `metin.chars().count()`; tekrar için `\"-\".repeat(n)`."
  - "`let kenar = format!(\"+{}+\", \"-\".repeat(metin.chars().count() + 2));` ve sonra `format!(\"{kenar}\\n| {metin} |\\n{kenar}\")`. `tam_unvan` için `<Personel as Idari>::unvan(p)`."
require:
  - pattern: "(Idari::unvan|as\\s+Idari\\s*>::unvan)"
    message: "İdari unvanı tam nitelikli sözdizimiyle çağır: `Idari::unvan(p)` ya da `<Personel as Idari>::unvan(p)`."
explanation: |
  `Kartvizit`'in varsayılan metodu `Personel` hakkında **hiçbir şey** bilmiyor; yalnızca supertrait
  `Display`'e dayanıyor. Bu yüzden testlerdeki `Etiket` gibi, senin hiç görmediğin bir tip de tek satırlık
  `impl Kartvizit for Etiket {}` ile çerçeveli kartvizit kazandı.

  `Akademik::unvan(self)` ile `<Personel as Akademik>::unvan(self)` aynı çağrıdır; ilki, `self`'in tipi
  belli olduğu için yeterlidir. Uzun biçim, ancak tip çıkarılamadığında (ilişkili fonksiyonlarda) zorunludur.

  Genişliği `len()` ile hesaplasaydın `Doç. Dr. Ayşe Yılmaz` için 23 bayt bulup çerçeveyi 3 karakter
  geniş çizerdin. Görsel hizalamada `chars().count()` bile bazen yetmez (birleşik emojiler gibi
  grapheme cluster'lar, Modül 9). Ama Türkçe metinler için doğru sonuç verir.
```

## Newtype deseni derinlemesine

Modül 11'de newtype ile orphan rule'u aşmıştın: `struct Sepet(Vec<String>);` senin tipin olduğu için
ona `Display` uygulayabiliyordun. Modül 20'de de değişmezleri (invariant) korumak için kullandın. Burada
desenin üç farklı görevini yan yana koyalım.

**1. Yabancı tipe yabancı trait.** `Vec<String>` için `Display` yazamazsın (`E0117`), ama bir
sarmalayıcıya yazabilirsin:

```rust
use std::fmt;
use std::ops::Deref;

struct Etiketler(Vec<String>);

impl fmt::Display for Etiketler {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for (i, e) in self.0.iter().enumerate() {
            if i > 0 {
                write!(f, " ")?;
            }
            write!(f, "#{e}")?;
        }
        Ok(())
    }
}

// İçteki Vec'in &self metotlarını (len, contains, iter, first...) dışarı açar
impl Deref for Etiketler {
    type Target = Vec<String>;

    fn deref(&self) -> &Vec<String> {
        &self.0
    }
}

fn main() {
    let gonderi = Etiketler(vec![String::from("rust"), String::from("kapadokya")]);
    println!("{gonderi}");
    println!("{} etiket, ilki: {:?}", gonderi.len(), gonderi.first());
}
```

`gonderi.len()` derlendi, çünkü Modül 17'deki **deref zorlaması (deref coercion)** devreye girdi:
`Etiketler`'de `len` yok, derleyici `*gonderi`'ye, yani `Vec<String>`'e bakıp orada buldu.

**2. Anlamsal tip güvenliği.** İki kimlik numarası da `u64` olabilir, ama birbirinin yerine
geçmemelidir. Tahmin et:

```compiles
code: |
  struct KullaniciId(u64);
  struct SiparisId(u64);

  fn siparis_getir(id: SiparisId) -> String {
      format!("sipariş #{}", id.0)
  }

  fn main() {
      let kullanici = KullaniciId(42);
      println!("{}", siparis_getir(kullanici));
  }
answer: false
error: E0308
explanation: |
  İkisi de bellekte bir `u64`'ten ibaret, ama tipleri farklı: `expected SiparisId, found KullaniciId`.
  Sıradan `u64` parametreleri kullansaydık bu karışıklık sessizce derlenir ve 42 numaralı kullanıcının
  yerine 42 numaralı sipariş getirilirdi. Modül 6'daki `Metre`/`Fit` örneğinin aynısı.
```

**3. Kapsülleme.** Sarmalayıcı, içteki tipin hangi yeteneklerini dışarı açacağına **sen** karar
verirsin. `Deref` her şeyi (bütün `&self` metotlarını) açar; yalnızca seçtiğin metotları sarmalamak
(`fn ekle(&mut self, ...)`) ise değişmezleri korur. Örneğin “etiketler boş olamaz” kuralın varsa
`DerefMut` uygulamamalısın, yoksa dışarıdan biri `gonderi.clear()` çağırabilir.

:::warning Deref ile kalıtım taklidi yapma
`Deref`'i “`Etiketler` bir `Vec`'tir” demek için, yani Java'daki `extends` gibi kullanmak cazip gelebilir.
Rust topluluğu bunu bir **anti-desen** sayar: `Deref`, akıllı işaretçiler ve “şeffaf sarmalayıcılar” için
tasarlandı. Ayrıca trait'ler deref ile aktarılmaz: `Vec<String>` `Clone` olsa da `Etiketler` olmaz;
`fn f(v: &Vec<String>)` fonksiyonuna `&gonderi` verebilirsin (zorlama), ama `T: Clone` isteyen bir
generic fonksiyona veremezsin. Sarmalayıcının ihtiyaç duyduğu trait'leri `#[derive]` ya da elle ayrıca
uygulaman gerekir.
:::

Newtype'ın çalışma anında bedeli yoktur: `Etiketler` bellekte bir `Vec<String>` ile birebir aynı
yeri kaplar (Modül 11'deki bellek diyagramı). Bütün maliyet, yazdığın birkaç satır sarmalayıcı koddur.

:::deep Orphan rule'un tam hâli
Modül 11'de kuralın basit hâlini gördün: trait ya da tip yerel olmalı. Kesin kural şudur:
`impl<P1..Pn> YabanciTrait<T1..Tn> for T0` ancak şu durumda yazılabilir:

1. `T0..Tn` arasında en az bir **yerel** tip var, ve
2. o ilk yerel tipten **önce** gelen tiplerde “örtülmemiş” (uncovered) bir tip parametresi yok.
   Bir parametre başka bir tipin içinde geçiyorsa (`Vec<T>`) örtülmüştür; çıplak `T` ise örtülmemiştir.

```text
impl From<Haber> for String        ✅ T1 = Haber yerel
impl<T> From<Haber> for Vec<T>     ✅ T0 = Vec<T>'deki T örtülü, T1 yerel
impl<T> fmt::Display for T         ❌ E0210: T örtülmemiş ve yerel tip yok
impl fmt::Display for Box<Haber>   ✅ Box, &, &mut ve Pin "temel" (fundamental) tiplerdir;
                                      Box<Haber> yerel sayılır
impl fmt::Display for Vec<Haber>   ❌ E0117: Vec temel değil, Vec<Haber> yabancıdır
```

Bu kuralların amacı hep aynı: İki crate'in aynı (trait, tip) çifti için birbirinden habersiz iki impl
yazamaması ve bir crate'in yeni impl eklemesinin başkasının kodunu kırmaması.
:::

```quiz
question: |
  Bir kütüphane uygulamasında `struct Isbn(String);` tanımladın ve `impl Deref for Isbn { type Target = String; ... }`
  yazdın, ama `Isbn`'ye `#[derive(Clone)]` **eklemedin**. `let kopya = isbn.clone();` satırından sonra
  `kopya`'nın tipi nedir?
options:
  - "`Isbn`"
  - "`String`"
  - "`&Isbn`"
  - "Hiçbiri; satır derlenmez çünkü `Isbn` `Clone` değil"
answer: 1
explanation: |
  Metot araması önce `Isbn`'de `clone` arar ve bulamaz (`Isbn: Clone` yok). Sonra deref zinciriyle
  `String`'e iner ve `String::clone`'u bulur. Sonuç bir `String`'dir, `Isbn` değil! `let kopya: Isbn =
  isbn.clone();` yazsaydın `E0308` (“expected `Isbn`, found `String`”) alırdın. Ders: Trait'ler deref
  ile **aktarılmaz**; sarmalayıcının `Clone` olmasını istiyorsan `#[derive(Clone)]` eklemelisin.
  `isbn.len()`, `isbn.starts_with("978")` ve `fn yaz(s: &str)`'ye `&isbn` vermek ise aynı mekanizmayla,
  tam istediğin gibi çalışır.
feedback:
  - "`Isbn` `Clone` uygulamadığı için `Isbn::clone` diye bir metot yok."
  - "Doğru! Deref, `clone` aramasını `String`'e taşıdı. Sessiz ama gerçek bir tuzak."
  - "Metot araması `Isbn` alıcısıyla başlar ve deref zincirinde ilk bulduğu `String::clone` olur."
  - "Derlenir: Derleyici `clone`'u deref ile `String`'de bulur."
```

Şimdi newtype + `Deref` + `DerefMut` ile kendi sarmalayıcını yaz:

```exercise
id: m22-l02-e-satirlar
title: Numaralı alışveriş listesi
difficulty: 3
prompt: |
  Bir alışveriş listesini numaralı yazdırmak istiyoruz, ama `Vec<String>`'e `Display` uygulayamayız.
  `struct Satirlar(Vec<String>);` newtype'ını tamamla:

  1. **`Display`**: her öğe `1. süt` biçiminde ayrı satırda; satırlar `\n` ile ayrılır, sonda `\n` yok.
     Liste boşsa `(liste boş)` yazılır.
  2. **`Deref<Target = Vec<String>>`**: `liste.len()`, `liste.is_empty()`, `liste.contains(..)` gibi
     okuma metotları çalışsın.
  3. **`DerefMut`**: `liste.push(..)` ve `liste.retain(..)` gibi değiştiren metotlar da çalışsın.
starter: |
  use std::fmt;
  use std::ops::{Deref, DerefMut};

  struct Satirlar(Vec<String>);

  impl fmt::Display for Satirlar {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  impl Deref for Satirlar {
      type Target = Vec<String>;
      fn deref(&self) -> &Vec<String> {
          todo!()
      }
  }

  impl DerefMut for Satirlar {
      fn deref_mut(&mut self) -> &mut Vec<String> {
          todo!()
      }
  }

  fn main() {
      let mut liste = Satirlar(Vec::new());
      liste.push(String::from("süt"));
      liste.push(String::from("ekmek"));
      println!("{liste}");
      println!("{} öğe", liste.len());
  }
solution: |
  use std::fmt;
  use std::ops::{Deref, DerefMut};

  struct Satirlar(Vec<String>);

  impl fmt::Display for Satirlar {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          if self.0.is_empty() {
              return write!(f, "(liste boş)");
          }
          for (i, satir) in self.0.iter().enumerate() {
              if i > 0 {
                  writeln!(f)?;
              }
              write!(f, "{}. {satir}", i + 1)?;
          }
          Ok(())
      }
  }

  impl Deref for Satirlar {
      type Target = Vec<String>;
      fn deref(&self) -> &Vec<String> {
          &self.0
      }
  }

  impl DerefMut for Satirlar {
      fn deref_mut(&mut self) -> &mut Vec<String> {
          &mut self.0
      }
  }

  fn main() {
      let mut liste = Satirlar(Vec::new());
      liste.push(String::from("süt"));
      liste.push(String::from("ekmek"));
      println!("{liste}");
      println!("{} öğe", liste.len());
  }
check: tests
tests: |
  fn liste(ogeler: &[&str]) -> Satirlar {
      let mut v = Vec::new();
      for o in ogeler {
          v.push(o.to_string());
      }
      Satirlar(v)
  }

  #[test]
  fn numarali_yazdirir() {
      assert_eq!(liste(&["süt", "ekmek", "zeytin"]).to_string(), "1. süt\n2. ekmek\n3. zeytin", "Her öğe numarasıyla ayrı satırda, sonda \\n olmadan");
      assert_eq!(liste(&["çay"]).to_string(), "1. çay", "Tek öğede satır sonu olmamalı");
  }

  #[test]
  fn bos_liste() {
      assert_eq!(liste(&[]).to_string(), "(liste boş)", "Boş liste için özel mesaj");
  }

  #[test]
  fn deref_okuma_metotlari() {
      let l = liste(&["elma", "armut"]);
      assert_eq!(l.len(), 2, "len deref ile Vec'ten gelmeli");
      assert!(l.contains(&String::from("armut")), "contains deref ile çalışmalı");
      assert!(!l.is_empty());
      assert_eq!(l[0], "elma", "İndeksleme de deref ile çalışır");
  }

  #[test]
  fn deref_mut_degistirme_metotlari() {
      let mut l = liste(&["elma"]);
      l.push(String::from("kiraz"));
      l.push(String::from("erik"));
      l.retain(|s| s != "elma");
      assert_eq!(l.to_string(), "1. kiraz\n2. erik", "push ve retain DerefMut ile çalışmalı; numaralar yeniden başlamalı");
  }
hints:
  - "`deref`: `&self.0`, `deref_mut`: `&mut self.0`. Newtype'ın tek alanı `.0`'dır."
  - "`Display`'de önce boş durumu ele al: `if self.0.is_empty() { return write!(f, \"(liste boş)\"); }`. Sonra `self.0.iter().enumerate()` ile dön; numara `i + 1`."
  - "Satırların arasına (ilk satırdan önce değil) yeni satır koy: `if i > 0 { writeln!(f)?; }` ve ardından `write!(f, \"{}. {satir}\", i + 1)?;`. Sonda `Ok(())` döndür."
explanation: |
  `Satirlar`, `Vec<String>`'in bütün metotlarını `Deref`/`DerefMut` ile kazandı ama `Display`'i
  **kendisi** tanımladı. İki dünyanın en iyisi: orphan rule'a takılmadan biçimlendirme, sıfır maliyetle
  vektör işlemleri.

  Test edilen `l[0]` ifadesi ilginç: `Satirlar` `Index` uygulamıyor, ama derleyici `l[0]`'ı `*l.index(0)`
  olarak çözerken deref'i deneyip `Vec`'in `Index`'ini buldu.

  Burada `DerefMut` doğru bir seçim, çünkü listenin hiçbir değişmezi yok. “En fazla 20 öğe” gibi bir
  kural olsaydı `DerefMut` yerine `fn ekle(&mut self, s: String) -> Result<(), String>` yazıp kuralı orada
  denetlemen gerekirdi; aksi hâlde `push` kuralı delip geçerdi.
```

## Özet

:::remember
- `x.metot()` önce tipin **kendi** metodunu seçer. Trait'inkini istersen `Trait::metot(&x)`; iki trait
  çakışıp kendi metodu yoksa `E0034`.
- `self` almayan ilişkili fonksiyonlarda tip çıkarılamaz (`E0790`): **`<Tip as Trait>::fonksiyon()`**.
  Genel biçim: `<Tip as Trait>::ad(alıcı, argümanlar...)`.
- **Supertrait**: `trait A: B + C` → `A`'yı uygulayan her tip `B` ve `C`'yi de uygulamalı. Kalıtım
  değildir; impl'leri ayrı yazılır. Kazanç: `A`'nın varsayılan metotlarında ve `T: A` sınırlarında
  `B`, `C` metotları ek sınır olmadan kullanılır.
- Sınır listesine isim: `trait SayiGibi: Add<Output = Self> + Copy {}` + blanket impl.
- **Newtype**: yabancı trait + yabancı tip, anlamsal tip güvenliği (`KullaniciId` ≠ `SiparisId`),
  kapsülleme. `Deref` içteki `&self` metotlarını açar ama trait'leri aktarmaz; kalıtım taklidi için kullanma.
:::

```reflect
prompt: |
  Supertrait'ler (`trait Cerceveli: Display`) ile Java'daki sınıf kalıtımı (`class Kare extends Sekil`)
  arasındaki farkı kendi cümlelerinle açıkla. Rust'ın yaklaşımının hangi sorunları önlediğini düşün.
answer: |
  Java'da `extends` ile alt sınıf, üst sınıfın alanlarını ve metot gövdelerini otomatik olarak devralır;
  üst sınıftaki bir değişiklik bütün alt sınıfları sessizce etkileyebilir (kırılgan temel sınıf sorunu).
  Rust'ta supertrait yalnızca bir **gereksinimdir**: `Cerceveli` uygulayan tipin `Display`'i de
  uygulamış olması gerekir, ama `Display` impl'ini ayrıca ve bilinçli olarak ben yazarım. Hiçbir veri ya
  da gövde kendiliğinden devralınmaz.

  Kazancım şu: `Cerceveli`'nin varsayılan metotlarında ve `T: Cerceveli` sınırlı generic kodda
  `to_string()` gibi `Display` yeteneklerini güvenle kullanabilirim, çünkü derleyici bunların var
  olduğunu garanti ediyor. Davranış paylaşılır, durum (alanlar) paylaşılmaz; bu da büyük
  hiyerarşilerdeki beklenmedik etkileşimleri önler.
```

```flashcards
- front: "`kisi.uc()` çağrısında hem `impl Insan`'da hem `Pilot` trait'inde `uc` varsa hangisi çalışır?"
  back: "Tipin kendi (inherent) metodu: `impl Insan`'daki. Trait'inki için `Pilot::uc(&kisi)` yazılır."
- front: "`E0034: multiple applicable items in scope` ne zaman çıkar?"
  back: "Kapsamdaki iki trait aynı isimli metodu sağlıyor ve tipin kendi metodu yoksa. Çözüm: `TraitAdi::metot(&x)`."
- front: "`Hayvan::yavru_adi()` neden `E0790` verir ve nasıl düzeltilir?"
  back: "`self` almayan fonksiyonda hangi tipin impl'i olduğu çıkarılamaz. Düzeltme: `<Kopek as Hayvan>::yavru_adi()`."
- front: "Tam nitelikli sözdiziminin genel biçimi nedir?"
  back: "`<Tip as Trait>::fonksiyon(alıcı_varsa, diğer_argümanlar...)`"
- front: "`trait Cerceveli: fmt::Display` ne demektir?"
  back: "`Display`, `Cerceveli`'nin supertrait'idir: `Cerceveli` uygulayan her tip `Display`'i de (ayrı bir impl ile) uygulamalıdır. Karşılığında `Cerceveli` içinde `to_string()` kullanılabilir."
- front: Supertrait kalıtım mıdır?
  back: "Hayır. Hiçbir gövde ya da alan devralınmaz; yalnızca bir ön koşuldur. Her iki trait için impl ayrı yazılır."
- front: "Newtype'ın üç tipik görevi nedir?"
  back: "1) Yabancı tipe yabancı trait uygulamak (orphan rule), 2) anlamsal tip güvenliği (`KullaniciId` ≠ `SiparisId`), 3) kapsülleme (yalnızca seçilen yetenekleri açmak)."
- front: "Newtype'a `Deref<Target = Vec<String>>` uygulamak neyi sağlar, neyi sağlamaz?"
  back: "Vec'in `&self` metotlarını (len, contains, iter...) deref zorlamasıyla açar. Trait'leri (`Clone`, `Display`...) aktarmaz."
```
