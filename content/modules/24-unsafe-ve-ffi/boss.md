---
id: m24-boss
title: "Boss: Unsafe Terbiyecisi"
minutes: 40
type: boss
objectives:
  - "Bir işlemin `unsafe` gerektirip gerektirmediğine, derlenip derlenmeyeceğine ve tanımsız davranış olup olmadığına karar verebilmek"
  - "Ham işaretçiler, `from_raw_parts_mut` ve `MaybeUninit` ile `SAFETY` sözleşmesine uyan güvenli soyutlamalar yazabilmek"
  - "C fonksiyonlarını edition 2024 sözdizimiyle bildirip tehlikeli girdileri reddeden güvenli sarmalayıcılar kurabilmek"
keywords: [boss, unsafe, ham işaretçi, FFI, "extern \"C\"", "static mut", union, UB, "repr(C)", niş, MaybeUninit]
---

Zirvenin son geçidindesin. Bu sınav, `unsafe`'i **kullanabildiğini** değil, onu **terbiye edebildiğini**
gösterecek: ne zaman gerektiğini, hangi sözü verdiğini ve o sözü güvenli bir API'nin arkasına nasıl
sakladığını. Aralarda önceki modüllerden (ödünç alma, `Drop`, UTF-8) sorular da var. Geçmek için **%80**
gerekiyor.

Her kodda üç soru sor: *"Bu işlem süper güç mü?"*, *"Sözleşmenin şartları ne?"* ve *"Şartları kim
garanti ediyor: derleyici mi, ben mi?"*

## Ham işaretçiler ve unsafe'in sınırları

```quiz
question: "Aşağıdaki işlemlerden hangileri bir `unsafe` blok (ya da `unsafe` bağlam) **gerektirir**? (Birden fazla seçenek)"
options:
  - "`let p = &raw const x;` ile ham işaretçi oluşturmak"
  - "`unsafe extern \"C\"` bloğunda `safe` diye işaretlenmemiş `strlen`'i çağırmak"
  - "`*p` ile bir `*const i32`'nin gösterdiği değeri okumak"
  - "Bir `union`'ın alanına yazmak: `u.f = 1.0;`"
  - "`static SAYAC: AtomicU32` üzerinde `fetch_add` çağırmak"
  - "`static mut` bir değişkenin değerini yerel bir değişkene kopyalamak"
answer: [1, 2, 5]
explanation: |
  Beş süper gücü hatırla: ham işaretçi **çözmek**, `unsafe fn` çağırmak (işaretsiz `extern` öğeleri de
  `unsafe fn`'dir), `static mut`'a **erişmek** (okumak dahil), `unsafe trait` uygulamak ve union alanı
  **okumak**. İşaretçi oluşturmak sadece adres hesaplamaktır; union alanına yazmak hiçbir geçersiz değeri
  okumaz; atomik `static` ise iç değişkenlikle güvenli biçimde paylaşılır.
feedback:
  - "Oluşturmak güvenli; tehlike çözerken başlar."
  - "Doğru: işaretsiz `extern` öğesi bir `unsafe fn`'dir."
  - "Doğru: süper güç #1."
  - "Yazmak güvenli; sadece **okumak** `unsafe`'tir."
  - "Atomik tipler `unsafe` olmadan paylaşılır; `static mut`'tan kaçmanın yolu tam da budur."
  - "Doğru: `static mut`'a her erişim (okuma da) süper güç #3'tür."
```

```predict
code: |
  fn main() {
      let mut stok = [5, 8, 2, 9];
      let n = stok.len();
      let p = stok.as_mut_ptr();
      // SAFETY: kullanılan bütün konumlar 0..n aralığında; stok'a başka erişim yok.
      unsafe {
          *p.add(1) += 10;
          let son = p.add(n - 1);
          *p = *son - *p.add(2);
          *son = 0;
      }
      println!("{stok:?}");
  }
options:
  - "[7, 18, 2, 0]"
  - "[5, 18, 2, 0]"
  - "[7, 18, 2, 9]"
  - "[-7, 18, 2, 0]"
answer: 0
explanation: |
  `add` **eleman** sayar. `*p.add(1) += 10` → `stok[1] = 18`. `son` son elemanı (indeks 3) gösterir;
  `*p = *son - *p.add(2)` → `stok[0] = 9 - 2 = 7`. Bu satır `*son = 0`'dan **önce** çalıştığı için 9
  kullanılır. Son olarak `stok[3] = 0`. `n`'yi işaretçiyi almadan önce hesaplamak da iyi bir alışkanlık:
  işaretçi yaşarken diziye referansla dokunmamış oluruz.
```

```compiles
code: |
  fn main() {
      let mut puan = 10;
      unsafe {
          let a = &mut puan;
          let b = &mut puan;
          *a += 1;
          *b += 1;
      }
      println!("{puan}");
  }
answer: false
error: E0499
explanation: |
  `unsafe` borrow checker'ı **kapatmaz**; sadece beş ek işleme izin verir. Aynı anda iki canlı `&mut`
  yine `E0499`'dur. Derleyici ayrıca "unnecessary `unsafe` block" uyarısı verir: blokta hiçbir süper güç
  kullanılmıyor.
```

```compiles
code: |
  fn main() {
      let mut notlar = vec![70, 85];
      let ilk = &notlar[0];
      notlar.push(90);
      println!("{ilk}");
  }
answer: false
error: E0502
explanation: |
  Modül 5'ten tanıdık: `ilk` paylaşılan bir ödünç alma, `push` ise `&mut` ister. Asıl tehlike şu: `push`
  kapasite dolduğunda veriyi **yeni bir yere taşır** ve eski adres sarkar. Referanslarla bunu borrow checker
  yakalar. Aynı şeyi `notlar.as_ptr()` ile ham işaretçiyle yapsaydın kod **derlenirdi** ve `*p` okumak UB
  olurdu. 1. dersteki ders: ham işaretçiler bu korumadan yoksundur.
```

## Güvenli soyutlamalar ve FFI

```fill
prompt: "Boşlukları doldurarak `ikiye_bol`'u `split_at_mut` gibi güvenli bir soyutlama olarak tamamla."
code: |
  use std::slice;

  fn ikiye_bol(v: &mut [i32], orta: usize) -> (&mut [i32], &mut [i32]) {
      let n = v.len();
      let p = v.as_mut_ptr();
      ___0!(orta <= n, "orta sınır dışında");
      // SAFETY: orta <= n; [0, orta) ve [orta, n) çakışmaz ve ikisi de v'nin içinde.
      unsafe {
          (
              slice::___1(p, orta),
              slice::from_raw_parts_mut(p.___2(orta), n - orta),
          )
      }
  }

  fn main() {
      let mut v = [1, 2, 3, 4, 5];
      let (a, b) = ikiye_bol(&mut v, 2);
      a[0] = 10;
      b[0] = 30;
      println!("{v:?}");
  }
blanks:
  - ["assert"]
  - ["from_raw_parts_mut"]
  - ["add"]
output: "[10, 2, 30, 4, 5]"
explanation: |
  `assert!` sözleşmenin şartını (`orta <= n`) **güvenli kodda** garanti eder; bu satır olmasaydı
  `ikiye_bol(&mut v, 99)` güvenli koddan UB üretebilirdi ve fonksiyon **unsound** olurdu.
  `from_raw_parts_mut(p, orta)` ilk yarıyı, `p.add(orta)` ise ikinci yarının başlangıcını verir. İki dilim
  çakışmadığı için iki `&mut` aynı anda yaşayabilir.
```

```quiz
question: "Edition 2024'te bir `unsafe fn`'nin gövdesinde, ayrıca `unsafe { }` yazmadan bir ham işaretçi çözersen ne olur?"
options:
  - "Hiçbir şey; `unsafe fn`'nin bütün gövdesi zaten `unsafe` bağlamdır"
  - "`unsafe_op_in_unsafe_fn` uyarısı alırsın; gövde artık güvenli sayılır ve tehlikeli işlem kendi `unsafe` bloğunu ister"
  - "Program derlenir ama çalışırken panikler"
  - "`unsafe fn` içinde ham işaretçi çözmek hiçbir koşulda mümkün değildir"
answer: 1
explanation: |
  Edition 2024 iki kavramı ayırır: `unsafe fn` **çağırana** bir sözleşme yükler ("şu şartları sen
  sağla"), içerideki `unsafe { }` ise **o işlemin** şartlarının sağlandığını belgeler. Her blok kendi
  `// SAFETY:` yorumunu alır; böylece uzun bir `unsafe fn`'de hangi satırların tehlikeli olduğu görünür kalır.
feedback:
  - "Eski edition'larda öyleydi; 2024'te `unsafe_op_in_unsafe_fn` varsayılan olarak uyarır."
  - "Doğru!"
  - "`unsafe` kuralları derleme zamanı kurallarıdır; panikle ilgisi yok."
  - "Mümkün, sadece kendi `unsafe` bloğuyla."
```

```predict
code: |
  use std::ffi::c_char;

  unsafe extern "C" {
      fn strlen(s: *const c_char) -> usize;
  }

  fn main() {
      let kelime = c"çay";
      // SAFETY: c"..." literal'i \0 ile biten geçerli bir C dizgisidir.
      let n = unsafe { strlen(kelime.as_ptr()) };
      println!("{n} {}", kelime.to_bytes_with_nul().len());
  }
options:
  - "3 4"
  - "4 5"
  - "4 4"
  - "3 3"
answer: 1
explanation: |
  Modül 9'u hatırla: `ç` UTF-8'de **2 bayttır**. C'nin `strlen`'i karakter değil, `\0`'a kadar olan
  **baytları** sayar: `ç`(2) + `a`(1) + `y`(1) = 4. `to_bytes_with_nul` sondaki `\0`'ı da içerir: 5.
  C'ye Türkçe metin gönderirken "uzunluk" kelimesinin hep bayt anlamına geldiğini unutma.
```

````quiz
question: |
  Şu kodda ne yanlış?

  ```rust
  let p = CString::new("merhaba").unwrap().as_ptr();
  unsafe { puts(p) };
  ```
options:
  - "Hiçbir şey; `as_ptr` dizgiyi kopyalar"
  - "`CString` geçici bir değer; satırın sonunda drop edilir ve `p` sarkan bir işaretçi olur"
  - "`CString::new` her zaman `Err` döndürür, `unwrap` panikler"
  - "`puts` bir C fonksiyonu olduğu için `CString` alamaz, `String` ister"
answer: 1
explanation: |
  `as_ptr` sahipliği almaz, sadece adresi verir. `CString` hiçbir değişkene bağlanmadığı için ifadenin
  sonunda drop edilir ve bellek serbest kalır; `puts(p)` serbest bırakılmış belleği okur: UB. Derleyici bu
  kalıbı `dangling_pointers_from_temporaries` uyarısıyla yakalar. Doğrusu:
  `let c = CString::new("merhaba")?; unsafe { puts(c.as_ptr()) };`. Sahip değişkende yaşar.
feedback:
  - "`as_ptr` hiçbir şey kopyalamaz; sadece adres verir."
  - "Doğru!"
  - "`CString::new` yalnızca dizginin ortasında `\\0` varsa `Err` döner."
  - "C `String`'i tanımaz; tam tersine `\\0` ile biten bir `char*` ister, `CString` tam da bu."
````

```parsons
prompt: "Satırları sıralayarak Rust fonksiyonunu C'ye **edition 2024** sözdizimiyle açan ve deneyen programı kur."
lines: |
  #[unsafe(no_mangle)]
  pub extern "C" fn kdv_ekle(fiyat: f64) -> f64 {
      fiyat * 1.20
  }
  fn main() {
      println!("{}", kdv_ekle(100.0));
  }
distractors: |
  #[no_mangle]
  pub fn kdv_ekle(fiyat: f64) -> f64 {
  unsafe extern "C" {
explanation: |
  `#[unsafe(no_mangle)]` sembol adını değiştirmeden bırakır. Edition 2024'te bu öznitelik `unsafe(...)`
  ile sarılmak zorunda (çıplak `#[no_mangle]` "unsafe attribute used without unsafe" hatası verir), çünkü
  aynı adlı iki sembol bağlayıcıda çakışıp UB'ye yol açabilir. `extern "C"` fonksiyonun C çağrı kuralını
  kullanmasını sağlar; `unsafe extern "C" { }` ise ters yönü, yani C fonksiyonlarını **bildirmeyi** anlatır.
```

## Statikler, union'lar, UB ve bellek düzeni

```compiles
code: |
  static mut KASA: i64 = 0;

  fn yatir(miktar: i64) {
      // SAFETY: tek thread'li program.
      unsafe { KASA += miktar; }
  }

  fn main() {
      yatir(100);
      yatir(50);
      let r = unsafe { &KASA };
      println!("{r}");
  }
answer: false
explanation: |
  Edition 2024'te `static mut`'a `&` ya da `&mut` **referans** oluşturmak `static_mut_refs` lint'iyle
  reddedilir (deny); `unsafe` blok bunu değiştirmez. Değeri kopyalamak (`let t = unsafe { KASA };`)
  derlenir. Daha iyisi: `static KASA: AtomicI64` ya da `Mutex<i64>` kullanıp `unsafe`'i tamamen kaldırmak.
```

```predict
code: |
  #[allow(dead_code)]
  #[repr(C)]
  struct Kayit {
      a: u8,
      b: u16,
      c: u8,
  }

  fn main() {
      println!("{}", size_of::<Kayit>());
      println!("{}", size_of::<Option<Box<u8>>>());
      println!("{}", size_of::<Option<u32>>());
  }
options:
  - |
    6
    8
    8
  - |
    4
    8
    8
  - |
    6
    16
    8
  - |
    6
    8
    5
answer: 0
explanation: |
  `repr(C)`: `a` 0'da, 1 bayt dolgu, `b` 2-3'te, `c` 4'te; 5 bayt hizanın (2) katına yuvarlanır: **6**.
  (Varsayılan Rust düzeni `b`'yi başa alıp 4 bayta indirebilirdi.) `Box` asla null olmadığı için
  `Option<Box<u8>>` niş optimizasyonuyla **8** kalır. `u32`'nin boşta deseni yok; etiket + hiza dolgusu ile
  `Option<u32>` **8** olur, 5 değil: boyut her zaman hizanın katıdır.
```

```quiz
question: "Ağdan gelen `b: u8` baytını `#[repr(u8)] enum Komut { Dur = 0, Ileri = 1 }` tipine çevirmenin doğru yolu hangisi?"
options:
  - "`unsafe { std::mem::transmute::<u8, Komut>(b) }`, çünkü `repr(u8)` boyutları eşitliyor"
  - "`b as Komut`"
  - "Her geçerli değeri `match` ile eşleyip geçersizler için `None`/`Err` döndürmek (ya da `TryFrom<u8>` uygulamak)"
  - "`union { b: u8, k: Komut }` ile `b`'yi yazıp `k`'yi okumak"
answer: 2
explanation: |
  `Komut` için yalnızca 0 ve 1 geçerli bit desenleridir. Ağdan 7 gelirse `transmute` da `union` da
  **geçersiz bir enum değeri** üretir: UB (4. dersteki tablo). `b as Komut` ise hiç derlenmez; `as` sadece
  enum'dan sayıya gider. Doğru yol, girdiyi doğrulayan bir `match`, idiomatik hâli de `TryFrom<u8>`.
feedback:
  - "Boyut eşitliği yetmez; 2..=255 değerleri `Komut` için geçersiz desenlerdir."
  - "`as` sayıdan enum'a dönüştüremez (E0605: non-primitive cast)."
  - "Doğru!"
  - "Bu da bir `transmute`'tur; geçersiz bayt için yine UB."
```

```predict
code: |
  struct Kaynak(&'static str);

  impl Drop for Kaynak {
      fn drop(&mut self) {
          println!("kapat {}", self.0);
      }
  }

  fn main() {
      let _a = Kaynak("dosya");
      let _b = Kaynak("soket");
      {
          let _c = Kaynak("kilit");
      }
      println!("son");
  }
options:
  - |
    kapat kilit
    son
    kapat soket
    kapat dosya
  - |
    kapat kilit
    son
    kapat dosya
    kapat soket
  - |
    son
    kapat dosya
    kapat soket
    kapat kilit
  - |
    son
    kapat kilit
    kapat soket
    kapat dosya
answer: 0
explanation: |
  Modül 17: `_c` iç kapsamın sonunda hemen drop edilir. `main`'in sonunda yerel değişkenler **ters
  sırada** drop edilir: önce `_b`, sonra `_a`. FFI'daki RAII sarmalayıcılar (3. dersteki `CTampon`) bu sıraya
  güvenir: sonradan açılan kaynak önce kapanır. Dikkat: `let _ = Kaynak(..)` yazsaydın değer hemen drop
  edilirdi; `_a` ise gerçek bir bağlamadır.
```

## Uygulama

```exercise
id: m24-boss-e-mutlak
title: "C'nin abs'ine güvenli sarmalayıcı"
difficulty: 2
prompt: |
  Bir muhasebe programı borç/alacak farklarının mutlak değerini C kütüphanesindeki `abs` ile hesaplıyor.
  Sorun: C standardına göre `abs(INT_MIN)` **tanımsız davranıştır**, çünkü `2147483648` bir `int`'e sığmaz.

  1. C'nin `int abs(int)` fonksiyonunu bir `unsafe extern "C"` bloğunda bildir. Her girdi için güvenli
     olmadığından onu `safe` diye **işaretleme**: `unsafe fn` olarak kalsın.
  2. `guvenli_mutlak(x)` fonksiyonunu yaz: `x == i32::MIN` ise `None`, değilse `Some(abs(x))` döndürsün.
     `abs` çağrısının üstüne neden güvenli olduğunu anlatan bir `// SAFETY:` yorumu ekle.

  Rust'ın kendi `.abs()` ailesini kullanma; amaç C çağrısını güvenli bir API'nin arkasına saklamak.
starter: |
  use std::ffi::c_int;

  // TODO: C'nin `int abs(int)` fonksiyonunu bildir (safe diye işaretleme!)

  fn guvenli_mutlak(x: i32) -> Option<i32> {
      todo!()
  }

  fn main() {
      println!("{:?}", guvenli_mutlak(-7));
      println!("{:?}", guvenli_mutlak(i32::MIN));
  }
solution: |
  use std::ffi::c_int;

  unsafe extern "C" {
      // Her girdi için tanımlı değil (INT_MIN), bu yüzden `safe` değil.
      fn abs(x: c_int) -> c_int;
  }

  fn guvenli_mutlak(x: i32) -> Option<i32> {
      if x == i32::MIN {
          return None;
      }
      // SAFETY: İmza C'deki `int abs(int)` ile aynı (c_int = i32) ve x != INT_MIN,
      // dolayısıyla sonuç int'e sığar; abs bu girdi için tanımlıdır.
      Some(unsafe { abs(x) })
  }

  fn main() {
      println!("{:?}", guvenli_mutlak(-7));
      println!("{:?}", guvenli_mutlak(i32::MIN));
  }
check: tests
tests: |
  #[test]
  fn negatif_pozitif_ve_sifir() {
      assert_eq!(guvenli_mutlak(-42), Some(42), "-42'nin mutlak değeri 42");
      assert_eq!(guvenli_mutlak(17), Some(17), "pozitif sayı değişmemeli");
      assert_eq!(guvenli_mutlak(0), Some(0), "0'ın mutlak değeri 0");
  }

  #[test]
  fn en_kucuk_i32_reddedilir() {
      assert_eq!(guvenli_mutlak(i32::MIN), None, "i32::MIN için C'nin abs'i UB'dir; None dönmeli");
  }

  #[test]
  fn sinirlarin_hemen_yani() {
      assert_eq!(guvenli_mutlak(i32::MIN + 1), Some(i32::MAX), "MIN+1'in mutlak değeri MAX'a sığar");
      assert_eq!(guvenli_mutlak(i32::MAX), Some(i32::MAX));
  }

  #[test]
  fn karisik_degerler() {
      for x in [-1000, -1, 1, 3, 99, -123456] {
          let beklenen = if x < 0 { -x } else { x };
          assert_eq!(guvenli_mutlak(x), Some(beklenen), "{x} için yanlış sonuç");
      }
  }
hints:
  - "Bildirim: `unsafe extern \"C\" { fn abs(x: c_int) -> c_int; }`. Başına `safe` yazmadığın için `abs` bir `unsafe fn` olur."
  - "Önce tehlikeli girdiyi ele: `if x == i32::MIN { return None; }`. Bu kontrol, `unsafe` bloğun sözleşmesini güvenli kodda sağlar."
  - "Son satır: `Some(unsafe { abs(x) })`, üstünde `// SAFETY:` yorumuyla."
require:
  - pattern: "unsafe\\s+extern\\s+\"C\""
    message: "`abs`'i bir `unsafe extern \"C\"` bloğunda bildirmelisin."
  - pattern: "unsafe\\s*\\{\\s*abs\\s*\\("
    message: "`abs`'i bir `unsafe { abs(x) }` bloğu içinde çağırmalısın."
  - pattern: "SAFETY"
    message: "`unsafe` bloğun üstüne bir `// SAFETY:` yorumu yaz."
forbid:
  - pattern: "\\bsafe\\s+fn"
    message: "`abs` her girdi için güvenli değil; onu `safe fn` diye işaretleme."
  - pattern: "\\.(abs|checked_abs|unsigned_abs|wrapping_abs|saturating_abs|overflowing_abs)\\s*\\("
    message: "Rust'ın `.abs()` ailesini kullanma; C'nin `abs`'ini güvenli bir sarmalayıcıyla çağır."
explanation: |
  Bu, modülün özünü bir fonksiyonda topluyor: tehlikeli (`unsafe fn`) bir işlemi, şartlarını **güvenli
  kodda** kontrol eden küçük bir sarmalayıcıyla saklamak. `guvenli_mutlak`'ı çağıran kişi hiçbir girdiyle UB
  üretemez; bu yüzden fonksiyon `unsafe` olmadan sunulabilir (**sound**).

  `abs`'i `safe fn` diye bildirseydin, herhangi bir güvenli kod `abs(i32::MIN)` yazıp C tarafında UB
  tetikleyebilirdi. Pratikte glibc bu durumda `INT_MIN` döndürür, ama "pratikte çalışıyor" UB için hiçbir
  şey kanıtlamaz; optimizasyon yapan bir C derleyicisi bu varsayımı istediği gibi kullanabilir.

  Saf Rust'ta aynı işin hazırı `x.checked_abs()`'tir: `i32::MIN` için `None` döndürür. Dönüş tipini
  `Option` yapmak da Modül 10'daki ilkeyle uyumlu: başarısız olabilen işlem bunu tipinde söyler.
```

```exercise
id: m24-boss-e-vardiya
title: Fırının satışlarını üç vardiyaya böl
difficulty: 3
prompt: |
  Bir fırın, günün saatlik satış adetlerini tek bir dilimde tutuyor. Sabah, öğle ve akşam vardiyalarının
  ekipleri **kendi** bölümlerini aynı anda güncelleyebilmeli; bunun için üç ayrı `&mut` dilim gerekiyor.

  `bol_uce(v, a, b)` fonksiyonunu yaz: `v`'yi `[0, a)`, `[a, b)` ve `[b, len)` olarak üç çakışmayan
  değiştirilebilir dilime ayırsın. `a <= b <= len` değilse **panik** etsin (sınır kontrolü güvenliğin
  şartıdır).

  `split_at_mut` ve benzerlerini kullanma; `as_mut_ptr`, `add` ve `slice::from_raw_parts_mut` ile çöz ve
  `unsafe` bloğa bir `// SAFETY:` yorumu yaz.
starter: |
  use std::slice;

  fn bol_uce(v: &mut [u32], a: usize, b: usize) -> (&mut [u32], &mut [u32], &mut [u32]) {
      todo!()
  }

  fn main() {
      let mut satis = [5, 8, 13, 21, 34, 55];
      let (sabah, ogle, aksam) = bol_uce(&mut satis, 2, 4);
      sabah[0] += 1;
      ogle[0] += 1;
      aksam[0] += 1;
      println!("{satis:?}");
  }
solution: |
  use std::slice;

  fn bol_uce(v: &mut [u32], a: usize, b: usize) -> (&mut [u32], &mut [u32], &mut [u32]) {
      let n = v.len();
      assert!(a <= b && b <= n, "geçersiz sınırlar: a={a}, b={b}, uzunluk={n}");
      let p = v.as_mut_ptr();
      // SAFETY: a <= b <= n olduğu için [0, a), [a, b) ve [b, n) aralıkları
      // birbirinden ayrık ve v'nin içinde. v'den gelen &mut tekil erişimi garanti
      // ediyor; dönen dilimler v'nin yaşam süresini taşıyor (yaşam süresi kuralı).
      unsafe {
          (
              slice::from_raw_parts_mut(p, a),
              slice::from_raw_parts_mut(p.add(a), b - a),
              slice::from_raw_parts_mut(p.add(b), n - b),
          )
      }
  }

  fn main() {
      let mut satis = [5, 8, 13, 21, 34, 55];
      let (sabah, ogle, aksam) = bol_uce(&mut satis, 2, 4);
      sabah[0] += 1;
      ogle[0] += 1;
      aksam[0] += 1;
      println!("{satis:?}");
  }
check: tests
tests: |
  #[test]
  fn uc_parcaya_boler() {
      let mut satis = [5, 8, 13, 21, 34, 55];
      let (sabah, ogle, aksam) = bol_uce(&mut satis, 2, 4);
      assert_eq!(sabah, &[5, 8], "sabah [0, 2) olmalı");
      assert_eq!(ogle, &[13, 21], "öğle [2, 4) olmalı");
      assert_eq!(aksam, &[34, 55], "akşam [4, 6) olmalı");
  }

  #[test]
  fn parcalar_ayri_ayri_degistirilebilir() {
      let mut satis = [1, 1, 1, 1, 1];
      {
          let (s, o, a) = bol_uce(&mut satis, 1, 3);
          s[0] += 10;
          o[1] += 20;
          a[1] += 30;
      }
      assert_eq!(satis, [11, 1, 21, 1, 31], "her parça orijinal dizinin doğru bölümünü göstermeli");
  }

  #[test]
  fn bos_parcalar() {
      let mut v = [7, 9];
      {
          let (s, o, a) = bol_uce(&mut v, 0, 0);
          assert!(s.is_empty() && o.is_empty(), "a = b = 0 iken ilk iki parça boş olmalı");
          assert_eq!(a, &[7, 9]);
      }
      let (s, o, a) = bol_uce(&mut v, 2, 2);
      assert_eq!(s, &[7, 9]);
      assert!(o.is_empty() && a.is_empty(), "a = b = len iken son iki parça boş olmalı");
  }

  #[test]
  #[should_panic]
  fn ters_sinirlar_panik() {
      let mut v = [1, 2, 3];
      bol_uce(&mut v, 2, 1);
  }

  #[test]
  #[should_panic]
  fn uzunluk_disi_panik() {
      let mut v = [1, 2, 3];
      bol_uce(&mut v, 1, 4);
  }
hints:
  - "Önce şartı güvenli kodda doğrula: `assert!(a <= b && b <= n, ...)`. Bu kontrol olmazsa fonksiyon unsound olur."
  - "`let p = v.as_mut_ptr();` sonra üç dilim: başlangıçlar `p`, `p.add(a)`, `p.add(b)`; uzunluklar `a`, `b - a`, `n - b`."
  - "`unsafe { (slice::from_raw_parts_mut(p, a), slice::from_raw_parts_mut(p.add(a), b - a), slice::from_raw_parts_mut(p.add(b), n - b)) }`"
require:
  - pattern: "from_raw_parts_mut"
    message: "Dilimleri `slice::from_raw_parts_mut` ile oluşturmalısın."
  - pattern: "SAFETY"
    message: "`unsafe` bloğun üstüne bir `// SAFETY:` yorumu yaz."
forbid:
  - pattern: "split_at|split_first|split_last|chunks"
    message: "Bu alıştırmada `split_at_mut` ve benzerlerini kullanma; amaç onu ham işaretçilerle kendin kurmak."
explanation: |
  2. dersteki `split_at_mut`'un üç parçalı hâli. Güvenliğin iki ayağı var: `assert!` aralıkların `v`'nin
  içinde olduğunu, aralıkların aritmetiği (`[0,a)`, `[a,b)`, `[b,n)`) ise **çakışmadıklarını** garanti
  ediyor. Çakışmayan `&mut`'lar aliasing kuralını çiğnemez. Dönüş tipindeki üç dilim, yaşam süresi atlama
  kuralı (Modül 12) sayesinde `v`'nin ödünç süresini taşır; `v` serbest kalmadan onları kullanmak derleyici
  tarafından engellenir.

  `assert!`'i `debug_assert!` yapmak cazip görünebilir, ama `--release`'te kontrol kalkar ve güvenli koddan
  UB üretilebilir hâle gelir. Güvenliği taşıyan kontrol **her zaman** `assert!` olmalı. Güvenli bir
  alternatif: `let (ilk, kalan) = v.split_at_mut(a); let (orta, son) = kalan.split_at_mut(b - a);`.
  Gerçek kodda bunu yazarsın; std'nin kendi `split_at_mut`'u içeride tam olarak senin yazdığını yapar.
```

````exercise
id: m24-boss-e-dizi-olustur
title: Sinema koltuk etiketlerini MaybeUninit ile üret
difficulty: 4
prompt: |
  Bir sinema salonunun bilet sistemi, her sıranın koltuk etiketlerini sabit boyutlu bir `[String; N]`
  dizisinde tutuyor. Genel bir yardımcı yaz:

  ```rust
  fn dizi_olustur<const N: usize>(f: impl Fn(usize) -> String) -> [String; N]
  ```

  `f`'yi `0, 1, ..., N-1` için **sırayla, birer kez** çağırsın ve sonuçları diziye koysun. Diziyi önce
  boş bir değerle doldurmak mümkün olmadığından (`String` `Copy` değil), `MaybeUninit<[String; N]>`
  kullan: yer ayır, her elemanı `write` ile yaz, sonunda `assume_init` ile al.

  `std::array::from_fn`, `Vec`, `collect`, `.map(` ve `Default` kullanma.
starter: |
  use std::mem::MaybeUninit;

  fn dizi_olustur<const N: usize>(f: impl Fn(usize) -> String) -> [String; N] {
      todo!()
  }

  fn main() {
      let koltuklar: [String; 4] = dizi_olustur(|i| format!("C{}", i + 1));
      println!("{koltuklar:?}");
  }
solution: |
  use std::mem::MaybeUninit;

  fn dizi_olustur<const N: usize>(f: impl Fn(usize) -> String) -> [String; N] {
      let mut kutu: MaybeUninit<[String; N]> = MaybeUninit::uninit();
      let p = kutu.as_mut_ptr() as *mut String;
      for i in 0..N {
          // SAFETY: i < N olduğundan p.add(i) dizinin içinde ve hizalı. `write`
          // başlatılmamış eski değeri okumaz ve drop etmeye çalışmaz.
          unsafe { p.add(i).write(f(i)) };
      }
      // SAFETY: Döngü 0..N aralığındaki her elemanı tam bir kez yazdı.
      unsafe { kutu.assume_init() }
  }

  fn main() {
      let koltuklar: [String; 4] = dizi_olustur(|i| format!("C{}", i + 1));
      println!("{koltuklar:?}");
  }
check: tests
tests: |
  #[test]
  fn koltuk_etiketleri() {
      let sira: [String; 4] = dizi_olustur(|i| format!("C{}", i + 1));
      assert_eq!(sira, ["C1", "C2", "C3", "C4"], "C sırası 1'den 4'e etiketlenmeli");
  }

  #[test]
  fn yakalanan_degisken_ve_tek_numaralar() {
      let harf = 'F';
      let tekler: [String; 3] = dizi_olustur(|i| format!("{harf}{}", i * 2 + 1));
      assert_eq!(tekler, ["F1", "F3", "F5"], "closure'ın yakaladığı harf kullanılmalı");
  }

  #[test]
  fn bos_dizi() {
      let bos: [String; 0] = dizi_olustur(|_| panic!("N = 0 iken f hiç çağrılmamalı"));
      assert!(bos.is_empty());
  }

  #[test]
  fn sirayla_ve_birer_kez_cagirir() {
      let cagrilar = std::cell::RefCell::new(Vec::new());
      let _d: [String; 5] = dizi_olustur(|i| {
          cagrilar.borrow_mut().push(i);
          i.to_string()
      });
      assert_eq!(*cagrilar.borrow(), vec![0, 1, 2, 3, 4], "f, 0..N için sırayla ve birer kez çağrılmalı");
  }
hints:
  - "Yer ayır: `let mut kutu: MaybeUninit<[String; N]> = MaybeUninit::uninit();` ve eleman işaretçisini al: `let p = kutu.as_mut_ptr() as *mut String;`"
  - "Döngüde `*p.add(i) = f(i)` değil, `p.add(i).write(f(i))` yaz: atama başlatılmamış eski değeri drop etmeye çalışırdı (UB)."
  - "Bütün elemanlar yazıldıktan sonra `unsafe { kutu.assume_init() }` döndür; her iki `unsafe` bloğa da `// SAFETY:` yorumu ekle."
require:
  - pattern: "MaybeUninit"
    message: "Çözümünde `MaybeUninit` kullanmalısın."
  - pattern: "\\.write\\s*\\("
    message: "Elemanları `ptr.write(...)` ile yazmalısın."
  - pattern: "assume_init"
    message: "Sonunda `assume_init` ile başlatılmış diziyi almalısın."
forbid:
  - pattern: "from_fn|Vec|vec!|collect|\\.map\\(|Default|zeroed"
    message: "`from_fn`, `Vec`, `collect`, `.map(`, `Default` ya da `zeroed` kullanma; diziyi `MaybeUninit` ile kendin kur."
explanation: |
  Sözleşme üç adımdır: `uninit()` yer ayırır, `write` her elemanı eski çöpe dokunmadan yerleştirir,
  `assume_init` ise "hepsi başlatıldı" sözüdür. Döngü `0..N`'nin tamamını dolaştığı için söz tutulur.
  `*p.add(i) = f(i)` yazsaydın atama, sol taraftaki başlatılmamış "`String`"i drop etmeye çalışırdı: çöp bir
  işaretçiyi `free` etmek, yani UB. `std::mem::zeroed()` de çözüm değil: sıfırlarla dolu bir `String` null
  işaretçi içerir ve geçersiz bir değerdir.

  Gizli bir ayrıntı daha: `f` yarıda panik ederse, o ana kadar yazılmış `String`'ler `MaybeUninit` içinde
  kalır ve **sızar** (leak). Bu UB değildir, ama std'nin `std::array::from_fn`'i bunu bir "koruyucu" (guard)
  struct'ın `Drop`'uyla çözer: panik anında yalnızca yazılmış elemanları drop eder. Gerçek kodda tam olarak
  `std::array::from_fn(|i| format!("C{}", i + 1))` yazarsın; artık içinde ne olduğunu biliyorsun.
````
