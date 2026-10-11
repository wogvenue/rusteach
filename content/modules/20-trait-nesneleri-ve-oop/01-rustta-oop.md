---
id: m20-l01
title: Rust'ta nesne yönelimli programlama
minutes: 20
type: lesson
objectives:
  - Nesne yönelimli programlamanın (OOP) kapsülleme, kalıtım ve çok biçimlilik fikirlerinin Rust'taki karşılıklarını açıklayabilmek
  - Gizli alanlar ve `pub` metotlarla değişmezini (invariant) koruyan kapsüllenmiş bir tip yazabilmek
  - Kalıtım yerine kompozisyon ve trait varsayılan metotlarıyla kodu yeniden kullanabilmek
  - Kırılgan taban sınıf (fragile base class) sorununu bir örnekle anlatabilmek
keywords: [OOP, nesne yönelimli, kapsülleme, kalıtım, kompozisyon, çok biçimlilik, E0616, E0451]
---

Java ya da C# bilen bir arkadaşın sana soruyor: *“Rust nesne yönelimli bir dil mi? Sınıf yok, `extends`
yok... Peki büyük programları nasıl düzenliyorsunuz?”* Cevap, “nesne yönelimli”den ne kastettiğine bağlı.

Nesne yönelimli programlamanın (**OOP, object-oriented programming**) tek bir resmî tanımı yoktur, ama
herkesin aklına üç fikir gelir: **kapsülleme**, **kalıtım** ve **çok biçimlilik**. Rust bunlardan ikisini
kendi yoluyla sunar, birini ise **bilerek** dışarıda bırakır. Bu derste hangisinin neden dışarıda kaldığını
ve yerine neyin geldiğini göreceksin. Modülün geri kalanı (trait nesneleri, dispatch, tasarım desenleri)
bu temelin üzerine kurulacak.

## Nesne = veri + davranış

OOP'nin en temel fikri şudur: bir **nesne (object)**, veriyi ve o veri üzerinde çalışan işlemleri
(metotları) bir paket hâlinde bir araya getirir. Bu tanıma göre Rust'ta nesneleri zaten Modül 6'dan beri
yazıyorsun: veri `struct` (ya da `enum`) içinde, davranış `impl` bloğunda durur.

```rust
struct BankaHesabi {
    sahip: String,
    bakiye: u64, // kuruş
}

impl BankaHesabi {
    fn new(sahip: &str) -> BankaHesabi {
        BankaHesabi { sahip: String::from(sahip), bakiye: 0 }
    }

    fn yatir(&mut self, tutar: u64) {
        self.bakiye += tutar;
    }

    fn cek(&mut self, tutar: u64) -> Result<(), String> {
        if tutar > self.bakiye {
            return Err(format!("Yetersiz bakiye: {} kuruş eksik", tutar - self.bakiye));
        }
        self.bakiye -= tutar;
        Ok(())
    }

    fn ozet(&self) -> String {
        format!("{}: {} kuruş", self.sahip, self.bakiye)
    }
}

fn main() {
    let mut hesap = BankaHesabi::new("Zeynep");
    hesap.yatir(50_000);
    match hesap.cek(80_000) {
        Ok(()) => println!("Para çekildi"),
        Err(e) => println!("Hata: {e}"),
    }
    hesap.cek(20_000).unwrap();
    println!("{}", hesap.ozet());
}
```

Java'daki bir `class BankaHesabi` ile neredeyse aynı şey: alanlar, bir kurucu (`new`), durumu değiştiren
metotlar (`&mut self`) ve yalnızca okuyan metotlar (`&self`). Farkı, Rust'ta veri tanımı (`struct`) ile
davranışın (`impl`) **ayrı bloklarda** yazılmasıdır; bir tipin birden fazla `impl` bloğu olabilir ve
trait'ler de bu bloklardan biri olarak eklenir.

```quiz
question: |
  (Modül 6 tekrarı) `BankaHesabi`'ye bir `fn kapat(...)` metodu eklemek istiyorsun: hesap kapatılınca
  nesne **bir daha kullanılamamalı**. Hangi alıcı (receiver) bunu derleme zamanında garanti eder?
options:
  - "`&self`"
  - "`&mut self`"
  - "`self`"
  - "Hiçbiri; Rust'ta bunu derleyiciye söylemenin yolu yok"
answer: 2
explanation: |
  `self` (sahiplenerek) alan bir metot, nesneyi **tüketir**: çağrıdan sonra `hesap` taşınmış olur ve tekrar
  kullanmak `E0382` verir (Modül 4). `&self` ve `&mut self` yalnızca ödünç alır; nesne çağrıdan sonra da
  yaşamaya devam eder. Bu küçük ayrıntı, modülün ilerisinde göreceğin **typestate** deseninin temelidir:
  “kullanıldıktan sonra yok olan” işlemleri tip sistemiyle ifade etmek.
feedback:
  - "`&self` yalnızca okur; hesap çağrıdan sonra da kullanılabilir."
  - "`&mut self` değiştirebilir ama sahipliği almaz; hesap hâlâ yaşar."
  - Doğru!
  - "Var: sahipliği alan `self` alıcısı tam olarak bunu söyler."
```

## Kapsülleme: içeriyi gizle, sözleşmeyi göster

**Kapsülleme (encapsulation)**, bir tipin iç ayrıntılarını gizleyip dışarıya yalnızca seçilmiş bir
arayüz (public API) açmaktır. Neden önemli? Çünkü çoğu tipin bir **değişmezi (invariant)** vardır: her
zaman doğru olması gereken bir kural. Aşağıdaki not defteri ortalamayı her seferinde baştan hesaplamamak
için onu bir alanda **önbellekte** tutuyor. Değişmez: *`ortalama` alanı her zaman `notlar`'ın gerçek
ortalamasıdır.*

```rust
mod okul {
    pub struct NotDefteri {
        notlar: Vec<u32>, // gizli (private)
        ortalama: f64,    // gizli (private)
    }

    impl NotDefteri {
        pub fn new() -> NotDefteri {
            NotDefteri { notlar: Vec::new(), ortalama: 0.0 }
        }

        pub fn ekle(&mut self, not: u32) {
            self.notlar.push(not);
            self.ortalamayi_guncelle();
        }

        pub fn son_notu_sil(&mut self) -> Option<u32> {
            let silinen = self.notlar.pop()?;
            self.ortalamayi_guncelle();
            Some(silinen)
        }

        pub fn ortalama(&self) -> f64 {
            self.ortalama
        }

        // pub değil: yalnızca bu modülün içinden çağrılabilir
        fn ortalamayi_guncelle(&mut self) {
            if self.notlar.is_empty() {
                self.ortalama = 0.0;
                return;
            }
            let toplam: u32 = self.notlar.iter().sum();
            self.ortalama = toplam as f64 / self.notlar.len() as f64;
        }
    }
}

fn main() {
    let mut defter = okul::NotDefteri::new();
    defter.ekle(70);
    defter.ekle(85);
    defter.ekle(90);
    println!("Ortalama: {:.2}", defter.ortalama());
    let silinen = defter.son_notu_sil();
    println!("Silinen: {silinen:?}, yeni ortalama: {:.2}", defter.ortalama());
}
```

`NotDefteri` struct'ı `pub` ama alanları değil. Dışarıdaki kod notları yalnızca `ekle` ve `son_notu_sil`
ile değiştirebilir; ikisi de ortalamayı günceller. Böylece değişmez **asla bozulamaz**. Peki biri
alanlara doğrudan ulaşmaya çalışırsa?

```compiles
question: "(Modül 8 tekrarı) Yukarıdaki `okul` modülü aynen duruyor. Bu `main` derlenir mi?"
code: |
  # mod okul {
  #     pub struct NotDefteri {
  #         notlar: Vec<u32>,
  #         ortalama: f64,
  #     }
  #     impl NotDefteri {
  #         pub fn new() -> NotDefteri {
  #             NotDefteri { notlar: Vec::new(), ortalama: 0.0 }
  #         }
  #         pub fn ortalama(&self) -> f64 {
  #             self.ortalama
  #         }
  #     }
  # }
  fn main() {
      let mut defter = okul::NotDefteri::new();
      defter.notlar.push(100); // ortalamayı güncellemeden ekle!
      println!("{}", defter.ortalama());
  }
answer: false
error: E0616
explanation: |
  Derlenmez: `notlar` alanı **gizli (private)**. Rust'ta her öğe varsayılan olarak gizlidir; bir alanı
  dışarıya açmak için onu ayrıca `pub` yapman gerekir (Modül 8). Struct'ın kendisinin `pub` olması
  alanlarını açmaz. İşte değişmezi koruyan da bu kural: ortalamayı güncellemeden not eklemenin hiçbir
  yolu yok.
```

:::error
```text
error[E0616]: field `notlar` of struct `NotDefteri` is private
  --> src/main.rs:17:12
   |
17 |     defter.notlar.push(100); // ortalamayı güncellemeden ekle!
   |            ^^^^^^ private field
```
Yakın akrabası **E0451**: gizli alanı olan bir struct'ı modül dışında süslü parantezle kurmaya çalışırsan
(`okul::NotDefteri { notlar: vec![], ortalama: 0.0 }`) ``fields `notlar` and `ortalama` of struct `NotDefteri` are
private`` alırsın. Gizli alanlı bir tip, dışarıdan yalnızca senin verdiğin kurucularla (`new`) oluşturulabilir. Bu
da Modül 10'da gördüğün “geçersiz değer hiç oluşmasın” fikrinin anahtarıdır.
:::

Kapsüllemenin ikinci büyük faydası **değişime açıklık**tır. Yarın ortalamayı önbellekte tutmak yerine
`toplam` ve `adet` alanları tutmaya karar verirsen, yalnızca `okul` modülünün içini değiştirirsin. Dışarıdaki
hiçbir kod kırılmaz, çünkü kimse alanlara bağımlı değildi; herkes `ortalama()` metodunu çağırıyordu.

:::analogy Bankamatik
Bankamatiğin önünde sadece bir ekran, birkaç tuş ve kart yuvası görürsün. Kasanın nasıl kilitlendiğini,
paranın hangi bölmede durduğunu, kayıtların nereye yazıldığını bilmezsin ve bilmen de gerekmez. Banka
içerideki mekanizmayı tamamen değiştirebilir; sen yine aynı tuşlara basarsın. Kasaya doğrudan uzanabilseydin
hem para hem kayıtlar tutarsız hâle gelirdi. `pub` metotlar tuşlardır, gizli alanlar da kasanın içi.
:::

Diğer dillerle karşılaştırınca: Java ve C++'ta `private` **sınıf** düzeyindedir; Rust'ta gizlilik **modül**
düzeyindedir: aynı modüldeki her kod gizli alanları görebilir (bu yüzden testler `use super::*` ile içeri
bakabilir). Python'da ise gizlilik yalnızca bir adlandırma geleneğidir (`_bakiye`): derleyici ya da yorumlayıcı
seni durdurmaz. Rust'ta gizlilik bir **derleyici garantisidir**.

```exercise
id: m20-l01-e-termostat
title: Sınırlarını bilen termostat
difficulty: 2
prompt: |
  Akıllı ev uygulaman için bir `Termostat` yaz. Hedef sıcaklık **her zaman 16 ile 28 °C arasında**
  (sınırlar dahil) olmalı; bu, tipin değişmezidir. `hedef` alanı gizli kalmalı ve değişmez dışarıdan hiçbir
  şekilde bozulamamalı.

  `ev` modülündeki metotları tamamla:
  - `new(hedef)`: aralık dışındaki değeri en yakın sınıra **kırp**: `new(35)` → 28, `new(5)` → 16.
  - `hedef()`: mevcut hedefi döndür.
  - `artir()` / `azalt()`: hedefi 1 derece değiştir; sınırda ise **hiçbir şey yapma**.
  - `ayarla(deger)`: değer aralıktaysa kabul et ve `Ok(())` döndür. Değilse hedefi **değiştirme** ve
    `Err("40°C izin verilen aralığın dışında (16-28)")` biçiminde bir mesaj döndür.
starter: |
  mod ev {
      pub const EN_AZ: i32 = 16;
      pub const EN_COK: i32 = 28;

      pub struct Termostat {
          hedef: i32,
      }

      impl Termostat {
          pub fn new(hedef: i32) -> Termostat {
              todo!()
          }

          pub fn hedef(&self) -> i32 {
              todo!()
          }

          pub fn artir(&mut self) {
              todo!()
          }

          pub fn azalt(&mut self) {
              todo!()
          }

          pub fn ayarla(&mut self, deger: i32) -> Result<(), String> {
              todo!()
          }
      }
  }

  fn main() {
      let mut t = ev::Termostat::new(35);
      println!("Başlangıç: {}°C", t.hedef());
      t.azalt();
      println!("Azaltınca: {}°C", t.hedef());
      if let Err(e) = t.ayarla(40) {
          println!("Hata: {e}");
      }
  }
solution: |
  mod ev {
      pub const EN_AZ: i32 = 16;
      pub const EN_COK: i32 = 28;

      pub struct Termostat {
          hedef: i32,
      }

      impl Termostat {
          pub fn new(hedef: i32) -> Termostat {
              let hedef = if hedef < EN_AZ {
                  EN_AZ
              } else if hedef > EN_COK {
                  EN_COK
              } else {
                  hedef
              };
              Termostat { hedef }
          }

          pub fn hedef(&self) -> i32 {
              self.hedef
          }

          pub fn artir(&mut self) {
              if self.hedef < EN_COK {
                  self.hedef += 1;
              }
          }

          pub fn azalt(&mut self) {
              if self.hedef > EN_AZ {
                  self.hedef -= 1;
              }
          }

          pub fn ayarla(&mut self, deger: i32) -> Result<(), String> {
              if deger < EN_AZ || deger > EN_COK {
                  return Err(format!(
                      "{deger}°C izin verilen aralığın dışında ({EN_AZ}-{EN_COK})"
                  ));
              }
              self.hedef = deger;
              Ok(())
          }
      }
  }

  fn main() {
      let mut t = ev::Termostat::new(35);
      println!("Başlangıç: {}°C", t.hedef());
      t.azalt();
      println!("Azaltınca: {}°C", t.hedef());
      if let Err(e) = t.ayarla(40) {
          println!("Hata: {e}");
      }
  }
check: tests
tests: |
  #[test]
  fn yeni_termostat_sinirlara_kirpilir() {
      assert_eq!(ev::Termostat::new(35).hedef(), 28, "35°C üst sınır olan 28'e kırpılmalı");
      assert_eq!(ev::Termostat::new(5).hedef(), 16, "5°C alt sınır olan 16'ya kırpılmalı");
      assert_eq!(ev::Termostat::new(22).hedef(), 22, "Aralıktaki değer olduğu gibi kalmalı");
  }

  #[test]
  fn artir_ve_azalt_sinirda_durur() {
      let mut t = ev::Termostat::new(27);
      t.artir();
      assert_eq!(t.hedef(), 28, "27'den bir artınca 28 olmalı");
      t.artir();
      assert_eq!(t.hedef(), 28, "28'de artir() hiçbir şey yapmamalı");
      let mut s = ev::Termostat::new(17);
      s.azalt();
      s.azalt();
      assert_eq!(s.hedef(), 16, "16'nın altına inilmemeli");
  }

  #[test]
  fn ayarla_gecerli_degeri_kabul_eder() {
      let mut t = ev::Termostat::new(22);
      assert_eq!(t.ayarla(16), Ok(()), "16 sınır değeri geçerlidir");
      assert_eq!(t.hedef(), 16);
      assert_eq!(t.ayarla(28), Ok(()), "28 sınır değeri geçerlidir");
      assert_eq!(t.hedef(), 28);
  }

  #[test]
  fn ayarla_gecersiz_degerde_hedefi_degistirmez() {
      let mut t = ev::Termostat::new(22);
      let sonuc = t.ayarla(40);
      assert!(sonuc.is_err(), "40°C reddedilmeli");
      assert!(sonuc.unwrap_err().contains("40"), "Hata mesajı reddedilen değeri içermeli");
      assert!(t.ayarla(15).is_err(), "15°C reddedilmeli");
      assert_eq!(t.hedef(), 22, "Reddedilen ayardan sonra hedef değişmemeli");
  }
hints:
  - "Değişmezi koruyan her yer bir sınır kontrolüdür: `if deger < EN_AZ || deger > EN_COK { ... }`."
  - "`new` içinde `if/else if/else` ile kırpılmış değeri hesapla, sonra `Termostat { hedef }` döndür (alan kısaltması). `artir` için: `if self.hedef < EN_COK { self.hedef += 1; }`."
  - "`ayarla`'da önce kontrol et ve hatalıysa hemen `return Err(format!(\"{deger}°C izin verilen aralığın dışında ({EN_AZ}-{EN_COK})\"));` yaz; geçerliyse alanı güncelleyip `Ok(())` döndür."
forbid:
  - pattern: "pub\\s+hedef\\s*:"
    message: "`hedef` alanı gizli kalmalı, kapsüllemenin bütün amacı bu!"
explanation: |
  Değişmez, `Termostat`'ın **tek giriş kapısı** olan metotlarda korunuyor: kurucu kırpıyor, `artir`/`azalt`
  sınırda duruyor, `ayarla` geçersiz değeri reddediyor. `hedef` gizli olduğu için `ev` modülü dışındaki
  hiçbir kod (testler dahil) `t.hedef = 99` yazamaz. Bu yüzden testler yalnızca public API'yi kullandı.

  `ayarla`'da önce **bütün kontrolleri** yapıp durumu ancak sonra değiştirmek (Modül 10'daki atomiklik
  fikri) önemli: hata durumunda nesne eski, geçerli hâlinde kalır.

  Alternatif: `new` içinde `hedef.clamp(EN_AZ, EN_COK)` tek satırda aynı işi yapar (`Ord` trait'inin bir
  metodu). Daha da güçlü bir tasarım, sıcaklığın kendisini bir **newtype** yapmaktır: `Sicaklik(i32)` yalnızca
  geçerli değerlerle kurulabilirse, onu alan her fonksiyon kontrol yapmaktan kurtulur. Bunu 5. derste
  göreceksin.
```

## Kalıtım yok: ve bu bilinçli bir karar

**Kalıtım (inheritance)**, bir sınıfın başka bir sınıfın alanlarını ve metotlarını devralmasıdır:
`class Kedi extends Hayvan`. Rust'ta bir struct'ın başka bir struct'tan alan ya da metot devralmasının
**hiçbir yolu yoktur**. Bu bir eksiklik değil, bir tasarım kararı. Nedenini anlamak için ünlü bir tuzağa
bakalım. Java'da bir alışveriş sepeti ve onu genişleterek eklenen ürün sayısını sayan bir alt sınıf:

```java
class Sepet {
    void ekle(String urun) { /* ürünü listeye koy */ }

    void hepsiniEkle(List<String> urunler) {
        for (String u : urunler) ekle(u);   // iç ayrıntı: ekle()'yi çağırıyor
    }
}

class SayanSepet extends Sepet {
    int sayac = 0;

    @Override void ekle(String urun) { sayac++; super.ekle(urun); }

    @Override void hepsiniEkle(List<String> urunler) {
        sayac += urunler.size();
        super.hepsiniEkle(urunler);         // her ürün İKİ kez sayılır!
    }
}
```

`hepsiniEkle` ile 3 ürün eklersin, `sayac` 6 olur. Alt sınıf, üst sınıfın `hepsiniEkle`'yi **içeride**
`ekle` ile yazdığını bilmiyordu. Hata düzeltilse bile kırılgandır: üst sınıfın yazarı yarın `hepsiniEkle`'yi
`ekle` çağırmadan yeniden yazarsa, alt sınıf bu kez de eksik sayar. Buna **kırılgan taban sınıf (fragile base
class)** sorunu denir: alt sınıflar, üst sınıfın yalnızca arayüzüne değil **uygulama ayrıntılarına** da
bağımlı hâle gelir ve üst sınıftaki masum bir değişiklik onları sessizce bozar.

Kalıtımın diğer bilinen dertleri:

- **İhtiyacından fazlasını devralmak**: `Kus extends Hayvan` yazarsın, ama `Penguen` de kuştur ve `uc()`
  metodu ona da gelir. Ezip `throw` etmek zorunda kalırsın.
- **Tek ve katı hiyerarşi**: bir tip yalnızca tek bir “aileye” ait olabilir (Java'da tek üst sınıf), C++'taki
  çoklu kalıtım ise “elmas problemi”ni (diamond problem) getirir.
- **Derin hiyerarşiler**: bir metodun gerçekte nerede tanımlandığını bulmak için beş sınıf yukarı çıkmak.

:::analogy Soy ağacı ve Lego
Kalıtım bir **soy ağacıdır**: dedenin burnu sana geçer, istesen de istemesen de. Annenin ailesinden mi
babanınkinden mi geldiğini sonradan değiştiremezsin; ağacın yukarısındaki bir değişiklik herkesi etkiler.

Rust'ın yolu **Lego**'dur: tekerlek, motor, koltuk gibi bağımsız parçaları bir araya getirirsin
(**kompozisyon**) ve her parçaya hangi standartlara uyduğunu tek tek söylersin (**trait'ler**). Bir parçayı
değiştirmek diğerlerini bozmaz; yeni bir model için ağaç değil, yeni bir kombinasyon kurarsın.
:::

Bu yüzden modern OOP literatürü bile yıllardır “**kalıtım yerine kompozisyon** (composition over
inheritance)” der. Rust bu tavsiyeyi dilin kuralı yapmıştır. Kalıtımın iki meşru amacı (kodu yeniden
kullanmak ve çok biçimlilik) için Rust ayrı, daha keskin araçlar verir. Sıradaki iki bölüm bunları anlatıyor.

```quiz
question: Kırılgan taban sınıf (fragile base class) sorununun özü nedir?
options:
  - Üst sınıfın çok fazla alanı olması belleği şişirir
  - Alt sınıflar üst sınıfın uygulama ayrıntılarına bağımlı hâle gelir; üst sınıftaki masum bir değişiklik onları sessizce bozar
  - Üst sınıflar derleme zamanında kontrol edilemez, yalnızca çalışma anında hata verir
  - Alt sınıf üst sınıfın gizli (private) alanlarına erişemez
answer: 1
explanation: |
  `SayanSepet` örneğinde hiçbir derleme hatası yok, kod “doğru görünüyor”, ama sonuç yanlış. Çünkü alt
  sınıfın doğruluğu, üst sınıfın `hepsiniEkle`'yi **nasıl** yazdığına bağlı. Rust'ta trait'ler yalnızca
  **davranış sözleşmesi** tanımlar, veri ve uygulama ayrıntısı devralınmaz. Bu yüzden böyle gizli bir bağ
  kurulamaz.
feedback:
  - Sorun bellek değil, iki sınıf arasındaki gizli bağımlılık.
  - Doğru!
  - Java da üst sınıfları derleme zamanında kontrol eder; sorun mantıksal bir bağımlılık.
  - Bu kalıtımın bir özelliği, sorunun özü değil. Sorun, alt sınıfın üst sınıfın **davranış** ayrıntılarına bağımlı olması.
```

## Kodu yeniden kullanmak: varsayılan metotlar ve kompozisyon

Kalıtımın ilk amacı “aynı kodu tekrar yazmamak”tı. Rust'ta bunun iki aracı var.

**1) Trait varsayılan metotları (Modül 11):** Trait küçük bir çekirdek ister, geri kalan davranışı herkese
bedava verir. Bu, kalıtımdaki “üst sınıfta yazılmış metot”un karşılığıdır ama kırılgan değildir: varsayılan
metot yalnızca trait'in **açıkça ilan edilmiş** metotlarını çağırabilir, gizli bir uygulama ayrıntısına
dayanamaz.

**2) Kompozisyon (composition):** Bir tipi, başka tipleri **alan olarak içererek** kurarsın. “*Araba bir
Motordur*” (is-a) yerine “*Arabanın bir Motoru vardır*” (has-a). Ortak parça bir kez yazılır, onu içeren her
tip yeniden kullanır:

```rust
struct Motor {
    beygir: u32,
    calisiyor: bool,
}

impl Motor {
    fn new(beygir: u32) -> Motor {
        Motor { beygir, calisiyor: false }
    }

    fn calistir(&mut self) -> String {
        if self.calisiyor {
            return String::from("zaten çalışıyor");
        }
        self.calisiyor = true;
        format!("{} beygir motor çalıştı", self.beygir)
    }
}

struct Araba {
    model: String,
    motor: Motor, // kompozisyon: Araba'nın bir Motor'u VAR
}

struct Tekne {
    ad: String,
    motor: Motor,
}

impl Araba {
    fn yola_cik(&mut self) -> String {
        format!("{}: {}", self.model, self.motor.calistir()) // işi motora devret
    }
}

impl Tekne {
    fn denize_acil(&mut self) -> String {
        format!("{}: {}", self.ad, self.motor.calistir())
    }
}

fn main() {
    let mut araba = Araba { model: String::from("Togg T10X"), motor: Motor::new(218) };
    let mut tekne = Tekne { ad: String::from("Mavi Yolculuk"), motor: Motor::new(90) };
    println!("{}", araba.yola_cik());
    println!("{}", tekne.denize_acil());
    println!("{}", tekne.denize_acil());
}
```

`Araba`, işin bir kısmını içerdiği `Motor`'a **devrediyor (delegation)**: `self.motor.calistir()`.
Kompozisyonun bedeli bu küçük “aktarma” metotlarıdır. Karşılığında `Motor`'un hangi metotlarının dışarıya
açılacağına **sen** karar verirsin; gereksiz bir `uc()` kimseye zorla gelmez.

```predict
code: |
  struct Sayac {
      deger: u32,
  }

  impl Sayac {
      fn arttir(&mut self) -> u32 {
          self.deger += 1;
          self.deger
      }
  }

  struct Turnike {
      giris: Sayac,
      cikis: Sayac,
  }

  fn main() {
      let mut t = Turnike { giris: Sayac { deger: 0 }, cikis: Sayac { deger: 10 } };
      t.giris.arttir();
      t.giris.arttir();
      let c = t.cikis.arttir();
      println!("{} {}", t.giris.deger, c);
  }
options:
  - "2 11"
  - "2 1"
  - "3 11"
  - Derlenmez, iki alan aynı tipte olamaz
answer: 0
explanation: |
  `giris` ve `cikis` aynı tipte iki **bağımsız** parça; her birinin kendi `deger`'i var. `giris` iki kez
  arttı (0 → 2), `cikis` bir kez (10 → 11). Kompozisyonda parçalar paylaşılmaz, kopyalanmaz da; her alan
  kendi değerine sahiptir. Aynı tipten birden çok alan tamamen normaldir. Kalıtımda “iki kez aynı üst
  sınıftan türemek” mümkün değilken kompozisyonda bu doğal bir şey.
```

:::warning Deref ile “sahte kalıtım” yapma
Modül 17'de `Deref`'i öğrendin. Bazıları `impl Deref for Araba { type Target = Motor; ... }` yazarak
`araba.calistir()` çağrısını kalıtım gibi çalıştırmaya çalışır. Bu bir **anti-desendir**: `Deref` akıllı
işaretçiler içindir (`Box`, `Rc`, `String` → `str`). Araba bir Motor'a işaret eden bir işaretçi değildir;
okuyucuyu yanıltır ve hangi metodun nereden geldiğini gizler. Aktarma metotlarını açıkça yaz.
:::

```fill
prompt: |
  `Telefon`, ekran işini içerdiği `Ekran`'a devretsin. Boşlukları doldur.
code: |
  struct Ekran {
      parlaklik: u8,
  }

  impl Ekran {
      fn parlat(&mut self, miktar: u8) {
          self.parlaklik = self.parlaklik.saturating_add(miktar).min(100);
      }
  }

  struct Telefon {
      model: String,
      ___0: Ekran,
  }

  impl Telefon {
      fn parlakligi_artir(&mut self) {
          self.ekran.___1(20);
      }
  }

  fn main() {
      let mut t = Telefon { model: String::from("Akıllı 5"), ekran: Ekran { parlaklik: 90 } };
      t.parlakligi_artir();
      println!("{}: %{}", t.model, t.ekran.parlaklik);
  }
blanks:
  - ["ekran"]
  - ["parlat"]
output: "Akıllı 5: %100"
explanation: |
  `Telefon`'un bir `Ekran`'ı **var** (alan adı `ekran`); `parlakligi_artir`, işi `self.ekran.parlat(20)`
  ile ona devrediyor. `saturating_add` `u8` taşmasını önlüyor (Modül 2), `.min(100)` ise yüzdeyi sınırlıyor:
  90 + 20 = 110 → 100.
```

## Çok biçimlilik: aynı arayüz, farklı tipler

Kalıtımın ikinci amacı **çok biçimlilik (polymorphism)** idi: farklı tiplerle aynı arayüz üzerinden
çalışabilmek. Java'da `Hayvan h = new Kedi();` yazıp `h.ses()` dersin; hangi `ses` metodunun çalışacağı
nesneye göre belirlenir. Rust'ta bunun **iki** yolu var ve ikisini de trait'ler üzerine kurar:

```rust
trait Ses {
    fn ses(&self) -> String;
}

struct Kedi;
struct Kopek;

impl Ses for Kedi {
    fn ses(&self) -> String {
        String::from("Miyav")
    }
}

impl Ses for Kopek {
    fn ses(&self) -> String {
        String::from("Hav hav")
    }
}

// 1) Generic'lerle (Modül 11): derleyici her tip için ayrı bir kopya üretir
fn konustur(hayvan: &impl Ses) {
    println!("Tek hayvan: {}", hayvan.ses());
}

fn main() {
    konustur(&Kedi);
    konustur(&Kopek);

    // 2) Trait nesneleriyle: farklı tipler TEK bir listede
    let koro: Vec<Box<dyn Ses>> = vec![Box::new(Kedi), Box::new(Kopek), Box::new(Kedi)];
    for hayvan in &koro {
        println!("Koro: {}", hayvan.ses());
    }
}
```

Birinci yolu Modül 11'den biliyorsun: `impl Ses` (ya da `<T: Ses>`) ile yazılan fonksiyonu derleyici
`Kedi` ve `Kopek` için **ayrı ayrı** derler (monomorphization). Hangi metodun çağrılacağı **derleme
zamanında** bellidir.

İkinci yol yeni: `Box<dyn Ses>` bir **trait nesnesi (trait object)**. “*`Ses`'i uygulayan, tipi çalışma
zamanında belli olacak bir şey*” demek. Böylece `Kedi` ve `Kopek` aynı `Vec`'e girebiliyor ve her
elemanda doğru `ses` metodu **çalışma zamanında** seçiliyor. Aslında bu sözdizimini daha önce iki kez
gördün: Modül 10'daki `Box<dyn Error>` ve Modül 14'teki `Box<dyn Fn(i32) -> i32>` da trait nesneleriydi.
Bir sonraki ders tamamen onlara ayrılmış.

```quiz
question: Yukarıdaki programla ilgili hangisi **doğrudur**?
options:
  - "`konustur(&Kedi)` çağrısında hangi `ses` metodunun çalışacağı çalışma zamanında, `koro`'da ise derleme zamanında belirlenir"
  - "`konustur(&Kedi)` çağrısında metot derleme zamanında belirlenir; `koro`'daki her elemanın metodu ise çalışma zamanında seçilir"
  - "`Vec<Box<dyn Ses>>` yerine `Vec<impl Ses>` yazsaydık da kedi ve köpeği aynı listeye koyabilirdik"
  - Rust'ta çok biçimlilik yalnızca kalıtımla mümkündür, bu yüzden bu program derlenmez
answer: 1
explanation: |
  Generic fonksiyonun her tip için ayrı bir kopyası üretilir, yani çağrılacak metot derleme anında bellidir
  (**statik dispatch**). `Box<dyn Ses>` ise somut tipi “unutur”; doğru metot her çağrıda çalışma zamanında
  bulunur (**dinamik dispatch**). `impl Ses` her zaman **tek bir** somut tip demektir; bu yüzden karışık
  liste için `dyn` gerekir. Bu iki mekanizmanın bedellerini 3. derste karşılaştıracağız.
feedback:
  - Tam tersi.
  - Doğru!
  - "`impl Trait` tek bir somut tipi temsil eder; bir `Vec`'in bütün elemanları da aynı tipte olmalı."
  - Program derlenir; Rust'ta çok biçimlilik trait'lerle sağlanır, kalıtım gerekmez.
```

## Alıştırma: kompozisyonla oyun karakterleri

Şimdi iki aracı birlikte kullan: ortak bir **can** bileşeni (kompozisyon) ve ortak davranışı bedava veren bir
trait (varsayılan metotlar). Bir tipin varsayılan davranışı **ezmesi (override)** de kalıtımdaki “metot
ezme”nin karşılığıdır.

```exercise
id: m20-l01-e-karakter
title: Can bileşeni ve zırhlı savaşçı
difficulty: 3
prompt: |
  Bir rol yapma oyununda her karakterin bir **can** bileşeni var. Kalıtım yerine kompozisyon ve trait
  varsayılan metotları kullanacaksın.

  **1) `Can` bileşeninin metotlarını yaz:**
  - `hasar_al(miktar)`: `mevcut`'u azaltır ama **0'ın altına inmez**.
  - `iyiles(miktar)`: `mevcut`'u artırır ama **`azami`'yi geçmez**.
  - `hayatta_mi()`: `mevcut > 0` ise `true`.

  **2) `Karakter` trait'inin iki varsayılan metodunu yaz:**
  - `saldiriya_ugra(guc)`: karakterin canından `guc` kadar hasar düşer (`can_mut()` üzerinden).
  - `durum()`: `"Merlin: 55/80 (ayakta)"` biçiminde metin; can 0 ise parantez içi `bayıldı` olur.

  **3) `Savasci` için `saldiriya_ugra`'yı ez:** zırh, gelen saldırının gücünden düşülür
  (`guc - zirh`, ama negatif olamaz) ve kalan hasar uygulanır.
starter: |
  struct Can {
      mevcut: u32,
      azami: u32,
  }

  impl Can {
      fn new(azami: u32) -> Can {
          Can { mevcut: azami, azami }
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
  }

  trait Karakter {
      fn ad(&self) -> &str;
      fn can(&self) -> &Can;
      fn can_mut(&mut self) -> &mut Can;

      fn saldiriya_ugra(&mut self, guc: u32) {
          todo!()
      }

      fn durum(&self) -> String {
          todo!()
      }
  }

  struct Buyucu {
      ad: String,
      can: Can,
  }

  struct Savasci {
      ad: String,
      can: Can,
      zirh: u32,
  }

  impl Karakter for Buyucu {
      fn ad(&self) -> &str {
          &self.ad
      }
      fn can(&self) -> &Can {
          &self.can
      }
      fn can_mut(&mut self) -> &mut Can {
          &mut self.can
      }
  }

  impl Karakter for Savasci {
      fn ad(&self) -> &str {
          &self.ad
      }
      fn can(&self) -> &Can {
          &self.can
      }
      fn can_mut(&mut self) -> &mut Can {
          &mut self.can
      }
      // TODO: saldiriya_ugra'yı ez - zırh hasarı azaltır
  }

  fn main() {
      let mut merlin = Buyucu { ad: String::from("Merlin"), can: Can::new(80) };
      let mut alp = Savasci { ad: String::from("Alp"), can: Can::new(120), zirh: 15 };
      merlin.saldiriya_ugra(25);
      alp.saldiriya_ugra(25);
      println!("{}", merlin.durum());
      println!("{}", alp.durum());
  }
solution: |
  struct Can {
      mevcut: u32,
      azami: u32,
  }

  impl Can {
      fn new(azami: u32) -> Can {
          Can { mevcut: azami, azami }
      }

      fn hasar_al(&mut self, miktar: u32) {
          self.mevcut = self.mevcut.saturating_sub(miktar);
      }

      fn iyiles(&mut self, miktar: u32) {
          self.mevcut = self.mevcut.saturating_add(miktar).min(self.azami);
      }

      fn hayatta_mi(&self) -> bool {
          self.mevcut > 0
      }
  }

  trait Karakter {
      fn ad(&self) -> &str;
      fn can(&self) -> &Can;
      fn can_mut(&mut self) -> &mut Can;

      fn saldiriya_ugra(&mut self, guc: u32) {
          self.can_mut().hasar_al(guc);
      }

      fn durum(&self) -> String {
          let can = self.can();
          let etiket = if can.hayatta_mi() { "ayakta" } else { "bayıldı" };
          format!("{}: {}/{} ({etiket})", self.ad(), can.mevcut, can.azami)
      }
  }

  struct Buyucu {
      ad: String,
      can: Can,
  }

  struct Savasci {
      ad: String,
      can: Can,
      zirh: u32,
  }

  impl Karakter for Buyucu {
      fn ad(&self) -> &str {
          &self.ad
      }
      fn can(&self) -> &Can {
          &self.can
      }
      fn can_mut(&mut self) -> &mut Can {
          &mut self.can
      }
  }

  impl Karakter for Savasci {
      fn ad(&self) -> &str {
          &self.ad
      }
      fn can(&self) -> &Can {
          &self.can
      }
      fn can_mut(&mut self) -> &mut Can {
          &mut self.can
      }
      fn saldiriya_ugra(&mut self, guc: u32) {
          let net = guc.saturating_sub(self.zirh);
          self.can.hasar_al(net);
      }
  }

  fn main() {
      let mut merlin = Buyucu { ad: String::from("Merlin"), can: Can::new(80) };
      let mut alp = Savasci { ad: String::from("Alp"), can: Can::new(120), zirh: 15 };
      merlin.saldiriya_ugra(25);
      alp.saldiriya_ugra(25);
      merlin.can_mut().iyiles(10);
      println!("{}", merlin.durum());
      println!("{}", alp.durum());
  }
check: tests
tests: |
  #[test]
  fn can_sinirlarin_disina_cikmaz() {
      let mut c = Can::new(100);
      c.hasar_al(30);
      assert_eq!(c.mevcut, 70, "100 - 30 = 70");
      c.iyiles(50);
      assert_eq!(c.mevcut, 100, "İyileşme azami canı (100) geçmemeli");
      c.hasar_al(500);
      assert_eq!(c.mevcut, 0, "Can 0'ın altına inmemeli (u32 taşmasına dikkat!)");
      assert!(!c.hayatta_mi(), "Canı 0 olan karakter hayatta değildir");
  }

  #[test]
  fn buyucu_tam_hasar_alir() {
      let mut m = Buyucu { ad: String::from("Merlin"), can: Can::new(80) };
      m.saldiriya_ugra(25);
      assert_eq!(m.can().mevcut, 55, "Büyücünün zırhı yok: 80 - 25 = 55");
      assert_eq!(m.durum(), "Merlin: 55/80 (ayakta)");
  }

  #[test]
  fn savasci_zirhla_korunur() {
      let mut s = Savasci { ad: String::from("Alp"), can: Can::new(100), zirh: 10 };
      s.saldiriya_ugra(25);
      assert_eq!(s.can().mevcut, 85, "Zırh 10: 25 güçlük saldırı 15 hasar vermeli");
      s.saldiriya_ugra(5);
      assert_eq!(s.can().mevcut, 85, "Zırhtan zayıf saldırı hasar vermemeli (ve taşma olmamalı)");
  }

  #[test]
  fn bayilan_karakterin_durumu() {
      let mut m = Buyucu { ad: String::from("Ece"), can: Can::new(40) };
      m.saldiriya_ugra(100);
      assert_eq!(m.durum(), "Ece: 0/40 (bayıldı)", "Canı biten karakter 'bayıldı' göstermeli");
  }
hints:
  - "`u32` negatif olamaz: `self.mevcut - miktar` taşabilir ve panik atar. `saturating_sub` 0'da durur (Modül 2). İyileşmede `saturating_add(...).min(self.azami)`."
  - "Varsayılan metotlar alanlara doğrudan erişemez; trait'in metotlarını kullanır: `self.can_mut().hasar_al(guc);` ve `let can = self.can();`."
  - "`Savasci`'nin impl bloğuna `fn saldiriya_ugra(&mut self, guc: u32) { let net = guc.saturating_sub(self.zirh); self.can.hasar_al(net); }` ekle. Burada `self.can`'a doğrudan erişebilirsin, çünkü artık somut tipin içindesin."
explanation: |
  Bu çözümde kalıtımın iki işini iki ayrı araç yaptı:

  - **Kod paylaşımı:** can mantığı bir kez, `Can` bileşeninde yazıldı; her karakter onu bir alan olarak
    içeriyor (kompozisyon). Yarın `Okcu` eklersen ona da `can: Can` alanı verirsin.
  - **Ortak davranış:** `durum` ve `saldiriya_ugra` trait'te varsayılan olarak bir kez yazıldı. Varsayılan
    metotlar alanları bilmez; yalnızca `can()` / `can_mut()` gibi açıkça ilan edilmiş metotlar üzerinden
    çalışır. Kırılgan taban sınıf sorununun panzehiri tam olarak bu açıklıktır.
  - **Ezme:** `Savasci` yalnızca farklı olan davranışı (zırh) yeniden yazdı. Java'daki
    `super.saldiriyaUgra(...)` yok; ortak kod zaten `Can::hasar_al`'da olduğu için ona ihtiyaç da yok.

  `ad(&self) -> &str` imzası yaşam süresi kurallarıyla (Modül 12, elision) `&self`'e bağlıdır: dönen dilim
  karakter yaşadıkça geçerlidir.
```

## Özet

:::remember
- Rust'ta nesne = `struct`/`enum` (veri) + `impl` (davranış). Sınıf yok ama nesne var.
- **Kapsülleme**: alanlar varsayılan olarak gizlidir; `pub` metotlar değişmezi korur. Gizlilik **modül**
  düzeyindedir. Gizli alana erişim → `E0616`, gizli alanlı struct'ı dışarıda kurmak → `E0451`.
- **Kalıtım yok**: kırılgan taban sınıf, gereksiz miras ve katı hiyerarşi yerine **kompozisyon** (has-a,
  devretme) ve **trait varsayılan metotları**.
- **Çok biçimlilik** iki yolla: generic'ler (`impl Trait`, derleme zamanı) ve trait nesneleri
  (`Box<dyn Trait>`, çalışma zamanı).
- `Deref`'i kalıtım taklidi için kullanma; aktarma metotlarını açıkça yaz.
:::

```reflect
prompt: |
  Bir arkadaşın “Rust'ta kalıtım olmaması büyük bir eksiklik, kodu nasıl yeniden kullanacağız?” diyor.
  Kalıtımın iki amacını ve Rust'taki karşılıklarını kendi örneğinle anlatarak cevap ver.
answer: |
  Kalıtım iki şey için kullanılır: kodu yeniden kullanmak ve çok biçimlilik. Rust ikisini ayrı araçlarla
  çözüyor. Kod paylaşımı için kompozisyon kullanırım: örneğin hem `Araba` hem `Tekne` bir `Motor` alanı
  içerir ve işi ona devreder; ayrıca trait varsayılan metotlarıyla ortak davranışı bir kez yazarım.
  Çok biçimlilik için trait'ler var: generic'lerle derleme zamanında, `Box<dyn Trait>` ile çalışma zamanında
  farklı tiplerle aynı arayüz üzerinden çalışırım.

  Üstelik kalıtımın kırılgan taban sınıf sorunu da ortadan kalkıyor: trait'ler yalnızca açıkça ilan edilmiş
  metotlara dayanır, bir üst sınıfın gizli uygulama ayrıntısına bağımlı olmam mümkün değil. Bir tip de
  istediği kadar trait uygulayabilir; tek bir hiyerarşiye sıkışmaz.
```

```flashcards
- front: Rust'ta OOP'deki “nesne”nin karşılığı nedir?
  back: "Veriyi tutan bir `struct`/`enum` ve davranışı tanımlayan `impl` blokları."
- front: "Rust'ta gizlilik hangi düzeydedir: sınıf mı, modül mü?"
  back: Modül. Aynı modüldeki (ve alt modüllerdeki) kod gizli alanları görebilir; dışarısı göremez.
- front: "`E0616: field ... is private` ne zaman alınır?"
  back: Modül dışından gizli (pub olmayan) bir alana erişilmeye çalışıldığında.
- front: Kırılgan taban sınıf (fragile base class) sorunu nedir?
  back: Alt sınıfın üst sınıfın uygulama ayrıntılarına bağımlı olması; üst sınıftaki masum bir değişiklik alt sınıfları sessizce bozar.
- front: Kompozisyon nedir? Hangi ilişkiyi ifade eder?
  back: "Bir tipin başka tipleri alan olarak içermesi ve işi onlara devretmesi; “has-a” (*bir ... sahiptir*) ilişkisi."
- front: Rust'ta çok biçimliliğin iki yolu nedir?
  back: "Generic'ler / `impl Trait` (statik, derleme zamanı) ve trait nesneleri `dyn Trait` (dinamik, çalışma zamanı)."
- front: Kalıtım taklidi için `Deref` uygulamak neden kötü bir fikirdir?
  back: "`Deref` akıllı işaretçiler içindir; “sahte kalıtım” okuyucuyu yanıltır ve metotların nereden geldiğini gizler."
```
