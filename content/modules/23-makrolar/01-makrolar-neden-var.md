---
id: m23-l01
title: Makrolar neden var?
minutes: 16
type: lesson
objectives:
  - Makro ile fonksiyon arasındaki farkları (değişken sayıda argüman, derleme zamanında kod üretme, denetim) açıklayabilmek
  - "`macro_rules!` ile birden fazla kolu olan basit bir makro yazabilmek"
  - Makro kollarının yukarıdan aşağıya denendiğini ve hiçbir kola uymayan çağrının derleme hatası verdiğini tahmin edebilmek
  - "Bir makroyu `()`, `[]` ve `{}` ile çağırabilmek ve hangi durumda hangisinin tercih edildiğini söyleyebilmek"
keywords: [makro, macro_rules!, println!, vec!, metaprogramlama, genişletme, kol]
---

İlk gününden beri `println!` yazıyorsun. Modül 1'de sondaki `!` işaretinin bunun bir **makro (macro)**
olduğunu söylediğini öğrenmiş, "nasıl çalıştığını ileride göreceğiz" diyerek geçmiştik. O gün geldi.
Bu modülde makroları yalnızca **kullanan** değil, **yazan** biri olacaksın: önce `macro_rules!` ile
bildirimsel (declarative) makrolar, modülün sonunda da `#[derive(...)]`'in arkasındaki prosedürel
(procedural) makrolar.

:::ferris
Makrolar Rust'ın "süper gücü" sayılır ama süper güçler dikkat ister. Bu modülün sonunda hem bir makro
yazabilecek hem de **ne zaman yazmaman gerektiğini** bileceksin. 🦀
:::

## Ünlem işaretinin ardındaki soru

Şu programa bak. Aynı `println!` bir kez hiç argümansız, bir kez tek, bir kez de dört argümanla
çağrılıyor:

```rust
fn main() {
    let sehir = "Konya";
    let sicaklik = 31;
    println!();
    println!("Hava raporu");
    println!("{sehir}: {sicaklik} °C");
    println!("{} şehrinde {} derece, nem %{}", sehir, sicaklik, 40);
}
```

Rust'ta bir **fonksiyonun** parametre sayısı ve tipleri imzasında sabittir. C++ ve Java'daki gibi aynı
isimle birden çok fonksiyon tanımlayamazsın (aşırı yükleme / overloading yok), Python'daki `*args` ya
da JavaScript'teki `...rest` gibi değişken sayıda argüman da yoktur. Peki `println!` bunu nasıl yapıyor?
Cevap: `println!` bir fonksiyon değil. Önce şu soruyu cevapla:

```compiles
code: |
  fn main() {
      println!("{} ve {}", "çay");
  }
answer: false
explanation: |
  Biçim metninde iki `{}` var ama yalnızca bir argüman verilmiş. `println!` biçim metnini
  **derleme sırasında** inceler ve sayıların tutmadığını görür:
  `error: 2 positional arguments in format string, but there is 1 argument`.
  Bir fonksiyon, kendisine verilen string'in **içine** derleme zamanında bakamazdı.
```

Bu küçük örnek, makroların iki temel gücünü gösteriyor:

1. **Değişken sayıda ve biçimde girdi:** Makro, fonksiyon imzasının kısıtlarına bağlı değildir.
2. **Derleme zamanında denetim:** C'deki `printf("%d %d", 5)` derlenir ve çalışırken bellekten çöp
   okur (tanımsız davranış). Python'da `"{} {}".format(5)` ancak **çalışınca** `IndexError` fırlatır.
   Rust aynı hatayı programın hiç çalışmadan yakalar.

:::error Hata mesajını oku
```text
error: 2 positional arguments in format string, but there is 1 argument
 --> src/main.rs:2:15
  |
2 |     println!("{} ve {}", "çay");
  |               ^^    ^^   -----
```
Bu hatanın bir `E` kodu yok: onu tip denetleyicisi değil, `println!` makrosunun kendisi (aslında
içindeki `format_args!`) üretiyor. `^^` işaretleri iki yer tutucuyu, `-----` ise tek argümanı gösteriyor.
:::

## Makro nedir? Kod yazan kod

Makro, **derleme sırasında başka kod üreten** koddur. Buna **metaprogramlama (metaprogramming)** denir.
Derleyici bir makro çağrısı gördüğünde onu, makronun ürettiği koda **genişletir (expand)**; tip denetimi,
borrow checker ve makine kodu üretimi bu genişletilmiş kod üzerinde çalışır.

```text
kaynak kod → token'lar → MAKRO GENİŞLETME → sözdizimi ağacı (AST) → tip denetimi + borrow checker → makine kodu
```

Hemen kendi makromuzu deneyelim. Sözdizimini bir sonraki adımda ayrıntılı açıklayacağız; şimdilik
`$x` yerine "makroya verilen ifade" konuyor diye düşün. **Tahmin et:**

```predict
code: |
  macro_rules! kare {
      ($x:expr) => {
          $x * $x
      };
  }

  fn main() {
      println!("{}", kare!(1 + 2));
  }
options:
  - "9"
  - "5"
  - Derlenmez
answer: 0
explanation: |
  `kare!(1 + 2)` sonucu **9**'dur, yani `(1 + 2) * (1 + 2)`. C'de aynı şeyi
  `#define KARE(x) x * x` ile yapsaydın önişlemci **metni** kopyalardı:
  `1 + 2 * 1 + 2` = **5**. Rust makroları metinle değil **token ağaçlarıyla** çalışır;
  `$x:expr` bütün bir ifadeyi tek bir düğüm olarak yakalar, bu yüzden gruplama korunur.
feedback:
  - Doğru! `$x` tek parça bir ifade olarak yerine konur.
  - Bu, C önişlemcisinin metin kopyalama davranışı olurdu. Rust makroları ifadeyi bölmez.
  - Program derlenir; `kare!` her ifadeyle çalışır.
```

Bu, Rust makrolarını C makrolarından ayıran en önemli farktır. C önişlemcisi (preprocessor) derleyiciden
**önce** çalışan bir metin kopyalayıcıdır; ne ifade bilir ne kapsam. Rust makroları ise derleyicinin
parçasıdır: girdiyi **ayrıştırır (parse)**, yapıyı korur ve hatalı kullanımı yakalar.

Tanıdık bir makroyu düşün: `vec![1, 2, 3]`. Kabaca şuna genişler: "üç elemanlı bir dizi oluştur, onu
heap'e taşı ve `Vec`'e çevir." Standart kütüphanedeki gerçek tanım `<[_]>::into_vec(...)` gibi
yardımcılar kullanarak tek bir bellek ayırmasıyla işi bitirir. Sen yalnızca `vec![...]` yazarsın.

:::analogy Dilekçe şablonu
Makro, belediyedeki **hazır dilekçe şablonuna** benzer. Sen sadece boşlukları doldurursun
("Adı: ___, Konu: ___"), memur da şablonu tamamlayıp tam metni yazar. Önemli olan şu: Bu iş dilekçe
**işleme konmadan önce** biter. Makro da programın çalışmasından önce, derleme sırasında genişler;
çalışma anında makro diye bir şey kalmaz.
:::

```quiz
question: Bir makro çağrısı (`kare!(1 + 2)` gibi) ne zaman genişletilir?
options:
  - Program çalışırken, makro her çağrıldığında
  - Derleme sırasında, tip denetimi ve borrow checker'dan önce
  - Derleme bittikten sonra, bağlama (linking) aşamasında
answer: 1
explanation: |
  Makrolar derleyicinin ilk aşamalarında, kod sözdizimi ağacına dönüştürülürken genişletilir.
  Tip denetimi ve borrow checker **genişletilmiş** kodu görür. Bu yüzden makronun ürettiği kod da
  Rust'ın bütün güvenlik denetimlerinden geçer.
feedback:
  - Çalışma anında makro diye bir şey kalmaz; geriye yalnızca ürettiği sıradan kod kalır.
  - Doğru!
  - Bağlama aşamasında artık makine kodu vardır; makrolar çok daha önce işini bitirmiştir.
```

## İlk makron: selam!

Bildirimsel makrolar `macro_rules!` ile tanımlanır. (Evet, makro tanımlamak için kullanılan şey de bir
makro!) En basit hâli:

```rust
macro_rules! selam {
    () => {
        println!("Merhaba, makro dünyası!");
    };
}

fn main() {
    selam!();
    selam!();
}
```

Parçalarına ayıralım:

| Parça | Anlamı |
|-------|--------|
| `macro_rules! selam { ... }` | `selam` adında bir makro tanımla (çağırırken `selam!` yazılır) |
| `() => { ... };` | bir **kol (rule/arm)**: solda **eşleştirici (matcher)**, sağda **dönüştürücü (transcriber)** |
| `()` | "hiç girdi yok" deseni |
| `{ println!(...); }` | eşleşme olunca yerine konacak kod |
| `;` | kolları birbirinden ayırır |

Şimdi makroya bir girdi verelim. Eşleştiricide `$isim:expr` yazınca "buraya bir **ifade (expression)**
gelecek, ona `$isim` de" demiş oluruz. `$isim` bir **makro değişkeni (metavariable)**, `expr` ise onun
**fragment belirteci (fragment specifier)**: makro girdisinin "tipi". Belirteçlerin hepsini bir sonraki
derste göreceğiz.

```rust
macro_rules! selam {
    () => {
        println!("Merhaba, yabancı!");
    };
    ($isim:expr) => {
        println!("Merhaba, {}!", $isim);
    };
}

fn main() {
    selam!();
    selam!("Zeynep");
    let ad = String::from("Mert");
    selam!(ad);
}
```

:::warning `{$isim}` çalışmaz
Biçim metninin içine `"{$isim}"` yazmak cazip gelir ama makro değişkenleri **string literal'lerinin
içinde** yerine konmaz; string makro için tek bir token'dır.
```text
error: invalid format string: expected `}`, found `$`
 --> src/main.rs:3:29
  |
3 |         println!("Merhaba, {$isim}!");
  |                            -^ expected `}` in format string
```
Çözüm: `println!("Merhaba, {}!", $isim);` yani konumlu `{}` kullanmak.
:::

```fill
prompt: |
  Boşlukları doldurarak bir ürün adı ve fiyat alıp `Simit: 15 TL` biçiminde yazdıran `fiyat_yaz!`
  makrosunu tamamla.
code: |
  macro_rules! ___0 {
      ($urun:___1, $fiyat:expr) => {
          println!("{}: {} TL", ___2, $fiyat);
      };
  }

  fn main() {
      fiyat_yaz!("Simit", 15);
  }
blanks:
  - ["fiyat_yaz"]
  - ["expr"]
  - ["$urun"]
output: "Simit: 15 TL"
explanation: |
  `macro_rules!`'ten sonra makronun adı `!` **olmadan** yazılır; `!` yalnızca çağırırken kullanılır.
  `$urun:expr` girdiyi bir ifade olarak yakalar, dönüştürücüde de `$urun` ile yerine koyarız.
  Eşleştiricideki virgül de sıradan bir token'dır: çağrıda da aynen bulunması gerekir.
```

## Birden fazla kol: sırayla denenen desenler

Bir makronun birden fazla kolu olabilir. Bunu, Modül 7'deki `match`'e benzetebilirsin, ama önemli
farklar var. Önce tahmin et:

```predict
code: |
  macro_rules! tur {
      ($x:expr) => {
          "ifade"
      };
      (merhaba) => {
          "kelime"
      };
  }

  fn main() {
      println!("{}", tur!(merhaba));
  }
options:
  - ifade
  - kelime
  - Derlenmez
answer: 0
explanation: |
  Kollar **yukarıdan aşağıya** denenir ve **ilk uyan kol** kazanır. `merhaba` geçerli bir ifadedir
  (bir değişken adı gibi), bu yüzden ilk kol `$x:expr` onu yakalar. İkinci kola hiç sıra gelmez.
  Dikkat: Ürettiği kod sadece `"ifade"` olduğu için `merhaba` adında bir değişkenin var olması bile
  gerekmiyor; genişletilmiş kodda `merhaba` geçmiyor.
feedback:
  - Doğru! İlk uyan kol kazanır.
  - "`(merhaba)` kolu daha özel ama sırada ikinci. Özel kolları her zaman genel kollardan **önce** yaz."
  - Derlenir; `merhaba` geçerli bir ifade olarak eşleşir ve genişletilmiş kodda kullanılmaz.
```

:::remember
Makro kolları **yukarıdan aşağıya** denenir, **ilk uyan** kazanır. Bu yüzden **özel kollar üstte, genel
kollar altta** olmalı.
:::

Eşleştiricideki `$` ile başlamayan her şey **birebir aranan token'dır**. Bu sayede makrona küçük bir
"anahtar kelime" dili kazandırabilirsin:

```rust
macro_rules! hesapla {
    (topla $a:expr, $b:expr) => {
        $a + $b
    };
    (carp $a:expr, $b:expr) => {
        $a * $b
    };
}

fn main() {
    let x = hesapla!(topla 2, 3);
    let y = hesapla!(carp x, 10);
    println!("{x} {y}");
}
```

```compiles
code: |
  macro_rules! hesapla {
      (topla $a:expr, $b:expr) => { $a + $b };
      (carp $a:expr, $b:expr) => { $a * $b };
  }

  fn main() {
      println!("{}", hesapla!(bol 6, 3));
  }
answer: false
explanation: |
  `bol` ile başlayan bir kol yok. Hiçbir kol uymayınca derleyici, girdinin hangi token'ında takıldığını
  gösteren bir hata verir: `no rules expected `bol``. Makronun kendisi geçerli; hata **çağrıda**.
```

:::error Hiçbir kol uymayınca
```text
error: no rules expected `bol`
 --> src/main.rs:7:29
  |
1 | macro_rules! hesapla {
  | -------------------- when calling this macro
...
7 |     println!("{}", hesapla!(bol 6, 3));
  |                             ^^^ no rules expected this token in macro call
  |
note: while trying to match `topla`
```
`when calling this macro` hangi makronun çağrıldığını, `^^^` takılınan token'ı, `note` ise derleyicinin
neyi beklediğini söyler. Bir argüman eksik kalırsa da `unexpected end of macro invocation` görürsün.
:::

```quiz
question: |
  Modül 7'de bir `enum` varyantını `match`'te unutunca `E0004` (non-exhaustive patterns) hatası
  aldığını hatırla. `macro_rules!` kolları için hangisi doğrudur?
options:
  - Derleyici makro tanımlanırken bütün olası girdilerin bir kola uyup uymadığını denetler
  - Kapsayıcılık denetimi yoktur; ancak bir çağrı hiçbir kola uymadığında, o çağrıda hata alınır
  - Hiçbir kola uymayan çağrı sessizce boş koda `()` genişler
answer: 1
explanation: |
  `match` bir **değerin** olası bütün durumlarını bilir (enum varyantları sonludur), bu yüzden
  kapsayıcılığı denetleyebilir. Makro girdisi ise sonsuz çeşitlilikte token dizisi olabilir; derleyici
  yalnızca **gerçek çağrıları** denetler. Kullanılmayan bir hatalı kol, çağrılana kadar fark edilmez.
feedback:
  - "Token dizilerinin sayısı sonsuzdur; böyle bir denetim mümkün değildir."
  - Doğru!
  - Rust sessizce yanlış kod üretmez; eşleşme yoksa derleme hatası verir.
```

## Çağırma parantezleri ve makronun yeri

Bir makroyu üç parantez türünden biriyle çağırabilirsin; üçü de **aynı** anlama gelir:

```rust
macro_rules! selam {
    () => {
        println!("Selam!");
    };
}

fn main() {
    selam!();
    selam![];
    selam! {}
}
```

Seçim tamamen gelenekseldir ve okuyucuya ipucu verir:

| Parantez | Gelenek | Örnek |
|----------|---------|-------|
| `( )` | fonksiyon çağrısı gibi davranan makrolar | `println!(...)`, `assert_eq!(a, b)` |
| `[ ]` | koleksiyon / dizi kuran makrolar | `vec![1, 2, 3]` |
| `{ }` | kod bloğu veya **öğe (item)** üreten makrolar | `macro_rules! x { ... }`, `thread_local! { ... }` |

Makrolar yalnızca ifade yerinde değil; **deyim (statement)**, **öğe (item)**, **desen (pattern)** ve
**tip** yerlerinde de çağrılabilir. Öğe yerinde, yani fonksiyonların dışında, `()` veya `[]` ile
çağırırsan sona `;` koymalısın; `{}` ile çağırırsan gerekmez. Bir makro fonksiyon bile üretebilir:

```rust
macro_rules! karsilama_fonksiyonu {
    () => {
        fn karsila(ad: &str) {
            println!("Hoş geldin, {ad}!");
        }
    };
}

karsilama_fonksiyonu! {}

fn main() {
    karsila("Elif");
}
```

`karsila` fonksiyonunu kaynak kodda hiç doğrudan yazmadık, onu makro **üretti**. Kod üretmenin
gücünü bir sonraki derste `ident` belirteciyle iyice açacağız.

### Makro mu, fonksiyon mu?

| | Fonksiyon | Makro |
|---|---|---|
| Argüman sayısı | sabit | değişken olabilir |
| Ne zaman çalışır | çalışma anında | derleme anında (kod üretir) |
| Girdiler | tipli değerler | token'lar (kod parçaları, isimler, tipler...) |
| Okunabilirlik / IDE desteği | çok iyi | daha zayıf |
| Hata mesajları | net | genişletilmiş koda göre, bazen dolaylı |
| Tanım sırası | dosyada her yerde olabilir | **kullanımdan önce** tanımlanmalı (3. derste) |

:::tip Altın kural
Bir işi **fonksiyonla** ya da **generic + trait** ile (Modül 11) yapabiliyorsan makro yazma. Makroyu;
değişken sayıda argüman, yeni bir sözdizimi (küçük bir dil / DSL), tekrarlayan kod blokları üretmek veya
derleme zamanında denetim gibi fonksiyonların **yapamadığı** işler için sakla.
:::

```quiz
question: Aşağıdakilerden hangisi için makro yazmak **en az** gereklidir?
options:
  - İki `f64` sayının ortalamasını döndürmek
  - "`vec!` gibi istediğin kadar elemanla bir koleksiyon kurmak"
  - "On farklı sayı tipi için birbirinin aynısı `impl` blokları üretmek"
  - "`selam!(Ayşe ve Mehmet)` gibi kendine özgü bir sözdizimini kabul etmek"
answer: 0
explanation: |
  `fn ortalama(a: f64, b: f64) -> f64` yazmak hem daha okunur hem daha iyi hata mesajları verir.
  Değişken sayıda eleman, tekrarlayan `impl` blokları ve yeni sözdizimi ise fonksiyonların
  yapamadığı, makroların ise tam da bunun için var olduğu işlerdir.
feedback:
  - Doğru! Sabit sayıda, tipi belli girdi = fonksiyon.
  - Değişken sayıda argüman, fonksiyonların yapamadığı bir iştir.
  - Tekrarlayan kod üretmek makroların klasik kullanım alanıdır (standart kütüphane de bunu yapar).
  - Rust sözdiziminde olmayan bir yapıyı ancak bir makro kabul edebilir.
```

## Alıştırma: koşu uygulaması için mesafe!

```exercise
id: m23-e-mesafe
title: Birim anlayan mesafe! makrosu
difficulty: 2
prompt: |
  Bir koşu uygulaması yazıyorsun. Kullanıcılar mesafeleri farklı birimlerle giriyor; uygulama içinde
  her şeyi **metre** (`f64`) olarak tutmak istiyorsun. Şu çağrıları destekleyen bir `mesafe!` makrosu yaz:

  | Çağrı | Sonuç (metre) |
  |-------|---------------|
  | `mesafe!(km 2.5)` | `2500.0` |
  | `mesafe!(m 300.0)` | `300.0` |
  | `mesafe!(cm 150.0)` | `1.5` |

  Birimden sonra herhangi bir **ifade** gelebilmeli: `mesafe!(km tur * 0.4)` de çalışmalı.
starter: |
  macro_rules! mesafe {
      (km $x:expr) => {
          todo!()
      };
      // `m` ve `cm` kollarını da ekle
  }

  fn main() {
      let sabah = mesafe!(km 2.5);
      println!("Sabah koşusu: {sabah} metre");
  }
solution: |
  macro_rules! mesafe {
      (km $x:expr) => {
          $x * 1000.0
      };
      (m $x:expr) => {
          $x
      };
      (cm $x:expr) => {
          $x / 100.0
      };
  }

  fn main() {
      let sabah = mesafe!(km 2.5);
      let aksam = mesafe!(m 800.0) + mesafe!(cm 5000.0);
      println!("Sabah koşusu: {sabah} metre");
      println!("Akşam koşusu: {aksam} metre");
  }
check: tests
tests: |
  #[test]
  fn kilometreyi_metreye_cevirir() {
      assert_eq!(mesafe!(km 2.5), 2500.0, "2.5 km = 2500 metre olmalı");
      assert_eq!(mesafe!(km 10.0), 10000.0, "10 km = 10000 metre olmalı");
  }

  #[test]
  fn metre_aynen_kalir() {
      assert_eq!(mesafe!(m 300.0), 300.0, "300 m zaten metre; değişmemeli");
  }

  #[test]
  fn santimetreyi_metreye_cevirir() {
      assert_eq!(mesafe!(cm 150.0), 1.5, "150 cm = 1.5 metre olmalı");
      assert_eq!(mesafe!(cm 5000.0), 50.0, "5000 cm = 50 metre olmalı");
  }

  #[test]
  fn birimden_sonra_ifade_kabul_eder() {
      let tur = 4.0;
      assert_eq!(mesafe!(km tur * 0.5), 2000.0, "4 tur × 0.5 km = 2 km = 2000 m");
      assert_eq!(mesafe!(cm 100.0 + 50.0), 1.5, "(100 + 50) cm = 1.5 m; ifade bir bütün olarak bölünmeli");
  }
hints:
  - "Her birim için ayrı bir kol yaz. Eşleştiricide `km`, `m`, `cm` gibi `$` ile başlamayan kelimeler **birebir** aranan token'lardır."
  - "Kolların biçimi aynı: `(m $x:expr) => { ... };`. Dönüştürücüde `$x`'i kullanarak hesabı yap."
  - "`km` için `$x * 1000.0`, `m` için yalnızca `$x`, `cm` için `$x / 100.0` yeterli. Parantez gerekmez çünkü `$x:expr` zaten tek parça bir ifadedir."
explanation: |
  Her kol, birim kelimesini **birebir eşleşen bir token** olarak kullanıyor; ardından gelen `$x:expr`
  ise birimden sonraki bütün ifadeyi yakalıyor. `mesafe!(cm 100.0 + 50.0)` çağrısında `$x`
  `100.0 + 50.0` ifadesinin tamamıdır ve `$x / 100.0`, C makrolarının aksine `(100.0 + 50.0) / 100.0`
  olarak hesaplanır. Bu yüzden ekstra parantez yazmana gerek kalmadı.

  Neden birim **önde**? `($x:expr km)` yazmayı denersen derleyici reddeder: bir `expr`'den sonra
  yalnızca `=>`, `,` veya `;` gelebilir. Bu "follow-set" kuralını bir sonraki derste göreceğiz.

  Dürüst bir not: Gerçek bir projede bu iş için büyük ihtimalle `enum Birim { Km, M, Cm }` ve bir
  fonksiyon yazardın (Modül 7 ve 11'in araçları). Makro burada, küçük bir **alana özgü dil (DSL)**
  kurmanın ilk adımını göstermek için var.
```

## Özet

:::remember
- Makro = **derleme sırasında kod üreten kod**. Genişletilmiş kod, normal kod gibi tip denetiminden ve
  borrow checker'dan geçer.
- Rust makroları metinle değil **token ağaçlarıyla** çalışır; `kare!(1 + 2)` = 9 (C'deki gibi 5 değil).
- `macro_rules! ad { (eşleştirici) => { dönüştürücü }; ... }`: `$isim:expr` bir ifade yakalar.
- Kollar **yukarıdan aşağıya** denenir, **ilk uyan** kazanır; hiçbiri uymazsa `no rules expected ...`.
- `()`, `[]`, `{}` çağrıları eşdeğerdir; seçim gelenekseldir.
- Fonksiyon yetiyorsa fonksiyon yaz; makroyu fonksiyonların yapamadığı işlere sakla.
:::

```reflect
prompt: Kendi cümlelerinle açıkla - `println!` neden bir fonksiyon değil de makro olarak yazılmış? En az iki neden ver.
answer: |
  Model cevap: Birincisi, Rust fonksiyonlarının parametre sayısı sabittir ama `println!` sıfır, bir
  ya da onlarca argüman alabilmelidir; makrolar değişken sayıda girdiyi kabul edebilir. İkincisi,
  `println!` biçim metnini derleme sırasında inceleyip yer tutucu sayısının ve tiplerin argümanlarla
  uyumunu denetler, sonra her argüman için uygun biçimlendirme kodunu üretir. Bir fonksiyon string'in
  içine derleme zamanında bakamaz; bu hatalar ancak çalışma anında (C'de tanımsız davranış olarak,
  Python'da istisna olarak) ortaya çıkardı.
```

```flashcards
- front: Makro ile fonksiyon arasındaki temel fark nedir?
  back: Fonksiyon çalışma anında değerlerle çalışır; makro **derleme sırasında** token'ları alıp **kod üretir** (genişletir).
- front: "`macro_rules! kare { ($x:expr) => { $x * $x }; }` için `kare!(1 + 2)` kaç verir, neden?"
  back: "**9**. `$x:expr` bütün ifadeyi tek düğüm olarak yakalar: `(1 + 2) * (1 + 2)`. C önişlemcisi metin kopyalayıp 5 verirdi."
- front: Bir makronun birden fazla kolu varsa hangisi seçilir?
  back: Kollar yukarıdan aşağıya denenir; **ilk uyan** kol seçilir. Özel kollar genellerden önce yazılmalı.
- front: Hiçbir kola uymayan bir makro çağrısı ne olur?
  back: "Derleme hatası: `no rules expected ...` (eksik girdide `unexpected end of macro invocation`)."
- front: "`$isim:expr` ifadesinde `$isim` ve `expr` neyin adıdır?"
  back: "`$isim` bir **makro değişkeni (metavariable)**, `expr` ise onun **fragment belirteci** (girdinin türü)."
- front: "`selam!()`, `selam![]`, `selam!{}` arasındaki fark nedir?"
  back: Anlam farkı yoktur; gelenek gereği `()` fonksiyon benzeri, `[]` koleksiyon, `{}` blok/öğe üreten makrolar için kullanılır.
- front: Makro içinde `println!("{$x}")` neden çalışmaz?
  back: "Makro değişkenleri string literal'lerinin **içinde** yerine konmaz. `println!(\"{}\", $x)` yazılmalı."
```
