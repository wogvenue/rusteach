---
id: m15-boss
title: "Boss: Komut Satırının Ustası"
minutes: 35
type: boss
objectives:
  - "`ara` projesinin argüman, dosya, hata, ortam ve çıktı katmanlarını yeni kodlarda doğru kullanabilmek"
  - Arama mantığını yaşam süreleri ve iterator'larla doğru imzalarla yazabilmek
  - Bir komut satırı aracının ayrıştırma ve biçimlendirme parçalarını test edilebilir saf fonksiyonlar olarak geliştirebilmek
keywords: [boss, minigrep, ara, Config, Box<dyn Error>, stderr, ortam değişkeni, iterator, clap]
---

`ara` artık senin eserin. Bu sınavda yeni bir şey öğretilmeyecek; beş derste kurduğun her parçayı yeni
durumlarda kullanacaksın: argümanlar, `Config`, hata yönetimi, ortam değişkenleri, stdout/stderr, yaşam
süreleri ve iterator'lar. Birkaç soruda önceki modüllerden de bir şeyler hatırlaman gerekecek.

Geçmek için puanların en az **%80**'ini toplaman gerekiyor. Son bölümdeki üç alıştırma, `ara`'ya
ekleyebileceğin gerçek özelliklerin parçaları.

## Bölüm 1: Argümanlar, Config ve proje düzeni

```quiz
question: |
  Kullanıcı terminale `cargo run -- -i "bir ders" siir.txt` yazdı. Programın `env::args().collect()`
  ile topladığı vektörün uzunluğu kaçtır?
options:
  - "3"
  - "4"
  - "5"
  - "6"
answer: 1
explanation: |
  `cargo run --` Cargo'ya aittir. Kabuk (shell), tırnak içindeki `bir ders`'i **tek** bir argüman olarak
  iletir. Program şunu görür: `["target/debug/ara", "-i", "bir ders", "siir.txt"]`, yani 4 eleman.
  `args[0]` her zaman programın yoludur.
feedback:
  - "Programın kendi yolunu (`args[0]`) unuttun."
  - Doğru!
  - "Tırnak içindeki `bir ders` iki değil, tek argümandır; tırnaklar kabuk tarafından kaldırılır."
  - "`cargo`, `run` ve `--` programa ulaşmaz."
```

```compiles
code: |
  pub struct Config {
      pub sorgu: String,
      pub dosya_yolu: String,
  }

  impl Config {
      pub fn build(args: &[String]) -> Result<Config, &'static str> {
          if args.len() < 3 {
              return Err(format!("eksik argüman: {} verildi", args.len() - 1));
          }
          Ok(Config { sorgu: args[1].clone(), dosya_yolu: args[2].clone() })
      }
  }
answer: false
error: E0308
explanation: |
  Dönüş tipi `Result<Config, &'static str>`: hata bir **metin değişmezi** olmalı. `format!` ise çalışma
  anında yeni bir `String` üretir (`expected &str, found String`). Dinamik bilgi içeren mesajlar
  istiyorsan hata tipini `String` yapmalısın; `&'static str` yalnızca programa gömülü sabit metinler
  içindir.
```

```predict
code: |
  # pub struct Config {
  #     pub sorgu: String,
  #     pub dosya_yolu: String,
  # }
  #
  # impl Config {
  #     pub fn build(mut args: impl Iterator<Item = String>) -> Result<Config, &'static str> {
  #         args.next();
  #         let Some(sorgu) = args.next() else {
  #             return Err("sorgu verilmedi");
  #         };
  #         let Some(dosya_yolu) = args.next() else {
  #             return Err("dosya yolu verilmedi");
  #         };
  #         Ok(Config { sorgu, dosya_yolu })
  #     }
  # }
  #
  fn main() {
      let girdiler = [vec!["ara", "çay"], vec!["çay", "menu.txt"], vec!["ara", "çay", "menu.txt"]];
      for g in girdiler {
          match Config::build(g.into_iter().map(String::from)) {
              Ok(c) => println!("{} @ {}", c.sorgu, c.dosya_yolu),
              Err(e) => println!("hata: {e}"),
          }
      }
  }
options:
  - |
    hata: dosya yolu verilmedi
    çay @ menu.txt
    çay @ menu.txt
  - |
    hata: dosya yolu verilmedi
    hata: dosya yolu verilmedi
    çay @ menu.txt
  - |
    hata: sorgu verilmedi
    hata: dosya yolu verilmedi
    çay @ menu.txt
answer: 1
explanation: |
  `build` ilk değeri **her zaman** program yolu sayıp atlar. İkinci girdide (`["çay", "menu.txt"]`)
  atlanan `"çay"` olur; sorgu `"menu.txt"`, dosya yolu ise yok. Gerçek programda `env::args()`'ın ilk
  değeri hep program yolu olduğu için sorun çıkmaz; ama taklit verilerle test yazarken bu ayrıntıyı
  unutmak sık yapılan bir hatadır.
```

```quiz
question: |
  `ara` paketinde `src/lib.rs` içinde `pub struct Config` tanımlı. `src/main.rs`'ten ona nasıl erişilir?
  (Modül 8'i hatırla.)
options:
  - "`use crate::Config;`"
  - "`use ara::Config;`"
  - "`mod lib;` yazıp `use lib::Config;`"
  - Erişilemez; binary crate library crate'i göremez
answer: 1
explanation: |
  Aynı pakette `main.rs` ve `lib.rs` **iki ayrı crate**'tir. Binary crate, library crate'i bir dış
  bağımlılık gibi **paketin adıyla** kullanır: `use ara::Config;`. `crate::` binary crate'in kendi köküne
  işaret eder. `mod lib;` ise `lib.rs`'i binary crate'in içine ikinci kez modül olarak derler; bu
  çalışabilir ama yanlış bir desendir.
feedback:
  - "`crate::` `main.rs`'in kendi crate köküdür; `Config` orada tanımlı değil."
  - Doğru!
  - "Bu, aynı dosyayı iki farklı crate'te derletir; library crate'i kullanmanın doğru yolu değil."
  - "Erişebilir; sadece `pub` öğelere ve paketin adıyla."
```

## Bölüm 2: Hatalar, ortam ve çıktı kanalları

```compiles
code: |
  use std::error::Error;
  use std::fs;

  pub fn ilk_satiri_sayi_olarak_oku(yol: &str) -> Result<i64, Box<dyn Error>> {
      let icerik = fs::read_to_string(yol)?;
      let Some(ilk) = icerik.lines().next() else {
          return Err("dosya boş".into());
      };
      let sayi: i64 = ilk.trim().parse()?;
      Ok(sayi)
  }
answer: true
explanation: |
  Derlenir. Üç farklı hata kaynağı aynı dönüş tipinde buluşuyor: `io::Error` (dosya okuma) ve
  `ParseIntError` (`parse`) `?` sayesinde `Box<dyn Error>`'a otomatik dönüşür; `"dosya boş".into()`
  ise metni kutulu bir hataya çevirir. `Box<dyn Error>`'ın gücü tam olarak bu esnekliktir.
```

```predict
question: Bu programın **standart çıktısı (stdout)** ne olur?
code: |
  use std::error::Error;

  fn yas_oku(metin: &str) -> Result<u32, Box<dyn Error>> {
      let yas: u32 = metin.parse()?;
      if yas > 150 {
          return Err("gerçekçi değil".into());
      }
      Ok(yas)
  }

  fn main() {
      for m in ["30", "otuz", "200"] {
          match yas_oku(m) {
              Ok(y) => println!("{y}"),
              Err(e) => eprintln!("hata: {e}"),
          }
      }
      println!("bitti");
  }
options:
  - |
    30
    bitti
  - |
    30
    hata: invalid digit found in string
    hata: gerçekçi değil
    bitti
  - |
    hata: invalid digit found in string
    hata: gerçekçi değil
answer: 0
explanation: |
  Hata mesajları `eprintln!` ile **stderr**'e gider; stdout'ta yalnızca `println!` ile yazılan veri kalır.
  Terminalde dört satırın hepsini görürsün, ama `> sonuc.txt` ile yönlendirirsen dosyada yalnızca `30` ve
  `bitti` olur.
```

```quiz
question: |
  Bash'te `IGNORE_CASE= cargo run -- rust siir.txt` yazıldı (eşittirden sonra hiçbir şey yok).
  `Config` bayrağı `env::var("IGNORE_CASE").is_ok()` ile belirliyorsa ne olur?
options:
  - "Bayrak `false` olur, çünkü değer boş"
  - "Bayrak `true` olur, çünkü değişken boş bir değerle de olsa tanımlı"
  - "`env::var` `Err(NotUnicode)` döndürür"
answer: 1
explanation: |
  `env::var` `Ok("")` döndürür; `is_ok()` yalnızca tanımlı olup olmadığına bakar, yani `true`. Dördüncü
  dersteki `ortam_bayragi` gibi değeri yorumlayan bir fonksiyon, boş metni "kapalı" sayarak bu şaşırtıcı
  davranışı düzeltir.
feedback:
  - "`is_ok()` değeri hiç incelemez; `Ok(\"\")` de `Ok`'tur."
  - Doğru!
  - "Boş metin geçerli Unicode'dur; `NotUnicode` yalnızca geçersiz UTF-8 baytları için döner."
```

```quiz
question: "`main`'de `process::exit(1)` çağırmakla `main`'den normal şekilde dönmek arasındaki fark nedir?"
options:
  - Fark yoktur; ikisi de yıkıcıları (`drop`) çalıştırır
  - "`process::exit` yığını çözmez, o an yaşayan değerlerin `drop`'u çağrılmaz; normal dönüşte ise hepsi düşürülür"
  - "`process::exit` panik yapar ve `101` koduyla biter"
answer: 1
explanation: |
  `process::exit` süreci **hemen** sonlandırır: bellek işletim sistemine geri döner ama `Drop`
  uygulamaları (ör. tamponlu yazıcıların son verileri boşaltması) çalışmaz. Bu yüzden onu yalnızca en dış
  katmanda, temizlenecek bir şey kalmadığında kullanırız; kütüphane kodunda asla.
feedback:
  - "`exit` yığını çözmez; yıkıcılar atlanır."
  - Doğru!
  - "`exit` panik değildir; verdiğin kodla (burada `1`) temiz bir şekilde biter."
```

## Bölüm 3: Arama mantığı ve iterator'lar

```compiles
code: |
  pub fn ara<'a>(sorgu: &'a str, icerik: &str) -> Vec<&'a str> {
      icerik.lines().filter(|satir| satir.contains(sorgu)).collect()
  }
answer: false
error: E0621
explanation: |
  İmza, sonucun `sorgu`'dan ödünç alındığını vaat ediyor; oysa döndürülen dilimler `icerik`'ten geliyor.
  Derleyici sözleşmenin bozulduğunu görür: `explicit lifetime required in the type of icerik`. Doğru imza
  `'a`'yı `icerik`'e koyar: `fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>`.
```

```predict
code: |
  fn main() {
      let icerik = "elma\narmut\nelmas";
      let a: Vec<(usize, &str)> = icerik
          .lines()
          .filter(|s| s.contains("elma"))
          .enumerate()
          .collect();
      println!("{a:?}");
  }
options:
  - '[(0, "elma"), (2, "elmas")]'
  - '[(0, "elma"), (1, "elmas")]'
  - '[(1, "elma"), (3, "elmas")]'
answer: 1
explanation: |
  `enumerate` `filter`'dan **sonra** geldiği için yalnızca süzülmüş öğeleri numaralar: `0, 1`. Satırların
  dosyadaki gerçek konumunu istiyorsan sıralama tersine dönmeli (`enumerate` önce, `filter` sonra) ve
  numaraya 1 eklenmeli; beşinci dersteki `ara_numarali` böyleydi.
```

```fill
prompt: "`ara`'yı tek bir iterator zinciriyle yaz."
code: |
  pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      icerik
          .___0()
          .___1(|satir| satir.contains(sorgu))
          .___2()
  }

  fn main() {
      println!("{:?}", ara("su", "su\nsüt\nsucuk\nayran"));
  }
blanks:
  - ["lines"]
  - ["filter"]
  - ["collect"]
output: '["su", "sucuk"]'
explanation: |
  `lines` satırları üretir, `filter` koşulu sağlayanları geçirir, `collect` dönüş tipine (`Vec<&str>`)
  toplar. `"süt"` `"su"`'yu içermez: `ü` ile `u` farklı karakterlerdir.
```

````quiz
question: |
  Modül 13'ü hatırla. Bu test geçer mi?

  ```rust,ignore
  #[test]
  #[should_panic(expected = "argüman")]
  fn eksik_arguman() {
      Config::new(&[String::from("ara")]); // "en az iki argüman gerekli: ara <sorgu> <dosya>" ile panik yapar
  }
  ```
options:
  - Geçer; `expected` panik mesajının içinde geçen bir alt metni arar
  - Geçmez; `expected` panik mesajının tamamıyla birebir eşleşmeli
  - Geçmez; `should_panic` testleri `Result` döndürmek zorunda
answer: 0
explanation: |
  `expected = "..."` panik mesajının **alt metni** (substring) olarak aranır. `"argüman"`, `"en az iki
  argüman gerekli..."` içinde geçtiği için test geçer. Bu sayede mesajın küçük ayrıntılarını değiştirmek
  testleri kırmaz; ama çok kısa bir `expected` alakasız paniklerin de testi geçirmesine yol açabilir,
  dengeyi iyi kur.
feedback:
  - Doğru!
  - "Birebir eşleşme gerekmez; `expected` bir alt metin aramasıdır."
  - "`should_panic` testleri `()` döndürür; `Result` döndüren testlerle `should_panic` birlikte kullanılamaz."
````

## Bölüm 4: ara'ya yeni özellikler

```exercise
id: m15-boss-e-sayac
title: "Eşleşme sayacı (grep -c)"
difficulty: 2
prompt: |
  `eslesme_sayisi(sorgu, icerik, buyuk_kucuk_duyarsiz)` fonksiyonunu yaz: sorguyu içeren **satır**
  sayısını döndürsün. `buyuk_kucuk_duyarsiz` `true` ise karşılaştırma büyük/küçük harf farkı gözetmeden
  yapılsın. Bir satırda sorgu birden çok kez geçse de o satır **bir** kez sayılır.
starter: |
  pub fn eslesme_sayisi(sorgu: &str, icerik: &str, buyuk_kucuk_duyarsiz: bool) -> usize {
      todo!()
  }
solution: |
  pub fn eslesme_sayisi(sorgu: &str, icerik: &str, buyuk_kucuk_duyarsiz: bool) -> usize {
      if buyuk_kucuk_duyarsiz {
          let sorgu = sorgu.to_lowercase();
          icerik
              .lines()
              .filter(|satir| satir.to_lowercase().contains(&sorgu))
              .count()
      } else {
          icerik.lines().filter(|satir| satir.contains(sorgu)).count()
      }
  }
check: tests
tests: |
  const SIIR: &str = "Rust öğrenmek bir yolculuktur,\nher hata yeni bir ders verir.\nDerleyici sabırlı bir öğretmendir;\nrust gibi paslanmaz bilgi bırakır.";

  #[test]
  fn duyarli_sayim() {
      assert_eq!(eslesme_sayisi("rust", SIIR, false), 1, "duyarlı modda yalnızca küçük 'rust' sayılır");
      assert_eq!(eslesme_sayisi("bir", SIIR, false), 3);
  }

  #[test]
  fn duyarsiz_sayim() {
      assert_eq!(eslesme_sayisi("RUST", SIIR, true), 2, "duyarsız modda 'Rust' ve 'rust' sayılır");
      assert_eq!(eslesme_sayisi("der", SIIR, true), 2, "'ders' ve 'Derleyici'");
  }

  #[test]
  fn satir_bir_kez_sayilir() {
      assert_eq!(eslesme_sayisi("a", "aaa\nbab\nccc", false), 2, "aynı satırdaki tekrarlar bir kez sayılmalı");
  }

  #[test]
  fn eslesme_yoksa_sifir() {
      assert_eq!(eslesme_sayisi("python", SIIR, true), 0);
      assert_eq!(eslesme_sayisi("x", "", false), 0, "boş içerikte sonuç 0");
  }
hints:
  - "Satır sayısını bulmak için bir vektör oluşturmana gerek yok: `filter(...)` ve ardından `.count()`."
  - "Duyarsız modda sorguyu bir kez `to_lowercase()` et, her satırın `to_lowercase()`'ını onunla karşılaştır."
  - "`if buyuk_kucuk_duyarsiz { ... } else { ... }` ifadesinin iki kolu da bir `usize` döndürmeli."
explanation: |
  `count()` bir tüketicidir (Modül 14): öğeleri saymak için vektör oluşturmaz, bellekte hiçbir şey
  biriktirmez. İki kolun ortak tipi `usize` olduğu için `if` ifadesi doğrudan fonksiyonun dönüş değeri
  oluyor.

  Alternatif: `ara`/`ara_buyuk_kucuk_duyarsiz`'ı çağırıp `.len()` almak. Daha az kod yazarsın ama
  gereksiz yere bir `Vec` oluşturursun. Küçük dosyalarda fark etmez; ölçmeden optimizasyon yapma kuralını
  hatırla, ama bedavaya gelen verimliliği de geri çevirme.
```

```exercise
id: m15-boss-e-vurgu
title: Eşleşmeleri vurgula
difficulty: 3
prompt: |
  `ara_vurgulu(sorgu, icerik)` fonksiyonunu yaz: sorguyu içeren her satırı, sorgunun **her** geçtiği yer
  köşeli parantez içine alınmış olarak döndürsün (duyarlı karşılaştırma).

  Örnek: sorgu `bir`, satır `bir gün bir ders` → `[bir] gün [bir] ders`

  - Sorgu boşsa boş bir vektör döndür.
  - Satırlar `icerik`'teki sırasıyla dönmeli.

  Dönüş tipinin artık `Vec<&str>` değil `Vec<String>` olduğuna dikkat et: neden?
starter: |
  pub fn ara_vurgulu(sorgu: &str, icerik: &str) -> Vec<String> {
      todo!()
  }
solution: |
  pub fn ara_vurgulu(sorgu: &str, icerik: &str) -> Vec<String> {
      if sorgu.is_empty() {
          return Vec::new();
      }
      let vurgu = format!("[{sorgu}]");
      icerik
          .lines()
          .filter(|satir| satir.contains(sorgu))
          .map(|satir| satir.replace(sorgu, &vurgu))
          .collect()
  }
check: tests
tests: |
  #[test]
  fn tek_eslesme() {
      let icerik = "Rust öğrenmek\nrust gibi paslanmaz";
      assert_eq!(ara_vurgulu("rust", icerik), vec!["[rust] gibi paslanmaz"]);
  }

  #[test]
  fn ayni_satirda_birden_cok() {
      assert_eq!(
          ara_vurgulu("bir", "bir gün bir ders\niki gün"),
          vec!["[bir] gün [bir] ders"],
          "sorgunun her geçtiği yer vurgulanmalı"
      );
  }

  #[test]
  fn sira_korunur_ve_eslesmeyenler_atlanir() {
      let icerik = "çay\nkahve\nbitki çayı\nsu";
      assert_eq!(ara_vurgulu("çay", icerik), vec!["[çay]", "bitki [çay]ı"]);
  }

  #[test]
  fn bos_sorgu_bos_sonuc() {
      assert!(ara_vurgulu("", "bir\niki").is_empty(), "boş sorgu boş vektör döndürmeli");
  }
hints:
  - "`String::replace(desen, yerine)` desenin geçtiği **her** yeri değiştirip yeni bir `String` döndürür."
  - "Önce boş sorgu durumunu ele al; sonra `lines()` → `filter(...)` → `map(|satir| satir.replace(sorgu, &vurgu))` → `collect()`."
  - "Vurgulu metni bir kez hazırla: `let vurgu = format!(\"[{sorgu}]\");`"
explanation: |
  **Neden `Vec<String>`?** Vurgulanmış satırlar dosyada **yok**; onları yeni üretiyoruz. `ara`
  `icerik`'in parçalarını ödünç döndürebiliyordu, ama burada yeni metinlerin bir sahibi olmalı. Yerel
  bir `String`'e dilim döndürmeye çalışmak üçüncü dersteki `E0515`'e yol açardı. Kural: veriyi
  **gösteriyorsan** ödünç döndür, **üretiyorsan** sahipli döndür.

  Boş sorgu kontrolü neden şart? `"bir".replace("", "[]")` her karakterin arasına `[]` ekler ve
  `contains("")` her satır için `true`'dur; sonuç anlamsız olurdu. Kenar durumu açıkça ele almak, garip
  davranışı testlerle belgelemenin en iyi yoludur.

  Vurgulu metni (`vurgu`) closure'ın dışında bir kez oluşturduk; closure onu ödünç alarak yakalıyor
  (Modül 14). Her satır için `format!` çağırmak gereksiz tahsis olurdu.
```

```exercise
id: m15-boss-e-secenekler
title: Kendi mini clap'in
difficulty: 4
prompt: |
  `ayristir(args)` fonksiyonunu yaz. Argümanları sırayla oku (ilk değer program yoludur, atla) ve bir
  `Secenekler` döndür:

  - `-i` ya da `--ignore-case` → `buyuk_kucuk_duyarsiz = true`
  - `-n` ya da `--satir-numarasi` → `satir_numarasi = true`
  - `-` ile başlayan başka her şey → `Err(format!("bilinmeyen seçenek: {arg}"))`
  - Diğerleri konumsal argümandır: ilki sorgu, ikincisi dosya yolu. Seçenekler **herhangi bir yerde**
    olabilir (`ara rust -i siir.txt` geçerli).
  - Sorgu yoksa `Err("sorgu verilmedi")`, dosya yolu yoksa `Err("dosya yolu verilmedi")`,
    üçüncü bir konumsal argüman varsa `Err(format!("fazla argüman: {arg}"))`.

  Hata tipi `String`.
starter: |
  #[derive(Debug, PartialEq)]
  pub struct Secenekler {
      pub sorgu: String,
      pub dosya_yolu: String,
      pub buyuk_kucuk_duyarsiz: bool,
      pub satir_numarasi: bool,
  }

  pub fn ayristir(mut args: impl Iterator<Item = String>) -> Result<Secenekler, String> {
      todo!()
  }
solution: |
  #[derive(Debug, PartialEq)]
  pub struct Secenekler {
      pub sorgu: String,
      pub dosya_yolu: String,
      pub buyuk_kucuk_duyarsiz: bool,
      pub satir_numarasi: bool,
  }

  pub fn ayristir(mut args: impl Iterator<Item = String>) -> Result<Secenekler, String> {
      args.next(); // program yolu

      let mut buyuk_kucuk_duyarsiz = false;
      let mut satir_numarasi = false;
      let mut konumsal = Vec::new();

      for arg in args {
          match arg.as_str() {
              "-i" | "--ignore-case" => buyuk_kucuk_duyarsiz = true,
              "-n" | "--satir-numarasi" => satir_numarasi = true,
              _ => {
                  if arg.starts_with('-') {
                      return Err(format!("bilinmeyen seçenek: {arg}"));
                  }
                  konumsal.push(arg);
              }
          }
      }

      let mut konumsal = konumsal.into_iter();
      let sorgu = konumsal.next().ok_or("sorgu verilmedi")?;
      let dosya_yolu = konumsal.next().ok_or("dosya yolu verilmedi")?;
      if let Some(fazla) = konumsal.next() {
          return Err(format!("fazla argüman: {fazla}"));
      }

      Ok(Secenekler { sorgu, dosya_yolu, buyuk_kucuk_duyarsiz, satir_numarasi })
  }
check: tests
tests: |
  fn a(parcalar: &[&str]) -> std::vec::IntoIter<String> {
      let mut v = vec![String::from("ara")];
      for p in parcalar {
          v.push(p.to_string());
      }
      v.into_iter()
  }

  #[test]
  fn yalnizca_konumsal() {
      assert_eq!(
          ayristir(a(&["rust", "siir.txt"])),
          Ok(Secenekler {
              sorgu: String::from("rust"),
              dosya_yolu: String::from("siir.txt"),
              buyuk_kucuk_duyarsiz: false,
              satir_numarasi: false,
          })
      );
  }

  #[test]
  fn secenekler_her_yerde_olabilir() {
      let beklenen = Ok(Secenekler {
          sorgu: String::from("çay"),
          dosya_yolu: String::from("menu.txt"),
          buyuk_kucuk_duyarsiz: true,
          satir_numarasi: true,
      });
      assert_eq!(ayristir(a(&["-i", "çay", "menu.txt", "-n"])), beklenen, "seçenekler başta ve sonda");
      assert_eq!(ayristir(a(&["çay", "--satir-numarasi", "menu.txt", "--ignore-case"])), beklenen, "uzun seçenekler arada");
  }

  #[test]
  fn bilinmeyen_secenek() {
      assert_eq!(ayristir(a(&["-x", "rust", "siir.txt"])), Err(String::from("bilinmeyen seçenek: -x")));
      assert_eq!(ayristir(a(&["rust", "siir.txt", "--renkli"])), Err(String::from("bilinmeyen seçenek: --renkli")));
  }

  #[test]
  fn eksik_konumsal_argumanlar() {
      assert_eq!(ayristir(a(&["-i"])), Err(String::from("sorgu verilmedi")), "seçenek konumsal sayılmamalı");
      assert_eq!(ayristir(a(&["rust", "-n"])), Err(String::from("dosya yolu verilmedi")));
  }

  #[test]
  fn fazla_argumani_reddeder() {
      assert_eq!(ayristir(a(&["rust", "siir.txt", "notlar.md"])), Err(String::from("fazla argüman: notlar.md")));
  }
hints:
  - "Önce iki `bool` bayrağı `false` ile, konumsal argümanlar için de boş bir `Vec` ile başla; sonra `for arg in args` ile kalan argümanları dolaş."
  - "`match arg.as_str()` içinde `\"-i\" | \"--ignore-case\" => ...` kollarını yaz; en sondaki `_` kolunda `arg.starts_with('-')` ise `return Err(...)`, değilse `konumsal.push(arg)`."
  - "Döngüden sonra konumsalları sırayla al: `konumsal.next().ok_or(\"sorgu verilmedi\")?` (`&str` hatası `?` ile `String`'e dönüşür), ardından üçüncü bir öğe kalmış mı diye `if let Some(fazla) = konumsal.next()` ile bak."
explanation: |
  Bu, `clap`'in yaptığı işin küçük bir kopyası ve birkaç modülün birleşimi:

  - **Desen eşleştirme** (Modül 7): `|` ile birden çok desen ve her şeyi yakalayan `_` kolu. Kolların
    sırası önemli: `match` kolları yukarıdan aşağı dener, bu yüzden bilinen seçenekler `_`'tan önce
    gelmeli. `_` kolundaki `if`'i desenin içine taşıyan **match korumalarını (guard)**
    (`s if s.starts_with('-') => ...`) Modül 21'de göreceksin.
  - **Sahiplik** (Modül 4-5): `match arg.as_str()` `arg`'ı yalnızca ödünç alır; `_` kolunda `arg`'ı
    vektöre **taşıyabiliyoruz**, çünkü o kolda ödünç artık kullanılmıyor (NLL).
  - **Hata dönüşümü** (Modül 10-11): `ok_or("...")` bir `Result<String, &str>` üretir; `?` hatayı
    `From<&str> for String` ile fonksiyonun hata tipine çevirir.
  - **Iterator'lar** (Modül 14): konumsal vektörü yeniden bir iterator'a çevirip `next()` ile tükettik;
    "fazla argüman" kontrolü, iterator'ın bitip bitmediğine bakmaktan ibaret.

  Gerçek `clap` bunun üstüne `--help`, `-in` gibi birleşik kısa seçenekler, `--` ayıracı, değer alan
  seçenekler (`--limit 5`) ve yazım önerileri ekler. Elle yazmanın neden hızla zorlaştığını artık
  deneyimledin.
```
