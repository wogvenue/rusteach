---
id: m23-boss
title: "Boss: Makro Ustası"
minutes: 45
type: boss
objectives:
  - Makro kollarının seçimini, hijyeni ve genişlemenin sonucunu çalıştırmadan öngörebilmek
  - Fragment belirteçleri, tekrarlar, iç kurallar ve TT munching ile testleri geçen makrolar yazabilmek
  - Prosedürel makro türlerini, `syn`/`quote` kavramlarını ve doğru aracı seçme ölçütlerini karışık sorularda uygulayabilmek
keywords: [boss, makro, macro_rules!, fragment belirteci, tekrar, hijyen, TT munching, prosedürel makro, syn, quote]
---

Kod yazan kod yazmayı öğrendin; şimdi bunu kanıtlama zamanı. Bu sınavda makroların bütün dersleri
karışık sırayla geliyor, aralarda da sahiplik ve generic'ler gibi eski dostlar var. Geçmek için **%80**
gerekiyor. Her makroda kendine üç soru sor: *"Hangi kol eşleşir?"*, *"Genişlemiş kod tam olarak ne?"* ve
*"Bu isim kimin: makronun mu, çağıranın mı?"*

## Makro temelleri

```predict
code: |
  macro_rules! arti_iki {
      ($x:expr) => {
          $x + 2
      };
  }

  fn main() {
      println!("{}", arti_iki!(3) * 10);
  }
options:
  - "50"
  - "23"
  - Derlenmez
answer: 0
explanation: |
  İfade yerinde çağrılan bir makronun çıktısı, sözdizimi ağacına **tek bir ifade düğümü** olarak
  yerleşir. Yani `arti_iki!(3) * 10`, `(3 + 2) * 10` = **50** olur. C önişlemcisi metni kopyalardı:
  `3 + 2 * 10` = 23. Rust makroları token ağaçlarıyla ve sözdizimi ağacıyla çalıştığı için bu tuzak yok.
feedback:
  - Doğru! Makronun çıktısı bir bütün olarak `* 10`'un sol tarafı oldu.
  - Bu, C'deki metin kopyalayan `#define` davranışı olurdu.
  - "Derlenir: `$x + 2` geçerli bir ifade üretir."
```

```predict
code: |
  macro_rules! sinif {
      (0) => { "sıfır" };
      ($n:literal) => { "sabit" };
      ($e:expr) => { "ifade" };
  }

  fn main() {
      println!("{} {} {} {}", sinif!(0), sinif!(7), sinif!(-7), sinif!(3 + 4));
  }
options:
  - sıfır sabit sabit ifade
  - sıfır sabit ifade ifade
  - sabit sabit sabit ifade
  - ifade ifade ifade ifade
answer: 0
explanation: |
  Kollar **yukarıdan aşağıya** denenir, ilk uyan kazanır. `0` birebir token olarak ilk kola uyar.
  `7` ilk kola uymaz (farklı token), `literal` koluna uyar. `-7` de `literal`'dir: `literal`
  belirteci başında `-` olan sayıları kabul eder. `3 + 4` ise tek bir sabit değil, `expr` koluna düşer.
feedback:
  - Doğru!
  - "`literal` belirteci `-7` gibi eksi işaretli sabitleri de yakalar."
  - "`(0)` kolu en üstte olduğu ve `0` token'ına birebir uyduğu için önce o seçilir."
  - Kollar sırayla denenir; `$e:expr` en altta olduğu için ancak diğerleri uymazsa seçilir.
```

```quiz
question: Aşağıdakilerden hangileri bir **fonksiyonun yapamayıp** bir makronun yapabildiği işlerdir? (Birden fazla seçenek doğru.)
options:
  - Değişken sayıda argüman almak (`hesapla!(1)`, `hesapla!(1, 2, 3)`)
  - Çalışma anında, kullanıcının girdiği bir sayıya göre farklı davranmak
  - "Çağıranın verdiği bir isimle yeni bir fonksiyon veya struct tanımlamak"
  - Değerini döndürmeden önce bir hesaplama yapmak
answer: [0, 2]
explanation: |
  Makrolar derleme zamanında **token** alıp **kod** üretir: Değişken sayıda girdi alabilir ve
  `ident` gibi belirteçlerle yeni öğeler tanımlayabilir. Çalışma anındaki değerlere göre davranmak ve
  hesap yapıp değer döndürmek ise sıradan fonksiyonların işidir; makro çalışma anında artık yoktur.
feedback:
  - Doğru; Rust fonksiyonlarının parametre sayısı sabittir.
  - Bu bir çalışma anı işi; fonksiyonlar bunu zaten yapar. Makro çalışma anında yoktur.
  - Doğru; `fn $isim() { ... }` gibi kod üretimi yalnızca makrolarla olur.
  - Her fonksiyon bunu yapabilir.
```

```exercise
id: m23-boss-e-kurus
title: Lira ve kuruş
difficulty: 2
prompt: |
  Bir kasa uygulamasında paraları kuruş cinsinden (`u64`) tutuyorsun; kayan noktalı sayılar para için
  tehlikelidir. Şu yazımları kuruşa çeviren `kurus!` makrosunu yaz:

  | Çağrı | Sonuç |
  |-------|-------|
  | `kurus!(12 lira 50 kurus)` | `1250` |
  | `kurus!(3 lira)` | `300` |
  | `kurus!(75 kurus)` | `75` |

  Sayılar tamsayı **literal**'leridir.
starter: |
  macro_rules! kurus {
      ($l:literal lira $k:literal kurus) => {
          todo!()
      };
      // yalnızca lira ve yalnızca kuruş kollarını da ekle
  }

  fn main() {
      let fiyat: u64 = kurus!(12 lira 50 kurus);
      println!("{fiyat} kuruş");
  }
solution: |
  macro_rules! kurus {
      ($l:literal lira $k:literal kurus) => {
          $l * 100 + $k
      };
      ($l:literal lira) => {
          $l * 100
      };
      ($k:literal kurus) => {
          $k
      };
  }

  fn main() {
      let fiyat: u64 = kurus!(12 lira 50 kurus);
      let bahsis: u64 = kurus!(5 lira);
      println!("{fiyat} kuruş + {bahsis} kuruş");
  }
check: tests
tests: |
  #[test]
  fn lira_ve_kurus() {
      let t: u64 = kurus!(12 lira 50 kurus);
      assert_eq!(t, 1250, "12 lira 50 kuruş = 1250 kuruş");
      let t: u64 = kurus!(0 lira 5 kurus);
      assert_eq!(t, 5, "0 lira 5 kuruş = 5 kuruş");
  }

  #[test]
  fn yalnizca_lira() {
      let t: u64 = kurus!(3 lira);
      assert_eq!(t, 300, "3 lira = 300 kuruş");
  }

  #[test]
  fn yalnizca_kurus() {
      let t: u64 = kurus!(75 kurus);
      assert_eq!(t, 75, "75 kuruş olduğu gibi kalmalı");
  }
hints:
  - "Üç ayrı kol yaz. `lira` ve `kurus` kelimeleri `$` ile başlamadığı için birebir aranan token'lardır."
  - "`literal`'den sonra her token gelebilir (follow-set), bu yüzden `$l:literal lira` geçerli bir eşleştiricidir."
  - "Dönüştürücüler: `$l * 100 + $k`, `$l * 100` ve `$k`. Sonucun tipi (`u64`) çağıranın bağlamından çıkarılır."
explanation: |
  Her kol farklı bir "cümle kalıbı" tanımlıyor; `lira` ve `kurus` birebir token. Kollar sırayla
  deneniyor: `kurus!(3 lira)` ilk kolda girdinin erken bitmesi yüzünden başarısız olur, ikinci kola
  geçer. Sayılar için `expr` yerine `literal` seçmek şarttı: `$l:expr lira` follow-set kuralına takılır.

  Sonuç tipini makro belirlemiyor: `12 * 100 + 50` bir tamsayı ifadesi; `let t: u64` bağlamı onu
  `u64` yapıyor (Modül 2'deki tip çıkarımı). Gerçek bir uygulamada bunun yerine `Para` diye bir newtype
  (Modül 6) ve bir `fn` yazmak da gayet iyi bir seçimdir; makro burada okunaklı bir yazım sunuyor.
```

## Belirteçler ve tekrarlar

```compiles
code: |
  macro_rules! karsilastir {
      ($a:expr $b:expr) => {
          $a == $b
      };
  }

  fn main() {
      println!("{}", karsilastir!(1 1));
  }
answer: false
explanation: |
  Follow-set kuralı: Bir `expr` parçasından sonra yalnızca `=>`, `,` veya `;` gelebilir. Burada
  `$a:expr`'den sonra doğrudan `$b:expr` geliyor; derleyici **tanımı** reddeder:
  `` `$a:expr` is followed by `$b:expr`, which is not allowed for `expr` fragments ``.
  Çözüm: `($a:expr, $b:expr)`.
```

```fill
prompt: |
  Bir `HashSet` kuran `kume!` makrosunu tamamla. Her eleman için bir `insert` üretilmeli ve sondaki virgül
  serbest olmalı.
code: |
  macro_rules! kume {
      ( $( $x:expr ),* ___0 ) => {{
          let mut k = ::std::collections::HashSet::new();
          $( k.insert(___1); )___2
          k
      }};
  }

  fn main() {
      let renkler = kume!["kırmızı", "mavi", "kırmızı",];
      println!("{}", renkler.len());
  }
blanks:
  - ["$(,)?"]
  - ["$x"]
  - ["*"]
output: "2"
explanation: |
  `$(,)?` sondaki virgülü isteğe bağlı yapar. Dönüştürücüdeki `$( k.insert($x); )*` her eleman için bir
  satır üretir. `HashSet` tekrarlanan elemanı ikinci kez eklemez (Modül 9), bu yüzden uzunluk **2**.
  `::std::collections::HashSet` tam yolu, çağıranın dosyasında `use` olmasa bile makronun çalışmasını sağlar.
```

```predict
code: |
  macro_rules! yoklama {
      ( $( $ad:ident ),* ) => {{
          let mut sayi = 0;
          $(
              sayi += 1;
              print!("{} ", stringify!($ad));
          )*
          println!("= {sayi}");
      }};
  }

  fn main() {
      yoklama!(Ali, Ayse, Can);
  }
options:
  - Ali Ayse Can = 3
  - "$ad $ad $ad = 3"
  - Ali, Ayse, Can = 1
answer: 0
explanation: |
  Dönüştürücüdeki `$( ... )*` bloğu yakalanan her `$ad` için **bir kez** üretilir: üç `sayi += 1;` ve
  üç `print!`. `stringify!($ad)` her seferinde o anki ismi metne çevirir. Virgüller eşleştiricideki
  ayırıcıdır, çıktıya girmez.
feedback:
  - Doğru!
  - "`$ad` genişleme sırasında yerine konur; `stringify!` ona verilen **ismi** metne çevirir."
  - Tekrar bloğu her isim için ayrı ayrı üretilir; sayaç üç kez artar.
```

````exercise
id: m23-boss-e-ayarlar
title: Varsayılan değerli ayar struct'ı
difficulty: 3
prompt: |
  Bir oyunun ayarları için her seferinde struct + `impl Default` yazmak yerine `ayarlar!` makrosunu
  kullanmak istiyorsun:

  ```text
  ayarlar!(Oyun {
      ses: u8 = 70,
      tam_ekran: bool = false,
      oyuncu: &'static str = "Misafir",
  });
  ```

  Bu çağrı şunları üretmeli:
  - `#[derive(Debug, Clone, PartialEq)]` ile işaretli `struct Oyun { ses: u8, tam_ekran: bool, oyuncu: &'static str }`
  - `impl Default for Oyun`: her alan `=`'den sonra yazılan değeri alır
  - `fn alan_sayisi() -> usize`: alan sayısını döndürür (burada `3`)

  Eşleştirici hazır; `default` ve `alan_sayisi` gövdelerini tekrarlarla doldur.
starter: |
  macro_rules! ayarlar {
      ($isim:ident { $( $alan:ident : $tip:ty = $deger:expr ),+ $(,)? }) => {
          #[derive(Debug, Clone, PartialEq)]
          struct $isim {
              $( $alan: $tip, )+
          }

          impl Default for $isim {
              fn default() -> Self {
                  todo!()
              }
          }

          impl $isim {
              fn alan_sayisi() -> usize {
                  todo!()
              }
          }
      };
  }

  ayarlar!(Oyun {
      ses: u8 = 70,
      tam_ekran: bool = false,
      oyuncu: &'static str = "Misafir",
  });

  fn main() {
      let o = Oyun::default();
      println!("{} {} {}", o.ses, o.tam_ekran, o.oyuncu);
      println!("{} alan", Oyun::alan_sayisi());
  }
solution: |
  macro_rules! ayarlar {
      ($isim:ident { $( $alan:ident : $tip:ty = $deger:expr ),+ $(,)? }) => {
          #[derive(Debug, Clone, PartialEq)]
          struct $isim {
              $( $alan: $tip, )+
          }

          impl Default for $isim {
              fn default() -> Self {
                  $isim {
                      $( $alan: $deger, )+
                  }
              }
          }

          impl $isim {
              fn alan_sayisi() -> usize {
                  [ $( stringify!($alan) ),+ ].len()
              }
          }
      };
  }

  ayarlar!(Oyun {
      ses: u8 = 70,
      tam_ekran: bool = false,
      oyuncu: &'static str = "Misafir",
  });

  fn main() {
      let o = Oyun::default();
      println!("{} {} {}", o.ses, o.tam_ekran, o.oyuncu);
      println!("{} alan", Oyun::alan_sayisi());
  }
check: tests
tests: |
  #[test]
  fn varsayilan_degerler_dogru() {
      let o = Oyun::default();
      assert_eq!(o.ses, 70, "ses varsayılanı 70 olmalı");
      assert!(!o.tam_ekran, "tam_ekran varsayılanı false olmalı");
      assert_eq!(o.oyuncu, "Misafir");
  }

  #[test]
  fn struct_guncelleme_sozdizimi_ile_calisir() {
      let o = Oyun { ses: 20, ..Default::default() };
      assert_eq!(o.ses, 20);
      assert_eq!(o.oyuncu, "Misafir", "belirtilmeyen alanlar varsayılandan gelmeli");
      assert_ne!(o, Oyun::default(), "ses farklı olduğu için eşit olmamalı");
  }

  #[test]
  fn alan_sayisini_verir() {
      assert_eq!(Oyun::alan_sayisi(), 3);
  }

  #[test]
  fn baska_struct_ve_ifade_varsayilan() {
      ayarlar!(Ses { seviye: u8 = 5 * 10 });
      assert_eq!(Ses::default().seviye, 50, "varsayılan değer bir ifade olabilir: 5 * 10 = 50");
      assert_eq!(Ses::alan_sayisi(), 1, "tek alanlı struct");
  }
hints:
  - "`default` bir struct literal'i döndürmeli: `$isim { ... }`. İçine her alan için `alan: değer,` yazan bir tekrar koy."
  - "Tekrar: `$( $alan: $deger, )+`. `$alan` ve `$deger` aynı tekrarda yakalandığı için sayıları eşittir."
  - "Alan sayısı için her alanı bir dizi elemanına çevir ve uzunluğunu al: `[ $( stringify!($alan) ),+ ].len()`."
explanation: |
  Eşleştirici her alan için üç parça yakalıyor: isim (`ident`), tip (`ty`) ve varsayılan değer (`expr`).
  `ty`'den sonra `=` gelebildiği, `expr`'den sonra da `,` gelebildiği için follow-set kuralı sorun
  çıkarmıyor. Aynı tekrar listesi üç yerde kullanılıyor: struct alanları, `Default` gövdesi ve sayma.

  `alan_sayisi` için `[ ... ].len()` hilesi, her alanı bir `&str` dizisi elemanına dönüştürüyor; dizi
  boyutu derleme zamanında belli olduğu için sonuç da sabit. Alternatif: 3. dersteki özyinelemeli
  `say!` makrosu ya da `0 $( + { stringify!($alan); 1 } )+` gibi bir toplam.

  `..Default::default()` testindeki **struct güncelleme sözdizimi** (Modül 6 ve 11), makronun ürettiği
  `Default` uygulaması sayesinde sorunsuz çalışıyor: Üretilen kod, elle yazılmış koddan farksız.
````

## İleri teknikler

```predict
code: |
  macro_rules! takas {
      ($a:ident, $b:ident) => {
          let gecici = $a;
          $a = $b;
          $b = gecici;
      };
  }

  fn main() {
      let mut gecici = 1;
      let mut b = 2;
      takas!(gecici, b);
      println!("{gecici} {b}");
  }
options:
  - "2 1"
  - "1 2"
  - "2 2"
  - Derlenmez
answer: 0
explanation: |
  **Hijyen** sayesinde makronun içinde tanımlanan `gecici` ile çağıranın `gecici`'si farklı
  değişkenlerdir. Genişleme: `let gecici(makro) = gecici(çağıran);` → çağıranın `gecici`'sine `b`
  (2) atanır → `b`'ye makronun `gecici`'si (1) atanır. Sonuç `2 1`. C'deki bir `SWAP` makrosu aynı
  isimli değişkenle sessizce bozulurdu.
feedback:
  - Doğru! İki `gecici` birbirine karışmaz.
  - Takas gerçekleşir; makro çağıranın değişkenlerine `ident` olarak verildikleri için dokunabilir.
  - Bu, makronun `gecici`'si çağıranınkini "yakalasaydı" olurdu; hijyen bunu engeller.
  - "Derlenir: `$a` ve `$b` `ident` olarak verildiği için çağıranın değişkenleridir."
```

```compiles
code: |
  macro_rules! iki_kez {
      ($x:expr) => {{
          let a = $x;
          let b = $x;
          (a, b)
      }};
  }

  fn main() {
      let ad = String::from("Elif");
      let (x, y) = iki_kez!(ad);
      println!("{x} {y}");
  }
answer: false
error: E0382
explanation: |
  Makro **değeri değil kodu** kopyalar: genişlemiş hâli `let a = ad; let b = ad;`. `String` `Copy`
  değildir (Modül 4); ilk satır sahipliği `a`'ya taşır, ikinci satır taşınmış değeri kullanır:
  `E0382: use of moved value`. Bir `$x:expr`'i dönüştürücüde iki kez kullanmak hem yan etkileri
  tekrarlar hem de burada olduğu gibi sahiplik hatalarına yol açar. Çözüm: bir kez bağlayıp
  `let a = $x; let b = a.clone();` gibi açıkça davranmak.
```

```quiz
question: |
  Bir kütüphanede `#[macro_export]` ile dışa açtığın `kaydet!` makrosu, kütüphanedeki `pub fn __yaz()`
  yardımcısını çağırıyor. Makronun içinde bu çağrıyı nasıl yazmalısın?
options:
  - "`__yaz(...)`; makro tanımlandığı yerdeki isimleri görür"
  - "`crate::__yaz(...)`"
  - "`$crate::__yaz(...)`"
  - "`super::__yaz(...)`"
answer: 2
explanation: |
  `macro_rules!` hijyeni **karma**dır: yerel değişkenler tanım yerinde, fonksiyonlar ve yollar ise
  **çağrı yerinde** çözülür. Makro başka bir crate'te çağrıldığında `__yaz` ve `crate::__yaz` o crate'te
  aranır ve bulunamaz. `$crate` her zaman makroyu **tanımlayan** crate'e çözülür.
feedback:
  - Yerel değişkenler için doğru, fonksiyonlar için değil; fonksiyon isimleri çağrı yerinde aranır.
  - "`crate::` makronun **çağrıldığı** crate'in kökünü gösterir."
  - Doğru!
  - "`super::` da çağrı yerine göre çözülür; üstelik `#[macro_export]` makroyu crate köküne taşır."
```

````quiz
question: |
  TT munching yapan bir makroda kollar şu sırayla yazılmış. `puan!(+ +)` çağrısında ne olur?

  ```text
  ($($t:tt)*)                        => { puan!(@topla 0 ; $($t)*) };
  (@topla $acc:expr ;)               => { $acc };
  (@topla $acc:expr ; + $($k:tt)*)   => { puan!(@topla $acc + 1 ; $($k)*) };
  ```
options:
  - "`2` üretir"
  - "Genel kol `@topla ...` çağrılarını da yakalar; makro sonsuza dek kendini çağırır ve `recursion limit reached` hatası verir"
  - "`no rules expected @` hatası verir"
answer: 1
explanation: |
  `$($t:tt)*` **her** girdiye uyar, `@topla 0 ; + +` dahil. İlk uyan kol kazandığı için iç kurallara
  hiç sıra gelmez: Her adımda başa bir `@topla 0 ;` daha eklenir ve 128 iç içe genişlemeden sonra
  derleyici durur. Kural: iç kurallar **üstte**, her şeyi yakalayan genel kol **en altta**.
feedback:
  - Kollar doğru sırada olsaydı öyle olurdu.
  - Doğru!
  - "`@` sıradan bir token'dır ve `tt` ona da uyar; eşleşme hatası değil, sonsuz özyineleme olur."
````

````exercise
id: m23-boss-e-rota
title: Robotun rotası
difficulty: 4
prompt: |
  Bir depo robotu `(0, 0)` noktasından başlıyor. Komutlar `yön adım` çiftleri hâlinde yazılıyor ve
  `rota!` makrosu robotun **son konumunu** `(x, y)` (`(i32, i32)`) olarak vermeli:

  | Yön | Etki |
  |-----|------|
  | `kuzey n` | y += n |
  | `guney n` | y -= n |
  | `dogu n` | x += n |
  | `bati n` | x -= n |

  ```text
  rota!(kuzey 3 dogu 2 guney 1)   →  (2, 2)
  rota!()                          →  (0, 0)
  ```

  Adım sayıları tamsayı literal'leridir. TT munching kullan: Bir iç kural `(x, y)` biriktiricisini
  taşısın ve her adımda bir `yön adım` çiftini yesin.
starter: |
  macro_rules! rota {
      ($($t:tt)*) => {
          todo!()
      };
  }

  fn main() {
      let son: (i32, i32) = rota!(kuzey 3 dogu 2 guney 1);
      println!("{son:?}");
  }
solution: |
  macro_rules! rota {
      (@git ($x:expr, $y:expr) ;) => {
          ($x, $y)
      };
      (@git ($x:expr, $y:expr) ; kuzey $n:literal $($kalan:tt)*) => {
          rota!(@git ($x, $y + $n) ; $($kalan)*)
      };
      (@git ($x:expr, $y:expr) ; guney $n:literal $($kalan:tt)*) => {
          rota!(@git ($x, $y - $n) ; $($kalan)*)
      };
      (@git ($x:expr, $y:expr) ; dogu $n:literal $($kalan:tt)*) => {
          rota!(@git ($x + $n, $y) ; $($kalan)*)
      };
      (@git ($x:expr, $y:expr) ; bati $n:literal $($kalan:tt)*) => {
          rota!(@git ($x - $n, $y) ; $($kalan)*)
      };
      ($($t:tt)*) => {
          rota!(@git (0, 0) ; $($t)*)
      };
  }

  fn main() {
      let son: (i32, i32) = rota!(kuzey 3 dogu 2 guney 1);
      println!("{son:?}");
  }
check: tests
tests: |
  #[test]
  fn ornek_rota() {
      let p: (i32, i32) = rota!(kuzey 3 dogu 2 guney 1);
      assert_eq!(p, (2, 2), "kuzey 3, doğu 2, güney 1 → (2, 2)");
  }

  #[test]
  fn bos_rota_baslangicta_kalir() {
      let p: (i32, i32) = rota!();
      assert_eq!(p, (0, 0), "komut yoksa robot (0, 0)'da kalmalı");
  }

  #[test]
  fn negatif_konumlar() {
      let p: (i32, i32) = rota!(bati 4 guney 4 bati 1);
      assert_eq!(p, (-5, -4), "batı ve güney negatif yönlerdir");
  }

  #[test]
  fn uzun_rota_soldan_saga() {
      let p: (i32, i32) = rota!(dogu 10 kuzey 7 bati 3 kuzey 1 guney 20 dogu 1 bati 8 kuzey 2);
      assert_eq!(p, (0, -10), "x: 10 - 3 + 1 - 8 = 0, y: 7 + 1 - 20 + 2 = -10");
  }
hints:
  - "Giriş kolu biriktiriciyi başlatsın: `($($t:tt)*) => { rota!(@git (0, 0) ; $($t)*) };`. Bu kol **en altta** olmalı, yoksa iç çağrıları da yakalar."
  - "Temel durum: girdi bitince biriktiriciyi döndür: `(@git ($x:expr, $y:expr) ;) => { ($x, $y) };`. Biriktiriciyi parantez içinde taşımak `$x:expr, $y:expr` follow-set kuralına da uyar."
  - "Her yön için bir kol: `(@git ($x:expr, $y:expr) ; kuzey $n:literal $($kalan:tt)*) => { rota!(@git ($x, $y + $n) ; $($kalan)*) };`. Diğer üç yön için işareti ve koordinatı değiştir."
explanation: |
  Biriktirici `($x, $y)` her adımda bir ifade olarak büyüyor: `(0, 0)` → `(0, 0 + 3)` →
  `(0 + 2, 0 + 3)` → `(0 + 2, 0 + 3 - 1)`. `$x` ve `$y` birer `expr` düğümü olarak taşındığı için
  gruplama korunuyor; sonunda derleyici bu sabit ifadeleri hesaplıyor. Her iç kural girdinin başından
  iki token yiyor (yön kelimesi + `literal`) ve kalanı aynen bir sonraki adıma veriyor.

  Neden `$n:literal`? `$n:expr $($kalan:tt)*` follow-set kuralına takılırdı; `literal`'den sonra
  her şey gelebilir. Dikkat: Bilinmeyen bir yön (`rota!(yukari 2)`) yön kollarına uymaz ve her şeyi
  yakalayan giriş koluna düşer; makro başa durmadan `@git (0, 0) ;` ekleyerek kendini çağırır ve
  `recursion limit reached` hatası alırsın. Daha anlaşılır bir hata için yön kollarından **sonra**,
  giriş kolundan **önce** bir `(@git ($x:expr, $y:expr) ; $diger:tt $($k:tt)*)` kolu ekleyip
  `compile_error!` ile kendi mesajını verebilirsin.

  Alternatif bir çözüm tekrarlarla yazılabilir: `$( $yon:ident $n:literal )*` yakalayıp her çift
  için bir yardımcı makroyla `x`/`y` değişkenlerini güncellemek. O durumda değişkenleri hijyen
  yüzünden yardımcıya `ident` olarak vermen gerekir.
````

## Prosedürel makrolar ve doğru araç

```quiz
question: Aşağıdaki imzalardan hangisi `#[zamanla(ms)] fn rapor() { ... }` biçiminde kullanılan bir makroya aittir?
options:
  - "`#[proc_macro_derive(Zamanla)] pub fn zamanla(girdi: TokenStream) -> TokenStream`"
  - "`#[proc_macro_attribute] pub fn zamanla(ayar: TokenStream, oge: TokenStream) -> TokenStream`"
  - "`#[proc_macro] pub fn zamanla(girdi: TokenStream) -> TokenStream`"
  - "`macro_rules! zamanla { ... }`"
answer: 1
explanation: |
  Bir öğenin üstüne `#[ad(...)]` olarak yazılan makro **attribute** makrosudur ve iki `TokenStream`
  alır: parantez içindeki ayarlar (`ms`) ve üzerine yazıldığı öğe (`fn rapor ...`). Döndürdüğü token'lar
  öğenin **yerine** geçer. Derive yalnızca `#[derive(...)]` içinde, fonksiyon benzeri makro ise `ad!(...)`
  olarak çağrılır. `macro_rules!` makroları attribute olarak kullanılamaz.
feedback:
  - Derive makroları yalnızca `#[derive(Zamanla)]` olarak kullanılır ve tek girdi alır.
  - Doğru!
  - Bu imza `zamanla!(...)` biçiminde çağrılan fonksiyon benzeri makroya aittir.
  - "`macro_rules!` makroları `ad!(...)` ile çağrılır; attribute olamaz."
```

```quiz
question: Bir derive makrosunun neden ayrı, `proc-macro = true` ile işaretli bir crate'te olması gerekir?
options:
  - Çünkü prosedürel makrolar çalışma anında, program başlarken çalıştırılır
  - "Çünkü makro, onu kullanan crate derlenirken **derleyicinin içinde** çalışan bir programdır; önce ayrı olarak derleyicinin makinesi için derlenip derleyiciye yüklenmelidir"
  - "Çünkü `syn` ve `quote` yalnızca ayrı crate'lerde kullanılabilir"
answer: 1
explanation: |
  Prosedürel makro bir derleyici eklentisidir: `rustc` kullanıcının crate'ini derlerken onu yükler,
  token'ları verir, dönen token'ları kodun yerine koyar. Bu yüzden önce, derleyicinin çalıştığı makine
  (host) için ayrı bir crate olarak derlenmesi gerekir. Bu crate dışarıya yalnızca makro açabilir;
  trait gibi öğeler ayrı bir crate'te durur (`serde` + `serde_derive`).
feedback:
  - Makrolar çalışma anında yoktur; tamamen derleme sırasında çalışır.
  - Doğru!
  - "`syn` ve `quote` sıradan crate'lerdir; ayrı crate şartı makronun derleyici eklentisi olmasından gelir."
```

````quiz
question: |
  Bir derive makrosunda `adlar` değişkeni, struct'ın alan isimlerini (`ad`, `yas`) tutan bir `Vec<&Ident>`.
  Aşağıdaki şablon hangi kodu üretir?

  ```text
  quote! { vec![ #( stringify!(#adlar) ),* ] }
  ```
options:
  - "`vec![stringify!(ad), stringify!(yas)]`"
  - "`vec![stringify!(ad, yas)]`"
  - "`vec![stringify!(adlar)]`"
  - "`vec![stringify!(ad) stringify!(yas)]`"
answer: 0
explanation: |
  `#( ... ),*`, `quote!`'un tekrar sözdizimidir; `macro_rules!`'teki `$( ... ),*` ile aynı mantık. İçindeki
  şablon `adlar`'daki her eleman için bir kez üretilir ve aralarına `,` ayırıcısı konur. Sonuç
  derlenince `vec!["ad", "yas"]` olur.
feedback:
  - Doğru!
  - Tekrar, parantezin **içindeki** `#adlar`'ı değil, bütün `stringify!(...)` şablonunu tekrarlar.
  - "`#adlar` bir değişkendir; değeri (alan isimleri) yerine konur, değişkenin adı değil."
  - "`),*` ayırıcı olarak `,` koyar; ayırıcısız tekrar `)*` ile yazılırdı."
````

```quiz
question: |
  `i32`, `f64` ve `char` dizilerinin en büyük elemanını bulan **tek** bir yardımcı yazmak istiyorsun.
  En uygun araç hangisi?
options:
  - "`fn en_buyuk<T: PartialOrd + Copy>(liste: &[T]) -> T` gibi bir generic fonksiyon"
  - "Her tip için ayrı fonksiyon üreten bir `macro_rules!`"
  - "Bir `#[derive(EnBuyuk)]` prosedürel makrosu"
  - Üç ayrı, elle yazılmış fonksiyon
answer: 0
explanation: |
  Aynı davranış birçok tip için gerekiyor ve davranış yalnızca "karşılaştırılabilir ve kopyalanabilir"
  olmaya bağlı: Bu tam olarak generic + trait sınırının işi (Modül 11). Generic'ler tanım anında
  denetlenir, hata mesajları nettir ve monomorfizasyon sayesinde makro kadar hızlıdır. Makro
  merdiveninin kuralı: alt basamak yetiyorsa yukarı çıkma.
feedback:
  - Doğru!
  - Çalışır ama gereksiz; generic bir fonksiyon aynı işi daha okunur ve daha iyi hata mesajlarıyla yapar.
  - Derive bir tipin **tanımını** okumak için vardır; burada okunacak bir tanım yok, sadece ortak bir davranış var.
  - Üç kopya, üç kat bakım; generic'ler tam da bu tekrarı önlemek için var.
```
