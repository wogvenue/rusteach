---
id: m11-l05
title: derive ve standart trait'ler
minutes: 23
type: lesson
objectives:
  - "`#[derive(...)]`'in perde arkasında hangi kodu ürettiğini ve neden her alanın o trait'i uygulaması gerektiğini açıklayabilmek"
  - "`Clone` ile `Copy` arasındaki farkı bellek düzeyinde açıklayabilmek ve bir tipin `Copy` olup olamayacağına karar verebilmek"
  - "`PartialEq`/`Eq` ve `PartialOrd`/`Ord` ayrımını (`f64` ve NaN) ve türetilmiş sıralamanın alan sırasıyla çalıştığını açıklayabilmek"
  - "`Hash` ve `Default`'u türetip `HashMap`/`HashSet` anahtarlarında ve `..Default::default()` ile kullanabilmek"
keywords: [derive, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, NaN, E0204, sözlük sırası, generic derive sınırı]
---

Modül 6'dan beri neredeyse her struct'ın üstüne `#[derive(Debug)]` yazdın ve `{:?}` sihirli bir şekilde
çalıştı. Artık trait'leri bildiğine göre sihri bozabiliriz: `derive`, **senin yerine `impl` bloğu yazan**
bir makrodur. Bu derste standart kütüphanenin türetilebilen dokuz trait'ini, her birinin sana ne kazandırdığını
ve — en az onun kadar önemli — ne zaman türetilemeyeceğini (ya da türetilmemesi gerektiğini) öğreneceksin.

## `derive` perde arkasında ne yazar?

Şu tanımı düşün:

```rust
#[derive(Debug, Clone)]
pub struct Nokta {
    pub x: i32,
    pub y: i32,
}
```

Derleyici `#[derive(Clone)]` satırını gördüğünde senin yerine kabaca şu kodu üretir. Aynısını elle de
yazabilirsin; program birebir aynı çalışır:

```rust
#[derive(Debug)]
struct Nokta {
    x: i32,
    y: i32,
}

// #[derive(Clone)] satırının ürettiği kodun sadeleştirilmiş hâli:
impl Clone for Nokta {
    fn clone(&self) -> Self {
        Nokta {
            x: self.x.clone(),
            y: self.y.clone(),
        }
    }
}

fn main() {
    let a = Nokta { x: 3, y: 4 };
    let b = a.clone();
    println!("{a:?} {b:?}");
}
```

Üretilen koda dikkatle bak: `clone`, **her alanın** kendi `clone`'unu çağırıyor. Türetmenin tek ve en önemli
kuralı buradan çıkar:

> Bir tip bir trait'i ancak **bütün alanları** o trait'i uyguluyorsa türetebilir.

Bu derste göreceğin derive hatalarının neredeyse hepsi bu tek kuralın sonucudur. Türetilebilen standart
trait'ler ve sana kazandırdıkları:

| Trait | Ne kazandırır | Türetilmiş davranış |
|---|---|---|
| `Debug` | `{:?}`, `{:#?}`, `dbg!` | Tip adı + tüm alanlar |
| `Clone` | `.clone()` | Her alanı klonlar |
| `Copy` | Atamada **örtük** kopya | Bit bit kopya (metodu yok) |
| `PartialEq` | `==`, `!=` | Bütün alanlar eşitse eşit |
| `Eq` | “`==` tam bir denkliktir” sözü | Metodu yok |
| `PartialOrd` | `<`, `>`, `<=`, `>=` | Alanlar sırayla, sözlükteki gibi |
| `Ord` | `cmp`, `sort`, `max`, `min` | Aynı sıra; her çift karşılaştırılabilir |
| `Hash` | `HashMap`/`HashSet` anahtarı olmak | Her alanı hash'ler |
| `Default` | `Tip::default()` | Her alan kendi varsayılanını alır |

Listede `Display` yok, çünkü onu türetemezsin: bir tipi kullanıcıya göstermenin tek bir “doğru” biçimi yoktur.
Kendi `Display`'ini 6. derste yazacaksın.

:::info Diğer dillerde
Java'da `equals`, `hashCode` ve `toString`'i elle yazarsın (ya da IDE üretir); `hashCode`'u güncellemeyi
unutursan `HashMap` **sessizce** yanlış çalışır. Python'un `@dataclass`'ı `__eq__` ve `__repr__`'ı sınıf
oluşturulurken, çalışma zamanında üretir. Rust'ın `derive`'ı ise **derleme zamanında** sıradan Rust kodu
üretir: Bu kod da senin kodun gibi tip denetiminden geçer ve çalışma anında hiçbir ek maliyeti yoktur.
:::

```quiz
question: "`#[derive(Clone)]` için hangisi doğrudur?"
options:
  - Program çalışırken nesnenin alanlarını inceleyip (reflection) kopyalar.
  - Derleme zamanında, her alanın `.clone()`'unu çağıran bir `impl Clone` bloğu üretir.
  - Yalnızca bütün alanları `Copy` olan struct'larda kullanılabilir.
answer: 1
explanation: |
  `derive` bir kod üretme makrosudur: derleme zamanında, senin elle yazacağın `impl` bloğunun aynısını
  üretir. Bu yüzden alanların da o trait'i uygulaması gerekir. `Clone` için alanların `Clone` olması
  yeterlidir; `String` alanlı bir struct da rahatça `Clone` türetebilir.
feedback:
  - Rust'ta çalışma zamanı yansıtması (reflection) yoktur; her şey derleme zamanında üretilir.
  - Doğru — `derive`, `impl` bloğunu senin yerine yazar.
  - "`Clone` için alanların `Clone` olması yeterli. `Copy` şartı `Copy` türetmek içindir."
```

:::deep `derive` nasıl bir makro?
Bir derive makrosu struct tanımını girdi olarak alır ve yeni Rust kodu (`impl` bloğu) üretir. Bu dersteki
standart derive'lar (`Debug`, `Clone`, ...) derleyicinin içine gömülü makrolardır. Popüler `serde`
kütüphanesinin `#[derive(Serialize)]`'ı gibi kütüphanelerin sunduğu derive'lar ise **prosedürel makro**
olarak yazılır; kendininkini Modül 23'te yazacaksın. Üretilen kodu görmek istersen `cargo expand` aracı
(ayrıca kurulur) makroları açılmış hâlde gösterir.
:::

## `Clone` ve `Copy`: açık kopya, örtük kopya

Modül 4'te `String`'in atamada **taşındığını**, `i32`'nin ise **kopyalandığını** öğrenmiştin. Bu farkın
arkasında iki trait var:

- **`Clone`** — açık (explicit) kopya. Sen `.clone()` yazmadıkça gerçekleşmez ve pahalı olabilir: bir
  `String`'i klonlamak heap'te yeni bellek ayırıp bütün baytları kopyalar.
- **`Copy`** — örtük (implicit) kopya. Atama ve fonksiyona geçirme, taşımak yerine değeri bit bit kopyalar.
  Metodu olmayan bir **işaret trait'idir (marker trait)**: *“Bu tipi bayt bayt kopyalamak güvenli ve ucuz.”*

```rust
# #![allow(dead_code)]
#[derive(Debug, Clone, Copy)]
struct Nokta {
    x: i32,
    y: i32,
}

fn saga_kaydir(mut p: Nokta) -> Nokta {
    p.x += 5;
    p
}

fn main() {
    let a = Nokta { x: 1, y: 2 };
    let mut b = a; // taşıma değil: bit bit kopya
    b.y = 20;
    let c = saga_kaydir(a); // a yine kopyalandı, taşınmadı
    println!("a = {a:?}");
    println!("b = {b:?}");
    println!("c = {c:?}");
}
```

`Copy` her zaman `Clone` ile birlikte türetilir, çünkü `Copy` tanımı gereği `Clone` ister (`trait Copy: Clone`
şeklindeki bu “üst trait” sözdizimini Modül 22'de göreceksin). Peki yalnızca `Clone` türetirsek?

```compiles
question: "(Modül 4 tekrarı) `Nokta` bu kez yalnızca `Debug` ve `Clone` türetiyor. Derlenir mi?"
code: |
  #[derive(Debug, Clone)]
  struct Nokta {
      x: i32,
      y: i32,
  }

  fn main() {
      let a = Nokta { x: 1, y: 2 };
      let b = a;
      println!("{a:?} {b:?}");
  }
answer: false
error: E0382
explanation: |
  `Clone` türetmek atamanın anlamını **değiştirmez**: `Copy` olmayan her tip atamada taşınır, yani
  `let b = a;` satırından sonra `a` geçersizdir. İki çözüm var: kopyayı açıkça iste (`let b = a.clone();`)
  ya da — bütün alanlar `i32` olduğu için — `Copy`'yi de türet.
```

Peki neden her tipi `Copy` yapmıyoruz? Bir öğrenci kaydını deneyelim:

```rust,compile_fail,E0204
#[derive(Debug, Clone, Copy)]
pub struct Ogrenci {
    pub ad: String,
    pub no: u32,
}
```

:::error
```text
error[E0204]: the trait `Copy` cannot be implemented for this type
 --> src/main.rs:2:8
  |
1 | #[derive(Debug, Clone, Copy)]
  |                        ---- in this derive macro expansion
2 | struct Ogrenci {
  |        ^^^^^^^
3 |     ad: String,
  |     ---------- this field does not implement `Copy`
```
Kural yine aynı: `Copy` türetmek **her alanın** `Copy` olmasını ister ve `String` `Copy` değildir. Peki
`String` neden `Copy` olamıyor? Aşağıdaki diyagram cevabı gösteriyor.
:::

```memory
title: Neden String tutan bir tip Copy olamaz?
steps:
  - caption: "`Nokta` `Copy`'dir: `let mut b = a;` stack'teki 8 baytı kopyalar. İki bağımsız değer var; `b.y`'yi değiştirmek `a`'yı etkilemez."
    stack:
      - frame: main
        vars:
          - { name: a, type: Nokta, value: "x=1 · y=2" }
          - { name: b, type: Nokta, value: "x=1 · y=20", mut: true }
  - caption: "Bir `Ogrenci` bit bit kopyalanabilseydi (Rust buna izin vermez!), iki değişken **aynı** heap belleğe işaret ederdi. Kapsam bitince ikisi de drop edilir ve aynı bellek iki kez serbest bırakılırdı (double free) — tanımsız davranış."
    stack:
      - frame: main
        vars:
          - { name: o1, type: Ogrenci, value: "ad: ptr·len=5·cap=5 · no=7", to: h1 }
          - { name: o2, type: Ogrenci, value: "ad: ptr·len=5·cap=5 · no=7", to: h1, note: "aynı işaretçi!" }
    heap:
      - { id: h1, value: "A y ş e" }
  - caption: "Doğru yol: `let o2 = o1.clone();`. `Clone` heap'te **yeni** bellek ayırır ve baytları kopyalar. Her değerin kendi sahibi var; drop sırasında sorun çıkmaz. (“Ayşe” 5 bayttır: `ş` UTF-8'de 2 bayt tutar.)"
    stack:
      - frame: main
        vars:
          - { name: o1, type: Ogrenci, value: "ad: ptr·len=5·cap=5 · no=7", to: h1 }
          - { name: o2, type: Ogrenci, value: "ad: ptr·len=5·cap=5 · no=7", to: h2 }
    heap:
      - { id: h1, value: "A y ş e" }
      - { id: h2, value: "A y ş e" }
```

:::analogy Fotokopi ve depo adresi
`Copy`, bir yemek tarifinin fotokopisini çekmek gibidir: Kâğıt ucuzdur, kopya anında hazırdır ve iki kâğıt
birbirinden bağımsızdır. `String` ise üzerinde bir **depo adresi** yazan kâğıda benzer. O kâğıdın fotokopisini
çekersen iki kişi aynı deponun sahibi olduğunu sanır; biri depoyu boşaltıp kapattığında (drop) öteki kapalı bir
depoya gider. `Clone` ise yeni bir depo kiralayıp içindekileri tek tek taşımaktır: Pahalıdır ama dürüsttür,
çünkü her deponun tek bir sahibi olur.
:::

:::tip Ne zaman `Copy` türetmeli?
Küçük ve yalnızca değer taşıyan tipler için: koordinat, renk, tarih, kuruş cinsinden fiyat. Ama unutma: `Copy`
bir **sözdür**. Yarın tipe bir `String` alanı eklersen `Copy`'yi kaldırmak zorunda kalırsın ve bu tipi atamayla
kopyalayan bütün kullanıcı kodu kırılır. Emin değilsen yalnızca `Clone` türet. Kodda görünen `.clone()`'lar da
bir özelliktir: Pahalı kopyaların nerede yapıldığını gösterirler.
:::

## `PartialEq` ve `Eq`: eşitliğin iki seviyesi

`#[derive(PartialEq)]` `==` ve `!=` operatörlerini verir: İki değer, **bütün alanları** eşitse eşittir.
Enum'larda ise iki değer aynı varyantta olup aynı veriyi taşıyorsa eşittir.

Peki adındaki “Partial” (kısmi) nereden geliyor? Matematikte eşitlik birkaç kurala uyar; bunların ilki
**yansımadır**: Her değer kendisine eşittir (`a == a`). `f64` bu kurala uymaz: IEEE 754 standardına göre `NaN`
(*Not a Number* — `0.0 / 0.0` gibi tanımsız işlemlerin sonucu) hiçbir şeye, **kendisine bile** eşit değildir.
Bunu aklında tutarak tahmin et:

```predict
code: |
  #[derive(Debug, PartialEq)]
  struct Olcum {
      istasyon: u32,
      sicaklik: f64,
  }

  fn main() {
      let olcum = Olcum { istasyon: 7, sicaklik: f64::NAN };
      println!("{}", olcum == olcum);
      println!("{}", olcum != olcum);
  }
options:
  - |
    true
    false
  - |
    false
    true
  - |
    false
    false
answer: 1
explanation: |
  Türetilmiş `==` alanları sırayla karşılaştırır: `istasyon` alanları eşit, ama `NaN == NaN` **false**
  olduğu için sonuç `false`. Bir değer kendisine eşit değil! `!=` ise her zaman `==`'in tersidir, bu yüzden
  `true`. İşte bu yüzden `f64` yalnızca `PartialEq` uygular: eşitliği “kısmidir”.
```

**`Eq`** metodu olmayan bir işaret trait'idir ve *“bu tipin `==`'i tam bir denkliktir; `a == a` her zaman
doğrudur”* sözünü verir. Tam sayılar, `char`, `bool` ve `String` `Eq`'dur; `f32` ve `f64` değildir. Bazı API'ler
bu sözü şart koşar; örneğin `HashMap` anahtarları `Eq` olmalıdır. `f64` alanlı bir tipe `Eq` türetmeye
çalışırsan:

```rust,compile_fail,E0277
#[derive(Debug, PartialEq, Eq)]
pub struct Olcum {
    pub istasyon: u32,
    pub sicaklik: f64,
}
```

:::error
```text
error[E0277]: the trait bound `f64: Eq` is not satisfied
 --> src/main.rs:4:5
  |
1 | #[derive(Debug, PartialEq, Eq)]
  |                            -- in this derive macro expansion
...
4 |     sicaklik: f64,
  |     ^^^^^^^^^^^^^ the trait `Eq` is not implemented for `f64`
```
4. dersten tanıdık `E0277`: Türetilen kod her alanın `Eq` olmasını şart koşuyor. Çözüm ya `Eq`'yu türetmemek ya
da değeri tam sayı olarak saklamaktır: 21,5 °C yerine `sicaklik_onda: i32 = 215`. 3. dersteki market
alıştırmasında fiyatları kuruş cinsinden `u32` olarak tutmamızın bir sebebi de buydu.
:::

Bazen türetilmiş eşitlik **yanlış anlama** gelir. Okul sisteminde iki kayıt, okul numaraları aynıysa aynı
öğrenciyi gösterir; adın bir kayıtta “Ayşe”, ötekinde “AYŞE” yazılmış olması bunu değiştirmez. Böyle bir
durumda `PartialEq`'i elle yazarsın:

```fill
prompt: "`Ogrenci` için yalnızca `no` alanını karşılaştıran bir `PartialEq` uygulaması yaz."
code: |
  struct Ogrenci {
      ad: String,
      no: u32,
  }

  impl ___0 for Ogrenci {
      fn eq(&self, other: &___1) -> bool {
          self.no == ___2.no
      }
  }

  fn main() {
      let a = Ogrenci { ad: String::from("Ayşe"), no: 1203 };
      let b = Ogrenci { ad: String::from("AYŞE"), no: 1203 };
      let c = Ogrenci { ad: String::from("Ayşe"), no: 1307 };
      println!("{} {}", a == b, a != c);
      println!("{} / {} / {}", a.ad, b.ad, c.ad);
  }
blanks:
  - ["PartialEq"]
  - ["Self", "Ogrenci"]
  - ["other"]
output: |
  true true
  Ayşe / AYŞE / Ayşe
explanation: |
  `PartialEq`'in tek zorunlu metodu `eq`'dur: `self` ile `other`'ı karşılaştırıp `bool` döndürür. `!=`
  (`ne` metodu) varsayılan uygulama olarak hazır gelir — 3. dersteki varsayılan metotlar gibi! Adlar farklı
  yazılmış olsa da `a == b` doğru; adları aynı ama numaraları farklı olan `a` ile `c` ise farklı öğrenciler.
```

## `PartialOrd` ve `Ord`: sıralama

`#[derive(PartialOrd)]` `<`, `>`, `<=`, `>=` operatörlerini verir. **`Ord`** ise **toplam sıralama** sözüdür:
Her iki değerden biri ötekinden küçük, büyük ya da ona eşittir. `cmp`, `sort`, `max` ve `min` gibi API'ler
bunu ister. İlişki eşitlikteki gibidir: `f64` yalnızca `PartialOrd` uygular, çünkü `NaN` hiçbir sayıdan ne
küçük ne büyüktür, ne de ona eşittir. Bu yüzden `Ord` türetmek `Eq` ve `PartialOrd`'u, onlar da `PartialEq`'i
gerektirir; dördü genellikle birlikte türetilir.

Türetilmiş sıralamanın kuralı **sözlük sırasıdır** (lexicographic): Önce ilk alanlar karşılaştırılır; eşitlerse
ikinci alanlara geçilir, sonra üçüncülere... Tıpkı sözlükte “kara” ile “kartal”ın önce `k`, sonra `a`, sonra `r`
harfleriyle karşılaştırılması gibi. Enum'larda ise varyantların **tanım sırası** geçerlidir: Üstteki küçüktür.
(Tek istisna: `enum Kat { Ust = 2, Alt = 1 }` gibi varyantlara açıkça sayı verdiysen sıralamayı bu sayılar
belirler ve `Alt < Ust` olur.)

```rust
use std::cmp::Ordering;

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Oncelik {
    Dusuk,
    Normal,
    Yuksek,
}

fn main() {
    println!("{}", Oncelik::Dusuk < Oncelik::Yuksek);
    println!("{:?}", Oncelik::Normal.cmp(&Oncelik::Dusuk));
    println!("{:?}", 3.cmp(&5));

    let en_acil = std::cmp::max(Oncelik::Normal, Oncelik::Yuksek);
    println!("{en_acil:?}");

    if Oncelik::Yuksek.cmp(&Oncelik::Normal) == Ordering::Greater {
        println!("Yüksek öncelikli işler önce yapılır");
    }
}
```

`cmp` bir `Ordering` döndürür: `Less`, `Equal` ya da `Greater`. Modül 3'teki tahmin oyununda `match` ile
eşleştirdiğin enum buydu. Şimdi türetilmiş sıralamayı bir struct'ta dene:

```predict
code: |
  #[derive(PartialEq, Eq, PartialOrd, Ord)]
  struct Sonuc {
      puan: u32,
      ad: String,
  }

  fn main() {
      let mut liste = vec![
          Sonuc { puan: 92, ad: String::from("Ali") },
          Sonuc { puan: 85, ad: String::from("Zeynep") },
          Sonuc { puan: 85, ad: String::from("Can") },
      ];
      liste.sort();
      for s in &liste {
          println!("{} {}", s.puan, s.ad);
      }
  }
options:
  - |
    92 Ali
    85 Zeynep
    85 Can
  - |
    85 Zeynep
    85 Can
    92 Ali
  - |
    85 Can
    85 Zeynep
    92 Ali
  - |
    92 Ali
    85 Can
    85 Zeynep
answer: 2
explanation: |
  `sort` küçükten büyüğe sıralar. Önce ilk alan olan `puan` karşılaştırılır: 85'ler 92'nin önüne geçer.
  İki 85'lik kayıtta `puan` eşit olduğu için ikinci alan `ad` devreye girer: `"Can" < "Zeynep"`. Alanların
  **tanım sırası** belirleyicidir: `ad` alanı önce tanımlansaydı liste alfabetik olurdu (Ali, Can, Zeynep).
  Büyükten küçüğe sıralamak için `sort` ardından `reverse` kullanabilirsin (Modül 9).
```

```quiz
question: |
  (Modül 9 tekrarı) Modül 9'da `let mut notlar = vec![72.5, 90.0, 45.5]; notlar.sort();` yazınca kod
  derlenmemişti. Neden?
options:
  - "`Vec` yalnızca tam sayıları sıralayabilir."
  - "`sort` için `T: Ord` gerekir; `f64` ise NaN yüzünden yalnızca `PartialOrd` uygular."
  - "Ondalıklı sayılar hiçbir şekilde karşılaştırılamaz."
answer: 1
explanation: |
  Standart kütüphanedeki imza şöyledir: `pub fn sort(&mut self) where T: Ord`. 4. derste öğrendiğin `where`
  cümlesi! `{float}` tipi `Ord` sınırını sağlamadığı için `E0277` alırsın. Modül 9'daki çözüm, NaN'ları da
  tutarlı biçimde sıraya koyan `total_cmp` ile karşılaştırmaktı:
  `notlar.sort_by(|a, b| a.total_cmp(b));`
feedback:
  - "`Vec<String>` ya da `Vec<char>` de sıralanabilir; sınır tipin cinsine değil `Ord` uygulamasına bakar."
  - Doğru — `sort` toplam sıralama ister.
  - "`72.5 < 90.0` gayet çalışır, çünkü `f64` `PartialOrd`'dur. Eksik olan *toplam* sıralamadır."
```

:::error
```text
error[E0277]: the trait bound `{float}: Ord` is not satisfied
   --> src/main.rs:3:12
    |
  3 |     notlar.sort();
    |            ^^^^ the trait `Ord` is not implemented for `{float}`
    |
note: required by a bound in `slice::<impl [T]>::sort`
   --> …/library/alloc/src/slice.rs:133:12
    |
131 |     pub fn sort(&mut self)
    |            ---- required by a bound in this associated function
132 |     where
133 |         T: Ord,
    |            ^^^ required by this bound in `slice::<impl [T]>::sort`
```
Derleyici sana standart kütüphanenin kaynak kodundan `where T: Ord` satırını gösteriyor. Artık bu imzaları
okuyabiliyorsun!
:::

## `Hash` ve `Default`

### `Hash`: anahtar olabilmek

Modül 9'da `HashMap` ve `HashSet` anahtarı olarak `String` ve `i32` kullandın. Kendi tipini anahtar yapmak
için iki trait gerekir: **`Eq` ve `Hash`**. `HashMap` önce anahtarın hash değeriyle hangi “kovaya” bakacağını
bulur, sonra o kovadaki anahtarları `==` ile karşılaştırır. `Hash`'i unutursan:

```rust,compile_fail,E0277
use std::collections::HashMap;

#[derive(Debug, PartialEq, Eq)]
struct Koordinat {
    x: i32,
    y: i32,
}

fn main() {
    let mut harita = HashMap::new();
    harita.insert(Koordinat { x: 0, y: 0 }, "başlangıç");
    println!("{}", harita.len());
}
```

:::error
```text
error[E0277]: the trait bound `Koordinat: Hash` is not satisfied
    --> src/main.rs:11:12
     |
  11 |     harita.insert(Koordinat { x: 0, y: 0 }, "başlangıç");
     |            ^^^^^^ ------------------------ `Koordinat` doesn't satisfy the trait bound
     |            |
     |            the trait `Hash` is not implemented for `Koordinat`
     |
note: required by a bound in `HashMap::<K, V, S, A>::insert`
    --> …/library/std/src/collections/hash/map.rs:891:13
     |
 891 |     K: Eq + Hash,
     |             ^^^^ required by this bound in `HashMap::<K, V, S, A>::insert`
...
help: consider annotating `Koordinat` with `#[derive(Hash)]`
     |
   4 + #[derive(Hash)]
   5 | struct Koordinat {
     |
```
`HashMap`'in kendi `where` cümlesi (`K: Eq + Hash`) ve derleyicinin önerdiği çözüm aynı mesajda.

Kod numarası neden `E0277`? Çünkü `HashMap::new()` anahtar tipini henüz `insert`'ten çıkarıyordu.
Tipi baştan yazsaydın (`let mut harita: HashMap<Koordinat, &str> = HashMap::new();`), aynı eksik için
4. dersteki `E0599`'u (“`insert` metodu var, ama sınırlar sağlanmadı”) alırdın. İki mesaj da aynı şeyi
söyler: bir trait sınırı sağlanmadı.
:::

Türettiğinde ise her şey yerine oturur. Bir robotun gezdiği **farklı** hücreleri sayalım:

```rust
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct Koordinat {
    x: i32,
    y: i32,
}

fn main() {
    let yol = "KKDGBBKK"; // K: kuzey, G: güney, D: doğu, B: batı
    let mut konum = Koordinat { x: 0, y: 0 };
    let mut ziyaret = HashSet::new();
    ziyaret.insert(konum);

    for adim in yol.chars() {
        match adim {
            'K' => konum.y += 1,
            'G' => konum.y -= 1,
            'D' => konum.x += 1,
            'B' => konum.x -= 1,
            _ => {}
        }
        ziyaret.insert(konum); // Copy sayesinde konum kullanılmaya devam eder
    }

    println!("Son konum: {konum:?}");
    println!("Farklı hücre sayısı: {}", ziyaret.len());
}
```

Robot 9 konumda bulundu ama `(0, 1)` hücresine iki kez uğradı; `HashSet` tekrarı tutmadığı için sonuç 8.

:::warning `PartialEq`'i elle yazarsan `Hash` da uyumlu olmalı
Kural: `a == b` ise `a` ile `b`'nin hash'i de eşit olmalıdır. Az önceki `Ogrenci` örneğinde eşitlik yalnızca
`no`'ya bakıyordu. O tipe `Hash` **türetseydin**, türetilmiş `Hash` `ad`'ı da hesaba katardı. Bu durumda
“Ayşe” ile “AYŞE” kayıtları farklı kovalara düşer ve `HashSet` aynı öğrenciyi iki kez tutardı. Derleyici bunu
yakalayamaz (Clippy ise `derived_hash_with_manual_eq` uyarısıyla yakalar). Ya ikisini birlikte türet ya da
ikisini birlikte, **aynı alanlara** bakacak şekilde elle yaz.
:::

### `Default`: makul bir başlangıç değeri

`Default` bir tipin varsayılan değerini verir: sayılar için `0`, `bool` için `false`, `String` ve `Vec` için
boş, `Option` için `None`. Türetilmiş `Default` her alanın varsayılanını kullanır. Enum'larda hangi varyantın
varsayılan olduğunu `#[default]` ile işaretlemen gerekir; derleyici bunu senin yerine tahmin etmez.

```rust
# #![allow(dead_code)]
#[derive(Debug, Default)]
enum Tema {
    #[default]
    Acik,
    Koyu,
}

#[derive(Debug, Default)]
struct Ayarlar {
    ses: u8,
    kullanici: String,
    tema: Tema,
    tam_ekran: bool,
}

fn main() {
    let varsayilan = Ayarlar::default();
    println!("{varsayilan:?}");

    // Modül 6'daki struct güncelleme sözdizimi: kalan alanlar varsayılandan gelir.
    let benim = Ayarlar {
        ses: 80,
        tema: Tema::Koyu,
        ..Default::default()
    };
    println!("{benim:?}");
}
```

Sıfır değerler her zaman anlamlı değildir: 0×0 boyutlu bir pencerenin işe yaramayacağı açık. Böyle durumlarda
`Default`'u elle yaz:

```rust
# #![allow(dead_code)]
#[derive(Debug)]
struct Pencere {
    genislik: u32,
    yukseklik: u32,
    baslik: String,
}

impl Default for Pencere {
    fn default() -> Self {
        Pencere {
            genislik: 800,
            yukseklik: 600,
            baslik: String::from("Adsız"),
        }
    }
}

fn main() {
    let p = Pencere {
        baslik: String::from("Ayarlar"),
        ..Default::default()
    };
    println!("{p:?}");
}
```

```predict
question: "(Modül 10 tekrarı) `unwrap_or_default` hata durumunda tipin `Default` değerini kullanır. Bu program ne yazdırır?"
code: |
  fn main() {
      let girdiler = ["42", "kırk iki", "-7"];
      let mut toplam = 0;
      for g in girdiler {
          let n: i32 = g.parse().unwrap_or_default();
          toplam += n;
      }
      let isim: Option<String> = None;
      println!("{toplam} [{}]", isim.unwrap_or_default());
  }
options:
  - "35 []"
  - "35 [None]"
  - "(Program panikler: \"kırk iki\" bir sayı değil.)"
answer: 0
explanation: |
  `"kırk iki"` ayrıştırılamaz ve `Err` olur, ama `unwrap_or_default` panik yerine `i32::default()` değerini,
  yani `0`'ı verir: 42 + 0 − 7 = 35. `None` için de `String::default()`, yani boş metin gelir. Modül 10'da
  kullandığın bu metodun imzasında `where T: Default` yazar: Yalnızca varsayılan değeri olan tiplerde
  çağrılabilir. Bir metodu ancak sınır sağlanınca kullanabilmek, 4. dersteki koşullu metotların aynı fikri.
```

## Generic tiplerde `derive`

`derive` generic bir tipte de çalışır, ama ürettiği `impl` bloğuna **her tip parametresi için** bir sınır
ekler. `#[derive(Clone)] struct Kutu<T> { icerik: T }` satırı kabaca şunu üretir:

```rust,ignore
impl<T: Clone> Clone for Kutu<T> {
    fn clone(&self) -> Self {
        Kutu { icerik: self.icerik.clone() }
    }
}
```

Bu, 4. dersteki koşullu impl'in ta kendisi: `Kutu<T>` ancak `T` `Clone` ise `Clone`'dur. Derlenir mi?

```compiles
code: |
  #[derive(Clone)]
  struct Kutu<T> {
      icerik: T,
  }

  struct Renk;

  fn main() {
      let a = Kutu { icerik: String::from("kalem") };
      let _b = a.clone();
      let c = Kutu { icerik: Renk };
      let _d = c.clone();
  }
answer: false
error: E0599
explanation: |
  `Kutu<String>` sorunsuz klonlanır, çünkü `String: Clone`. Ama türetilen `impl<T: Clone> Clone for Kutu<T>`
  `Renk`'i kapsamaz: `Renk` `Clone` değil, o yüzden `Kutu<Renk>` için `clone` metodu **yok** (`E0599`,
  “metot var, ama sınırlar sağlanmadı”). Derleyicinin notu da bunu söyler: *type parameter would need to
  implement `Clone`*. Çözüm `Renk`'e de `#[derive(Clone)]` eklemektir.
```

Bu sınır bazen gereğinden katıdır: `derive` alanlara değil **tip parametrelerine** bakar. `T`'yi
klonlamadan kopyalanabilen bir alan tutsan bile (örneğin `Rc<T>`, Modül 17) yine `T: Clone` ister.
Derleyici de aynı hatada *consider manually implementing the trait to avoid undesired bounds* diye
ipucu verir: Böyle durumlarda `impl`'i sınırsız olarak elle yazarsın.

:::tip Ne zaman türetemezsin ya da türetmemelisin?
1. **Bir alan o trait'i uygulamıyorsa:** `String` alanı → `Copy` olmaz (`E0204`); `f64` alanı → `Eq`, `Ord`
   ve `Hash` olmaz (`E0277`). Generic tiplerde ise sınır tip parametresine gider: `Kutu<T>` ancak `T` de
   o trait'i uygularsa onu kazanır.
2. **Türetilmiş anlam yanlışsa:** Numaraya göre eşitlik, 800×600'lük varsayılan pencere ya da ters sıralama
   gerekiyorsa `impl`'i elle yaz.
3. **Hiçbir zaman türetilemeyenler:** `Display` (6. ders) gibi tek bir doğru cevabı olmayan trait'ler.

Pratik bir başlangıç: Yeni veri tiplerinde `#[derive(Debug, Clone, PartialEq)]` ile başla, ihtiyaç doğdukça
diğerlerini ekle.
:::

## Alıştırma: sürüm numaraları

```exercise
id: m11-l05-e-surum
title: Sürüm numaralarını karşılaştır
difficulty: 3
prompt: |
  Modül 8'de Cargo'nun **SemVer** sürüm numaralarını (`ana.ara.yama`, ör. `1.10.0`) gördün. Bir paket
  yöneticisi için `Surum` tipini hazırlıyoruz.

  1. `Surum`'a doğru trait'leri **türet**. Testler şunları kullanıyor: `==` ve `assert_eq!`, `<`/`>`,
     `sort()`, `Surum::default()` (0.0.0 olmalı), `HashSet` anahtarı olmak ve atamadan sonra eski değişkeni
     kullanmaya devam etmek (`Copy`).
  2. **`en_yeni`**: Listedeki en büyük sürümü döndür; liste boşsa `None`.
  3. **`farkli_surum_sayisi`**: Listede kaç **farklı** sürüm olduğunu döndür (bir `HashSet` işini kolaylaştırır).

  İpucu: Testleri ilk çalıştırdığında derlenmeyecekler. Derleyici sana hangi trait'lerin eksik olduğunu tek
  tek söyleyecek; hata mesajlarını oku!
starter: |
  use std::collections::HashSet;

  // TODO: Testlerin ihtiyaç duyduğu trait'leri türet.
  #[derive(Debug)]
  struct Surum {
      ana: u32,
      ara: u32,
      yama: u32,
  }

  fn en_yeni(liste: &[Surum]) -> Option<Surum> {
      todo!()
  }

  fn farkli_surum_sayisi(liste: &[Surum]) -> usize {
      todo!()
  }

  fn main() {
      let s = Surum { ana: 1, ara: 9, yama: 3 };
      println!("{}.{}.{}", s.ana, s.ara, s.yama);
  }
solution: |
  use std::collections::HashSet;

  #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
  struct Surum {
      ana: u32,
      ara: u32,
      yama: u32,
  }

  fn en_yeni(liste: &[Surum]) -> Option<Surum> {
      if liste.is_empty() {
          return None;
      }
      let mut aday = liste[0];
      for s in liste {
          if *s > aday {
              aday = *s;
          }
      }
      Some(aday)
  }

  fn farkli_surum_sayisi(liste: &[Surum]) -> usize {
      let mut kume = HashSet::new();
      for s in liste {
          kume.insert(*s);
      }
      kume.len()
  }

  fn main() {
      let surumler = [
          Surum { ana: 1, ara: 9, yama: 3 },
          Surum { ana: 1, ara: 10, yama: 0 },
          Surum { ana: 1, ara: 9, yama: 3 },
      ];
      if let Some(s) = en_yeni(&surumler) {
          println!("En yeni: {}.{}.{}", s.ana, s.ara, s.yama);
      }
      println!("Farklı sürüm sayısı: {}", farkli_surum_sayisi(&surumler));
      println!("Varsayılan: {:?}", Surum::default());
  }
check: tests
tests: |
  fn s(ana: u32, ara: u32, yama: u32) -> Surum {
      Surum { ana, ara, yama }
  }

  #[test]
  fn varsayilan_sifir_ve_kopyalanabilir() {
      let v = Surum::default();
      let kopya = v;
      assert_eq!(v, s(0, 0, 0), "Surum::default() 0.0.0 olmalı");
      assert_eq!(kopya, v, "Surum Copy olmalı: atamadan sonra eski değişken de kullanılabilmeli");
  }

  #[test]
  fn siralama_alan_alan_yapilir() {
      assert!(s(1, 10, 0) > s(1, 9, 9), "1.10.0, 1.9.9'dan yenidir: alanlar metin olarak değil, sayı olarak karşılaştırılır");
      assert!(s(2, 0, 0) > s(1, 99, 99), "Önce ana sürüm karşılaştırılmalı");
      let mut liste = vec![s(1, 10, 0), s(0, 9, 9), s(1, 2, 3), s(1, 2, 0)];
      liste.sort();
      assert_eq!(liste, vec![s(0, 9, 9), s(1, 2, 0), s(1, 2, 3), s(1, 10, 0)], "sort() sürümleri eskiden yeniye dizmeli");
  }

  #[test]
  fn en_yeni_surum_bulunur() {
      let liste = [s(1, 9, 3), s(1, 10, 0), s(0, 99, 1), s(1, 9, 12)];
      assert_eq!(en_yeni(&liste), Some(s(1, 10, 0)), "En yeni sürüm 1.10.0 olmalı");
      let tek = [s(3, 1, 4)];
      assert_eq!(en_yeni(&tek), Some(s(3, 1, 4)), "Tek elemanlı listede en yeni sürüm o elemandır");
  }

  #[test]
  fn bos_liste() {
      assert_eq!(en_yeni(&[]), None, "Boş listede en yeni sürüm olmaz");
      assert_eq!(farkli_surum_sayisi(&[]), 0, "Boş listede hiç sürüm yok");
  }

  #[test]
  fn tekrarlar_bir_kez_sayilir() {
      let liste = [s(1, 0, 0), s(2, 1, 0), s(1, 0, 0), s(0, 0, 1), s(2, 1, 0), s(1, 0, 0)];
      assert_eq!(farkli_surum_sayisi(&liste), 3, "1.0.0, 2.1.0 ve 0.0.1: üç farklı sürüm var");
      let mut kume = std::collections::HashSet::new();
      kume.insert(s(1, 0, 0));
      assert!(kume.contains(&s(1, 0, 0)), "Surum bir HashSet'e anahtar olarak konabilmeli (Hash + Eq)");
  }
hints:
  - "Testleri çalıştır ve derleyicinin ilk hatasını oku: Hangi trait eksik? `==` için `PartialEq`, `sort` için `Ord`, `Surum::default()` için `Default`, `HashSet` için `Hash` ve `Eq` gerekir."
  - "Tam liste: `#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]`. Alanların sırası (`ana`, `ara`, `yama`) zaten istediğimiz karşılaştırma sırası olduğu için türetilmiş `Ord` doğru çalışır."
  - "`en_yeni`: Liste boşsa `None` döndür; değilse `let mut aday = liste[0];` ile başla (`Copy` sayesinde bu bir kopyadır), `for s in liste { if *s > aday { aday = *s; } }` ve sonunda `Some(aday)`. `farkli_surum_sayisi`: `HashSet::new()` oluştur, her sürümü `kume.insert(*s)` ile ekle, `kume.len()` döndür."
explanation: |
  Asıl iş `derive` satırındaydı. Dokuz trait'in her biri bir teste karşılık geliyordu: `assert_eq!` için
  `PartialEq` ve `Debug`, `sort` için `Ord` (ve onun gerektirdiği `Eq` ile `PartialOrd`), `HashSet` için `Hash`,
  `Surum::default()` için `Default`, `let kopya = v;` sonrasında `v`'yi kullanabilmek için `Copy` (ve onun
  gerektirdiği `Clone`). Üç `u32` alanlı küçük bir değer tipi `Copy` için ideal bir adaydır.

  Türetilmiş `Ord` alanları **tanım sırasıyla** karşılaştırır: önce `ana`, sonra `ara`, sonra `yama`. SemVer'in
  istediği tam olarak budur. Sürümleri metin olarak karşılaştırsaydık `"1.9.9" > "1.10.0"` çıkardı, çünkü
  `'9' > '1'`! Alanların sırasını değiştirmek (ör. `yama`'yı en üste yazmak) sıralamayı sessizce bozardı.

  Alternatif: Modül 9'daki `liste.iter().max()` de `Ord` ister ve `Option<&Surum>` döndürür; `Copy` sayesinde
  `*` ile kopyalayabilirsin.
```

## Özet

:::remember
- `derive`, derleme zamanında `impl` bloğu üreten bir makrodur. Bir trait'i ancak **bütün alanlar** o trait'i
  uyguluyorsa türetebilirsin.
- `Clone` açıktır (`.clone()`, pahalı olabilir); `Copy` örtüktür (bit bit kopya) ve `Clone` gerektirir. Heap
  belleğine sahip olan bir alan (`String`, `Vec`) varsa tip `Copy` olamaz (`E0204`).
- `PartialEq` → `==`; `Eq` → “`a == a` her zaman doğru” sözü. `f64`, NaN yüzünden yalnızca `PartialEq` ve
  `PartialOrd`'dur.
- Türetilmiş `PartialOrd`/`Ord` **sözlük sırası** kullanır: Önce ilk alan, eşitse sıradaki. Enum'larda
  varyantların tanım sırası geçerlidir. `sort`, `max` ve `min` `Ord` ister.
- `HashMap`/`HashSet` anahtarları `Eq + Hash` olmalıdır. Elle `PartialEq` yazarsan `Hash` da aynı alanlara
  bakmalı.
- `Default` → `Tip::default()` ve `..Default::default()`; enum'da `#[default]` gerekir. Sıfır değerler
  anlamsızsa elle yaz.
:::

```reflect
prompt: |
  Rust neden bütün tipleri otomatik olarak `Copy` (ya da `Clone`, `PartialEq`...) yapmıyor da bunları
  `derive` ile **açıkça** istemeni bekliyor? En az iki sebep düşün.
answer: |
  Birincisi doğruluk: Her tip güvenle kopyalanamaz. Heap belleğine sahip bir tipin bit bit kopyası double free'ye
  yol açardı; bazı tiplerin eşitliği de alan alan karşılaştırmayla doğru tanımlanmaz (numaraya göre eşitlik
  gibi). Otomatik davranış bu durumlarda sessizce yanlış olurdu.

  İkincisi, bu trait'ler birer API sözüdür. Bir tipi `Copy` yaparsam onu kullanan herkes atamayla kopyalamaya
  başlar; ileride bu sözü geri almak onların kodunu kırar. Açık `derive` satırı, tipin hangi sözleri verdiğini
  tek bakışta belgeler. Üçüncüsü maliyetin görünür olmasıdır: `Copy` olmayan tiplerde pahalı kopyalar ancak
  `.clone()` yazınca gerçekleşir ve kodda görünür.
```

```flashcards
- front: "`#[derive(Trait)]` perde arkasında ne yapar?"
  back: Derleme zamanında bir `impl Trait for Tip` bloğu üretir. Üretilen kod her alanda trait'in metodunu çağırdığı için bütün alanların o trait'i uygulaması gerekir.
- front: "`Clone` ile `Copy` arasındaki fark nedir?"
  back: "`Clone` açıktır (`.clone()` yazılır, pahalı olabilir). `Copy` örtüktür: Atama ve fonksiyona geçirmede değer bit bit kopyalanır. `Copy`, `Clone` gerektirir."
- front: "Neden `String` alanı olan bir struct `Copy` olamaz?"
  back: "Bit bit kopya iki değişkenin aynı heap belleğe işaret etmesine ve belleğin iki kez serbest bırakılmasına (double free) yol açardı. Derleyici `E0204` verir."
- front: "`PartialEq` ile `Eq` arasındaki fark nedir?"
  back: "`PartialEq`, `==` ve `!=` verir. `Eq` metodu olmayan bir sözdür: `a == a` her zaman doğrudur. `f64` NaN yüzünden yalnızca `PartialEq`'dir."
- front: Türetilmiş `PartialOrd`/`Ord` iki struct'ı nasıl karşılaştırır?
  back: "Sözlük sırasıyla: Önce ilk alanlar, eşitlerse ikinciler... Alanların tanım sırası belirleyicidir. Enum'larda üstte tanımlanan varyant küçüktür."
- front: Neden `Vec<f64>` üzerinde `sort()` çağrılamaz?
  back: "`sort`, `T: Ord` ister; `f64` yalnızca `PartialOrd`'dur. Çözüm: `sort_by(|a, b| a.total_cmp(b))`."
- front: Bir tipin `HashMap` anahtarı olabilmesi için hangi trait'ler gerekir?
  back: "`Eq` ve `Hash`. Ayrıca `a == b` ise hash'leri de eşit olmalıdır; elle `PartialEq` yazarsan `Hash`'i de uyumlu yaz."
- front: "Bir enum için `#[derive(Default)]` kullanırken ne gerekir?"
  back: "Varsayılan olacak varyantı `#[default]` ile işaretlemek. Derleyici bunu tahmin etmez."
```
