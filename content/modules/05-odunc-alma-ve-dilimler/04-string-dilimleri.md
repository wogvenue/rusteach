---
id: m05-l04
title: String dilimleri — &str
minutes: 18
type: lesson
objectives:
  - "`&s[a..b]` ve aralık kısayollarıyla bir `String`'in bir parçasına dilim (slice) oluşturabilmek"
  - Bir dilimin bellekte bir işaretçi ile bir uzunluktan oluştuğunu diyagramla açıklayabilmek
  - "Parametrelerde `&String` yerine `&str` tercih etmenin nedenini açıklayabilmek"
  - UTF-8 karakter sınırlarını gözeterek Türkçe metinleri paniğe yol açmadan dilimleyebilmek
keywords: [dilim, slice, "&str", aralık, range, UTF-8, karakter sınırı, ilk_kelime]
---

Bir kitaptan bir paragrafı arkadaşına göstermek istiyorsun. Bütün kitabın fotokopisini çekmezsin;
kitabı açıp "şu satırdan şu satıra kadar oku" dersin. Rust'ta bir koleksiyonun **bir parçasını**
kopyalamadan gösteren referanslara **dilim (slice)** denir.

Bu derste metin dilimlerini, yani her Rust programında karşına çıkacak `&str` tipini öğreneceksin.
Göreceksin ki string literalleri baştan beri birer dilimmiş. Bir sonraki derste aynı fikri dizilere
ve vektörlere uygulayacağız.

## Sorun: kopuk bir indeks

Görev: bir cümlenin **ilk kelimesini** bulan bir fonksiyon yaz. Henüz dilimleri bilmediğimizi
varsayalım; en iyi yapabileceğimiz şey, ilk kelimenin **bittiği yerin indeksini** döndürmek olurdu.
Bunun için üç yeni araç kullanacağız:

- `s.as_bytes()` metnin baytlarını verir. (Tipi `&[u8]`, yani o da bir dilim! Bir sonraki derste.)
- `.iter().enumerate()` her elemanı indeksiyle birlikte `(i, b)` çifti olarak verir. Burada `b` bir
  referanstır (`&u8`), bu yüzden karşılaştırmak için `*b` yazarız. Ayrıntısı Modül 9 ve 14'te.
- `b' '` boşluk karakterinin bayt değeridir (Modül 2'deki bayt literalleri). `s.clear()` ise
  `String`'in içini boşaltır.

Şimdi tahmin et:

```predict
code: |
  fn ilk_kelime_sonu(s: &String) -> usize {
      let baytlar = s.as_bytes();
      for (i, b) in baytlar.iter().enumerate() {
          if *b == b' ' {
              return i;
          }
      }
      s.len()
  }

  fn main() {
      let mut s = String::from("merhaba dünya");
      let son = ilk_kelime_sonu(&s);
      println!("İlk kelime {son}. bayta kadar");
      s.clear();
      println!("son = {son}, s = '{s}'");
  }
options:
  - |
    İlk kelime 7. bayta kadar
    son = 7, s = ''
  - |
    İlk kelime 7. bayta kadar
    son = 0, s = ''
  - "Derlenmez: s ödünç verilmişken temizlenemez"
answer: 0
explanation: |
  Kod derlenir ve `son = 7` yazar. `son` sadece bir sayı (`usize`); `s` ile hiçbir bağı yok.
  `ilk_kelime_sonu` çağrısı bitince ödünç de bitti. `s.clear()` metni boşaltsa da `son` hâlâ 7.
  Ama bu 7 **artık anlamsız**: boş bir metnin 7. baytı yok! Daha sonra `son`'u bu metinle
  kullanmaya kalkan kod çalışma zamanında patlar. Üstelik derleyici bizi uyaramaz.
```

İndeks ile verinin bağı kopuk. Verinin değiştiğini indekse haber veren kimse yok. İhtiyacımız olan
şey, **verinin bir parçasına bağlı kalan** ve veri değişirse derleyicinin bunu fark edeceği bir
referans. İşte dilim tam olarak budur.

## Dilim: bir parçaya referans

Bir `String`'in bir parçasına dilim almak için köşeli parantez içinde bir **aralık (range)** verirsin:

```rust
fn main() {
    let s = String::from("merhaba dünya");
    let merhaba = &s[0..7]; // 0. bayttan 7. bayta (7 hariç)
    let dunya = &s[8..14]; // 8. bayttan 14. bayta (14 hariç)
    println!("{merhaba} | {dunya}");
}
```

`&s[0..7]` ifadesinin tipi **`&str`**'dir: bir **string dilimi**. Dikkat: "dünya" 5 harftir ama
6 bayt tutar (`ü` 2 bayttır), bu yüzden aralığı 8..14.

Bellekte bir dilim yeni bir metin **oluşturmaz**. Sadece mevcut verinin içini gösterir:

```memory
title: "Dilimler s'nin heap verisinin içini gösterir"
steps:
  - caption: "`s` heap'te 14 baytlık bir metne sahip."
    stack:
      - frame: main
        vars:
          - { name: s, type: String, value: "ptr · len=14 · cap=14", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a ␣ d ü n y a" }
  - caption: "Her dilim iki parçadan oluşur: **başlangıç adresi** ve **uzunluk**. Kopya yok, sahiplik yok."
    stack:
      - frame: main
        vars:
          - { name: s, type: String, value: "ptr · len=14 · cap=14", to: h1 }
          - { name: merhaba, type: "&str", value: "ptr (+0) · len=7", to: h1 }
          - { name: dunya, type: "&str", value: "ptr (+8) · len=6", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a ␣ d ü n y a" }
```

Bir `&String` tek bir adresten oluşurken, bir `&str` **adres + uzunluk** çiftidir. Bu tür iki parçalı
referanslara **geniş işaretçi (fat pointer)** denir.

:::analogy Fosforlu kalem
Kitaptaki önemli bir cümleyi fosforlu kalemle işaretlediğinde cümleyi kopyalamazsın; cümle kitapta
durduğu yerde kalır. İşaret aslında iki bilgidir: "şu sayfadaki şu harften başla" ve "şu kadar harf
oku". Dilim de budur: başlangıç adresi + uzunluk. Kitap (`String`) ise hâlâ sahibinin.
:::

Aralıkların yazımı Modül 3'teki `for` döngülerinden tanıdık. Başı ya da sonu atlayarak kısaltabilirsin:

| Yazım | Anlamı | `"Ankara"` için sonuç |
|---|---|---|
| `&s[1..4]` | 1'den 4'e (4 hariç) | `"nka"` |
| `&s[1..=3]` | 1'den 3'e (3 **dahil**) | `"nka"` |
| `&s[..3]` | baştan 3'e (3 hariç) | `"Ank"` |
| `&s[3..]` | 3'ten sona kadar | `"ara"` |
| `&s[..]` | tamamı | `"Ankara"` |

```predict
code: |
  fn main() {
      let s = String::from("Karadeniz");
      println!("{}", &s[..4]);
      println!("{}", &s[4..]);
      println!("{}", &s[2..=5]);
  }
options:
  - |
    Kara
    deniz
    rade
  - |
    Kara
    deniz
    rad
  - |
    Karad
    eniz
    rade
answer: 0
explanation: |
  İndeksler: K0 a1 r2 a3 d4 e5 n6 i7 z8. `[..4]` 0, 1, 2, 3 → "Kara". `[4..]` 4'ten sona →
  "deniz". `[2..=5]` 2'den 5'e, 5 **dahil** → "rade". `..` üst sınırı hariç tutar, `..=` dahil eder.
  Aralıklarda en sık yapılan hata bu "bir eksik, bir fazla" (off-by-one) karışıklığıdır.
```

:::deep Geniş işaretçiyi kendi gözünle gör
`std::mem::size_of` bir tipin bellekte kaç bayt tuttuğunu söyler (Modül 24'te ayrıntılı):

```rust
fn main() {
    println!("&String: {} bayt", std::mem::size_of::<&String>());
    println!("&str   : {} bayt", std::mem::size_of::<&str>());
}
```

64 bitlik bir bilgisayarda çıktı `8` ve `16` olur. `&String` sadece bir adres; `&str` ise adres ve
uzunluk, iki tane 8 baytlık sayı.
:::

## `ilk_kelime` dilimle ve derleyicinin koruması

Şimdi `ilk_kelime` fonksiyonunu, indeks yerine kelimenin kendisini (bir dilimi) döndürecek şekilde
yazalım:

```rust
fn ilk_kelime(s: &String) -> &str {
    let baytlar = s.as_bytes();
    for (i, b) in baytlar.iter().enumerate() {
        if *b == b' ' {
            return &s[..i]; // boşluğa kadar olan kısım
        }
    }
    &s[..] // boşluk yoksa metnin tamamı tek kelimedir
}

fn main() {
    let s = String::from("merhaba dünya");
    let kelime = ilk_kelime(&s);
    println!("İlk kelime: {kelime}");
}
```

Ders 3'teki üçüncü stratejiyi hatırla: **referansı parametreden türet**. `ilk_kelime` yerel bir değere
değil, çağıranın verdiği `s`'nin içine referans döndürüyor; bu yüzden sarkma yok. İmza da bunu söylüyor:
"Döndürdüğüm `&str`, aldığım `&String`'den ödünç alınmıştır." (Bu kuralın adı elision; Modül 12'de.)

Peki ilk bölümdeki hileyi tekrar denersek? Tahmin et:

```compiles
code: |
  fn ilk_kelime(s: &String) -> &str {
      let baytlar = s.as_bytes();
      for (i, b) in baytlar.iter().enumerate() {
          if *b == b' ' {
              return &s[..i];
          }
      }
      &s[..]
  }

  fn main() {
      let mut s = String::from("merhaba dünya");
      let kelime = ilk_kelime(&s);
      s.clear();
      println!("İlk kelime: {kelime}");
  }
answer: false
error: E0502
explanation: |
  `kelime`, `s`'nin içini gösteren bir dilim; yani `s` üzerinde **canlı bir `&` ödüncü**. `s.clear()`
  ise `s`'yi değiştirmek için `&mut` ister. Ders 2'deki altın kural devreye girer:
  `cannot borrow s as mutable because it is also borrowed as immutable`.
```

İndeks versiyonunda **çalışma zamanında** sessizce saklanan hata, dilim versiyonunda **derleme
zamanında** yakalandı. Hiçbir ek kontrol yazmadık; sadece doğru tipi kullandık.

Başka dillerle karşılaştır: Python'da `kelime = s[:7]` yeni bir metin **kopyalar**. Güvenlidir ama
her dilimin bir bedeli vardır. C'de bir `char*` ile metnin içini göstermek bedavadır, ama metin
değişirse ya da serbest bırakılırsa işaretçi sessizce sarkar. Rust'ın dilimi ikisinin iyi yanlarını
birleştirir: **kopya yok, sarkma yok**.

## String literalleri ve `&str` parametreleri

Modül 4'te string literallerinin tipinin `&str` olduğunu görmüştün ama bunun tam olarak ne anlama
geldiğini erteledik. Artık bu sırrı açıklayabiliriz:

```rust,ignore
let selam = "merhaba dünya"; // tipi: &str
```

Bir literal, programın **ikili dosyasına gömülü** metni gösteren bir dilimdir. Tam tipi
`&'static str`'dir (Ders 3). Değişmez bir dilim olduğu için `selam.push_str(...)` gibi bir şey
yapamazsın; `&str` üzerinde `push_str` metodu hiç yoktur.

Bu bilgi, fonksiyon imzalarında önemli bir alışkanlık kazandırır: **sadece okuyacaksan `&String`
yerine `&str` al.** `&str` parametresi hem `String`'lerle, hem literallerle, hem de başka dilimlerle
çalışır:

```rust
fn ilk_kelime(s: &str) -> &str {
    let baytlar = s.as_bytes();
    for (i, b) in baytlar.iter().enumerate() {
        if *b == b' ' {
            return &s[..i];
        }
    }
    &s[..]
}

fn main() {
    let cumle = String::from("Rust güvenli ve hızlı");
    let a = ilk_kelime(&cumle); // &String otomatik olarak &str'ye dönüşür
    let b = ilk_kelime(&cumle[5..]); // bir dilimin dilimi: "güvenli ve hızlı"
    let c = ilk_kelime("merhaba dünya"); // literal zaten &str
    println!("{a} | {b} | {c}");
}
```

`&cumle` bir `&String`'dir, ama `&str` beklenen yere verildiğinde derleyici onu **otomatik olarak**
`&str`'ye dönüştürür. Bu dönüşümün adı **deref zorlaması (deref coercion)**; nasıl çalıştığını
Modül 17'de göreceksin. Tersi ise çalışmaz: `&String` bekleyen bir fonksiyona literal veremezsin,
çünkü literal bir `String` değildir. Yani `&str` her durumda **daha esnektir**.

Bir `String`'den açıkça `&str` almak istersen üç yol var: `&s[..]`, `s.as_str()` ya da `&str`
beklenen bir yerde sadece `&s`.

Peki `&` koymayı unutursan? Tahmin et:

```compiles
code: |
  fn selamla(isim: &str) -> String {
      format!("Merhaba, {isim}!")
  }

  fn main() {
      let ad = String::from("Elif");
      println!("{}", selamla(ad));
  }
answer: false
error: E0308
explanation: |
  Modül 2'deki tanıdık hata: `mismatched types`, yani `expected &str, found String`. Fonksiyon bir
  **referans** bekliyor, sen ise `String`'in kendisini (sahipliği) veriyorsun. Otomatik dönüşüm
  `&String` → `&str` içindir; `String` → `&str` diye bir dönüşüm yoktur. Derleyicinin önerisi:
  `consider borrowing here: &ad`.
```

```fill
prompt: "`selamla` hem `String`'lerle hem literallerle çalışsın. Boşlukları doldur."
code: |
  fn selamla(isim: ___0) -> String {
      format!("Merhaba, {isim}!")
  }

  fn main() {
      let ad = String::from("Elif");
      println!("{}", selamla(___1));
      println!("{}", selamla("Can"));
  }
blanks:
  - ["&str"]
  - ["&ad", "&ad[..]", "ad.as_str()"]
output: |
  Merhaba, Elif!
  Merhaba, Can!
explanation: |
  Parametre `&str` olmalı ki `"Can"` literali de kabul edilsin; `&String` olsaydı ikinci çağrı
  derlenmezdi. `String` için `&ad` yazmak yeter, derleyici `&String`'i `&str`'ye kendisi çevirir.
  (`&ad[..]` ve `ad.as_str()` de aynı işi açıkça yapar.)
```

Şimdi `&str` ile ilk alıştırmanı yaz.

```exercise
title: Dosya uzantısını bul
difficulty: 2
prompt: |
  Bir dosya yöneticisi yazıyorsun. `uzanti` fonksiyonu bir dosya adının **son noktasından sonraki**
  kısmını, yeni bir metin oluşturmadan, bir **dilim** olarak döndürmeli:

  - `"rapor.pdf"` → `"pdf"`
  - `"yedek.tar.gz"` → `"gz"` (son nokta önemli)
  - `"README"` → `""` (nokta yoksa boş dilim)
starter: |
  fn uzanti(dosya: &str) -> &str {
      todo!()
  }

  fn main() {
      println!("{}", uzanti("rapor.pdf"));
      println!("{}", uzanti("yedek.tar.gz"));
      println!("[{}]", uzanti("README"));
  }
solution: |
  fn uzanti(dosya: &str) -> &str {
      let baytlar = dosya.as_bytes();
      for i in (0..baytlar.len()).rev() {
          if baytlar[i] == b'.' {
              return &dosya[i + 1..];
          }
      }
      ""
  }

  fn main() {
      println!("{}", uzanti("rapor.pdf"));
      println!("{}", uzanti("yedek.tar.gz"));
      println!("[{}]", uzanti("README"));
  }
check: tests
tests: |
  #[test]
  fn basit_uzantilar() {
      assert_eq!(uzanti("rapor.pdf"), "pdf", "\"rapor.pdf\" dosyasının uzantısı \"pdf\"");
      assert_eq!(uzanti("odev.rs"), "rs", "\"odev.rs\" dosyasının uzantısı \"rs\"");
  }

  #[test]
  fn son_noktadan_sonrasini_alir() {
      assert_eq!(uzanti("yedek.tar.gz"), "gz", "birden çok nokta varsa SON noktadan sonrası alınmalı");
  }

  #[test]
  fn turkce_dosya_adlari() {
      assert_eq!(uzanti("fotoğraf.jpeg"), "jpeg", "Türkçe harfli adlarda da noktadan sonrası alınmalı");
      assert_eq!(uzanti("şarkı.mp3"), "mp3", "Türkçe harfli adlarda da noktadan sonrası alınmalı");
  }

  #[test]
  fn nokta_yoksa_bos_dilim() {
      assert_eq!(uzanti("README"), "", "nokta yoksa uzantı da yoktur");
      assert_eq!(uzanti(""), "", "boş dosya adının uzantısı boştur");
  }

  #[test]
  fn uc_durumlar_ve_string_ile_kullanim() {
      assert_eq!(uzanti("notlar."), "", "sondaki noktadan sonra hiçbir şey yok");
      assert_eq!(uzanti(".gitignore"), "gitignore", "baştaki noktadan sonrası uzantı sayılır");
      let ad = String::from("tez.docx");
      assert_eq!(uzanti(&ad), "docx", "&String de &str yerine verilebilmeli");
  }
hints:
  - "Son noktayı bulmak için baytları **sondan başa** gez: `for i in (0..baytlar.len()).rev()` (Modül 3'teki `.rev()`)."
  - "`baytlar[i] == b'.'` ise noktadan sonraki kısmı döndür: `return &dosya[i + 1..];`"
  - "Döngü hiç nokta bulamadan biterse boş bir dilim döndür: `\"\"`."
explanation: |
  Fonksiyon hiçbir yeni metin oluşturmuyor; döndürdüğü şey `dosya`'nın içini gösteren bir dilim.
  Bu yüzden hem hızlı hem de bellek dostu.

  Neden `&dosya[i + 1..]` Türkçe dosya adlarında bile paniğe yol açmaz? UTF-8'in zekice bir
  özelliği sayesinde: Çok baytlı karakterlerin (ğ, ş...) baytları her zaman 128 ve üstüdür. `'.'`
  gibi ASCII karakterler ise 128'den küçüktür. Yani `b'.'` baytı hiçbir zaman bir harfin ortasında
  bulunamaz ve hemen ardı **her zaman** bir karakter sınırıdır.

  Boş dilim için `""` döndürmek de güvenli: Literal program boyunca yaşar, ödünç aldığımız `dosya`'dan
  daha uzun. İleride aynı işi tek satırda yapan `dosya.rsplit_once('.')` gibi metotları göreceksin;
  onlar `Option` döndürür (Modül 7).
```

## UTF-8 ve karakter sınırları: 'ş'nin ortasından kesme!

Türkçe metinlerle çalışırken bilmen gereken çok önemli bir tuzak var. Tahmin et, bu kod **derlenir mi**?

```compiles
code: |
  fn main() {
      let s = String::from("şeker");
      let ilk = &s[0..1];
      println!("{ilk}");
  }
answer: true
explanation: |
  Derlenir! Derleyici açısından her şey yolunda: `s` bir `String`, `0..1` geçerli bir aralık. Ama
  program **çalıştırıldığında panik verir**. Nedeni aşağıda. Dilim indeksleri çalışma zamanında
  kontrol edilir, tıpkı dizilerdeki taşma (out of bounds) kontrolü gibi.
```

```rust,should_panic
fn main() {
    let s = String::from("şeker");
    let ilk = &s[0..1];
    println!("{ilk}");
}
```

:::error Panik mesajı
```text
thread 'main' (13) panicked at src/main.rs:3:17:
end byte index 1 is not a char boundary; it is inside 'ş' (bytes 0..2 of string)
```
"Bitiş bayt indeksi 1 bir karakter sınırı değil; `'ş'`nin içinde kalıyor (dizinin 0..2 baytları)."
Panik, 3. satırdaki dilimleme ifadesini gösteriyor. (Parantezdeki sayı iş parçacığının kimliğidir ve
çalıştırmadan çalıştırmaya değişebilir.)
:::

Rust'ta `String` ve `&str` her zaman geçerli **UTF-8** metindir. UTF-8'de her karakter aynı sayıda bayt
tutmaz:

| Karakterler | Bayt sayısı |
|---|---|
| İngilizce harfler, rakamlar, `.` `,` boşluk (ASCII) | 1 |
| Türkçe harfler: `ç ğ ı ö ş ü`, `Ç Ğ İ Ö Ş Ü` | 2 |
| `€`, `₺` | 3 |
| Emojiler: `🦀` | 4 |

Dilim indeksleri ise **bayt** indeksidir. `"şeker"` bellekte şöyle durur:

```text
karakter:     ş          e     k     e     r
bayt:       [C5]  [9F]  [65]  [6B]  [65]  [72]
indeks:      0     1     2     3     4     5
```

`&s[0..1]` alınabilseydi elimizde `ş`'nin **yarısı** olurdu, yani geçersiz bir UTF-8 dizisi. Rust bu
geçersiz metnin oluşmasına izin vermek yerine panik verir. Aynı şekilde `&s[0..100]` gibi metnin
dışına taşan bir aralık da panik verir (`out of bounds`).

Bir indeksin güvenli olup olmadığını `is_char_boundary` ile sorabilirsin:

```rust
fn main() {
    let s = String::from("çay");
    println!("uzunluk: {} bayt", s.len());
    for i in 0..=s.len() {
        println!("{i}: {}", s.is_char_boundary(i));
    }
    println!("{}", &s[0..2]); // "ç": 2 baytlık tam bir karakter
}
```

```quiz
question: "`let s = String::from(\"çay\");` için `s.len()` kaçtır ve `&s[0..2]` ne verir?"
options:
  - "`3` ve `\"ça\"`"
  - "`4` ve `\"ç\"`"
  - "`3` ve panik"
  - "`4` ve `\"ça\"`"
answer: 1
explanation: |
  `len()` **bayt** sayar: `ç` 2 bayt + `a` 1 + `y` 1 = 4. Aralık da bayt aralığıdır: `0..2` tam olarak
  `ç`'nin iki baytını kapsar ve `"ç"` verir. `"ça"` için `&s[0..3]` gerekirdi.
feedback:
  - "`len()` karakter değil bayt sayar; `ç` 2 bayttır."
  - "Doğru! Bayt sayısı ile karakter sayısı Türkçe metinlerde farklıdır."
  - "`0..2` aralığı `ç`'nin sınırlarına tam oturur; panik olmaz."
  - "`0..2` sadece 2 bayt, yani sadece `ç`."
```

:::tip Panik yerine sonuç
Tam olarak bilmediğin bir indeksle dilim alman gerekiyorsa `s.get(0..1)` panik vermek yerine "yok"
anlamına gelen bir sonuç döndürür. Bu sonuç bir `Option`'dır; Modül 7'de öğreneceksin. Bir de
`s[0]` gibi **tek bir** indeksle metne erişim Rust'ta hiç derlenmez. Nedenini Modül 9'da
metinleri derinlemesine incelerken göreceğiz.
:::

Şimdi bu bilgiyi gerçek bir probleme uygula.

```exercise
title: Bayt sınırıyla güvenli kesme
difficulty: 3
prompt: |
  Bir SMS servisi mesajları en fazla belirli sayıda **bayt** ile kabul ediyor. Mesajı sınıra göre
  kesmen gerekiyor, ama bir harfi **asla ortasından bölmemelisin** (yoksa program panik verir).

  `guvenli_kes(metin, sinir)` fonksiyonunu yaz. Fonksiyon, `metin`'in en fazla `sinir` bayt
  uzunluğundaki en uzun başlangıç parçasını bir dilim olarak döndürmeli:

  - `guvenli_kes("merhaba", 3)` → `"mer"`
  - `guvenli_kes("şeker", 1)` → `""` (`ş` 2 bayt, 1 bayta sığmaz)
  - `guvenli_kes("şeker", 3)` → `"şe"`
  - `guvenli_kes("çay", 100)` → `"çay"` (sınır metinden uzunsa tamamı)
starter: |
  fn guvenli_kes(metin: &str, sinir: usize) -> &str {
      todo!()
  }

  fn main() {
      let mesaj = "Rust'ı öğrenmek çok keyifli!";
      println!("[{}]", guvenli_kes(mesaj, 10));
  }
solution: |
  fn guvenli_kes(metin: &str, sinir: usize) -> &str {
      let mut i = sinir.min(metin.len());
      while !metin.is_char_boundary(i) {
          i -= 1;
      }
      &metin[..i]
  }

  fn main() {
      let mesaj = "Rust'ı öğrenmek çok keyifli!";
      println!("[{}]", guvenli_kes(mesaj, 10));
  }
check: tests
tests: |
  #[test]
  fn ascii_metin_tam_sinirdan_kesilir() {
      assert_eq!(guvenli_kes("merhaba", 3), "mer", "ASCII metinde her harf 1 bayttır");
      assert_eq!(guvenli_kes("merhaba", 7), "merhaba", "sınır metin uzunluğuna eşitse metnin tamamı");
  }

  #[test]
  fn sinir_metinden_buyukse_tamami_doner() {
      assert_eq!(guvenli_kes("çay", 100), "çay", "sınır uzunluktan büyükse dilim almaya çalışırken panik olmamalı");
      assert_eq!(guvenli_kes("", 5), "", "boş metin boş kalır");
  }

  #[test]
  fn harfin_ortasindan_kesmez() {
      assert_eq!(guvenli_kes("şeker", 1), "", "'ş' 2 bayttır; 1 bayta sığmaz");
      assert_eq!(guvenli_kes("şeker", 2), "ş", "2 bayta tam olarak 'ş' sığar");
      assert_eq!(guvenli_kes("şeker", 3), "şe", "3 bayta 'ş' (2) ve 'e' (1) sığar");
  }

  #[test]
  fn ardisik_turkce_harfler() {
      assert_eq!(guvenli_kes("çiçek", 4), "çi", "4. bayt ikinci 'ç'nin ortasında; 3'e geri dönülmeli");
      assert_eq!(guvenli_kes("ğüş", 5), "ğü", "5. bayt 'ş'nin ortasında; 4'e geri dönülmeli");
  }

  #[test]
  fn dort_baytlik_emojiyi_bolmez() {
      assert_eq!(guvenli_kes("a🦀b", 4), "a", "🦀 4 bayttır (1..5); 4'ten 1'e kadar geri gidilmeli");
      assert_eq!(guvenli_kes("a🦀b", 5), "a🦀", "5 bayta 'a' ve 🦀 tam sığar");
  }

  #[test]
  fn sifir_sinir_bos_dilim_verir() {
      assert_eq!(guvenli_kes("abc", 0), "", "0 baytlık sınırda boş dilim dönmeli");
  }
hints:
  - "Önce sınırı metnin uzunluğuna indir. Modül 2'deki `min` bunu tek adımda yapar: `let mut i = sinir.min(metin.len());`"
  - "`metin.is_char_boundary(i)` false olduğu sürece `i`'yi bir azalt (`while` döngüsü). 0 her zaman bir sınır olduğundan döngü mutlaka biter."
  - "Son olarak `&metin[..i]` döndür."
explanation: |
  Algoritma iki adımlı: Önce sınırı metnin içine çek (yoksa `&metin[..100]` "out of bounds" paniği
  verirdi), sonra bir karakter sınırına rastlayana kadar geri yürü. UTF-8'de bir karakter en fazla 4
  bayt olduğu için döngü en fazla 3 adım geri gider.

  Bu gerçek dünyada çok karşılaşılan bir problem: SMS ve bildirim sınırları, veritabanı sütunlarının
  bayt limitleri, ağ protokollerindeki başlık boyutları. Bu sınırları karakterle değil baytla ölçen
  sistemlerde, Türkçe metni bayt sayısına göre körlemesine kesen kod ilk `ş`'de çöker.

  Güncel kararlı Rust'ta aynı işi yapan hazır bir metot da var: `metin.floor_char_boundary(sinir)`
  sınıra eşit ya da ondan küçük en yakın karakter sınırını verir (sınır metinden uzunsa `metin.len()`).
  Yani bütün fonksiyon `&metin[..metin.floor_char_boundary(sinir)]` olarak da yazılabilir. Algoritmayı
  bir kez kendin yazman, bu metodun neden var olduğunu anlamanı sağlar.
```

## Özet ve tekrar

:::remember
- `&s[a..b]`: `s`'nin a. baytından b. baytına (b hariç) bir **dilim**. Kısayollar: `[..b]`, `[a..]`, `[..]`, `[a..=b]`.
- `&str` = **adres + uzunluk** (geniş işaretçi). Kopya yapmaz, sahiplik almaz.
- Dilim canlıyken kaynağı değiştirilemez (ör. `s.clear()` → E0502). Kopuk indeks hataları derleme hatasına dönüşür.
- String literalleri `&'static str`'dir. Sadece okuyacaksan parametre olarak **`&str`** al; `&String` otomatik olarak `&str`'ye dönüşür.
- Dilim indeksleri **bayt** indeksidir. Türkçe harfler 2 bayttır; bir harfin ortasından dilim almak **panik** verir. `is_char_boundary` ile kontrol et.
:::

```reflect
prompt: |
  `ilk_kelime` fonksiyonunun indeks (`usize`) döndüren versiyonu ile dilim (`&str`) döndüren
  versiyonunu karşılaştır. Dilim versiyonu hangi hatayı, nasıl ve ne zaman yakalıyor?
answer: |
  Model cevap: İndeks versiyonu sadece bir sayı döndürür; sayının metinle bir bağı yoktur. Metin
  değişse ya da boşaltılsa bile indeks aynı kalır ve anlamsızlaşır. Bu hata ancak çalışma zamanında,
  belki de çok sonra ortaya çıkar. Dilim versiyonu ise metnin içini gösteren bir referanstır, yani
  metin üzerinde canlı bir ödünçtür. Dilim kullanılmaya devam ederken metni değiştirmeye çalışmak
  (`s.clear()`) `&mut` gerektirdiği için ödünç kuralını çiğner ve derleyici bunu **derleme zamanında**
  E0502 ile reddeder.
```

```flashcards
- front: "`&s[2..5]` hangi baytları içerir?"
  back: "2, 3 ve 4. baytları (üst sınır **hariç**). 5'i dahil etmek için `&s[2..=5]`."
- front: "`&str` bellekte hangi iki parçadan oluşur?"
  back: "Başlangıç **adresi** ve **uzunluk** (geniş işaretçi, 64 bitte 16 bayt)."
- front: "`\"merhaba\"` gibi bir string literalinin tam tipi nedir?"
  back: "`&'static str`: ikili dosyaya gömülü metni gösteren, program boyunca geçerli bir dilim."
- front: Sadece okuyacağın bir metin parametresi için neden `&String` yerine `&str` tercih edilir?
  back: "`&str` hem `String`'leri (otomatik dönüşümle), hem literalleri, hem de dilimleri kabul eder."
- front: "`let s = String::from(\"şeker\");` için `&s[0..1]` ne olur?"
  back: "Derlenir ama çalışınca **panik** verir: 1, `ş`'nin (2 bayt) ortasında, karakter sınırı değil."
- front: "`ilk_kelime(&s)` sonucunu tutarken `s.clear()` neden derlenmez?"
  back: "Dilim `s`'yi `&` ile ödünç alıyor; `clear` ise `&mut` istiyor (**E0502**)."
- front: "Bir bayt indeksinin bir karakter sınırı olup olmadığı nasıl kontrol edilir?"
  back: "`s.is_char_boundary(i)` (0 ve `s.len()` her zaman sınırdır)."
```
