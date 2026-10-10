---
id: m05-l03
title: Sarkan referanslar (dangling)
minutes: 15
type: lesson
objectives:
  - Sarkan işaretçinin (dangling pointer) ne olduğunu ve C/C++'ta neden tehlikeli olduğunu açıklayabilmek
  - E0597, E0106, E0515 ve E0505 hatalarının her birinin hangi sarkma senaryosunu engellediğini söyleyebilmek
  - Yerel bir değere referans döndüren bir fonksiyonu sahipli bir değer (`String`) döndürerek düzeltebilmek
keywords: [dangling, sarkan referans, E0597, E0106, E0515, E0505, yaşam süresi, lifetime]
---

Bir arkadaşın sana yeni adresini verdi, sen de not ettin. Bir ay sonra taşındı ama sana haber vermedi.
Elindeki adres hâlâ düzgün bir adres gibi görünüyor, ama kapıyı çaldığında karşına bambaşka biri
çıkıyor. Programlamada buna **sarkan işaretçi (dangling pointer)** denir: artık geçerli olmayan bir
yeri gösteren bir adres.

C ve C++'ta sarkan işaretçiler en sinsi hata kaynaklarındandır. Rust'ta ise **sarkan bir referans
oluşturmak imkânsızdır**: derleyici, hiçbir referansın gösterdiği değerden uzun yaşamadığını kanıtlar.
Bu derste sarkmanın üç temel senaryosunu ve Rust'ın her birine verdiği hatayı tanıyacaksın.

## Sarkan işaretçi nedir?

Önce sorunun C'deki hâline bakalım. Bu kod derlenir (derleyici en fazla bir uyarı verir) ve çalışır...
bir şekilde:

```c
#include <stdio.h>

int *sayi_ver(void) {
    int x = 42;
    return &x;        // x'in adresini döndür...
}                     // ...ama x burada yok oluyor!

int main(void) {
    int *p = sayi_ver();
    printf("%d\n", *p);   // tanımsız davranış: 42, çöp değer ya da çökme
    return 0;
}
```

`x`, `sayi_ver`'in stack çerçevesinde yaşar. Fonksiyon dönünce çerçeve silinir ve o bellek bir sonraki
fonksiyon çağrısında başka değerlerle doldurulabilir. `p` ise hâlâ orayı gösterir:

```memory
title: "C'de sarkan işaretçi"
steps:
  - caption: "`sayi_ver` çalışırken `x` kendi stack çerçevesinde yaşıyor."
    stack:
      - frame: main
        vars:
          - { name: p, type: "int*", value: "(henüz yok)" }
      - frame: sayi_ver
        vars:
          - { name: x, type: int, value: "42" }
  - caption: "Fonksiyon döndü: çerçevesi silindi, ama `p` hâlâ `x`'in eski yerini gösteriyor. Bu bir **sarkan işaretçi**."
    stack:
      - frame: main
        vars:
          - { name: p, type: "int*", value: "eski adres", to: x, note: "sarkan!" }
      - frame: "sayi_ver (bitti)"
        vars:
          - { name: x, type: int, value: "???", moved: true, note: "geçersiz bellek" }
```

Aynı sorun heap'te de olur: `free(s)` ile serbest bırakılan bir belleği kullanmaya devam etmek
(**use-after-free**). Modül 1'den hatırla: büyük yazılım şirketlerinin raporlarına göre güvenlik
açıklarının yaklaşık %70'i bu tür bellek güvenliği hatalarından kaynaklanıyor. Bunlar arasında
use-after-free en yaygın olanlardan biri.

:::analogy Otel odasının anahtar kartı
Otelden çıkış yaptın ama anahtar kartı cebinde kaldı. Kart hâlâ "304 numaralı oda" diyor, ama oda
artık başka bir misafirin. Kartı kullanırsan ya kapı açılmaz ya da daha kötüsü, açılır ve başkasının
eşyalarını karıştırırsın. Sarkan işaretçi tam olarak budur. Rust'ın borrow checker'ı resepsiyon gibi
çalışır: Bir kart hâlâ birinin elindeyken o odanın boşaltılmasına izin vermez.
:::

```quiz
question: Aşağıdakilerden hangisi **sarkan** bir referanstır?
options:
  - "Kapsamı bitmiş ya da serbest bırakılmış bir değeri gösteren referans"
  - "Değeri `NULL` olan bir işaretçi"
  - "Değiştirilebilir (`&mut`) bir referans"
  - "Bir fonksiyona parametre olarak verilmiş bir referans"
answer: 0
explanation: |
  Sarkan referans, **artık geçerli olmayan** belleği gösterir: değer ölmüş ama adresi hâlâ elde.
  `NULL` işaretçi ayrı bir hata türüdür. Bu arada Rust'ta `NULL` referans da yoktur; "değer yok"
  durumunu Modül 7'de `Option` ile ifade edeceğiz.
feedback:
  - "Doğru! Değer gitmiş, adres kalmış."
  - "NULL işaretçi \"hiçbir şeyi\" gösterir; sarkan işaretçi ise \"artık orada olmayan bir şeyi\" gösterir. İkisi farklı hatalardır."
  - "`&mut` referanslar da her zaman geçerli bir değeri gösterir; değiştirilebilir olmak sarkmak demek değil."
  - "Parametre olarak gelen referans, çağıranın canlı bir değerini gösterir. Bu tamamen güvenlidir."
```

## Senaryo 1: Değer referanstan önce ölürse (E0597)

Rust'ta en basit sarkma denemesi şudur. `let r;` satırı değişkeni şimdi tanımlar, değerini sonra atar.
Tahmin et:

```compiles
code: |
  fn main() {
      let r;
      {
          let x = 5;
          r = &x;
      }
      println!("{r}");
  }
answer: false
error: E0597
explanation: |
  `x` iç blokta yaşar ve blok bitince ölür. `r` ise `println!` satırında, yani `x` öldükten **sonra**
  kullanılıyor. `r` o anda ölü bir değeri gösterirdi. Derleyici bunu yakalar: `x does not live long
  enough` (x yeterince uzun yaşamıyor).
```

:::error
```text
error[E0597]: `x` does not live long enough
 --> src/main.rs:5:13
  |
4 |         let x = 5;
  |             - binding `x` declared here
5 |         r = &x;
  |             ^^ borrowed value does not live long enough
6 |     }
  |     - `x` dropped here while still borrowed
7 |     println!("{r}");
  |                - borrow later used here
```
Hikâyeyi etiketler anlatıyor: `x` burada tanımlandı, burada ödünç alındı, **burada öldü** (hâlâ
ödünçteyken!) ve ödünç **daha sonra burada kullanıldı**.
:::

Borrow checker iki süreyi karşılaştırır: referansın kullanıldığı süre ile değerin yaşadığı süre.
İlki ikincisini aşamaz:

```text
let r;                 // ────────────┐ r'nin kullanıldığı süre
{                      //             │
    let x = 5;         // ──┐ x'in    │
    r = &x;            //   │ ömrü    │
}                      // ──┘ x ölür  │
println!("{r}");       // ────────────┘ ← r hâlâ kullanılıyor: HATA
```

Bu sürelere **yaşam süresi (lifetime)** denir. Şimdilik derleyici bunları tamamen kendisi hesaplıyor;
Modül 12'de `'a` gibi etiketlerle onlara isim vermeyi öğreneceksin.

Önemli olan referansın **nerede oluşturulduğu** değil, **neyi gösterdiğidir**. Şu kod sorunsuz
derlenir, çünkü referans iç blokta atansa da dış blokta yaşayan değerleri gösteriyor:

```rust
fn main() {
    let ad1 = String::from("Deniz");
    let ad2 = String::from("Kerem");
    let kazanan;
    {
        let puan1 = 87;
        let puan2 = 92;
        kazanan = if puan1 > puan2 { &ad1 } else { &ad2 };
    } // puan1 ve puan2 ölür; kazanan ise ad2'yi gösteriyor, o hâlâ canlı
    println!("Kazanan: {kazanan}");
}
```

## Senaryo 2: Fonksiyondan yerel değere referans döndürmek (E0106, E0515)

C örneğinin Rust'taki karşılığını deneyelim. Tahmin et:

```compiles
code: |
  fn sarkan() -> &String {
      let s = String::from("merhaba");
      &s
  }

  fn main() {
      let r = sarkan();
      println!("{r}");
  }
answer: false
error: E0106
explanation: |
  Derleyici daha imzada durur: Dönüş tipi bir referans (`&String`), ama fonksiyonun ödünç alabileceği
  hiçbir parametresi yok. "Bu referans **kimden** ödünç alınmış?" sorusunun tek cevabı yerel `s` olabilir.
  `s` ise fonksiyon bitince ölür. Hata: `missing lifetime specifier`.
```

:::error
```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:16
  |
1 | fn sarkan() -> &String {
  |                ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but there is no value for it to be borrowed from
help: consider using the `'static` lifetime, but this is uncommon unless you're returning a borrowed value from a `const` or a `static`
  |
1 | fn sarkan() -> &'static String {
  |                 +++++++
help: instead, you are more likely to want to return an owned value
  |
1 - fn sarkan() -> &String {
1 + fn sarkan() -> String {
  |
```
İlk `help` satırını okurken dikkatli ol: "`'static` kullanmayı düşün, **ama bu nadirdir**" diyor.
`&'static String` yazarsan bu sefer E0515 alırsın, çünkü yerel `s` yine ölüyor. Asıl çözüm son satırda:
**sahipli bir değer döndür** (`-> String`).
:::

Fonksiyonun **tek** bir referans parametresi varsa hata mesajı değişir. Derleyici bu durumda döndürülen
referansın o parametreden geldiğini varsayar (bu kurala "elision" denir, Modül 12'de göreceğiz) ve
yerel bir değere referans döndürdüğünü yakalar:

:::error
```text
error[E0515]: cannot return reference to local variable `sonuc`
 --> src/main.rs:3:5
  |
3 |     &sonuc
  |     ^^^^^^ returns a reference to data owned by the current function
```
Bu hata `fn rozet(isim: &String) -> &String { let sonuc = format!("[{isim}]"); &sonuc }` gibi bir
fonksiyonda çıkar: "Bu fonksiyonun **sahip olduğu** bir veriye referans döndürüyorsun."
:::

Çözüm, değeri ödünç vermek yerine **sahipliğini dışarı taşımaktır**:

```rust
fn rozet(isim: &String) -> String {
    format!("[{isim}]") // yeni String'in sahipliği çağırana geçer
}

fn main() {
    let ad = String::from("Ayşe");
    let r = rozet(&ad);
    println!("{r} ve {ad}");
}
```

Modül 4'ten hatırla: bir `String`'i döndürmek ucuzdur. Kopyalanan sadece stack'teki 24 baytlık başlıktır
(işaretçi, uzunluk, kapasite); heap'teki karakterler yerinde kalır, sadece sahibi değişir.

Peki her referans döndürme yasak mı? Hayır! Şu örneğe bak ve tahmin et:

```predict
code: |
  fn mevsim(ay: u32) -> &'static str {
      if ay == 12 || ay <= 2 {
          "kış"
      } else if ay <= 5 {
          "ilkbahar"
      } else if ay <= 8 {
          "yaz"
      } else {
          "sonbahar"
      }
  }

  fn main() {
      println!("{} {} {}", mevsim(1), mevsim(6), mevsim(12));
  }
options:
  - "kış yaz kış"
  - "kış ilkbahar kış"
  - "Derlenmez: fonksiyon yerel bir değere referans döndürüyor"
answer: 0
explanation: |
  Derlenir! String literalleri (`"kış"`) programın ikili dosyasına gömülüdür ve program boyunca
  yaşarlar (Modül 4). Tipleri `&'static str`'dir: `'static` "programın sonuna kadar geçerli" demektir.
  Böyle bir referans asla sarkmaz. Bu kalıbı Modül 3'teki sayı tahmin oyununun `karsilastir` fonksiyonunda da görmüştün.

  Hesap ise Modül 3'teki `if`/`else if` zinciri: 1 → `ay <= 2` → "kış"; 6 → `ay <= 8` → "yaz";
  12 → ilk koşul → "kış".
```

## Senaryo 3: Ödünç verilmiş değeri taşımak (E0505)

Değer kapsamdan çıkmasa bile sarkma olabilir: sahibi değeri **başkasına taşırsa**. Tahmin et:

```compiles
code: |
  fn tuket(s: String) {
      println!("tüketildi: {s}");
  }

  fn main() {
      let s = String::from("veri");
      let r = &s;
      tuket(s);
      println!("{r}");
  }
answer: false
error: E0505
explanation: |
  `tuket(s)` sahipliği fonksiyona taşır; `tuket` bitince `String` drop edilir. Ama `r` hâlâ kullanılacak!
  İzin verilseydi `r` serbest bırakılmış belleği gösterirdi. Hata: `cannot move out of s because it is
  borrowed` (ödünçteyken taşınamaz).
```

Düzeltme genellikle sıralamadır: Referansın işini taşımadan **önce** bitir.

```rust
fn tuket(s: String) {
    println!("tüketildi: {s}");
}

fn main() {
    let s = String::from("veri");
    let r = &s;
    println!("Önce oku: {r}"); // r'nin son kullanımı
    tuket(s); // artık canlı ödünç yok, taşıma serbest
}
```

Ders 2'de gördüğün iki hata da aslında birer sarkma koruyucusuydu. Şimdi hepsini bir arada görelim:

| Senaryo | C/C++'ta sonuç | Rust'ın hatası |
|---|---|---|
| Değer kapsamdan çıkar, referans kullanılmaya devam eder | sarkan işaretçi | **E0597** |
| Fonksiyon yerel değişkenine referans döndürür | sarkan işaretçi | **E0106** / **E0515** |
| Ödünç verilmiş değer taşınır | use-after-free | **E0505** |
| Ödünç verilmişken değer yeniden atanır | eski değer serbest bırakılır | **E0506** |
| Ödünç verilmişken Vec büyür (`push`) | iterator invalidation | **E0502** |

```quiz
question: "`let r = &kitap;` satırından sonra, `r` hâlâ kullanılacakken `kitap` bir fonksiyona argüman olarak (`String` parametreye) verilirse hangi hata alınır?"
options:
  - "E0597: kitap does not live long enough"
  - "E0505: cannot move out of kitap because it is borrowed"
  - "E0106: missing lifetime specifier"
  - "E0499: cannot borrow kitap as mutable more than once"
answer: 1
explanation: |
  `String` parametreye vermek bir **taşımadır**. Ödünçteki bir değer taşınamaz: **E0505**.
  E0597 değerin kapsam sonunda ölmesiyle, E0106 dönüş tipindeki referansın kaynağının belirsiz olmasıyla,
  E0499 ise iki `&mut` ile ilgilidir.
feedback:
  - "E0597, değerin **kapsam sonunda** ölmesiyle ilgilidir. Burada değer taşınıyor."
  - "Doğru! Ödünçteyken taşıma yapılamaz."
  - "E0106 bir fonksiyon **imzasında**, dönüş referansının kaynağı belirsiz olduğunda çıkar."
  - "Burada hiç `&mut` yok; sorun taşıma."
```

## Düzeltme stratejileri

Sarkma hatası aldığında elindeki seçenekler şunlar:

1. **Sahipli değer döndür.** Fonksiyon içinde **üretilen** veri için en doğal çözüm budur: `-> String`,
   `-> Vec<T>`. Taşıma ucuzdur.
2. **Sahibi daha uzun yaşat.** Değeri, referansın kullanıldığı her yeri kapsayan bir dış kapsamda tanımla.
3. **Referansı parametreden türet.** Döndürdüğün referans, çağıranın sana verdiği veriyi göstersin.
   Çağıranın verisi zaten senin fonksiyonundan uzun yaşar. Bunun en güzel örneğini bir sonraki derste
   `ilk_kelime` fonksiyonunda göreceksin.
4. **Referansın kullanımını öne al.** Değer ölmeden ya da taşınmadan önce referansla işini bitir.

:::warning `'static` bir susturucu değildir
E0106'daki "`'static` kullanmayı düşün" önerisi, hatayı susturmanın kestirme yolu gibi görünebilir.
Değildir: `'static` **gerçekten** program boyunca yaşayan veriler (literaller, sabitler) içindir.
Çalışma zamanında üretilen bir `String` için `&'static` döndürmeye çalışmak sadece başka bir hataya
(E0515) götürür. Modül 12'de bu tuzağa ayrıca değineceğiz.
:::

Şimdi strateji 1'i uygula. Fonksiyon tam adı üretip **sahipliğini** çağırana versin:

```fill
prompt: "`tam_ad` yeni bir metin üretiyor. Doğru dönüş tipini ve dönüş ifadesini yaz."
code: |
  fn tam_ad(ad: &String, soyad: &String) -> ___0 {
      let sonuc = format!("{ad} {soyad}");
      ___1
  }

  fn main() {
      let ad = String::from("Ada");
      let soyad = String::from("Lovelace");
      let isim = tam_ad(&ad, &soyad);
      println!("{isim} ({ad})");
  }
blanks:
  - ["String"]
  - ["sonuc"]
output: "Ada Lovelace (Ada)"
explanation: |
  `sonuc` fonksiyonun içinde doğan bir `String`. `&sonuc` döndürmek E0515 olurdu. Bunun yerine
  `sonuc`'u **taşıyarak** döndürüyoruz: dönüş tipi `String`, son ifade de noktalı virgülsüz `sonuc`.
  Parametreler ise sadece okunduğu için `&String` olarak ödünç alınıyor; `ad` çağrıdan sonra da
  kullanılabiliyor.
```

## Alıştırmalar

İlk alıştırmada derlenmeyen bir fonksiyonu düzelteceksin.

```exercise
title: Sarkan karşılamayı düzelt
difficulty: 2
prompt: |
  `karsilama_mesaji` fonksiyonu saate göre bir karşılama mesajı üretiyor ama **derlenmiyor**
  (E0515): yerel bir `String`'e referans döndürmeye çalışıyor.

  Fonksiyonu, mesajın **sahipliğini** döndürecek şekilde düzelt. Kurallar aynı kalsın:
  - Saat 0-11: `"Günaydın, <isim>!"`
  - Saat 12-17: `"İyi günler, <isim>!"`
  - Saat 18-23: `"İyi akşamlar, <isim>!"`
starter: |
  fn karsilama_mesaji(isim: &String, saat: u32) -> &String {
      let mesaj = if saat < 12 {
          format!("Günaydın, {isim}!")
      } else if saat < 18 {
          format!("İyi günler, {isim}!")
      } else {
          format!("İyi akşamlar, {isim}!")
      };
      &mesaj
  }

  fn main() {
      let isim = String::from("Zeynep");
      println!("{}", karsilama_mesaji(&isim, 9));
      println!("{}", karsilama_mesaji(&isim, 20));
  }
solution: |
  fn karsilama_mesaji(isim: &String, saat: u32) -> String {
      if saat < 12 {
          format!("Günaydın, {isim}!")
      } else if saat < 18 {
          format!("İyi günler, {isim}!")
      } else {
          format!("İyi akşamlar, {isim}!")
      }
  }

  fn main() {
      let isim = String::from("Zeynep");
      println!("{}", karsilama_mesaji(&isim, 9));
      println!("{}", karsilama_mesaji(&isim, 20));
  }
starter_compiles: false
check: tests
tests: |
  #[test]
  fn sabah_gunaydin_der() {
      let isim = String::from("Zeynep");
      assert_eq!(karsilama_mesaji(&isim, 9), "Günaydın, Zeynep!", "saat 9 sabahtır");
      assert_eq!(karsilama_mesaji(&isim, 0), "Günaydın, Zeynep!", "gece yarısı (0) da sabah sayılır");
  }

  #[test]
  fn ogle_sinirlari_dogru() {
      let isim = String::from("Mert");
      assert_eq!(karsilama_mesaji(&isim, 12), "İyi günler, Mert!", "12 artık öğleden sonra");
      assert_eq!(karsilama_mesaji(&isim, 11), "Günaydın, Mert!", "11 hâlâ sabah");
      assert_eq!(karsilama_mesaji(&isim, 17), "İyi günler, Mert!", "17 hâlâ gündüz");
  }

  #[test]
  fn aksam_iyi_aksamlar_der() {
      let isim = String::from("Elif");
      assert_eq!(karsilama_mesaji(&isim, 18), "İyi akşamlar, Elif!", "18'den itibaren akşam");
      assert_eq!(karsilama_mesaji(&isim, 23), "İyi akşamlar, Elif!", "23 akşamdır");
  }

  #[test]
  fn isim_odunc_alinir_ve_korunur() {
      let isim = String::from("Can");
      let mesaj = karsilama_mesaji(&isim, 10);
      assert_eq!(isim, "Can", "isim yalnızca ödünç alınmalı, değişmemeli");
      assert_eq!(mesaj, "Günaydın, Can!", "mesaj isimle birlikte üretilmeli");
  }
hints:
  - "Hata mesajı: `cannot return reference to local variable mesaj`. `mesaj` fonksiyonla birlikte ölüyor."
  - "Dönüş tipini `&String` yerine `String` yap ve `&mesaj` yerine `mesaj` döndür."
  - "Daha da kısası: `if`/`else` ifadesinin kendisini fonksiyonun son ifadesi yap; `let mesaj` ve `&mesaj` satırlarına gerek kalmaz."
forbid:
  - pattern: "'static"
    message: "`'static` bu sorunu çözmez; çalışma zamanında üretilen bir metin program boyunca yaşamaz."
  - pattern: "-> *&"
    message: "Fonksiyon bir referans değil, sahipli bir `String` döndürmeli."
explanation: |
  `format!` her çağrıda yeni bir `String` üretir. Bu `String`'in sahibi fonksiyondur, fonksiyon bitince
  de drop edilir. Ona referans döndürmek sarkan bir referans olurdu. `-> String` ile sahipliği
  çağırana **taşıyoruz**: veri yerinde kalır, sadece sahibi değişir.

  `if`/`else if`/`else` bir ifade olduğu için (Modül 3) doğrudan son ifade olarak kullanabiliriz; ara
  değişkene gerek yok. Parametredeki `isim: &String` ise doğru seçim: Fonksiyon ismi sadece okuyor.
```

İkinci alıştırmada aynı programda hem `&'static str` hem de `String` döndüreceksin. Hangisinin ne
zaman doğru olduğuna dikkat et.

```exercise
title: Günlük (log) satırı üret
difficulty: 2
prompt: |
  Bir sunucu programı için günlük (log) satırları üreteceksin.

  1. `seviye_etiketi(seviye)` sabit bir etiket döndürsün: `0` → `"BİLGİ"`, `1` → `"UYARI"`,
     `2` ve üstü → `"HATA"`. Bu etiketler literal olduğu için dönüş tipi `&'static str`.
  2. `kayit_satiri(seviye, mesaj)` biçimlendirilmiş yeni bir satır döndürsün:
     `kayit_satiri(1, &mesaj)` → `"[UYARI] Disk dolmak üzere"`. Bu metin çalışma zamanında
     üretildiği için dönüş tipi `String`.
starter: |
  fn seviye_etiketi(seviye: u32) -> &'static str {
      todo!()
  }

  fn kayit_satiri(seviye: u32, mesaj: &String) -> String {
      todo!()
  }

  fn main() {
      let mesaj = String::from("Disk dolmak üzere");
      let satir = kayit_satiri(1, &mesaj);
      println!("{satir}");
      println!("Orijinal mesaj hâlâ burada: {mesaj}");
  }
solution: |
  fn seviye_etiketi(seviye: u32) -> &'static str {
      if seviye == 0 {
          "BİLGİ"
      } else if seviye == 1 {
          "UYARI"
      } else {
          "HATA"
      }
  }

  fn kayit_satiri(seviye: u32, mesaj: &String) -> String {
      let etiket = seviye_etiketi(seviye);
      format!("[{etiket}] {mesaj}")
  }

  fn main() {
      let mesaj = String::from("Disk dolmak üzere");
      let satir = kayit_satiri(1, &mesaj);
      println!("{satir}");
      println!("Orijinal mesaj hâlâ burada: {mesaj}");
  }
check: tests
tests: |
  #[test]
  fn etiketler_dogru() {
      assert_eq!(seviye_etiketi(0), "BİLGİ", "0 seviyesi BİLGİ olmalı");
      assert_eq!(seviye_etiketi(1), "UYARI", "1 seviyesi UYARI olmalı");
      assert_eq!(seviye_etiketi(2), "HATA", "2 seviyesi HATA olmalı");
      assert_eq!(seviye_etiketi(7), "HATA", "2 ve üstü her seviye HATA sayılır");
  }

  #[test]
  fn satir_bicimi_dogru() {
      let m1 = String::from("Bağlantı koptu");
      assert_eq!(kayit_satiri(2, &m1), "[HATA] Bağlantı koptu", "biçim: [ETİKET] mesaj");
      let m2 = String::from("Sunucu başladı");
      assert_eq!(kayit_satiri(0, &m2), "[BİLGİ] Sunucu başladı", "biçim: [ETİKET] mesaj");
  }

  #[test]
  fn mesaj_odunc_alinir() {
      let mesaj = String::from("Disk dolmak üzere");
      let satir = kayit_satiri(1, &mesaj);
      assert_eq!(satir, "[UYARI] Disk dolmak üzere", "1 seviyesi UYARI etiketiyle yazılmalı");
      assert_eq!(mesaj, "Disk dolmak üzere", "mesaj ödünç alındı, aynen kalmalı");
  }

  #[test]
  fn bos_mesaj() {
      assert_eq!(kayit_satiri(1, &String::from("")), "[UYARI] ", "boş mesajda sadece etiket ve boşluk kalır");
  }
hints:
  - "`seviye_etiketi` için Modül 3'teki `if`/`else if`/`else` ifade zincirini kullan; her dal bir literal döndürsün."
  - "`kayit_satiri` içinde önce etiketi al: `let etiket = seviye_etiketi(seviye);`"
  - "Sonra `format!(\"[{etiket}] {mesaj}\")` ile yeni bir `String` üret ve döndür."
explanation: |
  İki fonksiyonun dönüş tipleri farklı, çünkü verinin **sahibi** farklı:

  - `"UYARI"` gibi literaller programın ikili dosyasında yaşar; kimsenin sahiplenmesine gerek yok.
    `&'static str` döndürmek güvenli ve bedava (hiç bellek ayrılmaz).
  - `"[UYARI] Disk dolmak üzere"` ise çalışma zamanında **yeni** üretilen bir metin. Onu `format!`
    oluşturdu, fonksiyon da sahibi. Referans döndüremeyiz (E0515); sahipliği `String` olarak taşırız.

  `mesaj` parametresi `&String` çünkü sadece okunuyor. Çağıran, mesajı çağrıdan sonra da kullanabiliyor.
```

## Özet ve tekrar

:::remember
- **Sarkan referans**: ölmüş (kapsamı bitmiş, taşınmış ya da serbest bırakılmış) bir değeri gösteren referans.
- Rust'ta sarkan referans **derlenmez**; borrow checker hiçbir referansın değerinden uzun yaşamadığını kanıtlar.
- E0597: değer referanstan önce ölüyor. E0106 / E0515: yerel değere referans döndürülüyor. E0505: ödünçteki değer taşınıyor.
- Fonksiyonda üretilen veriyi **sahipli** döndür (`-> String`); taşıma ucuzdur.
- String literalleri `&'static str`'dir ve güvenle döndürülebilir; `'static` bir hata susturucu değildir.
:::

```reflect
prompt: |
  C derleyicisi `int *sayi_ver(void) { int x = 42; return &x; }` fonksiyonunu derler, Rust ise benzerini
  reddeder. Rust derleyicisi bunun hatalı olduğunu nasıl "biliyor"? Kendi cümlelerinle açıkla.
answer: |
  Model cevap: Rust her referansın neyi gösterdiğini ve o değerin ne kadar yaşadığını derleme zamanında
  takip eder. Dönüş tipi bir referanssa, o referansın bir yerden ödünç alınmış olması gerekir.
  Parametrelerden gelmiyorsa tek aday fonksiyonun kendi yerel değişkenleridir. Onlar da fonksiyon
  bitince ölür. Yani döndürülen referans, değerinden uzun yaşamak zorunda kalır. Derleyici bu
  çelişkiyi görür ve E0106 ya da E0515 ile reddeder. C'de böyle bir takip yoktur; işaretçi sadece
  bir sayıdır.
```

```flashcards
- front: Sarkan referans (dangling reference) nedir?
  back: Artık geçerli olmayan (kapsamı bitmiş, taşınmış ya da serbest bırakılmış) bir değeri gösteren referans.
- front: "`E0597: x does not live long enough` hangi durumu anlatır?"
  back: Referans, gösterdiği değer öldükten **sonra** da kullanılıyor.
- front: "`fn f() -> &String` imzası neden E0106 verir?"
  back: Döndürülen referansın ödünç alınabileceği bir parametre yok; referansın **kaynağı** belirsiz (missing lifetime specifier).
- front: E0515 hatası ne anlama gelir?
  back: "Fonksiyon, **kendi sahip olduğu** yerel bir değere referans döndürmeye çalışıyor (`cannot return reference to local variable`)."
- front: E0505 hatası ne anlama gelir?
  back: Ödünç verilmiş (referansı hâlâ kullanılacak) bir değer taşınmaya çalışılıyor.
- front: Fonksiyon içinde üretilen bir metni döndürmenin doğru yolu nedir?
  back: "Sahipli değer döndürmek: `-> String`. Sahiplik çağırana taşınır, taşıma ucuzdur."
- front: "`fn f() -> &'static str { \"kış\" }` neden derlenir?"
  back: "String literalleri ikili dosyada yaşar ve program boyunca geçerlidir (`'static`); referans asla sarkmaz."
```
