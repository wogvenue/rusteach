---
id: m06-l04
title: Metotlar
minutes: 22
type: lesson
objectives:
  - "`impl` bloğu içinde `&self`, `&mut self` ve `self` alan metotlar yazabilmek"
  - Bir metot için doğru alıcıyı (receiver) seçip seçimini gerekçelendirebilmek
  - "Otomatik referanslamayı açıklayabilmek: `h.yatir(5)` ile `Hesap::yatir(&mut h, 5)` aynı çağrıdır"
  - Rust'ın getter isimlendirme geleneğine uygun metotlar yazabilmek ve getter'ların ödünç alma etkisini öngörebilmek
keywords: [impl, metot, method, self, "&self", "&mut self", alıcı, receiver, getter, E0596, E0499, E0502]
---

Önceki derslerde struct'larla çalışan fonksiyonlar yazdın: `karne_yazdir(&ayse)`, `hasar_al(&mut k, 30)`.
İş görüyorlar ama program büyüdükçe iki sorun çıkar. Birincisi, bu fonksiyonlar kodun her yerine
dağılır; "`Ogrenci` ile neler yapabiliyorum?" sorusunun cevabı tek bir yerde değildir. İkincisi, isimler
çakışır: hem `Daire` hem `Dikdortgen` için `alan` fonksiyonu yazamazsın, `daire_alani`,
`dikdortgen_alani` gibi isimlere mahkûm olursun.

Bu derste verine **davranış** kazandıracaksın: **metotlar (methods)**.

## Fonksiyondan metoda: `impl` bloğu

Bir fonksiyonu bir tipe bağlamak için onu o tipin `impl` bloğunun içine taşırsın:

```rust
struct Dikdortgen {
    genislik: u32,
    yukseklik: u32,
}

impl Dikdortgen {
    fn alan(&self) -> u32 {
        self.genislik * self.yukseklik
    }

    fn kare_mi(&self) -> bool {
        self.genislik == self.yukseklik
    }
}

struct Daire {
    yaricap: f64,
}

impl Daire {
    fn alan(&self) -> f64 {
        std::f64::consts::PI * self.yaricap * self.yaricap // standart kütüphanedeki π sabiti
    }
}

fn main() {
    let oda = Dikdortgen { genislik: 4, yukseklik: 5 };
    let masa = Daire { yaricap: 0.5 };
    println!("Oda: {} m², kare mi? {}", oda.alan(), oda.kare_mi());
    println!("Masa: {:.2} m²", masa.alan());
}
```

- `impl Dikdortgen { ... }` (**implementation**, gerçekleştirme) bloğundaki fonksiyonlar `Dikdortgen`
  tipine aittir.
- Metodun ilk parametresi her zaman **`self`**'tir: metodun **üzerinde çağrıldığı** örnek. `&self`,
  aslında `self: &Self` yazımının kısaltmasıdır; `Self` de "bu `impl` bloğunun tipi" demektir (bir
  sonraki derste ayrıntılı).
- Çağırırken örneği noktanın soluna yazarsın: `oda.alan()`. Noktanın solundaki değer `self` olur.
- `Dikdortgen` ve `Daire`'nin ikisinin de `alan` metodu var ve **çakışmıyorlar**: her biri kendi
  tipinin isim alanında yaşıyor.

Bir bonus: editörde `oda.` yazdığın anda rust-analyzer o tipin **bütün metotlarını** listeler. Bir tipin
neler yapabildiğini keşfetmenin en kolay yolu budur.

:::info Diğer dillerde
Python'daki `def alan(self):` ile çok benzer: `self` orada da açıkça yazılır. Java ve C++'ta ise `this`
gizlidir. Rust'ı ikisinden de ayıran şey, `self`'in **nasıl** alındığını (okuma, değiştirme, sahiplenme)
imzada açıkça yazmandır, birazdan göreceğin üç seçenek.
:::

```quiz
question: Bir metodu sıradan bir fonksiyondan ayıran nedir?
options:
  - "Bir `impl` bloğunun içinde tanımlanır ve ilk parametresi `self`'tir; `deger.metot()` biçiminde çağrılır"
  - Metotlar fonksiyonlardan daha hızlı çalışır
  - Metotlar struct alanlarını yalnızca okuyabilir, değiştiremez
  - "Metotlar `fn` yerine `method` anahtar kelimesiyle tanımlanır"
answer: 0
explanation: |
  Metot, bir tipe bağlı ve ilk parametresi `self` olan bir fonksiyondur. Performans farkı yoktur:
  `oda.alan()` derlendiğinde `Dikdortgen::alan(&oda)` çağrısıyla birebir aynıdır.
feedback:
  - Doğru!
  - Hız farkı yoktur; metot çağrısı derlenince sıradan bir fonksiyon çağrısıdır.
  - "`&mut self` alan metotlar alanları değiştirebilir; birazdan göreceksin."
  - "Rust'ta `method` diye bir anahtar kelime yok; metotlar da `fn` ile tanımlanır."
```

## `&mut self`: durumu değiştiren metotlar

Gerçek bir örnekle devam edelim: bir banka hesabı. Para yatırmak hesabı **değiştirir**, o yüzden
`&self` yetmez; metot `&mut self` almalıdır:

```rust
struct Hesap {
    sahip: String,
    bakiye: u64, // kuruş cinsinden: 1050 = 10,50 TL
}

impl Hesap {
    fn yatir(&mut self, miktar: u64) {
        self.bakiye += miktar;
    }

    fn bakiye_tl(&self) -> f64 {
        self.bakiye as f64 / 100.0
    }
}

fn main() {
    let mut hesap = Hesap { sahip: String::from("Fatma Şahin"), bakiye: 0 };
    hesap.yatir(150_000);
    hesap.yatir(2_550);
    println!("{}: {:.2} TL", hesap.sahip, hesap.bakiye_tl());
}
```

:::tip Parayı neden kuruşla tutuyoruz?
Modül 2'de `0.1 + 0.2`'nin tam olarak `0.3` etmediğini gördün. Kayan noktalı sayılar parayı
**yaklaşık** tutar; milyonlarca işlemde kuruşlar kaybolur. Bankacılık yazılımları bu yüzden en küçük
birimi (kuruşu) bir **tamsayıyla** tutar ve yalnızca ekranda gösterirken TL'ye çevirir.
:::

`&mut self` almak, metodun çağrıldığı örneği **değişebilir olarak ödünç almak** demektir. Peki
çağıran taraf `mut` değilse? Tahmin et:

```compiles
code: |
  struct Hesap {
      bakiye: u64,
  }

  impl Hesap {
      fn yatir(&mut self, miktar: u64) {
          self.bakiye += miktar;
      }
  }

  fn main() {
      let h = Hesap { bakiye: 0 };
      h.yatir(500);
      println!("{}", h.bakiye);
  }
answer: false
error: E0596
explanation: |
  `yatir` bir `&mut Hesap` istiyor; ama `h` değişmez tanımlanmış ve değişmez bir değerden `&mut`
  ödünç alınamaz (Modül 5). `let mut h` yazınca derlenir.
```

:::error
```text
error[E0596]: cannot borrow `h` as mutable, as it is not declared as mutable
  --> src/main.rs:13:5
   |
13 |     h.yatir(500);
   |     ^ cannot borrow as mutable
   |
help: consider changing this to be mutable
   |
12 |     let mut h = Hesap { bakiye: 0 };
   |         +++
```
Dikkat: Hata, metodun içinde değil **çağrıldığı yerde**. Metodun imzası "ben değiştireceğim" diyor;
derleyici de çağıranın buna izin verip veremeyeceğine bakıyor.
:::

Peki çağrı sırasında bellekte ne oluyor? Struct metoda **kopyalanmıyor**; `self`, çağıranın örneğini
gösteren bir referanstan ibaret:

```memory
title: "`hesap.yatir(2_550)` çağrısı sırasında"
steps:
  - caption: "`main`'de `hesap` duruyor (`let mut`)."
    stack:
      - frame: main
        vars:
          - { name: hesap, type: Hesap, value: "sahip=Fatma Şahin · bakiye=150000", mut: true }
  - caption: "Çağrı sırasında `self`, `hesap`'ı gösteren bir `&mut Hesap` referansıdır. Struct kopyalanmadı!"
    stack:
      - frame: main
        vars:
          - { name: hesap, type: Hesap, value: "sahip=Fatma Şahin · bakiye=150000", mut: true }
      - frame: Hesap::yatir
        vars:
          - { name: self, type: "&mut Hesap", value: "ptr", to: hesap }
          - { name: miktar, type: u64, value: "2550" }
  - caption: "`self.bakiye += miktar;` doğrudan `hesap`'ın alanını değiştirdi. Metot bitince referans ortadan kalktı; `hesap` güncel hâliyle duruyor."
    stack:
      - frame: main
        vars:
          - { name: hesap, type: Hesap, value: "sahip=Fatma Şahin · bakiye=152550", mut: true }
```

## `self`: sahipliği alan metotlar

Üçüncü seçenek, örneği **sahiplenmektir**. Hesabı kapatan bir metot düşün: kapanan hesaba bir daha para
yatırılmamalı. Bunu bir kural olarak belgelere yazmak yerine **derleyiciye** denetletebiliriz:

```rust
struct Hesap {
    sahip: String,
    bakiye: u64,
}

impl Hesap {
    fn yatir(&mut self, miktar: u64) {
        self.bakiye += miktar;
    }

    fn kapat(self) -> u64 {
        println!("{} adlı müşterinin hesabı kapatıldı.", self.sahip);
        self.bakiye
    } // self burada drop edilir: hesap artık yok
}

fn main() {
    let mut hesap = Hesap { sahip: String::from("Fatma Şahin"), bakiye: 0 };
    hesap.yatir(75_000);
    let iade = hesap.kapat();
    println!("Müşteriye {iade} kuruş iade edildi.");
    // hesap.yatir(100); // ← bu satırı açarsan: E0382
}
```

`kapat(self)` çağrıldığında hesap metoda **taşınır** ve metot bitince drop edilir. Sonrasında kullanmaya
kalkarsan derleyici, sorunun tam olarak hangi metottan kaynaklandığını söyler. Tahmin et:

```compiles
code: |
  struct Hesap {
      sahip: String,
      bakiye: u64,
  }

  impl Hesap {
      fn kapat(self) -> u64 {
          println!("{} hesabı kapatıldı", self.sahip);
          self.bakiye
      }
  }

  fn main() {
      let h = Hesap { sahip: String::from("Ali"), bakiye: 750 };
      let son = h.kapat();
      println!("{son}");
      println!("{}", h.bakiye);
  }
answer: false
error: E0382
explanation: |
  `kapat` alıcısını **değer olarak** (`self`) alıyor; `h.kapat()` çağrısı `h`'yi metoda taşır.
  Sonraki satırda `h.bakiye`'yi okumak, taşınmış bir değeri kullanmaktır: `E0382`.
```

:::error
```text
error[E0382]: borrow of moved value: `h`
  --> src/main.rs:17:20
   |
14 |     let h = Hesap { sahip: String::from("Ali"), bakiye: 750 };
   |         - move occurs because `h` has type `Hesap`, which does not implement the `Copy` trait
15 |     let son = h.kapat();
   |                 ------- `h` moved due to this method call
16 |     println!("{son}");
17 |     println!("{}", h.bakiye);
   |                    ^^^^^^^^ value borrowed here after move
   |
note: `Hesap::kapat` takes ownership of the receiver `self`, which moves `h`
  --> src/main.rs:7:14
   |
 7 |     fn kapat(self) -> u64 {
   |              ^^^^
```
Derleyici suçluyu imzada gösteriyor: `kapat(self)`. Metodun alıcısı, çağıranın değerine ne olacağını
belirler; hata mesajı da bu yüzden seni metodun **imzasına** yönlendiriyor.
:::

Üç alıcıyı bir arada görelim:

| Alıcı | Anlamı | Çağıran için | Ne zaman? |
|---|---|---|---|
| `&self` | değişmez ödünç alma | herhangi bir bağlama yeterli | okuma, hesaplama (en yaygını) |
| `&mut self` | değişebilir ödünç alma | `let mut` gerekir | durumu yerinde değiştirme |
| `self` | sahiplenme (taşıma) | çağrıdan sonra değer kullanılamaz | kapatma, başka bir şeye dönüştürme |

Pratik kural: **`&self` ile başla.** Değiştirmen gerekiyorsa `&mut self`'e geç. `self`'i yalnızca metot
değerin **son kullanımı** olmalıysa ya da değeri başka bir şeye dönüştürüyorsa seç. Standart
kütüphanede böyle metotların adı genellikle `into_` ile başlar: `String::into_bytes()` string'i
tüketip baytlarını verir.

:::analogy Araban ve sen
**`&self`**: Arabanın gösterge paneline bakmak, kilometreyi okursun, araba aynen kalır.
**`&mut self`**: Arabayı tamire vermek, usta üzerinde değişiklik yapar ama araba **sana geri döner**.
**`self`**: Arabayı satmak, anahtarı teslim ettikten sonra o araba artık **senin değildir**; ona binmeye
kalkarsan noter (borrow checker) seni durdurur.
:::

Şimdi her metot için doğru alıcıyı sen seç:

```fill
prompt: Her metodun ne yaptığına bakarak doğru alıcıyı yaz.
code: |
  struct Termos {
      sicaklik: i32,
      icecek: String,
  }

  impl Termos {
      // Sıcaklığı okur
      fn sicaklik(___0) -> i32 {
          self.sicaklik
      }

      // İçeceği soğutur
      fn sogut(___1, derece: i32) {
          self.sicaklik -= derece;
      }

      // Termosu boşaltır: içeceği dışarı verir, termos bir daha kullanılamaz
      fn bosalt(___2) -> String {
          self.icecek
      }
  }

  fn main() {
      let mut t = Termos { sicaklik: 80, icecek: String::from("Rize çayı") };
      t.sogut(15);
      println!("{} derece", t.sicaklik());
      let bardak = t.bosalt();
      println!("Bardakta: {bardak}");
  }
blanks:
  - ["&self"]
  - ["&mut self"]
  - ["self"]
output: |
  65 derece
  Bardakta: Rize çayı
explanation: |
  - `sicaklik` yalnızca okuyor → `&self`.
  - `sogut` alanı değiştiriyor → `&mut self` (bu yüzden `main`'de `let mut t` gerekiyor).
  - `bosalt`, `icecek` alanındaki `String`'i **dışarı taşıyor**. Bir alanı dışarı taşıyabilmek için
    örneğin sahibi olmak gerekir → `self`. `&self` ile yazsaydın `E0507` (ödünç alınan bir değerin
    içinden taşıma) alırdın.
```

## Otomatik referanslama ve ek parametreler

Dikkat ettin mi? `yatir` bir `&mut Hesap` bekliyor ama sen hiç `&mut hesap` yazmadın; sadece
`hesap.yatir(...)` dedin. Rust, nokta ile çağrılan metotlarda alıcıyı metodun istediği biçime
**otomatik olarak** getirir: gerekirse `&` ya da `&mut` ekler, gerekirse `*` ile referansı takip eder.
Buna **otomatik referanslama (automatic referencing)** denir. Şu iki satır birebir aynıdır:

```rust
struct Sayac {
    deger: u32,
}

impl Sayac {
    fn artir(&mut self) {
        self.deger += 1;
    }

    fn deger(&self) -> u32 {
        self.deger
    }
}

fn main() {
    let mut s = Sayac { deger: 0 };
    s.artir();            // kısa yol
    Sayac::artir(&mut s); // açık yol: aynı çağrı
    let r = &s;
    println!("{}", r.deger());         // referans üzerinden de nokta yeterli
    println!("{}", Sayac::deger(&s));  // açık yol
}
```

C++'ta bir nesne için `nesne.metot()`, bir işaretçi için `isaretci->metot()` yazman gerekir (C'de
struct alanları için de aynı ayrım vardır: `s.alan` ve `p->alan`).
Rust'ta tek bir nokta yeter. Bu bir kolaylık ama sihir değil: alıcının nasıl alınacağı metodun
imzasında açıkça yazılı, derleyici sadece yazmayı sana bırakmıyor. Tahmin et:

```predict
code: |
  struct Sayac {
      deger: u32,
  }

  impl Sayac {
      fn artir(&mut self, adim: u32) {
          self.deger += adim;
      }
  }

  fn main() {
      let mut s = Sayac { deger: 10 };
      s.artir(5);
      Sayac::artir(&mut s, 3);
      let r = &mut s;
      r.artir(2);
      println!("{}", s.deger);
  }
options:
  - "20"
  - "15"
  - "10"
  - Derlenmez
answer: 0
explanation: |
  Üç çağrı da **aynı** `s`'yi değiştirir: `10 + 5 + 3 + 2 = 20`. `s.artir(5)` otomatik olarak
  `&mut s` alır; `Sayac::artir(&mut s, 3)` bunu açıkça yazar; `r` zaten bir `&mut Sayac` olduğu için
  `r.artir(2)` onu olduğu gibi kullanır. `r`'nin son kullanımı `println!`'den önce bittiği için
  (Modül 5'teki NLL) `s.deger`'i okumak da sorun değil.
```

Metotlar, `self`'ten sonra **istediğin kadar** ek parametre alabilir. Ama dikkat: otomatik referanslama
yalnızca **alıcı** için geçerlidir; diğer argümanlarda `&` ve `&mut`'u her zamanki gibi açıkça yazarsın:

```rust
struct Hesap {
    bakiye: u64,
}

impl Hesap {
    fn transfer(&mut self, hedef: &mut Hesap, miktar: u64) -> bool {
        if self.bakiye < miktar {
            return false;
        }
        self.bakiye -= miktar;
        hedef.bakiye += miktar;
        true
    }
}

fn main() {
    let mut ayse = Hesap { bakiye: 10_000 };
    let mut mehmet = Hesap { bakiye: 500 };
    let basarili = ayse.transfer(&mut mehmet, 2_500); // hedef için &mut açıkça yazılır
    println!("{basarili}: Ayşe {} / Mehmet {}", ayse.bakiye, mehmet.bakiye);
    let yine = mehmet.transfer(&mut ayse, 99_999);
    println!("{yine}: Ayşe {} / Mehmet {}", ayse.bakiye, mehmet.bakiye);
}
```

Peki biri hesabından **kendi hesabına** transfer yapmaya kalkarsa? Modül 5'teki kuralları düşünerek
tahmin et:

```compiles
code: |
  struct Hesap {
      bakiye: u64,
  }

  impl Hesap {
      fn transfer(&mut self, hedef: &mut Hesap, miktar: u64) -> bool {
          if self.bakiye < miktar {
              return false;
          }
          self.bakiye -= miktar;
          hedef.bakiye += miktar;
          true
      }
  }

  fn main() {
      let mut a = Hesap { bakiye: 100 };
      a.transfer(&mut a, 10);
      println!("{}", a.bakiye);
  }
answer: false
error: E0499
explanation: |
  `a.transfer(&mut a, 10)` aynı değerden **iki** `&mut` ödünç almaya çalışır: biri alıcı (`self`), biri
  `hedef`. Modül 5'teki kural: aynı anda yalnızca bir `&mut` olabilir → `E0499`. Bu kural burada gerçek
  bir hatayı önlüyor: `self` ve `hedef` aynı hesap olsaydı, metot birini değiştirirken diğerinin
  değerinin de "arkasından" değiştiğini bilemezdi. C++ böyle bir kodu sessizce derler.
```

## Getter'lar ve isimlendirme

Alanı okuyan basit metotlara **getter** denir. Rust'taki gelenek, getter'a **alanla aynı adı**
vermektir; Java'daki gibi `get_` öneki kullanılmaz:

```rust
struct Hesap {
    sahip: String,
    bakiye: u64,
}

impl Hesap {
    fn sahip(&self) -> &str {
        &self.sahip
    }

    fn bakiye(&self) -> u64 {
        self.bakiye
    }
}

fn main() {
    let h = Hesap { sahip: String::from("Zehra Koç"), bakiye: 4_200 };
    println!("{} → {} kuruş", h.sahip(), h.bakiye());
    println!("Alan: {}, metot: {}", h.bakiye, h.bakiye()); // aynı ad, iki farklı şey
}
```

- `sahip()` bir `&String` değil, `&str` döndürüyor: Modül 5'te `&str`'nin daha esnek olduğunu
  gördün ve `&self.sahip` (bir `&String`) otomatik olarak `&str`'ye dönüşür.
- `bakiye()` `Copy` bir değeri **değer olarak** döndürüyor; küçük `Copy` tipler için referans döndürmeye
  gerek yok.
- Alan ile metot aynı adı taşıyabilir: `h.bakiye` alanı, `h.bakiye()` metodu çağırır.

Alanlar zaten erişilebilirken getter'a neden ihtiyaç var? Şimdilik bütün kodun tek bir dosyada olduğu için
alanlar her yerden görünüyor. **Modül 8**'de alanları gizli (private) yapmayı öğreneceksin; o zaman
dışarıdaki kod alanları yalnızca senin izin verdiğin yollarla okuyabilecek ve örneğin `bakiye` sadece
kontrollü `yatir`/`cek` metotlarıyla değişebilecek.

Getter'ların ödünç alma üzerinde önemli bir etkisi var. Modül 5'i hatırlayarak tahmin et:

```compiles
code: |
  struct Hesap {
      sahip: String,
      bakiye: u64,
  }

  impl Hesap {
      fn sahip(&self) -> &str {
          &self.sahip
      }
      fn yatir(&mut self, miktar: u64) {
          self.bakiye += miktar;
      }
  }

  fn main() {
      let mut h = Hesap { sahip: String::from("Ali"), bakiye: 0 };
      let ad = h.sahip();
      h.yatir(100);
      println!("{ad}: {}", h.bakiye);
  }
answer: false
error: E0502
explanation: |
  `h.sahip()` bir `&str` döndürüyor ve imzaya göre bu referans `h`'den ödünç alınmış. `ad` kullanıldığı
  sürece (`println!`'e kadar) `h` **değişmez olarak ödünç alınmış** sayılır; bu arada `&mut self` isteyen
  `yatir` çağrılamaz: `E0502`.
```

:::error
```text
error[E0502]: cannot borrow `h` as mutable because it is also borrowed as immutable
  --> src/main.rs:18:5
   |
17 |     let ad = h.sahip();
   |              - immutable borrow occurs here
18 |     h.yatir(100);
   |     ^^^^^^^^^^^^ mutable borrow occurs here
19 |     println!("{ad}: {}", h.bakiye);
   |                -- immutable borrow later used here
```
Burada derin bir ders var: derleyici `sahip`'in gövdesine bakıp "aslında sadece `sahip` alanını ödünç
alıyor" diye düşünmez; yalnızca **imzaya** bakar. İmza `&self` alıp bir referans döndürüyorsa, o
referans **bütün örneği** ödünç alır. Çözümler: `ad`'ı kullanmayı `yatir`'den önce bitir, ya da gerçekten
ayrı bir kopyaya ihtiyacın varsa `let ad = String::from(h.sahip());`.
:::

Şimdi bir hesap modelini kendin tamamla. Bu kez bir metodu **imzasıyla birlikte** sen yazacaksın:

```exercise
id: m06-e-banka-hesabi
title: Banka hesabı
difficulty: 2
prompt: |
  Bir dijital bankanın hesap modelini yazıyorsun. Bakiye **kuruş** cinsinden tutuluyor.

  - `bakiye(&self) -> u64`, bakiyeyi döndüren getter.
  - `yatir(&mut self, miktar: u64)`, bakiyeyi `miktar` kadar artırır.
  - `cek`, bu metodu **imzasıyla birlikte sen yaz**: bir `miktar: u64` alır; bakiye yetiyorsa düşer ve
    `true` döndürür, yetmiyorsa **hiçbir şeyi değiştirmeden** `false` döndürür. Hangi alıcıyı
    kullanacağına sen karar ver.
starter: |
  struct Hesap {
      sahip: String,
      bakiye: u64,
  }

  impl Hesap {
      fn bakiye(&self) -> u64 {
          todo!()
      }

      fn yatir(&mut self, miktar: u64) {
          todo!()
      }

      // cek metodunu buraya yaz
  }

  fn main() {
      let mut h = Hesap { sahip: String::from("Ahmet Aksoy"), bakiye: 0 };
      h.yatir(10_000);
      println!("{}: {} kuruş", h.sahip, h.bakiye());
  }
solution: |
  struct Hesap {
      sahip: String,
      bakiye: u64,
  }

  impl Hesap {
      fn bakiye(&self) -> u64 {
          self.bakiye
      }

      fn yatir(&mut self, miktar: u64) {
          self.bakiye += miktar;
      }

      fn cek(&mut self, miktar: u64) -> bool {
          if miktar > self.bakiye {
              return false;
          }
          self.bakiye -= miktar;
          true
      }
  }

  fn main() {
      let mut h = Hesap { sahip: String::from("Ahmet Aksoy"), bakiye: 0 };
      h.yatir(10_000);
      let basarili = h.cek(2_500);
      println!("{}: {} kuruş (çekim: {basarili})", h.sahip, h.bakiye());
  }
check: tests
tests: |
  #[test]
  fn yatirma_bakiyeyi_artirir() {
      let mut h = Hesap { sahip: String::from("Test"), bakiye: 500 };
      h.yatir(250);
      assert_eq!(h.bakiye(), 750, "500 + 250 = 750 olmalı");
  }

  #[test]
  fn yeterli_bakiyeyle_cekim() {
      let mut h = Hesap { sahip: String::from("Test"), bakiye: 1_000 };
      assert!(h.cek(400), "1000 kuruşluk hesaptan 400 çekilebilmeli");
      assert_eq!(h.bakiye(), 600, "çekimden sonra bakiye 600 olmalı");
  }

  #[test]
  fn yetersiz_bakiye_degismez() {
      let mut h = Hesap { sahip: String::from("Test"), bakiye: 300 };
      assert!(!h.cek(301), "300 kuruşluk hesaptan 301 çekilememeli");
      assert_eq!(h.bakiye(), 300, "başarısız çekim bakiyeyi değiştirmemeli");
  }

  #[test]
  fn bakiyenin_tamami_cekilebilir() {
      let mut h = Hesap { sahip: String::from("Test"), bakiye: 300 };
      assert!(h.cek(300), "bakiyenin tamamı çekilebilmeli");
      assert_eq!(h.bakiye(), 0, "her şey çekilince bakiye 0 olmalı");
  }

  #[test]
  fn getter_degismez_hesapta_calisir() {
      let h = Hesap { sahip: String::from("Test"), bakiye: 42 };
      assert_eq!(h.bakiye(), 42, "bakiye() değişmez bir hesapta da çağrılabilmeli");
  }
hints:
  - "`bakiye` ve `yatir` tek satırlık: `self.bakiye` döndür; `self.bakiye += miktar;`."
  - "`cek` hesabı değiştirebilir, o hâlde alıcısı `&mut self` olmalı: `fn cek(&mut self, miktar: u64) -> bool`."
  - "Gövde: önce kontrol et, `if miktar > self.bakiye { return false; }`, sonra `self.bakiye -= miktar;` ve son ifade olarak `true`."
explanation: |
  `cek` hesabı değiştirebileceği için `&mut self` alıyor; ama değiştirmeden **önce** kontrol ediyor.
  Bu sıra önemli: `u64` negatif olamaz, kontrol etmeden `self.bakiye -= miktar` yazsaydın yetersiz
  bakiyede debug modda taşma paniği alırdın. "Önce doğrula, sonra değiştir" sırası, başarısız bir
  işlemin nesneyi yarım yamalak değişmiş bırakmamasını da garanti eder.

  `miktar > self.bakiye` yerine `miktar >= self.bakiye` yazsaydın, bakiyenin tamamını çekmek mümkün
  olmazdı; `bakiyenin_tamami_cekilebilir` testi tam bu sınır hatasını (off-by-one) yakalar.

  `true`/`false` döndürmek şimdilik idare eder ama başarısızlığın **nedenini** söylemez. Modül 10'da
  `Result` ile "yetersiz bakiye" gibi anlamlı hatalar döndürmeyi öğreneceksin.
```

## Alıştırma: köyün su deposu

Son alıştırmada metotların **hepsini** imzalarıyla birlikte sen yazacaksın. En önemli karar, her metot
için doğru alıcıyı seçmek.

```exercise
id: m06-e-su-deposu
title: Köyün su deposu
difficulty: 3
prompt: |
  Bir köyün su deposu için kontrol yazılımı yazıyorsun. `SuDeposu` struct'ı hazır; aşağıdaki metotları
  **imzalarıyla birlikte** yaz:

  - `doldur`, bir `litre: u32` alır ve depoya ekler. Depo kapasitesini **aşamaz**; sığmayan su taşar.
    Metot **taşan** litre miktarını `u32` olarak döndürür (taşma yoksa `0`).
  - `kullan`, bir `litre: u32` alır; depoda o kadar su varsa düşer ve `true` döndürür, yoksa hiçbir
    şeyi değiştirmeden `false` döndürür.
  - `doluluk_yuzdesi`, deponun yüzde kaç dolu olduğunu `u32` olarak döndürür (tamsayı bölmesi, aşağı
    yuvarlanır). Örneğin 1000 litrelik depoda 333 litre varsa `33`.
  - `bos_mu`, depoda hiç su yoksa `true` döndürür.

  Depoyu değiştirmeyen metotlar, değişmez bir depo (`let d = ...`) üzerinde de çağrılabilmeli.
starter: |
  struct SuDeposu {
      kapasite: u32,
      miktar: u32,
  }

  impl SuDeposu {
      // Metotlarını buraya yaz
  }

  fn main() {
      let d = SuDeposu { kapasite: 1000, miktar: 250 };
      println!("{} / {} litre", d.miktar, d.kapasite);
  }
solution: |
  struct SuDeposu {
      kapasite: u32,
      miktar: u32,
  }

  impl SuDeposu {
      fn doldur(&mut self, litre: u32) -> u32 {
          let bos_yer = self.kapasite - self.miktar;
          if litre > bos_yer {
              self.miktar = self.kapasite;
              litre - bos_yer
          } else {
              self.miktar += litre;
              0
          }
      }

      fn kullan(&mut self, litre: u32) -> bool {
          if litre > self.miktar {
              return false;
          }
          self.miktar -= litre;
          true
      }

      fn doluluk_yuzdesi(&self) -> u32 {
          self.miktar * 100 / self.kapasite
      }

      fn bos_mu(&self) -> bool {
          self.miktar == 0
      }
  }

  fn main() {
      let mut d = SuDeposu { kapasite: 1000, miktar: 250 };
      let tasan = d.doldur(900);
      println!("Taşan: {tasan} litre, doluluk: %{}", d.doluluk_yuzdesi());
      if d.kullan(400) {
          println!("400 litre kullanıldı, kalan: {} litre", d.miktar);
      }
      println!("Boş mu? {}", d.bos_mu());
  }
check: tests
tests: |
  #[test]
  fn doldurma_kapasiteyi_asmaz() {
      let mut d = SuDeposu { kapasite: 1000, miktar: 250 };
      let tasan = d.doldur(900);
      assert_eq!(tasan, 150, "250 + 900 = 1150; kapasiteyi aşan 150 litre taşmalı");
      assert_eq!(d.miktar, 1000, "depo tam dolu olmalı");
  }

  #[test]
  fn tasma_yoksa_sifir_doner() {
      let mut d = SuDeposu { kapasite: 500, miktar: 100 };
      assert_eq!(d.doldur(400), 0, "100 + 400 = 500 tam sığar; taşan miktar 0 olmalı");
      assert_eq!(d.miktar, 500, "depoda 500 litre olmalı");
  }

  #[test]
  fn kullanim_ve_bos_depo() {
      let mut d = SuDeposu { kapasite: 1000, miktar: 300 };
      assert!(d.kullan(300), "depodaki suyun tamamı kullanılabilmeli");
      assert!(d.bos_mu(), "300 litrenin hepsi kullanılınca depo boş olmalı");
      assert!(!d.kullan(1), "boş depodan su kullanılamamalı");
      assert_eq!(d.miktar, 0, "başarısız kullanım miktarı değiştirmemeli");
  }

  #[test]
  fn degismez_depoda_sorgular() {
      let d = SuDeposu { kapasite: 1000, miktar: 333 };
      assert_eq!(d.doluluk_yuzdesi(), 33, "333 / 1000 litre → %33");
      assert!(!d.bos_mu(), "333 litre varken depo boş değildir");
  }
hints:
  - "Her metot için sor: depoyu **değiştiriyor mu**? `doldur` ve `kullan` değiştirir → `&mut self`; `doluluk_yuzdesi` ve `bos_mu` sadece okur → `&self`."
  - "`doldur` için önce boş yeri hesapla: `let bos_yer = self.kapasite - self.miktar;`. `litre` bundan büyükse depo tam dolar ve aradaki fark taşar."
  - "Yüzde için önce çarp, sonra böl: `self.miktar * 100 / self.kapasite`. Ters sırada (`self.miktar / self.kapasite * 100`) tamsayı bölmesi sonucu hep 0 yapar!"
explanation: |
  Alıcı seçimi her metodun **sözleşmesidir**: `doldur` ve `kullan` durumu değiştirdiği için `&mut self`,
  `doluluk_yuzdesi` ve `bos_mu` yalnızca okuduğu için `&self` alır. `degismez_depoda_sorgular` testi
  değişmez bir `d` kullanıyor; okuyan bir metodu `&mut self` ile yazsaydın test `E0596` ile derlenmezdi.
  `self` ile yazsaydın, ilk çağrı depoyu tüketir ve ikinci çağrı `E0382` verirdi.

  `doldur`'da `self.kapasite - self.miktar` güvenlidir, çünkü depodaki su hiçbir zaman kapasiteyi
  aşmıyor; bu bir **değişmez (invariant)** ve metotlarımız onu koruyor. Yüzde hesabında işlem sırası
  önemli: tamsayı bölmesinde `333 / 1000 = 0` olduğu için önce `* 100` yapıyoruz. (Milyarlarca litrelik
  bir depo olsaydı `self.miktar * 100` `u32`'yi taşırabilirdi; o zaman `u64`'e çevirmek gerekirdi.)
```

## Özet

:::remember
- Metotlar `impl Tip { ... }` içinde tanımlanır; ilk parametre `self`, çağrı `deger.metot()`.
- `&self` → okur (en yaygın) · `&mut self` → değiştirir (çağıran `let mut` olmalı, yoksa `E0596`) · `self` → sahiplenir (sonra kullanım `E0382`).
- Nokta ile çağrıda alıcıya `&`/`&mut`/`*` **otomatik** eklenir: `h.yatir(5)` ≡ `Hesap::yatir(&mut h, 5)`. Diğer argümanlarda değil!
- Metotlar ek parametre alabilir; ödünç alma kuralları aynen geçerlidir (`a.transfer(&mut a, ..)` → `E0499`).
- Getter alanla aynı adı taşır (`get_` yok). Referans döndüren getter **bütün örneği** ödünç alır (`E0502`).
:::

```reflect
prompt: |
  `kapat(self)` metodunu `kapat(&self)` olarak yazsaydık programımız yine çalışırdı. O hâlde neden
  `self` seçtik? Alıcı seçiminin bir "belge" değil bir "sözleşme" olmasının ne kazandırdığını açıkla.
answer: |
  `&self` ile yazılsaydı kapatılan hesap hâlâ kullanılabilir olurdu; "kapattıktan sonra para yatırma"
  kuralına uymak programcının dikkatine kalırdı. `self` ile hesap metoda **taşınır** ve sonra drop
  edilir; kapanmış bir hesabı kullanmaya çalışan her kod `E0382` ile derlenmez. Yani kural bir yorum
  satırında ya da belgede değil, **tip sisteminde** yaşar ve derleyici onu her seferinde denetler.
  Metodun imzası, metot hakkında okuyucuya da doğru bilgiyi verir: okuyor mu, değiştiriyor mu, tüketiyor mu.
```

```flashcards
- front: "`impl Tip { ... }` bloğu ne işe yarar?"
  back: "İçindeki fonksiyonları (metotları ve ilişkili fonksiyonları) o tipe bağlar; böylece `deger.metot()` ile çağrılabilirler."
- front: "`&self` neyin kısaltmasıdır?"
  back: "`self: &Self`, `Self`, `impl` bloğunun ait olduğu tiptir."
- front: "Bir metot ne zaman `&mut self`, ne zaman `self` almalıdır?"
  back: "Örneği yerinde değiştiriyorsa `&mut self`; örneği tüketiyor, kapatıyor ya da başka bir şeye dönüştürüyorsa `self`. Diğer her durumda `&self`."
- front: "`let h = Hesap {..}; h.yatir(5);` (`yatir(&mut self)`) neden derlenmez?"
  back: "`&mut self` için değişebilir ödünç gerekir ama `h` `mut` değil (**E0596**). `let mut h` yaz."
- front: "`h.yatir(5)` çağrısının açık (otomatik referanslamasız) yazımı nedir?"
  back: "`Hesap::yatir(&mut h, 5)`, Rust nokta çağrısında alıcıya `&`/`&mut`/`*`'ı kendisi ekler."
- front: "`a.transfer(&mut a, 10)` neden derlenmez?"
  back: "Aynı değerden iki `&mut` ödünç alınıyor: biri alıcı, biri argüman (**E0499**)."
- front: Rust'ta bir getter nasıl adlandırılır?
  back: "Alanla aynı adla, `get_` öneki olmadan: `fn sahip(&self) -> &str`."
- front: "`let ad = h.sahip();` (`&str` döndürür) satırından sonra, `ad` hâlâ kullanılacakken `h.yatir(1)` neden derlenmez?"
  back: "Dönen referans imzaya göre **bütün `h`'yi** ödünç alır; `ad` yaşadıkça `&mut` alınamaz (**E0502**)."
```
