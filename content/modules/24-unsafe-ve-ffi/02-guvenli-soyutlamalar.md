---
id: m24-l02
title: Güvenli soyutlamalar inşa etmek
minutes: 24
type: lesson
objectives:
  - "`unsafe fn` tanımlayıp `# Safety` bölümüyle belgeleyebilmek ve edition 2024'teki `unsafe_op_in_unsafe_fn` uyarısını açıklayabilmek"
  - "`split_at_mut`'u ham işaretçiler ve `slice::from_raw_parts_mut` ile kendin yazabilmek"
  - "Her `unsafe` bloğa, dayandığı değişmezleri (invariant) açıklayan bir `// SAFETY:` yorumu yazabilmek"
  - "Bir güvenli fonksiyonun **sağlam (sound)** olup olmadığını, gizlilik sınırını da hesaba katarak değerlendirebilmek"
keywords: [unsafe fn, güvenli soyutlama, safe abstraction, split_at_mut, from_raw_parts_mut, SAFETY, soundness, unsafe_op_in_unsafe_fn, değişmez, invariant]
---

Bir önceki derste `unsafe`'in kilitli dolabını açtın. Ama `Vec::push` ya da `split_at_mut` kullanırken hiç
`unsafe` yazmadın; içlerinde unsafe kod olduğu hâlde. Nasıl oluyor bu?

Cevap Rust'ın en önemli tasarım fikirlerinden biri: **güvenli soyutlama (safe abstraction)**. Küçük, dikkatle
denetlenmiş bir `unsafe` çekirdeğin etrafına, **hiçbir girdiyle** tanımsız davranışa yol açamayan güvenli
bir arayüz örersin. Kullanıcı sadece güvenli arayüzü görür. Bu derste bunu kendi ellerinle yapacaksın.

## unsafe fn: sözleşmeyi çağırana devretmek

Bazı fonksiyonlar ancak çağıran belirli bir şartı sağlarsa doğru çalışır. Örneğin std'deki
`slice::get_unchecked(i)` sınır kontrolü yapmaz; `i`'nin geçerli olduğunu **çağıran** garanti etmelidir.
Böyle bir fonksiyon `unsafe fn` olarak işaretlenir:

```rust
/// Notlar dizisinden sınır kontrolü yapmadan bir not döndürür.
///
/// # Safety
///
/// Çağıran, `i < notlar.len()` olduğunu garanti etmelidir. Aksi hâlde
/// sınır dışı bellek okunur (tanımsız davranış).
unsafe fn notu_al(notlar: &[u8], i: usize) -> u8 {
    // SAFETY: Çağıran, fonksiyon sözleşmesi gereği i < len garanti ediyor.
    unsafe { *notlar.as_ptr().add(i) }
}

fn main() {
    let notlar = [85, 92, 78];
    for i in 0..notlar.len() {
        // SAFETY: i, 0..len aralığından geliyor; her zaman geçerli bir indeks.
        let not = unsafe { notu_al(&notlar, i) };
        println!("{}. öğrenci: {not}", i + 1);
    }
}
```

Buradaki iki belgeleme biçimine dikkat et:

- `/// # Safety` — `unsafe fn`'in **doküman yorumunda** (Modül 13) çağıranın uyması gereken sözleşme.
  Rust topluluğunda bu bölüm zorunlu sayılır; clippy'nin `missing_safety_doc` lint'i eksikliğini yakalar.
- `// SAFETY:` — her `unsafe` **bloğunun** üstünde, o sözleşmenin **neden** sağlandığının açıklaması.

`unsafe fn`'i `unsafe` blok olmadan çağırmak, beş süper güçten ikincisini izinsiz kullanmaktır. Tahmin et:

```compiles
code: |
  /// # Safety
  /// `b` sıfır olmamalı.
  unsafe fn kontrolsuz_bol(a: u32, b: u32) -> u32 {
      a / b
  }

  fn main() {
      let sonuc = kontrolsuz_bol(10, 2);
      println!("{sonuc}");
  }
answer: false
error: E0133
explanation: |
  `kontrolsuz_bol` bir `unsafe fn`; onu çağırmak **çağıranın** bir söz vermesini gerektirir. `unsafe { }`
  bloğu olmadan derleyici `E0133` verir. Burada `b = 2` olduğu için söz kolayca tutulur:
  `let sonuc = unsafe { kontrolsuz_bol(10, 2) };` yazmak yeterli.
```

:::error
```text
error[E0133]: call to unsafe function `kontrolsuz_bol` is unsafe and requires unsafe block
 --> src/main.rs:8:17
  |
8 |     let sonuc = kontrolsuz_bol(10, 2);
  |                 ^^^^^^^^^^^^^^^^^^^^^ call to unsafe function
  |
  = note: consult the function's documentation for information on how to avoid undefined behavior
```
`note:` satırı seni fonksiyonun dokümantasyonuna, yani `# Safety` bölümüne yönlendiriyor. İşte o bölümü
yazmanın neden zorunlu olduğu: çağıranın neye söz verdiğini bilmesinin tek yolu odur.
:::

:::analogy Kiralık iş makinesi
Bir inşaat malzemesi dükkânı, vinç kiralarken müşteriden **operatör ehliyeti** ister. Kira sözleşmesinde
"Vinci yalnızca ehliyetli operatör kullanacaktır" maddesi yazar (`# Safety`). Dükkân vinci teslim eder;
şantiyede ehliyetli birinin kullandığını kontrol etmek artık **kiralayanın** sorumluluğudur. Kiralayan
sözleşmeyi imzalarken (`unsafe { }`) bu sorumluluğu üstlenir ve şantiye defterine "Operatör: Mehmet Usta,
ehliyet no ..." diye not düşer (`// SAFETY:`).
:::

## Edition 2024: unsafe fn'in gövdesi de güvenli sayılır

Yukarıdaki `notu_al` fonksiyonunun **içinde** de bir `unsafe { }` bloğu vardı. Zaten `unsafe fn`'in
içindeyiz; buna gerçekten gerek var mı? Tahmin et:

```compiles
code: |
  unsafe fn oku(p: *const i32) -> i32 {
      *p
  }

  fn main() {
      let x = 7;
      let n = unsafe { oku(&raw const x) };
      println!("{n}");
  }
answer: true
explanation: |
  Derlenir ve `7` yazdırır, ama bir **uyarı** verir. Eski edition'larda `unsafe fn`'in gövdesi otomatik
  olarak bir `unsafe` blok sayılırdı. Edition 2024'te `unsafe_op_in_unsafe_fn` lint'i varsayılan olarak
  uyarı verir: gövdedeki her unsafe işlem kendi `unsafe { }` bloğunda olmalı.
```

:::error Uyarı: unsafe_op_in_unsafe_fn
```text
warning[E0133]: dereference of raw pointer is unsafe and requires unsafe block
 --> src/main.rs:2:5
  |
2 |     *p
  |     ^^ dereference of raw pointer
  |
  = note: raw pointers may be null, dangling or unaligned; they can violate aliasing rules and cause data races: all of these are undefined behavior
note: an unsafe function restricts its caller, but its body is safe by default
 --> src/main.rs:1:1
  |
1 | unsafe fn oku(p: *const i32) -> i32 {
  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  = note: for more information, see <https://doc.rust-lang.org/edition-guide/rust-2024/unsafe-op-in-unsafe-fn.html>
  = note: `#[warn(unsafe_op_in_unsafe_fn)]` (part of `#[warn(rust_2024_compatibility)]`) on by default
```
Anahtar cümle: *"an unsafe function restricts its caller, but its body is safe by default"* — unsafe bir
fonksiyon **çağıranı** kısıtlar, ama **gövdesi** varsayılan olarak güvenlidir.
:::

Neden böyle değişti? Çünkü `unsafe` kelimesinin iki görevi birbirine karışıyordu:

1. `unsafe fn` → **sözleşme bildirmek** ("beni çağıran şu şartı sağlamalı")
2. `unsafe { }` → **sözleşmeyi yerine getirmek** ("bu işlemin şartlarını ben sağladım")

Eskiden `unsafe fn` yazmak, gövdenin tamamını sessizce bir unsafe bölgeye çeviriyordu. 50 satırlık bir
fonksiyonda hangi satırın gerçekten tehlikeli olduğu görünmez oluyordu. Artık her unsafe işlem kendi
bloğunda, kendi `SAFETY` yorumuyla duruyor: incelemesi kolay, gözden kaçması zor.

## Derleyicinin reddettiği doğru program

Bir dilimi iki parçaya bölüp **ikisini de** değiştirmek istiyorsun. Örneğin bir sınıf listesini iki
gruba ayırıp her gruba ayrı puan ekleyeceksin. Önce safe Rust ile dene:

```compiles
code: |
  fn ikiye_bol(dilim: &mut [i32], orta: usize) -> (&mut [i32], &mut [i32]) {
      let uzunluk = dilim.len();
      assert!(orta <= uzunluk);
      (&mut dilim[..orta], &mut dilim[orta..])
  }

  fn main() {
      let mut v = [1, 2, 3, 4];
      let (a, b) = ikiye_bol(&mut v, 2);
      println!("{a:?} {b:?}");
  }
answer: false
error: E0499
explanation: |
  İki parça **çakışmıyor**: biri `..orta`, diğeri `orta..`. Program aslında doğru! Ama borrow checker
  dilimin farklı bölgelerini ayrı ayrı takip etmez; sadece "`dilim`'den iki kez `&mut` alındı" görür ve
  reddeder. Bu, derleyicinin muhafazakâr olmasının klasik örneğidir.
```

:::error
```text
error[E0499]: cannot borrow `*dilim` as mutable more than once at a time
 --> src/main.rs:4:31
  |
1 | fn ikiye_bol(dilim: &mut [i32], orta: usize) -> (&mut [i32], &mut [i32]) {
  |                     - let's call the lifetime of this reference `'1`
...
4 |     (&mut dilim[..orta], &mut dilim[orta..])
  |     --------------------------^^^^^---------
  |     |     |                   |
  |     |     |                   second mutable borrow occurs here
  |     |     first mutable borrow occurs here
  |     returning this value requires that `*dilim` is borrowed for `'1`
  |
  = help: use `.split_at_mut(position)` to obtain two mutable non-overlapping sub-slices
```
`help:` satırı ilginç: derleyici bile "bunu güvenle yapamam ama std'de bunu yapan bir fonksiyon var" diyor.
`split_at_mut`'un içinde ise... `unsafe` kod var. Şimdi onu kendimiz yazacağız.
:::

```memory
title: "İki çakışmayan &mut dilim"
steps:
  - caption: "`v` stack'te 4 elemanlı bir dizi. Tek bir `&mut [i32]` tamamını kapsıyor."
    stack:
      - frame: main
        vars:
          - { name: v, type: "[i32; 4]", value: "1 | 2 | 3 | 4", mut: true }
          - { name: dilim, type: "&mut [i32]", value: "ptr · len=4", to: v }
  - caption: "Bölme sonrası iki dilim aynı diziyi gösteriyor ama **farklı** bölgeleri: `a` = [0..2), `b` = [2..4). Hiçbir eleman ikisinde birden yok."
    stack:
      - frame: main
        vars:
          - { name: v, type: "[i32; 4]", value: "1 | 2 ‖ 3 | 4", mut: true }
          - { name: a, type: "&mut [i32]", value: "ptr+0 · len=2", to: v, note: "elemanlar 0, 1" }
          - { name: b, type: "&mut [i32]", value: "ptr+2 · len=2", to: v, note: "elemanlar 2, 3" }
```

## split_at_mut'u kendimiz yazalım

Plan: dilimin başlangıç adresini ham işaretçi olarak al, sonra iki ayrı dilimi bu adresten **elle**
oluştur. Bunun için `std::slice::from_raw_parts_mut(ptr, len)` fonksiyonu var: bir başlangıç işaretçisi
ve bir eleman sayısından `&mut [T]` üretir. Kendisi bir `unsafe fn`'dir; sözleşmesi kabaca şöyle:
`ptr`'den başlayan `len` eleman geçerli, hizalı ve başlatılmış olmalı, ve dönen dilim yaşadığı sürece o
belleğe başka hiçbir yoldan erişilmemeli.

```rust
use std::slice;

fn ikiye_bol<T>(dilim: &mut [T], orta: usize) -> (&mut [T], &mut [T]) {
    let uzunluk = dilim.len();
    assert!(orta <= uzunluk, "orta ({orta}) dilim uzunluğunu ({uzunluk}) aşamaz");
    let p = dilim.as_mut_ptr();

    // SAFETY:
    // - `p`, `uzunluk` elemanlık geçerli bir dilimden geliyor.
    // - assert sayesinde `orta <= uzunluk`; bu yüzden `p.add(orta)` dilimin içinde
    //   ya da tam bir eleman sonrasında kalıyor ve iki parçanın toplam uzunluğu `uzunluk`.
    // - [0, orta) ve [orta, uzunluk) çakışmıyor: iki `&mut` asla aynı elemanı göstermez.
    // - `dilim`'i bu fonksiyon boyunca başka yoldan kullanmıyoruz; dönen dilimler
    //   `dilim` ile aynı yaşam süresine bağlı (imzadaki elision).
    unsafe {
        (
            slice::from_raw_parts_mut(p, orta),
            slice::from_raw_parts_mut(p.add(orta), uzunluk - orta),
        )
    }
}

fn main() {
    let mut sinif = [70, 80, 65, 90, 75, 60];
    let (sabah, ogle) = ikiye_bol(&mut sinif, 3);
    for not in sabah.iter_mut() {
        *not += 5; // sabah grubuna 5 puan
    }
    for not in ogle.iter_mut() {
        *not += 10; // öğle grubuna 10 puan
    }
    println!("{sinif:?}");
}
```

Dışarıdan bakan biri için `ikiye_bol` **tamamen güvenli** bir fonksiyon: `unsafe fn` değil, çağırmak için
`unsafe` gerekmiyor. Çünkü hiçbir girdiyle tanımsız davranış üretemez: geçersiz bir `orta` gelirse `assert!`
programı **panikletir** (Modül 10), belleğe yanlış erişilmez.

```fill
prompt: "Boşlukları doldurarak dilimin ilk elemanı ile geri kalanını iki ayrı `&mut` olarak döndüren `bas_ve_kuyruk`'u tamamla."
code: |
  use std::slice;

  fn bas_ve_kuyruk(dilim: &mut [i32]) -> Option<(&mut i32, &mut [i32])> {
      if dilim.is_empty() {
          return None;
      }
      let n = dilim.len();
      let p = dilim.___0();
      // SAFETY: dilim boş değil; eleman 0 ile [1, n) bölgesi çakışmıyor.
      unsafe { Some((&mut *p, slice::___1(p.add(1), ___2))) }
  }

  fn main() {
      let mut kuyruk = [3, 1, 4, 1];
      if let Some((ilk, geri)) = bas_ve_kuyruk(&mut kuyruk) {
          *ilk = 0;
          geri[0] = 9;
      }
      println!("{kuyruk:?}");
  }
blanks:
  - ["as_mut_ptr"]
  - ["from_raw_parts_mut"]
  - ["n - 1", "n-1"]
output: "[0, 9, 4, 1]"
explanation: |
  `&mut *p` ham işaretçiyi bir `&mut i32` referansına çevirir (önce çöz, sonra ödünç al). Kuyruk dilimi
  `p.add(1)`'den başlar ve `n - 1` eleman uzunluğundadır. std'de bu fonksiyonun adı `split_first_mut`'tur.
```

Şimdi bir sağlamlık (soundness) sorusu. **Sağlam (sound)** bir güvenli fonksiyon, güvenli koddan **hangi
girdiyle** çağrılırsa çağrılsın tanımsız davranışa yol açamayan fonksiyondur.

```quiz
question: "`ikiye_bol` fonksiyonundan `assert!(orta <= uzunluk, ...)` satırını silersek ne olur?"
options:
  - "Hiçbir şey; `from_raw_parts_mut` sınırı zaten kendisi kontrol eder"
  - "Fonksiyon derlenmez, çünkü unsafe blok bir assert gerektirir"
  - "Derlenir ama artık **unsound** olur: güvenli koddan `ikiye_bol(&mut v, 100)` çağrısı sınır dışı belleğe erişen dilimler üretir"
  - "Program her zaman panikler"
answer: 2
explanation: |
  `from_raw_parts_mut` bir `unsafe fn`'dir; hiçbir şeyi kontrol etmez, şartların sağlandığına **güvenir**.
  Assert olmadan `orta = 100` gelirse `p.add(100)` dizinin dışını gösterir ve `uzunluk - orta` taşar.
  Kullanıcı hiç `unsafe` yazmadan UB üretebilir hâle gelir: fonksiyon güvenli görünüyor ama değil. Bu,
  unsafe kodda yapılabilecek en ciddi hatadır: **güvenli bir arayüzün arkasında saklanan UB**.
feedback:
  - "`unsafe fn`'ler kontrol yapmaz; şartları sağlamak çağıranın işidir."
  - "Derleyici assert'in varlığını hiç kontrol etmez; doğruluk tamamen senin sorumluluğunda."
  - "Doğru! Sağlam bir güvenli fonksiyon, hiçbir girdiyle UB üretemez."
  - "Panik ancak assert varken olurdu; assert'i sildik."
```

## SAFETY yorumları ve gizlilik sınırı

İyi bir `// SAFETY:` yorumu "bu güvenli, güven bana" demez; **hangi şartın neden sağlandığını** sayar.
Sık karşılaşılan kontrol listesi:

- İşaretçi **null değil** ve **hizalı** mı?
- Gösterdiği bellek **geçerli** ve **başlatılmış** mı, ne kadar süre geçerli kalacak?
- Aynı belleğe aynı anda **başka bir `&mut`** ya da yazan bir yol var mı?
- Sayılar (indeks, uzunluk) taşma yapmadan **sınırlar içinde** mi?

Bazı güvenlik şartları tek bir fonksiyonda değil, bir **tipin değişmezinde (invariant)** yaşar. O zaman
güvenliğin sınırı fonksiyon değil, **modül** olur: Modül 8'deki gizlilik (`pub` olmayan alanlar) unsafe
kodun en iyi dostudur. Örnek: içinde yalnızca ASCII bayt tuttuğunu garanti eden bir metin tipi.

```rust
mod metin {
    pub struct AsciiMetin {
        // DEĞİŞMEZ: her bayt ASCII (< 128). Alan gizli; yalnızca bu modül değiştirebilir.
        baytlar: Vec<u8>,
    }

    impl AsciiMetin {
        pub fn yeni(s: &str) -> Option<AsciiMetin> {
            if s.is_ascii() {
                Some(AsciiMetin { baytlar: s.as_bytes().to_vec() })
            } else {
                None
            }
        }

        pub fn buyut(&mut self) {
            self.baytlar.make_ascii_uppercase(); // ASCII kalır: değişmez korunur
        }

        pub fn as_str(&self) -> &str {
            // SAFETY: `baytlar` yalnızca `yeni` (ASCII kontrolünden sonra) ve `buyut`
            // (ASCII'yi ASCII'ye çevirir) tarafından değiştirilir. ASCII her zaman
            // geçerli UTF-8'dir, bu yüzden kontrolsüz dönüşüm güvenlidir.
            unsafe { std::str::from_utf8_unchecked(&self.baytlar) }
        }
    }
}

use metin::AsciiMetin;

fn main() {
    let mut plaka = AsciiMetin::yeni("34 abc 2024").unwrap();
    plaka.buyut();
    println!("{}", plaka.as_str());
    println!("Türkçe harf kabul edilir mi? {}", AsciiMetin::yeni("çay").is_some());
}
```

`std::str::from_utf8_unchecked` baytların geçerli UTF-8 olup olmadığını kontrol etmeyen `unsafe` bir
dönüşümdür; geçersiz UTF-8 içeren bir `&str` tanımsız davranıştır, çünkü `str`'nin tüm metotları geçerli
UTF-8 varsayar (Modül 9). Güvenli `from_utf8` her baytı kontrol eder; biz değişmez sayesinde bu maliyetten
kurtulduk.

```quiz
question: "Aşağıdaki değişikliklerden hangileri `metin` modülünü **unsound** yapar? (Birden fazla seçenek)"
options:
  - "`baytlar` alanını `pub` yapmak"
  - "`pub fn ekle(&mut self, c: char) { self.baytlar.push(c as u8); }` metodunu eklemek"
  - "`pub fn uzunluk(&self) -> usize { self.baytlar.len() }` metodunu eklemek"
  - "`as_str` içinde `from_utf8_unchecked` yerine `std::str::from_utf8(&self.baytlar).unwrap()` kullanmak"
answer: [0, 1]
explanation: |
  `as_str`'deki `unsafe` blok, `baytlar`'ın **her zaman** ASCII olmasına güveniyor. Alan `pub` olursa modül
  dışındaki güvenli kod `plaka.baytlar.push(0xFF)` yazabilir; ardından `as_str` geçersiz UTF-8 döndürür. `ekle`
  metodu da `'ç' as u8` ile 0xE7 baytını (ASCII değil) ekleyerek aynı sonuca yol açar. Yani unsafe kodun
  doğruluğu, aynı modüldeki **güvenli** koda da bağlıdır: modülün tamamı denetlenmeli. `uzunluk` sadece
  okuyor, `from_utf8` ise kontrollü (güvenli) sürüm; ikisi de sorun yaratmaz.
feedback:
  - "Doğru: değişmezi koruyan şey alanın gizli olmasıydı."
  - "Doğru: `as u8` kesme yapar; 'ç' (U+00E7) → 0xE7, ASCII değil."
  - "Sadece okumak değişmezi bozamaz."
  - "Bu sürüm daha yavaş ama kesinlikle güvenli; unsound olamaz."
```

Bu modüldeki son bir hatırlatma Modül 12'den: `from_raw_parts_mut` gibi fonksiyonlar dönen referansın
yaşam süresini kendileri belirleyemez; onu senin fonksiyonunun **imzası** bağlar.

```quiz
question: "`fn ikiye_bol<T>(dilim: &mut [T], orta: usize) -> (&mut [T], &mut [T])` imzasında dönen iki dilimin yaşam süresi nedir?"
options:
  - "`'static`, çünkü ham işaretçilerden oluşturuldular"
  - "Elision kuralı gereği `dilim` parametresiyle aynı yaşam süresi: dönen dilimler yaşadığı sürece orijinal dilim ödünç alınmış kalır"
  - "Yaşam süreleri yoktur; ham işaretçiler gibi davranırlar"
answer: 1
explanation: |
  Modül 12'deki elision kurallarından biri: girdi olarak **tek** bir referans varsa, çıktı referansları onun
  yaşam süresini alır. Yani imza aslında `fn ikiye_bol<'a, T>(dilim: &'a mut [T], orta: usize) -> (&'a mut [T], &'a mut [T])`.
  Böylece borrow checker, iki parça yaşarken `sinif`'i başka bir yoldan kullanmanı engeller. Unsafe kodun
  ürettiği referansları doğru bir imzayla sarmak, güvenli soyutlamanın yarısıdır.
feedback:
  - "Hayır; bu, dilimler orijinal veriden uzun yaşayabilir demek olurdu. Çok tehlikeli bir imza olurdu."
  - "Doğru!"
  - "Dönüş tipi `&mut [T]`; bunlar gerçek referanslar ve borrow checker onları takip eder."
```

## Alıştırma: iki elemanı aynı anda değiştir

Bir oyunda iki takım oyuncusu arasında puan transferi yapacaksın: birinden puan düşülecek, diğerine
eklenecek. Bunun için aynı dilimden **iki farklı elemana** aynı anda `&mut` gerekir; borrow checker bunu
`&mut v[i]` ve `&mut v[j]` ile yapmana izin vermez.

```exercise
id: m24-e-iki-eleman-mut
title: İki oyuncunun puanını aynı anda güncelle
difficulty: 3
prompt: |
  `iki_eleman_mut(dilim, i, j)` fonksiyonunu yaz. `i` ve `j` **farklı** ve ikisi de **sınırlar içinde** ise
  `Some((&mut dilim[i], &mut dilim[j]))` gibi iki ayrı değiştirilebilir referans döndürsün (önce `i`'nin,
  sonra `j`'nin elemanı). Aksi hâlde `None` döndürsün.

  - Kontrolleri unsafe bloktan **önce** yap: sağlamlık (soundness) buna bağlı.
  - Referansları ham işaretçiden üret: `&mut *p.add(i)`.
  - Neden güvenli olduğunu bir `// SAFETY:` yorumuyla açıkla.
starter: |
  fn iki_eleman_mut(dilim: &mut [i32], i: usize, j: usize) -> Option<(&mut i32, &mut i32)> {
      todo!()
  }

  fn main() {
      let mut puanlar = [120, 80, 45];
      if let Some((veren, alan)) = iki_eleman_mut(&mut puanlar, 0, 2) {
          *veren -= 30;
          *alan += 30;
      }
      println!("{puanlar:?}");
  }
solution: |
  fn iki_eleman_mut(dilim: &mut [i32], i: usize, j: usize) -> Option<(&mut i32, &mut i32)> {
      if i == j || i >= dilim.len() || j >= dilim.len() {
          return None;
      }
      let p = dilim.as_mut_ptr();
      // SAFETY: i ve j sınırlar içinde (az önce kontrol edildi) ve farklı; bu yüzden
      // iki `&mut` farklı elemanları gösterir, çakışmazlar. Dönen referanslar imzadaki
      // elision sayesinde `dilim`'in yaşam süresine bağlı.
      unsafe { Some((&mut *p.add(i), &mut *p.add(j))) }
  }

  fn main() {
      let mut puanlar = [120, 80, 45];
      if let Some((veren, alan)) = iki_eleman_mut(&mut puanlar, 0, 2) {
          *veren -= 30;
          *alan += 30;
      }
      println!("{puanlar:?}");
  }
check: tests
tests: |
  #[test]
  fn puan_transferi_yapar() {
      let mut v = [120, 80, 45];
      let (a, b) = iki_eleman_mut(&mut v, 0, 2).expect("0 ve 2 geçerli ve farklı indeksler");
      *a -= 30;
      *b += 30;
      assert_eq!(v, [90, 80, 75], "0. oyuncudan 2. oyuncuya 30 puan geçmeliydi");
  }

  #[test]
  fn ters_sirada_indeksler() {
      let mut v = [10, 20, 30];
      let (a, b) = iki_eleman_mut(&mut v, 2, 0).expect("2 ve 0 geçerli indeksler");
      *a += 1;
      *b += 100;
      assert_eq!(v, [110, 20, 31], "ilk referans i'nin (2), ikincisi j'nin (0) elemanı olmalı");
  }

  #[test]
  fn ayni_indeks_none_doner() {
      let mut v = [1, 2, 3];
      assert!(iki_eleman_mut(&mut v, 1, 1).is_none(), "i == j ise iki &mut aynı elemanı gösterirdi: None olmalı");
  }

  #[test]
  fn sinir_disi_none_doner() {
      let mut v = [1, 2, 3];
      assert!(iki_eleman_mut(&mut v, 0, 3).is_none(), "j = 3 sınır dışı");
      assert!(iki_eleman_mut(&mut v, 7, 1).is_none(), "i = 7 sınır dışı");
      let mut bos: [i32; 0] = [];
      assert!(iki_eleman_mut(&mut bos, 0, 1).is_none(), "boş dilimde hiçbir indeks geçerli değil");
  }
hints:
  - "Önce kötü durumları ele: `i == j`, `i >= dilim.len()` veya `j >= dilim.len()` ise `return None;`"
  - "`let p = dilim.as_mut_ptr();` ile başlangıç adresini al. `p.add(i)` i'nci elemanın adresidir."
  - "Ham işaretçiden referans: `&mut *p.add(i)`. Sonuç: `unsafe { Some((&mut *p.add(i), &mut *p.add(j))) }`"
forbid:
  - pattern: "split_at_mut|get_disjoint_mut|split_first_mut"
    message: "Bu alıştırmada std'nin hazır fonksiyonlarını değil, ham işaretçileri kullan!"
require:
  - pattern: "as_mut_ptr\\(\\)"
    message: "Başlangıç adresini `dilim.as_mut_ptr()` ile almalısın."
  - pattern: "SAFETY"
    message: "`unsafe` bloğun üstüne neden güvenli olduğunu anlatan bir `// SAFETY:` yorumu yaz."
explanation: |
  Fonksiyonun sağlamlığı tamamen **kontrollerin sırasına** dayanıyor: `i == j` kontrolü olmasaydı, aynı
  elemana iki `&mut` üretirdik. Bu, derlenen ama tanımsız davranış olan bir koddur (aliasing kuralı
  ihlali). Sınır kontrolü olmasaydı `p.add(i)` dizinin dışını gösterirdi.

  Dönen referansların yaşam süresi imzadaki tek girdi referansına (`dilim`) bağlı, bu yüzden çağıran
  taraf `a` ve `b` yaşarken `v`'yi başka şekilde kullanamaz; borrow checker güvenli tarafta yine görevde.

  Gerçek projede ne yazardın? Rust 1.86'dan beri std'de tam bu işi yapan güvenli bir metot var:
  `v.get_disjoint_mut([i, j])`. Ondan önce de `split_at_mut` ile `if i < j { let (sol, sag) = v.split_at_mut(j); ... }`
  şeklinde hiç `unsafe` yazmadan çözülebiliyordu. Kural: önce güvenli bir yol ara; yoksa unsafe kodu
  bu alıştırmadaki gibi **küçük, kontrollü ve belgelenmiş** tut.
```

## Özet

:::remember
- **Güvenli soyutlama**: küçük bir `unsafe` çekirdeği, hiçbir girdiyle UB üretemeyen güvenli bir arayüzle sar.
- `unsafe fn` sözleşmeyi **çağırana** devreder; dokümanına `/// # Safety` bölümü yazılır. Çağırmak için `unsafe { }` gerekir (yoksa **E0133**).
- Edition 2024: `unsafe fn`'in gövdesi güvenli sayılır; içindeki her unsafe işlem için ayrı `unsafe { }` (lint: `unsafe_op_in_unsafe_fn`).
- `slice::from_raw_parts_mut(ptr, len)` ham işaretçiden dilim üretir; şartları sen sağlarsın.
- Her `unsafe` bloğa **hangi şartın neden sağlandığını** anlatan bir `// SAFETY:` yorumu yaz.
- Değişmezlere dayanan unsafe kodda güvenlik sınırı **modüldür**: alanları gizli tut.
:::

```reflect
prompt: Kendi cümlelerinle açıkla — bir fonksiyonun içinde `unsafe` kod olması neden onun `unsafe fn` olması gerektiği anlamına gelmez?
answer: |
  Model cevap: `unsafe fn` "beni çağıran bir şartı sağlamak zorunda" demektir. Eğer fonksiyon, içindeki
  unsafe işlemlerin tüm şartlarını kendisi kontrol edip garanti edebiliyorsa (örneğin `ikiye_bol`'daki
  assert), çağırana devredilecek bir sorumluluk kalmaz. O zaman fonksiyon güvenli bir arayüz sunar ve
  normal `fn` olur. Sadece şartı çağıranın bilebildiği durumlarda (örneğin `get_unchecked`'te indeksin
  geçerliliği) fonksiyon `unsafe fn` olmalıdır.
```

```flashcards
- front: "`unsafe fn` ile `unsafe { }` bloğu arasındaki fark nedir?"
  back: "`unsafe fn` bir sözleşme **bildirir** (çağıran şart sağlamalı); `unsafe { }` sözleşmeyi **yerine getirir** (şartı ben sağladım)."
- front: "Edition 2024'te `unsafe fn` gövdesindeki ham işaretçi çözme neden uyarı verir?"
  back: "`unsafe_op_in_unsafe_fn` lint'i: unsafe fn'in gövdesi güvenli sayılır; her unsafe işlem kendi `unsafe { }` bloğunda olmalı."
- front: "`split_at_mut`'u safe Rust ile `(&mut s[..m], &mut s[m..])` diye yazmak hangi hatayı verir?"
  back: "`E0499` — borrow checker dilimin farklı bölgelerini ayrı takip etmez, iki `&mut` görür."
- front: Ham işaretçi ve uzunluktan `&mut [T]` üreten std fonksiyonu hangisidir?
  back: "`std::slice::from_raw_parts_mut(ptr, len)` (salt okunur hâli: `from_raw_parts`)."
- front: Bir güvenli fonksiyonun **sound (sağlam)** olması ne demektir?
  back: Güvenli koddan hangi girdiyle çağrılırsa çağrılsın tanımsız davranışa yol açamaması.
- front: "`unsafe fn`'in doküman yorumuna hangi bölüm yazılır?"
  back: "`/// # Safety` — çağıranın uyması gereken şartlar."
- front: Değişmeze (invariant) dayanan unsafe kodda güvenlik sınırı neden modüldür?
  back: Aynı modüldeki güvenli kod da gizli alanları değiştirip değişmezi bozabilir; dışarıdan ise yalnızca gizlilik sayesinde korunur.
```
