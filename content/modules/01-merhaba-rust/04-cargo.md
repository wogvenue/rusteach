---
id: m01-l04
title: Cargo ile proje yönetimi
minutes: 16
type: lesson
objectives:
  - cargo new ile bir proje oluşturup klasör yapısını ve Cargo.toml dosyasını açıklayabilmek
  - cargo check, build ve run komutlarını amaca göre seçebilmek
  - Debug ve release derlemeleri arasındaki farkı ve ne zaman hangisinin kullanılacağını açıklayabilmek
  - Cargo.lock dosyasının ve target klasörünün görevini açıklayabilmek
keywords: [cargo, cargo new, Cargo.toml, TOML, cargo build, cargo run, cargo check, release, Cargo.lock, target]
---

Tek bir `main.rs` dosyası için `rustc` yeterliydi. Peki projen on dosyaya, üç kütüphaneye ve beş
kişilik bir ekibe büyüdüğünde ne olacak? Her seferinde onlarca dosyayı doğru sırayla derleyen, doğru
kütüphane sürümlerini bulan uzun komutlar mı yazacaksın? Rust geliştiricileri bunun yerine tek bir
araca güvenir: **Cargo**. Bu derste onunla tanışıyorsun, ve neden Rust ekosisteminin en sevilen
parçalarından biri olduğunu göreceksin.

## Neden Cargo?

Gerçek bir yazılım projesi yalnızca kaynak koddan ibaret değildir. Projenin adı ve sürümü, kullandığı
kütüphaneler ve onların sürümleri, derleme ayarları, testler ve belgeler de yönetilmelidir. Cargo
bunların hepsini tek bir komut satırı aracında toplar:

- Yeni proje iskeleti oluşturur (`cargo new`).
- Projeyi derler ve çalıştırır (`cargo build`, `cargo run`).
- Kodu hızlıca denetler (`cargo check`).
- Kullandığın kütüphaneleri (**crate**'leri) internetten indirir ve derler (Modül 8).
- Testleri çalıştırır (`cargo test`, Modül 13) ve belge üretir (`cargo doc`).

Başka dillerde bu işler genellikle birden fazla araca dağılmıştır:

| Dil | Paket yöneticisi | Derleme aracı |
|---|---|---|
| JavaScript | npm | (çoğu zaman ayrıca bir paketleyici) |
| Python | pip | (yorumlanır; çoğu zaman gerekmez) |
| Java | Maven ya da Gradle | Maven ya da Gradle |
| C/C++ | Resmî bir tane yok (vcpkg, Conan...) | CMake, Make, MSBuild... |
| **Rust** | **Cargo** | **Cargo** |

Rust'ta her proje aynı yapıya ve aynı komutlara sahiptir. GitHub'dan indirdiğin herhangi bir Rust
projesini büyük olasılıkla tek komutla, `cargo run` ile çalıştırabilirsin.

:::analogy Şantiye şefi
`rustc` usta bir duvarcıdır: Kendisine verilen tuğlaları kusursuz örer. **Cargo** ise şantiye
şefidir: Projenin planını (`Cargo.toml`) okur, eksik malzemeleri (kütüphaneleri) sipariş eder,
duvarcıya işleri doğru sırayla verir ve neyin zaten bittiğini hatırlar. Sen şefle konuşursun; şef de
ustalarla.
:::

```quiz
question: |
  Aşağıdakilerden hangisi Cargo'nun görevlerinden **değildir**?
options:
  - Yeni bir proje iskeleti oluşturmak
  - Projenin kullandığı kütüphaneleri indirip derlemek
  - Projeyi derleyip çalıştırmak
  - Rust'ın kendisini yeni sürüme güncellemek
answer: 3
explanation: |
  Rust'ı (yani `rustc` ve `cargo`'nun kendisini) güncellemek **rustup**'ın işidir: `rustup update`.
  Cargo ise projeyle ilgili her şeyi yönetir: oluşturma, kütüphaneler, derleme, çalıştırma, test.
feedback:
  - Bu Cargo'nun işi, `cargo new`.
  - Bu da Cargo'nun işi; kütüphaneleri ileride Modül 8'de ekleyeceksin.
  - Bu da Cargo'nun işi, `cargo build` ve `cargo run`.
  - Doğru! Bu, `rustup update` ile yapılır.
```

## cargo new: ilk projen

Bir terminal aç, projelerini tuttuğun klasöre geç ve şunu yaz:

```console
PS C:\RustProjeleri> cargo new merhaba
    Creating binary (application) `merhaba` package
note: see more `Cargo.toml` keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
```

Cargo, `merhaba` adında bir klasör ve içinde hazır bir proje oluşturdu:

```text
merhaba/
├── .git/            ← bir git deposu (sürüm kontrolü)
├── .gitignore       ← git'in yok sayacağı dosyalar: /target
├── Cargo.toml       ← projenin kimlik kartı
└── src/
    └── main.rs      ← kaynak kodun
```

- **`src/`**: Bütün kaynak kodun bu klasörde yaşar. Cargo, `main`'i `src/main.rs` içinde arar.
- **`Cargo.toml`**: Projenin adı, sürümü ve kütüphaneleri (birazdan inceleyeceğiz).
- **`.git/`** ve **`.gitignore`**: Cargo projeni bir **git** deposu olarak da başlatır. Git,
  kodunun geçmişini kaydeden sürüm kontrol sistemidir; şimdilik bilmen gerekmiyor.

`src/main.rs` dosyasını aç. Cargo senin için ilk programı zaten yazmış:

```rust
fn main() {
    println!("Hello, world!");
}
```

Birkaç ek bilgi:

- **`cargo new --lib ad`** çalıştırılabilir bir program yerine bir **kütüphane** oluşturur;
  `main.rs` yerine `src/lib.rs` gelir (kütüphaneler Modül 8'de).
- **`cargo init`**, zaten var olan bir klasörü Cargo projesine dönüştürür.
- Proje adlarında boşluk ve Türkçe karakter kullanma; küçük harfler, rakamlar ve `_` ya da `-` yeter
  (ör. `hava_durumu`).

```quiz
question: |
  `cargo new hesap_makinesi` komutunu çalıştırdın. Programının `main` fonksiyonunu hangi dosyada
  bulursun?
options:
  - "`hesap_makinesi/main.rs`"
  - "`hesap_makinesi/src/main.rs`"
  - "`hesap_makinesi/Cargo.toml`"
  - "`hesap_makinesi/target/main.rs`"
answer: 1
explanation: |
  Cargo projelerinde kaynak kod `src/` klasöründe durur ve çalıştırılabilir programların başlangıç
  dosyası `src/main.rs`'dir. Proje klasörünün kökünde ise `Cargo.toml` bulunur.
feedback:
  - Kaynak kod proje kökünde değil, `src/` klasöründe durur.
  - Doğru!
  - "`Cargo.toml` kod değil, projenin ayar dosyasıdır."
  - "`target/` klasörü derleme çıktıları içindir ve henüz oluşmadı bile."
```

## Cargo.toml ve TOML

`Cargo.toml`, projenin **manifest** dosyasıdır, kimlik kartı diyebiliriz. `cargo new`'in ürettiği
hâli şöyledir:

```toml
[package]
name = "merhaba"
version = "0.1.0"
edition = "2024"

[dependencies]
```

Dosya **TOML** (*Tom's Obvious, Minimal Language*) biçiminde yazılır. TOML'un kuralları basittir:

- `[package]` gibi köşeli parantez içindeki satırlar **bölüm** (tablo) başlıklarıdır.
- `anahtar = "değer"` satırları ayarlardır. Metin değerleri **çift tırnak** içinde yazılır.
- `#` işaretinden sonrası yorumdur.

Satır satır inceleyelim:

- **`name`**, paketin adı. Çalıştırılabilir dosyanın adı da buradan gelir: `merhaba.exe`.
- **`version`**, paketin sürümü. `ana.ara.yama` biçimindeki bu numaralandırmaya **anlamsal
  sürümleme** (*semantic versioning*) denir; Modül 8'de inceleyeceğiz.
- **`edition`**, kodun hangi Rust **edisyonunun** kurallarıyla derleneceği. Rust, eski kodu bozmamak
  için büyük dil değişikliklerini edisyonlarla (2015, 2018, 2021, 2024) getirir. Bu kurs 2024
  edisyonunu kullanıyor.
- **`[dependencies]`**, projenin kullandığı kütüphaneler. Şimdilik boş.

İstersen başka alanlar da ekleyebilirsin. Bir dizi (*array*) köşeli parantezle yazılır:

```toml
[package]
name = "hava_durumu"
version = "0.1.0"
edition = "2024"
description = "Isparta için hava durumu bülteni"   # isteğe bağlı açıklama
keywords = ["hava", "bülten"]                       # dizi: köşeli parantez
license = "MIT"

[dependencies]
# Kullanacağın kütüphaneler buraya yazılır (Modül 8).
```

Şimdi bir Rust programıyla `Cargo.toml` yazdıralım. Bir yenilik var: Parantezlerin içi **boş** bir
`println!()`. Tahmin et:

```predict
question: |
  Bu program ne yazdırır? Üçüncü satırdaki boş `println!()`'e dikkat et.
code: |
  fn main() {
      println!("[package]");
      println!("name = \"merhaba\"");
      println!();
      println!("[dependencies]");
  }
options:
  - |
    [package]
    name = "merhaba"
    [dependencies]
  - |
    [package]
    name = "merhaba"

    [dependencies]
  - |
    [package]
    name = \"merhaba\"
    ()
    [dependencies]
answer: 1
explanation: |
  Boş `println!()` yalnızca bir satır sonu yazar, yani **boş bir satır** üretir. `\"` kaçış dizileri
  de ekranda düz tırnak olarak görünür. Böylece çıktı, gerçek `Cargo.toml` dosyasıyla birebir aynı
  olur.
```

```quiz
question: |
  Aşağıdakilerden hangisi **geçerli** bir TOML satırıdır?
options:
  - '`name = "merhaba"`'
  - '`name: "merhaba"`'
  - '`name = merhaba`'
  - '`name == "merhaba"`'
answer: 0
explanation: |
  TOML'da ayarlar `anahtar = "değer"` biçiminde yazılır: tek bir eşittir işareti ve çift tırnak
  içinde metin.
feedback:
  - Doğru!
  - İki nokta üst üste YAML ve JSON'da kullanılır; TOML'da `=` kullanılır.
  - TOML'da metin değerleri tırnak içinde yazılmalıdır.
  - Çift eşittir karşılaştırma için kullanılır; TOML'da tek `=` gerekir.
```

## build, run ve check

Proje klasörüne geç ve programı derle:

```console
PS C:\RustProjeleri> cd merhaba
PS C:\RustProjeleri\merhaba> cargo build
   Compiling merhaba v0.1.0 (C:\RustProjeleri\merhaba)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.58s
```

Çalıştırılabilir dosya `target\debug\merhaba.exe` konumuna yazıldı. Onu doğrudan çalıştırabilirsin,
ama pratikte derlemeyi ve çalıştırmayı tek adımda yapan `cargo run` kullanılır:

```console
PS C:\RustProjeleri\merhaba> cargo run
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.02s
     Running `target\debug\merhaba.exe`
Hello, world!
```

Bu kez `Compiling` satırı yok! Cargo kodun değişmediğini fark etti ve derlemeyi atladı. Kodu
değiştirirsen `cargo run` önce yeniden derler, sonra çalıştırır. 3. dersteki "eski `.exe`" sorununu
Cargo senin yerine çözer. Büyük projelerde Cargo yalnızca değişen kısımları yeniden derleyerek
(**artımlı derleme**, *incremental compilation*) de zaman kazandırır.

Bir de **`cargo check`** var:

```console
PS C:\RustProjeleri\merhaba> cargo check
    Checking merhaba v0.1.0 (C:\RustProjeleri\merhaba)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.21s
```

`cargo check` kodunu derleyicinin bütün denetimlerinden geçirir ama **makine kodu üretmez**. Bu
yüzden `cargo build`'den belirgin biçimde hızlıdır. Kod yazarken sık sık "derleniyor mu?" diye
bakmak için idealdir. (VS Code'daki rust-analyzer da kaydettiğinde arka planda tam olarak bunu
yapar.)

```text
cargo check  →  kodu denetle                          (en hızlı, .exe üretmez)
cargo build  →  denetle + makine kodu üret + bağla    (.exe üretir)
cargo run    →  gerekiyorsa derle + programı çalıştır
```

:::analogy Taslak okuması
`cargo check`, bir yazıyı matbaaya göndermeden önce yazım ve dil bilgisi denetiminden geçirmek
gibidir: Hızlıdır ve hataları yakalar. `cargo build` ise yazıyı gerçekten basar. Her cümleden sonra
kitabı bastırmazsın; önce taslağı denetlersin.
:::

Şimdilik elle hizaladığımız bir komut tablosu (6. derste bu hizalamayı Rust'a otomatik yaptırmayı
öğreneceksin):

```rust
fn main() {
    println!("+-----------------------+------------------------------+");
    println!("| Komut                 | Ne yapar?                    |");
    println!("+-----------------------+------------------------------+");
    println!("| cargo check           | Hızlı hata denetimi          |");
    println!("| cargo build           | Derler (target\\debug)        |");
    println!("| cargo run             | Derler ve çalıştırır         |");
    println!("| cargo build --release | Optimize ederek derler       |");
    println!("+-----------------------+------------------------------+");
}
```

```quiz
question: |
  Büyük bir projede bir değişiklik yaptın. Programı çalıştırmayacaksın; yalnızca kodun hâlâ
  derlenip derlenmediğini **olabildiğince hızlı** öğrenmek istiyorsun. Hangi komutu kullanırsın?
options:
  - "`cargo run`"
  - "`cargo build --release`"
  - "`cargo check`"
  - "`cargo new`"
answer: 2
explanation: |
  `cargo check` derleyicinin tüm denetimlerini yapar ama makine kodu üretmez; bu yüzden en hızlı
  geri bildirimi verir. Kod yazarken en sık kullanacağın komut budur.
feedback:
  - "`cargo run` hem derler hem çalıştırır; çalıştırmaya ihtiyacın yok."
  - Optimize ederek derlemek en **yavaş** seçenektir.
  - Doğru!
  - "`cargo new` yeni bir proje oluşturur."
```

## Debug ve release

`cargo build` çıktısındaki `dev` profile ve `unoptimized + debuginfo` ifadelerini fark ettin mi?
Cargo varsayılan olarak **debug** (hata ayıklama) modunda derler:

- **Debug** (`cargo build`, `cargo run`): Hızlı derlenir; program optimize edilmez ve hata ayıklama
  bilgileri içerir. Ek güvenlik kontrolleri de açıktır (örneğin tamsayı taşmalarını yakalar; Modül
  2). Geliştirme sırasında bunu kullanırsın.
- **Release** (`cargo build --release`, `cargo run --release`): Derleyici kodu optimize etmek için
  çok daha fazla çalışır; derleme daha uzun sürer ama ortaya çıkan program genellikle çok daha
  hızlıdır. Kullanıcılara dağıtacağın sürüm budur.

```console
PS C:\RustProjeleri\merhaba> cargo build --release
   Compiling merhaba v0.1.0 (C:\RustProjeleri\merhaba)
    Finished `release` profile [optimized] target(s) in 0.43s
```

İki derlemenin çıktıları `target` klasöründe ayrı ayrı durur:

```text
target/
├── debug/
│   └── merhaba.exe     ← cargo build / cargo run
└── release/
    └── merhaba.exe     ← cargo build --release
```

`target` klasörü zamanla büyür. **`cargo clean`** onu tamamen siler; bir sonraki derlemede yeniden
oluşur. `.gitignore` dosyasında `/target` yazmasının nedeni de budur: Derleme çıktıları her zaman
koddan yeniden üretilebilir, git'e eklenmez.

Bu program hangi modda derlendiğini söyler. `cfg!(debug_assertions)` debug derlemelerde `true`,
release derlemelerde `false` olur. (`{}` yer tutucusunu 5. derste öğreneceksin.)

```rust
fn main() {
    println!("Hata ayıklama kontrolleri açık mı? {}", cfg!(debug_assertions));
}
```

Rusteach kodunu debug modunda çalıştırır; bu yüzden `true` görürsün. Kendi projende
`cargo run --release` ile çalıştırırsan `false` yazar.

:::warning Hızı her zaman release'te ölç
"Rust programım yavaş çalışıyor!" diye düşünmeden önce `--release` ile derlediğinden emin ol.
Hesaplama ağırlıklı programlarda debug ve release arasında kat kat fark olabilir. Performans
ölçümleri yalnızca release derlemelerle anlamlıdır.
:::

```quiz
question: |
  Programını bitirdin ve arkadaşlarına dağıtacaksın. Hangi komutla derlemeli ve hangi dosyayı
  göndermelisin?
options:
  - "`cargo build` ve `target\\debug\\merhaba.exe`"
  - "`cargo build --release` ve `target\\release\\merhaba.exe`"
  - "`cargo check` ve `src\\main.rs`"
  - "`cargo run` ve `Cargo.toml`"
answer: 1
explanation: |
  Dağıtılacak programlar `--release` ile derlenir: Optimize edilmiş, daha hızlı çalışan sürüm
  `target\release\` klasörüne yazılır. Arkadaşlarının kaynak koda ya da Cargo'ya ihtiyacı yoktur;
  `.exe` dosyası yeterlidir.
feedback:
  - Çalışır ama optimize edilmemiş, yavaş sürümü göndermiş olursun.
  - Doğru!
  - "`cargo check` çalıştırılabilir dosya üretmez; kaynak kodu göndermek de arkadaşlarının Rust kurmasını gerektirir."
  - "`Cargo.toml` bir ayar dosyasıdır, program değil."
```

## Cargo.lock ve komut özeti

İlk derlemeden sonra proje klasöründe yeni bir dosya belirir: **`Cargo.lock`**.

```toml
# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "merhaba"
version = "0.1.0"
```

`Cargo.toml`'da bir kütüphane için "1.2 ya da uyumlu bir sürüm" gibi esnek bir istek yazarsın.
Cargo derleme sırasında hangi **tam** sürümü kullandığını `Cargo.lock`'a kaydeder. Böylece projeyi
bir ay sonra ya da başka bir bilgisayarda derlediğinde **birebir aynı** sürümler kullanılır.
Dosyanın ilk satırlarının dediği gibi, onu elle düzenleme; Cargo yönetir. Uygulama projelerinde
`Cargo.lock`'u kodunla birlikte git'e ekle.

:::analogy Alışveriş listesi ve fiş
`Cargo.toml` alışveriş listesidir: "1 litre süt" yazar, markasını tam belirtmez. `Cargo.lock` ise
kasadan aldığın **fiştir**: Hangi markanın hangi ürününü aldığını kesin olarak kaydeder. Aynı
alışverişi tekrarlamak istediğinde fişe bakarsın.
:::

Cargo, paket bilgilerini kodun içine de aktarır. Örneğin `env!("CARGO_PKG_NAME")` ve
`env!("CARGO_PKG_VERSION")`, `Cargo.toml`'daki `name` ve `version` değerlerini derleme sırasında
koda yerleştirir. Bu örneği kendi Cargo projende dene: `merhaba v0.1.0` yazar.

```rust,norun
fn main() {
    println!("{} v{}", env!("CARGO_PKG_NAME"), env!("CARGO_PKG_VERSION"));
}
```

| Komut | Ne yapar? |
|---|---|
| `cargo new ad` | `ad` klasöründe yeni bir program projesi oluşturur |
| `cargo new --lib ad` | Yeni bir kütüphane projesi oluşturur |
| `cargo check` | Kodu derleyicinin denetimlerinden geçirir, `.exe` üretmez |
| `cargo build` | Debug modunda derler → `target\debug` |
| `cargo run` | Gerekirse derler ve çalıştırır |
| `cargo build --release` | Optimize ederek derler → `target\release` |
| `cargo clean` | `target` klasörünü siler |

```quiz
question: |
  `Cargo.lock` dosyası ne işe yarar?
options:
  - Projenin adını ve edisyonunu tanımlar.
  - Derlemede kullanılan bütün kütüphanelerin tam sürümlerini kaydeder; böylece derlemeler her yerde aynı olur.
  - Başkalarının projeni değiştirmesini engelleyen bir kilittir.
  - Derlenmiş programı içerir.
answer: 1
explanation: |
  `Cargo.lock`, kullanılan her bağımlılığın **tam** sürümünü kaydeder. Projeyi başka bir bilgisayarda
  ya da aylar sonra derlediğinde aynı sürümler kullanılır; "bende çalışıyordu" sorunları azalır.
feedback:
  - Bu bilgiler `Cargo.toml`'da durur.
  - Doğru!
  - Adındaki "lock" (kilit) sürümleri kilitlemek içindir, dosyayı değil.
  - Derlenmiş program `target` klasöründedir.
```

Şimdi kaçış dizileri ve boş `println!()` ile bir `Cargo.toml` yazdır.

````exercise
id: m01-e-cargo-toml
title: Cargo.toml yazdır
difficulty: 2
prompt: |
  Bir arkadaşın `kutuphane` adında bir proje oluşturdu ve sürümünü `0.2.0` yaptı. Programın, bu
  projenin `Cargo.toml` dosyasını **tam olarak** şöyle yazdırmalı:

  ```text
  [package]
  name = "kutuphane"
  version = "0.2.0"
  edition = "2024"

  [dependencies]
  ```

  Tırnakları kaçış dizisiyle yaz, boş satır için boş bir `println!()` kullan.
starter: |
  fn main() {
      println!("[package]");
      // Geri kalan satırları ekle
  }
solution: |
  fn main() {
      println!("[package]");
      println!("name = \"kutuphane\"");
      println!("version = \"0.2.0\"");
      println!("edition = \"2024\"");
      println!();
      println!("[dependencies]");
  }
check: output
expected_output: |
  [package]
  name = "kutuphane"
  version = "0.2.0"
  edition = "2024"

  [dependencies]
hints:
  - |
    Altı satırlık bir çıktı var; boş satır dahil her satır için bir `println!` yaz.
  - |
    Metnin içindeki çift tırnak `\"` ile yazılır. Örneğin ikinci satır:
    `println!("name = \"kutuphane\"");`
  - |
    `edition` satırından sonra boş bir `println!();` ekle, ardından `println!("[dependencies]");`
    yaz.
explanation: |
  Her satır için bir `println!` kullandık; değerlerin etrafındaki tırnakları `\"` ile yazdık ve boş
  satırı parametresiz `println!()` ile ürettik. Çıktı, gerçek bir `Cargo.toml` dosyasının birebir
  aynısı: `[package]` bölümünde ad, sürüm ve edisyon; `[dependencies]` bölümü ise henüz boş.
````

## Özet

:::remember
- **Cargo**, Rust'ın derleme sistemi ve paket yöneticisidir; projeyle ilgili her işi yapar.
- **`cargo new ad`**: `Cargo.toml`, `src/main.rs`, `.gitignore` ve bir git deposu oluşturur.
- **`Cargo.toml`** (TOML biçiminde): `name`, `version`, `edition = "2024"` ve `[dependencies]`.
- **`cargo check`** en hızlı denetimdir; **`cargo build`** derler; **`cargo run`** derler ve
  çalıştırır.
- **Debug** geliştirme içindir (`target\debug`); **release** (`--release`) dağıtım ve hız ölçümü
  içindir (`target\release`).
- **`Cargo.lock`** tam sürümleri kaydeder, elle düzenlenmez. **`target`** derleme çıktılarıdır;
  `cargo clean` siler.
:::

```reflect
prompt: |
  Bir arkadaşın programını `cargo run` ile çalıştırıp süresini ölçmüş ve "Rust hızlı diye
  biliyordum, ama yavaşmış!" diyor. Ona ne söylersin?
answer: |
  Model cevap: `cargo run` varsayılan olarak **debug** modunda derler: Program optimize edilmez,
  hata ayıklama bilgileri ve ek kontroller içerir. Bu mod hızlı derlemek ve geliştirmek içindir.
  Performansı ölçmek için `cargo run --release` ya da `cargo build --release` kullanmalı; optimize
  edilmiş sürüm, hesaplama ağırlıklı programlarda kat kat hızlı olabilir.
```

```flashcards
- front: "`cargo new ad` neler oluşturur?"
  back: "`ad` klasöründe `Cargo.toml`, `src/main.rs` (Hello, world! programıyla), `.gitignore` ve bir git deposu."
- front: "`Cargo.toml` nedir?"
  back: Projenin TOML biçimindeki manifest dosyası. Adı, sürümü, edisyonu ve bağımlılıkları tanımlar.
- front: "`cargo build` ile `cargo run` arasındaki fark nedir?"
  back: "`cargo build` yalnızca derler; `cargo run` gerekirse derler ve programı çalıştırır."
- front: "`cargo check` ne zaman kullanılır?"
  back: Kodun derlenip derlenmediğini en hızlı şekilde görmek için. Bütün denetimleri yapar ama makine kodu üretmez.
- front: Debug ve release derlemelerinin farkı nedir?
  back: "Debug: hızlı derlenir, optimize edilmez, ek kontroller içerir (`target\\debug`). Release (`--release`): optimize edilir, daha hızlı çalışır (`target\\release`)."
- front: "`Cargo.lock` ne işe yarar?"
  back: Kullanılan bütün bağımlılıkların tam sürümlerini kaydeder; derlemeler her yerde aynı olur. Elle düzenlenmez.
- front: "`target` klasörü nedir?"
  back: Derleme çıktılarının tutulduğu klasör. Git'e eklenmez (`.gitignore`) ve `cargo clean` ile silinir.
- front: "`Cargo.toml`'daki `edition = \"2024\"` ne anlama gelir?"
  back: Kodun Rust'ın 2024 edisyonunun kurallarıyla derleneceğini.
```
