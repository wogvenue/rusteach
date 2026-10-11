---
id: m09-l02
title: String derinlemesine
minutes: 25
type: lesson
objectives:
  - "`String` ile `&str` arasındaki farkı ve hangisinin ne zaman kullanılacağını açıklayabilmek"
  - UTF-8'de bayt, `char` ve grafem kümesi (grapheme cluster) ayrımını örnekle gösterebilmek
  - "`push_str`, `+` ve `format!` ile metin birleştirirken sahipliğin nasıl aktığını söyleyebilmek"
  - "`chars`, `trim`, `split_whitespace`, `contains`, `replace` gibi metotlarla Türkçe metni doğru işleyebilmek"
keywords: [String, "&str", UTF-8, char, bayt, grafem, format!, to_lowercase, "İ ve ı"]
---

Hızlı bir soru: `"şeker"` kelimesi kaç harftir? Beş, değil mi? Rust'a sorarsan cevap, **nasıl**
sorduğuna göre 5 de olabilir 6 da. Hangisi doğru? İkisi de!

Bu derste metinlerin bilgisayarda gerçekte nasıl saklandığını, **UTF-8**'i, öğrenecek ve Türkçe
metinleri hatasız işlemeyi göreceksin. Rust'ın `String`'i ilk bakışta diğer dillerdekinden "zor"
gelebilir. Dersin sonunda bu zorluğun aslında bir **dürüstlük** olduğunu fark edeceksin: Rust, diğer
dillerin halının altına süpürdüğü gerçek karmaşıklığı sana açıkça gösteriyor.

## Önce tahmin et: "şeker" kaç harf?

```predict
code: |
  fn main() {
      let kelime = String::from("şeker");
      println!("{}", kelime.len());
      println!("{}", kelime.chars().count());
  }
options:
  - |
    5
    5
  - |
    6
    5
  - |
    10
    5
answer: 1
explanation: |
  `len()` **bayt** sayısını verir, harf sayısını değil! `ş` harfi UTF-8'de 2 bayt tutar, diğer dört
  harf (e, k, e, r) birer bayt: 2 + 4 = 6. `chars().count()` ise karakterleri tek tek sayar: 5.
  (10 diyen, her harfin 2 bayt olduğunu düşündü; ASCII harfleri yalnızca 1 bayttır.)
```

Bu sonucu anlamak için `String`'in bellekteki hâline bakalım. Modül 4'ten hatırla: `String` stack'te
üç parça (işaretçi, uzunluk, kapasite), heap'te ise **baytlar** tutar. `len()` işte bu bayt sayısıdır.

```memory
title: String, &str ve baytlar
steps:
  - caption: "`String::from(\"şeker\")`: heap'te 6 bayt. `ş` iki bayt kaplıyor (`C5 9F`), diğer harfler birer bayt."
    stack:
      - frame: main
        vars:
          - { name: kelime, type: String, value: "ptr · len=6 · cap=6", to: h1 }
    heap:
      - { id: h1, value: "C5 9F | 65 | 6B | 65 | 72", label: "ş | e | k | e | r" }
  - caption: "`let son = &kelime[2..];` bir **dilim** (`&str`): sahip değil, sadece işaretçi + uzunluk. 2. bayttan başlıyor, yani `\"eker\"`."
    stack:
      - frame: main
        vars:
          - { name: kelime, type: String, value: "ptr · len=6 · cap=6", to: h1 }
          - { name: son, type: "&str", value: "ptr(+2) · len=4", to: h1 }
    heap:
      - { id: h1, value: "C5 9F | 65 | 6B | 65 | 72", label: "ş | e | k | e | r" }
  - caption: "Koddaki `\"Merhaba\"` sabiti de bir `&str`'dir; baytları heap'te değil, **programın içinde** (salt okunur bölgede) durur."
    stack:
      - frame: main
        vars:
          - { name: kelime, type: String, value: "ptr · len=6 · cap=6", to: h1 }
          - { name: son, type: "&str", value: "ptr(+2) · len=4", to: h1 }
          - { name: selam, type: "&'static str", value: "ptr · len=7", to: s1 }
    heap:
      - { id: h1, value: "C5 9F | 65 | 6B | 65 | 72", label: "ş | e | k | e | r" }
      - { id: s1, value: "4D 65 72 68 61 62 61", label: "\"Merhaba\", programın içinde" }
```

İki metin tipini yan yana koyalım:

| | `String` | `&str` |
|---|---|---|
| Nedir? | Sahip olunan (owned), büyüyebilen metin | Başka birinin baytlarına bakan, ödünç bir **dilim** |
| Bellekte | işaretçi + uzunluk + kapasite → heap | işaretçi + uzunluk |
| Değiştirilebilir mi? | Evet (`mut` ise) | Hayır |
| Nereden gelir? | `String::from`, `String::new`, `format!`, `.to_string()` | metin sabitleri `"..."`, `&s[..]`, `s.as_str()` |
| Tipik kullanım | Metin **üretirken**, struct alanında | Fonksiyon **parametresi**, sabitler |

Pratik kural: **parametre olarak `&str` al, yeni bir metin üretiyorsan `String` döndür.** `&String`
gereken yerde otomatik olarak `&str`'ye dönüşür; böylece fonksiyonun hem `String`'lerle hem sabitlerle
çalışır. (`"merhaba".to_string()` da `String::from("merhaba")` ile aynı işi yapar; nereden geldiğini
Modül 11'de `Display` trait'iyle göreceğiz.)

## UTF-8: bayt, char ve grafem

Bilgisayar yalnızca sayı saklayabilir. **Unicode**, dünyadaki her karaktere bir numara verir: `A` =
U+0041, `ş` = U+015F, `€` = U+20AC, `🦀` = U+1F980. Bu numaraya **kod noktası (code point)** denir. Rust'ın
`char` tipi bir **Unicode skaler değeri** tutar: UTF-16'nın iç işleri için ayrılmış "vekil" (surrogate)
aralığı U+D800–U+DFFF dışındaki her kod noktası. Her `char` bellekte 4 bayttır (Modül 2).

Ama bir metni karakter başına 4 bayt harcayarak saklamak israf olurdu. **UTF-8** bu numaraları
**değişken uzunlukta** saklar:

| Karakter | Kod noktası | UTF-8 baytları | `len_utf8()` |
|---|---|---|---|
| `a` | U+0061 | `61` | 1 |
| `I` | U+0049 | `49` | 1 |
| `ı` | U+0131 | `C4 B1` | 2 |
| `ş` | U+015F | `C5 9F` | 2 |
| `ğ` | U+011F | `C4 9F` | 2 |
| `€` | U+20AC | `E2 82 AC` | 3 |
| `🦀` | U+1F980 | `F0 9F A6 80` | 4 |

Neden UTF-8? İngilizce metinlerde eski ASCII ile **birebir aynıdır** (geriye uyumlu), Latin
alfabelerinde kompakttır ve bayt sırası (endianness) derdi yoktur. Bugün web sayfalarının çok büyük
çoğunluğu UTF-8'dir. Rust da net bir karar verdi: **bir `String` her zaman geçerli UTF-8'dir**, tip
sistemi bunu garanti eder. Güvenli Rust'ta bozuk baytlar bir `String`'e asla giremez: ham baytlardan
metin üretmek isteyen `String::from_utf8(baytlar)` bile sonucu doğrudan değil, baytlar geçersizse hata
bildiren bir `Result` olarak döndürür (Modül 10).

Aynı metne üç farklı mercekle bakabilirsin:

1. **Baytlar** (`.bytes()`, her biri `u8`): bilgisayarın gördüğü.
2. **Karakterler** (`.chars()`, her biri `char`): Unicode skaler değerleri.
3. **Grafem kümeleri (grapheme clusters)**: insanın "tek bir harf" olarak algıladığı birim.

```rust
fn main() {
    let metin = "Ağaç🌳";
    println!("bayt: {}, char: {}", metin.len(), metin.chars().count());

    for c in metin.chars() {
        println!("{c:?} → {} bayt", c.len_utf8());
    }

    print!("Baytlar:");
    for b in metin.bytes() {
        print!(" {b:02X}"); // iki haneli onaltılık (hex) yazım
    }
    println!();

    let bayrak = "🇹🇷";
    println!("bayrak: {} bayt, {} char", bayrak.len(), bayrak.chars().count());
}
```

Bayrak satırı ilginç: ekranda **tek** sembol görünüyor ama 2 `char` ve 8 bayt. Türk bayrağı emojisi
aslında iki "bölgesel gösterge" karakterinden oluşur: 🇹 (T) ve 🇷 (R). Benzer şekilde `é` harfi tek bir
`char` (U+00E9) olarak da, `e` + birleşik vurgu işareti (U+0301) olarak da yazılabilir. Ekranda aynı
görünürler ama Rust'ta `==` ile karşılaştırınca **eşit çıkmazlar**, çünkü baytları farklıdır.

Standart kütüphane grafem kümelerini saymaz; gerektiğinde `unicode-segmentation` crate'i kullanılır.
"Kullanıcıya gösterilen karakter sayısı" gibi işlerde bunu aklında tut.

:::analogy Otobüs koltukları
Metni bir otobüs gibi düşün. **Baytlar** koltuklardır; `len()` dolu koltuk sayısını verir.
**Karakterler** yolculardır; `chars().count()` yolcu sayısını verir. ASCII harfleri tek koltuğa
sığar, `ş` ve `ğ` iki koltuk kaplar, emoji'ler dört. **Grafem kümesi** ise birlikte seyahat eden bir
ailedir: biletleri ayrı ayrı kesilir (🇹 ve 🇷 iki yolcu) ama insan gözü onları tek bir grup olarak görür.
:::

```quiz
question: "`\"Iğdır\".len()` kaç döndürür?"
options:
  - "5"
  - "7"
  - "6"
  - "10"
answer: 1
explanation: |
  `I`(1) + `ğ`(2) + `d`(1) + `ı`(2) + `r`(1) = **7** bayt. Tuzak, iki farklı "ı/I" harfinde:
  büyük `I` (noktasız) ASCII'dir ve 1 bayt tutar; küçük `ı` (noktasız) ise Türkçeye özgüdür ve
  2 bayt tutar. Karakter sayısı ise 5'tir: `"Iğdır".chars().count()`.
feedback:
  - "5, karakter sayısı (`chars().count()`). `len()` ise bayt sayar."
  - "Doğru! `ğ` ve `ı` ikişer bayt, diğerleri birer bayt."
  - "Büyük `I`'yı 2 bayt saydın; o ASCII'dir, 1 bayt tutar."
  - "Her harf 2 bayt değildir; ASCII harfleri 1 bayttır."
```

## Neden `s[0]` yazamazsın?

Python ya da JavaScript'ten geliyorsan bir metnin ilk harfini `s[0]` ile almaya alışkınsındır. Önce tahmin et:

```compiles
code: |
  fn main() {
      let s = String::from("şeker");
      let ilk = s[0];
      println!("{ilk}");
  }
answer: false
error: E0277
explanation: |
  Rust'ta `String` (ve `str`) **tamsayıyla indekslenemez**. Derleyici bu satırı reddeder; nedenleri
  hemen aşağıda.
```

:::error
```text
error[E0277]: the type `str` cannot be indexed by `{integer}`
 --> src/main.rs:3:17
  |
3 |     let ilk = s[0];
  |                 ^ string indices are ranges of `usize`
  |
  = help: the trait `SliceIndex<str>` is not implemented for `{integer}`
  = note: you can use `.chars().nth()` or `.bytes().nth()`
          for more information, see chapter 8 in The Book: <https://doc.rust-lang.org/book/ch08-02-strings.html#indexing-into-strings>
```
Derleyici sadece "hayır" demiyor: ne yapabileceğini (`.chars().nth()`, `.bytes().nth()`) ve konuyu
anlatan kitap bölümünü de gösteriyor. *string indices are ranges of `usize`* cümlesi de önemli: bir
metinde indeks olarak yalnızca **aralık** kullanılabilir (`&s[0..2]`).
:::

Rust neden bu kadar katı? Üç sebebi var:

1. **Bayt mı, harf mi?** `"şeker"`'in 0. baytı `0xC5`'tir; bu, `ş`'nin sadece **yarısı**. Yarım bir harfi
   harf gibi döndürmek anlamsız olurdu.
2. **Hangi birim?** `s[0]` bir bayt mı, bir `char` mı, bir grafem mi döndürmeli? Her biri farklı bir
   cevap verir. Rust tahmin yürütmek yerine seçimi sana bırakır.
3. **Performans sözü.** İndekslemenin O(1), yani sabit sürede olması beklenir. UTF-8'de karakterler
   farklı uzunlukta olduğundan 5. karakterin hangi baytta başladığını bulmak için baştan saymak gerekir:
   O(n). Rust, ucuz görünüp pahalı olan bir işlemi `[]` arkasına **gizlemez**.

Diğer diller bu soruyu nasıl çözüyor?

- **Python 3:** `s[0]` bir kod noktası döndürür. Bunu sabit sürede yapabilmek için metni içeride,
  içindeki en "geniş" karaktere göre karakter başına 1, 2 ya da 4 bayt kullanarak saklar. Uzun bir
  metne tek bir emoji eklemek, metnin tamamının bellekte 4 kat yer kaplamasına yol açabilir.
- **JavaScript / Java:** Metinler UTF-16'dır. `"🦀".length` **2** döner ve `s[0]` bir emojinin
  **yarısını** (bir "vekil", surrogate) verir. Hata sessizce oluşur.
- **C:** `char*` yalnızca baytlardır; tüm sorumluluk sendedir.
- **Rust:** Ne istediğini **açıkça** söylersin.

## Doğru araçlar: `chars`, `bytes` ve güvenli dilimler

"Açıkça söylemek" pratikte şöyle görünür:

```rust
fn main() {
    let s = String::from("şeker");

    // İlk karakter: Option<char> döner (metin boş olabilir)
    let ilk = s.chars().next();
    println!("ilk karakter: {ilk:?}");

    // n'inci karakter: baştan saymak gerekir → O(n)
    let ucuncu = s.chars().nth(2);
    println!("üçüncü karakter: {ucuncu:?}");

    // Gerçekten bayt istiyorsan: as_bytes() bir &[u8] verir
    let ilk_bayt = s.as_bytes()[0];
    println!("ilk bayt: {ilk_bayt} (0x{ilk_bayt:X})");

    // Bayt aralığıyla dilim: sınırlar karakter sınırına denk gelmeli
    let ilk_harf = &s[0..2];
    println!("ilk iki bayt: {ilk_harf}");

    // Güvenli dilim: get → Option<&str>, geçersiz sınırda None
    println!("{:?} {:?}", s.get(0..1), s.get(0..2));

    // Her karakteri bayt konumuyla birlikte gezmek
    for (konum, c) in s.char_indices() {
        println!("{konum}. bayttan başlayan karakter: {c}");
    }
}
```

`next()` ve `nth()` birer iterator metodudur (Modül 14); şimdilik `s.chars().next()` kalıbını "ilk
karakter" diye okuman yeterli. `char_indices()` ise her karakteri, başladığı bayt konumuyla birlikte
verir; güvenli dilimleme için çok kullanışlıdır.

```compiles
question: "Bu kod **derlenir** mi? (Dikkat: soru \"doğru çalışır mı\" değil!)"
code: |
  fn main() {
      let s = String::from("şeker");
      let parca = &s[0..1];
      println!("{parca}");
  }
answer: true
explanation: |
  **Derlenir** ama çalıştırınca **panikler**! Modül 5'ten hatırla: dilim sınırları **bayt** konumudur
  ve derleyici metnin içeriğini derleme zamanında bilemez. `0..1` aralığı `ş`'nin iki baytının ortasına
  düşüyor; program şu mesajla durur:

  `end byte index 1 is not a char boundary; it is inside 'ş' (bytes 0..2 of string)`

  Güvenli yol `s.get(0..1)`: geçersiz bir sınırda panik yerine `None` döndürür.
```

```parsons
prompt: |
  Satırları sıralayarak bir kelimeyi **karakter karakter** ters çeviren programı kur
  (`"kitap"` → `"patik"`). Dikkat: aralarına iki yanlış satır karıştı.
lines: |
  fn main() {
      let kelime = "kitap";
      let mut ters = String::new();
      for c in kelime.chars().rev() {
          ters.push(c);
      }
      println!("{ters}");
  }
distractors: |
      for c in kelime.bytes().rev() {
          ters.push_str(c);
explanation: |
  `chars().rev()` karakterleri sondan başa verir; her birini `push` ile ekleriz. `bytes().rev()` ise
  `u8` baytlar verir ve `String::push` bir `u8` değil `char` istediği için derlenmez bile. Rust burada
  seni korur: `"çiğdem"` gibi bir kelimenin baytlarını ters çevirmek, çok baytlı harflerin iki baytını da
  ters çevirip geçerli UTF-8 olmayan bir bayt dizisi üretirdi. `push_str` bir `&str` bekler; tek bir
  `char` için `push` kullanılır.

  Bir uyarı: karakter bazında ters çevirmek grafemleri bölebilir; `"🇹🇷"` ters çevrilince `"🇷🇹"` olur.
```

````exercise
id: m09-e-kisalt
title: Önizleme metni
difficulty: 2
prompt: |
  Bir mesajlaşma uygulaması, bildirimlerde mesajın sadece ilk birkaç karakterini gösteriyor.
  `kisalt(metin, n)` fonksiyonunu yaz:

  - Metin en fazla `n` **karakter** ise metni aynen döndürsün.
  - Daha uzunsa ilk `n` karakteri alıp sonuna `…` (tek bir "üç nokta" karakteri) eklesin.

  Dikkat: "karakter" diyoruz, bayt değil! `kisalt("Çiğdem", 2)` → `"Çi…"` olmalı. Bayt aralığıyla
  dilimlemeye (`&metin[..n]`) çalışırsan Türkçe harflerde panik alırsın.
starter: |
  fn kisalt(metin: &str, n: usize) -> String {
      todo!()
  }

  fn main() {
      println!("{}", kisalt("Yarın sabah dokuzda kampüste buluşalım", 11));
      println!("{}", kisalt("Tamam", 11));
  }
solution: |
  fn kisalt(metin: &str, n: usize) -> String {
      let mut sonuc = String::new();
      for (sira, c) in metin.chars().enumerate() {
          if sira == n {
              // n karakter zaten eklendi ve hâlâ karakter var: kes
              sonuc.push('…');
              return sonuc;
          }
          sonuc.push(c);
      }
      sonuc
  }

  fn main() {
      println!("{}", kisalt("Yarın sabah dokuzda kampüste buluşalım", 11));
      println!("{}", kisalt("Tamam", 11));
  }
check: tests
tests: |
  #[test]
  fn kisa_metin_aynen_kalir() {
      assert_eq!(kisalt("Tamam", 11), "Tamam", "n'den kısa metne dokunulmamalı");
  }

  #[test]
  fn tam_n_karakter_aynen_kalir() {
      assert_eq!(kisalt("Rust", 4), "Rust", "tam n karakterlik metne … eklenmemeli");
  }

  #[test]
  fn uzun_metin_kisalir() {
      assert_eq!(kisalt("Merhaba dünya", 7), "Merhaba…");
  }

  #[test]
  fn turkce_harfleri_bolmez() {
      assert_eq!(kisalt("Çiğdem", 2), "Çi…", "n bayt değil, n karakter sayılmalı");
      assert_eq!(kisalt("şşşşş", 3), "şşş…");
  }

  #[test]
  fn emoji_sifir_ve_bos_metin() {
      assert_eq!(kisalt("🦀🦀🦀", 2), "🦀🦀…", "emoji 4 bayttır ama tek karakterdir");
      assert_eq!(kisalt("abc", 0), "…", "n = 0 ise yalnızca … kalır");
      assert_eq!(kisalt("", 3), "", "boş metin boş kalmalı");
  }
hints:
  - "Metni `metin.chars()` ile karakter karakter dolaş. Ders 1'deki `.enumerate()` sana her karakterin sıra numarasını da verir: `for (sira, c) in metin.chars().enumerate()`."
  - "Sıra numarası `n`'ye ulaştığında (yani `n` karakter zaten eklenmişken **hâlâ karakter geliyorsa**) sonuca `'…'` ekleyip hemen `return` et."
  - "İskelet: `let mut sonuc = String::new(); for (sira, c) in metin.chars().enumerate() { if sira == n { sonuc.push('…'); return sonuc; } sonuc.push(c); } sonuc`"
explanation: |
  Döngü karakterleri tek tek kopyalıyor ve `n` karakter eklendikten sonra **bir karakter daha
  gelirse** (sıra numarası 0'dan başladığı için bu, `n` numaralı karakterdir) üç noktayı ekleyip
  çıkıyor. Kontrolü karakteri eklemeden **önce** yaptığımız için tam `n` karakterlik metinler aynen
  kalıyor: döngü, kontrol hiç tetiklenmeden bitiyor. Sayacı elle tutmak (`let mut sayac = 0;` ve her
  turda `sayac += 1;`) da çalışır; ama `enumerate` aynı işi daha az hata riskiyle yapar ve Clippy de
  elle tutulan sayaç yerine onu önerir.

  `…` tek bir `char`'dır (U+2026, UTF-8'de 3 bayt); bu yüzden `push` ile ekleyebildik. Üç ayrı nokta
  (`"..."`) isteseydin `push_str` kullanırdın.

  Daha verimli bir alternatif: `char_indices()` her karakterin **bayt** konumunu da verir. `n`'inci
  karakterin bayt konumunu bulup tek seferde dilimleyebilirsin; bu konum her zaman bir karakter sınırı
  olduğu için panik riski yoktur:

  ```rust
  fn kisalt(metin: &str, n: usize) -> String {
      match metin.char_indices().nth(n) {
          // 0'dan sayınca n numaralı karakter varsa metin n'den uzundur: ondan öncesini al
          Some((konum, _)) => format!("{}…", &metin[..konum]),
          None => metin.to_string(), // en fazla n karakter: aynen döndür
      }
  }
  ```

  Bu sürüm karakterleri tek tek kopyalamaz; `n`'inci karakteri bulunca dilimi tek hamlede alır.
````

## Metin birleştirmek: `push`, `push_str`, `+` ve `format!`

Bir `String`'i büyütmenin dört yolu var. İlk ikisi basit:

- `s.push('!')`, sona tek bir **`char`** ekler.
- `s.push_str(" dünya")`, sona bir **`&str`** ekler. Argümanı ödünç aldığı için ona dokunmaz.

`+` operatörü ise bir sürpriz barındırıyor. Tahmin et:

```compiles
code: |
  fn main() {
      let s1 = String::from("Merhaba, ");
      let s2 = String::from("dünya");
      let s3 = s1 + &s2;
      println!("{s1} {s2} {s3}");
  }
answer: false
error: E0382
explanation: |
  `s1 + &s2` ifadesi `s1`'in **sahipliğini alır** (taşır); bu yüzden sonraki satırda `s1` kullanılamaz.
  `s2` ise yalnızca ödünç verildiği için hâlâ geçerlidir. Nedenini aşağıda imzadan okuyacağız.
```

`+` aslında bir metot çağrısıdır ve imzası kabaca şöyledir:

```rust,ignore
fn add(self, s: &str) -> String
```

Bu imza üç şey söyler:

1. `self`, sol taraftaki `String`'in **sahipliği alınır**, yani taşınır.
2. `s: &str`, sağ taraf yalnızca **ödünç** alınır; bu yüzden `&s2` yazarız.
3. Dönen `String`, aslında sol taraftaki `String`'in **ta kendisidir**: sağdakinin baytları sonuna
   eklenmiş hâliyle.

Neden böyle tasarlandı? **Verimlilik.** `s1`'in heap'teki tamponu yeniden kullanılır; kapasite
yetiyorsa hiç yeni bellek ayrılmaz. `s1`'i taşımak, "o tampon artık sonucun" demenin Rust'çasıdır.
(`&s2` bir `&String`'dir ama `add` bir `&str` ister; Rust burada `&String`'i otomatik olarak
`&str`'ye çevirir. Bu "deref zorlaması"nı Modül 17'de göreceğiz.)

`&` işaretini unutursan derleyici ne eksik olduğunu tam yerinde gösterir:

:::error
```text
error[E0308]: mismatched types
 --> src/main.rs:4:19
  |
4 |     let s3 = s1 + s2;
  |                   ^^ expected `&str`, found `String`
  |
help: consider borrowing here
  |
4 |     let s3 = s1 + &s2;
  |                   +
```
`+`'nın sağ tarafı bir `&str` olmalı: `String`'i ödünç ver (`&s2`), sahipliğini verme.
:::

Çok sayıda parçayı birleştirirken `+` hızla okunaksızlaşır: `s1 + "-" + &s2 + "-" + &s3`. Bu durumda
**`format!`** makrosu hem daha okunaklıdır hem de **hiçbir parçanın sahipliğini almaz**:

```rust
fn main() {
    let gun = String::from("Pazartesi");
    let ay = String::from("Ekim");
    let yil = 2026;

    // format!: okunaklı, hiçbir şeyi taşımaz, yeni bir String döndürür
    let tarih = format!("{gun}, 12 {ay} {yil}");
    println!("{tarih}");
    println!("{gun} ve {ay} hâlâ kullanılabilir");

    // Döngüde metin biriktirmek: push_str, push ve +=
    let mut liste = String::new();
    for meyve in ["elma", "armut", "kiraz"] {
        if !liste.is_empty() {
            liste.push_str(", ");
        }
        liste += meyve; // += de &str ister ve liste'yi yerinde büyütür
    }
    liste.push('.');
    println!("{liste}");

    // Bir dilimdeki tüm &str'leri araya ayraç koyarak birleştirmek
    let sehirler = ["Ankara", "İzmir", "Bursa"].join(" · ");
    println!("{sehirler}");
}
```

Hangisini ne zaman kullanmalı?

| Durum | Araç |
|---|---|
| Tek karakter ekle | `s.push(c)` |
| Var olan bir `String`'in sonuna metin ekle (döngüde biriktirme) | `s.push_str(x)` ya da `s += x` |
| Birkaç parçadan yeni metin üret | `format!` |
| `String`'i tüketip sonuna ekle (ör. bir fonksiyonun son satırında) | `s + x` |
| Bir listeyi ayraçla birleştir | `dilim.join(", ")` |

```fill
prompt: "Boşlukları doldurarak `Ad: Ayşe, Yaş: 30` yazdıran programı tamamla. `ad` en sonda hâlâ kullanılabilir olmalı."
code: |
  fn main() {
      let ad = String::from("Ayşe");
      let yas = 30;
      let mut kart = String::from("Ad: ");
      kart.___0(&ad);
      kart.push(___1);
      let kart = kart + " Yaş: ";
      let kart = ___2!("{kart}{yas}");
      println!("{kart}");
      println!("{ad} hâlâ burada");
  }
blanks:
  - ["push_str"]
  - ["','"]
  - ["format"]
output: |
  Ad: Ayşe, Yaş: 30
  Ayşe hâlâ burada
explanation: |
  `push_str(&ad)` metni ödünç alarak ekler; `ad`'ın sahipliği bizde kalır. `push` tek bir `char`
  ister: `','` (tek tırnak!). `kart + " Yaş: "` eski `kart`'ı tüketip yenisini döndürür; gölgeleme
  (shadowing) sayesinde aynı ismi kullanmaya devam ederiz. Son olarak `format!` sayıyı da metne
  dönüştürerek birleştirir; `+` ile bir sayıyı doğrudan ekleyemezdin.
```

## Metin işleme araç kutusu

Gerçek programlarda metinleri temizler, böler, arar ve dönüştürürsün. En sık kullanılan araçlar:

| Metot | Ne yapar? | Döndürdüğü |
|---|---|---|
| `trim()`, `trim_start()`, `trim_end()` | Baştaki/sondaki boşlukları (ve `\n`) atar | `&str` (kopya yok) |
| `split_whitespace()` | Bir veya daha fazla boşluğa göre kelimelere böler | kelimeler (döngüde gezilir) |
| `split(',')` | Verilen ayraca göre böler | parçalar |
| `lines()` | Satırlara böler | satırlar |
| `contains(x)`, `starts_with(x)`, `ends_with(x)` | Alt metin araması | `bool` |
| `find(x)` | İlk eşleşmenin **bayt** konumu | `Option<usize>` |
| `replace(eski, yeni)` | Tüm eşleşmeleri değiştirir | **yeni** `String` |
| `to_uppercase()`, `to_lowercase()` | Büyük / küçük harfe çevirir | **yeni** `String` |

Bir örüntüye dikkat: `&str` döndüren metotlar (ör. `trim`) orijinal baytlara bakan bir **dilim** verir,
yani bedavadır. `String` döndürenler (ör. `replace`) yeni bellek ayırır. `find`'ın bayt konumu
döndürdüğünü de unutma: `"çay".find('a')` sonucu `Some(1)` değil `Some(2)`'dir.

```rust
fn main() {
    let girdi = "   Merhaba   Rust dünyası!  \n";
    let temiz = girdi.trim();
    println!("[{temiz}]");

    let mut kelime_sayisi = 0;
    for kelime in temiz.split_whitespace() {
        kelime_sayisi += 1;
        println!("{kelime_sayisi}. kelime: {kelime}");
    }

    println!("'Rust' geçiyor mu? {}", temiz.contains("Rust"));
    println!("'!' ile bitiyor mu? {}", temiz.ends_with('!'));
    println!("{}", temiz.replace("dünyası", "topluluğu"));
    println!("'a' kaçıncı baytta? {:?}", "çay".find('a'));

    let csv = "Ankara,İzmir,Bursa";
    for sehir in csv.split(',') {
        println!("- {sehir}");
    }

    // char metotları: harf mi, rakam mı, boşluk mu?
    let parola = "Rust2024";
    let mut rakam = 0;
    for c in parola.chars() {
        // is_ascii_digit: yalnızca 0-9. (is_numeric ise '½', '٣' gibi her Unicode sayısını kabul eder.)
        if c.is_ascii_digit() {
            rakam += 1;
        }
    }
    println!("Parolada {rakam} rakam var");
}
```

Şimdi Türkçe için kritik bir soru. Tahmin et:

```predict
code: |
  fn main() {
      println!("{}", "istanbul".to_uppercase());
      println!("{}", "IŞIK".to_lowercase());
  }
options:
  - |
    İSTANBUL
    ışık
  - |
    ISTANBUL
    işik
  - |
    İSTANBUL
    işik
  - |
    ISTANBUL
    ışık
answer: 1
explanation: |
  Sürpriz! Rust'ın `to_uppercase` / `to_lowercase` metotları Unicode'un **dilden bağımsız** varsayılan
  kurallarını uygular: `i` → `I` ve `I` → `i`. Türkçedeki noktalı/noktasız ayrımını (`i` ↔ `İ`,
  `ı` ↔ `I`) bilmez; çünkü aynı `I` harfi İngilizcede `i`'ye, Türkçede `ı`'ya dönüşmelidir ve
  metnin hangi dilde olduğunu Rust bilemez. `Ş` → `ş` gibi diğer Türkçe harfler ise doğru çevrilir.
```

:::warning Türkçe ve büyük/küçük harf
Dilden bağımsız dönüşümün Türkçede üç tuzağı var:

- `"istanbul".to_uppercase()` → `"ISTANBUL"` (beklenen: `"İSTANBUL"`)
- `"IŞIK".to_lowercase()` → `"işik"` (beklenen: `"ışık"`)
- `"İ".to_lowercase()` → `"i̇"`: bir `i` artı birleşik bir nokta (U+0307); **2 `char`, 3 bayt!**

Ayrıca harf dönüşümü metnin **uzunluğunu değiştirebilir**: Almancadaki `"ß".to_uppercase()` sonucu
`"SS"`'dir. Bu yüzden "büyük harfe çevirince uzunluk aynı kalır" diye varsayma. Çok dilli gerçek
uygulamalarda dile duyarlı dönüşüm için `icu` ailesinden crate'ler kullanılır; basit durumlarda
`I` ve `İ` harflerini kendin ele alabilirsin. Şimdi tam olarak bunu yapacaksın.
:::

```exercise
id: m09-e-turkce-kucuk
title: Türkçeye duyarlı küçük harf
difficulty: 3
prompt: |
  Bir arama kutusu, kullanıcının yazdığını küçük harfe çevirip öyle arıyor. Ama `to_lowercase()`,
  `"IŞIK"`'ı `"ışık"` yerine `"işik"` yapıyor ve arama hiçbir sonuç bulamıyor!

  `turkce_kucuk` fonksiyonunu Türkçe kurallarla çalışacak şekilde yaz:

  - `I` (noktasız büyük) → `ı` (noktasız küçük)
  - `İ` (noktalı büyük) → `i` (noktalı küçük)
  - Diğer tüm karakterler → standart `to_lowercase()` kuralları (`Ç` → `ç`, `Ğ` → `ğ`; rakamlar ve
    noktalama aynı kalır)
starter: |
  fn turkce_kucuk(metin: &str) -> String {
      todo!()
  }

  fn main() {
      println!("{}", turkce_kucuk("IŞIK"));
      println!("{}", turkce_kucuk("İSTANBUL"));
  }
solution: |
  fn turkce_kucuk(metin: &str) -> String {
      let mut sonuc = String::with_capacity(metin.len());
      for c in metin.chars() {
          match c {
              'I' => sonuc.push('ı'),
              'İ' => sonuc.push('i'),
              _ => {
                  // char::to_lowercase bir ya da daha fazla char üretebilir
                  for kucuk in c.to_lowercase() {
                      sonuc.push(kucuk);
                  }
              }
          }
      }
      sonuc
  }

  fn main() {
      println!("{}", turkce_kucuk("IŞIK"));
      println!("{}", turkce_kucuk("İSTANBUL"));
  }
check: tests
tests: |
  #[test]
  fn noktasiz_buyuk_i() {
      assert_eq!(turkce_kucuk("IŞIK"), "ışık", "I harfi ı olmalı");
  }

  #[test]
  fn noktali_buyuk_i() {
      assert_eq!(turkce_kucuk("İSTANBUL"), "istanbul", "İ harfi i olmalı (fazladan nokta karakteri olmadan)");
  }

  #[test]
  fn karisik_metin() {
      assert_eq!(turkce_kucuk("Iğdır ve İzmir"), "ığdır ve izmir");
      assert_eq!(turkce_kucuk("ÇAĞRI ÖĞÜŞ"), "çağrı öğüş");
  }

  #[test]
  fn diger_karakterler_korunur() {
      assert_eq!(turkce_kucuk("RUST 2024!"), "rust 2024!", "rakam ve noktalama değişmemeli");
      assert_eq!(turkce_kucuk(""), "", "boş metin boş kalmalı");
  }
hints:
  - "Metni `chars()` ile dolaş ve her karakter için karar ver; sonucu yeni bir `String`'e `push` ile ekle."
  - "`match c { 'I' => ..., 'İ' => ..., _ => ... }` ile iki özel harfi ayır. Diğerleri için `c.to_lowercase()` kullan."
  - "`c.to_lowercase()` tek bir `char` değil, `for` ile dolaşılabilen bir karakter dizisi döndürür (bazı harfler birden çok karaktere dönüşür). Onu da `for kucuk in c.to_lowercase() { sonuc.push(kucuk); }` diye dolaş."
explanation: |
  İki özel harfi `match` ile ayırdık, gerisini standart kurallara bıraktık. `c.to_lowercase()`'in
  doğrudan tek bir `char` döndürmemesi bir tasarım hatası değil, **dürüstlüktür**: bazı karakterlerin
  küçük ya da büyük hâli birden fazla karakterdir (`'İ'` → `i` + U+0307). Rust bunu tipine yansıtıyor ve
  seni bu ihtimali ele almaya zorluyor.

  Kısa bir alternatif de var: `metin.replace('I', "ı").replace('İ', "i").to_lowercase()`. Önce sorunlu
  iki harfi değiştiriyoruz, sonra kalan her şeyi standart kurallara bırakıyoruz. Okunaklıdır ama üç ayrı
  `String` oluşturur. Döngülü çözüm ise metni **tek geçişte** işler ve `with_capacity` sayesinde
  yeniden tahsisi de en aza indirir.

  İnce bir fark: `str::to_lowercase` (metnin tamamı üzerinde) Unicode'un bağlama duyarlı tek kuralını,
  Yunancadaki kelime sonu sigmasını (`Σ` → `ς`) da uygular; karakter karakter çalışan
  `char::to_lowercase` ise bağlamı göremez ve her `Σ`'yı `σ` yapar. Türkçe metinler için fark etmez.

  Son bir ayrıntı: Türkçe kurallar Türkçe olmayan metinlerde yanlış sonuç verir (İngilizce `"INFO"`,
  `"ınfo"` olur!). Gerçek uygulamalarda hangi dönüşümün uygulanacağına metnin **diline** göre karar verilir.
```

## Özet

:::remember
- `String` sahip olunan, büyüyebilen bir UTF-8 bayt dizisidir; `&str` başka birinin baytlarına bakan bir dilimdir.
  Parametre olarak `&str` al, yeni metin üretiyorsan `String` döndür.
- UTF-8'de bir karakter 1-4 bayttır: ASCII 1, Türkçe harfler (`ç ğ ı İ ö ş ü`) 2, `€` 3, emoji 4 bayt.
- `len()` **bayt** sayar; karakter sayısı için `chars().count()` (O(n)). Grafem kümelerini std saymaz.
- `s[0]` derlenmez (**E0277**): bayt/karakter belirsizliği ve O(1) sözü. `chars()`, `bytes()`, `get(a..b)` kullan.
- Bayt aralığıyla dilim (`&s[a..b]`) derlenir ama karakter sınırına denk gelmezse **panikler**.
- `+` sol tarafı **taşır**, sağ tarafı `&str` olarak ödünç alır. Çok parça için `format!` (hiçbir şeyi taşımaz).
- `to_uppercase`/`to_lowercase` dilden bağımsızdır: Türkçe `I`/`İ` için özel işlem gerekir.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Rust neden `s[i]` ile karakter erişimine izin vermiyor? Python'un ya da
  JavaScript'in yaklaşımıyla karşılaştır: hangisinin hangi bedeli var?
answer: |
  Model cevap: Rust'ta bir `String`, UTF-8 baytlarından oluşur ve karakterler 1-4 bayt arası yer kaplar.
  `s[i]` bir bayt döndürseydi yarım bir harf alabilirdim; bir karakter döndürseydi `i`'inci karakteri
  bulmak için baştan saymak gerekirdi (O(n)) ve indekslemenin ucuz olduğu beklentisi bozulurdu. Üstelik
  "karakter" bile belirsiz: `char` mı, grafem mi? Rust bu yüzden seçimi bana bırakıyor: `bytes()`,
  `chars()` ya da bayt aralığıyla güvenli dilim. Python `s[0]`'ı sabit sürede verir ama bunun bedelini
  bellekte öder (metni gerekirse karakter başına 4 bayta genişletir) ve grafem sorununu yine çözmez.
  JavaScript UTF-16 kullanır: `"🦀".length` 2'dir ve `s[0]` bir emojinin yarısını verebilir; hata
  sessizce oluşur.
```

```flashcards
- front: "`\"şeker\".len()` kaç döndürür ve neden?"
  back: "**6**. `len()` bayt sayar; `ş` UTF-8'de 2 bayt, diğer harfler 1'er bayt."
- front: Bir metnin karakter sayısını nasıl bulursun, maliyeti nedir?
  back: "`s.chars().count()`, metni baştan sona yürüdüğü için O(n)."
- front: "`s[0]` neden derlenmez? (iki gerekçe)"
  back: "Bir bayt yarım harf olabilir (bayt mı karakter mi belirsiz) ve n'inci karakter O(1)'de bulunamaz → **E0277**."
- front: "`&s[0..1]` (`s = \"şeker\"`) derlenir mi, çalışır mı?"
  back: "Derlenir ama **panikler**: 1. bayt bir karakter sınırı değil. Güvenli yol: `s.get(0..1)` → `None`."
- front: "`let s3 = s1 + &s2;` satırından sonra `s1` ve `s2` kullanılabilir mi?"
  back: "`s1` hayır: `add(self, &str)` onu taşıdı (tamponu yeniden kullanıldı). `s2` evet: sadece ödünç verildi."
- front: Birkaç parçayı sahiplik almadan, okunaklı biçimde birleştirmenin yolu nedir?
  back: "`format!(\"{a} {b}\")` - hiçbir argümanı taşımaz, yeni bir `String` döndürür."
- front: "`\"IŞIK\".to_lowercase()` ne döndürür?"
  back: "`\"işik\"`. Rust dilden bağımsız Unicode kurallarını uygular (`I` → `i`); Türkçe `I` → `ı` kuralını bilmez."
- front: "🇹🇷 bayrağı kaç `char` ve kaç bayttır? Grafem kümesi nedir?"
  back: "2 `char`, 8 bayt. Grafem kümesi, insanın tek karakter olarak algıladığı birimdir; standart kütüphane onu saymaz."
```
