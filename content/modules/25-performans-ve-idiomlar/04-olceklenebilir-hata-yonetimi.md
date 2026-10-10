---
id: m25-l04
title: Ölçeklenebilir Hata Yönetimi
minutes: 26
type: lesson
objectives:
  - "`thiserror` ile `#[error(...)]`, `#[from]`, `#[source]` ve `#[error(transparent)]` kullanan kütüphane hata tipleri tanımlayabilmek"
  - "`source()` zincirini dolaşabilmek ve bir hatanın kaynağını hem mesajda hem `source`'ta tekrarlamama kuralını uygulayabilmek"
  - "`anyhow::Result`, `context`/`with_context`, `bail!` ve `ensure!` ile uygulama kodunda bağlamlı hatalar üretebilmek"
  - Kütüphane ve uygulama için doğru hata stratejisini seçip gerekçelendirebilmek
keywords: [thiserror, anyhow, Error, source, context, with_context, bail, ensure, downcast, hata zinciri, hata tasarımı]
---

Modül 10'da `Result` ve `?` ile tanıştın, Modül 11'de kendi hata tipine `Display`, `Error` ve
`From` uygulamayı öğrendin. Küçük bir programda bu yeterli. Peki projen büyüdüğünde? On beş
varyantlı bir hata enum'u için yüz satır `Display` ve `From` kodu mu yazacaksın? Kullanıcı
"Error: invalid digit found in string" gördüğünde, **hangi dosyanın hangi satırında hangi
alanın** hatalı olduğunu nereden bilecek?

Rust ekosistemi bu iki soruya iki crate ile cevap verir: kütüphaneler için **thiserror**, uygulamalar
için **anyhow**. İkisi de aynı yazarın (David Tolnay) eseridir ve birbirini tamamlar. Bu derste
ikisini, ne zaman hangisini seçeceğini ve iyi bir hata mesajının anatomisini öğreneceksin.

## Elle yazılan hata tipinin bedeli

Bir ayar dosyası okuyucusunun hata tipini Modül 11'deki gibi elle yazalım:

```rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum AyarHatasi {
    AnahtarEksik { satir: usize },
    GecersizPort(ParseIntError),
}

impl fmt::Display for AyarHatasi {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AyarHatasi::AnahtarEksik { satir } => write!(f, "satır {satir}: anahtar eksik"),
            AyarHatasi::GecersizPort(_) => write!(f, "port sayı olmalı"),
        }
    }
}

impl Error for AyarHatasi {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            AyarHatasi::GecersizPort(e) => Some(e),
            _ => None,
        }
    }
}

impl From<ParseIntError> for AyarHatasi {
    fn from(e: ParseIntError) -> Self {
        AyarHatasi::GecersizPort(e)
    }
}

fn port_oku(deger: &str) -> Result<u16, AyarHatasi> {
    Ok(deger.trim().parse()?)
}

fn main() {
    match port_oku("80a") {
        Ok(p) => println!("port: {p}"),
        Err(e) => println!("hata: {e} (kaynak: {:?})", e.source().map(|s| s.to_string())),
    }
    println!("{}", AyarHatasi::AnahtarEksik { satir: 3 });
}
```

İki varyant için yaklaşık 30 satır tören kodu. Her yeni varyantta üç yeri (`Display`, `source`, `From`) güncellemeyi
unutmamalısın. Bu **boilerplate**, hata tiplerini zenginleştirmeyi caydırır; programcılar da
sonunda her şeyi `String`'e çevirip bilgiyi kaybeder.

```quiz
question: |
  Modül 10-11'i hatırla. `port_oku` içindeki `deger.trim().parse()?` ifadesinde `parse`'ın hatası
  `ParseIntError`, fonksiyonun hata tipi `AyarHatasi`. `?` bu dönüşümü nasıl yapıyor?
options:
  - "`?` her hatayı otomatik olarak `Box<dyn Error>`'a çevirir"
  - "`?` hata durumunda `return Err(From::from(e))` yapar; `impl From<ParseIntError> for AyarHatasi` bu yüzden gerekli"
  - "`?` yalnızca hata tipleri **aynı** olduğunda çalışır; burada `as` dönüşümü yapılıyor"
answer: 1
explanation: |
  `?` operatörü `Err(e)` gördüğünde `From::from(e)` ile hatayı fonksiyonun dönüş tipine
  dönüştürür ve erken döner. `From<ParseIntError> for AyarHatasi` uygulaması olmasaydı derleyici
  `E0277: ? couldn't convert the error to AyarHatasi` hatası verirdi. Hem `thiserror`'ın `#[from]`'u
  hem de `anyhow`'ın her hatayı kabul etmesi bu mekanizmanın üzerine kuruludur.
feedback:
  - "`Box<dyn Error>`'a dönüşüm de `From` sayesinde olur, ama yalnızca dönüş tipi gerçekten `Box<dyn Error>` ise."
  - Doğru! `?` = eşleştir + `From::from` + erken dönüş.
  - "`as` yalnızca sayısal/ilkel dönüşümler içindir; `?` farklı hata tiplerini `From` ile köprüler."
```

`From` uygulamasını silip `port_oku`'nun gövdesini `let port = deger.trim().parse::<u16>()?; Ok(port)`
yaparsan derleyici bu bağı açıkça söyler:

:::error
```text
error[E0277]: `?` couldn't convert the error to `AyarHatasi`
  --> src/main.rs:30:43
   |
29 | fn port_oku(deger: &str) -> Result<u16, AyarHatasi> {
   |                             ----------------------- expected `AyarHatasi` because of this
30 |     let port = deger.trim().parse::<u16>()?;
   |                             --------------^ the trait `From<ParseIntError>` is not implemented for `AyarHatasi`
   |                             |
   |                             this can't be annotated with `?` because it has type `Result<_, ParseIntError>`
   |
note: `AyarHatasi` needs to implement `From<ParseIntError>`
  --> src/main.rs:6:1
   |
 6 | enum AyarHatasi {
   | ^^^^^^^^^^^^^^^
   = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
```
Son `note` satırı `?`'in sırrını tek cümlede veriyor: dönüşüm **`From` ile** yapılır. Birazdan
göreceğin `#[from]` özniteliği, tam olarak bu eksik `impl From<ParseIntError> for AyarHatasi`'yı
senin yerine yazar.
:::

## thiserror: kütüphaneler için hata tipleri

**thiserror**, aynı kodu bir `derive` makrosuyla (Modül 23) üretir. Rusteach'te çevrim içi çalışır:

```rust
use std::num::ParseIntError;
use thiserror::Error;

#[derive(Debug, Error)]
enum AyarHatasi {
    #[error("satır {satir}: anahtar eksik")]
    AnahtarEksik { satir: usize },

    #[error("port sayı olmalı")]
    GecersizPort(#[from] ParseIntError),

    #[error("{anahtar:?} anahtarı için {deger} aralık dışı (en fazla {en_fazla})")]
    AralikDisi { anahtar: String, deger: u64, en_fazla: u64 },
}

fn port_oku(deger: &str) -> Result<u16, AyarHatasi> {
    let n: u64 = deger.trim().parse()?; // #[from] sayesinde ? çalışır
    if n > 65_535 {
        return Err(AyarHatasi::AralikDisi { anahtar: "port".into(), deger: n, en_fazla: 65_535 });
    }
    Ok(n as u16)
}

fn main() {
    for girdi in ["8080", "80a", "70000"] {
        match port_oku(girdi) {
            Ok(p) => println!("✓ {p}"),
            Err(e) => println!("✗ {e}"),
        }
    }
    println!("✗ {}", AyarHatasi::AnahtarEksik { satir: 7 });
}
```

Öznitelikler:

| Öznitelik | Ne üretir? |
|---|---|
| `#[derive(Error)]` | `impl std::error::Error` |
| `#[error("...")]` | `impl Display`; `{alan}`, `{0}` (tuple alanı), `{alan:?}` biçimleri kullanılabilir |
| `#[from]` | `impl From<KaynakTip>` **ve** o alanı `source()` olarak döndürme |
| `#[source]` | `From` üretmeden yalnızca `source()` (dönüşüm istemediğin durumlar için) |
| `#[error(transparent)]` | `Display` ve `source`'u olduğu gibi içteki hataya devret (sarmalayıcı varyantlar için) |

thiserror'ın en önemli özelliği **görünmez** olmasıdır: ürettiği kod, elle yazacağın kodun
aynısıdır. Kullanıcıların thiserror'a bağımlı olmaz, public API'nde thiserror'a ait tek bir tip
bile yoktur. İstersen yarın derive'ı silip elle yazabilirsin; kimse fark etmez.

```predict
code: |
  use thiserror::Error;

  #[derive(Debug, Error)]
  enum BankaHatasi {
      #[error("yetersiz bakiye: {bakiye} TL var, {istenen} TL istendi")]
      YetersizBakiye { bakiye: u32, istenen: u32 },
      #[error("hesap bulunamadı: {0:?}")]
      HesapYok(String),
      #[error("günlük limit aşıldı")]
      Limit,
  }

  fn main() {
      let hatalar = [
          BankaHatasi::HesapYok("TR12".into()),
          BankaHatasi::YetersizBakiye { bakiye: 50, istenen: 200 },
          BankaHatasi::Limit,
      ];
      for h in &hatalar {
          println!("{h}");
      }
  }
options:
  - |
    hesap bulunamadı: "TR12"
    yetersiz bakiye: 50 TL var, 200 TL istendi
    günlük limit aşıldı
  - |
    hesap bulunamadı: TR12
    yetersiz bakiye: 50 TL var, 200 TL istendi
    günlük limit aşıldı
  - |
    HesapYok("TR12")
    YetersizBakiye { bakiye: 50, istenen: 200 }
    Limit
answer: 0
explanation: |
  `{h}` `Display`'i çağırır ve thiserror `Display`'i `#[error(...)]` şablonlarından üretir.
  `{0:?}` tuple alanını **Debug** biçimiyle yazar; `String`'in Debug'ı tırnak içerir, bu yüzden
  `"TR12"` tırnaklı görünür. Üçüncü seçenek `{h:?}` (derive edilmiş `Debug`) olsaydı geçerli olurdu.
```

## Hata zincirleri: `source()`

Gerçek hatalar katmanlıdır: "ayar yüklenemedi" ← "satır 4 geçersiz" ← "invalid digit found in
string". Her katman bir öncekini `source()` ile gösterir ve bir **zincir** oluşur. Zinciri Modül
7'deki `while let` ile dolaşabilirsin. Önce tahmin et:

```predict
code: |
  use std::error::Error;
  use thiserror::Error;

  #[derive(Debug, Error)]
  enum SiparisHatasi {
      #[error("geçersiz adet: {0}")]
      Adet(#[from] std::num::ParseIntError),
  }

  fn adet_oku(s: &str) -> Result<u32, SiparisHatasi> {
      Ok(s.parse()?)
  }

  fn main() {
      let hata = adet_oku("üç").unwrap_err();
      let mut sonraki: Option<&dyn Error> = Some(&hata);
      while let Some(h) = sonraki {
          println!("- {h}");
          sonraki = h.source();
      }
  }
options:
  - |
    - geçersiz adet: invalid digit found in string
  - |
    - geçersiz adet: invalid digit found in string
    - invalid digit found in string
  - |
    - geçersiz adet
    - invalid digit found in string
answer: 1
explanation: |
  `#[from]` alanı hem `From` üretir hem de `source()` olarak döndürülür. Mesaj şablonu da `{0}` ile
  aynı hatayı yazdırıyor. Sonuç: zinciri dolaşan her araç (anyhow'ın `{:#}`'u, log kütüphaneleri)
  aynı bilgiyi **iki kez** gösterir.
```

Rust'ın hata yönetimi çalışma grubunun önerisi nettir: bir hata, kaynağını **ya** kendi
mesajına koymalı **ya da** `source()` ile döndürmeli, **ikisini birden asla**. Kaynak döndüren
varyantlarda mesajı kısa ve kendi katmanına özgü tut:

```rust
use std::error::Error;
use thiserror::Error;

#[derive(Debug, Error)]
enum SiparisHatasi {
    #[error("geçersiz adet")] // kaynağın mesajı burada YOK; source() taşıyor
    Adet(#[from] std::num::ParseIntError),
}

fn hata_zinciri(hata: &dyn Error) -> String {
    let mut parcalar = vec![hata.to_string()];
    let mut sonraki = hata.source();
    while let Some(h) = sonraki {
        parcalar.push(h.to_string());
        sonraki = h.source();
    }
    parcalar.join(" ← ")
}

fn main() {
    let hata: SiparisHatasi = "üç".parse::<u32>().unwrap_err().into();
    println!("{}", hata_zinciri(&hata));
}
```

:::analogy Kargo takip geçmişi
İyi bir hata zinciri kargo takip ekranı gibidir: "Teslim edilemedi ← Adres bulunamadı ← Sokak adı
eksik". Her satır **kendi** adımını anlatır. Her satır bir öncekinin tamamını tekrarlasaydı
("Teslim edilemedi çünkü adres bulunamadı çünkü sokak adı eksik ← Adres bulunamadı çünkü sokak adı
eksik ← ...") ekran okunmaz hâle gelirdi.
:::

Şimdi bir kütüphanenin hata tipini kendin tasarla:

```exercise
id: m25-e-siparis-hatasi
title: thiserror ile sipariş hataları
difficulty: 3
prompt: |
  Bir market kütüphanesi yazıyorsun. `SiparisHatasi` enum'unu **thiserror** ile tanımla ve
  `siparis_ver` fonksiyonunu yaz.

  Varyantlar ve mesajları (birebir aynı olmalı):

  - `BilinmeyenUrun(String)` → `bilinmeyen ürün: <ad>` (örn. `bilinmeyen ürün: kivi`)
  - `GecersizAdet(ParseIntError)` → `geçersiz adet` (kaynak hata `source()` ile döndürülür,
    `?` ile otomatik dönüşüm için `#[from]` kullan)
  - `StokYetersiz { urun: String, istenen: u32, mevcut: u32 }` →
    `<urun> için stok yetersiz: istenen <istenen>, mevcut <mevcut>`

  `siparis_ver(stok, urun, adet_metni)`: ürün `stok`'ta yoksa `BilinmeyenUrun`; `adet_metni`
  (kırpılarak) `u32`'ye çevrilemezse `GecersizAdet` (`?` kullan); stok yetmezse `StokYetersiz`;
  aksi hâlde stoktan düşüp **kalan** miktarı `Ok` ile döndür.
starter: |
  use std::collections::HashMap;
  use std::num::ParseIntError;
  use thiserror::Error;

  #[derive(Debug, Error)]
  enum SiparisHatasi {
      // varyantları ve #[error(...)] mesajlarını buraya yaz
      #[error("TODO")]
      Taslak(ParseIntError),
  }

  fn siparis_ver(stok: &mut HashMap<String, u32>, urun: &str, adet_metni: &str) -> Result<u32, SiparisHatasi> {
      todo!()
  }

  fn main() {
      let mut stok = HashMap::from([("elma".to_string(), 10), ("ekmek".to_string(), 3)]);
      println!("{:?}", siparis_ver(&mut stok, "elma", "4"));
      match siparis_ver(&mut stok, "ekmek", "5") {
          Ok(kalan) => println!("kalan: {kalan}"),
          Err(e) => println!("hata: {e}"),
      }
  }
solution: |
  use std::collections::HashMap;
  use std::num::ParseIntError;
  use thiserror::Error;

  #[derive(Debug, Error)]
  enum SiparisHatasi {
      #[error("bilinmeyen ürün: {0}")]
      BilinmeyenUrun(String),
      #[error("geçersiz adet")]
      GecersizAdet(#[from] ParseIntError),
      #[error("{urun} için stok yetersiz: istenen {istenen}, mevcut {mevcut}")]
      StokYetersiz { urun: String, istenen: u32, mevcut: u32 },
  }

  fn siparis_ver(stok: &mut HashMap<String, u32>, urun: &str, adet_metni: &str) -> Result<u32, SiparisHatasi> {
      let Some(mevcut) = stok.get_mut(urun) else {
          return Err(SiparisHatasi::BilinmeyenUrun(urun.to_string()));
      };
      let istenen: u32 = adet_metni.trim().parse()?;
      if istenen > *mevcut {
          return Err(SiparisHatasi::StokYetersiz { urun: urun.to_string(), istenen, mevcut: *mevcut });
      }
      *mevcut -= istenen;
      Ok(*mevcut)
  }

  fn main() {
      let mut stok = HashMap::from([("elma".to_string(), 10), ("ekmek".to_string(), 3)]);
      println!("{:?}", siparis_ver(&mut stok, "elma", "4"));
      match siparis_ver(&mut stok, "ekmek", "5") {
          Ok(kalan) => println!("kalan: {kalan}"),
          Err(e) => println!("hata: {e}"),
      }
  }
check: tests
tests: |
  use std::error::Error;

  fn ornek_stok() -> HashMap<String, u32> {
      HashMap::from([("elma".to_string(), 10), ("ekmek".to_string(), 3)])
  }

  #[test]
  fn basarili_siparis_stoktan_duser() {
      let mut stok = ornek_stok();
      assert_eq!(siparis_ver(&mut stok, "elma", "4").unwrap(), 6, "10 elmadan 4'ü satılınca 6 kalır");
      assert_eq!(siparis_ver(&mut stok, "elma", " 6 ").unwrap(), 0, "adet metni kırpılmalı; kalan 0");
      assert_eq!(stok["elma"], 0);
  }

  #[test]
  fn bilinmeyen_urun() {
      let mut stok = ornek_stok();
      let e = siparis_ver(&mut stok, "kivi", "1").unwrap_err();
      assert!(matches!(e, SiparisHatasi::BilinmeyenUrun(ref u) if u == "kivi"));
      assert_eq!(e.to_string(), "bilinmeyen ürün: kivi");
  }

  #[test]
  fn gecersiz_adet_kaynagi_source_ile_doner() {
      let mut stok = ornek_stok();
      let e = siparis_ver(&mut stok, "elma", "dört").unwrap_err();
      assert!(matches!(e, SiparisHatasi::GecersizAdet(_)), "parse hatası ? ile GecersizAdet'e dönüşmeli");
      assert_eq!(e.to_string(), "geçersiz adet", "kaynağın mesajı Display'de tekrarlanmamalı");
      let kaynak = e.source().expect("GecersizAdet kaynağını source() ile döndürmeli (#[from])");
      assert_eq!(kaynak.to_string(), "invalid digit found in string");
  }

  #[test]
  fn stok_yetersiz_ve_stok_degismez() {
      let mut stok = ornek_stok();
      let e = siparis_ver(&mut stok, "ekmek", "5").unwrap_err();
      assert_eq!(e.to_string(), "ekmek için stok yetersiz: istenen 5, mevcut 3");
      assert_eq!(stok["ekmek"], 3, "başarısız siparişte stok değişmemeli");
      assert!(e.source().is_none(), "StokYetersiz'in kaynağı yoktur");
  }
hints:
  - "Varyantlar: `#[error(\"bilinmeyen ürün: {0}\")] BilinmeyenUrun(String)`, `#[error(\"geçersiz adet\")] GecersizAdet(#[from] ParseIntError)` ve alanlı `StokYetersiz { urun: String, istenen: u32, mevcut: u32 }`; şablonda `{urun}`, `{istenen}`, `{mevcut}` kullan."
  - "Ürünü `stok.get_mut(urun)` ile al; `let Some(mevcut) = ... else { return Err(...) };` (Modül 7) güzel bir kalıp. Sonra `let istenen: u32 = adet_metni.trim().parse()?;`"
  - "`mevcut` bir `&mut u32`: karşılaştırırken `*mevcut`, düşerken `*mevcut -= istenen;`. Stok kontrolünü düşmeden **önce** yap ki hata durumunda stok değişmesin."
explanation: |
  `#[from]` iki iş yapıyor: `?` operatörünün `ParseIntError`'ı otomatik dönüştürmesini sağlayan
  `From` uygulaması ve `source()`'un bu hatayı döndürmesi. Mesajı `"geçersiz adet"` olarak kısa
  tuttuğumuz için zincir `geçersiz adet ← invalid digit found in string` şeklinde temiz okunur.

  Hatalar **veri** olarak kaldı (Modül 10): çağıran `StokYetersiz { mevcut, .. }` ile eşleşip
  "en fazla 3 ekmek alabilirsiniz" diyebilir; bir `String` hatasından bunu çıkarmak imkânsız
  olurdu. Kütüphane hataları bu yüzden enum'dur.

  `let ... else` ile "ürün yoksa erken dön" mantığı iç içe `match` olmadan yazıldı. Stok kontrolü
  düşmeden önce yapıldığı için başarısız bir sipariş tutarsız bir durum bırakmaz.
```

## anyhow: uygulamalar için hata yönetimi

Kütüphane yazarken çağıranın hataları **ayırt edebilmesi** gerekir. Bir uygulamanın `main`'inde
ise çoğu zaman tek bir şey istersin: hatayı yukarı taşı, yolda **bağlam** ekle ve sonunda
kullanıcıya anlaşılır bir mesaj göster. **anyhow** tam bunu yapar:

- `anyhow::Error`: `std::error::Error + Send + Sync + 'static` olan **her** hatayı tutabilen tek
  bir tip (Modül 10'daki `Box<dyn Error>`'ın güçlendirilmiş hâli; sadece 8 bayt).
- `anyhow::Result<T>` = `Result<T, anyhow::Error>`.
- `.context("...")` / `.with_context(|| format!(...))`: hataya bir üst katman mesajı ekler
  (`Result` ve `Option` üzerinde çalışır).
- `bail!("...")` = `return Err(anyhow!("..."))`; `ensure!(kosul, "...")` = koşul yanlışsa `bail!`.

```rust
use anyhow::{Context, Result, bail, ensure};

fn port_oku(satir: &str) -> Result<u16> {
    let (anahtar, deger) = satir
        .split_once('=')
        .with_context(|| format!("'=' bulunamadı: {satir:?}"))?; // Option → Result
    if anahtar.trim() != "port" {
        bail!("beklenmeyen anahtar: {}", anahtar.trim());
    }
    let port: u16 = deger
        .trim()
        .parse()
        .with_context(|| format!("port değeri okunamadı: {:?}", deger.trim()))?;
    ensure!(port >= 1024, "port {port} ayrıcalıklı, 1024 veya üstü olmalı");
    Ok(port)
}

fn main() {
    for satir in ["port = 8080", "port: 80", "host = a", "port = 80", "port = sekiz"] {
        match port_oku(satir) {
            Ok(p) => println!("✓ {p}"),
            Err(e) => println!("✗ {e:#}"),
        }
    }
}
```

`anyhow::Error`'ın üç biçimlendirmesi vardır. Tahmin et:

```predict
code: |
  use anyhow::{Context, Result};

  fn adet(s: &str) -> Result<u32> {
      let n = s.parse::<u32>().context("adet okunamadı")?;
      Ok(n)
  }

  fn main() {
      let e = adet("on").context("sepet güncellenemedi").unwrap_err();
      println!("[{e}]");
      println!("[{e:#}]");
  }
options:
  - |
    [sepet güncellenemedi]
    [sepet güncellenemedi: adet okunamadı: invalid digit found in string]
  - |
    [sepet güncellenemedi: adet okunamadı: invalid digit found in string]
    [sepet güncellenemedi]
  - |
    [invalid digit found in string]
    [adet okunamadı: invalid digit found in string]
answer: 0
explanation: |
  Her `context` çağrısı zincire **dışarıdan** bir katman ekler. `{}` yalnızca en dış mesajı
  yazar; `{:#}` (alternatif biçim) tüm zinciri `: ` ile birleştirir: dıştan içe. Üçüncü biçim
  `{:?}` ise zinciri alt alta, `Caused by:` başlığıyla gösterir. Kullanıcıya tek satırlık
  açıklama için `{:#}`, geliştiriciye ayrıntı için `{:?}` idealdir.
```

`main` fonksiyonu da `anyhow::Result<()>` döndürebilir. Hata olursa anyhow onu `{:?}` biçimiyle
stderr'e yazar ve program 1 çıkış koduyla biter:

```rust,norun
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let icerik = std::fs::read_to_string("ayarlar.toml").context("ayar dosyası okunamadı")?;
    println!("{} bayt okundu", icerik.len());
    Ok(())
}
```

```text
Error: ayar dosyası okunamadı

Caused by:
    No such file or directory (os error 2)
```

Bağlamsız hâli sadece `Error: No such file or directory (os error 2)` derdi: **hangi** dosya,
**ne yaparken**? İyi bağlam mesajı "ne yapmaya çalışıyordum?" sorusunu cevaplar ve ilgili değeri
(dosya adı, satır no, kullanıcı kimliği) içerir. Pahalı bir `format!` içeriyorsa `with_context`
kullan: closure yalnızca hata olduğunda çalışır.

```exercise
id: m25-e-anyhow-ayar
title: anyhow ile bağlamlı ayar okuyucu
difficulty: 3
prompt: |
  Bir uygulamanın `anahtar=değer` satırlarından oluşan ayar metnini okuyorsun. `zaman_asimi_oku`
  fonksiyonu metinde `timeout` anahtarını bulup saniye değerini döndürsün. **anyhow** kullan:

  - Boş satırlar ve `#` ile başlayan satırlar atlanır. Diğer satırlarda `=` yoksa:
    `bail!("satır {no}: '=' eksik")` (`no` 1'den başlayan satır numarası).
  - `timeout` anahtarı bulunursa değeri (kırpılmış) `u32`'ye çevir; çevrilemezse
    `with_context` ile `satır {no}: timeout sayı olmalı` bağlamını ekle.
  - Değer 1..=300 aralığında değilse: `ensure!` ile `timeout 1 ile 300 arasında olmalı, {deger} verildi`.
  - Metinde `timeout` yoksa: `timeout anahtarı bulunamadı` hatası.

  Testler hataları `{:#}` ile biçimlendirip tam metni kontrol ediyor.
starter: |
  use anyhow::{Context, Result, bail, ensure};

  fn zaman_asimi_oku(metin: &str) -> Result<u32> {
      todo!()
  }

  fn main() {
      let ayar = "# sunucu\nhost = localhost\ntimeout = 30\n";
      match zaman_asimi_oku(ayar) {
          Ok(t) => println!("zaman aşımı: {t} sn"),
          Err(e) => println!("hata: {e:#}"),
      }
  }
solution: |
  use anyhow::{Context, Result, bail, ensure};

  fn zaman_asimi_oku(metin: &str) -> Result<u32> {
      for (i, satir) in metin.lines().enumerate() {
          let no = i + 1;
          let satir = satir.trim();
          if satir.is_empty() || satir.starts_with('#') {
              continue;
          }
          let Some((anahtar, deger)) = satir.split_once('=') else {
              bail!("satır {no}: '=' eksik");
          };
          if anahtar.trim() != "timeout" {
              continue;
          }
          let deger: u32 = deger
              .trim()
              .parse()
              .with_context(|| format!("satır {no}: timeout sayı olmalı"))?;
          ensure!((1..=300).contains(&deger), "timeout 1 ile 300 arasında olmalı, {deger} verildi");
          return Ok(deger);
      }
      bail!("timeout anahtarı bulunamadı")
  }

  fn main() {
      let ayar = "# sunucu\nhost = localhost\ntimeout = 30\n";
      match zaman_asimi_oku(ayar) {
          Ok(t) => println!("zaman aşımı: {t} sn"),
          Err(e) => println!("hata: {e:#}"),
      }
  }
check: tests
tests: |
  fn hata(metin: &str) -> String {
      format!("{:#}", zaman_asimi_oku(metin).unwrap_err())
  }

  #[test]
  fn gecerli_deger_okunur() {
      assert_eq!(zaman_asimi_oku("# yorum\n\nhost = a\n timeout = 45 \n").unwrap(), 45);
      assert_eq!(zaman_asimi_oku("timeout=300").unwrap(), 300, "üst sınır dahil");
  }

  #[test]
  fn esittir_eksik_satir_numarasiyla_bildirilir() {
      assert_eq!(hata("host = a\n# yorum\nport 80\ntimeout = 5"), "satır 3: '=' eksik");
  }

  #[test]
  fn sayi_olmayan_deger_baglamla_bildirilir() {
      assert_eq!(
          hata("\ntimeout = otuz"),
          "satır 2: timeout sayı olmalı: invalid digit found in string",
          "with_context bağlamı ve altındaki parse hatası {{:#}} ile birlikte görünmeli"
      );
  }

  #[test]
  fn aralik_disi_ve_eksik_anahtar() {
      assert_eq!(hata("timeout = 0"), "timeout 1 ile 300 arasında olmalı, 0 verildi");
      assert_eq!(hata("timeout = 301"), "timeout 1 ile 300 arasında olmalı, 301 verildi");
      assert_eq!(hata("host = a\n"), "timeout anahtarı bulunamadı");
      assert_eq!(hata(""), "timeout anahtarı bulunamadı");
  }
hints:
  - "`metin.lines().enumerate()` ile dön; satır numarası `i + 1`. Kırpılmış satır boşsa ya da `#` ile başlıyorsa `continue`."
  - "`let Some((anahtar, deger)) = satir.split_once('=') else { bail!(\"satır {no}: '=' eksik\"); };` Anahtar `timeout` değilse `continue`."
  - "`deger.trim().parse::<u32>().with_context(|| format!(\"satır {no}: timeout sayı olmalı\"))?`, ardından `ensure!((1..=300).contains(&deger), \"...\")` ve `return Ok(deger)`. Döngü biterse `bail!(\"timeout anahtarı bulunamadı\")`."
explanation: |
  Fonksiyonun hiçbir yerinde hata **tipi** tasarlamadık: `?`, `bail!` ve `ensure!` hepsini
  `anyhow::Error`'a topladı. Uygulama kodu için bu idealdir; çünkü bu hataları programatik olarak
  ayırt etmeyecek, kullanıcıya göstereceğiz.

  `with_context` ham `ParseIntError`'ı kaybetmedi: `{:#}` çıktısında hem bizim bağlamımız hem de
  altındaki `invalid digit found in string` görünüyor. Bağlamdaki satır numarası, hatayı
  düzeltecek kişinin dosyada doğrudan doğru yere gitmesini sağlar.

  `bail!` bir `return` olduğu için döngüden sonraki `bail!("timeout anahtarı bulunamadı")` fonksiyonun
  son ifadesi olabilir; tipi `!`'dir (Modül 22) ve `Result<u32>` ile uyumludur.
```

## Kütüphane mi, uygulama mı?

İki crate'in ayrımı aslında bir tasarım sorusunun cevabı: **bu hatayı kim, nasıl kullanacak?**

| | Kütüphane (thiserror) | Uygulama (anyhow) |
|---|---|---|
| Hatayı kim tüketir? | başka programcıların kodu | kullanıcı, log dosyası, operatör |
| İhtiyaç | varyantlara göre **ayırt etmek** (`match`) | **bağlam** ekleyip göstermek |
| Hata tipi | kendi `enum`'un, public API'nin parçası | tek tip `anyhow::Error` |
| Yeni hata türü eklemek | yeni varyant (dikkat: breaking change olabilir) | sadece `bail!`/`context` |

Pratik kurallar:

- Kütüphanenin public API'sinde `anyhow::Error` döndürme: kullanıcıların hatayı `match` ile
  inceleyemez, sen de onları anyhow'a bağımlı kılarsın.
- Büyüyecek hata enum'larına `#[non_exhaustive]` koymayı düşün: kullanıcıları `_ =>` kolu yazmaya
  zorlar, böylece yeni bir varyant eklemen onların kodunu kırmaz.
- Bir uygulama da içeride thiserror kullanabilir: örneğin HTTP katmanında "404 mü 500 mü" kararı
  için ayırt edilmesi gereken hatalar. Kural "kütüphane = thiserror" değil, "**ayırt edilecekse**
  tipli hata".
- anyhow'da da gerekirse ayırt edebilirsin: `hata.downcast_ref::<SiparisHatasi>()` zincirdeki
  hatayı tipine göre arar ve `Option<&T>` döndürür.

```quiz
question: |
  Ekibin bir `odeme-istemcisi` **kütüphanesi** yazıyor. Kullanıcıların "kart reddedildi" ve
  "bağlantı zaman aşımı" durumlarına **farklı** tepki vermesi (birinde kullanıcıya mesaj,
  diğerinde yeniden deneme) gerekiyor. Hangi hata tasarımı en uygun?
options:
  - "Public fonksiyonlar `anyhow::Result<T>` döndürsün; kullanıcılar mesaj metnine bakarak ayırt etsin"
  - "thiserror ile `OdemeHatasi { KartReddedildi { .. }, ZamanAsimi, .. }` gibi bir enum; public fonksiyonlar `Result<T, OdemeHatasi>` döndürsün"
  - "Her hatada `panic!`; kullanıcılar `catch_unwind` ile yakalasın"
answer: 1
explanation: |
  Kullanıcıların hatayı **ayırt etmesi** gerekiyor, bu da tipli bir hata enum'u demek. `match` ile
  `OdemeHatasi::ZamanAsimi => yeniden_dene()` yazabilirler; derleyici de tüm durumları ele aldıklarını
  kontrol eder. Mesaj metnine göre ayırt etmek kırılgandır: bir yazım düzeltmesi kullanıcıların
  kodunu bozar. `panic!` ise beklenen hatalar için değil, hatalar (bug) için vardır (Modül 10).
feedback:
  - Kütüphane API'sinde anyhow, ayırt etmeyi `downcast` ya da metin karşılaştırmasına iter; ikisi de kırılgandır.
  - Doğru! Ayırt edilmesi gereken hatalar tipli olmalı.
  - Kart reddi beklenen bir durumdur; panik bunun için uygun değildir.
```

## Özet

:::remember
- **thiserror** (kütüphaneler): `#[derive(Error)]` + `#[error("... {alan} ...")]` ile `Display`; `#[from]` ile `From` + `source`; `#[source]` yalnızca kaynak; `#[error(transparent)]` devretme. Public API'de iz bırakmaz.
- Kaynağı **ya** mesaja koy **ya** `source()`'tan döndür; ikisini birden asla.
- Zinciri `while let Some(h) = sonraki { ...; sonraki = h.source(); }` ile dolaş.
- **anyhow** (uygulamalar): `anyhow::Result<T>`, her hatayı `?` ile kabul eder; `.context()` / `.with_context(|| ..)` bağlam ekler; `bail!`, `ensure!`, `anyhow!`.
- Biçimler: `{}` en dış mesaj, `{:#}` tüm zincir tek satır, `{:?}` `Caused by:` listesi.
- Karar sorusu: hatayı birisi **ayırt edecek** mi? Evet → tipli enum (thiserror). Hayır, sadece gösterilecek → anyhow.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — neden "kütüphaneler tipli hata döndürür, uygulamalar bağlam ekler"
  deniyor? Bir kütüphanenin `anyhow::Error` döndürmesi kullanıcılarına neye mal olur?
answer: |
  Model cevap: Kütüphanenin kullanıcısı başka bir programcıdır ve hatalara programatik olarak tepki
  vermek ister (yeniden dene, kullanıcıya mesaj göster, varsayılana dön). Bunun için hatanın türünü
  `match` ile ayırt edebilmeli ve derleyici tüm durumları ele aldığını kontrol edebilmelidir; bu da
  tipli bir enum gerektirir. Uygulama ise hatanın son tüketicisidir: genelde sadece "ne olurken ne
  ters gitti"yi kullanıcıya ya da loga yazar, o yüzden zengin bağlam önemlidir, tip değil. Kütüphane
  `anyhow::Error` döndürürse kullanıcı ya `downcast_ref` ile tahmin yürütmek ya da mesaj metnini
  karşılaştırmak zorunda kalır (kırılgan) ve kütüphanenin iç detayları değiştikçe kodu sessizce bozulur.
```

```flashcards
- front: "thiserror'da `#[from]` hangi iki şeyi üretir?"
  back: "`impl From<Kaynak> for Hata` (`?` dönüşümü için) ve o alanı `source()` olarak döndürme."
- front: "`#[error(transparent)]` ne işe yarar?"
  back: "`Display` ve `source`'u olduğu gibi içteki hataya devreder; sarmalayıcı varyantlar için."
- front: Bir hatanın kaynağıyla ilgili altın kural nedir?
  back: Kaynak hatayı ya kendi `Display` mesajına koy ya da `source()` ile döndür; ikisini birden asla (aksi hâlde mesaj tekrarlanır).
- front: "`anyhow::Error` için `{}`, `{:#}` ve `{:?}` neyi yazdırır?"
  back: "`{}`: en dış mesaj. `{:#}`: tüm zincir `: ` ile tek satırda. `{:?}`: mesaj + `Caused by:` altında zincir."
- front: "`context` yerine ne zaman `with_context` kullanılır?"
  back: "Mesaj `format!` gibi maliyetli bir işle üretiliyorsa; closure yalnızca hata olduğunda çalışır."
- front: "`ensure!(kosul, \"mesaj\")` neye eşdeğerdir?"
  back: "`if !kosul { bail!(\"mesaj\") }`, yani `return Err(anyhow!(\"mesaj\"))`."
- front: Kütüphanenin public API'si neden `anyhow::Error` döndürmemeli?
  back: Kullanıcılar hataları `match` ile ayırt edemez, anyhow'a bağımlı olur; metin/downcast ile ayırt etmek kırılgandır.
- front: "`anyhow::Error` içinden belirli bir hata tipine nasıl ulaşılır?"
  back: "`hata.downcast_ref::<Tip>()` → `Option<&Tip>` (bağlam katmanlarının altındaki hataları da bulur)."
```
