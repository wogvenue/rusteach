---
id: m15-l04
title: Ortam değişkenleri ve stderr
minutes: 35
type: project
objectives:
  - "`std::env::var` ile bir ortam değişkenini okuyup dönen `Result<String, VarError>`'ı yorumlayabilmek"
  - "Ortamı okuma işini `main`'e alıp `Config::build`'e parametre olarak vermenin test edilebilirliğe katkısını açıklayabilmek"
  - "Veriyi `println!` ile stdout'a, hata ve tanı mesajlarını `eprintln!` ile stderr'e yazmanın gerekçesini açıklayabilmek"
  - "Programı yönlendirmelerle (`>`, `2>`) ve çıkış kodlarıyla elle test edebilmek"
keywords: [ortam değişkeni, environment variable, std::env::var, VarError, IGNORE_CASE, stderr, stdout, eprintln!, yönlendirme, çıkış kodu, bağımlılık enjeksiyonu]
---

Önceki derste `ara_buyuk_kucuk_duyarsiz`'ı yazdık ama kullanıcının onu seçmesinin bir yolu yok. Bir
komut satırı seçeneği (`-i`) ekleyebilirdik; bunu beşinci derste `clap` ile yapacağız. Bu derste başka bir
yaygın yolu öğreneceğiz: **ortam değişkenleri (environment variables)**. Ayrıca programın şimdiye kadar
gizli kalan bir kusurunu düzelteceğiz: hata mesajlarını **yanlış kanala** yazıyoruz.

Bu iki konu ilk bakışta küçük görünür, ama bir aracı "benim bilgisayarımda çalışıyor"dan "herkesin
betiklerinde güvenle kullanılıyor"a taşıyan şeyler tam olarak bunlardır.

## Ortam değişkeni nedir?

Her çalışan program (süreç, process), işletim sisteminden `ANAHTAR=değer` biçiminde küçük bir metin
sözlüğü alır: **ortam (environment)**. Sen farkında olmadan her gün kullanıyorsun:

| Değişken | Anlamı |
|----------|--------|
| `PATH` | Komut adı yazınca programların aranacağı klasörler (`cargo` bu sayede bulunur) |
| `HOME` / `USERPROFILE` | Kullanıcının ev klasörü (Linux-macOS / Windows) |
| `LANG` | Dil ve bölge ayarı |
| `RUST_BACKTRACE` | Rust programları panikte yığın izini (backtrace) göstersin mi? |

Kural basit: bir program başka bir programı başlattığında, çocuk süreç ebeveyninin ortamının bir
**kopyasını** alır. Terminalde bir değişken ayarlarsan, oradan başlattığın `cargo` ve onun başlattığı `ara`
o değeri görür. Çocuğun kendi kopyasında yaptığı değişiklik ise ebeveyne geri dönmez.

Terminaline göre ayarlama yolları:

```console
# bash / zsh (Linux, macOS, Git Bash) — yalnızca bu komut için:
$ IGNORE_CASE=1 cargo run -- rust siir.txt

# PowerShell — oturum boyunca geçerli, işin bitince kaldır:
PS> $Env:IGNORE_CASE=1; cargo run -- rust siir.txt
PS> Remove-Item Env:IGNORE_CASE

# cmd.exe:
> set IGNORE_CASE=1
> cargo run -- rust siir.txt
> set IGNORE_CASE=
```

**Ne zaman argüman, ne zaman ortam değişkeni?** Argümanlar **o çalıştırmaya özgü** isteklerdir (bu sorgu,
bu dosya). Ortam değişkenleri ise **ortama ait** ayarlardır: bir terminal oturumu boyunca, bir sunucuda ya da
bir CI (sürekli entegrasyon) hattında hep aynı kalan tercihler. Birçok araç ikisini birden sunar ve
argümanı ortamdan üstün tutar.

:::analogy Mutfağın kuralları ve siparişin notu
Restoran benzetmemize dönelim. Garsonun getirdiği sipariş fişi (argümanlar) **o masaya özgüdür**: "bir
mercimek, acısız". Mutfağın duvarındaki pano ise (ortam) **herkes için geçerli** kuralları söyler: "bugün
tuzu az kullan". Aşçı her siparişte panoya da bakar. Pano değişince bütün siparişler etkilenir; bir fişteki
not ise yalnızca o tabağı değiştirir.
:::

```quiz
question: |
  Modül 10'da paniklerde yığın izini görmek için `RUST_BACKTRACE=1 cargo run` yazmıştın. Burada
  `RUST_BACKTRACE` nedir?
options:
  - "`cargo run`'a verilen bir komut satırı argümanı"
  - Rust programının çalışırken okuduğu bir ortam değişkeni
  - Derleyiciye verilen bir derleme bayrağı
answer: 1
explanation: |
  `RUST_BACKTRACE=1 komut` yazımı (bash'te), değişkeni yalnızca o komutun ortamına koyar. `cargo` bu ortamı
  başlattığı programa aktarır; programın panik mekanizması da çalışma anında `RUST_BACKTRACE`'i okuyup yığın
  izini basıp basmayacağına karar verir. Yani bu, `ara`'ya şimdi ekleyeceğimiz `IGNORE_CASE` ile **aynı
  mekanizmadır**.
feedback:
  - "Argümanlar komutun **sonuna** yazılır ve `args()` ile okunur; `ANAHTAR=değer` öneki ise ortamı ayarlar."
  - Doğru!
  - "Derleyici bayrakları (`--release` gibi) derlemeyi etkiler; `RUST_BACKTRACE` ise çalışma anında okunur."
```

## std::env::var ile okumak

Bir ortam değişkenini okumak için `std::env::var` kullanılır:

```rust,ignore
pub fn var<K: AsRef<OsStr>>(key: K) -> Result<String, VarError>
```

Değişken tanımlıysa ve değeri geçerli Unicode ise `Ok(değer)` döner. Değilse `Err(VarError)`: bu bir enum'dur
ve iki varyantı vardır, `NotPresent` (tanımlı değil) ve `NotUnicode(OsString)` (tanımlı ama geçerli UTF-8
değil). Tahmin et:

```predict
code: |
  use std::env;

  fn main() {
      let sonuc = env::var("RUSTEACH_YOK_BOYLE_BIR_DEGISKEN");
      println!("{sonuc:?}");
      println!("{}", sonuc.is_ok());
      match sonuc {
          Ok(deger) => println!("değer: {deger}"),
          Err(e) => println!("hata: {e}"),
      }
  }
options:
  - |
    Ok("")
    true
    değer:
  - |
    Err(NotPresent)
    false
    hata: environment variable not found
  - |
    None
    false
    hata: None
answer: 1
explanation: |
  Tanımsız bir değişken boş metin değil, **hatadır**: `Err(VarError::NotPresent)`. `Debug` biçimi
  `Err(NotPresent)`, `Display` biçimi ise `environment variable not found` yazar. Dönüş tipi `Option`
  değil `Result`'tır, çünkü "neden yok?" sorusunun iki cevabı olabilir (tanımsız ya da Unicode değil).
  C'deki `getenv` ise sadece `NULL` döndürür ve bu ayrımı yapmaz.
```

Resmî kitabın yaptığı gibi en basit yorumla başlayalım: değişken **tanımlıysa** (değeri ne olursa olsun)
duyarsız arama yap. `Config`'e yeni bir alan ekliyoruz ve `run`, bir `if` ifadesiyle (Modül 3) hangi arama
fonksiyonunu kullanacağını seçiyor:

```rust,norun,title=src/lib.rs (ilk sürüm)
use std::env;
use std::error::Error;
use std::fs;
# pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#     let mut sonuclar = Vec::new();
#     for satir in icerik.lines() {
#         if satir.contains(sorgu) {
#             sonuclar.push(satir);
#         }
#     }
#     sonuclar
# }
# pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#     let sorgu = sorgu.to_lowercase();
#     let mut sonuclar = Vec::new();
#     for satir in icerik.lines() {
#         if satir.to_lowercase().contains(&sorgu) {
#             sonuclar.push(satir);
#         }
#     }
#     sonuclar
# }

pub struct Config {
    pub sorgu: String,
    pub dosya_yolu: String,
    pub buyuk_kucuk_duyarsiz: bool,
}

impl Config {
    pub fn build(args: &[String]) -> Result<Config, &'static str> {
        if args.len() < 3 {
            return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
        }
        let sorgu = args[1].clone();
        let dosya_yolu = args[2].clone();
        let buyuk_kucuk_duyarsiz = env::var("IGNORE_CASE").is_ok();

        Ok(Config { sorgu, dosya_yolu, buyuk_kucuk_duyarsiz })
    }
}

pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let icerik = fs::read_to_string(config.dosya_yolu)?;

    let sonuclar = if config.buyuk_kucuk_duyarsiz {
        ara_buyuk_kucuk_duyarsiz(&config.sorgu, &icerik)
    } else {
        ara(&config.sorgu, &icerik)
    };

    for satir in sonuclar {
        println!("{satir}");
    }
    Ok(())
}
```

`if`'in iki kolu da `Vec<&str>` döndürdüğü için `if` ifadesinin tamamı bir değer olarak `sonuclar`'a
atanabiliyor. `fs::read_to_string(config.dosya_yolu)` satırı `config`'ten yalnızca `dosya_yolu` alanını
taşır (kısmi taşıma, partial move); `sorgu` ve `buyuk_kucuk_duyarsiz` alanlarını kullanmaya devam
edebiliriz.

```console
$ cargo run -- rust siir.txt
rust gibi paslanmaz bilgi bırakır.
$ IGNORE_CASE=1 cargo run -- rust siir.txt
Rust öğrenmek bir yolculuktur,
rust gibi paslanmaz bilgi bırakır.
```

```fill
prompt: |
  `run`'daki seçimin küçük bir benzeri: bayrağa göre sorgunun hangi biçimde aranacağını bir `if`
  **ifadesiyle** seç.
code: |
  fn main() {
      let sorgu = "RuSt";
      let buyuk_kucuk_duyarsiz = true;

      let aranacak = ___0 buyuk_kucuk_duyarsiz {
          sorgu.to_lowercase()
      } else {
          sorgu.to_string()
      }___1

      println!("{aranacak}");
  }
blanks:
  - ["if"]
  - [";"]
output: rust
explanation: |
  Rust'ta `if` bir **ifadedir** (Modül 3): değer üretir ve `let`'e atanabilir. Atama bir `let` deyimi
  olduğu için kapanan süslü parantezden sonra `;` gerekir. İki kol da aynı tipte (`String`) değer
  döndürmek zorunda; birinde `to_lowercase()`, diğerinde `to_string()` kullanmamızın nedeni bu. `run`'daki
  `if` de aynı şekilde iki koldan da `Vec<&str>` döndürür.
```

## is_ok tuzağı: IGNORE_CASE=0

`env::var("IGNORE_CASE").is_ok()` yalnızca değişkenin **tanımlı** olup olmadığına bakar, değerine değil.

```quiz
question: |
  Bir kullanıcı duyarsız aramayı **kapatmak** için `IGNORE_CASE=0 cargo run -- rust siir.txt` yazdı.
  `is_ok()` kullanan sürüm nasıl davranır?
options:
  - Duyarlı arama yapar, çünkü değer `0`
  - Duyarsız arama yapar, çünkü değişken tanımlı
  - "Program `VarError` ile çöker"
answer: 1
explanation: |
  `env::var` `Ok("0")` döndürür, `is_ok()` da `true` verir. Kullanıcı "kapat" demek isterken açmış olur!
  Bu, gerçek araçlarda sık görülen bir şaşkınlık kaynağıdır. Bazı araçlar bu davranışı bilerek seçer ve
  belgeler ("tanımlıysa açık"); daha kullanıcı dostu olanlar ise `0`, `false` gibi değerleri "kapalı" sayar.
feedback:
  - "`is_ok()` değere hiç bakmaz; yalnızca değişkenin varlığını sorar."
  - Doğru!
  - "`env::var` panik yapmaz; tanımlı değişkenler için `Ok` döner."
```

Değeri yorumlayan küçük, **saf** bir fonksiyon yazalım. Ortama dokunmasın; bir `Option<&str>` alsın:
`None` "değişken yok", `Some(deger)` "şu değerle tanımlı" demek. `Result`'tan `Option`'a geçmek için
`Result::ok()` metodunu kullanırız (`Ok(x)` → `Some(x)`, `Err(_)` → `None`; hata bilgisi bilerek atılır):

```rust
use std::env;

fn main() {
    let tanimsiz: Option<String> = env::var("RUSTEACH_YOK_BOYLE_BIR_DEGISKEN").ok();
    println!("{tanimsiz:?}");

    let sayi: Option<i32> = "42".parse().ok();
    let yazi: Option<i32> = "kırk".parse().ok();
    println!("{sayi:?} {yazi:?}");
}
```

`env::var(...).ok()` bir
`Option<String>` verir; onu fonksiyonumuzun istediği `Option<&str>`'ye çeviren metot da **`as_deref()`**'tir:

```rust
fn main() {
    let ortam: Option<String> = Some(String::from("0")); // env::var("IGNORE_CASE").ok() gibi
    let gorunum: Option<&str> = ortam.as_deref(); // içerideki String'i ödünç alır
    println!("{gorunum:?}");

    let yok: Option<String> = None;
    println!("{:?}", yok.as_deref());
}
```

`as_deref` hiçbir şey kopyalamaz ve `ortam`'ı tüketmez: yeni bir `Option` üretir, ama içindeki `&str`
hâlâ `ortam`'ın heap'teki metnini gösterir. Bu yüzden `gorunum`, `ortam`'dan uzun yaşayamaz (Modül 5 ve 12).

```memory
title: ortam.as_deref() sonrası
steps:
  - caption: "`ortam` bir `Option<String>`: `Some` içindeki `String` heap'teki `\"0\"` metninin sahibi."
    stack:
      - frame: main
        vars:
          - { name: ortam, type: "Option<String>", value: "Some(ptr · len=1 · cap=1)", to: h1 }
    heap:
      - { id: h1, value: "0", label: "ortam değişkeninin değeri" }
  - caption: "`as_deref()` yeni bir `Option<&str>` üretir; içindeki dilim aynı heap metnini **ödünç** gösterir. Kopya yok, sahiplik hâlâ `ortam`'da."
    stack:
      - frame: main
        vars:
          - { name: ortam, type: "Option<String>", value: "Some(ptr · len=1 · cap=1)", to: h1 }
          - { name: gorunum, type: "Option<&str>", value: "Some(ptr · len=1)", to: h1, note: ödünç }
    heap:
      - { id: h1, value: "0", label: "ortam değişkeninin değeri" }
```

```exercise
id: m15-e-ortam-bayragi
title: Ortam değişkenini akıllıca yorumla
difficulty: 2
prompt: |
  `ortam_bayragi(deger: Option<&str>) -> bool` fonksiyonunu yaz:

  - `None` (değişken tanımsız) → `false`
  - Değer; baştaki/sondaki boşluklar atılıp küçük harfe çevrildikten sonra şunlardan biriyse → `false`:
    `""`, `"0"`, `"false"`, `"no"`, `"off"`, `"hayir"`, `"hayır"`
  - Başka her değer (`"1"`, `"true"`, `"evet"`, `"açık"`...) → `true`
starter: |
  pub fn ortam_bayragi(deger: Option<&str>) -> bool {
      todo!()
  }
solution: |
  pub fn ortam_bayragi(deger: Option<&str>) -> bool {
      let Some(deger) = deger else {
          return false;
      };
      let deger = deger.trim().to_lowercase();
      !matches!(
          deger.as_str(),
          "" | "0" | "false" | "no" | "off" | "hayir" | "hayır"
      )
  }
check: tests
tests: |
  #[test]
  fn tanimsiz_degisken_kapali() {
      assert!(!ortam_bayragi(None), "değişken yoksa bayrak kapalı olmalı");
  }

  #[test]
  fn olumlu_degerler_acik() {
      for d in ["1", "true", "evet", "yes", "açık"] {
          assert!(ortam_bayragi(Some(d)), "{d:?} değeri bayrağı açmalı");
      }
  }

  #[test]
  fn olumsuz_degerler_kapali() {
      for d in ["0", "false", "no", "off", "hayir", "hayır", ""] {
          assert!(!ortam_bayragi(Some(d)), "{d:?} değeri bayrağı kapatmalı");
      }
  }

  #[test]
  fn buyuk_harf_ve_bosluklar_onemsiz() {
      assert!(!ortam_bayragi(Some("  FALSE ")), "trim + küçük harf uygulanmalı");
      assert!(!ortam_bayragi(Some("Off")), "\"Off\" de kapalı sayılmalı");
      assert!(ortam_bayragi(Some(" TRUE")), "\" TRUE\" açık sayılmalı");
  }
hints:
  - "Önce `None` durumunu ele al: `match`, `if let` ya da `let ... else` (Modül 7) kullanabilirsin."
  - "`let deger = deger.trim().to_lowercase();` ile değeri normalleştir; sonra `deger.as_str()` üzerinde eşleştir."
  - "`match deger.as_str() { \"\" | \"0\" | \"false\" | ... => false, _ => true }` ya da `!matches!(deger.as_str(), \"\" | \"0\" | ...)`."
explanation: |
  Çözümde üç tanıdık araç birleşiyor: `let ... else` ile `None`'dan erken dönüş (Modül 7), `trim` +
  `to_lowercase` ile normalleştirme (Modül 9) ve çoklu desenli `matches!` makrosu (Modül 7; `|` ile birden çok
  desen). `to_lowercase()` bir `String` döndürdüğü için desenlerle karşılaştırmadan önce `as_str()` ile
  `&str`'ye çeviriyoruz; metin değişmezleri `&str` desenleridir.

  Neden `Option<&str>` aldık da doğrudan `env::var`'ı çağırmadık? Çünkü bu sayede fonksiyon **saf**:
  testler ortamı değiştirmeden her durumu deneyebiliyor. `main`'deki çağrı şöyle olacak:
  `ortam_bayragi(env::var("IGNORE_CASE").ok().as_deref())`.
```

## Test edilebilirlik: ortamı dışarıdan vermek

`Config::build` şu an `env::var`'ı **kendisi** çağırıyor. Bu, onu dış dünyaya bağımlı yapar: aynı
argümanlarla iki kez çağırdığında, ortama göre farklı sonuç verebilir. Peki `build`'in duyarsız modu doğru
ayarladığını test etmek istesek? Akla gelen ilk fikir testin içinde değişkeni ayarlamak:

```compiles
code: |
  fn main() {
      std::env::set_var("IGNORE_CASE", "1");
      println!("{:?}", std::env::var("IGNORE_CASE"));
  }
answer: false
error: E0133
explanation: |
  Edition 2024'ten itibaren `env::set_var` (ve `remove_var`) bir **`unsafe` fonksiyondur**; yalnızca
  `unsafe { ... }` bloğu içinde çağrılabilir. Rust bunu keyfi olarak yapmadı; aşağıda nedenini görüyoruz.
```

:::error
```text
error[E0133]: call to unsafe function `set_var` is unsafe and requires unsafe block
 --> src/main.rs:2:5
  |
2 |     std::env::set_var("IGNORE_CASE", "1");
  |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ call to unsafe function
  |
  = note: consult the function's documentation for information on how to avoid undefined behavior
```
Ortam **sürecin tamamında tek ve ortaktır** (global durum). Pek çok işletim sisteminde (ve C kütüphanesinin
`getenv`/`setenv` fonksiyonlarında) bir thread ortamı değiştirirken başka bir thread onu okursa sonuç
**tanımsız davranıştır (undefined behavior)**. Ve `cargo test` testleri varsayılan olarak **paralel
thread'lerde** çalıştırır! Derleyici bu tehlikeyi kanıtlayamadığı için sorumluluğu `unsafe` ile sana bırakır.
`unsafe`'in ne olduğunu Modül 24'te göreceğiz; buradaki ders şu: **testlerde ortamı değiştirme.**
:::

Daha iyi çözüm bir tasarım değişikliği: ortamı **okuma** işini programın kenarına, `main`'e al ve sonucu
`Config::build`'e bir **parametre** olarak ver. Bu tekniğe **bağımlılık enjeksiyonu (dependency injection)**
denir: fonksiyon ihtiyacı olan şeyi kendisi gidip almaz, ona verilir. Artık `build` yine saf:

```rust
pub struct Config {
    pub sorgu: String,
    pub dosya_yolu: String,
    pub buyuk_kucuk_duyarsiz: bool,
}

impl Config {
    pub fn build(args: &[String], buyuk_kucuk_duyarsiz: bool) -> Result<Config, &'static str> {
        if args.len() < 3 {
            return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
        }
        Ok(Config {
            sorgu: args[1].clone(),
            dosya_yolu: args[2].clone(),
            buyuk_kucuk_duyarsiz,
        })
    }
}

fn main() {
    let args = vec![String::from("ara"), String::from("rust"), String::from("siir.txt")];
    // Testlerde ortamla uğraşmadan iki durumu da deneyebiliriz:
    for duyarsiz in [false, true] {
        let c = Config::build(&args, duyarsiz).unwrap();
        println!("{} {} duyarsız={}", c.sorgu, c.dosya_yolu, c.buyuk_kucuk_duyarsiz);
    }
}
```

`main.rs` ise ortamı okuyan tek yer oluyor (`ortam_bayragi`'nı alıştırmadaki gibi `lib.rs`'e eklediğini
varsayıyoruz):

```rust,norun,title=src/main.rs
use std::env;
use std::process;

use ara::{ortam_bayragi, Config};
# mod ara {
#     pub struct Config {
#         pub sorgu: String,
#         pub dosya_yolu: String,
#         pub buyuk_kucuk_duyarsiz: bool,
#     }
#     impl Config {
#         pub fn build(args: &[String], buyuk_kucuk_duyarsiz: bool) -> Result<Config, &'static str> {
#             if args.len() < 3 {
#                 return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
#             }
#             Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone(), buyuk_kucuk_duyarsiz })
#         }
#     }
#     pub fn ortam_bayragi(deger: Option<&str>) -> bool {
#         let Some(deger) = deger else {
#             return false;
#         };
#         let deger = deger.trim().to_lowercase();
#         !matches!(deger.as_str(), "" | "0" | "false" | "no" | "off" | "hayir" | "hayır")
#     }
#     pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#         let mut sonuclar = Vec::new();
#         for satir in icerik.lines() {
#             if satir.contains(sorgu) {
#                 sonuclar.push(satir);
#             }
#         }
#         sonuclar
#     }
#     pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#         let sorgu = sorgu.to_lowercase();
#         let mut sonuclar = Vec::new();
#         for satir in icerik.lines() {
#             if satir.to_lowercase().contains(&sorgu) {
#                 sonuclar.push(satir);
#             }
#         }
#         sonuclar
#     }
#     pub fn run(config: Config) -> Result<(), Box<dyn std::error::Error>> {
#         let icerik = std::fs::read_to_string(config.dosya_yolu)?;
#         let sonuclar = if config.buyuk_kucuk_duyarsiz {
#             ara_buyuk_kucuk_duyarsiz(&config.sorgu, &icerik)
#         } else {
#             ara(&config.sorgu, &icerik)
#         };
#         for satir in sonuclar {
#             println!("{satir}");
#         }
#         Ok(())
#     }
# }

fn main() {
    let args: Vec<String> = env::args().collect();
    let buyuk_kucuk_duyarsiz = ortam_bayragi(env::var("IGNORE_CASE").ok().as_deref());

    let config = Config::build(&args, buyuk_kucuk_duyarsiz).unwrap_or_else(|hata| {
        println!("Argümanlar ayrıştırılamadı: {hata}");
        process::exit(1);
    });

    if let Err(e) = ara::run(config) {
        println!("Uygulama hatası: {e}");
        process::exit(1);
    }
}
```

:::info Resmî kitaptan bilinçli bir sapma
*The Rust Programming Language* kitabı `env::var`'ı `Config::build`'in içinde çağırır; öğretmesi daha
kısadır. Biz bir adım ileri gittik, çünkü gerçek projelerde "dış dünyaya dokunan kodu kenarda topla,
mantığı saf tut" ilkesi testleri kolaylaştıran en güçlü alışkanlıklardan biridir. Aynı ilkeyi zaten
uyguluyorduk: `env::args()`'ı da `main` okuyor, `build` yalnızca bir dilim alıyor.
:::

## stdout ve stderr: iki ayrı kanal

Her sürecin metin yazabileceği **iki** çıkış kanalı vardır:

- **Standart çıktı (stdout)**: programın asıl ürünü, yani **veri**. `println!` buraya yazar.
- **Standart hata (stderr)**: hata ve tanı mesajları, ilerleme bilgisi. `eprintln!` buraya yazar
  (Modül 1'de tanışmıştın). Panik mesajları da buraya gider.

Terminalde ikisi de ekranda görünür, aradaki farkı fark etmezsin. Fark, çıktıyı **yönlendirdiğinde**
(redirect) ortaya çıkar. Programın şu anki hâlini argümansız çalıştırıp çıktıyı bir dosyaya yönlendir:

```console
$ cargo run > cikti.txt
$
```

Ekranda hiçbir şey yok! Peki `cikti.txt`'de ne var?

```text
Argümanlar ayrıştırılamadı: eksik argüman (kullanım: ara <sorgu> <dosya>)
```

`>` yalnızca stdout'u dosyaya yönlendirir. Hata mesajını `println!` ile yazdığımız için o da dosyaya gitti:
kullanıcı hiçbir şey görmedi ve dosyası bir hata mesajıyla kirlendi. Bu dosyayı başka bir programa veri
olarak verseydin, o program hata mesajını bir arama sonucu sanacaktı. Önce stdout'un ne içerdiğini tahmin et:

```predict
question: Bu programın **standart çıktısı (stdout)** ne olur?
code: |
  fn main() {
      eprintln!("3 dosya taranıyor...");
      println!("siir.txt: rust gibi paslanmaz bilgi bırakır.");
      eprintln!("uyarı: notlar.md okunamadı");
      println!("ders.txt: Rust ile ilk gün");
  }
options:
  - |
    3 dosya taranıyor...
    siir.txt: rust gibi paslanmaz bilgi bırakır.
    uyarı: notlar.md okunamadı
    ders.txt: Rust ile ilk gün
  - |
    siir.txt: rust gibi paslanmaz bilgi bırakır.
    ders.txt: Rust ile ilk gün
  - |
    3 dosya taranıyor...
    uyarı: notlar.md okunamadı
answer: 1
explanation: |
  `eprintln!` satırları stderr'e gider; stdout'ta yalnızca `println!` ile yazılan **veri** satırları kalır.
  Terminalde dördü de görünür, ama `> sonuc.txt` ile yönlendirdiğinde dosyada sadece bu iki satır olur.
  Uyarılar ise ekranda kalır, tam istediğimiz gibi.
```

Düzeltme tek kelime: `main`'deki iki `println!`'i `eprintln!` yap.

```rust,norun,title=src/main.rs (son hâli)
use std::env;
use std::process;

use ara::{ortam_bayragi, Config};
# mod ara {
#     pub struct Config {
#         pub sorgu: String,
#         pub dosya_yolu: String,
#         pub buyuk_kucuk_duyarsiz: bool,
#     }
#     impl Config {
#         pub fn build(args: &[String], buyuk_kucuk_duyarsiz: bool) -> Result<Config, &'static str> {
#             if args.len() < 3 {
#                 return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
#             }
#             Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone(), buyuk_kucuk_duyarsiz })
#         }
#     }
#     pub fn ortam_bayragi(deger: Option<&str>) -> bool {
#         let Some(deger) = deger else {
#             return false;
#         };
#         let deger = deger.trim().to_lowercase();
#         !matches!(deger.as_str(), "" | "0" | "false" | "no" | "off" | "hayir" | "hayır")
#     }
#     pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#         let mut sonuclar = Vec::new();
#         for satir in icerik.lines() {
#             if satir.contains(sorgu) {
#                 sonuclar.push(satir);
#             }
#         }
#         sonuclar
#     }
#     pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#         let sorgu = sorgu.to_lowercase();
#         let mut sonuclar = Vec::new();
#         for satir in icerik.lines() {
#             if satir.to_lowercase().contains(&sorgu) {
#                 sonuclar.push(satir);
#             }
#         }
#         sonuclar
#     }
#     pub fn run(config: Config) -> Result<(), Box<dyn std::error::Error>> {
#         let icerik = std::fs::read_to_string(config.dosya_yolu)?;
#         let sonuclar = if config.buyuk_kucuk_duyarsiz {
#             ara_buyuk_kucuk_duyarsiz(&config.sorgu, &icerik)
#         } else {
#             ara(&config.sorgu, &icerik)
#         };
#         for satir in sonuclar {
#             println!("{satir}");
#         }
#         Ok(())
#     }
# }

fn main() {
    let args: Vec<String> = env::args().collect();
    let buyuk_kucuk_duyarsiz = ortam_bayragi(env::var("IGNORE_CASE").ok().as_deref());

    let config = Config::build(&args, buyuk_kucuk_duyarsiz).unwrap_or_else(|hata| {
        eprintln!("Argümanlar ayrıştırılamadı: {hata}");
        process::exit(1);
    });

    if let Err(e) = ara::run(config) {
        eprintln!("Uygulama hatası: {e}");
        process::exit(1);
    }
}
```

Diğer dillerde aynı ayrım: C'de `fprintf(stderr, ...)`, Python'da `print(..., file=sys.stderr)`, Java'da
`System.err.println`, JavaScript'te `console.error`. Kural evrenseldir: **veri stdout'a, insanlara yönelik
mesajlar stderr'e.**

```quiz
question: |
  Düzeltmeden sonra `cargo run -- rust olmayan.txt > cikti.txt` çalıştırılıyor (`olmayan.txt` diye bir
  dosya yok). Ne olur?
options:
  - Hata mesajı `cikti.txt`'ye yazılır, ekran boş kalır
  - Hata mesajı ekranda görünür, `cikti.txt` boş bir dosya olarak oluşur, çıkış kodu `1` olur
  - "`cikti.txt` hiç oluşturulmaz ve çıkış kodu `0` olur"
answer: 1
explanation: |
  `Uygulama hatası: ...` artık `eprintln!` ile stderr'e gidiyor; `>` onu yakalamaz, ekranda görünür.
  Kabuk (shell) yönlendirmeyi program başlamadan **önce** kurduğu için `cikti.txt` yine oluşturulur, ama
  stdout'a hiçbir şey yazılmadığından boş kalır. `process::exit(1)` sayesinde betikler de işin başarısız
  olduğunu anlar.
feedback:
  - "Bu düzeltmeden **önceki** davranıştı; `eprintln!` stderr'e yazar."
  - Doğru!
  - "Dosyayı kabuk, program çalışmadan önce açar; çıkış kodu da `process::exit(1)` ile `1`'dir."
```

## Elle test etmek

Birim testler mantığı güvenceye alır; ama programın **bütününü**, gerçek terminalde, gerçek dosyalarla en
az bir kez elle denemek gerekir. Aşağıdaki küçük test planını kendi bilgisayarında uygula:

| Komut (bash) | Ekranda beklenen | `cikti.txt`'de beklenen | Çıkış kodu (`echo $?`) |
|--------------|------------------|-------------------------|------------------------|
| `cargo run -- rust siir.txt` | `rust gibi paslanmaz bilgi bırakır.` | (yönlendirme yok) | 0 |
| `IGNORE_CASE=1 cargo run -- rust siir.txt` | iki satır | (yönlendirme yok) | 0 |
| `IGNORE_CASE=0 cargo run -- rust siir.txt` | tek satır (`ortam_bayragi` sayesinde) | (yönlendirme yok) | 0 |
| `cargo run -- rust siir.txt > cikti.txt` | hiçbir şey | eşleşen satır | 0 |
| `cargo run > cikti.txt` | `Argümanlar ayrıştırılamadı: ...` | boş | 1 |
| `cargo run -- rust yok.txt 2> hatalar.txt` | hiçbir şey | — (`hatalar.txt`'de hata mesajı) | 1 |

`2>` stderr'i yönlendirir (`2`, stderr'in kanal numarasıdır; stdout `1`'dir). İkisini aynı dosyaya
toplamak için `> hepsi.txt 2>&1` yazılır. PowerShell'de çıkış kodunu `$LASTEXITCODE` ile görürsün;
yönlendirme işaretleri aynıdır.

:::tip cargo'nun kendi mesajları
`cargo run` yazınca gördüğün `Compiling...`, `Finished...`, `Running...` satırları da Cargo'nun **stderr**'ine
gider; bu yüzden `cikti.txt`'ye karışmazlar. Cargo da aynı kurala uyuyor!
:::

Şimdi bu ilkeyi bir fonksiyona dökelim. Kullanıcıya kaç eşleşme bulunduğunu söyleyen bir özet satırı
eklemek istiyoruz, ama bu özet **verinin parçası değil**; yönlendirilmiş çıktıya karışmamalı.

```exercise
id: m15-e-rapor
title: Veriyi ve mesajı ayır
difficulty: 3
prompt: |
  `rapor_olustur(sorgu, sonuclar)` fonksiyonunu yaz. Bir `Rapor` döndürsün:

  - `stdout`: yalnızca eşleşen satırlar; her satırın sonunda bir `\n`. Eşleşme yoksa boş metin.
  - `stderr`: bir özet satırı (sonunda `\n` **yok**):
    - eşleşme varsa: `"<n> eşleşme bulundu"` (ör. `2 eşleşme bulundu`)
    - yoksa: `"'<sorgu>' için eşleşme bulunamadı"` (ör. `'python' için eşleşme bulunamadı`)

  (`run` bu raporu `print!("{}", r.stdout)` ve `eprintln!("{}", r.stderr)` ile yazdıracak.)
starter: |
  pub struct Rapor {
      pub stdout: String,
      pub stderr: String,
  }

  pub fn rapor_olustur(sorgu: &str, sonuclar: &[&str]) -> Rapor {
      todo!()
  }
solution: |
  pub struct Rapor {
      pub stdout: String,
      pub stderr: String,
  }

  pub fn rapor_olustur(sorgu: &str, sonuclar: &[&str]) -> Rapor {
      let mut stdout = String::new();
      for satir in sonuclar {
          stdout.push_str(satir);
          stdout.push('\n');
      }

      let stderr = if sonuclar.is_empty() {
          format!("'{sorgu}' için eşleşme bulunamadı")
      } else {
          format!("{} eşleşme bulundu", sonuclar.len())
      };

      Rapor { stdout, stderr }
  }
check: tests
tests: |
  #[test]
  fn eslesmeler_stdouta_ozet_stderre() {
      let r = rapor_olustur("rust", &["Rust öğrenmek", "rust gibi paslanmaz"]);
      assert_eq!(r.stdout, "Rust öğrenmek\nrust gibi paslanmaz\n", "stdout yalnızca satırları içermeli, her biri \\n ile bitmeli");
      assert_eq!(r.stderr, "2 eşleşme bulundu");
  }

  #[test]
  fn ozet_veriye_karismaz() {
      let r = rapor_olustur("çay", &["çay 10 TL"]);
      assert!(!r.stdout.contains("eşleşme"), "özet satırı stdout'a karışmamalı");
      assert_eq!(r.stderr, "1 eşleşme bulundu");
  }

  #[test]
  fn eslesme_yoksa_stdout_bos() {
      let r = rapor_olustur("python", &[]);
      assert_eq!(r.stdout, "", "eşleşme yoksa stdout boş olmalı");
      assert_eq!(r.stderr, "'python' için eşleşme bulunamadı");
  }

  #[test]
  fn sayi_sonuca_gore_degisir() {
      let r = rapor_olustur("a", &["a", "ab", "abc", "abcd"]);
      assert_eq!(r.stderr, "4 eşleşme bulundu");
      assert_eq!(r.stdout.lines().count(), 4);
  }
hints:
  - "`stdout` için boş bir `String` ile başla ve döngüde her satırı `push_str` ile, ardından `push('\\n')` ile ekle."
  - "`stderr` için `if sonuclar.is_empty() { ... } else { ... }` ifadesi ve `format!` kullan."
  - "`format!(\"'{sorgu}' için eşleşme bulunamadı\")` ve `format!(\"{} eşleşme bulundu\", sonuclar.len())`; sonunda `Rapor { stdout, stderr }`."
explanation: |
  Fonksiyon hiçbir şey **yazdırmıyor**; yalnızca hangi metnin hangi kanala gideceğine karar veriyor. Bu
  yüzden test edilebilir. Yazdırma (`print!` / `eprintln!`) programın kenarında kalıyor. Bu, derste iki kez
  uyguladığımız ilkenin üçüncü örneği: **karar ver ve test et** kısmı saf, **dış dünyaya dokun** kısmı ince.

  Dönüş tipi olarak `(String, String)` yerine adlandırılmış alanları olan bir `Rapor` struct'ı seçmemiz de
  birinci dersteki `Config` kararıyla aynı gerekçeye dayanıyor: `r.stdout` ve `r.stderr`, `r.0` ve `r.1`'den
  çok daha zor karıştırılır.

  Alternatif: `stdout`'u `sonuclar.join("\n")` ile oluşturup sona `\n` eklemek de olurdu; ama eşleşme yokken
  tek bir `"\n"` üretmemeye dikkat etmen gerekirdi. Döngü sürümü bu kenar durumu kendiliğinden doğru yapar.
```

## Özet

:::remember
- Ortam değişkenleri `ANAHTAR=değer` çiftleridir; çocuk süreç ebeveynin ortamının kopyasını alır.
- `env::var("X")` → `Result<String, VarError>`; tanımsızsa `Err(NotPresent)`.
- `is_ok()` yalnızca varlığa bakar: `IGNORE_CASE=0` da "açık" sayılır. Değeri yorumlamak için saf bir fonksiyon yaz.
- `env::set_var` edition 2024'te `unsafe`'tir (global durum, thread'ler); testlerde ortamı değiştirme, değeri parametre olarak ver.
- Veri **stdout**'a (`println!`), hata ve tanı mesajları **stderr**'e (`eprintln!`).
- `>` stdout'u, `2>` stderr'i yönlendirir; `2>&1` ikisini birleştirir. Başarı `0`, hata `0` dışı çıkış kodu.
:::

```reflect
prompt: |
  Bu derste aynı ilkeyi üç kez uyguladık: `Config::build`'e ortam değerini parametre olarak verdik,
  `ortam_bayragi`'na `Option<&str>` verdik, `rapor_olustur`'a yazdırma işini yaptırmadık. Bu ilkeyi kendi
  cümlelerinle ifade et ve neden bu kadar faydalı olduğunu açıkla.
answer: |
  İlke: dış dünyaya dokunan kodu (ortamı okumak, argümanları toplamak, dosya okumak, ekrana yazmak)
  programın kenarında, ince bir katmanda topla; karar veren mantığı ise girdisini parametre olarak alan
  ve sonucunu değer olarak döndüren saf fonksiyonlarda tut.
  Faydası: saf fonksiyonlar her durumu taklit verilerle, paralel ve güvenli şekilde test edilebilir (ortamı
  değiştirmek gibi `unsafe` hilelere gerek kalmaz). Aynı girdiye hep aynı çıktıyı verdikleri için akıl
  yürütmesi kolaydır ve başka bağlamlarda (GUI, web servisi) yeniden kullanılabilirler. Kenar katmanı o kadar
  küçük kalır ki okuyarak doğrulanabilir.
```

```flashcards
- front: "`env::var(\"IGNORE_CASE\")`'in dönüş tipi nedir ve değişken tanımsızsa ne döner?"
  back: "`Result<String, VarError>`; tanımsızsa `Err(VarError::NotPresent)`."
- front: "`IGNORE_CASE=0` ayarlıyken `env::var(\"IGNORE_CASE\").is_ok()` ne verir?"
  back: "`true` — `is_ok()` yalnızca değişkenin tanımlı olup olmadığına bakar, değerine değil."
- front: "`Option<String>`'i `Option<&str>`'ye hangi metot çevirir?"
  back: "`as_deref()` — içerideki `String`'i `&str` olarak ödünç alır."
- front: "Edition 2024'te `env::set_var` neden `unsafe`'tir?"
  back: Ortam sürecin global durumudur; bir thread onu değiştirirken başka bir thread okursa tanımsız davranış oluşabilir (testler de paralel thread'lerde çalışır).
- front: Bağımlılık enjeksiyonu (dependency injection) bu projede ne anlama geldi?
  back: "`Config::build`'in ortamı kendisi okuması yerine, `main`'in okuyup sonucu (`bool`) parametre olarak vermesi."
- front: Hangi mesajlar stdout'a, hangileri stderr'e yazılmalıdır?
  back: Programın ürettiği veri stdout'a (`println!`); hata, uyarı, ilerleme gibi insanlara yönelik mesajlar stderr'e (`eprintln!`).
- front: "`cargo run > cikti.txt` ve `cargo run 2> hatalar.txt` arasındaki fark nedir?"
  back: "`>` stdout'u (kanal 1) dosyaya yönlendirir; `2>` stderr'i (kanal 2) yönlendirir."
- front: "Kabukta `> hepsi.txt 2>&1` ne yapar?"
  back: "stdout'u `hepsi.txt`'ye yönlendirir, stderr'i (2) de stdout'un (1) gittiği yere, yani aynı dosyaya gönderir."
```
