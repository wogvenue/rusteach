---
id: m09-boss
title: "Boss: Koleksiyon Ustası"
minutes: 35
type: boss
objectives:
  - "`Vec`, `String`, `HashMap` ve diğer koleksiyonları borrow checker'la uyum içinde kullanabildiğini göstermek"
  - Bir problem için doğru koleksiyonu seçip sıralama, arama ve filtreleme araçlarıyla çözebilmek
keywords: [Vec, String, HashMap, entry, HashSet, BTreeMap, VecDeque, BinaryHeap, sort_by, binary_search, retain]
---

Modülün son sınavına hoş geldin! Burada yeni bir şey öğretilmeyecek. Bu bölüm, `Vec`'ten `BinaryHeap`'e
ve `sort_by`'dan `retain`'e kadar öğrendiklerini **kendi başına** kullanıp kullanamadığını ölçüyor.
Araya önceki modüllerden (sahiplik, ödünç alma, `match`, `let ... else`) birkaç soru da karıştırdık.

Geçmek için puanların en az **%80**'ini toplaman gerekiyor. Acele etme. `predict` sorularında kodu
satır satır kafanda çalıştır, `compiles` sorularında ise önce "kim sahip, kim ödünç alıyor?" diye sor.

## Vektörler ve metinler

```compiles
code: |
  fn main() {
      let mut sepet = vec![10, 20, 30];
      for fiyat in &sepet {
          if *fiyat > 15 {
              sepet.push(*fiyat / 2);
          }
      }
      println!("{sepet:?}");
  }
answer: false
error: E0502
explanation: |
  `for fiyat in &sepet` döngü boyunca `sepet`'i **paylaşılan** olarak ödünç alır. Döngünün içindeki
  `push` ise **değiştirilebilir** bir ödünç ister. İkisi aynı anda var olamaz. Bu kural keyfi değildir:
  `push` kapasite dolunca vektörü yeni bir heap bloğuna taşıyabilir ve `fiyat` eski, serbest bırakılmış
  belleği gösterirdi. C++'ta bu hata "iterator invalidation" adıyla bilinir ve programı sessizce bozar.
  Çözüm: eklenecekleri ayrı bir vektörde topla, döngüden sonra ekle.
```

```compiles
code: |
  fn main() {
      let isimler = vec![String::from("Ada"), String::from("Can")];
      let ilk = isimler[0];
      println!("{ilk} {}", isimler.len());
  }
answer: false
error: E0507
explanation: |
  `isimler[0]` bir `String`'dir ve `String` `Copy` değildir (Modül 4). `let ilk = isimler[0];` onu
  vektörün **içinden dışarı taşımaya** çalışır. Bu, vektörde bir "delik" bırakırdı. Vektör sonra o
  deliği de serbest bırakmaya kalkardı. Çözümler: ödünç al (`&isimler[0]`), bilinçli kopyala
  (`isimler[0].clone()`) ya da vektörden gerçekten çıkar (`remove(0)`; bunun için `let mut` gerekir).
```

```predict
code: |
  fn main() {
      let s = String::from("ağaç");
      println!("{} {}", s.len(), s.chars().count());

      let mut ters = String::new();
      for c in s.chars().rev() {
          ters.push(c);
      }
      println!("{ters}");
  }
options:
  - |
    6 4
    çağa
  - |
    4 4
    çağa
  - |
    6 6
    çağa
  - |
    4 6
    çğaa
answer: 0
explanation: |
  `len()` **bayt** sayısını verir: `a`(1) + `ğ`(2) + `a`(1) + `ç`(2) = 6. `chars().count()` ise Unicode
  karakter (`char`) sayısını verir, yani 4. `chars().rev()` karakterleri sondan başa doğru verir. Her
  `char` bütün olarak taşındığı için Türkçe harfler bozulmadan ters çevrilir: `"çağa"`. Baytları ters
  çevirseydin `ğ` ve `ç`'nin iki baytı da yer değiştirir ve geçerli UTF-8 olmayan bir bayt dizisi
  çıkardı; böyle bir dizi bir `String`'e zaten konamaz.
```

````quiz
question: |
  ```rust
  let s1 = String::from("Kara");
  let s2 = String::from("deniz");
  let s3 = s1 + &s2;
  ```
  Bu satırlardan sonra hangi değişkenler **kullanılabilir**?
options:
  - "`s1`, `s2` ve `s3`'ün üçü de"
  - "Yalnızca `s2` ve `s3`"
  - "Yalnızca `s3`"
  - "Yalnızca `s1` ve `s3`"
answer: 1
explanation: |
  `+` operatörünün sol tarafı `self` olarak alınır, yani `s1` **taşınır**. Böylece onun heap tamponu
  yeniden kullanılarak `"Karadeniz"` oluşturulur. Sağ taraf ise `&s2` olarak, sadece **ödünç** alınır.
  Bu yüzden `s2` hâlâ geçerlidir. İkisini de korumak istiyorsan `format!("{s1}{s2}")` hiçbirini
  taşımaz.
feedback:
  - "`s1` taşındı: `+`, sol tarafın sahipliğini alır."
  - "Doğru!"
  - "`s2` yalnızca ödünç alındı (`&s2`), sahipliği hâlâ kendisinde."
  - "Tersi: taşınan `s1`, ödünç alınan `s2`."
````

## Haritalar, kümeler ve kuyruklar

```predict
code: |
  use std::collections::HashMap;

  fn main() {
      let oylar = ["elma", "armut", "elma", "kiraz", "elma", "armut"];
      let mut sayim = HashMap::new();
      for oy in oylar {
          *sayim.entry(oy).or_insert(0) += 1;
      }
      println!("{:?} {:?} {}", sayim.get("elma"), sayim.get("muz"), sayim.len());
  }
options:
  - "Some(3) None 3"
  - "3 0 3"
  - "Some(3) None 6"
  - "Some(3) Some(0) 4"
answer: 0
explanation: |
  `entry(oy).or_insert(0)`, anahtar yoksa `0` ekler ve her iki durumda da değere bir `&mut` verir.
  `*... += 1` sayacı artırır. `get` bir `Option<&V>` döndürür: `elma` için `Some(3)`, hiç eklenmemiş
  `muz` için `None`. `get` bir anahtar **eklemez**. Haritada üç farklı anahtar var.
```

```predict
code: |
  use std::collections::HashMap;

  fn iki_kati(fiyatlar: &HashMap<&str, u32>, urun: &str) -> u32 {
      let Some(&fiyat) = fiyatlar.get(urun) else {
          return 0;
      };
      fiyat * 2
  }

  fn main() {
      let fiyatlar = HashMap::from([("çay", 15), ("simit", 20)]);
      println!("{} {}", iki_kati(&fiyatlar, "simit"), iki_kati(&fiyatlar, "börek"));
  }
options:
  - "40 0"
  - "Some(40) None"
  - "40 ve ardından panik (börek yok)"
  - "20 0"
answer: 0
explanation: |
  `get` bir `Option<&u32>` döndürür. Modül 7'deki `let ... else`, deseni tutturursa değişkeni bağlar,
  tutturamazsa `else` bloğunu çalıştırır (o blok `return`, `break` ya da `panic!` gibi bir yolla
  mutlaka dışarı çıkmalıdır).
  `Some(&fiyat)` deseni hem `Some`'ı hem de içteki referansı açar, bu yüzden `fiyat` doğrudan bir `u32`
  olur. `"simit"` için 20 × 2 = 40; `"börek"` haritada olmadığı için `get` `None` verir ve fonksiyon
  `0` döndürür. Panik yok, çünkü `[]` ile değil `get` ile okuduk. Fonksiyonun dönüş tipi `u32`
  olduğu için çıktıda `Some(..)` görünmez.
```

```compiles
code: |
  use std::collections::HashMap;

  fn main() {
      let mut stok: HashMap<&str, u32> = HashMap::new();
      let elma = stok.entry("elma").or_insert(0);
      println!("{} çeşit ürün", stok.len());
      *elma += 5;
  }
answer: false
error: E0502
explanation: |
  `or_insert` haritanın **içine** işaret eden bir `&mut u32` döndürür. Bu referans son kullanımına
  (`*elma += 5`) kadar yaşar ve bu süre boyunca haritanın kendisi değiştirilebilir biçimde ödünç
  alınmış sayılır. Aradaki `stok.len()` ise paylaşılan bir ödünç ister. Modül 5'in kuralı burada da
  geçerli: ya bir `&mut` ya da istediğin kadar `&`, ikisi aynı anda olmaz. Çözüm: `len()` çağrısını
  `*elma += 5` satırından **sonraya** taşı. NLL sayesinde ödünç orada biter.
```

```predict
code: |
  use std::cmp::Reverse;
  use std::collections::{BinaryHeap, VecDeque};

  fn main() {
      let mut kuyruk = VecDeque::from([1, 2]);
      kuyruk.push_front(3);
      kuyruk.push_back(4);
      println!("{:?} {:?}", kuyruk.pop_front(), kuyruk.pop_back());

      let mut yigin = BinaryHeap::from([Reverse(5), Reverse(1), Reverse(8)]);
      yigin.push(Reverse(3));
      if let Some(Reverse(x)) = yigin.pop() {
          println!("{x}");
      }
  }
options:
  - |
    Some(3) Some(4)
    1
  - |
    Some(1) Some(4)
    8
  - |
    Some(3) Some(2)
    1
  - |
    Some(3) Some(4)
    8
answer: 0
explanation: |
  Kuyruğun son hâli `[3, 1, 2, 4]`: `push_front` başa, `push_back` sona ekler. `pop_front` baştaki
  `3`'ü, `pop_back` sondaki `4`'ü verir. `BinaryHeap` bir **max-heap**'tir. Ama elemanlar `Reverse` ile
  sarıldığı için karşılaştırma tersine döner ve tepeye **en küçük** sayı çıkar: `1`.
```

```quiz
question: |
  Bir konser bilet sisteminde her bilet kodunun **yalnızca bir kez** kaydedilmesi gerekiyor. Gün sonunda
  da kodların **alfabetik sırayla** raporlanması isteniyor. Kodları hangi koleksiyonda tutmak en
  uygunudur?
options:
  - "`HashSet<String>`"
  - "`BTreeSet<String>`"
  - "`Vec<String>`"
  - "`BinaryHeap<String>`"
answer: 1
explanation: |
  İki gereksinim var: **benzersizlik** ve **sıralı dolaşım**. `BTreeSet` ikisini birden sağlar.
  `insert` aynı kodu ikinci kez eklemez (`false` döner). `for kod in &biletler` her zaman alfabetik
  sırayla dolaşır. İşlemler O(log n)'dir.
feedback:
  - "Benzersizliği sağlar ama dolaşım sırası garanti değildir; rapordan önce ayrıca sıralaman gerekirdi."
  - "Doğru!"
  - "Her eklemede `contains` ile O(n) kontrol ve rapor öncesi sıralama gerekir. Çalışır ama hem yavaş hem hataya açık."
  - "Öncelik kuyruğu yalnızca tepeyi bilir ve tekrarları engellemez."
```

## Sıralama, arama ve filtreleme

```predict
code: |
  fn main() {
      let mut kayitlar = vec![("Ece", 3), ("Ali", 2), ("Can", 3), ("Ali", 1)];
      kayitlar.sort_by_key(|k| k.0);
      println!("{kayitlar:?}");

      let mut sayilar = vec![4, 1, 4, 2, 1, 4];
      sayilar.dedup();
      let once = sayilar.len();
      sayilar.sort();
      sayilar.dedup();
      println!("{once} {sayilar:?}");
  }
options:
  - |
    [("Ali", 2), ("Ali", 1), ("Can", 3), ("Ece", 3)]
    6 [1, 2, 4]
  - |
    [("Ali", 1), ("Ali", 2), ("Can", 3), ("Ece", 3)]
    6 [1, 2, 4]
  - |
    [("Ali", 2), ("Ali", 1), ("Can", 3), ("Ece", 3)]
    3 [1, 2, 4]
  - |
    [("Ali", 1), ("Ali", 2), ("Can", 3), ("Ece", 3)]
    3 [4, 1, 2]
answer: 0
explanation: |
  Anahtar yalnızca ad (`k.0`). İki "Ali" eşit sayılır ve `sort_by_key` **kararlı** olduğu için orijinal
  sıraları korunur: `("Ali", 2)` listede önce geliyordu. İkinci elemana hiç bakılmaz. İlk `dedup` hiçbir
  şey silmez, çünkü `[4, 1, 4, 2, 1, 4]` içinde **yan yana** duran iki eşit sayı yok. Sıralamadan sonra
  tekrarlar yan yana gelir ve `dedup` onları temizler: `[1, 2, 4]`.
```

```fill
prompt: |
  `ekle`, sıralı bir listeye yeni bir sayıyı **sırayı bozmadan** eklesin. Sayı zaten varsa hiçbir şey
  yapmasın. `Result`'u Modül 7'deki gibi `match` ile açıyoruz.
code: |
  fn ekle(liste: &mut Vec<u32>, yeni: u32) {
      match liste.___0(&yeni) {
          Ok(_) => {}
          Err(yer) => liste.___1(yer, yeni),
      }
  }

  fn main() {
      let mut numaralar = vec![3, 8, 15];
      for n in [10, 1, 8, 20] {
          ekle(&mut numaralar, n);
      }
      println!("{numaralar:?}");
  }
blanks:
  - ["binary_search"]
  - ["insert"]
explanation: |
  `binary_search` sıralı listede O(log n)'de arar. Bulursa `Ok(indeks)`, bulamazsa `Err(ekleme_yeri)`
  döndürür. `insert(yer, yeni)` elemanı tam o konuma koyar ve sağdakileri kaydırır. Sonuç:
  `[1, 3, 8, 10, 15, 20]`. İkinci `8` eklenmedi, çünkü `Ok` kolu hiçbir şey yapmıyor.
```

```compiles
code: |
  fn main() {
      let notlar = vec![72.5, 88.0, 91.5];
      let en_yuksek = notlar.iter().max();
      println!("{en_yuksek:?}");
  }
answer: false
error: E0277
explanation: |
  `max`, tıpkı `sort` gibi elemanların **tam sıralamaya** (`Ord`) sahip olmasını ister. Ondalık sayılar
  `NaN` yüzünden yalnızca `PartialOrd`'dur. Çözüm: bir döngüde `en = en.max(*x)` biriktirmek ya da
  sıralama gerekiyorsa `sort_by(|a, b| a.total_cmp(b))` kullanmak.
```

````quiz
question: |
  ```rust
  let mut v = Vec::with_capacity(10);
  for i in 1..=6 {
      v.push(i);
  }
  v.retain(|x| *x % 2 == 0);
  ```
  Bu kodun sonunda `v` için hangisi doğrudur?
options:
  - "`len` 3; kapasite en az 10 olarak kalır"
  - "`len` 3; kapasite 3'e düşer"
  - "`len` 6; tek sayıların yerinde boşluk kalır"
  - "`retain` yeni bir vektör döndürür, `v` değişmez"
answer: 0
explanation: |
  `retain` **yerinde** çalışır. Closure'ın `true` döndürdüğü elemanlar (2, 4, 6) sıralarını koruyarak
  öne kaydırılır ve uzunluk 3 olur. Ayrılmış bellek ise geri verilmez. Kapasite aynı kalır. Belleği
  küçültmek istersen `shrink_to_fit()` çağırman gerekir.
feedback:
  - "Doğru!"
  - "Kapasite kendiliğinden küçülmez; bunun için `shrink_to_fit()` gerekir."
  - "Silinen elemanlar gerçekten çıkarılır, `len` küçülür."
  - "`retain` `()` döndürür ve `v`'nin kendisini değiştirir (bu yüzden `let mut` gerekiyor)."
````

## Kod meydan okumaları

```exercise
id: m09-boss-anagram
title: Anagram dedektifi
difficulty: 2
prompt: |
  İki ifade aynı harflerin farklı bir dizilişinden oluşuyorsa birbirinin **anagramıdır**. Örneğin
  "kara" ile "arka" ya da "dere tepe" ile "tepe dere".

  `anagram_mi(a, b)` fonksiyonunu yaz:

  - **Boşlukları** yok say.
  - **Büyük/küçük harf** ayrımı yapma (iki metni de `to_lowercase()` ile küçült).
  - Türkçe harfler kendi başına bir harftir: `ş` ile `s` farklıdır.
starter: |
  fn anagram_mi(a: &str, b: &str) -> bool {
      todo!()
  }

  fn main() {
      println!("{}", anagram_mi("Kara", "arka"));
      println!("{}", anagram_mi("aşk", "ask"));
  }
solution: |
  fn harfler(metin: &str) -> Vec<char> {
      let mut sonuc = Vec::new();
      for c in metin.to_lowercase().chars() {
          if c != ' ' {
              sonuc.push(c);
          }
      }
      sonuc.sort_unstable();
      sonuc
  }

  fn anagram_mi(a: &str, b: &str) -> bool {
      harfler(a) == harfler(b)
  }

  fn main() {
      println!("{}", anagram_mi("Kara", "arka"));
      println!("{}", anagram_mi("aşk", "ask"));
  }
check: tests
tests: |
  #[test]
  fn basit_anagram() {
      assert!(anagram_mi("kara", "arka"), "\"kara\" ile \"arka\" aynı harflerden oluşur");
      assert!(anagram_mi("ekmek", "kemek"), "harflerin sırası farklı ama sayıları aynı");
  }

  #[test]
  fn bosluk_ve_buyuk_harf_yok_sayilir() {
      assert!(anagram_mi("Dere Tepe", "tepe dere"), "boşluklar ve büyük harfler yok sayılmalı");
      assert!(anagram_mi("dere tepe", "deretepe"), "boşluk sayısı farklı olsa da anagramdır");
      assert!(anagram_mi("Ana  Kara", "kara ana"), "art arda boşluklar da yok sayılmalı");
  }

  #[test]
  fn turkce_harfler_ayri_harftir() {
      assert!(!anagram_mi("aşk", "ask"), "ş ile s farklı harflerdir");
      assert!(anagram_mi("çiğ", "ğiç"), "Türkçe harfler de yer değiştirebilir");
  }

  #[test]
  fn harf_sayisi_farkliysa_degil() {
      assert!(!anagram_mi("kara", "karaa"), "fazladan bir 'a' varsa anagram değildir");
      assert!(!anagram_mi("aab", "abb"), "aynı harfler ama farklı adetler");
  }
hints:
  - "İki metni karşılaştırılabilir bir \"parmak izine\" dönüştür: boşluksuz ve küçük harfli karakterlerin **sıralı** listesi. Parmak izleri eşitse anagramdır."
  - "`metin.to_lowercase().chars()` ile dolaş, boşluk olmayanları bir `Vec<char>`'a `push` et, sonra `sort_unstable()` ile sırala. `char`'lar ayırt edilemez, kararsız sıralama yeter."
  - "Bir yardımcı fonksiyon yaz: `fn harfler(metin: &str) -> Vec<char>`. Sonra `harfler(a) == harfler(b)`. İki `Vec` `==` ile eleman eleman karşılaştırılır."
explanation: |
  Sıralama, "aynı elemanlar, farklı sıra" sorusunu "aynı sıralı liste" sorusuna dönüştürür. Bu,
  çok sık kullanılan bir hiledir. Maliyeti O(n log n)'dir.

  Alternatif, Ders 3'teki gibi bir `HashMap<char, usize>` ile her harfi saymak ve iki haritayı `==` ile
  karşılaştırmaktır. Bu yol O(n)'dir ve çok uzun metinlerde daha hızlıdır.

  `to_lowercase()`'in Türkçe tuzağını da unutma (Ders 2): `"I".to_lowercase()` `"ı"` değil `"i"`
  verir. Testlerde bu yüzden büyük `I` kullanmadık. Gerçek bir Türkçe uygulamada `I`/`İ` için özel bir
  kural yazman gerekirdi.
```

```exercise
id: m09-boss-kutuphane
title: Kütüphane ödünç geçmişi
difficulty: 3
prompt: |
  Okul kütüphanesinin sistemi her ödünç alma işlemini `(üye, kitap)` çifti olarak kaydediyor. Aynı
  üye aynı kitabı birden çok kez almış olabilir.

  `gecmis` fonksiyonu bu kayıtlardan bir rapor üretsin: her üye için okuduğu kitapların **alfabetik
  sıralı** ve **tekrarsız** listesi. Rapor, üyeleri de alfabetik sırada tutan bir `BTreeMap` olsun.
starter: |
  use std::collections::BTreeMap;

  fn gecmis(kayitlar: &[(&str, &str)]) -> BTreeMap<String, Vec<String>> {
      todo!()
  }

  fn main() {
      let kayitlar = [
          ("selin", "Çalıkuşu"),
          ("emre", "Sefiller"),
          ("selin", "Aşk-ı Memnu"),
          ("selin", "Çalıkuşu"),
      ];
      for (uye, kitaplar) in &gecmis(&kayitlar) {
          println!("{uye}: {kitaplar:?}");
      }
  }
solution: |
  use std::collections::BTreeMap;

  fn gecmis(kayitlar: &[(&str, &str)]) -> BTreeMap<String, Vec<String>> {
      let mut rapor: BTreeMap<String, Vec<String>> = BTreeMap::new();
      for (uye, kitap) in kayitlar {
          rapor
              .entry(uye.to_string())
              .or_default()
              .push(kitap.to_string());
      }
      for kitaplar in rapor.values_mut() {
          kitaplar.sort();
          kitaplar.dedup();
      }
      rapor
  }

  fn main() {
      let kayitlar = [
          ("selin", "Çalıkuşu"),
          ("emre", "Sefiller"),
          ("selin", "Aşk-ı Memnu"),
          ("selin", "Çalıkuşu"),
      ];
      for (uye, kitaplar) in &gecmis(&kayitlar) {
          println!("{uye}: {kitaplar:?}");
      }
  }
check: tests
tests: |
  #[test]
  fn kitaplar_gruplanir() {
      let r = gecmis(&[("ali", "Kuyucaklı Yusuf"), ("ayse", "Sefiller"), ("ali", "Beyaz Gemi")]);
      assert_eq!(r.len(), 2, "iki farklı üye var");
      assert_eq!(r["ali"], vec!["Beyaz Gemi", "Kuyucaklı Yusuf"], "ali'nin kitapları alfabetik sıralı olmalı");
      assert_eq!(r["ayse"], vec!["Sefiller"]);
  }

  #[test]
  fn tekrarlar_temizlenir() {
      let r = gecmis(&[("can", "Dune"), ("can", "Momo"), ("can", "Dune"), ("can", "Dune")]);
      assert_eq!(r["can"], vec!["Dune", "Momo"], "aynı kitap listede bir kez görünmeli");
  }

  #[test]
  fn uyeler_alfabetik() {
      let r = gecmis(&[("zeki", "A"), ("berk", "B"), ("mine", "C")]);
      let mut uyeler = Vec::new();
      for uye in r.keys() {
          uyeler.push(uye.as_str());
      }
      assert_eq!(uyeler, vec!["berk", "mine", "zeki"], "BTreeMap üyeleri sıralı tutmalı");
  }

  #[test]
  fn kayit_yoksa_bos_rapor() {
      assert!(gecmis(&[]).is_empty(), "kayıt yoksa rapor boş olmalı");
  }
hints:
  - "İki aşama düşün: önce her kitabı üyesinin listesine ekle (tekrarlarla birlikte), sonra her listeyi düzenle."
  - "Ekleme için entry API: `rapor.entry(uye.to_string()).or_default().push(kitap.to_string());` Düzenleme için `for kitaplar in rapor.values_mut() { ... }`."
  - "Her listede önce `sort()`, sonra `dedup()` çağır. Sıralama tekrarları yan yana getirir, `dedup` de onları siler."
explanation: |
  `entry(..).or_default()` "liste yoksa oluştur, sonra ekle" desenidir (Ders 3). Bu yüzden ilk kitap
  için ayrı bir `if` yazmadık. `or_insert(Vec::new())` da aynı işi görürdü. İkinci döngüde
  `values_mut()` her değere bir `&mut Vec<String>` verir ve listeler yerinde düzenlenir.

  `sort` + `dedup` ikilisi O(k log k) ile benzersiz ve sıralı bir liste üretir. Bunun yerine her üye
  için bir `BTreeSet<String>` tutsaydın, tekrarlar ve sıralama eklenirken kendiliğinden halledilirdi:
  `BTreeMap<String, BTreeSet<String>>`. İki çözüm de doğru. Kayıtlar önce toplanıp sonra raporlanıyorsa
  `Vec` + `sort` + `dedup` genellikle daha hızlıdır. Kayıtlar sürekli geliyor ve her an sıralı hâl
  isteniyorsa `BTreeSet` daha uygundur.
```

```exercise
id: m09-boss-en-cok-satanlar
title: Haftanın en çok satanları
difficulty: 4
prompt: |
  Bir kırtasiyenin kasası her satışı `(ürün, adet)` olarak kaydediyor. Aynı ürün hafta boyunca birçok
  kez satılmış olabilir. `en_cok_satanlar(satislar, k)` haftalık "en çok satanlar" listesini üretsin:

  1. Her ürünün **toplam** adedini hesapla.
  2. Toplam adede göre **azalan** sırala. Toplamı eşit olan ürünleri **ürün adına göre alfabetik**
     sırala.
  3. Yalnızca ilk `k` ürünü döndür. Daha az ürün varsa hepsini döndür.

  İpucu: `v.truncate(k)` bir vektörü ilk `k` elemana kısaltır (`k >= len` ise hiçbir şey yapmaz).
starter: |
  use std::collections::HashMap;

  fn en_cok_satanlar(satislar: &[(&str, u32)], k: usize) -> Vec<(String, u32)> {
      todo!()
  }

  fn main() {
      let hafta = [("kalem", 12), ("defter", 5), ("silgi", 7), ("defter", 9), ("kalem", 3)];
      for (urun, adet) in en_cok_satanlar(&hafta, 2) {
          println!("{urun}: {adet}");
      }
  }
solution: |
  use std::collections::HashMap;

  fn en_cok_satanlar(satislar: &[(&str, u32)], k: usize) -> Vec<(String, u32)> {
      let mut toplamlar: HashMap<&str, u32> = HashMap::new();
      for (urun, adet) in satislar {
          *toplamlar.entry(*urun).or_insert(0) += *adet;
      }

      let mut liste: Vec<(String, u32)> = Vec::new();
      for (urun, toplam) in toplamlar {
          liste.push((urun.to_string(), toplam));
      }

      liste.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
      liste.truncate(k);
      liste
  }

  fn main() {
      let hafta = [("kalem", 12), ("defter", 5), ("silgi", 7), ("defter", 9), ("kalem", 3)];
      for (urun, adet) in en_cok_satanlar(&hafta, 2) {
          println!("{urun}: {adet}");
      }
  }
check: tests
tests: |
  fn liste(ciftler: &[(&str, u32)]) -> Vec<(String, u32)> {
      let mut v = Vec::new();
      for (ad, adet) in ciftler {
          v.push((ad.to_string(), *adet));
      }
      v
  }

  #[test]
  fn toplamlar_ve_siralama() {
      let hafta = [("kalem", 12), ("defter", 5), ("silgi", 7), ("defter", 9), ("kalem", 3)];
      assert_eq!(
          en_cok_satanlar(&hafta, 3),
          liste(&[("kalem", 15), ("defter", 14), ("silgi", 7)]),
          "kalem 12+3=15, defter 5+9=14, silgi 7; azalan sırada olmalı"
      );
  }

  #[test]
  fn ilk_k_tanesi() {
      let hafta = [("a", 1), ("b", 2), ("c", 3), ("d", 4)];
      assert_eq!(en_cok_satanlar(&hafta, 2), liste(&[("d", 4), ("c", 3)]), "yalnızca en çok satan 2 ürün dönmeli");
  }

  #[test]
  fn esitlikte_alfabetik() {
      let hafta = [("zımba", 10), ("cetvel", 4), ("boya", 10), ("cetvel", 6), ("ataş", 2)];
      assert_eq!(
          en_cok_satanlar(&hafta, 4),
          liste(&[("boya", 10), ("cetvel", 10), ("zımba", 10), ("ataş", 2)]),
          "toplamı eşit olanlar (10) ürün adına göre alfabetik sıralanmalı"
      );
  }

  #[test]
  fn k_buyukse_hepsi_k_sifirsa_hic() {
      let hafta = [("kalem", 1), ("kalem", 1)];
      assert_eq!(en_cok_satanlar(&hafta, 10), liste(&[("kalem", 2)]), "k ürün sayısından büyükse hepsi dönmeli");
      assert!(en_cok_satanlar(&hafta, 0).is_empty(), "k = 0 ise liste boş olmalı");
      assert!(en_cok_satanlar(&[], 3).is_empty(), "satış yoksa liste boş olmalı");
  }
hints:
  - "Önce bir `HashMap<&str, u32>` ile toplamları çıkar (`entry(..).or_insert(0)`), sonra haritayı bir `Vec<(String, u32)>`'ye aktar. Haritanın dolaşım sırası rastgele olduğu için sıralama şart."
  - "Sıralama kuralı iki kriterli: `sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)))`. İlki azalan (`b` solda), ikincisi artan (`a` solda)."
  - "En sonda `liste.truncate(k);` ve `liste` döndür. `for (urun, adet) in satislar` dolaşırken `urun` bir `&&str`, `adet` bir `&u32` olur, yani `*urun` ve `*adet` gerekir."
explanation: |
  Bu, gerçek dünyada çok sık karşılaşılan bir **topla, sırala, kes** hattıdır (raporlar, liderlik
  tabloları, "en çok okunanlar"). Her koleksiyon güçlü olduğu işi yapıyor. `HashMap` gruplamayı O(1)
  ortalamayla, `Vec` + `sort_by` sıralamayı O(m log m) ile, `truncate` da kesmeyi yapıyor.

  Eşitlik kuralı yalnızca güzellik için değil. `HashMap`'in dolaşım sırası her çalıştırmada farklı
  olabilir. İkinci kriter olmasaydı, toplamı eşit ürünlerin sırası da çalıştırmadan çalıştırmaya
  değişirdi. Tam bir sıralama kuralı, sonucu **deterministik** yapar.

  İleri bir not: m farklı ürün arasından yalnızca küçük bir k isteniyorsa, her şeyi sıralamak yerine
  `Reverse` ile k boyutlu bir `BinaryHeap` tutmak O(m log k) maliyet verir (Ders 4). Ürün sayısı
  milyonlarla ölçüldüğünde bu fark hissedilir.
```
