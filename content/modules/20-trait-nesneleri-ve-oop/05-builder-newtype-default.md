---
id: m20-l05
title: Builder, newtype ve Default
minutes: 25
type: lesson
objectives:
  - "`Default` trait'ini türetip ya da elle yazıp `..Default::default()` ile okunaklı yapılandırma nesneleri kurabilmek"
  - "Tüketen (`mut self`) ve tüketmeyen (`&mut self`) builder yazabilmek ve aralarındaki farkı (E0716) açıklayabilmek"
  - Newtype ile bir değişmezi (invariant) tipe kodlayıp doğrulamayı tek bir kurucuda toplayabilmek
  - Orphan kuralına takılan bir `impl`'i newtype sarmalayıcıyla çözebilmek
keywords: [builder, newtype, Default, "..Default::default()", E0716, E0117, struct güncelleme, değişmez, parse don't validate]
---

Şu satır ne yapıyor sence?

```rust,ignore
let s = Siparis::new("Ayşe", 3, true, false, None, 0, true);
```

`true, false, ..., true` hangi ayarlar? Üç ay sonra kodu okuyan sen bile bilmeyeceksin. Python'da
`Siparis(musteri="Ayşe", adet=3, hediye_paketi=True)` gibi **isimli ve varsayılan argümanlar**, Java'da
**aşırı yüklenmiş (overloaded)** kurucular var. Rust'ta ikisi de yok. Bu bir eksiklik gibi görünse de yerine
daha açık üç araç koyar: **`Default`** trait'i, **builder (kurucu)** deseni ve **newtype**. Bu derste üçünü
de Rust'a yakışır biçimde kullanmayı öğreneceksin.

## Default: makul başlangıç değerleri

Modül 11'de `Default`'u türetmeyi gördün. Şimdi ona bir **yapılandırma aracı** gözüyle bakalım. Bir web
sunucusunun on tane ayarı olsun; çoğu kullanıcı yalnızca bir ikisini değiştirmek ister. Fikir şu: önce
**bütün alanları makul değerlerle** dolduran bir `default()` yaz, kullanıcı yalnızca farklı olanları söylesin.

```rust
#[derive(Debug, Default, Clone, Copy, PartialEq)]
enum Gunluk {
    Sessiz,
    #[default]
    Normal,
    Ayrintili,
}

#[derive(Debug)]
struct SunucuAyari {
    adres: String,
    port: u16,
    isci_sayisi: usize,
    gunluk: Gunluk,
    sikistirma: bool,
}

impl Default for SunucuAyari {
    fn default() -> Self {
        SunucuAyari {
            adres: String::from("127.0.0.1"),
            port: 8080,
            isci_sayisi: 4,
            gunluk: Gunluk::default(),
            sikistirma: true,
        }
    }
}

fn main() {
    // Yalnızca farklı olanı söyle, gerisi varsayılandan gelsin:
    let ayar = SunucuAyari {
        port: 3000,
        gunluk: Gunluk::Ayrintili,
        ..Default::default()
    };
    println!("{ayar:#?}");

    if ayar.gunluk != Gunluk::Sessiz {
        println!(
            "{}:{} dinleniyor ({} işçi, sıkıştırma: {})",
            ayar.adres, ayar.port, ayar.isci_sayisi, ayar.sikistirma
        );
    }
}
```

Üç ayrıntıya dikkat et:

1. **`#[derive(Default)]` her alana o tipin `default()`'unu koyar**: sayılar `0`, `bool` `false`, `String` ve
   `Vec` boş, `Option` `None`. Port için `0`, adres için boş metin anlamsız olduğundan burada `Default`'u
   **elle** yazdık.
2. **Enum'larda `#[default]`** niteliği hangi varyantın varsayılan olduğunu söyler (yalnızca veri taşımayan
   varyantlarda kullanılabilir).
3. **`..Default::default()`** Modül 6'daki **struct güncelleme sözdizimi**dir (struct update syntax): yazmadığın
   alanlar sağdaki değerden alınır. Sağdaki değer burada `SunucuAyari::default()`'tur; tip, sol taraftan çıkarılır.

:::analogy Hazır menü ve “şunu değiştirin”
Lokantada “Bir kahvaltı tabağı, ama beyaz peynir yerine kaşar olsun” dersin. Garson tabağın geri kalanını
(zeytin, domates, yumurta) sormaz; menüde **varsayılan** ne varsa onu getirir. `..Default::default()` tam
olarak budur: yalnızca farkı söylersin, geri kalanını “mutfağın standart tabağı” tamamlar.
:::

Önce tahmin et: `#[derive(Default)]` iç içe struct'larda ne yapar?

```predict
code: |
  #[derive(Debug)]
  struct Baglanti {
      zaman_asimi_sn: u32,
      deneme: u8,
  }

  impl Default for Baglanti {
      fn default() -> Self {
          Baglanti { zaman_asimi_sn: 30, deneme: 3 }
      }
  }

  #[derive(Debug, Default)]
  struct Istemci {
      ad: String,
      baglanti: Baglanti,
      etiketler: Vec<String>,
      vekil: Option<String>,
  }

  fn main() {
      let i = Istemci { ad: String::from("hava-durumu"), ..Default::default() };
      println!(
          "{} {} {} {} {:?}",
          i.ad, i.baglanti.zaman_asimi_sn, i.baglanti.deneme, i.etiketler.len(), i.vekil
      );
  }
options:
  - "hava-durumu 30 3 0 None"
  - "hava-durumu 0 0 0 None"
  - "hava-durumu 30 3 0 Some(\"\")"
  - Derlenmez, çünkü `Baglanti` `Default`'u türetmiyor
answer: 0
explanation: |
  Türetilmiş `Default`, her alan için **o alanın tipinin** `default()`'unu çağırır. `Baglanti`'nın `Default`'u
  elle yazılmış (30 ve 3), türetilmiş olması gerekmez; önemli olan `Default`'u **uygulaması**. Bu yüzden iç
  struct kendi makul değerleriyle gelir. `Vec` boş (uzunluk 0), `Option` ise `None` olur, `Some("")` değil.
```

`Default` bir alanda **yoksa** türetme başarısız olur:

:::error
```text
error[E0277]: the trait bound `Tema: Default` is not satisfied
  --> src/main.rs:10:5
   |
 7 | #[derive(Debug, Default)]
   |                 ------- in this derive macro expansion
...
10 |     tema: Tema,
   |     ^^^^^^^^^^ the trait `Default` is not implemented for `Tema`
   |
help: consider annotating `Tema` with `#[derive(Default)]`
```
Okuma: `derive` bir makrodur ve her alan için `Default::default()` çağıran kod üretir. Alanlardan biri
(`tema: Tema`) bunu desteklemiyorsa hata **o alanı** gösterir. Çözüm: `Tema`'ya `#[derive(Default)]` ve bir
`#[default]` varyant ekle ya da dış struct için `Default`'u elle yaz.
:::

`Default` yalnızca yapılandırmaya yaramaz; standart kütüphanenin birçok kolaylığı ona dayanır:
`opsiyon.unwrap_or_default()` (Modül 10), `harita.entry(k).or_default()` (Modül 9) ve
`std::mem::take(&mut alan)`. Sonuncusu, geçen dersteki `Option::take`'in genel hâlidir: değeri dışarı alır ve
yerine tipin varsayılanını bırakır. Ayrıca argümansız bir `new()` yazıyorsan `Default`'u da uygula; Clippy
bunu `new_without_default` uyarısıyla hatırlatır.

Struct güncelleme sözdiziminin bir tuzağı var. Modül 6'yı hatırla:

```compiles
code: |
  #[derive(Debug)]
  struct Profil {
      ad: String,
      sehir: String,
      yas: u32,
  }

  fn main() {
      let ece = Profil { ad: String::from("Ece"), sehir: String::from("İzmir"), yas: 20 };
      let ikiz = Profil { ad: String::from("Ela"), ..ece };
      println!("{} {}", ece.ad, ece.sehir);
      println!("{ikiz:?}");
  }
answer: false
error: E0382
explanation: |
  `..ece` yazmadığın alanları `ece`'den **taşır**. `yas` (`u32`, `Copy`) kopyalanır ama `sehir` bir `String`'dir
  ve `ikiz`'e taşınır. `ece` artık **kısmen taşınmış** (partially moved) bir değerdir: `ece.ad` hâlâ
  kullanılabilir, ama `ece.sehir` kullanılamaz (E0382). `..Default::default()` ile bu sorun yaşanmaz, çünkü
  sağdaki değer zaten yalnızca bu iş için oluşturulmuş geçici bir değerdir.
```

## Builder deseni: adım adım kurmak

`..Default::default()` alanlar `pub` olduğunda harikadır. Peki alanlar **gizliyse** (kapsülleme, 1. ders),
kurulum sırasında **doğrulama** gerekiyorsa ya da bir ayar birden çok alanı etkiliyorsa? O zaman
**builder (kurucu)** desenini kullanırsın: ayarları biriktiren ayrı bir tip, en sonda da asıl nesneyi üreten
bir `kur()` (İngilizce kodda genelde `build()`) metodu.

İlk biçim **tüketen builder** (consuming builder): her ayar metodu `mut self` alır, onu değiştirir ve geri
döndürür. Böylece çağrılar zincirlenebilir:

```rust
#[derive(Debug)]
struct Sorgu {
    tablo: String,
    kosullar: Vec<String>,
    siralama: Option<String>,
    limit: Option<u32>,
}

impl Sorgu {
    fn sql(&self) -> String {
        let mut s = format!("SELECT * FROM {}", self.tablo);
        if !self.kosullar.is_empty() {
            s.push_str(" WHERE ");
            s.push_str(&self.kosullar.join(" AND "));
        }
        if let Some(alan) = &self.siralama {
            s.push_str(&format!(" ORDER BY {alan}"));
        }
        if let Some(n) = self.limit {
            s.push_str(&format!(" LIMIT {n}"));
        }
        s
    }
}

struct SorguKurucu {
    tablo: String,
    kosullar: Vec<String>,
    siralama: Option<String>,
    limit: Option<u32>,
}

impl SorguKurucu {
    fn new(tablo: &str) -> Self {
        SorguKurucu { tablo: tablo.to_string(), kosullar: Vec::new(), siralama: None, limit: None }
    }

    fn filtre(mut self, kosul: &str) -> Self {
        self.kosullar.push(kosul.to_string());
        self
    }

    fn sirala(mut self, alan: &str) -> Self {
        self.siralama = Some(alan.to_string());
        self
    }

    fn limit(mut self, n: u32) -> Self {
        self.limit = Some(n);
        self
    }

    fn kur(self) -> Result<Sorgu, String> {
        if self.limit == Some(0) {
            return Err(String::from("LIMIT 0 anlamsız"));
        }
        Ok(Sorgu {
            tablo: self.tablo,
            kosullar: self.kosullar,
            siralama: self.siralama,
            limit: self.limit,
        })
    }
}

fn main() {
    let sorgu = SorguKurucu::new("ogrenciler")
        .filtre("not >= 50")
        .filtre("sinif = '9-A'")
        .sirala("soyad")
        .limit(10)
        .kur()
        .expect("geçerli sorgu");
    println!("{}", sorgu.sql());

    let hatali = SorguKurucu::new("kitaplar").limit(0).kur();
    println!("{hatali:?}");
}
```

Okunabilirliğe bak: her ayarın **adı** çağrının yanında duruyor; `true, false` bilmecesi yok. İsteğe bağlı
ayarları atlamak serbest, sıraları da önemsiz. `kur()` ise iki iş yapar: kurucuyu **tüketir** (alanlarını yeni
nesneye taşır, hiçbir şey kopyalanmaz) ve **doğrulama** için tek bir kapı olur. Hatalıysa `Result` ile
söyler (Modül 10). Neden `mut self` alıp `Self` döndürüyoruz? Çünkü değer zincir boyunca **taşınarak**
ilerliyor:

```memory
title: Tüketen builder zinciri
steps:
  - caption: "`SorguKurucu::new(\"ogrenciler\")` geçici bir kurucu oluşturdu; `kosullar` vektörü heap'te."
    stack:
      - frame: main
        vars:
          - { name: "(geçici)", type: SorguKurucu, value: "tablo · kosullar(ptr, len=0) · ...", to: h1 }
    heap:
      - { id: h1, label: "Vec<String>", value: "(boş)" }
  - caption: "`.filtre(...)` kurucuyu `self` olarak **sahiplenir**, vektöre ekler ve aynı değeri geri verir. Heap verisi kopyalanmadı, sadece sahibi el değiştirdi."
    stack:
      - frame: filtre
        vars:
          - { name: self, type: SorguKurucu, value: "tablo · kosullar(ptr, len=1) · ...", to: h1, mut: true }
    heap:
      - { id: h1, label: "Vec<String>", value: "\"not >= 50\"" }
  - caption: "`.kur()` kurucuyu tüketir; alanlar `Sorgu`'ya taşınır. Kurucu artık yok, aynı vektör `sorgu`'nun."
    stack:
      - frame: main
        vars:
          - { name: sorgu, type: Sorgu, value: "tablo · kosullar(ptr, len=2) · ...", to: h1 }
    heap:
      - { id: h1, label: "Vec<String>", value: "\"not >= 50\" · \"sinif = '9-A'\"" }
```

Standart kütüphanede tüketen builder örneği: `std::thread::Builder::new().name("isci".into()).spawn(...)`.
Ekosistemde de çok yaygındır (ör. HTTP istemcilerinin istek kurucuları).

```fill
prompt: |
  Bir oyun karakteri için **tüketen** bir builder tamamla: ayar metotları kurucuyu alıp değiştirerek geri
  versin, `kur` onu tüketip `Karakter` üretsin.
code: |
  #[derive(Debug)]
  struct Karakter {
      ad: String,
      can: u32,
      sinif: String,
  }

  struct KarakterKurucu {
      ad: String,
      can: u32,
      sinif: String,
  }

  impl KarakterKurucu {
      fn new(ad: &str) -> Self {
          KarakterKurucu { ad: ad.to_string(), can: 100, sinif: String::from("Köylü") }
      }

      fn can(___0 self, can: u32) -> ___1 {
          self.can = can;
          self
      }

      fn sinif(mut self, sinif: &str) -> Self {
          self.sinif = sinif.to_string();
          self
      }

      fn kur(___2) -> Karakter {
          Karakter { ad: self.ad, can: self.can, sinif: self.sinif }
      }
  }

  fn main() {
      let k = KarakterKurucu::new("Nasreddin").sinif("Bilge").can(80).kur();
      println!("{} ({}) - can: {}", k.ad, k.sinif, k.can);
  }
blanks:
  - ["mut"]
  - ["Self", "KarakterKurucu"]
  - ["self"]
output: "Nasreddin (Bilge) - can: 80"
explanation: |
  `mut self` kurucunun sahipliğini alır ve içini değiştirmeye izin verir; `-> Self` aynı değeri zincirin bir
  sonraki halkasına geri verir. `kur(self)` kurucuyu **tüketir**, böylece `String` alanları `Karakter`'e
  kopyalanmadan taşınır. `&self` yazsaydın `self.ad`'ı ödünç alınmış bir değerden dışarı taşıyamazdın
  (E0507, geçen ders) ve `clone()` gerekirdi.
```

## Tüketmeyen builder ve koşullu ayarlar

Tüketen builder'ın bir zahmeti var: ayarı bir **koşula** bağlı yapmak istersen her seferinde değişkeni yeniden
bağlaman gerekir:

```rust,ignore
let mut kurucu = SorguKurucu::new("urunler");
if sadece_stoktakiler {
    kurucu = kurucu.filtre("stok > 0"); // kurucu taşındı, geri aldık
}
```

İkinci biçim **tüketmeyen builder**'dır (non-consuming): ayar metotları `&mut self` alır ve `&mut Self`
döndürür. Standart kütüphanedeki `std::process::Command` böyledir. Onu taklit edelim (gerçek bir program
çalıştırmadan, yalnızca komut satırını üreterek):

```rust
struct Komut {
    program: String,
    argumanlar: Vec<String>,
}

impl Komut {
    fn new(program: &str) -> Self {
        Komut { program: program.to_string(), argumanlar: Vec::new() }
    }

    fn arg(&mut self, a: &str) -> &mut Self {
        self.argumanlar.push(a.to_string());
        self
    }

    fn satir(&self) -> String {
        let mut s = self.program.clone();
        for a in &self.argumanlar {
            s.push(' ');
            s.push_str(a);
        }
        s
    }
}

fn main() {
    let surum_derlemesi = true;

    let mut komut = Komut::new("cargo");
    komut.arg("build");
    if surum_derlemesi {
        komut.arg("--release"); // yeniden bağlama yok
    }
    komut.arg("--quiet");
    println!("{}", komut.satir());

    // Tek bir ifadede zincirlemek de olur:
    println!("{}", Komut::new("cargo").arg("test").arg("--lib").satir());

    // Aynı kurucu tekrar tekrar kullanılabilir:
    println!("{}", komut.satir());
}
```

`satir(&self)` kurucuyu tüketmediği için aynı yapılandırmayla birden çok kez “çalıştırabilirsin”. Bedeli, son
adımın (`kur`/`satir`) alanları taşıyamaması: bir nesne üretmesi gerekiyorsa **klonlamak** zorundadır. Peki şu
kullanım derlenir mi?

```compiles
code: |
  struct IstekKurucu {
      adres: String,
      basliklar: Vec<String>,
  }

  impl IstekKurucu {
      fn new(adres: &str) -> IstekKurucu {
          IstekKurucu { adres: adres.to_string(), basliklar: Vec::new() }
      }
      fn baslik(&mut self, b: &str) -> &mut IstekKurucu {
          self.basliklar.push(b.to_string());
          self
      }
      fn kur(&self) -> String {
          format!("{} {:?}", self.adres, self.basliklar)
      }
  }

  fn main() {
      let kurucu = IstekKurucu::new("/api").baslik("Accept: json");
      println!("{}", kurucu.kur());
  }
answer: false
error: E0716
explanation: |
  `IstekKurucu::new("/api")` **geçici** bir değer üretir ve `baslik` ona bir `&mut` referans döndürür. Geçici
  değer, ifadenin (`;`'nin) sonunda drop edilir; `kurucu` ise o ölü değere işaret eden bir referans olarak
  kalırdı. Bir sonraki satırda kullanıldığı için borrow checker reddeder. Tek bir ifadede `...baslik(..).kur()`
  yazsaydın derlenirdi, çünkü geçici değer ifade bitene kadar yaşar.
```

:::error
```text
error[E0716]: temporary value dropped while borrowed
  --> src/main.rs:20:18
   |
20 |     let kurucu = IstekKurucu::new("/api").baslik("Accept: json");
   |                  ^^^^^^^^^^^^^^^^^^^^^^^^                       - temporary value is freed at the end of this statement
   |                  |
   |                  creates a temporary value which is freed while still in use
21 |     println!("{}", kurucu.kur());
   |                    ------ borrow later used here
   |
help: consider using a `let` binding to create a longer lived value
```
Derleyicinin önerisi doğru: önce kurucuyu bir değişkene bağla (`let mut k = IstekKurucu::new(..);`), sonra
`k.baslik(..)` de. Tüketmeyen builder'larda en sık karşılaşılan hata budur.
:::

| | Tüketen (`mut self -> Self`) | Tüketmeyen (`&mut self -> &mut Self`) |
|---|---|---|
| Tek ifadede zincir | Evet | Evet |
| Koşullu ayar | `k = k.ayar(..)` (yeniden bağla) | `k.ayar(..);` |
| Son adım | Alanları **taşır**, kopya yok | Gerekirse **klonlar** |
| Kurucuyu yeniden kullanmak | Hayır (tüketildi) | Evet |
| Std örneği | `thread::Builder` | `process::Command` |

:::deep Typestate builder: zorunlu alanları derleyiciye denetlet
Builder'da bir alan **zorunluysa** (örneğin sorgunun tablosu), iki yolun var: onu `new(tablo)` parametresi yapmak
(burada yaptığımız) ya da geçen dersteki **typestate** fikrini kullanmak. Örneğin `EpostaKurucu<AliciYok>` tipinde
`kur()` metodu hiç yoktur; `.alici("..")` çağrısı onu `EpostaKurucu<AliciVar>`'a çevirir ve `kur()` yalnızca
orada tanımlıdır. Böylece “alıcısız e-posta” derlenmez. Tip parametresiyle durum işaretlemenin inceliklerini
(`PhantomData`) Modül 22'de göreceksin.
:::

```quiz
question: |
  Bir test aracı için yapılandırma kurucusu yazıyorsun. Kullanıcılar kurucuyu bir kez ayarlayıp **aynı ayarlarla
  birçok test koşusu** başlatmak, ayrıca bazı ayarları `if` ile koşullu eklemek istiyor. Hangi biçim daha uygun?
options:
  - "Tüketen builder (`fn ayar(mut self, ..) -> Self`, `fn kur(self)`)"
  - "Tüketmeyen builder (`fn ayar(&mut self, ..) -> &mut Self`, `fn kur(&self)`)"
  - Bütün alanları `pub` yapıp her koşuda struct'ı elle kurmak
answer: 1
explanation: |
  “Aynı kurucuyla birçok kez üret” ve “koşullu ayar” tüketmeyen builder'ın iki güçlü yanıdır: `kur(&self)`
  kurucuyu tüketmez, `if kosul { k.ayar(..); }` yeniden bağlama gerektirmez. Bedeli `kur` içindeki klonlamadır;
  bir test aracında bu ihmal edilebilir.
feedback:
  - "Tüketen builder `kur(self)` sonrasında kullanılamaz; her koşu için kurucuyu baştan kurmak (ya da kur'dan önce klonlamak) gerekir."
  - Doğru!
  - Kapsüllemeyi ve kurulumdaki doğrulamayı kaybedersin; her koşuda bütün alanları tekrar yazmak da zahmetli.
```

## Alıştırma: kahve siparişi kurucusu

```exercise
id: m20-l05-e-kahve
title: Kahve siparişi kurucusu
difficulty: 3
prompt: |
  Bir kahve dükkânının sipariş uygulaması için **tüketen** bir builder yaz. `Kahve` ve `fiyat()` hazır.
  `KahveKurucu`'nun metotlarını tamamla:

  - `new(cesit)`: boy `Orta`, `shot` 1, süt yok (`None`), şurup listesi boş.
  - `boy(b)`, `sut(ad)`: ilgili alanı ayarlar. `ekstra_shot()`: shot sayısını 1 artırır.
    `surup(ad)`: şurup listesine ekler. Hepsi zincirlenebilir (`mut self -> Self`).
  - `kur()`: doğrular ve `Result<Kahve, String>` döndürür. Kurallar, bu sırayla kontrol edilecek:
    1. çeşit boş ya da yalnızca boşluksa → `Err("kahve çeşidi boş olamaz")`
    2. shot sayısı 4'ten fazlaysa → `Err("en fazla 4 shot olabilir")`
    3. 2'den fazla şurup varsa → `Err("en fazla 2 şurup eklenebilir")`
starter: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  pub enum Boy {
      Kucuk,
      Orta,
      Buyuk,
  }

  #[derive(Debug, PartialEq)]
  pub struct Kahve {
      pub cesit: String,
      pub boy: Boy,
      pub shot: u8,
      pub sut: Option<String>,
      pub surup: Vec<String>,
  }

  impl Kahve {
      pub fn fiyat(&self) -> u32 {
          let taban = match self.boy {
              Boy::Kucuk => 60,
              Boy::Orta => 75,
              Boy::Buyuk => 90,
          };
          let ekstra_shot = 15 * (self.shot as u32 - 1);
          let sut = if self.sut.is_some() { 10 } else { 0 };
          taban + ekstra_shot + sut + 5 * self.surup.len() as u32
      }
  }

  pub struct KahveKurucu {
      cesit: String,
      boy: Boy,
      shot: u8,
      sut: Option<String>,
      surup: Vec<String>,
  }

  impl KahveKurucu {
      pub fn new(cesit: &str) -> Self {
          todo!()
      }

      pub fn boy(mut self, boy: Boy) -> Self {
          todo!()
      }

      pub fn ekstra_shot(mut self) -> Self {
          todo!()
      }

      pub fn sut(mut self, ad: &str) -> Self {
          todo!()
      }

      pub fn surup(mut self, ad: &str) -> Self {
          todo!()
      }

      pub fn kur(self) -> Result<Kahve, String> {
          todo!()
      }
  }

  fn main() {
      let kahve = KahveKurucu::new("latte")
          .boy(Boy::Buyuk)
          .ekstra_shot()
          .sut("yulaf")
          .surup("fındık")
          .kur();
      match kahve {
          Ok(k) => println!("{} {:?}: {} TL", k.cesit, k.boy, k.fiyat()),
          Err(e) => println!("Hata: {e}"),
      }
  }
solution: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  pub enum Boy {
      Kucuk,
      Orta,
      Buyuk,
  }

  #[derive(Debug, PartialEq)]
  pub struct Kahve {
      pub cesit: String,
      pub boy: Boy,
      pub shot: u8,
      pub sut: Option<String>,
      pub surup: Vec<String>,
  }

  impl Kahve {
      pub fn fiyat(&self) -> u32 {
          let taban = match self.boy {
              Boy::Kucuk => 60,
              Boy::Orta => 75,
              Boy::Buyuk => 90,
          };
          let ekstra_shot = 15 * (self.shot as u32 - 1);
          let sut = if self.sut.is_some() { 10 } else { 0 };
          taban + ekstra_shot + sut + 5 * self.surup.len() as u32
      }
  }

  pub struct KahveKurucu {
      cesit: String,
      boy: Boy,
      shot: u8,
      sut: Option<String>,
      surup: Vec<String>,
  }

  impl KahveKurucu {
      pub fn new(cesit: &str) -> Self {
          KahveKurucu {
              cesit: cesit.to_string(),
              boy: Boy::Orta,
              shot: 1,
              sut: None,
              surup: Vec::new(),
          }
      }

      pub fn boy(mut self, boy: Boy) -> Self {
          self.boy = boy;
          self
      }

      pub fn ekstra_shot(mut self) -> Self {
          self.shot = self.shot.saturating_add(1);
          self
      }

      pub fn sut(mut self, ad: &str) -> Self {
          self.sut = Some(ad.to_string());
          self
      }

      pub fn surup(mut self, ad: &str) -> Self {
          self.surup.push(ad.to_string());
          self
      }

      pub fn kur(self) -> Result<Kahve, String> {
          if self.cesit.trim().is_empty() {
              return Err(String::from("kahve çeşidi boş olamaz"));
          }
          if self.shot > 4 {
              return Err(String::from("en fazla 4 shot olabilir"));
          }
          if self.surup.len() > 2 {
              return Err(String::from("en fazla 2 şurup eklenebilir"));
          }
          Ok(Kahve {
              cesit: self.cesit,
              boy: self.boy,
              shot: self.shot,
              sut: self.sut,
              surup: self.surup,
          })
      }
  }

  fn main() {
      let kahve = KahveKurucu::new("latte")
          .boy(Boy::Buyuk)
          .ekstra_shot()
          .sut("yulaf")
          .surup("fındık")
          .kur();
      match kahve {
          Ok(k) => println!("{} {:?}: {} TL", k.cesit, k.boy, k.fiyat()),
          Err(e) => println!("Hata: {e}"),
      }
  }
check: tests
tests: |
  #[test]
  fn varsayilanlar_dogru() {
      let k = KahveKurucu::new("filtre").kur().expect("sade filtre kahve geçerli olmalı");
      assert_eq!(k.boy, Boy::Orta, "Varsayılan boy Orta olmalı");
      assert_eq!(k.shot, 1, "Varsayılan shot sayısı 1 olmalı");
      assert_eq!(k.sut, None, "Varsayılan olarak süt yok");
      assert!(k.surup.is_empty(), "Varsayılan olarak şurup yok");
      assert_eq!(k.fiyat(), 75);
  }

  #[test]
  fn zincir_ayarlari_uygular() {
      let k = KahveKurucu::new("latte")
          .boy(Boy::Buyuk)
          .ekstra_shot()
          .ekstra_shot()
          .sut("badem")
          .surup("karamel")
          .surup("vanilya")
          .kur()
          .expect("bu sipariş geçerli");
      assert_eq!(k.cesit, "latte");
      assert_eq!(k.shot, 3, "İki ekstra shot ile toplam 3 olmalı");
      assert_eq!(k.sut.as_deref(), Some("badem"));
      assert_eq!(k.surup, vec![String::from("karamel"), String::from("vanilya")]);
      assert_eq!(k.fiyat(), 90 + 30 + 10 + 10, "Büyük + 2 ekstra shot + süt + 2 şurup");
  }

  #[test]
  fn sinir_degerleri() {
      let dort = KahveKurucu::new("americano").ekstra_shot().ekstra_shot().ekstra_shot().kur();
      assert!(dort.is_ok(), "Tam 4 shot geçerli olmalı");
      let bes = KahveKurucu::new("americano")
          .ekstra_shot().ekstra_shot().ekstra_shot().ekstra_shot()
          .kur();
      assert_eq!(bes, Err(String::from("en fazla 4 shot olabilir")));
      let uc_surup = KahveKurucu::new("mocha").surup("a").surup("b").surup("c").kur();
      assert_eq!(uc_surup, Err(String::from("en fazla 2 şurup eklenebilir")));
  }

  #[test]
  fn bos_cesit_once_kontrol_edilir() {
      assert_eq!(
          KahveKurucu::new("   ").kur(),
          Err(String::from("kahve çeşidi boş olamaz")),
          "Yalnızca boşluktan oluşan çeşit geçersiz"
      );
      let iki_hata = KahveKurucu::new("")
          .ekstra_shot().ekstra_shot().ekstra_shot().ekstra_shot()
          .kur();
      assert_eq!(
          iki_hata,
          Err(String::from("kahve çeşidi boş olamaz")),
          "Birden çok hata varsa ilk kural (çeşit) raporlanmalı"
      );
  }
hints:
  - "Her ayar metodu aynı kalıpta: alanı değiştir, sonra `self` döndür. Örneğin `self.boy = boy; self`. Şurup için `self.surup.push(ad.to_string());`."
  - "`kur` içinde kuralları sırayla `if ... { return Err(String::from(\"...\")); }` biçiminde kontrol et. Boşluk kontrolü için `self.cesit.trim().is_empty()`."
  - "Bütün kontroller geçtiyse alanları taşıyarak `Ok(Kahve { cesit: self.cesit, boy: self.boy, shot: self.shot, sut: self.sut, surup: self.surup })` döndür."
explanation: |
  Kurucu, `Kahve`'nin **geçerli olmayan bir hâlde var olmasını** engelliyor: `Kahve` değerleri yalnızca
  `kur()`'dan geçerek doğar ve `kur()` bütün kuralları tek bir yerde denetler. Ayar metotları ise doğrulama
  yapmıyor; böylece sıra serbest kalıyor (`surup` önce, `boy` sonra) ve hatalar tek noktadan raporlanıyor.

  `ekstra_shot`'ta `saturating_add(1)` (Modül 2) `u8` taşmasını önler: biri 300 kez çağırsa bile panik
  olmaz, `kur()` zaten reddeder. `self.shot += 1` da testleri geçer, ama hata ayıklama modunda 255'ten sonra
  panik ederdi.

  `kur(self)` tüketen olduğu için `String` ve `Vec` alanları kopyalanmadan `Kahve`'ye taşındı. Gerçek bir
  projede `Kahve`'nin alanlarını gizleyip yalnızca getter'lar sunarak bu değişmezi daha da sağlamlaştırırdın.
  Alternatif bir tasarım, hataları `String` yerine bir enum (`SiparisHatasi::FazlaShot`) ile döndürmektir
  (Modül 10): çağıran taraf hatayı metin karşılaştırmadan `match` ile ayırt edebilir.
```

## Newtype: değişmezleri tipe kodlamak

Modül 6'da `struct Metre(f64)` gibi tek alanlı tuple struct'lara **newtype** dendiğini gördün. Asıl gücü,
bir değer hakkındaki bir **kuralı** (değişmez) tipin kendisine yüklemesidir. Şu imzayı düşün:

```rust,ignore
fn kayit_ol(eposta: String, yas: u8) { ... }
```

Her çağıran `eposta`'nın geçerli olduğunu kontrol etti mi? Bilemezsin; ya her fonksiyon tekrar kontrol eder ya
da biri unutur. Newtype ile kontrol **bir kez**, kurucuda yapılır ve tip bunun kanıtı olur:

```rust
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub struct Eposta(String); // alan gizli: dışarıdan Eposta("x".into()) yazılamaz

impl Eposta {
    pub fn new(metin: &str) -> Result<Eposta, String> {
        let metin = metin.trim().to_lowercase();
        let gecerli = match metin.split_once('@') {
            Some((ad, alan)) => !ad.is_empty() && alan.contains('.'),
            None => false,
        };
        if gecerli {
            Ok(Eposta(metin))
        } else {
            Err(format!("geçersiz e-posta: {metin}"))
        }
    }

    pub fn alan_adi(&self) -> &str {
        // Kurucu '@' olduğunu garanti etti; burada tekrar kontrol yok.
        match self.0.split_once('@') {
            Some((_, alan)) => alan,
            None => "",
        }
    }
}

impl fmt::Display for Eposta {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

fn hos_geldin_gonder(alici: &Eposta) {
    // Parametre tipi zaten "geçerli e-posta" demek.
    println!("{alici} adresine gönderildi ({})", alici.alan_adi());
}

fn main() {
    for girdi in ["  Zeynep@Ornek.com.tr ", "zeynep.ornek.com", "@ornek.com"] {
        match Eposta::new(girdi) {
            Ok(e) => hos_geldin_gonder(&e),
            Err(hata) => println!("{hata}"),
        }
    }
}
```

Bu yaklaşımın adı **“doğrulama, ayrıştır” (parse, don't validate)**: ham veriyi bir `bool` döndüren kontrolden
geçirmek yerine, daha **zengin bir tipe dönüştür**. Dönüşüm başarısız olabilir (`Result`), ama başarılıysa
elindeki tip artık kuralın kanıtıdır. `hos_geldin_gonder` geçersiz bir e-posta alamaz; çünkü geçersiz bir
`Eposta` **var olamaz**. Bu, 1. dersteki kapsüllemenin ve geçen dersteki “geçersiz durumları temsil edilemez
yap” fikrinin küçük ölçekli hâlidir. (Yeni bir metot: `split_once('@')` metni ilk `@`'den ikiye böler ve
`Option<(&str, &str)>` döndürür; `@` yoksa `None`.)

:::analogy Kimlik kartı
Bankaya her gittiğinde nüfus müdürlüğüne gidip “Bu kişi gerçekten Ayşe mi?” diye sorulmaz. Kimlik doğrulaması
**bir kez**, kart basılırken yapılır; sonra kartın kendisi kanıttır. Newtype de böyledir: `Eposta::new` nüfus
müdürlüğü, `Eposta` değeri ise kimlik kartı. Kartı taşıyan her fonksiyon tekrar kontrol yapmaz.
:::

Peki bu sarmalayıcı bellekte ne kadar yer kaplar? Tahmin et:

```predict
code: |
  use std::mem::size_of;

  struct Metre(f64);
  struct OgrenciNo(u32);

  fn main() {
      println!(
          "{} {} {} {}",
          size_of::<f64>(),
          size_of::<Metre>(),
          size_of::<OgrenciNo>(),
          size_of::<[Metre; 3]>()
      );
  }
options:
  - "8 8 4 24"
  - "8 16 8 48"
  - "8 24 16 72"
  - "8 8 4 32"
answer: 0
explanation: |
  Newtype'ın **çalışma zamanı maliyeti sıfırdır**: tek alanlı bir struct, bellekte o alanın kendisi kadar yer
  tutar. Java ya da Python'daki gibi her nesnenin başında bir başlık (object header) yoktur. `[Metre; 3]` de
  `[f64; 3]` ile aynıdır: 24 bayt. Tip güvenliği yalnızca **derleme zamanında** vardır; derlenmiş kodda
  `Metre` ile `f64` arasında hiçbir fark kalmaz.
```

```memory
title: "Newtype bellekte: Metre(f64) ile f64"
steps:
  - caption: "`let a: f64 = 3.5;` ve `let b = Metre(3.5);` stack'te aynı 8 baytı kaplar; `Metre` için ek başlık ya da işaretçi yok."
    stack:
      - frame: main
        vars:
          - { name: a, type: f64, value: "3.5 (8 bayt)" }
          - { name: b, type: Metre, value: "3.5 (8 bayt)", note: "aynı düzen" }
  - caption: "`let e = Eposta::new(..)?;` ise içindeki `String` kadar yer tutar: stack'te işaretçi · uzunluk · kapasite, karakterler heap'te."
    stack:
      - frame: main
        vars:
          - { name: e, type: Eposta, value: "ptr · len=19 · cap=19", to: h1 }
    heap:
      - { id: h1, value: "zeynep@ornek.com.tr" }
```

Newtype'ın ikinci görevi Modül 11'de karşılaştığın **orphan kuralını** aşmaktır. Hatırla:

```compiles
code: |
  use std::fmt;

  impl fmt::Display for Vec<String> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "[{}]", self.join(", "))
      }
  }

  fn main() {
      let v = vec![String::from("elma"), String::from("armut")];
      println!("{v}");
  }
answer: false
error: E0117
explanation: |
  Orphan kuralı: bir trait'i bir tipe uygulamak için **trait'in ya da tipin** senin crate'inde tanımlanmış olması
  gerekir. `Display` de `Vec` de standart kütüphaneden. Kural olmasaydı iki farklı crate aynı `impl`'i
  yazabilir ve hangisinin geçerli olduğu belirsizleşirdi (tutarlılık, coherence).
```

Çözüm: `Vec<String>`'i **kendi** tipine sar. Artık tip senin, `impl` serbest:

```rust
use std::fmt;

struct AlisverisListesi(Vec<String>);

impl fmt::Display for AlisverisListesi {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for (i, urun) in self.0.iter().enumerate() {
            writeln!(f, "{}. {urun}", i + 1)?;
        }
        Ok(())
    }
}

fn main() {
    let liste = AlisverisListesi(vec![
        String::from("simit"),
        String::from("beyaz peynir"),
        String::from("çay"),
    ]);
    print!("{liste}");
    println!("Toplam {} ürün", liste.0.len());
}
```

Bedeli: `AlisverisListesi` artık `Vec`'in metotlarına sahip değil (`liste.push(..)` yok); ya `liste.0` ile içe
erişirsin ya da gereken metotları kendin yazarsın. Modül 17'deki `Deref`'i uygulayıp bütün `Vec` metotlarını
geri kazanmak cazip gelir, ama dikkat: **`DerefMut` de verirsen değişmezini korumanın anlamı kalmaz** (kullanıcı
`&mut Vec` alıp istediğini yazar). Değişmezi olan bir newtype'ta yalnızca ihtiyaç duyulan metotları
kendin sunman en sağlam yoldur. Newtype'ın orphan kuralıyla ilişkisini Modül 22'de daha derinlemesine
göreceksin.

## Alıştırma: plaka newtype'ı

```exercise
id: m20-l05-e-plaka
title: Doğrulanmış araç plakası
difficulty: 4
prompt: |
  Bir otopark uygulaması için `Plaka` newtype'ını yaz. Gizli alanında plakanın **normalleştirilmiş** hâlini
  (`"34 ABC 123"` biçiminde) tutar. `Plaka::new(metin)` şu kurallarla `Result<Plaka, String>` döndürür:

  1. Metin boşluklara göre (`split_whitespace`) **tam üç** parçaya ayrılmalı; değilse
     `Err("plaka üç parçadan oluşmalı")`.
  2. İl kodu **tam 2 rakam** olmalı ve değeri **01-81** arasında olmalı; değilse `Err("geçersiz il kodu")`.
  3. Harf grubu **1-3 ASCII harf** olmalı; küçük harfler büyütülür. Değilse `Err("geçersiz harf grubu")`.
  4. Numara **2-4 rakam** olmalı; değilse `Err("geçersiz numara")`.

  Kurallar bu sırayla kontrol edilir. Ayrıca `il_kodu()` il kodunu `u8` olarak döndürsün (`"06 ..."` → `6`) ve
  `Display` normalleştirilmiş metni yazdırsın.
starter: |
  use std::fmt;

  #[derive(Debug, Clone, PartialEq)]
  pub struct Plaka(String);

  impl Plaka {
      pub fn new(metin: &str) -> Result<Plaka, String> {
          todo!()
      }

      pub fn il_kodu(&self) -> u8 {
          todo!()
      }
  }

  impl fmt::Display for Plaka {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      for girdi in ["34 abc 123", "  06  AB   1234 ", "82 A 12", "35 A 1"] {
          match Plaka::new(girdi) {
              Ok(p) => println!("{p} (il {})", p.il_kodu()),
              Err(e) => println!("{girdi:?}: {e}"),
          }
      }
  }
solution: |
  use std::fmt;

  #[derive(Debug, Clone, PartialEq)]
  pub struct Plaka(String);

  impl Plaka {
      pub fn new(metin: &str) -> Result<Plaka, String> {
          let parcalar: Vec<&str> = metin.split_whitespace().collect();
          if parcalar.len() != 3 {
              return Err(String::from("plaka üç parçadan oluşmalı"));
          }
          let (il, harfler, numara) = (parcalar[0], parcalar[1], parcalar[2]);

          let il_gecerli = il.len() == 2 && il.chars().all(|c| c.is_ascii_digit());
          let il_degeri: u8 = if il_gecerli { il.parse().unwrap_or(0) } else { 0 };
          if !(1..=81).contains(&il_degeri) {
              return Err(String::from("geçersiz il kodu"));
          }

          let harf_sayisi = harfler.chars().count();
          if !(1..=3).contains(&harf_sayisi) || !harfler.chars().all(|c| c.is_ascii_alphabetic()) {
              return Err(String::from("geçersiz harf grubu"));
          }

          let rakam_sayisi = numara.chars().count();
          if !(2..=4).contains(&rakam_sayisi) || !numara.chars().all(|c| c.is_ascii_digit()) {
              return Err(String::from("geçersiz numara"));
          }

          Ok(Plaka(format!("{il} {} {numara}", harfler.to_ascii_uppercase())))
      }

      pub fn il_kodu(&self) -> u8 {
          // Kurucu ilk iki karakterin rakam olduğunu garanti ediyor.
          self.0[..2].parse().expect("Plaka::new geçerli il kodu garanti eder")
      }
  }

  impl fmt::Display for Plaka {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{}", self.0)
      }
  }

  fn main() {
      for girdi in ["34 abc 123", "  06  AB   1234 ", "82 A 12", "35 A 1"] {
          match Plaka::new(girdi) {
              Ok(p) => println!("{p} (il {})", p.il_kodu()),
              Err(e) => println!("{girdi:?}: {e}"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_plakalar_normallestirilir() {
      let p = Plaka::new("  06  ab   1234 ").expect("geçerli plaka");
      assert_eq!(p.to_string(), "06 AB 1234", "Fazla boşluklar atılmalı, harfler büyümeli");
      assert_eq!(p.il_kodu(), 6, "\"06\" il kodu 6 olmalı");
      let q = Plaka::new("81 z 99").expect("geçerli plaka");
      assert_eq!(q.to_string(), "81 Z 99");
      assert_eq!(q.il_kodu(), 81);
  }

  #[test]
  fn parca_sayisi() {
      assert_eq!(Plaka::new("34ABC123"), Err(String::from("plaka üç parçadan oluşmalı")));
      assert_eq!(Plaka::new("34 AB C 12"), Err(String::from("plaka üç parçadan oluşmalı")));
      assert_eq!(Plaka::new(""), Err(String::from("plaka üç parçadan oluşmalı")));
  }

  #[test]
  fn il_kodu_kurallari() {
      let hata = Err(String::from("geçersiz il kodu"));
      assert_eq!(Plaka::new("00 A 12"), hata, "00 diye bir il yok");
      assert_eq!(Plaka::new("82 A 12"), hata, "81'den büyük il kodu geçersiz");
      assert_eq!(Plaka::new("6 A 12"), hata, "İl kodu tam 2 rakam olmalı");
      assert_eq!(Plaka::new("3x A 12"), hata, "İl kodu yalnızca rakam olmalı");
  }

  #[test]
  fn harf_ve_numara_kurallari() {
      assert_eq!(Plaka::new("34 ABCD 12"), Err(String::from("geçersiz harf grubu")), "En fazla 3 harf");
      assert_eq!(Plaka::new("34 A1 12"), Err(String::from("geçersiz harf grubu")), "Harf grubunda rakam olamaz");
      assert_eq!(Plaka::new("34 ÇA 12"), Err(String::from("geçersiz harf grubu")), "Yalnızca ASCII harfler");
      assert_eq!(Plaka::new("34 A 1"), Err(String::from("geçersiz numara")), "Numara en az 2 rakam");
      assert_eq!(Plaka::new("34 A 12345"), Err(String::from("geçersiz numara")), "Numara en çok 4 rakam");
      assert_eq!(Plaka::new("34 A 1B"), Err(String::from("geçersiz numara")));
  }
hints:
  - "Önce parçaları topla: `let parcalar: Vec<&str> = metin.split_whitespace().collect();` Sonra `if parcalar.len() != 3 { return Err(...) }` ve `let il = parcalar[0];` vb."
  - "İl için: `il.len() == 2 && il.chars().all(|c| c.is_ascii_digit())` kontrolünden sonra `let n: u8 = il.parse().unwrap();` ve `(1..=81).contains(&n)`. Harfler için `chars().count()` ve `is_ascii_alphabetic()`, büyütmek için `to_ascii_uppercase()`."
  - "Sonunda `Ok(Plaka(format!(\"{il} {} {numara}\", harfler.to_ascii_uppercase())))`. `il_kodu` için `self.0[..2].parse().unwrap()` yeterli: kurucu ilk iki baytın rakam olduğunu garanti etti. `Display` yalnızca `write!(f, \"{}\", self.0)`."
explanation: |
  Bütün doğrulama `new`'da toplandı; `il_kodu` ve `Display` hiç kontrol yapmıyor. Çünkü alan gizli ve bir
  `Plaka` değerine sahipsen o değer **mutlaka** `new`'dan geçmiştir. `il_kodu` içindeki `expect`, Modül 10'daki
  “derleyiciden fazlasını bildiğinde gerekçeli `expect`” kuralının tipik örneği: gerekçe tipin değişmezi.
  `self.0[..2]` dilimlemesi de güvenli, çünkü ilk iki karakterin ASCII rakam (1'er bayt) olduğunu biliyoruz.

  Parça kontrolünü bir sonraki modülde göreceğin **dilim desenleriyle** (slice patterns) daha kısa yazabilirsin:
  `let [il, harfler, numara] = parcalar[..] else { return Err(..); };` dilim tam üç elemanlıysa üçünü birden
  bağlar, değilse Modül 7'deki `let else`'in `else` koluna düşer.

  Neden `is_alphabetic()` değil de `is_ascii_alphabetic()`? Türk plakalarında Ç, Ş, Ğ gibi harfler kullanılmaz.
  `is_alphabetic()` Unicode harflerin tümünü kabul ederdi. Aynı sebeple `to_uppercase()` yerine
  `to_ascii_uppercase()` kullandık: yalnızca ASCII harflere dokunduğunu açıkça söyler. Modül 9'da gördüğün
  Unicode büyük/küçük harf sürprizleri (`"istanbul".to_uppercase()` → `"ISTANBUL"`) böylece baştan konu dışı
  kalır.

  `#[derive(PartialEq)]` sayesinde iki plaka karşılaştırılabiliyor. Normalleştirme yapıldığı için `"34 abc 123"`
  ile `" 34 ABC  123"` **eşit** plakalar: bir otopark sisteminde aynı aracın iki kaydı oluşmaz.
```

## Özet

:::remember
- Rust'ta isimli/varsayılan argüman ve kurucu aşırı yüklemesi yok; yerine **`Default`**, **builder** ve
  **newtype** var.
- `#[derive(Default)]` her alana tipinin varsayılanını koyar; anlamlı varsayılanlar için `impl Default`'u
  elle yaz. Enum'larda `#[default]` varyantı seçer. `Ayar { port: 3000, ..Default::default() }`.
- `..kaynak` yazılmayan alanları kaynaktan **taşır**; kaynağı kısmen taşınmış bırakabilir (E0382).
- **Tüketen builder**: `fn ayar(mut self, ..) -> Self`, `fn kur(self)`: alanlar taşınır, koşullu ayar için
  yeniden bağlama gerekir. **Tüketmeyen builder**: `fn ayar(&mut self, ..) -> &mut Self`: koşullu ayar kolay,
  kurucu yeniden kullanılabilir; geçiciyi `let`'e bağlamazsan **E0716**.
- Doğrulamayı `kur()`'da ya da newtype kurucusunda **tek bir kapıda** topla: “parse, don't validate”.
- **Newtype**: sıfır maliyetli tek alanlı sarmalayıcı; alanı gizliyse değişmezin kanıtıdır. Orphan kuralını
  (E0117) aşmak için de kullanılır. Değişmezli bir newtype'a `DerefMut` verme.
:::

```reflect
prompt: |
  Bir arkadaşın “Her fonksiyonun başında `if !eposta.contains('@') { return Err(..) }` yazıyorum, newtype'a ne
  gerek var?” diyor. Ona newtype'ın (ve “parse, don't validate” fikrinin) neyi daha iyi yaptığını açıkla.
answer: |
  Kontrolü her fonksiyona dağıtmak hem tekrar hem risk: biri unutursa geçersiz veri sistemin içine sızar ve
  hata çok uzakta ortaya çıkar. Ayrıca kontroller zamanla birbirinden farklılaşabilir (biri trim yapar, öteki
  yapmaz).

  Newtype ile doğrulama bir kez, kurucuda yapılır. Alan gizli olduğu için geçerli olmayan bir `Eposta` değeri
  oluşturulamaz; bu yüzden `&Eposta` alan her fonksiyon kontrolsüz çalışabilir ve imzası bile “bana geçerli
  e-posta ver” der. Derleyici, ham bir `String`'in yanlışlıkla `Eposta` yerine geçmesini de engeller. Üstelik
  bütün bunların çalışma zamanı maliyeti sıfırdır.
```

```flashcards
- front: "`Ayar { port: 3000, ..Default::default() }` ne yapar?"
  back: "`port`'u 3000 yapar; yazılmayan bütün alanları `Ayar::default()`'tan alır (struct güncelleme sözdizimi)."
- front: Bir enum için `#[derive(Default)]` kullanırken hangi varyantın varsayılan olacağı nasıl seçilir?
  back: "Varyantın üstüne `#[default]` niteliği yazılır (veri taşımayan bir varyant olmalı)."
- front: Tüketen builder'ın ayar metodu imzası nasıldır?
  back: "`fn ayar(mut self, deger: T) -> Self`: kurucuyu sahiplenir, değiştirir, geri döndürür. `kur(self)` alanları taşır."
- front: Tüketmeyen builder'ın tüketen builder'a göre iki avantajı nedir?
  back: "Koşullu ayar yeniden bağlama gerektirmez (`k.ayar(..);`) ve `kur(&self)` sonrası kurucu tekrar kullanılabilir."
- front: "`let k = Kurucu::new().ayar(1);` (ayar `&mut Self` döndürüyor) neden E0716 verir?"
  back: Geçici `Kurucu` ifadenin sonunda drop edilir ama `k` ona referans olarak kalır. Önce `let mut k = Kurucu::new();` ile bağlamak gerekir.
- front: "“Parse, don't validate” ne demektir?"
  back: Veriyi `bool` döndüren bir kontrolden geçirmek yerine, başarısız olabilen bir dönüşümle değişmezi taşıyan daha zengin bir tipe (newtype) çevirmek.
- front: "`size_of::<Metre>()` (`struct Metre(f64)`) kaç bayttır ve neden?"
  back: 8 bayt. Newtype'ın çalışma zamanı maliyeti yoktur; tek alanlı struct o alan kadar yer kaplar.
- front: Değişmezi olan bir newtype'a neden `DerefMut` uygulamamalısın?
  back: "Kullanıcı iç değere `&mut` erişip kurucunun koruduğu kuralı çiğneyebilir; değişmez anlamsızlaşır."
```
