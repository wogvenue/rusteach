---
id: m12-l05
title: "'static ve yaşam süresi sınırları"
minutes: 17
type: lesson
objectives:
  - "`'static` yaşam süresinin anlamını açıklayıp string literallerinin neden `&'static str` olduğunu söyleyebilmek"
  - "`'static`'i hata susturucu olarak kullanmanın neden işe yaramadığını bir örnekle gösterebilmek"
  - "`T: 'static` sınırını \"T, kısa ömürlü referans içermez\" diye okuyup `&'static T` ile farkını açıklayabilmek"
  - "`T: 'a` ve `'b: 'a` sınırlarını okuyabilmek ve bu sınırların generic fonksiyonlar arasında nasıl yayıldığını açıklayabilmek"
keywords: ["'static", "T: 'static", "T: 'a", "'b: 'a", E0310, E0515, E0597, literal, static]
---

Modül 5'te derleyicinin önerisini görmüştün: *"consider using the `'static` lifetime, but this is
uncommon"*. O gün "`'static` bir susturucu değildir, Modül 12'de bu tuzağa değineceğiz" demiştik. Bu
derste `'static`'in gerçekte ne olduğunu, en sık yanlış anlaşılan biçimi olan `T: 'static`'i ve genel
yaşam süresi sınırlarını (`T: 'a`) öğreneceksin.

## `'static`: programın sonuna kadar

`'static`, Rust'ın önceden tanımlı **tek** yaşam süresi adıdır. Anlamı "programın tüm çalışması boyunca
geçerli" demektir. En bilinen örneği string literalleridir:

```rust
static KARSILAMA: &str = "Hoş geldin"; // static öğe: tipi aslında &'static str

fn main() {
    let slogan: &'static str = "Rust ile güvenli kod";
    println!("{KARSILAMA}! {slogan}");
}
```

Modül 4'ten hatırla: `"Rust ile güvenli kod"` gibi bir literal ne stack'te ne heap'te yaşar. Derleyici
onu programın **ikili dosyasına** (binary) gömer ve program çalıştığı sürece orada durur. `slogan`, o
salt okunur bölgeye bakan bir dilimdir:

```memory
title: "Literal, ikili dosyanın salt okunur bölgesinde yaşar"
steps:
  - caption: "`slogan` stack'te bir dilim (işaretçi + uzunluk). Gösterdiği baytlar heap'te değil, programın içine gömülü. Hiçbir zaman serbest bırakılmazlar."
    stack:
      - frame: main
        vars:
          - { name: slogan, type: "&'static str", value: "ptr · len=21", to: r1 }
    heap:
      - { id: r1, value: "R u s t   i l e   g ü v e n l i   k o d", label: "ikili dosya (salt okunur veri)" }
```

Bir `&'static str` hiçbir zaman sarkmaz. Bu yüzden onu istediğin kadar uzun saklayabilirsin. Tahmin et:

```predict
code: |
  fn gun_adi(n: u8) -> &'static str {
      match n {
          1 => "Pazartesi",
          2 => "Salı",
          3 => "Çarşamba",
          4 => "Perşembe",
          5 => "Cuma",
          6 | 7 => "Hafta sonu",
          _ => "Geçersiz gün",
      }
  }

  fn main() {
      let ad;
      {
          let bugun = 3;
          ad = gun_adi(bugun);
      }
      println!("{ad} / {}", gun_adi(9));
  }
options:
  - "Çarşamba / Geçersiz gün"
  - "Çarşamba / Hafta sonu"
  - "Derlenmez: bugun iç blokta ölüyor, ad sarkar"
answer: 0
explanation: |
  Derlenir. `ad` bir `&'static str` ve `bugun`'e hiç bağlı değil: `bugun` bir `u8`, referans bile değil.
  Dönen dilim ikili dosyadaki "Çarşamba" literaline bakıyor. `9` hiçbir kola uymadığı için `_` kolu
  çalışır (Modül 7'deki `match` ve `|` desenleri). Burada ödünç alınan bir şey yok. `'static` dönüş tipi
  tamamen dürüst.
```

Bir şey daha: `'static` her yaşam süresinden uzundur. Bu yüzden bir `&'static str`, **herhangi** bir
`&'a str` beklenen yere verilebilir. Ders 2'deki `en_uzun(&sehir1, sehir2)` çağrısı (`sehir2` bir
literaldi) bu sayede derlenmişti. Program boyunca yaşayan bir şey, "en az `'a` kadar yaşa" şartını her zaman karşılar.

## `'static` bir susturucu değildir

E0106 aldığında derleyici bazen `'static` öneriyor. Bunu "hatayı kapatan sihirli kelime" sanmak çok yaygın
bir tuzaktır. Bir sosyal medya uygulamasında kullanıcı etiketi üreten şu fonksiyona bak:

```compiles
code: |
  fn kullanici_etiketi(ad: &str) -> &'static str {
      let etiket = format!("@{ad}");
      &etiket
  }

  fn main() {
      println!("{}", kullanici_etiketi("ada"));
  }
answer: false
error: E0515
explanation: |
  `'static` yazmak `etiket`'i program sonuna kadar yaşatmaz. Yaşam süreleri **tanımlayıcıdır** (ders 1).
  `etiket` yerel bir `String` ve fonksiyon bitince ölür. İmza ise "programın sonuna kadar geçerli bir
  referans döndüreceğim" diye **yalan** bir söz veriyor. Derleyici sözü kontrol eder ve E0515 ile
  reddeder. `'static`, E0106'yı sadece E0515'e çevirdi.
```

Aynı tuzak değişken anotasyonlarında da var. Çalışma zamanında oluşturulan bir vektörün elemanına
`&'static` bir referans istemek:

:::error
```text
error[E0597]: `v` does not live long enough
  --> src/main.rs:9:33
   |
 8 |     let v = vec![String::from("a")];
   |         - binding `v` declared here
 9 |     let ilk: &'static String = &v[0];
   |              ---------------    ^ borrowed value does not live long enough
   |              |
   |              type annotation requires that `v` is borrowed for `'static`
10 |     println!("{ilk}");
11 | }
   | - `v` dropped here while still borrowed
```
"Tip anotasyonu, `v`'nin `'static` boyunca ödünç alınmasını **gerektiriyor**." Ama `v` `main`'in sonunda
ölüyor. Derleyici senin isteğini yerine getirmeye çalışmaz, sadece isteğinin imkânsız olduğunu söyler.
:::

`'static` yazmadan önce kendine tek bir soru sor: **"Bu veri gerçekten programın sonuna kadar yaşıyor mu?"**

- Literaller, `static`/`const` öğeleri → evet, `&'static` doğru.
- Çalışma zamanında üretilen veri (`format!`, `String::from`, okunan girdi) → hayır. **Sahipli** değer döndür (`String`).

:::deep Bilerek sızdırmak: `leak`
Çalışma zamanında üretilmiş bir `String`'den gerçekten `&'static str` elde etmenin bir yolu var:
`String::leak`. Bu metot `String`'in belleğini **hiçbir zaman serbest bırakmamak** üzere "sızdırır" ve
ona `&'static mut str` verir. Yaşam süresi kuralı çiğnenmiyor: Bellek gerçekten de program sonuna kadar
yaşıyor. Bedeli ise o belleğin bir daha geri alınamaması.

Program başında bir kez okunan ve sonuna kadar kullanılan bir yapılandırma metni gibi çok özel durumlarda
kabul edilebilir. Bir döngünün içinde ya da bir istek başına kullanılırsa gerçek bir bellek sızıntısıdır.
99 durumda 100'ünde doğru cevap `String` döndürmektir.
:::

## `T: 'static`: "kısa ömürlü referans içermez"

Şimdi aynı kelimenin **bambaşka** bir kullanımına geçiyoruz. Modül 11'de `T: Display` gibi **trait
sınırları** yazdın. Bir tip parametresine **yaşam süresi sınırı** da koyabilirsin: `T: 'static`. Önce
tahmin et. Bu fonksiyon `T: 'static` istiyor ve ona çalışma zamanında üretilmiş bir `String` veriyoruz:

```compiles
code: |
  fn kayda_al<T: 'static + std::fmt::Debug>(deger: T) {
      println!("kayıt: {deger:?}");
  }

  fn main() {
      let isim = String::from("Mert");
      kayda_al(isim);
  }
answer: true
explanation: |
  Derlenir! Pek çok kişi `T: 'static`'i "değer program sonuna kadar yaşamalı" diye okur ve `String`'in
  reddedileceğini sanır. Ama `isim` az önce oluşturuldu ve `kayda_al` bitince `drop` edilecek. Program
  boyunca yaşamadığı kesin. Demek ki `T: 'static` başka bir şey söylüyor.
```

`T: 'static`'in doğru okunuşu şudur: **"`T`, `'static` olmayan hiçbir referans içermez."** Başka bir
deyişle `T` tipindeki bir değer **kendi verisinin sahibidir** (ya da sadece sonsuza dek yaşayan verilere
bakar). Böyle bir değeri tutan kişi, onu istediği kadar elinde tutabilir. Hiçbir kaynak altından
kaybolmaz. Ama elinde tutmak **zorunda** değildir. İstediği an `drop` edebilir.

Şimdi aynı fonksiyona yerel bir değişkenin **referansını** verelim:

```compiles
code: |
  fn kayda_al<T: 'static + std::fmt::Debug>(deger: T) {
      println!("kayıt: {deger:?}");
  }

  fn main() {
      let isim = String::from("Mert");
      kayda_al(&isim);
  }
answer: false
error: E0597
explanation: |
  Bu sefer `T` = `&String` ve bu referans `isim`'e bağlı, yani `'static` değil. Fonksiyon "bana verdiğin
  şeyi istersem sonsuza kadar tutabilmeliyim" diyor. `isim` ise `main`'in sonunda ölecek. Derleyici şöyle
  der: *argument requires that `isim` is borrowed for `'static`*.
```

:::error
```text
error[E0597]: `yerel` does not live long enough
 --> src/main.rs:7:19
  |
6 |     let yerel = String::from("geçici");
  |         ----- binding `yerel` declared here
7 |     let r = sakla(&yerel);
  |             ------^^^^^^-
  |             |     |
  |             |     borrowed value does not live long enough
  |             argument requires that `yerel` is borrowed for `'static`
8 |     println!("{r}");
9 | }
  | - `yerel` dropped here while still borrowed
  |
note: requirement that the value outlives `'static` introduced here
 --> src/main.rs:1:13
  |
1 | fn sakla<T: 'static>(deger: T) -> T {
  |             ^^^^^^^
```
Bu mesaj `fn sakla<T: 'static>(deger: T) -> T` gibi bir fonksiyona `&yerel` verildiğinde çıkar. `note`
kısmı çok yardımcı: Şartın **nereden** geldiğini, yani imzadaki `T: 'static` sınırını gösteriyor. Uzun
derleyici mesajlarında `note` satırlarını atlama. Sorunun kaynağı genellikle oradadır.
:::

`T: 'static` en çok, bir değerin **ne kadar yaşayacağını bilmediğin** bir yere teslim edildiği
durumlarda karşına çıkar. En önemli örneği Modül 18'de göreceğin `std::thread::spawn`'dır: Yeni bir
thread'in ne zaman biteceğini kimse bilmez. Bu yüzden ona verilen her şeyin `'static` olması, yani yerel
değişkenlere bakmaması gerekir.

```quiz
question: "Aşağıdaki tiplerden hangileri `T: 'static` sınırını karşılar? (Birden fazla seçenek doğru olabilir.)"
options:
  - "`String`"
  - "`Vec<i32>`"
  - "`&'static str`"
  - "`&'a str` (`'a`, `main` içindeki yerel bir `String`'in ödüncü)"
  - "`Alinti<'a>` (aynı yerel `'a` ile)"
answer: [0, 1, 2]
explanation: |
  `String` ve `Vec<i32>` hiç referans içermez. Verilerinin sahibidirler, bu yüzden `'static`'tir. Bu,
  sonsuza kadar yaşayacakları anlamına gelmez. `&'static str` de karşılar, çünkü baktığı veri program
  boyunca yaşar. Yerel bir değere bakan `&'a str` ve onu içeren `Alinti<'a>` ise kısa ömürlü bir kaynağa
  bağlıdır. Kaynak ölünce geçersiz olurlar, bu yüzden `'static` değildir.
feedback:
  - "Doğru! Sahipli tipler `'static`'tir, ne kadar kısa yaşarlarsa yaşasınlar."
  - "Doğru! İçinde hiç referans yok."
  - "Doğru! Baktığı veri program sonuna kadar yaşıyor."
  - "Bu referans yerel bir değere bağlı. O değer ölünce geçersizleşir."
  - "İçindeki referans yerel bir değere bağlı. Yaşam süresi bulaşıcıdır."
```

## `&'static T` ile `T: 'static` aynı şey değil

İkisi de aynı kelimeyi içerdiği için sürekli karıştırılır. Yan yana koyalım:

| | `&'static T` | `T: 'static` |
|---|---|---|
| Ne? | Bir **referans tipi** | Bir tip parametresine konan **sınır** |
| Söylediği | "Baktığım değer program sonuna kadar yaşıyor" | "Bu tip, kısa ömürlü referans içermiyor" |
| Örnek değer | `"merhaba"`, `static` öğelere referanslar | `String`, `i32`, `Vec<String>`, `&'static str` |
| Değer ne kadar yaşar? | Programın sonuna kadar | **Herhangi bir süre.** Sahibi istediği an `drop` edebilir |

:::analogy Kendi evi ve ömür boyu kira
`T: 'static`, "bu kişinin kimseye borcu yok, kendi evinde oturuyor" demek gibidir. Onu istediğin kadar
misafir edebilirsin, çünkü bir ev sahibi gelip onu çağırmayacak. Ama yarın taşınmaya karar verirse
taşınabilir. Sınır onun ne kadar kalacağını değil, **başkasına bağlı olmadığını** söyler.

`&'static T` ise "ömür boyu geçerli bir kira sözleşmesi" gibidir: Baktığın ev sonsuza kadar orada
duracak. String literalleri bu tür sözleşmelerdir. Ev (ikili dosyadaki veri) asla yıkılmaz.
:::

Bunu çalışan bir örnekle görelim. `T: 'static` isteyen fonksiyona sahipli bir değer veriyoruz. Değer
fonksiyonun içinde, program bitmeden çok önce ölüyor:

```rust
use std::fmt::Debug;

fn kayda_al<T: 'static + Debug>(deger: T) {
    println!("kayıt: {deger:?}");
} // deger burada drop edilir: 'static olmak "sonsuza kadar yaşamak" demek değil

fn main() {
    kayda_al(String::from("geçici bir metin"));
    kayda_al(vec![1, 2, 3]);
    kayda_al("literal"); // &'static str de olur
    println!("Program devam ediyor; yukarıdaki String ve Vec çoktan serbest bırakıldı.");
}
```

## `T: 'a` ve `'b: 'a`: genel yaşam süresi sınırları

`'static` aslında genel bir kuralın özel hâlidir. Herhangi bir yaşam süresi için sınır yazabilirsin:

- **`T: 'a`**: "`T`'nin içindeki bütün referanslar en az `'a` kadar yaşar." `T` hiç referans içermiyorsa
  bu her zaman doğrudur.
- **`'b: 'a`**: "`'b`, en az `'a` kadar yaşar" (`'b` ⊇ `'a`). `:` işaretini "kapsar, ondan uzun yaşar"
  diye okuyabilirsin.

`'static: 'a` her `'a` için doğrudur. Literallerin her yere sığmasının resmî sebebi budur.

Peki `T: 'a`'yı nerede görürsün? Bir referans, baktığı değerden uzun yaşayamayacağına göre `&'a T` tipi
ancak `T: 'a` ise anlamlıdır. Eski Rust kodlarında bu yüzden struct'lar şöyle yazılırdı:

```rust
// Rust 2018 öncesi stil: sınırı açıkça yazmak gerekiyordu
struct EskiKutu<'a, T: 'a> {
    icerik: &'a T,
}

// Bugünkü stil: derleyici `&'a T` alanından T: 'a sonucunu kendisi çıkarır
struct Kutu<'a, T> {
    icerik: &'a T,
}

fn main() {
    let sayi = 42;
    let k1 = EskiKutu { icerik: &sayi };
    let k2 = Kutu { icerik: &sayi };
    println!("{} {}", k1.icerik, k2.icerik);
}
```

Bugün bu sınırı struct'larda nadiren yazarsın. Ama **yayılma** kuralını bilmen gerekir. Trait sınırları
gibi yaşam süresi sınırları da generic fonksiyonlar arasında **kendiliğinden aktarılmaz**. Tahmin et:

```compiles
code: |
  fn sakla<T: 'static>(deger: T) -> T {
      deger
  }

  fn ara_katman<T>(deger: T) -> T {
      sakla(deger)
  }

  fn main() {
      println!("{}", ara_katman(5));
  }
answer: false
error: E0310
explanation: |
  `5` sorunsuz bir `'static` değer, ama mesele bu değil. `ara_katman` **her** `T` için yazılmış ve
  derleyici onu çağrılardan bağımsız olarak kontrol ediyor. `T` bir gün `&yerel` olabilir. `sakla` ise
  `T: 'static` istiyor. Modül 11'de `T: Display` isteyen bir fonksiyonu sınırsız bir `T` ile çağırınca
  E0277 almıştın. Bu da aynı durumun yaşam süresi versiyonu.
```

:::error
```text
error[E0310]: the parameter type `T` may not live long enough
 --> src/main.rs:6:5
  |
6 |     sakla(deger)
  |     ^^^^^^^^^^^^
  |     |
  |     the parameter type `T` must be valid for the static lifetime...
  |     ...so that the type `T` will meet its required lifetime bounds
  |
help: consider adding an explicit lifetime bound
  |
5 | fn ara_katman<T: 'static>(deger: T) -> T {
  |                +++++++++
```
"`T` tip parametresi yeterince uzun yaşamayabilir." Çözüm, sınırı imzada yukarı taşımak:
`fn ara_katman<T: 'static>`. Böylece şart, bir üst çağırana aktarılır. Genel `T: 'a` sınırı için aynı
hatanın kardeşi E0309'dur.
:::

`'b: 'a` sınırını da bir sonraki derste, birden fazla yaşam süresi parametresi olan imzalarda
kullanacağız.

## Alıştırmalar

```exercise
id: m12-e-unvan
title: Oyun karakterinin unvanı
difficulty: 2
prompt: |
  Bir rol yapma oyununda karakterlerin seviyesine göre bir unvanı var. Başlangıç kodunda iki fonksiyon var
  ve program **derlenmiyor**.

  - `unvan(seviye)`: `0` → `"Acemi"`, `1..=9` → `"Çırak"`, `10..=29` → `"Savaşçı"`, `30..=59` → `"Usta"`,
    `60` ve üstü → `"Efsane"`. Dönüş tipi `&'static str` ve bu **doğru**: Unvanlar sabit literaller. Bu imzaya dokunma.
  - `karakter_karti(isim, seviye)`: `"Ferris (Usta, seviye 42)"` biçiminde bir kart metni üretiyor. Yazan
    kişi E0106'yı `'static` ile "susturmaya" çalışmış ve E0515 almış. İmzayı **doğru** şekilde düzelt.
starter: |
  fn unvan(seviye: u32) -> &'static str {
      todo!()
  }

  fn karakter_karti(isim: &str, seviye: u32) -> &'static str {
      let kart = format!("{isim} ({}, seviye {seviye})", unvan(seviye));
      &kart
  }

  fn main() {
      println!("{}", karakter_karti("Ferris", 42));
  }
starter_compiles: false
solution: |
  fn unvan(seviye: u32) -> &'static str {
      match seviye {
          0 => "Acemi",
          1..=9 => "Çırak",
          10..=29 => "Savaşçı",
          30..=59 => "Usta",
          _ => "Efsane",
      }
  }

  fn karakter_karti(isim: &str, seviye: u32) -> String {
      format!("{isim} ({}, seviye {seviye})", unvan(seviye))
  }

  fn main() {
      println!("{}", karakter_karti("Ferris", 42));
  }
check: tests
tests: |
  #[test]
  fn unvan_sinirlari() {
      assert_eq!(unvan(0), "Acemi");
      assert_eq!(unvan(1), "Çırak");
      assert_eq!(unvan(9), "Çırak", "9 hâlâ çırak");
      assert_eq!(unvan(10), "Savaşçı", "10 savaşçılığın başlangıcı");
      assert_eq!(unvan(29), "Savaşçı");
      assert_eq!(unvan(30), "Usta");
      assert_eq!(unvan(59), "Usta");
      assert_eq!(unvan(60), "Efsane");
      assert_eq!(unvan(1000), "Efsane", "60 ve üstü efsane");
  }

  #[test]
  fn kart_metni() {
      assert_eq!(karakter_karti("Ferris", 42), "Ferris (Usta, seviye 42)");
      assert_eq!(karakter_karti("Ece", 0), "Ece (Acemi, seviye 0)");
  }

  #[test]
  fn kart_ismi_kopyalar() {
      let kart;
      {
          let isim = String::from("Kılıç Arslan");
          kart = karakter_karti(&isim, 75);
      }
      assert_eq!(kart, "Kılıç Arslan (Efsane, seviye 75)", "kart, isimden bağımsız yaşayabilmeli");
  }
require:
  - pattern: "fn unvan\\(seviye: u32\\) -> &'static str"
    message: "`unvan`'ın `&'static str` dönüşü doğru; literaller program boyunca yaşar. Bu imzayı değiştirme."
forbid:
  - pattern: "leak"
    message: "Belleği sızdırmak bu sorunun çözümü değil; sahipli bir değer döndür."
hints:
  - "`unvan` için Modül 7'deki aralık desenlerini kullan: `match seviye { 0 => ..., 1..=9 => ..., _ => ... }`."
  - "`kart` fonksiyonun içinde üretilen yeni bir `String`. Ona referans döndürmek hiçbir anotasyonla mümkün değil."
  - "`karakter_karti`'nın dönüş tipini `String` yap ve `format!(...)` sonucunu doğrudan döndür."
explanation: |
  İki fonksiyon iki farklı durumu temsil ediyor:

  - `unvan` gerçekten **program boyunca yaşayan** verilere bakıyor: `"Usta"` gibi literaller ikili
    dosyaya gömülü. `&'static str` dürüst bir söz. Bonus olarak hiç bellek ayırmıyor.
  - `karakter_karti` her çağrıda **yeni** bir metin üretiyor. Yeni üretilen verinin sahibi fonksiyondur.
    Onu dışarı vermenin tek yolu sahipliği taşımaktır: `-> String`.

  `'static` yazmak E0106'yı sadece E0515'e çevirmişti. Çünkü anotasyonlar değerin ömrünü değiştirmez,
  sadece tarif eder. Son test de bunu doğruluyor: Kart kendi verisine sahip olduğu için isim öldükten
  sonra da yaşıyor.
```

İkincisinde, `&'static str` ile kısa ömürlü bir `&'a str`'yi **aynı** dönüş tipinde buluşturacaksın.

```exercise
id: m12-e-http-durum
title: HTTP durum mesajları
difficulty: 3
prompt: |
  Bir web sunucusu, yanıt kodlarına açıklama ekliyor.

  1. `durum_metni(kod)`: Bilinen kodlar için `Some(...)`, diğerleri için `None` döndür:
     `200` → `"Tamam"`, `201` → `"Oluşturuldu"`, `400` → `"Hatalı İstek"`, `404` → `"Bulunamadı"`,
     `500` → `"Sunucu Hatası"`.
  2. `aciklama(kod, ozel)`: Kod biliniyorsa standart metni, bilinmiyorsa çağıranın verdiği `ozel` metni
     döndür.

  Dikkat: `aciklama`'nın dönüş tipi `&'a str`. Ama bazen `'static` bir literal, bazen `'a` yaşam süreli
  `ozel` döndüreceksin. Bunun neden sorun olmadığını düşün.
starter: |
  fn durum_metni(kod: u16) -> Option<&'static str> {
      todo!()
  }

  fn aciklama<'a>(kod: u16, ozel: &'a str) -> &'a str {
      todo!()
  }

  fn main() {
      let varsayilan = String::from("Bilinmeyen durum");
      println!("404: {}", aciklama(404, &varsayilan));
      println!("418: {}", aciklama(418, &varsayilan));
  }
solution: |
  fn durum_metni(kod: u16) -> Option<&'static str> {
      match kod {
          200 => Some("Tamam"),
          201 => Some("Oluşturuldu"),
          400 => Some("Hatalı İstek"),
          404 => Some("Bulunamadı"),
          500 => Some("Sunucu Hatası"),
          _ => None,
      }
  }

  fn aciklama<'a>(kod: u16, ozel: &'a str) -> &'a str {
      match durum_metni(kod) {
          Some(metin) => metin,
          None => ozel,
      }
  }

  fn main() {
      let varsayilan = String::from("Bilinmeyen durum");
      println!("404: {}", aciklama(404, &varsayilan));
      println!("418: {}", aciklama(418, &varsayilan));
  }
check: tests
tests: |
  #[test]
  fn bilinen_kodlar() {
      assert_eq!(durum_metni(200), Some("Tamam"));
      assert_eq!(durum_metni(201), Some("Oluşturuldu"));
      assert_eq!(durum_metni(400), Some("Hatalı İstek"));
      assert_eq!(durum_metni(404), Some("Bulunamadı"));
      assert_eq!(durum_metni(500), Some("Sunucu Hatası"));
  }

  #[test]
  fn bilinmeyen_kod_none() {
      assert_eq!(durum_metni(418), None, "418 listede yok");
      assert_eq!(durum_metni(0), None);
  }

  #[test]
  fn aciklama_standart_metni_tercih_eder() {
      let ozel = String::from("özel mesaj");
      assert_eq!(aciklama(404, &ozel), "Bulunamadı", "bilinen kodda standart metin dönmeli");
  }

  #[test]
  fn aciklama_bilinmeyende_ozeli_dondurur() {
      let ozel = String::from("Ben bir çaydanlığım");
      assert_eq!(aciklama(418, &ozel), "Ben bir çaydanlığım", "bilinmeyen kodda çağıranın metni dönmeli");
  }

  #[test]
  fn durum_metni_kalici() {
      let metin;
      {
          let kod: u16 = 500;
          metin = durum_metni(kod);
      }
      assert_eq!(metin, Some("Sunucu Hatası"), "'static metin her yerde kullanılabilir");
  }
hints:
  - "`durum_metni` için `match kod { 200 => Some(\"Tamam\"), ..., _ => None }`."
  - "`aciklama`'da `match durum_metni(kod) { Some(metin) => ..., None => ... }` kullan. Ya da Modül 10'daki `unwrap_or`'u kullan."
  - "`metin` bir `&'static str`, dönüş tipi `&'a str`. `'static` her `'a`'dan uzun yaşadığı için `metin`'i doğrudan döndürebilirsin: `Some(metin) => metin, None => ozel`."
explanation: |
  `aciklama`'nın iki kolu farklı yaşam süreli referanslar döndürüyor: Biri `&'static str`, diğeri
  `&'a str`. Derleyici neden itiraz etmiyor? Çünkü `'static: 'a`, yani `'static` her `'a`'yı kapsar.
  "En az `'a` kadar yaşa" şartını program boyunca yaşayan bir literal fazlasıyla karşılar. Derleyici
  literalin yaşam süresini gerektiği kadar "kısaltarak" `&'a str` olarak kabul eder.

  Daha kısa bir yazım: `durum_metni(kod).unwrap_or(ozel)` (Modül 10). `unwrap_or`, `Option<&'a str>`
  üzerinde çalışır. `Option<&'static str>` da aynı sebeple `Option<&'a str>` olarak görülebilir.

  Çağıran açısından bakarsan: `aciklama(404, &varsayilan)` sonucu `varsayilan` yaşadığı sürece
  kullanılabilir, gerçekte bir literal dönse bile. İmza en kötü durumu (özel metin) tarif ediyor.
  Bunun yerine her zaman `'static` literal isteyen bir sonuca ihtiyacın varsa `durum_metni`'ni doğrudan
  kullanırsın. Son test bunu gösteriyor.
```

## Özet

:::remember
- `'static`: Programın sonuna kadar geçerli. Literaller ve `static` öğeler `&'static`'tir. `'static` her yaşam süresinden uzundur, bu yüzden her `&'a` beklenen yere sığar.
- `'static` bir susturucu değildir: Çalışma zamanında üretilen veriye `&'static` istemek E0515/E0597 ile biter. Çözüm sahipli değer (`String`).
- `T: 'static`: "`T`, kısa ömürlü referans içermez." `String`, `Vec<i32>` karşılar ve istedikleri an `drop` edilebilirler. **Sonsuza kadar yaşamak demek değildir.**
- `&'static T` bir referans tipidir (veri sonsuza kadar orada). `T: 'static` bir sınırdır (tip kimseye bağlı değil).
- `T: 'a`: "`T`'nin içindeki referanslar en az `'a` kadar yaşar." `'b: 'a`: "`'b`, `'a`'yı kapsar."
- Sınırlar generic fonksiyonlar arasında kendiliğinden aktarılmaz (E0310, E0309). Üst imzaya taşınmalıdır.
:::

```reflect
prompt: |
  Bir arkadaşın şöyle diyor: "`thread::spawn`'a verdiğim şey `'static` olmalıymış. Demek ki thread'e
  verdiğim her `String` program sonuna kadar bellekte kalacak, bu çok israf." Ona yanlışını açıkla.
answer: |
  Model cevap: `T: 'static` sınırı, değerin program sonuna kadar yaşayacağı anlamına gelmez. Sadece
  değerin, ölüp gidebilecek başka bir şeye **referans içermediği** anlamına gelir. Thread'e verdiğin
  `String`'in sahibi artık thread'dir. Thread bitince ya da `String` thread'in içinde işi bitince
  kapsamdan çıkınca normal şekilde `drop` edilir. Şart, thread ne kadar uzun yaşarsa yaşasın elindeki
  verinin geçersizleşmemesini garanti etmek için var. Bu yüzden yerel bir değişkene `&` referans
  verilemez, ama sahipli bir `String` sorunsuz verilebilir.
```

```flashcards
- front: "`'static` yaşam süresi ne anlama gelir?"
  back: "Programın tüm çalışması boyunca geçerli. String literalleri ve `static` öğeler `&'static`'tir."
- front: String literalleri bellekte nerede yaşar?
  back: "Ne stack'te ne heap'te: Programın ikili dosyasındaki salt okunur bölgede. Bu yüzden tipleri `&'static str`'dir."
- front: "Yerel bir `String`'e referans döndüren fonksiyonun dönüş tipini `&'static str` yapmak ne sonuç verir?"
  back: "E0515. `'static` değerin ömrünü uzatmaz; imza yalan bir söz vermiş olur. Çözüm `String` döndürmek."
- front: "`T: 'static` sınırının doğru okunuşu nedir?"
  back: "\"`T`, `'static` olmayan hiçbir referans içermez.\" Yani `T` kendi verisinin sahibidir. Sonsuza kadar yaşamak zorunda değildir."
- front: "`String` tipi `T: 'static` sınırını karşılar mı?"
  back: "Evet. İçinde kısa ömürlü referans yok. Çalışma zamanında oluşturulup hemen `drop` edilse bile karşılar."
- front: "`T: 'a` ne demektir?"
  back: "`T`'nin içindeki bütün referanslar en az `'a` kadar yaşar. `&'a T` tipinin anlamlı olması için gereklidir (bugün çoğunlukla otomatik çıkarılır)."
- front: "`'b: 'a` sınırı nasıl okunur?"
  back: "\"`'b`, en az `'a` kadar yaşar\" (`'b`, `'a`'yı kapsar). Örneğin `'static: 'a` her `'a` için doğrudur."
- front: "E0310 (*the parameter type `T` may not live long enough*) neden çıkar ve nasıl düzelir?"
  back: "Sınırsız bir `T`, `T: 'static` isteyen bir fonksiyona veriliyor. Sınırı üst imzaya ekle: `fn f<T: 'static>(...)`."
```
