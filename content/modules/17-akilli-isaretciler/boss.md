---
id: m17-boss
title: "Boss: İşaretçi Ustası"
minutes: 35
type: boss
objectives:
  - "`Box`, `Deref`, `Drop`, `Rc`, `RefCell`, `Cell` ve `Weak`'i doğru durumda seçip kullanabildiğini göstermek"
  - Akıllı işaretçilerle özyinelemeli yapılar ve döngüsüz paylaşılan durum tasarlayabilmek
keywords: [Box, Deref, Drop, Rc, RefCell, Cell, Weak, E0072, E0594, E0596, referans döngüsü]
---

Modülün son sınavına hoş geldin! Burada yeni bir şey öğretilmeyecek. Bu bölüm, `Box`'tan `Weak`'e kadar
akıllı işaretçileri **kendi başına** seçip kullanıp kullanamadığını ölçüyor. Araya önceki modüllerden
(closure'lar, yaşam süreleri, `?`) birkaç soru da karıştırdık.

Geçmek için puanların en az **%80**'ini toplaman gerekiyor. Her soruda önce şunu sor: **Kaç sahip var?
Kim değiştiriyor? Kurallar ne zaman denetleniyor?**

## Box, Deref ve Drop

```compiles
code: |
  struct Klasor {
      ad: String,
      ust: Option<Klasor>,
  }

  fn main() {
      let k = Klasor { ad: String::from("belgeler"), ust: None };
      println!("{}", k.ad);
  }
answer: false
error: E0072
explanation: |
  `Option<Klasor>` hâlâ bir `Klasor`'ü **doğrudan** içerir. `Option` bir enum'dur ve en büyük varyantı
  kadar yer kaplar; `Some(Klasor)` varyantı da `Klasor` kadar büyüktür. Boyut kendi kendine bağlı olduğu
  için sonsuzdur. Çözüm bir dolaylılık: `ust: Option<Box<Klasor>>` (ya da ebeveyn paylaşılıyorsa
  `Weak<Klasor>`).
```

```predict
code: |
  use std::ops::Deref;

  struct Etiket(String);

  impl Deref for Etiket {
      type Target = String;
      fn deref(&self) -> &String {
          &self.0
      }
  }

  fn bas_harf(s: &str) -> char {
      s.chars().next().unwrap_or('?')
  }

  fn main() {
      let e = Etiket(String::from("ılık süt"));
      let b = Box::new(Etiket(String::new()));
      println!("{} {} {} {}", e.len(), bas_harf(&e), bas_harf(&b), b.is_empty());
  }
options:
  - "11 ı ? true"
  - "8 ı ? true"
  - "11 ı ı false"
  - Derlenmez, çünkü `&b` bir `&Box<Etiket>`
answer: 0
explanation: |
  `e.len()` auto-deref ile `String::len`'e ulaşır ve **bayt** sayar: metinde 8 karakter var ama iki `ı` ve bir `ü` ikişer bayt, toplam 11.
  `bas_harf(&e)`: `&Etiket` → `&String` → `&str`. `bas_harf(&b)` üç adım: `&Box<Etiket>` → `&Etiket` →
  `&String` → `&str`. Boş metnin ilk karakteri yok, `next()` `None` döner ve `unwrap_or('?')` devreye girer.
  `b.is_empty()` da iki kat açılarak `String::is_empty`'ye ulaşır.
```

```compiles
code: |
  use std::ops::{Deref, DerefMut};

  struct Kutum<T>(T);

  impl<T> Deref for Kutum<T> {
      type Target = T;
      fn deref(&self) -> &T {
          &self.0
      }
  }

  impl<T> DerefMut for Kutum<T> {
      fn deref_mut(&mut self) -> &mut T {
          &mut self.0
      }
  }

  fn unlem(k: &Kutum<String>) {
      k.push('!');
  }

  fn main() {
      let mut k = Kutum(String::from("yaşasın"));
      unlem(&k);
      k.push('?');
      println!("{}", *k);
  }
answer: false
error: E0596
explanation: |
  `DerefMut` uygulanmış ama `unlem` yalnızca bir **paylaşılan** referans (`&Kutum<String>`) alıyor. Deref
  zorlaması `&T`'den `&mut U`'ya asla geçmez; paylaşılan referans üzerinden `push` yapılamaz. `main`'deki
  `k.push('?')` ise sorunsuzdur: `k` `mut` bir değişken, `&mut k` → `&mut String` zorlaması geçerlidir.
  Çözüm: `fn unlem(k: &mut Kutum<String>)` ve `unlem(&mut k)`.
```

```predict
code: |
  struct Kayit(&'static str);

  impl Drop for Kayit {
      fn drop(&mut self) {
          println!("-{}", self.0);
      }
  }

  struct Cift {
      _ilk: Kayit,
      _ikinci: Kayit,
  }

  fn main() {
      let _a = Kayit("a");
      let _ = Kayit("b");
      let c = Cift { _ilk: Kayit("c1"), _ikinci: Kayit("c2") };
      let d = Kayit("d");
      drop(d);
      println!("son");
      let _c = c;
  }
options:
  - |
    -b
    -d
    son
    -c1
    -c2
    -a
  - |
    -b
    -d
    son
    -c2
    -c1
    -a
  - |
    -d
    son
    -c1
    -c2
    -b
    -a
  - |
    -b
    -d
    son
    -a
    -c1
    -c2
answer: 0
explanation: |
  `let _ = Kayit("b")` değeri bağlamaz, hemen drop edilir: `-b`. `drop(d)` `d`'yi o an bırakır: `-d`. `c`,
  `_c`'ye taşınır; `_c` en son tanımlanan değişken olduğu için kapsam sonunda **ilk** drop edilen odur.
  Struct'ın alanları ise **tanımlanma sırasıyla** gider: `-c1`, `-c2`. En son `_a`.
```

```quiz
question: Aşağıdakilerden hangisi `Box<T>` için **yanlıştır**?
options:
  - "`Box<T>` `Copy` değildir; atamada taşınır"
  - "`size_of::<Box<[u8; 1000]>>()` 64 bit sistemde 8 bayttır"
  - "`Box<T>`, `T`'yi birden çok sahibin paylaşabilmesini sağlar"
  - "`let s: String = *kutu;` ile bir `Box<String>`'in içindeki değer dışarı taşınabilir"
answer: 2
explanation: |
  `Box` **tek sahiplik** demektir. Birden çok sahip için `Rc<T>` gerekir. Diğerleri doğru: `Box` taşınır
  (tek sahip olduğu için kopyalanamaz), içindeki veri ne kadar büyük olursa olsun kendisi bir adres kadar yer
  kaplar ve `Box`'a özel bir ayrıcalık olarak `*` ile içinden taşıma yapılabilir.
feedback:
  - "Bu doğru: `Box` heap belleğinin tek sahibidir, `Copy` olamaz."
  - "Bu doğru: kutu yalnızca bir adrestir, verinin boyutu önemli değil."
  - "Doğru tespit! Paylaşım `Rc`'nin işidir."
  - "Bu doğru: `Box` içinden taşımaya izin veren tek akıllı işaretçidir."
```

## Rc, RefCell ve Cell

```predict
code: |
  use std::rc::Rc;

  fn main() {
      let harita = Rc::new(String::from("İstanbul"));
      let mut oyuncular = Vec::new();
      for _ in 0..3 {
          oyuncular.push(Rc::clone(&harita));
      }
      println!("{}", Rc::strong_count(&harita));
      oyuncular.truncate(1);
      {
          let izleyici = Rc::clone(&harita);
          println!("{} {}", Rc::strong_count(&izleyici), Rc::ptr_eq(&izleyici, &oyuncular[0]));
      }
      drop(harita);
      println!("{} {}", Rc::strong_count(&oyuncular[0]), oyuncular[0]);
  }
options:
  - |
    4
    3 true
    1 İstanbul
  - |
    3
    2 true
    0 İstanbul
  - |
    4
    3 false
    1 İstanbul
  - |
    4
    5 true
    2 İstanbul
answer: 0
explanation: |
  `harita` + 3 klon = 4. `truncate(1)` iki `Rc`'yi drop eder, sayaç 2 olur. İç blokta `izleyici` ile 3. Hepsi
  aynı kutuyu paylaştığı için `ptr_eq` true. Blok bitince 2, `drop(harita)` ile 1. Değer hâlâ yaşıyor,
  çünkü `oyuncular[0]` son sahip. Yazdırılırken `Rc<String>` içindeki metni gösterir.
```

```compiles
code: |
  use std::rc::Rc;

  fn main() {
      let notlar = Rc::new(vec![70, 85]);
      let kopya = Rc::clone(&notlar);
      kopya.push(90);
      println!("{notlar:?}");
  }
answer: false
error: E0596
explanation: |
  `Rc` yalnızca `Deref` uygular; `push` ise `&mut Vec` ister. Paylaşılan veri doğrudan değiştirilemez,
  çünkü `notlar` ve `kopya` aynı vektörü gösteriyor. Biri değiştirirken diğeri okuyor olabilir. Çözüm:
  `Rc<RefCell<Vec<i32>>>` ve `kopya.borrow_mut().push(90)`. Ya da yalnızca bu `Rc`'nin değişmesi
  yetiyorsa `let mut kopya` yazıp `Rc::make_mut(&mut kopya).push(90)` (yazınca kopyala).
```

```predict
code: |
  use std::cell::RefCell;

  fn main() {
      let stok = RefCell::new(vec![5, 3]);
      {
          let okuyucu = stok.borrow();
          match stok.try_borrow_mut() {
              Ok(mut s) => s.push(1),
              Err(_) => println!("şu an yazılamaz ({} ürün)", okuyucu.len()),
          }
      }
      stok.borrow_mut().push(8);
      let ilk = stok.borrow()[0];
      println!("{ilk} {:?}", stok.borrow());
  }
options:
  - |
    şu an yazılamaz (2 ürün)
    5 [5, 3, 8]
  - |
    5 [5, 3, 1, 8]
  - |
    şu an yazılamaz (2 ürün)
    5 [5, 3, 1, 8]
  - Panik atar, çünkü okuyucu varken yazma isteniyor
answer: 0
explanation: |
  İç blokta bir `Ref` (okuyucu) yaşıyor. `try_borrow_mut` panik atmaz, `Err` döndürür; `push(1)` hiç
  çalışmaz. Blok bitince okuyucu drop edilir. Sonraki `borrow_mut().push(8)` geçici bir koruyucuyla güvenle
  çalışır. `stok.borrow()[0]` da geçici bir `Ref` ile `5`'i kopyalar. Aynı satırda iki geçici `borrow()`
  olsa bile ikisi de okuyucu olduğu için sorun olmazdı.
```

```fill
prompt: |
  Bir sınav uygulamasında soru nesnesi `&self` ile sorgulanıyor ama kaç kez görüntülendiğini (`u32`) ve
  hangi öğrencilerin baktığını (`Vec<String>`) içeride kaydediyor. Doğru hücre tiplerini ve metotları doldur.
code: |
  use std::cell::{Cell, RefCell};

  struct Soru {
      metin: String,
      goruntulenme: ___0,
      bakanlar: ___1,
  }

  impl Soru {
      fn goster(&self, ogrenci: &str) -> &str {
          self.goruntulenme.set(self.goruntulenme.___2() + 1);
          self.bakanlar.___3().push(ogrenci.to_string());
          &self.metin
      }
  }

  fn main() {
      let s = Soru {
          metin: String::from("2 + 2 = ?"),
          goruntulenme: Cell::new(0),
          bakanlar: RefCell::new(Vec::new()),
      };
      s.goster("Ece");
      println!("{} → {} kez, {:?}", s.goster("Can"), s.goruntulenme.get(), s.bakanlar.borrow());
  }
blanks:
  - ["Cell<u32>"]
  - ["RefCell<Vec<String>>"]
  - ["get"]
  - ["borrow_mut"]
explanation: |
  `u32` `Copy` olduğu için `Cell` yeterli ve en ucuz seçimdir: kopyala-al (`get`), kopyala-koy (`set`).
  `Vec<String>`'e ise bir metot (`push`) çağırmamız, yani içeriye gerçek bir `&mut` almamız gerekiyor. Bu
  `RefCell`'in `borrow_mut`'u ile olur. `goster` dışarıdan bakınca salt okunur bir sorgu; kayıt tutma bir
  iç ayrıntı.
```

```quiz
question: |
  Bir metin editöründe birden çok **sekme** aynı `Belge`'yi gösteriyor ve herhangi bir sekmede yazılan
  metin hepsinde görünmeli. Program tek thread'de çalışıyor. Sekmeler belgeyi nasıl tutmalı?
options:
  - "`Box<Belge>`"
  - "`Rc<Belge>`"
  - "`Rc<RefCell<Belge>>`"
  - "`&'static mut Belge`"
answer: 2
explanation: |
  **Birden çok sahip** (sekmeler) → `Rc`. **Paylaşılan veride değişiklik** (yazma) → `RefCell`. Hücre içte
  durur ki değişen şey belgenin kendisi olsun. Tek thread olduğu için `Arc<Mutex<..>>`'e gerek yok.
feedback:
  - "Tek sahip; her sekmeye ayrı bir kutu = ayrı kopyalar."
  - "Paylaşım var ama yazma yok (E0594/E0596)."
  - "Doğru!"
  - "Birden çok `&mut` aynı anda var olamaz; `'static` de sorunu çözmez."
```

## Döngüler, Weak ve tekrar

```predict
code: |
  use std::rc::{Rc, Weak};

  fn main() {
      let zayif: Weak<String>;
      {
          let oda = Rc::new(String::from("toplantı odası"));
          zayif = Rc::downgrade(&oda);
          let geri = zayif.upgrade();
          println!("{} {} {:?}", Rc::strong_count(&oda), Rc::weak_count(&oda), geri.is_some());
      }
      println!("{:?}", zayif.upgrade());
  }
options:
  - |
    2 1 true
    None
  - |
    1 1 true
    None
  - |
    2 1 true
    Some("toplantı odası")
  - |
    1 0 true
    Some("toplantı odası")
answer: 0
explanation: |
  `downgrade` zayıf sayacı 1 yapar. `upgrade` başarılı olunca `geri` **geçici bir güçlü sahiptir**: güçlü 2.
  Blok bitince önce `geri`, sonra `oda` drop edilir. Güçlü sayaç 0'a iner, `String` bırakılır. Blok dışında
  yaşayan `zayif` değeri yaşatamaz; `upgrade` → `None`.
```

````quiz
question: |
  ```rust
  struct Dugum {
      deger: i32,
      ebeveyn: RefCell<Rc<Dugum>>,
      cocuklar: RefCell<Vec<Rc<Dugum>>>,
  }
  ```
  Bu tasarımla kurulan bir ağaç için ne söylenebilir? (Kökün `ebeveyn` alanının bir şekilde doldurulduğunu varsay.)
options:
  - "Sorunsuz çalışır; kök drop edilince bütün ağaç bırakılır"
  - "Her ebeveyn–çocuk çifti bir referans döngüsü oluşturur; ağaç asla bırakılmaz ve bellek sızar"
  - "Derlenmez, çünkü `Rc` bir `RefCell` içine konamaz"
  - "Çalışma zamanında `RefCell already borrowed` paniği atar"
answer: 1
explanation: |
  Ebeveyn çocuğunu `Rc` ile, çocuk ebeveynini de `Rc` ile tutuyor: iki yönlü güçlü bağ = döngü. Güçlü
  sayaçlar 0'a inmez, `drop` hiç çalışmaz. Doğru tasarım: `ebeveyn: RefCell<Weak<Dugum>>`. Ayrıca kökün
  ebeveyni olmadığı için `Weak::new()` doğal bir başlangıç değeri olur; bir `Rc<Dugum>`'ü ise "boş" başlatamazsın.
feedback:
  - "Kök drop edilse bile çocuklar onu `Rc` ile tutmaya devam eder."
  - "Doğru!"
  - "`RefCell<Rc<T>>` gayet geçerli bir tiptir."
  - "Sorun ödünç alma değil, sahiplik döngüsü."
````

````compiles
code: |
  fn main() {
      let mut sayac = 0;
      let mut artir = || sayac += 1;
      println!("{sayac}");
      artir();
  }
answer: false
error: E0502
explanation: |
  **Modül 14 tekrarı.** `artir` closure'ı `sayac`'ı **değiştirilebilir** biçimde yakalar (`FnMut`) ve bu
  ödünç closure'ın son kullanımına (`artir();`) kadar sürer. Aradaki `println!` paylaşılan bir ödünç ister:
  E0502. Derleme zamanı denetiminin gücü burada. `RefCell` kullansaydık aynı hata çalışma zamanında panik
  olurdu. Çözüm: `println!`'i `artir();`'dan sonraya al.
````

```compiles
code: |
  fn en_uzun<'a>(a: &'a str, b: &'a str) -> &'a str {
      if a.len() >= b.len() { a } else { b }
  }

  fn main() {
      let sehir = String::from("Kahramanmaraş");
      let sonuc;
      {
          let ilce = String::from("Elbistan");
          sonuc = en_uzun(&sehir, &ilce);
      }
      println!("{sonuc}");
  }
answer: false
error: E0597
explanation: |
  **Modül 12 tekrarı.** `'a`, iki girdiden **kısa yaşayanın** ömrüne eşitlenir, yani `ilce`'ninkine. `sonuc`
  iç bloğun dışında kullanılıyor ama `ilce` o noktada çoktan drop edilmiş. Sonuç gerçekte `sehir`'i gösterse
  bile derleyici imzaya bakarak karar verir: E0597 (`ilce` yeterince uzun yaşamıyor). Sahipli bir
  `String` döndürmek ya da `ilce`'yi dışarı taşımak çözümdür. Böyle bir durumda `Rc`'ye kaçmak gerekmez.
```

## Alıştırmalar

```exercise
id: m17-boss-ifade-agaci
title: İfade ağacı hesaplayıcı
difficulty: 3
prompt: |
  Bir hesap makinesi uygulaması, matematiksel ifadeleri özyinelemeli bir enum olarak tutuyor (her alt ifade
  bir `Box` içinde). Üç fonksiyonu tamamla:

  - `hesapla(i) -> f64`: ifadenin değeri.
  - `yaz(i) -> String`: ifadeyi parantezli metne çevirir. `Sayi` → sayının kendisi (`{}` biçimi, `2.0` →
    `"2"`), `Topla` → `"(a + b)"`, `Carp` → `"(a * b)"`, `Eksi` → `"-a"`.
  - `sayi_adedi(i) -> usize`: ifadedeki `Sayi` yapraklarının sayısı.

  Örnek: `(2 + 3) * 4` → `hesapla` = `20`, `yaz` = `"((2 + 3) * 4)"`, `sayi_adedi` = `3`.
starter: |
  enum Ifade {
      Sayi(f64),
      Topla(Box<Ifade>, Box<Ifade>),
      Carp(Box<Ifade>, Box<Ifade>),
      Eksi(Box<Ifade>),
  }

  use Ifade::{Carp, Eksi, Sayi, Topla};

  fn hesapla(i: &Ifade) -> f64 {
      todo!()
  }

  fn yaz(i: &Ifade) -> String {
      todo!()
  }

  fn sayi_adedi(i: &Ifade) -> usize {
      todo!()
  }

  fn main() {
      let ifade = Carp(
          Box::new(Topla(Box::new(Sayi(2.0)), Box::new(Sayi(3.0)))),
          Box::new(Eksi(Box::new(Sayi(4.0)))),
      );
      println!("{} = {}", yaz(&ifade), hesapla(&ifade));
      println!("{} sayı", sayi_adedi(&ifade));
  }
solution: |
  enum Ifade {
      Sayi(f64),
      Topla(Box<Ifade>, Box<Ifade>),
      Carp(Box<Ifade>, Box<Ifade>),
      Eksi(Box<Ifade>),
  }

  use Ifade::{Carp, Eksi, Sayi, Topla};

  fn hesapla(i: &Ifade) -> f64 {
      match i {
          Sayi(n) => *n,
          Topla(a, b) => hesapla(a) + hesapla(b),
          Carp(a, b) => hesapla(a) * hesapla(b),
          Eksi(a) => -hesapla(a),
      }
  }

  fn yaz(i: &Ifade) -> String {
      match i {
          Sayi(n) => format!("{n}"),
          Topla(a, b) => format!("({} + {})", yaz(a), yaz(b)),
          Carp(a, b) => format!("({} * {})", yaz(a), yaz(b)),
          Eksi(a) => format!("-{}", yaz(a)),
      }
  }

  fn sayi_adedi(i: &Ifade) -> usize {
      match i {
          Sayi(_) => 1,
          Topla(a, b) | Carp(a, b) => sayi_adedi(a) + sayi_adedi(b),
          Eksi(a) => sayi_adedi(a),
      }
  }

  fn main() {
      let ifade = Carp(
          Box::new(Topla(Box::new(Sayi(2.0)), Box::new(Sayi(3.0)))),
          Box::new(Eksi(Box::new(Sayi(4.0)))),
      );
      println!("{} = {}", yaz(&ifade), hesapla(&ifade));
      println!("{} sayı", sayi_adedi(&ifade));
  }
check: tests
tests: |
  fn s(x: f64) -> Box<Ifade> {
      Box::new(Sayi(x))
  }

  #[test]
  fn tek_sayi() {
      assert_eq!(hesapla(&Sayi(7.5)), 7.5);
      assert_eq!(yaz(&Sayi(7.5)), "7.5");
      assert_eq!(sayi_adedi(&Sayi(7.5)), 1, "tek sayı = tek yaprak");
  }

  #[test]
  fn ic_ice_ifade() {
      let i = Carp(Box::new(Topla(s(2.0), s(3.0))), s(4.0));
      assert_eq!(hesapla(&i), 20.0, "(2 + 3) * 4 = 20");
      assert_eq!(yaz(&i), "((2 + 3) * 4)", "her ikili işlem parantez içinde yazılmalı");
      assert_eq!(sayi_adedi(&i), 3);
  }

  #[test]
  fn eksi_isareti() {
      let i = Topla(s(10.0), Box::new(Eksi(Box::new(Carp(s(2.0), s(1.5))))));
      assert_eq!(hesapla(&i), 7.0, "10 + -(2 * 1.5) = 7");
      assert_eq!(yaz(&i), "(10 + -(2 * 1.5))");
      assert_eq!(sayi_adedi(&i), 3, "Eksi yeni bir sayı eklemez");
  }

  #[test]
  fn cift_eksi() {
      let i = Eksi(Box::new(Eksi(s(3.0))));
      assert_eq!(hesapla(&i), 3.0, "-(-3) = 3");
      assert_eq!(yaz(&i), "--3");
  }
hints:
  - "Üç fonksiyon da aynı iskeleti kullanır: `match i { Sayi(n) => ..., Topla(a, b) => ..., Carp(a, b) => ..., Eksi(a) => ... }` ve alt ifadeler için kendini yeniden çağırır."
  - "`a` bir `&Box<Ifade>`'dir; `hesapla(a)` deref zorlamasıyla `&Ifade` olarak geçer. `Sayi(n)` kolunda `n` bir `&f64`, değeri için `*n`."
  - "`yaz` için `format!(\"({} + {})\", yaz(a), yaz(b))`; `Sayi` için `format!(\"{n}\")` `2.0`'ı `2` olarak yazar."
explanation: |
  İfade ağaçları (AST) derleyicilerin, hesap tablolarının ve sorgu motorlarının kalbidir; `Box` olmadan
  özyinelemeli enum yazılamaz (E0072). Her fonksiyon ağacın yapısını takip eden bir `match`. Derleyici
  bir varyantı unutursan seni uyarır (Modül 7, kapsayıcılık). Yarın `Bol` varyantı eklersen, güncellenmesi
  gereken her `match`'i derleyici tek tek gösterir.

  `Topla(a, b) | Carp(a, b)` deseni iki varyantı tek kolda birleştiriyor; ikisinde de bağlanan isimler ve
  tipleri aynı olduğu için geçerli. Bütün fonksiyonlar `&Ifade` alıyor: ağacı **ödünç** okuyoruz,
  taşımıyoruz; aynı ifadeyi hem `yaz` hem `hesapla` ile kullanabiliyoruz.
```

```exercise
id: m17-boss-uyari-servisi
title: Hava durumu uyarı servisi
difficulty: 4
prompt: |
  Bir hava durumu servisi (`Yayinci`), abone olan uygulamalara fırtına uyarıları gönderiyor. Abone
  uygulamalar kapatılınca (son `Rc` drop edilince) bellekten gerçekten gitmeli. Servis onları **yaşatmamalı**.
  Bu yüzden servis aboneleri `Weak<RefCell<Abone>>` olarak tutuyor. Tamamla:

  - `abone_ol(&mut self, abone)`: aboneyi zayıf olarak listeye ekle.
  - `yayinla(&mut self, mesaj) -> usize`: hâlâ yaşayan her abonenin `gelenler` listesine mesajı ekle,
    ölmüş aboneleri listeden **temizle** ve teslim edilen abone sayısını döndür.
starter: |
  use std::cell::RefCell;
  use std::rc::{Rc, Weak};

  struct Abone {
      ad: String,
      gelenler: Vec<String>,
  }

  fn yeni_abone(ad: &str) -> Rc<RefCell<Abone>> {
      Rc::new(RefCell::new(Abone { ad: ad.to_string(), gelenler: Vec::new() }))
  }

  struct Yayinci {
      aboneler: Vec<Weak<RefCell<Abone>>>,
  }

  impl Yayinci {
      fn new() -> Self {
          Yayinci { aboneler: Vec::new() }
      }

      fn abone_ol(&mut self, abone: &Rc<RefCell<Abone>>) {
          todo!()
      }

      fn yayinla(&mut self, mesaj: &str) -> usize {
          todo!()
      }

      fn abone_sayisi(&self) -> usize {
          self.aboneler.len()
      }
  }

  fn main() {
      let mut servis = Yayinci::new();
      let telefon = yeni_abone("telefon");
      let saat = yeni_abone("akıllı saat");
      servis.abone_ol(&telefon);
      servis.abone_ol(&saat);
      println!("{} aboneye ulaştı", servis.yayinla("Fırtına uyarısı: Karadeniz"));
      drop(saat);
      println!("{} aboneye ulaştı", servis.yayinla("Fırtına dindi"));
      let t = telefon.borrow();
      println!("{}: {:?}", t.ad, t.gelenler);
  }
solution: |
  use std::cell::RefCell;
  use std::rc::{Rc, Weak};

  struct Abone {
      ad: String,
      gelenler: Vec<String>,
  }

  fn yeni_abone(ad: &str) -> Rc<RefCell<Abone>> {
      Rc::new(RefCell::new(Abone { ad: ad.to_string(), gelenler: Vec::new() }))
  }

  struct Yayinci {
      aboneler: Vec<Weak<RefCell<Abone>>>,
  }

  impl Yayinci {
      fn new() -> Self {
          Yayinci { aboneler: Vec::new() }
      }

      fn abone_ol(&mut self, abone: &Rc<RefCell<Abone>>) {
          self.aboneler.push(Rc::downgrade(abone));
      }

      fn yayinla(&mut self, mesaj: &str) -> usize {
          let mut teslim = 0;
          self.aboneler.retain(|zayif| match zayif.upgrade() {
              Some(abone) => {
                  abone.borrow_mut().gelenler.push(mesaj.to_string());
                  teslim += 1;
                  true
              }
              None => false,
          });
          teslim
      }

      fn abone_sayisi(&self) -> usize {
          self.aboneler.len()
      }
  }

  fn main() {
      let mut servis = Yayinci::new();
      let telefon = yeni_abone("telefon");
      let saat = yeni_abone("akıllı saat");
      servis.abone_ol(&telefon);
      servis.abone_ol(&saat);
      println!("{} aboneye ulaştı", servis.yayinla("Fırtına uyarısı: Karadeniz"));
      drop(saat);
      println!("{} aboneye ulaştı", servis.yayinla("Fırtına dindi"));
      let t = telefon.borrow();
      println!("{}: {:?}", t.ad, t.gelenler);
  }
check: tests
tests: |
  #[test]
  fn butun_abonelere_ulasir() {
      let mut y = Yayinci::new();
      let a = yeni_abone("a");
      let b = yeni_abone("b");
      y.abone_ol(&a);
      y.abone_ol(&b);
      assert_eq!(y.yayinla("dolu yağışı"), 2, "iki canlı abone var");
      assert_eq!(y.yayinla("sis"), 2);
      assert_eq!(a.borrow().gelenler, ["dolu yağışı", "sis"], "mesajlar sırayla gelmeli");
      assert_eq!(b.borrow().gelenler.len(), 2);
  }

  #[test]
  fn servis_aboneleri_yasatmaz() {
      let mut y = Yayinci::new();
      let a = yeni_abone("a");
      y.abone_ol(&a);
      assert_eq!(Rc::strong_count(&a), 1, "servis güçlü bir Rc tutmamalı (Weak kullan)");
      assert_eq!(Rc::weak_count(&a), 1, "servis bir zayıf işaretçi tutmalı");
  }

  #[test]
  fn olen_aboneler_temizlenir() {
      let mut y = Yayinci::new();
      let a = yeni_abone("a");
      let b = yeni_abone("b");
      let c = yeni_abone("c");
      y.abone_ol(&a);
      y.abone_ol(&b);
      y.abone_ol(&c);
      drop(b);
      assert_eq!(y.yayinla("rüzgâr"), 2, "drop edilen abone teslim sayılmamalı");
      assert_eq!(y.abone_sayisi(), 2, "ölü abone listeden temizlenmeli");
      assert_eq!(c.borrow().gelenler, ["rüzgâr"]);
      drop(a);
      drop(c);
      assert_eq!(y.yayinla("güneşli"), 0, "hiç canlı abone kalmadı");
      assert_eq!(y.abone_sayisi(), 0);
  }

  #[test]
  fn abonesiz_servis() {
      assert_eq!(Yayinci::new().yayinla("test"), 0, "abone yoksa teslim de yok");
  }
hints:
  - "`abone_ol` tek satır: `self.aboneler.push(Rc::downgrade(abone));`"
  - "`yayinla` için her `Weak`'i `upgrade()` et. `Some(abone)` ise `abone.borrow_mut().gelenler.push(mesaj.to_string())` ve sayacı artır; `None` ise o kaydı sil."
  - "Silme ve dolaşmayı tek adımda yapmak için Modül 9'daki `retain`'i kullan: closure, tutulacak kayıtlar için `true`, silinecekler için `false` döndürsün. Closure dışarıdaki `teslim` sayacını değiştirebilir (`FnMut`)."
explanation: |
  Bu, **gözlemci (observer)** deseninin Rust'taki güvenli hâli. Servis aboneleri `Rc` ile tutsaydı,
  kullanıcı uygulamayı kapatsa bile abone servis yaşadıkça bellekte kalır ve uyarı almaya devam ederdi.
  Bu klasik bir "unutulmuş dinleyici" sızıntısıdır. `Weak` ile servis yalnızca "varsa ulaş" der.
  `upgrade`'in `Option` döndürmesi, ölmüş bir aboneye mesaj göndermeyi **tip düzeyinde** imkânsız kılar.

  `retain` closure'ı her kayıt için bir kez çağrılır. İçeride `teslim += 1` yaptığı için closure `FnMut`
  olur (Modül 14). `retain` tam olarak bunu kabul eder. `upgrade` ile alınan `abone` geçici bir güçlü
  sahiptir ve kol bitince bırakılır. `borrow_mut()` da yalnızca o satır boyunca yaşar. Alternatif olarak
  önce dolaşıp sonra `self.aboneler.retain(|w| w.upgrade().is_some())` ile temizleyebilirdin, ama bu her
  `Weak`'i iki kez yükseltir.
```

```exercise
id: m17-boss-kutuphane-odunc
title: Kendini iade eden ödünç kitap
difficulty: 5
prompt: |
  Bir okul kütüphanesi `Rc<RefCell<Kutuphane>>` olarak paylaşılıyor. Bir kitabı ödünç alan herkes bir
  `Odunc` **koruyucusu** (guard) alır. Koruyucu kapsamdan çıktığında (ya da `drop` edildiğinde) kitap
  **kendiliğinden** rafa döner. Unutulan iade diye bir şey olamaz. Tamamla:

  - `odunc_al(k, ad) -> Option<Odunc>`: kitap raftaysa raftan çıkar, `kayitlar`'a `"verildi: <ad>"` ekle
    ve kütüphaneyi de paylaşan bir `Odunc` döndür. Rafta yoksa `None` (kayıt eklenmez).
  - `Deref for Odunc` (`Target = str`): koruyucu, kitabın adı gibi kullanılabilsin (`kitap.len()`,
    `&*kitap`).
  - `Drop for Odunc`: kitabı rafın **sonuna** geri koy ve `"iade: <ad>"` kaydını ekle.

  Örnek: raf `["Kürk Mantolu Madonna", "İnce Memed"]` iken "Kürk Mantolu Madonna" ödünç alınıp iade
  edilirse raf `["İnce Memed", "Kürk Mantolu Madonna"]` olur.
starter: |
  use std::cell::RefCell;
  use std::ops::Deref;
  use std::rc::Rc;

  struct Kutuphane {
      rafta: Vec<String>,
      kayitlar: Vec<String>,
  }

  fn kutuphane(kitaplar: &[&str]) -> Rc<RefCell<Kutuphane>> {
      Rc::new(RefCell::new(Kutuphane {
          rafta: kitaplar.iter().map(|k| k.to_string()).collect(),
          kayitlar: Vec::new(),
      }))
  }

  struct Odunc {
      kitap: String,
      kutuphane: Rc<RefCell<Kutuphane>>,
  }

  fn odunc_al(k: &Rc<RefCell<Kutuphane>>, ad: &str) -> Option<Odunc> {
      todo!()
  }

  impl Deref for Odunc {
      type Target = str;
      fn deref(&self) -> &str {
          todo!()
      }
  }

  impl Drop for Odunc {
      fn drop(&mut self) {
          todo!()
      }
  }

  fn main() {
      let k = kutuphane(&["Kürk Mantolu Madonna", "İnce Memed"]);
      {
          let kitap = odunc_al(&k, "İnce Memed").expect("kitap rafta olmalı");
          println!("Okunuyor: {} ({} bayt)", &*kitap, kitap.len());
          println!("Rafta: {:?}", k.borrow().rafta);
      }
      println!("Rafta: {:?}", k.borrow().rafta);
      println!("Kayıtlar: {:?}", k.borrow().kayitlar);
  }
solution: |
  use std::cell::RefCell;
  use std::ops::Deref;
  use std::rc::Rc;

  struct Kutuphane {
      rafta: Vec<String>,
      kayitlar: Vec<String>,
  }

  fn kutuphane(kitaplar: &[&str]) -> Rc<RefCell<Kutuphane>> {
      Rc::new(RefCell::new(Kutuphane {
          rafta: kitaplar.iter().map(|k| k.to_string()).collect(),
          kayitlar: Vec::new(),
      }))
  }

  struct Odunc {
      kitap: String,
      kutuphane: Rc<RefCell<Kutuphane>>,
  }

  fn odunc_al(k: &Rc<RefCell<Kutuphane>>, ad: &str) -> Option<Odunc> {
      let mut kut = k.borrow_mut();
      let sira = kut.rafta.iter().position(|kitap| kitap == ad)?;
      let kitap = kut.rafta.remove(sira);
      kut.kayitlar.push(format!("verildi: {kitap}"));
      Some(Odunc { kitap, kutuphane: Rc::clone(k) })
  }

  impl Deref for Odunc {
      type Target = str;
      fn deref(&self) -> &str {
          &self.kitap
      }
  }

  impl Drop for Odunc {
      fn drop(&mut self) {
          let mut kut = self.kutuphane.borrow_mut();
          kut.rafta.push(self.kitap.clone());
          kut.kayitlar.push(format!("iade: {}", self.kitap));
      }
  }

  fn main() {
      let k = kutuphane(&["Kürk Mantolu Madonna", "İnce Memed"]);
      {
          let kitap = odunc_al(&k, "İnce Memed").expect("kitap rafta olmalı");
          println!("Okunuyor: {} ({} bayt)", &*kitap, kitap.len());
          println!("Rafta: {:?}", k.borrow().rafta);
      }
      println!("Rafta: {:?}", k.borrow().rafta);
      println!("Kayıtlar: {:?}", k.borrow().kayitlar);
  }
check: tests
tests: |
  fn uzunluk(s: &str) -> usize {
      s.chars().count()
  }

  #[test]
  fn odunc_alinan_kitap_raftan_cikar() {
      let k = kutuphane(&["Sefiller", "Çalıkuşu", "Yaban"]);
      let o = odunc_al(&k, "Çalıkuşu").expect("Çalıkuşu rafta, ödünç verilebilmeli");
      assert_eq!(k.borrow().rafta, ["Sefiller", "Yaban"], "ödünç alınan kitap raftan çıkmalı");
      assert!(odunc_al(&k, "Çalıkuşu").is_none(), "aynı kitap ikinci kez verilemez");
      drop(o);
  }

  #[test]
  fn koruyucu_kitap_adi_gibi_kullanilir() {
      let k = kutuphane(&["Çalıkuşu"]);
      let o = odunc_al(&k, "Çalıkuşu").unwrap();
      assert_eq!(&*o, "Çalıkuşu", "Deref, kitabın adını vermeli");
      assert_eq!(uzunluk(&o), 8, "&Odunc → &str deref zorlaması çalışmalı");
      assert!(o.starts_with("Çalı"), "str metotları doğrudan çağrılabilmeli");
  }

  #[test]
  fn kapsam_bitince_kitap_kendiliginden_doner() {
      let k = kutuphane(&["Sefiller", "Yaban"]);
      {
          let _o = odunc_al(&k, "Sefiller").unwrap();
          assert_eq!(Rc::strong_count(&k), 2, "koruyucu kütüphaneyi Rc::clone ile paylaşmalı");
          assert_eq!(k.borrow().rafta.len(), 1);
      }
      assert_eq!(Rc::strong_count(&k), 1, "koruyucu bırakılınca Rc de bırakılır");
      assert_eq!(k.borrow().rafta, ["Yaban", "Sefiller"], "iade edilen kitap rafın sonuna eklenmeli");
      assert_eq!(k.borrow().kayitlar, ["verildi: Sefiller", "iade: Sefiller"]);
  }

  #[test]
  fn rafta_olmayan_kitap_verilmez() {
      let k = kutuphane(&["Yaban"]);
      assert!(odunc_al(&k, "Tutunamayanlar").is_none(), "rafta olmayan kitap için None beklenir");
      assert!(k.borrow().kayitlar.is_empty(), "başarısız denemede kayıt eklenmemeli");
      assert_eq!(k.borrow().rafta, ["Yaban"]);
  }
hints:
  - "`odunc_al`: `k.borrow_mut()` ile kütüphaneyi değiştirilebilir aç. Kitabın raftaki yerini `iter().position(...)` ile bul; fonksiyon `Option` döndürdüğü için `?` yoksa erkenden `None` döndürür (Modül 10)."
  - "`rafta.remove(sira)` kitabı (`String`) raftan çıkarıp sana verir. Koruyucuya kütüphanenin kendisini değil, `Rc::clone(k)` ile yeni bir sahibi koy. `deref` ise tek satır: `&self.kitap` (`&String` → `&str` zorlaması)."
  - "`drop` içinde `self.kutuphane.borrow_mut()` ile rafa `self.kitap.clone()` ekle ve `format!(\"iade: {}\", self.kitap)` kaydını yaz. `drop` yalnızca `&mut self` aldığı için kitabı taşıyamazsın; klonlamak en basit yol."
explanation: |
  Bu alıştırma modülün dört parçasını birleştiriyor: **paylaşılan** kütüphane (`Rc`), paylaşılan veride
  **değişiklik** (`RefCell`), koruyucunun bir `&str` gibi davranması (`Deref`) ve iadenin **unutulamaması**
  (`Drop`). Bu, standart kütüphanedeki `RefMut` ya da Modül 18'de göreceğin `MutexGuard`'ın küçük bir
  kopyası: kaynağı al, bir koruyucu ver, koruyucu ölünce kaynağı geri bırak (RAII).

  Neden koruyucu `Rc::clone(k)` tutuyor da bir referans (`&RefCell<Kutuphane>`) tutmuyor? Referans da
  çalışırdı, ama `Odunc<'a>` bir yaşam süresi parametresi taşımak zorunda kalır ve koruyucu, referansın
  geldiği değişkenden uzun yaşayamazdı (Modül 12). Bir struct'ta saklamak, başka bir fonksiyona vermek ya
  da döndürmek zorlaşırdı. `Rc` ile koruyucu kütüphanenin **ortak sahiplerinden biri** olur ve onu
  gerektiği kadar yaşatır; testteki `strong_count` bunu doğruluyor.

  Dikkat edilmesi gereken tuzak: `drop` içinde `borrow_mut()` yapıyoruz. Koruyucu drop edilirken biri
  `k.borrow()` ile kütüphaneyi **açık tutuyorsa** `RefCell already borrowed` paniği alırsın. `odunc_al`'da
  `kut` (bir `RefMut`) fonksiyon sonunda bırakıldığı için orada sorun yok. Alternatif tasarım:
  `drop`'ta `try_borrow_mut` ile panik yerine sessizce kayıt düşmek. Ama bu iadeyi kaybetme riski taşır.
  Panik, hatayı gizlemekten iyidir.
```
