---
id: m12-boss
title: "Boss: Yaşam Süreleri Ustalık Sınavı"
minutes: 40
type: boss
objectives:
  - Bir referansın neden ve ne zaman geçersiz kaldığını borrow checker'ın gözüyle açıklayabilmek
  - Fonksiyon, struct ve metot imzalarına doğru yaşam süresi anotasyonlarını yazıp gereksiz olanları elision'a bırakabilmek
keywords: [lifetime, "'a", "'static", elision, E0597, E0106, E0515, E0621, "T: 'static", borrow checker]
---

Modülün son sınavına hoş geldin! Burada yeni bir şey öğretilmeyecek. Bu bölüm, ilk `'a`'dan `'static`'e
ve iki yaşam süreli imzalara kadar öğrendiklerini **kendi başına** kullanıp kullanamadığını ölçüyor.
Araya önceki modüllerden (ödünç alma kuralları, UTF-8 baytları, `Option` ve trait sınırları) birkaç soru
da karıştırdık.

Geçmek için puanların en az **%80**'ini toplaman gerekiyor. Acele etme. Her kod parçasında iki soru sor:
*"Bu referans kimin verisine bakıyor?"* ve *"O veri, referansın son kullanımına kadar yaşıyor mu?"*

## 1. Tur: Referanslar ve fonksiyon imzaları

```compiles
code: |
  fn main() {
      let mut kisaltmalar: Vec<&str> = Vec::new();
      for ad in ["Isparta", "Burdur", "Antalya"] {
          let buyuk = ad.to_uppercase();
          kisaltmalar.push(&buyuk[..3]);
      }
      println!("{kisaltmalar:?}");
  }
answer: false
error: E0597
explanation: |
  `buyuk` döngü gövdesinde doğan bir `String`'dir ve her turun sonunda düşürülür. `&buyuk[..3]` ise o
  `String`'in heap tamponuna bakan bir dilimdir. Vektör döngüden sonra da yaşadığı ve `println!`'de
  kullanıldığı için, içindeki dilimlerin de o ana kadar geçerli kalması gerekir. Veri ise çoktan
  gitmiştir: **E0597**, `buyuk` yeterince uzun yaşamıyor. Döngüde doğan, döngüde ölür (Ders 1).

  Çözüm, sahipli veriyi saklamaktır. Vektörü `Vec<String>` yapıp `buyuk[..3].to_string()` eklersen her
  kısaltma kendi baytlarına sahip olur.
```

````quiz
question: |
  ```rust
  fn main() {
      let mut puanlar = vec![70, 85];
      let ilk = &puanlar[0];
      println!("ilk: {ilk}");
      puanlar.push(90);
      println!("{} {}", puanlar.len(), puanlar[2]);
  }
  ```
  Bu program için hangisi doğrudur?
options:
  - "Derlenmez: `ilk` hâlâ `puanlar`'ı ödünç alırken `push` çağrılıyor (E0502)"
  - "Derlenir ve önce `ilk: 70`, sonra `3 90` yazdırır"
  - "Derlenir ama `push` sonrasında `ilk` eski belleği gösterdiği için çalışırken çöker"
  - "Derlenmez: Bir vektörden referans alındıktan sonra o vektör bir daha hiç değiştirilemez"
answer: 1
explanation: |
  Modül 5'teki kural hâlâ geçerli: Bir `&mut` ile bir `&` **aynı anda yaşayamaz**. Ama "yaşamak",
  değişkenin kapsamı değil, referansın **son kullanımına kadar** demektir (NLL). `ilk`'in son kullanımı
  ilk `println!`'dir. `push` geldiğinde paylaşılan ödünç çoktan bitmiştir, bu yüzden çakışma yoktur.

  `println!("{ilk}")` satırını `push`'tan sonraya taşısaydın **E0502** alırdın. O zaman `push`
  vektörü yeni bir heap bloğuna taşıyıp `ilk`'i boşlukta bırakabilirdi. Derleyici bunu tam olarak bu
  yüzden engeller. Rust'ta "çalışırken çöken sarkan referans" diye bir seçenek yoktur.
feedback:
  - "`ilk`'in son kullanımı `push`'tan önce. NLL sayesinde ödünç orada biter."
  - "Doğru!"
  - "Güvenli Rust'ta sarkan referans çalışma zamanına ulaşamaz. Ya derleyici engeller ya da kod güvenlidir."
  - "Değiştirme yasağı yalnızca referans **kullanılmaya devam ettiği sürece** geçerli."
````

```compiles
code: |
  fn sec<'a>(a: &'a str, b: &str, ilki: bool) -> &'a str {
      if ilki { a } else { b }
  }

  fn main() {
      let x = String::from("sol");
      let y = String::from("sağ");
      println!("{}", sec(&x, &y, false));
  }
answer: false
error: E0621
explanation: |
  İmza, dönüş değerinin yalnızca `a` kadar yaşadığını söylüyor. `b`'nin ise kendi, isimsiz bir yaşam
  süresi var. Gövde bazen `b`'yi döndürdüğü için derleyici şunu fark eder: `b`'nin `'a` kadar yaşayacağının
  hiçbir garantisi yok. Hata **E0621**: "`b`'nin tipinde açık yaşam süresi gerekli".

  Derleyici bu kararı yalnızca imzaya bakarak verir. `main`'deki iki `String`'in aynı süre yaşaması bir
  şey değiştirmez. Çözüm, `b: &'a str` yazmaktır. Böylece imza "sonuç, ikisinden **kısa** olanı kadar
  geçerli" sözünü verir (Ders 2).
```

```predict
code: |
  fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
      if x.len() >= y.len() { x } else { y }
  }

  fn main() {
      let sehir = String::from("Çeşme");
      let sonuc;
      {
          let diger = String::from("Ankara");
          sonuc = en_uzun(&sehir, &diger);
          println!("{sonuc} {}", sonuc.len());
      }
  }
options:
  - "Çeşme 7"
  - "Çeşme 5"
  - "Ankara 6"
  - "Ankara 7"
answer: 0
explanation: |
  İki tuzak var. Birincisi `len()`: O, karakter değil **bayt** sayar (Modül 9). `"Çeşme"`'de `Ç` ve `ş`
  ikişer bayttır: 2 + 1 + 2 + 1 + 1 = **7**. `"Ankara"` ise 6 bayttır. Bu yüzden `en_uzun` `"Çeşme"`'yi
  seçer, oysa karakterle sayınca 5 < 6'dır.

  İkincisi yaşam süreleri: `sonuc` dış kapsamda bildirildi ama yalnızca iç kapsamda, `diger` hâlâ
  yaşarken **kullanılıyor**. `'a` iki argümanın kesişimine, yani iç bloğa kadar uzanır ve bu yeterlidir.
  `println!` satırını bloğun dışına taşısaydın **E0597** alırdın. Gerçekte `sehir` döndürülüyor olsa
  bile, derleyici yalnızca imzaya güvenir.
```

## 2. Tur: Referans tutan structlar ve elision

```compiles
code: |
  struct Baslik<'a> {
      metin: &'a str,
  }

  fn baslik_yap(ad: &str) -> Baslik<'_> {
      let buyuk = ad.to_uppercase();
      Baslik { metin: &buyuk }
  }

  fn main() {
      let b = baslik_yap("yaşam süreleri");
      println!("{}", b.metin);
  }
answer: false
error: E0515
explanation: |
  `Baslik<'_>`, elision ile `ad`'ın yaşam süresine bağlanır. Yani imza "döndürdüğüm başlık, sana
  verdiğin metne bakıyor" der. Gövde ise fonksiyonun **kendi yerel** `String`'ine bakan bir başlık
  döndürmeye çalışıyor. `buyuk` fonksiyon bitince düşürülür. Hata **E0515**: Yerel bir değişkene referans
  içeren bir değer döndürülemez.

  Bir struct referans tutuyorsa, o referansın baktığı veri struct'ın **dışında** ve daha uzun yaşamalıdır
  (Ders 3). Yeni üretilen bir metni döndürmek istiyorsan alan sahipli olmalı: `metin: String`.
```

```predict
code: |
  struct Satir<'a> {
      metin: &'a str,
  }

  impl<'a> Satir<'a> {
      fn ilk_kelime(&self) -> &'a str {
          self.metin.split(' ').next().unwrap_or("")
      }
  }

  fn main() {
      let kayit = String::from("Kaşık çatal bıçak");
      let kelime;
      {
          let satir = Satir { metin: &kayit };
          kelime = satir.ilk_kelime();
      }
      println!("{kelime} {}", kelime.chars().count());
  }
options:
  - "Kaşık 5"
  - "Kaşık 7"
  - "çatal 5"
  - "Kaşık çatal bıçak 17"
answer: 0
explanation: |
  Kritik nokta dönüş tipi: `&'a str`, yani sonuç `satir`'a değil, `satir`'ın baktığı **metne** (`kayit`)
  bağlı. Bu yüzden `satir` iç blokta düşürülse de `kelime` geçerli kalır. Dönüş tipi elision'a bırakılıp
  `&str` yazılsaydı, Kural 3 sonucu `&self`'e bağlardı ve `println!` satırında **E0597** alırdın (Ders 3).

  `split(' ')` ilk boşluğa kadar olan dilimi verir: `"Kaşık"`. `chars().count()` karakter sayar: 5.
  `len()` deseydik `ş` ve `ı` ikişer bayt olduğu için 7 olurdu.
```

```quiz
question: Aşağıdaki imzalardan hangisi yaşam süresi anotasyonu yazılmadığı için **E0106** verir?
options:
  - "`fn ilk_satir(metin: &str) -> &str`"
  - "`fn en_kisa(kelimeler: &[&str]) -> &str`"
  - "`fn bul(&self, anahtar: &str) -> Option<&str>` (bir `impl` bloğunda)"
  - "`fn ortak_uzunluk(a: &str, b: &str) -> usize`"
answer: 1
explanation: |
  Kural 1, **her** isimsiz referansa ayrı bir ad verir. `&[&str]` içinde iki referans var: dilimin
  kendisi ve içindeki her `&str`. Yani `en_kisa` iki girdi yaşam süresine sahip ve `self` yok. Kural 2
  de Kural 3 de uygulanamaz: E0106. Döndürülen `&str` büyük olasılıkla içteki metinlerden biri olduğu
  için doğru imza şöyle olur: `fn en_kisa<'a>(kelimeler: &[&'a str]) -> &'a str` (Ders 4 ve 6).

  `ilk_satir` tek girdi yaşam süresiyle Kural 2'ye, `bul` ise `&self` ile Kural 3'e uyar. `ortak_uzunluk`
  hiç referans döndürmez. Çıktıda isimsiz yaşam süresi olmadığı için kurallara hiç gerek kalmaz.
feedback:
  - "Tek girdi referansı var: Kural 2 çıktıya onu verir."
  - "Doğru!"
  - "`&self` var: Kural 3 çıktıyı `self`'e bağlar."
  - "Çıktı bir referans değil. Elision'ın çözmesi gereken bir şey yok."
```

```parsons
prompt: "Satırları sıraya koyarak, son kelimesi kendisinden (struct'tan) **daha uzun yaşayabilen** bir `Cumle` tipi kur. Dikkat: Aralarında yanlış satırlar var."
lines: |
  struct Cumle<'a> {
      metin: &'a str,
  }
  impl<'a> Cumle<'a> {
      fn son_kelime(&self) -> &'a str {
          self.metin.split_whitespace().last().unwrap_or("")
      }
  }
distractors: |
  struct Cumle {
  impl Cumle {
      fn son_kelime(&self) -> &str {
explanation: |
  Referans tutan bir struct, yaşam süresi parametresini hem tanımda (`struct Cumle<'a>`) hem de `impl`
  başlığında (`impl<'a> Cumle<'a>`) taşımalıdır. Parametresiz `struct Cumle` alanda E0106 verir.
  `impl Cumle` ise eksik parametre yüzünden derlenmez.

  `-> &str` yazılan metot da derlenirdi ama Kural 3 yüzünden sonucu `&self`'e bağlardı. O zaman son kelime,
  `Cumle` değeri düşürülünce kullanılamaz olurdu. `&'a str` ise sonucu doğrudan metne bağlar (Ders 3).
```

## 3. Tur: 'static, sınırlar ve ustalık

```quiz
question: "`fn kayda_gec<T: std::fmt::Debug + 'static>(deger: T)` imzasındaki `T: 'static` sınırı ne anlama gelir?"
options:
  - "`deger` programın sonuna kadar bellekte kalmak zorundadır"
  - "`T`, `'static` olmayan hiçbir referans içermez. `String`, `i32`, `Vec<u8>` gibi sahipli tipler bu sınırı sağlar"
  - "`T` yalnızca `&'static str` gibi `'static` referans tipleri olabilir"
  - "`deger` derleme zamanında bilinen bir sabit olmalıdır"
answer: 1
explanation: |
  `T: 'static` bir **değer** hakkında değil, bir **tip** hakkında konuşur: "Bu tipin içinde, ne kadar
  tutulursa tutulsun geçersizleşebilecek bir ödünç yok." Sahipli bir `String` istediğin kadar
  saklanabilir, çünkü baktığı veri ona aittir. Bu yüzden `T: 'static` sınırını sağlar. Değer ise
  fonksiyon bitince yine normal şekilde düşürülebilir (Ders 5).

  `&'static T` ile karıştırma: O, verinin gerçekten program boyunca yaşadığı bir **referanstır**.
  `T: 'static` ise hem `&'static str`'yi hem de bütün sahipli tipleri kabul eder. Reddettiği şey,
  `&yerel_degisken` gibi kısa ömürlü bir ödünç taşıyan tiplerdir.
feedback:
  - "Değerin kendisi fonksiyonun sonunda düşürülebilir. Sınır, tipin içindeki ödünçlerle ilgili."
  - "Doğru!"
  - "Sahipli tipler de `T: 'static` sınırını sağlar. Hatta en sık kullanılanlar onlardır."
  - "`const` ile karıştırma. Sınır, çalışma anında üretilmiş bir `String`'i de kabul eder."
```

```compiles
code: |
  use std::fmt::Debug;

  fn gunluge_yaz<T: Debug + 'static>(deger: T) -> String {
      format!("[günlük] {deger:?}")
  }

  fn main() {
      let ad = String::from("Defne");
      let satirlar = [
          gunluge_yaz(ad),
          gunluge_yaz((String::from("puan"), 17)),
          gunluge_yaz("merhaba"),
      ];
      for s in &satirlar {
          println!("{s}");
      }
  }
answer: true
explanation: |
  Üç çağrı da `T: 'static` sınırını sağlıyor. `ad` bir `String` olarak **taşınıyor**, dolayısıyla tip
  hiçbir ödünç içermiyor. `(String, i32)` demeti de tamamen sahipli. `"merhaba"` bir `&'static str`.
  İçindeki tek referans zaten program boyunca yaşıyor.

  Derlenmeyen bir sürüm şöyle olurdu: `gunluge_yaz(&ad)`. Orada `T = &String` olur ve `ad` `main`'in
  yerel değişkeni olduğu için `'static` değildir: **E0597**, "argüman, `ad`'ın `'static` süre boyunca
  ödünç alınmasını gerektiriyor" (Ders 5).
```

```compiles
code: |
  fn ilk_uygun<'a>(adaylar: &[&'a str], yasak: &str) -> Option<&'a str> {
      for aday in adaylar {
          if *aday != yasak {
              return Some(*aday);
          }
      }
      None
  }

  fn main() {
      let isimler = ["Ada", "Bora", "Cem"];
      let secilen;
      {
          let yasak = String::from("Ada");
          let liste = isimler.to_vec();
          secilen = ilk_uygun(&liste, &yasak);
      }
      println!("{secilen:?}");
  }
answer: true
explanation: |
  Derlenir ve `Some("Bora")` yazdırır. Sonuç `'a`'ya bağlı ve `'a` yalnızca dilimin **içindeki**
  metinlerin yaşam süresi. Dilimin kendisi (`liste`'ye bakan `&[...]`) ve `yasak` ise imzada isimsiz,
  yani sonuçla hiçbir bağları yok. Bu yüzden ikisinin de iç blokta düşürülmesi `secilen`'i etkilemez.

  İçteki metinler `"Ada"` gibi literal'ler, yani `&'static str`. `liste` gidince yalnızca onları tutan
  vektör yok olur, metinler yerinde durur. Tek bir `'a` ile `fn ilk_uygun<'a>(adaylar: &'a [&'a str],
  yasak: &'a str)` yazsaydın, sonuç üç girdinin en kısasına bağlanır ve `println!` satırı E0597 verirdi
  (Ders 6).
```

```fill
prompt: "`en_buyuk`, bir dilimdeki en büyük elemana **kopyalamadan** bakan bir `EnBuyuk` değeri döndürsün. Boşlukları doldur."
code: |
  struct EnBuyuk<'a, T> {
      deger: &'a T,
      sira: usize,
  }

  fn en_buyuk<___0, T: PartialOrd>(liste: &'a [T]) -> Option<EnBuyuk<___1, T>> {
      let mut en: Option<EnBuyuk<'a, T>> = None;
      for (sira, deger) in liste.iter().enumerate() {
          let daha_buyuk = match &en {
              Some(e) => deger > e.deger,
              None => true,
          };
          if daha_buyuk {
              en = Some(EnBuyuk { deger, sira });
          }
      }
      en
  }

  fn main() {
      let sicakliklar = [18.5, 24.0, 21.3];
      if let Some(e) = en_buyuk(&sicakliklar) {
          println!("{}. gün: {}", e.sira + 1, e.deger);
      }
  }
blanks:
  - ["'a"]
  - ["'a", "'_"]
explanation: |
  Yaşam süresi parametreleri her zaman tip parametrelerinden **önce** gelir: `<'a, T: PartialOrd>`. Dönüş
  tipindeki `EnBuyuk<'a, T>`, sonucun `liste`'nin baktığı veriye bağlı olduğunu söyler. Tek girdi
  referansı olduğu için `'_` yazmak da aynı anlama gelir (Kural 2).

  `T: PartialOrd` sınırı Modül 11'den: `>` operatörünü kullanabilmek için gövdenin `T`'nin
  karşılaştırılabildiğini bilmesi gerekir. `T: Copy` istemedik, çünkü elemanı kopyalamıyor, ona bakan bir
  `&'a T` saklıyoruz. Bu sayede fonksiyon `String` gibi kopyalanamayan tiplerle de çalışır. Program
  `2. gün: 24` yazdırır.
```

```predict
code: |
  fn bul<'a>(sozluk: &[(&'a str, &'a str)], anahtar: &str) -> Option<&'a str> {
      for (k, v) in sozluk {
          if *k == anahtar {
              return Some(*v);
          }
      }
      None
  }

  fn main() {
      let sozluk = [("elma", "apple"), ("armut", "pear")];
      let sonuc = match bul(&sozluk, "kiraz") {
          Some(c) => c,
          None => "?",
      };
      let ikinci = bul(&sozluk, "armut").unwrap_or("?");
      println!("{sonuc} {ikinci} {}", bul(&sozluk, "elma").is_some());
  }
options:
  - "? pear true"
  - "None pear true"
  - "? Some(\"pear\") true"
  - "kiraz pear false"
answer: 0
explanation: |
  `"kiraz"` sözlükte yok, `bul` `None` döndürür ve `match` onu `"?"`'e çevirir (Modül 7). `unwrap_or`
  aynı işin kısa yolu: `Some("pear")` içinden `"pear"`'ı çıkarır. `is_some()` ise yalnızca bir `bool`
  verir. Hiçbir satır `Option`'ın kendisini yazdırmadığı için `None` ya da `Some(...)` görünmez.

  Yaşam süreleri açısından: `match` kollarından biri `&'a str` (sözlükteki literal), diğeri
  `&'static str` (`"?"`). `'static` her `'a`'ya sığdığı için iki kolun tipi uyuşur (Ders 5). `anahtar`'ın
  isimsiz olması da `bul`'u, kısa ömürlü bir `String`'le aranabilir yapar.
```

## 4. Tur: büyük alıştırmalar

````exercise
id: m12-boss-ortak-onek
title: Ortak önek
difficulty: 2
prompt: |
  Bir arama kutusu, kullanıcının yazdığı metinle bir öneri arasındaki **ortak başlangıcı** vurgulamak
  istiyor. `ortak_onek(a, b)`, `a` ile `b`'nin baştan itibaren aynı olan en uzun kısmını döndürsün.
  Sonuç `a`'nın bir **dilimi** olmalı (kopya yok).

  ```text
  ortak_onek("kitap", "kitaplık")  →  "kitap"
  ortak_onek("çiçek", "çilek")     →  "çi"
  ortak_onek("elma", "armut")      →  ""
  ```

  Dikkat: `a`'yı bir karakterin ortasından kesersen program panikler. Karşılaştırmayı **karakter**
  karakter yap.
starter: |
  fn ortak_onek<'a>(a: &'a str, b: &str) -> &'a str {
      todo!()
  }

  fn main() {
      println!("{}", ortak_onek("kitap", "kitaplık"));
      println!("{}", ortak_onek("çiçek", "çilek"));
  }
solution: |
  fn ortak_onek<'a>(a: &'a str, b: &str) -> &'a str {
      let mut son = 0;
      let mut b_karakterleri = b.chars();
      for (i, ca) in a.char_indices() {
          // b'nin sıradaki karakteri; b bittiyse None
          if b_karakterleri.next() != Some(ca) {
              break;
          }
          son = i + ca.len_utf8();
      }
      &a[..son]
  }

  fn main() {
      println!("{}", ortak_onek("kitap", "kitaplık"));
      println!("{}", ortak_onek("çiçek", "çilek"));
  }
check: tests
tests: |
  #[test]
  fn ortak_baslangic() {
      assert_eq!(ortak_onek("kitap", "kitaplık"), "kitap");
      assert_eq!(ortak_onek("elma", "armut"), "", "ilk harf bile farklıysa önek boştur");
  }

  #[test]
  fn turkce_harfler() {
      assert_eq!(ortak_onek("çiçek", "çilek"), "çi");
      assert_eq!(ortak_onek("çay", "öykü"), "", "ç ve ö'nün UTF-8 kodlamaları aynı baytla başlar ama farklı harflerdir");
  }

  #[test]
  fn uzunluk_sinirlari() {
      assert_eq!(ortak_onek("ada", "ada"), "ada", "iki metin aynıysa önek metnin tamamıdır");
      assert_eq!(ortak_onek("uzunca", "uz"), "uz", "kısa metin bitince karşılaştırma da biter");
      assert_eq!(ortak_onek("", "deniz"), "");
  }

  #[test]
  fn sonuc_b_den_uzun_yasar() {
      let sonuc;
      {
          let oneri = String::from("kitaplık");
          sonuc = ortak_onek("kitapçı", &oneri);
      }
      assert_eq!(sonuc, "kitap", "sonuç yalnızca a'ya bağlı olmalı");
  }
hints:
  - "İki metni yan yana, karakter karakter yürü. İlk farklı karakterde dur. Durduğun yere kadar olan kısım `a`'nın bir dilimi: `&a[..son]`."
  - "`a`'yı `for (i, ca) in a.char_indices()` ile gez. `b` için döngüden önce `let mut b_karakterleri = b.chars();` yaz. Modül 9'daki `next()` her çağrıldığında sıradaki karakteri verir, `b` bitince `None` döner. `if b_karakterleri.next() != Some(ca) { break; }` hem farklı karakteri hem de `b`'nin bitmesini yakalar."
  - "Eşleşen her karakterden sonra `son = i + ca.len_utf8();` yaz. Böylece `son` hep bir karakter sınırında olur ve dilimleme panik vermez."
explanation: |
  İmza işin yarısı: `b` yalnızca karşılaştırmak için okunuyor, sonuç ise `a`'nın bir parçası. Bu yüzden
  yalnızca `a` ile çıktı `'a`'yı paylaşıyor. `b` isimsiz kalıyor. Son test tam olarak bunu sınar: Öneri
  metni düşürülse de sonuç geçerli kalır. İkisine de `'a` verseydin o test **E0597** ile derlenmezdi.

  Bayt bayt karşılaştırmak cazip görünür ama `"çay"` ile `"öykü"` bunu bozar: `ç` (`C3 A7`) ile `ö`
  (`C3 B6`) aynı baytla başlar. Bayt sayacı 1'de durur ve `&a[..1]` bir karakterin ortasını keser:
  panik! `char_indices` her karakterin **başladığı** bayt konumunu verir. `len_utf8` ile birlikte
  kullanınca dilim sınırları her zaman güvende olur (Modül 9).
````

````exercise
id: m12-boss-ayristirici
title: Virgül ayrıştırıcı
difficulty: 3
prompt: |
  Bir CSV satırını parça parça okuyan bir `Ayristirici` yazıyoruz. Her `sonraki()` çağrısı bir sonraki
  virgüle kadar olan parçayı, baştaki ve sondaki boşlukları kırpılmış olarak döndürür. Parçalar bitince
  `None` döner:

  ```text
  "elma, armut ,kiraz"  →  Some("elma"), Some("armut"), Some("kiraz"), None, None, ...
  "a,,b,"               →  Some("a"), Some(""), Some("b"), Some(""), None
  ```

  Parçalar orijinal metnin dilimleri olmalı (kopya yok). Ayrıca kullanıcı **birden fazla parçayı aynı anda**
  elinde tutabilmeli ve parçaları ayrıştırıcıdan **daha uzun** yaşatabilmeli.

  Uyarı: Başlangıç kodundaki `sonraki` imzası derlenir ama bir sorunu var. Testlerden ikisi bu sorunu
  yakalayacak. Gövdeyi yazmanın yanında imzayı da düzeltmen gerekiyor.
starter: |
  struct Ayristirici<'a> {
      kalan: &'a str,
      bitti: bool,
  }

  impl<'a> Ayristirici<'a> {
      fn yeni(metin: &'a str) -> Self {
          Ayristirici { kalan: metin, bitti: false }
      }

      fn sonraki(&mut self) -> Option<&str> {
          todo!()
      }
  }

  fn main() {
      let satir = String::from("elma, armut ,kiraz");
      let mut p = Ayristirici::yeni(&satir);
      while let Some(parca) = p.sonraki() {
          println!("[{parca}]");
      }
  }
solution: |
  struct Ayristirici<'a> {
      kalan: &'a str,
      bitti: bool,
  }

  impl<'a> Ayristirici<'a> {
      fn yeni(metin: &'a str) -> Self {
          Ayristirici { kalan: metin, bitti: false }
      }

      fn sonraki(&mut self) -> Option<&'a str> {
          if self.bitti {
              return None;
          }
          match self.kalan.split_once(',') {
              Some((parca, geri_kalan)) => {
                  self.kalan = geri_kalan;
                  Some(parca.trim())
              }
              None => {
                  self.bitti = true;
                  Some(self.kalan.trim())
              }
          }
      }
  }

  fn main() {
      let satir = String::from("elma, armut ,kiraz");
      let mut p = Ayristirici::yeni(&satir);
      while let Some(parca) = p.sonraki() {
          println!("[{parca}]");
      }
  }
check: tests
tests: |
  #[test]
  fn parcalari_sirayla_verir() {
      let mut p = Ayristirici::yeni("elma, armut ,kiraz");
      assert_eq!(p.sonraki(), Some("elma"));
      assert_eq!(p.sonraki(), Some("armut"), "boşluklar kırpılmalı");
      assert_eq!(p.sonraki(), Some("kiraz"));
      assert_eq!(p.sonraki(), None, "parçalar bitince None dönmeli");
      assert_eq!(p.sonraki(), None, "bittikten sonra da None dönmeye devam etmeli");
  }

  #[test]
  fn bos_parcalar() {
      let mut p = Ayristirici::yeni("a,,b,");
      let mut hepsi = Vec::new();
      while let Some(parca) = p.sonraki() {
          hepsi.push(parca);
      }
      assert_eq!(hepsi, vec!["a", "", "b", ""], "iki virgül arası ve sondaki virgülden sonrası boş parçadır");
  }

  #[test]
  fn iki_parca_ayni_anda() {
      let mut p = Ayristirici::yeni("x, y");
      let ilk = p.sonraki();
      let ikinci = p.sonraki();
      assert_eq!((ilk, ikinci), (Some("x"), Some("y")), "ilk parça elimizdeyken sonraki() çağrılabilmeli");
  }

  #[test]
  fn parca_ayristiricidan_uzun_yasar() {
      let metin = String::from("Isparta, Burdur");
      let parca;
      {
          let mut p = Ayristirici::yeni(&metin);
          parca = p.sonraki();
      }
      assert_eq!(parca, Some("Isparta"), "parça ayrıştırıcıya değil metne bağlı olmalı");
  }
hints:
  - "Önce imzayı düşün: `-> Option<&str>` Kural 3 yüzünden sonucu `&mut self`'e bağlıyor. Yani bir parça elindeyken ayrıştırıcı hâlâ değiştirilebilir olarak ödünç alınmış sayılıyor. Parça aslında kime ait? Ayrıştırıcıya mı, metne mi?"
  - "Dönüş tipini `Option<&'a str>` yap. `'a`, `impl<'a>` başlığından geliyor ve `kalan`'ın baktığı metnin yaşam süresi."
  - "Gövde için `self.kalan.split_once(',')`: `Some((parca, geri_kalan))` ise `self.kalan = geri_kalan;` yapıp `Some(parca.trim())` döndür. `None` ise bu son parçadır: `self.bitti = true;` yapıp `Some(self.kalan.trim())` döndür. En başta `bitti` ise `None` döndür."
explanation: |
  Bu, Ders 3'teki `&self` / `&'a` ayrımının gerçek hayattaki karşılığı. Elision'a bırakılan
  `fn sonraki(&mut self) -> Option<&str>`, sonucu **`&mut self` ödüncüne** bağlar. O zaman `ilk` yaşadığı
  sürece `p` değiştirilebilir olarak ödünç alınmış sayılır ve ikinci `sonraki()` çağrısı **E0499**
  verir. Ayrıştırıcı düşürülünce de parça onunla birlikte geçersiz sayılır: **E0597**. Oysa parça
  ayrıştırıcının değil, metnin bir parçasıdır.

  `-> Option<&'a str>` bunu doğru anlatır: "Verdiğim dilim, bana verdiğin metin kadar yaşar." `&mut self`
  yalnızca çağrı süresince, `kalan`'ı ilerletmek için ödünç alınır. Standart kütüphanedeki `str::split`
  ve `lines` da tam olarak böyle çalışır. Modül 14'te göreceğin `Iterator` trait'inin `next` metodu da
  bu kalıptadır: `fn next(&mut self) -> Option<Self::Item>` ve `Item = &'a str`.

  `bitti` bayrağı neden gerekli? `"a,"` gibi bir satırda son virgülden sonra boş bir parça vardır. Yalnızca
  `kalan.is_empty()` kontrolü yapsaydın o boş parçayı kaybederdin.
````

````exercise
id: m12-boss-en-sik-kelime
title: En sık geçen kelime
difficulty: 4
prompt: |
  Bir metin analiz aracı için `en_sik_kelime(metin, yasakli)` fonksiyonunu yaz. Fonksiyon, metinde en sık
  geçen kelimeyi ve kaç kez geçtiğini döndürsün.

  - Kelimeleri `split_whitespace` ile ayır. Her kelimenin başındaki ve sonundaki noktalama işaretlerini
    kırp: `ham.trim_matches(|c: char| !c.is_alphanumeric())`. Kırpınca boş kalanları atla.
  - `yasakli` listesindeki kelimeleri **sayma** ("ve", "bu" gibi).
  - Büyük/küçük harf ayrımı **yap**: `"Hava"` ile `"hava"` farklı kelimelerdir.
  - Eşit sayıda geçen kelimeler arasından **alfabetik olarak önce geleni** seç (`&str`'lerin `<`
    karşılaştırması yeterli).
  - Sayılacak kelime yoksa `None` döndür.

  Döndürülen kelime `metin`'in bir dilimi olmalı. Sayım için de kopya üretme: `HashMap<&str, usize>`
  kullan.

  ```text
  en_sik_kelime("elma armut elma kiraz elma", &[])  →  Some(("elma", 3))
  en_sik_kelime("ve bu ve şu ve bu", &["ve"])       →  Some(("bu", 2))
  ```
starter: |
  use std::collections::HashMap;

  fn en_sik_kelime<'a>(metin: &'a str, yasakli: &[&str]) -> Option<(&'a str, usize)> {
      todo!()
  }

  fn main() {
      let yorum = "Bugün hava güzel. Hava, güzel mi? güzel!";
      println!("{:?}", en_sik_kelime(yorum, &["mi"]));
  }
solution: |
  use std::collections::HashMap;

  fn en_sik_kelime<'a>(metin: &'a str, yasakli: &[&str]) -> Option<(&'a str, usize)> {
      let mut sayim: HashMap<&'a str, usize> = HashMap::new();
      for ham in metin.split_whitespace() {
          let kelime = ham.trim_matches(|c: char| !c.is_alphanumeric());
          if kelime.is_empty() || yasakli.contains(&kelime) {
              continue;
          }
          *sayim.entry(kelime).or_insert(0) += 1;
      }

      let mut en: Option<(&'a str, usize)> = None;
      for (kelime, adet) in sayim {
          en = match en {
              Some((k, a)) if a > adet || (a == adet && k < kelime) => Some((k, a)),
              _ => Some((kelime, adet)),
          };
      }
      en
  }

  fn main() {
      let yorum = "Bugün hava güzel. Hava, güzel mi? güzel!";
      println!("{:?}", en_sik_kelime(yorum, &["mi"]));
  }
check: tests
tests: |
  #[test]
  fn en_sik_olan_bulunur() {
      assert_eq!(en_sik_kelime("elma armut elma kiraz elma armut", &[]), Some(("elma", 3)));
  }

  #[test]
  fn noktalama_kirpilir_harf_ayrimi_yapilir() {
      assert_eq!(
          en_sik_kelime("Bugün hava güzel. Hava, güzel mi? güzel!", &[]),
          Some(("güzel", 3)),
          "\"güzel.\" ve \"güzel!\" aynı kelime; \"Hava\" ile \"hava\" ayrı kelimeler"
      );
  }

  #[test]
  fn yasakli_kelimeler_sayilmaz() {
      assert_eq!(en_sik_kelime("ve bu ve şu ve bu", &["ve"]), Some(("bu", 2)));
      assert_eq!(en_sik_kelime("ve ve ve", &["ve"]), None, "yasaklı olmayan kelime kalmadıysa None");
  }

  #[test]
  fn esitlikte_alfabetik_bos_metinde_none() {
      assert_eq!(
          en_sik_kelime("zeytin armut zeytin armut incir", &[]),
          Some(("armut", 2)),
          "eşit sayıda geçenlerden alfabetik olarak önce gelen seçilmeli"
      );
      assert_eq!(en_sik_kelime("", &[]), None);
      assert_eq!(en_sik_kelime("... !!! ?", &[]), None, "yalnızca noktalamadan oluşan parçalar kelime değildir");
  }

  #[test]
  fn sonuc_yasakli_listeden_uzun_yasar() {
      let metin = String::from("ve kedi ve köpek kedi");
      let sonuc;
      {
          let yasak = String::from("ve");
          let liste = [yasak.as_str()];
          sonuc = en_sik_kelime(&metin, &liste);
      }
      assert_eq!(sonuc, Some(("kedi", 2)), "sonuç yalnızca metne bağlı olmalı");
  }
hints:
  - "İki aşama: Önce `HashMap<&'a str, usize>` ile say (`*sayim.entry(kelime).or_insert(0) += 1;`), sonra haritayı dolaşıp en iyi `(kelime, adet)` çiftini seç."
  - "`trim_matches` girdinin bir dilimini döndürür, yani `kelime` hâlâ `metin`'e bakan bir `&'a str`. Yasak kontrolü için `yasakli.contains(&kelime)` yeterli."
  - "Seçim için bir `Option<(&'a str, usize)>` biriktir. Yeni çift, mevcut en iyiyi ancak adedi **daha büyükse** ya da adet eşit ve kelime alfabetik olarak **önceyse** geçer. `match en { Some((k, a)) if a > adet || (a == adet && k < kelime) => Some((k, a)), _ => Some((kelime, adet)) }`"
explanation: |
  Bu alıştırma modülün bütün parçalarını bir araya getiriyor:

  - **İmza (Ders 2 ve 6):** İki referans girdi var, bu yüzden elision işe yaramaz. Sonucu yalnızca
    `metin`'e bağladık. `yasakli: &[&str]` içinde iki isimsiz yaşam süresi daha var ve ikisi de sonuçla
    ilgisiz. Son test bunu sınar: Yasak listesi ve içindeki `String` düşürülse de sonuç geçerli kalır.
    Hepsine aynı `'a`'yı verseydin o test **E0597** ile derlenmezdi.
  - **Sıfır kopya (Ders 3):** `split_whitespace` ve `trim_matches` yalnızca dilim üretir. Harita
    anahtarları da `metin`'in içine bakan `&'a str`'ler. Bir milyon kelimelik bir metinde bile tek bir
    kelime kopyalanmaz.
  - **Deterministik sonuç (Modül 9):** `HashMap`'in dolaşım sırası her çalıştırmada değişebilir.
    Alfabetik eşitlik kuralı olmasaydı, eşit sayıda geçen kelimelerden hangisinin seçileceği şansa
    kalırdı.

  Harf ayrımı yapmamamızın bir nedeni var: `to_lowercase()` yeni bir `String` üretir. Böylece dönen
  kelime artık `metin`'in dilimi olamaz. Büyük/küçük harfe duyarsız bir sürüm isteseydin dönüş tipini
  `Option<(String, usize)>` yapman gerekirdi. Yaşam süreleri burada da sana bir tasarım kararını
  gösteriyor: Sonuç ya girdinin parçasıdır ya da yeni üretilmiş sahipli bir değerdir.
````
