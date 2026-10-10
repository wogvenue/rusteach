---
id: m03-l02
title: İfadeler ve Deyimler
minutes: 16
type: lesson
objectives:
  - Bir kod parçasının ifade mi deyim mi olduğunu ayırt edebilmek
  - Süslü parantezli blokları değer üreten ifadeler olarak kullanabilmek
  - "Noktalı virgülden kaynaklanan `expected i32, found ()` (`E0308`) hatasını okuyup düzeltebilmek"
  - Son ifadeyle örtük dönüşü ve `return` ile erken dönüşü yerinde kullanabilmek
keywords: [ifade, deyim, expression, statement, blok, noktalı virgül, return, erken dönüş, E0308]
---

Önceki derste `topla` fonksiyonunun son satırına `a + b` yazdık — noktalı virgül koymadan — ve bunun
dönüş değeri olduğunu söyledik. Peki noktalı virgül koysaydık ne olurdu? Bu minicik işaret, Rust'ın en
temel fikirlerinden birinin kapısını aralıyor: Rust **ifade odaklı (expression-oriented)** bir dildir.

Bu derste **ifade (expression)** ile **deyim (statement)** arasındaki farkı öğreneceksin. Bu fark bir kez
oturduğunda `if`'ten döngülere, ileride göreceğin `match`'e kadar pek çok yapının neden öyle çalıştığı
kendiliğinden anlaşılacak.

## Önce tahmin et

Açıklamaya geçmeden iki kısa soru. Emin olmasan da tahmin et: Beynin önce bir tahminde bulunup sonra
doğrusunu gördüğünde çok daha kalıcı öğrenir.

```compiles
code: |
  fn kare(x: i32) -> i32 {
      x * x;
  }

  fn main() {
      println!("{}", kare(4));
  }
answer: false
error: E0308
explanation: |
  Önceki dersteki fonksiyonlardan tek farkı, `x * x`'in sonundaki noktalı virgül — ve bu, programı
  derlenmez hâle getiriyor! Noktalı virgül `x * x` ifadesini bir **deyime** çevirir: "Hesapla ve sonucu
  at." Gövdenin dönüş değeri kalmaz, gövde `()` üretir; imza ise `i32` söz vermişti → `E0308`. Dersin
  geri kalanı bunun neden böyle olduğunu adım adım açıklıyor.
```

```predict
code: |
  fn main() {
      let x = 5;
      let y = {
          let x = x * 2;
          x + 1
      };
      println!("x = {x}, y = {y}");
  }
options:
  - "x = 5, y = 11"
  - "x = 10, y = 11"
  - "x = 5, y = 6"
  - "Derlenmez: let satırının sağına blok yazılamaz"
answer: 0
explanation: |
  Süslü parantezli blok bir **değer üretir**: Değeri, son satırdaki noktalı virgülsüz `x + 1`'dir.
  Blok içindeki `let x = x * 2;` ise Modül 2'den tanıdığın **gölgelemedir (shadowing)**: Yalnızca blok
  içinde geçerli, değeri 10 olan yeni bir `x` oluşturur. Blok bitince bu iç `x` kaybolur ve dıştaki
  `x` yeniden görünür: hâlâ 5. Sonuç: `y = 10 + 1 = 11`, `x = 5`.
```

## Deyim mi, ifade mi?

Rust'ta yazdığın her parça iki gruptan birine girer:

- **İfade (expression)** bir değer **üretir**: `5`, `a + b`, `kare(3)`, `x > 10`, hatta
  `{ let a = 2; a * 3 }` bloğu. Her ifadenin bir **değeri** ve bir **tipi** vardır.
- **Deyim (statement)** bir iş **yapar** ama değer üretmez: `let x = 5;` gibi değişken tanımları,
  `fn` tanımları ve sonuna noktalı virgül konmuş ifadeler (`x + 1;`, `println!("...");`).

| Kod | Tür | Değeri |
|---|---|---|
| `42` | ifade | `42` |
| `a + b` | ifade | toplam |
| `kare(3)` | ifade | `9` |
| `x > 10` | ifade | `true` ya da `false` |
| `{ let a = 2; a * 3 }` | ifade | `6` |
| `let y = 6;` | deyim | — |
| `kare(3);` | deyim | — (değer hesaplanır ve atılır) |

Her ifade bir değer ürettiği için, **değer beklenen her yere** yazılabilir — bir toplamın içine, bir
argümanın yerine, hatta başka bir çağrının içine:

```rust
fn kare(x: i32) -> i32 {
    x * x
}

fn main() {
    let a = kare(3) + 1; // çağrı ifadesi + toplama
    let b = kare({
        let ic = 2;
        ic + 1 // argüman olarak bir blok: değeri 3
    });
    println!("a = {a}, b = {b}");
    println!("kare(kare(2)) = {}", kare(kare(2)));
}
```

`let` bir deyim olduğu için bir değer gibi kullanılamaz; örneğin başka bir `let`'in sağ tarafına konamaz:

:::error
```text
error: expected expression, found `let` statement
 --> src/main.rs:2:14
  |
2 |     let x = (let y = 6);
  |              ^^^
```
Derleyici `let x =`'in sağında bir **ifade** bekliyordu (`expected expression`), ama bir `let`
**deyimiyle** karşılaştı.
:::

:::deep Atama da bir ifade, ama değeri `()`
C, Java ve JavaScript'te atama, atanan değeri üretir; `x = y = 6` yazınca ikisi de 6 olur. Rust'ta
`y = 6` ataması da teknik olarak bir ifadedir, ama değeri her zaman `()`'dir. Bu yüzden aynı satır
Rust'ta derlenmez:
```text
error[E0308]: mismatched types
 --> src/main.rs:4:9
  |
4 |     x = y = 6;
  |         ^^^^^ expected integer, found `()`
```
İlk bakışta kısıtlayıcı görünüyor, ama C'nin en ünlü hatalarından birinin, karşılaştırma yerine
yanlışlıkla atama yapılan `if (x = 5)` hatasının önünü kesiyor. Bunu bir sonraki derste göreceksin.
:::

```quiz
question: Aşağıdakilerden hangileri bir **değer üretir**, yani ifadedir? (Birden fazla seçebilirsin.)
options:
  - "`7 * 6`"
  - "`let a = 7 * 6;`"
  - "`{ let b = 2; b * 21 }`"
  - "`kare(6)`"
  - "`fn kare(x: i32) -> i32 { x * x }`"
answer: [0, 2, 3]
explanation: |
  `7 * 6`, blok ve fonksiyon çağrısı birer **ifadedir**: Hepsi bir değere (42, 42 ve 36) dönüşür.
  `let` ise bir **deyimdir**: Bir değişken tanımlar ama kendisi değer üretmez. Fonksiyon tanımı da
  değer üretmez; Rust'ta `fn` gibi tanımlara **öğe (item)** denir.
feedback:
  - Doğru, çarpma bir değer üretir (42).
  - "`let` bir deyimdir. Sağındaki `7 * 6` bir ifadedir, ama `let` satırının tamamı bir değer üretmez."
  - Doğru! Bloğun değeri, son noktalı virgülsüz satırıdır (42).
  - Doğru, çağrının değeri fonksiyonun döndürdüğü değerdir (36).
  - Fonksiyon tanımı bir öğedir (item); bir şey tanımlar ama değer üretmez.
```

## Bloklar da birer ifadedir

Süslü parantezler arasındaki **blok (block)** her yerde bir ifade gibi kullanılabilir. Bir markette KDV
dahil fiyatı hesaplayalım:

```rust
fn main() {
    let fiyat = 250;

    let kdv_dahil = {
        let kdv = fiyat * 20 / 100;
        fiyat + kdv
    };

    println!("KDV dahil fiyat: {kdv_dahil} TL");
}
```

Bir blok şöyle çalışır:

1. İçindeki deyimler sırayla çalışır (`let kdv = ...;`).
2. Bloğun değeri, **son satırdaki noktalı virgülsüz ifadedir** (`fiyat + kdv`). Buna **son ifade (tail
   expression)** denir.
3. Blok içinde tanımlanan değişkenler yalnızca o blokta yaşar: Blok bitince `kdv` **kapsam (scope)**
   dışına çıkar. Blok dışında `kdv`'yi kullanmaya çalışırsan `E0425` alırsın. Geçici yardımcı
   değişkenleri gizlemek için birebirdir.

```memory
title: let kdv_dahil = { ... }; adım adım
steps:
  - caption: "`fiyat` tanımlandı."
    stack:
      - frame: main
        vars:
          - { name: fiyat, type: i32, value: "250" }
  - caption: "Bloğa girildi: `kdv` yalnızca bloğun **kapsamında (scope)** yaşar."
    stack:
      - frame: main
        vars:
          - { name: fiyat, type: i32, value: "250" }
          - { name: kdv, type: i32, value: "50", note: sadece blok içinde }
  - caption: "Blok bitti: Son ifade `fiyat + kdv` = 300 oldu ve `kdv_dahil`'e aktarıldı. `kdv` kapsam dışına çıktı."
    stack:
      - frame: main
        vars:
          - { name: fiyat, type: i32, value: "250" }
          - { name: kdv_dahil, type: i32, value: "300" }
```

İşte önceki dersteki `a + b`'nin sırrı: **Fonksiyon gövdesi de bir bloktur.** Gövdenin son ifadesi
bloğun değeri olur, bloğun değeri de fonksiyonun dönüş değeri.

:::analogy Meyve sıkacağı
Blok bir **meyve sıkacağı** gibidir. İçine istediğin kadar meyve atıp işleyebilirsin (deyimler); ama
bardağa akan tek şey, en sondaki **noktalı virgülsüz** satırdır. Son satıra noktalı virgül koymak, suyu
lavaboya dökmek demektir: Bardakta kalan şey "boşluk"tur, yani `()`.
:::

```parsons
prompt: |
  Satırları sırala: `vucut_kitle_indeksi` kiloyu (kg) ve boyu (cm) alıp vücut kitle indeksini
  döndürsün; `main` de sonucu yazdırsın. Önce fonksiyonu, sonra `main`'i kur. İki tuzak satır var!
lines: |
  fn vucut_kitle_indeksi(kilo: f64, boy_cm: f64) -> f64 {
      let boy_m = boy_cm / 100.0;
      kilo / (boy_m * boy_m)
  }
  fn main() {
      let vki = vucut_kitle_indeksi(70.0, 175.0);
      println!("VKİ: {vki:.1}");
  }
distractors: |2
      kilo / (boy_m * boy_m);
      let boy_m = boy_cm / 100.0
explanation: |
  Fonksiyonun ilk satırı bir **deyim** (noktalı virgüllü `let`), son satırı ise noktalı virgülsüz bir
  **ifade**: Dönüş değeri odur. Tuzak satırlarda tam tersi yapılmış: `let`'in sonundaki noktalı virgül
  unutulmuş (sözdizimi hatası), son ifadeye ise fazladan noktalı virgül konmuş (gövde `()` üretir).
```

## Noktalı virgül tuzağı

```predict
question: Bu program derlenir ve çalışır. Peki ne yazdırır?
code: |
  fn main() {
      let a = {
          let b = 3;
          b * 2;
      };
      println!("{a:?}");
  }
options:
  - "6"
  - "()"
  - "3"
answer: 1
explanation: |
  Bloğun son satırı `b * 2;` noktalı virgülle bitiyor, yani bir **deyim**. Blokta noktalı virgülsüz bir
  son ifade kalmadığı için bloğun değeri **birim tipi** `()` olur ve `a`'ya o atanır. `{a:?}` (Debug
  biçimi) onu olduğu gibi `()` diye yazdırır. Derleyici bu arada "unused arithmetic operation" diye
  uyarır: Hesaplanan 6'nın hiçbir yerde kullanılmadığını fark etmiştir.
```

Kural basit: **Noktalı virgül bir ifadeyi deyime çevirir** — "bu değeri hesapla ve at." Bir bloğun ya da
fonksiyon gövdesinin son satırı noktalı virgülle biterse, bloğun değeri `()` olur. Modül 2'den hatırla:
`()` **birim tipidir (unit type)** ve "anlamlı bir değer yok" demektir.

Değer döndürmesi gereken bir fonksiyonda bu, Rust'ta belki de en sık görülen derleme hatasıdır:

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:1:20
  |
1 | fn kare(x: i32) -> i32 {
  |    ----            ^^^ expected `i32`, found `()`
  |    |
  |    implicitly returns `()` as its body has no tail or `return` expression
2 |     x * x;
  |          - help: remove this semicolon to return this value
```
Okuma sırası: **1)** `expected i32, found ()` — imza `i32` söz vermiş, gövde `()` üretmiş.
**2)** `implicitly returns ()...` — gövdenin son ifadesi (tail) ya da bir `return`'ü yok.
**3)** `help: remove this semicolon` — çözüm tam da işaretlenen noktalı virgülde.
:::

Aynı hatanın bir başka biçimi de son ifadeyi hiç yazmamaktır:

```rust,compile_fail,E0308
fn ortalama(a: f64, b: f64) -> f64 {
    let toplam = a + b;
    let sonuc = toplam / 2.0;
}
```

Burada derleyici "noktalı virgülü sil" diyemez, çünkü son satır bir `let` **deyimi**. Çözüm, sonucu son
ifade olarak yazmak: ya sona `sonuc` satırını eklemek ya da `let sonuc = ...;` yerine doğrudan
`toplam / 2.0` yazmak.

:::tip
`println!` gibi `()` döndüren işlerle biten fonksiyonlarda son satırdaki noktalı virgül sorun değildir;
o fonksiyonların zaten `()` döndürmesi beklenir. Kuralı şöyle hatırla: **Değer döndüren fonksiyonun son
satırına noktalı virgül koyma.**
:::

## return ve erken dönüş

`return` anahtar kelimesi fonksiyondan **hemen** çıkar ve verilen değeri döndürür. Rust'taki alışkanlık
şudur:

- Fonksiyonun **sonundaki** değer için son ifadeyi kullan; `return` yazma.
- `return`'ü fonksiyonun **ortasında**, bir koşul sağlandığında erkenden çıkmak için kullan. Buna
  **erken dönüş (early return)** denir.

Aşağıda bir sonraki dersin konusu olan `if`'i kullanıyoruz; okuması kolay: Koşul doğruysa süslü
parantezin içi çalışır.

```rust
fn kargo_ucreti(sepet_tutari: u32) -> u32 {
    if sepet_tutari >= 500 {
        return 0; // 500 TL ve üzeri: kargo bedava, hemen çık
    }
    let tasima = 40;
    let paketleme = 10;
    tasima + paketleme
}

fn main() {
    println!("320 TL'lik sepet: {} TL kargo", kargo_ucreti(320));
    println!("750 TL'lik sepet: {} TL kargo", kargo_ucreti(750));
}
```

750 TL'lik sepette `return 0;` çalışır ve fonksiyon orada biter; aşağıdaki satırlara hiç inilmez.
Erken dönüş, özel durumları fonksiyonun başında halledip "normal yolu" sade bırakır. Bu kalıba
**koruma koşulu (guard clause)** denir; bir sonraki derste iç içe `if`'lerle karşılaştıracağız.

:::deep `return` da bir ifadedir — ama hiç değer üretmez
`return 0` da teknik olarak bir ifadedir; ama çalıştığı anda fonksiyondan çıkıldığı için "sonrası"
yoktur, yani yerine hiçbir değer konmaz. Rust bu tür ifadelere özel bir tip verir: **`!`**, okunuşu
*never* ("asla"). `!` tipindeki bir ifade **her tipin yerine** geçebilir, çünkü o noktaya hiçbir değer
ulaşmayacağı kesindir. Bu yüzden şu satır derlenir:
`let indirim = if uye { 10 } else { return 0; };` — `else` dalı bir `i32` üretmez ama fonksiyonu terk
eder, tipler yine uyumludur. Aynı ayrıcalık programı durduran `panic!`'e (Modül 10) ve döngüler
dersinde göreceğin `break`/`continue`'ya da tanınır.
:::

```quiz
question: |
  Dördü de bir sayıyı ikiyle çarpmaya çalışıyor. Hangileri **derlenir**? (Birden fazla seçebilirsin.)
options:
  - "`fn ikiye_katla(x: i32) -> i32 { return x * 2; }`"
  - "`fn ikiye_katla(x: i32) -> i32 { x * 2 }`"
  - "`fn ikiye_katla(x: i32) -> i32 { x * 2; }`"
  - "`fn ikiye_katla(x: i32) { x * 2 }`"
answer: [0, 1]
explanation: |
  İlk ikisi derlenir ve aynı işi yapar; ama Rust'taki alışkanlık **ikincisidir**: Sondaki değer için
  `return` yazılmaz (Clippy bu durumda `needless_return` uyarısı verir). Üçüncüde noktalı virgül değeri
  yutar ve gövde `()` üretir → `E0308`. Dördüncüde ise tersi olur: İmzada `->` olmadığı için fonksiyon
  `()` döndürmeye söz vermiştir, ama gövde bir `i32` üretir → yine `E0308` (`expected (), found i32`).
feedback:
  - Derlenir, ama sondaki `return` gereksizdir.
  - Doğru ve idiomatik!
  - Noktalı virgül değeri `()`'ye çevirir; imza ise `i32` bekliyor.
  - Dönüş tipi yazılmadığı için gövdenin `()` üretmesi gerekirdi.
```

:::deep Rust bu fikri nereden aldı?
Rust'ın ilk derleyicisi OCaml dilinde yazılmıştı ve Rust, ifade odaklılığı OCaml ve Haskell gibi
fonksiyonel dillerden miras aldı. C, Java ve Python'da `if` bir deyimdir; bu yüzden bu diller koşula
göre bir değer seçmek için ayrı bir yapıya ihtiyaç duyar (C/Java'da `a ? b : c`, Python'da
`b if a else c`). Rust'ta `if`, bloklar ve `loop` zaten birer ifade olduğu için böyle özel bir
operatöre gerek kalmaz. Bunu bir sonraki derste kendin göreceksin.
:::

## Alıştırmalar

İlk alıştırma bir "dedektiflik" görevi: Derlenmeyen kodu düzelteceksin. İkincisinde ise deyimler ve son
ifadeyle bir formülü kendin kuracaksın.

```exercise
id: m03-e-noktali-virgul-avcisi
title: Noktalı virgül avcısı
difficulty: 1
prompt: |
  Stajyer arkadaşın market uygulaması için üç fonksiyon yazmış, ama program derlenmiyor. Derleyici üç
  yerde de benzer bir şikâyette bulunuyor: `expected ..., found ()`. Hataları bul ve **en az
  değişiklikle** düzelt. Fonksiyon imzalarına dokunma; sorun gövdelerde.
starter: |
  fn kare(x: i32) -> i32 {
      x * x;
  }

  fn ortalama(a: f64, b: f64) -> f64 {
      let toplam = a + b;
      let sonuc = toplam / 2.0;
  }

  fn indirimli_fiyat(fiyat: u32, yuzde: u32) -> u32 {
      let indirim: u32 = {
          let pay = fiyat * yuzde;
          pay / 100;
      };
      fiyat - indirim
  }

  fn main() {
      println!("{}", kare(9));
      println!("{}", ortalama(70.0, 85.0));
      println!("{}", indirimli_fiyat(1200, 15));
  }
starter_compiles: false
solution: |
  fn kare(x: i32) -> i32 {
      x * x
  }

  fn ortalama(a: f64, b: f64) -> f64 {
      let toplam = a + b;
      toplam / 2.0
  }

  fn indirimli_fiyat(fiyat: u32, yuzde: u32) -> u32 {
      let indirim: u32 = {
          let pay = fiyat * yuzde;
          pay / 100
      };
      fiyat - indirim
  }

  fn main() {
      println!("{}", kare(9));
      println!("{}", ortalama(70.0, 85.0));
      println!("{}", indirimli_fiyat(1200, 15));
  }
check: tests
tests: |
  #[test]
  fn kare_dogru() {
      assert_eq!(kare(9), 81, "9'un karesi 81 olmalı");
      assert_eq!(kare(-4), 16, "negatif bir sayının karesi pozitiftir");
  }

  #[test]
  fn ortalama_dogru() {
      assert_eq!(ortalama(70.0, 85.0), 77.5, "(70 + 85) / 2 = 77.5");
      assert_eq!(ortalama(0.0, 0.0), 0.0, "iki sıfırın ortalaması sıfırdır");
  }

  #[test]
  fn indirim_dogru() {
      assert_eq!(indirimli_fiyat(1200, 15), 1020, "1200 TL'ye %15 indirim: 1200 - 180 = 1020");
      assert_eq!(indirimli_fiyat(999, 0), 999, "%0 indirim fiyatı değiştirmemeli");
      assert_eq!(indirimli_fiyat(80, 100), 0, "%100 indirimde ürün bedavadır");
  }
hints:
  - "Derleyicinin gösterdiği satırlara bak: Değer üretmesi gereken her bloğun son satırı noktalı virgülsüz bir **ifade** olmalı."
  - "`kare`'de ve `indirim` bloğunda derleyici `help: remove this semicolon` diyor. `ortalama`'da ise son satır bir `let` deyimi; hesaplanan değeri son ifade olarak yazman gerek."
  - "`ortalama` için: `let sonuc = ...;` satırının altına `sonuc` yazabilir ya da o satırı doğrudan `toplam / 2.0` ile değiştirebilirsin."
explanation: |
  Üç hata, aynı kuralın üç yüzü: **Değer üretmesi gereken bir bloğun son satırı noktalı virgülsüz bir
  ifade olmalı.**

  - `kare`: Fazladan noktalı virgül değeri yuttu; silmek yeterli.
  - `ortalama`: Son satır bir `let` deyimiydi; gövdenin hiç son ifadesi yoktu. `let sonuc = ...;`
    satırından sonra `sonuc` yazmak da doğrudur, ama gereksiz ara değişkeni atmak daha sade.
  - `indirimli_fiyat`: İç bloğun son satırındaki noktalı virgül bloğun değerini `()` yaptı; `indirim`
    için `u32` beklenirken `()` geldi. Aslında burada blok hiç gerekmiyordu:
    `let indirim = fiyat * yuzde / 100;` hem daha kısa hem daha okunaklı.

  `E0308` mesajında `found ()` gördüğünde ilk işin **noktalı virgüllere bakmak** olsun.
```

```exercise
id: m03-e-tarla-alani
title: Tarla alanı (Heron formülü)
difficulty: 2
prompt: |
  Köydeki üçgen biçimli bir tarlanın üç kenarı metre cinsinden ölçüldü ve tapu müdürlüğü alanı istiyor.
  Üç kenarı bilinen bir üçgenin alanı **Heron formülüyle** bulunur:

  1. Yarı çevre: s = (a + b + c) / 2
  2. Alan: √( s · (s − a) · (s − b) · (s − c) )

  `ucgen_alani` fonksiyonunu tamamla. Ara değerleri `let` deyimleriyle hesapla ve sonucu gövdenin **son
  ifadesi** olarak bırak; bu alıştırmada `return` kullanma! Karekök için `f64` sayılarının `.sqrt()`
  metodunu kullanabilirsin: `16.0_f64.sqrt()` → `4.0`.
starter: |
  fn ucgen_alani(a: f64, b: f64, c: f64) -> f64 {
      todo!()
  }

  fn main() {
      let alan = ucgen_alani(30.0, 40.0, 50.0);
      println!("Tarlanın alanı: {alan} m²");
  }
solution: |
  fn ucgen_alani(a: f64, b: f64, c: f64) -> f64 {
      let s = (a + b + c) / 2.0;
      let carpim = s * (s - a) * (s - b) * (s - c);
      carpim.sqrt()
  }

  fn main() {
      let alan = ucgen_alani(30.0, 40.0, 50.0);
      println!("Tarlanın alanı: {alan} m²");
  }
check: tests
tests: |
  #[test]
  fn dik_ucgen_3_4_5() {
      let alan = ucgen_alani(3.0, 4.0, 5.0);
      assert!((alan - 6.0).abs() < 1e-9, "3-4-5 dik üçgeninin alanı 3·4/2 = 6 olmalı; senin sonucun: {alan}");
  }

  #[test]
  fn buyuk_tarla() {
      let alan = ucgen_alani(30.0, 40.0, 50.0);
      assert!((alan - 600.0).abs() < 1e-9, "30-40-50 m'lik tarla 600 m² olmalı; senin sonucun: {alan}");
  }

  #[test]
  fn eskenar_ucgen() {
      let alan = ucgen_alani(10.0, 10.0, 10.0);
      assert!(
          (alan - 43.301_270_189_221_93).abs() < 1e-9,
          "kenarları 10 m olan eşkenar üçgenin alanı ≈ 43.30 m² olmalı; senin sonucun: {alan}"
      );
  }

  #[test]
  fn kenar_sirasi_onemsiz() {
      let alan = ucgen_alani(5.0, 3.0, 4.0);
      assert!((alan - 6.0).abs() < 1e-9, "kenarların sırası alanı değiştirmemeli; senin sonucun: {alan}");
  }

  #[test]
  fn duz_cizgi_ucgen_degildir() {
      let alan = ucgen_alani(1.0, 2.0, 3.0);
      assert!(alan.abs() < 1e-9, "1 + 2 = 3 olduğu için bu üçgen düz bir çizgidir, alanı 0 olmalı; senin sonucun: {alan}");
  }
hints:
  - "Önce yarı çevreyi bir `let` deyimiyle hesapla. `f64` ile çalıştığın için `2` yerine `2.0` yaz."
  - "`let s = (a + b + c) / 2.0;` yazdıktan sonra karekökün içindeki çarpımı ikinci bir `let` ile hesapla."
  - "Son satır noktalı virgülsüz olmalı: `carpim.sqrt()`"
forbid:
  - pattern: "\\breturn\\b"
    message: Bu alıştırmada `return` kullanma; sonucu gövdenin son ifadesi olarak bırak.
explanation: |
  Gövde bir **bloğun** bütün özelliklerini sergiliyor: Önce sırayla çalışan `let` **deyimleri** ara
  değerleri hesaplıyor, en sonda noktalı virgülsüz `carpim.sqrt()` **ifadesi** bloğun — dolayısıyla
  fonksiyonun — değerini veriyor.

  `(a + b + c) / 2` yazsaydın `E0277` (*cannot divide `f64` by `{integer}`*) hatası alırdın: Rust bir
  ondalık sayıyı sessizce tamsayıya bölmez, `2.0` yazman gerekir. Ara değişken kullanmadan tek ve uzun bir
  ifade de yazabilirdin; ama `s` ve `carpim` gibi isimler formülü okunur kılıyor.

  Küçük bir not: Kenarlar gerçek bir üçgen oluşturmuyorsa (örneğin 1, 2 ve 10) karekökün içi negatif olur
  ve `.sqrt()` "sayı değil" anlamına gelen `NaN` döndürür. Böyle geçersiz girdileri ele almayı Modül 10'da
  öğreneceksin.
```

## Özet

:::remember
- **İfade** değer üretir (`5`, `a + b`, `kare(3)`, `{ ... }` bloğu); **deyim** iş yapar ama değer
  üretmez (`let ...;`, `fn` tanımı, `ifade;`).
- Blok bir ifadedir: Değeri, noktalı virgülsüz **son ifadesidir**. İçinde tanımlanan değişkenler blokla
  birlikte kapsam dışına çıkar.
- Fonksiyon gövdesi de bir bloktur, yani son ifadesi dönüş değeridir.
- Sona konan `;` değeri yutar ve sonuç `()` olur → `E0308: expected i32, found ()`.
- `return` erken çıkış içindir; fonksiyonun sonunda son ifadeyi kullan.
:::

```reflect
prompt: |
  Bir arkadaşın `fn kare(x: i32) -> i32 { x * x; }` yazdı ve `E0308` aldı. Ona hatayı **ifade**,
  **deyim** ve `()` kavramlarını kullanarak nasıl açıklarsın?
answer: |
  Model cevap: `x * x` bir ifadedir, yani bir değer üretir. Sonuna noktalı virgül koyunca onu bir deyime
  çevirdin: "Hesapla ve sonucu at." Fonksiyon gövdesi bir bloktur ve bloğun değeri, noktalı virgülsüz son
  ifadesidir. Senin gövdende böyle bir ifade kalmadığı için gövdenin değeri birim tipi `()` oldu. İmza ise
  `i32` döndüreceğine söz veriyordu; derleyici `i32` beklerken `()` bulduğu için E0308 verdi. Noktalı
  virgülü silersen `x * x` yeniden son ifade olur ve fonksiyonun dönüş değeri hâline gelir.
```

````flashcards
- front: İfade (expression) ile deyim (statement) arasındaki temel fark nedir?
  back: İfade bir değer üretir; deyim bir iş yapar ama değer üretmez.
- front: "`let x = (let y = 6);` neden derlenmez?"
  back: "`let` bir deyimdir ve değer üretmez; bu yüzden başka bir `let`'in sağ tarafına konamaz."
- front: |
    Bu bloğun değeri nedir?
    ```rust
    { let a = 2; a * 3 }
    ```
  back: "`6` — bloğun değeri, noktalı virgülsüz son ifadesidir."
- front: |
    Bu bloğun değeri nedir?
    ```rust
    { let a = 2; a * 3; }
    ```
  back: "`()` — son satırdaki noktalı virgül değeri yuttu."
- front: "`expected i32, found ()` hatasının en yaygın sebebi nedir?"
  back: Değer döndürmesi gereken fonksiyonun son satırına konmuş fazladan bir noktalı virgül.
- front: Rust'ta `return` en çok ne için kullanılır?
  back: Erken dönüş için. Fonksiyonun sonundaki değer, `return` yazmadan son ifadeyle döndürülür.
- front: "C'deki `x = y = 6;` zincirleme ataması Rust'ta neden derlenmez?"
  back: "Rust'ta atamanın değeri `()`'dir; `x`'e bir sayı yerine `()` atanmaya çalışılır (E0308)."
````
