---
id: m15-l02
title: Dosya okuma ve yeniden yapılandırma
minutes: 35
type: project
objectives:
  - "`std::fs::read_to_string` ile bir dosyanın içeriğini okuyup dönen `io::Result`'ı ele alabilmek"
  - "Programı ince bir `main.rs` ve mantığı taşıyan bir `lib.rs` olarak bölmenin gerekçesini açıklayabilmek"
  - "`Config::build`'i `Result<Config, &'static str>` döndürecek, `run`'ı `Result<(), Box<dyn Error>>` döndürecek şekilde yazabilmek"
  - "`main`'de hataları `unwrap_or_else`, `if let Err` ve `process::exit(1)` ile kullanıcı dostu biçimde sonlandırabilmek"
keywords: [fs::read_to_string, io::Result, lib.rs, main.rs, sorumlulukların ayrılması, Config::build, Box<dyn Error>, process::exit, unwrap_or_else, çıkış kodu]
---

Önceki derste `ara` argümanları okuyup bir `Config`'te toplamayı öğrendi. Ama henüz hiçbir şey **aramıyor**;
çünkü elinde aranacak bir metin yok. Bu derste dosyayı okuyacağız. Ardından, büyümeye başlayan programı
profesyonel Rust projelerinin kullandığı düzene sokacağız: **ince bir `main.rs`, test edilebilir bir
`lib.rs`** ve kullanıcıyı korkutmayan hata mesajları.

Bu dersin büyük kısmı **yeniden yapılandırma (refactoring)**: programın davranışını bozmadan yapısını
iyileştirmek. Gerçek hayatta kod yazmanın yarısı budur.

## Dosyayı okumak: fs::read_to_string

Önce aranacak bir metin lazım. Projenin **kök klasörüne** (`Cargo.toml`'un yanına, `src/`'nin içine değil)
`siir.txt` adında bir dosya oluştur:

```text
Rust öğrenmek bir yolculuktur,
her hata yeni bir ders verir.
Derleyici sabırlı bir öğretmendir;
rust gibi paslanmaz bilgi bırakır.
```

Şimdi `main.rs`'e dosyayı okuyan satırları ekle:

```rust,norun,title=src/main.rs
use std::env;
use std::fs;

fn main() {
    let args: Vec<String> = env::args().collect();
    let sorgu = &args[1];
    let dosya_yolu = &args[2];

    println!("'{sorgu}' aranıyor, dosya: {dosya_yolu}");

    let icerik = fs::read_to_string(dosya_yolu)
        .expect("Dosya okunabilmeliydi");

    println!("Metin:\n{icerik}");
}
```

```console
> cargo run -- rust siir.txt
'rust' aranıyor, dosya: siir.txt
Metin:
Rust öğrenmek bir yolculuktur,
her hata yeni bir ders verir.
Derleyici sabırlı bir öğretmendir;
rust gibi paslanmaz bilgi bırakır.
```

`fs::read_to_string`'in imzası, öğrendiğin birçok şeyi bir arada gösteriyor:

```rust,ignore
pub fn read_to_string<P: AsRef<Path>>(path: P) -> io::Result<String>
```

- **`P: AsRef<Path>`** (Modül 11): `&str`, `String`, `&String`, `PathBuf` gibi "yol olarak görülebilen"
  her şeyi kabul eder. Bu yüzden `dosya_yolu`'nu (`&String`) doğrudan verebildik.
- **`io::Result<String>`**: `Result<String, io::Error>`'ın kısaltmasıdır (bir **tip takma adı**, Modül 22'de
  ayrıntılı). Dosya yoksa, okuma izni yoksa ya da içerik geçerli UTF-8 değilse `Err` döner.
- Tüm dosyayı **tek seferde** belleğe okur. Bir şiir için mükemmel; 10 GB'lık bir log dosyası için değil.
  Büyük dosyaları satır satır okumanın yolları (`BufReader`) ileride karşına çıkacak.

:::warning Göreli yollar nereye göre?
`siir.txt` gibi göreli (relative) bir yol, programın kaynak dosyasına göre değil, **programın çalıştırıldığı
klasöre (current working directory)** göre çözülür. `cargo run`'ı projenin kök klasöründe çalıştırdığında bu
klasör proje köküdür. Dosyayı `src/` içine koyarsan ya da başka bir klasörden çalıştırırsan program onu
bulamaz ve `expect` mesajıyla panik yapar.
:::

```quiz
question: |
  `cargo run -- rust siir.txt` komutunu `ara/` klasöründe çalıştırdın ama dosya `ara/src/siir.txt`
  konumunda. Ne olur?
options:
  - Dosya bulunur; Rust göreli yolları `main.rs`'in klasörüne göre çözer
  - "`read_to_string` `Err` döndürür, `expect` de mesajıyla panik yapar"
  - Derleme hatası alırsın, çünkü dosya derleme sırasında aranır
answer: 1
explanation: |
  Göreli yol, çalışma anında **çalışma klasörüne** (`ara/`) göre çözülür: program `ara/siir.txt`'i arar ve
  bulamaz. Derleyicinin bundan haberi yoktur; dosya okuma tamamen çalışma anında olur. `read_to_string`
  `Err(io::Error)` döndürür (`NotFound`), `expect` de bu `Err`'i panik mesajına çevirir.
feedback:
  - "Göreli yollar ne kaynak dosyaya ne de `target/` içindeki çalıştırılabilir dosyaya göre çözülür; yalnızca çalışma klasörü önemlidir."
  - Doğru!
  - "Derleyici dosya sistemine bakmaz; `read_to_string` çalışma anında çalışır."
```

## main çok fazla iş yapıyor

Şu an `main` dört farklı iş yapıyor: argümanları okuyor, onları ayrıştırıyor, dosyayı okuyor ve (birazdan)
arama yapacak. Bu küçük bir programda zararsız görünür ama büyüdükçe üç sorun doğar:

1. **Test edilemezlik.** `main` parametre almaz, değer döndürmez; girdisini `env::args()`'tan ve dosyadan
   kendisi çeker. Bir birim testinden `main()`'i çağırsan bile argümanları ve dosyayı kontrol edemez,
   sonucu da yakalayamazsın. Modül 13'ten hatırla: entegrasyon testleri yalnızca bir **library crate**'in `pub` API'sini
   görebilir; binary crate'in fonksiyonlarına dışarıdan erişilemez.
2. **Karışık sorumluluklar.** Argüman ayrıştırma ile arama mantığı aynı yerde yaşadıkça birini değiştirirken
   diğerini bozmak kolaylaşır.
3. **Dağınık hata yönetimi.** Her satırda farklı bir `expect` var; hangi hatanın kullanıcıya nasıl
   gösterileceği tek bir yerde değil.

Rust topluluğunun binary projeler için yerleşik çözümü, sorumlulukları iki dosyaya bölmektir:

| `src/main.rs` (ince) | `src/lib.rs` (kalın) |
|----------------------|----------------------|
| `env::args()`'ı toplar | `Config` ve `Config::build` |
| `Config::build`'i çağırır | `run`: dosyayı okur, arar, yazdırır |
| Hataları kullanıcıya gösterir, çıkış koduyla bitirir | Arama fonksiyonları ve **testleri** |

`main.rs`'teki kod o kadar küçük olmalı ki **okuyarak** doğruluğundan emin olabilesin. Test edilmesi gereken
her şey `lib.rs`'e gider.

:::analogy Restoranın garsonu ve mutfağı
`main.rs` bir restoranın **garsonudur**: siparişi (argümanları) alır, mutfağa iletir, tabağı (sonucu) ya da
özrü (hata mesajını) müşteriye götürür. Yemek yapmaz. `lib.rs` ise **mutfaktır**: asıl iş orada yapılır ve
müfettiş (testler) mutfağı denetler, garsonu değil. Garson işini iyi yapmak için yemeğin tarifini bilmek
zorunda değildir.
:::

```quiz
question: Aşağıdakilerden hangileri bu desende **`main.rs`'te** kalmalıdır? (Birden fazla seçenek doğru.)
options:
  - "`env::args().collect()` ile argümanları toplamak"
  - "Bir satırın sorguyu içerip içermediğine karar veren arama fonksiyonu"
  - "Bir hata olduğunda mesajı yazdırıp `process::exit(1)` çağırmak"
  - "`Config::build`'in argüman sayısını doğrulayan mantığı"
answer: [0, 2]
explanation: |
  `main.rs` dış dünyayla temas eden ince katmandır: argümanları **toplar**, kütüphaneyi çağırır ve hatayı
  kullanıcıya **gösterip** programı bitirir. Karar veren her mantık (argüman doğrulama, arama) `lib.rs`'e
  gider, çünkü orada test edilebilir. Bu ayrım ayrıca kütüphaneyi başka programların (ör. bir GUI'nin)
  kullanmasına da imkân tanır.
feedback:
  - Doğru; işletim sisteminden veri toplamak garsonun işi.
  - "Arama mantığı test edilmesi gereken asıl iştir; `lib.rs`'e gider."
  - Doğru; hatayı kullanıcıya göstermek ve çıkış kodunu seçmek uygulamanın kenarına aittir.
  - "Doğrulama bir karardır; testlerle güvenceye alınmalı, bu yüzden `lib.rs`'te yaşar."
```

## Panik yerine Result: Config::build ve process::exit

Önceki derste eksik argümanda panik yapan bir `Config::new` yazdık. Kullanıcı ise şunu görüyordu:

```text
thread 'main' (13) panicked at src/main.rs:27:13:
en az iki argüman gerekli: ara <sorgu> <dosya>
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

Dosya adı, satır numarası, "backtrace"... Bunlar **programcıya** yönelik bilgiler. Modül 10'daki ilkeyi
uygulayalım: eksik argüman beklenen bir durumdur, öyleyse `Result` döndürmeliyiz. İsmi de değiştiriyoruz:
Rust'ta `new` adlı kurucuların **başarısız olmaması** beklenir; başarısız olabilen kurucular için yaygın
isim `build`'dir.

```rust
struct Config {
    sorgu: String,
    dosya_yolu: String,
}

impl Config {
    fn build(args: &[String]) -> Result<Config, &'static str> {
        if args.len() < 3 {
            return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
        }
        let sorgu = args[1].clone();
        let dosya_yolu = args[2].clone();
        Ok(Config { sorgu, dosya_yolu })
    }
}

fn main() {
    let tam = vec![String::from("ara"), String::from("rust"), String::from("siir.txt")];
    let eksik = vec![String::from("ara")];

    for args in [tam, eksik] {
        match Config::build(&args) {
            Ok(c) => println!("Tamam: '{}' -> {}", c.sorgu, c.dosya_yolu),
            Err(hata) => println!("Hata: {hata}"),
        }
    }
}
```

Hata tipi neden **`&'static str`**? Hata mesajlarımız kaynak koddaki metin sabitleri (string literal) ve
Modül 12'den biliyorsun: literaller programın ikili dosyasına gömülüdür, program çalıştığı sürece yaşar,
yani yaşam süreleri `'static`'tir. Bu tip ucuzdur (heap ayırması yok) ve basit bir hata mesajı için yeterlidir.
Dinamik bilgi içeren mesajlar gerekseydi (`format!` ile) `String` döndürürdük.

```predict
code: |
  # struct Config {
  #     sorgu: String,
  #     dosya_yolu: String,
  # }
  #
  # impl Config {
  #     fn build(args: &[String]) -> Result<Config, &'static str> {
  #         if args.len() < 3 {
  #             return Err("eksik argüman");
  #         }
  #         Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })
  #     }
  # }
  #
  fn main() {
      let args = vec![String::from("ara"), String::from("gül")];
      let sonuc = Config::build(&args);
      println!("{}", sonuc.is_ok());
      let args = vec![String::from("ara"), String::from("a"), String::from("b"), String::from("c")];
      match Config::build(&args) {
          Ok(c) => println!("{} {}", c.sorgu, c.dosya_yolu),
          Err(e) => println!("{e}"),
      }
  }
options:
  - |
    false
    a b
  - |
    true
    a b
  - |
    false
    eksik argüman
  - |
    false
    b c
answer: 0
explanation: |
  İki elemanlı vektör (`"ara"`, `"gül"`) 3'ten kısa, `build` `Err` döner ve `is_ok()` `false` verir.
  Dört elemanlı vektörde ise kontrol geçilir: `args[0]` program adı olduğu için sorgu `args[1]` = `"a"`,
  dosya yolu `args[2]` = `"b"`'dir; fazladan gelen `"c"` yok sayılır.
```

```quiz
question: |
  Modül 10'u hatırla: aşağıdakilerden hangisi `panic!` için **uygun** bir durumdur?
options:
  - Kullanıcının dosya yolunu yazmayı unutması
  - Kullanıcının var olmayan bir dosya adı vermesi
  - "`Config::build` başarılı olduktan sonra `args[1]`'e erişirken vektörün boş çıkması (yani kodda bir mantık hatası)"
answer: 2
explanation: |
  `panic!` **programcının** hatası içindir: bir varsayım (invariant) bozulmuşsa ve programın devam etmesi
  anlamsızsa. Eksik argüman ya da olmayan dosya kullanıcıdan kaynaklanan, **beklenen** durumlardır; bunlar
  `Result` ile temsil edilip anlaşılır bir mesajla bildirilmelidir. Kontrolü geçtikten sonra vektörün boş
  çıkması ise ancak kodda bir hata varsa mümkündür; işte orada panik doğru tepkidir.
feedback:
  - "Unutkan kullanıcı bir bug değildir; ona yol gösteren bir mesaj vermelisin."
  - "Olmayan dosya tamamen beklenen bir durumdur; `read_to_string` bu yüzden `Result` döndürür."
  - Doğru!
```

### main'de hatayı ele almak: unwrap_or_else ve process::exit

Artık `Config::build` bir `Result` veriyor. `main` iki şey yapmalı: başarılıysa `Config`'i almak, değilse
mesajı göstermek ve programı **başarısızlık koduyla** bitirmek.

Önce `unwrap_or_else`'i tanıdık hâliyle hatırlayalım (Modül 10 ve 14): `Ok` ise içindeki değeri verir,
`Err` ise closure'ı hatayla çağırır ve closure'ın ürettiği **yedek değeri** kullanır. Closure'ın dönüş
tipi bu yüzden `Ok`'un içindeki tiple, yani `Config` ile aynı olmak zorundadır:

```rust
# struct Config {
#     sorgu: String,
#     dosya_yolu: String,
# }
#
# impl Config {
#     fn build(args: &[String]) -> Result<Config, &'static str> {
#         if args.len() < 3 {
#             return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
#         }
#         Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })
#     }
# }
#
fn main() {
    let args = vec![String::from("ara")]; // kullanıcı hiçbir şey yazmamış

    let config = Config::build(&args).unwrap_or_else(|hata| {
        println!("Uyarı: {hata}");
        println!("Varsayılan ayarlar kullanılıyor.");
        Config { sorgu: String::from("rust"), dosya_yolu: String::from("siir.txt") }
    });

    println!("'{}' aranıyor, dosya: {}", config.sorgu, config.dosya_yolu);
}
```

`ara` için yedek bir sorgu uydurmak anlamsız olurdu: kullanıcı ne aradığını söylemediyse yapılacak doğru
şey, durumu açıklayıp programı bitirmektir. Gerçek `main`'imiz bu yüzden şöyle:

```rust,norun,title=src/main.rs
use std::env;
use std::process;
# struct Config {
#     sorgu: String,
#     dosya_yolu: String,
# }
# impl Config {
#     fn build(args: &[String]) -> Result<Config, &'static str> {
#         if args.len() < 3 {
#             return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
#         }
#         Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })
#     }
# }

fn main() {
    let args: Vec<String> = env::args().collect();

    let config = Config::build(&args).unwrap_or_else(|hata| {
        println!("Argümanlar ayrıştırılamadı: {hata}");
        process::exit(1);
    });

    println!("'{}' aranıyor, dosya: {}", config.sorgu, config.dosya_yolu);
}
```

```console
> cargo run -- rust
Argümanlar ayrıştırılamadı: eksik argüman (kullanım: ara <sorgu> <dosya>)
```

Parça parça:

- **`unwrap_or_else(|hata| { ... })`**: yukarıdakiyle aynı; tek fark closure'ın yedek bir `Config`
  üretmek yerine programı bitirmesi.
- **`process::exit(1)`** programı **hemen** bitirir ve işletim sistemine bir **çıkış kodu (exit code)**
  bildirir. Gelenek: `0` başarı, `0` dışı her şey başarısızlık. Betikler ve diğer programlar bu koda bakarak
  işin yolunda gidip gitmediğini anlar (bash'te `echo $?`, PowerShell'de `$LASTEXITCODE`). C'deki `exit(1)`,
  Python'daki `sys.exit(1)` ile aynı fikirdir. Panik eden bir Rust programı da (varsayılan ayarlarla)
  `101` koduyla biter.
- Peki closure bir `Config` döndürmesi gerekirken nasıl derleniyor? `process::exit`'in dönüş tipi
  **`!`**'dir: "asla geri dönmez" tipi (**never type**). `!` her tipe uyabildiği için derleyici closure'ı
  kabul eder. Bu tipi Modül 22'de yakından tanıyacağız.

Mesajı şimdilik `println!` ile yazdırıyoruz; dördüncü derste bunun neden yanlış kanal olduğunu görecek ve
`eprintln!`'e geçeceğiz.

:::warning process::exit yıkıcıları çalıştırmaz
`process::exit` yığını (stack) çözmez; o anda yaşayan değerlerin `drop`'u **çağrılmaz**. Bellek zaten işletim
sistemine geri döner, ama örneğin bir dosyaya yazılmayı bekleyen tamponlanmış (buffered) veri kaybolabilir.
Bu yüzden `exit`'i programın en dış katmanında, `main`'de ve temizlenecek bir şey kalmadığında çağırırız.
Kütüphane kodunda **asla** `process::exit` kullanma; hatayı `Result` olarak yukarı ver, kararı `main`
versin.
:::

:::deep Alternatifler: main'den Result ya da ExitCode döndürmek
**`fn main() -> Result<(), Box<dyn Error>>`** (Modül 10) da çalışır: `main` `Err` döndürürse Rust hatayı
stderr'e `Error: ...` diye yazar ve `1` koduyla çıkar. Ama hatayı **`Debug`** biçimiyle yazar; bir
`io::Error` için bu, `Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }` gibi
programcıya yönelik bir çıktıdır. Kullanıcıya `Display` mesajını göstermek istediğimiz için bu yolu seçmedik.

**`fn main() -> ExitCode`** (`std::process::ExitCode`) ise modern ve temiz bir seçenektir: çıkış kodunu
`main`'den **döndürürsün**. `main` normal yoldan bittiği için yaşayan değerlerin `drop`'u çalışır; yani
`process::exit`'in yukarıdaki sorunu yoktur. Büyük programlarda çoğu zaman tercih edilen yol budur. Bu
modülde Rust kitabındaki klasik yapıyı izlemek için `process::exit` ile devam ediyoruz.

```rust,norun
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        println!("eksik argüman (kullanım: ara <sorgu> <dosya>)");
        return ExitCode::FAILURE; // 1; özel bir kod için ExitCode::from(2)
    }
    ExitCode::SUCCESS
}
```
:::

```quiz
question: "Kütüphane fonksiyonu `Config::build`'in içinde hata olunca doğrudan `process::exit(1)` çağırmak neden kötü bir fikirdir?"
options:
  - "`process::exit` sadece `main` içinde derlenir"
  - Kütüphaneyi kullanan kod hatayı ele alma şansını kaybeder; testler bile o noktada tüm test sürecini sonlandırır
  - "`exit` panikten daha yavaştır"
answer: 1
explanation: |
  `exit` her yerden çağrılabilir; sorun **kararın yanlış yerde** verilmesidir. `Result` döndüren bir
  fonksiyon çağırana seçim bırakır: mesaj gösterip çıkmak, varsayılan değer kullanmak, yeniden denemek...
  `exit` çağıran fonksiyon ise bu seçimi herkesin yerine yapar. Bir test `exit` çağıran bir fonksiyonu
  çalıştırırsa, test çalıştırıcısının kendisi biter; sonuç raporu bile yazılmaz.
feedback:
  - "`process::exit` her fonksiyondan çağrılabilir; derleyici bunu kısıtlamaz."
  - Doğru!
  - "Hız burada konu değil; sorun, hatayla ne yapılacağına kütüphanenin karar vermesi."
```

## run fonksiyonu ve Box<dyn Error>

Sırada dosya okuma var. Onu `main`'den çıkarıp bir `run` fonksiyonuna alalım. `run` de hata
döndürebilmeli; peki hata tipi ne olacak? İlk deneme olarak `String` seçelim:

```compiles
code: |
  use std::fs;

  fn run(dosya_yolu: &str) -> Result<(), String> {
      let icerik = fs::read_to_string(dosya_yolu)?;
      println!("{icerik}");
      Ok(())
  }

  fn main() {
      let _ = run("siir.txt");
  }
answer: false
error: E0277
explanation: |
  `?` operatörü hatayı döndürmeden önce `From` trait'i ile fonksiyonun hata tipine **dönüştürür**
  (Modül 10-11). `read_to_string`'in hatası `io::Error`'dır ve `String`'e otomatik dönüşümü yoktur.
```

:::error
```text
error[E0277]: `?` couldn't convert the error to `String`
 --> src/main.rs:4:48
  |
3 | fn run(dosya_yolu: &str) -> Result<(), String> {
  |                             ------------------ expected `String` because of this
4 |     let icerik = fs::read_to_string(dosya_yolu)?;
  |                  ------------------------------^ the trait `From<std::io::Error>` is not implemented for `String`
  |                  |
  |                  this can't be annotated with `?` because it has type `Result<_, std::io::Error>`
  |
  = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
```
Mesaj hikâyeyi anlatıyor: dönüş tipi `String` hata bekliyor, `?` ise elinde bir `io::Error` tutuyor ve
`From<io::Error> for String` diye bir dönüşüm yok. `.map_err(|e| e.to_string())?` ile düzeltebilirdin, ama
her hata türü için bunu yazmak yorucu olur.
:::

`run` ileride farklı türde hatalarla karşılaşabilir: dosya hataları, sayı ayrıştırma hataları, kendi
hatalarımız... Hepsini kabul eden tip **`Box<dyn Error>`**'dır (Modül 10'da `main`'in dönüş tipi olarak
görmüştün):

- **`dyn Error`**: "`std::error::Error` trait'ini uygulayan **herhangi bir** tip". Derleme anında hangi tip
  olduğu bilinmez; buna **trait nesnesi (trait object)** denir ve Modül 20'nin konusudur.
- **`Box<...>`**: boyutu önceden bilinmeyen bu değeri heap'e koyar ve sabit boyutlu bir işaretçiyle taşır.
- Standart kütüphanede `Error` uygulayan her `E` için `From<E> for Box<dyn Error>` vardır. Yani `?` her
  standart hatayı otomatik olarak kutulayabilir. Hatta `&str` ve `String` de `.into()` ile
  `Box<dyn Error>`'a dönüşür.

```rust
use std::error::Error;

fn yas_oku(metin: &str) -> Result<u8, Box<dyn Error>> {
    let yas: u8 = metin.trim().parse()?; // ParseIntError -> Box<dyn Error>
    if yas == 0 {
        return Err("yaş sıfır olamaz".into()); // &str -> Box<dyn Error>
    }
    Ok(yas)
}

fn main() {
    for girdi in ["42", "kırk", "0", "300"] {
        match yas_oku(girdi) {
            Ok(y) => println!("{girdi}: {y}"),
            Err(e) => println!("{girdi}: hata -> {e}"),
        }
    }
}
```

İki farklı hata türü (ayrıştırma hatası ve kendi mesajımız) aynı dönüş tipinde buluştu. Şimdi `run`:

```rust,norun,title=src/main.rs (parça)
use std::error::Error;
use std::fs;
# struct Config {
#     sorgu: String,
#     dosya_yolu: String,
# }

fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let icerik = fs::read_to_string(config.dosya_yolu)?;
    println!("Metin:\n{icerik}");
    Ok(())
}
# fn main() {
#     let c = Config { sorgu: String::from("rust"), dosya_yolu: String::from("siir.txt") };
#     let _ = c.sorgu.len();
#     let _ = run(c);
# }
```

`Ok(())`, "başarılı oldu ama döndürecek bir değer yok" demenin deyimsel (idiomatic) yoludur; `()` birim
tipidir (Modül 2). `run`, `config`'i **değer olarak** alır, yani sahipliğini üstlenir: `main`'in artık ona
ihtiyacı yok.

```memory
title: run(config) çağrısı
steps:
  - caption: "`main`'de `config` iki `String` alanının sahibi."
    stack:
      - frame: main
        vars:
          - { name: config.sorgu, type: String, value: "ptr · len=4", to: h1 }
          - { name: config.dosya_yolu, type: String, value: "ptr · len=8", to: h2 }
    heap:
      - { id: h1, value: "r u s t" }
      - { id: h2, value: "s i i r . t x t" }
  - caption: "`run(config)` sahipliği `run`'a taşır. `read_to_string(config.dosya_yolu)` ise `dosya_yolu` alanını **değer olarak** alır (kısmi taşıma, partial move) ve dönerken o `String`'i düşürür. Dosyanın içeriği yeni bir `String`'e (`icerik`) konur."
    stack:
      - frame: main
        vars:
          - { name: config, type: Config, value: "taşındı", moved: true }
      - frame: run
        vars:
          - { name: config.sorgu, type: String, value: "ptr · len=4", to: h1 }
          - { name: config.dosya_yolu, type: String, value: "taşındı", moved: true }
          - { name: icerik, type: String, value: "ptr · len=…", to: h3 }
    heap:
      - { id: h1, value: "r u s t" }
      - { id: h2, value: "s i i r . t x t", freed: true }
      - { id: h3, value: "Rust öğrenmek bir yolculuktur, …", label: "dosyanın içeriği" }
  - caption: "`run` bitince kalan `config.sorgu` ve `icerik` düşürülür (drop); heap'teki tüm bölgeler serbest kalmış olur."
    stack:
      - frame: main
        vars:
          - { name: config, type: Config, value: "taşındı", moved: true }
    heap:
      - { id: h1, value: "r u s t", freed: true }
      - { id: h2, value: "s i i r . t x t", freed: true }
      - { id: h3, value: "Rust öğrenmek bir yolculuktur, …", freed: true }
```

`main`'de `run`'ın hatasını yakalamak için `unwrap_or_else` yerine **`if let Err(e) = ...`** kullanırız
(Modül 7). Neden? Başarı durumunda `run` bir `()` döndürür; açılacak (unwrap) anlamlı bir değer yoktur.
Bizi yalnızca hata durumu ilgilendirir.

```rust,ignore
if let Err(e) = run(config) {
    println!("Uygulama hatası: {e}");
    process::exit(1);
}
```

## Kodu lib.rs'e taşımak

Şimdi parçaları yerine koyalım. `src/lib.rs` dosyasını oluştur; `Config`, `build` ve `run` oraya taşınıyor.
Dışarıdan (yani `main.rs`'ten) kullanılacak her şey **`pub`** olmalı (Modül 8):

```rust,norun,title=src/lib.rs
use std::error::Error;
use std::fs;

pub struct Config {
    pub sorgu: String,
    pub dosya_yolu: String,
}

impl Config {
    pub fn build(args: &[String]) -> Result<Config, &'static str> {
        if args.len() < 3 {
            return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
        }
        let sorgu = args[1].clone();
        let dosya_yolu = args[2].clone();
        Ok(Config { sorgu, dosya_yolu })
    }
}

pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let icerik = fs::read_to_string(config.dosya_yolu)?;
    println!("Metin:\n{icerik}");
    Ok(())
}
```

`main.rs` ise artık ince bir garson. Aynı paketteki library crate'e, paketin adıyla (`ara`) erişir. (Paket
adında tire varsa crate adında alt çizgiye döner: `mini-grep` paketi kodda `mini_grep::...` olarak yazılır.)
`main.rs` ile `lib.rs` **iki ayrı crate**'tir; bu yüzden `main.rs` `lib.rs`'e dışarıdan bakan bir kullanıcı
gibidir ve yalnızca `pub` olanları görür:

```rust,norun,title=src/main.rs
use std::env;
use std::process;

use ara::Config;
# mod ara {
#     use std::error::Error;
#     use std::fs;
#     pub struct Config {
#         pub sorgu: String,
#         pub dosya_yolu: String,
#     }
#     impl Config {
#         pub fn build(args: &[String]) -> Result<Config, &'static str> {
#             if args.len() < 3 {
#                 return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
#             }
#             Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })
#         }
#     }
#     pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
#         let icerik = fs::read_to_string(config.dosya_yolu)?;
#         println!("Metin:\n{icerik}");
#         Ok(())
#     }
# }

fn main() {
    let args: Vec<String> = env::args().collect();

    let config = Config::build(&args).unwrap_or_else(|hata| {
        println!("Argümanlar ayrıştırılamadı: {hata}");
        process::exit(1);
    });

    println!("'{}' aranıyor, dosya: {}", config.sorgu, config.dosya_yolu);

    if let Err(e) = ara::run(config) {
        println!("Uygulama hatası: {e}");
        process::exit(1);
    }
}
```

```console
> cargo run -- rust olmayan.txt
'rust' aranıyor, dosya: olmayan.txt
Uygulama hatası: No such file or directory (os error 2)
```

(Windows'ta mesaj işletim sisteminin dilinde, örneğin `Sistem belirtilen dosyayı bulamıyor. (os error 2)`
olarak görünür.) Panik yok, backtrace yok; kısa ve anlaşılır bir mesaj ve `1` çıkış kodu.

```compiles
code: |
  mod ara {
      pub struct Config {
          sorgu: String,
          pub dosya_yolu: String,
      }

      impl Config {
          pub fn build(args: &[String]) -> Result<Config, &'static str> {
              if args.len() < 3 {
                  return Err("eksik argüman");
              }
              Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })
          }
      }
  }

  fn main() {
      let args = vec![String::from("ara"), String::from("gül"), String::from("bahce.txt")];
      let config = ara::Config::build(&args).unwrap_or_else(|hata| panic!("{hata}"));
      println!("{} {}", config.sorgu, config.dosya_yolu);
  }
answer: false
error: E0616
explanation: |
  Modül 8: struct'ın kendisi `pub` olsa bile alanları varsayılan olarak **gizlidir**. `dosya_yolu` `pub`,
  ama `sorgu` değil; modülün dışından `config.sorgu`'yu okumak `E0616: field sorgu of struct Config is
  private` hatası verir. `lib.rs`'e taşıdığımızda aynı kural geçerli: `main.rs` kütüphaneye dışarıdan
  bakan bir kullanıcıdır.
```

```fill
prompt: "`lib.rs`'teki `run` fonksiyonunu tamamla: dosyayı oku, hatayı yukarı ilet, içeriği yazdır."
code: |
  use std::error::Error;
  use std::fs;

  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  pub fn run(config: Config) -> Result<(), ___0> {
      let icerik = fs::read_to_string(config.dosya_yolu)___1;
      println!("Metin:\n{icerik}");
      ___2
  }
blanks:
  - ["Box<dyn Error>", "Box<dyn std::error::Error>"]
  - ["?"]
  - ["Ok(())"]
explanation: |
  `Box<dyn Error>` her türlü hatayı taşıyabilir; `?`, `io::Error`'ı otomatik olarak kutulayıp erken döner;
  başarı yolunda da `Ok(())` ile "işim bitti, döndürecek bir değerim yok" deriz. Son satırda noktalı virgül
  olmamasına dikkat: `Ok(())` fonksiyonun dönüş **ifadesidir** (Modül 3).
```

## Alıştırmalar

Şimdi `lib.rs`'in iki parçasını kendin yaz. İlki, `Config::build`'in biraz daha titiz bir sürümü.

```exercise
id: m15-e-config-build
title: "Config::build: hata mesajlı doğrulama"
difficulty: 2
prompt: |
  `Config::build`'i yaz. `Result<Config, &'static str>` döndürsün:

  - Argüman sayısı 3'ten azsa: `Err("eksik argüman (kullanım: ara <sorgu> <dosya>)")`
  - Sorgu (`args[1]`) **boş metinse**: `Err("sorgu boş olamaz")`
    (boş sorgu her satırla eşleşirdi; bu muhtemelen kullanıcının bir hatası)
  - Aksi halde `Ok(Config { ... })`; fazladan argümanlar yok sayılır.

  Hiçbir durumda panik yapma.
starter: |
  #[derive(Debug)]
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  impl Config {
      pub fn build(args: &[String]) -> Result<Config, &'static str> {
          todo!()
      }
  }
solution: |
  #[derive(Debug)]
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  impl Config {
      pub fn build(args: &[String]) -> Result<Config, &'static str> {
          if args.len() < 3 {
              return Err("eksik argüman (kullanım: ara <sorgu> <dosya>)");
          }
          if args[1].is_empty() {
              return Err("sorgu boş olamaz");
          }
          let sorgu = args[1].clone();
          let dosya_yolu = args[2].clone();
          Ok(Config { sorgu, dosya_yolu })
      }
  }
check: tests
tests: |
  fn argumanlar(parcalar: &[&str]) -> Vec<String> {
      parcalar.iter().map(|p| p.to_string()).collect()
  }

  #[test]
  fn gecerli_argumanlarla_config_dondurur() {
      let c = Config::build(&argumanlar(&["ara", "çay", "menu.txt", "fazla"])).expect("Ok bekleniyordu");
      assert_eq!(c.sorgu, "çay", "sorgu args[1] olmalı");
      assert_eq!(c.dosya_yolu, "menu.txt", "dosya yolu args[2] olmalı");
  }

  #[test]
  fn eksik_argumanda_hata_dondurur() {
      let hata = Config::build(&argumanlar(&["ara", "çay"])).unwrap_err();
      assert_eq!(hata, "eksik argüman (kullanım: ara <sorgu> <dosya>)");
  }

  #[test]
  fn hic_arguman_yokken_panik_yapmaz() {
      let hata = Config::build(&argumanlar(&[])).unwrap_err();
      assert_eq!(hata, "eksik argüman (kullanım: ara <sorgu> <dosya>)", "boş vektörde bile panik değil Err dönmeli");
  }

  #[test]
  fn bos_sorguyu_reddeder() {
      let hata = Config::build(&argumanlar(&["ara", "", "siir.txt"])).unwrap_err();
      assert_eq!(hata, "sorgu boş olamaz");
  }

  #[test]
  fn bosluk_iceren_sorguyu_kabul_eder() {
      let c = Config::build(&argumanlar(&["ara", "bir ders", "siir.txt"])).expect("Ok bekleniyordu");
      assert_eq!(c.sorgu, "bir ders", "boşluk içeren sorgu geçerlidir, boş değildir");
  }
hints:
  - "İki kontrol var ve sıraları önemli: önce uzunluk, sonra sorgunun boşluğu. Neden? `args[1]`'e bakmadan önce var olduğundan emin olmalısın."
  - "`return Err(\"...\");` ile erken dön. Boş metin kontrolü için `args[1].is_empty()` kullan."
  - "Son satır: `Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })`."
forbid:
  - pattern: "panic!|unwrap\\(\\)|expect\\("
    message: "`Config::build` hiçbir durumda panik yapmamalı; hataları `Err` olarak döndür."
explanation: |
  **Kontrollerin sırası** bir güvenlik meselesi: uzunluk kontrolü geçilmeden `args[1].is_empty()` çağrısı
  boş vektörde panik yapardı. Her `return Err(...)` bir **koruma (guard)** gibi çalışır; fonksiyonun geri
  kalanı, tüm koşulların sağlandığı "mutlu yolda" ilerler.

  Testlerde `unwrap_err()` kullanabilmemiz için `Config`'e `#[derive(Debug)]` ekledik:
  `Result::unwrap_err` başarı tipinin (`T`) `Debug` olmasını ister, çünkü beklenmedik bir `Ok` gelirse onu
  panik mesajında göstermesi gerekir. (`expect` ise tersine hata tipinin, `E`'nin `Debug` olmasını ister;
  `&str` zaten `Debug`'dır.)

  Alternatif yazım: `let Some(sorgu) = args.get(1) else { return Err(...) };` (Modül 7'deki `let else`)
  indekslemeyi tamamen ortadan kaldırır; uzunluk kontrolünü unutsan bile panik mümkün olmaz.

  Bir incelik: `" "` (sadece boşluk) sorgusu bu sürümde kabul edilir. Onu da reddetmek isteseydin
  `args[1].trim().is_empty()` yazardın. Hangisinin doğru olduğu bir **ürün kararıdır**; testler bu kararı
  belgeleyen yerlerdir.
```

İkincisi, ileride `ara`'ya eklemek isteyebileceğin bir seçeneğin parçası: `--limit 5` gibi bir değerle en
fazla kaç eşleşme gösterileceğini belirlemek. Burada `Box<dyn Error>`'ın iki farklı hata türünü nasıl tek
çatıda topladığını kendin deneyimleyeceksin.

```exercise
id: m15-e-satir-limiti
title: Limit değerini ayrıştır
difficulty: 3
prompt: |
  `limit_ayristir(metin: &str) -> Result<usize, Box<dyn Error>>` fonksiyonunu yaz:

  - Baştaki/sondaki boşlukları at (`trim`), sonra `usize`'a ayrıştır. Ayrıştırma hatası **`?` ile**
    yukarı iletilsin (mesajı standart kütüphaneninki olsun).
  - Değer `0` ise `Err` döndür, mesajı tam olarak: `limit sıfır olamaz`
  - Aksi halde `Ok(değer)`.
starter: |
  use std::error::Error;

  pub fn limit_ayristir(metin: &str) -> Result<usize, Box<dyn Error>> {
      todo!()
  }
solution: |
  use std::error::Error;

  pub fn limit_ayristir(metin: &str) -> Result<usize, Box<dyn Error>> {
      let limit: usize = metin.trim().parse()?;
      if limit == 0 {
          return Err("limit sıfır olamaz".into());
      }
      Ok(limit)
  }
check: tests
tests: |
  #[test]
  fn gecerli_sayiyi_ayristirir() {
      assert_eq!(limit_ayristir("5").unwrap(), 5);
      assert_eq!(limit_ayristir("120").unwrap(), 120);
  }

  #[test]
  fn bosluklari_temizler() {
      assert_eq!(limit_ayristir("  12 \n").unwrap(), 12, "önce trim edilmeli");
  }

  #[test]
  fn sayi_olmayan_metin_hata_verir() {
      let hata = limit_ayristir("beş").unwrap_err();
      assert_eq!(hata.to_string(), "invalid digit found in string", "ayrıştırma hatası ? ile olduğu gibi iletilmeli");
  }

  #[test]
  fn negatif_sayi_usize_olamaz() {
      assert!(limit_ayristir("-3").is_err(), "usize negatif olamaz; parse hata vermeli");
  }

  #[test]
  fn bos_metin_hata_verir() {
      let hata = limit_ayristir("   ").unwrap_err();
      assert_eq!(hata.to_string(), "cannot parse integer from empty string", "trim sonrası boş kalan metin sayı değildir");
  }

  #[test]
  fn sifir_reddedilir() {
      let hata = limit_ayristir("0").unwrap_err();
      assert_eq!(hata.to_string(), "limit sıfır olamaz");
  }
hints:
  - "Dönüş tipindeki `Box<dyn Error>` sayesinde `parse()`'ın `ParseIntError`'ı `?` ile otomatik kutulanır."
  - "`let limit: usize = metin.trim().parse()?;` satırıyla başla; tip notu `parse`'a ne üreteceğini söyler."
  - "Sıfır için `return Err(\"limit sıfır olamaz\".into());`, `.into()` `&str`'yi `Box<dyn Error>`'a çevirir."
require:
  - pattern: "\\?"
    message: Ayrıştırma hatasını `?` operatörüyle yukarı iletmelisin.
explanation: |
  Tek bir dönüş tipinde iki farklı hata kaynağı buluştu: standart kütüphanenin `ParseIntError`'ı (`?`
  sayesinde otomatik olarak `Box<dyn Error>`'a dönüştü) ve kendi mesajımız (`.into()` ile dönüştü). İşte
  `run`'ın dönüş tipi olarak `Box<dyn Error>` seçmemizin nedeni bu esneklik.

  Bedeli: çağıran taraf hatanın **hangi tipte** olduğunu derleme anında bilemez; yalnızca mesajını
  (`Display`) yazdırabilir. (Çalışma anında `hata.downcast_ref::<ParseIntError>()` ile "bu bir ayrıştırma
  hatası mı?" diye sorabilirsin, ama bu tip denetimini derleyiciden alıp çalışma anına itmek demektir.)
  Uygulamanın en üst katmanında (mesajı gösterip çıkacağımız yerde) bu yeterlidir.
  Hatanın türüne göre farklı davranması gereken kütüphaneler ise Modül 10-11'deki gibi kendi hata
  `enum`'larını tanımlar. Modül 25'te `thiserror` ve `anyhow` crate'leriyle bu iki dünyayı tanıyacaksın.

  Not: `usize` işaretsizdir; `"-3"`, sıfır kontrolüne gelmeden `parse` aşamasında hata verir.
```

## Özet

:::remember
- `fs::read_to_string(yol)` → `io::Result<String>`; göreli yollar **çalışma klasörüne** göre çözülür.
- `main.rs` ince olsun (argüman topla, çağır, hatayı göster, çık); mantık ve testler `lib.rs`'te.
- Başarısız olabilen kurucunun adı `build`: `fn build(args: &[String]) -> Result<Config, &'static str>`.
- `run(config) -> Result<(), Box<dyn Error>>`: `?` her standart hatayı kutular; `"mesaj".into()` da olur.
- `main`'de: `unwrap_or_else(|hata| { ...; process::exit(1) })` ve `if let Err(e) = run(config) { ... }`.
- `process::exit` yıkıcıları çalıştırmaz; yalnızca `main`'de, en dış katmanda kullan.
:::

```reflect
prompt: |
  `ara` projesini `main.rs` ve `lib.rs` olarak böldük. Bu bölmenin hem test edilebilirlik hem de hata
  yönetimi açısından ne kazandırdığını kendi cümlelerinle açıkla.
answer: |
  Test edilebilirlik: karar veren tüm mantık (`Config::build`, `run`, birazdan arama fonksiyonları)
  `lib.rs`'te `pub` fonksiyonlar olarak yaşıyor; testler onları taklit verilerle doğrudan çağırabilir.
  `main.rs` o kadar küçük ki okuyarak doğrulanabilir.
  Hata yönetimi: kütüphane hiçbir zaman programı kendisi bitirmiyor; hataları `Result` olarak yukarı
  veriyor. Hatanın kullanıcıya nasıl gösterileceğine ve hangi çıkış koduyla bitileceğine tek bir yer,
  `main` karar veriyor. Böylece kütüphane başka bir programda (ör. bir GUI'de) de kullanılabilir.
```

```flashcards
- front: "`fs::read_to_string`'in dönüş tipi nedir?"
  back: "`io::Result<String>`, yani `Result<String, io::Error>`."
- front: "`siir.txt` gibi göreli bir dosya yolu neye göre çözülür?"
  back: Programın çalıştırıldığı klasöre (current working directory); kaynak dosyanın konumuna göre değil.
- front: Bir binary projede neden mantığı `lib.rs`'e taşırız?
  back: "Test edilebilsin diye (testler library'nin `pub` API'sini çağırabilir) ve `main` sadece argüman toplama, çağırma ve hata gösterme işini yapsın diye."
- front: Başarısız olabilen bir kurucu için `new` yerine neden `build` adını seçtik?
  back: "Rust geleneğinde `new` başarısız olmaz; `Result` döndüren kurucular için farklı bir isim (`build`) beklenir."
- front: "`process::exit(1)` ne yapar ve neyi atlar?"
  back: Programı hemen `1` çıkış koduyla bitirir; yığını çözmez, yaşayan değerlerin `drop`'u çağrılmaz.
- front: "`Box<dyn Error>` dönüş tipi `?` ile neden her standart hatayı kabul eder?"
  back: "`Error` uygulayan her `E` için `From<E> for Box<dyn Error>` vardır; `?` hatayı `From` ile dönüştürür."
- front: "`run`'ın hatasını `main`'de neden `unwrap_or_else` yerine `if let Err(e)` ile ele alırız?"
  back: "Başarıda `run` `()` döndürür; açılacak bir değer yoktur, yalnızca hata durumu ilgilendirir."
- front: "`Ok(())` ne anlama gelir?"
  back: Başarılı oldu, ama döndürülecek anlamlı bir değer yok (`()` birim tipi).
```
