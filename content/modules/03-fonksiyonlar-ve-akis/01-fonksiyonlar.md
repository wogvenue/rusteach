---
id: m03-l01
title: Fonksiyonlar
minutes: 18
type: lesson
objectives:
  - Parametreli ve dönüş değerli bir fonksiyonu doğru imzayla tanımlayıp çağırabilmek
  - Her çağrının kendi stack çerçevesini aldığını ve argümanların parametrelere kopyalandığını açıklayabilmek
  - "Eksik parametre tipi, yanlış argüman sayısı (`E0061`) ve dönüş tipi uyuşmazlığı (`E0308`) hatalarını okuyup düzeltebilmek"
  - Rust'ın fonksiyon imzalarında tipleri neden zorunlu tuttuğunu açıklayabilmek
keywords: [fn, fonksiyon, parametre, argüman, dönüş tipi, imza, snake_case, E0061, E0308]
---

Şimdiye kadar yazdığın her program tek bir fonksiyondan ibaretti: `main`. Küçük programlar için sorun
değil; ama gerçek bir uygulama binlerce satırdır. Hepsini tek bir `main`'e yığmak, bütün eşyalarını tek
bir dev çekmeceye atmaya benzer: Bir şey aradığında her şeyi karıştırman gerekir.

**Fonksiyonlar (functions)** kodu isimlendirilmiş, tekrar kullanılabilir ve tek başına anlaşılabilir
parçalara böler. Bu derste kendi fonksiyonlarını yazmayı, onlara veri göndermeyi, onlardan sonuç almayı
ve Rust'ın fonksiyon **imzalarına (signature)** neden bu kadar önem verdiğini öğreneceksin.

:::ferris
Fark ettin mi? İlk günden beri zaten fonksiyon yazıyorsun: `fn main()` de bir fonksiyon! Şimdi ona
arkadaşlar ekleme zamanı. 🦀
:::

## İlk fonksiyonun

Bir fonksiyon `fn` anahtar kelimesiyle tanımlanır. Ardından **isim**, parantez içinde **parametreler**
(şimdilik boş) ve süslü parantezler içinde **gövde (body)** gelir:

```rust
fn main() {
    println!("Program başladı.");
    selam_ver();
    selam_ver();
    println!("Program bitti.");
}

fn selam_ver() {
    println!("Merhaba! Rust dünyasına hoş geldin.");
}
```

`selam_ver();` satırı bir **fonksiyon çağrısıdır (function call)**: Program o anda `selam_ver`'in
gövdesine atlar, oradaki satırları çalıştırır ve bitince **kaldığı yere geri döner**. Aynı fonksiyonu
istediğin kadar çağırabilirsin — kodu bir kez yazar, defalarca kullanırsın.

Dikkat ettiysen `selam_ver`'i `main`'den **sonra** tanımladık ve program yine de çalıştı. Rust'ta tanım
sırası önemli değildir: Derleyici önce dosyanın tamamını okur, sonra çağrıları tanımlarla eşleştirir.

| Dil | Bir fonksiyonu, dosyada tanımından önce çağırabilir misin? |
|---|---|
| C | Hayır — önce bir **bildirim (prototype)** yazman gerekir |
| Python | Hayır — `def` satırı çalışmadan çağırırsan `NameError` alırsın |
| Rust | **Evet** — derleyici tüm dosyayı birlikte görür |

:::analogy Tarif kartları
Fonksiyon, mutfaktaki bir **tarif kartı** gibidir. Kartı bir kez yazarsın (**tanım**); sonra "mercimek
çorbası yap" dediğin her seferde (**çağrı**) aşçı kartı açar, adımları uygular ve işi bitince kaldığı
yere döner. Kartların çekmecede hangi sırayla durduğu önemli değildir — önemli olan doğru kartın adını
söylemektir.
:::

```predict
question: Bu program hangi sırayla yazdırır?
code: |
  fn main() {
      println!("1");
      ara();
      println!("4");
  }

  fn ara() {
      println!("2");
      ic();
  }

  fn ic() {
      println!("3");
  }
options:
  - |
    1
    2
    3
    4
  - |
    1
    4
    2
    3
  - "Derlenmez: ara ve ic, main'den sonra tanımlanmış"
answer: 0
explanation: |
  Her çağrı, çağrılan fonksiyonun gövdesine atlar; fonksiyon bitince **çağrının yapıldığı yere** dönülür.
  `main` → `ara` → `ic` zinciri kurulur: `ic` "3"ü yazıp `ara`'ya döner, `ara` biter ve `main`'e dönülür,
  en son "4" yazılır. Tanım sırası önemli olmadığı için program sorunsuz derlenir.
```

## Parametreler: fonksiyona veri göndermek

Bir fonksiyon çoğu zaman bir veriyle çalışır. Bu veriyi **parametreler (parameters)** aracılığıyla alır:

```rust
fn main() {
    kare_yazdir(4);
    kare_yazdir(-7);
}

fn kare_yazdir(x: i32) {
    let kare = x * x;
    println!("{x} sayısının karesi {kare}");
}
```

- `x: i32` bir **parametredir**: Tanımda "buraya bir `i32` gelecek, ona `x` diyeceğim" demektir.
- `kare_yazdir(4)` çağrısındaki `4` ise bir **argümandır (argument)**: Çağrı anında verilen somut değer.

Birden fazla parametre virgülle ayrılır ve **her birinin kendi tipi** olmalıdır. Argümanlar
parametrelere **sırayla** eşlenir: İlk argüman ilk parametreye, ikincisi ikinciye...

```rust
fn main() {
    ogrenci_karti(1042, 3.27, true);
}

fn ogrenci_karti(numara: u32, ortalama: f64, burslu: bool) {
    println!("Öğrenci no : {numara}");
    println!("Ortalama   : {ortalama:.2}");
    println!("Burslu mu? : {burslu}");
}
```

Tipi yazmayı unutursan derleyici hemen durdurur:

:::error
```text
error: expected one of `:`, `@`, or `|`, found `)`
 --> src/main.rs:5:17
  |
5 | fn kare_yazdir(x) {
  |                 ^ expected one of `:`, `@`, or `|`
  |
help: if this is a parameter name, give it a type
  |
5 | fn kare_yazdir(x: TypeName) {
  |                 ++++++++++
help: if this is a type, explicitly ignore the parameter name
  |
5 | fn kare_yazdir(_: x) {
  |                ++
```
Derleyici `x`'ten sonra bir `:` ve bir tip bekliyordu. İlk **help** satırı çözümü söylüyor: `x: i32` gibi
bir tip ekle. İkinci öneri ise `x`'in bir **tip adı** olabileceğini düşünüyor (`_: x`); burada işimize
yaramaz. Derleyicinin önerileri birer tahmindir: Hangisinin niyetine uyduğunu sen seçersin. `let` ile
değişken tanımlarken tipi kendisi çıkaran Rust, fonksiyon parametrelerinde **asla** tahmin yürütmez —
nedenini birazdan göreceğiz.
:::

### Parametre bir kopyadır

Şimdiye kadar kullandığımız tipler (`i32`, `f64`, `bool`, `char`...) fonksiyona verildiğinde
**kopyalanır**: Parametre, argümanın bir kopyasını alır. Fonksiyon içinde parametreyi değiştirmek
istersen onu `mut` ile işaretlemelisin — tıpkı `let mut` gibi. Bu `mut`, fonksiyonun **kendi** yerel
değişkenine aittir; imzanın dışarıya verdiği sözün parçası değildir ve çağıranı hiç ilgilendirmez.
Peki parametredeki değişiklik çağıranı etkiler mi?

```predict
code: |
  fn ikiye_katla(mut x: i32) {
      x *= 2;
      println!("fonksiyon içinde: {x}");
  }

  fn main() {
      let sayi = 10;
      ikiye_katla(sayi);
      println!("main içinde: {sayi}");
  }
options:
  - |
    fonksiyon içinde: 20
    main içinde: 20
  - |
    fonksiyon içinde: 20
    main içinde: 10
  - "Derlenmez: sayi değişkeni mut değil"
answer: 1
explanation: |
  `ikiye_katla(sayi)` çağrısı `sayi` değişkeninin **değerini** (10) `x` parametresine kopyalar. `x` artık
  `ikiye_katla`'nın kendi değişkenidir; onu 20 yapmak `main`'deki `sayi` değişkenine dokunmaz. `sayi` değişkeninin
  `mut` olmasına da gerek yok, çünkü o hiç değişmiyor — değişen, fonksiyonun kendi kopyası `x`.
```

Aşağıdaki diyagram, çağrı sırasında belleğin **stack** bölgesinde neler olduğunu adım adım gösteriyor:

```memory
title: ikiye_katla(sayi) çağrısı adım adım
steps:
  - caption: "`main` çalışıyor. Stack'te `main`'in **çerçevesi (frame)** var; içinde `sayi` duruyor."
    stack:
      - frame: main
        vars:
          - { name: sayi, type: i32, value: "10" }
  - caption: "Çağrı anı: `ikiye_katla` için **yeni bir çerçeve** açılır. `x`, `sayi` değerinin bir **kopyasıdır**."
    stack:
      - frame: main
        vars:
          - { name: sayi, type: i32, value: "10" }
      - frame: ikiye_katla
        vars:
          - { name: x, type: i32, value: "10", mut: true }
  - caption: "`x *= 2;` yalnızca kendi çerçevesindeki `x`'i değiştirir. `sayi` hâlâ 10."
    stack:
      - frame: main
        vars:
          - { name: sayi, type: i32, value: "10" }
      - frame: ikiye_katla
        vars:
          - { name: x, type: i32, value: "20", mut: true, note: değişti }
  - caption: "Fonksiyon bitti: Çerçevesi stack'ten kaldırıldı, `x` artık yok. `main` kaldığı yerden devam eder."
    stack:
      - frame: main
        vars:
          - { name: sayi, type: i32, value: "10" }
```

Her çağrının yığının tepesine bir çerçeve eklediği, fonksiyon bitince de o çerçevenin kaldırıldığı bu
yapıya **çağrı yığını (call stack)** denir. Stack'i Modül 4'te derinlemesine inceleyeceğiz. Orada şu
sorunun cevabını da bulacaksın: `String` gibi heap'te yaşayan büyük değerler fonksiyona verilince de
kopyalanır mı? (Spoiler: Hayır, **taşınırlar**.)

## Dönüş değeri: fonksiyondan sonuç almak

Fonksiyonlar yalnızca iş yapmakla kalmaz, bir **sonuç** da üretebilir:

```rust
fn topla(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    let sonuc = topla(20, 22);
    println!("20 + 22 = {sonuc}");
    println!("İç içe: {}", topla(topla(1, 2), topla(3, 4)));
}
```

- `-> i32` **dönüş tipidir (return type)**: "Bu fonksiyon geriye bir `i32` verir."
- Gövdenin son satırındaki `a + b`'nin sonunda **noktalı virgül yok**. Bu bir yazım hatası değil: Rust'ta
  gövdenin son ifadesi fonksiyonun **dönüş değeridir**. Bu kuralın arkasındaki fikri bir sonraki derste
  derinlemesine göreceksin.
- `return a + b;` da yazabilirsin, ama Rust'ta alışkanlık, sondaki değer için `return` yazmamaktır.
  `return`'ü erken çıkışlar için saklarız (sonraki ders).
- Bir çağrının kendisi de bir değer olduğundan çağrıları iç içe kullanabilirsin:
  `topla(topla(1, 2), topla(3, 4))` önce içtekileri (3 ve 7), sonra dıştakini hesaplar: 10.

`->` yazılmayan fonksiyonlar (örneğin `selam_ver`), Modül 2'den tanıdığın **birim tipi** `()`'yi
döndürür: "anlamlı bir sonuç yok". Birden fazla değer mi döndürmek istiyorsun? Modül 2'deki **tuple**'lar
tam bunun için var:

```rust
fn bol_ve_kalan(bolunen: i32, bolen: i32) -> (i32, i32) {
    (bolunen / bolen, bolunen % bolen)
}

fn main() {
    let (bolum, kalan) = bol_ve_kalan(17, 5);
    println!("17 = 5 × {bolum} + {kalan}");
}
```

```fill
prompt: |
  İmzayı tamamla: Fonksiyon iki kenar uzunluğu alıp dikdörtgenin alanını döndürsün. Program `20`
  yazdırmalı.
code: |
  fn dikdortgen_alani(en: ___0, boy: u32) ___1 {
      en * boy
  }

  fn main() {
      let alan = dikdortgen_alani(4, 5);
      println!("{alan}");
  }
blanks:
  - ["u32"]
  - ["-> u32"]
output: "20"
explanation: |
  Her parametrenin kendi tipi olmalı (`en: u32`) ve dönüş tipi parametre listesinden sonra `->` ile
  yazılır. `en * boy` iki `u32`'nin çarpımıdır, yani yine bir `u32` — imzadaki sözle birebir uyumlu.
```

Şimdi Modül 2'deki tamsayı bilgini bu fonksiyonla bir araya getir:

```predict
code: |
  fn bol_ve_kalan(bolunen: i32, bolen: i32) -> (i32, i32) {
      (bolunen / bolen, bolunen % bolen)
  }

  fn main() {
      let (b, k) = bol_ve_kalan(7, 2);
      let t = bol_ve_kalan(9, 10);
      println!("{b} {k}");
      println!("{} {}", t.0, t.1);
  }
options:
  - |
    3 1
    0 9
  - |
    3.5 1
    0.9 9
  - |
    3 1
    0 0
  - |
    1 3
    9 0
answer: 0
explanation: |
  Modül 2'den hatırla: İki tamsayının bölümü yine **tamsayıdır**, küsurat atılır: `7 / 2 = 3`,
  `9 / 10 = 0`. `%` ise kalanı verir: `7 % 2 = 1`, `9 % 10 = 9`. Fonksiyon iki değeri tek bir tuple
  içinde döndürür. İlk çağrıda tuple'ı `let (b, k)` ile **parçaladık (destructuring)**, ikincisinde
  `.0` ve `.1` ile alanlarına eriştik.
```

İmza bir **söz** gibidir; gövde bu sözü tutmak zorundadır:

```compiles
code: |
  fn ortalama(a: i32, b: i32) -> i32 {
      (a + b) as f64 / 2.0
  }

  fn main() {
      println!("{}", ortalama(3, 4));
  }
answer: false
error: E0308
explanation: |
  İmza "bu fonksiyon bir `i32` döndürür" diyor, ama gövdenin son ifadesi `(a + b) as f64 / 2.0` bir
  `f64` üretiyor. Derleyici gövdeyi imzayla karşılaştırır ve `expected i32, found f64` der. Çözüm, ne
  kastettiğine karar vermek: Ya dönüş tipini `-> f64` yap (sonuç 3.5 olur) ya da tamsayı bölmesi
  `(a + b) / 2` kullan (sonuç 3 olur). Rust senin yerine sessizce dönüştürme yapmaz.
```

## İmzalar neden bu kadar katı?

Şu satıra bak: `fn faiz_hesapla(anapara: f64, yillik_oran: f64, ay: u32) -> f64`. Gövdesini görmeden
fonksiyonun ne istediğini ve ne verdiğini anladın, değil mi? İşte **imza (signature)** budur:
fonksiyonun adı, parametreleri ve dönüş tipi.

Rust fonksiyon gövdelerinin **içinde** tip çıkarımı yapar (`let x = 5;`), ama imzalarda tipleri **her
zaman** ister. Bu bilinçli bir tasarım kararıdır:

1. **Belgeleme:** İmza, fonksiyonun asla eskimeyen kullanma kılavuzudur. Yorum satırları zamanla yanlış
   hâle gelebilir; imzayı ise derleyici her derlemede denetler.
2. **Yerel akıl yürütme (local reasoning):** Bir fonksiyonu anlamak için yalnızca kendi gövdesine ve
   çağırdığı fonksiyonların **imzalarına** bakmak yeter. Bir fonksiyonun gövdesini değiştirmek, onu
   çağıran kodun tiplerini sessizce değiştiremez.
3. **Hatalar doğru yerde yakalanır:** Python'da `def topla(a, b): return a + b` fonksiyonuna yanlışlıkla
   bir sayı ve bir metin verirsen hatayı ancak program çalışırken — belki de kullanıcının bilgisayarında —
   görürsün. Rust'ta aynı hata derleme anında, tam çağrının yapıldığı satırda yakalanır.

Haskell gibi bazı diller tüm programda tip çıkarımı yapabilir; Rust bilerek orta yolu seçti: **gövdede
çıkarım, sınırlarda açık tipler.**

:::analogy Duvardaki priz
Fonksiyon imzası bir **elektrik prizi** gibidir. Prizin şekli (parametre tipleri) hangi fişin
takılabileceğini belirler: Uymayan fiş daha takarken reddedilir — tıpkı derleyicinin yanlış tipteki
argümanı reddetmesi gibi. Prizden ne çıkacağı da bellidir (dönüş tipi: 220 volt). Duvarın içindeki
kabloları (fonksiyonun gövdesini) bilmeden cihazını güvenle takabilirsin.
:::

İmzalar sayesinde derleyici hataları da çok net anlatabilir. Bir argüman eksik verirsen:

:::error
```text
error[E0061]: this function takes 2 arguments but 1 argument was supplied
 --> src/main.rs:6:17
  |
6 |     let sonuc = topla(5);
  |                 ^^^^^--- argument #2 of type `i32` is missing
  |
note: function defined here
 --> src/main.rs:1:4
  |
1 | fn topla(a: i32, b: i32) -> i32 {
  |    ^^^^^         ------
help: provide the argument
  |
6 |     let sonuc = topla(5, /* i32 */);
  |                        +++++++++++
```
Derleyici hem **çağrı satırını** (6. satır: ikinci argüman eksik) hem de **tanımı** (`note:` → 1. satırdaki
`b: i32`) gösteriyor; `help:` satırı da eksik argümanın yerini işaretliyor. Yanlış **tipte** bir argüman
verseydin (`topla(5, 2.5)`) bu kez `E0308 mismatched types` alırdın.
:::

:::info Rust fonksiyonlarında olmayanlar
Başka dillerden geliyorsan şunları arayabilirsin; Rust'ta **yoklar**, ve bu da aynı "imza açık ve tek
anlamlı olsun" ilkesinin sonucu:
- **Varsayılan parametre** (Python'daki `def f(x, y=0)`): Her çağrı bütün argümanları verir.
- **Aşırı yükleme (overloading)**: Aynı isimle iki fonksiyon tanımlayamazsın; ikinci `fn topla` için
  derleyici `E0428` (*the name `topla` is defined multiple times*) der. Farklı işe farklı isim ver.
- **İsimli argüman** (`f(x=1)`) ve **değişken sayıda argüman**: Argümanlar her zaman sırayla eşlenir ve
  sayıları imzayla aynıdır. `println!`'ın bir fonksiyon değil de **makro** olmasının bir sebebi tam da bu:
  Bir fonksiyon, `println!("{}", a)` ile `println!("{} {}", a, b)` arasındaki gibi bazen iki bazen üç
  argüman alamaz; bir makro ise derleme sırasında her çağrı için uygun kodu kendisi üretir.
:::

:::warning İsimlendirme: snake_case
Rust'ta fonksiyon isimleri de değişkenler gibi **snake_case** yazılır: küçük harfler ve alt çizgi
(`not_ortalamasi`, `kdv_hesapla`). `ToplamHesapla` yazarsan program çalışır ama derleyici uyarır:
```text
warning: function `ToplamHesapla` should have a snake case name
 --> src/main.rs:1:4
  |
1 | fn ToplamHesapla(a: i32, b: i32) -> i32 {
  |    ^^^^^^^^^^^^^ help: convert the identifier to snake case: `toplam_hesapla`
```
Bir iş yapan fonksiyonun isminde bir fiil olsun (`selam_ver`, `kdv_hesapla`); bir değer hesaplayıp
döndüren fonksiyonun ismi o değeri anlatabilir (`dikdortgen_alani`).
:::

```quiz
question: Rust'ın fonksiyon parametrelerinde tip çıkarımı yapmamasının asıl sebebi nedir?
options:
  - Derleyici parametre tiplerini teknik olarak çıkaramaz
  - İmza bir sözleşmedir; fonksiyonu gövdesine bakmadan anlamayı ve hataların doğru yerde yakalanmasını sağlar
  - Tipleri açıkça yazmak programın daha hızlı çalışmasını sağlar
  - "`let` ile tanımlanan değişkenlerde de tip yazmak zorunlu olduğu için tutarlılık gerekir"
answer: 1
explanation: |
  Rust'ın tasarımcıları imzaları **bilerek** açık tuttu: İmza hem insan için bir belge hem de derleyici
  için denetlenebilir bir sözleşmedir. Böylece her fonksiyon tek başına anlaşılabilir ve bir hata,
  sebebinin bulunduğu yerde raporlanır.
feedback:
  - Teknik olarak mümkün (Haskell gibi diller tüm programda çıkarım yapar); Rust bunu bilerek seçmedi.
  - Doğru!
  - Tipler derleme zamanında zaten bilinir; açıkça yazmak çalışma hızını değiştirmez.
  - "`let`'te tip çıkarımı var (`let x = 5;`); zorunluluk yalnızca imzalarda."
```

## Fonksiyonlardan fonksiyon kurmak

Asıl güç, küçük fonksiyonları birleştirerek daha büyüklerini kurmaktan gelir:

```rust
fn daire_alani(yaricap: f64) -> f64 {
    std::f64::consts::PI * yaricap * yaricap
}

fn silindir_hacmi(yaricap: f64, yukseklik: f64) -> f64 {
    daire_alani(yaricap) * yukseklik
}

fn main() {
    let hacim = silindir_hacmi(3.0, 10.0);
    println!("Su deposunun hacmi: {hacim:.1} cm³");
}
```

`std::f64::consts::PI`, standart kütüphanedeki π sabitinin tam adıdır (`::` ile ayrılan bu adreslere
**yol (path)** denir, Modül 8'de göreceğiz). `silindir_hacmi` alan formülünü yeniden yazmak yerine
`daire_alani` fonksiyonunu çağırıyor: Formülde bir hata olsaydı onu tek bir yerde düzeltirdin.
Programcıların **DRY** (*Don't Repeat Yourself* — kendini tekrar etme) dediği ilke budur.

Her fonksiyon kendi küçük dünyasında yaşar: Yalnızca **kendi parametrelerini** ve **kendi içinde
tanımlanan değişkenleri** görür. Bunu bir de derleyicinin gözünden dene:

```compiles
code: |
  fn kdv_ekle(fiyat: f64) -> f64 {
      fiyat + fiyat * oran
  }

  fn main() {
      let oran = 0.20;
      println!("{}", kdv_ekle(100.0));
  }
answer: false
error: E0425
explanation: |
  `oran`, `main`'in yerel değişkenidir; `kdv_ekle` onu göremez. Modül 1'de hata anatomisini incelerken
  tanıştığın `E0425` hatası (*cannot find value `oran` in this scope*) tam bunu söyler. Çözüm, veriyi
  açıkça **parametreyle** göndermek: `fn kdv_ekle(fiyat: f64, oran: f64) -> f64` ve
  `kdv_ekle(100.0, oran)`. Bir fonksiyonun neye ihtiyaç duyduğu böylece imzasında görünür hâle gelir.
```

```parsons
prompt: |
  Satırları sırala: Önce `kup` fonksiyonunu tanımla, sonra `main` içinde onu çağırıp sonucu yazdır.
  Dikkat, aralarına iki tuzak satır karıştı!
lines: |
  fn kup(x: i64) -> i64 {
      x * x * x
  }
  fn main() {
      let sonuc = kup(3);
      println!("{sonuc}");
  }
distractors: |2
      x * x * x;
  fn kup(x) -> i64 {
explanation: |
  `fn kup(x) -> i64` derlenmez, çünkü parametrenin tipi zorunludur. `x * x * x;` satırındaki noktalı virgül
  ise son ifadeyi bir deyime çevirir ve gövde `i64` yerine `()` üretir — bunun neden böyle olduğu bir
  sonraki dersin konusu.
```

## Alıştırmalar

Şimdi sıra sende. İlk alıştırmada fonksiyonun gövdesini, ikincisinde ise fonksiyonların tamamını —
imzalarıyla birlikte — sen yazacaksın.

```exercise
id: m03-e-saniye-coz
title: Saniyeleri çöz
difficulty: 2
prompt: |
  Bir koşu uygulaması maraton sürelerini toplam **saniye** olarak kaydediyor. `saniye_coz` fonksiyonunu
  tamamla: Toplam saniyeyi `(saat, dakika, saniye)` üçlüsüne çevirip döndürsün.

  Örnek: `3725` → `(1, 2, 5)`, çünkü 3725 = 1 × 3600 + 2 × 60 + 5.

  Saatler 24'ü geçebilir; gün hesabı yapma.
starter: |
  fn saniye_coz(toplam: u32) -> (u32, u32, u32) {
      todo!()
  }

  fn main() {
      let (saat, dakika, saniye) = saniye_coz(8_142);
      println!("Maraton süresi: {saat} sa {dakika} dk {saniye} sn");
  }
solution: |
  fn saniye_coz(toplam: u32) -> (u32, u32, u32) {
      let saat = toplam / 3600;
      let dakika = toplam % 3600 / 60;
      let saniye = toplam % 60;
      (saat, dakika, saniye)
  }

  fn main() {
      let (saat, dakika, saniye) = saniye_coz(8_142);
      println!("Maraton süresi: {saat} sa {dakika} dk {saniye} sn");
  }
check: tests
tests: |
  #[test]
  fn bir_saat_iki_dakika_bes_saniye() {
      assert_eq!(saniye_coz(3725), (1, 2, 5), "3725 sn = 1 sa 2 dk 5 sn");
  }

  #[test]
  fn sifir_saniye() {
      assert_eq!(saniye_coz(0), (0, 0, 0), "0 saniyede saat, dakika ve saniye sıfırdır");
  }

  #[test]
  fn dakika_sinirlari() {
      assert_eq!(saniye_coz(59), (0, 0, 59), "59 sn henüz bir dakika bile değil");
      assert_eq!(saniye_coz(60), (0, 1, 0), "60 sn tam 1 dakikadır");
  }

  #[test]
  fn gunun_son_saniyesi() {
      assert_eq!(saniye_coz(86_399), (23, 59, 59), "86399 sn = 23 sa 59 dk 59 sn");
  }

  #[test]
  fn saatler_yirmi_dordu_gecebilir() {
      assert_eq!(saniye_coz(90_061), (25, 1, 1), "90061 sn = 25 sa 1 dk 1 sn (gün hesabı yok)");
      assert_eq!(saniye_coz(8_142), (2, 15, 42), "8142 sn = 2 sa 15 dk 42 sn");
      assert_eq!(
          saniye_coz(u32::MAX),
          (1_193_046, 28, 15),
          "en büyük u32 değeri (4294967295 sn) = 1193046 sa 28 dk 15 sn"
      );
  }
hints:
  - "Bir saatte 3600, bir dakikada 60 saniye var. Tamsayı bölmesi `/` küsuratı atar, `%` ise kalanı verir."
  - "`toplam / 3600` saati verir. Saatlerden **artan** saniyeler `toplam % 3600`'dür; bunu 60'a bölersen dakikayı bulursun."
  - "Saniye: `toplam % 60`. Son satıra noktalı virgülsüz bir tuple yaz: `(saat, dakika, saniye)`."
explanation: |
  `/` ve `%` aynı önceliğe sahiptir ve soldan sağa işlenir; yani `toplam % 3600 / 60` ifadesi
  `(toplam % 3600) / 60` demektir: Önce tam saatleri at, kalanı dakikaya çevir. Aynı sonucu
  `toplam / 60 % 60` ile de bulabilirsin (toplam dakikanın, 60'a bölümünden kalanı).

  Dönüş tipi `(u32, u32, u32)` olduğu için gövdenin son ifadesi de bu tipte bir tuple olmalı. Negatif süre
  olamayacağı için `u32` seçmek, geçersiz değerleri tipin kendisiyle dışarıda bırakır.

  Bir ipucu daha: Tuple'da hangi sayının saat, hangisinin dakika olduğunu karıştırmak kolaydır. Modül 6'da
  alanlarına isim verebildiğin **struct**'ları öğrenince bu tür sonuçları çok daha okunaklı döndüreceksin.
```

```exercise
id: m03-e-lahmacun
title: Lahmacun ikilemi
difficulty: 3
prompt: |
  Lahmacuncuda klasik soru: **Bir tane 30 cm'lik** mi daha doyurucu, yoksa **iki tane 20 cm'lik** mi?
  Cevabı bulmak için iki fonksiyon yaz — bu kez imzalar da senden:

  1. `daire_alani`: Dairenin **çapını** (`f64`, cm) alıp alanını (`f64`, cm²) döndürsün.
     Dikkat: Alan formülü yarıçapla çalışır ve yarıçap, çapın yarısıdır.
  2. `tek_buyuk_daha_mi_doyurucu`: Büyük lahmacunun çapını ve küçük lahmacunun çapını (ikisi de `f64`)
     alsın. **Bir** büyük lahmacunun alanı **iki** küçük lahmacunun toplam alanından büyükse `true`,
     değilse `false` döndürsün. Alan formülünü tekrar yazma, `daire_alani` fonksiyonunu çağır!

  π için `std::f64::consts::PI` sabitini kullan. Bitirince `main`'deki satırların başındaki `//`
  işaretlerini kaldırıp programı çalıştırabilirsin.
starter: |
  // daire_alani ve tek_buyuk_daha_mi_doyurucu fonksiyonlarını buraya yaz.

  fn main() {
      // println!("30 cm'lik lahmacun: {:.1} cm²", daire_alani(30.0));
      // println!("Bir 30'luk mu, iki 20'lik mi? {}", tek_buyuk_daha_mi_doyurucu(30.0, 20.0));
  }
solution: |
  fn daire_alani(cap: f64) -> f64 {
      let yaricap = cap / 2.0;
      std::f64::consts::PI * yaricap * yaricap
  }

  fn tek_buyuk_daha_mi_doyurucu(buyuk_cap: f64, kucuk_cap: f64) -> bool {
      daire_alani(buyuk_cap) > 2.0 * daire_alani(kucuk_cap)
  }

  fn main() {
      println!("30 cm'lik lahmacun: {:.1} cm²", daire_alani(30.0));
      println!("Bir 30'luk mu, iki 20'lik mi? {}", tek_buyuk_daha_mi_doyurucu(30.0, 20.0));
  }
check: tests
tests: |
  #[test]
  fn daire_alani_capla_calisir() {
      let alan = daire_alani(2.0);
      assert!(
          (alan - std::f64::consts::PI).abs() < 1e-9,
          "çapı 2 cm olan dairenin yarıçapı 1 cm, alanı π ≈ 3.14159 olmalı; senin sonucun: {alan}"
      );
  }

  #[test]
  fn yirmilik_lahmacunun_alani() {
      let alan = daire_alani(20.0);
      assert!(
          (alan - 314.159_265_358_979_3).abs() < 1e-6,
          "20 cm'lik lahmacunun alanı ≈ 314.16 cm² olmalı; senin sonucun: {alan}"
      );
  }

  #[test]
  fn bir_otuzluk_iki_yirmilikten_doyurucu() {
      assert!(
          tek_buyuk_daha_mi_doyurucu(30.0, 20.0),
          "30'luk ≈ 706.9 cm², iki 20'lik toplam ≈ 628.3 cm²: true beklenir"
      );
  }

  #[test]
  fn bir_otuzluk_iki_yirmibeslikten_az() {
      assert!(
          !tek_buyuk_daha_mi_doyurucu(30.0, 25.0),
          "30'luk ≈ 706.9 cm², iki 25'lik toplam ≈ 981.7 cm²: false beklenir"
      );
  }

  #[test]
  fn sinira_yakin_durumlar() {
      assert!(
          tek_buyuk_daha_mi_doyurucu(29.0, 20.0),
          "29'luk ≈ 660.5 cm², iki 20'lik toplam ≈ 628.3 cm²: true beklenir"
      );
      assert!(
          !tek_buyuk_daha_mi_doyurucu(28.0, 20.0),
          "28'lik ≈ 615.8 cm², iki 20'lik toplam ≈ 628.3 cm²: false beklenir"
      );
      assert!(
          !tek_buyuk_daha_mi_doyurucu(10.0, 7.1),
          "10'luk ≈ 78.5 cm², iki 7.1'lik toplam ≈ 79.2 cm²: false beklenir"
      );
  }
hints:
  - "Önce imzaları düşün: `daire_alani` bir `f64` alıp bir `f64` döndürür; ikinci fonksiyon iki `f64` alıp bir `bool` döndürür."
  - "`daire_alani` içinde önce `let yaricap = cap / 2.0;` yaz; son satır noktalı virgülsüz `std::f64::consts::PI * yaricap * yaricap` olsun."
  - "Karşılaştırma operatörü `>` zaten bir `bool` üretir. İkinci fonksiyonun tek satırı: `daire_alani(buyuk_cap) > 2.0 * daire_alani(kucuk_cap)`"
forbid:
  - pattern: "3\\.14"
    message: π'yi elle yazma; `std::f64::consts::PI` sabitini kullan.
require:
  - pattern: "fn\\s+tek_buyuk_daha_mi_doyurucu(?:(?!\\bfn\\b)[\\s\\S])*\\bdaire_alani\\s*\\("
    message: "`tek_buyuk_daha_mi_doyurucu` alanları kendisi hesaplamamalı; gövdesinde `daire_alani` fonksiyonunu çağır."
explanation: |
  Çözümün kalbi iki küçük fikir:

  - **Kompozisyon:** `tek_buyuk_daha_mi_doyurucu`, alan formülünü bilmez; işi `daire_alani` fonksiyonuna devreder.
    Formül tek bir yerde yaşar (DRY).
  - **Karşılaştırma bir ifadedir:** `a > b` doğrudan bir `bool` değeri üretir. Sonraki derslerde
    göreceğin `if a > b { true } else { false }` gibi uzun bir yazıma gerek yoktur.

  Peki neden tek büyük lahmacun kazanıyor? Alan, çapın **karesiyle** büyür: Çap 1,5 katına çıkınca
  (20 → 30) alan 1,5² = 2,25 katına çıkar. 2,25 > 2 olduğu için bir büyük, iki küçükten fazladır.
  Sezgilerimiz doğrusal düşünür, geometri ise karesel — fonksiyonlarla hesaplamak bu yüzden değerli!

  Alternatif: Karşılaştırmanın iki yanındaki π ve ¼ sadeleşir, yani
  `buyuk_cap * buyuk_cap > 2.0 * kucuk_cap * kucuk_cap` da aynı cevabı verir. Ama formülü bir kez
  `daire_alani`'na koyup her yerde onu çağırmak, ileride formül değişirse (örneğin kare lahmacun!) tek
  bir yeri düzeltmeni sağlar. Son bir not: `f64` hesapları küçük yuvarlama hataları içerebilir; iki alan
  neredeyse **eşitken** `>` karşılaştırmasının sonucuna bu yüzden körü körüne güvenme (Modül 2'deki
  `0.1 + 0.2` örneğini hatırla).
```

## Özet

:::remember
- Tanım: `fn isim(param: Tip, ...) -> DonusTipi { gövde }`. Her parametrenin tipi **zorunludur**.
- Dönüş tipi `->` ile yazılır; yazılmazsa fonksiyon `()` döndürür. Birden çok değer için tuple kullan.
- Gövdenin noktalı virgülsüz son ifadesi **dönüş değeridir**.
- Tanım sırası önemsizdir. Her çağrı kendi stack çerçevesini alır; `i32` gibi tipler parametreye **kopyalanır**.
- Bir fonksiyon başka bir fonksiyonun yerel değişkenini göremez (`E0425`): Veriyi parametreyle gönder.
- İsimler `snake_case`; yanlış argüman sayısı `E0061`, yanlış tip `E0308` verir.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Rust, `let` ile tanımlanan değişkenlerde tipi kendisi çıkarırken neden
  fonksiyon parametrelerinde tip yazmanı zorunlu tutuyor? Bu kuralın sana ne kazandırdığını bir örnekle anlat.
answer: |
  Model cevap: Fonksiyon imzası, fonksiyon ile onu çağıran kod arasındaki **sözleşmedir**. Tipler imzada
  açıkça yazılı olunca fonksiyonu gövdesini okumadan anlayabilirim; derleyici de her fonksiyonu tek
  başına denetleyebilir. Örneğin `fn kdv_ekle(fiyat: f64, oran: f64) -> f64` imzasını görünce iki ondalık
  sayı verip bir ondalık sayı alacağımı bilirim. Yanlışlıkla bir `bool` gönderirsem hata, programı
  çalıştırdığımda değil, derlerken ve tam o çağrı satırında çıkar. Gövdenin içinde ise tip çıkarımı
  serbest, çünkü oradaki tipler zaten imzadan ve yakındaki koddan anlaşılır.
```

```flashcards
- front: Bir fonksiyonun dönüş tipi nereye ve nasıl yazılır?
  back: "Parametre listesinden sonra `->` ve tip: `fn topla(a: i32, b: i32) -> i32`"
- front: "`fn alan(en, boy: u32)` neden derlenmez?"
  back: "Her parametrenin kendi tipi olmalı: `fn alan(en: u32, boy: u32)`."
- front: Parametre ile argüman arasındaki fark nedir?
  back: "Parametre tanımdaki değişkendir (`x: i32`); argüman çağrıda verilen somut değerdir (`kare(4)` içindeki `4`)."
- front: "`E0061` hatası neyi anlatır?"
  back: Fonksiyona imzasındakinden farklı sayıda argüman verildiğini.
- front: Dönüş tipi yazılmayan bir fonksiyon ne döndürür?
  back: "Birim tipini: `()` — \"anlamlı bir değer yok\"."
- front: "`main`'den sonra tanımlanan bir fonksiyon `main` içinden çağrılabilir mi?"
  back: Evet. Rust'ta tanım sırası önemsizdir; derleyici dosyanın tamamını birlikte görür.
- front: "`fn f(mut x: i32)` içinde `x`'i değiştirmek, çağıranın gönderdiği değişkeni değiştirir mi?"
  back: Hayır. `x` argümanın bir kopyasıdır ve fonksiyonun kendi stack çerçevesinde yaşar.
- front: Rust fonksiyon isimleri hangi stilde yazılır?
  back: "`snake_case`: küçük harf ve alt çizgi, örneğin `not_ortalamasi`."
```
