---
id: m14-l06
title: Kendi iterator'ın ve performans
minutes: 22
type: lesson
objectives:
  - "Bir struct için `Iterator` trait'ini (`type Item` + `next`) uygulayıp bütün adaptörleri bedavaya kullanabilmek"
  - "Sonlu ve sonsuz iterator'lar tasarlayabilmek; `std::iter::from_fn` ve `successors` ile closure'dan iterator üretebilmek"
  - "Iterator'ların neden \"sıfır maliyetli soyutlama\" olduğunu (inline etme, sınır kontrolünün kalkması) açıklayabilmek"
  - Bir döngüyü iterator boru hattına çevirebilmek ve çevirmenin okunabilirliği bozduğu durumları tanıyabilmek
keywords: [Iterator impl, "type Item", Sayac, Fibonacci, from_fn, successors, "impl Iterator", sıfır maliyet, zero-cost, sınır kontrolü, bounds check, refactoring]
---

Şimdiye kadar standart kütüphanenin iterator'larını kullandık. Bu son derste masanın öbür tarafına
geçiyoruz: **kendi iterator'ını yazacaksın**. Sadece bir metot (`next`) yazıp `map`, `filter`, `zip`,
`sum`, `max` ve diğer 70'ten fazla metodu hediye olarak alacaksın. Ardından en çok sorulan soruyu
yanıtlayacağız: *Bu kadar soyutlama programı yavaşlatmıyor mu?* Cevap seni şaşırtabilir.

## İlk iterator'ın: Sayac

1'den bir üst sınıra kadar sayan bir `Sayac` yazalım. İlk denemede bir şeyi unutuyoruz. Derlenir mi?

```compiles
code: |
  struct Sayac {
      simdiki: u32,
      bitis: u32,
  }

  impl Iterator for Sayac {
      fn next(&mut self) -> Option<u32> {
          if self.simdiki < self.bitis {
              self.simdiki += 1;
              Some(self.simdiki)
          } else {
              None
          }
      }
  }

  fn main() {
      let mut s = Sayac { simdiki: 0, bitis: 3 };
      println!("{:?}", s.next());
  }
answer: false
error: E0046
explanation: |
  `Iterator` trait'i iki şey ister: `next` metodu **ve** `type Item` ilişkili tipi. Biz yalnızca `next`'i
  yazdık; derleyici `Item`'ın ne olduğunu kendi başına çıkarmaz, çünkü trait'in diğer bütün metotları
  (`map`, `sum`...) `Self::Item` üzerinden tanımlıdır.
```

:::error
```text
error[E0046]: not all trait items implemented, missing: `Item`
 --> src/main.rs:5:1
  |
5 | impl Iterator for Sayac {
  | ^^^^^^^^^^^^^^^^^^^^^^^ missing `Item` in implementation
  |
  = help: implement the missing item: `type Item = /* Type */;`
```
E0046 her trait için aynıdır: bir `impl` bloğunda trait'in zorunlu öğelerinden biri eksik. `help` satırı
eksik satırı neredeyse hazır veriyor.
:::

Eksiksiz hâli:

```rust
struct Sayac {
    simdiki: u32,
    bitis: u32,
}

impl Sayac {
    fn yeni(bitis: u32) -> Sayac {
        Sayac { simdiki: 0, bitis }
    }
}

impl Iterator for Sayac {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.simdiki < self.bitis {
            self.simdiki += 1;
            Some(self.simdiki)
        } else {
            None
        }
    }
}

fn main() {
    let mut s = Sayac::yeni(3);
    println!("{:?} {:?} {:?} {:?}", s.next(), s.next(), s.next(), s.next());

    // for döngüsü de çalışır: her Iterator aynı zamanda IntoIterator'dır
    for n in Sayac::yeni(4) {
        print!("{n} ");
    }
    println!();
}
```

Tasarım üç parçadan oluşuyor ve her iterator'da aynıdır:

1. **Durum (state)**: iterator'ın "neredeyim?" sorusunun cevabı, burada `simdiki` ve `bitis` alanları.
2. **`type Item`**: dışarıya hangi tipte eleman vereceğin.
3. **`next`**: durumu bir adım ilerlet, ya `Some(eleman)` ya da `None` döndür.

:::analogy Sıra makinesi
Bankadaki sıra makinesini düşün. İçinde tek bir şey saklıdır: **son verilen numara** (durum). Düğmeye
bastığında (`next`) numarayı bir artırır ve sana bir fiş verir (`Some(numara)`). Gün sonunda ya da rulo
bitince fiş vermeyi bırakır (`None`). Makine bütün günün numaralarını önceden basıp bir kutuda tutmaz; her
fişi **istendiği anda** üretir. Kendi iterator'ın da böyle çalışır: bütün elemanları önceden üretmez,
sadece bir sonrakini nasıl üreteceğini bilir.
:::

## Bedava gelen 70+ metot

`next`'i yazdığın anda, Modül 11'deki **varsayılan metotlar** sayesinde `Sayac` bütün adaptör ve tüketicilere
sahip olur. Rust Book'taki klasik örneğe bakalım. Tahmin et:

```predict
code: |
  # struct Sayac {
  #     simdiki: u32,
  #     bitis: u32,
  # }
  #
  # impl Sayac {
  #     fn yeni(bitis: u32) -> Sayac {
  #         Sayac { simdiki: 0, bitis }
  #     }
  # }
  #
  # impl Iterator for Sayac {
  #     type Item = u32;
  #     fn next(&mut self) -> Option<u32> {
  #         if self.simdiki < self.bitis {
  #             self.simdiki += 1;
  #             Some(self.simdiki)
  #         } else {
  #             None
  #         }
  #     }
  # }
  #
  // Sayac::yeni(5) → 1, 2, 3, 4, 5
  fn main() {
      let toplam: u32 = Sayac::yeni(5)
          .zip(Sayac::yeni(5).skip(1))
          .map(|(a, b)| a * b)
          .filter(|x| x % 3 == 0)
          .sum();
      println!("{toplam}");
  }
options:
  - "18"
  - "38"
  - "20"
  - "70"
answer: 0
explanation: |
  `zip` `(1,2)`, `(2,3)`, `(3,4)`, `(4,5)` çiftlerini üretir - ikinci sayaç bir eleman atladığı için 4'te
  biter ve `zip` kısa olanda durur. Çarpımlar: 2, 6, 12, 20. 3'e bölünebilenler: 6 ve 12. Toplam: **18**.
  Bu metotların hiçbirini biz yazmadık; hepsi `next` üzerine kurulu varsayılan metotlar.
```

Bunun nasıl mümkün olduğu, trait tanımının içinde saklı. Standart kütüphanedeki `count`'un özü kabaca şudur:

```rust,ignore
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;

    // Varsayılan metot: sadece next'i kullanır, bu yüzden her iterator'da çalışır
    fn count(self) -> usize
    where
        Self: Sized,
    {
        let mut n = 0;
        let mut s = self;
        while let Some(_) = s.next() {
            n += 1;
        }
        n
    }
    // ... map, filter, fold, sum, zip, ... hepsi aynı fikirle
}
```

:::info İstersen varsayılanları ezebilirsin
Bazı iterator'lar bazı soruları `next`'i tekrar tekrar çağırmaktan çok daha hızlı yanıtlayabilir. Örneğin
dilim iterator'ı kaç eleman kaldığını zaten bilir; standart kütüphane onun için `count`, `nth`, `last` gibi
metotları **ezerek** (override) sabit zamanda çalıştırır. Kendi tipinde de aynısını yapabilirsin; ama
önce doğru, sonra hızlı.
:::

## Sonsuz iterator: Fibonacci

Bir iterator'ın `None` döndürmesi **zorunlu değildir**. Fibonacci dizisi sonsuzdur; durum olarak son iki
sayıyı tutmak yeter. Yine de `u64` sonsuz değil: taşma olacağı zaman durmak için Modül 2'deki `checked_add`'i
ve Modül 10'daki `Option` üzerinde `?`'yı kullanalım:

```rust
struct Fibonacci {
    a: u64,
    b: u64,
}

impl Fibonacci {
    fn yeni() -> Fibonacci {
        Fibonacci { a: 0, b: 1 }
    }
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<u64> {
        let simdiki = self.a;
        let yeni = self.a.checked_add(self.b)?; // u64'e sığmayacaksa: None → iterator biter
        self.a = self.b;
        self.b = yeni;
        Some(simdiki)
    }
}

fn main() {
    let ilk_on: Vec<u64> = Fibonacci::yeni().take(10).collect();
    println!("{ilk_on:?}");

    let bin_alti_cift_toplami: u64 = Fibonacci::yeni()
        .take_while(|&f| f < 1000)
        .filter(|f| f % 2 == 0)
        .sum();
    println!("1000'in altındaki çift Fibonacci sayılarının toplamı: {bin_alti_cift_toplami}");
}
```

```memory
title: Fibonacci iterator'ının durumu
steps:
  - caption: "`Fibonacci::yeni()`: durum yalnızca iki sayı. Bütün dizi hiçbir yerde saklanmaz."
    stack:
      - frame: main
        vars:
          - { name: fib, type: Fibonacci, value: "{ a: 0, b: 1 }", mut: true }
  - caption: "1. `next()`: `Some(0)` döner, durum `{ a: 1, b: 1 }` olur."
    stack:
      - frame: main
        vars:
          - { name: fib, type: Fibonacci, value: "{ a: 1, b: 1 }", mut: true, note: "verilen: 0" }
  - caption: "2. ve 3. `next()`: `Some(1)`, `Some(1)`; durum `{ a: 2, b: 3 }`. Her adımda sadece iki `u64` değişiyor, 16 bayt."
    stack:
      - frame: main
        vars:
          - { name: fib, type: Fibonacci, value: "{ a: 2, b: 3 }", mut: true, note: "verilen: 0, 1, 1" }
```

Sonsuz (ya da çok uzun) iterator'larla çalışırken zinciri mutlaka **sınırlayan** bir adaptörle (`take`,
`take_while`) ya da kısa devre yapan bir tüketiciyle (`find`, `any`, `position`) bitir. Tahmin et:

```predict
code: |
  # struct Fibonacci {
  #     a: u64,
  #     b: u64,
  # }
  #
  # impl Iterator for Fibonacci {
  #     type Item = u64;
  #     fn next(&mut self) -> Option<u64> {
  #         let simdiki = self.a;
  #         let yeni = self.a.checked_add(self.b)?;
  #         self.a = self.b;
  #         self.b = yeni;
  #         Some(simdiki)
  #     }
  # }
  #
  // Fibonacci: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, ...
  fn main() {
      let fib = Fibonacci { a: 0, b: 1 };
      let ilk_buyuk = fib.skip(5).find(|&f| f > 20);
      let kac_tane = (Fibonacci { a: 0, b: 1 }).position(|f| f == 55);
      println!("{ilk_buyuk:?} {kac_tane:?}");
  }
options:
  - "Some(21) Some(10)"
  - "Some(34) Some(10)"
  - "Some(21) Some(11)"
  - "Some(8) Some(10)"
answer: 0
explanation: |
  `skip(5)` ilk beş elemanı (0, 1, 1, 2, 3) atlar ve 5'ten başlar; `find` 20'den büyük ilk sayıyı arar:
  5, 8, 13 değil, **21** evet → `Some(21)`. `position` indeksi 0'dan sayar: 0→0, 1→1, 2→1, 3→2, 4→3, 5→5,
  6→8, 7→13, 8→21, 9→34, **10→55**. İki tüketici de kısa devre yapar; sonsuz dizinin geri kalanına
  hiç dokunulmaz.
```

```exercise
id: m14-e-collatz
title: Collatz dizisi
difficulty: 3
prompt: |
  Collatz dizisi bir `n` sayısından başlar: `n` çiftse sıradaki `n / 2`, tekse `3n + 1`'dir; dizi **1'e
  ulaşınca biter** (1 de dizinin son elemanıdır). Örneğin 6 → 6, 3, 10, 5, 16, 8, 4, 2, 1.

  `Collatz` için `Iterator`'ı uygula:

  - `Collatz::yeni(n)` dizinin ilk elemanı `n` olan bir iterator döndürsün.
  - `n == 0` ise dizi **boş** olsun (0'dan başlayan bir Collatz dizisi yoktur).

  Durumu `simdiki: Option<u64>` alanında tut: `None` "dizi bitti" demek. Testler `collect`, `count` ve
  `max` gibi bedava metotları da kullanıyor.
starter: |
  struct Collatz {
      simdiki: Option<u64>,
  }

  impl Collatz {
      fn yeni(n: u64) -> Collatz {
          todo!()
      }
  }

  impl Iterator for Collatz {
      type Item = u64;

      fn next(&mut self) -> Option<u64> {
          todo!()
      }
  }

  fn main() {
      let dizi: Vec<u64> = Collatz::yeni(6).collect();
      println!("{dizi:?}");
  }
solution: |
  struct Collatz {
      simdiki: Option<u64>,
  }

  impl Collatz {
      fn yeni(n: u64) -> Collatz {
          if n == 0 {
              Collatz { simdiki: None }
          } else {
              Collatz { simdiki: Some(n) }
          }
      }
  }

  impl Iterator for Collatz {
      type Item = u64;

      fn next(&mut self) -> Option<u64> {
          let n = self.simdiki?;
          self.simdiki = if n == 1 {
              None
          } else if n % 2 == 0 {
              Some(n / 2)
          } else {
              Some(3 * n + 1)
          };
          Some(n)
      }
  }

  fn main() {
      let dizi: Vec<u64> = Collatz::yeni(6).collect();
      println!("{dizi:?}");
  }
check: tests
tests: |
  #[test]
  fn alti_dizisi() {
      let dizi: Vec<u64> = Collatz::yeni(6).collect();
      assert_eq!(dizi, vec![6, 3, 10, 5, 16, 8, 4, 2, 1], "6'nın Collatz dizisi");
  }

  #[test]
  fn bir_tek_elemanli() {
      let dizi: Vec<u64> = Collatz::yeni(1).collect();
      assert_eq!(dizi, vec![1], "1'den başlayan dizi sadece [1]");
  }

  #[test]
  fn sifir_bos() {
      assert_eq!(Collatz::yeni(0).next(), None, "0 için dizi boş olmalı");
  }

  #[test]
  fn yirmi_yedi_uzun_yolculuk() {
      assert_eq!(Collatz::yeni(27).count(), 112, "27'nin dizisi 112 elemanlıdır (111 adım + başlangıç)");
      assert_eq!(Collatz::yeni(27).max(), Some(9232), "27'nin dizisi 9232'ye kadar çıkar");
  }

  #[test]
  fn bittikten_sonra_hep_none() {
      let mut c = Collatz::yeni(2);
      assert_eq!((c.next(), c.next(), c.next(), c.next()), (Some(2), Some(1), None, None));
  }
hints:
  - "`yeni`: `n == 0` ise `simdiki: None`, değilse `simdiki: Some(n)`."
  - "`next`'in başında `let n = self.simdiki?;` yaz: dizi bittiyse `?` hemen `None` döndürür."
  - "Sonra sıradaki durumu hesapla: `n == 1` ise `None`, çiftse `Some(n / 2)`, tekse `Some(3 * n + 1)`; en sonda mevcut `n`'i `Some(n)` olarak döndür."
explanation: |
  Tasarımın kalbi, durumu `Option<u64>` olarak tutmak: "dizi bitti" bilgisi ayrı bir `bool` alanına değil,
  tipin kendisine gömülü (Modül 7'deki "geçersiz durumları temsil edilemez yap" ilkesi). `next`'in ilk
  satırındaki `?` hem bitmiş diziyi hem de boş başlangıcı tek hamlede ele alıyor.

  Dikkat ettiysen `next` önce **mevcut** değeri saklıyor, sonra durumu ilerletiyor, en son mevcut değeri
  döndürüyor. Bu "önce ver, sonra ilerle" düzeni sayesinde başlangıç değeri (6) ve bitiş değeri (1) diziye
  dahil oluyor.

  `count()` ve `max()`'ı yazmadık; ikisi de `next` üzerine kurulu varsayılan metotlar. `3 * n + 1` çok büyük
  `n`'lerde taşabilir; gerçek bir kütüphanede bunu da `checked_mul`/`checked_add` ile ele alırdık.
```

## Struct yazmadan iterator: from_fn, successors ve impl Iterator

Her iterator için bir struct tanımlamak zorunda değilsin. Durumu bir closure yakalayabilir, 2. dersteki
`numarator`'ı hatırla! **`std::iter::from_fn`** bir `FnMut() -> Option<T>` closure'ını alır ve her
`next()`'te onu çağırır. **`std::iter::successors`** ise bir başlangıç değeri ve "bir öncekinden sıradakini
üret" kuralı alır:

```rust
use std::iter;

fn main() {
    // from_fn: durumu (sayi) closure yakalıyor; None dönünce iterator biter
    let mut sayi = 0;
    let ciftler: Vec<u32> = iter::from_fn(move || {
        sayi += 2;
        if sayi <= 10 { Some(sayi) } else { None }
    })
    .collect();
    println!("{ciftler:?}");

    // successors: her eleman bir öncekinden türetilir; kural None dönünce biter
    let ikinin_kuvvetleri: Vec<u32> = iter::successors(Some(1u32), |&x| x.checked_mul(2)).collect();
    println!("{} tane, sonuncusu {:?}", ikinin_kuvvetleri.len(), ikinin_kuvvetleri.last());
}
```

Bir fonksiyon ya da metottan iterator **döndürmek** için de Modül 11'deki `-> impl Trait` kullanılır. Bu,
bir kütüphanenin iç yapısını gizleyip dışarıya sadece "gezilebilir bir şey" vermenin idiomatik yoludur:

```rust
struct Kitap {
    ad: String,
    oduncte: bool,
}

struct Kutuphane {
    kitaplar: Vec<Kitap>,
}

impl Kutuphane {
    // Çağıran Vec'i görmez; sadece "rafta olan kitaplar"ı gezebilir
    fn raftakiler(&self) -> impl Iterator<Item = &Kitap> {
        self.kitaplar.iter().filter(|k| !k.oduncte)
    }
}

fn main() {
    let k = Kutuphane {
        kitaplar: vec![
            Kitap { ad: String::from("Saatleri Ayarlama Enstitüsü"), oduncte: false },
            Kitap { ad: String::from("İnce Memed"), oduncte: true },
            Kitap { ad: String::from("Çalıkuşu"), oduncte: false },
        ],
    };
    for kitap in k.raftakiler() {
        println!("rafta: {}", kitap.ad);
    }
    println!("rafta {} kitap var", k.raftakiler().count());
}
```

:::deep Dönen iterator ve yaşam süresi
`raftakiler` `self.kitaplar`'ı ödünç alan bir iterator döndürüyor; yani dönen değer `&self`'ten uzun
yaşayamaz (Modül 12). Edition 2024'te `-> impl Trait` dönüş tipleri, kapsamdaki yaşam sürelerini
**otomatik olarak yakalar**; bu yüzden imzaya ek bir şey yazmadık. Eski edition'larda aynı imza için
`-> impl Iterator<Item = &Kitap> + '_` yazmak gerekirdi; eski kodlarda bu `+ '_` ekini sık görürsün.
:::

```fill
prompt: |
  `successors` ile, 100.000 TL'lik bir yatırımın her yıl %10 büyüdüğü yılları üret ve **ilk kez 150.000'i
  geçtiği** yılın değerini bul. Program `Some(161051)` yazdırmalı.
code: |
  fn main() {
      let ilk_gecen = std::iter::successors(Some(100_000u64), |&para| ___0(para + para / 10))
          .___1(|&para| para > 150_000);
      println!("{ilk_gecen:?}");
  }
blanks:
  - ["Some"]
  - ["find"]
output: Some(161051)
explanation: |
  `successors`'ın kuralı bir `Option` döndürür: `Some(sonraki)` devam, `None` bitiş. Burada kural hiç `None`
  döndürmüyor - iterator **sonsuz**! Ama `find` kısa devre yaptığı için sorun yok: 100.000 → 110.000 →
  121.000 → 133.100 → 146.410 → **161.051**'de durur. `find` yerine `filter(...).collect()` yazsaydın
  program hiç bitmezdi (sonunda taşma paniğiyle çökerdi).
```

## Sıfır maliyet: iterator'lar döngüden yavaş mı?

Bu kadar closure, adaptör, iç içe struct... Elle yazılmış bir `for` döngüsünden daha yavaş olmalı, değil mi?
C++'ın yaratıcısı Bjarne Stroustrup'un **sıfır maliyetli soyutlama (zero-cost abstraction)** ilkesi
şöyle özetlenebilir: *kullanmadığın şeyin bedelini ödemezsin; kullandığın şeyi de elle daha iyi
yazamazdın.* Rust'ın iterator'ları bu ilkenin ders kitabı örneğidir.

Aynı hesabı (ağırlıklı not ortalaması) iki şekilde yazalım:

```rust
fn agirlikli_indeksle(notlar: &[u32], agirliklar: &[u32]) -> u32 {
    let mut toplam = 0;
    for i in 0..notlar.len() {
        toplam += notlar[i] * agirliklar[i]; // her erişimde sınır kontrolü
    }
    toplam
}

fn agirlikli_iteratorle(notlar: &[u32], agirliklar: &[u32]) -> u32 {
    notlar.iter().zip(agirliklar).map(|(n, a)| n * a).sum()
}

fn main() {
    let notlar = [80, 95, 70];
    let agirliklar = [30, 50, 20];
    println!("{}", agirlikli_indeksle(&notlar, &agirliklar) / 100);
    println!("{}", agirlikli_iteratorle(&notlar, &agirliklar) / 100);
}
```

Optimizasyonla (`cargo build --release`) derlendiğinde iterator sürümü en az indeksli sürüm kadar hızlıdır;
çoğu zaman **daha hızlı**. Neden?

1. **Satır içi açma (inlining)**: Önceki derste gördüğün gibi `Zip<Map<...>>` gibi zincirlerin tipi derleme
   anında tamamen bilinir; closure'lar da birer tiptir (Modül 11'deki monomorphization). Derleyici bütün
   zinciri **tek bir düz döngüye** açabilir; ortada ne fonksiyon çağrısı ne de dinamik dispatch kalır.
2. **Sınır kontrolünün kalkması (bounds-check elimination)**: `notlar[i]` her seferinde `i < len` kontrolü
   yapar, çünkü yanlış bir indeks panik demektir (Modül 9). Iterator ise dilimin sonunu zaten bildiği için
   "dışarı taşma" ihtimali yoktur; kontrol gereksizdir. Üstelik indeksli sürümde `agirliklar` daha kısaysa
   panik olur, iterator sürümünde `zip` kısa olanda durur.
3. **Vektörleştirme (SIMD)**: Düz, kontrolsüz bir döngü, işlemcinin aynı anda birden çok sayıyı işleyen
   komutlarına (SIMD) çevrilmeye çok daha uygundur.

Rust Book, bir romanın tam metninde kelime arayan iki programı karşılaştırır: döngülü ve iterator'lı
sürümlerin süreleri neredeyse aynı çıkar, iterator'lı olan hatta biraz daha hızlıdır. Aynı kitap bir ses
çözücünün iç döngüsünü inceler: `zip`/`map`/`sum` zinciri, döngüsü tamamen açılmış (unrolled) makine koduna
dönüşür.

:::warning Debug modda ölçme
Debug derlemede (`cargo run`) optimizasyon kapalıdır; satır içi açma yapılmaz ve iterator zincirleri gerçekten
yavaş görünebilir. Performans karşılaştırmasını **her zaman `--release`** ile yap (Modül 1). Debug modda
ölçüp "iterator'lar yavaş" sonucuna varmak çok yaygın bir hatadır.
:::

```quiz
question: |
  `for i in 0..v.len() { toplam += v[i]; }` yerine `v.iter().sum()` yazmanın performans açısından en
  önemli avantajı nedir?
options:
  - "Iterator'lar çöp toplayıcıyı devre dışı bırakır"
  - "Iterator sınırları zaten bildiği için her erişimdeki sınır kontrolü (ve panik ihtimali) ortadan kalkar; derleyici döngüyü daha iyi optimize eder"
  - "`sum` başka bir thread'de paralel çalışır"
  - "Iterator sürümü vektörü kopyalayıp önbelleğe alır"
answer: 1
explanation: |
  `v[i]` her seferinde `i < v.len()` kontrolü yapmak zorundadır. Iterator'da elemanlara güvenli bir
  şekilde sırayla erişildiği bilindiğinden bu kontrol gerekmez ve derleyici döngüyü açma, vektörleştirme
  gibi optimizasyonları daha rahat uygular.
feedback:
  - Rust'ta çöp toplayıcı yok (Modül 4); maliyet başka yerden geliyor.
  - Doğru!
  - "Standart `sum` tek thread'de çalışır; paralellik için `rayon` gibi crate'ler var (Modül 18)."
  - Hiçbir kopyalama yapılmaz; `iter()` sadece ödünç alır.
```

## Döngüden boru hattına: ve ne zaman yapmamalı

Tipik bir "biriktirici döngü"yü adım adım boru hattına çevirelim. Görev: aktif kullanıcıların e-postalarını
küçük harfe çevirip listelemek.

```rust
struct Kullanici {
    eposta: String,
    aktif: bool,
}

fn main() {
    let kullanicilar = vec![
        Kullanici { eposta: String::from("Ayse@Ornek.com"), aktif: true },
        Kullanici { eposta: String::from("mehmet@ornek.com"), aktif: false },
        Kullanici { eposta: String::from("ZEYNEP@ornek.com"), aktif: true },
    ];

    // Önce: değişken oluştur, döngüde koşula bak, dönüştür, ekle
    let mut liste1 = Vec::new();
    for k in &kullanicilar {
        if k.aktif {
            liste1.push(k.eposta.to_lowercase());
        }
    }

    // Sonra: her satır bir adım - "aktifleri süz, küçült, topla"
    let liste2: Vec<String> = kullanicilar
        .iter()
        .filter(|k| k.aktif)
        .map(|k| k.eposta.to_lowercase())
        .collect();

    assert_eq!(liste1, liste2);
    println!("{liste2:?}");
}
```

Boru hattı sürümünün avantajları: `mut` değişken yok, niyet satır satır okunuyor, adım eklemek/çıkarmak kolay
(ör. `.take(10)` ekle). Ama her döngü boru hattı olmamalı. Şu örneğe bak:

```rust
fn main() {
    let olcumler = [12, -3, 25, 7, 31, 0, 18];

    // "Zekice" ama okunması zor: tek fold'da min, max, toplam ve pozitif sayısı
    let (min, max, toplam, pozitif) = olcumler.iter().fold(
        (i32::MAX, i32::MIN, 0, 0),
        |(mn, mx, t, p), &x| (mn.min(x), mx.max(x), t + x, if x > 0 { p + 1 } else { p }),
    );
    println!("{min} {max} {toplam} {pozitif}");

    // Açık bir döngü aynı işi daha anlaşılır yapıyor
    let (mut min, mut max, mut toplam, mut pozitif) = (i32::MAX, i32::MIN, 0, 0);
    for &x in &olcumler {
        min = min.min(x);
        max = max.max(x);
        toplam += x;
        if x > 0 {
            pozitif += 1;
        }
    }
    println!("{min} {max} {toplam} {pozitif}");
}
```

Döngünün genellikle daha iyi olduğu durumlar:

- **Birden çok sonuç** aynı geçişte hesaplanıyorsa (yukarıdaki gibi).
- Gövde **yan etkilerle** dolu ise (yazdırma, birden çok dış değişkeni güncelleme, karmaşık `break`/`continue`).
- Closure'lar uzayıp zincir 5-6 adımı geçiyorsa ve ara adımlara isim vermek gerekiyorsa.
- Komşu elemanlara karmaşık indeks hesaplarıyla erişiliyorsa (basit durumlar için `windows` var).

Altın kural: **performans iki yolda da aynı; okunabilirliğe göre seç.**

```quiz
question: Aşağıdaki görevlerden hangisi büyük olasılıkla **açık bir `for` döngüsüyle** daha okunaklı yazılır?
options:
  - Bir listedeki boş olmayan satırları kırpıp yeni bir `Vec<String>`'e toplamak
  - Bir vektördeki sayıların karelerinin toplamını bulmak
  - "Bir dosyanın satırlarını gezerken satır numarasını, en uzun satırı, boş satır sayısını ve toplam kelime sayısını aynı anda güncellemek"
  - Bir listede koşulu sağlayan ilk elemanın indeksini bulmak
answer: 2
explanation: |
  Dört ayrı sonucu tek geçişte güncellemek bir `fold`'u dört elemanlı bir tuple'la boğar. Diğerleri tek bir
  sonuca giden doğrusal dönüşümler: `filter`/`map`/`collect`, `map`/`sum` ve `position` bunları tek satırda
  ve daha okunaklı ifade eder.
feedback:
  - "`filter(...).map(...).collect()` bunu çok net ifade eder."
  - "`v.iter().map(|x| x * x).sum::<i32>()`, tek satır, tek niyet."
  - Doğru! Çok sonuçlu, çok durumlu işler döngüde daha okunaklıdır.
  - "`position` tam olarak bunun için var."
```

````exercise
id: m14-e-bulten-listesi
title: E-bülten gönderim listesi
difficulty: 3
prompt: |
  Aşağıdaki döngülü fonksiyonu **döngüsüz**, tek bir iterator boru hattıyla yeniden yaz (yorumdaki kod mevcut
  davranış; aynı sonucu üretmelisin):

  ```text
  let mut sonuc = Vec::new();
  for k in kullanicilar {
      if k.aktif && k.eposta.contains('@') {
          sonuc.push(k.eposta.trim().to_lowercase());
          if sonuc.len() == limit { break; }
      }
  }
  sonuc
  ```

  Yani: aktif **ve** e-postasında `@` olan kullanıcıların e-postalarını, boşlukları kırpılmış ve küçük
  harfe çevrilmiş olarak, sırayı koruyarak **en fazla `limit` tane** döndür.
starter: |
  struct Kullanici {
      eposta: String,
      aktif: bool,
  }

  fn bulten_listesi(kullanicilar: &[Kullanici], limit: usize) -> Vec<String> {
      todo!()
  }

  fn main() {
      let k = vec![
          Kullanici { eposta: String::from(" Ayse@Ornek.com "), aktif: true },
          Kullanici { eposta: String::from("gecersiz-adres"), aktif: true },
      ];
      println!("{:?}", bulten_listesi(&k, 5));
  }
solution: |
  struct Kullanici {
      eposta: String,
      aktif: bool,
  }

  fn bulten_listesi(kullanicilar: &[Kullanici], limit: usize) -> Vec<String> {
      kullanicilar
          .iter()
          .filter(|k| k.aktif && k.eposta.contains('@'))
          .map(|k| k.eposta.trim().to_lowercase())
          .take(limit)
          .collect()
  }

  fn main() {
      let k = vec![
          Kullanici { eposta: String::from(" Ayse@Ornek.com "), aktif: true },
          Kullanici { eposta: String::from("gecersiz-adres"), aktif: true },
      ];
      println!("{:?}", bulten_listesi(&k, 5));
  }
check: tests
tests: |
  fn k(eposta: &str, aktif: bool) -> Kullanici {
      Kullanici { eposta: eposta.to_string(), aktif }
  }

  fn ornek() -> Vec<Kullanici> {
      vec![
          k(" Ayse@Ornek.com ", true),
          k("mehmet@ornek.com", false),
          k("gecersiz-adres", true),
          k("ZEYNEP@ornek.com", true),
          k("can@ornek.com", true),
      ]
  }

  #[test]
  fn suzer_ve_bicimlendirir() {
      assert_eq!(
          bulten_listesi(&ornek(), 10),
          vec!["ayse@ornek.com", "zeynep@ornek.com", "can@ornek.com"],
          "pasif ve @ içermeyenler atılmalı; e-postalar kırpılıp küçültülmeli; sıra korunmalı"
      );
  }

  #[test]
  fn limit_uygulanir() {
      assert_eq!(bulten_listesi(&ornek(), 2), vec!["ayse@ornek.com", "zeynep@ornek.com"], "en fazla 2 adres");
  }

  #[test]
  fn limit_sifir() {
      assert!(bulten_listesi(&ornek(), 0).is_empty(), "limit 0 ise liste boş");
  }

  #[test]
  fn bos_girdi() {
      assert!(bulten_listesi(&[], 3).is_empty());
  }
hints:
  - "Adımları sırala: süz (`filter`), dönüştür (`map`), sınırla (`take`), topla (`collect`)."
  - "`filter(|k| k.aktif && k.eposta.contains('@'))` iki koşulu birden kontrol eder."
  - "`.map(|k| k.eposta.trim().to_lowercase()).take(limit).collect()`, `take`'i `filter`'dan **sonra** koymalısın; yoksa geçersiz adresler de limitten yer."
forbid:
  - pattern: "\\bfor\\b|\\bwhile\\b|\\bloop\\b"
    message: "Bu alıştırmada döngü yazmadan, boru hattıyla çöz."
require:
  - pattern: "\\.take\\("
    message: "Limiti `take` ile uygula."
explanation: |
  Döngüdeki her yapı bir adaptöre karşılık geliyor: `if` → `filter`, `push(dönüştürülmüş)` → `map`,
  `if len == limit { break }` → `take(limit)`, `Vec::new()` + `push` → `collect`. Tembellik sayesinde
  `take` limiti doldurduğu anda zincir durur; kalan kullanıcılara hiç bakılmaz - tıpkı döngüdeki `break` gibi.

  Adaptörlerin **sırası** anlamı değiştirir: `take(limit)`'i `filter`'dan önce koysaydın "ilk `limit`
  kullanıcıdan uygun olanlar" anlamına gelirdi; `limit_uygulanir` testi bu farkı yakalar.
````

## Özet

:::remember
- Kendi iterator'ın: bir struct (durum) + `impl Iterator { type Item = T; fn next(&mut self) -> Option<T> }`. `Item` unutulursa **E0046**.
- `next`'i yazınca 70+ varsayılan metot (adaptör ve tüketici) bedava gelir; `for` döngüsü de çalışır.
- Bir iterator `None` döndürmek zorunda değildir: sonsuz iterator'ları `take`, `take_while` ya da kısa devre yapan tüketicilerle sınırla.
- Struct'sız iterator: `std::iter::from_fn(FnMut closure)`, `std::iter::successors(başlangıç, kural)`.
- Iterator döndürmek: `fn f(&self) -> impl Iterator<Item = &T>` (edition 2024 yaşam süresini kendisi yakalar).
- **Sıfır maliyet**: iterator zincirleri `--release`'de elle yazılmış döngü kadar (çoğu zaman daha) hızlıdır: inlining, sınır kontrolünün kalkması, SIMD.
- Döngü ↔ boru hattı seçimi performans değil **okunabilirlik** meselesidir; çok sonuçlu, yan etkili işlerde döngü daha iyidir.
:::

```reflect
prompt: |
  Bir iş arkadaşın "iterator zincirleri güzel ama yavaştır, sıcak döngülerde indeksle yazalım" diyor.
  Ona ne cevap verirsin? Hangi ölçüm hatasına karşı uyarırsın?
answer: |
  Rust'ta iterator'lar sıfır maliyetli soyutlamalardır: zincirin tipi derleme anında tamamen bilindiği için
  derleyici closure'ları ve adaptörleri satır içi açarak tek bir düz döngü üretir. Üstelik iterator'lar
  sınırları zaten bildiğinden, indeksli erişimdeki her adımdaki sınır kontrolü kalkar ve döngü vektörleştirmeye
  daha uygun hâle gelir; bu yüzden iterator sürümü çoğu zaman eşit ya da daha hızlıdır. Ölçüm yaparken
  mutlaka `--release` ile derlemek gerekir: debug modda optimizasyon kapalı olduğu için zincirler yapay olarak
  yavaş görünür. Karar performansa değil okunabilirliğe göre verilmeli; gerçekten şüphe varsa release
  modda ölçülmeli.
```

```flashcards
- front: "Bir struct için `Iterator` uygularken yazman gereken iki şey nedir?"
  back: "`type Item = ...;` ve `fn next(&mut self) -> Option<Self::Item>`. Gerisi varsayılan metotlardır."
- front: "`impl Iterator for T` bloğunda `type Item` unutulursa hangi hata alınır?"
  back: "E0046: *not all trait items implemented, missing: `Item`*."
- front: Kendi iterator'ının neden `map`, `filter`, `sum` gibi metotları otomatik olarak vardır?
  back: "Bunlar `Iterator` trait'inin sadece `next`'i kullanan varsayılan metotlarıdır (Modül 11)."
- front: "Sonsuz bir iterator'da `filter(...).collect()` neden tehlikelidir?"
  back: "`filter` hiç durmaz, `collect` sonsuza kadar bekler. `take`, `take_while` ya da `find` gibi sınırlayan/kısa devre yapan bir adım gerekir."
- front: "`std::iter::from_fn` ne alır, ne verir?"
  back: "Bir `FnMut() -> Option<T>` closure'ı alır; her `next()`'te onu çağıran bir iterator verir. `None` dönünce biter."
- front: "Iterator zincirleri neden indeksli döngüden yavaş değildir? (iki neden)"
  back: "Derleyici zinciri satır içi açıp tek döngüye çevirir (monomorphization + inlining) ve iterator sınırları bildiği için indekslemedeki sınır kontrolleri kalkar."
- front: Iterator performansını ölçerken en sık yapılan hata nedir?
  back: "Debug modda ölçmek. Optimizasyonlar yalnızca `--release`'de açıktır."
```
