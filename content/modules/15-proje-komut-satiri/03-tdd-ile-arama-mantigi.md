---
id: m15-l03
title: TDD ile arama mantığı
minutes: 35
type: project
objectives:
  - "Arama fonksiyonunu önce başarısız bir testle (kırmızı), sonra en basit çözümle (yeşil) geliştirebilmek"
  - "`ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>` imzasındaki yaşam süresinin neden yalnızca `icerik`'e bağlandığını açıklayabilmek"
  - "`lines` ve `contains` ile büyük/küçük harfe duyarlı ve duyarsız arama fonksiyonları yazabilmek"
  - "Küçük harfe çevrilmiş bir kopyaya referans döndürmenin neden `E0515` verdiğini açıklayabilmek"
keywords: [TDD, test güdümlü geliştirme, kırmızı-yeşil-refactor, ara, lines, contains, to_lowercase, yaşam süresi, E0106, E0515]
---

`ara` artık argümanları okuyor, dosyayı açıyor ve hataları düzgünce bildiriyor. Ama asıl işini, yani
**aramayı**, henüz yapmıyor. Bu derste programın kalbini yazacağız. Hem de Modül 13'te öğrendiğin
disiplinle: **önce test, sonra kod**.

Mantığı `lib.rs`'e taşımamızın meyvesini şimdi toplayacaksın: arama fonksiyonu dosyadan, argümanlardan ve
ekrandan tamamen bağımsız, saf (pure) bir fonksiyon olacak. Bir metin al, bir metin listesi döndür. Bu tür
fonksiyonlar test etmenin en kolay olduğu fonksiyonlardır.

## Kırmızı: önce başarısız bir test

TDD döngüsünü hatırla: **kırmızı** (başarısız bir test yaz) → **yeşil** (testi geçiren en basit kodu yaz) →
**refactor** (testler yeşil kalırken kodu temizle). Yazacağımız fonksiyonun adı `ara`, işi şu: bir `sorgu` ve
bir `icerik` alacak, içeriğin sorguyu içeren satırlarını döndürecek. Testi `lib.rs`'in sonuna ekle:

```rust,norun,title=src/lib.rs (sonuna)
# pub fn ara<'a>(_sorgu: &str, _icerik: &'a str) -> Vec<&'a str> {
#     vec![]
# }
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bir_sonuc() {
        let sorgu = "ders";
        let icerik = "\
Rust:
güvenli, hızlı, verimli.
Her hata bir ders.";

        assert_eq!(vec!["Her hata bir ders."], ara(sorgu, icerik));
    }
}
```

Testteki metin değişmezinin başındaki **`"\`**'e dikkat et. Satırın sonundaki ters bölü (`\`), Rust'a
"buradaki satır sonunu ve bir sonraki satırın başındaki boşlukları metne katma" der. Böylece metin bir satır
sonuyla başlamaz. Sonraki satırları sola dayalı yazdık, çünkü onların başındaki boşluklar metnin parçası olur.

```predict
code: |
  fn main() {
      let a = "\
  Rust:
  güvenli.";
      let b = "
  Rust:";
      println!("[{a}]");
      println!("[{b}]");
  }
options:
  - |
    [Rust:
    güvenli.]
    [
    Rust:]
  - |
    [
    Rust:
    güvenli.]
    [
    Rust:]
  - |
    [Rust:
    güvenli.]
    [Rust:]
answer: 0
explanation: |
  `a`'da `"\` ilk satır sonunu yuttu; metin doğrudan `Rust:` ile başlıyor. `b`'de ise açılış tırnağından
  hemen sonra gerçek bir satır sonu var ve metnin **parçası**: `[` ile `Rust:` arasında satır atlanıyor.
  Testlerde çok satırlı metinleri `"\` ile başlatmak bu yüzden yaygın bir alışkanlıktır.
```

Test henüz derlenmez bile, çünkü `ara` diye bir fonksiyon yok. TDD'de bu da "kırmızı" sayılır. Derlenmesi
için gövdesi boş bir vektör döndüren bir **iskelet (stub)** yazacağız; ama önce imzayı doğru kurmamız gerek.
Aşağıdaki "İmzadaki yaşam süresi" bölümünün konusu bu.

```quiz
question: TDD'nin "kırmızı" adımında neden testin **gerçekten başarısız olduğunu** görmek isteriz?
options:
  - Derleyicinin daha hızlı çalışması için
  - Testin gerçekten bir şeyi denetlediğinden emin olmak için; hiç başarısız olmayan bir test, yanlış kodu da geçirebilir
  - Başarısız testler `cargo test`'in çalışması için zorunlu olduğu için
answer: 1
explanation: |
  Modül 13'ten: bir testi kırmızıyken görmek, **testin testidir**. İskelet kod `vec![]` döndürürken test
  geçiyorsa, test aslında hiçbir şey ölçmüyor demektir (yanlış veri, yanlış karşılaştırma, hiç çalışmayan
  bir test...). Kırmızıyı görüp sonra yeşile çevirdiğinde, yeşilin kodun **doğru** olmasından geldiğini
  bilirsin.
feedback:
  - "Derleme hızıyla ilgisi yok; amaç testin güvenilirliğini doğrulamak."
  - Doğru!
  - "`cargo test` tamamen yeşil testlerle de mutlu mesut çalışır."
```

## İmzadaki yaşam süresi

`ara` iki metin dilimi alıyor ve içeriğin **parçalarını** (satırları) döndürüyor. Yeni metin üretmiyoruz;
döndürdüğümüz her `&str`, `icerik`'in bir bölümünü gösteren bir dilim. İlk akla gelen imzayı yazalım:

```compiles
code: |
  pub fn ara(sorgu: &str, icerik: &str) -> Vec<&str> {
      let mut sonuclar = Vec::new();
      for satir in icerik.lines() {
          if satir.contains(sorgu) {
              sonuclar.push(satir);
          }
      }
      sonuclar
  }
answer: false
error: E0106
explanation: |
  İki referans parametre var ve dönüş tipi de bir referans içeriyor. Modül 12'deki elision kuralları
  burada yardım edemez: derleyici dönen `&str`'lerin `sorgu`'dan mı, `icerik`'ten mi ödünç alındığını
  **tahmin etmez**. Bunu imzada açıkça söylememiz gerekir.
```

:::error
```text
error[E0106]: missing lifetime specifier
 --> src/lib.rs:1:46
  |
1 | pub fn ara(sorgu: &str, icerik: &str) -> Vec<&str> {
  |                   ----          ----         ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but the signature does not say whether it is borrowed from `sorgu` or `icerik`
help: consider introducing a named lifetime parameter
  |
1 | pub fn ara<'a>(sorgu: &'a str, icerik: &'a str) -> Vec<&'a str> {
  |           ++++         ++               ++              ++
```
Derleyicinin önerisi derlenir ama **gereğinden katıdır**: sonucu hem `sorgu`'ya hem `icerik`'e bağlar. Oysa
sonuç yalnızca `icerik`'ten gelir. Doğru imza, `'a`'yı sadece ilgili parametreye koyar.
:::

Doğru imza ve testin derlenmesini sağlayan iskelet:

```rust
pub fn ara<'a>(_sorgu: &str, _icerik: &'a str) -> Vec<&'a str> {
    vec![]
}
# fn main() {
#     println!("{:?}", ara("ders", "Her hata bir ders."));
# }
```

(Parametre adlarının başındaki `_` yalnızca iskelette "kullanılmayan değişken" uyarısını susturmak için;
gerçek uygulamada kaldıracağız.) Bu imza bir **sözleşmedir**: *"Döndürdüğüm dilimler `icerik` yaşadığı
sürece geçerlidir; `sorgu` ile işleri yoktur."* Derleyici bu sözleşmeyi hem fonksiyonun içinde (gerçekten
yalnızca `icerik`'ten mi dilim döndürüyorsun?) hem de çağıran tarafta (sonucu `icerik`'ten uzun mu
yaşatıyorsun?) denetler.

:::analogy Fosforlu kalem
Bir kitapta önemli satırları fosforlu kalemle işaretlediğini düşün. İşaretlediğin satırlar kitabın
**içinde**; ayrı bir kâğıda yazmadın. Kitabı kütüphaneye iade edersen işaretlerin de onunla gider. Ama
"ders" kelimesini aklına not ettiğin kâğıdı (sorguyu) atman işaretlere hiçbir şey yapmaz. `'a`, "işaretler
kitapla birlikte yaşar" demenin yoludur.
:::

```memory
title: ara("ders", &icerik) sonrası
steps:
  - caption: "`icerik` heap'teki metnin sahibi. `sonuclar` vektörünün elemanları yeni metin değil; `icerik`'in içini gösteren dilimler (işaretçi + uzunluk)."
    stack:
      - frame: main
        vars:
          - { name: icerik, type: String, value: "ptr · len=50", to: h1 }
          - { name: sorgu, type: "&str", value: "\"ders\" (binary içinde)" }
          - { name: sonuclar, type: "Vec<&str>", value: "ptr · len=1", to: h2 }
    heap:
      - { id: h1, value: "Rust:⏎güvenli, hızlı, verimli.⏎Her hata bir ders.", label: "icerik'in metni" }
      - { id: h2, value: "[&str → 'Her hata bir ders.']", label: "dilimler h1'in içini gösterir" }
```

Şimdi bu sözleşmeyi çağıran tarafta sınayalım. İki program, iki tahmin:

```compiles
code: |
  # pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
  #     let mut sonuclar = Vec::new();
  #     for satir in icerik.lines() {
  #         if satir.contains(sorgu) {
  #             sonuclar.push(satir);
  #         }
  #     }
  #     sonuclar
  # }
  fn main() {
      let icerik = String::from("Rust güvenli\nC hızlı");
      let sonuclar;
      {
          let sorgu = String::from("Rust");
          sonuclar = ara(&sorgu, &icerik);
      } // sorgu burada düşürülür
      println!("{sonuclar:?}");
  }
answer: true
explanation: |
  Derlenir! `sorgu` iç kapsamın sonunda ölür ama imzamız sonucun `sorgu`'dan ödünç **almadığını** söylüyor.
  Sonuç yalnızca `icerik`'e bağlı ve `icerik` hâlâ yaşıyor. Derleyicinin önerdiği "her şeye `'a`" imzasıyla
  bu program **derlenmezdi**; doğru imza, çağıranlara gereksiz kısıt koymamak demektir.
```

```compiles
code: |
  # pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
  #     let mut sonuclar = Vec::new();
  #     for satir in icerik.lines() {
  #         if satir.contains(sorgu) {
  #             sonuclar.push(satir);
  #         }
  #     }
  #     sonuclar
  # }
  fn main() {
      let sonuclar;
      {
          let icerik = String::from("Rust güvenli\nC hızlı");
          sonuclar = ara("Rust", &icerik);
      } // icerik burada düşürülür
      println!("{sonuclar:?}");
  }
answer: false
error: E0597
explanation: |
  Bu kez ölen `icerik`: `sonuclar`'daki dilimler onun belleğini gösteriyor. Kapsam bitince bellek serbest
  kalır ve dilimler sarkan referansa (dangling reference) dönüşürdü. Derleyici bunu `E0597: icerik does not
  live long enough` ile yakalar. C'de bu kod derlenir ve tanımsız davranışa (undefined behavior) yol açardı.
```

## Yeşil: lines ve contains ile uygulamak

İskeletle `cargo test` çalıştır ve kırmızıyı gör:

```console
> cargo test
running 1 test
test tests::bir_sonuc ... FAILED

failures:

---- tests::bir_sonuc stdout ----
thread 'tests::bir_sonuc' (52) panicked at src/lib.rs:44:9:
assertion `left == right` failed
  left: ["Her hata bir ders."]
 right: []

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
```

Test, beklediğimiz gibi başarısız. Şimdi algoritma:

1. İçeriğin her satırını dolaş.
2. Satır sorguyu içeriyor mu, bak.
3. İçeriyorsa sonuç listesine ekle; içermiyorsa geç.
4. Listeyi döndür.

Rust'ın `str` metotları bu adımların ikisini hazır veriyor: **`lines()`** satırlar üzerinde bir iterator
döndürür (hem `\n` hem Windows'un `\r\n` satır sonlarını tanır ve satır sonu karakterlerini atar),
**`contains(sorgu)`** de bir metnin başka bir metni içerip içermediğini söyler. Satır sonu ayrıntısının neden
önemli olduğunu görmek için `lines()`'ı elle `'\n'`'de bölmekle karşılaştır:

```rust
fn main() {
    let windows_metni = "bir\r\niki\r\n";

    let satirlar: Vec<&str> = windows_metni.lines().collect();
    println!("lines: {satirlar:?}");

    let bolunmus: Vec<&str> = windows_metni.split('\n').collect();
    println!("split: {bolunmus:?}");
}
```

`split('\n')` her satırın sonunda bir `\r` ve en sonda boş bir parça bırakır. Windows'ta kaydedilmiş bir
dosyada `"iki"` araması yine çalışırdı, ama satırları ekrana yazdırdığında ya da satırın **sonuyla**
karşılaştırdığında bu görünmez `\r` başını ağrıtırdı. `lines()` bu işi doğru yapar.

```rust
pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    let mut sonuclar = Vec::new();

    for satir in icerik.lines() {
        if satir.contains(sorgu) {
            sonuclar.push(satir);
        }
    }

    sonuclar
}

fn main() {
    let siir = "\
Rust öğrenmek bir yolculuktur,
her hata yeni bir ders verir.
Derleyici sabırlı bir öğretmendir;
rust gibi paslanmaz bilgi bırakır.";

    println!("{:?}", ara("ders", siir));
    println!("{:?}", ara("bir", siir));
    println!("{:?}", ara("Python", siir));
}
```

Çalıştırınca görürsün: `"bir"` üç satırda geçiyor, `"Python"` hiçbirinde. `sonuclar`'ın tipini yazmadık;
derleyici `push(satir)` satırından onun bir `Vec<&'a str>` olduğunu çıkardı. Şimdi `cargo test`:

```console
> cargo test
running 1 test
test tests::bir_sonuc ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

Yeşil! Kodun sade; şu an refactor gerektiren bir şey yok (beşinci derste iterator'larla bu döngüyü tek
satıra indireceğiz).

```fill
prompt: Arama döngüsünü tamamla.
code: |
  pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      let mut sonuclar = Vec::new();
      for satir in icerik.___0() {
          if satir.___1(sorgu) {
              sonuclar.___2(satir);
          }
      }
      sonuclar
  }

  fn main() {
      let menu = "çay 10 TL\nkahve 40 TL\nbitki çayı 25 TL";
      println!("{:?}", ara("çay", menu));
  }
blanks:
  - ["lines"]
  - ["contains"]
  - ["push"]
output: '["çay 10 TL", "bitki çayı 25 TL"]'
explanation: |
  `lines()` satır satır dilimler üretir, `contains` alt metin araması yapar, `push` eşleşen dilimi vektöre
  ekler. Dikkat: `"çayı"` da `"çay"`'ı içerdiği için eşleşir. `contains` kelime değil, **alt metin**
  (substring) arar.
```

## Alıştırma: grep -v

Gerçek `grep`'in sık kullanılan bir seçeneği `-v`'dir (*invert match*): sorguyu **içermeyen** satırları
gösterir. Örneğin bir günlük (log) dosyasında `INFO` satırlarını eleyip geri kalanlara bakmak için kullanılır.
Şimdi sıra sende: örneği gördün, boşlukları doldurdun; bu kez fonksiyonu sıfırdan yaz.

```exercise
id: m15-e-ara-haric
title: "ara_haric, sorguyu içermeyen satırlar"
difficulty: 2
prompt: |
  `ara_haric(sorgu, icerik)` fonksiyonunu yaz: `icerik`'in sorguyu **içermeyen** satırlarını, sırası
  bozulmadan, `icerik`'ten alınmış dilimler olarak döndürsün.

  İmza hazır; yaşam süresinin neden yalnızca `icerik`'e bağlandığını düşünerek oku.
starter: |
  pub fn ara_haric<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      todo!()
  }
solution: |
  pub fn ara_haric<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      let mut sonuclar = Vec::new();
      for satir in icerik.lines() {
          if !satir.contains(sorgu) {
              sonuclar.push(satir);
          }
      }
      sonuclar
  }
check: tests
tests: |
  #[test]
  fn info_satirlarini_eler() {
      let log = "INFO sunucu başladı\nHATA disk dolu\nINFO istek alındı\nUYARI bellek az";
      assert_eq!(
          vec!["HATA disk dolu", "UYARI bellek az"],
          ara_haric("INFO", log),
          "INFO içermeyen satırlar, sırasıyla dönmeli"
      );
  }

  #[test]
  fn hepsi_eslesirse_bos_doner() {
      let icerik = "çay\nçaycı\nbitki çayı";
      assert!(ara_haric("çay", icerik).is_empty(), "her satır 'çay' içeriyor; sonuç boş olmalı");
  }

  #[test]
  fn hicbiri_eslesmezse_hepsi_doner() {
      let icerik = "elma\narmut\nkiraz";
      assert_eq!(vec!["elma", "armut", "kiraz"], ara_haric("muz", icerik));
  }

  #[test]
  fn windows_satir_sonlarini_temizler() {
      let icerik = "bir\r\niki\r\nüç";
      assert_eq!(vec!["bir", "üç"], ara_haric("iki", icerik), "satırlarda \\r kalmamalı");
  }

  #[test]
  fn bos_icerik_bos_sonuc() {
      assert!(ara_haric("x", "").is_empty());
  }
hints:
  - "`ara`'nın aynısı, tek bir farkla: koşulun tersi."
  - "Bool değeri tersine çevirmek için `!` kullanılır: `if !satir.contains(sorgu) { ... }`"
  - "`icerik.lines()` ile dolaş, koşulu sağlayan `satir`'ı `sonuclar.push(satir)` ile ekle, sonunda `sonuclar`'ı döndür."
explanation: |
  Tek fark `!` operatörü (Modül 2). Testlerin **kenar durumları** nasıl yakaladığına dikkat et: hepsi
  eşleşince boş liste, hiçbiri eşleşmeyince bütün satırlar, boş içerik ve Windows satır sonları. Satırları
  `split('\n')` ile bölseydin, `\r\n`'li dosyalarda her satırın sonunda bir `\r` kalırdı ve
  `windows_satir_sonlarini_temizler` testi kırılırdı; `lines()` bu ayrıntıyı senin yerine halleder.

  Dönen dilimler hâlâ `icerik`'in içini gösteriyor; hiçbir kopya yapılmadı. Bu yüzden fonksiyon büyük
  dosyalarda bile ucuzdur.
```

## Büyük/küçük harf duyarsız arama

Kullanıcılar çoğu zaman `Rust`, `rust` ya da `RUST` arasındaki farkı umursamaz. İkinci bir fonksiyon
yazacağız: `ara_buyuk_kucuk_duyarsiz`. TDD'ye sadık kalarak önce testi:

```rust,ignore
#[test]
fn buyuk_kucuk_duyarsiz() {
    let sorgu = "rUsT";
    let icerik = "\
Rust öğrenmek bir yolculuktur,
her hata yeni bir ders verir.
rust gibi paslanmaz bilgi bırakır.";

    assert_eq!(
        vec!["Rust öğrenmek bir yolculuktur,", "rust gibi paslanmaz bilgi bırakır."],
        ara_buyuk_kucuk_duyarsiz(sorgu, icerik)
    );
}
```

Fikir basit: hem sorguyu hem her satırı **küçük harfe çevir**, sonra karşılaştır. `to_lowercase()` yeni bir
`String` üretir (Modül 9). Ama bir tuzak var. Aşağıdaki "akıllıca" görünen sürüm derlenir mi?

```compiles
code: |
  pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      let sorgu = sorgu.to_lowercase();
      let mut sonuclar = Vec::new();
      for satir in icerik.lines() {
          let kucuk = satir.to_lowercase();
          if kucuk.contains(&sorgu) {
              sonuclar.push(kucuk.as_str());
          }
      }
      sonuclar
  }
answer: false
error: E0515
explanation: |
  `kucuk`, döngünün her turunda oluşturulan **yeni** bir `String`'dir ve turun sonunda düşürülür.
  `kucuk.as_str()` onun içini gösteren bir dilimdir; imzamız ise dilimlerin `icerik`'ten geldiğini vaat
  ediyor. Derleyici sözleşmenin bozulduğunu görür.
```

:::error
```text
error[E0515]: cannot return value referencing local variable `kucuk`
  --> src/lib.rs:10:5
   |
 7 |             sonuclar.push(kucuk.as_str());
   |                           ----- `kucuk` is borrowed here
...
10 |     sonuclar
   |     ^^^^^^^^ returns a value referencing data owned by the current function
```
Çözüm: karşılaştırmayı küçük harfli kopyayla yap, ama vektöre **orijinal** `satir`'ı (yani `icerik`'ten
gelen dilimi) ekle. Kullanıcı da zaten dosyadaki satırı orijinal hâliyle görmek ister.
:::

Bir ince nokta daha: küçük harfe çevrilmiş sorgu artık bir `String`. `contains` bir metin **deseni**
bekler; `&str`, `char` ve `&String` bu desenlerden biridir. Bu yüzden ona `&sorgu` (bir `&String`)
verebilirsin. `String`'in kendisi ise desen değildir: `contains(sorgu)` yazsaydın derleyici `E0277`
verir ve "consider borrowing here" diyerek `&` eklemeni önerirdi. Karşılaştırma fikrini tek tek
satırlar üzerinde dene:

```rust
fn main() {
    let sorgu = "rUsT".to_lowercase(); // bir kez çevir
    for satir in ["Rust öğrenmek", "RUST paslanmaz", "C++ hızlı"] {
        let eslesti = satir.to_lowercase().contains(&sorgu);
        println!("{satir:<16} -> {eslesti}"); // satır orijinal hâliyle yazılıyor
    }
}
```

:::warning Türkçe İ ve ı tuzağı
Modül 9'dan hatırla: `to_lowercase()` Unicode'un **dilden bağımsız** kurallarını uygular, Türkçe kurallarını
değil. Sonucu tahmin et:
:::

```predict
code: |
  fn main() {
      let a = "IŞIK".to_lowercase();
      let b = "İSTANBUL".to_lowercase();
      println!("{a}");
      println!("{}", b.contains("istanbul"));
      println!("{}", "Öğretmen".to_lowercase().contains("öğret"));
  }
options:
  - |
    ışık
    true
    true
  - |
    işik
    false
    true
  - |
    işik
    true
    true
  - |
    ışık
    false
    false
answer: 1
explanation: |
  Dilden bağımsız kurallarda büyük `I`'nın küçüğü `i`'dir (İngilizcedeki gibi), bu yüzden `IŞIK` →
  `işik` olur. Büyük `İ` ise `i` + "üst nokta" birleştirici işaretine (U+0307) dönüşür; görünüşte `i̇stanbul`
  olan metin, düz `istanbul`'u **içermez**. `Ö`, `Ğ` gibi harfler ise sorunsuz çevrilir. Türkçe metinlerde
  kusursuz duyarsız arama için dile duyarlı kütüphaneler (ICU) gerekir; `ara` için dilden bağımsız kuralları
  bilerek kabul ediyoruz.
```

## Alıştırma: duyarsız arama

```exercise
id: m15-e-ara-duyarsiz
title: ara_buyuk_kucuk_duyarsiz
difficulty: 3
prompt: |
  `ara_buyuk_kucuk_duyarsiz(sorgu, icerik)` fonksiyonunu yaz: büyük/küçük harf farkını gözetmeden sorguyu
  içeren satırları döndürsün. Dönen satırlar **orijinal hâlleriyle** (küçük harfe çevrilmeden) ve
  `icerik`'teki sırayla olmalı.
starter: |
  pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      todo!()
  }
solution: |
  pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
      let sorgu = sorgu.to_lowercase();
      let mut sonuclar = Vec::new();

      for satir in icerik.lines() {
          if satir.to_lowercase().contains(&sorgu) {
              sonuclar.push(satir);
          }
      }

      sonuclar
  }
check: tests
tests: |
  #[test]
  fn karisik_harfli_sorgu() {
      let icerik = "Rust öğrenmek bir yolculuktur,\nher hata yeni bir ders verir.\nrust gibi paslanmaz bilgi bırakır.";
      assert_eq!(
          vec!["Rust öğrenmek bir yolculuktur,", "rust gibi paslanmaz bilgi bırakır."],
          ara_buyuk_kucuk_duyarsiz("rUsT", icerik),
          "büyük/küçük harf farkı gözetilmemeli"
      );
  }

  #[test]
  fn orijinal_satiri_dondurur() {
      let icerik = "ÇAY OCAĞI\nkahve dükkânı";
      assert_eq!(
          vec!["ÇAY OCAĞI"],
          ara_buyuk_kucuk_duyarsiz("çay", icerik),
          "satır küçük harfe çevrilmiş hâliyle değil, orijinal hâliyle dönmeli"
      );
  }

  #[test]
  fn kucuk_harfli_satir_buyuk_harfli_sorgu() {
      let icerik = "öğretmen geldi\nöğrenci gitti";
      assert_eq!(vec!["öğretmen geldi"], ara_buyuk_kucuk_duyarsiz("ÖĞRETMEN", icerik));
  }

  #[test]
  fn eslesme_yoksa_bos() {
      assert!(ara_buyuk_kucuk_duyarsiz("python", "Rust\nC++\nGo").is_empty());
  }
hints:
  - "Sorguyu döngüden **önce** bir kez küçük harfe çevir: `let sorgu = sorgu.to_lowercase();` (gölgeleme)."
  - "Döngüde `satir.to_lowercase().contains(&sorgu)` ile karşılaştır."
  - "Vektöre küçük harfli kopyayı değil, orijinal `satir`'ı ekle; yoksa E0515 alırsın."
explanation: |
  İki önemli karar var:

  1. **Sorguyu bir kez çevir.** `sorgu.to_lowercase()`'i döngünün içine koysaydın her satır için yeniden
     hesaplanırdı. Döngüden önce gölgeleyerek (Modül 2) bu israftan kurtulduk.
  2. **Orijinali döndür.** `satir.to_lowercase()` geçici bir `String` üretir; ona dilim döndüremezsin
     (`E0515`). Karşılaştırmayı geçici kopyayla yapıp `icerik`'ten gelen `satir`'ı döndürmek hem derleyiciyi
     hem kullanıcıyı mutlu eder.

  Bedel: her satır için bir `String` ayrılır (heap tahsisi). Bir şiir için önemsiz; gigabaytlarca log
  taranırken önemlidir. `ripgrep` gibi araçlar bu yüzden dönüştürme yapmadan karşılaştıran özel algoritmalar
  kullanır.
```

Son olarak `run`'ı arama fonksiyonuna bağla. Artık içeriğin tamamını değil, yalnızca eşleşen satırları
yazdırıyoruz:

```rust,norun,title=src/lib.rs (run)
# use std::error::Error;
# use std::fs;
# pub struct Config {
#     pub sorgu: String,
#     pub dosya_yolu: String,
# }
# pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
#     let mut sonuclar = Vec::new();
#     for satir in icerik.lines() {
#         if satir.contains(sorgu) {
#             sonuclar.push(satir);
#         }
#     }
#     sonuclar
# }
pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let icerik = fs::read_to_string(config.dosya_yolu)?;

    for satir in ara(&config.sorgu, &icerik) {
        println!("{satir}");
    }

    Ok(())
}
```

```console
> cargo run -- bir siir.txt
Rust öğrenmek bir yolculuktur,
her hata yeni bir ders verir.
Derleyici sabırlı bir öğretmendir;
> cargo run -- Python siir.txt
>
```

Duyarsız sürümü `run`'a nasıl bağlayacağımızı, yani kullanıcının hangisini istediğini nereden bileceğimizi,
bir sonraki derste ortam değişkenleriyle çözeceğiz.

## Özet

:::remember
- TDD: **kırmızı** (başarısız test) → **yeşil** (en basit çözüm) → **refactor**. Kırmızıyı görmek testin testidir.
- `pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>`: sonuç yalnızca `icerik`'ten ödünç alır.
- `lines()` hem `\n` hem `\r\n`'yi tanır ve satır sonlarını atar; `contains` alt metin arar.
- Duyarsız arama: sorguyu döngüden önce bir kez `to_lowercase()` et, satırın küçük harfli kopyasıyla karşılaştır, **orijinal** satırı döndür.
- Geçici bir `String`'e dilim döndürmek `E0515` verir.
- `to_lowercase()` Türkçe kurallarını bilmez: `I` → `i`, `İ` → `i̇` (noktalı birleşik).
:::

```reflect
prompt: |
  `ara`'nın imzasında `'a`'yı hem `sorgu`'ya hem `icerik`'e koymak da derlenirdi. Neden yalnızca
  `icerik`'e koymayı tercih ettik? Bunun çağıran kod için somut bir faydasını örnekle anlat.
answer: |
  Yaşam süresi anotasyonları bir sözleşmedir: "sonuç şu verilerden ödünç alır". Sonuç gerçekte yalnızca
  `icerik`'in dilimlerinden oluşuyor; `sorgu`'yu da bağlamak yanlış (gereğinden katı) bir vaat olurdu.
  Somut fayda: çağıran, sorguyu geçici bir `String`'de (ör. kullanıcı girdisinden ya da `to_lowercase()`
  sonucundan) oluşturup sonuçları kullanmadan önce düşürebilir. Katı imzada bu kod `E0597` verirdi; doğru
  imzada derlenir. İyi imza, derleyicinin çağıranlara gereksiz kısıt koymasını engeller.
```

```flashcards
- front: TDD döngüsünün üç adımı nedir?
  back: Kırmızı (başarısız bir test yaz), yeşil (testi geçiren en basit kodu yaz), refactor (testler yeşilken kodu temizle).
- front: "`ara`'nın doğru imzası nedir?"
  back: "`pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>`"
- front: "`fn ara(sorgu: &str, icerik: &str) -> Vec<&str>` neden derlenmez?"
  back: "İki referans parametre var; derleyici dönen dilimlerin hangisinden ödünç alındığını bilemez (`E0106`)."
- front: "Rust'ta `\"\\` ile başlayan bir metin değişmezi ne işe yarar?"
  back: Satır sonundaki `\`, o satır sonunu ve sonraki satırın baştaki boşluklarını metinden çıkarır; metin satır sonuyla başlamaz.
- front: "`lines()` metodu Windows satır sonlarına (`\\r\\n`) ne yapar?"
  back: Hem `\n` hem `\r\n`'yi satır sonu olarak tanır ve satırlardan atar.
- front: "Duyarsız aramada `sonuclar.push(satir.to_lowercase().as_str())` neden derlenmez?"
  back: "Geçici bir `String`'e (fonksiyonun yerel verisine) dilim döndürülemez: `E0515`. Orijinal `satir` eklenmeli."
- front: "`\"İSTANBUL\".to_lowercase()` neden `\"istanbul\"`'u içermez?"
  back: "Dilden bağımsız Unicode kuralları `İ`'yi `i` + birleştirici üst nokta (U+0307) yapar; sonuç görünüşte benzer ama farklı bir metindir."
```
