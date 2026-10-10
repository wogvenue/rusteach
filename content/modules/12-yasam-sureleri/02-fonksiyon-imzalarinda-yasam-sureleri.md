---
id: m12-l02
title: Fonksiyonlarda yaşam süresi anotasyonları
minutes: 18
type: lesson
objectives:
  - E0106'nın neden çıktığını açıklayıp `en_uzun` gibi bir fonksiyona doğru yaşam süresi anotasyonlarını yazabilmek
  - "`fn f<'a>(x: &'a str, y: &'a str) -> &'a str` imzasını \"sonuç, girdilerden kısa yaşayanı kadar geçerlidir\" diye okuyabilmek"
  - Bir çağrının derlenip derlenmeyeceğini argümanların yaşam sürelerine bakarak tahmin edebilmek
  - Yalnızca sonucun gelebileceği parametrelere `'a` verip yerel değere referans döndürmenin neden hiçbir anotasyonla düzelmeyeceğini açıklayabilmek
keywords: [lifetime, "'a", E0106, E0621, E0515, en_uzun, longest, anotasyon]
---

İki metinden uzun olanını döndüren bir fonksiyon yazmak ne kadar zor olabilir? Python'da iki satır, C'de
dört satır. Rust'ta da dört satır... ama derleyici sana önce bir soru soracak. Bu derste o soruyu ve
cevabını, yani **yaşam süresi anotasyonlarını (lifetime annotations)** öğreneceksin. Rust'ta ilk kez
`'a` yazacaksın.

## Derleyici neden soruyor?

Bir hava durumu uygulamasında iki şehir adından uzun olanını başlığa koymak istiyoruz. İki `&str` alıp
birini geri veren bir fonksiyon yazalım. Tahmin et:

```compiles
code: |
  fn en_uzun(x: &str, y: &str) -> &str {
      if x.len() >= y.len() { x } else { y }
  }

  fn main() {
      println!("{}", en_uzun("Ankara", "Eskişehir"));
  }
answer: false
error: E0106
explanation: |
  Derlenmez: `missing lifetime specifier`. Dönen `&str` bir şeyden ödünç alınmış olmalı, ama imza
  **neden** ödünç alındığını söylemiyor: `x`'ten mi, `y`'den mi? Gövdeye bakınca cevap "çalışma
  zamanına göre ikisinden biri" ve derleyici gövdeye bakmaz bile. Sadece imzaya bakar.
```

:::error
```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:33
  |
1 | fn en_uzun(x: &str, y: &str) -> &str {
  |               ----     ----     ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but the signature does not say whether it is borrowed from `x` or `y`
help: consider introducing a named lifetime parameter
  |
1 | fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
  |           ++++     ++          ++          ++
```
`help` satırı sorunu tek cümlede özetliyor: "Dönüş tipi ödünç bir değer içeriyor, ama imza bunun `x`'ten
mi `y`'den mi ödünç alındığını söylemiyor." Hemen altında da çözüm önerisi var. Önerinin **ne anlama
geldiğini** bu derste öğreneceğiz.
:::

Derleyici neden gövdeye bakıp kendisi karar vermiyor? İki iyi sebebi var:

1. **Cevap çalışma zamanında belli oluyor.** `if` hangi dalın seçileceğini ancak program çalışınca bilir.
   Derleyici "her iki dal da mümkün" diye düşünmek zorunda.
2. **Yerel akıl yürütme (local reasoning).** Rust her fonksiyonu yalnızca **imzalarına** bakarak kontrol eder.
   `en_uzun`'u çağıran kod, gövdeyi değil sadece imzayı görür. Modül 3'te parametre tiplerinin neden
   zorunlu olduğunu konuşmuştuk: İmza bir **sözleşmedir**. Gövdeyi değiştirdiğinde çağıranların sessizce
   bozulmasını istemezsin.

C'de aynı fonksiyon sorunsuz derlenir:

```c
const char *en_uzun(const char *x, const char *y);
```

Ama C'de kritik bilgi, yani "dönen işaretçi `x` ya da `y`'dir, sonucu kullanırken ikisini de serbest bırakma"
bilgisi, en iyi ihtimalle bir **yorum satırında** yaşar. Kimse onu kontrol etmez. Rust bu bilgiyi **tip
sistemine** taşıyor. Yaşam süresi anotasyonu, derleyicinin okuyup denetleyebildiği bir belgedir.

## Sözdizimi: `'a` ile isim vermek

Yaşam süresi parametresinin adı bir kesme işaretiyle (`'`) başlar ve genellikle kısadır: `'a`, `'b`. İsim,
referans işaretinin (`&`) hemen arkasına yazılır:

```text
&i32          // referans (yaşam süresi derleyicide, adı yok)
&'a i32       // 'a yaşam süreli bir referans
&'a mut i32   // 'a yaşam süreli değiştirilebilir referans
```

Generic tip parametreleri gibi (Modül 11) yaşam süresi parametreleri de fonksiyon adından sonra köşeli
parantezde **tanımlanır**:

```rust
fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() { x } else { y }
}

fn main() {
    let sehir1 = String::from("Ankara");
    let sehir2 = "Eskişehir"; // literal: &'static str
    let baslik = en_uzun(&sehir1, sehir2);
    println!("Bugünün manşeti: {baslik}");
}
```

İmzayı yüksek sesle okumayı alışkanlık edin:

> "Herhangi bir `'a` yaşam süresi için: `x` ve `y`, en az `'a` kadar yaşayan iki dilimdir. Dönen dilim de
> `'a` kadar geçerlidir."

Dikkat et: `'a` tek başına bir anlam taşımaz. Anlamı, **aynı adın birden fazla yerde geçmesinden** doğar.
Üç yerde `'a` yazmak "bu üç referans birbirine bağlı" demektir. Tıpkı `fn f<T>(x: T, y: T)` yazmanın "x ve
y aynı tipte" demesi gibi.

:::analogy İki kitap, bir arkadaş
Kütüphaneden iki kitap aldın: biri 10 Mart'ta, diğeri 20 Mart'ta iade edilecek. Bir arkadaşın "ikisinden
birini bana ödünç ver" diyor, sen de hangisini vereceğini **son anda** seçeceksin. Arkadaşına güvenle
söyleyebileceğin tek iade tarihi hangisi? **10 Mart**, yani erken olanı. Hangi kitabı alırsa alsın, o
tarihte geri getirirse kimse ceza yemez.

`en_uzun`'un imzası tam olarak bunu söylüyor: Sonuç `x` de olabilir `y` de. Bu yüzden ikisinin **ortak**
geçerlilik dönemi kadar, yani kısa olanı kadar güvenilirdir.
:::

Bu fonksiyonla Modül 9'dan bir şeyi de hatırla. Tahmin et:

```predict
code: |
  fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
      if x.len() >= y.len() { x } else { y }
  }

  fn main() {
      println!("{}", en_uzun("Ankara", "Iğdır"));
  }
options:
  - "Ankara"
  - "Iğdır"
  - "Derlenmez: literaller farklı yaşam sürelerine sahip"
answer: 1
explanation: |
  `len()` karakter değil **bayt** sayar (Modül 9). "Ankara" 6 bayt. "Iğdır" ise 5 karakter ama
  `I`(1) + `ğ`(2) + `d`(1) + `ı`(2) + `r`(1) = **7** bayt. Bu yüzden "en uzun" Iğdır çıkıyor.
  Karakter sayısına göre karşılaştırmak isteseydin `x.chars().count()` kullanırdın.

  Derlenmeme seçeneğine gelince: İki literal de `&'static str` ve ikisi de program boyunca yaşıyor.
  Ortak bir `'a` bulmak hiç zor değil.
```

## Anlamı: kısa olan belirler

Fonksiyonu çağırdığında derleyici `'a` için **somut** bir bölge seçer. Seçtiği bölge, iki argümanın da geçerli
olduğu bölgedir, yani ikisinin **kesişimi**. Pratikte bu, kısa yaşayan argümanın ömrü demektir. Sonuç bu
bölgenin dışında kullanılmadığı sürece her şey yolundadır:

```rust
fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() { x } else { y }
}

fn main() {
    let birinci = String::from("Kahramanmaraş");
    {
        let ikinci = String::from("Van");
        let sonuc = en_uzun(&birinci, &ikinci); // 'a = ikinci'nin ömrü (kısa olan)
        println!("İç blokta: {sonuc}"); // sonuc 'a içinde kullanılıyor: sorun yok
    }
}
```

Şimdi sonucu iç bloğun **dışında** kullanalım. Dikkat: Dönecek değer aslında uzun yaşayan `birinci`.
"Kahramanmaraş" kesinlikle "Van"dan uzun. Tahmin et:

```compiles
code: |
  fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
      if x.len() >= y.len() { x } else { y }
  }

  fn main() {
      let birinci = String::from("Kahramanmaraş");
      let sonuc;
      {
          let ikinci = String::from("Van");
          sonuc = en_uzun(&birinci, &ikinci);
      }
      println!("{sonuc}");
  }
answer: false
error: E0597
explanation: |
  Derlenmez! Çalışma zamanında `sonuc`'un `birinci`'yi göstereceği belli olsa bile derleyici
  **değerlere değil imzaya** bakar. İmza "sonuç, `x` ve `y`'nin ortak süresi kadar geçerli" diyor.
  Ortak süre `ikinci`'nin ömrüyle sınırlı ve `ikinci` iç blokta ölüyor. `println!` ise bloğun dışında.
```

:::error
```text
error[E0597]: `ikinci` does not live long enough
  --> src/main.rs:10:35
   |
 9 |         let ikinci = String::from("Van");
   |             ------ binding `ikinci` declared here
10 |         sonuc = en_uzun(&birinci, &ikinci);
   |                                   ^^^^^^^ borrowed value does not live long enough
11 |     }
   |     - `ikinci` dropped here while still borrowed
12 |     println!("{sonuc}");
   |                ----- borrow later used here
```
Hata `en_uzun`'un içinde değil, **çağrı yerinde** çıkıyor. İmzadaki `'a` sözleşmesi çağıranın
sorumluluğunu tanımlıyor: "`sonuc`'u kullandığın sürece iki argüman da yaşamalı." `main` bu sözleşmeyi
bozduğu için hata `main`'de.
:::

Bu, Rust'ın **muhafazakâr (conservative)** davranışıdır: Güvenli olduğunu kanıtlayamadığı programı
reddeder. Bazen gerçekte güvenli olan bir programı da reddeder. Karşılığında ise derleyicinin kabul
ettiği her program **kesinlikle** güvenlidir.

```quiz
question: |
  `fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str` için `en_uzun(&kisa_omurlu, &uzun_omurlu)`
  çağrısının sonucu **en fazla** ne kadar kullanılabilir?
options:
  - "`uzun_omurlu` yaşadığı sürece"
  - "`kisa_omurlu` yaşadığı sürece, yani iki argümandan kısa yaşayanı kadar"
  - "Sonsuza kadar, çünkü dönen değer yeni bir referans"
  - "Hangi argümanın döndüğüne bağlı; çalışma zamanında belli olur"
answer: 1
explanation: |
  Aynı `'a` her iki parametreye de verildiği için derleyici `'a`'yı **iki argümanın da geçerli olduğu**
  bölge olarak seçer. Bu da kısa yaşayanın ömrüdür. Hangi argümanın gerçekten döndüğü önemsizdir:
  Kontrol derleme zamanında ve yalnızca imzayla yapılır.
feedback:
  - "Sonuç `kisa_omurlu`'yu da gösterebilir. Ona güvenmek sarkmaya yol açabilirdi."
  - "Doğru! Ortak süre, kısa olanın süresidir."
  - "Dönen referans yeni bir değer değil; girdilerden birine bakıyor."
  - "Borrow checker çalışma zamanını bilemez; hep en kötü ihtimali, yani kısa olanı varsayar."
```

:::info Uzun yaşayan, kısa bekleyen yere sığar
Yukarıdaki ilk örnekte `en_uzun(&sehir1, sehir2)` çağrısında `sehir2` bir `&'static str` idi, yani program
sonuna kadar yaşıyordu. `sehir1`'in ödüncü ise çok daha kısa. Yine de derlendi. Çünkü "en az `'a` kadar
yaşamalı" şartını, `'a`'dan **uzun** yaşayan her referans zaten karşılar. Derleyici uzun yaşam süresini
gerektiği kadar "kısaltarak" düşünür.
:::

## Hangi parametre `'a` almalı?

Sonucun gelebileceği parametrelere `'a` ver, diğerlerine **verme**. Bir e-ticaret sitesinde ürün adını,
kategorisini log'a yazarak döndüren bir fonksiyon düşün. Sonuç her zaman `urun`'dan gelir. `kategori` ise
sadece okunur:

```rust
fn etiketle<'a>(urun: &'a str, kategori: &str) -> &'a str {
    println!("[{kategori}] {urun}");
    urun
}

fn main() {
    let urun = String::from("Türk kahvesi 250 g");
    let secilen;
    {
        let kategori = String::from("içecek"); // kısa ömürlü
        secilen = etiketle(&urun, &kategori);
    } // kategori öldü, ama secilen ona bağlı değil
    println!("Sepete eklendi: {secilen}");
}
```

`kategori`'ye `'a` vermediğimiz için çağıran, kısa ömürlü bir kategori verebiliyor. İki parametreyi de `'a`'ya
bağlasaydık bu program **derlenmezdi**: Gereksiz bir ilişki tarif etmiş olurduk. İyi bir imza çağırana
olabildiğince fazla özgürlük tanır.

Peki `'a` vermediğin bir parametreyi döndürmeye kalkarsan? Derleyici bunu da yakalar:

:::error
```text
error[E0621]: explicit lifetime required in the type of `y`
 --> src/main.rs:2:23
  |
2 |     if x.is_empty() { y } else { x }
  |                       ^ lifetime `'a` required
  |
help: add explicit lifetime `'a` to the type of `y`
  |
1 | fn ilki<'a>(x: &'a str, y: &'a str) -> &'a str {
  |                             ++
```
Bu hata `fn ilki<'a>(x: &'a str, y: &str) -> &'a str` gibi bir imzada çıkar. Gövde `y`'yi döndürüyor, ama
imza "sonuç sadece `x`'e bağlı" diye söz vermiş. Derleyici sözle gövdenin çeliştiğini gösteriyor. Çözüm,
gövdeye uyacak şekilde `y`'ye de `'a` vermek. Bu sefer derleyici gövdeye bakıyor, çünkü gövdenin imzaya
**uyup uymadığını** kontrol ediyor.
:::

Yani kontrol iki yönlüdür: **Gövde** imzadaki sözü tutmak zorundadır, **çağıran** da imzadaki şartı.
İkisi de sadece imzaya bakarak, birbirinden bağımsız kontrol edilir.

```fill
prompt: "`kisalt`, `metin` çok uzunsa onun bir **parçasını**, değilse `metin`'in kendisini döndürüyor. `sinir_isareti` sadece yazdırılıyor. Yaşam süresi anotasyonlarını, çağıranı gereksiz kısıtlamayacak şekilde yaz."
code: |
  fn kisalt<___0>(metin: ___1, sinir: usize, sinir_isareti: &str) -> ___2 {
      if metin.len() <= sinir {
          metin
      } else {
          println!("{sinir_isareti} kısaltıldı");
          &metin[..sinir]
      }
  }

  fn main() {
      let yorum = String::from("Kargo hizli geldi, urun harika");
      let ozet;
      {
          let isaret = String::from("[!]");
          ozet = kisalt(&yorum, 11, &isaret);
      }
      println!("{ozet}...");
  }
blanks:
  - ["'a"]
  - ["&'a str"]
  - ["&'a str"]
output: |
  [!] kısaltıldı
  Kargo hizli...
explanation: |
  Dönen değer ya `metin`'in kendisi ya da `&metin[..sinir]` dilimi. İkisi de `metin`'in baytlarına bakıyor.
  Bu yüzden yalnızca `metin` ile dönüş tipi aynı `'a`'yı paylaşıyor. `sinir_isareti`'ne `'a` vermedik:
  `main`'deki `isaret` iç blokta ölüyor ve `ozet` bloğun dışında kullanılıyor. `sinir_isareti: &'a str`
  yazsaydın bu program E0597 ile reddedilirdi.

  (Örnekte bilerek ASCII metin kullandık: `&metin[..sinir]` **bayt** dilimler ve Türkçe bir harfin
  ortasına denk gelirse panik verir. Modül 5'i hatırla.)
```

## Yerel değere referans: hiçbir anotasyon kurtaramaz

Bir müşteriye selam metni hazırlayan bir fonksiyon yazalım. Yeni öğrendiğimiz `'a`'yı da ekleyelim,
belki işe yarar:

```compiles
code: |
  fn selam<'a>(isim: &'a str) -> &'a str {
      let sonuc = format!("Merhaba, {isim}!");
      &sonuc
  }

  fn main() {
      println!("{}", selam("Zeynep"));
  }
answer: false
error: E0515
explanation: |
  `sonuc` fonksiyonun içinde doğan yerel bir `String`. Fonksiyon dönünce ölür. Ona bakan bir referans
  her durumda sarkardı. İmzadaki `'a` bunu değiştiremez: `'a` çağıran tarafından seçilen ve
  fonksiyonun **dışında** yaşayan bir bölgedir. Yerel bir değer ise hiçbir zaman fonksiyonun dışına
  kadar yaşamaz.
```

:::error
```text
error[E0515]: cannot return reference to local variable `sonuc`
 --> src/main.rs:3:5
  |
3 |     &sonuc
  |     ^^^^^^ returns a reference to data owned by the current function
```
"Mevcut fonksiyonun **sahip olduğu** veriye referans döndürüyorsun." Önceki derste öğrendiğimiz gibi
anotasyonlar tanımlayıcıdır: `'a` yazmak `sonuc`'un ömrünü uzatamaz.
:::

Kural basit: **Dönen bir referans, ancak parametrelerden birinden (ya da program boyunca yaşayan bir
veriden) türetilebilir.** Fonksiyonun içinde **üretilen** veri için tek doğru yol, sahipliği dışarı vermektir.
Modül 5'teki strateji aynen geçerli:

```rust
fn selam(isim: &str) -> String {
    format!("Merhaba, {isim}!") // yeni String'in sahipliği çağırana geçer
}

fn main() {
    let musteri = String::from("Zeynep");
    let mesaj = selam(&musteri);
    println!("{mesaj}");
}
```

```quiz
question: "Aşağıdaki imzalardan hangisinin gövdesi, `metin`'in **büyük harfli bir kopyasını** döndürecek şekilde yazılabilir?"
options:
  - "`fn buyut<'a>(metin: &'a str) -> &'a str`"
  - "`fn buyut(metin: &str) -> String`"
  - "`fn buyut<'a>(metin: &str) -> &'a str`"
answer: 1
explanation: |
  Büyük harfli kopya **yeni** bir metindir (`to_uppercase()` yeni bir `String` üretir). Yeni üretilen
  veri fonksiyonun içinde doğar. Ona referans döndürmek her zaman E0515 olur. Doğru tasarım sahipliği
  vermektir: `-> String`. İlk seçenek ancak `metin`'in kendisini ya da bir parçasını döndürebilir.
  Üçüncüsü ise `metin`'le hiç bağlantısı olmayan bir `'a` vaat ediyor. Böyle bir referansı ancak program
  boyunca yaşayan bir veriden (ör. bir literalden) üretebilirsin.
feedback:
  - "`'a`, `metin`'in **kendi** baytlarına bağlı. Yeni üretilen bir String'e bağlanamaz."
  - "Doğru! Yeni üretilen veri için sahipliği dışarı ver."
  - "Bu imza dönen referansı `metin`'den koparıyor. Yeni bir String'e bakan referansı yine döndüremezsin."
```

## Alıştırmalar

İlkinde imza derlenmiyor. Onu düzeltip gövdeyi de yazacaksın.

```exercise
id: m12-e-gorunen-ad
title: Forumda görünen ad
difficulty: 2
prompt: |
  Bir forum sitesinde her kullanıcının bir **takma adı** ve bir **gerçek adı** var. Ekranda takma ad
  gösterilir. Ama takma ad boşsa ya da yalnızca boşluklardan oluşuyorsa gerçek ad kullanılır. Her iki
  durumda da baştaki ve sondaki boşluklar atılmalı (`trim`).

  Başlangıç kodundaki imza **E0106** veriyor. İmzaya yaşam süresi anotasyonlarını ekle ve gövdeyi yaz.
  Sonuç, iki girdiden birine bakan bir dilim olmalı (yeni `String` üretme).
starter: |
  fn gorunen_ad(takma_ad: &str, gercek_ad: &str) -> &str {
      todo!()
  }

  fn main() {
      println!("{}", gorunen_ad("  ferris42 ", "Ferris Yengeç"));
      println!("{}", gorunen_ad("   ", "Ayşe Demir"));
  }
starter_compiles: false
solution: |
  fn gorunen_ad<'a>(takma_ad: &'a str, gercek_ad: &'a str) -> &'a str {
      let takma = takma_ad.trim();
      if takma.is_empty() {
          gercek_ad.trim()
      } else {
          takma
      }
  }

  fn main() {
      println!("{}", gorunen_ad("  ferris42 ", "Ferris Yengeç"));
      println!("{}", gorunen_ad("   ", "Ayşe Demir"));
  }
check: tests
tests: |
  #[test]
  fn takma_ad_varsa_onu_kullanir() {
      assert_eq!(gorunen_ad("ferris42", "Ferris Yengeç"), "ferris42");
  }

  #[test]
  fn bosluklari_atar() {
      assert_eq!(gorunen_ad("  ferris42 ", "Ferris"), "ferris42", "takma adın kenar boşlukları atılmalı");
      assert_eq!(gorunen_ad("", "  Ayşe Demir "), "Ayşe Demir", "gerçek adın kenar boşlukları da atılmalı");
  }

  #[test]
  fn sadece_bosluksa_gercek_ad() {
      assert_eq!(gorunen_ad("    ", "Ayşe Demir"), "Ayşe Demir", "sadece boşluktan oluşan takma ad boş sayılmalı");
  }

  #[test]
  fn iki_farkli_kaynaktan_calisir() {
      let takma = String::from("kodcu_kedi");
      let gercek = String::from("Elif Kaya");
      let ad = gorunen_ad(&takma, &gercek);
      assert_eq!(ad, "kodcu_kedi");
  }
hints:
  - "Sonuç iki parametreden birinden gelebilir. İkisi de dönüş tipiyle aynı yaşam süresini paylaşmalı: `fn gorunen_ad<'a>(...)`."
  - "İmza: `fn gorunen_ad<'a>(takma_ad: &'a str, gercek_ad: &'a str) -> &'a str`. `trim()` de girdiyle aynı yaşam süreli bir dilim döndürür."
  - "Önce `let takma = takma_ad.trim();` yaz. `takma.is_empty()` ise `gercek_ad.trim()` döndür, değilse `takma`."
require:
  - pattern: "<\\s*'[a-z_]+\\s*>"
    message: "İmzaya bir yaşam süresi parametresi (ör. `<'a>`) eklemelisin."
explanation: |
  Sonuç, çalışma zamanına göre ya `takma_ad`'dan ya `gercek_ad`'dan geliyor. Bu yüzden ikisi de dönüş
  tipiyle aynı `'a`'yı paylaşmak zorunda. Durum tıpkı `en_uzun` gibi.

  `trim()` neden sorun çıkarmadı? Çünkü `trim` yeni bir metin üretmez. Girdinin baytlarına bakan daha
  kısa bir **dilim** döndürür ve imzası kabaca `fn trim(&'a self) -> &'a str` şeklindedir. Yani
  `takma_ad.trim()` de `'a` yaşam sürelidir. Kopya yok, ayırma (allocation) yok.

  Alternatif: `if takma_ad.trim().is_empty() { ... }` gibi `trim`'i iki kez çağırmak da çalışır, ama
  sonucu bir değişkene koymak hem okunaklı hem de tekrarsızdır.
```

İkincisinde imza zaten derleniyor, ama çağıranı **gereksiz yere kısıtlıyor**. Bunu bir test ortaya çıkaracak.

```exercise
id: m12-e-etiket-degeri
title: Kimlik kartından alan okumak
difficulty: 3
prompt: |
  Bir okul sistemi, öğrenci bilgilerini `"Ad: Ayşe"`, `"Şehir: İzmir"` gibi satırlarla tutuyor.
  `etiket_degeri(satir, etiket)` fonksiyonunu yaz:

  - Satırı **ilk** `:` karakterinden ikiye böl (`split_once`, Modül 7). İki nokta yoksa `None`.
  - Soldaki parça (kenar boşlukları atılmış hâliyle) `etiket`'e eşitse sağdaki parçayı kenar boşluklarını
    atarak `Some(...)` ile döndür. Değilse `None`.
  - Sonuç, `satir`'in içine bakan bir dilim olmalı.

  **Dikkat:** Başlangıç imzası `etiket`'i de `'a`'ya bağlıyor. Testlerden biri etiketi kısa ömürlü bir
  `String`'den veriyor ve sonucu etiket öldükten sonra kullanıyor. İmzayı da düzeltmen gerekecek.
starter: |
  fn etiket_degeri<'a>(satir: &'a str, etiket: &'a str) -> Option<&'a str> {
      todo!()
  }

  fn main() {
      println!("{:?}", etiket_degeri("Ad: Ayşe", "Ad"));
      println!("{:?}", etiket_degeri("Soyad: Yılmaz", "Ad"));
  }
solution: |
  fn etiket_degeri<'a>(satir: &'a str, etiket: &str) -> Option<&'a str> {
      let (anahtar, deger) = satir.split_once(':')?;
      if anahtar.trim() == etiket {
          Some(deger.trim())
      } else {
          None
      }
  }

  fn main() {
      println!("{:?}", etiket_degeri("Ad: Ayşe", "Ad"));
      println!("{:?}", etiket_degeri("Soyad: Yılmaz", "Ad"));
  }
check: tests
tests: |
  #[test]
  fn eslesen_etiket() {
      assert_eq!(etiket_degeri("Ad: Ayşe", "Ad"), Some("Ayşe"));
      assert_eq!(etiket_degeri("  Şehir :İzmir  ", "Şehir"), Some("İzmir"), "iki taraftaki boşluklar atılmalı");
  }

  #[test]
  fn farkli_etiket_none() {
      assert_eq!(etiket_degeri("Soyad: Yılmaz", "Ad"), None, "\"Soyad\" ile \"Ad\" aynı etiket değil");
  }

  #[test]
  fn iki_nokta_yoksa_none() {
      assert_eq!(etiket_degeri("Notlar", "Notlar"), None, "':' yoksa alan okunamaz");
  }

  #[test]
  fn ilk_iki_noktadan_boler() {
      assert_eq!(etiket_degeri("Saat: 10:30", "Saat"), Some("10:30"), "değerin içindeki ':' korunmalı");
  }

  #[test]
  fn etiket_olduktan_sonra_da_gecerli() {
      let satir = String::from("Ders: Fizik");
      let sonuc;
      {
          let etiket = String::from("Ders");
          sonuc = etiket_degeri(&satir, &etiket);
      }
      assert_eq!(sonuc, Some("Fizik"), "sonuç yalnızca satıra bağlı olmalı, etikete değil");
  }
hints:
  - "Son test derlenmiyorsa sorun gövdede değil **imzada**. Sonuç hangi parametreden gelebilir? Yalnızca o parametre `'a` almalı."
  - "İmza: `fn etiket_degeri<'a>(satir: &'a str, etiket: &str) -> Option<&'a str>`. Gövdede `let (anahtar, deger) = satir.split_once(':')?;` ile başlayabilirsin (`?` Option'da da çalışır, Modül 10)."
  - "`if anahtar.trim() == etiket { Some(deger.trim()) } else { None }`"
explanation: |
  Sonuç her zaman `satir`'in bir parçası. `etiket` ise sadece **karşılaştırma** için okunuyor. Bu yüzden
  yalnızca `satir` ve dönüş tipi `'a`'yı paylaşıyor. Başlangıçtaki imza da güvenliydi ama gereğinden
  fazlasını istiyordu: "Sonucu kullandığın sürece etiket de yaşamalı." Son test bu gereksiz şartı yakaladı.

  Genel ilke: **Bir imzadaki her `'a`, çağırana bir yükümlülüktür.** Sadece gerçekten var olan
  ilişkileri yaz. Gerçek kütüphanelerde de böyledir. Örneğin standart kütüphanedeki `str::split_once`'ın
  imzasında sonuç yalnızca `self`'e bağlıdır, ayraca değil.

  `?` operatörünün `Option` üzerinde de çalıştığını Modül 10'dan hatırla: `split_once` `None` dönerse
  fonksiyon hemen `None` döndürür. Alternatif olarak `let Some((anahtar, deger)) = satir.split_once(':') else { return None; };`
  (Modül 7'deki `let else`) de aynı işi görür.
```

## Özet

:::remember
- Referans döndüren ve birden fazla referans parametresi olan bir fonksiyonda derleyici **sonucun kimden ödünç alındığını** sorar (E0106).
- Sözdizimi: `fn f<'a>(x: &'a str, y: &'a str) -> &'a str`. Parametre `<'a>` ile tanımlanır, `&'a T` ile kullanılır.
- Aynı `'a`'yı paylaşan referanslar birbirine bağlıdır. Sonuç, bu girdilerden **kısa yaşayanı kadar** geçerlidir.
- Kontrol sadece imzayla yapılır: Gövde imzaya uymalı (E0621), çağıran da imzanın şartına (E0597).
- Yalnızca sonucun gelebileceği parametrelere `'a` ver. Fazlası çağıranı gereksiz kısıtlar.
- Yerel bir değere referans döndürmeyi hiçbir anotasyon düzeltemez (E0515). Sahipli değer döndür.
:::

```reflect
prompt: |
  Derleyici `en_uzun`'un gövdesine bakıp "sonuç `x` ya da `y`" sonucuna kendisi varabilirdi. Rust
  tasarımcıları neden bunun yerine imzada açık anotasyon istemeyi seçmiş olabilir? En az iki sebep yaz.
answer: |
  Model cevap: Birincisi, hangi referansın döneceği çoğu zaman çalışma zamanında belli olur. Derleyici
  zaten en kötü durumu varsaymak zorunda. İkincisi ve daha önemlisi, imza bir **sözleşmedir**: Çağıran kod
  sadece imzaya bakarak kontrol edilir. Gövdeden çıkarım yapılsaydı, fonksiyonun içini değiştirmek (ör.
  bir gün `y` yerine her zaman `x` döndürmek) çağıranları sessizce bozabilir ya da düzeltebilirdi. API'nin
  davranışı belgelenmemiş olurdu. Açık anotasyon ilişkiyi belgeler, derlemeyi hızlı ve yerel tutar,
  hata mesajlarını da doğru yere (çağrıya ya da gövdeye) yönlendirir.
```

```flashcards
- front: "E0106 (*missing lifetime specifier*) bir fonksiyon imzasında ne zaman çıkar?"
  back: "Dönüş tipinde bir referans olup imzadan bunun hangi girdiden ödünç alındığı anlaşılamadığında (ör. iki `&str` parametre, bir `&str` dönüş)."
- front: "`fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str` imzası çağırana ne söyler?"
  back: "Sonuç, `x` ve `y`'nin **ikisinin de** geçerli olduğu süre kadar, yani kısa yaşayanı kadar kullanılabilir."
- front: "Yaşam süresi parametresi nerede tanımlanır, nerede kullanılır?"
  back: "Fonksiyon adından sonra `<'a>` ile tanımlanır. Referans tiplerinde `&'a T` / `&'a mut T` olarak kullanılır."
- front: "E0621 (*explicit lifetime required in the type of `y`*) ne anlatır?"
  back: "Gövde, imzada `'a` verilmemiş bir parametreyi (`y`) döndürüyor. İmzanın sözü ile gövde çelişiyor."
- front: "`fn f<'a>(x: &'a str) -> &'a str` gövdesinde `let s = String::from(\"..\"); &s` döndürülebilir mi?"
  back: "Hayır, E0515. Yerel değer fonksiyon bitince ölür. Anotasyon ömrü uzatamaz; `String` döndürmek gerekir."
- front: Bir parametreye gereksiz yere `'a` vermenin zararı nedir?
  back: "Çağıranı kısıtlar: Sonucu kullandığı sürece o argümanı da yaşatmak zorunda kalır. Gerçekte güvenli programlar reddedilebilir."
- front: "Borrow checker, `en_uzun`'un çalışma zamanında hangi argümanı döndüreceğini hesaba katar mı?"
  back: "Hayır. Sadece imzaya bakar ve en kötü durumu varsayar. Bu yüzden muhafazakârdır: Kabul ettiği her program güvenlidir."
```
