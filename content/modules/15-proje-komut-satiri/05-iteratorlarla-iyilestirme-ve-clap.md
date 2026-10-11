---
id: m15-l05
title: Iterator'larla iyileştirme ve clap
minutes: 35
type: project
objectives:
  - "`Config::build`'i `impl Iterator<Item = String>` alacak şekilde yeniden yazıp gereksiz `clone`'lardan kurtulabilmek"
  - "`ara` ve `ara_buyuk_kucuk_duyarsiz`'ı `filter` ve `collect` ile döngüsüz yazıp iki sürümü karşılaştırabilmek"
  - "`clap`'in derive API'siyle argüman ayrıştırmanın el yapımı çözüme göre kazançlarını açıklayabilmek"
  - "Projeyi satır numarası gibi yeni özelliklerle genişletebilmek"
keywords: [iterator, impl Iterator, next, let else, filter, collect, enumerate, clone, sıfır maliyet, clap, derive, Parser, ripgrep]
---

`ara` çalışıyor: argümanları okuyor, dosyayı açıyor, iki modda arıyor, hataları doğru kanala yazıyor ve
testleri var. Bu derste iki şey yapacağız. Önce, Modül 14'te öğrendiğin **iterator'larla** kodu daha sade ve
daha verimli hâle getireceğiz. Sonra kendi yazdığımız argüman ayrıştırmayı, Rust dünyasında gerçek
araçların kullandığı **`clap`** crate'iyle karşılaştıracağız.

Yeniden yapılandırmanın (refactoring) altın kuralını hatırla: **testler yeşilken başla, her adımdan sonra
testleri çalıştır.** Üçüncü derste yazdığımız testler, şimdi yapacağımız değişikliklerin güvencesi.

## clone'ların kaynağı: ödünç alınan dilim

`Config::build` şu an `&[String]` alıyor ve iki `clone` yapıyor. Neden? Çünkü dilim yalnızca **ödünç**:
`String`'lerin sahibi `main`'deki `args` vektörü ve onları dilimden dışarı taşıyamayız (birinci dersteki
`E0507`). Ama bir dakika: `env::args()` zaten bize **sahipli** `String`'ler üreten bir iterator. Biz onları
bir vektöre topluyor, sonra ödünç veriyor, sonra da kopyalıyoruz. Gereksiz bir dolambaç.

```memory
title: Dilim alan build ile iterator alan build
steps:
  - caption: "Eski sürüm: `args` vektörü üç `String`'in sahibi. `build` dilimi ödünç alır ve `sorgu` ile `dosya_yolu`'nu **kopyalar**. Aynı metinler heap'te iki kez duruyor."
    stack:
      - frame: main
        vars:
          - { name: args, type: "Vec<String>", value: "ptr · len=3", to: h1 }
          - { name: config.sorgu, type: String, value: "ptr · len=4", to: h4 }
          - { name: config.dosya_yolu, type: String, value: "ptr · len=8", to: h5 }
    heap:
      - { id: h1, value: "[\"ara\", \"rust\", \"siir.txt\"]", label: "args'ın String'leri" }
      - { id: h4, value: "r u s t", label: "kopya" }
      - { id: h5, value: "s i i r . t x t", label: "kopya" }
  - caption: "Yeni sürüm: `env::args()`'tan gelen `String`'ler `next()` ile tek tek alınır ve sahiplikleri **doğrudan** `Config`'e taşınır. Vektör yok, kopya yok."
    stack:
      - frame: main
        vars:
          - { name: config.sorgu, type: String, value: "ptr · len=4", to: h2 }
          - { name: config.dosya_yolu, type: String, value: "ptr · len=8", to: h3 }
    heap:
      - { id: h2, value: "r u s t", label: "args'tan taşındı" }
      - { id: h3, value: "s i i r . t x t", label: "args'tan taşındı" }
```

:::analogy Vitrin ve kargo bandı
Eski sürüm bir **vitrin** gibi: ürünler (argümanlar) camın arkasında duruyor, sen yalnızca bakabiliyorsun
(ödünç). Bir tanesini eve götürmek istersen, kopyasını çıkarman (`clone`) gerekiyor. Yeni sürüm ise bir
**kargo bandı**: paketler sırayla önünden geçiyor ve her `next()`'te bir paketi banttan **alıp** kendine
ayırıyorsun. Aldığın paket artık senin; kopyalamaya gerek yok, bantta da geri kalmıyor.
:::

Yeni imza: `build`, `String` üreten **herhangi bir** iterator'ı **değer olarak** alsın:

```rust,ignore
pub fn build(
    mut args: impl Iterator<Item = String>,
    buyuk_kucuk_duyarsiz: bool,
) -> Result<Config, &'static str>
```

`impl Iterator<Item = String>`, Modül 11'deki **argüman konumunda `impl Trait`** yazımıdır: "`Item` tipi
`String` olan, `Iterator` trait'ini uygulayan herhangi bir tip". `env::args()`'ın döndürdüğü `std::env::Args`
de, testlerde kullanacağımız `vec![...].into_iter()` de bu tanıma uyar. Bu bir **generic** fonksiyondur;
derleyici her tip için ayrı bir kopya üretir (monomorphization), çalışma anında ek maliyet yoktur.

`main` artık `collect` yapmaz; iterator'ı doğrudan verir:

```rust,ignore
let config = Config::build(env::args(), buyuk_kucuk_duyarsiz).unwrap_or_else(|hata| { ... });
```

İmzadaki `mut`'a dikkat. Onsuz derlenir mi?

```compiles
code: |
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  impl Config {
      pub fn build(args: impl Iterator<Item = String>) -> Result<Config, &'static str> {
          args.next();
          let Some(sorgu) = args.next() else {
              return Err("sorgu verilmedi");
          };
          let Some(dosya_yolu) = args.next() else {
              return Err("dosya yolu verilmedi");
          };
          Ok(Config { sorgu, dosya_yolu })
      }
  }
answer: false
error: E0596
explanation: |
  `Iterator::next` imzası `fn next(&mut self) -> Option<Self::Item>`'dır: her çağrı iterator'ın iç
  durumunu (nerede kaldığını) **değiştirir**, bu yüzden `&mut` ödünç ister. Değiştirilebilir ödünç almak
  için değişkenin `mut` olması gerekir; parametreler de birer değişkendir.
```

:::error
```text
error[E0596]: cannot borrow `args` as mutable, as it is not declared as mutable
  --> src/lib.rs:7:18
   |
 7 |     pub fn build(args: impl Iterator<Item = String>) -> Result<Config, &'static str> {
   |                  ^^^^ not mutable
 8 |         args.next();
   |         ---- cannot borrow as mutable
 9 |         let Some(sorgu) = args.next() else {
   |                           ---- cannot borrow as mutable
...
12 |         let Some(dosya_yolu) = args.next() else {
   |                                ---- cannot borrow as mutable
   |
help: consider changing this to be mutable
   |
 7 |     pub fn build(mut args: impl Iterator<Item = String>) -> Result<Config, &'static str> {
   |                  +++
```
`mut args`, çağıranı hiç etkilemez: iterator'ın sahipliği zaten fonksiyona geçti; `mut` yalnızca
fonksiyonun **kendi** değişkeniyle ne yapabileceğini söyler.
:::

```quiz
question: |
  `build(mut args: impl Iterator<Item = String>, ...)` imzasıyla aşağıdaki çağrılardan hangisi
  **derlenmez**?
options:
  - "`Config::build(env::args(), false)`"
  - "`Config::build(vec![String::from(\"ara\")].into_iter(), false)`"
  - "`Config::build(vec![\"ara\", \"rust\"].into_iter(), false)`"
  - "`Config::build([\"ara\", \"rust\"].into_iter().map(String::from), false)`"
answer: 2
explanation: |
  `vec!["ara", "rust"].into_iter()` bir `&str` iterator'ıdır: `Item = &str`. İmza ise `Item = String`
  istiyor, bu yüzden derlenmez (E0271, tip uyuşmazlığı). Son seçenekte `map(String::from)` her `&str`'yi bir
  `String`'e çevirir, böylece `Item = String` olur. Modül 14: iterator adaptörleri `Item` tipini
  dönüştürebilir.
feedback:
  - "`env::args()` tam olarak `String` üreten bir iterator'dır; bu imza onun için tasarlandı."
  - "`Vec<String>`'in `into_iter()`'i sahipli `String`'ler üretir; uygun."
  - Doğru!
  - "`map(String::from)` öğeleri `String`'e çevirir; uygun."
```

## next ile adım adım ayrıştırmak

Artık indeksleme yok (`args[1]` bir iterator'da yazılamaz). Onun yerine `next()` ile sırayla ilerliyoruz.
Her `next()` bir `Option<String>` döndürür: `Some(arg)` ya da iterator bittiyse `None`. Resmî kitap `match`
kullanır; Modül 7'deki **`let ... else`** ise aynı şeyi daha düz yazar:

```rust
pub struct Config {
    pub sorgu: String,
    pub dosya_yolu: String,
    pub buyuk_kucuk_duyarsiz: bool,
}

impl Config {
    pub fn build(
        mut args: impl Iterator<Item = String>,
        buyuk_kucuk_duyarsiz: bool,
    ) -> Result<Config, &'static str> {
        args.next(); // ilk değer programın yolu; atla

        let sorgu = match args.next() {
            Some(arg) => arg,
            None => return Err("sorgu verilmedi"),
        };

        let Some(dosya_yolu) = args.next() else {
            return Err("dosya yolu verilmedi");
        };

        Ok(Config { sorgu, dosya_yolu, buyuk_kucuk_duyarsiz })
    }
}

fn main() {
    let tam = vec![String::from("ara"), String::from("rust"), String::from("siir.txt")];
    match Config::build(tam.into_iter(), false) {
        Ok(c) => println!("'{}' -> {}", c.sorgu, c.dosya_yolu),
        Err(e) => println!("hata: {e}"),
    }

    let eksik = ["ara", "rust"].into_iter().map(String::from);
    match Config::build(eksik, false) {
        Ok(c) => println!("'{}' -> {}", c.sorgu, c.dosya_yolu),
        Err(e) => println!("hata: {e}"),
    }
}
```

(İki yazımı yan yana gösterdik; kendi kodunda birini seç ve tutarlı ol.) Hem `match` hem `let-else`
`None` durumunda fonksiyondan **erken döner**. `return Err(...)`'un tipi `!` olduğu için (ikinci derste
`process::exit` için gördüğümüz gibi) `match` kolları arasında tip uyuşmazlığı oluşmaz. Bir kazanç daha:
hata mesajları artık **neyin** eksik olduğunu söylüyor.

```predict
code: |
  fn main() {
      let mut args = ["ara", "-i", "rust"].into_iter();
      args.next();
      let ilk = args.next();
      let ikinci = args.next();
      let ucuncu = args.next();
      println!("{ilk:?} {ikinci:?} {ucuncu:?}");
      println!("{:?}", args.next());
  }
options:
  - |
    Some("-i") Some("rust") None
    None
  - |
    Some("ara") Some("-i") Some("rust")
    None
  - |
    Some("-i") Some("rust") None
    Some("ara")
answer: 0
explanation: |
  İlk `next()` `"ara"`'yı tüketti (değerini atladık). Sonraki iki çağrı `"-i"` ve `"rust"`'ı verir; dizi
  bitince her `next()` `None` döndürür. Iterator başa **sarmaz**. Ayrıca dikkat: `"-i"` bir seçenek olarak
  değil, sıradan bir argüman olarak geldi. Bizim `build`'imiz onu sorgu sanırdı! Dersin ilerisindeki
  `clap` bölümü bu sorunu çözecek.
```

```exercise
id: m15-e-build-iterator
title: "Config::build: iterator sürümü"
difficulty: 3
prompt: |
  `Config::build`'i iterator alan sürümüyle yaz:

  - İlk değer program yoludur; atla. (Hiç değer yoksa da sorun değil.)
  - Sonraki değer sorgudur; yoksa `Err("sorgu verilmedi")`.
  - Sonraki değer dosya yoludur; yoksa `Err("dosya yolu verilmedi")`.
  - `buyuk_kucuk_duyarsiz` parametresi olduğu gibi `Config`'e konur. Fazladan değerler yok sayılır.

  Bu kez değerleri bir vektöre **toplama** ve **kopyalama**: sahipliği `next()` ile doğrudan al.
starter: |
  #[derive(Debug)]
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
      pub buyuk_kucuk_duyarsiz: bool,
  }

  impl Config {
      pub fn build(
          mut args: impl Iterator<Item = String>,
          buyuk_kucuk_duyarsiz: bool,
      ) -> Result<Config, &'static str> {
          todo!()
      }
  }
solution: |
  #[derive(Debug)]
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
      pub buyuk_kucuk_duyarsiz: bool,
  }

  impl Config {
      pub fn build(
          mut args: impl Iterator<Item = String>,
          buyuk_kucuk_duyarsiz: bool,
      ) -> Result<Config, &'static str> {
          args.next();

          let Some(sorgu) = args.next() else {
              return Err("sorgu verilmedi");
          };
          let Some(dosya_yolu) = args.next() else {
              return Err("dosya yolu verilmedi");
          };

          Ok(Config { sorgu, dosya_yolu, buyuk_kucuk_duyarsiz })
      }
  }
check: tests
tests: |
  fn argumanlar(parcalar: &[&str]) -> std::vec::IntoIter<String> {
      let mut v = Vec::new();
      for p in parcalar {
          v.push(p.to_string());
      }
      v.into_iter()
  }

  #[test]
  fn tam_argumanlarla_config() {
      let c = Config::build(argumanlar(&["ara", "çay", "menu.txt"]), true).expect("Ok bekleniyordu");
      assert_eq!(c.sorgu, "çay");
      assert_eq!(c.dosya_yolu, "menu.txt");
      assert!(c.buyuk_kucuk_duyarsiz, "bayrak olduğu gibi aktarılmalı");
  }

  #[test]
  fn baska_iterator_turleriyle_de_calisir() {
      let it = ["/bin/ara", "Ferris", "yengec.txt", "fazla"].into_iter().map(String::from);
      let c = Config::build(it, false).expect("Ok bekleniyordu");
      assert_eq!((c.sorgu.as_str(), c.dosya_yolu.as_str()), ("Ferris", "yengec.txt"), "ilk değer atlanmalı, fazlası yok sayılmalı");
      assert!(!c.buyuk_kucuk_duyarsiz);
  }

  #[test]
  fn dosya_yolu_eksik() {
      let hata = Config::build(argumanlar(&["ara", "çay"]), false).unwrap_err();
      assert_eq!(hata, "dosya yolu verilmedi");
  }

  #[test]
  fn sorgu_eksik() {
      assert_eq!(Config::build(argumanlar(&["ara"]), false).unwrap_err(), "sorgu verilmedi");
      assert_eq!(Config::build(argumanlar(&[]), false).unwrap_err(), "sorgu verilmedi", "boş iterator'da da panik değil Err dönmeli");
  }
hints:
  - "`args.next();` ile program yolunu atla; dönen `Option`'ı kullanmana gerek yok."
  - "`let Some(sorgu) = args.next() else { return Err(\"sorgu verilmedi\"); };` kalıbını kullan (ya da `match`)."
  - "Aynı kalıbı `dosya_yolu` için tekrarla ve `Ok(Config { sorgu, dosya_yolu, buyuk_kucuk_duyarsiz })` döndür."
forbid:
  - pattern: "\\.clone\\(\\)|collect"
    message: "Bu alıştırmada `clone` ya da `collect` kullanma; `next()` ile sahipliği doğrudan al."
explanation: |
  `next()` her çağrıda iterator'dan **sahipli** bir `String` çıkarır; `let-else` onu `Some`'dan açıp
  doğrudan `sorgu` değişkenine bağlar. Sahiplik zinciri şöyle: işletim sistemi → `env::args()` → `next()`
  → `Config`'in alanı. Hiçbir aşamada kopya yok.

  Testlerde `build`'e iki farklı tipte iterator verdik (`vec::IntoIter<String>` ve `Map<array::IntoIter<&str,
  4>, ...>`). İkisi de çalıştı, çünkü `impl Iterator<Item = String>` "bu trait'i uygulayan herhangi bir
  tip" demek. Bu esneklik sayesinde `main` gerçek `env::args()`'ı, testler ise taklit verileri kullanabiliyor.

  İlk `args.next();` satırında dönen değeri yok saydık; iterator boşsa `None` döner ve bu bir hata değildir.
  Sonraki `next()` da `None` döneceği için doğal olarak `"sorgu verilmedi"`'ye düşeriz.
```

## ara'yı filter ve collect ile yazmak

Üçüncü derste `ara`'yı bir döngü, değiştirilebilir bir vektör ve bir `if` ile yazmıştık. Aynı mantık bir
iterator zinciri olarak:

```rust
pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    icerik
        .lines()
        .filter(|satir| satir.contains(sorgu))
        .collect()
}

fn main() {
    let siir = "\
Rust öğrenmek bir yolculuktur,
her hata yeni bir ders verir.
Derleyici sabırlı bir öğretmendir;
rust gibi paslanmaz bilgi bırakır.";

    println!("{:?}", ara("bir", siir));
    println!("{:?}", ara("rust", siir));
}
```

Satır satır: `lines()` satırları üretir, `filter` closure'ı `true` döndüren satırları geçirir, `collect`
sonucu dönüş tipinin istediği koleksiyona (`Vec<&'a str>`) toplar. Closure, `sorgu`'yu ortamdan **ödünç
alarak** yakalar (Modül 14). `filter`'ın closure'ı öğeye bir referans alır (`satir: &&str`); metot
çağrılarındaki otomatik deref sayesinde `satir.contains(...)` yine çalışır.

`sonuclar` diye bir değişken, `mut`, `push` yok. Kod **ne** yaptığını söylüyor ("içeren satırları süz ve
topla"), **nasıl** yaptığını değil. Testleri çalıştır; hepsi hâlâ yeşil olmalı.

Iterator'ların tembel (lazy) olduğunu da hatırla: hiçbir şey, bir tüketici (consumer) değerleri isteyene
kadar çalışmaz. Tahmin et:

```predict
code: |
  fn main() {
      let icerik = "kedi\nköpek\nkuş\nkedicik";
      let ilk: Vec<&str> = icerik
          .lines()
          .filter(|s| {
              println!("bakılıyor: {s}");
              s.contains("ke")
          })
          .take(1)
          .collect();
      println!("{ilk:?}");
  }
options:
  - |
    bakılıyor: kedi
    bakılıyor: köpek
    bakılıyor: kuş
    bakılıyor: kedicik
    ["kedi"]
  - |
    bakılıyor: kedi
    ["kedi"]
  - |
    ["kedi"]
answer: 1
explanation: |
  `collect` değerleri **teker teker** ister. `take(1)` ilk değeri aldıktan sonra "yeter" der; zincir
  durur ve geri kalan satırlara hiç bakılmaz. İterator'lar bütün listeyi işleyip sonra kesmez; her öğe
  zincirin sonuna kadar gider. Bu yüzden `ara`'ya bir gün "ilk N eşleşme" özelliği eklemek, dosyanın geri
  kalanını taramayı da otomatik olarak keser.
```

Sıra sende: duyarsız sürümü de aynı biçimde yaz.

```parsons
prompt: "`ara_buyuk_kucuk_duyarsiz`'ı iterator zinciriyle kur."
lines: |
  pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      let sorgu = sorgu.to_lowercase();
      icerik
          .lines()
          .filter(|satir| satir.to_lowercase().contains(&sorgu))
          .collect()
  }
distractors: |
          .map(|satir| satir.to_lowercase().contains(&sorgu))
          .collect::<String>()
explanation: |
  Sorguyu zincirden **önce** bir kez küçük harfe çeviriyoruz; closure onu ödünç alarak yakalar. `filter`
  satırları **değiştirmeden** süzer, yani orijinal satırlar döner (üçüncü dersteki E0515 tuzağı burada yok).
  `map` kullansaydın satırlar yerine `bool` değerleri üretirdin; `collect::<String>()` ise dönüş tipiyle
  uyuşmazdı.
```

## İki sürümü karşılaştırmak

| | Döngü sürümü | Iterator sürümü |
|---|---|---|
| Değiştirilebilir durum | `let mut sonuclar` | Yok |
| Okuyunca anlaşılan | Adım adım **nasıl** | Doğrudan **ne** |
| Hız | Aynı | Aynı (sıfır maliyetli soyutlama) |
| Paralelleştirme | Elle yeniden yazmak gerekir | `rayon` ile neredeyse tek kelime (Modül 18) |
| Karmaşık akış (çoklu erken çıkış, birden çok yan etki) | Daha rahat | Zorlaşabilir |

Hız satırı şaşırtıcı gelebilir. Python'da bir liste üreteci (list comprehension) ile döngü arasında fark
olabilir, Java'da `Stream` nesneleri bir miktar ek yük getirebilir. Rust'ta ise Modül 14'te gördüğün gibi
iterator zincirleri derleme sırasında el yazımı bir döngüye eşdeğer makine koduna indirgenir; çoğu zaman
sınır denetimleri de kalkar. Yani okunabilirlik için hızdan vazgeçmiyorsun.

```rust
fn ara_dongu<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    let mut sonuclar = Vec::new();
    for satir in icerik.lines() {
        if satir.contains(sorgu) {
            sonuclar.push(satir);
        }
    }
    sonuclar
}

fn ara_iterator<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    icerik.lines().filter(|satir| satir.contains(sorgu)).collect()
}

fn main() {
    let icerik = "elma\narmut\nelmas\nkiraz\nkarpuz";
    for sorgu in ["elma", "r", "üzüm", ""] {
        let ayni = ara_dongu(sorgu, icerik) == ara_iterator(sorgu, icerik);
        println!("{sorgu:?}: aynı sonuç mu? {ayni}");
    }
}
```

Refactoring'in özü bu: **davranış aynı, yapı daha iyi.** Bunu hem testlerle hem de yukarıdaki gibi iki
sürümü karşılaştırarak kanıtlayabilirsin. Boş sorgunun (`""`) her satırla eşleştiğine de dikkat et:
`contains("")` her zaman `true`'dur.

```quiz
question: Aşağıdakilerden hangisi iterator sürümü için **doğru** bir ifadedir?
options:
  - Daha yavaştır, çünkü closure her satır için bir fonksiyon çağrısıdır
  - "Daha hızlıdır, çünkü `collect` satırları paralel işler"
  - "Döngü sürümüyle aynı makine koduna derlenebilir; asıl kazanç, değiştirilebilir ara durumun ortadan kalkması ve niyetin açıkça yazılmasıdır"
answer: 2
explanation: |
  Derleyici closure'ları satır içine yerleştirir (inlining), iterator zincirini tek bir döngüye indirger;
  bu yüzden hız farkı yoktur (sıfır maliyetli soyutlama). `collect` kendiliğinden paralel çalışmaz;
  paralellik için Modül 18'deki `rayon` gibi bir araç gerekir. Kazanç okunabilirlik ve hata riskinin
  azalmasıdır: `mut` bir vektörü yanlış yerde değiştirme ihtimali bile yok.
feedback:
  - "Rust closure'ları generic tipler olarak derlenir ve genellikle satır içine yerleştirilir; çağrı maliyeti kalmaz."
  - "`collect` sıralı çalışır; paralellik açık bir tercih ister."
  - Doğru!
```

## Gerçek dünya: clap

El yazımı ayrıştırıcımız iki konumsal argümanı iyi işliyor. Ama gerçek bir araçtan şunları beklersin:

- `ara -i rust siir.txt` ya da `ara rust siir.txt --ignore-case`: seçenekler **herhangi bir sırada**
- `ara --help`: otomatik, düzgün biçimlenmiş bir yardım metni
- `ara --version`, `-iv` gibi birleşik kısa seçenekler, `--` ayıracı
- Yanlış yazımlarda öneriler (`--ignore-cse` için "bunu mu demek istedin: `--ignore-case`?")

Bunların hepsini elle yazmak hem uzun hem hataya açık. Rust ekosisteminin standart cevabı **`clap`**
(Command Line Argument Parser) crate'idir; `cargo`, `ripgrep` ve daha birçok araç onu ya da benzerini
kullanır. Projene eklemek için (Modül 8):

```console
> cargo add clap --features derive
```

```toml
[dependencies]
clap = { version = "4", features = ["derive"] }
```

`clap`'in **derive API**'sinde argümanları bir struct olarak tarif edersin; ayrıştırıcıyı `#[derive(Parser)]`
senin yerine üretir (`derive`'ın kod ürettiğini Modül 11'de görmüştün; nasıl yaptığını Modül 23'te,
prosedürel makrolarda göreceksin):

```rust,norun,title=src/main.rs (clap ile)
use clap::Parser;
use std::path::PathBuf;

/// Dosyalarda metin arayan küçük bir araç
#[derive(Parser, Debug)]
#[command(version, about)]
struct Argumanlar {
    /// Aranacak metin
    sorgu: String,

    /// İçinde arama yapılacak dosya
    dosya_yolu: PathBuf,

    /// Büyük/küçük harf ayrımı yapma
    #[arg(short, long)]
    ignore_case: bool,
}

fn main() {
    let args = Argumanlar::parse();
    println!("{args:?}");
}
```

- Alanlar sırayla **konumsal argümanlar** olur: önce `sorgu`, sonra `dosya_yolu`.
- `#[arg(short, long)]` olan `bool` alan bir **bayrak** olur: `-i` ya da `--ignore-case` (alan adındaki `_`,
  `-`'ye çevrilir). Verilmezse `false`.
- `///` belge yorumları (Modül 13) **yardım metnine** dönüşür.
- `PathBuf`, sahipli bir dosya yolu tipidir; işletim sistemine özgü yolları `String`'den daha doğru temsil
  eder (geçersiz UTF-8 içerebilir).
- `Argumanlar::parse()` `env::args_os()`'u kendisi okur; hata varsa mesajı **stderr**'e yazar ve programı
  `2` çıkış koduyla bitirir. Yani dördüncü dersteki kuralların hepsine zaten uyar.

```console
> cargo run -- --help
Dosyalarda metin arayan küçük bir araç

Usage: ara [OPTIONS] <SORGU> <DOSYA_YOLU>

Arguments:
  <SORGU>       Aranacak metin
  <DOSYA_YOLU>  İçinde arama yapılacak dosya

Options:
  -i, --ignore-case  Büyük/küçük harf ayrımı yapma
  -h, --help         Print help
  -V, --version      Print version

> cargo run -- rust
error: the following required arguments were not provided:
  <DOSYA_YOLU>

Usage: ara <SORGU> <DOSYA_YOLU>

For more information, try '--help'.
```

On beş satırlık bir struct'tan bunların hepsini aldın. `clap` ile `main`, ayrıştırılmış `Argumanlar`'dan
bir `Config` kurar: örneğin `buyuk_kucuk_duyarsiz: args.ignore_case || ortam_bayragi(...)` ile hem bayrağı
hem ortam değişkenini destekleyebilirsin (clap'in `env` özelliği bunu bile senin yerine yapabilir).
`lib.rs`'teki arama mantığı ve testlerin **hiç değişmez**; ikinci derste yaptığımız ayrımın bir ödülü daha.

:::info Neden önce elle yazdık?
`clap` varken neden iki ders boyunca `Config::build` yazdık? Çünkü bir aracın ne yaptığını anlamadan onu
iyi kullanamazsın. Argümanların bir iterator olarak geldiğini, `args[0]`'ın ne olduğunu, hataların neden
stderr'e gittiğini ve çıkış kodlarını artık biliyorsun; `clap`'in sana ne kazandırdığını da bu yüzden
görebiliyorsun. Küçük, bağımlılıksız araçlarda el yazımı ayrıştırma hâlâ makul bir seçimdir.
:::

````quiz
question: |
  `clap` derive API'sinde aşağıdaki alan neyi tanımlar?

  ```rust,ignore
  /// Satır numaralarını göster
  #[arg(short = 'n', long)]
  satir_numarasi: bool,
  ```
options:
  - Zorunlu bir konumsal argüman
  - "`-n` ya da `--satir-numarasi` ile açılan, varsayılanı `false` olan bir bayrak; açıklaması yardım metninde görünür"
  - Bir ortam değişkeni
answer: 1
explanation: |
  `bool` tipli ve `#[arg(...)]` ile işaretli bir alan bir **bayraktır**. `short = 'n'` kısa adı açıkça
  seçer (varsayılan, alan adının ilk harfi olurdu), `long` ise alan adından `--satir-numarasi`'nı türetir
  (`_` → `-`). `///` yorumu `--help` çıktısına açıklama olarak girer. Konumsal argümanlar `#[arg]`
  işaretsiz alanlardır.
feedback:
  - "Konumsal argümanlar `#[arg(short/long)]` almaz; `bool` bayrakları ise hiç zorunlu değildir."
  - Doğru!
  - "Ortam değişkenleri için ayrıca `env` özelliği gerekir; burada yalnızca komut satırı bayrağı tanımlanıyor."
````

## Genişletme fikirleri

`ara` artık sağlam bir temel. Kendi bilgisayarında geliştirmeye devam etmek için birkaç fikir, kolaydan
zora:

1. **Satır numaraları** (`grep -n`): her eşleşmenin başına satır numarasını yaz. Aşağıdaki alıştırmanın
   konusu.
2. **Sayma** (`grep -c`): eşleşmeleri yazdırmak yerine sayısını göster; `.count()` tek satırda yapar.
3. **Tersine eşleştirme** (`grep -v`): üçüncü dersteki `ara_haric`'i bir bayrağa bağla.
4. **Düzenli ifadeler**: Modül 8'de tanıdığın `regex` crate'iyle sorguyu bir desen olarak yorumla
   (`ara "r(u|a)st" siir.txt`).
5. **Renkli çıktı**: eşleşen kısmı ANSI renk kodlarıyla vurgula; ama çıktı bir dosyaya yönlendirildiğinde
   renkleri kapat (gerçek araçlar stdout'un bir terminal olup olmadığını kontrol eder).
6. **Klasörde özyinelemeli arama**: `walkdir` crate'iyle bir klasördeki tüm dosyaları tara. Bu noktada
   `ripgrep`'in kaynak koduna göz atmak çok öğretici olur.

```exercise
id: m15-e-ara-numarali
title: "Satır numaralı arama (grep -n)"
difficulty: 3
prompt: |
  `ara_numarali(sorgu, icerik)` fonksiyonunu **iterator zinciriyle** yaz: sorguyu içeren her satır için
  `(satır_numarası, satır)` çifti döndürsün. Satır numaraları **1'den başlar** ve dosyadaki gerçek konumu
  gösterir (eşleşmeyen satırlar da sayılır).

  Örnek: `"elma\narmut\nelmas"` içinde `"elma"` → `[(1, "elma"), (3, "elmas")]`
starter: |
  pub fn ara_numarali<'a>(sorgu: &str, icerik: &'a str) -> Vec<(usize, &'a str)> {
      todo!()
  }
solution: |
  pub fn ara_numarali<'a>(sorgu: &str, icerik: &'a str) -> Vec<(usize, &'a str)> {
      icerik
          .lines()
          .enumerate()
          .filter(|(_, satir)| satir.contains(sorgu))
          .map(|(i, satir)| (i + 1, satir))
          .collect()
  }
check: tests
tests: |
  #[test]
  fn numaralar_birden_baslar() {
      assert_eq!(
          vec![(1, "elma"), (3, "elmas")],
          ara_numarali("elma", "elma\narmut\nelmas"),
          "satır numaraları 1'den başlamalı ve gerçek konumu göstermeli"
      );
  }

  #[test]
  fn eslesmeyen_satirlar_da_sayilir() {
      let icerik = "Rust öğrenmek bir yolculuktur,\nher hata yeni bir ders verir.\nDerleyici sabırlı bir öğretmendir;\nrust gibi paslanmaz bilgi bırakır.";
      assert_eq!(vec![(4, "rust gibi paslanmaz bilgi bırakır.")], ara_numarali("rust", icerik));
  }

  #[test]
  fn eslesme_yoksa_bos() {
      assert!(ara_numarali("python", "rust\ngo\nc").is_empty());
  }

  #[test]
  fn bos_satirlar_da_numaralanir() {
      assert_eq!(vec![(2, "a"), (4, "ab")], ara_numarali("a", "\na\n\nab"), "boş satırlar da sayılmalı");
  }
hints:
  - "Numara ile satırı eşleştirmek için `lines()`'tan sonra `.enumerate()` kullan; `(indeks, satır)` çiftleri üretir, indeks 0'dan başlar."
  - "`.filter(|(_, satir)| satir.contains(sorgu))` ile süz; desen, closure parametresindeki çifti açar."
  - "`.map(|(i, satir)| (i + 1, satir))` ile 1'den başlayan numaraya çevir ve `.collect()` ile topla."
require:
  - pattern: "enumerate"
    message: "Satır numaraları için `enumerate` adaptörünü kullan."
forbid:
  - pattern: "for\\s"
    message: Bu alıştırmayı `for` döngüsü olmadan, iterator zinciriyle çöz.
explanation: |
  Sıralama kritik: `enumerate` **`filter`'dan önce** gelmeli. Önce numaralayıp sonra süzersen numaralar
  dosyadaki gerçek konumu gösterir. Tersini yapsaydın (önce `filter`, sonra `enumerate`) eşleşmeleri
  `1, 2, 3...` diye sayardın; `eslesmeyen_satirlar_da_sayilir` testi bu hatayı yakalar.

  `filter`'ın closure'ı öğeye **referans** alır; `|(_, satir)|` deseni `&(usize, &str)`'yi açarken
  Modül 7'de tanıdığın varsayılan bağlama kipleri (default binding modes) sayesinde `satir` bir `&&str`
  olur ve `contains` yine çalışır (desenlerin ayrıntılarını Modül 21'de göreceksin). `+ 1`'i `map` içinde yapmak yerine
  `.enumerate()`'ten önce bir sayaç başlatmak da mümkündü, ama bu sürüm en okunaklısı.

  Dönen satırlar yine `icerik`'ten ödünç: imzadaki `'a` bunu garanti ediyor.
```

## Özet

:::remember
- `Config::build(mut args: impl Iterator<Item = String>, ...)`: `env::args()`'ı doğrudan al, `next()` ile sahipliği taşı; `collect` ve `clone` gereksiz.
- `next()` `&mut self` ister → parametre `mut` olmalı (yoksa `E0596`).
- `let Some(x) = args.next() else { return Err("..."); };` eksik argümanı zarifçe yakalar.
- `icerik.lines().filter(|satir| satir.contains(sorgu)).collect()` döngü sürümüyle aynı hızda çalışır; durum yok, niyet açık.
- Iterator'lar tembeldir: `take(1)` gibi adaptörler taramayı erken bitirir.
- Gerçek dünyada argüman ayrıştırma için `clap` (derive API): struct alanları argümanlar/bayraklar olur, `///` yardım metni olur, hatalar stderr'e gider.
:::

```reflect
prompt: |
  Beş derste `ara`'yı baştan sona kurdun. Projede en çok işine yarayan üç tasarım kararını seç ve her
  birinin hangi sorunu çözdüğünü açıkla.
answer: |
  Örnek cevap:
  1. Mantığı `lib.rs`'e, dış dünyaya dokunan kodu `main.rs`'e ayırmak: arama ve ayrıştırma mantığı saf
     fonksiyonlar oldu ve testlerle güvenceye alındı; `clap`'e geçerken bile kütüphane değişmedi.
  2. Hataları `Result` ile yukarı vermek (`Config::build`, `run` ve `Box<dyn Error>`): kütüphane hiçbir
     zaman programı kendisi bitirmedi; kullanıcıya anlaşılır mesajlar ve doğru çıkış kodu tek bir yerde
     (`main`) belirlendi, mesajlar da `eprintln!` ile doğru kanala gitti.
  3. `ara`'nın `icerik`'ten dilimler döndürmesi (`'a` yaşam süresi): sonuçlar için hiçbir metin
     kopyalanmadı; derleyici de sonuçların içerikten uzun yaşamamasını garanti etti.
```

```flashcards
- front: "`Config::build` neden `&[String]` yerine `impl Iterator<Item = String>` almaya başladı?"
  back: "`env::args()`'ın ürettiği sahipli `String`'leri doğrudan `Config`'e taşımak için; vektöre toplama ve `clone` gereksiz kalır."
- front: "`fn build(args: impl Iterator<Item = String>)` içinde `args.next()` neden `E0596` verir?"
  back: "`next` `&mut self` ister; parametre `mut args` olarak bildirilmelidir."
- front: "`ara`'nın iterator sürümünü yaz."
  back: "`icerik.lines().filter(|satir| satir.contains(sorgu)).collect()`"
- front: Iterator zinciri döngü sürümünden daha mı yavaştır?
  back: Hayır. Sıfır maliyetli soyutlama sayesinde genellikle aynı makine koduna derlenir.
- front: Satır numaralı aramada `enumerate` neden `filter`'dan önce gelmelidir?
  back: Numaralar dosyadaki gerçek satır konumunu göstermeli; önce süzersen yalnızca eşleşmeleri sayarsın.
- front: "`clap` derive API'sinde `#[arg(short, long)] ignore_case: bool` alanı ne üretir?"
  back: "`-i` ve `--ignore-case` bayraklarını; verilmezse `false`."
- front: "`clap`'te bir alanın üstündeki `///` yorumu ne işe yarar?"
  back: "`--help` çıktısında o argümanın açıklaması olur."
- front: "`clap`, hatalı argümanlarda mesajı hangi kanala yazar ve hangi çıkış koduyla biter?"
  back: "stderr'e yazar ve `2` çıkış koduyla biter."
```
