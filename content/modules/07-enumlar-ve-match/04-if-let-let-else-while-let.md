---
id: m07-l04
title: if let, let else ve while let
minutes: 25
type: lesson
objectives:
  - Tek bir desenin ilgilendirdiği durumlarda `match` yerine `if let` (ve gerektiğinde `else`) yazabilmek
  - "`let ... else` ile değeri çıkaramadığında erken dönen, düz ve okunaklı fonksiyonlar yazabilmek"
  - "`while let` ile bir `Vec`'i yığın (stack) gibi boşaltan döngüler kurabilmek"
  - "`matches!` makrosuyla bir değerin bir desene uyup uymadığını `bool` olarak sorabilmek ve durumu en iyi anlatan aracı seçebilmek"
keywords: [if let, let else, while let, matches!, desen, refutable, E0005, E0369, pop, erken dönüş]
---

`match` güçlü ama bazen fazla törenli. Bir kupon kodunun **varsa** uygulanmasını istiyorsun; yoksa
yapılacak hiçbir şey yok. Yine de `match` senden "yoksa ne olacak?" kolunu yazmanı ister ve sen de her
seferinde `None => {}` yazıp geçersin. Gerçek programlarda bu kalıp o kadar sık çıkar ki Rust onun için
dört kısa yol sunar: **`if let`**, **`let ... else`**, **`while let`** ve **`matches!`**.

Bu derste hepsi aynı fikrin farklı yüzleri olacak: "Bir değer bir desene uyuyor mu? Uyuyorsa içini aç."
Dersin sonunda her durum için hangisinin en okunaklı olduğuna kendin karar verebileceksin.

## Tek bir desen için match fazla uzun

Bir alışveriş sitesinin ödeme sayfasındasın. Müşterinin bir indirim kuponu olabilir de olmayabilir de:

```rust
fn main() {
    let kupon: Option<u32> = Some(15);

    // match ile: ilgilenmediğimiz None için boş bir kol yazmak zorundayız
    match kupon {
        Some(oran) => println!("match:  %{oran} indirim uygulandı"),
        None => {}
    }

    // if let ile: yalnızca ilgilendiğimiz desen
    if let Some(oran) = kupon {
        println!("if let: %{oran} indirim uygulandı");
    }
}
```

İki yapı da aynı işi yapar. `if let` şöyle okunur: "**eğer** `kupon` değeri `Some(oran)` desenine
**uyuyorsa**, içindekini `oran`'a bağla ve bloğu çalıştır; uymuyorsa hiçbir şey yapma."

- Sol tarafta bir **desen**, sağ tarafta incelenen **değer** var. Aradaki işaret tek `=`'dir, `==` değil:
  burada iki değer karşılaştırılmıyor, bir değer bir desene **oturtuluyor**.
- Desen, `match` kollarında yazabildiğin her şey olabilir: `Some(0)`, `Mesaj::Yaz(metin)`,
  `Islem::Bol(_, 0)`, aralıklar...
- `if let`, iki kollu bir `match`'in kısaltmasıdır: `match deger { DESEN => { ... } _ => {} }`.

Aslında `let`'in kendisi de hep bir desen alıyordu. Modül 2'deki `let (a, b) = t;` satırını hatırla:
`(a, b)` bir tuple desenidir. `let x = 5;` satırındaki `x` bile "her değere uyan, onu `x`'e bağlayan"
bir desendir. `if let` ise bu fikri, **uymayabilecek** desenlere genişletir.

:::analogy Posta kutusu
Eve gelirken posta kutuna bakarsın: içinde mektup **varsa** çıkarıp okursun; yoksa hiçbir şey yapmadan
yürüyüp geçersin. Kimse kapıya "mektup yoksa hiçbir şey yapma" diye ayrı bir not asmaz. `if let`
tam olarak budur: dolu kutu için bir plan, boş kutu için sessizlik.
:::

Enum'larla da aynı şekilde çalışır. Bir sosyal medya uygulamasındaki bildirimlerden yalnızca
beğenileri toplamak istediğini düşün:

```rust
# #[allow(dead_code)]
enum Bildirim {
    Begeni(u32),
    Yorum { kimden: String, metin: String },
    Takip(String),
}

fn main() {
    let gelenler = [
        Bildirim::Begeni(3),
        Bildirim::Takip(String::from("deniz")),
        Bildirim::Yorum {
            kimden: String::from("ali"),
            metin: String::from("harika!"),
        },
        Bildirim::Begeni(10),
    ];

    let mut toplam = 0;
    for b in &gelenler {
        if let Bildirim::Begeni(adet) = b {
            toplam += *adet; // b bir referans, adet de &u32
        }
    }
    println!("Toplam beğeni: {toplam}");
}
```

`for b in &gelenler` dizinin elemanlarını ödünç verir; `b` bir `&Bildirim`'dir. 3. dersteki
`match &m` gibi, referans üzerinde eşleştirdiğimiz için `adet` de bir `&u32` olur ve değerine `*adet`
ile ulaşırız.

Şimdi bir soru: `if let`'in bağladığı değişken ne kadar yaşar? Tahmin et:

```compiles
code: |
  fn main() {
      let indirim: Option<u32> = Some(20);
      if let Some(oran) = indirim {
          println!("%{oran} indirim");
      }
      println!("Son oran: {oran}");
  }
answer: false
error: E0425
explanation: |
  Derlenmez: **E0425**, *cannot find value `oran` in this scope*. `oran` yalnızca `if let` bloğunun
  **içinde** vardır, tıpkı bir `match` kolunda bağlanan değişkenin yalnızca o kolda yaşaması gibi.
  Mantıklı da: `indirim` `None` olsaydı son satırda `oran`'ın değeri ne olurdu? Değerin bloğun dışında
  da lazımsa birazdan göreceğin `let ... else` tam bu iş için var.
```

:::warning Kısalığın bedeli
`if let` eksiksizlik denetimini (exhaustiveness checking) **kapatır**: uymayan her şey sessizce geçilir.
`kupon` için bu tam istediğin şey. Ama bir enum'un **her** varyantı için ayrı bir şey yapman gerekiyorsa,
`if let` zincirleri kurmak yerine `match` yaz; yoksa enum'a yeni bir varyant eklediğinde derleyici seni
uyaramaz.
:::

## else, else if let ve let zincirleri

`if let`'in de bir `else` dalı olabilir. Üstelik `if` gibi o da bir **ifadedir** (expression), yani değer
üretir. Modül 3'teki kural burada da geçerli: iki dal **aynı tipte** değer üretmelidir.

```rust
fn karsilama(kullanici: Option<&str>) -> String {
    if let Some(ad) = kullanici {
        format!("Tekrar hoş geldin, {ad}!")
    } else {
        String::from("Merhaba misafir, giriş yapmak ister misin?")
    }
}

fn main() {
    println!("{}", karsilama(Some("Elif")));
    println!("{}", karsilama(None));
}
```

Birden fazla deseni sırayla denemek için `else if let`, düz bir koşul için `else if` ekleyebilirsin.
Bir hava durumu uygulaması düşün:

```rust
# #[allow(dead_code)]
enum Hava {
    Gunesli { sicaklik: i32 },
    Yagmurlu { mm: u32 },
    Karli,
}

fn tavsiye(hava: &Hava) -> &'static str {
    if let Hava::Yagmurlu { mm } = hava {
        if *mm > 20 { "Sağanak var, evde kal" } else { "Şemsiyeni al" }
    } else if let Hava::Gunesli { sicaklik } = hava
        && *sicaklik > 30
    {
        "Çok sıcak, bol su iç"
    } else {
        "Keyfine bak"
    }
}

fn main() {
    let gunler = [
        Hava::Yagmurlu { mm: 35 },
        Hava::Gunesli { sicaklik: 34 },
        Hava::Gunesli { sicaklik: 22 },
        Hava::Karli,
    ];
    for gun in &gunler {
        println!("{}", tavsiye(gun));
    }
}
```

İkinci daldaki `if let DESEN = DEGER && KOSUL` yazımına **let zinciri (let chain)** denir: "desen uyuyorsa
**ve** bağlanan değer koşulu sağlıyorsa". `&&`'nin sağındaki koşul, desenin bağladığı `sicaklik`'i
kullanabilir. `Gunesli { sicaklik: 22 }` desene uyar ama koşulu sağlamadığı için `else`'e düşer.

:::info Yeni bir özellik
Let zincirleri Rust 1.88'de (2025) ve yalnızca **2024 sürümünde (edition 2024)** geldi. Daha eski
kodlarda aynı işin iç içe `if let { if ... }` ile yazıldığını görürsün. Bu uygulama ve yeni `cargo new`
projeleri zaten 2024 sürümünü kullanıyor.
:::

Peki ne zaman `match`, ne zaman `if let`?

```quiz
question: |
  Bir oyunda `enum Esya { Kilic(u32), Kalkan(u32), Iksir, Anahtar }` var. Aşağıdaki durumların
  hangisinde `match` yerine `if let` kullanmak **daha uygundur**?
options:
  - "Her eşya türü için envanter ekranında farklı bir simge çizeceksin"
  - "Yalnızca kılıçlarla ilgileniyorsun: elindeki eşya bir kılıçsa hasarını saldırıya ekleyeceksin, değilse hiçbir şey olmayacak"
  - "Eşyanın satış fiyatını hesaplayan bir fonksiyon yazıyorsun; her türün fiyatı farklı"
  - "Hiçbiri; `if let` her zaman `match`'ten daha iyidir çünkü daha kısadır"
answer: 1
explanation: |
  `if let`, **tek bir desen** ilginçken ve geri kalan her şey için "hiçbir şey yapma" (ya da tek bir
  `else`) yeterliyken parlar. Simge çizmek ve fiyat hesaplamak her varyant için ayrı bir karar gerektirir;
  orada `match` hem daha okunaklıdır hem de yeni bir eşya türü eklediğinde E0004 ile seni uyarır.
feedback:
  - "Her varyant için ayrı bir iş var: bu `match`'in alanı. `if let` zinciri yeni bir varyantı sessizce atlar."
  - "Doğru! Tek ilginç desen, gerisi için sessizlik: `if let`'in tam kullanım yeri."
  - "Her türün kendi fiyatı varsa her varyantın bir kolu olmalı; `match` eksiksizliği garanti eder."
  - "Kısalık tek ölçüt değil. `if let` eksiksizlik denetimini bıraktığı için her yerde iyi değildir."
```

## let ... else: mutlu yol sola yaslı

`if let`'in bağladığı değişken bloğun dışına çıkamıyordu. Peki değeri fonksiyonun geri kalanında
kullanmak istiyorsan? Belki doğrudan `let` ile açmayı denersin. Derlenir mi?

```compiles
code: |
  fn main() {
      let indirim: Option<u32> = Some(20);
      let Some(oran) = indirim;
      println!("%{oran}");
  }
answer: false
error: E0005
explanation: |
  Derlenmez: **E0005**, *refutable pattern in local binding*. `indirim` bu programda `Some(20)` olsa
  bile tipi `Option<u32>`'dir ve `None` da olabilirdi. O zaman `oran`'a ne bağlanacaktı? Sıradan bir
  `let`, her değere uyması **garanti** olan bir desen ister. Hata mesajının tamamı ve çözüm hemen aşağıda.
```

:::error
```text
error[E0005]: refutable pattern in local binding
 --> src/main.rs:3:9
  |
3 |     let Some(oran) = indirim;
  |         ^^^^^^^^^^ pattern `None` not covered
  |
  = note: `let` bindings require an "irrefutable pattern", like a `struct` or an `enum` with only one variant
  = note: the matched value is of type `Option<u32>`
help: you might want to use `let...else` to handle the variant that isn't matched
  |
3 |     let Some(oran) = indirim else { todo!() };
  |                              ++++++++++++++++
```
- **refutable pattern**: "çürütülebilir desen", yani bazı değerlere **uymayabilen** desen. `Some(oran)`
  `None`'a uymaz.
- **irrefutable pattern**: "çürütülemez desen", her değere uyan desen: `x`, `(a, b)`, bir struct deseni.
  Sıradan `let` yalnızca bunları kabul eder.
- *help*: derleyici çözümü de söylüyor: `let...else`.
:::

**`let ... else`**, "desen uyarsa değişkenleri bağla ve **devam et**; uymazsa `else` bloğunu çalıştır" der.
Kritik kural: `else` bloğu **asla normal biçimde bitmemelidir**. `return`, `break`, `continue` ya da
`panic!` gibi bir şeyle akıştan çıkmalıdır. Çünkü `else`'ten sonra kod devam ederse, bağlanması gereken
değişkenler boş kalırdı.

Bir e-posta adresini incelediğini düşün. Modül 5'te "ileride göreceksin" dediğimiz `split_once` metodu
bir metni verilen karakterin **ilk** geçtiği yerden ikiye böler ve sonucu `Option<(&str, &str)>` olarak
döndürür; karakter yoksa `None`.
Önce iç içe `if let` ile:

```rust
fn ozet_ic_ice(eposta: &str) -> String {
    if let Some((kullanici, alan)) = eposta.split_once('@') {
        if let Some((_, uzanti)) = alan.split_once('.') {
            format!("kullanıcı={kullanici}, uzantı={uzanti}")
        } else {
            format!("geçersiz: '{alan}' içinde nokta yok")
        }
    } else {
        String::from("geçersiz: '@' yok")
    }
}

fn ozet(eposta: &str) -> String {
    let Some((kullanici, alan)) = eposta.split_once('@') else {
        return String::from("geçersiz: '@' yok");
    };
    let Some((_, uzanti)) = alan.split_once('.') else {
        return format!("geçersiz: '{alan}' içinde nokta yok");
    };
    format!("kullanıcı={kullanici}, uzantı={uzanti}")
}

fn main() {
    for e in ["ayse@ornek.com", "mehmet.ornek.com", "can@localhost"] {
        println!("{}", ozet(e));
        assert_eq!(ozet(e), ozet_ic_ice(e)); // ikisi aynı sonucu verir
    }
}
```

Desen `Some((kullanici, alan))`: bir `Some`'un içinde bir tuple. Desenler iç içe geçebilir.

İkinci sürümde her kontrol tek satırlık bir "kapı": geçemeyen hemen döner. Geçenlerle ilgilenen asıl iş,
yani **mutlu yol (happy path)**, en sonda ve sola yaslı duruyor. Kontrol sayısı arttıkça iç içe sürüm
sağa doğru kayar ve hata mesajları kendi koşullarından uzaklaşır; `let ... else` sürümü ise düz kalır.
Swift programcıları bu kalıbı `guard let` olarak tanır; C, Java ve Python'da da "guard clause"
(önce kötü durumları ele alıp çık) adıyla bilinen bir alışkanlıktır.

:::analogy Biniş kapısı
Havalimanında biniş kapısındaki görevli tek bir soru sorar: "Biniş kartın var mı?" Yoksa sıradan
çıkarsın; konuşma orada biter, uçağa doğru tek adım atamazsın (`else` + `return`). Varsa kartın elinde,
yoluna devam edersin ve uçakta koltuğunu kartla bulursun (bağlanan değişken, `let`'ten sonra da
kullanılabilir).
:::

`else` bloğunda akıştan çıkmayı unutursan derleyici durumu açıkça söyler:

:::error
```text
error[E0308]: `else` clause of `let...else` does not diverge
 --> src/main.rs:2:35
  |
2 |       let Some(oran) = indirim else {
  |  ___________________________________^
3 | |         println!("indirim yok");
4 | |     };
  | |_____^ expected `!`, found `()`
  |
  = help: try adding a diverging expression, such as `return` or `panic!(..)`
  = help: ...or use `match` instead of `let...else`
```
*does not diverge*: "akıştan ayrılmıyor." Rust'ta `return`, `break`, `continue` ve `panic!` gibi asla
"normal biçimde" bitmeyen ifadelerin tipi `!`'dir (okunuşu: **never**, "asla" tipi). Derleyici `else`
bloğunun tipinin `!` olmasını bekliyor ama blok normal biçimde bitip `()` üretiyor.
:::

Sıra sende. Türk plakalarında il kodu, ilk boşluktan önceki kısımdır: `"34 ABC 123"` → `"34"`.

```fill
prompt: |
  Boşlukları doldur: plakada boşluk yoksa fonksiyon `None` ile hemen dönsün; varsa ilk parçayı
  `il` adıyla yakala.
code: |
  fn il_kodu(plaka: &str) -> Option<&str> {
      let ___0 = plaka.split_once(' ') else {
          ___1
      };
      Some(il)
  }

  fn main() {
      println!("{:?}", il_kodu("34 ABC 123"));
      println!("{:?}", il_kodu("06 TR 2024"));
      println!("{:?}", il_kodu("PLAKASIZ"));
  }
blanks:
  - ["Some((il, _))", "Some((il, _kalan))"]
  - ["return None;", "return None"]
output: |
  Some("34")
  Some("06")
  None
explanation: |
  `split_once(' ')` bir `Option<(&str, &str)>` döndürür, bu yüzden desen hem `Some`'u hem içindeki
  tuple'ı açmalı: `Some((il, _))`. İkinci parçayla ilgilenmediğimiz için `_` kullandık. `else` bloğu
  akıştan çıkmak zorunda; fonksiyon `Option<&str>` döndürdüğü için doğru çıkış `return None;`.
  `else`'ten sonra `il` güvenle kullanılabilir: oraya yalnızca desen uyduysa gelinir.
```

````exercise
id: m07-e-teslimat-etiketi
title: Teslimat etiketi
difficulty: 2
prompt: |
  Bir kargo şirketi, müşteri kayıtlarından teslimat etiketi basıyor. Bazı müşterilerin adresi, bazı
  adreslerin de posta kodu henüz girilmemiş:

  ```rust
  struct Adres { sehir: String, posta_kodu: Option<u32> }
  struct Musteri { ad: String, adres: Option<Adres> }
  ```

  `etiket` fonksiyonunu **`let ... else`** kullanarak yaz:

  | Durum | Sonuç |
  |---|---|
  | adres yok | `"HATA: Ayşe için adres yok"` |
  | adres var, posta kodu yok | `"HATA: Ayşe için posta kodu yok"` |
  | ikisi de var | `"Ayşe, 34710 İstanbul"` |

  Posta kodu her zaman **5 haneli** yazılır: Ankara'nın `6100` olarak saklanan kodu `"06100"` görünmeli
  (Modül 1'deki biçimlendirme seçeneklerini hatırla).
starter: |
  struct Adres {
      sehir: String,
      posta_kodu: Option<u32>,
  }

  struct Musteri {
      ad: String,
      adres: Option<Adres>,
  }

  fn etiket(m: &Musteri) -> String {
      todo!()
  }

  fn main() {
      let ayse = Musteri {
          ad: String::from("Ayşe"),
          adres: Some(Adres {
              sehir: String::from("İstanbul"),
              posta_kodu: Some(34710),
          }),
      };
      let can = Musteri {
          ad: String::from("Can"),
          adres: None,
      };
      println!("{}", etiket(&ayse));
      println!("{}", etiket(&can));
  }
solution: |
  struct Adres {
      sehir: String,
      posta_kodu: Option<u32>,
  }

  struct Musteri {
      ad: String,
      adres: Option<Adres>,
  }

  fn etiket(m: &Musteri) -> String {
      let Some(adres) = &m.adres else {
          return format!("HATA: {} için adres yok", m.ad);
      };
      let Some(kod) = adres.posta_kodu else {
          return format!("HATA: {} için posta kodu yok", m.ad);
      };
      format!("{}, {kod:05} {}", m.ad, adres.sehir)
  }

  fn main() {
      let ayse = Musteri {
          ad: String::from("Ayşe"),
          adres: Some(Adres {
              sehir: String::from("İstanbul"),
              posta_kodu: Some(34710),
          }),
      };
      let can = Musteri {
          ad: String::from("Can"),
          adres: None,
      };
      println!("{}", etiket(&ayse));
      println!("{}", etiket(&can));
  }
check: tests
tests: |
  fn musteri(ad: &str, adres: Option<(&str, Option<u32>)>) -> Musteri {
      let mut m = Musteri { ad: String::from(ad), adres: None };
      if let Some((sehir, posta_kodu)) = adres {
          m.adres = Some(Adres { sehir: String::from(sehir), posta_kodu });
      }
      m
  }

  #[test]
  fn tam_bilgiyle_etiket_basar() {
      let m = musteri("Ayşe", Some(("İstanbul", Some(34710))));
      assert_eq!(etiket(&m), "Ayşe, 34710 İstanbul", "ad, posta kodu ve şehir sırayla yazılmalı");
      let m = musteri("Zeynep", Some(("Isparta", Some(32260))));
      assert_eq!(etiket(&m), "Zeynep, 32260 Isparta", "her müşteri için kendi adı, kodu ve şehri yazılmalı");
  }

  #[test]
  fn posta_kodu_bes_haneli_yazilir() {
      let m = musteri("Mert", Some(("Ankara", Some(6100))));
      assert_eq!(etiket(&m), "Mert, 06100 Ankara", "6100 posta kodu 06100 olarak yazılmalı: {{kod:05}}");
  }

  #[test]
  fn adres_yoksa_hata() {
      let m = musteri("Can", None);
      assert_eq!(etiket(&m), "HATA: Can için adres yok", "adres None ise ilk kontrolde dönülmeli");
  }

  #[test]
  fn posta_kodu_yoksa_hata() {
      let m = musteri("Elif", Some(("İzmir", None)));
      assert_eq!(etiket(&m), "HATA: Elif için posta kodu yok", "adres var ama posta kodu None");
  }
hints:
  - "İlk kapı: `let Some(adres) = &m.adres else { return ...; };` `m` ödünç alındığı için `&m.adres` üzerinde eşleştir; `adres` bir `&Adres` olur."
  - "İkinci kapı: `let Some(kod) = adres.posta_kodu else { return ...; };` `u32` `Copy` olduğu için değeri kopyalayarak bağlayabilirsin."
  - "Son satır noktalı virgülsüz bir `format!` olmalı. Sıfırla 5 haneye tamamlamak için `{kod:05}` yaz: `format!(\"{}, {kod:05} {}\", m.ad, adres.sehir)`"
require:
  - pattern: 'let\s+Some\s*\([^)]*\)\s*=[^;]*else'
    message: "Bu alıştırmada en az bir `let Some(...) = ... else { ... };` kullan."
explanation: |
  Fonksiyon iki "kapıdan" oluşuyor; her kapı bir `let ... else`. Geçemeyen erken döner, geçen bir
  sonraki satırda kendi değişkeniyle devam eder. Asıl iş olan `format!` en sonda, hiç girinti almadan duruyor.

  Neden `&m.adres`? `m` bir `&Musteri`; `m.adres`'i doğrudan desene verseydin, desen içindeki `Adres`'i
  ödünç alınmış bir yapının içinden **taşımaya** çalışırdı (Modül 5: ödünç alınan şeyi taşıyamazsın,
  E0507). `&m.adres` üzerinde eşleştirince `adres` bir `&Adres` olur. `adres.posta_kodu` ise `Option<u32>`
  ve `u32` `Copy` olduğu için `kod` sadece bir kopya: sorun yok.

  `{kod:05}` "en az 5 hane, eksik haneleri soldan `0` ile doldur" demek (Modül 1). Posta kodunu `u32`
  yerine `String` olarak saklamak da bir seçenektir; baştaki sıfırı kaybetmemek için gerçek sistemler
  çoğu zaman öyle yapar.

  Aynı işi `match` ile de yazabilirdin, ama iç içe iki `match` gerekir ve hata mesajları kendi
  kontrollerinden uzaklaşır. `let ... else`, "önce kötü durumları ele al ve çık" alışkanlığının Rust'taki
  doğal yazımıdır.
````

## while let: kutu boşalana kadar

Mutfakta bir tabak yığını var. Her seferinde **en üstteki** tabağı alıp yıkıyorsun; yığın bitince duruyorsun.
`Vec`'in `pop` metodu tam bunu yapar: son elemanı vektörden çıkarıp `Some(eleman)` olarak verir; vektör
boşsa `None` döndürür. (`Vec`'i Modül 4'ten beri tanıyorsun; ayrıntılarını Modül 9'da göreceğiz.)

```rust
fn main() {
    let mut yigin = vec!["mavi tabak", "yeşil tabak", "kırmızı tabak"];

    while let Some(tabak) = yigin.pop() {
        println!("{tabak} yıkandı");
    }

    println!("Yığında {} tabak kaldı", yigin.len());
}
```

`while let` şöyle okunur: "değer desene **uydukça** döngüyü sürdür." Her turda `yigin.pop()` yeniden
çağrılır; `Some` geldikçe içindeki tabak `tabak`'a bağlanır, ilk `None`'da döngü biter. Aynı programın
uzun hâli:

```rust
# fn main() {
#     let mut yigin = vec!["mavi tabak", "yeşil tabak", "kırmızı tabak"];
loop {
    match yigin.pop() {
        Some(tabak) => println!("{tabak} yıkandı"),
        None => break,
    }
}
# }
```

Tabakların **ters sırada** yıkandığına dikkat et: en son konan ilk çıkar. Buna **LIFO** (*last in, first
out*, son giren ilk çıkar) denir ve bu şekilde kullanılan bir `Vec`'e **yığın (stack)** denir.
(Modül 4'teki stack belleği de aynı mantıkla çalışır; adı oradan gelir.)

:::analogy Tabak yığını
Yığının ortasından tabak çekmezsin, devrilir. Her zaman en üsttekini alırsın; yeni tabağı da en üste
koyarsın. `push` üste koymak, `pop` üstten almaktır. `while let` ise "yığında tabak kaldıkça" demektir.
:::

```memory
title: "`yigin.pop()` adım adım"
steps:
  - caption: "Başlangıç: `yigin` stack'te üç parça (işaretçi, uzunluk, kapasite) tutuyor; üç `&str` heap'te sıralı duruyor. (Her `&str` metne işaret eden bir işaretçi + uzunluktur; harflerin kendisi programın içine gömülü.)"
    stack:
      - frame: main
        vars:
          - { name: yigin, type: "Vec<&str>", value: "ptr · len=3 · cap=3", to: h1, mut: true }
    heap:
      - { id: h1, value: "mavi │ yeşil │ kırmızı" }
  - caption: "İlk tur: `pop()` son elemanı çıkarıp `Some(\"kırmızı tabak\")` verdi. Desen uydu, `tabak` ona bağlandı. Uzunluk 2'ye düştü; kapasite değişmedi."
    stack:
      - frame: main
        vars:
          - { name: yigin, type: "Vec<&str>", value: "ptr · len=2 · cap=3", to: h1, mut: true }
          - { name: tabak, type: "&str", value: "\"kırmızı tabak\"", note: "bu turda yaşar" }
    heap:
      - { id: h1, value: "mavi │ yeşil │ (boş)" }
  - caption: "Üç turdan sonra uzunluk 0. Dördüncü `pop()` `None` döndürür; `Some(tabak)` deseni uymaz ve döngü biter."
    stack:
      - frame: main
        vars:
          - { name: yigin, type: "Vec<&str>", value: "ptr · len=0 · cap=3", to: h1, mut: true }
    heap:
      - { id: h1, value: "(boş) │ (boş) │ (boş)" }
```

`pop` elemanı vektörden **çıkarır** ve sahipliğini sana verir. Vektör `String` tutsaydı, `tabak` o
`String`'in yeni sahibi olurdu ve tur bitince `drop` edilirdi. Bu yüzden `while let` + `pop` bir
koleksiyonu "tüketerek" işlemenin doğal yoludur.

`while let` her zaman bir `Vec` istemez; her turda yeniden değerlendirilen herhangi bir ifade olabilir.
Modül 2'deki `checked_sub`'ı hatırla: çıkarma taşacaksa (`u32` için sıfırın altına inecekse) `None` döndürür.

```predict
code: |
  fn main() {
      let mut sayac: Option<u32> = Some(3);
      while let Some(n) = sayac {
          print!("{n} ");
          sayac = n.checked_sub(1);
      }
      println!("bitti");
  }
options:
  - "3 2 1 bitti"
  - "3 2 1 0 bitti"
  - "2 1 0 bitti"
  - "Program sonsuza kadar döner"
answer: 1
explanation: |
  `sayac` sırayla `Some(3)`, `Some(2)`, `Some(1)`, `Some(0)` olur ve her biri yazdırılır. `0` yazıldıktan
  sonra `0u32.checked_sub(1)` çağrılır: `u32` negatif olamayacağı için sonuç **taşar** ve `checked_sub`
  panik yerine `None` döndürür (Modül 2). `sayac` `None` olunca desen uymaz ve döngü biter. Sıradan
  `n - 1` yazsaydın, `0 - 1` debug modunda *attempt to subtract with overflow* paniğiyle çökerdi.
```

`while let`'in `for`'dan farkı, koleksiyonun **döngü sırasında değişebilmesidir**. Bir klasördeki
dosyaların toplam boyutunu hesaplayan bu programda, bir klasörü açınca içindekiler yığına geri konuyor:

```rust
enum Oge {
    Dosya { ad: String, kb: u32 },
    Klasor { ad: String, icerik: Vec<Oge> },
}

fn main() {
    let belgeler = Oge::Klasor {
        ad: String::from("Belgeler"),
        icerik: vec![
            Oge::Dosya { ad: String::from("cv.pdf"), kb: 120 },
            Oge::Klasor {
                ad: String::from("Fotoğraflar"),
                icerik: vec![
                    Oge::Dosya { ad: String::from("deniz.jpg"), kb: 2048 },
                    Oge::Dosya { ad: String::from("kedi.jpg"), kb: 1536 },
                ],
            },
        ],
    };

    let mut bekleyen = vec![belgeler];
    let mut toplam = 0;
    while let Some(oge) = bekleyen.pop() {
        match oge {
            Oge::Dosya { ad, kb } => {
                println!("  {ad}: {kb} KB");
                toplam += kb;
            }
            Oge::Klasor { ad, icerik } => {
                println!("{ad}/ açılıyor");
                for alt in icerik {
                    bekleyen.push(alt); // döngü sürerken yığına yeni iş ekleniyor
                }
            }
        }
    }
    println!("Toplam: {toplam} KB");
}
```

`Oge`, kendi tipinden elemanlar tutan bir `Vec` içeriyor. Bu serbesttir, çünkü `Vec` elemanlarını
heap'te saklar ve `Oge`'nin kendisi sabit boyutta kalır. (Bir enum'un kendini **doğrudan** içermesi
ise E0072 verir; çözümünü, `Box`'ı, Modül 17'de göreceksin.)

```parsons
prompt: |
  Bir metin editörünün "geri al" yığınını boşaltan programı kur: geçmişteki her işlemi en sondan
  başlayarak geri al ve sonunda kaç işlem geri alındığını yazdır.
lines: |
  fn main() {
      let mut gecmis = vec!["yaz: Merhaba", "sil: 3 harf", "yaz: Dünya"];
      let mut sayi = 0;
      while let Some(islem) = gecmis.pop() {
          println!("geri alındı → {islem}");
          sayi += 1;
      }
      println!("{sayi} işlem geri alındı");
  }
distractors: |
      while let Some(islem) = gecmis {
      let gecmis = vec!["yaz: Merhaba", "sil: 3 harf", "yaz: Dünya"];
explanation: |
  `pop` vektörü değiştirdiği için `gecmis` `mut` olmalı; `let gecmis` (mut olmadan) E0596 verirdi.
  `while let Some(islem) = gecmis` ise derlenmez: `gecmis` bir `Vec`, `Option` değil; her turda
  `pop()` çağrılarak yeni bir `Option` üretilmesi gerekiyor. Sayaç döngüden önce tanımlanmalı ki döngü
  bittikten sonra da kullanılabilsin.
```

## matches!: evet ya da hayır

Bazen değerin içini açmak istemezsin; sadece "bu değer şu desene uyuyor mu?" diye sormak istersin.
İlk akla gelen `==` olur. Derlenir mi?

```compiles
code: |
  enum Durum {
      Acik,
      Kapali,
  }

  fn main() {
      let dukkan = Durum::Acik;
      if dukkan == Durum::Kapali {
          println!("Dükkan kapalı");
      }
  }
answer: false
error: E0369
explanation: |
  Derlenmez: **E0369**, *binary operation `==` cannot be applied to type `Durum`*. Kendi tanımladığın
  bir tip için `==`'nin ne anlama geldiğini Rust kendiliğinden varsaymaz. Derleyici bir çözüm önerir
  (`#[derive(PartialEq)]`); aşağıda hem onu hem de "bu değer şu desene uyuyor mu?" sorusunun asıl aracını
  göreceğiz.
```

:::error
```text
error[E0369]: binary operation `==` cannot be applied to type `Durum`
 --> src/main.rs:8:15
  |
8 |     if dukkan == Durum::Kapali {
  |        ------ ^^ ------------- Durum
  |        |
  |        Durum
  |
note: an implementation of `PartialEq` might be missing for `Durum`
 --> src/main.rs:1:1
  |
1 | enum Durum {
  | ^^^^^^^^^^ must implement `PartialEq`
help: consider annotating `Durum` with `#[derive(PartialEq)]`
  |
1 + #[derive(PartialEq)]
2 | enum Durum {
```
`PartialEq`, "eşitlik karşılaştırması yapılabilir" anlamına gelen bir **trait**'tir. `#[derive(Debug)]`
gibi `#[derive(PartialEq)]` yazınca Rust karşılaştırmayı senin için üretir. Trait'leri Modül 11'de
öğreneceksin. Ama `==` her zaman işe yaramaz: `Bildirim::Begeni(adet)` gibi **içinde veri olan** bir
varyant için "herhangi bir sayıda beğeni mi?" sorusunu `==` ile soramazsın; karşılaştıracak tek bir değer yok.
:::

Desen sorusunu doğrudan sormanın aracı **`matches!`** makrosudur: `matches!(deger, DESEN)` değer desene
uyuyorsa `true`, uymuyorsa `false` üretir. Desen kısmında `match` kollarında yazabildiğin her şeyi
kullanabilirsin:

```rust
# #[allow(dead_code)]
enum Siparis {
    Hazirlaniyor,
    Kargoda { takip_no: String, gun: u32 },
    Teslim,
    Iptal,
}

impl Siparis {
    fn yolda_mi(&self) -> bool {
        matches!(self, Siparis::Hazirlaniyor | Siparis::Kargoda { .. })
    }
}

fn main() {
    let c = 'ö';
    let unlu = matches!(c, 'a' | 'e' | 'ı' | 'i' | 'o' | 'ö' | 'u' | 'ü');
    let not = 72;
    let gecti = matches!(not, 50..=100);
    println!("'{c}' ünlü mü? {unlu}. {not} geçer not mu? {gecti}");

    let siparisler = [
        Siparis::Teslim,
        Siparis::Kargoda { takip_no: String::from("TR123"), gun: 2 },
        Siparis::Hazirlaniyor,
        Siparis::Iptal,
    ];
    let mut yoldaki = 0;
    for s in &siparisler {
        if s.yolda_mi() {
            yoldaki += 1;
        }
    }
    println!("Yolda olan sipariş: {yoldaki}");
}
```

- `Siparis::Kargoda { .. }`: `..` "geri kalan alanlar ne olursa olsun" demektir. İlgilenmediğin alanları
  tek tek `takip_no: _, gun: _` diye yazmak zorunda kalmazsın. Tuple varyantlarda da çalışır:
  `Bildirim::Begeni(..)`.
- `matches!` bir `bool` ürettiği için `if`, `&&`, `||` ile ya da bir metodun dönüş değeri olarak doğrudan
  kullanılır. `yolda_mi` gibi `..._mi` adlı küçük soru metotları çok yaygın bir kalıptır.
- `Option` için hazır karşılıkları zaten var: `x.is_some()` aslında `matches!(x, Some(_))` demektir
  (2. ders).

```predict
code: |
  enum Hamle {
      Ileri(u32),
      Don,
      Bekle,
  }

  fn main() {
      let hamleler = [Hamle::Ileri(3), Hamle::Bekle, Hamle::Ileri(0), Hamle::Don, Hamle::Ileri(5)];
      let mut a = 0;
      let mut b = 0;
      for h in &hamleler {
          if matches!(h, Hamle::Ileri(_)) {
              a += 1;
          }
          if matches!(h, Hamle::Ileri(1..) | Hamle::Don) {
              b += 1;
          }
      }
      println!("{a} {b}");
  }
options:
  - "3 3"
  - "3 4"
  - "2 3"
  - "5 3"
answer: 0
explanation: |
  `a`: `Hamle::Ileri(_)` içindeki sayı ne olursa olsun her `Ileri`'ye uyar: `Ileri(3)`, `Ileri(0)`,
  `Ileri(5)` → **3**. `b`: `Ileri(1..)` "1 ya da daha büyük bir sayı taşıyan `Ileri`" demektir; `Ileri(0)`
  uymaz. `Ileri(3)`, `Ileri(5)` ve `|`'nin sağındaki `Don` → **3**. `1..` sonu açık bir aralık
  desenidir: üst sınırı yazmazsan tipin en büyük değerine kadar gider.
```

## Doğru aracı seçmek

Artık bir değeri bir desenle beş farklı biçimde sorgulayabiliyorsun. Hepsinin altında aynı desen dili
yatıyor; fark, **ne istediğinde**:

| İstediğin | Araç | Örnek |
|---|---|---|
| Her durum için ayrı bir karar, hiçbiri unutulmasın | `match` | `match islem { Topla(a, b) => ..., ... }` |
| Tek bir desen ilginç, gerisi için hiçbir şey ya da tek bir `else` | `if let` | `if let Some(oran) = kupon { ... }` |
| Değeri çıkar, çıkaramazsan hemen dön; değer **devamında** lazım | `let ... else` | `let Some(adres) = &m.adres else { return ...; };` |
| Desen uydukça tekrarla | `while let` | `while let Some(is) = yigin.pop() { ... }` |
| Sadece "uyuyor mu?" sorusu, cevap `bool` | `matches!` | `matches!(c, '0'..='9')` |

:::tip Bir koku: "if let" merdiveni
Aynı değer üzerinde art arda `if let A = x { } else if let B = x { } else if let C = x { }` yazdığını
fark edersen, dur ve bir `match`'e çevir. Daha kısa olur ve eksiksizlik denetimini geri kazanırsın.
:::

:::ferris
Bu araçlar yeni bir şey yapmıyor; hepsi `match`'in kısaltmaları. Ama doğru kısaltma, kodunu okuyana
"burada neyi önemsiyorum" sorusunun cevabını ilk bakışta verir. 🦀
:::

Şimdi hepsini bir arada kullanacağın daha zorlu bir problem.

````exercise
id: m07-e-ters-polonya
title: Ters Polonya hesap makinesi
difficulty: 3
prompt: |
  Eski HP hesap makineleri parantez kullanmaz; **ters Polonya gösterimi (RPN)** kullanır. Önce sayılar,
  sonra işlem yazılır: `3 4 +` → 7, `2 3 4 * +` → 2 + (3 × 4) = 14.

  Kural basit ve bir **yığınla** çalışır. Jetonları soldan sağa oku:
  - Sayı gelirse yığına koy (`push`).
  - İşlem gelirse yığından **iki** sayı çıkar (`pop`), işlemi uygula ve sonucu yığına geri koy.
    **Dikkat:** ilk çıkan sayı **sağ** taraftır: `10 3 -` için önce `3`, sonra `10` çıkar ve sonuç `10 - 3 = 7`.
  - Jetonlar bitince yığında **tam olarak bir** sayı kalmalıdır; sonuç odur.

  `hesapla` fonksiyonunu yaz. İfade bozuksa `None` döndür:
  - bir işlem geldiğinde yığında iki sayı yoksa (`3 +`),
  - sonunda yığın boşsa (hiç jeton yoksa) ya da birden fazla sayı kalmışsa (`1 2`).

  İpucu: yığından çıkarmak için `let ... else` biçilmiş kaftan.
starter: |
  enum Jeton {
      Sayi(i32),
      Arti,
      Eksi,
      Carpi,
  }

  fn hesapla(jetonlar: &[Jeton]) -> Option<i32> {
      todo!()
  }

  fn main() {
      use Jeton::*;
      let ifade = [Sayi(2), Sayi(3), Sayi(4), Carpi, Arti];
      match hesapla(&ifade) {
          Some(sonuc) => println!("2 3 4 * + = {sonuc}"),
          None => println!("bozuk ifade"),
      }
  }
solution: |
  enum Jeton {
      Sayi(i32),
      Arti,
      Eksi,
      Carpi,
  }

  fn hesapla(jetonlar: &[Jeton]) -> Option<i32> {
      let mut yigin = Vec::new();
      for jeton in jetonlar {
          if let Jeton::Sayi(n) = jeton {
              yigin.push(*n);
              continue;
          }
          let Some(sag) = yigin.pop() else {
              return None;
          };
          let Some(sol) = yigin.pop() else {
              return None;
          };
          let sonuc = match jeton {
              Jeton::Arti => sol + sag,
              Jeton::Eksi => sol - sag,
              Jeton::Carpi => sol * sag,
              Jeton::Sayi(_) => unreachable!(),
          };
          yigin.push(sonuc);
      }
      let Some(sonuc) = yigin.pop() else {
          return None;
      };
      if yigin.is_empty() { Some(sonuc) } else { None }
  }

  fn main() {
      use Jeton::*;
      let ifade = [Sayi(2), Sayi(3), Sayi(4), Carpi, Arti];
      match hesapla(&ifade) {
          Some(sonuc) => println!("2 3 4 * + = {sonuc}"),
          None => println!("bozuk ifade"),
      }
  }
check: tests
tests: |
  use Jeton::*;

  #[test]
  fn basit_islemler() {
      assert_eq!(hesapla(&[Sayi(3), Sayi(4), Arti]), Some(7), "3 4 + = 7");
      assert_eq!(hesapla(&[Sayi(6), Sayi(7), Carpi]), Some(42), "6 7 * = 42");
      assert_eq!(hesapla(&[Sayi(42)]), Some(42), "tek bir sayı, kendisinin sonucudur");
  }

  #[test]
  fn cikarmada_sira_onemli() {
      assert_eq!(hesapla(&[Sayi(10), Sayi(3), Eksi]), Some(7), "10 3 - = 10 - 3 = 7: ilk pop edilen sağ taraftır");
      assert_eq!(hesapla(&[Sayi(3), Sayi(10), Eksi]), Some(-7), "3 10 - = 3 - 10 = -7");
  }

  #[test]
  fn uzun_ifadeler() {
      assert_eq!(hesapla(&[Sayi(2), Sayi(3), Sayi(4), Carpi, Arti]), Some(14), "2 3 4 * + = 2 + 12 = 14");
      let ifade = [Sayi(5), Sayi(1), Sayi(2), Arti, Sayi(4), Carpi, Arti, Sayi(3), Eksi];
      assert_eq!(hesapla(&ifade), Some(14), "5 1 2 + 4 * + 3 - = 5 + 12 - 3 = 14");
  }

  #[test]
  fn bozuk_ifadeler_none_dondurur() {
      assert_eq!(hesapla(&[]), None, "hiç jeton yoksa sonuç yok");
      assert_eq!(hesapla(&[Arti]), None, "işlem için yığında iki sayı olmalı");
      assert_eq!(hesapla(&[Sayi(3), Arti]), None, "3 + : ikinci sayı eksik");
      assert_eq!(hesapla(&[Sayi(1), Sayi(2)]), None, "1 2 : sonda yığında iki sayı kaldı");
      assert_eq!(hesapla(&[Sayi(1), Sayi(2), Arti, Carpi]), None, "1 2 + * : çarpma için yığında tek sayı kaldı");
  }
hints:
  - "Boş bir yığınla başla: `let mut yigin = Vec::new();` ve `for jeton in jetonlar { ... }` ile jetonları gez. `jeton` bir `&Jeton`'dur."
  - "Sayıysa: `if let Jeton::Sayi(n) = jeton { yigin.push(*n); continue; }`. İşlemse iki kez `let Some(sag) = yigin.pop() else { return None; };` (önce `sag`, sonra `sol`), sonra `match jeton { Jeton::Arti => sol + sag, ... }` ile hesaplayıp sonucu `push` et."
  - "Döngüden sonra: `let Some(sonuc) = yigin.pop() else { return None; };` ve ardından yığında başka sayı kaldıysa `None`: `if yigin.is_empty() { Some(sonuc) } else { None }`. İşlem `match`'inde `Jeton::Sayi(_)` koluna asla gelinmez; oraya `unreachable!()` yazabilirsin."
explanation: |
  Çözümde dersin bütün araçları bir arada:

  - `if let Jeton::Sayi(n) = jeton { ...; continue; }`: tek ilginç desen sayı; uyarsa yığına koy ve
    sonraki jetona geç (Modül 3'teki `continue`).
  - `let Some(sag) = yigin.pop() else { return None; };`: yığın boşsa ifade bozuktur; hemen dön.
    `sag` ve `sol`, `else`'ten sonra da kullanılabiliyor; `if let` ile bu mümkün olmazdı.
  - Son kontrol yine bir `let ... else` ve bir `is_empty`.

  İşlem `match`'indeki `Jeton::Sayi(_) => unreachable!()` kolu dikkat çekici. O noktaya bir sayının
  gelemeyeceğini **biz** biliyoruz (`continue` onu yakaladı), ama derleyici bilmiyor ve eksiksizlik
  istiyor. `unreachable!()`, `todo!()`'nun kardeşidir: "buraya asla gelinmez; gelinirse bu bir
  hatadır" der ve gelinirse panikler.

  `unreachable!()` ihtiyacı aslında küçük bir tasarım kokusudur: `Jeton` tipi "sayı mı, işlem mi?"
  ayrımını kendi yapısında taşımıyor. Bir sonraki dersin "geçersiz durumları temsil edilemez kıl" fikriyle
  işlemleri ayrı bir enum'a taşıyabilirsin:

  ```rust
  enum Islec { Arti, Eksi, Carpi } // işleç (operator)
  enum Jeton { Sayi(i32), Islem(Islec) }

  // döngünün içinde:
  match jeton {
      Jeton::Sayi(n) => yigin.push(*n),
      Jeton::Islem(islec) => {
          let Some(sag) = yigin.pop() else { return None; };
          let Some(sol) = yigin.pop() else { return None; };
          yigin.push(match islec {
              Islec::Arti => sol + sag,
              Islec::Eksi => sol - sag,
              Islec::Carpi => sol * sag,
          });
      }
  }
  ```

  Artık iç `match` sayıları hiç görmüyor; ne `unreachable!()` ne de `_` kolu gerekiyor. Yeni bir işlem
  (ör. `Bolu`) eklediğinde derleyici seni E0004 ile tam bu satıra getirir. `_ => sol * sag` gibi bir
  kısayol ise yeni işlemi sessizce çarpma sayardı.

  Hesap makineleri, derleyiciler ve sanal makineler (Java'nın JVM'i, Python'un yorumlayıcısı,
  WebAssembly) ifadeleri tam olarak böyle bir yığınla değerlendirir.
````

## Özet

:::remember
- `if let DESEN = DEGER { ... }`: tek bir desen ilginçken `match`'in kısa yolu. Tek `=` kullanılır;
  bağlanan değişkenler yalnızca bloğun içinde yaşar. Eksiksizlik denetimi yoktur.
- `if let ... else` bir ifadedir; iki dal aynı tipte değer üretir. `else if let` ve (2024 sürümünde)
  `if let ... && kosul` let zincirleri yazılabilir.
- Sıradan `let` yalnızca **çürütülemez (irrefutable)** desen kabul eder; `let Some(x) = opt;` → E0005.
- `let DESEN = DEGER else { ... };`: uyarsa bağla ve **devam et**; uymazsa `else` bloğu `return`,
  `break`, `continue` ya da `panic!` ile akıştan **çıkmak zorundadır** (yoksa E0308, *does not diverge*).
- `while let Some(x) = yigin.pop() { ... }`: desen uydukça döner; `Vec`'i yığın (LIFO) gibi boşaltmanın
  doğal yolu. Döngü içinde yığına eleman eklemek serbesttir.
- `matches!(deger, DESEN)` → `bool`. `|`, aralıklar ve `{ .. }` / `(..)` ile çalışır; veri taşıyan
  varyantları sormak için `==`'den (E0369, `PartialEq` gerekir) daha uygundur.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — `let ... else` ile iç içe `if let` arasındaki fark nedir? `else` bloğu
  neden akıştan çıkmak (return, break, panic!...) zorundadır?
answer: |
  Model cevap: İç içe `if let`'te bağlanan değişken yalnızca kendi bloğunda yaşar; her yeni kontrol
  kodu bir seviye daha içeri iter ve hata durumları en sona, kendi koşullarından uzağa düşer. `let ...
  else` ise değişkeni fonksiyonun geri kalanı için bağlar; kötü durumu hemen orada ele alıp çıkar, asıl
  iş düz ve sola yaslı kalır. `else` bloğunun akıştan çıkması gerekir, çünkü `let`'ten sonraki kod
  bağlanan değişkenlerin dolu olduğunu varsayar. `else` normal biçimde bitip kod devam etseydi, desen
  uymadığı için değişkenlerin bir değeri olmazdı. Derleyici bu yüzden `else` bloğunun tipinin `!`
  (never) olmasını ister.
```

```flashcards
- front: "`if let Some(x) = opt { ... }` hangi `match`'in kısaltmasıdır?"
  back: "`match opt { Some(x) => { ... } _ => {} }`. Tek ilginç desen, gerisi için hiçbir şey."
- front: "`if let` ile bağlanan değişkeni bloğun dışında kullanırsan hangi hatayı alırsın?"
  back: "E0425 (*cannot find value in this scope*). Değişken yalnızca bloğun içinde yaşar; dışarıda da lazımsa `let ... else` kullan."
- front: "`let Some(x) = opt;` neden derlenmez (E0005)?"
  back: "Sıradan `let` her değere uyan (çürütülemez, irrefutable) bir desen ister. `Some(x)` `None`'a uymaz; `let ... else` gerekir."
- front: "`let ... else` yapısında `else` bloğu nasıl bitmek zorundadır?"
  back: "Akıştan çıkarak (diverge): `return`, `break`, `continue` ya da `panic!`. Aksi hâlde E0308: *`else` clause of `let...else` does not diverge*."
- front: "`while let Some(t) = yigin.pop() { ... }` döngüsü ne zaman biter?"
  back: "`pop()` `None` döndürdüğünde, yani vektör boşaldığında. Elemanlar sondan başa (LIFO) çıkar."
- front: "`matches!(c, '0'..='9')` ne üretir?"
  back: "Bir `bool`: `c` bir rakamsa `true`, değilse `false`."
- front: "Kendi enum'unda `if durum == Durum::Kapali` neden derlenmez, yerine ne yazabilirsin?"
  back: "Enum `PartialEq` uygulamıyor (E0369). `matches!(durum, Durum::Kapali)` yaz ya da enum'a `#[derive(PartialEq)]` ekle."
- front: "Desende `Siparis::Kargoda { .. }` ne anlama gelir?"
  back: "`Kargoda` varyantı, alanları ne olursa olsun. `..` geri kalan alanları yok sayar."
```
