---
id: m11-boss
title: "Boss: Generic'ler ve Trait'ler"
minutes: 40
type: boss
---

Modülün sonuna geldin! Bu sınav generic fonksiyonlardan const generic'lere kadar bütün dersleri ve önceki
modüllerden birkaç konuyu bir arada soruyor. Geçmek için **%80** gerekiyor. Acele etme: Her kod parçasında
önce imzayı oku, sonra kendine sor: *“Bu gövde `T` hakkında neyi bilmeye hakkı var?”*

## Generic'ler

```compiles
code: |
  fn ayni_mi<T>(a: &T, b: &T) -> bool {
      a == b
  }

  fn main() {
      println!("{}", ayni_mi(&3, &3));
  }
answer: false
error: E0369
explanation: |
  Generic gövde **her olası `T` için** denetlenir. Sınırsız bir `T` için `==`'in tanımlı olduğu garanti
  değildir, bu yüzden `E0369` alınır. Çözüm: `fn ayni_mi<T: PartialEq>(a: &T, b: &T) -> bool`.
```

```predict
code: |
  struct Kutu<T> {
      icerik: T,
  }

  impl<T> Kutu<T> {
      fn ac(self) -> T {
          self.icerik
      }
  }

  impl Kutu<i32> {
      fn ikiye_katla(&self) -> i32 {
          self.icerik * 2
      }
  }

  fn main() {
      let a = Kutu { icerik: 21 };
      let b = Kutu { icerik: "hediye" };
      println!("{} {}", a.ikiye_katla(), b.ac());
      println!("{}", a.ac() + 1);
  }
options:
  - |
    42 hediye
    22
  - |
    42 hediye
    43
  - Derlenmez — `ikiye_katla` her `Kutu<T>` için tanımlı olmalı
  - Derlenmez — `a`, `ikiye_katla`'dan sonra kullanılamaz
answer: 0
explanation: |
  `ikiye_katla` yalnızca `Kutu<i32>` için var ve `a` tam olarak bir `Kutu<i32>`. `&self` aldığı için `a`'yı
  tüketmez; `icerik` değişmez, yalnızca `21 * 2 = 42` döner. `b.ac()` her `T` için olan metottur ve
  `"hediye"`'yi verir. Son satırda `a.ac()` `a`'yı tüketip `21` döndürür: `21 + 1 = 22`.
```

```quiz
question: |
  `fn goster<T: std::fmt::Debug>(x: T)` fonksiyonu bir programda şöyle çağrılıyor:
  `goster(1); goster(2.5); goster(7); goster("a"); goster(String::from("b"));`
  Monomorfizasyon sonunda `goster`'in kaç somut kopyası derlenir?
options:
  - "1 — generic fonksiyon tek bir kopya olarak derlenir, tip çalışma anında kontrol edilir"
  - "4"
  - "5 — her çağrı için bir kopya"
answer: 1
explanation: |
  Her **farklı somut tip** için bir kopya üretilir, her çağrı için değil: `i32` (1 ve 7), `f64`, `&str` ve
  `String`. Yani 4 kopya. Çalışma anında tip kontrolü yoktur; her kopya kendi tipine özel derlenir.
feedback:
  - "Rust tip silme (type erasure) yapmaz; Java'daki gibi tek bir kopya yoktur."
  - "Doğru! `goster(1)` ve `goster(7)` aynı `i32` kopyasını kullanır."
  - "Aynı tiple yapılan iki çağrı aynı kopyayı paylaşır."
```

```compiles
question: "(Modül 4 tekrarı) Derlenir mi?"
code: |
  fn kaydet<T: std::fmt::Debug>(deger: T) {
      println!("Kaydedildi: {deger:?}");
  }

  fn main() {
      let ad = String::from("Elif");
      kaydet(ad);
      kaydet(ad);
  }
answer: false
error: E0382
explanation: |
  `deger: T` parametresi değeri **sahiplenerek** alır. İlk çağrıda `ad` fonksiyona taşınır; `String`
  `Copy` olmadığı için ikinci çağrı taşınmış bir değeri kullanır. Generic'ler sahiplik kurallarını
  değiştirmez. Çözüm: `fn kaydet<T: Debug>(deger: &T)` ve `kaydet(&ad)`.
```

```exercise
id: m11-boss-e-tekrarsiz
title: Tekrarları ayıkla
difficulty: 3
prompt: |
  Bir yoklama uygulamasında aynı öğrencinin adı listeye birden çok kez yazılabiliyor. Generic bir
  `tekrarsiz` fonksiyonu yaz: dilimdeki elemanların **ilk geçtikleri sırayı koruyarak** tekrarsız bir
  kopyasını `Vec<T>` olarak döndürsün. Fonksiyon sayılarla, `&str`'lerle ve `String`'lerle çalışmalı.

  Başlangıç imzasında `T` için hiçbir sınır yok. Gövdeyi yazınca hangi sınırların gerektiğini derleyici
  söyleyecek.
starter: |
  fn tekrarsiz<T>(liste: &[T]) -> Vec<T> {
      todo!()
  }

  fn main() {
      let yoklama = ["Ece", "Can", "Ece", "Deniz", "Can"];
      println!("{:?}", tekrarsiz(&yoklama));
  }
solution: |
  fn tekrarsiz<T: PartialEq + Clone>(liste: &[T]) -> Vec<T> {
      let mut sonuc: Vec<T> = Vec::new();
      for oge in liste {
          if !sonuc.contains(oge) {
              sonuc.push(oge.clone());
          }
      }
      sonuc
  }

  fn main() {
      let yoklama = ["Ece", "Can", "Ece", "Deniz", "Can"];
      println!("{:?}", tekrarsiz(&yoklama));
  }
check: tests
tests: |
  #[test]
  fn isimlerde_ilk_sira_korunur() {
      let yoklama = ["Ece", "Can", "Ece", "Deniz", "Can"];
      assert_eq!(tekrarsiz(&yoklama), vec!["Ece", "Can", "Deniz"], "Her isim ilk geçtiği yerde bir kez kalmalı");
  }

  #[test]
  fn sayilarla_calisir() {
      assert_eq!(tekrarsiz(&[3, 1, 3, 3, 2, 1]), vec![3, 1, 2], "Sıralama değil, ilk görülme sırası korunmalı");
      assert_eq!(tekrarsiz(&[5, 5, 5]), vec![5], "Hepsi aynıysa tek eleman kalmalı");
  }

  #[test]
  fn string_ile_calisir() {
      let l = vec![String::from("çay"), String::from("simit"), String::from("çay")];
      assert_eq!(tekrarsiz(&l), vec![String::from("çay"), String::from("simit")], "String elemanlar klonlanarak kopyalanmalı");
      assert_eq!(l.len(), 3, "Orijinal liste değişmemeli");
  }

  #[test]
  fn bos_liste() {
      let bos: [i32; 0] = [];
      assert!(tekrarsiz(&bos).is_empty(), "Boş girdiden boş liste çıkmalı");
  }
hints:
  - "Boş bir `Vec` ile başla ve dilimi dolaş. Her eleman sonuçta **yoksa** ekle: `if !sonuc.contains(oge) { ... }`"
  - "Eleman dilimden ödünç alındığı için `push`'a vermeden önce kopyasını almalısın: `oge.clone()`. `contains` için de karşılaştırma gerekir."
  - "Gereken sınırlar: `T: PartialEq + Clone`. İmza: `fn tekrarsiz<T: PartialEq + Clone>(liste: &[T]) -> Vec<T>`"
explanation: |
  Gövde iki yetenek kullanıyor: `contains` (içeride `==`, yani `PartialEq`) ve `clone` (ödünç alınmış bir
  dilimden sahipli bir kopya üretmek için `Clone`). Sınırlarda tam olarak bu ikisi var, fazlası yok. Mesela
  `Ord` istemedik, o yüzden `f64` ile de çalışır.

  `contains` her seferinde sonucu baştan sona taradığı için bu çözüm O(n²)'dir. Büyük listelerde bir
  `HashSet` kullanmak (bu kez `T: Eq + Hash + Clone` gerekir) O(n)'e indirir (Modül 9). Seçtiğin algoritma,
  isteyeceğin trait sınırlarını da belirler.
```

## Trait'ler ve sınırlar

```predict
code: |
  trait Hayvan {
      fn ad(&self) -> String;

      fn ses(&self) -> String {
          String::from("...")
      }

      fn tanit(&self) -> String {
          format!("{} der ki: {}", self.ad(), self.ses())
      }
  }

  struct Kedi;
  struct Balik;

  impl Hayvan for Kedi {
      fn ad(&self) -> String {
          String::from("Tekir")
      }
      fn ses(&self) -> String {
          String::from("miyav")
      }
  }

  impl Hayvan for Balik {
      fn ad(&self) -> String {
          String::from("Nemo")
      }
  }

  fn main() {
      println!("{}", Kedi.tanit());
      println!("{}", Balik.tanit());
  }
options:
  - |
    Tekir der ki: miyav
    Nemo der ki: ...
  - |
    Tekir der ki: ...
    Nemo der ki: ...
  - Derlenmez — `Balik` `ses`'i uygulamıyor
answer: 0
explanation: |
  `tanit` varsayılan bir metot ve `self.ses()`'i çağırıyor. Çağrı, o anki tipin uygulamasına gider: `Kedi`
  `ses`'i ezdiği için `miyav`, `Balik` ezmediği için varsayılan `...` gelir. Varsayılanı olan bir metodu
  yazmamak tamamen geçerlidir; yalnızca gövdesiz (`ad` gibi) metotlar zorunludur.
```

```quiz
question: "`fn icerik_uret() -> impl Ozet` imzası için hangisi **doğrudur**?"
options:
  - "Çağıran, dönen değerin somut tipini (örneğin `Haber`) bilir ve alanlarına erişebilir"
  - "Fonksiyon, bir `if` ile bazen `Haber` bazen `Gonderi` döndürebilir"
  - "Fonksiyon tek bir gizli somut tip döndürür; çağıran onunla yalnızca `Ozet`'in metotlarını kullanabilir"
  - "Dönen değer her zaman heap'te saklanır"
answer: 2
explanation: |
  `-> impl Trait` somut tipi çağırandan **gizler** ama ortada tek bir somut tip vardır ve derleme zamanında
  bellidir. Farklı dallarda farklı tipler döndürmek `E0308` verir; bunun için enum ya da `Box<dyn Ozet>`
  (Modül 20) gerekir. Değerin nerede durduğu somut tipe bağlıdır: `impl Trait` kendi başına heap kullanmaz.
feedback:
  - "Somut tip gizlidir; çağıran yalnızca trait'in sözünü bilir."
  - "`impl Trait` tek bir somut tiptir; iki farklı tip `E0308` verir."
  - Doğru!
  - "Heap'e koyan `Box`'tır; `impl Trait` statik dağıtımdır ve değer olduğu gibi döner."
```

```compiles
code: |
  fn buyugunu_yaz<T>(a: T, b: T)
  where
      T: PartialOrd,
  {
      if a > b {
          println!("{a}");
      } else {
          println!("{b}");
      }
  }

  fn main() {
      buyugunu_yaz(3, 8);
  }
answer: false
error: E0277
explanation: |
  `i32` hem karşılaştırılabilir hem yazdırılabilir, ama bunun önemi yok: Gövde `T`'yi `{}` ile yazdırıyor
  ve `where` cümlesi yalnızca `PartialOrd` söz veriyor. Gövde, sınırlarda olmayan bir yeteneği kullanamaz.
  Çözüm: `T: PartialOrd + std::fmt::Display`.
```

## Standart trait'ler ve dönüşümler

```predict
code: |
  #[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
  enum Beden {
      S,
      M,
      L,
  }

  #[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
  struct Tisort {
      beden: Beden,
      renk: String,
  }

  fn main() {
      let mut raf = vec![
          Tisort { beden: Beden::L, renk: String::from("mavi") },
          Tisort { beden: Beden::S, renk: String::from("sarı") },
          Tisort { beden: Beden::L, renk: String::from("beyaz") },
          Tisort { beden: Beden::M, renk: String::from("ala") },
      ];
      raf.sort();
      for t in &raf {
          println!("{:?} {}", t.beden, t.renk);
      }
  }
options:
  - |
    S sarı
    M ala
    L beyaz
    L mavi
  - |
    M ala
    L beyaz
    L mavi
    S sarı
  - |
    S sarı
    M ala
    L mavi
    L beyaz
answer: 0
explanation: |
  Türetilmiş `Ord` alanları **tanım sırasıyla** karşılaştırır: önce `beden`, eşitse `renk`. Enum
  varyantlarının sırası da tanım sırasıdır: `S < M < L`. İki `L` arasında `renk` belirleyici olur ve
  `"beyaz" < "mavi"`. Alfabetik renk sırası (ikinci seçenek) ancak `renk` alanı önce tanımlansaydı
  geçerli olurdu. Üçüncü seçenek iki `L`'yi listedeki ilk sıralarında (mavi, beyaz) bırakıyor. Ama
  `sort`'un kararlılığı (*stable*) yalnızca **eşit** elemanların sırasını korur; bu iki tişört `renk`
  yüzünden eşit değildir, bu yüzden renge göre dizilirler.
```

```compiles
code: |
  use std::collections::HashMap;

  #[derive(Debug, PartialEq, Eq, Hash)]
  struct Ogrenci {
      no: u32,
      notlar: Vec<f64>,
  }

  fn main() {
      let mut kulupler = HashMap::new();
      kulupler.insert(Ogrenci { no: 7, notlar: vec![90.0, 85.5] }, "satranç");
      println!("{}", kulupler.len());
  }
answer: false
error: E0277
explanation: |
  `derive` her alanın o trait'i uygulamasını şart koşar ve bu kural iç içe tiplere de uzanır.
  `Vec<f64>`'ün `Eq` ve `Hash` olabilmesi için `f64`'ün de öyle olması gerekir; ama `f64` NaN yüzünden ne
  `Eq` ne `Hash`'tir. Bir öğrenciyi anahtar yapmak istiyorsan, anahtar olarak yalnızca `no` alanını kullan
  (`HashMap<u32, ...>`) ya da notları tam sayı olarak sakla.
```

```fill
prompt: |
  Boşlukları doldur: `Metre`'den `Santimetre`'ye bir dönüşüm tanımla, `Santimetre`'yi `{}` ile
  yazdırılabilir yap ve dönüşümü `Metre` tarafından çağır.
code: |
  use std::fmt;

  struct Metre(f64);
  struct Santimetre(f64);

  impl ___0<Metre> for Santimetre {
      fn from(m: Metre) -> Self {
          Santimetre(m.0 * 100.0)
      }
  }

  impl fmt::___1 for Santimetre {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          ___2(f, "{} cm", self.0)
      }
  }

  fn main() {
      let boy: Santimetre = Metre(1.75).___3();
      println!("{boy}");
  }
blanks:
  - ["From"]
  - ["Display"]
  - ["write!"]
  - ["into"]
output: "175 cm"
explanation: |
  `From` uygulanır, `Into` blanket impl sayesinde bedava gelir. Hedef tip `let boy: Santimetre`
  notasyonundan bilindiği için `.into()` çalışır. `Display`'in `fmt`'si `write!` ile `Formatter`'a yazar;
  `f64`'ün `Display`'i `175.0`'ı `175` olarak gösterir.
```

```predict
question: "(Modül 10 tekrarı) Program ne yazdırır?"
code: |
  use std::num::ParseIntError;

  #[derive(Debug)]
  enum Hata {
      Sayi(ParseIntError),
      Negatif,
  }

  impl From<ParseIntError> for Hata {
      fn from(e: ParseIntError) -> Self {
          Hata::Sayi(e)
      }
  }

  fn fark(a: &str, b: &str) -> Result<i32, Hata> {
      let x = a.parse::<i32>()?;
      let y = b.parse::<i32>()?;
      if x < y {
          return Err(Hata::Negatif);
      }
      Ok(x - y)
  }

  fn main() {
      println!("{:?}", fark("10", "4"));
      println!("{:?}", fark("4", "10"));
      match fark("on", "4") {
          Ok(_) => println!("tamam"),
          Err(Hata::Sayi(_)) => println!("sayı hatası"),
          Err(Hata::Negatif) => println!("negatif"),
      }
  }
options:
  - |
    Ok(6)
    Err(Negatif)
    sayı hatası
  - |
    Ok(6)
    Ok(-6)
    sayı hatası
  - |
    Ok(6)
    Err(Negatif)
    tamam
  - Derlenmez — `?` `ParseIntError`'ı `Hata`'ya çeviremez
answer: 0
explanation: |
  `impl From<ParseIntError> for Hata` sayesinde `?`, ayrıştırma hatalarını kendiliğinden `Hata::Sayi`'ya
  çevirir; bu yüzden program derlenir. `fark("4", "10")` negatif sonucu kendisi reddeder: `Err(Negatif)`.
  `"on"` bir sayı değildir; ilk `?` `Hata::Sayi(...)` ile erken döner ve `match` ikinci kolu seçer.
```

```exercise
id: m11-boss-e-fiyat
title: Fiyat etiketleri
difficulty: 4
prompt: |
  Bir market kasası fiyatları Türkçe biçimde, **virgülle** okuyor ve yazıyor: `"12,50"` → 12 lira 50 kuruş.
  Fiyat tipi içeride **kuruş** tutuyor. Üç iş var:

  1. **`FromStr for Fiyat`** (`type Err = String`):
     - Baştaki ve sondaki boşluklar yok sayılır.
     - Virgül varsa virgülden sonra **tam iki rakam** olmalı: `"12,50"` → 1250, `"0,05"` → 5.
       `"12,5"`, `"12,505"` ve `"12,+5"` hatadır.
     - Virgül yoksa tam lira: `"7"` → 700.
     - Sayı olmayan parçalar ya da boş metin hatadır.
     - Kuruş karşılığı `u32`'ye sığmayan fiyatlar (örneğin `"50000000"`) panik değil `Err` vermeli.
  2. **`Display for Fiyat`**: `1250` → `12,50 TL`, `5` → `0,05 TL`, `700` → `7,00 TL`.
  3. Testler fiyatları `<` ile karşılaştırıyor ve `sort()` ile sıralıyor: Gereken trait'leri **türet**.
starter: |
  use std::fmt;
  use std::str::FromStr;

  #[derive(Debug, PartialEq)]
  struct Fiyat {
      kurus: u32,
  }

  impl FromStr for Fiyat {
      type Err = String;

      fn from_str(s: &str) -> Result<Self, Self::Err> {
          todo!()
      }
  }

  impl fmt::Display for Fiyat {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      match "12,50".parse::<Fiyat>() {
          Ok(fiyat) => println!("Etiket: {fiyat}"),
          Err(e) => println!("Hata: {e}"),
      }
  }
solution: |
  use std::fmt;
  use std::str::FromStr;

  #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
  struct Fiyat {
      kurus: u32,
  }

  impl FromStr for Fiyat {
      type Err = String;

      fn from_str(s: &str) -> Result<Self, Self::Err> {
          let s = s.trim();
          let (lira, kurus) = match s.split_once(',') {
              Some((l, k)) => {
                  if k.len() != 2 || !k.chars().all(|c| c.is_ascii_digit()) {
                      return Err(format!("kuruş iki rakam olmalı: {s}"));
                  }
                  (l, k)
              }
              None => (s, "00"),
          };
          let lira = lira.parse::<u32>().map_err(|_| format!("geçersiz lira: {lira}"))?;
          let kurus = kurus.parse::<u32>().map_err(|_| format!("geçersiz kuruş: {kurus}"))?;
          let toplam = lira
              .checked_mul(100)
              .and_then(|l| l.checked_add(kurus))
              .ok_or_else(|| format!("fiyat çok büyük: {s}"))?;
          Ok(Fiyat { kurus: toplam })
      }
  }

  impl fmt::Display for Fiyat {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{},{:02} TL", self.kurus / 100, self.kurus % 100)
      }
  }

  fn main() {
      match "12,50".parse::<Fiyat>() {
          Ok(fiyat) => println!("Etiket: {fiyat}"),
          Err(e) => println!("Hata: {e}"),
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_fiyatlar_okunur() {
      assert_eq!("12,50".parse::<Fiyat>(), Ok(Fiyat { kurus: 1250 }), "12,50 → 1250 kuruş");
      assert_eq!("7".parse::<Fiyat>(), Ok(Fiyat { kurus: 700 }), "Virgülsüz değer tam liradır: 7 → 700 kuruş");
      assert_eq!(" 0,05 ".parse::<Fiyat>(), Ok(Fiyat { kurus: 5 }), "Boşluklar kırpılmalı; 0,05 → 5 kuruş");
  }

  #[test]
  fn hatali_metinler_reddedilir() {
      assert!("12,5".parse::<Fiyat>().is_err(), "Kuruş tek haneyse Err dönmeli");
      assert!("12,505".parse::<Fiyat>().is_err(), "Kuruş üç haneyse Err dönmeli");
      assert!("on iki".parse::<Fiyat>().is_err(), "Sayı olmayan metin Err olmalı");
      assert!("".parse::<Fiyat>().is_err(), "Boş metin Err olmalı");
      assert!("12,ab".parse::<Fiyat>().is_err(), "Kuruş sayı değilse Err dönmeli");
      assert!(
          "12,+5".parse::<Fiyat>().is_err(),
          "\"+5\" iki rakam değil: u32 ayrıştırması baştaki '+' işaretini kabul eder, rakamları kendin denetle"
      );
  }

  #[test]
  fn cok_buyuk_fiyat_panik_yapmaz() {
      assert_eq!("42949672,95".parse::<Fiyat>(), Ok(Fiyat { kurus: u32::MAX }), "u32'ye tam sığan en büyük fiyat kabul edilmeli");
      assert!("50000000".parse::<Fiyat>().is_err(), "50 milyon lira u32 kuruşa sığmaz: taşma yerine Err dönmeli");
      assert!("42949672,96".parse::<Fiyat>().is_err(), "u32::MAX'tan bir kuruş fazlası Err olmalı");
  }

  #[test]
  fn etiket_bicimi() {
      assert_eq!(Fiyat { kurus: 1250 }.to_string(), "12,50 TL");
      assert_eq!(Fiyat { kurus: 5 }.to_string(), "0,05 TL", "Kuruş iki haneye sıfırla tamamlanmalı");
      assert_eq!(Fiyat { kurus: 700 }.to_string(), "7,00 TL");
  }

  #[test]
  fn karsilastirma_ve_siralama() {
      let a: Fiyat = "9,99".parse().unwrap();
      let b: Fiyat = "10,00".parse().unwrap();
      assert!(a < b, "9,99 TL, 10,00 TL'den ucuzdur (metin olarak değil, sayı olarak karşılaştır)");
      let mut liste = vec![b, Fiyat { kurus: 150 }, a];
      liste.sort();
      assert_eq!(liste, vec![Fiyat { kurus: 150 }, a, b], "sort() fiyatları ucuzdan pahalıya dizmeli");
  }
hints:
  - "Türetme satırı: `#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]`. `sort` `Ord` ister; `Ord` de `Eq` ve `PartialOrd` ister. Testte `a`'yı listeye koyup sonra yeniden kullanmak için `Copy` de gerekir."
  - "`from_str`: önce `let s = s.trim();`, sonra `match s.split_once(',')`. `Some((l, k))` kolunda `k.len() != 2` ise ya da `k.chars()` üzerinde dönen bir `for` döngüsünde `is_ascii_digit()` olmayan bir karakter çıkarsa hata döndür; `None` kolunda kuruş kısmı `\"00\"` olsun. (Kısa yol: `k.chars().all(|c| c.is_ascii_digit())` her karakter koşulu sağlıyorsa `true` döner; `all`'ı Modül 14'te iterator'larla ayrıntılı göreceksin.)"
  - "İki parçayı `parse::<u32>()` ile çevirip `map_err(|_| ...)?` ile hata mesajına dönüştür. `lira * 100 + kurus` taşabilir: Modül 2'deki `checked_mul(100)` ve `checked_add(kurus)` `Option` döndürür, `ok_or_else(...)?` ile hataya çevir. `Display` için `write!(f, \"{},{:02} TL\", self.kurus / 100, self.kurus % 100)`."
explanation: |
  Tek bir tip, modülün dört dersini bir araya getirdi: `derive` ile karşılaştırma ve sıralama (5. ders),
  `Display` ile kullanıcıya gösterim (6. ders), `FromStr` ile metinden doğrulanmış değer üretme (7. ders)
  ve hepsinin altında Modül 10'un `?` + `map_err` ikilisi.

  Türetilmiş `Ord` tek alan olan `kurus`'u karşılaştırır. Bu yüzden `9,99 < 10,00` doğru çıkar; metin
  olarak karşılaştırsaydık `"9,99" > "10,00"` olurdu, çünkü `'9' > '1'`. Para için tam sayı kuruş kullanmak
  hem yuvarlama hatalarını hem de bu tür sıralama hatalarını önler.

  `u32` eksi işaretini kabul etmediği için `"-5"` gibi negatif fiyatlar da `parse` aşamasında kendiliğinden
  reddedilir. Ama **artı** işaretini kabul eder: `"+5".parse::<u32>()` `Ok(5)` verir. Uzunluk kontrolü tek
  başına `"12,+5"`'i 12,05 TL diye geçirirdi; bu yüzden kuruşun iki **rakam** olduğunu ayrıca denetledik.
  (Lira kısmındaki `"+12"` zararsız olduğu için kabul ediliyor.) Çözümdeki `k.chars().all(...)`, “her karakter
  rakam mı?” diye soran bir `for` döngüsünün kısa yazımıdır.

  Son tuzak taşma: `lira * 100 + kurus` 42 949 672,95 TL'nin üstünde `u32`'yi aşar. Debug derlemede
  panik, release derlemede sessizce yanlış fiyat demektir (Modül 2). `checked_mul` / `checked_add`
  taşmayı `None` olarak bildirir, `ok_or_else` onu bir hata mesajına çevirir. Gerçek bir kasada
  tutarları `u64` ile tutmak da iyi bir fikirdir.
```

## Trait kuralları ve karma tekrar

```quiz
question: "Senin crate'inde `struct Puan(u32);` tanımlı. Aşağıdaki impl'lerden hangisi **derlenmez**?"
options:
  - "`impl fmt::Display for Puan { ... }`"
  - "`impl From<Puan> for u32 { ... }`"
  - "`impl fmt::Display for Vec<Puan> { ... }`"
  - "`impl Default for Puan { ... }`"
answer: 2
explanation: |
  Orphan rule: trait ya da tip senin crate'inde tanımlı olmalı. `Display` ve `Vec` ikisi de standart
  kütüphaneden; içine `Puan` koymak `Vec<Puan>`'ı yerel yapmaz (`E0117`). Çözüm bir newtype:
  `struct PuanListesi(Vec<Puan>);`. `From<Puan> for u32` ise yazılabilir, çünkü trait'in tip parametresinde
  yerel tipin var; başka hiçbir crate bu impl'i yazamaz.
feedback:
  - "Tip senin; yabancı bir trait'i uygulayabilirsin."
  - "Trait'in parametresindeki yerel tip (`Puan`) bu impl'i sana ait kılar."
  - "Doğru! Yabancı trait + yabancı tip → `E0117`."
  - "Tip senin; `Default` gibi standart bir trait'i uygulayabilirsin."
```

```predict
code: |
  use std::fmt::Display;

  trait Etiket {
      fn etiket(&self) -> String;
  }

  impl<T: Display> Etiket for T {
      fn etiket(&self) -> String {
          format!("<{self}>")
      }
  }

  fn kutula<const N: usize>(degerler: [i32; N]) -> String {
      let mut s = String::new();
      for d in degerler {
          s.push_str(&d.etiket());
      }
      format!("{N}:{s}")
  }

  fn main() {
      println!("{}", kutula([1, 2, 3]));
      println!("{}", kutula([]));
      println!("{}", 'x'.etiket());
  }
options:
  - |
    3:<1><2><3>
    0:
    <x>
  - |
    3:<1><2><3>
    0:
    x
  - Derlenmez — `kutula([])` çağrısında `N` çıkarılamaz
  - Derlenmez — blanket impl `char`'ı kapsamaz, `etiket` yalnızca `i32` için var
answer: 0
explanation: |
  `impl<T: Display> Etiket for T` bir **blanket impl**: `Display` uygulayan her tip, `i32` de `char` da,
  `etiket` metodunu kazanır. Bu yüzden `'x'.etiket()` de `<x>` döndürür. `kutula`'da `N` dizinin
  uzunluğundan çıkarılır: `[1, 2, 3]` için `N = 3`, `[]` için `N = 0`. Elemanın tipi zaten imzada
  (`[i32; N]`) yazılı olduğundan boş dizi de belirsiz değildir. `N` gövdede sıradan bir değer gibi
  `{N}` ile yazdırılabilir; boş dizide döngü hiç dönmez ve geriye yalnızca `0:` kalır.
```

```predict
question: "(Modül 9 tekrarı) Program ne yazdırır?"
code: |
  use std::collections::HashMap;

  #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
  enum Renk {
      Kirmizi,
      Yesil,
      Mavi,
  }

  fn main() {
      let oylar = [Renk::Mavi, Renk::Kirmizi, Renk::Mavi, Renk::Yesil, Renk::Mavi];
      let mut sayim = HashMap::new();
      for r in oylar {
          *sayim.entry(r).or_insert(0) += 1;
      }
      println!("{} renk", sayim.len());
      println!("{:?} {:?}", sayim.get(&Renk::Mavi), sayim.get(&Renk::Yesil));
  }
options:
  - |
    3 renk
    Some(3) Some(1)
  - |
    5 renk
    Some(3) Some(1)
  - |
    3 renk
    3 1
  - Derlenmez — enum'lar `HashMap` anahtarı olamaz
answer: 0
explanation: |
  `Eq` ve `Hash` türetildiği için `Renk` bir `HashMap` anahtarı olabilir. `entry(r).or_insert(0)` anahtar
  yoksa 0 ekler ve değere bir `&mut` verir, `+= 1` onu artırır (Modül 9). Beş oyda üç farklı renk var.
  `get` bir `Option<&V>` döndürür; `{:?}` ile `Some(3)` olarak yazılır.
```

```exercise
id: m11-boss-e-kargo
title: Kitap kargosu
difficulty: 4
prompt: |
  Bir sahaf, kitapları kargoyla gönderiyor. Kargo generic: içinde ağırlığı ölçülebilen her türlü paket
  olabilir. `Agirlikli` trait'i, `Kitap` tipi ve `Kargo<T>`'nin temel metotları (`yeni`, `ekle`) hazır.

  **1) `impl<T: Agirlikli> Kargo<T>` bloğundaki üç metodu yaz:**
  - `toplam_gram`: bütün paketlerin ağırlık toplamı.
  - `en_agir`: en ağır pakete referans; kargo boşsa `None`, eşitlikte **ilk eklenen**.
  - `ucret` (kuruş): **her başlayan 1000 gram için 2500 kuruş**. 1-1000 g → 2500, 1001-2000 g → 5000.
    Boş kargo 0.

  **2) `impl<T: fmt::Display> fmt::Display for Kargo<T>`**: paketler `T`'nin kendi `Display`'iyle,
  aralarına `, ` konarak yazılır:
  - Boş: `Kargo (boş)`
  - Dolu: `Kargo (2 paket): Nutuk, Tutunamayanlar`

  Testler, `Display` uygulamayan ama `Agirlikli` olan başka bir paket tipiyle de deneyecek. Bu yüzden iki
  impl bloğunun sınırlarını birbirine karıştırma.
starter: |
  use std::fmt;

  trait Agirlikli {
      fn gram(&self) -> u32;
  }

  struct Kitap {
      baslik: String,
      sayfa: u32,
  }

  impl Agirlikli for Kitap {
      fn gram(&self) -> u32 {
          self.sayfa * 2
      }
  }

  impl fmt::Display for Kitap {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}", self.baslik)
      }
  }

  struct Kargo<T> {
      paketler: Vec<T>,
  }

  impl<T> Kargo<T> {
      fn yeni() -> Self {
          Kargo { paketler: Vec::new() }
      }

      fn ekle(&mut self, paket: T) {
          self.paketler.push(paket);
      }
  }

  impl<T: Agirlikli> Kargo<T> {
      fn toplam_gram(&self) -> u32 {
          todo!()
      }

      fn en_agir(&self) -> Option<&T> {
          todo!()
      }

      fn ucret(&self) -> u32 {
          todo!()
      }
  }

  impl<T: fmt::Display> fmt::Display for Kargo<T> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      let mut kargo = Kargo::yeni();
      kargo.ekle(Kitap { baslik: String::from("Nutuk"), sayfa: 600 });
      kargo.ekle(Kitap { baslik: String::from("Tutunamayanlar"), sayfa: 724 });
      println!("{kargo}");
  }
solution: |
  use std::fmt;

  trait Agirlikli {
      fn gram(&self) -> u32;
  }

  struct Kitap {
      baslik: String,
      sayfa: u32,
  }

  impl Agirlikli for Kitap {
      fn gram(&self) -> u32 {
          self.sayfa * 2
      }
  }

  impl fmt::Display for Kitap {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}", self.baslik)
      }
  }

  struct Kargo<T> {
      paketler: Vec<T>,
  }

  impl<T> Kargo<T> {
      fn yeni() -> Self {
          Kargo { paketler: Vec::new() }
      }

      fn ekle(&mut self, paket: T) {
          self.paketler.push(paket);
      }
  }

  impl<T: Agirlikli> Kargo<T> {
      fn toplam_gram(&self) -> u32 {
          let mut toplam = 0;
          for p in &self.paketler {
              toplam += p.gram();
          }
          toplam
      }

      fn en_agir(&self) -> Option<&T> {
          if self.paketler.is_empty() {
              return None;
          }
          let mut aday = &self.paketler[0];
          for p in &self.paketler {
              if p.gram() > aday.gram() {
                  aday = p;
              }
          }
          Some(aday)
      }

      fn ucret(&self) -> u32 {
          self.toplam_gram().div_ceil(1000) * 2500
      }
  }

  impl<T: fmt::Display> fmt::Display for Kargo<T> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          if self.paketler.is_empty() {
              return write!(f, "Kargo (boş)");
          }
          write!(f, "Kargo ({} paket): ", self.paketler.len())?;
          for (i, p) in self.paketler.iter().enumerate() {
              if i > 0 {
                  write!(f, ", ")?;
              }
              write!(f, "{p}")?;
          }
          Ok(())
      }
  }

  fn main() {
      let mut kargo = Kargo::yeni();
      kargo.ekle(Kitap { baslik: String::from("Nutuk"), sayfa: 600 });
      kargo.ekle(Kitap { baslik: String::from("Tutunamayanlar"), sayfa: 724 });
      println!("{kargo}");
      println!("{} g, {} kuruş", kargo.toplam_gram(), kargo.ucret());
      if let Some(k) = kargo.en_agir() {
          println!("En ağır: {k}");
      }
  }
check: tests
tests: |
  fn kitap(baslik: &str, sayfa: u32) -> Kitap {
      Kitap { baslik: baslik.to_string(), sayfa }
  }

  struct Koli(u32);

  impl Agirlikli for Koli {
      fn gram(&self) -> u32 {
          self.0
      }
  }

  #[test]
  fn kitaplarin_agirligi_ve_ucreti() {
      let mut k = Kargo::yeni();
      k.ekle(kitap("Nutuk", 600));
      k.ekle(kitap("Tutunamayanlar", 724));
      assert_eq!(k.toplam_gram(), 2648, "600×2 + 724×2 = 2648 gram");
      assert_eq!(k.ucret(), 7500, "2648 g üç başlayan kilogramdır: 3 × 2500 = 7500 kuruş");
      assert_eq!(k.en_agir().map(|p| p.sayfa), Some(724), "En ağır kitap 724 sayfalık olmalı");
  }

  #[test]
  fn ucret_sinirlari() {
      let mut k = Kargo::yeni();
      assert_eq!(k.ucret(), 0, "Boş kargonun ücreti 0 olmalı");
      k.ekle(Koli(1000));
      assert_eq!(k.ucret(), 2500, "Tam 1000 g tek kilogramdır");
      k.ekle(Koli(1));
      assert_eq!(k.ucret(), 5000, "1001 g iki başlayan kilogramdır");
  }

  #[test]
  fn display_olmayan_paketlerle_de_calisir() {
      let mut k = Kargo::yeni();
      k.ekle(Koli(300));
      k.ekle(Koli(900));
      k.ekle(Koli(900));
      assert_eq!(k.toplam_gram(), 2100, "Koli tipi Display uygulamasa da ağırlık metotları çalışmalı");
      let en_agir = k.en_agir().expect("dolu kargoda en ağır paket olmalı");
      // std::ptr::eq: iki referans aynı bellek adresini mi gösteriyor? (iki 900 g'lık koliyi ayırt etmek için)
      assert!(std::ptr::eq(en_agir, &k.paketler[1]), "Eşitlikte ilk eklenen (ikinci koli) seçilmeli");
      let bos: Kargo<Koli> = Kargo::yeni();
      assert!(bos.en_agir().is_none(), "Boş kargoda en ağır paket yok");
  }

  #[test]
  fn kargo_yazdirma() {
      let mut k = Kargo::yeni();
      assert_eq!(k.to_string(), "Kargo (boş)", "Boş kargo için özel metin");
      k.ekle(kitap("Nutuk", 600));
      assert_eq!(k.to_string(), "Kargo (1 paket): Nutuk");
      k.ekle(kitap("Tutunamayanlar", 724));
      k.ekle(kitap("Kuyucaklı Yusuf", 250));
      assert_eq!(k.to_string(), "Kargo (3 paket): Nutuk, Tutunamayanlar, Kuyucaklı Yusuf", "Paketler \", \" ile ayrılmalı");
  }
hints:
  - "`toplam_gram` ve `en_agir`, 4. dersteki `toplam_puan` ve `en_iyi`'nin aynısı; yalnızca dilim yerine `self.paketler` üzerinde dolaşıyorsun ve `puan()` yerine `gram()` çağırıyorsun."
  - "`ucret` için “yukarı yuvarlayan” tam sayı bölmesi gerekir: `gram.div_ceil(1000)` başlayan kilogram sayısını verir (1001 → 2); onu 2500 ile çarp."
  - "`Display`: Boşsa `return write!(f, \"Kargo (boş)\");`. Değilse önce `write!(f, \"Kargo ({} paket): \", ...)?;`, sonra her paketi yaz; ilk paketten önce `, ` koyma. Her `write!`'tan sonra `?`, en sonda `Ok(())`."
explanation: |
  Bu alıştırmanın asıl dersi iki **ayrı** sınır: Ağırlık metotları yalnızca `T: Agirlikli`, yazdırma
  yalnızca `T: Display` istiyor. Testlerdeki `Koli` `Display` uygulamıyor ama ağırlık metotlarını
  kullanabildi. Tersine, `Display` uygulayan ama ağırlığı olmayan bir tiple de kargo yazdırılabilir.
  Sınırları tek bir `impl<T: Agirlikli + Display>` bloğunda birleştirseydin `Koli` testleri derlenmezdi.

  `impl<T: fmt::Display> fmt::Display for Kargo<T>`, 4. dersteki koşullu metotların **trait** sürümüdür:
  `Kargo<Kitap>` `Display`'dir, `Kargo<Koli>` değildir. Standart kütüphane de böyle çalışır: `Vec<T>`
  ancak `T: Debug` ise `Debug`'dır.

  `div_ceil` (Rust 1.73'ten beri) yukarı yuvarlayan tam sayı bölmesidir. Eski kodlarda aynı işi yapan
  klasik hileyi görürsün: `(gram + 999) / 1000`. O da doğru sonuç verir, ama `gram` `u32::MAX`'a çok
  yakınsa `+ 999` taşar; Clippy de bu kalıbı görünce `div_ceil` önerir (`manual_div_ceil`). İkisi de `f64`
  ile `ceil` kullanmaktan hem daha hızlı hem de yuvarlama hatalarından uzaktır.
```
