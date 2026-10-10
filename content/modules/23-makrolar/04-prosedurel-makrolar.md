---
id: m23-l04
title: Prosedürel makrolar
minutes: 26
type: lesson
objectives:
  - Üç prosedürel makro türünü (derive, attribute, fonksiyon benzeri) imzalarından ve kullanım yerlerinden ayırt edebilmek
  - Bir prosedürel makronun neden ayrı bir `proc-macro` crate'i gerektirdiğini açıklayıp proje düzenini (Cargo.toml dahil) kurabilmek
  - "`syn` ve `quote` ile basit bir `#[derive(MerhabaMakro)]` yazabilmek ve ürettiği kodu elle yazıp doğrulayabilmek"
  - Bir iş için fonksiyon, generic, `macro_rules!` veya prosedürel makro arasında gerekçeli seçim yapabilmek
keywords: [prosedürel makro, proc-macro, derive, attribute, TokenStream, syn, quote, DeriveInput, format_ident!]
---

Modül 6'dan beri yazdığın `#[derive(Debug)]`, Modül 19'daki `#[tokio::main]`, ileride göreceğin
`#[derive(Serialize)]`... Bunların hiçbiri `macro_rules!` ile yazılmadı. Hepsi, girdisini bir Rust
**programı** gibi işleyen **prosedürel makrolar (procedural macros)**. Bu derste perde arkasına geçip
kendi `derive` makronu adım adım yazacak, sonra da en önemli soruyu cevaplayacaksın: **Ne zaman yazmalı?**

:::ferris
Bu dersteki prosedürel makro kodları birden fazla crate gerektirdiği için uygulamada çalıştırılamaz.
Ama her birinin **ürettiği kodu** elle yazıp çalıştıracağız; makronun yaptığı iş tam olarak bu! 🦀
:::

## derive aslında ne yapıyor?

Modül 11'de `derive`'ın senin için `impl` blokları ürettiğini öğrenmiştin. Şimdi bunun sonucunu bir
de **tahmin** ederek sına:

```compiles
code: |
  struct Urun {
      ad: String,
  }

  #[derive(Clone)]
  struct Sepet {
      urunler: Vec<Urun>,
  }

  fn main() {
      let s = Sepet { urunler: vec![Urun { ad: String::from("çay") }] };
      let k = s.clone();
      println!("{}", k.urunler[0].ad);
  }
answer: false
error: E0277
explanation: |
  `#[derive(Clone)]` sihir yapmaz; her alan için `.clone()` çağıran bir `impl Clone for Sepet`
  **kodu üretir**. Üretilen kod da sıradan kod gibi tip denetiminden geçer: `Vec<Urun>`'un `Clone`
  olması için `Urun`'un da `Clone` olması gerekir, değil. Sonuç: `E0277`.
```

:::error Hata, makronun ürettiği kodda
```text
error[E0277]: the trait bound `Urun: Clone` is not satisfied
 --> src/main.rs:7:5
  |
5 | #[derive(Clone)]
  |          ----- in this derive macro expansion
6 | struct Sepet {
7 |     urunler: Vec<Urun>,
  |     ^^^^^^^^^^^^^^^^^^ the trait `Clone` is not implemented for `Urun`
  |
  = note: required for `Vec<Urun>` to implement `Clone`
help: consider annotating `Urun` with `#[derive(Clone)]`
```
`in this derive macro expansion` satırına dikkat: Derleyici, hatanın senin yazmadığın, makronun
ürettiği kodda olduğunu söylüyor. Çözüm `Urun`'a da `#[derive(Clone)]` eklemek.
:::

`#[derive(Clone, PartialEq)]` yazdığında derleyicinin aşağı yukarı şunu ürettiğini düşünebilirsin.
`derive`'ın işi: struct'ın tanımını **okumak** ve alan alan bu kodu **yazmak**.

```rust
struct Nokta {
    x: i32,
    y: i32,
}

// #[derive(Clone, PartialEq)] bunu senin yerine yazar:
impl Clone for Nokta {
    fn clone(&self) -> Self {
        Nokta { x: self.x.clone(), y: self.y.clone() }
    }
}

impl PartialEq for Nokta {
    fn eq(&self, diger: &Self) -> bool {
        self.x == diger.x && self.y == diger.y
    }
}

fn main() {
    let a = Nokta { x: 3, y: 4 };
    let b = a.clone();
    println!("eşit mi? {}", a == b);
    println!("({}, {})", b.x, b.y);
}
```

Bunu `macro_rules!` ile yapmak neden zor? Çünkü `derive` bir struct'ın **üzerine** yazılır ve o struct'ı
**değiştirmeden** yanına yeni kod ekler. `macro_rules!` ise yalnızca kendi parantezlerinin içine verilen
token'ları görür; ayrıca 2. derste gördüğün gibi yeni isim **uyduramaz** (`get_` + `yas`). Prosedürel
makrolar bu sınırları kaldırır: girdi olarak token'ları alır, **istediğin her Rust kodunu çalıştırarak**
(döngüler, `match`, string işlemleri...) yeni token'lar üretir.

Üç türü vardır:

| Tür | Nasıl kullanılır | Ne alır, ne yapar | Gerçek örnekler |
|-----|------------------|-------------------|-----------------|
| **Derive** (custom derive) | `#[derive(Ad)]` struct/enum'un üstüne | tanımı alır, yanına **yeni öğeler ekler**; tanımı değiştiremez | `Serialize`, `Deserialize`, `thiserror::Error`, `clap::Parser` |
| **Attribute** (attribute-like) | `#[ad]` ya da `#[ad(ayar)]` herhangi bir öğenin üstüne | attribute argümanlarını + öğeyi alır, öğeyi **tamamen yeniden yazabilir** | `#[tokio::main]`, `#[tokio::test]`, web çatılarındaki `#[get("/")]` |
| **Fonksiyon benzeri** (function-like) | `ad!(...)` | parantez içini alır, yerine kod koyar | `sqlx::query!`, `html!` (yew) |

:::analogy Kalıp ve usta
`macro_rules!` bir **pasta kalıbına** benzer: Hamuru (token'ları) içine dökersin, kalıbın şekli neyse o
çıkar; kalıp hamuru okuyamaz, sadece şekil verir. Prosedürel makro ise bir **pasta ustası**: Siparişi
(token'ları) okur, düşünür, hesap yapar ("alan sayısı kadar katman, isim için yazı") ve sıfırdan
istediği pastayı yapar. Usta daha güçlüdür ama işe almak (ayrı crate, derleme süresi) daha pahalıdır.
:::

```quiz
question: Aşağıdaki eşleştirmelerden hangisi **doğru**?
options:
  - "`#[derive(Serialize)]` → attribute makro, `#[tokio::main]` → derive makro"
  - "`#[derive(Serialize)]` → derive makro, `#[tokio::main]` → attribute makro, `sqlx::query!(...)` → fonksiyon benzeri makro"
  - "`sqlx::query!(...)` bir `macro_rules!` makrosu olmak zorundadır, çünkü `!` ile çağrılıyor"
answer: 1
explanation: |
  `derive(...)` içine yazılan her isim bir derive makrosudur. `#[tokio::main]` kendi başına bir
  attribute'tur ve `async fn main`'i, runtime'ı kuran sıradan bir `fn main`'e **yeniden yazar**
  (Modül 19). `!` ile çağrılan bir makro ise ya `macro_rules!` ya da fonksiyon benzeri bir prosedürel
  makro olabilir; çağıran taraf farkı görmez.
feedback:
  - Tam tersi. `derive(...)` listesindekiler derive, tek başına `#[...]` olanlar attribute makrodur.
  - Doğru!
  - "`!` yalnızca \"bu bir makro\" der; arkasında `macro_rules!` de, prosedürel makro da olabilir."
```

## Ayrı bir crate: `proc-macro = true`

Prosedürel makro, **derleyicinin içinde çalışan** küçük bir programdır. `rustc` senin crate'ini
derlerken makroyu bir eklenti gibi yükler, ona token'ları verir ve dönen token'ları kodun yerine koyar.
Bunun üç sonucu var:

1. Makro, onu kullanan crate'ten **önce** ve derleyicinin çalıştığı makine (host) için derlenmelidir.
2. Bu yüzden makro **kendi crate'inde** yaşar ve `Cargo.toml`'da `proc-macro = true` ile işaretlenir.
3. Böyle bir crate dışarıya **yalnızca prosedürel makro** açabilir; trait, fonksiyon ya da struct
   açamaz. Makronun `impl` edeceği trait'i başka bir crate'e koymak gerekir.

Bu yüzden derive makroları neredeyse hep **ikiz crate'ler** hâlinde gelir: `serde` + `serde_derive`,
`thiserror` + `thiserror-impl`. Modül 16'daki **workspace** düzeni burada çok işe yarar:

```text
merhaba/                       ← workspace kökü
├── Cargo.toml                 ← [workspace] members = ["merhaba_makro", "merhaba_makro_derive", "pankek"]
├── merhaba_makro/             ← trait burada (sıradan kütüphane)
│   └── src/lib.rs
├── merhaba_makro_derive/      ← prosedürel makro burada (proc-macro crate)
│   ├── Cargo.toml
│   └── src/lib.rs
└── pankek/                    ← makroyu kullanan uygulama
    └── src/main.rs
```

```toml
# merhaba_makro_derive/Cargo.toml
[package]
name = "merhaba_makro_derive"
version = "0.1.0"
edition = "2024"

[lib]
proc-macro = true      # bu crate bir derleyici eklentisidir

[dependencies]
syn = "2"              # token'ları sözdizimi ağacına çevirir (ayrıştırma)
quote = "1"            # sözdizimi ağacından / şablondan token üretir
```

Makronun girdisi ve çıktısı `proc_macro::TokenStream` tipidir: **token ağaçlarından** oluşan bir dizi.
`macro_rules!`'teki `tt` fikrinin aynısı. `struct Pankek;` bir `TokenStream` olarak üç token ağacıdır:

```text
Ident  { sym: struct }
Ident  { sym: Pankek }
Punct  { char: ';' }
```

(Diğer tür de `Group`: `( )`, `[ ]` veya `{ }` ile sarılmış bir token grubu.) Üç türün imzaları:

```rust,ignore,title=merhaba_makro_derive/src/lib.rs (imzalar)
use proc_macro::TokenStream; // proc-macro crate'lerinde derleyici bu crate'i kendisi sağlar

#[proc_macro_derive(MerhabaMakro)]           // kullanım: #[derive(MerhabaMakro)]
pub fn merhaba_derive(girdi: TokenStream) -> TokenStream { /* ... */ }

#[proc_macro_attribute]                       // kullanım: #[izle] ya da #[izle(ayar)]
pub fn izle(ayar: TokenStream, oge: TokenStream) -> TokenStream { /* ... */ }

#[proc_macro]                                 // kullanım: sabit_uret!(...)
pub fn sabit_uret(girdi: TokenStream) -> TokenStream { /* ... */ }
```

Ham `TokenStream`'i elle işlemek zahmetlidir: `struct Ogrenci<T: Clone> where ... { pub ad: String }`
gibi bir girdide hangi token'ın alan adı olduğunu bulmak, kendi Rust ayrıştırıcını yazmak demektir.
Ekosistemin iki standart aracı bu işi çözer:

- **`syn`**: `TokenStream`'i `DeriveInput`, `ItemFn`, `Expr` gibi **tipli bir sözdizimi ağacına**
  ayrıştırır. Rust'ın tam sözdizimini bilir.
- **`quote`**: `quote! { ... }` makrosuyla, içine `#degisken` yazarak değer gömdüğün bir **şablondan**
  token üretir. `macro_rules!`'teki `$degisken`'in prosedürel karşılığı.

```quiz
question: Bir derive makrosunun yanına `pub trait MerhabaMakro` tanımını da aynı crate'e koymak istiyorsun. Ne olur?
options:
  - Sorun olmaz; bir crate hem trait hem makro açabilir
  - "`proc-macro` crate'leri dışarıya yalnızca prosedürel makro açabilir; trait ayrı bir crate'te olmalı"
  - Trait'i `#[macro_export]` ile işaretlersen çalışır
answer: 1
explanation: |
  Prosedürel makro crate'i derleyiciye yüklenen bir eklentidir; normal kodun bağlandığı (link edildiği)
  bir kütüphane değildir. Bu yüzden Rust bu crate'ten makro dışında bir şey dışa aktarılmasına izin
  vermez. Yaygın çözüm: trait'i `merhaba_makro` crate'ine koy, orada makroyu yeniden dışa aktar:
  `pub use merhaba_makro_derive::MerhabaMakro;`. Trait ve derive makrosu **aynı adı** taşıyabilir,
  çünkü tipler ve makrolar ayrı **isim alanlarında (namespace)** yaşar. `serde` tam olarak böyle yapar.
feedback:
  - "Normal crate'ler için doğru, ama `proc-macro = true` olan crate'ler özeldir."
  - Doğru!
  - "`#[macro_export]` yalnızca `macro_rules!` makroları içindir (3. ders)."
```

## Adım adım: `#[derive(MerhabaMakro)]`

Hedefimiz şu: Kullanıcı bir tipin üstüne `#[derive(MerhabaMakro)]` yazınca, o tip için kendi adını
söyleyen bir `merhaba_makro()` fonksiyonu üretilsin. Önce **trait**:

```rust,ignore,title=merhaba_makro/src/lib.rs
pub trait MerhabaMakro {
    fn merhaba_makro();
}
```

Şimdi makronun kendisi. Her prosedürel makro aynı üç adımı izler: **ayrıştır → bilgiyi çıkar → üret**.

```rust,ignore,title=merhaba_makro_derive/src/lib.rs
use proc_macro::TokenStream;
use quote::quote;
use syn::{DeriveInput, parse_macro_input};

#[proc_macro_derive(MerhabaMakro)]
pub fn merhaba_makro_derive(girdi: TokenStream) -> TokenStream {
    // 1) Ayrıştır: token'ları syn'in sözdizimi ağacına çevir.
    //    Girdi geçerli bir struct/enum/union değilse, makro kullanıcıya derleme hatası döndürür.
    let ast = parse_macro_input!(girdi as DeriveInput);

    // 2) Bilgiyi çıkar: bize yalnızca tipin adı lazım (ast.ident).
    let isim = &ast.ident;

    // 3) Üret: #isim yazdığımız yere tipin adı konur.
    let uretilen = quote! {
        impl MerhabaMakro for #isim {
            fn merhaba_makro() {
                println!("Merhaba! Benim adım {}!", stringify!(#isim));
            }
        }
    };

    // quote! bir proc_macro2::TokenStream üretir; derleyiciye proc_macro::TokenStream olarak geri ver.
    uretilen.into()
}
```

Ve kullanıcı tarafı:

```toml
# pankek/Cargo.toml
[dependencies]
merhaba_makro = { path = "../merhaba_makro" }
merhaba_makro_derive = { path = "../merhaba_makro_derive" }
```

```rust,ignore,title=pankek/src/main.rs
use merhaba_makro::MerhabaMakro;
use merhaba_makro_derive::MerhabaMakro;

#[derive(MerhabaMakro)]
struct Pankek;

fn main() {
    Pankek::merhaba_makro(); // Merhaba! Benim adım Pankek!
}
```

Birkaç ayrıntı:

- `DeriveInput`'un önemli alanları: `ident` (tipin adı), `generics` (generic parametreler), `data`
  (struct mu, enum mu; alanlar/varyantlar) ve `attrs` (üstündeki attribute'lar).
- `stringify!(#isim)` derleme zamanında `"Pankek"` olur. İsim kullanıcının tipinden geldiği için makro
  **her tip için** doğru metni yazar.
- `quote!` içinde `impl MerhabaMakro for ...` yazdık. Bu, kullanıcının trait'i `use` ile içe aktarmasına
  güvenir. Daha sağlam olan, tam yol yazmaktır: `impl ::merhaba_makro::MerhabaMakro for #isim`.
  Prosedürel makrolarda `$crate` yoktur; tam yollar onun yerini tutar.

Makronun ürettiği kodu elle yazarsak derleyicinin gördüğü şey tam olarak budur. Bu bizim **çalışan
örneğimiz**:

```rust
trait MerhabaMakro {
    fn merhaba_makro();
}

struct Pankek;
struct Simit;

// #[derive(MerhabaMakro)] her tip için bu impl'i üretir:
impl MerhabaMakro for Pankek {
    fn merhaba_makro() {
        println!("Merhaba! Benim adım {}!", stringify!(Pankek));
    }
}

impl MerhabaMakro for Simit {
    fn merhaba_makro() {
        println!("Merhaba! Benim adım {}!", stringify!(Simit));
    }
}

fn main() {
    Pankek::merhaba_makro();
    Simit::merhaba_makro();
}
```

Peki biri makromuzu **generic** bir tip üzerinde kullanırsa? `#[derive(MerhabaMakro)] struct Kutu<T>(T);`
için makromuz aşağıdaki kodu üretir. Derlenir mi?

```compiles
code: |
  trait MerhabaMakro {
      fn merhaba_makro();
  }

  struct Kutu<T>(T);

  // makromuzun Kutu için ürettiği kod:
  impl MerhabaMakro for Kutu {
      fn merhaba_makro() {
          println!("Merhaba! Benim adım {}!", stringify!(Kutu));
      }
  }

  fn main() {
      let kutu = Kutu(5);
      Kutu::<i32>::merhaba_makro();
      println!("{}", kutu.0);
  }
answer: false
error: E0107
explanation: |
  `Kutu` tek başına bir tip değildir; `Kutu<T>` olarak yazılmalıdır (Modül 11). Makromuz yalnızca
  `ident`'i kullandığı için generic parametreleri unuttu: `E0107: missing generics for struct Kutu`.
  Gerçek bir derive makrosu `ast.generics`'i de kopyalamalıdır.
```

`syn` bunun için hazır bir araç sunar: `split_for_impl()` generic parametreleri `impl<...>`, `Tip<...>`
ve `where ...` için üç parçaya böler:

```rust,ignore,title=merhaba_makro_derive/src/lib.rs (generic desteği)
let (impl_gen, tip_gen, where_kosulu) = ast.generics.split_for_impl();
let uretilen = quote! {
    impl #impl_gen MerhabaMakro for #isim #tip_gen #where_kosulu {
        fn merhaba_makro() {
            println!("Merhaba! Benim adım {}!", stringify!(#isim));
        }
    }
};
```

```fill
prompt: |
  Düzeltilmiş makronun `Kutu<T>` için ürettiği kodu tamamla (`#impl_gen` ve `#tip_gen` neye dönüşür?).
code: |
  trait MerhabaMakro {
      fn merhaba_makro();
  }

  struct Kutu<T>(T);

  impl___0 MerhabaMakro for Kutu___1 {
      fn merhaba_makro() {
          println!("Merhaba! Benim adım {}!", stringify!(Kutu));
      }
  }

  fn main() {
      let kutu = Kutu("çay");
      Kutu::<&str>::merhaba_makro();
      println!("İçinde: {}", kutu.0);
  }
blanks:
  - ["<T>"]
  - ["<T>"]
output: |
  Merhaba! Benim adım Kutu!
  İçinde: çay
explanation: |
  `#impl_gen` → `<T>` (parametreleri **tanıtır**), `#tip_gen` → `<T>` (tipe **uygular**). Struct'ta
  `struct Kutu<T: Clone>` gibi sınırlar olsaydı `impl_gen` onları da taşırdı (`<T: Clone>`), `tip_gen`
  ise yalnızca `<T>` olurdu. `split_for_impl` bu ince farkı senin yerine halleder.
```

:::error Makroyu bulamayınca
Kullanıcı derive makrosunu içe aktarmayı (ya da `Cargo.toml`'a eklemeyi) unutursa:
```text
error: cannot find derive macro `MerhabaMakro` in this scope
 --> src/main.rs:5:10
  |
5 | #[derive(MerhabaMakro)]
  |          ^^^^^^^^^^^^
  |
note: `MerhabaMakro` is a trait, not a derive macro
```
Derleyici kapsamda yalnızca **trait**'i buldu. Trait ile derive makrosu aynı adı taşıyabilir ama ayrı
şeylerdir: Makroyu da `use merhaba_makro_derive::MerhabaMakro;` ile içe aktarmalısın.
:::

## Alanları gezmek, hata bildirmek ve diğer iki tür

Gerçek derive makroları alanlarla çalışır. `#[derive(Ozet)]`, her alanı `ad=değer` olarak yazan bir
`ozet()` metodu üretsin. `syn` struct'ın alanlarını `ast.data` içinde verir; `quote!`'taki
**`#( ... )*`** de tıpkı `macro_rules!`'teki `$( ... )*` gibi bir listeyi tekrarlar:

```rust,ignore,title=ozet_derive/src/lib.rs
use proc_macro::TokenStream;
use quote::quote;
use syn::{Data, DeriveInput, Fields, parse_macro_input};

#[proc_macro_derive(Ozet)]
pub fn ozet_derive(girdi: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(girdi as DeriveInput);
    let isim = &ast.ident;

    // Yalnızca adlı alanları olan struct'ları kabul et; gerisine anlaşılır bir hata ver.
    let alanlar = match &ast.data {
        Data::Struct(s) => match &s.fields {
            Fields::Named(adli) => &adli.named,
            _ => return hata(&ast.ident, "Ozet yalnızca adlı alanları olan struct'lar için kullanılabilir"),
        },
        _ => return hata(&ast.ident, "Ozet yalnızca struct'lar için kullanılabilir"),
    };
    let adlar: Vec<_> = alanlar.iter().map(|a| a.ident.as_ref().unwrap()).collect();

    quote! {
        impl Ozet for #isim {
            fn ozet(&self) -> String {
                let mut parcalar: Vec<String> = Vec::new();
                #( parcalar.push(format!("{}={:?}", stringify!(#adlar), self.#adlar)); )*
                format!("{}({})", stringify!(#isim), parcalar.join(", "))
            }
        }
    }
    .into()
}

fn hata(neresi: &syn::Ident, mesaj: &str) -> TokenStream {
    syn::Error::new_spanned(neresi, mesaj).to_compile_error().into()
}
```

`struct Ogrenci { ad: String, not: u8 }` için `quote!`'un ürettiği `TokenStream` yazdırılınca şöyle
görünür (token'lar arasında boşluk olması normaldir; derleyici için önemsizdir):

```text
impl Ozet for Ogrenci { fn ozet (& self) -> String { let mut parcalar : Vec < String > = Vec :: new () ;
parcalar . push (format ! ("{}={:?}" , stringify ! (ad) , self . ad)) ;
parcalar . push (format ! ("{}={:?}" , stringify ! (not) , self . not)) ;
format ! ("{}({})" , stringify ! (Ogrenci) , parcalar . join (", ")) } }
```

**Hata bildirmek:** Prosedürel makro `panic!` ederse kullanıcı `error: proc-macro derive panicked`
görür; çalışır ama kabadır. Doğru yol, `syn::Error::new_spanned(...).to_compile_error()` ile bir
`compile_error!` üretmektir: Hata, kullanıcının kodunda **tam ilgili yeri** gösterir. Biri
`#[derive(Ozet)]`'i bir enum'a uygularsa şunu görür:

```text
error: Ozet yalnızca struct'lar için kullanılabilir
 --> src/main.rs:4:6
  |
4 | enum Renk {
  |      ^^^^
```

**Attribute makrosu** ise öğeyi tamamen yeniden yazar. Bir fonksiyonun girişini ve çıkışını yazdıran
`#[izle]` makrosu (`syn`'in `ItemFn` tipi için `Cargo.toml`'da `syn = { version = "2", features = ["full"] }` gerekir):

```rust,ignore,title=izle/src/lib.rs
use proc_macro::TokenStream;
use quote::quote;
use syn::{ItemFn, parse_macro_input};

#[proc_macro_attribute]
pub fn izle(_ayar: TokenStream, oge: TokenStream) -> TokenStream {
    let f = parse_macro_input!(oge as ItemFn);
    let (attrs, vis, sig, govde) = (&f.attrs, &f.vis, &f.sig, &f.block);
    let ad = &sig.ident;
    quote! {
        #(#attrs)*
        #vis #sig {
            println!("→ {} başladı", stringify!(#ad));
            let sonuc = (|| #govde)();
            println!("← {} bitti", stringify!(#ad));
            sonuc
        }
    }
    .into()
}
```

Neden orijinal gövdeyi bir closure'ın (`|| ...`) içine koyup hemen çağırdık? Önce tahmin et. Aşağıda
`#[izle] fn indirim(...)`'in genişlemiş hâli var:

```predict
code: |
  fn indirim(tutar: u32) -> u32 {
      println!("→ indirim başladı");
      let sonuc = (|| {
          if tutar < 100 {
              return tutar;
          }
          tutar - tutar / 10
      })();
      println!("← indirim bitti");
      sonuc
  }

  fn main() {
      let a = indirim(50);
      let b = indirim(300);
      println!("{a} {b}");
  }
options:
  - |
    → indirim başladı
    ← indirim bitti
    → indirim başladı
    ← indirim bitti
    50 270
  - |
    → indirim başladı
    → indirim başladı
    ← indirim bitti
    50 270
  - |
    → indirim başladı
    ← indirim bitti
    → indirim başladı
    ← indirim bitti
    45 270
answer: 0
explanation: |
  Closure içindeki `return`, **fonksiyondan değil closure'dan** çıkar (Modül 14). Böylece 50 TL için
  erken dönüş olsa bile "bitti" satırı yine yazılır. Gövdeyi closure'a sarmasaydık, kullanıcının
  yazdığı `return tutar;` bütün fonksiyondan çıkar ve makronun eklediği "bitti" satırı atlanırdı.
  Attribute makrosu yazarken kullanıcının kodunun **her** biçimini (erken `return`, `?`, `async`)
  düşünmek gerekir; prosedürel makroları zorlaştıran şey de budur.
feedback:
  - Doğru! Closure erken dönüşü "yakalıyor".
  - Bu, gövde closure'a sarılmasaydı olurdu; `return` bütün fonksiyondan çıkardı.
  - "İndirim yalnızca 100 TL ve üstüne uygulanıyor: 50 → 50, 300 → 270."
```

**Fonksiyon benzeri makro** 2. dersteki duvarı da yıkar: `quote::format_ident!` ile **yeni isimler**
üretebilir. `sabit_uret!(ankara);` → `const ANKARA: &str = "ankara";`:

```rust,ignore,title=sabit_uret/src/lib.rs
use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::{Ident, parse_macro_input};

#[proc_macro]
pub fn sabit_uret(girdi: TokenStream) -> TokenStream {
    let isim = parse_macro_input!(girdi as Ident);
    let metin = isim.to_string();
    let sabit = format_ident!("{}", metin.to_uppercase()); // macro_rules! bunu yapamaz
    quote! { const #sabit: &str = #metin; }.into()
}
```

:::deep Yardımcı attribute'lar, hijyen ve test etmek
- **Yardımcı attribute'lar:** `#[proc_macro_derive(Ozet, attributes(ozet))]` yazarsan kullanıcı alanların
  üstüne `#[ozet(atla)]` yazabilir; makro bunu `field.attrs` içinde okur. `#[serde(rename = "...")]`
  böyle çalışır.
- **Hijyen:** `quote!` varsayılan olarak `Span::call_site()` kullanır; ürettiğin isimler **kullanıcının
  yazmış gibi** çözülür (hijyen yok). `macro_rules!` benzeri davranış için `Span::mixed_site()` vardır.
  Bu yüzden ürettiğin yardımcı değişkenlere çakışması zor isimler ver ve tam yollar kullan (`::std::...`).
- **Test:** Asıl dönüşümü `proc_macro2::TokenStream` alan sıradan bir fonksiyona koyarsan, onu normal
  `#[test]`'lerle test edebilirsin (`syn::parse2`, `quote!`). Kullanıcının göreceği derleme hatalarını
  test etmek için `trybuild` crate'i, genişletmeyi görmek için 3. dersteki `cargo expand` kullanılır.
:::

Şimdi aynı fikri `macro_rules!` ile, uygulamada çalışabilecek biçimde sen yaz.

```exercise
id: m23-e-ozet-turet
title: macro_rules! ile derive taklidi
difficulty: 4
prompt: |
  Bir okul uygulamasında birçok struct için `Ozet` trait'ini elle yazmaktan sıkıldın. Prosedürel makro
  için ayrı crate açmadan önce bir `macro_rules!` deniyorsun. `ozet_turet!` makrosu bir struct
  tanımını **sarmalayıp** hem struct'ı aynen üretmeli hem de `Ozet`'i uygulamalı:

  - `ozet()` → `Ogrenci(ad="Ayşe", not=90)` biçimi: tip adı, parantez içinde alanlar **tanım sırasıyla**,
    her biri `ad={:?}` biçiminde, aralarında `", "`. Alansız struct için `Bos()`.
  - `alan_adlari()` → `vec!["ad", "not"]`
  - Struct'ın üstündeki attribute'lar (`#[derive(Debug, Clone, PartialEq)]` gibi) ve `pub`
    görünürlükleri (struct'ta ve alanlarda) **korunmalı**. Sondaki virgül serbest.

  İpucu: 2. dersin `vis` ve `meta` belirteçleri burada işe yarayacak.
starter: |
  trait Ozet {
      fn ozet(&self) -> String;
      fn alan_adlari() -> Vec<&'static str>;
  }

  macro_rules! ozet_turet {
      (struct $isim:ident { $( $alan:ident : $tip:ty ),* $(,)? }) => {
          struct $isim {
              $( $alan: $tip ),*
          }

          impl Ozet for $isim {
              fn ozet(&self) -> String {
                  todo!()
              }

              fn alan_adlari() -> Vec<&'static str> {
                  todo!()
              }
          }
      };
  }

  ozet_turet! {
      struct Ogrenci {
          ad: String,
          not: u32,
      }
  }

  fn main() {
      let o = Ogrenci { ad: String::from("Ayşe"), not: 90 };
      println!("{}", o.ozet());
      println!("{:?}", Ogrenci::alan_adlari());
  }
solution: |
  trait Ozet {
      fn ozet(&self) -> String;
      fn alan_adlari() -> Vec<&'static str>;
  }

  macro_rules! ozet_turet {
      (
          $(#[$meta:meta])*
          $vis:vis struct $isim:ident {
              $( $alan_vis:vis $alan:ident : $tip:ty ),* $(,)?
          }
      ) => {
          $(#[$meta])*
          $vis struct $isim {
              $( $alan_vis $alan: $tip ),*
          }

          impl Ozet for $isim {
              fn ozet(&self) -> String {
                  #[allow(unused_mut)]
                  let mut parcalar: Vec<String> = Vec::new();
                  $( parcalar.push(format!("{}={:?}", stringify!($alan), self.$alan)); )*
                  format!("{}({})", stringify!($isim), parcalar.join(", "))
              }

              fn alan_adlari() -> Vec<&'static str> {
                  vec![ $( stringify!($alan) ),* ]
              }
          }
      };
  }

  ozet_turet! {
      struct Ogrenci {
          ad: String,
          not: u32,
      }
  }

  fn main() {
      let o = Ogrenci { ad: String::from("Ayşe"), not: 90 };
      println!("{}", o.ozet());
      println!("{:?}", Ogrenci::alan_adlari());
  }
check: tests
tests: |
  #[test]
  fn ozet_alanlari_sirayla_yazar() {
      let o = Ogrenci { ad: String::from("Ayşe"), not: 90 };
      assert_eq!(o.ozet(), "Ogrenci(ad=\"Ayşe\", not=90)", "biçim: Tip(alan=değer, ...); değerler Debug ({{:?}}) ile yazılmalı");
  }

  #[test]
  fn alan_adlarini_tanim_sirasiyla_verir() {
      assert_eq!(Ogrenci::alan_adlari(), vec!["ad", "not"], "alan adları tanım sırasıyla gelmeli");
  }

  #[test]
  fn attribute_ve_pub_korunur() {
      ozet_turet! {
          #[derive(Debug, Clone, PartialEq)]
          pub struct Urun {
              pub ad: String,
              pub fiyat: u32,
              stok: u8,
          }
      }
      let u = Urun { ad: String::from("çay"), fiyat: 45, stok: 3 };
      assert_eq!(u.clone(), u, "#[derive(...)] attribute'ları struct'a aktarılmalı");
      assert_eq!(u.ozet(), "Urun(ad=\"çay\", fiyat=45, stok=3)");
      assert_eq!(Urun::alan_adlari().len(), 3, "Urun'un 3 alanı var");
  }

  #[test]
  fn alansiz_struct() {
      ozet_turet! { struct Bos {} }
      assert_eq!(Bos {}.ozet(), "Bos()", "alansız struct'ın özeti yalnızca Tip() olmalı");
      assert!(Bos::alan_adlari().is_empty());
  }
hints:
  - "Önce gövdeleri yaz: `ozet` için bir `Vec<String>`'e her alan için `format!(\"{}={:?}\", stringify!($alan), self.$alan)` ekle, sonra `format!(\"{}({})\", stringify!($isim), parcalar.join(\", \"))` döndür. `alan_adlari` için `vec![ $( stringify!($alan) ),* ]`."
  - "Attribute'lar için eşleştiricinin başına `$(#[$meta:meta])*` ekle ve dönüştürücüde aynen `$(#[$meta])*` olarak geri yaz. Görünürlük için `$vis:vis struct $isim:ident` kullan; `vis` boş da olabilir."
  - "Alanlar da görünürlük alabilir: `$( $alan_vis:vis $alan:ident : $tip:ty ),* $(,)?`. Alansız struct'ta `parcalar`'a hiç `push` yapılmaz; `mut` uyarısını `#[allow(unused_mut)]` ile sustur."
explanation: |
  Eşleştirici, struct tanımının **bütün** sözdizimini yeniden tarif ediyor: attribute'lar (`meta`),
  görünürlük (`vis`), isim (`ident`) ve her alan için görünürlük + isim + tip. Dönüştürücü önce struct'ı
  aynen yeniden yazıyor, sonra aynı `$alan` listesinden iki metot üretiyor. `self.$alan` ile alan
  erişimi, `stringify!($alan)` ile alan adı metni elde ediliyor.

  Şimdi bunu gerçek bir `#[derive(Ozet)]` ile karşılaştır ve `macro_rules!`'in sınırlarını gör:

  - Kullanıcı struct'ını makronun **içine** yazmak zorunda; derive ise struct'ın üstüne eklenen tek
    satırdır ve başka derive'larla yan yana durur.
  - Generic struct'lar (`struct Kutu<T>`), `where` koşulları, tuple struct'lar, alan üstündeki
    attribute'lar (`#[serde(...)]` gibi) için eşleştiriciyi giderek büyütmen gerekir. `syn` bunları
    zaten bilir.
  - Hatalı girdide kullanıcı `no rules expected ...` görür; derive ise `syn::Error` ile tam yeri
    gösteren özel mesaj verebilir.

  Yine de bu yaklaşım değersiz değil: Ayrı crate, `syn` bağımlılığı ve ek derleme süresi olmadan
  çalışır. Küçük, tek crate'lik işler için `macro_rules!` çoğu zaman yeterlidir.
```

## Hangi aracı seçmeli?

Artık dört aracın var: fonksiyon, generic + trait, `macro_rules!` ve prosedürel makro. Önce generic'lerin
makrolardan çok önemli bir farkını hatırla. Bu generic fonksiyon derlenir mi?

```compiles
code: |
  fn buyuk<T>(a: T, b: T) -> T {
      if a > b { a } else { b }
  }

  fn main() {
      println!("{}", buyuk(3, 8));
  }
answer: false
error: E0369
explanation: |
  Modül 11'den: Generic bir fonksiyon, **tanımlandığı anda** bütün olası `T`'ler için denetlenir.
  `T`'nin `>` ile karşılaştırılabileceğini söylemedik: `E0369`. Çözüm `T: PartialOrd` sınırı. Makrolar
  ise **yalnızca genişledikten sonra** denetlenir: 1. dersteki `kare!` makrosu tanımlanırken hiçbir tip
  denetimi yapılmadı; hatalı bir kullanım ancak çağrı yerinde ortaya çıkar. Generic'lerin hata
  mesajları bu yüzden daha erken ve daha nettir.
```

:::error Generic'in sınır hatası
```text
error[E0369]: binary operation `>` cannot be applied to type `T`
 --> src/main.rs:2:10
  |
2 |     if a > b { a } else { b }
  |        - ^ - T
  |        |
  |        T
  |
help: consider restricting type parameter `T` with trait `PartialOrd`
  |
1 | fn buyuk<T: std::cmp::PartialOrd>(a: T, b: T) -> T {
  |           ++++++++++++++++++++++
```
:::

Karar verirken bu merdiveni **aşağıdan yukarı** çık; bir basamak işini görüyorsa daha yukarı çıkma:

| Basamak | Ne zaman | Bedeli |
|---------|----------|--------|
| 1. Fonksiyon | sabit sayıda, tipi belli girdi | yok denecek kadar az |
| 2. Generic + trait | aynı davranış birçok tip için | biraz soyutlama; hatalar erken ve net |
| 3. `macro_rules!` | değişken sayıda argüman, küçük DSL, tekrarlayan `impl`/test blokları, yeni sözdizimi | okunurluk, IDE desteği, dolaylı hata mesajları |
| 4. Prosedürel makro | bir tipin **tanımını okuyup** kod üretmek (derive), bir öğeyi yeniden yazmak (attribute), yeni isim üretmek, girdiyi derleme zamanında doğrulamak (SQL, HTML) | ayrı crate, `syn` yüzünden ciddi **derleme süresi**, ayıklaması zor, kullanıcıya "sihir" gibi gelir |

Bir de **tüketici** gözüyle bak: Ekosistemdeki iyi derive makrolarını (`Debug`, `Clone`, `Serialize`,
`thiserror::Error`, `clap::Parser`) kullanmak neredeyse bedavadır. Asıl maliyet makroyu **yazmak** ve
bakımını yapmaktadır. Bu yüzden prosedürel makrolar çoğunlukla, binlerce kişinin kullanacağı
kütüphanelerin işidir.

```quiz
question: |
  Bir veritabanı katmanında 40 farklı struct var. Her biri için, struct'ın alan adlarını ve tiplerini
  okuyarak `fn sutunlar() -> Vec<(&'static str, &'static str)>` üretmek ve alan üstüne yazılan
  `#[sutun(ad = "...")]` ayarlarını dikkate almak istiyorsun. En uygun araç hangisi?
options:
  - Her struct için elle yazılmış bir fonksiyon
  - "`fn sutunlar<T>()` gibi bir generic fonksiyon"
  - "Struct tanımlarını saran bir `macro_rules!`"
  - "Yardımcı attribute destekli bir `#[derive(Tablo)]` prosedürel makrosu"
answer: 3
explanation: |
  İş, bir tipin **tanımını okumayı** (alan adları, tipler, alan attribute'ları) gerektiriyor. Generic
  bir fonksiyon struct'ın alanlarını göremez; elle yazmak 40 kez tekrar ve unutulan alan riski demek.
  `macro_rules!` teorik olarak yapabilir ama alan attribute'larını ve generic'leri ayrıştırmak
  eşleştiriciyi okunmaz kılar. Derive + `#[sutun(...)]` yardımcı attribute'u, `sqlx` ve `diesel` gibi
  kütüphanelerin seçtiği yoldur.
feedback:
  - 40 kopya, yeni alan eklendiğinde unutulmaya mahkûm; tam da makroların çözdüğü sorun.
  - Generic'ler davranışı tipler üzerinde soyutlar ama bir struct'ın alan **adlarını** göremez.
  - Basit durumlar için olabilir (az önceki alıştırma gibi), ama alan attribute'ları ve 40 struct için bakımı zorlaşır.
  - Doğru!
```

## Özet

:::remember
- **Prosedürel makro** = derleyicinin içinde çalışan, `TokenStream` alıp `TokenStream` döndüren bir Rust fonksiyonu.
- Üç tür: `#[proc_macro_derive(Ad)]` (tanımın **yanına** öğe ekler), `#[proc_macro_attribute]`
  (öğeyi **yeniden yazar**, `(ayar, oge)` alır), `#[proc_macro]` (`ad!(...)` gibi çağrılır).
- Ayrı crate şart: `[lib] proc-macro = true`; bu crate **yalnızca makro** açabilir → trait ayrı crate'te.
- `syn` ayrıştırır (`parse_macro_input!(girdi as DeriveInput)`), `quote!` üretir (`#isim`, `#( ... )*`), sonunda `.into()`.
- Generic'ler için `split_for_impl()`; hatalar için `syn::Error::new_spanned(...).to_compile_error()`.
- Merdiven: fonksiyon → generic + trait → `macro_rules!` → prosedürel makro. Bir alt basamak yetiyorsa yukarı çıkma.
:::

```reflect
prompt: |
  Bir ekip arkadaşın "Her şeyi prosedürel makroyla yazalım, en güçlüsü o" diyor. Ona hangi durumlarda
  haklı, hangi durumlarda haksız olduğunu, maliyetleri de anarak kendi cümlelerinle açıkla.
answer: |
  Model cevap: Prosedürel makrolar gerçekten en güçlü araçtır: bir tipin tanımını okuyabilir, öğeleri
  yeniden yazabilir, yeni isimler üretebilir ve girdiyi derleme zamanında doğrulayabilir. Bir kütüphane
  kullanıcılarına `#[derive(...)]` gibi tek satırlık bir kolaylık sunacaksa haklıdır. Ama bedeli
  büyüktür: ayrı bir proc-macro crate'i gerekir, `syn` derleme süresini ciddi artırır, makroyu
  ayıklamak ve test etmek zordur, kodu okuyan biri neyin üretildiğini göremez. Fonksiyon veya generic +
  trait ile çözülebilen işlerde bu bedel boşa ödenir; generic'ler ayrıca tanım anında denetlendikleri
  için daha net hatalar verir. Değişken sayıda argüman ya da küçük bir DSL için `macro_rules!` genellikle
  yeterlidir. Kural: en basit işe yarayan araçla başla, gerçekten gerekiyorsa basamak çık.
```

```flashcards
- front: Prosedürel makronun üç türü ve her birinin attribute'u nedir?
  back: "Derive: `#[proc_macro_derive(Ad)]`, attribute: `#[proc_macro_attribute]`, fonksiyon benzeri: `#[proc_macro]`."
- front: Derive makrosu ile attribute makrosu arasındaki temel fark nedir?
  back: Derive, tanımı değiştiremez, yalnızca **yanına** yeni öğeler (genelde `impl`) ekler. Attribute makrosu öğeyi alır ve onu **tamamen yeniden yazabilir**.
- front: Bir crate'i prosedürel makro crate'i yapan Cargo.toml ayarı nedir?
  back: "`[lib]` bölümünde `proc-macro = true`."
- front: Bir derive makrosunun uyguladığı trait neden ayrı bir crate'te durur?
  back: "`proc-macro` crate'leri dışarıya **yalnızca prosedürel makro** açabilir; trait, fonksiyon veya tip açamaz."
- front: "`syn` ve `quote` crate'lerinin görevleri nedir?"
  back: "`syn` `TokenStream`'i tipli bir sözdizimi ağacına (`DeriveInput`, `ItemFn`...) **ayrıştırır**; `quote!` `#degisken` gömülü bir şablondan **token üretir**."
- front: "`quote!` içinde bir listeyi tekrarlamak için ne yazılır? (`macro_rules!`'teki `$( ... )*`'in karşılığı)"
  back: "`#( ... )*` (ayırıcıyla: `#( #adlar ),*`)."
- front: Generic bir tip için derive yazarken `impl` satırındaki generic'ler nasıl doğru kopyalanır?
  back: "`let (impl_gen, tip_gen, where_kosulu) = ast.generics.split_for_impl();` → `impl #impl_gen Trait for #isim #tip_gen #where_kosulu`."
- front: Prosedürel makroda kullanıcıya hata göstermenin doğru yolu nedir?
  back: "`panic!` değil; `syn::Error::new_spanned(oge, \"mesaj\").to_compile_error()` ile ilgili yeri gösteren bir `compile_error!` döndürmek."
```
