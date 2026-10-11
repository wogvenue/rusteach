---
id: m06-l03
title: Debug ile yazdırma
minutes: 16
type: lesson
objectives:
  - "`#[derive(Debug)]` ekleyerek kendi tiplerini `{:?}` ve `{:#?}` ile yazdırabilmek"
  - "`dbg!` makrosunu sahipliği bozmadan (`dbg!(&x)`) hata ayıklamak için kullanabilmek"
  - Debug ile Display arasındaki farkı ve Display'in neden türetilemediğini açıklayabilmek
keywords: [Debug, derive, "{:?}", "{:#?}", "dbg!", Display, E0277, stderr]
---

Şimdiye kadar bir struct'ı yazdırmak için alanlarını tek tek `println!`'e veriyordun. Üç alanlı bir
struct'ta bu katlanılabilir; on alanlı bir struct'ta ise işkenceye döner. Peki doğrudan
`println!("{}", ogrenci)` yazsak ne olur?

Bu derste Rust'ın bu soruya verdiği cevabı ve hata ayıklamanın en pratik üç aracını öğreneceksin:
`#[derive(Debug)]`, `{:?}` / `{:#?}` ve `dbg!` makrosu.

## Bir struct'ı doğrudan yazdırmayı denemek

Önce tahmin et:

```compiles
code: |
  struct Ogrenci {
      ad: String,
      numara: u32,
  }

  fn main() {
      let o = Ogrenci { ad: String::from("Ayşe"), numara: 1001 };
      println!("{o}");
  }
answer: false
error: E0277
explanation: |
  `{}` (ya da `{o}`) yer tutucusu, değerin **kullanıcıya nasıl gösterileceğini** bilen `Display`
  yeteneğini ister. `i32`, `f64`, `String` bu yeteneğe sahiptir ama Rust **senin** tipini kullanıcıya
  nasıl göstereceğini bilemez: `E0277`.
```

:::error
```text
error[E0277]: `Ogrenci` doesn't implement `std::fmt::Display`
 --> src/main.rs:8:15
  |
8 |     println!("{o}");
  |               ^^^ `Ogrenci` cannot be formatted with the default formatter
  |
help: the trait `std::fmt::Display` is not implemented for `Ogrenci`
 --> src/main.rs:1:1
  |
1 | struct Ogrenci {
  | ^^^^^^^^^^^^^^
  = note: in format strings you may be able to use `{:?}` (or `{:#?}` for pretty-print) instead
```
Son satırdaki nota dikkat: derleyici sana `{:?}` denemeni öneriyor.
:::

Mesajda geçen **trait** kelimesi, bir tipin sahip olduğu **yetenekleri** anlatır. `Display` "kullanıcıya
gösterilebilir", `Debug` ise "programcıya gösterilebilir" yeteneğidir. Trait'leri Modül 11'de ayrıntılı
öğreneceğiz; şimdilik "bir tipin yapabildiği şeylerin adı" diye düşünmen yeterli.

Önerileni yapıp `{o:?}` yazalım. Yine olmuyor, ama bu kez mesaj çözümü doğrudan söylüyor:

:::error
```text
error[E0277]: `Ogrenci` doesn't implement `Debug`
 --> src/main.rs:8:15
  |
8 |     println!("{o:?}");
  |               ^^^^^ `Ogrenci` cannot be formatted using `{:?}` because it doesn't implement `Debug`
  |
  = help: the trait `Debug` is not implemented for `Ogrenci`
help: consider annotating `Ogrenci` with `#[derive(Debug)]`
  |
1 + #[derive(Debug)]
2 | struct Ogrenci {
```
:::

## `#[derive(Debug)]`: tek satırla yazdırılabilir tip

Derleyicinin önerdiği satırı ekleyelim:

```rust
#[derive(Debug)]
struct Ogrenci {
    ad: String,
    numara: u32,
    ortalama: f64,
}

fn main() {
    let o = Ogrenci {
        ad: String::from("Ayşe Yılmaz"),
        numara: 1001,
        ortalama: 3.0,
    };
    println!("{:?}", o);
    println!("{o:?}"); // satır içi argümanla da olur
    println!("Ortalama (Display ile): {}", o.ortalama);
#   let _ = (&o.ad, o.numara);
}
```

- `#[...]` bir **nitelik (attribute)**: derleyiciye verilen bir talimattır.
- `derive(Debug)`, derleyiciden bu tip için **Debug kodunu otomatik üretmesini (türetmesini)** ister.
  Kod derleme sırasında üretilir; senin yazman gerekmez.
- Bundan sonra tip `{:?}` ile yazdırılabilir: önce tipin adı, sonra `alan: değer` çiftleri.

Neden her tip kendiliğinden yazdırılabilir değil? Çünkü Rust **istemediğin kodu üretmez** ve her tipin
yazdırılması da istenmez: bir `Sifre` struct'ının içeriği yanlışlıkla log dosyasına düşmemeli. Python'da
sıradan bir sınıfı yazdırınca `<__main__.Ogrenci object at 0x7f...>`, Java'da `Ogrenci@1b6d3586` gibi
işe yaramaz bir çıktı alırsın. Rust'ta varsayılan olarak hiçbir şey yoktur; ama tek satırla gerçekten
okunabilir bir çıktıya kavuşursun.

Debug çıktısının biçimini tahmin et:

```predict
code: |
  #[derive(Debug)]
  struct Urun {
      ad: String,
      fiyat: f64,
      stok: u32,
  }

  fn main() {
      let u = Urun { ad: String::from("Çay"), fiyat: 45.0, stok: 3 };
      println!("{u:?}");
  #   let _ = (&u.ad, u.fiyat, u.stok);
  }
options:
  - 'Urun { ad: "Çay", fiyat: 45.0, stok: 3 }'
  - "Urun { ad: Çay, fiyat: 45, stok: 3 }"
  - 'Urun { ad: "Çay", fiyat: 45, stok: 3 }'
  - 'Urun(ad: "Çay", fiyat: 45.0, stok: 3)'
answer: 0
explanation: |
  Debug, **programcı** için kesin ve belirsizliksiz bir görüntü verir:

  - `String`'ler **tırnak içinde** yazılır; böylece baştaki/sondaki boşlukları ya da boş bir
    `String`'i (`""`) görebilirsin. Özel karakterler kaçışlı gösterilir (`\n`, `\"`).
  - `f64` her zaman ondalık noktasıyla yazılır: `45.0`. (Display ise `{}` ile `45` yazar.)
  - Adlandırılmış alanlı struct'lar `Ad { alan: değer, ... }`, tuple struct'lar `Ad(değer, ...)` biçimindedir.
```

:::analogy Röntgen ve vesikalık
**Debug** bir röntgen filmidir: içeride ne varsa olduğu gibi gösterir; güzel olmak zorunda değildir,
**uzman** (programcı) içindir. **Display** ise vesikalık fotoğraftır: özenle hazırlanmış, **herkese**
gösterilecek bir görüntü. Röntgeni makine otomatik çeker (`derive`), vesikalık için ise poza sen karar
verirsin.
:::

`{:?}` ile bir struct yazdırmak, onun **bütün alanlarını** yazdırmak demektir. Bu yüzden alanların
tiplerinin de `Debug` olması gerekir. `String`, sayılar, `bool`, `char`, tuple'lar, diziler ve `Vec`
zaten `Debug`'dır; ama kendi yazdığın iç içe bir struct'a da `derive` eklemeyi unutmamalısın:

:::error
```text
error[E0277]: `Adres` doesn't implement `Debug`
 --> src/main.rs:8:5
  |
5 | #[derive(Debug)]
  |          ----- in this derive macro expansion
...
8 |     adres: Adres,
  |     ^^^^^^^^^^^^ the trait `Debug` is not implemented for `Adres`
  |
help: consider annotating `Adres` with `#[derive(Debug)]`
```
:::

## `{:#?}`: güzel yazdırma (pretty-print)

Alan sayısı arttıkça tek satırlık çıktı okunmaz hâle gelir. Araya bir `#` ekle: `{:#?}` her alanı ayrı
satıra, iç içe yapıları **girintili** yazar.

```rust
#[derive(Debug)]
struct Adres {
    sehir: String,
    ilce: String,
}

#[derive(Debug)]
struct Ogrenci {
    ad: String,
    adres: Adres,
}

fn main() {
    let o = Ogrenci {
        ad: String::from("Ali"),
        adres: Adres {
            sehir: String::from("Isparta"),
            ilce: String::from("Eğirdir"),
        },
    };
    println!("{o:?}");
    println!("{o:#?}");
#   let _ = (&o.ad, &o.adres.sehir, &o.adres.ilce);
}
```

Aynı kural her yerde geçerli: `Debug` olan tiplerden oluşan bir `Vec` ya da dizi de `{:?}` ile
yazdırılabilir. Örneğin `vec![Renk(1, 2, 3), Renk(4, 5, 6)]` → `[Renk(1, 2, 3), Renk(4, 5, 6)]`.

Şimdi iç içe bir tuple struct'ın güzel yazdırılmış hâlini tahmin et:

```predict
code: |
  #[derive(Debug)]
  struct Konum(f64, f64);

  #[derive(Debug)]
  struct Istasyon {
      sehir: String,
      konum: Konum,
  }

  fn main() {
      let ist = Istasyon {
          sehir: String::from("Rize"),
          konum: Konum(41.02, 40.52),
      };
      println!("{ist:#?}");
  #   let _ = (&ist.sehir, ist.konum.0, ist.konum.1);
  }
options:
  - |
    Istasyon {
        sehir: "Rize",
        konum: Konum(
            41.02,
            40.52,
        ),
    }
  - |
    Istasyon {
        sehir: "Rize",
        konum: Konum(41.02, 40.52),
    }
  - |
    Istasyon { sehir: "Rize", konum: Konum(41.02, 40.52) }
answer: 0
explanation: |
  `{:#?}` kuralını **her seviyede** uygular: iç içe `Konum` de açılır ve her değer ayrı satıra yazılır.
  Ayrıca her öğeden sonra (sonuncusu dahil) bir **virgül** konur. Bu sayede iki çıktıyı satır satır
  karşılaştırmak (diff) kolaylaşır.
```

:::info "never read" uyarısı
Küçük örneklerde alanları yalnızca `{:?}` ile yazdırırsan derleyici şöyle uyarabilir:
`warning: fields sehir and ilce are never read ... Adres has a derived impl for the trait Debug, but
this is intentionally ignored during dead code analysis`. Yani türetilmiş `Debug` kodu, alanı "kullanmak"
sayılmaz; aksi hâlde gerçekten unutulmuş alanlar gizlenirdi. Gerçek programlarda alanlar başka yerlerde de
okunduğu için bu uyarı kaybolur. Uyarıdır, hata değil, programın çalışır.
:::

Şimdi öğrendiklerini kullanıp derlenmeyen bir programı onar:

```exercise
id: m06-e-debug-duzelt
title: Eksik derive'ı bul
difficulty: 1
prompt: |
  Bu program bir müşteri kaydını `{:#?}` ile yazdırmak istiyor ama **derlenmiyor**. Derleyicinin
  mesajını oku ve programı, aşağıdaki çıktıyı verecek şekilde düzelt. `main`'e dokunmana gerek yok.

  Beklenen çıktı:

      Musteri {
          ad: "Selin Aydın",
          adres: Adres {
              sehir: "Isparta",
              ilce: "Eğirdir",
          },
      }
starter_compiles: false
starter: |
  struct Adres {
      sehir: String,
      ilce: String,
  }

  #[derive(Debug)]
  struct Musteri {
      ad: String,
      adres: Adres,
  }

  fn main() {
      let m = Musteri {
          ad: String::from("Selin Aydın"),
          adres: Adres {
              sehir: String::from("Isparta"),
              ilce: String::from("Eğirdir"),
          },
      };
      println!("{m:#?}");
  }
solution: |
  #[derive(Debug)]
  struct Adres {
      sehir: String,
      ilce: String,
  }

  #[derive(Debug)]
  struct Musteri {
      ad: String,
      adres: Adres,
  }

  fn main() {
      let m = Musteri {
          ad: String::from("Selin Aydın"),
          adres: Adres {
              sehir: String::from("Isparta"),
              ilce: String::from("Eğirdir"),
          },
      };
      println!("{m:#?}");
  }
check: output
expected_output: |
  Musteri {
      ad: "Selin Aydın",
      adres: Adres {
          sehir: "Isparta",
          ilce: "Eğirdir",
      },
  }
hints:
  - "Derleyici hangi tipin `Debug` olmadığını söylüyor? Mesajdaki `help:` satırına bak."
  - "`Musteri`'yi yazdırmak, içindeki **her alanı** yazdırmak demektir; `adres` alanının tipi de `Debug` olmalı."
  - "`struct Adres` satırının hemen üstüne `#[derive(Debug)]` ekle."
require:
  - pattern: "#\\[derive\\(Debug\\)\\]\\s*struct\\s+Adres"
    message: "`Adres` struct'ına `#[derive(Debug)]` eklemelisin."
explanation: |
  Türetilmiş `Debug`, struct'ın her alanını sırayla yazdırırken o alanın **kendi** `Debug` kodunu
  çağırır. `Musteri` türetilmiş olsa da `Adres` değilse zincir kopar: `E0277`. Tek satırlık
  `#[derive(Debug)]` zinciri tamamlar.

  Programı çalıştırdığında `never read` uyarıları görebilirsin; alanlar yalnızca `Debug` ile
  kullanıldığı için derleyici seni bilgilendiriyor. Bu bir uyarıdır, hata değil.
```

## `dbg!` makrosu: hızlı hata ayıklama

Bir hesaplamanın ara değerlerini görmek istediğinde her seferinde `println!` yazmak yerine `dbg!`
kullan:

```rust
#[derive(Debug)]
struct Dikdortgen {
    genislik: u32,
    yukseklik: u32,
}

fn main() {
    let olcek = 2;
    let d = Dikdortgen {
        genislik: dbg!(30 * olcek),
        yukseklik: 50,
    };
    dbg!(&d);
    let alan = d.genislik * d.yukseklik;
    println!("Alan: {alan}");
}
```

Çalıştırınca şunu görürsün:

```text
[src/main.rs:10:19] 30 * olcek = 60
[src/main.rs:13:5] &d = Dikdortgen {
    genislik: 60,
    yukseklik: 50,
}
Alan: 3000
```

`dbg!`'in dört özelliği:

1. **Nerede ve ne:** dosya, satır ve sütunu, ifadenin **kaynak metnini** (`30 * olcek`) ve değerini
   `{:#?}` biçiminde yazar. Hangi satırın ne ürettiğini aramak zorunda kalmazsın.
2. **stderr'e yazar:** `println!` gibi standart çıktıya (stdout) değil, Modül 1'deki `eprintln!` gibi
   **standart hataya (stderr)** yazar. Böylece programın asıl çıktısına karışmaz; çıktıyı bir dosyaya
   yönlendirsen bile hata ayıklama satırları ekranda kalır.
3. **Değeri geri döndürür:** `genislik: dbg!(30 * olcek)` yazabildik, çünkü `dbg!` ifadenin değerini
   aynen geri verir. Herhangi bir ifadeyi kodu bozmadan sarmalayabilirsin.
4. **Sahipliği alır:** Değeri geri döndürebilmek için önce **sahiplenir** (taşır). Bu yüzden bir
   değişkeni incelerken çoğunlukla `dbg!(&d)` yazarsın.

```predict
question: "Bu program **standart çıktıya (stdout)** ne yazar?"
code: |
  fn main() {
      let genislik = 4;
      let alan = dbg!(genislik * 3) * 2;
      println!("{alan}");
  }
options:
  - "24"
  - |
    [src/main.rs:3:16] genislik * 3 = 12
    24
  - "12"
answer: 0
explanation: |
  `dbg!(genislik * 3)` önce **stderr**'e `[src/main.rs:3:16] genislik * 3 = 12` yazar, sonra `12`'yi
  geri döndürür; `12 * 2 = 24`. Standart çıktıya yalnızca `println!`'in yazdığı `24` gider. Terminalde
  ikisini de görürsün ama `cargo run > cikti.txt` dersen dosyaya sadece `24` yazılır.
```

Sahiplik meselesi önemli; Modül 4'teki taşıma kurallarını hatırla ve tahmin et:

```compiles
code: |
  #[derive(Debug)]
  struct Sepet {
      urun_sayisi: u32,
      sahibi: String,
  }

  fn main() {
      let s = Sepet { urun_sayisi: 3, sahibi: String::from("Elif") };
      dbg!(s);
      println!("{} ürün", s.urun_sayisi);
  }
answer: false
error: E0382
explanation: |
  `dbg!(s)` sepeti **sahiplenir** (taşır) ve geri döndürür; ama dönen değeri hiçbir değişkene
  bağlamadığımız için sepet o satırın sonunda drop edilir. Sonra `s`'yi kullanmak `E0382` olur.
  Derleyicinin önerisi: `dbg!(&s)`. Diğer çözüm: `let s = dbg!(s);` ile dönen değeri geri almak.
```

```memory
title: "`let s = dbg!(s);` - sahiplik gidip geri geliyor"
steps:
  - caption: "Başlangıç: `s` sepetin sahibi; `sahibi` alanının karakterleri heap'te."
    stack:
      - frame: main
        vars:
          - { name: s, type: Sepet, value: "urun_sayisi=3 · sahibi=ptr", to: h1 }
    heap:
      - { id: h1, value: "E l i f" }
  - caption: "`dbg!` değeri kendi içindeki geçici bir değişkene **taşır** ve stderr'e yazdırır. Bu sırada eski `s` geçersizdir."
    stack:
      - frame: main
        vars:
          - { name: s, type: Sepet, value: "urun_sayisi=3 · sahibi=ptr", moved: true, note: "dbg!'e taşındı" }
      - frame: "dbg! içi"
        vars:
          - { name: tmp, type: Sepet, value: "urun_sayisi=3 · sahibi=ptr", to: h1 }
    heap:
      - { id: h1, value: "E l i f" }
  - caption: "`dbg!` değeri aynen geri döndürür; `let s = ...` onu yeni `s`'ye bağlar (gölgeleme). Heap verisi hiç kopyalanmadı."
    stack:
      - frame: main
        vars:
          - { name: s, type: Sepet, value: "urun_sayisi=3 · sahibi=ptr", to: h1 }
    heap:
      - { id: h1, value: "E l i f" }
```

:::warning dbg! geçicidir
`dbg!` release derlemelerinde de çalışmaya devam eder; kendiliğinden kaybolmaz. Onu hata ararken kullan,
işin bitince **sil**. `cargo clippy`'nin `dbg_macro` kuralını açarsan unutulmuş `dbg!` satırlarını senin
yerine bulur.
:::

## Display neden türetilemez?

`Debug` tek satırla geldi. O zaman `Display` için de aynısını yapsak?

```compiles
code: |
  #[derive(Display)]
  struct Ogrenci {
      ad: String,
  }

  fn main() {
      let o = Ogrenci { ad: String::from("Ayşe") };
      println!("{}", o.ad);
  }
answer: false
explanation: |
  Derlenmez: `error: cannot find derive macro Display in this scope`. Derleyici ayrıca
  `Display is a trait, not a derive macro` ve `consider implementing Display for your type manually`
  der. Standart kütüphanede `Display` için bir `derive` yoktur - ve bu bilinçli bir karardır.
```

Neden? Çünkü Debug'ın **tek bir doğru biçimi** vardır (tip adı + alanlar), derleyici onu kendisi
üretebilir. Display ise kullanıcıya **nasıl görüneceğine** dair bir tasarım kararıdır ve tek doğru
cevabı yoktur. Bir `Tarih` için hangisi doğru: `29.10.1923`, `29 Ekim 1923` ya da `1923-10-29`? Bir para
tutarı `1.234,50 TL` mi, `₺1,234.50` mi? Bu kararı derleyici veremez; sen verirsin. Modül 11'de
`impl fmt::Display` yazarak kendi tiplerine `{}` desteği ekleyeceksin.

O zamana kadar aynı işi bir fonksiyonla yapabilirsin: Modül 1'den tanıdığın `format!` bir `String`
üretir.

```rust
struct Tarih {
    gun: u8,
    ay: u8,
    yil: u16,
}

fn tarih_metni(t: &Tarih) -> String {
    format!("{:02}.{:02}.{}", t.gun, t.ay, t.yil)
}

fn main() {
    let cumhuriyet = Tarih { gun: 29, ay: 10, yil: 1923 };
    let bahar = Tarih { gun: 5, ay: 3, yil: 2026 };
    println!("Cumhuriyetin ilanı: {}", tarih_metni(&cumhuriyet));
    println!("Bahar şenliği: {}", tarih_metni(&bahar));
}
```

```exercise
id: m06-e-karne-satiri
title: Karne satırı
difficulty: 2
prompt: |
  Okulun karne sistemi öğrencileri **kullanıcıya gösterilecek** biçimde, tek satırda listelemek
  istiyor. `karne_satiri` şu biçimde bir `String` döndürsün: `0007 | Can Yücel | 3.50`

  - Numara en az **4 haneli** ve soldan **sıfırla doldurulmuş** olmalı (`7` → `0007`, ama `12345` → `12345`).
  - Ortalama her zaman **2 ondalık basamakla** yazılmalı (`3.5` → `3.50`, `3.456` → `3.46`).
  - Parçalar arasında boşluk, dik çizgi, boşluk (` | `) olmalı.
starter: |
  #[derive(Debug)]
  struct Ogrenci {
      numara: u32,
      ad: String,
      ortalama: f64,
  }

  fn karne_satiri(o: &Ogrenci) -> String {
      todo!()
  }

  fn main() {
      let can = Ogrenci { numara: 7, ad: String::from("Can Yücel"), ortalama: 3.5 };
      println!("{}", karne_satiri(&can));
      println!("{can:?}");
  }
solution: |
  #[derive(Debug)]
  struct Ogrenci {
      numara: u32,
      ad: String,
      ortalama: f64,
  }

  fn karne_satiri(o: &Ogrenci) -> String {
      format!("{:04} | {} | {:.2}", o.numara, o.ad, o.ortalama)
  }

  fn main() {
      let can = Ogrenci { numara: 7, ad: String::from("Can Yücel"), ortalama: 3.5 };
      println!("{}", karne_satiri(&can));
      println!("{can:?}");
  }
check: tests
tests: |
  #[test]
  fn tek_haneli_numara_sifirla_doldurulur() {
      let o = Ogrenci { numara: 7, ad: String::from("Can Yücel"), ortalama: 3.5 };
      assert_eq!(karne_satiri(&o), "0007 | Can Yücel | 3.50");
  }

  #[test]
  fn ortalama_iki_basamaga_yuvarlanir() {
      let o = Ogrenci { numara: 1001, ad: String::from("Ayşe Yılmaz"), ortalama: 3.456 };
      assert_eq!(karne_satiri(&o), "1001 | Ayşe Yılmaz | 3.46", "3.456 iki basamakta 3.46 olmalı");
  }

  #[test]
  fn tam_sayi_ortalama() {
      let o = Ogrenci { numara: 42, ad: String::from("Ece"), ortalama: 2.0 };
      assert_eq!(karne_satiri(&o), "0042 | Ece | 2.00", "2.0 → 2.00 yazılmalı");
  }

  #[test]
  fn bes_haneli_numara_kesilmez() {
      let o = Ogrenci { numara: 12345, ad: String::from("Deniz"), ortalama: 4.0 };
      assert_eq!(karne_satiri(&o), "12345 | Deniz | 4.00", "genişlik bir alt sınırdır; uzun sayı kesilmemeli");
  }
hints:
  - "Bir `String` üretmenin en kolay yolu Modül 1'deki `format!` makrosu; `println!` gibi çalışır ama yazdırmak yerine `String` döndürür."
  - "Genişlik ve sıfır dolgusu: `{:04}`. Ondalık hassasiyet: `{:.2}`. Hatırla: `{o.numara}` gibi alan erişimi biçim dizgesinin içinde yazılamaz; değerleri argüman olarak ver."
  - "`format!(\"{:04} | {} | {:.2}\", o.numara, o.ad, o.ortalama)`"
explanation: |
  `format!`, `println!` ile aynı biçim kurallarını kullanır ama sonucu yazdırmak yerine bir `String`
  olarak döndürür. Kullandığımız biçim belirteçleri:

  - `{:04}` → en az 4 karakter, eksik kalırsa soldan `0` ile doldur. Genişlik bir **alt sınırdır**;
    `12345` kesilmez.
  - `{:.2}` → ondalık kısmı 2 basamağa **yuvarla**: `3.456` → `3.46`, `2.0` → `2.00`.

  Fonksiyon öğrenciyi `&Ogrenci` ile **ödünç** alıyor; karne satırı üretmek için sahipliğe gerek yok.
  Modül 11'de `impl fmt::Display` yazmayı öğrendiğinde bu fonksiyonu kolayca
  `impl fmt::Display for Ogrenci` hâline getirebilirsin; o zaman `println!("{}", ogrenci)` doğrudan çalışır.
```

## Özet

:::remember
- `{}` → **Display** (kullanıcı için); `{:?}` → **Debug** (programcı için). Kendi tiplerinde ikisi de kendiliğinden yoktur (`E0277`).
- `#[derive(Debug)]` Debug kodunu derleyiciye ürettirir. İç içe tiplerin **hepsi** `Debug` olmalı.
- `{:?}` tek satır, `{:#?}` girintili çok satır. String'ler tırnaklı, `f64`'ler `45.0` biçiminde görünür.
- `dbg!(ifade)`: konum + ifade metni + değer → **stderr**; değeri geri döndürür ama **sahiplenir** → `dbg!(&x)`.
- `Display` türetilemez: kullanıcıya görünüm bir tasarım kararıdır. Şimdilik `format!` ile bir fonksiyon yaz (Modül 11'de `impl Display`).
:::

```reflect
prompt: |
  Rust'ta Debug ve Display neden iki ayrı yetenek (trait)? Neden biri tek satırla türetilebiliyor da
  diğeri türetilemiyor? İçinde parola tutan bir `Kullanici` struct'ı üzerinden düşünerek açıkla.
answer: |
  Debug **programcı** içindir: iç yapıyı belirsizliksiz gösterir ve bunun tek bir standart biçimi
  vardır (tip adı + alanlar); bu yüzden derleyici onu üretebilir. Display ise **kullanıcı** içindir;
  tarihin, paranın, bir öğrencinin ekranda nasıl görüneceği bağlama göre değişen bir tasarım kararıdır,
  derleyici tahmin edemez. İkisinin de isteğe bağlı (opt-in) olması güvenlik açısından da değerlidir:
  parola tutan bir `Kullanici`, `derive(Debug)` eklenmediği sürece yanlışlıkla log'a basılamaz. Modül 11'de
  Display'i elle yazmayı öğrendiğinde, aynı yolla Debug'ı da elle yazıp parolayı `****` olarak gösterebilirsin.
```

```flashcards
- front: "`#[derive(Debug)]` ne işe yarar?"
  back: "Derleyiciye tip için Debug kodunu otomatik **üretmesini** söyler; böylece tip `{:?}` ve `{:#?}` ile yazdırılabilir."
- front: "`{:?}` ile `{:#?}` arasındaki fark nedir?"
  back: "`{:?}` tek satırda yazar; `{:#?}` her alanı ayrı satıra ve iç içe yapıları girintili yazar (pretty-print)."
- front: "`println!(\"{}\", ogrenci)` neden derlenmez (ogrenci kendi struct'ın)?"
  back: "`{}` **Display** ister; kendi tiplerinde Display kendiliğinden yoktur ve türetilemez (**E0277**). `{:?}` + `derive(Debug)` kullan ya da Display'i elle yaz (Modül 11)."
- front: "`String` tipindeki bir alan Debug çıktısında nasıl görünür?"
  back: "Tırnak içinde ve kaçış karakterleriyle: `ad: \"Ayşe\"`. Böylece boşluklar ve boş string görünür olur."
- front: "`dbg!` çıktısını nereye yazar ve neleri içerir?"
  back: "**stderr**'e yazar: `[dosya:satır:sütun] ifadenin metni = değer` (değer `{:#?}` biçiminde)."
- front: "`dbg!(s);` satırından sonra `s` neden kullanılamaz (`s` bir `String` içeren struct)?"
  back: "`dbg!` değeri **sahiplenir** ve geri döndürür; dönüşü yakalamazsan değer drop edilir (**E0382**). Çözüm: `dbg!(&s)` ya da `let s = dbg!(s);`"
- front: İç içe struct'larda `{:?}` kullanabilmek için ne gerekir?
  back: "Dış struct ile birlikte içteki **tüm alan tiplerinin** de `Debug` olması; aksi hâlde **E0277**."
- front: Neden `#[derive(Display)]` yoktur?
  back: "Kullanıcıya gösterim tek doğru cevabı olmayan bir tasarım kararıdır (ör. tarih biçimleri). Display'i `impl fmt::Display` ile elle yazarsın (Modül 11)."
```
