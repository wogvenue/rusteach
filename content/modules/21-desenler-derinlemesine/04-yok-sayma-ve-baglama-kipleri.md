---
id: m21-l04
title: Yok saymak, ref ve bağlama kipleri
minutes: 22
type: lesson
objectives:
  - "`_`, `_isim` ve `..` arasındaki farkı (bağlama yapıp yapmama, taşıma, drop zamanı) açıklayabilmek"
  - Bir desenin değeri ne zaman taşıdığını, ne zaman kısmi taşıma (partial move) yaptığını bellek diyagramıyla gösterebilmek
  - "`ref`, `ref mut` ve `&` desenlerini doğru yerde kullanabilmek"
  - Referans üzerinde eşleştirirken varsayılan bağlama kiplerinin (match ergonomics) bağlanan değişkenlerin tipini nasıl belirlediğini ve 2024 sürümü kurallarını açıklayabilmek
keywords: [_, "..", _x, partial move, kısmi taşıma, ref, ref mut, binding mode, bağlama kipi, match ergonomics, E0382]
---

Bir desen yalnızca şekil sınamaz; bağladığı her isim için bir karar da verir: değer bu isme
**taşınacak** mı, **kopyalanacak** mı, yoksa **ödünç mü** alınacak? Şimdiye kadar bu kararı çoğunlukla
derleyici senin yerine verdi ve sen fark etmedin. Bu derste perdeyi kaldırıyoruz.

Önce "bununla ilgilenmiyorum" demenin üç yolunu (`_`, `_isim`, `..`) göreceksin; aralarındaki fark
sandığından büyük. Sonra desenlerin sahiplikle (Modül 4-5) nasıl etkileştiğini, `ref` anahtar kelimesini
ve Rust'ın referanslar üzerinde eşleştirirken uyguladığı **varsayılan bağlama kiplerini (default binding
modes)** öğreneceksin.

## _ ve .. ile ilgilenmediğini söylemek

`_` (joker, wildcard) her değere uyar ve **hiçbir şeye bağlanmaz**. Desenin herhangi bir yerinde,
istediğin kadar kullanılabilir. `..` ise "geri kalan her şey" demektir:

```rust
struct Ogrenci {
    ad: &'static str,
    no: u32,
    sinif: u8,
    sube: char,
}

// Parametre bile olsa: bu fonksiyon ikinci değeri kullanmıyor
fn yazdir(baslik: &str, _: u32) {
    println!("== {baslik} ==");
}

fn main() {
    yazdir("Yoklama", 2024);

    let notlar = (90, 45, 70, 85, 60);
    let (ilk, _, ucuncu, _, _) = notlar; // birden çok _ serbest
    let (birinci, .., sonuncu) = notlar; // .. ortadaki her şey
    println!("ilk={ilk}, üçüncü={ucuncu}, uçlar={birinci}/{sonuncu}");

    let ece = Ogrenci { ad: "Ece", no: 1042, sinif: 9, sube: 'B' };
    let Ogrenci { ad, sube, .. } = ece; // no ve sinif yok sayıldı
    println!("{ad} ({sube} şubesi)");

    match ece {
        Ogrenci { sinif: 9..=12, no, .. } => println!("Lise öğrencisi #{no}"),
        Ogrenci { .. } => println!("Lise dışı"),
    }
}
```

`_`'yi parametrede görmek ilk bakışta tuhaf gelebilir. Sebebi, imzası önceden belirlenmiş fonksiyonlardır:
bir trait'in metodunu uyguladığında (Modül 11) ya da bir fonksiyonu başka bir yere fonksiyon değeri
olarak verdiğinde, kullanmadığın bir parametreyi de imzaya yazmak zorunda kalırsın.

`..`'nın tek bir kuralı var: anlamı belirsiz olmamalı. `(.., orta, ..)` desenine bakan biri `orta`'nın
kaçıncı eleman olduğunu bilemez; derleyici de bilemez:

:::error
```text
error: `..` can only be used once per tuple pattern
 --> src/main.rs:3:20
  |
3 |     let (.., orta, ..) = t;
  |          --        ^^ can only be used once per tuple pattern
  |          |
  |          previously used here
```
:::

```quiz
question: |
  `let veri = (1, 2, 3, 4, 5, 6);` için hangi desen `a = 1`, `b = 2` ve `z = 6` bağlar?
options:
  - "`let (a, b, .., z) = veri;`"
  - "`let (a, b, _, z) = veri;`"
  - "`let (a, b, .., .., z) = veri;`"
  - "`let (a, b, ..z) = veri;`"
answer: 0
explanation: |
  `..` ortadaki **istediğin kadar** elemanı (burada üç tanesini) yok sayar ve desende yalnızca bir kez
  bulunabilir. `_` ise tam olarak **bir** elemanın yerini tutar: `(a, b, _, z)` dört elemanlı bir tuple
  bekler ve altı elemanlı `veri` ile **E0308** verir.
feedback:
  - "Doğru! `..` aradaki üç elemanı birden yok sayar."
  - "`_` tek bir elemana karşılık gelir; bu desen 4 elemanlı bir tuple bekler (E0308)."
  - "`..` bir desende yalnızca bir kez kullanılabilir."
  - "`..z` bir aralık desenidir (üst sınır `z`); burada `z` bir sabit olmadığı için anlamsızdır."
```

## _isim ile _ aynı şey değil

Kullanılmayan bir değişkene `_` ile başlayan bir isim vermek (`_m`, `_urun`) derleyicinin "kullanılmayan
değişken" uyarısını susturur. İkisi aynı mı? Önce tahmin et:

```compiles
code: |
  fn main() {
      let s = String::from("merhaba");
      let _ = s;
      println!("{s}");
  }
answer: true
explanation: |
  Derlenir ve `merhaba` yazar! `_` bir **bağlama değildir**: değeri hiçbir isme koymaz, dolayısıyla
  hiçbir şeyi taşımaz. `let _ = s;` satırı `s`'ye dokunmadan geçer.
```

```compiles
code: |
  fn main() {
      let s = Some(String::from("merhaba"));
      if let Some(_m) = s {
          println!("dolu");
      }
      println!("{s:?}");
  }
answer: false
error: E0382
explanation: |
  Derlenmez: **E0382**, *borrow of partially moved value: `s`*. `_m` gerçek bir değişkendir; alt çizgi
  yalnızca uyarıyı susturur. `String` `_m`'ye **taşınır** ve `s` kısmen taşınmış olur. `Some(_)` yazsaydın
  hiçbir şey taşınmazdı ve kod derlenirdi.
```

Bellekte fark şöyle görünür:

```memory
title: "_ ile _m arasındaki fark"
steps:
  - caption: "`s` bir `Option<String>`: `Some` içindeki `String`'in başlığı stack'te, harfler heap'te."
    stack:
      - frame: main
        vars:
          - { name: s, type: "Option<String>", value: "Some(ptr · len=7 · cap=7)", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "`if let Some(_) = s`: desen yalnızca **sınar**. Hiçbir isim yok, hiçbir şey taşınmaz; `s` aynen geçerli."
    stack:
      - frame: main
        vars:
          - { name: s, type: "Option<String>", value: "Some(ptr · len=7 · cap=7)", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "`if let Some(_m) = s`: `_m` gerçek bir değişken. `String` ona **taşındı**; `s` artık kısmen taşınmış, kullanılamaz."
    stack:
      - frame: main
        vars:
          - { name: s, type: "Option<String>", value: "Some(<taşındı>)", moved: true, note: kısmen taşındı }
          - { name: _m, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
```

Bu farkın bir sonucu daha var ve Modül 17'deki `Drop`'u hatırlatır: `_` değeri hiçbir isme koymadığı için
`let _ = ifade;` satırındaki **geçici** değer o satırın sonunda hemen `drop` edilir. `_isim` ise değeri kapsam
sonuna kadar yaşatır:

```rust
struct Zamanlayici(&'static str);

impl Drop for Zamanlayici {
    fn drop(&mut self) {
        println!("  [{} durdu]", self.0);
    }
}

fn main() {
    println!("1) let _ =");
    let _ = Zamanlayici("A"); // geçici değer hemen drop edilir
    println!("   A'dan sonraki satır");

    println!("2) let _z =");
    let _z = Zamanlayici("B"); // _z kapsam sonuna kadar yaşar
    println!("   B'den sonraki satır");
    println!("main bitiyor");
}
```

:::warning Kilidi farkında olmadan bırakmak
Modül 18'deki `Mutex`'i hatırla: kilit, `MutexGuard` drop edilince açılır. `let _ = sayac.lock().unwrap();`
yazarsan guard o satırda hemen drop edilir ve kilit **anında** açılır; korumak istediğin kod korumasız kalır.
Bir RAII guard'ını kapsam boyunca tutmak istiyorsan ona her zaman bir isim ver: `let _kilit = ...;`
:::

## Desenler değeri taşır: kısmi taşıma

Desendeki her isim, değerin ilgili parçasını **sahiplik kurallarına göre** alır: `Copy` tipler kopyalanır,
diğerleri taşınır. Bir struct'ın yalnızca bazı alanlarını taşırsan ortaya **kısmi taşıma (partial move)**
çıkar:

```rust,compile_fail,E0382
#[derive(Debug)]
struct Kisi {
    ad: String,
    yas: u32,
}

fn main() {
    let k = Kisi { ad: String::from("Ali"), yas: 30 };
    let Kisi { ad, .. } = k;
    println!("{ad}");
    println!("{k:?}");
}
```

:::error
```text
error[E0382]: borrow of partially moved value: `k`
  --> src/main.rs:11:16
   |
 9 |     let Kisi { ad, .. } = k;
   |                -- value partially moved here
10 |     println!("{ad}");
11 |     println!("{k:?}");
   |                ^ value borrowed here after partial move
   |
   = note: partial move occurs because `k.ad` has type `String`, which does not implement the `Copy` trait
help: borrow this binding in the pattern to avoid moving the value
   |
 9 |     let Kisi { ref ad, .. } = k;
   |                +++
```
"Kısmen taşınmış" ne demek? `k.ad` artık `ad`'ın, ama `k.yas` hâlâ `k`'nin. `k`'yi **bütün olarak**
kullanamazsın; taşınmamış alanlarını tek tek kullanabilirsin: `println!("{}", k.yas);` derlenir.
`help` satırı ise bu dersin bir sonraki konusunu öneriyor: `ref`.
:::

```memory
title: "let Kisi { ad, .. } = k; sonrası"
steps:
  - caption: "`k` iki alanlı bir struct: `ad` heap'teki harflere işaret ediyor, `yas` doğrudan stack'te."
    stack:
      - frame: main
        vars:
          - { name: k.ad, type: String, value: "ptr · len=3 · cap=3", to: h1 }
          - { name: k.yas, type: u32, value: "30" }
    heap:
      - { id: h1, value: "A l i" }
  - caption: "Desen `ad`'ı bağladı: `String` başlığı `ad`'a **taşındı**. `k.ad` geçersiz, `k.yas` hâlâ geçerli."
    stack:
      - frame: main
        vars:
          - { name: k.ad, type: String, value: "ptr · len=3 · cap=3", moved: true, note: taşındı }
          - { name: k.yas, type: u32, value: "30", note: hâlâ geçerli }
          - { name: ad, type: String, value: "ptr · len=3 · cap=3", to: h1 }
    heap:
      - { id: h1, value: "A l i" }
```

Bu bir hata değil, bir özellik: büyük bir struct'ın parçalarını kopyalamadan farklı yerlere dağıtmak için
kısmi taşıma çok kullanışlıdır. Bütün değeri sonra da kullanmak istiyorsan ise üç yolun var: değeri
ödünç vererek eşleştir (`&k`), desende `ref` kullan ya da (gerçekten iki kopya istiyorsan) `clone`.

## ref ve ref mut

`ref`, bir desen içinde "bu parçayı **taşıma**, ona bir **referans** bağla" demektir. `ref mut` aynısının
değiştirilebilir hâlidir:

```rust
#[derive(Debug)]
struct Hesap {
    sahip: String,
    bakiye: u64,
}

fn main() {
    let mut hesap = Hesap { sahip: String::from("Ayşe"), bakiye: 500 };

    let Hesap { ref sahip, bakiye } = hesap; // sahip: &String, bakiye: u64 (kopya)
    println!("{sahip} hesabında {bakiye} TL var");
    println!("hesap bütün olarak hâlâ geçerli: {hesap:?}");

    let Hesap { ref mut bakiye, .. } = hesap; // bakiye: &mut u64
    *bakiye += 250;
    println!("Yatırım sonrası: {hesap:?}");
}
```

Burada üç şeyi birbirinden ayırmak önemli:

| Nerede? | Yazım | Anlamı |
|---|---|---|
| ifadede | `&x` | `x`'e bir referans **oluştur** (Modül 5) |
| desende | `&p` | gelen değer bir referans; onu **aç** ve içini `p`'ye uydur |
| desende | `ref x` | gelen değeri taşıma; ona bir referans **bağla** |

`&` deseni ile `ref` birbirinin tersidir: `&` deseni referansı **kaldırır**, `ref` bir referans **ekler**.
1. dersteki `for &(x, y) in &noktalar` satırı `&` desenine bir örnekti: iterator `&(i32, i32)` veriyordu,
desen referansı açtı ve `i32`'leri kopyaladı.

:::analogy Kütüphanedeki kitap
Bir kütüphaneden kitap almayı düşün. **Taşımak**, kitabı eve götürüp rafı boş bırakmaktır (sahiplik sende).
**`ref`**, kitabı raftan almadan "şu kitap şurada" diye bir **not** almaktır; kitap rafta kalır ve başkaları da
bakabilir. **`&` deseni** ise sana zaten bir not verildiğinde notu okuyup kitabın kendisine ulaşmaktır.
`ref mut` de kütüphaneciden aldığın "bu kitaba not düşebilirsin" iznidir: tek bir kişiye verilir.
:::

```fill
prompt: |
  `sepet`'in sahipliğini koruyarak ilk ürünün adını ödünç al ve ikinci ürünün adedini **yerinde** artır.
  Boşlukları `ref` / `ref mut` ile doldur.
code: |
  fn main() {
      let mut sepet = ((String::from("çay"), 2), (String::from("şeker"), 1));

      let ((___0 ilk_ad, _), _) = sepet;
      println!("İlk ürün: {ilk_ad}");

      let (_, (_, ___1 adet)) = sepet;
      *adet += 4;
      println!("{sepet:?}");
  }
blanks:
  - ["ref"]
  - ["ref mut"]
output: |
  İlk ürün: çay
  (("çay", 2), ("şeker", 5))
explanation: |
  `ref ilk_ad` bir `&String` bağlar; `String` taşınmadığı için `sepet` sonra bütün olarak yazdırılabiliyor.
  `ref mut adet` bir `&mut i32` bağlar ve `*adet += 4` doğrudan `sepet`'in içindeki sayıyı değiştirir.
  `ref`'siz yazsaydın ilk satır `String`'i taşırdı ve son `println!` **E0382** verirdi.
```

## Varsayılan bağlama kipleri (match ergonomics)

Modül 7'den beri `match &m { Mesaj::Yaz(metin) => ... }` yazıyorsun ve `metin` kendiliğinden bir `&String`
oluyor. Ne `&` desenini ne de `ref`'i yazdın. Bu, Rust'ın **varsayılan bağlama kipleri (default binding
modes)** kuralıdır; topluluk buna **match ergonomics** da der.

Her desen bir **bağlama kipiyle (binding mode)** çalışır ve başlangıçta kip **taşı/kopyala**'dır (move).
Kural şudur:

1. Referans **olmayan** bir desen (`Some(..)`, `(a, b)`, `Nokta { .. }`) bir **referansla** karşılaşırsa,
   Rust referansı otomatik olarak açar ve içeriye doğru kipi değiştirir: `&` için **`ref`**, `&mut` için
   **`ref mut`** (kip bir kez `ref` olduysa `ref` kalır).
2. Bu desenin içindeki isimler değeri o kiple bağlar.

```rust
#[derive(Debug)]
struct Urun {
    ad: String,
    stok: u32,
}

fn main() {
    let mut raf = vec![
        Urun { ad: String::from("defter"), stok: 3 },
        Urun { ad: String::from("kalem"), stok: 0 },
    ];

    // &Urun ile Urun deseni karşılaşıyor → kip: ref → ad: &String, stok: &u32
    for Urun { ad, stok } in &raf {
        println!("{ad}: {stok}");
    }

    // &mut Urun ile Urun deseni → kip: ref mut → stok: &mut u32
    for Urun { stok, .. } in &mut raf {
        *stok += 10;
    }

    // first() bir Option<&Urun> verir: Some(..) Option'a doğrudan uyar,
    // içerideki Urun deseni &Urun ile karşılaşınca kip ref olur → ad: &String, stok: &u32
    let ilk_urun = raf.first();
    if let Some(Urun { ad, stok }) = ilk_urun {
        println!("İlk ürün {ad}, yeni stok {stok}");
    }
    println!("{raf:?}");
}
```

Hiçbir yerde `ref` yazmadık, hiçbir şey taşınmadı ve `raf` sonuna kadar kullanılabilir kaldı. Bu kural
olmasaydı her seferinde `for &Urun { ref ad, ref stok } in &raf` gibi kalabalık desenler yazman gerekirdi.
Bu kural gelmeden önce (Rust 1.26, 2018) Rust kodu gerçekten böyle görünüyordu.

```quiz
question: |
  `let notlar: Vec<(String, u32)> = ...;` için `for (ad, puan) in &notlar { ... }` döngüsünde `ad` ve
  `puan`'ın tipleri nedir?
options:
  - "`ad: String`, `puan: u32` (değerler kopyalanır)"
  - "`ad: &String`, `puan: &u32`"
  - "`ad: &String`, `puan: u32`"
  - Derlenmez; `&(ad, puan)` yazmak gerekir
answer: 1
explanation: |
  Iterator `&(String, u32)` üretiyor. Referans olmayan `(ad, puan)` deseni bir referansla karşılaşınca kip
  `ref` olur ve **her iki** isim de referans bağlar: `&String` ve `&u32`. `u32`'nin `Copy` olması kipi
  değiştirmez; kip parça parça değil, desenin o seviyesinden itibaren bütün isimler için geçerlidir.
  `&(ad, puan)` yazsaydın kip taşı/kopyala olurdu ve `String` bir referansın arkasından taşınamayacağı
  için **E0507** alırdın.
feedback:
  - "Değerler referansın arkasında; desen onları taşıyamaz ya da kopyalayamaz, ödünç alır."
  - "Doğru! Kip `ref` olduğu için iki isim de referans."
  - "Kip bütün isimler için aynıdır; `Copy` olan alan istisna değildir."
  - "Varsayılan bağlama kipleri sayesinde `&` yazmak gerekmez; `&` yazmak burada sorun çıkarır."
```

**2024 sürümünün kuralı.** Kip `ref` ya da `ref mut` olmuşken desenin içine `ref`, `mut` ya da `&` yazmak
2024 sürümünde (bu uygulamanın kullandığı sürüm) **hatadır**:

:::error
```text
error: cannot explicitly borrow within an implicitly-borrowing pattern
 --> src/main.rs:4:14
  |
4 |         Some(ref a) => println!("{a}"),
  |              ^^^ explicit `ref` binding modifier not allowed when implicitly borrowing
  |
  = note: for more information, see <https://doc.rust-lang.org/reference/patterns.html#binding-modes>
note: matching on a reference type with a non-reference pattern implicitly borrows the contents
 --> src/main.rs:4:9
  |
4 |         Some(ref a) => println!("{a}"),
  |         ^^^^^^^^^^^ this non-reference pattern matches on a reference type `&_`
help: remove the unnecessary binding modifier
  |
4 -         Some(ref a) => println!("{a}"),
4 +         Some(a) => println!("{a}"),
```
`match &ad { Some(ref a) => ... }` yazılmış. `&ad` ile `Some(..)` karşılaştığı için kip zaten `ref`; ayrıca
`ref` yazmak gereksiz. Aynı ailede iki mesaj daha var: `Some(mut x)` için *cannot mutably bind by value
within an implicitly-borrowing pattern*, `Some(&x)` için *cannot explicitly dereference within an
implicitly-borrowing pattern*. Çıkış yolu iki tanedir ve derleyici duruma uyanı `help` satırında önerir:
değiştiriciyi sil (`ref` için önerdiği bu) ya da dış desene `&` ekleyerek (`&Some(mut x)`) otomatik ödünç
almayı baştan kapat (`mut` ve `&` için önerdiği bu).
:::

Neden bu sıkılık? Eski sürümlerde `Some(mut x)` yazmak kipi **sessizce** taşı/kopyala'ya çevirirdi: `x`'in tipi
bir anda `&i32`'den `i32`'ye dönerdi ve `x`'i değiştirmek orijinal değeri değiştirmezdi. Görünmez kurallar
görünmez hatalar doğurur; 2024 sürümü belirsiz yazımları yasaklayıp kuralı tahmin edilebilir yaptı.
`ref`, `ref mut` ve `&` desenleri hâlâ dilin parçası; sadece kip **taşı/kopyala** iken (yani desen bir
referansın içine otomatik girmemişken) kullanılırlar: sahip olduğun bir değeri eşleştirirken.

:::tip Kısa kural
Elinde bir referans varsa (`&x`, `&mut x`, `iter()`, `iter_mut()`) düz desen yaz; isimler kendiliğinden
`&` / `&mut` olur. Elinde **sahip olduğun** bir değer varsa ve onu taşımadan parçalamak istiyorsan ya
değeri ödünç vererek eşleştir (`match &deger`) ya da desende `ref` / `ref mut` kullan.
:::

## Uygulama: kırtasiye envanteri

````exercise
id: m21-e-envanter
title: Kırtasiye envanteri
difficulty: 3
prompt: |
  Bir kırtasiyenin envanterini yöneten üç fonksiyon yaz. Hiçbirinde `clone` kullanma ve ürünlerin
  alanlarına `urun.fiyat` gibi nokta ile değil, **desenle** ulaş (`Urun { fiyat, .. }`).

  1. `zam_yap(urunler, yuzde)`: her ürünün fiyatını yüzde kadar artırır (tamsayı bölme:
     `fiyat + fiyat * yuzde / 100`).
  2. `tukenenler(urunler)`: stoğu `0` olan ürünlerin adlarını, **sırayla**, `Vec<&str>` olarak döndürür.
  3. `stok_degeri(urunler)`: bütün ürünlerin `fiyat * stok` toplamını döndürür.

  İpucu: `for` deseni reddedilemez olmalı (2. ders); `stok: 0` bir sınamadır.
starter: |
  struct Urun {
      ad: String,
      fiyat: u32,
      stok: u32,
  }

  fn zam_yap(urunler: &mut [Urun], yuzde: u32) {
      todo!()
  }

  fn tukenenler(urunler: &[Urun]) -> Vec<&str> {
      todo!()
  }

  fn stok_degeri(urunler: &[Urun]) -> u32 {
      todo!()
  }

  fn main() {
      let mut raf = vec![
          Urun { ad: String::from("defter"), fiyat: 40, stok: 12 },
          Urun { ad: String::from("silgi"), fiyat: 10, stok: 0 },
          Urun { ad: String::from("kalem"), fiyat: 25, stok: 30 },
      ];
      zam_yap(&mut raf, 10);
      println!("Tükenenler: {:?}", tukenenler(&raf));
      println!("Stok değeri: {} TL", stok_degeri(&raf));
  }
solution: |
  struct Urun {
      ad: String,
      fiyat: u32,
      stok: u32,
  }

  fn zam_yap(urunler: &mut [Urun], yuzde: u32) {
      for Urun { fiyat, .. } in urunler {
          *fiyat += *fiyat * yuzde / 100;
      }
  }

  fn tukenenler(urunler: &[Urun]) -> Vec<&str> {
      let mut sonuc = Vec::new();
      for urun in urunler {
          if let Urun { ad, stok: 0, .. } = urun {
              sonuc.push(ad.as_str());
          }
      }
      sonuc
  }

  fn stok_degeri(urunler: &[Urun]) -> u32 {
      let mut toplam = 0;
      for Urun { fiyat, stok, .. } in urunler {
          toplam += fiyat * stok;
      }
      toplam
  }

  fn main() {
      let mut raf = vec![
          Urun { ad: String::from("defter"), fiyat: 40, stok: 12 },
          Urun { ad: String::from("silgi"), fiyat: 10, stok: 0 },
          Urun { ad: String::from("kalem"), fiyat: 25, stok: 30 },
      ];
      zam_yap(&mut raf, 10);
      println!("Tükenenler: {:?}", tukenenler(&raf));
      println!("Stok değeri: {} TL", stok_degeri(&raf));
  }
check: tests
tests: |
  fn ornek_raf() -> Vec<Urun> {
      vec![
          Urun { ad: String::from("defter"), fiyat: 40, stok: 12 },
          Urun { ad: String::from("silgi"), fiyat: 10, stok: 0 },
          Urun { ad: String::from("kalem"), fiyat: 25, stok: 30 },
          Urun { ad: String::from("cetvel"), fiyat: 15, stok: 0 },
      ]
  }

  #[test]
  fn zam_yerinde_uygulanir() {
      let mut raf = ornek_raf();
      zam_yap(&mut raf, 10);
      let fiyatlar: Vec<u32> = raf.iter().map(|u| u.fiyat).collect();
      assert_eq!(fiyatlar, vec![44, 11, 27, 16], "40→44, 10→11, 25→27 (tamsayı bölme), 15→16");
      zam_yap(&mut raf, 0);
      assert_eq!(raf[0].fiyat, 44, "%0 zam fiyatı değiştirmemeli");
  }

  #[test]
  fn tukenenler_sirayla_listelenir() {
      let raf = ornek_raf();
      assert_eq!(tukenenler(&raf), vec!["silgi", "cetvel"], "stoğu 0 olanlar, raftaki sırayla");
      assert!(tukenenler(&raf[..1]).is_empty(), "stokta olan ürün tükenmiş sayılmamalı");
  }

  #[test]
  fn stok_degeri_hesaplanir() {
      let raf = ornek_raf();
      assert_eq!(stok_degeri(&raf), 40 * 12 + 25 * 30, "tükenen ürünler değere bir şey katmaz");
      assert_eq!(stok_degeri(&[]), 0, "boş rafın değeri 0");
  }

  #[test]
  fn raf_hala_kullanilabilir() {
      let mut raf = ornek_raf();
      zam_yap(&mut raf, 50);
      let _ = tukenenler(&raf);
      let _ = stok_degeri(&raf);
      assert_eq!(raf.len(), 4, "fonksiyonlar rafı tüketmemeli");
      assert_eq!(raf[2].fiyat, 37, "25 + 25 * 50 / 100 = 37");
  }
hints:
  - "`for Urun { fiyat, .. } in urunler` yazdığında `urunler` bir `&mut [Urun]` ise eleman tipi `&mut Urun` olur ve varsayılan bağlama kipi sayesinde `fiyat` bir `&mut u32` olur. Değiştirmek için `*fiyat`."
  - "`for Urun { ad, stok: 0, .. } in urunler` derlenmez (E0005): `stok: 0` reddedilebilir. Döngüde düz bir isim kullan ve içeride `if let Urun { ad, stok: 0, .. } = urun` yaz. `ad` bir `&String`; `Vec<&str>`'ye `ad.as_str()` ile ekle."
  - "`stok_degeri`'nde `for Urun { fiyat, stok, .. } in urunler` ile `fiyat: &u32`, `stok: &u32` olur; `fiyat * stok` referanslarla da çalışır ya da `*fiyat * *stok` yaz."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: "`clone` kullanmadan çöz: varsayılan bağlama kipleri zaten ödünç alıyor."
  - pattern: "\\.(fiyat|stok|ad)\\b"
    message: Alanlara nokta ile değil, desenle ulaş (`Urun { fiyat, .. }`).
explanation: |
  Üç fonksiyon da varsayılan bağlama kiplerinin üç yüzünü gösteriyor:

  - `zam_yap`: `&mut [Urun]` üzerinde dönmek `&mut Urun` verir; `Urun { fiyat, .. }` deseni kipi `ref mut`
    yapar ve `fiyat: &mut u32` olur. Hiç `ref mut` yazmadan alanı yerinde değiştirdik.
  - `tukenenler`: `&Urun` ile `Urun { ad, stok: 0, .. }` → `ad: &String`. Desen hem sınıyor (`stok: 0`)
    hem bağlıyor. `for` deseninin reddedilemez olması gerektiği için sınama içerideki `if let`'te.
  - `stok_degeri`: iki isim birden `&u32`. Rust'ta `&u32 * &u32` için de çarpma tanımlıdır (Modül 22'de
    operatörlerin nasıl tanımlandığını göreceksin), bu yüzden `fiyat * stok` doğrudan çalışır.

  Iterator'larla daha kısa yazabilirsin, desenler closure parametrelerinde de aynı şekilde çalışır:

  ```rust
  # struct Urun { ad: String, fiyat: u32, stok: u32 }
  fn tukenenler(urunler: &[Urun]) -> Vec<&str> {
      urunler
          .iter()
          .filter(|u| matches!(u, Urun { stok: 0, .. }))
          .map(|Urun { ad, .. }| ad.as_str())
          .collect()
  }
  # fn main() { let _ = tukenenler(&[]); let _ = Urun { ad: String::new(), fiyat: 0, stok: 0 }.fiyat; }
  ```
````

## Özet

:::remember
- `_` her şeye uyar ve **bağlamaz**: hiçbir şey taşınmaz; `let _ = ifade;` geçici değeri hemen drop eder.
- `_isim` **gerçek** bir değişkendir (yalnızca uyarıyı susturur): değer taşınır ve kapsam sonuna kadar yaşar. RAII guard'larına isim ver.
- `..` geri kalanı yok sayar: struct'ta kalan alanlar, tuple'da aradaki elemanlar (desen başına bir kez).
- Desendeki isimler değeri sahiplik kurallarıyla alır: `Copy` kopyalanır, diğerleri taşınır. Bir kısmı taşınırsa **kısmi taşıma**: bütün değer kullanılamaz, kalan alanlar kullanılabilir.
- `ref x` taşımak yerine referans bağlar, `ref mut x` değiştirilebilir referans bağlar; `&p` deseni ise gelen referansı açar.
- **Varsayılan bağlama kipleri**: referans olmayan bir desen bir `&`/`&mut` ile karşılaşırsa kip `ref`/`ref mut` olur ve isimler referans bağlar. Bu kipteyken desen içinde `ref`, `mut` ya da `&` yazmak 2024 sürümünde hatadır.
:::

```reflect
prompt: |
  `let _ = s;` derlenip `let _s = s;` neden sonrasında `s`'yi kullanılamaz yapıyor? Aynı fark
  `let _ = sayac.lock().unwrap();` satırında nasıl bir hataya yol açar?
answer: |
  `_` bir bağlama değildir; değeri hiçbir isme koymadığı için hiçbir şey taşınmaz ve `s` geçerli kalır.
  `_s` ise sıradan bir değişkendir; alt çizgi yalnızca "kullanılmıyor" uyarısını susturur, değer ona
  taşınır. Aynı nedenle `let _ = sayac.lock().unwrap();` satırındaki `MutexGuard` hiçbir isme bağlanmaz
  ve satır biter bitmez drop edilir; kilit hemen açılır ve korumak istediğim kod korumasız çalışır. Guard'ı
  kapsam boyunca tutmak için `let _kilit = ...;` yazmalıyım.
```

```flashcards
- front: "`let _ = s;` satırı `s`'yi taşır mı?"
  back: "Hayır. `_` bağlama yapmaz; `s` geçerli kalır."
- front: "`_m` ile `_` arasındaki fark nedir?"
  back: "`_m` gerçek bir değişkendir: değeri taşır/bağlar ve kapsam sonuna kadar yaşatır; sadece kullanılmama uyarısını susturur. `_` hiçbir şey bağlamaz."
- front: Kısmi taşıma (partial move) nedir?
  back: Bir desenin bir struct/tuple'ın yalnızca bazı alanlarını taşıması. Bütün değer artık kullanılamaz, taşınmamış alanlar kullanılabilir.
- front: "Desende `&p` ile `ref x` arasındaki fark nedir?"
  back: "`&p` gelen bir referansı **açar**; `ref x` taşımak yerine bir referans **bağlar**. Birbirinin tersidir."
- front: "`for (ad, puan) in &notlar` (`Vec<(String, u32)>`) döngüsünde `puan`'ın tipi nedir?"
  back: "`&u32`. Varsayılan bağlama kipi `ref` olur ve bütün isimler referans bağlar."
- front: "2024 sürümünde `match &ad { Some(ref a) => .. }` neden hata verir?"
  back: "Kip zaten otomatik olarak `ref`; otomatik ödünç alan bir desende `ref`, `mut` ya da `&` yazmak yasak (*cannot explicitly borrow within an implicitly-borrowing pattern*)."
- front: "`let _ = mutex.lock().unwrap();` neden tehlikelidir?"
  back: Guard hiçbir isme bağlanmadığı için hemen drop edilir ve kilit anında açılır. `let _kilit = ...` yazılmalı.
```
