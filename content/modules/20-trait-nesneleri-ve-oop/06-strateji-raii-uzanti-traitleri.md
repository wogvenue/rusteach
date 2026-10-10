---
id: m20-l06
title: Strateji, RAII koruyucuları ve uzantı trait'leri
minutes: 26
type: lesson
objectives:
  - Strateji desenini generic, trait nesnesi ve closure biçimleriyle uygulayıp duruma göre birini seçebilmek
  - "`Drop` ile bir RAII koruyucusu (guard) yazabilmek ve `let _ =` ile `let _g =` arasındaki farkı açıklayabilmek"
  - Yabancı bir tipe uzantı trait'iyle (extension trait) metot ekleyebilmek ve trait'in kapsamda olması gerektiğini (E0599) bilmek
  - Klasik GoF desenlerinin Rust'taki karşılıklarını (dil özelliği, std tipi ya da gereksiz) söyleyebilmek
keywords: [strateji deseni, strategy, RAII, guard, koruyucu, Drop, uzantı trait, extension trait, GoF, E0599, E0502]
---

1994'te yayımlanan *Design Patterns* (“Dörtlü Çete”, Gang of Four, kısaca **GoF**) kitabı 23 tasarım deseni
tanımlar ve Java/C++ dünyasında hâlâ mülakatların gözdesidir. Peter Norvig daha 1996'da bu desenlerin çoğunun
güçlü dil özellikleri olan dillerde **görünmez hâle geldiğini** göstermişti. Rust tam böyle bir dil:
closure'lar, trait'ler, enum'lar ve `Drop` birçok deseni birkaç satıra indirir.

Bu derste Rust'ta gerçekten iş gören dört fikri öğreneceksin: **strateji** (davranışı değiştirilebilir parça
yapmak), **RAII koruyucuları** (temizliği unutulamaz kılmak), **uzantı trait'leri** (başkasının tipine metot
eklemek) ve son olarak GoF kataloğunun Rust'taki kısa bir haritası.

:::ferris
Desen ezberlemek yerine “Bu sorunu hangi dil özelliği zaten çözüyor?” diye sormayı alışkanlık hâline getir.
Rust'ta cevap çoğu zaman bir trait, bir closure ya da bir enum çıkar! 🦀
:::

## Strateji deseni: değiştirilebilir algoritma

Bir okulda dönem sonu notu farklı derslerde farklı hesaplanıyor: kimi derste düz ortalama, kimisinde **en
düşük not atılarak** ortalama, kimisinde ağırlıklı ortalama. Hesaplamayı yapan kodu her ders için kopyalamak
yerine **hesaplama yöntemini dışarıdan verilebilen bir parça** yaparsın. Bu, **strateji (strategy)** desenidir:
bir algoritma ailesini ortak bir arayüzün arkasına koy, kullanan kod hangisinin seçildiğini bilmesin.

Rust'ta en doğal biçimi bir trait'tir:

```rust
trait NotStratejisi {
    fn ad(&self) -> String;
    fn hesapla(&self, notlar: &[u32]) -> f64;
}

struct Ortalama;

struct EnDusukAtilir;

struct Agirlikli {
    agirliklar: Vec<u32>,
}

impl NotStratejisi for Ortalama {
    fn ad(&self) -> String {
        String::from("düz ortalama")
    }
    fn hesapla(&self, notlar: &[u32]) -> f64 {
        let toplam: u32 = notlar.iter().sum();
        toplam as f64 / notlar.len() as f64
    }
}

impl NotStratejisi for EnDusukAtilir {
    fn ad(&self) -> String {
        String::from("en düşük atılır")
    }
    fn hesapla(&self, notlar: &[u32]) -> f64 {
        let toplam: u32 = notlar.iter().sum();
        let en_dusuk = notlar.iter().copied().min().unwrap_or(0);
        (toplam - en_dusuk) as f64 / (notlar.len() - 1) as f64
    }
}

impl NotStratejisi for Agirlikli {
    fn ad(&self) -> String {
        format!("ağırlıklı {:?}", self.agirliklar)
    }
    fn hesapla(&self, notlar: &[u32]) -> f64 {
        let mut toplam = 0;
        for (n, a) in notlar.iter().zip(&self.agirliklar) {
            toplam += n * a;
        }
        let agirlik_toplami: u32 = self.agirliklar.iter().sum();
        toplam as f64 / agirlik_toplami as f64
    }
}

// Strateji çalışma zamanında, örneğin bir yapılandırma metninden seçiliyor:
fn strateji_sec(ayar: &str) -> Box<dyn NotStratejisi> {
    match ayar {
        "en-dusuk-atilir" => Box::new(EnDusukAtilir),
        "agirlikli" => Box::new(Agirlikli { agirliklar: vec![30, 30, 40] }),
        _ => Box::new(Ortalama),
    }
}

fn main() {
    let notlar = [55, 80, 95];
    for ayar in ["ortalama", "en-dusuk-atilir", "agirlikli"] {
        let s = strateji_sec(ayar);
        println!("{:<26} → {:.1}", s.ad(), s.hesapla(&notlar));
    }
}
```

Hangi stratejinin kullanılacağı **çalışma zamanında**, bir metinden belirleniyor. Bu yüzden `Box<dyn
NotStratejisi>` (2. ders) doğal seçim. Strateji derleme zamanında belliyse ise **generic** biçimi tercih edersin;
geçen dersten hatırla, statik dispatch sıfır maliyetlidir:

```rust,ignore
struct Ders<S: NotStratejisi> {
    ad: String,
    strateji: S, // her Ders<Ortalama>, Ders<EnDusukAtilir> ayrı bir tip; çağrılar satır içine alınabilir
}
```

Standart kütüphane bu biçimi kullanır: `HashMap<K, V, S = RandomState>` tipindeki üçüncü parametre **hash
stratejisidir**. Varsayılan, DoS saldırılarına dayanıklı SipHash'tir (Modül 9); hıza ihtiyacın varsa başka bir
`BuildHasher` takarsın.

:::analogy Navigasyon uygulaması
Telefonundaki harita uygulamasına “Kadıköy'e git” dersin, sonra **nasıl** gideceğini seçersin: araba, yürüyüş,
toplu taşıma. Uygulamanın geri kalanı (harita, varış saati gösterimi, sesli yönlendirme) hiç değişmez; değişen
yalnızca rotayı hesaplayan **strateji**dir. Yeni bir ulaşım türü (bisiklet) eklemek için uygulamayı baştan
yazmazsın, yeni bir strateji takarsın.
:::

Üçüncü ve çoğu zaman en kısa biçim: **closure'lar**. Tek bir metodu olan bir strateji trait'i aslında bir
fonksiyondan ibarettir; Rust'ta fonksiyonlar birinci sınıf değerdir (Modül 14). Aslında strateji desenini
farkında olmadan Modül 9'dan beri kullanıyorsun: `ogrenciler.sort_by_key(|o| o.yas)` çağrısında closure,
sıralamanın **karşılaştırma stratejisidir**. Tahmin et:

```predict
code: |
  fn main() {
      let notlar = [40, 90, 70, 100];
      let stratejiler: Vec<(&str, Box<dyn Fn(&[u32]) -> u32>)> = vec![
          ("ortalama", Box::new(|n: &[u32]| n.iter().sum::<u32>() / n.len() as u32)),
          ("en-iyi", Box::new(|n: &[u32]| n.iter().copied().max().unwrap_or(0))),
          (
              "en-dusuk-atilir",
              Box::new(|n: &[u32]| {
                  let en_dusuk = n.iter().copied().min().unwrap_or(0);
                  (n.iter().sum::<u32>() - en_dusuk) / (n.len() as u32 - 1)
              }),
          ),
      ];
      for (ad, strateji) in &stratejiler {
          println!("{ad}: {}", strateji(&notlar));
      }
  }
options:
  - |
    ortalama: 75
    en-iyi: 100
    en-dusuk-atilir: 86
  - |
    ortalama: 75
    en-iyi: 100
    en-dusuk-atilir: 87
  - |
    ortalama: 75
    en-iyi: 100
    en-dusuk-atilir: 260
  - Derlenmez; farklı closure'lar aynı `Vec`'e konamaz
answer: 0
explanation: |
  Her closure'ın tipi benzersizdir, bu yüzden onları aynı `Vec`'e **doğrudan** koyamazsın. Ama hepsi
  `Box<dyn Fn(&[u32]) -> u32>`'ye dönüştürüldüğü için tek bir trait nesnesi tipinde buluşurlar (2. ders), yani
  program derlenir. Sonuçlar: ortalama 300 / 4 = 75, en iyi 100. Üçüncüde en düşük not (40) atılır:
  260 / 3 = 86,67. Ama bu **tamsayı bölmesi**dir (Modül 2): sonuç aşağı kırpılır, 86 olur.
```

Hangisini ne zaman seçmeli?

| Biçim | Ne zaman? | Maliyet |
|---|---|---|
| Generic `S: Strateji` | Strateji derleme zamanında belli, performans önemli | Sıfır; tip başına kod kopyası |
| `Box<dyn Strateji>` | Çalışma zamanında seçiliyor ya da değişiyor; stratejilerin durumu veya birden çok metodu var | Heap + vtable |
| Closure (`impl Fn` / `Box<dyn Fn>`) | Tek bir işlemden ibaret, küçük, yerinde yazılabilir | `impl Fn` sıfır; `Box<dyn Fn>` heap + vtable |

```quiz
question: |
  Bir e-ticaret sitesinde kargo ücreti hesaplama yöntemi (sabit ücret, ağırlığa göre, bölgeye göre) **yönetici
  panelinden** her an değiştirilebiliyor. Ayrıca her yöntemin kendi ayarları (bölge tablosu, kilo başı ücret) ve
  `ad()`, `hesapla()`, `aciklama()` gibi birden çok metodu var. Hangi biçim en uygun?
options:
  - "Generic: `struct Sepet<K: KargoStratejisi>`"
  - "Trait nesnesi: `struct Sepet { kargo: Box<dyn KargoStratejisi> }`"
  - "Tek bir closure: `Box<dyn Fn(u32) -> u32>`"
  - "Her yöntem için ayrı bir `Sepet` struct'ı"
answer: 1
explanation: |
  Seçim **çalışma zamanında** değişiyor (generic olamaz: `Sepet<SabitUcret>` ile `Sepet<BolgeyeGore>` farklı
  tiplerdir, çalışırken birinden ötekine geçemezsin). Stratejilerin hem durumu hem birden çok metodu var. Bu da
  tek bir closure'ı yetersiz bırakır. `Box<dyn KargoStratejisi>` alanı çalışırken yenisiyle değiştirilebilir.
feedback:
  - "Generic tip parametresi derleme zamanında sabitlenir; panelden değiştirilen bir ayar için uygun değil."
  - Doğru!
  - "Tek bir hesaplama fonksiyonu için harika olurdu, ama `ad()` ve `aciklama()` gibi metotları ve ayarları tek bir closure'a sığdırmak zorlaşır."
  - Kod tekrarı; desenin çözmeye çalıştığı sorunun ta kendisi.
```

## Alıştırma: en iyi indirim stratejisi

Şimdi strateji desenini trait nesneleriyle sen uygula. Bir market, sepet tutarına birden çok kampanyadan
**müşteri için en iyisini** otomatik uygulamak istiyor.

```exercise
id: m20-l06-e-indirim
title: Kampanya motoru
difficulty: 3
prompt: |
  `Indirim` trait'ini üç kampanya tipi için uygula ve `en_iyi_teklif` fonksiyonunu yaz. Tutarlar tam sayı TL.

  - `YuzdeIndirim(p)`: tutarın yüzde `p`'si düşülür (tamsayı bölmesi: `tutar * p / 100` kadar indirim).
    `p` 100'den büyükse 100 sayılır. Adı: `"%{p} indirim"` (örn. `"%10 indirim"`).
  - `SabitIndirim(m)`: `m` TL düşülür; sonuç 0'ın altına inmez. Adı: `"{m} TL indirim"`.
  - `EsikIndirimi { esik, indirim }`: tutar **en az** `esik` ise `indirim` TL düşülür (0'ın altına inmeden),
    değilse tutar aynen kalır. Adı: `"{esik} TL üzerine {indirim} TL"`.
  - `en_iyi_teklif(tutar, secenekler)`: en düşük ödenecek tutarı veren kampanyanın **adını ve sonucu**
    döndürür. Eşitlikte listede **önce gelen** seçilir. Liste boşsa `None`.
starter: |
  pub trait Indirim {
      fn ad(&self) -> String;
      fn uygula(&self, tutar: u32) -> u32;
  }

  pub struct YuzdeIndirim(pub u32);

  pub struct SabitIndirim(pub u32);

  pub struct EsikIndirimi {
      pub esik: u32,
      pub indirim: u32,
  }

  impl Indirim for YuzdeIndirim {
      fn ad(&self) -> String {
          todo!()
      }
      fn uygula(&self, tutar: u32) -> u32 {
          todo!()
      }
  }

  impl Indirim for SabitIndirim {
      fn ad(&self) -> String {
          todo!()
      }
      fn uygula(&self, tutar: u32) -> u32 {
          todo!()
      }
  }

  impl Indirim for EsikIndirimi {
      fn ad(&self) -> String {
          todo!()
      }
      fn uygula(&self, tutar: u32) -> u32 {
          todo!()
      }
  }

  pub fn en_iyi_teklif(tutar: u32, secenekler: &[Box<dyn Indirim>]) -> Option<(String, u32)> {
      todo!()
  }

  fn main() {
      let kampanyalar: Vec<Box<dyn Indirim>> = vec![
          Box::new(YuzdeIndirim(10)),
          Box::new(SabitIndirim(50)),
          Box::new(EsikIndirimi { esik: 400, indirim: 75 }),
      ];
      for sepet in [120, 450, 900] {
          if let Some((ad, sonuc)) = en_iyi_teklif(sepet, &kampanyalar) {
              println!("{sepet} TL → {sonuc} TL ({ad})");
          }
      }
  }
solution: |
  pub trait Indirim {
      fn ad(&self) -> String;
      fn uygula(&self, tutar: u32) -> u32;
  }

  pub struct YuzdeIndirim(pub u32);

  pub struct SabitIndirim(pub u32);

  pub struct EsikIndirimi {
      pub esik: u32,
      pub indirim: u32,
  }

  impl Indirim for YuzdeIndirim {
      fn ad(&self) -> String {
          format!("%{} indirim", self.0)
      }
      fn uygula(&self, tutar: u32) -> u32 {
          let yuzde = self.0.min(100);
          tutar - tutar * yuzde / 100
      }
  }

  impl Indirim for SabitIndirim {
      fn ad(&self) -> String {
          format!("{} TL indirim", self.0)
      }
      fn uygula(&self, tutar: u32) -> u32 {
          tutar.saturating_sub(self.0)
      }
  }

  impl Indirim for EsikIndirimi {
      fn ad(&self) -> String {
          format!("{} TL üzerine {} TL", self.esik, self.indirim)
      }
      fn uygula(&self, tutar: u32) -> u32 {
          if tutar >= self.esik {
              tutar.saturating_sub(self.indirim)
          } else {
              tutar
          }
      }
  }

  pub fn en_iyi_teklif(tutar: u32, secenekler: &[Box<dyn Indirim>]) -> Option<(String, u32)> {
      let mut en_iyi: Option<(String, u32)> = None;
      for secenek in secenekler {
          let sonuc = secenek.uygula(tutar);
          let daha_iyi = match &en_iyi {
              None => true,
              Some((_, mevcut)) => sonuc < *mevcut,
          };
          if daha_iyi {
              en_iyi = Some((secenek.ad(), sonuc));
          }
      }
      en_iyi
  }

  fn main() {
      let kampanyalar: Vec<Box<dyn Indirim>> = vec![
          Box::new(YuzdeIndirim(10)),
          Box::new(SabitIndirim(50)),
          Box::new(EsikIndirimi { esik: 400, indirim: 75 }),
      ];
      for sepet in [120, 450, 900] {
          if let Some((ad, sonuc)) = en_iyi_teklif(sepet, &kampanyalar) {
              println!("{sepet} TL → {sonuc} TL ({ad})");
          }
      }
  }
check: tests
tests: |
  #[test]
  fn yuzde_indirimi() {
      assert_eq!(YuzdeIndirim(10).uygula(200), 180, "200 TL'nin %10'u 20 TL");
      assert_eq!(YuzdeIndirim(50).uygula(99), 50, "99 * 50 / 100 = 49 TL indirim (tamsayı bölmesi)");
      assert_eq!(YuzdeIndirim(150).uygula(80), 0, "%100'den fazla indirim %100 sayılmalı");
      assert_eq!(YuzdeIndirim(25).ad(), "%25 indirim");
  }

  #[test]
  fn sabit_ve_esik_indirimi() {
      assert_eq!(SabitIndirim(50).uygula(30), 0, "Tutar sıfırın altına inmemeli");
      assert_eq!(SabitIndirim(50).ad(), "50 TL indirim");
      let esik = EsikIndirimi { esik: 500, indirim: 100 };
      assert_eq!(esik.uygula(499), 499, "Eşiğin altında indirim yok");
      assert_eq!(esik.uygula(500), 400, "Tam eşikte indirim uygulanmalı");
      assert_eq!(esik.ad(), "500 TL üzerine 100 TL");
  }

  #[test]
  fn en_iyi_secilir() {
      let k: Vec<Box<dyn Indirim>> = vec![
          Box::new(YuzdeIndirim(10)),
          Box::new(SabitIndirim(50)),
          Box::new(EsikIndirimi { esik: 400, indirim: 75 }),
      ];
      assert_eq!(en_iyi_teklif(120, &k), Some((String::from("50 TL indirim"), 70)));
      assert_eq!(en_iyi_teklif(450, &k), Some((String::from("400 TL üzerine 75 TL"), 375)));
      assert_eq!(en_iyi_teklif(900, &k), Some((String::from("%10 indirim"), 810)));
  }

  #[test]
  fn esitlikte_ilk_ve_bos_liste() {
      let k: Vec<Box<dyn Indirim>> = vec![Box::new(SabitIndirim(20)), Box::new(YuzdeIndirim(10))];
      assert_eq!(
          en_iyi_teklif(200, &k),
          Some((String::from("20 TL indirim"), 180)),
          "İkisi de 180 veriyor; listede önce gelen seçilmeli"
      );
      assert_eq!(en_iyi_teklif(200, &[]), None, "Kampanya yoksa None dönmeli");
  }
hints:
  - "`SabitIndirim` için `tutar.saturating_sub(self.0)` (Modül 2) sıfırın altına inmeyi kendiliğinden önler. Yüzdede önce `let p = self.0.min(100);`, sonra `tutar - tutar * p / 100`."
  - "`en_iyi_teklif`'te `let mut en_iyi: Option<(String, u32)> = None;` ile başla ve `for secenek in secenekler` ile dolaş; `secenek.uygula(tutar)` çağrısı dinamik dispatch'tir."
  - "Yeni sonuç ancak **kesinlikle küçükse** (`<`) eskisinin yerine geçsin; böylece eşitlikte ilk gelen kalır: `let daha_iyi = match &en_iyi { None => true, Some((_, mevcut)) => sonuc < *mevcut };`"
explanation: |
  `en_iyi_teklif` hangi kampanya tiplerinin var olduğunu **bilmiyor**; yalnızca `Indirim` sözleşmesini
  biliyor. Yarın “2 al 1 öde” kampanyası eklemek için yeni bir struct ve bir `impl` yazman yeterli, bu
  fonksiyon değişmez. Stratejiler çalışma zamanında bir listeden geldiği için `Box<dyn Indirim>` doğru seçim.

  Eşitlikte ilk geleni korumak için `<=` değil `<` kullandık. Bu tür “sınır” kararları testlerle sabitlemek
  iyi bir alışkanlıktır (Modül 13). Iterator'larla (Modül 14) daha kısa bir sürüm de yazılabilir:
  `secenekler.iter().map(|s| (s.ad(), s.uygula(tutar))).min_by_key(|(_, t)| *t)`. `min_by_key` eşitlikte
  **ilk** elemanı döndürür, dolayısıyla aynı davranışı verir. Yalnız her seçenek için `ad()` `String`'i
  oluşturur; döngü sürümü yalnızca kazananlar için oluşturur.

  Yüzde hesabında önce çarpıp sonra bölmek önemli: `tutar / 100 * p` yazsaydın 99 TL için 0 * 50 = 0 TL
  indirim çıkardı. Gerçek para hesaplarında ise kuruşları tamsayı olarak (ör. `u64` kuruş) tutmak ve yuvarlama
  kuralını açıkça belirlemek gerekir; `f64` ile para hesabı yapmak (0,1 + 0,2 sorunu, Modül 2) yaygın bir hatadır.
```

## RAII koruyucuları: temizliği unutulamaz kılmak

Modül 4'te **RAII** fikrini, Modül 17'de `Drop`'u, Modül 18'de `MutexGuard`'ı gördün. Şimdi bunları bir
**desen** olarak adlandıralım: **koruyucu (guard)**, varlığı bir durumun sürdüğünü gösteren bir değerdir.
Oluşturulduğunda bir şeyi **başlatır** (kilidi al, girintiyi artır, işlemi aç), drop edildiğinde **geri alır**.
Geri alma kodu `Drop`'ta olduğu için onu çağırmayı **unutamazsın**: normal çıkışta, erken `return`'de, `?` ile
hata yayılırken, hatta bir panik sırasında yığın çözülürken (unwinding, Modül 10) bile çalışır.

Diğer dillerde aynı iş için ayrı bir sözdizimi gerekir: C'de `goto temizlik`, Java'da `try/finally`, Python'da
`with`, Go'da `defer`. Rust'ta ise sıradan bir değişkenin kapsamı yeterli.

Örnek: iç içe işlemleri girintili yazdıran bir günlük (log). Her “bölüm” bir koruyucudur:

```rust
use std::cell::Cell;

struct Gunluk {
    girinti: Cell<usize>,
}

impl Gunluk {
    fn yaz(&self, mesaj: &str) {
        println!("{}{mesaj}", "  ".repeat(self.girinti.get()));
    }

    fn bolum(&self, ad: &str) -> Bolum<'_> {
        self.yaz(&format!("▶ {ad}"));
        self.girinti.set(self.girinti.get() + 1);
        Bolum { gunluk: self, ad: ad.to_string() }
    }
}

struct Bolum<'a> {
    gunluk: &'a Gunluk,
    ad: String,
}

impl Drop for Bolum<'_> {
    fn drop(&mut self) {
        self.gunluk.girinti.set(self.gunluk.girinti.get() - 1);
        self.gunluk.yaz(&format!("◀ {}", self.ad));
    }
}

fn siparis_isle(g: &Gunluk, stok_var: bool) -> Result<(), String> {
    let _siparis = g.bolum("sipariş");
    g.yaz("ödeme alındı");
    {
        let _kargo = g.bolum("kargo");
        if !stok_var {
            return Err(String::from("stok yok")); // erken dönüş: iki koruyucu da drop edilir
        }
        g.yaz("kargoya verildi");
    } // _kargo burada drop edilir
    g.yaz("tamamlandı");
    Ok(())
}

fn main() {
    let g = Gunluk { girinti: Cell::new(0) };
    let _ = siparis_isle(&g, true);
    if let Err(e) = siparis_isle(&g, false) {
        g.yaz(&format!("hata: {e}")); // girinti yine 0: koruyucular kendini geri aldı
    }
}
```

İkinci çağrıda `return Err(..)` iki bölümün ortasından çıkıyor; yine de çıktıda her `▶`'nin bir `◀`'si var ve
girinti sıfıra dönüyor. Geri alma kodunu her çıkış yoluna elle yazmadık. (`Cell`, Modül 17'deki iç değişkenlik:
koruyucu günlüğü yalnızca `&` ile tuttuğu hâlde girintiyi değiştirebiliyor.)

:::analogy Otel kartı
Otel odasına girince kartı kapının yanındaki yuvaya takarsın; ışıklar ve klima açılır. Çıkarken kartı
alırsın; ne olursa olsun, ister acele et ister yangın alarmıyla koş, oda kendini kapatır. Işıkları
kapatmayı **hatırlaman** gerekmez, çünkü kapanma kartın yuvadan çıkmasına bağlı. Koruyucu da kart gibidir: durum,
değer yaşadığı sürece açıktır.
:::

Şimdi meşhur bir tuzak. Aynı `Gunluk` ile tahmin et:

```predict
code: |
  # use std::cell::Cell;
  # struct Gunluk {
  #     girinti: Cell<usize>,
  # }
  # impl Gunluk {
  #     fn yaz(&self, mesaj: &str) {
  #         println!("{}{mesaj}", "  ".repeat(self.girinti.get()));
  #     }
  #     fn bolum(&self, ad: &str) -> Bolum<'_> {
  #         self.yaz(&format!("▶ {ad}"));
  #         self.girinti.set(self.girinti.get() + 1);
  #         Bolum { gunluk: self, ad: ad.to_string() }
  #     }
  # }
  # struct Bolum<'a> {
  #     gunluk: &'a Gunluk,
  #     ad: String,
  # }
  # impl Drop for Bolum<'_> {
  #     fn drop(&mut self) {
  #         self.gunluk.girinti.set(self.gunluk.girinti.get() - 1);
  #         self.gunluk.yaz(&format!("◀ {}", self.ad));
  #     }
  # }
  // Gunluk ve Bolum yukarıdaki gibi
  fn main() {
      let g = Gunluk { girinti: Cell::new(0) };
      let _ = g.bolum("A");
      g.yaz("a1");
      let _b = g.bolum("B");
      g.yaz("b1");
  }
options:
  - |
    ▶ A
    ◀ A
    a1
    ▶ B
      b1
    ◀ B
  - |
    ▶ A
      a1
      ▶ B
        b1
      ◀ B
    ◀ A
  - |
    ▶ A
      a1
      ▶ B
        b1
answer: 0
explanation: |
  `_` bir değişken **değildir**; “bu değeri hiçbir yere bağlama” demektir. Bağlanmayan geçici değer ifadenin
  sonunda, yani **hemen** drop edilir: `▶ A`'nın hemen ardından `◀ A` gelir ve `a1` girintisiz yazılır. `_b`
  ise alt çizgiyle başlasa da gerçek bir değişkendir (alt çizgi sadece “kullanılmıyor” uyarısını susturur) ve
  kapsamın sonuna kadar yaşar. Bu fark gerçek hayatta tehlikelidir: `let _ = kilit.lock().unwrap();` kilidi
  aldığı satırda bırakır ve korumak istediğin kod korumasız çalışır.
```

Koruyucu değiştirilebilir bir referans tutuyorsa borrow checker sana bedava bir güvence daha verir: koruyucu
yaşadığı sürece asıl nesneye **başka kimse dokunamaz**. Bir banka hesabında “işlem” koruyucusu düşün:

```compiles
code: |
  struct Hesap {
      bakiye: i64,
  }

  struct Islem<'a> {
      hesap: &'a mut Hesap,
      yedek: i64,
      onaylandi: bool,
  }

  impl Hesap {
      fn islem_baslat(&mut self) -> Islem<'_> {
          let yedek = self.bakiye;
          Islem { hesap: self, yedek, onaylandi: false }
      }
  }

  impl Islem<'_> {
      fn yatir(&mut self, miktar: i64) {
          self.hesap.bakiye += miktar;
      }
      fn onayla(mut self) {
          self.onaylandi = true;
      }
  }

  impl Drop for Islem<'_> {
      fn drop(&mut self) {
          if !self.onaylandi {
              self.hesap.bakiye = self.yedek;
          }
      }
  }

  fn main() {
      let mut hesap = Hesap { bakiye: 100 };
      let mut islem = hesap.islem_baslat();
      islem.yatir(50);
      println!("Ara bakiye: {}", hesap.bakiye);
      islem.onayla();
  }
answer: false
error: E0502
explanation: |
  `islem`, `hesap`'ı `&mut` ile ödünç almış durumda ve `islem.onayla()` satırına kadar yaşıyor. Arada
  `hesap.bakiye`'yi okumak, aynı anda hem `&mut` hem `&` ödünç alma demek: Modül 5'teki kural (aliasing XOR
  mutation), E0502. Bu bir engel değil, bir **özellik**: işlem sürerken kimse yarım kalmış bakiyeyi göremez ya
  da değiştiremez. Bir veritabanı işleminin (transaction) yalıtımını derleme zamanında elde ettin.
```

:::error
```text
error[E0502]: cannot borrow `hesap.bakiye` as immutable because it is also borrowed as mutable
  --> src/main.rs:39:32
   |
37 |     let mut islem = hesap.islem_baslat();
   |                     ----- mutable borrow occurs here
38 |     islem.yatir(50);
39 |     println!("Ara bakiye: {}", hesap.bakiye);
   |                                ^^^^^^^^^^^^ immutable borrow occurs here
40 |     islem.onayla();
   |     ----- mutable borrow later used here
```
Hikâyeyi etiketler anlatıyor: 37. satırda koruyucu `hesap`'ı değiştirilebilir olarak ödünç aldı, 40. satırda hâlâ
kullanılıyor; arada 39. satır okumaya çalışıyor. Ara bakiyeyi görmek istiyorsan koruyucuya bir `bakiye()`
metodu ekle; `MutexGuard`'ın `Deref` ile içeriye erişim vermesi de aynı fikirdir.
:::

:::deep Drop'un çalışacağı garanti mi?
Neredeyse her zaman, ama **kesin değil**. `std::mem::forget(koruyucu)` güvenli (safe) bir fonksiyondur ve
`drop`'u hiç çağırmadan değeri unutturur. `Rc` döngüleri (Modül 17) sızıntı yapar, `std::process::exit` ve
`panic = "abort"` ayarı yığını çözmeden süreci bitirir. Rust'ın tasarım kararı şudur: sızıntı (leak) **bellek
güvenliği ihlali sayılmaz**. Bu yüzden koruyucuların `Drop`'u temizlik ve doğruluk için harika bir araçtır, ama
`unsafe` kodda **bellek güvenliği** Drop'un çalışmasına asla bağlanmamalıdır. Bu ilkeye Modül 24'te döneceğiz.
:::

## Alıştırma: geri alınabilen banka işlemi

Az önceki `Islem` koruyucusunu tamamlayalım. Veritabanı kütüphanelerindeki işlem (transaction) nesneleri de
tam böyle çalışır: `commit` edilmeden drop edilirlerse **geri alınırlar** (rollback).

```exercise
id: m20-l06-e-islem
title: Onaylanmazsa geri al
difficulty: 4
prompt: |
  Bir banka hesabı için işlem koruyucusu yaz. `Hesap` bakiyeyi ve hareket listesini tutuyor.

  - `Hesap::islem_baslat(&mut self) -> Islem<'_>`: o anki bakiyeyi ve hareket sayısını **yedekler**.
  - `Islem::yatir(miktar)`: bakiyeyi artırır, hareketlere `"+{miktar}"` ekler.
  - `Islem::cek(miktar) -> Result<(), String>`: bakiye yetmiyorsa `Err("yetersiz bakiye")` döndürür ve **hiçbir
    şeyi değiştirmez**; yetiyorsa bakiyeyi azaltır ve `"-{miktar}"` ekler.
  - `Islem::onayla(self)`: değişiklikleri kalıcı yapar.
  - `Drop`: işlem **onaylanmadan** drop edilirse bakiye ve hareket listesi işlem başındaki hâline döner.
starter: |
  pub struct Hesap {
      bakiye: i64,
      hareketler: Vec<String>,
  }

  impl Hesap {
      pub fn new(bakiye: i64) -> Hesap {
          Hesap { bakiye, hareketler: Vec::new() }
      }

      pub fn bakiye(&self) -> i64 {
          self.bakiye
      }

      pub fn hareketler(&self) -> &[String] {
          &self.hareketler
      }

      pub fn islem_baslat(&mut self) -> Islem<'_> {
          todo!()
      }
  }

  pub struct Islem<'a> {
      hesap: &'a mut Hesap,
      yedek_bakiye: i64,
      yedek_hareket_sayisi: usize,
      onaylandi: bool,
  }

  impl Islem<'_> {
      pub fn yatir(&mut self, miktar: i64) {
          todo!()
      }

      pub fn cek(&mut self, miktar: i64) -> Result<(), String> {
          todo!()
      }

      pub fn onayla(mut self) {
          todo!()
      }
  }

  impl Drop for Islem<'_> {
      fn drop(&mut self) {
          todo!()
      }
  }

  fn main() {
      let mut hesap = Hesap::new(1000);

      let mut islem = hesap.islem_baslat();
      islem.yatir(500);
      islem.cek(200).expect("bakiye yeterli");
      islem.onayla();
      println!("Onaylandı: {} {:?}", hesap.bakiye(), hesap.hareketler());

      {
          let mut islem = hesap.islem_baslat();
          islem.cek(300).expect("bakiye yeterli");
          // onayla() çağrılmadı
      }
      println!("Geri alındı: {} {:?}", hesap.bakiye(), hesap.hareketler());
  }
solution: |
  pub struct Hesap {
      bakiye: i64,
      hareketler: Vec<String>,
  }

  impl Hesap {
      pub fn new(bakiye: i64) -> Hesap {
          Hesap { bakiye, hareketler: Vec::new() }
      }

      pub fn bakiye(&self) -> i64 {
          self.bakiye
      }

      pub fn hareketler(&self) -> &[String] {
          &self.hareketler
      }

      pub fn islem_baslat(&mut self) -> Islem<'_> {
          let yedek_bakiye = self.bakiye;
          let yedek_hareket_sayisi = self.hareketler.len();
          Islem { hesap: self, yedek_bakiye, yedek_hareket_sayisi, onaylandi: false }
      }
  }

  pub struct Islem<'a> {
      hesap: &'a mut Hesap,
      yedek_bakiye: i64,
      yedek_hareket_sayisi: usize,
      onaylandi: bool,
  }

  impl Islem<'_> {
      pub fn yatir(&mut self, miktar: i64) {
          self.hesap.bakiye += miktar;
          self.hesap.hareketler.push(format!("+{miktar}"));
      }

      pub fn cek(&mut self, miktar: i64) -> Result<(), String> {
          if miktar > self.hesap.bakiye {
              return Err(String::from("yetersiz bakiye"));
          }
          self.hesap.bakiye -= miktar;
          self.hesap.hareketler.push(format!("-{miktar}"));
          Ok(())
      }

      pub fn onayla(mut self) {
          self.onaylandi = true;
      } // self burada drop edilir; Drop onaylandığını görür ve hiçbir şeyi geri almaz
  }

  impl Drop for Islem<'_> {
      fn drop(&mut self) {
          if !self.onaylandi {
              self.hesap.bakiye = self.yedek_bakiye;
              self.hesap.hareketler.truncate(self.yedek_hareket_sayisi);
          }
      }
  }

  fn main() {
      let mut hesap = Hesap::new(1000);

      let mut islem = hesap.islem_baslat();
      islem.yatir(500);
      islem.cek(200).expect("bakiye yeterli");
      islem.onayla();
      println!("Onaylandı: {} {:?}", hesap.bakiye(), hesap.hareketler());

      {
          let mut islem = hesap.islem_baslat();
          islem.cek(300).expect("bakiye yeterli");
          // onayla() çağrılmadı
      }
      println!("Geri alındı: {} {:?}", hesap.bakiye(), hesap.hareketler());
  }
check: tests
tests: |
  #[test]
  fn onaylanan_islem_kalici_olur() {
      let mut h = Hesap::new(1000);
      let mut i = h.islem_baslat();
      i.yatir(250);
      i.cek(100).unwrap();
      i.onayla();
      assert_eq!(h.bakiye(), 1150, "Onaylanan işlemin etkisi kalmalı");
      assert_eq!(h.hareketler(), ["+250", "-100"]);
  }

  #[test]
  fn onaylanmayan_islem_geri_alinir() {
      let mut h = Hesap::new(500);
      h.islem_baslat().yatir(40);
      {
          let mut i = h.islem_baslat();
          i.yatir(1000);
          i.cek(300).unwrap();
      }
      assert_eq!(h.bakiye(), 500, "Onaylanmayan işlem bakiyeyi geri almalı");
      assert!(h.hareketler().is_empty(), "Onaylanmayan işlemin hareketleri silinmeli");
  }

  #[test]
  fn yetersiz_bakiye_hicbir_seyi_degistirmez() {
      let mut h = Hesap::new(100);
      let mut i = h.islem_baslat();
      assert_eq!(i.cek(101), Err(String::from("yetersiz bakiye")));
      i.yatir(50);
      assert_eq!(i.cek(150), Ok(()), "50 yatırıldıktan sonra 150 çekilebilmeli");
      i.onayla();
      assert_eq!(h.bakiye(), 0);
      assert_eq!(h.hareketler(), ["+50", "-150"], "Başarısız çekim hareket olarak yazılmamalı");
  }

  fn kira_ode(h: &mut Hesap, kira: i64) -> Result<(), String> {
      let mut i = h.islem_baslat();
      i.yatir(2000); // maaş
      i.cek(kira)?; // hata olursa i burada drop edilir → geri alınır
      i.onayla();
      Ok(())
  }

  #[test]
  fn soru_isareti_ile_erken_donuste_geri_alinir() {
      let mut h = Hesap::new(1000);
      h.islem_baslat().onayla();
      assert_eq!(kira_ode(&mut h, 5000), Err(String::from("yetersiz bakiye")));
      assert_eq!(h.bakiye(), 1000, "`?` ile erken dönüşte maaş yatırması da geri alınmalı");
      assert!(h.hareketler().is_empty());
      assert_eq!(kira_ode(&mut h, 2500), Ok(()));
      assert_eq!(h.bakiye(), 500);
      assert_eq!(h.hareketler(), ["+2000", "-2500"]);
  }
hints:
  - "`islem_baslat`'ta önce yedekleri yerel değişkenlere al (`let yedek_bakiye = self.bakiye;`), **sonra** `Islem { hesap: self, ... }` kur. Sıra önemli: `self`'i struct'a verdikten sonra ondan okuyamazsın."
  - "`cek`'te önce kontrol et, sonra değiştir: `if miktar > self.hesap.bakiye { return Err(...); }`. `onayla` yalnızca `self.onaylandi = true;` yapar; fonksiyon bitince `self` drop edilir."
  - "`drop`'ta `if !self.onaylandi { self.hesap.bakiye = self.yedek_bakiye; self.hesap.hareketler.truncate(self.yedek_hareket_sayisi); }`. `truncate(n)` vektörü ilk `n` elemana kısaltır."
explanation: |
  Geri alma kodu **tek bir yerde** (`Drop`) ve hiçbir çıkış yolu onu atlayamıyor: blok sonu, `?` ile erken dönüş,
  hatta bir panik. `kira_ode` testinde `i.cek(kira)?` başarısız olunca fonksiyon döner, `i` drop edilir ve maaş
  yatırması da geri alınır. Bu, işlemin **ya hep ya hiç** (atomik) olmasıdır.

  `onayla(mut self)` neden alanları dışarı taşımak yerine bir bayrak kullanıyor? Çünkü `Drop` uygulayan bir
  tipten alan **taşıyamazsın** (E0509): drop edilirken alanlar hâlâ yerinde olmalıdır. Bayrak, `Drop`'a “bu sefer
  bir şey yapma” demenin en basit yoludur. `onayla`'nın `self`'i tüketmesi de önemli: onaydan sonra işlemi
  kullanmaya devam etmek derlenmez (E0382).

  `cek`'te önce doğrulayıp sonra değiştirmek, başarısız bir çekimin yarım iz bırakmamasını sağlar (1. dersteki
  termostatta da aynı ilkeyi gördün). Gerçek dünyada `sqlx` gibi veritabanı kütüphanelerinin `Transaction`
  tipi tam bu deseni kullanır: `commit()` çağrılmadan drop edilen işlem otomatik geri alınır.
```

## Uzantı trait'leri: başkasının tipine metot eklemek

Modül 9'da Türkçenin büyük harf sorununu görmüştün: `"istanbul".to_uppercase()` sonucu `"ISTANBUL"` olur,
`"İSTANBUL"` değil. Standart kütüphanenin `str` tipine `tr_buyuk()` diye bir metot eklemek isterdin, ama `str`
senin tipin değil. Rust'ın cevabı **uzantı trait'i (extension trait)**: kendi trait'ini tanımla ve yabancı
tipe uygula. Orphan kuralı buna izin verir, çünkü **trait** senin.

```rust
trait TurkceMetin {
    fn tr_buyuk(&self) -> String;
    fn tr_kucuk(&self) -> String;
}

impl TurkceMetin for str {
    fn tr_buyuk(&self) -> String {
        let mut sonuc = String::with_capacity(self.len());
        for c in self.chars() {
            match c {
                'i' => sonuc.push('İ'),
                'ı' => sonuc.push('I'),
                _ => {
                    for b in c.to_uppercase() {
                        sonuc.push(b);
                    }
                }
            }
        }
        sonuc
    }

    fn tr_kucuk(&self) -> String {
        let mut sonuc = String::with_capacity(self.len());
        for c in self.chars() {
            match c {
                'I' => sonuc.push('ı'),
                'İ' => sonuc.push('i'),
                _ => {
                    for k in c.to_lowercase() {
                        sonuc.push(k);
                    }
                }
            }
        }
        sonuc
    }
}

fn main() {
    let sehir = String::from("istanbul ılık");
    println!("std : {}", sehir.to_uppercase());
    println!("tr  : {}", sehir.tr_buyuk()); // String'de de çalışır: deref zorlaması
    println!("std : {}", "ISPARTA".to_lowercase());
    println!("tr  : {}", "ISPARTA".tr_kucuk());
}
```

Trait'i `str` için uyguladık; `String` üzerinde de çağrılabiliyor, çünkü metot çağrısında `String` otomatik
olarak `&str`'ye deref edilir (Modül 17). Bu desen ekosistemde çok yaygındır ve adlandırma geleneği **`Ext`**
son ekidir: `itertools::Itertools` bütün iterator'lara onlarca adaptör ekler, Modül 19'daki
`futures::StreamExt` stream'lere `next()` ekler, `tokio::io::AsyncReadExt` okuyuculara `read_to_end()` ekler.

Uzantı trait'lerinin bir kuralı var. Trait başka bir modülde tanımlıysa ne olur?

```compiles
code: |
  mod metin {
      pub trait TurkceMetin {
          fn tr_buyuk(&self) -> String;
      }

      impl TurkceMetin for str {
          fn tr_buyuk(&self) -> String {
              let mut s = String::new();
              for c in self.chars() {
                  match c {
                      'i' => s.push('İ'),
                      _ => s.push(c),
                  }
              }
              s
          }
      }
  }

  fn main() {
      println!("{}", "ılgaz".tr_buyuk());
  }
answer: false
error: E0599
explanation: |
  Trait metotları ancak trait **kapsamdaysa** (scope) çağrılabilir. `impl` var, ama `main`'in bulunduğu yerde
  `TurkceMetin` görünür değil. Çözüm: `use metin::TurkceMetin;`. Bu kural bilinçlidir: aksi hâlde herhangi
  bir bağımlılığın eklediği uzantı trait'i, senin haberin olmadan `str`'nin metotlarını değiştirebilir ya da
  çakışma yaratabilirdi. Kullanacağın uzantıları açıkça seçersin.
```

:::error
```text
error[E0599]: no method named `tr_buyuk` found for reference `&'static str` in the current scope
  --> src/main.rs:21:28
   |
21 |     println!("{}", "ılgaz".tr_buyuk());
   |                            ^^^^^^^^ method not found in `&'static str`
   |
   = help: items from traits can only be used if the trait is in scope
help: trait `TurkceMetin` which provides `tr_buyuk` is implemented but not in scope; perhaps you want to import it
   |
 1 + use crate::metin::TurkceMetin;
```
`help` satırı her şeyi söylüyor: uygulama **var**, sadece trait kapsamda değil. Bu yüzden kütüphaneler sık
kullanılan uzantı trait'lerini bir **prelude** modülünde toplar ve `use kutuphane::prelude::*;` ile tek
satırda içeri alınmalarını sağlar.
:::

Uzantı trait'leri Modül 11'deki **blanket impl**'lerle birleşince çok güçlenir: bir sınırı karşılayan **her**
tipe aynı anda metot eklersin. `Itertools` da böyle çalışır: `impl<T: Iterator> Itertools for T`.

```fill
prompt: |
  `u32` üreten **her** iterator'a bir `ortalama()` metodu ekleyen uzantı trait'ini tamamla. Boş iterator için
  `None` dönsün.
code: |
  trait OrtalamaExt {
      fn ortalama(self) -> Option<f64>;
  }

  impl<I: Iterator<Item = u32>> OrtalamaExt for ___0 {
      fn ortalama(___1) -> Option<f64> {
          let mut toplam = 0;
          let mut adet = 0;
          for x in self {
              toplam += x;
              adet += 1;
          }
          if adet == 0 { None } else { Some(toplam as f64 / adet as f64) }
      }
  }

  fn main() {
      let notlar = vec![70, 85, 90];
      let ort = notlar.iter().copied().ortalama();
      let bos = Vec::<u32>::new().into_iter().ortalama();
      println!("{ort:?} {bos:?}");
  }
blanks:
  - ["I"]
  - ["self", "mut self"]
output: "Some(81.66666666666667) None"
explanation: |
  `impl<I: Iterator<Item = u32>> OrtalamaExt for I` bir **blanket impl**: `u32` üreten bütün iterator tiplerine
  (`Copied<Iter<u32>>`, `IntoIter<u32>`, `Range<u32>`, senin yazacağın iterator'lar...) metodu tek seferde ekler.
  `ortalama(self)` iterator'ı **tüketir**, tıpkı `sum()` ya da `collect()` gibi (Modül 14). `for x in self`
  sahipliği aldığı için `mut self` gerekmez, ama yazmak da hata değil.
```

Ne zaman uzantı trait'i, ne zaman başka bir yol?

- Yabancı bir tipe **metot sözdizimiyle** (`x.yap()`), zincirlenebilir işlem eklemek istiyorsan → uzantı trait'i.
- Yalnızca bir iki yerde kullanılacak bir yardımcıysa → sıradan bir fonksiyon (`fn tr_buyuk(s: &str)`) daha
  basittir ve kapsam kuralıyla uğraştırmaz.
- Tipe **yeni bir değişmez** ya da yabancı bir trait eklemek istiyorsan → geçen dersteki **newtype**.

Bir tuzak: standart kütüphane ileride aynı adda bir metot eklerse çağrı belirsizleşebilir (bu, `Itertools`'un
başına gerçekten geldi). Böyle durumlarda tam nitelikli sözdizimi (`TurkceMetin::tr_buyuk(s)`) kurtarır;
ayrıntısı Modül 22'de.

## GoF desenleri Rust'ta: çoğu zaten dilin içinde

Klasik kataloğa Rust gözüyle hızlıca bakalım. Birçoğunun karşılığı bir dil özelliği ya da bir std tipidir;
bazıları ise Rust'ta gereksizdir:

| GoF deseni | Rust'taki karşılığı |
|---|---|
| Iterator | `Iterator` trait'i (Modül 14); dilin kalbinde |
| Strategy | Trait + generic / `dyn`, ya da doğrudan closure |
| Command | Closure (`Box<dyn FnOnce()>`) ya da komutları veri olarak tutan bir **enum** |
| Template Method | Trait'in **varsayılan metotları** (1. ders) |
| State | Enum durum makinesi ya da **typestate** (4. ders) |
| Builder | Builder deseni (5. ders); isimli argüman yokluğunun ilacı |
| Visitor | Kapalı tip kümesi için **enum + `match`**; kapsamlılık kontrolü bedava |
| Decorator | Sarmalayıcı tipler; iterator adaptörleri (`map`, `filter`) birer dekoratördür |
| Adapter | Newtype ya da `From`/`Into` dönüşümleri (Modül 11) |
| Factory Method | `new`, `from`, `Default::default` gibi ilişkili fonksiyonlar |
| Prototype | `Clone` trait'i |
| Singleton | Çoğu zaman gereksiz: durumu parametre olarak geçir. Gerçekten gerekirse `OnceLock`/`LazyLock` (Modül 18) |
| Observer | Callback listesi (`Vec<Box<dyn Fn(&Olay)>>`) ya da kanallar (`mpsc`, Modül 18) |

Neden bu kadar çok desen “eriyor”? Çünkü GoF desenlerinin büyük kısmı, **fonksiyonları değer olarak
taşıyamayan** ve **cebirsel veri tipleri (enum) olmayan** 1990'ların Java/C++'ının eksiklerini kapatmak için
icat edildi. Rust'ta closure'lar ve enum'lar birinci sınıf olduğu için desene gerek kalmadan doğrudan
yazarsın. Kalıtıma dayanan desenler (Template Method gibi) ise trait'lere ve kompozisyona dönüşür.

```quiz
question: |
  Java'da **Visitor** deseniyle yazılmış bir hesap makinesi ifade ağacını (Sayi, Topla, Carp, Eksi düğümleri)
  Rust'a taşıyorsun. Düğüm tipleri sabit ve hepsi senin kodunda. En idiomatik Rust tasarımı hangisi?
options:
  - "Her düğüm için bir struct, `trait Dugum { fn kabul_et(&self, z: &mut dyn Ziyaretci); }` ve her işlem için bir `Ziyaretci` impl'i"
  - "`enum Ifade { Sayi(f64), Topla(Box<Ifade>, Box<Ifade>), ... }` ve her işlem için `match` kullanan bir fonksiyon"
  - "`Vec<Box<dyn Any>>` ve `downcast_ref` ile tip kontrolü"
  - Düğüm türünü bir `String` alanında tutup `if tur == "topla"` ile dallanmak
answer: 1
explanation: |
  Visitor, kapalı bir tip kümesi üzerinde **yeni işlemler** eklemek için icat edildi; çünkü Java'da (o zamanlar)
  tip üzerinde kapsamlı bir `match` yoktu. Rust'ta enum + `match` tam bu işi yapar: yeni işlem = yeni fonksiyon,
  ve yeni bir düğüm tipi eklediğinde bütün eksik `match`'leri derleyici **E0004** ile gösterir (3. ders). İç içe
  yapı için `Box<Ifade>` gerekir; Modül 17'deki özyinelemeli tipleri hatırla.
feedback:
  - "Çalışır ama Rust'ta gereksiz tören: çift dispatch, trait nesneleri ve çok fazla tekrar."
  - Doğru!
  - "`Any` son çaredir; derleyicinin kapsamlılık kontrolünü kaybedersin."
  - "“Stringly typed” kod: yazım hataları derleme zamanında yakalanmaz."
```

## Özet

:::remember
- **Strateji**: algoritmayı değiştirilebilir parça yap. Derleme zamanında belli → generic (`S: Strateji`);
  çalışma zamanında seçilen ya da durumlu → `Box<dyn Strateji>`; tek işlemlik → closure (`impl Fn`/`Box<dyn Fn>`).
- **RAII koruyucusu**: oluşturulunca başlatır, `Drop`'ta geri alır. Erken `return`, `?` ve panikte de çalışır.
  `let _ = koruyucu()` değeri **hemen** drop eder; `let _g = koruyucu()` kapsam sonuna kadar yaşatır.
- `&mut` tutan koruyucu, yaşadığı sürece asıl nesneye erişimi derleme zamanında kilitler (E0502/E0499).
  `Drop` uygulayan tipten alan taşınamaz (E0509); “onaylandı” bayrağı kullan. `mem::forget` güvenlidir: bellek
  güvenliğini Drop'a bağlama.
- **Uzantı trait'i**: kendi trait'ini yabancı tipe uygula (orphan kuralı izin verir), adı genelde `...Ext`.
  Kullanmak için trait'i `use` ile kapsama al (yoksa **E0599**). Blanket impl ile her uygun tipe birden ekle.
- GoF desenlerinin çoğu Rust'ta bir dil özelliğidir: Iterator, closure (Strategy/Command), enum + `match`
  (Visitor/State), varsayılan metotlar (Template Method), `Clone` (Prototype).
:::

```reflect
prompt: |
  Bir arkadaşın Java'dan geliyor ve Rust projesinde bir dosyayı açıp kapatmak için şunu yazıyor:
  `let d = Dosya::ac(..); islem_yap(&d)?; d.kapat();`. Bu kodda ne risk var ve Rust'ta bu sorun RAII ile nasıl
  çözülür? `try/finally` ile karşılaştır.
answer: |
  `islem_yap` hata döndürürse `?` fonksiyondan erken çıkar ve `d.kapat()` hiç çalışmaz; kapatma her çıkış
  yolunda elle hatırlanmak zorunda. Java'da bunu `try/finally` ile çözersin ama `finally` bloğunu yazmayı yine
  hatırlaman gerekir.

  Rust'ta kapatma işi `Dosya`'nın `Drop` uygulamasına konur (std'deki `File` zaten böyledir). Böylece `d` kapsamdan
  çıktığı anda, normal bitişte, `?` ile erken dönüşte ya da panikte otomatik kapanır. Temizlik kodu tek yerde
  yazılır ve unutulamaz. Açıkça kapatmak gerekiyorsa `drop(d)` çağrılır. Hata bilgisi gerekiyorsa
  `kapat(self) -> Result` gibi tüketen bir metot da eklenebilir, ama Drop yedek olarak yine orada durur.
```

```flashcards
- front: Strateji deseninin Rust'taki üç biçimi nedir?
  back: "Generic tip parametresi (`S: Strateji`, statik), trait nesnesi (`Box<dyn Strateji>`, dinamik) ve closure (`impl Fn` / `Box<dyn Fn>`)."
- front: Strateji çalışma zamanında değişebiliyorsa neden generic biçim uygun değildir?
  back: "Tip parametresi derleme zamanında sabitlenir; `Sepet<A>` ile `Sepet<B>` farklı tiplerdir, çalışırken birinden ötekine geçilemez."
- front: RAII koruyucusu (guard) nedir?
  back: Oluşturulduğunda bir durumu başlatan ve `Drop`'ta onu geri alan değer; temizlik her çıkış yolunda (return, `?`, panik) otomatik çalışır.
- front: "`let _ = g.bolum(\"A\");` ile `let _b = g.bolum(\"A\");` arasındaki fark nedir?"
  back: "`_` bağlama yapmaz, değer ifade sonunda hemen drop edilir. `_b` gerçek bir değişkendir, kapsam sonuna kadar yaşar."
- front: Bir koruyucunun `onayla(self)` metodu neden alanları taşımak yerine bayrak kullanır?
  back: "`Drop` uygulayan bir tipten alan taşınamaz (E0509); bayrak, `drop`'a geri alma yapmamasını söyler."
- front: Uzantı trait'i (extension trait) nedir ve orphan kuralını neden çiğnemez?
  back: "Yabancı bir tipe metot eklemek için tanımlanan kendi trait'in; trait yerel olduğu için `impl BenimTrait for str` serbesttir."
- front: Uzantı trait'inin metodu çağrılırken E0599 alıyorsan muhtemel sebep nedir?
  back: "Trait kapsamda değil; `use yol::TraitAdi;` ile içeri alınmalı (help: \"implemented but not in scope\")."
- front: Visitor deseninin Rust'taki idiomatik karşılığı nedir?
  back: "Kapalı tip kümesi için enum + `match`: yeni işlem yeni bir fonksiyondur, eksik varyantları derleyici E0004 ile yakalar."
```
