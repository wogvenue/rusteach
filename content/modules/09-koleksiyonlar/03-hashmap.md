---
id: m09-l03
title: "HashMap: anahtar-değer depoları"
minutes: 25
type: lesson
objectives:
  - "`HashMap` oluşturup `insert`, `get`, `remove` ve `contains_key` ile kullanabilmek"
  - Anahtar ve değerlerin sahipliğinin haritaya nasıl taşındığını açıklayabilmek
  - "`entry` API ile \"yoksa ekle, varsa güncelle\" desenini tek satırda yazabilmek"
  - Dolaşım sırasının neden garanti olmadığını ve hash fonksiyonunun güvenlikle ilişkisini açıklayabilmek
keywords: [HashMap, anahtar, değer, entry, or_insert, get_mut, SipHash, HashDoS, E0433]
---

Telefon rehberinde "Ayşe"yi arıyorsun. Rehberi baştan sona satır satır mı okursun? Tabii ki hayır:
doğrudan "A" sayfasını açarsın. Bir `Vec` içinde arama yapmak ise rehberi baştan sona okumaktır;
1 milyon kayıtta 1 milyona kadar karşılaştırma demektir.

Bu derste, bir **anahtardan (key)** ona bağlı **değere (value)** neredeyse anında ulaşmanı sağlayan
**`HashMap<K, V>`**'yi öğreneceksin. Python'daki `dict`, JavaScript'teki `Map` ve Java'daki `HashMap`
ile aynı fikir; ama Rust'ın sahiplik kurallarıyla birlikte, ve bir de güvenlikle ilgili ilginç bir
hikâyesi var.

## İlk HashMap'in

`HashMap`, `Vec` ve `String` gibi otomatik olarak kapsamda değildir. Önce tahmin et:

```compiles
code: |
  fn main() {
      let mut stok = HashMap::new();
      stok.insert("elma", 12);
      println!("{stok:?}");
  }
answer: false
error: E0433
explanation: |
  `HashMap` standart kütüphanenin `std::collections` modülünde yaşar ve **prelude**'da (her dosyaya
  otomatik eklenen kısa liste) yoktur. Derleyici `cannot find type HashMap in this scope` der ve
  çözümü de önerir: dosyanın başına `use std::collections::HashMap;` eklemek. Modül 8'de öğrendiğin
  yollar ve `use` konusu tam olarak bu.
```

`use` satırını ekleyince her şey yerine oturur:

```rust
use std::collections::HashMap;

fn main() {
    // Plaka kodu → şehir
    let mut plakalar = HashMap::new();
    plakalar.insert(34, "İstanbul");
    plakalar.insert(6, "Ankara");
    plakalar.insert(35, "İzmir");

    // get: anahtarı ÖDÜNÇ verirsin, Option<&V> alırsın
    match plakalar.get(&6) {
        Some(sehir) => println!("06 → {sehir}"),
        None => println!("06 kayıtlı değil"),
    }
    println!("99 → {:?}", plakalar.get(&99)); // yoksa: None

    println!("35 var mı? {}", plakalar.contains_key(&35));

    // remove: silinen değeri Option<V> olarak geri verir
    let silinen = plakalar.remove(&34);
    println!("Silinen: {silinen:?}, kalan kayıt: {}", plakalar.len());

    // Başlangıç değerleriyle oluşturmak: (anahtar, değer) çiftlerinden bir dizi
    let fiyatlar = HashMap::from([("çay", 15), ("simit", 20), ("poğaça", 25)]);
    println!("Simit {} TL", fiyatlar["simit"]); // yoksa panikler, tıpkı v[i] gibi
}
```

Tipi yazmadık ama derleyici `plakalar`'ın `HashMap<i32, &str>` olduğunu ilk `insert`'ten çıkardı. Bir
haritadaki **tüm anahtarlar aynı tipte, tüm değerler de aynı tipte** olmalıdır. Vektörlerdeki gibi iki
okuma yolu vardır: `m[&k]` anahtar yoksa panikler, `m.get(&k)` ise `None` döndürür.

:::analogy Vestiyer
Bir tiyatronun vestiyerine paltonu verirsin, karşılığında numaralı bir fiş alırsın. Çıkışta fişi
gösterdiğinde görevli yüzlerce askıyı tek tek gezmez: fiş numarası, paltonun **hangi askıda** olduğunu
doğrudan söyler. HashMap'te fiş **anahtar**, palto **değer**; numaradan askının yerini hesaplayan kural
ise **hash fonksiyonudur**. Bu yüzden vestiyerde 10 palto da olsa 10.000 palto da olsa paltonu aynı
hızda geri alırsın.
:::

```quiz
question: "`m: HashMap<String, u32>` için `m.get(\"ali\")` ifadesinin tipi nedir?"
options:
  - "`u32`"
  - "`Option<u32>`"
  - "`Option<&u32>`"
  - "`&u32` (anahtar yoksa panik)"
answer: 2
explanation: |
  Anahtar haritada **olmayabilir** → `Option`. Değer ise haritanın malıdır; `get` onu dışarı taşımaz,
  sadece **ödünç** verir → `&u32`. İkisi birlikte: `Option<&u32>`.

  Dikkat ettiysen anahtarlar `String` olduğu hâlde `&str` ile (`"ali"`) arayabildik; harita buna izin
  verir, arama için `String` oluşturman gerekmez. Değeri kopya olarak almak istersen
  `m.get("ali").copied()` yazabilirsin (`Copy` tipler için).
feedback:
  - "Anahtar yoksa ne dönecek? Rust'ta \"null\" yok; olmayabilecek değerler `Option` ile ifade edilir."
  - "Yarı doğru: `Option` evet, ama değer haritada kalır; sana yalnızca bir referans verilir."
  - "Doğru!"
  - "Panikleyen yol `m[\"ali\"]` indekslemesidir; `get` asla paniklemez."
```

## Sahiplik: haritaya giren kimin?

Bir haritaya `String` gibi sahip olunan değerler koyduğunda ne olur? Tahmin et:

```compiles
code: |
  use std::collections::HashMap;

  fn main() {
      let mut telefonlar = HashMap::new();
      let isim = String::from("Ayşe");
      let numara = String::from("0555 123 45 67");
      telefonlar.insert(isim, numara);
      println!("{isim} kaydedildi");
  }
answer: false
error: E0382
explanation: |
  `insert` anahtarı ve değeri **sahiplenir**: `isim` ve `numara` haritaya **taşındı** (Modül 4'teki
  taşıma kuralı). Artık onların sahibi `telefonlar`; `isim`'i kullanmaya çalışmak E0382 verir.
```

```memory
title: insert sahipliği haritaya taşır
steps:
  - caption: "`isim` ve `numara` iki ayrı `String`; her birinin heap'te kendi baytları var."
    stack:
      - frame: main
        vars:
          - { name: telefonlar, type: "HashMap<String, String>", value: "boş tablo", mut: true }
          - { name: isim, type: String, value: "ptr · len=5 · cap=5", to: h1 }
          - { name: numara, type: String, value: "ptr · len=14 · cap=14", to: h2 }
    heap:
      - { id: h1, value: "A y ş e" }
      - { id: h2, value: "0555 123 45 67" }
  - caption: "`telefonlar.insert(isim, numara)` sonrası: iki `String` da haritanın tablosuna **taşındı**. Heap'teki baytlar yerinde duruyor; değişen yalnızca sahipleri."
    stack:
      - frame: main
        vars:
          - { name: telefonlar, type: "HashMap<String, String>", value: "1 kayıt", to: t1, mut: true }
          - { name: isim, type: String, value: "ptr · len=5 · cap=5", moved: true, note: taşındı }
          - { name: numara, type: String, value: "ptr · len=14 · cap=14", moved: true, note: taşındı }
    heap:
      - { id: t1, value: "[ \"Ayşe\" → \"0555 123 45 67\" ]", label: "haritanın tablosu (iki String'in sahibi)" }
      - { id: h1, value: "A y ş e" }
      - { id: h2, value: "0555 123 45 67" }
  - caption: "`telefonlar` kapsamdan çıkınca harita drop edilir ve sahip olduğu **tüm** anahtar ve değerleri de beraberinde serbest bırakır."
    stack:
      - frame: main
        vars:
          - { name: telefonlar, type: "HashMap<String, String>", value: "drop edildi", moved: true }
    heap:
      - { id: t1, value: "[ ... ]", freed: true }
      - { id: h1, value: "A y ş e", freed: true }
      - { id: h2, value: "0555 123 45 67", freed: true }
```

:::error
```text
error[E0382]: borrow of moved value: `isim`
 --> src/main.rs:8:16
  |
5 |     let isim = String::from("Ayşe");
  |         ---- move occurs because `isim` has type `String`, which does not implement the `Copy` trait
6 |     let numara = String::from("0555 123 45 67");
7 |     telefonlar.insert(isim, numara);
  |                       ---- value moved here
8 |     println!("{isim} kaydedildi");
  |                ^^^^ value borrowed here after move
  |
help: consider cloning the value if the performance cost is acceptable
  |
7 |     telefonlar.insert(isim.clone(), numara);
  |                           ++++++++
```
Derleyicinin önerisi (`clone`) işe yarar ama tek çözüm değildir. Çoğu zaman en temizi, `isim`'i
`insert`'ten **önce** kullanmak ya da sonradan haritanın içinden okumaktır: `telefonlar.get("Ayşe")`.
:::

Kurallar özetle şöyle:

- `Copy` tipler (`i32`, `char`, `bool`...) haritaya **kopyalanır**; orijinali kullanmaya devam edersin.
- `String` gibi sahip olunan tipler haritaya **taşınır**. Harita drop edilince onlar da drop edilir.
- Haritaya **referans** koyarsan (`HashMap<&str, u32>`) harita onları yalnızca ödünç alır. O zaman
  referansların gösterdiği verinin, haritadan **daha uzun** yaşaması gerekir; borrow checker bunu
  denetler (yaşam süreleri, Modül 12).

```rust
use std::collections::HashMap;

fn main() {
    // 1) Sahip olunan anahtarlar: String'ler haritaya taşınır
    let mut notlar: HashMap<String, u32> = HashMap::new();
    let ad = String::from("Elif");
    notlar.insert(ad, 95); // ad artık geçersiz
    notlar.insert(String::from("Can"), 80);

    // Anahtarlar String olsa da &str ile arayabilirsin
    if let Some(not) = notlar.get("Elif") {
        println!("Elif: {not}");
    }

    // 2) Ödünç anahtarlar: harita, cümlenin parçalarına BAKAR (kopya yok)
    let cumle = String::from("bugün hava çok güzel");
    let mut uzunluklar: HashMap<&str, usize> = HashMap::new();
    for kelime in cumle.split_whitespace() {
        uzunluklar.insert(kelime, kelime.chars().count());
    }
    println!("'güzel' kaç harf? {:?}", uzunluklar.get("güzel"));
} // önce uzunluklar, sonra cumle drop edilir: referanslar hiç sarkmaz
```

## Dolaşmak: ve sıra neden garanti değil?

Bir haritayı `for` ile dolaşmak, vektördekine çok benzer: `&harita` üzerinden dolaşınca her adımda bir
`(&K, &V)` çifti alırsın.

```rust
use std::collections::HashMap;

fn main() {
    // Doğu Karadeniz illeri, yaklaşık nüfus (bin kişi)
    let mut nufus = HashMap::new();
    nufus.insert("Rize", 344);
    nufus.insert("Artvin", 169);
    nufus.insert("Trabzon", 818);
    nufus.insert("Giresun", 450);

    // (anahtar, değer) çiftleri: ikisi de referans
    for (il, bin_kisi) in &nufus {
        println!("{il}: {bin_kisi} bin");
    }

    // Yalnızca değerler (ya da .keys() ile yalnızca anahtarlar)
    let mut toplam = 0;
    for n in nufus.values() {
        toplam += n;
    }
    println!("Toplam: {toplam} bin");

    // Değerleri yerinde değiştirmek: values_mut() → &mut V
    for n in nufus.values_mut() {
        *n += 1;
    }
    println!("{nufus:?}");
}
```

Bu programı birkaç kez çalıştır: satırların **sırası** değişebilir! Ne eklenme sırası ne de alfabetik
sıra... Nedenini anlamak için haritanın içine bakalım.

Bir HashMap içeride bir **kova (bucket)** dizisi tutar. Bir anahtar eklediğinde Rust önce anahtarı bir
**hash fonksiyonundan** geçirir: anahtar → dev bir sayı. Bu sayıdan, değerin hangi kovaya konacağı
hesaplanır. Aramada aynı hesap tekrarlanır ve tüm tabloyu gezmeden doğrudan doğru kovaya gidilir. Bu
yüzden ekleme, arama ve silme **ortalamada O(1)**, yani eleman sayısından bağımsızdır.

```text
"Rize"     ──hash──▶ 7203...91 ──▶ 3. kova
"Artvin"   ──hash──▶ 1830...44 ──▶ 0. kova
"Trabzon"  ──hash──▶ 9921...07 ──▶ 6. kova
"Giresun"  ──hash──▶ 5512...38 ──▶ 3. kova  (çakışma! aynı kovada iki anahtar)
```

(Bu, fikri anlatmak için **basitleştirilmiş** bir model. Rust'ın gerçek tablosu çakışan anahtarları
aynı kovada zincirlemez; *açık adresleme* ile tablodaki yakın bir boş yuvaya yerleştirir. Sonuç aynıdır:
ortalamada birkaç yuvaya bakarak anahtar bulunur.)

Dolaşım tablonun yuva sırasıyla yapılır ve bu sıra, anahtarların **hash değerlerine** bağlıdır;
eklenme sırasına değil. Üstelik Rust, her program başladığında hash fonksiyonu için **rastgele bir
tohum (seed)** seçer (hatta aynı programdaki iki harita bile farklı tohum alır): aynı anahtarlar her
çalıştırmada başka kovalara düşebilir. Peki neden bu kadar zahmet?

:::deep HashDoS, hash tablosuna saldırı
2011'de iki güvenlik araştırmacısı, PHP, Java, Python, Ruby ve ASP.NET ile yazılmış web sunucularını
**tek bir HTTP isteğiyle** dakikalarca kilitleyebildiklerini gösterdi. Yöntem basitti: bu dillerin hash
fonksiyonları herkesçe bilindiği için, hepsi **aynı kovaya düşen** binlerce özel form alanı adı üretip
gönderdiler. Aynı kovadaki her yeni anahtar oradaki tüm anahtarlarla karşılaştırılır; ortalamada O(1)
olan ekleme O(n)'e, binlerce eklemenin toplamı O(n²)'ye çıkar ve sunucunun işlemcisi tükenir. Bu
saldırıya **HashDoS** denir.

Rust bu yüzden varsayılan olarak **SipHash 1-3** algoritmasını, her süreçte rastgele seçilen bir
anahtarla kullanır. Saldırgan tohumu bilmediği için hangi anahtarların çakışacağını tahmin edemez.
Bedeli: SipHash, en basit hash fonksiyonlarından biraz yavaştır. Güvenilir verilerle çalışan ve her
nanosaniyenin önemli olduğu programlar (ör. derleyiciler) `rustc-hash` ya da `ahash` gibi crate'lerle
daha hızlı hasher'lar seçebilir. Varsayılanın **güvenli** olması, Rust'ın genel felsefesidir.

(Bir ayrıntı daha: Rust 1.36'dan beri standart `HashMap`, Google'ın *SwissTable* tasarımına dayanan
`hashbrown` uygulamasını kullanır; dünyanın en hızlı hash tablolarından biridir.)
:::

Bunun pratik sonuçları:

- **Sıraya asla güvenme.** Sıralı çıktı istiyorsan anahtarları bir `Vec`'e alıp sırala (Ders 5) ya da
  anahtarları her zaman sıralı tutan `BTreeMap`'i kullan (Ders 4).
- **Anahtar tipi "hash'lenebilir" ve "eşitlik karşılaştırılabilir" olmalı.** `String`, `&str`,
  tamsayılar, `char`, `bool` ve bunlardan oluşan tuple'lar olur. `f64` anahtar **olamaz**, çünkü
  `NaN != NaN`'dır. Kendi struct'larını anahtar yapmak için `#[derive(Hash, PartialEq, Eq)]` gerekir
  (Modül 11).

```quiz
question: Rust'ın `HashMap`'i neden her çalıştırmada rastgele bir hash tohumu kullanır?
options:
  - Programcıyı sıraya güvenmemeye alıştırmak için; elemanları bilerek karıştırır
  - "Saldırganların aynı kovaya düşen anahtarlar üretip haritayı yavaşlatmasını (HashDoS) engellemek için"
  - Rastgele tohum hash hesaplamasını hızlandırdığı için
answer: 1
explanation: |
  Hash fonksiyonu tahmin edilebilir olsaydı, kötü niyetli biri hepsi aynı kovaya düşen binlerce anahtar
  üretip ortalama O(1) işlemleri O(n)'e düşürebilirdi (HashDoS). Rastgele tohum bunu imkânsız kılar.
  Sıranın değişmesi bu güvenlik önleminin bir **yan etkisidir**, amacı değil.
feedback:
  - "Sıranın değişmesi bir yan etki; asıl amaç güvenlik."
  - "Doğru! Bu, 2011'de pek çok dili etkileyen gerçek bir saldırıya karşı alınmış bir önlem."
  - "Aksine: güvenli SipHash, basit hash fonksiyonlarından biraz yavaştır. Rust burada hız yerine güvenliği seçiyor."
```

## Güncellemek: üzerine yazmak, `entry` ve `&mut`

Bir anahtar zaten varken ne yapacağına göre üç durum var:

1. **Üzerine yaz:** `insert` aynı anahtarla tekrar çağrılırsa eski değeri siler ve onu `Some(eski)`
   olarak döndürür. (Anahtar yeniyse `None` döner.)
2. **Yalnızca yoksa ekle:** `m.entry(k).or_insert(v)`
3. **Eski değere göre güncelle:** `*m.entry(k).or_insert(0) += 1;`

`entry(k)`, anahtarın kovasını **bir kez** bulur ve "burası dolu mu, boş mu?" bilgisini tutan bir
**giriş (entry)** döndürür. `or_insert(v)` boşsa `v`'yi yerleştirir ve her iki durumda da değere bir
**`&mut V`** verir. O referansla değeri doğrudan değiştirebilirsin. Önce tahmin et:

```predict
code: |
  use std::collections::HashMap;

  fn main() {
      let mut skor = HashMap::new();
      let eski = skor.insert("mavi", 10);
      let eski2 = skor.insert("mavi", 25);
      skor.entry("kırmızı").or_insert(5);
      skor.entry("mavi").or_insert(100);
      *skor.entry("kırmızı").or_insert(0) += 3;
      println!("{eski:?} {eski2:?} {:?} {:?}", skor.get("mavi"), skor.get("kırmızı"));
  }
options:
  - "None Some(10) Some(25) Some(8)"
  - "None Some(10) Some(100) Some(8)"
  - "Some(10) Some(25) Some(25) Some(3)"
  - "None Some(10) Some(25) Some(5)"
answer: 0
explanation: |
  Adım adım: ilk `insert` yeni anahtar ekler → `None`. İkinci `insert` 10'un üzerine 25 yazar ve
  eskiyi döndürür → `Some(10)`. `entry("kırmızı").or_insert(5)` boş yere 5 koyar.
  `entry("mavi").or_insert(100)` **hiçbir şey yapmaz**, çünkü mavi zaten var (25 kalır).
  Son satır kırmızının değerine bir `&mut` alıp 3 ekler: 5 + 3 = 8.
```

`get_mut` ve `or_default` ile birlikte gerçekçi bir stok örneği:

```rust
use std::collections::HashMap;

fn main() {
    let mut stok: HashMap<&str, u32> = HashMap::new();
    stok.insert("kalem", 40);

    // get_mut: VARSA değiştir → Option<&mut V>
    if let Some(adet) = stok.get_mut("kalem") {
        *adet -= 5; // 5 kalem satıldı
    }

    // entry + or_insert: yoksa başlangıç değeriyle ekle, &mut V döndür
    let defter = stok.entry("defter").or_insert(0);
    *defter += 12; // tedarikçiden 12 defter geldi

    // Aynı iş tek satırda
    *stok.entry("silgi").or_insert(0) += 1;

    // or_default: tipin varsayılan değeriyle başlat (sayılar için 0)
    *stok.entry("kalem").or_default() += 10;

    println!("kalem: {:?}", stok.get("kalem"));
    println!("defter: {:?}", stok.get("defter"));
    println!("silgi: {:?}", stok.get("silgi"));
}
```

`or_default()`, değer tipinin "varsayılan" değerini kullanır: sayılar için `0`, `String` için boş metin,
`Vec` için boş vektör. Bu varsayılanların nereden geldiğini (`Default` trait'i) Modül 11'de göreceğiz.

:::tip `or_insert` argümanını her zaman hesaplar
`m.entry(k).or_insert(pahali_deger())` yazarsan `pahali_deger()` anahtar **zaten varken bile** çağrılır
ve sonucu boşa atılır; çünkü Rust bir fonksiyonun argümanlarını, fonksiyon çağrılmadan önce hesaplar.
Başlangıç değeri pahalıysa (ör. büyük bir `String` ya da dosyadan okunan bir değer)
`or_insert_with(|| pahali_deger())` kullan: `|| ...` küçük bir closure'dır (Ders 5, Modül 14) ve
**yalnızca anahtar yoksa** çalıştırılır. `or_default()` da aynı şekilde tembeldir.
:::

Neden `entry` bu kadar sevilir? "Yoksa ekle, varsa güncelle" işini `contains_key` + `insert` ile
yazarsan anahtarı **iki kez** arar ve hash'lersin; `entry` ise tek aramada iş görür. Ayrıca okuması da
kolaydır. Bu arada, Ders 1'deki ödünç alma dersi haritalar için de geçerli. Tahmin et:

```compiles
code: |
  use std::collections::HashMap;

  fn main() {
      let mut stok = HashMap::new();
      stok.insert("elma", 10);
      let elma = stok.get("elma");
      stok.insert("armut", 5);
      println!("{elma:?}");
  }
answer: false
error: E0502
explanation: |
  Ders 1'deki vektör hatasının ikizi! `elma`, haritanın **içine** işaret eden bir referans
  (`Option<&i32>`) ve `println!`'de hâlâ kullanılıyor; `insert` ise `&mut` ödünç ister. HashMap de
  dolunca büyür ve elemanlarını **yeni bir tabloya taşır** (rehash); eski referans sarkardı. Büyüme
  olmasa bile `insert("elma", ...)` eski değeri silip yerine yenisini koyabilirdi. Borrow checker bu
  ayrıntıların hiçbirine bakmaz; kural her durumda aynıdır. Çözümler: değeri kopyala
  (`let elma = stok.get("elma").copied();`) ya da referansı `insert`'ten önce kullanıp bitir.
```

:::deep Entry'nin içi: Occupied ve Vacant
`entry` aslında bir **enum** döndürür: `Entry::Occupied` (anahtar var) ya da `Entry::Vacant` (yok).
`or_insert` bu iki durumu senin yerine ele alan bir kısayoldur. İstersen enum'u kendin de eşleyebilirsin:

```rust
use std::collections::HashMap;
use std::collections::hash_map::Entry;

fn main() {
    let mut ziyaret: HashMap<&str, u32> = HashMap::new();
    for kullanici in ["ali", "ece", "ali"] {
        match ziyaret.entry(kullanici) {
            Entry::Occupied(mut e) => {
                *e.get_mut() += 1;
                println!("{kullanici} tekrar geldi ({}. ziyaret)", e.get());
            }
            Entry::Vacant(e) => {
                e.insert(1);
                println!("{kullanici} ilk kez geldi");
            }
        }
    }
    // Kısa yazım: varsa değiştir, yoksa ekle (|n| ... bir closure; Ders 5 ve Modül 14)
    ziyaret.entry("ece").and_modify(|n| *n += 1).or_insert(1);
    println!("ece: {:?}", ziyaret.get("ece"));
}
```
:::

## Uygulama: sayaçlar ve gruplar

HashMap'in en klasik iki kullanımı **saymak** ve **gruplamak**tır. Önce çözümlü bir örnek: bir
tekerlemede hangi harfin kaç kez geçtiğini sayalım.

```rust
use std::collections::HashMap;

fn main() {
    let tekerleme = "kırk küp kırk kapak";
    let mut harfler: HashMap<char, u32> = HashMap::new();
    for c in tekerleme.chars() {
        if c.is_alphabetic() {
            *harfler.entry(c).or_insert(0) += 1;
        }
    }

    // HashMap sırasızdır; düzenli bir rapor için anahtarları alıp sıralıyoruz
    let mut anahtarlar = Vec::new();
    for c in harfler.keys() {
        anahtarlar.push(*c);
    }
    anahtarlar.sort(); // sıralamayı Ders 5'te ayrıntılı göreceğiz
    for c in anahtarlar {
        println!("{c}: {}", harfler[&c]);
    }
}
```

Çıktıda `ü` ve `ı`'nın listenin **sonunda** çıktığını göreceksin; nedenini (Unicode sırası) Ders 5'te
konuşacağız. Şimdi aynı deseni kelimeler için kur:

```fill
prompt: Kelime sayacının eksik satırını tamamla. Kelime ilk kez görülüyorsa 0'dan başlasın, her görülüşte 1 artsın.
code: |
  use std::collections::HashMap;

  fn main() {
      let tekerleme = "bir berber bir berbere gel beraber bir berber dükkanı açalım demiş";
      let mut sayac = HashMap::new();
      for kelime in tekerleme.split_whitespace() {
          ___0sayac.___1(kelime).___2(0) += 1;
      }
      println!("{:?} {:?} {:?}", sayac.get("bir"), sayac.get("berber"), sayac.get("gel"));
  }
blanks:
  - ["*"]
  - ["entry"]
  - ["or_insert"]
output: "Some(3) Some(2) Some(1)"
explanation: |
  `sayac.entry(kelime).or_insert(0)` bir `&mut i32` döndürür; değerin kendisine ulaşmak için baştaki
  `*` şarttır. `*` olmadan `+=` bir referansa sayı eklemeye çalışırdı (E0368). `or_default()` da
  yazabilirdin: sayılar için varsayılan değer zaten 0'dır.
```

```exercise
id: m09-e-kelime-frekansi
title: Kelime frekansı
difficulty: 2
prompt: |
  Bir haber sitesi, makalelerde en çok geçen kelimeleri bulmak istiyor. `kelime_frekansi` fonksiyonu
  bir metin alsın ve her kelimenin kaç kez geçtiğini bir `HashMap<String, u32>` olarak döndürsün.

  - Kelimeler bir veya daha fazla boşlukla (sekme ve satır sonu dahil) ayrılmış olabilir.
  - Büyük/küçük harf farkı **gözetilmesin**: `Rust`, `rust` ve `RUST` aynı kelimedir ve anahtar
    olarak **küçük harfli** hâli saklanır.

  (Testlerde `I`/`İ` harfleri yok; standart `to_lowercase()` yeterli.)
starter: |
  use std::collections::HashMap;

  fn kelime_frekansi(metin: &str) -> HashMap<String, u32> {
      todo!()
  }

  fn main() {
      let f = kelime_frekansi("Rust hızlı. Rust güvenli. rust eğlenceli");
      println!("rust: {:?}", f.get("rust"));
  }
solution: |
  use std::collections::HashMap;

  fn kelime_frekansi(metin: &str) -> HashMap<String, u32> {
      let mut frekans = HashMap::new();
      for kelime in metin.split_whitespace() {
          *frekans.entry(kelime.to_lowercase()).or_insert(0) += 1;
      }
      frekans
  }

  fn main() {
      let f = kelime_frekansi("Rust hızlı. Rust güvenli. rust eğlenceli");
      println!("rust: {:?}", f.get("rust"));
  }
check: tests
tests: |
  #[test]
  fn tekrarlari_sayar() {
      let f = kelime_frekansi("elma armut elma kiraz elma");
      assert_eq!(f.get("elma"), Some(&3), "\"elma\" üç kez geçiyor");
      assert_eq!(f.get("armut"), Some(&1));
      assert_eq!(f.len(), 3, "üç farklı kelime var");
  }

  #[test]
  fn buyuk_kucuk_harf_ayrimi_yok() {
      let f = kelime_frekansi("Rust rust RUST");
      assert_eq!(f.get("rust"), Some(&3), "Rust, rust ve RUST aynı kelime sayılmalı");
      assert_eq!(f.len(), 1, "anahtar küçük harfli tek bir kelime olmalı");
  }

  #[test]
  fn fazla_bosluklar_sorun_degil() {
      let f = kelime_frekansi("  çay   simit\tçay \n");
      assert_eq!(f.get("çay"), Some(&2));
      assert_eq!(f.get("simit"), Some(&1));
      assert_eq!(f.len(), 2, "boşluklar kelime sayılmamalı");
  }

  #[test]
  fn bos_metin() {
      assert!(kelime_frekansi("").is_empty(), "boş metinde hiç kelime yok");
  }
hints:
  - "Metni `split_whitespace()` ile kelimelere böl; bu metot birden fazla boşluğu, sekmeyi ve satır sonunu kendisi halleder."
  - "Her kelimeyi `to_lowercase()` ile küçült; bu sana yeni bir `String` verir, anahtar olarak doğrudan onu kullanabilirsin."
  - "Sayacı artıran satır: `*frekans.entry(kelime.to_lowercase()).or_insert(0) += 1;` En sonda haritayı döndürmeyi unutma."
explanation: |
  `to_lowercase()` zaten yeni bir `String` ürettiği için onu anahtar olarak haritaya **taşıyabildik**;
  ayrıca `clone` gerekmedi. `entry` + `or_insert(0)` ilk görülen kelimeyi 0 ile başlatıyor, `+= 1` ise
  her durumda sayacı artırıyor.

  Bilmekte fayda var: `entry` anahtarı **sahip olunan** bir değer olarak (`K`) ister, `get` gibi `&str`
  ile yetinmez. `String` anahtarlı bir haritada anahtar zaten varken bile `entry`'ye bir `String`
  vermen gerekir. Burada bu bedeli `to_lowercase()` zaten ödediği için ek maliyet yok; ama elindeki bir
  `&str` için sırf `entry` çağırmak uğruna `to_string()` yapıyorsan, sıcak döngülerde önce
  `get_mut(kelime)` ile denemek tahsisi önler.

  Fark ettin mi: noktalama işaretleri kelimeye yapışık kalıyor (`"hızlı."` ile `"hızlı"` farklı
  sayılır). Gerçek bir uygulamada kelimeleri ayrıca `trim_matches` gibi metotlarla noktalamadan
  temizlersin. Türkçe metinlerde `I`/`İ` için de Ders 2'deki `turkce_kucuk` fonksiyonunu kullanırdın.

  Bir de en çok geçen kelimeleri sıralamak istersen? HashMap sırasızdır: önce `(kelime, sayı)`
  çiftlerini bir `Vec`'e aktarıp sonra sayıya göre sıralarsın. Bunu Ders 5'te yapacağız.
```

İkinci desen **gruplamak**: değerin kendisi bir koleksiyon olduğunda `or_default` (ya da `or_insert`)
sana o koleksiyona bir `&mut` verir ve doğrudan `push` edebilirsin:
`harita.entry(k).or_default().push(x);` (`Vec`'in varsayılan değeri boş vektördür; yani
`or_insert(Vec::new())` da aynı işi yapar.)

```exercise
id: m09-e-grupla
title: Öğrencileri şehre göre grupla
difficulty: 3
prompt: |
  Bir yaz kampına katılacak öğrencilerin listesi var. Servis planlaması için öğrencileri **geldikleri
  şehre göre** gruplamak gerekiyor. `sehre_gore_grupla` fonksiyonu, anahtarı şehir adı, değeri o
  şehirden gelen öğrencilerin adları olan bir harita döndürsün.

  - Her grupta isimler, listedeki **geliş sırasıyla** yer almalı (sıralama yapma).
  - Öğrenci listesi yalnızca ödünç alınıyor; haritadaki `String`'ler için kopya üretmen gerekecek.
starter: |
  use std::collections::HashMap;

  struct Ogrenci {
      ad: String,
      sehir: String,
  }

  impl Ogrenci {
      fn yeni(ad: &str, sehir: &str) -> Ogrenci {
          Ogrenci { ad: String::from(ad), sehir: String::from(sehir) }
      }
  }

  fn sehre_gore_grupla(ogrenciler: &[Ogrenci]) -> HashMap<String, Vec<String>> {
      todo!()
  }

  fn main() {
      let kamp = vec![
          Ogrenci::yeni("Ali", "Ankara"),
          Ogrenci::yeni("Ayşe", "İzmir"),
          Ogrenci::yeni("Can", "Ankara"),
      ];
      let gruplar = sehre_gore_grupla(&kamp);
      println!("Ankara: {:?}", gruplar.get("Ankara"));
  }
solution: |
  use std::collections::HashMap;

  struct Ogrenci {
      ad: String,
      sehir: String,
  }

  impl Ogrenci {
      fn yeni(ad: &str, sehir: &str) -> Ogrenci {
          Ogrenci { ad: String::from(ad), sehir: String::from(sehir) }
      }
  }

  fn sehre_gore_grupla(ogrenciler: &[Ogrenci]) -> HashMap<String, Vec<String>> {
      let mut gruplar: HashMap<String, Vec<String>> = HashMap::new();
      for ogrenci in ogrenciler {
          gruplar
              .entry(ogrenci.sehir.clone())
              .or_default()
              .push(ogrenci.ad.clone());
      }
      gruplar
  }

  fn main() {
      let kamp = vec![
          Ogrenci::yeni("Ali", "Ankara"),
          Ogrenci::yeni("Ayşe", "İzmir"),
          Ogrenci::yeni("Can", "Ankara"),
      ];
      let gruplar = sehre_gore_grupla(&kamp);
      println!("Ankara: {:?}", gruplar.get("Ankara"));
  }
check: tests
tests: |
  #[test]
  fn ayni_sehirdekiler_ayni_grupta() {
      let kamp = vec![
          Ogrenci::yeni("Ali", "Ankara"),
          Ogrenci::yeni("Ayşe", "İzmir"),
          Ogrenci::yeni("Can", "Ankara"),
      ];
      let g = sehre_gore_grupla(&kamp);
      assert_eq!(g.len(), 2, "iki farklı şehir var: Ankara ve İzmir");
      assert_eq!(g["Ankara"], vec!["Ali", "Can"], "Ankara grubunda Ali ve Can olmalı");
      assert_eq!(g["İzmir"], vec!["Ayşe"]);
  }

  #[test]
  fn gelis_sirasi_korunur() {
      let kamp = vec![
          Ogrenci::yeni("Zeynep", "Rize"),
          Ogrenci::yeni("Mert", "Rize"),
          Ogrenci::yeni("Ece", "Rize"),
      ];
      let g = sehre_gore_grupla(&kamp);
      assert_eq!(g.len(), 1);
      assert_eq!(g["Rize"], vec!["Zeynep", "Mert", "Ece"], "isimler geliş sırasıyla eklenmeli, sıralanmamalı");
  }

  #[test]
  fn bos_liste_bos_harita() {
      assert!(sehre_gore_grupla(&[]).is_empty(), "öğrenci yoksa harita da boş olmalı");
  }
hints:
  - "Boş bir `HashMap<String, Vec<String>>` oluştur ve öğrencileri `for ogrenci in ogrenciler` ile dolaş (`ogrenci` bir `&Ogrenci`)."
  - "`entry(...).or_default()` (ya da `or_insert(Vec::new())`) şehrin vektörüne bir `&mut Vec<String>` verir; ona doğrudan `.push(...)` zincirleyebilirsin."
  - "Öğrenciler ödünç alındığı için alanlarını haritaya taşıyamazsın: `ogrenci.sehir.clone()` ve `ogrenci.ad.clone()` kullan."
explanation: |
  `entry(sehir).or_default()` şehrin grubu yoksa boş bir vektör oluşturuyor ve her iki durumda da o
  vektöre bir `&mut` veriyor; `push` ile öğrenciyi doğrudan gruba ekliyoruz. Tek satırda "grup yoksa
  oluştur, sonra ekle"! `or_insert(Vec::new())` da aynen çalışır ve `Vec::new()` bellek ayırmadığı için
  ucuzdur; ama değer zaten tipin varsayılanıyken Clippy daha kısa olan `or_default()`'u önerir.

  `clone` burada **bilinçli** bir karar: öğrenci listesini yalnızca ödünç aldık, ama dönen harita
  kendi `String`'lerine sahip olmalı. Kopyalamadan yapmanın bir yolu da var: haritayı
  `HashMap<&str, Vec<&str>>` yapıp `ogrenci.sehir.as_str()` gibi referanslar saklamak. O zaman harita,
  öğrenci listesinden daha uzun yaşayamaz; bu tür imzaları yaşam süreleriyle Modül 12'de inceleyeceğiz.
```

## Özet

:::remember
- `HashMap<K, V>` anahtardan değere **ortalama O(1)** erişim sağlar; `use std::collections::HashMap;` şart (yoksa **E0433**).
- `insert(k, v)` → eski değeri `Option<V>` olarak döndürür; `get(&k)` → `Option<&V>`; `remove(&k)` → `Option<V>`.
- `String` gibi sahip olunan anahtar ve değerler haritaya **taşınır**; referans koyarsan veri haritadan uzun yaşamalı.
- `entry(k).or_insert(v)` değere `&mut V` verir: sayaç deyimi `*m.entry(k).or_insert(0) += 1;` Pahalı başlangıç değeri için `or_insert_with(|| ...)` ya da `or_default()`.
- Haritanın içine referans tutarken `insert` yapamazsın (**E0502**): harita büyüyünce elemanlar taşınır.
- Dolaşım sırası **garanti değildir**: SipHash + rastgele tohum (HashDoS koruması). Sıra lazımsa sırala ya da `BTreeMap` kullan.
:::

```reflect
prompt: |
  Bir sayaç için `if m.contains_key(k) { ... } else { m.insert(...) }` yazmak yerine neden `entry`
  API'si tercih edilir? Hem performans hem okunabilirlik açısından açıkla.
answer: |
  Model cevap: `contains_key` ardından `insert` ya da `get_mut` yazmak anahtarı **iki kez** hash'leyip
  arar; `entry` ise kovayı tek aramada bulur ve "dolu mu boş mu" bilgisini bir enum olarak
  (`Occupied`/`Vacant`) saklar. `or_insert` yoksa ekler ve her iki durumda da değere bir `&mut`
  verdiği için "yoksa ekle, varsa güncelle" işi tek ve okunaklı bir ifadeye iner. Ayrıca iki ayrı
  çağrı arasında referans tutmaya çalışırken borrow checker'la boğuşmayı da önler: `entry`, bu deseni
  ödünç alma kurallarına uygun biçimde paketler.
```

```flashcards
- front: "`HashMap`'i kullanmak için dosyanın başına ne yazarsın? Yazmazsan hangi hata çıkar?"
  back: "`use std::collections::HashMap;`, prelude'da olmadığı için yazmazsan **E0433** (*cannot find type*)."
- front: "`m.get(&k)` ne döndürür, neden?"
  back: "`Option<&V>`: anahtar olmayabilir (`Option`), değer haritada kalır ve sadece ödünç verilir (`&V`)."
- front: "Var olan bir anahtarla `m.insert(k, v)` çağırırsan ne olur?"
  back: "Eski değerin üzerine yazılır ve eski değer `Some(eski)` olarak döndürülür (yeni anahtarda `None`)."
- front: "`telefonlar.insert(isim, numara)` sonrası `isim` (`String`) kullanılabilir mi?"
  back: "Hayır. Anahtar haritaya **taşındı** → **E0382**. Önceden kullan, haritadan oku ya da bilinçli olarak `clone` et."
- front: Bir kelime sayacını tek satırda artıran deyim nedir?
  back: "`*sayac.entry(kelime).or_insert(0) += 1;`"
- front: "`entry(k).or_insert(v)` ne döndürür?"
  back: "Değere bir `&mut V`: anahtar yeniyse az önce eklenen `v`'ye, varsa mevcut değere."
- front: HashMap'i dolaşırken sıra neden garanti değildir?
  back: "Sıra anahtarların hash değerlerine (kovalara) bağlıdır ve hash tohumu her süreçte rastgele seçilir."
- front: Rust neden varsayılan olarak SipHash ve rastgele tohum kullanır?
  back: "**HashDoS**'a karşı: saldırgan aynı kovaya düşen anahtarlar üretip işlemleri O(n)'e düşüremesin diye."
```
