---
id: m14-l02
title: Fn, FnMut, FnOnce ve move
minutes: 20
type: lesson
objectives:
  - "Bir closure'ın `Fn`, `FnMut` ya da `FnOnce` olduğunu gövdesine bakarak söyleyebilmek"
  - "Closure alan fonksiyonlar için doğru sınırı (`F: Fn(i32) -> i32`, `impl FnMut()`, `FnOnce`) seçebilmek"
  - "`move` anahtar kelimesinin ne yaptığını ve ne zaman gerektiğini (E0373) açıklayabilmek"
  - "`impl Fn` ile closure döndürebilmek; `Box<dyn Fn>` ve `fn` işaretçilerinin ne zaman devreye girdiğini bilmek"
keywords: [Fn, FnMut, FnOnce, move, E0373, E0525, closure döndürmek, "impl Fn", "Box<dyn Fn>", fn pointer]
---

Önceki derste bir closure'ın ortamı üç biçimde yakaladığını gördük: `&T`, `&mut T`, `T`. Ama bir closure'ı
**başka bir fonksiyona** verirken o fonksiyon şunu bilmek ister: *"Bu closure'ı kaç kez, hangi koşullarda
çağırabilirim?"* Rust bu soruyu üç trait ile yanıtlar: **`Fn`**, **`FnMut`** ve **`FnOnce`**. Bu ders
closure'ları gerçekten anladığın derstir; Modül 18'de thread'lere geçtiğinde burada öğrendiğin her şeyi
kullanacaksın.

## Üç trait: closure yakaladığına ne yapıyor?

Derleyici her closure'a, gövdesinin yakaladığı değerlerle **ne yaptığına** bakarak bu trait'lerden bir
ya da birkaçını otomatik olarak uygular:

| trait | gövde yakaladıklarına ne yapıyor? | kaç kez çağrılabilir? | çağrı sırasında kendisi |
|---|---|---|---|
| `FnOnce` | sahipliğini **dışarı taşıyabilir** (tüketir) | **en az** bir kez garanti, belki sadece bir | `self` (tükenir) |
| `FnMut` | **değiştirebilir** ama tüketmez | defalarca | `&mut self` |
| `Fn` | sadece **okur** (ya da hiçbir şey yakalamaz) | defalarca, hatta aynı anda | `&self` |

Bu üçü iç içe geçer:

```text
   ┌──────────────── FnOnce ─────────────────┐   her closure en az bir kez çağrılabilir
   │   ┌──────────── FnMut ─────────────┐    │   tüketmeyenler tekrar tekrar çağrılabilir
   │   │   ┌──────── Fn ────────┐       │    │   değiştirmeyenler paylaşılarak çağrılabilir
   │   │   │  |x| x + esik       │       │    │
   │   │   └─────────────────────┘       │    │
   │   │   || sayac += 1                 │    │
   │   └─────────────────────────────────┘    │
   │   || { let s = mesaj; s }                │
   └──────────────────────────────────────────┘
```

Her `Fn` aynı zamanda bir `FnMut`'tır, her `FnMut` aynı zamanda bir `FnOnce`'tır. Mantığı basit: sadece okuyan
bir closure'ı "değiştirme izni olan" birine vermekte sakınca yoktur, izni kullanmaz. Ama tüketen bir
closure'ı "iki kez çağıracağım" diyen birine veremezsin.

:::analogy Ödünç alınan kitap
Bir arkadaşın sana bir kitap emanet etti. Kitapla üç şey yapabilirsin:
**okumak** (`Fn`), kitap aynı kalır, istediğin kadar okursun, aynı anda başkası da omzunun üstünden okuyabilir;
**kenarına not almak** (`FnMut`), kitap değişir, yine defalarca yapabilirsin ama o sırada başkası elleyemez;
**birine hediye etmek** (`FnOnce`), kitap senden çıkar, bunu ancak **bir kez** yapabilirsin.
Closure'ın hangi trait'i taşıdığını belirleyen şey de budur: yakaladıklarıyla ne yapıyor?
:::

:::warning En sık karışıklık: yakalama biçimi ≠ trait
Trait'i belirleyen yakalama biçimi değil, **gövdenin ne yaptığıdır**. Bir değeri sahiplenerek yakalayan
(`move`) bir closure, o değeri sadece okuyorsa yine **`Fn`**'dir ve defalarca çağrılabilir. `FnOnce` olmak
için gövdenin yakalanan değeri **dışarı taşıması** (döndürmesi, başka bir değişkene vermesi, tüketen bir
fonksiyona geçirmesi) gerekir.
:::

```quiz
question: |
  `let ad = String::from("Ece"); let mut n = 0;` tanımlarından sonra yazılan aşağıdaki closure'lardan hangisi
  **yalnızca** `FnOnce`'tır (yani `FnMut` ve `Fn` değildir)?
options:
  - "`|| println!(\"{ad}\")`"
  - "`|| n += 1`"
  - "`|| ad`"
  - "`|| ad.len()`"
answer: 2
explanation: |
  `|| ad` gövdesi `ad`'ı **döndürüyor**, yani sahipliğini dışarı taşıyor. İkinci kez çağrılsa döndürecek
  bir `ad` kalmazdı; bu yüzden yalnızca `FnOnce`. `println!` ve `.len()` sadece okur (`Fn`), `n += 1`
  değiştirir (`FnMut`).
feedback:
  - "`println!` değeri sadece okur; bu closure `Fn`'dir."
  - "Değiştiren ama tüketmeyen bir closure `FnMut`'tır."
  - Doğru! Yakalanan değeri döndürmek onu tüketir.
  - "`.len()` `&self` alır, okuma yapar; closure `Fn`'dir."
```

## Closure kabul eden fonksiyonlar

Kendi fonksiyonun bir closure almak istiyorsa, onu Modül 11'deki gibi bir **trait sınırıyla** generic
yaparsın. Sınırın yazımı özel: parametre tipleri parantez içinde, dönüş tipi `->` ile.

```rust
// Generic biçim: F, "i32 alıp i32 döndüren ve paylaşılarak çağrılabilen" herhangi bir tip
fn iki_kez_uygula<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 {
    f(f(x))
}

// Kısa biçim (Modül 11'deki `impl Trait` parametresi): anlamı aynı
fn rapor_yaz(baslik: &str, bicimle: impl Fn(u32) -> String) {
    for puan in [45, 78, 92] {
        println!("{baslik}: {}", bicimle(puan));
    }
}

fn main() {
    let artis = 10;
    println!("{}", iki_kez_uygula(|x| x + artis, 1)); // 21
    println!("{}", iki_kez_uygula(|x| x * x, 3)); // 81

    let esik = 50;
    rapor_yaz("Sonuç", |p| if p >= esik { format!("{p} geçti") } else { format!("{p} kaldı") });
}
```

Peki gövdesi `f`'i defalarca çağıran bir fonksiyona **değiştiren** bir closure verirsek? Tahmin et:

```compiles
code: |
  fn tekrarla<F: Fn()>(n: u32, f: F) {
      for _ in 0..n {
          f();
      }
  }

  fn main() {
      let mut sayac = 0;
      tekrarla(3, || sayac += 1);
      println!("{sayac}");
  }
answer: false
error: E0594
explanation: |
  `tekrarla` `F: Fn()` istiyor: "closure'ı **paylaşarak** (`&self`) çağıracağım." Ama `|| sayac += 1`
  yakaladığını değiştiriyor, yani en fazla `FnMut`. Çözüm sınırı gevşetmek: `F: FnMut()` ve parametreyi
  `mut f: F` yapmak (çağırmak closure'ı değiştirdiği için).
```

:::error
```text
error[E0594]: cannot assign to `sayac`, as it is a captured variable in a `Fn` closure
 --> src/main.rs:9:20
  |
1 | fn tekrarla<F: Fn()>(n: u32, f: F) {
  |                                 - change this to accept `FnMut` instead of `Fn`
...
8 |     let mut sayac = 0;
  |         --------- `sayac` declared here, outside the closure
9 |     tekrarla(3, || sayac += 1);
  |     --------    -- ^^^^^^^^^^ cannot assign
  |     |           |
  |     |           in this closure
  |     expects `Fn` instead of `FnMut`
```
Derleyici çözümü doğrudan söylüyor: *"change this to accept `FnMut` instead of `Fn`"*. Hata closure'ın
içinde görünse de asıl karar **fonksiyon imzasında**: imza ne kadar katıysa, çağıranlar o kadar az şey verebilir.
:::

Düzeltilmiş hâli:

```rust
fn tekrarla<F: FnMut()>(n: u32, mut f: F) {
    for _ in 0..n {
        f();
    }
}

fn main() {
    let mut sayac = 0;
    tekrarla(3, || sayac += 1);
    println!("sayaç: {sayac}");

    // Fn olan bir closure da FnMut isteyen yere verilebilir:
    tekrarla(2, || println!("merhaba"));
}
```

### Hangi sınırı seçmeli?

Fonksiyonu **yazan** sen olduğunda kural şu: **closure'la ne yapacaksan en gevşek olanı iste.**

| closure'ı nasıl çağıracaksın? | iste | kabul edilenler |
|---|---|---|
| en fazla bir kez | `FnOnce` | **her** closure (en esnek) |
| defalarca, sırayla | `FnMut` | değiştiren ve okuyan closure'lar |
| defalarca, paylaşarak (ör. aynı anda birden çok yerden) | `Fn` | yalnızca okuyanlar (en katı) |

Standart kütüphane bu kuralı izler: `Option::unwrap_or_else` closure'ı en fazla bir kez çağırır, o yüzden
`FnOnce` ister. `sort_by_key` ve `retain` her eleman için çağırır, `FnMut` ister. Bu sayede `sort_by`'a
karşılaştırma sayan bir closure bile verebilirsin:

```rust
fn main() {
    let mut puanlar = vec![88, 42, 97, 65, 71, 30];
    let mut karsilastirma = 0;

    puanlar.sort_by(|a, b| {
        karsilastirma += 1; // FnMut: dış değişkeni değiştiriyor
        b.cmp(a) // büyükten küçüğe
    });

    println!("{puanlar:?}");
    println!("{karsilastirma} karşılaştırma yapıldı");
}
```

```fill
prompt: |
  `ortalama_hesapla` bir closure alıp her notu ona dönüştürterek ortalamayı hesaplıyor. Modül 11'deki
  `where` cümlesini kullanarak sınırı tamamla: closure bir `u32` alıp `u32` döndürmeli ve defalarca,
  **paylaşılarak** çağrılabilmeli.
code: |
  fn ortalama_hesapla<F>(notlar: &[u32], donustur: F) -> u32
  where
      F: ___0(u32) -> ___1,
  {
      let mut toplam = 0;
      for n in notlar {
          toplam += donustur(*n);
      }
      toplam / notlar.len() as u32
  }

  fn main() {
      let bonus = 5;
      let notlar = [70, 80, 90];
      println!("{}", ortalama_hesapla(&notlar, |n| (n + bonus).min(100)));
  }
blanks:
  - ["Fn"]
  - ["u32"]
output: "85"
explanation: |
  Closure trait'lerinin sınır sözdizimi `Fn(ParametreTipleri) -> DönüşTipi` biçimindedir. Gövde
  `donustur`'u defalarca çağırıyor ama değiştirmiyor; `Fn` yeterli. (`FnMut` de derlenirdi ama o zaman
  parametrenin `mut donustur: F` olması gerekirdi.) `where` cümlesi uzun sınırları imzanın dışına
  alarak okunaklılık sağlar.
```

## FnOnce: bir kez çağrılabilen closure

Tüketen bir closure'ı iki kez çağırmayı deneyelim:

```compiles
code: |
  fn main() {
      let mesaj = String::from("selam");
      let tuket = || mesaj;
      let a = tuket();
      let b = tuket();
      println!("{a} {b}");
  }
answer: false
error: E0382
explanation: |
  `|| mesaj` gövdesi `mesaj`'ı döndürüyor, yani sahipliğini çağırana veriyor. İlk çağrıdan sonra
  closure'ın içinde verecek bir `String` kalmıyor. Derleyici bunu closure'ın kendisinin **çağrı sırasında
  taşınması** olarak modeller: `FnOnce::call_once(self)` closure'ı tüketir.
```

:::error
```text
error[E0382]: use of moved value: `tuket`
 --> src/main.rs:5:13
  |
4 |     let a = tuket();
  |             ------- `tuket` moved due to this call
5 |     let b = tuket();
  |             ^^^^^ value used here after move
  |
note: closure cannot be invoked more than once because it moves the variable `mesaj` out of its environment
 --> src/main.rs:3:20
  |
3 |     let tuket = || mesaj;
  |                    ^^^^^
note: this value implements `FnOnce`, which causes it to be moved when called
 --> src/main.rs:4:13
  |
4 |     let a = tuket();
  |             ^^^^^
```
Tanıdık E0382, taşınmış bir değerin kullanımı. Bu kez taşınan şey **closure'ın kendisi**. İki `note`
satırı nedenini anlatır: closure `mesaj`'ı ortamından dışarı taşıdığı için `FnOnce`'tır ve `FnOnce`
closure'lar çağrıldıklarında tükenir.
:::

Aynı sorun, tüketen bir closure'ı `Fn` isteyen bir fonksiyona verdiğinde de çıkar, bu kez hata kodu farklı:

```rust,compile_fail,E0525
fn iki_kez<F: Fn()>(f: F) {
    f();
    f();
}

fn main() {
    let rapor = String::from("Q3 raporu");
    let gonder = || {
        let giden = rapor;
        println!("gönderildi: {giden}");
    };
    iki_kez(gonder);
}
```

:::error
```text
error[E0525]: expected a closure that implements the `Fn` trait, but this closure only implements `FnOnce`
  --> src/main.rs:8:18
   |
 8 |     let gonder = || {
   |                  ^^ this closure implements `FnOnce`, not `Fn`
 9 |         let giden = rapor;
   |                     ----- closure is `FnOnce` because it moves the variable `rapor` out of its environment
...
12 |     iki_kez(gonder);
   |     ------- ------ the requirement to implement `Fn` derives from here
```
Okuma rehberi: *"this closure implements `FnOnce`, not `Fn`"* → **ne** sorun; *"closure is `FnOnce` because
it moves..."* → **neden**; *"the requirement ... derives from here"* → kim istiyor. Çözüm ya fonksiyonun
`FnOnce` kabul etmesi (bir kez çağırıyorsa) ya da closure'ın tüketmek yerine ödünç alması (`&rapor`)
ya da gerçekten iki kopya gerekiyorsa `rapor.clone()`.
:::

`FnOnce` kötü bir şey değildir; bazı işler doğası gereği tek seferliktir: bir mesajı göndermek, bir
kaynağı devretmek, bir thread'e iş vermek. `FnOnce` isteyen bir API, çağıranlara "istediğin her şeyi
verebilirsin, ben zaten bir kez çağıracağım" demiş olur.

## move: sahipliği zorla

Bazen closure gövdesi bir değeri sadece okuduğu hâlde, closure'ın o değeri **sahiplenmesini** istersin.
Bunun için parametre listesinin önüne **`move`** yazarsın. Önce şaşırtıcı bir örnek; tahmin et:

```predict
code: |
  fn main() {
      let mut sayi = 5;
      let mut ekle = move || {
          sayi += 1;
          println!("closure içinde: {sayi}");
      };
      ekle();
      ekle();
      println!("dışarıda: {sayi}");
  }
options:
  - |
    closure içinde: 6
    closure içinde: 7
    dışarıda: 7
  - |
    closure içinde: 6
    closure içinde: 7
    dışarıda: 5
  - |
    closure içinde: 6
    closure içinde: 6
    dışarıda: 5
  - Derlenmez
answer: 1
explanation: |
  `move` closure'ı `sayi`'yı **değeriyle** yakalamaya zorlar. `i32` `Copy` olduğu için "değeriyle yakalamak"
  **kopyalamak** demektir: closure'ın içinde kendine ait bir `sayi` (5) vardır. Closure kendi kopyasını
  değiştirir (6, 7) ve bu kopya çağrılar arasında closure'ın içinde yaşar. Dışarıdaki `sayi` hiç
  değişmez: 5. Closure, kendi alanını değiştirdiği için `FnMut`'tır (ve `let mut ekle` gerekir).
```

`Copy` olmayan bir tipte ise `move` gerçekten **taşır**:

```rust
fn main() {
    let sehir = String::from("Trabzon");
    let selamla = move || println!("{sehir}'dan selamlar!");

    selamla();
    selamla(); // move olsa da sadece okuyor → Fn, defalarca çağrılabilir
    // println!("{sehir}"); // ← E0382: sehir closure'a taşındı
}
```

```memory
title: move closure ve Copy olmayan tip
steps:
  - caption: "`sehir` heap'teki karakterlerin sahibi."
    stack:
      - frame: main
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "T r a b z o n" }
  - caption: "`move ||` String başlığını closure'ın içine taşır. `sehir` geçersiz; heap verisinin yeni sahibi closure."
    stack:
      - frame: main
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", moved: true, note: taşındı }
          - { name: selamla, type: closure, value: "{ sehir: String }", to: h1 }
    heap:
      - { id: h1, value: "T r a b z o n" }
  - caption: "`main` bitince `selamla` drop edilir; içindeki `String` ile birlikte heap belleği serbest kalır."
    stack:
      - frame: main
        vars:
          - { name: selamla, type: closure, value: "(drop edildi)", moved: true }
    heap:
      - { id: h1, value: "T r a b z o n", freed: true }
```

### `move` ne zaman gerekir?

Closure, yakaladığı değişkenlerden **daha uzun yaşayacaksa**. Referansla yakalanan bir değişken kapsamdan
çıktığında closure'ın elindeki referans sarkardı (Modül 5), Rust buna izin vermez. İki tipik durum:

1. **Closure'ı bir fonksiyondan döndürmek**, yerel değişkenler fonksiyon bitince yok olur ("Closure döndürmek" bölümünde).
2. **Closure'ı başka bir thread'e vermek**, thread, onu başlatan fonksiyondan uzun yaşayabilir.
   `std::thread::spawn(move || ...)` kalıbını Modül 18'de çok göreceksin.

İki kopya gerekiyorsa yaygın kalıp, `move`'dan **önce** klonlamaktır:

```rust
fn main() {
    let rapor = String::from("Q3 raporu");
    let rapor_kopya = rapor.clone();
    let arsivle = move || println!("arşivlendi: {rapor_kopya}");

    arsivle();
    println!("orijinal hâlâ bende: {rapor}");
}
```

```compiles
code: |
  fn main() {
      let liste = vec![1, 2, 3];
      let goster = move || println!("{liste:?}");
      goster();
      goster();
      println!("{}", liste.len());
  }
answer: false
error: E0382
explanation: |
  `goster` iki kez çağrılabilir - gövde `liste`'yi sadece okuyor, yani closure `Fn`. Sorun son satırda:
  `move` yüzünden `Vec` closure'ın içine **taşındı**, `liste` artık geçersiz. `move` ile `FnOnce`
  karıştırılmamalı: `move` **yakalamayı**, trait ise **gövdeyi** anlatır.
```

## Closure döndürmek

Closure "üreten" fonksiyonlar çok kullanışlıdır: bir kez yapılandırırsın, sonra defalarca kullanırsın.
Her closure'ın kendine özgü, **adı olmayan** bir tipi olduğu için dönüş tipini yazamayız, Modül 11'deki
`-> impl Trait` tam bunun için var:

```compiles
code: |
  fn carpan_uret(k: i32) -> impl Fn(i32) -> i32 {
      |x| x * k
  }

  fn main() {
      let uc_kat = carpan_uret(3);
      println!("{}", uc_kat(5));
  }
answer: false
error: E0373
explanation: |
  Closure `k`'yi sadece okuduğu için onu **referansla** yakalar. Ama `k` `carpan_uret`'in parametresidir ve
  fonksiyon dönünce yok olur; dönen closure sarkan bir referans taşırdı. Çözüm: `move |x| x * k`.
```

:::error
```text
error[E0373]: closure may outlive the current function, but it borrows `k`, which is owned by the current function
 --> src/main.rs:2:5
  |
2 |     |x| x * k
  |     ^^^     - `k` is borrowed here
  |     |
  |     may outlive borrowed value `k`
  |
note: closure is returned here
 --> src/main.rs:2:5
  |
2 |     |x| x * k
  |     ^^^^^^^^^
help: to force the closure to take ownership of `k` (and any other referenced variables), use the `move` keyword
  |
2 |     move |x| x * k
  |     ++++
```
E0373 `move` unutulduğunda gördüğün klasik hatadır. Mesajın başlığı her şeyi söylüyor: *closure, sahibi bu
fonksiyon olan `k`'den uzun yaşayabilir*. `help` satırı da tam çözümü veriyor.
:::

```rust
fn carpan_uret(k: i32) -> impl Fn(i32) -> i32 {
    move |x| x * k
}

fn selamlayici(dil: &str) -> impl Fn(&str) -> String {
    let kalip = if dil == "tr" { "Merhaba" } else { "Hello" };
    move |isim| format!("{kalip}, {isim}!")
}

fn main() {
    let uc_kat = carpan_uret(3);
    let on_kat = carpan_uret(10);
    println!("{} {}", uc_kat(5), on_kat(5));

    let tr = selamlayici("tr");
    println!("{}", tr("Zeynep"));
}
```

### Farklı closure'lar, farklı tipler: `Box<dyn Fn>`'e kısa bakış

`impl Fn` "**tek bir** somut tip döndürüyorum, adını söylemiyorum" demektir (Modül 11'deki kural). Bir `if`'in
iki kolundan iki ayrı closure döndürmeye çalışırsan, gövdeleri aynı olsa bile iki farklı tip olduklarından
derleyici itiraz eder:

:::error
```text
error[E0308]: `if` and `else` have incompatible types
 --> src/main.rs:5:9
  |
2 | /     if carp {
3 | |         move |x| x * k
  | |         --------------
  | |         |
  | |         the expected closure
  | |         expected because of this
4 | |     } else {
5 | |         move |x| x + k
  | |         ^^^^^^^^^^^^^^ expected closure, found a different closure
6 | |     }
  | |_____- `if` and `else` have incompatible types
  |
  = note: no two closures, even if identical, have the same type
  = help: consider boxing your closure and/or using it as a trait object
```
*"no two closures, even if identical, have the same type"*, closure'lar hakkında aklında tutman gereken
cümle bu.
:::

Derleyicinin önerdiği çözüm, closure'ı heap'e koyup **trait nesnesi** olarak döndürmek. Bu bir **önizleme**:
`Box<T>`'yi Modül 17'de, `dyn Trait`'i Modül 20'de ayrıntılı göreceğiz. Şimdilik şöyle oku:
*"`Fn(i32) -> i32` olan herhangi bir şey, heap'te bir kutunun içinde."*

```rust
fn islem_sec(carp: bool, k: i32) -> Box<dyn Fn(i32) -> i32> {
    if carp {
        Box::new(move |x| x * k)
    } else {
        Box::new(move |x| x + k)
    }
}

fn main() {
    // Farklı closure'lar artık aynı tipte: tek bir Vec'e konabilirler
    let islemler = vec![islem_sec(true, 3), islem_sec(false, 10)];
    for f in &islemler {
        println!("{}", f(5));
    }
}
```

Bedeli küçük ama gerçek: bir heap ayırma ve çağrı başına bir dolaylı atlama (dinamik dispatch). `impl Fn`
ise sıfır maliyetlidir. Tek tip yetiyorsa `impl Fn`, gerçekten farklı closure'ları bir arada tutman
gerekiyorsa `Box<dyn Fn>`.

## Fonksiyonlar da closure yerine geçer

Closure isteyen her yere **sıradan bir fonksiyonun adını** da verebilirsin; fonksiyonlar hiçbir şey
yakalamadığı için üç trait'i de uygular:

```rust
fn iki_kat(x: i32) -> i32 {
    x * 2
}

fn uygula(f: impl Fn(i32) -> i32, x: i32) -> i32 {
    f(x)
}

fn main() {
    println!("{}", uygula(iki_kat, 21)); // fonksiyon adı, parantezsiz!
    println!("{}", uygula(|x| x - 1, 21));

    let girdi: Option<String> = None;
    let ad = girdi.unwrap_or_else(String::new); // String::new da bir fonksiyon
    println!("boş mu? {}", ad.is_empty());
}
```

Bir de **fonksiyon işaretçisi (fn pointer)** tipi vardır: `fn(i32) -> i32` (küçük harf `fn`). Bu, trait değil
somut bir tiptir. Hiçbir şey **yakalamayan** closure'lar bu tipe dönüşebilir; yakalayanlar dönüşemez,
çünkü yakaladıkları verinin bir yerde durması gerekir:

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:3:29
  |
3 |     let f: fn(i32) -> i32 = |x| x * k;
  |            --------------   ^^^^^^^^^ expected fn pointer, found closure
  |
note: closures can only be coerced to `fn` types if they do not capture any variables
 --> src/main.rs:3:37
  |
3 |     let f: fn(i32) -> i32 = |x| x * k;
  |                                     ^ `k` captured here
```
:::

Kendi API'nde neredeyse her zaman `impl Fn...` ya da `F: Fn...` iste; böylece hem fonksiyonları hem de
closure'ları kabul edersin. `fn` işaretçileri C kütüphaneleriyle konuşurken ve bazı ileri durumlarda
işe yarar; onları Modül 22'de "İleri fonksiyonlar ve closure'lar" dersinde göreceğiz.

```exercise
id: m14-e-indirim-fabrikasi
title: İndirim fabrikası
difficulty: 3
prompt: |
  Bir market zinciri için iki fonksiyon yaz:

  1. `indirim_olustur(yuzde: u32) -> impl Fn(u32) -> u32` - bir fiyatı alıp **yüzde `yuzde` indirimli**
     fiyatı döndüren bir closure üretir. Hesap tamsayı bölmesiyle: `fiyat * (100 - yuzde) / 100`.
     `yuzde` 100'den büyükse fiyat **0** olmalı (negatif fiyat olmaz, taşma paniği de olmamalı).
  2. `hepsine_uygula<F: Fn(u32) -> u32>(fiyatlar: &mut Vec<u32>, f: F)` - vektördeki **her** fiyatı
     `f`'ten geçirip yerinde günceller.
starter: |
  fn indirim_olustur(yuzde: u32) -> impl Fn(u32) -> u32 {
      // `-> impl Fn` bir closure ister; çıplak todo!() derlenmez.
      // Bu yer tutucu closure'ı kendi closure'ınla değiştir.
      |_fiyat| todo!()
  }

  fn hepsine_uygula<F: Fn(u32) -> u32>(fiyatlar: &mut Vec<u32>, f: F) {
      todo!()
  }

  fn main() {
      let yaz_indirimi = indirim_olustur(20);
      let mut sepet = vec![250, 100, 40];
      hepsine_uygula(&mut sepet, &yaz_indirimi);
      println!("{sepet:?}");
  }
solution: |
  fn indirim_olustur(yuzde: u32) -> impl Fn(u32) -> u32 {
      let kalan_oran = 100u32.saturating_sub(yuzde);
      move |fiyat| fiyat * kalan_oran / 100
  }

  fn hepsine_uygula<F: Fn(u32) -> u32>(fiyatlar: &mut Vec<u32>, f: F) {
      for fiyat in fiyatlar.iter_mut() {
          *fiyat = f(*fiyat);
      }
  }

  fn main() {
      let yaz_indirimi = indirim_olustur(20);
      let mut sepet = vec![250, 100, 40];
      hepsine_uygula(&mut sepet, &yaz_indirimi);
      println!("{sepet:?}");
  }
check: tests
tests: |
  #[test]
  fn yuzde_yirmi_indirim() {
      let f = indirim_olustur(20);
      assert_eq!(f(250), 200, "250'nin %20 indirimlisi 200");
      assert_eq!(f(99), 79, "99 * 80 / 100 = 79 (tamsayı bölmesi)");
  }

  #[test]
  fn sifir_ve_yuz_uzeri() {
      assert_eq!(indirim_olustur(0)(80), 80, "%0 indirim fiyatı değiştirmez");
      assert_eq!(indirim_olustur(100)(80), 0, "%100 indirim fiyatı 0 yapar");
      assert_eq!(indirim_olustur(150)(80), 0, "%100'den büyük indirim de 0 vermeli, panik değil");
  }

  #[test]
  fn hepsine_uygular() {
      let mut v = vec![250, 100, 40];
      hepsine_uygula(&mut v, indirim_olustur(50));
      assert_eq!(v, vec![125, 50, 20], "her fiyat yarıya inmeli");
  }

  #[test]
  fn baska_closure_da_calisir() {
      let mut v = vec![1, 2, 3];
      let zam = 10;
      hepsine_uygula(&mut v, |x| x + zam);
      assert_eq!(v, vec![11, 12, 13], "hepsine_uygula herhangi bir Fn(u32) -> u32 ile çalışmalı");
  }
hints:
  - "Dönen closure `yuzde`'yi (ya da ondan hesapladığın bir değeri) yakalar. Fonksiyon bittikten sonra da yaşayacağı için `move` gerekir (E0373)."
  - "`100 - yuzde` `yuzde > 100` iken taşar ve debug modda panikler. Modül 2'deki `saturating_sub` 0'da durur: `100u32.saturating_sub(yuzde)`."
  - "`hepsine_uygula` içinde `for fiyat in fiyatlar.iter_mut() { *fiyat = f(*fiyat); }`, `iter_mut()` `for x in &mut v` ile aynıdır, bir sonraki derste detaylı göreceğiz."
require:
  - pattern: "move\\s*\\|"
    message: "Dönen closure'ın `yuzde`'yi (ya da türettiğin değeri) sahiplenmesi için `move` kullan."
explanation: |
  `indirim_olustur` bir **closure fabrikası**: oranı bir kez hesaplar (`kalan_oran`) ve onu `move` ile
  sahiplenen bir closure döndürür. Hesabı closure'ın dışında yapmak küçük ama güzel bir optimizasyon:
  `saturating_sub` her çağrıda değil, fabrikada **bir kez** çalışır.

  `main`'deki `hepsine_uygula(&mut sepet, &yaz_indirimi)` çağrısına dikkat: closure'ı **referansla**
  verdik. Standart kütüphane, `F: Fn` olan her `F` için `&F`'nin de `Fn` olduğunu söyler; böylece
  `yaz_indirimi`'ni taşımadan defalarca kullanabiliriz.

  `hepsine_uygula`'nın `F: Fn` istemesi en katı seçenek; gövde `f`'i sırayla çağırdığı için
  `F: FnMut` (ve `mut f: F`) da yeterli olurdu ve çağıranlara daha fazla esneklik verirdi - örneğin
  kaç fiyat güncellendiğini sayan bir closure'ı da kabul ederdi.
```

```exercise
id: m14-e-sira-numaratoru
title: Banka sıra numaratörü
difficulty: 3
prompt: |
  Bankadaki sıra makinesini modelle. `numarator(baslangic, adim)` bir closure döndürsün: closure her
  çağrıldığında **sıradaki numarayı** verir. İlk çağrı `baslangic`'ı, sonrakiler `adim` kadar artan
  değerleri döndürür (100, 105, 110, ...).

  Her numaratör **kendi** durumunu tutmalı: iki ayrı numaratör birbirini etkilememeli.
  Dönüş tipinin `impl FnMut() -> u32` olduğuna dikkat et - neden `Fn` değil?
starter: |
  fn numarator(baslangic: u32, adim: u32) -> impl FnMut() -> u32 {
      // Yer tutucu: bunu durumu hatırlayan bir closure ile değiştir.
      || todo!()
  }

  fn main() {
      let mut gise = numarator(100, 1);
      println!("{} {} {}", gise(), gise(), gise());
  }
solution: |
  fn numarator(baslangic: u32, adim: u32) -> impl FnMut() -> u32 {
      let mut siradaki = baslangic;
      move || {
          let simdiki = siradaki;
          siradaki += adim;
          simdiki
      }
  }

  fn main() {
      let mut gise = numarator(100, 1);
      println!("{} {} {}", gise(), gise(), gise());
  }
check: tests
tests: |
  #[test]
  fn ilk_cagri_baslangic() {
      let mut n = numarator(42, 3);
      assert_eq!(n(), 42, "ilk numara başlangıç değeri olmalı");
  }

  #[test]
  fn adim_adim_artar() {
      let mut n = numarator(100, 5);
      assert_eq!((n(), n(), n()), (100, 105, 110), "her çağrı adım kadar artmalı");
  }

  #[test]
  fn numaratorler_bagimsiz() {
      let mut a = numarator(1, 1);
      let mut b = numarator(500, 10);
      a();
      a();
      assert_eq!(b(), 500, "b'nin durumu a'dan etkilenmemeli");
      assert_eq!(a(), 3, "a kaldığı yerden devam etmeli");
      assert_eq!(b(), 510);
  }
hints:
  - "Closure'ın çağrılar arasında hatırlaması gereken bir durum var: sıradaki numara. Bunu fabrikada `let mut siradaki = baslangic;` ile oluştur."
  - "Closure bu değişkeni sahiplenmeli (fonksiyon bitince yok olacak) → `move || { ... }`. Gövdede önce mevcut değeri sakla, sonra artır, sonra saklananı döndür."
  - "`move || { let simdiki = siradaki; siradaki += adim; simdiki }`, kendi alanını değiştirdiği için closure `FnMut`'tır."
explanation: |
  `move` ile `siradaki` (bir `u32`, yani `Copy`) closure'ın **içine kopyalanır** ve closure'ın kendi alanı
  olur. Her `numarator` çağrısı yeni bir closure ve dolayısıyla **yeni bir alan** üretir; bu yüzden
  numaratörler bağımsızdır. Bu, nesne yönelimli dillerdeki "özel alanı olan bir nesne"nin closure'la
  yapılmış hâlidir - JavaScript'te sayaç fabrikaları tam olarak böyle yazılır.

  `Fn` olamaz çünkü gövde yakaladığı `siradaki`'yi **değiştiriyor**; bunun için closure'ın `&mut self` ile
  çağrılması gerekir. Bu yüzden çağıran tarafta da `let mut gise` yazmak zorundayız.

  Bu desen o kadar yaygın ki standart kütüphanede bir karşılığı var: Modülün son dersinde
  `std::iter::from_fn` ile böyle bir closure'dan doğrudan bir **iterator** üreteceğiz.
```

## Özet

:::remember
- **`FnOnce`**: yakaladığını tüketebilir, bir kez çağrılabilir. **`FnMut`**: değiştirir, tekrar çağrılabilir. **`Fn`**: sadece okur.
- Her `Fn` bir `FnMut`, her `FnMut` bir `FnOnce`'tır. Derleyici trait'i **gövdeden** seçer.
- Fonksiyon yazarken **en gevşek** sınırı iste: bir kez → `FnOnce`, sırayla tekrar → `FnMut`, paylaşarak → `Fn`.
- Sınır sözdizimi: `F: Fn(i32) -> i32`, `impl FnMut()`, `where F: FnOnce() -> String`.
- `move` yakalamayı **değerle** yapmaya zorlar (Copy tipler kopyalanır). Trait'i değiştirmez.
- Closure, yakaladıklarından uzun yaşayacaksa (`return`, thread) `move` gerekir → aksi hâlde **E0373**.
- Closure döndürmek: `-> impl Fn(..)`. Farklı closure'lar farklı tiplerdir → gerekirse `Box<dyn Fn(..)>` (Modül 17/20).
- Closure isteyen yere fonksiyon adı da verilebilir: `unwrap_or_else(String::new)`.
:::

```reflect
prompt: |
  `move` ile oluşturulmuş bir closure neden hâlâ `Fn` olabilir? "Yakalama biçimi" ile "closure'ın
  uyguladığı trait" arasındaki farkı bir örnekle açıkla.
answer: |
  `move` sadece closure'ın değişkenleri **nasıl** yakalayacağını belirler: referans yerine değerin kendisini
  (ya da Copy ise kopyasını) closure'ın içine koyar. Closure'ın hangi trait'i uyguladığını ise gövdenin
  o değerlerle **ne yaptığı** belirler. Örneğin `move || println!("{sehir}")` `sehir`'i sahiplenir ama
  sadece okur; her çağrıda aynı `String`'i okuyabileceği için `Fn`'dir ve istediğin kadar çağrılabilir.
  Gövde `sehir`'i döndürseydi ya da başka bir değişkene taşısaydı, ikinci çağrıda verecek bir şey
  kalmayacağı için ancak `FnOnce` olurdu.
```

```flashcards
- front: "`Fn`, `FnMut`, `FnOnce`, closure'ı hangisi yapan nedir?"
  back: "Gövdenin yakaladıklarıyla ne yaptığı: sadece okursa `Fn`, değiştirirse `FnMut`, dışarı taşırsa (tüketirse) yalnızca `FnOnce`."
- front: Bir fonksiyon closure'ı yalnızca bir kez çağıracaksa hangi sınırı istemeli? Neden?
  back: "`FnOnce`. En gevşek sınırdır; her closure onu uygular, çağıranlara en çok esnekliği verir."
- front: "E0373 hatası ne anlatır, tipik çözümü nedir?"
  back: "Closure, referansla yakaladığı bir değişkenden uzun yaşayabilir (ör. döndürülüyor). Çözüm: `move` ile sahiplenmek."
- front: "`let mut n = 5; let mut f = move || n += 1; f(); f();` sonrası `n` kaçtır?"
  back: "5. `i32` Copy olduğu için `move` bir kopya yakalar; closure kendi kopyasını değiştirir."
- front: "`if` kolları iki farklı closure döndürüyorsa `-> impl Fn(i32) -> i32` neden yetmez?"
  back: "Her closure'ın kendine özgü tipi vardır (*no two closures have the same type*); `impl Trait` tek bir somut tip ister. Çözüm: `Box<dyn Fn(i32) -> i32>`."
- front: "`FnMut` closure alan bir parametre neden `mut f: F` olarak yazılır?"
  back: "`FnMut` closure `&mut self` ile çağrılır; çağırmak closure'ı değiştirir, bu yüzden bağlamanın `mut` olması gerekir."
- front: Hangi closure'lar `fn(i32) -> i32` gibi bir fonksiyon işaretçisine dönüşebilir?
  back: Hiçbir değişken yakalamayanlar. Yakalayan closure'lar dönüşemez (E0308).
```
