---
id: m11-l08
title: "Trait kuralları: orphan rule, blanket impl ve const generic'ler"
minutes: 22
type: lesson
objectives:
  - "Orphan rule'un (`E0117`) neyi yasakladığını ve nedenini açıklayıp bir `impl`'in yazılıp yazılamayacağına karar verebilmek"
  - "Newtype deseniyle yabancı bir tipe yabancı bir trait uygulayabilmek"
  - "Blanket impl yazabilmek ve `to_string()` ile `into()`'nun nereden geldiğini açıklayabilmek"
  - "`const N: usize` parametreli tipler ve fonksiyonlar yazabilmek; generic mi somut mu kararını gerekçelendirebilmek"
keywords: [orphan rule, coherence, E0117, E0119, newtype, blanket impl, ToString, Into, const generics, "[T; N]"]
---

Bu modülde trait'leri tanımladın, uyguladın, sınır olarak kullandın, standart kütüphanenin en önemli
trait'lerini kendi tiplerine giydirdin. Ama arada bazı sorular cevapsız kaldı: 3. derste “her kombinasyona
izin yok” demiştik; hangileri yasak, neden? 6. derste `to_string()` ve `into()` hiç yazmadan nasıl geldi?
Ve dizilerde `[i32; 3]` ile `[i32; 5]` farklı tipler olduğuna göre, “her boyuttaki dizi” için nasıl
generic kod yazılır?

Bu son ders trait sisteminin **oyun kurallarını** anlatıyor.

## Yasak bir impl

Bir market uygulamasında sepeti doğrudan `{}` ile yazdırmak istiyoruz. Sepet bir `Vec<String>`. 6. derste
öğrendiğin gibi `Display`'i uygulayalım:

```compiles
code: |
  use std::fmt;

  impl fmt::Display for Vec<String> {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          write!(f, "{} ürün", self.len())
      }
  }

  fn main() {
      let sepet = vec![String::from("elma"), String::from("armut")];
      println!("{sepet}");
  }
answer: false
error: E0117
explanation: |
  `Display` standart kütüphanenin trait'i, `Vec` de standart kütüphanenin tipi. İkisi de **senin**
  crate'inde tanımlı değil. Rust bir trait'i bir tipe ancak trait'in ya da tipin (en az birinin) senin
  crate'inde tanımlı olduğu durumda uygulamana izin verir. Buna **orphan rule** (yetim kuralı) denir.
```

:::error
```text
error[E0117]: only traits defined in the current crate can be implemented for types defined outside of the crate
 --> src/main.rs:3:1
  |
3 | impl fmt::Display for Vec<String> {
  | ^^^^^^^^^^^^^^^^^^^^^^-----------
  |                       |
  |                       `Vec` is not defined in the current crate
  |
  = note: impl doesn't have any local type before any uncovered type parameters
  = note: for more information see https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules
  = note: define and implement a trait or new type instead
```
Son `note:` satırı iki çıkış yolu gösteriyor: ya kendi trait'ini tanımla ya da yeni bir **tip** tanımla
(newtype). İkisini de bu derste göreceğiz. “Yetim” adı şuradan geliyor: Ne trait'in ne de tipin sahibi
olan bir impl, sahipsiz kalmış bir yetim gibidir.
:::

Neden böyle bir kural var? Rust'ın **tutarlılık (coherence)** ilkesi şunu ister: Bütün programda, belirli
bir trait'in belirli bir tip için **en fazla bir** uygulaması olmalı. Orphan rule olmasaydı:

1. **Çakışma:** Kullandığın iki farklı crate'in ikisi de `impl Display for Vec<String>` yazabilirdi.
   `println!("{sepet}")` hangisini çağıracaktı? Hiçbir doğru cevap yok.
2. **Kırılgan güncellemeler:** Sen bugün `Vec` için `Display` yazsan, yarın standart kütüphane kendi
   `Display`'ini eklediğinde senin kodun kırılırdı. Kural sayesinde bir crate, kullanıcılarını kırma
   korkusu olmadan kendi tiplerine yeni trait uygulamaları ekleyebilir (Modül 8: SemVer).

:::analogy Dernek üyelik kaydı
Bir dernek (trait) bir kişiyi (tip) üye olarak kaydedebilir. Kişi de kendi adına bir derneğe başvurabilir.
Ama ne derneğin yöneticisi ne de o kişinin kendisi olan biri, başkası adına kayıt yapamaz. Herkes istediği
ofiste kayıt açabilseydi aynı kişi aynı derneğe iki ayrı ofiste iki farklı koşulla kaydedilir, hangi
kaydın geçerli olduğu bilinemezdi.

Senin crate'in bir ofistir: Ya derneğin (trait) ya da kişinin (tip) “sahibi” olduğunda kayıt (`impl`)
yapabilirsin.
:::

| Trait | Tip | İzin var mı? |
|---|---|---|
| Senin (`Ozet`) | Senin (`Haber`) | ✅ |
| Senin (`Ozet`) | Yabancı (`Vec<String>`, `bool`) | ✅ 3. dersteki `impl EvetHayir for bool` gibi |
| Yabancı (`Display`) | Senin (`Haber`) | ✅ 6. derste yaptığın gibi |
| Yabancı (`Display`) | Yabancı (`Vec<String>`) | ❌ `E0117` |

```quiz
question: "`Haber` ve `Ozet` senin crate'inde tanımlı. Aşağıdaki impl'lerden **hangileri** yazılabilir?"
options:
  - "`impl Ozet for Vec<String> { ... }`"
  - "`impl fmt::Display for Haber { ... }`"
  - "`impl From<Haber> for String { ... }`"
  - "`impl fmt::Display for Option<Haber> { ... }`"
answer: [0, 1, 2]
explanation: |
  İlk ikisi tablodaki temel durumlar. Üçüncüsü ilginç: `From` de `String` de yabancı, ama trait'in tip
  parametresinde **senin** tipin (`Haber`) var. `From<Haber>` bir bakıma senin trait'indir; başka hiçbir
  crate bu impl'i yazamaz, çakışma riski yoktur. (6. derste `impl From<IlKodu> for u8` yazabilmenin sebebi
  buydu.) Dördüncüsü ise derlenmez (`E0117`): `Option<Haber>` senin tipini içerse de `Option` yabancıdır ve
  standart kütüphane bir gün `impl<T: Display> Display for Option<T>` ekleyebilir. Kuralın tam ayrıntıları
  Modül 22'de.
feedback:
  - "Doğru: trait senin."
  - "Doğru: tip senin."
  - "Doğru! Trait'in parametresindeki yerel tip (`Haber`) impl'i sana ait kılıyor."
  - "Yabancı bir tipin içine yerel bir tip koymak (`Option<Haber>`) onu yerel yapmaz: `E0117`."
```

## Newtype ile aşmak

En yaygın çözüm Modül 6'da tanıştığın **newtype**: yabancı tipi tek alanlı bir tuple struct'a sarmak.
`Sepet` senin tipin olduğu için ona istediğin trait'i uygulayabilirsin:

```rust
use std::fmt;

struct Sepet(Vec<String>);

impl fmt::Display for Sepet {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Sepette {} ürün:", self.0.len())?;
        for urun in &self.0 {
            write!(f, " [{urun}]")?;
        }
        Ok(())
    }
}

fn main() {
    let mut sepet = Sepet(vec![String::from("simit"), String::from("ayran")]);
    sepet.0.push(String::from("lahmacun")); // içteki Vec'e .0 ile ulaşılır
    println!("{sepet}");
}
```

`fmt`'nin içindeki `?`'lere dikkat: `write!` bir `fmt::Result` döndürür, yazma başarısız olursa hatayı
hemen ilet, başarılıysa devam et. Modül 10'daki `?` burada da aynı işi görüyor. Son satırdaki `Ok(())` ise
“hepsi yazıldı” demektir.

Sarmalamanın çalışma anında bir bedeli var mı? Hayır. `Sepet` bellekte içindeki `Vec` ile **birebir aynı**
yeri kaplar (`size_of::<Sepet>()` = `size_of::<Vec<String>>()` = 24 bayt). Tip yalnızca derleme
zamanında vardır:

```memory
title: Newtype bellekte ek yer kaplamaz
steps:
  - caption: "`let v = vec![...];` — `v` bir `Vec<String>`: stack'te 24 bayt (işaretçi, uzunluk, kapasite), elemanlar heap'te."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<String>", value: "ptr · len=2 · cap=2", to: h1 }
    heap:
      - { id: h1, value: "[\"simit\"] [\"ayran\"]" }
  - caption: "`let sepet = Sepet(v);` — `v` sepetin içine **taşındı**. `sepet` de 24 bayttır; aynı üç değer, aynı heap verisi. Fark yalnızca tipin adında: artık `Display` uygulayabiliyoruz."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<String>", value: "ptr · len=2 · cap=2", moved: true }
          - { name: sepet, type: Sepet, value: "0: ptr · len=2 · cap=2", to: h1 }
    heap:
      - { id: h1, value: "[\"simit\"] [\"ayran\"]" }
```

Diyagramda bir şey daha gördün: `Sepet(v)` değeri sarmalayıcının içine **taşır**. O hâlde:

```compiles
question: "(Modül 4 tekrarı) Derlenir mi?"
code: |
  # struct Sepet(Vec<String>);
  fn main() {
      let urunler = vec![String::from("simit"), String::from("çay")];
      let sepet = Sepet(urunler);
      println!("{} ürün var", urunler.len());
      println!("{} ürün sepette", sepet.0.len());
  }
answer: false
error: E0382
explanation: |
  Tuple struct oluşturmak da bir atamadır: `Vec<String>` `Copy` olmadığı için `urunler` sepetin içine
  taşınır ve artık kullanılamaz. Uzunluğu sorgulamak için `sepet.0.len()` yazmalısın.
```

Newtype'ın bedeli kullanım kolaylığındadır: `Sepet`, `Vec`'in metotlarını **kendiliğinden almaz**.
`sepet.len()` yazarsan `E0599` alırsın. Çözüm yolların:

- `.0` ile içteki değere ulaşmak (yukarıdaki gibi),
- yalnızca gerçekten gereken metotları sarmalamak (`fn ekle(&mut self, ...)`, `fn uzunluk(&self)`).
  Bu çoğu zaman bir avantajdır: Dışarıya **sen** neyi açarsan o görünür (Modül 8: kapsülleme).
- `Deref` trait'iyle içteki tipin bütün `&self` metotlarını açmak (Modül 17).

Newtype yalnızca orphan rule'u aşmak için değil, Modül 6'daki `Metre`/`Fit` örneğindeki gibi
**tip güvenliği** için de kullanılır. Desenin bütün ayrıntıları Modül 20 ve 22'de.

## Blanket impl: tek impl, sonsuz tip

6. dersteki sorunun cevabı burada: `Display` uygulayan her tipe `to_string()` nasıl geliyor? Standart
kütüphanede (sadeleştirilmiş hâliyle) şu satırlar var:

```text
impl<T: Display> ToString for T {
    fn to_string(&self) -> String { /* ... */ }
}

impl<T, U> Into<U> for T
where
    U: From<T>,
{
    fn into(self) -> U {
        U::from(self)
    }
}
```

`impl<T: Display> ToString for T` şöyle okunur: *“`Display` uygulayan **her** `T` tipi için `ToString`'i
uygula.”* Belirli bir tip yerine bir tip **parametresine** yapılan bu uygulamaya **blanket impl** (battaniye
uygulaması) denir: Bütün uygun tipleri bir battaniye gibi örter. İkinci impl de 6. derste söz verdiğimiz
kuraldır: `From` yazarsan `Into` neden bedava? Çünkü `Into`, `From`'u çağıran bir blanket impl'dir.

Kendi blanket impl'ini yazmak da aynı kolaylıktadır:

```rust
use std::fmt::{self, Display};

trait Vurgula {
    fn vurgula(&self) -> String;
}

impl<T: Display> Vurgula for T {
    fn vurgula(&self) -> String {
        format!("*** {self} ***")
    }
}

struct Sicaklik(f64);

impl Display for Sicaklik {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}°C", self.0)
    }
}

fn main() {
    println!("{}", 42.vurgula());
    println!("{}", "indirim".vurgula());
    println!("{}", 'ş'.vurgula());
    println!("{}", Sicaklik(38.5).vurgula()); // Display yazdık → Vurgula bedava
}
```

`Sicaklik` için `Vurgula` yazmadık; yalnızca `Display` yazdık ve blanket impl gerisini halletti.
(`use std::fmt::{self, Display};` Modül 8'deki iç içe `use`'dur: hem `fmt` modülünü hem `Display`'i
kapsama alır.)

Blanket impl'in bir sonucu var. Tahmin et:

```compiles
code: |
  use std::fmt::Display;

  trait Vurgula {
      fn vurgula(&self) -> String;
  }

  impl<T: Display> Vurgula for T {
      fn vurgula(&self) -> String {
          format!("*** {self} ***")
      }
  }

  impl Vurgula for i32 {
      fn vurgula(&self) -> String {
          format!(">>> {self} <<<")
      }
  }

  fn main() {
      println!("{}", 42.vurgula());
  }
answer: false
error: E0119
explanation: |
  `i32`, `Display` uyguladığı için blanket impl `i32`'yi **zaten** kapsıyor. İkinci impl aynı (trait, tip)
  çifti için ikinci bir uygulama olur ve tutarlılık kuralını çiğner. C++'taki şablon özelleştirmesi
  (*template specialization*) gibi “daha özel olan kazanır” diye bir mekanizma yoktur. (Bu
  *specialization* fikri yıllardır tartışılıyor ama kararlı Rust'ta yok.)

  Kural, şu an `Display` olmayan yabancı tipleri de kapsar: `impl Vurgula for Vec<i32>` de `E0119` verir.
  Derleyicinin notu: *upstream crates may add a new impl of trait `std::fmt::Display` for type
  `std::vec::Vec<i32>` in future versions*. Standart kütüphane ileride `Vec<i32>`'ye `Display`
  ekleyebilir ve o gün iki impl çakışırdı; Rust bu ihtimali de bugünden reddeder.
```

:::error
```text
error[E0119]: conflicting implementations of trait `Vurgula` for type `i32`
  --> src/main.rs:13:1
   |
 7 | impl<T: Display> Vurgula for T {
   | ------------------------------ first implementation here
...
13 | impl Vurgula for i32 {
   | ^^^^^^^^^^^^^^^^^^^^ conflicting implementation for `i32`
```
`ToString` için de aynısı geçerli: `Display` uygulayan bir tipe ayrıca `ToString` yazamazsın (`E0119`).
Doğru yol `Display` yazmaktır, `to_string` kendiliğinden gelir. (`Display` olmayan bir tipe `ToString`'i
doğrudan yazmak derlenir, ama Clippy bunu da uyarır: o tip `{}` ile yazdırılamaz.) Blanket impl'ler
güçlüdür ama **geri alınamaz** bir sözdür: Kapsadığı tiplerin hiçbirine artık ayrı bir impl yazılamaz.
:::

```quiz
question: |
  Yukarıdaki `impl<T: Display> Vurgula for T` tanımlıyken, yalnızca `#[derive(Debug)]` yapılmış bir
  `struct Nokta { x: i32, y: i32 }` için `Nokta { x: 1, y: 2 }.vurgula()` çağrısı ne olur?
options:
  - "Çalışır; blanket impl her tipi kapsar"
  - "Derlenmez; `Nokta`, `Display` uygulamadığı için `vurgula` metodu onun için yoktur"
  - "Çalışır ve `Debug` çıktısını kullanır"
answer: 1
explanation: |
  Blanket impl yalnızca sınırı sağlayan tipleri kapsar: `T: Display`. `Nokta` yalnızca `Debug`
  uyguluyor; bu yüzden `Vurgula` onun için yoktur ve 4. dersteki koşullu metotlar gibi `E0599` alırsın
  (“the method exists but its trait bounds were not satisfied”). Çözüm `Nokta`'ya `Display` uygulamak.
feedback:
  - "Sınır (`T: Display`) blanket impl'in kapsamını daraltır."
  - Doğru!
  - "`Debug` ile `Display` farklı trait'lerdir; biri ötekinin yerine geçmez."
```

## Const generic'ler: değer parametreleri

Şu ana kadar generic'ler **tipler** üzerinde soyutlama yaptı. Ama Modül 2'deki dizilerde tipin bir parçası
bir **sayıdır**: `[i32; 3]` ile `[i32; 5]` farklı tiplerdir. Her uzunluktaki diziyle çalışan bir fonksiyon
yazmak için o sayıyı da parametre yapabilirsin:

```rust
fn toplam<const N: usize>(dizi: [i32; N]) -> i32 {
    let mut t = 0;
    for x in dizi {
        t += x;
    }
    t
}

fn main() {
    let haftalik_adim = [8_000, 12_500, 6_300];
    let notlar = [70, 85, 90, 65, 100];
    println!("{}", toplam(haftalik_adim)); // N = 3
    println!("{}", toplam(notlar)); // N = 5
    println!("{:?}", [0_u8; 40]); // 40 elemanlı dizi de Debug'dır
}
```

`const N: usize` bir **const generic** parametredir: tip değil, derleme zamanında bilinen bir **değer**.
`T` gibi argümandan çıkarılır (`N = 3`) ve monomorfizasyonla her uzunluk için ayrı kod üretilir. Const
parametreler tam sayı tipleri, `bool` ya da `char` olabilir. Gövdede `N` sıradan bir sabit gibi
kullanılır (`for i in 0..N`, `println!("{N}")`). Elle vermek istersen turbofish yazarsın:
`toplam::<3>(haftalik_adim)`. Argüman bir ifadeyse süslü parantez gerekir:
`toplam::<{ 1 + 2 }>(haftalik_adim)`.

Son satırdaki `[0_u8; 40]` küçük bir tarih dersi: Rust 1.47'ye (Ekim 2020) kadar standart kütüphane
`Debug` gibi trait'leri dizilere her uzunluk için tek tek, **yalnızca 32 elemana kadar**
uygulayabiliyordu. 33 elemanlı bir diziyi `{:?}` ile yazdıramazdın! Bugün tek bir generic impl,
`impl<T: Debug, const N: usize> Debug for [T; N]`, hepsini kapsıyor. Const generic'ler kendi kodumuz
için de 2021'de (Rust 1.51) kararlı hâle geldi.

Asıl güç kendi tiplerinde ortaya çıkar. Bir oyun motorunda kare matrislerle dönüşüm hesaplıyoruz:

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
struct Matris<const N: usize> {
    veri: [[i32; N]; N],
}

impl<const N: usize> Matris<N> {
    fn birim() -> Self {
        let mut veri = [[0; N]; N];
        for (i, satir) in veri.iter_mut().enumerate() {
            satir[i] = 1; // i. satırın i. hücresi: köşegen
        }
        Matris { veri }
    }

    fn carp(&self, diger: &Self) -> Self {
        let mut sonuc = [[0; N]; N];
        for (i, satir) in sonuc.iter_mut().enumerate() {
            for (j, hucre) in satir.iter_mut().enumerate() {
                for k in 0..N {
                    *hucre += self.veri[i][k] * diger.veri[k][j];
                }
            }
        }
        Matris { veri: sonuc }
    }
}

fn main() {
    let dondur = Matris { veri: [[0, -1], [1, 0]] }; // 90° döndürme
    let iki_kez = dondur.carp(&dondur); // 180°
    println!("{:?}", iki_kez.veri);
    println!("{}", dondur.carp(&Matris::birim()) == dondur);
    let b3 = Matris::<3>::birim();
    println!("{:?}", b3.veri);
}
```

`impl<const N: usize> Matris<N>`, 2. dersteki `impl<T> Nokta<T>`'nin aynısı: Önce bildir, sonra kullan.
`dondur.carp(&Matris::birim())` çağrısında `birim`'in `N`'si, `carp`'ın parametre tipinden (`&Self`,
yani `&Matris<2>`) çıkarıldı. `b3`'te ise çıkarılacak bir ipucu olmadığı için turbofish ile söyledik.

Döngülerde `for i in 0..N { sonuc[i][j] ... }` gibi indeksli bir yazım da çalışırdı. Ama yazdığın
dizinin satırlarını `iter_mut().enumerate()` (Modül 5 ve 9) ile gezmek hem sınır kontrolünü azaltır hem
de Clippy'nin `needless_range_loop` uyarısını önler. `hucre` bir `&mut i32` olduğu için `*hucre += ...`
yazdık. `k` döngüsü ise iki farklı matrisi indekslediği için indeksli kaldı. Peki farklı boyutlu iki
matrisi çarparsak?

```compiles
code: |
  # #[derive(Debug, Clone, Copy, PartialEq)]
  # struct Matris<const N: usize> {
  #     veri: [[i32; N]; N],
  # }
  # impl<const N: usize> Matris<N> {
  #     fn carp(&self, diger: &Self) -> Self {
  #         let mut sonuc = [[0; N]; N];
  #         for (i, satir) in sonuc.iter_mut().enumerate() {
  #             for (j, hucre) in satir.iter_mut().enumerate() {
  #                 for k in 0..N {
  #                     *hucre += self.veri[i][k] * diger.veri[k][j];
  #                 }
  #             }
  #         }
  #         Matris { veri: sonuc }
  #     }
  # }
  fn main() {
      let a = Matris { veri: [[1, 2], [3, 4]] };
      let b = Matris { veri: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
      println!("{:?}", a.carp(&b));
  }
answer: false
error: E0308
explanation: |
  `carp(&self, diger: &Self)`: `Self`, `Matris<2>` için `Matris<2>`'dir. `b` ise bir `Matris<3>`. Boyut
  **tipin parçası** olduğu için uyumsuzluk çalışma anında bir panik değil, derleme hatasıdır.
```

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:23:29
   |
23 |     println!("{:?}", a.carp(&b));
   |                        ---- ^^ expected `2`, found `3`
   |                        |
   |                        arguments to this method are incorrect
   |
   = note: expected reference `&Matris<2>`
              found reference `&Matris<3>`
```
`expected 2, found 3`: Derleyici sayıları tip gibi karşılaştırıyor. Python'daki NumPy ya da Java'daki
`int[][]` ile bu hata ancak program çalışırken ortaya çıkardı.
:::

Bir artısı daha var: Boyut derleme zamanında bilindiği için `Matris<2>` heap'e hiç dokunmaz. Aynı veriyi
`Vec<Vec<i32>>` ile tutmanın bedeline bak:

```memory
title: "Matris<2> ile Vec<Vec<i32>> bellekte"
steps:
  - caption: "`Matris<2>`: dört `i32` art arda, 16 bayt, tamamen stack'te. Ne işaretçi var ne heap; kopyalamak bile ucuz (`Copy` türetebildik)."
    stack:
      - frame: main
        vars:
          - { name: m, type: "Matris<2>", value: "1 0 | 0 1", note: "16 bayt" }
  - caption: "`Vec<Vec<i32>>`: dış `Vec` stack'te 24 bayt, heap'te iki iç `Vec` başlığı ve her satır için **ayrı** bir heap alanı. Üç bellek ayırma, iki kat işaretçi takibi ve satır uzunluklarının eşit olduğuna dair hiçbir garanti yok."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<Vec<i32>>", value: "ptr · len=2 · cap=2", to: h1 }
    heap:
      - { id: h1, value: "[ptr · len=2 · cap=2] [ptr · len=2 · cap=2]", label: "iç Vec başlıkları" }
      - { id: h2, value: "1 0", label: "1. satır" }
      - { id: h3, value: "0 1", label: "2. satır" }
```

```fill
prompt: |
  Her elemanı aynı değerle dolu, uzunluğu **const generic** olan bir dizi döndüren `doldur` fonksiyonunu
  tamamla ve onu 4 elemanlı bir dizi için turbofish ile çağır.
code: |
  fn doldur<___0>(deger: u8) -> [u8; ___1] {
      [deger; N]
  }

  fn main() {
      let dizi = doldur::<___2>(7);
      println!("{dizi:?} ({} eleman)", dizi.len());
  }
blanks:
  - ["const N: usize"]
  - ["N"]
  - ["4"]
output: "[7, 7, 7, 7] (4 eleman)"
explanation: |
  Const parametre `const` anahtar kelimesi ve tipiyle bildirilir: `const N: usize`. Dönüş tipinde ve
  gövdede (`[deger; N]`, Modül 2'deki dizi başlatıcı) adıyla kullanılır. `N` hiçbir argümandan
  çıkarılamadığı için 1. dersteki `bos_liste::<String>()` gibi turbofish şart: `doldur::<4>(7)`.
  `let dizi: [u8; 4] = doldur(7);` yazmak da işe yarardı.
```

:::info Const generic'lerin bugünkü sınırları
Kararlı Rust'ta const parametrelerle **hesap** yapamazsın: Örneğin `[i32; N + 1]` döndüren bir fonksiyon
yazılamaz. Ayrıca `f64` ya da `String` const parametre olamaz. Bu sınırlar zamanla gevşiyor. Yine de
bugünkü hâliyle bile, boyutu tipin parçası yapmak çok güçlü bir araç.
:::

## Generic mi, somut mu?

Artık elinde güçlü araçlar var: generic'ler, trait sınırları, blanket impl'ler, const generic'ler. Her
araç gibi bunların da yanlış yerde kullanımı kodu bozar. Pratik kurallar:

1. **Somut başla.** İlk sürümde `fn toplam(fiyatlar: &[u32]) -> u32` yaz. 1. dersin başındaki gibi ikinci,
   üçüncü tip gerçekten ortaya çıkınca generic'e geç. “Belki bir gün lazım olur” generic'i, kimsenin
   kullanmadığı esneklik için okunabilirlikten vazgeçmektir.
2. **Bedelini bil.** Generic kod çalışma anında bedavadır ama derleme süresi, ikili dosya boyutu (her `T`
   için bir kopya) ve hata mesajlarının uzunluğu artar (2. ders).
3. **En az sınırı iste.** Gövdede yalnızca `==` kullanıyorsan `T: PartialEq` iste, `T: Ord + Clone + Debug`
   değil. Fazladan sınır, fonksiyonu kullanabilecek tipleri gereksiz yere azaltır.
4. **Kapalı bir tip kümesi için enum.** Öğrenciler ve takımlar **aynı listede** olacaksa generic `Vec<T>`
   işe yaramaz (her `Vec`'te tek tip olur); seçenekleri biliyorsan bir enum kullan (Modül 7). Kümenin açık
   olması gerekiyorsa (başkaları yeni tipler ekleyebilmeli) trait nesneleri (`Vec<Box<dyn Trait>>`, Modül 20).
5. **Okunabilirlik.** Basit durumlarda `impl Trait`, çoklu ve uzun sınırlarda `where` (4. ders).

```quiz
question: |
  Bir kafe uygulaması yazıyorsun. Menüde **kahve**, **çay** ve **tatlı** var. Sipariş listesi bu üç türü
  **karışık** tutmalı ve her türün fiyatı farklı hesaplanıyor. Menünün yakın zamanda değişmesi
  beklenmiyor. En uygun tasarım hangisi?
options:
  - "`Kahve`, `Cay`, `Tatli` struct'ları + `trait Fiyatli` + `Vec<T> where T: Fiyatli`"
  - "`enum Urun { Kahve(..), Cay(..), Tatli(..) }` + `match` ile fiyat hesabı + `Vec<Urun>`"
  - "Her şeyi `String` olarak tutup fiyatı ürün adından hesaplamak"
answer: 1
explanation: |
  Generic bir `Vec<T>` her zaman **tek bir** somut tip tutar: ya hepsi kahve ya hepsi çay. Karışık bir liste
  için seçenekler bilinen ve kapalı bir kümeyse en sade ve en hızlı çözüm bir enum'dur: `match` her türü ele
  aldığını derleyiciye kontrol ettirir (Modül 7). Menü sık sık başkaları tarafından genişletilecek olsaydı
  `Vec<Box<dyn Fiyatli>>` (Modül 20) düşünülürdü. `String` ile modellemek ise tip güvenliğini tamamen bırakmak
  olur.
feedback:
  - "`Vec<T>` monomorfizasyonla tek bir tipe sabitlenir; kahve ve çay aynı vektörde duramaz."
  - Doğru!
  - "Yazım hatası (`\"kahev\"`) derleme zamanında yakalanmaz; Modül 7'deki “geçersiz durumları temsil edilemez yap” ilkesine ters."
```

## Alıştırmalar

```exercise
id: m11-l08-e-liste
title: Türkçe liste yazdırma
difficulty: 3
prompt: |
  Bir alışveriş uygulaması ürün listelerini cümle içinde göstermek istiyor: `"simit, çay ve peynir"`.
  `Vec<String>`'e doğrudan `Display` uygulayamayacağın için (orphan rule) bir **newtype** kullanacaksın:
  `struct Liste(Vec<String>);`

  1. **`Display for Liste`**: 0 öğe → `(boş)`, 1 öğe → `çay`, 2 öğe → `simit ve çay`,
     3 ve daha fazla öğe → `simit, çay ve peynir` (sonuncudan önce `ve`, diğerlerinin arasında `, `).
  2. **`fn ekle(&mut self, oge: impl Into<String>)`**: listeye bir öğe ekler (`&str` ve `String` kabul eder).
  3. **`fn uzunluk(&self) -> usize`**: öğe sayısı.
starter: |
  use std::fmt;

  struct Liste(Vec<String>);

  impl Liste {
      fn ekle(&mut self, oge: impl Into<String>) {
          todo!()
      }

      fn uzunluk(&self) -> usize {
          todo!()
      }
  }

  impl fmt::Display for Liste {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      let mut kahvalti = Liste(Vec::new());
      kahvalti.ekle("simit");
      kahvalti.ekle(String::from("çay"));
      kahvalti.ekle("peynir");
      println!("Kahvaltıda {kahvalti} var.");
  }
solution: |
  use std::fmt;

  struct Liste(Vec<String>);

  impl Liste {
      fn ekle(&mut self, oge: impl Into<String>) {
          self.0.push(oge.into());
      }

      fn uzunluk(&self) -> usize {
          self.0.len()
      }
  }

  impl fmt::Display for Liste {
      fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
          let ogeler = &self.0;
          match ogeler.len() {
              0 => write!(f, "(boş)"),
              1 => write!(f, "{}", ogeler[0]),
              n => {
                  write!(f, "{}", ogeler[0])?;
                  for oge in &ogeler[1..n - 1] {
                      write!(f, ", {oge}")?;
                  }
                  write!(f, " ve {}", ogeler[n - 1])
              }
          }
      }
  }

  fn main() {
      let mut kahvalti = Liste(Vec::new());
      kahvalti.ekle("simit");
      kahvalti.ekle(String::from("çay"));
      kahvalti.ekle("peynir");
      println!("Kahvaltıda {kahvalti} var ({} çeşit).", kahvalti.uzunluk());
  }
check: tests
tests: |
  fn liste(ogeler: &[&str]) -> Liste {
      let mut l = Liste(Vec::new());
      for o in ogeler {
          l.0.push(o.to_string());
      }
      l
  }

  #[test]
  fn bos_ve_tek_oge() {
      assert_eq!(liste(&[]).to_string(), "(boş)", "Boş liste \"(boş)\" yazmalı");
      assert_eq!(liste(&["çay"]).to_string(), "çay", "Tek öğe olduğu gibi yazılmalı");
  }

  #[test]
  fn iki_oge_ve_ile_baglanir() {
      assert_eq!(liste(&["simit", "çay"]).to_string(), "simit ve çay", "İki öğe arasında yalnızca \" ve \" olmalı");
  }

  #[test]
  fn uc_ve_fazla_oge() {
      assert_eq!(liste(&["simit", "çay", "peynir"]).to_string(), "simit, çay ve peynir");
      assert_eq!(
          liste(&["Adana", "Bursa", "Çorum", "Düzce"]).to_string(),
          "Adana, Bursa, Çorum ve Düzce",
          "Sonuncudan önce \" ve \", diğerlerinin arasında \", \" olmalı"
      );
  }

  #[test]
  fn ekle_ve_uzunluk() {
      let mut l = Liste(Vec::new());
      assert_eq!(l.uzunluk(), 0, "Yeni liste boş olmalı");
      l.ekle("elma");
      l.ekle(String::from("armut"));
      assert_eq!(l.uzunluk(), 2, "İki ekleme sonrası uzunluk 2 olmalı");
      assert_eq!(l.to_string(), "elma ve armut", "ekle hem &str hem String kabul etmeli");
  }
hints:
  - "`ekle`: `self.0.push(oge.into());` — `uzunluk`: `self.0.len()`. Newtype'ın içine `.0` ile ulaşılır."
  - "`fmt`'de `match self.0.len()` ile üç durum ayır: `0`, `1` ve `n` (geri kalan her şey). İlk ikisi tek bir `write!`."
  - "`n` dalında önce ilk öğeyi yaz (`write!(f, \"{}\", ogeler[0])?;`), sonra ortadaki öğeleri dilimle dolaş: `for oge in &ogeler[1..n - 1] { write!(f, \", {oge}\")?; }`. Son olarak `write!(f, \" ve {}\", ogeler[n - 1])` ile bitir. Döngüdeki `write!`'lardan sonra `?` koymayı unutma."
explanation: |
  `Liste` bellekte bir `Vec<String>`'den farksızdır, ama senin tipin olduğu için ona `Display`
  uygulayabildin. Üstelik dışarıya yalnızca seçtiğin iki metodu (`ekle`, `uzunluk`) açtın; `Vec`'in onlarca
  metodu gizli kaldı.

  `fmt`'nin içindeki `?`'ler önemli: Her `write!` bir `fmt::Result` döndürür ve yazma başarısız olursa
  hatayı hemen iletmek gerekir. `?` olmadan derleyici “kullanılmayan `Result`” uyarısı verirdi (Modül 10).
  Son `write!` ise `match` kolunun değeri olarak doğrudan döner.

  `ekle`'deki `impl Into<String>` 6. dersten: `"elma"` gelince yeni bir `String` oluşturulur, `String` gelince
  kopyalamadan taşınır.

  Alternatif: Dilimlerin `join` metodu ilk `n - 1` öğeyi tek satırda birleştirir:
  `write!(f, "{} ve {}", ogeler[..n - 1].join(", "), ogeler[n - 1])`. Daha kısa, ama araya geçici bir
  `String` ayırır; bizim çözüm her parçayı doğrudan `Formatter`'a yazıyor. `n == 2` durumunda
  `&ogeler[1..1]` boş bir dilimdir ve döngü hiç dönmez; ayrı bir dal gerekmedi.
```

```exercise
id: m11-l08-e-matris
title: Boyutu tipinde olan matrisler
difficulty: 4
prompt: |
  Bir oyun motorunun matematik modülü için `Matris<const N: usize>` tipini tamamla. `yeni` hazır; şu
  metotları yaz:

  | metot | ne yapar |
  |---|---|
  | `fn birim() -> Self` | köşegeni 1, geri kalanı 0 olan birim matris |
  | `fn iz(&self) -> i32` | köşegendeki elemanların toplamı (*trace*) |
  | `fn devrik(&self) -> Self` | satırlarla sütunların yer değiştirdiği matris: `sonuc[i][j] = veri[j][i]` |
  | `fn carp(&self, diger: &Self) -> Self` | matris çarpımı: `sonuc[i][j] = Σ veri[i][k] × diger.veri[k][j]` |

  Testler aynı kodu 1×1, 2×2 ve 3×3 matrislerle çalıştıracak.
starter: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Matris<const N: usize> {
      veri: [[i32; N]; N],
  }

  impl<const N: usize> Matris<N> {
      fn yeni(veri: [[i32; N]; N]) -> Self {
          Matris { veri }
      }

      fn birim() -> Self {
          todo!()
      }

      fn iz(&self) -> i32 {
          todo!()
      }

      fn devrik(&self) -> Self {
          todo!()
      }

      fn carp(&self, diger: &Self) -> Self {
          todo!()
      }
  }

  fn main() {
      let a = Matris::yeni([[1, 2], [3, 4]]);
      println!("{:?}", a.veri);
  }
solution: |
  #[derive(Debug, Clone, Copy, PartialEq)]
  struct Matris<const N: usize> {
      veri: [[i32; N]; N],
  }

  impl<const N: usize> Matris<N> {
      fn yeni(veri: [[i32; N]; N]) -> Self {
          Matris { veri }
      }

      fn birim() -> Self {
          let mut veri = [[0; N]; N];
          for (i, satir) in veri.iter_mut().enumerate() {
              satir[i] = 1;
          }
          Matris { veri }
      }

      fn iz(&self) -> i32 {
          let mut toplam = 0;
          for (i, satir) in self.veri.iter().enumerate() {
              toplam += satir[i];
          }
          toplam
      }

      fn devrik(&self) -> Self {
          let mut sonuc = [[0; N]; N];
          for (i, satir) in sonuc.iter_mut().enumerate() {
              for (j, hucre) in satir.iter_mut().enumerate() {
                  *hucre = self.veri[j][i];
              }
          }
          Matris { veri: sonuc }
      }

      fn carp(&self, diger: &Self) -> Self {
          let mut sonuc = [[0; N]; N];
          for (i, satir) in sonuc.iter_mut().enumerate() {
              for (j, hucre) in satir.iter_mut().enumerate() {
                  for k in 0..N {
                      *hucre += self.veri[i][k] * diger.veri[k][j];
                  }
              }
          }
          Matris { veri: sonuc }
      }
  }

  fn main() {
      let a = Matris::yeni([[1, 2], [3, 4]]);
      println!("{:?}", a.veri);
      println!("birim = {:?}", Matris::<2>::birim().veri);
      println!("iz = {}", a.iz());
      println!("devrik = {:?}", a.devrik().veri);
      println!("a × a = {:?}", a.carp(&a).veri);
  }
check: tests
tests: |
  #[test]
  fn birim_matrisler() {
      assert_eq!(Matris::<2>::birim(), Matris::yeni([[1, 0], [0, 1]]), "2×2 birim matris");
      assert_eq!(
          Matris::<3>::birim(),
          Matris::yeni([[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
          "3×3 birim matrisin köşegeni 1, geri kalanı 0 olmalı"
      );
  }

  #[test]
  fn iz_kosegen_toplamidir() {
      assert_eq!(Matris::yeni([[1, 2], [3, 4]]).iz(), 5, "1 + 4 = 5");
      assert_eq!(Matris::yeni([[2, 9, 9], [9, -3, 9], [9, 9, 10]]).iz(), 9, "2 + (-3) + 10 = 9; köşegen dışı elemanlar sayılmamalı");
      assert_eq!(Matris::<4>::birim().iz(), 4, "4×4 birim matrisin izi 4'tür");
  }

  #[test]
  fn devrik_satir_sutun_degistirir() {
      let a = Matris::yeni([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
      assert_eq!(a.devrik(), Matris::yeni([[1, 4, 7], [2, 5, 8], [3, 6, 9]]), "Satırlar sütun olmalı");
      assert_eq!(a.devrik().devrik(), a, "İki kez devrik almak matrisi geri vermeli");
  }

  #[test]
  fn carpim_dogru_hesaplanir() {
      let a = Matris::yeni([[1, 2], [3, 4]]);
      let b = Matris::yeni([[5, 6], [7, 8]]);
      assert_eq!(a.carp(&b), Matris::yeni([[19, 22], [43, 50]]), "[[1,2],[3,4]] × [[5,6],[7,8]] = [[19,22],[43,50]]");
      assert_eq!(b.carp(&a), Matris::yeni([[23, 34], [31, 46]]), "Matris çarpımı değişmeli değildir: b × a farklıdır");
      assert_eq!(a.carp(&Matris::birim()), a, "Birim matrisle çarpmak matrisi değiştirmemeli");
  }

  #[test]
  fn bir_e_bir_matris() {
      let a = Matris::yeni([[7]]);
      assert_eq!(a.carp(&Matris::yeni([[6]])).veri, [[42]], "1×1 matris çarpımı sıradan çarpmadır");
      assert_eq!(a.iz(), 7, "1×1 matrisin izi tek elemanıdır");
  }
hints:
  - "Her metot `let mut sonuc = [[0; N]; N];` ile başlayıp döngülerle doldurulabilir. `0..N` aralığı, const parametre `N`'yi sıradan bir sayı gibi kullanır."
  - "`birim`: `for (i, satir) in veri.iter_mut().enumerate() { satir[i] = 1; }` (indeksli `for i in 0..N { veri[i][i] = 1; }` da çalışır). `iz`: aynı fikirle `self.veri.iter().enumerate()` gezip `satir[i]`'leri topla. `devrik`: iki iç içe döngü, her `hucre` için `*hucre = self.veri[j][i]`."
  - "`carp` için üç iç içe döngü: `i` ve `j` sonucun hücresini seçer (`sonuc.iter_mut().enumerate()`, sonra `satir.iter_mut().enumerate()`), `k` toplamı gezer: `*hucre += self.veri[i][k] * diger.veri[k][j];`"
explanation: |
  Aynı kod 1×1'den 4×4'e kadar her boyutta çalıştı ve monomorfizasyon sayesinde her boyut için döngü
  sınırları **sabit** olan ayrı bir kopya derlendi. Derleyici bu kopyalarda döngüleri açabilir ve dizi
  sınır kontrollerini kaldırabilir.

  Daha önemlisi: `carp(&self, diger: &Self)` imzası 2×2 ile 3×3'ün çarpılmasını **derleme zamanında**
  yasaklıyor. `Vec<Vec<i32>>` ile yazsaydık her çağrıda boyutları kontrol edip `Result` döndürmek ya da
  panik yapmak zorunda kalırdık. Boyutu tipe taşımak bütün bir hata sınıfını ortadan kaldırdı.

  Döngüleri `for i in 0..N` ile indeksli yazdıysan da testler geçer; tek fark, Clippy'nin yazılan dizi
  için `needless_range_loop` uyarısı vermesi. Çözümdeki `iter_mut().enumerate()` her satıra ve hücreye
  doğrudan `&mut` verir, indeksi de yanında taşır.

  Gerçek projelerde `nalgebra` crate'i tam olarak bu fikri kullanır: `SMatrix<T, R, C>` tipinde satır ve
  sütun sayısı const generic parametrelerdir. (Oyunlarda yaygın `glam` ise `Mat2`, `Mat3`, `Mat4` gibi
  ayrı, sabit boyutlu tipler sunar.) Çarpmayı `a * b` operatörüyle yazabilmek için `std::ops::Mul`
  trait'ini uygulamak gerekir; operatör aşırı yüklemesini Modül 22'de göreceksin.
```

## Özet

:::remember
- **Orphan rule** (`E0117`): Bir `impl`'i ancak trait'in ya da tipin senin crate'inde tanımlı olduğu durumda
  yazabilirsin. Amaç **tutarlılık**: her (trait, tip) çifti için programda en fazla bir impl.
- Yabancı trait + yabancı tip → **newtype**: `struct Sepet(Vec<String>);`. Çalışma anında bedeli yok;
  içteki değere `.0` ile ulaşılır.
- **Blanket impl**: `impl<T: Display> Vurgula for T` → sınırı sağlayan her tip. `to_string()` ve `into()`
  böyle gelir. Kapsanan bir tipe ikinci impl → `E0119`.
- **Const generic**: `fn f<const N: usize>(d: [i32; N])`, `struct Matris<const N: usize>`. Boyut tipin
  parçasıdır; uyumsuzluk derleme hatasıdır (`expected 2, found 3`).
- Somut başla; ikinci tip gelince generic'e geç; en az sınırı iste; karışık ve kapalı bir küme için enum.
:::

:::ferris
Modülü bitirdin! Artık standart kütüphanenin `fn sort(&mut self) where T: Ord` ya da
`impl<T: Display> ToString for T` gibi satırlarını bir cümle gibi okuyabiliyorsun. Bir sonraki durak
yaşam süreleri: Trait sınırlarının yanında `'a` gördüğünde de ne olduğunu bileceksin. 🦀
:::

```reflect
prompt: |
  Orphan rule ilk bakışta can sıkıcı bir yasak gibi görünebilir. Rust ekosistemini (crates.io'daki binlerce
  crate'i) düşünerek bu kuralın neden gerekli olduğunu kendi cümlelerinle açıkla. Kural olmasaydı hangi
  sorunlar çıkardı?
answer: |
  Rust'ta bir trait'in bir tip için programın tamamında en fazla bir uygulaması olmalı; yoksa bir metot
  çağrısında hangi uygulamanın çalışacağı belirsiz olur. Orphan rule olmasaydı birbirinden habersiz iki crate
  aynı yabancı tipe aynı yabancı trait'i uygulayabilirdi. Bu iki crate'i aynı projede kullandığım anda
  derleme imkânsız hâle gelirdi ve suçu kimseye atamazdım.

  İkinci sorun güncellemelerdir: Standart kütüphane ya da bir crate kendi tipine yeni bir trait uygulaması
  eklediğinde, aynı impl'i daha önce kendi kodunda yazmış herkesin kodu kırılırdı. Kural, impl yazma hakkını
  trait'in ya da tipin sahibine vererek bu çakışmaları imkânsız kılıyor. Gerçekten gerekirse newtype ile
  kendi tipimi oluşturup sorunu çözebiliyorum.
```

```flashcards
- front: Orphan rule neyi yasaklar?
  back: "Hem trait'in hem tipin başka bir crate'te tanımlı olduğu impl'leri (`E0117`). Örneğin `impl Display for Vec<String>`."
- front: Orphan rule'un amacı nedir?
  back: "Tutarlılık (coherence): Her (trait, tip) çifti için programda en fazla bir impl olmalı. Böylece crate'ler çakışmaz ve güncellemeler kullanıcı kodunu kırmaz."
- front: Yabancı bir tipe yabancı bir trait'i nasıl uygularsın?
  back: "Newtype: tipi tek alanlı bir tuple struct'a sar (`struct Sepet(Vec<String>);`) ve trait'i sarmalayıcıya uygula."
- front: Newtype'ın çalışma zamanında bir bedeli var mı?
  back: "Hayır. Bellekte içteki tiple aynı yeri kaplar; tip yalnızca derleme zamanında vardır. Bedeli, içteki tipin metotlarına `.0` ya da sarmalanmış metotlarla ulaşmaktır."
- front: Blanket impl nedir? Bir örnek ver.
  back: "Bir tip parametresine, sınırı sağlayan her tip için yapılan uygulama: `impl<T: Display> ToString for T`."
- front: "`impl<T: Display> Vurgula for T` varken `impl Vurgula for i32` yazarsan ne olur?"
  back: "`E0119` (conflicting implementations): `i32` `Display` olduğu için blanket impl onu zaten kapsıyor."
- front: "`fn toplam<const N: usize>(d: [i32; N])` içindeki `N` nedir?"
  back: "Bir const generic parametre: tip değil, derleme zamanında bilinen bir değer (dizinin uzunluğu). Argümandan çıkarılır."
- front: "`Matris<2>`'nin `carp(&Self)` metoduna `Matris<3>` verirsen ne olur?"
  back: "Derleme hatası (`E0308`, `expected 2, found 3`). Boyut tipin parçasıdır."
```
