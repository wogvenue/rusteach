---
id: m12-l06
title: Yaşam süreleriyle ustalaşmak
minutes: 22
type: lesson
objectives:
  - Generic tip parametreleri, trait sınırları ve yaşam sürelerini birlikte içeren imzaları okuyup yazabilmek
  - Birden fazla yaşam süresi parametresinin (`'a`, `'b`) ne zaman gerektiğine karar verebilmek
  - "Sık görülen yaşam süresi hatalarını uygun reçeteyle (sahipli döndürme, ödünçleri bölme, yeniden yapılandırma) düzeltebilmek"
  - Girdisini kopyalamadan `&str` dilimleri döndüren bir sözcük ayırıcı (tokenizer) yazabilmek
keywords: [lifetime, generic, trait, where, "'a 'b", split borrow, tokenizer, zero-copy, E0502]
---

Artık yaşam sürelerinin bütün parçalarını tanıyorsun: anotasyonlar, struct'lar, elision, `'static` ve
sınırlar. Bu son derste parçaları birleştireceğiz. Gerçek dünyadaki imzaları okuyacak, birden fazla yaşam
süresinin gerçekten gerektiği durumu göreceksin. Sık karşılaşılan hatalar için bir reçete defteri
çıkaracak, sonunda da girdisini hiç kopyalamayan bir sözcük ayırıcı yazacaksın.

:::ferris
Bu ders biraz uzun, ama sonunda standart kütüphanenin imzaları sana yabancı gelmeyecek. Gerçek bir
"Rustacean" gibi okumaya hazır mısın? 🦀
:::

## Hepsi bir arada: generic, trait sınırı ve yaşam süresi

Modül 11'deki generic'ler ve trait sınırları, bu modüldeki yaşam süreleriyle **aynı köşeli parantezi**
paylaşır. Bir duyuru yaparak en uzun metni seçen bir fonksiyon yazalım:

```rust
use std::fmt::Display;

fn en_uzun_duyurulu<'a, T>(x: &'a str, y: &'a str, duyuru: T) -> &'a str
where
    T: Display,
{
    println!("Duyuru: {duyuru}");
    if x.len() >= y.len() { x } else { y }
}

fn main() {
    let sonuc = en_uzun_duyurulu("Trabzon", "Muş", 2024);
    println!("Kazanan: {sonuc}");
}
```

Okuma sırası:

- `<'a, T>`: Bir yaşam süresi parametresi ve bir tip parametresi. **Yaşam süreleri her zaman önce gelir.**
  `<T, 'a>` yazarsan derleyici reddeder: *lifetime parameters must be declared prior to type and const
  parameters*.
- `x: &'a str, y: &'a str ... -> &'a str`: Sonuç `x` ya da `y`'ye bağlı (ders 2).
- `duyuru: T` ve `where T: Display`: `duyuru` herhangi bir yazdırılabilir tip. Referans değil, sonuçla
  ilişkisi yok (Modül 11'deki `where`).

Yaşam süreleri ve generic'ler struct'larda ve `impl` bloklarında da birlikte kullanılır. Kural aynı:
`impl` satırında önce tanımla, sonra kullan.

```rust
use std::fmt;

// Bir yarışmanın birincisine bakan, kopyasız bir özet
struct Birinci<'a, T> {
    yarisma: &'a str,
    kayit: &'a T,
}

impl<T: fmt::Display> fmt::Display for Birinci<'_, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} birincisi: {}", self.yarisma, self.kayit)
    }
}

fn main() {
    let puanlar = [87.5, 92.0, 78.25];
    let ad = String::from("Matematik olimpiyatı");
    let b = Birinci { yarisma: &ad, kayit: &puanlar[1] };
    println!("{b}");
}
```

`impl<T: fmt::Display> fmt::Display for Birinci<'_, T>` cümlesi: "`Display` olan her `T` ve **her yaşam
süresi** için, `Birinci`'ye `Display` uygula." Yaşam süresinin adına gövdede ihtiyacımız olmadığı için `'_`
yazdık (ders 4).

:::deep Edition 2024: `impl Trait` dönüşleri yaşam sürelerini yakalar
Modül 11'de dönüş tipi olarak `impl Trait` yazmayı gördün. Edition 2024'te `fn f(s: &str) -> impl Display`
gibi bir imza, dönen değerin `s`'nin yaşam süresini **kullanabileceğini** varsayar. Buna "yakalama"
(capture) denir. Yani `s`'yi doğrudan döndürebilirsin. Eski edition'larda bunun için `-> impl Display + '_`
yazmak gerekiyordu. Daha eski kodlarda bu `+ '_` ekini görürsen sebebi budur. Bir yaşam süresinin
yakalanmasını **istemediğin** nadir durumlar için `-> impl Display + use<>` yazımı vardır. Bu konuya Modül
22'de döneceğiz.
:::

## İmzaları okumak: üç soruluk yöntem

Karmaşık bir imzayla karşılaştığında şu üç soruyu sırayla sor:

1. **Hangi parametreler tanımlı?** Köşeli parantezdeki yaşam süreleri ve tipler.
2. **Çıktıdaki her referans hangi girdiye bağlı?** Açık yazılmışsa adlara bak. Yazılmamışsa elision
   kurallarını uygula.
3. **Sınırlar ne istiyor?** Trait sınırları (`T: Display`) ve yaşam süresi sınırları (`T: 'a`, `'b: 'a`).

Standart kütüphaneden birkaç gerçek imza, elision'ı açılmış hâlleriyle:

| İmza (belgedeki gibi) | Açık hâli | Anlamı |
|---|---|---|
| `Vec::first(&self) -> Option<&T>` | `fn first<'s>(&'s self) -> Option<&'s T>` | İlk eleman vektör ödüncü kadar geçerli |
| `str::trim(&self) -> &str` | `fn trim<'s>(&'s self) -> &'s str` | Kırpılmış dilim aynı metne bakar |
| `str::split_once(&self, ayrac) -> Option<(&str, &str)>` | iki parça da `&'s str` | Parçalar ayraca değil, metne bağlı |
| `HashMap::get(&self, k: &Q) -> Option<&V>` | `fn get<'s, 'k>(&'s self, k: &'k Q) -> Option<&'s V>` | Sonuç haritaya bağlı, anahtara değil |

Modül 15'te yazacağın komut satırı aracının kalbinde de şöyle bir imza olacak:

```quiz
question: |
  `fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>` imzası için hangisi doğrudur?
options:
  - "Dönen satırlar `sorgu` ve `icerik`'ten kısa yaşayanı kadar geçerlidir"
  - "Dönen satırlar `icerik`'in parçalarıdır ve `icerik` yaşadığı sürece geçerlidir. `sorgu` hemen ölebilir"
  - "Dönen satırlar yeni `String`'lerdir, hiçbir şeye bağlı değildir"
  - "Bu imza E0106 verir, çünkü `sorgu`'nun yaşam süresi yazılmamış"
answer: 1
explanation: |
  Sadece `icerik` ve dönüş tipi `'a`'yı paylaşıyor. Fonksiyon, içerikteki **satırların dilimlerini**
  döndürüyor. `sorgu` yalnızca aramada okunuyor, bu yüzden adsız bırakılmış. Çağıran, sorguyu geçici
  bir değerden verip sonuçları uzun süre kullanabilir. Adsız bırakılan `sorgu`'ya elision Kural 1 ile
  ayrı bir yaşam süresi verir ve çıktıyla ilişkilendirmez. İmza tamamen geçerli.
feedback:
  - "Bu, iki parametreye de `'a` verilseydi doğru olurdu."
  - "Doğru! Sonuç yalnızca içeriğe bağlı."
  - "`Vec<&'a str>` referanslardan oluşan bir vektör. Satırlar kopyalanmıyor."
  - "Çıktının yaşam süresi açıkça yazıldığı için elision'a gerek yok. `sorgu`'nun adsız kalması sorun değil."
```

## Birden fazla yaşam süresi: `'a` ve `'b`

Şimdiye kadar çoğunlukla tek bir `'a` yettiği için iki ayrı yaşam süresi gereksiz gibi görünebilir. Ders
4'teki hava durumu fonksiyonunu hatırla. İmzası E0106 vermişti, çünkü `&[(&str, i32)]` içinde **iki**
referans var. Derleyicinin önerisi her yere aynı `'a`'yı koymaktı:

```rust
fn esik_ustu<'a>(olcumler: &'a [(&'a str, i32)], esik: i32) -> Vec<&'a str> {
    let mut sonuc = Vec::new();
    for &(sehir, sicaklik) in olcumler {
        if sicaklik > esik {
            sonuc.push(sehir);
        }
    }
    sonuc
}

fn main() {
    let olcumler = [("Adana", 38), ("Rize", 24), ("İzmir", 35)];
    println!("{:?}", esik_ustu(&olcumler, 30));
}
```

Bu derlenir ve çoğu kullanımda çalışır. Ama ölçüm listesi geçici, şehir adları kalıcıysa? Tahmin et:

```compiles
code: |
  fn esik_ustu<'a>(olcumler: &'a [(&'a str, i32)], esik: i32) -> Vec<&'a str> {
      let mut sonuc = Vec::new();
      for &(sehir, sicaklik) in olcumler {
          if sicaklik > esik {
              sonuc.push(sehir);
          }
      }
      sonuc
  }

  fn main() {
      let adana = String::from("Adana");
      let rize = String::from("Rize");
      let sicak_sehirler;
      {
          let bugun = vec![(adana.as_str(), 38), (rize.as_str(), 24)];
          sicak_sehirler = esik_ustu(&bugun, 30);
      }
      println!("{sicak_sehirler:?}");
  }
answer: false
error: E0597
explanation: |
  Sonuçtaki `&str`'ler aslında `adana` ve `rize`'ye bakıyor ve onlar hâlâ yaşıyor. Ama imza tek bir
  `'a` kullandığı için, sonucu **dilimin ödüncüne** de bağladı. `bugun` vektörü iç blokta ölüyor.
  Derleyici imzaya güvenir: "`bugun` yeterince uzun yaşamıyor." Tek `'a`, var olmayan bir ilişki tarif etti.
```

:::analogy Broşür ve adresler
Bir emlakçı sana, gezebileceğin evlerin adreslerini yazdığı bir broşür veriyor. Broşürü okuyup ilgini
çeken iki adresi defterine not ettin, sonra broşürü çöpe attın. Defterindeki adresler geçersiz mi oldu?
Hayır! Adresler **broşüre** değil, **evlere** bakıyor. Evler yerinde durduğu sürece adreslerin geçerli.

Tek `'a` kullanan imza, "broşürü atarsan defterindeki adresler de geçersiz olur" demek gibi: güvenli,
ama gereksiz bir kısıtlama. Broşürün ömrü (`'a`) ile evlerin ömrü (`'b`) iki ayrı şeydir.
:::

Çözüm, iki ayrı referansa iki ayrı ad vermek ve sonucu **doğru olana** bağlamaktır:

```rust
fn esik_ustu<'a, 'b>(olcumler: &'a [(&'b str, i32)], esik: i32) -> Vec<&'b str> {
    let mut sonuc = Vec::new();
    for &(sehir, sicaklik) in olcumler {
        if sicaklik > esik {
            sonuc.push(sehir); // sehir: &'b str, dilimin içinden KOPYALANAN bir referans
        }
    }
    sonuc
}

fn main() {
    let adana = String::from("Adana");
    let rize = String::from("Rize");
    let sicak_sehirler;
    {
        let bugun = vec![(adana.as_str(), 38), (rize.as_str(), 24)];
        sicak_sehirler = esik_ustu(&bugun, 30);
    } // bugun öldü; sonuç ona değil şehir adlarına bağlı
    println!("{sicak_sehirler:?}");
}
```

Neden mümkün? `for &(sehir, sicaklik) in olcumler` satırında `sehir`, dilimin içindeki `&'b str`'nin
bir **kopyasıdır**. Paylaşılan referanslar `Copy`'dir (Modül 5). Kopyalanan referans, içinden çıktığı dilime değil,
baktığı metne bağlıdır.

```memory
title: "İki ayrı yaşam süresi: dilim ('a) ve şehir adları ('b)"
steps:
  - caption: "`olcumler` (`'a`) iç bloktaki `bugun` vektörüne bakıyor. Vektörün içindeki `&str`'ler (`'b`) ise dışarıdaki `adana` ve `rize`'nin heap verisine bakıyor."
    stack:
      - frame: main
        vars:
          - { name: adana, type: String, value: "ptr · len=5", to: h1 }
          - { name: rize, type: String, value: "ptr · len=4", to: h2 }
      - frame: "iç blok"
        vars:
          - { name: bugun, type: "Vec<(&str, i32)>", value: "ptr · len=2", to: h3 }
    heap:
      - { id: h1, value: "Adana" }
      - { id: h2, value: "Rize" }
      - { id: h3, value: "(→Adana, 38) | (→Rize, 24)", to: h1 }
  - caption: "Blok bitti, `bugun` serbest bırakıldı. `sicak_sehirler` içindeki referans hâlâ geçerli, çünkü `'b`'ye, yani `adana`'nın verisine bağlı."
    stack:
      - frame: main
        vars:
          - { name: adana, type: String, value: "ptr · len=5", to: h1 }
          - { name: rize, type: String, value: "ptr · len=4", to: h2 }
          - { name: sicak_sehirler, type: "Vec<&str>", value: "ptr · len=1", to: h4 }
    heap:
      - { id: h1, value: "Adana" }
      - { id: h2, value: "Rize" }
      - { id: h3, value: "(serbest bırakıldı)", freed: true }
      - { id: h4, value: "→Adana", to: h1 }
```

Ne zaman birden fazla yaşam süresi gerekir? Pratik kural:

> **Tek bir `'a` ile başla.** Bir çağıran, gerçekte güvenli olan bir kullanım yüzünden reddediliyorsa,
> birbirinden bağımsız referanslara ayrı adlar ver.

Ayrı adlar verdiğinde, gövde iki yaşam süresini **karıştırırsa** derleyici yine uyarır:

:::error
```text
error: lifetime may not live long enough
 --> src/main.rs:2:39
  |
1 | fn sec<'a, 'b>(x: &'a str, y: &'b str) -> &'a str {
  |        --  -- lifetime `'b` defined here
  |        |
  |        lifetime `'a` defined here
2 |     if x.len() > y.len() { x } else { y }
  |                                       ^ function was supposed to return data with lifetime `'a` but it is returning data with lifetime `'b`
  |
  = help: consider adding the following bound: `'b: 'a`
```
Önerilen `'b: 'a` sınırı (ders 5) "`'b`, en az `'a` kadar yaşar" demektir. Öyle olursa `'b` yaşam süreli
bir referans, `'a` beklenen yere güvenle sığar: `fn sec<'a, 'b: 'a>(...)`. Bu derlenir, ama bu örnekte
ikisine aynı `'a`'yı vermekle **aynı anlama** gelir. Sonuç hâlâ ikisine birden bağlıdır. Ayrı adlar ancak
sonuç gerçekten sadece birine bağlıysa işe yarar.
:::

## Sık hatalar ve çözüm reçeteleri

Bir yaşam süresi hatası aldığında önce **kim sahip, kim ödünç alıyor, ne kadar süreyle** sorularını sor
(Modül 5). Sonra aşağıdaki reçetelerden uygun olanı seç:

| Belirti | Kök neden | Reçete |
|---|---|---|
| E0515, ya da E0106 + "`'static` kullan" önerisi | Fonksiyon içinde **üretilen** veriye referans döndürülüyor | Sahipli döndür: `String`, `Vec<T>` |
| Döngüde E0597 | Değer, onu tutan koleksiyondan kısa yaşıyor | Sahipliği sakla ya da değeri döngü dışına al |
| `&mut self` metodu yüzünden E0502 | Metot `self`'in **tamamını** ödünç alıyor | Ödünçleri böl: alanlara doğrudan eriş ya da parçaları birlikte döndüren bir metot yaz |
| `&mut` alan bir fonksiyonun sonucu yaşarken E0502 | Dönen `&` referans, `&mut` ödüncünü uzatır | Sonucu kısa kullan, gerekirse sonra yeniden ödünç al |
| *lifetime may not live long enough* | İmza yanlış ilişki tarif ediyor | Sonucu doğru parametreye bağla, gerekirse `'b: 'a` |
| `<'a>` her yere bulaşıyor | Uzun yaşayan bir tipte referans saklanıyor | Sahipli alanlara geç ya da referans yerine **indeks** sakla |

En sinsi ikisini yakından inceleyelim. İlki **ödünçleri bölmek (splitting borrows)**. Bir oyuncu nesnesi
düşün. Adını okuyup puanlarını güncellemek istiyoruz:

```compiles
code: |
  struct Oyuncu {
      isim: String,
      puanlar: Vec<u32>,
  }

  impl Oyuncu {
      fn isim(&self) -> &str {
          &self.isim
      }
      fn puanlar_mut(&mut self) -> &mut Vec<u32> {
          &mut self.puanlar
      }
  }

  fn main() {
      let mut o = Oyuncu { isim: String::from("Ece"), puanlar: vec![10] };
      let isim = o.isim();
      o.puanlar_mut().push(20);
      println!("{isim}: {:?}", o.puanlar);
  }
answer: false
error: E0502
explanation: |
  `isim` ve `puanlar` farklı alanlar, gerçekte çakışmıyorlar. Ama metot imzaları **bütün `self`'i**
  ödünç alıyor: `isim()` elision Kural 3 ile sonucu `&self`'e, yani `o`'nun tamamına bağlıyor. `isim`
  yaşarken `o`'nun tamamı `&` ile ödünçte. `puanlar_mut()` ise `o`'nun tamamını `&mut` istiyor. Derleyici
  metot gövdelerine bakmadığı için hangi alanlara dokunulduğunu bilemez.
```

Derleyici **alan erişimlerinde** ödünçleri böler. `o.isim` ve `o.puanlar` doğrudan yazıldığında iki ayrı
yer olarak takip edilir. Metotlar ise yalnızca imzalarıyla görüldüğü için bu bilgi kaybolur. İki çözüm:

```rust
struct Oyuncu {
    isim: String,
    puanlar: Vec<u32>,
}

impl Oyuncu {
    // Çözüm 2: iki alanı aynı anda, ayrı ayrı ödünç veren bir metot
    fn parcalar(&mut self) -> (&str, &mut Vec<u32>) {
        (&self.isim, &mut self.puanlar)
    }
}

fn main() {
    let mut o = Oyuncu { isim: String::from("Ece"), puanlar: vec![10] };

    // Çözüm 1: aynı modül içindeysen alanlara doğrudan eriş: derleyici ödünçleri böler
    let isim = &o.isim;
    o.puanlar.push(20);
    println!("{isim}: {:?}", o.puanlar);

    let (isim, puanlar) = o.parcalar();
    puanlar.push(30);
    println!("{isim}: {puanlar:?}");
}
```

İkinci sinsi durum, `&mut` alan bir fonksiyonun **paylaşılan** bir referans döndürmesidir. Tahmin et:

```compiles
code: |
  fn ekle_ve_al<'a>(liste: &'a mut Vec<String>, yeni: &str) -> &'a String {
      liste.push(yeni.to_string());
      &liste[liste.len() - 1]
  }

  fn main() {
      let mut sepet = vec![String::from("elma")];
      let son = ekle_ve_al(&mut sepet, "armut");
      println!("{} ürün", sepet.len());
      println!("son eklenen: {son}");
  }
answer: false
error: E0502
explanation: |
  `son` sadece bir `&String`, okumaya izin veriyor gibi görünüyor. Ama imza onu `&'a mut Vec` ödüncüne
  bağlıyor: `son` yaşadığı sürece **`&mut` ödünç de** yaşıyor. Bu sürede `sepet.len()` gibi bir okuma bile
  yapılamaz. Bir `&mut`'tan türetilen referans, onu "aşağı çevirmez" (downgrade). Bu, Rust'ın bilerek
  yaptığı muhafazakâr bir seçim. Çözüm sıralamadır: Önce `son`'u kullan, sonra `sepet`'e dokun. Ya da
  `son`'u bırakıp `sepet.last()` ile yeniden ödünç al.
```

:::deep Bugünkü borrow checker'ın bilinen bir sınırı
Şu fonksiyon güvenli olduğu hâlde bugün **derlenmez** (E0502):

```text
fn bul_veya_ekle(harita: &mut HashMap<u32, String>, k: u32) -> &String {
    if let Some(v) = harita.get(&k) {
        return v;                          // bu kol döndüğü için ödünç fonksiyonun sonuna kadar uzar...
    }
    harita.insert(k, String::from("yeni")); // ...ve burada &mut ile çakışır
    harita.get(&k).unwrap()
}
```

Koşullu olarak döndürülen bir referansın ödüncü, NLL'de **bütün** fonksiyon boyunca sürüyormuş gibi
hesaplanır. Rust ekibinin geliştirdiği yeni nesil borrow checker **Polonius** bu kodu kabul edecek. O
zamana kadar idiomatik çözüm, Modül 9'daki `entry` API'sidir. Hem daha kısa hem de anahtarı yalnızca bir
kez arar:

```text
fn bul_veya_ekle(harita: &mut HashMap<u32, String>, k: u32) -> &String {
    harita.entry(k).or_insert(String::from("yeni"))
}
```

Hata aldığında kodunun gerçekten yanlış olduğunu varsayman genellikle doğrudur. Ama nadiren
borrow checker'ın bu tür sınırlarına da takılabilirsin. Çözüm o zaman da genellikle kodu yeniden
yapılandırmaktır.
:::

## Proje: kopyasız sözcük ayırıcı

Metin işleyen programların (arama motorları, derleyiciler, yazım denetleyicileri) ilk adımı metni
parçalara, yani **token**'lara ayırmaktır. Rust'ta bu iş, girdinin tek bir baytını bile kopyalamadan
yapılabilir. Her token, girdinin bir dilimi olur.

Önce tamamlanmış bir örnek: harf ya da rakam dizilerini sözcük sayan bir ayırıcı. `char_indices()` her
karakteri **bayt konumuyla** birlikte verir (Modül 9). Bu yüzden dilimleri her zaman karakter
sınırlarından keseriz ve `ş`, `ğ` gibi harflerde panik yaşanmaz:

```rust
fn sozcukler(metin: &str) -> Vec<&str> {
    let mut sonuc = Vec::new();
    let mut baslangic: Option<usize> = None; // açık bir sözcük var mı, nerede başladı?

    for (i, c) in metin.char_indices() {
        if c.is_alphanumeric() {
            if baslangic.is_none() {
                baslangic = Some(i); // yeni sözcük başlıyor
            }
        } else if let Some(b) = baslangic {
            sonuc.push(&metin[b..i]); // sözcük bitti: girdinin bir dilimi
            baslangic = None;
        }
    }
    if let Some(b) = baslangic {
        sonuc.push(&metin[b..]); // metin bir sözcükle bitiyorsa
    }
    sonuc
}

fn main() {
    let yazi = String::from("Merhaba, dünya! Rust 2024'te çok güzel.");
    let parcalar = sozcukler(&yazi);
    println!("{parcalar:?}");
    println!("{} sözcük, 0 kopya", parcalar.len());
}
```

İmzaya dikkat: `fn sozcukler(metin: &str) -> Vec<&str>`. Elision Kural 2 sayesinde hiç `'a` yazmadık.
Her token `metin`'e bağlı ve `yazi` yaşadığı sürece geçerli. `is_alphanumeric()`, karakter harf ya da
rakamsa `true` döner ve Türkçe harfleri de tanır.

Şimdi aynı fikirle daha küçük bir fonksiyonu sen kur. Bir cümledeki **en uzun** sözcüğü, kopyalamadan
döndür:

```parsons
prompt: "Satırları sıraya koyarak, cümledeki en uzun (bayt olarak) sözcüğü **dilim olarak** döndüren fonksiyonu kur. Dikkat: Aralarında kopya üreten yanlış satırlar var."
lines: |
  fn en_uzun_sozcuk(cumle: &str) -> &str {
      let mut en_uzun = "";
      for sozcuk in cumle.split_whitespace() {
          if sozcuk.len() > en_uzun.len() {
              en_uzun = sozcuk;
          }
      }
      en_uzun
  }
distractors: |
  fn en_uzun_sozcuk(cumle: &str) -> String {
      let mut en_uzun = String::new();
              en_uzun = sozcuk.to_string();
explanation: |
  `split_whitespace` girdinin dilimlerini verir (Modül 9). Her `sozcuk` bir `&str` ve `cumle`'ye bakıyor.
  En uzununu saklamak için başka bir dilimi tutmak yeterli, kopya gerekmiyor.

  Peki `let mut en_uzun = "";` neden derleniyor? `""` bir `&'static str`. Değişkenin tipi ise dönüş tipi
  yüzünden `cumle`'nin yaşam süresine bağlı bir `&str`. Ders 5'ten hatırla: `'static` her yaşam süresinden
  uzundur, bu yüzden boş literal bu değişkene sorunsuz sığar. `String::new()` ve `to_string()` satırları
  ise gereksiz bellek ayırır. `-> String` imzası da çağırana "yeni bir metin" sözü verir.
```

## Alıştırmalar

İlk alıştırmada bu dersteki `'a`/`'b` ayrımını kendin uygulayacaksın.

```exercise
id: m12-e-gecikenler
title: Geciken trenler
difficulty: 3
prompt: |
  Bir tren istasyonunun panosu, gün içinde güncellenen geçici bir listede `(tren_adi, gecikme_dakika)`
  çiftleri tutuyor. Tren adları ise istasyonun kalıcı kayıtlarından geliyor.

  `gecikenler(liste, esik)` fonksiyonu, gecikmesi `esik`'ten **büyük ya da eşit** olan trenlerin adlarını,
  listedeki sırayla döndürsün.

  Başlangıçtaki imza her şeye tek bir `'a` veriyor. Testlerden biri, geçici liste silindikten sonra
  sonucu kullanıyor. İmzayı, sonuç **sadece tren adlarına** bağlı olacak şekilde düzelt.
starter: |
  fn gecikenler<'a>(liste: &'a [(&'a str, u32)], esik: u32) -> Vec<&'a str> {
      todo!()
  }

  fn main() {
      let tablo = [("Doğu Ekspresi", 45), ("Ankara Ekspresi", 5), ("Pamukkale", 15)];
      println!("{:?}", gecikenler(&tablo, 15));
  }
solution: |
  fn gecikenler<'a, 'b>(liste: &'a [(&'b str, u32)], esik: u32) -> Vec<&'b str> {
      let mut sonuc = Vec::new();
      for &(ad, gecikme) in liste {
          if gecikme >= esik {
              sonuc.push(ad);
          }
      }
      sonuc
  }

  fn main() {
      let tablo = [("Doğu Ekspresi", 45), ("Ankara Ekspresi", 5), ("Pamukkale", 15)];
      println!("{:?}", gecikenler(&tablo, 15));
  }
check: tests
tests: |
  #[test]
  fn esige_esit_ve_buyukler() {
      let tablo = [("Doğu Ekspresi", 45), ("Ankara Ekspresi", 5), ("Pamukkale", 15)];
      assert_eq!(gecikenler(&tablo, 15), vec!["Doğu Ekspresi", "Pamukkale"], "15 dakika gecikme de sayılmalı (>=)");
  }

  #[test]
  fn hic_geciken_yok() {
      let tablo = [("Karesi", 0), ("Ege", 3)];
      assert!(gecikenler(&tablo, 10).is_empty(), "eşik üstünde tren yoksa liste boş");
      assert!(gecikenler(&[], 0).is_empty(), "boş tablo boş sonuç verir");
  }

  #[test]
  fn esik_sifirsa_hepsi() {
      let tablo = [("Karesi", 0), ("Ege", 3)];
      assert_eq!(gecikenler(&tablo, 0), vec!["Karesi", "Ege"], "eşik 0 ise bütün trenler, sırayla");
  }

  #[test]
  fn liste_silinince_de_gecerli() {
      let dogu = String::from("Doğu Ekspresi");
      let vangolu = String::from("Vangölü Ekspresi");
      let sonuc;
      {
          let gecici_pano = vec![(dogu.as_str(), 30), (vangolu.as_str(), 2)];
          sonuc = gecikenler(&gecici_pano, 10);
      }
      assert_eq!(sonuc, vec!["Doğu Ekspresi"], "sonuç geçici panoya değil tren adlarına bağlı olmalı");
  }
hints:
  - "Gövde ders 4'teki `esik_ustu` gibi: `for &(ad, gecikme) in liste { ... }` ile gez ve `>=` ile karşılaştır."
  - "`liste_silinince_de_gecerli` derlenmiyorsa sorun imzada. Dilimin ödüncü ile içindeki `&str`'lerin yaşam süreleri bağımsız olmalı: `<'a, 'b>`."
  - "İmza: `fn gecikenler<'a, 'b>(liste: &'a [(&'b str, u32)], esik: u32) -> Vec<&'b str>`."
explanation: |
  `&'a [(&'b str, u32)]` tipi iki ayrı şeyi anlatıyor: `'a` geçici panonun (vektörün) ödüncü, `'b` ise
  tren adlarının ödüncü. Sonuç yalnızca `'b`'ye bağlı. `for &(ad, gecikme) in liste` satırı her
  çiftteki `&'b str`'yi **kopyalar** (referanslar `Copy`'dir). Kopyalanan referans vektöre değil, adın
  kendisine bağlıdır.

  `'a` adını da hiç kullanmadığımıza dikkat et. Sadece bir kez geçiyor. Bu yüzden imza
  `fn gecikenler<'b>(liste: &[(&'b str, u32)], esik: u32) -> Vec<&'b str>` olarak da yazılabilir:
  Dilimin yaşam süresini elision'a bırakırız (Kural 1 ona ayrı bir ad verir). Çıktı açıkça `'b`'ye
  bağlandığı için başka bir kurala gerek kalmaz. İki yazım da aynı anlama gelir.

  Gerçek kütüphanelerde bu kalıp sık görülür: Bir "kap" kısa süreliğine ödünç alınır, içinden çıkan
  referanslar ise daha uzun yaşar.
```

Son alıştırma bu modülün final projesi: Bir hesap makinesinin ilk aşaması olan **sözcük ayırıcıyı
(tokenizer)** yazacaksın.

```exercise
id: m12-e-tokenizer
title: Hesap makinesi için tokenizer
difficulty: 4
prompt: |
  Bir hesap makinesi uygulaması `"fiyat*12 + kdv(18)"` gibi ifadeleri önce **token**'lara ayırıyor. Her
  token'ın bir türü ve girdinin içine bakan bir metni var. `tokenlara_ayir(girdi)` fonksiyonunu yaz:

  - **Boşluklar** (`c.is_whitespace()`) atlanır ve token'ları ayırır.
  - Art arda gelen **ASCII rakamlar** (`c.is_ascii_digit()`) tek bir `Tur::Sayi` token'ı olur: `"12"`.
  - Art arda gelen **harfler** (`c.is_alphabetic()`, Türkçe harfler dahil) tek bir `Tur::Kelime` olur.
  - Diğer her karakter (`+`, `*`, `(`, `.` ...) **tek başına** bir `Tur::Isaret` token'ıdır. `"(("` iki
    ayrı işarettir.
  - Rakamdan harfe geçiş yeni bir token başlatır: `"a1"` → `Kelime("a")`, `Sayi("1")`.

  Token metinleri girdinin **dilimleri** olmalı. `Token<'a>` struct'ı ve imza hazır.
  `tur_bul` yardımcı fonksiyonunu da yazman işini kolaylaştırır.
starter: |
  #[derive(Debug, PartialEq, Clone, Copy)]
  enum Tur {
      Sayi,
      Kelime,
      Isaret,
  }

  #[derive(Debug, PartialEq)]
  struct Token<'a> {
      tur: Tur,
      metin: &'a str,
  }

  /// Boşluk için None, diğer karakterler için türü döndürür.
  fn tur_bul(c: char) -> Option<Tur> {
      todo!()
  }

  fn tokenlara_ayir(girdi: &str) -> Vec<Token<'_>> {
      todo!()
  }

  fn main() {
      let ifade = String::from("fiyat*12 + kdv(18)");
      for t in tokenlara_ayir(&ifade) {
          println!("{:?} {:?}", t.tur, t.metin);
      }
  }
solution: |
  #[derive(Debug, PartialEq, Clone, Copy)]
  enum Tur {
      Sayi,
      Kelime,
      Isaret,
  }

  #[derive(Debug, PartialEq)]
  struct Token<'a> {
      tur: Tur,
      metin: &'a str,
  }

  /// Boşluk için None, diğer karakterler için türü döndürür.
  fn tur_bul(c: char) -> Option<Tur> {
      if c.is_whitespace() {
          None
      } else if c.is_ascii_digit() {
          Some(Tur::Sayi)
      } else if c.is_alphabetic() {
          Some(Tur::Kelime)
      } else {
          Some(Tur::Isaret)
      }
  }

  fn tokenlara_ayir(girdi: &str) -> Vec<Token<'_>> {
      let mut tokenlar = Vec::new();
      let mut aktif: Option<(Tur, usize)> = None; // açık token: türü ve başladığı bayt

      for (i, c) in girdi.char_indices() {
          let tur = tur_bul(c);
          if let Some((t, b)) = aktif {
              // Aynı türden devam ediyorsa (işaretler hariç) token'ı uzat
              if tur == Some(t) && t != Tur::Isaret {
                  continue;
              }
              tokenlar.push(Token { tur: t, metin: &girdi[b..i] });
              aktif = None;
          }
          if let Some(t) = tur {
              aktif = Some((t, i));
          }
      }
      if let Some((t, b)) = aktif {
          tokenlar.push(Token { tur: t, metin: &girdi[b..] });
      }
      tokenlar
  }

  fn main() {
      let ifade = String::from("fiyat*12 + kdv(18)");
      for t in tokenlara_ayir(&ifade) {
          println!("{:?} {:?}", t.tur, t.metin);
      }
  }
check: tests
tests: |
  fn t(tur: Tur, metin: &str) -> Token<'_> {
      Token { tur, metin }
  }

  #[test]
  fn basit_ifade() {
      assert_eq!(
          tokenlara_ayir("3 + 42"),
          vec![t(Tur::Sayi, "3"), t(Tur::Isaret, "+"), t(Tur::Sayi, "42")],
          "boşluklar atlanmalı, çok basamaklı sayı tek token olmalı"
      );
  }

  #[test]
  fn bosluksuz_karisik() {
      assert_eq!(
          tokenlara_ayir("fiyat*12.5"),
          vec![
              t(Tur::Kelime, "fiyat"),
              t(Tur::Isaret, "*"),
              t(Tur::Sayi, "12"),
              t(Tur::Isaret, "."),
              t(Tur::Sayi, "5"),
          ],
          "tür değiştiğinde yeni token başlamalı"
      );
  }

  #[test]
  fn turkce_harfler_ve_parantezler() {
      assert_eq!(
          tokenlara_ayir("çay((2)"),
          vec![
              t(Tur::Kelime, "çay"),
              t(Tur::Isaret, "("),
              t(Tur::Isaret, "("),
              t(Tur::Sayi, "2"),
              t(Tur::Isaret, ")"),
          ],
          "Türkçe harfler kelimedir; her işaret ayrı bir token'dır"
      );
  }

  #[test]
  fn harften_rakama_gecis() {
      assert_eq!(tokenlara_ayir("a1b"), vec![t(Tur::Kelime, "a"), t(Tur::Sayi, "1"), t(Tur::Kelime, "b")]);
  }

  #[test]
  fn bos_ve_bosluk_girdisi() {
      assert!(tokenlara_ayir("").is_empty(), "boş girdi, token yok");
      assert!(tokenlara_ayir("   \t ").is_empty(), "sadece boşluk, token yok");
  }

  #[test]
  fn tokenlar_girdiyle_yasar() {
      let girdi = String::from("  toplam = 100 ");
      let tokenlar = tokenlara_ayir(&girdi);
      assert_eq!(tokenlar.len(), 3, "toplam, =, 100");
      assert_eq!(tokenlar[2].metin, "100");
      assert_eq!(tokenlar[0].metin, &girdi[2..8], "token metni girdinin aynı bölgesine bakmalı");
  }
hints:
  - "`tur_bul`'u bir `if / else if` zinciriyle yaz: önce `is_whitespace` (`None`), sonra `is_ascii_digit`, sonra `is_alphabetic`, kalan her şey `Isaret`."
  - "`tokenlara_ayir`'da açık token'ı `let mut aktif: Option<(Tur, usize)> = None;` ile tut: türü ve başladığı bayt konumu. `for (i, c) in girdi.char_indices()` ile gez."
  - "Her karakterde: Açık bir token varsa ve yeni karakter **aynı türdense** (ve tür `Isaret` değilse) `continue`. Değilse `&girdi[b..i]` ile token'ı kapat. Sonra yeni karakter boşluk değilse `aktif = Some((tur, i))`. Döngüden sonra açık kalan token'ı `&girdi[b..]` ile eklemeyi unutma."
explanation: |
  Fonksiyonun kalbi küçük bir **durum makinesi** (Modül 7'deki "geçersiz durumları temsil edilemez kıl"
  fikrine benzer): `aktif` ya `None` (açık token yok) ya da `Some((tür, başlangıç))`. Her karakter ya açık
  token'ı uzatır ya da kapatıp yenisini başlatır.

  Yaşam süreleri açısından en önemli nokta imza: `fn tokenlara_ayir(girdi: &str) -> Vec<Token<'_>>`.
  Tek girdi yaşam süresi var (Kural 2). `'_`, dönen token'ların `girdi`'ye bağlı olduğunu **görünür**
  kılıyor (ders 4). Açık hâli: `fn tokenlara_ayir<'a>(girdi: &'a str) -> Vec<Token<'a>>`. Hiçbir token
  girdiden uzun yaşayamaz. Karşılığında tek bir bayt bile kopyalanmaz. 10 MB'lık bir dosyayı ayırırken
  bile yalnızca token başına iki kelimelik (işaretçi + uzunluk) bir dilim üretilir.

  `char_indices` kullanmak burada güvenlik meselesi: Dilim sınırlarını `i` (bir karakterin **başladığı**
  bayt) ile belirlediğimiz için `ç` gibi çok baytlı harflerin ortasından asla kesmeyiz.

  Alternatif tasarım: `Token`, metin yerine `(baslangic, bitis)` bayt aralıkları da tutabilirdi. O zaman
  `Token` hiç yaşam süresi parametresi taşımazdı, ama metni okumak için her seferinde girdiye ihtiyaç
  duyardın. Gerçek derleyiciler (rustc dahil) bu "indeks tut" yöntemini sık kullanır.
```

## Özet

:::remember
- Köşeli parantezde sıra: önce yaşam süreleri, sonra tipler: `<'a, T: Display>`. `where` ile sınırlar ayrı yazılabilir.
- İmza okuma yöntemi: (1) parametreler, (2) her çıktı referansı hangi girdiye bağlı, (3) sınırlar.
- Tek `'a` ile başla. Bağımsız referanslar bir çağıranı gereksiz kısıtlıyorsa ayrı adlar ver: `&'a [(&'b str, u32)] -> Vec<&'b str>`.
- Metotlar `self`'in tamamını ödünç alır. Alanlara doğrudan erişim ya da parçaları birlikte döndüren bir metot **ödünçleri böler**.
- `&mut`'tan türetilen `&` referans yaşadıkça `&mut` ödünç de yaşar.
- Kopyasız ayrıştırma: `char_indices` ile karakter sınırlarından dilimle, token'lar girdiye bağlı olsun (`Vec<Token<'_>>`).
:::

```reflect
prompt: |
  Bu modülün başında yaşam süreleri sana nasıl görünüyordu, şimdi nasıl görünüyor? Bir yaşam süresi
  hatasıyla karşılaştığında izleyeceğin adımları kendi cümlelerinle sırala.
answer: |
  Model cevap: Önce `'a`'yı derleyiciyi susturmak için yazılan gizemli bir sembol sanıyordum. Şimdi onun
  referanslar arasındaki ilişkiyi tarif eden bir belge olduğunu biliyorum. Hata aldığımda: (1) Hata
  mesajındaki etiketleri okurum: Değer nerede doğdu, nerede öldü, ödünç nerede kullanılıyor. (2) Kim sahip,
  kim ödünç alıyor, ne kadar süreyle diye sorarım. (3) Fonksiyon yeni veri üretiyorsa sahipli döndürürüm.
  (4) İmza yanlış ilişki tarif ediyorsa sonucu doğru parametreye bağlarım, gerekiyorsa ayrı yaşam süreleri
  veririm. (5) Metotlar yüzünden çakışma varsa ödünçleri bölerim. (6) Referans her yere bulaşıyorsa
  sahipli alanlara ya da indekslere geçerim. `'static`'i ise sadece gerçekten program boyunca yaşayan
  veriler için kullanırım.
```

```flashcards
- front: "Bir generic fonksiyonda yaşam süresi ve tip parametrelerinin sırası nasıldır?"
  back: "Önce yaşam süreleri, sonra tipler: `fn f<'a, T: Display>(...)`. Ters sıra derleme hatasıdır."
- front: "`fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>` sonucu neye bağlıdır?"
  back: "Yalnızca `icerik`'e. `sorgu` sonuçtan önce ölebilir."
- front: "`&'a [(&'b str, u32)]` tipindeki `'a` ve `'b` neyi anlatır?"
  back: "`'a`: dilimin (kabın) ödüncü. `'b`: içindeki `&str`'lerin baktığı metinlerin ödüncü. Sonuç `'b`'ye bağlanırsa kap ölse de geçerli kalır."
- front: Birden fazla yaşam süresi parametresi ne zaman gerekir?
  back: "Bağımsız referanslara tek `'a` vermek, gerçekte güvenli bir kullanımı reddettiğinde. Pratik kural: Tek `'a` ile başla."
- front: "`o.isim()` sonucu yaşarken `o.puanlar_mut()` neden E0502 verir?"
  back: "Metotlar imzalarıyla görülür ve `self`'in **tamamını** ödünç alır. Alanlara doğrudan erişmek ya da parçaları birlikte döndürmek ödünçleri böler."
- front: "`fn f<'a>(v: &'a mut Vec<T>) -> &'a T` sonucu yaşarken `v`'yi okuyabilir misin?"
  back: "Hayır. Dönen `&` referans `&mut` ödüncünü uzatır. Sonuç yaşadığı sürece `v` `&mut` ile ödünçtedir."
- front: Kopyasız bir tokenizer'da dilim sınırlarını güvenle bulmak için hangi metot kullanılır?
  back: "`char_indices()`. Her karakterin başladığı bayt konumunu verir, böylece çok baytlı harflerin ortasından kesilmez."
- front: "Referans tutan bir tipin `<'a>` parametresinin her yere bulaşmasını önlemenin iki yolu nedir?"
  back: "Sahipli alanlara (`String`) geçmek ya da referans yerine indeks/bayt aralığı saklamak."
```
