---
id: m24-l03
title: "FFI: C ile konuşmak"
minutes: 26
type: lesson
objectives:
  - "Edition 2024 sözdizimiyle `unsafe extern \"C\" { ... }` bloğu yazıp bir C fonksiyonunu (`abs`, `strlen`) çağırabilmek; öğeleri `safe fn` / `unsafe fn` olarak işaretleyebilmek"
  - "`CString` ve `CStr` ile Rust dizgileri ile C dizgileri arasında doğru ve güvenli dönüşüm yapabilmek"
  - "`#[unsafe(no_mangle)] pub extern \"C\" fn` ile bir Rust fonksiyonunu C'ye açabilmek ve C'ye geri çağırma (callback) fonksiyonu verebilmek"
  - "`#[repr(C)]`, bindgen ve cbindgen'in FFI'daki rolünü açıklayabilmek"
keywords: [FFI, extern "C", unsafe extern, safe fn, ABI, CString, CStr, "c\"...\"", no_mangle, repr(C), bindgen, cbindgen, callback, qsort]
---

Dünyadaki yazılımın büyük kısmı C ile konuşur. İşletim sistemi API'leri, SQLite, OpenSSL, zlib, ses ve
grafik kütüphaneleri... Hepsinin ortak dili **C ABI**'dir. Python'un `numpy`'ı, Node.js'in yerel modülleri,
Java'nın JNI'ı aynı kapıdan geçer. Rust da bu kapıyı kullanarak C kütüphanelerini çağırabilir ve kendi
fonksiyonlarını başka dillere açabilir. Buna **FFI (Foreign Function Interface, yabancı fonksiyon arayüzü)**
denir.

Bu derste, Rust Playground'un içinde zaten bulunan C standart kütüphanesinin (`libc`) fonksiyonlarını
gerçekten çağıracaksın: `abs`, `strlen`, `calloc`/`free` ve hatta bir Rust fonksiyonunu geri çağırma olarak
kullanan `qsort`.

## ABI: iki dilin ortak protokolü

Bir fonksiyon çağrısı makine seviyesinde bir **protokoldür**: argümanlar hangi yazmaçlara (register) ya da
stack'in neresine konur, dönüş değeri nereden okunur, stack'i kim temizler? Bu kurallar bütününe
**ABI (Application Binary Interface, uygulama ikili arayüzü)** denir.

Rust'ın kendi ABI'si **kararlı değildir (unstable)**: derleyici sürümleri arasında değişebilir, çünkü Rust
optimizasyon için özgür kalmak ister. C'nin ABI'si ise her platformda onlarca yıldır sabittir. Bu yüzden
diller arası köprü kurulurken herkes C'nin protokolünü konuşur: `extern "C"` bunu söyler.

:::analogy Uluslararası toplantıda ortak dil
Türk, Japon ve Brezilyalı mühendisler bir toplantıda buluşuyor. Herkes kendi ana dilinde çok daha akıcı,
ama ortak bir dil seçmek zorundalar: İngilizce. Kimsenin ana dili değil, ama herkes biliyor ve kuralları
değişmiyor. C ABI yazılım dünyasının o ortak dilidir. `extern "C"` demek, "bu fonksiyonla ortak dilde
konuşacağız" demektir. Rust kendi içinde (Rust ABI'siyle) daha rahat konuşur, ama dışarıyla İngilizceye geçer.
:::

```quiz
question: "`extern \"C\"` ifadesindeki `\"C\"` neyi belirtir?"
options:
  - Fonksiyonun C dilinde yazılmış olması gerektiğini
  - Fonksiyonun çağrılırken C'nin çağrı kurallarını (ABI) kullanacağını
  - Fonksiyonun yalnızca C derleyicisiyle derlenebileceğini
  - Fonksiyonun güvenli olmadığını
answer: 1
explanation: |
  `"C"` bir **ABI** adıdır: argümanların ve dönüş değerinin nasıl taşınacağını belirler. Fonksiyonun
  hangi dilde yazıldığı önemli değil; C++, Zig, Go ya da Rust'ın kendisi olabilir, yeter ki C çağrı
  kurallarına uysun. Bu derste bir Rust fonksiyonunu `extern "C"` ile tanımlayıp C'nin `qsort`'una
  vereceğiz.
feedback:
  - "Hayır; Zig, C++ ya da Rust'ta yazılmış bir fonksiyon da C ABI'siyle dışa açılabilir."
  - "Doğru!"
  - "Derleyiciyle ilgisi yok; ikili seviyedeki çağrı protokolünü belirtir."
  - "Güvenlik `unsafe` ile ilgili; `extern \"C\"` sadece çağrı biçimini söyler."
```

## C fonksiyonu çağırmak: unsafe extern "C"

C standart kütüphanesindeki `abs` fonksiyonunun C bildirimi `int abs(int x);` şeklindedir. Rust'ta bunu bir
**`unsafe extern "C"` bloğu** içinde bildiririz:

```rust
use std::ffi::{c_int, c_long};

unsafe extern "C" {
    // `safe` ile işaretlenen öğe güvenli koddan doğrudan çağrılabilir.
    safe fn abs(x: c_int) -> c_int;
    // İşaretsiz öğeler varsayılan olarak `unsafe fn`'dir.
    fn labs(x: c_long) -> c_long;
}

fn main() {
    println!("abs(-42) = {}", abs(-42)); // unsafe blok gerekmez

    // SAFETY: imza C'deki `long labs(long)` ile aynı; -7 geçerli bir girdi.
    let n = unsafe { labs(-7) };
    println!("labs(-7) = {n}");
}
```

Burada üç önemli nokta var:

1. **Blok neden `unsafe`?** Derleyici C kodunu göremez; `abs`'in gerçekten `int` alıp `int` döndürdüğünü
   kontrol edemez. Yanlış bir imza yazarsan (örneğin `fn abs(x: f64) -> f64`) program derlenir ama çalışma
   anında yanlış yazmaçları okur: UB. Edition 2024'te blok başındaki `unsafe` kelimesi tam bu sözü verir:
   "Bu bildirimlerin C tarafıyla birebir uyuştuğunu ben garanti ediyorum."
2. **`safe fn` / `unsafe fn`**: Bildirim doğruysa ve C fonksiyonu **her girdi için** tanımlı davranıyorsa
   onu `safe fn` diye işaretleyebilirsin. İşaretlenmeyenler (ya da açıkça `unsafe fn` yazılanlar)
   çağrılırken `unsafe` blok ister. `strlen` gibi işaretçi alan fonksiyonlar asla `safe` olamaz. Küçük ama
   öğretici bir istisna: C standardına göre `abs(INT_MIN)` **tanımsızdır**, çünkü `2147483648` bir `int`'e
   sığmaz. Bu derste kısalık için `abs`'i `safe` bildiriyoruz; titiz bir bağlamada ya `unsafe fn` bırakılır ya
   da sarmalayıcı `i32::MIN`'i baştan reddeder. Modülün boss sınavında tam olarak bunu yapacaksın.
3. **C tipleri**: `std::ffi::c_int`, `c_char`, `c_long`, `c_double` gibi tipler, C'deki tiplerin o
   platformdaki karşılıklarıdır. `int` çoğu platformda `i32` olsa da garanti değildir; taşınabilir kod
   için `c_int` kullan. Bu fark `long`'da gerçekten ortaya çıkar: `c_long` 64 bit Linux'ta `i64`, Windows'ta
   ise `i32`'dir. `labs`'ı `i64` ile bildirseydin kod Linux'ta çalışır, Windows'ta sessizce bozulurdu.

Eski edition'lardaki `extern "C" { ... }` yazımı edition 2024'te hata verir:

:::error
```text
error: extern blocks must be unsafe
 --> src/main.rs:1:1
  |
1 | / extern "C" {
2 | |     fn abs(x: i32) -> i32;
3 | | }
  | | ^ help: needs `unsafe` before the extern keyword: `unsafe`
  | |_|
  |
```
Çözüm derleyicinin önerisi: bloğun başına `unsafe` ekle. Eski kodu taşırken `cargo fix --edition` bunu
otomatik yapar (Modül 16).
:::

```compiles
code: |
  unsafe extern "C" {
      fn abs(x: i32) -> i32;
  }

  fn main() {
      println!("{}", abs(-5));
  }
answer: false
error: E0133
explanation: |
  `abs` bloğun içinde `safe` olarak işaretlenmediği için varsayılan olarak bir `unsafe fn`'dir. Onu çağırmak
  süper güç #2'dir ve `unsafe { abs(-5) }` gerektirir. Ya da bildirimi `safe fn abs(x: i32) -> i32;`
  olarak değiştirirsin; tek tehlikeli girdisi `i32::MIN` olduğu için bu pratikte yaygın bir seçimdir (yukarıdaki
  notu unutmadan).
```

:::info Kütüphaneye bağlanmak (linking)
`abs`, `strlen`, `qsort` C standart kütüphanesindedir ve Rust'ın std'si Linux'ta ona zaten bağlanır; bu
yüzden Playground'da ek ayar gerekmez. Başka bir kütüphane için (örneğin SQLite) bağlayıcıya (linker) adını
söylemelisin:

```rust,ignore
#[link(name = "sqlite3")]
unsafe extern "C" {
    fn sqlite3_libversion() -> *const std::ffi::c_char;
}
```

Gerçek projelerde bu ayar genellikle bir `build.rs` derleme betiğiyle yapılır ve `libsqlite3-sys` gibi
`-sys` son ekli crate'lere konur (bu dersin sonunda göreceğiz).
:::

## C dizgileri: CString ve CStr

Rust ile C dizgileri çok farklıdır:

| | Rust `&str` / `String` | C `char*` |
|-|------------------------|-----------|
| Uzunluk | işaretçinin yanında saklanır (fat pointer) | yoktur; sonu `\0` baytı ile işaretlenir |
| İçinde `\0` olabilir mi? | Evet | Hayır (dizgiyi orada bitirir) |
| Kodlama | her zaman geçerli UTF-8 | herhangi bir bayt dizisi |

Bu yüzden Rust'ın iki köprü tipi vardır (ikisi de `std::ffi` içinde):

- **`CString`**, sahipli (owned), sonunda `\0` olan, heap'te bir C dizgisi. `String`'in C karşılığı.
  Rust'tan C'ye dizgi **gönderirken** kullanılır.
- **`&CStr`**, ödünç alınmış bir C dizgisi. `&str`'nin C karşılığı. C'den gelen bir `*const c_char`'ı
  **okurken** ya da `c"..."` literal'leriyle kullanılır.

```rust
use std::ffi::{CStr, CString, c_char};

unsafe extern "C" {
    fn strlen(s: *const c_char) -> usize;
}

fn main() {
    // Rust → C: CString::new sonuna \0 ekler. İçeride \0 varsa Err döner.
    let selam = CString::new("merhaba").expect("içinde \\0 yok");
    // SAFETY: `selam` geçerli, \0 ile biten bir C dizgisi ve bu satır boyunca yaşıyor.
    let n = unsafe { strlen(selam.as_ptr()) };
    println!("strlen = {n}");

    // c"..." literal'i derleme zamanında \0 eklenmiş bir &CStr üretir (Rust 1.77+).
    let sehir: &CStr = c"Ankara";
    println!("{} bayt", unsafe { strlen(sehir.as_ptr()) });

    // C → Rust: ham işaretçiden &CStr, oradan &str
    // SAFETY: işaretçi `selam`'dan geliyor; geçerli ve \0 ile bitiyor.
    let geri: &CStr = unsafe { CStr::from_ptr(selam.as_ptr()) };
    println!("geri = {:?}", geri.to_str()); // to_str UTF-8 kontrolü yapar

    println!("{:?}", CString::new("a\0b"));
}
```

```memory
title: CString bellekte
steps:
  - caption: "`CString` sahibi olduğu baytları heap'te tutar ve sonuna **bir \\0 baytı** ekler. `as_ptr()` ilk baytın adresini verir."
    stack:
      - frame: main
        vars:
          - { name: selam, type: CString, value: "ptr · len=8", to: h1 }
          - { name: "selam.as_ptr()", type: "*const c_char", value: "adres", to: h1, note: "C'ye giden işaretçi" }
    heap:
      - { id: h1, value: "m e r h a b a \\0", label: "8 bayt" }
  - caption: "`strlen` uzunluğu bilmez: işaretçiden başlayıp `\\0`'a kadar sayar → 7. `\\0` yoksa belleğin sonuna kadar okumaya devam ederdi!"
    stack:
      - frame: main
        vars:
          - { name: selam, type: CString, value: "ptr · len=8", to: h1 }
          - { name: n, type: usize, value: "7" }
    heap:
      - { id: h1, value: "m e r h a b a \\0", label: "8 bayt" }
```

Modül 9'u hatırla: Türkçe karakterler UTF-8'de birden fazla bayttır. Tahmin et:

```predict
code: |
  use std::ffi::CString;

  fn main() {
      let c = CString::new("çay").unwrap();
      println!("{}", c.as_bytes().len());
      println!("{}", c.as_bytes_with_nul().len());
  }
options:
  - |
    3
    4
  - |
    4
    5
  - |
    4
    4
  - |
    3
    3
answer: 1
explanation: |
  `ç` UTF-8'de 2 bayttır, `a` ve `y` birer bayt: toplam **4 bayt** (Modül 9). `as_bytes()` sondaki `\0`'ı
  saymaz; `as_bytes_with_nul()` sayar: **5**. C tarafındaki `strlen` de 4 döndürür, çünkü C "karakter"
  değil **bayt** sayar. Kullanıcıya gösterilecek karakter sayısı lazımsa Rust tarafında `chars().count()` gerekir.
```

En sık yapılan FFI hatalarından biri **geçici (temporary) bir `CString`'in işaretçisini** saklamaktır:

```rust
use std::ffi::{CString, c_char};

unsafe extern "C" {
    fn strlen(s: *const c_char) -> usize;
}

fn main() {
    // YANLIŞ (yorumda): CString ifadenin sonunda drop edilir, p sarkan kalır.
    // let p = CString::new("merhaba").unwrap().as_ptr();

    // DOĞRU: CString'i bir değişkene bağla; işaretçi kullanıldığı sürece yaşasın.
    let sahip = CString::new("merhaba").unwrap();
    let p = sahip.as_ptr();
    println!("{}", unsafe { strlen(p) });
}
```

Yorum satırındaki yanlış hâli derlersen, derleyici seni bir **uyarıyla** durdurmaya çalışır:

:::error Uyarı: dangling_pointers_from_temporaries
```text
warning: this creates a dangling pointer because temporary `CString` is dropped at end of statement
 --> src/main.rs:8:46
  |
8 |     let p = CString::new("merhaba").unwrap().as_ptr();
  |             -------------------------------- ^^^^^^ pointer created here
  |             |
  |             this `CString` is dropped at end of statement
  |
  = help: bind the `CString` to a variable such that it outlives the pointer returned by `as_ptr`
  = note: a dangling pointer is safe, but dereferencing one is undefined behavior
```
Sadece bir **uyarı**: kod derlenir ve çalışır. Bazen tesadüfen `7` yazar, bazen de anlamsız bir sayı
(bu dersi hazırlarken Playground'da `5` çıktı). Çünkü heap belleği serbest bırakılmıştır; `strlen` o
belleği okurken araya başka bir tahsis girmiş ya da bellek yöneticisi orayı kendi kayıtları için
kullanmış olabilir. Sonuç tamamen rastgeledir. FFI'da uyarıları asla görmezden gelme.
:::

```exercise
id: m24-e-c-uzunluk
title: strlen için güvenli bir sarmalayıcı
difficulty: 2
prompt: |
  Bir C kütüphanesine dizgi gönderen bir uygulama yazıyorsun. Önce basit bir sarmalayıcı (wrapper) ile
  başla: `c_uzunluk(s)` fonksiyonu Rust dizgisini bir C dizgisine çevirsin ve C'nin `strlen` fonksiyonuyla
  uzunluğunu ölçsün.

  - Dizginin içinde `\0` varsa C dizgisine çevrilemez: `None` döndür.
  - Aksi hâlde `Some(strlen sonucu)` döndür.
  - Uzunluğu Rust tarafında `.len()` ile hesaplama; gerçekten `strlen`'i çağır.
starter: |
  use std::ffi::{CString, c_char};

  unsafe extern "C" {
      fn strlen(s: *const c_char) -> usize;
  }

  fn c_uzunluk(s: &str) -> Option<usize> {
      todo!()
  }

  fn main() {
      println!("{:?}", c_uzunluk("Eskişehir"));
      println!("{:?}", c_uzunluk("kötü\0dizgi"));
  }
solution: |
  use std::ffi::{CString, c_char};

  unsafe extern "C" {
      fn strlen(s: *const c_char) -> usize;
  }

  fn c_uzunluk(s: &str) -> Option<usize> {
      let c = CString::new(s).ok()?;
      // SAFETY: `c` geçerli, \0 ile biten bir C dizgisi ve strlen çağrısı
      // boyunca yaşıyor; strlen işaretçiyi saklamaz.
      Some(unsafe { strlen(c.as_ptr()) })
  }

  fn main() {
      println!("{:?}", c_uzunluk("Eskişehir"));
      println!("{:?}", c_uzunluk("kötü\0dizgi"));
  }
check: tests
tests: |
  #[test]
  fn ascii_dizgi() {
      assert_eq!(c_uzunluk("merhaba"), Some(7), "\"merhaba\" 7 bayttır");
  }

  #[test]
  fn turkce_karakterler_bayt_sayilir() {
      assert_eq!(c_uzunluk("çay"), Some(4), "strlen bayt sayar: 'ç' 2 bayttır, toplam 4");
      assert_eq!(c_uzunluk("Eskişehir"), Some(10), "'ş' 2 bayt: toplam 10");
  }

  #[test]
  fn bos_dizgi() {
      assert_eq!(c_uzunluk(""), Some(0), "boş dizgi geçerli bir C dizgisidir (sadece \\0)");
  }

  #[test]
  fn ic_nul_none_doner() {
      assert_eq!(c_uzunluk("a\0b"), None, "içinde \\0 olan dizgi C dizgisine çevrilemez");
      assert_eq!(c_uzunluk("\0"), None);
  }
hints:
  - "`CString::new(s)` bir `Result` döndürür; içinde `\\0` varsa `Err` olur. `.ok()` onu `Option`'a çevirir (Modül 10)."
  - "`let c = CString::new(s).ok()?;`, `?` `None` gelirse fonksiyondan hemen `None` ile çıkar."
  - "Son satır: `Some(unsafe { strlen(c.as_ptr()) })`. `c` bir değişkene bağlı olduğu için işaretçi sarkmaz."
forbid:
  - pattern: "\\.len\\(\\)"
    message: "Uzunluğu Rust'ın `.len()`'i ile değil, C'nin `strlen`'i ile ölç!"
require:
  - pattern: "strlen\\s*\\("
    message: "`strlen`'i çağırmalısın."
  - pattern: "CString::new"
    message: "Dizgiyi `CString::new` ile C dizgisine çevir."
explanation: |
  `CString::new` iki işi birden yapar: içeride `\0` olup olmadığını kontrol eder ve sona `\0` ekler. Bu,
  C tarafının dizginin nerede bittiğini bilebilmesinin tek yoludur. `.ok()?` kalıbı Modül 10'dan: `Result`'ı
  `Option`'a çevirip hata durumunda erken dönmek.

  `c`'yi bir değişkene bağlamak kritik. `strlen(CString::new(s).ok()?.as_ptr())` gibi tek satırlık bir
  yazım burada aslında çalışırdı (geçici değer çağrı bitene kadar yaşar), ama işaretçiyi bir değişkende
  saklamaya başladığın an sarkan işaretçi hatasına dönüşür. Alışkanlık olarak sahibi adlandır.

  Bu fonksiyon **güvenli bir soyutlamadır**: kullanıcısı hiç `unsafe` yazmaz, hiçbir girdiyle UB oluşmaz.
  `rusqlite`, `openssl` gibi crate'lerin binlerce fonksiyonu tam olarak bu kalıpla yazılmıştır.
```

## Rust'ı C'ye açmak: no_mangle ve extern "C" fn

Ters yön: bir C programının (ya da Python'un, Node.js'in) **senin Rust fonksiyonunu** çağırmasını istiyorsun.
İki şey gerekir:

1. Fonksiyonun C ABI'siyle çağrılabilmesi → `extern "C" fn`
2. Bağlayıcının fonksiyonu **tahmin edilebilir bir adla** bulabilmesi → `#[unsafe(no_mangle)]`

Rust derleyicisi normalde her fonksiyon adını **süsler (name mangling)**: `topla` fonksiyonu nesne
dosyasında `_ZN10playground5topla17h3f1c0a9e5b2d7c41E` gibi bir sembole dönüşür. Böylece farklı
modüllerdeki ya da crate'lerdeki aynı adlı fonksiyonlar çakışmaz. C ise süsleme yapmaz; sembol adı
fonksiyon adının kendisidir. `no_mangle` süslemeyi kapatır:

```rust
#[unsafe(no_mangle)]
pub extern "C" fn sicaklik_donustur(celsius: f64) -> f64 {
    celsius * 9.0 / 5.0 + 32.0
}

fn main() {
    // Rust'tan da normal bir fonksiyon gibi çağrılabilir; bu güvenlidir.
    println!("25 °C = {} °F", sicaklik_donustur(25.0));
}
```

C tarafında bu fonksiyon şu bildirimle kullanılır (genellikle bir `.h` başlık dosyasında):

```c
double sicaklik_donustur(double celsius);
```

Projeyi C'ye kütüphane olarak vermek için `Cargo.toml`'da crate tipi belirtilir:

```toml
[lib]
crate-type = ["cdylib"]      # .so / .dll / .dylib (dinamik kütüphane)
# crate-type = ["staticlib"] # .a / .lib (statik kütüphane)
```

`no_mangle` neden edition 2024'te `unsafe(...)` ile yazılıyor? Çünkü süslenmemiş bir sembol **küresel bir
addır**: başka bir kütüphanede de `malloc` ya da `sicaklik_donustur` adında bir sembol varsa, hangisinin
çağrılacağı belirsizleşir. Kendi fonksiyonuna yanlışlıkla `malloc` adını verirsen, programdaki **bütün**
bellek tahsisleri senin fonksiyonuna gidebilir. Derleyici bunu kontrol edemez.

:::error
```text
error: unsafe attribute used without unsafe
 --> src/main.rs:1:3
  |
1 | #[no_mangle]
  |   ^^^^^^^^^ usage of unsafe attribute
  |
help: wrap the attribute in `unsafe(...)`
  |
1 | #[unsafe(no_mangle)]
  |   +++++++         +
```
Aynı kural `#[export_name = "..."]` ve `#[link_section = "..."]` nitelikleri için de geçerlidir.
:::

```quiz
question: "Edition 2024'te `#[no_mangle]` niteliği neden `#[unsafe(no_mangle)]` olarak yazılmak zorunda?"
options:
  - "Çünkü süslenmemiş fonksiyonlar her zaman ham işaretçi kullanır"
  - "Çünkü süslenmemiş sembol küresel bir addır; başka bir sembolle (ör. `malloc`) çakışırsa tanımsız davranış oluşur ve derleyici bunu kontrol edemez"
  - "Çünkü `no_mangle` fonksiyonu otomatik olarak `unsafe fn` yapar"
  - "Çünkü C fonksiyonları Rust'tan çağrılamaz"
answer: 1
explanation: |
  `unsafe(...)` niteliğin kendisinin bir söz olduğunu gösterir: "Bu sembol adının programdaki başka
  hiçbir sembolle çakışmadığını garanti ediyorum." Fonksiyonun kendisi güvenli kalır; Rust'tan `unsafe`
  olmadan çağırabilirsin.
feedback:
  - "Fonksiyonun gövdesiyle ilgisi yok; mesele sembol adı."
  - "Doğru!"
  - "Hayır; `sicaklik_donustur` örneğinde gördüğün gibi Rust'tan güvenle çağrılabiliyor."
  - "Çağrılabilir; `abs` ve `strlen` ile yaptık."
```

### Geri çağırma (callback): C'ye Rust fonksiyonu vermek

Bazı C fonksiyonları parametre olarak **fonksiyon işaretçisi** alır. Klasik örnek, C'nin genel amaçlı
sıralama fonksiyonu `qsort`'tur: neyin neyden küçük olduğunu senin vereceğin bir karşılaştırma
fonksiyonuna sorar. Bu fonksiyon C'den çağrılacağı için `extern "C" fn` olmalıdır:

```rust
use std::ffi::{c_int, c_void};

unsafe extern "C" {
    fn qsort(
        taban: *mut c_void,
        eleman_sayisi: usize,
        eleman_boyutu: usize,
        karsilastir: extern "C" fn(*const c_void, *const c_void) -> c_int,
    );
}

// C, iki elemanın adresini tipsiz (`void*`) işaretçiler olarak verir.
extern "C" fn artan(a: *const c_void, b: *const c_void) -> c_int {
    // SAFETY: qsort bu fonksiyonu yalnızca bizim verdiğimiz i32 dizisinin
    // elemanlarını gösteren geçerli işaretçilerle çağırır.
    let (x, y) = unsafe { (*(a as *const i32), *(b as *const i32)) };
    x.cmp(&y) as c_int // Ordering: Less = -1, Equal = 0, Greater = 1
}

fn main() {
    let mut yaslar = [34, 7, 19, 52, 7];
    // SAFETY: taban, eleman sayısı ve boyutu aynı geçerli i32 dizisini tarif ediyor;
    // `artan` bu tipe uygun bir karşılaştırma fonksiyonu.
    unsafe {
        qsort(
            yaslar.as_mut_ptr() as *mut c_void,
            yaslar.len(),
            size_of::<i32>(),
            artan,
        );
    }
    println!("{yaslar:?}");
}
```

`c_void` C'deki `void`'in karşılığıdır; `*mut c_void` "herhangi bir şeyi gösteren işaretçi" demektir.
`std::mem::size_of::<i32>()` (prelude'da `size_of` olarak da kullanılabilir) bir `i32`'nin bayt boyutunu
verir; 5. derste ayrıntılı göreceğiz.

:::warning Panik C sınırını geçemez
`extern "C" fn` içinde panik olursa, yığın çözülmesi (unwinding) C kodunun içinden geçemez. Rust 1.81'den
beri bu durumda program "panic in a function that cannot unwind" mesajıyla **hemen sonlandırılır (abort)**.
C'ye verdiğin fonksiyonlarda `unwrap()` ve indeksleme gibi panik kaynaklarından kaçın; hataları dönüş
değeriyle bildir. Paniğin C sınırını geçmesi gerçekten gerekiyorsa `extern "C-unwind"` ABI'si vardır.
:::

```exercise
id: m24-e-qsort-azalan
title: Sınav notlarını C'nin qsort'u ile büyükten küçüğe sırala
difficulty: 3
prompt: |
  Okulun eski bir C kütüphanesi notları `qsort` ile sıralıyor. Senden istenen, **büyükten küçüğe**
  sıralama yapan `azalan` karşılaştırma fonksiyonunu yazmak. `notlari_sirala` hazır; sadece `azalan`'ı
  doldur.

  qsort'un sözleşmesi: karşılaştırma fonksiyonu, `a` `b`'den **önce** gelmeliyse negatif, eşitse 0, sonra
  gelmeliyse pozitif bir değer döndürür.

  - İşaretçileri `*const i32`'ye çevirip değerleri `unsafe` blokta oku.
  - Fonksiyon panik yapmamalı (C sınırında panik = program sonlanır).
starter: |
  use std::ffi::{c_int, c_void};

  unsafe extern "C" {
      fn qsort(
          taban: *mut c_void,
          eleman_sayisi: usize,
          eleman_boyutu: usize,
          karsilastir: extern "C" fn(*const c_void, *const c_void) -> c_int,
      );
  }

  extern "C" fn azalan(a: *const c_void, b: *const c_void) -> c_int {
      todo!()
  }

  fn notlari_sirala(notlar: &mut [i32]) {
      // SAFETY: taban/sayı/boyut aynı geçerli i32 dilimini tarif ediyor.
      unsafe {
          qsort(notlar.as_mut_ptr() as *mut c_void, notlar.len(), size_of::<i32>(), azalan);
      }
  }

  fn main() {
      let mut notlar = [65, 90, 45, 90, 78];
      notlari_sirala(&mut notlar);
      println!("{notlar:?}");
  }
solution: |
  use std::ffi::{c_int, c_void};

  unsafe extern "C" {
      fn qsort(
          taban: *mut c_void,
          eleman_sayisi: usize,
          eleman_boyutu: usize,
          karsilastir: extern "C" fn(*const c_void, *const c_void) -> c_int,
      );
  }

  extern "C" fn azalan(a: *const c_void, b: *const c_void) -> c_int {
      // SAFETY: qsort yalnızca bizim i32 dilimimizin elemanlarını gösteren
      // geçerli, hizalı işaretçilerle çağırır.
      let (x, y) = unsafe { (*(a as *const i32), *(b as *const i32)) };
      y.cmp(&x) as c_int // ters karşılaştırma: büyük olan önce gelir
  }

  fn notlari_sirala(notlar: &mut [i32]) {
      // SAFETY: taban/sayı/boyut aynı geçerli i32 dilimini tarif ediyor.
      unsafe {
          qsort(notlar.as_mut_ptr() as *mut c_void, notlar.len(), size_of::<i32>(), azalan);
      }
  }

  fn main() {
      let mut notlar = [65, 90, 45, 90, 78];
      notlari_sirala(&mut notlar);
      println!("{notlar:?}");
  }
check: tests
tests: |
  #[test]
  fn buyukten_kucuge_siralar() {
      let mut v = [65, 90, 45, 90, 78];
      notlari_sirala(&mut v);
      assert_eq!(v, [90, 90, 78, 65, 45], "notlar büyükten küçüğe sıralanmalı");
  }

  #[test]
  fn negatif_ve_buyuk_sayilar() {
      let mut v = vec![-5, 1_000_000, 0, -1_000_000, 42];
      notlari_sirala(&mut v);
      assert_eq!(v, vec![1_000_000, 42, 0, -5, -1_000_000]);
  }

  #[test]
  fn karsilastirma_isareti_dogru() {
      let a = 10;
      let b = 20;
      let pa = &raw const a as *const c_void;
      let pb = &raw const b as *const c_void;
      assert!(azalan(pa, pb) > 0, "10, 20'den SONRA gelmeli: pozitif değer beklenir");
      assert!(azalan(pb, pa) < 0, "20, 10'dan ÖNCE gelmeli: negatif değer beklenir");
      assert_eq!(azalan(pa, pa), 0, "eşit değerler için 0 beklenir");
  }

  #[test]
  fn bos_ve_tek_eleman() {
      let mut bos: [i32; 0] = [];
      notlari_sirala(&mut bos);
      let mut tek = [7];
      notlari_sirala(&mut tek);
      assert_eq!(tek, [7]);
  }
hints:
  - "Önce değerleri oku: `let x = unsafe { *(a as *const i32) };` ve aynısını `b` için yap."
  - "Artan sıralama `x.cmp(&y)` olurdu. Azalan için karşılaştırmayı **tersine** çevir."
  - "`Ordering`'i C tamsayısına çevirmek için `as c_int` yeterli: `y.cmp(&x) as c_int`."
forbid:
  - pattern: "\\.sort|\\.reverse\\("
    message: "Sıralamayı Rust'ın `sort`'u ile değil, C'nin `qsort`'u ile yap!"
  - pattern: "y\\s*-\\s*x|x\\s*-\\s*y"
    message: "Çıkarma (`y - x`) büyük sayılarda taşabilir; `cmp` kullan."
require:
  - pattern: "as\\s+\\*const\\s+i32"
    message: "Tipsiz işaretçiyi `as *const i32` ile `i32` işaretçisine çevirmelisin."
explanation: |
  `y.cmp(&x)` karşılaştırmayı tersine çevirir: `x` büyükse `Less` (−1) döner ve qsort onu öne koyar.
  `Ordering` alanları olmayan bir enum'dur ve değerleri tam olarak −1, 0, 1'dir; bu yüzden `as c_int`
  güvenli bir dönüşümdür.

  Neden `y - x` yasak? C dünyasında çok yaygın bir kalıp, ama `i32::MIN` ve `i32::MAX` gibi değerlerde
  **taşar**: debug derlemede panik verir (C sınırında panik = abort), release'de ise yanlış işaret
  üretir (Modül 2). `cmp` her zaman doğrudur.

  Tipsiz `*const c_void`'i `*const i32`'ye çevirmek bir söz: "Bu adreste gerçekten bir i32 var." qsort'a
  `size_of::<i32>()` verdiğimiz için bu söz tutulur. Yanlış boyut verseydik (örneğin 8), qsort elemanların
  ortasını gösteren işaretçilerle çağırırdı: UB. Gerçek hayatta tabii ki `notlar.sort_by(|a, b| b.cmp(a))`
  yazarsın; ama bir C kütüphanesi senden geri çağırma istediğinde artık ne yapacağını biliyorsun.
```

## repr(C), RAII sarmalayıcılar ve araçlar

C'ye struct gönderirken alanların **bellekteki sırası ve hizası** C'ninkiyle aynı olmalıdır. Rust varsayılan
olarak alanların sırasını kendi seçer (yer kazanmak için yeniden dizebilir); `#[repr(C)]` "bu struct'ı tam
C'nin yaptığı gibi diz" der:

```rust
#[repr(C)]
pub struct Nokta {
    pub x: f64,
    pub y: f64,
}

#[unsafe(no_mangle)]
pub extern "C" fn orta_nokta(a: Nokta, b: Nokta) -> Nokta {
    Nokta { x: (a.x + b.x) / 2.0, y: (a.y + b.y) / 2.0 }
}
```

`repr(C)` olmayan bir struct'ı C'ye göndermek, alan sırası tesadüfen tutarsa çalışır, tutmazsa sessizce
yanlış değerler okunur. Bellek düzenini 5. derste derinlemesine inceleyeceğiz.

C kaynakları (dosya tanıtıcıları, bağlantılar, tahsis edilen bellek) genellikle bir "aç" ve bir "kapat"
fonksiyonu çiftiyle gelir. Rust'ta bunun idiomatik karşılığı, Modül 17'deki **`Drop`** ile bir **RAII
sarmalayıcıdır**: kapat fonksiyonunu çağırmayı unutmak imkânsız hâle gelir.

```rust
use std::ffi::c_void;

unsafe extern "C" {
    fn calloc(adet: usize, boyut: usize) -> *mut c_void;
    fn free(p: *mut c_void);
}

/// C'nin `calloc`'u ile heap'te tahsis edilmiş, sıfırla doldurulmuş bir bayt tamponu.
struct CTampon {
    ptr: *mut u8, // DEĞİŞMEZ: null değil, `boyut` baytlık calloc belleğini gösterir
    boyut: usize,
}

impl CTampon {
    fn yeni(boyut: usize) -> Option<CTampon> {
        // SAFETY: calloc her boyutla çağrılabilir; başarısız olursa null döner.
        let ptr = unsafe { calloc(boyut, 1) } as *mut u8;
        if ptr.is_null() { None } else { Some(CTampon { ptr, boyut }) }
    }

    fn as_mut_slice(&mut self) -> &mut [u8] {
        // SAFETY: ptr null değil ve `boyut` baytlık, calloc ile sıfırlanmış
        // (başlatılmış) belleği gösteriyor; &mut self tekil erişimi garanti ediyor.
        unsafe { std::slice::from_raw_parts_mut(self.ptr, self.boyut) }
    }
}

impl Drop for CTampon {
    fn drop(&mut self) {
        // SAFETY: ptr calloc'tan geldi ve daha önce serbest bırakılmadı.
        unsafe { free(self.ptr as *mut c_void) };
        println!("{} bayt C belleği serbest bırakıldı", self.boyut);
    }
}

fn main() {
    let mut tampon = CTampon::yeni(4).expect("bellek yetersiz");
    let baytlar = tampon.as_mut_slice();
    baytlar[0] = 72; // 'H'
    baytlar[1] = 105; // 'i'
    println!("{:?}", tampon.as_mut_slice());
} // tampon burada drop edilir → free otomatik çağrılır
```

Neden `malloc` değil de `calloc`? `malloc`'un döndürdüğü bellek **başlatılmamıştır (uninitialized)**;
ondan `&mut [u8]` oluşturup okumak UB'dir. `calloc` belleği sıfırlarla doldurur. Başlatılmamış bellekle
güvenli çalışmanın yolu olan `MaybeUninit`'i 5. derste göreceğiz.

```quiz
question: "`CTampon` örneğinde `Drop` uygulamasının FFI açısından en önemli faydası nedir? (Modül 17'yi hatırla)"
options:
  - "`free`'nin her çıkış yolunda (normal bitiş, erken `return`, panik) tam olarak **bir kez** çağrılmasını garanti eder"
  - "Belleği daha hızlı serbest bırakır"
  - "`free` çağrısını `unsafe` olmaktan çıkarır"
  - "`CTampon`'u otomatik olarak `Copy` yapar"
answer: 0
explanation: |
  RAII'nin özü: kaynağın ömrü bir değerin ömrüne bağlanır. Değer kapsamdan çıkınca `drop` otomatik çalışır;
  `free`'yi unutmak (sızıntı) ya da iki kez çağırmak (double free) mümkün olmaz. Ayrıca `Drop` uygulayan
  bir tip `Copy` **olamaz** (Modül 17); böylece aynı işaretçinin iki kopyasının iki kez `free` edilmesi
  derleme zamanında engellenir.
feedback:
  - "Doğru! Kaynağı kapatma sorumluluğu programcıdan derleyiciye geçer."
  - "Hız aynıdır; fark doğruluktadır."
  - "`drop`'un içinde hâlâ bir `unsafe` blok var; sözü biz veriyoruz."
  - "Tam tersi: `Drop` uygulayan tipler `Copy` olamaz."
```

Gerçek projelerde bildirimleri elle yazmak hem yorucu hem de hataya açıktır. Topluluğun araçları:

| Araç | Ne yapar? |
|------|-----------|
| **bindgen** | C başlık dosyasından (`.h`) Rust `unsafe extern` bildirimlerini ve `repr(C)` struct'ları **otomatik üretir** |
| **cbindgen** | Rust kodundaki `extern "C"` fonksiyonlardan C/C++ başlık dosyası üretir (ters yön) |
| **`-sys` crate'leri** | `libsqlite3-sys`, `openssl-sys`: yalnızca ham bildirimleri ve bağlama ayarını içerir |
| **Güvenli sarmalayıcı crate'ler** | `rusqlite`, `openssl`: `-sys` crate'inin üstüne güvenli API kurar (bu dersteki `c_uzunluk` ve `CTampon` gibi) |
| **PyO3, napi-rs, cxx** | Rust ↔ Python, Rust ↔ Node.js, Rust ↔ C++ için güvenli köprüler |

## Özet

:::remember
- **FFI** = başka dillerle konuşmak; ortak dil **C ABI**'dir (`extern "C"`).
- Edition 2024: `unsafe extern "C" { safe fn abs(x: c_int) -> c_int; fn strlen(s: *const c_char) -> usize; }`, işaretsiz öğeler `unsafe fn`'dir.
- C tipleri için `std::ffi::{c_int, c_char, c_void, ...}` kullan.
- Rust → C dizgi: `CString::new(s)?` + `.as_ptr()` (sahibi değişkende tut!). C → Rust: `CStr::from_ptr(p)`, `c"..."` literal.
- Rust'ı dışa açmak: `#[unsafe(no_mangle)] pub extern "C" fn ...`; crate tipi `cdylib`/`staticlib`.
- `extern "C" fn` içinde panik → program **abort** eder.
- C'ye giden struct'lar `#[repr(C)]` olmalı; C kaynaklarını `Drop` ile RAII sarmalayıcıya koy.
:::

```reflect
prompt: Kendi cümlelerinle açıkla, `unsafe extern "C"` bloğundaki bir bildirim neden "söz" sayılır ve yanlış yazılırsa ne olur?
answer: |
  Model cevap: Rust derleyicisi C kodunu göremez; bildirimde yazdığım imzayı (parametre tipleri, dönüş
  tipi, ABI) olduğu gibi kabul eder. İmza C'deki gerçek tanımla uyuşmazsa, örneğin `int` yerine `double`
  yazarsam, program derlenir ama çalışma anında argümanlar yanlış yazmaçlara konur ya da yanlış yerden
  okunur: tanımsız davranış. `unsafe extern` bloğundaki `unsafe` kelimesi "bu imzaların doğru olduğunu
  ben garanti ediyorum" sözüdür. Bu yüzden bindgen gibi araçlarla bildirimleri başlık dosyasından otomatik
  üretmek daha güvenlidir.
```

```flashcards
- front: "ABI nedir ve `extern \"C\"` neden kullanılır?"
  back: "Fonksiyon çağrısının ikili seviyedeki protokolü (argümanlar, dönüş değeri, yazmaçlar). Rust ABI'si kararsızdır; diller arası köprüde kararlı C ABI'si kullanılır."
- front: "Edition 2024'te bir C fonksiyonunu güvenli koddan `unsafe` blok olmadan çağırmak için bildirimi nasıl yazarsın?"
  back: "`unsafe extern \"C\" { safe fn abs(x: c_int) -> c_int; }`, `safe` ile işaretleyerek."
- front: "`CString` ile `&CStr` arasındaki fark nedir?"
  back: "`CString` sahipli, \\0 ile biten C dizgisi (Rust → C gönderirken); `&CStr` ödünç alınmış C dizgisi (C'den okurken, `c\"...\"`)."
- front: "`CString::new(\"a\\0b\")` ne döndürür?"
  back: "`Err(NulError)`, C dizgisinin içinde \\0 olamaz."
- front: "`let p = CString::new(\"x\").unwrap().as_ptr();` neden hatalıdır?"
  back: "Geçici `CString` ifadenin sonunda drop edilir; `p` sarkan işaretçi olur (uyarı: dangling_pointers_from_temporaries)."
- front: "Bir Rust fonksiyonunu C'ye açmak için gereken iki şey nedir?"
  back: "`#[unsafe(no_mangle)]` (sembol adını süslememek) ve `pub extern \"C\" fn` (C ABI'si)."
- front: "`extern \"C\" fn` içinde panik olursa ne olur?"
  back: "Yığın çözülmesi C sınırını geçemez; program \"panic in a function that cannot unwind\" ile abort eder."
- front: "bindgen ve cbindgen ne yapar?"
  back: "bindgen: C başlığından Rust bildirimleri üretir. cbindgen: Rust `extern \"C\"` kodundan C başlığı üretir."
```
