---
id: m22-l04
title: İleri fonksiyonlar ve closure'lar
minutes: 25
type: lesson
objectives:
  - "Fonksiyon öğesi (fn item), fonksiyon işaretçisi (`fn(i32) -> i32`) ve closure arasındaki farkı boyut ve tip açısından açıklayabilmek"
  - "Fonksiyon adlarını, metot yollarını (`str::trim`), tuple struct ve enum varyant kurucularını `map` gibi adaptörlere doğrudan verebilmek"
  - "Closure döndürürken `impl Fn`, `Box<dyn Fn>` ve `fn` işaretçisi arasında maliyet ve esnekliğe göre seçim yapabilmek"
  - "`for<'a>` sınırının “her yaşam süresi için” anlamını açıklayıp gerektiğinde açıkça yazabilmek"
keywords: [fn pointer, fonksiyon işaretçisi, fn item, closure, "impl Fn", "Box<dyn Fn>", HRTB, "for<'a>", E0308, E0631, E0597, not general enough]
---

Modül 14'te closure'ları öğrenirken `fn` işaretçilerinden kısaca söz edip ayrıntıyı bu derse
bırakmıştık. Ayrıca `.map(String::from)` gibi satırlar yazdın; parantez yok, closure yok, sadece bir
fonksiyonun **adı**. Bu nasıl çalışıyor? Peki derleyici hata mesajlarında ara sıra beliren
`for<'a> fn(&'a str) -> usize` gibi garip tipler ne anlatıyor?

Bu derste fonksiyonları birer **değer** olarak ele alacağız: onları tablolara koyacak, adaptörlere
verecek, fonksiyonlardan döndürecek ve imzalarındaki yaşam sürelerinin tam olarak ne söylediğini
çözeceğiz.

## Fonksiyonlar da birer değer: fn işaretçileri

Bir metin düzenleyici için komut tablosu kuruyoruz. Her komutun bir adı ve bir işlevi var. Tablonun
ikinci sütununun tipine dikkat et: `fn(&str) -> String`. Küçük harfli `fn` ile yazılan bu tip bir
**fonksiyon işaretçisidir (function pointer)**. Tahmin et:

```predict
code: |
  fn ters_cevir(s: &str) -> String {
      s.chars().rev().collect()
  }

  fn tekrarla(s: &str) -> String {
      s.repeat(2)
  }

  fn main() {
      let komutlar: [(&str, fn(&str) -> String); 3] = [
          ("buyuk", str::to_uppercase),
          ("ters", ters_cevir),
          ("iki", tekrarla),
      ];
      let mut metin = String::from("ab");
      for (ad, islev) in komutlar {
          metin = islev(&metin);
          println!("{ad}: {metin}");
      }
  }
options:
  - |
    buyuk: AB
    ters: BA
    iki: BABA
  - |
    buyuk: AB
    ters: BA
    iki: BA
  - Derlenmez; `str::to_uppercase` bir metottur, fonksiyon değildir
answer: 0
explanation: |
  Tablodaki üç öğe de aynı tipe sahip: “bir `&str` alıp `String` döndüren fonksiyonun adresi”. Döngü
  her satırda işlevi çağırıp sonucu `metin`'e yazıyor: `"ab"` → `"AB"` → `"BA"` → `"BABA"`.
  `str::to_uppercase` bir metot, ama metotlar da `self`'i ilk parametre olarak alan sıradan
  fonksiyonlardır: `str::to_uppercase(&metin)` ile `metin.to_uppercase()` aynı şeydir.
```

Fonksiyon işaretçisi, makine kodunun bellekteki **adresidir**. 64 bit bir sistemde 8 bayttır, `Copy`'dir
ve her somut tip gibi diziye, struct alanına, `Vec`'e konabilir. Generic parametreye ya da `Box`'a
gerek yoktur. Tipi parametre ve dönüş tiplerinden oluşur: `fn(i32, i32) -> i32`, `fn(&str) -> bool`,
`fn()` (hiçbir şey almayan ve döndürmeyen).

Bu fikir yeni değil. C'de `int (*f)(int)` yazarsın, Python ve JavaScript'te fonksiyonlar zaten birer
nesnedir, Java'da `String::length` gibi **metot referansları** vardır. Rust'taki fark, tipin derleme
zamanında tam olarak bilinmesi ve **null olamamasıdır**. C'deki gibi geçersiz bir adresi çağırma
riski yoktur. “Belki fonksiyon yok” demek istersen `Option<fn(i32) -> i32>` yazarsın; bu da yine 8
bayttır (Modül 24'teki niche optimizasyonu).

:::analogy Telefon numarası ve kurye
Fonksiyon işaretçisi bir **telefon numarasıdır**: Rehbere yazarsın, kopyalarsın, istediğin zaman
ararsın. Numara her zaman aynı boyuttadır ve yanında hiçbir eşya taşımaz. Bir şeyler yakalayan closure
ise **çantasıyla gelen bir kuryedir**: Çantadaki eşyalar (yakalanan değişkenler) onun bir parçasıdır ve
çantanın boyutu kuryeden kuryeye değişir. Bu yüzden kuryeleri rehberdeki numara sütununa yazamazsın.
:::

## Fonksiyon öğesi, fonksiyon işaretçisi ve closure

Şimdiye kadar `let f = iki_kat;` yazdığında `f`'in tipi bir fonksiyon işaretçisi değildi. Tahmin et,
bu kod derlenir mi?

```compiles
code: |
  fn iki_kat(x: i32) -> i32 {
      x * 2
  }

  fn uc_kat(x: i32) -> i32 {
      x * 3
  }

  fn main() {
      let mut f = iki_kat;
      println!("{}", f(5));
      f = uc_kat;
      println!("{}", f(5));
  }
answer: false
error: E0308
explanation: |
  İmzaları aynı olsa da `iki_kat` ve `uc_kat` **farklı tiplere** sahiptir. Her fonksiyonun kendine
  özgü, adı yazılamayan bir **fonksiyon öğesi tipi (fn item type)** vardır. `f`'in tipi ilk atamada
  `iki_kat`'ınki olarak sabitlendi; `uc_kat` başka bir tip.
```

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:12:9
   |
10 |     let mut f = iki_kat;
   |                 ------- expected due to this value
11 |     println!("{}", f(5));
12 |     f = uc_kat;
   |         ^^^^^^ expected fn item, found a different fn item
   |
   = note: expected fn item `fn(_) -> _ {iki_kat}`
              found fn item `fn(_) -> _ {uc_kat}`
   = note: different fn items have unique types, even if their signatures are the same
   = help: consider casting both fn items to fn pointers using `as fn(i32) -> i32`
```
Notlardaki `fn(_) -> _ {iki_kat}` gösterimi bir fonksiyon öğesi tipidir: süslü parantezdeki isim tipin
parçasıdır. Çözüm `help:` satırında: Değişkenin tipini `let mut f: fn(i32) -> i32 = iki_kat;` diye
açıkça yaz; iki öğe de aynı fonksiyon işaretçisi tipine **dönüşür (coerce)**.
:::

Bu, Modül 14'teki “iki closure, gövdeleri aynı olsa bile farklı tiptedir” kuralının fonksiyonlardaki
karşılığıdır. Peki neden böyle tasarlandı? Çünkü fonksiyon öğesi tipi **sıfır baytlıktır**: Hangi
fonksiyonun çağrılacağı değerde değil **tipte** yazılıdır. Generic bir fonksiyona `iki_kat`
verdiğinde derleyici monomorfizasyon sırasında tam olarak hangi fonksiyonu çağıracağını bilir ve onu
**satır içine alabilir (inline)**. Fonksiyon işaretçisinde ise adres çalışma anında okunur ve dolaylı
bir çağrı yapılır. Ölçelim:

```rust
use std::mem::size_of_val;

fn iki_kat(x: i32) -> i32 {
    x * 2
}

fn main() {
    let oge = iki_kat; // fn item: tip = fn(i32) -> i32 {iki_kat}
    let isaretci: fn(i32) -> i32 = iki_kat; // fn pointer
    let k = 10;
    let yakalayan = move |x: i32| x + k; // k'yi (i32) taşıyor
    let yakalamayan = |x: i32| x + 1;
    let kutu: Box<dyn Fn(i32) -> i32> = Box::new(yakalayan);

    println!("fn öğesi      : {} bayt", size_of_val(&oge));
    println!("fn işaretçisi : {} bayt", size_of_val(&isaretci));
    println!("closure (k)   : {} bayt", size_of_val(&yakalayan));
    println!("closure ()    : {} bayt", size_of_val(&yakalamayan));
    println!("Box<dyn Fn>   : {} bayt", size_of_val(&kutu));
    println!("{} {} {} {}", oge(1), isaretci(1), yakalamayan(1), kutu(1));
}
```

`size_of_val(&x)`, `x`'in bellekte kapladığı bayt sayısını verir (bellek düzenini Modül 24'te
derinlemesine göreceğiz). Sonuçlar bir closure'ın aslında ne olduğunu da ele veriyor: Derleyicinin
senin için ürettiği, **yakalanan değişkenleri alan olarak tutan** isimsiz bir struct. `k`'yi yakalayan
closure 4 bayt (bir `i32`), hiçbir şey yakalamayan 0 bayt.

```memory
title: Dört farklı “çağrılabilir” bellekte
steps:
  - caption: "`oge` bir fonksiyon öğesi: 0 bayt. Hangi fonksiyon olduğu **tipinde** yazılı; çağrı derleme zamanında bellidir."
    stack:
      - frame: main
        vars:
          - { name: oge, type: "fn(i32) -> i32 {iki_kat}", value: "(boş)", note: "0 bayt" }
    heap:
      - { id: k1, value: "x * 2 ...", label: "iki_kat'ın makine kodu (statik)" }
  - caption: "`isaretci` bir fonksiyon işaretçisi: 8 baytlık bir kod adresi. Çağrı, bu adres okunarak yapılır."
    stack:
      - frame: main
        vars:
          - { name: oge, type: "fn(i32) -> i32 {iki_kat}", value: "(boş)", note: "0 bayt" }
          - { name: isaretci, type: "fn(i32) -> i32", value: "kod adresi", to: k1, note: "8 bayt" }
    heap:
      - { id: k1, value: "x * 2 ...", label: "iki_kat'ın makine kodu (statik)" }
  - caption: "`yakalayan` aslında isimsiz bir struct: alanı yakalanan `k`. Kodu tipinden bilinir, verisi değerdedir."
    stack:
      - frame: main
        vars:
          - { name: isaretci, type: "fn(i32) -> i32", value: "kod adresi", to: k1, note: "8 bayt" }
          - { name: k, type: i32, value: "10" }
          - { name: yakalayan, type: "{closure}", value: "k: 10", note: "4 bayt" }
    heap:
      - { id: k1, value: "x * 2 ...", label: "iki_kat'ın makine kodu (statik)" }
  - caption: "`kutu` bir fat pointer: closure'ın verisi heap'e taşındı, yanında vtable adresi var (Modül 20)."
    stack:
      - frame: main
        vars:
          - { name: isaretci, type: "fn(i32) -> i32", value: "kod adresi", to: k1, note: "8 bayt" }
          - { name: k, type: i32, value: "10" }
          - { name: kutu, type: "Box<dyn Fn(i32) -> i32>", value: "ptr · vtable", to: h1, note: "16 bayt" }
    heap:
      - { id: k1, value: "x * 2 ...", label: "iki_kat'ın makine kodu (statik)" }
      - { id: h1, value: "k: 10", label: "closure verisi (4 bayt)" }
      - { id: v1, value: "drop · size · align · call", label: "vtable: {closure} as Fn (statik)" }
```

Dönüşüm kuralları kısaca şöyle:

| Kaynak | `fn(..)` işaretçisine dönüşür mü? | `Fn`/`FnMut`/`FnOnce` uygular mı? |
|---|---|---|
| Fonksiyon öğesi (`iki_kat`) | Evet | Üçünü de |
| Hiçbir şey yakalamayan closure | Evet | Yakaladığına göre (burada üçü de) |
| Bir şey yakalayan closure | **Hayır** (Modül 14'teki E0308) | Yakaladığına göre |
| Fonksiyon işaretçisi (`fn(i32) -> i32`) | Zaten öyle | Üçünü de |

Son satır önemli: `fn` işaretçileri closure trait'lerinin üçünü de uygular. Yani `impl Fn(i32) -> i32`
isteyen her yere bir `fn` işaretçisi verebilirsin, ama tersi her zaman mümkün değildir.

```quiz
question: "Kendi kütüphanende bir fonksiyon parametresi olarak bir “dönüştürücü” istiyorsun. Hangi imza kullanıcılara **en fazla** seçenek tanır?"
options:
  - "`fn uygula(f: fn(i32) -> i32)`"
  - "`fn uygula<F: Fn(i32) -> i32>(f: F)`"
  - "`fn uygula(f: Box<dyn Fn(i32) -> i32>)`"
answer: 1
explanation: |
  Generic `F: Fn(i32) -> i32` fonksiyon öğelerini, `fn` işaretçilerini ve **yakalayan** closure'ları
  kabul eder; üstelik monomorfizasyon sayesinde çağrı satır içine alınabilir. `fn` işaretçisi yakalayan
  closure'ları reddeder. `Box<dyn Fn>` her şeyi kabul eder ama çağırana bir heap ayırması ve kutulama
  zahmeti yükler. Kural: Parametrede generic (`impl Fn`) iste; `fn` işaretçisini tek tip bir tabloya ya
  da struct alanına ihtiyaç duyduğunda (ve Modül 24'te C ile konuşurken) kullan.
feedback:
  - "`fn` işaretçisi bir şey yakalayan closure'ları kabul etmez; kullanıcıyı kısıtlar."
  - "Doğru!"
  - "Her şeyi kabul eder ama çağıranı `Box::new` yazmaya ve heap ayırmaya zorlar."
```

## Kurucular ve metot yolları da fonksiyondur

Rust'ta adını yazıp parantezle çağırabildiğin hemen her şey bir fonksiyon değeri olarak da
kullanılabilir. Üç büyük aile var:

1. **Serbest fonksiyonlar ve ilişkili fonksiyonlar**: `ters_cevir`, `String::from`, `String::new`.
2. **Metot yolları**: `str::trim`, `str::len`, `i64::checked_add`, `ToString::to_string`. Metot,
   `self`'i ilk parametre olarak alan bir fonksiyondur. Önceki dersteki tam nitelikli sözdiziminin
   (`Trait::metot(&x)`) değer olarak kullanılan hâli budur.
3. **Kurucular**: Tuple struct'lar (`struct Puan(u32);`) ve tuple benzeri enum varyantları
   (`Some`, `Ok`, `Durum::Aktif(..)`) derleyicinin otomatik ürettiği birer fonksiyondur. `Puan`'ın
   tipi aslında `fn(u32) -> Puan {Puan}`'dır.

```rust
#[derive(Debug)]
struct Puan(u32);

#[derive(Debug)]
enum Kayit {
    Gecerli(Puan),
}

fn puan_al(k: &Kayit) -> u32 {
    match k {
        Kayit::Gecerli(Puan(p)) => *p,
    }
}

fn main() {
    let ham = ["  85", "92 ", " 70 "];

    let temiz: Vec<&str> = ham.into_iter().map(str::trim).collect();
    let sayilar: Vec<u32> = temiz.iter().map(|s| s.parse().unwrap()).collect();
    let puanlar: Vec<Puan> = sayilar.into_iter().map(Puan).collect();
    let kayitlar: Vec<Kayit> = puanlar.into_iter().map(Kayit::Gecerli).collect();
    let toplam: u32 = kayitlar.iter().map(puan_al).sum(); // iter() &Kayit verir, puan_al &Kayit alır
    println!("{kayitlar:?} toplam={toplam}");

    let secenekler: Vec<Option<&str>> = temiz.into_iter().map(Some).collect();
    println!("{secenekler:?}");
}
```

`parse` için bir closure kullanmak zorunda kaldık, çünkü orada `unwrap` da çağırıyoruz. Bir adım tek bir
fonksiyon çağrısından ibaretse, adını vermek (`.map(Puan)`) closure yazmaktan (`.map(|n| Puan(n))`)
daha kısa ve niyeti daha açıktır. Clippy bu durumda `redundant_closure` uyarısıyla seni zaten
uyarır (Modül 16).

Ama bu kısayolun bir tuzağı var. Derlenir mi?

```compiles
code: |
  fn main() {
      let isimler = vec![String::from("ayşe"), String::from("ali")];
      let uzunluklar: Vec<usize> = isimler.iter().map(str::len).collect();
      println!("{uzunluklar:?}");
  }
answer: false
error: E0631
explanation: |
  `isimler.iter()` `&String` üretir, `str::len` ise `&str` bekler. Bir closure olsaydı
  (`|s| s.len()`) deref zorlaması `&String`'i `&str`'ye çevirirdi. Bir fonksiyon **değeri** verdiğinde ise
  tiplerin birebir uyması gerekir; zorlama burada devreye girmez.
```

:::error
```text
error[E0631]: type mismatch in function arguments
   --> src/main.rs:3:53
    |
  3 |     let uzunluklar: Vec<usize> = isimler.iter().map(str::len).collect();
    |                                                 --- ^^^^^^^^
    |                                                 |   |
    |                                                 |   expected due to this
    |                                                 |   found signature defined here
    |                                                 required by a bound introduced by this call
    |
    = note: expected function signature `fn(&String) -> _`
               found function signature `fn(&str) -> _`
```
`expected` ve `found` imzalarını yan yana oku: Iterator `&String` veriyor, fonksiyon `&str` istiyor.
Üç çözüm: `.map(String::len)`, `.map(|s| s.len())` ya da önce `.map(String::as_str)`. Aynı tuzak
`iter()` ile `&&str` ürettiğinde `str::trim`'de de çıkar; yukarıdaki örnekte bu yüzden
`into_iter()` kullandık.
:::

Şimdi sıra sende. Boşlukları birer fonksiyon **adıyla** doldur, closure yazma:

```fill
prompt: "Ham isimleri kırp, `String`'e çevir ve puanları `Puan` struct'ına sar. Her boşluğa bir fonksiyon adı yaz."
code: |
  #[derive(Debug)]
  struct Puan(u32);

  fn main() {
      let ham = ["  Ayşe ", "Mehmet  "];
      let isimler: Vec<String> = ham.into_iter().map(___0).map(___1).collect();
      let puanlar: Vec<Puan> = vec![70, 85].into_iter().map(___2).collect();
      println!("{isimler:?} {puanlar:?}");
  }
blanks:
  - ["str::trim"]
  - ["String::from", "ToString::to_string", "str::to_string", "str::to_owned", "Into::into"]
  - ["Puan"]
output: '["Ayşe", "Mehmet"] [Puan(70), Puan(85)]'
explanation: |
  `into_iter()` diziden `&str`'leri sırayla verir; `str::trim` tam olarak `fn(&str) -> &str` olduğu için
  doğrudan uyar. `String::from` bir ilişkili fonksiyondur (`From<&str>` impl'inden). `Puan` ise tuple
  struct'ın kurucusu: derleyicinin ürettiği `fn(u32) -> Puan` fonksiyonu.
```

Fonksiyon işaretçilerini ve metot yollarını birleştirme zamanı:

```exercise
id: m22-l04-e-hesap-makinesi
title: İşlem tablosuyla hesap makinesi
difficulty: 3
prompt: |
  Bir sınıf için basit bir hesap makinesi yazıyoruz. Taşma ve sıfıra bölme programı çökertmemeli.

  1. **`fn islem_bul(sembol: &str) -> Option<fn(i64, i64) -> Option<i64>>`**: `"+"`, `"-"`, `"*"`,
     `"/"` ve `"%"` için karşılık gelen fonksiyonu döndürür, diğer her şey için `None`. Kendi
     fonksiyonlarını yazmana gerek yok: `i64::checked_add`, `i64::checked_sub`, `i64::checked_mul`,
     `i64::checked_div` ve `i64::checked_rem` tam olarak bu imzaya sahip. Taşmada ya da sıfıra
     bölmede `None` döndürürler.
  2. **`fn hesapla(ifade: &str) -> Option<i64>`**: `"12 + 30"` gibi **boşlukla ayrılmış üç parçalı**
     bir ifadeyi hesaplar. Parça sayısı üç değilse, sayılar okunamıyorsa, işlem bilinmiyorsa ya da
     işlem `None` döndürürse sonuç `None` olur.
starter: |
  fn islem_bul(sembol: &str) -> Option<fn(i64, i64) -> Option<i64>> {
      todo!()
  }

  fn hesapla(ifade: &str) -> Option<i64> {
      todo!()
  }

  fn main() {
      println!("{:?}", hesapla("12 + 30"));
      println!("{:?}", hesapla("7 / 0"));
  }
solution: |
  fn islem_bul(sembol: &str) -> Option<fn(i64, i64) -> Option<i64>> {
      let tablo: [(&str, fn(i64, i64) -> Option<i64>); 5] = [
          ("+", i64::checked_add),
          ("-", i64::checked_sub),
          ("*", i64::checked_mul),
          ("/", i64::checked_div),
          ("%", i64::checked_rem),
      ];
      for (s, f) in tablo {
          if s == sembol {
              return Some(f);
          }
      }
      None
  }

  fn hesapla(ifade: &str) -> Option<i64> {
      let parcalar: Vec<&str> = ifade.split_whitespace().collect();
      let [sol, op, sag] = parcalar[..] else {
          return None;
      };
      let a: i64 = sol.parse().ok()?;
      let b: i64 = sag.parse().ok()?;
      let f = islem_bul(op)?;
      f(a, b)
  }

  fn main() {
      println!("{:?}", hesapla("12 + 30"));
      println!("{:?}", hesapla("7 / 0"));
  }
check: tests
tests: |
  #[test]
  fn tablo_dogru_fonksiyonu_verir() {
      let topla = islem_bul("+").expect("\"+\" bulunmalı");
      assert_eq!(topla(2, 3), Some(5));
      let mod_al = islem_bul("%").expect("\"%\" bulunmalı");
      assert_eq!(mod_al(17, 5), Some(2), "17 % 5 = 2");
      assert!(islem_bul("^").is_none(), "Bilinmeyen işlem için None");
      assert!(islem_bul("").is_none());
  }

  #[test]
  fn ifadeleri_hesaplar() {
      assert_eq!(hesapla("12 + 30"), Some(42));
      assert_eq!(hesapla("  6   *  7 "), Some(42), "Fazla boşluklar sorun olmamalı");
      assert_eq!(hesapla("-8 % 3"), Some(-2), "Negatif sayılar da okunmalı");
      assert_eq!(hesapla("100 - 250"), Some(-150));
  }

  #[test]
  fn tasma_ve_sifira_bolme() {
      assert_eq!(hesapla("7 / 0"), None, "Sıfıra bölme panik değil None olmalı");
      assert_eq!(hesapla("9223372036854775807 + 1"), None, "Taşma None olmalı");
  }

  #[test]
  fn bozuk_ifadeler() {
      assert_eq!(hesapla("5 +"), None, "Eksik parça");
      assert_eq!(hesapla("1 + 2 + 3"), None, "Üçten fazla parça");
      assert_eq!(hesapla("bir + 2"), None, "Sayı olmayan parça");
      assert_eq!(hesapla("3 ^ 2"), None, "Bilinmeyen işlem");
  }
hints:
  - "`islem_bul`'da `[(&str, fn(i64, i64) -> Option<i64>); 5]` tipinde bir tablo kur ve döngüyle ara. Dizi elemanlarına `i64::checked_add` gibi **adları** yaz, parantez koyma."
  - "`hesapla`'da `ifade.split_whitespace().collect::<Vec<&str>>()` ile parçala. Uzunluğu 3 değilse `None`. Modül 21'deki dilim deseni çok işe yarar: `let [sol, op, sag] = parcalar[..] else { return None; };`"
  - "`Option` döndüren bir fonksiyonda `?` kullanabilirsin: `let a: i64 = sol.parse().ok()?;`, `let f = islem_bul(op)?;` ve son satırda `f(a, b)`."
require:
  - pattern: "checked_(add|sub|mul|div|rem)"
    message: "`i64::checked_*` fonksiyonlarını kullan; taşmayı elle kontrol etme."
  - pattern: "fn\\s*\\(\\s*i64\\s*,\\s*i64\\s*\\)"
    message: "Tabloda ya da imzada `fn(i64, i64) -> Option<i64>` fonksiyon işaretçisi tipi geçmeli."
explanation: |
  Tablodaki beş öğenin her biri farklı bir **fonksiyon öğesi tipine** sahip, ama dizinin eleman tipini
  `fn(i64, i64) -> Option<i64>` olarak yazdığımız için hepsi aynı işaretçi tipine dönüştü. Dizide
  closure ya da `Box` gerekmedi: Hiçbiri bir şey yakalamıyor.

  `i64::checked_add` bir metottur (`self` alır), ama `Self = i64` olduğu için `fn(i64, i64) -> Option<i64>`
  imzasına birebir uyar. Taşma ve sıfıra bölme kontrolünü standart kütüphaneye bırakmış olduk.

  `hesapla`'da Modül 21'in dilim deseni (`let [sol, op, sag] = parcalar[..] else {..}`) uzunluk kontrolünü
  ve parçalamayı tek satırda yaptı; Modül 10'un `?` operatörü de üç ayrı hata yolunu düzleştirdi.
  Alternatif: Tablo yerine bir `match sembol { "+" => Some(i64::checked_add), ... }` yazmak.
  Bu durumda her kolun sonucu yine `fn` işaretçisine dönüşür, çünkü dönüş tipi bunu zorunlu kılar.
  Tablo ise çalışma anında genişletilebilir (ör. bir `HashMap<&str, fn(..)>`).
```

## Closure döndürmek: impl Fn mi, Box<dyn Fn> mi?

Modül 14'te iki yolu gördün. Artık ikisinin bellekte ne olduğunu da biliyorsun, o yüzden seçimi
gerekçesiyle yapabiliriz. Üçüncü bir seçenek de var: Closure hiçbir şey yakalamıyorsa düz bir `fn`
işaretçisi döndürmek.

| | `-> impl Fn(i32) -> i32` | `-> Box<dyn Fn(i32) -> i32>` | `-> fn(i32) -> i32` |
|---|---|---|---|
| Ne döner? | Tek bir somut, isimsiz tip | Heap'te closure + vtable (fat pointer) | Kod adresi |
| Yakalama yapabilir mi? | Evet | Evet | Hayır |
| Farklı closure'lar döndürülebilir mi? | Hayır (tek tip kuralı) | Evet | Evet (yakalamıyorlarsa) |
| Maliyet | Sıfır; satır içine alınabilir | Heap ayırma + dolaylı çağrı | Dolaylı çağrı |
| Struct alanında tutmak | Generic parametre gerekir | `Box<dyn Fn..>` alanı yeter | `fn(..)` alanı yeter |

Varsayılanın `impl Fn` olmalı. `Box<dyn Fn>`'e, çalışma anında **seçilen** ya da bir koleksiyonda
**birlikte** tutulan farklı closure'lar gerektiğinde geç. Closure'lar başka closure'lar da üretebilir.
İki dönüştürücüyü birleştiren bir **fonksiyon bileşimi (composition)** örneği:

```rust
fn birlestir<A, B>(f: A, g: B) -> impl Fn(i32) -> i32
where
    A: Fn(i32) -> i32,
    B: Fn(i32) -> i32,
{
    move |x| g(f(x))
}

fn kural_sec(ad: &str) -> Box<dyn Fn(i32) -> i32> {
    match ad {
        "kdv" => Box::new(|x| x + x / 5), // %20 KDV
        "kargo" => Box::new(|x| x + 30),
        _ => Box::new(|x| x), // etkisiz kural
    }
}

fn main() {
    let ikiye_katla_bir_ekle = birlestir(|x| x * 2, |x| x + 1);
    println!("{}", ikiye_katla_bir_ekle(10)); // (10 * 2) + 1

    let mut fiyat = 100;
    for ad in ["kdv", "kargo", "bilinmeyen"] {
        let kural = kural_sec(ad);
        fiyat = kural(fiyat);
        println!("{ad}: {fiyat}");
    }
}
```

`birlestir`'in döndürdüğü closure `f` ve `g`'yi **sahiplenerek** yakalar (`move`), bu yüzden fonksiyon
döndükten sonra da yaşar. `kural_sec`'in `match` kolları üç farklı closure tipi üretir; onları ortak bir
tipe toplamanın yolu `Box<dyn Fn>`'dir.

```parsons
prompt: "`once` dönüştürücüsünü çalıştırıp sonucu `sonra`'ya veren closure'ı döndüren fonksiyonu kur."
lines: |
  fn ardisik<A, B>(once: A, sonra: B) -> impl Fn(u32) -> u32
  where
      A: Fn(u32) -> u32,
      B: Fn(u32) -> u32,
  {
      move |x| sonra(once(x))
  }
distractors: |
  fn ardisik<A, B>(once: A, sonra: B) -> Fn(u32) -> u32
      |x| sonra(once(x))
      move |x| once(sonra(x))
explanation: |
  Dönüş tipi `impl Fn(u32) -> u32` olmalı; çıplak `Fn(u32) -> u32` bir trait'tir, tip değildir (ya
  `impl` ya da `Box<dyn ..>` gerekir). `move` olmadan closure `once` ve `sonra`'yı ödünç alırdı.
  Ancak bunlar fonksiyonun parametreleri ve fonksiyon dönünce yok olurlar (Modül 14'teki E0373).
  Sıra da önemli: Önce `once`, sonra `sonra` çalışmalı: `sonra(once(x))`.
```

Şimdi çalışma anında metinden kurallar üreten bir kampanya motoru yaz:

```exercise
id: m22-l04-e-kampanya
title: Metinden kampanya kuralları
difficulty: 4
prompt: |
  Bir e-ticaret sitesinin yöneticileri kampanyaları bir ayar dosyasına `"yuzde:10"`, `"sabit:50"` gibi
  satırlarla yazıyor. Fiyatlar kuruş değil TL cinsinden `u32`.

  1. **`fn kural_olustur(tanim: &str) -> Option<Box<dyn Fn(u32) -> u32>>`**
     - `"yuzde:N"`: fiyattan yüzde N indirim yapar: `fiyat - fiyat * N / 100`. N 100'den büyükse kural geçersizdir (`None`).
     - `"sabit:N"`: fiyattan N TL düşer; fiyat 0'ın altına inmez (`saturating_sub`).
     - `"tavan:N"`: fiyat N'den büyükse N olur (`min`).
     - Bilinmeyen tür, `:` içermeyen tanım ya da sayıya çevrilemeyen N → `None`.
  2. **`fn zincirle(kurallar: Vec<Box<dyn Fn(u32) -> u32>>) -> impl Fn(u32) -> u32`**: Kuralları
     **sırayla** uygulayan tek bir closure döndürür. Kural yoksa fiyatı değiştirmez.
starter: |
  fn kural_olustur(tanim: &str) -> Option<Box<dyn Fn(u32) -> u32>> {
      todo!()
  }

  fn zincirle(kurallar: Vec<Box<dyn Fn(u32) -> u32>>) -> impl Fn(u32) -> u32 {
      // `-> impl Fn` bir closure ister; bu yer tutucuyu kendi closure'ınla değiştir.
      move |_fiyat| todo!()
  }

  fn main() {
      let kurallar: Vec<Box<dyn Fn(u32) -> u32>> = ["yuzde:10", "sabit:50"]
          .into_iter()
          .filter_map(kural_olustur)
          .collect();
      let kampanya = zincirle(kurallar);
      println!("{}", kampanya(1000));
  }
solution: |
  fn kural_olustur(tanim: &str) -> Option<Box<dyn Fn(u32) -> u32>> {
      let (tur, sayi) = tanim.split_once(':')?;
      let n: u32 = sayi.parse().ok()?;
      match tur {
          "yuzde" if n <= 100 => Some(Box::new(move |f: u32| f - f * n / 100)),
          "sabit" => Some(Box::new(move |f: u32| f.saturating_sub(n))),
          "tavan" => Some(Box::new(move |f: u32| f.min(n))),
          _ => None,
      }
  }

  fn zincirle(kurallar: Vec<Box<dyn Fn(u32) -> u32>>) -> impl Fn(u32) -> u32 {
      move |fiyat| {
          let mut sonuc = fiyat;
          for kural in &kurallar {
              sonuc = kural(sonuc);
          }
          sonuc
      }
  }

  fn main() {
      let kurallar: Vec<Box<dyn Fn(u32) -> u32>> = ["yuzde:10", "sabit:50"]
          .into_iter()
          .filter_map(kural_olustur)
          .collect();
      let kampanya = zincirle(kurallar);
      println!("{}", kampanya(1000));
  }
check: tests
tests: |
  fn kur(tanim: &str) -> Box<dyn Fn(u32) -> u32> {
      kural_olustur(tanim).unwrap_or_else(|| panic!("\"{tanim}\" geçerli bir kural olmalı"))
  }

  #[test]
  fn tek_tek_kurallar() {
      assert_eq!(kur("yuzde:10")(200), 180, "200'ün %10 indirimlisi 180");
      assert_eq!(kur("yuzde:100")(75), 0, "%100 indirim fiyatı sıfırlar");
      assert_eq!(kur("sabit:50")(120), 70);
      assert_eq!(kur("sabit:50")(30), 0, "Fiyat 0'ın altına inmemeli");
      assert_eq!(kur("tavan:1000")(1500), 1000);
      assert_eq!(kur("tavan:1000")(400), 400, "Tavanın altındaki fiyat değişmemeli");
  }

  #[test]
  fn gecersiz_tanimlar() {
      assert!(kural_olustur("bedava:1").is_none(), "Bilinmeyen tür");
      assert!(kural_olustur("yuzde:abc").is_none(), "Sayı olmayan N");
      assert!(kural_olustur("yuzde:150").is_none(), "%100'den büyük indirim geçersiz");
      assert!(kural_olustur("sabit").is_none(), "':' içermeyen tanım");
  }

  #[test]
  fn sira_onemli() {
      let a = zincirle(vec![kur("yuzde:50"), kur("sabit:30")]);
      assert_eq!(a(200), 70, "Önce %50 (100), sonra -30");
      let b = zincirle(vec![kur("sabit:30"), kur("yuzde:50")]);
      assert_eq!(b(200), 85, "Önce -30 (170), sonra %50");
  }

  #[test]
  fn bos_zincir_ve_tekrar_kullanim() {
      let bos = zincirle(Vec::new());
      assert_eq!(bos(300), 300, "Kural yoksa fiyat aynı kalmalı");
      let k = zincirle(vec![kur("tavan:500"), kur("yuzde:20")]);
      assert_eq!((k(900), k(100)), (400, 80), "Aynı zincir defalarca çağrılabilmeli");
  }
hints:
  - "`tanim.split_once(':')` bir `Option<(&str, &str)>` döndürür (Modül 7). `?` ile `None`'ı yay, sonra `sayi.parse().ok()?` ile N'yi oku."
  - "`match tur { \"yuzde\" if n <= 100 => Some(Box::new(move |f: u32| f - f * n / 100)), ... }`. Closure'lar `n`'yi kullanacağı için `move` gerekir; `kural_olustur` dönünce `n` yok olur. Parametre tipini (`f: u32`) yaz; `Box::new` generic olduğu için derleyici onu dönüş tipinden çıkaramayabilir."
  - "`zincirle` vektörü sahiplenen bir closure döndürmeli: `move |fiyat| { let mut sonuc = fiyat; for kural in &kurallar { sonuc = kural(sonuc); } sonuc }`."
explanation: |
  İki fonksiyon iki farklı aracı kullandı ve her birinin bir nedeni var:

  - `kural_olustur` **çalışma anında seçilen** üç farklı closure tipinden birini döndürüyor. Bunları tek bir
    dönüş tipinde birleştirmenin yolu `Box<dyn Fn>`. `impl Fn` olsaydı E0308 alırdın (“no two closures,
    even if identical, have the same type”).
  - `zincirle` ise her zaman **aynı** closure'ı döndürüyor, bu yüzden sıfır maliyetli `impl Fn` yeterli.
    Closure, `kurallar` vektörünü `move` ile sahiplendi. İçeride `&kurallar` üzerinde döndüğü için
    yalnızca okuma yapıyor, yani `Fn` (Modül 14) olarak kalıyor ve defalarca çağrılabiliyor.

  `"yuzde" if n <= 100` bir match guard'ı (Modül 21): Koşul tutmazsa `_ => None` koluna düşülür.
  `f - f * n / 100` taşmaz mı? `n <= 100` olduğu için `f * n / 100 <= f`, yani çıkarma güvenli. Ama
  `f * n` çok büyük fiyatlarda `u32`'yi taşırabilir; gerçek bir sistemde `u64` ile hesaplamak daha
  sağlamdır.

  Iterator'larla daha kısa bir `zincirle` gövdesi: `move |fiyat| kurallar.iter().fold(fiyat, |f, k| k(f))`.
  `main`'deki `.filter_map(kural_olustur)` satırı da bu dersin konusu: Bir fonksiyonun adı, closure
  yerine geçti.
```

## Yüksek dereceli trait sınırları: for<'a>

Bir metni işleyen bir fonksiyon yazalım. Dönüştürücü bir `&str` alıp yine bir `&str` döndürsün.
Derleyiciye yaşam süresini açıkça söylemek isteyen biri şöyle yazabilir. Derlenir mi?

```compiles
code: |
  fn uygula<'a, F: Fn(&'a str) -> &'a str>(f: F) -> usize {
      let metin = String::from("  merhaba dünya  ");
      let sonuc = f(&metin);
      sonuc.len()
  }

  fn main() {
      println!("{}", uygula(|s| s.trim()));
  }
answer: false
error: E0597
explanation: |
  `'a` fonksiyonun **generic parametresi**. Onu `uygula`'yı **çağıran** seçer ve fonksiyonun tamamını
  kapsayacak kadar uzun olmak zorundadır. `metin` ise fonksiyonun içinde doğup ölen bir yerel
  değişkendir; ona verilen referans hiçbir zaman çağıranın seçtiği `'a` kadar yaşayamaz.
```

:::error
```text
error[E0597]: `metin` does not live long enough
  --> src/main.rs:3:19
   |
 1 | fn uygula<'a, F: Fn(&'a str) -> &'a str>(f: F) -> usize {
   |           -- lifetime `'a` defined here
 2 |     let metin = String::from("  merhaba dünya  ");
   |         ----- binding `metin` declared here
 3 |     let sonuc = f(&metin);
   |                 --^^^^^^-
   |                 | |
   |                 | borrowed value does not live long enough
   |                 argument requires that `metin` is borrowed for `'a`
 4 |     sonuc.len()
 5 | }
   | - `metin` dropped here while still borrowed
```
“argument requires that `metin` is borrowed for `'a`”: `F` yalnızca **tek bir** yaşam süresi `'a` için
çalışacağına söz veriyor ve bu `'a` dışarıda seçilmiş.
:::

Oysa istediğimiz şey farklı: “`f`'e **hangi** yaşam süresinde bir `&str` verirsem vereyim, bana aynı
yaşam süresinde bir `&str` döndürsün.” Bunun sözdizimi **`for<'a>`**'dır ve buna **yüksek dereceli
trait sınırı (higher-ranked trait bound, HRTB)** denir:

```rust
fn uygula<F>(f: F) -> usize
where
    F: for<'a> Fn(&'a str) -> &'a str, // "her 'a için"
{
    let metin = String::from("  merhaba dünya  ");
    let sonuc = f(&metin); // 'a = metin'in ödünç süresi; sorun yok
    sonuc.len()
}

fn kisa<F: Fn(&str) -> &str>(f: F) -> usize {
    // Yukarıdakiyle AYNI sınır: elision kuralları for<'a>'yı kendisi ekler
    let metin = String::from("çay");
    f(&metin).len()
}

fn main() {
    println!("{}", uygula(|s| s.trim()));
    println!("{}", kisa(|s| s));
}
```

İkinci fonksiyon sürprizi açıklıyor: Modül 14'ten beri `F: Fn(&str) -> &str` yazıyorsun ve hep
çalıştı. Çünkü `Fn(..)` sözdiziminde yaşam süresi elision'ı **`for<'a>` üretir**. Modül 12'deki elision
kuralları burada da işler: Tek girdi referansı varsa çıktı ona bağlanır. Böylece
`Fn(&str) -> &str` aslında `for<'a> Fn(&'a str) -> &'a str` olur. HRTB'leri bilmeden yıllarca
kullanmış olman bu yüzden.

Dersin başındaki `.map(str::len)` örneğini derlersen, E0631'in ardından gelen ikinci hatada
`str::len`'in tipini `for<'a> fn(&'a str) -> usize` olarak görürsün. Fonksiyon işaretçileri de referans parametrelerinde aynı şekilde “her yaşam süresi için”
geçerlidir.

:::analogy Herkese uyan anahtar
`F: Fn(&'a str) -> &'a str` (dışarıdan seçilen `'a`), çilingirin **tek bir kapı** için kestiği anahtardır.
Kapıyı sen değil, anahtarı sipariş eden seçti; evin içinde yeni bir kapı açarsan anahtar oraya uymaz.
`for<'a>` ise bir **maymuncuktur**: “Bana hangi kapıyı gösterirsen göster, açarım.” Fonksiyonun
içinde doğup ölen yerel bir değişken de böyle bir kapıdır.
:::

`for<'a>`'yı açıkça yazman gereken asıl yer, `Fn` sözdizimi olmayan, **yaşam süresi parametresi alan
bir trait**'tir. Orada elision yardımcı olmaz:

```rust
trait Ayristir<'a> {
    fn ayir(&self, girdi: &'a str) -> Vec<&'a str>;
}

struct Virgul;

impl<'a> Ayristir<'a> for Virgul {
    fn ayir(&self, girdi: &'a str) -> Vec<&'a str> {
        girdi.split(',').collect()
    }
}

// P: Ayristir<'x> yazsaydık, yerel `birlesik`'i ödünç veremezdik (E0597)
fn alan_say<P>(p: &P, satirlar: &[&str]) -> usize
where
    P: for<'a> Ayristir<'a>,
{
    let birlesik = satirlar.join(",");
    p.ayir(&birlesik).len()
}

fn main() {
    println!("{}", alan_say(&Virgul, &["elma,armut", "kiraz"]));
}
```

Bir şey HRTB'yi sağlamadığında derleyici de aynı dili konuşur:

:::error
```text
error: implementation of `Fn` is not general enough
  --> src/main.rs:15:20
   |
15 |     println!("{}", uygula(sabit));
   |                    ^^^^^^^^^^^^^ implementation of `Fn` is not general enough
   |
   = note: `fn(&'2 str) -> &str` must implement `Fn<(&'1 str,)>`, for any lifetime `'1`...
   = note: ...but it actually implements `Fn<(&'2 str,)>`, for some specific lifetime `'2`
```
Burada `uygula`'ya `fn(&'static str) -> &'static str` tipinde bir işaretçi verilmişti. Mesaj HRTB'nin
tanımını kelimesi kelimesine yapıyor: Gereken **“for any lifetime”** (her yaşam süresi için), elimizde
olan **“for some specific lifetime”** (belirli tek bir yaşam süresi için).
:::

```quiz
question: "(Modül 12 tekrarı) `F: Fn(&str, &str) -> &str` sınırı neden derlenmez?"
options:
  - "`Fn` sözdiziminde iki parametre kullanılamaz"
  - "İki girdi referansı var; elision kuralları çıktının hangisine bağlanacağını belirleyemez, açıkça `for<'a> Fn(&'a str, &'a str) -> &'a str` yazılmalı"
  - "`&str` döndüren closure'lar her zaman `'static` olmalıdır"
  - "Derlenir; elision çıktıyı ilk parametreye bağlar"
answer: 1
explanation: |
  Elision'ın ikinci kuralı: Tek bir girdi yaşam süresi varsa çıktıya o atanır. Burada iki girdi var ve
  `&self` de yok (üçüncü kural). Derleyici E0106 (“missing lifetime specifier”) verir, tıpkı Modül 12'deki
  `en_uzun(x: &str, y: &str) -> &str` örneğinde olduğu gibi. Çözüm aynı mantıkla: Yaşam süresini
  adlandır, ama bu kez sınırın içinde `for<'a>` ile. Derleyicinin ilk önerisi de tam olarak bu:
  “consider making the bound lifetime-generic with a new `'a` lifetime”.
feedback:
  - "`Fn(A, B) -> C` sözdizimi istediğin kadar parametre alabilir."
  - "Doğru!"
  - "`'static` gerekmez; HRTB ile her yaşam süresi kabul edilir."
  - "Elision ilk parametreyi seçmez; yalnızca `&self` varsa çıktıyı ona bağlar."
```

:::deep Closure'ın kendi imzası ve “lifetime may not live long enough”
Elision, closure'ın **kendi** parametrelerinde aynı şekilde çalışmaz. Şu kod derlenmez:

```text
error: lifetime may not live long enough
 --> src/main.rs:2:32
  |
2 |     let ilk_kelime = |s: &str| s.split(' ').next().unwrap_or("");
  |                          -   - ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ returning this value requires that `'1` must outlive `'2`
  |                          |   |
  |                          |   return type of closure is &'2 str
  |                          let's call the lifetime of this reference `'1`
```

Derleyici closure'ın dönüş tipine girdiden **bağımsız** bir yaşam süresi atadı. Pratik çözümler:
closure yerine küçük bir `fn` yazmak ya da closure'ı `F: Fn(&str) -> &str` sınırlı bir fonksiyondan
geçirerek derleyiciye beklenen imzayı göstermek:

```rust
fn kisitla<F: Fn(&str) -> &str>(f: F) -> F {
    f
}

fn main() {
    let ilk_kelime = kisitla(|s| s.split(' ').next().unwrap_or(""));
    let metin = String::from("merhaba dünya");
    println!("{}", ilk_kelime(&metin));
}
```
:::

## Özet

:::remember
- **`fn(i32) -> i32`** bir fonksiyon işaretçisidir: 8 bayt, `Copy`, null olamaz; diziye ve struct
  alanına doğrudan konur. `Fn`, `FnMut` ve `FnOnce`'ın üçünü de uygular.
- Her fonksiyonun kendine özgü, **0 baytlık** bir **fonksiyon öğesi tipi** vardır (`fn(i32) -> i32 {iki_kat}`).
  Bu yüzden `f = uc_kat;` E0308 verir. Öğeler ve **yakalamayan** closure'lar işaretçiye dönüşür.
- Fonksiyon adları, metot yolları (`str::trim`, `i64::checked_add`) ve kurucular (`Some`, `Puan`,
  `Kayit::Gecerli`) değer olarak verilebilir: `.map(Puan)`. Tipler **birebir** uymalı (E0631); deref
  zorlaması olmaz.
- Closure döndürmek: varsayılan **`impl Fn`** (tek tip, sıfır maliyet); farklı closure'lar →
  **`Box<dyn Fn>`**; yakalama yoksa `fn` işaretçisi de olur.
- **`for<'a>`** = “her yaşam süresi için”. `F: Fn(&str) -> &str` zaten `for<'a> Fn(&'a str) -> &'a str`
  demektir. Yaşam süresi parametreli trait'lerde (`P: for<'a> Ayristir<'a>`) açıkça yazılır.
:::

```reflect
prompt: |
  `fn uygula<'a, F: Fn(&'a str) -> &'a str>(f: F)` ile `fn uygula<F: for<'a> Fn(&'a str) -> &'a str>(f: F)`
  arasındaki fark nedir? Neden yalnızca ikincisi `f`'i fonksiyonun içindeki yerel bir `String` ile
  çağırabilir? Kendi cümlelerinle açıkla.
answer: |
  İlkinde `'a` fonksiyonun generic parametresidir: Onu çağıran seçer ve `'a` fonksiyon çağrısının
  tamamından uzun yaşamak zorundadır. `F` yalnızca o tek `'a` için çalışacağına söz verir. Fonksiyonun
  içinde yaratılan bir `String`, fonksiyon bitmeden ölür; ona verilen referans o `'a` kadar yaşayamaz,
  bu yüzden E0597 alınır.

  İkincisinde `'a` sınırın **içinde** bağlanır: `F` “her olası `'a` için” çalışmak zorundadır. Fonksiyon
  `f`'i çağırdığı anda `'a`'yı kendisi seçer; bu, yerel değişkenin ödünç süresi olabilir. Bunu yapmak için
  closure'ın gerçekten genel olması gerekir. `|s| s.trim()` öyledir; yalnızca `'static` kabul eden bir
  işaretçi değildir (“not general enough”).
```

```flashcards
- front: "`fn(i32) -> i32` tipi nedir, kaç bayttır ve hangi closure trait'lerini uygular?"
  back: "Fonksiyon işaretçisi (kod adresi): 64 bit sistemde 8 bayt, `Copy`, null olamaz. `Fn`, `FnMut` ve `FnOnce`'ın üçünü de uygular."
- front: "`let mut f = iki_kat; f = uc_kat;` (aynı imzalar) neden E0308 verir?"
  back: "Her fonksiyonun kendine özgü, 0 baytlık bir fonksiyon öğesi tipi vardır. Çözüm: `let mut f: fn(i32) -> i32 = iki_kat;`"
- front: Hangi closure'lar bir `fn` işaretçisine dönüşebilir?
  back: "Yalnızca hiçbir şey **yakalamayan** closure'lar. Yakalayanların taşıyacak verisi vardır."
- front: "`struct Puan(u32);` tanımında `Puan` adı bir değer olarak kullanılınca tipi nedir?"
  back: "Bir kurucu fonksiyon: `fn(u32) -> Puan`. Bu yüzden `.map(Puan)` yazılabilir (aynısı `Some`, `Ok` ve tuple benzeri enum varyantları için geçerli)."
- front: "`v.iter().map(str::len)` (`v: Vec<String>`) neden E0631 verir?"
  back: "Iterator `&String` veriyor, `str::len` ise `&str` bekliyor. Fonksiyon değeri verilince deref zorlaması olmaz. Çözüm: `String::len` ya da `|s| s.len()`."
- front: Closure döndürürken ne zaman `impl Fn`, ne zaman `Box<dyn Fn>`?
  back: "Hep aynı closure tipi dönüyorsa `impl Fn` (sıfır maliyet). Çalışma anında farklı closure'lar seçiliyor ya da bir koleksiyonda tutuluyorsa `Box<dyn Fn>`."
- front: "`F: for<'a> Fn(&'a str) -> &'a str` sınırını Türkçe oku."
  back: "“Her `'a` yaşam süresi için, `&'a str` alıp `&'a str` döndüren bir `F`.” `F: Fn(&str) -> &str` ile aynıdır (elision `for<'a>` ekler)."
- front: "“implementation of `Fn` is not general enough” hatası ne anlatır?"
  back: "Bir HRTB (`for<'a>`) **her** yaşam süresi için çalışan bir fonksiyon istiyor, verilen ise yalnızca belirli bir yaşam süresi (ör. `'static`) için çalışıyor."
```
