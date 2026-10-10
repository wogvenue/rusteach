---
id: m06-boss
title: "Boss: Yapı Ustası"
minutes: 30
type: boss
objectives:
  - Modül 6'daki bütün konuları (struct'lar, tuple ve birim struct'lar, Debug, metotlar, ilişkili fonksiyonlar) karışık sorularla uygulayabilmek
  - Struct ve metot içeren kodda sahiplik ve ödünç alma hatalarını derlemeden öngörebilmek
  - Kurucuları ve metotları olan küçük tipleri testleri geçecek şekilde sıfırdan yazabilmek
keywords: [boss, struct, impl, metot, Self, Debug, dbg!, newtype]
---

Modülün sonuna geldin! Bu sınav, kendi tiplerini tasarlayıp onlara davranış kazandırabildiğini gösterecek.
Sorular derslerin sırasıyla değil, **karışık** geliyor; aralarda önceki modüllerden de birkaç soru var.
Geçmek için **%80** gerekiyor. Acele etme: her kod parçasında önce "kim sahip, kim ödünç alıyor?" diye sor.

## Struct'lar ve sahiplik

```compiles
code: |
  struct Ogrenci {
      ad: String,
      numara: u32,
      aktif: bool,
  }

  fn main() {
      let o1 = Ogrenci { ad: String::from("Ayşe"), numara: 1001, aktif: true };
      let o2 = Ogrenci { ad: String::from("Can"), ..o1 };
      println!("{} {} {} {}", o1.ad, o1.numara, o2.numara, o2.aktif);
  }
answer: true
explanation: |
  Derlenir ve `Ayşe 1001 1001 true` yazdırır. `..o1` yalnızca **açıkça yazılmayan** alanları `o1`'den alır:
  `numara` ve `aktif`. İkisi de `Copy` olduğu için kopyalanır. `ad` alanını açıkça verdiğimiz için `o1.ad`'a hiç
  dokunulmadı; `o1` tamamen geçerli kalır. `ad`'ı vermeseydik `o1.ad` `o2`'ye taşınır ve `o1.ad`'ı yazdırmak
  `E0382` verirdi.
```

```predict
code: |
  struct Renk(u8, u8, u8);

  fn main() {
      let turuncu = Renk(255, 165, 0);
      let Renk(r, g, b) = turuncu;
      let toplam = r as u32 + g as u32 + b as u32;
      println!("{toplam} {}", turuncu.1);
  }
options:
  - "420 165"
  - "420 255"
  - "Panik: u8 toplamı taşar (overflow)"
  - "Derlenmez: `turuncu` parçalanırken taşındı"
answer: 0
explanation: |
  - `let Renk(r, g, b) = turuncu;` tuple struct'ı parçalarına ayırır (Ders 2). Alanların hepsi `u8`, yani
    `Copy`; değerler kopyalanır ve `turuncu` geçerli kalır.
  - Modül 2'den: `255 + 165` bir `u8`'e sığmaz ve debug modunda panik verirdi. Ama burada her değer önce
    `as u32` ile genişletiliyor, toplam `420` olarak güvenle hesaplanıyor.
  - `.1` ikinci alandır (indeksler 0'dan başlar): `165`.
```

```compiles
code: |
  struct Metre(f64);
  struct Fit(f64);

  fn irtifa_yaz(m: Metre) {
      println!("İrtifa: {} m", m.0);
  }

  fn main() {
      let ucak = Fit(35_000.0);
      irtifa_yaz(ucak);
  }
answer: false
error: E0308
explanation: |
  `Metre` ve `Fit` içeride aynı `f64`'ü taşısa da **farklı tiplerdir**. Fonksiyon `Metre` bekliyor, ona `Fit`
  verilemez: `E0308 mismatched types`. Newtype deseninin bütün amacı bu (Ders 2): birim karışıklığını çalışma
  zamanında değil, **derleme zamanında** yakalamak. Düz `f64` kullansaydık bu hata sessizce geçerdi.
```

## Debug ve metotlar

```predict
question: Bu program **standart çıktıya (stdout)** ne yazdırır?
code: |
  #[derive(Debug)]
  struct Urun {
      ad: String,
      fiyat: f64,
  }

  fn main() {
      let u = Urun { ad: String::from("Simit"), fiyat: 15.0 };
      let adet = dbg!(2 * 3) + 1;
      println!("{u:?} x{adet}");
  }
options:
  - |
    Urun { ad: "Simit", fiyat: 15.0 } x7
  - |
    [src/main.rs:9:16] 2 * 3 = 6
    Urun { ad: "Simit", fiyat: 15.0 } x7
  - |
    Urun { ad: Simit, fiyat: 15 } x7
  - |
    Urun { ad: "Simit", fiyat: 15.0 } x6
answer: 0
explanation: |
  - `dbg!` çıktısını **stderr**'e yazar, stdout'a değil (Ders 3). `[src/main.rs:9:16] 2 * 3 = 6` satırı
    terminalde görünür ama programın standart çıktısının parçası değildir.
  - `dbg!` aldığı değeri **geri döndürür**: `dbg!(2 * 3)` ifadesinin değeri `6`, artı 1 → `7`.
  - `{:?}` biçiminde `String` tırnak içinde, `f64` her zaman ondalık noktasıyla yazılır: `"Simit"`, `15.0`.
```

```compiles
code: |
  struct Sayac {
      deger: u32,
  }

  impl Sayac {
      fn artir(&self) {
          self.deger += 1;
      }
  }

  fn main() {
      let mut s = Sayac { deger: 0 };
      s.artir();
      println!("{}", s.deger);
  }
answer: false
error: E0594
explanation: |
  `&self` **salt okunur** bir ödünçtür; onun arkasındaki alana yazamazsın: "cannot assign to `self.deger`,
  which is behind a `&` reference". Durumu değiştiren metot `&mut self` almalı (Ders 4). `main`'deki
  `let mut` tek başına yetmez: metodun imzası "değiştirmeyeceğim" diyorsa derleyici ona inanır ve bunu
  zorunlu kılar.
```

```fill
prompt: |
  Otobüs bileti tipine doğru **alıcıları** yaz: koltuğu okuyan, koltuğu değiştiren ve bileti iptal edip
  yolcunun adını geri veren üç metot.
code: |
  struct Bilet {
      yolcu: String,
      koltuk: u32,
  }

  impl Bilet {
      fn koltuk(___0) -> u32 {
          self.koltuk
      }

      fn koltuk_degistir(___1, yeni: u32) {
          self.koltuk = yeni;
      }

      fn iptal_et(___2) -> String {
          self.yolcu
      }
  }

  fn main() {
      let mut b = Bilet { yolcu: String::from("Mert Kaya"), koltuk: 12 };
      b.koltuk_degistir(27);
      println!("Koltuk: {}", b.koltuk());
      let ad = b.iptal_et();
      println!("{ad} adına bilet iptal edildi");
  }
blanks:
  - ["&self"]
  - ["&mut self"]
  - ["self", "mut self"]
output: |
  Koltuk: 27
  Mert Kaya adına bilet iptal edildi
explanation: |
  - `koltuk` sadece okuyor ve `Copy` bir `u32` döndürüyor → `&self`.
  - `koltuk_degistir` alanı değiştiriyor → `&mut self`.
  - `iptal_et`, `yolcu` alanındaki `String`'i **dışarı taşıyor**. Ödünç alınmış bir yapının içinden değer
    taşınamaz (`E0507`), bu yüzden metot bileti sahiplenmeli → `self`. İptal edilen bilet de zaten bir daha
    kullanılmamalı; tip sistemi bu iş kuralını uyguluyor.
```

```compiles
code: |
  struct Bilet {
      yolcu: String,
      koltuk: u32,
  }

  impl Bilet {
      fn iptal_et(self) -> String {
          self.yolcu
      }
  }

  fn main() {
      let b = Bilet { yolcu: String::from("Mert Kaya"), koltuk: 12 };
      let ad = b.iptal_et();
      println!("{ad}, koltuk {} boşaldı", b.koltuk);
  }
answer: false
error: E0382
explanation: |
  `iptal_et(self)` bileti **tüketir**: çağrıyla birlikte `b` metoda taşınır (Ders 4, Modül 4). Sonrasında
  `b.koltuk`'u okumak taşınmış bir değeri kullanmaktır: `E0382`. `koltuk` bir `u32` olsa bile fark etmez;
  `b`'nin tamamı taşındı. Koltuk numarası gerekiyorsa çağrıdan **önce** `let k = b.koltuk;` ile alınmalı.
```

## İlişkili fonksiyonlar ve tekrar

```quiz
question: "`impl Hesap { fn new(sahip: &str) -> Self { ... } }` tanımı için hangi satır **derlenir**?"
options:
  - "`let h = Hesap::new(\"Elif\");`"
  - "`let h = Hesap.new(\"Elif\");`"
  - "`let h = new Hesap(\"Elif\");`"
  - "`let h = Hesap { }.new(\"Elif\");`"
answer: 0
explanation: |
  `new` `self` almayan bir **ilişkili fonksiyondur**; tipin adı üzerinden `::` ile çağrılır (Ders 5). `::`
  yollar (tipler, modüller) için, `.` değerler için kullanılır.
feedback:
  - Doğru!
  - "`Hesap` bir değer değil, bir tip: `E0423`. Derleyici `::` (path separator) kullanmanı önerir."
  - "Rust'ta `new` bir operatör ya da anahtar kelime değildir; Java/C++ alışkanlığı. Bu bir sözdizimi hatasıdır."
  - "İki sorun var: `Hesap { }` eksik alanlı bir struct ifadesi (`E0063`) ve `new`'in `self`'i olmadığı için nokta ile çağrılamaz (`E0599`)."
```

```parsons
prompt: |
  Bir sera sensörü sıcaklığı **kelvin** olarak saklıyor. Ana kurucu `kelvinden`, ikinci isimli kurucu
  `celsiusdan` işi ona devretsin. Program `300.00` yazmalı. Dikkat, iki satır tuzak!
lines: |
  struct Sicaklik {
      kelvin: f64,
  }
  impl Sicaklik {
      fn kelvinden(k: f64) -> Self {
          Self { kelvin: k }
      }
      fn celsiusdan(c: f64) -> Self {
          Self::kelvinden(c + 273.15)
      }
  }
  fn main() {
      let sera = Sicaklik::celsiusdan(26.85);
      println!("{:.2}", sera.kelvin);
  }
distractors: |2
          self.kelvinden(c + 273.15)
      fn celsiusdan(&self, c: f64) -> Self {
explanation: |
  - `celsiusdan` yeni bir değer **üretiyor**; çalışmak için elinde bir sıcaklık olması gerekmez → `self` almaz.
    `&self` alsaydı, ilk sıcaklığı üretmek için önce bir sıcaklığa sahip olman gerekirdi.
  - `self` almayan bir fonksiyonun içinde `self` yoktur; diğer ilişkili fonksiyon `Self::kelvinden(...)` ile
    çağrılır.
  - `26.85 + 273.15 = 300.0`; `{:.2}` iki ondalık basamakla yazar (Modül 1) → `300.00`.
```

Şimdi önceki modüllerden iki soru.

```predict
code: |
  struct Kelime(String);

  impl Kelime {
      fn bayt_sayisi(&self) -> usize {
          self.0.len()
      }
  }

  fn main() {
      let k = Kelime(String::from("çiçek"));
      println!("{}", k.bayt_sayisi());
  }
options:
  - "5"
  - "7"
  - "10"
  - "Derlenmez: tuple struct'ın alanında metot çağrılamaz"
answer: 1
explanation: |
  Modül 4 ve 5'ten: `len()` **bayt** sayar, karakter değil. UTF-8'de `ç` 2 bayt, `i`, `e`, `k` birer bayttır:
  `ç`(2) + `i`(1) + `ç`(2) + `e`(1) + `k`(1) = **7**. `self.0` newtype'ın içindeki `String`'e erişir ve
  onun üzerinde her `String` metodu çağrılabilir.
```

```predict
code: |
  struct Hedef {
      adim: u32,
  }

  impl Hedef {
      fn gun_sayisi(&self, gunluk: u32) -> u32 {
          let mut toplam = 0;
          let mut gun = 0;
          loop {
              gun += 1;
              toplam += gunluk;
              if toplam >= self.adim {
                  break gun;
              }
          }
      }
  }

  fn main() {
      let hedef = Hedef { adim: 10_000 };
      println!("{}", hedef.gun_sayisi(3_000));
  }
options:
  - "3"
  - "4"
  - "12000"
  - "Derlenmez: `loop` bir değer döndüremez"
answer: 1
explanation: |
  Modül 3'ten: `loop`, `break deger;` ile bir değer üretebilir ve metodun son ifadesi olduğu için (noktalı
  virgülsüz) metodun dönüş değeri olur. Günler: 3.000, 6.000, 9.000 (hedefin altında), 12.000 ≥ 10.000 →
  4. günde `break gun;` çalışır. `3` cevabı tamsayı bölmesinin (`10_000 / 3_000 = 3`) tuzağıdır: 3 günde
  hedefe varılmıyor.
```

## Kod yazma

```exercise
id: m06-boss-karakter
title: Oyun karakteri
difficulty: 2
prompt: |
  Bir rol yapma oyunu için `Karakter` tipini tamamla. `max_can` hazır: 1. seviyede 100, her seviye +20.

  - `new(ad: &str) -> Self` — yeni karakter 1. seviyededir ve canı doludur (100).
  - `hasar_al(&mut self, miktar: u32)` — canı azaltır ama can **0'ın altına inmez** (`u32` taşmasına dikkat!).
  - `iyiles(&mut self, miktar: u32)` — canı artırır ama **`max_can()`'i aşamaz**.
  - `hayatta_mi(&self) -> bool` — can 0'dan büyükse `true`.
  - `seviye_atla(&mut self)` — seviyeyi bir artırır ve canı yeni seviyenin `max_can()` değerine doldurur.
starter: |
  #[derive(Debug)]
  struct Karakter {
      ad: String,
      can: u32,
      seviye: u32,
  }

  impl Karakter {
      fn new(ad: &str) -> Self {
          todo!()
      }

      fn max_can(&self) -> u32 {
          100 + (self.seviye - 1) * 20
      }

      fn hasar_al(&mut self, miktar: u32) {
          todo!()
      }

      fn iyiles(&mut self, miktar: u32) {
          todo!()
      }

      fn hayatta_mi(&self) -> bool {
          todo!()
      }

      fn seviye_atla(&mut self) {
          todo!()
      }
  }

  fn main() {
      let mut k = Karakter::new("Battal Gazi");
      k.hasar_al(30);
      k.iyiles(50);
      k.seviye_atla();
      println!("{k:?} hayatta mı? {}", k.hayatta_mi());
  }
solution: |
  #[derive(Debug)]
  struct Karakter {
      ad: String,
      can: u32,
      seviye: u32,
  }

  impl Karakter {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              can: 100,
              seviye: 1,
          }
      }

      fn max_can(&self) -> u32 {
          100 + (self.seviye - 1) * 20
      }

      fn hasar_al(&mut self, miktar: u32) {
          self.can = self.can.saturating_sub(miktar);
      }

      fn iyiles(&mut self, miktar: u32) {
          let yeni = self.can + miktar;
          let ust = self.max_can();
          self.can = if yeni > ust { ust } else { yeni };
      }

      fn hayatta_mi(&self) -> bool {
          self.can > 0
      }

      fn seviye_atla(&mut self) {
          self.seviye += 1;
          self.can = self.max_can();
      }
  }

  fn main() {
      let mut k = Karakter::new("Battal Gazi");
      k.hasar_al(30);
      k.iyiles(50);
      k.seviye_atla();
      println!("{k:?} hayatta mı? {}", k.hayatta_mi());
  }
check: tests
tests: |
  #[test]
  fn yeni_karakter_dolu_canla_baslar() {
      let k = Karakter::new("Nasreddin");
      assert_eq!(k.ad, "Nasreddin", "ad kurucuya verilen ad olmalı");
      assert_eq!((k.can, k.seviye), (100, 1), "yeni karakter 100 can ve 1. seviyeyle başlamalı");
      assert!(k.hayatta_mi(), "yeni karakter hayatta olmalı");
  }

  #[test]
  fn hasar_cani_sifirin_altina_indirmez() {
      let mut k = Karakter::new("Keloğlan");
      k.hasar_al(35);
      assert_eq!(k.can, 65, "100 - 35 = 65 olmalı");
      k.hasar_al(500);
      assert_eq!(k.can, 0, "can 0'ın altına inmemeli (ve panik olmamalı)");
      assert!(!k.hayatta_mi(), "canı 0 olan karakter hayatta değildir");
  }

  #[test]
  fn iyilesme_maksimumu_asmaz() {
      let mut k = Karakter::new("Dede Korkut");
      k.hasar_al(40);
      k.iyiles(25);
      assert_eq!(k.can, 85, "60 + 25 = 85 olmalı");
      k.iyiles(1000);
      assert_eq!(k.can, 100, "1. seviyede can 100'ü aşmamalı");
  }

  #[test]
  fn seviye_atlayinca_can_dolar_ve_sinir_artar() {
      let mut k = Karakter::new("Battal Gazi");
      k.hasar_al(90);
      k.seviye_atla();
      assert_eq!((k.seviye, k.can), (2, 120), "2. seviyede can 120'ye dolmalı");
      k.hasar_al(50);
      k.iyiles(100);
      assert_eq!(k.can, 120, "2. seviyede iyileşme sınırı 120 olmalı");
  }
hints:
  - "Kurucu: `Self { ad: String::from(ad), can: 100, seviye: 1 }`. `hayatta_mi` tek bir karşılaştırma: `self.can > 0`."
  - "`hasar_al`'da `self.can - miktar` yazarsan, `miktar` candan büyük olduğunda `u32` taşar ve debug modunda **panik** olur (Modül 2). Modül 2'deki `saturating_` ailesini hatırla: `self.can.saturating_sub(miktar)` 0'da durur. (Ya da önce `if miktar >= self.can` ile kontrol et.)"
  - "`iyiles`: önce `let yeni = self.can + miktar;` ve `let ust = self.max_can();`, sonra `self.can = if yeni > ust { ust } else { yeni };`. `seviye_atla`: önce `self.seviye += 1;`, **sonra** `self.can = self.max_can();` (sıra önemli!)."
explanation: |
  Metotlar karakterin **değişmezini** koruyor: can her zaman `0..=max_can()` aralığında. Bu kuralı yalnızca
  bu beş metot biliyor; oyunun geri kalanı can değerini elle hesaplamak zorunda kalmıyor.

  `saturating_sub` işaretsiz tamsayılarda çıkarmanın güvenli hâlidir: sonuç 0'ın altına düşecekse 0'da durur.
  Rust'ta `u32` taşması debug modunda panik, release modunda sessiz sarma (wrap) olur; C'de ise canın
  4 milyara fırlaması gibi meşhur oyun hatalarına yol açar.

  `seviye_atla`'da sıra önemli: `max_can()` `self.seviye`'yi okuduğu için önce seviyeyi artırmalısın. Ters
  sırayla yazsaydın can eski seviyenin sınırına (100) dolardı ve son test bunu yakalardı. `iyiles` içinde
  `self.max_can()` çağırabiliyoruz, çünkü `&mut self` geçici olarak `&self`'e dönüşebilir (yeniden ödünç alma).
```

```exercise
id: m06-boss-sepet
title: Market sepeti
difficulty: 3
prompt: |
  Bir online market için sepet yazıyorsun. Fiyatlar **kuruş** cinsinden (`u64`) tutuluyor. Tamamla:

  - `Sepet::new() -> Self` — boş sepet.
  - `ekle(&mut self, ad: &str, fiyat: u64, adet: u32)` — sepette **aynı adlı** ürün varsa yeni satır açmaz,
    sadece adedini artırır (fiyat değişmez). Yoksa yeni bir `Urun` ekler.
  - `toplam(&self) -> u64` — bütün ürünler için `fiyat × adet` toplamı (kuruş).
  - `cikar(&mut self, ad: &str, adet: u32) -> bool` — üründen `adet` kadar azaltır ve `true` döndürür. Ürün
    yoksa ya da sepetteki adet yetmiyorsa **hiçbir şeyi değiştirmeden** `false` döndürür. Adet 0'a inerse ürün
    sepetten **tamamen silinir**.
starter: |
  #[derive(Debug)]
  struct Urun {
      ad: String,
      fiyat: u64,
      adet: u32,
  }

  #[derive(Debug)]
  struct Sepet {
      urunler: Vec<Urun>,
  }

  impl Sepet {
      fn new() -> Self {
          todo!()
      }

      fn ekle(&mut self, ad: &str, fiyat: u64, adet: u32) {
          todo!()
      }

      fn toplam(&self) -> u64 {
          todo!()
      }

      fn cikar(&mut self, ad: &str, adet: u32) -> bool {
          todo!()
      }
  }

  fn main() {
      let mut s = Sepet::new();
      s.ekle("Çay", 4_500, 2);
      s.ekle("Simit", 1_500, 3);
      s.ekle("Çay", 4_500, 1);
      s.cikar("Simit", 3);
      println!("{:?}", s.urunler);
      println!("Toplam: {} kuruş", s.toplam());
  }
solution: |
  #[derive(Debug)]
  struct Urun {
      ad: String,
      fiyat: u64,
      adet: u32,
  }

  #[derive(Debug)]
  struct Sepet {
      urunler: Vec<Urun>,
  }

  impl Sepet {
      fn new() -> Self {
          Self { urunler: Vec::new() }
      }

      fn ekle(&mut self, ad: &str, fiyat: u64, adet: u32) {
          for u in self.urunler.iter_mut() {
              if u.ad == ad {
                  u.adet += adet;
                  return;
              }
          }
          self.urunler.push(Urun { ad: String::from(ad), fiyat, adet });
      }

      fn toplam(&self) -> u64 {
          let mut t = 0;
          for u in &self.urunler {
              t += u.fiyat * u.adet as u64;
          }
          t
      }

      fn cikar(&mut self, ad: &str, adet: u32) -> bool {
          for i in 0..self.urunler.len() {
              if self.urunler[i].ad == ad {
                  if self.urunler[i].adet < adet {
                      return false;
                  }
                  self.urunler[i].adet -= adet;
                  if self.urunler[i].adet == 0 {
                      self.urunler.remove(i);
                  }
                  return true;
              }
          }
          false
      }
  }

  fn main() {
      let mut s = Sepet::new();
      s.ekle("Çay", 4_500, 2);
      s.ekle("Simit", 1_500, 3);
      s.ekle("Çay", 4_500, 1);
      s.cikar("Simit", 3);
      println!("{:?}", s.urunler);
      println!("Toplam: {} kuruş", s.toplam());
  }
check: tests
tests: |
  #[test]
  fn ayni_urun_birlesir() {
      let mut s = Sepet::new();
      s.ekle("Peynir", 18_000, 1);
      s.ekle("Zeytin", 9_000, 2);
      s.ekle("Peynir", 18_000, 2);
      assert_eq!(s.urunler.len(), 2, "aynı adlı ürün yeni satır açmamalı");
      assert_eq!(s.urunler[0].adet, 3, "peynirin adedi 1 + 2 = 3 olmalı");
      assert_eq!(s.urunler[1].ad, "Zeytin", "ürünler eklenme sırasıyla durmalı");
  }

  #[test]
  fn toplam_kurus_olarak_hesaplanir() {
      let mut s = Sepet::new();
      assert_eq!(s.toplam(), 0, "boş sepetin toplamı 0 olmalı");
      s.ekle("Ekmek", 1_250, 4);
      s.ekle("Süt", 3_375, 2);
      assert_eq!(s.toplam(), 11_750, "4 × 12,50 + 2 × 33,75 = 117,50 TL = 11750 kuruş olmalı");
  }

  #[test]
  fn kismi_cikarma_adedi_azaltir() {
      let mut s = Sepet::new();
      s.ekle("Simit", 1_500, 5);
      assert!(s.cikar("Simit", 2), "5 simitten 2 tanesi çıkarılabilmeli");
      assert_eq!(s.urunler[0].adet, 3, "5 - 2 = 3 simit kalmalı");
  }

  #[test]
  fn adet_sifira_inince_urun_silinir() {
      let mut s = Sepet::new();
      s.ekle("Çay", 4_500, 1);
      s.ekle("Simit", 1_500, 2);
      s.ekle("Kaşar", 21_000, 1);
      assert!(s.cikar("Simit", 2), "bütün simitler çıkarılabilmeli");
      assert_eq!(s.urunler.len(), 2, "adedi 0'a inen ürün sepetten silinmeli");
      assert_eq!(s.urunler[1].ad, "Kaşar", "silinen ürünün arkasındaki ürün yerinde olmalı");
  }

  #[test]
  fn yetersiz_ya_da_olmayan_urun_cikarilamaz() {
      let mut s = Sepet::new();
      s.ekle("Yumurta", 600, 10);
      assert!(!s.cikar("Yumurta", 11), "10 yumurtadan 11 tanesi çıkarılamaz");
      assert_eq!(s.urunler[0].adet, 10, "başarısız çıkarma adedi değiştirmemeli");
      assert!(!s.cikar("Bal", 1), "sepette olmayan ürün çıkarılamaz");
  }
hints:
  - "`new`: `Self { urunler: Vec::new() }`. `toplam`: `let mut t = 0;` ve `for u in &self.urunler { t += u.fiyat * u.adet as u64; }`. `adet` bir `u32`, `fiyat` bir `u64`; çarpmadan önce `as u64` ile tipleri eşitle (Modül 2)."
  - "`ekle`: `for u in self.urunler.iter_mut()` ile aynı adlı ürünü ara; bulursan `u.adet += adet;` ve hemen `return;`. Döngü biterse ürün yoktur: `self.urunler.push(Urun { ad: String::from(ad), fiyat, adet });`."
  - "`cikar`: silme ihtimali olduğu için indeksle dolaş (`for i in 0..self.urunler.len()`). Adı tutan üründe önce `if self.urunler[i].adet < adet { return false; }`, sonra azalt; adet 0 olduysa `self.urunler.remove(i);`. En sonda `return true;`; döngü biterse `false`."
explanation: |
  Bu alıştırma projedeki üç deseni birleştiriyor: **ara-ve-güncelle** (`ekle`), **topla** (`toplam`) ve
  **ara-ve-sil** (`cikar`). `ekle`'de `return;` (değersiz erken dönüş) bulunca döngüyü keser; böylece aynı
  ürün iki kez artırılmaz ve `push`'a hiç ulaşılmaz.

  `cikar`'da kontrolün değişiklikten **önce** yapılması önemli. Önce azaltıp sonra kontrol etseydin, `u32`
  `10 - 11` işleminde taşar ve panik verirdi; ayrıca başarısız işlem sepeti bozmuş olurdu.

  `u.ad == ad` bir `String` ile bir `&str`'yi karşılaştırır; Rust buna izin verir. Para hesaplarında
  `f64` yerine kuruş cinsinden tamsayı kullanmak da bilinçli bir seçim: Modül 2'deki `0.1 + 0.2` sorununu
  hatırla, kuruşlar kaybolmasın. Modül 9'da `HashMap<String, Urun>` ile aramayı döngüsüz yapacaksın.
```

```exercise
id: m06-boss-kargo
title: Kargo takibi — geçersiz durumlar derlenmesin
difficulty: 4
prompt: |
  Bir kargo şirketi, "henüz kargoya verilmemiş bir siparişin teslim edilmesi" gibi hataların **hiç
  yazılamamasını** istiyor. Bunun için her aşama ayrı bir tip:
  `Siparis` → `kargola` → `Kargoda` → `teslim_et` → `Teslim`. Her geçiş metodu önceki aşamayı **tüketir**
  (`self`), böylece aynı sipariş iki kez kargolanamaz.

  - `Siparis::new(no: u32, urun: &str) -> Self`
  - `kargola(self, sube: u32) -> Kargoda` — takip kodu `"TR"` + sipariş numarası (en az **6 haneli**, soldan
    sıfırlı) + `"-"` + şube numarası olmalı. Örnek: sipariş 42, şube 7 → `"TR000042-7"`.
  - `teslim_et(self, alan: &str) -> Teslim`
  - `ozet(&self) -> String` — örnek: `"#42 Çaydanlık → Zeynep Arslan (TR000042-7)"`

  `urun` ve takip kodu bir aşamadan diğerine **taşınmalı**: `clone` kullanma.
starter: |
  #[derive(Debug)]
  struct Siparis {
      no: u32,
      urun: String,
  }

  #[derive(Debug)]
  struct Kargoda {
      no: u32,
      urun: String,
      takip: String,
  }

  #[derive(Debug)]
  struct Teslim {
      no: u32,
      urun: String,
      takip: String,
      alan: String,
  }

  impl Siparis {
      fn new(no: u32, urun: &str) -> Self {
          todo!()
      }

      fn kargola(self, sube: u32) -> Kargoda {
          todo!()
      }
  }

  impl Kargoda {
      fn teslim_et(self, alan: &str) -> Teslim {
          todo!()
      }
  }

  impl Teslim {
      fn ozet(&self) -> String {
          todo!()
      }
  }

  fn main() {
      let s = Siparis::new(42, "Çaydanlık");
      let k = s.kargola(7);
      println!("{k:?}");
      let t = k.teslim_et("Zeynep Arslan");
      println!("{}", t.ozet());
  }
solution: |
  #[derive(Debug)]
  struct Siparis {
      no: u32,
      urun: String,
  }

  #[derive(Debug)]
  struct Kargoda {
      no: u32,
      urun: String,
      takip: String,
  }

  #[derive(Debug)]
  struct Teslim {
      no: u32,
      urun: String,
      takip: String,
      alan: String,
  }

  impl Siparis {
      fn new(no: u32, urun: &str) -> Self {
          Self { no, urun: String::from(urun) }
      }

      fn kargola(self, sube: u32) -> Kargoda {
          let takip = format!("TR{:06}-{}", self.no, sube);
          Kargoda { no: self.no, urun: self.urun, takip }
      }
  }

  impl Kargoda {
      fn teslim_et(self, alan: &str) -> Teslim {
          Teslim {
              no: self.no,
              urun: self.urun,
              takip: self.takip,
              alan: String::from(alan),
          }
      }
  }

  impl Teslim {
      fn ozet(&self) -> String {
          format!("#{} {} → {} ({})", self.no, self.urun, self.alan, self.takip)
      }
  }

  fn main() {
      let s = Siparis::new(42, "Çaydanlık");
      let k = s.kargola(7);
      println!("{k:?}");
      let t = k.teslim_et("Zeynep Arslan");
      println!("{}", t.ozet());
  }
check: tests
tests: |
  #[test]
  fn takip_kodu_dogru_bicimde() {
      let k = Siparis::new(42, "Çaydanlık").kargola(7);
      assert_eq!(k.takip, "TR000042-7", "42 numaralı sipariş, 7 numaralı şube → TR000042-7");
      let k = Siparis::new(1234567, "Halı").kargola(35);
      assert_eq!(k.takip, "TR1234567-35", "6 haneden uzun numaralar kesilmeden yazılmalı");
  }

  #[test]
  fn kargolama_bilgileri_tasir() {
      let k = Siparis::new(901, "Bakır cezve").kargola(1);
      assert_eq!(k.no, 901, "sipariş numarası korunmalı");
      assert_eq!(k.urun, "Bakır cezve", "ürün adı kargoya taşınmalı");
  }

  #[test]
  fn teslim_ve_ozet() {
      let t = Siparis::new(77, "Lokum kutusu").kargola(12).teslim_et("Emre Şahin");
      assert_eq!(t.alan, "Emre Şahin", "teslim alan kişi kaydedilmeli");
      assert_eq!(t.takip, "TR000077-12", "takip kodu teslimde de korunmalı");
      assert_eq!(
          t.ozet(),
          "#77 Lokum kutusu → Emre Şahin (TR000077-12)",
          "özet biçimi: #no ürün → alan (takip)"
      );
  }
hints:
  - "Takip kodu için Modül 1'deki biçimlendirme: `{:06}` en az 6 hane, eksikse soldan sıfır. `format!(\"TR{:06}-{}\", self.no, sube)`."
  - "`kargola` `self`'i sahiplendiği için alanları **taşıyarak** yeni struct'a koyabilirsin: `Kargoda { no: self.no, urun: self.urun, takip }`. `self` ödünç değil, senin; içinden alan taşımak serbest."
  - "`teslim_et` aynı fikir: `Teslim { no: self.no, urun: self.urun, takip: self.takip, alan: String::from(alan) }`. `ozet` sadece okur (`&self`): `format!(\"#{} {} → {} ({})\", self.no, self.urun, self.alan, self.takip)`."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: "`clone` kullanma: metotlar `self`'i sahiplendiği için alanları doğrudan taşıyabilirsin."
explanation: |
  Bu desenin adı **tip durumu (typestate)**: siparişin hangi aşamada olduğu bir alanla değil, **tipin
  kendisiyle** ifade ediliyor. `Siparis` üzerinde `teslim_et` metodu **yok**; kargolanmamış bir siparişi teslim
  etmeye çalışan kod `E0599` ile derlenmez. `kargola(self)` siparişi tükettiği için `s.kargola(7)` iki kez de
  çağrılamaz (`E0382`). Çalışma zamanında hiçbir `if durum == ...` kontrolü yazmadık; kurallar derleyicide.

  `self` alan metotlar, alanları `clone` etmeden yeni tipe **taşıyabilir**: `urun`'un heap'teki metni bir kez
  oluşturuldu ve üç aşama boyunca yalnızca sahibi değişti. `&self` alsaydık `self.urun`'u taşıyamazdık
  (`E0507`) ve kopyalamak zorunda kalırdık.

  `{:06}` bir **alt sınırdır**: 6 haneden kısa sayıları sıfırla doldurur, uzunları kesmez (`TR1234567-35`).
  Modül 7'de aynı fikri `enum` ile, Modül 20'de trait'lerle daha genel biçimde göreceksin.
```
