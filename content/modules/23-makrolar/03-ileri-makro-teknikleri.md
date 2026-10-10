---
id: m23-l03
title: İleri makro teknikleri
minutes: 24
type: lesson
objectives:
  - Özyinelemeli makrolarla değişken sayıda argümanı işleyebilmek ve her girdinin yalnızca bir kez değerlendirilmesini sağlayabilmek
  - Makro hijyeninin hangi isimleri koruduğunu (yerel değişkenler) ve hangilerini korumadığını (fonksiyon, tip gibi öğeler) açıklayabilmek
  - "`#[macro_export]`, `$crate` ve kapsam kurallarını kullanarak bir makroyu modüller ve crate'ler arasında doğru paylaşabilmek"
  - İç kurallar (`@`) ve TT munching ile küçük bir dili ayrıştırabilmek; makro hatalarını `cargo expand` ve `stringify!` ile ayıklayabilmek
keywords: [özyineleme, hijyen, hygiene, "$crate", macro_export, iç kurallar, TT munching, cargo expand, compile_error!]
---

Artık tekrarlarla `vec!` benzeri makrolar yazabiliyorsun. Gerçek dünyadaki makrolar ise bir adım
öteye gider: **kendini çağırır**, değişken isimlerinin birbirine karışmasını **hijyen** sayesinde
engeller, başka crate'lere **dışa aktarılır** ve token'ları teker teker "yiyerek" küçük diller ayrıştırır.
Bu derste bu teknikleri, sık yapılan hatalarla birlikte öğreneceksin.

## Özyineleme: makro kendini çağırır

Bir makro, dönüştürücüsünde **kendini** çağırabilir. Modül 4'te gördüğün özyinelemeli fonksiyonlar gibi bir
**temel durum** (base case) ve bir **özyinelemeli durum** gerekir:

```rust
macro_rules! en_buyuk {
    ($x:expr) => {
        $x
    };
    ($x:expr, $($kalan:expr),+) => {{
        let a = $x;
        let b = en_buyuk!($($kalan),+);
        if a > b { a } else { b }
    }};
}

fn main() {
    println!("{}", en_buyuk!(7));
    println!("{}", en_buyuk!(3, 9, 4));
    println!("{}", en_buyuk!(2.5, -1.0, 2.75, 0.0));
}
```

`en_buyuk!(3, 9, 4)` adım adım şöyle genişler:

```text
en_buyuk!(3, 9, 4)
→ { let a = 3; let b = en_buyuk!(9, 4); if a > b { a } else { b } }
→ { let a = 3; let b = { let a = 9; let b = en_buyuk!(4); ... }; ... }
→ { let a = 3; let b = { let a = 9; let b = 4; ... }; ... }      // temel durum: tek argüman
```

Özyineleme, `tt` ile birleşince **sayma** gibi işler de yapabilir. Sonuç bir sabit ifade olduğu için
dizi boyutu gibi derleme zamanı değeri gereken yerlerde bile kullanılabilir:

```rust
macro_rules! say {
    () => {
        0usize
    };
    ($bas:tt $($kalan:tt)*) => {
        1usize + say!($($kalan)*)
    };
}

const OYUNCU_SAYISI: usize = say!(Ali Ayse Can Deniz);

fn main() {
    let puanlar = [0u32; OYUNCU_SAYISI];
    println!("{} oyuncu, {} puan kutusu", OYUNCU_SAYISI, puanlar.len());
}
```

:::error Özyineleme sınırı
Temel durumu unutursan ya da girdi hiç küçülmezse makro sonsuza dek kendini çağırır. Derleyici varsayılan
olarak **128** iç içe genişlemeden sonra durur:
```text
error: recursion limit reached while expanding `sonsuz!`
 --> src/main.rs:2:22
  |
2 |     ($($t:tt)*) => { sonsuz!($($t)* x) };
  |                      ^^^^^^^^^^^^^^^^^
  |
  = help: consider increasing the recursion limit by adding a `#![recursion_limit = "256"]` attribute to your crate (`playground`)
```
Sınırı artırmak bazen gerekir (çok uzun girdiler), ama önce temel durumunun doğru olduğundan emin ol.
:::

Şimdi en_buyuk!'ün neden ilk önce değerleri `let a = $x;` ile bir değişkene bağladığını anlayalım.
Daha "kısa" bir sürüm yazalım. **Tahmin et:**

```predict
code: |
  fn sayi_ver(n: i32) -> i32 {
      println!("hesaplandı: {n}");
      n
  }

  macro_rules! buyuk_saf {
      ($a:expr, $b:expr) => {
          if $a > $b { $a } else { $b }
      };
  }

  fn main() {
      let m = buyuk_saf!(sayi_ver(5), sayi_ver(3));
      println!("sonuç: {m}");
  }
options:
  - |
    hesaplandı: 5
    hesaplandı: 3
    sonuç: 5
  - |
    hesaplandı: 5
    hesaplandı: 3
    hesaplandı: 5
    sonuç: 5
  - |
    hesaplandı: 5
    sonuç: 5
answer: 1
explanation: |
  Makro **değerleri** değil **kodu** kopyalar. `$a` dönüştürücüde iki kez geçtiği için
  `sayi_ver(5)` de iki kez çalıştırılır: bir kez karşılaştırmada, bir kez sonucu döndürürken.
  Bu, C'nin meşhur `#define MAX(a, b) ((a) > (b) ? (a) : (b))` hatasıdır: `MAX(i++, j)` yazınca
  `i` iki kez artar. Yan etkili ya da pahalı bir ifadede bu hem yanlış hem yavaştır.
feedback:
  - "`$a` dönüştürücüde **iki kez** geçiyor; makro ifadeyi her geçtiği yere kopyalar."
  - Doğru! `$a` iki kez kopyalandı, `sayi_ver(5)` iki kez çalıştı.
  - "`$b` de karşılaştırmada değerlendiriliyor; ayrıca `$a` iki kez kopyalanıyor."
```

:::remember
Dönüştürücüde bir `$x:expr`'i birden fazla kez kullanacaksan, önce **bir kez** değerlendirip bir
değişkene bağla: `let a = $x;`. Standart kütüphanedeki `assert_eq!` de aynı amaçla
`match (&$sol, &$sag) { (sol, sag) => ... }` kullanır.
:::

## Hijyen: makronun değişkenleri sızmaz

`let a = $x;` yazmak tehlikeli değil mi? Ya çağıranın da `a` adında bir değişkeni varsa? **Tahmin et:**

```predict
code: |
  macro_rules! iki_kati {
      ($e:expr) => {{
          let x = 2;
          x * $e
      }};
  }

  fn main() {
      let x = 10;
      println!("{}", iki_kati!(x + 1));
  }
options:
  - "22"
  - "6"
  - "5"
answer: 0
explanation: |
  Sonuç **22**'dir: `2 * (10 + 1)`. Makronun içindeki `x` ile çağıranın verdiği `x + 1`'deki `x`
  **farklı** değişkenlerdir. Rust her ismi, **yazıldığı yerin** bilgisiyle (sözdizimi bağlamı / syntax
  context) birlikte taşır. Buna **hijyen (hygiene)** denir. Hijyen olmasaydı `x * x + 1` ya da
  `2 * (2 + 1)` gibi bir karışıklık olurdu.
feedback:
  - Doğru! İki `x` birbirine karışmaz.
  - Bu, makronun `x`'inin çağıranın `x`'ini "yakaladığı" hijyensiz bir dünyada olurdu.
  - Bu, C önişlemcisinin metin kopyalama davranışı olurdu (hem hijyen hem gruplama yok).
```

:::analogy Renkli mürekkep
Her ismin bir **mürekkep rengi** olduğunu düşün. Makronun içinde yazılan `x` **mavi**, çağıranın yazdığı
`x` **kırmızı** mürekkeple yazılmış. Derleyici isimleri yalnızca harflerine değil **renklerine** de
bakarak eşleştirir. Mavi `let x = 2;` yalnızca mavi `x`'leri etkiler; kırmızı `x` çağıranın `10`'udur.
:::

Hijyen iki yönde çalışır: Makro, çağıranın değişkenlerini de **göremez**. Şu kod derlenir mi?

```compiles
code: |
  macro_rules! artir {
      () => {
          sayac += 1;
      };
  }

  fn main() {
      let mut sayac = 0;
      artir!();
      println!("{sayac}");
  }
answer: false
error: E0425
explanation: |
  Makronun içindeki `sayac` makronun "renginde"; `main`'deki `sayac`'ı göremez. Derleyici bunu
  `E0425: cannot find value` ile bildirir ve hatta sebebini de söyler: "not accessible due to macro hygiene".
```

:::error Hijyen hatası
```text
error[E0425]: cannot find value `sayac` in this scope
 --> src/main.rs:3:9
  |
3 |         sayac += 1;
  |         ^^^^^ not found in this scope
...
9 |     artir!();
  |     -------- in this macro invocation
  |
help: an identifier with the same name exists, but is not accessible due to macro hygiene
 --> src/main.rs:8:13
  |
8 |     let mut sayac = 0;
  |             ^^^^^
```
:::

Çözüm: Makronun dokunacağı değişkeni **açıkça** ver. `ident` olarak gelen isim çağıranın rengini taşır:

```rust
macro_rules! artir {
    ($degisken:ident) => {
        $degisken += 1;
    };
}

fn main() {
    let mut sayac = 0;
    artir!(sayac);
    artir!(sayac);
    println!("{sayac}");
}
```

Bu bir özelliktir: Makroya bakmadan da hangi değişkenlerin değişebileceğini çağrıdan okuyabilirsin.
C'de `#define SWAP(a, b) { int tmp = a; a = b; b = tmp; }` gibi bir makro, değişkenlerinden birinin adı
`tmp` olduğunda sessizce yanlış çalışır. Rust'ta bu imkânsızdır.

:::warning Hijyen her şeyi kapsamaz
`macro_rules!` hijyeni **karma (mixed-site)** hijyendir: yalnızca **yerel değişkenler**, **döngü
etiketleri** ve `$crate` makronun tanımlandığı yerde çözülür. **Fonksiyonlar, tipler, modüller, sabitler
ve diğer makrolar** ise makronun **çağrıldığı yerde** aranır. 1. dersteki `karsilama_fonksiyonu!`'nın
ürettiği `karsila` fonksiyonunu dışarıdan çağırabilmen bu yüzdendi. Aynı sebeple makronun içinde
çağırdığın bir yardımcı fonksiyon, makroyu kullanan yerde **bulunamayabilir**; çözümü bir sonraki adımda.
:::

```exercise
id: m23-e-en-kucuk
title: Her argümanı bir kez değerlendiren en_kucuk!
difficulty: 3
prompt: |
  Bir oyunda oyuncuların tur süreleri farklı yerlerden geliyor ve en kısa süreyi bulmak istiyorsun.
  `en_kucuk!` makrosunu tamamla:

  - `en_kucuk!(5)` → `5`
  - `en_kucuk!(4, 2, 8)` → `2` (istediğin kadar argüman)
  - Tamsayılar, negatif sayılar ve `f64`'lerle çalışmalı.
  - **Her argüman yalnızca bir kez değerlendirilmeli.** Testlerden biri `kuyruk.pop().unwrap()` gibi
    yan etkili bir ifade veriyor; iki kez çalışırsa kuyruktan fazladan eleman çıkar.
starter: |
  macro_rules! en_kucuk {
      ($x:expr) => {
          $x
      };
      // birden fazla argüman için özyinelemeli bir kol ekle
  }

  fn main() {
      println!("{}", en_kucuk!(42));
  }
solution: |
  macro_rules! en_kucuk {
      ($x:expr) => {
          $x
      };
      ($x:expr, $($kalan:expr),+) => {{
          let ilk = $x;
          let digerleri = en_kucuk!($($kalan),+);
          if ilk < digerleri { ilk } else { digerleri }
      }};
  }

  fn main() {
      println!("{}", en_kucuk!(42));
      println!("{}", en_kucuk!(31, 27, 45));
  }
check: tests
tests: |
  #[test]
  fn tek_argumani_aynen_dondurur() {
      assert_eq!(en_kucuk!(5), 5);
  }

  #[test]
  fn coklu_argumanda_en_kucugu_bulur() {
      assert_eq!(en_kucuk!(4, 2, 8), 2, "4, 2, 8 içinde en küçük 2");
      assert_eq!(en_kucuk!(9, 7, 3, 5, 1, 6), 1, "en küçük sondan ikinci sırada olsa da bulunmalı");
  }

  #[test]
  fn negatif_ve_ondalik_sayilarla_calisir() {
      assert_eq!(en_kucuk!(-3, 0, -10), -10);
      assert_eq!(en_kucuk!(2.5, 1.5, 3.0), 1.5);
  }

  #[test]
  fn her_argumani_bir_kez_degerlendirir() {
      let mut kuyruk = vec![30, 10, 20];
      let m = en_kucuk!(kuyruk.pop().unwrap(), 25);
      assert_eq!(m, 20, "kuyruktan çıkan ilk eleman 20; 20 ile 25'in küçüğü 20");
      assert_eq!(kuyruk.len(), 2, "pop() yalnızca BİR kez çağrılmalı; argümanı bir değişkene bağla");
  }
hints:
  - "İkinci kolun eşleştiricisi: ilk ifade, bir virgül ve en az bir ifade daha: `($x:expr, $($kalan:expr),+)`."
  - "Dönüştürücüde kalanlar için makroyu yeniden çağır: `en_kucuk!($($kalan),+)`. Birden çok deyim yazacağın için `{{ ... }}` kullan."
  - "Önce `let ilk = $x;` ve `let digerleri = en_kucuk!(...);` yaz, sonra yalnızca bu değişkenleri karşılaştır: `if ilk < digerleri { ilk } else { digerleri }`."
explanation: |
  Özyineleme her adımda bir argümanı ayırıyor (`$x`) ve kalanları yeniden makroya veriyor; tek argüman
  kaldığında temel durum devreye giriyor. `let ilk = $x;` ifadeyi **bir kez** değerlendirip sonucu bağlıyor;
  karşılaştırmada ve dönüşte artık yalnızca bu değişken kullanılıyor. Hijyen sayesinde `ilk` ve
  `digerleri` isimleri çağıranın değişkenleriyle asla çakışmıyor; iç içe genişlemelerde bile her
  seviyenin kendi `ilk`'i var.

  Alternatif: `match ($x, en_kucuk!($($kalan),+)) { (a, b) => if a < b { a } else { b } }`.
  Bu da her ifadeyi bir kez değerlendirir; standart kütüphanedeki `assert_eq!` bu kalıbı kullanır.
  Gerçek kodda tabii ki `[a, b, c].iter().min()` (Modül 14) veya `a.min(b)` (Modül 2) çoğu zaman yeterlidir;
  burada amaç özyinelemeli makro kalıbını oturtmak.
```

## Kapsam ve paylaşım: sıra, modüller, `#[macro_export]`, `$crate`

Fonksiyonları dosyanın herhangi bir yerinde tanımlayıp her yerden çağırabilirsin. Makrolar farklıdır:

```compiles
code: |
  fn main() {
      selam!();
  }

  macro_rules! selam {
      () => {
          println!("Merhaba!");
      };
  }
answer: false
explanation: |
  `macro_rules!` makroları **metinsel kapsam (textual scope)** kuralına uyar: Bir makro, kaynak kodda
  tanımlandığı satırdan **sonra** kullanılabilir. Derleyici çok yardımsever bir mesaj verir:
  "consider moving the definition of `selam` before this call".
```

:::error Tanımdan önce kullanım
```text
error: cannot find macro `selam` in this scope
 --> src/main.rs:2:5
  |
2 |     selam!();
  |     ^^^^^ consider moving the definition of `selam` before this call
  |
note: a macro with the same name exists, but it appears later
```
:::

Metinsel kapsam alt modüllere de akar ama bir modülün **dışına çıkmaz**. Bir modülde tanımladığın
makroyu dışarıda kullanmanın iki yolu var. Eski yol, modülün üstüne `#[macro_use]` koymaktır; modern
ve önerilen yol ise makroyu tanımından sonra `use` ile **yol tabanlı** bir öğe hâline getirmektir:

```rust
mod araclar {
    macro_rules! kare {
        ($x:expr) => {
            $x * $x
        };
    }

    pub(crate) use kare;
}

fn main() {
    println!("{}", araclar::kare!(7));
}
```

Peki makroyu **başka crate'lere** açmak istersen? `#[macro_export]` attribute'u makroyu, hangi modülde
yazılmış olursa olsun, **crate'in köküne** yerleştirir ve dışarıya açar. Böyle bir makronun içinde
yardımcı fonksiyonlara `$crate::` ile erişilir:

```rust
mod gunluk {
    pub fn yaz(seviye: &str, mesaj: String) {
        println!("[{seviye}] {mesaj}");
    }

    #[macro_export]
    macro_rules! bilgi {
        ($($arg:tt)*) => {
            $crate::gunluk::yaz("BİLGİ", format!($($arg)*))
        };
    }
}

fn main() {
    let kullanici = "deniz";
    bilgi!("{} giriş yaptı", kullanici);
    crate::bilgi!("{kullanici} 3 dosya yükledi");
}
```

`$($arg:tt)*` "ne gelirse gelsin, hepsini `format!`'a aktar" demektir. `println!` sarmalayan makrolar
hep böyle yazılır. İkinci çağrıdaki `{kullanici}` da çalışıyor; çünkü o string literal'i **çağıran**
yazdı, dolayısıyla çağıranın değişkenlerini görüyor (hijyen!).

Gerçek bir kütüphanede yapı şöyle olur:

```rust,ignore,title=gunluk/src/lib.rs
#[doc(hidden)]
pub fn __yaz(seviye: &str, mesaj: String) {
    println!("[{seviye}] {mesaj}");
}

#[macro_export]
macro_rules! bilgi {
    ($($arg:tt)*) => {
        $crate::__yaz("BİLGİ", format!($($arg)*))
    };
}
```

```rust,ignore,title=uygulama/src/main.rs
use gunluk::bilgi; // #[macro_export] makrolar crate kökünden içe aktarılır

fn main() {
    bilgi!("sunucu {} portunda başladı", 8080);
}
```

Dikkat edilecekler:

- `$crate` makronun **tanımlandığı** crate'e çözülür: kütüphanenin içinden çağrılınca `crate`, dışarıdan
  çağrılınca `::gunluk` olur.
- Makro, kullanıcının crate'inde genişler; bu yüzden içinde kullanılan yardımcı fonksiyon **`pub`**
  olmalıdır. Kullanıcıya görünmesini istemediğin yardımcılar genellikle `#[doc(hidden)]` ile belgelerden
  gizlenir ve `__` ile başlayan bir isim alır.
- Standart kütüphane öğeleri için de başına `::` koy (`::std::collections::HashMap`). Böylece
  kullanıcının `std` adında kendi modülü olsa bile yanlış yere gidilmez.

```quiz
question: |
  Bir kütüphanede `#[macro_export]` ile dışa açtığın makronun içinde yardımcı fonksiyonu
  `crate::__yaz(...)` diye çağırıyorsun. Başka bir crate bu makroyu kullanınca ne olur?
options:
  - "Sorun olmaz; makronun içinde `crate::` her zaman makronun tanımlandığı crate'i gösterir"
  - "`crate::` makronun **çağrıldığı** crate'e çözülür; orada `__yaz` yoksa hata alınır. Doğrusu `$crate::__yaz`"
  - "`crate::` makro içinde hiç kullanılamaz, tanım derlenmez"
answer: 1
explanation: |
  Modül 8'de `crate::`'in "bu crate'in kökü" anlamına geldiğini öğrenmiştin. Ama makro **çağıranın**
  crate'inde genişler ve `crate` gibi yollar karma hijyen yüzünden çağrı yerinde çözülür. Böylece
  `crate::__yaz` kullanıcının crate'ini gösterir. `$crate` ise tam bu sorun için vardır: her zaman
  makroyu **tanımlayan** crate'i gösterir.
feedback:
  - "Makro kendi crate'i içinde kullanıldığında bu doğru görünür; hata ancak başka bir crate kullanınca ortaya çıkar."
  - Doğru!
  - "`crate::` makroda yazılabilir; sorun nereye çözüldüğüdür."
```

## İç kurallar ve TT munching

Önceki dersteki `sepet!` alıştırmasında ayrı bir `varsayilan!` yardımcı makrosu kullanmıştık. Bunun
yerine yardımcı kolları makronun **içine** koyabiliriz. Gelenek, bu **iç kuralları (internal rules)**
`@` ile başlayan bir etiketle işaretlemektir. `@` bir ifadenin, literal'in ya da ismin başlangıcı
olamayacağı için bu kollar normal çağrılarla asla karışmaz:

```rust
macro_rules! sepet {
    (@adet) => { 1 };
    (@adet $n:expr) => { $n };
    ( $( $urun:literal $( x $adet:expr )? ),* $(,)? ) => {{
        #[allow(unused_mut)]
        let mut liste: Vec<(&str, u32)> = Vec::new();
        $( liste.push(($urun, sepet!(@adet $( $adet )?))); )*
        liste
    }};
}

fn main() {
    println!("{:?}", sepet!["simit" x 4, "çay"]);
}
```

İç kurallar, makroların en güçlü tekniğinin de temelidir: **TT munching** ("token ağacı çiğneme").
Fikir, Modül 21'deki `[bas, kalan @ ..]` dilim deseniyle yaptığın özyinelemeye çok benzer: Girdinin
**başından** birkaç token'ı al, işle, **kalanını** yeniden makroya ver. Bir **biriktirici (accumulator)**
de sonucu taşır:

```rust
macro_rules! puan {
    (@topla $acc:expr ;) => {
        $acc
    };
    (@topla $acc:expr ; + $($kalan:tt)*) => {
        puan!(@topla $acc + 1 ; $($kalan)*)
    };
    (@topla $acc:expr ; - $($kalan:tt)*) => {
        puan!(@topla $acc - 1 ; $($kalan)*)
    };
    ($($t:tt)*) => {
        puan!(@topla 0 ; $($t)*)
    };
}

fn main() {
    // jüri oyları: + beğendi, - beğenmedi
    println!("{}", puan!(+ + - + +));
}
```

```text
puan!(+ + - + +)
→ puan!(@topla 0 ; + + - + +)        // giriş kolu biriktiriciyi 0 ile başlatır
→ puan!(@topla 0 + 1 ; + - + +)      // baştaki + yendi
→ puan!(@topla 0 + 1 + 1 ; - + +)
→ puan!(@topla 0 + 1 + 1 - 1 ; + +)
→ ...
→ puan!(@topla 0 + 1 + 1 - 1 + 1 + 1 ;)   // girdi bitti → temel durum
→ 0 + 1 + 1 - 1 + 1 + 1                    // = 3
```

:::info TT munching'in bedeli
Her adımda kalan bütün token'lar yeniden eşleştirilir; bu yüzden girdi uzadıkça derleme süresi
kabaca **karesel** artar ve özyineleme sınırına (128) takılabilirsin. Kısa DSL'ler için harikadır;
yüzlerce token'lık girdiler için prosedürel makrolar (bir sonraki ders) daha uygundur.
:::

```quiz
question: "`puan!` makrosunda giriş kolu `($($t:tt)*)` en **üste** taşınırsa ne olur?"
options:
  - Hiçbir şey değişmez; kolların sırası önemsizdir
  - "`@topla` ile yapılan iç çağrıları da o yakalar ve her seferinde başa bir `@topla 0 ;` daha ekler; sonunda özyineleme sınırına takılır"
  - Derleyici iç kuralların `@` ile başladığını anlar ve onları önceliklendirir
answer: 1
explanation: |
  `$($t:tt)*` **her şeyle** eşleşir, `@topla ...` dahil. İlk uyan kol kazandığı için iç kurallara hiç
  sıra gelmez; makro durmadan kendini çağırır ve `recursion limit reached` hatası alırsın. Kural:
  iç kurallar (ve diğer özel kollar) **önce**, her şeyi yakalayan genel kol **en sonda**.
feedback:
  - "1. dersten hatırla: kollar yukarıdan aşağıya denenir, ilk uyan kazanır."
  - Doğru!
  - "`@` sadece bir gelenektir; derleyici için sıradan bir token'dır."
```

```fill
prompt: |
  Bir robotun hareket listesinden net adım sayısını hesaplayan `adimlar!` makrosunu tamamla:
  `ileri` +1, `geri` -1 sayılır.
code: |
  macro_rules! adimlar {
      (@say $n:expr ;) => { $n };
      (@say $n:expr ; ileri $($kalan:tt)*) => { adimlar!(@say $n + 1 ; $($kalan)*) };
      (@say $n:expr ; ___0 $($kalan:tt)*) => { adimlar!(@say $n - 1 ; ___1) };
      ($($t:tt)*) => { adimlar!(@say ___2 ; $($t)*) };
  }

  fn main() {
      println!("{}", adimlar!(ileri ileri geri ileri ileri));
  }
blanks:
  - ["geri"]
  - ["$($kalan)*"]
  - ["0"]
output: "3"
explanation: |
  `geri` kolu `ileri` kolunun aynısı, sadece `- 1` ekliyor. Kalan token'lar `$($kalan)*` ile olduğu gibi
  bir sonraki adıma aktarılıyor. Giriş kolu biriktiriciyi `0` ile başlatıyor:
  `0 + 1 + 1 - 1 + 1 + 1` = **3**.
```

````exercise
id: m23-e-hesap
title: Kelimelerle hesap makinesi
difficulty: 4
prompt: |
  Çocuklar için bir matematik uygulamasında işlemler **kelimelerle** yazılıyor ve basit bir hesap
  makinesi gibi **soldan sağa** hesaplanıyor (işlem önceliği yok):

  ```text
  hesap!(5 arti 3 carpi 2)    →  (5 + 3) * 2 = 16
  hesap!(2 arti 3 carpi 4)    →  (2 + 3) * 4 = 20   (14 değil!)
  hesap!(10 eksi 4 eksi 3)    →  3
  hesap!(42)                  →  42
  ```

  Desteklenecek kelimeler: `arti`, `eksi`, `carpi`. Sayılar tamsayı literal'leridir (`-5` de olabilir).
  TT munching kullan: İç kural bir biriktirici taşısın, her adımda bir "işlem + sayı" çiftini yesin.
starter: |
  macro_rules! hesap {
      ($($t:tt)*) => {
          todo!()
      };
  }

  fn main() {
      let sonuc: i32 = hesap!(5 arti 3 carpi 2);
      println!("{sonuc}");
  }
solution: |
  macro_rules! hesap {
      (@adim $acc:expr ;) => {
          $acc
      };
      (@adim $acc:expr ; arti $x:literal $($kalan:tt)*) => {
          hesap!(@adim ($acc + $x) ; $($kalan)*)
      };
      (@adim $acc:expr ; eksi $x:literal $($kalan:tt)*) => {
          hesap!(@adim ($acc - $x) ; $($kalan)*)
      };
      (@adim $acc:expr ; carpi $x:literal $($kalan:tt)*) => {
          hesap!(@adim ($acc * $x) ; $($kalan)*)
      };
      ($ilk:literal $($kalan:tt)*) => {
          hesap!(@adim $ilk ; $($kalan)*)
      };
  }

  fn main() {
      let sonuc: i32 = hesap!(5 arti 3 carpi 2);
      println!("{sonuc}");
  }
check: tests
tests: |
  #[test]
  fn tek_sayi() {
      assert_eq!(hesap!(42), 42, "tek bir sayı kendisine eşit olmalı");
  }

  #[test]
  fn soldan_saga_hesaplar() {
      assert_eq!(hesap!(5 arti 3 carpi 2), 16);
      assert_eq!(hesap!(2 arti 3 carpi 4), 20, "işlem önceliği yok: önce 2 + 3, sonra * 4");
  }

  #[test]
  fn eksi_ile_calisir() {
      assert_eq!(hesap!(10 eksi 4 eksi 3), 3);
  }

  #[test]
  fn uzun_zincir_ve_negatif_sayi() {
      assert_eq!(hesap!(1 arti 1 arti 1 arti 1 carpi 10), 40);
      assert_eq!(hesap!(-5 arti 2 carpi 3), -9, "(-5 + 2) * 3 = -9");
  }
hints:
  - "Giriş kolu ilk sayıyı alıp biriktiriciyi başlatsın: `($ilk:literal $($kalan:tt)*) => { hesap!(@adim $ilk ; $($kalan)*) };`. Bu kol en **sonda** olmalı."
  - "Her işlem için bir iç kural: `(@adim $acc:expr ; arti $x:literal $($kalan:tt)*) => { hesap!(@adim ($acc + $x) ; $($kalan)*) };`. `eksi` ve `carpi` için de aynısını yaz."
  - "Temel durumu unutma: girdi bitince biriktiriciyi döndür: `(@adim $acc:expr ;) => { $acc };`. `$acc:expr`'den sonra `;` gelebildiği için follow-set kuralı sorun çıkarmaz."
explanation: |
  Biriktirici `$acc`, o ana kadarki işlemin **tamamını** taşıyor: `5` → `(5 + 3)` → `((5 + 3) * 2)`.
  Her iç kural girdinin başından iki token yiyor (işlem kelimesi + sayı) ve kalanını aynen sonraki
  adıma veriyor. İşlem önceliği yok, çünkü her adımda önceki sonuç bir bütün olarak sola konuyor.
  Parantezler okunurluk için; `$acc` zaten bir `expr` parçası olduğu için gruplama onlarsız da korunurdu.

  Neden sayılar için `literal`? `$x:expr $($kalan:tt)*` yazsaydın tanım follow-set kuralına takılırdı:
  `expr`'den sonra yalnızca `=>`, `,`, `;` gelebilir, `$($kalan:tt)*` ise herhangi bir token ile
  başlayabilir. `literal` tek bir sabit alır, arkasından her şey gelebilir ve `-5` gibi negatif
  sayıları da kabul eder.

  Desteklenmeyen bir kelime (`hesap!(2 bolu 2)`) hiçbir kola uymaz ve derleme hatası verir.
  Bunu daha anlaşılır yapmak için bir sonraki adımda göreceğin `compile_error!` ile bir hata kolu
  ekleyebilirsin.
````

## Makroları ayıklamak

Makro hataları bazen kafa karıştırıcıdır, çünkü derleyici **genişletilmiş** kod hakkında konuşur.
Ayıklarken ilk soru hep şudur: "Makrom **tam olarak** neye genişledi?"

**1. `cargo expand`:** Bir projedeki bütün makroları genişletip sonucu gösterir.

```console
$ cargo install cargo-expand      # bir kez
$ cargo expand                    # bütün crate
$ cargo expand araclar::rapor     # sadece bir modül
```

`cargo expand` çalışmak için **nightly** araç zincirinin kurulu olmasını ister (`rustup toolchain install
nightly`), ama projen stable kalabilir. Çıktı, kabaca şöyle görünür (kısaltılmış):

```text
fn main() {
    let notlar = {
        let mut v = Vec::new();
        v.push(85);
        v.push(92);
        v
    };
    { ::std::io::_print(format_args!("{0:?}\n", notlar)); };
}
```

**2. Editör ve Playground:** rust-analyzer'da imleç makronun üzerindeyken *"Expand macro recursively at
caret"* komutu, Rust Playground'da ise **Tools → Expand macros** aynı işi yapar.

**3. `stringify!` ile makroya ne geldiğini yazdır:**

```rust
macro_rules! goster {
    ($($t:tt)*) => {
        println!("makroya gelen: {}", stringify!($($t)*));
    };
}

fn main() {
    goster!(1 + 2 * x);
    goster!(struct Nokta { x: i32 });
}
```

**4. `compile_error!` ile kendi hata mesajın:** Hiçbir kola uymayan girdiler için en sona bir "hata kolu"
eklersen kullanıcı `no rules expected ...` yerine anlaşılır bir mesaj görür:

```rust
macro_rules! renk {
    (kirmizi) => { (255, 0, 0) };
    (yesil) => { (0, 255, 0) };
    (mavi) => { (0, 0, 255) };
    ($diger:tt) => {
        compile_error!(concat!("bilinmeyen renk: ", stringify!($diger)))
    };
}

fn main() {
    let (r, g, b) = renk!(yesil);
    println!("{r} {g} {b}");
}
```

```rust,compile_fail
macro_rules! renk {
    (kirmizi) => { (255, 0, 0) };
    ($diger:tt) => {
        compile_error!(concat!("bilinmeyen renk: ", stringify!($diger)))
    };
}

fn main() {
    let (r, g, b) = renk!(mor); // error: bilinmeyen renk: mor
    println!("{r} {g} {b}");
}
```

:::deep trace_macros! ve log_syntax!
Nightly derleyicide `#![feature(trace_macros)]` ile `trace_macros!(true);` yazarsan derleyici her
genişleme adımını ekrana döker. TT muncher'ların hangi adımda takıldığını görmek için çok faydalıdır,
ancak **kararlı (stable)** Rust'ta kullanılamaz:
```text
#![feature(trace_macros)]
trace_macros!(true);
let x = puan!(+ -);
trace_macros!(false);
```
:::

Sık göreceğin makro hataları ve anlamları:

| Hata | Anlamı |
|------|--------|
| `no rules expected ...` | çağrı hiçbir kola uymadı; takılınan token gösterilir |
| `unexpected end of macro invocation` | girdi erken bitti (eksik argüman, sondaki virgül) |
| `... is followed by ..., which is not allowed` | follow-set ihlali (tanımda) |
| `variable 'x' is still repeating at this depth` | tekrar değişkeni `$( )*` dışında kullanıldı |
| `recursion limit reached while expanding` | temel durum eksik ya da genel kol iç kurallardan önce |
| `local ambiguity when calling macro` | derleyici iki yoldan hangisinin seçileceğine tek token'a bakarak karar veremedi |

```quiz
question: TT muncher'ın beklediğinden farklı bir sonuç ürettiğini düşünüyorsun. Stable Rust kullanan bir projede ilk olarak ne yaparsın?
options:
  - "`cargo expand` ile (ya da editörün \"Expand macro\" komutuyla) makronun neye genişlediğine bakarım"
  - "Projeyi nightly'ye geçirip her yere `trace_macros!(true)` eklerim"
  - "Makroyu silip aynı kodu elle yazarım; makrolar ayıklanamaz"
answer: 0
explanation: |
  Genişletilmiş kodu görmek, makro hatalarının neredeyse hepsini çözer. `cargo expand` nightly
  araç zincirinin **kurulu** olmasını ister ama projeni stable'dan çıkarmaz. `trace_macros!` güçlüdür
  ama kararsız bir özelliktir; ilk araç olarak gerekmez.
feedback:
  - Doğru!
  - Gerekmez; `cargo expand` ve editör araçları stable projede çalışır.
  - Makrolar gayet ayıklanabilir; genişletilmiş koda bakmak genellikle yeterlidir.
```

## Özet

:::remember
- **Özyineleme**: temel durum + kendini çağıran kol. Sınır varsayılan 128 (`#![recursion_limit]`).
- `$x`'i birden çok kez kullanacaksan önce **bir kez** değerlendir: `let a = $x;`.
- **Hijyen**: makro içindeki yerel değişkenler çağıranınkilerle karışmaz; makro çağıranın
  değişkenlerini de göremez (`E0425`). Değişkeni `$v:ident` olarak ver.
- Hijyen **karma**: fonksiyon, tip, modül gibi öğeler çağrı yerinde çözülür → `$crate::` ve `::std::` kullan.
- `macro_rules!` **tanımdan sonra** kullanılabilir; modül dışına `pub(crate) use ad;` ile, crate dışına
  `#[macro_export]` ile açılır (crate kökünde görünür).
- İç kurallar `@etiket` ile başlar ve **en üstte** durur; genel `$($t:tt)*` kolu **en sonda**.
- TT munching: baştan token ye, kalanı + biriktiriciyi yeniden makroya ver.
- Ayıklama: `cargo expand`, editörde "Expand macro", `stringify!`, `compile_error!`.
:::

```reflect
prompt: |
  Hijyen olmasaydı bir makro kütüphanesi yazmak neden tehlikeli olurdu? Hijyenin neden yalnızca yerel
  değişkenleri kapsayıp fonksiyonları kapsamadığını da düşünerek kendi cümlelerinle açıkla.
answer: |
  Model cevap: Hijyen olmasaydı makronun içinde kullandığım geçici bir değişken (`a`, `tmp`, `sonuc`)
  kullanıcının aynı isimli değişkenini gölgeleyebilir ya da değiştirebilirdi; makronun doğru çalışması
  kullanıcının hangi isimleri kullandığına bağlı olurdu ve hata sessizce ortaya çıkardı (C'deki SWAP
  makrosu gibi). Rust her ismi yazıldığı yerin bağlamıyla taşıdığı için bu çakışmalar imkânsız.
  Fonksiyonlar ve tipler ise çağrı yerinde çözülür, çünkü makroların büyük kısmı tam da kullanıcının
  öğelerine erişmek ya da onun için yeni öğeler (fonksiyon, struct, impl) üretmek için yazılır; bu
  öğeler dışarıdan görünmeseydi kod üreten makrolar işe yaramazdı. Bunun bedeli, makronun kendi
  yardımcılarına `$crate::` gibi tam yollarla erişmesi gerekmesidir.
```

```flashcards
- front: Özyinelemeli bir makronun varsayılan genişleme derinliği sınırı kaçtır, nasıl artırılır?
  back: "**128**. Crate köküne `#![recursion_limit = \"256\"]` eklenerek artırılır."
- front: "`if $a > $b { $a } else { $b }` gibi bir dönüştürücünün sorunu nedir?"
  back: "`$a` ifadesi iki kez kopyalanır ve **iki kez değerlendirilir** (yan etkiler tekrarlanır). Önce `let a = $a;` ile bağlanmalı."
- front: Makro hijyeni (hygiene) nedir?
  back: Her ismin yazıldığı yerin bağlamını taşıması; makronun yerel değişkenleri çağıranınkilerle karışmaz, makro da çağıranın değişkenlerini göremez.
- front: "`macro_rules!` hijyeni hangi isimleri **kapsamaz**?"
  back: "Fonksiyonlar, tipler, modüller, sabitler, makrolar gibi öğeler; bunlar çağrı yerinde çözülür (karma hijyen)."
- front: "`$crate` ne işe yarar?"
  back: "Makroyu **tanımlayan** crate'in köküne çözülür; dışa aktarılan makrolarda yardımcılara güvenle erişmek için kullanılır (`$crate::yardimci()`)."
- front: "`#[macro_export]` bir makroyu nereye yerleştirir?"
  back: "Hangi modülde yazılmış olursa olsun **crate'in köküne**; başka crate'ler `use kutuphane::makro;` ile kullanır."
- front: TT munching nedir?
  back: Girdinin başından birkaç token'ı alıp işleyen ve kalan token'ları (çoğu zaman bir biriktiriciyle birlikte) makroya yeniden veren özyinelemeli teknik.
- front: Makronun neye genişlediğini görmenin en pratik yolu nedir?
  back: "`cargo expand` (nightly kurulu olmalı) ya da editörde rust-analyzer'ın \"Expand macro recursively\" komutu / Playground'da Tools → Expand macros."
```
