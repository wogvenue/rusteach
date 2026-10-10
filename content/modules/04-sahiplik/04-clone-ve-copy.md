---
id: m04-l04
title: Clone ve Copy
minutes: 17
type: lesson
objectives:
  - "`.clone()` ile derin kopya oluşturup bellekte iki bağımsız değer olduğunu diyagramla gösterebilmek"
  - Bir tipin `Copy` olup olmadığını söyleyip nedenini heap verisi üzerinden açıklayabilmek
  - Bir `E0382` hatasında `clone`'un doğru çözüm olup olmadığına gerekçeli karar verebilmek
keywords: [clone, Copy, derin kopya, deep copy, kopyalama, tuple, dizi, kısmi taşıma, E0382, E0508]
---

Önceki derste `let s2 = s1;` satırının bir `String`'i **taşıdığını**, ama aynı satırın bir `i32`'yi
sessizce **kopyaladığını** gördün. Derleyicinin `E0382` mesajı da hep aynı ipucunu veriyordu:
*`String` `Copy` trait'ini uygulamıyor* ve *maliyeti kabul edilebilirse `.clone()` dene*.

Bu derste o iki kelimenin, **`Copy`** ve **`clone`**'un, tam olarak ne anlama geldiğini öğreneceksin.
Hangi tiplerin neden kopyalandığını, gerçek bir kopyanın neye mal olduğunu ve en önemlisi: `clone`'un
neden her `E0382`'nin ilacı **olmadığını**.

## Derin kopya: `.clone()`

Bazen gerçekten **iki bağımsız** metin istersin: biri değişirken öteki aynı kalsın. Önce tahmin et:

```predict
code: |
  fn main() {
      let mut asil = String::from("çay");
      let mut kopya = asil.clone();
      kopya.push_str(" ve simit");
      asil.push('!');
      println!("{asil} | {kopya}");
  }
options:
  - "çay! | çay ve simit"
  - "çay ve simit! | çay ve simit!"
  - "çay | çay ve simit"
  - Derlenmez (E0382)
answer: 0
explanation: |
  `.clone()` heap'teki veriyi de kopyalar: `asil` ve `kopya` artık **ayrı heap alanlarına** sahip iki
  bağımsız `String`'dir. `kopya`'ya eklenen `" ve simit"` yalnızca kopyayı, `asil`'e eklenen `!` yalnızca
  aslı değiştirir. Taşıma olmadığı için `E0382` de yoktur: `asil` hâlâ kendi değerinin sahibidir.
feedback:
  - Doğru! İki ayrı değer, iki ayrı değişiklik.
  - "Bu, Python/Java tarzı **paylaşım** olurdu: iki isim aynı nesneyi gösterseydi değişiklikler ikisinde de görünürdü. `clone` paylaşım değil, kopya üretir."
  - "`asil.push('!')` satırını gözden kaçırdın: asıl metin de değişti."
  - "`clone` taşımaz; `asil` sahipliğini korur."
```

Bellekte olan şu:

```memory
title: let kopya = asil.clone();
steps:
  - caption: "Başlangıç: `asil` heap'teki `çay` baytlarının tek sahibi."
    stack:
      - frame: main
        vars:
          - { name: asil, type: String, value: "ptr · len=4 · cap=4", to: h1, mut: true }
    heap:
      - { id: h1, value: "ç a y" }
  - caption: "`clone()` heap'te **yeni** bir alan ayırdı ve baytları oraya kopyaladı. İki başlık, iki ayrı heap alanı, iki ayrı sahip."
    stack:
      - frame: main
        vars:
          - { name: asil, type: String, value: "ptr · len=4 · cap=4", to: h1, mut: true }
          - { name: kopya, type: String, value: "ptr · len=4 · cap=4", to: h2, mut: true }
    heap:
      - { id: h1, value: "ç a y" }
      - { id: h2, value: "ç a y", label: "yeni ayrılmış kopya" }
  - caption: "Değişiklikler birbirini etkilemez. `main` bitince **iki** değer de drop edilir ve iki heap alanı ayrı ayrı geri verilir — double free yok, çünkü her alanın tek sahibi var."
    stack:
      - frame: main
        vars:
          - { name: asil, type: String, value: "ptr · len=5 · cap=8", to: h1, mut: true }
          - { name: kopya, type: String, value: "ptr · len=13 · cap=13", to: h2, mut: true }
    heap:
      - { id: h1, value: "ç a y !" }
      - { id: h2, value: "ç a y   v e   s i m i t" }
```

Ders 3'teki `as_ptr()` ölçü aletiyle farkı kendin gör: taşımada heap adresi aynı kalıyordu, `clone`'da
ise yepyeni bir adres çıkar.

```rust
fn main() {
    let asil = String::from("Ankara");
    let kopya = asil.clone();
    println!("Aynı heap alanı mı? {}", asil.as_ptr() == kopya.as_ptr());
    println!("İçerikler eşit mi? {}", asil == kopya);
    println!("{asil} / {kopya}"); // ikisi de geçerli
}
```

İki metin **içerik olarak** eşittir (`==` baytları karşılaştırır), ama bellekte **ayrı** yerlerdedir.
Kural 2 bozulmadı: her heap alanının hâlâ tam olarak bir sahibi var.

## Clone'un bedeli

Taşıma, metin ne kadar uzun olursa olsun 24 bayt kopyalar. `clone` ise heap'ten yeni yer ayırır ve
**bütün** baytları tek tek kopyalar. Maliyeti verinin boyutuyla büyür:

```rust
fn main() {
    let kitap = "Bir varmış bir yokmuş. ".repeat(40_000); // yaklaşık 1 MB'lık bir metin
    let tasinan = kitap; // taşıma: 24 bayt kopyalandı
    let kopya = tasinan.clone(); // clone: yeni bellek + bütün baytlar kopyalandı
    println!("taşımada kopyalanan: {} bayt", std::mem::size_of::<String>());
    println!("clone'da kopyalanan: {} bayt", kopya.len());
}
```

(`repeat`, bir metni verilen sayıda tekrarlayan yeni bir `String` üretir.) Tek bir `clone` çoğu zaman
dert değildir. Ama bir döngünün içinde, binlerce kez çalışan bir fonksiyonda ya da büyük bir veri yapısında
`clone` sessizce programın en yavaş yeri olabilir.

:::analogy Fotokopi ve teslim
Bir dosyayı iş arkadaşına **teslim etmek** taşımadır: klasörü uzatırsın, bir saniye sürer ve artık dosya
onundur. Ona bir **fotokopi** vermek ise `clone`'dur: her sayfayı makineden geçirirsin; 3 sayfa bir dakika
sürer, 500 sayfa bir öğleden sonra. Fotokopi bazen gerçekten gereklidir — ikiniz de kendi nüshanıza not
alacaksanız — ama "ne olur ne olmaz" diye her dosyanın fotokopisini çekersen ofisin kâğıdı biter.
:::

Rust'ın burada bir ilkesi var: **pahalı işlemler kodda görünür olmalı.** C++'ta `std::string b = a;`
satırı sessizce derin kopya yapar; satıra bakarak maliyetini anlayamazsın. Python'da derin kopya için
`copy.deepcopy`, JavaScript'te `structuredClone` gibi ayrı araçlar vardır ama varsayılan davranış
paylaşımdır. Rust'ta ise kural basit: `=` asla gizlice heap kopyalamaz. Heap kopyası gördüğün her yerde
`.clone()` yazıyordur — kod incelemesinde gözünün takılacağı bir kelime.

## Copy tipleri

Peki `i32` neden taşınmıyor da kopyalanıyor? Önce iki tahmin. Modül 2'deki tuple'ları hatırla:

```compiles
code: |
  fn main() {
      let konum = (41, true);
      let yedek = konum;
      println!("{konum:?} {yedek:?}");
  }
answer: true
explanation: |
  Derlenir ve `(41, true) (41, true)` yazar. `(i32, bool)` tuple'ının iki elemanı da kopyalanan tipler;
  bu yüzden tuple'ın tamamı da kopyalanır. `konum` ve `yedek` bağımsız iki değerdir.
```

```compiles
code: |
  fn main() {
      let ogrenci = (String::from("Deniz"), 17);
      let kopya = ogrenci;
      println!("{ogrenci:?} {kopya:?}");
  }
answer: false
error: E0382
explanation: |
  Tuple'ın tek bir elemanı bile `String` ise tuple'ın tamamı **taşınır**. Derleyici bunu açıkça söyler:
  *move occurs because `ogrenci` has type `(String, i32)`, which does not implement the `Copy` trait*.
  `17` tek başına kopyalanabilirdi, ama `String`'i kopyalamanın ucuz ve güvenli bir yolu yok.
```

**`Copy`**, Rust'ın bazı tiplere verdiği bir etikettir. Bu etiketi taşıyan tipler atamada ve fonksiyon
çağrısında **taşınmaz, bit bit kopyalanır**; eski değişken geçerli kalır. Bu tür etiketlere Rust'ta
**trait** denir (kendi tiplerine trait eklemeyi Modül 6 ve 11'de göreceksin).

İlginç bir ayrıntı: makine düzeyinde taşıma da bir bayt kopyasıdır — `String`'in 24 baytlık başlığı da
kopyalanıyordu. `Copy` ile taşıma arasındaki tek fark, kopyadan sonra **eski değişkenin geçerli
kalıp kalmadığıdır**. `Copy` bir tipin derleyiciye "beni bit bit kopyalamak güvenli, eski değişken
kullanılmaya devam edebilir" demesidir. Standart `Copy` tipleri:

- Bütün tam sayılar: `i8` … `i128`, `u8` … `u128`, `isize`, `usize`
- Ondalıklı sayılar: `f32`, `f64`
- `bool` ve `char`
- Elemanlarının **hepsi** `Copy` olan tuple'lar ve diziler: `(i32, f64)`, `[u8; 4]`, `[char; 3]`
- String literalleri (`&'static str`) — kopyalanan sadece baytları gösteren işaretçi ve uzunluktur,
  baytların kendisi değil; bunun neden güvenli olduğunu Modül 5'teki referanslarla göreceksin.

Bunların ortak noktası ne? Hiçbiri heap'te bir şeye **sahip değildir**. Bir `i32`'nin 4 baytını kopyaladığında
elinde tam, eksiksiz, bağımsız bir ikinci sayı olur; drop edildiğinde geri verilecek bir kaynak da yoktur.

:::warning Copy otomatik verilmez
Heap'e sahip olmamak `Copy` olmanın **ön şartıdır**, ama tek başına yetmez: `Copy` bir tipin açıkça
taşıdığı bir etikettir. Modül 6'da kendi tiplerini (struct) yazdığında, içinde yalnızca `i32`'ler olsa
bile tipin **taşınır**; `Copy` olması için bunu `#[derive(Clone, Copy)]` ile açıkça istemen gerekir.
Bu modülün `Balon` tipi de `Copy` değildir: drop edildiğinde ekrana yazı yazan bir tip asla `Copy`
olamaz (aşağıda nedenini göreceksin).
:::

```memory
title: let yedek = konum; — Copy tipi
steps:
  - caption: "`konum` tamamen stack'te: 4 bayt `i32` + 1 bayt `bool` (hizalamayla birlikte 8 bayt). Heap'te hiçbir şey yok."
    stack:
      - frame: main
        vars:
          - { name: konum, type: "(i32, bool)", value: "(41, true)" }
  - caption: "Atama baytları kopyaladı ve iş bitti. Paylaşılan heap verisi olmadığı için iki değer de geçerli; ikisi de kapsam sonunda sessizce yok olur."
    stack:
      - frame: main
        vars:
          - { name: konum, type: "(i32, bool)", value: "(41, true)" }
          - { name: yedek, type: "(i32, bool)", value: "(41, true)" }
```

**`String` neden `Copy` değil?** Çünkü bir `String`'i bit bit kopyalamak, Ders 3'teki tehlikeli tabloyu
yeniden kurmak olurdu: iki başlık, tek heap alanı ve kapsam sonunda double free. Kural genel: **drop
edildiğinde bir iş yapan (bir kaynağı geri veren) hiçbir tip `Copy` olamaz.** Rust bunu derleyici
düzeyinde yasaklar: kendi drop kodu olan bir tipe `Copy` eklemeye çalışırsan `E0184` (*the trait `Copy`
cannot be implemented for this type; the type has a destructor*), `String` gibi `Copy` olmayan bir alan
içeren bir tipe eklemeye çalışırsan `E0204` (*this field does not implement `Copy`*) alırsın. `Copy`
ancak "bitleri kopyalamak yeterli" olan tiplere verilir.

Bir de Modül 2'den bir hatırlatma ile tahmin et:

```predict
code: |
  fn main() {
      let can: u8 = 250;
      let mut iksir_sonrasi = can;
      iksir_sonrasi = iksir_sonrasi.wrapping_add(10);
      println!("{can} {iksir_sonrasi}");
  }
options:
  - "250 4"
  - "4 4"
  - "250 260"
  - "Panik: attempt to add with overflow"
answer: 0
explanation: |
  `u8` `Copy` bir tip: `iksir_sonrasi`, `can`'ın bağımsız bir kopyası olarak başlar, bu yüzden ona
  yapılan hiçbir şey `can`'ı etkilemez (250 kalır). `wrapping_add` (Modül 2) taşmada sarar: `u8` en fazla
  255 tutar; 250 + 10 = 260, 256 çıkarılınca 4 olur.
feedback:
  - Doğru! Bağımsız kopya ve sarmalayan toplama.
  - "`u8` `Copy`'dir: kopya üzerinde yapılan değişiklik orijinali etkilemez."
  - "`u8` en fazla 255 tutar; 260 sığmaz. `wrapping_add` başa sarar."
  - "Panik yalnızca normal `+` işleminde (debug derlemede) olurdu. `wrapping_add` bilinçli olarak sarar."
```

`Copy` ile `clone` arasındaki ilişkiyi de bil: **her `Copy` tipi aynı zamanda `clone` da destekler**
(`5.clone()` derlenir ve `5` verir), ama gereksizdir. Fark şu:

| | `Copy` | `.clone()` |
|---|---|---|
| Nasıl tetiklenir? | Otomatik, her atamada ve argümanda | Açıkça yazarak |
| Ne kopyalar? | Yalnızca değerin kendi baytlarını (bit bit) | Tipe göre: `String` için heap verisi de |
| Maliyet | Tipin boyutu kadar; küçük tiplerde çok ucuz | Verinin boyutuyla büyüyebilir (heap ayırma + kopya) |
| Örnek tipler | `i32`, `bool`, `char`, `(u8, f64)` | `String`, `Vec`, ve tüm `Copy` tipleri |

Bir uyarı: `Copy` "her zaman bedava" demek değildir. `[u8; 100_000]` gibi büyük bir dizi de `Copy`'dir
ve her atamada ya da fonksiyon çağrısında 100 000 baytın **tamamı** kopyalanır. Böyle büyük verileri
genellikle heap'te (`Vec`) tutup taşırız ya da Modül 5'te göreceğin referanslarla ödünç veririz.

## Karışık durumlar: tuple'lar, diziler ve kısmi taşıma

Kural bileşik tiplerde de aynı: **bir bütün, ancak bütün parçaları `Copy` ise `Copy`'dir.**
`[i32; 3]` atamada kopyalanır; `[String; 3]` ise taşınır, hem de bütün olarak. Modül 2'deki dizileri
düşünerek hangilerinin `Copy` olduğunu seç:

```quiz
question: Aşağıdaki tiplerden hangileri `Copy`'dir? (Birden fazla seçenek doğru olabilir.)
options:
  - "`(i32, char)` — bir puan ve bir harf notu"
  - "`[f64; 3]` — üç sıcaklık ölçümü"
  - "`(String, u8)` — bir isim ve bir yaş"
  - "`[String; 2]` — iki takım adı"
answer: [0, 1]
explanation: |
  Bir tuple ya da dizi, ancak **bütün** elemanları `Copy` ise `Copy`'dir. `i32`, `char` ve `f64` heap'te
  hiçbir şeye sahip olmadığı için ilk ikisi kopyalanır. Son ikisinde birer `String` var: o `String`'ler
  heap'teki verilerine sahip olduğundan tuple ve dizi de taşınır.
feedback:
  - "Doğru: `i32` ve `char` ikisi de `Copy`."
  - "Doğru: elemanları `Copy` olan sabit boyutlu diziler `Copy`'dir."
  - "Tek bir `String` eleman bile tuple'ın tamamını `Copy` olmaktan çıkarır."
  - "`String` elemanlı diziler taşınır; dizinin tamamı yeni sahibe geçer."
```

:::deep Kısmi taşıma ve dizi elemanını taşıyamamak
Bir tuple'ın sadece **bir alanını** taşıyabilirsin. Taşınan alan kullanılamaz hâle gelir, ama `Copy`
olan diğer alanlar hâlâ kullanılabilir. Tuple'ın **tamamını** kullanmaya kalkarsan derleyici itiraz eder:

```rust,compile_fail,E0382
fn main() {
    let t = (String::from("Ali"), 17);
    let ad = t.0; // sadece String alanı taşındı
    println!("{ad} {}", t.1); // t.1 hâlâ geçerli (i32, Copy)
    println!("{t:?}"); // HATA: t'nin bir parçası artık yok
}
```

```text
error[E0382]: borrow of partially moved value: `t`
  |
3 |     let ad = t.0;
  |              --- value partially moved here
4 |     println!("{ad} {}", t.1);
5 |     println!("{t:?}");
  |                ^ value borrowed here after partial move
```

Dizilerde ise indeksle tek bir `String` elemanı **dışarı taşıyamazsın**: `let ilk = isimler[0];` satırı
`E0508: cannot move out of type [String; 2], a non-copy array` hatası verir. Neden? Dizinin ortasında
"taşınmış" bir delik kalırdı ve derleyici, dizinin drop edilirken hangi elemanların hâlâ geçerli
olduğunu izleyemezdi. Çözümler: `isimler[0].clone()` ya da Modül 5'teki ödünç alma (`&isimler[0]`).
Derleyici de bu ikisini `help` satırlarında önerir. İleride, elemanın yerine yeni bir değer bırakarak
onu dışarı alan `std::mem::take` / `std::mem::replace` fonksiyonlarını da göreceksin: delik kalmadığı
için güvenlidir.
:::

## Clone bilinçli bir karardır

`E0382` hatasındaki `help` satırı her seferinde `.clone()` önerir ve yeni başlayanların en yaygın
alışkanlığı her hatayı `clone` ile susturmaktır. Program derlenir, ama gereksiz bellek ayırma ve kopyalama
eklenir; daha kötüsü, gerçek tasarım sorusu cevapsız kalır. `clone` yazmadan önce sor:

- **Gerçekten iki bağımsız değer mi lazım?** Biri değişirken öteki eski hâlinde mi kalmalı, ya da iki
  ayrı yer değeri **sahiplenerek** mi kullanacak? Cevap evetse `clone` doğru araçtır.
- **Sadece okumak mı istiyorum?** Bir uzunluğa bakmak, bir değeri yazdırmak... Bunun için kopya gerekmez;
  işini taşımadan önce bitir (Ders 3) ya da Modül 5'te ödünç ver.
- **Eski değişkene sonra ihtiyacım var mı?** Yoksa taşımak hem en hızlı hem en temiz çözümdür.

```quiz
question: |
  Bir oyunda, kahramanın bölüm başındaki adı (`String`) **kayıt noktası** olarak saklanmalı; oyuncu adını
  değiştirse bile "bölümü baştan başlat" seçeneği eski adı geri getirmeli. Hangisi doğru yaklaşım?
options:
  - "`let kayit = ad;` — taşıma yeterli, en hızlısı bu"
  - "`let kayit = ad.clone();` — iki bağımsız değer gerekiyor: biri değişecek, öteki eski hâlinde kalacak"
  - "`clone` asla kullanılmamalı; Rust'ta her şey taşıma ile çözülür"
  - "`let kayit = ad;` ve sonra `ad`'ı kullanmaya devam et; derleyici bunu otomatik olarak kopyaya çevirir"
answer: 1
explanation: |
  Burada iki ayrı değere **gerçekten** ihtiyaç var: oyuncunun değiştirebileceği güncel ad ve hiç
  değişmemesi gereken kayıt. Paylaşım ya da taşıma bu işi göremez. Bu, `clone`'un tam yeri: maliyetini
  bilerek, bir kez ve bir amaçla yapılan bir kopya.
feedback:
  - "Taşımadan sonra `ad` kullanılamaz; ama oyuncu adını değiştirmeye devam edecek. İki değer lazım."
  - Doğru! Bilinçli, gerekçeli bir `clone`.
  - "`clone` yasak değil; gerekçesiz `clone` kötüdür. Bağımsız iki değer gerektiğinde doğru araçtır."
  - "Rust asla gizlice kopya yapmaz; `String` için bu `E0382` verir."
```

Şimdi tersini dene: gereksiz kopyaları ayıkla.

````exercise
id: m04-e-gereksiz-clone
title: Gereksiz clone avı
difficulty: 2
prompt: |
  Bir stajyer, her `E0382` hatasını `clone` ile susturmuş. Program doğru çalışıyor ama **üç** gereksiz
  heap kopyası yapıyor. Bütün `clone` çağrılarını kaldır; çıktı **aynen** şöyle kalmalı:

  ```text
  Elif (4 bayt)
  Hoş geldin, Elif!
  ```

  Satırların yerini değiştirebilir, değişken ekleyip çıkarabilirsin; `selamla` fonksiyonuna dokunma.
starter: |
  fn selamla(isim: String) {
      println!("Hoş geldin, {isim}!");
  }

  fn main() {
      let isim = String::from("Elif");
      let uzunluk = isim.clone().len();
      let kopya = isim.clone();
      println!("{kopya} ({uzunluk} bayt)");
      selamla(isim.clone());
  }
solution: |
  fn selamla(isim: String) {
      println!("Hoş geldin, {isim}!");
  }

  fn main() {
      let isim = String::from("Elif");
      let uzunluk = isim.len();
      println!("{isim} ({uzunluk} bayt)");
      selamla(isim);
  }
check: output
expected_output: |
  Elif (4 bayt)
  Hoş geldin, Elif!
forbid:
  - pattern: '\.clone\('
    message: Hâlâ bir `clone` var. Hepsini kaldırmalısın!
  - pattern: 'String::from\("Elif"\)[\s\S]*String::from\("Elif"\)'
    message: "Aynı metni ikinci kez `String::from` ile oluşturmak da gizli bir kopyadır."
  - pattern: '\.to_string\(\)|\.to_owned\(\)|String::from\(\s*(&|isim)'
    message: "`to_string`, `to_owned` ya da `String::from(&isim)` de birer kopyadır; adı `clone` olmasa da aynı maliyeti taşır."
  - pattern: 'println!\([^;]*Elif'
    message: "\"Elif\" metnini elle yazdırma; `isim` değişkenini yazdır."
require:
  - pattern: 'String::from\("Elif"\)'
    message: "`let isim = String::from(\"Elif\");` satırı kalmalı."
  - pattern: '\bselamla\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\)\s*;'
    message: "`selamla` fonksiyonu hâlâ çağrılmalı: `selamla(isim);`"
  - pattern: '\.len\(\)'
    message: Uzunluğu elle yazma; `len()` ile hesapla.
hints:
  - "Her `clone` için sor: bu kopya **değiştiriliyor mu**, yoksa sadece okunuyor mu? Üçü de yalnızca okunuyor ya da hemen veriliyor."
  - "`isim.len()` değeri taşımaz, sadece okur. `kopya` değişkenine de gerek yok: `isim`'i doğrudan yazdırabilirsin."
  - "`selamla(isim)` çağrısı `isim`'i taşır; bu yüzden bu çağrı `isim`'i kullanan **son** satır olmalı. Önceki satırlarda `isim` hâlâ geçerli."
explanation: |
  Üç `clone`'un üçü de gereksizdi:

  1. `isim.clone().len()`: sadece uzunluğu okumak için bütün metin kopyalanıp hemen atılıyordu.
     `isim.len()` aynı sayıyı kopyasız verir.
  2. `let kopya = isim.clone();`: `kopya` hiç değiştirilmiyor, yalnızca yazdırılıyor. `isim`'in kendisini
     yazdırmak yeterli.
  3. `selamla(isim.clone())`: bu çağrıdan sonra `isim` bir daha kullanılmıyor. Taşımak hem ucuz hem doğru:
     `selamla` zaten değerin sahipliğini istiyor.

  Genel kalıp: değeri tüketen (taşıyan) kullanımı **en sona** koy, okuyan kullanımları ondan önce yap.

  Araçlara tamamen güvenme: **clippy** (Modül 1) varsayılan ayarlarıyla bu üç `clone`'un hiçbiri için
  uyarı vermez. Onun `redundant_clone` denetimi varsayılan olarak kapalıdır (`nursery` grubunda);
  `cargo clippy -- -W clippy::redundant_clone` ile açtığında bile her gereksiz kopyayı yakalamaz (bu
  örnekte, bugünkü sürümüyle, `let kopya = isim.clone();` satırını kaçırıyor). Gereksiz kopyayı görmek
  için asıl araç senin gözün.
````

## Alıştırma: e-posta taslağı

Önce `clone`'un **gerektiği** bir durumu satır satır kur:

```parsons
prompt: |
  Bir lokanta, menüdeki çorbayı aynen korurken müşteriye özel bir sürüm de hazırlıyor. Satırları
  sıraya koy; program önce `Normal: Mercimek çorbası`, sonra `Özel: Mercimek çorbası + limon` yazdırmalı.
lines: |
  fn main() {
      let menu = String::from("Mercimek çorbası");
      let mut ozel = menu.clone();
      ozel.push_str(" + limon");
      println!("Normal: {menu}");
      println!("Özel: {ozel}");
  }
distractors: |
      let mut ozel = menu;
      let ozel = menu.clone();
explanation: |
  `menu` daha sonra da kullanılacak ve değişmemeli; `ozel` ise değiştirilecek. İki bağımsız değer lazım,
  yani `clone` gerekiyor. `let mut ozel = menu;` çeldiricisi `menu`'yü taşırdı ve `println!("Normal: {menu}")`
  satırı `E0382` verirdi. `let ozel = menu.clone();` ise `mut` olmadığı için `push_str`'de `E0596` verirdi.
```

````exercise
id: m04-e-eposta-taslagi
title: İmzalı ve imzasız taslak
difficulty: 3
prompt: |
  Bir e-posta uygulaması yazıyorsun. `imzali_surum` fonksiyonu bir taslağın sahipliğini alır ve **iki**
  değer döndürür:

  1. Taslağın **değişmemiş** hâli (kullanıcı sonra düzenlemeye devam edecek),
  2. Sonuna `IMZA` sabiti eklenmiş, gönderilmeye hazır sürüm.

  ```text
  imzali_surum(String::from("Merhaba Ahmet Bey,"))
  → ("Merhaba Ahmet Bey,", "Merhaba Ahmet Bey,\n--\nSaygılarımla,\nAyşe Kaya")
  ```

  Taslak boşsa ikinci değer sadece imzadan oluşur.
starter: |
  const IMZA: &str = "\n--\nSaygılarımla,\nAyşe Kaya";

  fn imzali_surum(taslak: String) -> (String, String) {
      todo!()
  }

  fn main() {
      let (taslak, gonderilecek) = imzali_surum(String::from("Merhaba Ahmet Bey,"));
      println!("Taslak:\n{taslak}\n");
      println!("Gönderilecek:\n{gonderilecek}");
  }
solution: |
  const IMZA: &str = "\n--\nSaygılarımla,\nAyşe Kaya";

  fn imzali_surum(taslak: String) -> (String, String) {
      let mut imzali = taslak.clone();
      imzali.push_str(IMZA);
      (taslak, imzali)
  }

  fn main() {
      let (taslak, gonderilecek) = imzali_surum(String::from("Merhaba Ahmet Bey,"));
      println!("Taslak:\n{taslak}\n");
      println!("Gönderilecek:\n{gonderilecek}");
  }
check: tests
tests: |
  #[test]
  fn taslak_degismeden_geri_doner() {
      let (taslak, _) = imzali_surum(String::from("Merhaba Ahmet Bey,"));
      assert_eq!(taslak, "Merhaba Ahmet Bey,", "ilk değer taslağın değişmemiş hâli olmalı");
  }

  #[test]
  fn imzali_surum_imzayla_biter() {
      let (_, imzali) = imzali_surum(String::from("Toplantı yarın 10:00'da."));
      assert_eq!(
          imzali,
          "Toplantı yarın 10:00'da.\n--\nSaygılarımla,\nAyşe Kaya",
          "ikinci değer: taslak + IMZA"
      );
  }

  #[test]
  fn iki_deger_bagimsizdir() {
      let (mut taslak, imzali) = imzali_surum(String::from("Selam"));
      taslak.push_str(" Ece");
      assert_eq!(taslak, "Selam Ece", "dönen taslak düzenlemeye devam edilebilmeli");
      assert_eq!(
          imzali,
          "Selam\n--\nSaygılarımla,\nAyşe Kaya",
          "taslağı sonradan değiştirmek imzalı sürümü etkilememeli"
      );
  }

  #[test]
  fn bos_taslak() {
      let (taslak, imzali) = imzali_surum(String::new());
      assert_eq!(taslak, "", "boş taslak boş kalmalı");
      assert_eq!(imzali, IMZA, "boş taslağın imzalı sürümü sadece imzadır");
  }
hints:
  - "İki **bağımsız** `String` lazım: biri değişmeden kalacak, öteki büyüyecek. Hangi metot heap verisini de kopyalıyordu?"
  - "`let mut imzali = taslak.clone();` ile kopyayı oluştur, sonra `imzali.push_str(IMZA);` ile imzayı ekle."
  - "Son ifade noktalı virgülsüz tuple olmalı: `(taslak, imzali)`. `taslak` burada fonksiyondan dışarı **taşınır**."
explanation: |
  Fonksiyon `taslak`'ın sahibi; ama iki farklı değer döndürmesi gerekiyor: biri değişmemiş, öteki
  büyümüş. Tek bir `String` ile bunu yapamazsın — `push_str` aslı değiştirirdi. Bu yüzden `clone` burada
  **gerekçeli** bir karar: yeni bir heap alanı ayrılır, sonra yalnızca kopya büyütülür. Son satırda iki
  `String` de tuple içinde çağırana taşınır; fonksiyonda drop edilecek hiçbir şey kalmaz.

  `iki_deger_bagimsizdir` testi, paylaşım olmadığını kanıtlıyor: dönen taslağı değiştirmek imzalı sürümü
  etkilemiyor.

  **Alternatif**: `let imzali = format!("{taslak}{IMZA}");` da yeni bir `String` üretir; `format!`
  (Modül 1) `taslak`'ı yalnızca okur, taşımaz. Bu da bir kopyadır, sadece adı `clone` değildir — maliyeti
  aynıdır. Tuple ile değer döndürmeyi bir sonraki derste daha yakından inceleyeceğiz.
````

## Özet

:::remember
- **`.clone()`** derin kopyadır: heap'te yeni yer ayırır, bütün baytları kopyalar → iki bağımsız değer,
  iki ayrı sahip, iki ayrı drop.
- Clone'un maliyeti verinin boyutuyla büyür; taşıma her zaman sadece başlığı (24 bayt) kopyalar.
- **`Copy`** tipleri atamada otomatik kopyalanır, eski değişken geçerli kalır: tam sayılar, `f32`/`f64`,
  `bool`, `char`, string literalleri ve elemanlarının **hepsi** `Copy` olan tuple'lar/diziler.
- Taşıma da `Copy` de makinede bir bayt kopyasıdır; fark, eski değişkenin geçerli kalıp kalmamasıdır.
  `Copy` açıkça verilen bir etikettir (kendi tiplerin otomatik `Copy` olmaz) ve büyük `Copy` diziler her
  atamada bütünüyle kopyalanır.
- Drop edildiğinde kaynak geri veren tipler (`String`, `Vec`) **asla** `Copy` olamaz: bit kopyası double
  free'ye yol açardı.
- Her `Copy` tipi `clone` da destekler, tersi doğru değildir.
- `clone` bilinçli bir karardır: gerçekten iki bağımsız değer gerekiyorsa kullan; sadece okuyacaksan önce
  oku, sonra taşı (ya da Modül 5'te ödünç ver).
:::

```reflect
prompt: |
  Bir arkadaşın "Rust'ta `E0382` alınca `.clone()` eklerim, sorun çözülür" diyor. Ona ne söylersin?
  `clone`'un ne zaman doğru, ne zaman yanlış olduğunu birer örnekle açıkla.
answer: |
  `clone` hatayı susturur ama her seferinde heap'te yeni yer ayırıp bütün veriyi kopyalar; büyük
  verilerde ya da döngülerde bu ciddi bir yavaşlık olur. Daha önemlisi, asıl soruyu atlatır: değere
  gerçekten iki ayrı yerde sahip olmam gerekiyor mu? Doğru örnek: bir metnin hem değişmemiş hem
  düzenlenmiş hâli lazımsa (taslak ve imzalı sürüm), iki bağımsız değer gerektiği için `clone` doğrudur.
  Yanlış örnek: sadece uzunluğuna bakmak ya da yazdırmak için kopyalamak — işi taşımadan önce yapmak ya da
  değeri ödünç vermek yeterlidir. Kısacası `clone` bir yama değil, gerekçesi olan bir tasarım kararıdır.
```

```flashcards
- front: "`.clone()` bir `String` için bellekte ne yapar?"
  back: Heap'te yeni bir alan ayırır ve bütün baytları oraya kopyalar; sonuç, kendi heap verisine sahip bağımsız ikinci bir `String`'dir.
- front: Taşıma ile `clone` arasındaki maliyet farkı nedir?
  back: Taşıma her zaman sadece stack'teki başlığı (24 bayt) kopyalar; `clone` heap ayırır ve verinin tamamını kopyalar, maliyeti boyutla büyür.
- front: "Hangi standart tipler `Copy`'dir?"
  back: "Tam sayılar, `f32`/`f64`, `bool`, `char`, string literalleri (`&'static str`) ve elemanlarının hepsi `Copy` olan tuple'lar ile diziler."
- front: "`String` neden `Copy` olamaz?"
  back: Bit bit kopyalamak iki başlığın aynı heap alanını göstermesine ve kapsam sonunda double free'ye yol açardı. Kaynak geri veren tipler `Copy` olamaz.
- front: "`let t = (String::from(\"a\"), 1); let u = t;` sonrasında `t` kullanılabilir mi?"
  back: "Hayır. Tuple'ın bir elemanı `String` olduğu için tuple `Copy` değildir ve tamamı taşınır."
- front: "`Copy` ile `clone` arasındaki temel fark nedir?"
  back: "`Copy` otomatiktir ve sadece bitleri kopyalar; `clone` açıkça yazılır ve tipe göre heap verisini de kopyalayabilir."
- front: "`clone` yazmadan önce sorman gereken soru nedir?"
  back: "Gerçekten iki bağımsız değer mi lazım? Sadece okuyacaksam önce okuyup sonra taşırım (ya da ödünç veririm)."
```
