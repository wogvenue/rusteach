---
id: m10-boss
title: "Boss: Hata Yönetimi Ustalık Sınavı"
minutes: 35
type: boss
keywords: [boss, panic!, Result, "?", ok_or, map_err, hata enum'u, doğrulama]
---

Modülün sonuna geldin! Bu sınav altı dersin hepsini ve önceki modüllerden birkaç konuyu karıştırarak soruyor.
Geçmek için puanlı soruların ve alıştırmaların **%80'ini** doğru yapman gerekiyor. Notlarına bakmadan çöz:
hatırlamaya çalışmak, öğrendiğini en çok güçlendiren şeydir. Bir soruda takılırsan atla, sonra dön.

## 1. Tur: panik ve Result

```quiz
question: "Varsayılan ayarlarla (unwinding) çalışan bir programın ana thread'inde panik olduğunda aşağıdakilerden hangisi **yanlıştır**?"
options:
  - Panik mesajı, paniğin oluştuğu dosya ve satırla birlikte stderr'e yazılır
  - Stack geri sarılır; her çerçevede sahip olunan değerler `drop` edilir
  - Program 101 çıkış koduyla biter
  - "Panik, onu çağıran fonksiyonda `match` ile yakalanabilir ve program kaldığı yerden devam eder"
answer: 3
explanation: |
  Panik bir `Result` değildir; `match` ile yakalanamaz. Unwinding'in amacı kurtarmak değil, düzenli
  temizliktir: değerler `drop` edilir ve ana thread biter. Beklenen başarısızlıkların aracı `Result`'tır.
feedback:
  - "Bu doğru: mesaj ve konum stderr'e yazılır."
  - "Bu doğru: unwinding her çerçevedeki sahip olunan değerleri temizler."
  - "Bu doğru: panikle biten programın çıkış kodu 101'dir."
  - "Doğru seçim, çünkü bu ifade yanlış: `match` yalnızca değerlerle çalışır, panik ise bir değer değildir."
```

```predict
code: |
  fn main() {
      let stok: Vec<u8> = vec![120, 200, 15];

      match stok.get(3) {
          Some(adet) => println!("4. raf: {adet}"),
          None => println!("4. raf yok"),
      }
      println!("{:?}", stok[1].checked_add(stok[0]));
      println!("{:?}", stok[1].checked_sub(stok[2]));
      println!("{}", stok[2].saturating_sub(stok[0]));
  }
options:
  - |
    4. raf yok
    None
    Some(185)
    0
  - |
    4. raf: 0
    Some(320)
    Some(185)
    0
  - |
    4. raf yok
    None
    Some(185)
    151
  - |
    4. raf yok
    Some(64)
    Some(185)
    0
answer: 0
explanation: |
  `get(3)` geçersiz dizinde panik atmaz, `None` döner. `200 + 120 = 320` bir `u8`'e sığmaz: `checked_add`
  `None` verir (`64`, `wrapping_add`'in sonucu olurdu). `200 - 15 = 185` sığar. `15 - 120` ise negatif olurdu;
  `saturating_sub` alt sınırda, yani `0`'da durur. Hiçbir satır panik atmadı: güvenli kardeşler başarısızlığı
  bir değer olarak bildirdi.
```

```predict
code: |
  fn varsayilan() -> u32 {
      println!("varsayılan hesaplandı");
      0
  }

  fn main() {
      let a = "7".parse::<u32>().unwrap_or(varsayilan());
      let b = "7".parse::<u32>().unwrap_or_else(|_| varsayilan());
      let c = "yedi".parse::<u32>().unwrap_or_default();
      println!("{a} {b} {c}");
  }
options:
  - |
    varsayılan hesaplandı
    7 7 0
  - |
    7 7 0
  - |
    varsayılan hesaplandı
    varsayılan hesaplandı
    7 7 0
  - |
    varsayılan hesaplandı
    7 7 7
answer: 0
explanation: |
  `unwrap_or(varsayilan())` **eager**'dır: argüman, `unwrap_or` çağrılmadan önce hesaplanır. Sonuç `Ok(7)` olsa
  bile `varsayilan()` çalışır ve mesajını yazar. `unwrap_or_else` ise **lazy**'dir: closure yalnızca `Err`
  durumunda çağrılır, burada hiç çağrılmadı. `unwrap_or_default`, `Err`'de tipin varsayılanını (`u32` için 0)
  verir.
```

Modül 4'ten bir soru: sahiplik kuralları `Result`'ı açarken de geçerli.

```compiles
code: |
  fn main() {
      let sonuc: Result<u32, String> = Err(String::from("bağlantı koptu"));
      match sonuc {
          Ok(n) => println!("{n}"),
          Err(mesaj) => println!("Hata: {mesaj}"),
      }
      println!("{sonuc:?}");
  }
answer: false
error: E0382
explanation: |
  Derlenmez: **E0382**. `match sonuc` içinde `Err(mesaj)` deseni, `String`'i `sonuc`'un içinden `mesaj`'a
  **taşır** (Modül 4). Taşınmış (kısmen taşınmış) bir değeri sonra yazdırmaya çalışmak hatadır. Çözüm,
  değeri ödünç alarak eşleştirmek: `match &sonuc { ... }`. O zaman `mesaj` bir `&String` olur (Modül 5).
```

## 2. Tur: hata yayma ve dönüşümler

```compiles
code: |
  use std::error::Error;

  fn main() -> Result<(), Box<dyn Error>> {
      let adet: u32 = " 4 ".trim().parse()?;
      let fiyat: f64 = "12.5".parse()?;
      println!("Tutar: {} TL", adet as f64 * fiyat);
      Ok(())
  }
answer: true
explanation: |
  Derlenir ve `Tutar: 50 TL` yazar. İki `?` farklı hata tipleri (`ParseIntError` ve `ParseFloatError`) üretebilir.
  `Box<dyn Error>`, `Error` trait'ini uygulayan her hatayı taşıyabilir ve `?`'nin içindeki `From::from` her
  birini kutuya kendiliğinden koyar. Dönüş tipi `Result<(), ParseIntError>` olsaydı ikinci `?` E0277 verirdi.
```

```predict
code: |
  use std::collections::HashMap;

  fn ikinci_harf(sozluk: &HashMap<&str, &str>, anahtar: &str) -> Option<String> {
      let kelime = sozluk.get(anahtar)?;
      println!("{anahtar} bulundu");
      let parca = kelime.get(1..2)?;
      Some(parca.to_uppercase())
  }

  fn main() {
      let mut sozluk = HashMap::new();
      sozluk.insert("kedi", "cat");
      sozluk.insert("su", "şu");
      println!("{:?}", ikinci_harf(&sozluk, "kedi"));
      println!("{:?}", ikinci_harf(&sozluk, "su"));
      println!("{:?}", ikinci_harf(&sozluk, "köpek"));
  }
options:
  - |
    kedi bulundu
    Some("A")
    su bulundu
    None
    None
  - |
    kedi bulundu
    Some("A")
    su bulundu
    Some("U")
    köpek bulundu
    None
  - |
    kedi bulundu
    Some("A")
    su bulundu
    Some("U")
    None
  - |
    Some("A")
    None
    None
answer: 0
explanation: |
  `?` `Option` döndüren bir fonksiyonda `None` görünce hemen `None` döndürür. `"köpek"` sözlükte yok: ilk `?`
  fonksiyonu daha `println!`'den önce bitirir. `"şu"` ise sözlükte var, ama `ş` UTF-8'de **2 bayt** (Modül 9):
  `1..2` aralığı `ş`'nin ortasına denk gelir. `get` bu durumda panik atmaz, `None` döner ve ikinci `?` devreye
  girer. `&kelime[1..2]` yazsaydık program paniklerdi.
```

```parsons
prompt: |
  Bir pastane kasasında sipariş satırları `"simit:3"` biçiminde geliyor. Satırları sıraya koyarak `satir_tutari`
  fonksiyonunu kur. Fonksiyon kontrolleri **şu sırayla** yapsın ve ilk sorunda açıklayıcı bir `String` hatası
  döndürsün: önce `:` var mı, sonra ürün satılıyor mu, en son adet okunabiliyor mu. Aralarında iki hatalı satır var.
lines: |
  use std::collections::HashMap;
  fn satir_tutari(fiyatlar: &HashMap<&str, u32>, satir: &str) -> Result<u32, String> {
      let (urun, adet) = satir.split_once(':').ok_or("':' eksik")?;
      let fiyat = fiyatlar.get(urun).ok_or_else(|| format!("{urun} satılmıyor"))?;
      let adet = adet.trim().parse::<u32>().map_err(|e| format!("adet okunamadı: {e}"))?;
      Ok(fiyat * adet)
  }
distractors: |
      let fiyat = fiyatlar.get(urun)?;
      Ok(fiyat * adet);
explanation: |
  Fonksiyon `Result` döndürdüğü için `Option`'lara doğrudan `?` uygulanamaz (E0277); önce `ok_or`/`ok_or_else`
  ile `Result`'a çevrilirler. `ok_or("':' eksik")` bir `&str` hatası üretir, ama `?`'nin içindeki `From::from`
  onu `String`'e çevirebilir. `ParseIntError` ise `map_err` ile `String`'e tercüme edilir. Son satırdaki noktalı
  virgül fonksiyonu `()` döndüren bir gövdeye çevirirdi (E0308).
```

```predict
code: |
  fn main() {
      let a: Option<u8> = "300".parse::<u8>().ok();
      let b: Result<u8, &str> = None.ok_or("yok");
      let c = "12".parse::<u8>().map_err(|e| e.to_string());
      let d = Some(5).ok_or("yok");
      println!("{a:?} {b:?} {c:?} {d:?}");
  }
options:
  - "None Err(\"yok\") Ok(12) Ok(5)"
  - "Some(44) Err(\"yok\") Ok(12) Some(5)"
  - "None None Ok(\"12\") Ok(5)"
  - "None Err(\"yok\") Ok(12) Some(5)"
answer: 0
explanation: |
  `"300"` bir `u8`'e sığmaz: `parse` `Err` döner, `ok()` onu `None`'a çevirir. `ok_or` `None`'ı `Err("yok")`'a,
  `Some(5)`'i `Ok(5)`'e çevirir. `map_err` yalnızca `Err` tarafına dokunur; başarılı `Ok(12)` olduğu gibi kalır.
```

````exercise
id: m10-boss-e-sicaklik
title: Sıcaklık ortalaması
difficulty: 2
prompt: |
  Bir hava istasyonu, saatlik sıcaklık ölçümlerini metin olarak gönderiyor (değerlerin etrafında boşluk
  olabilir, negatif değerler mümkün). `ortalama_sicaklik(olcumler)` fonksiyonunu yaz:

  - Hiç ölçüm yoksa `Err("ölçüm yok")` döndür.
  - Okunamayan **ilk** ölçümde dur ve `Err("'<ölçüm>' okunamadı: <ParseIntError mesajı>")` döndür. Mesajdaki
    ölçüm, `trim` edilmiş hâliyle yazılsın. Örnek: `"ılık"` → `'ılık' okunamadı: invalid digit found in string`
  - Aksi halde ölçümlerin tam sayı ortalamasını (`toplam / adet`, `i32` bölmesi) `Ok` ile döndür.

  Hataları `?` ile yay; `unwrap`/`expect` kullanma.
starter: |
  fn ortalama_sicaklik(olcumler: &[&str]) -> Result<i32, String> {
      todo!()
  }

  fn main() {
      println!("{:?}", ortalama_sicaklik(&["12", " 15 ", "18"])); // Ok(15)
      println!("{:?}", ortalama_sicaklik(&[])); // Err("ölçüm yok")
      println!("{:?}", ortalama_sicaklik(&["3", "ılık"])); // Err("'ılık' okunamadı: ...")
  }
solution: |
  fn ortalama_sicaklik(olcumler: &[&str]) -> Result<i32, String> {
      if olcumler.is_empty() {
          return Err(String::from("ölçüm yok"));
      }
      let mut toplam = 0;
      for olcum in olcumler {
          let olcum = olcum.trim();
          toplam += olcum
              .parse::<i32>()
              .map_err(|hata| format!("'{olcum}' okunamadı: {hata}"))?;
      }
      Ok(toplam / olcumler.len() as i32)
  }

  fn main() {
      println!("{:?}", ortalama_sicaklik(&["12", " 15 ", "18"])); // Ok(15)
      println!("{:?}", ortalama_sicaklik(&[])); // Err("ölçüm yok")
      println!("{:?}", ortalama_sicaklik(&["3", "ılık"])); // Err("'ılık' okunamadı: ...")
  }
check: tests
tests: |
  #[test]
  fn ortalama_hesaplanir() {
      assert_eq!(ortalama_sicaklik(&["12", " 15 ", "18"]), Ok(15), "(12 + 15 + 18) / 3 = 15");
      assert_eq!(ortalama_sicaklik(&["-4", "-6"]), Ok(-5), "negatif sıcaklıklar da okunmalı");
      assert_eq!(ortalama_sicaklik(&["7", "8"]), Ok(7), "15 / 2 = 7 (tam sayı bölmesi)");
      assert_eq!(ortalama_sicaklik(&["-3", "-4"]), Ok(-3), "-7 / 2 = -3: i32 bölmesi sıfıra doğru keser");
      assert_eq!(ortalama_sicaklik(&["21"]), Ok(21), "tek ölçümün ortalaması kendisidir");
  }

  #[test]
  fn bos_liste_hatadir() {
      assert_eq!(ortalama_sicaklik(&[]), Err(String::from("ölçüm yok")), "boş listede 0'a bölme yerine hata dönmeli");
  }

  #[test]
  fn ilk_hatali_olcum_bildirilir() {
      assert_eq!(
          ortalama_sicaklik(&["3", " ılık ", "x"]),
          Err(String::from("'ılık' okunamadı: invalid digit found in string")),
          "ilk hatalı ölçüm trim edilmiş hâliyle bildirilmeli; sonraki \"x\"e hiç bakılmamalı"
      );
      assert_eq!(
          ortalama_sicaklik(&["10", ""]),
          Err(String::from("'' okunamadı: cannot parse integer from empty string")),
          "boş ölçüm de okunamaz"
      );
  }
hints:
  - "Önce boş listeyi `is_empty()` ile denetle ve `return Err(...)` yap; aksi halde sondaki bölme sıfıra bölme paniği verir."
  - "Döngüde her ölçümü `let olcum = olcum.trim();` ile temizle, sonra `.parse::<i32>().map_err(|hata| format!(\"'{olcum}' okunamadı: {hata}\"))?` ile oku."
  - "Döngüden sonra `Ok(toplam / olcumler.len() as i32)`. `len()` bir `usize` döndürür, `as i32` ile çevirmen gerekir (Modül 2)."
forbid:
  - pattern: "\\.unwrap\\(|\\.expect\\(|\\.unwrap_or"
    message: "Hataları `?` ile yay; varsayılan değer ya da panik yok."
require:
  - pattern: "\\)\\s*\\?"
    message: "Hatayı `?` operatörüyle yaymalısın: örneğin `.map_err(...)?`"
explanation: |
  Boş liste kontrolü bir **ön kontrol**dür: atlansaydı `toplam / 0` panik atardı. Ölçüm gelmemesi ise bir bug
  değil, beklenen bir durum (istasyon arızalı olabilir), bu yüzden `Err` döndürüyoruz. `map_err` ile
  `ParseIntError`'ı, hangi ölçümün bozuk olduğunu da söyleyen bir mesaja çevirdik. İyi bir hata mesajı neyin
  ve **hangi değerle** ters gittiğini birlikte söyler.

  `olcum.trim()` sonucunu aynı adla gölgeledik (Modül 2), böylece hem `parse` hem mesaj temizlenmiş değeri
  kullanıyor. `/` işlemi `i32`'de sıfıra doğru keser: `-7 / 2` → `-3` (aşağı yuvarlamak isteseydin
  `div_euclid` gerekirdi). Alternatif olarak boş liste kontrolünü döngüden sonraya bırakıp `checked_div`
  (Modül 2'deki `checked_*` ailesinin bölme üyesi; sıfıra bölmede `None` döner) ile `ok_or`'u birleştirebilirdin:

  ```rust
  let ortalama = toplam.checked_div(olcumler.len() as i32).ok_or("ölçüm yok")?;
  Ok(ortalama)
  ```

  `ok_or("ölçüm yok")` bir `&str` hatası üretir; `?` onu `String`'e kendiliğinden çevirir.
````

## 3. Tur: kendi hata tiplerin ve karar

```quiz
question: "Bir kargo takip sisteminde `teslim_et` fonksiyonu için en iyi hata tasarımı hangisi?"
options:
  - "`enum TeslimHatasi { AdresBulunamadi { posta_kodu: u32 }, AliciEvdeYok { deneme: u8 }, PaketHasarli }`"
  - "`Result<(), String>`: örneğin `Err(\"Alıcı evde yok (2. deneme)\")`"
  - "`enum TeslimHatasi { Hata(String) }`"
  - "Başarısızlıkta `panic!(\"teslimat başarısız\")`"
answer: 0
explanation: |
  Her başarısızlık adlandırılmış bir varyant; karar için gereken bilgi (posta kodu, deneme sayısı) tipli veri
  olarak taşınıyor. Çağıran "3. denemeden sonra paketi şubeye gönder" gibi bir kuralı metin ayıklamadan
  uygulayabilir, derleyici de her varyantın ele alındığını denetler.
feedback:
  - Doğru!
  - "Deneme sayısı metne gömülü; çağıranın onu geri almak için metni ayrıştırması gerekir."
  - "Tek varyantlı bir enum hiçbir şeyi ayırt etmez; bu, kılık değiştirmiş bir `String`."
  - "Alıcının evde olmaması beklenen bir durum; kurye programının çökmesi değil, yeniden denemesi gerekir."
```

```compiles
code: |
  #[derive(Debug)]
  enum SiparisHatasi {
      StokYok { urun: String },
  }

  fn siparis(stok: u32, urun: &str) -> Result<u32, SiparisHatasi> {
      if stok == 0 {
          return Err(SiparisHatasi::StokYok { urun: String::from(urun) });
      }
      Ok(stok - 1)
  }

  fn main() -> Result<(), SiparisHatasi> {
      let kalan = siparis(5, "simit")?;
      println!("Kalan: {kalan}");
      if let Err(SiparisHatasi::StokYok { urun }) = siparis(0, "poğaça") {
          println!("{urun} tükendi");
      }
      Ok(())
  }
answer: true
explanation: |
  Derlenir: `main` kendi hata tipini döndürebilir, bunun için tek şart `Debug`. (`Box<dyn Error>` döndürseydi
  `?` derlenmezdi; `SiparisHatasi` henüz `Error` trait'ini uygulamıyor, Modül 11.) Program `Kalan: 4` ve
  `poğaça tükendi` yazar ve 0 koduyla biter.
```

Modül 7'den bir soru: `let ... else` hatalarla da çok işe yarar.

```fill
prompt: |
  Boşlukları doldur: `kat_oku`, metni `let ... else` ile okusun ve okunamazsa açıklayıcı bir hata döndürsün;
  21'den büyük katlar da hata olsun.
code: |
  fn kat_oku(metin: &str) -> Result<u8, String> {
      let ___0(kat) = metin.trim().parse::<u8>() ___1 {
          return Err(format!("'{metin}' bir kat numarası değil"));
      };
      if kat > 21 {
          return Err(format!("binada {kat}. kat yok"));
      }
      Ok(kat)
  }

  fn main() {
      println!("{:?}", kat_oku("4"));
      println!("{:?}", kat_oku("çatı"));
      println!("{:?}", kat_oku("30"));
  }
blanks:
  - ["Ok"]
  - ["else"]
output: |
  Ok(4)
  Err("'çatı' bir kat numarası değil")
  Err("binada 30. kat yok")
explanation: |
  `let Ok(kat) = ... else { ... };` (Modül 7): desen uyarsa `kat` bağlanır ve kod devam eder; uymazsa `else`
  bloğu çalışır ve bu blok mutlaka fonksiyondan çıkmalıdır (`return`). Burada `ParseIntError`'ın ayrıntısını
  atıp kendi mesajımızı kurduk. Ayrıntı gerekseydi `map_err` daha uygun olurdu.
```

```quiz
question: "Aşağıdaki durumların hangisinde `panic!` (ya da `assert!`) **doğru** seçimdir?"
options:
  - "Bir kütüphanenin `json_coz(metin)` fonksiyonu, kullanıcıdan gelen bozuk bir JSON metni aldı"
  - "`sayfa_sayisi(oge, sayfa_boyutu)` fonksiyonu, programcının sabit olarak yazdığı `SAYFA_BOYUTU = 0` ile çağrıldı"
  - "Bir dosya indirme aracında ağ bağlantısı koptu"
  - "Bir kayıt formunda kullanıcı adı 2 karakter girildi"
answer: 1
explanation: |
  Temel soru: **kod doğru olsa bile olabilir mi?** Bozuk JSON, kopan bağlantı ve kısa kullanıcı adı dış
  dünyadan gelir; kod kusursuz olsa da yaşanır, bu yüzden `Result`. Sıfır sayfa boyutu ise fonksiyonun
  sözleşmesini bozan bir **bug**: değer koddaki bir sabitten geliyor ve ancak programcı yanlış yazarsa sıfır olur.
feedback:
  - "Kütüphane çağıranın bağlamını bilmez; bozuk girdi beklenen bir durumdur: `Result`."
  - Doğru! Sözleşme ihlali bir programlama hatasıdır.
  - "Ağ her zaman kopabilir; araç yeniden denemeli ya da kullanıcıya bildirmeli: `Result`."
  - "Kullanıcılar her şeyi yazabilir; form bir uyarı göstermeli: `Result`."
```

```quiz
question: "`pub struct Yas(u8);` ile `pub fn new(deger: u8) -> Result<Yas, YasHatasi>` tanımlanmış bir modülde, alanın **gizli** olmasının amacı nedir?"
options:
  - "Performans: gizli alanlara erişim daha hızlıdır"
  - "Modül dışındaki kodun `Yas(200)` yazıp doğrulamayı atlamasını engellemek; her `Yas` değerinin `new`'dan geçmiş olmasını garanti etmek"
  - "`Debug` ile yazdırılırken değerin görünmemesini sağlamak"
  - "Alanın değişmesini engellemek; gizli alanlar sabittir"
answer: 1
explanation: |
  Gizli alan, kontrolsüz girişi kapatan duvardır: modül dışından tuple struct kurucusu kullanılamaz (E0603 /
  E0423). Böylece elinde bir `Yas` olan her fonksiyon, onun geçerli olduğundan emin olabilir ve yeniden
  denetlemez ("doğrulamakla yetinme, ayrıştır").
feedback:
  - "Gizlilik bir derleme zamanı kuralıdır; çalışma hızına etkisi yoktur."
  - Doğru!
  - "`#[derive(Debug)]` gizli alanları da yazdırır; gizlilik yalnızca erişimi kısıtlar."
  - "Değişmezlik `mut` ile ilgilidir. Gizlilik ise alana **kimin** erişebileceğini belirler."
```

## 4. Tur: büyük alıştırmalar

````exercise
id: m10-boss-e-atm-komut
title: ATM komut çözücü
difficulty: 3
prompt: |
  Bir ATM'nin bakım terminali `"yatir 250"` ya da `"cek 100"` gibi metin komutları kabul ediyor.
  `komut_coz(satir)` fonksiyonunu yaz. Satırın başındaki ve sonundaki boşlukları temizle, sonra kuralları
  **bu sırayla** uygula:

  1. Satır boşsa → `KomutHatasi::Bos`
  2. Satırı **ilk** boşluktan böl (`split_once(' ')`). Boşluk yoksa satırın tamamı komut adıdır:
     - `"yatir"` ya da `"cek"` ise → `EksikTutar`
     - başka bir şeyse → `Bilinmeyen(ad)` (ad, `String` olarak)
  3. Boşluk varsa ilk parça komut adıdır. Ad `"yatir"` ya da `"cek"` değilse → `Bilinmeyen(ad)`
  4. Kalan parçayı `trim` edip `u64` olarak oku. Okunamazsa → `GecersizTutar(ParseIntError)` (`map_err` ile sar)
  5. Tutar 0 ise → `SifirTutar`

  Başarıda `Ok(Komut::Yatir(tutar))` ya da `Ok(Komut::Cek(tutar))` döndür.
starter: |
  use std::num::ParseIntError;

  #[derive(Debug, PartialEq)]
  enum Komut {
      Yatir(u64),
      Cek(u64),
  }

  #[derive(Debug, PartialEq)]
  enum KomutHatasi {
      Bos,
      Bilinmeyen(String),
      EksikTutar,
      GecersizTutar(ParseIntError),
      SifirTutar,
  }

  fn komut_coz(satir: &str) -> Result<Komut, KomutHatasi> {
      todo!()
  }

  fn main() {
      for satir in ["yatir 250", "  cek   40 ", "cek", "transfer 10", "yatir on", ""] {
          println!("{satir:?} → {:?}", komut_coz(satir));
      }
  }
solution: |
  use std::num::ParseIntError;

  #[derive(Debug, PartialEq)]
  enum Komut {
      Yatir(u64),
      Cek(u64),
  }

  #[derive(Debug, PartialEq)]
  enum KomutHatasi {
      Bos,
      Bilinmeyen(String),
      EksikTutar,
      GecersizTutar(ParseIntError),
      SifirTutar,
  }

  fn komut_coz(satir: &str) -> Result<Komut, KomutHatasi> {
      let satir = satir.trim();
      if satir.is_empty() {
          return Err(KomutHatasi::Bos);
      }
      let Some((ad, kalan)) = satir.split_once(' ') else {
          return match satir {
              "yatir" | "cek" => Err(KomutHatasi::EksikTutar),
              diger => Err(KomutHatasi::Bilinmeyen(String::from(diger))),
          };
      };
      if ad != "yatir" && ad != "cek" {
          return Err(KomutHatasi::Bilinmeyen(String::from(ad)));
      }
      let tutar = kalan
          .trim()
          .parse::<u64>()
          .map_err(KomutHatasi::GecersizTutar)?;
      if tutar == 0 {
          return Err(KomutHatasi::SifirTutar);
      }
      if ad == "yatir" {
          Ok(Komut::Yatir(tutar))
      } else {
          Ok(Komut::Cek(tutar))
      }
  }

  fn main() {
      for satir in ["yatir 250", "  cek   40 ", "cek", "transfer 10", "yatir on", ""] {
          println!("{satir:?} → {:?}", komut_coz(satir));
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_komutlar() {
      assert_eq!(komut_coz("yatir 250"), Ok(Komut::Yatir(250)), "yatir 250");
      assert_eq!(komut_coz("  cek   40 "), Ok(Komut::Cek(40)), "baştaki, sondaki ve aradaki fazla boşluklar temizlenmeli");
      assert_eq!(komut_coz("cek 1"), Ok(Komut::Cek(1)), "en küçük geçerli tutar 1");
  }

  #[test]
  fn bos_ve_eksik() {
      assert_eq!(komut_coz(""), Err(KomutHatasi::Bos), "boş satır");
      assert_eq!(komut_coz("   "), Err(KomutHatasi::Bos), "yalnızca boşluklardan oluşan satır da boştur");
      assert_eq!(komut_coz("cek"), Err(KomutHatasi::EksikTutar), "tutarsız cek");
      assert_eq!(komut_coz(" yatir "), Err(KomutHatasi::EksikTutar), "trim sonrası yalnızca 'yatir' kalıyor");
  }

  #[test]
  fn bilinmeyen_komut_adini_tasir() {
      assert_eq!(komut_coz("bakiye"), Err(KomutHatasi::Bilinmeyen(String::from("bakiye"))), "tek kelimelik bilinmeyen komut");
      assert_eq!(
          komut_coz("transfer abc"),
          Err(KomutHatasi::Bilinmeyen(String::from("transfer"))),
          "komut adı tutardan önce denetlenir"
      );
  }

  #[test]
  fn tutar_hatalari() {
      assert!(
          matches!(komut_coz("yatir on"), Err(KomutHatasi::GecersizTutar(_))),
          "'on' bir sayı değil: GecersizTutar beklenir"
      );
      assert!(
          matches!(komut_coz("cek -5"), Err(KomutHatasi::GecersizTutar(_))),
          "u64 negatif olamaz: GecersizTutar beklenir"
      );
      assert!(
          matches!(komut_coz("cek 10 20"), Err(KomutHatasi::GecersizTutar(_))),
          "'10 20' tek bir sayı değil"
      );
      assert_eq!(komut_coz("yatir 0"), Err(KomutHatasi::SifirTutar), "sıfır tutar");
  }
hints:
  - "Önce `let satir = satir.trim();` ve boşluk kontrolü. Sonra `satir.split_once(' ')` bir `Option<(&str, &str)>` döndürür; `let Some((ad, kalan)) = ... else { ... };` ile açabilirsin."
  - "`else` bloğunda `match satir { \"yatir\" | \"cek\" => ..., diger => ... }` ile tek kelimelik durumları ayır. Ardından adı denetle, tutarı `.trim().parse::<u64>().map_err(KomutHatasi::GecersizTutar)?` ile oku."
  - |
    Son kısım:
    ```rust
    if tutar == 0 {
        return Err(KomutHatasi::SifirTutar);
    }
    if ad == "yatir" { Ok(Komut::Yatir(tutar)) } else { Ok(Komut::Cek(tutar)) }
    ```
forbid:
  - pattern: "\\.unwrap\\(|\\.expect\\(|panic!"
    message: "Bakım terminaline yanlış komut yazmak beklenen bir durum: panik yerine `Err(...)` döndür."
require:
  - pattern: "map_err"
    message: "`ParseIntError`'ı `map_err` ile `KomutHatasi::GecersizTutar`'a sarmalısın."
explanation: |
  Fonksiyon üç farklı kaynaktan gelen başarısızlığı tek bir hata diline çeviriyor: biçim sorunları (`Bos`,
  `EksikTutar`, `Bilinmeyen`), alttaki `ParseIntError` (`GecersizTutar` içinde **saklanarak**) ve iş kuralı
  (`SifirTutar`). Çağıran, örneğin terminal ekranı, her birine ayrı bir mesaj gösterebilir.

  `.map_err(KomutHatasi::GecersizTutar)` kısayolu çalışır, çünkü tuple varyantın adı bir fonksiyon gibi
  davranır. `let ... else` (Modül 7) "boşluk yoksa" durumunu erken dönüşle hallederek asıl akışı girintisiz
  bırakıyor. `match` de bir ifade olduğu için `return match ... { ... };` yazılabiliyor.

  Aynı "varyant bir fonksiyondur" fikriyle sondaki `if ad == "yatir"` tekrarını da kaldırabilirsin: adı
  denetlerken hangi kurucunun kullanılacağını da seç, en sonda `Ok(kurucu(tutar))` döndür:

  ```rust
  let kurucu = match ad {
      "yatir" => Komut::Yatir,
      "cek" => Komut::Cek,
      diger => return Err(KomutHatasi::Bilinmeyen(String::from(diger))),
  };
  ```
````

````exercise
id: m10-boss-e-plaka
title: Doğrulanmış araç plakası
difficulty: 4
prompt: |
  Bir otopark yazılımı için `Plaka` tipi yazıyorsun. Geçersiz bir plaka programda **hiç oluşamamalı**: alan
  gizli, tek kapı `Plaka::new`. Girdi `"34 ABC 123"` biçiminde; parçalar bir ya da daha fazla boşlukla
  ayrılmış olabilir. Kuralları **bu sırayla** denetle:

  1. `split_whitespace` ile tam olarak **3** parça çıkmalı → değilse `ParcaSayisi(n)` (n: bulunan parça sayısı)
  2. İl kodu `u8` olarak okunmalı → okunamazsa `IlKodu(ParseIntError)`; 1 ile 81 arasında olmalı → değilse `GecersizIl(kod)`
  3. Harf grubu 1-3 karakter olmalı ve her karakter `A`-`Z` arası büyük harf olmalı (`is_ascii_uppercase`) →
     değilse `GecersizHarfler(grup)`
  4. Numara 2-4 karakter olmalı ve her karakter rakam olmalı (`is_ascii_digit`) → değilse `GecersizNumara(numara)`

  Geçerli plakayı **tek boşluklu** ve il kodu iki haneli olacak biçimde sakla: `"6  A   1234"` → `"06 A 1234"`.
  (İpucu: `format!("{il:02} ...")` sayıyı iki haneye sıfırla tamamlar, Modül 1.)
starter: |
  mod otopark {
      use std::num::ParseIntError;

      #[derive(Debug, PartialEq)]
      pub enum PlakaHatasi {
          ParcaSayisi(usize),
          IlKodu(ParseIntError),
          GecersizIl(u8),
          GecersizHarfler(String),
          GecersizNumara(String),
      }

      #[derive(Debug, PartialEq)]
      pub struct Plaka(String);

      impl Plaka {
          pub fn new(metin: &str) -> Result<Plaka, PlakaHatasi> {
              todo!()
          }

          pub fn as_str(&self) -> &str {
              &self.0
          }
      }
  }

  use otopark::{Plaka, PlakaHatasi};

  fn main() {
      for girdi in ["34 ABC 123", "6  A   1234", "82 AB 12", "34 abc 123", "34ABC123"] {
          match Plaka::new(girdi) {
              Ok(plaka) => println!("{girdi:?} → {}", plaka.as_str()),
              Err(PlakaHatasi::GecersizIl(kod)) => println!("{girdi:?} → {kod} diye bir il yok"),
              Err(hata) => println!("{girdi:?} → {hata:?}"),
          }
      }
  }
solution: |
  mod otopark {
      use std::num::ParseIntError;

      #[derive(Debug, PartialEq)]
      pub enum PlakaHatasi {
          ParcaSayisi(usize),
          IlKodu(ParseIntError),
          GecersizIl(u8),
          GecersizHarfler(String),
          GecersizNumara(String),
      }

      #[derive(Debug, PartialEq)]
      pub struct Plaka(String);

      impl Plaka {
          pub fn new(metin: &str) -> Result<Plaka, PlakaHatasi> {
              let mut parcalar = Vec::new();
              for parca in metin.split_whitespace() {
                  parcalar.push(parca);
              }
              if parcalar.len() != 3 {
                  return Err(PlakaHatasi::ParcaSayisi(parcalar.len()));
              }
              let (il, harfler, numara) = (parcalar[0], parcalar[1], parcalar[2]);

              let il = il.parse::<u8>().map_err(PlakaHatasi::IlKodu)?;
              if !(1..=81).contains(&il) {
                  return Err(PlakaHatasi::GecersizIl(il));
              }

              let harf_sayisi = harfler.chars().count();
              let mut harfler_gecerli = (1..=3).contains(&harf_sayisi);
              for c in harfler.chars() {
                  if !c.is_ascii_uppercase() {
                      harfler_gecerli = false;
                  }
              }
              if !harfler_gecerli {
                  return Err(PlakaHatasi::GecersizHarfler(String::from(harfler)));
              }

              let mut numara_gecerli = (2..=4).contains(&numara.chars().count());
              for c in numara.chars() {
                  if !c.is_ascii_digit() {
                      numara_gecerli = false;
                  }
              }
              if !numara_gecerli {
                  return Err(PlakaHatasi::GecersizNumara(String::from(numara)));
              }

              Ok(Plaka(format!("{il:02} {harfler} {numara}")))
          }

          pub fn as_str(&self) -> &str {
              &self.0
          }
      }
  }

  use otopark::{Plaka, PlakaHatasi};

  fn main() {
      for girdi in ["34 ABC 123", "6  A   1234", "82 AB 12", "34 abc 123", "34ABC123"] {
          match Plaka::new(girdi) {
              Ok(plaka) => println!("{girdi:?} → {}", plaka.as_str()),
              Err(PlakaHatasi::GecersizIl(kod)) => println!("{girdi:?} → {kod} diye bir il yok"),
              Err(hata) => println!("{girdi:?} → {hata:?}"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_plakalar_normallestirilir() {
      let p = Plaka::new("34 ABC 123").expect("34 ABC 123 geçerli bir plaka");
      assert_eq!(p.as_str(), "34 ABC 123", "zaten düzgün plaka aynen saklanmalı");
      let p = Plaka::new("  6  A   1234 ").expect("6 A 1234 geçerli bir plaka");
      assert_eq!(p.as_str(), "06 A 1234", "fazla boşluklar teke inmeli, il kodu iki haneye tamamlanmalı");
      let p = Plaka::new("81 ZZ 99").expect("81 ZZ 99 geçerli bir plaka");
      assert_eq!(p.as_str(), "81 ZZ 99", "81 son geçerli il kodu");
      let p = Plaka::new("01 A 10").expect("01 A 10 geçerli bir plaka");
      assert_eq!(p.as_str(), "01 A 10", "01 ilk geçerli il kodu");
  }

  #[test]
  fn parca_sayisi_denetlenir() {
      assert_eq!(Plaka::new("34ABC123"), Err(PlakaHatasi::ParcaSayisi(1)), "boşluksuz plaka tek parça");
      assert_eq!(Plaka::new(""), Err(PlakaHatasi::ParcaSayisi(0)), "boş metinde parça yok");
      assert_eq!(Plaka::new("34 AB 12 X"), Err(PlakaHatasi::ParcaSayisi(4)), "dört parça fazla");
  }

  #[test]
  fn il_kodu_denetlenir() {
      assert!(matches!(Plaka::new("XX AB 12"), Err(PlakaHatasi::IlKodu(_))), "'XX' sayı değil: IlKodu beklenir");
      assert!(matches!(Plaka::new("300 AB 12"), Err(PlakaHatasi::IlKodu(_))), "300 bir u8'e sığmaz: IlKodu beklenir");
      assert_eq!(Plaka::new("82 AB 12"), Err(PlakaHatasi::GecersizIl(82)), "82 diye bir il yok");
      assert_eq!(Plaka::new("0 AB 12"), Err(PlakaHatasi::GecersizIl(0)), "0 geçerli bir il kodu değil");
  }

  #[test]
  fn harfler_denetlenir() {
      assert_eq!(Plaka::new("34 abc 123"), Err(PlakaHatasi::GecersizHarfler(String::from("abc"))), "küçük harf olmaz");
      assert_eq!(Plaka::new("34 ABCD 123"), Err(PlakaHatasi::GecersizHarfler(String::from("ABCD"))), "en fazla 3 harf");
      assert_eq!(Plaka::new("34 ÇA 12"), Err(PlakaHatasi::GecersizHarfler(String::from("ÇA"))), "Türkçe harf (Ç) plakada kullanılmaz");
      assert_eq!(Plaka::new("34 A1 12"), Err(PlakaHatasi::GecersizHarfler(String::from("A1"))), "harf grubunda rakam olmaz");
  }

  #[test]
  fn numara_denetlenir() {
      assert_eq!(Plaka::new("34 AB 1"), Err(PlakaHatasi::GecersizNumara(String::from("1"))), "en az 2 rakam");
      assert_eq!(Plaka::new("34 AB 12345"), Err(PlakaHatasi::GecersizNumara(String::from("12345"))), "en fazla 4 rakam");
      assert_eq!(Plaka::new("34 AB 12a"), Err(PlakaHatasi::GecersizNumara(String::from("12a"))), "numarada harf olmaz");
  }

  #[test]
  fn kontrol_sirasi() {
      assert_eq!(
          Plaka::new("99 abc 1"),
          Err(PlakaHatasi::GecersizIl(99)),
          "üç parça da hatalıysa önce il kodu bildirilir"
      );
      assert_eq!(
          Plaka::new("34 abc 1"),
          Err(PlakaHatasi::GecersizHarfler(String::from("abc"))),
          "harfler, numaradan önce denetlenir"
      );
  }
hints:
  - "Parçaları bir `Vec`'e topla: `let mut parcalar = Vec::new(); for parca in metin.split_whitespace() { parcalar.push(parca); }`. Sonra `parcalar.len()` 3 değilse `ParcaSayisi` döndür."
  - "İl kodu: `parcalar[0].parse::<u8>().map_err(PlakaHatasi::IlKodu)?`, sonra `1..=81` aralığını denetle (`!(1..=81).contains(&il)`). Harf ve numara gruplarında hem uzunluğu (`chars().count()`) hem her karakteri bir döngüyle denetle."
  - |
    Harf grubu için bir yol (`(1..=3).contains(&n)`, "n 1 ile 3 arasında mı?" demek):
    ```rust
    let mut gecerli = (1..=3).contains(&harfler.chars().count());
    for c in harfler.chars() {
        if !c.is_ascii_uppercase() {
            gecerli = false;
        }
    }
    if !gecerli {
        return Err(PlakaHatasi::GecersizHarfler(String::from(harfler)));
    }
    ```
    En sonda `Ok(Plaka(format!("{il:02} {harfler} {numara}")))`.
forbid:
  - pattern: "\\.unwrap\\(|\\.expect\\(|panic!"
    message: "Plaka bir kullanıcı girdisi: geçersiz olması beklenen bir durum, panik yerine `Err(...)` döndür."
  - pattern: "pub\\s+struct\\s+Plaka\\s*\\(\\s*pub"
    message: "Alan gizli kalmalı; yoksa doğrulanmamış bir `Plaka` oluşturulabilir."
require:
  - pattern: "map_err"
    message: "İl kodunun `ParseIntError`'ını `map_err` ile `PlakaHatasi::IlKodu`'ya sarmalısın."
explanation: |
  Bu alıştırma modülün bütün fikirlerini birleştiriyor: veri taşıyan bir hata enum'u, alttaki `ParseIntError`'ı
  `map_err` ile sarmak, `?` ile erken dönüş, kontrol sırasının sözleşmenin parçası olması ve gizli alanlı,
  doğrulanmış bir tip. Programın geri kalanında `fn giris_kaydet(plaka: &Plaka)` gibi bir fonksiyon, plakanın
  geçerli **ve normalleştirilmiş** olduğundan emin olabilir. İki farklı yazımın (`"6 A 1234"` ve
  `"06  A 1234"`) aynı araç olduğunu da artık basit bir `==` ile anlayabilir.

  `(1..=3).contains(&harf_sayisi)` bir aralığın bir değeri içerip içermediğini sorar; `>= 1 && <= 3` ile aynı
  anlama gelir (Clippy de elle yazılmış aralık karşılaştırmaları için bu biçimi önerir: `manual_range_contains`). Uzunluğu `chars().count()` ile ölçmek önemli: `"ÇA"` 3 bayttır ama 2 karakterdir. Uzunluk
  kuralını geçse bile `Ç` büyük ASCII harf olmadığı için reddedilir.

  Modül 14'te iterator'ları öğrenince karakter döngülerini tek satıra indirebileceksin:
  `harfler.chars().all(|c| c.is_ascii_uppercase())`.
````
