---
id: m22-boss
title: "Boss: Tip Sistemi Ustası"
minutes: 45
type: boss
objectives:
  - Operatör trait'leri, ilişkili tipler, tam nitelikli sözdizimi ve supertrait'leri karışık sorularda doğru uygulayabilmek
  - "`!`, DST'ler, `?Sized`, fonksiyon işaretçileri ve `for<'a>` içeren kodun derlenip derlenmeyeceğini ve çıktısını öngörebilmek"
  - "`PhantomData`, newtype ve operatör aşırı yüklemeyle tip güvenli API'leri testleri geçecek şekilde sıfırdan yazabilmek"
keywords: [boss, operatör aşırı yükleme, ilişkili tip, supertrait, newtype, DST, Sized, fn pointer, HRTB, PhantomData, marker trait, RPITIT]
---

Tip sisteminin en derin köşelerini gezdin: operatörler, ilişkili tipler, supertrait'ler, DST'ler, fonksiyon
işaretçileri, `for<'a>`, `PhantomData` ve RPITIT. Şimdi hepsini karışık sorularla sınama zamanı. Araya
önceki modüllerden (closure'lar, thread'ler) sorular da serpiştirildi. Geçmek için **%80** gerekiyor.

Her soruda kendine şunu sor: *“Derleyici bu noktada hangi tipi görüyor ve o tip hangi trait'leri
uyguluyor?”*

## Operatörler ve ilişkili tipler

```predict
code: |
  use std::ops::{Add, AddAssign, Mul};

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct V(i32, i32);

  impl Add for V {
      type Output = V;
      fn add(self, o: V) -> V {
          V(self.0 + o.0, self.1 + o.1)
      }
  }

  impl Mul<i32> for V {
      type Output = V;
      fn mul(self, k: i32) -> V {
          V(self.0 * k, self.1 * k)
      }
  }

  impl AddAssign for V {
      fn add_assign(&mut self, o: V) {
          *self = *self + o;
      }
  }

  fn main() {
      let mut p = V(1, 2);
      let h = V(3, -1);
      p += h * 2;
      p = p + V(0, 10);
      println!("{p:?} {}", p == V(7, 10));
  }
options:
  - "V(7, 10) true"
  - "V(7, 10) false"
  - "V(4, 11) false"
  - "Derlenmez: `h * 2` için `Mul<V> for i32` de gerekir"
answer: 0
explanation: |
  `h * 2` → `Mul<i32> for V` → `V(6, -2)`. `p += ...` → `AddAssign` → `V(7, 0)`. Sonra `p + V(0, 10)` →
  `V(7, 10)`. `==` derive edilmiş `PartialEq`'ten gelir ve `true` verir. `2 * h` yazsaydık `Mul<V> for i32`
  gerekirdi; `h * 2` için `Mul<i32> for V` yeterli. Operatörlerin sol tarafı `self`'tir.
```

```compiles
code: |
  use std::ops::Add;

  #[derive(Debug)]
  struct Para(i64);

  impl Add for Para {
      type Output = Para;
      fn add(self, diger: Para) -> Para {
          Para(self.0 + diger.0)
      }
  }

  fn main() {
      let a = Para(1500);
      let b = Para(250);
      let toplam = a + b;
      println!("{} + {} = {:?}", a.0, b.0, toplam);
  }
answer: false
error: E0382
explanation: |
  `a + b` aslında `Add::add(a, b)` çağrısıdır ve `add` `self`'i **değer olarak** alır. `Para` `Copy`
  olmadığı için `a` ve `b` taşınır, ardından `a.0` okunamaz (E0382). Çözümler: `#[derive(Clone, Copy)]`
  eklemek ya da `impl Add for &Para` yazıp `&a + &b` kullanmak.
```

```quiz
question: "`Iterator` neden `type Item` (ilişkili tip) kullanırken `Add` sağ taraf için generic bir `Rhs` parametresi kullanır?"
options:
  - "Tarihsel bir tesadüf; ikisi birbirinin yerine kullanılabilir"
  - "Bir tip yalnızca **tek** bir öğe tipiyle iterator olur, ama birden çok sağ taraf tipiyle toplanabilir (`Para + Para`, `Para + i64`); generic parametre bir tipin trait'i birden çok kez uygulamasına izin verir"
  - "İlişkili tipler yalnızca standart kütüphanede kullanılabilir"
  - "Generic parametreler daha hızlıdır, ilişkili tipler dinamik dispatch kullanır"
answer: 1
explanation: |
  Kural: “Bir uygulayıcı için **tek** doğru cevap var mı?” Evet ise ilişkili tip (`Item`, `Output`).
  “Aynı tip için birden çok impl anlamlı mı?” Evet ise generic parametre (`Add<Rhs>`, `PartialEq<Rhs>`,
  `From<T>`). `Add`'in `Output`'u da ilişkili tiptir, çünkü belirli bir `Rhs` için sonuç tipi tek olmalıdır.
feedback:
  - "Tesadüf değil; ilişkili tip “tek uygulama”, generic “çok uygulama” demektir."
  - "Doğru!"
  - "Kendi trait'lerinde de ilişkili tip tanımlayabilirsin (`type Output;`)."
  - "İkisi de derleme zamanında çözülür; dispatch ile ilgisi yok."
```

## Tam nitelikli sözdizimi, supertrait'ler ve newtype

```predict
code: |
  trait Ogretmen {
      fn unvan(&self) -> String;
      fn kod() -> u32;
  }

  trait Mudur {
      fn unvan(&self) -> String;
  }

  struct Ayse;

  impl Ayse {
      fn unvan(&self) -> String {
          String::from("Ayşe Hanım")
      }
      fn kod() -> u32 {
          1
      }
  }

  impl Ogretmen for Ayse {
      fn unvan(&self) -> String {
          String::from("Fizik öğretmeni")
      }
      fn kod() -> u32 {
          42
      }
  }

  impl Mudur for Ayse {
      fn unvan(&self) -> String {
          String::from("Okul müdürü")
      }
  }

  fn main() {
      let a = Ayse;
      println!("{}", a.unvan());
      println!("{}", Mudur::unvan(&a));
      println!("{} {}", Ayse::kod(), <Ayse as Ogretmen>::kod());
  }
options:
  - |
    Ayşe Hanım
    Okul müdürü
    1 42
  - |
    Fizik öğretmeni
    Okul müdürü
    42 42
  - Derlenmez; `a.unvan()` belirsizdir (E0034)
answer: 0
explanation: |
  Tipin kendi (inherent) metodu varsa `a.unvan()` önce onu seçer: “Ayşe Hanım”. `Mudur::unvan(&a)`
  trait'i açıkça seçer. `self` almayan `kod()` için `Ayse::kod()` yine inherent fonksiyonu çağırır;
  trait'teki versiyonu istemenin tek yolu tam nitelikli sözdizimidir: `<Ayse as Ogretmen>::kod()`.
  E0034 yalnızca inherent metot **yokken** iki trait metodu çakışırsa çıkar.
```

```compiles
code: |
  use std::fmt;

  trait Rapor: fmt::Display {
      fn rapor(&self) -> String {
          format!("[RAPOR] {self}")
      }
  }

  struct Hava(i32);

  impl Rapor for Hava {}

  fn main() {
      println!("{}", Hava(23).rapor());
  }
answer: false
error: E0277
explanation: |
  `Rapor`'un supertrait'i `Display`. `Hava` için `Rapor`'u uygulamadan önce `Display`'i de uygulamak
  gerekir; aksi hâlde E0277 (“`Hava` doesn't implement `std::fmt::Display`”). Varsayılan metot
  `{self}` yazabiliyor, çünkü supertrait sayesinde `Self: Display` olduğu garanti.
```

```fill
prompt: "Yabancı `Vec<String>` tipine yabancı `Display` trait'ini uygulamak için newtype kullan. Boşlukları doldur."
code: |
  use std::fmt;

  struct Liste(Vec<String>);

  impl fmt::Display for ___0 {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "[{}]", self.___1.join(", "))
      }
  }

  fn main() {
      let l = Liste(vec![String::from("çay"), String::from("simit")]);
      println!("{l}");
  }
blanks:
  - ["Liste"]
  - ["0"]
output: "[çay, simit]"
explanation: |
  `impl Display for Vec<String>` orphan rule'a takılır (E0117): Hem trait hem tip başka bir crate'in.
  `Liste` ise bizim tipimiz, o yüzden ona istediğimiz trait'i uygulayabiliriz. İçteki vektöre tuple
  struct alanı olarak `self.0` ile ulaşılır. Newtype'ın çalışma anında maliyeti yoktur.
```

````exercise
id: m22-boss-e-polinom
title: Polinom tipi
difficulty: 3
prompt: |
  Bir matematik uygulaması için tam sayı katsayılı polinomları bir **newtype** ile modelle:
  `Polinom(Vec<i64>)`. Katsayılar düşük dereceden yükseğe tutulur: `Polinom(vec![1, 2, 3])` =
  `1 + 2x + 3x²`. Şunları uygula:

  1. **`impl Add for Polinom`**: katsayıları tek tek toplar. Uzunluklar farklı olabilir; uzun olanın fazla
     katsayıları aynen kalır: `[1, 2] + [10, 20, 30]` = `[11, 22, 30]`.
  2. **`impl Mul<i64> for Polinom`**: bütün katsayıları bir sayıyla çarpar.
  3. **`impl Neg for Polinom`**: bütün katsayıların işaretini çevirir.
  4. **`impl Index<usize> for Polinom`** (`Output = i64`): `p[i]`, `xⁱ`'nin katsayısıdır; tanımlı uzunluğun
     ötesindeki katsayılar **0**'dır (panik yok!).
  5. **`fn degerle(&self, x: i64) -> i64`**: polinomun `x`'teki değeri. Boş polinom 0'dır.
starter: |
  use std::ops::{Add, Index, Mul, Neg};

  #[derive(Debug, Clone, PartialEq)]
  struct Polinom(Vec<i64>);

  impl Polinom {
      fn degerle(&self, x: i64) -> i64 {
          todo!()
      }
  }

  impl Add for Polinom {
      type Output = Polinom;
      fn add(self, diger: Polinom) -> Polinom {
          todo!()
      }
  }

  impl Mul<i64> for Polinom {
      type Output = Polinom;
      fn mul(self, k: i64) -> Polinom {
          todo!()
      }
  }

  impl Neg for Polinom {
      type Output = Polinom;
      fn neg(self) -> Polinom {
          todo!()
      }
  }

  impl Index<usize> for Polinom {
      type Output = i64;
      fn index(&self, i: usize) -> &i64 {
          todo!()
      }
  }

  fn main() {
      let p = Polinom(vec![1, 2, 3]);
      let q = Polinom(vec![0, -2]);
      let r = p + q * 3;
      println!("{r:?} {} {}", r[2], r[9]);
      println!("{}", r.degerle(2));
  }
solution: |
  use std::ops::{Add, Index, Mul, Neg};

  #[derive(Debug, Clone, PartialEq)]
  struct Polinom(Vec<i64>);

  impl Polinom {
      fn degerle(&self, x: i64) -> i64 {
          // Horner: ((a2·x + a1)·x + a0)
          let mut sonuc = 0;
          for &a in self.0.iter().rev() {
              sonuc = sonuc * x + a;
          }
          sonuc
      }
  }

  impl Add for Polinom {
      type Output = Polinom;
      fn add(self, diger: Polinom) -> Polinom {
          let (mut uzun, kisa) = if self.0.len() >= diger.0.len() {
              (self.0, diger.0)
          } else {
              (diger.0, self.0)
          };
          for (i, k) in kisa.into_iter().enumerate() {
              uzun[i] += k;
          }
          Polinom(uzun)
      }
  }

  impl Mul<i64> for Polinom {
      type Output = Polinom;
      fn mul(self, k: i64) -> Polinom {
          Polinom(self.0.into_iter().map(|a| a * k).collect())
      }
  }

  impl Neg for Polinom {
      type Output = Polinom;
      fn neg(self) -> Polinom {
          self * -1
      }
  }

  impl Index<usize> for Polinom {
      type Output = i64;
      fn index(&self, i: usize) -> &i64 {
          self.0.get(i).unwrap_or(&0)
      }
  }

  fn main() {
      let p = Polinom(vec![1, 2, 3]);
      let q = Polinom(vec![0, -2]);
      let r = p + q * 3;
      println!("{r:?} {} {}", r[2], r[9]);
      println!("{}", r.degerle(2));
  }
check: tests
tests: |
  #[test]
  fn farkli_uzunlukta_toplama() {
      let a = Polinom(vec![1, 2]);
      let b = Polinom(vec![10, 20, 30]);
      assert_eq!(a.clone() + b.clone(), Polinom(vec![11, 22, 30]), "Uzun olanın fazla katsayısı kalmalı");
      assert_eq!(b + a, Polinom(vec![11, 22, 30]), "Toplama değişmeli olmalı");
      assert_eq!(Polinom(vec![]) + Polinom(vec![5]), Polinom(vec![5]));
  }

  #[test]
  fn carpma_ve_eksi() {
      assert_eq!(Polinom(vec![1, -2, 3]) * 4, Polinom(vec![4, -8, 12]));
      assert_eq!(-Polinom(vec![1, -2, 0]), Polinom(vec![-1, 2, 0]));
  }

  #[test]
  fn indeks_tasmada_sifir() {
      let p = Polinom(vec![7, 0, -3]);
      assert_eq!(p[0], 7);
      assert_eq!(p[2], -3);
      assert_eq!(p[3], 0, "Tanımlı uzunluğun ötesi 0 olmalı, panik değil");
      assert_eq!(p[100], 0);
  }

  #[test]
  fn degerleme() {
      assert_eq!(Polinom(vec![1, 2, 3]).degerle(2), 17, "1 + 2·2 + 3·4 = 17");
      assert_eq!(Polinom(vec![-4, 0, 1]).degerle(-3), 5, "-4 + 0 + 9 = 5");
      assert_eq!(Polinom(vec![]).degerle(10), 0, "Boş polinom 0'dır");
  }
hints:
  - "`Index`'te `self.0.get(i)` bir `Option<&i64>` verir; `unwrap_or(&0)` ile yoksa sıfıra referans döndür (`&0` gibi sabit literal referansları `'static` olarak yaşar)."
  - "`Add`'de uzun ve kısa vektörü belirle, kısa olanın katsayılarını uzun olanın üstüne ekle: `for (i, k) in kisa.into_iter().enumerate() { uzun[i] += k; }`. `Neg` için `self * -1` yeterli."
  - "`degerle` için Horner yöntemi: katsayıları **sondan başa** dolaş, `sonuc = sonuc * x + a`. `self.0.iter().rev()` işini görür."
explanation: |
  `Polinom` bir newtype: `Vec<i64>`'e kendi anlamını ve operatörlerini kazandırdık. `Vec`'e doğrudan
  `Add` uygulayamazdık (orphan rule), üstelik vektörleri toplamak her bağlamda “katsayı katsayı” demek
  değildir.

  `Index` her zaman bir **referans** döndürür (`&Self::Output`). Olmayan katsayılar için `&0` döndürmek
  mümkün, çünkü sabit bir literal'in referansı `'static` yaşar (rvalue static promotion). `Neg`'i `Mul`
  üzerine kurmak tekrarı önledi. `Mul<i64>`'teki `i64` bir generic **parametre** (Rhs), `Output` ise ilişkili
  tip. Aynı `Polinom` için yarın `Mul<Polinom>` da (polinom çarpımı) ekleyebilirsin.

  Horner yöntemi `n` dereceli polinomu `n` çarpma ve `n` toplamayla değerlendirir; her terim için ayrı
  `x.pow(i)` hesaplamaktan hem hızlı hem de taşmaya daha dayanıklıdır.
````

## İleri tipler ve fonksiyonlar

```compiles
code: |
  fn bayt_sayisi<T: AsRef<[u8]>>(x: &T) -> usize {
      x.as_ref().len()
  }

  fn main() {
      println!("{}", bayt_sayisi("merhaba"));
  }
answer: false
error: E0277
explanation: |
  `"merhaba"` bir `&str`; `x: &T` ile eşleşince `T = str` olur. `str` `AsRef<[u8]>`'i uygular ama bir
  **DST**'dir ve her generic parametrede örtük `T: Sized` sınırı vardır. Düzeltme:
  `fn bayt_sayisi<T: AsRef<[u8]> + ?Sized>(x: &T)`.
```

```predict
code: |
  fn ikiye(x: i32) -> i32 {
      x * 2
  }

  fn eksi(x: i32) -> i32 {
      -x
  }

  fn main() {
      let tablo: [fn(i32) -> i32; 2] = [ikiye, eksi];
      let girdiler = ["3", "x", "5"];
      let mut sonuc = Vec::new();
      for (i, g) in girdiler.iter().enumerate() {
          let n: i32 = match g.parse() {
              Ok(n) => n,
              Err(_) => continue,
          };
          sonuc.push(tablo[i % 2](n));
      }
      println!("{sonuc:?}");
  }
options:
  - "[6, 10]"
  - "[6, -5]"
  - "[6, -10]"
  - "Derlenmez; `match` kollarının tipleri farklı"
answer: 0
explanation: |
  `continue`'nun tipi `!`'dir ve `i32`'ye dönüşür, bu yüzden `match` derlenir. `"x"` atlanır ama `i`
  yine de artar: `i = 0` → `"3"` → `tablo[0]` = `ikiye` → 6; `i = 2` → `"5"` → `tablo[0]` → 10.
  İki fonksiyon öğesi, dizinin tipi `[fn(i32) -> i32; 2]` olduğu için aynı işaretçi tipine dönüştü.
```

```quiz
question: "`fn uygula<F: Fn(&str) -> &str>(f: F)` imzasındaki sınır aslında neyin kısaltmasıdır?"
options:
  - "`F: Fn(&'static str) -> &'static str`"
  - "`F: for<'a> Fn(&'a str) -> &'a str`; her yaşam süresi için geçerli"
  - "`fn uygula<'a, F: Fn(&'a str) -> &'a str>(f: F)`; `'a`'yı çağıran seçer"
  - "Hiçbirinin; `Fn` sınırlarında yaşam süreleri yok sayılır"
answer: 1
explanation: |
  `Fn(..)` sözdiziminde elision bir **yüksek dereceli** sınır üretir: `for<'a>`. Bu yüzden `uygula` `f`'i
  kendi içindeki yerel bir `String`'den alınmış `&str` ile çağırabilir. Üçüncü seçenekteki gibi `'a`
  dışarıdan seçilseydi, yerel değişkenin ödüncü o `'a` kadar yaşayamaz ve E0597 alınırdı.
feedback:
  - "`'static` gerekmez; HRTB her yaşam süresini kabul eder."
  - "Doğru!"
  - "Bu farklı bir anlamdır: `'a` tek ve dışarıdan seçilmiş olur; yerel ödünçler verilemez."
  - "Yaşam süreleri yok sayılmaz; elision kuralları uygulanır."
```

```compiles
question: "(Modül 14 tekrarı) Derlenir mi?"
code: |
  fn main() {
      let kdv = 20;
      let hesapla: fn(i32) -> i32 = |fiyat| fiyat + fiyat * kdv / 100;
      println!("{}", hesapla(150));
  }
answer: false
error: E0308
explanation: |
  Closure `kdv`'yi **yakalıyor**. Yakalayan closure'ların taşıyacak verisi vardır, bu yüzden 8 baytlık
  bir kod adresine (`fn` işaretçisine) dönüşemezler: “closures can only be coerced to `fn` types if they
  do not capture any variables”. Çözüm: Değişkenin tipini yazmamak (`let hesapla = |fiyat| ...`) ya da
  `impl Fn(i32) -> i32` kabul eden bir fonksiyona vermek.
```

## PhantomData, marker trait'ler ve RPITIT

```compiles
code: |
  enum Ogrenci {}

  struct Kimlik<T> {
      no: u64,
  }

  fn main() {
      let k = Kimlik::<Ogrenci> { no: 2024001 };
      println!("{}", k.no);
  }
answer: false
error: E0392
explanation: |
  `T` hiçbir alanda kullanılmıyor (“type parameter `T` is never used”). Derleyici `T`'nin struct'la
  ilişkisini bilmek ister. Çözüm: `tur: std::marker::PhantomData<T>` gibi sıfır baytlık bir marker alan.
```

```quiz
question: "Aşağıdaki ifadelerden hangileri **doğrudur**?"
options:
  - "Bir trait metodu `-> impl Iterator<..>` döndürüyorsa (RPITIT) o trait `dyn Trait` olarak kullanılamaz"
  - "`PhantomData<String>` bir `String` kadar (24 bayt) yer kaplar"
  - "Sealed bir trait, crate'in dışında generic sınır olarak (`T: ParaBirimi`) kullanılabilir ama uygulanamaz"
  - "`Copy` otomatik bir trait'tir; bütün alanları `Copy` olan struct kendiliğinden `Copy` olur"
answer: [0, 2]
explanation: |
  RPITIT'te her impl farklı bir gizli tip döndürdüğü için vtable kurulamaz (E0038). Sealed trait'in
  amacı da tam olarak “kullan ama uygulama”dır. `PhantomData<T>` her zaman 0 bayttır. `Copy` bir marker
  trait'tir ama otomatik değildir; `#[derive(Clone, Copy)]` ile açıkça istenir. Otomatik olanlar `Send`,
  `Sync` ve `Unpin`'dir.
feedback:
  - "Doğru."
  - "Yanlış: `PhantomData` her zaman 0 bayttır; yalnızca derleyiciye bilgi verir."
  - "Doğru."
  - "Yanlış: `Copy` API sözleşmesinin parçasıdır ve `derive` ile açıkça istenir."
```

```predict
question: "(Modül 18 tekrarı) Bu program ne yazdırır?"
code: |
  use std::sync::{Arc, Mutex};
  use std::thread;

  fn main() {
      let sayac = Arc::new(Mutex::new(0));
      let mut tutamaclar = Vec::new();
      for i in 1..=4 {
          let s = Arc::clone(&sayac);
          tutamaclar.push(thread::spawn(move || {
              *s.lock().unwrap() += i;
          }));
      }
      for t in tutamaclar {
          t.join().unwrap();
      }
      println!("{} {}", *sayac.lock().unwrap(), Arc::strong_count(&sayac));
  }
options:
  - "10 1"
  - "10 5"
  - "4 1"
  - "Sonuç her çalıştırmada değişir"
answer: 0
explanation: |
  Thread'ler hangi sırayla çalışırsa çalışsın toplama `Mutex` altında yapılır: 1 + 2 + 3 + 4 = 10.
  Her thread kendi `Arc` klonunu `move` ile sahiplenir ve thread bitince o klon düşer (drop). Hepsi
  `join` edildikten sonra yalnızca `main`'deki `sayac` kalır: `strong_count` = 1. `Arc<Mutex<i32>>`
  `Send`'dir, çünkü `i32` `Send`'dir. Bunu otomatik trait kuralı hesaplar.
```

````exercise
id: m22-boss-e-yayin
title: Ham metinden yayına
difficulty: 4
prompt: |
  Bir haber sitesinde okuyucu yorumları yayınlanmadan önce bir dizi kuraldan geçmeli. Temizlenmemiş bir
  yorumun **yanlışlıkla yayınlanması** derleme hatası olmalı. Bunun için durum tipte tutuluyor:
  `Metin<Ham>` ve `Metin<Temiz>` (`PhantomData`). Kurallar sıradan fonksiyonlar; tipleri bir takma ad:
  `type Kural = fn(&str) -> String;`.

  Tamamla:

  1. **`sadele(s: &str) -> String`**: baştaki/sondaki boşlukları atar, aradaki birden çok boşluğu teke indirir:
     `"  bir   iki  "` → `"bir iki"`.
  2. **`sansurle(s: &str) -> String`**: her `"kötü"` geçişini `"***"` ile değiştirir.
  3. **`standart_kurallar() -> Vec<Kural>`**: sırasıyla `str::to_lowercase`, `sadele`, `sansurle`.
  4. **`Metin::<Ham>::yeni(&str)`** ve **`temizle(self, kurallar: &[Kural]) -> Metin<Temiz>`**: kuralları
     **sırayla** uygular. Kural listesi boşsa içerik değişmez.
  5. **`Metin::<Temiz>::yayinla(&self) -> String`**: `"[YAYIN] içerik"` döndürür. Bu metot `Metin<Ham>`'da
     **yok**; böylece `Metin::yeni("..").yayinla()` derlenmez.
starter: |
  use std::marker::PhantomData;

  enum Ham {}
  enum Temiz {}

  type Kural = fn(&str) -> String;

  struct Metin<D> {
      icerik: String,
      durum: PhantomData<D>,
  }

  fn sadele(s: &str) -> String {
      todo!()
  }

  fn sansurle(s: &str) -> String {
      todo!()
  }

  fn standart_kurallar() -> Vec<Kural> {
      todo!()
  }

  impl Metin<Ham> {
      fn yeni(icerik: &str) -> Self {
          todo!()
      }

      fn temizle(self, kurallar: &[Kural]) -> Metin<Temiz> {
          todo!()
      }
  }

  impl Metin<Temiz> {
      fn yayinla(&self) -> String {
          todo!()
      }
  }

  fn main() {
      let yorum = Metin::yeni("  Bu   KÖTÜ bir   haber ");
      let temiz = yorum.temizle(&standart_kurallar());
      println!("{}", temiz.yayinla());
  }
solution: |
  use std::marker::PhantomData;

  enum Ham {}
  enum Temiz {}

  type Kural = fn(&str) -> String;

  struct Metin<D> {
      icerik: String,
      durum: PhantomData<D>,
  }

  fn sadele(s: &str) -> String {
      s.split_whitespace().collect::<Vec<&str>>().join(" ")
  }

  fn sansurle(s: &str) -> String {
      s.replace("kötü", "***")
  }

  fn standart_kurallar() -> Vec<Kural> {
      vec![str::to_lowercase, sadele, sansurle]
  }

  impl Metin<Ham> {
      fn yeni(icerik: &str) -> Self {
          Metin { icerik: icerik.to_string(), durum: PhantomData }
      }

      fn temizle(self, kurallar: &[Kural]) -> Metin<Temiz> {
          let mut icerik = self.icerik;
          for kural in kurallar {
              icerik = kural(&icerik);
          }
          Metin { icerik, durum: PhantomData }
      }
  }

  impl Metin<Temiz> {
      fn yayinla(&self) -> String {
          format!("[YAYIN] {}", self.icerik)
      }
  }

  fn main() {
      let yorum = Metin::yeni("  Bu   KÖTÜ bir   haber ");
      let temiz = yorum.temizle(&standart_kurallar());
      println!("{}", temiz.yayinla());
  }
check: tests
tests: |
  #[test]
  fn yardimci_kurallar() {
      assert_eq!(sadele("  bir   iki  "), "bir iki");
      assert_eq!(sadele("tek"), "tek");
      assert_eq!(sadele("   "), "", "Yalnızca boşluk boş metne dönmeli");
      assert_eq!(sansurle("kötü kötü"), "*** ***", "Her geçiş sansürlenmeli");
      assert_eq!(sansurle("iyi"), "iyi");
  }

  #[test]
  fn standart_akis() {
      let kurallar = standart_kurallar();
      assert_eq!(kurallar.len(), 3, "Üç kural olmalı");
      let m = Metin::yeni("  Bu   KÖTÜ bir   haber ").temizle(&kurallar);
      assert_eq!(m.yayinla(), "[YAYIN] bu *** bir haber", "Önce küçült, sonra sadele, sonra sansürle");
  }

  #[test]
  fn kural_sirasi_onemli() {
      let kurallar: [Kural; 2] = [sansurle, str::to_uppercase];
      let m = Metin::yeni("kötü kedi").temizle(&kurallar);
      assert_eq!(m.yayinla(), "[YAYIN] *** KEDI");
      let ters: [Kural; 2] = [str::to_uppercase, sansurle];
      let m2 = Metin::yeni("kötü kedi").temizle(&ters);
      assert_eq!(m2.yayinla(), "[YAYIN] KÖTÜ KEDI", "Büyük harfli KÖTÜ sansürden kaçar: sıra önemli");
  }

  #[test]
  fn kuralsiz_temizleme() {
      let m = Metin::yeni(" Aynen  kalsın ").temizle(&[]);
      assert_eq!(m.yayinla(), "[YAYIN]  Aynen  kalsın ", "Kural yoksa içerik değişmemeli");
  }
hints:
  - "`sadele`: `s.split_whitespace()` boşluklarla ayrılmış parçaları verir; `collect::<Vec<&str>>()` ile topla ve `.join(\" \")` ile birleştir. `sansurle`: `s.replace(\"kötü\", \"***\")`."
  - "`standart_kurallar` için fonksiyon **adlarını** bir vektöre koy: `vec![str::to_lowercase, sadele, sansurle]`. Dönüş tipi `Vec<Kural>` olduğu için hepsi `fn(&str) -> String` işaretçisine dönüşür."
  - "`temizle`: `let mut icerik = self.icerik; for kural in kurallar { icerik = kural(&icerik); }` ve sonunda `Metin { icerik, durum: PhantomData }`. Dönüş tipi `Metin<Temiz>` olduğu için `PhantomData`'nın tipi kendiliğinden çıkarılır."
forbid:
  - pattern: "impl\\s*<\\s*D\\s*>\\s*Metin\\s*<\\s*D\\s*>"
    message: "`yayinla`'yı bütün durumlar için (`impl<D> Metin<D>`) tanımlama; yalnızca `Metin<Temiz>` yayınlanabilmeli."
explanation: |
  Bu çözümde modülün üç dersi bir araya geldi:

  - **Tip takma adı (Ders 3)**: `type Kural = fn(&str) -> String;` uzun bir işaretçi tipine anlamlı bir isim verdi.
  - **Fonksiyon işaretçileri ve metot yolları (Ders 4)**: `str::to_lowercase` bir metot, `sadele` serbest bir
    fonksiyon. İkisi de aynı `Vec<Kural>`'a girebildi, çünkü hiçbiri bir şey yakalamıyor.
  - **`PhantomData` (Ders 5)**: `Metin<Ham>` ve `Metin<Temiz>` bellekte aynı, ama `yayinla` yalnızca
    `Metin<Temiz>`'de var:

  ```text
  error[E0599]: no method named `yayinla` found for struct `Metin<Ham>` in the current scope
  ```

  `temizle(self, ..)` `self`'i **tükettiği** için temizlenmeden önceki `Metin<Ham>` artık kullanılamaz:
  Modül 20'deki typestate deseninin `PhantomData`'lı hâli. Ayrı struct'lar yerine tek bir generic struct
  kullanmak, iki durumda da aynı olan alanları ve metotları (`impl<D> Metin<D>`) paylaşmayı kolaylaştırır.

  Testteki `KÖTÜ` tuzağına dikkat: Sansür büyük/küçük harfe duyarlı. Bu yüzden standart sırada önce
  `to_lowercase` geliyor.
````
