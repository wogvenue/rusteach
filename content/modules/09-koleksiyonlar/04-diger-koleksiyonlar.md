---
id: m09-l04
title: Diğer koleksiyonlar
minutes: 25
type: lesson
objectives:
  - "`HashSet` ile benzersizliği sağlayıp birleşim, kesişim ve fark işlemlerini yapabilmek"
  - "`BTreeMap` ve `BTreeSet` ile anahtarları sıralı tutup aralık sorguları yazabilmek"
  - "`VecDeque` ile iki uçlu kuyruk, `BinaryHeap` ile öncelik kuyruğu kurabilmek"
  - Bir problem için doğru koleksiyonu Big-O maliyetlerine bakarak gerekçesiyle seçebilmek
keywords: [HashSet, BTreeMap, BTreeSet, VecDeque, BinaryHeap, Reverse, küme, kuyruk, öncelik kuyruğu, Big-O]
---

Bir konser girişinde aynı biletin iki kez okutulmasını engellemek, bir banka gişesinde sırayı
yönetmek, acil serviste en ağır hastayı öne almak, bir ajandayı saat sırasıyla göstermek...
Bunların hepsini `Vec` ve biraz sabırla yapabilirsin. Ama yanlış koleksiyonu seçmek, vidayı çekiçle
çakmaya benzer: bir şekilde olur, ama hem yavaş hem de zahmetlidir.

Bu derste standart kütüphanenin geri kalan koleksiyonlarını tanıyacaksın:

| Koleksiyon | Tek cümlede |
|---|---|
| `HashSet<T>` | Her elemandan yalnızca **bir tane**; "bunu daha önce gördüm mü?" sorusuna anında cevap |
| `BTreeMap<K, V>` / `BTreeSet<T>` | Anahtarlarını **her zaman sıralı** tutan harita ve küme |
| `VecDeque<T>` | **İki ucundan** da hızlı ekleme ve çıkarma yapılan kuyruk |
| `BinaryHeap<T>` | Her an **en büyük** (en öncelikli) elemanı veren öncelik kuyruğu |

:::ferris
Rust'ın standart kütüphanesinde yalnızca sekiz genel amaçlı koleksiyon var: diziler (`Vec`,
`VecDeque`, `LinkedList`), haritalar (`HashMap`, `BTreeMap`), kümeler (`HashSet`, `BTreeSet`) ve
`BinaryHeap`. `Vec` prelude'da; diğer yedisi `std::collections` içinde yaşar, yani hepsi için `use`
gerekir. İkisini zaten tanıyorsun; bu dersin sonunda neredeyse hepsini, en önemlisi de **hangisini ne
zaman** seçeceğini bileceksin!
:::

## `HashSet`: her şeyden yalnızca bir tane

Konser girişindeki turnike yalnızca tek bir soruyu sorar: "Bu bilet daha önce okutuldu mu?" Biletin
kime ait olduğu ya da kaç lira olduğu umurunda değildir. İşte **küme (set)** budur: değeri olmayan,
yalnızca anahtarlardan oluşan bir harita. Standart kütüphanede de tam olarak böyle yapılmıştır:
`HashSet<T>` içeride bir `HashMap<T, ()>` taşır. `()` sıfır bayt yer kapladığı için bu "boş değerlerin"
hiçbir maliyeti yoktur. Önce tahmin et:

```predict
code: |
  use std::collections::HashSet;

  fn main() {
      let mut biletler = HashSet::new();
      let a = biletler.insert("A-101");
      let b = biletler.insert("B-202");
      let c = biletler.insert("A-101");
      println!("{a} {b} {c} {}", biletler.len());
  }
options:
  - "true true false 2"
  - "true true true 3"
  - "() () () 2"
  - "true true false 3"
answer: 0
explanation: |
  `HashSet::insert` bir `bool` döndürür: eleman kümede **yoksa** ekler ve `true` döner; zaten varsa
  hiçbir şey yapmaz ve `false` döner. Aynı bilet ikinci kez okutulunca `false` aldık ve küme 2 elemanlı
  kaldı. (`Vec::push` hiçbir şey döndürmez, yani `()`; kümenin `insert`'ü ise sana bilgi verir.)
```

Bu küçük `bool`, çok kullanışlı bir deseni mümkün kılar: bir listedeki tekrarları, **ilk görülme
sırasını bozmadan** ayıklamak. Ayrıca Ders 3'te HashMap için öğrendiğin her şey burada da geçerli:
ekleme, arama ve silme ortalamada O(1), elemanlar `Hash + Eq` olmalı ve dolaşım sırası garanti değil.

```rust
use std::collections::HashSet;

fn main() {
    // Bir anket formunu gönderenler: bazıları formu iki kez göndermiş
    let gonderenler = ["ayse", "mert", "ayse", "can", "mert", "ece"];

    let mut gorulen = HashSet::new();
    let mut benzersiz = Vec::new();
    for kisi in gonderenler {
        // insert, eleman kümede YOKSA ekler ve true döndürür
        if gorulen.insert(kisi) {
            benzersiz.push(kisi);
        }
    }
    println!("{} gönderim, {} kişi: {benzersiz:?}", gonderenler.len(), gorulen.len());

    println!("can katıldı mı? {}", gorulen.contains("can"));
    let silindi = gorulen.remove("can"); // remove da bool döndürür
    println!("can silindi mi? {silindi}, kalan: {}", gorulen.len());
}
```

Kümede **sıra tutmak** için ayrıca bir `Vec` kullandığımıza dikkat et: küme "kim var?" sorusunu,
vektör "hangi sırayla geldiler?" sorusunu cevaplıyor. Diğer dillerdeki karşılıkları: Python'da `set`,
Java'da `HashSet`, C++'ta `std::unordered_set`. JavaScript'in `Set`'i ise elemanları **eklenme
sırasıyla** dolaşır; Rust'ın `HashSet`'i bunu garanti etmez, JS'ten gelenler için klasik bir tuzaktır.

Peki Modül 6'da öğrendiğin struct'lardan birini kümeye koyabilir misin? Tahmin et:

```compiles
code: |
  use std::collections::HashSet;

  struct Konum {
      x: i32,
      y: i32,
  }

  fn main() {
      let mut ziyaret = HashSet::new();
      ziyaret.insert(Konum { x: 1, y: 2 });
      println!("{}", ziyaret.len());
  }
answer: false
error: E0277
explanation: |
  Bir kümenin (ya da HashMap anahtarının) iki şeyi bilmesi gerekir: iki elemanın **eşit** olup
  olmadığını (`Eq`) ve elemandan bir **hash** sayısı nasıl üretileceğini (`Hash`). Senin yazdığın bir
  struct bu yeteneklerle doğmaz; derleyici her biri için bir E0277 verir.
```

:::error
```text
error[E0277]: the trait bound `Konum: Eq` is not satisfied
    --> src/main.rs:10:13
     |
  10 |     ziyaret.insert(Konum { x: 1, y: 2 });
     |             ^^^^^^ -------------------- `Konum` doesn't satisfy the trait bound
     |             |
     |             the trait `Eq` is not implemented for `Konum`
     |
note: required by a bound in `HashSet::<T, S, A>::insert`
...
help: consider annotating `Konum` with `#[derive(Eq)]`
     |
   3 + #[derive(Eq)]
   4 | struct Konum {
     |

error[E0277]: the trait bound `Konum: Hash` is not satisfied
```
Derleyici çözümü de söylüyor: struct'ın üstüne `#[derive(...)]` eklemek. Bu "yetenekler" **trait**'tir
ve `#[derive(PartialEq, Eq, Hash)]` ile tek satırda kazandırılır; ayrıntısı Modül 11'de. O zamana kadar
pratik çözüm: tamsayılardan, `char`'lardan ya da metinlerden oluşan **tuple**'lar zaten `Hash + Eq`'dir.
:::

```rust
use std::collections::HashSet;

fn main() {
    // Izgarada dolaşan bir robot: her kare (x, y) tuple'ı olarak saklanıyor
    let mut ziyaret: HashSet<(i32, i32)> = HashSet::new();
    let yol = [(0, 0), (0, 1), (1, 1), (0, 1), (0, 0)];
    for adim in yol {
        if !ziyaret.insert(adim) {
            println!("{adim:?} daha önce ziyaret edildi");
        }
    }
    println!("{} farklı kare", ziyaret.len());
}
```

```exercise
id: m09-e-ilk-tekrar
title: Kelime zincirinde ilk tekrar
difficulty: 2
prompt: |
  Bir kelime oyununda oyuncular sırayla kelime söylüyor; **daha önce söylenmiş** bir kelimeyi söyleyen
  oyuncu eleniyor. `ilk_tekrar` fonksiyonu söylenen kelimeleri sırasıyla alsın ve oyunu bitiren
  kelimeyi, yani **ilk kez tekrar edilen** kelimeyi döndürsün. Hiç tekrar yoksa `None` döndürsün.

  Dikkat: aranan, listede iki kez geçen ilk kelime değil, **ikinci kez söylendiği an** ilk gelen
  kelimedir. `["elma", "armut", "kiraz", "armut", "elma"]` için cevap `"armut"`: elma'nın tekrarı
  ondan sonra geliyor. Kelimeler tam olarak aynıysa tekrar sayılır.
starter: |
  use std::collections::HashSet;

  fn ilk_tekrar(kelimeler: &[&str]) -> Option<String> {
      todo!()
  }

  fn main() {
      let oyun = ["elma", "armut", "kiraz", "armut", "elma"];
      println!("{:?}", ilk_tekrar(&oyun));
  }
solution: |
  use std::collections::HashSet;

  fn ilk_tekrar(kelimeler: &[&str]) -> Option<String> {
      let mut soylenen = HashSet::new();
      for kelime in kelimeler {
          if !soylenen.insert(*kelime) {
              return Some(kelime.to_string());
          }
      }
      None
  }

  fn main() {
      let oyun = ["elma", "armut", "kiraz", "armut", "elma"];
      println!("{:?}", ilk_tekrar(&oyun));
  }
check: tests
tests: |
  #[test]
  fn ilk_tekrari_bulur() {
      let oyun = ["elma", "armut", "kiraz", "armut", "elma"];
      assert_eq!(ilk_tekrar(&oyun), Some(String::from("armut")), "ikinci kez söylenen ilk kelime \"armut\"");
  }

  #[test]
  fn hemen_tekrar() {
      let oyun = ["kedi", "kedi", "köpek", "köpek"];
      assert_eq!(ilk_tekrar(&oyun), Some(String::from("kedi")), "\"kedi\" art arda iki kez söylendi");
  }

  #[test]
  fn tekrar_yoksa_none() {
      assert_eq!(ilk_tekrar(&["bir", "iki", "üç"]), None, "hiçbir kelime tekrar etmiyor");
  }

  #[test]
  fn bos_liste() {
      assert_eq!(ilk_tekrar(&[]), None, "boş listede tekrar olamaz");
  }
hints:
  - "Şimdiye kadar söylenen kelimeleri bir `HashSet` içinde biriktir ve listeyi baştan sona bir kez dolaş."
  - "`insert`, zaten var olan bir eleman için `false` döndürür. Yani \"daha önce söylendi mi?\" sorusunu ve kaydetme işini tek çağrıda yapar."
  - "`for kelime in kelimeler { if !soylenen.insert(*kelime) { return Some(kelime.to_string()); } }` ve döngü biterse `None`."
explanation: |
  `insert`'ün döndürdüğü `bool` sayesinde kontrol ve kayıt tek adımda yapılıyor; liste **bir kez**
  dolaşılıyor, yani O(n). İç içe iki döngüyle "bu kelime önceki kelimelerin herhangi biriyle aynı mı?"
  diye baksaydın O(n²) olurdu: 100.000 kelimede on milyarlarca karşılaştırma demek.

  `&[&str]` dilimini dolaşınca her eleman bir `&&str` olarak gelir. `*kelime` ile bir referans katmanını
  kaldırıp kümeye düz `&str` koyuyoruz. (Yazmasaydın küme `HashSet<&&str>` olurdu; o da çalışır, ama
  gereksiz bir dolaylılıktır.) Dönüş tipinin `Option<&str>` değil de
  `Option<String>` olmasının sebebi de ilginç: girişte iki ayrı referans katmanı olduğu için
  `Option<&str>` döndürmek, derleyiciye dönen referansın hangisine bağlı olduğunu söylemeyi gerektirir.
  Bu yaşam süresi (lifetime) etiketlerini Modül 12'de öğreneceksin.
```

## Küme işlemleri: birleşim, kesişim, fark

Ali ile Ayşe birlikte çalışma grubu kurmak istiyor: hangi seçmeli dersleri ortak? Hangileri yalnızca
birinde var? Bu sorular matematikteki küme işlemleridir ve `HashSet` hepsini hazır sunar.

```text
           ali                                 ayse
  ┌─────────────────┬──────────────────┬─────────────────┐
  │  Matematik      │  Fizik           │  Biyoloji       │
  │  Tarih          │  Kimya           │  Müzik          │
  └─────────────────┴──────────────────┴─────────────────┘
     ali - ayse        ali & ayse          ayse - ali
     (fark)            (kesişim)           (fark)

  ali | ayse  (birleşim)       : altı dersin hepsi
  ali ^ ayse  (simetrik fark)  : ortadaki sütun HARİÇ hepsi
```

| İşlem | Metot (iterator döndürür) | Operatör (yeni küme) | Anlamı |
|---|---|---|---|
| Birleşim | `a.union(&b)` | `&a \| &b` | en az birinde olanlar |
| Kesişim | `a.intersection(&b)` | `&a & &b` | ikisinde de olanlar |
| Fark | `a.difference(&b)` | `&a - &b` | `a`'da olup `b`'de olmayanlar |
| Simetrik fark | `a.symmetric_difference(&b)` | `&a ^ &b` | yalnızca birinde olanlar |
| Alt küme mi? | `a.is_subset(&b)` | - | `a`'nın her elemanı `b`'de mi? |
| Ayrık mı? | `a.is_disjoint(&b)` | - | hiç ortak eleman yok mu? |

```rust
use std::collections::HashSet;

// Kümeyi sıralı yazdırır (HashSet sırasız olduğu için, yalnızca düzenli çıktı amacıyla)
fn yazdir(baslik: &str, kume: &HashSet<&str>) {
    let mut liste = Vec::new();
    for ders in kume {
        liste.push(*ders);
    }
    liste.sort();
    println!("{baslik}: {liste:?}");
}

fn main() {
    let ali = HashSet::from(["Matematik", "Fizik", "Kimya", "Tarih"]);
    let ayse = HashSet::from(["Fizik", "Biyoloji", "Kimya", "Müzik"]);

    // 1) Metot hâli: yeni bir küme KURMAZ, ortak elemanları tek tek verir
    let mut ortak_sayisi = 0;
    for _ders in ali.intersection(&ayse) {
        ortak_sayisi += 1;
    }
    println!("Ortak ders sayısı: {ortak_sayisi}");

    // 2) Operatör hâli: sonuç YENİ bir HashSet; ali ve ayse yalnızca ödünç alınır
    yazdir("Birleşim  (ali | ayse)", &(&ali | &ayse));
    yazdir("Kesişim   (ali & ayse)", &(&ali & &ayse));
    yazdir("Fark      (ali - ayse)", &(&ali - &ayse));
    yazdir("Sim. fark (ali ^ ayse)", &(&ali ^ &ayse));

    println!("Hiç ortak yok mu? {}", ali.is_disjoint(&ayse));
    let temel = HashSet::from(["Fizik", "Kimya"]);
    println!("Temel dersler Ali'de var mı? {}", temel.is_subset(&ali));
}
```

İki yazımın farkı önemli. **Metot hâli** (`ali.intersection(&ayse)`) yeni bir küme oluşturmaz; ortak
elemanlara birer referans veren ve onları ancak sen istedikçe hesaplayan bir **iterator** döndürür.
Sadece sayacaksan ya da bir kez dolaşacaksan bu en ucuzudur. **Operatör hâli** (`&ali & &ayse`) ise
sonucu yeni bir kümede toplar. İfadedeki ilk `&` ödünç alma işaretidir, ortadaki `&` ise küme
operatörü; iki küme de tüketilmez.

Python kullananlar bu operatörleri tanıyacak: `a | b`, `a & b`, `a - b`, `a ^ b` orada da aynı anlama
gelir. Java'da ise `addAll`, `retainAll` ve `removeAll` kümeyi **yerinde değiştirir**; orijinali
korumak için önce kopyalaman gerekir.

```quiz
question: |
  `let a = HashSet::from(["Ali", "Can", "Ece"]);` ve `let b = HashSet::from(["Can", "Ece", "Mert"]);`
  için `&a - &b` hangi kümeyi verir?
options:
  - '`{"Ali"}`'
  - '`{"Mert"}`'
  - '`{"Ali", "Mert"}`'
  - '`{"Can", "Ece"}`'
answer: 0
explanation: |
  Fark (`difference`), **soldaki** kümede olup sağdakinde **olmayan** elemanlardır: `a`'da olup `b`'de
  olmayan tek isim Ali. Fark simetrik değildir; `&b - &a` ise `{"Mert"}` verirdi. İki farkın birleşimi
  olan `{"Ali", "Mert"}` simetrik farktır (`&a ^ &b`); ortak isimler ise kesişimdir (`&a & &b`).
feedback:
  - "Doğru!"
  - "Bu `&b - &a` olurdu. Yön önemli: fark, soldaki kümeden sağdakini çıkarır."
  - "Bu simetrik fark (`&a ^ &b`): yalnızca birinde olanlar."
  - "Bu kesişim (`&a & &b`): ikisinde de olanlar."
```

## `BTreeMap` ve `BTreeSet`: her zaman sıralı

Ders 3'te `HashMap`'in sırasız olduğunu gördün. Peki plakaları küçükten büyüğe listelemen gerekirse?
Her seferinde anahtarları bir vektöre alıp sıralamak yerine, anahtarlarını **her an sıralı tutan** bir
harita kullanabilirsin. Tahmin et:

```predict
code: |
  use std::collections::BTreeMap;

  fn main() {
      let mut plakalar = BTreeMap::new();
      plakalar.insert(34, "İstanbul");
      plakalar.insert(6, "Ankara");
      plakalar.insert(35, "İzmir");
      plakalar.insert(1, "Adana");
      for (kod, sehir) in &plakalar {
          print!("{kod}:{sehir} ");
      }
      println!();
      if let Some((kod, sehir)) = plakalar.last_key_value() {
          println!("{kod} {sehir}");
      }
  }
options:
  - |
    1:Adana 6:Ankara 34:İstanbul 35:İzmir
    35 İzmir
  - |
    34:İstanbul 6:Ankara 35:İzmir 1:Adana
    1 Adana
  - |
    1:Adana 34:İstanbul 35:İzmir 6:Ankara
    6 Ankara
answer: 0
explanation: |
  `BTreeMap` anahtarları **değerlerine göre** sıralı tutar: tamsayılar için sayısal sıra (1 < 6 < 34 <
  35). Eklenme sırası (ikinci seçenek) hiç önemli değil; anahtarlar metin gibi de sıralanmıyor (üçüncü
  seçenek "1" < "34" < "35" < "6" diye giderdi). `last_key_value()` en büyük anahtarlı çifti
  `Option<(&K, &V)>` olarak verir; Modül 7'deki `if let` ve Modül 2'deki tuple ayrıştırmasıyla iki
  parçayı tek hamlede aldık.

  (Küçük bir bonus: Türkiye'deki ilk 67 plaka kodu, illerin alfabetik sırasıyla verilmiştir. Bu yüzden
  burada sayısal sıra ile şehir adlarının sırası örtüşüyor!)
```

`BTreeMap`'in arayüzü `HashMap` ile neredeyse aynıdır (`insert`, `get`, `remove`, `entry`,
`contains_key`...); farkı içeride, verinin nasıl düzenlendiğindedir. Anahtarlar hash'lenmez,
**karşılaştırılır**: bu yüzden anahtar tipinin `Hash` değil `Ord` (sıralanabilir) olması gerekir.

| | `HashMap` | `BTreeMap` |
|---|---|---|
| Arama, ekleme, silme | ortalama O(1) | O(log n) |
| Dolaşım sırası | yok (her çalıştırmada değişebilir) | anahtara göre artan |
| Anahtar şartı | `Hash + Eq` | `Ord` |
| Aralık sorgusu (`range`) | yok | var |
| En küçük / en büyük anahtar | tüm haritayı taramak gerekir | `first_key_value`, `last_key_value` |

```rust
use std::collections::{BTreeMap, BTreeSet};

fn main() {
    // Günlük program: saat → etkinlik (eklenme sırası karışık)
    let mut program = BTreeMap::new();
    program.insert(13, "Öğle yemeği");
    program.insert(9, "Rust dersi");
    program.insert(15, "Spor");
    program.insert(8, "Kahvaltı");
    program.insert(11, "Toplantı");

    // Dolaşım HER ZAMAN anahtar sırasıyla
    for (saat, etkinlik) in &program {
        println!("{saat:02}:00  {etkinlik}");
    }

    // Aralık sorgusu: 9 dahil, 13 hariç
    println!("--- sabah oturumu ---");
    for (saat, etkinlik) in program.range(9..13) {
        println!("{saat:02}:00  {etkinlik}");
    }

    // En küçük ve en büyük anahtar
    println!("İlk: {:?}", program.first_key_value());
    println!("Son: {:?}", program.last_key_value());

    // İlk kaydı çıkar (kahvaltı bitti)
    let biten = program.pop_first();
    println!("Biten: {biten:?}, kalan: {}", program.len());

    // BTreeSet: benzersiz VE sıralı
    let mut etiketler = BTreeSet::new();
    for e in ["rust", "hız", "güvenlik", "rust", "eşzamanlılık", "hız"] {
        etiketler.insert(e);
    }
    println!("{etiketler:?}");
}
```

`BTreeSet<T>`, `HashSet`'in sıralı kardeşidir: aynı küme işlemlerini (`union`, `intersection`...)
destekler ve sonuçları da sıralı verir. Diğer dillerde C++'ın `std::map`/`std::set`'i ve Java'nın
`TreeMap`/`TreeSet`'i aynı rolü oynar. Python'un yerleşik `dict`'i ise eklenme sırasını korur ama
anahtara göre sıralamaz.

:::warning Metin anahtarlar bayt sırasıyla dizilir
`String` ve `&str` anahtarlar alfabetik değil, Unicode **kod noktası** sırasıyla karşılaştırılır.
İngilizce harfler için ikisi aynı şeydir, ama Türkçe harfler bütün ASCII harflerinden sonra gelir:
bir `BTreeMap`'te `"Çorum"`, `"Zonguldak"`'tan **sonra** listelenir. Bunun nedenini ve çaresini Ders
5'te göreceğiz.
:::

:::deep Neden ikili ağaç değil de B-ağacı?
Okul kitaplarındaki **ikili arama ağacında** her düğüm tek bir anahtar ve iki çocuk işaretçisi tutar.
1 milyon anahtarlı dengeli bir ikili ağaçta bir arama yaklaşık 20 düğüm gezer ve her düğüm bellekte
başka bir yerdedir: 20 kez işlemci önbelleğini (cache) ıskalama riski. Modern işlemcilerde bellekten
veri beklemek, o veriyle hesap yapmaktan çok daha pahalıdır.

Rust'ın `BTreeMap`'i bunun yerine her düğümde **11'e kadar anahtarı yan yana**, sıralı bir dizi
hâlinde tutar (kök dışındaki her düğümde en az 5 anahtar bulunur). Bir düğümün içinde arama, küçük ve
bitişik bir dizide doğrusal taramadır; önbellek dostudur. Ağaç da çok daha basık olur: 1 milyon
anahtar için yalnızca 6-8 seviye. Sonuç: aynı O(log n) karmaşıklığında, pratikte çok daha az bellek
beklemesi. Rust'ın belgelerinde de bu tercih tam bu gerekçeyle açıklanır.
:::

## `VecDeque`: iki ucu açık kuyruk

Bir banka gişesi simülasyonu yazıyorsun: gelen müşteri sıranın **sonuna** girer, gişeye **baştaki**
gider. Bunu `Vec` ile yapsan sona eklemek kolay (`push`), ama baştan çıkarmak için `remove(0)` gerekir
ve Ders 1'den hatırlarsın: `remove(0)` geride kalan **bütün** elemanları birer yuva sola kaydırır. Sırada
100.000 kişi varsa her çağrı yaklaşık 100.000 taşıma demektir; sırayı boşaltmak toplamda milyarlarca
işleme çıkar.

**`VecDeque<T>`** ("double-ended queue", iki uçlu kuyruk) bu sorunu bir **halka tampon (ring buffer)**
ile çözer: elemanları yine bitişik bir bellek bloğunda tutar, ama kuyruğun nerede başladığını gösteren
bir **baş (head)** indeksi saklar. Baştan çıkarmak, elemanları kaydırmak yerine sadece bu indeksi
ilerletir; sona eklerken yer kalmadıysa tamponun başındaki boş yuvalara "sarılır".

```memory
title: VecDeque bir halka tampondur
steps:
  - caption: "`VecDeque::with_capacity(4)` ile 4 yuvalık bir tampon ayrıldı ve 3 kişi `push_back` ile sıraya girdi. `baş`, kuyruğun ilk elemanının yuvasını gösteriyor."
    stack:
      - frame: main
        vars:
          - { name: sira, type: "VecDeque<&str>", value: "ptr · baş=0 · len=3 · cap=4", to: h1, mut: true }
    heap:
      - { id: h1, value: "[0] Ali | [1] Ayşe | [2] Can | [3] -", label: "4 yuvalık tampon" }
  - caption: "`pop_front()` ile Ali gişeye gitti. **Hiçbir eleman kaydırılmadı**; yalnızca `baş` bir yuva ilerledi. (`Vec::remove(0)` olsaydı Ayşe ve Can birer yuva sola taşınırdı.)"
    stack:
      - frame: main
        vars:
          - { name: sira, type: "VecDeque<&str>", value: "ptr · baş=1 · len=2 · cap=4", to: h1, mut: true }
    heap:
      - { id: h1, value: "[0], | [1] Ayşe | [2] Can | [3] -", label: "4 yuvalık tampon" }
  - caption: "Deniz son yuvaya oturdu. Ece için sonda yer kalmadı, ama baştaki boş yuva kullanıldı: tampon bir **halka** gibi başa sarıldı. Mantıksal sıra: Ayşe, Can, Deniz, Ece. Yeniden tahsis yok!"
    stack:
      - frame: main
        vars:
          - { name: sira, type: "VecDeque<&str>", value: "ptr · baş=1 · len=4 · cap=4", to: h1, mut: true }
    heap:
      - { id: h1, value: "[0] Ece | [1] Ayşe | [2] Can | [3] Deniz", label: "4 yuvalık tampon (halka)" }
```

Bu iç yapıyı kendi gözünle görebilirsin: `as_slices()` metodu, tamponun içindeki **iki parçayı**
(baştan tamponun sonuna kadar olan kısım ve başa sarılan kısım) ayrı ayrı gösterir.

```rust
use std::collections::VecDeque;

fn main() {
    let mut sira: VecDeque<&str> = VecDeque::with_capacity(4);
    sira.push_back("Ali");
    sira.push_back("Ayşe");
    sira.push_back("Can");
    println!("kapasite: {}, dilimler: {:?}", sira.capacity(), sira.as_slices());

    let giden = sira.pop_front(); // Ali gişeye gitti
    println!("{giden:?} gitti, dilimler: {:?}", sira.as_slices());

    sira.push_back("Deniz");
    sira.push_back("Ece"); // tamponun sonu doldu: Ece başa "sarılır"
    println!("dilimler: {:?}", sira.as_slices());
    println!("mantıksal sıra: {sira:?}, ilk: {:?}, son: {:?}", sira.front(), sira.back());
    println!("kapasite hâlâ: {}", sira.capacity());
}
```

İndeksle erişim de O(1) kalır: `sira[i]`, içeride `(baş + i) % kapasite` yuvasına bakar. Sık
kullanılan metotlar:

| Metot | Ne yapar? | Maliyet |
|---|---|---|
| `push_back(x)` / `push_front(x)` | sona / başa ekler | O(1), amortize |
| `pop_front()` / `pop_back()` | baştan / sondan çıkarır → `Option<T>` | O(1) |
| `front()` / `back()` | baştakine / sondakine bakar → `Option<&T>` | O(1) |
| `q[i]`, `q.get(i)` | indeksle erişim | O(1) |
| `insert(i, x)` / `remove(i)` | ortaya ekler / ortadan çıkarır | O(min(i, n−i)) |
| `make_contiguous()` | iki parçayı tek bitişik dilim hâline getirir | O(n) |

Python'daki `collections.deque`, Java'daki `ArrayDeque` ve C++'taki `std::deque` aynı işi görür.
Şimdi tahmin et:

```predict
code: |
  use std::collections::VecDeque;

  fn main() {
      let mut sira = VecDeque::new();
      sira.push_back("Ali");
      sira.push_back("Ayşe");
      sira.push_back("Can");
      sira.push_front("Acil");
      let ilk = sira.pop_front();
      let son = sira.pop_back();
      println!("{ilk:?} {son:?} {sira:?}");
  }
options:
  - 'Some("Acil") Some("Can") ["Ali", "Ayşe"]'
  - 'Some("Ali") Some("Acil") ["Ayşe", "Can"]'
  - 'Some("Acil") Some("Ali") ["Ayşe", "Can"]'
answer: 0
explanation: |
  `push_front("Acil")` Acil'i **en öne** koyar: sıra Acil, Ali, Ayşe, Can olur. `pop_front()` baştakini
  (Acil), `pop_back()` sondakini (Can) çıkarır; ortada Ali ve Ayşe kalır. İkinci seçenek
  `push_front`'u "sona ekle" sanan, üçüncü seçenek ise `pop_back`'i "en uzun bekleyeni çıkar" sanan
  birinin cevabı. İsimler, ekleme ve çıkarmanın **hangi uçta** yapıldığını söyler.
```

Gerçek bir kuyruk işleyişinde `while let` (Modül 7) en doğal araçtır: "kuyrukta biri oldukça
sıradakini al".

```rust
use std::collections::VecDeque;

fn main() {
    // Banka gişesi: gelen sona girer, gişeye baştaki gider
    let mut sira = VecDeque::from(["Ayşe", "Mehmet", "Zeynep"]);
    sira.push_back("Burak");
    sira.push_front("Emine teyze"); // 65 yaş üstü: öncelikli müşteri en öne

    println!("Sırada {} kişi, ilk: {:?}", sira.len(), sira.front());
    println!("Üçüncü kişi: {}", sira[2]); // indeksle erişim de O(1)

    let mut numara = 1;
    while let Some(musteri) = sira.pop_front() {
        println!("{numara}. gişe çağrısı: {musteri}");
        numara += 1;
    }
    println!("Sıra boş mu? {}", sira.is_empty());
}
```

`VecDeque`'nin bir başka klasik kullanımı **"son N kayıt"** tutmaktır: yeni kayıt sona eklenir, sınır
aşılınca en eski kayıt baştan atılır. Arama kutusundaki "son aramalar" listesini sen kur:

```fill
prompt: Arama geçmişi en fazla 3 kayıt tutsun. Yeni arama sona eklensin, sınır aşılınca en eskisi atılsın.
code: |
  use std::collections::VecDeque;

  fn main() {
      let mut son_aramalar = VecDeque::new();
      for arama in ["rust", "vec", "hashmap", "btree", "heap"] {
          son_aramalar.___0(arama);
          if son_aramalar.len() > 3 {
              son_aramalar.___1();
          }
      }
      println!("{son_aramalar:?}");
  }
blanks:
  - ["push_back"]
  - ["pop_front"]
output: '["hashmap", "btree", "heap"]'
explanation: |
  Yeni kayıt `push_back` ile sona girer; uzunluk 3'ü aşınca `pop_front` en eski kaydı baştan atar. İki
  işlem de O(1), yani geçmiş ne kadar uzun olursa olsun her arama sabit maliyetlidir. `pop_front`'un
  döndürdüğü `Option`'ı kullanmadığımıza dikkat et: atılan kayıtla işimiz yok.
```

## `BinaryHeap`: öncelik kuyruğu

Bazen sıranın kuralı "ilk gelen" değil, "en önemli olan"dır. Bir sunucu çökmüşse, bekleyen rapor
işinden önce o halledilir. Bu tür kuyruklara **öncelik kuyruğu (priority queue)** denir ve Rust'taki
karşılığı **`BinaryHeap<T>`**'dir: `pop` her zaman o an içindeki **en büyük** elemanı verir. Önce
tahmin et; ikinci satırda yeni bir araç var, `Reverse`:

```predict
code: |
  use std::cmp::Reverse;
  use std::collections::BinaryHeap;

  fn main() {
      let mut isler = BinaryHeap::new();
      isler.push((2, "rapor"));
      isler.push((5, "sunucu"));
      isler.push((1, "kahve"));
      isler.push((5, "fatura"));
      while let Some((oncelik, is)) = isler.pop() {
          print!("{is}({oncelik}) ");
      }
      println!();

      let mut kucukler = BinaryHeap::new();
      for x in [7, 3, 9, 5] {
          kucukler.push(Reverse(x));
      }
      if let Some(Reverse(en_kucuk)) = kucukler.peek() {
          println!("en küçük: {en_kucuk}");
      }
  }
options:
  - |
    sunucu(5) fatura(5) rapor(2) kahve(1)
    en küçük: 3
  - |
    fatura(5) sunucu(5) rapor(2) kahve(1)
    en küçük: 3
  - |
    rapor(2) sunucu(5) kahve(1) fatura(5)
    en küçük: 7
  - |
    kahve(1) rapor(2) fatura(5) sunucu(5)
    en küçük: 9
answer: 0
explanation: |
  `BinaryHeap` bir **max-heap**'tir: `pop` her seferinde en büyük elemanı çıkarır. Elemanlar tuple
  olduğu için Modül 2'deki tuple'lar burada **soldan sağa**, sözlükteki kelimeler gibi karşılaştırılır:
  önce ilk elemanlar; eşitlerse ikinci elemanlar. `(5, "sunucu")` ile `(5, "fatura")` öncelikte
  berabere kalır, ama `"sunucu" > "fatura"` (s, f'den sonra gelir), bu yüzden sunucu önce çıkar.

  `Reverse(x)` ise karşılaştırmayı **ters çeviren** küçük bir sarmalayıcıdır: `Reverse(3) > Reverse(7)`.
  Max-heap'e `Reverse`'ler koyunca tepeye en küçük sayı çıkar; böylece bir **min-heap** elde ederiz.
  `peek` tepedekine yalnızca bakar (O(1)), çıkarmaz. Üçüncü seçenek eklenme sırasını (kuyruk gibi),
  dördüncüsü "küçükten büyüğe" çıkışı varsayıyordu.
```

:::analogy Acil servis triyajı
Acil serviste sıra, geliş saatine göre değil **durumun ağırlığına** göre işler: kalp krizi geçiren
hasta, iki saattir bekleyen burkulmuş bilekten önce içeri alınır. Triyaj hemşiresi bekleyenlerin hepsini
baştan sona sıraya dizmekle uğraşmaz (her yeni hastada bunu yapmak çok yorucu olurdu); yalnızca "şu an
en acil kim?" sorusunun cevabını **her an hazır** tutar. `BinaryHeap` de tam olarak budur: elemanları
tam sıralı tutmaz, sadece en büyüğünü tepede tutar.
:::

Peki "tam sıralı değil ama en büyüğü hep tepede" nasıl oluyor? `BinaryHeap` içeride sıradan bir `Vec`
taşır ve onu bir **ikili ağaç** gibi yorumlar: `i` indeksindeki elemanın çocukları `2i+1` ve `2i+2`
indekslerindedir. Tek kural şudur: **her ebeveyn, çocuklarından büyük ya da onlara eşittir.**

```text
  push sırası: 5, 3, 9, 1, 7

              9          ← kök (indeks 0): her zaman en büyük, peek O(1)
            /   \
           7     5
          / \
         1   3

  iç dizi: [9, 7, 5, 1, 3]     ← sıralı DEĞİL (1, 3'ten önce), ama kural her yerde sağlanıyor
```

`push` yeni elemanı dizinin sonuna koyar ve ebeveyninden büyük olduğu sürece onunla yer değiştirerek
yukarı "kabarcıklandırır"; `pop` kökü alır, son elemanı köke taşır ve onu aşağı doğru yerine
indirir. İkisi de en kötü durumda ağacın yüksekliği kadar adım atar: O(log n). (`push` için belgeler
**ortalama O(1)** der: rastgele gelen bir eleman çoğu zaman bir iki seviye yukarı çıkıp durur. `pop`
ise son elemanı hep kökten aşağı indirdiği için O(log n)'dir.) Her eklemeden sonra bütün vektörü
yeniden sıralamak ise her seferinde O(n log n) olurdu.

```rust
use std::cmp::Reverse;
use std::collections::BinaryHeap;

fn main() {
    let mut yigin = BinaryHeap::new();
    for x in [5, 3, 9, 1, 7] {
        yigin.push(x);
    }
    // İçerideki dizi tam sıralı DEĞİL; yalnızca "her ebeveyn çocuklarından büyük"
    println!("iç dizi: {:?}", yigin.as_slice());
    println!("tepe (peek): {:?}", yigin.peek());
    println!("pop: {:?}, sonra tepe: {:?}", yigin.pop(), yigin.peek());
    println!("sıralı vektör: {:?}", yigin.into_sorted_vec()); // yığını tüketir, artan sıra

    // Reverse ile min-heap: fırın zamanlayıcısı, en erken biten önce
    let mut zamanlayici = BinaryHeap::new();
    zamanlayici.push(Reverse((25, "kek")));
    zamanlayici.push(Reverse((12, "kurabiye")));
    zamanlayici.push(Reverse((40, "börek")));
    zamanlayici.push(Reverse((12, "açma"))); // dakikası eşitse ada bakılır: "açma" < "kurabiye"
    while let Some(Reverse((dakika, ne))) = zamanlayici.pop() {
        println!("{dakika}. dakika: {ne} hazır!");
    }
}
```

Diğer dillerden geçerken dikkat: Python'un `heapq`'u ve Java'nın `PriorityQueue`'su varsayılan olarak
**min-heap**'tir (en küçük önce çıkar), C++'ın `std::priority_queue`'su ve Rust'ın `BinaryHeap`'i ise
**max-heap**. Kod taşırken `Reverse`'i unutmak, kuyruğunu tam tersine çalıştırır!

```exercise
id: m09-e-tedavi-sirasi
title: Acil servis sırası
difficulty: 4
prompt: |
  Bir hastanenin acil servisinde hastalar **aciliyet puanına** göre (1: hafif ... 5: hayati) muayeneye
  alınıyor. Aciliyeti eşit olan hastalar arasında **önce gelen önce** girer; hastanın adı sıralamayı
  hiç etkilemez.

  `tedavi_sirasi` fonksiyonu, **geliş sırasıyla** verilen `(ad, aciliyet)` listesini alsın ve muayene
  sırasını isimler hâlinde döndürsün. Bir `BinaryHeap` kullan.

  İpuçlarına bakmadan önce düşün: yığına **ne** koyarsan hem aciliyete hem de geliş sırasına göre doğru
  hasta tepeye çıkar?
starter: |
  use std::cmp::Reverse;
  use std::collections::BinaryHeap;

  fn tedavi_sirasi(hastalar: &[(&str, u8)]) -> Vec<String> {
      todo!()
  }

  fn main() {
      let sira = tedavi_sirasi(&[("Ali", 2), ("Ayşe", 5), ("Can", 3)]);
      println!("{sira:?}");
  }
solution: |
  use std::cmp::Reverse;
  use std::collections::BinaryHeap;

  fn tedavi_sirasi(hastalar: &[(&str, u8)]) -> Vec<String> {
      let mut bekleme = BinaryHeap::new();
      for (gelis, (ad, aciliyet)) in hastalar.iter().enumerate() {
          bekleme.push((*aciliyet, Reverse(gelis), *ad));
      }
      let mut sira = Vec::new();
      while let Some((_, _, ad)) = bekleme.pop() {
          sira.push(ad.to_string());
      }
      sira
  }

  fn main() {
      let sira = tedavi_sirasi(&[("Ali", 2), ("Ayşe", 5), ("Can", 3)]);
      println!("{sira:?}");
  }
check: tests
tests: |
  #[test]
  fn en_acil_once() {
      let sira = tedavi_sirasi(&[("Ali", 2), ("Ayşe", 5), ("Can", 3)]);
      assert_eq!(sira, vec!["Ayşe", "Can", "Ali"], "aciliyeti yüksek olan önce muayene edilmeli");
  }

  #[test]
  fn esitlikte_once_gelen_once() {
      let sira = tedavi_sirasi(&[("Ali", 3), ("Zeynep", 4), ("Mert", 3), ("Ece", 4)]);
      assert_eq!(sira, vec!["Zeynep", "Ece", "Ali", "Mert"], "aynı aciliyette önce gelen önce girmeli (isme bakılmaz)");
  }

  #[test]
  fn hepsi_ayni_aciliyette() {
      let sira = tedavi_sirasi(&[("Deniz", 2), ("Burak", 2), ("Cem", 2), ("Aylin", 2)]);
      assert_eq!(sira, vec!["Deniz", "Burak", "Cem", "Aylin"], "aciliyetler eşitse geliş sırası aynen korunmalı");
  }

  #[test]
  fn bos_bekleme_salonu() {
      assert!(tedavi_sirasi(&[]).is_empty(), "hasta yoksa sıra da boş olmalı");
  }
hints:
  - "Yığına bir tuple koy: tuple'lar soldan sağa karşılaştırıldığı için ilk eleman `aciliyet` olursa en acil hasta tepeye çıkar. Eşitlikte tuple'ın ikinci elemanı belirleyici olur."
  - "Eşit aciliyette **önce gelen**, yani geliş numarası **küçük** olan \"daha büyük\" sayılmalı. `Reverse(gelis)` tam bunu yapar. Geliş numarasını `for (gelis, (ad, aciliyet)) in hastalar.iter().enumerate()` ile alabilirsin."
  - "`bekleme.push((*aciliyet, Reverse(gelis), *ad));` ile doldur, sonra `while let Some((_, _, ad)) = bekleme.pop() { sira.push(ad.to_string()); }` ile boşalt."
require:
  - pattern: "BinaryHeap\\s*(::|<)"
    message: "Bu alıştırmanın amacı öncelik kuyruğu: bir `BinaryHeap` oluşturup kullan (ör. `BinaryHeap::new()`)."
explanation: |
  Sihir tuple'ın sırasında: `(aciliyet, Reverse(gelis), ad)`. Yığın önce aciliyete bakar; berabere
  kalınca `Reverse(gelis)`'e bakar ve küçük geliş numarası "daha büyük" sayıldığı için önce gelen önce
  çıkar. Ad en sonda duruyor ama hiçbir zaman belirleyici olmuyor, çünkü her hastanın geliş numarası
  farklı. `(aciliyet, ad)` gibi bir tuple kullansaydın eşitlikte isimler ters alfabetik sırayla
  çıkardı; `Reverse`'siz `(aciliyet, gelis)` kullansaydın ise **son gelen** önce girerdi. Testlerdeki
  eşitlik senaryoları tam bu iki hatayı yakalamak için var.

  Sabit bir liste için aynı sonucu "aciliyete göre kararlı (stable) sıralama" ile de alabilirdin
  (Ders 5). `BinaryHeap`'in asıl gücü **dinamik** durumlarda ortaya çıkar: hastalar muayene sürerken
  gelmeye devam ediyorsa her yeni hasta O(log n)'de eklenir ve sıradaki hasta her an hazırdır.
```

## Hangi koleksiyon?: seçim rehberi

Artık bütün takımı tanıyorsun. Doğru seçimi yapmak için her koleksiyonun **neyi ucuz, neyi pahalı**
yaptığını bilmek gerekir. Big-O gösterimi bunun özetidir; sezgi kazanmak için n = 1.000.000 eleman
düşün: O(1) yaklaşık **1** adım, O(log n) yaklaşık **20** adım, O(n) ise **1.000.000** adım demektir.

| Koleksiyon | Güçlü olduğu iş | Tipik maliyetler | Sıra |
|---|---|---|---|
| `Vec<T>` | indeksle erişim, sona ekleme/çıkarma | `v[i]` O(1) · `push`/`pop` O(1)\* · başa/ortaya ekleme O(n) · arama O(n) | eklenme sırası |
| `VecDeque<T>` | iki uçtan ekleme/çıkarma (kuyruk) | `push_front`/`push_back` O(1)\* · `pop_front`/`pop_back` O(1) · `q[i]` O(1) | eklenme sırası |
| `HashMap<K, V>` / `HashSet<T>` | anahtarla arama, benzersizlik | `insert`/`get`/`remove` ortalama O(1) | yok |
| `BTreeMap<K, V>` / `BTreeSet<T>` | sıralı dolaşım, aralık sorgusu, en küçük/en büyük | `insert`/`get`/`remove` O(log n) | anahtara göre artan |
| `BinaryHeap<T>` | sürekli en büyüğü (ya da `Reverse` ile en küçüğü) almak | `peek` O(1) · `push` ortalama O(1) · `pop` O(log n) | yalnızca tepe belli |
| `LinkedList<T>` | (nadiren) iki listeyi O(1)'de birleştirmek | uçlara ekleme/çıkarma O(1) · `i`. elemana ulaşmak O(n) | eklenme sırası |

\* amortize: arada bir yeniden tahsis gerekir ama ortalama maliyet sabittir (Ders 1).

Karar verirken şu soruları sırayla sor:

1. **Emin değil misin? `Vec` ile başla.** Çoğu program için doğru cevaptır.
2. Elemanları **baştan da** çıkarıyor musun (kuyruk)? → `VecDeque`.
3. "Bu anahtarın değeri ne?" diye mi arıyorsun? → `HashMap`. Sonuçları **sıralı** istiyorsan ya da
   aralık sorguluyorsan → `BTreeMap`.
4. Yalnızca "bu var mı?" ya da benzersizlik mi gerekiyor? → `HashSet` (sıralıysa `BTreeSet`).
5. Hep "en acil / en büyük / en erken" olanı mı alıyorsun? → `BinaryHeap`.

:::deep Neden çoğu zaman `Vec`, neden neredeyse hiç `LinkedList`?
Ders kitaplarında bağlı liste (linked list) "ortaya ekleme O(1)" diye övülür. Ama o O(1), ekleme
yapacağın yeri **zaten bulmuşsan** geçerlidir; oraya ulaşmak için düğümleri tek tek gezmek O(n)'dir.
Üstelik her düğüm heap'te ayrı bir tahsistir ve bellekte rastgele yerlere dağılır: bir sonraki düğüme
geçmek, çoğu zaman işlemci önbelleğini ıskalamak demektir. `Vec` ise elemanları yan yana tutar;
işlemci bitişik veriyi önceden önbelleğe çeker ve kaydırma işlemleri bile beklenenden çok hızlıdır.

C++'ın yaratıcısı Bjarne Stroustrup, 2012'deki ünlü bir konuşmasında, rastgele konumlara ekleme ve
silme yapılan bir testte bile vektörün bağlı listeyi büyük farkla geçtiğini göstermişti. Rust'ın kendi
belgeleri de `LinkedList` için aynı uyarıyı yapar: dizi tabanlı `Vec` ve `VecDeque` neredeyse her
zaman daha hızlı ve daha az bellek harcayan seçimdir.
:::

```quiz
question: |
  Bir müzik çalar uygulaması yazıyorsun. Kullanıcı şarkıları çalma listesinin **sonuna** ekliyor;
  sıradaki şarkı her zaman listenin **başından** alınıyor; "Sıradaki olarak çal" düğmesi ise bir şarkıyı
  listenin **en önüne** koyuyor. Çalma kuyruğu için en uygun koleksiyon hangisi?
options:
  - "`Vec<String>`"
  - "`VecDeque<String>`"
  - "`HashSet<String>`"
  - "`BinaryHeap<String>`"
answer: 1
explanation: |
  Üç işlemin üçü de **uçlarda**: sona ekleme (`push_back`), başa ekleme (`push_front`) ve baştan
  çıkarma (`pop_front`). `VecDeque` üçünü de O(1)'de yapar ve eklenme sırasını korur. `Vec` ile de
  çalışır ama baştaki her işlem bütün listeyi kaydırır.
feedback:
  - "Çalışır ama verimsiz: `insert(0, ..)` ve `remove(0)` tüm elemanları kaydırır, O(n)."
  - "Doğru! İki uçta da O(1) işlem ve sıra korunuyor."
  - "Küme sıra tutmaz ve aynı şarkıyı iki kez sıraya koymana izin vermez."
  - "Öncelik kuyruğu sırayı elemanların büyüklüğüne göre belirler; burada ise ekleme sırası önemli."
```

## Özet

:::remember
- **`HashSet<T>`**: benzersiz elemanlar, ortalama O(1). `insert` bir `bool` döndürür (yeni mi?). Elemanlar `Hash + Eq` olmalı; struct'lar için Modül 11'e kadar tuple kullan (yoksa **E0277**).
- **Küme işlemleri**: `union` / `intersection` / `difference` / `symmetric_difference` (iterator) ya da `&a | &b`, `&a & &b`, `&a - &b`, `&a ^ &b` (yeni küme).
- **`BTreeMap` / `BTreeSet`**: anahtarlar her zaman **sıralı**, işlemler O(log n); `range`, `first_key_value`, `last_key_value`, `pop_first`. Anahtar `Ord` olmalı.
- **`VecDeque<T>`**: halka tampon; iki uçta O(1) `push_front`/`push_back`/`pop_front`/`pop_back`. Kuyruğu `Vec::remove(0)` ile kurma!
- **`BinaryHeap<T>`**: max-heap; `pop` en büyüğü verir, `peek` bakar. `Reverse(x)` ile min-heap; tuple'larla çok kriterli öncelik.
- Şüphedeysen **`Vec`**; ihtiyaçların netleşince doğru koleksiyona geç.
:::

```reflect
prompt: |
  Bir sosyal medya uygulaması tasarlıyorsun: (a) bir kullanıcının takip ettiği hesaplar, (b) en fazla
  50 bildirim tutan ve doldukça en eskisini atan bildirim kutusu, (c) zamanlanmış gönderiler (her an en
  erken yayınlanacak olanı bilmek gerekiyor). Her biri için hangi koleksiyonu seçerdin? Neden?
answer: |
  Model cevap: (a) `HashSet<String>` (ya da kullanıcı kimlikleri için `HashSet<u64>`): "bu hesabı
  takip ediyor mu?" sorusu ortalama O(1)'de cevaplanır ve aynı hesap iki kez eklenemez. Listeyi
  alfabetik göstermek gerekiyorsa `BTreeSet` seçilebilir. (b) `VecDeque`: yeni bildirim `push_back`,
  51. bildirimde en eskisi `pop_front`; iki işlem de O(1) ve sıra korunuyor. (c) `Reverse` ile bir
  `BinaryHeap<Reverse<(u64, String)>>` (yayın zamanı, gönderi): en erken gönderi her an tepede, yeni
  gönderi eklemek O(log n). Aynı işi bir `BTreeMap<zaman, gönderi>` ile `first_key_value`/`pop_first`
  kullanarak da yapabilirdin; o zaman zamana göre aralık sorguları da bedavaya gelir.
```

```flashcards
- front: "`HashSet::insert(x)` ne döndürür?"
  back: "`bool`: eleman kümede yoksa ekler ve `true`, zaten varsa hiçbir şey yapmaz ve `false` döndürür."
- front: Bir listedeki tekrarları ilk görülme sırasını bozmadan nasıl ayıklarsın?
  back: "Bir `HashSet` ve bir `Vec` tut: `if gorulen.insert(x) { benzersiz.push(x); }`"
- front: "`&a | &b`, `&a & &b`, `&a - &b`, `&a ^ &b` neyi verir?"
  back: "Sırasıyla birleşim, kesişim, fark (`a`'da olup `b`'de olmayanlar) ve simetrik fark; her biri **yeni** bir küme."
- front: Kendi struct'ını HashSet'e ya da HashMap anahtarına koyunca neden hata alırsın?
  back: "**E0277**: tip `Eq` ve `Hash` olmalı. `#[derive(PartialEq, Eq, Hash)]` ile çözülür (Modül 11); o zamana kadar tuple kullan."
- front: "`HashMap` yerine ne zaman `BTreeMap` seçersin?"
  back: "Anahtarlara göre **sıralı** dolaşım, `range` ile aralık sorgusu ya da en küçük/en büyük anahtar gerektiğinde. Bedeli: O(1) yerine O(log n)."
- front: "Kuyruk için neden `Vec::remove(0)` yerine `VecDeque` kullanılır?"
  back: "`remove(0)` kalan bütün elemanları kaydırır (O(n)); `VecDeque` bir halka tampondur, `pop_front` yalnızca baş indeksini ilerletir (O(1))."
- front: "`BinaryHeap::pop` hangi elemanı verir? En küçüğü nasıl alırsın?"
  back: "En büyüğü (max-heap). En küçük için elemanları `std::cmp::Reverse(x)` ile sarmala."
- front: Tuple'lar nasıl karşılaştırılır?
  back: "Soldan sağa, sözlük sırası gibi: önce ilk elemanlar; eşitlerse ikinciler, sonra üçüncüler..."
```
