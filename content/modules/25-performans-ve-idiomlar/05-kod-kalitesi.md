---
id: m25-l05
title: "Kod Kalitesi: clippy, rustfmt ve Kalıplar"
minutes: 28
type: lesson
objectives:
  - "Clippy'nin lint gruplarını (correctness, style, complexity, perf, pedantic...) ve varsayılan seviyelerinin gerekçesini açıklayabilmek"
  - "`needless_return`, `len_zero`, `collapsible_if`, `manual_map`, `single_match`, `map_unwrap_or` gibi lint'lerin işaret ettiği kodu idiomatik hâle getirebilmek"
  - "`cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` ve `cargo doc` adımlarından oluşan bir CI kontrol listesi kurabilmek"
  - Typestate ve sealed trait kalıplarıyla geçersiz durumları ve istenmeyen trait uygulamalarını derleme zamanında engelleyebilmek
keywords: [clippy, lint grupları, rustfmt, needless_return, len_zero, collapsible_if, manual_map, single_match, map_unwrap_or, CI, typestate, sealed trait, mühürlü trait]
---

İlk kod incelemende (code review) kırk yorum aldığını düşün: "burada `return` gereksiz", "`len() == 0`
yerine `is_empty()`", "bu `match` aslında bir `map`", "süslü parantez alt satıra gelmez"... Yorumların
hiçbiri yanlış değil ama hiçbiri de **mimariyle** ilgili değil. İnceleyen kişinin zamanı, bir makinenin
saniyeler içinde yakalayabileceği şeylere gitti.

Profesyonel Rust ekipleri bu işi iki araca devreder: **clippy** idiomları, **rustfmt** biçimi denetler; CI
(sürekli entegrasyon) ise ikisini her değişiklikte zorunlu kılar. İnsanlar da asıl önemli soruya odaklanır:
*Bu tasarım doğru mu?* Bu derste o araçları bir uzman gibi kullanmayı, sonra da tasarımın kendisini
güçlendiren iki kalıbı (typestate ve sealed trait) öğreneceksin.

## Clippy: derleyiciden sonraki ikinci göz

Önce küçük bir pretest. Aşağıdaki kod deneyimli bir Rust'çının kaşlarını çattırır. Peki **derlenir mi**?

```compiles
code: |
  fn ortalama(notlar: &Vec<u32>) -> f64 {
      if notlar.len() == 0 {
          return 0.0;
      }
      let toplam: u32 = notlar.iter().sum();
      return toplam as f64 / notlar.len() as f64;
  }

  fn main() {
      let notlar = vec![70, 85, 90];
      let ort = ortalama(&notlar);
      match Some(ort) {
          Some(o) => println!("{o:.1}"),
          _ => {}
      }
  }
answer: true
explanation: |
  Derlenir ve doğru çalışır: `81.7` yazar. `rustc`'nin görevi kodun **doğru ve güvenli** olduğunu
  denetlemektir; `return` kullanman, `&Vec` alman ya da `match` ile tek bir durumu yakalaman yanlış
  değildir. Ama `cargo clippy` bu küçük programda **dört** uyarı verir. Derlenen kod ile **idiomatik**
  kod arasındaki boşluğu clippy doldurur.
```

**Clippy** (Modül 1'de tanıştın), derleyicinin tip bilgisini kullanan 750'yi aşkın **lint** içerir. Python'daki
pylint ya da JavaScript'teki ESLint'e benzer, ama önemli bir farkla: clippy derleyicinin içinden çalışır,
yani her ifadenin **tipini** bilir. "Bu `match` bir `Option` üzerinde ve iki kolu `Some`→`Some`, `None`→`None`"
diyebilmesi bu yüzdendir.

Lint'ler **gruplara** ayrılır ve her grubun varsayılan seviyesi (Modül 16) farklıdır:

| Grup | Ne yakalar? | Varsayılan | Örnek lint |
|---|---|---|---|
| `correctness` | neredeyse kesin hata | **deny** (derlemeyi durdurur) | `approx_constant` (`3.14` yerine `PI`) |
| `suspicious` | büyük ihtimalle hata | warn | `suspicious_else_formatting` |
| `style` | idiomatik olmayan yazım | warn | `needless_return`, `len_zero` |
| `complexity` | basit şeyi karmaşık yapan kod | warn | `bool_comparison` (`x == true`) |
| `perf` | daha hızlı yazılabilecek kod | warn | `expect_fun_call`, `useless_vec` |
| `pedantic` | daha titiz, bazen yanlış pozitif | allow | `map_unwrap_or`, `cast_possible_truncation` |
| `nursery` | henüz olgunlaşmamış lint'ler | allow | `redundant_clone` (Ders 2) |
| `restriction` | proje politikası; tek tek seçilir | allow | `unwrap_used`, `print_stdout` |
| `cargo` | `Cargo.toml` meta verisi | allow | `cargo_common_metadata` |

Seviyelerin mantığı bir **maliyet-fayda** hesabıdır: `correctness` lint'i yanlış alarm verme ihtimali çok
düşük, kaçırma maliyeti çok yüksek olduğu için derlemeyi durdurur. `pedantic` lint'leri faydalıdır ama
bazen haklı bir kodu da işaretler; varsayılan olarak açık olsalar insanlar clippy'yi tamamen kapatırdı.
`restriction` ise "her zaman kötü" değil, "**bu projede** istemiyoruz" demektir (örneğin gömülü bir projede
`print_stdout`); grubu topluca açmak çelişkili kurallar (birbirinin tersini isteyen lint'ler) üretir.

:::analogy Araç muayenesi
Clippy bir araç muayene istasyonu gibidir. Fren tutmuyorsa (**correctness**) araç muayeneden geçemez.
Silecek lastiği eskimişse (**style**, **perf**) "hafif kusur" yazılır; araç geçer ama düzeltmen beklenir.
Titiz bir usta ayrıca "lastik basıncı biraz düşük" de der (**pedantic**); bunu dinlemek senin tercihin.
:::

Varsayılan olarak `deny` olan bir lint, derlenen kodu bile kırmızıya boyar. `main`'in ilk satırı
`let pi = 3.14;` olan bir programa `cargo clippy` uygulayınca:

:::error
```text
error: approximate value of `f{32, 64}::consts::PI` found
 --> src/main.rs:2:14
  |
2 |     let pi = 3.14;
  |              ^^^^
  |
  = help: consider using the constant directly
  = note: `#[deny(clippy::approx_constant)]` on by default
```
Son satır bu lint'in **hangi grupta ve hangi seviyede** olduğunu söyler. Çözüm: `std::f64::consts::PI`.
Clippy uyarılarının çoğunda bir `help:` satırı ve hazır bir düzeltme önerisi bulunur; `cargo clippy --fix`
bunların güvenli olanlarını senin yerine uygular.
:::

```quiz
question: |
  Ekibin, varsayılan lint'lerin ötesinde daha titiz bir denetim istiyor. Aşağıdakilerden hangisi
  **en sağlıklı** yaklaşımdır?
options:
  - "`#![deny(clippy::restriction)]` ile restriction grubunun tamamını açmak"
  - "`clippy::pedantic`'i `warn` seviyesinde açmak, projeye uymayan birkaç lint'i gerekçesiyle `allow` etmek ve `restriction`'dan yalnızca ihtiyaç duyulan lint'leri tek tek seçmek"
  - Clippy'yi kapatıp yalnızca derleyici uyarılarına güvenmek
  - "Tüm clippy uyarılarını `#![allow(clippy::all)]` ile susturup kod incelemesinde elle bakmak"
answer: 1
explanation: |
  `pedantic` faydalı ama gürültülü olabilir: onu açıp gerçekten uymayan birkaç lint'i
  `allow`/`expect` ile (gerekçe yazarak) kapatmak yaygın bir profesyonel ayardır. `restriction`
  grubu ise bir menü gibidir; içinde birbirinin tersini isteyen lint'ler bile vardır, bu yüzden clippy
  belgeleri de topluca açılmamasını söyler. Makinenin yapabileceği denetimi insana bırakmak ise
  incelemecinin zamanını boşa harcar.
feedback:
  - "Restriction lint'leri birbirleriyle çelişebilir (örn. biri `return`'ü yasaklar, diğeri ister); topluca açılmamalıdır."
  - Doğru! Pedantic'i aç, gürültüyü gerekçeyle kıs, restriction'dan tek tek seç.
  - Derleyici idiomları değil doğruluğu denetler; clippy'nin yakaladığı şeyleri kaçırırsın.
  - Bu, kırk yorumluk kod incelemesine geri dönmek demek.
```

## Okunabilirlik lint'leri: `needless_return`, `len_zero`, `ptr_arg`, `collapsible_if`

Pretest'teki `main`'in sonuna iç içe bir `if` ekleyelim:

```rust,ignore
    let aktif = true;
    if aktif {
        if ort > 50.0 {
            println!("geçti");
        }
    }
```

ve `cargo clippy` uygulayalım. Çıktı (kısaltılmış; `single_match` uyarısını birazdan ayrıca göreceğiz):

:::error
```text
warning: unneeded `return` statement
 --> src/main.rs:6:5
  |
6 |     return toplam as f64 / notlar.len() as f64;
  |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  |
  = note: `#[warn(clippy::needless_return)]` on by default
help: remove `return`
  |
6 -     return toplam as f64 / notlar.len() as f64;
6 +     toplam as f64 / notlar.len() as f64

warning: writing `&Vec` instead of `&[_]` involves a new object where a slice will do
 --> src/main.rs:1:21
  |
1 | fn ortalama(notlar: &Vec<u32>) -> f64 {
  |                     ^^^^^^^^^
  |
  = note: `#[warn(clippy::ptr_arg)]` on by default
help: change this to
  |
1 - fn ortalama(notlar: &Vec<u32>) -> f64 {
1 + fn ortalama(notlar: &[u32]) -> f64 {

warning: length comparison to zero
 --> src/main.rs:2:8
  |
2 |     if notlar.len() == 0 {
  |        ^^^^^^^^^^^^^^^^^ help: using `is_empty` is clearer and more explicit: `notlar.is_empty()`
  |
  = note: `#[warn(clippy::len_zero)]` on by default

warning: this `if` statement can be collapsed
  --> src/main.rs:17:5
   |
17 | /     if aktif {
18 | |         if ort > 50.0 {
19 | |             println!("geçti");
20 | |         }
21 | |     }
   | |_____^
   |
   = note: `#[warn(clippy::collapsible_if)]` on by default
help: collapse nested if block
   |
17 ~     if aktif
18 ~         && ort > 50.0 {
19 |             println!("geçti");
20 ~         }
```
Her uyarıda üç şey var: **ne** (başlık), **nerede** (`-->` satırı) ve çoğu zaman **nasıl düzeltilir**
(`help:`). Lint'in adı `note:` satırında yazar; adını bilmek, onu
gerektiğinde `#[expect(clippy::needless_return, reason = "...")]` ile susturabilmeni sağlar.
:::

Bu lint'ler "zevk" değil, her birinin bir **gerekçesi** var:

- **`needless_return`**: Rust ifade yönelimlidir (Modül 3); bloğun son ifadesi zaten değeridir. `return`'ü
  yalnızca **erken çıkış** için kullanırsan, kodu okuyan biri `return` gördüğü anda "dikkat, burada
  fonksiyon erken bitiyor" sinyalini alır. Her yerde `return` yazmak bu sinyali gürültüye çevirir. Bu yüzden
  aşağıdaki `return 0.0;` **kalır**: o bir erken çıkıştır.
- **`len_zero`**: `is_empty()` **niyeti** söyler ("boş mu?"), `len() == 0` ise bir hesaplamayı. Ayrıca bazı
  tiplerde boşluğu sormak, uzunluğu hesaplamaktan ucuzdur. Kendi koleksiyon tipin `len()` sunuyorsa
  `is_empty()` da sunmalısın; clippy'nin `len_without_is_empty` lint'i bunu hatırlatır (Ders 3'teki API
  tutarlılığı).
- **`ptr_arg`**: Ders 2'den: `&Vec<u32>` yalnızca `Vec` kabul eder; `&[u32]` ise `Vec`, dizi ve dilimlerin
  hepsini kabul eder. Üstelik `&Vec` çift dolaylama (referans → `Vec` başlığı → heap) demektir.
- **`collapsible_if`**: iç içe iki `if`, tek bir `&&` koşulunun okunması zor hâlidir. Edition 2024'te
  `if let Some(x) = secim && x > 3 { ... }` gibi **let zincirleri** de yazılabildiği için `if let` içeren
  iç içe yapılar da düzleşebilir.

```rust
fn ortalama(notlar: &[u32]) -> f64 {
    if notlar.is_empty() {
        return 0.0; // erken çıkış: return burada anlamlı
    }
    let toplam: u32 = notlar.iter().sum();
    f64::from(toplam) / notlar.len() as f64 // son ifade = dönüş değeri
}

fn main() {
    let notlar = vec![70, 85, 90];
    let ort = ortalama(&notlar);
    let aktif = true;
    if aktif && ort > 50.0 {
        println!("geçti: {ort:.1}");
    }
    println!("boş sınıf: {}", ortalama(&[])); // &[u32] sayesinde dizi de olur
}
```

`f64::from(toplam)` küçük bir bonus: `u32` → `f64` dönüşümü hiç bilgi kaybetmez, bu yüzden `From`
uygulanmıştır. `as` ise kayıplı dönüşümlere de sessizce izin verir; pedantic grubundaki `cast_lossless`
lint'i, kayıpsız durumlarda `From`'u önerir. Tip ileride değişirse (`u32` → `u64`), `From` derlenmeyi
bırakarak seni uyarır; `as` sessizce hassasiyet kaybeder.

```fill
prompt: Clippy uyarılarını gider, dilim parametresi, `is_empty` ve düzleştirilmiş `if`.
code: |
  fn ortalama(notlar: ___0) -> f64 {
      if notlar.___1 {
          return 0.0;
      }
      let toplam: u32 = notlar.iter().sum();
      f64::from(toplam) / notlar.len() as f64
  }

  fn main() {
      let notlar = vec![70, 85, 90];
      let ort = ortalama(&notlar);
      println!("{ort:.1}");
      println!("{:.1}", ortalama(&[]));
      let aktif = true;
      if aktif ___2 ort > 50.0 {
          println!("geçti");
      }
  }
blanks:
  - ["&[u32]"]
  - ["is_empty()"]
  - ["&&"]
output: |
  81.7
  0.0
  geçti
explanation: |
  `&[u32]` hem `&Vec<u32>`'yi (otomatik dönüşümle) hem de `&[]` gibi dizileri kabul eder.
  `is_empty()` niyeti açıkça söyler. İç içe iki `if` yerine tek koşul `aktif && ort > 50.0`
  yeterli; `&&` kısa devre yapar, yani `aktif` yanlışsa ikinci karşılaştırma hiç yapılmaz.
```

## `Option` kalıpları: `manual_map`, `single_match`, `map_unwrap_or`

En sık görülen clippy uyarıları, std'nin hazır sunduğu bir **birleştiriciyi** (combinator) elle yeniden
yazan kodlardır. Modül 7, 10 ve 14'ten tanıdığın `Option` metotlarını hatırla ve tahmin et:

```predict
code: |
  fn main() {
      let fiyat: u32 = 200;
      let indirim: Option<u32> = None;
      let kupon: Option<u32> = Some(15);

      let son = indirim.map_or(fiyat, |y| fiyat - fiyat * y / 100);
      let kuponlu = kupon.map(|y| fiyat - fiyat * y / 100);
      let ucuz_mu = kuponlu.is_some_and(|k| k < 180);

      println!("{son} {kuponlu:?} {ucuz_mu}");
  }
options:
  - "200 Some(170) true"
  - "200 170 true"
  - "None Some(170) true"
  - "200 Some(170) false"
answer: 0
explanation: |
  `map_or(varsayilan, f)`: `None` ise **varsayılanı** (200), `Some(y)` ise `f(y)`'yi döndürür.
  Dikkat: varsayılan **ilk** argümandır; `map(f).unwrap_or(v)` ile sıra terstir. `map` sonucu yine
  bir `Option`'dır (`Some(170)`), bu yüzden `{:?}` ile `Some(170)` yazar. `is_some_and(p)`, değer
  varsa ve koşulu sağlıyorsa `true` verir: 170 < 180.
```

Şimdi aynı işleri elle yapan bir programa bak. `map_unwrap_or` pedantic grubunda olduğu için grubu en
üstte açıyoruz:

```rust
#![warn(clippy::pedantic)]

fn iki_kat(x: Option<u32>) -> u32 {
    x.map(|v| v * 2).unwrap_or(0)
}

fn harf(puan: Option<u32>) -> Option<char> {
    match puan {
        Some(p) => Some(if p >= 50 { 'G' } else { 'K' }),
        None => None,
    }
}

fn main() {
    println!("{}", iki_kat(Some(4)));
    match harf(Some(70)) {
        Some(h) => println!("{h}"),
        _ => {}
    }
}
```

`cargo clippy` çıktısı (kısaltılmış):

:::error
```text
warning: called `map(<f>).unwrap_or(<a>)` on an `Option` value
 --> src/main.rs:4:5
  |
4 |     x.map(|v| v * 2).unwrap_or(0)
  |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  |
  = note: `#[warn(clippy::map_unwrap_or)]` implied by `#[warn(clippy::pedantic)]`
help: use `map_or(<a>, <f>)` instead
  |
4 -     x.map(|v| v * 2).unwrap_or(0)
4 +     x.map_or(0, |v| v * 2)

warning: manual implementation of `Option::map`
  --> src/main.rs:8:5
   |
 8 | /     match puan {
 9 | |         Some(p) => Some(if p >= 50 { 'G' } else { 'K' }),
10 | |         None => None,
11 | |     }
   | |_____^ help: try: `puan.map(|p| if p >= 50 { 'G' } else { 'K' })`
   |
   = note: `#[warn(clippy::manual_map)]` on by default

warning: you seem to be trying to use `match` for destructuring a single pattern. Consider using `if let`
  --> src/main.rs:16:5
   |
16 | /     match harf(Some(70)) {
17 | |         Some(h) => println!("{h}"),
18 | |         _ => {}
19 | |     }
   | |_____^ help: try: `if let Some(h) = harf(Some(70)) { println!("{h}") }`
   |
   = note: `#[warn(clippy::single_match)]` on by default
```
`note:` satırlarına dikkat: ilk lint pedantic grubundan geldiği için "implied by `#[warn(clippy::pedantic)]`"
diyor; diğer ikisi varsayılan olarak açık.
:::

- **`manual_map`** (style): `Some(x) => Some(f(x)), None => None` deseni, `Option::map`'in tanımının ta
  kendisidir. `map` yazınca okuyan kişi tek kelimede "değer varsa dönüştür" anlar. Clippy akıllıdır: kollarda
  `return`, `?` ya da `break` varsa öneri yapmaz, çünkü bunlar closure içinde **dış** fonksiyondan çıkamaz.
- **`single_match`** (style): `_ => {}` kolu "diğer durumlar umurumda değil" demektir; `if let` bunu doğrudan
  söyler. Ama dikkat: tüm varyantları **bilinçli olarak** ele almak istiyorsan `match` kalmalı; yeni bir
  varyant eklendiğinde derleyicinin seni uyarması (Modül 7) değerli bir güvencedir.
- **`map_unwrap_or`** (pedantic): `map_or(varsayılan, f)` tek adımdır. Varsayılan bir `bool` ise clippy bir
  adım daha ileri gider: `map_or(false, |k| k <= 50)` için `unnecessary_map_or` lint'i `is_some_and(|k| k <= 50)`
  önerir.

Bir de **perf** grubundan iki tanıdık: `expect(&format!("..."))` mesajı hata olmasa bile **her seferinde**
biçimlendirir (`expect_fun_call`; öneri `unwrap_or_else(|| panic!("..."))`), `vec![1, 2, 3]` yalnızca okunacaksa
heap tahsisi gereksizdir (`useless_vec`; öneri `[1, 2, 3]`). İkisi de Ders 1-2'deki "gereksiz iş yapma"
fikrinin otomatik denetimidir.

Şimdi bir kod incelemesi senaryosu: CI kırmızı yanıyor ve sana düzeltme görevi düştü.

```exercise
id: m25-e-karne-clippy
title: "Clippy temizliği: karne modülü"
difficulty: 2
prompt: |
  Okulun karne modülü **çalışıyor** ama CI'daki `cargo clippy -- -D warnings` adımı kırmızı. Aşağıdaki
  dört fonksiyonu **davranışlarını değiştirmeden** idiomatik hâle getir:

  - `ortalama`: parametre `&[u32]` olsun (`ptr_arg`); `len() == 0` yerine `is_empty()` (`len_zero`);
    son satırdaki gereksiz `return`'ü kaldır (`needless_return`).
  - `harf_notu`: elle yazılmış `match`'i `Option::map` ile yaz (`manual_map`).
  - `rozet`: iç içe `if`'leri tek koşulda birleştir (`collapsible_if`), `len() > 0` yerine `!is_empty()`.
  - `karne_satiri`: gereksiz `clone`'u kaldır; `Option<char>`'ı `String`'e çevirip `unwrap_or` yapmak yerine
    doğrudan `unwrap_or('-')` kullan.

  `main`'deki `match` de `single_match` uyarısı veriyor; onu `if let` yap. Testler davranışın aynı
  kaldığını, kurallar da uyarıların gittiğini denetler.
starter: |
  struct Ogrenci {
      ad: String,
      notlar: Vec<u32>,
  }

  fn ortalama(notlar: &Vec<u32>) -> Option<f64> {
      if notlar.len() == 0 {
          return None;
      }
      let toplam: u32 = notlar.iter().sum();
      return Some(f64::from(toplam) / notlar.len() as f64);
  }

  fn harf_notu(ort: Option<f64>) -> Option<char> {
      match ort {
          Some(o) => Some(if o >= 85.0 {
              'A'
          } else if o >= 70.0 {
              'B'
          } else if o >= 50.0 {
              'C'
          } else {
              'F'
          }),
          None => None,
      }
  }

  fn rozet(ogrenci: &Ogrenci) -> &'static str {
      if ogrenci.notlar.len() > 0 {
          if ogrenci.notlar.iter().all(|&n| n >= 85) {
              return "onur listesi";
          }
      }
      "-"
  }

  fn karne_satiri(ogrenci: &Ogrenci) -> String {
      let ad = ogrenci.ad.clone();
      let harf = harf_notu(ortalama(&ogrenci.notlar))
          .map(|h| h.to_string())
          .unwrap_or(String::from("-"));
      format!("{ad}: {harf} {}", rozet(ogrenci))
  }

  fn main() {
      let sinif = vec![
          Ogrenci { ad: String::from("Ayşe"), notlar: vec![90, 88, 95] },
          Ogrenci { ad: String::from("Mert"), notlar: vec![] },
      ];
      for o in &sinif {
          println!("{}", karne_satiri(o));
      }
      match sinif.first() {
          Some(ilk) => println!("ilk: {}", ilk.ad),
          _ => {}
      }
  }
solution: |
  struct Ogrenci {
      ad: String,
      notlar: Vec<u32>,
  }

  fn ortalama(notlar: &[u32]) -> Option<f64> {
      if notlar.is_empty() {
          return None;
      }
      let toplam: u32 = notlar.iter().sum();
      Some(f64::from(toplam) / notlar.len() as f64)
  }

  fn harf_notu(ort: Option<f64>) -> Option<char> {
      ort.map(|o| {
          if o >= 85.0 {
              'A'
          } else if o >= 70.0 {
              'B'
          } else if o >= 50.0 {
              'C'
          } else {
              'F'
          }
      })
  }

  fn rozet(ogrenci: &Ogrenci) -> &'static str {
      if !ogrenci.notlar.is_empty() && ogrenci.notlar.iter().all(|&n| n >= 85) {
          "onur listesi"
      } else {
          "-"
      }
  }

  fn karne_satiri(ogrenci: &Ogrenci) -> String {
      let harf = harf_notu(ortalama(&ogrenci.notlar)).unwrap_or('-');
      format!("{}: {harf} {}", ogrenci.ad, rozet(ogrenci))
  }

  fn main() {
      let sinif = vec![
          Ogrenci { ad: String::from("Ayşe"), notlar: vec![90, 88, 95] },
          Ogrenci { ad: String::from("Mert"), notlar: vec![] },
      ];
      for o in &sinif {
          println!("{}", karne_satiri(o));
      }
      if let Some(ilk) = sinif.first() {
          println!("ilk: {}", ilk.ad);
      }
  }
check: tests
tests: |
  fn ogr(ad: &str, notlar: &[u32]) -> Ogrenci {
      Ogrenci { ad: ad.to_string(), notlar: notlar.to_vec() }
  }

  #[test]
  fn ortalama_dilim_alir_ve_bos_icin_none_dondurur() {
      assert_eq!(ortalama(&[]), None, "boş not listesinin ortalaması yoktur");
      assert_eq!(ortalama(&[70, 80, 90]), Some(80.0));
      let v = vec![50, 51];
      assert_eq!(ortalama(&v), Some(50.5), "&Vec<u32> de &[u32] parametresine verilebilmeli");
  }

  #[test]
  fn harf_notu_sinirlari_korunur() {
      assert_eq!(harf_notu(Some(85.0)), Some('A'), "85 dahil A'dır");
      assert_eq!(harf_notu(Some(84.9)), Some('B'));
      assert_eq!(harf_notu(Some(50.0)), Some('C'), "50 dahil C'dir");
      assert_eq!(harf_notu(Some(49.9)), Some('F'));
      assert_eq!(harf_notu(None), None, "not yoksa harf de yoktur");
  }

  #[test]
  fn rozet_ve_karne_satiri_ayni_davranir() {
      let ayse = ogr("Ayşe", &[90, 88, 95]);
      let can = ogr("Can", &[90, 60]);
      let mert = ogr("Mert", &[]);
      assert_eq!(rozet(&ayse), "onur listesi");
      assert_eq!(rozet(&can), "-", "notlardan biri 85'in altındaysa rozet yok");
      assert_eq!(rozet(&mert), "-", "notu olmayan öğrenci onur listesine giremez (boşluk kontrolünü unutma!)");
      assert_eq!(karne_satiri(&ayse), "Ayşe: A onur listesi");
      assert_eq!(karne_satiri(&can), "Can: B -", "ortalama 75 → B");
      assert_eq!(karne_satiri(&mert), "Mert: - -");
  }
hints:
  - "Önce imzayı değiştir: `fn ortalama(notlar: &[u32]) -> Option<f64>`. `return None;` bir erken çıkış olduğu için kalabilir; yalnızca son satırdaki `return Some(...)` gereksiz."
  - "`harf_notu`: `ort.map(|o| if o >= 85.0 { 'A' } else if ... { ... } else { 'F' })`. `rozet`: `if !ogrenci.notlar.is_empty() && ogrenci.notlar.iter().all(|&n| n >= 85) { \"onur listesi\" } else { \"-\" }`."
  - "`karne_satiri`: `let harf = harf_notu(ortalama(&ogrenci.notlar)).unwrap_or('-');` ve `format!(\"{}: {harf} {}\", ogrenci.ad, rozet(ogrenci))`. `main`'de `if let Some(ilk) = sinif.first() { ... }`."
forbid:
  - pattern: "&Vec<"
    message: "clippy::ptr_arg, `&Vec<u32>` yerine `&[u32]` al."
  - pattern: "\\.len\\(\\)\\s*(==|!=|>)\\s*0\\b"
    message: "clippy::len_zero, uzunluğu sıfırla karşılaştırma; `is_empty()` kullan."
  - pattern: "return\\s+Some\\("
    message: "clippy::needless_return, son ifade `return` olmadan yazılır."
  - pattern: "None\\s*=>\\s*None"
    message: "clippy::manual_map, `Some(x) => Some(..), None => None` yerine `Option::map` kullan."
  - pattern: "if [^{}]*\\{\\s*if\\s"
    message: "clippy::collapsible_if, iç içe iki `if`'i `&&` ile tek koşulda birleştir."
  - pattern: "_\\s*=>\\s*\\{\\s*\\}"
    message: "clippy::single_match, tek durumu yakalamak için `if let` kullan."
  - pattern: "\\.clone\\(\\)"
    message: "Gereksiz `clone`: `format!` argümanlarını ödünç alır, `ogrenci.ad`'ı kopyalamana gerek yok."
  - pattern: "unwrap_or\\((String::from|\"[^\"]*\"\\.to_string)"
    message: "`Option<char>` üzerinde doğrudan `unwrap_or('-')` yeterli; ara `String` üretme."
explanation: |
  Hiçbir test değişmedi ve hepsi geçiyor: bu bir **yeniden düzenleme** (refactoring), yani davranış aynı,
  ifade daha iyi. Kod hem kısaldı hem de niyeti daha net söylüyor: `map` "değer varsa dönüştür",
  `unwrap_or('-')` "yoksa tire koy", `if let` "yalnızca bu durum önemli".

  `rozet`'teki boşluk kontrolü süs değil: `iter().all(..)` **boş** bir dizide `true` döner (matematikteki
  "boş küme her koşulu sağlar" ilkesi). Kontrolü silseydin, hiç notu olmayan Mert onur listesine girerdi;
  testlerden biri tam bunu yakalıyor. `&&` kısa devre yaptığı için sıralama da önemli: önce boşluk, sonra
  `all`.

  Gerçek bir projede bu düzeltmelerin çoğunu `cargo clippy --fix` yapar; ama hangi önerinin neden doğru
  olduğunu bilmek, otomatik düzeltmenin yanlış olduğu nadir durumları fark etmeni sağlar.
```

## rustfmt ve CI kontrol listesi

**rustfmt** (Modül 1 ve 16) kodu resmî Rust stiline göre biçimlendirir. Go'daki `gofmt`, Python'daki
`black` ve JavaScript'teki `prettier` ile aynı felsefe: **stil bir karar değil, bir araç çıktısıdır.**
Kazancı estetik değil, ekonomiktir:

- Kod incelemesindeki **diff**'ler yalnızca anlamlı değişiklikleri gösterir; "biri girintiyi değiştirmiş"
  gürültüsü kalmaz.
- Başka bir Rust projesine geçtiğinde kod tanıdık görünür; okuma hızın artar.
- "Süslü parantez nereye" tartışması (bikeshedding) tamamen biter.

Çoğu proje varsayılan stili kullanır; gerekirse kök dizinde küçük bir `rustfmt.toml`:

```toml
# rustfmt.toml - ne kadar az ayar, o kadar ortak stil
edition = "2024"
max_width = 100
```

Şimdi her şeyi birleştirelim. Profesyonel bir Rust deposunda her push ve pull request şu dört adımdan
geçer. Sıralama bilinçlidir: **en hızlı ve en ucuz** kontrol önce çalışır, böylece basit bir hata için
dakikalarca test beklemezsin.

| # | Komut | Neyi yakalar? |
|---|---|---|
| 1 | `cargo fmt --all --check` | biçimlendirilmemiş dosya (saniyeler) |
| 2 | `cargo clippy --all-targets --all-features -- -D warnings` | idiom, performans ve doğruluk lint'leri; testler ve örnekler dahil |
| 3 | `cargo test --all-features` | birim, entegrasyon **ve** doc testleri (Modül 13) |
| 4 | `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps` | kırık belge bağlantıları, hatalı doc yorumları |

GitHub Actions ile aynı liste:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  kontrol:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - run: cargo fmt --all --check
      - run: cargo clippy --all-targets --all-features -- -D warnings
      - run: cargo test --all-features
      - run: cargo doc --no-deps --all-features
        env:
          RUSTDOCFLAGS: -D warnings
```

:::warning İki klasik CI tuzağı
1. **`cargo test --all-targets` doc testlerini çalıştırmaz.** `--all-targets` "lib, bin, test, bench ve
   example" demektir; doc testleri bu listede yoktur. `--all-targets` kullanıyorsan ayrıca
   `cargo test --doc` ekle (ya da adım 3'teki gibi bayraksız `cargo test` çalıştır).
2. **`-D warnings` CI'da olur, kaynak kodda değil.** `lib.rs`'e `#![deny(warnings)]` yazarsan, yeni bir Rust
   sürümü yeni bir uyarı eklediği gün kütüphaneni kullanan **herkesin** derlemesi kırılabilir. Kuralları
   `Cargo.toml`'daki `[lints]` tablosuna (Modül 16), sertliği ise CI'ın komut satırına koy.
:::

İsteğe bağlı ama yaygın ek adımlar: `cargo audit` ya da `cargo deny` (güvenlik açığı ve lisans denetimi),
MSRV'de derleme (Modül 16), `unsafe` içeren crate'lerde `cargo miri test` (Modül 24) ve Ders 1'deki
benchmark'ların performans gerilemesi takibi.

````quiz
question: |
  Bir kütüphanede şu satırı görüyorsun:

  ```rust
  #[expect(clippy::too_many_arguments, reason = "C API'sinin imzasını birebir yansıtıyor")]
  fn cizim_baslat(x: i32, y: i32, w: i32, h: i32, renk: u32, kalinlik: u8, dolu: bool, z: i16) {}
  ```

  Birkaç ay sonra biri fonksiyonu sadeleştirip argüman sayısını 4'e indiriyor. Modül 16'yı hatırla:
  ne olur?
options:
  - Hiçbir şey; `expect` tıpkı `allow` gibi lint'i sessizce kapatır
  - "Derleyici `unfulfilled_lint_expectations` uyarısı verir: beklenen lint artık tetiklenmiyor, öznitelik gereksizleşti"
  - Kod derlenmez; `expect` lint'in mutlaka tetiklenmesini zorunlu kılan bir `deny` seviyesidir
answer: 1
explanation: |
  `#[expect(...)]`, `allow` gibi lint'i susturur; ama lint **artık tetiklenmiyorsa** bunu bir uyarıyla
  bildirir. Böylece eski susturmalar kod tabanında unutulup birikmez. `reason = "..."` ise gelecekteki
  okuyucuya bu istisnanın **neden** yapıldığını anlatır. CI'da `-D warnings` olduğu için bu uyarı
  pipeline'ı da kırmızıya çevirir; temizlik zorunlu hâle gelir.
feedback:
  - "`allow` öyle davranır; `expect`'in farkı gereksizleştiğinde uyarmasıdır."
  - Doğru! `expect`, kendini temizlemeyi hatırlatan bir `allow`'dur.
  - "`expect` yalnızca bir **uyarı** üretir; CI'da `-D warnings` varsa o zaman hata olur."
````

## Kalıp tekrarı: typestate

Clippy ve rustfmt kodun **yüzeyini** düzeltir. Bir sonraki kalite seviyesi, hataları **tip sistemine**
yaptırmaktır. Modül 20'de durum desenini önce trait nesneleriyle, sonra her durumu ayrı bir struct yaparak
**typestate** ile yazmıştın. Modül 22'deki `PhantomData` ile aynı fikir daha da derli toplu yazılabilir:
durum, bir **tip parametresidir**.

```rust
use std::marker::PhantomData;

// Durumlar: alanı olmayan, sıfır boyutlu "işaret" tipleri
struct Sepette;
struct Odendi;
struct Kargoda;

struct Siparis<S> {
    tutar: u32,
    _durum: PhantomData<S>,
}

impl Siparis<Sepette> {
    fn yeni(tutar: u32) -> Self {
        Siparis { tutar, _durum: PhantomData }
    }

    fn ode(self) -> Siparis<Odendi> {
        Siparis { tutar: self.tutar, _durum: PhantomData }
    }
}

impl Siparis<Odendi> {
    fn kargola(self) -> Siparis<Kargoda> {
        Siparis { tutar: self.tutar, _durum: PhantomData }
    }
}

impl<S> Siparis<S> {
    // her durumda geçerli metotlar
    fn tutar(&self) -> u32 {
        self.tutar
    }
}

fn main() {
    let s = Siparis::yeni(250);
    let s = s.ode();
    let s = s.kargola();
    println!("kargodaki sipariş: {} TL", s.tutar());
}
```

Geçiş metotları `self`'i **tüketir** (Modül 4): eski durum taşındığı için bir daha kullanılamaz. Ödenmemiş
bir siparişi kargolamaya çalışırsan ne olur?

```compiles
code: |
  use std::marker::PhantomData;

  struct Sepette;
  struct Odendi;
  struct Kargoda;

  struct Siparis<S> {
      tutar: u32,
      _durum: PhantomData<S>,
  }

  impl Siparis<Sepette> {
      fn yeni(tutar: u32) -> Self {
          Siparis { tutar, _durum: PhantomData }
      }
  }

  impl Siparis<Odendi> {
      fn kargola(self) -> Siparis<Kargoda> {
          Siparis { tutar: self.tutar, _durum: PhantomData }
      }
  }

  fn main() {
      let s = Siparis::yeni(250);
      let s = s.kargola();
      println!("{}", s.tutar);
  }
answer: false
error: E0599
explanation: |
  `kargola` yalnızca `Siparis<Odendi>` için tanımlı; `Siparis<Sepette>` üzerinde **böyle bir metot yok**.
  "Ödenmeden kargolanamaz" iş kuralı bir `if` ya da çalışma zamanı kontrolü değil, bir **derleme hatası**
  oldu. Derleyicinin notu bile yol gösteriyor: metot `Siparis<Odendi>` için bulundu.
```

:::error
```text
error[E0599]: no method named `kargola` found for struct `Siparis<Sepette>` in the current scope
  --> src/main.rs:26:15
   |
 7 | struct Siparis<S> {
   | ----------------- method `kargola` not found for this struct
...
26 |     let s = s.kargola();
   |               ^^^^^^^ method not found in `Siparis<Sepette>`
   |
   = note: the method was found for `Siparis<Odendi>`
```
:::

Peki bu güvenliğin çalışma zamanında bir bedeli var mı? Modül 24'teki bellek düzeni bilgini kullan:

```predict
code: |
  use std::marker::PhantomData;
  use std::mem::size_of;

  struct Sepette;
  struct Odendi;

  # #[allow(dead_code)]
  struct Siparis<S> {
      tutar: u32,
      _durum: PhantomData<S>,
  }

  fn main() {
      println!("{}", size_of::<Sepette>());
      println!("{}", size_of::<Siparis<Sepette>>());
      println!("{}", size_of::<Siparis<Odendi>>() == size_of::<u32>());
  }
options:
  - |
    0
    4
    true
  - |
    1
    5
    false
  - |
    0
    8
    false
answer: 0
explanation: |
  Alanı olmayan `Sepette` bir **sıfır boyutlu tiptir** (ZST): 0 bayt. `PhantomData<S>` de 0 bayttır;
  yalnızca derleyiciye "bu tip `S`'yi kullanıyor" der. Sonuçta `Siparis<Sepette>` ile `Siparis<Odendi>`
  bellekte birebir bir `u32` kadardır. Durum bilgisi **yalnızca derleme zamanında** vardır: tam bir
  sıfır maliyetli soyutlama (Ders 1).
```

```memory
title: Siparis<Odendi> bellekte
steps:
  - caption: "Durum tipi yalnızca derleyicinin kafasında: bellekte sadece `tutar` var. `_durum` 0 bayt yer kaplar."
    stack:
      - frame: main
        vars:
          - { name: s, type: "Siparis<Odendi>", value: "tutar=250 · _durum (0 bayt)", note: "toplam 4 bayt" }
  - caption: "`s.kargola()` sonrası: aynı 4 bayt yeni bir tiple yeniden adlandırıldı; eski `s` taşındı."
    stack:
      - frame: main
        vars:
          - { name: s, type: "Siparis<Odendi>", value: "tutar=250", moved: true, note: taşındı }
          - { name: s, type: "Siparis<Kargoda>", value: "tutar=250 · _durum (0 bayt)", note: "toplam 4 bayt" }
```

Typestate her yerde doğru seçim değildir. Durumu çalışma zamanında belirleniyorsa (veritabanından okunan
bir sipariş) ya da farklı durumdaki nesneleri tek bir `Vec`'te tutman gerekiyorsa, durumu bir **enum**'la
temsil etmek (Modül 7) daha uygundur. Typestate'in yeri, **API kullanıcısının** yanlış sırayla çağrı
yapmasını engellemek istediğin builder'lar, bağlantılar ve protokollerdir.

## Sealed trait: kullanılabilen ama uygulanamayan trait

Yukarıdaki tasarımda bir eksik var. Durumların hepsinde ortak bir şey istersek (örneğin her durumun bir
adı), bir trait tanımlarız: `pub trait Durum { const AD: &'static str; }`. Bu trait kütüphanenin public
API'sinde olduğu anda iki sorun doğar:

1. **Kullanıcılar kendi durumlarını uydurabilir:** `struct Hayalet; impl Durum for Hayalet {...}` ve artık
   `Siparis<Hayalet>` diye senin hiç tasarlamadığın bir durum var.
2. **Trait'i bir daha genişletemezsin:** trait'e yeni bir zorunlu metot eklemek, onu uygulamış **herkesin**
   kodunu kırar (semver'de breaking change).

Çözüm **sealed (mühürlü) trait** kalıbıdır: trait'e, dışarıdan **adı bile anılamayan** bir supertrait
(Modül 22) eklenir.

```rust
mod magaza {
    mod gizli {
        // pub ama `gizli` modülü dışarıya kapalı: dışarıdan adı yazılamaz
        pub trait Muhur {}
    }

    pub trait Durum: gizli::Muhur {
        const AD: &'static str;
    }

    pub struct Sepette;
    pub struct Odendi;

    impl gizli::Muhur for Sepette {}
    impl gizli::Muhur for Odendi {}

    impl Durum for Sepette {
        const AD: &'static str = "sepette";
    }
    impl Durum for Odendi {
        const AD: &'static str = "ödendi";
    }

    pub fn durum_adi<S: Durum>() -> &'static str {
        S::AD
    }
}

fn main() {
    // Trait'i KULLANMAK serbest:
    println!("{}", magaza::durum_adi::<magaza::Sepette>());
    println!("{}", magaza::durum_adi::<magaza::Odendi>());
}
```

Kullanıcı tarafından bakınca `Durum` sıradan bir public trait: sınır olarak yazılabilir, metotları
çağrılabilir. Peki dışarıdan uygulamaya çalışırsa?

```compiles
code: |
  mod magaza {
      mod gizli {
          pub trait Muhur {}
      }

      pub trait Durum: gizli::Muhur {
          const AD: &'static str;
      }

      pub struct Sepette;
      impl gizli::Muhur for Sepette {}
      impl Durum for Sepette {
          const AD: &'static str = "sepette";
      }
  }

  struct Iptal;

  impl magaza::Durum for Iptal {
      const AD: &'static str = "iptal";
  }

  fn main() {
      println!("{}", <magaza::Sepette as magaza::Durum>::AD);
  }
answer: false
error: E0277
explanation: |
  `Durum`'u uygulamak için önce supertrait'i `gizli::Muhur`'u uygulaman gerekir; ama `gizli` modülü
  `magaza`'ya özeldir, dışarıdan `magaza::gizli::Muhur` yazmayı denersen `E0603` (private module)
  alırsın. Yani `Iptal` için `Muhur`'u uygulamanın **hiçbir yolu yok**, dolayısıyla `Durum`'u da.
```

:::error
```text
error[E0277]: the trait bound `Iptal: Muhur` is not satisfied
  --> src/main.rs:19:24
   |
19 | impl magaza::Durum for Iptal {
   |                        ^^^^^ unsatisfied trait bound
   |
help: the trait `Muhur` is not implemented for `Iptal`
  --> src/main.rs:17:1
   |
17 | struct Iptal;
   | ^^^^^^^^^^^^
help: the trait `Muhur` is implemented for `Sepette`
  --> src/main.rs:11:5
   |
11 |     impl gizli::Muhur for Sepette {}
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
note: required by a bound in `Durum`
  --> src/main.rs:6:22
   |
 6 |     pub trait Durum: gizli::Muhur {
   |                      ^^^^^^^^^^^^ required by this bound in `Durum`
   = note: `Durum` is a "sealed trait", because to implement it you also need to implement
           `magaza::gizli::Muhur`, which is not accessible; this is usually done to force you
           to use one of the provided types that already implement it
   = help: the following type implements the trait:
             magaza::Sepette
```
Kalıp o kadar yaygın ki derleyici onu **adıyla** tanıyor ve kullanıcıya "bu trait mühürlü, hazır
tiplerden birini kullan" diye açıklıyor.
:::

:::analogy Apartman anahtarı
Mühürlü bir trait, apartmanın ana kapısı gibidir. Kapıdan herkes girip çıkabilir (trait'i **kullanmak**),
ama anahtarı çoğaltma yetkisi yalnızca yönetimdedir (trait'i **uygulamak**). Yönetim kilidi değiştirmek
isterse (trait'e yeni metot eklemek), sadece kendi dağıttığı anahtarları yenilemesi yeterlidir; kimsenin
kapıda kalması (kodunun kırılması) söz konusu olmaz.
:::

Gerçek dünyadan örnekler: std'de dilim indekslemeyi sağlayan `SliceIndex` trait'i bu yöntemle mühürlüdür;
`v[1..3]` yazarken onu kullanırsın ama kendi indeks tipin için uygulayamazsın. Bir trait'i mühürlediğinde
belgesine de "Bu trait mühürlüdür; crate dışında uygulanamaz." diye yazmak iyi bir alışkanlıktır.

:::warning Mühür crate sınırında işler
Gizlilik **modül** temellidir: bir öğenin özel öğelerine kendisi ve **alt modülleri** erişebilir. Bu yüzden
gerçek bir kütüphanede `mod gizli` genellikle crate kökünde durur; aynı crate'teki her kod mührü açabilir
(sen kütüphanenin yazarısın, bu doğal), ama crate'i **bağımlılık** olarak kullanan kimse açamaz. Burada tek
dosyada çalıştığımız için sınırı `magaza` modülüyle taklit ediyoruz.
:::

Şimdi typestate ile mührü birleştir:

```exercise
id: m25-e-muhurlu-odeme
title: Mühürlü durumlarla ödeme akışı
difficulty: 4
prompt: |
  Bir ödeme kütüphanesi yazıyorsun. Bir ödeme `Beklemede` → `Onaylandi` → `IadeEdildi` yolunu izler ve
  durumlar `Odeme<S>` tipinin parametresiyle temsil edilir (typestate).

  1. **Mühürle:** `Durum` trait'ini `gizli::Muhur` supertrait'iyle mühürle ve üç durum tipi için
     `Muhur`'u uygula. Böylece kütüphane dışından kimse yeni bir durum uyduramaz.
  2. `onayla(self)`: `Odeme<Beklemede>`'yi `Odeme<Onaylandi>`'ya çevirir.
  3. `iade_et(self, miktar)`: yalnızca onaylanmış ödemede bulunur. `miktar` 0 ise ya da `tutar`'dan büyükse
     iade **reddedilir** ve ödeme **olduğu gibi** `Err(self)` ile geri verilir (kaybolmasın!). Aksi hâlde
     `iade` alanı `miktar` olan bir `Odeme<IadeEdildi>` döner.
  4. `ozet(&self)`: her durumda çalışır ve `"<tutar> TL (<durum adı>)"` döndürür; durum adını
     `S::AD`'den al. Örnek: `"250 TL (onaylandı)"`.
starter: |
  mod odeme {
      use std::marker::PhantomData;

      mod gizli {
          pub trait Muhur {}
      }

      // 1) Bu trait'i mühürle
      pub trait Durum {
          const AD: &'static str;
      }

      pub struct Beklemede;
      pub struct Onaylandi;
      pub struct IadeEdildi;

      impl Durum for Beklemede {
          const AD: &'static str = "beklemede";
      }
      impl Durum for Onaylandi {
          const AD: &'static str = "onaylandı";
      }
      impl Durum for IadeEdildi {
          const AD: &'static str = "iade edildi";
      }

      pub struct Odeme<S> {
          tutar: u32,
          iade: u32,
          _durum: PhantomData<S>,
      }

      impl Odeme<Beklemede> {
          pub fn yeni(tutar: u32) -> Self {
              Odeme { tutar, iade: 0, _durum: PhantomData }
          }

          pub fn onayla(self) -> Odeme<Onaylandi> {
              todo!()
          }
      }

      impl Odeme<Onaylandi> {
          pub fn iade_et(self, miktar: u32) -> Result<Odeme<IadeEdildi>, Odeme<Onaylandi>> {
              todo!()
          }
      }

      impl Odeme<IadeEdildi> {
          pub fn iade_miktari(&self) -> u32 {
              self.iade
          }
      }

      impl<S: Durum> Odeme<S> {
          pub fn ozet(&self) -> String {
              todo!()
          }
      }
  }

  fn main() {
      let o = odeme::Odeme::yeni(250);
      println!("{}", o.ozet());
      let o = o.onayla();
      println!("{}", o.ozet());
      match o.iade_et(400) {
          Ok(i) => println!("{} · iade: {} TL", i.ozet(), i.iade_miktari()),
          Err(o) => println!("iade reddedildi, ödeme hâlâ: {}", o.ozet()),
      }
  }
solution: |
  mod odeme {
      use std::marker::PhantomData;

      mod gizli {
          pub trait Muhur {}
      }

      pub trait Durum: gizli::Muhur {
          const AD: &'static str;
      }

      pub struct Beklemede;
      pub struct Onaylandi;
      pub struct IadeEdildi;

      impl gizli::Muhur for Beklemede {}
      impl gizli::Muhur for Onaylandi {}
      impl gizli::Muhur for IadeEdildi {}

      impl Durum for Beklemede {
          const AD: &'static str = "beklemede";
      }
      impl Durum for Onaylandi {
          const AD: &'static str = "onaylandı";
      }
      impl Durum for IadeEdildi {
          const AD: &'static str = "iade edildi";
      }

      pub struct Odeme<S> {
          tutar: u32,
          iade: u32,
          _durum: PhantomData<S>,
      }

      impl Odeme<Beklemede> {
          pub fn yeni(tutar: u32) -> Self {
              Odeme { tutar, iade: 0, _durum: PhantomData }
          }

          pub fn onayla(self) -> Odeme<Onaylandi> {
              Odeme { tutar: self.tutar, iade: 0, _durum: PhantomData }
          }
      }

      impl Odeme<Onaylandi> {
          pub fn iade_et(self, miktar: u32) -> Result<Odeme<IadeEdildi>, Odeme<Onaylandi>> {
              if miktar == 0 || miktar > self.tutar {
                  return Err(self);
              }
              Ok(Odeme { tutar: self.tutar, iade: miktar, _durum: PhantomData })
          }
      }

      impl Odeme<IadeEdildi> {
          pub fn iade_miktari(&self) -> u32 {
              self.iade
          }
      }

      impl<S: Durum> Odeme<S> {
          pub fn ozet(&self) -> String {
              format!("{} TL ({})", self.tutar, S::AD)
          }
      }
  }

  fn main() {
      let o = odeme::Odeme::yeni(250);
      println!("{}", o.ozet());
      let o = o.onayla();
      println!("{}", o.ozet());
      match o.iade_et(400) {
          Ok(i) => println!("{} · iade: {} TL", i.ozet(), i.iade_miktari()),
          Err(o) => println!("iade reddedildi, ödeme hâlâ: {}", o.ozet()),
      }
  }
check: tests
tests: |
  use crate::odeme::Odeme;

  #[test]
  fn onaylama_durumu_degistirir() {
      let o = Odeme::yeni(250);
      assert_eq!(o.ozet(), "250 TL (beklemede)");
      let o = o.onayla();
      assert_eq!(o.ozet(), "250 TL (onaylandı)", "onaylanan ödemenin durum adı değişmeli, tutar korunmalı");
  }

  #[test]
  fn gecerli_iade_yapilir() {
      let o = Odeme::yeni(300).onayla();
      let Ok(i) = o.iade_et(120) else {
          panic!("300 TL'lik ödemede 120 TL iade kabul edilmeli");
      };
      assert_eq!(i.ozet(), "300 TL (iade edildi)");
      assert_eq!(i.iade_miktari(), 120, "iade alanı istenen miktarı tutmalı");
      let Ok(tam) = Odeme::yeni(75).onayla().iade_et(75) else {
          panic!("tutarın tamamı iade edilebilmeli (sınır dahil)");
      };
      assert_eq!(tam.iade_miktari(), 75);
  }

  #[test]
  fn gecersiz_iade_odemeyi_geri_verir() {
      let o = Odeme::yeni(300).onayla();
      let Err(geri) = o.iade_et(301) else {
          panic!("tutardan büyük iade reddedilmeli");
      };
      assert_eq!(geri.ozet(), "300 TL (onaylandı)", "reddedilen iade ödemeyi değiştirmeden geri vermeli");
      let Err(geri) = geri.iade_et(0) else {
          panic!("0 TL iade anlamsızdır, reddedilmeli");
      };
      assert!(geri.iade_et(300).is_ok(), "geri verilen ödeme hâlâ iade edilebilmeli");
  }
hints:
  - "Mühür için iki adım: `pub trait Durum: gizli::Muhur { ... }` ve her durum için `impl gizli::Muhur for Beklemede {}` (üç tane)."
  - "Geçişlerde yeni bir struct kur: `Odeme { tutar: self.tutar, iade: 0, _durum: PhantomData }`. Dönüş tipi hangi durumu istediğini zaten söylüyor; `PhantomData`'nın tipini derleyici çıkarır."
  - "`iade_et`: `if miktar == 0 || miktar > self.tutar { return Err(self); }` sonra `Ok(Odeme { tutar: self.tutar, iade: miktar, _durum: PhantomData })`. `ozet`: `format!(\"{} TL ({})\", self.tutar, S::AD)`."
require:
  - pattern: "trait\\s+Durum\\s*:\\s*(self::)?gizli::Muhur"
    message: "`Durum` trait'ini `gizli::Muhur` supertrait'iyle mühürlemelisin: `pub trait Durum: gizli::Muhur`."
explanation: |
  Bu küçük kütüphane, üç farklı hatayı **derleme zamanında** imkânsız kılıyor:

  - Beklemedeki bir ödeme iade edilemez: `iade_et` yalnızca `Odeme<Onaylandi>`'da var (typestate).
  - Kütüphane dışından `Odeme<Hayalet>` gibi bir durum uydurulamaz: `Durum` mühürlü (sealed trait).
  - `iade_miktari` yalnızca iade edilmiş ödemede çağrılabilir; diğer durumlarda "0" gibi yanıltıcı bir
    değer döndürmek zorunda kalmıyoruz.

  `iade_et`'in `Result<Odeme<IadeEdildi>, Odeme<Onaylandi>>` döndürmesi Modül 20'deki typestate
  alışkanlığıdır: başarısız geçiş, `self`'i tükettiği için ödemeyi **kaybetmemek** adına eski durumu
  `Err` içinde geri verir. Test de tam bunu denetliyor: reddedilen ödeme yeniden iade edilebiliyor.

  Durum tipleri sıfır boyutlu olduğundan `Odeme<S>` her durumda yalnızca iki `u32` kadar yer kaplar;
  `S::AD` de derleme zamanında bilinen bir sabittir. Güvenlik tamamen bedava.
```

## Özet

:::remember
- **Clippy grupları:** `correctness` (deny), `suspicious`/`style`/`complexity`/`perf` (warn), `pedantic`/`nursery`/`restriction`/`cargo` (allow). Pedantic'i aç + gerekçeyle `allow`/`expect`; restriction'dan tek tek seç.
- Sık lint'ler: `needless_return` (son ifade dönüş değeridir), `len_zero` (`is_empty`), `ptr_arg` (`&[T]`), `collapsible_if` (`&&`), `manual_map` (`Option::map`), `single_match` (`if let`), `map_unwrap_or` (`map_or(varsayılan, f)`).
- **rustfmt**: stil bir araç çıktısıdır; ayarları minimumda tut, CI'da `cargo fmt --check`.
- **CI sırası:** fmt → clippy `-D warnings` → test (doc testleri dahil!) → doc `RUSTDOCFLAGS=-D warnings`. `#![deny(warnings)]` kaynağa değil, `-D warnings` CI'a.
- **Typestate:** durum = tip parametresi + ZST işaretler + `self` tüketen geçişler; geçersiz çağrı = E0599, bedeli 0 bayt.
- **Sealed trait:** `pub trait T: gizli::Muhur` → herkes kullanır, yalnızca crate uygular; trait'i kırmadan genişletebilirsin.
:::

:::ferris
Bir uzman Rust'çıyı ayıran şey, yazdığı kodun hiç hata yapmaması değil; hataların **olamayacağı** bir
tasarım kurması ve geri kalanını araçlara bırakmasıdır. Artık o araçlar senin de cebinde! 🦀
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla - bir projede kalite neden "kod incelemesinde dikkat etmek" yerine
  araçlara (clippy, rustfmt, CI) ve tip sistemine (typestate, sealed trait) emanet edilmeli?
  Her birinin hangi tür hatayı, ne zaman yakaladığını karşılaştır.
answer: |
  Model cevap: İnsan dikkati pahalı ve tutarsızdır: yorgun bir incelemeci gereksiz bir `return`'ü de, bir
  biçim hatasını da kaçırabilir; üstelik bu yorumlar asıl önemli tasarım tartışmasından zaman çalar.
  rustfmt biçimi, clippy idiomları ve şüpheli kalıpları her değişiklikte saniyeler içinde ve **her seferinde
  aynı şekilde** denetler; CI da bunu zorunlu kılar, kimse "unutamaz". Tip sistemi ise bir adım daha
  öndedir: typestate yanlış sırayla çağrıyı, sealed trait istenmeyen trait uygulamasını **derleme
  zamanında**, kodu yazan kişi daha kaydet tuşuna basarken engeller. Hata ne kadar erken yakalanırsa
  düzeltmesi o kadar ucuzdur: derleme zamanı < CI < kod incelemesi < üretim.
```

```flashcards
- front: Clippy'de varsayılan olarak `deny` seviyesinde olan grup hangisidir ve neden?
  back: "`correctness`: neredeyse kesin hata yakalar; yanlış alarm ihtimali düşük, kaçırmanın bedeli yüksek."
- front: "`clippy::pedantic` neden varsayılan olarak kapalıdır?"
  back: Faydalı ama daha titiz; bazen haklı kodu da işaretler (yanlış pozitif). Açık olsa insanlar clippy'yi tamamen kapatırdı.
- front: "`match o { Some(x) => Some(f(x)), None => None }` için clippy hangi lint'i verir, düzeltme ne?"
  back: "`manual_map` → `o.map(f)` (ya da `o.map(|x| f(x))`)."
- front: "`x.map(f).unwrap_or(v)` yerine idiomatik yazım nedir? Argüman sırası?"
  back: "`x.map_or(v, f)`, varsayılan **ilk** argüman (`map_unwrap_or`, pedantic)."
- front: "`cargo test --all-targets` hangi testleri çalıştırmaz?"
  back: Doc testlerini. Ayrıca `cargo test --doc` eklenmeli ya da bayraksız `cargo test` kullanılmalı.
- front: "Kütüphane kaynağına `#![deny(warnings)]` koymak neden kötü bir fikirdir?"
  back: Yeni bir Rust/clippy sürümü yeni uyarı ekleyince kütüphaneyi kullanan herkesin derlemesi kırılabilir. `-D warnings` CI'da verilmeli.
- front: "Typestate'te `Siparis<Sepette>` ile `Siparis<Odendi>` bellekte ne kadar farklıdır?"
  back: "Hiç: durum tipleri sıfır boyutlu, `PhantomData` 0 bayt. Fark yalnızca derleme zamanında var."
- front: Sealed trait nasıl kurulur ve ne sağlar?
  back: "`pub trait T: gizli::Muhur` (`gizli` özel modül). Herkes kullanabilir, yalnızca crate uygulayabilir; trait kullanıcıları kırmadan genişletilebilir."
```
