---
id: m16-l04
title: Features ve Koşullu Derleme
minutes: 22
type: lesson
objectives:
  - "`#[cfg(...)]` ile `cfg!(...)` arasındaki farkı (kodun derlenmesi ve tip denetimi açısından) açıklayabilmek"
  - "`[features]` tablosunda özellik, `default` ve isteğe bağlı bağımlılık (`optional`, `dep:`) tanımlayıp kodda `#[cfg(feature = \"...\")]` ile kullanabilmek"
  - "`--features`, `--no-default-features` ve `default-features = false` ile hangi özelliklerin açılacağını seçebilmek"
  - Feature birleştirmesinin (unification) neden özellikleri toplanabilir (additive) olmaya zorladığını açıklayabilmek
keywords: [features, cfg, "cfg!", cfg_attr, optional dependency, "dep:", default-features, feature unification, compile_error]
---

`kahve-cekirdek` kütüphanen artık iki farklı kullanıcıya hizmet ediyor. Kasadaki komut satırı aracı
çıktıyı **renkli** göstermek istiyor; web sunucusu ise siparişleri **JSON**'a çevirmek için `serde_json`
istiyor. Her şeyi herkese mi yükleyeceksin? O zaman CLI hiç kullanmadığı bir JSON kütüphanesini de derler,
web sunucusu da hiç göstermediği renk kodlarını taşır.

Rust'ın çözümü **koşullu derleme (conditional compilation)** ve onun üzerine kurulu Cargo
**özellikleri (features)**: Kütüphanenin parçalarını kullanıcı **isterse** açılan anahtarlara bağlarsın.

## cfg: derleyiciye "bunu atla" demek

Modül 13'ten beri her test modülünün başına `#[cfg(test)]` yazıyorsun. Şimdi bu satırın gerçekte ne
yaptığını test edelim. Açıklamayı okumadan önce tahmin et:

```compiles
question: "`cargo run` ile (yani test modu **olmadan**) derlenen bu program derlenir mi?"
code: |
  #[cfg(test)]
  fn yardimci() -> i32 {
      "bu bir sayı değil"
  }

  fn main() {
      println!("sipariş alındı");
  }
answer: true
explanation: |
  Derlenir! `#[cfg(test)]` koşulu yalnızca `cargo test` sırasında doğrudur. Koşul yanlışken işaretli öğe,
  derleyici **tip denetimine başlamadan önce** koddan tamamen çıkarılır. Fonksiyonun gövdesindeki tip
  hatası hiç görülmez. (Kodun yine de sözdizimi olarak geçerli olması gerekir; derleyici onu ayrıştırır,
  ama anlamına bakmaz.)
```

```compiles
question: Peki koşulu bir **ifade** içinde, `cfg!` makrosuyla sorarsan?
code: |
  fn main() {
      if cfg!(test) {
          let adet: i32 = "bu bir sayı değil";
          println!("{adet}");
      }
      println!("sipariş alındı");
  }
answer: false
error: E0308
explanation: |
  `cfg!(test)` yalnızca bir `bool` **değeri** üretir: burada `false`. `if false { ... }` bloğu çalışmaz
  ama **derlenir** ve tip denetiminden geçer. Bu yüzden `E0308: mismatched types` hatası alırsın.
```

İki aracın farkı tam olarak bu:

| | `#[cfg(koşul)]` öznitelik | `cfg!(koşul)` makro |
|---|---|---|
| Nereye yazılır? | öğelere: `fn`, `struct`, `mod`, `use`, `impl`, ifade/deyim | ifadelere: `if cfg!(...)` |
| Koşul yanlışsa | kod **silinir**: derlenmez, denetlenmez | kod kalır, yalnızca çalışmaz |
| Ne zaman? | o platformda/özellikte **var olmayan** bir şeyi kullanan kod | iki dalın da her yerde derlenebildiği basit kararlar |

`#[cfg]` sayesinde Windows'a özgü bir fonksiyonu çağıran kod Linux'ta derlenmeye çalışılmaz; o fonksiyon
Linux'ta hiç yoktur. `cfg!` ise iki dalı da denetlediği için yazım hatalarını her platformda yakalar.
Seçebiliyorsan `cfg!` daha güvenlidir.

:::analogy Matbaa ve not
Bir yemek kitabını iki baskıda çıkaracaksın: normal ve vegan. `#[cfg]` matbaaya giden **sayfaları
seçmektir**: vegan baskıda et tarifinin sayfası hiç basılmaz; o sayfada yazım hatası olsa bile kimse
görmez. `cfg!` ise iki tarifi de basıp kenarına "vegansan bunu atla" notu düşmektir: iki sayfa da
basıldığı için ikisinin de doğru yazılmış olması gerekir.
:::

Koşullar birkaç biçimde yazılır:

| Koşul | Ne zaman doğru? |
|---|---|
| `test` | `cargo test` ile derlenirken |
| `debug_assertions` | `debug-assertions` açıkken (Ders 1) |
| `windows`, `unix` | Windows'ta / Linux, macOS gibi Unix sistemlerde |
| `target_os = "linux"` | hedef işletim sistemi Linux ise |
| `target_pointer_width = "64"` | 64 bit bir hedefte |
| `feature = "json"` | `json` özelliği açıksa (bir sonraki adım) |
| `not(k)`, `all(k1, k2)`, `any(k1, k2)` | değil, hepsi, herhangi biri |

```rust
#[cfg(windows)]
fn ayrac() -> &'static str {
    "\\"
}

#[cfg(not(windows))]
fn ayrac() -> &'static str {
    "/"
}

fn main() {
    // İki ayrac fonksiyonundan yalnızca biri derlenir; hangisi olduğu platforma bağlı.
    println!("kayıt yolu: siparisler{}bugun.txt", ayrac());
    println!("64 bit mi? {}", cfg!(target_pointer_width = "64"));
}
```

Bu programı Rusteach'in çevrimiçi çalıştırıcısında (Linux) çalıştırırsan `/`, Windows'ta kendi
bilgisayarında çalıştırırsan `\` görürsün. Aynı adı taşıyan iki fonksiyon var ama **çakışmaz**, çünkü
herhangi bir derlemede yalnızca biri vardır.

## [features]: kullanıcının açtığı anahtarlar

Bir crate'in özelliklerini `Cargo.toml`'daki `[features]` tablosunda tanımlarsın. Her özellik bir addır;
eşittir işaretinin sağındaki liste, o özellik açıldığında **başka hangi özelliklerin** açılacağını söyler:

```toml
# kahve-cekirdek/Cargo.toml
[features]
default = ["renkli"]          # kullanıcı bir şey demezse açılanlar
renkli = []                   # başka hiçbir şeyi açmayan basit bir anahtar
istatistik = []
tam = ["renkli", "istatistik"] # bir "paket" özellik: ikisini birden açar
```

Kodda her özellik bir `cfg` koşuludur: `#[cfg(feature = "renkli")]`. Aşağıdaki örnekte iki özellik de
**kapalı**:

```rust
#![allow(unexpected_cfgs)] // aşağıdaki "Bu uygulamada" notuna bak

#[cfg(feature = "renkli")]
fn baslik(metin: &str) -> String {
    format!("\x1b[1;33m{metin}\x1b[0m") // ANSI kodlarıyla kalın sarı
}

#[cfg(not(feature = "renkli"))]
fn baslik(metin: &str) -> String {
    format!("== {metin} ==")
}

#[cfg(feature = "istatistik")]
fn ortalama(fiyatlar: &[u32]) -> u32 {
    fiyatlar.iter().sum::<u32>() / fiyatlar.len() as u32
}

fn main() {
    println!("{}", baslik("Günün siparişleri"));
    let fiyatlar = [9000, 6500, 10500];
    println!("{} sipariş alındı", fiyatlar.len());

    #[cfg(feature = "istatistik")]
    println!("ortalama: {} kuruş", ortalama(&fiyatlar));
}
```

Kendi projende özellikleri komut satırından seçersin:

| Komut | Açık özellikler (yukarıdaki tabloyla) |
|---|---|
| `cargo build` | `default` → `renkli` |
| `cargo build --features istatistik` | `renkli`, `istatistik` |
| `cargo build -F tam` | `renkli`, `istatistik`, `tam` |
| `cargo build --no-default-features` | hiçbiri |
| `cargo build --no-default-features -F istatistik` | yalnızca `istatistik` |
| `cargo build --all-features` | hepsi |

:::info Bu uygulamada Cargo.toml yok
Cargo, `Cargo.toml`'da **tanımlanmamış** bir özellik adını `cfg`'de görürse yazım hatası yapmış olabileceğini
düşünüp uyarır. Rusteach'in tek dosyalık ortamında hiç `[features]` tablosu olmadığı için her
`feature = "..."` bu uyarıyı tetikler:

```text
warning: unexpected `cfg` condition value: `renkli`
 --> src/main.rs:3:7
  |
3 | #[cfg(feature = "renkli")]
  |       ^^^^^^^^^^^^^^^^^^ help: remove the condition
  |
  = note: no expected values for `feature`
  = help: consider adding `renkli` as a feature in `Cargo.toml`
  = note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
  = note: `#[warn(unexpected_cfgs)]` on by default
```

Gerçek bir projede bu uyarı çok değerlidir: `#[cfg(feature = "renkl")]` gibi bir yazım hatası, kodun sessizce
**hiç derlenmemesine** yol açardı. Örneklerimizdeki `#![allow(unexpected_cfgs)]` satırı yalnızca bu
ortam içindir; kendi projende yazma, özelliklerini `[features]`'a ekle. (Lint seviyelerini Ders 5'te
göreceksin.)
:::

Bir bağımlılığın özelliklerini de sen seçersin. `kahve-cli`, çekirdeği renksiz ama istatistikli istiyorsa:

```toml
# kahve-cli/Cargo.toml
[dependencies]
kahve-cekirdek = { path = "../kahve-cekirdek", default-features = false, features = ["istatistik"] }
```

```quiz
question: |
  `kahve-cekirdek`'in `[features]` tablosu yukarıdaki gibi (`default = ["renkli"]`, `tam = ["renkli", "istatistik"]`).
  `kahve-web` onu `kahve-cekirdek = { path = "../kahve-cekirdek", features = ["istatistik"] }` ile kullanıyor.
  `kahve-web` için çekirdekte hangi özellikler açıktır?
options:
  - "Yalnızca `istatistik`"
  - "`default`, `renkli` ve `istatistik`"
  - "`tam`, `renkli` ve `istatistik`"
  - Hiçbiri; özellikler yalnızca komut satırından açılır
answer: 1
explanation: |
  `default-features = false` yazılmadıkça varsayılan özellikler **her zaman** açılır; `features = [...]`
  listesi bunlara **ekleme** yapar. Yani `default` (ve onun açtığı `renkli`) ile istenen `istatistik`
  birlikte açıktır. `tam` ise kimse istemediği için kapalıdır. Yalnızca `istatistik` isteseydin
  `default-features = false` eklemen gerekirdi.
feedback:
  - "Bunun için `default-features = false` da gerekirdi."
  - Doğru!
  - "`tam`'ı kimse istemedi; o yalnızca bir kısayol."
  - "Bağımlılık satırındaki `features` listesi de özellik açar."
```

## İsteğe bağlı bağımlılıklar

Özelliklerin asıl gücü, **bağımlılıkları** da açıp kapatabilmeleridir. JSON desteği yalnızca isteyenlere
`serde_json` indirtsin:

```toml
[dependencies]
serde = { version = "1", optional = true, features = ["derive"] }
serde_json = { version = "1", optional = true }

[features]
default = ["renkli"]
renkli = []
json = ["dep:serde", "dep:serde_json"]
```

- `optional = true` bağımlılığı **varsayılan olarak devre dışı** bırakır: kimse istemezse indirilmez,
  derlenmez.
- `"dep:serde_json"` girdisi "bu özellik açılınca `serde_json` bağımlılığını etkinleştir" demektir.
- `dep:` önekini hiç kullanmasaydın Cargo her isteğe bağlı bağımlılık için **aynı adla gizli bir
  özellik** oluştururdu (`--features serde_json` çalışırdı). `dep:` kullanınca bu gizli özellik
  oluşmaz ve genel API'nde yalnızca senin seçtiğin `json` adı görünür.

Kodda, bağımlılığa dokunan her şey aynı özelliğin arkasına girer. `cfg_attr` özniteliği bir özniteliği
**koşullu** olarak ekler: "`json` açıksa bu struct'a `Serialize` türet":

```rust
#![allow(unexpected_cfgs)]

#[derive(Debug)]
#[cfg_attr(feature = "json", derive(serde::Serialize))]
struct Siparis {
    icecek: String,
    fiyat: u32,
}

#[cfg(feature = "json")]
fn json_yap(s: &Siparis) -> String {
    serde_json::to_string(s).unwrap()
}

fn main() {
    let s = Siparis { icecek: String::from("latte"), fiyat: 9000 };
    println!("{s:?}");
    println!("{}: {} kuruş", s.icecek, s.fiyat);

    #[cfg(feature = "json")]
    println!("{}", json_yap(&s));
}
```

`json` kapalıyken bu program `serde` olmadan da derlenir: `derive(serde::Serialize)` ve `json_yap`
koddan tamamen çıkarılır.

Bir bağımlılığın **kendi** özelliklerini de bir özelliğe bağlayabilirsin: `json = ["dep:serde_json",
"serde/derive"]`. Bağımlılık isteğe bağlıysa ve onu sırf bunun için açmak istemiyorsan soru işaretli
**zayıf (weak)** biçim vardır: `"serde?/derive"` "serde zaten açıksa `derive`'ı da aç" demektir.

Modül 6'dan bu yana yazdığın `derive` özniteliklerini hatırlayarak tahmin et:

```predict
code: |
  #[cfg_attr(debug_assertions, derive(Debug))]
  struct Kahve {
      ad: &'static str,
      shot: u8,
  }

  fn main() {
      let k = Kahve { ad: "türk kahvesi", shot: 1 };
      if cfg!(debug_assertions) {
          println!("hata ayıklama: {}", k.ad);
      }
      println!("{} shot", k.shot);
  }
options:
  - |
    hata ayıklama: türk kahvesi
    1 shot
  - |
    1 shot
  - |
    Kahve { ad: "türk kahvesi", shot: 1 }
    1 shot
answer: 0
explanation: |
  Rusteach `dev` profiliyle derler; `debug_assertions` doğrudur. `cfg_attr` bu yüzden `Kahve`'ye
  `Debug` türetir, ama program `{:?}` kullanmadığı için bunun çıktıya etkisi yok. `if cfg!(...)` dalı
  çalışır ve iki satır yazılır. `--release` ile derlenseydi yalnızca `1 shot` yazılırdı ve `Kahve`'nin
  `Debug` uygulaması da olmazdı.
```

```quiz
question: |
  `Cargo.toml`'da `serde_json = { version = "1", optional = true }` var ve **hiçbir** özellik
  `dep:serde_json` kullanmıyor. Hangisi doğrudur?
options:
  - "`serde_json` her zaman derlenir; `optional` yalnızca bir nottur"
  - "Cargo gizli bir `serde_json` özelliği oluşturur; `--features serde_json` ile açılabilir"
  - "Bu bir hatadır; isteğe bağlı bağımlılık mutlaka `dep:` ile kullanılmalıdır"
  - "`serde_json`'ı kodda `#[cfg(dep = \"serde_json\")]` ile sorgularsın"
answer: 1
explanation: |
  Tarihsel olarak her isteğe bağlı bağımlılık, kendi adıyla örtük (*implicit*) bir özellik oluşturur.
  Kodda da `#[cfg(feature = "serde_json")]` ile sorgulanır. `dep:` sözdizimi (Rust 1.60) bu örtük
  özelliği kapatıp bağımlılığı senin adlandırdığın bir özelliğin arkasına saklamanı sağlar.
feedback:
  - "`optional = true` gerçekten devre dışı bırakır; kimse açmazsa indirilmez bile."
  - Doğru!
  - "`dep:` kullanmak tercihtir; kullanılmazsa örtük özellik devreye girer."
  - "Böyle bir koşul yok; özellikler `feature = \"...\"` ile sorgulanır."
```

## Özellikler toplanır: birleştirme kuralı

Şimdi workspace'teki kahve dükkânına geri dön. `kahve-cli` çekirdeği `features = ["renkli"]` ile,
`kahve-web` ise `features = ["json"]` ile kullanıyor. Workspace'i derlediğinde çekirdek kaç kez derlenir?

**Bir kez**, ve **iki özellik birden açık** olarak. Cargo aynı derlemede aynı crate'i istenen tüm
özelliklerin **birleşimiyle** (*union*) bir kez derler. Buna **özellik birleştirme (feature
unification)** denir. Bu, Ders 3'teki "bir kez derle" kazancını korur; ama önemli bir kural da getirir:

:::warning Özellikler toplanabilir (additive) olmalı
Bir özelliği açmak **yalnızca yetenek eklemeli**, hiçbir şeyi kaldırmamalı ya da davranışı başka bir
özellikle çelişecek biçimde değiştirmemelidir. Çünkü bağımlılık ağacının başka bir köşesindeki bir crate
o özelliği açtığında, sen istemesen de **senin** derlemende de açılacaktır.

Kötü örnek: `tek-thread` ve `cok-thread` diye birbirini dışlayan iki özellik. İki farklı bağımlı ikisini
ayrı ayrı açarsa, birleşimde ikisi de açık olur ve kütüphane ya derlenmez ya da tutarsız davranır.
Gerçekten dışlayan bir seçim gerekiyorsa en azından bunu açıkça yakala:

```text
#[cfg(all(feature = "tek-thread", feature = "cok-thread"))]
compile_error!("`tek-thread` ve `cok-thread` birlikte açılamaz");
```
:::

`compile_error!` makrosu, derlendiği anda verdiğin mesajla bir derleme hatası üretir. `cfg` ile
birleşince "bu yapılandırma geçersiz" demenin standart yoludur. Hangi özelliğin kimin yüzünden açık
olduğunu ise Ders 3'teki `cargo tree` ile görürsün: `cargo tree -e features -i kahve-cekirdek`.

Birleştirmenin bir istisnası var: Edition 2021 ve sonrasının çözümleyicisi (`resolver = "2"` ve `"3"`),
yalnızca testlerde kullanılan bağımlılıkların (`[dev-dependencies]`) ve yalnızca belirli bir platformda
kullanılan bağımlılıkların özelliklerini normal derlemeye **bulaştırmaz**. Eski `resolver = "1"` bunları
da birleştirirdi; sanal manifestlerde `resolver`'ı açıkça yazmanın nedenlerinden biri buydu.

```quiz
question: |
  Bir `zaman` kütüphanesi `utc` özelliği açıkken tüm saatleri UTC'de, kapalıyken yerel saatte döndürüyor.
  Bu tasarımın sorunu nedir?
options:
  - Sorun yok; kullanıcı istediğini seçer
  - "Özellik **toplanabilir değil**: ağaçtaki başka bir crate `utc`'yi açarsa, yerel saat bekleyen senin kodun da sessizce UTC almaya başlar"
  - "Özellik adları küçük harfle yazılamaz"
  - "Özellikler yalnızca bağımlılıkları açabilir, kodu değiştiremez"
answer: 1
explanation: |
  Birleştirme yüzünden bir özelliği **senin** derlemende kimin açtığını kontrol edemezsin. `utc`
  davranışı değiştirdiği için, hiç ilgisi olmayan bir bağımlılık onu açtığında programın sessizce yanlış
  saat göstermeye başlar. Doğru tasarım iki yeteneği de sunmak (ör. `simdi_utc()` ve `simdi_yerel()`)
  ya da seçimi bir çalışma zamanı parametresine bırakmaktır.
feedback:
  - Birleştirme yüzünden "kullanıcı seçer" varsayımı tutmaz.
  - Doğru!
  - Özellik adlarında küçük harf gayet olağandır; özelliklerin çoğu zaten küçük harfle yazılır.
  - "Özellikler `#[cfg(feature)]` ile kodu da değiştirebilir; sorun da tam bu."
```

:::tip docs.rs ve özellikler
docs.rs bir crate'in belgelerini varsayılan özelliklerle derler; arkasında özellik olan API'lerin
belgede görünmesi için `Cargo.toml`'a şunu eklersin:

```toml
[package.metadata.docs.rs]
all-features = true
```
:::

## Alıştırmalar

İlk alıştırma, özellikli kodu **test edilebilir** yazmanın deyimsel yolunu öğretiyor: özelliğe bağlı
kararı tek bir yere topla, mantığı ise sıradan bir parametreyle yaz.

```exercise
id: m16-e-renkli-log
title: Renkli kasa günlüğü
difficulty: 2
prompt: |
  Kasa programının günlük (log) satırlarını üreten iki fonksiyon yaz:

  1. `bicimle(seviye, mesaj, renkli) -> String`:
     - Renksiz: `[BİLGİ] mesaj`, `[UYARI] mesaj`, `[HATA] mesaj`
     - Renkli: etiketin etrafına ANSI kodu eklenir: bilgi `\x1b[32m` (yeşil), uyarı `\x1b[33m` (sarı),
       hata `\x1b[31m` (kırmızı), sonunda `\x1b[0m`. Örnek: `"\x1b[33m[UYARI]\x1b[0m süt azaldı"`
  2. `log_satiri(seviye, mesaj) -> String`: `bicimle`'yi çağırır; `renkli` argümanı
     `cfg!(feature = "renkli")` olmalıdır.

  Böylece renk mantığının iki dalı da her derlemede derlenir ve test edilebilir.
starter: |
  #![allow(unexpected_cfgs)]

  #[derive(Debug, Clone, Copy)]
  pub enum Seviye {
      Bilgi,
      Uyari,
      Hata,
  }

  pub fn bicimle(seviye: Seviye, mesaj: &str, renkli: bool) -> String {
      todo!()
  }

  pub fn log_satiri(seviye: Seviye, mesaj: &str) -> String {
      todo!()
  }

  fn main() {
      println!("{}", log_satiri(Seviye::Uyari, "süt azaldı"));
  }
solution: |
  #![allow(unexpected_cfgs)]

  #[derive(Debug, Clone, Copy)]
  pub enum Seviye {
      Bilgi,
      Uyari,
      Hata,
  }

  pub fn bicimle(seviye: Seviye, mesaj: &str, renkli: bool) -> String {
      let (etiket, renk) = match seviye {
          Seviye::Bilgi => ("[BİLGİ]", "\x1b[32m"),
          Seviye::Uyari => ("[UYARI]", "\x1b[33m"),
          Seviye::Hata => ("[HATA]", "\x1b[31m"),
      };
      if renkli {
          format!("{renk}{etiket}\x1b[0m {mesaj}")
      } else {
          format!("{etiket} {mesaj}")
      }
  }

  pub fn log_satiri(seviye: Seviye, mesaj: &str) -> String {
      bicimle(seviye, mesaj, cfg!(feature = "renkli"))
  }

  fn main() {
      println!("{}", log_satiri(Seviye::Uyari, "süt azaldı"));
  }
check: tests
tests: |
  #[test]
  fn renksiz_satirlar() {
      assert_eq!(bicimle(Seviye::Bilgi, "kasa açıldı", false), "[BİLGİ] kasa açıldı");
      assert_eq!(bicimle(Seviye::Uyari, "süt azaldı", false), "[UYARI] süt azaldı");
      assert_eq!(bicimle(Seviye::Hata, "yazıcı yok", false), "[HATA] yazıcı yok");
  }

  #[test]
  fn renkli_satirlar() {
      assert_eq!(bicimle(Seviye::Uyari, "süt azaldı", true), "\x1b[33m[UYARI]\x1b[0m süt azaldı", "uyarı sarı (33) olmalı");
      assert_eq!(bicimle(Seviye::Hata, "yazıcı yok", true), "\x1b[31m[HATA]\x1b[0m yazıcı yok", "hata kırmızı (31) olmalı");
      assert_eq!(bicimle(Seviye::Bilgi, "", true), "\x1b[32m[BİLGİ]\x1b[0m ", "boş mesajda da etiket ve boşluk kalır");
  }

  #[test]
  fn ozellik_kapaliyken_renksiz() {
      // Bu ortamda `renkli` özelliği tanımlı değil, yani kapalı.
      assert_eq!(log_satiri(Seviye::Bilgi, "gün sonu"), "[BİLGİ] gün sonu", "özellik kapalıyken log_satiri renksiz olmalı");
  }
hints:
  - "`match seviye` ile her seviye için `(etiket, renk_kodu)` çiftini seç; böylece formatı tek yerde yazarsın."
  - "Renkli biçim: `format!(\"{renk}{etiket}\\x1b[0m {mesaj}\")`, renksiz: `format!(\"{etiket} {mesaj}\")`."
  - "`log_satiri` tek satırdır: `bicimle(seviye, mesaj, cfg!(feature = \"renkli\"))`."
require:
  - pattern: "cfg!\\(\\s*feature\\s*=\\s*\"renkli\"\\s*\\)"
    message: "`log_satiri`, kararı `cfg!(feature = \"renkli\")` ile vermeli."
explanation: |
  `#[cfg(feature = "renkli")]` ile iki ayrı `log_satiri` yazsaydın, testlerin yalnızca o an açık olan
  dalı görürdü; kapalı daldaki bir hata (hatta bir tip hatası!) `cargo test --features renkli`
  çalıştırılana kadar fark edilmezdi. Kararı `cfg!` ile tek bir yere toplayıp mantığı bir `bool`
  parametresine bağlayınca **iki dal da her derlemede derlenir ve test edilir**.

  `#[cfg]` hâlâ gereklidir; ama yalnızca bir dalın gerçekten **derlenemeyeceği** durumlarda: o dal bir
  isteğe bağlı bağımlılığı kullanıyorsa, ya da yalnızca bir platformda var olan bir API'yi çağırıyorsa.
  Büyük projeler tüm özellik kombinasyonlarını denemek için CI'da `cargo hack --feature-powerset check`
  gibi araçlar çalıştırır.
```

İkinci alıştırmada Cargo'nun `[features]` tablosunu nasıl çözdüğünü sen kodlayacaksın.

```exercise
id: m16-e-ozellik-cozucu
title: Özellik çözücü
difficulty: 4
prompt: |
  `etkin_ozellikler(tanimlar, istenen, varsayilanlar)` fonksiyonunu yaz. `tanimlar`, `[features]`
  tablosunun satırlarıdır: `("tam", vec!["renkli", "json"])`, `("json", vec!["dep:serde_json"])`...

  Kurallar:

  1. Başlangıçta `istenen` özellikler açıktır. `varsayilanlar` `true` ise ve `"default"` tanımlıysa
     `"default"` da açılır.
  2. Açık her özelliğin listesindeki girdiler de açılır, **zincir hâlinde** (açılan özellik de kendi
     listesini açar).
  3. `dep:` ile başlayan girdiler özellik değil, **isteğe bağlı bağımlılıktır**: `bagimliliklar`
     listesine öneksiz eklenir (`"serde_json"`).
  4. Tanımlanmamış bir özellik istenirse ya da bir listede geçerse →
     `Err("bilinmeyen özellik: <ad>")`.
  5. Sonuçtaki iki liste de alfabetik sıralı ve tekrarsızdır.
starter: |
  #[derive(Debug, PartialEq)]
  pub struct Etkin {
      pub ozellikler: Vec<String>,
      pub bagimliliklar: Vec<String>,
  }

  pub fn etkin_ozellikler(
      tanimlar: &[(&str, Vec<&str>)],
      istenen: &[&str],
      varsayilanlar: bool,
  ) -> Result<Etkin, String> {
      todo!()
  }

  fn main() {
      let tanimlar = [
          ("default", vec!["renkli"]),
          ("renkli", vec![]),
          ("json", vec!["dep:serde", "dep:serde_json"]),
          ("tam", vec!["renkli", "json"]),
      ];
      println!("{:?}", etkin_ozellikler(&tanimlar, &["tam"], false));
  }
solution: |
  use std::collections::{BTreeSet, HashMap};

  #[derive(Debug, PartialEq)]
  pub struct Etkin {
      pub ozellikler: Vec<String>,
      pub bagimliliklar: Vec<String>,
  }

  pub fn etkin_ozellikler(
      tanimlar: &[(&str, Vec<&str>)],
      istenen: &[&str],
      varsayilanlar: bool,
  ) -> Result<Etkin, String> {
      let tablo: HashMap<&str, &Vec<&str>> = tanimlar.iter().map(|(ad, liste)| (*ad, liste)).collect();

      let mut bekleyen: Vec<&str> = istenen.to_vec();
      if varsayilanlar && tablo.contains_key("default") {
          bekleyen.push("default");
      }

      let mut ozellikler = BTreeSet::new();
      let mut bagimliliklar = BTreeSet::new();

      while let Some(ad) = bekleyen.pop() {
          if let Some(dep) = ad.strip_prefix("dep:") {
              bagimliliklar.insert(dep.to_string());
              continue;
          }
          let Some(liste) = tablo.get(ad) else {
              return Err(format!("bilinmeyen özellik: {ad}"));
          };
          if ozellikler.insert(ad.to_string()) {
              bekleyen.extend(liste.iter().copied());
          }
      }

      Ok(Etkin {
          ozellikler: ozellikler.into_iter().collect(),
          bagimliliklar: bagimliliklar.into_iter().collect(),
      })
  }

  fn main() {
      let tanimlar = [
          ("default", vec!["renkli"]),
          ("renkli", vec![]),
          ("json", vec!["dep:serde", "dep:serde_json"]),
          ("tam", vec!["renkli", "json"]),
      ];
      println!("{:?}", etkin_ozellikler(&tanimlar, &["tam"], false));
  }
check: tests
tests: |
  fn kahve_tablosu() -> Vec<(&'static str, Vec<&'static str>)> {
      vec![
          ("default", vec!["renkli"]),
          ("renkli", vec![]),
          ("istatistik", vec![]),
          ("json", vec!["dep:serde", "dep:serde_json"]),
          ("tam", vec!["renkli", "istatistik", "json"]),
      ]
  }

  fn etkin(oz: &[&str], bag: &[&str]) -> Result<Etkin, String> {
      Ok(Etkin {
          ozellikler: oz.iter().map(|s| s.to_string()).collect(),
          bagimliliklar: bag.iter().map(|s| s.to_string()).collect(),
      })
  }

  #[test]
  fn yalnizca_varsayilanlar() {
      assert_eq!(etkin_ozellikler(&kahve_tablosu(), &[], true), etkin(&["default", "renkli"], &[]), "cargo build: default ve onun açtığı renkli");
      assert_eq!(etkin_ozellikler(&kahve_tablosu(), &[], false), etkin(&[], &[]), "--no-default-features: hiçbir şey açılmaz");
  }

  #[test]
  fn dep_girdileri_bagimlilik_olur() {
      assert_eq!(
          etkin_ozellikler(&kahve_tablosu(), &["json"], false),
          etkin(&["json"], &["serde", "serde_json"]),
          "dep: girdileri özellik değil, isteğe bağlı bağımlılıktır"
      );
  }

  #[test]
  fn zincirleme_ve_tekrarsiz() {
      assert_eq!(
          etkin_ozellikler(&kahve_tablosu(), &["tam", "renkli"], true),
          etkin(&["default", "istatistik", "json", "renkli", "tam"], &["serde", "serde_json"]),
          "tam üç özelliği açar; renkli iki kez istense de bir kez görünür"
      );
  }

  #[test]
  fn varsayilan_tanimli_degilse() {
      let tablo = vec![("hizli", vec![])];
      assert_eq!(etkin_ozellikler(&tablo, &["hizli"], true), etkin(&["hizli"], &[]), "default tanımlı değilse yalnızca istenenler açılır");
  }

  #[test]
  fn bilinmeyen_ozellik() {
      assert_eq!(etkin_ozellikler(&kahve_tablosu(), &["renk"], true), Err("bilinmeyen özellik: renk".to_string()), "yazım hatası olan özellik reddedilmeli");
      let bozuk = vec![("bozuk", vec!["yok"])];
      assert_eq!(etkin_ozellikler(&bozuk, &["bozuk"], false), Err("bilinmeyen özellik: yok".to_string()), "listede geçen tanımsız özellik de hatadır");
  }
hints:
  - "Önce tanımları bir `HashMap<&str, &Vec<&str>>`'e koy. Açılacakları bir `Vec`'te (yapılacaklar listesi) biriktir ve `while let Some(ad) = bekleyen.pop()` ile tek tek işle."
  - "`ad.strip_prefix(\"dep:\")` bir `Option<&str>` döndürür: `Some` ise bu bir bağımlılıktır. Değilse tabloda ara; yoksa `Err` döndür."
  - "Sonsuz döngüye ve tekrara karşı `BTreeSet` kullan: `insert` zaten varsa `false` döndürür; yalnızca `true` döndüğünde o özelliğin listesini yapılacaklara ekle. Sonda `into_iter().collect()` ile sıralı `Vec`'lere çevir."
explanation: |
  Bu bir **grafik dolaşma** problemi: özellikler düğüm, listeler oklar. "Yapılacaklar" listesi ve
  "görüldü" kümesiyle her düğümü bir kez ziyaret edersin; `ozellikler.insert(...)`'in `bool` dönüşü hem
  tekrarı hem de olası döngüleri (`a = ["b"]`, `b = ["a"]`) zararsız kılar.

  `BTreeSet` iki iş birden görür: tekrarları eler ve sonucu sıralı tutar. Gerçek Cargo da çözümlemenin
  sonunda her crate için böyle bir özellik kümesi hesaplar; workspace'te bir crate'i isteyen herkesin
  kümeleri **birleştirilir**, yani bu derste öğrendiğin birleştirme kuralı tam olarak bu fonksiyonun
  birden çok `istenen` listesiyle çağrılıp sonuçların birleşimi alınmasıdır.

  `strip_prefix` (Ders 3'teki alıştırmada kullandığın `trim_start_matches`'ın daha katı kardeşi) yalnızca önek **tam olarak
  bir kez** başta varsa onu atar ve bunu `Option` ile bildirir; "bu bir `dep:` mi?" sorusunu ve öneki
  atmayı tek adımda yapar.
```

## Özet

:::remember
- `#[cfg(koşul)]` öğeyi koddan **siler** (tip denetimi bile yapılmaz); `cfg!(koşul)` yalnızca bir `bool` üretir, iki dal da derlenir.
- Koşullar: `test`, `debug_assertions`, `windows`/`unix`, `target_os = "..."`, `feature = "..."`, `not`/`all`/`any`.
- `[features]`: `default = [...]` varsayılanlar, `ad = [başka özellikler]`. Komutlar: `--features`/`-F`, `--no-default-features`, `--all-features`.
- Bağımlılık tarafında `features = [...]` ekler; varsayılanları kapatmak için `default-features = false`.
- İsteğe bağlı bağımlılık: `optional = true` + özellikte `"dep:ad"`; zayıf özellik: `"ad?/ozellik"`; koşullu öznitelik: `#[cfg_attr(feature = "x", derive(...))]`.
- Özellikler tüm ağaçta **birleştirilir** → toplanabilir (additive) olmalı; çelişen kombinasyonu `compile_error!` ile yakala.
:::

```reflect
prompt: |
  Cargo neden aynı crate'i farklı özellik kümeleriyle iki kez derlemek yerine özellikleri birleştirip bir
  kez derliyor? Bu kararın kütüphane yazarı olarak sana yüklediği kural nedir?
answer: |
  Model cevap: Aynı crate'i özellik kombinasyonu başına ayrı derlemek hem derleme süresini hem binary
  boyutunu artırırdı; daha da kötüsü, aynı crate'in iki kopyasının tipleri birbiriyle uyumsuz olurdu,
  yani bir kopyanın `Siparis`'i diğerini bekleyen fonksiyona verilemezdi. Birleştirme tek, tutarlı bir
  kopya sağlar. Bedeli şu: bir özelliği senin derlemende kimin açtığını kontrol edemezsin. Bu yüzden her
  özellik yalnızca yetenek **eklemeli**, hiçbir davranışı kaldırmamalı ya da değiştirmemeli; birbirini
  dışlayan özelliklerden kaçınmalı, kaçınılmazsa `compile_error!` ile açıkça yakalamalıyım.
```

```flashcards
- front: "`#[cfg(test)]` ile işaretli bir fonksiyonda tip hatası var. `cargo build` başarısız olur mu?"
  back: "Hayır. Koşul yanlışken öğe tip denetiminden **önce** koddan silinir (sözdizimi yine geçerli olmalı)."
- front: "`if cfg!(feature = \"x\") { ... }` bloğu, `x` kapalıyken derlenir mi?"
  back: "Evet. `cfg!` yalnızca bir `bool` üretir; blok derlenir ve denetlenir, sadece çalışmaz."
- front: "`default = [\"renkli\"]` olan bir crate'i yalnızca `istatistik` özelliğiyle kullanmak için bağımlılık satırına ne yazarsın?"
  back: "`default-features = false, features = [\"istatistik\"]`"
- front: Bir bağımlılığı yalnızca `json` özelliği açıldığında derlemek için gereken iki adım?
  back: "Bağımlılığa `optional = true`, özelliğe `json = [\"dep:serde_json\"]`."
- front: "`\"serde?/derive\"` ne anlama gelir?"
  back: "Zayıf özellik: `serde` zaten başka bir nedenle açıksa onun `derive` özelliğini de aç; açık değilse onu açma."
- front: Özellik birleştirme (feature unification) nedir?
  back: Aynı derlemede bir crate, onu isteyen herkesin istediği özelliklerin **birleşimiyle** bir kez derlenir.
- front: Özellikler neden toplanabilir (additive) olmalı?
  back: Ağaçtaki başka bir crate bir özelliği açarsa senin derlemende de açılır; özellik bir şeyi kaldırırsa ya da davranışı değiştirirse kod sessizce bozulur.
- front: "`#[cfg_attr(feature = \"json\", derive(serde::Serialize))]` ne yapar?"
  back: "`json` açıksa struct'a `derive(serde::Serialize)` ekler; kapalıysa hiçbir şey eklemez."
```
