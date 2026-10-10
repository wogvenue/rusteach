---
id: m17-l02
title: Deref ve deref zorlaması
minutes: 20
type: lesson
objectives:
  - "`*` operatörünün referanslarda ve `Box`'ta nasıl çalıştığını, kendi tipinde ise neden `E0614` verdiğini açıklayabilmek"
  - "Kendi akıllı işaretçin için `Deref` (ve gerektiğinde `DerefMut`) uygulayabilmek"
  - "Deref zorlamasının (`&Box<String>` → `&String` → `&str`) hangi zincirle ve hangi değiştirilebilirlik kurallarıyla çalıştığını söyleyebilmek"
  - "`Deref`'in doğru (akıllı işaretçi, sarmalayıcı) ve yanlış (kalıtım taklidi, değişmezi bozan `DerefMut`) kullanımlarını ayırt edebilmek"
keywords: [Deref, DerefMut, "*", deref zorlaması, deref coercion, E0614, E0596, Target, "&str", newtype]
---

Önceki dersin alıştırmasında `toplam(kalan)` çağrısı, fonksiyon `&Liste` beklerken bir `&Box<Liste>`
alıyordu ve derleyici hiç itiraz etmedi. Aslında bu "sihri" Modül 5'ten beri kullanıyorsun: `&str`
bekleyen bir fonksiyona `&String` verebiliyordun. Bu derste perdeyi kaldırıyoruz: ikisinin arkasında da
aynı trait var, `Deref`.

`Deref`, bir tipin **"ben bir işaretçiyim, beni `*` ile açabilirsin"** demesini sağlar. Box'ı, String'i,
Vec'i akıllı işaretçi yapan şey de budur.

## `*` operatörünü hatırla

Modül 5'te `*` ile bir referansın gösterdiği değere ulaşmıştın. Önce tahmin et:

```compiles
code: |
  fn main() {
      let x = 5;
      let y = &x;
      assert_eq!(5, y);
  }
answer: false
error: E0277
explanation: |
  `y` bir `i32` değil, bir `&i32`'dir: bir **adres**. "Bir sayı bir adrese eşit mi?" sorusu anlamsızdır;
  Rust ikisini karşılaştırmayı reddeder. Önce adresi izleyip değere ulaşman gerekir: `assert_eq!(5, *y);`
```

:::error
```text
error[E0277]: can't compare `{integer}` with `&{integer}`
 --> src/main.rs:4:5
  |
4 |     assert_eq!(5, y);
  |     ^^^^^^^^^^^^^^^^ no implementation for `{integer} == &{integer}`
  |
  = help: the trait `PartialEq<&{integer}>` is not implemented for `{integer}`
```
Modül 11'den tanıdık: `==` aslında `PartialEq` trait'idir ve "sayı == sayıya referans" için bir `impl` yok.
:::

`Box` aynı şekilde çalışır. Farkı, gösterdiği değerin heap'te olması ve onun **sahibi** olmasıdır:

```rust
fn main() {
    let x = 5;
    let referans = &x; // x'i ödünç alır, stack'teki x'i gösterir
    let kutu = Box::new(x); // x'in KOPYASI heap'e konur, kutu onun sahibidir

    assert_eq!(5, *referans);
    assert_eq!(5, *kutu);
    println!("ikisi de 5'e ulaşıyor: {} {}", *referans, *kutu);
}
```

```memory
title: Referans ve Box yan yana
steps:
  - caption: "`referans` stack'teki `x`'i gösterir (ödünç). `kutu` heap'teki kendi kopyasını gösterir (sahip). İkisi de `*` ile açılır."
    stack:
      - frame: main
        vars:
          - { name: x, type: i32, value: "5" }
          - { name: referans, type: "&i32", value: "adres", to: x }
          - { name: kutu, type: "Box<i32>", value: "adres", to: h1 }
    heap:
      - { id: h1, value: "5", label: "kutu'nun malı" }
```

## Kendi kutumuzu yapalım: `Kutum<T>`

`Box`'ın nasıl çalıştığını anlamanın en iyi yolu, benzerini yazmaktır. Basitlik için değeri heap'e değil,
bir tuple struct'ın içine koyalım (Modül 6). Önce tahmin et, bu derlenir mi?

```compiles
code: |
  struct Kutum<T>(T);

  impl<T> Kutum<T> {
      fn new(x: T) -> Kutum<T> {
          Kutum(x)
      }
  }

  fn main() {
      let y = Kutum::new(5);
      assert_eq!(5, *y);
  }
answer: false
error: E0614
explanation: |
  `*` operatörü yalnızca derleyicinin "nasıl açılacağını" bildiği tiplerde çalışır. `Kutum` sıradan bir
  struct; Rust onun bir işaretçi gibi davranması gerektiğini bilemez. Bunu ona `Deref` trait'i ile
  söyleriz.
```

:::error
```text
error[E0614]: type `Kutum<{integer}>` cannot be dereferenced
  --> src/main.rs:11:19
   |
11 |     assert_eq!(5, *y);
   |                   ^^ can't be dereferenced
```
"Bu tip açılamaz (dereference edilemez)." Kısa ve net: `Kutum` için `*`'ın anlamı tanımlı değil.
:::

`Deref` trait'inin tek bir zorunlu metodu var: `deref`, kendine bir referans alır ve **içteki veriye bir
referans** döndürür.

```rust
use std::ops::Deref;

struct Kutum<T>(T);

impl<T> Kutum<T> {
    fn new(x: T) -> Kutum<T> {
        Kutum(x)
    }
}

impl<T> Deref for Kutum<T> {
    type Target = T; // "açınca ne bulursun?" sorusunun cevabı

    fn deref(&self) -> &Self::Target {
        &self.0 // tuple struct'ın ilk alanına bir referans
    }
}

fn main() {
    let y = Kutum::new(5);
    assert_eq!(5, *y);
    println!("kutumun içi: {}", *y);
}
```

`type Target = T;` satırı bir **ilişkili tip (associated type)**; Modül 14'teki `Iterator`'ın
`type Item`'ı gibi. Trait'i uygulayan her tip, "açınca hangi tipi verdiğini" burada söyler. İlişkili tipleri
Modül 22'de derinlemesine göreceğiz.

Peki `*y` yazınca gerçekte ne olur? Derleyici onu şuna çevirir:

```text
*y   ──►   *(y.deref())
           ───────────
           önce deref() ile bir &T al, sonra o sıradan referansı * ile aç
```

```quiz
question: |
  `deref` neden içteki değerin kendisini (`T`) değil de ona bir **referansı** (`&T`) döndürür?
options:
  - "Referans döndürmek daha hızlı olduğu için; aslında `T` döndürmek de aynı işi görürdü"
  - "`T` döndürseydi değer kutunun **içinden dışarı taşınırdı** ve `*y` her kullanıldığında kutu boşalırdı"
  - "Rust'ta fonksiyonlar `T` döndüremez"
  - "`&T` döndürmek, değerin heap'e kopyalanmasını sağlar"
answer: 1
explanation: |
  `*y` ifadesinin çoğu zaman yalnızca **bakmak** için kullanıldığını düşün (`println!`, karşılaştırma).
  `deref` `T` döndürseydi, `&self`'ten sahiplik çalmaya çalışırdı. Bu `Copy` olmayan tiplerde imkânsızdır,
  olsaydı bile kutu ilk kullanımda boşalırdı. Referans döndürmek "içeriye bak ama sahiplik kutuda kalsın"
  demektir; Modül 5'in ödünç alma fikri.
feedback:
  - "Mesele hız değil, sahiplik."
  - "Doğru!"
  - "Elbette döndürebilir; sorun `&self`'ten bir `T`'yi dışarı çıkarmak."
  - "Referans hiçbir şeyi kopyalamaz."
```

:::deep Box'ın Deref'i neden özel?
Standart kütüphanede `impl Deref for Box<T>` gerçekten yazılıdır ama `Box` derleyicinin özel olarak
tanıdığı bir tiptir: önceki dersteki `let s = *kutu;` (içinden **taşıma**) yalnızca `Box`'ta çalışır.
Bizim `Kutum`'da `let s = *k;` yazarsan, `*k` = `*(k.deref())` bir referansın arkasındaki değeri
taşımaya çalışacağı için E0507 alırsın. Bu ayrıcalık yalnızca `Box`'a aittir.
:::

## Deref zorlaması (deref coercion)

Şimdi asıl güzel kısım. Bir fonksiyon `&str` bekliyor olsun:

```rust
use std::ops::Deref;

struct Kutum<T>(T);

impl<T> Deref for Kutum<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

fn selamla(isim: &str) {
    println!("Merhaba, {isim}!");
}

fn main() {
    let m = Kutum(String::from("Zeynep"));
    selamla(&m); // &Kutum<String> → &String → &str
    selamla(&(*m)[..]); // zorlama olmasaydı yazman gereken hâl
}
```

`selamla(&m)` neden derleniyor? Derleyici tiplerin uymadığını görünce `Deref` uygulamalarını zincirleme
dener:

```text
&Kutum<String>  ──deref──►  &String  ──deref──►  &str   ✓ beklenen tip bulundu
   (Kutum: Deref<Target = String>)  (String: Deref<Target = str>)
```

İşte Modül 5'teki "parametre olarak `&str` tercih et" tavsiyesinin sırrı: `String`, `Deref<Target = str>`
uygular. Aynı şekilde `Vec<T>`, `Deref<Target = [T]>` uygular; bu yüzden `&Vec<i32>`, `&[i32]` bekleyen
yere geçer. **Deref zorlaması (deref coercion)** tamamen **derleme zamanında** çözülür; çalışma
zamanında hiçbir maliyeti yoktur. Derleyici gereken `deref` çağrılarını senin yerine ekler.

:::analogy Seyahat adaptörü
Yurt dışında prizi farklı bir ülkede şarj aletini takmak için araya adaptör koyarsın; gerekirse adaptörün
üstüne bir adaptör daha. Deref zorlaması, derleyicinin cebindeki adaptör setidir: elinde `&Kutum<String>`
fişi, duvarda `&str` prizi varsa, derleyici uygun adaptörleri (`Deref` uygulamalarını) **kendisi** sırayla
takar. Adaptör bulamazsa (uygun `Deref` yoksa) prizi zorlamaz, hata verir.
:::

```predict
code: |
  fn harf_sayisi(s: &str) -> usize {
      s.chars().count()
  }

  fn main() {
      let a = String::from("çiçek");
      let b = Box::new(String::from("ağaç"));
      let c = &&"kuş";
      println!("{} {} {}", harf_sayisi(&a), harf_sayisi(&b), harf_sayisi(c));
  }
options:
  - "5 4 3"
  - "7 6 4"
  - Derlenmez, çünkü `&b` bir `&Box<String>`
  - Derlenmez, çünkü `c` bir `&&&str`
answer: 0
explanation: |
  Üç çağrı da deref zorlamasıyla derlenir: `&String` → `&str` (bir adım), `&Box<String>` →
  `&String` → `&str` (iki adım), `&&&str` → `&&str` → `&str` (referansın referansı da açılır).
  `chars().count()` **karakter** sayar: "çiçek" 5, "ağaç" 4, "kuş" 3. `len()` kullansaydık Türkçe harfler
  2 bayt olduğu için `7 6 4` çıkardı (Modül 9).
```

Aynı mekanizma **metot çağrılarında** da çalışır. `b.len()` yazdığında (`b: Box<String>`) Rust önce
`Box`'ta `len` arar, bulamayınca kutuyu açar, `String`'de bulur. Önceki dersteki `cocuk.ekle(deger)`
çağrısı (`cocuk: &mut Box<Dugum>`) bu yüzden çalışıyordu. Metot çağrısındaki bu otomatik açmaya
**auto-deref** denir.

## DerefMut ve değiştirilebilirlik kuralları

`Deref` yalnızca **okuma** için bir `&T` verir. Kutudaki `String`'e ekleme yapmak istersek?

```compiles
code: |
  use std::ops::Deref;

  struct Kutum<T>(T);

  impl<T> Deref for Kutum<T> {
      type Target = T;
      fn deref(&self) -> &T {
          &self.0
      }
  }

  fn main() {
      let mut k = Kutum(String::from("Kara"));
      k.push_str("deniz");
      println!("{}", *k);
  }
answer: false
error: E0596
explanation: |
  `push_str` bir `&mut String` ister. `Deref` ise yalnızca `&String` verebilir; `k`'nin `mut` olması
  yetmez. Değiştirilebilir açma için ayrı bir trait gerekir: `DerefMut`.
```

:::error
```text
error[E0596]: cannot borrow data in dereference of `Kutum<String>` as mutable
  --> src/main.rs:14:5
   |
14 |     k.push_str("deniz");
   |     ^ cannot borrow as mutable
   |
   = help: trait `DerefMut` is required to modify through a dereference, but it is not implemented for `Kutum<String>`
```
`help:` satırı çözümü doğrudan söylüyor: "açarak değiştirmek için `DerefMut` gerekir".
:::

```rust
use std::ops::{Deref, DerefMut};

struct Kutum<T>(T);

impl<T> Deref for Kutum<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

impl<T> DerefMut for Kutum<T> {
    // Target'ı tekrar yazmayız: DerefMut, Deref'in Target'ını kullanır.
    fn deref_mut(&mut self) -> &mut T {
        &mut self.0
    }
}

fn unlem_ekle(s: &mut String) {
    s.push('!');
}

fn uzunluk(s: &str) -> usize {
    s.len()
}

fn main() {
    let mut k = Kutum(String::from("Karadeniz"));
    k.push_str(" dalgası"); // auto-deref, bu kez &mut ile
    unlem_ekle(&mut k); // &mut Kutum<String> → &mut String
    let n = uzunluk(&k); // &Kutum<String> → &String → &str
    println!("{} ({n} bayt)", *k);
}
```

Derleyici zorlamayı **üç kurala** göre yapar:

| Elindeki | Ulaşabileceğin | Koşul |
|---|---|---|
| `&T` | `&U` | `T: Deref<Target = U>` |
| `&mut T` | `&mut U` | `T: DerefMut<Target = U>` |
| `&mut T` | `&U` | `T: Deref<Target = U>` |
| `&T` | ~~`&mut U`~~ | **asla** |

Son satır neden yasak? Modül 5'in kuralını hatırla: **ya bir `&mut` ya da istediğin kadar `&`**. Bir `&T`
elinde olduğunda, aynı veriye başka `&T`'ler de olabilir. Onu `&mut U`'ya çevirmek, başkaları okurken
değiştirmek demektir. Tersi (`&mut` → `&`) ise güvenlidir: tek yazma yetkisini geçici olarak "sadece
okuma"ya düşürmek kimseye zarar vermez.

```compiles
code: |
  use std::ops::{Deref, DerefMut};

  struct Kutum<T>(T);

  impl<T> Deref for Kutum<T> {
      type Target = T;
      fn deref(&self) -> &T {
          &self.0
      }
  }

  impl<T> DerefMut for Kutum<T> {
      fn deref_mut(&mut self) -> &mut T {
          &mut self.0
      }
  }

  fn unlem_ekle(s: &mut String) {
      s.push('!');
  }

  fn main() {
      let mut k = Kutum(String::from("selam"));
      unlem_ekle(&k);
      println!("{}", *k);
  }
answer: false
error: E0308
explanation: |
  `DerefMut` uygulanmış olsa bile, elimizde yalnızca bir **paylaşılan** referans (`&k`) var. Zorlama
  `&T`'den `&mut U`'ya asla geçmez (tablodaki son satır). Derleyici "tipler değiştirilebilirlik açısından
  farklı" diyerek reddeder. Çözüm: `unlem_ekle(&mut k);`.
```

## Deref'i ne zaman uygulamalı?

`Deref` güçlüdür ve bu yüzden kötüye kullanılmaya açıktır. Kural basit: **tipin gerçekten "bir şeyi
saran işaretçi" olduğu durumlarda** uygula.

- ✅ Akıllı işaretçiler: `Box`, `Rc`, `String` (→ `str`), `Vec` (→ `[T]`), kendi `Kutum`'un.
- ✅ İnce bir **sarmalayıcı (wrapper)** ya da newtype (Modül 6): içteki tipin bütün okuma metotlarını
  ücretsiz kazanmak için.
- ❌ **Kalıtım taklidi**: `struct Ogrenci { kisi: Kisi, no: u32 }` için `Deref<Target = Kisi>` yazıp
  `ogrenci.ad` demek. Derlenir, ama okuyan kişi `Ogrenci`'nin bir `Kisi` olduğunu sanır. Üstelik
  zorlamalar trait sınırlarında (`T: Ozet`) çalışmadığı için "kalıtım" yarım kalır. Rust'ta ortak
  davranış için trait'ler (Modül 11) ve kompozisyon (alan + açık metotlar) kullanılır.

```fill
prompt: |
  Bir öğrencinin sınav notlarını saran `Notlar` tipi, bir dilimin bütün okuma metotlarını (`len`, `iter`,
  `contains`...) kazansın ve `&[u8]` bekleyen fonksiyonlara geçebilsin.
code: |
  use std::ops::___0;

  struct Notlar(Vec<u8>);

  impl Deref for Notlar {
      type Target = ___1;

      fn deref(&self) -> &Self::Target {
          ___2
      }
  }

  fn ortalama(notlar: &[u8]) -> f64 {
      let toplam: u32 = notlar.iter().map(|&n| n as u32).sum();
      toplam as f64 / notlar.len() as f64
  }

  fn main() {
      let n = Notlar(vec![70, 85, 100]);
      println!("{} not, en yüksek {:?}", n.len(), n.iter().max());
      println!("ortalama: {:.1}", ortalama(&n));
  }
blanks:
  - ["Deref"]
  - ["[u8]"]
  - ["&self.0", "&self.0[..]", "self.0.as_slice()"]
explanation: |
  `Target = [u8]` seçtik, `Vec<u8>` değil. Böylece `Notlar` yalnızca **okunabilir bir dilim** gibi görünür;
  `push` gibi `Vec` metotları dışarı sızmaz. `&self.0` bir `&Vec<u8>`'dir. Dönüş tipi `&[u8]` olduğu için
  burada da deref zorlaması çalışır (`&Vec<u8>` → `&[u8]`). `n.len()` ve `n.iter()` auto-deref ile
  dilimin metotlarını çağırır, `ortalama(&n)` ise `&Notlar` → `&[u8]` zorlamasıyla derlenir.
```

```quiz
question: |
  Bir `Eposta(String)` newtype'ı yalnızca geçerli adresleri (`@` içeren, küçük harfli) kabul eden bir
  `Eposta::new` ile oluşturuluyor. Tipe `Deref<Target = str>` ve **`DerefMut`** eklemek neden kötü bir fikirdir?
options:
  - "`DerefMut` yalnızca `Box` için uygulanabilir"
  - "`DerefMut`, dışarıdan `&mut str` vererek `make_ascii_uppercase()` gibi metotlarla **doğrulanmış değeri bozmaya** izin verir"
  - "`Deref` ve `DerefMut` aynı tipte birlikte uygulanamaz"
  - "`DerefMut` çalışma zamanında yavaştır"
answer: 1
explanation: |
  Newtype'ın amacı bir **değişmezi (invariant)** korumaktır: "her `Eposta` geçerli ve küçük harflidir"
  (Modül 10'daki `Yas::new` fikri). `Deref` yalnızca okuma verdiği için güvenlidir. `DerefMut` ise içteki
  `str`'e yazma yetkisi verir: `eposta.make_ascii_uppercase()` derlenir ve değişmez sessizce bozulur.
  Değişiklik gerekiyorsa doğrulama yapan açık bir metot yaz (`fn degistir(&mut self, yeni: &str) -> Result<..>`).
feedback:
  - "Her tip `DerefMut` uygulayabilir; mesele uygulamanın doğru olup olmadığı."
  - "Doğru!"
  - "Birlikte uygulanabilirler; az önce `Kutum` için yaptık."
  - "Deref zorlaması derleme zamanında çözülür; maliyeti yoktur."
```

## Alıştırma: Ürün kodu

```exercise
id: m17-e-urun-kodu
title: Ürün kodu newtype'ı
difficulty: 3
prompt: |
  Bir depo uygulamasında ürün kodları `"AB-12"` biçiminde tutuluyor. Kullanıcılar ise kodu `" ab-12 "` gibi
  boşluklu ve küçük harfle girebiliyor. `UrunKodu` tipini tamamla:

  - `UrunKodu::new(ham: &str) -> Option<UrunKodu>`: baştaki/sondaki boşlukları at, harfleri **ASCII büyük
    harfe** çevir (`to_ascii_uppercase`). Sonuç boşsa ya da içinde ASCII harf, rakam ve `-` dışında bir
    karakter varsa `None` döndür.
  - `Deref<Target = str>` uygula. Böylece `kod.len()`, `kod.starts_with("AB")` çalışsın ve `&kod`, `&str`
    bekleyen fonksiyonlara geçebilsin.
  - `DerefMut` **uygulama**: kodun büyük harfli kalması garanti olmalı.
starter: |
  use std::ops::Deref;

  struct UrunKodu(String);

  impl UrunKodu {
      fn new(ham: &str) -> Option<UrunKodu> {
          todo!()
      }
  }

  impl Deref for UrunKodu {
      type Target = str;

      fn deref(&self) -> &str {
          todo!()
      }
  }

  fn raf_bolumu(kod: &str) -> &str {
      &kod[..2]
  }

  fn main() {
      let kod = UrunKodu::new("  ab-12 ").expect("geçerli kod");
      println!("{} ({} karakter), raf: {}", &*kod, kod.len(), raf_bolumu(&kod));
  }
solution: |
  use std::ops::Deref;

  struct UrunKodu(String);

  impl UrunKodu {
      fn new(ham: &str) -> Option<UrunKodu> {
          let temiz = ham.trim().to_ascii_uppercase();
          if temiz.is_empty() {
              return None;
          }
          for c in temiz.chars() {
              if !(c.is_ascii_alphanumeric() || c == '-') {
                  return None;
              }
          }
          Some(UrunKodu(temiz))
      }
  }

  impl Deref for UrunKodu {
      type Target = str;

      fn deref(&self) -> &str {
          &self.0
      }
  }

  fn raf_bolumu(kod: &str) -> &str {
      &kod[..2]
  }

  fn main() {
      let kod = UrunKodu::new("  ab-12 ").expect("geçerli kod");
      println!("{} ({} karakter), raf: {}", &*kod, kod.len(), raf_bolumu(&kod));
  }
check: tests
tests: |
  #[test]
  fn temizler_ve_buyutur() {
      let k = UrunKodu::new("  ab-12 ").expect("geçerli bir kod");
      assert_eq!(&*k, "AB-12", "boşluklar atılmalı, harfler büyümeli");
      assert_eq!(k.len(), 5, "Deref sayesinde str'in len metodu çalışmalı");
      assert!(k.starts_with("AB"), "starts_with de str'den gelmeli");
  }

  #[test]
  fn str_bekleyen_fonksiyona_gecer() {
      let k = UrunKodu::new("xy-900").expect("geçerli bir kod");
      assert_eq!(raf_bolumu(&k), "XY", "&UrunKodu, &str'ye zorlanabilmeli");
  }

  #[test]
  fn gecersizleri_reddeder() {
      assert!(UrunKodu::new("   ").is_none(), "yalnızca boşluk geçersiz");
      assert!(UrunKodu::new("").is_none(), "boş metin geçersiz");
      assert!(UrunKodu::new("ab 12").is_none(), "ortadaki boşluk geçersiz");
      assert!(UrunKodu::new("çay-1").is_none(), "ASCII olmayan harf geçersiz");
      assert!(UrunKodu::new("ab_12").is_none(), "alt çizgi izinli değil");
  }

  #[test]
  fn rakamlar_ve_tire_korunur() {
      let k = UrunKodu::new("k-2024-x").expect("geçerli bir kod");
      assert_eq!(&*k, "K-2024-X");
  }
hints:
  - "`ham.trim().to_ascii_uppercase()` sana temizlenmiş, büyük harfli yeni bir `String` verir. Sonra onu kontrol et."
  - "Geçerlilik için `for c in temiz.chars()` ile dolaş; `c.is_ascii_alphanumeric() || c == '-'` değilse `return None;`. Boşluk kontrolünü de unutma: `temiz.is_empty()`."
  - "`deref` gövdesi tek satır: `&self.0` — `&String` dönüş tipindeki `&str`'ye kendiliğinden zorlanır."
require:
  - pattern: "impl\\s+Deref\\s+for\\s+UrunKodu"
    message: "`UrunKodu` için `Deref` uygulamalısın."
forbid:
  - pattern: "DerefMut"
    message: Bu alıştırmada `DerefMut` uygulama; kodun büyük harfli kalması garanti olmalı.
explanation: |
  `new` bir **akıllı kurucu (smart constructor)**: geçersiz bir `UrunKodu` oluşturmanın hiçbir yolu yok,
  çünkü alan (`.0`) modül dışından görünmez ve tek giriş kapısı doğrulama yapan `new`. `Deref<Target = str>`
  ise tipe `str`'in bütün **okuma** metotlarını hediye ediyor (`len`, `starts_with`, `contains`,
  `split`...); her birini tek tek sarmalamak zorunda kalmıyorsun.

  `DerefMut` uygulasaydın `kod.make_ascii_lowercase()` derlenir ve "her kod büyük harflidir" garantisi
  sessizce bozulurdu. Testlerdeki `&*k` ifadesi de ilginç: `*k` → `str`, `&*k` → `&str`. Açıkça bir
  `&str` istediğinde bu "aç ve yeniden ödünç al" kalıbı sık kullanılır.

  `to_ascii_uppercase` bilinçli bir seçim: `to_uppercase` Unicode kurallarını uygular ve `'ß'` gibi
  harfleri iki harfe çevirebilir. ASCII kodlarda ASCII dönüşümü hem hızlı hem öngörülebilirdir.
  Döngü yerine `temiz.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')` da yazabilirdin (Modül 14).
```

## Özet

:::remember
- `*x` = "adresi izle, değere ulaş". Kendi tipinde çalışması için `Deref` uygula, yoksa **E0614**.
- `impl Deref for T { type Target = U; fn deref(&self) -> &U }` → `*t` aslında `*(t.deref())`.
- **Deref zorlaması**: `&T` gereken yerde `&U`'ya otomatik, zincirleme ve derleme zamanında dönüşüm (`&Box<String>` → `&String` → `&str`). Metot çağrılarında auto-deref.
- Değiştirerek açmak için `DerefMut` (yoksa **E0596**). Kurallar: `&T→&U`, `&mut T→&mut U`, `&mut T→&U`; **asla** `&T→&mut U`.
- `Deref`'i akıllı işaretçiler ve ince sarmalayıcılar için kullan; kalıtım taklidi ya da değişmezi bozan `DerefMut` için kullanma.
:::

```reflect
prompt: Kendi cümlelerinle açıkla — `&str` parametresi alan bir fonksiyona `&String` ve hatta `&Box<String>` verebilmenin arkasında ne var? Neden bunun bir çalışma zamanı maliyeti yok?
answer: |
  Model cevap: `String`, `Deref<Target = str>`; `Box<T>` de `Deref<Target = T>` uygular. Derleyici
  beklenen tiple elimdeki tip uyuşmadığında `Deref` uygulamalarını zincirleme dener ve gereken `deref`
  çağrılarını kendisi ekler: `&Box<String>` → `&String` → `&str`. Bu karar tamamen derleme zamanında
  verilir; üretilen kod, benim elle `&(**b)[..]` yazmamla aynıdır. Ayrıca her `deref` yalnızca bir
  referans döndürdüğü için hiçbir şey kopyalanmaz.
```

```flashcards
- front: "`*y` ifadesi, `y` kendi `Deref` uygulayan tipinse derleyici tarafından neye çevrilir?"
  back: "`*(y.deref())` — önce `deref` ile bir `&Target` alınır, sonra o referans açılır."
- front: "`E0614: type ... cannot be dereferenced` hatası neyi gösterir?"
  back: "Tipin `Deref` uygulaması yok; `*` operatörünün o tip için anlamı tanımlı değil."
- front: "`Deref` trait'indeki `type Target` ne işe yarar?"
  back: "Açınca (dereference) hangi tipe ulaşılacağını söyleyen ilişkili tiptir (ör. `String` için `str`)."
- front: "`&Box<String>` hangi adımlarla `&str` bekleyen yere geçer?"
  back: "`&Box<String>` → `&String` (Box: Deref) → `&str` (String: Deref<Target = str>). Derleme zamanında, maliyetsiz."
- front: "Deref zorlaması `&T`'den `&mut U`'ya neden asla geçmez?"
  back: "Paylaşılan referans başka `&`'lerle bir arada olabilir; onu `&mut`'a çevirmek \"aliasing XOR mutation\" kuralını bozardı."
- front: "`E0596: cannot borrow data in dereference of ... as mutable` hatasının tipik çözümü nedir?"
  back: "Tipe `DerefMut` uygulamak (ve değişkeni `mut` yapmak) — tabii değişiklik değişmezi bozmuyorsa."
- front: "Doğrulanmış bir newtype'a neden `DerefMut` uygulamamalısın?"
  back: "İçteki veriye yazma yetkisi verir; doğrulamayı atlayarak değişmezi (invariant) bozmaya izin verir."
```
