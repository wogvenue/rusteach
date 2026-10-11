---
id: m06-l02
title: Tuple struct'lar ve birim struct'lar
minutes: 17
type: lesson
objectives:
  - Tuple struct tanımlayıp alanlarına `.0`, `.1` ile erişebilmek ve onu parçalarına ayırabilmek
  - Newtype desenini kullanarak birbirine karışabilecek değerleri (Metre/Fit, Celsius/Fahrenheit) tip düzeyinde ayırabilmek
  - Birim struct'ın ne olduğunu ve neden bellekte yer kaplamadığını açıklayabilmek
  - Bir veri için adlandırılmış alanlı struct, tuple struct, birim struct ya da düz tuple arasında gerekçeli seçim yapabilmek
keywords: [tuple struct, newtype, unit struct, birim struct, E0308, E0369, sıfır maliyet]
---

Her veri için alan adlarına ihtiyacın yok. Bir rengi `Renk { kirmizi: 255, yesil: 165, mavi: 0 }` diye
yazmak biraz fazla törensel, değil mi? Herkes RGB sırasını bilir: `Renk(255, 165, 0)` yeterli.

Bu derste struct'ın iki "hafif" kardeşini tanıyacaksın: **tuple struct** ve **birim struct**. Ayrıca,
yüz milyonlarca dolarlık bir uzay aracını kurtarabilecek kadar basit bir fikir öğreneceksin: **newtype
deseni**.

## Tuple struct: isimli bir tuple

Tuple struct, alanlarına ad vermediğin bir struct'tır. Tanımı bir tuple'a, kullanımı bir struct'a benzer:

```rust
struct Renk(u8, u8, u8);
struct Nokta(i32, i32);

fn main() {
    let turuncu = Renk(255, 165, 0);
    let baslangic = Nokta(0, 0);

    // Alanlara sırayla .0, .1, .2 ile erişilir - tıpkı tuple'larda olduğu gibi
    println!("Kırmızı kanal: {}", turuncu.0);
    println!("RGB: {} {} {}", turuncu.0, turuncu.1, turuncu.2);
    println!("Başlangıç: ({}, {})", baslangic.0, baslangic.1);
}
```

- Tanım: `struct Ad(Tip1, Tip2, ...);`, sonunda **noktalı virgül** var, süslü parantez yok.
- Oluşturma: `Ad(deger1, deger2, ...)`, tıpkı bir fonksiyon çağrısı gibi görünür.
- Erişim: `.0`, `.1`, ... (Modül 2'deki tuple'larla aynı).

Modül 2'de bir tuple'ı `let (a, b) = t;` ile parçalarına ayırmıştın. Tuple struct'larda da aynısını,
başına tip adını yazarak yapabilirsin. Tahmin et:

```predict
code: |
  struct Renk(u8, u8, u8);

  fn main() {
      let turuncu = Renk(255, 165, 0);
      let Renk(kirmizi, yesil, mavi) = turuncu;
      println!("{} {} {}", mavi, yesil, kirmizi);
      println!("{}", turuncu.1);
  }
options:
  - |
    0 165 255
    165
  - |
    255 165 0
    165
  - Derlenmez, çünkü `turuncu` parçalanırken taşındı
answer: 0
explanation: |
  `let Renk(kirmizi, yesil, mavi) = turuncu;` alanları **sırayla** değişkenlere bağlar: `kirmizi = 255`,
  `yesil = 165`, `mavi = 0`. Biz onları ters sırada yazdırdık: `0 165 255`.

  Peki `turuncu` neden hâlâ kullanılabiliyor? Çünkü üç alan da `u8`, yani `Copy`: parçalama onları
  **kopyaladı**, hiçbir şey taşınmadı. Alanlardan biri `String` olsaydı o alan taşınırdı.
```

## Aynı şekil, farklı tip

Şimdi kritik bir soru. Aşağıda **içleri birebir aynı** olan iki tuple struct var. Biri diğerinin
yerine kullanılabilir mi?

```compiles
code: |
  struct Renk(u8, u8, u8);
  struct Konum(u8, u8, u8);

  fn boya(r: Renk) {
      println!("{} {} {}", r.0, r.1, r.2);
  }

  fn main() {
      let k = Konum(10, 20, 30);
      boya(k);
  }
answer: false
error: E0308
explanation: |
  `Renk` ve `Konum`'un içi aynı (`u8, u8, u8`) ama ikisi **farklı tiplerdir**. Rust tipleri
  şekillerine göre değil, **adlarına** göre karşılaştırır. `boya` bir `Renk` bekliyor; ona `Konum`
  verirsen `E0308: mismatched types` alırsın.
```

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:10:10
   |
10 |     boya(k);
   |     ---- ^ expected `Renk`, found `Konum`
   |     |
   |     arguments to this function are incorrect
   |
note: function defined here
  --> src/main.rs:4:4
   |
 4 | fn boya(r: Renk) {
   |    ^^^^ -------
```
:::

Düz tuple'larda durum farklıdır: `(u8, u8, u8)` tipindeki **her** üçlü, aynı tipteki her parametreye
uyar; renk, konum, tarih... derleyici ayırt edemez. Tuple struct ise üçlüye bir **kimlik** kazandırır.

Bu davranışa **nominal tipleme (nominal typing)** denir: iki tipin aynı olması için adlarının aynı
olması gerekir. Rust, Java ve C++ böyledir. TypeScript ise **yapısal (structural)** tiplemeyi seçer:
alanları aynı olan iki tip birbirinin yerine geçebilir. Rust'ın tercihi, bir sonraki adımda göreceğin
güçlü bir deseni mümkün kılar.

## Newtype deseni: karışıklığı tiplerle önlemek

:::info 125 milyon dolarlık birim hatası
1999'da NASA'nın **Mars Climate Orbiter** uydusu Mars atmosferine fazla dalıp kayboldu. Sebep: Bir
ekibin yazılımı itki değerini **pound-kuvvet·saniye** cinsinden üretiyor, diğer ekibin yazılımı aynı
sayıyı **newton·saniye** sanıyordu. İki taraf da düz birer sayı (`double`) kullandığı için hiçbir
derleyici, hiçbir test bu karışıklığı yakalamadı.
:::

Rust'ta bu hatayı **derleme zamanında** yakalamak bir satır sürer. Tek alanlı bir tuple struct ile
mevcut bir tipi (burada `f64`) yeni, ayrı bir tipe sararsın. Buna **newtype deseni** denir:

```rust
struct Metre(f64);
struct Fit(f64);

fn fitten_metreye(f: Fit) -> Metre {
    Metre(f.0 * 0.3048)
}

fn kalan_yukseklik(zirve: Metre, cikilan: Metre) -> Metre {
    Metre(zirve.0 - cikilan.0)
}

fn main() {
    let erciyes = Metre(3917.0);
    let altimetre = Fit(9000.0); // yurt dışından aldığın saat fit gösteriyor
    let cikilan = fitten_metreye(altimetre);
    let kalan = kalan_yukseklik(erciyes, cikilan);
    println!("Zirveye {:.1} metre kaldı.", kalan.0);
}
```

Dönüştürmeyi unutursan program derlenmez bile:

```rust,compile_fail,E0308
struct Metre(f64);
struct Fit(f64);

fn kalan_yukseklik(zirve: Metre, cikilan: Metre) -> Metre {
    Metre(zirve.0 - cikilan.0)
}

fn main() {
    let erciyes = Metre(3917.0);
    let altimetre = Fit(9000.0);
    let kalan = kalan_yukseklik(erciyes, altimetre); // dönüştürmeyi unuttuk!
    println!("{}", kalan.0);
}
```

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:11:42
   |
11 |     let kalan = kalan_yukseklik(erciyes, altimetre); // dönüştürmeyi unuttuk!
   |                 ---------------          ^^^^^^^^^ expected `Metre`, found `Fit`
   |                 |
   |                 arguments to this function are incorrect
```
Mars Climate Orbiter'ı kaybettiren karışıklık, Rust'ta bir derleme hatası olurdu.
:::

:::analogy Dizel ve benzin tabancası
Birçok ülkede akaryakıt istasyonundaki **dizel tabancası**, benzinli araçların depo ağzından daha geniş
yapılır. İkisinin içinden akan şey de "yakıt"tır ama ağızlarının şekli farklı olduğu için yanlış yakıtı
koymak fiziksel olarak zorlaşır. Newtype de verine böyle bir "ağız şekli" verir: `Metre` ile `Fit`'in
ikisi de içinde `f64` taşır ama derleyici birini diğerinin deliğine sokmana izin vermez.
:::

Bu güvenlik bedava mı? **Evet.** `Metre(f64)` bellekte düz bir `f64` ile birebir aynıdır: 8 bayt, ek
işlem yok. Tip bilgisi yalnızca derleme sırasında var olur. Buna **sıfır maliyetli soyutlama
(zero-cost abstraction)** denir, Rust'ın en sevdiğin özelliklerinden biri olacak.

Newtype'ın bir bedeli ise var. Tahmin et:

```compiles
code: |
  struct Metre(f64);

  fn main() {
      let a = Metre(3.0);
      let b = Metre(2.0);
      let c = a + b;
      println!("{}", c.0);
  }
answer: false
error: E0369
explanation: |
  Newtype, iç tipin işlemlerini **devralmaz**. `f64`'ler toplanabilir ama `Metre` yeni bir tiptir ve
  ona henüz kimse "toplanabilirsin" dememiştir: `E0369: cannot add Metre to Metre`. Şimdilik
  `Metre(a.0 + b.0)` yazarsın; Modül 22'de `+` operatörünü kendi tiplerin için tanımlamayı öğreneceksin.
```

:::error
```text
error[E0369]: cannot add `Metre` to `Metre`
  --> src/main.rs:6:15
   |
 6 |     let c = a + b;
   |             - ^ - Metre
   |             |
   |             Metre
   |
note: an implementation of `Add` might be missing for `Metre`
```
Bu bir kusur değil, bir özelliktir: hangi işlemlerin anlamlı olduğuna **sen** karar verirsin. İki
mesafeyi toplamak anlamlıdır, ama iki `OgrenciNo`'yu toplamak anlamsızdır, newtype bunu da engeller.
:::

```exercise
id: m06-e-sicaklik
title: Hava durumu dönüştürücü
difficulty: 2
prompt: |
  Bir hava durumu uygulaması yazıyorsun. Türkiye'deki istasyonlar **Celsius**, ABD'den gelen veriler
  **Fahrenheit** gönderiyor. İkisini karıştırmamak için iki newtype tanımlandı. Dönüşüm fonksiyonlarını
  tamamla:

  - `c_den_f(c: Celsius) -> Fahrenheit`, formül: `F = C × 9 / 5 + 32`
  - `f_den_c(f: Fahrenheit) -> Celsius`, formül: `C = (F − 32) × 5 / 9`

  İpucu: Ondalıklı sayılarla çalışıyorsun; sabitleri `9.0`, `5.0`, `32.0` diye yaz.
starter: |
  struct Celsius(f64);
  struct Fahrenheit(f64);

  fn c_den_f(c: Celsius) -> Fahrenheit {
      todo!()
  }

  fn f_den_c(f: Fahrenheit) -> Celsius {
      todo!()
  }

  fn main() {
      let isparta = Celsius(23.0);
      let teksas = Fahrenheit(95.0);
      println!("Isparta: {}°F", c_den_f(isparta).0);
      println!("Teksas: {}°C", f_den_c(teksas).0);
  }
solution: |
  struct Celsius(f64);
  struct Fahrenheit(f64);

  fn c_den_f(c: Celsius) -> Fahrenheit {
      Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)
  }

  fn f_den_c(f: Fahrenheit) -> Celsius {
      Celsius((f.0 - 32.0) * 5.0 / 9.0)
  }

  fn main() {
      let isparta = Celsius(23.0);
      let teksas = Fahrenheit(95.0);
      println!("Isparta: {}°F", c_den_f(isparta).0);
      println!("Teksas: {}°C", f_den_c(teksas).0);
  }
check: tests
tests: |
  #[test]
  fn kaynama_noktasi() {
      let f = c_den_f(Celsius(100.0));
      assert!((f.0 - 212.0).abs() < 1e-9, "100°C = 212°F olmalı, gelen: {}", f.0);
  }

  #[test]
  fn donma_noktasi() {
      let c = f_den_c(Fahrenheit(32.0));
      assert!(c.0.abs() < 1e-9, "32°F = 0°C olmalı, gelen: {}", c.0);
  }

  #[test]
  fn eksi_kirk_iki_olcekte_ayni() {
      let f = c_den_f(Celsius(-40.0));
      assert!((f.0 + 40.0).abs() < 1e-9, "-40°C = -40°F olmalı, gelen: {}", f.0);
      let c = f_den_c(Fahrenheit(-40.0));
      assert!((c.0 + 40.0).abs() < 1e-9, "-40°F = -40°C olmalı, gelen: {}", c.0);
  }

  #[test]
  fn gidis_donus_ayni_degeri_verir() {
      let c = f_den_c(c_den_f(Celsius(36.6)));
      assert!((c.0 - 36.6).abs() < 1e-9, "C → F → C dönüşümü 36.6'yı korumalı, gelen: {}", c.0);
  }
hints:
  - "İç değere `.0` ile ulaş, hesapla, sonucu doğru tipe sar: `Fahrenheit(...)`."
  - "`c_den_f` için: `Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)`."
  - "`f_den_c` için önce 32'yi çıkar, sonra çarp ve böl: `Celsius((f.0 - 32.0) * 5.0 / 9.0)`. Parantezi unutma!"
explanation: |
  Her fonksiyon iç değeri `.0` ile çıkarıyor, hesaplıyor ve sonucu **hedef tipe sarıyor**. Dönüş
  tiplerin imzada yazılı olduğu için yanlış tipi döndürmen imkânsız: `c_den_f`'in içinde yanlışlıkla
  `Celsius(...)` döndürürsen derleyici yakalar.

  Testlerde `==` yerine `(a - b).abs() < 1e-9` kullandık. Modül 2'den hatırla: kayan noktalı sayılarda
  `0.1 + 0.2 != 0.3` olabilir; iki `f64`'ü karşılaştırırken küçük bir tolerans bırakmak iyi bir alışkanlıktır.
  `-40` ise iki ölçeğin buluştuğu sihirli sıcaklıktır!
```

## Birim struct'lar (unit-like structs)

Struct'ın en sade hâli: **hiç alanı olmayan** bir struct.

```rust
struct Isaret; // birim struct: alan yok, parantez yok

fn main() {
    let a = Isaret; // oluştururken de ne {} ne () gerekir
    let _b = a;     // sıradan bir değer gibi taşınabilir

    // std::mem::size_of::<T>() bir tipin bellekte kaç bayt tuttuğunu söyler (Modül 24)
    println!("Isaret: {} bayt", std::mem::size_of::<Isaret>());
    println!("(): {} bayt", std::mem::size_of::<()>());
}
```

Adı, Modül 2'de tanıdığın **birim tipinden** `()` gelir: ikisi de veri taşımaz ve bellekte **0 bayt**
yer kaplar. Farkı şu: `()` tek ve ortaktır, oysa her birim struct **kendine ait, ayrı bir tiptir**.

Veri tutmayan bir tip ne işe yarar? Değeri değil, **varlığı** bilgi taşır:

- **Davranışa sahip "boş" tipler:** Modül 11'de bir tipe trait ile davranış ekleyeceksin; bazen o
  davranış için hiçbir veriye gerek yoktur (ör. "Türkçe selamlayıcı", "büyük harfe çevirici").
- **İşaretçi (marker) tipler ve durumlar:** Modül 20'deki typestate deseninde bir nesnenin durumunu
  (`Taslak`, `Yayinda`...) birim struct'larla kodlayıp yanlış durumda yanlış işlemi derleme zamanında
  engelleyeceksin.
- **Standart kütüphanede:** Sistem bellek ayırıcısı `std::alloc::System` ve biçimlendirme hatası
  `std::fmt::Error` birer birim struct'tır.

Şimdilik "veri taşımayan ama adı olan bir tip" olarak aklında tut; gücünü ileride göreceksin.

```quiz
question: "`struct Bos;` tanımlandıktan sonra hangisi doğrudur?"
options:
  - "`let b = Bos;` ile bir örnek oluşturulur ve `Bos` bellekte 0 bayt yer kaplar"
  - "`Bos` ile `()` aynı tiptir; birbirlerinin yerine kullanılabilirler"
  - "`Bos` değeri bir işaretçi tutar, bu yüzden 8 bayttır"
  - Alanı olmayan struct tanımlanamaz; derleme hatası verir
answer: 0
explanation: |
  Birim struct `Bos;` biçiminde tanımlanır ve `Bos` yazılarak oluşturulur. Hiç veri taşımadığı için
  boyutu **0 bayttır** (sıfır boyutlu tip - zero-sized type). Derleyici onu tamamen ortadan kaldırabilir.
feedback:
  - Doğru!
  - "İkisi de 0 bayttır ama `Bos` kendine ait **ayrı bir tiptir**, tıpkı `Renk` ile `Konum` gibi."
  - Taşıyacak hiçbir verisi yok; işaretçiye de ihtiyacı yok.
  - Tanımlanabilir; bunlara birim struct (unit-like struct) denir.
```

Bu derste gördüğün üç biçimin bellekte nasıl durduğunu bir arada görelim:

```memory
title: Üç struct biçimi bellekte
steps:
  - caption: "`Metre` ile düz `f64` birebir aynıdır (8 bayt); `Renk` üç `u8` yan yana (3 bayt); `Isaret` hiç yer kaplamaz. Tip adları yalnızca derleme zamanında vardır."
    stack:
      - frame: main
        vars:
          - { name: zirve, type: Metre, value: "3917.0", note: "8 bayt" }
          - { name: ham, type: f64, value: "3917.0", note: "8 bayt" }
          - { name: turuncu, type: Renk, value: "255 | 165 | 0", note: "3 bayt" }
          - { name: isaret, type: Isaret, value: "(veri yok)", note: "0 bayt" }
```

## Hangisini ne zaman?

Artık elinde dört seçenek var. Karar verirken bu tabloyu kullan:

| Durum | Seçim | Örnek |
|---|---|---|
| Alanların anlamı önemli, ikiden fazla alan var | Adlandırılmış alanlı struct | `Ogrenci { ad, numara, ortalama }` |
| Az sayıda alan, sırası herkesçe bilinen | Tuple struct | `Renk(r, g, b)`, `Nokta(x, y)` |
| Tek bir değeri ayrı bir tipe sarmak (birim, kimlik no) | Newtype (tek alanlı tuple struct) | `Metre(f64)`, `OgrenciNo(u32)` |
| Hiç veri yok, sadece tip gerekli | Birim struct | `struct Isaret;` |
| Geçici, yerel gruplama (ör. fonksiyondan iki değer döndürmek) | Düz tuple | `(bolum, kalan)` |

Pratik bir kural: "`.1` neydi?" diye bir yorum yazma ihtiyacı duyuyorsan, adlandırılmış alanlara geç.

```quiz
question: |
  Bir okul sisteminde hem öğrenci numaraları hem personel numaraları `u32`. Bir fonksiyona yanlışlıkla
  personel numarası verilip bir öğrencinin notu silinmiş. Bu hatayı derleme zamanında önlemek için ne yaparsın?
options:
  - Parametrelere `ogrenci_no` ve `personel_no` gibi daha açıklayıcı adlar veririm
  - "`struct OgrenciNo(u32);` ve `struct PersonelNo(u32);` newtype'larını tanımlayıp fonksiyonlarda bunları kullanırım"
  - "`type OgrenciNo = u32;` yazarım"
  - İki numarayı bir tuple içinde `(u32, u32)` taşırım
answer: 1
explanation: |
  Yalnızca **farklı tipler** derleyiciyi devreye sokar. Newtype ile `sil(no: OgrenciNo)` fonksiyonuna
  `PersonelNo` vermek `E0308` olur. Çalışma anı maliyeti sıfırdır.
feedback:
  - İyi isimler okumayı kolaylaştırır ama derleyici isimlere bakmaz; ikisi de `u32` olduğu sürece hata yakalanmaz.
  - Doğru!
  - "`type` yalnızca bir **takma ad** oluşturur (Modül 22); `OgrenciNo` ile `u32` yine aynı tip olur ve karışıklık sürer."
  - Tuple, numaraların hangisinin hangisi olduğu bilgisini daha da gizler.
```

Bir de Modül 5'ten bir soru: newtype'ın içindeki değere `.0` ile ulaşınca, o değerin bütün kuralları
geçerlidir. Tahmin et:

```predict
code: |
  struct Sehir(String);

  fn main() {
      let s = Sehir(String::from("Şanlıurfa"));
      let ilk = &s.0[0..2];
      println!("{ilk} {}", s.0.len());
  }
options:
  - "Ş 11"
  - "Şa 9"
  - "Ş 9"
  - "Şa 11"
answer: 0
explanation: |
  `s.0` içteki `String`'dir ve ona Modül 5'teki dilim (slice) kuralları uygulanır: aralıklar **bayt**
  cinsindendir. `Ş` UTF-8'de 2 bayt olduğu için `[0..2]` tam olarak `"Ş"`'yi verir (karakter sınırına
  denk geldiği için panik de olmaz). `len()` de bayt sayar: Ş(2) a n l ı(2) u r f a → 2+1+1+1+2+1+1+1+1 = **11**.
```

Şimdi tuple struct, tip dönüşümü ve taşma bilgini birleştirme zamanı:

```exercise
id: m06-e-gri-ton
title: "Fotoğraf filtresi: gri ton"
difficulty: 3
prompt: |
  Bir fotoğraf uygulaması için "siyah-beyaz" filtresi yazıyorsun. `gri_ton` fonksiyonu bir rengi
  **ödünç alır** ve gri tonunu döndürür: üç kanalın **ortalaması** (tamsayı bölmesiyle, aşağı yuvarlanır)
  hesaplanır ve yeni rengin üç kanalı da bu değer olur.

  Örnek: `Renk(30, 60, 90)` → `Renk(60, 60, 60)`.

  Dikkat: Bembeyaz bir piksel `Renk(255, 255, 255)` de doğru çalışmalı!
starter: |
  struct Renk(u8, u8, u8);

  fn gri_ton(renk: &Renk) -> Renk {
      todo!()
  }

  fn main() {
      let gunbatimi = Renk(250, 120, 40);
      let gri = gri_ton(&gunbatimi);
      println!("({}, {}, {}) → ({}, {}, {})", gunbatimi.0, gunbatimi.1, gunbatimi.2, gri.0, gri.1, gri.2);
  }
solution: |
  struct Renk(u8, u8, u8);

  fn gri_ton(renk: &Renk) -> Renk {
      let toplam = renk.0 as u16 + renk.1 as u16 + renk.2 as u16;
      let ortalama = (toplam / 3) as u8;
      Renk(ortalama, ortalama, ortalama)
  }

  fn main() {
      let gunbatimi = Renk(250, 120, 40);
      let gri = gri_ton(&gunbatimi);
      println!("({}, {}, {}) → ({}, {}, {})", gunbatimi.0, gunbatimi.1, gunbatimi.2, gri.0, gri.1, gri.2);
  }
check: tests
tests: |
  #[test]
  fn basit_ortalama() {
      let g = gri_ton(&Renk(30, 60, 90));
      assert_eq!((g.0, g.1, g.2), (60, 60, 60), "(30 + 60 + 90) / 3 = 60");
  }

  #[test]
  fn beyaz_tasma_yapmaz() {
      let g = gri_ton(&Renk(255, 255, 255));
      assert_eq!((g.0, g.1, g.2), (255, 255, 255), "beyaz beyaz kalmalı - 255 + 255 bir u8'e sığmaz!");
  }

  #[test]
  fn once_topla_sonra_bol() {
      let g = gri_ton(&Renk(10, 20, 31));
      assert_eq!((g.0, g.1, g.2), (20, 20, 20), "(10 + 20 + 31) / 3 = 61 / 3 = 20 olmalı");
  }

  #[test]
  fn orijinal_renk_degismez() {
      let r = Renk(200, 100, 0);
      let g = gri_ton(&r);
      assert_eq!((r.0, r.1, r.2), (200, 100, 0), "orijinal renk değişmemeli");
      assert_eq!((g.0, g.1, g.2), (100, 100, 100), "(200 + 100 + 0) / 3 = 100");
  }
hints:
  - "Üç `u8`'i doğrudan toplarsan sonuç 255'i aşabilir, debug modda bu bir **taşma paniğidir** (Modül 2)."
  - "Toplamadan **önce** her kanalı daha geniş bir tipe çevir: `renk.0 as u16`. Önce bölüp sonra toplamak ise kesirleri kaybettirir!"
  - "`let toplam = renk.0 as u16 + renk.1 as u16 + renk.2 as u16;` sonra `let ort = (toplam / 3) as u8;` ve `Renk(ort, ort, ort)`."
explanation: |
  İki tuzak vardı:

  1. **Taşma:** `renk.0 + renk.1 + renk.2` işlemi `u8` üzerinde yapılır; `255 + 255` sığmadığı için debug
     modda `attempt to add with overflow` paniği olur. Toplamadan önce `as u16` ile genişletmek bunu çözer
     (en büyük toplam 765, `u16`'ya rahatça sığar). Sonuç 255'ten büyük olamayacağı için `as u8` güvenlidir.
  2. **Sıra:** `renk.0 / 3 + renk.1 / 3 + renk.2 / 3` yazsaydın her bölmede kesir atılırdı:
     `10/3 + 20/3 + 31/3 = 3 + 6 + 10 = 19`; doğrusu `61 / 3 = 20`.

  Fonksiyon rengi `&Renk` ile **ödünç** aldığı için çağıran taraf orijinal rengi kullanmaya devam
  edebiliyor. Yeni renk ise fonksiyonun içinde oluşturulup **sahipliğiyle birlikte** döndürülüyor.
```

## Özet

:::remember
- **Tuple struct:** `struct Renk(u8, u8, u8);` → `Renk(255, 0, 0)` → `.0 .1 .2` ya da `let Renk(r, g, b) = renk;`
- İçleri aynı olsa da farklı adlı struct'lar **farklı tiplerdir** (nominal tipleme, `E0308`).
- **Newtype:** tek alanlı tuple struct ile birim/kimlik karışıklığını derleme zamanında engelle; çalışma anı maliyeti **sıfır**.
- Newtype iç tipin işlemlerini devralmaz (`E0369`); gereken işlemi sen tanımlarsın.
- **Birim struct:** `struct Isaret;` → `let i = Isaret;`, 0 bayt; trait'ler ve typestate ile değer kazanır.
:::

```reflect
prompt: |
  Newtype deseni çalışma anında hiçbir maliyet getirmiyorsa, sağladığı fayda tam olarak nerede ve ne
  zaman ortaya çıkıyor? Mars Climate Orbiter örneği üzerinden kendi cümlelerinle açıkla.
answer: |
  Fayda **derleme zamanında** ortaya çıkar. Derleyici `Metre` ile `Fit`'i (ya da newton·saniye ile
  pound·saniye birimlerini) farklı tipler olarak görür; birini diğerinin yerine verirsen `E0308` ile
  durdurur. Derleme bittiğinde ise newtype içindeki `f64` ile aynı boyuttadır, ek işlem yoktur; tip bilgisi
  ortadan kalkar. Yani hata program hiç çalışmadan, bir uydu fırlatılmadan yakalanır. Orbiter'daki iki
  yazılım düz sayılar kullandığı için bu kontrol hiç yapılamamıştı.
```

```flashcards
- front: Bir tuple struct'ın alanlarına nasıl erişilir?
  back: "Sırayla `.0`, `.1`, ... ile ya da parçalayarak: `let Renk(r, g, b) = renk;`"
- front: "`struct A(i32);` ve `struct B(i32);` birbirinin yerine kullanılabilir mi?"
  back: "Hayır. İçleri aynı olsa da farklı tiplerdir (nominal tipleme); karıştırırsan **E0308**."
- front: Newtype deseni nedir?
  back: "Mevcut bir tipi tek alanlı bir tuple struct ile yeni, ayrı bir tipe sarmak: `struct Metre(f64);`"
- front: "`struct Metre(f64);` bellekte kaç bayttır ve neden?"
  back: 8 bayt, düz bir `f64` ile aynı. Tip bilgisi yalnızca derleme zamanında vardır; newtype sıfır maliyetlidir.
- front: "`Metre(1.0) + Metre(2.0)` neden derlenmez?"
  back: "Newtype iç tipin işlemlerini devralmaz (**E0369**). Şimdilik `Metre(a.0 + b.0)`; Modül 22'de `+` tanımlanır."
- front: Birim struct nasıl tanımlanır, nasıl oluşturulur, kaç bayttır?
  back: "`struct Isaret;` ile tanımlanır, `let i = Isaret;` ile oluşturulur; boyutu **0 bayttır**."
- front: Ne zaman adlandırılmış alanlar yerine tuple struct seçilir?
  back: "Alan sayısı az ve sırası herkesçe bilinen veriler için (`Renk(r, g, b)`, `Nokta(x, y)`) ve tek değerli newtype'lar için."
```
