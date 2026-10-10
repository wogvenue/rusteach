---
id: m10-l05
title: Kendi Hata Tiplerin
minutes: 18
type: lesson
objectives:
  - Bir işlemin bütün başarısızlık durumlarını, veri taşıyan varyantlarla bir hata enum'u olarak tasarlayabilmek
  - "`Result<T, KendiHatan>` döndüren fonksiyonlar yazıp hataları `match` ile kullanıcıya anlaşılır mesajlara çevirebilmek"
  - "Alttaki hataları (`ParseIntError` gibi) `map_err` ile kendi hata tipine sarıp `?` ile yayabilmek"
  - "`String`, `Box<dyn Error>` ve kendi hata enum'un arasında duruma göre seçim yapabilmek"
keywords: [hata enum'u, custom error, HesapHatasi, map_err, E0004, "Box<dyn Error>", hata tasarımı, PartialEq]
---

Bir mobil bankacılık uygulaması yazıyorsun. "Para çek" düğmesine basıldığında işlem üç farklı nedenle
başarısız olabilir: tutar sıfırdır, bakiye yetmez ya da hesap güvenlik nedeniyle kilitlenmiştir. Arayüz bu üç
durumda **farklı** davranmalı. Sıfır tutarda formu kırmızıya boyar. Yetersiz bakiyede "200 TL eksik, para
yatırmak ister misin?" diye sorar. Kilitli hesapta ise müşteri hizmetlerinin numarasını gösterir.

Şimdiye kadar hatalarımız ya standart kütüphanenin tipleriydi (`ParseIntError`) ya da `String` mesajlardı. Bu
derste kendi alanına (banka, market, oyun...) özgü **hata tiplerini** tasarlamayı öğreneceksin. Modül 7'de
öğrendiğin enum'lar burada asıl gücünü gösteriyor.

## String hatalarının sınırı

Önce bildiğimiz yoldan gidelim: hata bir `String` olsun. Çağıran, hangi hatanın oluştuğunu metne bakarak
anlamaya çalışıyor. Tahmin et:

```predict
code: |
  fn para_cek(bakiye: u64, tutar: u64) -> Result<u64, String> {
      if tutar == 0 {
          return Err(String::from("tutar sıfır olamaz"));
      }
      if tutar > bakiye {
          return Err(format!("Yetersiz bakiye: {bakiye} TL var"));
      }
      Ok(bakiye - tutar)
  }

  fn main() {
      match para_cek(300, 500) {
          Ok(kalan) => println!("Kalan: {kalan} TL"),
          Err(hata) => {
              if hata == "yetersiz bakiye" {
                  println!("Para yatırmak ister misiniz?");
              } else {
                  println!("Beklenmeyen hata: {hata}");
              }
          }
      }
  }
options:
  - "Para yatırmak ister misiniz?"
  - "Beklenmeyen hata: Yetersiz bakiye: 300 TL var"
  - "Kalan: 0 TL"
  - Derlenmez
answer: 1
explanation: |
  `==` iki metni **harfi harfine** karşılaştırır. Fonksiyonun ürettiği metin büyük harfle başlıyor ve sonunda
  bakiye bilgisi var, yani `"yetersiz bakiye"`'ye eşit değil. Program yanlış kola girdi, derleyici de seni
  uyarmadı: onun gözünde iki `String` karşılaştırmak tamamen geçerli bir işlem.
```

Bu küçük örnek, hata olarak `String` kullanmanın üç zayıflığını gösteriyor:

1. **Ayırt etmek kırılgan.** Hatanın türünü anlamak için metni karşılaştırırsın. Mesajdaki tek bir harf
   değişirse kod sessizce yanlış çalışır.
2. **Veri metne gömülü.** Çağıran eksik tutarı göstermek isterse `300`'ü metnin içinden ayıklaması gerekir.
   Fonksiyon bu sayıları biliyordu ama onları bir cümleye çevirip kaybetti.
3. **Derleyici yardım edemez.** Yarın dördüncü bir hata eklersen, onu ele alman gereken yerleri kimse sana
   göstermez.

Diğer diller bu sorunu farklı biçimlerde yaşar. C'de hatalar çoğu zaman bir tam sayı koddur (`-1`, `errno`):
ayırt edilebilir ama ek bilgi taşımaz ve kontrol etmeyi unutmak kolaydır. Java ve Python'da kendi istisna
sınıflarını (`class YetersizBakiyeHatasi(Exception)`) tanımlarsın; tipler ayrıdır, ama bir fonksiyonun hangi
istisnaları fırlatabildiği çoğu zaman imzasında görünmez. Rust'ın cevabı, bildiğin bir araç: **enum**.

## Hata enum'u tasarlamak

Her başarısızlık durumu bir **varyant** olsun. Çağıranın karar verirken ihtiyaç duyacağı bilgiler de
varyantın içinde **veri** olarak taşınsın:

```rust
#[derive(Debug)]
enum HesapHatasi {
    TutarSifir,
    YetersizBakiye { bakiye: u64, istenen: u64 },
    HesapKilitli,
}

struct Hesap {
    sahip: String,
    bakiye: u64,
    kilitli: bool,
}

impl Hesap {
    fn para_cek(&mut self, tutar: u64) -> Result<u64, HesapHatasi> {
        if self.kilitli {
            return Err(HesapHatasi::HesapKilitli);
        }
        if tutar == 0 {
            return Err(HesapHatasi::TutarSifir);
        }
        if tutar > self.bakiye {
            return Err(HesapHatasi::YetersizBakiye { bakiye: self.bakiye, istenen: tutar });
        }
        self.bakiye -= tutar;
        Ok(self.bakiye) // kalan bakiye
    }
}

fn main() {
    let mut hesap = Hesap { sahip: String::from("Elif"), bakiye: 300, kilitli: false };

    println!("{:?}", hesap.para_cek(100));
    println!("{:?}", hesap.para_cek(0));

    // Çağıran, sayıları metinden ayıklamadan doğrudan alır:
    if let Err(HesapHatasi::YetersizBakiye { bakiye, istenen }) = hesap.para_cek(500) {
        println!("{} TL eksik (bakiye: {bakiye} TL)", istenen - bakiye);
    }

    hesap.kilitli = true;
    println!("{:?}", hesap.para_cek(50));
    println!("{} hesabında {} TL kaldı.", hesap.sahip, hesap.bakiye);
}
```

İmzaya bak: `Result<u64, HesapHatasi>`. Bu imza tek başına bir **sözleşme**dir: "ya kalan bakiyeyi veririm ya
da bu üç sorundan birini". Fonksiyonun gövdesini okumadan bile neyin ters gidebileceğini bilirsin.

Dikkat etmen gereken bir ayrıntı daha var: hata durumunda `self.bakiye`'ye **dokunulmadı**. Bütün kontroller,
durumu değiştiren satırdan (`self.bakiye -= tutar`) önce yapılıyor. İyi bir hata, işlemi yarım bırakmaz: ya
işlem tamamen olur ya da hiç olmamış gibi geri döner.

:::analogy Serbest metin şikâyet mi, form mu?
Bir kargo şirketine iki yoldan şikâyet gönderebilirsin. Birincisi serbest metinli bir e-posta: "paketim galiba
gelmedi, bir de kutu ezikti sanki". Bunu bir insanın okuyup yorumlaması gerekir. İkincisi bir iade formu:
kutucuklar (☐ Hasarlı ☐ Yanlış ürün ☐ Gecikti) ve alanlar (sipariş no, tutar). Formu bir bilgisayar da
okuyabilir; doğru birime yönlendirir, eksik alanı anında fark eder. `String` hata serbest metindir. Kendi hata
enum'un ise formdur: varyantlar kutucuk, varyant verileri doldurulan alanlar.
:::

`String` hatası ile enum hatası bellekte de farklıdır. İkisinin de `Err` durumunu `para_cek(500)` çağrısından
sonra görelim:

```memory
title: "Err(String) ve Err(HesapHatasi) bellekte"
steps:
  - caption: "`Result<u64, String>`: hata metni heap'te ayrı bir bellek bölgesinde. Her hata bir bellek ayırma (allocation) demek, sayılar da metnin içinde kaybolmuş. (`format!` biraz fazla yer ayırabilir: kapasite en az 27, çoğu zaman daha fazla.)"
    stack:
      - frame: main
        vars:
          - { name: sonuc, type: "Result<u64, String>", value: "Err | ptr · len=27 · cap≥27", to: h1 }
    heap:
      - { id: h1, value: "Yetersiz bakiye: 300 TL var", label: hata metni }
  - caption: "`Result<u64, HesapHatasi>`: hangi varyant olduğu ve alanları doğrudan stack'te. Heap yok; `bakiye` ve `istenen` birer sayı olarak hazır bekliyor."
    stack:
      - frame: main
        vars:
          - { name: sonuc, type: "Result<u64, HesapHatasi>", value: "Err | YetersizBakiye | bakiye=300 · istenen=500" }
    heap: []
```

İyi bir hata enum'u tasarlamak için birkaç kural:

- **Varyant adı ne olduğunu söylesin:** `YetersizBakiye`, `HesapKilitli`. `Hata1` ya da `Bilinmeyen` değil.
- **Karar için gereken veriyi taşı, cümleyi değil:** `bakiye` ve `istenen` sayı olarak dursun. Cümleyi gösterim
  anında kurarsın (sonraki adım).
- **Kapsamı dar tut:** bir işlem ya da modül için bir enum. Programdaki her hatayı tek bir dev enum'a doldurma;
  `para_cek`'in imzası, onun asla üretmeyeceği "dosya bulunamadı" hatasını vaat etmemeli.
- **`#[derive(Debug)]` ekle:** hatalar yazdırılır, loglanır, `main`'den döndürülür. Bunların hepsi `Debug` ister.

```quiz
question: "Bir sinema bileti uygulamasında `rezervasyon_yap` fonksiyonu için en iyi hata tasarımı hangisi?"
options:
  - "`Result<Bilet, String>`: örneğin `Err(\"Salonda yeterli koltuk yok\")`"
  - "`Result<Bilet, u8>`: 1 = salon dolu, 2 = seans geçmiş, 3 = koltuk numarası geçersiz"
  - "`enum RezervasyonHatasi { SalonDolu { bos_koltuk: u32, istenen: u32 }, SeansGecmis, GecersizKoltuk(u32) }`"
  - "`enum RezervasyonHatasi { Hata(String) }`"
answer: 2
explanation: |
  Enum'daki her varyant ayrı bir durumu adlandırır ve çağıranın ihtiyaç duyacağı veriyi taşır: kaç boş koltuk
  kaldığı, hangi koltuk numarasının geçersiz olduğu... Arayüz "yalnızca 2 koltuk kaldı, 2 bilet almak ister
  misin?" diye sorabilir. Derleyici de `match`'te her durumun ele alındığını denetler.
feedback:
  - "Metin, insan için okunaklı ama program için kırılgandır: türü ayırt etmek için metin karşılaştırman gerekir."
  - "C tarzı hata kodu: ayırt edilebilir ama anlamsız (`2` neydi?), veri taşımaz ve geçersiz kodlar (`7`) da yazılabilir."
  - Doğru! Durumlar adlandırılmış, veriler tipli.
  - "Bu, `String`'in bir enum kılığına girmiş hâli: tek varyant olduğu için hiçbir şeyi ayırt etmez."
```

## Hatayı eşleştirmek: kullanıcıya mesaj

Hata bir enum olduğuna göre, onu `match` ile açıp her durum için ayrı davranabilirsin. Kullanıcıya gösterilecek
cümleleri üreten bir metodu doğrudan hata tipinin `impl` bloğuna yazalım:

```rust
#[derive(Debug)]
enum HesapHatasi {
    TutarSifir,
    YetersizBakiye { bakiye: u64, istenen: u64 },
    HesapKilitli,
}

impl HesapHatasi {
    fn mesaj(&self) -> String {
        match self {
            HesapHatasi::TutarSifir => String::from("Lütfen sıfırdan büyük bir tutar girin."),
            HesapHatasi::YetersizBakiye { bakiye, istenen } => format!(
                "Bakiyeniz yetersiz: {bakiye} TL var, {istenen} TL istediniz ({} TL eksik).",
                istenen - bakiye
            ),
            HesapHatasi::HesapKilitli => String::from("Hesabınız kilitli. Lütfen 0850 000 00 00'ı arayın."),
        }
    }
}

fn main() {
    let hatalar = [
        HesapHatasi::TutarSifir,
        HesapHatasi::YetersizBakiye { bakiye: 300, istenen: 500 },
        HesapHatasi::HesapKilitli,
    ];
    for hata in &hatalar {
        println!("{:?}", hata); // programcı için: Debug
        println!("  → {}", hata.mesaj()); // kullanıcı için: mesaj
    }
}
```

İki ayrı görünüm var: `{:?}` ile **programcı** için yapısal bir döküm (log dosyalarına yazılır), `mesaj()` ile
**kullanıcı** için Türkçe bir cümle. Hata bir veri olarak kaldığı sürece istediğin kadar görünüm üretebilirsin:
İngilizce arayüz için ikinci bir metot, bir hata kodu, bir istatistik sayacı... Cümleyi hatanın içine
gömseydin bunların hiçbiri mümkün olmazdı.

Şimdi uygulamaya yeni bir kural geliyor: günlük para çekme limiti. Enum'a bir varyant ekledik ama `mesaj`
metodunu güncellemeyi unuttuk. Derlenir mi?

```compiles
code: |
  #[derive(Debug)]
  enum HesapHatasi {
      TutarSifir,
      YetersizBakiye { bakiye: u64, istenen: u64 },
      HesapKilitli,
      GunlukLimitAsildi { limit: u64 },
  }

  impl HesapHatasi {
      fn mesaj(&self) -> String {
          match self {
              HesapHatasi::TutarSifir => String::from("Sıfırdan büyük bir tutar girin."),
              HesapHatasi::YetersizBakiye { bakiye, istenen } => {
                  format!("{} TL eksik.", istenen - bakiye)
              }
              HesapHatasi::HesapKilitli => String::from("Hesabınız kilitli."),
          }
      }
  }

  fn main() {
      println!("{}", HesapHatasi::GunlukLimitAsildi { limit: 5000 }.mesaj());
  }
answer: false
error: E0004
explanation: |
  Derlenmez: `match` yeni varyantı kapsamıyor (**E0004**, Modül 7). Bu bir **özellik**: derleyici, yeni hata
  türünü ele alman gereken her yeri tek tek gösterir. `String` hatalarında böyle bir yardım yoktu.
```

:::error Derleyici hatası
```text
error[E0004]: non-exhaustive patterns: `&HesapHatasi::GunlukLimitAsildi { .. }` not covered
  --> src/main.rs:11:15
   |
11 |         match self {
   |               ^^^^ pattern `&HesapHatasi::GunlukLimitAsildi { .. }` not covered
   |
note: `HesapHatasi` defined here
  --> src/main.rs:2:6
   |
 2 | enum HesapHatasi {
   |      ^^^^^^^^^^^
...
 6 |     GunlukLimitAsildi { limit: u64 },
   |     ----------------- not covered
   = note: the matched value is of type `&HesapHatasi`
```
Hata, eksik varyantı adıyla söylüyor ve tanımın neresinde olduğunu gösteriyor. Büyük bir projede bu hata, yeni
hata türünü unutmadan ele almanı sağlayan bir yapılacaklar listesidir.
:::

:::warning `_ =>` ile bu korumayı kapatma
Kendi hata enum'unda `_ => String::from("Bir hata oluştu")` gibi bir yakalama kolu yazarsan E0004 bir daha hiç
çıkmaz. Yeni eklenen varyantlar sessizce bu genel mesaja düşer. Kendi enum'larında her varyantı açıkça
yazmayı alışkanlık edin. İkinci dersteki `_` zorunluluğu ise farklıydı: `IntErrorKind` gibi standart
kütüphane enum'ları `#[non_exhaustive]` olduğu için orada `_` şarttı.
:::

## Alttaki hataları sarmak

Gerçek bir işlem birden çok adımdan oluşur ve her adımın kendi hata tipi vardır. Bir ATM ekranında kullanıcı
tutarı metin olarak yazıyor. Önce metin sayıya çevrilecek (`ParseIntError` çıkabilir), sonra para çekilecek
(`HesapHatasi` çıkabilir). Fonksiyonun bu iki tür hatayı **tek bir** tipte bildirmesi gerekir:

```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum HesapHatasi {
    TutarSifir,
    YetersizBakiye { bakiye: u64, istenen: u64 },
}

#[derive(Debug)]
enum AtmHatasi {
    GecersizTutar(ParseIntError), // alttaki hatayı olduğu gibi sakla
    Hesap(HesapHatasi),           // hesap katmanının hatasını sar
}

fn para_cek(bakiye: &mut u64, tutar: u64) -> Result<u64, HesapHatasi> {
    if tutar == 0 {
        return Err(HesapHatasi::TutarSifir);
    }
    if tutar > *bakiye {
        return Err(HesapHatasi::YetersizBakiye { bakiye: *bakiye, istenen: tutar });
    }
    *bakiye -= tutar;
    Ok(*bakiye)
}

fn atm_islemi(bakiye: &mut u64, girdi: &str) -> Result<u64, AtmHatasi> {
    let tutar = girdi
        .trim()
        .parse::<u64>()
        .map_err(AtmHatasi::GecersizTutar)?; // |hata| AtmHatasi::GecersizTutar(hata) ile aynı
    let kalan = para_cek(bakiye, tutar).map_err(AtmHatasi::Hesap)?;
    Ok(kalan)
}

fn main() {
    let mut bakiye = 1000;
    for girdi in ["250", "iki yüz", "0", "5000"] {
        match atm_islemi(&mut bakiye, girdi) {
            Ok(kalan) => println!("'{girdi}' → çekildi, kalan {kalan} TL"),
            Err(AtmHatasi::GecersizTutar(hata)) => println!("'{girdi}' → tutar okunamadı ({hata})"),
            Err(AtmHatasi::Hesap(HesapHatasi::TutarSifir)) => println!("'{girdi}' → tutar sıfır olamaz"),
            Err(AtmHatasi::Hesap(HesapHatasi::YetersizBakiye { bakiye, istenen })) => {
                println!("'{girdi}' → {istenen} TL istendi, yalnızca {bakiye} TL var")
            }
        }
    }
}
```

Dördüncü dersteki `map_err`'i hatırla: `Err` tarafına bir dönüşüm uygular. Burada her alttaki hatayı kendi
enum'umuzun bir varyantına **sarıyoruz**. Hata kaybolmuyor; `GecersizTutar` varyantının içinde orijinal
`ParseIntError` duruyor, ayrıntısı istenirse oradan okunabilir. `main`'deki `match` ise iç içe desenlerle
(`Err(AtmHatasi::Hesap(HesapHatasi::TutarSifir))`) en içteki varyanta kadar inebiliyor.

:::tip Kısayol: varyant adı bir fonksiyondur
`map_err`'e bu sefer closure değil, doğrudan `AtmHatasi::GecersizTutar` verdik. Tuple biçimindeki bir varyant,
içine koyacağı değeri alıp enum'u döndüren bir **fonksiyon** gibi davranır; yani
`.map_err(AtmHatasi::GecersizTutar)` ile `.map_err(|hata| AtmHatasi::GecersizTutar(hata))` aynı şeydir. Uzun
hâlini yazarsan Clippy kısaltmanı önerir (`redundant_closure`). Modül 11'de `From` trait'ini öğrenince bir adım
daha kısalacak: `?`'nin içindeki `From::from` (üçüncü ders) sarma işini kendiliğinden yapacak, `map_err` bile
gerekmeyecek.
:::

```fill
prompt: |
  Bir spor salonu üyelik formunda yaş alanı okunuyor. Boşlukları doldur: okuma hatası `KayitHatasi::Okunamadi`
  varyantına sarılsın, 18 yaşından küçükler ise yaşlarıyla birlikte `ResitDegil` hatası alsın.
code: |
  use std::num::ParseIntError;

  #[derive(Debug)]
  enum KayitHatasi {
      Okunamadi(ParseIntError),
      ResitDegil { yas: u8 },
  }

  fn yas_oku(metin: &str) -> Result<u8, KayitHatasi> {
      let yas = metin.trim().parse::<u8>().___0(KayitHatasi::Okunamadi)?;
      if yas < 18 {
          return ___1(KayitHatasi::ResitDegil { yas });
      }
      Ok(yas)
  }

  fn main() {
      for girdi in ["25", "16", "yirmi"] {
          match yas_oku(girdi) {
              Ok(yas) => println!("{yas}: kayıt tamam"),
              Err(KayitHatasi::ResitDegil { yas }) => println!("{yas}: veli onayı gerekli"),
              Err(KayitHatasi::Okunamadi(hata)) => println!("{girdi}: {hata}"),
          }
      }
  }
blanks:
  - ["map_err"]
  - ["Err"]
output: |
  25: kayıt tamam
  16: veli onayı gerekli
  yirmi: invalid digit found in string
explanation: |
  `map_err(KayitHatasi::Okunamadi)`, `ParseIntError`'ı enum'umuzun varyantına sarar; varyant adı burada bir
  fonksiyon gibi kullanılıyor. İş kuralı ihlalinde ise hatayı kendimiz oluşturup `return Err(...)` ile
  döndürüyoruz. `?` yalnızca bir `Result`'ı açarken işe yarar; yeni bir hatayı döndürmek için `Err(...)` ile
  sarman gerekir.
```

## Kendi hata tipin main'de ve testlerde

Üçüncü derste `main`'in `Result` döndürebildiğini görmüştük. Kendi hata tipinle de olur:

```rust,norun
# #[allow(dead_code)] // alanlar yalnızca Debug ile okunuyor
#[derive(Debug)]
enum HesapHatasi {
    YetersizBakiye { bakiye: u64, istenen: u64 },
}

fn para_cek(bakiye: u64, tutar: u64) -> Result<u64, HesapHatasi> {
    if tutar > bakiye {
        return Err(HesapHatasi::YetersizBakiye { bakiye, istenen: tutar });
    }
    Ok(bakiye - tutar)
}

fn main() -> Result<(), HesapHatasi> {
    let kalan = para_cek(300, 500)?;
    println!("Kalan: {kalan} TL");
    Ok(())
}
```

:::error Program çıktısı (stderr)
```text
Error: YetersizBakiye { bakiye: 300, istenen: 500 }
```
`main`'in hata tipi için tek şart `Debug` olması; Rust hatayı `{:?}` ile yazar ve program **1** çıkış koduyla
biter. (Bu program bilerek hatayla bittiği için uygulamada çalıştırılmıyor.)
:::

Peki `main` daha esnek olan `Box<dyn Error>`'ı döndürseydi? Üçüncü derste her standart hatanın bu kutuya
kendiliğinden girdiğini görmüştük. Tahmin et:

```compiles
code: |
  use std::error::Error;

  #[derive(Debug)]
  enum HesapHatasi {
      TutarSifir,
  }

  fn para_cek(bakiye: u64, tutar: u64) -> Result<u64, HesapHatasi> {
      if tutar == 0 {
          return Err(HesapHatasi::TutarSifir);
      }
      Ok(bakiye - tutar)
  }

  fn main() -> Result<(), Box<dyn Error>> {
      let kalan = para_cek(300, 0)?;
      println!("Kalan: {kalan} TL");
      Ok(())
  }
answer: false
error: E0277
explanation: |
  Derlenmez. `Box<dyn Error>` "`Error` trait'ini uygulayan **herhangi** bir hata" demektir. Standart
  kütüphanenin hataları (`ParseIntError`, `io::Error`...) bu trait'i uygular; bizim `HesapHatasi`'mız henüz
  uygulamıyor. Yalnızca `Debug` türetmek yetmez.
```

:::error Derleyici hatası
```text
error[E0277]: `?` couldn't convert the error: `HesapHatasi: std::error::Error` is not satisfied
  --> src/main.rs:16:33
   |
15 | fn main() -> Result<(), Box<dyn Error>> {
   |              -------------------------- required `HesapHatasi: std::error::Error` because of this
16 |     let kalan = para_cek(300, 0)?;
   |                 ----------------^ the trait `std::error::Error` is not implemented for `HesapHatasi`
   |                 |
   |                 this has type `Result<_, HesapHatasi>`
   |
note: `HesapHatasi` needs to implement `std::error::Error`
  --> src/main.rs:4:1
   |
 4 | enum HesapHatasi {
   | ^^^^^^^^^^^^^^^^
   = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
   = note: required for `Box<dyn std::error::Error>` to implement `From<HesapHatasi>`
```
Son `note` tanıdık: `?` hatayı `From::from` ile kutuya koymaya çalıştı (üçüncü ders), ama kutu yalnızca `Error`
uygulayan tipleri kabul ediyor. İlk `note` çözümü söylüyor: `HesapHatasi` için `std::error::Error` trait'ini
uygulamak. Bunun için önce
`Display` (`{}` ile yazdırma) gerekiyor. İkisini de Modül 11'de, trait'leri öğrenince yazacağız. O zaman
`mesaj()` metodumuz `Display`'e, `map_err` ile sarma işimiz de `From`'a dönüşecek.
:::

Testlerde ise hatayı **karşılaştırmak** istersin: "`para_cek(300, 500)` tam olarak bu hatayı döndürmeli". Modül
7'de enum'ların `==` ile kendiliğinden karşılaştırılamadığını (E0369) görmüştük. İki yolun var:

```rust
#[derive(Debug, PartialEq)] // PartialEq: == ile karşılaştırma (ayrıntısı Modül 11'de)
enum HesapHatasi {
    TutarSifir,
    YetersizBakiye { bakiye: u64, istenen: u64 },
}

fn para_cek(bakiye: u64, tutar: u64) -> Result<u64, HesapHatasi> {
    if tutar == 0 {
        return Err(HesapHatasi::TutarSifir);
    }
    if tutar > bakiye {
        return Err(HesapHatasi::YetersizBakiye { bakiye, istenen: tutar });
    }
    Ok(bakiye - tutar)
}

fn main() {
    // 1) PartialEq ile tam karşılaştırma: varyant VE alanlar aynı olmalı
    let sonuc = para_cek(300, 500);
    println!("{}", sonuc == Err(HesapHatasi::YetersizBakiye { bakiye: 300, istenen: 500 }));

    // 2) matches! ile yalnızca varyantı denetlemek (Modül 7)
    println!("{}", matches!(sonuc, Err(HesapHatasi::YetersizBakiye { .. })));
    println!("{}", matches!(para_cek(300, 0), Err(HesapHatasi::YetersizBakiye { .. })));
}
```

Bu dersin alıştırmasındaki testler de böyle çalışıyor: `assert_eq!(sonuc, Err(...))` yazabilmek için hata
tipinin `PartialEq` türetmesi gerekiyor.

```quiz
question: "`matches!(para_cek(300, 0), Err(HesapHatasi::YetersizBakiye { .. }))` ifadesi neyi döndürür?"
options:
  - "`true`: sonuç bir `Err` olduğu için"
  - "`false`: `para_cek(300, 0)` bir `Err(HesapHatasi::TutarSifir)` döndürüyor, bu desene uymuyor"
  - "`Err(HesapHatasi::TutarSifir)`: `matches!` eşleşen değeri döndürür"
  - "Derlenmez: `{ .. }` ile alanlar atlanamaz"
answer: 1
explanation: |
  `matches!(değer, desen)` bir `bool` döndürür: değer desene uyuyorsa `true`. Desen yalnızca `Err` değil,
  `Err` **içinde `YetersizBakiye`** istiyor. `para_cek(300, 0)` ise `TutarSifir` döndürür. `{ .. }` deseni
  "alanların değeri önemli değil" demektir (Modül 7).
feedback:
  - "Desen yalnızca `Err(_)` olsaydı doğru olurdu; ama içteki varyant da eşleşmeli."
  - Doğru!
  - "`matches!` her zaman bir `bool` döndürür; değeri açmaz."
  - "`{ .. }`, struct biçimli varyantlarda kalan alanları yok saymanın normal yoludur."
```

| Hata tipi | Ne zaman? | Artısı | Eksisi |
|---|---|---|---|
| `String` | Hızlı denemeler, yalnızca insanın okuyacağı hatalar | Yazması kolay | Program ayırt edemez, veri metne gömülü |
| `Box<dyn Error>` | `main`, küçük araçlar, hatanın yalnızca yazdırılacağı yerler | Her standart hatayı `?` ile taşır | Çağıran hangi hatanın geldiğini kolayca bilemez |
| Kendi enum'un | Kütüphaneler, iş mantığı, çağıranın hataya göre davranacağı her yer | Ayırt edilebilir, veri taşır, derleyici denetler | Biraz daha fazla kod (Modül 11'deki trait'lerle azalır) |

:::info İleride: `thiserror` ve `anyhow`
Rust ekosisteminde bu tablodaki iki uç için popüler iki crate var: kütüphaneler için hata enum'larını
kısaltan `thiserror` ve uygulamalar için `Box<dyn Error>`'ın gelişmiş bir hâli olan `anyhow`. İkisi de bu
derste elle yaptığımız şeyleri otomatikleştirir. Modül 25'te kullanacağız; temelini şimdi kurduk.
:::

## Alıştırma: banka havalesi

Bir şey daha: Modül 5'teki ödünç alma kuralları burada bile seni korur. Aşağıdaki kod, bir hesaptan **aynı**
hesaba havale yapmaya çalışıyor. Derlenir mi?

```compiles
code: |
  struct Hesap {
      bakiye: u64,
  }

  fn havale(gonderen: &mut Hesap, alici: &mut Hesap, tutar: u64) {
      gonderen.bakiye -= tutar;
      alici.bakiye += tutar;
  }

  fn main() {
      let mut hesap = Hesap { bakiye: 500 };
      havale(&mut hesap, &mut hesap, 100);
      println!("{}", hesap.bakiye);
  }
answer: false
error: E0499
explanation: |
  Derlenmez: **E0499**, aynı değere aynı anda iki `&mut` referans (Modül 5). Birçok dilde "aynı hesaba
  havale" bu fonksiyonun içinde çalışma zamanında denetlenmesi gereken bir durumdur. Burada ise
  `havale(&mut Hesap, &mut Hesap, ..)` imzası onu derleme zamanında imkânsız kılıyor: bu fonksiyonun hata
  enum'una bunun için bir varyant gerekmez. Tipler ve ödünç alma kuralları bazı hataları **çalışma zamanından
  derleme zamanına** taşır. (Hesaplar gerçek bir sistemde numarayla aranıyorsa "iki numara aynı mı?" sorusu
  yine sorulur, ama iki `&mut` alınmadan **önce**; unutursan kod derlenmez.)
```

````exercise
id: m10-e-havale
title: Banka havalesi
difficulty: 3
prompt: |
  `havale(gonderen, alici, tutar)` fonksiyonunu yaz. Fonksiyon, `gonderen` hesaptan `alici` hesaba `tutar`
  kadar para aktarsın ya da başarısızlığın nedenini `HavaleHatasi` ile bildirsin. Kontrolleri **bu sırayla**
  yap:

  1. `tutar` 0 ise → `GecersizTutar`
  2. `tutar`, gönderenin `gunluk_limit`'inden büyükse → `LimitAsimi { limit, istenen }`
  3. `tutar`, gönderenin `bakiye`'sinden büyükse → `YetersizBakiye { bakiye, istenen }`

  Başarılı havalede gönderenin bakiyesi azalır, alıcınınki artar ve `Ok(())` döner. **Hata durumunda iki
  hesabın bakiyesi de değişmemeli.**

  Ardından `main`'deki `match`'i tamamla: her hata için kullanıcıya ayrı bir Türkçe mesaj yazdır.
starter: |
  #[derive(Debug, PartialEq)]
  enum HavaleHatasi {
      GecersizTutar,
      LimitAsimi { limit: u64, istenen: u64 },
      YetersizBakiye { bakiye: u64, istenen: u64 },
  }

  struct Hesap {
      sahip: String,
      bakiye: u64,
      gunluk_limit: u64,
  }

  fn havale(gonderen: &mut Hesap, alici: &mut Hesap, tutar: u64) -> Result<(), HavaleHatasi> {
      todo!()
  }

  fn main() {
      let mut ayse = Hesap { sahip: String::from("Ayşe"), bakiye: 2_000, gunluk_limit: 1_500 };
      let mut can = Hesap { sahip: String::from("Can"), bakiye: 100, gunluk_limit: 1_000 };

      for tutar in [500, 0, 1_800, 1_200] {
          match havale(&mut ayse, &mut can, tutar) {
              Ok(()) => println!("{tutar} TL gönderildi."),
              Err(hata) => println!("{tutar} TL: {hata:?}"), // her hata için ayrı bir mesaj yaz
          }
      }
      println!("{}: {} TL, {}: {} TL", ayse.sahip, ayse.bakiye, can.sahip, can.bakiye);
  }
solution: |
  #[derive(Debug, PartialEq)]
  enum HavaleHatasi {
      GecersizTutar,
      LimitAsimi { limit: u64, istenen: u64 },
      YetersizBakiye { bakiye: u64, istenen: u64 },
  }

  struct Hesap {
      sahip: String,
      bakiye: u64,
      gunluk_limit: u64,
  }

  fn havale(gonderen: &mut Hesap, alici: &mut Hesap, tutar: u64) -> Result<(), HavaleHatasi> {
      if tutar == 0 {
          return Err(HavaleHatasi::GecersizTutar);
      }
      if tutar > gonderen.gunluk_limit {
          return Err(HavaleHatasi::LimitAsimi { limit: gonderen.gunluk_limit, istenen: tutar });
      }
      if tutar > gonderen.bakiye {
          return Err(HavaleHatasi::YetersizBakiye { bakiye: gonderen.bakiye, istenen: tutar });
      }
      gonderen.bakiye -= tutar;
      alici.bakiye += tutar;
      Ok(())
  }

  fn main() {
      let mut ayse = Hesap { sahip: String::from("Ayşe"), bakiye: 2_000, gunluk_limit: 1_500 };
      let mut can = Hesap { sahip: String::from("Can"), bakiye: 100, gunluk_limit: 1_000 };

      for tutar in [500, 0, 1_800, 1_200] {
          match havale(&mut ayse, &mut can, tutar) {
              Ok(()) => println!("{tutar} TL gönderildi."),
              Err(HavaleHatasi::GecersizTutar) => println!("Tutar sıfırdan büyük olmalı."),
              Err(HavaleHatasi::LimitAsimi { limit, istenen }) => {
                  println!("{istenen} TL, günlük {limit} TL limitinizi aşıyor.")
              }
              Err(HavaleHatasi::YetersizBakiye { bakiye, istenen }) => {
                  println!("{istenen} TL için bakiye yetersiz ({bakiye} TL var).")
              }
          }
      }
      println!("{}: {} TL, {}: {} TL", ayse.sahip, ayse.bakiye, can.sahip, can.bakiye);
  }
check: tests
tests: |
  fn hesap(bakiye: u64, gunluk_limit: u64) -> Hesap {
      Hesap { sahip: String::from("test"), bakiye, gunluk_limit }
  }

  #[test]
  fn basarili_havale_bakiyeleri_gunceller() {
      let mut a = hesap(2_000, 1_500);
      let mut b = hesap(100, 1_000);
      assert_eq!(havale(&mut a, &mut b, 500), Ok(()), "500 TL limitin ve bakiyenin içinde");
      assert_eq!(a.bakiye, 1_500, "gönderenin bakiyesi 500 TL azalmalı");
      assert_eq!(b.bakiye, 600, "alıcının bakiyesi 500 TL artmalı");
      assert_eq!(havale(&mut a, &mut b, 1_500), Ok(()), "tutar limite ve bakiyeye eşitse havale yapılabilir");
      assert_eq!((a.bakiye, b.bakiye), (0, 2_100), "bütün bakiye gönderilebilir");
  }

  #[test]
  fn sifir_tutar_gecersiz() {
      let mut a = hesap(2_000, 1_500);
      let mut b = hesap(100, 1_000);
      assert_eq!(havale(&mut a, &mut b, 0), Err(HavaleHatasi::GecersizTutar), "0 TL havale edilemez");
  }

  #[test]
  fn limit_asimi_verileriyle_doner() {
      let mut a = hesap(5_000, 1_500);
      let mut b = hesap(100, 1_000);
      assert_eq!(
          havale(&mut a, &mut b, 1_800),
          Err(HavaleHatasi::LimitAsimi { limit: 1_500, istenen: 1_800 }),
          "gönderenin limiti 1500, istenen 1800"
      );
  }

  #[test]
  fn yetersiz_bakiye_verileriyle_doner() {
      let mut a = hesap(300, 1_500);
      let mut b = hesap(100, 1_000);
      assert_eq!(
          havale(&mut a, &mut b, 1_200),
          Err(HavaleHatasi::YetersizBakiye { bakiye: 300, istenen: 1_200 }),
          "bakiye 300, istenen 1200"
      );
  }

  #[test]
  fn kontrol_sirasi_ve_hatada_degisiklik_yok() {
      let mut a = hesap(300, 1_000);
      let mut b = hesap(100, 1_000);
      assert_eq!(
          havale(&mut a, &mut b, 2_000),
          Err(HavaleHatasi::LimitAsimi { limit: 1_000, istenen: 2_000 }),
          "tutar hem limiti hem bakiyeyi aşıyorsa önce limit kontrol edilir"
      );
      assert_eq!((a.bakiye, b.bakiye), (300, 100), "hata durumunda iki bakiye de değişmemeli");
  }
hints:
  - "Üç kontrolü sırayla yaz; her biri koşul sağlanırsa `return Err(...)` ile fonksiyondan çıksın. Bakiyeleri **ancak bütün kontroller geçtikten sonra** değiştir."
  - "Struct biçimli bir varyantı alan adlarıyla oluşturursun: `HavaleHatasi::LimitAsimi { limit: gonderen.gunluk_limit, istenen: tutar }`."
  - |
    Son kısım şöyle olmalı:
    ```rust
    gonderen.bakiye -= tutar;
    alici.bakiye += tutar;
    Ok(())
    ```
    `main`'de `Err(hata)` kolunu, her varyant için ayrı bir kolla değiştir: `Err(HavaleHatasi::LimitAsimi { limit, istenen }) => ...`
forbid:
  - pattern: "\\.unwrap\\(|\\.expect\\(|panic!"
    message: "Havale hataları beklenen durumlardır: panik yerine `Err(...)` döndür."
require:
  - pattern: "HavaleHatasi::LimitAsimi\\s*\\{"
    message: "`LimitAsimi` hatasını `limit` ve `istenen` alanlarıyla oluşturmalısın."
  - pattern: "HavaleHatasi::GecersizTutar\\s*\\)?\\s*=>"
    message: "`main`'deki `match`'i tamamla: her hata varyantı için ayrı bir kol yaz, örneğin `Err(HavaleHatasi::GecersizTutar) => ...`"
explanation: |
  Fonksiyon önce **bütün** kontrolleri yapıyor, durumu ancak en sonda değiştiriyor. Bu sıra önemli: bakiyeyi
  düşürdükten sonra limit kontrolü yapsaydın, hata durumunda para gönderenden çıkmış ama alıcıya ulaşmamış
  olurdu. Gerçek bankacılık sistemleri bu "ya hep ya hiç" özelliğine **atomiklik (atomicity)** der.

  Hata varyantları çağıranın ihtiyaç duyacağı bilgiyi taşıyor: arayüz "günlük limitiniz 1500 TL" diyebilmek
  için limiti metinden ayıklamak zorunda değil. `main`'deki `match` her varyantı ayrı ele alıyor; ileride
  `HesapDondurulmus` gibi yeni bir varyant eklersen derleyici bu `match`'i sana gösterecek (E0004).

  `alici.bakiye += tutar` satırı çok büyük bakiyelerde taşabilir (debug derlemede panik, Modül 2). Gerçek bir
  sistemde `checked_add` ile denetleyip `AliciBakiyeTasmasi` gibi bir varyant döndürmek daha sağlam olurdu.
````

## Özet

:::remember
- Hata türlerini bir **enum** olarak tasarla: her başarısızlık bir varyant, karar için gereken bilgiler varyantın
  **verisi** (`YetersizBakiye { bakiye, istenen }`).
- `Result<T, KendiHatan>` imzası bir sözleşmedir: neyin ters gidebileceği gövdeyi okumadan bellidir.
- Hata **veridir**, cümle değil: mesajı gösterim anında `match` ile üret (`mesaj()` metodu; Modül 11'de `Display`).
- Yeni bir varyant eklemek, onu ele almayan her `match`'te **E0004** üretir. Kendi enum'larında `_ =>` ile bu
  korumayı kapatma.
- Alttaki hataları sar: `.map_err(AtmHatasi::GecersizTutar)?`. Varyant adı bir fonksiyon gibi kullanılabilir.
- `main` kendi hata tipini döndürebilir (`Debug` yeter). `Box<dyn Error>`'a girmesi için `Error` trait'i gerekir (Modül 11).
- Hata durumunda durumu değiştirme: önce bütün kontroller, sonra değişiklik.
:::

```reflect
prompt: "Bir arkadaşın, hata tipi olarak her yerde `String` kullanmayı savunuyor: \"Mesaj zaten açık, enum yazmak gereksiz kod.\" Ona bir hata enum'unun hangi somut sorunları çözdüğünü bir örnekle anlat. Hangi durumda haklı olabilir?"
answer: |
  Model cevap: `String` hatayı yalnızca bir insan için anlamlı kılar; program için hepsi aynı tipte bir metindir.
  Arayüz "yetersiz bakiye"de para yatırma düğmesi, "hesap kilitli"de destek numarası göstermek isterse metin
  karşılaştırmak zorunda kalır ve mesajdaki tek bir harf değişikliği kodu sessizce bozar. Eksik tutar gibi
  veriler de metnin içinde kaybolur. Enum'da her durum bir varyanttır, veriler tipli alanlardır ve derleyici
  her `match`'in bütün durumları ele aldığını denetler; yeni bir hata eklendiğinde unutulan yerleri gösterir.
  Arkadaşım, hatanın yalnızca yazdırılıp programın bittiği küçük betiklerde ve hızlı denemelerde haklı olabilir:
  orada çağıran hiçbir zaman hataya göre farklı davranmaz.
```

```flashcards
- front: "`Result<u64, String>` yerine kendi hata enum'unu kullanmanın üç faydası nedir?"
  back: "Çağıran hataları metin karşılaştırmadan ayırt eder; hata tipli veri taşır (ör. `bakiye`, `istenen`); derleyici `match`'te her durumun ele alındığını denetler (E0004)."
- front: "Hata enum'unun varyantına ne koymalısın: kullanıcıya gösterilecek cümleyi mi, veriyi mi?"
  back: "Veriyi (`YetersizBakiye { bakiye, istenen }`). Cümle gösterim anında `match` ile üretilir; böylece farklı dillerde, loglarda, testlerde aynı hata kullanılabilir."
- front: "Kendi hata enum'una yeni bir varyant eklediğinde, onu ele almayan `match`'ler ne olur?"
  back: "Derlenmez: **E0004** non-exhaustive patterns. Derleyici güncellemen gereken her yeri gösterir."
- front: "`ParseIntError`'ı kendi `AtmHatasi::GecersizTutar(ParseIntError)` varyantına sarıp yaymanın en kısa yolu nedir?"
  back: "`.map_err(AtmHatasi::GecersizTutar)?`. Tuple varyantının adı bir fonksiyon gibi kullanılabilir."
- front: "`main() -> Result<(), HesapHatasi>` için `HesapHatasi`'nın neyi uygulaması gerekir?"
  back: "Yalnızca `Debug`. `Err` dönerse `Error: {:?}` biçiminde yazılır, çıkış kodu 1 olur."
- front: "`fn main() -> Result<(), Box<dyn Error>>` içinde kendi `HesapHatasi`'na `?` uygulamak neden derlenmez?"
  back: "`HesapHatasi`, `std::error::Error` trait'ini uygulamıyor (E0277). `Display` + `Error` uygulanınca çalışır (Modül 11)."
- front: "Testlerde `assert_eq!(sonuc, Err(HesapHatasi::TutarSifir))` yazabilmek için hata enum'una ne eklenir?"
  back: "`#[derive(Debug, PartialEq)]`. Alternatif: `assert!(matches!(sonuc, Err(HesapHatasi::TutarSifir)))`."
- front: "Bir işlem hata döndürdüğünde nesnenin durumu (ör. bakiye) için iyi kural nedir?"
  back: "Hiç değişmemeli: önce bütün kontrolleri yap, durumu en sonda değiştir (atomiklik)."
```
