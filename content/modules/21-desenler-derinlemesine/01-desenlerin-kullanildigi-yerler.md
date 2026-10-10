---
id: m21-l01
title: Desenlerin kullanıldığı her yer
minutes: 18
type: lesson
objectives:
  - Bir Rust programında desenin (pattern) geçtiği bütün yerleri (match, if let, let-else, while let, for, let, fonksiyon ve closure parametreleri) gösterebilmek
  - "`if let` / `else if let` / `else` zincirleri ve let zincirleriyle (`&&`) birden çok koşulu tek akışta yazabilmek"
  - "`for` döngüsünde, fonksiyon ve closure parametrelerinde tuple ve struct'ları doğrudan parçalayabilmek"
  - "`let ... else` ile ayrıştırma (parsing) fonksiyonlarını erken dönüşlü ve düz yazabilmek"
keywords: [desen, pattern, match, if let, let else, while let, for, parametre, closure, yapı bozma, destructuring]
---

Modül 2'de `let (a, b) = t;` yazdığında farkında olmadan bir **desen (pattern)** kullandın. Modül 7'de
`match` kollarında desenleri bilinçli olarak yazmaya başladın. Şimdi büyük resmi göreceksin: Rust'ta
desenler yalnızca `match`'e özgü bir özellik değil; `let`'te, `for`'da, fonksiyon parametrelerinde,
closure'larda, hatta `let x = 5;` gibi en sıradan satırda bile karşına çıkarlar.

Bu modül, desenleri "match'in bir parçası" olmaktan çıkarıp Rust'ın **dilbilgisinin** bir parçası olarak
görmeni sağlayacak. İlk derste desenlerin yaşadığı bütün yerleri tek tek gezeceğiz.

## Desen nedir? Aslında hep kullanıyordun

Bir desen iki iş birden yapar:

1. Bir değerin **şeklini sınar**: "Bu değer iki elemanlı bir tuple mı? `Some` mı? `x` alanı `0` mı?"
2. Şekil uyuyorsa değerin **parçalarına isim verir** (bağlar, *bind*): "Birinci eleman `ad` olsun."

Şu programdaki her `let` satırının solunda bir desen var:

```rust
struct Nokta {
    x: i32,
    y: i32,
}

fn main() {
    let puan = 92; // `puan`: her değere uyan, onu bağlayan desen
    let (ad, not) = ("Ece", 'A'); // tuple deseni: iki parçaya iki isim
    let Nokta { x, y } = Nokta { x: 3, y: -1 }; // struct deseni: alanlara isim
    let ((gun, ay), yil) = ((29, 10), 1923); // iç içe tuple deseni

    println!("{ad}: {puan} ({not})");
    println!("Nokta: ({x}, {y})");
    println!("Tarih: {gun}.{ay}.{yil}");
}
```

`let` satırının genel biçimi aslında `let DESEN = IFADE;`'dir. Sağdaki ifade bir değer üretir, soldaki
desen bu değere **oturtulur** ve içindeki isimler o parçalara bağlanır. Değeri parçalarına ayırmaya
**yapı bozma (destructuring)** denir. Python'daki `ad, not = ("Ece", "A")` ya da JavaScript'teki
`const { x, y } = nokta;` yazımını biliyorsan, aynı fikrin çok daha genel bir hâlini görüyorsun: Rust'ta
yapı bozma her desen konumunda ve sınırsız iç içelikte çalışır, üstelik derleyici her şeyi tip denetiminden
geçirir.

:::analogy Kargo şablonu
Bir depoda çalıştığını düşün. Elinde "iki gözlü kutu; sol göz **ad**, sağ göz **not**" yazan bir şablon var.
Gelen kutuyu şablonun üstüne koyarsın: kutu gerçekten iki gözlüyse göz göz etiket yapıştırırsın.
Desen bu şablondur: önce şekli sınar, sonra parçalara etiket (isim) verir. Üç gözlü bir kutu gelirse
şablon uymaz; Rust bunu çoğu zaman program çalışmadan, derleme sırasında yakalar.
:::

Desenler şu parçalardan kurulur; hepsini bu modülde ayrıntılı göreceksin:

| Parça | Örnek |
|---|---|
| Değişmez (literal) | `0`, `'a'`, `true`, `"evet"` |
| İsim (değişken) | `puan`, `ad` |
| Joker | `_` |
| Tuple / struct / enum yapısı | `(a, b)`, `Nokta { x, y }`, `Some(n)` |
| Aralık, "veya", geri kalanı | `1..=9`, `'a' \| 'e'`, `..` |
| Referans ve bağlama | `&(x, y)`, `ref ad`, `n @ 1..=5` |

```quiz
question: Aşağıdakilerden hangileri bir **desen** içerir? (Birden fazla seçenek doğru olabilir.)
options:
  - "`let toplam = 0;`"
  - "`for (sira, isim) in isimler.iter().enumerate() { ... }`"
  - "`fn uzaklik(&(x, y): &(i32, i32)) -> i32 { x.abs() + y.abs() }`"
  - "`let fark = a - b;` satırının sağ tarafı (`a - b`)"
answer: [0, 1, 2]
explanation: |
  `let`'in solu, `for` ile `in` arasındaki kısım ve fonksiyon parametreleri **desen konumlarıdır**.
  `toplam` gibi tek bir isim bile bir desendir: "her değere uy ve onu `toplam`'a bağla."
  `a - b` ise bir **ifadedir** (expression): değer üretir, değer sınamaz. Kural basit: değer
  **üreten** taraf ifade, değeri **karşılayan** taraf desendir.
feedback:
  - "Doğru: `toplam` her değere uyan bir isim desenidir."
  - "Doğru: `(sira, isim)` her elemanı parçalayan bir tuple desenidir."
  - "Doğru: parametre listesi de bir desen konumudur; `&(x, y)` referansı ve tuple'ı birlikte açar."
  - "`a - b` bir ifadedir; desenler `=` işaretinin solunda, ifadeler sağında durur."
```

## match ve if let zincirleri

Desenlerin en bilinen evi `match`'tir. Her kol `DESEN => IFADE` biçimindedir; kollar yukarıdan aşağıya
denenir, **ilk uyan** çalışır ve kolların hepsi birlikte bütün olasılıkları kapsamalıdır (Modül 7). Bir
`match`'in kontrol ettiği değer (scrutinee) herhangi bir ifade olabilir; birden çok değeri aynı anda
eşleştirmek için onları bir tuple'da toplamak yaygın bir Rust deyimidir:

```rust
fn main() {
    let saat = 14;
    let hafta_sonu = false;

    let durum = match (hafta_sonu, saat) {
        (true, _) => "Kütüphane kapalı",
        (false, 9..=12) => "Sabah seansı",
        (false, 13..=18) => "Öğleden sonra seansı",
        (false, _) => "Mesai dışı",
    };
    println!("{durum}");
}
```

Bazen tek bir değer değil, **birbirinden bağımsız birkaç koşul** sınamak istersin. `match` burada
zorlanır; `if let`, `else if let`, `else if` ve `else` ise serbestçe karıştırılabilir. Bir uygulamanın
tema seçimini düşün: kullanıcının kayıtlı tercihi varsa onu, yoksa bayram günüyse özel temayı, yoksa
yaşına göre bir temayı seçiyoruz:

```rust
fn tema_sec(kayitli: Option<&str>, bayram_mi: bool, yas_metni: &str) -> String {
    if let Some(tema) = kayitli {
        format!("Kayıtlı tema: {tema}")
    } else if bayram_mi {
        String::from("Bayram teması")
    } else if let Ok(yas) = yas_metni.parse::<u32>()
        && yas >= 18
    {
        format!("Koyu tema ({yas} yaş)")
    } else {
        String::from("Açık tema")
    }
}

fn main() {
    println!("{}", tema_sec(Some("Deniz"), true, "40"));
    println!("{}", tema_sec(None, true, "40"));
    println!("{}", tema_sec(None, false, "40"));
    println!("{}", tema_sec(None, false, "12"));
    println!("{}", tema_sec(None, false, "kırk"));
}
```

Bu zincirde her dal **farklı** bir şeyi sınıyor: ilk dal `kayitli`'yi, ikinci dal bir `bool`'u, üçüncü dal
`parse` sonucunu (bir `Result`, Modül 10). Üçüncü daldaki `if let DESEN = DEGER && KOSUL` yazımı Modül
7'den tanıdığın **let zinciri (let chain)**: desen uyarsa **ve** koşul doğruysa dal çalışır; koşul, desenin
bağladığı `yas`'ı kullanabilir.

:::warning Zincirin bedeli
`if let` zincirlerinde derleyici **eksiksizlik (exhaustiveness)** denetimi yapmaz. Son `else`'i unutursan ya
da bir durumu atlarsan sessizce hiçbir şey olmaz. Aynı değerin bütün olasılıklarını ele alıyorsan `match`
yaz; `if let` zincirlerini **farklı** değerleri sınadığın durumlar için sakla.
:::

```predict
code: |
  fn main() {
      let kayitlar = ["12", "x", "25"];
      for k in kayitlar {
          if let Ok(n) = k.parse::<i32>()
              && n > 20
          {
              println!("büyük: {n}");
          } else if let Ok(n) = k.parse::<i32>() {
              println!("küçük: {n}");
          } else {
              println!("sayı değil: {k}");
          }
      }
  }
options:
  - |
    küçük: 12
    sayı değil: x
    büyük: 25
  - |
    büyük: 12
    sayı değil: x
    büyük: 25
  - |
    küçük: 12
    büyük: 25
answer: 0
explanation: |
  `"12"` ayrışır ama `12 > 20` yanlış olduğu için ilk dal atlanır; ikinci dal `Ok(12)` desenine uyar.
  `"x"` iki `parse` denemesinde de `Err` verir ve `else`'e düşer. `"25"` ilk dalın hem desenini hem
  koşulunu sağlar. Her dalın `n`'i **kendi** bloğuna aittir; ikinci daldaki `n` yeni bir bağlamadır.
```

## let-else ve while let

Modül 7'de gördüğün iki yapı da birer desen konumudur ve gerçek kodda çok sık kullanılır.

**`let DESEN = IFADE else { ... };`** desen uyarsa isimleri **devam eden kodda** kullanılabilir hâle getirir;
uymazsa `else` bloğu çalışır ve bu blok mutlaka akıştan **çıkmalıdır** (`return`, `break`, `continue`,
`panic!`). Ayrıştırma (parsing) fonksiyonlarını iç içe `match`'ler yerine düz bir çizgide yazmanı sağlar:

```rust
fn kullanici_adi(eposta: &str) -> &str {
    let Some((ad, alan)) = eposta.split_once('@') else {
        return "geçersiz";
    };
    let Some((_, uzanti)) = alan.rsplit_once('.') else {
        return "geçersiz";
    };
    if ad.is_empty() || uzanti.is_empty() {
        return "geçersiz";
    }
    ad
}

fn main() {
    for e in ["ece@okul.edu.tr", "deniz.at.posta", "@bos.com", "can@yerel"] {
        println!("{e:>16} → {}", kullanici_adi(e));
    }
}
```

Dikkat et: `let Some((ad, alan)) = ...` deseninde **iki katman** birden açılıyor: önce `Option`'ın
`Some`'ı, sonra içindeki tuple. Desenler istediğin kadar iç içe olabilir.

Bir soru: `else` bloğu akıştan çıkmazsa ne olur? Modül 7'yi hatırla:

```compiles
code: |
  fn ilk_kelime(cumle: &str) -> &str {
      let Some((ilk, _)) = cumle.split_once(' ') else {
          println!("tek kelime");
      };
      ilk
  }

  fn main() {
      println!("{}", ilk_kelime("merhaba dünya"));
  }
answer: false
error: E0308
explanation: |
  Derlenmez: **E0308**, *`else` clause of `let...else` does not diverge*. Desen uymadığında `ilk` diye bir
  değer **yoktur**; `else` bloğu normal biterse program `ilk`'i değersiz kullanmak zorunda kalırdı. Bu yüzden
  `else` bloğu mutlaka akıştan çıkmalıdır: `return cumle;`, `panic!(...)` gibi.
```

**`while let DESEN = IFADE { ... }`** desen uydukça döngüyü sürdürür. İfade her turda **yeniden**
hesaplanır. Bir yazı editöründeki "geri al" yığını tipik bir örnektir:

```rust
fn main() {
    let mut geri_al = vec![("yaz", "Merhaba"), ("sil", "a"), ("yaz", "Rust")];

    while let Some((islem, metin)) = geri_al.pop() {
        println!("Geri alınıyor: {islem} \"{metin}\"");
    }
    println!("Yığın boş: {}", geri_al.is_empty());
}
```

`pop()` her turda `Option<(&str, &str)>` döndürür; `Some((islem, metin))` deseni uyduğu sürece döngü döner,
`None` geldiğinde biter. Burada da iki katman birden açıldı.

## for döngüsünde desenler

`for` ile `in` arasındaki kısım da bir desendir. Iterator her turda bir eleman üretir; desen bu elemana
oturtulur. Bu yüzden elemanın **tipini** bilmek, doğru deseni yazmanın anahtarıdır:

```rust
use std::collections::HashMap;

fn main() {
    let ogrenciler = ["Ali", "Ece", "Can"];
    for (sira, ad) in ogrenciler.iter().enumerate() {
        // eleman tipi: (usize, &&str)
        println!("{}. {ad}", sira + 1);
    }

    let noktalar: Vec<(i32, i32)> = vec![(1, 2), (3, -4)];
    for &(x, y) in &noktalar {
        // eleman tipi: &(i32, i32) → `&` deseni referansı açar, x ve y i32 olur
        println!("({x}, {y}) uzaklık: {}", x.abs() + y.abs());
    }

    let mut stok = HashMap::new();
    stok.insert("elma", 12);
    stok.insert("armut", 5);
    let mut toplam = 0;
    for (_urun, adet) in &stok {
        // eleman tipi: (&&str, &i32)
        toplam += adet; // i32 += &i32 de çalışır
    }
    println!("Toplam stok: {toplam}");
}
```

Üç farklı eleman tipi, üç farklı desen:

- `enumerate()` bir `(usize, T)` tuple'ı üretir; `(sira, ad)` onu parçalar.
- `&noktalar` üzerinde dönmek `&(i32, i32)` üretir. `&(x, y)` deseni önce referansı açar (`&`), sonra
  tuple'ı. `i32` `Copy` olduğu için `x` ve `y` birer kopya olur. (Desende `&` kullanmayı 4. derste
  derinlemesine göreceğiz.)
- `HashMap` üzerinde `&stok` ile dönmek `(&K, &V)` çiftleri üretir; ilgilenmediğin parçaya `_urun` gibi `_`
  ile başlayan bir isim verip "kullanmıyorum" dersin.

```fill
prompt: |
  Her şehrin sıcaklığını yazdıran ve en sıcak şehri bulan programı tamamla. Döngüde tuple'ı
  **doğrudan desende** parçala; `x.0` gibi alan erişimi kullanma.
code: |
  fn main() {
      let olcumler = [("Ankara", 18), ("İzmir", 27), ("Erzurum", 9)];
      let mut en_sicak = ("", i32::MIN);
      for ___0 in olcumler {
          println!("{sehir}: {derece}°C");
          if derece > en_sicak.1 {
              en_sicak = (sehir, derece);
          }
      }
      let (ad, ___1) = en_sicak;
      println!("En sıcak: {ad} ({d}°C)");
  }
blanks:
  - ["(sehir, derece)", "(sehir,derece)"]
  - ["d"]
output: |
  Ankara: 18°C
  İzmir: 27°C
  Erzurum: 9°C
  En sıcak: İzmir (27°C)
explanation: |
  `for x in olcumler` diziyi değer olarak dolaşır; her eleman bir `(&str, i32)` tuple'ıdır ve
  `(sehir, derece)` deseni onu iki isme ayırır. Sondaki `let (ad, d) = en_sicak;` aynı işi bir `let`
  ile yapar. Gördüğün gibi `for` ve `let` **aynı desen dilini** konuşur.
```

## Fonksiyon ve closure parametreleri

Fonksiyon parametreleri de birer desendir. `fn f(x: i32)` yazdığında `x` bir isim desenidir; yerine bir tuple
ya da struct deseni de yazabilirsin. Tip, desenden sonra `:` ile yine yazılır:

```rust
struct Dikdortgen {
    en: u32,
    boy: u32,
}

// Parametre deseni: referansı ve tuple'ı birlikte aç
fn manhattan(&(x1, y1): &(i32, i32), &(x2, y2): &(i32, i32)) -> i32 {
    (x1 - x2).abs() + (y1 - y2).abs()
}

// Struct deseni: alanlara doğrudan isimle ulaş
fn alan(&Dikdortgen { en, boy }: &Dikdortgen) -> u32 {
    en * boy
}

fn main() {
    let ev = (2, 3);
    let okul = (5, -1);
    println!("Ev → okul: {} blok", manhattan(&ev, &okul));

    let oda = Dikdortgen { en: 4, boy: 5 };
    println!("Oda: {} m²", alan(&oda));

    // Closure parametresi de bir desendir
    let siparisler = [("çay", 3, 15), ("simit", 2, 20), ("su", 1, 10)];
    let toplam: u32 = siparisler.iter().map(|&(_, adet, fiyat)| adet * fiyat).sum();
    println!("Hesap: {toplam} TL");
}
```

Çağıran taraf hiçbir şey fark etmez: `manhattan(&ev, &okul)` sıradan bir çağrıdır. Desen yalnızca fonksiyonun
**içinde** parametreye nasıl isim verdiğini değiştirir. `siparisler.iter()` her elemanı `&(&str, u32, u32)`
olarak verir; closure'daki `&(_, adet, fiyat)` deseni referansı açıp ilk alanı yok sayar (Modül 14'teki
closure'lar).

:::tip Ne zaman parametrede parçalamalı?
Fonksiyon gövdesi tuple'ın ya da struct'ın yalnızca **alanlarıyla** ilgileniyorsa parametrede parçalamak
gövdeyi `p.0`, `d.en` gürültüsünden kurtarır. Gövde değeri **bütün olarak** da kullanıyorsa (başka bir
fonksiyona vermek, metot çağırmak), sıradan bir isim parametresi daha okunaklıdır.
:::

Peki her desen parametrede kullanılabilir mi? Tahmin et:

```compiles
code: |
  fn selamla(Some(ad): Option<&str>) {
      println!("Merhaba {ad}!");
  }

  fn main() {
      selamla(Some("Ece"));
  }
answer: false
error: E0005
explanation: |
  Derlenmez: **E0005**, *refutable pattern in function argument* — `pattern None not covered`.
  Fonksiyon `None` ile de çağrılabilir; o zaman `ad`'a hangi değer bağlanacaktı? Parametre desenleri
  **her zaman uyan** desenler olmak zorundadır. Bu "her zaman uyan" (reddedilemez) ve "uymayabilen"
  (reddedilebilir) desen ayrımı bir sonraki dersin konusu.
```

Şimdi sıra sende. Önce parametre ve `for` desenleriyle ısın:

````exercise
id: m21-e-sepet
title: Pazar sepeti
difficulty: 2
prompt: |
  Bir pazar uygulamasında sepet, `(ürün adı, adet, birim fiyat)` tuple'larından oluşan bir dilim:
  `&[(&str, u32, u32)]`. İki fonksiyon yaz:

  1. `sepet_toplami(sepet)`: bütün kalemlerin `adet * fiyat` toplamını döndürür.
  2. `en_pahali_kalem(sepet)`: **kalem tutarı** (`adet * fiyat`) en büyük olan ürünün adını döndürür;
     sepet boşsa `None`. Eşitlikte **ilk** gelen kazanır.

  Tuple alanlarına `.0`, `.1`, `.2` ile erişme: elemanları `for` deseninde ya da closure parametresinde
  **parçala**.
starter: |
  fn sepet_toplami(sepet: &[(&str, u32, u32)]) -> u32 {
      todo!()
  }

  fn en_pahali_kalem<'a>(sepet: &[(&'a str, u32, u32)]) -> Option<&'a str> {
      todo!()
  }

  fn main() {
      let sepet = [("domates", 2, 30), ("peynir", 1, 180), ("ekmek", 3, 15)];
      println!("Toplam: {} TL", sepet_toplami(&sepet));
      println!("En pahalı kalem: {:?}", en_pahali_kalem(&sepet));
  }
solution: |
  fn sepet_toplami(sepet: &[(&str, u32, u32)]) -> u32 {
      let mut toplam = 0;
      for &(_, adet, fiyat) in sepet {
          toplam += adet * fiyat;
      }
      toplam
  }

  fn en_pahali_kalem<'a>(sepet: &[(&'a str, u32, u32)]) -> Option<&'a str> {
      let mut en_iyi: Option<(&str, u32)> = None;
      for &(ad, adet, fiyat) in sepet {
          let tutar = adet * fiyat;
          match en_iyi {
              Some((_, rekor)) if rekor >= tutar => {}
              _ => en_iyi = Some((ad, tutar)),
          }
      }
      let (ad, _) = en_iyi?;
      Some(ad)
  }

  fn main() {
      let sepet = [("domates", 2, 30), ("peynir", 1, 180), ("ekmek", 3, 15)];
      println!("Toplam: {} TL", sepet_toplami(&sepet));
      println!("En pahalı kalem: {:?}", en_pahali_kalem(&sepet));
  }
check: tests
tests: |
  #[test]
  fn toplam_dogru_hesaplanir() {
      let sepet = [("domates", 2, 30), ("peynir", 1, 180), ("ekmek", 3, 15)];
      assert_eq!(sepet_toplami(&sepet), 285, "60 + 180 + 45 = 285 olmalı");
  }

  #[test]
  fn bos_sepet() {
      assert_eq!(sepet_toplami(&[]), 0, "boş sepetin toplamı 0'dır");
      assert_eq!(en_pahali_kalem(&[]), None, "boş sepette en pahalı kalem yoktur");
  }

  #[test]
  fn birim_fiyat_degil_kalem_tutari() {
      // simit tek başına ucuz ama 10 tane alınmış: 10 * 15 = 150 > 120
      let sepet = [("bal", 1, 120), ("simit", 10, 15)];
      assert_eq!(en_pahali_kalem(&sepet), Some("simit"), "adet * fiyat karşılaştırılmalı, sadece fiyat değil");
  }

  #[test]
  fn esitlikte_ilk_kazanir() {
      let sepet = [("zeytin", 2, 50), ("kaşar", 1, 100), ("çay", 4, 25)];
      assert_eq!(en_pahali_kalem(&sepet), Some("zeytin"), "eşit tutarlarda ilk kalem seçilmeli");
  }
hints:
  - "`for &(_, adet, fiyat) in sepet` yazarsan her elemanın referansı açılır ve `adet`, `fiyat` doğrudan `u32` olur."
  - "En pahalıyı bulmak için o ana kadarki en iyi `(ad, tutar)` çiftini bir `Option` içinde tut; yeni tutar **kesinlikle büyükse** güncelle."
  - "Döngü bitince `Option<(&str, u32)>`'dan yalnızca adı al: `match`, `let ... else` ya da `?` ile `let (ad, _) = en_iyi?; Some(ad)`."
forbid:
  - pattern: "\\.[012]\\b"
    message: Tuple alanlarına `.0` / `.1` / `.2` ile erişme; elemanı desenle parçala.
explanation: |
  `for &(_, adet, fiyat) in sepet` satırı tek seferde üç iş yapar: `&` dilimden gelen referansı açar,
  tuple'ı üç parçaya ayırır ve ad alanını `_` ile yok sayar. Bütün alanlar `Copy` olduğu için hiçbir
  şey taşınmaz.

  `en_pahali_kalem`'deki `Some((_, rekor)) if rekor >= tutar => {}` kolu, 5. derste göreceğin bir **match
  guard**'ıdır; aynı mantığı `if` ile de yazabilirdin. Eşitlikte güncelleme yapılmadığı için ilk kalem
  kazanır.

  Iterator'larla (Modül 14) da çözebilirsin:

  ```rust
  fn sepet_toplami(sepet: &[(&str, u32, u32)]) -> u32 {
      sepet.iter().map(|&(_, adet, fiyat)| adet * fiyat).sum()
  }
  ```

  Ama dikkat: `max_by_key` eşitlikte **son** elemanı döndürür; "eşitlikte ilk kazanır" kuralı için
  `max_by_key` uygun değildir. Kuralları testler belirler, iterator'ın alışkanlığı değil.

  İmzadaki `'a` (Modül 12) dönen `&str`'nin sepet dilimine değil, içindeki ürün adlarına bağlı olduğunu
  söyler.
````

Şimdi `let ... else` ile gerçek bir ayrıştırıcı yaz:

```exercise
id: m21-e-komut
title: Market komutlarını çözmek
difficulty: 3
prompt: |
  Bir sesli asistan, kullanıcının söylediğini `"elma 3"` gibi bir metne çeviriyor: önce ürün adı, bir
  boşluk, sonra adet. `komut_coz` fonksiyonunu yaz:

  - Önce satırın başındaki ve sonundaki boşlukları at (`trim`).
  - **İlk** boşluktan ikiye böl (`split_once(' ')`). Boşluk yoksa `None`.
  - Ad ve adet parçalarını ayrıca `trim` et. Ad boşsa `None`.
  - Adet bir `u32` olarak ayrışmıyorsa ya da `0` ise `None`.
  - Her şey yolundaysa `Some((ad, adet))`.

  Her adımı `let ... else` ile yaz; iç içe `match` kurma.
starter: |
  fn komut_coz(satir: &str) -> Option<(&str, u32)> {
      todo!()
  }

  fn main() {
      for s in ["elma 3", "  armut   12 ", "muz", "kiraz üç", "erik 0"] {
          println!("{s:?} → {:?}", komut_coz(s));
      }
  }
solution: |
  fn komut_coz(satir: &str) -> Option<(&str, u32)> {
      let Some((ad, adet)) = satir.trim().split_once(' ') else {
          return None;
      };
      let ad = ad.trim();
      if ad.is_empty() {
          return None;
      }
      let Ok(adet) = adet.trim().parse::<u32>() else {
          return None;
      };
      if adet == 0 {
          return None;
      }
      Some((ad, adet))
  }

  fn main() {
      for s in ["elma 3", "  armut   12 ", "muz", "kiraz üç", "erik 0"] {
          println!("{s:?} → {:?}", komut_coz(s));
      }
  }
check: tests
tests: |
  #[test]
  fn duz_komut() {
      assert_eq!(komut_coz("elma 3"), Some(("elma", 3)));
      assert_eq!(komut_coz("ceviz 250"), Some(("ceviz", 250)), "çok basamaklı adetler de çalışmalı");
  }

  #[test]
  fn fazla_bosluklar_temizlenir() {
      assert_eq!(komut_coz("  armut   12 "), Some(("armut", 12)), "baştaki, sondaki ve aradaki fazla boşluklar atılmalı");
  }

  #[test]
  fn bosluk_yoksa_none() {
      assert_eq!(komut_coz("muz"), None, "adet yoksa komut geçersizdir");
      assert_eq!(komut_coz("   "), None, "boş satır geçersizdir");
  }

  #[test]
  fn gecersiz_ya_da_sifir_adet() {
      assert_eq!(komut_coz("kiraz üç"), None, "\"üç\" bir sayı değil");
      assert_eq!(komut_coz("erik 0"), None, "0 adet geçersizdir");
      assert_eq!(komut_coz("erik -2"), None, "u32 negatif olamaz");
  }
hints:
  - "İlk adım: `let Some((ad, adet)) = satir.trim().split_once(' ') else { return None; };`"
  - "`parse::<u32>()` bir `Result` döndürür; onu da `let Ok(adet) = ... else { return None; };` ile aç. Önce `adet.trim()` yapmayı unutma: `\"  12\"` doğrudan ayrışmaz."
  - "Ad boşluğu ve sıfır kontrolü için `if ad.is_empty() { return None; }` ve `if adet == 0 { return None; }` yeterli. Sonda `Some((ad, adet))` döndür."
require:
  - pattern: "let\\s+(Some|Ok)\\s*\\("
    message: En az bir adımı `let Some(...) = ... else` ya da `let Ok(...) = ... else` ile yaz.
explanation: |
  `let ... else` sayesinde fonksiyon yukarıdan aşağıya düz bir liste gibi okunur: "böl, olmazsa çık;
  sayıya çevir, olmazsa çık; ..." Her başarılı adım yeni isimleri (`ad`, `adet`) **fonksiyonun geri
  kalanına** açar. `if let` ile yazsaydın her adım bir girinti daha içeri kayardı.

  Gölgelemeye (shadowing, Modül 2) dikkat: `adet` önce `&str`, sonra aynı isimle `u32` oldu. Ayrıştırma
  kodunda bu çok yaygın ve okunaklı bir deyimdir.

  Alternatif olarak Modül 10'daki `?` ile de yazabilirsin: `let (ad, adet) = satir.trim().split_once(' ')?;`
  ve `let adet: u32 = adet.trim().parse().ok()?;`. `?` kısa ve güçlüdür; `let ... else` ise `else`
  bloğunda farklı bir değer döndürmen ya da bir mesaj yazdırman gerektiğinde öne çıkar.
```

## Özet

:::remember
- `let DESEN = IFADE;`: `=`'nin solu her zaman bir **desendir**; tek bir isim bile.
- Desen konumları: `match` kolları, `if let` / `else if let`, `while let`, `let ... else`, `let`, `for DESEN in`,
  fonksiyon parametreleri, closure parametreleri.
- Desen hem **şekli sınar** hem de parçalara **isim bağlar** (yapı bozma, destructuring); istediğin kadar iç içe olabilir.
- `if let` zincirleri farklı değerleri sınamak içindir; eksiksizlik denetimi yoktur. Aynı değerin bütün durumları için `match`.
- `for` deseni iterator'ın **eleman tipine** göre yazılır: `(i, x)` enumerate için, `&(x, y)` bir `&(T, U)` için, `(k, v)` `HashMap` için.
- Parametre desenleri her zaman uymalıdır: `fn f(Some(x): Option<i32>)` → **E0005**.
:::

```reflect
prompt: |
  `let (ad, not) = ogrenci;` satırı ile `for (ad, not) in liste` satırı arasında desen açısından ne fark
  var, ne ortak? Kendi cümlelerinle açıkla.
answer: |
  İkisinde de `(ad, not)` aynı tuple desenidir ve aynı işi yapar: iki elemanlı bir değeri parçalayıp
  parçalara isim verir. Fark, desenin **kaç kez** ve **hangi değere** uygulandığıdır: `let` bir kez,
  sağdaki ifadenin değerine; `for` ise iterator'ın ürettiği **her elemana** bir kez. Bu yüzden `for`
  desenini yazarken iterator'ın eleman tipini (`T`, `&T`, `(usize, &T)`...) bilmem gerekir. Her iki konum
  da her zaman uyan desen ister.
```

```flashcards
- front: Bir desen hangi iki işi yapar?
  back: Değerin **şeklini sınar** ve uyarsa parçalarına **isim bağlar** (yapı bozma / destructuring).
- front: "`let x = 5;` satırında desen hangisidir?"
  back: "`x`: her değere uyan ve onu `x`'e bağlayan bir isim desenidir. Genel biçim `let DESEN = IFADE;`."
- front: Rust'ta desenlerin geçtiği 8 konumu say.
  back: "`match` kolları, `if let` (ve `else if let`), `while let`, `let ... else`, `let`, `for DESEN in`, fonksiyon parametreleri, closure parametreleri."
- front: "`for &(x, y) in &noktalar` satırında (`noktalar: Vec<(i32, i32)>`) `&` deseni ne yapar?"
  back: "Iterator'ın verdiği `&(i32, i32)` referansını açar; `x` ve `y` `i32` kopyaları olur."
- front: "`HashMap` üzerinde `for (k, v) in &harita` dönerken `k` ve `v`'nin tipleri nedir?"
  back: "`&K` ve `&V`: hem anahtar hem değer ödünç alınır."
- front: "`fn f(Some(x): Option<i32>)` neden derlenmez?"
  back: "**E0005**: parametre desenleri her zaman uymalıdır; `None` durumu kapsanmıyor."
- front: "`if let` zincirleri ile `match` arasında hangisi eksiksizlik denetimi yapar?"
  back: "Yalnızca `match`. `if let` zincirlerinde unutulan durum sessizce geçilir."
```
