---
id: m07-l05
title: Enum'larla modelleme
minutes: 30
type: lesson
objectives:
  - Bool bayraklarıyla dolu bir struct'taki geçersiz durumları bulup onları temsil edilemez kılan bir enum tasarlayabilmek
  - Ortak veriyi struct'ta, duruma özgü veriyi enum varyantlarında tutan birleşik tipler kurabilmek
  - "`self`'i tüketen metotlarla durum geçişleri yazıp bir durum makinesini `match (durum, olay)` ile modelleyebilmek"
  - Metin karşılaştırmalı `if` zincirleri yerine enum + `match` kullanmanın neden daha güvenli olduğunu açıklayabilmek
keywords: [durum makinesi, state machine, geçersiz durum, modelleme, SiparisDurumu, TrafikIsigi, self, geçiş, E0609, E0599]
---

Bu modülde enum tanımlamayı, `Option`'ı, `match`'i ve kısa yollarını öğrendin. Şimdi bunları bir
**tasarım aracı** olarak kullanma zamanı. Bu derste kod yazmaktan çok **tip tasarlamayı** konuşacağız;
çünkü iyi tasarlanmış bir tip, hataların büyük kısmını daha kod yazılmadan imkânsız hâle getirir.

Bir e-ticaret şirketinde müşteri hizmetlerine şöyle bir şikâyet geldiğini düşün: "Siparişim 'teslim
edildi' görünüyor ama hiç ödeme yapmamıştım ve kargo numarası boş." Program bu durumu nasıl temsil
edebildi? Çünkü tipi buna **izin veriyordu**. Bu derste, izin vermeyen tipler kuracağız.

## Bool çorbası: geçersiz durumlar

Siparişin durumunu tutan ilk tasarım çoğu zaman şuna benzer:

```rust
# #[allow(dead_code)]
struct Siparis {
    odendi: bool,
    kargoda: bool,
    teslim_edildi: bool,
    takip_no: Option<String>,
}

fn main() {
    // Derleyici bu değeri seve seve kabul eder. Peki anlamı ne?
    let tuhaf = Siparis {
        odendi: false,
        kargoda: false,
        teslim_edildi: true,
        takip_no: None,
    };
    if tuhaf.teslim_edildi && !tuhaf.odendi {
        println!("Ödenmemiş ama teslim edilmiş, takip numarası olmayan bir sipariş!");
    }
}
```

Her alan tek başına mantıklı. Sorun, **birlikte** neyi temsil edebildikleri.

```quiz
question: |
  Yukarıdaki struct'ın üç `bool` alanı (`odendi`, `kargoda`, `teslim_edildi`) kaç farklı kombinasyon
  oluşturabilir ve bir sipariş sürecinde (bekliyor → ödendi → kargoda → teslim) bunlardan kaçı
  **anlamlıdır**?
options:
  - "3 kombinasyon, hepsi anlamlı"
  - "6 kombinasyon, 3'ü anlamlı"
  - "8 kombinasyon, yalnızca 4'ü anlamlı"
  - "8 kombinasyon, hepsi anlamlı"
answer: 2
explanation: |
  Her `bool` iki değer alır: 2 × 2 × 2 = **8** kombinasyon. Anlamlı olanlar yalnızca dördü:
  bekliyor (`f f f`), ödendi (`t f f`), kargoda (`t t f`), teslim (`t t t`). Geri kalan dört kombinasyon
  (örneğin "teslim edildi ama ödenmedi") **geçersiz durumlardır** ve tip onları engellemiyor. Üstelik
  `takip_no` de hesaba katılınca ("kargoda ama takip numarası yok") geçersizlerin sayısı daha da artar.
  Her yeni `bool` kombinasyon sayısını ikiye katlar; anlamlı durumların sayısı ise yalnızca bir artar.
feedback:
  - "Üç alanın her biri bağımsız olarak `true` ya da `false` olabilir; kombinasyonlar çarpılır."
  - "2 × 2 × 2 = 8; anlamlı olanlar da 4 tane."
  - "Doğru! Tipin izin verdiği her şey bir gün bir yerde oluşur; geçersiz olanlar dahil."
  - "\"Teslim edildi ama ödenmedi ve kargoya hiç verilmedi\" anlamlı bir sipariş durumu değil."
```

Bu bool'ların her biri aslında aynı sorunun parçası: "sipariş **hangi aşamada**?" Ve bu sorunun cevabı
"bekliyor **veya** ödendi **veya** kargoda **veya** teslim"dir. 1. dersten hatırla: "veya" bir enum demektir.

```rust
# #[allow(dead_code)]
enum SiparisDurumu {
    Bekliyor,
    Odendi { tutar: u32 },
    Kargoda { takip_no: String },
    Teslim { takip_no: String },
    Iptal { neden: String },
}
# fn main() {}
```

Artık **tam olarak beş** durum var ve hepsi anlamlı. "Teslim edildi ama ödenmedi" yazmanın bir yolu
yok. Takip numarası yalnızca `Kargoda` ve `Teslim` varyantlarında var: "kargoda ama takip numarası yok"
da artık yazılamıyor. İptal nedeni yalnızca iptal edilmiş bir siparişte bulunuyor.

Bu ilkenin İngilizce adı çok bilinir: **"make illegal states unrepresentable"** (geçersiz durumları
temsil edilemez kıl). Hatayı çalışma zamanında `if` kontrolleriyle yakalamaya çalışmak yerine, tipi öyle
kurarsın ki hatalı değer **oluşturulamaz**.

:::analogy Çamaşır makinesinin program düğmesi
Eski bir çamaşır makinesi düşün: "pamuklu", "yünlü", "hızlı" ve "sıkma" için ayrı ayrı açma kapama
düğmeleri var. Birisi mutlaka aynı anda hem "yünlü"yü hem "hızlı"yı açar; makine ne yapacağını bilemez.
Yeni makinelerde ise tek bir **döner düğme** vardır: hangi programa çevirirsen o seçilidir, ikisi birden
seçilemez. Bool alanları ayrı düğmeler gibidir; enum ise döner düğmedir.
:::

:::info Başka dillerde
Java ve C#'ta durum çoğu zaman bir `enum` ile tutulur; ama oradaki enum'ların her sabiti aynı alanlara
sahiptir, varyanta özgü veri taşıyamaz. Bu yüzden takip numarası gibi bilgiler sınıfın ayrı (çoğu zaman
`null` olabilen) alanlarında durur ve aynı tutarsızlıklar geri gelir. TypeScript programcıları Rust'taki
fikri "discriminated union" adıyla bilir; Haskell, OCaml, F# ve Swift de veri taşıyan enum'ları destekler.
C'deki `enum` ise yalnızca isimlendirilmiş tamsayılardır, veri taşıyamaz.
:::

## Ortak veri struct'ta, duruma özgü veri varyantta

Gerçek bir siparişte bazı bilgiler **her durumda** vardır: sipariş numarası, müşteri adı. Bazıları ise
yalnızca belirli bir durumda anlamlıdır: takip numarası, iptal nedeni. Doğal tasarım ikisini birleştirir:

```rust
# #[allow(dead_code)]
enum SiparisDurumu {
    Bekliyor,
    Odendi { tutar: u32 },
    Kargoda { takip_no: String },
    Teslim { takip_no: String },
    Iptal { neden: String },
}

struct Siparis {
    no: u32,
    musteri: String,
    durum: SiparisDurumu, // "ve": her siparişin bir durumu VAR
}

impl SiparisDurumu {
    fn takip_no(&self) -> Option<&str> {
        match self {
            SiparisDurumu::Kargoda { takip_no } | SiparisDurumu::Teslim { takip_no } => Some(takip_no),
            _ => None,
        }
    }
}

fn main() {
    let siparisler = [
        Siparis { no: 101, musteri: String::from("Ayşe"), durum: SiparisDurumu::Odendi { tutar: 450 } },
        Siparis {
            no: 102,
            musteri: String::from("Burak"),
            durum: SiparisDurumu::Kargoda { takip_no: String::from("TR77AB") },
        },
    ];
    for s in &siparisler {
        match s.durum.takip_no() {
            Some(no) => println!("#{} {}: kargo takip {no}", s.no, s.musteri),
            None => println!("#{} {}: henüz kargoda değil", s.no, s.musteri),
        }
    }
}
```

İki yeni ayrıntı var:

- `Kargoda { takip_no } | Teslim { takip_no }`: `|` ile birleştirilen desenler bir değişken
  bağlayabilir, yeter ki **her alternatif aynı adı aynı tiple** bağlasın. İki varyantın takip numarası
  aynı kolda ele alınıyor.
- `Some(takip_no)`: `takip_no` bir `&String`, dönüş tipi `Option<&str>`. Rust `&String`'i `&str`'ye
  kendiliğinden çevirir (Modül 5'teki "parametre olarak `&str` tercih et" kuralını mümkün kılan aynı
  dönüşüm).

Bu tasarımda takip numarasını okumak için neden bir metot yazdık? Doğrudan alana erişemez miydik?

```compiles
code: |
  enum SiparisDurumu {
      Bekliyor,
      Kargoda { takip_no: String },
  }

  struct Siparis {
      no: u32,
      durum: SiparisDurumu,
  }

  fn main() {
      let s = Siparis { no: 7, durum: SiparisDurumu::Bekliyor };
      println!("{} {}", s.no, s.durum.takip_no);
  }
answer: false
error: E0609
explanation: |
  Derlenmez: **E0609**, *no field `takip_no` on type `SiparisDurumu`*. Bir enum'un "alanı" olmaz; alanlar
  **varyantlara** aittir. `s.durum` bu programda `Bekliyor`; okuyacak bir takip numarası yok. Struct'ta
  bir alan her zaman vardır, ama bir enum varyantının alanına ancak **o varyantta olduğunu kanıtladıktan
  sonra**, yani bir desenle eşleştirdikten sonra ulaşabilirsin. Derleyici "takip numarasını okumadan
  önce sipariş gerçekten kargoda mı?" sorusunu sormayı unutmana izin vermiyor.
```

:::tip "ve" mi, "veya" mı? Option alanı mı, enum mu?
- Bilgiler **birbirinden bağımsız** olarak var ya da yoksa (bir öğrencinin telefonu **ve** e-postası,
  ikisi de isteğe bağlı) → struct'ta `Option` alanlar (2. ders).
- Bilgiler **birbirini dışlıyorsa** (takip numarası **veya** iptal nedeni, ikisi asla birlikte değil) →
  bir enum ve her bilgi kendi varyantında.
- İkisi birden → ortak bilgiler struct'ta, değişen kısım bir enum alanında (yukarıdaki `Siparis`).
:::

## Durum makinesi: trafik ışığı

`SiparisDurumu` gibi tiplerin bir de **zaman** boyutu var: bir sipariş önce bekler, sonra ödenir, sonra
kargoya verilir. Belirli durumlardan ve aralarındaki izinli **geçişlerden (transition)** oluşan bu tür
sistemlere **durum makinesi (state machine)** denir. Trafik ışıkları, asansörler, oyun karakterleri,
ağ bağlantıları, otomatlar... Hepsi durum makinesidir.

Türkiye'deki trafik ışıkları dört aşamada döner:

```text
Kirmizi ──► KirmiziSari ──► Yesil ──► Sari ──► Kirmizi ──► ...
  30 sn         2 sn         25 sn     3 sn
```

```rust
#[derive(Debug)]
enum TrafikIsigi {
    Kirmizi,
    KirmiziSari,
    Yesil,
    Sari,
}

impl TrafikIsigi {
    // Geçiş: eski durumu tüketir, yenisini döndürür
    fn sonraki(self) -> TrafikIsigi {
        match self {
            TrafikIsigi::Kirmizi => TrafikIsigi::KirmiziSari,
            TrafikIsigi::KirmiziSari => TrafikIsigi::Yesil,
            TrafikIsigi::Yesil => TrafikIsigi::Sari,
            TrafikIsigi::Sari => TrafikIsigi::Kirmizi,
        }
    }

    // Sorgu: durumu yalnızca okur
    fn sure(&self) -> u32 {
        match self {
            TrafikIsigi::Kirmizi => 30,
            TrafikIsigi::KirmiziSari => 2,
            TrafikIsigi::Yesil => 25,
            TrafikIsigi::Sari => 3,
        }
    }

    fn arac_gecebilir_mi(&self) -> bool {
        matches!(self, TrafikIsigi::Yesil)
    }
}

fn main() {
    let mut isik = TrafikIsigi::Kirmizi;
    let mut zaman = 0;
    for _ in 0..5 {
        println!("{zaman:>3}. sn: {isik:?} (geçiş: {})", isik.arac_gecebilir_mi());
        zaman += isik.sure();
        isik = isik.sonraki();
    }
}
```

Metotların imzaları bir şey anlatıyor (Modül 6):

- `sure(&self)` ve `arac_gecebilir_mi(&self)` **sorgulardır**: durumu okurlar, değiştirmezler.
- `sonraki(self)` bir **geçiştir**: eski durumu sahiplenir (tüketir) ve yerine yenisini döndürür.

`isik = isik.sonraki();` satırı ilk bakışta tuhaf gelebilir: `isik` `sonraki`'ye taşındı, sonra aynı
değişkene yeni değer atandı. Bu serbesttir: taşınmış bir `mut` değişkene **yeni bir değer atayabilirsin**;
yasak olan, değer atanmadan önce onu kullanmaktır.

```predict
code: |
  #[derive(Debug)]
  enum TrafikIsigi {
      Kirmizi,
      KirmiziSari,
      Yesil,
      Sari,
  }

  impl TrafikIsigi {
      fn sonraki(self) -> TrafikIsigi {
          match self {
              TrafikIsigi::Kirmizi => TrafikIsigi::KirmiziSari,
              TrafikIsigi::KirmiziSari => TrafikIsigi::Yesil,
              TrafikIsigi::Yesil => TrafikIsigi::Sari,
              TrafikIsigi::Sari => TrafikIsigi::Kirmizi,
          }
      }
  }

  fn main() {
      let mut isik = TrafikIsigi::Sari;
      for _ in 0..3 {
          isik = isik.sonraki();
      }
      println!("{isik:?}");
  }
options:
  - "Yesil"
  - "KirmiziSari"
  - "Sari"
  - "Derlenmez: `isik` döngünün ilk turunda taşındı"
answer: 0
explanation: |
  Üç geçiş: `Sari → Kirmizi → KirmiziSari → Yesil`. Program derlenir: her turda `isik` önce
  `sonraki`'ye taşınır, ama aynı satırda hemen yeni bir değer alır. Bir sonraki tur başladığında `isik`
  yine geçerli bir değer tutuyor. Derleyici taşımaları satır satır izler; taşınmış bir değişkene yeniden
  değer atamak onu tekrar kullanılabilir yapar.
```

Şimdi sıra sende: bir çamaşır makinesinin programı da bir durum makinesi.

```fill
prompt: |
  Boşlukları doldur: `sonraki` metodu eski durumu **tüketsin**. Program bittiğinde (`Bitti`) makine
  olduğu yerde kalsın.
code: |
  #[derive(Debug)]
  enum Camasir {
      Yikama,
      Durulama,
      Sikma,
      Bitti,
  }

  impl Camasir {
      fn sonraki(___0) -> Camasir {
          match self {
              Camasir::Yikama => Camasir::Durulama,
              Camasir::Durulama => Camasir::Sikma,
              Camasir::Sikma => Camasir::Bitti,
              Camasir::Bitti => ___1,
          }
      }
  }

  fn main() {
      let mut m = Camasir::Yikama;
      for _ in 0..5 {
          print!("{m:?} → ");
          m = m.sonraki();
      }
      println!("{m:?}");
  }
blanks:
  - ["self"]
  - ["Camasir::Bitti", "Self::Bitti"]
output: "Yikama → Durulama → Sikma → Bitti → Bitti → Bitti"
explanation: |
  Geçiş metotları `self` alır: eski durum tüketilir, yenisi döndürülür. `&self` yazsaydın kod yine
  derlenirdi (bu enum'un varyantları veri taşımıyor; eski durumun içinden taşınacak bir şey yok), ama metot
  "durumu değiştiriyorum" niyetini anlatmazdı ve eski durum da kullanılabilir kalırdı. `Bitti`'den sonra
  gidilecek yer yok; böyle durumlara **son durum (final state)** denir. Burada son durumda yeni bir adım
  gelince makine olduğu yerde kalıyor (kendine geçiş); başka bir tasarım bu adımı geçersiz sayıp
  reddedebilirdi.
```

## Geçişler self'i tüketir

Sipariş örneğine dönelim. Bir siparişi ödemek, `Bekliyor` durumundan `Odendi`'ye geçmektir:

```rust
# #[allow(dead_code)]
#[derive(Debug)]
enum SiparisDurumu {
    Bekliyor,
    Odendi { tutar: u32 },
}

impl SiparisDurumu {
    fn ode(self, tutar: u32) -> SiparisDurumu {
        match self {
            SiparisDurumu::Bekliyor => SiparisDurumu::Odendi { tutar },
            diger => diger, // geçersiz geçiş: durum aynen kalır
        }
    }
}

fn main() {
    let durum = SiparisDurumu::Bekliyor;
    let durum = durum.ode(250);
    println!("{durum:?}");
    let durum = durum.ode(999); // zaten ödenmiş: değişmez
    println!("{durum:?}");
}
```

`diger => diger` kolu "geri kalan her durumu, olduğu gibi geri ver" der: zaten ödenmiş bir sipariş ikinci
kez ödenemez. Peki neden `&self` alıp yeni bir durum döndürmüyoruz da eski durumu `self` ile
sahipleniyoruz? Modül 4'ü hatırlayarak tahmin et:

```compiles
code: |
  #[derive(Debug)]
  enum SiparisDurumu {
      Bekliyor,
      Odendi { tutar: u32 },
  }

  impl SiparisDurumu {
      fn ode(self, tutar: u32) -> SiparisDurumu {
          match self {
              SiparisDurumu::Bekliyor => SiparisDurumu::Odendi { tutar },
              diger => diger,
          }
      }
  }

  fn main() {
      let durum = SiparisDurumu::Bekliyor;
      let yeni = durum.ode(250);
      println!("{yeni:?}");
      println!("{durum:?}");
  }
answer: false
error: E0382
explanation: |
  Derlenmez: **E0382**, *borrow of moved value: `durum`*. `ode` `self` aldığı için `durum` metoda
  **taşındı**. Derleyici notunda bunu açıkça yazar: *`SiparisDurumu::ode` takes ownership of the receiver
  `self`, which moves `durum`*. İşte istediğimiz de tam bu! Ödeme yapıldıktan sonra elinde hâlâ
  "bekliyor" diyen eski bir durum değeri kalsaydı, onu yanlışlıkla kullanabilirdin. Sahiplik sistemi
  **eskimiş durumu** kullanmanı imkânsız kılıyor.
```

`self` almanın ikinci faydası **veri taşımadır**. Sipariş kargodan teslime geçerken takip numarası
eski durumdan yenisine **kopyalanmadan**, sahiplik aktarılarak geçer:

```rust
# #[allow(dead_code)]
# #[derive(Debug)]
# enum SiparisDurumu {
#     Kargoda { takip_no: String },
#     Teslim { takip_no: String },
# }
# impl SiparisDurumu {
fn teslim_et(self) -> SiparisDurumu {
    match self {
        SiparisDurumu::Kargoda { takip_no } => SiparisDurumu::Teslim { takip_no }, // clone yok!
        diger => diger,
    }
}
# }
# fn main() {
#     let durum = SiparisDurumu::Kargoda { takip_no: String::from("TR77AB") };
#     let durum = durum.teslim_et();
#     println!("{durum:?}");
# }
```

```memory
title: "`teslim_et(self)`: takip numarası kopyalanmadan yeni duruma geçer"
steps:
  - caption: "Önce: `durum` bir `Kargoda`. Stack'te varyant etiketi ve `takip_no`'nun başlığı (işaretçi, uzunluk, kapasite); harfler heap'te."
    stack:
      - frame: main
        vars:
          - { name: durum, type: SiparisDurumu, value: "etiket: Kargoda │ ptr · len=6 · cap=6", to: h1 }
    heap:
      - { id: h1, value: "T R 7 7 A B" }
  - caption: "`let durum = durum.teslim_et();` Eski `durum` metoda taşındı; desen `takip_no`'yu çıkardı ve yeni `Teslim` varyantına koydu. Heap'teki harfler yerinden kıpırdamadı."
    stack:
      - frame: main
        vars:
          - { name: "durum (eski)", type: SiparisDurumu, value: "etiket: Kargoda │ (taşındı)", moved: true }
          - { name: durum, type: SiparisDurumu, value: "etiket: Teslim │ ptr · len=6 · cap=6", to: h1 }
    heap:
      - { id: h1, value: "T R 7 7 A B" }
```

`&mut self` ile yazmaya kalksaydın, ödünç alınmış bir değerin içinden `takip_no`'yu taşıyamazdın
(E0507, 2. dersteki `take()` sorunu). Geçişi `self` ile yazmak hem daha güvenli hem daha basittir.
Durum bir struct'ın alanıysa, struct'ın metodu da `self` alıp Modül 6'daki güncelleme sözdizimiyle
(struct update syntax) yeni bir struct döndürebilir:

```rust
# #[allow(dead_code)]
# #[derive(Debug)]
# enum SiparisDurumu {
#     Bekliyor,
#     Odendi { tutar: u32 },
# }
# impl SiparisDurumu {
#     fn ode(self, tutar: u32) -> SiparisDurumu {
#         match self {
#             SiparisDurumu::Bekliyor => SiparisDurumu::Odendi { tutar },
#             diger => diger,
#         }
#     }
# }
# #[derive(Debug)]
# struct Siparis {
#     no: u32,
#     musteri: String,
#     durum: SiparisDurumu,
# }
impl Siparis {
    fn ode(self, tutar: u32) -> Siparis {
        Siparis { durum: self.durum.ode(tutar), ..self } // no ve musteri olduğu gibi taşınır
    }
}
# fn main() {
#     let s = Siparis { no: 101, musteri: String::from("Ayşe"), durum: SiparisDurumu::Bekliyor };
#     let s = s.ode(450);
#     println!("#{} {}: {:?}", s.no, s.musteri, s.durum);
# }
```

:::info &mut self ile geçiş de mümkün
Durum büyük bir yapının içinde yaşıyorsa her geçişte bütün yapıyı taşıyıp yeniden kurmak istemeyebilirsin;
gerçek kodda `&mut self` alan geçişlere de sık rastlarsın. Orada içerideki veriyi taşımak için
`Option::take`'in genel hâli olan `std::mem::replace` kullanılır: alana yeni bir değer koyar ve eskisini
sahipliğiyle sana verir, böylece alan hiçbir an geçersiz kalmaz (2. dersteki E0507'nin çözümüyle aynı
fikir). `&mut self` ile de eskimiş bir kopya oluşmaz, çünkü durum yerinde güncellenir. İki yaklaşım da
doğrudur; `self` sürümü `replace` hilesi gerektirmediği ve her geçişi "eski durum girer, yeni durum çıkar"
diye açıkça gösterdiği için bu modülde onunla ilerliyoruz.
:::

:::warning Sessiz reddetme bir tasarım kararıdır
`diger => diger` geçersiz bir geçişi **sessizce yok sayar**: kargodaki bir siparişi "ödemeye" çalışırsan
hiçbir şey olmaz ve kimse bunu fark etmez. Basit örneklerde yeterli; gerçek bir sistemde ise çağıranın
"bu geçiş reddedildi" bilgisini alması gerekir. Bunun Rust'taki doğru aracı `Result` tipidir ve
Modül 10'da göreceğiz.
:::

````exercise
id: m07-e-siparis-yasam-dongusu
title: Siparişin yaşam döngüsü
difficulty: 3
prompt: |
  Bir siparişin geçiş kuralları şöyle:

  ```text
  Bekliyor ──ode──► Odendi ──kargola──► Kargoda ──teslim_et──► Teslim
     │                 │
     └────iptal_et─────┴──► Iptal
  ```

  `ode` metodu hazır. Sen şunları yaz; her metot `self`'i tüketsin ve geçerli olmayan her durumda durumu
  **olduğu gibi** geri versin:

  - `kargola(self, takip_no: &str)`: yalnızca `Odendi` durumundan `Kargoda { takip_no }` durumuna geçer.
  - `teslim_et(self)`: yalnızca `Kargoda`'dan `Teslim`'e geçer; takip numarası **aynı** kalır.
  - `iptal_et(self, neden: &str)`: yalnızca `Bekliyor` ya da `Odendi` durumundaki bir sipariş iptal
    edilebilir. Kargoya verilmiş, teslim edilmiş ya da zaten iptal edilmiş bir sipariş değişmez.

  `clone` kullanmadan çöz: takip numarası `Kargoda`'dan `Teslim`'e **taşınmalı**.
starter: |
  #[derive(Debug)]
  enum SiparisDurumu {
      Bekliyor,
      Odendi { tutar: u32 },
      Kargoda { takip_no: String },
      Teslim { takip_no: String },
      Iptal { neden: String },
  }

  impl SiparisDurumu {
      fn ode(self, tutar: u32) -> SiparisDurumu {
          match self {
              SiparisDurumu::Bekliyor => SiparisDurumu::Odendi { tutar },
              diger => diger,
          }
      }

      fn kargola(self, takip_no: &str) -> SiparisDurumu {
          todo!()
      }

      fn teslim_et(self) -> SiparisDurumu {
          todo!()
      }

      fn iptal_et(self, neden: &str) -> SiparisDurumu {
          todo!()
      }
  }

  fn main() {
      let durum = SiparisDurumu::Bekliyor;
      let durum = durum.ode(450);
      println!("{durum:?}");
      let durum = durum.kargola("TR77AB");
      println!("{durum:?}");
      let durum = durum.iptal_et("vazgeçtim"); // kargodaki sipariş iptal edilemez
      println!("{durum:?}");
      let durum = durum.teslim_et();
      println!("{durum:?}");
  }
solution: |
  #[derive(Debug)]
  enum SiparisDurumu {
      Bekliyor,
      Odendi { tutar: u32 },
      Kargoda { takip_no: String },
      Teslim { takip_no: String },
      Iptal { neden: String },
  }

  impl SiparisDurumu {
      fn ode(self, tutar: u32) -> SiparisDurumu {
          match self {
              SiparisDurumu::Bekliyor => SiparisDurumu::Odendi { tutar },
              diger => diger,
          }
      }

      fn kargola(self, takip_no: &str) -> SiparisDurumu {
          match self {
              SiparisDurumu::Odendi { .. } => SiparisDurumu::Kargoda {
                  takip_no: String::from(takip_no),
              },
              diger => diger,
          }
      }

      fn teslim_et(self) -> SiparisDurumu {
          match self {
              SiparisDurumu::Kargoda { takip_no } => SiparisDurumu::Teslim { takip_no },
              diger => diger,
          }
      }

      fn iptal_et(self, neden: &str) -> SiparisDurumu {
          match self {
              SiparisDurumu::Bekliyor | SiparisDurumu::Odendi { .. } => SiparisDurumu::Iptal {
                  neden: String::from(neden),
              },
              diger => diger,
          }
      }
  }

  fn main() {
      let durum = SiparisDurumu::Bekliyor;
      let durum = durum.ode(450);
      println!("{durum:?}");
      let durum = durum.kargola("TR77AB");
      println!("{durum:?}");
      let durum = durum.iptal_et("vazgeçtim"); // kargodaki sipariş iptal edilemez
      println!("{durum:?}");
      let durum = durum.teslim_et();
      println!("{durum:?}");
  }
check: tests
tests: |
  fn yaz(d: &SiparisDurumu) -> String {
      format!("{d:?}")
  }

  #[test]
  fn mutlu_yol_bastan_sona() {
      let d = SiparisDurumu::Bekliyor.ode(450).kargola("TR77AB");
      assert_eq!(yaz(&d), "Kargoda { takip_no: \"TR77AB\" }", "ödenmiş sipariş kargoya verilebilmeli");
      let d = d.teslim_et();
      assert_eq!(yaz(&d), "Teslim { takip_no: \"TR77AB\" }", "teslimde takip numarası aynı kalmalı");
  }

  #[test]
  fn yalnizca_odenmis_siparis_kargolanir() {
      let d = SiparisDurumu::Bekliyor.kargola("TR1");
      assert_eq!(yaz(&d), "Bekliyor", "ödenmemiş sipariş kargoya verilmemeli");
      let d = SiparisDurumu::Iptal { neden: String::from("stok yok") }.kargola("TR2");
      assert_eq!(yaz(&d), "Iptal { neden: \"stok yok\" }", "iptal edilmiş sipariş kargoya verilmemeli");
      let d = SiparisDurumu::Bekliyor.ode(50).kargola("TR3").kargola("TR4");
      assert_eq!(yaz(&d), "Kargoda { takip_no: \"TR3\" }", "kargodaki sipariş yeniden kargolanınca takip numarası değişmemeli");
  }

  #[test]
  fn sadece_kargodaki_teslim_edilir() {
      let d = SiparisDurumu::Bekliyor.ode(100).teslim_et();
      assert_eq!(yaz(&d), "Odendi { tutar: 100 }", "kargoya verilmemiş sipariş teslim edilemez");
      let d = SiparisDurumu::Iptal { neden: String::from("stok yok") }.teslim_et();
      assert_eq!(yaz(&d), "Iptal { neden: \"stok yok\" }", "iptal edilmiş sipariş teslim edilemez");
      let d = SiparisDurumu::Bekliyor.teslim_et();
      assert_eq!(yaz(&d), "Bekliyor", "ödenmemiş sipariş teslim edilemez");
  }

  #[test]
  fn iptal_yalnizca_kargodan_once() {
      let d = SiparisDurumu::Bekliyor.iptal_et("vazgeçtim");
      assert_eq!(yaz(&d), "Iptal { neden: \"vazgeçtim\" }", "bekleyen sipariş iptal edilebilmeli");
      let d = SiparisDurumu::Bekliyor.ode(80).iptal_et("adres yanlış");
      assert_eq!(yaz(&d), "Iptal { neden: \"adres yanlış\" }", "ödenmiş (henüz kargolanmamış) sipariş iptal edilebilmeli");
  }

  #[test]
  fn kargodaki_ve_bitmis_siparis_iptal_edilemez() {
      let d = SiparisDurumu::Bekliyor.ode(80).kargola("TR9").iptal_et("geç kaldı");
      assert_eq!(yaz(&d), "Kargoda { takip_no: \"TR9\" }", "kargodaki sipariş iptal edilmemeli");
      let d = d.teslim_et().iptal_et("beğenmedim");
      assert_eq!(yaz(&d), "Teslim { takip_no: \"TR9\" }", "teslim edilmiş sipariş iptal edilmemeli");
      let d = SiparisDurumu::Iptal { neden: String::from("ilk") }.iptal_et("ikinci");
      assert_eq!(yaz(&d), "Iptal { neden: \"ilk\" }", "zaten iptal edilmiş siparişin nedeni değişmemeli");
  }
hints:
  - "Her metot `ode` ile aynı şekle sahip: `match self { GECERLI_DESEN => YENI_DURUM, diger => diger }`."
  - "`kargola`: `Odendi`'nin içindeki tutarla ilgilenmiyorsun; `SiparisDurumu::Odendi { .. }` deseni yeter. Yeni durumda takip numarası `String::from(takip_no)` olmalı. `teslim_et`: `SiparisDurumu::Kargoda { takip_no } => SiparisDurumu::Teslim { takip_no }`."
  - "`iptal_et`'te iki durum aynı sonucu veriyor: `SiparisDurumu::Bekliyor | SiparisDurumu::Odendi { .. } => SiparisDurumu::Iptal { neden: String::from(neden) },` ve ardından `diger => diger`."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: "`clone` kullanma: `self`'i tükettiğin için takip numarasını yeni duruma taşıyabilirsin."
explanation: |
  Dört metodun hepsi aynı kalıbı izliyor: **geçerli** başlangıç durumunu bir desenle yakala ve yeni
  durumu üret; geri kalan her şey için `diger => diger`. Geçiş kuralları böylece birer tablo satırı gibi
  okunuyor.

  `teslim_et`'te `Kargoda { takip_no }` deseni `String`'i eski durumdan çıkarıp (taşıyıp) doğrudan
  `Teslim { takip_no }`'ya koyuyor (alan adı kısaltması, Modül 6). Heap'teki veri kopyalanmıyor; bu
  yalnızca metot `self` aldığı için mümkün. `iptal_et`'teki `Bekliyor | Odendi { .. }`, aynı sonucu veren
  iki durumu tek kolda topluyor.

  Testlerde enum'u `{:?}` ile metne çevirip karşılaştırdık; çünkü enum'umuz `PartialEq` uygulamıyor
  (4. ders, E0369). Bunun yerine `matches!` de kullanılabilirdi:
  `assert!(matches!(d, SiparisDurumu::Odendi { tutar: 100 }))`.

  Tasarım notu: Bu enum'da "iptal edilmiş bir sipariş teslim edilemez" kuralı bir `match` kolunda yaşıyor.
  Bir sonraki adımdaki "Bir adım ötesi" kutusu, aynı kuralı **derleme zamanına** taşımanın bir yolunu gösteriyor.
````

## if zincirleri yerine enum + match

Durumları metinle tutan kodu her dilde görürsün. Trafik ışığının metin tabanlı hâli şöyle olsun. Dikkatle
oku ve ne yazdıracağını tahmin et:

```predict
code: |
  fn sonraki(isik: &str) -> &str {
      if isik == "kırmızı" {
          "kırmızı-sarı"
      } else if isik == "kırmızı-sarı" {
          "yeşil"
      } else if isik == "yesil" {
          "sarı"
      } else {
          "kırmızı"
      }
  }

  fn main() {
      let mut isik = "kırmızı";
      for _ in 0..4 {
          print!("{isik} → ");
          isik = sonraki(isik);
      }
      println!("{isik}");
  }
options:
  - "kırmızı → kırmızı-sarı → yeşil → sarı → kırmızı"
  - "kırmızı → kırmızı-sarı → yeşil → kırmızı → kırmızı-sarı"
  - "Derlenmez: `\"yesil\"` diye bir durum yok"
answer: 1
explanation: |
  Üçüncü koşulda bir yazım hatası var: `"yeşil"` yerine `"yesil"`. `"yeşil" == "yesil"` `false` olduğu
  için yeşil ışık hiçbir koşula uymaz ve `else`'e düşer: **sarı atlanır**, yeşilden doğrudan kırmızıya
  geçilir. Program derlenir, çalışır, hiçbir uyarı vermez; sadece **yanlış** davranır. Derleyici için
  `"yesil"` de `"yeşil"` gibi geçerli bir metindir; hangi metinlerin "durum" olduğunu bilemez.
```

Bu hata sınıfı, gerçek sistemlerde saatlerce aranan türdendir. Aynı yazım hatasını enum ile yaparsan:

:::error
```text
error[E0599]: no variant, associated function, or constant named `Yesl` found for enum `TrafikIsigi` in the current scope
 --> src/main.rs:7:26
  |
2 | enum TrafikIsigi {
  | ---------------- variant, associated function, or constant `Yesl` not found for this enum
...
7 |     let i = TrafikIsigi::Yesl;
  |                          ^^^^ variant, associated function, or constant not found in `TrafikIsigi`
  |
help: there is a variant with a similar name
  |
7 |     let i = TrafikIsigi::Yesil;
  |                             +
```
Derleyici yalnızca hatayı bulmakla kalmıyor, "benzer adlı bir varyant var" diyerek düzeltmeyi de öneriyor.
:::

Metin tabanlı durumlarla enum'ları yan yana koyalım:

| | Metin (`&str`) + `if` zinciri | Enum + `match` |
|---|---|---|
| Yazım hatası | derlenir, sessizce yanlış çalışır | derleme hatası (E0599) |
| Bir durumu unutmak | `else`'e düşer, fark edilmez | derleme hatası (E0004) |
| Yeni durum eklemek | ilgili her `if`'i elle bulmalısın | derleyici her eksik `match`'i listeler |
| Duruma özgü veri | ayrı alanlar, tutarsız olabilir | varyantın içinde, yalnızca orada |
| Olası değerler | sonsuz (her metin) | tam olarak tanımladıkların |

Gerçek durum makinelerinde geçiş yalnızca mevcut duruma değil, bir de **olaya (event)** bağlıdır.
Metro turnikesi düşün: kilitliyken kart basılırsa açılır; açıkken biri geçerse kilitlenir. Durum ile olayı
bir **tuple**'da toplayıp eşleştirmek, Rust'ta durum makinesi yazmanın en okunaklı yoludur:

```rust
#[derive(Debug)]
enum Turnike {
    Kilitli,
    Acik,
}

enum Olay {
    KartBas,
    Gec,
}

impl Turnike {
    fn isle(self, olay: Olay) -> Turnike {
        match (self, olay) {
            (Turnike::Kilitli, Olay::KartBas) => Turnike::Acik,
            (Turnike::Acik, Olay::Gec) => Turnike::Kilitli,
            (durum, _) => durum, // kilitliyken itmek ya da açıkken kart basmak bir şey değiştirmez
        }
    }
}

fn main() {
    let olaylar = [Olay::Gec, Olay::KartBas, Olay::KartBas, Olay::Gec];
    let mut turnike = Turnike::Kilitli;
    for olay in olaylar {
        turnike = turnike.isle(olay);
        println!("{turnike:?}");
    }
}
```

`match (self, olay)` iki değeri yeni bir tuple'a **taşır** ve desenler ikisini birlikte sınar. Her kol,
durum makinesi şemasındaki bir oku temsil ediyor. 2 durum × 2 olay = 4 kombinasyon var; son kolu silersen
derleyici eksik kalan `(Turnike::Kilitli, Olay::Gec)` ve `(Turnike::Acik, Olay::KartBas)`
kombinasyonlarını E0004 ile adlarıyla söyler.

:::deep Bir adım ötesi: geçersiz geçişleri de derleme zamanına taşımak
Enum'la modellediğimizde geçersiz **durumlar** yazılamıyor; ama geçersiz **geçişler** (iptal edilmiş
siparişi teslim etmek) hâlâ çalışma zamanında bir `diger => diger` koluna düşüyor. Daha sıkı bir tasarım,
her durumu **ayrı bir tip** yapmaktır. O zaman geçersiz bir geçiş, var olmayan bir metodu çağırmak olur:

```rust
struct Sepet {
    tutar: u32,
}

struct OdenmisSiparis {
    tutar: u32,
}

struct KargodakiSiparis {
    tutar: u32,
    takip_no: String,
}

impl Sepet {
    fn ode(self) -> OdenmisSiparis {
        OdenmisSiparis { tutar: self.tutar }
    }
}

impl OdenmisSiparis {
    fn kargola(self, takip_no: &str) -> KargodakiSiparis {
        KargodakiSiparis { tutar: self.tutar, takip_no: String::from(takip_no) }
    }
}

fn main() {
    let sepet = Sepet { tutar: 300 };
    // sepet.kargola("TR1"); // E0599: Sepet'in kargola diye bir metodu yok!
    let kargoda = sepet.ode().kargola("TR1");
    println!("{} TL, takip: {}", kargoda.tutar, kargoda.takip_no);
}
```

Bu kalıba **typestate** (tip-durum) denir. Bedeli daha fazla tip ve tüm durumları tek bir listede
tutmanın zorlaşmasıdır (bir `Vec`'e hem `Sepet` hem `OdenmisSiparis` koyamazsın). Generic'leri ve
trait'leri öğrendikten sonra bu kalıbı çok daha zarif yazabileceksin. Çoğu zaman enum yeterlidir.
:::

Şimdi modülün en büyük alıştırması: gerçek bir otomatın beyni.

````exercise
id: m07-e-otomat
title: İçecek otomatı
difficulty: 4
prompt: |
  Okulun kantinindeki içecek otomatını bir durum makinesiyle modelle. Durumlar ve olaylar hazır;
  `isle` metodunu `match (self, olay)` ile yaz:

  | Mevcut durum | Olay | Yeni durum |
  |---|---|---|
  | `Bekliyor` | `ParaAt(m)` | `Kredili { kredi: m }` |
  | `Kredili { kredi }` | `ParaAt(m)` | `Kredili { kredi: kredi + m }` |
  | `Kredili { kredi }` | `Sec { urun, fiyat }`, kredi yetiyorsa | `Veriyor { urun, para_ustu: kredi - fiyat }` |
  | `Kredili { kredi }` | `Sec { .. }`, kredi yetmiyorsa | aynı kalır: `Kredili { kredi }` |
  | `Kredili { .. }` | `Iptal` | `Bekliyor` (para iade edilir) |
  | `Veriyor { .. }` | `Al` | `Bekliyor` |
  | başka her kombinasyon | | durum **aynen** kalır |

  Örneğin içecek verilirken atılan para kabul edilmez; boş otomatta ürün seçmek bir şey yapmaz.
starter: |
  #[derive(Debug)]
  enum Otomat {
      Bekliyor,
      Kredili { kredi: u32 },
      Veriyor { urun: String, para_ustu: u32 },
  }

  enum Olay {
      ParaAt(u32),
      Sec { urun: String, fiyat: u32 },
      Iptal,
      Al,
  }

  impl Otomat {
      fn isle(self, olay: Olay) -> Otomat {
          todo!()
      }
  }

  fn main() {
      let olaylar = [
          Olay::ParaAt(10),
          Olay::Sec { urun: String::from("ayran"), fiyat: 15 },
          Olay::ParaAt(10),
          Olay::Sec { urun: String::from("ayran"), fiyat: 15 },
          Olay::ParaAt(5),
          Olay::Al,
          Olay::Iptal,
      ];
      let mut otomat = Otomat::Bekliyor;
      for olay in olaylar {
          otomat = otomat.isle(olay);
          println!("{otomat:?}");
      }
  }
solution: |
  #[derive(Debug)]
  enum Otomat {
      Bekliyor,
      Kredili { kredi: u32 },
      Veriyor { urun: String, para_ustu: u32 },
  }

  enum Olay {
      ParaAt(u32),
      Sec { urun: String, fiyat: u32 },
      Iptal,
      Al,
  }

  impl Otomat {
      fn isle(self, olay: Olay) -> Otomat {
          match (self, olay) {
              (Otomat::Bekliyor, Olay::ParaAt(m)) => Otomat::Kredili { kredi: m },
              (Otomat::Kredili { kredi }, Olay::ParaAt(m)) => Otomat::Kredili { kredi: kredi + m },
              (Otomat::Kredili { kredi }, Olay::Sec { urun, fiyat }) => {
                  if kredi >= fiyat {
                      Otomat::Veriyor { urun, para_ustu: kredi - fiyat }
                  } else {
                      Otomat::Kredili { kredi }
                  }
              }
              (Otomat::Kredili { .. }, Olay::Iptal) => Otomat::Bekliyor,
              (Otomat::Veriyor { .. }, Olay::Al) => Otomat::Bekliyor,
              (durum, _) => durum,
          }
      }
  }

  fn main() {
      let olaylar = [
          Olay::ParaAt(10),
          Olay::Sec { urun: String::from("ayran"), fiyat: 15 },
          Olay::ParaAt(10),
          Olay::Sec { urun: String::from("ayran"), fiyat: 15 },
          Olay::ParaAt(5),
          Olay::Al,
          Olay::Iptal,
      ];
      let mut otomat = Otomat::Bekliyor;
      for olay in olaylar {
          otomat = otomat.isle(olay);
          println!("{otomat:?}");
      }
  }
check: tests
tests: |
  fn yaz(o: &Otomat) -> String {
      format!("{o:?}")
  }

  fn sec(urun: &str, fiyat: u32) -> Olay {
      Olay::Sec { urun: String::from(urun), fiyat }
  }

  #[test]
  fn para_atildikca_kredi_birikir() {
      let o = Otomat::Bekliyor.isle(Olay::ParaAt(5));
      assert_eq!(yaz(&o), "Kredili { kredi: 5 }", "boş otomata para atınca kredi oluşmalı");
      let o = o.isle(Olay::ParaAt(10)).isle(Olay::ParaAt(1));
      assert_eq!(yaz(&o), "Kredili { kredi: 16 }", "5 + 10 + 1 = 16 kredi");
  }

  #[test]
  fn kredi_yetince_urun_ve_para_ustu_verilir() {
      let o = Otomat::Kredili { kredi: 20 }.isle(sec("su", 15));
      assert_eq!(yaz(&o), "Veriyor { urun: \"su\", para_ustu: 5 }", "20 - 15 = 5 para üstü");
      let o = Otomat::Kredili { kredi: 15 }.isle(sec("ayran", 15));
      assert_eq!(yaz(&o), "Veriyor { urun: \"ayran\", para_ustu: 0 }", "kredi fiyata tam eşitse de ürün verilmeli");
  }

  #[test]
  fn kredi_yetmezse_durum_degismez() {
      let o = Otomat::Kredili { kredi: 14 }.isle(sec("ayran", 15));
      assert_eq!(yaz(&o), "Kredili { kredi: 14 }", "14 kredi 15'lik ürüne yetmez, kredi korunmalı");
  }

  #[test]
  fn iptal_ve_urunu_almak_bekleme_durumuna_dondurur() {
      let o = Otomat::Kredili { kredi: 30 }.isle(Olay::Iptal);
      assert_eq!(yaz(&o), "Bekliyor", "iptal edilince para iade edilip başa dönülmeli");
      let o = Otomat::Veriyor { urun: String::from("çay"), para_ustu: 2 }.isle(Olay::Al);
      assert_eq!(yaz(&o), "Bekliyor", "ürün alınınca otomat yeni müşteriyi beklemeli");
  }

  #[test]
  fn gecersiz_olaylar_durumu_degistirmez() {
      assert_eq!(yaz(&Otomat::Bekliyor.isle(sec("su", 10))), "Bekliyor", "boş otomatta seçim bir şey yapmamalı");
      assert_eq!(yaz(&Otomat::Bekliyor.isle(Olay::Al)), "Bekliyor", "verilen ürün yokken Al bir şey yapmamalı");
      assert_eq!(yaz(&Otomat::Bekliyor.isle(Olay::Iptal)), "Bekliyor");
      let o = Otomat::Veriyor { urun: String::from("su"), para_ustu: 5 }.isle(Olay::ParaAt(10));
      assert_eq!(yaz(&o), "Veriyor { urun: \"su\", para_ustu: 5 }", "ürün verilirken atılan para kabul edilmemeli");
      let o = Otomat::Kredili { kredi: 7 }.isle(Olay::Al);
      assert_eq!(yaz(&o), "Kredili { kredi: 7 }", "henüz ürün seçilmemişken Al krediyi silmemeli");
  }
hints:
  - "İskelet: `match (self, olay) { (Otomat::Bekliyor, Olay::ParaAt(m)) => Otomat::Kredili { kredi: m }, ... (durum, _) => durum }`. Son kol, tablodaki \"başka her kombinasyon\" satırıdır ve en sonda olmalı."
  - "Seçim kolu bir değer yakalayıp bir karar veriyor: `(Otomat::Kredili { kredi }, Olay::Sec { urun, fiyat }) => { if kredi >= fiyat { ... } else { ... } }`. Kredi yetmiyorsa eski durumu yeniden kurman gerekir: `Otomat::Kredili { kredi }`."
  - "İçeriğiyle ilgilenmediğin varyantlar için `..` kullan: `(Otomat::Kredili { .. }, Olay::Iptal) => Otomat::Bekliyor,` ve `(Otomat::Veriyor { .. }, Olay::Al) => Otomat::Bekliyor,`."
require:
  - pattern: 'match\s*\(\s*self\s*,\s*olay\s*\)'
    message: "Durum ve olayı birlikte eşleştir: `match (self, olay) { ... }`."
explanation: |
  `match (self, olay)` durumu ve olayı tek bir tuple'da topluyor; böylece tablonun her satırı bir kola
  dönüşüyor. Kod, şartnamenin neredeyse birebir kopyası: okuyan biri iş kuralını doğrudan görebiliyor.

  Dikkat çeken üç nokta:

  - **Seçim kolu**: `Kredili { kredi }` ve `Sec { urun, fiyat }` desenleri, ikisinin içindeki değerleri
    tek seferde yakalıyor. `urun` (`String`) olaydan yeni duruma **taşınıyor**; kopya yok.
  - **Kredi yetmediğinde** `self` artık tuple'a taşınmış olduğu için "eski durumu geri ver" diyemiyoruz;
    yakaladığımız `kredi` ile `Otomat::Kredili { kredi }`'yi yeniden kuruyoruz. Bu ucuzdur, yalnızca bir
    `u32`. (Modül 21'de göreceğin **match guard**'lar, `if kredi >= fiyat` koşulunu desenin içine yazıp
    yetmeyen durumu `(durum, _) => durum` koluna bırakmayı mümkün kılar.)
  - **Sıra**: `(durum, _) => durum` her şeye uyar; en sonda olmalı. Önde olsaydı derleyici diğer kolların
    ulaşılamaz olduğunu söylerdi (*unreachable pattern*).

  Bu kalıp gerçek dünyada çok yaygın: ağ protokolleri (TCP bağlantı durumları), oyunlardaki yapay zekâ,
  arayüz akışları, ödeme sistemleri... Hepsi "durum × olay → yeni durum" tablosudur ve Rust'ta hepsi
  derleyicinin denetlediği bir `match`'e dönüşür.
````

## Özet

:::remember
- **Geçersiz durumları temsil edilemez kıl**: birbirini dışlayan bool'lar ve `Option` alanları yerine
  her geçerli durumu bir enum varyantı yap. Tip izin vermiyorsa hata da oluşamaz.
- Duruma özgü veri **o varyantın içinde** yaşar (`Kargoda { takip_no }`). Ortak veri struct'ta, değişen
  kısım bir enum alanında.
- Enum'un alanı olmaz, varyantın olur: `durum.takip_no` → E0609. Veriye desenle ulaşılır.
- Durum makinesi = durumlar + geçişler. Sorgular `&self`, geçişler `self` alır ve yeni durumu döndürür:
  `isik = isik.sonraki();`. Eski durum taşındığı için yanlışlıkla kullanılamaz (E0382) ve veri kopyalanmadan
  yeni duruma geçer.
- Olaylı makineler: `match (self, olay) { (Durum, Olay) => yeni, ..., (durum, _) => durum }`.
- Metin tabanlı durumlarda yazım hatası sessizce derlenir; enum'da E0599, unutulan durum E0004 olur.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — "geçersiz durumları temsil edilemez kılmak" ne demektir? Bunu bool
  alanlarla dolu bir struct'ı enum'a çevirdiğimiz sipariş örneği üzerinden anlat. Geçiş metotlarının
  `self` alması bu güvenliğe ne katar?
answer: |
  Model cevap: Bool alanlı struct'ta üç bool 8 kombinasyon oluşturuyordu ama yalnızca 4'ü gerçek bir
  sipariş durumuydu; "ödenmedi ama teslim edildi" gibi değerler oluşturulabiliyordu ve bunları ancak
  çalışma zamanında kontrollerle yakalayabilirdik. Enum'a çevirince tip yalnızca beş geçerli durumu
  tanıyor ve her durumun verisi (takip numarası, iptal nedeni) yalnızca ilgili varyantta var; geçersiz bir
  değer yazmanın yolu kalmıyor. Geçiş metotlarının `self` alması, eski durumu tüketiyor: ödeme yapıldıktan
  sonra elimde "bekliyor" diyen eski bir değer kalmıyor ve onu kullanmaya çalışırsam derleyici E0382
  veriyor. Ayrıca takip numarası gibi veriler kopyalanmadan yeni duruma taşınıyor.
```

```flashcards
- front: "\"Make illegal states unrepresentable\" ilkesi ne söyler?"
  back: "Tipi, geçersiz değerler **oluşturulamayacak** şekilde tasarla; geçersiz durumu çalışma zamanında kontrol etmek yerine yazılamaz kıl."
- front: "Üç `bool` alan kaç kombinasyon oluşturur? Bu neden tehlikelidir?"
  back: "2 × 2 × 2 = 8. Anlamlı durum sayısı genellikle çok daha azdır; geri kalanlar tipin izin verdiği geçersiz durumlardır."
- front: "`siparis.durum.takip_no` neden derlenmez (E0609)?"
  back: "Enum'un alanı yoktur, varyantlarının vardır. Takip numarasına ancak `Kargoda { takip_no }` gibi bir desenle o varyantta olduğunu kanıtlayınca ulaşılır."
- front: "Durum makinesi geçişlerini `self` alıp yeni durumu döndürerek yazmanın iki faydası nedir?"
  back: "1) Eski durum tüketilir: `&self` ile yeni durum döndürseydin elinde eskimiş bir kopya kalırdı; `self` ile onu kullanmak E0382 verir. 2) Varyantın içindeki veri (ör. `String`) kopyalanmadan yeni duruma taşınır; `&mut self`'te bunun için `std::mem::replace` gerekirdi."
- front: "`isik = isik.sonraki();` satırı, `sonraki(self)` `isik`'i taşıdığı hâlde neden derlenir?"
  back: "Taşınmış bir `mut` değişkene yeni değer atamak serbesttir; yasak olan, yeni değer almadan onu kullanmaktır."
- front: "Olaylı bir durum makinesinin geçiş fonksiyonu tipik olarak nasıl yazılır?"
  back: "`match (self, olay) { (Durum::A, Olay::X) => Durum::B, ..., (durum, _) => durum }`"
- front: "Durumları `\"yeşil\"` gibi metinlerle tutmanın iki büyük riski nedir?"
  back: "Yazım hataları derlenir ve sessizce yanlış çalışır; unutulan bir durum `else`'e düşer. Enum'da ikisi de derleme hatasıdır (E0599, E0004)."
- front: "Bilgiler ne zaman struct'ta `Option` alanlar, ne zaman ayrı enum varyantları olmalı?"
  back: "Birbirinden bağımsızsa (`ve`) `Option` alanlar; birbirini dışlıyorsa (`veya`) her biri kendi enum varyantında."
```
