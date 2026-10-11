---
id: m24-l04
title: "Statik değişkenler, unsafe trait'ler ve union'lar"
minutes: 26
type: lesson
objectives:
  - "`static` ile `const` arasındaki farkı açıklayabilmek ve `static mut` yerine atomik, `Mutex` ya da `OnceLock` kullanabilmek"
  - "Edition 2024'ün `static mut` referanslarını neden reddettiğini açıklayıp `&raw const` / `&raw mut` ile çalışabilmek"
  - "`unsafe trait` ve `unsafe impl Send` kavramlarını açıklayıp bir `union`'ı güvenli biçimde kullanabilmek"
  - "Başlıca tanımsız davranış (UB) türlerini sayabilmek ve Miri'nin (`cargo +nightly miri test`) onları nasıl yakaladığını açıklayabilmek"
keywords: [static, const, static mut, static_mut_refs, "&raw mut", AtomicU32, OnceLock, unsafe trait, unsafe impl, Send, Sync, union, tanımsız davranış, undefined behavior, Miri]
---

Beş süper güçten ikisini (ham işaretçi çözmek ve `unsafe fn` çağırmak) artık iyi tanıyorsun. Bu derste kalan
üçünü öğreneceksin: **`static mut`'a erişmek**, **`unsafe trait` uygulamak** ve **`union` alanı okumak**.
Sonra bütün modülün görünmez düşmanıyla yüzleşeceğiz: **tanımsız davranış (undefined behavior)** ve onu
avlayan araç **Miri**.

## static ve const aynı şey değil

Modül 2'de ikisiyle de tanışmıştın, ama aradaki fark burada önem kazanıyor:

| | `const` | `static` |
|-|---------|----------|
| Ne tanımlar? | Bir **değer**; her kullanıldığı yere kopyalanır (inline) | Bellekte **tek bir yer**; sabit bir adresi vardır |
| Yaşam süresi | Her kullanımda yeni bir geçici değer | `'static`: program boyunca yaşar |
| İç değişkenlik (`Atomic`, `Mutex`) | Anlamsız: her kullanım ayrı bir kopya | Anlamlı: herkes aynı nesneyi paylaşır |
| Tip şartı | - | `Sync` olmalı (birden fazla thread görebilir) |

Bu tablonun neden önemli olduğunu bir sayaçla görelim. Tahmin et:

```predict
code: |
  use std::sync::atomic::{AtomicU32, Ordering};

  const SABIT_SAYAC: AtomicU32 = AtomicU32::new(0);
  static STATIK_SAYAC: AtomicU32 = AtomicU32::new(0);

  fn main() {
      for _ in 0..3 {
          SABIT_SAYAC.fetch_add(1, Ordering::Relaxed);
          STATIK_SAYAC.fetch_add(1, Ordering::Relaxed);
      }
      println!("{}", SABIT_SAYAC.load(Ordering::Relaxed));
      println!("{}", STATIK_SAYAC.load(Ordering::Relaxed));
  }
options:
  - |
    3
    3
  - |
    0
    3
  - |
    0
    0
  - Derlenmez
answer: 1
explanation: |
  `const` bir değerdir, bir yer değil: `SABIT_SAYAC` yazdığın **her yerde** yepyeni bir `AtomicU32::new(0)`
  oluşturulur, `fetch_add` o geçici kopyayı artırır ve kopya hemen yok olur. `load` da yeni bir kopyayı
  okur: `0`. `static` ise programda **tek bir** nesnedir; üç artırma da aynı yere yapılır: `3`. Derleyici
  bu tuzağı fark eder ve bir uyarı verir: "each usage of a `const` item creates a new temporary".
```

Kural basit: **paylaşılan, değişen** bir şey istiyorsan `static`, sadece bir isimli değer istiyorsan `const`.
Atomik tipler ve `Mutex` (Modül 18) iç değişkenliğe sahip oldukları için bir `static` içinde **hiç `unsafe`
yazmadan** değiştirilebilirler.

## static mut: neden bu kadar tehlikeli?

`static mut` ise iç değişkenliği olmayan, doğrudan değiştirilebilir bir küresel değişkendir. C'deki küresel
değişkenlerin birebir karşılığı:

```rust
static mut ZIYARETCI: u32 = 0;

fn ziyaret_et() {
    // SAFETY: Bu program tek thread'li; ZIYARETCI'ye aynı anda başka erişim yok.
    unsafe {
        ZIYARETCI += 1; // süper güç #3
    }
}

fn main() {
    ziyaret_et();
    ziyaret_et();
    // Değeri dışarı KOPYALAMAK bir referans oluşturmaz.
    let adet = unsafe { ZIYARETCI };
    println!("ziyaretçi sayısı: {adet}");
}
```

`static mut`'a her erişim `unsafe`'tir. Neden? Çünkü her thread onu görebilir ve derleyici iki thread'in
aynı anda `ZIYARETCI += 1` yapmadığını kanıtlayamaz. `+= 1` aslında "oku, bir ekle, yaz" diye üç adımdır;
iki thread araya girerse artırmalardan biri kaybolur. Bu bir **veri yarışıdır (data race)** ve Rust'ta
veri yarışı tanımsız davranıştır.

Edition 2024 bir adım daha ileri gitti: `static mut`'a **referans** oluşturmak artık varsayılan olarak bir
**hatadır**. Önce tahmin et:

```compiles
code: |
  static mut ZIYARETCI: u32 = 0;

  fn main() {
      unsafe {
          ZIYARETCI += 1;
          println!("{ZIYARETCI}");
      }
  }
answer: false
explanation: |
  Sürpriz: `unsafe` bloğun içinde olmasına rağmen derlenmez! `println!` argümanlarını **referansla**
  alır (`&ZIYARETCI`). Edition 2024'te `static mut`'a `&` ya da `&mut` referans oluşturmak
  `static_mut_refs` lint'i tarafından **reddedilir** (deny). Değeri önce bir değişkene kopyalamak
  (`let adet = unsafe { ZIYARETCI };`) ya da `&raw const ZIYARETCI` kullanmak gerekir.
```

:::error
```text
error: creating a shared reference to mutable static
 --> src/main.rs:6:20
  |
6 |         println!("{ZIYARETCI}");
  |                    ^^^^^^^^^ shared reference to mutable static
  |
  = note: shared references to mutable statics are dangerous; it's undefined behavior if the static is mutated or if a mutable reference is created for it while the shared reference lives
  = help: use a type that relies on "interior mutability" instead; to read more on this, visit <https://doc.rust-lang.org/reference/interior-mutability.html>
  = note: for more information, see <https://doc.rust-lang.org/edition-guide/rust-2024/static-mut-references.html>
  = note: `#[deny(static_mut_refs)]` (part of `#[deny(rust_2024_compatibility)]`) on by default
```
Bu hatanın bir E-kodu yok; bir **lint**'tir ve edition 2024'te `deny` seviyesindedir. Mesaj nedenini
söylüyor: bir `&` referansı yaşarken statik değişirse (başka bir thread'den ya da iç içe bir fonksiyon
çağrısından), "referansın gösterdiği değer değişmez" kuralı çiğnenir ve bu UB'dir. Referanslar bu
garantiyi **her zaman** verir; `static mut` ise her an değişebilir. İkisi bir arada yaşayamaz.
:::

Gerçekten ham erişim gerekiyorsa (örneğin bir C kütüphanesine statik bir tamponun adresini vermek),
**`&raw const`** ve **`&raw mut`** referans oluşturmadan adres üretir. Üstelik `static mut`'ın adresini
almak `unsafe` bile gerektirmez; tehlike yine çözerken başlar:

```rust
static mut TAMPON: [u8; 4] = [0; 4];

fn main() {
    let p: *mut [u8; 4] = &raw mut TAMPON; // güvenli: sadece adres
    // SAFETY: tek thread'li program; TAMPON'a aynı anda başka erişim yok.
    unsafe {
        (*p)[0] = 42;
        (*p)[3] = 7;
        println!("{:?}", *p);
    }
}
```

Ama çoğu zaman `static mut`'a **hiç ihtiyacın yoktur**. Modül 18'deki araçlar aynı işi `unsafe` olmadan yapar:

| İhtiyaç | `static mut` yerine |
|---------|----------------------|
| Sayaç, bayrak | `static SAYAC: AtomicU32 = AtomicU32::new(0);` |
| Değişen karmaşık veri | `static LISTE: Mutex<Vec<String>> = Mutex::new(Vec::new());` |
| Bir kez hesaplanan değer (yapılandırma) | `static AYAR: OnceLock<Ayar> = OnceLock::new();` ya da `LazyLock` |
| Thread başına durum | `thread_local!` makrosu |

:::analogy Bankadaki sıramatik
`static mut` bir bankada duvara asılmış **kâğıt bir sıra listesi** gibidir: herkes kalemle bir sonraki
numarayı kendisi yazar. İki müşteri aynı anda bakıp aynı numarayı yazarsa iki kişi aynı sıraya düşer.
`AtomicU32` ise **sıramatik makinesidir**: düğmeye kim basarsa bassın makine numarayı tek hamlede verir ve
ilerletir; aynı numara iki kez çıkamaz. `Mutex` de tek kişilik bir bankodur: sıra sende değilse beklersin.
:::

```exercise
id: m24-e-siparis-no
title: Restoran için benzersiz sipariş numarası
difficulty: 2
prompt: |
  Bir restoranın sipariş sistemi birden fazla thread'de (garson tabletleri) çalışıyor. Her siparişe
  **benzersiz** ve **artan** bir numara verilmeli; ilk numara `1` olmalı.

  `yeni_siparis_no()` fonksiyonunu küresel bir sayaçla yaz. `static mut` kullanma; Modül 18'deki
  atomik tiplerle `unsafe` olmadan çöz.
starter: |
  use std::sync::atomic::{AtomicU32, Ordering};

  // TODO: küresel sayacı burada tanımla

  fn yeni_siparis_no() -> u32 {
      todo!()
  }

  fn main() {
      let a = yeni_siparis_no();
      let b = yeni_siparis_no();
      println!("{a} {b}");
  }
solution: |
  use std::sync::atomic::{AtomicU32, Ordering};

  static SIRADAKI: AtomicU32 = AtomicU32::new(1);

  fn yeni_siparis_no() -> u32 {
      // fetch_add eski değeri döndürür ve tek, bölünmez bir adımda 1 artırır.
      SIRADAKI.fetch_add(1, Ordering::Relaxed)
  }

  fn main() {
      let a = yeni_siparis_no();
      let b = yeni_siparis_no();
      println!("{a} {b}");
  }
check: tests
tests: |
  #[test]
  fn numaralar_sifirdan_buyuk() {
      assert!(yeni_siparis_no() >= 1, "ilk numara 1 olmalı; 0 verilmemeli");
  }

  #[test]
  fn ardisik_cagrilar_artar() {
      let a = yeni_siparis_no();
      let b = yeni_siparis_no();
      assert!(b > a, "sonraki numara öncekinden büyük olmalı ({a} → {b})");
  }

  #[test]
  fn threadler_arasinda_benzersiz() {
      let numaralar = std::sync::Mutex::new(std::collections::HashSet::new());
      std::thread::scope(|s| {
          for _ in 0..8 {
              s.spawn(|| {
                  for _ in 0..500 {
                      let n = yeni_siparis_no();
                      numaralar.lock().unwrap().insert(n);
                  }
              });
          }
      });
      assert_eq!(numaralar.lock().unwrap().len(), 4000, "8 thread × 500 sipariş = 4000 farklı numara olmalı");
  }
hints:
  - "Küresel, değiştirilebilir ama `unsafe` gerektirmeyen bir sayaç: `static SIRADAKI: AtomicU32 = AtomicU32::new(1);`"
  - "`fetch_add(1, ...)` sayacı artırır ve artırmadan **önceki** değeri döndürür; tam istediğimiz şey."
  - "Sadece benzersizlik gerekiyor, başka veriyle sıralama ilişkisi yok: `Ordering::Relaxed` yeterli (Modül 18)."
forbid:
  - pattern: "static\\s+mut"
    message: "`static mut` kullanma; atomik bir `static` ile `unsafe`'siz çöz!"
  - pattern: "unsafe"
    message: "Bu alıştırma hiç `unsafe` yazmadan çözülebilir."
require:
  - pattern: "static\\s+[A-Z_]+\\s*:\\s*AtomicU(32|64|size)"
    message: "Sayacı `static AD: AtomicU32 = ...` biçiminde tanımla."
explanation: |
  `fetch_add` "oku-artır-yaz" işlemini işlemcinin **tek bir atomik komutuyla** yapar; iki thread aynı anda
  çağırsa bile biri diğerini bekler ve aynı numara iki kez çıkamaz. Testteki 8 thread × 500 çağrı bunu
  doğruluyor.

  `static mut` + `unsafe { SAYAC += 1; SAYAC }` ile yazsaydın kod derlenirdi, ama "artır" ve "oku" iki ayrı
  adım olduğundan iki thread aynı numarayı alabilir (veri yarışı = UB). Test bazen geçer, bazen geçmezdi;
  bu tür hatalar en sinsileridir.

  `Ordering::Relaxed` burada yeterli, çünkü sayacın değeri başka bir verinin yayınlanmasını korumuyor
  (Modül 18'deki Acquire/Release ihtiyacı yok). `Mutex<u32>` de çalışırdı ama tek bir sayı için atomik daha
  hafiftir.
```

## unsafe trait ve unsafe impl

Bazı trait'lerin bir **güvenlik sözleşmesi** vardır: trait'i uygulayan tip, derleyicinin kontrol edemediği
bir garantiyi vermek zorundadır ve **başka unsafe kod bu garantiye güvenir**. Böyle trait'ler `unsafe trait`
olarak tanımlanır ve uygulamaları `unsafe impl` gerektirir (süper güç #4).

En tanıdık örnekleri Modül 18'den: **`Send`** ve **`Sync`**. Derleyici bunları çoğu tip için otomatik
türetir; ama ham işaretçiler ne `Send` ne de `Sync`'tir, çünkü derleyici neyi gösterdiklerini bilemez. Tahmin et:

```compiles
code: |
  use std::thread;

  struct Isaretci(*mut i32);

  fn main() {
      let mut x = 5;
      let p = Isaretci(&raw mut x);
      let h = thread::spawn(move || {
          let _q = p;
      });
      h.join().unwrap();
  }
answer: false
error: E0277
explanation: |
  `*mut i32` `Send` değildir, dolayısıyla onu içeren `Isaretci` de `Send` değildir ve `thread::spawn`'a
  verilen closure başka thread'e taşınamaz: `*mut i32 cannot be sent between threads safely` (E0277,
  Modül 18). Bu koruma burada gerçekten işe yarıyor: `x` main'in stack'inde yaşıyor ve yeni thread
  onu ham işaretçiyle gösterseydi, main bittiğinde sarkan bir işaretçi elinde kalabilirdi.
```

Kendi tipinin başka thread'lere gönderilmesinin güvenli olduğundan **eminsen** (örneğin işaretçi, tipin
tek başına sahibi olduğu bir heap belleği gösteriyorsa, tıpkı `Box` gibi), bunu `unsafe impl` ile beyan
edersin. `unsafe` yazmayı unutursan:

:::error
```text
error[E0200]: the trait `Send` requires an `unsafe impl` declaration
 --> src/main.rs:3:1
  |
3 | impl Send for Isaretci {}
  | ^^^^^^^^^^^^^^^^^^^^^^
  |
  = note: the trait `Send` enforces invariants that the compiler can't check. Review the trait documentation and make sure this implementation upholds those invariants before adding the `unsafe` keyword
help: add `unsafe` to this trait implementation
  |
3 | unsafe impl Send for Isaretci {}
  | ++++++
```
Derleyici `unsafe`'i eklemeden önce **trait'in dokümanını okumanı** söylüyor. `help:` satırındaki düzeltmeyi
körü körüne uygulamak, yanlış bir `Send` beyanı yapmak demektir; o da veri yarışlarına kapı açar.
:::

Kendi `unsafe trait`'ini de tanımlayabilirsin. Örnek: "bu tipin bütün baytlarının sıfır olması geçerli
bir değerdir" sözleşmesi. `std::mem::zeroed()` belleği sıfırlarla dolduran bir `unsafe fn`'dir; `u32` için
sorunsuzdur ama `&i32` için sıfır = **null referans** demektir ve bu UB'dir. Hangi tiplerin güvenli olduğunu
bir trait taşısın:

```rust
/// # Safety
///
/// Uygulayan tip için tüm baytları sıfır olan bit deseni geçerli bir değer olmalıdır.
/// Referanslar, `Box`, `NonZero*` ve sıfır değerine sahip olmayan enum'lar bu trait'i UYGULAYAMAZ.
unsafe trait SifirGecerli {}

// SAFETY: 0u32 ve 0.0f64 geçerli değerlerdir.
unsafe impl SifirGecerli for u32 {}
unsafe impl SifirGecerli for f64 {}

#[derive(Debug)]
struct Olcum {
    adet: u32,
    ortalama: f64,
}
// SAFETY: Tüm alanları SifirGecerli; tüm alanlar sıfırken Olcum da geçerli.
unsafe impl SifirGecerli for Olcum {}

fn sifir_deger<T: SifirGecerli>() -> T {
    // SAFETY: T: SifirGecerli, yani sıfır bit deseni T için geçerli bir değer.
    unsafe { std::mem::zeroed() }
}

fn main() {
    let a: u32 = sifir_deger();
    let o: Olcum = sifir_deger();
    println!("{a} {o:?} adet={} ortalama={}", o.adet, o.ortalama);
}
```

`sifir_deger` güvenli bir fonksiyon, çünkü güvenliği `T: SifirGecerli` sınırı taşıyor. Biri yanlışlıkla
`impl SifirGecerli for &i32` yazabilseydi, `sifir_deger::<&i32>()` güvenli koddan null referans üretirdi.
`unsafe impl` zorunluluğu bunu engeller: yanlış beyan ancak **imzalı** bir sözle yapılabilir. Gerçek dünyada
`bytemuck` crate'inin `Zeroable` ve `Pod` trait'leri tam olarak böyledir.

```quiz
question: "Bir trait'i `unsafe trait` olarak tanımlamak ne zaman doğrudur?"
options:
  - "Trait'in metotları içinde `unsafe` kod varsa"
  - "Başka (unsafe) kod, trait'i uygulayan tiplerin derleyicinin kontrol edemediği bir garantiyi sağladığına **güveniyorsa**"
  - "Trait yalnızca ham işaretçiler için uygulanacaksa"
  - "Trait'in metotlarının `unsafe fn` olması gerekiyorsa"
answer: 1
explanation: |
  `unsafe trait` sözleşmeyi **uygulayana** yükler: "Beni uygularsan şu garantiyi vermiş olursun."
  `Send`'e veri yarışı olmadan thread'ler arası taşınabilme, `SifirGecerli`'ye sıfır bit deseninin geçerli
  olması güveniliyor. Metotların içinde `unsafe` kod olması ise sadece o metodun gövdesini ilgilendirir;
  trait'in kendisini unsafe yapmaz. Bir metodu çağırmak tehlikeliyse, o metot `unsafe fn` olur, trait değil.
feedback:
  - "Gövdedeki `unsafe` bir uygulama detayıdır; trait'in sözleşmesini değiştirmez."
  - "Doğru!"
  - "Tiple ilgili değil; sözleşmeyle ilgili. `SifirGecerli` hiç işaretçi içermiyor."
  - "Bu, `unsafe fn` metotlu sıradan bir trait olur; `unsafe trait` ayrı bir kavram."
```

## union: aynı belleğe iki bakış

Bir **`union`**, struct'a benzer ama bütün alanları **aynı bellek alanını paylaşır**. Bellekte aynı anda
yalnızca bir alanın değeri anlamlıdır ve hangisi olduğunu Rust takip etmez. Modül 7'deki enum'u hatırla:
bir enum, hangi varyantta olduğunu gösteren gizli bir **etiket (tag)** tutar; `union` ise etiketsizdir.
Etiketi tutmak senin sorumluluğundadır.

```rust
union Bitler {
    f: f32,
    u: u32,
}

fn main() {
    let mut b = Bitler { f: 1.0 }; // yazmak/oluşturmak güvenli
    // SAFETY: f32 ve u32 aynı boyutta; her 32 bitlik desen geçerli bir u32'dir.
    println!("1.0'ın bitleri: {:#x}", unsafe { b.u }); // süper güç #5

    b.u = 0x4049_0fdb; // bir alana yazmak da güvenli
    // SAFETY: her 32 bitlik desen geçerli bir f32'dir (NaN dahil).
    println!("o bitler f32 olarak: {}", unsafe { b.f });
    println!("boyut: {} bayt", size_of::<Bitler>());
}
```

```memory
title: "union Bitler, tek bellek, iki yorum"
steps:
  - caption: "`Bitler { f: 1.0 }`: 4 baytlık tek bir alan. `f` olarak yazıldı."
    stack:
      - frame: main
        vars:
          - { name: b, type: Bitler, value: "3f 80 00 00", mut: true, note: "4 bayt" }
          - { name: b.f, type: f32, value: "1.0", to: b, note: "aynı 4 bayt" }
          - { name: b.u, type: u32, value: "0x3f800000", to: b, note: "aynı 4 bayt" }
```

Alan okumak neden `unsafe`? Çünkü her bit deseni her tip için geçerli değildir. `bool` yalnızca 0 ya da 1
olabilir, `char` geçerli bir Unicode skaler değeri olmalı, referanslar null olamaz. `u8` alanına 3 yazıp
`bool` alanını okursan, ya da yazılmamış (başlatılmamış) bir alanı okursan, UB olur.

:::error
```text
error[E0133]: access to union field is unsafe and requires unsafe block
 --> src/main.rs:8:18
  |
8 |     let bitler = u.i;
  |                  ^^^ access to union field
  |
  = note: the field may not be properly initialized: using uninitialized data will cause undefined behavior
```
Yine aynı E0133: beş süper gücün ortak hata kodu.
:::

`union`'ların asıl kullanım alanı **C ile birlikte çalışmaktır**: C kütüphanelerindeki `union` tiplerini
(`SDL_Event`, ağ adres yapıları...) Rust'ta birebir temsil etmek için. Alanlar `Copy` olmalı ya da
`ManuallyDrop<T>` ile sarılmalıdır; çünkü Rust hangi alanın aktif olduğunu bilmediğinden kimin `drop`
edileceğine karar veremez. Saf Rust kodunda neredeyse her zaman **enum** daha doğru seçimdir; bir float'ın
bitleri gerekiyorsa da güvenli `f32::to_bits()` / `f32::from_bits()` metotları vardır.

```predict
code: |
  union Paket {
      sayi: u32,
      baytlar: [u8; 4],
  }

  fn main() {
      let p = Paket { sayi: 0x11223344 };
      // SAFETY: [u8; 4] için her bit deseni geçerli.
      let b = unsafe { p.baytlar };
      println!("{:x?}", b);
  }
options:
  - "[11, 22, 33, 44]"
  - "[44, 33, 22, 11]"
  - "[1122, 3344]"
answer: 1
explanation: |
  Playground (ve senin büyük ihtimalle bilgisayarın) **x86-64** işlemcide çalışır; bu işlemciler sayıları
  bellekte **küçük uçlu (little-endian)** saklar: en düşük anlamlı bayt (`0x44`) en düşük adrese konur.
  ARM'ın çoğu da little-endian'dır, ama bazı ağ işlemcileri ve eski sistemler big-endian'dır ve orada sonuç
  `[11, 22, 33, 44]` olurdu. Union'la yapılan bu tür yeniden yorumlamalar **platforma bağlıdır**. Taşınabilir
  kod için `u32::to_le_bytes()` / `to_be_bytes()` kullan. (`{:x?}` biçimi, Debug çıktısını onaltılık yazdırır.)
```

```exercise
id: m24-e-f32-bitleri
title: Sensör paketindeki sıcaklığı çöz
difficulty: 2
prompt: |
  Bir hava istasyonu sensörü sıcaklığı `f32` olarak ölçüyor, ama kullandığı ağ protokolü sadece 32 bitlik
  tamsayılar taşıyabiliyor. Gönderen taraf için `f32_bitleri(x)` fonksiyonunu **bir `union` ile** yaz:
  `f32`'nin bitlerini değiştirmeden `u32` olarak döndürsün.

  Örnek: `f32_bitleri(1.0)` → `0x3f80_0000`.

  `to_bits` ve `transmute` kullanma; amaç `union`'ı tanımak.
starter: |
  union Donusum {
      f: f32,
      u: u32,
  }

  fn f32_bitleri(x: f32) -> u32 {
      todo!()
  }

  fn main() {
      println!("{:#x}", f32_bitleri(21.5));
  }
solution: |
  union Donusum {
      f: f32,
      u: u32,
  }

  fn f32_bitleri(x: f32) -> u32 {
      let d = Donusum { f: x };
      // SAFETY: f32 ve u32 aynı boyuttadır (4 bayt) ve her 32 bitlik desen
      // geçerli bir u32'dir; `f` alanı az önce başlatıldı.
      unsafe { d.u }
  }

  fn main() {
      println!("{:#x}", f32_bitleri(21.5));
  }
check: tests
tests: |
  #[test]
  fn bir_ve_yarim() {
      assert_eq!(f32_bitleri(1.0), 0x3f80_0000, "1.0'ın IEEE 754 gösterimi 0x3f800000'dır");
      assert_eq!(f32_bitleri(0.5), 0x3f00_0000, "0.5 → 0x3f000000");
  }

  #[test]
  fn negatif_sayilar_isaret_bitini_kullanir() {
      assert_eq!(f32_bitleri(-2.0), 0xc000_0000, "-2.0 → 0xc0000000 (en üst bit işaret biti)");
  }

  #[test]
  fn arti_ve_eksi_sifir_farkli() {
      assert_eq!(f32_bitleri(0.0), 0, "+0.0'ın bütün bitleri sıfırdır");
      assert_eq!(f32_bitleri(-0.0), 0x8000_0000, "-0.0 sadece işaret biti farklı: 0x80000000");
  }

  #[test]
  fn sicaklik_degeri() {
      assert_eq!(f32_bitleri(21.5), 0x41ac_0000, "21.5 → 0x41ac0000");
  }
hints:
  - "Önce union'ı `f` alanıyla oluştur: `let d = Donusum { f: x };`"
  - "Sonra aynı belleği `u` alanı üzerinden oku. Union alanı okumak süper güç #5'tir."
  - "`unsafe { d.u }` - üstüne neden güvenli olduğunu anlatan bir `// SAFETY:` yorumu eklemeyi unutma."
forbid:
  - pattern: "to_bits|transmute|as\\s+u32"
    message: "Bu alıştırmayı `union` ile çöz (`to_bits`, `transmute` ve `as u32` olmadan)."
require:
  - pattern: "Donusum\\s*\\{\\s*f\\s*:"
    message: "Union'ı `Donusum { f: x }` biçiminde oluşturmalısın."
explanation: |
  `Donusum { f: x }` 4 baytlık alana `x`'in bitlerini yazar; `d.u` aynı 4 baytı `u32` olarak okur. Bitler
  hiç değişmez, sadece **yorumları** değişir. `x as u32` ise bambaşka bir şey yapardı: sayısal dönüşüm
  (`21.5 as u32` = `21`). Bu fark, Modül 2'deki `as` dönüşümleriyle bit yeniden yorumlaması arasındaki
  farktır.

  Bu dönüşüm güvenli, çünkü her bit deseni geçerli bir `u32`'dir. Ters yön (`u32` → `f32`) de güvenlidir;
  her desen geçerli bir `f32`'dir (bazıları NaN). Ama `u8` → `bool` gibi bir union'da ters yön UB'ye
  açıktır. Gerçek projede ise `x.to_bits()` yaz: aynı işi hiç `unsafe` olmadan yapar ve içinde de tam olarak
  bu tür bir dönüşüm vardır.
```

## Tanımsız davranış kataloğu ve Miri

Bu modül boyunca "UB" dedik durduk. Rust referansındaki listenin özeti şöyle:

| Tanımsız davranış | Örnek |
|-------------------|-------|
| **Veri yarışı** | İki thread'in senkronizasyonsuz `static mut`'a yazması |
| **Geçersiz işaretçi çözmek** | Null, sarkan (use-after-free) ya da hizasız işaretçiyle `*p` |
| **Sınır dışı işaretçi aritmetiği** | 3 elemanlı dizide `p.add(5)` (okumasan bile) |
| **Aliasing (takma ad) kurallarını çiğnemek** | Aynı yere iki canlı `&mut`; `&T` yaşarken o yeri değiştirmek |
| **Geçersiz değer üretmek** | `bool`'a 2, geçersiz `char`, null `&T`/`Box`, geçersiz enum ayırt edicisi (discriminant) |
| **Başlatılmamış bellek okumak** | `malloc`'tan gelen belleği okumak (5. derste `MaybeUninit`) |
| **Kütüphane sözleşmesini çiğnemek** | `from_utf8_unchecked`'e geçersiz UTF-8, `get_unchecked`'e geçersiz indeks |
| **Yanlış FFI bildirimi** | C'deki `double f(int)` için `fn f(x: f64) -> i32` yazmak |

UB'nin en sinsi yanı **derleyici optimizasyonlarıdır**. Derleyici UB'nin asla olmayacağını **varsayar** ve
kodu buna göre dönüştürür. Örneğin bir `bool`'un yalnızca 0 ya da 1 olabileceğini bildiği için
`if b == true { .. } else if b == false { .. }` dalını tek karşılaştırmaya indirebilir; `bool`'un içinde
2 varsa iki dal da çalışmayabilir ya da ikisi de çalışabilir. Bu yüzden "test ettim, çalışıyor" UB için
hiçbir şey kanıtlamaz.

```quiz
question: "Aşağıdakilerden hangileri tanımsız davranıştır? (Birden fazla seçenek)"
options:
  - "Bir `Vec`'e sınır dışı bir indeksle `v[10]` diye erişmek"
  - "Bir `u8` alanına 3 yazıp aynı union'ın `bool` alanını okumak"
  - "İki thread'in aynı `static mut` değişkenini senkronizasyonsuz artırması"
  - "Bir `RefCell`'de zaten `borrow_mut` varken ikinci `borrow_mut`'u çağırmak"
  - "Boş bir dilimde `as_ptr().add(1)` hesaplamak"
answer: [1, 2, 4]
explanation: |
  `v[10]` ve `RefCell`'in ikinci `borrow_mut`'u **panik** üretir (Modül 9 ve 17): program kontrollü biçimde
  durur, bellek bozulmaz. Bunlar güvenli Rust'ın "hatayı yakaladım" deme biçimidir. `bool`'a 3, veri yarışı
  ve bellek bloğunun bir eleman ötesini aşan `add` ise UB'dir. Boş dilimde `add(0)` geçerlidir (tam "bir
  sonrası"), ama `add(1)` bloğun dışına çıkar.
feedback:
  - "Panik! UB değil. Sınır kontrolü tam olarak UB'yi önlemek için var."
  - "UB: `bool` için geçerli bit desenleri yalnızca 0 ve 1."
  - "UB: veri yarışı."
  - "Panik (`BorrowMutError`); RefCell'in çalışma zamanı kontrolü bunu yakalar."
  - "UB: işaretçi aritmetiği bellek bloğunun en fazla bir eleman ötesine gidebilir."
```

### Miri: UB dedektörü

UB'yi test ederek bulmak zor; çünkü UB'li program çoğu zaman "çalışır". **Miri**, Rust'ın orta seviye ara
temsilini (MIR) bir **yorumlayıcıda** adım adım çalıştıran resmî bir araçtır. Her bellek erişiminde
işaretçinin geçerli olup olmadığını, belleğin başlatılıp başlatılmadığını, aliasing kurallarının çiğnenip
çiğnenmediğini kontrol eder. Uygulamanın içinde Miri yok; kendi bilgisayarında şöyle kullanırsın:

```console
$ rustup +nightly component add miri
$ cargo +nightly miri test      # testleri Miri altında çalıştır
$ cargo +nightly miri run       # programı Miri altında çalıştır
```

Diyelim ki bir testte şu hatalı kod var:

```rust,ignore
#[test]
fn son_elemani_okur() {
    let dizi = [10, 20, 30];
    let p = dizi.as_ptr();
    let x = unsafe { *p.add(3) }; // HATA: son eleman indeks 2'de!
    assert!(x > 0);
}
```

Normal `cargo test` bu testi büyük ihtimalle **geçirir** (dizinin hemen ardındaki bellekte rastgele bir sayı
vardır). Miri ise anında yakalar:

```console
$ cargo +nightly miri test
running 1 test
test son_elemani_okur ... error: Undefined Behavior: memory access failed: attempting to access 4 bytes, but got alloc1234+0xc which is at or beyond the end of the allocation of size 12 bytes
 --> src/lib.rs:5:22
  |
5 |     let x = unsafe { *p.add(3) };
  |                      ^^^^^^^^^ Undefined Behavior occurred here
  |
  = help: this indicates a bug in the program: it performed an invalid operation, and caused Undefined Behavior
  = help: see https://doc.rust-lang.org/nightly/reference/behavior-considered-undefined.html for further information
```

Okuması kolay: 12 baytlık (3 × `i32`) bir bellek bloğunun 12. baytından (`+0xc`) 4 bayt okunmaya
çalışılmış, yani bloğun **dışı**. (Mesajın ayrıntıları Miri sürümüne göre biraz değişebilir.)

Miri'nin sınırları da var: sadece **çalıştırılan** kod yollarındaki UB'yi bulur (iyi testler şart), normal
çalıştırmadan 10-100 kat yavaştır ve C fonksiyonlarını çalıştıramaz (FFI çağrıları çoğunlukla
desteklenmez). Yine de **unsafe kod yazan herkesin** testlerini Miri'de çalıştırması topluluk standardıdır;
std'nin kendisi de Miri ile test edilir. Tamamlayıcı araçlar olarak derleyicinin **sanitizer**'ları
(`-Zsanitizer=address`, `thread`) ve bağımlılıklarındaki `unsafe` miktarını sayan `cargo geiger` vardır.

## Özet

:::remember
- `const` her kullanımda kopyalanan bir **değer**, `static` sabit adresli **tek bir yer**. Paylaşılan durum için `static` + atomik/`Mutex`/`OnceLock`.
- `static mut`'a her erişim `unsafe`; edition 2024'te ona `&`/`&mut` **referans oluşturmak hatadır** (`static_mut_refs`). Gerekirse `&raw const`/`&raw mut`, çoğu zaman hiç kullanma.
- `unsafe trait` sözleşmeyi **uygulayana** yükler; `unsafe impl Send for T {}` "bu tip thread'ler arası güvenle taşınır" sözüdür (yoksa **E0200**).
- `union` alanları aynı belleği paylaşır; yazmak güvenli, **okumak `unsafe`**. Saf Rust'ta enum ya da `to_bits` tercih et.
- UB: veri yarışı, geçersiz işaretçi, sınır dışı aritmetik, aliasing ihlali, geçersiz değer, başlatılmamış bellek... Panik UB **değildir**.
- Unsafe kodun testlerini `cargo +nightly miri test` ile çalıştır.
:::

```reflect
prompt: Kendi cümlelerinle açıkla, tanımsız davranış neden bir çökmeden (panik) daha tehlikelidir?
answer: |
  Model cevap: Panik, programın bir hatayı fark edip kontrollü biçimde durmasıdır; ne olduğu bellidir ve
  bellek bozulmaz. Tanımsız davranışta ise programın ne yapacağı hiçbir kurala bağlı değildir. Derleyici
  UB'nin asla olmayacağını varsayarak optimizasyon yaptığı için sonuç çökme, yanlış değer, güvenlik açığı
  ya da "her şey yolunda" görüntüsü olabilir. En kötüsü, bugün çalışan kod başka bir derleyici sürümünde,
  başka bir platformda ya da sadece başka bir girdiyle bozulabilir. Bu yüzden UB testle değil, kanıtla
  (SAFETY yorumları) ve Miri gibi araçlarla aranmalıdır.
```

```flashcards
- front: "`const SAYAC: AtomicU32` üzerinde `fetch_add` çağırmak neden işe yaramaz?"
  back: "`const` her kullanımda yeni bir geçici kopya oluşturur; artırılan kopya hemen yok olur. Paylaşılan sayaç için `static` gerekir."
- front: "Edition 2024'te `unsafe { println!(\"{S}\") }` (`S` bir `static mut`) neden derlenmez?"
  back: "`println!` argümanı referansla alır; `static mut`'a referans oluşturmak `static_mut_refs` lint'iyle reddedilir (deny)."
- front: "`static mut` yerine sayaç, karmaşık veri ve tek seferlik başlatma için ne kullanılır?"
  back: "Sayaç: `AtomicU32`; karmaşık veri: `Mutex<T>`; tek seferlik: `OnceLock`/`LazyLock`."
- front: "`impl Send for Tip {}` yazınca hangi hata çıkar?"
  back: "`E0200`, the trait `Send` requires an `unsafe impl` declaration."
- front: "`unsafe trait` ile `unsafe fn` arasındaki fark nedir?"
  back: "`unsafe trait`: sözleşmeyi **uygulayan** sağlar (unsafe impl). `unsafe fn`: sözleşmeyi **çağıran** sağlar (unsafe blok)."
- front: Union'da hangi işlem `unsafe`'tir, oluşturmak, alana yazmak, alanı okumak?
  back: "Sadece alanı **okumak** (süper güç #5). Oluşturmak ve yazmak güvenlidir."
- front: "Bir `Vec`'te `v[10]` sınır dışı erişimi UB midir?"
  back: Hayır. Kontrollü bir **paniktir**; bellek bozulmaz. UB ancak kontrolsüz erişimde (ham işaretçi, `get_unchecked`) olur.
- front: Miri nedir ve nasıl çalıştırılır?
  back: "Rust'ın MIR'ını yorumlayıp UB'yi çalışma anında yakalayan araç; `cargo +nightly miri test` / `miri run`."
```
