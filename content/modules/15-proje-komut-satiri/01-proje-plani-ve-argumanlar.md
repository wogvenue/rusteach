---
id: m15-l01
title: Proje planı ve komut satırı argümanları
minutes: 30
type: project
objectives:
  - "`ara` projesinin amacını, parçalarını ve beş derslik yol haritasını anlatabilmek"
  - "`std::env::args()` ile komut satırı argümanlarını bir `Vec<String>`'e toplayıp indeksle okuyabilmek"
  - "Argüman okurken karşılaşılan `E0507` ve `index out of bounds` hatalarının nedenini açıklayıp düzeltebilmek"
  - "Dağınık argüman değişkenlerini anlamlı bir `Config` yapısında toplayabilmek"
keywords: [proje, minigrep, grep, ara, komut satırı, argüman, std::env::args, Config, cargo run --, E0507]
---

On dört modül boyunca alet çantanı doldurdun: sahiplik, ödünç alma, struct'lar, enum'lar, hata yönetimi,
trait'ler, yaşam süreleri, testler, closure'lar ve iterator'lar. Şimdi bunların **hepsini birden**
kullanacağın gerçek bir program yazma zamanı. Bu modülün sonunda, terminalde şöyle çalışan bir aracın olacak:

```console
> cargo run -- rust siir.txt
rust gibi paslanmaz bilgi bırakır.
```

Aracımızın adı **`ara`**. Ona bir **sorgu** (aranacak metin) ve bir **dosya yolu** veriyorsun; o da dosyada
sorguyu içeren her satırı ekrana yazıyor. Bu, Unix dünyasının efsanevi aracı `grep`'in küçük bir kardeşi.
Rust'ın resmî kitabındaki ünlü *minigrep* projesini adım adım, Türkçe ve biraz daha derinlemesine kuracağız.

:::ferris
Bu modülde yeni şeylerden çok, bildiklerini **birleştirmeyi** öğreneceksin. Gerçek programlar böyle
yazılır: küçük parçalar, iyi isimler, bol test. Hazırsan başlayalım! 🦀
:::

## Ne inşa ediyoruz?

`grep` 1973'te Unix için yazıldı. Adı eski `ed` editöründeki `g/re/p` komutundan gelir: *global olarak bir
**r**egular **e**xpression ara ve eşleşen satırları **p**rint et*. Bugün de her geliştiricinin elinin
altındadır. İlginç bir bilgi: bugün dünyanın en hızlı arama araçlarından biri olan **ripgrep** (`rg`)
Rust ile yazılmıştır ve VS Code'un "dosyalarda ara" özelliği arka planda onu kullanır. Yani yazacağın şey
oyuncak değil, gerçek bir aracın tohumu.

Beş derslik yol haritamız:

| Ders | Ne ekleyeceğiz? | Kullanacağın eski bilgiler |
|------|-----------------|----------------------------|
| 1 | Argümanları okumak, `Config` yapısı | `Vec`, `String`, dilimler, struct'lar |
| 2 | Dosya okuma, `main.rs` / `lib.rs` ayrımı, `Result` ile hatalar | modüller, `Result`, `?`, `Box<dyn Error>` |
| 3 | Arama mantığı, önce test (TDD) | testler, yaşam süreleri |
| 4 | Ortam değişkeni ile büyük/küçük harf ayarı, `stderr` | `Option`, `if` ifadesi |
| 5 | Iterator'larla iyileştirme, `clap` ile gerçek dünya | closure'lar, iterator'lar |

Projeyi kendi bilgisayarında Cargo ile oluştur:

```console
> cargo new ara
     Created binary (application) `ara` package
> cd ara
```

:::analogy Kütüphane görevlisi
`ara`'yı bir kütüphane görevlisi gibi düşün. Ona iki şey söylüyorsun: *"Şu kitapta (dosya yolu), içinde
'rust' geçen (sorgu) satırları bul."* Görevli kitabı açar, satır satır okur ve bulduklarını sana okur.
Görevlinin işini yapabilmesi için önce **ne istediğini doğru anlaması** gerekir; bu dersin konusu tam olarak
bu: isteği (argümanları) almak ve düzenlemek.
:::

```quiz
question: |
  `cargo new ara` komutundan sonra programın giriş noktası olan `main` fonksiyonu hangi dosyadadır?
  (Modül 1'i hatırla.)
options:
  - "`Cargo.toml`"
  - "`src/main.rs`"
  - "`src/lib.rs`"
  - "`target/debug/ara`"
answer: 1
explanation: |
  `cargo new` bir **binary crate** oluşturur ve kökü `src/main.rs`'tir. `Cargo.toml` projenin ayar dosyası,
  `target/` ise derleme çıktılarının klasörüdür. `src/lib.rs`'i bir sonraki derste **biz** ekleyeceğiz;
  mantığı oraya taşımak projenin test edilebilirliğini artıracak.
feedback:
  - "`Cargo.toml` TOML biçiminde bir ayar dosyasıdır; içinde Rust kodu yoktur."
  - Doğru!
  - "`cargo new` varsayılan olarak `lib.rs` oluşturmaz (`cargo new --lib` oluşturur). Onu ikinci derste elle ekleyeceğiz."
  - "`target/debug/ara` derlenmiş **çalıştırılabilir dosyadır**, kaynak kod değil."
```

## Komut satırı argümanları nedir?

Terminalde bir program çalıştırırken adından sonra yazdığın her kelime bir **komut satırı argümanıdır
(command-line argument)**. `git commit -m "mesaj"` komutunda `commit`, `-m` ve `mesaj`, `git` programına
verilen argümanlardır. İşletim sistemi bu kelimeleri programı başlatırken ona bir liste olarak teslim eder.

Diğer diller bu listeyi `main`'e parametre olarak verir:

| Dil | Argümanlar nerede? |
|-----|--------------------|
| C / C++ | `int main(int argc, char *argv[])` |
| Java | `public static void main(String[] args)` |
| Python | `sys.argv` listesi |
| Rust | `fn main()` parametresizdir; argümanlar `std::env::args()` fonksiyonundan alınır |

Rust'ın yaklaşımında `args()` bir **iterator** döndürür (Modül 14). Biz onu `collect` ile bir vektöre
toplayıp içine bakacağız. `dbg!` makrosunu (Modül 6) kullanarak `src/main.rs`'e şunu yaz:

```rust,norun,title=src/main.rs
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    dbg!(&args);
}
```

Şimdi Cargo ile çalıştır. Programa giden argümanları `--` işaretinden **sonra** yazarsın; `--`'den önceki
her şey Cargo'nun kendisine aittir:

```console
> cargo run -- gül siir.txt
[src/main.rs:5:5] &args = [
    "target/debug/ara",
    "gül",
    "siir.txt",
]
```

Listede **üç** eleman var, iki değil! İlk eleman (`args[0]`), programın kendi yoludur. Bu C'den kalma bir
gelenektir: program, hangi adla çağrıldığını bilsin diye. Windows'ta bu yol `target\debug\ara.exe` gibi
görünür. Bizim argümanlarımız `args[1]` ve `args[2]`'dedir.

Dikkat: `args[0]` bir **gelenek**, garanti değil. Programı başlatan süreç oraya istediği metni koyabilir,
hatta hiç koymayabilir (liste boş gelebilir). Bu yüzden `args[0]`'a asla güvenlik kararı bağlama; biz onu
yalnızca **atlayacağız**.

:::info Bu derslerde kod nerede çalışır?
`env::args()` kullanan programlar uygulamanın içinde **çalıştırılamaz** (yalnızca derlenir), çünkü
uygulamanın çalıştırıcısı programına senin istediğin argümanları veremez. O kısımları kendi bilgisayarında
`cargo run -- ...` ile dene. Uygulama içindeki örneklerde ve alıştırmalarda ise argümanları **taklit
eden** hazır bir `Vec<String>` kullanacağız; mantık birebir aynı.
:::

```quiz
question: "`cargo run -- -i rust siir.txt` komutunda programın gördüğü `args` vektörünün uzunluğu kaçtır?"
options:
  - "3"
  - "4"
  - "5"
  - "6"
answer: 1
explanation: |
  `cargo run` ve `--` Cargo'ya aittir; programa ulaşmazlar. Programın gördüğü liste:
  `["target/debug/ara", "-i", "rust", "siir.txt"]`, yani **4** eleman. Unutma: `args[0]` (geleneksel
  olarak) programın kendi yoludur ve `-i` gibi seçenekler de sıradan birer argüman olarak gelir. Onları anlamlandırmak
  programın işidir (beşinci derste `clap` bu işi bizim yerimize yapacak).
feedback:
  - "Programın kendi yolunu (`args[0]`) saymayı unuttun."
  - Doğru!
  - "`--` ayıracı Cargo'ya aittir ve programa iletilmez."
  - "`cargo` ve `run` da Cargo'ya aittir; programın argümanları değildir."
```

## args() hakkında üç ince ayrıntı

**1. `collect`'in tip ihtiyacı.** Modül 14'ten hatırla: `collect` pek çok farklı koleksiyon üretebilir
(`Vec`, `String`, `HashMap`...). Hangisini istediğimizi söylemezsek derleyici tahmin edemez. Bu yüzden
`let args: Vec<String>` diye tipi yazdık. Alternatif: `env::args().collect::<Vec<String>>()`. Aşağıda
`env::args()` yerine, `String` üreten başka bir iterator ile iki yazımı da deneyebilirsin:

```rust
fn main() {
    // env::args() de böyle String'ler üreten bir iterator'dır.
    let args: Vec<String> = ["ara", "gül", "siir.txt"].iter().map(|s| s.to_string()).collect();
    println!("{} argüman, sorgu: {}", args.len(), args[1]);

    let kisa = ["ara", "çay"].iter().map(|s| s.to_string()).collect::<Vec<String>>();
    println!("{kisa:?}");
}
```

**2. Geçersiz Unicode.** `env::args()` her argümanı `String` olarak verir. Bir argüman geçerli Unicode değilse,
iterator o argümana geldiğinde **panik** yapar. Bu sandığından olasıdır: Linux'ta bir dosya adı UTF-8 olmayan
rastgele baytlar içerebilir, Windows'ta da eşleşmemiş UTF-16 parçaları bulunabilir. Her baytı kabul etmesi gereken
programlar için `env::args_os()` vardır; o, `OsString` değerleri döndürür. Biz `args()` ile devam edeceğiz;
basitlik için bu takası bilerek yapıyoruz.

**3. Fonksiyonu üst modülüyle çağır.** `env::args()` yazmak için `use std::env;` dedik, `use std::env::args;`
demedik. Modül 8'deki kural: fonksiyonları **üst modülleriyle** birlikte çağırmak, okuyana "bu fonksiyon
nereden geliyor?" sorusunun cevabını verir. `args()` tek başına, kendi yazdığın bir fonksiyon sanılabilirdi.

Şimdi elimizde argümanlar var. Onları değişkenlere alalım. Aşağıdaki kodu çalıştırmadan önce tahmin et:

```compiles
code: |
  fn main() {
      // env::args().collect() sonucunu taklit ediyoruz
      let args: Vec<String> = vec![
          String::from("ara"),
          String::from("gül"),
          String::from("siir.txt"),
      ];
      let sorgu = args[1];
      println!("Aranan: {sorgu}");
  }
answer: false
error: E0507
explanation: |
  `args[1]` bir `String`'dir ve `String` `Copy` değildir. `let sorgu = args[1];` onu vektörün **içinden
  dışarı taşımaya** çalışır; ama vektörün ortasında "taşınmış" bir delik bırakmak mümkün değildir. Rust
  bunu `E0507` ile durdurur. Çözüm: ödünç al (`&args[1]`) ya da bilinçli olarak kopyala (`args[1].clone()`).
```

:::error
```text
error[E0507]: cannot move out of index of `Vec<String>`
 --> src/main.rs:3:17
  |
3 |     let sorgu = args[1];
  |                 ^^^^^^^ move occurs because value has type `String`, which does not implement the `Copy` trait
  |
help: consider borrowing here
  |
3 |     let sorgu = &args[1];
  |                 +
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let sorgu = args[1].clone();
  |                        ++++++++
```
Derleyici iki çözüm öneriyor ve ikisi de doğru. Hangisini seçeceğin, değere **ne kadar süre** ihtiyacın
olduğuna bağlı. Şimdilik ödünç alıyoruz; aşağıdaki "Tasarım" bölümünde, `Config` yapısında `clone`'u bilinçli
olarak seçeceğiz.
:::

## Argümanları değişkenlere almak

Ödünç alarak düzeltelim. `env::args()` yerine yine taklit bir vektör kullanıyoruz ki burada çalıştırabilesin:

```rust
fn main() {
    let args: Vec<String> = vec![
        String::from("target/debug/ara"),
        String::from("gül"),
        String::from("siir.txt"),
    ];

    let sorgu = &args[1];
    let dosya_yolu = &args[2];

    println!("Aranan: {sorgu}");
    println!("Dosya: {dosya_yolu}");
}
```

Bellekte olan biten şu: `args` vektörünün üç `String` başlığı heap'te yan yana durur, her biri de kendi
karakterlerini başka bir heap bölgesinde tutar. `sorgu` ve `dosya_yolu` yeni bir şey oluşturmaz; sadece
vektörün içindeki elemanları **gösterir**.

```memory
title: Argüman vektörü ve ödünç alınan elemanlar
steps:
  - caption: "`args` stack'te bir `Vec` başlığıdır. Heap'te üç `String` başlığı, onların da gösterdiği karakterler var."
    stack:
      - frame: main
        vars:
          - { name: args, type: "Vec<String>", value: "ptr · len=3 · cap=3", to: h1 }
    heap:
      - { id: h1, value: "[String, String, String]", label: "args'ın elemanları" }
      - { id: h2, value: "t a r g e t / d e b u g / a r a", label: "args[0]" }
      - { id: h3, value: "g ü l", label: "args[1]" }
      - { id: h4, value: "s i i r . t x t", label: "args[2]" }
  - caption: "`let sorgu = &args[1];` sadece bir referans oluşturur: kopya yok, taşıma yok. `args` hâlâ her şeyin sahibi."
    stack:
      - frame: main
        vars:
          - { name: args, type: "Vec<String>", value: "ptr · len=3 · cap=3", to: h1 }
          - { name: sorgu, type: "&String", value: "→ args[1]", to: h1, note: ödünç }
          - { name: dosya_yolu, type: "&String", value: "→ args[2]", to: h1, note: ödünç }
    heap:
      - { id: h1, value: "[String, String, String]", label: "args'ın elemanları" }
      - { id: h2, value: "t a r g e t / d e b u g / a r a", label: "args[0]" }
      - { id: h3, value: "g ü l", label: "args[1]" }
      - { id: h4, value: "s i i r . t x t", label: "args[2]" }
```

Peki kullanıcı argümanları eksik verirse? Programını `cargo run -- gül` diye, dosya yolu olmadan çalıştırdığını
düşün:

````quiz
question: |
  Kullanıcı yalnızca sorguyu verdi. Aşağıdaki program ne yapar?

  ```rust
  fn main() {
      let args: Vec<String> = vec![String::from("ara"), String::from("gül")];
      println!("Argüman sayısı: {}", args.len());
      let dosya_yolu = &args[2];
      println!("Dosya: {dosya_yolu}");
  }
  ```
options:
  - Derlenmez; derleyici `args[2]`'nin olmadığını görür
  - "`Argüman sayısı: 2` yazar, sonra panik yapar"
  - "`Argüman sayısı: 2` ve boş bir `Dosya:` satırı yazar"
  - Hiçbir şey yazmadan panik yapar
answer: 1
explanation: |
  Program **derlenir**: vektörün çalışma anında kaç eleman tutacağını derleyici bilemez (sabit boyutlu
  dizilerin aksine, Modül 2). İlk `println!` çalışır, ardından `args[2]` sınırların dışında kaldığı için
  program panik yapar ve ikinci `println!`'e hiç sıra gelmez. Rust, C'deki gibi bellekte rastgele bir yeri
  okumaz; sınır denetimi yapar ve güvenli bir şekilde durur.
feedback:
  - "Derleyici `Vec`'in çalışma anındaki uzunluğunu bilemez; sınır denetimi çalışma anında yapılır."
  - Doğru!
  - "Rust sınır dışı okumada boş bir değer uydurmaz; C'nin aksine güvenli bir şekilde panik yapar."
  - "Satırlar sırayla çalışır; ilk `println!` panikten önce gelir."
````

Kendin gör (bu örnek bilerek panik yapıyor):

```rust,should_panic
fn main() {
    let args: Vec<String> = vec![String::from("ara"), String::from("gül")];
    println!("Argüman sayısı: {}", args.len());
    let dosya_yolu = &args[2];
    println!("Dosya: {dosya_yolu}");
}
```

Panik mesajı `index out of bounds: the len is 2 but the index is 2` olur. Bu mesaj, standart çıktıdan ayrı
bir kanala, **standart hata**ya (stderr) yazılır; o kanalı dördüncü derste tanıyacağız.

:::warning Panik bir kullanıcı hatası mesajı değildir
Modül 10'dan hatırla: `panic!` **programcının hataları** (bug) içindir. Kullanıcının bir argümanı unutması
ise tamamen **beklenen** bir durumdur. Şimdilik paniğe göz yumuyoruz, çünkü önce yapıyı kuruyoruz. Ama
`thread 'main' panicked at src/main.rs:4:23` gibi bir mesaj gören kullanıcı, programının bozuk olduğunu
düşünür. İkinci derste bunu `Result` ile düzelteceğiz.
:::

## Tasarım: argümanları bir Config yapısında toplamak

Program büyüdükçe `main`'in içi kalabalıklaşacak. İlk adım, argüman ayrıştırmayı kendi fonksiyonuna almak:

```rust
fn argumanlari_ayristir(args: &[String]) -> (&str, &str) {
    let sorgu = &args[1];
    let dosya_yolu = &args[2];
    (sorgu, dosya_yolu)
}
# fn main() {
#     let args = vec![String::from("ara"), String::from("gül"), String::from("siir.txt")];
#     let (sorgu, dosya_yolu) = argumanlari_ayristir(&args);
#     println!("{sorgu} / {dosya_yolu}");
# }
```

(Dönüş tipindeki `&str`'lere yaşam süresi yazmadık; tek bir referans parametresi olduğu için Modül 12'deki
**elision** kuralları devreye girer: dönen dilimler `args`'tan ödünç alınmıştır.)

Çalışır, ama bir **koku (code smell)** var: tuple'ın elemanlarının ismi yok. `(&str, &str)` dönüşüne bakan
biri hangisinin sorgu, hangisinin dosya yolu olduğunu bilemez; yanlışlıkla yerlerini değiştirmek çok kolay.
Bu iki değer **birlikte** bir anlam taşıyor: *programın ayarları*. Birlikte anlam taşıyan verilerin yeri bir
**struct**'tır (Modül 6):

```rust
struct Config {
    sorgu: String,
    dosya_yolu: String,
}

impl Config {
    fn new(args: &[String]) -> Config {
        let sorgu = args[1].clone();
        let dosya_yolu = args[2].clone();
        Config { sorgu, dosya_yolu }
    }
}

fn main() {
    let args: Vec<String> = vec![
        String::from("ara"),
        String::from("rust"),
        String::from("siir.txt"),
    ];
    let config = Config::new(&args);
    println!("'{}' aranıyor, dosya: {}", config.sorgu, config.dosya_yolu);
}
```

Üç tasarım kararını gerekçeleriyle inceleyelim:

1. **`new` bir ilişkili fonksiyon (associated function).** `Config::new(&args)` yazımı, `String::from` gibi
   "bir `Config` üret" anlamını taşır. Ayrıştırma mantığı, ürettiği tipin yanında yaşar.
2. **Parametre `&[String]`.** Modül 5'teki kural: sadece okuyacaksan `&Vec<String>` değil, dilim al.
   `&args` (bir `&Vec<String>`) otomatik olarak `&[String]`'e dönüşür; ayrıca fonksiyon dizilerle de çalışır.
3. **Alanlar `String`, değerler `clone`'lanıyor.** Neden `&str` alanlar değil? `struct Config<'a> { sorgu:
   &'a str, ... }` de yazabilirdik (Modül 12), ama o zaman `Config` en fazla `args` yaşadığı sürece yaşayabilirdi ve
   her imzaya `'a` bulaşırdı. İki kısa metni kopyalamanın maliyeti ihmal edilebilir; karşılığında `Config`
   **kendi verisinin sahibi** olur ve istediğimiz yere taşınabilir. `clone`'u burada bir yama olarak değil,
   **bilinçli bir takas** olarak seçiyoruz. Beşinci derste iterator'larla bu kopyalardan da kurtulacağız.

```quiz
question: |
  `Config::new`'in parametresini `args: Vec<String>` yapsaydık (referans olmadan) ne değişirdi?
options:
  - Hiçbir şey; Rust argümanı otomatik olarak ödünç alır
  - "`Config::new(args)` çağrısı vektörün sahipliğini alırdı; `main` artık `args`'ı kullanamazdı"
  - Kod derlenmezdi, çünkü fonksiyonlar `Vec` alamaz
answer: 1
explanation: |
  Modül 4: sahipli bir değeri fonksiyona vermek onu **taşır**. Çağrıdan sonra `args`'ı kullanmaya
  çalışırsan `E0382` alırsın. Ödünç almak (`&[String]`) çağıranın vektörü kullanmaya devam etmesini sağlar.
  Rust, C++'taki gibi gizli kopyalar ya da Python'daki gibi gizli paylaşım yapmaz; ne olacağını imzaya
  bakarak bilirsin.
feedback:
  - "Rust hiçbir zaman gizlice ödünç almaz ya da kopyalamaz; sahiplik imzada açıkça yazar."
  - Doğru!
  - "Fonksiyonlar `Vec` alabilir; sadece o zaman sahipliği de alırlar."
```

```fill
prompt: Boşlukları doldurarak `Config::new`'i tamamla. Alanlar sahipli `String` olmalı.
code: |
  struct Config {
      sorgu: String,
      dosya_yolu: String,
  }

  impl Config {
      fn new(args: ___0) -> Config {
          let sorgu = args[1].___1();
          let dosya_yolu = args[2].clone();
          Config { sorgu, dosya_yolu }
      }
  }

  fn main() {
      let args = vec![String::from("ara"), String::from("çay"), String::from("menu.txt")];
      let config = Config::new(___2);
      println!("{} / {}", config.sorgu, config.dosya_yolu);
  }
blanks:
  - ["&[String]", "&Vec<String>"]
  - ["clone", "to_string", "to_owned"]
  - ["&args"]
output: çay / menu.txt
explanation: |
  `&[String]` dilim parametresi en esnek seçimdir (`&Vec<String>` da çalışır ama daha kısıtlayıcıdır).
  `clone()` ile vektördeki `String`'in bağımsız bir kopyasını alıyoruz (`to_string()` ve `to_owned()` da
  aynı işi görür), çünkü struct alanı sahipli bir
  `String` bekliyor; `args[1]`'i doğrudan taşıyamayacağımızı E0507'den biliyorsun. Çağrıda `&args` ile
  vektörü ödünç veriyoruz.
```

## Alıştırma: anlamlı bir panik mesajı

Bir sonraki derste hataları `Result` ile düzgünce ele alacağız. Ama ilk adım olarak en azından panik
mesajını anlaşılır yapalım: `index out of bounds` yerine kullanıcıya ne eksik olduğunu söyleyen bir mesaj.

Önce fikri `Config` olmadan, düz bir `main` içinde kur: **indekslemeden önce uzunluğu kontrol et.**

```parsons
prompt: |
  Satırları sıraya koy: program önce argüman sayısını kontrol etsin (eksikse anlamlı bir mesajla
  panik yapsın). Sonra her değeri, ödünç aldığı satırın **hemen ardından** yazdırsın: önce sorgu
  (ödünç al + yazdır), sonra dosya yolu (ödünç al + yazdır).
lines: |
  fn main() {
      let args: Vec<String> = vec![String::from("ara"), String::from("Ferris"), String::from("notlar.md")];
      if args.len() < 3 {
          panic!("en az iki argüman gerekli: ara <sorgu> <dosya>");
      }
      let sorgu = &args[1];
      println!("Sorgu: {sorgu}");
      let dosya_yolu = &args[2];
      println!("Dosya: {dosya_yolu}");
  }
distractors: |
      if args.len() < 2 {
      let sorgu = args[1];
explanation: |
  Kontrol, indekslemeden **önce** gelmeli; yoksa `args[2]` daha kontrol çalışmadan panik yapar.
  Program adı da sayıldığı için iki kullanıcı argümanı demek `args.len() >= 3` demektir; `< 2` kontrolü
  tek argümanlı çağrıyı kaçırır. `let sorgu = args[1];` ise E0507 verir: vektörden `String` taşınamaz.
```

```exercise
id: m15-e-config-new
title: Config::new — anlaşılır panik mesajı
difficulty: 2
prompt: |
  `Config::new` fonksiyonunu tamamla:

  - `args[0]` programın adıdır; **atla**. Sorgu `args[1]`, dosya yolu `args[2]`'dir.
  - Fazladan argümanlar varsa (şimdilik) **yok say**.
  - Argüman sayısı 3'ten azsa, `index out of bounds` yerine şu mesajla panik yap:
    `en az iki argüman gerekli: ara <sorgu> <dosya>`

  Alanlar sahipli `String` olmalı.
starter: |
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  impl Config {
      pub fn new(args: &[String]) -> Config {
          todo!()
      }
  }
solution: |
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  impl Config {
      pub fn new(args: &[String]) -> Config {
          if args.len() < 3 {
              panic!("en az iki argüman gerekli: ara <sorgu> <dosya>");
          }
          let sorgu = args[1].clone();
          let dosya_yolu = args[2].clone();
          Config { sorgu, dosya_yolu }
      }
  }
check: tests
tests: |
  fn argumanlar(parcalar: &[&str]) -> Vec<String> {
      parcalar.iter().map(|p| p.to_string()).collect()
  }

  #[test]
  fn sorgu_ve_dosya_yolunu_alir() {
      let c = Config::new(&argumanlar(&["ara", "gül", "siir.txt"]));
      assert_eq!(c.sorgu, "gül", "sorgu args[1] olmalı");
      assert_eq!(c.dosya_yolu, "siir.txt", "dosya yolu args[2] olmalı");
  }

  #[test]
  fn program_adini_atlar() {
      let c = Config::new(&argumanlar(&["/usr/bin/ara", "Rust", "notlar.md"]));
      assert_eq!(c.sorgu, "Rust", "args[0] programın yoludur, sorgu değildir");
      assert_eq!(c.dosya_yolu, "notlar.md");
  }

  #[test]
  fn fazla_argumanlari_yok_sayar() {
      let c = Config::new(&argumanlar(&["ara", "çay", "menu.txt", "fazla", "argüman"]));
      assert_eq!(c.sorgu, "çay");
      assert_eq!(c.dosya_yolu, "menu.txt", "üçüncüden sonraki argümanlar yok sayılmalı");
  }

  #[test]
  #[should_panic(expected = "en az iki argüman gerekli")]
  fn eksik_argumanda_anlamli_panik() {
      Config::new(&argumanlar(&["ara", "gül"]));
  }

  #[test]
  #[should_panic(expected = "en az iki argüman gerekli")]
  fn hic_arguman_yoksa_da_anlamli_panik() {
      Config::new(&argumanlar(&["ara"]));
  }

  #[test]
  #[should_panic(expected = "en az iki argüman gerekli")]
  fn bos_listede_de_anlamli_panik() {
      // args[0] bile garanti değildir; liste tamamen boş gelebilir.
      Config::new(&[]);
  }
hints:
  - "İndekslemeden **önce** uzunluğu kontrol et: `args.len()` kaç olmalı?"
  - "`if args.len() < 3 { panic!(\"...\"); }` ile başla; mesaj testteki metni içermeli."
  - "Kontrolden sonra `let sorgu = args[1].clone();` ve `args[2].clone()` ile alanları doldur, `Config { sorgu, dosya_yolu }` döndür."
explanation: |
  Kilit fikir: **kontrolü indekslemeden önce** yapmak. `args[1]` satırına geldiğinde vektörün yeterince uzun
  olduğundan artık eminsin; bu yüzden indeksleme asla panik yapmaz.

  `#[should_panic(expected = "...")]` testlerinin (Modül 13) panik mesajının **içinde** geçen bir alt metni
  aradığına dikkat et. `todo!()`'nun paniği ("not yet implemented") bu testleri geçemez; doğru mesajla
  panik yapmak şart.

  Alternatif: `args.get(1)` bir `Option<&String>` döndürür (Modül 9) ve `match` ya da `let-else` ile
  panik yapmadan ele alınabilir. Bu yaklaşım bir sonraki derste `Result` döndüren `Config::build`'e geçişin
  ilk adımı olacak. Şu an hâlâ panik yapıyoruz, çünkü `new` ismi Rust'ta **başarısız olmayan** kurucular
  için kullanılır; hata döndürebilen sürüme başka bir isim vereceğiz.
```

## Özet

:::remember
- Komut satırı argümanları `std::env::args()` ile alınır; `collect` için tip yazılır: `let args: Vec<String> = env::args().collect();`
- `args[0]` geleneksel olarak programın kendi yoludur (garanti değil); kullanıcı argümanları `args[1]`'den başlar.
- `cargo run -- a b` → `--`'den sonrası programa gider.
- Vektörden `String` taşınamaz (`E0507`): `&args[1]` ile ödünç al ya da bilinçli olarak `.clone()` et.
- Birlikte anlam taşıyan değerler bir struct'ta toplanır: `Config { sorgu, dosya_yolu }`.
- `env::args()` kullanan kodu kendi bilgisayarında çalıştır; mantığı taklit argümanlarla test et.
:::

```reflect
prompt: |
  `Config` yapısının alanlarını `&str` yerine sahipli `String` yaptık ve değerleri `clone`'ladık.
  Bu kararın kazancını ve bedelini kendi cümlelerinle açıkla.
answer: |
  Kazanç: `Config` kendi verisinin sahibi olur; `args` vektöründen bağımsız yaşar, istenen yere
  taşınabilir ve imzalara yaşam süresi parametresi (`'a`) bulaşmaz. Kod daha basit kalır.
  Bedel: iki kısa metin heap'te bir kez daha kopyalanır. Program başında bir kez olan bu küçük maliyet,
  basitliğe değer. Performans gerçekten önemli olsaydı ya `Config<'a>` ile ödünç alırdık ya da (beşinci
  derste yapacağımız gibi) `env::args()`'tan gelen `String`'lerin sahipliğini doğrudan alırdık.
```

```flashcards
- front: Rust'ta komut satırı argümanlarını bir vektöre toplayan satır nedir?
  back: "`let args: Vec<String> = std::env::args().collect();`"
- front: "`args[0]` neyi içerir?"
  back: Geleneksel olarak programın kendi yolunu (ör. `target/debug/ara`), ama bu garanti değildir. Kullanıcının argümanları `args[1]`'den başlar.
- front: "`cargo run -- gül siir.txt` komutundaki `--` ne işe yarar?"
  back: Cargo'nun kendi seçeneklerini programın argümanlarından ayırır; `--`'den sonrası programa gider.
- front: "`let sorgu = args[1];` (`args: Vec<String>`) neden derlenmez?"
  back: "`String` `Copy` değildir; vektörün içinden taşıma yapılamaz (`E0507`). `&args[1]` ya da `args[1].clone()` kullanılır."
- front: "`env::args()` geçersiz UTF-8 içeren bir argümanla karşılaşınca ne yapar? Alternatifi nedir?"
  back: Panik yapar. Her baytı kabul etmek için `env::args_os()` (`OsString` döndürür) kullanılır.
- front: Argümanları neden `(&str, &str)` tuple'ı yerine bir `Config` struct'ında topladık?
  back: Tuple elemanlarının ismi yoktur, karıştırılabilir; struct alanları anlamı açıkça adlandırır ve ilgili veriyi bir arada tutar.
- front: Eksik argüman için panik yapmak neden iyi bir kullanıcı deneyimi değildir?
  back: Panik programcı hataları içindir; eksik argüman beklenen bir kullanıcı hatasıdır ve anlaşılır bir mesajla (`Result`) ele alınmalıdır.
```
