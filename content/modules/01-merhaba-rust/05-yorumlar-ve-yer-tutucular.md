---
id: m01-l05
title: Yorumlar ve yer tutucular
minutes: 17
type: lesson
objectives:
  - "`//` ve `/* */` yorumlarını doğru yerde kullanıp iyi bir yorumun neyi anlatması gerektiğini açıklayabilmek"
  - "`{}`, `{0}`, `{ad}` ve satır içi `{x}` yer tutucularıyla değerleri metnin içine yerleştirebilmek"
  - "`{}` (Display) ile `{:?}` (Debug) arasındaki farkı söyleyip duruma göre doğrusunu seçebilmek"
  - Biçim metnindeki argüman sayısı uyuşmazlığı hatalarını okuyup düzeltebilmek
keywords: [yorum, "//", "/* */", "///", println!, yer tutucu, "{}", "{:?}", Debug, Display, biçim metni]
---

Şimdiye kadar yazdığın her program, önceden bildiğin sabit metinleri ekrana bastı. Ama gerçek
programlar **değişen** bilgiler gösterir: kullanıcının adı, sepetteki ürün sayısı, hava sıcaklığı...
Bu derste değerleri metnin içine yerleştirmeyi öğreneceksin. Önce de kodunun içine, derleyicinin
görmezden geldiği ama okuyan insanlar için altın değerinde olan notlar düşmeyi: **yorumlar**.

## Yorumlar: kodu insanlara anlatmak

Kod iki okuyucu için yazılır: **derleyici** ve **insanlar** (altı ay sonraki sen de dahil!).
**Yorumlar** (*comments*) yalnızca insanlar içindir; derleyici onları tamamen yok sayar.

```rust
// Bu bir satır yorumudur: // işaretinden satır sonuna kadar her şey yok sayılır.
fn main() {
    println!("Çay hazır!"); // Satırın sonuna da yorum yazılabilir.

    /* Bu bir blok yorumudur.
       Birden fazla satıra yayılabilir. */
    println!("Afiyet olsun!");

    // println!("Bu satır yorum yapıldığı için çalışmaz.");
}
```

İki tür yorum var:

| Sözdizimi | Adı | Nereye kadar? |
|---|---|---|
| `// ...` | Satır yorumu (*line comment*) | Satırın sonuna kadar |
| `/* ... */` | Blok yorumu (*block comment*) | Kapanış `*/`'a kadar (birden fazla satır olabilir) |

Rust topluluğu neredeyse her zaman `//` kullanır; birden fazla satırlık bir açıklama için de her
satırın başına `//` koyar. `/* */` daha çok bir satırın **ortasındaki** küçük notlar için kullanılır.
Son satırdaki gibi bir kod satırını geçici olarak devre dışı bırakmak da yorumların sık kullanımıdır
("yorum satırı yapmak"). VS Code'da imleç bir satırdayken **Ctrl+/** tuşlarına basmak, o satırın
başına `//` ekler ya da kaldırır.

Şimdi bir tahmin: C dilinde bir blok yorumunun içine ikinci bir blok yorumu koyarsan, ilk `*/`
yorumu bitirir ve geri kalan metin kod sanılır. Rust'ta durum ne?

```compiles
question: |
  Bir blok yorumunun içinde ikinci bir blok yorumu var. Bu kod derlenir mi?
code: |
  fn main() {
      /* Dış yorum başlıyor
         /* iç yorum */
         dış yorum hâlâ devam ediyor */
      println!("Derlendi!");
  }
answer: true
explanation: |
  **Derlenir!** Rust'ta blok yorumları **iç içe** (*nested*) yazılabilir: Derleyici açılan her `/*`'ı
  sayar ve her birinin kendi `*/`'ıyla kapanmasını bekler. C, C++, Java ve JavaScript'te ise ilk
  `*/` yorumu bitirirdi; `dış yorum hâlâ devam ediyor */` satırı kod sanılır ve hata verirdi.
  Bu küçük tasarım kararı sayesinde içinde zaten yorum olan bir kod parçasını güvenle
  `/* ... */` içine alabilirsin.
```

:::analogy Yemek tarifindeki kenar notları
Anneannenin tarif defterini düşün: "2 su bardağı un" yazan satırın kenarında küçük bir not var:
"Un nemliyse biraz daha ekle, yoksa hamur yapışır." Tarif bu not olmadan da çalışır, ama not
**neden**i anlatır ve seni hatadan korur. İyi bir yorum da kodun **ne** yaptığını değil, **neden**
öyle yaptığını anlatır; ne yaptığını zaten kodun kendisi söyler.
:::

```rust
fn main() {
    // KÖTÜ: Kodu tekrar ediyor, yeni bilgi vermiyor.
    // "Sepet boş" yazdır.
    println!("Sepet boş");

    // İYİ: Okuyucunun koda bakarak bilemeyeceği şeyi anlatıyor.
    // Kargo ücreti 2025 kampanyası gereği tüm siparişlerde sıfır.
    println!("Kargo: 0 TL");
}
```

**Belge yorumları** (*doc comments*) özel bir yorum türüdür: `///` ile başlarlar ve hemen altındaki
öğeyi (örneğin bir fonksiyonu) belgelerler. `cargo doc` komutu bu yorumlardan, Rust'ın resmî
belgeleri gibi görünen bir HTML sitesi üretir. İçlerine Markdown ve hatta **test edilen** kod
örnekleri yazılabilir. Şimdilik yalnızca tanı; fonksiyonları Modül 3'te, belge yazmayı ise Modül 8
ve 13'te ayrıntılı göreceksin.

```rust
/// Kullanıcıyı selamlar.
///
/// Bu yorum `cargo doc` ile üretilen belgelerde görünür.
fn selamla() {
    println!("Hoş geldin!");
}

fn main() {
    selamla();
}
```

:::info Yorumlar programı yavaşlatır mı?
Hayır. Derleyici yorumları ilk okuma aşamasında atar; makine koduna tek bir bayt bile yorum
girmez. `main.exe`'nin boyutu da hızı da yorumlardan etkilenmez. Python gibi yorumlanan dillerde de
yorumlar çalışma sırasında atlanır, ama Rust'ta bu iş program çalışmadan önce, bir kez yapılır.
:::

## İlk yer tutucu: {}

Önce tahmin et, sonra öğren. Bu kod ne yazdırır?

```predict
code: |
  fn main() {
      println!("{} + {} = {}", 2, 3, 2 + 3);
  }
options:
  - |
    {} + {} = {}
  - |
    2 + 3 = 5
  - |
    2 + 3 = 2 + 3
  - |
    23 + 5 =
answer: 1
explanation: |
  `println!`'in ilk argümanı **biçim metnidir** (*format string*). İçindeki her `{}` bir **yer
  tutucudur** (*placeholder*): Virgülden sonra gelen değerler, **soldan sağa sırayla** yer
  tutucuların yerine yazılır. Üçüncü değer olan `2 + 3` yazdırılmadan önce hesaplanır, bu yüzden
  ekranda `5` görünür.
```

Kural basit: Biçim metnindeki `{}`'ler sırayla doldurulur. Birinci `{}` birinci değeri, ikinci `{}`
ikinci değeri alır. Değerler sayı, metin ya da hesaplanacak bir ifade olabilir:

```rust
fn main() {
    println!("Ad: {}", "Ferris");
    println!("{} yaşında, {} cm boyunda", 8, 21);
    println!("Bir haftada {} saat var.", 7 * 24);
    println!("{} 🦀 {}", "Rust", "çok eğlenceli");
}
```

:::analogy Boşluklu dilekçe formu
Okulun verdiği hazır bir dilekçe formunu düşün: "Ben, ______ sınıfı öğrencisi ______, ______
tarihinde izin istiyorum." Formdaki **boşluk sayısı** ile senin yazdığın **bilgi sayısı** tutmalı ve
bilgiler boşluklara **sırayla** yazılır. Biçim metni formdur, `{}`'ler boşluklardır, virgülden
sonraki değerler de boşluklara yazdığın bilgilerdir.
:::

Peki boşluk sayısı tutmazsa? C'de `printf("%d elma, %d armut\n", 5);` derlenir ve ikinci sayının
yerine bellekte o an ne varsa onu yazdırır — **tanımsız davranış**. Rust'ta ise program hiç
derlenmez:

:::error
```text
error: 2 positional arguments in format string, but there is 1 argument
 --> src/main.rs:2:15
  |
2 |     println!("{} elma, {} armut", 5);
  |               ^^       ^^         -
```
"Biçim metninde 2 yer tutucu var, ama yalnızca 1 argüman verdin." Derleyici iki `{}`'yi `^^` ile,
tek argümanı `-` ile işaretliyor. Bunu yapabiliyor, çünkü `println!` bir **makro**: Biçim metnini
derleme sırasında inceliyor (3. dersi hatırla).
:::

Fazla argüman vermek de hatadır; Rust "unuttuğun bir şey mi var?" diye düşünür:

:::error
```text
error: argument never used
 --> src/main.rs:2:28
  |
2 |     println!("{} elma", 5, 3);
  |              ---------     ^ argument never used
  |              |
  |              formatting specifier missing
```
`3` hiçbir yer tutucuya karşılık gelmiyor ("argument never used"). Derleyici biçim metnini de
işaretleyip ipucu veriyor: "bir biçim belirteci eksik" (*formatting specifier missing*).
:::

## Değişkenler ve satır içi {x}

Değerleri her seferinde elle yazmak yerine onlara bir **ad** verebilirsin. Bunun için kısa bir
önizleme yapmamız gerekiyor: `let ad = "Ayşe";` satırı `"Ayşe"` değerine `ad` adını verir. Buna
**değişken** (*variable*) denir; değişkenleri Modül 2'de bütün ayrıntılarıyla öğreneceksin. Şimdilik
"bir değere verilen ad" demen yeterli.

```rust
fn main() {
    let ad = "Ayşe";
    let sinif = 9;
    println!("{}, {}. sınıfta okuyor.", ad, sinif);
    println!("{ad}, {sinif}. sınıfta okuyor.");
}
```

İki satır aynı çıktıyı verir. İkincisinde değişkenin adını **doğrudan süslü parantezin içine**
yazdık. Buna **satır içi biçim argümanı** (*inlined format argument*) denir ve okunması çok daha
kolaydır: Hangi değerin nereye gideceğini görmek için virgülleri saymana gerek kalmaz. Rust 1.58
sürümünden (2022) beri kullanılabilen bu biçim, bugün Rust topluluğunun tercih ettiği yazımdır; Rusteach'te de çoğu
zaman bunu kullanacağız.

Şimdi bir sınır deneyelim. Sence bu derlenir mi?

```compiles
code: |
  fn main() {
      let fiyat = 25;
      println!("İki tanesi {fiyat * 2} TL");
  }
answer: false
explanation: |
  Derlenmez! Süslü parantezin içine yalnızca bir **değişken adı** yazılabilir; hesaplama gibi
  ifadeler yazılamaz:

  ```text
  error: invalid format string: expected `}`, found `*`
   --> src/main.rs:3:33
    |
  3 |     println!("İki tanesi {fiyat * 2} TL");
    |                          -      ^ expected `}` in format string
    |                          |
    |                          because of this opening brace
    |
    = note: if you intended to print `{`, you can escape it using `{{`
  ```

  Derleyici `{fiyat`'tan sonra `}` bekliyordu, ama `*` gördü. Çözüm: İfadeyi argüman olarak ver
  (`println!("İki tanesi {} TL", fiyat * 2);`) ya da sonucu önce bir değişkene koy.
```

Neden böyle bir sınır var? Biçim metni bir **metindir**; içine istediğin kodu yazabilseydin, hem
derleyicinin hem de okuyanın metin ile kodu ayırt etmesi zorlaşırdı. Python'un f-string'leri
(`f"{fiyat * 2}"`) ve JavaScript'in şablon metinleri (`` `${fiyat * 2}` ``) içeride ifadeye izin
verir; Rust bilerek daha sade bir yol seçmiş: **Ad içeride, hesap dışarıda.**

```rust
fn main() {
    let fiyat = 25;
    let iki_tane = fiyat * 2;
    println!("Bir tanesi {fiyat} TL, iki tanesi {iki_tane} TL");
    println!("Üç tanesi {} TL", fiyat * 3);
}
```

:::warning Adı yanlış yazarsan
Süslü parantezin içindeki ad, gerçekten var olan bir değişkenin adı olmalı. `let ad = "Ayşe";`
yazıp `println!("Merhaba {adi}");` dersen:
```text
error[E0425]: cannot find value `adi` in this scope
 --> src/main.rs:3:24
  |
3 |     println!("Merhaba {adi}");
  |                        ^^^
  |
help: a local variable with a similar name exists
  |
3 -     println!("Merhaba {adi}");
3 +     println!("Merhaba {ad}");
  |
```
"Bu kapsamda `adi` adında bir değer bulamadım. Benzer adlı bir değişken var: `ad`." Derleyici
yazım hatanı yakalayıp düzeltmesini bile öneriyor. Bu hata kodunu (E0425) 7. derste yeniden
göreceksin.
:::

## Sıra numaralı ve isimli argümanlar

Bazen aynı değeri metinde birden fazla kez kullanmak ya da değerleri farklı bir sırayla
yerleştirmek istersin. Bunun için yer tutucunun içine bir **sıra numarası** yazabilirsin:

```rust
fn main() {
    println!("{0} dedi ki: \"{1}, {1}!\" {0} gülümsedi.", "Ferris", "Merhaba");
    println!("{1} {0}", "Dünya", "Merhaba");
}
```

Numaralar **sıfırdan başlar**: `{0}` birinci argüman, `{1}` ikinci argümandır. Programcılıkta sayma
çoğu zaman 0'dan başlar; bunu ileride dizilerde (Modül 2) yeniden göreceksin. Var olmayan bir
numara yazarsan derleyici seni yine uyarır:

:::error
```text
error: invalid reference to positional argument 1 (there is 1 argument)
 --> src/main.rs:2:20
  |
2 |     println!("{0} {1} {0}", "a");
  |                    ^
  |
  = note: positional arguments are zero-based
```
`note` satırı kilit bilgiyi veriyor: "Sıra numaralı argümanlar sıfırdan başlar." Tek bir argüman
varsa geçerli tek numara `{0}`'dır.
:::

Sıra numarası yerine bir **ad** da verebilirsin. Bu kez ad, argüman listesinde `ad = değer`
biçiminde tanımlanır; bir değişken olması gerekmez:

```rust
fn main() {
    println!("{sehir} ili {plaka} plakalıdır. {sehir} güzeldir!", sehir = "Isparta", plaka = 32);
}
```

Dört yolu bir arada görelim:

| Yazım | Değer nereden gelir? | Ne zaman? |
|---|---|---|
| `{}` | Sıradaki argüman | Kısa, tek seferlik değerler; hesaplanan ifadeler |
| `{0}`, `{1}` | Belirtilen sıradaki argüman | Aynı değeri tekrar kullanmak, sırayı değiştirmek |
| `{ad}` + `ad = değer` | Aynı adlı isimli argüman | Uzun biçim metinlerinde okunabilirlik |
| `{ad}` (tek başına) | Kapsamdaki `ad` değişkeni | **Çoğu durumda ilk tercih** |

```fill
prompt: |
  Boşlukları doldur. Program `Kedi miyavlar, köpek havlar. Kedi uyur.` yazmalı. Her boşluğa bir
  yer tutucu yaz; değerleri **tekrar yazmadan**, sıra numaralarıyla kullan.
code: |
  fn main() {
      println!("___0 miyavlar, ___1 havlar. ___2 uyur.", "Kedi", "köpek");
  }
blanks:
  - ["{0}"]
  - ["{1}"]
  - ["{0}"]
explanation: |
  `"Kedi"` 0 numaralı, `"köpek"` 1 numaralı argümandır. "Kedi" iki kez kullanıldığı için düz `{}`
  burada işe yaramaz: Üçüncü `{}` üçüncü bir argüman arardı ve derleme hatası alırdın. `{0}` ise
  aynı argümanı istediğin kadar tekrar kullanmanı sağlar.
```

## {:?}: programcı için yazdırma

Şimdiye kadarki `{}` yer tutucusu değeri **kullanıcıya gösterilecek** biçimde yazar. Rust'ın bir de
**programcıya gösterilecek** bir biçimi var. Farkı görmek için önce tahmin et:

```predict
code: |
  fn main() {
      let soz = "Ali \"Usta\" geldi";
      println!("{soz}");
      println!("{soz:?}");
      println!("{:?}", 'A');
  }
options:
  - |
    Ali "Usta" geldi
    "Ali \"Usta\" geldi"
    'A'
  - |
    Ali "Usta" geldi
    Ali "Usta" geldi
    A
  - |
    "Ali \"Usta\" geldi"
    Ali "Usta" geldi
    A
answer: 0
explanation: |
  `{}` değeri olduğu gibi, son kullanıcıya göstereceğin biçimde yazar. `{:?}` ise değeri **kodda
  nasıl yazılacaksa öyle** gösterir: Metnin etrafına tırnak koyar, içindeki özel karakterleri kaçış
  dizileriyle (`\"`) yazar; tek karakteri de tek tırnakla gösterir. Satır içi biçimde `:?`, değişken
  adından sonra gelir: `{soz:?}`.
```

Bu iki biçimin adları var:

- **`{}` → Display** ("gösterim"): Son kullanıcı için; temiz ve okunaklı.
- **`{:?}` → Debug** ("hata ayıklama"): Programcı için; değerin içinde **tam olarak** ne olduğunu,
  gizli boşlukları ve özel karakterleri bile gösterir.

Debug biçimi, bir şeylerin neden beklediğin gibi çalışmadığını araştırırken hayat kurtarır. Mesela
bir metnin sonunda göremediğin bir boşluk ya da `\n` varsa, `{}` onu sana göstermez ama `{:?}`
gösterir.

:::analogy Vitrin ve depo
Bir mağazanın vitrini (**Display**) müşteriler için düzenlenmiştir: Ürünler güzelce dizilmiş,
etiketler temiz. Depo (**Debug**) ise çalışanlar içindir: Kutuların üzerinde barkodlar, raf
numaraları, stok notları... Aynı ürünler, farklı amaçlar için farklı gösterilir.
:::

Bazı değerler **yalnızca** Debug biçimiyle yazdırılabilir, çünkü onları kullanıcıya göstermenin tek
bir "doğru" yolu yoktur. Örneğin birkaç değeri parantez içinde gruplayan **tuple**'lar (Modül 2'de
öğreneceksin). Sence bu derlenir mi?

```compiles
code: |
  fn main() {
      println!("{}", (1, "iki"));
  }
answer: false
error: E0277
explanation: |
  Derlenmez. `(1, "iki")` bir tuple'dır ve tuple'ların Display biçimi yoktur:

  ```text
  error[E0277]: `({integer}, &str)` doesn't implement `std::fmt::Display`
   --> src/main.rs:2:20
    |
  2 |     println!("{}", (1, "iki"));
    |               --   ^^^^^^^^^^ `({integer}, &str)` cannot be formatted with the default formatter
    |               |
    |               required by this formatting parameter
    |
    = help: the trait `std::fmt::Display` is not implemented for `({integer}, &str)`
    = note: in format strings you may be able to use `{:?}` (or `{:#?}` for pretty-print) instead
  ```

  Son satırdaki `note` çözümü söylüyor: `{:?}` kullan. `println!("{:?}", (1, "iki"));` derlenir ve
  `(1, "iki")` yazar. Tipleri (`{integer}`, `&str`) ve "trait"i şimdilik dert etme; ileride hepsini
  öğreneceksin.
```

Derleyicinin önerdiği `{:#?}` ise Debug'ın **güzel yazdırılmış** (*pretty-print*) hâlidir: Değeri
birden fazla satıra, girintili olarak böler. Büyük ve iç içe değerlerde çok işe yarar:

```rust
fn main() {
    println!("{:?}", (1, "iki", 3.5));
    println!("{:#?}", (1, "iki", 3.5));
}
```

:::deep Display ve Debug aslında birer trait
`{}` ve `{:?}`'nin arkasında `std::fmt::Display` ve `std::fmt::Debug` adlı iki **trait** vardır.
Trait, bir tipin "yapabildiği" bir davranışı tanımlar. Sayılar ve metinler ikisini de destekler;
tuple'lar ve diziler yalnızca Debug'ı. Kendi tiplerini yazdığında (Modül 6) Debug'ı tek satırla
`#[derive(Debug)]` ekleyerek kazanırsın; Display'i ise kendin yazman gerekir, çünkü "kullanıcıya
nasıl görüneceğine" yalnızca sen karar verebilirsin. Trait'leri Modül 11'de derinlemesine göreceğiz.
:::

## Süslü parantezler ve hepsi bir arada

Süslü parantez biçim metninde özel bir anlam taşıyorsa, ekrana gerçek bir `{` nasıl yazılır?

```rust,compile_fail
fn main() {
    println!("Küme: {1, 2, 3}");
}
```

:::error
```text
error: invalid format string: python's numeric grouping `,` is not supported in rust format strings
 --> src/main.rs:2:23
  |
2 |     println!("Küme: {1, 2, 3}");
  |                     - ^ expected `}` in format string
  |                     |
  |                     because of this opening brace
  |
  = note: to print `{`, you can escape it using `{{`
```
Derleyici `{1`'i bir yer tutucu sandı ve virgülü anlamadı (Python'daki bir biçimlendirme özelliğine
benzettiği için onu da anıyor). Ama en önemli bilgi `note` satırında: **`{` yazdırmak için `{{`
kullan.**
:::

Biçim metninde `{{` ekrana `{`, `}}` ekrana `}` yazar. Yani süslü parantezi **iki kez** yazarak
"kaçırırsın" — tıpkı metinlerde `\\` yazıp tek `\` elde ettiğin gibi.

```predict
code: |
  fn main() {
      let ad = "Ferris";
      println!("{{ad}} = {ad}");
      println!("{{{ad}}}");
  }
options:
  - |
    {ad} = Ferris
    {Ferris}
  - |
    {Ferris} = Ferris
    {{Ferris}}
  - |
    {ad} = Ferris
    {{ad}}
answer: 0
explanation: |
  `{{ad}}` yer tutucu değildir: `{{` bir `{`, `ad` düz metin, `}}` bir `}` olur. İkinci satırdaki
  `{{{ad}}}` ise soldan sağa şöyle okunur: `{{` → `{`, `{ad}` → `Ferris`, `}}` → `}`. Sonuç:
  `{Ferris}`.
```

Bu teknik, örneğin JSON gibi süslü parantezle yazılan veri biçimlerini elle üretirken çok işe yarar:

```rust
fn main() {
    let urun = "simit";
    let fiyat = 15;
    println!("{{\"urun\": \"{urun}\", \"fiyat\": {fiyat}}}");
}
```

### Hepsi bir arada

Öğrendiklerini bir **worked example** (çözümlü örnek) üzerinde birleştirelim. Bir kütüphanenin ödünç
fişini yazdıran program:

```rust
fn main() {
    // Fişte gösterilecek bilgiler
    let uye = "Mehmet Yılmaz";
    let kitap = "Kürk Mantolu Madonna";
    let gun = 14;

    println!("Üye: {uye}");
    println!("Kitap: {kitap:?}"); // Debug biçimi kitabın adını tırnak içinde gösterir.
    println!("Süre: {gun} gün ({} hafta)", gun / 7);
    println!("Not: {{iade}} tarihi geçerse ceza uygulanır.");
}
```

Her satırda farklı bir araç var: satır içi `{uye}`, Debug için `{kitap:?}`, hesaplama için argümanlı
`{}`, ve düz metin süslü parantezler için `{{ }}`. Şimdi bir program kurma sırası sende:

````parsons
prompt: |
  Satırları sıraya koy. Program şunu yazdırmalı:

  ```text
  Oyuncu: Ferris
  Puan: 120
  ```

  Dikkat: Hatalı satırlar da var.
lines: |
  fn main() {
      // Oyuncu bilgileri
      let oyuncu = "Ferris";
      let puan = 120;
      println!("Oyuncu: {oyuncu}");
      println!("Puan: {}", puan);
  }
distractors: |
      println!("Puan: {}");
      println!("Oyuncu: {oyuncu:?}");
explanation: |
  Değişkenler kullanılmadan **önce** tanımlanmalıdır, bu yüzden `let` satırları `println!`'lerden
  önce gelir. Hatalı satırlardan `println!("Puan: {}");` yer tutucuyu dolduracak argümanı
  unutuyor (derleme hatası); `{oyuncu:?}` ise ekrana tırnaklı `"Ferris"` yazardı.
````

İlk alıştırma: Bir karne satırı.

````exercise
id: m01-e-karne-satiri
title: Karne satırı
difficulty: 1
prompt: |
  Programda üç değişken hazır: `ogrenci`, `ders` ve `puan`. `println!` satırlarını, bu değişkenleri
  yer tutucularla kullanarak tam olarak şu çıktıyı üretecek şekilde yeniden yaz:

  ```text
  Öğrenci: Zeynep
  Ders: Matematik, Puan: 87
  ```

  Kural: `Zeynep`, `Matematik` ve `87` değerlerini **yeniden yazma**; değişkenleri kullan. (Değişkenin
  değerini değiştirdiğinde çıktının da kendiliğinden değişmesi gerekir.)
starter: |
  fn main() {
      let ogrenci = "Zeynep";
      let ders = "Matematik";
      let puan = 87;
      // Aşağıdaki satırları yer tutucularla yeniden yaz:
      println!("Öğrenci: ...");
      println!("Ders: ..., Puan: ...");
  }
solution: |
  fn main() {
      let ogrenci = "Zeynep";
      let ders = "Matematik";
      let puan = 87;
      println!("Öğrenci: {ogrenci}");
      println!("Ders: {ders}, Puan: {puan}");
  }
check: output
expected_output: |
  Öğrenci: Zeynep
  Ders: Matematik, Puan: 87
forbid:
  - pattern: "Zeynep[\\s\\S]*Zeynep"
    message: "`Zeynep` değerini tekrar yazma; `{ogrenci}` yer tutucusunu kullan."
  - pattern: "Matematik[\\s\\S]*Matematik"
    message: "`Matematik` değerini tekrar yazma; `{ders}` yer tutucusunu kullan."
  - pattern: "87[\\s\\S]*87"
    message: "`87` değerini tekrar yazma; `{puan}` yer tutucusunu kullan."
hints:
  - |
    Değişkenin değerini metne yerleştirmek için adını süslü parantez içine yaz: `{ogrenci}` gibi.
  - |
    `...` yazan yerleri silip yerine yer tutucuları koy. Virgül ve boşlukları çıktıdaki gibi bırak.
  - |
    İkinci satır şöyle olmalı: `println!("Ders: {ders}, Puan: {puan}");`
explanation: |
  Satır içi biçim argümanları (`{ogrenci}`, `{ders}`, `{puan}`), değişkenin değerini metne doğrudan
  yerleştirir. Aynı çıktıyı sıralı yer tutucularla da üretebilirdin:

  ```rust,norun
  println!("Ders: {}, Puan: {}", ders, puan);
  ```

  Ama satır içi yazım, hangi değerin nereye gittiğini bir bakışta gösterir; özellikle yer tutucu
  sayısı arttıkça hata yapma olasılığını azaltır. Değerleri tekrar yazmamanın asıl kazancı da şu:
  `puan`'ı `92` yaparsan çıktı kendiliğinden değişir. Bir bilgiyi tek bir yerde tutmak, iyi
  programcılığın temel alışkanlıklarından biridir.
````

İkinci alıştırma biraz daha zorlu: Debug biçimini ve süslü parantez kaçırmayı da kullanacaksın.

````exercise
id: m01-e-sinema-kaydi
title: Sinema bileti kaydı
difficulty: 2
prompt: |
  Bir sinema uygulaması, satılan her bileti hem ekrana hem de kayıt dosyasına yazıyor. Değişkenleri
  kullanarak tam olarak şu iki satırı üret:

  ```text
  Film: Babam ve Oğlum | Salon: 7
  Kayıt: {"film": "Babam ve Oğlum", "salon": 7}
  ```

  Kurallar:
  - `Babam ve Oğlum` ve `7` değerlerini yeniden yazma; değişkenleri kullan.
  - İkinci satırdaki tırnakları elle yazmak yerine **Debug biçimini** (`:?`) kullan: Debug biçimi
    metni zaten tırnak içinde yazar.
starter: |
  fn main() {
      let film = "Babam ve Oğlum";
      let salon = 7;
      println!("Film: ...");
      println!("Kayıt: ...");
  }
solution: |
  fn main() {
      let film = "Babam ve Oğlum";
      let salon = 7;
      println!("Film: {film} | Salon: {salon}");
      println!("Kayıt: {{\"film\": {film:?}, \"salon\": {salon}}}");
  }
check: output
expected_output: |
  Film: Babam ve Oğlum | Salon: 7
  Kayıt: {"film": "Babam ve Oğlum", "salon": 7}
forbid:
  - pattern: "Babam[\\s\\S]*Babam"
    message: Film adını tekrar yazma; `film` değişkenini kullan.
  - pattern: "7[\\s\\S]*7"
    message: Salon numarasını tekrar yazma; `salon` değişkenini kullan.
require:
  - pattern: "film:\\?"
    message: "Film adını tırnaklı yazmak için Debug biçimini kullan: `{film:?}`"
hints:
  - |
    Birinci satır kolay: `{film}` ve `{salon}`. İkinci satırda ekrana gerçek bir `{` yazmak için
    biçim metnine `{{`, `}` için `}}` yazman gerekiyor.
  - |
    `"film"` ve `"salon"` anahtarlarının etrafındaki tırnaklar metnin parçası; onları `\"` ile yaz.
    Film adının tırnakları ise `{film:?}`'den gelecek.
  - |
    İkinci satırın sonu biraz kalabalık görünür: `\"salon\": {salon}}}` — buradaki ilk `}` yer
    tutucuyu kapatır, ardından gelen `}}` ise ekrana tek bir `}` yazar.
explanation: |
  Çözümün ikinci satırını parça parça okuyalım:

  | Biçim metninde | Ekranda |
  |---|---|
  | `{{` | `{` |
  | `\"film\": ` | `"film": ` |
  | `{film:?}` | `"Babam ve Oğlum"` |
  | `, \"salon\": ` | `, "salon": ` |
  | `{salon}` | `7` |
  | `}}` | `}` |

  `{film:?}` Debug biçimi olduğu için tırnakları kendisi ekler; film adında bir tırnak ya da özel
  karakter olsaydı onu da doğru biçimde kaçırırdı. Gerçek projelerde JSON'u elle yazmak yerine
  `serde_json` gibi bir crate kullanılır; ama o crate de perde arkasında aynı kurallarla çalışır.
````

## Özet

:::remember
- **`//`** satır sonuna kadar, **`/* */`** kapanışa kadar yorumdur; Rust'ta blok yorumları iç içe
  olabilir. İyi yorum **neden**i anlatır. **`///`** belge yorumudur (`cargo doc`).
- **`{}`** yer tutucuları argümanlarla **sırayla** doldurulur; sayılar tutmazsa program **derlenmez**.
- **`{x}`** (satır içi) kapsamdaki `x` değişkenini yazar; içine **yalnızca ad** yazılır, ifade yazılmaz.
- **`{0}`, `{1}`** sıra numaralı (sıfırdan başlar), **`{ad}` + `ad = değer`** isimli argümandır.
- **`{}` = Display** (kullanıcı için), **`{:?}` = Debug** (programcı için), **`{:#?}`** = güzel Debug.
- Süslü parantezin kendisi için **`{{`** ve **`}}`** yazılır.
:::

```reflect
prompt: |
  C'de `printf("%d %d", 5);` derlenip çalışabiliyor, Rust'ta `println!("{} {}", 5);` derlenmiyor.
  Bu farkın nedenini ve bunun programcı için neden iyi bir şey olduğunu kendi cümlelerinle açıkla.
answer: |
  Model cevap: `println!` bir makro olduğu için biçim metnini derleme sırasında inceler; yer tutucu
  sayısını argüman sayısıyla karşılaştırır ve uyuşmazsa programı derlemez. C'deki `printf` ise
  sıradan bir fonksiyondur; derleyici (uyarı verebilse de) programı derler ve eksik değerin yerine
  bellekte rastgele ne varsa yazdırılabilir. Bu tanımsız davranıştır: Hata sessizce kullanıcıya
  ulaşır. Rust aynı hatayı program daha çalışmadan, tam yerini göstererek yakalar.
```

```flashcards
- front: Rust'ta iki yorum türü nedir ve nereye kadar geçerlidir?
  back: "`//` satır sonuna kadar, `/* ... */` kapanış `*/`'a kadar. Blok yorumları iç içe yazılabilir."
- front: İyi bir yorum neyi anlatmalıdır?
  back: Kodun ne yaptığını değil, **neden** öyle yaptığını (koda bakarak anlaşılamayan bilgiyi).
- front: "`///` ile başlayan yorumun özelliği nedir?"
  back: Belge yorumudur (doc comment); altındaki öğeyi belgeler ve `cargo doc` ile HTML belgeye dönüşür.
- front: "`println!(\"{} ve {}\", 1);` neden derlenmez?"
  back: Biçim metninde 2 yer tutucu var ama 1 argüman verilmiş. Makro, sayıları derleme zamanında karşılaştırır.
- front: "`let x = 4;` varken `println!(\"{x * 2}\");` neden derlenmez?"
  back: "Satır içi yer tutucuya yalnızca değişken adı yazılabilir. Doğrusu: `println!(\"{}\", x * 2);`"
- front: "`{}` ile `{:?}` arasındaki fark nedir?"
  back: "`{}` Display biçimidir (kullanıcı için, temiz). `{:?}` Debug biçimidir (programcı için; metinleri tırnaklı ve kaçış dizileriyle gösterir)."
- front: "`println!(\"{1} {0}\", \"a\", \"b\");` ne yazdırır?"
  back: "`b a` — sıra numaraları sıfırdan başlar."
- front: Biçim metninde ekrana süslü parantez nasıl yazılır?
  back: "`{{` bir `{`, `}}` bir `}` yazar."
```
