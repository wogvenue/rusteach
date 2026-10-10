---
id: m25-l03
title: İdiomatik API Tasarımı
minutes: 26
type: lesson
objectives:
  - "`as_` / `to_` / `into_` öneklerini maliyet ve sahipliğe göre doğru seçebilmek, getter'ları `get_` öneki olmadan adlandırabilmek"
  - "`impl AsRef<str>`, `impl Into<String>` ve `impl IntoIterator` ile esnek ama verimli parametreler tasarlayabilmek"
  - Ortak trait'leri (Debug, Clone, PartialEq, Default, Display...) neden "hevesle" uygulaman gerektiğini orphan rule ile açıklayabilmek
  - "Çok seçenekli bir tip için `#[must_use]` işaretli, doğrulama yapan bir builder yazabilmek"
keywords: [API Guidelines, isimlendirme, as_, to_, into_, getter, IntoIterator, AsRef, Into, must_use, builder, C-COMMON-TRAITS]
---

`s.as_bytes()`, `s.to_lowercase()`, `s.into_bytes()`. Bu üç metodu ilk kez görsen bile hangisinin
ucuz, hangisinin pahalı, hangisinin `s`'yi tükettiğini tahmin edebilir misin? Deneyimli bir
Rust'çı belgeleri açmadan söyleyebilir; çünkü standart kütüphane ve iyi crate'ler **aynı dili**
konuşur.

Bu ortak dilin yazılı hâli **Rust API Guidelines**'tır (rust-lang.github.io/api-guidelines). Bu
derste en önemli kurallarını, gerekçeleriyle birlikte öğreneceksin. Amaç kurallara körü körüne uymak
değil: senin crate'ini kullanan kişinin, std'den alıştığı sezgilerle **ilk denemede doğru kodu**
yazabilmesi.

## İsimler bir sözleşmedir: `as_`, `to_`, `into_`

Guidelines, kontrol listesindeki maddelere `C-CASE`, `C-CONV` gibi kodlar verir. İlki, Modül 2'den
beri uyguladığın büyük/küçük harf kuralı:

| Öğe | Stil | Örnek |
|---|---|---|
| tipler, trait'ler, enum varyantları | `UpperCamelCase` | `KargoTakip`, `Oncelik::Yuksek` |
| fonksiyonlar, metotlar, değişkenler, modüller | `snake_case` | `teslim_et`, `kargo_no` |
| `const` / `static` | `SCREAMING_SNAKE_CASE` | `AZAMI_AGIRLIK` |
| generic tip parametreleri | kısa `UpperCamelCase` | `T`, `K`, `V` |
| yaşam süreleri | kısa küçük harf | `'a`, `'de` |

Kısaltmalar da tek kelime sayılır: `Uuid` (`UUID` değil), `HttpIstek` (`HTTPIstek` değil).

İkincisi (`C-CONV`) dönüşüm metotlarının önekleri. Önek, **maliyeti** ve **sahipliği** anlatır:

| Önek | Maliyet | Sahiplik | std örnekleri |
|---|---|---|---|
| `as_` | bedava (sadece görünüm) | ödünç → ödünç | `String::as_str`, `str::as_bytes`, `Option::as_ref` |
| `to_` | pahalı olabilir (genelde tahsis) | ödünç → sahipli | `str::to_lowercase`, `to_string`, `to_vec`, `to_owned` |
| `into_` | değişken, çoğu zaman ucuz | sahipli → sahipli (**tüketir**) | `String::into_bytes`, `Vec::into_boxed_slice`, `into_iter` |

(`to_` bir istisnayla `Copy` tiplerde de kullanılır: `f64::to_radians(self)` değeri tüketir ama
`Copy` olduğu için bunu hissetmezsin.)

:::analogy Kütüphanedeki kitap
**`as_`**: kitabı rafın önünde açıp okursun; kitap yerinde, kimse bir şey kaybetmez.
**`to_`**: fotokopi çektirirsin; zaman ve kağıt harcarsın ama kitap rafta kalır.
**`into_`**: kitabı alıp kendi notlarınla ciltlenmiş bir deftere dönüştürürsün; artık rafta o kitap yok.
:::

```quiz
question: |
  Kendi `Telefon` newtype'ın için (`struct Telefon(String)`) şu metotları yazıyorsun. Hangi
  eşleştirme Guidelines'a **uygundur**?
options:
  - "`fn as_string(&self) -> String` — içteki metnin bir kopyasını döndürür"
  - "`fn as_str(&self) -> &str`, `fn to_uluslararasi(&self) -> String`, `fn into_inner(self) -> String`"
  - "`fn to_str(&self) -> &str`, `fn into_uluslararasi(&self) -> String`"
answer: 1
explanation: |
  `as_str` ödünç alıp ödünç verir (bedava). `to_uluslararasi` yeni bir `String` tahsis eder
  (örneğin `+90` ekleyerek), ödünç alır, sahipli döndürür: `to_`. `into_inner` `self`'i tüketip
  içteki değeri verir: `into_`. Birinci seçenek `as_` önekiyle kopya döndürerek kullanıcıyı
  yanıltır; üçüncüde `to_str` bedava bir görünüm için pahalı bir önek kullanıyor, `into_` ise
  `&self` alıyor ama `into_` tüketmeyi vaat eder.
feedback:
  - "`as_` bedava bir görünüm vaat eder; `String` döndürmek bir tahsistir, bu `to_string` olmalı."
  - Doğru! Üçü de önekin vaat ettiği maliyet ve sahiplikle uyumlu.
  - "`to_` pahalı dönüşüm, `into_` ise `self`'i tüketmek demektir; ikisi de yanlış yerde kullanılmış."
```

## Getter'lar ve iterator metotları

Java'dan gelenler `getAd()` yazmaya alışkındır. Rust'ta getter'lar **`get_` öneki olmadan**
alanın adını taşır (`C-GETTER`); değiştirilebilir sürümü `_mut` alır:

```rust
#[derive(Debug, Clone, PartialEq)]
struct Ogrenci {
    ad: String,
    puan: u32,
}

#[derive(Debug, Default)]
struct Sinif {
    ogrenciler: Vec<Ogrenci>,
}

impl Sinif {
    fn ekle(&mut self, ad: &str, puan: u32) {
        self.ogrenciler.push(Ogrenci { ad: ad.to_string(), puan });
    }

    // getter: get_ogrenciler değil, ogrenciler
    fn ogrenciler(&self) -> &[Ogrenci] {
        &self.ogrenciler
    }

    // std'nin get'i gibi: indeksle, bulunamazsa None
    fn get(&self, i: usize) -> Option<&Ogrenci> {
        self.ogrenciler.get(i)
    }

    fn iter(&self) -> std::slice::Iter<'_, Ogrenci> {
        self.ogrenciler.iter()
    }

    fn iter_mut(&mut self) -> std::slice::IterMut<'_, Ogrenci> {
        self.ogrenciler.iter_mut()
    }
}

fn main() {
    let mut sinif = Sinif::default();
    sinif.ekle("Defne", 78);
    sinif.ekle("Kerem", 91);

    for o in sinif.iter_mut() {
        o.puan += 5; // herkese 5 puan bonus
    }
    let toplam: u32 = sinif.iter().map(|o| o.puan).sum();
    println!("{} öğrenci, toplam {toplam}", sinif.ogrenciler().len());
    println!("{:?}", sinif.get(1).map(|o| &o.ad));
}
```

İki gözlem:

1. `get` adı **anahtar/indeks ile arama** için ayrılmıştır (`Vec::get`, `HashMap::get`) ve
   `Option` döndürür. Tek bir alan için `get_ad` yazmak bu yüzden de kafa karıştırır.
2. Getter `&Vec<Ogrenci>` yerine `&[Ogrenci]` döndürüyor: iç temsili (Vec) sızdırmadan ihtiyaç
   duyulan görünümü veriyor. İleride `Box<[Ogrenci]>`'ye geçsen kullanıcı kodu bozulmaz.

Koleksiyon gibi davranan tiplerde `C-ITER` şunu ister: `iter()` (`&T` verir), `iter_mut()`
(`&mut T` verir) ve `IntoIterator` uygulamaları. Böylece kullanıcı std'deki gibi
`for o in &sinif` yazabilir (Modül 14: `for` döngüsü `IntoIterator` kullanır).

```fill
prompt: |
  `for o in &sinif { ... }` yazılabilsin diye `&Sinif` için `IntoIterator` uygula. Boşlukları doldur.
code: |
  #[derive(Debug)]
  struct Ogrenci { ad: String, puan: u32 }
  #[derive(Debug, Default)]
  struct Sinif { ogrenciler: Vec<Ogrenci> }

  impl<'a> IntoIterator for &'a Sinif {
      type Item = ___0;
      type IntoIter = std::slice::Iter<'a, Ogrenci>;

      fn into_iter(self) -> Self::IntoIter {
          self.ogrenciler.___1()
      }
  }

  fn main() {
      let sinif = Sinif {
          ogrenciler: vec![
              Ogrenci { ad: "Defne".into(), puan: 83 },
              Ogrenci { ad: "Kerem".into(), puan: 96 },
          ],
      };
      for o in &sinif {
          println!("{}: {}", o.ad, o.puan);
      }
  }
blanks:
  - ["&'a Ogrenci"]
  - ["iter"]
output: |
  Defne: 83
  Kerem: 96
explanation: |
  `&'a Sinif` üzerinde dönmek, elemanları `&'a Ogrenci` olarak ödünç vermektir; bu yüzden
  `Item = &'a Ogrenci` ve hazır `std::slice::Iter<'a, Ogrenci>` tipi kullanılır. `into_iter`
  içteki `Vec`'in `iter()`'ini döndürür. Aynı kalıpla `&'a mut Sinif` için `iter_mut()`, `Sinif`
  için (tüketen) `Vec`'in `into_iter()`'i kullanılır; üçü birlikte std koleksiyonlarının davranışını
  birebir taklit eder.
```

## Esnek parametreler: `AsRef`, `Into`, `IntoIterator`

Önceki derste "sadece okuyorsan `&str` al" dedik. Bazı durumlarda bundan da esnek olabilirsin.
Üç araç var ve her birinin farklı bir amacı var:

| Parametre | Ne zaman? | İçeride |
|---|---|---|
| `impl AsRef<str>` / `impl AsRef<Path>` | sadece **okuyacaksan** ve çağıran birçok farklı tip verebilecekse | `x.as_ref()` → `&str` |
| `impl Into<String>` | değeri **saklayacaksan** (struct alanı) | `x.into()` → `String` |
| `impl IntoIterator<Item = T>` | bir dizi eleman alacaksan | `for x in xs` |

`impl Into<String>` neden saklanacak değerlerde iyidir? Çünkü çağıran zaten bir `String`'e
sahipse ve onu taşırsa **hiç kopya olmaz**; elinde `&str` varsa dönüşüm **tam bir kez** yapılır.
`&str` alıp içeride `to_string()` çağırsaydın, `String` sahibi çağıran bile gereksiz bir kopya
öderdi.

```rust
use std::path::Path;

struct Kargo {
    alici: String,
    adres: String,
}

impl Kargo {
    fn yeni(alici: impl Into<String>, adres: impl Into<String>) -> Self {
        Kargo { alici: alici.into(), adres: adres.into() }
    }
}

fn uzanti_var_mi(yol: impl AsRef<Path>, uzanti: &str) -> bool {
    // is_some_and: Some ise koşulu sınar, None ise doğrudan false döner
    yol.as_ref().extension().is_some_and(|u| u == uzanti)
}

fn main() {
    let adres = String::from("Atatürk Cad. No:5, İzmir");
    let k = Kargo::yeni("Selin Kaya", adres); // &str bir kez kopyalanır, String taşınır
    println!("{} → {}", k.alici, k.adres);

    println!("{}", uzanti_var_mi("fatura.pdf", "pdf"));
    println!("{}", uzanti_var_mi(String::from("rapor.txt"), "pdf"));
    println!("{}", uzanti_var_mi(Path::new("/tmp/yedek.tar"), "tar"));
}
```

`std::fs::read_to_string` gibi std fonksiyonlarının hem `"dosya.txt"` hem `String` hem de `PathBuf`
kabul etmesinin sırrı da `impl AsRef<Path>`'tir. Peki bir sınırı karşılamayan tip verirsen?

```compiles
code: |
  struct Kargo {
      alici: String,
  }

  impl Kargo {
      fn yeni(alici: impl Into<String>) -> Self {
          Kargo { alici: alici.into() }
      }
  }

  fn main() {
      let k = Kargo::yeni(5);
      println!("{}", k.alici);
  }
answer: false
error: E0277
explanation: |
  `impl Into<String>` "bu parametre `String`'e dönüştürülebilen herhangi bir tip olabilir" demektir.
  `String`, `From<&str>`, `From<char>`, `From<Box<str>>`... uygular ama `From<{integer}>`
  uygulamaz; derleyici `E0277: the trait bound String: From<{integer}> is not satisfied` der ve
  hangi `From` uygulamalarının mevcut olduğunu listeler. Sayıyı metne çevirmek bilinçli bir
  karardır: `Kargo::yeni(5.to_string())`.
```

:::warning Esnekliğin bedeli
Her generic parametre monomorfizasyonla (Modül 11) her tip için ayrı bir kopya üretir. Gövdesi
büyük bir fonksiyonda bu, derleme süresini ve binary boyutunu şişirir. std'nin hilesi: generic
kabuğu ince tut, işi generic olmayan bir iç fonksiyona yaptır.

```rust,ignore
pub fn oku<P: AsRef<Path>>(yol: P) -> io::Result<String> {
    fn ic(yol: &Path) -> io::Result<String> {
        // asıl uzun kod burada, tek kopya
    }
    ic(yol.as_ref())
}
```

Ayrıca `impl Into<...>` tip çıkarımını zorlaştırabilir ve imzayı okumayı güçleştirir. Esnekliği
**kullanıcıya gerçekten fayda sağlayan** yerlerde kullan (kurucular, sık çağrılan giriş noktaları);
her fonksiyonu generic yapma.
:::

```exercise
id: m25-e-etiketler
title: Esnek kurucu ile etiket kümesi
difficulty: 3
prompt: |
  Bir blog platformunda yazılara etiket ekleniyor. Etiketler farklı kaynaklardan geliyor: bazen
  `["rust", "Performans"]` gibi sabit diziler, bazen kullanıcı girdisinden `Vec<String>`'ler.
  Kullanıcılar hangi tipte veri verirse versin çalışan bir API yaz:

  - `Etiketler::yeni(etiketler)` herhangi bir `IntoIterator` alır; elemanları `Into<String>`
    olabilen herhangi bir şeydir.
  - Her etiketin baştaki/sondaki boşlukları kırpılır (`trim`) ve küçük harfe çevrilir
    (`to_lowercase`). Kırpıldıktan sonra **boş** kalan etiketler atılır.
  - Sonuç **sıralı** ve **tekrarsız** saklanır.
  - `iceriyor(&self, etiket)` herhangi bir `AsRef<str>` alır, aynı normalizasyonu yapıp etiketin
    kümede olup olmadığını söyler.
  - `as_slice(&self) -> &[String]` iç listeyi ödünç verir (isim önekine dikkat: bedava görünüm).
starter: |
  #[derive(Debug, Clone, PartialEq, Default)]
  struct Etiketler {
      liste: Vec<String>,
  }

  impl Etiketler {
      fn yeni(etiketler: impl IntoIterator<Item = impl Into<String>>) -> Self {
          todo!()
      }

      fn iceriyor(&self, etiket: impl AsRef<str>) -> bool {
          todo!()
      }

      fn as_slice(&self) -> &[String] {
          todo!()
      }
  }

  fn main() {
      let e = Etiketler::yeni([" Rust ", "performans", "rust", ""]);
      println!("{:?}", e.as_slice());
      println!("{}", e.iceriyor("RUST"));
  }
solution: |
  #[derive(Debug, Clone, PartialEq, Default)]
  struct Etiketler {
      liste: Vec<String>,
  }

  fn normalize(s: &str) -> String {
      s.trim().to_lowercase()
  }

  impl Etiketler {
      fn yeni(etiketler: impl IntoIterator<Item = impl Into<String>>) -> Self {
          let mut liste: Vec<String> = etiketler
              .into_iter()
              .map(Into::<String>::into)
              .map(|e| normalize(&e))
              .filter(|e| !e.is_empty())
              .collect();
          liste.sort_unstable();
          liste.dedup();
          Etiketler { liste }
      }

      fn iceriyor(&self, etiket: impl AsRef<str>) -> bool {
          let aranan = normalize(etiket.as_ref());
          self.liste.binary_search(&aranan).is_ok()
      }

      fn as_slice(&self) -> &[String] {
          &self.liste
      }
  }

  fn main() {
      let e = Etiketler::yeni([" Rust ", "performans", "rust", ""]);
      println!("{:?}", e.as_slice());
      println!("{}", e.iceriyor("RUST"));
  }
check: tests
tests: |
  #[test]
  fn str_dizisinden_olusur_ve_normalize_eder() {
      let e = Etiketler::yeni([" Rust ", "Performans", "rust", "  ", "api"]);
      assert_eq!(e.as_slice(), ["api", "performans", "rust"], "kırpılmış, küçük harfli, sıralı ve tekrarsız olmalı; boş etiket atılmalı");
  }

  #[test]
  fn string_vektorunden_olusur() {
      let girdi: Vec<String> = vec!["Web".to_string(), "async".to_string(), "WEB ".to_string()];
      let e = Etiketler::yeni(girdi);
      assert_eq!(e.as_slice(), ["async", "web"]);
  }

  #[test]
  fn iceriyor_farkli_tiplerle_calisir() {
      let e = Etiketler::yeni(vec!["Rust", "Çay"]);
      assert!(e.iceriyor("rust"), "&str ile arama");
      assert!(e.iceriyor(String::from("  RUST ")), "String ile arama da normalize edilmeli");
      assert!(e.iceriyor("çay"), "Türkçe karakterler korunmalı");
      assert!(!e.iceriyor("go"), "olmayan etiket false");
  }

  #[test]
  fn bos_girdi() {
      let bos: [&str; 0] = [];
      let e = Etiketler::yeni(bos);
      assert!(e.as_slice().is_empty());
      assert!(!e.iceriyor(""), "boş etiket asla saklanmaz");
      assert_eq!(e, Etiketler::default());
  }
hints:
  - "`etiketler.into_iter()` ile dön; her elemanı önce `e.into()` ile `String`'e çevir, sonra `trim()` ve `to_lowercase()` uygula. Kırpma ve küçültmeyi küçük bir `normalize(&str) -> String` yardımcısına koymak iki metotta da işine yarar."
  - "Boşları `filter(|e| !e.is_empty())` ile at, `collect` ile `Vec<String>` yap; ardından `sort_unstable()` ve `dedup()` (Modül 9: `dedup` yalnızca **komşu** tekrarları siler, bu yüzden önce sırala)."
  - "Liste sıralı olduğu için `iceriyor` içinde `self.liste.binary_search(&normalize(etiket.as_ref())).is_ok()` O(log n)'de cevap verir. `as_slice` sadece `&self.liste` döndürür."
explanation: |
  İmza kullanıcıyı özgürleştiriyor: `[&str; N]`, `Vec<String>`, hatta bir iterator zinciri
  (`satirlar.iter().map(|s| s.trim())`) doğrudan verilebilir. İçeride her eleman bir kez
  `String`'e dönüşüyor.

  Sıralı tutmanın iki faydası var: `dedup` ile tekrarları tek geçişte silmek ve `binary_search`
  ile hızlı arama. `iceriyor` girdiyi de normalize ediyor; aksi hâlde `"RUST"` araması
  `"rust"`'ı bulamazdı. Bu, "aynı kuralı her giriş noktasında uygula" ilkesidir.

  Uyarı (Modül 9): `to_lowercase` Türkçe `İ`/`I` için dile özgü kuralları bilmez (`"I"` → `"i"`
  olur, `"ı"` değil). Gerçek bir Türkçe uygulamada bu ayrıca ele alınmalıdır.

  Alternatif tasarım: `BTreeSet<String>` sıralı ve tekrarsız olmayı kendisi garanti eder;
  `as_slice` gibi bir dilim görünümü veremeyeceğin için burada `Vec` + `sort` + `dedup` seçildi.
```

## Ortak trait'leri hevesle uygula

`C-COMMON-TRAITS` maddesi şunu söyler: genel amaçlı tiplerin uygun olan tüm standart trait'leri
**uygulamalı**: `Debug`, `Clone`, `Copy`, `PartialEq`, `Eq`, `PartialOrd`, `Ord`, `Hash`,
`Default`, ve anlamlıysa `Display`. Neden "hevesle"? Bir soruyla hatırla:

```quiz
question: |
  `odeme` crate'inin yazarı `pub struct Para { kurus: i64 }` tipine `Hash` uygulamayı unutmuş.
  Sen `odeme`'yi kullanan bir uygulama yazıyorsun ve `HashMap<Para, u32>` istiyorsun. Kendi
  crate'inde `impl Hash for Para { ... }` yazarsan ne olur?
options:
  - Derlenir; trait'i tanımlayan ya da tipi tanımlayan crate olman gerekmez
  - "Derlenmez (E0117, orphan rule): ne `Hash` ne de `Para` senin crate'inde tanımlı"
  - Derlenir ama yalnızca `#[derive(Hash)]` ile yazılırsa
answer: 1
explanation: |
  Modül 11'deki **orphan rule** (yetim kuralı): bir trait'i bir tipe uygulayabilmek için ya trait'in
  ya da tipin **senin crate'inde** tanımlı olması gerekir. `Hash` std'de, `Para` `odeme`'de; sen
  ikisinin de sahibi değilsin. Tek çıkış yolun bir newtype (`struct BenimPara(Para)`) yazıp tüm
  API'yi sarmak (Modül 22) — zahmetli. İşte bu yüzden kütüphane yazarları ortak trait'leri
  **baştan** uygular: kullanıcıları onları sonradan ekleyemez.
feedback:
  - Rust'ın tutarlılık (coherence) kuralları buna izin vermez; aksi hâlde iki crate aynı uygulamayı yazıp çakışabilirdi.
  - Doğru! Bu yüzden kütüphane tipleri ortak trait'leri eksiksiz uygulamalıdır.
  - "`derive` yalnızca tipin tanımlandığı yerde kullanılabilir; başka crate'in tipine derive ekleyemezsin."
```

Pratik bir kontrol listesi:

- **`Debug`**: her `pub` tipte (`C-DEBUG`). Kullanıcı `{:?}` ya da `dbg!` ile hata ayıklayamazsa
  tipin kullanışsızdır. İçinde parola gibi gizli veri varsa `Debug`'ı elle yaz ve maskele.
- **`Clone`, `PartialEq`, `Eq`, `Hash`, `Ord`**: anlamlı oldukları sürece derive et. `f64` alanı
  varsa `Eq`/`Ord`/`Hash` derive edilemez (NaN; Modül 9) — bu doğal bir sınırdır.
- **`Copy`**: yalnızca küçük, "değer gibi" tiplerde ve **gelecekte de** öyle kalacaksa. `Copy`'yi
  sonradan kaldırmak geriye dönük uyumsuz (breaking) bir değişikliktir.
- **`Default`**: "boş/varsayılan" bir değer anlamlıysa; struct update sözdizimi
  (`..Default::default()`) ve `unwrap_or_default` ile güzel çalışır.
- **`Display`**: kullanıcıya gösterilecek bir metin temsili varsa (hatalar için zorunlu).
- **Dönüşümler** (`C-CONV-TRAITS`): `From`, `TryFrom`, `AsRef`, `FromStr` uygula. **`Into`'yu asla
  doğrudan uygulama**: `From` uygularsan `Into` blanket impl ile bedavaya gelir (Modül 11).
- **`Send` / `Sync`** (`C-SEND-SYNC`): otomatik türetilir; tipine bir `Rc` ya da ham işaretçi
  koyarak farkında olmadan kaybetme. Kaybetmek de bir breaking change'dir.

## Builder ve `#[must_use]`

Rust'ta varsayılan parametre değerleri ya da isimli argümanlar yoktur. Çok seçenekli bir tipi
`Bildirim::yeni(baslik, govde, oncelik, sessiz, ikon, ses, ...)` gibi bir kurucuyla oluşturmak
okunaksız ve hataya açıktır: `true, false, 3` hangisiydi? Modül 20'de gördüğün **builder**
deseni (`C-BUILDER`) bunu çözer:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Default)]
enum Tema {
    #[default]
    Acik,
    Koyu,
}

#[derive(Debug)]
struct Pencere {
    baslik: String,
    genislik: u32,
    yukseklik: u32,
    tema: Tema,
}

#[must_use = "pencereyi oluşturmak için `.olustur()` çağır"]
#[derive(Debug, Clone)]
struct PencereBuilder {
    baslik: String,
    genislik: u32,
    yukseklik: u32,
    tema: Tema,
}

impl Pencere {
    fn builder(baslik: impl Into<String>) -> PencereBuilder {
        PencereBuilder { baslik: baslik.into(), genislik: 800, yukseklik: 600, tema: Tema::default() }
    }
}

impl PencereBuilder {
    fn boyut(mut self, genislik: u32, yukseklik: u32) -> Self {
        self.genislik = genislik;
        self.yukseklik = yukseklik;
        self
    }

    fn tema(mut self, tema: Tema) -> Self {
        self.tema = tema;
        self
    }

    fn olustur(self) -> Pencere {
        Pencere { baslik: self.baslik, genislik: self.genislik, yukseklik: self.yukseklik, tema: self.tema }
    }
}

fn main() {
    let ayarlar = Pencere::builder("Rusteach").tema(Tema::Koyu).olustur();
    let kucuk = Pencere::builder("Hesap Makinesi").boyut(320, 480).olustur();
    for p in [&ayarlar, &kucuk] {
        println!("{}: {}x{} {:?}", p.baslik, p.genislik, p.yukseklik, p.tema);
    }
}
```

Zorunlu alanlar (`baslik`) builder'ın kurucusuna, isteğe bağlı olanlar zincirleme metotlara gider.
Tüketen (`self` alan) metotlar sayesinde `Pencere::builder(..).tema(..).olustur()` tek ifadede
yazılır.

En sık yapılan builder hatası, zinciri kurup sonunda `.olustur()` çağırmayı unutmaktır. Bu kod
derlenir ama hiçbir şey yapmaz. `#[must_use]` özniteliği bu durumda derleyicinin uyarmasını sağlar.
Yukarıdaki programda `main`'in ilk satırına `Pencere::builder("Ayarlar").tema(Tema::Koyu);` eklersen:

:::error
```text
warning: unused `PencereBuilder` that must be used
  --> src/main.rs:49:5
   |
49 |     Pencere::builder("Ayarlar").tema(Tema::Koyu);
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: pencereyi oluşturmak için `.olustur()` çağır
   = note: `#[warn(unused_must_use)]` (part of `#[warn(unused)]`) on by default
help: use `let _ = ...` to ignore the resulting value
   |
49 |     let _ = Pencere::builder("Ayarlar").tema(Tema::Koyu);
   |     +++++++
```
Mesajdaki ilk `note` satırı, `#[must_use = "..."]` içine yazdığın açıklamadır.
:::

`#[must_use]` hem tiplere hem fonksiyonlara konabilir. std bunu yaygın kullanır: `Result` (hatayı
görmezden gelme), iterator adaptörleri (*"iterators are lazy and do nothing unless consumed"*),
`String::to_uppercase` gibi yeni değer döndüren saf fonksiyonlar. Kural: **sonucu kullanılmadan
çağrılması neredeyse kesin bir hata** olan her şeye ekle.

```quiz
question: Aşağıdakilerden hangisine `#[must_use]` eklemek **en az** anlamlıdır?
options:
  - "`fn kdv_ekle(&self, oran: f64) -> Fiyat` — yeni bir fiyat döndürür, `self`'i değiştirmez"
  - "`fn kaydet(&mut self) -> usize` — veriyi diske yazar ve yazılan bayt sayısını döndürür"
  - "Bir builder tipi: `struct SorguBuilder { ... }`"
answer: 1
explanation: |
  `kdv_ekle` saf bir fonksiyondur: sonucu kullanmazsan çağrı tamamen anlamsızdır. Builder da
  `.olustur()` olmadan bir işe yaramaz. `kaydet` ise asıl işini **yan etki** olarak yapar; çağıranların
  çoğu bayt sayısıyla ilgilenmez. Her çağrıyı `let _ =` ile susturmak zorunda bırakmak gürültü olur.
  (Hata döndürebilseydi `Result` döndürmeliydi; `Result` zaten `#[must_use]`'dur.)
feedback:
  - Saf bir fonksiyonun sonucunu atmak neredeyse kesin bir hatadır; `#[must_use]` tam burası için.
  - Doğru! Asıl iş yan etki olduğunda dönüş değerini kullanmamak meşrudur.
  - Builder'ı oluşturup bırakmak klasik hatadır; `#[must_use]` builder tipleri için idealdir.
```

Şimdi doğrulama yapan bir builder yaz:

```exercise
id: m25-e-bildirim-builder
title: Doğrulayan bildirim builder'ı
difficulty: 4
prompt: |
  Bir mobil uygulamanın bildirim servisi için builder'ı tamamla.

  - `Bildirim::builder(baslik)` zorunlu başlığı alır (`impl Into<String>`); varsayılanlar:
    `govde` boş, `oncelik` `Oncelik::Normal`, `sessiz` `false`.
  - `govde`, `oncelik`, `sessiz` metotları `self`'i alıp güncelleyip döndürür (zincirleme).
  - `olustur(self) -> Result<Bildirim, String>` şu sırayla doğrular:
    1. Kırpılmış başlık boşsa → `Err("başlık boş olamaz")`
    2. Başlık 40 **karakterden** uzunsa → `Err("başlık en fazla 40 karakter olabilir")`
    3. Öncelik `Yuksek` ve `sessiz` `true` ise → `Err("yüksek öncelikli bildirim sessiz olamaz")`
    4. Aksi hâlde başlığı **kırpılmış** olarak saklayan `Ok(Bildirim { .. })`.
starter: |
  #[derive(Debug, Clone, Copy, PartialEq, Default)]
  enum Oncelik {
      Dusuk,
      #[default]
      Normal,
      Yuksek,
  }

  #[derive(Debug, Clone, PartialEq)]
  struct Bildirim {
      baslik: String,
      govde: String,
      oncelik: Oncelik,
      sessiz: bool,
  }

  #[must_use = "bildirimi oluşturmak için `.olustur()` çağır"]
  #[derive(Debug, Clone)]
  struct BildirimBuilder {
      baslik: String,
      govde: String,
      oncelik: Oncelik,
      sessiz: bool,
  }

  impl Bildirim {
      fn builder(baslik: impl Into<String>) -> BildirimBuilder {
          todo!()
      }
  }

  impl BildirimBuilder {
      fn govde(mut self, govde: impl Into<String>) -> Self {
          todo!()
      }

      fn oncelik(mut self, oncelik: Oncelik) -> Self {
          todo!()
      }

      fn sessiz(mut self, sessiz: bool) -> Self {
          todo!()
      }

      fn olustur(self) -> Result<Bildirim, String> {
          todo!()
      }
  }

  fn main() {
      let b = Bildirim::builder("Kargonuz yolda")
          .govde("Tahmini teslim: yarın")
          .oncelik(Oncelik::Yuksek)
          .olustur();
      println!("{b:?}");
  }
solution: |
  #[derive(Debug, Clone, Copy, PartialEq, Default)]
  enum Oncelik {
      Dusuk,
      #[default]
      Normal,
      Yuksek,
  }

  #[derive(Debug, Clone, PartialEq)]
  struct Bildirim {
      baslik: String,
      govde: String,
      oncelik: Oncelik,
      sessiz: bool,
  }

  #[must_use = "bildirimi oluşturmak için `.olustur()` çağır"]
  #[derive(Debug, Clone)]
  struct BildirimBuilder {
      baslik: String,
      govde: String,
      oncelik: Oncelik,
      sessiz: bool,
  }

  impl Bildirim {
      fn builder(baslik: impl Into<String>) -> BildirimBuilder {
          BildirimBuilder {
              baslik: baslik.into(),
              govde: String::new(),
              oncelik: Oncelik::default(),
              sessiz: false,
          }
      }
  }

  impl BildirimBuilder {
      fn govde(mut self, govde: impl Into<String>) -> Self {
          self.govde = govde.into();
          self
      }

      fn oncelik(mut self, oncelik: Oncelik) -> Self {
          self.oncelik = oncelik;
          self
      }

      fn sessiz(mut self, sessiz: bool) -> Self {
          self.sessiz = sessiz;
          self
      }

      fn olustur(self) -> Result<Bildirim, String> {
          let baslik = self.baslik.trim();
          if baslik.is_empty() {
              return Err("başlık boş olamaz".to_string());
          }
          if baslik.chars().count() > 40 {
              return Err("başlık en fazla 40 karakter olabilir".to_string());
          }
          if self.oncelik == Oncelik::Yuksek && self.sessiz {
              return Err("yüksek öncelikli bildirim sessiz olamaz".to_string());
          }
          Ok(Bildirim {
              baslik: baslik.to_string(),
              govde: self.govde,
              oncelik: self.oncelik,
              sessiz: self.sessiz,
          })
      }
  }

  fn main() {
      let b = Bildirim::builder("Kargonuz yolda")
          .govde("Tahmini teslim: yarın")
          .oncelik(Oncelik::Yuksek)
          .olustur();
      println!("{b:?}");
  }
check: tests
tests: |
  #[test]
  fn varsayilanlar() {
      let b = Bildirim::builder("Merhaba").olustur().expect("geçerli bildirim");
      assert_eq!(b, Bildirim { baslik: "Merhaba".into(), govde: String::new(), oncelik: Oncelik::Normal, sessiz: false });
  }

  #[test]
  fn zincirleme_ve_kirpma() {
      let govde = String::from("Siparişiniz hazırlanıyor");
      let b = Bildirim::builder("  Sipariş alındı ")
          .govde(govde)
          .oncelik(Oncelik::Dusuk)
          .sessiz(true)
          .olustur()
          .unwrap();
      assert_eq!(b.baslik, "Sipariş alındı", "başlık kırpılarak saklanmalı");
      assert_eq!(b.govde, "Siparişiniz hazırlanıyor");
      assert_eq!(b.oncelik, Oncelik::Dusuk);
      assert!(b.sessiz);
  }

  #[test]
  fn bos_ve_uzun_baslik() {
      assert_eq!(Bildirim::builder("   ").olustur(), Err("başlık boş olamaz".to_string()));
      let kirk = "ş".repeat(40);
      assert!(Bildirim::builder(kirk).olustur().is_ok(), "40 karakter (80 bayt) sınırda ve geçerlidir: bayt değil karakter say");
      assert_eq!(
          Bildirim::builder("a".repeat(41)).olustur(),
          Err("başlık en fazla 40 karakter olabilir".to_string())
      );
  }

  #[test]
  fn yuksek_oncelik_sessiz_olamaz() {
      let sonuc = Bildirim::builder("Deprem uyarısı").oncelik(Oncelik::Yuksek).sessiz(true).olustur();
      assert_eq!(sonuc, Err("yüksek öncelikli bildirim sessiz olamaz".to_string()));
      assert!(Bildirim::builder("Deprem uyarısı").oncelik(Oncelik::Yuksek).olustur().is_ok());
  }
hints:
  - "`builder` içinde `BildirimBuilder { baslik: baslik.into(), govde: String::new(), oncelik: Oncelik::default(), sessiz: false }` döndür. Ara metotlar alanı atayıp `self` döndürür."
  - "`olustur` içinde `let baslik = self.baslik.trim();` ile başla. Uzunluk için `len()` bayt sayar; `ş` gibi harfler 2 bayttır. Karakter saymak için `baslik.chars().count()` kullan."
  - "Kontrolleri sırayla `return Err(\"...\".to_string());` ile yap; en sonda `Ok(Bildirim { baslik: baslik.to_string(), govde: self.govde, oncelik: self.oncelik, sessiz: self.sessiz })`."
explanation: |
  Builder, geçersiz bir `Bildirim`'in **hiç oluşmamasını** sağlıyor: doğrulama tek bir yerde,
  `olustur`'da yapılıyor ve `Bildirim` yalnızca `Ok` dalında üretiliyor (Modül 10: "geçersiz
  değerler var olamasın"). `#[must_use]` sayesinde `.olustur()` unutulursa derleyici uyarıyor.

  `self.baslik.trim()` bir `&str` ödünç alır; `self.govde`'yi taşıyabiliyoruz çünkü `self`'in
  sahibiyiz ve `baslik` ödüncü `to_string()`'den sonra kullanılmıyor. Testteki `"ş".repeat(40)`
  80 bayttır: `len()` ile kontrol eden bir çözüm onu yanlışlıkla reddederdi.

  Daha ileri seviye: Modül 20'deki **typestate** tekniğiyle "başlık verilmeden `olustur` çağrılamaz"
  kuralı derleme zamanına taşınabilir. Gerçek dünyada hatalar da `String` yerine bir hata enum'u
  olur; bunu bir sonraki derste `thiserror` ile yapacağız.
```

## Özet

:::remember
- **Rust API Guidelines**: crate'ini std gibi "hissettirmek" için ortak kurallar (`C-CASE`, `C-CONV`, `C-GETTER`, `C-ITER`, `C-COMMON-TRAITS`, `C-BUILDER`...).
- `as_` = bedava, ödünç → ödünç; `to_` = pahalı, ödünç → sahipli; `into_` = tüketir, sahipli → sahipli.
- Getter'lar `get_` öneki almaz (`ad()`, `ad_mut()`); `get` anahtar/indeksle arama içindir.
- Koleksiyonlar `iter()`, `iter_mut()` ve `&T`/`&mut T`/`T` için `IntoIterator` sunar.
- Okuyacaksan `impl AsRef<str>`, saklayacaksan `impl Into<String>`, dizi alacaksan `impl IntoIterator`. Generic kabuk ince, iş içte.
- Ortak trait'leri baştan uygula; kullanıcılar orphan rule yüzünden sonradan ekleyemez. `Into` değil `From` uygula.
- Çok seçenek → builder; kullanılmadan atılması hata olan her şeye `#[must_use]`.
:::

```reflect
prompt: |
  Bir kütüphane yazarı "Ben `Hash` ve `PartialEq`'e ihtiyaç duymuyorum, o yüzden derive etmedim"
  diyor. Kendi cümlelerinle, bu kararın kullanıcılarını neden zor durumda bıraktığını ve bunun
  Rust'a özgü sebebini açıkla.
answer: |
  Model cevap: Trait'lerin ihtiyacı kütüphane yazarından değil, kullanıcılardan gelir: biri tipi
  `HashMap` anahtarı yapmak, biri testte `assert_eq!` ile karşılaştırmak isteyebilir. Rust'ın orphan
  rule'u yüzünden kullanıcı, ne trait'in (std) ne de tipin (kütüphane) sahibi olduğu için bu
  uygulamaları kendisi ekleyemez; tek çaresi tüm tipi bir newtype ile sarmaktır. Bu yüzden genel
  amaçlı tiplerde anlamlı olan ortak trait'ler baştan uygulanmalıdır. Python ya da JS'de bir nesneye
  sonradan metot eklenebilir; Rust'ta tutarlılık (coherence) uğruna bu kapı kapalıdır.
```

```flashcards
- front: "`as_`, `to_` ve `into_` önekleri maliyet ve sahiplik açısından ne vaat eder?"
  back: "`as_`: bedava, ödünç → ödünç. `to_`: pahalı (tahsis), ödünç → sahipli. `into_`: `self`'i tüketir, sahipli → sahipli."
- front: "Rust'ta `ad` alanı için getter nasıl adlandırılır?"
  back: "`fn ad(&self) -> &str` (değiştirilebilir sürüm `ad_mut`). `get_ad` değil; `get` anahtar/indeks araması içindir."
- front: "`for x in &koleksiyon` yazılabilmesi için kendi tipin neyi uygulamalı?"
  back: "`impl<'a> IntoIterator for &'a Tip` (`Item = &'a T`). Ayrıca `iter()` / `iter_mut()` metotları sunulmalı."
- front: "Bir struct alanına saklanacak metin parametresi için hangi tip en esnek ve verimlidir?"
  back: "`impl Into<String>`: çağıran `String`'ini taşırsa kopya yok, `&str` verirse tam bir kez kopyalanır."
- front: "Neden `Into` yerine `From` uygulanır?"
  back: "`impl<T, U: From<T>> Into<U> for T` blanket impl'i sayesinde `From` uygulayınca `Into` bedavaya gelir."
- front: Kütüphane tipleri ortak trait'leri neden baştan uygulamalıdır?
  back: "Orphan rule: kullanıcı, std trait'ini senin tipine kendi crate'inde uygulayamaz (E0117)."
- front: "`#[must_use]` ne yapar ve nerelere konur?"
  back: Sonuç kullanılmazsa derleyici uyarır. Builder'lar, saf fonksiyonlar, `Result` gibi atılması hata olan değerler için.
- front: Generic parametrelerin kod şişkinliğini azaltmak için std hangi hileyi kullanır?
  back: "İnce generic kabuk + generic olmayan iç fonksiyon: `fn ic(yol: &Path)` ve `ic(yol.as_ref())`."
```
