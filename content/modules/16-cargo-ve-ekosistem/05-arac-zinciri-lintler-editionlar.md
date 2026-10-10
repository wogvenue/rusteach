---
id: m16-l05
title: "Araç Zinciri: Lint'ler, Edition'lar ve Eklentiler"
minutes: 24
type: lesson
objectives:
  - "`cargo install` ile araç kurabilmek ve `cargo-xyz` adlı bir programın nasıl `cargo xyz` alt komutu olduğunu açıklayabilmek"
  - "`rustfmt.toml` ve lint seviyeleriyle (`allow`, `expect`, `warn`, `deny`, `forbid`; `#[...]` ve `#![...]`; `[lints]`) bir projenin kurallarını ayarlayabilmek"
  - "Edition'ların ne olduğunu, crate'ler arasında nasıl birlikte çalıştığını ve `cargo fix --edition` ile nasıl geçiş yapıldığını açıklayabilmek"
  - "`rust-version` (MSRV) ve `rust-toolchain.toml` ile bir projenin hangi Rust sürümleriyle derleneceğini yönetebilmek"
keywords: [cargo install, cargo eklentileri, rustfmt.toml, clippy, lint, allow, expect, deny, forbid, must_use, edition, cargo fix, MSRV, rust-version, rust-toolchain.toml]
---

Bir marangozun atölyesini düşün: testere, matkap, zımpara... Ama asıl farkı yaratan, aletlerin **nasıl
ayarlandığı** ve atölyenin **kuralları**dır: "bu atölyede her vida aynı yöne bakar", "bu matkap şu
uçla kullanılır". Profesyonel bir Rust projesi de böyledir: kodun yanında bir dizi küçük ayar dosyası,
ekipçe kabul edilmiş lint kuralları ve sabitlenmiş bir derleyici sürümü bulunur.

Bu derste Cargo'nun etrafındaki araç zincirini tamamlayacaksın: Cargo'ya yeni komutlar eklemeyi, kod
stilini ve lint kurallarını projeye yazmayı, edition'ları ve projenin hangi Rust sürümüyle derleneceğini
yönetmeyi öğreneceksin.

## cargo install ve cargo eklentileri

`cargo install`, crates.io'daki bir **binary** crate'i indirir, release profiliyle derler ve
çalıştırılabilir dosyayı `~/.cargo/bin` klasörüne (Windows'ta `%USERPROFILE%\.cargo\bin`) koyar. Rust'ı
rustup ile kurduğunda bu klasör zaten `PATH`'e eklenmiştir:

```console
PS C:\> cargo install ripgrep --locked     # Rust ile yazılmış hızlı bir grep: rg
PS C:\> cargo install --list               # kurulu araçları listele
PS C:\> cargo uninstall ripgrep
```

`--locked`, aracın kendi `Cargo.lock`'unu kullanarak yazarının test ettiği **tam** bağımlılık sürümleriyle
derlenmesini sağlar; onsuz Cargo her bağımlılığın en yeni uyumlu sürümünü seçer ve nadiren de olsa derleme
bozulabilir. `cargo install` yalnızca binary'si olan paketlerle çalışır; `serde` gibi bir kütüphaneyi
"kuramazsın", onu projene bağımlılık olarak eklersin.

Şimdi işin sihirli kısmı: `PATH` üzerinde adı **`cargo-` ile başlayan** her program, Cargo'nun bir alt
komutu olur. `cargo-nextest` adlı bir programı kurduğunda `cargo nextest` yazabilirsin; Cargo `nextest`
diye bir komut tanımadığını görünce `cargo-nextest`'i arar ve çalıştırır. Bu yüzden Cargo'ya yeni bir
komut eklemek için Cargo'yu değiştirmen gerekmez.

| Araç | Komut | Ne işe yarar? |
|---|---|---|
| `cargo-nextest` | `cargo nextest run` | testleri ayrı süreçlerde, daha hızlı ve paralel çalıştırır; okunaklı rapor |
| `cargo-audit` | `cargo audit` | `Cargo.lock`'u RustSec güvenlik açığı veritabanıyla karşılaştırır |
| `cargo-expand` | `cargo expand` | makroların ve `derive`'ların **açılmış** hâlini gösterir (bir nightly araç zinciri ister) |
| `cargo-watch` | `cargo watch -x test` | dosyalar değiştikçe komutu yeniden çalıştırır (bakım modunda; benzer iş için `bacon` da popüler) |
| `cargo-edit` | `cargo upgrade` | `Cargo.toml`'daki sürüm gereksinimlerini yükseltir |
| `cargo-bloat` | `cargo bloat --release` | binary'de en çok yer kaplayan fonksiyonları listeler (Ders 1) |
| `cargo-semver-checks` | `cargo semver-checks` | yayından önce kırıcı API değişikliklerini yakalar (Ders 2) |

`cargo-edit` ilginç bir hikâyeye sahip: `cargo add` ve `cargo remove` komutları yıllarca bu eklentide
yaşadı. O kadar sevildiler ki sonunda Cargo'nun **kendisine** taşındılar (Rust 1.62 ve 1.66). Eklentiler
ekosistemin yeni fikirleri denediği bir laboratuvar gibidir.

:::analogy Matkap ve uçları
Cargo bir matkap gibidir: gövdesi (derleme, test, yayın) sağlam ve standarttır. Ama asıl çok yönlülüğü
**uçlardan** gelir: delik için bir uç, vida için bir başka uç. Ucu takmak için matkabı sökmen gerekmez;
mandren (`cargo-` öneki) her uygun ucu kabul eder. `cargo install` uç kutusuna yeni bir uç eklemektir.
:::

```quiz
question: |
  `cargo-selam` adında bir binary crate yazdın ve `cargo install --path .` ile kurdun. Ne olur?
options:
  - Hiçbir şey; Cargo yalnızca Rust ekibinin onayladığı alt komutları tanır
  - "Artık `cargo selam` yazınca Cargo `PATH`'teki `cargo-selam` programını çalıştırır"
  - "Yalnızca `cargo-selam` olarak çalışır; `cargo selam` biçimi crates.io'ya yayın gerektirir"
  - "`cargo selam` yalnızca `Cargo.toml`'da `[plugins]` tablosuna eklenirse çalışır"
answer: 1
explanation: |
  Cargo'nun eklenti mekanizması bilerek bu kadar basittir: tanımadığı bir `xyz` komutunda `PATH` üzerinde
  `cargo-xyz` adlı bir program arar. `cargo install --path .` yerel bir projeyi kurar; programın
  crates.io'da olması gerekmez. Böyle bir `[plugins]` tablosu da yoktur.
feedback:
  - Cargo onay listesi tutmaz; ad kuralı yeterlidir.
  - Doğru!
  - Yayın şartı yok; programın PATH'te olması yeter.
  - "`Cargo.toml`'da böyle bir tablo yok."
```

`cargo expand`'in gösterdiği şey, Modül 11'de `derive`'ın "senin yerine yazdığı" koddur. Aşağıda
`PartialEq`'yi elle, ama `derive`'dan **farklı** bir kuralla uyguladık:

```predict
code: |
  struct Urun {
      barkod: u64,
      fiyat: u32,
  }

  // derive(PartialEq) tüm alanları karşılaştırırdı; biz yalnızca barkoda bakıyoruz
  impl PartialEq for Urun {
      fn eq(&self, diger: &Self) -> bool {
          self.barkod == diger.barkod
      }
  }

  fn main() {
      let raf = Urun { barkod: 8690000000017, fiyat: 4500 };
      let kasa = Urun { barkod: 8690000000017, fiyat: 3900 };
      println!("{}", raf == kasa);
      println!("{}", raf.fiyat == kasa.fiyat);
  }
options:
  - |
    true
    false
  - |
    false
    false
  - |
    true
    true
answer: 0
explanation: |
  `==` operatörü `PartialEq::eq`'yu çağırır ve bizim uygulamamız yalnızca barkodları karşılaştırır: aynı
  barkod → `true`. Fiyatlar ise farklıdır. `#[derive(PartialEq)]` yazsaydık `cargo expand` bize her alanı
  `&&` ile karşılaştıran bir `eq` gösterirdi ve ilk satır `false` olurdu. `derive` sihir değil, senin
  yazabileceğin sıradan kodu üreten bir makrodur.
```

## rustfmt.toml: stilin de bir ayarı var

Modül 1'de `cargo fmt`'nin kodu Rust'ın resmî stiline göre biçimlendirdiğini gördün. Projenin köküne bir
`rustfmt.toml` (ya da `.rustfmt.toml`) koyarak birkaç ayarı değiştirebilirsin:

```toml
# rustfmt.toml
max_width = 100              # satır uzunluğu sınırı (varsayılan zaten 100)
use_small_heuristics = "Max" # kısa ifadeleri mümkünse tek satırda tut
newline_style = "Unix"       # satır sonları her işletim sisteminde \n olsun
style_edition = "2024"       # hangi edition'ın stil kurallarını kullanacağı
```

Ayarların küçük bir kısmı **kararsızdır (unstable)**: örneğin `imports_granularity` ya da `group_imports`.
Bunlar yalnızca nightly rustfmt ile çalışır; kararlı sürüm onları bir uyarıyla yok sayar. Topluluğun genel
eğilimi ise ayarları **olabildiğince az** değiştirmektir: rustfmt'nin asıl değeri, her Rust projesinin aynı
görünmesidir.

Bazen elle hizaladığın bir tablo rustfmt'nin elinde bozulur. O zaman yalnızca o öğeyi korursun:

```rust
#[rustfmt::skip]
const MENU: [(&str, u32); 3] = [
    ("latte",    9000),
    ("filtre",   6500),
    ("mocha",   10500),
];

fn main() {
    for (ad, fiyat) in MENU {
        println!("{ad:<8} {fiyat:>6} kuruş");
    }
}
```

`#[rustfmt::skip]` bir **araç özniteliğidir** (*tool attribute*): derleyici onu yok sayar, yalnızca
rustfmt dikkate alır. Aynı biçimde `#[allow(clippy::...)]` de yalnızca clippy için anlamlıdır. Ekipler
CI'da `cargo fmt --check` çalıştırır: biçimlendirilmemiş bir dosya varsa kontrol başarısız olur.

```quiz
question: "Ekibin, kod incelemelerinde \"süslü parantez nereye\" tartışmasını bitirmek istiyor. En iyi yaklaşım hangisi?"
options:
  - "`rustfmt.toml`'da onlarca ayarı ekibin zevkine göre değiştirmek"
  - "Varsayılan rustfmt stilini kullanmak, gerekiyorsa yalnızca birkaç ayarı değiştirmek ve CI'da `cargo fmt --check` çalıştırmak"
  - Herkesin kendi editör ayarlarıyla biçimlendirmesine izin vermek
  - Biçimlendirmeyi yalnızca yayından önce bir kez yapmak
answer: 1
explanation: |
  Rustfmt'nin gücü **ortak** bir stilden gelir: başka bir projeye geçtiğinde kod tanıdık görünür. CI'daki
  `--check` kuralın uygulanmasını otomatikleştirir; insanlar artık stil tartışmaz, makine karar verir.
  Çok sayıda özel ayar bu ortaklığı bozar ve bazıları yalnızca nightly'de çalışır.
feedback:
  - Mümkün ama ortak stilin değerini azaltır; kararsız ayarlar da nightly ister.
  - Doğru!
  - Her kayıtta farklı biçimlenen dosyalar gereksiz "fark" (diff) üretir.
  - Biçim, kod yazılırken tutarlı olmalı; CI bunu her değişiklikte denetler.
```

## Lint seviyeleri: kuralları koda yazmak

Bir **lint**, derleyicinin ya da clippy'nin "bu kod derlenir ama şüpheli" dediği bir kuraldır:
kullanılmayan değişken, gereksiz `mut`, yok sayılan bir sonuç... Her lint'in bir **seviyesi** vardır:

| Seviye | Lint tetiklenince |
|---|---|
| `allow` | hiçbir şey söylenmez |
| `expect` | sessiz kalır; ama lint **tetiklenmezse** uyarır ("bu beklenti artık gereksiz") |
| `warn` | uyarı (çoğu lint'in varsayılanı) |
| `deny` | derleme hatası |
| `forbid` | derleme hatası **ve** içerideki hiçbir öznitelik bunu gevşetemez |

Seviyeyi iki yerde verebilirsin. **Dış öznitelik** `#[...]` yalnızca hemen ardından gelen öğeye
uygulanır; **iç öznitelik** `#![...]` ise içinde bulunduğu öğenin tamamına, crate kökünde yazılırsa tüm
crate'e uygulanır:

```rust
#![deny(unused_variables)] // tüm crate: kullanılmayan değişken bir hatadır

#[expect(dead_code, reason = "kampanya modülü gelecek sürümde kullanacak")]
fn kampanya_orani() -> u32 {
    15
}

#[must_use = "KDV'li fiyatı kullanmazsan hesap boşa gider"]
fn kdv_ekle(fiyat: u32) -> u32 {
    fiyat * 120 / 100
}

fn main() {
    let toplam = kdv_ekle(9000);
    println!("Ödenecek: {toplam} kuruş");
}
```

- `#[expect(dead_code, reason = "...")]`: "Bu fonksiyonun kullanılmadığını biliyorum." `allow`'dan farkı:
  fonksiyon bir gün kullanılmaya başlarsa derleyici "bu `expect` artık gereksiz" der ve unutulmuş
  istisnalar birikmez. `reason` ise kodu okuyan bir sonraki kişiye nedenini anlatır.
- `#[must_use]`: Bir fonksiyonun dönüş değerini yok saymayı lint konusu yapar (`unused_must_use`).
  `Result` tipi zaten `must_use`'dur; bu yüzden bir `Result`'ı yok sayınca derleyici seni uyarır.

İç içe kapsamlarda **en yakın** seviye kazanır: crate'te `deny` olan bir lint'i tek bir fonksiyonda `allow`
ile gevşetebilirsin. Tek istisna `forbid`:

```compiles
code: |
  #![forbid(unused_variables)]

  fn main() {
      #[allow(unused_variables)]
      let kargo = 2500;
      println!("sipariş hazır");
  }
answer: false
error: E0453
explanation: |
  `forbid`, `deny`'dan tek bir yönüyle ayrılır: daha içerideki bir `allow` onu **gevşetemez**.

  ```text
  error[E0453]: allow(unused_variables) incompatible with previous forbid
   --> src/main.rs:4:13
    |
  1 | #![forbid(unused_variables)]
    |           ---------------- `forbid` level set here
  ...
  4 |     #[allow(unused_variables)]
    |             ^^^^^^^^^^^^^^^^ overruled by previous forbid
  ```

  Bu yüzden `forbid` gerçekten pazarlıksız kurallar içindir. Tipik örnek `#![forbid(unsafe_code)]`:
  "bu crate'te hiçbir yerde `unsafe` yok, kimse tek tek açamaz."
```

Lint'ler gruplar hâlinde de yönetilir: `unused` tüm "kullanılmayan" lint'lerini, `warnings` ise o an uyarı
veren her şeyi kapsar. Clippy'nin grupları Modül 1'den tanıdık: `clippy::correctness`, `clippy::style`,
`clippy::perf`... Daha titiz olan `clippy::pedantic` varsayılan olarak kapalıdır. `clippy::restriction`
ise tek tek seçilmesi gereken, bazen birbiriyle çelişen kurallardan oluşur; tamamını açmak önerilmez.

Kuralları her dosyanın başına yazmak yerine, Cargo 1.74'ten beri `Cargo.toml`'da **`[lints]`** tablosu
kullanabilirsin (workspace'te `[workspace.lints]`, Ders 3):

```toml
[lints.rust]
unsafe_code = "forbid"
missing_docs = "warn"

[lints.clippy]
pedantic = { level = "warn", priority = -1 }  # önce grubu aç...
must_use_candidate = "allow"                  # ...sonra tek bir lint'i kapat
```

`priority = -1` grubun **önce** uygulanmasını sağlar; böylece sonraki tek lint ayarları grubu ezebilir.
CI'da ise genellikle tüm uyarıları hataya çevirirsin: `cargo clippy -- -D warnings`. Böylece kod tabanı
uyarısız kalır, ama yerelde geliştirirken uyarılar seni durdurmaz.

````exercise
id: m16-e-lint-temizligi
title: Lint temizliği
difficulty: 2
prompt: |
  Market kasasının hesap programına ekip `#![deny(...)]` ile katı kurallar koydu ve program artık
  **derlenmiyor**. Derleyicinin dört hatasını oku ve düzelt:

  - `mut` gerekmiyorsa kaldır.
  - `kargo` ücreti toplama **eklenmeli** (unutulmuş, bu yüzden kullanılmıyor).
  - İndirim hesaplanıyor ama sonucu kullanılmıyor: indirimli tutarı kullan.
  - Kullanımdan kaldırılmış (`deprecated`) `kdvli` yerine `kdv_ekle(tutar, 20)` kullan. Artık kimsenin
    kullanmadığı eski fonksiyonu sil.

  Doğru sıra: ara toplam → %10 indirim → %20 KDV → + kargo. Beklenen çıktı:
  `Ödenecek: 20320 kuruş`. `#![deny(...)]` satırına dokunma; `allow`/`expect` ile susturmak da yok!
starter: |
  #![deny(unused_variables, unused_mut, unused_must_use, deprecated)]

  #[deprecated(since = "2.0.0", note = "yerine `kdv_ekle` kullan")]
  fn kdvli(fiyat: u32) -> u32 {
      fiyat * 120 / 100
  }

  fn kdv_ekle(fiyat: u32, oran: u32) -> u32 {
      fiyat * (100 + oran) / 100
  }

  #[must_use = "indirimli fiyatı kullanmazsan indirim boşa gider"]
  fn indirim_uygula(fiyat: u32, yuzde: u32) -> u32 {
      fiyat * (100 - yuzde) / 100
  }

  fn main() {
      let mut sepet = vec![12000, 4500];
      let kargo = 2500;
      let ara_toplam = sepet[0] + sepet[1];
      indirim_uygula(ara_toplam, 10);
      let toplam = kdvli(ara_toplam);
      println!("Ödenecek: {toplam} kuruş");
  }
starter_compiles: false
solution: |
  #![deny(unused_variables, unused_mut, unused_must_use, deprecated)]

  fn kdv_ekle(fiyat: u32, oran: u32) -> u32 {
      fiyat * (100 + oran) / 100
  }

  #[must_use = "indirimli fiyatı kullanmazsan indirim boşa gider"]
  fn indirim_uygula(fiyat: u32, yuzde: u32) -> u32 {
      fiyat * (100 - yuzde) / 100
  }

  fn main() {
      let sepet = vec![12000, 4500];
      let kargo = 2500;
      let ara_toplam = sepet[0] + sepet[1];
      let indirimli = indirim_uygula(ara_toplam, 10);
      let toplam = kdv_ekle(indirimli, 20) + kargo;
      println!("Ödenecek: {toplam} kuruş");
  }
check: output
expected_output: |
  Ödenecek: 20320 kuruş
hints:
  - "Hata mesajlarını yukarıdan aşağıya oku: her biri hangi lint'in tetiklendiğini (`note: the lint level is defined here`) ve hangi satırda olduğunu söyler."
  - "`let mut sepet` → `let sepet`. `indirim_uygula(...)`'nın sonucunu `let indirimli = ...;` ile bir değişkene al ve sonraki adımda o değişkeni kullan."
  - "`let toplam = kdv_ekle(indirimli, 20) + kargo;` yaz. Ardından `kdvli` hiç kullanılmadığı için `dead_code` uyarısı verir: fonksiyonu tamamen sil."
forbid:
  - pattern: "#!?\\[\\s*(allow|expect)"
    message: Lint'leri susturmak yok; kodu düzelt!
  - pattern: "let\\s+_\\s*="
    message: "`let _ =` sonucu bilerek atar; burada indirimli tutarı **kullanman** gerekiyor."
require:
  - pattern: "#!\\[deny\\(unused_variables, unused_mut, unused_must_use, deprecated\\)\\]"
    message: "`#![deny(...)]` satırı olduğu gibi kalmalı."
explanation: |
  Dört hatanın dördü de gerçek birer hatayı işaret ediyordu: unutulmuş kargo ücreti müşteriden eksik para
  almak, yok sayılan indirim müşteriden fazla para almak demekti. `deny` bu yüzden değerlidir: "derlenir
  ama yanlış" kodu "derlenmez" hâline getirir.

  `kdvli`'yi neden sildik? `deprecated` bir geçiş aracıdır (Ders 2): eski adı kullanan kalmadığında eski
  fonksiyonu bir sonraki büyük sürümde kaldırırsın. Silmeseydin `dead_code` lint'i uyarırdı; o lint bu
  crate'te `deny` olmadığı için derleme durmazdı, ama her derlemede gereksiz bir uyarı kalırdı.

  Hesap: 12000 + 4500 = 16500 → %10 indirim 14850 → %20 KDV 17820 → + 2500 kargo = 20320.
````

## Edition'lar: dili kırmadan değiştirmek

Bir dili geliştirirken eninde sonunda eski bir kararı değiştirmek istersin: yeni bir anahtar kelime,
daha mantıklı bir varsayılan... Ama bu, eski kodu kırar. Python bu ikilemde 2'den 3'e geçerken ekosistemi
yıllarca ikiye böldü. Rust'ın cevabı **edition**'lardır. Önce bir tahminde bulun: Bu kod edition 2024'te
derlenir mi?

```compiles
code: |
  fn main() {
      let gen = 3; // jeneratör numarası
      println!("{gen}. jeneratör çalışıyor");
  }
answer: false
explanation: |
  Derlenmez! Edition 2024, `gen` kelimesini ileride kullanılmak üzere **ayrılmış anahtar kelime**
  (*reserved keyword*) yaptı:

  ```text
  error: expected identifier, found reserved keyword `gen`
   --> src/main.rs:2:9
    |
  2 |     let gen = 3; // jeneratör numarası
    |         ^^^ expected identifier, found reserved keyword
    |
  help: escape `gen` to use it as an identifier
    |
  2 |     let r#gen = 3; // jeneratör numarası
    |         ++
  ```

  Aynı kod edition 2021'de sorunsuz derlenir. İşte edition'ların özü bu: dilin küçük, isteğe bağlı
  ve **crate başına** seçilen değişiklikleri.
```

Derleyicinin önerdiği `r#gen` bir **ham tanımlayıcıdır** (*raw identifier*): `r#` öneki, bir anahtar
kelimeyi sıradan bir ad olarak kullanmanı sağlar. Bu özellikle başka edition'da yazılmış bir crate'in
`gen` adlı bir fonksiyonunu çağırman gerektiğinde işe yarar:

```rust
fn r#gen(sira: u32) -> String {
    format!("{sira}. jeneratör")
}

fn main() {
    let sira = 3;
    println!("{} çalışıyor", r#gen(sira));
}
```

Değişkene de `gen` yerine `sira` dedik. `let r#gen = 3;` yazsaydık bu yerel değişken aynı addaki
fonksiyonu **gölgelerdi** ve `r#gen(...)` çağrısı "expected function, found `{integer}`" hatası verirdi.

Edition'lar şöyle çalışır:

- Her crate `Cargo.toml`'daki `edition` alanıyla **kendi** edition'ını seçer.
- Her yeni Rust derleyicisi **tüm** edition'ları destekler. 2015 edition'ında yazılmış bir crate bugünkü
  derleyiciyle de derlenir.
- Farklı edition'lardaki crate'ler sorunsuz **birlikte çalışır**: senin 2024 crate'in, 2018'de kalmış bir
  bağımlılığı kullanabilir. Ekosistem asla bölünmez.
- Edition bir Rust **sürümü değildir**. Yeni özelliklerin çoğu (yeni metotlar, yeni std tipleri) tüm
  edition'lara aynı anda gelir. Edition yalnızca eski kodu kırabilecek değişiklikleri taşır.

| Edition | Rust | Öne çıkan değişiklikler |
|---|---|---|
| 2015 | 1.0 | ilk sürüm |
| 2018 | 1.31 | `async`/`await`/`dyn` anahtar kelimeleri, `crate::` yolları, `extern crate`'e son |
| 2021 | 1.56 | closure'ların alanları ayrı ayrı yakalaması, dizilerde `into_iter()` değerle, `resolver = "2"` |
| 2024 | 1.85 | `gen` ayrıldı, `if let` geçici değer kapsamı, `unsafe extern`, `resolver = "3"`, yeni rustfmt stili |

Bir projeyi yeni edition'a taşımak yarı otomatiktir:

```console
PS C:\projeler\kahve> cargo fix --edition    # 1. kodu bir SONRAKİ edition'a uyumlu hâle getir
PS C:\projeler\kahve> # 2. Cargo.toml'da edition = "2024" yap
PS C:\projeler\kahve> cargo build; cargo test # 3. derle ve test et
```

`cargo fix --edition`, crate **hâlâ eski edition'dayken** çalıştırılır: derleyicinin "bu kod bir sonraki
edition'da farklı davranacak" uyarılarını otomatik düzeltir (örneğin `gen` adlı bir değişkeni `r#gen`
yapar). Sonra `edition` alanını sen değiştirirsin.

:::info C++ ile karşılaştırma
C++'ta da `-std=c++17` ya da `-std=c++20` ile dil standardını seçersin. Fark şu: C++'ın her standardı hem
yeni özellikler hem de nadir kırılmalar getirir ve tek bir programda farklı standartları karıştırmak
tehlikelidir. Rust'ta edition seçimi crate sınırında durur ve bağlama (linking) sırasında hiçbir fark
kalmaz. Edition'lar derleyicinin ön yüzünde (ayrıştırma ve anlam çözümleme) etkilidir.
:::

```quiz
question: "Crate'in edition 2024'te; kullandığın `eski-grafik` bağımlılığı ise edition 2018'de kalmış. Hangisi doğrudur?"
options:
  - "Derlenmez; bütün bağımlılık ağacı aynı edition'da olmalıdır"
  - "Derlenir; her crate kendi edition kurallarıyla derlenir ve crate'ler birbirini sorunsuz kullanır"
  - "`eski-grafik`'i kullanabilmek için senin crate'in de 2018'e dönmelidir"
  - "Derlenir, ama `eski-grafik` 2024 kurallarıyla yeniden yorumlanır"
answer: 1
explanation: |
  Edition, crate başına bir ayardır. Derleyici her crate'i kendi edition'ının kurallarıyla derler; ortaya
  çıkan derlenmiş kod arasında edition farkı yoktur. Bu sayede ekosistem hiçbir zaman Python 2/3 gibi
  bölünmez: herkes yeni edition'a kendi hızında geçer.
feedback:
  - Rust tam olarak bunu önlemek için tasarlandı.
  - Doğru!
  - Senin seçimin bağımlılıklarını etkilemez, onlarınki de seni.
  - Bağımlılık kendi edition'ıyla derlenir, değişmeden kalır.
```

## MSRV ve rust-toolchain.toml

Bir crate'in derlenebildiği **en eski** Rust sürümüne **MSRV** (*minimum supported Rust version*)
denir. Ders 2'de gördüğün `rust-version` alanı tam olarak bunu bildirir:

```toml
[package]
name = "kahve-cli"
version = "0.3.0"
edition = "2024"
rust-version = "1.88"   # let zincirleri (`if let ... && ...`) 1.88'de kararlı oldu
```

Bu bildirimin üç etkisi var:

1. Daha eski bir derleyiciyle derlemeye çalışan kişi, anlaşılmaz tip hataları yerine **net bir mesaj**
   görür (kısaltılmış):

   ```console
   error: rustc 1.85.0 is not supported by the following package:
     kahve-cli@0.3.0 requires rustc 1.88
   ```

2. `resolver = "3"` (edition 2024'ün varsayılanı), bağımlılık sürümü seçerken `rust-version`'ı dikkate
   alır: mümkünse senin MSRV'nle derlenebilen sürümleri tercih eder.
3. Clippy, MSRV'ndan daha yeni bir API öneren uyarıları susturur.

`edition = "2024"` zaten en az Rust 1.85 gerektirir; `rust-version` bundan daha eski olamaz, ama bu
örnekteki gibi daha yeni olabilir. (1.85'ten eski bir Cargo bu mesaja hiç ulaşamaz: `edition = "2024"`
satırını tanımadığı için daha manifest okunurken hata verir.)

MSRV'yi yükseltmek ekosistemde tartışmalı bir konudur: Cargo'nun semver kılavuzu bunu genellikle küçük
sürüm değişikliği sayar, ama eski derleyicilere bağlı kullanıcılar için gerçek bir kırılmadır. Bu yüzden ciddi kütüphaneler bir **MSRV politikası** yazar, örneğin "son 6 ay
içindeki her kararlı sürüm".

MSRV'yi gerçekten denemek için o sürümü kurup `+` ile seçersin:

```console
PS C:\projeler\kahve> rustup toolchain install 1.88.0
PS C:\projeler\kahve> cargo +1.88.0 check
```

### rust-toolchain.toml: herkes aynı derleyiciyle

Bir ekipte herkesin, ve CI'nın, **aynı** derleyiciyi kullanmasını istersen proje köküne bir
`rust-toolchain.toml` koyarsın:

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.85.0"                     # ya da "stable", "nightly-2025-02-20"
components = ["rustfmt", "clippy"]     # bu bileşenler de kurulu olsun
targets = ["wasm32-unknown-unknown"]   # ek derleme hedefleri
profile = "minimal"
```

rustup bu dosyayı görünce o klasördeki her `cargo` ve `rustc` komutunu belirtilen sürümle çalıştırır,
gerekirse sürümü kendisi indirir. Hangi araç zincirinin seçileceğine karar verirken rustup şu sırayı
izler, ilk bulunan kazanır:

1. Komuttaki `+sürüm` (`cargo +nightly build`)
2. `RUSTUP_TOOLCHAIN` ortam değişkeni
3. `rustup override set` ile o klasöre verilmiş geçersiz kılma
4. `rust-toolchain.toml` dosyası
5. Varsayılan (`rustup default stable`)

```quiz
question: |
  Projende `rust-toolchain.toml` içinde `channel = "1.85.0"` var. Sen `cargo +nightly expand` çalıştırıyorsun.
  Hangi derleyici kullanılır?
options:
  - "`1.85.0`, çünkü proje dosyası her şeyi geçersiz kılar"
  - "`nightly`, çünkü komuttaki `+sürüm` en yüksek önceliğe sahiptir"
  - "Komut hata verir; ikisi çelişiyor"
  - Varsayılan `stable`
answer: 1
explanation: |
  Komut satırındaki `+araç-zinciri` en güçlüdür: o tek komut için açıkça ne istediğini söylemişsindir.
  `cargo expand` gibi nightly isteyen araçları sabitlenmiş bir projede kullanmanın yolu da budur.
  Diğer bütün komutlar `rust-toolchain.toml`'daki `1.85.0` ile çalışmaya devam eder.
feedback:
  - Proje dosyası, komuttaki açık seçimden düşük önceliklidir.
  - Doğru!
  - Çelişki yok; öncelik sırası belirlidir.
  - Varsayılan en düşük önceliktir.
```

```exercise
id: m16-e-msrv-bekcisi
title: MSRV bekçisi
difficulty: 3
prompt: |
  CI hattın için, kurulu derleyicinin bir crate'i derleyip derleyemeyeceğini önceden söyleyen bir bekçi yaz.

  1. `surum_coz(metin)`: `"1.85"` ya da `"1.85.1"` biçimindeki bir sürümü `(1, 85, 0)` / `(1, 85, 1)`
     tuple'ına çevirir. Parça sayısı 2 ya da 3 değilse, ya da bir parça sayı değilse `None` döndürür.
  2. `edition_msrv(edition)`: Bir edition'ın gerektirdiği en eski Rust'ı döndürür: `"2015"` → `(1, 0, 0)`,
     `"2018"` → `(1, 31, 0)`, `"2021"` → `(1, 56, 0)`, `"2024"` → `(1, 85, 0)`; bilinmeyen edition → `None`.
  3. `derlenebilir_mi(kurulu, rust_version, edition)`: Gerçek alt sınır, `rust_version` ile edition'ın
     gerektirdiği sürümün **büyük olanıdır**. Kurulu sürüm bu sınırdan küçük değilse `Ok(true)`, küçükse
     `Ok(false)`. Bozuk bir sürüm metni ya da bilinmeyen bir edition → `Err` (mesaj serbest).
starter: |
  pub fn surum_coz(metin: &str) -> Option<(u32, u32, u32)> {
      todo!()
  }

  pub fn edition_msrv(edition: &str) -> Option<(u32, u32, u32)> {
      todo!()
  }

  pub fn derlenebilir_mi(kurulu: &str, rust_version: &str, edition: &str) -> Result<bool, String> {
      todo!()
  }

  fn main() {
      println!("{:?}", derlenebilir_mi("1.84.1", "1.80", "2024"));
  }
solution: |
  pub fn surum_coz(metin: &str) -> Option<(u32, u32, u32)> {
      let parcalar: Vec<&str> = metin.trim().split('.').collect();
      if parcalar.len() != 2 && parcalar.len() != 3 {
          return None;
      }
      let buyuk = parcalar[0].parse().ok()?;
      let kucuk = parcalar[1].parse().ok()?;
      let yama = match parcalar.get(2) {
          Some(p) => p.parse().ok()?,
          None => 0,
      };
      Some((buyuk, kucuk, yama))
  }

  pub fn edition_msrv(edition: &str) -> Option<(u32, u32, u32)> {
      match edition {
          "2015" => Some((1, 0, 0)),
          "2018" => Some((1, 31, 0)),
          "2021" => Some((1, 56, 0)),
          "2024" => Some((1, 85, 0)),
          _ => None,
      }
  }

  pub fn derlenebilir_mi(kurulu: &str, rust_version: &str, edition: &str) -> Result<bool, String> {
      let kurulu = surum_coz(kurulu).ok_or(format!("bozuk derleyici sürümü: {kurulu}"))?;
      let istenen = surum_coz(rust_version).ok_or(format!("bozuk rust-version: {rust_version}"))?;
      let edition_siniri = edition_msrv(edition).ok_or(format!("bilinmeyen edition: {edition}"))?;
      let sinir = istenen.max(edition_siniri);
      Ok(kurulu >= sinir)
  }

  fn main() {
      println!("{:?}", derlenebilir_mi("1.84.1", "1.80", "2024"));
  }
check: tests
tests: |
  #[test]
  fn surumler_cozulur() {
      assert_eq!(surum_coz("1.85"), Some((1, 85, 0)), "yama basamağı yazılmazsa 0 kabul edilir");
      assert_eq!(surum_coz("1.85.1"), Some((1, 85, 1)));
      assert_eq!(surum_coz("1.x"), None, "sayı olmayan parça geçersiz");
      assert_eq!(surum_coz("1"), None, "tek parça geçersiz");
      assert_eq!(surum_coz("1.85.0.1"), None, "dört parça geçersiz");
  }

  #[test]
  fn edition_sinirlari() {
      assert_eq!(edition_msrv("2018"), Some((1, 31, 0)));
      assert_eq!(edition_msrv("2024"), Some((1, 85, 0)));
      assert_eq!(edition_msrv("2027"), None, "bilinmeyen edition");
  }

  #[test]
  fn rust_version_belirleyici() {
      assert_eq!(derlenebilir_mi("1.85.0", "1.85", "2024"), Ok(true), "tam sınırdaki sürüm derleyebilir");
      assert_eq!(derlenebilir_mi("1.84.1", "1.84", "2021"), Ok(true), "1.84.1 ≥ 1.84.0");
      assert_eq!(derlenebilir_mi("1.83.0", "1.84", "2021"), Ok(false), "rust-version'dan eski derleyici");
      assert_eq!(derlenebilir_mi("1.90.2", "1.88.0", "2024"), Ok(true));
  }

  #[test]
  fn edition_belirleyici() {
      assert_eq!(derlenebilir_mi("1.84.1", "1.70", "2024"), Ok(false), "rust-version 1.70 dese de edition 2024, 1.85 ister");
      assert_eq!(derlenebilir_mi("1.60.0", "1.40", "2021"), Ok(true), "2021 için 1.56 yeter");
  }

  #[test]
  fn hatali_girdiler() {
      assert!(derlenebilir_mi("1.85.0", "1.85", "2027").is_err(), "bilinmeyen edition Err olmalı");
      assert!(derlenebilir_mi("bir.seksen", "1.85", "2024").is_err(), "bozuk kurulu sürüm Err olmalı");
      assert!(derlenebilir_mi("1.85.0", "", "2024").is_err(), "boş rust-version Err olmalı");
  }
hints:
  - "`split('.')` ile parçalara ayır ve önce parça sayısını kontrol et. Her parçayı `parse()` et; `.ok()?` bir `Result`'ı `Option`'a çevirip hata varsa `None` ile çıkar (Modül 10)."
  - "Tuple'lar soldan sağa karşılaştırılır: `(1, 84, 1) < (1, 85, 0)`. Bu yüzden iki sınırın büyüğünü `istenen.max(edition_siniri)` ile alabilirsin."
  - "`derlenebilir_mi`'de her `Option`'ı `ok_or(...)?` ile `Result`'a çevir; sonra `Ok(kurulu >= sinir)` döndür."
explanation: |
  Çözümün kalbi iki küçük fikir: sürümleri **tuple**'a çevirmek ve tuple'ların sözlük sırasıyla
  karşılaştırılması. `(1, 84, 1) >= (1, 84, 0)` doğrudur, `(1, 83, 0) >= (1, 84, 0)` yanlıştır. `max`
  da aynı sıralamayı kullandığı için "gerçek alt sınır" tek satırda hesaplanır.

  `parse().ok()?` ve `ok_or(...)?` Modül 10'un iki köprüsüdür: biri `Result`'ı `Option`'a, diğeri
  `Option`'ı `Result`'a çevirir ve `?` ile erken dönüşü mümkün kılar. Böylece "bozuk girdi" durumları ayrı
  `if`'lere ihtiyaç duymadan ele alınır.

  `edition_belirleyici` testindeki ilk örnek gerçek bir tuzağa işaret ediyor: `rust-version = "1.70"` yazan ama
  `edition = "2024"` kullanan bir crate hiçbir zaman 1.70 ile derlenemez. Cargo bu çelişkiyi görür ve
  `rust-version`'ın edition'ın gerektirdiğinden düşük olamayacağını söyler.
```

## Özet

:::remember
- `cargo install arac --locked` binary'leri `~/.cargo/bin`'e kurar. `PATH`'teki her `cargo-xyz` programı `cargo xyz` olarak çalışır (nextest, audit, expand, watch, edit...).
- `rustfmt.toml` ile birkaç stil ayarı yapılır; ayarları az tut, CI'da `cargo fmt --check` çalıştır; `#[rustfmt::skip]` tek bir öğeyi korur.
- Lint seviyeleri: `allow` < `expect` < `warn` < `deny` < `forbid`. `#[...]` bir öğeye, `#![...]` içinde bulunduğu her şeye uygulanır; en yakın seviye kazanır, `forbid` gevşetilemez (`E0453`).
- `#[must_use]` sonucun yok sayılmasını lint konusu yapar; `#[expect(lint, reason = "...")]` gereksizleşince uyarır. `Cargo.toml`'da `[lints]` tablosu; CI'da `cargo clippy -- -D warnings`.
- Edition crate başınadır (2015/2018/2021/2024); her derleyici hepsini destekler, crate'ler karışık edition'larla birlikte çalışır. Geçiş: `cargo fix --edition` → `edition` alanını değiştir → test.
- MSRV: `rust-version = "1.88"`; dene: `cargo +1.88.0 check`. `rust-toolchain.toml` herkesi aynı derleyiciye sabitler; komuttaki `+sürüm` her şeyi ezer.
:::

```reflect
prompt: |
  Edition'lar, Python 2'den 3'e geçişte yaşanan "ekosistemin ikiye bölünmesi" sorununu nasıl önlüyor?
  Bir edition'ın neyi değiştirip neyi **değiştiremeyeceğini** de düşünerek açıkla.
answer: |
  Model cevap: Edition crate başına seçilir ve her derleyici tüm edition'ları destekler. Bu yüzden bir
  crate yeni edition'a geçtiğinde bağımlılıklarının da geçmesini beklemek zorunda kalmaz; 2018'de kalmış
  bir kütüphane 2024 crate'i tarafından sorunsuz kullanılır. Değişiklikler yalnızca derleyicinin ön
  yüzünde (anahtar kelimeler, bazı varsayılan kurallar) etkilidir ve derlenmiş kodda edition farkı kalmaz.
  Buna karşılık edition'lar crate'ler arası uyumu bozacak şeyleri, örneğin standart kütüphanenin tiplerini
  ya da derlenmiş kodun yapısını, edition'a göre farklılaştıramaz; std herkes için tektir. Geçiş de
  `cargo fix --edition` ile büyük ölçüde otomatik yapılır.
```

```flashcards
- front: "`cargo install ripgrep --locked` binary'yi nereye kurar, `--locked` ne işe yarar?"
  back: "`~/.cargo/bin`'e. `--locked`, aracın kendi `Cargo.lock`'undaki tam bağımlılık sürümleriyle derlenmesini sağlar."
- front: "`cargo nextest run` komutu Cargo'da yokken nasıl çalışır?"
  back: "Cargo tanımadığı `nextest` komutu için `PATH`'te `cargo-nextest` adlı programı arar ve çalıştırır."
- front: "`#[deny(x)]` ile `#![deny(x)]` farkı?"
  back: "`#[...]` yalnızca ardından gelen öğeye, `#![...]` içinde bulunduğu öğenin tamamına (crate kökünde tüm crate'e) uygulanır."
- front: "`deny` ile `forbid` arasındaki fark?"
  back: "İkisi de hata verir; ama `forbid` içerideki bir `#[allow]` ile gevşetilemez (`E0453`)."
- front: "`#[expect(dead_code)]`'un `#[allow(dead_code)]`'dan üstünlüğü?"
  back: "Lint artık tetiklenmezse uyarır; gereksiz istisnalar kodda birikmez."
- front: "Edition 2024'te `let gen = 3;` neden derlenmez, nasıl düzeltilir?"
  back: "`gen` ayrılmış anahtar kelime oldu. `r#gen` ham tanımlayıcısıyla kullanılır."
- front: Bir projeyi yeni edition'a taşımanın üç adımı?
  back: "1) Eski edition'dayken `cargo fix --edition`, 2) `Cargo.toml`'da `edition`'ı değiştir, 3) derle ve test et."
- front: "`rust-toolchain.toml`'da `channel = \"1.85.0\"` varken `cargo +nightly build` hangi derleyiciyi kullanır?"
  back: "`nightly`. Komuttaki `+araç-zinciri` en yüksek önceliklidir."
```
