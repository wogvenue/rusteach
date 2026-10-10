---
id: m07-boss
title: "Boss: Desen Ustası"
minutes: 35
type: boss
keywords: [enum, Option, match, if let, let else, while let, matches!, durum makinesi]
---

Modül 7'nin sonuna geldin! Bu sınavda enum'ları, `Option`'ı, `match`'i ve kısa yollarını, son olarak da
enum'larla modellemeyi bir arada kullanacaksın. Araya önceki modüllerden birkaç soru da karıştırdık.
Geçmek için **%80** yeterli. Acele etme: her kodu satır satır oku, derleyici gibi düşün. 🦀

## Enum'lar ve Option

```quiz
question: |
  Bir ödeme sayfasında müşteri **ya** nakit **ya** kredi kartı (taksit sayısıyla) **ya da** havale
  (hangi bankadan yapıldığıyla) ile ödüyor. Hangi tasarım geçersiz durumlara **izin vermez**?
options:
  - "`struct Odeme { nakit: bool, kart: bool, havale: bool, taksit: u8, banka: String }`"
  - "`struct Odeme { yontem: String, taksit: Option<u8>, banka: Option<String> }`"
  - "`enum Odeme { Nakit, Kart { taksit: u8 }, Havale { banka: String } }`"
  - "`enum Odeme { Nakit, Kart, Havale }` ve ayrıca `taksit: u8`, `banka: String` alanları olan bir struct"
answer: 2
explanation: |
  Ödeme yöntemleri birbirini **dışlıyor** ("veya") ve her yöntemin kendine özgü verisi var. Veri taşıyan
  varyantları olan enum ikisini birden ifade eder: taksit sayısı yalnızca `Kart`'ta, banka yalnızca
  `Havale`'de bulunur. Bool'lu tasarım "hem nakit hem kart" değerine, metinli tasarım yazım hatalarına ve
  "nakit ama taksitli" gibi tutarsızlıklara izin verir. Son seçenekte de nakit bir ödemenin taksit
  alanı yine vardır.
feedback:
  - "Üç bool 8 kombinasyon üretir; \"hem nakit hem havale\" yazılabilir."
  - "`yontem: String` her metni kabul eder ve `\"nakit\"` bir ödemeye `taksit: Some(6)` verilebilir."
  - "Doğru! Her yöntem tam olarak kendi verisini taşıyor."
  - "Yöntem enum oldu ama taksit ve banka hâlâ her ödemede var; nakit bir ödemenin taksiti olmamalı."
```

```compiles
code: |
  fn main() {
      let fiyat: u32 = 200;
      let indirim: Option<u32> = Some(30);
      let odenecek = fiyat - indirim;
      println!("{odenecek}");
  }
answer: false
error: E0277
explanation: |
  Derlenmez: **E0277**, *cannot subtract `Option<u32>` from `u32`*. `Option<u32>` bir `u32` değildir;
  içinde bir sayı **olabilir** de olmayabilir de. Rust, kutuyu açmadan içindekiyle hesap yapmana izin
  vermez. "Null kontrolünü unutmak" bu yüzden derleme hatasıdır. Çözüm kutuyu açmak:
  `fiyat - indirim.unwrap_or(0)` ya da bir `match`.
```

Modül 5'i hatırla:

```compiles
code: |
  enum Mesaj {
      Yaz(String),
      Cik,
  }

  impl Mesaj {
      fn metin(&self) -> String {
          match self {
              Mesaj::Yaz(s) => s,
              Mesaj::Cik => String::from("(çıkış)"),
          }
      }
  }

  fn main() {
      let m = Mesaj::Yaz(String::from("selam"));
      println!("{}", m.metin());
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308**, *mismatched types: expected `String`, found `&String`*. `self` bir referans
  (`&Mesaj`) olduğu için desenin bağladığı `s` de bir **referanstır**: `&String`. Fonksiyon ise sahip
  olunan bir `String` döndürmeyi vaat ediyor. Ödünç aldığın bir şeyi sahibi gibi başkasına veremezsin
  (Modül 5). Çözümler: dönüş tipini `&str` yapıp `s` döndürmek (Modül 5: `&String` `&str`'ye kendiliğinden
  dönüşür), ya da bilinçli olarak bir kopya üretmek: `s.clone()`.
```

```predict
code: |
  struct Masa {
      no: u8,
      musteri: Option<String>,
  }

  fn main() {
      let mut masa = Masa { no: 3, musteri: Some(String::from("Ece")) };
      let giden = masa.musteri.take();
      let simdiki = masa.musteri.unwrap_or(String::from("boş"));
      println!("{} {:?} {}", masa.no, giden, simdiki);
  }
options:
  - "3 Some(\"Ece\") boş"
  - "3 Some(\"Ece\") Ece"
  - "3 None boş"
  - "Derlenmez: `masa.musteri` taşındıktan sonra kullanılıyor"
answer: 0
explanation: |
  `take()` kutunun içindekini (`Some("Ece")`) dışarı verir ve yerine `None` bırakır; `giden` artık
  `Some("Ece")`. `masa.musteri` `None` olduğu için `unwrap_or` varsayılan değeri, `"boş"`u döndürür.
  Program derlenir: `take()` alanı **ödünç alıp** değiştirir, taşımaz. `unwrap_or` ise alanı taşır, ama
  sonrasında yalnızca `masa.no` kullanılıyor ve bu ayrı bir alan.
```

## match

```predict
code: |
  fn bilet(yas: u32, ogrenci: bool) -> &'static str {
      match (yas, ogrenci) {
          (0..=6, _) => "ücretsiz",
          (_, true) => "öğrenci",
          (65.., _) => "emekli",
          _ => "tam",
      }
  }

  fn main() {
      for (yas, ogrenci) in [(5, true), (20, true), (70, true), (70, false), (30, false)] {
          print!("{} ", bilet(yas, ogrenci));
      }
      println!();
  }
options:
  - "ücretsiz öğrenci öğrenci emekli tam"
  - "ücretsiz öğrenci emekli emekli tam"
  - "öğrenci öğrenci öğrenci emekli tam"
  - "Derlenmez: desenler örtüşüyor"
answer: 0
explanation: |
  Kollar yukarıdan aşağıya denenir ve **ilk uyan** kazanır. `(5, true)` ilk kola uyar: ücretsiz.
  `(20, true)` ikinci kola: öğrenci. `(70, true)` hem `(_, true)`'ya hem `(65.., _)`'ya uyar, ama
  `(_, true)` önce geldiği için **öğrenci** olur. Belki de istenen bu değildi; desen sırası bir iş
  kuralıdır! `(70, false)` emekli, `(30, false)` tam. Örtüşen desenler hata değildir.
```

````quiz
question: |
  Aşağıdaki kod çalışınca ne olur?

  ```rust
  let limit = 100;
  let hiz = 80;
  let sonuc = match hiz {
      limit => "ceza!",
      _ => "sorun yok",
  };
  ```
options:
  - "`sonuc` `\"sorun yok\"` olur, çünkü 80 100'e eşit değil"
  - "`sonuc` `\"ceza!\"` olur; desendeki `limit` her değere uyan **yeni bir değişkendir** ve derleyici uyarı verir"
  - "Derlenmez: `limit` zaten tanımlı olduğu için desende kullanılamaz"
  - "Program panikler"
answer: 1
explanation: |
  Desende tek başına duran bir ad, dışarıdaki değişkenle **karşılaştırılmaz**; her değere uyan ve onu
  bağlayan yeni bir değişken tanımlar (dıştakini gölgeler). Bu yüzden ilk kol her zaman çalışır ve `_`
  koluna ulaşılamaz; derleyici *unreachable pattern* uyarısı verir. Bir değerle karşılaştırmak için
  desende bir `const` (ör. `const LIMIT: u32 = 100;`) ya da `if hiz > limit` kullanılır.
feedback:
  - "Desen `limit` değerini karşılaştırmıyor; yeni bir değişken bağlıyor."
  - "Doğru! Bu, desenlerin en sinsi tuzaklarından biri."
  - "Derlenir; yalnızca uyarı verir. Desendeki ad dıştakini gölgeler."
  - "Panik yok: ilk kol her değere uyar."
````

```compiles
code: |
  fn kapi_durumu(acik: bool, kilitli: bool) -> &'static str {
      match (acik, kilitli) {
          (true, false) => "açık",
          (false, true) => "kilitli",
          (false, false) => "kapalı",
      }
  }

  fn main() {
      println!("{}", kapi_durumu(false, true));
  }
answer: false
error: E0004
explanation: |
  Derlenmez: **E0004**, *non-exhaustive patterns: `(true, true)` not covered*. İki `bool`'dan oluşan bir
  tuple'ın 2 × 2 = 4 olası değeri var ve eksiksizlik denetimi tuple'ın **bütün kombinasyonlarını** sayar;
  `(true, true)` ("açık ama kilitli") açıkta kalmış. "Bu durum zaten olamaz" diye düşünsen bile tip buna
  izin veriyor. İki çıkış yolu var: o kombinasyon için de bir kol yazmak ya da, daha iyisi, kapıyı
  `enum Kapi { Acik, Kapali, Kilitli }` gibi geçersiz kombinasyonu hiç içermeyen bir tiple modellemek.
```

````fill
prompt: |
  Boşlukları doldur: kedi ve köpek için **aynı kol** çalışsın ve ikisinin de adı `ad` olarak bağlansın;
  balık için ayrı bir mesaj yazılsın.
code: |
  enum Hayvan {
      Kedi { ad: String },
      Kopek { ad: String, yas: u8 },
      Balik,
  }

  fn cagir(h: &Hayvan) -> String {
      match h {
          Hayvan::Kedi { ad } ___0 Hayvan::Kopek { ad, .. } => format!("{ad}, gel buraya!"),
          ___1 => String::from("Balıklar çağrılınca gelmez."),
      }
  }

  fn main() {
      let hayvanlar = [
          Hayvan::Kedi { ad: String::from("Tekir") },
          Hayvan::Kopek { ad: String::from("Karabaş"), yas: 4 },
          Hayvan::Balik,
      ];
      for h in &hayvanlar {
          println!("{}", cagir(h));
      }
      if let Hayvan::Kopek { yas, .. } = &hayvanlar[1] {
          println!("Karabaş {yas} yaşında");
      }
  }
blanks:
  - ["|"]
  - ["Hayvan::Balik", "_"]
output: |
  Tekir, gel buraya!
  Karabaş, gel buraya!
  Balıklar çağrılınca gelmez.
  Karabaş 4 yaşında
explanation: |
  `|` iki deseni tek kolda birleştirir. İki alternatif de `ad` adını aynı tiple (`&String`) bağladığı için
  kolun sağında `ad` kullanılabilir. `Kopek { ad, .. }` içindeki `..`, `yas` alanını yok sayar. Son kol
  için `Hayvan::Balik` en iyisidir: `_` da çalışır ama enum'a yeni bir hayvan eklendiğinde derleyicinin
  seni uyarma imkânını elinden alır.
````

````exercise
id: m07-boss-e-komisyon
title: Ödeme komisyonu
difficulty: 3
prompt: |
  Bir e-ticaret sitesi ödeme yöntemine göre komisyon alıyor:

  | Ödeme | Komisyon |
  |---|---|
  | `Nakit` | 0 |
  | `Kart { taksit: 1 }` (tek çekim) | tutarın %2'si |
  | `Kart { taksit: 2..=6 }` | tutarın %4'ü |
  | `Kart` başka bir taksit sayısıyla (0 ya da 6'dan fazla) | **geçersiz** → `None` |
  | `Havale { ayni_banka: true }` | 0 |
  | `Havale { ayni_banka: false }` | sabit 5 TL |

  `komisyon` fonksiyonunu tek bir `match` ile yaz; desenlerin içinde sabit değerler ve **aralıklar**
  kullan. Yüzdeleri tam sayı bölmesiyle hesapla: `tutar * 2 / 100`.
starter: |
  enum Odeme {
      Nakit,
      Kart { taksit: u8 },
      Havale { ayni_banka: bool },
  }

  fn komisyon(tutar: u32, odeme: &Odeme) -> Option<u32> {
      todo!()
  }

  fn main() {
      let odemeler = [
          Odeme::Nakit,
          Odeme::Kart { taksit: 1 },
          Odeme::Kart { taksit: 3 },
          Odeme::Kart { taksit: 12 },
          Odeme::Havale { ayni_banka: false },
      ];
      for odeme in &odemeler {
          match komisyon(1000, odeme) {
              Some(k) => println!("komisyon: {k} TL"),
              None => println!("geçersiz ödeme seçeneği"),
          }
      }
  }
solution: |
  enum Odeme {
      Nakit,
      Kart { taksit: u8 },
      Havale { ayni_banka: bool },
  }

  fn komisyon(tutar: u32, odeme: &Odeme) -> Option<u32> {
      match odeme {
          Odeme::Nakit => Some(0),
          Odeme::Kart { taksit: 1 } => Some(tutar * 2 / 100),
          Odeme::Kart { taksit: 2..=6 } => Some(tutar * 4 / 100),
          Odeme::Kart { .. } => None,
          Odeme::Havale { ayni_banka: true } => Some(0),
          Odeme::Havale { ayni_banka: false } => Some(5),
      }
  }

  fn main() {
      let odemeler = [
          Odeme::Nakit,
          Odeme::Kart { taksit: 1 },
          Odeme::Kart { taksit: 3 },
          Odeme::Kart { taksit: 12 },
          Odeme::Havale { ayni_banka: false },
      ];
      for odeme in &odemeler {
          match komisyon(1000, odeme) {
              Some(k) => println!("komisyon: {k} TL"),
              None => println!("geçersiz ödeme seçeneği"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn nakit_ve_ayni_banka_komisyonsuz() {
      assert_eq!(komisyon(1000, &Odeme::Nakit), Some(0), "nakit ödemede komisyon yok");
      assert_eq!(komisyon(750, &Odeme::Havale { ayni_banka: true }), Some(0), "aynı banka havalesinde komisyon yok");
  }

  #[test]
  fn baska_banka_havalesi_sabit_ucret() {
      assert_eq!(komisyon(1000, &Odeme::Havale { ayni_banka: false }), Some(5), "başka bankaya havale sabit 5 TL");
      assert_eq!(komisyon(40, &Odeme::Havale { ayni_banka: false }), Some(5), "sabit ücret tutardan bağımsızdır");
  }

  #[test]
  fn tek_cekim_yuzde_iki() {
      assert_eq!(komisyon(1000, &Odeme::Kart { taksit: 1 }), Some(20), "1000 TL'nin %2'si 20 TL");
      assert_eq!(komisyon(250, &Odeme::Kart { taksit: 1 }), Some(5), "250 TL'nin %2'si 5 TL");
  }

  #[test]
  fn taksitli_yuzde_dort() {
      assert_eq!(komisyon(1000, &Odeme::Kart { taksit: 2 }), Some(40), "2 taksit: %4");
      assert_eq!(komisyon(500, &Odeme::Kart { taksit: 6 }), Some(20), "6 taksit hâlâ geçerli: 500 TL'nin %4'ü 20 TL");
  }

  #[test]
  fn gecersiz_taksit_none() {
      assert_eq!(komisyon(1000, &Odeme::Kart { taksit: 0 }), None, "0 taksit geçersiz");
      assert_eq!(komisyon(1000, &Odeme::Kart { taksit: 7 }), None, "7 taksit izin verilen sınırın dışında");
      assert_eq!(komisyon(1000, &Odeme::Kart { taksit: 12 }), None, "12 taksit izin verilen sınırın dışında");
  }
hints:
  - "Desenler alanların içine sabit değer yazmana izin verir: `Odeme::Kart { taksit: 1 } => ...`, `Odeme::Havale { ayni_banka: true } => ...`"
  - "Taksitli kartlar için bir aralık deseni: `Odeme::Kart { taksit: 2..=6 } => Some(tutar * 4 / 100),`"
  - "Geri kalan bütün kartlar geçersiz: özel kart kollarından **sonra** `Odeme::Kart { .. } => None,` yaz. Havale için `true` ve `false` iki ayrı kol olabilir."
require:
  - pattern: '\.\.='
    message: "Taksit sayısını bir aralık deseniyle (`2..=6`) yakala."
explanation: |
  Komisyon tablosu neredeyse birebir koda dönüştü: her satır bir kol. Desenler hem varyantı hem de
  alanların değerini sınıyor (`taksit: 1`, `taksit: 2..=6`, `ayni_banka: true`). Kart kollarının sırası
  önemli: genel `Odeme::Kart { .. }` en sonda; önde olsaydı bütün kartlar geçersiz sayılırdı ve
  derleyici diğer kart kollarına ulaşılamadığını söylerdi.

  Neden `_ => None` değil de `Odeme::Kart { .. } => None`? `_`, ileride eklenecek yeni bir ödeme
  yöntemini de (ör. `Odeme::KapidaOdeme`) sessizce "geçersiz" sayardı. Daha dar desen, E0004'ün seni
  uyarmasını sağlar. Havale için iki kol yerine `Odeme::Havale { ayni_banka } => if *ayni_banka { Some(0) } else { Some(5) }`
  da yazılabilirdi, ama sabit değerli desenler tabloyu daha net yansıtıyor.
````

## if let, let else, while let ve matches!

```compiles
code: |
  fn ilk_parca(metin: &str) -> &str {
      let Some((ilk, _)) = metin.split_once(',') else {
          println!("virgül yok");
      };
      ilk
  }

  fn main() {
      println!("{}", ilk_parca("elma,armut"));
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308**, *`else` clause of `let...else` does not diverge*. `else` bloğu yalnızca bir mesaj
  yazdırıp normal biçimde bitiyor. Ama `let`'ten sonraki satır `ilk`'i kullanıyor; desen uymadıysa `ilk`'in
  değeri ne olacak? `else` bloğu akıştan çıkmalı: burada `return metin;` ya da `return "";` gibi.
```

```predict
code: |
  fn main() {
      let mut yigin = vec![1, 2, 3];
      while let Some(n) = yigin.pop() {
          print!("{n} ");
          if n == 3 {
              yigin.push(10);
          }
      }
      println!("| kalan: {}", yigin.len());
  }
options:
  - "3 10 2 1 | kalan: 0"
  - "3 2 1 | kalan: 1"
  - "3 2 1 10 | kalan: 0"
  - "1 2 3 10 | kalan: 0"
answer: 0
explanation: |
  `pop` her zaman **son** elemanı çıkarır (LIFO). Önce `3` çıkar ve yazılır; `n == 3` olduğu için `10`
  yığının üstüne konur. Sonraki `pop` bu `10`'u verir, ardından `2` ve `1`. Yığın boşalınca `pop` `None`
  döndürür ve döngü biter. `for` döngüsünün aksine `while let`, döngü sırasında koleksiyona eleman
  eklenmesine izin verir; her turda `pop()` yeniden çağrılır.
```

Modül 2'den bir tanıdık:

```predict
code: |
  fn main() {
      let doluluk: u8 = 250;
      let a = matches!(doluluk.checked_add(5), Some(_));
      let b = matches!(doluluk.checked_add(6), None);
      println!("{a} {b}");
  }
options:
  - "true true"
  - "true false"
  - "false true"
  - "Program panikler: attempt to add with overflow"
answer: 0
explanation: |
  `u8` en fazla 255 tutar (Modül 2). `250 + 5 = 255` sığar: `checked_add` `Some(255)` döndürür ve
  `Some(_)` desenine uyar → `a = true`. `250 + 6 = 256` taşar: `checked_add` panik yerine `None` döndürür
  → `b = true`. Panik ancak düz `+` ile, debug modunda olurdu. `matches!` burada "sonuç hangi şekilde?"
  sorusunu bir `bool`'a çeviriyor.
```

```parsons
prompt: |
  Satırları sırala: e-posta adresinde `@` varsa öncesini (kullanıcı adını) döndüren, yoksa
  `"bilinmiyor"` diyerek **hemen dönen** fonksiyonu ve onu kullanan `main`'i kur.
lines: |
  fn kullanici_adi(eposta: &str) -> &str {
      let Some((ad, _)) = eposta.split_once('@') else {
          return "bilinmiyor";
      };
      ad
  }
  fn main() {
      println!("{}", kullanici_adi("zeynep@okul.edu.tr"));
      println!("{}", kullanici_adi("hatali-adres"));
  }
distractors: |
      let Some((ad, _)) = eposta.split_once('@');
      ad;
explanation: |
  `split_once('@')` bir `Option<(&str, &str)>` döndürür. `let Some((ad, _)) = ... else { return ...; };`
  desen uyarsa `ad`'ı fonksiyonun geri kalanı için bağlar, uymazsa erken döner. Sıradan
  `let Some(...) = ...;` E0005 verirdi (çürütülebilir desen). Son satırdaki `ad` noktalı virgülsüz
  olmalı ki fonksiyonun dönüş değeri olsun; `ad;` yazmak dönüş değerini `()` yapar (E0308).
```

````exercise
id: m07-boss-e-gecikme
title: Kütüphane gecikme raporu
difficulty: 2
prompt: |
  Bir kütüphanenin ödünç kayıtları var. Her kayıt ya zamanında iade edilmiş (`None`) ya da kaç gün
  geciktiğini taşıyor (`Some(gun)`). `en_uzun_gecikme` fonksiyonu **gecikmeli kayıtlar arasındaki en
  uzun gecikmeyi** döndürsün; hiç gecikmeli kayıt yoksa `None` döndürsün.

  Dikkat: `Some(0)` da bir gecikme kaydıdır (aynı gün, son dakikada iade); `[Some(0)]` için sonuç `Some(0)`
  olmalı, `None` değil.
starter: |
  fn en_uzun_gecikme(kayitlar: &[Option<u32>]) -> Option<u32> {
      todo!()
  }

  fn main() {
      let kayitlar = [None, Some(3), None, Some(12), Some(5)];
      match en_uzun_gecikme(&kayitlar) {
          Some(gun) => println!("En uzun gecikme: {gun} gün"),
          None => println!("Gecikme yok, tebrikler!"),
      }
  }
solution: |
  fn en_uzun_gecikme(kayitlar: &[Option<u32>]) -> Option<u32> {
      let mut en_uzun: Option<u32> = None;
      for kayit in kayitlar {
          let Some(gun) = kayit else {
              continue;
          };
          en_uzun = match en_uzun {
              None => Some(*gun),
              Some(e) => {
                  if *gun > e { Some(*gun) } else { Some(e) }
              }
          };
      }
      en_uzun
  }

  fn main() {
      let kayitlar = [None, Some(3), None, Some(12), Some(5)];
      match en_uzun_gecikme(&kayitlar) {
          Some(gun) => println!("En uzun gecikme: {gun} gün"),
          None => println!("Gecikme yok, tebrikler!"),
      }
  }
check: tests
tests: |
  #[test]
  fn en_uzun_gecikmeyi_bulur() {
      assert_eq!(en_uzun_gecikme(&[None, Some(3), None, Some(12), Some(5)]), Some(12), "3, 12 ve 5 arasında en uzunu 12");
      assert_eq!(en_uzun_gecikme(&[Some(9), Some(2)]), Some(9), "en uzun gecikme ilk kayıtta olabilir");
      assert_eq!(en_uzun_gecikme(&[Some(1), None, Some(30)]), Some(30), "en uzun gecikme son kayıtta olabilir");
  }

  #[test]
  fn gecikme_yoksa_none() {
      assert_eq!(en_uzun_gecikme(&[]), None, "kayıt yoksa gecikme de yok");
      assert_eq!(en_uzun_gecikme(&[None, None, None]), None, "hepsi zamanında iade edildiyse None");
  }

  #[test]
  fn sifir_gunluk_gecikme_de_sayilir() {
      assert_eq!(en_uzun_gecikme(&[None, Some(0)]), Some(0), "Some(0) bir kayıttır: sonuç Some(0) olmalı, None değil");
  }
hints:
  - "Sonucu bir `Option` içinde biriktir: `let mut en_uzun: Option<u32> = None;` ve kayıtları `for kayit in kayitlar` ile gez (`kayit` bir `&Option<u32>`)."
  - "Zamanında iade edilmiş kayıtları atla: `let Some(gun) = kayit else { continue; };` ya da tüm işi bir `if let Some(gun) = kayit { ... }` bloğunun içinde yap. `gun` bir `&u32`; değeri `*gun`."
  - "Güncelleme için iki durum var: henüz hiç gecikme görülmediyse (`None`) yeni değer doğrudan alınır; görüldüyse büyük olan seçilir: `en_uzun = match en_uzun { None => Some(*gun), Some(e) => if *gun > e { Some(*gun) } else { Some(e) } };`. `unwrap_or(0)` ile karşılaştırma `Some(0)` testinde neden başarısız olur, düşün."
explanation: |
  Asıl incelik **"henüz hiç görmedim" ile "gördüğüm en büyük değer 0" arasındaki fark**. Sonucu
  `let mut en_uzun = 0;` gibi bir sayıyla başlatsaydın sonunda `0`'ın "gecikme yok" mu yoksa "0 günlük
  gecikme" mi olduğunu ayırt edemezdin. `Option` bu iki durumu tipin içinde ayrı tutuyor. Aynı tuzağa
  `if *gun > en_uzun.unwrap_or(0)` yazarak da düşülür: `[Some(0)]` için `0 > 0` yanlıştır ve sonuç `None`
  kalır.

  Güncellemedeki `match en_uzun` iki durumu açıkça ayırıyor: ilk gecikmeli kayıt doğrudan alınır, sonrakiler
  mevcut en büyükle karşılaştırılır. (Tamsayıların `max` metodu bu karşılaştırmayı kısaltır:
  `Some(e) => Some(e.max(*gun))`.) `let ... else { continue; }` ise "işime yaramayan kaydı atla" demenin
  düz yolu; aynı işi `if let Some(gun) = kayit { ... }` bloğu da yapar.

  Modül 14'te iterator'ları öğrendiğinde bu fonksiyon tek satıra inecek:
  `kayitlar.iter().filter_map(|k| *k).max()`.
````

## Enum'larla modelleme

```compiles
code: |
  #[derive(Debug)]
  enum TrafikIsigi {
      Kirmizi,
      Yesil,
  }

  impl TrafikIsigi {
      fn sonraki(self) -> TrafikIsigi {
          match self {
              TrafikIsigi::Kirmizi => TrafikIsigi::Yesil,
              TrafikIsigi::Yesil => TrafikIsigi::Kirmizi,
          }
      }
  }

  fn main() {
      let isik = TrafikIsigi::Kirmizi;
      let yeni = isik.sonraki();
      println!("{isik:?} → {yeni:?}");
  }
answer: false
error: E0382
explanation: |
  Derlenmez: **E0382**, *borrow of moved value: `isik`*. `sonraki` `self` alır, yani `isik`'i
  **tüketir**. Geçişten sonra eski durumu kullanmak yasak; bu, durum makinelerinde istediğimiz güvenlik
  (eskimiş durum kullanılamaz). Eski durumu yazdırmak istiyorsan bunu geçişten **önce** yap ya da
  `isik = isik.sonraki();` ile aynı değişkeni güncelle.
```

```quiz
question: |
  Bir oyun karakteri `Hayatta { can: u32 }`, `Bayilmis { kalan_tur: u8 }` ya da `Olmus` durumunda
  olabilir. Hasar alma geçişini yazıyorsun. Hangi imza, Rust'ta durum makinesi geçişleri için **en
  uygun** olanıdır ve neden?
options:
  - "`fn hasar_al(&self, miktar: u32) -> Durum`, çünkü durumu ödünç almak her zaman en ucuzudur"
  - "`fn hasar_al(self, miktar: u32) -> Durum`, çünkü eski durum tüketilir ve yanlışlıkla kullanılamaz; varyantların içindeki veri kopyalanmadan yeni duruma taşınabilir"
  - "`fn hasar_al(miktar: u32) -> Durum`, çünkü ilişkili fonksiyonlar durumu bilmek zorunda değildir"
  - "Hiçbiri; durum değişimleri yalnızca bool alanlarla yapılabilir"
answer: 1
explanation: |
  Geçiş metotları `self` alıp yeni durumu döndürür: `durum = durum.hasar_al(30);`. Eski değer taşındığı
  için ona yeniden erişmek E0382 verir; "eskimiş durum" hatası derleme zamanında yakalanır. `&self` ile
  yeni bir durum üretebilirdin, ama içerideki sahip olunan verileri (ör. bir `String`) taşıyamazdın, ancak
  kopyalayabilirdin. İlişkili fonksiyonun ise elinde mevcut durum yok: neyden neye geçileceğini bilemez.
feedback:
  - "`&self` ile varyant içindeki sahip olunan veriyi taşıyamazsın; eski durum da kullanılabilir kalır."
  - "Doğru! Sahiplik sistemi durum makinesinin kurallarını destekliyor."
  - "Mevcut durumu bilmeden geçiş kuralı uygulanamaz."
  - "Bool alanlar geçersiz durumlara izin verir; bu modülün ana fikri tam tersi."
```

````exercise
id: m07-boss-e-asansor
title: Akıllı asansör
difficulty: 4
prompt: |
  10 katlı bir binanın asansörünü bir durum makinesiyle yöneteceksin. `EN_UST_KAT` sabiti (Modül 2) ve
  tipler hazır. İki metodu yaz:

  **`isle(self, olay: Olay) -> Asansor`**, `match (self, olay)` ile:

  | Mevcut durum | Olay | Yeni durum |
  |---|---|---|
  | `Duruyor { kat }` | `Cagir(hedef)` | `hedef` bulunduğu kattan farklıysa ve `EN_UST_KAT`'ı aşmıyorsa `Gidiyor { hedef }`; aksi hâlde aynı kalır |
  | `Gidiyor { hedef }` | `Vardi` | `Duruyor { kat: hedef }` |
  | `Bakimda` | `Onarildi` | `Duruyor { kat: 0 }` (zemin kat) |
  | herhangi bir durum | `Ariza` | `Bakimda` |
  | başka her kombinasyon | | durum **aynen** kalır |

  Örneğin hareket hâlindeki asansör yeni çağrıları yok sayar; bakımdaki asansör çağrılamaz.

  **`hareket_halinde_mi(&self) -> bool`**: yalnızca `Gidiyor` durumunda `true`. Bunu `matches!` ile yaz.
starter: |
  const EN_UST_KAT: u8 = 10;

  #[derive(Debug)]
  enum Asansor {
      Duruyor { kat: u8 },
      Gidiyor { hedef: u8 },
      Bakimda,
  }

  enum Olay {
      Cagir(u8),
      Vardi,
      Ariza,
      Onarildi,
  }

  impl Asansor {
      fn isle(self, olay: Olay) -> Asansor {
          todo!()
      }

      fn hareket_halinde_mi(&self) -> bool {
          todo!()
      }
  }

  fn main() {
      let olaylar = [
          Olay::Cagir(4),
          Olay::Cagir(9),
          Olay::Vardi,
          Olay::Cagir(15),
          Olay::Ariza,
          Olay::Cagir(2),
          Olay::Onarildi,
      ];
      let mut asansor = Asansor::Duruyor { kat: 0 };
      for olay in olaylar {
          asansor = asansor.isle(olay);
          println!("{asansor:?} (hareket: {})", asansor.hareket_halinde_mi());
      }
  }
solution: |
  const EN_UST_KAT: u8 = 10;

  #[derive(Debug)]
  enum Asansor {
      Duruyor { kat: u8 },
      Gidiyor { hedef: u8 },
      Bakimda,
  }

  enum Olay {
      Cagir(u8),
      Vardi,
      Ariza,
      Onarildi,
  }

  impl Asansor {
      fn isle(self, olay: Olay) -> Asansor {
          match (self, olay) {
              (Asansor::Duruyor { kat }, Olay::Cagir(hedef)) => {
                  if hedef != kat && hedef <= EN_UST_KAT {
                      Asansor::Gidiyor { hedef }
                  } else {
                      Asansor::Duruyor { kat }
                  }
              }
              (Asansor::Gidiyor { hedef }, Olay::Vardi) => Asansor::Duruyor { kat: hedef },
              (Asansor::Bakimda, Olay::Onarildi) => Asansor::Duruyor { kat: 0 },
              (_, Olay::Ariza) => Asansor::Bakimda,
              (durum, _) => durum,
          }
      }

      fn hareket_halinde_mi(&self) -> bool {
          matches!(self, Asansor::Gidiyor { .. })
      }
  }

  fn main() {
      let olaylar = [
          Olay::Cagir(4),
          Olay::Cagir(9),
          Olay::Vardi,
          Olay::Cagir(15),
          Olay::Ariza,
          Olay::Cagir(2),
          Olay::Onarildi,
      ];
      let mut asansor = Asansor::Duruyor { kat: 0 };
      for olay in olaylar {
          asansor = asansor.isle(olay);
          println!("{asansor:?} (hareket: {})", asansor.hareket_halinde_mi());
      }
  }
check: tests
tests: |
  fn yaz(a: &Asansor) -> String {
      format!("{a:?}")
  }

  #[test]
  fn cagrilan_kata_gider_ve_varir() {
      let a = Asansor::Duruyor { kat: 0 }.isle(Olay::Cagir(5));
      assert_eq!(yaz(&a), "Gidiyor { hedef: 5 }", "zemin kattan 5. kata çağrılınca yola çıkmalı");
      let a = a.isle(Olay::Vardi);
      assert_eq!(yaz(&a), "Duruyor { kat: 5 }", "varınca hedef katta durmalı");
  }

  #[test]
  fn ayni_kat_ve_gecersiz_kat_yok_sayilir() {
      let a = Asansor::Duruyor { kat: 3 }.isle(Olay::Cagir(3));
      assert_eq!(yaz(&a), "Duruyor { kat: 3 }", "bulunduğu kata çağrılınca hareket etmemeli");
      let a = Asansor::Duruyor { kat: 3 }.isle(Olay::Cagir(11));
      assert_eq!(yaz(&a), "Duruyor { kat: 3 }", "11. kat yok: EN_UST_KAT 10");
      let a = Asansor::Duruyor { kat: 3 }.isle(Olay::Cagir(10));
      assert_eq!(yaz(&a), "Gidiyor { hedef: 10 }", "10. kat en üst kat ve geçerli");
  }

  #[test]
  fn yolda_ve_dururken_anlamsiz_olaylar() {
      let a = Asansor::Gidiyor { hedef: 7 }.isle(Olay::Cagir(2));
      assert_eq!(yaz(&a), "Gidiyor { hedef: 7 }", "hareket hâlindeki asansör yeni çağrıyı yok saymalı");
      let a = Asansor::Duruyor { kat: 2 }.isle(Olay::Vardi);
      assert_eq!(yaz(&a), "Duruyor { kat: 2 }", "duran asansöre Vardi olayı bir şey yapmamalı");
      let a = Asansor::Duruyor { kat: 5 }.isle(Olay::Onarildi);
      assert_eq!(yaz(&a), "Duruyor { kat: 5 }", "arızalı olmayan asansörü onarmak katını değiştirmemeli");
  }

  #[test]
  fn ariza_ve_onarim() {
      assert_eq!(yaz(&Asansor::Gidiyor { hedef: 4 }.isle(Olay::Ariza)), "Bakimda", "giderken arıza: bakıma alınmalı");
      assert_eq!(yaz(&Asansor::Duruyor { kat: 1 }.isle(Olay::Ariza)), "Bakimda", "dururken arıza: bakıma alınmalı");
      assert_eq!(yaz(&Asansor::Bakimda.isle(Olay::Cagir(3))), "Bakimda", "bakımdaki asansör çağrılamaz");
      assert_eq!(yaz(&Asansor::Bakimda.isle(Olay::Onarildi)), "Duruyor { kat: 0 }", "onarılınca zemin katta beklemeli");
  }

  #[test]
  fn hareket_sorgusu() {
      assert!(Asansor::Gidiyor { hedef: 3 }.hareket_halinde_mi(), "Gidiyor durumunda true olmalı");
      assert!(!Asansor::Duruyor { kat: 3 }.hareket_halinde_mi(), "Duruyor durumunda false olmalı");
      assert!(!Asansor::Bakimda.hareket_halinde_mi(), "Bakimda durumunda false olmalı");
  }
hints:
  - "İskelet: `match (self, olay) { ... (durum, _) => durum }`. Her tablo satırı bir kol; \"başka her kombinasyon\" en sondaki `(durum, _) => durum`."
  - "Çağrı kolu iki değeri birden yakalar: `(Asansor::Duruyor { kat }, Olay::Cagir(hedef)) => { if hedef != kat && hedef <= EN_UST_KAT { ... } else { Asansor::Duruyor { kat } } }`."
  - "Arıza her durumda aynı sonucu verir: `(_, Olay::Ariza) => Asansor::Bakimda,`. Bu kolu `(durum, _) => durum`'dan **önce** yaz. Sorgu metodu tek satır: `matches!(self, Asansor::Gidiyor { .. })`."
require:
  - pattern: 'match\s*\(\s*self\s*,\s*olay\s*\)'
    message: "Durum ve olayı birlikte eşleştir: `match (self, olay) { ... }`."
  - pattern: 'matches!'
    message: "`hareket_halinde_mi`'yi `matches!` ile yaz."
explanation: |
  Durum makinesi tablosunun her satırı bir `match` kolu oldu. Önemli noktalar:

  - **Desen + koşul**: Çağrı kolunda desen iki sayıyı (`kat`, `hedef`) yakalıyor, `if` ise iş kuralını
    uyguluyor. Koşul sağlanmazsa `self` artık tuple'a taşınmış olduğu için durumu `Asansor::Duruyor { kat }`
    ile yeniden kuruyoruz.
  - **`EN_UST_KAT` bir sabit**: Desende bir sabitle karşılaştırma yapılabilir; burada ise bir `if`
    koşulunda kullandık. Sihirli `10` sayısı yerine adı olan bir sabit, kuralı kendi kendini anlatır kılıyor.
  - **Kol sırası**: `(_, Olay::Ariza)`, `(durum, _)`'dan önce gelmeli; aksi hâlde arıza olayları "durum
    aynen kalır" koluna düşerdi ve derleyici arıza koluna ulaşılamadığını söylerdi.
  - **`(Asansor::Bakimda, Olay::Ariza)`** de `(_, Olay::Ariza)` koluna düşer ve yine `Bakimda` üretir:
    sonuç aynı olduğu için ayrıca yazmaya gerek yok.

  `hareket_halinde_mi` gibi küçük `matches!` sorguları, durum makinesinin dışındaki kodun (ekrandaki
  ok işareti, kapı kilidi) durumun ayrıntılarını bilmeden karar vermesini sağlar.
````
