---
id: m10-l06
title: "panic mi, Result mı?"
minutes: 17
type: lesson
objectives:
  - "Bir başarısızlık durumu için `panic!` ile `Result` arasında gerekçesiyle seçim yapabilmek"
  - Fonksiyon sözleşmelerini ve değişmezleri (invariants) tanıyıp ihlal edildiklerinde neden panik atılabileceğini açıklayabilmek
  - Geçersiz değerlerin hiç oluşamayacağı, `new` fonksiyonu `Result` döndüren doğrulanmış tipler tasarlayabilmek
  - "`unwrap`/`expect` kullanımının ne zaman güvenli olduğunu söyleyebilmek ve gerektiğinde kodu yeniden yapılandırabilmek"
keywords: [panic, Result, sözleşme, değişmez, invariant, doğrulama, newtype, expect, karar listesi]
---

Artık iki aracın var: programı durduran `panic!` ve hatayı değer olarak çağırana veren `Result`. Bu modülün son
dersindeki soru belki de en önemlisi: **hangisini, ne zaman?** Yanlış seçimin iki yüzü var. Gereksiz yere
panik atan bir kütüphane, onu kullanan bütün programları çökertebilir. Her şey için `Result` döndüren bir kod
ise hiç olmaması gereken "imkânsız" durumlarla uğraşmaktan asıl işini yapamaz hâle gelir.

Bu derste ezber bir kural değil, bir **düşünme biçimi** kazanacaksın. Dersin sonunda her yeni durumda
kullanabileceğin kısa bir karar listen olacak.

## Kimin hatası?

Önce sezgilerini yokla. Aşağıdaki durumlardan hangilerinde panik atmak doğru bir seçimdir?

```quiz
question: "Hangi durumlarda `panic!` (ya da `unwrap`/`expect`) **uygun** bir seçimdir? Birden fazla seçenek doğru olabilir."
options:
  - "Bir hava durumu uygulaması, sunucudan gelen JSON'da sıcaklık alanını bulamadı"
  - "Bir sıralama fonksiyonu kendi işini bitirdikten sonra listenin sıralı olmadığını fark etti"
  - "Bir sınav programında öğrenci, cevap alanına sayı yerine harf yazdı"
  - "Bir fonksiyon, programcının kodda sabit olarak yazdığı `\"8080\"` metnini sayıya çeviriyor"
answer: [1, 3]
explanation: |
  Ayırt edici soru şu: **bu başarısızlık, kod kusursuz olsa bile yaşanabilir mi?** Sunucular eksik veri
  gönderebilir, öğrenciler harf yazabilir. Bunlar dış dünyanın doğasıdır ve `Result` ile ele alınır. Sıralama
  sonrası bozuk liste ise ancak sıralama kodunda bir **bug** varsa oluşur. Sabit `"8080"` metninin sayıya
  çevrilememesi de ancak programcı sabiti yanlış yazarsa olur. Bu iki durumda devam etmek anlamsızdır; panik,
  hatayı hemen görünür kılar.
feedback:
  - "Ağdan gelen veri senin kontrolünde değil; sunucu değişebilir ya da hata verebilir. Bu beklenen bir durumdur: `Result`."
  - "Doğru: bu bir iç tutarsızlık (bug). Bozuk bir sonuçla devam etmek yanlış çıktılar üretir."
  - "Kullanıcı girdisi her şey olabilir. Program yeniden sormalı ya da uyarı göstermeli: `Result`."
  - "Doğru: metin kodda sabit. Başarısız olması ancak programcının yazım hatasıyla mümkün; `expect` ile bu varsayımı belgele."
```

Birinci derste hataları ikiye ayırmıştık: beklenen başarısızlıklar ve programlama hataları (bug). Bu ayrımı
işlevsel bir soruya çevirmek için **"kimin hatası?"** diye sor:

| Başarısızlığın kaynağı | Örnek | Doğru araç |
|---|---|---|
| **Dış dünya**: kullanıcı, dosya, ağ, saat | yanlış biçimli girdi, silinmiş dosya, kopan bağlantı | `Result`: kod doğru olsa bile olur |
| **Çağıranın hatası**: fonksiyonun sözleşmesi bozuldu | `v[10]` (uzunluk 3), sıfır sayfa boyutu | `panic!`: çağıran kod düzeltilmeli |
| **Kendi hatan**: "imkânsız" bir durum oluştu | sıralanmış listenin sırasız çıkması | `panic!` / `unreachable!`: bu kod düzeltilmeli |

Bir ölçüt daha: **çağıran bu durumdan anlamlı biçimde kurtulabilir mi?** Kullanıcıya "yaşı tekrar gir"
diyebilirsin; kurtulmak mümkündür, öyleyse `Result`. Bozuk bir sıralama sonucundan ise hiçbir çağıran
kurtulamaz. Doğru davranış, durup sesini yükseltmektir.

## Örnekler, prototipler, testler ve kütüphaneler

Aynı kod satırı, nerede yazıldığına göre farklı değerlendirilir.

**Örnek kodlar ve dokümantasyon.** Bir kavramı anlatırken her satıra hata işleme eklemek asıl fikri gölgeler.
`unwrap`, "burada hata işleme var, ama konumuz o değil" demenin kısa yoludur. Bu uygulamadaki örneklerin bir
kısmı da bu yüzden `unwrap` kullanıyordu.

**Prototipler.** Fikrin işe yarayıp yaramadığını görmeye çalışırken `unwrap` ve `expect` birer **yer
imidir**. İş ciddileştiğinde kodda `unwrap` diye arar, her birini bilinçli bir hata işlemeye çevirirsin:

```rust
use std::num::ParseIntError;

// Prototip: hızlı yazıldı, "21 yaş" gibi bir girdide panikler.
fn yas_prototip(girdi: &str) -> u8 {
    girdi.trim().parse().unwrap()
}

// Üretim: aynı iş, ama karar çağıranda.
fn yas_oku(girdi: &str) -> Result<u8, ParseIntError> {
    girdi.trim().parse()
}

fn main() {
    println!("{}", yas_prototip(" 21 "));
    match yas_oku("21 yaş") {
        Ok(yas) => println!("Yaş: {yas}"),
        Err(hata) => println!("Yaş okunamadı ({hata}), lütfen yalnızca sayı girin."),
    }
}
```

**Testler.** Testte bir `unwrap` paniklerse test **başarısız** olur, ki istediğin tam olarak budur. Bu yüzden
testlerde `unwrap` ve `expect` gönül rahatlığıyla kullanılır (Modül 13'te testleri ayrıntılı göreceğiz).

**Kütüphaneler.** Bir kütüphane yazarken çağıranın bağlamını **bilemezsin**: kodun bir terminal aracında mı,
bir web sunucusunda mı, bir uçağın yazılımında mı çalışacak? Kötü bir girdide panik atmak, kararı onların
elinden alır. Bir web sunucusunda tek bir hatalı isteğin bütün sunucuyu düşürmesi kabul edilemez. Kural: bir
kütüphane, **girdiden** kaynaklanan başarısızlıklar için `Result` döndürür.

Standart kütüphanenin kendisi bu dengeyi iki ayrı kapıyla kurar: panik atan ve atmayan kardeşler.

| Panik atan (sözleşme: "doğru kullanacağım") | Panik atmayan (sözleşme yok) |
|---|---|
| `v[i]` | `v.get(i)` → `Option` |
| `a + b` (debug'da taşma) | `a.checked_add(b)` → `Option` |
| `x.unwrap()` | `match`, `?`, `unwrap_or` |

Dizini kendisi hesaplayan ve geçerli olduğundan emin olan kod `v[i]`'yi kullanır. Dizini kullanıcıdan alan kod
ise `get`'i. Kendi API'lerini tasarlarken de aynı soruyu sor: çağıranın bu değeri yanlış vermesi bir bug mı,
yoksa beklenen bir durum mu?

:::tip Clippy ile `unwrap` avı
Modül 1'de tanıştığın Clippy'nin `unwrap_used` ve `expect_used` adlı iki isteğe bağlı kuralı var. Kodda her
`unwrap` için uyarı verirler: `cargo clippy -- -W clippy::unwrap_used`. Bir prototipi üretime hazırlarken
bütün "yer imlerini" bulmanın hızlı bir yolu.
:::

```quiz
question: "Bir tarih kütüphanesi yazıyorsun. `tarih_coz(\"2024-13-45\")` çağrısı (13. ay yok) ne yapmalı?"
options:
  - "Panik atmalı: geçersiz tarih bir hatadır"
  - "`Result<Tarih, TarihHatasi>` döndürüp `Err(TarihHatasi::GecersizAy(13))` vermeli"
  - "Hatayı sessizce düzeltip en yakın geçerli tarihi (`2024-12-31`) döndürmeli"
  - "`Tarih` döndürüp hatayı `eprintln!` ile stderr'e yazmalı"
answer: 1
explanation: |
  Metin büyük olasılıkla kullanıcıdan, bir dosyadan ya da ağdan geliyor: geçersiz olması **beklenen** bir
  durum. Kütüphane, çağıranın bağlamını bilmediği için kararı ona bırakmalı. Kullanıcıya bir uyarı mı
  gösterilecek, kayıt mı atlanacak? Veri taşıyan bir hata varyantı (`GecersizAy(13)`) çağırana neyin yanlış
  olduğunu da söyler.
feedback:
  - "Kütüphanenin her geçersiz girdide paniklemesi, onu kullanan web sunucusunu tek bir hatalı istekle düşürebilir."
  - Doğru! Kütüphane girdiden kaynaklanan hataları bildirir, kararı çağırana bırakır.
  - "Sessiz düzeltme hatayı gizler: kullanıcı yanlış bir tarihle işlem yaptığını hiç fark etmez."
  - "Çağıran hatayı programın içinden göremez; yalnızca terminale bir satır düşer ve program yanlış veriyle devam eder."
```

## Sözleşmeler ve değişmezler

Bir fonksiyonun **sözleşmesi (contract)**, çağıranın uyması gereken önkoşullardır: "bana boş olmayan bir dilim
ver", "sayfa boyutu sıfır olmasın". Sözleşmeyi bozan çağıranın kodudur, yani bir bug söz konusudur. Böyle bir
durumda panik atmak doğrudur, ama koşul fonksiyonun belgelerinde **açıkça yazılmalıdır**. Standart
kütüphanedeki `v.chunks(0)` çağrısı bu yüzden `chunk size must be non-zero` mesajıyla panikler.

Birinci dersin tablosundaki `assert!`, sözleşmeyi fonksiyonun en başında denetlemenin kısa yoludur. İkinci
argüman olarak bir mesaj da alabilir: `assert!(kosul, "mesaj")`. Koşul `false` ise bu mesajla panikler:

```rust,should_panic
/// Kaç sayfa gerektiğini hesaplar.
/// Sözleşme: `sayfa_boyutu` sıfır olmamalı. Bunu çağıran kod garanti eder.
fn sayfa_sayisi(oge_sayisi: usize, sayfa_boyutu: usize) -> usize {
    assert!(sayfa_boyutu > 0, "sayfa_boyutu sıfır olamaz");
    oge_sayisi.div_ceil(sayfa_boyutu) // yukarı yuvarlayarak böler
}

fn main() {
    const SAYFA_BOYUTU: usize = 20;
    println!("{} sayfa", sayfa_sayisi(45, SAYFA_BOYUTU));
    println!("{} sayfa", sayfa_sayisi(45, 0)); // bug: sözleşme bozuldu
}
```

Burada `sayfa_boyutu` kullanıcıdan gelmiyor, programcı tarafından seçilen bir yapılandırma değeri. Sıfır olması
ancak bir yazım hatasıyla mümkün. Kullanıcının ayarlayabildiği bir değer olsaydı, aynı fonksiyon `Result`
döndürmeliydi. **Değerin nereden geldiği** kararı değiştirir.

**Değişmez (invariant)** ise bir veri yapısının her zaman doğru olması gereken iç kuralıdır. Örneğin bir
`Sepet`'in `toplam` alanı her zaman ürün fiyatlarının toplamına eşit olmalı. Bir metot bu kuralın bozulduğunu
fark ederse, bir yerde bir bug var demektir. Bozuk veriyle devam etmek (yanlış faturalar kesmek), durmaktan çok
daha zararlıdır.

:::analogy Fabrika ayarlarıyla gelen cihaz
Bir çamaşır makinesinin kılavuzunda "yalnızca 220 V prize takın" yazar. 380 V'a takarsan makine
yanar, ama bu makinenin değil, kılavuzu okumayanın hatasıdır: **sözleşme** bozulmuştur. Makinenin içindeki
emniyet sigortası ise bir **değişmezi** korur: iç devrede akım tehlikeli seviyeye çıkarsa, devam etmek yerine
makineyi anında durdurur. İkisi de "kurtarma" değil "durdurma" mekanizmasıdır. Musluktan su gelmemesi
ise beklenen bir durumdur: makine yanmaz, ekranda bir hata kodu gösterip bekler. Bu da `Result`'tır.
:::

:::deep `debug_assert!` ve belgelemek
`assert!` her derlemede çalışır. Pahalı bir denetimi (bütün listenin sıralı olduğunu kontrol etmek gibi) yalnızca
geliştirme sırasında yapmak istersen `debug_assert!` kullanılır: `--release` derlemesinde tamamen kaldırılır.
Panik atabilen bir fonksiyonun belgelerine (`///`) `# Panics` başlıklı bir bölüm eklemek de bir Rust
geleneğidir. Standart kütüphanenin belgeleri bu bölümlerle doludur. Belge yorumlarını Modül 13'te
göreceğiz.
:::

## Geçerliliği tipe gömmek

Bir spor kulübünün yazılımında yaşla ilgili onlarca fonksiyon olduğunu düşün: `ehliyet_alabilir_mi`,
`ogrenci_indirimi`, `emeklilik_yili`... Hepsi `yas: u8` alırsa, her biri `yas > 150` gibi saçma değerleri
**yeniden** kontrol etmek zorundadır. Biri unutursa hata sessizce içeri sızar.

Daha iyi bir yol: kontrolü **bir kez**, değer oluşturulurken yap ve sonucu bir **tipe** göm. Modül 6'daki
newtype fikri ile Modül 8'deki gizlilik kurallarını birleştiriyoruz:

```rust
mod kulup {
    #[derive(Debug)]
    pub struct Yas(u8); // alan gizli: Yas'ı modül dışından yalnızca new() oluşturabilir

    impl Yas {
        pub fn new(deger: u8) -> Result<Yas, String> {
            if deger > 130 {
                return Err(format!("{deger} geçerli bir yaş değil"));
            }
            Ok(Yas(deger))
        }

        pub fn deger(&self) -> u8 {
            self.0
        }
    }

    // Artık hiçbir fonksiyonun yaşı yeniden denetlemesi gerekmiyor:
    pub fn ehliyet_alabilir_mi(yas: &Yas) -> bool {
        yas.deger() >= 18
    }
}

use kulup::{Yas, ehliyet_alabilir_mi};

fn main() {
    for girdi in [17, 34, 200] {
        match Yas::new(girdi) {
            Ok(yas) => println!("{}: ehliyet {}", yas.deger(), ehliyet_alabilir_mi(&yas)),
            Err(hata) => println!("Hata: {hata}"),
        }
    }
}
```

`ehliyet_alabilir_mi`'nin imzası artık bir garanti taşıyor: elinde bir `Yas` varsa, o yaş **mutlaka**
doğrulanmıştır. Geçersiz bir yaş, programın hiçbir yerinde var olamaz. Bu yaklaşıma Rust topluluğunda sık sık
**"doğrulamakla yetinme, ayrıştır" (parse, don't validate)** denir: ham veriyi bir kez ayrıştırıp doğrulanmış bir tipe
çevir, sonra hep o tiple çalış.

Aslında bu fikri en başından beri kullanıyorsun: `u8` negatif olamaz, `char` geçersiz bir Unicode değeri
taşıyamaz. Kendi tiplerinle bu garantileri kendi alanına (yaş, e-posta, IBAN...) taşıyorsun.

:::analogy Havalimanı güvenlik kontrolü
Havalimanında güvenlik kontrolünden **bir kez** geçersin. Kapıların olduğu bölgede kimse çantanı yeniden
aramaz, çünkü oradaki herkesin kontrolden geçmiş olduğu **bilinir**. Bölgeye kontrolsüz girmenin bir yolu
yoktur. `Yas::new` güvenlik kontrolüdür, gizli alan ise kontrolsüz girişi kapatan duvar. İçeride (`Yas` alan
fonksiyonlarda) kimse yeniden denetim yapmaz.
:::

Duvar gerçekten sağlam mı? Modül 8'deki gizlilik kurallarını hatırlayarak tahmin et:

```compiles
code: |
  mod kulup {
      pub struct Yas(u8);

      impl Yas {
          pub fn new(deger: u8) -> Result<Yas, String> {
              if deger > 130 {
                  return Err(format!("{deger} geçerli bir yaş değil"));
              }
              Ok(Yas(deger))
          }

          pub fn deger(&self) -> u8 {
              self.0
          }
      }
  }

  fn main() {
      let yas = kulup::Yas(200); // kontrolü atlamaya çalışıyoruz
      println!("{}", yas.deger());
  }
answer: false
error: E0603
explanation: |
  Derlenmez: **E0603**, Modül 8'deki "gizli öğe" hatası. `Yas`'ın kendisi `pub`, ama içindeki `u8` alanı gizli.
  Bir tuple struct'ın `Yas(200)` biçimindeki kurucusu, alanlarından biri bile gizliyse modül dışına kapalıdır.
  Tek kapı `Yas::new`'dur ve o da kontrolü yapar. `pub struct Yas(pub u8);` yazsaydık duvar yıkılırdı.
```

:::error Derleyici hatası
```text
error[E0603]: tuple struct constructor `Yas` is private
  --> src/main.rs:19:22
   |
 2 |     pub struct Yas(u8);
   |                    -- a constructor is private if any of the fields is private
...
19 |     let yas = kulup::Yas(200); // kontrolü atlamaya çalışıyoruz
   |                      ^^^ private tuple struct constructor
   |
note: the tuple struct constructor `Yas` is defined here
  --> src/main.rs:2:5
   |
 2 |     pub struct Yas(u8);
   |     ^^^^^^^^^^^^^^^^^^^
help: consider making the field publicly accessible
   |
 2 |     pub struct Yas(pub u8);
   |                    +++
```
Etiket nedeni tek cümlede söylüyor: *a constructor is private if any of the fields is private*. (`Yas`'ı `use` ile
içeri alıp doğrudan `Yas(200)` yazsaydın, aynı nedeni anlatan **E0423** hatasını görürdün.)

`help` satırı "alanı `pub` yap" diyor ve teknik olarak haklı, ama bu tasarımda yapmak istediğimizin tam tersi.
Derleyicinin önerileri her zaman **derlenen** bir çözüm önerir; **doğru** çözümü sen seçersin.
:::

```fill
prompt: |
  Bir e-ticaret sitesindeki indirim oranı 0 ile 100 arasında olmalı. Boşlukları doldurarak `Yuzde` tipini
  tamamla. `indirim_uygula` hiçbir denetim yapmadan çalışabilsin, çünkü parametresinin tipi zaten geçerliliği
  garanti etsin.
code: |
  mod magaza {
      pub struct Yuzde(u8);

      impl Yuzde {
          pub fn new(deger: u8) -> ___0<Yuzde, String> {
              if deger > 100 {
                  return Err(format!("%{deger} geçerli bir oran değil"));
              }
              ___1(Yuzde(deger))
          }
      }

      pub fn indirim_uygula(fiyat: u32, oran: &___2) -> u32 {
          fiyat - fiyat * oran.0 as u32 / 100
      }
  }

  use magaza::{Yuzde, indirim_uygula};

  fn main() {
      match Yuzde::new(25) {
          Ok(oran) => println!("{} TL", indirim_uygula(400, &oran)),
          Err(hata) => println!("{hata}"),
      }
      if let Err(hata) = Yuzde::new(150) {
          println!("{hata}");
      }
  }
blanks:
  - ["Result"]
  - ["Ok"]
  - ["Yuzde", "self::Yuzde", "crate::magaza::Yuzde", "super::magaza::Yuzde"]
output: |
  300 TL
  %150 geçerli bir oran değil
explanation: |
  `new` doğrulamayı yapıp `Result<Yuzde, String>` döndürüyor. Geçerli değer `Ok(...)` ile sarılır.
  `indirim_uygula` bir `&Yuzde` aldığı için `oran.0 > 100` olamaz, dolayısıyla `fiyat * oran / 100` hiçbir
  zaman `fiyat`'ı aşamaz ve çıkarma taşma yapamaz. (Çarpma ise çok büyük fiyatlarda `u32`'yi yine
  taşırabilir, örneğin oran %100 iken yaklaşık 43 milyonun üstünde; tip yalnızca oranın geçerliliğini garanti eder.) `oran.0`'a erişebiliyoruz, çünkü
  `indirim_uygula` da `magaza` modülünün içinde: gizlilik modül sınırında başlar (Modül 8). Üçüncü boşluğa
  `magaza::Yuzde` yazamazsın: modülün **içinden** bakınca yol `self::Yuzde` ya da `crate::magaza::Yuzde`'dir.
```

## expect: derleyiciden fazlasını bildiğinde

Bazen **sen**, derleyicinin bilemeyeceği bir şeyi bilirsin. Kodda sabit yazılmış bir metni sayıya çevirmek ya
da az önce denetlediğin bir koşula güvenmek gibi. Bu durumlarda `expect`, kodun yaptığı varsayımı yazılı hâle
getirir:

```rust
fn rakamlar_toplami(metin: &str) -> u32 {
    let mut toplam = 0;
    for c in metin.chars() {
        if c.is_ascii_digit() {
            // to_digit(10), c bir rakam değilse None döndürür; is_ascii_digit bunu az önce dışladı.
            toplam += c.to_digit(10).expect("is_ascii_digit ile rakam olduğu doğrulandı");
        }
    }
    toplam
}

fn main() {
    let varsayilan_port: u16 = "8080".parse().expect("\"8080\" sabiti geçerli bir u16 olmalı");
    println!("Port: {varsayilan_port}");
    println!("Toplam: {}", rakamlar_toplami("TR-34 ABC 1907"));
}
```

Ama önce şunu sor: **kodu, derleyicinin de bileceği biçimde yeniden yazabilir miyim?** Çoğu zaman cevap
evettir ve o zaman `expect`'e hiç gerek kalmaz:

```rust
fn main() {
    let notlar: Vec<u32> = vec![72, 95, 88];

    // Kırılgan: "boş değil" bilgisi yalnızca programcının kafasında.
    if !notlar.is_empty() {
        let en_yuksek = notlar.iter().max().expect("liste boş değil, az önce kontrol edildi");
        println!("En yüksek (expect): {en_yuksek}");
    }

    // Sağlam: kontrol ve değere erişim tek bir adımda; panik olasılığı yok.
    if let Some(en_yuksek) = notlar.iter().max() {
        println!("En yüksek (if let): {en_yuksek}");
    }
}
```

İlk biçimde, biri ileride `if` koşulunu değiştirirse `expect` sessizce bir bombaya dönüşebilir. İkincisinde
kontrol ile erişim aynı ifadededir. Derleyici, `en_yuksek`'e yalnızca değer **varken** ulaşabileceğini garanti
eder. Kural: **önce yeniden yapılandır, olmuyorsa `expect` yaz, `unwrap`'ı en sona bırak.** `expect`
mesajına da her zaman neden başarısız olamayacağını yaz (ikinci ders).

```quiz
question: "Aşağıdaki `unwrap` kullanımlarından hangileri **asla** panik atmaz? Birden fazla seçenek doğru olabilir."
options:
  - "`let port: u16 = \"8080\".parse().unwrap();`"
  - "`let yas: u8 = kullanici_girdisi.trim().parse().unwrap();`"
  - "`let mut v = Vec::new(); v.push(5); let son = v.last().unwrap();`"
  - "`let fiyat = fiyatlar.get(\"simit\").unwrap();` (`fiyatlar`, bir ayar dosyasından okunmuş bir `HashMap`)"
answer: [0, 2]
explanation: |
  Sabit `"8080"` her zaman geçerli bir `u16`'dır. `push`'tan hemen sonra vektör boş olamaz, yani `last()` her
  zaman `Some` döndürür (Modül 9). Kullanıcı girdisi ve dosyadan okunan veriler ise **dış dünyadır**:
  `"yirmi"` yazılabilir, ayar dosyasında `simit` anahtarı olmayabilir. Bu ikisinde `?`, `match` ya da bir
  varsayılan değer kullanılmalı.
feedback:
  - "Doğru: metin kodda sabit. Yine de `expect(\"...\")` ile varsayımı yazmak daha iyi bir alışkanlık."
  - "Kullanıcı her şeyi yazabilir; bu, programı çökertmenin en kolay yolu."
  - "Doğru: `push`'tan hemen sonra en az bir eleman var."
  - "Ayar dosyası programcının kontrolünde değil; kullanıcı onu düzenleyebilir ya da eski bir sürümü olabilir."
```

## Karar listesi

Bütün modülü tek bir listede toplayalım. Yeni bir başarısızlık durumuyla karşılaştığında soruları sırayla sor:

1. **Kod doğru olsa bile olabilir mi?** (kullanıcı girdisi, dosya, ağ, ayarlar) → `Result`. Hata türleri
   önemliyse kendi hata enum'un, değilse `String` ya da `Box<dyn Error>`.
2. **Yalnızca bir bug yüzünden mi olabilir?** (sözleşme ihlali, bozulan değişmez, "imkânsız" kol) →
   `panic!`, `assert!`, `unreachable!`. Mesaj programcıya yazılır.
3. **Geçersiz değer hiç oluşmasın mı istiyorsun?** → doğrulayan bir `new() -> Result<...>` ve gizli alanlı bir tip.
4. **Derleyicinin bilmediği bir şey mi biliyorsun?** → önce `if let`/`match`/`let else` ile yeniden yapılandır;
   olmuyorsa varsayımını anlatan bir `expect`.
5. **Örnek, prototip ya da test mi?** → `unwrap`/`expect` serbest; prototipteki her biri ileride düzeltilecek bir yer imidir.
6. **Kütüphane mi yazıyorsun?** → girdiden kaynaklanan hiçbir durumda panikleme; sözleşmeye bağlı panikleri belgele.

Son alıştırmada 3. maddeyi uygulayacaksın. Önce Modül 9'dan bir hatırlatma, çünkü alıştırmada işine yarayacak:

```predict
code: |
  fn main() {
      let ad = "ayşe";
      println!("{} {}", ad.len(), ad.chars().count());
      for (i, c) in "a1_".chars().enumerate() {
          println!("{i}: {c} {} {}", c.is_ascii_lowercase(), c.is_ascii_digit());
      }
  }
options:
  - |
    4 4
    0: a true false
    1: 1 false true
    2: _ false false
  - |
    5 4
    0: a true false
    1: 1 false true
    2: _ false false
  - |
    5 4
    1: a true false
    2: 1 false true
    3: _ false false
  - |
    5 5
    0: a true false
    1: 1 false true
    2: _ true false
answer: 1
explanation: |
  `len()` **bayt** sayısını verir: `ş` UTF-8'de 2 bayttır, yani `"ayşe"` 5 bayt ama 4 karakterdir. Kullanıcıya
  "en az 3 karakter" diyorsan `chars().count()` saymalısın (Modül 9). `enumerate()` sıra numarasını **0'dan**
  başlatır. `is_ascii_lowercase()` yalnızca `a`-`z` için, `is_ascii_digit()` yalnızca `0`-`9` için `true` döner;
  alt çizgi ikisine de girmez.
```

````exercise
id: m10-e-kullanici-adi
title: Doğrulanmış kullanıcı adı
difficulty: 3
prompt: |
  Bir oyun platformu için `KullaniciAdi` tipi yazıyorsun. Geçersiz bir kullanıcı adının programda **hiç var
  olamaması** için alan gizli; tek kapı `KullaniciAdi::new`. Kuralları **bu sırayla** denetle:

  1. Karakter sayısı (bayt değil!) 3'ten azsa → `CokKisa { uzunluk }`
  2. Karakter sayısı 12'den fazlaysa → `CokUzun { uzunluk }`
  3. İlk karakter `a`-`z` arası küçük bir harf değilse → `HarfleBaslamali`
  4. Karakterlerden biri küçük harf (`a`-`z`), rakam (`0`-`9`) ya da `_` değilse → `GecersizKarakter(c)`:
     soldan **ilk** geçersiz karakterle

  Her şey yolundaysa `Ok(KullaniciAdi(...))` döndür. `ş`, `ç` gibi Türkçe harfler ve büyük harfler geçersiz
  sayılır. Yardımcı metotlar: `c.is_ascii_lowercase()`, `c.is_ascii_digit()`.
starter: |
  mod platform {
      #[derive(Debug, PartialEq)]
      pub enum AdHatasi {
          CokKisa { uzunluk: usize },
          CokUzun { uzunluk: usize },
          HarfleBaslamali,
          GecersizKarakter(char),
      }

      #[derive(Debug, PartialEq)]
      pub struct KullaniciAdi(String);

      impl KullaniciAdi {
          pub fn new(ad: &str) -> Result<KullaniciAdi, AdHatasi> {
              todo!()
          }

          pub fn as_str(&self) -> &str {
              &self.0
          }
      }
  }

  use platform::{AdHatasi, KullaniciAdi};

  fn main() {
      for aday in ["elif_42", "al", "2pac", "ayşe", "Mehmet"] {
          match KullaniciAdi::new(aday) {
              Ok(ad) => println!("'{}' kabul edildi", ad.as_str()),
              Err(AdHatasi::CokKisa { uzunluk }) => println!("'{aday}': en az 3 karakter ({uzunluk} var)"),
              Err(AdHatasi::CokUzun { uzunluk }) => println!("'{aday}': en fazla 12 karakter ({uzunluk} var)"),
              Err(AdHatasi::HarfleBaslamali) => println!("'{aday}': küçük bir harfle başlamalı"),
              Err(AdHatasi::GecersizKarakter(c)) => println!("'{aday}': '{c}' kullanılamaz"),
          }
      }
  }
solution: |
  mod platform {
      #[derive(Debug, PartialEq)]
      pub enum AdHatasi {
          CokKisa { uzunluk: usize },
          CokUzun { uzunluk: usize },
          HarfleBaslamali,
          GecersizKarakter(char),
      }

      #[derive(Debug, PartialEq)]
      pub struct KullaniciAdi(String);

      impl KullaniciAdi {
          pub fn new(ad: &str) -> Result<KullaniciAdi, AdHatasi> {
              let uzunluk = ad.chars().count();
              if uzunluk < 3 {
                  return Err(AdHatasi::CokKisa { uzunluk });
              }
              if uzunluk > 12 {
                  return Err(AdHatasi::CokUzun { uzunluk });
              }
              for (i, c) in ad.chars().enumerate() {
                  if i == 0 && !c.is_ascii_lowercase() {
                      return Err(AdHatasi::HarfleBaslamali);
                  }
                  if !(c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
                      return Err(AdHatasi::GecersizKarakter(c));
                  }
              }
              Ok(KullaniciAdi(String::from(ad)))
          }

          pub fn as_str(&self) -> &str {
              &self.0
          }
      }
  }

  use platform::{AdHatasi, KullaniciAdi};

  fn main() {
      for aday in ["elif_42", "al", "2pac", "ayşe", "Mehmet"] {
          match KullaniciAdi::new(aday) {
              Ok(ad) => println!("'{}' kabul edildi", ad.as_str()),
              Err(AdHatasi::CokKisa { uzunluk }) => println!("'{aday}': en az 3 karakter ({uzunluk} var)"),
              Err(AdHatasi::CokUzun { uzunluk }) => println!("'{aday}': en fazla 12 karakter ({uzunluk} var)"),
              Err(AdHatasi::HarfleBaslamali) => println!("'{aday}': küçük bir harfle başlamalı"),
              Err(AdHatasi::GecersizKarakter(c)) => println!("'{aday}': '{c}' kullanılamaz"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn gecerli_adlar_kabul_edilir() {
      for ad in ["elif_42", "can", "x_y_z", "abcdefghijkl", "a12"] {
          let sonuc = KullaniciAdi::new(ad).expect("bu ad bütün kurallara uyuyor, kabul edilmeli");
          assert_eq!(sonuc.as_str(), ad, "kabul edilen ad değiştirilmeden saklanmalı");
      }
  }

  #[test]
  fn uzunluk_karakterle_sayilir() {
      assert_eq!(KullaniciAdi::new("al"), Err(AdHatasi::CokKisa { uzunluk: 2 }), "\"al\" 2 karakter");
      assert_eq!(KullaniciAdi::new(""), Err(AdHatasi::CokKisa { uzunluk: 0 }), "boş ad 0 karakter");
      assert_eq!(
          KullaniciAdi::new("şç"),
          Err(AdHatasi::CokKisa { uzunluk: 2 }),
          "\"şç\" 4 bayt ama 2 karakter: chars().count() kullan"
      );
      assert_eq!(
          KullaniciAdi::new("abcdefghijklm"),
          Err(AdHatasi::CokUzun { uzunluk: 13 }),
          "13 karakter, sınır 12"
      );
  }

  #[test]
  fn kucuk_harfle_baslamali() {
      assert_eq!(KullaniciAdi::new("2pac"), Err(AdHatasi::HarfleBaslamali), "rakamla başlıyor");
      assert_eq!(KullaniciAdi::new("_ali"), Err(AdHatasi::HarfleBaslamali), "alt çizgiyle başlıyor");
      assert_eq!(KullaniciAdi::new("Mehmet"), Err(AdHatasi::HarfleBaslamali), "büyük harfle başlıyor");
  }

  #[test]
  fn ilk_gecersiz_karakter_bildirilir() {
      assert_eq!(KullaniciAdi::new("ayşe"), Err(AdHatasi::GecersizKarakter('ş')), "'ş' ASCII değil");
      assert_eq!(KullaniciAdi::new("can-ali"), Err(AdHatasi::GecersizKarakter('-')), "'-' izinli değil");
      assert_eq!(
          KullaniciAdi::new("aB c"),
          Err(AdHatasi::GecersizKarakter('B')),
          "soldan ilk geçersiz karakter 'B' (boşluk ondan sonra)"
      );
  }

  #[test]
  fn kontrol_sirasi() {
      assert_eq!(
          KullaniciAdi::new("A!"),
          Err(AdHatasi::CokKisa { uzunluk: 2 }),
          "uzunluk, karakter kurallarından önce denetlenir"
      );
      assert_eq!(
          KullaniciAdi::new("9!!"),
          Err(AdHatasi::HarfleBaslamali),
          "ilk karakter kuralı, geçersiz karakter kuralından önce gelir"
      );
  }
hints:
  - "Önce `let uzunluk = ad.chars().count();` ile karakter sayısını bul ve iki uzunluk kuralını `return Err(...)` ile denetle. `ad.len()` bayt sayar; `ş` 2 bayttır."
  - "Karakterleri `for (i, c) in ad.chars().enumerate()` ile gez. `i == 0` iken `c.is_ascii_lowercase()` değilse `HarfleBaslamali` döndür."
  - |
    Döngünün içindeki ikinci denetim şöyle olabilir:
    ```rust
    if !(c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
        return Err(AdHatasi::GecersizKarakter(c));
    }
    ```
    Döngü bitince `Ok(KullaniciAdi(String::from(ad)))` döndür.
forbid:
  - pattern: "panic!|\\.unwrap\\(|\\.expect\\("
    message: "Kullanıcı adı dış dünyadan gelir: geçersiz ad bir bug değil, beklenen bir durum. `Err(...)` döndür."
  - pattern: "pub\\s+struct\\s+KullaniciAdi\\s*\\(\\s*pub"
    message: "Alanı `pub` yaparsan doğrulamasız `KullaniciAdi` oluşturulabilir; alan gizli kalmalı."
explanation: |
  `new` bütün kuralları tek bir yerde denetliyor; başarılı olursa dönen `KullaniciAdi`, geçerliliğin **kanıtı**
  oluyor. Programın geri kalanında `fn profil_olustur(ad: KullaniciAdi)` gibi bir fonksiyon hiçbir denetim
  yapmadan bu adın kurallara uyduğundan emin olabilir. Alan gizli olduğu için modül dışından
  `KullaniciAdi(String::from("Geçersiz Ad!"))` yazmanın yolu yok (E0423).

  Kuralların sırası da sözleşmenin bir parçası. `"A!"` hem kısa hem büyük harfle başlıyor; hangi hatanın
  döneceğini belgelediğin sıra belirliyor. Kullanıcıya önce en temel sorunu söylemek (uzunluk) genelde daha
  iyi bir deneyimdir.

  Neden panik değil? Kullanıcı adları bir kayıt formundan gelir: geçersiz olmaları **beklenen** bir durum ve
  form kullanıcıdan düzeltmesini isteyebilir. Verilerin taşındığı varyantlar (`CokKisa { uzunluk: 2 }`,
  `GecersizKarakter('ş')`) da formun "şu karakter kullanılamaz" gibi nokta atışı mesajlar göstermesini sağlar.
````

## Özet

:::remember
- Temel soru: **bu başarısızlık, kod doğru olsa bile yaşanabilir mi?** Evet → `Result`. Hayır, yalnızca bir bug
  yüzünden → `panic!`.
- Dış dünya (kullanıcı, dosya, ağ, ayarlar) → `Result`. Sözleşme ihlali ve bozulan değişmez → `panic!`/`assert!`.
- Kütüphaneler girdiden kaynaklanan durumlarda paniklemez; kararı çağırana bırakır. Std ikili kapı sunar: `v[i]` / `v.get(i)`.
- Örnek, prototip ve testlerde `unwrap`/`expect` serbesttir; prototipteki her `unwrap` bir yer imidir.
- Geçerliliği tipe göm: gizli alan + `new() -> Result<...>`. Geçersiz değer hiç oluşamaz (parse, don't validate).
- Derleyiciden fazlasını biliyorsan önce `if let`/`match` ile yeniden yapılandır, olmuyorsa gerekçeli bir `expect` yaz.
:::

```reflect
prompt: "Bir arkadaşın şöyle diyor: \"`Result` kullanmak her zaman daha güvenli; hiçbir zaman `panic!` kullanmamalıyız.\" Bu görüşe katılıyor musun? Bir sözleşme ihlali örneği üzerinden, panik atmak yerine `Result` döndürmenin neye mal olacağını açıkla."
answer: |
  Model cevap: Katılmıyorum. `sayfa_sayisi(oge_sayisi, sayfa_boyutu)` fonksiyonu sıfır sayfa boyutunda
  `Result` döndürseydi, bu sabiti koda yazan her çağıran "ya sıfırsa?" diye bir `match` yazmak zorunda kalırdı.
  Oysa o durum ancak bir bug ile oluşur ve çağıranın yapabileceği anlamlı bir kurtarma yoktur. Kod, hiç
  yaşanmayacak hataları ele alan dallarla dolar; daha kötüsü, biri o dalda `0` döndürürse bug **gizlenir** ve
  program yanlış sonuçlarla çalışmaya devam eder. Panik ise bug'ı hemen, kaynağına yakın bir yerde görünür
  kılar. `Result` beklenen başarısızlıklar içindir; her şeyi `Result` yapmak, "beklenen" ile "imkânsız"
  arasındaki ayrımı bulanıklaştırır.
```

```flashcards
- front: "`panic!` ile `Result` arasında seçim yaparken sorulacak temel soru nedir?"
  back: "Bu başarısızlık, kod doğru olsa bile yaşanabilir mi? Evet → `Result`; hayır (yalnızca bir bug yüzünden) → `panic!`."
- front: Bir kütüphane, kullanıcı girdisinden kaynaklanan bir hata için neden panik atmamalı?
  back: Çağıranın bağlamını (web sunucusu, CLI, gömülü sistem...) bilemez; panik, kurtarma kararını çağıranın elinden alır ve bütün programı çökertebilir.
- front: Fonksiyon sözleşmesi (contract) nedir, bozulursa ne yapılır?
  back: "Çağıranın uyması gereken önkoşullar (ör. `sayfa_boyutu > 0`). Bozulması çağıranın bug'ıdır; `assert!` ile panik atılır ve koşul belgelenir."
- front: "\"Doğrulamakla yetinme, ayrıştır\" (parse, don't validate) yaklaşımı ne demektir?"
  back: "Ham veriyi bir kez doğrulayıp doğrulanmış bir tipe çevir (`Yas::new` → `Result<Yas, _>`); sonra hep o tiple çalış, yeniden denetleme."
- front: "`pub struct Yas(u8);` modül dışından neden `Yas(200)` diye oluşturulamaz?"
  back: "Alan gizli; gizli alanlı bir tuple struct'ın kurucusu modül dışına kapalıdır (E0603; `use` ile alınmışsa E0423). Tek kapı `Yas::new`'dur."
- front: "`expect` kullanmadan önce kendine sorman gereken soru nedir?"
  back: "Kodu derleyicinin de bileceği biçimde (`if let`, `match`, `let else`) yeniden yazabilir miyim? Yazabiliyorsan `expect`'e gerek yok."
- front: Testlerde ve prototiplerde `unwrap` neden kabul edilebilir?
  back: "Testte panik = başarısız test (istenen davranış). Prototipte `unwrap` sonra düzeltilecek yerleri gösteren bir yer imidir."
- front: "`v[i]` ile `v.get(i)` arasında nasıl seçim yaparsın?"
  back: "Dizin kodun kendi hesabıysa ve geçerli olduğu garantiyse `v[i]`; dizin dış dünyadan geliyorsa `v.get(i)` (`Option`)."
```
