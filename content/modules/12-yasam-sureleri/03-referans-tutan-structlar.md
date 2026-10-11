---
id: m12-l03
title: Referans tutan struct'lar
minutes: 18
type: lesson
objectives:
  - "Referans alanı olan bir struct'ı (`struct Alinti<'a>`) tanımlayıp örnekleyebilmek"
  - Bir struct örneğinin ödünç aldığı veriden uzun yaşayamayacağını E0597 ve E0505 üzerinden açıklayabilmek
  - "`impl<'a>` bloğunda alanlara referans döndüren metotlar yazıp `&self`'e bağlı dönüş ile `&'a` dönüş arasında seçim yapabilmek"
  - Sahipli (`String`) ve ödünç alan (`&'a str`) struct tasarımları arasında gerekçeli karar verebilmek
keywords: [lifetime, struct, "impl<'a>", zero-copy, E0106, E0597, E0505, sahipli, ödünç]
---

Modül 6'da struct alanlarına hep `String` koyduk ve "neden `&str` değil?" sorusunu **şimdilik** diye
erteledik. Sebebi şuydu: Bir struct referans tutacaksa, derleyiciye o referansın **ne kadar
yaşayacağını** anlatman gerekir. Artık bunun dilini biliyorsun.

Bu derste referans tutan struct'ları göreceksin. Bunlar Rust'ın en hızlı kütüphanelerinin, örneğin
metin ayrıştırıcıların ve JSON okuyucuların, **kopyasız (zero-copy)** çalışmasının sırrıdır.

## Struct'ta referans: neden ve nasıl?

Bir edebiyat uygulaması, uzun metinlerden alıntılar gösteriyor. Alıntı metnini her seferinde
kopyalamak yerine, alıntının orijinal metnin **bir parçasına bakmasını** istiyoruz. İlk deneme:

```compiles
code: |
  struct Alinti {
      parca: &str,
  }

  fn main() {
      let a = Alinti { parca: "Gelin tanış olalım" };
      println!("{}", a.parca);
  }
answer: false
error: E0106
explanation: |
  Struct alanındaki referansın yaşam süresi belirtilmemiş: `missing lifetime specifier`. Fonksiyonlarda
  derleyici bazı durumlarda tahmin yürütebiliyordu, ama struct tanımlarında **hiçbir zaman** tahmin
  yürütmez. Referans tutan her alanın yaşam süresi adıyla yazılmalı.
```

:::error
```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:2:12
  |
2 |     parca: &str,
  |            ^ expected named lifetime parameter
  |
help: consider introducing a named lifetime parameter
  |
1 ~ struct Alinti<'a> {
2 ~     parca: &'a str,
  |
```
Öneri, fonksiyonlarda gördüğün kalıbın aynısı: Yaşam süresi parametresini struct adından sonra `<'a>` ile
tanımla, alanda `&'a str` ile kullan.
:::

Doğru hâli şu. 13. yüzyıl şairi Yunus Emre'nin dizelerinden bir alıntı yapalım:

```rust
#[derive(Debug)]
struct Alinti<'a> {
    parca: &'a str,
}

fn main() {
    let siir = String::from("Gelin tanış olalım, işi kolay kılalım. Sevelim sevilelim, dünya kimseye kalmaz.");
    let (ilk_cumle, _) = siir.split_once('.').expect("metinde nokta olmalı");
    let alinti = Alinti { parca: ilk_cumle };
    println!("{alinti:?}");
    println!("Alıntı {} bayt, ama hiçbiri kopyalanmadı.", alinti.parca.len());
}
```

`struct Alinti<'a>` şöyle okunur: **"Bir `Alinti`, `'a` süresince yaşayan bir `str`'yi ödünç alır. Bu yüzden
hiçbir `Alinti` örneği `'a`'dan uzun yaşayamaz."** Bellekte durum şöyle:

```memory
title: "Alinti, String'in heap verisinin bir parçasına bakıyor"
steps:
  - caption: "`siir` bir `String`: stack'te işaretçi + uzunluk + kapasite, heap'te karakterler."
    stack:
      - frame: main
        vars:
          - { name: siir, type: String, value: "ptr · len=86 · cap=86", to: h1 }
    heap:
      - { id: h1, value: "Gelin tanış olalım, işi kolay kılalım. Sevelim..." }
  - caption: "`alinti.parca` aynı heap verisinin **başına** bakan bir dilim: işaretçi + uzunluk. Hiçbir karakter kopyalanmadı."
    stack:
      - frame: main
        vars:
          - { name: siir, type: String, value: "ptr · len=86 · cap=86", to: h1 }
          - { name: alinti, type: "Alinti<'_>", value: "parca: ptr · len=43", to: h1, note: "ilk cümleye bakıyor" }
    heap:
      - { id: h1, value: "Gelin tanış olalım, işi kolay kılalım. Sevelim..." }
```

:::analogy Kitaptaki yapışkan not
`Alinti`, bir kitabın sayfasına yapıştırdığın küçük bir not gibi: "Şu cümle çok güzel" diye cümlenin
**kendisini** değil, **yerini** işaret ediyor. Not ucuzdur, kitabı kopyalamana gerek yoktur. Ama not ancak
kitap durduğu sürece anlamlıdır. Kitabı birine verirsen ya da kitap yanarsa not boşluğu gösterir. `<'a>`,
notun üzerine "bu not, şu kitap kadar geçerlidir" yazmaktır.
:::

## Struct, ödünç aldığı veriden uzun yaşayamaz

Kuralın pratikteki karşılığını görelim. Alıntıyı dış blokta tutup metni iç blokta oluşturuyoruz. Tahmin et:

```compiles
code: |
  struct Alinti<'a> {
      parca: &'a str,
  }

  fn main() {
      let alinti;
      {
          let siir = String::from("Gelin tanış olalım. İşi kolay kılalım.");
          alinti = Alinti { parca: &siir };
      }
      println!("{}", alinti.parca);
  }
answer: false
error: E0597
explanation: |
  `siir` iç blokta ölüyor, ama `alinti` (ve içindeki referans) bloğun dışında kullanılıyor. Bir struct'ın
  içindeki referans da bir referanstır. Struct'ı bir kutuya koymak kuralları değiştirmez: `siir`'in ömrü,
  `alinti`'nin kullanıldığı bölgeyi kapsamalı.
```

:::error
```text
error[E0597]: `siir` does not live long enough
  --> src/main.rs:9:34
   |
 8 |         let siir = String::from("Gelin tanış olalım. İşi kolay kılalım.");
   |             ---- binding `siir` declared here
 9 |         alinti = Alinti { parca: &siir };
   |                                  ^^^^^ borrowed value does not live long enough
10 |     }
   |     - `siir` dropped here while still borrowed
11 |     println!("{}", alinti.parca);
   |                    ------------ borrow later used here
```
Hata mesajı ders 1'deki ile birebir aynı yapıda. Borrow checker için `Alinti` sadece referansı taşıyan bir
zarf. `alinti.parca`'nın kullanıldığı her yer, `siir`'in ödüncünün yaşam süresine dahildir.
:::

Veri ölmese bile, **ödünçteyken taşınamaz** (Modül 5'ten E0505). Struct örneği yaşadığı sürece onun
baktığı veri "kilitli"dir:

````quiz
question: |
  ```rust
  let siir = String::from("Gelin tanış olalım.");
  let a = Alinti { parca: &siir };
  let tasindi = siir;
  println!("{} {}", a.parca, tasindi);
  ```
  Bu kod için hangisi doğru?
options:
  - "Derlenir: `a`, `siir` taşınınca otomatik olarak `tasindi`'yi göstermeye başlar"
  - "E0505 ile derlenmez: `siir`, `a` tarafından ödünç alınmışken taşınıyor ve `a` sonra kullanılıyor"
  - "E0106 ile derlenmez: `Alinti`'nin yaşam süresi belirtilmemiş"
  - "Derlenir, ama `a.parca` çalışma zamanında boş metin yazdırır"
answer: 1
explanation: |
  `a` yaşadığı sürece (son kullanımı `println!`) `siir` ödünçtedir. Ödünçteki bir değeri taşımak yasak:
  **E0505** (*cannot move out of `siir` because it is borrowed*). Referanslar hiçbir zaman "otomatik
  güncellenmez". Sadece adres tutarlar. Rust da tam bu yüzden taşımayı engeller.

  Derleyici bu hatada `&siir.clone()` öneriyor. Bu derlenir, ama alıntıya metnin **kopyasını** verir.
  Kopyasız alıntı fikrinin tam tersi! Çoğu zaman daha iyi düzeltme sıralamadır: `a` ile işini
  taşımadan **önce** bitir. `clone`, Modül 4'te dediğimiz gibi bilinçli bir karar olmalı.
feedback:
  - "Referanslar adres tutar ve taşımada güncellenmez. Rust bu yüzden taşımayı yasaklar."
  - "Doğru! Ödünçteyken taşıma yok."
  - "`Alinti` doğru tanımlanmış (`<'a>` var). Sorun kullanımda."
  - "Rust'ta böyle bir çalışma zamanı sürprizi olmaz; hata derleme zamanında yakalanır."
````

## `impl<'a>` ve alanlara referans döndüren metotlar

Struct'a metot eklerken yaşam süresi parametresini `impl` satırında da **tanımlaman** gerekir. Generic
struct'lardaki `impl<T> Nokta<T>` kalıbının aynısı (Modül 11):

```rust
struct Alinti<'a> {
    parca: &'a str,
    yazar: &'a str,
}

impl<'a> Alinti<'a> {
    // İlişkili fonksiyon: Self burada Alinti<'a> demek
    fn yeni(parca: &'a str, yazar: &'a str) -> Self {
        Alinti { parca, yazar }
    }

    fn kelime_sayisi(&self) -> usize {
        let mut sayi = 0;
        for _ in self.parca.split_whitespace() {
            sayi += 1;
        }
        sayi
    }

    fn kunye(&self) -> String {
        format!("\"{}\" - {}", self.parca, self.yazar)
    }
}

fn main() {
    let metin = String::from("Sevelim sevilelim, dünya kimseye kalmaz");
    let a = Alinti::yeni(&metin, "Yunus Emre");
    println!("{} ({} kelime)", a.kunye(), a.kelime_sayisi());
}
```

`impl<'a> Alinti<'a>` satırındaki iki `'a`'nın görevi farklı: İlki (`impl<'a>`) parametreyi **tanımlar**,
ikincisi (`Alinti<'a>`) onu **kullanır**. "Her `'a` için, `Alinti<'a>` tipine şu metotları ekle."

Asıl ilginç soru, alan döndüren metotlarda çıkıyor. `parca`'yı döndüren bir metodu iki farklı şekilde
yazabilirsin:

```text
fn parca(&self) -> &str      // sonuç, Alinti örneğinin (self) ödüncüne bağlı
fn parca(&self) -> &'a str   // sonuç, Alinti'nin baktığı orijinal metne bağlı
```

İlk yazımda derleyici, dönen referansı `&self`'in yaşam süresine bağlar (kuralını ders 4'te göreceğiz).
Fark ne zaman ortaya çıkar? Alıntı nesnesi ölüp metin yaşamaya devam ettiğinde. Tahmin et:

```compiles
code: |
  struct Alinti<'a> {
      parca: &'a str,
  }

  impl<'a> Alinti<'a> {
      fn parca(&self) -> &str {
          self.parca
      }
  }

  fn main() {
      let metin = String::from("Yarın çok güzel olacak.");
      let p;
      {
          let a = Alinti { parca: &metin[..9] };
          p = a.parca();
      }
      println!("{p}");
  }
answer: false
error: E0597
explanation: |
  `fn parca(&self) -> &str` imzası "sonuç, `self` ödüncü kadar geçerli" diyor. `self` burada `a`,
  ve `a` iç blokta ölüyor. `p` dışarıda kullanıldığı için hata: `` `a` does not live long enough ``.
  Oysa `p` aslında `metin`'e bakıyor ve `metin` hâlâ canlı! Sorun imzanın gereğinden **dar** bir söz
  vermesi.
```

Şimdi tek bir değişiklik yapalım ve dönüş tipini `&'a str` yazalım:

```predict
code: |
  struct Alinti<'a> {
      parca: &'a str,
  }

  impl<'a> Alinti<'a> {
      fn parca(&self) -> &'a str {
          self.parca
      }
  }

  fn main() {
      let metin = String::from("Yarın çok güzel olacak.");
      let p;
      {
          let a = Alinti { parca: &metin[..9] };
          p = a.parca();
      }
      println!("{p}");
  }
options:
  - "Yarın ç"
  - "Yarın çok"
  - "Derlenmez: a iç blokta ölüyor"
answer: 0
explanation: |
  Derlenir! `-> &'a str` imzası "sonuç, Alinti'nin baktığı metin (`'a`) kadar geçerli" diyor. `a`'nın
  ölmesi önemsiz, çünkü `p` artık `a`'ya değil `metin`'e bağlı.

  Peki neden "Yarın çok" değil? `&metin[..9]` ilk 9 **karakteri** değil, ilk 9 **baytı** alır (Modül 5):
  `Y a r` (3) + `ı` (2) + `n` (1) + boşluk (1) + `ç` (2) = 9 bayt. Sınır tam `ç`'nin bitişine denk geliyor.
  `[..8]` yazsaydık `ç`'nin ortasında kesilirdi ve program panik verirdi.
```

Hangisini seçmelisin? **Alanın kendisi bir referanssa ve onu olduğu gibi döndürüyorsan `&'a` daha
esnektir.** Çağıran, sonucu struct öldükten sonra da kullanabilir. Struct'ın **sahip olduğu** bir
alana referans döndürüyorsan (örneğin bir `String` alanına) seçeneğin yoktur. O veri struct'la birlikte
öleceği için sonuç `&self`'e bağlı olmak zorundadır.

## Yaşam süresi bulaşıcıdır

Referans tutan bir struct'ı başka bir struct'ın içine koyarsan, dıştaki struct da bir yaşam süresi
parametresi almak **zorunda** kalır. `Alinti<'a>` bir referans taşıyorsa, onu taşıyan her şey de dolaylı
olarak o referansı taşır:

```rust
struct Alinti<'a> {
    parca: &'a str,
}

struct Rapor<'a> {
    baslik: &'a str,
    alintilar: Vec<Alinti<'a>>, // içteki yaşam süresi dışarıya "bulaşır"
}

fn main() {
    let kitap = String::from("Ağaç yaşken eğilir. Damlaya damlaya göl olur. Sakla samanı, gelir zamanı.");
    let mut rapor = Rapor { baslik: "Atasözleri", alintilar: Vec::new() };
    for cumle in kitap.split(". ") {
        rapor.alintilar.push(Alinti { parca: cumle });
    }
    println!("{}: {} alıntı", rapor.baslik, rapor.alintilar.len());
    for a in &rapor.alintilar {
        println!("- {}", a.parca);
    }
}
```

Bu "bulaşma", ödünç alan struct'ların bedelidir: `Rapor`'u kullanan her fonksiyon ve her struct da yaşam
süresini taşımak zorunda kalır. Şimdi `Rapor`'a bir metot ekleyerek bunu kendin dene:

```fill
prompt: "`Rapor`'u tanımla ve `ekle` metodunu, verilen parçayı rapora **saklayabilecek** şekilde tamamla."
code: |
  struct Alinti<'a> {
      parca: &'a str,
  }

  struct Rapor<___0> {
      baslik: &'a str,
      alintilar: Vec<___1>,
  }

  impl<'a> Rapor<'a> {
      fn ekle(&mut self, parca: ___2) {
          self.alintilar.push(Alinti { parca });
      }
  }

  fn main() {
      let metin = String::from("Ağaç yaşken eğilir.");
      let mut r = Rapor { baslik: "Atasözü", alintilar: Vec::new() };
      r.ekle(&metin);
      println!("{}: {}", r.baslik, r.alintilar[0].parca);
  }
blanks:
  - ["'a"]
  - ["Alinti<'a>"]
  - ["&'a str"]
output: "Atasözü: Ağaç yaşken eğilir."
explanation: |
  Üçüncü boşluk işin püf noktası. `ekle`, gelen `parca`'yı raporun **içine** saklıyor, yani parça en az
  rapor kadar (`'a`) yaşamalı. `parca: &str` yazsaydın derleyici ona ayrı, belki çok kısa bir yaşam süresi
  verirdi ve şu hatayı alırdın: `E0621: explicit lifetime required in the type of parca`. Bir referansı
  sakladığın yerin yaşam süresi, referansın yaşam süresiyle **uyumlu** olmak zorunda.
```

## Sahipli mi, ödünç mü?

Her struct için verilmesi gereken bir tasarım kararı var:

| | Sahipli: `struct Kitap { ad: String }` | Ödünç: `struct Kitap<'a> { ad: &'a str }` |
|---|---|---|
| Bellek | Her örnek kendi kopyasını tutar (heap ayırma) | Kopya yok, sadece işaretçi + uzunluk |
| Bağımsızlık | Her yere taşınabilir, döndürülebilir, saklanabilir | Kaynağa bağlı. Kaynaktan uzun yaşayamaz |
| İmzalar | Basit, `<'a>` yok | `<'a>` her kullanan tipe ve fonksiyona bulaşır |
| Tipik kullanım | Uygulama verisi, uzun yaşayan modeller | Kısa ömürlü "görünümler": ayrıştırıcılar, token'lar, arama sonuçları |

Pratik kural: **Sahipli başla.** Profil ölçümü ya da tasarım gerçekten gerektirdiğinde ödünç alan bir
tipe geç. Ödünç alan tipler, verinin zaten bir yerde (bir dosya içeriğinde, bir istek gövdesinde)
durduğu ve sen onun **parçalarına bakmak** istediğin durumlarda parlar.

Başka diller bu konuda ne yapıyor?

- **C++17**'deki `std::string_view` tam olarak `&str`'nin karşılığı. Ama C++ derleyicisi yaşam süresini
  kontrol etmez: Kaynak `std::string` ölünce `string_view` **sessizce sarkar**. Bu, modern C++'ın
  bilinen tuzaklarından biridir. Rust'ta aynı hata E0597 olarak derleme zamanında yakalanır.
- **Java**'da eski sürümler `substring()` ile orijinal karakter dizisini paylaşırdı. Küçük bir alt metin,
  devasa bir orijinali bellekte tutabiliyordu (sızıntıya benzer). Java 7'den beri `substring` kopyalıyor.
  Yani hız yerine güvenliği seçmek zorunda kaldılar. Rust'ta ikisini birden alırsın: Kopya yok **ve**
  yaşam süresi derleyicinin kontrolünde.

```quiz
question: Aşağıdaki senaryolardan hangisinde **ödünç alan** (`&'a str` alanlı) bir struct en uygun seçimdir?
options:
  - "Bir oyunda, oyun boyunca yaşayan ve kaydedilip yüklenen `Oyuncu` profili"
  - "Bellekte duran bir CSV dosyasının satırlarını alanlarına bölen ve her alanı hemen işleyen bir ayrıştırıcı"
  - "Bir fonksiyonun içinde oluşturulup başka bir thread'e gönderilecek bir mesaj"
  - "Kullanıcının klavyeden girdiği, programın sonuna kadar saklanacak notlar"
answer: 1
explanation: |
  Ödünç alan tipler, verinin **zaten bir yerde durduğu** ve senin onun parçalarına kısa süre baktığın
  durumlarda en iyisidir. CSV içeriği bellekte duruyor ve alanlar o içeriğin dilimleri olabilir. Diğer
  senaryolarda veri uzun yaşıyor, başka yere taşınıyor ya da kaynağı kısa ömürlü. Oralarda sahipli
  (`String`) alanlar hem daha basit hem de daha doğru.
feedback:
  - "Uzun yaşayan, kaydedilen bir model kendi verisine sahip olmalı: `String` alanlar."
  - "Doğru! Kaynak bellekte duruyor ve parçalara bakıp geçiyorsun: kopyasız ayrıştırma."
  - "Başka bir thread'e giden veri, kaynağından bağımsız olmalı (bunu Modül 18'de göreceğiz): sahipli."
  - "Klavye girdisi bir tampona okunur ve tampon yeniden kullanılır. Saklayacaksan sahipliğini al."
```

## Alıştırma: log satırı ayrıştırıcı

```exercise
id: m12-e-log-kaydi
title: Sunucu log'larını ayrıştır
difficulty: 3
prompt: |
  Bir sunucu, log satırlarını `"[HATA] Veritabanına bağlanılamadı"` biçiminde yazıyor. Satırları
  **kopyalamadan** ayrıştıran bir `LogKaydi<'a>` tipi yazacaksın. Struct tanımı hazır. `impl` bloğunu tamamla:

  1. `ayristir(satir)`: Satırın kenar boşluklarını at. Satır `[` ile başlamıyorsa ya da içinde `]` yoksa
     `None` döndür. Köşeli parantezin içi `seviye`, `]`'den sonrası `mesaj` olsun. İkisinin de kenar
     boşlukları atılmalı. Seviye boşsa (`"[] ..."`) yine `None`.
  2. `onemli_mi()`: Seviye `"HATA"` ya da `"KRİTİK"` ise `true`.
  3. `mesaj()`: Mesajı döndürür. **Dikkat:** Başlangıçtaki imza sonucu `&self`'e bağlıyor. Ama testlerden
     biri, kayıt nesnesi öldükten sonra mesajı kullanıyor. Bu imzayı gerektiği gibi değiştir.
starter: |
  #[derive(Debug, PartialEq)]
  struct LogKaydi<'a> {
      seviye: &'a str,
      mesaj: &'a str,
  }

  impl<'a> LogKaydi<'a> {
      fn ayristir(satir: &'a str) -> Option<LogKaydi<'a>> {
          todo!()
      }

      fn onemli_mi(&self) -> bool {
          todo!()
      }

      fn mesaj(&self) -> &str {
          todo!()
      }
  }

  fn main() {
      let log = String::from("[HATA] Veritabanına bağlanılamadı");
      if let Some(kayit) = LogKaydi::ayristir(&log) {
          println!("{kayit:?} önemli mi? {}", kayit.onemli_mi());
      }
  }
solution: |
  #[derive(Debug, PartialEq)]
  struct LogKaydi<'a> {
      seviye: &'a str,
      mesaj: &'a str,
  }

  impl<'a> LogKaydi<'a> {
      fn ayristir(satir: &'a str) -> Option<LogKaydi<'a>> {
          let satir = satir.trim();
          if !satir.starts_with('[') {
              return None;
          }
          let (seviye, mesaj) = satir[1..].split_once(']')?;
          let seviye = seviye.trim();
          if seviye.is_empty() {
              return None;
          }
          Some(LogKaydi { seviye, mesaj: mesaj.trim() })
      }

      fn onemli_mi(&self) -> bool {
          self.seviye == "HATA" || self.seviye == "KRİTİK"
      }

      fn mesaj(&self) -> &'a str {
          self.mesaj
      }
  }

  fn main() {
      let log = String::from("[HATA] Veritabanına bağlanılamadı");
      if let Some(kayit) = LogKaydi::ayristir(&log) {
          println!("{kayit:?} önemli mi? {}", kayit.onemli_mi());
      }
  }
check: tests
tests: |
  #[test]
  fn duzgun_satiri_ayristirir() {
      let k = LogKaydi::ayristir("[HATA] Disk dolu");
      assert_eq!(k, Some(LogKaydi { seviye: "HATA", mesaj: "Disk dolu" }));
  }

  #[test]
  fn bosluklari_temizler() {
      let k = LogKaydi::ayristir("   [ UYARI ]   Bellek %85   ");
      assert_eq!(k, Some(LogKaydi { seviye: "UYARI", mesaj: "Bellek %85" }), "seviye ve mesajın kenar boşlukları atılmalı");
  }

  #[test]
  fn gecersiz_satirlar_none() {
      assert_eq!(LogKaydi::ayristir("HATA Disk dolu"), None, "'[' ile başlamayan satır geçersiz");
      assert_eq!(LogKaydi::ayristir("[HATA Disk dolu"), None, "']' olmayan satır geçersiz");
      assert_eq!(LogKaydi::ayristir("[] boş seviye"), None, "seviyesi boş satır geçersiz");
      assert_eq!(LogKaydi::ayristir(""), None, "boş satır geçersiz");
  }

  #[test]
  fn onem_derecesi() {
      assert!(LogKaydi::ayristir("[KRİTİK] Sunucu çöktü").unwrap().onemli_mi(), "KRİTİK önemlidir");
      assert!(LogKaydi::ayristir("[HATA] x").unwrap().onemli_mi(), "HATA önemlidir");
      assert!(!LogKaydi::ayristir("[BİLGİ] Kullanıcı girdi").unwrap().onemli_mi(), "BİLGİ önemli değildir");
  }

  #[test]
  fn mesaj_kayittan_uzun_yasar() {
      let satir = String::from("[UYARI] Disk %90 dolu");
      let mesaj;
      {
          let kayit = LogKaydi::ayristir(&satir).unwrap();
          mesaj = kayit.mesaj();
      }
      assert_eq!(mesaj, "Disk %90 dolu", "mesaj, kayıt nesnesine değil log satırına bağlı olmalı");
  }
hints:
  - "`ayristir`'de önce `let satir = satir.trim();` ile başla. `trim` aynı yaşam süreli bir dilim döndürür. Sonra `starts_with('[')` kontrolü yap."
  - "`[` tek bayttır, bu yüzden `satir[1..]` güvenle ilk karakteri atlar. `satir[1..].split_once(']')?` sana `(seviye, mesaj)` verir. `?` `None`'ı hemen döndürür."
  - "`mesaj_kayittan_uzun_yasar` testi derlenmiyorsa imzayı `fn mesaj(&self) -> &'a str` yap. Sonuç, kaydın kendisine değil satırın ödüncüne (`'a`) bağlanır."
explanation: |
  `ayristir`, satırı hiç kopyalamadan ikiye bölüyor. `seviye` ve `mesaj`, log satırının içindeki iki
  bölgeye bakan dilimler. Bin satırlık bir log dosyası için bu, bin kez `String` ayırmamak demek.

  `fn ayristir(satir: &'a str) -> Option<LogKaydi<'a>>` imzasında `'a`, `impl<'a>` satırından geliyor.
  "Bana `'a` boyunca yaşayan bir satır ver, sana o satıra bağlı bir `LogKaydi<'a>` vereyim." Dönüş tipini
  `Option<Self>` diye de yazabilirdin. `Self`, `impl` bloğunda `LogKaydi<'a>` demektir.

  `mesaj` için `&'a str` seçmek, alanın kendisi zaten bir `&'a str` olduğu için doğal. Sonuç **satıra**
  bağlanıyor ve kayıt nesnesi ölse bile yaşıyor. `&self`'e bağlı imza da güvenliydi ama gereğinden dardı.
  Bir önceki dersteki "imza çağıranı gereksiz kısıtlamasın" ilkesinin struct'lardaki karşılığı bu.
```

## Özet

:::remember
- Referans alanı olan her struct yaşam süresi parametresi ister: `struct Alinti<'a> { parca: &'a str }`. Struct tanımında elision yoktur.
- Anlamı: Hiçbir `Alinti<'a>` örneği, baktığı veriden (`'a`) uzun yaşayamaz. Veri, struct yaşarken taşınamaz da (E0597, E0505).
- Metotlar için `impl<'a> Alinti<'a>`. İlk `'a` tanımlar, ikincisi kullanır.
- Alan döndüren metotta: `-> &str` sonucu `self`'e bağlar, `-> &'a str` orijinal veriye. Referans alanı döndürüyorsan `&'a` daha esnektir.
- Yaşam süresi bulaşıcıdır: Ödünç alan bir tipi içeren tip de `<'a>` taşır.
- Varsayılan seçim **sahipli** alanlar. Ödünç alan struct'lar kısa ömürlü, kopyasız görünümler içindir.
:::

```reflect
prompt: |
  Bir arkadaşın, okuduğu her JSON belgesini `struct Belge<'a> { alanlar: Vec<&'a str> }` biçiminde tutup
  uygulama boyunca saklamak istiyor. Ona bu tasarımın avantajını ve karşılaşacağı sorunu anlat. Hangi
  durumda `String` alanlara geçmesini önerirsin?
answer: |
  Model cevap: Avantajı, belge okunurken hiçbir alanın kopyalanmaması: Ayrıştırma hızlı olur, bellek
  ayırma az olur. Sorun ise her `Belge`'nin, okunduğu metin tamponundan uzun yaşayamaması. Belgeleri
  uygulama boyunca saklamak istiyorsa ham metinleri de bir yerde, en az belgeler kadar uzun yaşatmak
  zorunda. Ayrıca `<'a>` parametresi `Belge`'yi kullanan her tipe ve fonksiyona bulaşır. Belgeler uzun
  süre saklanacak, başka yerlere taşınacak ya da kaynak tampon yeniden kullanılacaksa `String` alanlara
  geçmesini öneririm. Ödünç alan tasarım, okuyup hemen işleyip bıraktığı durumlar için idealdir.
```

```flashcards
- front: "Bir struct'a `&str` alanı koymak için ne yazmak gerekir?"
  back: "Yaşam süresi parametresi: `struct Alinti<'a> { parca: &'a str }`. Struct tanımlarında elision yoktur, bu yüzden yazmazsan E0106 alırsın."
- front: "`struct Alinti<'a>` tanımı hangi kuralı ifade eder?"
  back: "Hiçbir `Alinti` örneği, ödünç aldığı veriden (`'a`) uzun yaşayamaz."
- front: "Referans tutan bir struct'a metot eklerken `impl` satırı nasıl yazılır?"
  back: "`impl<'a> Alinti<'a> { ... }`. İlk `'a` parametreyi tanımlar, ikincisi kullanır."
- front: "`fn parca(&self) -> &str` ile `fn parca(&self) -> &'a str` arasındaki fark nedir?"
  back: "İlki sonucu struct örneğinin (`self`) ödüncüne bağlar. İkincisi struct'ın baktığı orijinal veriye bağlar, yani sonuç struct öldükten sonra da kullanılabilir."
- front: Bir struct ödünç alan başka bir struct'ı alan olarak içeriyorsa ne olur?
  back: "Dıştaki struct da yaşam süresi parametresi almak zorundadır: `struct Rapor<'a> { alintilar: Vec<Alinti<'a>> }`. Yaşam süresi bulaşıcıdır."
- front: "Ödünç alan (`&'a str`) struct'lar hangi durumda en uygundur?"
  back: "Veri zaten bellekte durduğunda ve kısa süreli, kopyasız görünümler gerektiğinde (ayrıştırıcılar, token'lar). Uzun yaşayan veriler için sahipli alanlar."
- front: "C++'taki `std::string_view` ile Rust'taki `&str` arasındaki temel fark nedir?"
  back: "İkisi de kopyasız bir görünümdür. Ama C++ yaşam süresini kontrol etmez ve `string_view` sessizce sarkabilir. Rust bunu derleme zamanında reddeder."
```
