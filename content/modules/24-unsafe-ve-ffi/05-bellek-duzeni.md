---
id: m24-l05
title: Bellek düzeni
minutes: 26
type: lesson
objectives:
  - "`size_of` ve `align_of` ile bir tipin boyutunu ve hizasını ölçüp dolgu (padding) baytlarının nereden geldiğini hesaplayabilmek"
  - "`repr(C)`, `repr(u8)`, `repr(transparent)` ve `repr(packed)` arasından ihtiyaca uygun olanı seçebilmek"
  - "Niş optimizasyonunu açıklayıp `Option<&T>`, `Option<Box<T>>` ve `Option<NonZeroU32>` boyutlarını tahmin edebilmek"
  - "`MaybeUninit` ile başlatılmamış belleği `write` + `assume_init` sözleşmesine uyarak kullanabilmek"
keywords: [bellek düzeni, memory layout, size_of, align_of, offset_of, hizalama, alignment, dolgu, padding, "repr(C)", "repr(u8)", "repr(transparent)", "repr(packed)", niş optimizasyonu, niche, NonZeroU32, MaybeUninit, E0793, Rustonomicon]
---

Bu modül boyunca işaretçilerle adres hesapladın, C'ye struct gönderdin, `union`'la aynı baytları iki farklı
gözle okudun. Hepsinin altında aynı soru yatıyordu: **Bir değer bellekte tam olarak nasıl duruyor?** Kaç
bayt? Hangi alan hangi adreste? Aradaki boşluklar nereden geliyor?

Bu son derste o soruyu cevaplayacaksın. Ve bir sürprizle karşılaşacaksın: `Option<&T>`, `&T`'den **bir bayt
bile** büyük değil. Rust'ın "sıfır maliyetli soyutlama" vaadinin en güzel kanıtlarından biri bu.

## Her tipin bir boyutu ve bir hizası var

`size_of::<T>()` bir tipin kaç bayt yer kapladığını, `align_of::<T>()` ise o tipin bellekte **hangi
sayının katı olan adreslere** yerleştirilebileceğini söyler. İkisi de `std::mem`'dedir ve Rust 1.80'den beri
prelude'a dahildir, yani `use` yazmadan kullanabilirsin. C'deki karşılıkları `sizeof` ve `alignof`'tur;
ama Rust'takiler derleme zamanında hesaplanan sıradan `const fn`'lerdir.

```rust
fn main() {
    println!("tip      boyut  hiza");
    println!("u8       {:>5}  {:>4}", size_of::<u8>(), align_of::<u8>());
    println!("u16      {:>5}  {:>4}", size_of::<u16>(), align_of::<u16>());
    println!("u32      {:>5}  {:>4}", size_of::<u32>(), align_of::<u32>());
    println!("u64      {:>5}  {:>4}", size_of::<u64>(), align_of::<u64>());
    println!("bool     {:>5}  {:>4}", size_of::<bool>(), align_of::<bool>());
    println!("()       {:>5}  {:>4}", size_of::<()>(), align_of::<()>());
    println!("[u16; 3] {:>5}  {:>4}", size_of::<[u16; 3]>(), align_of::<[u16; 3]>());
    println!("&u8      {:>5}  {:>4}", size_of::<&u8>(), align_of::<&u8>());
    println!("&str     {:>5}  {:>4}", size_of::<&str>(), align_of::<&str>());
    println!("String   {:>5}  {:>4}", size_of::<String>(), align_of::<String>());
}
```

Birkaç gözlem (64 bitlik bir makinede):

- `()` **0 bayttır**: hiç bilgi taşımayan tipler (sıfır boyutlu tipler, *zero-sized types*) bellekte yer kaplamaz.
  `HashSet<T>`'nin aslında `HashMap<T, ()>` olması bu yüzden bedavadır.
- Bir dizinin hizası elemanının hizasıdır; boyutu `adet × eleman boyutu`dur.
- `&u8` 8 bayt (bir adres), `&str` ise 16 bayt: adres + uzunluk. Modül 22'deki **şişman işaretçi (fat pointer)**.
- `String` 24 bayt: işaretçi + uzunluk + kapasite (Modül 4'teki üçlü).

**Hiza neden var?** İşlemci belleği bayt bayt değil, 4 ya da 8 baytlık **kelimeler (word)** hâlinde okur.
4 baytlık bir `u32` 4'ün katı bir adreste duruyorsa tek okumayla gelir; iki kelimenin sınırına denk gelirse
işlemci iki okuma yapıp parçaları birleştirmek zorunda kalır. Bazı mimarilerde (eski ARM, SPARC) bu
düpedüz bir donanım hatasıdır; atomik işlemler ise her mimaride hizalı adres ister. Rust bu yüzden çok katı
bir kural koyar: **hizasız bir referans oluşturmak, onu hiç kullanmasan bile tanımsız davranıştır.**

:::analogy Kamyon otoparkı
Bir otoparkta yerler 1'den başlayarak numaralanmış. Motosikletler (1 baytlık `u8`) her yere park edebilir.
Otomobiller (`u32`) sadece 4'ün katı numaralı yerlerden başlayıp 4 yer kaplayabilir; kamyonlar (`u64`)
yalnızca 8'in katlarından. Yerler böyle düzenlenince görevli (işlemci) her aracı tek bakışta bulur. Bedeli:
bir motosikletin ardından bir kamyon gelirse, aradaki yerler **boş** kalır. O boş yerlerin adı **dolgu
(padding)**.
:::

Son bir kural: **boyut her zaman hizanın katıdır.** Neden? Dizilerde `i`'nci eleman `i × size_of::<T>()`
adresindedir (1. dersteki `add` hatırla). Boyut hizanın katı olmasaydı ikinci eleman hizasız bir adrese
düşerdi.

```quiz
question: "`size_of::<char>()` kaç döndürür? (Modül 2'yi hatırla)"
options:
  - "1, çünkü bir karakter bir bayttır"
  - "4, çünkü `char` herhangi bir Unicode skaler değerini tutabilir"
  - "Karaktere göre değişir: `'a'` için 1, `'ş'` için 2"
  - "2, çünkü Java'daki gibi UTF-16 kullanır"
answer: 1
explanation: |
  Rust'ta `char` sabit 4 baytlık bir **Unicode skaler değeridir** (U+0000..U+10FFFF, vekil aralığı
  hariç). Değişken uzunluk (1-4 bayt) `String`/`&str` içindeki **UTF-8** kodlamasına aittir; tek başına
  duran bir `char` her zaman 4 bayttır. Bu yüzden `"şeker".len()` 6 verir ama `"şeker".chars()` 5 tane
  4 baytlık `char` üretir.
feedback:
  - "C'deki `char` 1 bayttır; Rust'taki `char` bambaşka bir şeydir."
  - "Doğru!"
  - "Bu UTF-8 kodlamasının davranışıdır, yani `String` içindeki baytların. Tek bir `char` hep 4 bayttır."
  - "Java'nın `char`'ı 2 bayttır ve bu yüzden bazı emojileri tek `char`'da tutamaz. Rust 4 bayt kullanarak bu sorunu yaşamaz."
```

## Dolgu (padding) ve alan sıralaması

Aşağıda aynı üç alana sahip iki struct var. Tek fark: birinin üstünde `#[repr(C)]` yazıyor. Tahmin et:

```predict
code: |
  #[allow(dead_code)]
  #[repr(C)]
  struct CSensor {
      aktif: u8,
      deger: u32,
      kanal: u8,
  }

  #[allow(dead_code)]
  struct RustSensor {
      aktif: u8,
      deger: u32,
      kanal: u8,
  }

  fn main() {
      println!("{} {}", size_of::<CSensor>(), size_of::<RustSensor>());
  }
options:
  - "6 6"
  - "12 12"
  - "12 8"
  - "8 12"
answer: 2
explanation: |
  Alanların toplamı 1 + 4 + 1 = 6 bayt, ama ikisi de 6 değil. `repr(C)` alanları **yazıldığı sırayla**
  dizer: `aktif` 0'da, `deger` 4'ün katı olmak zorunda olduğu için 4'te (1-3 arası **dolgu**), `kanal` 8'de;
  toplam 9 bayt hizanın (4) katına yuvarlanır: **12**. Rust'ın varsayılan düzeni ise alanların sırasını
  **değiştirmekte serbesttir**: `deger`'i başa alır, iki `u8`'i arkasına dizer: 4 + 1 + 1 = 6 → 4'ün katı
  **8**.
```

Adım adım bakalım. `std::mem::offset_of!` makrosu bir alanın struct'ın başından itibaren kaçıncı baytta
başladığını söyler:

```rust
use std::mem::offset_of;

#[allow(dead_code)]
#[repr(C)]
struct CSensor {
    aktif: u8,
    deger: u32,
    kanal: u8,
}

#[allow(dead_code)]
struct RustSensor {
    aktif: u8,
    deger: u32,
    kanal: u8,
}

fn main() {
    println!(
        "CSensor:    aktif@{} deger@{} kanal@{} → {} bayt",
        offset_of!(CSensor, aktif),
        offset_of!(CSensor, deger),
        offset_of!(CSensor, kanal),
        size_of::<CSensor>()
    );
    println!(
        "RustSensor: aktif@{} deger@{} kanal@{} → {} bayt",
        offset_of!(RustSensor, aktif),
        offset_of!(RustSensor, deger),
        offset_of!(RustSensor, kanal),
        size_of::<RustSensor>()
    );
}
```

```memory
title: "Aynı alanlar, iki farklı düzen"
steps:
  - caption: "`#[repr(C)]`: alanlar yazıldığı sırada. `deger` 4'ün katında başlamalı → 3 bayt dolgu; sonda da toplamı 4'ün katına tamamlayan 3 bayt dolgu. **12 bayt**, yarısı boşluk!"
    stack:
      - frame: "CSensor (12 bayt)"
        vars:
          - { name: aktif, type: u8, value: "bayt 0" }
          - { name: dolgu, type: "[u8; 3]", value: "bayt 1-3", moved: true, note: "boş" }
          - { name: deger, type: u32, value: "bayt 4-7" }
          - { name: kanal, type: u8, value: "bayt 8" }
          - { name: dolgu, type: "[u8; 3]", value: "bayt 9-11", moved: true, note: "boş" }
  - caption: "Varsayılan Rust düzeni: derleyici `deger`'i başa aldı, iki `u8`'i arkasına sıkıştırdı. Sadece 2 bayt dolgu, **8 bayt**."
    stack:
      - frame: "RustSensor (8 bayt)"
        vars:
          - { name: deger, type: u32, value: "bayt 0-3" }
          - { name: aktif, type: u8, value: "bayt 4" }
          - { name: kanal, type: u8, value: "bayt 5" }
          - { name: dolgu, type: "[u8; 2]", value: "bayt 6-7", moved: true, note: "boş" }
```

`repr(C)` düzeninin algoritması basittir ve C derleyicilerinin yaptığının aynısıdır:

1. Bir `konum` sayacını 0'dan başlat.
2. Her alan için: `konum`'u alanın hizasının bir sonraki katına **yukarı yuvarla** (aradaki baytlar
   dolgu), alanı oraya koy, `konum`'a alanın boyutunu ekle.
3. Struct'ın hizası, alanların hizalarının **en büyüğüdür** (boş struct için 1).
4. Toplam boyut, son `konum`'un struct hizasına yukarı yuvarlanmış hâlidir (sondaki dolgu).

C ve C++ alanları **asla** yeniden sıralamaz; standart, bildirim sırasını korumayı şart koşar. Bu yüzden C++
programcıları büyük alanları elle başa yazmayı öğrenir. Rust varsayılan olarak bu işi senin yerine yapar,
ama karşılığında **hiçbir düzen garantisi vermez**: alan sırası derleyici sürümünden sürüme, hatta aynı
alanlara sahip iki farklı struct arasında bile değişebilir. Yukarıdaki `RustSensor` çıktısı Playground'daki
derleyicinin bugünkü kararıdır, bir söz değildir.

:::warning Varsayılan düzene asla güvenme
Bir struct'ın baytlarını ham işaretçiyle okuyorsan, C'ye gönderiyorsan, dosyaya ya da ağa olduğu gibi
yazıyorsan **mutlaka** `#[repr(C)]` (ya da aşağıdaki diğer `repr`'lerden biri) kullan. Nightly'deki
`-Z randomize-layout` bayrağı alan sırasını kasıtlı olarak karıştırır; varsayılan düzene gizlice bağımlı kod
bu bayrakla hemen ortaya çıkar.
:::

```exercise
id: m24-e-repr-c-duzeni
title: Uydu telemetrisi için düzen hesaplayıcı
difficulty: 3
prompt: |
  Bir yerli uydu projesinde yer istasyonu yazılımı Rust'ta, uydunun yazılımı ise C'de yazılıyor. Telemetri
  paketleri `#[repr(C)]` struct'lar olarak gönderiliyor ve ekip, C başlık dosyasındaki boyutlarla Rust
  tarafının tutup tutmadığını otomatik kontrol etmek istiyor.

  İki fonksiyon yaz:

  - `yukari_yuvarla(n, hiza)`: `n`'yi `hiza`'nın **`n`'den küçük olmayan en küçük katına** yuvarlar.
    `hiza` her zaman 2'nin bir kuvvetidir (1, 2, 4, 8...). Örnek: `(5, 4)` → `8`, `(8, 4)` → `8`, `(0, 8)` → `0`.
  - `repr_c_duzeni(alanlar)`: alanları sırasıyla `(boyut, hiza)` çiftleri olarak verilen bir `#[repr(C)]`
    struct'ın `(toplam_boyut, hiza)` değerini derste gördüğün 4 adımlık algoritmayla hesaplar.
    Alan yoksa sonuç `(0, 1)`'dir.

  Testler senin sonucunu **gerçek** `size_of` / `align_of` değerleriyle karşılaştıracak.
starter: |
  fn yukari_yuvarla(n: usize, hiza: usize) -> usize {
      todo!()
  }

  fn repr_c_duzeni(alanlar: &[(usize, usize)]) -> (usize, usize) {
      todo!()
  }

  fn main() {
      // #[repr(C)] struct { aktif: u8, deger: u32, kanal: u8 }
      let (boyut, hiza) = repr_c_duzeni(&[(1, 1), (4, 4), (1, 1)]);
      println!("boyut={boyut} hiza={hiza}");
  }
solution: |
  fn yukari_yuvarla(n: usize, hiza: usize) -> usize {
      // hiza > 0. (n + hiza - 1) / hiza, n/hiza'nın yukarı yuvarlanmış hâlidir.
      (n + hiza - 1) / hiza * hiza
  }

  fn repr_c_duzeni(alanlar: &[(usize, usize)]) -> (usize, usize) {
      let mut konum = 0;
      let mut en_buyuk_hiza = 1;
      for &(boyut, hiza) in alanlar {
          konum = yukari_yuvarla(konum, hiza); // alan öncesi dolgu
          konum += boyut;
          en_buyuk_hiza = en_buyuk_hiza.max(hiza);
      }
      // sondaki dolgu: toplam boyut hizanın katı olmalı
      (yukari_yuvarla(konum, en_buyuk_hiza), en_buyuk_hiza)
  }

  fn main() {
      // #[repr(C)] struct { aktif: u8, deger: u32, kanal: u8 }
      let (boyut, hiza) = repr_c_duzeni(&[(1, 1), (4, 4), (1, 1)]);
      println!("boyut={boyut} hiza={hiza}");
  }
check: tests
tests: |
  #[test]
  fn yuvarlama_dogru() {
      assert_eq!(yukari_yuvarla(5, 4), 8, "5, 4'ün katına yukarı yuvarlanınca 8 olur");
      assert_eq!(yukari_yuvarla(8, 4), 8, "8 zaten 4'ün katı; değişmemeli");
      assert_eq!(yukari_yuvarla(0, 8), 0, "0 her sayının katıdır");
      assert_eq!(yukari_yuvarla(9, 8), 16, "9 → 16");
      assert_eq!(yukari_yuvarla(3, 1), 3, "hiza 1 iken sayı değişmez");
  }

  #[test]
  fn sensor_struct_ile_ayni() {
      #[allow(dead_code)]
      #[repr(C)]
      struct CSensor { aktif: u8, deger: u32, kanal: u8 }
      assert_eq!(
          repr_c_duzeni(&[(1, 1), (4, 4), (1, 1)]),
          (size_of::<CSensor>(), align_of::<CSensor>()),
          "u8, u32, u8 → 12 bayt, hiza 4 (iki yerde 3'er bayt dolgu)"
      );
  }

  #[test]
  fn karisik_telemetri_paketi() {
      #[allow(dead_code)]
      #[repr(C)]
      struct Paket { tur: u8, sicaklik: i16, zaman: u64, durum: u8 }
      #[allow(dead_code)]
      #[repr(C)]
      struct Kisa { kod: u16, bayrak: u8 }
      #[allow(dead_code)]
      #[repr(C)]
      struct Baytlar { a: u8, b: u8, c: u8 }
      assert_eq!(
          repr_c_duzeni(&[(1, 1), (2, 2), (8, 8), (1, 1)]),
          (size_of::<Paket>(), align_of::<Paket>()),
          "u8, i16, u64, u8 → zaman 8'in katında başlamalı ve sonda dolgu olmalı"
      );
      assert_eq!(
          repr_c_duzeni(&[(2, 2), (1, 1)]),
          (size_of::<Kisa>(), align_of::<Kisa>()),
          "u16, u8 → sondaki dolguyu unutma (3 değil 4)"
      );
      assert_eq!(
          repr_c_duzeni(&[(1, 1), (1, 1), (1, 1)]),
          (size_of::<Baytlar>(), align_of::<Baytlar>()),
          "üç u8 → hiç dolgu yok"
      );
  }

  #[test]
  fn bos_struct() {
      assert_eq!(repr_c_duzeni(&[]), (0, 1), "alan yoksa boyut 0, hiza 1 olmalı");
  }
hints:
  - "Yukarı yuvarlama için klasik hile: `(n + hiza - 1) / hiza * hiza`. Tamsayı bölmesi aşağı yuvarlar; önce `hiza - 1` eklemek onu yukarı yuvarlamaya çevirir."
  - "`repr_c_duzeni` içinde iki sayaç tut: `konum` (0'dan başlar) ve `en_buyuk_hiza` (1'den başlar). Her alanda önce `konum`'u alanın hizasına yuvarla, sonra boyutu ekle."
  - "Döngüden sonra sondaki dolguyu ekle: `(yukari_yuvarla(konum, en_buyuk_hiza), en_buyuk_hiza)`. `for &(boyut, hiza) in alanlar` deseni çifti parçalara ayırır (Modül 21)."
explanation: |
  `repr(C)` düzeni tamamen **belirlenimlidir (deterministic)**: alan listesi ve her alanın boyut/hizası
  bilindiği an sonuç kesindir. C derleyicileri de aynı algoritmayı kullandığı için iki taraf aynı baytlara
  aynı anlamı verir. Testlerin `size_of`/`align_of` ile birebir tutması bunun kanıtı.

  En sık yapılan iki hata: sondaki dolguyu unutmak (`u16, u8` için 3 bulmak) ve hizayı `max` yerine son
  alanın hizası sanmak. İkisi de dizilerde ikinci elemanı hizasız bırakırdı.

  Hiza 2'nin kuvveti olduğu için profesyonel kodda yuvarlama genellikle bit işlemiyle yazılır:
  `(n + hiza - 1) & !(hiza - 1)`. Std'de ise `usize::next_multiple_of(hiza)` metodu hazır. Rust'ın kendi
  tarafında bu hesapları `std::alloc::Layout` tipi yapar: `Layout::new::<T>()` ve `Layout::extend` tam
  olarak bu algoritmanın kütüphane hâlidir. Bir de pratik ders: alanları **büyükten küçüğe** yazarsan
  `repr(C)` struct'larda bile dolgu çoğu zaman en aza iner.
```

## repr ailesi: C, u8, transparent, packed

`#[repr(...)]` özniteliği derleyiciye "bu tipin bellek düzenini sen seçme, ben söylüyorum" der. 3. derste
`repr(C)`'yi FFI için kullanmıştın. Ailenin diğer üyeleri farklı ihtiyaçlara cevap verir.

**`repr(u8)`, `repr(i32)`... (enum'lar için):** Bir enum'un gizli **ayırt edicisinin (discriminant)** tam
tipini belirler. Bir protokolde komutlar tek bayt olarak geliyorsa ya da C'deki bir `enum`'la eşleşmen
gerekiyorsa kullanılır. Her varyanta açık bir sayı da verebilirsin:

```rust
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
enum Komut {
    Dur = 0,
    Ileri = 1,
    Geri = 2,
    Don = 10,
}

impl Komut {
    /// Ağdan gelen bayt geçerli bir komut değilse None döner.
    fn bayttan(b: u8) -> Option<Komut> {
        match b {
            0 => Some(Komut::Dur),
            1 => Some(Komut::Ileri),
            2 => Some(Komut::Geri),
            10 => Some(Komut::Don),
            _ => None,
        }
    }
}

fn main() {
    println!("boyut: {} bayt", size_of::<Komut>());
    let k = Komut::Don;
    println!("{k:?} → {}", k as u8); // enum → sayı: güvenli
    for b in [1, 7, 10] {
        println!("{b} → {:?}", Komut::bayttan(b)); // sayı → enum: kontrol ederek
    }
}
```

Yön önemli: enum'dan sayıya `as` ile gitmek her zaman güvenlidir; sayıdan enum'a ise **kontrol ederek**
gitmelisin. `std::mem::transmute::<u8, Komut>(7)` yazmak 4. dersteki UB tablosunun "geçersiz enum ayırt
edicisi" satırıdır: `7` hiçbir varyanta karşılık gelmez ve derleyici `match`'i bunun asla olmayacağını
varsayarak derlemiştir. Gerçek kodda `bayttan` yerine Modül 11'deki `TryFrom<u8>`'i uygularsın.

**`repr(transparent)`:** Tek bir (sıfır boyutlu olmayan) alanı olan bir struct'ın bellekte ve **çağrı
kuralında (ABI)** o alanla birebir aynı olmasını garanti eder. Modül 22'deki newtype'lar için idealdir:
tip güvenliği kazanırsın, FFI'da hiçbir şey kaybetmezsin. Şu örnekte C'nin `abs` fonksiyonu doğrudan
`Puan` alıp `Puan` döndürecek şekilde bildirildi:

```rust
#[repr(transparent)]
#[derive(Debug, Clone, Copy)]
struct Puan(i32);

unsafe extern "C" {
    // Puan, ABI düzeyinde bir i32'dir; bu bildirim C'deki `int abs(int)` ile uyumlu.
    safe fn abs(x: Puan) -> Puan;
}

fn main() {
    let ceza = Puan(-42);
    println!("{:?}", abs(ceza));
    println!("Puan: {} bayt, i32: {} bayt", size_of::<Puan>(), size_of::<i32>());
}
```

İkinci bir gerçek alan eklemeye çalışırsan derleyici hemen durdurur:

:::error
```text
error[E0690]: transparent struct needs at most one non-trivial field, but has 2
 --> src/main.rs:2:1
  |
2 | struct Metre(f64, u8);
  | ^^^^^^^^^^^^ ---  -- this field has non-zero size
  | |            |
  | |            this field has non-zero size
  | needs at most one non-trivial field, but has 2
```
"Non-trivial" sıfır boyutlu olmayan demek. `PhantomData<T>` gibi sıfır boyutlu alanlar (Modül 22) serbesttir:
`struct Uzunluk<Birim>(f64, PhantomData<Birim>)` hâlâ `transparent` olabilir.
:::

**`repr(packed)`:** Bütün dolguyu kaldırır, hizayı 1'e indirir. Donanım kayıtları ya da sıkışık dosya/ağ
formatları için vardır. Ama bedeli ağırdır. Tahmin et:

```compiles
code: |
  #[repr(C, packed)]
  struct Paket {
      tur: u8,
      deger: u32,
  }

  fn main() {
      let p = Paket { tur: 1, deger: 500 };
      let r = &p.deger;
      println!("{} {r}", p.tur);
  }
answer: false
error: E0793
explanation: |
  `packed` struct'ta `deger` 1. bayttan başlar, yani 4'ün katı olmayan bir adreste. `&p.deger` **hizasız
  bir referans** olurdu ve hizasız referans oluşturmak, kullanılmasa bile UB'dir. Derleyici bunu E0793 ile
  reddeder. Çözüm: alanı önce kopyala (`let d = p.deger;`) ya da `&raw const p.deger` ile ham işaretçi
  alıp `read_unaligned` kullan.
```

:::error
```text
error[E0793]: reference to field of packed struct is unaligned
 --> src/main.rs:9:13
  |
9 |     let r = &p.deger;
  |             ^^^^^^^^
  |
  = note: this struct is 1-byte aligned, but the type of this field may require higher alignment
  = note: creating a misaligned reference is undefined behavior (even if that reference is never dereferenced)
  = help: copy the field contents to a local variable, or replace the reference with a raw pointer and use `read_unaligned`/`write_unaligned` (loads and stores via `*p` must be properly aligned even when using raw pointers)
```
`help:` satırı iki çıkış yolunu da söylüyor. Dikkat: `println!("{}", p.deger)` bile referans alır
(`println!` argümanlarını ödünç alır), o yüzden onu da önce yerel bir değişkene kopyalaman gerekir.
:::

Tersi de var: **`repr(align(64))`** hizayı **büyütür**. Modül 18'deki thread'ler aynı 64 baytlık önbellek
satırındaki (cache line) farklı sayaçları güncellerse birbirlerini yavaşlatır (**false sharing**); her
sayacı kendi satırına koymak için bu öznitelik kullanılır. `crossbeam`'in `CachePadded<T>` tipi tam olarak
budur.

| `repr` | Ne garanti eder? | Tipik kullanım |
|--------|------------------|----------------|
| (yok) | Hiçbir şey; derleyici yeniden sıralar | Saf Rust kodu, her zaman ilk tercih |
| `C` | C'nin alan sırası, hizası ve dolgusu | FFI, baytları dosyaya/ağa yazmak |
| `u8`, `i32`, ... | Enum ayırt edicisinin tipi | Protokol kodları, C enum'ları |
| `transparent` | Tek alanla aynı düzen ve ABI | FFI'da newtype'lar |
| `packed` | Dolgu yok, hiza 1 | Donanım, sıkışık formatlar (dikkat: E0793) |
| `align(N)` | En az `N` hizası | False sharing'i önlemek, SIMD |

## Niş optimizasyonu: bedava Option

Şimdi dersin başında söz verdiğimiz sürpriz. Tahmin et:

```predict
code: |
  fn main() {
      println!("{}", size_of::<i32>());
      println!("{}", size_of::<Option<i32>>());
      println!("{}", size_of::<&i32>());
      println!("{}", size_of::<Option<&i32>>());
  }
options:
  - |
    4
    4
    8
    8
  - |
    4
    8
    8
    16
  - |
    4
    8
    8
    8
  - |
    4
    5
    8
    9
answer: 2
explanation: |
  `Option<i32>`'nin "değer yok" durumunu bir yerde saklaması gerekir: `i32`'nin 2³² bit deseninin **hepsi**
  geçerli bir sayıdır, boşta desen yoktur. Bu yüzden ayrı bir etiket eklenir ve hiza yüzünden 4 + 4 = **8**
  bayt olur. `&i32` ise asla **null** olamaz (Modül 5'ten beri bildiğin garanti). Tamamen sıfır olan adres
  deseni hiçbir geçerli referansa ait değildir; Rust bu boştaki deseni `None` anlamında kullanır.
  Sonuç: `Option<&i32>` de **8** bayt; tek bir bayt bile ek maliyet yok.
```

Bir tipin hiçbir zaman almadığı bit desenlerine **niş (niche)** denir. Rust, bir enum'un etiketini bu
desenlere **saklayarak** ekstra yer harcamaktan kaçınır:

```memory
title: "Option'ın etiketi nereye gitti?"
steps:
  - caption: "`Option<i32>`: `i32`'nin boşta bit deseni yok, ayrı bir etiket gerekiyor. 4 bayt veri + 4 bayt (etiket ve dolgu) = 8."
    stack:
      - frame: main
        vars:
          - { name: a, type: "Option<i32>", value: "etiket=1 | dolgu | 42", note: "Some(42), 8 bayt" }
          - { name: b, type: "Option<i32>", value: "etiket=0 | dolgu | ????", note: "None, 8 bayt" }
  - caption: "`Option<&i32>`: referans asla 0 olamaz. `Some` ise gerçek adres, `None` ise 0x0. Etikete gerek yok: 8 bayt."
    stack:
      - frame: main
        vars:
          - { name: x, type: i32, value: "42" }
          - { name: c, type: "Option<&i32>", value: "0x7ffd_5a10", to: x, note: "Some(&x)" }
          - { name: d, type: "Option<&i32>", value: "0x0000_0000", note: "None = null deseni" }
```

Nişi olan tiplerden bazıları:

| Tip | Niş (asla almadığı değerler) | `Option<T>` boyutu |
|-----|------------------------------|--------------------|
| `&T`, `&mut T`, `Box<T>`, `Rc<T>`, `Arc<T>`, `NonNull<T>` | null adres | `T` ile aynı (8) |
| `Vec<T>`, `String` | içteki işaretçi null olamaz | 24 |
| `fn(i32) -> i32` | null fonksiyon işaretçisi | 8 |
| `NonZeroU32` ve diğer `NonZero*` | 0 | 4 |
| `bool` | 2..=255 | 1 (`Option<Option<bool>>` bile 1!) |
| `char` | 0x10FFFF üstü ve vekil aralığı | 4 |
| `enum Yon { K, G, D, B }` | kullanılmayan ayırt ediciler (4..=255) | 1 |

Java'da her nesne referansı zaten `null` olabilir ve hata kaynağıdır; C'de "bulunamadı" için `NULL`
işaretçisi ya da `-1` gibi **sihirli değerler** (sentinel) kullanılır ve kontrol etmeyi unutmak kolaydır.
Rust aynı sıkı bellek düzenini elde eder ama "değer yok" durumunu **tip sisteminde** tutar: `Option`'ı
kontrol etmeden içindekini kullanamazsın. Güvenlik de, verimlilik de senin.

Bunun FFI'da çok somut bir sonucu var: Rust **garanti eder** ki `Option<&T>`, `Option<Box<T>>`,
`Option<NonNull<T>>` ve `Option<extern "C" fn(...)>` bellekte C'deki "null olabilen işaretçi" ile aynıdır.
3. dersteki qsort örneğinde geri çağırma isteğe bağlı olsaydı, `Option<extern "C" fn(...)>` yazıp C'nin
`NULL` geçmesine izin verebilirdin.

:::analogy Okul numarası sıfır olamaz
Bir okulda öğrenci numaraları 1'den başlıyor. Yoklama defterindeki bir hücreye "öğrenci var mı?" diye ayrı
bir sütun açmana gerek yok: hücreye **0** yazmak "burada öğrenci yok" demek için yeter, çünkü 0 numaralı
öğrenci zaten **olamaz**. Niş optimizasyonu, tipin asla kullanmadığı bu "0 numarasını" `None` için
kullanmaktır.
:::

```quiz
question: "`size_of::<Option<Rc<String>>>()` 64 bitlik bir makinede kaçtır? (Modül 17'yi hatırla)"
options:
  - "8, çünkü `Rc` heap'teki bloğu gösteren ve asla null olmayan bir işaretçidir"
  - "16, çünkü `Option` her zaman bir etiket ekler"
  - "32, çünkü `Rc` sayaçları ve `String`'i (24 bayt) içerir"
  - "24, çünkü `String` 24 bayttır"
answer: 0
explanation: |
  `Rc<T>` stack'te **tek bir işaretçidir**; güçlü/zayıf sayaçlar ve `String`'in kendisi heap'teki blokta
  durur (Modül 17). O işaretçi içeride `NonNull` olarak tutulur, yani asla null değildir. `Option` null
  desenini `None` için kullanır ve 8 bayt kalır. `Option<Arc<T>>`, `Option<Box<T>>` için de aynısı geçerli.
feedback:
  - "Doğru!"
  - "Nişi olan tiplerde `Option` etiket eklemez; null deseni `None` olur."
  - "Sayaçlar ve `String` heap'te yaşar; stack'teki `Rc` sadece bir adrestir."
  - "`Rc<String>`'in stack'teki boyutu `String`'inki değil, bir işaretçininki kadardır."
```

```exercise
id: m24-e-ogrenci-no
title: Öğrenci numarasını nişle sıkıştır
difficulty: 3
prompt: |
  Bir üniversitenin öğrenci bilgi sisteminde milyonlarca ders kaydı var. Her kayıtta `Option<OgrenciNo>`
  tipinde bir "danışman öğrenci" alanı bulunuyor. Öğrenci numaraları asla `0` olmuyor.

  Şu an `OgrenciNo(u32)` olarak tanımlı ve `Option<OgrenciNo>` 8 bayt tutuyor. Tipi, `Option`'ı da
  **4 bayta** indirecek şekilde yeniden tasarla ve iki metodu yaz:

  - `OgrenciNo::yeni(n)`: `n` sıfırsa `None`, değilse `Some(OgrenciNo)` döndürür.
  - `deger(self)`: numarayı `u32` olarak geri verir.

  İpucu kelime: `std::num::NonZeroU32`. `NonZeroU32::new(n)` bir `Option<NonZeroU32>` döndürür,
  `.get()` ise içindeki `u32`'yi verir.
starter: |
  // TODO: alanın tipini değiştir
  #[derive(Debug, Clone, Copy, PartialEq)]
  struct OgrenciNo(u32);

  impl OgrenciNo {
      fn yeni(n: u32) -> Option<OgrenciNo> {
          todo!()
      }

      fn deger(self) -> u32 {
          todo!()
      }
  }

  fn main() {
      let no = OgrenciNo::yeni(2024_0153);
      println!("{no:?}");
      println!("Option<OgrenciNo>: {} bayt", size_of::<Option<OgrenciNo>>());
  }
solution: |
  use std::num::NonZeroU32;

  #[derive(Debug, Clone, Copy, PartialEq)]
  struct OgrenciNo(NonZeroU32);

  impl OgrenciNo {
      fn yeni(n: u32) -> Option<OgrenciNo> {
          NonZeroU32::new(n).map(OgrenciNo)
      }

      fn deger(self) -> u32 {
          self.0.get()
      }
  }

  fn main() {
      let no = OgrenciNo::yeni(2024_0153);
      println!("{no:?}");
      println!("Option<OgrenciNo>: {} bayt", size_of::<Option<OgrenciNo>>());
  }
check: tests
tests: |
  #[test]
  fn sifir_gecersiz() {
      assert!(OgrenciNo::yeni(0).is_none(), "0 geçerli bir öğrenci numarası değil, None dönmeli");
  }

  #[test]
  fn gecerli_numaralar_korunur() {
      let a = OgrenciNo::yeni(2024_0153).expect("2024_0153 geçerli bir numara");
      assert_eq!(a.deger(), 2024_0153, "numara aynen geri verilmeli");
      let b = OgrenciNo::yeni(1).expect("1 geçerli");
      assert_eq!(b.deger(), 1);
      let c = OgrenciNo::yeni(u32::MAX).expect("u32::MAX geçerli");
      assert_eq!(c.deger(), u32::MAX, "en büyük u32 de korunmalı");
  }

  #[test]
  fn option_ek_yer_kaplamaz() {
      assert_eq!(size_of::<OgrenciNo>(), 4, "OgrenciNo 4 bayt olmalı");
      assert_eq!(
          size_of::<Option<OgrenciNo>>(),
          4,
          "Option<OgrenciNo> da 4 bayt olmalı: None için 0 nişini kullan (NonZeroU32)"
      );
  }
hints:
  - "Alanın tipini `u32` yerine `std::num::NonZeroU32` yap. Bu tip 0 değerini asla almaz; Rust da o deseni `None` için kullanır."
  - "`NonZeroU32::new(n)` zaten `Option<NonZeroU32>` döndürür. Onu `match` ile ya da `.map(...)` ile `Option<OgrenciNo>`'ya çevirebilirsin."
  - "`NonZeroU32::new(n).map(OgrenciNo)`, tuple struct'ın adı bir fonksiyon gibi kullanılabilir (Modül 22). `deger` için `self.0.get()`."
forbid:
  - pattern: "unsafe"
    message: "Bu alıştırma hiç `unsafe` yazmadan çözülebilir; `NonZeroU32::new` kontrolü senin yerine yapar."
explanation: |
  `NonZeroU32` "0 olamaz" bilgisini **tipin içine** yazar; derleyici bu bilgiyi hem doğruluk için (kimse
  `OgrenciNo(0)` üretemez) hem de bellek düzeni için kullanır. Tek alanlı struct'lar alanlarının nişini
  devralır, bu yüzden `Option<OgrenciNo>` de 4 bayttır. Milyonlarca kayıtta bu, o alan için belleğin
  yarıya inmesi demek; daha az bellek, işlemci önbelleğine daha fazla kayıt sığması demektir.

  `.map(OgrenciNo)` Modül 22'deki "tuple struct kurucusu bir fonksiyondur" fikrini kullanıyor;
  `match NonZeroU32::new(n) { Some(nz) => Some(OgrenciNo(nz)), None => None }` de tamamen aynı işi yapar.

  `NonZeroU32::new_unchecked(n)` adında bir `unsafe fn` de var: 0 vermediğine söz verirsen kontrolü atlar.
  0 verirsen geçersiz değer üretmiş olursun (UB). Kontrollü `new`'in maliyeti tek bir karşılaştırma olduğu
  için neredeyse hiçbir zaman buna değmez. Genel kural bu modülün özeti gibi: **önce güvenli API, ölçülmüş
  bir gerekçe olmadan asla `unchecked`.**
```

## MaybeUninit: başlatılmamış bellek

C'de `int sayilar[1000];` yazdığında dizi **çöple** doludur: o bellekte daha önce ne kaldıysa. Okumayı
unutmak C'nin klasik hatalarından biridir. Rust bunu güvenli kodda tamamen yasaklar. Önce hatırla:

```compiles
code: |
  fn main() {
      let puan: i32;
      let bonus = true;
      if bonus {
          println!("bonus var");
      }
      println!("{}", puan + 1);
  }
answer: false
error: E0381
explanation: |
  Modül 2'den tanıdık: `puan` bildirildi ama hiçbir yolda bir değer atanmadı. Rust, okunmadan önce her
  değişkenin **kesinlikle** başlatıldığını derleme zamanında kanıtlamak ister: "used binding puan isn't
  initialized" (E0381). C derleyicisi burada en fazla bir uyarı verir ve program çöp değerle çalışırdı.
```

Peki başlatılmamış bellek **gerçekten** gerektiğinde ne olacak? Örnekler: bir C fonksiyonu sonucu senin
verdiğin bir tampona yazıyorsa (çıktı parametresi, *out-parameter*), büyük bir diziyi eleman eleman
doldururken önce sıfırlamanın maliyetinden kaçınmak istiyorsan, ya da `Vec` gibi bir veri yapısı yazıyorsan
(bir `Vec`'in kullanılmayan kapasitesi tam olarak başlatılmamış bellektir; `set_len`'in `unsafe` olması bu
yüzden).

Bunun aracı **`std::mem::MaybeUninit<T>`**: "burada bir `T` için yer var ama içi **belki** henüz
başlatılmadı" diyen bir sarmalayıcı. Boyutu ve hizası `T` ile aynıdır, ama derleyici içinin geçerli bir `T`
olduğunu **varsaymaz**.

```rust
use std::mem::MaybeUninit;

fn main() {
    // 1) Yer ayır, ama başlatma.
    let mut kutu: MaybeUninit<[String; 3]> = MaybeUninit::uninit();
    let p = kutu.as_mut_ptr() as *mut String;

    // 2) Her elemanı `write` ile yaz.
    let sehirler = ["Ankara", "İzmir", "Van"];
    for (i, ad) in sehirler.iter().enumerate() {
        // SAFETY: i < 3, p.add(i) dizinin içinde kalır. `write` eski
        // (başlatılmamış) değeri okumaz ve drop etmeye çalışmaz.
        unsafe { p.add(i).write(ad.to_string()) };
    }

    // 3) Söz ver: "artık tamamen başlatıldı".
    // SAFETY: Üç elemanın üçü de yukarıda yazıldı.
    let dizi = unsafe { kutu.assume_init() };
    println!("{dizi:?}");
}
```

Sözleşmenin üç parçası var:

1. **`MaybeUninit::uninit()`**: güvenli. Sadece yer ayırır.
2. **`ptr.write(deger)`**: `*p = deger` yerine **`write`** kullan. Atama, sol taraftaki **eski değeri drop
   eder**; eski değer çöp olduğu için çöp bir `String`'in "heap belleğini" serbest bırakmaya çalışırsın: UB.
   `write` eskiye hiç dokunmaz.
3. **`assume_init()`**: `unsafe`. "İçi tamamen ve geçerli biçimde başlatıldı" sözüdür. Tek bir eleman bile
   eksikse, o eleman çöp bir değer olarak hayatına başlar: UB.

Bir incelik daha: `MaybeUninit<T>` içindekini **drop etmez** (neyin başlatıldığını bilemez). `assume_init`
çağırmadan kapsamdan çıkarsan, yazdığın `String`'ler sızar (leak). Sızıntı UB değildir, ama hatadır.

:::warning MaybeUninit'i yanlış kullanmanın en kısa yolu
```text
warning: the type `i32` does not permit being left uninitialized
 --> src/main.rs:3:27
  |
3 |     let x: i32 = unsafe { MaybeUninit::uninit().assume_init() };
  |                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  |                           |
  |                           this code causes undefined behavior when executed
  |                           help: use `MaybeUninit<T>` instead, and only call `assume_init` after initialization is done
  |
  = note: integers must be initialized
  = note: `#[warn(invalid_value)]` on by default
```
Hiçbir şey yazmadan `assume_init` çağırmak, `MaybeUninit`'i kullanmanın tam tersidir. Derleyici bu bariz
durumu `invalid_value` uyarısıyla yakalar, ama karmaşık durumları yakalayamaz; orada tek bekçi Miri'dir
(4. ders). Not: `i32` için bile başlatılmamış değer UB'dir; "her bit deseni geçerli" olması "hiç bit deseni
yok" durumunu kapsamaz. Eski `std::mem::uninitialized()` fonksiyonu tam da doğru kullanılması neredeyse
imkânsız olduğu için kullanımdan kaldırıldı ve yerini `MaybeUninit` aldı.
:::

```fill
prompt: "Boşlukları doldur: `[u32; 3]` dizisini başlatmadan ayır, karelerle doldur ve tamamen başlatılmış diziyi al."
code: |
  use std::mem::MaybeUninit;

  fn main() {
      let mut kutu = MaybeUninit::<[u32; 3]>::___0();
      let p = kutu.as_mut_ptr() as *mut u32;
      for i in 0..3 {
          // SAFETY: i < 3 olduğu için p.add(i) dizinin içinde kalır.
          unsafe { p.add(i).___1(i as u32 * i as u32) };
      }
      // SAFETY: üç eleman da yukarıda yazıldı.
      let dizi = unsafe { kutu.___2() };
      println!("{dizi:?}");
  }
blanks:
  - ["uninit"]
  - ["write"]
  - ["assume_init"]
output: "[0, 1, 4]"
explanation: |
  `uninit()` yeri ayırır, `write` her elemanı eski değere dokunmadan yazar, `assume_init()` ise
  "hepsi başlatıldı" sözüyle `MaybeUninit<[u32; 3]>`'ü gerçek bir `[u32; 3]`'e çevirir. Döngü `0..3`
  yerine `0..2` olsaydı program derlenir ve büyük ihtimalle bir şey yazdırırdı, ama son eleman başlatılmamış
  olurdu: UB. `MaybeUninit` derleyicinin yapmadığı kontrolü **sana** devreder.
```

```reflect
prompt: Kendi cümlelerinle açıkla, Rust'ın varsayılan struct düzeni neden hiçbir garanti vermiyor ve bu, `repr(C)` ile niş optimizasyonunu nasıl etkiliyor?
answer: |
  Model cevap: Garanti vermemek derleyiciye özgürlük tanır: alanları dolguyu en aza indirecek şekilde
  yeniden sıralayabilir ve enum etiketlerini tiplerin hiç kullanmadığı bit desenlerine (nişlere) saklayabilir.
  Bu sayede Rust tipleri çoğu zaman elle optimize edilmiş C struct'larından bile küçük olur. Bedeli, düzenin
  sürümden sürüme değişebilmesidir; bu yüzden baytlara dışarıdan (C, dosya, ağ, ham işaretçi) bakılacaksa
  `repr(C)` gibi bir `repr` ile düzeni sabitlemek gerekir. Niş optimizasyonu ise tip garantilerine
  (referans null olmaz, `NonZeroU32` 0 olmaz) dayanır; bazı durumları (`Option<&T>`, `Option<Box<T>>`)
  Rust FFI için resmen garanti eder.
```

## Özet ve sırada ne var?

:::remember
- `size_of::<T>()` boyut, `align_of::<T>()` hiza; **boyut her zaman hizanın katıdır**. `offset_of!(Tip, alan)` alanın konumunu verir.
- Alanların arasındaki ve sonundaki boşluklar **dolgu (padding)**. `repr(C)` alanları yazıldığı sırada dizer; varsayılan Rust düzeni yeniden sıralar ama **hiçbir garanti vermez**.
- `repr(u8)` enum ayırt edicisinin tipini, `repr(transparent)` tek alanla aynı düzen/ABI'yi (yoksa **E0690**), `repr(packed)` sıfır dolguyu (alan referansı **E0793**), `repr(align(N))` büyük hizayı sağlar.
- **Niş**: bir tipin asla almadığı bit deseni. `Option<&T>`, `Option<Box<T>>`, `Option<NonZeroU32>` ek yer kaplamaz.
- Sayıdan enum'a `transmute` değil, kontrol eden `match`/`TryFrom`.
- `MaybeUninit<T>`: `uninit()` → `ptr.write(..)` → `unsafe { assume_init() }`. Eksik başlatma UB; `*p = x` yerine `write`.
:::

Bu modülde `unsafe`'in kapısını araladın; içerisi çok daha derin. Buradan sonrası için yol haritası:

| Kaynak | Ne öğretir? |
|--------|-------------|
| **The Rustonomicon** (doc.rust-lang.org/nomicon) | Unsafe Rust'ın resmî "karanlık sanatlar" kitabı: varyans, drop check, `PhantomData`'nın inceliği, kendi `Vec`'ini ve `Arc`'ını sıfırdan yazmak |
| **Learn Rust With Entirely Too Many Linked Lists** | Bağlı liste yazarak ham işaretçileri, `Box`'ı ve Miri'yi uygulamalı öğrenmek |
| **std belgeleri**: `std::ptr`, `std::mem`, `MaybeUninit` | Her `unsafe fn`'nin `# Safety` bölümü tam sözleşmeyi yazar; her zaman önce orayı oku |
| **Unsafe Code Guidelines** ve Rust referansının "Behavior considered undefined" sayfası | UB'nin kesin listesi ve aliasing modeli |
| **Miri** (`cargo +nightly miri test`) | Yazdığın her unsafe kodun yanında |

:::ferris
Unsafe Rust'a korkarak değil, **saygıyla** yaklaşmayı öğrendin: küçük tut, sözleşmeyi yaz, güvenli bir
API'nin arkasına sakla, Miri'yle test et. Sıradaki modülde bu derin bilgiyi hız ve idiomatik kod için
kullanacağız! 🦀
:::

```flashcards
- front: "`#[repr(C)] struct { a: u8, b: u32, c: u8 }` kaç bayttır ve neden?"
  back: "12 bayt: `a` 0'da, 3 bayt dolgu, `b` 4-7, `c` 8'de, toplamı hizanın (4) katına tamamlayan 3 bayt dolgu."
- front: Bir tipin boyutu neden her zaman hizasının katıdır?
  back: "Dizilerde `i`'nci eleman `i × size_of::<T>()` adresindedir; boyut hizanın katı olmasaydı sonraki elemanlar hizasız adreslere düşerdi."
- front: Rust'ın varsayılan (repr'siz) struct düzeni hangi garantileri verir?
  back: "Neredeyse hiçbirini: derleyici alanları serbestçe yeniden sıralar ve düzen sürümden sürüme değişebilir. Dışarıdan bakılacaksa `repr(C)` gerekir."
- front: "`repr(transparent)` ne garanti eder?"
  back: "Tek (sıfır boyutlu olmayan) alanlı struct'ın bellek düzeninin ve ABI'sinin o alanla birebir aynı olmasını. FFI'da newtype için kullanılır."
- front: "`repr(packed)` bir struct'ın alanına `&p.alan` yazınca hangi hata çıkar?"
  back: "`E0793`, hizasız referans oluşturmak, kullanılmasa bile UB'dir. Alanı kopyala ya da `&raw const` + `read_unaligned` kullan."
- front: "`size_of::<Option<&i32>>()` neden `size_of::<&i32>()` ile aynıdır?"
  back: "Niş optimizasyonu: referans asla null olamaz, Rust null desenini `None` için kullanır; ayrı etikete gerek kalmaz."
- front: "`MaybeUninit` içindeki bir `String` alanına neden `*p = s` değil `p.write(s)` yazılır?"
  back: "Atama eski değeri drop eder; eski değer başlatılmamış çöp olduğu için bu UB'dir. `write` eski değere dokunmaz."
- front: "`MaybeUninit::assume_init()` çağrısının sözleşmesi nedir?"
  back: "İçerik tamamen ve geçerli biçimde başlatılmış olmalı; değilse tanımsız davranış."
```
