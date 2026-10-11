---
id: m07-l02
title: "Option: null'suz dünya"
minutes: 20
type: lesson
objectives:
  - Null referanslarının neden "milyar dolarlık hata" sayıldığını ve Rust'ın bunu `Option<T>` ile nasıl çözdüğünü açıklayabilmek
  - Sonucu olmayabilen işlemler için `Some` ya da `None` döndüren fonksiyonlar yazabilmek
  - Bir `Option<T>` içindeki değeri `match`, `unwrap_or` ve `take` ile güvenle kullanabilmek
  - Struct alanlarında `Option` kullanarak isteğe bağlı bilgiyi tutarsızlığa yer bırakmadan modelleyebilmek
keywords: [Option, Some, None, null, unwrap_or, unwrap, expect, take, E0277, E0282, E0507]
---

Bir öğrencinin telefon numarası olmayabilir. Bir listede aradığın eleman bulunmayabilir. Bir bölme
işleminin sonucu olmayabilir (sıfıra bölme!). "Değer olmayabilir" programlamanın en sık karşılaşılan
durumlarından biri, ve tarihin en pahalı hatalarından biri de tam burada yapıldı.

Bu derste Rust'ın bu soruna verdiği zarif cevabı öğreneceksin: **null** yok, onun yerine bir önceki
derste öğrendiğin türden sıradan bir enum var: `Option<T>`.

## Milyar dolarlık hata

1965'te bilgisayar bilimci **Tony Hoare**, ALGOL W dilini tasarlarken bir kolaylık ekledi: **null
referansı**, hiçbir şeyi göstermeyen bir referans. 2009'daki bir konuşmasında bu kararı
**"milyar dolarlık hatam"** diye andı: o günden bu yana sayısız çökme ve güvenlik açığı bu küçük
kolaylıktan doğdu.

Sorun şu: null'a izin veren dillerde **her** referans gizlice "belki de yok" anlamı taşır ve tip bunu
söylemez:

```java
String ikinciAd = kullanici.getIkinciAd(); // null olabilir mi? Tip söylemiyor!
System.out.println(ikinciAd.length());     // NullPointerException
```

| Dil | Null'a dokununca |
|---|---|
| Java | `NullPointerException` |
| JavaScript | `TypeError: Cannot read properties of null` |
| Python | `AttributeError: 'NoneType' object has no attribute ...` |
| C / C++ | NULL işaretçiyi çözmek tanımsız davranıştır; çoğu zaman çökme (segfault) |

Rust'ta null **yoktur** (tek istisna, yalnızca `unsafe` kodda kullanılan ham işaretçilerdir; Modül 24).
`String` tipindeki bir değişken her zaman geçerli bir metin tutar; bir referans her zaman geçerli bir
değeri gösterir. Değer olmayabiliyorsa bunu **tipe yazarsın**: `Option<String>`.
Böylece "burada değer olmayabilir" bilgisi gizli bir tuzak olmaktan çıkar, derleyicinin denetlediği bir
gerçeğe dönüşür. (Swift ve Kotlin'deki `String?` de aynı fikrin akrabasıdır.)

Aslında Option'la Modül 2'de karşılaşmıştın. `checked_add`'i hatırla:

```predict
code: |
  fn main() {
      let a: u8 = 250;
      println!("{:?}", a.checked_add(5));
      println!("{:?}", a.checked_add(10));
  }
options:
  - |
    Some(255)
    None
  - |
    255
    4
  - |
    Some(255)
    Some(4)
  - |
    255
    None
answer: 0
explanation: |
  `u8` en fazla 255 tutar. 250 + 5 = 255 sığar, sonuç `Some(255)` olur. 250 + 10 = 260 sığmaz;
  `checked_add` ne panikler (debug) ne de başa sarar (release), sonucun **olmadığını** söyler: `None`.
  Modül 2'de "bu tipe `Option` denir, Modül 7'de ayrıntılı göreceğiz" diye geçtiğimiz şey buydu. Dönüş tipi `Option<u8>`'dir;
  `{:?}` ile yazdırınca varyantın adını da görürsün: `Some(...)` ya da `None`.
```

## Some ve None: Option'ın iki yüzü

Standart kütüphane "değer olabilir de olmayabilir de" durumunu şöyle bir enum ile tanımlar
(sadeleştirilmiş hâli):

```rust,ignore
enum Option<T> {
    None,    // değer yok
    Some(T), // bir T değeri var
}
```

Bir önceki dersten tanıdık: iki varyantlı bir enum! Tek yeni şey `<T>`: bu bir **tip parametresi
(type parameter)**, yani "buraya herhangi bir tip gelebilir" demek. `Option<i32>` "belki bir `i32`",
`Option<String>` "belki bir `String`" demektir. Kendi generic tiplerini Modül 11'de yazacaksın; şimdilik
`<T>`'yi "kutunun içine ne konacağı" diye oku.

Option o kadar sık kullanılır ki **prelude**'dadır (her programa kendiliğinden dahil edilen isimler):
`Option::Some(5)` yerine doğrudan `Some(5)` ve `None` yazarsın.

```rust
fn main() {
    let sayi: Option<i32> = Some(5);
    let harf = Some('ş');        // tip çıkarımı: Option<char>
    let sehir = Some("İzmir");   // Option<&str>
    let yok: Option<i32> = None; // None için tipi biz söylüyoruz
    println!("{sayi:?} {harf:?} {sehir:?} {yok:?}");
}
```

Neden `None` için tip yazdık? Tahmin et:

```compiles
code: |
  fn main() {
      let bos = None;
      println!("{bos:?}");
  }
answer: false
error: E0282
explanation: |
  Derlenmez: **E0282** - *type annotations needed for `Option<_>`*. `Some(5)` yazınca derleyici içerideki
  değerden `T = i32` olduğunu çıkarır. `None` ise hiçbir ipucu taşımaz: boş kutunun neyin kutusu olduğu
  belli değil. Modül 2'deki tip çıkarımı kuralı: derleyici tipi bulamadığında senden açıkça yazmanı ister:
  `let bos: Option<i32> = None;`
```

:::analogy Hediye kutusu
`Option<T>` bir hediye kutusudur: içinde bir şey olabilir (`Some(hediye)`) ya da kutu boş olabilir
(`None`). Kutunun içindekini kullanmak için **önce kutuyu açman** gerekir; çikolatayı kutunun üstünden
yiyemezsin. Rust'ta da bir `Option<i32>`'yi sanki bir `i32`'ymiş gibi kullanamazsın; derleyici seni
kutuyu açmaya ve "ya boşsa?" sorusunu cevaplamaya zorlar.
:::

Sonucu olmayabilen işlemler için Option döndüren fonksiyonlar yazarsın. Dönüş tipini `Option<...>` yap,
değer varsa `Some(deger)`, yoksa `None` döndür:

```rust
fn bol(bolunen: i32, bolen: i32) -> Option<i32> {
    if bolen == 0 {
        None
    } else {
        Some(bolunen / bolen)
    }
}

fn ilk_negatif(sayilar: &[i32]) -> Option<i32> {
    for s in sayilar {
        if *s < 0 {
            return Some(*s); // bulduk: hemen dön
        }
    }
    None // döngü bitti, negatif yok
}

fn main() {
    println!("{:?}", bol(10, 3));
    println!("{:?}", bol(1, 0));
    println!("{:?}", ilk_negatif(&[4, 7, -2, -9]));
    println!("{:?}", ilk_negatif(&[1, 2, 3]));
}
```

`for s in sayilar` döngüsünde `s` bir `&i32`'dir (dilimi ödünç alarak geziyoruz); değeri `*s` ile
alıyoruz (Modül 5).

```fill
prompt: "`harf_notu` 0–100 arası puanlar için bir harf döndürsün; 100'den büyük (geçersiz) puanlar için \"sonuç yok\" desin."
code: |
  fn harf_notu(puan: u32) -> ___0 {
      if puan > 100 {
          return ___1;
      }
      if puan >= 85 {
          ___2
      } else if puan >= 50 {
          Some('C')
      } else {
          Some('F')
      }
  }

  fn main() {
      println!("{:?} {:?} {:?}", harf_notu(92), harf_notu(40), harf_notu(150));
  }
blanks:
  - ["Option<char>"]
  - ["None"]
  - ["Some('A')"]
output: "Some('A') Some('F') None"
explanation: |
  Fonksiyon "belki bir `char`" döndürdüğü için dönüş tipi `Option<char>`'dır. Geçersiz puanda sonuç yok:
  `None`. Geçerli puanlarda harfi kutuya koyarız: `Some('A')`. Dikkat: dönüş tipi `Option<char>` iken
  çıplak `'A'` döndüremezsin; her dalın tipi aynı olmalı (Modül 3), yani her dal bir `Option<char>`
  üretmeli.
```

## Kutuyu açmak: değere ulaşmanın yolları

Bir `Option<i32>`'yi doğrudan bir sayı gibi kullanmayı dene. Bu kod derlenir mi?

```compiles
code: |
  fn main() {
      let fiyat: i32 = 100;
      let indirim: Option<i32> = Some(15);
      let odenecek = fiyat - indirim;
      println!("{odenecek}");
  }
answer: false
error: E0277
explanation: |
  Derlenmez: **E0277** - *cannot subtract `Option<i32>` from `i32`*. `indirim`'in tipi `i32` değil,
  "belki bir `i32`". Rust bir sayıdan "belki bir sayıyı" nasıl çıkaracağını bilemez: ya `None` ise?
  Önce kutuyu açıp "boşsa ne olacak" sorusunu cevaplaman gerekir.
```

:::error
```text
error[E0277]: cannot subtract `Option<i32>` from `i32`
 --> src/main.rs:4:26
  |
4 |     let odenecek = fiyat - indirim;
  |                          ^ no implementation for `i32 - Option<i32>`
  |
  = help: the trait `Sub<Option<i32>>` is not implemented for `i32`
```
Gerçek çıktıda bunun ardından "şu tipler `Sub`'ı uygular" diye uzun bir liste gelir; ilk satırlar
yeterli. *no implementation for `i32 - Option<i32>`*: bu iki tip arasında çıkarma tanımlı değil.
Java'da `Integer indirim = null;` ile aynı kod derlenir ve çalışırken patlar. Rust'ta "null kontrolünü
unutmak" diye bir hata türü **yoktur**, çünkü kontrol etmeden değere ulaşamazsın.
:::

**1. `match` ile:** iki durumu da açıkça ele alırsın. `Some(miktar)` deseni "kutuda bir değer varsa onu
`miktar`'a bağla" demektir:

```rust
fn main() {
    let fiyat = 100;
    let indirimler = [Some(15), None];
    for indirim in indirimler {
        let odenecek = match indirim {
            Some(miktar) => fiyat - miktar,
            None => fiyat,
        };
        println!("Ödenecek: {odenecek} TL");
    }
}
```

**2. Kısayol metotlarıyla:** Option'ın, kutuyu tek satırda açan metotları vardır:

```rust
fn main() {
    let dolu: Option<i32> = Some(15);
    let bos: Option<i32> = None;

    println!("{}", dolu.unwrap_or(0));                 // 15
    println!("{}", bos.unwrap_or(0));                  // 0: boşsa varsayılan
    println!("{} {}", dolu.is_some(), bos.is_none()); // true true
    println!("{}", dolu.unwrap());                     // 15... ama None olsaydı?
}
```

`unwrap()` ve `expect("...")`'i Modül 2'de `parse` ile görmüştün: "değeri ver, yoksa programı durdur".
Bir `None` üzerinde çağrılırlarsa program **panikler**:

```rust,should_panic
fn main() {
    let indirim: Option<i32> = None;
    let deger = indirim.expect("indirim tanımlı olmalıydı");
    println!("{deger}");
}
```

:::warning unwrap bir söz vermektir
`unwrap()` "burada asla `None` olmayacağından eminim" demektir. Yanılırsan program
*called `Option::unwrap()` on a `None` value* mesajıyla çöker; `expect` ise senin yazdığın mesajı
gösterir. Bunlar null'un çalışma anı patlamasının Rust'taki karşılığıdır, ama bir farkla: **açıkça
yazdığın** bir karardır, kod incelemesinde göze batar. Ne zaman kabul edilebilir olduklarını Modül 10'da
tartışacağız; şimdilik `match` ve `unwrap_or`'u tercih et.
:::

| Yöntem | Kutu boşsa (`None`) | Ne zaman? |
|---|---|---|
| `match` | sen karar verirsin | iki durumda farklı işler yapılacaksa |
| `unwrap_or(v)` | `v` döner | makul bir varsayılan değer varsa |
| `is_some()` / `is_none()` | `false` / `true` | yalnızca "var mı?" sorusu için |
| `unwrap()` / `expect("…")` | **panik** | `None`'ın imkânsız olduğundan eminsen (Modül 10) |

(`unwrap_or`'un kardeşleri `unwrap_or_else` ve `unwrap_or_default`'u Modül 10'da göreceğiz.)

```predict
code: |
  fn main() {
      let kahve: Option<u32> = Some(3);
      let cay: Option<u32> = None;
      let toplam = kahve.unwrap_or(10) + cay.unwrap_or(10);
      println!("{toplam}");
  }
options:
  - "13"
  - "20"
  - "3"
  - "Derlenmez"
answer: 0
explanation: |
  `kahve` dolu bir kutu: `unwrap_or(10)` içindeki `3`'ü verir, varsayılanı yok sayar. `cay` boş:
  `unwrap_or(10)` varsayılan değeri, `10`'u döndürür. Toplam 3 + 10 = 13. İki çağrının sonucu da düz
  `u32` olduğu için toplama derlenir.
```

Şimdi sıra sende: sonucu olmayabilen bir fonksiyon yaz.

```exercise
title: Haftanın en düşük sıcaklığı
difficulty: 2
prompt: |
  Bir hava durumu uygulaması, ölçülen sıcaklıklardan en düşüğünü gösteriyor. Ama bazen hiç ölçüm
  yapılmamış olabiliyor; o zaman "en düşük sıcaklık" diye bir şey yoktur.

  `en_dusuk_sicaklik` fonksiyonunu tamamla: dilim boşsa `None`, değilse en küçük değeri `Some` içinde
  döndürsün.
starter: |
  fn en_dusuk_sicaklik(sicakliklar: &[i32]) -> Option<i32> {
      todo!()
  }

  fn main() {
      let hafta = [12, 7, 15, -3, 4, 9, 11];
      match en_dusuk_sicaklik(&hafta) {
          Some(t) => println!("Haftanın en düşük sıcaklığı: {t}°C"),
          None => println!("Ölçüm yok"),
      }
  }
solution: |
  fn en_dusuk_sicaklik(sicakliklar: &[i32]) -> Option<i32> {
      if sicakliklar.is_empty() {
          return None;
      }
      let mut en_dusuk = sicakliklar[0];
      for s in sicakliklar {
          if *s < en_dusuk {
              en_dusuk = *s;
          }
      }
      Some(en_dusuk)
  }

  fn main() {
      let hafta = [12, 7, 15, -3, 4, 9, 11];
      match en_dusuk_sicaklik(&hafta) {
          Some(t) => println!("Haftanın en düşük sıcaklığı: {t}°C"),
          None => println!("Ölçüm yok"),
      }
  }
check: tests
tests: |
  #[test]
  fn karisik_degerlerde_en_kucugu_bulur() {
      assert_eq!(en_dusuk_sicaklik(&[12, 7, 15, -3, 4]), Some(-3), "en düşük değer -3 olmalı");
  }

  #[test]
  fn bos_dilimde_none_doner() {
      assert_eq!(en_dusuk_sicaklik(&[]), None, "ölçüm yoksa en düşük sıcaklık da yoktur");
  }

  #[test]
  fn tek_olcum() {
      assert_eq!(en_dusuk_sicaklik(&[21]), Some(21), "tek ölçüm varsa en düşük de odur");
  }

  #[test]
  fn en_kucuk_sonda_olsa_da_bulunur() {
      assert_eq!(en_dusuk_sicaklik(&[-1, -5, -12]), Some(-12), "en küçük değer sonda: -12");
  }

  #[test]
  fn en_kucuk_basta_olsa_da_bulunur() {
      assert_eq!(en_dusuk_sicaklik(&[-20, 3, 8]), Some(-20), "en küçük değer başta: -20");
  }
hints:
  - "Önce boş durumu ele al: `sicakliklar.is_empty()` dilim boşsa `true` döner; o zaman hemen `return None;`"
  - "Başlangıç değeri olarak `0` değil, dilimin ilk elemanını al: `let mut en_dusuk = sicakliklar[0];` (Sıcaklıkların hepsi 0'dan büyükse ne olurdu?)"
  - "Döngüde `for s in sicakliklar` ile gez; `s` bir `&i32`, değeri `*s`. Daha küçüğünü bulunca güncelle; en sonda `Some(en_dusuk)` döndür."
explanation: |
  Fonksiyonun imzası (`-> Option<i32>`) "sonuç olmayabilir" bilgisini çağırana **zorla** iletiyor:
  `main` içinde `None` durumunu düşünmeden sonucu kullanamazsın. Java'da aynı fonksiyon boş listede ya
  `null` döndürür ya da bir istisna fırlatırdı; ikisi de imzada görünmez.

  Sık yapılan hata, başlangıç değerini `0` seçmektir: `[21]` için cevap `0` çıkar ve `tek_olcum` testi
  bunu yakalar. İlk elemandan başlamak her zaman doğrudur, çünkü boş durumu zaten ayrıca ele aldık.

  İleride (Modül 14) bu fonksiyonu tek satırda yazabileceksin: `sicakliklar.iter().min().copied()`.
  Fark etmişsindir: standart kütüphanenin `min` metodu da bir `Option` döndürür; çünkü boş bir dizinin en
  küçüğü yoktur.
```

## Option bellekte ve sahiplik

Option sıradan bir enum olduğu için Modül 4'teki sahiplik kuralları ona da aynen uygulanır. İçinde bir
`String` taşıyan bir Option'ı adım adım izle:

```memory
title: "`Option<String>`: boş kutu, dolu kutu, taşınan kutu"
steps:
  - caption: "`let mut ad: Option<String> = None;`, kutu boş: heap'te hiçbir şey ayrılmadı."
    stack:
      - frame: main
        vars:
          - { name: ad, type: "Option<String>", value: "None", mut: true }
  - caption: "`ad = Some(String::from(\"Elif\"));`, kutuda bir `String` var: başlığı stack'te, harfleri heap'te."
    stack:
      - frame: main
        vars:
          - { name: ad, type: "Option<String>", value: "Some(ptr · len=4 · cap=4)", to: h1, mut: true }
    heap:
      - { id: h1, value: "E l i f" }
  - caption: "`let baska = ad;`, `Option<String>` da `String` gibi **taşınır**; artık `ad` geçersiz."
    stack:
      - frame: main
        vars:
          - { name: ad, type: "Option<String>", value: "Some(ptr · len=4 · cap=4)", moved: true, mut: true, note: taşındı }
          - { name: baska, type: "Option<String>", value: "Some(ptr · len=4 · cap=4)", to: h1 }
    heap:
      - { id: h1, value: "E l i f" }
```

Kural basit: içindeki tip `Copy` ise Option da `Copy`'dir; değilse taşınır.

````quiz
question: |
  Aşağıdaki iki program parçası için hangisi doğrudur?

  ```rust
  // A
  let a: Option<i32> = Some(5);
  let b = a;
  println!("{a:?} {b:?}");

  // B
  let c: Option<String> = Some(String::from("çay"));
  let d = c;
  println!("{c:?} {d:?}");
  ```
options:
  - İkisi de derlenir
  - "A derlenir; B derlenmez (E0382)"
  - "A derlenmez; B derlenir"
  - İkisi de derlenmez
answer: 1
explanation: |
  `i32` `Copy` olduğu için `Option<i32>` de `Copy`'dir: `let b = a;` kutuyu kopyalar, `a` ve `b` ikisi
  de geçerlidir. `String` `Copy` değildir; bu yüzden `Option<String>` de değildir: `let d = c;` sahipliği
  `d`'ye taşır ve `c`'yi kullanmak **E0382** (*borrow of moved value*) verir. Modül 4'teki kurallar
  Option'a da birebir uyar; Option'ın hiçbir "sihirli" ayrıcalığı yoktur.
feedback:
  - "B'de `String` taşıyan bir Option var; `String` `Copy` değildir."
  - "Doğru! İçerik `Copy` ise Option da `Copy`'dir."
  - "Tersi: `i32` `Copy`'dir, `String` değildir."
  - "A derlenir: `Option<i32>` kopyalanır."
````

:::deep Option bedava mı?
"Kutu" fikri pahalı görünebilir, ama derleyici çoğu zaman etiketi gizler (önceki dersteki *niş
optimizasyonu*). Bir referans asla "sıfır adresini" gösteremez; bu yüzden `Option<&i32>`, `None`'ı
sıfır adresiyle temsil eder ve çıplak bir referansla **aynı boyuttadır**. Yani C'deki NULL işaretçinin
verimliliğini, tehlikesi olmadan alırsın. `i32` gibi bütün bit desenleri geçerli olan tiplerde ise ayrı bir
etiket gerekir.

```rust
fn main() {
    // Yorumdaki değerler 64 bit bir sistem içindir
    println!("&i32:         {} bayt", std::mem::size_of::<&i32>());         // 8
    println!("Option<&i32>: {} bayt", std::mem::size_of::<Option<&i32>>()); // 8
    println!("i32:          {} bayt", std::mem::size_of::<i32>());          // 4
    println!("Option<i32>:  {} bayt", std::mem::size_of::<Option<i32>>());  // 8
}
```
:::

## Struct alanlarında Option

Modül 6'daki kütüphane envanterinde bir kitabın kimde olduğunu tutmak istediğini düşün. İki alanla
yapmaya kalkarsan (`odunc_verildi: bool` ve `odunc_alan: String`) alanlar çelişebilir: `true` ama isim
boş, ya da `false` ama isim dolu. `Option<String>` ikisini **tek alanda** birleştirir: `None` rafta
demektir, `Some(isim)` o kişide.

```rust
struct Kitap {
    baslik: String,
    odunc_alan: Option<String>, // None: rafta, Some(ad): o kişide
}

impl Kitap {
    fn musait_mi(&self) -> bool {
        self.odunc_alan.is_none()
    }

    fn durum(&self) -> String {
        match &self.odunc_alan {
            Some(kisi) => format!("{}: {kisi} adlı üyede", self.baslik),
            None => format!("{}: rafta", self.baslik),
        }
    }
}

fn main() {
    let mut kitap = Kitap { baslik: String::from("Nutuk"), odunc_alan: None };
    println!("{} (müsait: {})", kitap.durum(), kitap.musait_mi());
    kitap.odunc_alan = Some(String::from("Ayşe"));
    println!("{} (müsait: {})", kitap.durum(), kitap.musait_mi());
}
```

`match &self.odunc_alan` ifadesindeki `&`'e dikkat: kutuyu **ödünç alarak** açıyoruz. İçindeki `String`'i
taşımak istemiyoruz, yalnızca okumak istiyoruz; bu yüzden `kisi` bir `&String` olur (Modül 5).

Şimdi kitabı iade eden bir metot yazalım: kimdeyse onu döndürsün ve kitabı rafa koysun. İlk deneme:

```compiles
code: |
  struct Kitap {
      baslik: String,
      odunc_alan: Option<String>,
  }

  impl Kitap {
      fn iade_et(&mut self) -> Option<String> {
          let onceki = self.odunc_alan;
          self.odunc_alan = None;
          onceki
      }
  }

  fn main() {
      let mut k = Kitap { baslik: String::from("Nutuk"), odunc_alan: Some(String::from("Ali")) };
      println!("{:?} {}", k.iade_et(), k.baslik);
  }
answer: false
error: E0507
explanation: |
  Derlenmez: **E0507** - *cannot move out of `self.odunc_alan` which is behind a mutable reference*.
  `self` yalnızca **ödünç alınmış** bir `&mut Kitap`; ödünç aldığın bir şeyin parçasını alıp götüremezsin
  (Modül 5). Hemen sonraki satırda alanı `None` ile doldurman da bunu kurtarmaz: Rust, bir referansın
  arkasındaki değerin **her an** tam ve geçerli olmasını ister. İki satırın arasında bir şey ters gitseydi
  (örneğin bir panik), kitabın asıl sahibi içi taşınmış, geçersiz bir alanla karşılaşırdı. Derleyicinin
  önerileri (`&self.odunc_alan` ile ödünç almak ya da `.clone()` ile kopyalamak) da istediğimizi yapmaz:
  biz değeri **almak** ve alanı boşaltmak istiyoruz.
```

Çözüm, Option'ın tam bu iş için var olan metodu: **`take()`**. Kutunun içindekini alır, yerine `None`
bırakır ve aldığını döndürür. Değiştirme tek adımda olduğu için alan hiçbir an geçersiz kalmaz:

```rust
struct Kitap {
    baslik: String,
    odunc_alan: Option<String>,
}

impl Kitap {
    fn iade_et(&mut self) -> Option<String> {
        self.odunc_alan.take() // içindekini al, yerine None bırak
    }
}

fn main() {
    let mut kitap = Kitap { baslik: String::from("Nutuk"), odunc_alan: Some(String::from("Ali")) };
    let kimdeydi = kitap.iade_et();
    println!("İade eden: {kimdeydi:?}");
    println!("Şimdi: {} → {:?}", kitap.baslik, kitap.odunc_alan);
    println!("Tekrar iade: {:?}", kitap.iade_et());
}
```

```memory
title: "`take()` sahipliği nasıl devreder?"
steps:
  - caption: "Önce: `kitap.odunc_alan` içinde `\"Ali\"` var; metnin sahibi kitap."
    stack:
      - frame: main
        vars:
          - { name: kitap.odunc_alan, type: "Option<String>", value: "Some(ptr · len=3 · cap=3)", to: h1, mut: true }
    heap:
      - { id: h1, value: "A l i" }
  - caption: "`let kimdeydi = kitap.iade_et();`, heap'teki metin yerinden kıpırdamadı; yalnızca sahibi değişti. Alanda artık `None` var."
    stack:
      - frame: main
        vars:
          - { name: kitap.odunc_alan, type: "Option<String>", value: "None", mut: true }
          - { name: kimdeydi, type: "Option<String>", value: "Some(ptr · len=3 · cap=3)", to: h1 }
    heap:
      - { id: h1, value: "A l i" }
```

````exercise
title: AVM otoparkı
difficulty: 3
prompt: |
  Bir AVM otoparkındaki her park yeri ya boştur ya da içinde plakası bilinen bir araç vardır. Bunu
  `plaka: Option<String>` alanıyla modelliyoruz. Üç metodu tamamla:

  - `park_et(&mut self, plaka: &str) -> bool`: Yer boşsa aracı park eder ve `true` döndürür. Yer doluysa
    **hiçbir şeyi değiştirmeden** `false` döndürür.
  - `cikis(&mut self) -> Option<String>`: Aracı çıkarır ve plakasını döndürür; yer zaten boşsa `None`.
  - `durum(&self) -> String`: `"12 numaralı yer: boş"` ya da `"12 numaralı yer: 34 ABC 123"` biçiminde.
starter: |
  struct ParkYeri {
      no: u32,
      plaka: Option<String>,
  }

  impl ParkYeri {
      fn bos(no: u32) -> ParkYeri {
          ParkYeri { no, plaka: None }
      }

      fn park_et(&mut self, plaka: &str) -> bool {
          todo!()
      }

      fn cikis(&mut self) -> Option<String> {
          todo!()
      }

      fn durum(&self) -> String {
          todo!()
      }
  }

  fn main() {
      let mut yer = ParkYeri::bos(12);
      println!("{}", yer.durum());
      yer.park_et("34 ABC 123");
      println!("{}", yer.durum());
      println!("Çıkan araç: {:?}", yer.cikis());
  }
solution: |
  struct ParkYeri {
      no: u32,
      plaka: Option<String>,
  }

  impl ParkYeri {
      fn bos(no: u32) -> ParkYeri {
          ParkYeri { no, plaka: None }
      }

      fn park_et(&mut self, plaka: &str) -> bool {
          if self.plaka.is_some() {
              return false;
          }
          self.plaka = Some(String::from(plaka));
          true
      }

      fn cikis(&mut self) -> Option<String> {
          self.plaka.take()
      }

      fn durum(&self) -> String {
          match &self.plaka {
              Some(p) => format!("{} numaralı yer: {p}", self.no),
              None => format!("{} numaralı yer: boş", self.no),
          }
      }
  }

  fn main() {
      let mut yer = ParkYeri::bos(12);
      println!("{}", yer.durum());
      yer.park_et("34 ABC 123");
      println!("{}", yer.durum());
      println!("Çıkan araç: {:?}", yer.cikis());
  }
check: tests
tests: |
  #[test]
  fn yeni_yer_bostur() {
      let yer = ParkYeri::bos(12);
      assert_eq!(yer.durum(), "12 numaralı yer: boş", "yeni oluşturulan yer boş görünmeli");
  }

  #[test]
  fn bos_yere_park_edilebilir() {
      let mut yer = ParkYeri::bos(3);
      assert!(yer.park_et("34 ABC 123"), "boş yere park edilebilmeli (true dönmeli)");
      assert_eq!(yer.durum(), "3 numaralı yer: 34 ABC 123", "durum, yer numarasını ve plakayı göstermeli");
  }

  #[test]
  fn dolu_yere_ikinci_arac_giremez() {
      let mut yer = ParkYeri::bos(7);
      yer.park_et("06 XYZ 06");
      assert!(!yer.park_et("35 IZM 35"), "dolu yere ikinci araç park edememeli (false dönmeli)");
      assert_eq!(yer.durum(), "7 numaralı yer: 06 XYZ 06", "ilk araç yerinde kalmalı");
  }

  #[test]
  fn cikis_plakayi_verir_ve_yeri_bosaltir() {
      let mut yer = ParkYeri::bos(1);
      yer.park_et("16 BRS 16");
      assert_eq!(yer.cikis(), Some(String::from("16 BRS 16")), "çıkan aracın plakası dönmeli");
      assert_eq!(yer.cikis(), None, "boş yerden ikinci kez araç çıkamaz");
      assert_eq!(yer.durum(), "1 numaralı yer: boş", "araç çıkınca yer yeniden boş görünmeli");
  }

  #[test]
  fn bosalan_yere_yeni_arac_girebilir() {
      let mut yer = ParkYeri::bos(9);
      yer.park_et("01 ADN 01");
      yer.cikis();
      assert!(yer.park_et("27 GAZ 27"), "boşalan yere yeni araç girebilmeli");
      assert_eq!(yer.durum(), "9 numaralı yer: 27 GAZ 27", "yeni aracın plakası görünmeli");
  }
hints:
  - "Yer dolu mu? `self.plaka.is_some()` sana söyler. Doluysa hiçbir şeye dokunmadan `return false;` Boşsa `self.plaka = Some(String::from(plaka));` ve `true`."
  - "`cikis` için az önce gördüğün metot biçilmiş kaftan: `take()` içindekini verir ve yerine `None` bırakır."
  - "`durum` için kutuyu ödünç alarak aç: `match &self.plaka { Some(p) => format!(...), None => format!(...) }`. `&`'i unutursan E0507 alırsın; çünkü `&self` üzerinden `String`'i taşıyamazsın."
explanation: |
  Tek bir `Option<String>` alanı iki ayrı bilgiyi birden taşıyor: "yer dolu mu?" (`Some`/`None`) ve
  "doluysa hangi araç?" (`Some`'ın içi). `dolu: bool` + `plaka: String` ikilisinde olduğu gibi
  "dolu ama plakasız" bir durum **yazılamaz**.

  `cikis` metodunda `take()` kullanmak zorundayız: `&mut self` üzerinden `self.plaka`'yı doğrudan taşımak
  E0507 verir. `take()` "al ve yerine `None` koy" işini tek adımda yapar; bu yüzden alan hiçbir an
  geçersiz kalmaz. Plaka metni heap'te kopyalanmaz, yalnızca sahibi değişir.

  `durum` metodunda `match &self.plaka` ile kutuyu ödünç alıyoruz; `p` bir `&String` olur. `&` olmadan
  yazarsan derleyici E0507 verir ve başka bir çözüm önerir: desende `Some(ref p)`. İkisi aynı işi yapar;
  `ref` anahtar kelimesini Modül 21'de göreceğiz, günümüz Rust'ında `&self.plaka` yazmak daha yaygındır.
````

## Özet

:::remember
- Rust'ta **null yoktur**. Değer olmayabiliyorsa tip bunu söyler: `Option<T>` = `Some(T)` ya da `None`.
- `Option<T>` bir `T` değildir: önce kutuyu açmalısın (`match`, `unwrap_or`...). "Null kontrolünü unutmak"
  derleme hatasıdır.
- Tek başına `None` yazınca tip belirt: `let x: Option<i32> = None;` (yoksa E0282).
- `unwrap()` / `expect()` `None`'da **panikler**; yalnızca `None`'ın imkânsız olduğundan eminsen kullan.
- Option sıradan bir enum'dur: içerik `Copy` ise kopyalanır, değilse taşınır.
- Ödünç alınmış bir yapının Option alanını boşaltmak için `take()` kullan; okumak için `match &alan`.
:::

```reflect
prompt: Java'daki `null` ile Rust'taki `Option<T>` yaklaşımını karşılaştır. Rust'ın yaklaşımının en az iki avantajını kendi cümlelerinle açıkla.
answer: |
  1. **Tip bilgi verir:** Java'da her referans gizlice null olabilir; Rust'ta bir değerin olmayabileceği
     imzada yazar (`Option<String>`). Bir `String` her zaman gerçekten bir metindir.
  2. **Derleyici zorlar:** `Option<T>`'yi doğrudan `T` gibi kullanamazsın; `None` durumunu ele almadan kod
     derlenmez. NullPointerException gibi bir çalışma anı sürprizi yerine derleme hatası alırsın.
  3. **Gereksiz kontrol yok:** Option olmayan değerler için savunmacı null kontrolleri yazmana gerek kalmaz.
  4. **Bedava:** Niş optimizasyonu sayesinde `Option<&T>` çıplak bir referansla aynı boyuttadır.
```

```flashcards
- front: Tony Hoare "milyar dolarlık hatam" derken neyi kastetti?
  back: 1965'te ALGOL W için icat ettiği **null referansını**; sayısız çökme ve güvenlik açığına yol açtı.
- front: "Standart kütüphanedeki `Option<T>` enum'unun iki varyantı nelerdir?"
  back: "`None` (değer yok) ve `Some(T)` (bir `T` değeri var)."
- front: "`let x = None;` neden tek başına derlenmez, nasıl düzeltirsin?"
  back: "`T` çıkarılamaz (E0282). Tipi yaz: `let x: Option<i32> = None;`"
- front: "`indirim: Option<i32>` iken `100 - indirim` neden derlenmez?"
  back: "`Option<i32>` bir `i32` değildir (E0277). Önce kutuyu aç: `match` ya da `indirim.unwrap_or(0)`."
- front: "`let x: Option<u32> = None;` ise `x.unwrap_or(7)` neyi döndürür? Peki `x.unwrap()`?"
  back: "`unwrap_or(7)` → `7`. `unwrap()` → panik: *called `Option::unwrap()` on a `None` value*."
- front: "`Option::take()` ne yapar, ne zaman gerekir?"
  back: "İçindeki değeri döndürür ve yerine `None` bırakır. `&mut self` arkasındaki bir Option alanından değeri taşımak için gerekir (doğrudan taşımak E0507 verir)."
- front: "`Option<i32>` ve `Option<String>` `Copy` mudur?"
  back: "`Option<i32>` evet (`i32` `Copy`); `Option<String>` hayır, taşınır. Kural: `T` `Copy` ise `Option<T>` de `Copy`."
- front: "`&self` metodunda bir `Option<String>` alanını neden `match &self.alan` ile açarız?"
  back: "Kutuyu ödünç almak için; `&` olmadan desen `String`'i taşımaya çalışır ve E0507 verir. Bağlanan değer `&String` olur."
```
