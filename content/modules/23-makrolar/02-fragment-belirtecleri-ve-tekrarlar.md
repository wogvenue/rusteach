---
id: m23-l02
title: Fragment belirteçleri ve tekrarlar
minutes: 20
type: lesson
objectives:
  - Bir makro girdisi için doğru fragment belirtecini (`expr`, `ident`, `ty`, `tt`, `literal`, `pat`, `block` ...) seçebilmek
  - "Follow-set kuralını açıklayıp `$x:expr`'den sonra gelemeyen token hatasını düzeltebilmek"
  - "`$( ... ),*`, `+` ve `?` tekrarlarıyla `vec!` ve `hashmap!` benzeri koleksiyon makroları yazabilmek"
  - "`ident` ve `stringify!` ile fonksiyon, struct ve enum üreten makrolar yazabilmek"
keywords: [fragment belirteci, expr, ident, ty, tt, literal, pat, block, tekrar, "$()*", vec!, hashmap!, stringify!]
---

Önceki derste `$x:expr` ile tek bir ifade yakaladın. Ama `vec![1, 2, 3]` **istediğin kadar** eleman
alıyor, `#[derive]` gibi araçlar ise isimlerden ve tiplerden yepyeni kod üretiyor. Bu derste makroların
"tip sistemini", yani **fragment belirteçlerini**, ve `vec!`'in sırrı olan **tekrarları (repetitions)**
öğreneceksin. Dersin sonunda kendi `vec!`'ini, kendi `hashmap!`'ini ve enum üreten bir makroyu yazmış olacaksın.

## Fragment belirteçleri: makro girdisinin "tipi"

`$isim:belirtec` yazdığında derleyiciye "bu noktada şu **tür** bir sözdizimi parçası bekliyorum" dersin.
Derleyici o parçayı Rust'ın kendi ayrıştırıcısıyla okur. İşte bütün liste:

| Belirteç | Ne yakalar | Örnek girdi |
|----------|------------|-------------|
| `expr` | bir ifade | `2 + 3`, `f(x)`, `"çay"`, `vec![1]` |
| `ident` | bir tanımlayıcı (isim) | `toplam`, `Ogrenci`, `hesapla` |
| `ty` | bir tip | `i32`, `Vec<String>`, `&'static str` |
| `literal` | bir sabit (başında `-` olabilir) | `42`, `-7`, `2.5`, `"Rize"`, `'ş'`, `true` |
| `pat` | bir desen | `Some(x)`, `1..=9`, `_`, `A \| B` |
| `block` | süslü parantezli bir blok | `{ let a = 1; a * 2 }` |
| `stmt` | bir deyim (sondaki `;` hariç) | `let x = 5` |
| `item` | bir öğe | `fn f() {}`, `struct Nokta;` |
| `path` | bir yol | `std::collections::HashMap` |
| `vis` | görünürlük; **boş da olabilir** | `pub`, `pub(crate)`, (hiçbir şey) |
| `lifetime` | bir yaşam süresi | `'a`, `'static` |
| `meta` | bir attribute'un içi | `derive(Debug)`, `allow(dead_code)` |
| `tt` | tek bir **token ağacı (token tree)** | `+`, `x`, `42`, `(a b c)`, `[1, 2]` |

**Token ağacı** ya tek bir token'dır ya da `()`, `[]`, `{}` ile sarılmış bir gruptur (içindekilerle
birlikte). `tt` en esnek belirteçtir, "joker" gibidir: ne geleceğini bilmediğin ya da kendin
ayrıştırmak istediğin girdiler için kullanılır. Bir sonraki derste `tt`'nin gücünü çok kullanacağız.

`ident`, `ty` ve `expr` birlikte kullanılınca makro gerçekten **kod yazmaya** başlar:

```rust
macro_rules! sabit_fonksiyon {
    ($isim:ident, $tip:ty, $deger:expr) => {
        fn $isim() -> $tip {
            $deger
        }
    };
}

sabit_fonksiyon!(pi_yaklasik, f64, 22.0 / 7.0);
sabit_fonksiyon!(plaka_kodu, u8, 61);
sabit_fonksiyon!(sehir, &'static str, "Trabzon");

fn main() {
    println!("{:.3}", pi_yaklasik());
    println!("{} {}", plaka_kodu(), sehir());
}
```

`$isim` bir `ident` olduğu için `fn $isim()` geçerli bir fonksiyon adı olur. Aynı şeyi `$isim:expr`
ile yapamazdın: ifade, fonksiyon adı yerine konamaz.

`pat` ve `block` ile de oynayalım. Modül 7'de gördüğün `matches!` makrosunu hatırla; aslında içinde
bir `match` olan küçük bir `macro_rules!` makrosudur. Kendimiz yazalım ve **tahmin edelim**:

```predict
code: |
  macro_rules! eslesir_mi {
      ($deger:expr, $desen:pat) => {
          match $deger {
              $desen => true,
              _ => false,
          }
      };
  }

  fn main() {
      let not = 7;
      println!("{}", eslesir_mi!(not, 1..=9));
      println!("{}", eslesir_mi!(Some(3), None));
      println!("{}", eslesir_mi!('ş', 'a'..='z'));
  }
options:
  - |
    true
    false
    false
  - |
    true
    false
    true
  - |
    true
    true
    false
answer: 0
explanation: |
  `$desen:pat` desenin tamamını yakalar ve `match` koluna yerleştirir. `7` → `1..=9` aralığında: `true`.
  `Some(3)` → `None` desenine uymaz: `false`. Sonuncusu sinsi: `'ş'` (U+015F) Unicode'da `'z'`'den
  (U+007A) **sonra** gelir, bu yüzden `'a'..='z'` aralığında değildir (Modül 2: `char` bir Unicode
  skaler değeridir). Standart kütüphanedeki `matches!` de neredeyse aynen böyle tanımlıdır.
```

`block` ise bir kod bloğunu olduğu gibi taşır. Bir işi "sarmalayan" makrolarda çok işe yarar:

```rust
macro_rules! adim {
    ($etiket:literal, $govde:block) => {{
        println!("[{}] başladı", $etiket);
        let sonuc = $govde;
        println!("[{}] bitti", $etiket);
        sonuc
    }};
}

fn main() {
    let toplam = adim!("toplama", {
        let notlar = [70, 85, 90];
        notlar[0] + notlar[1] + notlar[2]
    });
    println!("toplam = {toplam}");
}
```

```quiz
question: |
  `tanimla!(yas, u8, 30)` çağrısının `let yas: u8 = 30;` üretmesini istiyorsun.
  Eşleştirici `($a:___, $b:___, $c:___)` için en uygun belirteçler hangileri?
options:
  - "`ident`, `ty`, `expr`"
  - "`expr`, `expr`, `expr`"
  - "`ident`, `ident`, `literal`"
  - "`tt`, `ty`, `ident`"
answer: 0
explanation: |
  `yas` yeni bir değişkenin **adı** olacak → `ident`. `u8` bir **tip** → `ty`. `30` bir değer; ileride
  `30 * 2` gibi bir ifade de verilebilsin diye en genel seçenek `expr`.
feedback:
  - Doğru!
  - "`let $a: $b = ...` içinde `$a` bir desen/isim, `$b` bir tip olmalı; `expr` bu yerlere konamaz."
  - "`u8` tek kelimelik bir tip olduğu için `ident` ile eşleşir ama `Vec<u8>` eşleşmez; `literal` da `30 * 2`'yi reddeder."
  - "`30` bir `ident` değildir; bu eşleştirici çağrıyı reddeder."
```

## Follow-set kuralı: belirteçten sonra ne gelebilir?

Önceki dersin alıştırmasında birimi **öne** yazmıştık: `mesafe!(km 2.5)`. Daha doğal olan
`mesafe!(2.5 km)` neden olmasın? Dene:

```compiles
code: |
  macro_rules! mesafe {
      ($x:expr km) => {
          $x * 1000.0
      };
  }

  fn main() {
      println!("{}", mesafe!(2.5 km));
  }
answer: false
explanation: |
  Makro **tanımı** reddedilir: bir `expr` parçasından sonra yalnızca `=>`, `,` veya `;` gelebilir.
  Çağrıya hiç sıra gelmeden hata alırsın.
```

:::error Follow-set ihlali
```text
error: `$x:expr` is followed by `km`, which is not allowed for `expr` fragments
 --> src/main.rs:2:14
  |
2 |     ($x:expr km) => {
  |              ^^ not allowed after `expr` fragments
  |
  = note: allowed there are: `=>`, `,` or `;`
```
:::

**Neden böyle bir kural var?** Rust'ın ifade sözdizimi zamanla genişleyebilir. Bugün `2.5 km` geçerli bir
ifade değil, ama gelecekte `km` ile başlayan yeni bir ifade biçimi eklenirse, eskiden çalışan makrolar
birden farklı anlam kazanırdı. Rust, dili büyütürken **mevcut makroları bozmamayı** garanti etmek
için her belirteçten sonra gelebilecek token'ları baştan sınırlar:

| Belirteç | Arkasından gelebilecekler |
|----------|---------------------------|
| `expr`, `stmt` | `=>` `,` `;` |
| `pat` | `=>` `,` `=` `if` `in` |
| `ty`, `path` | `=>` `,` `=` `\|` `;` `:` `>` `>>` `[` `{` `as` `where` veya bir `block` değişkeni |
| `vis` | `,`, bir isim, bir tipin başlayabileceği token veya `ident`/`ty`/`path` değişkeni |
| `ident`, `literal`, `tt`, `block`, `lifetime`, `item`, `meta` | **her şey** |

Çözüm seçeneklerin: birimi öne al (`km $x:expr`), araya virgül koy (`$x:expr, km`) ya da sayıyı
`literal` olarak yakala (`$x:literal km`), çünkü `literal`'den sonra her şey gelebilir.

:::deep Edition 2024 ve `expr`
Edition 2024'te `expr` belirteci `const { ... }` bloklarını ve `_` ifadesini de yakalar. Eski davranış
gerekirse `expr_2021` kullanılabilir. Benzer şekilde 2021'den beri `pat`, `A | B` gibi "ya da"
desenlerini de yakalar (bu yüzden arkasından `|` gelemez); eski davranış `pat_param` ile alınır.
:::

## Tekrarlar: `$( ... ),*`

`vec!` gibi değişken sayıda girdi almanın anahtarı **tekrarlardır**:

```text
$( desen ) ayırıcı operatör
$( $x:expr ),*      → virgülle ayrılmış, sıfır ya da daha fazla ifade
$( $x:expr );+      → noktalı virgülle ayrılmış, en az bir ifade
$( $x:expr )?       → sıfır ya da bir ifade (ayırıcı alamaz)
```

| Operatör | Anlamı |
|----------|--------|
| `*` | sıfır veya daha fazla |
| `+` | bir veya daha fazla |
| `?` | sıfır veya bir (isteğe bağlı) |

Aynı sözdizimi dönüştürücüde de kullanılır: `$( ... )*` içindeki kod, yakalanan **her** `$x` için bir
kez tekrar üretilir.

:::analogy Düğün davetiyesi
Tekrar, matbaadaki **davetiye baskısına** benzer. Eşleştirici misafir listesini okur (`$( $isim ),*`:
virgülle ayrılmış isimler). Dönüştürücü ise tek bir davetiye şablonudur (`$( Sayın $isim, ... )*`).
Matbaa şablonu listedeki **her isim için bir kez** basar. Listede kaç kişi olduğunu önceden bilmen
gerekmez; 0 kişi de olabilir (`*`), en az 1 kişi şartı da koyabilirsin (`+`).
:::

Kendi `vec!`'imizi yazalım:

```rust
macro_rules! liste {
    ( $( $x:expr ),* ) => {
        {
            #[allow(unused_mut)]
            let mut v = Vec::new();
            $(
                v.push($x);
            )*
            v
        }
    };
}

fn main() {
    let notlar = liste![85, 92, 78];
    let bos: Vec<i32> = liste![];
    println!("{notlar:?} uzunluk={} kapasite={}", notlar.len(), notlar.capacity());
    println!("{bos:?}");

    let gercek = vec![85, 92, 78];
    println!("vec! kapasitesi={}", gercek.capacity());
}
```

`liste![85, 92, 78]` şuna genişler:

```text
{
    let mut v = Vec::new();
    v.push(85);
    v.push(92);
    v.push(78);
    v
}
```

:::warning Neden çift süslü parantez?
Dıştaki `{ }` makro sözdiziminin parçasıdır (dönüştürücünün sınırı); **çıktıya girmez**. İçteki `{ }` ise
üretilen kodu tek bir **blok ifadesi** yapar. Onsuz `let notlar = let mut v = ...;` gibi geçersiz bir
kod çıkardı. Birden çok deyim üretip bir değer döndüren makrolarda `=> {{ ... }}` yazmayı alışkanlık edin.
:::

`#[allow(unused_mut)]` neden orada? `liste![]` çağrısında hiç `push` üretilmez ve `mut` gereksiz kalır;
derleyici, makronun ürettiği kod için de `variable does not need to be mutable` uyarısı verir. Makro
yazarken "bu kod her girdide uyarısız mı?" diye düşünmek iyi bir alışkanlıktır.

Çalıştırınca `liste!`'in kapasitesinin 4, `vec!`'inkinin ise tam 3 olduğunu gördün. Bizim makromuz
boş bir `Vec` ile başlayıp `push` ettikçe büyüyor (bu sürümde kapasite 0 → 4 olarak artıyor); gerçek
`vec!` ise kaç eleman olduğunu derleme zamanında bildiği için **tek seferde** tam yer ayırıyor:

```memory
title: liste! ile vec! arasındaki fark
steps:
  - caption: "`liste![85, 92, 78]`: boş Vec'e üç `push`. İlk `push` 4 elemanlık yer ayırdı, bir yuva boş kaldı."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=3 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "85 | 92 | 78 | (boş)" }
  - caption: "`vec![85, 92, 78]`: eleman sayısı derleme zamanında belli; tek ayırma, kapasite tam 3."
    stack:
      - frame: main
        vars:
          - { name: notlar, type: "Vec<i32>", value: "ptr · len=3 · cap=4", to: h1 }
          - { name: gercek, type: "Vec<i32>", value: "ptr · len=3 · cap=3", to: h2 }
    heap:
      - { id: h1, value: "85 | 92 | 78 | (boş)" }
      - { id: h2, value: "85 | 92 | 78" }
```

Şimdi kullanıcıların çok sık yaptığı bir şeyi deneyelim: sona fazladan bir virgül.

```compiles
code: |
  macro_rules! liste {
      ( $( $x:expr ),* ) => {{
          let mut v = Vec::new();
          $( v.push($x); )*
          v
      }};
  }

  fn main() {
      let v = liste![
          "Ankara",
          "İzmir",
      ];
      println!("{v:?}");
  }
answer: false
explanation: |
  `$( $x:expr ),*` deseninde virgül yalnızca iki eleman **arasında** bir ayırıcıdır. `"İzmir",`'den
  sonra makro yeni bir ifade bekler ama girdi biter: `unexpected end of macro invocation`.
  Çözüm, isteğe bağlı bir sondaki virgül eklemek: `( $( $x:expr ),* $(,)? )`. `$(,)?` "bir virgül
  olabilir de olmayabilir de" demektir; standart `vec!` de bunu yapar.
```

:::error Tekrarı unutursan
Dönüştürücüde `$x`'i `$( ... )*` içine almayı unutursan:
```text
error: variable `x` is still repeating at this depth
 --> src/main.rs:5:20
  |
5 |             v.push($x);
  |                    ^^
```
Eşleştiricide tekrar içinde yakalanan bir değişken, dönüştürücüde de **aynı derinlikte** bir tekrar
içinde kullanılmalıdır. Aynı tekrarda iki değişken kullanıyorsan ikisi de **aynı sayıda** yakalanmış
olmalı; yoksa ``meta-variable `a` repeats 2 times, but `b` repeats 3 times`` gibi bir hata alırsın.
:::

## Kendi `hashmap!` makron

Rust'ta `HashMap` için `vec!` gibi hazır bir makro yoktur. Yazalım! Her eleman `anahtar => değer`
biçiminde olsun. `=>`, `expr`'den sonra gelebilen token'lardan biri olduğu için güvenle kullanabiliriz.

```fill
prompt: |
  Boşlukları doldur: Her `anahtar => değer` çifti için bir `insert` üretilsin ve sondaki virgül
  serbest olsun.
code: |
  macro_rules! hashmap {
      ( $( $anahtar:expr => $deger:expr ),* $(,)? ) => {{
          let mut harita = ::std::collections::HashMap::new();
          $( harita.insert(___0, ___1); )___2
          harita
      }};
  }

  fn main() {
      let nufus = hashmap! {
          "İstanbul" => 15_655_924,
          "Ankara" => 5_803_482,
      };
      println!("{}", nufus["Ankara"]);
  }
blanks:
  - ["$anahtar"]
  - ["$deger"]
  - ["*"]
output: "5803482"
explanation: |
  `$( harita.insert($anahtar, $deger); )*` her çift için bir satır üretir. İki değişken aynı tekrarda
  yakalandığı için sayıları otomatik olarak eşittir.

  Dikkat ettin mi? `HashMap`'i `::std::collections::HashMap` diye **tam yoluyla** yazdık. Makro,
  çağrıldığı yerde genişler; çağıran dosyada `use std::collections::HashMap;` olmayabilir. Tam yol
  kullanmak makroyu bağımsız kılar. (Baştaki `::` "kök"ten başla demektir; bunun inceliklerini bir
  sonraki derste `$crate` ile göreceğiz.)
```

Dönüştürücüde tekrarın içine **sabit token'lar** da koyabilirsin. Bu, bir değer listesinden tek bir
ifade kurmanın güzel bir yoludur. `0 $( + $x )*` yazınca `toplam!(4, 8, 15)` → `0 + 4 + 8 + 15` olur.

```parsons
prompt: Satırları sıraya koyarak en az bir sayı alıp toplamlarını üreten `toplam!` makrosunu ve onu kullanan programı kur.
lines: |
  macro_rules! toplam {
      ( $( $x:expr ),+ ) => {
          0 $( + $x )+
      };
  }
  fn main() {
      println!("{}", toplam!(4, 8, 15));
  }
distractors: |
      ( $x:expr ),+ => {
          0 $( + $x ),+
explanation: |
  Eşleştiricideki tekrar `$( $x:expr ),+`: virgülle ayrılmış en az bir ifade. Dönüştürücüdeki
  `0 $( + $x )+` ise ayırıcısız tekrarlanır ve `0 + 4 + 8 + 15` üretir. Çeldiricilerdeki
  `$( + $x ),+` her parçanın arasına bir virgül koyardı (`0 + 4, + 8, + 15`), bu da geçersiz bir
  ifadedir. `( $x:expr ),+` ise tekrar sözdizimi değil; `$( ... )` olmadan tekrar olmaz.
```

````exercise
id: m23-e-sepet
title: Market sepeti makrosu
difficulty: 3
prompt: |
  Bir market uygulaması için sepet kurmayı kolaylaştıran `sepet!` makrosunu yaz. Her ürün bir string
  literal'i; ürünün ardından **isteğe bağlı** olarak `x adet` gelebilir. Adet yazılmazsa **1** sayılır.
  Makro, ürünleri **yazıldıkları sırayla** `Vec<(&str, u32)>` olarak döndürmeli. Sondaki virgül serbest.

  ```text
  sepet!["elma" x 3, "ekmek", "süt" x 2]  →  [("elma", 3), ("ekmek", 1), ("süt", 2)]
  sepet![]                                →  []
  ```

  Başlangıç kodundaki `varsayilan!` yardımcı makrosunu kullanabilirsin: `varsayilan!()` → `1`,
  `varsayilan!(5)` → `5`.
starter: |
  // Yardımcı makro: argüman yoksa 1, varsa argümanın kendisi
  macro_rules! varsayilan {
      () => {
          1
      };
      ($n:expr) => {
          $n
      };
  }

  macro_rules! sepet {
      ( $( $urun:literal ),* $(,)? ) => {{
          let liste: Vec<(&str, u32)> = Vec::new();
          // her ürünü (ürün, adet) olarak ekle
          todo!();
          liste
      }};
  }

  fn main() {
      let alisveris = sepet!["simit", "çay"];
      println!("{alisveris:?}");
  }
solution: |
  // Yardımcı makro: argüman yoksa 1, varsa argümanın kendisi
  macro_rules! varsayilan {
      () => {
          1
      };
      ($n:expr) => {
          $n
      };
  }

  macro_rules! sepet {
      ( $( $urun:literal $( x $adet:expr )? ),* $(,)? ) => {{
          let mut liste: Vec<(&str, u32)> = Vec::new();
          $(
              liste.push(($urun, varsayilan!($( $adet )?)));
          )*
          liste
      }};
  }

  fn main() {
      let alisveris = sepet!["simit" x 4, "çay", "peynir" x 1];
      println!("{alisveris:?}");
  }
check: tests
tests: |
  #[test]
  fn adetli_ve_adetsiz_urunler() {
      let s = sepet!["elma" x 3, "ekmek", "süt" x 2];
      assert_eq!(s, vec![("elma", 3), ("ekmek", 1), ("süt", 2)], "adet yazılmayan ürün 1 sayılmalı, sıra korunmalı");
  }

  #[test]
  fn bos_sepet() {
      let s: Vec<(&str, u32)> = sepet![];
      assert!(s.is_empty(), "sepet![] boş bir Vec vermeli");
  }

  #[test]
  fn sondaki_virgul_serbest() {
      let s = sepet!["peynir" x 1, "zeytin",];
      assert_eq!(s.len(), 2, "sondaki virgül kabul edilmeli");
      assert_eq!(s[1], ("zeytin", 1));
  }

  #[test]
  fn adet_bir_ifade_olabilir() {
      let kisi = 3;
      let s = sepet!["yumurta" x kisi * 2, "domates" x 10];
      assert_eq!(s, vec![("yumurta", 6), ("domates", 10)], "x'ten sonra herhangi bir ifade gelebilmeli");
  }
hints:
  - "Eşleştiricide her ürünün arkasına isteğe bağlı bir grup ekle: `$( x $adet:expr )?`. Bu grup ya hiç yoktur ya da bir kez vardır."
  - "Ürün için neden `literal`? Çünkü `$urun:expr x` yazamazsın: `expr`'den sonra `x` gelemez (follow-set). `literal`'den sonra ise her şey gelebilir."
  - "Dönüştürücüde her ürün için `liste.push(($urun, varsayilan!($( $adet )?)));` üret ve `liste`'yi `mut` yap. `$( $adet )?` adet yoksa hiçbir şey, varsa adedin kendisini yazar."
explanation: |
  İç içe iki tekrar var: dıştaki `$( ... ),*` ürünler için, içteki `$( x $adet:expr )?` isteğe bağlı
  adet için. `$adet` iki tekrarın içinde yakalandığı için dönüştürücüde de iki tekrarın içinde
  kullanılıyor: dışta `$( ... )*`, içte `$( $adet )?`.

  Varsayılan değeri seçmenin püf noktası `varsayilan!` makrosu: `$( $adet )?` adet yoksa **boş**
  token dizisine, varsa adedin kendisine genişler; böylece `varsayilan!()` ya da `varsayilan!(3)`
  çağrılır ve doğru kol seçilir. `let mut adet = 1; $( adet = $adet; )?` gibi bir çözüm de çalışırdı
  ama gereksiz atama ya da gereksiz `mut` uyarılarına yol açabilirdi; `varsayilan!` her durumda tek
  ve temiz bir ifade üretir.

  Neden `$urun:literal`? `"elma" x 3` girdisinde `$urun:expr` kullansaydın tanım follow-set
  kuralına takılırdı. Bir sonraki derste `varsayilan!` gibi yardımcıları ayrı makro yerine aynı
  makronun **iç kuralları** (`@varsayilan`) olarak yazmayı göreceksin.
````

## Kod üreten makrolar: struct, impl ve enum

Makroların en güçlü olduğu yer, **tekrarlayan tanımları** üretmektir. Modül 6'daki **newtype** fikrini
hatırla: `Metre(f64)` ile `Kilogram(f64)`'ı ayrı tipler yapmak karışıklığı önler. Ama her birim için
struct, `derive` ve `Display` yazmak sıkıcı. Bırak makro yazsın:

```rust
macro_rules! birim {
    ($isim:ident, $sembol:literal) => {
        #[derive(Debug, Clone, Copy, PartialEq)]
        struct $isim(f64);

        impl $isim {
            fn aciklama() -> &'static str {
                concat!(stringify!($isim), " (", $sembol, ")")
            }
        }

        impl std::fmt::Display for $isim {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{} {}", self.0, $sembol)
            }
        }
    };
}

birim!(Metre, "m");
birim!(Kilogram, "kg");

fn main() {
    let boy = Metre(1.78);
    let kilo = Kilogram(72.5);
    println!("Boy: {boy}, kilo: {kilo}");
    println!("{} / {}", Metre::aciklama(), Kilogram::aciklama());
}
```

İki yeni yardımcı makro gördün; ikisi de derleme zamanında çalışır:

- `stringify!(...)` verilen token'ları **olduğu gibi** bir `&'static str`'ye çevirir: `stringify!(Metre)` → `"Metre"`.
- `concat!(...)` sabitleri derleme zamanında birleştirir: `concat!("Metre", " (", "m", ")")` → `"Metre (m)"`.

```compiles
code: |
  macro_rules! birim {
      ($isim:ident) => {
          #[derive(Debug, PartialEq)]
          struct $isim(f64);
      };
  }

  birim!(Metre);
  birim!(Kilogram);

  fn main() {
      println!("{}", Metre(1.0) == Kilogram(1.0));
  }
answer: false
error: E0308
explanation: |
  Makro iki **ayrı** tip üretti. `#[derive(PartialEq)]` (Modül 11) yalnızca `Metre == Metre`
  karşılaştırmasını tanımlar; `Metre` ile `Kilogram` karşılaştırılamaz: `E0308 mismatched types`.
  Newtype deseninin (Modül 6) bütün amacı da bu: birimleri karıştırmayı derleme hatasına çevirmek.
  Makro bu güvenliği bozmaz; sadece yazma zahmetini ortadan kaldırır.
```

:::warning macro_rules! yeni isim uyduramaz
`fn get_$isim()` gibi bir yazımla isimleri **birleştirip** yeni bir tanımlayıcı üretemezsin. Makro,
`get_` ve `$isim`'i iki ayrı token olarak görür. `get_`'i fonksiyonun tam adı sanır, ardından parametre
listesi bekler ama karşısına `yas` adında ikinci bir isim çıkar:
```text
error: missing parameters for function definition
 --> src/main.rs:3:16
  |
3 |         fn get_$isim() -> i32 { 42 }
  |                ^

error: expected one of `->`, `<`, `where`, or `{`, found identifier `yas`
 --> src/main.rs:3:16
  |
3 |         fn get_$isim() -> i32 { 42 }
  |                ^^^^^ expected one of `->`, `<`, `where`, or `{`
```
Çözüm: Tam ismi argüman olarak iste (`getter!(get_yas)`) ya da isim birleştirebilen bir **prosedürel
makro** kullan (örneğin `paste` crate'i, 4. derste prosedürel makroları göreceğiz).
:::

Son olarak bir enum üretelim. Gerçek projelerde çok sık ihtiyaç duyulan bir şey: bir enum'un
**bütün varyantlarını** listeleyebilmek ve her varyantın adını string olarak alabilmek. Elle yazarsan,
yeni bir varyant eklediğinde listeyi güncellemeyi unutursun; makro unutmaz.

```exercise
id: m23-e-enum-listesi
title: Varyantlarını bilen enum
difficulty: 4
prompt: |
  `enum_listesi!` makrosu `enum_listesi!(Renk { Kirmizi, Yesil, Mavi })` çağrısından şunları üretmeli:

  - `#[derive(Debug, Clone, Copy, PartialEq)]` ile işaretli `enum Renk { Kirmizi, Yesil, Mavi }`
  - `fn tumu() -> Vec<Renk>`: bütün varyantları **tanım sırasıyla** döndürür
  - `fn isim(&self) -> &'static str`: varyantın adını döndürür (`Renk::Yesil.isim()` → `"Yesil"`)

  Eşleştirici hazır. `tumu` ve `isim` gövdelerini tekrarlar ve `stringify!` ile doldur. Makro başka
  enum'lar için de çalışmalı (testler kendi enum'larını da üretecek).
starter: |
  macro_rules! enum_listesi {
      ($isim:ident { $( $varyant:ident ),+ $(,)? }) => {
          #[derive(Debug, Clone, Copy, PartialEq)]
          enum $isim {
              $( $varyant, )+
          }

          impl $isim {
              fn tumu() -> Vec<$isim> {
                  todo!()
              }

              fn isim(&self) -> &'static str {
                  todo!()
              }
          }
      };
  }

  enum_listesi!(Renk { Kirmizi, Yesil, Mavi });

  fn main() {
      for renk in Renk::tumu() {
          println!("{:?} → {}", renk, renk.isim());
      }
  }
solution: |
  macro_rules! enum_listesi {
      ($isim:ident { $( $varyant:ident ),+ $(,)? }) => {
          #[derive(Debug, Clone, Copy, PartialEq)]
          enum $isim {
              $( $varyant, )+
          }

          impl $isim {
              fn tumu() -> Vec<$isim> {
                  vec![ $( $isim::$varyant ),+ ]
              }

              fn isim(&self) -> &'static str {
                  match self {
                      $( $isim::$varyant => stringify!($varyant), )+
                  }
              }
          }
      };
  }

  enum_listesi!(Renk { Kirmizi, Yesil, Mavi });

  fn main() {
      for renk in Renk::tumu() {
          println!("{:?} → {}", renk, renk.isim());
      }
  }
check: tests
tests: |
  #[test]
  fn tumu_varyantlari_sirayla_verir() {
      assert_eq!(Renk::tumu(), vec![Renk::Kirmizi, Renk::Yesil, Renk::Mavi], "tanım sırası korunmalı");
  }

  #[test]
  fn isim_varyant_adini_verir() {
      assert_eq!(Renk::Kirmizi.isim(), "Kirmizi");
      assert_eq!(Renk::Mavi.isim(), "Mavi", "isim(), varyantın adını aynen vermeli");
  }

  #[test]
  fn baska_bir_enum_icin_de_calisir() {
      enum_listesi!(Gun { Pazartesi, Sali, Carsamba, Persembe, });
      let gunler = Gun::tumu();
      assert_eq!(gunler.len(), 4, "4 varyant tanımlandı");
      assert_eq!(gunler[3].isim(), "Persembe", "dördüncü gün Persembe olmalı");
      assert_eq!(gunler[0], Gun::Pazartesi);
  }

  #[test]
  fn tek_varyantli_enum() {
      enum_listesi!(Tek { Yalniz });
      assert_eq!(Tek::tumu(), vec![Tek::Yalniz]);
      assert_eq!(Tek::Yalniz.isim(), "Yalniz");
  }
hints:
  - "`tumu` için her varyantı bir kez yazan bir tekrar kullan: `vec![ $( ... ),+ ]`. Varyanta tam yoluyla eriş: `$isim::$varyant`."
  - "`isim` için bir `match self { ... }` üret; her varyant için bir kol: `$isim::$varyant => stringify!($varyant),`. Bu kollar da bir `$( ... )+` tekrarının içinde olmalı."
  - "`stringify!($varyant)` derleme zamanında varyant adını `&'static str`'ye çevirir. `match self` bir `&Renk` üzerinde çalışır; Rust desenleri referansa otomatik uyarlar (default binding modes)."
explanation: |
  Aynı `$varyant` listesi üç yerde tekrar kullanılıyor: enum tanımında, `tumu`'daki `vec!`'te ve
  `isim`'deki `match`'te. Yeni bir varyant eklemek için yalnızca makro çağrısını değiştirmen yeterli;
  üç yer **asla** birbirinden kopamaz. İşte kod üreten makroların asıl değeri: tek kaynaktan tutarlılık.

  Neden `*` değil de `+`? Sıfır varyantlı bir enum'da `match self {}` bir `&Bos` referansı üzerinde
  kapsayıcı sayılmaz ve derlenmez; `+` boş çağrıyı daha makro seviyesinde reddeder. Desen ayrıca
  sondaki virgülü de kabul ediyor (`$(,)?`).

  Gerçek dünyada bu ihtiyaç için `strum` gibi crate'ler `#[derive(EnumIter, AsRefStr)]` gibi
  **prosedürel** makrolar sunar. 4. derste onların nasıl yazıldığını göreceksin.
```

## Özet

:::remember
- `$ad:belirtec`: `expr` ifade, `ident` isim, `ty` tip, `literal` sabit, `pat` desen, `block` blok,
  `tt` tek token ağacı (en esnek). Ayrıca `stmt`, `item`, `path`, `vis`, `lifetime`, `meta`.
- **Follow-set**: `expr`/`stmt`'ten sonra yalnızca `=>` `,` `;` gelebilir. `ident`, `literal`, `tt`'den
  sonra her şey gelebilir.
- Tekrar: `$( ... ) ayırıcı operatör`: `*` (0+), `+` (1+), `?` (0/1). Sondaki virgül için `$(,)?`.
- Dönüştürücüde tekrar değişkenleri **aynı derinlikte** bir `$( ... )*` içinde kullanılır.
- Değer döndüren çok deyimli makrolar: `=> {{ ... }}`. Makro içinde tam yollar: `::std::...`.
- `stringify!` token'ları string yapar, `concat!` sabitleri birleştirir; `macro_rules!` yeni isim **birleştiremez**.
:::

```reflect
prompt: |
  `enum_listesi!` makrosu yerine enum'u, `tumu()`'yu ve `isim()`'i elle yazsaydın uzun vadede ne gibi
  bir risk oluşurdu? Makronun bu riski nasıl ortadan kaldırdığını kendi cümlelerinle açıkla.
answer: |
  Model cevap: Elle yazınca varyant listesi üç yerde tekrar eder: enum tanımı, `tumu()` içindeki liste
  ve `isim()` içindeki `match`. Yeni bir varyant eklendiğinde `match` derleyici sayesinde hata verir
  (kapsayıcılık), ama `tumu()` listesine eklemeyi unutmak sessiz bir hatadır: Program derlenir, sadece
  yanlış çalışır. Makroda ise üç yer de aynı tek `$varyant` listesinden üretildiği için birbirinden
  kopamaz; tek kaynak, tutarlılığı garanti eder.
```

```flashcards
- front: "`tt` belirteci neyi yakalar?"
  back: "Tek bir **token ağacını**: ya tek bir token (`+`, `x`, `42`) ya da `()`, `[]`, `{}` ile sarılmış bir grubun tamamı."
- front: "`$x:expr`'den sonra hangi token'lar gelebilir?"
  back: "Yalnızca `=>`, `,` ve `;` (follow-set kuralı)."
- front: Follow-set kuralı neden var?
  back: Rust sözdizimi ileride genişlediğinde mevcut makroların anlamının değişmemesini (bozulmamasını) garanti etmek için.
- front: "`*`, `+` ve `?` tekrar operatörlerinin anlamı?"
  back: "`*` sıfır veya daha fazla, `+` bir veya daha fazla, `?` sıfır veya bir (ayırıcı alamaz)."
- front: Makroda sondaki virgülü kabul etmenin yolu nedir?
  back: "Tekrardan sonra `$(,)?` eklemek: `( $( $x:expr ),* $(,)? )`."
- front: "`variable 'x' is still repeating at this depth` hatası ne demek?"
  back: "Tekrar içinde yakalanan `$x`, dönüştürücüde bir `$( ... )*` tekrarının dışında kullanılmış."
- front: "Değer döndüren çok satırlı bir makroda neden `=> {{ ... }}` yazılır?"
  back: Dış parantez makro sözdiziminin parçasıdır; içteki üretilen kodu tek bir **blok ifadesi** yapar.
- front: "`stringify!(Metre)` neyi üretir?"
  back: "Derleme zamanında `\"Metre\"` string'ini (`&'static str`)."
```
