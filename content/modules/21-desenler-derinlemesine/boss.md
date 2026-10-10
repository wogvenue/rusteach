---
id: m21-boss
title: "Boss: Desen Ustası"
minutes: 40
type: boss
objectives:
  - Desen konumlarını, reddedilebilirliği, yapı bozmayı ve bağlama kiplerini karışık sorularda doğru uygulayabilmek
  - Guard, `@` ve dilim desenleri içeren `match` ifadelerinin çıktısını ve derlenip derlenmeyeceğini çalıştırmadan öngörebilmek
  - Bir kural tablosunu tek bir okunaklı `match`'e çeviren, testleri geçen fonksiyonları sıfırdan yazabilmek
keywords: [boss, desen, pattern, reddedilebilir, yapı bozma, bağlama kipi, guard, "@", dilim deseni, let-else]
---

Desenlerin bütün sırlarını öğrendin; şimdi onları karışık ve biraz da sinsi sorularla sınama zamanı.
Aralarda önceki modüllerden (iterator'lar, `Mutex`, `?` operatörü) de sorular var. Geçmek için **%80**
gerekiyor. Her `match`'te kendine üç soru sor: *"Kollar hangi sırayla deneniyor?"*, *"Bu isim neye
bağlanıyor: değere mi, referansa mı?"* ve *"Derleyici bu kolları eksiksiz sayar mı?"*

## Desenler her yerde

```predict
code: |
  fn main() {
      let notlar = vec![("Ali", 70), ("Ece", 95), ("Can", 40), ("Su", 50)];

      let gecenler: Vec<&str> = notlar
          .iter()
          .filter(|&&(_, puan)| puan >= 50)
          .map(|&(ad, _)| ad)
          .collect();

      if let Some((ad, puan)) = notlar.iter().max_by_key(|&&(_, p)| p) {
          println!("{gecenler:?} → birinci {ad} ({puan})");
      }
  }
options:
  - "[\"Ali\", \"Ece\", \"Su\"] → birinci Ece (95)"
  - "[\"Ali\", \"Ece\"] → birinci Ece (95)"
  - "[\"Ali\", \"Ece\", \"Su\"] → birinci Su (50)"
  - "Derlenmez: closure parametresinde `&&(_, puan)` deseni yazılamaz"
answer: 0
explanation: |
  Closure parametreleri de birer **desendir** ve reddedilemez oldukları sürece istediğin kadar açılabilirler.
  `iter()` elemanları `&(&str, i32)` olarak verir; `filter` ise onlara bir referans daha ekler
  (`&&(&str, i32)`). `|&&(_, puan)|` iki referansı da açıp `puan`'ı bir `i32` olarak bağlar. `map` tek
  referanslı elemanı alır: `|&(ad, _)|`. Koşul `>=` olduğu için 50 alan Su da geçer. `max_by_key` en büyük
  anahtarlı elemanı (`&("Ece", 95)`) döndürür; `if let Some((ad, puan))` onu varsayılan bağlama kipleriyle
  parçalar.
```

```compiles
code: |
  fn yas_oku(metin: &str) -> u32 {
      let Ok(yas) = metin.trim().parse::<u32>() else {
          println!("geçersiz yaş: {metin}");
      };
      yas
  }

  fn main() {
      println!("{}", yas_oku(" 42 "));
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308**, *`else` clause of `let...else` does not diverge*. `let ... else`'in `else` bloğu
  **ıraksamak** (diverge) zorundadır: `return`, `break`, `continue` ya da `panic!` ile bitmeli. Aksi
  hâlde desen uymadığında `yas` hiçbir değere bağlanmamış olurdu ve sonraki satır tanımsız bir değeri
  kullanırdı. Düzeltme: `else { println!(...); return 0; }` ya da fonksiyonu `Option<u32>` döndürecek
  şekilde yazıp `else { return None; }`.
```

```quiz
question: Aşağıdaki konumlardan hangileri **reddedilebilir** (refutable) bir deseni (ör. `Some(x)`) kabul eder? (Birden çok seçenek)
options:
  - "`let DESEN = ifade;`"
  - "`while let DESEN = ifade { ... }`"
  - "Fonksiyon parametresi: `fn f(DESEN: Option<i32>)`"
  - "`let DESEN = ifade else { ... };`"
  - "`for DESEN in iterator { ... }`"
answer: [1, 3]
explanation: |
  Desen uymadığında **gidilecek başka bir yol** olan konumlar reddedilebilir desen alır: `while let` döngüden
  çıkar, `let ... else` `else` bloğunu çalıştırır (ayrıca `if let` ve `match` kolları). `let`, `for` ve
  parametrelerde böyle bir yol yoktur; bu konumlar reddedilemez desen ister, yoksa **E0005**
  (*refutable pattern in local binding / function argument*).
feedback:
  - "`let` için uymama durumunda gidilecek yol yok: E0005. Köprü `let ... else`."
  - Doğru! Uymazsa döngü biter.
  - Parametre deseni her çağrıda uymak zorunda; `Option<i32>` alıp gövdede `match` et.
  - Doğru! Uymazsa `else` bloğu çalışır ve ıraksar.
  - "`for` her elemanı desene bağlamak zorunda; filtrelemek için `.flatten()` ya da `if let` kullan."
```

```predict
code: |
  fn main() {
      let mut yigin = vec![1, 2, 3];
      let mut sira = Vec::new();
      while let Some(ust) = yigin.pop() {
          if ust == 2 {
              yigin.push(10);
          }
          sira.push(ust);
      }
      println!("{sira:?}");
  }
options:
  - "[3, 2, 1]"
  - "[3, 2, 10, 1]"
  - "[1, 2, 10, 3]"
  - Sonsuz döngüye girer
answer: 1
explanation: |
  `while let`, koşulu **her turda yeniden** değerlendirir. `pop` sondan alır: önce 3, sonra 2. 2 alındığında
  yığına 10 eklenir; bir sonraki `pop` bu 10'u verir, ardından 1. Yığın boşalınca `pop` `None` döndürür,
  desen uymaz ve döngü biter. 10 bir kez eklendiği için döngü sonsuz değildir.
```

Isınma alıştırmasıyla bu bölümü kapat:

```exercise
id: m21-boss-e-bolge
title: Koordinat bölgesi
difficulty: 2
prompt: |
  Bir harita uygulaması, bir noktanın koordinat düzleminde nerede olduğunu söylüyor. `bolge` fonksiyonu bir
  `(i32, i32)` tuple'ı alır ve şunu döndürür:

  | Nokta | Sonuç |
  |---|---|
  | `(0, 0)` | `"başlangıç noktası"` |
  | `y == 0` (x ≠ 0) | `"x ekseni"` |
  | `x == 0` (y ≠ 0) | `"y ekseni"` |
  | x > 0, y > 0 | `"1. bölge"` |
  | x < 0, y > 0 | `"2. bölge"` |
  | x < 0, y < 0 | `"3. bölge"` |
  | x > 0, y < 0 | `"4. bölge"` |

  Tuple'ı **parametre deseninde** `(x, y)` olarak parçala ve kararı değişmez ile aralık desenleriyle ver:
  `if` kullanma. Derleyici kollarının eksiksiz olduğunu kendisi doğrulasın; `_ =>` ile biten bir "her şey"
  kolu yazma.
starter: |
  fn bolge(nokta: (i32, i32)) -> &'static str {
      todo!()
  }

  fn main() {
      for nokta in [(0, 0), (5, 0), (3, 4), (-2, -7)] {
          println!("{nokta:?} → {}", bolge(nokta));
      }
  }
solution: |
  fn bolge((x, y): (i32, i32)) -> &'static str {
      match (x, y) {
          (0, 0) => "başlangıç noktası",
          (_, 0) => "x ekseni",
          (0, _) => "y ekseni",
          (1.., 1..) => "1. bölge",
          (..0, 1..) => "2. bölge",
          (..0, ..0) => "3. bölge",
          (1.., ..0) => "4. bölge",
      }
  }

  fn main() {
      for nokta in [(0, 0), (5, 0), (3, 4), (-2, -7)] {
          println!("{nokta:?} → {}", bolge(nokta));
      }
  }
check: tests
tests: |
  #[test]
  fn eksenler() {
      assert_eq!(bolge((0, 0)), "başlangıç noktası");
      assert_eq!(bolge((5, 0)), "x ekseni");
      assert_eq!(bolge((-9, 0)), "x ekseni", "negatif x de x ekseni üzerindedir");
      assert_eq!(bolge((0, -3)), "y ekseni");
  }

  #[test]
  fn dort_bolge() {
      assert_eq!(bolge((3, 4)), "1. bölge");
      assert_eq!(bolge((-3, 4)), "2. bölge");
      assert_eq!(bolge((-3, -4)), "3. bölge");
      assert_eq!(bolge((3, -4)), "4. bölge");
  }

  #[test]
  fn sinir_degerleri() {
      assert_eq!(bolge((1, 1)), "1. bölge", "1 zaten pozitiftir");
      assert_eq!(bolge((-1, -1)), "3. bölge");
      assert_eq!(bolge((i32::MAX, i32::MIN)), "4. bölge", "uç değerler de bir bölgeye düşmeli");
  }
hints:
  - "Parametre de bir desendir: `fn bolge((x, y): (i32, i32))`. Gövdede `match (x, y)` ile ikisine birden bak."
  - "Önce özel durumlar: `(0, 0)`, sonra `(_, 0)` ve `(0, _)`. Kollar yukarıdan aşağı denenir."
  - "Pozitif için `1..`, negatif için `..0` aralığı: `(1.., 1..) => \"1. bölge\"`, `(..0, 1..) => \"2. bölge\"`..."
forbid:
  - pattern: "\\bif\\b"
    message: Kararı `if` ile değil, desenlerle ver.
  - pattern: "_\\s*=>"
    message: "`_ =>` ile biten bir kol yazma; bütün durumları desenlerle kapsa (tuple içindeki `_` serbest)."
require:
  - pattern: "fn\\s+bolge\\s*\\(\\s*\\("
    message: "Tuple'ı parametre deseninde parçala, ör. `fn bolge((x, y): (i32, i32))`."
explanation: |
  Parametre deseni `(x, y)` reddedilemezdir: her `(i32, i32)` ona uyar, bu yüzden parametrede kullanılabilir.
  Gövdedeki `match` ise reddedilebilir kollardan oluşur ve derleyici aralıkları **sayısal olarak** analiz eder:
  her bileşen için `..0`, `0` ve `1..` bütün `i32` değerlerini böler; yedi kol bu dokuz kombinasyonu
  kapsar (`(_, 0)` ve `(0, _)` üçer tanesini birden). Bir kolu silersen E0004, hangi noktanın açıkta kaldığını
  söyler, ör. *pattern `(i32::MIN..=-1_i32, i32::MIN..=-1_i32)` not covered*.

  `if x > 0 && y > 0` zinciriyle de yazılabilirdi ama o zaman eksiksizlik senin dikkatine kalırdı. Burada
  `_ =>` kolu da yasaktı, çünkü öyle bir kol unuttuğun bir durumu sessizce yutardı.
```

## Sözdizimi, sahiplik ve bağlama kipleri

```predict
code: |
  fn sinif(c: char) -> &'static str {
      match c {
          'a' | 'e' | 'ı' | 'i' | 'o' | 'ö' | 'u' | 'ü' => "ünlü",
          'a'..='z' => "ünsüz",
          '0'..='9' => "rakam",
          _ => "diğer",
      }
  }

  fn main() {
      let siniflar: Vec<&str> = "kağıt9".chars().map(|c| sinif(c)).collect();
      println!("{}", siniflar.join(" "));
  }
options:
  - ünsüz ünlü diğer ünlü ünsüz rakam
  - ünsüz ünlü ünsüz ünlü ünsüz rakam
  - ünsüz ünlü ünsüz diğer ünsüz rakam
  - "Derlenmez: `'a'` iki kolda birden geçiyor"
answer: 0
explanation: |
  `char` aralıkları **Unicode kod noktalarına** göre çalışır: `'a'..='z'` yalnızca İngiliz alfabesinin 26
  küçük harfini (U+0061–U+007A) kapsar. `'ğ'` (U+011F) bu aralığın dışında kalır ve `_` koluna düşer:
  "diğer". `'ı'` da aralığın dışındadır ama ilk kolda açıkça listelendiği için "ünlü" olur. `'a'`'nın iki
  kolda geçmesi hata değildir: kollar sırayla denenir, ilk uyan kazanır; ikinci kol yine de (b, c, d...)
  için erişilebilir olduğu için uyarı da yoktur. Türkçe metinlerde harf sınaması için aralık yerine
  `c.is_alphabetic()` gibi metotlar daha doğrudur.
```

```compiles
code: |
  struct Siparis {
      musteri: String,
      adet: u32,
  }

  fn main() {
      let s = Siparis { musteri: String::from("Ayşe"), adet: 3 };
      let Siparis { musteri, .. } = s;
      println!("{musteri}: {} adet", s.adet);
  }
answer: true
explanation: |
  Derlenir ve `Ayşe: 3 adet` yazar. `let Siparis { musteri, .. } = s;` yalnızca `musteri` alanını taşır; bu
  bir **kısmi taşıma**dır. Artık `s`'yi bütün olarak kullanamazsın (ör. bir fonksiyona vermek E0382 olurdu),
  ama **taşınmamış** alanlar hâlâ geçerlidir. `adet` hem taşınmadı (desen `..` ile yok saydı) hem de `u32`
  olarak `Copy`'dir; `s.adet` sorunsuz okunur.
```

```fill
prompt: |
  Bir kafe, adı **Ç** ile başlayan ürünlere `oran` yüzde zam yapıyor. Vektörü değiştirilebilir referansla
  dolaş; varsayılan bağlama kipleri sayesinde `(ad, fiyat)` deseni hangi tipleri bağlıyor, ona göre doldur.
code: |
  fn zam_yap(urunler: &mut Vec<(String, u32)>, oran: u32) {
      for (ad, fiyat) in ___0 {
          if ad.starts_with('Ç') {
              ___1 += *fiyat * oran / 100;
          }
      }
  }

  fn main() {
      let mut urunler = vec![
          (String::from("Çay"), 100),
          (String::from("Kahve"), 200),
          (String::from("Çikolata"), 50),
      ];
      zam_yap(&mut urunler, 10);
      for (ad, fiyat) in &urunler {
          println!("{ad}: {fiyat}");
      }
  }
blanks:
  - ["urunler", "urunler.iter_mut()"]
  - ["*fiyat"]
output: |
  Çay: 110
  Kahve: 200
  Çikolata: 55
explanation: |
  `urunler` zaten bir `&mut Vec<(String, u32)>`; onu `for`'a vermek (ya da `iter_mut()`) elemanları
  `&mut (String, u32)` olarak üretir. `(ad, fiyat)` referans olmayan bir desen olduğu için varsayılan bağlama
  kipi `ref mut` olur: `ad: &mut String`, `fiyat: &mut u32`. Değeri değiştirmek için referansın
  **arkasına** yazman gerekir: `*fiyat += ...`. `ad.starts_with` ise otomatik deref ile çalışır. Desene
  `&mut (ad, fiyat)` yazmak gerekmez; `(ref mut ad, ...)` ise 2024 sürümünde zaten hatadır (4. ders).
```

````quiz
question: |
  Bir sunucu kodunda istatistikleri güncellerken `Mutex`'i (Modül 18) bölüm boyunca kilitli tutmak isteyen
  biri şöyle yazıyor:

  ```rust
  let _ = istatistik.lock().unwrap();
  // ... birkaç satır, kilidin tutulduğunu varsayan kod
  ```

  Ne olur?
options:
  - Kilit kapsamın sonuna kadar tutulur; `_` sadece "bu ismi kullanmayacağım" demektir
  - "`_` hiçbir şey bağlamadığı için `MutexGuard` aynı satırın sonunda drop edilir ve kilit hemen bırakılır"
  - "Derlenmez: `lock()` sonucu kullanılmak zorundadır"
  - Kilit hiç bırakılmaz ve sonraki `lock()` çağrısı kilitlenir (deadlock)
answer: 1
explanation: |
  `_` deseni **bağlamaz**: değer hiçbir isme taşınmadığı için geçici `MutexGuard` ifade bitince drop edilir;
  RAII gereği kilit de o anda açılır. Sonraki satırlar korumasız çalışır, bu da sessiz bir veri tutarsızlığı
  hatasıdır. Kilidi tutmak için guard'a gerçek bir isim ver: `let _kilit = istatistik.lock().unwrap();`
  (`_kilit` gerçek bir değişkendir ve kapsamın sonuna kadar yaşar) ya da daha iyisi `let mut veri = ...;`
  ile guard'ı doğrudan kullan.
feedback:
  - "Bu `_kilit` için doğru olurdu; `_` ise hiç bağlama yapmaz."
  - Doğru!
  - "`let _ =` tam da \"sonucu kullanmıyorum\" demenin yolu; derlenir."
  - Tam tersi; kilit gereğinden **erken** bırakılır.
````

Şimdi iç içe bir enum'u referans üzerinden parçala:

```exercise
id: m21-boss-e-kargo
title: Kargo takip mesajları
difficulty: 3
prompt: |
  Bir kargo şirketinin uygulaması, gönderinin durumunu müşteriye tek satırla anlatıyor. `mesaj` fonksiyonunu
  **tek bir `match`** ile yaz. Fonksiyon durumu **referansla** alıyor; hiçbir şeyi klonlama.

  | Durum | Mesaj |
  |---|---|
  | `Hazirlaniyor` | `"Siparişin hazırlanıyor"` |
  | `Yolda`, `kalan_km` 0 | `"Kurye kapında!"` |
  | `Yolda`, `kalan_km` 1–20 | `"<sehir> içinde dağıtımda (<km> km)"` |
  | `Yolda`, daha uzak | `"<sehir> aktarma merkezinde, <km> km kaldı"` |
  | `TeslimEdildi`, alıcı adı var ve boş değil | `"<ad> teslim aldı"` |
  | `TeslimEdildi`, alıcı yok ya da boş | `"Teslim edildi"` |
  | `Iade(sebep)`, sebep boş ya da sadece boşluk | `"İade edildi"` |
  | `Iade(sebep)` | `"İade: <sebep>"` |
starter: |
  enum Durum {
      Hazirlaniyor,
      Yolda { sehir: String, kalan_km: u32 },
      TeslimEdildi { alici: Option<String> },
      Iade(String),
  }

  fn mesaj(durum: &Durum) -> String {
      todo!()
  }

  fn main() {
      let durumlar = [
          Durum::Hazirlaniyor,
          Durum::Yolda { sehir: String::from("Ankara"), kalan_km: 12 },
          Durum::TeslimEdildi { alici: Some(String::from("Zeynep")) },
          Durum::Iade(String::from("hasarlı paket")),
      ];
      for d in &durumlar {
          println!("{}", mesaj(d));
      }
  }
solution: |
  enum Durum {
      Hazirlaniyor,
      Yolda { sehir: String, kalan_km: u32 },
      TeslimEdildi { alici: Option<String> },
      Iade(String),
  }

  fn mesaj(durum: &Durum) -> String {
      match durum {
          Durum::Hazirlaniyor => String::from("Siparişin hazırlanıyor"),
          Durum::Yolda { kalan_km: 0, .. } => String::from("Kurye kapında!"),
          Durum::Yolda { sehir, kalan_km: km @ 1..=20 } => {
              format!("{sehir} içinde dağıtımda ({km} km)")
          }
          Durum::Yolda { sehir, kalan_km } => {
              format!("{sehir} aktarma merkezinde, {kalan_km} km kaldı")
          }
          Durum::TeslimEdildi { alici: Some(ad) } if !ad.is_empty() => format!("{ad} teslim aldı"),
          Durum::TeslimEdildi { .. } => String::from("Teslim edildi"),
          Durum::Iade(sebep) if sebep.trim().is_empty() => String::from("İade edildi"),
          Durum::Iade(sebep) => format!("İade: {sebep}"),
      }
  }

  fn main() {
      let durumlar = [
          Durum::Hazirlaniyor,
          Durum::Yolda { sehir: String::from("Ankara"), kalan_km: 12 },
          Durum::TeslimEdildi { alici: Some(String::from("Zeynep")) },
          Durum::Iade(String::from("hasarlı paket")),
      ];
      for d in &durumlar {
          println!("{}", mesaj(d));
      }
  }
check: tests
tests: |
  fn yolda(sehir: &str, km: u32) -> Durum {
      Durum::Yolda { sehir: String::from(sehir), kalan_km: km }
  }

  #[test]
  fn hazirlik_ve_yolda() {
      assert_eq!(mesaj(&Durum::Hazirlaniyor), "Siparişin hazırlanıyor");
      assert_eq!(mesaj(&yolda("İzmir", 0)), "Kurye kapında!");
      assert_eq!(mesaj(&yolda("İzmir", 7)), "İzmir içinde dağıtımda (7 km)");
      assert_eq!(mesaj(&yolda("Bursa", 340)), "Bursa aktarma merkezinde, 340 km kaldı");
  }

  #[test]
  fn yolda_sinirlari() {
      assert_eq!(mesaj(&yolda("Van", 1)), "Van içinde dağıtımda (1 km)", "1 km şehir içidir");
      assert_eq!(mesaj(&yolda("Van", 20)), "Van içinde dağıtımda (20 km)", "20 km hâlâ şehir içidir");
      assert_eq!(mesaj(&yolda("Van", 21)), "Van aktarma merkezinde, 21 km kaldı", "21 km artık aktarma merkezi");
  }

  #[test]
  fn teslim() {
      let d = Durum::TeslimEdildi { alici: Some(String::from("Mert")) };
      assert_eq!(mesaj(&d), "Mert teslim aldı");
      assert_eq!(mesaj(&Durum::TeslimEdildi { alici: None }), "Teslim edildi");
      let bos = Durum::TeslimEdildi { alici: Some(String::new()) };
      assert_eq!(mesaj(&bos), "Teslim edildi", "boş alıcı adı yazılmamalı");
  }

  #[test]
  fn iade() {
      assert_eq!(mesaj(&Durum::Iade(String::from("yanlış beden"))), "İade: yanlış beden");
      assert_eq!(mesaj(&Durum::Iade(String::from("   "))), "İade edildi", "sadece boşluktan oluşan sebep boş sayılır");
      assert_eq!(mesaj(&Durum::Iade(String::new())), "İade edildi");
  }
hints:
  - "`match durum` yaz; `durum` bir referans olduğu için varsayılan bağlama kipleri devreye girer ve `sehir`, `ad`, `sebep` gibi isimler `&String` olarak bağlanır. `*` ya da `ref` gerekmez."
  - "Yolda için üç kol: `Durum::Yolda { kalan_km: 0, .. }`, sonra `Durum::Yolda { sehir, kalan_km: km @ 1..=20 }`, en son koşulsuz `Durum::Yolda { sehir, kalan_km }`."
  - "Boşluk kontrolleri desenle ifade edilemez, guard ister: `Durum::TeslimEdildi { alici: Some(ad) } if !ad.is_empty() => ...`, ardından guard'sız `Durum::TeslimEdildi { .. } => ...`. `Iade` için de aynı ikili."
forbid:
  - pattern: "\\.clone\\(\\)|to_owned\\(\\)"
    message: Klonlamaya gerek yok; desenler referans bağlasın.
require:
  - pattern: "@"
    message: Şehir içi mesafeyi sınayıp bağlamak için `@` kullan.
explanation: |
  `match durum` bir `&Durum` ile eşleşir; desenler referans olmadığı için bağlama kipi `ref` olur ve bütün
  isimler (`sehir`, `km`, `ad`, `sebep`) referans olarak bağlanır. Hiçbir şey taşınmaz, hiçbir şey klonlanmaz.
  `{sehir}` ve `{km}` yazdırılırken referanslar otomatik olarak "içlerindekini" gösterir.

  Desen ile guard'ın iş bölümüne dikkat et: `0`, `1..=20` ve `Some(...)`/`None` **şekil** sorularıdır, desene
  aittir. "Ad boş mu?", "sebep sadece boşluk mu?" ise bir metot çağrısı gerektirir, guard'a aittir. Guard'lı
  kollar eksiksizliğe sayılmadığı için her guard'lı kolun arkasından aynı varyantı kapsayan koşulsuz bir kol
  geliyor (`TeslimEdildi { .. }`, `Iade(sebep)`); onları unutsaydın E0004 alırdın.

  `Durum::Yolda { kalan_km: 0, .. }` kolunda `0` değişmezi bir `&u32` ile karşılaşıyor; varsayılan bağlama
  kipleri değişmez desenleri de referansın içine taşır. Kolların sırası kuralların önceliğini kodluyor: 0 km
  kolu en özeldir, en genel `Yolda { sehir, kalan_km }` en sonda.
```

## Guard'lar, @ bağlamaları ve dilim desenleri

```predict
code: |
  fn ozet(v: &[i32]) -> String {
      match v {
          [] => String::from("boş"),
          [x] if *x < 0 => format!("tek negatif {x}"),
          [x] => format!("tek {x}"),
          [ilk, .., son] if ilk == son => format!("aynı uçlar {ilk}"),
          [ilk, orta @ .., _] => format!("{ilk} ve {} ara", orta.len()),
      }
  }

  fn main() {
      for v in [&[-3][..], &[5], &[7, 1, 7], &[1, 2, 3, 4], &[2, 2]] {
          println!("{}", ozet(v));
      }
  }
options:
  - |
    tek negatif -3
    tek 5
    aynı uçlar 7
    1 ve 2 ara
    aynı uçlar 2
  - |
    tek negatif -3
    tek 5
    aynı uçlar 7
    1 ve 2 ara
    2 ve 0 ara
  - |
    tek negatif -3
    tek 5
    7 ve 1 ara
    1 ve 2 ara
    aynı uçlar 2
  - "Derlenmez: `[x]` deseni iki kez kullanılmış"
answer: 0
explanation: |
  `[x] if *x < 0` yalnızca tek elemanlı **ve** negatif dilime uyar; uymayan tek elemanlılar bir sonraki
  koşulsuz `[x]` koluna düşer. Aynı desenin iki kez yazılması hata değildir, çünkü ilki guard'lıdır.
  `[ilk, .., son]` en az iki elemanlı dilimlere uyar; `[2, 2]` için `..` **sıfır** eleman yutar ve uçlar eşit
  olduğu için "aynı uçlar 2" yazılır. `[1, 2, 3, 4]`'te guard yanlıştır; son kol `orta`'ya `[2, 3]` alt
  dilimini bağlar.
```

```compiles
code: |
  fn kategori(yas: u8) -> &'static str {
      match yas {
          0..=12 => "çocuk",
          y @ 13..=17 if y >= 16 => "genç (ehliyet kursuna yazılabilir)",
          13..=17 => "genç",
          18.. => "yetişkin",
      }
  }

  fn main() {
      for yas in [8, 16, 14, 30] {
          println!("{yas}: {}", kategori(yas));
      }
  }
answer: true
explanation: |
  Derlenir. Guard'lı kol eksiksizlik hesabına **sayılmaz**, ama sorun değil: geriye kalan koşulsuz kollar
  `0..=12`, `13..=17` ve `18..`, bir `u8`'in bütün değerlerini (0–255) kapsıyor. 16 yaşındaki için guard
  doğrudur ve ikinci kol seçilir; 14 yaşındaki için guard yanlış olur ve üçüncü kola düşer. Üçüncü kolu
  silseydin derleyici *pattern `13_u8..=17_u8` not covered* diyerek E0004 verirdi.
```

```quiz
question: |
  `let kuyruk: Vec<String> = ...;` için ilk iki ismi **taşımadan** bir dilim deseniyle almak istiyorsun.
  Hangisi derlenir ve doğru çalışır?
options:
  - "`match kuyruk { [a, b, ..] => ..., _ => ... }`"
  - "`match kuyruk.as_slice() { [a, b, ..] => ..., _ => ... }`"
  - "`match kuyruk[..] { [a, b, ..] => ..., _ => ... }`"
  - "`match box kuyruk { [a, b, ..] => ..., _ => ... }`"
answer: 1
explanation: |
  Dilim desenleri yalnızca dizilere ve dilimlere uyar. `as_slice()` bir `&[String]` verir; varsayılan
  bağlama kipleri sayesinde `a` ve `b` birer `&String` olur ve hiçbir şey taşınmaz. `&kuyruk[..]` de aynı
  işi görür.
feedback:
  - "`Vec` bir struct'tır, dilim değil: **E0529** *expected an array or slice, found `Vec<String>`*."
  - Doğru!
  - "`kuyruk[..]` bir `[String]` yeridir; `a` ve `b`'yi değerle bağlamak `String`'leri dilimin içinden taşımaya çalışır: **E0508** *cannot move out of type `[String]`, a non-copy slice*."
  - "İfade konumundaki `box` sözdizimi dilden tamamen kaldırıldı (*`box_syntax` has been removed*, `Box::new()` kullan); desen konumundaki `box` ise kararsızdır (E0658). İkisi de zaten `Box` içindir, `Vec` için değil."
```

```parsons
prompt: |
  Bir dilimdeki en büyük sayıyı **özyinelemeyle** bulan fonksiyonu kur. Boş dilim için `None` döner.
  Özyinelemeli çağrının sonucunu `?` operatörüyle (Modül 10) aç.
lines: |
  fn en_buyuk(sayilar: &[i32]) -> Option<i32> {
      match sayilar {
          [] => None,
          [x] => Some(*x),
          [bas, kalan @ ..] => {
              let k = en_buyuk(kalan)?;
              Some(if *bas > k { *bas } else { k })
          }
      }
  }
distractors: |
          [] => Some(0),
          [bas, ..kalan] => {
explanation: |
  `[x]` kolu şart: o olmasaydı her özyineleme sonunda boş dilime ulaşır, `None` döner ve `?` bu `None`'ı
  yukarı taşıyarak **her** girdi için `None` döndürürdü. `[] => Some(0)` ise yanlış bir varsayılandır:
  yalnızca negatif sayılardan oluşan bir dilimde sonucu 0 yapar. `..kalan` geçerli bir sözdizimi değildir;
  geri kalanı bağlamak için `kalan @ ..` yazılır. `[bas, kalan @ ..]` kolu en az iki elemanlı dilimlere
  ulaştığı için (tek elemanlılar bir önceki kolda yakalandı) `en_buyuk(kalan)` her zaman `Some` döner.
```

## Final: ters Lehçe hesap makinesi

Son alıştırma modülün neredeyse bütün araçlarını bir araya getiriyor: `|` ile birleşen değişmez desenler,
`let ... else`, tuple eşleştirme, guard ya da değişmez desen ile hata yakalama ve bir dilim deseniyle sonuç
seçimi.

```exercise
id: m21-boss-e-rpn
title: Ters Lehçe hesap makinesi
difficulty: 4
prompt: |
  **Ters Lehçe gösterimde** (Reverse Polish Notation, RPN) işleç sayılardan sonra yazılır: `3 4 +` = 7,
  `5 1 2 + 4 * + 3 -` = 14. Hesaplama bir **yığınla** yapılır: sayı gelince yığına it; işleç gelince
  yığından iki sayı çek (önce **sağ** işlenen `b`, sonra **sol** işlenen `a`), `a İŞLEÇ b`'yi hesapla ve
  sonucu geri it. Sonunda yığında tek bir sayı kalmalıdır.

  `hesapla(ifade: &str) -> Result<i64, String>` fonksiyonunu yaz. Parçalar boşluklarla ayrılır
  (`split_whitespace`). İşleçler `+ - * /` (tamsayı bölmesi). Hatalar **tam olarak** şu metinlerle dönmeli:

  | Durum | Hata |
  |---|---|
  | İşleç için yığında 2 sayı yok | `"yetersiz sayı: <işleç>"` |
  | Sayı da işleç de olmayan parça | `"geçersiz parça: <parça>"` |
  | Sıfıra bölme | `"sıfıra bölme"` |
  | Sonunda yığın boş | `"boş ifade"` |
  | Sonunda yığında birden fazla sayı | `"eksik işlem: yığında <n> sayı kaldı"` |

  Sonucu seçerken yığını bir **dilim deseniyle** eşleştir.
starter: |
  fn hesapla(ifade: &str) -> Result<i64, String> {
      todo!()
  }

  fn main() {
      for ifade in ["3 4 +", "5 1 2 + 4 * + 3 -", "4 0 /", "1 +", ""] {
          println!("{ifade:?} → {:?}", hesapla(ifade));
      }
  }
solution: |
  fn hesapla(ifade: &str) -> Result<i64, String> {
      let mut yigin: Vec<i64> = Vec::new();

      for parca in ifade.split_whitespace() {
          match parca {
              "+" | "-" | "*" | "/" => {
                  let (Some(b), Some(a)) = (yigin.pop(), yigin.pop()) else {
                      return Err(format!("yetersiz sayı: {parca}"));
                  };
                  let sonuc = match (parca, b) {
                      ("+", _) => a + b,
                      ("-", _) => a - b,
                      ("*", _) => a * b,
                      ("/", 0) => return Err(String::from("sıfıra bölme")),
                      _ => a / b,
                  };
                  yigin.push(sonuc);
              }
              sayi => {
                  let Ok(n) = sayi.parse::<i64>() else {
                      return Err(format!("geçersiz parça: {sayi}"));
                  };
                  yigin.push(n);
              }
          }
      }

      match yigin.as_slice() {
          [] => Err(String::from("boş ifade")),
          [sonuc] => Ok(*sonuc),
          fazla => Err(format!("eksik işlem: yığında {} sayı kaldı", fazla.len())),
      }
  }

  fn main() {
      for ifade in ["3 4 +", "5 1 2 + 4 * + 3 -", "4 0 /", "1 +", ""] {
          println!("{ifade:?} → {:?}", hesapla(ifade));
      }
  }
check: tests
tests: |
  #[test]
  fn temel_hesaplar() {
      assert_eq!(hesapla("3 4 +"), Ok(7));
      assert_eq!(hesapla("5 1 2 + 4 * + 3 -"), Ok(14));
      assert_eq!(hesapla("10 2 8 * + 3 -"), Ok(23));
      assert_eq!(hesapla("42"), Ok(42), "tek sayı kendisidir");
  }

  #[test]
  fn islenen_sirasi_ve_negatifler() {
      assert_eq!(hesapla("10 3 -"), Ok(7), "önce çekilen sayı SAĞ işlenendir: 10 - 3");
      assert_eq!(hesapla("20 5 /"), Ok(4), "20 / 5, 5 / 20 değil");
      assert_eq!(hesapla("7 2 /"), Ok(3), "tamsayı bölmesi");
      assert_eq!(hesapla("-4 2 *"), Ok(-8), "\"-4\" bir sayıdır, işleç değil");
      assert_eq!(hesapla("  2   3  +  "), Ok(5), "fazla boşluklar sorun olmamalı");
  }

  #[test]
  fn islem_hatalari() {
      assert_eq!(hesapla("4 +"), Err(String::from("yetersiz sayı: +")));
      assert_eq!(hesapla("*"), Err(String::from("yetersiz sayı: *")));
      assert_eq!(hesapla("4 0 /"), Err(String::from("sıfıra bölme")));
      assert_eq!(hesapla("2 x +"), Err(String::from("geçersiz parça: x")));
  }

  #[test]
  fn yigin_sonu_hatalari() {
      assert_eq!(hesapla(""), Err(String::from("boş ifade")));
      assert_eq!(hesapla("   "), Err(String::from("boş ifade")), "sadece boşluk da boş ifadedir");
      assert_eq!(hesapla("1 2 3 +"), Err(String::from("eksik işlem: yığında 2 sayı kaldı")));
      assert_eq!(hesapla("1 2 3"), Err(String::from("eksik işlem: yığında 3 sayı kaldı")));
  }
hints:
  - "Dış `match parca` iki kola ayrılır: `\"+\" | \"-\" | \"*\" | \"/\" => { ... }` ve diğer her şey için bir isim deseni (`sayi => { ... }`). Sayıyı `let Ok(n) = sayi.parse::<i64>() else { return Err(...) };` ile ayrıştır."
  - "İki sayıyı tek seferde çekmek için tuple + `let ... else`: `let (Some(b), Some(a)) = (yigin.pop(), yigin.pop()) else { ... };` Tuple elemanları soldan sağa değerlendirilir, yani önce `b` çekilir. Hesap için `match (parca, b)` ve sıfıra bölme kolu `(\"/\", 0) => return Err(...)`."
  - "Sonuç: `match yigin.as_slice() { [] => ..., [sonuc] => Ok(*sonuc), fazla => Err(format!(\"eksik işlem: yığında {} sayı kaldı\", fazla.len())) }`."
require:
  - pattern: "\\[\\s*\\w+\\s*\\]\\s*=>"
    message: "Sonucu yığın dilimini bir dilim deseniyle (`[sonuc] => ...`) eşleştirerek seç."
explanation: |
  Bu çözümde desenler her adımda bir karar veriyor:

  - `"+" | "-" | "*" | "/"`: dört string değişmezi tek kolda birleşiyor; geri kalan her parça `sayi` isim
    desenine düşüyor.
  - `let (Some(b), Some(a)) = (yigin.pop(), yigin.pop()) else { ... }`: iki `Option`'ı tek bir tuple deseniyle
    sınıyor. İkisinden biri `None` ise `else` ıraksıyor. Tuple ifadesi soldan sağa değerlendirildiği için ilk
    `pop` sağ işleneni verir; testlerdeki `10 3 -` tam bunu yakalar.
  - `match (parca, b)`: işleci ve sağ işleneni birlikte eşleştirmek, sıfıra bölmeyi `("/", 0)` değişmez
    deseniyle guard'a bile gerek kalmadan yakalıyor. Bu kolun `/` genel kolundan **önce** gelmesi şart.
  - `match yigin.as_slice()`: `[]`, `[sonuc]` ve geri kalanı bağlayan `fazla` deseni, yığının üç olası
    durumunu eksiksiz kapsıyor; derleyici bunu kendisi doğruluyor.

  `?` operatörüyle (`sayi.parse::<i64>().map_err(|_| format!(...))?`) de yazılabilirdi; `let ... else` ise
  hatanın metnini ve kontrol akışını aynı yerde, okunaklı biçimde gösteriyor. Gerçek bir hesap makinesinde
  taşmaları da `checked_add` / `checked_mul` ile yakalamak isterdin.
```
