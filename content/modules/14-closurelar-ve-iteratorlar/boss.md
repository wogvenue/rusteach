---
id: m14-boss
title: "Boss: Fonksiyonel Vadi'nin Bekçisi"
minutes: 35
type: boss
keywords: [closure, Fn, FnMut, FnOnce, move, Iterator, adaptör, tüketici, collect, kendi iterator'ın]
---

Fonksiyonel Vadi'nin girişinde bir bekçi duruyor: elinde bir sepet closure, sırtında bitmeyen bir iterator.
Geçmek için ona closure'ların neyi nasıl yakaladığını, iterator zincirlerinin nasıl aktığını ve kendi
iterator'ını yazabildiğini göstermelisin. Geçme notu **%80**. Arada önceki modüllerden de sorular var —
sahiplik, ödünç alma ve yaşam süreleri hâlâ her yerde!

## Closure'lar ve yakalama

```compiles
code: |
  fn main() {
      let kare = |x| x * x;
      println!("{}", kare(4));
      println!("{}", kare(2.5));
  }
answer: false
error: E0308
explanation: |
  Closure'lar generic değildir. İlk çağrı `x`'in tipini tamsayı olarak sabitler; `kare(2.5)` bir `f64`
  verdiği için E0308 alınır. Her iki tiple çalışan bir şey için generic bir `fn` (ve `Mul` sınırı) gerekirdi.
```

```predict
code: |
  fn main() {
      let mut toplam = 0;
      let mut ekle = |x: i32| toplam += x;
      ekle(5);
      ekle(7);
      let mut kopya = move || {
          toplam += 100;
          toplam
      };
      println!("{}", kopya());
      println!("{toplam}");
  }
options:
  - |
    112
    112
  - |
    112
    12
  - |
    100
    12
  - Derlenmez
answer: 1
explanation: |
  `ekle` `toplam`'ı `&mut` ile yakalar; son kullanımı `ekle(7)`'dir, ödünç orada biter ve `toplam` 12 olur.
  `move` closure ise `i32` `Copy` olduğu için `toplam`'ın **kopyasını** (12) yakalar ve kendi kopyasını
  112 yapar. Dışarıdaki `toplam` 12 olarak kalır.
```

```quiz
question: |
  Bir fonksiyon, aldığı closure'ı bir dilimin **her elemanı için sırayla** çağıracak. Çağıranların, örneğin
  işlenen eleman sayısını dışarıdaki bir sayaçta tutan closure'lar da verebilmesini istiyorsun. Hangi sınırı seçmelisin?
options:
  - "`F: Fn(&T)`"
  - "`F: FnMut(&T)`"
  - "`F: FnOnce(&T)`"
  - "`F: fn(&T)`"
answer: 1
explanation: |
  Closure defalarca çağrılacağı için `FnOnce` yetmez (bir kez çağrılabilir). `Fn` dışarıdaki sayacı
  değiştiren closure'ları reddeder. `FnMut` hem okuyanları hem değiştirenleri kabul eder ve sırayla çağırmaya
  izin verir — doğru denge budur. `fn(&T)` bir fonksiyon işaretçisi tipidir; yakalayan closure'ları hiç kabul etmez.
feedback:
  - Sayacı değiştiren closure'lar `Fn` değildir, reddedilirler.
  - Doğru! Sırayla tekrar çağırma + değiştirmeye izin.
  - "`FnOnce` yalnızca bir kez çağrılabilen closure'ları da kabul eder; onları defalarca çağıramazsın."
  - Fonksiyon işaretçisi yakalama yapan closure'ları kabul etmez.
```

```compiles
code: |
  fn tekrarla<F: FnMut()>(n: u32, mut f: F) {
      for _ in 0..n {
          f();
      }
  }

  fn main() {
      let mut kutu: Vec<String> = Vec::new();
      let hediye = String::from("kitap");
      tekrarla(2, || kutu.push(hediye));
      println!("{kutu:?}");
  }
answer: false
error: E0507
explanation: |
  `kutu.push(hediye)` `hediye`'nin sahipliğini vektöre taşır; böyle bir closure ancak bir kez çağrılabilir,
  yani yalnızca `FnOnce`'tır. `tekrarla` ise `FnMut` istiyor ve onu iki kez çağıracak. Derleyici:
  *"cannot move out of `hediye`, a captured variable in an `FnMut` closure"*. Çözüm her çağrıda yeni bir değer
  vermek: `kutu.push(hediye.clone())`.
```

```compiles
code: |
  fn main() {
      let mut v = vec![1, 2, 3];
      let ilk = || v[0];
      v.push(4);
      println!("{}", ilk());
  }
answer: false
error: E0502
explanation: |
  (Modül 5 tekrarı) `ilk` closure'ı `v`'yi `&` ile yakalar ve bu ödünç `ilk()`'in son kullanımına kadar sürer.
  Arada `v.push(4)` bir `&mut` ister: "ya bir `&mut` ya da istediğin kadar `&`" kuralı çiğnenir. `push`
  vektörü yeniden ayırabileceği için bu kural burada gerçekten bir sarkan referansı engelliyor.
```

```compiles
code: |
  fn main() {
      let sehir = String::from("Kars");
      let yaz = move || println!("{} harf", sehir.chars().count());
      yaz();
      yaz();
  }
answer: true
explanation: |
  `move` `sehir`'i closure'ın içine taşır ama gövde onu yalnızca **okuyor**; closure bu yüzden `Fn`'dir ve
  istediğin kadar çağrılabilir. `move` yakalama biçimini, trait ise gövdenin ne yaptığını belirler.
```

## Iterator'lar ve adaptörler

```predict
code: |
  fn main() {
      let v: Vec<i32> = (1..=10)
          .filter(|x| {
              println!("bakılan: {x}");
              x % 3 == 0
          })
          .take(2)
          .collect();
      println!("{v:?}");
  }
options:
  - |
    bakılan: 1
    bakılan: 2
    bakılan: 3
    bakılan: 4
    bakılan: 5
    bakılan: 6
    [3, 6]
  - |
    bakılan: 1
    bakılan: 2
    bakılan: 3
    bakılan: 4
    bakılan: 5
    bakılan: 6
    bakılan: 7
    bakılan: 8
    bakılan: 9
    bakılan: 10
    [3, 6]
  - |
    [3, 6]
answer: 0
explanation: |
  Zincir tembel ve eleman eleman çalışır. `take(2)` ikinci elemanı (6) aldığı anda biter ve `filter`'a bir
  daha sormaz; 7-10 hiç incelenmez. Elemanlar toplu değil, tek tek akar.
```

```predict
code: |
  fn main() {
      let sonuc: Vec<String> = (0..10)
          .step_by(3)
          .zip("abcd".chars().rev())
          .map(|(n, c)| format!("{c}{n}"))
          .collect();
      println!("{sonuc:?}");
  }
options:
  - "[\"a0\", \"b3\", \"c6\", \"d9\"]"
  - "[\"d0\", \"c3\", \"b6\", \"a9\"]"
  - "[\"d0\", \"c1\", \"b2\", \"a3\"]"
  - "[\"d0\", \"c3\", \"b6\"]"
answer: 1
explanation: |
  `(0..10).step_by(3)` → 0, 3, 6, 9 (ilk eleman dahil, her 3'te bir). `"abcd".chars().rev()` → d, c, b, a.
  `zip` ikisini eşleştirir; ikisi de 4 elemanlı olduğu için 4 çift çıkar: `(0,'d')`, `(3,'c')`, `(6,'b')`, `(9,'a')`.
```

```quiz
question: "`let mut v = vec![String::from(\"a\")];` için aşağıdaki döngülerin hangisinde döngüden **sonra** `v` artık kullanılamaz?"
options:
  - "`for s in &v { }`"
  - "`for s in v.iter_mut() { s.push('!'); }`"
  - "`for s in v { }`"
  - "`for s in v.iter() { }`"
answer: 2
explanation: |
  `for s in v` → `v.into_iter()`: vektörün sahipliği alınır ve tüketilir; sonra `v`'yi kullanmak E0382 verir.
  Diğerleri vektörü ödünç alır (`&T` ya da `&mut T` verir) ve döngü bitince ödünç de biter.
feedback:
  - "`&v` ödünç alır; döngüden sonra `v` duruyor."
  - "`iter_mut` değiştirilebilir ödünç alır; `v` döngüden sonra kullanılabilir."
  - Doğru! `into_iter` koleksiyonu tüketir.
  - "`iter()` ödünç alır."
```

```fill
prompt: |
  Bir kitap kulübünün okuma listeleri var. Bütün listelerdeki kitapları tek bir akışa düzleştir, 300 sayfadan
  kısa olanları al ve adlarını topla. Program `["Çalıkuşu", "Kuyucaklı Yusuf"]` yazdırmalı.
code: |
  fn main() {
      let listeler = vec![
          vec![("Çalıkuşu", 288), ("Tutunamayanlar", 724)],
          vec![("Kuyucaklı Yusuf", 216)],
      ];
      let kisalar: Vec<&str> = listeler
          .iter()
          .___0(|liste| liste.iter())
          .filter(|(_, sayfa)| *sayfa < 300)
          .___1(|(ad, _)| *ad)
          .collect();
      println!("{kisalar:?}");
  }
blanks:
  - ["flat_map"]
  - ["map"]
output: "[\"Çalıkuşu\", \"Kuyucaklı Yusuf\"]"
explanation: |
  `flat_map` her listenin iterator'ını tek bir akışa düzleştirir: öğeler `&(&str, i32)` olur. `filter`'ın
  closure'ı bunu bir kez daha ödünç alır; `(_, sayfa)` deseni `sayfa`'yı `&i32` olarak bağlar, `*sayfa < 300`
  karşılaştırır. Son `map` `&str`'yi dışarı çıkarır.
```

## Tüketiciler, collect ve kendi iterator'ın

```predict
code: |
  fn main() {
      let notlar = [55, 90, 72, 90, 41];
      let ilk_doksan = notlar.iter().position(|&n| n == 90);
      let en_yuksek = notlar.iter().enumerate().max_by_key(|(_, n)| **n);
      let bos: [i32; 0] = [];
      let hepsi = bos.iter().all(|&n| n > 100);
      println!("{ilk_doksan:?} {en_yuksek:?} {hepsi}");
  }
options:
  - "Some(1) Some((1, 90)) false"
  - "Some(1) Some((3, 90)) true"
  - "Some(3) Some((3, 90)) true"
  - "Some(1) Some((1, 90)) true"
answer: 1
explanation: |
  `position` koşulu sağlayan **ilk** indeksi verir: 1. `max_by_key` eşitlikte **sonuncuyu** döndürür, bu
  yüzden ikinci 90'ın çifti `(3, 90)` gelir. Boş bir iterator'da `all` her zaman `true`'dur (boş doğruluk).
```

```quiz
question: |
  `let r: Result<Vec<u8>, _> = ["7", "300", "x"].iter().map(|s| s.parse::<u8>()).collect();` sonrası `r` nedir?
options:
  - "`Ok([7])` — hatalılar atlanır"
  - "`Err(...)` — `\"300\"` `u8`'e sığmadığı için; `\"x\"` hiç ayrıştırılmaz"
  - "`Err(...)` — `\"x\"` geçersiz olduğu için"
  - Program panikler
answer: 1
explanation: |
  `Result`'a toplamak ilk `Err`'de durur. `"300"` `u8`'in sınırını (255) aştığı için `parse` hata döndürür
  (Modül 2: tamsayı aralıkları) ve `collect` hemen onu sonuç yapar; `"x"`'e sıra gelmez. Hataları atlamak
  isteseydin `filter_map(|s| s.parse().ok())` kullanırdın.
feedback:
  - Hataları sessizce atlayan `filter_map`'tir; `Result`'a `collect` atlamaz.
  - Doğru! İlk hata kazanır, gerisi işlenmez.
  - "`\"x\"`'e hiç gelinmez; zincir `\"300\"`'de durur."
  - "`parse` panik atmaz, `Err` döndürür."
```

```compiles
code: |
  fn ilk_kelime(metin: &str) -> Option<&str> {
      metin.split_whitespace().next()
  }

  fn main() {
      let cumle = String::from("  Rust harika  ");
      let k = ilk_kelime(&cumle);
      println!("{k:?}");
  }
answer: true
explanation: |
  (Modül 12 tekrarı) Tek bir referans girdisi olduğu için elision kuralı dönüşteki `&str`'nin yaşam süresini
  `metin`'e bağlar. `split_whitespace()` metnin içine işaret eden dilimler üreten bir iterator'dır; `next()`
  ilkini `Option<&str>` olarak verir. `cumle` `k` kullanılırken hâlâ yaşadığı için her şey güvenli.
```

```parsons
prompt: |
  `GeriSayim` için `Iterator`'ı uygula: `GeriSayim { kalan: 3 }` → 3, 2, 1 verip bitsin. Program `[3, 2, 1]` yazdırır.
lines: |
  struct GeriSayim {
      kalan: u32,
  }
  impl Iterator for GeriSayim {
      type Item = u32;
      fn next(&mut self) -> Option<u32> {
          if self.kalan == 0 {
              return None;
          }
          self.kalan -= 1;
          Some(self.kalan + 1)
      }
  }
  fn main() {
      let v: Vec<u32> = GeriSayim { kalan: 3 }.collect();
      println!("{v:?}");
  }
distractors: |
      fn next(&self) -> Option<u32> {
      type Item = Option<u32>;
explanation: |
  `next` durumu değiştirdiği için `&mut self` almalı. `Item` elemanın kendisinin tipidir (`u32`); `Option`'ı
  `next`'in dönüş tipi zaten ekler. `collect`'i biz yazmadık — varsayılan metot.
```

## Son sınav: üç görev

```exercise
id: m14-boss-harf-notu
title: Harf notu fabrikası
difficulty: 3
prompt: |
  Her okul kendi not baremini kullanıyor. `barem_olustur(sinirlar: Vec<(u32, char)>) -> impl Fn(u32) -> char`
  bir **barem closure'ı** üretsin:

  - `sinirlar` `(alt sınır, harf)` çiftleridir ve **büyükten küçüğe sıralı** gelir, ör. `[(85, 'A'), (70, 'B'), (50, 'C')]`.
  - Closure bir puan alır ve alt sınırını karşıladığı (`puan >= alt sınır`) **ilk** çiftin harfini döndürür.
  - Hiçbirini karşılamıyorsa `'F'` döndürür.

  Closure defalarca çağrılabilmeli (`Fn`). Bir iterator tüketicisiyle (`find` gibi) çöz.
starter: |
  fn barem_olustur(sinirlar: Vec<(u32, char)>) -> impl Fn(u32) -> char {
      // Yer tutucu: bunu sinirlar'ı kullanan bir closure ile değiştir.
      |_puan| todo!()
  }

  fn main() {
      let barem = barem_olustur(vec![(85, 'A'), (70, 'B'), (50, 'C')]);
      println!("{} {} {}", barem(92), barem(70), barem(12));
  }
solution: |
  fn barem_olustur(sinirlar: Vec<(u32, char)>) -> impl Fn(u32) -> char {
      move |puan| {
          sinirlar
              .iter()
              .find(|(alt, _)| puan >= *alt)
              .map(|(_, harf)| *harf)
              .unwrap_or('F')
      }
  }

  fn main() {
      let barem = barem_olustur(vec![(85, 'A'), (70, 'B'), (50, 'C')]);
      println!("{} {} {}", barem(92), barem(70), barem(12));
  }
check: tests
tests: |
  #[test]
  fn temel_barem() {
      let b = barem_olustur(vec![(85, 'A'), (70, 'B'), (50, 'C')]);
      assert_eq!(b(92), 'A', "92 ≥ 85 → A");
      assert_eq!(b(84), 'B', "84 → B");
      assert_eq!(b(50), 'C', "sınır dahil: 50 → C");
      assert_eq!(b(49), 'F', "hiçbir sınırı karşılamayan F alır");
  }

  #[test]
  fn farkli_okullar_bagimsiz() {
      let kolej = barem_olustur(vec![(90, 'A'), (60, 'D')]);
      let lise = barem_olustur(vec![(50, 'P')]);
      assert_eq!(kolej(75), 'D');
      assert_eq!(lise(75), 'P', "her barem kendi sınırlarını kullanmalı");
  }

  #[test]
  fn bos_barem_hep_f() {
      let b = barem_olustur(Vec::new());
      assert_eq!((b(0), b(100)), ('F', 'F'), "sınır yoksa her puan F");
  }
hints:
  - "Dönen closure `sinirlar` vektörünü sahiplenmeli (fonksiyon bitince yok olacak): `move |puan| { ... }`."
  - "`sinirlar.iter().find(|(alt, _)| puan >= *alt)` ilk uyan çifti `Option<&(u32, char)>` olarak verir."
  - "`.map(|(_, harf)| *harf).unwrap_or('F')` — bulunduysa harf, bulunmadıysa F."
require:
  - pattern: "move\\s*\\|"
    message: "Closure `sinirlar`'ı sahiplenmeli: `move` kullan."
explanation: |
  `move` vektörü closure'ın içine taşır; closure onu sadece **okuduğu** (`iter()`) için `Fn`'dir ve defalarca
  çağrılabilir. Her `barem_olustur` çağrısı kendi vektörünü taşıyan yeni bir closure üretir, bu yüzden
  baremler bağımsızdır.

  `find` + `map` + `unwrap_or` üçlüsü "ilk uyanı bul, içinden bir alan çıkar, yoksa varsayılan" kalıbının
  idiomatik hâlidir. Sınırların sıralı gelmesi önemli: `find` ilk uyanda durduğu için sıra, önceliği belirler.
```

```exercise
id: m14-boss-taksit-plani
title: Taksit planı iterator'ı
difficulty: 4
prompt: |
  Bir mağaza borcu eşit taksitlere bölüyor; son taksit kalan ne kadarsa o kadar. `TaksitPlani` için `Iterator`
  uygula: her `next()` sıradaki taksit tutarını versin.

  - `TaksitPlani::yeni(1000, 300)` → 300, 300, 300, 100.
  - `TaksitPlani::yeni(900, 300)` → 300, 300, 300 (sıfır tutarlı taksit olmaz).
  - Borç 0 ise ya da `taksit` 0 ise plan **boş** olmalı (sonsuz döngü olmamalı!).

  Testler bedava metotları da kullanıyor: `sum`, `count`, `enumerate`, `last`.
starter: |
  struct TaksitPlani {
      kalan: u32,
      taksit: u32,
  }

  impl TaksitPlani {
      fn yeni(borc: u32, taksit: u32) -> TaksitPlani {
          TaksitPlani { kalan: borc, taksit }
      }
  }

  impl Iterator for TaksitPlani {
      type Item = u32;

      fn next(&mut self) -> Option<u32> {
          todo!()
      }
  }

  fn main() {
      let plan: Vec<u32> = TaksitPlani::yeni(1000, 300).collect();
      println!("{plan:?}");
  }
solution: |
  struct TaksitPlani {
      kalan: u32,
      taksit: u32,
  }

  impl TaksitPlani {
      fn yeni(borc: u32, taksit: u32) -> TaksitPlani {
          TaksitPlani { kalan: borc, taksit }
      }
  }

  impl Iterator for TaksitPlani {
      type Item = u32;

      fn next(&mut self) -> Option<u32> {
          if self.kalan == 0 || self.taksit == 0 {
              return None;
          }
          let odenecek = self.kalan.min(self.taksit);
          self.kalan -= odenecek;
          Some(odenecek)
      }
  }

  fn main() {
      let plan: Vec<u32> = TaksitPlani::yeni(1000, 300).collect();
      println!("{plan:?}");
  }
check: tests
tests: |
  #[test]
  fn son_taksit_kalan_kadar() {
      let plan: Vec<u32> = TaksitPlani::yeni(1000, 300).collect();
      assert_eq!(plan, vec![300, 300, 300, 100], "son taksit kalan 100 TL olmalı");
  }

  #[test]
  fn tam_bolunen_borc() {
      let plan: Vec<u32> = TaksitPlani::yeni(900, 300).collect();
      assert_eq!(plan, vec![300, 300, 300], "sıfır tutarlı ek taksit olmamalı");
  }

  #[test]
  fn toplam_borca_esit() {
      assert_eq!(TaksitPlani::yeni(12_345, 1_000).sum::<u32>(), 12_345, "taksitlerin toplamı borca eşit olmalı");
      assert_eq!(TaksitPlani::yeni(12_345, 1_000).count(), 13, "12 tam taksit + 1 kalan");
  }

  #[test]
  fn son_taksitin_sirasi() {
      assert_eq!(TaksitPlani::yeni(1000, 300).enumerate().last(), Some((3, 100)), "4. taksit (indeks 3) 100 TL");
  }

  #[test]
  fn bos_planlar() {
      assert_eq!(TaksitPlani::yeni(0, 300).next(), None, "borç yoksa taksit yok");
      assert_eq!(TaksitPlani::yeni(500, 0).next(), None, "taksit 0 ise plan boş olmalı, sonsuz döngü değil");
  }

  #[test]
  fn borctan_buyuk_taksit() {
      let plan: Vec<u32> = TaksitPlani::yeni(250, 1000).collect();
      assert_eq!(plan, vec![250], "taksit borçtan büyükse tek ödeme");
  }
hints:
  - "`next`'in başında bitiş koşullarını ele al: `kalan == 0` ya da `taksit == 0` → `None`."
  - "Bu adımda ödenecek tutar, kalan ile taksitten küçük olanı: `self.kalan.min(self.taksit)`."
  - "Tutarı kalandan düş (`self.kalan -= odenecek;`) ve `Some(odenecek)` döndür."
explanation: |
  `min` tek satırda iki durumu birden çözüyor: kalan borç taksitten büyükse tam taksit, küçükse kalanın
  tamamı. `kalan` her adımda pozitif bir miktar azaldığı için iterator mutlaka biter; `taksit == 0` kontrolü
  ise sıfır ilerleme yapan (ve dolayısıyla sonsuza kadar `Some(0)` üreten) bir planı engeller. Bir iterator
  yazarken her zaman sor: **bu iterator biter mi?**

  `sum`, `count`, `enumerate` ve `last`'ı yazmadık; `next` doğru olduğu için hepsi doğru çalışıyor. İstersen
  bu planı `TaksitPlani::yeni(...).zip(1..)` ile ay numaralarıyla eşleştirip bir ödeme takvimi basabilirsin.
```

```exercise
id: m14-boss-en-sik-kelime
title: En sık geçen kelime
difficulty: 4
prompt: |
  Bir metinde **en sık geçen kelimeyi** ve sayısını bulan `en_sik_kelime(metin: &str) -> Option<(String, usize)>`
  fonksiyonunu yaz:

  - Kelimeler boşluklarla ayrılır (`split_whitespace`) ve **küçük harfe** çevrilerek sayılır ("Rust" ile "rust" aynı).
  - Eşit sayıda geçen kelimeler varsa **alfabetik olarak önce gelen** seçilir.
  - Metin boşsa (ya da sadece boşluksa) `None`.

  Sayım için Modül 9'daki `HashMap` + `entry` API'sini, seçim için bir tüketiciyi (`max_by` gibi) kullan.
  (Basitlik için noktalama işaretlerini dert etme; Türkçe `İ`/`ı` incelikleri de testlerde yok.)
starter: |
  use std::collections::HashMap;

  fn en_sik_kelime(metin: &str) -> Option<(String, usize)> {
      todo!()
  }

  fn main() {
      println!("{:?}", en_sik_kelime("bir berber bir berbere gel beraber"));
  }
solution: |
  use std::collections::HashMap;

  fn en_sik_kelime(metin: &str) -> Option<(String, usize)> {
      let mut sayac: HashMap<String, usize> = HashMap::new();
      for kelime in metin.split_whitespace() {
          *sayac.entry(kelime.to_lowercase()).or_insert(0) += 1;
      }
      sayac
          .into_iter()
          .max_by(|(k1, s1), (k2, s2)| s1.cmp(s2).then(k2.cmp(k1)))
  }

  fn main() {
      println!("{:?}", en_sik_kelime("bir berber bir berbere gel beraber"));
  }
check: tests
tests: |
  #[test]
  fn en_sik_bulunur() {
      assert_eq!(
          en_sik_kelime("bir berber bir berbere gel beraber"),
          Some((String::from("bir"), 2)),
          "\"bir\" iki kez geçiyor"
      );
  }

  #[test]
  fn buyuk_kucuk_harf_ayni() {
      assert_eq!(
          en_sik_kelime("Rust rust RUST go"),
          Some((String::from("rust"), 3)),
          "kelimeler küçük harfe çevrilerek sayılmalı"
      );
  }

  #[test]
  fn esitlikte_alfabetik_once() {
      assert_eq!(
          en_sik_kelime("zeytin elma zeytin elma armut"),
          Some((String::from("elma"), 2)),
          "elma ve zeytin 2'şer kez: alfabetik olarak önce gelen elma seçilmeli"
      );
      assert_eq!(en_sik_kelime("c b a"), Some((String::from("a"), 1)), "hepsi 1 kez: a seçilmeli");
  }

  #[test]
  fn bos_metin() {
      assert_eq!(en_sik_kelime(""), None, "boş metinde kelime yok");
      assert_eq!(en_sik_kelime("   "), None, "sadece boşluk da boş sayılır");
  }
hints:
  - "Önce say: `for kelime in metin.split_whitespace() { *sayac.entry(kelime.to_lowercase()).or_insert(0) += 1; }` (ya da aynı işi `fold` ile)."
  - "Sonra `sayac.into_iter()` `(String, usize)` çiftleri verir; `max_by` ile seç. Boş haritada `max_by` zaten `None` döner."
  - "Karşılaştırma: önce sayıya göre (`s1.cmp(s2)`), eşitse kelimeye göre **ters** (`k2.cmp(k1)`), çünkü `max` alfabetik olarak *küçük* olanı seçmeli: `s1.cmp(s2).then(k2.cmp(k1))`."
require:
  - pattern: "max_by|max_by_key|min_by|min_by_key|fold"
    message: "En sık kelimeyi bir tüketiciyle (`max_by` gibi) seç."
explanation: |
  İki aşamalı bir çözüm: önce **sayım** (harita), sonra **seçim** (tüketici). `HashMap`'in gezme sırası
  rastgele olduğundan (Modül 9), eşitlik kuralını karşılaştırmanın içine gömmek zorundayız; aksi hâlde sonuç
  çalıştırmadan çalıştırmaya değişebilirdi. `Ordering::then` (Modül 9'daki çok kriterli sıralama) "eşitse şuna bak" demektir.
  Kelimeleri ters karşılaştırmamızın nedeni: `max_by` en **büyük**ü seçer, biz ise alfabetik olarak en
  **küçük** kelimeyi istiyoruz.

  `into_iter()` haritayı tükettiği için `String` anahtarları kopyalamadan sonuca taşıyabildik. `max_by` boş
  bir iterator'da `None` döndürdüğü için boş metin ayrıca ele alınmadı.

  Alternatif: `max_by_key(|(k, s)| (*s, std::cmp::Reverse(k.clone())))` — Modül 9'daki `Reverse` sıralamayı ters çevirir,
  ama `clone` gerektirir. `max_by` sürümü kopyasızdır.
```
