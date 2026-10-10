---
id: m08-l01
title: Paket, Crate ve Modül
minutes: 15
type: lesson
objectives:
  - Paket (package), crate ve modül kavramlarını birbirinden ayırt edebilmek
  - Bir paketteki binary ve library crate'leri ile bunların kök dosyalarını (`src/main.rs`, `src/lib.rs`) söyleyebilmek
  - Satır içi `mod` bloklarıyla bir modül ağacı kurup öğelere `::` yollarıyla erişebilmek
keywords: [paket, package, crate, modül, module, mod, binary crate, library crate, crate kökü, modül ağacı, E0428]
---

Modül 6'daki kütüphane envanterini hatırla: birkaç struct, birkaç metot, hepsi tek bir `main.rs`
dosyasında. Şimdi bu programın büyüdüğünü düşün: üyeler, gecikme cezaları, raporlar, e-posta
bildirimleri... Birkaç ay sonra 5.000 satırlık tek bir dosyada `kaydet` adlı üç farklı fonksiyonu
birbirinden ayırmaya çalışıyor olursun.

Gerçek Rust projeleri — derleyicinin kendisi, Firefox'un parçaları, Discord'un sunucuları — yüz binlerce
satırdır ve yine de düzenlidir. Sırları, Rust'ın kodu düzenlemek için sunduğu üç katmanlı sistemdir:
**paketler (packages)**, **crate**'ler ve **modüller (modules)**. Bu derste büyük resmi kuruyoruz.

:::ferris
Modül sistemi, Rust'a yeni başlayanların kafasının en çok karıştığı konulardan biridir — ama aslında
birkaç basit kuraldan ibarettir. Her kuralı tek tek, örnekle oturtacağız. 🦀
:::

## Büyüyen kodun üç derdi

Aşağıdaki programda bir şirketin iki departmanı için rapor fonksiyonları var. Açıklamaya geçmeden önce
tahmin et:

```compiles
code: |
  fn rapor() -> String {
      String::from("Muhasebe: 3 fatura bekliyor")
  }

  fn rapor() -> String {
      String::from("Satış: bugün 12 sipariş")
  }

  fn main() {
      println!("{}", rapor());
  }
answer: false
error: E0428
explanation: |
  Aynı isim alanında (burada programın en üst seviyesinde) iki öğe aynı adı taşıyamaz:
  **E0428 — the name `rapor` is defined multiple times**. Derleyici hangi `rapor`'u kastettiğini
  bilemez. Küçük programlarda bu nadiren sorun olur; ama yüzlerce fonksiyonlu bir projede `rapor`,
  `kaydet`, `hesapla` gibi güzel isimler kaçınılmaz olarak çakışır.
```

Program büyüdükçe üç dert ortaya çıkar:

1. **Bulmak:** Yüzlerce fonksiyon tek bir düz listede durursa aradığını bulamazsın. İlgili kodun bir
   arada durması gerekir.
2. **İsim çakışması:** Tek bir isim alanında (namespace) herkes aynı güzel isimleri kullanmak ister ve
   isimler çarpışır.
3. **Korumak:** Bazı fonksiyonlar ve veriler iç ayrıntıdır; programın geri kalanının onlara dokunmaması
   gerekir — tıpkı bir bankanın kasası gibi.

Rust'ın üçüne birden cevabı **modüllerdir**:

```rust
mod muhasebe {
    pub fn rapor() -> String {
        String::from("Muhasebe: 3 fatura bekliyor")
    }
}

mod satis {
    pub fn rapor() -> String {
        String::from("Satış: bugün 12 sipariş")
    }
}

fn main() {
    println!("{}", muhasebe::rapor());
    println!("{}", satis::rapor());
}
```

Bu kodda üç yeni şey var:

- `mod muhasebe { ... }` bir **modül** tanımlar. İçine koyduğun her şey `muhasebe` adlı ayrı bir isim
  alanında yaşar; bu yüzden iki `rapor` artık çakışmaz.
- `pub` (*public*, "herkese açık") bu fonksiyonun modülün **dışından** da çağrılabileceğini söyler.
  Rust'ta her şey varsayılan olarak gizlidir; `pub`'ı bir sonraki derste derinlemesine inceleyeceğiz.
- `muhasebe::rapor()` bir **yol (path)**dur: "`muhasebe` modülünün içindeki `rapor`". `::` ayırıcısını
  aslında tanıyorsun: `String::from` da "`String` tipinin içindeki `from`" demekti.

:::analogy Şirketteki iki Ahmet
Bir şirkette iki Ahmet çalışabilir: Muhasebe'den Ahmet ve Satış'tan Ahmet. Kimse karıştırmaz, çünkü
gerektiğinde **departmanıyla birlikte** söylersin. Departmanlar modüllerdir; `muhasebe::rapor` da
"Muhasebe'nin raporu" demektir. Departman kapılarındaki "Sadece personel" levhası ise gizliliktir:
bazı odalara dışarıdan girilmez.
:::

:::info Diğer diller bu dertleri nasıl çözüyor?
- **C**'de dışarıya açık bütün fonksiyonlar tek bir küresel isim alanını paylaşır ve `#include` bir
  dosyanın içeriğini olduğu gibi yapıştırır. Kütüphaneler çakışmayı isimlerin başına önek koyarak önler:
  `SDL_Init`, `sqlite3_open`.
- **Python**'da her dosya kendiliğinden bir modüldür; `_gizli` gibi alt çizgiyle başlayan isimler
  yalnızca bir **gelenektir**, dil seni durdurmaz.
- **Java**'da paketler klasör yapısını izler ve `public`/`private` gibi erişim belirteçleri vardır.
- **Rust**'ta modül ağacı kodun içinde **açıkça** bildirilir ve gizlilik kuralları **derleyici
  tarafından zorunlu** kılınır.
:::

## Üç katman: paket, crate, modül

Rust'ın düzenleme sistemi iç içe üç katmandan oluşur. En küçükten başlayalım:

- **Modül (module):** Bir crate'in **içinde** kodu gruplayan, kendi isim alanı ve gizlilik sınırı olan
  yapı. `mod` anahtar kelimesiyle kurarsın.
- **Crate:** Derleyicinin **tek seferde** ele aldığı kod birimi (derleme birimi, *compilation unit*).
  `rustc main.rs` dediğinde `main.rs` bir crate'in kök dosyasıdır; derleyici modül ağacının tamamını
  oradan başlayarak okur. İki türü var: **binary crate** (çalıştırılabilir program üretir) ve
  **library crate** (başka kodların kullanacağı bir kütüphane üretir).
- **Paket (package):** Bir veya daha fazla crate'i bir araya getiren ve onların nasıl derleneceğini
  `Cargo.toml` dosyasıyla anlatan **Cargo** birimi. `cargo new` her seferinde bir paket oluşturur.

| Katman | Nedir? | Kim ilgilenir? | Örnek |
|---|---|---|---|
| Paket | `Cargo.toml` + bir ya da daha çok crate | Cargo | `cargo new oyun` |
| Crate | Derleme birimi; bir modül ağacının tamamı | `rustc` | kökü `src/main.rs` olan program |
| Modül | Crate içinde isim alanı + gizlilik sınırı | Sen (`mod`) | `mod mutfak { ... }` |

:::analogy Bir kitap seti
Paketi, üzerinde etiketi olan bir **kitap seti kolisi** gibi düşün. Etiket (`Cargo.toml`) setin adını,
sürümünü ve ihtiyaçlarını yazar. Kolideki her **kitap** bir crate'tir: matbaa (derleyici) her kitabı
ayrı ayrı basar. Bir sette en fazla bir **başvuru kitabı** (library crate — baştan sona okunmaz, ihtiyaç
duyulan yerine bakılır) bulunur ama istediğin kadar **hikâye kitabı** (binary crate — `main`'den başlar,
sonuna kadar akar) olabilir. Her kitabın **bölümleri ve alt bölümleri** modüllerdir; içindekiler tablosu
da modül ağacıdır.
:::

```quiz
question: |
  Aşağıdaki sıralamalardan hangisi Rust'taki kapsama ilişkisini **büyükten küçüğe** doğru veriyor?
options:
  - "Paket ⊃ crate ⊃ modül ⊃ öğe (fonksiyon, struct...)"
  - "Crate ⊃ paket ⊃ modül ⊃ öğe"
  - "Modül ⊃ crate ⊃ paket ⊃ öğe"
  - "Paket ⊃ modül ⊃ crate ⊃ öğe"
answer: 0
explanation: |
  **Paket** (`Cargo.toml` + crate'ler) en dıştadır. Her **crate** kendi modül ağacına sahiptir; ağacın
  kökü crate'in kök dosyasıdır. **Modüllerin** içinde de fonksiyonlar, struct'lar, enum'lar gibi
  **öğeler** durur. Rust topluluğunda "crate" denince çoğunlukla bir library crate kastedilir:
  "`regex` crate'ini ekledim" gibi.
feedback:
  - Doğru!
  - Ters oldu; crate'leri bir araya getiren ve `Cargo.toml` taşıyan birim pakettir.
  - Modüller bir crate'in **içinde** yaşar; bir modülün içinde crate bulunmaz.
  - "Python'daki \"paket içinde modüller\" düzenine benziyor ama Rust'ta modüller crate'in içindedir, crate'ler de paketin."
```

## Binary crate, library crate ve crate kökü

Cargo bir paketteki crate'leri **dosya düzenine bakarak** bulur:

- `src/main.rs` varsa: paketle **aynı adı** taşıyan bir **binary crate** vardır; kökü bu dosyadır.
- `src/lib.rs` varsa: paketle aynı adı taşıyan bir **library crate** vardır; kökü bu dosyadır. (Paket
  adında tire varsa kodda kullanılan crate adında alt çizgiye döner: `oyun-motoru` → `oyun_motoru`.)
- `src/bin/` klasöründeki her `.rs` dosyası **ayrı bir binary crate**'tir.
- Bir pakette **en az bir** crate bulunur; **en fazla bir** library crate olabilir, binary crate sayısı
  ise sınırsızdır.

```text
oyun/                   ← paket (package)
├── Cargo.toml          ← paketin kimlik kartı
└── src/
    ├── main.rs         ← binary crate kökü   → oyun.exe
    ├── lib.rs          ← library crate kökü  → oyun kütüphanesi
    └── bin/
        └── editor.rs   ← ikinci binary crate → editor.exe
```

```toml
[package]
name = "oyun"
version = "0.1.0"
edition = "2024"
```

`cargo new oyun`, `Cargo.toml`'un yanına kaynak dosyası olarak yalnızca `src/main.rs` oluşturur
(binary paket); `cargo new --lib oyun` ise `src/lib.rs` oluşturur (library paket). Birden fazla binary varken hangisini çalıştıracağını
`cargo run --bin editor` ile seçersin.

**Crate kökü (crate root)**, derleyicinin işe başladığı dosyadır. Bu dosyanın içeriği adı `crate` olan
**kök modülü** oluşturur; projendeki bütün modüller bu kökün altında dallanır.

Binary ile library arasındaki fark tek bir fonksiyonda saklı: `main`. Şu kodu düşün:

```compiles
question: |
  Bu kodda `main` fonksiyonu yok. Kod bir **library crate** olarak (kökü `src/lib.rs`) derlenirse
  derlenir mi?
code: |
  pub fn kdv_ekle(fiyat: f64) -> f64 {
      fiyat * 1.20
  }

  pub fn indirim_uygula(fiyat: f64, yuzde: f64) -> f64 {
      fiyat * (1.0 - yuzde / 100.0)
  }
answer: true
explanation: |
  Derlenir! `main` yalnızca **binary crate**'ler için zorunludur, çünkü çalıştırılabilir bir programın
  bir **giriş noktası (entry point)** olmalıdır ve Rust'ta bu `main`'dir. Library crate'in bir başlangıç
  noktası yoktur; başkalarının çağıracağı fonksiyonları ve tipleri sunar. Kütüphaneler tek başına
  çalıştırılmaz, **kullanılır**.
```

Aynı kodu `src/main.rs` dosyasına koyup bir **binary crate** olarak derlemeye kalksaydın derleyici
şunu söylerdi:

:::error
```text
error[E0601]: `main` function not found in crate `hesap`
 --> src/main.rs:7:2
  |
7 | }
  |  ^ consider adding a `main` function to `src/main.rs`
```
Hata kodu ve özet net: `hesap` crate'inde `main` bulunamadı. Derleyici dosyanın sonunu gösterir ve
`main` eklemeni önerir. Ama asıl soru şudur: bu kod gerçekten bir program mı, yoksa bir kütüphane mi?
Kütüphaneyse doğru yeri `src/lib.rs`'tir.
:::

:::tip Bu uygulamada da aynısı geçerli
Bu uygulamadaki bir kod bloğunda `fn main` yoksa blok bir **library crate** olarak derlenir:
"Çalıştır" yerine "Derle" düğmesi görürsün. Artık nedenini biliyorsun!
:::

```quiz
question: |
  Bir paketin `src` klasöründe şu dosyalar var: `main.rs`, `lib.rs`, `bin/sunucu.rs`, `bin/istemci.rs`.
  Bu pakette **kaç crate** vardır?
options:
  - "1 — paketin kendisi tek bir crate'tir"
  - "2 — bir binary, bir library"
  - "4 — üç binary crate ve bir library crate"
  - "Hiçbiri; bir pakette yalnızca bir binary crate olabilir"
answer: 2
explanation: |
  `main.rs` bir binary crate'in, `lib.rs` library crate'in köküdür; `src/bin/` altındaki her dosya da
  ayrı bir binary crate'tir. Toplam **3 binary + 1 library = 4 crate**. Kural: en fazla **bir**
  library, istediğin kadar binary.
feedback:
  - Paket, crate'lerin **kabıdır**; içinde birden çok crate bulunabilir.
  - "`src/bin/` klasöründeki dosyaları unuttun: her biri ayrı bir binary crate'tir."
  - Doğru!
  - Sınır library crate'ler içindir (en fazla bir); binary crate sayısı serbesttir.
```

:::deep Neden "derleme birimi" önemli?
`rustc` bir crate'i bir bütün olarak derler: içindeki tek bir satırı değiştirsen bile o crate yeniden
derlenir (artımlı derleme — *incremental compilation* — bu işi hızlandırır). Bağımlılıklar ise bir kez
derlenip `target/` klasöründe saklanır; bu yüzden ilk `cargo build` yavaş, sonrakiler hızlıdır. Büyük
projeler bu sebeple kodlarını birden çok crate'e böler: birbirine bağımlı olmayan crate'ler paralel
derlenebilir ve bir crate'te yaptığın değişiklik yalnızca o crate'i ve **ona bağımlı** olanları yeniden
derletir; ilgisiz crate'lere dokunulmaz. Birden çok paketi tek çatı altında toplamayı (*workspace*)
Modül 16'da göreceğiz.
:::

## Modül ağacı

Bir crate'in içindeki modüller bir **ağaç (tree)** oluşturur. Küçük bir lokanta programı yazalım:

```rust
mod mutfak {
    pub mod corbalar {
        pub fn mercimek() -> String {
            String::from("Mercimek çorbası")
        }
    }

    pub mod tatlilar {
        pub fn sutlac() -> String {
            String::from("Fırın sütlaç")
        }
    }
}

mod salon {
    pub fn masa_ac(kisi: u32) {
        println!("{kisi} kişilik masa hazır.");
    }
}

fn main() {
    salon::masa_ac(4);
    println!("Başlangıç: {}", mutfak::corbalar::mercimek());
    println!("Tatlı: {}", mutfak::tatlilar::sutlac());
}
```

Bu kodun modül ağacı şöyle:

```text
crate                       ← kök modül: main.rs dosyasının kendisi
 ├── mutfak
 │    ├── corbalar
 │    │    └── mercimek()
 │    └── tatlilar
 │         └── sutlac()
 ├── salon
 │    └── masa_ac()
 └── main()
```

`mutfak` modülü `corbalar`'ın **üst modülüdür** (*parent*); `corbalar` ise `mutfak`'ın **alt
modülüdür** (*child*). `corbalar` ile `tatlilar` **kardeştir** (*sibling*): ikisi de aynı modülün
içindedir. Bilgisayarındaki klasörler gibi düşün: `crate` kök klasör, modüller alt klasörler,
fonksiyonlar da dosyalar.

Bir öğeye ulaşmak için ağaçta kökten aşağı inersin ve her adımı `::` ile ayırırsın:
`mutfak::corbalar::mercimek()` — klasör yolundaki `mutfak/corbalar/mercimek` gibi.

`corbalar` ve `tatlilar` modüllerinin başında da `pub` olduğuna dikkat et: `main`, `mutfak`'ın
**dışında** duruyor ve içerideki modülleri görebilmesi için onların açık olması gerekiyor. Peki neden
`mutfak`'ın başında `pub` gerekmedi? Cevabı bir sonraki derste.

```predict
code: |
  mod kahvalti {
      pub fn fiyat() -> u32 {
          250
      }
  }

  mod aksam {
      pub fn fiyat() -> u32 {
          400
      }

      pub mod tatli {
          pub fn fiyat() -> u32 {
              120
          }
      }
  }

  fn fiyat() -> u32 {
      1
  }

  fn main() {
      let toplam = kahvalti::fiyat() + aksam::tatli::fiyat();
      println!("{toplam}");
      println!("{}", aksam::fiyat() + fiyat());
  }
options:
  - |
    370
    401
  - |
    650
    401
  - |
    370
    400
  - Derlenmez, çünkü `fiyat` adı birden çok kez tanımlanmış
answer: 0
explanation: |
  Dört ayrı `fiyat` fonksiyonu var ama her biri **farklı bir modülde**, yani farklı bir isim alanında.
  `kahvalti::fiyat()` 250, `aksam::tatli::fiyat()` 120 döndürür: toplam **370**. İkinci satırda
  `aksam::fiyat()` (400) ile kök modüldeki `fiyat()` (1) toplanır: **401**.

  Yolun **tamamı** hangi fonksiyonun çağrıldığını belirler: `aksam::fiyat` ile `aksam::tatli::fiyat`
  farklı fonksiyonlardır. Çakışma (E0428) ancak **aynı modülün içinde** aynı ad iki kez kullanılınca olur.
```

Şimdi sıra sende. Satırları sıraya koyarak iki seviyeli bir modül ağacı kur:

```parsons
prompt: |
  Satırları sıraya koyarak `okul::mudurluk::duyuru()` fonksiyonunu tanımlayan ve çağıran programı kur.
  Girintiler otomatik ayarlanır; iki satır fazladan konmuş tuzaktır.
lines: |
  mod okul {
      pub mod mudurluk {
          pub fn duyuru() {
              println!("Yarın okul tatil!");
          }
      }
  }
  fn main() {
      okul::mudurluk::duyuru();
  }
distractors: |
      mod mudurluk {
      okul.mudurluk.duyuru();
explanation: |
  `mudurluk`, `okul`'un **içinde** tanımlandığı için yolu `okul::mudurluk` olur. Modül yollarında `::`
  kullanılır; `.` (nokta) ise bir **değerin** alanına ya da metoduna erişmek içindir (`hesap.bakiye`
  gibi). Başında `pub` olmayan `mod mudurluk {` satırı ise bu programda işe yaramaz: `main`, `okul`'un
  dışında olduğundan gizli bir alt modülü göremez.
```

## Modülün içinde neler olabilir?

Modüller yalnızca fonksiyon taşımaz. Bir modülün içine koyabileceğin her şeye **öğe (item)** denir:

| Öğe | Örnek |
|---|---|
| fonksiyon | `fn hesapla() {}` |
| struct ve enum | `struct Sehir { ... }`, `enum Durum { ... }` |
| `impl` bloğu | `impl Sehir { ... }` |
| sabit (`const`) ve `static` | `const SICAK_ESIGI: i32 = 30;` |
| başka bir modül | `mod alt { ... }` |
| `use` bildirimi | Ders 4'te göreceğiz |

Modül 6 ve 7'de öğrendiklerinin hepsi bir modülün içinde de aynen çalışır:

```rust
mod hava {
    pub const SICAK_ESIGI: i32 = 30;

    pub enum Durum {
        Gunesli(i32),
        Yagmurlu,
        Karli,
    }

    pub struct Sehir {
        pub ad: String,
        pub durum: Durum,
    }

    impl Sehir {
        pub fn tavsiye(&self) -> String {
            match self.durum {
                Durum::Gunesli(derece) => {
                    if derece >= SICAK_ESIGI {
                        format!("{}: Şapkanı al, hava {derece}°C!", self.ad)
                    } else {
                        format!("{}: Güzel bir gün, {derece}°C.", self.ad)
                    }
                }
                Durum::Yagmurlu => format!("{}: Şemsiyeni unutma.", self.ad),
                Durum::Karli => format!("{}: Atkı, bere, eldiven!", self.ad),
            }
        }
    }
}

fn main() {
    let antalya = hava::Sehir { ad: String::from("Antalya"), durum: hava::Durum::Gunesli(34) };
    let rize = hava::Sehir { ad: String::from("Rize"), durum: hava::Durum::Yagmurlu };
    let erzurum = hava::Sehir { ad: String::from("Erzurum"), durum: hava::Durum::Karli };

    println!("{}", antalya.tavsiye());
    println!("{}", rize.tavsiye());
    println!("{}", erzurum.tavsiye());
    println!("Sıcak eşiği: {}°C", hava::SICAK_ESIGI);
}
```

Modülün **içinde** `Durum::Gunesli` ve `SICAK_ESIGI` yazmak yetiyor, çünkü aynı modüldeyiz. Dışarıdan
(`main`'den) ise tam yolu yazıyoruz: `hava::Durum::Gunesli(34)`, `hava::SICAK_ESIGI`.

:::warning Modül bir nesne değildir
Java veya C# biliyorsan modülü bir sınıfa (class) benzetmek isteyebilirsin. Ama modülün **örneği
(instance)** oluşturulmaz, alanı ya da `self`'i yoktur; modül yalnızca bir **isim alanı ve gizlilik
sınırıdır**. Veriyi ve davranışı bir arada tutmak için struct + `impl` kullanırsın; o tipleri ve
fonksiyonları **düzenlemek** için modül kullanırsın.
:::

Modül 7'yi hatırlıyor musun? Bu programın çıktısını tahmin et:

```predict
question: Modülün içindeki `enum` ve `match` ile çalışan bu program ne yazdırır?
code: |
  mod kargo {
      pub enum Durum {
          Hazirlaniyor,
          Yolda(u32),
          Teslim,
      }

      pub fn mesaj(d: Durum) -> String {
          match d {
              Durum::Hazirlaniyor => String::from("Paketleniyor"),
              Durum::Yolda(km) => format!("{km} km kaldı"),
              Durum::Teslim => String::from("Teslim edildi"),
          }
      }
  }

  fn main() {
      let d = kargo::Durum::Yolda(42);
      println!("{}", kargo::mesaj(d));
      println!("{}", kargo::mesaj(kargo::Durum::Teslim));
      println!("{}", kargo::mesaj(kargo::Durum::Hazirlaniyor));
  }
options:
  - |
    42 km kaldı
    Teslim edildi
    Paketleniyor
  - |
    Yolda(42)
    Teslim
    Hazirlaniyor
  - |
    Paketleniyor
    Teslim edildi
    Paketleniyor
answer: 0
explanation: |
  `kargo::Durum::Yolda(42)` değeri `match`'te `Durum::Yolda(km)` koluna uyar ve `km`'ye 42 bağlanır:
  **42 km kaldı**. Diğer iki çağrı da kendi kollarına gider.

  Yollara dikkat: modülün **dışındaki** `main` varyantlara `kargo::Durum::Yolda` diye tam yoluyla ulaşır;
  modülün **içindeki** `mesaj` ise sadece `Durum::Yolda` yazar. Varyantların kendi başına `pub`
  yazılmadığı hâlde dışarıdan kullanılabildiğini fark ettin mi? `pub enum`'un özel bir kuralı var —
  bir sonraki derste.
```

## Alıştırma: Dağınık kodu ağaca yerleştir

Modüller, ilgili fonksiyonları bir araya toplayıp her birine bir **adres** verir. Şimdi bunu kendin yap.

````exercise
id: m08-e-okul-agaci
title: Dağınık fonksiyonları modül ağacına yerleştir
difficulty: 2
prompt: |
  Okulun not sistemi tek bir dosyada, dağınık fonksiyonlar hâlinde yazılmış. Kodu şu **modül ağacına**
  taşı ve eksik `harf_notu` fonksiyonunu tamamla:

  ```text
  crate
   ├── ogrenci
   │    ├── tam_ad(ad, soyad)
   │    └── notlar
   │         ├── ortalama(a, b, c)
   │         └── harf_notu(ortalama)
   └── duyuru
        └── baslik(metin)
  ```

  - Testler fonksiyonlara **tam yollarıyla** erişecek: `ogrenci::tam_ad`, `ogrenci::notlar::ortalama`,
    `ogrenci::notlar::harf_notu`, `duyuru::baslik`. Testler modüllerin dışında duracağı için gerekli
    yerlere `pub` yazmayı unutma.
  - `harf_notu` kuralı: 85 ve üstü `'A'`, 70 ile 85 arası `'B'`, 50 ile 70 arası `'C'`, 50'nin altı `'F'`
    (sınır değerler üstteki harfi alır: 85 → `'A'`, 70 → `'B'`, 50 → `'C'`).
  - `main`'deki çağrıları da yeni yollarla güncelle.
starter: |
  fn tam_ad(ad: &str, soyad: &str) -> String {
      format!("{ad} {soyad}")
  }

  fn ortalama(a: f64, b: f64, c: f64) -> f64 {
      (a + b + c) / 3.0
  }

  fn harf_notu(ortalama: f64) -> char {
      todo!()
  }

  fn baslik(metin: &str) -> String {
      format!("📢 DUYURU: {metin}")
  }

  fn main() {
      let ort = ortalama(90.0, 75.0, 60.0);
      println!("{}: {ort} → {}", tam_ad("Elif", "Kaya"), harf_notu(ort));
      println!("{}", baslik("Veli toplantısı cuma günü"));
  }
solution: |
  mod ogrenci {
      pub fn tam_ad(ad: &str, soyad: &str) -> String {
          format!("{ad} {soyad}")
      }

      pub mod notlar {
          pub fn ortalama(a: f64, b: f64, c: f64) -> f64 {
              (a + b + c) / 3.0
          }

          pub fn harf_notu(ortalama: f64) -> char {
              if ortalama >= 85.0 {
                  'A'
              } else if ortalama >= 70.0 {
                  'B'
              } else if ortalama >= 50.0 {
                  'C'
              } else {
                  'F'
              }
          }
      }
  }

  mod duyuru {
      pub fn baslik(metin: &str) -> String {
          format!("📢 DUYURU: {metin}")
      }
  }

  fn main() {
      let ort = ogrenci::notlar::ortalama(90.0, 75.0, 60.0);
      println!(
          "{}: {ort} → {}",
          ogrenci::tam_ad("Elif", "Kaya"),
          ogrenci::notlar::harf_notu(ort)
      );
      println!("{}", duyuru::baslik("Veli toplantısı cuma günü"));
  }
check: tests
tests: |
  #[test]
  fn tam_ad_ogrenci_modulunde() {
      assert_eq!(ogrenci::tam_ad("Elif", "Kaya"), "Elif Kaya", "ad ile soyad arasında tek boşluk olmalı");
  }

  #[test]
  fn ortalama_notlar_modulunde() {
      assert_eq!(ogrenci::notlar::ortalama(90.0, 75.0, 60.0), 75.0, "90, 75 ve 60'ın ortalaması 75'tir");
      assert_eq!(ogrenci::notlar::ortalama(100.0, 50.0, 0.0), 50.0, "100, 50 ve 0'ın ortalaması 50'dir");
  }

  #[test]
  fn harf_notu_sinirlari() {
      assert_eq!(ogrenci::notlar::harf_notu(100.0), 'A', "100 → 'A' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(85.0), 'A', "85 tam sınır: 'A' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(84.9), 'B', "84.9 → 'B' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(70.0), 'B', "70 tam sınır: 'B' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(69.5), 'C', "69.5 → 'C' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(50.0), 'C', "50 tam sınır: 'C' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(49.99), 'F', "50'nin altı 'F' olmalı");
      assert_eq!(ogrenci::notlar::harf_notu(0.0), 'F', "0 → 'F' olmalı");
  }

  #[test]
  fn duyuru_basligi() {
      assert_eq!(duyuru::baslik("Yarın tatil"), "📢 DUYURU: Yarın tatil", "başlık biçimi korunmalı");
  }
hints:
  - |
    Modül tanımı `mod ad { ... }` biçimindedir ve bir modülün içine başka bir modül de koyabilirsin.
  - |
    `notlar` modülü `ogrenci`'nin **içinde** olmalı: `mod ogrenci { pub fn tam_ad... pub mod notlar { ... } }`.
    Testler modüllerin dışından çağıracağı için iç modüle ve bütün fonksiyonlara `pub` ekle.
  - |
    `harf_notu` için en yüksek eşikten başlayan bir zincir kur:
    `if ortalama >= 85.0 { 'A' } else if ortalama >= 70.0 { 'B' } else if ortalama >= 50.0 { 'C' } else { 'F' }`.
    Sonra `main`'deki çağrıları `ogrenci::notlar::ortalama(...)` gibi tam yollarla güncelle.
explanation: |
  Çözümde dikkat etmen gereken üç nokta var:

  - `notlar`, `ogrenci`'nin **içinde** tanımlandı; bu yüzden yolu `ogrenci::notlar` oldu ve
    fonksiyonlarına `ogrenci::notlar::harf_notu` diye ulaşılıyor.
  - `pub mod notlar` ve fonksiyonların hepsinin `pub` olması gerekti: hem `main` hem testler bu
    modüllerin **dışında** duruyor.
  - İlginç bir ayrıntı: `mod ogrenci` ve `mod duyuru`'nun başında `pub` **yok**, yine de `main` ve
    testler onlara ulaşabildi. Çünkü bu iki modül crate kökünde tanımlı: `main` de kökte duruyor,
    testler ise kökün bir alt modülünde (alt modüller atalarının gizli öğelerini görebilir). Bu kuralı
    bir sonraki derste öğreneceksin.

  `harf_notu`'ndaki `else if` zinciri en yüksek eşikten başladığı için her koşul, öncekilerin
  sağlanmadığını varsayabilir: ikinci koşula gelindiyse ortalamanın 85'ten küçük olduğu zaten bellidir,
  bu yüzden yalnızca `>= 70.0` yazmak yeter. Bu, Modül 3'teki not hesaplayıcısının modüllere
  yerleştirilmiş hâli.
````

## Özet

:::remember
- **Paket** = `Cargo.toml` + bir ya da daha çok crate. En fazla **bir** library crate, istediğin kadar
  binary crate barındırır.
- **Crate** = derleyicinin tek seferde derlediği birim. Kökü `src/main.rs` (binary) ya da `src/lib.rs`
  (library) dosyasıdır; `src/bin/*.rs` dosyaları ek binary crate'lerdir.
- **Modül** = crate içinde isim alanı + gizlilik sınırı. `mod ad { ... }` ile kurulur, kökü `crate`
  olan bir **ağaç** oluşturur.
- Yollar `::` ile yazılır: `mutfak::corbalar::mercimek()`. Aynı ad farklı modüllerde olabilir; aynı
  modülde iki kez tanımlanırsa **E0428** alırsın.
- Binary crate'te `main` zorunludur (yoksa **E0601**); library crate'in giriş noktası yoktur, `main`
  gerekmez.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Paket, crate ve modül arasındaki ilişki nedir? `cargo new oyun` ile
  başlayan bir proje büyüdükçe bu üç katmanın her biri nerede devreye girer?
answer: |
  Model cevap: `cargo new oyun` bir **paket** oluşturur: `Cargo.toml` paketi tanımlar ve içinde kökü
  `src/main.rs` olan bir **binary crate** vardır. Derleyici bu crate'i bir bütün olarak derler. Program
  büyüdükçe kodu crate'in içinde **modüllere** ayırırım (`mod karakter`, `mod harita`...); böylece
  isimler çakışmaz, ilgili kod bir arada durur ve iç ayrıntıları gizleyebilirim. Mantığı başka
  programlarda da kullanmak istersem pakete `src/lib.rs` ile bir **library crate** eklerim; ek araçlar
  için `src/bin/` altına yeni binary crate'ler koyarım. Kısaca: paket ⊃ crate'ler ⊃ modül ağacı ⊃ öğeler.
```

```flashcards
- front: Bir pakette en fazla kaç **library** crate, kaç **binary** crate olabilir?
  back: En fazla **bir** library crate; binary crate sayısı ise sınırsızdır (en az bir crate şart).
- front: Cargo kurallarına göre binary crate'in ve library crate'in kök dosyaları hangileridir?
  back: "Binary: `src/main.rs` — Library: `src/lib.rs` (ek binary'ler: `src/bin/*.rs`)"
- front: Modül ağacının kökündeki örtük modülün adı nedir?
  back: "`crate` — crate kök dosyasının (main.rs / lib.rs) içeriği bu modülü oluşturur."
- front: "`E0428` hatası ne zaman çıkar?"
  back: Aynı modülde (aynı isim alanında) aynı ad iki kez tanımlandığında — "the name is defined multiple times".
- front: Binary crate ile library crate arasındaki temel fark nedir?
  back: Binary crate'te giriş noktası olan `fn main` vardır ve çalıştırılabilir bir program üretir; library crate'in giriş noktası yoktur, başka kodların kullanacağı işlevsellik sunar.
- front: "Modül yolunda hangi ayırıcı kullanılır, bir değerin alanına erişirken hangisi?"
  back: "Yollarda `::` (`mutfak::corbalar::mercimek`), değerin alanı/metodu için `.` (`hesap.bakiye`)."
- front: Bir modülün içine neler konabilir? (en az dört öğe say)
  back: Fonksiyonlar, struct'lar, enum'lar, `impl` blokları, `const`/`static` sabitler, başka modüller ve `use` bildirimleri.
```
