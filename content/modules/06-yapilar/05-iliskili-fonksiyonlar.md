---
id: m06-l05
title: İlişkili fonksiyonlar ve kurucular
minutes: 22
type: lesson
objectives:
  - "`self` almayan ilişkili fonksiyonlar yazıp onları `Tip::fonksiyon()` biçiminde çağırabilmek"
  - "`new` geleneğine ve isimli kuruculara uygun kurucu fonksiyonlar tasarlayabilmek"
  - "`Self` anahtar kelimesini ve birden fazla `impl` bloğunu doğru yerde kullanabilmek"
  - "`::` ile `.` arasındaki farkı açıklayıp `E0599`, `E0423` ve `E0116` hatalarını düzeltebilmek"
keywords: [ilişkili fonksiyon, associated function, kurucu, constructor, new, Self, "::", impl, E0599, E0423, E0116]
---

Modül 4'ten beri `String::from("merhaba")` ve `String::new()` yazıyorsun. Hiç dikkat ettin mi:
`::`'nin solunda bir **değer** yok, bir **tip** var. Bir string'den bir şey istemiyorsun; `String`
tipinden **yeni bir string üretmesini** istiyorsun.

Bu derste kendi tiplerine böyle fonksiyonlar ekleyeceksin. En önemlisi de **kurucular (constructors)**:
`Hesap::new("Elif Demir")` gibi, bir tipin örneklerini doğru ve tutarlı biçimde üreten fonksiyonlar.

:::ferris
Java'dan, C++'tan ya da JavaScript'ten geliyorsan bir sürprize hazırlan: Rust'ta "kurucu" diye özel bir
dil özelliği yok. Ve birazdan göreceğin gibi, bu bir eksiklik değil; bir **güvenlik** kararı.
:::

## `self` almayan fonksiyonlar: ilişkili fonksiyonlar

`impl` bloğunun içinde tanımlanan her fonksiyona **ilişkili fonksiyon (associated function)** denir:
tipe bağlıdır. İlk parametresi `self` olanlar, geçen derste yazdığın **metotlardır**. Ama `self` almak
zorunlu değil:

```rust
struct Dikdortgen {
    genislik: u32,
    yukseklik: u32,
}

impl Dikdortgen {
    fn kare(kenar: u32) -> Dikdortgen {
        Dikdortgen { genislik: kenar, yukseklik: kenar }
    }

    fn alan(&self) -> u32 {
        self.genislik * self.yukseklik
    }
}

fn main() {
    let fayans = Dikdortgen::kare(30);
    let kapi = Dikdortgen { genislik: 90, yukseklik: 210 };
    println!("Fayans: {} cm², kapı: {} cm²", fayans.alan(), kapi.alan());
}
```

`kare`'nin `self` parametresi yok, çünkü çalışmak için elinde bir dikdörtgen olmasına ihtiyacı yok: **yeni
bir tane üretiyor**. Bu yüzden onu bir değer üzerinden değil, **tipin adı** üzerinden `::` ile
çağırırsın: `Dikdortgen::kare(30)`. `String::new()` ve `String::from(...)` da böyle çağrılan, `self`
almayan fonksiyonlardır. (Küçük bir dipnot: `String::from` aslında bir trait'ten gelir; bunu Modül 11'de
göreceksin. Çağırma biçimi aynıdır.)

Java'daki `Math.max(3, 5)` gibi `static` metotlar, C++'taki `static` üye fonksiyonlar ve Python'daki
`@staticmethod` aynı fikrin başka dillerdeki karşılıklarıdır. C++ da bunları Rust gibi `::` ile çağırır.

Peki bir ilişkili fonksiyonu, metot gibi bir değerin üzerinden çağırmaya kalkarsan? Tahmin et:

```compiles
code: |
  struct Dikdortgen {
      genislik: u32,
      yukseklik: u32,
  }

  impl Dikdortgen {
      fn kare(kenar: u32) -> Dikdortgen {
          Dikdortgen { genislik: kenar, yukseklik: kenar }
      }
  }

  fn main() {
      let d = Dikdortgen { genislik: 3, yukseklik: 4 };
      let k = d.kare(5);
      println!("{} {}", k.genislik, d.yukseklik);
  }
answer: false
error: E0599
explanation: |
  `kare`'nin `self` parametresi yok; yani bir **metot değil**. Nokta sözdizimi yalnızca metotlar için
  çalışır, çünkü noktanın solundaki değer `self` olarak verilir; `kare`'nin ise onu koyacak bir yeri yok.
  Doğrusu: `Dikdortgen::kare(5)`.
```

:::error
```text
error[E0599]: no method named `kare` found for struct `Dikdortgen` in the current scope
  --> src/main.rs:14:15
   |
 1 | struct Dikdortgen {
   | ----------------- method `kare` not found for this struct
...
14 |     let k = d.kare(5);
   |               ^^^^ this is an associated function, not a method
   |
   = note: found the following associated functions; to be used as methods, functions must have a `self` parameter
note: the candidate is defined in an impl for the type `Dikdortgen`
  --> src/main.rs:7:5
   |
 7 |     fn kare(kenar: u32) -> Dikdortgen {
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
help: use associated function syntax instead
   |
14 -     let k = d.kare(5);
14 +     let k = Dikdortgen::kare(5);
   |
```
Mesaj her şeyi söylüyor: "bu bir ilişkili fonksiyon, metot değil", "metot olarak kullanılabilmesi için
`self` parametresi olmalı" ve hazır düzeltme: `Dikdortgen::kare(5)`. `-` ile başlayan satır silinecek,
`+` ile başlayan satır eklenecek kodu gösterir.
:::

:::analogy Nüfus müdürlüğü ve kimlik kartın
Yeni bir kimlik kartı çıkarmak için elinde bir kimlik kartı olması gerekmez: nüfus müdürlüğüne gidersin
ve kurum sana bir kart **üretir**. Bu, `Kimlik::cikar(...)` gibi bir **ilişkili fonksiyondur**; kuruma,
yani **tipe** aittir. Kartın üzerindeki doğum tarihini okumak ise ancak elinde **belirli bir kart**
varken mümkündür: `kart.dogum_tarihi()`. Bu bir **metottur**. `::` kuruma gitmek, `.` elindeki karta
bakmaktır.
:::

## Kurucular: `new` geleneği

Her hesap açılışında şunu yazmak zorunda olduğunu düşün: `Hesap { sahip: String::from("Elif"), bakiye: 0 }`.
Her yeni hesap 0 bakiyeyle başlamalı, ama bunu hatırlamak her çağıranın sorumluluğunda. Biri yanlışlıkla
`bakiye: 100_000` yazarsa banka bedavaya para basmış olur. Çözüm, örnek oluşturmayı **tek bir yerde**
toplayan bir **kurucu (constructor)**:

```rust
struct Hesap {
    sahip: String,
    bakiye: u64, // kuruş
}

impl Hesap {
    fn new(sahip: &str) -> Hesap {
        Hesap {
            sahip: String::from(sahip),
            bakiye: 0,
        }
    }
}

fn main() {
    let h1 = Hesap::new("Elif Demir");
    let h2 = Hesap::new("Can Öztürk");
    println!("{}: {} kuruş", h1.sahip, h1.bakiye);
    println!("{}: {} kuruş", h2.sahip, h2.bakiye);
}
```

Artık "yeni hesap 0 bakiyeyle başlar" kuralı tek bir yerde yazıyor. Kural değişirse (örneğin her yeni
hesaba 50 TL hoş geldin bonusu), sadece `new`'i değiştirirsin.

```quiz
question: Rust'ta `new` nedir?
options:
  - Sıradan bir ilişkili fonksiyon adı; ana kurucuya verilen yaygın bir gelenek, dilin özel bir parçası değil
  - "Java'daki gibi bir anahtar kelime; `new Hesap(\"Elif\")` biçiminde kullanılır"
  - Derleyicinin her struct için kendiliğinden ürettiği bir fonksiyon
  - "Bir `impl` bloğunda yalnızca bir kez kullanılabilen özel bir ad"
answer: 0
explanation: |
  `new` Rust'ta bir anahtar kelime değildir; adını `olustur` koysan da program aynen çalışır. Ama
  topluluk ana kurucuya `new` demeyi gelenek hâline getirmiştir; başkalarının kodunu okurken ilk
  arayacağın fonksiyon odur.
feedback:
  - Doğru!
  - "Rust'ta `new` operatörü yok; `Hesap::new(\"Elif\")` sıradan bir fonksiyon çağrısıdır."
  - "Derleyici hiçbir kurucu üretmez; `new`'i sen yazmazsan yoktur."
  - "`new` özel bir ad değil. Yalnızca, aynı `impl` içinde aynı adı iki fonksiyona veremezsin; bu kural her ad için geçerli."
```

Peki Rust'ta neden "kurucu" diye özel bir şey yok? Diğer dillere bakalım:

:::info Diğer dillerde kurucular
- **Java / C#**: `new Hesap("Elif")`. Önce bellekte, alanları varsayılan değerlerle (`null`, `0`) dolu bir
  nesne açılır, sonra kurucu çalışır. Kurucuda bir alanı atamayı unutursan alan sessizce `null` kalır.
- **C++**: `Hesap h("Elif");`. Kurucuda başlatmayı unuttuğun bir `int` alan **çöp değer** taşıyabilir.
- **Python**: `Hesap("Elif")` çağrısı `__init__`'i çalıştırır; nesneye alanları istediğin an ekleyebilirsin.
- **Rust**: Bir struct değeri **yalnızca bütün alanları verilen** bir struct ifadesiyle var olabilir
  (eksik alan → `E0063`, ilk dersten hatırla). "Kurucu" dediğimiz şey, sonunda böyle bir ifade döndüren
  sıradan bir fonksiyondur. Bu yüzden Rust'ta **yarım kurulmuş nesne** diye bir şey yoktur.
:::

Bir de şu var: Rust'ta **aşırı yükleme (overloading)** yoktur; aynı adla, farklı parametreler alan iki
fonksiyon yazamazsın. Java'da `Dikdortgen(int kenar)` ve `Dikdortgen(int en, int boy)` diye iki kurucu
yazabilirsin; hangisinin çalışacağını argümanların sayısı belirler. Rust'ta ise her üretme biçimine
**isimli kurucu** yazarsın: `Dikdortgen::new(3, 4)`, `Dikdortgen::kare(5)`. Standart kütüphanede de
böyle: `String::new()`, `String::from("...")`, `String::with_capacity(100)`. İsim, ne yaptığını söyler.

Kurucu çağrısında bellekte ne olduğuna bakalım:

```memory
title: "`let h = Hesap::new(\"Elif Demir\");` adım adım"
steps:
  - caption: "`Hesap::new` çalışıyor: `String::from(sahip)` heap'te yeni bir metin oluşturdu, struct ifadesi de fonksiyonun içinde bir `Hesap` değeri kurdu."
    stack:
      - frame: main
        vars:
          - { name: h, type: Hesap, value: "henüz değer yok" }
      - frame: Hesap::new
        vars:
          - { name: sahip, type: "&str", value: "\"Elif Demir\"" }
          - { name: "(dönüş değeri)", type: Hesap, value: "sahip: ptr · len=10 · cap=10 | bakiye: 0", to: h1 }
    heap:
      - { id: h1, value: "Elif Demir" }
  - caption: "`new` bitti: değer `main`'deki `h`'ye taşındı ve `new`'in çerçevesi kayboldu. Heap'teki karakterler kopyalanmadı; artık sahibi `h`."
    stack:
      - frame: main
        vars:
          - { name: h, type: Hesap, value: "sahip: ptr · len=10 · cap=10 | bakiye: 0", to: h1 }
    heap:
      - { id: h1, value: "Elif Demir" }
```

Değeri döndürmek, Modül 4'te gördüğün gibi bir **taşımadır**: yalnızca stack'teki küçük kısım (işaretçi,
uzunluk, kapasite ve bakiye) yer değiştirir. Çoğu zaman derleyici bu kopyayı da tamamen ortadan kaldırıp
değeri doğrudan `h`'nin yerinde kurar.

Kurucumuz `&str` alıyor. `String` alsaydı ne olurdu? Modül 4'ü hatırla ve tahmin et:

```compiles
code: |
  struct Hesap {
      sahip: String,
      bakiye: u64,
  }

  impl Hesap {
      fn new(sahip: String) -> Hesap {
          Hesap { sahip, bakiye: 0 }
      }
  }

  fn main() {
      let isim = String::from("Elif");
      let h = Hesap::new(isim);
      println!("{isim} adına hesap açıldı");
      println!("{} {}", h.sahip, h.bakiye);
  }
answer: false
error: E0382
explanation: |
  `new(sahip: String)` parametresini **değer olarak** alıyor; `Hesap::new(isim)` çağrısı `isim`'i
  fonksiyona taşır ve string artık hesabın `sahip` alanına aittir. Kurucular da sıradan
  fonksiyonlardır: Modül 4'teki sahiplik kuralları aynen geçerli.
```

:::error
```text
error[E0382]: borrow of moved value: `isim`
  --> src/main.rs:15:16
   |
13 |     let isim = String::from("Elif");
   |         ---- move occurs because `isim` has type `String`, which does not implement the `Copy` trait
14 |     let h = Hesap::new(isim);
   |                        ---- value moved here
15 |     println!("{isim} adına hesap açıldı");
   |                ^^^^ value borrowed here after move
   |
note: consider changing this parameter type in method `new` to borrow instead if owning the value isn't necessary
  --> src/main.rs:7:19
   |
 7 |     fn new(sahip: String) -> Hesap {
   |        ---        ^^^^^^ this parameter takes ownership of the value
   |        |
   |        in this method
help: consider cloning the value if the performance cost is acceptable
   |
14 |     let h = Hesap::new(isim.clone());
   |                            ++++++++
```
Derleyici iki çözüm öneriyor: parametreyi ödünç alacak şekilde değiştirmek ya da `isim.clone()` ile
kopya vermek. Bu örnekte en basiti, `println!`'i `Hesap::new`'den önceye almak ya da `h.sahip`'i yazdırmak.
:::

Hangisini seçmeli? İkisi de doğru; sadece farklı takaslar:

| Parametre | Çağıran yazar | Artısı | Eksisi |
|---|---|---|---|
| `sahip: &str` | `Hesap::new("Elif")` | rahat; çağıranın string'i elinde kalır | içeride her seferinde yeni bir `String` (kopya) oluşur |
| `sahip: String` | `Hesap::new(isim)` | gereksiz kopya yok; sahiplik devredilir | çağıran değerini kaybeder; literal için `String::from` gerekir |

Bu kursta küçük örneklerde rahatlık için çoğunlukla `&str` kullanacağız. İkisini birden kabul eden
esnek parametreleri (`impl Into<String>`, `impl AsRef<str>`) Modül 11'de tanıyacak, Modül 25'te API
tasarımı açısından yeniden ele alacaksın.

## `Self`: tipin kendi adı

Kurucumuzda `Hesap` adını üç kez yazdık: `impl` başlığında, dönüş tipinde ve struct ifadesinde. `impl`
bloğunun içinde bunun kısaltması var: **`Self`** (büyük S ile), yani "bu `impl` bloğunun tipi":

```rust
# struct Hesap {
#     sahip: String,
#     bakiye: u64,
# }
#
impl Hesap {
    fn new(sahip: &str) -> Self {
        Self {
            sahip: String::from(sahip),
            bakiye: 0,
        }
    }
}
#
# fn main() {
#     let h = Hesap::new("Elif Demir");
#     println!("{} {}", h.sahip, h.bakiye);
# }
```

Neden `Self`? Tipin adını değiştirirsen `impl` içini elleme gerekmez; kurucunun "kendi tipini"
döndürdüğü bir bakışta anlaşılır. Modül 11'de tip adları `Nokta<T>` gibi uzadığında da çok işine yarayacak.
Rust topluluğunda kurucular neredeyse her zaman `-> Self` ile yazılır.

Büyük-küçük harf burada çok önemli:

| | `Self` | `self` |
|---|---|---|
| Nedir? | bir **tip**: `impl` bloğunun tipi | bir **değer**: metodun çağrıldığı örnek |
| Nerede kullanılır? | `impl` içinde her yerde: dönüş tipi, parametre tipi (`&Self`), `Self { .. }`, `Self::fonksiyon()` | yalnızca metotların içinde |
| Örnek | `fn new() -> Self` | `self.bakiye`, `&self` |

`Self` ile bir ilişkili fonksiyondan diğerini de çağırabilirsin. Modül 2'deki tamsayı bölmesini
hatırlayarak tahmin et:

```predict
code: |
  struct Sure {
      saat: u32,
      dakika: u32,
  }

  impl Sure {
      fn dakikadan(toplam: u32) -> Self {
          Self { saat: toplam / 60, dakika: toplam % 60 }
      }
  }

  fn main() {
      let film = Sure::dakikadan(195);
      println!("{}:{}", film.saat, film.dakika);
  }
options:
  - "3:15"
  - "3.25:15"
  - "3:25"
  - "Derlenmez: `Self` bir struct ifadesinde kullanılamaz"
answer: 0
explanation: |
  Modül 2'den: iki tamsayının bölümü yine tamsayıdır ve kesirli kısım atılır. `195 / 60 = 3` (3,25 değil!),
  kalan operatörü `%` ise artanı verir: `195 % 60 = 15`. Film 3 saat 15 dakika sürüyor. `Self { .. }`
  burada `Sure { .. }` ile birebir aynıdır.
```

Şimdi sıra sende. `Tutar` tipinin, iki farklı birimden tutar üreten iki **isimli kurucusu** var:

```fill
prompt: "Boşlukları doldur. İpucu: ikinci kurucu, işi birinci kurucuya devrediyor."
code: |
  struct Tutar {
      kurus: u64,
  }

  impl Tutar {
      fn kurustan(miktar: u64) -> ___0 {
          Self { kurus: miktar }
      }

      fn tlden(miktar: u64) -> Self {
          ___1::kurustan(miktar * 100)
      }

      fn metin(___2) -> String {
          format!("{},{:02} TL", self.kurus / 100, self.kurus % 100)
      }
  }

  fn main() {
      let simit = Tutar::kurustan(1_550);
      let bilet = Tutar::tlden(40);
      println!("{} / {}", simit.metin(), bilet.metin());
  }
blanks:
  - ["Self", "Tutar"]
  - ["Self", "Tutar"]
  - ["&self"]
output: |
  15,50 TL / 40,00 TL
explanation: |
  - `kurustan` kendi tipinden bir değer döndürüyor → `-> Self` (ya da `-> Tutar`).
  - `tlden`, TL'yi kuruşa çevirip işi `kurustan`'a devrediyor. `self` almayan bir fonksiyondan başka bir
    ilişkili fonksiyonu çağırırken de `::` kullanılır: `Self::kurustan(...)`. Burada `self.kurustan(...)`
    yazamazsın: `tlden`'in `self`'i yok ve `kurustan` bir metot değil.
  - `metin` sadece okuyor → `&self`. `{:02}` kuruşu iki haneye tamamlar: `0` → `00`.
```

## `::` mi, `.` mı?

Artık iki çağırma biçimini de biliyorsun. Hepsini bir tabloda toplayalım:

| Yazım | Ne çağırır? | Örnek |
|---|---|---|
| `Tip::fonksiyon(..)` | `self` almayan ilişkili fonksiyon | `Hesap::new("Elif")`, `String::from("a")` |
| `deger.metot(..)` | metot; alıcı otomatik verilir | `h.bakiye()` |
| `Tip::metot(&deger, ..)` | aynı metot, alıcı açıkça verilir | `Hesap::bakiye(&h)` |
| `deger.fonksiyon(..)` | hata `E0599`: ilişkili fonksiyonun `self`'i yok | `d.kare(5)` |
| `Tip.fonksiyon(..)` | hata `E0423`: tip bir değer değil | `Hesap.new()` |

Kural basit: **`::` yollar içindir**: bir tipin (ve Modül 8'de göreceğin modüllerin) içindeki öğelere
ulaşırsın. **`.` değerler içindir**: bir örneğin alanına ya da metoduna ulaşırsın. Java bu ikisini ayırmaz; hem
`Math.max(..)` hem `liste.size()` nokta ile yazılır. Rust'ta yazım, bir bakışta "bu bir değer mi, bir tip
mi?" sorusunu cevaplar. Tahmin et:

```compiles
code: |
  struct Hesap {
      bakiye: u64,
  }

  impl Hesap {
      fn new() -> Self {
          Self { bakiye: 0 }
      }
  }

  fn main() {
      let h = Hesap.new();
      println!("{}", h.bakiye);
  }
answer: false
error: E0423
explanation: |
  `Hesap` bir **tip**, bir değer değil; noktanın solunda ise bir değer olmalı. Derleyici `Hesap` adında bir
  değer arar, bulamaz: `E0423`. Doğrusu `Hesap::new()`.
```

:::error
```text
error[E0423]: cannot find value `Hesap` in this scope
  --> src/main.rs:12:13
   |
12 |     let h = Hesap.new();
   |             ^^^^^
   |
   = note: a struct named `Hesap` exists in another namespace
help: use the path separator to refer to an item
   |
12 -     let h = Hesap.new();
12 +     let h = Hesap::new();
   |
```
"a struct named `Hesap` exists in another namespace": Rust'ta **tipler** ve **değerler** ayrı isim
alanlarında yaşar. **Path separator** dediği şey `::`'dir.
:::

Tersi de olur: bir metodu `Tip::metot()` biçiminde çağırıp alıcıyı vermeyi unutursan, derleyici eksik
argümanın tipini söyler. Bu mesaj, metotların aslında "ilk parametresi `self` olan fonksiyonlar" olduğunu
çok güzel gösteriyor:

:::error
```text
error[E0061]: this function takes 1 argument but 0 arguments were supplied
  --> src/main.rs:13:20
   |
13 |     println!("{}", Hesap::bakiye());
   |                    ^^^^^^^^^^^^^-- argument #1 of type `&Hesap` is missing
   |
note: method defined here
  --> src/main.rs:6:8
   |
 6 |     fn bakiye(&self) -> u64 {
   |        ^^^^^^ -----
help: provide the argument
   |
13 |     println!("{}", Hesap::bakiye(/* &Hesap */));
   |                                  ++++++++++++
```
`&self` parametresi, `Hesap::bakiye` için 1 numaralı argümandır ve tipi `&Hesap`'tir.
:::

```parsons
prompt: Satırları sıraya koyarak boş bir kumbara üreten `new` kurucusunu yaz ve `main`'de kullan. Dikkat, iki satır tuzak!
lines: |
  struct Kumbara { kurus: u64 }
  impl Kumbara {
      fn new() -> Self {
          Self { kurus: 0 }
      }
  }
  fn main() {
      let k = Kumbara::new();
      println!("Kumbarada {} kuruş var.", k.kurus);
  }
distractors: |
      fn new(&self) -> Self {
      let k = Kumbara.new();
explanation: |
  `new` yeni bir kumbara **üretir**; çalışmak için elinde bir kumbara olmasına ihtiyacı yoktur, bu yüzden
  `self` almaz. `fn new(&self)` yazsaydın, ilk kumbarayı üretmek için önce bir kumbaran olması gerekirdi!
  Çağrı da tipin adı üzerinden `::` ile yapılır; `Kumbara.new()` `E0423` verir.
```

Şimdi bir kurucuyu ve onu kullanan metotları sen yaz:

```exercise
id: m06-e-sefer-suresi
title: Otobüs seferinin süresi
difficulty: 2
prompt: |
  Bir otobüs firmasının sefer süreleriyle çalışıyorsun. `Sure` tipi ve `dakikadan` kurucusu hazır.
  Şunları yaz:

  - `new(saat, dakika)` — dakika 59'u aşarsa fazlasını saate aktarmalı: `Sure::new(1, 75)` → 2 saat 15 dakika.
  - `toplam_dakika(&self) -> u32` — süreyi dakikaya çevirir.
  - `topla(&self, diger: &Sure) -> Self` — iki sürenin toplamını **yeni** bir `Sure` olarak döndürür;
    iki süre de değişmeden kalır.
starter: |
  struct Sure {
      saat: u32,
      dakika: u32,
  }

  impl Sure {
      fn dakikadan(toplam: u32) -> Self {
          Self { saat: toplam / 60, dakika: toplam % 60 }
      }

      fn new(saat: u32, dakika: u32) -> Self {
          todo!()
      }

      fn toplam_dakika(&self) -> u32 {
          todo!()
      }

      fn topla(&self, diger: &Sure) -> Self {
          todo!()
      }
  }

  fn main() {
      let yol = Sure::new(5, 40);
      let mola = Sure::dakikadan(35);
      let toplam = yol.topla(&mola);
      println!("Toplam yolculuk: {}:{:02}", toplam.saat, toplam.dakika);
  }
solution: |
  struct Sure {
      saat: u32,
      dakika: u32,
  }

  impl Sure {
      fn dakikadan(toplam: u32) -> Self {
          Self { saat: toplam / 60, dakika: toplam % 60 }
      }

      fn new(saat: u32, dakika: u32) -> Self {
          Self::dakikadan(saat * 60 + dakika)
      }

      fn toplam_dakika(&self) -> u32 {
          self.saat * 60 + self.dakika
      }

      fn topla(&self, diger: &Sure) -> Self {
          Self::dakikadan(self.toplam_dakika() + diger.toplam_dakika())
      }
  }

  fn main() {
      let yol = Sure::new(5, 40);
      let mola = Sure::dakikadan(35);
      let toplam = yol.topla(&mola);
      println!("Toplam yolculuk: {}:{:02}", toplam.saat, toplam.dakika);
  }
check: tests
tests: |
  #[test]
  fn new_fazla_dakikayi_saate_aktarir() {
      let s = Sure::new(1, 75);
      assert_eq!((s.saat, s.dakika), (2, 15), "1 saat 75 dakika = 2 saat 15 dakika olmalı");
  }

  #[test]
  fn new_gecerli_degerleri_korur() {
      let s = Sure::new(8, 5);
      assert_eq!((s.saat, s.dakika), (8, 5), "8 saat 5 dakika olduğu gibi kalmalı");
      let s = Sure::new(0, 60);
      assert_eq!((s.saat, s.dakika), (1, 0), "0 saat 60 dakika = 1 saat 0 dakika olmalı");
  }

  #[test]
  fn toplam_dakika_dogru() {
      assert_eq!(Sure::new(2, 30).toplam_dakika(), 150, "2 saat 30 dakika = 150 dakika");
      assert_eq!(Sure::new(0, 0).toplam_dakika(), 0, "sıfır süre 0 dakikadır");
  }

  #[test]
  fn topla_eldeyi_tasir_ve_girdileri_degistirmez() {
      let yol = Sure::new(5, 40);
      let mola = Sure::dakikadan(35);
      let toplam = yol.topla(&mola);
      assert_eq!((toplam.saat, toplam.dakika), (6, 15), "5:40 + 0:35 = 6:15 olmalı");
      assert_eq!((yol.saat, yol.dakika), (5, 40), "topla, yol süresini değiştirmemeli");
  }
hints:
  - "`new`'i sıfırdan yazmana gerek yok: saati ve dakikayı **toplam dakikaya** çevirip hazır kurucuya ver; fazlalığı o halleder."
  - "`fn new(saat: u32, dakika: u32) -> Self { Self::dakikadan(saat * 60 + dakika) }`. `toplam_dakika` da aynı formülü `self.saat` ve `self.dakika` ile kullanır."
  - "`topla`: iki sürenin toplam dakikalarını topla ve sonucu yine kurucuya ver: `Self::dakikadan(self.toplam_dakika() + diger.toplam_dakika())`."
explanation: |
  "Dakika 60'tan küçük olmalı" kuralını yalnızca **bir** fonksiyon biliyor: `dakikadan`. `new` ve `topla`
  işi ona devrederek aynı kuralı tekrar yazmıyor; kural değişirse tek bir yeri düzeltirsin. Bu, iyi
  tasarlanmış tiplerde sık gördüğün bir desendir: bütün yollar tek bir kurucudan geçer.

  `topla`, `&self` ve `&Sure` aldığı için iki süreyi de yalnızca **ödünç alıyor**; sonuç yepyeni bir
  değer. Son test bunu doğruluyor. (İmzada `diger: &Self` de yazabilirdin; ikisi aynı şey.)
```

## Birden fazla `impl` bloğu

Bir tipin birden fazla `impl` bloğu olabilir; derleyici hepsini birleştirir. Bazen ilgili fonksiyonları
gruplamak için kullanılır:

```rust
struct Hesap {
    sahip: String,
    bakiye: u64,
}

// Kurucular
impl Hesap {
    fn new(sahip: &str) -> Self {
        Self { sahip: String::from(sahip), bakiye: 0 }
    }
}

// Para işlemleri
impl Hesap {
    fn yatir(&mut self, miktar: u64) {
        self.bakiye += miktar;
    }

    fn bakiye(&self) -> u64 {
        self.bakiye
    }
}

fn main() {
    let mut h = Hesap::new("Elif Demir");
    h.yatir(12_500);
    println!("{}: {} kuruş", h.sahip, h.bakiye());
}
```

Sıradan bir tip için genellikle tek bir blok yeter. Ama Modül 11'de **trait**'leri öğrendiğinde birden
fazla blok kaçınılmaz olacak: her trait gerçekleştirmesi `impl Trait for Tip { ... }` biçiminde **kendi
bloğunda** yazılır.

Peki başkasının tipine `impl` bloğu yazabilir miyiz? Diyelim ki otogarın duyuru sistemi için her
`String`'e bir `anons` metodu eklemek istiyorsun. Tahmin et:

```compiles
code: |
  impl String {
      fn anons(&self) -> String {
          format!("Sayın yolcularımız, {}!", self)
      }
  }

  fn main() {
      let s = String::from("otobüsümüz 5. perondan kalkacaktır");
      println!("{}", s.anons());
  }
answer: false
error: E0116
explanation: |
  Bir tipe doğrudan `impl` bloğu (inherent impl) yalnızca **o tipin tanımlandığı crate'te** yazılabilir.
  `String` standart kütüphanede tanımlı; senin programın onun bir parçası değil: `E0116`.
```

:::error
```text
error[E0116]: cannot define inherent `impl` for a type outside of the crate where the type is defined
 --> src/main.rs:1:1
  |
1 | impl String {
  | ^^^^^^^^^^^ impl for type defined outside of crate
  |
  = help: consider defining a trait and implementing it for the type or using a newtype wrapper like `struct MyType(ExternalType);` and implement it
  = note: for more details about the orphan rules, see <https://doc.rust-lang.org/reference/items/implementations.html?highlight=orphan#orphan-rules>

error[E0599]: no method named `anons` found for struct `String` in the current scope
 --> src/main.rs:9:22
  |
9 |     println!("{}", s.anons());
  |                      ^^^^^ method not found in `String`
```
İki hata var ama kök neden **bir**: `impl` reddedildiği için `anons` metodu hiç oluşmadı, bu yüzden
ikinci hata da çıktı. Uzun bir hata listesi gördüğünde paniğe kapılma; **ilk** hatayı düzelt, diğerleri
çoğu zaman kendiliğinden kaybolur.
:::

Bu kuralın nedeni ne? Düşün: iki farklı kütüphane `String`'e farklı davranan birer `anons` metodu
ekleseydi, `s.anons()` hangisini çağırırdı? Ya da standart kütüphane yarın `String`'e aynı adda bir metot
eklese, senin kodun bozulurdu. Rust bu belirsizliği baştan yasaklar. (Bu kuralın genel adı **yetim kuralı
(orphan rule)**; Modül 11'de trait'lerle birlikte ayrıntılı göreceksin.)

Derleyicinin önerdiği çözümlerden birini zaten biliyorsun: ikinci dersteki **newtype** deseni! Kendi
tipin olan sarmalayıcıya istediğin metodu ekleyebilirsin:

```rust
struct Anons(String);

impl Anons {
    fn oku(&self) -> String {
        format!("Sayın yolcularımız, {}!", self.0)
    }
}

fn main() {
    let a = Anons(String::from("otobüsümüz 5. perondan kalkacaktır"));
    println!("{}", a.oku());
}
```

:::deep İlişkili sabitler
`impl` bloğu yalnızca fonksiyon değil, **sabit** de tutabilir. Modül 2'deki `const` gibi tip belirtmek
zorunludur ve adlar BÜYÜK_HARFLE yazılır. Sabite `Tip::SABIT` ya da `impl` içinden `Self::SABIT` ile
ulaşırsın:

```rust
struct Hesap {
    bakiye: u64,
}

impl Hesap {
    const GUNLUK_LIMIT: u64 = 1_000_000; // 10.000 TL (kuruş cinsinden)

    fn cekebilir_mi(&self, miktar: u64) -> bool {
        miktar <= self.bakiye && miktar <= Self::GUNLUK_LIMIT
    }
}

fn main() {
    let h = Hesap { bakiye: 5_000_000 };
    println!("Günlük limit: {} kuruş", Hesap::GUNLUK_LIMIT);
    println!("20.000 TL çekebilir mi? {}", h.cekebilir_mi(2_000_000));
}
```
Sabit tipe aittir: her örnekte ayrı bir kopyası tutulmaz. Standart kütüphanede `u32::MAX` ve `i32::MIN`
de böyle ilişkili sabitlerdir.
:::

## Alıştırma: kesirler

Son alıştırmada kurucunun en güçlü kullanımını göreceksin: tipin **her zaman** geçerli bir durumda
olmasını garanti etmek.

```exercise
id: m06-e-kesir
title: Her zaman sade kesirler
difficulty: 4
prompt: |
  Bir matematik uygulaması için `Kesir` tipi yazıyorsun. `new` kurucusu kesri her zaman **en sade** ve
  **paydası pozitif** hâlde saklamalı:

  - `Kesir::new(6, 8)` → 3/4
  - `Kesir::new(1, -2)` → -1/2 (eksi işareti paydan taşınır)
  - `Kesir::new(-3, -9)` → 1/3
  - `Kesir::new(0, 5)` → 0/1

  `topla` ve `carp` yeni bir kesir döndürür; sonuçlar da sade olmalı. En büyük ortak böleni (EBOB)
  bulan `ebob` yardımcı fonksiyonu hazır. Payda hiçbir zaman 0 verilmeyecek (geçersiz girdileri
  Modül 10'da hatalarla ele alacağız).
starter: |
  struct Kesir {
      pay: i32,
      payda: i32,
  }

  impl Kesir {
      // Hazır yardımcı: en büyük ortak bölen (Öklid algoritması).
      // Sonuç her zaman pozitiftir. Örnek: Kesir::ebob(-6, 8) == 2
      fn ebob(a: i32, b: i32) -> i32 {
          let mut a = if a < 0 { -a } else { a };
          let mut b = if b < 0 { -b } else { b };
          while b != 0 {
              let kalan = a % b;
              a = b;
              b = kalan;
          }
          a
      }

      fn new(pay: i32, payda: i32) -> Self {
          todo!()
      }

      fn topla(&self, diger: &Kesir) -> Self {
          todo!()
      }

      fn carp(&self, diger: &Kesir) -> Self {
          todo!()
      }
  }

  fn main() {
      let yarim = Kesir::new(1, 2);
      let ucte_bir = Kesir::new(1, 3);
      let t = yarim.topla(&ucte_bir);
      let c = yarim.carp(&ucte_bir);
      println!("1/2 + 1/3 = {}/{}", t.pay, t.payda);
      println!("1/2 · 1/3 = {}/{}", c.pay, c.payda);
  }
solution: |
  struct Kesir {
      pay: i32,
      payda: i32,
  }

  impl Kesir {
      // Hazır yardımcı: en büyük ortak bölen (Öklid algoritması).
      // Sonuç her zaman pozitiftir. Örnek: Kesir::ebob(-6, 8) == 2
      fn ebob(a: i32, b: i32) -> i32 {
          let mut a = if a < 0 { -a } else { a };
          let mut b = if b < 0 { -b } else { b };
          while b != 0 {
              let kalan = a % b;
              a = b;
              b = kalan;
          }
          a
      }

      fn new(pay: i32, payda: i32) -> Self {
          let bolen = Self::ebob(pay, payda);
          let mut pay = pay / bolen;
          let mut payda = payda / bolen;
          if payda < 0 {
              pay = -pay;
              payda = -payda;
          }
          Self { pay, payda }
      }

      fn topla(&self, diger: &Kesir) -> Self {
          Self::new(self.pay * diger.payda + diger.pay * self.payda, self.payda * diger.payda)
      }

      fn carp(&self, diger: &Kesir) -> Self {
          Self::new(self.pay * diger.pay, self.payda * diger.payda)
      }
  }

  fn main() {
      let yarim = Kesir::new(1, 2);
      let ucte_bir = Kesir::new(1, 3);
      let t = yarim.topla(&ucte_bir);
      let c = yarim.carp(&ucte_bir);
      println!("1/2 + 1/3 = {}/{}", t.pay, t.payda);
      println!("1/2 · 1/3 = {}/{}", c.pay, c.payda);
  }
check: tests
tests: |
  #[test]
  fn kurucu_sadelestirir() {
      let k = Kesir::new(6, 8);
      assert_eq!((k.pay, k.payda), (3, 4), "6/8 sadeleşince 3/4 olmalı");
  }

  #[test]
  fn payda_hep_pozitif() {
      let k = Kesir::new(1, -2);
      assert_eq!((k.pay, k.payda), (-1, 2), "1/-2, -1/2 olarak saklanmalı");
      let k = Kesir::new(-3, -9);
      assert_eq!((k.pay, k.payda), (1, 3), "-3/-9 sadeleşince 1/3 olmalı");
  }

  #[test]
  fn sifir_kesri() {
      let k = Kesir::new(0, 5);
      assert_eq!((k.pay, k.payda), (0, 1), "0/5, 0/1 olarak saklanmalı");
  }

  #[test]
  fn toplam_sade_olur() {
      let t = Kesir::new(1, 2).topla(&Kesir::new(1, 3));
      assert_eq!((t.pay, t.payda), (5, 6), "1/2 + 1/3 = 5/6 olmalı");
      let t = Kesir::new(1, 4).topla(&Kesir::new(1, 4));
      assert_eq!((t.pay, t.payda), (1, 2), "1/4 + 1/4 = 2/4, sadeleşince 1/2 olmalı");
      let t = Kesir::new(1, 2).topla(&Kesir::new(-1, 2));
      assert_eq!((t.pay, t.payda), (0, 1), "1/2 + (-1/2) = 0/1 olmalı");
  }

  #[test]
  fn carpim_sade_olur() {
      let c = Kesir::new(2, 3).carp(&Kesir::new(3, 4));
      assert_eq!((c.pay, c.payda), (1, 2), "2/3 · 3/4 = 6/12, sadeleşince 1/2 olmalı");
      let c = Kesir::new(-1, 2).carp(&Kesir::new(2, -3));
      assert_eq!((c.pay, c.payda), (1, 3), "(-1/2) · (-2/3) = 2/6 = 1/3 olmalı");
  }
hints:
  - "Önce `new`'i yaz. `topla` ve `carp` sonuçlarını `Self::new(...)` ile üretirse, sadeleştirmeyi ve işaret kuralını bedavaya alır."
  - "`new`: `let bolen = Self::ebob(pay, payda);` ile ortak böleni bul ve pay ile paydayı ona böl (yeni değerler için gölgeleme kullanabilirsin). Sonra payda negatifse **ikisinin de** işaretini çevir."
  - "`topla`: a/b + c/d = (a·d + c·b) / (b·d) → `Self::new(self.pay * diger.payda + diger.pay * self.payda, self.payda * diger.payda)`. `carp`: `Self::new(self.pay * diger.pay, self.payda * diger.payda)`."
explanation: |
  Kurucu bir **değişmez (invariant)** kuruyor: "her `Kesir` sadedir ve paydası pozitiftir". `topla` ve
  `carp` sonuçlarını `Self::new` ile ürettiği için bu kural kendiliğinden korunuyor; hiçbir işlem kuralı
  bozan bir kesir üretemiyor. Kazancı da büyük: 1/2 ile 2/4'ün aynı kesir olup olmadığını anlamak için
  alanları karşılaştırmak yetiyor, çünkü 2/4 diye bir değer hiç var olamıyor.

  İşaret kuralı için iki adım gerekiyor: önce sadeleştir (`ebob` her zaman pozitif olduğu için işaretler
  korunur), sonra payda negatifse ikisinin de işaretini çevir. `-3/-9` → `-1/-3` → `1/3`.

  Ama bir açık hâlâ var: alanlar herkese açık. Biri `Kesir { pay: 2, payda: 4 }` yazıp kurucuyu atlayabilir.
  Modül 8'de alanları gizli (private) yaparak kurucudan geçmeyi **zorunlu** hâle getireceksin; o zaman bu
  değişmezi derleyici garanti edecek.
```

## Özet

:::remember
- `self` almayan ilişkili fonksiyonlar `Tip::fonksiyon()` ile çağrılır; değer üzerinden çağırmak `E0599` verir.
- Rust'ta dil düzeyinde kurucu yoktur: kurucu, struct ifadesi döndüren sıradan bir fonksiyondur. Ana kurucunun adı geleneksel olarak `new`'dir.
- Aşırı yükleme (overloading) yok: farklı üretme biçimleri için **isimli kurucular** yaz (`kare`, `dakikadan`, `tlden`).
- `Self` = `impl` bloğunun tipi (`-> Self`, `Self { .. }`, `Self::fonksiyon()`); `self` = metodun çağrıldığı değer.
- `::` yollar (tipler) için, `.` değerler için: `Hesap.new()` → `E0423`.
- Bir tipin birden fazla `impl` bloğu olabilir; ama yalnızca **kendi crate'indeki** tiplere `impl` yazabilirsin (`E0116` → newtype kullan).
:::

```reflect
prompt: |
  Rust'ta "kurucu" diye özel bir dil özelliği yok; kurucu, bütün alanları dolduran bir struct ifadesi
  döndüren sıradan bir fonksiyon. Java veya C++'taki kuruculara göre bunun kazandırdığı güvenceyi
  "yarım kurulmuş nesne" kavramı üzerinden açıkla.
answer: |
  Java'da nesne önce varsayılan değerlerle (`null`, `0`) oluşturulur, sonra kurucu alanları doldurur.
  Kurucuda bir alanı atamayı unutmak sessizce `null` bırakır; C++'ta ise başlatılmamış alanlar çöp
  değer taşıyabilir. Yani "yarım kurulmuş" bir nesneyle çalışmak mümkündür. Rust'ta bir struct değeri
  ancak bütün alanları verildiğinde var olabilir; eksik alan derleme hatasıdır (`E0063`). Kurucu sıradan
  bir fonksiyon olduğu için de özel kurallar ezberlemen gerekmez: sahiplik, ödünç alma ve dönüş değeri
  kuralları aynen geçerlidir. Sonuç olarak her değer, var olduğu ilk andan itibaren tamdır.
```

```flashcards
- front: İlişkili fonksiyon (associated function) nedir?
  back: "Bir `impl` bloğunda tanımlanan her fonksiyon. `self` almayanlar `Tip::fonksiyon()` ile çağrılır (ör. `String::from`, `Hesap::new`)."
- front: "`Dikdortgen::kare(kenar: u32)` için `d.kare(5)` neden derlenmez?"
  back: "`kare`'nin `self` parametresi yok, yani metot değil (**E0599**). Doğrusu `Dikdortgen::kare(5)`."
- front: "Rust'ta `new` bir anahtar kelime mi?"
  back: "Hayır. Ana kurucuya verilen geleneksel bir ad; Rust'ta dil düzeyinde kurucu yoktur."
- front: Rust'ta neden aynı adla iki kurucu yazamazsın, bunun yerine ne yaparsın?
  back: "Rust'ta aşırı yükleme (overloading) yok. Her üretme biçimine isimli bir kurucu yazarsın: `Dikdortgen::kare`, `String::with_capacity`."
- front: "`Self` ile `self` arasındaki fark nedir?"
  back: "`Self` bir **tip**tir (`impl` bloğunun tipi); `self` bir **değer**dir (metodun çağrıldığı örnek)."
- front: "`Hesap.new()` hangi hatayı verir? Doğrusu ne?"
  back: "**E0423**: `Hesap` bir değer değil, bir tip. Doğrusu `Hesap::new()`."
- front: "`impl String { ... }` neden derlenmez, çözüm ne?"
  back: "**E0116**: yalnızca kendi crate'inde tanımlı tiplere doğrudan `impl` yazabilirsin. Çözüm: newtype (`struct Anons(String);`) ya da trait (Modül 11)."
- front: Bir tipin birden fazla `impl` bloğu olabilir mi?
  back: "Evet; derleyici hepsini birleştirir. Trait gerçekleştirmeleri (Modül 11) zaten her zaman ayrı bloklarda yazılır."
```
