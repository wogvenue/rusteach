---
id: m03-l03
title: "Koşullar: if ve else"
minutes: 18
type: lesson
objectives:
  - "`if`, `else if` ve `else` ile çok dallı kararlar yazabilmek"
  - Koşulun neden `bool` olmak zorunda olduğunu açıklayıp ilgili `E0308` hatalarını düzeltebilmek
  - "`if`'i değer üreten bir ifade olarak kullanabilmek ve dal tiplerinin uyumu kuralını (`E0308`, `E0317`) uygulayabilmek"
  - İç içe `if`'leri mantıksal operatörlerle ya da erken dönüşle (guard clause) sadeleştirebilmek
keywords: [if, else, else if, koşul, bool, kısa devre, guard clause, E0308, E0317]
---

Hayat kararlarla dolu: Hava yağmurluysa şemsiyeni alırsın, değilse güneş gözlüğünü. Sınavdan 50'nin
üstünde aldıysan geçersin, almadıysan bütünlemeye kalırsın. Programlar da sürekli karar verir. Bu derste
Rust'ın karar aracını, `if`'i öğreneceksin.

Rust'taki `if` diğer dillerdekinden biraz daha katı, ama bir o kadar da güçlü: Koşulu **her zaman**
`bool`'dur ve kendisi bir **ifadedir**, yani önceki derste öğrendiğin gibi bir değer üretebilir.

## İlk kararın

```rust
fn main() {
    let sicaklik = 34;

    if sicaklik > 30 {
        println!("Çok sıcak! Bol su iç.");
    } else {
        println!("Hava güzel, yürüyüşe çık.");
    }

    println!("Hava durumu raporu bitti.");
}
```

`if`'ten sonra bir **koşul (condition)** gelir: `sicaklik > 30`. Koşul doğruysa (`true`) ilk süslü
parantezin içi, yanlışsa (`false`) `else`'in içi çalışır. Bu iki yolun her birine **dal (branch)** denir.
`else` isteğe bağlıdır: Yazmazsan ve koşul yanlışsa hiçbir şey yapılmaz, program `if`'in altından devam
eder. `sicaklik` değişkenini 25 yapıp programı yeniden çalıştırmayı dene.

C, Java ya da JavaScript biliyorsan iki fark hemen gözüne çarpacak:

- Koşulun etrafında **parantez gerekmez.** `if (sicaklik > 30)` yazarsan derlenir, ama derleyici
  "unnecessary parentheses around `if` condition" diye uyarır.
- **Süslü parantezler zorunludur**, dalda tek bir satır olsa bile.

```compiles
code: |
  fn main() {
      let sicaklik = 34;
      if sicaklik > 30
          println!("Çok sıcak!");
  }
answer: false
explanation: |
  Rust'ta `if`'in dalları **her zaman** süslü parantez içinde olmalı. Derleyici *expected `{`, found
  `println`* der, koşulun ardından bloğun eksik olduğunu not eder ve `help:` satırında düzeltmeyi
  gösterir: `{ println!("Çok sıcak!"); }`. Koşulun etrafındaki parantezler isteğe bağlıdır (ve
  gereksizdir); süslü parantezler değil.
```

:::info Süslü parantez neden zorunlu? "goto fail" hatası
2014'te Apple'ın iOS ve macOS sistemlerinde, güvenli bağlantıları (SSL) doğrulayan C kodunda şu satırlar
bulundu:
```c
if ((err = SSLHashSHA1.update(&hashCtx, &signedParams)) != 0)
    goto fail;
    goto fail;
```
İkinci `goto fail;` yanlışlıkla kopyalanmıştı. Girintisi onu `if`'e aitmiş gibi gösteriyordu, ama C'de
süslü parantez yoksa `if` yalnızca **ilk** satırı kapsar. İkinci satır her durumda çalıştı ve sunucu
imzasını doğrulayan adım atlandı: Milyonlarca cihazda ciddi bir güvenlik açığı (CVE-2014-1266). Rust'ta
her dal süslü parantez içinde olduğundan, girintinin "bu satır da `if`'e ait" diye yanılttığı bu tür bir
hata yapılamaz; `rustfmt` da girintiyi her zaman kodun gerçek yapısına göre düzenler.
:::

## Koşul her zaman bool'dur

Önce tahmin et:

```compiles
code: |
  fn main() {
      let elma_sayisi = 3;
      if elma_sayisi {
          println!("Elma var!");
      }
  }
answer: false
error: E0308
explanation: |
  `if`'in koşulu **mutlaka** `bool` olmalı. `elma_sayisi` bir tamsayı; Rust onu kendiliğinden `true`'ya
  çevirmez ve *expected `bool`, found integer* der. Niyetini açıkça yaz: `if elma_sayisi > 0`.
```

Pek çok dil, `bool` olmayan değerleri de koşul olarak kabul eder ve onları gizlice "doğru" ya da
"yanlış" sayar (buna *truthiness* denir):

| Dil | `if` içinde "yanlış" sayılanlar |
|---|---|
| C | `0` ve boş (NULL) işaretçi |
| Python | `0`, `""`, `[]`, `None`... |
| JavaScript | `0`, `""`, `null`, `undefined`, `NaN`... ama `"0"` ve `[]` **doğru** sayılır! |
| Rust | Hiçbiri, koşul **yalnızca** `bool` olabilir |

JavaScript'te `"0"` metninin doğru sayılması gibi sürprizler gerçek hatalara yol açar. Rust bu
belirsizliği tümden kaldırır: Ne kastettiğini yazarsın (`sayi != 0`, `sayi > 0`...). Kod biraz uzar ama
okuyan herkes aynı şeyi anlar.

:::error Atama mı, karşılaştırma mı?
```text
error[E0308]: mismatched types
 --> src/main.rs:3:8
  |
3 |     if x = 5 {
  |        ^^^^^ expected `bool`, found `()`
  |
help: you might have meant to compare for equality
  |
3 |     if x == 5 {
  |           +
```
C'de `if (x = 5)` derlenir: `x`'e 5 atanır ve koşul her zaman doğru olur, klasik ve sinsi bir hata.
Rust'ta iki kat koruma var: Atamanın değeri `()`'dir (önceki ders!) ve koşul `bool` olmak zorundadır.
Derleyici niyetini tahmin edip `==` bile öneriyor.
:::

:::warning Python alışkanlığı: zincirleme karşılaştırma
Python'da `0 <= puan <= 100` geçerlidir, Rust'ta değildir:
```text
error: comparison operators cannot be chained
 --> src/main.rs:3:10
  |
3 |     if 0 <= puan <= 100 {
  |          ^^      ^^
  |
help: split the comparison into two
  |
3 |     if 0 <= puan && puan <= 100 {
  |                  +++++++
```
Derleyici bunun ardından bir de `E0308` verir ve sorunun kökünü gösterir: `0 <= puan` zaten bir
`bool` üretiyor; bir `bool`'u `100` ile karşılaştırmanın anlamı yok. Modül 2'deki mantıksal
operatörlerle iki karşılaştırmayı birleştir: `0 <= puan && puan <= 100`.
:::

`&&` ve `||` **kısa devre (short-circuit)** yapar: `&&`'nin sol tarafı `false` ise sağ tarafa hiç
bakılmaz (sonuç zaten `false`); `||`'nin sol tarafı `true` ise sağ taraf atlanır. Bu davranışı bir
güvenlik kalkanı olarak kullanabilirsin:

```predict
question: Program ne yazdırır? (Program çökerse, çökmeden önce yazdırdıklarını seç.)
code: |
  fn oran_ikiden_buyuk_mu(bolunen: i32, bolen: i32) -> bool {
      bolen != 0 && bolunen / bolen > 2
  }

  fn main() {
      println!("{}", oran_ikiden_buyuk_mu(10, 3));
      println!("{}", oran_ikiden_buyuk_mu(10, 0));
  }
options:
  - |
    true
    false
  - |
    false
    false
  - "true"
answer: 0
explanation: |
  `10 / 3` tamsayı bölmesiyle 3'tür ve 3 > 2, yani ilk çağrı `true` döner. İkinci çağrıda `bolen != 0`
  yanlış olduğu için `&&` **kısa devre** yapar: Sağ taraftaki `bolunen / bolen` hiç hesaplanmaz, sıfıra
  bölme paniği yaşanmaz ve sonuç doğrudan `false` olur. (Yalnızca `true` yazan seçenek, programın ikinci
  çağrıda sıfıra bölmeden çöktüğünü varsayıyordu.) Sıra önemlidir: `bolunen / bolen > 2 && bolen != 0`
  yazsaydın önce bölme yapılır ve program panikle çökerdi.
```

## else if zincirleri

İkiden fazla seçenek olduğunda `else if` ile istediğin kadar dal ekleyebilirsin. Ama önce bir tahmin:

```predict
question: Puan 92. Program ne yazdırır?
code: |
  fn main() {
      let puan = 92;
      if puan >= 50 {
          println!("Geçti");
      } else if puan >= 85 {
          println!("Takdir belgesi!");
      } else {
          println!("Kaldı");
      }
  }
options:
  - "Geçti"
  - "Takdir belgesi!"
  - |
    Geçti
    Takdir belgesi!
answer: 0
explanation: |
  Koşullar **yukarıdan aşağıya** denenir ve **ilk doğru olan** dal çalışır; geri kalanlar atlanır.
  92 >= 50 zaten doğru olduğu için "Geçti" yazılır ve `else if puan >= 85` hiç sınanmaz. Bu sırayla
  yazılmış bir zincirde "Takdir belgesi!" dalına **hiçbir puan** ulaşamaz. Çözüm: En dar (en yüksek)
  koşulu en üste koymak.
```

Doğru sıralanmış bir zincir, okulda kullanılan 5'lik not sistemi:

```rust
fn main() {
    let puan = 72;

    if puan >= 85 {
        println!("5 - Pekiyi");
    } else if puan >= 70 {
        println!("4 - İyi");
    } else if puan >= 60 {
        println!("3 - Orta");
    } else if puan >= 50 {
        println!("2 - Geçer");
    } else {
        println!("1 - Geçmez");
    }
}
```

Her dal, kendisinden öncekilerin **yanlış** olduğunu zaten bilir: `puan >= 70` dalına gelindiyse puanın
85'ten küçük olduğu kesindir. Bu yüzden `puan >= 70 && puan < 85` yazmana gerek yoktur.

:::analogy Kargo ayıklama bandı
Bir `else if` zinciri, kargo merkezindeki **ayıklama bandına** benzer. Paket bant boyunca ilerler; önüne
çıkan her kapı "Bu paket bana mı?" diye sorar. Kuralına uyan **ilk** kapı paketi alır ve paket bir daha
banda dönmez. Hiçbir kapıya uymayan paket, bandın sonundaki `else` kutusuna düşer. Kapıların sırası
yanlışsa ("50 kg'dan hafifler" kapısı "5 kg'dan hafifler" kapısından önce gelirse), küçük paketler hiçbir
zaman kendi kapılarına ulaşamaz.
:::

Zincir doğru olsa bile ona giren değer yanlış olabilir. Modül 2'deki bilgini yokla:

```predict
question: Vize ve final notlarının ortalaması alınıyor. Program ne yazdırır?
code: |
  fn main() {
      let vize = 90;
      let final_notu = 79;
      let ortalama = (vize + final_notu) / 2;

      if ortalama >= 85 {
          println!("{ortalama}: Pekiyi");
      } else if ortalama >= 70 {
          println!("{ortalama}: İyi");
      } else {
          println!("{ortalama}: Orta");
      }
  }
options:
  - "84: İyi"
  - "84.5: Pekiyi"
  - "85: Pekiyi"
  - "84.5: İyi"
answer: 0
explanation: |
  Modül 2'den hatırla: İki tamsayının bölümü yine **tamsayıdır**; `169 / 2` sonucu `84.5` değil `84`'tür,
  çünkü küsurat atılır (yuvarlanmaz!). Öğrenci bu yüzden "İyi" alır. Gerçek bir not sisteminde bu bir hata
  olabilir: Ortalamayı `f64` ile hesaplamak ya da yuvarlama kuralını açıkça yazmak gerekir. Sorun `if`
  zincirinde değil, ona gelen değerde!
```

## if bir ifadedir

Önceki dersin anahtar fikri burada meyvesini veriyor:

```rust
fn main() {
    let yas = 67;

    let bilet_fiyati = if yas < 12 {
        50
    } else if yas >= 65 {
        40
    } else {
        100
    };

    println!("Bilet fiyatı: {bilet_fiyati} TL");
}
```

Her dal bir **bloktur** ve bloğun son ifadesi dalın değeridir. Hangi dal çalışırsa onun değeri bütün
`if`'in değeri olur ve doğrudan `let` ile bir değişkene bağlanabilir. Sondaki `};`'ye dikkat: `let` bir
deyimdir ve noktalı virgülle biter.

:::info Peki dersin başındaki `if`'lerden sonra neden `;` yoktu?
`if sicaklik > 30 { ... } else { ... }` hiçbir değişkene bağlanmıyordu; orada `if` bir **deyim** olarak
kullanıldı. Süslü parantezle biten ifadeler (`if`, bloklar ve sonraki derste göreceğin döngüler)
deyim olarak kullanıldığında sonlarına `;` gerekmez, **yeter ki değerleri `()` olsun**. Dalları
`println!` gibi `()` üreten işlerle bittiği için sorun yoktu. Deyim olarak kullanılan bir `if`'in
dalı bir sayı üretseydi (`if x > 3 { 1 } else { 2 }` tek başına bir satırda), derleyici
`expected (), found integer` (`E0308`) derdi: Üretilen değerle ne yapacağını söylememişsin.
:::

C, Java ve JavaScript bunun için ayrı bir **üçlü operatör (ternary operator)** kullanır:
`yas < 12 ? 50 : 100`. Python'da `50 if yas < 12 else 100` yazılır. Rust'ta böyle bir operatör yok,
çünkü gerek yok: `if` bu işi zaten yapıyor ve kısa olduğunda tek satıra da sığıyor:
`let ucret = if yas < 12 { 50 } else { 100 };`

Değer üreten bir `if` için iki kural var:

**1. Bütün dallar aynı tipte değer üretmeli.** Derleyici değişkene tek bir tip vermek zorundadır ve
programın hangi dala gireceğini çalıştırmadan bilemez:

:::error
```text
error[E0308]: `if` and `else` have incompatible types
 --> src/main.rs:3:43
  |
3 |     let durum = if yas >= 18 { 1 } else { "çocuk" };
  |                                -          ^^^^^^^ expected integer, found `&str`
  |                                |
  |                                expected because of this
```
İlk dal bir tamsayı üretti; derleyici `else`'ten de tamsayı bekliyor, ama bir metin geldi. (`&str` metin
sabitlerinin tipidir; ayrıntısını Modül 4 ve 5'te göreceksin.)
:::

**2. Değer olarak kullanılan `if`'in bir `else`'i olmalı.** Koşul yanlışsa ve `else` yoksa `if` hangi
değeri üretecek? Rust'ın cevabı: `()`. Bu da öbür dalın tipiyle uyuşmaz.

```compiles
code: |
  fn main() {
      let puan = 64;
      let gecti_mi = if puan >= 50 { true };
      println!("{gecti_mi}");
  }
answer: false
error: E0317
explanation: |
  `else` olmadığı için koşul yanlış olduğunda `if` ifadesi `()` üretir, ama ilk dal bir `bool` üretiyor.
  Derleyici `E0317` ile *`if` may be missing an `else` clause* der ve şu notu ekler: *`if` expressions
  without `else` evaluate to `()`*. Çözüm `else { false }` eklemek. Bu örnekte en sadesi ise `if`'i hiç
  kullanmamak: `let gecti_mi = puan >= 50;` - karşılaştırma zaten bir `bool` üretir.
```

```fill
prompt: |
  `if`'i bir ifade olarak kullanıp `mutlak` fonksiyonunu tamamla: Negatif bir sayının işaretini
  çevirsin, diğer sayıları olduğu gibi döndürsün. Program `7 3 0` yazdırmalı.
code: |
  fn mutlak(x: i32) -> i32 {
      if x < 0 ___0 else ___1
  }

  fn main() {
      println!("{} {} {}", mutlak(-7), mutlak(3), mutlak(0));
  }
blanks:
  - ["{ -x }", "{ 0 - x }", "{ x * -1 }", "{ -1 * x }"]
  - ["{ x }"]
output: "7 3 0"
explanation: |
  Her dal bir blok, her blok da son ifadesinin değerini üretir. İki dal da `i32` ürettiği için tipler
  uyumlu. `if` ifadesi gövdenin son ifadesi olduğu için değeri fonksiyonun dönüş değeri olur. (Gerçek bir
  projede `x.abs()` metodunu kullanırdın; burada amaç `if`'in değer üretişini görmek.)

  Modül 2'deki taşma bilgisi burada da geçerli: `i32`'nin en küçük değeri −2147483648'dir, ama en büyük
  değeri 2147483647. Yani `i32::MIN`'in pozitif karşılığı `i32`'ye **sığmaz**: `mutlak(i32::MIN)` debug
  derlemesinde *attempt to negate with overflow* paniği verir (`x.abs()` de öyle). Bu sınırın da önemli
  olduğu yerlerde sonucu `u32` olarak veren `x.unsigned_abs()` ya da `x.checked_abs()` kullanılır.
```

## İç içe mi, erken dönüş mü?

Birden fazla koşulun aynı anda sağlanması gerektiğinde ilk akla gelen, `if`'leri iç içe koymaktır.
Ehliyet sınavı başvurusunu düşün: Aday 18 yaşını doldurmuş olmalı, göz raporu olmalı ve sürücü kursunu
bitirmiş olmalı.

```rust
fn basvuru_gecerli_mi(yas: u32, goz_raporu: bool, kurs_bitti: bool) -> bool {
    if yas >= 18 {
        if goz_raporu {
            if kurs_bitti {
                true
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    }
}
# fn main() {
#     println!("{}", basvuru_gecerli_mi(19, true, true));
# }
```

Çalışıyor, ama sağa doğru büyüyen bu "piramidi" okumak zor: Her `false`'un hangi koşula ait olduğunu
bulmak için parantez saymak gerekiyor. İki sadeleştirme yolu var.

**1. Mantıksal operatörler**, koşullar yalnızca birleştiriliyorsa:

```rust
fn basvuru_gecerli_mi(yas: u32, goz_raporu: bool, kurs_bitti: bool) -> bool {
    yas >= 18 && goz_raporu && kurs_bitti
}
# fn main() {
#     println!("{}", basvuru_gecerli_mi(17, true, true));
# }
```

**2. Erken dönüş (guard clause)**, her başarısızlık için ayrı bir şey yapmak gerekiyorsa, örneğin
kullanıcıya sebebini söylemek:

```rust
fn basvuru_kontrol(yas: u32, goz_raporu: bool, kurs_bitti: bool) -> bool {
    if yas < 18 {
        println!("Reddedildi: 18 yaşını doldurmalısın.");
        return false;
    }
    if !goz_raporu {
        println!("Reddedildi: Göz raporun eksik.");
        return false;
    }
    if !kurs_bitti {
        println!("Reddedildi: Önce sürücü kursunu bitirmelisin.");
        return false;
    }
    println!("Başvurun alındı. Sınavda başarılar!");
    true
}

fn main() {
    basvuru_kontrol(17, true, true);
    basvuru_kontrol(25, false, true);
    basvuru_kontrol(25, true, true);
}
```

Her koruma koşulu bir sorunu yakalayıp fonksiyondan çıkıyor; geriye kalan "mutlu yol" hiç girinti
almıyor. Kural: **Önce engelleri temizle, sonra asıl işi yap.**

:::tip
`if kosul { true } else { false }` yazdığını fark edersen dur: Bu, koşulun ta kendisi! Doğrudan `kosul`
yaz. Aynı şekilde `if kosul { false } else { true }` yerine `!kosul` yazılır.
:::

````quiz
question: |
  Kütüphane, kitap ödünç verirken bu fonksiyonu kullanıyor. **En sade** ve tamamen eşdeğer hâli hangisi?
  ```rust
  fn odunc_alabilir_mi(uye: bool, gecikme_borcu: u32) -> bool {
      if uye {
          if gecikme_borcu == 0 { true } else { false }
      } else {
          false
      }
  }
  ```
options:
  - "`uye || gecikme_borcu == 0`"
  - "`uye && gecikme_borcu == 0`"
  - "`if uye { true } else { gecikme_borcu == 0 }`"
  - "`uye && gecikme_borcu != 0`"
answer: 1
explanation: |
  Fonksiyon yalnızca `uye` doğru **ve** `gecikme_borcu == 0` doğru olduğunda `true` döndürüyor; diğer
  bütün yollar `false` ile bitiyor. Bu tam olarak `&&`'nin tanımı. `if kosul { true } else { false }`
  kalıbı her zaman `kosul` ile değiştirilebilir (Clippy buna `needless_bool` der).
feedback:
  - "`||` üye olmayan ama borcu da olmayan birine de izin verirdi."
  - Doğru!
  - Üye olan herkese, borcu olsa bile izin verir; mantık bozulmuş.
  - Borcu olan üyelere izin verir; koşul ters çevrilmiş.
````

## Alıştırmalar

İki alıştırma: İlkinde uzun bir `else if` zincirini doğru sırayla kuracaksın; ikincisinde koşulları ve
fonksiyonları birleştireceksin.

```exercise
id: m03-e-karne-notu
title: Karne notu hesaplayıcı
difficulty: 2
prompt: |
  Okulun not sistemi için `karne_notu` fonksiyonunu yaz: 100 üzerinden **puanı** alıp 5'lik sistemdeki
  **karne notunu** döndürsün.

  | Puan | Not |
  |---|---|
  | 85–100 | 5 (Pekiyi) |
  | 70–84 | 4 (İyi) |
  | 60–69 | 3 (Orta) |
  | 50–59 | 2 (Geçer) |
  | 0–49 | 1 (Geçmez) |
  | 100'den büyük | 0 (geçersiz puan) |

  Sınırlara dikkat: 85 → 5 ama 84 → 4!
starter: |
  fn karne_notu(puan: u32) -> u32 {
      todo!()
  }

  fn main() {
      println!("92 puan → {}", karne_notu(92));
      println!("67 puan → {}", karne_notu(67));
      println!("140 puan → {}", karne_notu(140));
  }
solution: |
  fn karne_notu(puan: u32) -> u32 {
      if puan > 100 {
          0
      } else if puan >= 85 {
          5
      } else if puan >= 70 {
          4
      } else if puan >= 60 {
          3
      } else if puan >= 50 {
          2
      } else {
          1
      }
  }

  fn main() {
      println!("92 puan → {}", karne_notu(92));
      println!("67 puan → {}", karne_notu(67));
      println!("140 puan → {}", karne_notu(140));
  }
check: tests
tests: |
  #[test]
  fn pekiyi_sinirlari() {
      assert_eq!(karne_notu(100), 5, "100 puan → 5");
      assert_eq!(karne_notu(85), 5, "85 puan tam sınırda → 5");
  }

  #[test]
  fn iyi_ve_orta_sinirlari() {
      assert_eq!(karne_notu(84), 4, "84 puan → 4 (85'in bir altı)");
      assert_eq!(karne_notu(70), 4, "70 puan → 4");
      assert_eq!(karne_notu(69), 3, "69 puan → 3");
      assert_eq!(karne_notu(60), 3, "60 puan → 3");
  }

  #[test]
  fn gecer_ve_gecmez_sinirlari() {
      assert_eq!(karne_notu(59), 2, "59 puan → 2");
      assert_eq!(karne_notu(50), 2, "50 puan → 2");
      assert_eq!(karne_notu(49), 1, "49 puan → 1");
      assert_eq!(karne_notu(0), 1, "0 puan → 1");
  }

  #[test]
  fn gecersiz_puan() {
      assert_eq!(karne_notu(101), 0, "100'den büyük puan geçersizdir → 0");
      assert_eq!(karne_notu(250), 0, "250 puan geçersizdir → 0");
  }
hints:
  - "Bir `if / else if / else` zinciri kur. Koşullar yukarıdan aşağıya denenir ve ilk doğru olan kazanır, sıralama çok önemli."
  - "Önce geçersiz durumu yakala: `if puan > 100 { 0 }`. Sonra büyükten küçüğe in: `else if puan >= 85 { 5 } else if puan >= 70 { 4 } ...`"
  - "Zincirin tamamı tek bir ifade: Gövdenin son ifadesi olarak noktalı virgülsüz bırak ve en sona `else { 1 }` koy."
explanation: |
  Zincir **en dar koşuldan en genişe** doğru sıralandı. Her dal öncekilerin yanlış olduğunu bildiği için
  yalnızca alt sınırı yazmak yetiyor: `puan >= 70` dalına gelen puan zaten 85'ten küçüktür.

  Geçersiz durumu en başa koyduk; aksi hâlde 140 puan `puan >= 85` dalına düşüp 5 alırdı. Aynı fikri bir
  koruma koşuluyla da yazabilirdin: `if puan > 100 { return 0; }` ve ardından zincir.

  Geçersiz puan için 0 gibi "özel bir değer" döndürmek geçici bir çözüm: Çağıran kişi 0'ı yanlışlıkla
  gerçek bir not sanabilir. Modül 7'de `Option`, Modül 10'da `Result` ile bunun çok daha güvenli yolunu
  göreceksin. Ayrıca Modül 7'deki `match` ile `85..=100 => 5` gibi aralık desenleri yazmak da mümkün olacak.
```

````exercise
id: m03-e-artik-yil
title: Şubat kaç çeker?
difficulty: 3
prompt: |
  Bir takvim uygulaması Şubat'ın kaç gün çektiğini bilmeli. İki fonksiyonu tamamla:

  1. `artik_yil_mi(yil: u32) -> bool` - Gregoryen takvimin kuralları:
     - 4'e bölünebilen yıllar artık yıldır,
     - **ama** 100'e bölünebilenler artık yıl değildir,
     - **ama** 400'e bölünebilenler yine artık yıldır.
  2. `subat_gun_sayisi(yil: u32) -> u32` - Artık yılda 29, diğer yıllarda 28 döndürsün. İçinde
     `artik_yil_mi` fonksiyonunu çağır ve `if`'i bir ifade olarak kullan.

  Örnekler: 2024 artık yıl, 2023 değil; 1900 değil (100'e bölünüyor), 2000 artık yıl (400'e bölünüyor).
  Hatırlatma: "`a`, `b`'ye bölünür" demek `a % b == 0` demektir.
starter: |
  fn artik_yil_mi(yil: u32) -> bool {
      todo!()
  }

  fn subat_gun_sayisi(yil: u32) -> u32 {
      todo!()
  }

  fn main() {
      println!("2024 Şubat: {} gün", subat_gun_sayisi(2024));
      println!("1900 Şubat: {} gün", subat_gun_sayisi(1900));
  }
solution: |
  fn artik_yil_mi(yil: u32) -> bool {
      if yil % 400 == 0 {
          true
      } else if yil % 100 == 0 {
          false
      } else {
          yil % 4 == 0
      }
  }

  fn subat_gun_sayisi(yil: u32) -> u32 {
      if artik_yil_mi(yil) { 29 } else { 28 }
  }

  fn main() {
      println!("2024 Şubat: {} gün", subat_gun_sayisi(2024));
      println!("1900 Şubat: {} gün", subat_gun_sayisi(1900));
  }
check: tests
tests: |
  #[test]
  fn dorde_bolunen_yillar() {
      assert!(artik_yil_mi(2024), "2024, 4'e bölünür ve 100'e bölünmez: artık yıl");
      assert!(!artik_yil_mi(2023), "2023, 4'e bölünmez: artık yıl değil");
  }

  #[test]
  fn yuze_bolunenler_istisnadir() {
      assert!(!artik_yil_mi(1900), "1900, 100'e bölünür ama 400'e bölünmez: artık yıl DEĞİL");
      assert!(!artik_yil_mi(2100), "2100, 100'e bölünür ama 400'e bölünmez: artık yıl DEĞİL");
      assert!(!artik_yil_mi(1700), "1700, 100'e bölünür ama 400'e bölünmez: artık yıl DEĞİL");
      assert!(!artik_yil_mi(1800), "1800, 100'e bölünür ama 400'e bölünmez: artık yıl DEĞİL");
  }

  #[test]
  fn dort_yuze_bolunenler_yine_artiktir() {
      assert!(artik_yil_mi(2000), "2000, 400'e bölünür: artık yıl");
      assert!(artik_yil_mi(1600), "1600, 400'e bölünür: artık yıl");
      assert!(artik_yil_mi(2400), "2400, 400'e bölünür: artık yıl");
  }

  #[test]
  fn siradan_yillar() {
      assert!(artik_yil_mi(1996), "1996, 4'e bölünür ve 100'e bölünmez: artık yıl");
      assert!(!artik_yil_mi(1999), "1999, 4'e bölünmez: artık yıl değil");
      assert!(!artik_yil_mi(2022), "2022, 2'ye bölünür ama 4'e bölünmez: artık yıl değil");
  }

  #[test]
  fn subat_gunleri() {
      assert_eq!(subat_gun_sayisi(2024), 29, "2024'te Şubat 29 gün çeker");
      assert_eq!(subat_gun_sayisi(2023), 28, "2023'te Şubat 28 gün çeker");
      assert_eq!(subat_gun_sayisi(1900), 28, "1900'de Şubat 28 gün çeker");
      assert_eq!(subat_gun_sayisi(2000), 29, "2000'de Şubat 29 gün çeker");
  }
hints:
  - "Bölünebilirlik `yil % 4 == 0` ile sınanır. Kuralları **en özel olandan** başlayarak dene: önce 400, sonra 100, en son 4."
  - "İskelet: `if yil % 400 == 0 { true } else if yil % 100 == 0 { false } else { yil % 4 == 0 }`. Sırayı değiştirirsen 1900 ya da 2000 testlerinden biri kırılır."
  - "`subat_gun_sayisi` tek satır olabilir: `if artik_yil_mi(yil) { 29 } else { 28 }`"
require:
  - pattern: "fn\\s+subat_gun_sayisi(?:(?!\\bfn\\b)[\\s\\S])*\\bartik_yil_mi\\s*\\("
    message: "`subat_gun_sayisi` artık yıl kuralını yeniden yazmamalı; gövdesinde `artik_yil_mi` fonksiyonunu çağır."
explanation: |
  Kurallar iç içe istisnalar içerdiği için `else if` zincirini **en özel kuraldan** başlattık: 400'e
  bölünen bir yıl 100'e de, 4'e de bölünür; önce onu yakalamazsak 2000 yanlışlıkla "100'e bölünüyor,
  artık değil" dalına düşerdi.

  Aynı mantık mantıksal operatörlerle tek bir ifade olarak da yazılabilir:

  ```rust
  fn artik_yil_mi(yil: u32) -> bool {
      (yil % 4 == 0 && yil % 100 != 0) || yil % 400 == 0
  }
  ```

  Hangisi daha okunaklı? Zevk meselesi; önemli olan, sınır durumlarını (1900, 2000) testlerle güvenceye
  almak.

  Peki bu tuhaf kural nereden geliyor? Mevsimlerin bir tam döngüsü (tropikal yıl) yaklaşık **365,2422**
  gündür. Her 4 yılda bir gün eklemek ortalama yılı 365,25 gün yapar, yani biraz fazla düzeltir. Bu
  fazlalık 400 yılda yaklaşık 3 güne ulaşır; 100'e bölünen yıllardan üçünü artık yıl saymamak bu farkı
  kapatır ve ortalama yıl 365,2425 güne iner - gerçeğe çok yakın. Fonksiyonun gerçek dünyayı modellediği
  güzel bir örnek!
````

## Özet

:::remember
- `if kosul { ... } else if kosul2 { ... } else { ... }`: Koşulun etrafında parantez yok, süslü
  parantezler zorunlu.
- Koşul **her zaman `bool`**: `if sayi` değil `if sayi != 0` (`E0308`); `0 <= x <= 100` değil
  `0 <= x && x <= 100`.
- Zincirde **ilk doğru dal** çalışır; en dar koşulu en üste koy.
- `if` bir ifadedir: `let x = if k { a } else { b };`. Dallar aynı tipte olmalı (`E0308`); değer olarak
  kullanılan `if`'in `else`'i olmalı (`E0317`).
- `&&` ve `||` kısa devre yapar. İç içe `if`'leri `&&` ile ya da erken dönüşle (guard clause) düzleştir.
:::

```reflect
prompt: |
  Rust'ta `if`'in koşulunun mutlaka `bool` olması seni hangi hatalardan korur? C ya da JavaScript'ten
  bir örnekle kendi cümlelerinle anlat.
answer: |
  Model cevap: Rust sayıları, boş metinleri ya da başka değerleri gizlice doğru/yanlışa çevirmez; bu
  yüzden ne kastettiğimi açıkça yazmak zorundayım (`sayi != 0`). C'de `if (x = 5)` yazınca karşılaştırma
  yerine atama yapılır ve koşul hep doğru olur; Rust'ta bu derlenmez, çünkü atamanın değeri `()`'dir ve
  koşul `bool` olmalıdır. JavaScript'te `"0"` metni doğru sayılır ve sürpriz hatalara yol açar; Rust'ta
  böyle bir belirsizlik yoktur. Kod biraz uzar ama herkes aynı şeyi okur.
```

```flashcards
- front: "`if elma_sayisi { ... }` (`elma_sayisi: i32`) neden derlenmez?"
  back: "Koşul `bool` olmalı (`E0308`); Rust tamsayıyı doğru/yanlışa çevirmez. Doğrusu: `if elma_sayisi > 0`."
- front: "C'deki `kosul ? a : b` üçlü operatörünün Rust'taki karşılığı nedir?"
  back: "`if kosul { a } else { b }`, çünkü `if` zaten bir ifadedir."
- front: "`E0317` hatası neyi anlatır?"
  back: "Değer olarak kullanılan bir `if`'in `else` dalı yok; koşul yanlışsa `()` üretilir ve tipler uyuşmaz."
- front: '`let x = if k { 1 } else { "bir" };` neden derlenmez?'
  back: "Dallar farklı tipte değer üretiyor (`if` and `else` have incompatible types, `E0308`); bütün dallar aynı tipte olmalı."
- front: Bir `else if` zincirinde birden çok koşul doğruysa hangi dal çalışır?
  back: Yalnızca yukarıdan aşağıya ilk doğru olan; geri kalanlar sınanmaz bile.
- front: "`bolen != 0 && bolunen / bolen > 2` ifadesi `bolen` 0 iken neden panik yapmaz?"
  back: "`&&` kısa devre yapar: Sol taraf `false` olduğu için sağdaki bölme hiç hesaplanmaz."
- front: Python'daki `0 <= puan <= 100` Rust'ta nasıl yazılır?
  back: "`0 <= puan && puan <= 100`, Rust'ta karşılaştırma operatörleri zincirlenemez."
- front: "`if kosul { true } else { false }` nasıl sadeleştirilir?"
  back: "Doğrudan `kosul` yazılır."
```
