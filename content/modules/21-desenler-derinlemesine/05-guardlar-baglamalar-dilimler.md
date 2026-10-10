---
id: m21-l05
title: "Match guard'ları, @ bağlamaları ve dilim desenleri"
minutes: 24
type: lesson
objectives:
  - Desenle ifade edilemeyen koşulları match guard (`if`) ile yazabilmek; guard'ın `|` ile önceliğini ve eksiksizliğe etkisini açıklayabilmek
  - "`isim @ desen` ile bir değeri hem sınayıp hem bağlayabilmek"
  - "`[]`, `[x]`, `[ilk, .., son]`, `[bas, kalan @ ..]` dilim desenleriyle dilimleri uzunluklarına göre işleyebilmek ve özyinelemeli dilim fonksiyonları yazabilmek"
  - "`Box` içindeki verilerle eşleştirmenin sınırını (box desenleri kararsız) bilip deref ile çözebilmek"
keywords: [match guard, guard, "@", bağlama, slice pattern, dilim deseni, özyineleme, E0004, E0529, box pattern, E0658]
---

Desenler güçlü ama her şeyi söyleyemezler. "Bu sayı **çift** mi?", "bu iki alan **birbirine eşit** mi?",
"değer dıştaki `hedef` değişkenine eşit mi?" gibi soruların desen karşılığı yok. Bazen de bir değeri bir
aralıkla sınamak **ve** aynı anda ona isim vermek istersin. Bir de uzunluğu baştan belli olmayan
dilimler var: "listede tek kişi varsa şöyle yaz, iki kişi varsa böyle, daha fazlaysa ilk ikisini ve
kalanların sayısını yaz..."

Bu derste desen dilinin son üç aracını ekliyoruz: **match guard'ları**, **`@` bağlamaları** ve **dilim
desenleri (slice patterns)**. Hepsi bir araya gelince, birçok dilde iç içe `if`'ler ve indeks
hesaplarıyla yazılan mantığı tek bir okunaklı `match`'e sığdırabileceksin.

## Match guard'ları: desenin söyleyemediğini söylemek

**Match guard**, bir kolun deseninden sonra gelen ek bir `if` koşuludur. Kol yalnızca desen uyarsa
**ve** koşul doğruysa seçilir. Koşul, desenin bağladığı isimleri kullanabilir:

```rust
fn main() {
    let hedef = 7; // 3. dersteki gölgeleme tuzağının düzgün çözümü

    for zar in [(3, 4), (2, 2), (6, 6), (1, 5)] {
        let sonuc = match zar {
            (a, b) if a + b == hedef => String::from("Toplam tuttu!"),
            (6, 6) => String::from("Çift altı!"), // değişmez desen yeterli
            (a, b) if a == b => format!("Çift {a}"), // iki bağlamayı karşılaştır
            (a, b) => format!("{a} + {b} = {}", a + b),
        };
        println!("{zar:?} → {sonuc}");
    }
}
```

Desen **şekli** sınar ve isim bağlar; guard bu isimlerle **hesap yapar**. "Toplam 7 mi?" ya da "iki zar eşit
mi?" bir şekil sorusu değildir, bu yüzden guard'a aittir. Dıştaki `hedef` değişkenini de guard'da
rahatça kullanabilirsin: guard sıradan bir ifadedir, yeni isim tanımlamaz.

:::analogy Havalimanı kapısı
Uçağa binerken önce biniş kartına bakılır: doğru uçuş mu, doğru kapı mı? Bu **desendir**, belgenin şekli.
Kart uyuyorsa görevli bir de soru sorabilir: "Bavulunuz 8 kilodan hafif mi?" Bu **guard**'dır: şekle değil,
o anki duruma bakan ek bir koşul. Kartı yanlış olan yolcuya bavul sorulmaz; guard yalnızca desen uyduktan
sonra değerlendirilir.
:::

Guard ne zaman **değerlendirilmez**? Desen uymadığında. Bu yüzden guard, desenin bağladığı isimleri hiç
korkmadan kullanabilir: o isimlerin var olduğu garantidir. Modül 7'deki let zincirleriyle (`if let ... && kosul`)
aynı fikir; biri `if let`'in, diğeri `match`'in aracı.

## Guard'lar, | önceliği ve eksiksizlik

Bir guard `|` ile bağlanmış desenlerin **hepsine** uygulanır, yalnızca sonuncusuna değil. Tahmin et:

```predict
code: |
  fn main() {
      let x = 4;
      let indirim_gunu = false;
      match x {
          4 | 5 | 6 if indirim_gunu => println!("indirimli"),
          _ => println!("normal fiyat"),
      }
  }
options:
  - "indirimli"
  - "normal fiyat"
  - Derlenmez
answer: 1
explanation: |
  `normal fiyat` yazar. Guard'ın önceliği `|`'dan düşüktür: kol `(4 | 5 | 6) if indirim_gunu` diye okunur,
  `4 | 5 | (6 if indirim_gunu)` diye değil. `x` 4 olsa da koşul yanlış olduğu için kol seçilmez. Rust'ta
  zaten tek bir alternatife guard koymanın yazımı yoktur; guard her zaman kolun **tamamına** aittir.
```

İkinci önemli kural: derleyici guard'ların **içine bakmaz**. Bir koşulun doğru mu yanlış mı olacağını
derleme zamanında genel olarak bilemez; bu yüzden eksiksizlik hesabında guard'lı kolları **yok sayar**:

```compiles
code: |
  fn isaret(n: i32) -> &'static str {
      match n {
          x if x < 0 => "negatif",
          x if x >= 0 => "pozitif ya da sıfır",
      }
  }

  fn main() {
      println!("{}", isaret(-3));
  }
answer: false
error: E0004
explanation: |
  Derlenmez: **E0004**, *non-exhaustive patterns: `i32::MIN..=i32::MAX` not covered*. Sen iki koşulun
  birlikte her sayıyı kapsadığını görüyorsun, ama derleyici guard'lı kolları saymaz ve hiçbir kolun
  koşulsuz uymadığını görür. Çözüm: son kolu guard'sız yaz (`_ => "pozitif ya da sıfır"`), ya da bu
  örnekte olduğu gibi guard yerine aralık desenleri kullan: `..0 => ..., 0.. => ...`.
```

:::error
```text
error[E0004]: non-exhaustive patterns: `i32::MIN..=i32::MAX` not covered
 --> src/main.rs:2:11
  |
2 |     match n {
  |           ^ pattern `i32::MIN..=i32::MAX` not covered
  |
  = note: the matched value is of type `i32`
  = note: match arms with guards don't count towards exhaustivity
```
İkinci `note` satırı kuralı açıkça söylüyor: *guard'lı kollar eksiksizliğe sayılmaz*. Bu yüzden guard
kullanan her `match`'te en az bir kolun (genellikle sonuncusunun) koşulsuz olması gerekir.
:::

:::tip Guard mı, desen mi?
Bir koşulu desenle ifade edebiliyorsan (`0`, `1..=9`, `'a' | 'e'`) desen kullan: derleyici eksiksizliği
denetleyebilir ve erişilemeyen kolları yakalar. Guard'ı desenin gerçekten söyleyemediği şeyler için
sakla: iki bağlamanın ilişkisi, bir metot çağrısı (`ad.starts_with("A")`), dıştaki bir değişken.
:::

## @ bağlamaları: hem sına hem bağla

Bir aralık desenini (`1..=12`) kullandığında değer sınanır ama bir isme **bağlanmaz**. İsim desenini
(`ay`) kullandığında ise bağlanır ama **sınanmaz**. `@` ikisini birleştirir: `isim @ DESEN`, "desen uyarsa
değeri bu isme de bağla" demektir.

```rust
#[allow(dead_code)]
enum Istek {
    Sayfa { no: u32 },
    Ara(&'static str),
}

fn main() {
    for ay in [3, 7, 11, 13] {
        let mevsim = match ay {
            m @ (12 | 1 | 2) => format!("{m}. ay kış"),
            m @ 3..=5 => format!("{m}. ay ilkbahar"),
            m @ 6..=8 => format!("{m}. ay yaz"),
            m @ 9..=11 => format!("{m}. ay sonbahar"),
            gecersiz => format!("{gecersiz} diye bir ay yok"),
        };
        println!("{mevsim}");
    }

    // Struct alanında @: alanı sına ve farklı bir isimle bağla
    for istek in [Istek::Sayfa { no: 2 }, Istek::Sayfa { no: 40 }, Istek::Ara("rust")] {
        match istek {
            Istek::Sayfa { no: sayfa @ 1..=10 } => println!("İlk sayfalardan biri: {sayfa}"),
            Istek::Sayfa { no } => println!("Arşiv sayfası: {no}"),
            Istek::Ara(kelime) => println!("Aranan: {kelime}"),
        }
    }

    // Bütün değeri bağlarken içini de aç (iç kısım Copy olduğunda)
    let konum: Option<(i32, i32)> = Some((3, -2));
    if let tamami @ Some((x, _)) = konum {
        println!("{tamami:?} değerinin x'i {x}");
    }
}
```

Dikkat edilecek iki nokta:

- `m @ (12 | 1 | 2)` yazımında **parantez gerekir**. `m @ 12 | 1 | 2` yazsaydın `@` yalnızca `12`'ye
  uygulanırdı ve `1 | 2` alternatifleri `m`'yi bağlamadığı için **E0408** alırdın.
- `@` olmadan aynı işi bir guard ile de yapabilirdin: `m if (3..=5).contains(&m)`. Ama o zaman derleyici
  aralıkları göremez ve eksiksizlik denetimi zayıflar. `@` kolu eksiksizlik hesabına **sayılır**.

```fill
prompt: |
  Bir otoparkta araçlar `(plaka, saat)` olarak geliyor. İlk 1 saat ücretsiz; 2–5 saat arası saat başı 20 TL;
  daha uzun süreler sabit 120 TL. Ücretli kollarda süreyi `@` ile bağla.
code: |
  fn ucret(arac: (&str, u32)) -> String {
      match arac {
          (plaka, 0..=1) => format!("{plaka}: ücretsiz"),
          (plaka, ___0 2..=5) => format!("{plaka}: {} TL", saat * 20),
          (plaka, saat ___1 6..) => format!("{plaka}: {saat} saat, sabit 120 TL"),
      }
  }

  fn main() {
      println!("{}", ucret(("06 ABC 12", 1)));
      println!("{}", ucret(("34 XY 340", 4)));
      println!("{}", ucret(("35 K 7", 9)));
  }
blanks:
  - ["saat @"]
  - ["@"]
output: |
  06 ABC 12: ücretsiz
  34 XY 340: 80 TL
  35 K 7: 9 saat, sabit 120 TL
explanation: |
  `saat @ 2..=5` önce süreyi aralıkla sınar, uyarsa değeri `saat`'e bağlar. Üç kol `0..=1`, `2..=5` ve `6..`
  ile `u32`'nin bütün değerlerini kapsıyor; `@` kolları eksiksizlik hesabına sayıldığı için `_` koluna gerek yok.
  Guard'la (`(plaka, saat) if saat >= 6`) yazsaydın son kolu koşulsuz bir kola çevirmen gerekirdi.
```

Şimdi guard ve `@`'i birlikte kullan:

```exercise
id: m21-e-karne
title: Karne değerlendirmesi
difficulty: 3
prompt: |
  Bir okulun not sistemi için `degerlendir(not, devamsizlik)` fonksiyonunu **tek bir `match`** ile yaz.
  `not` bir `Option<u32>` (sınava girmeyen öğrenci için `None`), `devamsizlik` gün sayısı. Kurallar
  **yukarıdan aşağıya** önceliklidir:

  1. `None` → `"Sınava girmedi"`
  2. not 100'den büyükse → `"Geçersiz not: <not>"`
  3. devamsızlık 10 günden fazlaysa (not ne olursa olsun) → `"Devamsızlıktan kaldı"`
  4. 85–100 → `"Pekiyi (<not>)"`
  5. 50–84 → `"Geçti (<not>)"`
  6. 45–49 **ve** hiç devamsızlık yoksa → `"Bütünleme hakkı (<not>)"`
  7. geri kalan her durum → `"Kaldı (<not>)"`

  Not değerini yazdırman gereken aralık kollarında `@` kullan; devamsızlık koşulları için guard.
starter: |
  fn degerlendir(not: Option<u32>, devamsizlik: u32) -> String {
      todo!()
  }

  fn main() {
      println!("{}", degerlendir(Some(92), 2));
      println!("{}", degerlendir(Some(47), 0));
      println!("{}", degerlendir(Some(70), 14));
      println!("{}", degerlendir(None, 0));
  }
solution: |
  fn degerlendir(not: Option<u32>, devamsizlik: u32) -> String {
      match not {
          None => String::from("Sınava girmedi"),
          Some(n @ 101..) => format!("Geçersiz not: {n}"),
          Some(_) if devamsizlik > 10 => String::from("Devamsızlıktan kaldı"),
          Some(n @ 85..=100) => format!("Pekiyi ({n})"),
          Some(n @ 50..=84) => format!("Geçti ({n})"),
          Some(n @ 45..=49) if devamsizlik == 0 => format!("Bütünleme hakkı ({n})"),
          Some(n) => format!("Kaldı ({n})"),
      }
  }

  fn main() {
      println!("{}", degerlendir(Some(92), 2));
      println!("{}", degerlendir(Some(47), 0));
      println!("{}", degerlendir(Some(70), 14));
      println!("{}", degerlendir(None, 0));
  }
check: tests
tests: |
  #[test]
  fn temel_durumlar() {
      assert_eq!(degerlendir(Some(92), 2), "Pekiyi (92)");
      assert_eq!(degerlendir(Some(60), 5), "Geçti (60)");
      assert_eq!(degerlendir(Some(30), 0), "Kaldı (30)");
      assert_eq!(degerlendir(None, 20), "Sınava girmedi", "sınava girmeyen için devamsızlık önemli değil");
  }

  #[test]
  fn sinir_degerleri() {
      assert_eq!(degerlendir(Some(100), 0), "Pekiyi (100)");
      assert_eq!(degerlendir(Some(85), 0), "Pekiyi (85)");
      assert_eq!(degerlendir(Some(84), 0), "Geçti (84)");
      assert_eq!(degerlendir(Some(50), 10), "Geçti (50)", "tam 10 gün devamsızlık henüz kaldırmaz");
  }

  #[test]
  fn devamsizlik_onceligi() {
      assert_eq!(degerlendir(Some(95), 11), "Devamsızlıktan kaldı", "11 gün devamsızlık, not yüksek olsa da kaldırır");
      assert_eq!(degerlendir(Some(120), 30), "Geçersiz not: 120", "geçersiz not kuralı devamsızlıktan önce gelir");
  }

  #[test]
  fn butunleme_kurali() {
      assert_eq!(degerlendir(Some(47), 0), "Bütünleme hakkı (47)");
      assert_eq!(degerlendir(Some(45), 0), "Bütünleme hakkı (45)");
      assert_eq!(degerlendir(Some(47), 1), "Kaldı (47)", "tek gün devamsızlık bile bütünleme hakkını kaldırır");
      assert_eq!(degerlendir(Some(44), 0), "Kaldı (44)");
  }
hints:
  - "Kolları kurallarla aynı sırada yaz. Geçersiz not için: `Some(n @ 101..) => format!(\"Geçersiz not: {n}\")`."
  - "Devamsızlık kuralı notun değerine bakmaz: `Some(_) if devamsizlik > 10 => ...`. Guard dıştaki `devamsizlik` parametresini kullanabilir."
  - "Bütünleme kolu hem `@` hem guard kullanır: `Some(n @ 45..=49) if devamsizlik == 0 => ...`. Son kol guard'sız olmalı (`Some(n) => ...`), yoksa E0004 alırsın."
require:
  - pattern: "@"
    message: Notu aralıkla sınayıp bağlamak için en az bir `@` kullan.
  - pattern: "\\bif\\b"
    message: Devamsızlık koşulları için match guard (`if`) kullan.
explanation: |
  Bu `match` bir kural tablosunu neredeyse kelimesi kelimesine kopyalıyor; okuyan kişi kodu kurallarla
  satır satır karşılaştırabilir. Sıra önemli: `Some(n @ 101..)` devamsızlık kolundan önce olduğu için
  120 notu her durumda "geçersiz" sayılıyor; devamsızlık kolu aralık kollarından önce olduğu için 95 alıp
  11 gün gelmeyen öğrenci kalıyor.

  Eksiksizliğe dikkat: guard'lı iki kol (`Some(_) if ...` ve `Some(n @ 45..=49) if ...`) hesaba katılmaz.
  Geriye `None`, `Some(101..)`, `Some(85..=100)`, `Some(50..=84)` ve koşulsuz `Some(n)` kalıyor; son kol
  her şeyi kapattığı için derleyici memnun. Son kolu `Some(n @ 0..=44)` yapsaydın 45–49 aralığı (guard
  yanlış olduğunda) açıkta kalırdı ve **E0004** alırdın; derleyici guard'ın yanlış olabileceğini hesaba katar.
```

## Dilim desenleri

Dilim desenleri bir dizinin ya da dilimin (Modül 5) elemanlarını **konumlarına** göre eşleştirir:

| Desen | Uyduğu dilimler |
|---|---|
| `[]` | boş dilim |
| `[x]` | tam bir elemanlı; elemanı `x`'e bağlar |
| `[a, b]` | tam iki elemanlı |
| `[ilk, ..]` | en az bir elemanlı; ilkini bağlar |
| `[ilk, .., son]` | en az iki elemanlı; ilk ve sonu bağlar |
| `[bas, kalan @ ..]` | en az bir elemanlı; ilkini ve **kalan dilimi** bağlar |
| `[.., sondan_ikinci, _]` | en az iki elemanlı |

```rust
fn tarif(adimlar: &[&str]) -> String {
    match adimlar {
        [] => String::from("Tarif boş"),
        [tek] => format!("Tek adım: {tek}"),
        [ilk, son] => format!("Önce {ilk}, sonra {son}"),
        [ilk, ara @ .., son] => format!("{ilk} ile başla, {} ara adım, {son} ile bitir", ara.len()),
    }
}

fn main() {
    println!("{}", tarif(&[]));
    println!("{}", tarif(&["suyu kaynat"]));
    println!("{}", tarif(&["demle", "servis et"]));
    println!("{}", tarif(&["suyu kaynat", "çayı ekle", "demle", "servis et"]));

    // Sabit boylu dizilerde dilim deseni reddedilemezdir
    let rgb = [255, 140, 0];
    let [kirmizi, yesil, mavi] = rgb;
    println!("turuncu: ({kirmizi}, {yesil}, {mavi})");
}
```

Dört kol bütün uzunlukları kapsıyor (0, 1, 2 ve "2'den fazla"); derleyici bunu kendisi hesaplıyor. Bir
uzunluğu unutsaydın hata mesajı açıkta kalan şekli gösterirdi: *pattern `&[]` not covered*. `ara @ ..`
yazımı bir `@` bağlamasıdır: `..`'nın yuttuğu bölümü bir **alt dilim** olarak (`&[&str]`) bağlar.

```memory
title: "[ilk, ara @ .., son] deseni ve dilimler"
steps:
  - caption: "`adimlar` 4 elemanlı bir dilim: bir işaretçi + uzunluk (fat pointer). Veri tek bir yerde duruyor."
    stack:
      - frame: tarif
        vars:
          - { name: adimlar, type: "&[&str]", value: "ptr · len=4", to: h1 }
    heap:
      - { id: h1, label: dizi, value: "kaynat | ekle | demle | servis" }
  - caption: "Desen uydu: `ilk` ve `son` elemanlara referans, `ara` ise **aynı verinin** ortasına bakan yeni bir dilim (1. elemandan başlıyor, uzunluk 2). Hiçbir şey kopyalanmadı."
    stack:
      - frame: tarif
        vars:
          - { name: adimlar, type: "&[&str]", value: "ptr · len=4", to: h1 }
          - { name: ilk, type: "&&str", value: "→ [0]", to: h1 }
          - { name: ara, type: "&[&str]", value: "ptr+1 · len=2", to: h1 }
          - { name: son, type: "&&str", value: "→ [3]", to: h1 }
    heap:
      - { id: h1, label: dizi, value: "kaynat | ekle | demle | servis" }
```

(Örnekteki "heap" kutusu verinin durduğu yeri temsil ediyor; dizi `main`'in stack'inde de olabilir.
Önemli olan, `ara`'nın yeni bir kopya değil aynı veriye bakan bir görünüm olması.)

Bir `Vec`'i doğrudan dilim deseniyle eşleştirebilir misin? Tahmin et:

```compiles
code: |
  fn main() {
      let kuyruk = vec!["Ali", "Ece", "Can"];
      match kuyruk {
          [ilk, ..] => println!("Sıradaki: {ilk}"),
          [] => println!("Kuyruk boş"),
      }
  }
answer: false
error: E0529
explanation: |
  Derlenmez: **E0529**, *expected an array or slice, found `Vec<&str>`*. Dilim desenleri yalnızca dizilere
  (`[T; N]`) ve dilimlere (`[T]`, `&[T]`) uyar; `Vec` ise bir struct'tır. Önce dilime çevir:
  `match kuyruk.as_slice()` ya da `match &kuyruk[..]`. Derleyicinin önerisi (`match kuyruk[..]`) bu örnekte
  elemanlar `&str` (yani `Copy`) olduğu için çalışır; `String` gibi taşınan elemanlarda ödünç alan
  `as_slice()` daha güvenli seçimdir.
```

## Özyinelemeli dilim işleme

`[bas, kalan @ ..]` deseni, bir listeyi "ilk eleman + geri kalanı" diye düşünmeyi sağlar. Bu, fonksiyonel
dillerin (Haskell, OCaml, Elixir) en sevdiği tekniktir ve Rust'ta dilim desenleriyle doğal biçimde yazılır:

```rust
fn toplam(sayilar: &[i32]) -> i32 {
    match sayilar {
        [] => 0,
        [bas, kalan @ ..] => bas + toplam(kalan),
    }
}

fn palindrom_mu(harfler: &[char]) -> bool {
    match harfler {
        [] | [_] => true,
        [ilk, orta @ .., son] if ilk == son => palindrom_mu(orta),
        _ => false,
    }
}

fn main() {
    println!("toplam = {}", toplam(&[4, 8, 15, 16, 23, 42]));

    for kelime in ["kayak", "ana", "rust", "ey edip adanada pide ye"] {
        let harfler: Vec<char> = kelime.chars().filter(|c| *c != ' ').collect();
        println!("{kelime:?} palindrom mu? {}", palindrom_mu(&harfler));
    }
}
```

`palindrom_mu` üç aracı birden kullanıyor: `[] | [_]` (boş ya da tek harfli), `orta @ ..` (iç dilimi
bağlamak) ve `if ilk == son` (iki bağlamayı karşılaştıran guard). Her adımda dilim iki eleman kısalıyor
ve hiçbir kopya oluşmuyor; `orta` aynı belleğe bakan daha kısa bir görünüm.

:::warning Özyinelemenin bedeli
Her özyinelemeli çağrı stack'e yeni bir çerçeve ekler. Birkaç bin elemanlık dilimler için sorun değil, ama
milyonlarca elemanda stack taşabilir (*stack overflow*). Rust, Haskell gibi kuyruk çağrısı optimizasyonunu
**garanti etmez**. Büyük veride aynı mantığı bir döngüyle ya da Modül 14'teki iterator'larla
(`sayilar.iter().sum()`) yaz; dilim desenleri orada da işe yarar: `while let [bas, kalan @ ..] = dilim { ... }`.
:::

```exercise
id: m21-e-begeni
title: Beğeni özeti
difficulty: 3
prompt: |
  Bir sosyal medya uygulaması bir gönderiyi beğenenleri tek satırda özetliyor. `begeni_ozeti` fonksiyonunu
  **dilim desenleriyle** yaz:

  | Beğenenler | Çıktı |
  |---|---|
  | `[]` | `"Henüz kimse beğenmedi"` |
  | `["Ali"]` | `"Ali beğendi"` |
  | `["Ali", "Ece"]` | `"Ali ve Ece beğendi"` |
  | `["Ali", "Ece", "Can"]` | `"Ali, Ece ve Can beğendi"` |
  | 4 ya da daha fazla kişi | `"Ali, Ece ve 2 kişi daha beğendi"` (ilk ikisi + kalan sayısı) |

  `if` ya da `.len() ==` karşılaştırmaları kullanma; uzunluğu desenler belirlesin.
starter: |
  fn begeni_ozeti(kisiler: &[&str]) -> String {
      todo!()
  }

  fn main() {
      println!("{}", begeni_ozeti(&[]));
      println!("{}", begeni_ozeti(&["Ali", "Ece", "Can", "Deniz"]));
  }
solution: |
  fn begeni_ozeti(kisiler: &[&str]) -> String {
      match kisiler {
          [] => String::from("Henüz kimse beğenmedi"),
          [a] => format!("{a} beğendi"),
          [a, b] => format!("{a} ve {b} beğendi"),
          [a, b, c] => format!("{a}, {b} ve {c} beğendi"),
          [a, b, kalan @ ..] => format!("{a}, {b} ve {} kişi daha beğendi", kalan.len()),
      }
  }

  fn main() {
      println!("{}", begeni_ozeti(&[]));
      println!("{}", begeni_ozeti(&["Ali", "Ece", "Can", "Deniz"]));
  }
check: tests
tests: |
  #[test]
  fn bos_ve_tek() {
      assert_eq!(begeni_ozeti(&[]), "Henüz kimse beğenmedi");
      assert_eq!(begeni_ozeti(&["Zeynep"]), "Zeynep beğendi");
  }

  #[test]
  fn iki_ve_uc_kisi() {
      assert_eq!(begeni_ozeti(&["Ali", "Ece"]), "Ali ve Ece beğendi");
      assert_eq!(begeni_ozeti(&["Ali", "Ece", "Can"]), "Ali, Ece ve Can beğendi", "üç kişide herkesin adı yazılmalı");
  }

  #[test]
  fn kalabalik() {
      assert_eq!(begeni_ozeti(&["Ali", "Ece", "Can", "Deniz"]), "Ali, Ece ve 2 kişi daha beğendi");
      let on_kisi = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
      assert_eq!(begeni_ozeti(&on_kisi), "A, B ve 8 kişi daha beğendi", "kalan kişi sayısı doğru hesaplanmalı");
  }
hints:
  - "Her uzunluk için bir kol: `[]`, `[a]`, `[a, b]`, `[a, b, c]`. Değişmez uzunluklu desenler yalnızca o uzunluktaki dilimlere uyar."
  - "4 ve üstü için ilk ikisini bağla, gerisini `@ ..` ile bir alt dilim olarak al: `[a, b, kalan @ ..]`."
  - "Kalan kişi sayısı `kalan.len()`. `[a, b, kalan @ ..]` kolu `[a, b, c]` kolundan **sonra** gelmeli; yoksa üç kişilik listeler de ona düşer."
forbid:
  - pattern: "\\bif\\b"
    message: Uzunluğu `if` ile değil, dilim desenleriyle ayırt et.
  - pattern: "len\\(\\)\\s*(==|>=|<=|>|<)"
    message: "`.len()` karşılaştırması yerine dilim desenleri kullan."
require:
  - pattern: "@\\s*\\.\\."
    message: Kalan kişileri `kalan @ ..` gibi bir dilim bağlamasıyla yakala.
explanation: |
  Beş kol beş kuralı birebir yansıtıyor ve derleyici bütün uzunlukların kapsandığını kendisi doğruluyor:
  0, 1, 2, 3 ve "en az 2" (sonuncusu 2 ve 3'ü de kapsardı ama onlar daha önce yakalandı). Sıralama yine
  mantığın parçası: `[a, b, kalan @ ..]` en az iki elemanlı her dilime uyar, bu yüzden en sona yazıldı.

  Indeks tabanlı bir çözüm (`kisiler[0]`, `kisiler[1]`, `if kisiler.len() == 3`) aynı işi yapar ama her indeksin
  geçerli olduğunu **sen** garanti etmek zorundasın; bir hata panik demektir. Dilim desenlerinde bağlanan her
  isim, desen uyduğu için zaten vardır: indeks dışına çıkmak imkânsızdır.

  Eski projelerde aynı fikir `match kisiler.len() { 0 => ..., 1 => ... }` ile yazılır ve içeride yine
  indekslenir. Dilim desenleri (Rust 1.42'den beri `..` bağlamaları dahil kararlı) bu iki adımı birleştirir.
```

## Box ve desenler: kısa bir not

Modül 17'de `Box` ile özyinelemeli tipler kurdun. Peki bir `Box`'ın **içine** desenle bakabilir misin?
Kısa cevap: doğrudan hayır. `box` desenleri dilde var ama hâlâ **kararsız (unstable)**:

:::error
```text
error[E0658]: box pattern syntax is experimental
 --> src/main.rs:4:9
  |
4 |         box n => println!("{n}"),
  |         ^^^^^
  |
  = note: see issue #29641 <https://github.com/rust-lang/rust/issues/29641> for more information
```
**E0658** "bu özellik yalnızca nightly derleyicide, özel bir izinle kullanılabilir" demektir. Kararlı
(stable) Rust'ta `Box`'ı aşmanın yolu **deref**'tir.
:::

Pratikte iki teknik yeterli. Bir ifade ağacı (expression tree) üzerinde ikisini de görelim:

```rust
#[derive(Debug)]
enum Ifade {
    Sayi(i64),
    Topla(Box<Ifade>, Box<Ifade>),
    Carp(Box<Ifade>, Box<Ifade>),
    Eksi(Box<Ifade>),
}

use Ifade::*;

fn hesapla(ifade: &Ifade) -> i64 {
    match ifade {
        Sayi(n) => *n,
        // a ve b birer &Box<Ifade>; deref zorlaması (Modül 17) onları &Ifade'ye çevirir
        Topla(a, b) => hesapla(a) + hesapla(b),
        Carp(a, b) => hesapla(a) * hesapla(b),
        Eksi(ic) => -hesapla(ic),
    }
}

fn sadelestir(ifade: Ifade) -> Ifade {
    match ifade {
        // *ic: Box'ın içindekini dışarı TAŞI ve onunla eşleştir
        Eksi(ic) => match *ic {
            Eksi(icteki) => sadelestir(*icteki), // -(-x) = x
            Sayi(0) => Sayi(0),                  // -0 = 0
            baska => Eksi(Box::new(sadelestir(baska))),
        },
        Topla(a, b) => Topla(Box::new(sadelestir(*a)), Box::new(sadelestir(*b))),
        Carp(a, b) => Carp(Box::new(sadelestir(*a)), Box::new(sadelestir(*b))),
        Sayi(n) => Sayi(n),
    }
}

fn main() {
    // (2 + 3) * -(-4)
    let ifade = Carp(
        Box::new(Topla(Box::new(Sayi(2)), Box::new(Sayi(3)))),
        Box::new(Eksi(Box::new(Eksi(Box::new(Sayi(4)))))),
    );
    println!("sonuç: {}", hesapla(&ifade));
    let sade = sadelestir(ifade);
    println!("sade: {sade:?}");
    println!("sade sonuç: {}", hesapla(&sade));
}
```

1. **Okurken** (`&Ifade`): desen alanı bir `&Box<Ifade>` olarak bağlar; onu `&Ifade` bekleyen bir fonksiyona
   verince deref zorlaması işi halleder. İç içe bakman gerekirse ikinci bir `match`'e `ic.as_ref()` ya da
   `&**ic` ver.
2. **Sahip olduğunda** (`Ifade`): `*ic` ile kutunun içeriğini dışarı **taşır** ve onunla eşleştirirsin. `Box`
   bu konuda özeldir: sıradan bir referansın arkasından değer taşıyamazsın (E0507) ama kendi sahip olduğun
   bir `Box`'ın içini `*` ile taşıyabilirsin.

İç içe deseni tek seferde yazmayı denersen ne olur?

```compiles
code: |
  enum Ifade {
      Sayi(i64),
      Eksi(Box<Ifade>),
  }

  fn hesapla(ifade: &Ifade) -> i64 {
      match ifade {
          Ifade::Eksi(Ifade::Sayi(n)) => -n,
          Ifade::Eksi(_) => 0,
          Ifade::Sayi(n) => *n,
      }
  }

  fn main() {
      println!("{}", hesapla(&Ifade::Eksi(Box::new(Ifade::Sayi(3)))));
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308**, *expected `Box<Ifade>`, found `Ifade`*. `Eksi`'nin alanı bir `Box<Ifade>`'dir ve
  desenler `Box`'ın içine kendiliğinden girmez (varsayılan bağlama kipleri yalnızca `&` ve `&mut`'u açar).
  Derleyicinin önerisi (`match &*ifade`) burada işe yaramaz, çünkü sorun dıştaki referansta değil alanın
  içindeki `Box`'ta. `help` satırları çoğu zaman doğrudur ama her zaman değil; önce hatanın **kendisini**
  oku. Çözüm: `Ifade::Eksi(ic) => match ic.as_ref() { Ifade::Sayi(n) => -n, _ => 0 }`.
```

## Özet

:::remember
- **Match guard** (`DESEN if KOSUL`): desen uyduktan sonra koşulu sınar; desenin bağladığı isimleri ve dıştaki değişkenleri kullanabilir.
- Guard `|` ile bağlı **bütün** alternatiflere uygulanır: `4 | 5 if c` = `(4 | 5) if c`.
- Guard'lı kollar eksiksizliğe **sayılmaz**: en az bir koşulsuz kol gerekir (**E0004**).
- `isim @ DESEN`: sına ve bağla (`m @ 3..=5`, `m @ (1 | 2)`, `Sayfa { no: s @ 1..=10 }`). `@` kolları eksiksizliğe sayılır.
- Dilim desenleri: `[]`, `[x]`, `[a, b]`, `[ilk, ..]`, `[ilk, .., son]`, `[bas, kalan @ ..]`. Diziler ve dilimler için; `Vec` için `.as_slice()` (**E0529**).
- `kalan @ ..` aynı veriye bakan bir alt dilim bağlar; kopyalama yok, indeks dışına çıkma imkânsız.
- `box` desenleri kararsız (**E0658**). `Box` içine bakmak için deref: `&Box<T>` → `&T` zorlaması, `ic.as_ref()`, ya da sahip olduğun kutuda `match *ic`.
:::

```reflect
prompt: |
  `palindrom_mu` fonksiyonunu indekslerle (`harfler[0]`, `harfler[harfler.len() - 1]`) yazsaydın ne
  değişirdi? Dilim desenleri hangi hata türlerini imkânsız hâle getiriyor?
answer: |
  İndeksli sürümde boş dilim için `harfler.len() - 1` taşar (usize'da 0 - 1 debug modda panik), yanlış bir
  sınır hesabı indeks dışı paniğine yol açar ve alt dilimi `&harfler[1..harfler.len() - 1]` diye elle
  kurmam gerekir. Dilim desenlerinde `[ilk, orta @ .., son]` yalnızca en az iki elemanlı dilime uyar; `ilk`,
  `son` ve `orta` desen uyduğu için zaten vardır ve doğru sınırlara sahiptir. Boş ve tek elemanlı durumları
  unutursam derleyici E0004 ile söyler. Yani "sınır hatası" ve "unutulan durum" hataları derleme zamanına
  taşınır.
```

```flashcards
- front: Match guard nedir ve ne zaman değerlendirilir?
  back: "Bir kolun deseninden sonra gelen `if KOSUL`. Yalnızca desen uyduktan **sonra** değerlendirilir; yanlışsa sıradaki kola geçilir."
- front: "`4 | 5 | 6 if c => ...` kolunda guard hangi alternatiflere uygulanır?"
  back: "Hepsine: `(4 | 5 | 6) if c`."
- front: "Guard'lı kollar eksiksizlik hesabına sayılır mı?"
  back: "Hayır (*match arms with guards don't count towards exhaustivity*). Koşulsuz bir kol gerekir, yoksa E0004."
- front: "`m @ 3..=5` deseni ne yapar?"
  back: "Değeri `3..=5` aralığıyla sınar ve uyarsa `m`'ye bağlar."
- front: "`[bas, kalan @ ..]` deseni hangi dilimlere uyar ve `kalan`'ın tipi nedir?"
  back: "En az bir elemanlı dilimlere. `kalan` geri kalan elemanlara bakan bir alt dilimdir (`&[T]`)."
- front: "Bir `Vec`'i dilim deseniyle eşleştirmeye çalışınca hangi hata çıkar, çözüm nedir?"
  back: "**E0529** (*expected an array or slice*). `v.as_slice()` ya da `&v[..]` ile eşleştir."
- front: "Kararlı Rust'ta `Box` içindeki değerle nasıl eşleştirilir?"
  back: "`box` deseni kararsız (E0658). Okurken `ic.as_ref()` / `&**ic` ya da deref zorlaması; sahip olunan kutuda `match *ic`."
- front: "`m @ 12 | 1 | 2` neden E0408 verir?"
  back: "`@` yalnızca `12`'ye uygulanır; `1` ve `2` alternatifleri `m`'yi bağlamaz. Doğrusu `m @ (12 | 1 | 2)`."
```
