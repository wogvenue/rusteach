---
id: m12-l04
title: Elision kuralları
minutes: 17
type: lesson
objectives:
  - Üç elision kuralını sırayla uygulayarak bir imzanın anotasyonsuz derlenip derlenmeyeceğini tahmin edebilmek
  - Derleyicinin elision ile eklediği yaşam sürelerini açık hâliyle yazabilmek
  - Metotlarda `&self` kuralının (kural 3) sonucunu ve yanlış referansı bağladığı durumu açıklayabilmek
  - "`'_` (anonim yaşam süresi) ile gizli yaşam sürelerini görünür kılıp `mismatched_lifetime_syntaxes` uyarısını giderebilmek"
keywords: [elision, yaşam süresi, "'_", "&self", E0106, mismatched_lifetime_syntaxes, input lifetime, output lifetime]
---

Modül 5'te `ilk_kelime(s: &str) -> &str` yazdın ve hiçbir `'a` gerekmedi. Önceki derste ise `en_uzun`
için derleyici ısrarla anotasyon istedi. Aradaki fark nedir? Derleyici bazen tahmin yürütüyor, bazen
yürütmüyor mu?

Hayır, derleyici **tahmin yürütmez**. Üç basit ve mekanik kural uygular. Bu kurallara **yaşam süresi
elision kuralları (lifetime elision rules)** denir. Elision "atlama, yazmadan geçme" demektir. Kuralları
bildiğinde hangi imzanın `'a` isteyeceğini derleyiciden önce sen söyleyebileceksin.

## Bir bilmece: `ilk_kelime` neden `'a` istemedi?

Modül 5'teki fonksiyonu hatırla ve tahmin et:

```compiles
code: |
  fn ilk_kelime(s: &str) -> &str {
      match s.find(' ') {
          Some(i) => &s[..i],
          None => s,
      }
  }

  fn main() {
      let mut cumle = String::from("merhaba dünya");
      let kelime = ilk_kelime(&cumle);
      cumle.clear();
      println!("{kelime}");
  }
answer: false
error: E0502
explanation: |
  İmzada hiç `'a` yok, ama derleyici dönen `&str`'nin `s`'ye bağlı olduğunu **biliyor**. Bu yüzden
  `kelime` yaşadığı sürece `cumle` ödünçte sayılıyor ve `clear()` (bir `&mut` ödünç) reddediliyor.
  Modül 5'te bu örneği "dilimler seni korur" diye görmüştün. Şimdi korumanın **nereden** geldiğini
  görüyoruz: Görünmez bir yaşam süresi anotasyonundan.
```

Derleyici imzayı aslında şöyle okudu:

```text
fn ilk_kelime(s: &str) -> &str                  // senin yazdığın
fn ilk_kelime<'a>(s: &'a str) -> &'a str        // derleyicinin gördüğü
```

Biraz tarih: Rust 1.0'dan (2015) önce bu anotasyonların **hepsini** yazmak zorunluydu. Rust ekibi binlerce
satır kodu incelediğinde aynı birkaç kalıbın sürekli tekrar ettiğini gördü. Bu kalıplar derleyiciye kural
olarak öğretildi. Böylece imzaların büyük çoğunluğu `'a`'sız yazılabilir hâle geldi.

Kurallardan önce iki terim:

- **Girdi yaşam süreleri (input lifetimes):** Parametrelerdeki referansların yaşam süreleri.
- **Çıktı yaşam süreleri (output lifetimes):** Dönüş tipindeki referansların yaşam süreleri.

Kurallar sadece fonksiyon ve metot **imzalarında** geçerlidir. Önceki derste gördüğün gibi struct
tanımlarında elision yoktur.

## Kural 1 ve 2: Girdilere ad ver, tek girdiyi çıktıya bağla

### Kural 1: Her girdi referansı kendi yaşam süresini alır

Derleyici önce parametrelere bakar ve isimsiz her yaşam süresine **ayrı, yeni** bir isim verir:

| Yazdığın | Kural 1'den sonra |
|---|---|
| `fn f(x: &str)` | `fn f<'a>(x: &'a str)` |
| `fn f(x: &str, y: &str)` | `fn f<'a, 'b>(x: &'a str, y: &'b str)` |
| `fn f(x: &mut Vec<i32>, y: &i32)` | `fn f<'a, 'b>(x: &'a mut Vec<i32>, y: &'b i32)` |
| `fn f(x: &[&str])` | `fn f<'a, 'b>(x: &'a [&'b str])`: **iç içe** iki referans, iki yaşam süresi |
| `fn f(a: Alinti)` (`Alinti<'x>` bir struct) | `fn f<'a>(a: Alinti<'a>)`: struct'ın gizli parametresi de sayılır |

Dikkat et: Kural 1 **referans başına** çalışır, parametre başına değil. `&[&str]` tek parametredir ama
içinde iki referans, dolayısıyla iki ayrı yaşam süresi vardır. Bir sonraki kuralda bu ayrıntı önem
kazanacak.

### Kural 2: Tek girdi yaşam süresi varsa, bütün çıktılara o verilir

Kural 1'den sonra imzada **tam olarak bir** girdi yaşam süresi varsa, dönüş tipindeki bütün isimsiz yaşam
süreleri ona eşitlenir. Mantığı basit: Sonuç bir şeyden ödünç alınmış olmalı ve ödünç alınabilecek tek bir
şey var.

```text
fn ilk_kelime(s: &str) -> &str
  kural 1 → fn ilk_kelime<'a>(s: &'a str) -> &str
  kural 2 → fn ilk_kelime<'a>(s: &'a str) -> &'a str      ✓ tamam

fn tekrar_kirp(s: &str, n: usize) -> &str
  kural 1 → fn tekrar_kirp<'a>(s: &'a str, n: usize) -> &str     (usize referans değil)
  kural 2 → fn tekrar_kirp<'a>(s: &'a str, n: usize) -> &'a str  ✓ tamam

fn en_uzun(x: &str, y: &str) -> &str
  kural 1 → fn en_uzun<'a, 'b>(x: &'a str, y: &'b str) -> &str
  kural 2 → uygulanamaz: iki girdi yaşam süresi var                ✗ E0106
```

İlk dersteki `harfle_baslayanlar(liste: &[String], harf: char) -> Vec<&str>` alıştırması da kural 2
sayesinde derlenmişti: `char` bir referans değil, tek girdi yaşam süresi `liste`'ninki.

Kural 2'nin iş başında olduğu bir örnek. İki fonksiyonun da imzasında hiç `'a` yok, ama dönen dilimlerin
`baslik`'a bağlı olduğunu derleyici biliyor:

```rust
fn ilk_kelime(s: &str) -> &str {
    match s.find(' ') {
        Some(i) => &s[..i],
        None => s,
    }
}

fn ilk_n_bayt(s: &str, n: usize) -> &str {
    if n >= s.len() { s } else { &s[..n] }
}

fn main() {
    let baslik = String::from("Kampanya: kahve 2 al 1 öde");
    let kelime = ilk_kelime(&baslik); // kural 2: sonuç baslik'a bağlı
    let kisa = ilk_n_bayt(&baslik, 8); // kural 2: n referans değil, sayılmaz
    println!("[{kelime}] [{kisa}]");
}
```

Şimdi Kural 1'deki "iç içe referans" ayrıntısını sına. Bir hava durumu uygulaması, eşik değerinin
üstündeki şehirleri döndürüyor. Tahmin et:

```compiles
code: |
  fn esik_ustu(olcumler: &[(&str, i32)], esik: i32) -> Vec<&str> {
      let mut sonuc = Vec::new();
      for &(sehir, sicaklik) in olcumler {
          if sicaklik > esik {
              sonuc.push(sehir);
          }
      }
      sonuc
  }

  fn main() {
      let olcumler = [("Adana", 38), ("Rize", 24), ("İzmir", 35)];
      println!("{:?}", esik_ustu(&olcumler, 30));
  }
answer: false
error: E0106
explanation: |
  Tek bir referans parametresi var gibi görünüyor, ama `&[(&str, i32)]` içinde **iki** referans var:
  dilimin kendisi (`&[...]`) ve içindeki `&str`'ler. Kural 1 ikisine ayrı yaşam süreleri verir. İki girdi
  yaşam süresi olunca Kural 2 uygulanamaz. Derleyici, dönen `&str`'lerin hangisine bağlı olduğunu
  bilemez.
```

:::error
```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:58
  |
1 | fn esik_ustu(olcumler: &[(&str, i32)], esik: i32) -> Vec<&str> {
  |                        --------------                    ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but the signature does not say which one of `olcumler`'s 2 lifetimes it is borrowed from
```
Mesaj tam olarak Kural 1'i anlatıyor: "`olcumler`'in **2 yaşam süresinden** hangisinden ödünç alındığını
imza söylemiyor." Bu imzayı nasıl en iyi şekilde düzelteceğimizi son derste göreceğiz. (İpucu: Şehir
adları dilimden **daha uzun** yaşayabilir.)
:::

## Kural 3: `&self` varsa, çıktılara `self`'in yaşam süresi verilir

Üçüncü kural metotlar içindir. Parametrelerden biri `&self` ya da `&mut self` ise, dönüş tipindeki bütün
isimsiz yaşam süreleri **`self`'inkine** eşitlenir. Bu kural, öbür parametre sayısına bakmaz.

```text
fn ad(&self) -> &str
  → fn ad<'s>(&'s self) -> &'s str

fn bul(&self, anahtar: &str) -> Option<&String>
  → fn bul<'s, 'k>(&'s self, anahtar: &'k str) -> Option<&'s String>
```

Neden böyle bir kural var? Çünkü metotların çok büyük kısmı, nesnenin **kendi içinden** bir şey döndürür:
getter'lar, arama sonuçları, alt parçalar. `HashMap::get(&self, k) -> Option<&V>` buna mükemmel bir örnek.
Kural 3 bu yaygın durumu zahmetsiz kılar.

Ama varsayılan her zaman istediğin şey olmayabilir. Bir duyuru panosunda, nesnenin değil **parametrenin**
bir parçasını döndüren bir metot yazalım:

```compiles
code: |
  struct Pano<'a> {
      baslik: &'a str,
  }

  impl<'a> Pano<'a> {
      fn duyur(&self, ilan: &str) -> &str {
          println!("{}: {ilan}", self.baslik);
          ilan
      }
  }

  fn main() {
      let pano = Pano { baslik: "Okul" };
      println!("{}", pano.duyur("Yarın tatil"));
  }
answer: false
explanation: |
  Kural 3 dönen `&str`'yi `&self`'e bağladı. Gövde ise `ilan`'ı döndürüyor ve `ilan`'ın yaşam süresinin
  `self`'inkiyle hiçbir ilişkisi yok. Elision bir **tahmin** olmadığı için gövdeye bakıp fikrini
  değiştirmez. Kuralı uygular, sonra gövdenin imzaya uymadığını görür.
```

:::error
```text
error: lifetime may not live long enough
 --> src/main.rs:8:9
  |
6 |     fn duyur(&self, ilan: &str) -> &str {
  |              -            - let's call the lifetime of this reference `'1`
  |              |
  |              let's call the lifetime of this reference `'2`
7 |         println!("{}: {ilan}", self.baslik);
8 |         ilan
  |         ^^^^ method was supposed to return data with lifetime `'2` but it is returning data with lifetime `'1`
  |
help: consider introducing a named lifetime parameter and update trait if needed
  |
6 |     fn duyur<'b>(&self, ilan: &'b str) -> &'b str {
  |             ++++               ++          ++
```
Bu mesajda yeni bir şey var: Derleyici isimsiz yaşam sürelerine **geçici adlar** veriyor: `'1` (`ilan`'ın)
ve `'2` (`self`'in). Kod satırında bu adları göremezsin, sadece hata mesajını okuman için uydurulmuşlardır.
Cümleyi şöyle oku: "Metodun `'2` (self) yaşam süreli veri döndürmesi gerekiyordu, ama `'1` (ilan) yaşam
süreli veri döndürüyor." Bu hatanın bir hata kodu da yok. Böyle hatalar borrow checker'ın en genel
yaşam süresi hatasıdır.
:::

Düzeltme, öneride olduğu gibi ilişkiyi **açıkça** yazmaktır. Açık yazdığın yaşam süreleri elision'ı
devre dışı bırakır, çünkü kurallar sadece **isimsiz** yaşam sürelerini doldurur. Aynı `impl` bloğunda iki
metot yan yana: Biri Kural 3'ten yararlanıyor, diğeri açık anotasyonla onun dışına çıkıyor.

```rust
struct Pano<'a> {
    baslik: &'a str,
}

impl<'a> Pano<'a> {
    // Kural 3 yeterli: sonuç self'ten geliyor
    fn baslik(&self) -> &str {
        self.baslik
    }

    // Sonuç parametreden geliyor: ilişkiyi açıkça yazıyoruz
    fn duyur<'b>(&self, ilan: &'b str) -> &'b str {
        println!("{}: {ilan}", self.baslik);
        ilan
    }
}

fn main() {
    let pano = Pano { baslik: "Okul" };
    let duyuru = pano.duyur("Yarın tatil");
    println!("Pano: {} | Son duyuru: {duyuru}", pano.baslik());
}
```

:::analogy Kargo formundaki boş adres alanı
Bir kargo şirketinin formunda "teslimat adresi" alanını boş bıraktığını düşün. Şirketin sabit kuralları var:
Kayıtlı **tek** bir adresin varsa oraya gönderir (Kural 2). Kurumsal hesapla gönderiyorsan **şirket
adresine** gönderir (Kural 3, `self`). Birden fazla kayıtlı adresin var ve hiçbiri kurumsal değilse
kurye seni arar: "Hangisine?" (E0106).

Kurye paketin içine bakıp "bu doğum günü hediyesi, herhalde annesine gidiyor" diye **tahmin etmez**.
Elision da gövdeye bakmaz. Kural uyar ama niyetin farklıysa adresi açıkça yazarsın.
:::

## Kuralları uygulamak: adım adım algoritma

Derleyicinin yaptığını sen de yapabilirsin:

1. **Kural 1:** İmzadaki her isimsiz girdi referansına yeni bir ad ver.
2. **Kural 2:** Tam olarak bir girdi yaşam süresi varsa, çıktılara onu ver. Bitti.
3. **Kural 3:** `&self`/`&mut self` varsa, çıktılara onunkini ver. Bitti.
4. Çıktıda hâlâ isimsiz bir yaşam süresi kaldıysa: **E0106**. Anotasyonu sen yazmalısın.

Hiç girdi yaşam süresi olmayan bir fonksiyonun (`fn yeni() -> &str`) çıktısına hiçbir kural bir şey
veremez. Bu da E0106 olur. Böyle bir imza ancak program boyunca yaşayan bir veri döndürebilir. Onu bir
sonraki derste `'static` ile göreceğiz.

```quiz
question: Aşağıdaki imzalardan hangileri **hiç yaşam süresi anotasyonu yazmadan** derlenir? (Birden fazla seçenek doğru olabilir.)
options:
  - "`fn ilk_ogrenci(sinif: &Vec<String>) -> &String`"
  - "`fn birlestir(a: &str, b: &str) -> &str`"
  - "`fn kisalt(s: &str, n: usize) -> &str`"
  - "`fn varsayilan() -> &str`"
  - "`fn ad_ya_da(&self, yedek: &str) -> &str` (bir `impl` bloğunda)"
answer: [0, 2, 4]
explanation: |
  - `ilk_ogrenci`: tek girdi yaşam süresi → **Kural 2** ✓
  - `birlestir`: iki girdi yaşam süresi, `self` yok → E0106 ✗
  - `kisalt`: `usize` referans değil, tek girdi yaşam süresi → **Kural 2** ✓
  - `varsayilan`: hiç girdi yaşam süresi yok, hiçbir kural uygulanamaz → E0106 ✗
  - `ad_ya_da`: `&self` var → **Kural 3** ✓. Sonuç `self`'e bağlanır. Gövde `yedek`'i döndürmeye kalkarsa
    imza derlenir ama gövde hata verir (Kural 3 bölümündeki `duyur` örneği gibi).
feedback:
  - "Doğru, Kural 2."
  - "İki referans girdi var ve `self` yok: Derleyici hangisine bağlayacağını bilemez."
  - "Doğru, `n` bir referans olmadığı için sayılmaz."
  - "Girdi yaşam süresi yokken çıktıya verilecek bir şey de yok."
  - "Doğru, Kural 3 metotlarda `self`'i seçer."
```

Şimdi tersini yap: Elision'ın görünmez yaptığı yaşam sürelerini açıkça yaz.

```fill
prompt: "`Sozluk::anlam` metodunu, elision'ın ürettiğiyle **aynı anlamı** taşıyan açık hâliyle yaz. Metot zaten `<'s>` adlı bir parametre tanımlıyor."
code: |
  struct Sozluk {
      girdiler: Vec<(String, String)>,
  }

  impl Sozluk {
      // Kısa hâli: fn anlam(&self, kelime: &str) -> Option<&str>
      fn anlam<'s>(___0, kelime: &str) -> Option<___1> {
          for (k, v) in &self.girdiler {
              if k == kelime {
                  return Some(v);
              }
          }
          None
      }
  }

  fn main() {
      let s = Sozluk { girdiler: vec![(String::from("elma"), String::from("apple"))] };
      println!("{:?} {:?}", s.anlam("elma"), s.anlam("armut"));
  }
blanks:
  - ["&'s self"]
  - ["&'s str"]
output: "Some(\"apple\") None"
explanation: |
  Kural 1, `&self`'e ve `kelime`'ye ayrı yaşam süreleri verir. Kural 3 ise çıktıyı `self`'inkine bağlar:
  `&'s self` ve `Option<&'s str>`. `kelime`'nin yaşam süresine ad vermek gerekmiyor. Hiçbir şeyle
  ilişkilendirilmediği için isimsiz kalabilir.

  `&self`'in açık yazımı `&'s self`'tir. Yaşam süresi `&`'den hemen sonra gelir, tıpkı `&'s str` gibi.
  `return Some(v)`'de `v` bir `&String`. Dönüş tipi `&str` olduğu için otomatik olarak `&str`'ye dönüşür
  (deref zorlaması, Modül 17'de).
```

## `'_`: "Burada bir yaşam süresi var"

Önceki dersin `Alinti<'a>` struct'ını döndüren kısa bir fonksiyon yazalım. Bu kod derlenir, ama uyarı verir:

```rust
struct Alinti<'a> {
    parca: &'a str,
}

fn alinti_yap(metin: &str) -> Alinti {
    Alinti { parca: &metin[..3] }
}
# fn main() {
#     println!("{}", alinti_yap("Merhaba").parca);
# }
```

:::warning Derlenir ama kafa karıştırır
```text
warning: hiding a lifetime that's elided elsewhere is confusing
 --> src/main.rs:5:22
  |
5 | fn alinti_yap(metin: &str) -> Alinti {
  |                      ^^^^     ^^^^^^ the same lifetime is hidden here
  |                      |
  |                      the lifetime is elided here
  |
  = help: the same lifetime is referred to in inconsistent ways, making the signature confusing
  = note: `#[warn(mismatched_lifetime_syntaxes)]` on by default
help: use `'_` for type paths
  |
5 | fn alinti_yap(metin: &str) -> Alinti<'_> {
  |                                     ++++
```
`-> Alinti` yazınca, dönen değerin **bir referans taşıdığı** imzadan hiç anlaşılmıyor. Okuyan kişi
`Alinti`'yi sahipli bir tip sanabilir ve `metin`'in ödünçte kaldığını fark etmeyebilir. Uyarı, yaşam
süresini **görünür** yazmanı istiyor.
:::

Çözüm **anonim yaşam süresi (anonymous lifetime)** `'_`'dir. `'_`, "burada bir yaşam süresi var. Hangisi
olduğunu elision kurallarıyla sen bul" demektir. Yeni bir ad tanımlamadan, gizli olanı görünür kılar:

```rust
use std::fmt;

struct Alinti<'a> {
    parca: &'a str,
}

// Dönen Alinti'nin bir ödünç taşıdığı artık imzada görünüyor
fn alinti_yap(metin: &str) -> Alinti<'_> {
    match metin.find('.') {
        Some(i) => Alinti { parca: &metin[..i] },
        None => Alinti { parca: metin },
    }
}

// impl bloğunda 'a'yı hiç kullanmıyorsak ad vermemize gerek yok
impl fmt::Display for Alinti<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "«{}»", self.parca)
    }
}

fn main() {
    let kitap = String::from("Ne kadar bilirsen bil, söylediklerin dinleyenin anlayabildiği kadardır.");
    let a = alinti_yap(&kitap);
    println!("{a}");
}
```

`'_`'in üç yaygın kullanım yeri:

| Yer | Örnek | Anlamı |
|---|---|---|
| Dönüş tipinde struct | `-> Alinti<'_>` | Elision kurallarıyla belirlenen yaşam süresi (burada `metin`'inki) |
| `impl` başlığında | `impl fmt::Display for Alinti<'_>` | "Her yaşam süresi için", ama gövdede adına ihtiyacım yok |
| Parametrede struct | `f: &mut fmt::Formatter<'_>` | Kural 1'deki gibi yeni, bağımsız bir yaşam süresi |

Modül 11'de `Display` uygularken `f: &mut fmt::Formatter` yazmıştık ve "bazı kodlarda `Formatter<'_>`
görürsün" demiştik. Sebebi bu: `Formatter` içinde bir referans taşıyan bir struct'tır. `<'_>` yazmak bunu
görünür kılar. Standart kütüphane belgeleri bu yazımı kullanır. Parametrede yazmasan da uyarı almazsın,
çünkü dönüş tipine bağlanan gizli bir yaşam süresi yok.

```fill
prompt: "`Etiket` için `Display`'i uygula. `impl` bloğunda yaşam süresinin adına ihtiyacın yok."
code: |
  use std::fmt;

  struct Etiket<'a> {
      urun: &'a str,
      fiyat: u32,
  }

  impl fmt::Display for Etiket<___0> {
      fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
          write!(f, "{}: {} TL", self.urun, self.fiyat)
      }
  }

  fn main() {
      let ad = String::from("Simit");
      let e = Etiket { urun: &ad, fiyat: 15 };
      println!("{e}");
  }
blanks:
  - ["'_"]
output: "Simit: 15 TL"
explanation: |
  `impl fmt::Display for Etiket<'_>` şu demek: "Hangi yaşam süresiyle olursa olsun, her `Etiket` için
  `Display` uygula." Uzun yazımı `impl<'a> fmt::Display for Etiket<'a>` olurdu. Gövdede `'a` adını hiç
  kullanmadığımız için `'_` daha kısa ve niyeti daha net. Sadece `Etiket` yazsaydın `<'_>`'i
  unutmuş olurdun. Rust bunu `impl` başlığında hata olarak reddeder (E0726).
```

## Alıştırma: dosya yolu araçları

```exercise
id: m12-e-dosya-yolu
title: Dosya yolu araçları
difficulty: 3
prompt: |
  Bir yedekleme programı için `"proje/src/main.rs"` gibi yollarla çalışan dört küçük fonksiyon yazacaksın.
  Ayraç her zaman `/`:

  - `klasor(yol)`: Son `/`'dan önceki kısım. `/` yoksa `""`. Örnek: `"proje/src/main.rs"` → `"proje/src"`
  - `dosya_adi(yol)`: Son `/`'dan sonraki kısım. `/` yoksa yolun tamamı. Örnek: → `"main.rs"`
  - `uzanti(yol)`: Dosya adındaki **son** `.`'dan sonraki kısım. Dosya adında `.` yoksa ya da `.` dosya
    adının ilk karakteriyse (gizli dosya, ör. `.gitignore`) `None`. Örnek: `"ödev.final.pdf"` → `Some("pdf")`
  - `ayni_klasordeyse(a, b)`: İki yolun klasörü aynıysa **`a`'nın** klasörünü `Some(...)` ile döndürür,
    değilse `None`.

  Başlangıç kodu **derlenmiyor**: Dört imzadan yalnızca biri yaşam süresi anotasyonu istiyor. Elision
  kurallarıyla hangisi olduğunu bul ve **sadece ona** anotasyon ekle. Diğer üç imzaya dokunma. Sonucu
  `b`'ye bağlama, çünkü bir test `b`'yi kısa ömürlü veriyor.

  Yeni bir yardımcı: `rsplit_once('/')`, `split_once`'ın **sondan** arayan kardeşidir:
  `"a/b/c".rsplit_once('/')` → `Some(("a/b", "c"))`.
starter: |
  fn klasor(yol: &str) -> &str {
      todo!()
  }

  fn dosya_adi(yol: &str) -> &str {
      todo!()
  }

  fn uzanti(yol: &str) -> Option<&str> {
      todo!()
  }

  fn ayni_klasordeyse(a: &str, b: &str) -> Option<&str> {
      todo!()
  }

  fn main() {
      let yol = "proje/src/main.rs";
      println!("{} | {} | {:?}", klasor(yol), dosya_adi(yol), uzanti(yol));
      println!("{:?}", ayni_klasordeyse(yol, "proje/src/lib.rs"));
  }
starter_compiles: false
solution: |
  fn klasor(yol: &str) -> &str {
      match yol.rsplit_once('/') {
          Some((k, _)) => k,
          None => "",
      }
  }

  fn dosya_adi(yol: &str) -> &str {
      match yol.rsplit_once('/') {
          Some((_, ad)) => ad,
          None => yol,
      }
  }

  fn uzanti(yol: &str) -> Option<&str> {
      let ad = dosya_adi(yol);
      let (govde, uz) = ad.rsplit_once('.')?;
      if govde.is_empty() { None } else { Some(uz) }
  }

  fn ayni_klasordeyse<'a>(a: &'a str, b: &str) -> Option<&'a str> {
      let k = klasor(a);
      if k == klasor(b) { Some(k) } else { None }
  }

  fn main() {
      let yol = "proje/src/main.rs";
      println!("{} | {} | {:?}", klasor(yol), dosya_adi(yol), uzanti(yol));
      println!("{:?}", ayni_klasordeyse(yol, "proje/src/lib.rs"));
  }
check: tests
tests: |
  #[test]
  fn klasor_ve_dosya_adi() {
      assert_eq!(klasor("proje/src/main.rs"), "proje/src");
      assert_eq!(dosya_adi("proje/src/main.rs"), "main.rs");
      assert_eq!(klasor("notlar.txt"), "", "'/' yoksa klasör boş olmalı");
      assert_eq!(dosya_adi("notlar.txt"), "notlar.txt", "'/' yoksa dosya adı yolun tamamı");
  }

  #[test]
  fn uzanti_son_noktadan() {
      assert_eq!(uzanti("belgeler/ödev.final.pdf"), Some("pdf"), "son '.'dan sonrası alınmalı");
      assert_eq!(uzanti("resim.jpeg"), Some("jpeg"));
  }

  #[test]
  fn uzantisiz_ve_gizli_dosyalar() {
      assert_eq!(uzanti("proje/Makefile"), None, "noktasız dosyanın uzantısı yok");
      assert_eq!(uzanti("proje/.gitignore"), None, "'.' ile başlayan gizli dosyanın uzantısı yok");
      assert_eq!(uzanti("v1.2/README"), None, "klasör adındaki nokta uzantı sayılmaz");
  }

  #[test]
  fn ayni_klasor_kontrolu() {
      assert_eq!(ayni_klasordeyse("a/b/x.rs", "a/b/y.rs"), Some("a/b"));
      assert_eq!(ayni_klasordeyse("a/x.rs", "b/x.rs"), None, "farklı klasörler");
      assert_eq!(ayni_klasordeyse("a/b/x.rs", "a/x.rs"), None, "biri diğerinin üst klasöründe");
  }

  #[test]
  fn sonuc_sadece_a_ya_bagli() {
      let a = String::from("yedek/2024/mart.zip");
      let sonuc;
      {
          let b = String::from("yedek/2024/nisan.zip");
          sonuc = ayni_klasordeyse(&a, &b);
      }
      assert_eq!(sonuc, Some("yedek/2024"), "sonuç b öldükten sonra da kullanılabilmeli");
  }
require:
  - pattern: "fn klasor\\(yol: &str\\) -> &str"
    message: "`klasor`'un imzası elision ile zaten derleniyor; ona dokunma."
  - pattern: "fn dosya_adi\\(yol: &str\\) -> &str"
    message: "`dosya_adi`'nın imzası elision ile zaten derleniyor; ona dokunma."
  - pattern: "fn uzanti\\(yol: &str\\) -> Option<&str>"
    message: "`uzanti`'nın imzası elision ile zaten derleniyor; ona dokunma."
hints:
  - "Her imzaya Kural 1 ve 2'yi uygula. Kaç **girdi** yaşam süresi var? Birden fazla girdi yaşam süresi olan ve `self` içermeyen imza E0106 verir."
  - "`ayni_klasordeyse` iki referans alıyor. Sonuç `a`'nın parçası olduğu için: `fn ayni_klasordeyse<'a>(a: &'a str, b: &str) -> Option<&'a str>`."
  - "Gövdeler için `match yol.rsplit_once('/') { Some((k, _)) => k, None => \"\" }` kalıbını kullan. `uzanti`'da önce `dosya_adi(yol)`'u al, sonra `let (govde, uz) = ad.rsplit_once('.')?;` ve `govde.is_empty()` kontrolü."
explanation: |
  İlk üç imzada tek girdi yaşam süresi var. **Kural 2** dönen dilimleri `yol`'a bağlıyor ve anotasyona
  gerek kalmıyor. `ayni_klasordeyse`'de iki girdi yaşam süresi var ve `self` yok, yani hiçbir kural
  çıktıyı belirleyemiyor. Sonuç her zaman `a`'nın parçası olduğu için yalnızca `a` ile dönüş tipini
  `'a`'ya bağladık. `b` sadece karşılaştırmada okunuyor.

  `uzanti`'nın içinde `dosya_adi(yol)` çağırmak da güzel bir ayrıntı: `dosya_adi` `yol`'a bağlı bir dilim
  döndürüyor. Ondan aldığımız `uz` da aynı yaşam süresini taşıyor. Dilimin dilimi hâlâ orijinal yola
  bakıyor. Hiçbir yerde kopya yok.

  `?` burada `Option` üzerinde çalışıyor (Modül 10): Dosya adında `.` yoksa `rsplit_once` `None` döner ve
  fonksiyon hemen `None` ile çıkar. `uzanti("v1.2/README")` testinin geçmesi ise `uzanti`'yı **dosya adı**
  üzerinde çalıştırmamız sayesinde. Tüm yol üzerinde `rsplit_once('.')` yapsaydın `"2/README"`'yi
  uzantı sanırdın.
```

## Özet

:::remember
Elision kuralları (sadece fonksiyon/metot imzalarında):

1. Her isimsiz **girdi** referansı kendi yaşam süresini alır. İç içe referanslar (`&[&str]`) ve struct'ların gizli parametreleri ayrı ayrı sayılır.
2. **Tam olarak bir** girdi yaşam süresi varsa, bütün çıktılara o verilir.
3. `&self` / `&mut self` varsa, çıktılara `self`'inki verilir.

Çıktıda isimsiz yaşam süresi kalırsa E0106. Elision tahmin değil mekanik bir kuraldır: Gövdeye bakmaz,
yanlış referansı bağlarsa hata gövdede çıkar. `'_` gizli bir yaşam süresini ad vermeden görünür kılar:
`-> Alinti<'_>`, `impl Display for Alinti<'_>`.
:::

```reflect
prompt: |
  Kural 3 neden `self`'i seçiyor da diğer parametreleri değil? Bu varsayılanın işe yaradığı bir metot
  ve yanlış referansı bağladığı bir metot örneği düşün.
answer: |
  Model cevap: Metotların çoğu nesnenin kendi verisinden bir şey döndürür. Getter'lar (`fn ad(&self) -> &str`),
  koleksiyon aramaları (`HashMap::get`) ve alt parçalar (`Vec::first`) böyledir. Bu yüzden `self`'e
  bağlamak en sık doğru olan tahmindir ve imzaları kısa tutar. Yanlış olduğu durum, metodun sonucu bir
  **parametreden** türettiği durumdur. Örneğin `fn duyur(&self, ilan: &str) -> &str` gövdesi `ilan`'ı
  döndürüyorsa Kural 3 yine `self`'i seçer ve gövde imzayla çelişir. O zaman ilişkiyi açıkça yazarım:
  `fn duyur<'b>(&self, ilan: &'b str) -> &'b str`.
```

```flashcards
- front: "Elision **Kural 1** nedir?"
  back: "İmzadaki her isimsiz girdi referansı kendi, ayrı yaşam süresini alır. `&[&str]` gibi iç içe referanslar iki ayrı yaşam süresi sayılır."
- front: "Elision **Kural 2** nedir?"
  back: "Tam olarak bir girdi yaşam süresi varsa, dönüş tipindeki bütün isimsiz yaşam süreleri ona eşitlenir."
- front: "Elision **Kural 3** nedir?"
  back: "Parametrelerden biri `&self` ya da `&mut self` ise, çıktılardaki isimsiz yaşam süreleri `self`'inkine eşitlenir."
- front: "`fn f(x: &[(&str, i32)]) -> Vec<&str>` neden E0106 verir?"
  back: "Tek parametre ama iki referans var (dilim ve içindeki `&str`). Kural 1 iki girdi yaşam süresi üretir, Kural 2 uygulanamaz."
- front: "`fn varsayilan() -> &str` neden derlenmez?"
  back: "Hiç girdi yaşam süresi yok. Hiçbir kural çıktıya yaşam süresi veremez, E0106 çıkar."
- front: "Hata mesajında `'1`, `'2` gibi yaşam süreleri ne anlama gelir?"
  back: "İsimsiz (elided) yaşam süreleri için derleyicinin mesajda uydurduğu geçici adlardır. Kodda görünmezler."
- front: "`'_` ne işe yarar?"
  back: "Anonim yaşam süresi: Yeni ad tanımlamadan \"burada bir yaşam süresi var\" der. Ör. `-> Alinti<'_>`, `impl Display for Alinti<'_>`."
- front: "`fn f(s: &str) -> Alinti` neden uyarı verir?"
  back: "`mismatched_lifetime_syntaxes`: Dönen `Alinti`'nin `s`'ye bağlı olduğu gizli kalıyor. `-> Alinti<'_>` yazılmalı."
```
