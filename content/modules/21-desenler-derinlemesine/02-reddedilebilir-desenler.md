---
id: m21-l02
title: Reddedilebilir ve reddedilemez desenler
minutes: 16
type: lesson
objectives:
  - Bir desenin verilen tip için reddedilebilir (refutable) mi reddedilemez (irrefutable) mi olduğunu söyleyebilmek
  - Her desen konumunun hangi tür desen kabul ettiğini açıklayabilmek ve E0005 hatasını okuyup düzeltebilmek
  - "`let ... else` ve `match` ile reddedilebilir bir deseni güvenle kullanabilmek"
  - "`irrefutable_let_patterns` ve `unreachable_patterns` uyarılarının neyi işaret ettiğini yorumlayabilmek"
keywords: [refutable, irrefutable, reddedilebilir, reddedilemez, E0005, let else, eksiksizlik, unreachable pattern]
---

Önceki derste `fn selamla(Some(ad): Option<&str>)` satırının derlenmediğini gördün, ama `fn alan(&Dikdortgen { en, boy }: &Dikdortgen)`
sorunsuz derlendi. İkisi de parametrede bir desen. Fark nerede?

Cevap, desenlerin belki de en önemli özelliğinde: bir desen ya **her değere uyar** ya da **bazı değerlere
uymayabilir**. Rust her desen konumu için bu ayrımı derleme zamanında denetler. Bu derste bu kuralı ve
onun neden programlarını güvenli tuttuğunu öğreneceksin.

## Önce tahmin et

Açıklamaya geçmeden önce iki programın derlenip derlenmediğini tahmin et. İpucu: ikisi de `let` ile bir
enum varyantını açmaya çalışıyor.

```compiles
code: |
  fn main() {
      let secim: Option<u32> = Some(3);
      let Some(n) = secim;
      println!("Seçilen: {n}");
  }
answer: false
error: E0005
explanation: |
  Derlenmez: **E0005**, *refutable pattern in local binding*. `secim` bu satırda `Some(3)` olsa da tipi
  `Option<u32>`'dur ve derleyici yalnızca tipe bakar: aynı tipteki bir değer `None` da olabilirdi. O zaman
  `n`'e ne bağlanacaktı? Sonraki satır `n`'i kullanıyor; değer yoksa program anlamsız olurdu.
```

```compiles
code: |
  enum Kimlik {
      Tc(u64),
  }

  fn main() {
      let k = Kimlik::Tc(12345678901);
      let Kimlik::Tc(numara) = k;
      println!("Kimlik no: {numara}");
  }
answer: true
explanation: |
  Derlenir! `Kimlik` enum'unun **tek bir** varyantı var; `Kimlik` tipindeki her değer mutlaka bir
  `Kimlik::Tc(...)`'dir. Desen bu tipin bütün değerlerine uyduğu için `let`'te kullanılabilir.
  Sorun "enum" olması değil, desenin **uymama ihtimali** olup olmamasıdır.
```

## İki tür desen

**Reddedilemez (irrefutable)** desen, verilen tipin **her** değerine uyar. **Reddedilebilir (refutable)**
desen ise bazı değerlere uymayabilir. Önemli nokta: bu bir **desen + tip** özelliğidir. `Some(n)` deseni
`Option<u32>` için reddedilebilirdir; `Kimlik::Tc(numara)` ise tek varyantlı `Kimlik` için reddedilemez.

| Desen | Tip | Tür | Neden |
|---|---|---|---|
| `x`, `_` | herhangi | reddedilemez | her değere uyar |
| `(a, b)` | `(i32, String)` | reddedilemez | her iki elemanlı tuple uyar |
| `Nokta { x, y }` | `Nokta` | reddedilemez | struct'ın tek bir şekli var |
| `[r, g, b]` | `[u8; 3]` | reddedilemez | dizinin boyu tipin parçası |
| `Kimlik::Tc(n)` | tek varyantlı `Kimlik` | reddedilemez | başka varyant yok |
| `Some(n)` | `Option<T>` | **reddedilebilir** | `None` uymaz |
| `Ok(n)` | `Result<T, E>` | **reddedilebilir** | `Err(..)` uymaz |
| `0`, `'a'`, `1..=9` | `i32`, `char` | **reddedilebilir** | diğer sayılar/karakterler uymaz |
| `(0, y)` | `(i32, i32)` | **reddedilebilir** | ilk eleman `0` olmayabilir |

Son satıra dikkat: bir tuple deseninin içinde **tek bir** reddedilebilir parça varsa bütün desen
reddedilebilir olur. Bir desen ancak bütün parçaları reddedilemezse reddedilemezdir.

Tablonun üst yarısındaki desenlerin hepsi `let`'te kullanılabilir:

```rust
enum Kimlik {
    Tc(u64),
}

struct Ogrenci {
    no: u32,
    ad: &'static str,
}

fn main() {
    let Kimlik::Tc(numara) = Kimlik::Tc(12345678901); // tek varyant
    let Ogrenci { no, ad } = Ogrenci { no: 7, ad: "Ece" }; // struct
    let [kirmizi, yesil, mavi] = [255u8, 128, 0]; // sabit boylu dizi
    let (ders, (vize, final_notu)) = ("Fizik", (60, 85)); // iç içe tuple

    println!("{numara} · {no} {ad}");
    println!("renk: ({kirmizi}, {yesil}, {mavi})");
    println!("{ders}: {}", vize * 4 / 10 + final_notu * 6 / 10);
}
```

:::analogy Otomatik kapı ve turnike
Bir AVM'nin girişindeki **otomatik kapı** önüne gelen herkes için açılır; kimse geri çevrilmez. Metro
**turnikesi** ise yalnızca geçerli kartı olanı geçirir. Reddedilemez desen otomatik kapıdır, reddedilebilir
desen turnikedir. `let`, `for` ve parametreler arkasında "B planı" olmayan koridorlardır: oraya turnike
koyarsan kartı olmayan biri kapıda kalır ve program ne yapacağını bilemez. Bu yüzden Rust oralarda
yalnızca otomatik kapıya izin verir.
:::

Başka diller bu durumu genellikle **çalışma zamanına** bırakır. Python'da `a, b = [1, 2, 3]` program
çalışırken `ValueError` fırlatır. JavaScript'te `const [a, b] = [1];` sessizce `b = undefined` verir ve hata
çok sonra başka bir yerde patlar. Rust aynı soruyu program hiç çalışmadan sorar.

```quiz
question: |
  Aşağıdaki desen–tip çiftlerinden hangileri **reddedilemez**? (Birden fazla seçenek doğru olabilir.)
options:
  - "`(ad, _)` deseni, tip `(&str, u32)`"
  - "`Some(_)` deseni, tip `Option<String>`"
  - "`[ilk, ikinci]` deseni, tip `[char; 2]`"
  - "`(x, 0)` deseni, tip `(i32, i32)`"
answer: [0, 2]
explanation: |
  `(ad, _)` iki parçası da her değere uyduğu için reddedilemezdir. `[ilk, ikinci]` iki elemanlı bir dizi
  tipinde reddedilemezdir, çünkü `[char; 2]` tipindeki her değerin tam 2 elemanı vardır.
  `Some(_)` içi joker olsa bile `None`'a uymaz. `(x, 0)` ise ikinci eleman `0` olmadığında uymaz:
  tek bir reddedilebilir parça bütün deseni reddedilebilir yapar.
feedback:
  - "Doğru: isim ve joker her değere uyar."
  - "İçerideki `_` her şeye uyar ama dıştaki `Some` `None`'u dışarıda bırakır."
  - "Doğru: dizinin uzunluğu tipin parçasıdır, her `[char; 2]` iki elemanlıdır."
  - "`0` değişmezi reddedilebilirdir; tuple'ın tamamını reddedilebilir yapar."
```

## Hangi konum hangi deseni ister?

Desen konumları ikiye ayrılır. Ayrımın mantığı tek bir soruya dayanır: "Desen uymazsa bu konumda
gidilecek **başka bir yol** var mı?"

| Konum | Kabul ettiği | Desen uymazsa |
|---|---|---|
| `let DESEN = ...;` | yalnızca reddedilemez | gidilecek yol yok |
| `for DESEN in ...` | yalnızca reddedilemez | gidilecek yol yok |
| fonksiyon parametreleri | yalnızca reddedilemez | gidilecek yol yok |
| closure parametreleri | yalnızca reddedilemez | gidilecek yol yok |
| `if let` | reddedilebilir | `else` dalı ya da hiçbir şey |
| `while let` | reddedilebilir | döngü biter |
| `let DESEN = ... else { ... };` | reddedilebilir | `else` bloğu akıştan çıkar |
| `match` kolları | reddedilebilir (toplamı eksiksiz olmalı) | sıradaki kol denenir |

Yanlış konuma reddedilebilir bir desen koyduğunda derleyici sana konumu da söyler:

:::error
```text
error[E0005]: refutable pattern in `for` loop binding
 --> src/main.rs:3:9
  |
3 |     for Some(x) in v {
  |         ^^^^^^^ pattern `None` not covered
  |
  = note: the matched value is of type `Option<i32>`
```
Hata başlığı konumu adlandırır: *local binding* (`let`), *function argument*, *closure argument* ya da
burada olduğu gibi *`for` loop binding*. `pattern None not covered` satırı ise **hangi değerin** desene
uymadığını tek tek sayar. Bu iki bilgi çoğu zaman çözümü doğrudan gösterir.
:::

Çözüm, uymama ihtimalini açıkça ele alan bir konuma geçmektir. Döngünün içinde bir `if let`:

```rust
fn main() {
    let olcumler = vec![Some(21), None, Some(19), None, Some(24)];

    let mut toplam = 0;
    let mut gecerli = 0;
    for olcum in &olcumler {
        // `for` deseni (olcum) reddedilemez; reddedilebilir iş içerideki `if let`'te
        if let Some(derece) = olcum {
            toplam += derece;
            gecerli += 1;
        }
    }
    println!("{gecerli} geçerli ölçüm, ortalama {}", toplam / gecerli);
}
```

:::tip Kısayol
Modül 14'teki iterator'lara küçük bir ek: `Option` de bir iterator gibi davranabilir (`Some` bir eleman,
`None` sıfır eleman). `flatten()` adaptörü, iç içe iterator'ları `flat_map` gibi tek akışa düzleştirir; bu yüzden
`for derece in olcumler.iter().flatten()` yalnızca `Some` içlerini dolaşır. Modül 14'te gördüğün
`filter_map(|o| *o)` de aynı işi görür. Desen konumu kuralını ezmiyoruz; uymayan değerleri **desene gelmeden önce**
eliyoruz.
:::

Bir de Modül 10'dan tanıdık bir tip: tahmin et.

```compiles
code: |
  fn main() {
      let metin = "42";
      let Ok(sayi) = metin.parse::<i32>();
      println!("{}", sayi * 2);
  }
answer: false
error: E0005
explanation: |
  Derlenmez: **E0005**, *pattern `Err(_)` not covered*. `parse` bir `Result<i32, ParseIntError>` döndürür
  ve `Ok(sayi)` deseni `Err` durumunu kapsamaz. Metnin `"42"` olduğunu sen biliyorsun ama tip bilmiyor.
  Çözümler: `let ... else`, `match`, ya da Modül 10'daki `?`, `unwrap_or` ve (gerçekten emin olduğunda)
  `expect("...")`.
```

## Köprü: let-else ve match

Reddedilebilir bir desenden çıkan isimleri, `if let` bloğuna hapsolmadan **fonksiyonun geri kalanında**
kullanmak istiyorsan köprü `let ... else`'tir. Derleyici bunu kendisi de önerir:

:::error
```text
error[E0005]: refutable pattern in local binding
 --> src/main.rs:3:9
  |
3 |     let Some(n) = secim;
  |         ^^^^^^^ pattern `None` not covered
  |
  = note: `let` bindings require an "irrefutable pattern", like a `struct` or an `enum` with only one variant
  = note: the matched value is of type `Option<u32>`
help: you might want to use `let...else` to handle the variant that isn't matched
  |
3 |     let Some(n) = secim else { todo!() };
  |                         ++++++++++++++++
```
`note` satırı kuralı kendisi anlatıyor: `let` reddedilemez desen ister (struct ya da tek varyantlı enum
gibi). `help` satırı ise eksik parçayı `+` işaretleriyle **tam yerinde** gösteriyor. `todo!()` yer
tutucusunu kendi B planınla değiştir: `return`, `continue`, `break` ya da anlamlı bir `panic!`.
:::

`let ... else`'in işi aslında küçük bir sözleşmedir: "Desen uyarsa isimler bağlanır ve kod devam eder.
Uymazsa `else` bloğu **asla geri dönmez**." Böylece `else`'ten sonraki kod için desen fiilen
reddedilemez hâle gelir: oraya ulaşıldıysa desen uymuş demektir.

`match` ise aynı fikrin çok kollu hâlidir: kollar **tek tek** reddedilebilir olabilir, ama **hepsi
birlikte** tipin bütün değerlerini kapsamalıdır. Başka bir deyişle bir `match`'in kollarının toplamı
reddedilemez bir desen gibi davranmak zorundadır. Eksiksizlik hatası **E0004** de bu yüzden vardır.

```rust
fn bilet_ucreti(yas: Option<u32>) -> u32 {
    match yas {
        Some(0..=6) => 0,    // reddedilebilir
        Some(7..=17) => 40,  // reddedilebilir
        Some(65..) => 30,    // reddedilebilir
        Some(_) => 80,       // reddedilebilir (None'a uymaz)
        None => 80,          // reddedilebilir (Some'a uymaz)
    } // ...ama beşi BİRLİKTE her Option<u32> değerini kapsar
}

fn main() {
    for yas in [Some(4), Some(15), Some(30), Some(70), None] {
        println!("{yas:?} → {} TL", bilet_ucreti(yas));
    }
}
```

Kolların hiçbiri tek başına her değere uymuyor; ama derleyici beşini üst üste koyduğunda açıkta kalan
tek bir değer bulamıyor. `Some(_)` kolunu silsen **E0004** alırdın ve hata mesajı açıkta kalan
değerleri tam olarak gösterirdi: *pattern `Some(18_u32..=64_u32)` not covered*. Derleyici aralıkları
bile senin yerine hesaplıyor.

```fill
prompt: |
  Bir oyun kaydındaki `"seviye:7"` gibi bir satırdan seviye numarasını çıkar. Uymayan satırlarda
  fonksiyon `0` döndürsün. Boşlukları `let ... else` ile doldur.
code: |
  fn seviye(satir: &str) -> u32 {
      let Some((anahtar, deger)) = satir.split_once(':') ___0 {
          return 0;
      };
      if anahtar != "seviye" {
          return 0;
      }
      let ___1(n) = deger.parse::<u32>() else {
          return 0;
      };
      n
  }

  fn main() {
      println!("{} {} {}", seviye("seviye:7"), seviye("can:3"), seviye("seviye:yedi"));
  }
blanks:
  - ["else"]
  - ["Ok"]
output: 7 0 0
explanation: |
  İlk `let ... else` `Option`'ı (`split_once`), ikincisi `Result`'ı (`parse`) açıyor. İkisinde de `else`
  bloğu `return` ile akıştan çıkıyor; bu yüzden sonraki satırlar `anahtar`, `deger` ve `n`'i güvenle
  kullanabiliyor.
```

## Ters yön: gereksiz yere reddedilebilir konum

Kuralın öbür yüzü de var: reddedilebilir desen bekleyen bir konuma **reddedilemez** bir desen koymak hata
değildir, ama neredeyse her zaman bir yanlış anlamanın işaretidir. Derleyici bu yüzden **uyarı** verir:

:::warning Üç uyarı, tek anlam: "Bu desen her zaman uyar"
```text
warning: irrefutable `if let` pattern
  = note: this pattern will always match, so the `if let` is useless
  = help: consider replacing the `if let` with a `let`

warning: irrefutable `while let` pattern
  = note: this pattern will always match, so the loop will never exit

warning: unreachable `else` clause
  = note: this pattern always matches, so the else clause is unreachable
```
`if let x = deger` her zaman çalışır (`if` gereksiz), `while let y = i` hiç bitmez, `let x = a else { ... }`
yazdığında `else` asla çalışmaz. Üçü de `irrefutable_let_patterns` uyarısıdır.
:::

`match`'te bunun karşılığı **erişilemez kol (unreachable pattern)** uyarısıdır: reddedilemez bir kol
(örneğin tek bir isim) en üste yazılırsa altındaki kollara hiçbir değer ulaşamaz. Bu uyarıyı ciddiye
almazsan program derlenir ama **yanlış** çalışır. Tahmin et:

```predict
code: |
  fn main() {
      let sicaklik = 0;
      match sicaklik {
          derece => println!("{derece} derece"),
          0 => println!("donma noktası"),
      }
  }
options:
  - "donma noktası"
  - "0 derece"
  - Derlenmez
answer: 1
explanation: |
  Program derlenir (yalnızca `unreachable pattern` uyarısıyla) ve `0 derece` yazar. `derece` bir isim
  desenidir: reddedilemezdir ve **her** değere uyar. Kollar yukarıdan aşağıya denendiği için `0` koluna
  hiçbir değer ulaşmaz. Doğru sıra: önce özel durumlar (`0`), en sona her şeye uyan kol.
```

:::deep Hiç değeri olmayan tipler
Rust'ta hiçbir değeri olmayan tipler de var; örneğin standart kütüphanedeki `std::convert::Infallible`
(Modül 22'de "never" tipi `!` ile birlikte göreceksin). Bir `Result<T, Infallible>`'ın `Err` varyantını
oluşturmak imkânsız olduğu için Rust 1.82'den beri `let Ok(x) = sonuc;` bu tipte reddedilemez sayılır:

```rust
use std::convert::Infallible;

fn main() {
    let sonuc: Result<u32, Infallible> = Ok(3);
    let Ok(x) = sonuc; // Err hiç oluşamaz → desen reddedilemez
    println!("{x}");
}
```
Kural değişmedi: reddedilemez = **tipin bütün olası değerlerine** uyan. Sadece olası değer kümesi bazen
düşündüğünden küçüktür.
:::

## Kendin dene: ayar satırı okuyucu

````exercise
id: m21-e-ayar
title: Ayar satırı okuyucu
difficulty: 3
prompt: |
  Bir sunucunun ayar dosyasında `port = 8080` biçiminde satırlar var. `port_oku` fonksiyonunu yaz.
  Hata durumlarında **tam olarak** şu mesajları içeren `Err(String)` döndür:

  | Durum | Dönüş |
  |---|---|
  | satırda `=` yok | `Err("'=' bulunamadı")` |
  | anahtar (boşluklar atıldıktan sonra) `port` değil | `Err("bilinmeyen anahtar: <anahtar>")` |
  | değer bir `u16` değil | `Err("geçersiz port: <değer>")` (değer boşlukları atılmış hâliyle) |
  | port `0` | `Err("port 0 olamaz")` |
  | her şey yolunda | `Ok(port)` |

  `=`'den önce ve sonra boşluk olabilir. Reddedilebilir desenleri `let ... else` ile aç.
starter: |
  fn port_oku(satir: &str) -> Result<u16, String> {
      todo!()
  }

  fn main() {
      for s in ["port = 8080", "port=443", "host = yerel", "port 80", "port = yüz", "port = 0"] {
          println!("{s:?} → {:?}", port_oku(s));
      }
  }
solution: |
  fn port_oku(satir: &str) -> Result<u16, String> {
      let Some((anahtar, deger)) = satir.split_once('=') else {
          return Err(String::from("'=' bulunamadı"));
      };
      let anahtar = anahtar.trim();
      if anahtar != "port" {
          return Err(format!("bilinmeyen anahtar: {anahtar}"));
      }
      let deger = deger.trim();
      let Ok(port) = deger.parse::<u16>() else {
          return Err(format!("geçersiz port: {deger}"));
      };
      if port == 0 {
          return Err(String::from("port 0 olamaz"));
      }
      Ok(port)
  }

  fn main() {
      for s in ["port = 8080", "port=443", "host = yerel", "port 80", "port = yüz", "port = 0"] {
          println!("{s:?} → {:?}", port_oku(s));
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_satirlar() {
      assert_eq!(port_oku("port = 8080"), Ok(8080));
      assert_eq!(port_oku("port=443"), Ok(443), "eşittir etrafında boşluk olmayabilir");
      assert_eq!(port_oku("  port   =   22  "), Ok(22), "fazla boşluklar atılmalı");
  }

  #[test]
  fn esittir_yoksa_hata() {
      assert_eq!(port_oku("port 80"), Err(String::from("'=' bulunamadı")));
  }

  #[test]
  fn bilinmeyen_anahtar() {
      assert_eq!(port_oku("host = yerel"), Err(String::from("bilinmeyen anahtar: host")), "anahtar boşluksuz yazılmalı");
  }

  #[test]
  fn gecersiz_deger() {
      assert_eq!(port_oku("port = yüz"), Err(String::from("geçersiz port: yüz")));
      assert_eq!(port_oku("port = 70000"), Err(String::from("geçersiz port: 70000")), "70000 bir u16'ya sığmaz (en fazla 65535)");
      assert_eq!(port_oku("port = 0"), Err(String::from("port 0 olamaz")));
  }
hints:
  - "İlk adım `split_once('=')`: `let Some((anahtar, deger)) = satir.split_once('=') else { return Err(...); };`"
  - "Anahtarı ve değeri `trim()` ile temizleyip gölgele: `let anahtar = anahtar.trim();`. Hata mesajlarını `format!(\"bilinmeyen anahtar: {anahtar}\")` ile kur."
  - "`parse::<u16>()` bir `Result` döndürür: `let Ok(port) = deger.parse::<u16>() else { return Err(format!(\"geçersiz port: {deger}\")); };`. Sonra `port == 0` kontrolünü yap."
require:
  - pattern: "let\\s+(Some|Ok)\\s*\\("
    message: Reddedilebilir desenlerden en az birini `let ... else` ile aç.
explanation: |
  Her `let ... else` bir reddedilebilir deseni "buradan sonra kesin uymuş" bir bağlamaya çeviriyor:
  `else` blokları `return` ile akıştan çıktığı için sonraki satırlar `anahtar`, `deger` ve `port`'u
  koşulsuz kullanabiliyor. Fonksiyon dört farklı hata yolunu iç içe hiç girinti olmadan anlatıyor.

  `u16` seçimi de bir tip tasarımı: 65535'ten büyük portlar zaten `parse` aşamasında reddediliyor
  (Modül 10'daki "geçersiz değerleri tiple engelle" fikri). Modül 11'de gördüğün özel hata enum'ları ve
  `From` dönüşümleriyle bu `String` hataları daha da yapılandırılmış hâle getirebilirsin.

  Aynı işi `match` ile de yazabilirdin:

  ```rust
  fn port_degeri(deger: &str) -> Result<u16, String> {
      let port = match deger.parse::<u16>() {
          Ok(p) => p,
          Err(e) => return Err(format!("geçersiz port: {deger} ({e})")),
      };
      Ok(port)
  }
  ```

  İki yazım eşdeğerdir; hata kolunda başka bir bilgiye (örneğin `Err(e)` içindeki `e`'ye) ihtiyacın
  olduğunda `match` öne geçer, çünkü `let ... else`'in `else` bloğu uymayan değere isim veremez.
````

## Özet

:::remember
- **Reddedilemez (irrefutable)**: tipin her değerine uyar (`x`, `_`, `(a, b)`, `Nokta { x, y }`, `[a, b, c]`, tek varyantlı enum).
- **Reddedilebilir (refutable)**: bazı değerlere uymayabilir (`Some(x)`, `Ok(x)`, `0`, `1..=9`, `(0, y)`). Tek bir reddedilebilir parça bütün deseni reddedilebilir yapar.
- `let`, `for`, fonksiyon ve closure parametreleri yalnızca reddedilemez desen alır; yoksa **E0005**.
- `if let`, `while let`, `let ... else` ve `match` kolları reddedilebilir desen alır. `match`'in kollarının **toplamı** eksiksiz olmalı (**E0004**).
- Reddedilebilir konuma reddedilemez desen: `irrefutable_let_patterns` uyarısı. Her şeye uyan kolun altındaki kollar: `unreachable_patterns` uyarısı. İkisi de bir mantık hatasının habercisidir.
:::

```reflect
prompt: |
  Rust neden `let Some(n) = secim;` satırını, `secim` o anda açıkça `Some(3)` olsa bile reddediyor?
  Bu kararın programcıya ne kazandırdığını bir başka dille karşılaştırarak açıkla.
answer: |
  Derleyici değerlere değil **tiplere** bakar: `Option<u32>` tipindeki bir değer `None` da olabilir ve o
  durumda `n`'e bağlanacak bir değer yoktur. Değerin şu an `Some` olması yarın kod değiştiğinde (örneğin
  `secim` bir fonksiyondan gelmeye başladığında) geçerliliğini yitirebilir. Python'da `a, b = liste`
  satırı listenin uzunluğu yanlışsa program çalışırken çöker; JavaScript'te sessizce `undefined` verir.
  Rust ise bu durumu derleme zamanında yakalar ve beni B planını (`let ... else`, `match`) açıkça
  yazmaya zorlar. Böylece "olmaz öyle şey" dediğim durumlar kodda belgelenmiş olur.
```

```flashcards
- front: Reddedilemez (irrefutable) desen nedir?
  back: Verilen tipin **her** değerine uyan desen. Örn. `x`, `_`, `(a, b)`, `Nokta { x, y }`.
- front: "`Some(_)` deseni `Option<String>` için reddedilebilir mi?"
  back: "Evet. İçteki `_` her şeye uysa da `None` dıştaki `Some`'a uymaz."
- front: Hangi dört desen konumu yalnızca reddedilemez desen kabul eder?
  back: "`let`, `for DESEN in`, fonksiyon parametreleri ve closure parametreleri."
- front: "E0005 hata kodu ne anlama gelir?"
  back: "*refutable pattern in ...*: reddedilemez desen gereken bir konuma (let, for, parametre) reddedilebilir bir desen yazılmış."
- front: "Tek varyantlı `enum Kimlik { Tc(u64) }` için `let Kimlik::Tc(n) = k;` derlenir mi?"
  back: "Evet. Başka varyant olmadığı için desen reddedilemezdir."
- front: "`if let x = 5 { ... }` neden uyarı verir?"
  back: "`irrefutable_let_patterns`: `x` her değere uyar, yani `if` hiçbir şeyi sınamıyor; düz `let` yeterli."
- front: "`match`'te en üste `n => ...` gibi bir isim kolu yazmak neye yol açar?"
  back: "Altındaki bütün kollar erişilemez olur (`unreachable_patterns` uyarısı); her değer ilk kola gider."
```
