---
id: m06-l01
title: Struct tanımlamak ve kullanmak
minutes: 20
type: lesson
objectives:
  - İlişkili verileri bir `struct` altında toplayıp ondan örnekler (instance) oluşturabilmek
  - Alanlara erişip onları değiştirebilmek ve `mut`'un neden örneğin tamamına ait olduğunu açıklayabilmek
  - Alan başlatma kısaltmasını ve struct güncelleme sözdizimini (`..diger`) taşıma kurallarıyla birlikte doğru kullanabilmek
  - Struct alanlarında şimdilik neden `&str` yerine `String` kullandığımızı gerekçelendirebilmek
keywords: [struct, yapı, alan, field, instance, field init shorthand, struct update, kısmi taşıma, E0063, E0594]
---

Bir okul otomasyonu yazdığını düşün. Her öğrencinin bir adı, numarası, not ortalaması ve kayıt durumu
var. Şimdiye kadar öğrendiklerinle bu bilgileri nasıl tutardın? Dört ayrı değişkenle mi? Bir tuple ile
mi? İkisi de küçük programlarda iş görür ama program büyüdükçe dağılır.

Bu derste Rust'ta **kendi tipini** yaratmanın ilk ve en önemli yolunu öğreneceksin: **struct (yapı)**.
Bu arada bir sır: Modül 4'ten beri kullandığın `String` ve `Vec` de aslında birer struct'tır.

:::ferris
Bugüne kadar hep Rust'ın sana hazır verdiği tipleri kullandın. Bugün ilk kez kendi tipini
tasarlıyorsun, programcılığın en keyifli anlarından biri! 🦀
:::

## Dağınık değişkenlerden struct'a

Önce sorunu görelim. İki öğrencinin bilgilerini şimdiye kadarki araçlarla tutalım:

```rust
fn main() {
    // 1) Dağınık değişkenler: hangi değer kime ait?
    let ad = String::from("Ayşe Yılmaz");
    let numara = 1001;
    let ortalama = 3.45;

    // 2) Tuple: tek pakette ama parçaların adı yok
    let ogrenci = (String::from("Mehmet Kaya"), 1002, 2.90);

    println!("{ad} ({numara}) ortalama: {ortalama}");
    println!("{} ({}) ortalama: {}", ogrenci.0, ogrenci.1, ogrenci.2);
}
```

Bu iki yaklaşımın üç sorunu var:

- **Dağınıklık:** 100 öğrenci için 300 değişken mi? Bir öğrenciyi fonksiyona vermek için her parçayı
  ayrı parametre olarak geçmen gerekir.
- **Anlam kaybı:** `ogrenci.2` neydi? Ortalama mı, numara mı? Kodu okuyan herkes tanıma geri dönmek zorunda.
- **Karışma riski:** Aynı tipte iki değerin (örneğin ad ve soyad) yerini yanlışlıkla değiştirmek kolaydır
  ve derleyici bunu fark edemez.

Struct bu üç sorunu birden çözer: ilişkili verileri **tek bir tip** altında toplar ve her parçaya bir
**isim** verir.

```rust
struct Ogrenci {
    ad: String,
    numara: u32,
    ortalama: f64,
    aktif: bool,
}

fn main() {
    let ayse = Ogrenci {
        ad: String::from("Ayşe Yılmaz"),
        numara: 1001,
        ortalama: 3.45,
        aktif: true,
    };
    println!("{} ({}) ortalama: {}", ayse.ad, ayse.numara, ayse.ortalama);
    println!("Kayıt aktif mi? {}", ayse.aktif);
}
```

Parçaları tek tek inceleyelim:

- `struct Ogrenci { ... }` yeni bir **tip** tanımlar. Tip adları **UpperCamelCase** yazılır
  (`Ogrenci`, `BankaHesabi`), tıpkı `String` gibi.
- Süslü parantezin içindekiler **alanlardır (fields)**: `isim: Tip` biçiminde, `snake_case` adlarla,
  virgülle ayrılır. Son alandan sonraki virgül isteğe bağlıdır ama `rustfmt` onu koyar; sen de koy.
- `Ogrenci { ad: ..., numara: ..., ... }` ifadesi bu tipten bir **örnek (instance)** oluşturur. Alanları
  tanımdaki sırayla yazmak zorunda değilsin.
- Bir alana **nokta** ile erişirsin: `ayse.numara`.

Tanımın kendisi bellekte hiçbir şey oluşturmaz; yalnızca derleyiciye "böyle bir şekil var" der. Veri,
bir örnek oluşturduğun anda ortaya çıkar.

:::info Diğer dillerde
C'deki `struct` ile neredeyse aynı fikirdir. Python'da bir `class` ya da `@dataclass`, Java'da yalnızca
alanları olan bir sınıf yazardın. JavaScript'te `{ ad: "Ayşe", numara: 1001 }` gibi bir nesne yeterdi,
ama JS nesnesine çalışma anında yeni alan eklenebilir ve `ayse.numaar` gibi bir yazım hatası sessizce
`undefined` döndürür. Rust'ta bir struct'ın şekli derleme zamanında sabittir: yanlış yazılmış bir alan adı
**derleme hatasıdır**.
:::

```quiz
question: "`struct Ogrenci { ad: String, numara: u32 }` tanımı derlendiğinde ne olur?"
options:
  - Bellekte boş bir öğrenci kaydı oluşturulur
  - Yeni bir tip tanımlanır; bellekte henüz hiçbir öğrenci yoktur
  - "`Ogrenci` adında, içinde `ad` ve `numara` olan bir değişken oluşturulur"
answer: 1
explanation: |
  Struct tanımı bir **kalıptır (tip)**. Veri ancak `Ogrenci { ad: ..., numara: ... }` ifadesiyle bir
  **örnek (instance)** oluşturduğunda var olur. Aynı tipten istediğin kadar örnek yaratabilirsin.
feedback:
  - Tanım tek başına hiçbir veri oluşturmaz. Üstelik Rust'ta "boş" alan diye bir şey yoktur (birazdan göreceksin).
  - Doğru!
  - "`Ogrenci` bir değişken değil, bir **tip** adıdır, bu yüzden UpperCamelCase yazılır."
```

## Örnek oluştururken her alan dolu olmalı

Aşağıdaki kodda bir alan unutulmuş. Sence Rust ne yapar? Önce tahmin et.

```compiles
code: |
  struct Ogrenci {
      ad: String,
      numara: u32,
      ortalama: f64,
  }

  fn main() {
      let o = Ogrenci {
          ad: String::from("Ayşe"),
          numara: 1001,
      };
      println!("{} {}", o.ad, o.numara);
  }
answer: false
error: E0063
explanation: |
  Rust'ta bir örnek oluştururken **her alana bir değer vermek zorundasın**. `ortalama` eksik olduğu için
  derleyici `E0063` (missing field) hatası verir. "Sonra doldururum" diye bir seçenek yoktur.
```

:::error
```text
error[E0063]: missing field `ortalama` in initializer of `Ogrenci`
 --> src/main.rs:8:13
  |
8 |     let o = Ogrenci {
  |             ^^^^^^^ missing `ortalama`
```
Hata, tam olarak **hangi alanın** eksik olduğunu söylüyor. Çözüm: `ortalama: 0.0` gibi bir değer ekle.
:::

Bu kural küçük bir ayrıntı gibi görünür ama koca bir hata sınıfını yok eder. Java'da atanmamış bir nesne
alanı `null` olur ve günün birinde `NullPointerException` patlar; JavaScript'te `undefined` olur; C'de ise
o bellek hücresinde o an hangi çöp varsa o okunur. Rust'ta yarım kalmış bir örnek **derlenmez** bile.
Bir değer gerçekten "olmayabilir" ise bunu tipte açıkça söylersin: **Modül 7**'de göreceğin `Option` tam
olarak bunun için var.

:::analogy Kayıt formu
Struct tanımı, okulun **boş öğrenci kayıt formu** gibidir: "Ad: ____, Numara: ____, Ortalama: ____"
alanları basılıdır ama form henüz kimseye ait değildir. Her öğrenci için bu şablondan bir form
doldurursun; doldurulmuş her form bir **örnektir (instance)**. Rust'ın kayıt memuru çok titizdir: tek bir
alanı boş bıraktığın formu kabul etmez.
:::

Peki doldurulmuş bir form, yani `ayse` örneği bellekte nasıl durur? Bir struct örneği alanlarını **tek
bir blok** içinde, yan yana tutar. Sabit boyutlu alanlar (`u32`, `f64`, `bool`) doğrudan bu bloğun
içindedir; `String` alanı ise her zamanki gibi işaretçi + uzunluk + kapasite tutar, karakterler heap'tedir.

```memory
title: "`ayse` örneği bellekte"
steps:
  - caption: "`ayse` tek bir değişkendir; dört alanı aynı blokta yan yana durur. Sadece `ad` alanının karakterleri heap'tedir."
    stack:
      - frame: main
        vars:
          - { name: ayse.ad, type: String, value: "ptr · len=13 · cap=13", to: h1 }
          - { name: ayse.numara, type: u32, value: "1001" }
          - { name: ayse.ortalama, type: f64, value: "3.45" }
          - { name: ayse.aktif, type: bool, value: "true" }
    heap:
      - { id: h1, value: "Ayşe Yılmaz", label: "13 bayt (UTF-8)" }
```

`len=13` seni şaşırtmasın: Modül 5'ten hatırla, `ş` ve `ı` UTF-8'de ikişer bayttır. Bir de küçük not:
Rust, bellekte boşluk kalmasın diye alanların **sırasını kendi seçebilir**; bunu Modül 24'te göreceğiz.
Önemli olan, alanların ayrı ayrı değil, struct'ın içinde **birlikte** durmasıdır.

## Alanlara erişmek ve alanları değiştirmek

Alanları nokta ile okursun. Ama dikkat: `println!`'in `{değişken}` kısayolu yalnızca **düz değişken
adlarını** kabul eder; süslü parantezin içine `o.ad` gibi bir alan erişimi yazamazsın:

:::error
```text
error: invalid format string: field access isn't supported
 --> src/main.rs:7:24
  |
7 |     println!("Merhaba {o.ad}");
  |                        ^^^^ not supported in format string
  |
help: consider using a positional formatting argument instead
  |
7 -     println!("Merhaba {o.ad}");
7 +     println!("Merhaba {0}", o.ad);
```
Çözüm: alanı argüman olarak ver, `println!("Merhaba {}", o.ad);`, ya da önce bir değişkene al.
:::

Okumak kolay. Peki bir alanı **değiştirmek** istersek? Tahmin et:

```compiles
code: |
  struct Ogrenci {
      ad: String,
      ortalama: f64,
  }

  fn main() {
      let o = Ogrenci {
          ad: String::from("Ayşe"),
          ortalama: 3.10,
      };
      o.ortalama = 3.65;
      println!("{}: {}", o.ad, o.ortalama);
  }
answer: false
error: E0594
explanation: |
  `o` değişmez (`mut` olmadan) tanımlandı. Değişmez bir örneğin **hiçbir alanı** değiştirilemez:
  derleyici `E0594: cannot assign to o.ortalama, as o is not declared as mutable` der ve
  `let mut o` yazmanı önerir.
```

:::error
```text
error[E0594]: cannot assign to `o.ortalama`, as `o` is not declared as mutable
  --> src/main.rs:11:5
   |
11 |     o.ortalama = 3.65;
   |     ^^^^^^^^^^^^^^^^^ cannot assign
   |
help: consider changing this to be mutable
   |
 7 |     let mut o = Ogrenci {
   |         +++
```
:::

Rust'ta değişebilirlik bir **alanın** ya da **tipin** değil, **değişkenin (bağlamanın)** özelliğidir.
Ya örneğin tamamı `mut`'tur ya da hiçbir alanı değiştirilemez. "Sadece `ortalama` değişebilsin" diye bir
sözdizimi yoktur. Neden? `let o` gördüğün an "`o`'nun içindeki **hiçbir şey** değişmeyecek" diye emin
olabilmen için. C++'taki `mutable` üyeler ya da Java'daki alan alan `final` işaretleri bu basit garantiyi
bozar. Alan düzeyinde kontrolü Rust'ta başka araçlarla yaparız: metotlarla (bu modülün 4. dersi) ve
gizlilikle (Modül 8).

Bir fonksiyonun örneği değiştirmesi gerekiyorsa ona `&mut` ile ödünç verirsin (Modül 5):

```rust
struct Ogrenci {
    ad: String,
    ortalama: f64,
}

fn notu_guncelle(o: &mut Ogrenci, yeni_ortalama: f64) {
    o.ortalama = yeni_ortalama; // referans üzerinden alan değiştirmek
}

fn karne_yazdir(o: &Ogrenci) {
    println!("{}: {:.2}", o.ad, o.ortalama);
}

fn main() {
    let mut ayse = Ogrenci {
        ad: String::from("Ayşe"),
        ortalama: 3.10,
    };
    karne_yazdir(&ayse);
    notu_guncelle(&mut ayse, 3.65);
    karne_yazdir(&ayse);
}
```

`o` bir referans olduğu hâlde `(*o).ortalama` yazmadık: nokta operatörü, referansı alana ulaşmak için
**otomatik olarak takip eder**. Modül 5'te metot çağrılarında gördüğün otomatik dereference'ın aynısı.

## Alan başlatma kısaltması (field init shorthand)

Örnek oluşturmayı bir fonksiyona taşımak çok yaygındır. İlk denemede şöyle yazarsın:

```rust
# struct Ogrenci { ad: String, numara: u32, ortalama: f64, aktif: bool }
fn kayit_olustur(ad: String, numara: u32) -> Ogrenci {
    Ogrenci {
        ad: ad,
        numara: numara,
        ortalama: 0.0,
        aktif: true,
    }
}
# fn main() {
#     let o = kayit_olustur(String::from("Can"), 1003);
#     println!("{} {} {} {}", o.ad, o.numara, o.ortalama, o.aktif);
# }
```

`ad: ad` ve `numara: numara` tekrarı göze batıyor. Değişkenin (ya da parametrenin) adı alan adıyla
**birebir aynıysa**, adı bir kez yazman yeterli:

```rust
# struct Ogrenci { ad: String, numara: u32, ortalama: f64, aktif: bool }
fn kayit_olustur(ad: String, numara: u32) -> Ogrenci {
    Ogrenci {
        ad,     // ad: ad ile aynı
        numara, // numara: numara ile aynı
        ortalama: 0.0,
        aktif: true,
    }
}

fn main() {
    let can = kayit_olustur(String::from("Can Öztürk"), 1003);
    println!("{} ({}) ortalama: {}", can.ad, can.numara, can.ortalama);
    println!("aktif: {}", can.aktif);
}
```

Bu, JavaScript'teki `{ ad, numara }` kısaltmasının aynısıdır. Kısaltmayla açık yazımı aynı ifadede
karıştırabilirsin; adı uymayan alanlara (burada `ortalama`, `aktif`) değeri her zamanki gibi yazarsın.

```fill
prompt: Kısaltmayı kullanarak `Urun` örneğini oluşturan fonksiyonu tamamla. Yeni ürünün stoğu 0 olsun.
code: |
  struct Urun {
      ad: String,
      fiyat: f64,
      stok: u32,
  }

  fn urun_olustur(ad: String, fiyat: f64) -> Urun {
      Urun {
          ___0,
          ___1,
          stok: ___2,
      }
  }

  fn main() {
      let simit = urun_olustur(String::from("Simit"), 15.0);
      println!("{}: {} TL, stok {}", simit.ad, simit.fiyat, simit.stok);
  }
blanks:
  - ["ad"]
  - ["fiyat"]
  - ["0", "0u32"]
output: "Simit: 15 TL, stok 0"
explanation: |
  `ad` ve `fiyat` parametreleri alan adlarıyla aynı olduğu için kısaltma kullanılabilir. `stok` için bir
  parametre yok; bu yüzden değerini açıkça yazıyoruz: `stok: 0`. (Çıktıdaki `15`'e dikkat: `{}` ile
  yazdırılan `15.0`, ondalık kısmı sıfır olduğu için `15` olarak görünür.)
```

Şimdi sıra sende. Bu alıştırmada hem kısaltmayı hem de `&mut` ile alan değiştirmeyi kullanacaksın.

```exercise
id: m06-e-karakter
title: Oyun karakteri oluştur
difficulty: 2
prompt: |
  Bir RPG oyunu için karakter sistemi yazıyorsun. `Karakter` struct'ı hazır; iki fonksiyonu tamamla:

  1. `karakter_olustur(isim: String) -> Karakter` - verilen isimle, **100 can** ve **1. seviye** ile
     başlayan bir karakter döndürsün. `isim` alanı için **alan başlatma kısaltmasını** kullan.
  2. `hasar_al(k: &mut Karakter, miktar: u32)` - karakterin canını `miktar` kadar azaltsın. Can
     **hiçbir zaman 0'ın altına inmemeli** (dev bir ejderha tek vuruşta 250 hasar verebilir!).
starter: |
  struct Karakter {
      isim: String,
      can: u32,
      seviye: u32,
  }

  fn karakter_olustur(isim: String) -> Karakter {
      todo!()
  }

  fn hasar_al(k: &mut Karakter, miktar: u32) {
      todo!()
  }

  fn main() {
      let mut kahraman = karakter_olustur(String::from("Keloğlan"));
      hasar_al(&mut kahraman, 30);
      println!("{}: {} can, seviye {}", kahraman.isim, kahraman.can, kahraman.seviye);
  }
solution: |
  struct Karakter {
      isim: String,
      can: u32,
      seviye: u32,
  }

  fn karakter_olustur(isim: String) -> Karakter {
      Karakter {
          isim,
          can: 100,
          seviye: 1,
      }
  }

  fn hasar_al(k: &mut Karakter, miktar: u32) {
      k.can = k.can.saturating_sub(miktar);
  }

  fn main() {
      let mut kahraman = karakter_olustur(String::from("Keloğlan"));
      hasar_al(&mut kahraman, 30);
      println!("{}: {} can, seviye {}", kahraman.isim, kahraman.can, kahraman.seviye);
  }
check: tests
tests: |
  #[test]
  fn yeni_karakter_dogru_baslar() {
      let k = karakter_olustur(String::from("Nasreddin"));
      assert_eq!(k.isim, "Nasreddin", "isim parametreden gelmeli");
      assert_eq!(k.can, 100, "yeni karakter 100 canla başlamalı");
      assert_eq!(k.seviye, 1, "yeni karakter 1. seviyeden başlamalı");
  }

  #[test]
  fn hasar_cani_azaltir() {
      let mut k = karakter_olustur(String::from("Keloğlan"));
      hasar_al(&mut k, 30);
      assert_eq!(k.can, 70, "100 - 30 = 70 olmalı");
      hasar_al(&mut k, 25);
      assert_eq!(k.can, 45, "70 - 25 = 45 olmalı");
  }

  #[test]
  fn can_sifirin_altina_inmez() {
      let mut k = karakter_olustur(String::from("Hacivat"));
      hasar_al(&mut k, 250);
      assert_eq!(k.can, 0, "can 0'ın altına inmemeli - u32 taşmasına dikkat!");
      hasar_al(&mut k, 10);
      assert_eq!(k.can, 0, "zaten 0 olan can 0'da kalmalı");
  }
hints:
  - "`karakter_olustur` içinde bir `Karakter { ... }` ifadesi döndür. Parametrenin adı alan adıyla aynı olduğu için `isim: isim` yerine sadece `isim` yazabilirsin."
  - "`k` bir `&mut Karakter`; alanı doğrudan değiştirebilirsin: `k.can = ...`. Ama `k.can - miktar` negatif bir sonuç verecekse `u32` taşar ve debug modda program panikler (Modül 2)."
  - "Modül 2'deki doygun çıkarma tam aradığın şey: `k.can = k.can.saturating_sub(miktar);`, ya da önce `if miktar >= k.can` ile kontrol et."
require:
  - pattern: "\\{\\s*isim\\s*,|,\\s*isim\\s*[,}]"
    message: "`isim` alanını alan başlatma kısaltmasıyla yaz: `Karakter { isim, ... }`"
explanation: |
  `karakter_olustur`'da `isim` parametresinin adı alan adıyla aynı olduğu için kısaltmayı kullandık;
  `can` ve `seviye` için parametre olmadığından değerlerini açıkça yazdık.

  `hasar_al` bir `&mut Karakter` alıyor: karakteri **ödünç alıp yerinde** değiştiriyoruz, sahipliğini
  almıyoruz. Bu yüzden `main` çağrıdan sonra `kahraman`'ı kullanmaya devam edebiliyor.

  `saturating_sub`, sonuç tipin alt sınırının altına düşecekse sınırda (burada 0'da) durur.
  `k.can -= miktar;` yazsaydın 250 hasarlı testte debug modda `attempt to subtract with overflow`
  paniği alırdın. Eşdeğer bir alternatif:
  `if miktar >= k.can { k.can = 0; } else { k.can -= miktar; }`.
```

## Struct güncelleme sözdizimi: `..diger`

Çoğu alanı mevcut bir örnekle aynı olan yeni bir örnek mi oluşturacaksın? Her alanı tek tek
kopyalamak yerine `..` kullanabilirsin:

```rust
struct Ogrenci {
    ad: String,
    numara: u32,
    aktif: bool,
}

fn main() {
    let o1 = Ogrenci {
        ad: String::from("Deniz"),
        numara: 1001,
        aktif: true,
    };

    // Yalnızca numara farklı; geri kalan her şey o1'den gelsin
    let o2 = Ogrenci { numara: 1002, ..o1 };

    println!("{} {} {}", o2.ad, o2.numara, o2.aktif);
}
```

`..o1`, "**açıkça yazmadığım** alanları `o1`'den al" demektir. İki kural var:

- `..taban` her zaman **en sonda** durur ve ardından virgül gelemez
  (`error: cannot use a comma after the base struct`).
- Açıkça yazdığın alanlar her zaman kazanır; `..` yalnızca boşlukları doldurur.

Asıl ilginç soru şu: `o2` oluştuktan sonra `o1`'e ne oldu? Tahmin et, bu kod derlenir mi?

```compiles
code: |
  struct Ogrenci {
      ad: String,
      numara: u32,
      aktif: bool,
  }

  fn main() {
      let o1 = Ogrenci {
          ad: String::from("Deniz"),
          numara: 1001,
          aktif: true,
      };
      let o2 = Ogrenci { numara: 1002, ..o1 };
      println!("{} {}", o1.numara, o1.aktif);
      println!("{} {} {}", o2.ad, o2.numara, o2.aktif);
  }
answer: true
explanation: |
  Derlenir! `..o1` alanları **tek tek** taşır ya da kopyalar. `aktif` bir `bool` olduğu için
  **kopyalandı**; `numara`'yı ise zaten açıkça verdik, `o1`'den hiç alınmadı. Bu iki alan `o1`'de
  hâlâ geçerli. Taşınan tek alan `ad` (bir `String`) - ve biz `o1.ad`'yi kullanmadık.
```

`..o1` yazmak, kabaca `ad: o1.ad, aktif: o1.aktif` yazmakla aynıdır. Her alan kendi tipinin kuralına
uyar: `Copy` olanlar (`bool`, `u32`...) kopyalanır, `String` gibi olanlar **taşınır**. Sonuçta `o1`
**kısmen taşınmış (partially moved)** olur:

```memory
title: "`let o2 = Ogrenci { numara: 1002, ..o1 };` adım adım"
steps:
  - caption: "Başlangıç: `o1`'in üç alanı var; `ad`'ın karakterleri heap'te."
    stack:
      - frame: main
        vars:
          - { name: o1.ad, type: String, value: "ptr · len=5 · cap=5", to: h1 }
          - { name: o1.numara, type: u32, value: "1001" }
          - { name: o1.aktif, type: bool, value: "true" }
    heap:
      - { id: h1, value: "D e n i z" }
  - caption: "`o2` oluştu: `numara` açıkça verildi, `aktif` **kopyalandı**, `ad` **taşındı**. Heap verisi kopyalanmadı; sahibi değişti."
    stack:
      - frame: main
        vars:
          - { name: o1.ad, type: String, value: "ptr · len=5 · cap=5", moved: true, note: "taşındı" }
          - { name: o1.numara, type: u32, value: "1001" }
          - { name: o1.aktif, type: bool, value: "true" }
          - { name: o2.ad, type: String, value: "ptr · len=5 · cap=5", to: h1 }
          - { name: o2.numara, type: u32, value: "1002" }
          - { name: o2.aktif, type: bool, value: "true" }
    heap:
      - { id: h1, value: "D e n i z" }
```

Taşınan alanı ya da `o1`'in **bütününü** kullanmaya kalkarsan derleyici durdurur:

:::error
```text
error[E0382]: borrow of moved value: `o1.ad`
  --> src/main.rs:15:20
   |
13 |     let o2 = Ogrenci { numara: 1002, ..o1 };
   |              ------------------------------ value moved here
14 |     println!("{}", o1.numara);
15 |     println!("{}", o1.ad);
   |                    ^^^^^ value borrowed here after move
```
`o1`'in tamamını (örneğin `&o1` ile bir fonksiyona) vermeye çalışırsan da benzer bir hata alırsın:
`borrow of partially moved value: o1`. Bir parçası eksik bir struct'ı bütün olarak kullanamazsın.
:::

Eğer `ad` için de yeni bir değer verseydin (`Ogrenci { ad: String::from("Ece"), ..o1 }`), `o1`'den
yalnızca `Copy` alanlar kopyalanır, hiçbir şey taşınmazdı ve `o1` tamamen kullanılabilir kalırdı.

:::info JavaScript'teki yayma (spread) ile farkı
JS'de `{ ...o1, numara: 1002 }` yazarsın: yayma **başta** durur, sonraki anahtarlar onu ezer ve iç
nesneler iki nesne arasında **paylaşılır** (sığ kopya). Rust'ta taban **en sonda** durur, açık alanlar
her zaman kazanır ve `String` gibi alanlar paylaşılmaz, **taşınır**, çünkü bir verinin tek sahibi olur.
:::

:::deep Referanstan güncelleme: `..*sablon`
Tabanın sahibi değil de sadece ödünç alanıysan ne olur? `..*sablon` yazabilirsin, ama yalnızca
**geriye kalan alanların hepsi `Copy` ise**:

```rust
struct Karakter {
    isim: String,
    can: u32,
    seviye: u32,
}

// Şablon sadece ödünç alınıyor; kalan alanlar (can, seviye) Copy olduğu için kopyalanır.
fn kopyala(sablon: &Karakter, isim: String) -> Karakter {
    Karakter { isim, ..*sablon }
}

fn main() {
    let a = Karakter { isim: String::from("Kara Murat"), can: 80, seviye: 3 };
    let b = kopyala(&a, String::from("Battal Gazi"));
    println!("{} {} {} | {} {}", b.isim, b.can, b.seviye, a.isim, a.seviye);
}
```

`isim`'i açıkça vermeseydik, `..*sablon` bir `String`'i referansın arkasından taşımaya çalışırdı ve
derleyici `E0507: cannot move out of sablon.isim which is behind a shared reference` derdi. Ödünç
aldığın bir şeyin parçasını alıp götüremezsin!
:::

## Alanların sahipliği: neden `String`, neden `&str` değil?

`Ogrenci`'nin `ad` alanı neden `String`? Literal'ler zaten `&str`; onu kullansak daha kolay olmaz mıydı?
Deneyelim:

```rust,compile_fail,E0106
struct Kullanici {
    ad: &str,
    yas: u32,
}
#
# fn main() {}
```

:::error
```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:2:9
  |
2 |     ad: &str,
  |         ^ expected named lifetime parameter
  |
help: consider introducing a named lifetime parameter
  |
1 ~ struct Kullanici<'a> {
2 ~     ad: &'a str,
```
Bu hata kodunu Modül 5'ten tanıyorsun: referans döndüren fonksiyonlarda da karşına çıkmıştı.
:::

Bir struct bir **referans** tutarsa, struct'ın, işaret ettiği veriden **daha uzun yaşamaması** gerekir;
yoksa Modül 5'teki sarkan referans (dangling reference) sorunu struct'ın içinden geri gelir. Derleyici bunu
kanıtlayabilmek için ek bilgi ister: `'a` gibi **yaşam süresi (lifetime)** etiketleri. Bunları
**Modül 12**'de ayrıntılı öğreneceğiz.

O zamana kadar kuralımız basit: **struct'lar verilerinin sahibi olsun.** `String` alanlı bir struct kendi
kendine yeter; kimseye bağımlı değildir, istediğin yere taşıyabilir, fonksiyondan döndürebilirsin. Sahibi
kapsamdan çıktığında struct ile birlikte **bütün alanları** da otomatik olarak drop edilir, `ad`'ın heap
belleği dahil. Bir sahiplik ağacı gibi düşün: `ayse` → `ayse.ad` → heap'teki karakterler.

Sahiplik demişken, Modül 4'ten bir soru. Bu struct'ın bütün alanları `i32`, yani `Copy`. Peki ya
struct'ın kendisi?

```compiles
code: |
  struct Nokta {
      x: i32,
      y: i32,
  }

  fn main() {
      let a = Nokta { x: 1, y: 2 };
      let b = a;
      println!("{} {}", a.x, b.y);
  }
answer: false
error: E0382
explanation: |
  Struct'lar **otomatik olarak `Copy` olmaz** - bütün alanları `Copy` olsa bile. `let b = a;` değeri
  **taşır** ve `a` artık kullanılamaz (`E0382`). Derleyicinin notu da bunu söylüyor:
  `move occurs because a has type Nokta, which does not implement the Copy trait`.
```

Neden otomatik değil? Çünkü `Copy` bir **sözdür** ve o sözü tipin sahibi vermelidir. Rust bunu kendiliğinden
yapsaydı, ileride `Nokta`'ya bir `String` alanı eklediğin gün, `Nokta` kullanan bütün kodun anlamı sessizce
"kopyalama"dan "taşıma"ya dönerdi. Bir tipi bilerek `Copy` yapmayı **Modül 11**'de `#[derive(Clone, Copy)]`
ile öğreneceğiz. O zamana kadar: struct'ları ödünç ver (`&Nokta`) ya da bilerek taşı.

```exercise
id: m06-e-yeni-donem
title: Yeni döneme geçiş
difficulty: 3
prompt: |
  Okul otomasyonunda dönem sonu geldi. `yeni_donem` fonksiyonu bir öğrenciyi **sahiplenerek** alır ve
  yeni dönemdeki hâlini döndürür:

  - Öğrenci 1, 2 veya 3. sınıftaysa `sinif` bir artar, `ortalama` `0.0`'a sıfırlanır.
  - Öğrenci 4. sınıftaysa mezun olur: `aktif` `false` olur; sınıfı ve ortalaması **olduğu gibi kalır**.

  Diğer alanlar (`ad`, `numara`) korunmalı. İki durumda da **struct güncelleme sözdizimini**
  (`..o`) kullan.
starter: |
  struct Ogrenci {
      ad: String,
      numara: u32,
      sinif: u8,
      ortalama: f64,
      aktif: bool,
  }

  fn yeni_donem(o: Ogrenci) -> Ogrenci {
      todo!()
  }

  fn main() {
      let zeynep = Ogrenci {
          ad: String::from("Zeynep Demir"),
          numara: 1203,
          sinif: 2,
          ortalama: 3.20,
          aktif: true,
      };
      let zeynep = yeni_donem(zeynep);
      println!(
          "{} ({}): {}. sınıf, ortalama {}, aktif: {}",
          zeynep.ad, zeynep.numara, zeynep.sinif, zeynep.ortalama, zeynep.aktif
      );
  }
solution: |
  struct Ogrenci {
      ad: String,
      numara: u32,
      sinif: u8,
      ortalama: f64,
      aktif: bool,
  }

  fn yeni_donem(o: Ogrenci) -> Ogrenci {
      if o.sinif >= 4 {
          Ogrenci { aktif: false, ..o }
      } else {
          Ogrenci {
              sinif: o.sinif + 1,
              ortalama: 0.0,
              ..o
          }
      }
  }

  fn main() {
      let zeynep = Ogrenci {
          ad: String::from("Zeynep Demir"),
          numara: 1203,
          sinif: 2,
          ortalama: 3.20,
          aktif: true,
      };
      let zeynep = yeni_donem(zeynep);
      println!(
          "{} ({}): {}. sınıf, ortalama {}, aktif: {}",
          zeynep.ad, zeynep.numara, zeynep.sinif, zeynep.ortalama, zeynep.aktif
      );
  }
check: tests
tests: |
  #[test]
  fn sinif_artar_ortalama_sifirlanir() {
      let o = Ogrenci { ad: String::from("Zeynep"), numara: 1203, sinif: 2, ortalama: 3.2, aktif: true };
      let y = yeni_donem(o);
      assert_eq!(y.sinif, 3, "2. sınıftaki öğrenci 3. sınıfa geçmeli");
      assert_eq!(y.ortalama, 0.0, "yeni dönemde ortalama 0.0'a sıfırlanmalı");
      assert!(y.aktif, "öğrenci hâlâ aktif olmalı");
  }

  #[test]
  fn diger_alanlar_korunur() {
      let o = Ogrenci { ad: String::from("Mert Kaya"), numara: 77, sinif: 1, ortalama: 2.5, aktif: true };
      let y = yeni_donem(o);
      assert_eq!(y.ad, "Mert Kaya", "ad değişmemeli");
      assert_eq!(y.numara, 77, "numara değişmemeli");
      assert_eq!(y.sinif, 2, "1. sınıftaki öğrenci 2. sınıfa geçmeli");
  }

  #[test]
  fn dorduncu_sinif_mezun_olur() {
      let o = Ogrenci { ad: String::from("Burak"), numara: 901, sinif: 4, ortalama: 2.75, aktif: true };
      let y = yeni_donem(o);
      assert!(!y.aktif, "4. sınıftaki öğrenci mezun olmalı (aktif = false)");
      assert_eq!(y.sinif, 4, "mezun olan öğrencinin sınıfı 4 kalmalı");
      assert_eq!(y.ortalama, 2.75, "mezuniyet ortalaması korunmalı");
      assert_eq!(y.ad, "Burak", "ad değişmemeli");
  }
hints:
  - "Önce iki durumu ayır: `if o.sinif >= 4 { ... } else { ... }`. `if` bir ifade olduğu için iki dal da birer `Ogrenci` döndürebilir (Modül 3)."
  - "Mezuniyet dalında yalnızca `aktif` değişiyor: `Ogrenci { aktif: false, ..o }`."
  - "Diğer dalda iki alan değişiyor: `Ogrenci { sinif: o.sinif + 1, ortalama: 0.0, ..o }`. `o.sinif` `Copy` bir alan; önce onu okuyup sonra kalanları `..o` ile taşıyabilirsin."
require:
  - pattern: "\\.\\.\\s*o\\b"
    message: Bu alıştırmada struct güncelleme sözdizimini (`..o`) kullan.
explanation: |
  `yeni_donem` öğrenciyi **değer olarak** (`o: Ogrenci`) aldığı için `o`'nun sahibidir; bu yüzden
  `..o` ile `ad` gibi `String` alanları yeni örneğe **taşıyabiliyor**. Fonksiyon `&Ogrenci` alsaydı
  `..*o` derlenmezdi (`E0507`), çünkü ödünç alınan bir değerin `String` alanı taşınamaz.

  `Ogrenci { sinif: o.sinif + 1, ortalama: 0.0, ..o }` ifadesinde önce açık alanlar hesaplanır:
  `o.sinif` bir `u8` olduğu için sadece kopyalanır. Ardından `..o` kalan alanları doldurur.

  `if`/`else` bir ifade olduğu için iki dalın sonucu doğrudan fonksiyonun dönüş değeri oluyor;
  `return` yazmaya gerek yok. `main`'de `let zeynep = yeni_donem(zeynep);` satırı da Modül 2'deki
  gölgelemeyi (shadowing) kullanıyor: eski `zeynep` taşındı, aynı isimle yenisini bağladık.
```

## Özet

:::remember
- `struct Ad { alan: Tip, ... }` yeni bir **tip** tanımlar; `Ad { alan: deger, ... }` bir **örnek** oluşturur.
- Örnek oluştururken **her alan** doldurulmalı (`E0063`). Rust'ta `null` alan yoktur.
- Değişebilirlik örneğin tamamına aittir: alan değiştirmek için `let mut` (`E0594`).
- `Ogrenci { ad, numara, .. }`: değişken adı alan adıyla aynıysa **alan başlatma kısaltması**.
- `..taban` en sonda durur; kalan alanları kopyalar (`Copy`) ya da **taşır** → taban kısmen taşınabilir.
- Struct'lar otomatik olarak `Copy` olmaz. Alanlarda şimdilik `&str` değil `String` kullan (yaşam süreleri: Modül 12).
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla - `let o2 = Ogrenci { numara: 1002, ..o1 };` satırından sonra `o1.numara`
  ve `o1.aktif` kullanılabilirken neden `o1.ad` ya da `o1`'in bütünü kullanılamıyor?
answer: |
  `..o1`, açıkça yazılmayan alanları `o1`'den **tek tek** alır. `aktif` bir `bool`, yani `Copy`; bu yüzden
  kopyalanır ve `o1`'de de kalır. `numara`'yı zaten açıkça verdik, `o1`'den hiç alınmadı. `ad` ise bir
  `String`: heap verisinin tek bir sahibi olabileceği için `o2`'ye **taşınır**. Böylece `o1` kısmen
  taşınmış olur: taşınan alan kullanılamaz, bir parçası eksik olduğu için `o1`'in bütünü de kullanılamaz.
  Ama hâlâ geçerli olan `Copy` alanlarını okuyabilirsin.
```

```flashcards
- front: "`struct Ogrenci { ... }` tanımı bellekte veri oluşturur mu?"
  back: Hayır. Sadece yeni bir **tip** (kalıp) tanımlar; veri, `Ogrenci { ... }` ile bir örnek oluşturunca var olur.
- front: Bir struct örneği oluştururken bir alanı yazmazsan ne olur?
  back: "Derleme hatası: **E0063** (missing field). Rust'ta her alan doldurulmak zorundadır."
- front: Bir struct'ın yalnızca tek bir alanını değişebilir (`mut`) yapabilir misin?
  back: "Hayır. Değişebilirlik bağlamaya aittir: `let mut o` ile örneğin **tamamı** değişebilir olur. Yoksa **E0594**."
- front: Alan başlatma kısaltması (field init shorthand) ne zaman kullanılabilir?
  back: "Değişkenin adı alan adıyla birebir aynıysa: `Ogrenci { ad, numara, aktif: true }`."
- front: "`let o2 = Ogrenci { numara: 2, ..o1 };` sonrasında `String` olan `o1.ad` kullanılabilir mi?"
  back: "Hayır, `o2`'ye taşındı (**E0382**). `Copy` alanlar (`o1.aktif` gibi) hâlâ kullanılabilir; `o1`'in bütünü kullanılamaz (kısmen taşındı)."
- front: "Struct güncelleme sözdiziminde `..taban` nereye yazılır?"
  back: "Her zaman **en sona** ve ardından virgül olmadan: `Ogrenci { numara: 2, ..o1 }`."
- front: Alanları `i32` olan bir struct otomatik olarak `Copy` olur mu?
  back: "Hayır. Struct'lar hiçbir zaman kendiliğinden `Copy` olmaz; atama **taşır**. (`#[derive(Clone, Copy)]` → Modül 11)"
- front: Neden şimdilik struct alanlarında `&str` yerine `String` kullanıyoruz?
  back: "Referans tutan alan bir yaşam süresi parametresi ister (**E0106**, Modül 12). `String` ile struct verisinin sahibi olur ve kendi kendine yeter."
```
