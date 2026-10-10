---
id: m12-l01
title: Yaşam süresi nedir?
minutes: 16
type: lesson
objectives:
  - Bir referansın yaşam süresini (lifetime) ve bir değerin ömrünü birbirinden ayırt edebilmek
  - Bir kod parçasında `'a` / `'b` parantezlerini çizerek borrow checker'ın hangi süreleri karşılaştırdığını gösterebilmek
  - "`E0597: does not live long enough` hatasını yaşam süresi diliyle okuyup üç farklı yolla düzeltebilmek"
  - Yaşam süresi anotasyonlarının değerlerin ömrünü değiştirmediğini (tanımlayıcı olduğunu) açıklayabilmek
keywords: [lifetime, yaşam süresi, borrow checker, E0597, NLL, kapsam, dangling]
---

Modül 5'te derleyici sana şöyle bir cümle kurmuştu: *"`x` does not live long enough"*, yani "`x` yeterince
uzun yaşamıyor". O gün "bu sürelere **yaşam süresi (lifetime)** denir, Modül 12'de isim vermeyi
öğreneceksin" demiştik. İşte o modüldesin.

Yaşam süreleri Rust'ın en çok korkulan konusu olarak bilinir. Oysa sen onları aylardır kullanıyorsun:
yazdığın her `&` için derleyici sessizce bir yaşam süresi hesapladı. Bu modülde o sessiz hesabı
**görünür** kılacağız. Önce kavramın kendisiyle başlayalım: Ortada henüz hiç `'a` yok.

:::ferris
Korkma, yaşam süreleri yeni bir kural getirmiyor. Modül 5'teki kuralların sadece **adı** konuyor.
Zaten bildiğin bir şeyi okumayı öğreneceksin. 🦀
:::

## Her referansın bir ömrü var

Modül 5'ten bir tanıdıkla ısınalım. Tahmin et:

```compiles
code: |
  fn main() {
      let mut notlar = vec![70, 85, 90];
      let ilk = &notlar[0];
      println!("İlk not: {ilk}");
      notlar.push(100);
      println!("{notlar:?}");
  }
answer: true
explanation: |
  Derlenir! `ilk` referansı **son kez** `println!` satırında kullanılıyor. Ondan sonra artık canlı bir
  ödünç yok, bu yüzden `push` için `&mut` ödünç almak serbest. Modül 5'te buna **NLL (non-lexical
  lifetimes)** demiştik: ödünç, kapanan süslü paranteze kadar değil, **son kullanıma** kadar sürer.
```

Bu küçük örnekte iki farklı "süre" var ve bu modülün tamamı bu iki sürenin farkına dayanıyor:

| Kavram | Ne kadar sürer? | Kim belirler? |
|---|---|---|
| **Değerin ömrü** | Oluşturulduğu andan `drop` edilene (ya da taşınana) kadar | Sahiplik kuralları (Modül 4): kapsam sonu, taşıma |
| **Referansın yaşam süresi** | Referansın geçerli olması **gereken** kod bölgesi: oluşturulduğu yerden son kullanımına kadar | Referansı nasıl kullandığın |

Yukarıdaki kodda `notlar` vektörünün ömrü `main`'in sonuna kadar sürer. `ilk` referansının yaşam süresi
ise yalnızca iki satırdır. Rust'ta "lifetime" kelimesi çoğunlukla bu ikinci şeyi, yani **bir ödüncün
geçerli kalması gereken bölgeyi** anlatır.

Borrow checker'ın bütün işi iki soruya cevap vermektir:

1. **Referans, gösterdiği değerden uzun mu yaşıyor?** Öyleyse referans sarkar (dangling). Yasak.
2. **Referans yaşarken çakışan bir işlem var mı?** (`&` yaşarken `&mut`, taşıma ya da yeniden atama.) Varsa yasak.

:::analogy Kütüphane kartındaki iade tarihi
Modül 5'te ödünç almayı kütüphaneden kitap almaya benzetmiştik. Şimdi ödünç kartına bak: Üzerinde bir
**iade tarihi** var. İşte yaşam süresi o tarihtir: Ödüncün geçerli olduğu dönem.

Kütüphane tek bir kural uygular: **Kitap, ödünç dönemi boyunca rafta var olmalı.** Kitap ödünçteyken
kütüphane onu satamaz (taşıma), yakamaz (`drop`) ya da yerine başka kitap koyamaz (yeniden atama).
Kartın iade tarihi kitabın ne kadar yaşayacağını belirlemez; sadece kitabın **en az ne kadar yaşaması
gerektiğini** söyler.
:::

```quiz
question: "Rust'ta bir referansın **yaşam süresi (lifetime)** en iyi hangi cümleyle anlatılır?"
options:
  - "Referansın gösterdiği değerin bellekte kaldığı süre"
  - "Referansın geçerli kalması gereken kod bölgesi: oluşturulduğu yerden son kullanımına kadar"
  - "Referans değişkeninin tanımlandığı süslü parantez bloğunun tamamı"
  - "Programın çalışma zamanında referansa ayrılan bellek miktarı"
answer: 1
explanation: |
  Yaşam süresi bir **ödüncün** özelliğidir: Referans hangi satırlarda kullanılıyorsa o bölge boyunca
  geçerli kalmak zorundadır. Değerin ömrü ayrı bir şeydir; borrow checker ikisini **karşılaştırır**.
  NLL sayesinde bu bölge süslü parantezin sonuna kadar değil, son kullanıma kadar uzanır.
feedback:
  - "Bu, **değerin** ömrü. Referansın yaşam süresi bundan kısa olabilir ve olmalıdır."
  - "Doğru! Referansın geçerli olması gereken bölge."
  - "Eskiden (2018 öncesi) böyle hesaplanırdı. NLL ile ödünç son kullanımda biter."
  - "Yaşam süreleri tamamen derleme zamanı kavramıdır; çalışma zamanında hiçbir izleri yoktur."
```

## Borrow checker süreleri karşılaştırır

Modül 5'teki klasik sarkma örneğini, bu sefer yaşam süresi gözlüğüyle inceleyelim. Rust topluluğunda
süreleri, kodun yanına çizilen parantezlerle ve `'a`, `'b` gibi **adlarla** göstermek gelenektir. Baştaki
tek tırnak (`'`) "bu bir yaşam süresi adı" demektir:

```text
fn main() {
    let r;                // ──────────────────┐ 'a: r'nin geçerli olması gereken bölge
                          //                   │
    {                     //                   │
        let x = 5;        // ──┐ 'b: x'in ömrü │
        r = &x;           //   │               │
    }                     // ──┘ x ölür        │
                          //                   │
    println!("{r}");      // ──────────────────┘ r hâlâ kullanılıyor
}
```

`r`'nin tipi `&i32`, ama derleyicinin gözünde aslında `&'a i32`: "`'a` süresi boyunca geçerli olması gereken
bir `i32` referansı". `x` ise yalnızca `'b` boyunca yaşıyor. Derleyicinin sorusu şu: **`'b`, `'a`'yı
kapsıyor mu?** Kapsamıyor: `'b` daha kısa. Sonuç E0597.

```memory
title: "r = &x; sonrası: referans değerinden uzun yaşamaya çalışıyor"
steps:
  - caption: "İç blokta `x` doğdu, `r` onu gösteriyor. Şimdilik her şey geçerli."
    stack:
      - frame: main
        vars:
          - { name: r, type: "&i32", value: "ptr", to: x }
      - frame: "iç blok"
        vars:
          - { name: x, type: i32, value: "5" }
  - caption: "İç blok bitti: `x` öldü. `r` hâlâ onun eski yerini gösteriyor ve `println!`'de kullanılacak. Rust bu programı **derlemez**."
    stack:
      - frame: main
        vars:
          - { name: r, type: "&i32", value: "ptr", to: x, note: "sarkardı!" }
      - frame: "iç blok (bitti)"
        vars:
          - { name: x, type: i32, value: "???", moved: true, note: "ömrü bitti" }
```

Düzeltmek için ya değeri daha uzun yaşatırsın ya da referansın kullanımını kısaltırsın. Böylece değerin
ömrü referansın yaşam süresini **tamamen kapsar**:

```text
fn main() {
    let x = 5;            // ──────────┐ 'b: x'in ömrü
                          //           │
    let r = &x;           // ──┐ 'a    │
                          //   │       │
    println!("{r}");      // ──┘       │
}                         // ──────────┘
```

```rust
fn main() {
    let x = 5; // x artık dış blokta: ömrü r'nin kullanımını kapsıyor
    let r = &x;
    println!("r = {r}");
}
```

:::remember
Bir referans `&'a T` ise, gösterdiği değer **en az `'a` boyunca** yaşamalıdır. Borrow checker'ın sarkma
kontrolü tam olarak bundan ibarettir: "Değerin ömrü, referansın yaşam süresini kapsıyor mu?"
:::

Şimdi aynı soruyu biraz daha sinsi bir yerde sor. Modül 2'deki **gölgeleme (shadowing)** devreye giriyor:

```predict
code: |
  fn main() {
      let sehir = String::from("Rize");
      let r = &sehir;
      let sehir = String::from("Van");
      println!("{r} {sehir}");
  }
options:
  - "Rize Van"
  - "Van Van"
  - "Derlenmez: ilk sehir gölgelenince öldü, r sarkıyor"
answer: 0
explanation: |
  Gölgeleme eski değeri **öldürmez**. Sadece adı yeni bir değere verir. İlk `String` ("Rize") hâlâ
  yaşıyor; artık ona `sehir` adıyla ulaşamıyorsun ama `r` üzerinden ulaşabiliyorsun. İlk değer, kendi
  kapsamının (burada `main`) sonunda `drop` edilir. Değerin ömrünü **kapsam** belirler, isimler değil.
  Bu yüzden `r`'nin yaşam süresi değerin ömrü içinde kalıyor ve program "Rize Van" yazdırır.
```

Gölgeleme ile **yeniden atama** ise çok farklıdır. Yeniden atamada eski değer o anda `drop` edilir:

```compiles
code: |
  fn main() {
      let mut sehir = String::from("Rize");
      let r = &sehir;
      sehir = String::from("Van");
      println!("{r} {sehir}");
  }
answer: false
error: E0506
explanation: |
  `sehir = ...` ataması eski "Rize" değerini **hemen** `drop` eder ve yerine yenisini koyar. `r` ise hâlâ
  kullanılacak, yani yaşam süresi atamanın ötesine uzanıyor. Ödünçteki bir değerin üzerine yazmak
  yasak: **E0506** (*cannot assign to `sehir` because it is borrowed*). Kütüphane benzetmesiyle:
  ödünç dönemi bitmeden rafa başka kitap koyamazsın.
```

## Döngüde doğan, döngüde ölür

Gerçek programlarda E0597 en çok döngülerde karşına çıkar. Bir sınıf listesi hazırlayan şu koda bak.
Önce tahmin et:

```compiles
code: |
  fn main() {
      let mut isimler: Vec<&String> = Vec::new();
      for i in 1..=3 {
          let isim = format!("öğrenci{i}");
          isimler.push(&isim);
      }
      println!("{isimler:?}");
  }
answer: false
error: E0597
explanation: |
  Her turda `isim` döngü gövdesinin içinde doğar ve tur bitince ölür. Vektör ise döngüden **sonra**
  kullanılıyor ve içinde bu ölü `String`'lere referanslar olurdu. Derleyici, `isimler`'in içindeki
  referansların yaşam süresinin `println!`'e kadar uzandığını, `isim`'in ömrünün ise tek bir tur
  sürdüğünü görüyor.
```

:::error
```text
error[E0597]: `isim` does not live long enough
 --> src/main.rs:5:22
  |
2 |     let mut isimler: Vec<&String> = Vec::new();
  |         ----------- variable `isimler` declared here
3 |     for i in 1..=3 {
4 |         let isim = format!("öğrenci{i}");
  |             ---- binding `isim` declared here
5 |         isimler.push(&isim);
  |                      ^^^^^ borrowed value does not live long enough
6 |     }
  |     - `isim` dropped here while still borrowed
7 |     println!("{isimler:?}");
  |                ------- borrow later used here
  |
  = note: `isimler` is a collection that stores borrowed references, but `isim` does not live long enough to be stored in it
```
Etiketleri yaşam süresi diliyle oku: `isim` **4. satırda doğuyor**, **6. satırda ölüyor**
(*dropped here while still borrowed*). Referans ise **7. satıra kadar** yaşamak zorunda (*borrow later
used here*). Değerin ömrü, referansın yaşam süresini kapsamıyor. `note` satırı da teşhisi koyuyor:
"`isimler` ödünç referanslar saklayan bir koleksiyon, ama `isim` orada saklanacak kadar uzun yaşamıyor."
:::

Bu hatayı düzeltmenin üç tipik yolu var. Her biri yaşam süresi denkleminin bir tarafını değiştirir:

1. **Sahipliği koleksiyona ver.** `Vec<&String>` yerine `Vec<String>` ve `push(isim)`: Değer artık vektörle
   birlikte yaşar. Döngüde üretilen veri için neredeyse her zaman doğru çözüm budur.
2. **Değeri daha uzun yaşat.** Veri döngüden önce zaten varsa (ör. bir dizi), referansları **ona** al.
3. **Referansın kullanımını kısalt.** Referansla işini aynı turda bitir (ör. turun içinde yazdır).

```rust
fn main() {
    // Çözüm 1: vektör String'lerin SAHİBİ olsun
    let mut isimler: Vec<String> = Vec::new();
    for i in 1..=3 {
        let isim = format!("öğrenci{i}");
        isimler.push(isim); // taşıma: isim'in ömrü artık vektörün ömrü
    }
    println!("{isimler:?}");

    // Çözüm 2: veri zaten dışarıda yaşıyorsa referans tutmak sorun değil
    let sinif = [String::from("Ada"), String::from("Can"), String::from("Ece")];
    let mut secilenler: Vec<&String> = Vec::new();
    for ogrenci in &sinif {
        if ogrenci != "Can" {
            secilenler.push(ogrenci); // sinif, secilenler'den uzun yaşıyor
        }
    }
    println!("{secilenler:?}");
}
```

Çözüm 3 ise referansı hiç döngünün dışına çıkarmamaktır. Referans, değerle aynı turda doğar ve ölür:

```rust
fn main() {
    for i in 1..=3 {
        let isim = format!("öğrenci{i}");
        let etiket = &isim; // referansın yaşam süresi bu turda başlar...
        println!("Yoklama: {etiket} burada"); // ...ve burada biter
    } // isim burada ölür; ona bakan canlı bir referans kalmadı
}
```

Şimdi çözüm 2'yi kendin kur. Notlar döngüden **önce** var olduğu için, vektör onlara referans tutabilir:

```fill
prompt: "Geçen notlara referans tutan bir liste kur. Liste, notlardan uzun yaşamamalı; referansları doğru yerden al."
code: |
  fn main() {
      let notlar = [45, 78, 92, 30, 66];
      let mut gecenler: Vec<___0> = Vec::new();
      for not in ___1 {
          if *not >= 50 {
              gecenler.push(not);
          }
      }
      println!("{gecenler:?}");
  }
blanks:
  - ["&i32"]
  - ["&notlar", "notlar.iter()"]
output: "[78, 92, 66]"
explanation: |
  `for not in &notlar` diziyi ödünç alarak gezer; her `not` bir `&i32`'dir ve **dizinin içini** gösterir.
  Dizi `main`'in sonuna kadar yaşadığı için bu referansları vektörde saklamak güvenli: `notlar`'ın ömrü,
  `gecenler`'in içindeki referansların yaşam süresini kapsıyor. `*not >= 50` karşılaştırmasında `*` ile
  referansın gösterdiği değere ulaşıyoruz (Modül 5).
```

## Yaşam süreleri tanımlayıcıdır, emredici değil

Bu modülün en önemli cümlesi şu: **Yaşam süresi anotasyonları hiçbir değerin ömrünü değiştirmez.** Bir
sonraki derste `&'a str` gibi yazımlar göreceksin. Bunlar derleyiciye "şu değeri `'a` kadar yaşat" demez.
Sadece referanslar arasındaki **ilişkiyi tarif eder**: "Bu dönen referans, şu parametre kadar geçerli."
Sonra derleyici bu tarifin doğru olup olmadığını **kontrol eder**.

Bunu başka dillerle karşılaştırınca fark netleşir:

| Dil | Bir nesneye referans tutmak ne yapar? | Sonuç |
|---|---|---|
| **Java, Python, JS, C#** | Nesneyi hayatta **tutar**: çöp toplayıcı (GC), referans kaldıkça nesneyi silmez | Sarkma yok, ama GC'nin çalışma zamanı maliyeti var |
| **C / C++** | Hiçbir şey; nesne kendi ömrüne göre ölür | Sarkan işaretçi mümkün, kontrol eden yok |
| **Rust** | Hiçbir şey; nesne sahibinin kararıyla ölür | Sarkan referans **derlenmez**: kontrol derleme zamanında |

Yani Rust, bellek modeli olarak C++'a benzer: Referans değeri hayatta tutmaz. Ama C++'tan farklı olarak her
referansın yaşam süresini değerin ömrüyle **karşılaştırır**. Çöp toplayıcının işini çalışma zamanında
değil, derleme zamanında ve sıfır maliyetle yapar.

```quiz
question: |
  Bir arkadaşın şöyle diyor: "E0597 aldım. Referansa uzun bir yaşam süresi anotasyonu yazarsam değer de
  o kadar uzun yaşar ve hata düzelir." Ne dersin?
options:
  - "Haklı. Anotasyon, değeri belirtilen süre boyunca bellekte tutar."
  - "Yanlış. Anotasyonlar sadece ilişkiyi tarif eder; değerin ömrünü kapsam ve sahiplik belirler. Ya değeri daha uzun yaşatmalı ya da referansın kullanımını kısaltmalısın."
  - "Kısmen haklı. Anotasyon değeri heap'e taşır ve böylece daha uzun yaşatır."
answer: 1
explanation: |
  Yaşam süreleri **tanımlayıcıdır (descriptive), emredici değil (prescriptive)**. Derleyici değerlerin
  ne zaman öleceğini sahiplik kurallarıyla zaten biliyor. Anotasyon yalnızca "bu referans şuna bağlı"
  diye bir iddiada bulunur ve derleyici iddiayı doğrular. Yanlış bir iddia hatayı düzeltmez, sadece
  hatanın yerini değiştirir.
feedback:
  - "Java'nın GC'si böyle çalışır; Rust'ta referans değeri hayatta tutmaz."
  - "Doğru! Değerin ömrünü kapsam ve sahiplik belirler."
  - "Anotasyonlar belleğin yerini değiştirmez; çalışma zamanında hiçbir etkileri yoktur."
```

Bir şey daha: Yaşam süreleri tamamen **derleme zamanı** kavramıdır. Borrow checker işini bitirdikten sonra
derleyici onları siler. Çalışan programda referans hâlâ sadece bir adrestir (`&str` için adres + uzunluk).
Ne fazladan bir sayaç ne de fazladan bir kontrol vardır.

:::deep Generic'lere benzerlik
Modül 11'de `<T>` ile **tip parametresi** yazdın: "Her tip için çalışır, somut tipi çağıran belirler."
Bir sonraki derste göreceğin `<'a>` da bir **parametredir**: "Her yaşam süresi için çalışır, somut
bölgeyi çağrı yeri belirler." Önemli bir fark var: Generic tipler için derleyici her somut tip için ayrı
kod üretir (monomorfizasyon). Yaşam süreleri için ise **hiç kod üretilmez**. Derleyici `'a`'yı yalnızca
kontrol için kullanır, sonra unutur. Bu yüzden yaşam süresi parametresi eklemek ikili dosyanı (binary)
bir bayt bile büyütmez.
:::

## Alıştırmalar

İlki ısınma: Derlenmeyen bir programı, bu derste gördüğün ilk çözüm yoluyla düzelt.

````exercise
id: m12-e-menu
title: Lokantanın günlük menüsü
difficulty: 1
prompt: |
  Bir lokanta, günün yemeklerini satır satır biçimlendirip bir listede topluyor, sonra hepsini
  yazdırıyor. Ama program **derlenmiyor**: Her satır döngünün içinde doğup ölüyor, liste ise
  döngüden sonra kullanılıyor (E0597).

  Programı, listenin satırların **sahibi** olacağı şekilde düzelt. Çıktı şöyle olmalı:

  ```text
  - mercimek çorbası
  - karnıyarık
  - baklava
  ```
starter: |
  fn main() {
      let mut menu: Vec<&String> = Vec::new();
      for yemek in ["mercimek çorbası", "karnıyarık", "baklava"] {
          let satir = format!("- {yemek}");
          menu.push(&satir);
      }
      for satir in &menu {
          println!("{satir}");
      }
  }
starter_compiles: false
solution: |
  fn main() {
      let mut menu: Vec<String> = Vec::new();
      for yemek in ["mercimek çorbası", "karnıyarık", "baklava"] {
          let satir = format!("- {yemek}");
          menu.push(satir);
      }
      for satir in &menu {
          println!("{satir}");
      }
  }
check: output
expected_output: |
  - mercimek çorbası
  - karnıyarık
  - baklava
hints:
  - "Hata mesajı `satir`'in tur sonunda öldüğünü söylüyor. Listenin referans değil, **değerin kendisini** tutması gerekiyor."
  - "Vektörün tipini `Vec<&String>` yerine `Vec<String>` yap."
  - "`menu.push(&satir)` satırını `menu.push(satir)` yap: `satir` vektöre **taşınır** ve onunla birlikte yaşar."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: Kopyalamaya gerek yok; `satir` zaten bu turdan sonra kullanılmıyor, onu doğrudan taşıyabilirsin.
explanation: |
  `menu.push(satir)` ile her satırın sahipliği vektöre **taşınır**. Artık `satir` değişkeni tur sonunda
  kapsamdan çıksa da değer ölmez, çünkü sahibi vektördür. Değerin ömrü vektörün ömrüne bağlanmış olur.

  `clone` yasak, çünkü burada gereksiz: `satir`'i tur içinde bir daha kullanmıyoruz. Taşımak hem
  doğru hem bedava. Genel kural şu: **Döngüde üretilen** veriyi saklamak istiyorsan sahipliğini sakla.
  Referans tutmak, ancak veri referanstan daha uzun yaşayan bir yerdeyse işe yarar.
````

İkincisinde referans döndüren bir fonksiyon yazacaksın. İmzada hiç `'a` yok ve buna gerek de yok. Neden
gerekmediğini bu modülün 4. dersinde göreceğiz. Şimdilik derleyicinin dönen referansları parametredeki
listeye bağladığını bil.

```exercise
id: m12-e-harfle-baslayanlar
title: Yoklama listesinden seçmek
difficulty: 2
prompt: |
  Bir öğretmen, sınıf listesinden belirli bir harfle başlayan öğrencileri seçmek istiyor.
  `harfle_baslayanlar(liste, harf)` fonksiyonunu yaz:

  - `liste`'deki her isimden `harf` ile başlayanları, **sırayı koruyarak** döndür.
  - Dönen değerler yeni `String`'ler değil, listedeki isimlere bakan `&str` dilimleri olsun (kopya yok).
  - Karşılaştırma büyük/küçük harfe duyarlıdır: `'a'` ile `"Ali"` eşleşmez.

  Örnek: `["Şule", "Ali", "Şahin", "Berk"]` ve `'Ş'` için sonuç `["Şule", "Şahin"]`.
starter: |
  fn harfle_baslayanlar(liste: &[String], harf: char) -> Vec<&str> {
      todo!()
  }

  fn main() {
      let sinif = vec![
          String::from("Şule"),
          String::from("Ali"),
          String::from("Şahin"),
          String::from("Berk"),
      ];
      let secilenler = harfle_baslayanlar(&sinif, 'Ş');
      println!("{secilenler:?}");
  }
solution: |
  fn harfle_baslayanlar(liste: &[String], harf: char) -> Vec<&str> {
      let mut sonuc = Vec::new();
      for isim in liste {
          if isim.starts_with(harf) {
              sonuc.push(isim.as_str());
          }
      }
      sonuc
  }

  fn main() {
      let sinif = vec![
          String::from("Şule"),
          String::from("Ali"),
          String::from("Şahin"),
          String::from("Berk"),
      ];
      let secilenler = harfle_baslayanlar(&sinif, 'Ş');
      println!("{secilenler:?}");
  }
check: tests
tests: |
  fn liste(isimler: &[&str]) -> Vec<String> {
      let mut v = Vec::new();
      for i in isimler {
          v.push(i.to_string());
      }
      v
  }

  #[test]
  fn turkce_harfle_secer() {
      let sinif = liste(&["Şule", "Ali", "Şahin", "Berk"]);
      assert_eq!(harfle_baslayanlar(&sinif, 'Ş'), vec!["Şule", "Şahin"], "'Ş' ile başlayan iki öğrenci var");
  }

  #[test]
  fn sirayi_korur() {
      let sinif = liste(&["Cem", "Ada", "Can", "Ceren"]);
      assert_eq!(harfle_baslayanlar(&sinif, 'C'), vec!["Cem", "Can", "Ceren"], "isimler listedeki sırayla dönmeli");
  }

  #[test]
  fn eslesme_yoksa_bos() {
      let sinif = liste(&["Ali", "Veli"]);
      assert!(harfle_baslayanlar(&sinif, 'Z').is_empty(), "hiç eşleşme yoksa boş liste dönmeli");
      assert!(harfle_baslayanlar(&[], 'A').is_empty(), "boş sınıfta kimse seçilemez");
  }

  #[test]
  fn buyuk_kucuk_harfe_duyarli() {
      let sinif = liste(&["ali", "Ali"]);
      assert_eq!(harfle_baslayanlar(&sinif, 'a'), vec!["ali"], "'a' sadece küçük harfle başlayanı seçmeli");
  }
hints:
  - "Boş bir `Vec` oluştur, `for isim in liste` ile gez ve uygun olanları ekle."
  - "`isim.starts_with(harf)` bir `char` ile de çalışır (Modül 9). Bayt değil karakter karşılaştırır, `'Ş'` sorun olmaz."
  - "`isim` bir `&String`. Vektöre `&str` eklemek için `isim.as_str()` (ya da `&isim[..]`) kullan."
explanation: |
  Döndürdüğün her `&str`, parametre olarak gelen `liste`'nin **içindeki** `String`'lere bakıyor. Hiçbir
  karakter kopyalanmadı. Dönen vektör, sınıf listesinin bir "görünümü" gibi. Fonksiyonun içinde yeni bir
  `String` üretip ona bakan bir `&str` döndürmeye çalışsaydın kod derlenmezdi (E0515): O `String`
  fonksiyon bitince ölürdü.

  Peki derleyici bunun güvenli olduğunu nereden biliyor? İmzada tek bir referans girdi var (`liste`;
  `harf` bir `char`, referans değil). Derleyici bu durumda dönen referansların **o girdiye bağlı**
  olduğunu varsayar. Yani `secilenler`, `sinif` yaşadığı sürece geçerlidir. `sinif`'i `drop` edip
  `secilenler`'i kullanmaya kalksaydın E0505/E0597 alırdın. Bu otomatik varsayımın adı **elision**.
  Kurallarını 4. derste tek tek inceleyeceğiz.

  İdiomatik not: `starts_with` bir `char` alabildiği için Türkçe harflerle bayt hesabı yapmana gerek
  yok. `&isim[..1]` gibi bayt dilimlemek ise `'Ş'` (2 bayt) için panik verirdi (Modül 5).
```

## Özet

:::remember
- **Değerin ömrü**: doğduğu andan `drop` edilene ya da taşınana kadar (sahiplik belirler).
- **Referansın yaşam süresi**: geçerli kalması gereken bölge, yani oluşturulduğu yerden **son kullanımına** kadar (NLL).
- Kural: `&'a T` varsa, değer **en az `'a` boyunca** yaşamalı ve bu süre boyunca taşınamaz, üzerine yazılamaz, `&mut` ile ödünç alınamaz.
- E0597 düzeltmeleri: sahipliği sakla, değeri daha uzun yaşat, referansın kullanımını kısalt.
- Yaşam süreleri **tanımlayıcıdır**: İlişkiyi tarif ederler, ömrü değiştirmezler. Çalışma zamanında yoktur.
:::

```reflect
prompt: |
  Java'da bir nesneye referans tuttuğun sürece nesne silinmez. Rust'ta ise referans tutmak değeri hayatta
  tutmaz. Bu farkın Rust programcısına getirdiği **sorumluluğu** ve **kazancı** kendi cümlelerinle açıkla.
answer: |
  Model cevap: Rust'ta değerin ne zaman öleceğine sahiplik karar verir; referans sadece bakar. Bu yüzden
  programcının, referanslarının gösterdikleri değerlerden uzun yaşamamasını sağlaması gerekir. Örneğin
  döngüde üretilen veriyi referansla değil sahiplikle saklamak gibi. Bu bir sorumluluk, ama derleyici her
  ihlali yakaladığı için yanlış yapamazsın. Kazanç ise çöp toplayıcıya gerek kalmaması: Bellek, sahibi
  kapsamdan çıktığı anda, öngörülebilir biçimde ve çalışma zamanı maliyeti olmadan serbest bırakılır.
```

```flashcards
- front: Bir referansın **yaşam süresi** (lifetime) neyi ifade eder?
  back: "Referansın geçerli kalması gereken kod bölgesini: oluşturulduğu yerden son kullanımına kadar."
- front: "`&'a T` tipindeki bir referans için gösterdiği değer hakkında ne garanti edilir?"
  back: "Değer en az `'a` boyunca yaşar; bu süre boyunca taşınamaz, üzerine yazılamaz, `&mut` ile ödünç alınamaz."
- front: E0597 (*does not live long enough*) hangi durumda çıkar?
  back: "Bir değer, kendisine bakan bir referans hâlâ kullanılacakken ölüyorsa (`drop`). Değerin ömrü referansın yaşam süresini kapsamıyordur."
- front: "Yaşam süreleri \"tanımlayıcıdır, emredici değil\" ne demek?"
  back: "Anotasyonlar referanslar arasındaki ilişkiyi tarif eder ve derleyici bunu doğrular. Hiçbir değerin ömrünü uzatmaz ya da kısaltmaz."
- front: "Gölgeleme (`let x = ...` ikinci kez) eski değeri öldürür mü?"
  back: "Hayır. Eski değer kapsam sonuna kadar yaşar; ona eski referanslarla hâlâ ulaşılabilir. Yeniden atama (`x = ...`) ise eski değeri hemen `drop` eder."
- front: Döngü içinde üretilen `String`'leri döngü dışında kullanmak için en doğal çözüm nedir?
  back: "Referans değil sahiplik saklamak: `Vec<String>` ve `push(deger)`."
- front: Yaşam sürelerinin çalışma zamanında maliyeti var mı?
  back: "Hayır. Tamamen derleme zamanı kavramıdır; borrow checker'dan sonra silinirler ve hiç kod üretmezler."
```
