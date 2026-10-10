---
id: m26-l02
title: serde ile serileştirme
minutes: 20
type: lesson
objectives:
  - "`#[derive(Serialize, Deserialize)]` ile bir tipi JSON'a çevirip (`to_string`, `to_string_pretty`) JSON'dan geri okuyabilmek (`from_str`)"
  - "`rename`, `rename_all`, `default`, `skip_serializing_if` ve `Option` alanlarıyla JSON biçimini tipten bağımsız şekillendirebilmek"
  - Enum'ların dört JSON gösterimini ve şemasız veri için `serde_json::Value`'yu doğru yerde kullanabilmek
  - "`serde_json::Error`'ı okuyup `?` ile yayabilmek ve ödünç alınan (`&'a str`) alanların ne zaman çalışmadığını açıklayabilmek"
keywords: [serde, serde_json, Serialize, Deserialize, JSON, rename, default, Option, Value, "json!", serileştirme]
---

Programların çoğu bir noktada dış dünyayla konuşur: bir web API'sine JSON gönderir, bir ayar dosyasını
okur, bir oyunun kayıt dosyasını diske yazar. Her seferinde aynı iş yapılır: Bellekteki bir `struct`'ı
**metne ya da baytlara** çevirmek ve geri dönüştürmek. Bunun adı **serileştirme (serialization)** ve
tersi, **ters serileştirme (deserialization)**.

Rust'ta bu işin neredeyse tek adı var: **serde** (*SERialize* + *DEserialize*). crates.io'nun en çok
indirilen crate'lerinden biri ve bir önceki derste gördüğümüz "ortak trait" fikrinin en güzel örneği.

## Elle yazmak neden kötü fikir?

Bir öğrenci kaydını JSON'a çevirmek için `format!` yeterli gibi görünür. Tahmin et:

```predict
code: |
  fn main() {
      let ad = "Ali \"Kral\" Yılmaz";
      let yas = 30;
      let json = format!("{{\"ad\": \"{ad}\", \"yas\": {yas}}}");
      println!("{json}");
  }
options:
  - |
    {"ad": "Ali "Kral" Yılmaz", "yas": 30}
  - |
    {"ad": "Ali \"Kral\" Yılmaz", "yas": 30}
  - |
    {{"ad": "Ali "Kral" Yılmaz", "yas": 30}}
answer: 0
explanation: |
  Kaynak koddaki `\"`, string'in **içinde** tek bir `"` karakteridir. `format!` bu karakteri olduğu gibi
  yerleştirir; JSON için kaçış (escape) yapmaz. Sonuç geçersiz bir JSON'dur: Okuyan taraf `"Ali "`'den
  sonra `Kral` görünce hata verir. `{{` ve `}}` ise `format!`'ta tek `{` ve `}` yazdırır (Modül 1).
```

Elle yazılan serileştirme kodunda bu tür hatalar kaçınılmazdır: tırnak, ters bölü, satır sonu, Unicode,
iç içe diziler, eksik alanlar... Üstelik ters yönü (JSON'dan `struct`'a) elle yazmak çok daha zordur.

serde bu sorunu iki katmanla çözer:

1. **Tipler** `Serialize` ve `Deserialize` trait'lerini uygular. Bunu neredeyse her zaman `derive` ile
   yaparsın.
2. **Biçimler (formats)** ayrı crate'lerdir: `serde_json`, `toml`, `serde_yaml`, `csv`, `bincode`,
   `postcard`... Hepsi serde'nin ortak **veri modelini (data model)** konuşur.

Böylece 10 tip ve 5 biçim için 50 ayrı dönüştürücü yazılmaz; her tip veri modeline, her biçim de veri
modeline bir kez bağlanır. `derive` ile üretilen kod derleme zamanında oluşur: Java'nın Jackson'ı ya da
Python'un `json` modülü gibi çalışma anında yansıma (reflection) ya da sözlük taraması yapılmaz. Üretilen
kod, elle yazacağın en iyi kod kadar hızlıdır.

:::analogy Ortak dil konuşan tercümanlar
Bir BM toplantısında 6 dil konuşuluyor. Her dil çifti için ayrı bir tercüman tutsan 15 tercüman gerekir.
Bunun yerine herkes önce İngilizceye, İngilizceden de hedef dile çevrilirse her dil için **tek** bir
tercüman yeter. serde'nin veri modeli o ortak dildir: Senin `struct`'ın yalnızca "veri modeline nasıl
anlatılırım"ı bilir; JSON, TOML ya da YAML olması onu ilgilendirmez.
:::

Projede kullanmak için `derive` özelliğini açman gerekir (Modül 16'daki features):

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```quiz
question: |
  Bir projede `Ogrenci` tipini hem JSON'a (web API'si için) hem TOML'a (ayar dosyası için) çevirmen
  gerekiyor. serde ile ne yaparsın?
options:
  - "`Ogrenci` için iki ayrı impl yazarsın: `impl JsonSerialize` ve `impl TomlSerialize`"
  - "`Ogrenci`'ye bir kez `#[derive(Serialize)]` eklersin; sonra aynı değeri `serde_json::to_string` ile de `toml::to_string` ile de çevirirsin"
  - "`Ogrenci`'yi önce `serde_json::Value`'ya çevirip sonra elle TOML üretirsin"
answer: 1
explanation: |
  `Serialize` biçimden bağımsızdır: Tip yalnızca kendini serde'nin veri modeline nasıl anlatacağını bilir.
  JSON'a mı TOML'a mı çevrileceğine, çağırdığın biçim crate'inin fonksiyonu karar verir. Yeni bir biçim
  eklemek, tipinde hiçbir değişiklik gerektirmez.
feedback:
  - "serde'nin tasarımı tam bunu önlemek için var: tip × biçim kadar impl yazmamak."
  - Doğru!
  - "Gereksiz bir ara adım; `toml` crate'i `Serialize` olan her tipi doğrudan çevirir."
```

## derive ile ilk JSON

Bir `struct`'a iki derive ekle; artık JSON'a gidip gelebilir:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Ogrenci {
    ad: String,
    numara: u32,
    notlar: Vec<u8>,
    mezun: bool,
}

fn main() {
    let ece = Ogrenci {
        ad: String::from("Ece \"Yıldız\" Kaya"),
        numara: 1042,
        notlar: vec![90, 85, 100],
        mezun: false,
    };

    // struct → JSON
    let tek_satir = serde_json::to_string(&ece).unwrap();
    println!("{tek_satir}");
    let guzel = serde_json::to_string_pretty(&ece).unwrap();
    println!("{guzel}");

    // JSON → struct
    let gelen = r#"{"ad":"Can","numara":7,"notlar":[70,60],"mezun":true}"#;
    let can: Ogrenci = serde_json::from_str(gelen).unwrap();
    println!("{can:?}");
}
```

Dikkat edilecekler:

- Tırnaklar doğru kaçışlandı: `"Ece \"Yıldız\" Kaya"`. Türkçe harfler olduğu gibi kalır; JSON UTF-8'dir.
- `Vec<u8>` bir JSON dizisine, `bool` `true`/`false`'a, `String` bir JSON string'ine dönüştü. `Option`,
  `HashMap`, `BTreeMap`, tuple'lar ve iç içe `struct`'lar da kutudan çıktığı gibi çalışır.
- `to_string(&ece)` **referans** alır: serileştirme değeri tüketmez.
- `r#"..."#` bir **ham string (raw string)**: İçindeki `"` karakterlerini kaçışlamadan yazmanı sağlar.
- `from_str` bir `Result` döndürür (Modül 10). Şimdilik `unwrap` kullanıyoruz; hata yönetimine bu dersin
  sonunda geleceğiz.

`derive` etmeyi unutursan derleyici ne yapman gerektiğini söyler:

:::error
```text
error[E0277]: the trait bound `Urun: serde::Serialize` is not satisfied
    --> src/main.rs:10:42
     |
  10 |     println!("{}", serde_json::to_string(&u).unwrap());
     |                    --------------------- ^^ unsatisfied trait bound
     |                    |
     |                    required by a bound introduced by this call
     |
help: the trait `Serialize` is not implemented for `Urun`
     = note: for local types consider adding `#[derive(serde::Serialize)]` to your `Urun` type
     = note: for types from other crates check whether the crate offers a `serde` feature flag
```
`to_string<T: Serialize>` bir trait sınırı (Modül 11) taşır. İkinci not, önceki derste konuştuğumuz
orphan rule'un pratikteki karşılığı: Başka bir crate'in tipi için o crate'in `serde` feature'ını ara.
:::

Ters yönde ise derleyicinin hangi tipe çevireceğini bilmesi gerekir. Tahmin et:

```compiles
question: "(Modül 11 ve 14 tekrarı) Derlenir mi?"
code: |
  use serde::Deserialize;

  #[derive(Debug, Deserialize)]
  struct Nokta {
      x: i32,
      y: i32,
  }

  fn main() {
      let p = serde_json::from_str(r#"{"x": 1, "y": 2}"#).unwrap();
      println!("{p:?}");
  }
answer: false
error: E0283
explanation: |
  `from_str` generic'tir: `fn from_str<'a, T: Deserialize<'a>>(s: &'a str) -> Result<T>`. Dönüş tipi
  `T` hiçbir yerden çıkarılamıyor; JSON metnine bakıp `Nokta` olduğunu tahmin etmek derleyicinin işi
  değil. `parse()` ve `collect()`'te olduğu gibi tipi sen söylersin: `let p: Nokta = ...` ya da turbofish
  `serde_json::from_str::<Nokta>(...)`.
```

## Alanları şekillendirmek

Çoğu zaman JSON'un biçimine **sen** karar vermezsin: Bir JavaScript API'si `camelCase` anahtarlar ister,
eski bir sistem bazı alanları hiç göndermez. serde, `#[serde(...)]` öznitelikleriyle (attribute) Rust
tarafını değiştirmeden JSON tarafını şekillendirmeni sağlar:

| Öznitelik | Ne yapar? |
|---|---|
| `#[serde(rename = "numara")]` (alanda) | Bu alanın JSON'daki adı `numara` olur |
| `#[serde(rename_all = "camelCase")]` (tipte) | Bütün alanlar `sunucu_adi` → `sunucuAdi` olur (`snake_case`, `kebab-case`, `SCREAMING_SNAKE_CASE`...) |
| `Option<T>` alan | JSON'da yoksa ya da `null` ise `None` olur |
| `#[serde(default)]` | JSON'da yoksa `Default::default()` kullanılır (`0`, `false`, boş `Vec`) |
| `#[serde(default = "fonksiyon_adi")]` | JSON'da yoksa bu fonksiyonun döndürdüğü değer kullanılır |
| `#[serde(skip_serializing_if = "Option::is_none")]` | Serileştirirken `None` ise alanı hiç yazma |
| `#[serde(skip)]` | Alan JSON'a hiç girmez; okurken `Default` ile doldurulur |
| `#[serde(deny_unknown_fields)]` (tipte) | Tanımadığı bir anahtar gelirse hata ver (varsayılan: sessizce yok say) |

```rust
use serde::{Deserialize, Serialize};

fn varsayilan_port() -> u16 {
    8080
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Ayar {
    sunucu_adi: String,
    #[serde(default = "varsayilan_port")]
    port: u16,
    #[serde(default)]
    hata_ayiklama: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    yonetici_eposta: Option<String>,
}

fn main() {
    let ayar: Ayar = serde_json::from_str(r#"{"sunucuAdi": "rusteach", "bilinmeyen": 1}"#).unwrap();
    println!("{ayar:?}");
    println!("{}", serde_json::to_string(&ayar).unwrap());
}
```

Yalnızca `sunucuAdi` verdik; `port` fonksiyondan, `hata_ayiklama` `Default`'tan geldi, `yonetici_eposta`
`None` oldu ve geri yazarken hiç görünmedi. `"bilinmeyen"` anahtarı ise sessizce yok sayıldı. Bu, bir API
yeni alanlar eklediğinde eski istemcilerin bozulmamasını sağlar; katı olmak istersen `deny_unknown_fields`
kullanırsın.

```predict
code: |
  use serde::Deserialize;

  #[derive(Debug, Deserialize)]
  struct Kitap {
      baslik: String,
      #[serde(default)]
      sayfa: u32,
      yazar: Option<String>,
  }

  fn main() {
      let a: Result<Kitap, _> = serde_json::from_str(r#"{"baslik": "Kürk Mantolu Madonna"}"#);
      let b: Result<Kitap, _> = serde_json::from_str(r#"{"sayfa": 160, "yazar": null}"#);
      println!("{}", a.is_ok());
      println!("{}", b.is_ok());
  }
options:
  - |
    true
    false
  - |
    false
    false
  - |
    true
    true
  - |
    false
    true
answer: 0
explanation: |
  `a`'da `sayfa` eksik ama `#[serde(default)]` var → `0`. `yazar` eksik ama `Option` → `None`. Yani `a`
  başarılı. `b`'de `yazar: null` sorun değil (`None`), fakat `baslik` **zorunlu** bir `String` ve JSON'da
  yok: ``missing field `baslik` `` hatası. Kural: `Option` ve `default` dışındaki her alan zorunludur.
```

```fill
prompt: |
  Bir hava durumu API'si `{"sehir": "İzmir", "sicaklikC": 31}` biçiminde veri gönderiyor. Rust tarafında
  alanı `sicaklik` diye adlandırmak istiyoruz. Boşlukları doldur.
code: |
  use serde::Deserialize;

  #[derive(Debug, Deserialize)]
  struct HavaDurumu {
      sehir: String,
      #[serde(___0 = "sicaklikC")]
      sicaklik: i32,
  }

  fn main() {
      let json = r#"{"sehir": "İzmir", "sicaklikC": 31}"#;
      let h: HavaDurumu = serde_json::___1(json).unwrap();
      println!("{}: {}°C", h.sehir, h.sicaklik);
  }
blanks:
  - ["rename"]
  - ["from_str"]
output: "İzmir: 31°C"
explanation: |
  `#[serde(rename = "...")]` yalnızca o alanın JSON'daki adını değiştirir; Rust kodunda alan hâlâ
  `sicaklik`'tır. JSON metninden bir değer üretmek için `serde_json::from_str` kullanılır; dönüş tipini
  `let h: HavaDurumu` bildirimi belirler.
```

## Enum'lar ve şemasız veri

Rust enum'larının JSON'da doğrudan bir karşılığı yok. serde dört gösterim sunar; varsayılan
**dışarıdan etiketli (externally tagged)** olandır. Tahmin et:

```predict
code: |
  use serde::Serialize;

  #[derive(Serialize)]
  enum Olay {
      Giris,
      Odeme { tutar: u32 },
      Mesaj(String),
  }

  fn main() {
      let olaylar = [Olay::Giris, Olay::Odeme { tutar: 50 }, Olay::Mesaj(String::from("selam"))];
      for o in &olaylar {
          println!("{}", serde_json::to_string(o).unwrap());
      }
  }
options:
  - |
    "Giris"
    {"Odeme":{"tutar":50}}
    {"Mesaj":"selam"}
  - |
    {"Giris":null}
    {"Odeme":{"tutar":50}}
    {"Mesaj":["selam"]}
  - |
    "Giris"
    {"tutar":50}
    "selam"
answer: 0
explanation: |
  Verisiz bir varyant yalnızca adıyla bir string olur: `"Giris"`. Verili varyantlarda dış bir nesne
  açılır; anahtar **varyant adı**, değer **içerik**tir. Tek alanlı tuple varyantı (`Mesaj(String)`)
  doğrudan içindeki değere dönüşür. Üçüncü seçenek bilgiyi kaybederdi: `{"tutar":50}`'nin hangi varyant
  olduğunu okuyan taraf bilemezdi.
```

Diğer gösterimler tipe eklenen bir öznitelikle seçilir:

| Öznitelik | `Odeme { tutar: 50 }` | Ne zaman? |
|---|---|---|
| (yok) dışarıdan etiketli | `{"Odeme":{"tutar":50}}` | Rust'tan Rust'a; varsayılan |
| `#[serde(tag = "tur")]` içeriden etiketli | `{"tur":"Odeme","tutar":50}` | JS/TS API'lerinde en yaygın biçim |
| `#[serde(tag = "t", content = "c")]` bitişik | `{"t":"Odeme","c":{"tutar":50}}` | Etiket ve içerik ayrı dursun istenirse |
| `#[serde(untagged)]` etiketsiz | `{"tutar":50}` | Okurken varyantlar **sırayla denenir**; ilk uyan kazanır |

`rename_all` enum'larda varyant adlarına uygulanır: `#[serde(tag = "tur", rename_all = "snake_case")]`
ile `{"tur":"odeme","tutar":50}` elde edersin.

Bazen verinin yapısını önceden bilmezsin: kullanıcıdan gelen serbest bir JSON, bir API'nin binlerce
alanından yalnızca birine ihtiyaç duyman... Bunun için `serde_json::Value` var. Modül 7'de öğrendiğin
türden bir enum'dur:

```rust,ignore
pub enum Value {
    Null,
    Bool(bool),
    Number(Number),
    String(String),
    Array(Vec<Value>),
    Object(Map<String, Value>),
}
```

```rust
use serde_json::{json, Value};

fn main() {
    let yanit: Value = serde_json::from_str(
        r#"{"kullanici": {"ad": "Deniz", "rozetler": ["rust", "async"]}, "puan": 1250}"#,
    )
    .unwrap();

    println!("{}", yanit["kullanici"]["ad"]); // JSON gösterimi: tırnaklı
    println!("{:?}", yanit["kullanici"]["ad"].as_str()); // Option<&str>
    println!("{:?}", yanit["puan"].as_u64());
    println!("{}", yanit["kullanici"]["rozetler"][1]);
    println!("{}", yanit["olmayan"]["alan"]); // panik yok: Null

    // json! makrosu: Rust içinde JSON yazmak
    let istek = json!({ "ad": "Ece", "yas": 20, "ilgi": ["satranç", "rust"] });
    println!("{istek}");
}
```

```quiz
question: "`Value` ile `yanit[\"olmayan\"][\"alan\"]` yazınca neden program paniğe girmiyor? Ne zaman `Value` yerine bir `struct` seçmelisin?"
options:
  - "`Value` indekslemesi eksik anahtarlar için `Value::Null` döndürür; yapı biliniyorsa `struct` seçilmeli çünkü eksik ya da yanlış tipli alanlar `from_str` anında hata olarak yakalanır"
  - "`Value` indekslemesi `Option` döndürür; `struct` ise yalnızca performans için tercih edilir"
  - Program aslında paniğe girer; çıktı sadece yakalanmıştır
answer: 0
explanation: |
  `Value`'nun `Index` impl'i (Modül 22) bulamadığı anahtar ya da indeks için paniklemek yerine `Null`
  döndürür. Rahattır ama tehlikelidir: Bir anahtarı yanlış yazsan bile (`"kulanici"`) program sessizce
  `Null` ile devam eder. `struct` ile ise tip sistemi devreye girer: Eksik ya da yanlış tipli alan,
  JSON okunduğu anda net bir hatadır. Kural: Yapıyı biliyorsan `struct`, gerçekten bilmiyorsan `Value`.
  Paniksiz ve `Option` döndüren erişim için `yanit.get("puan")` de kullanılabilir.
feedback:
  - Doğru!
  - "İndeks operatörü `Option` değil, `&Value` döndürür (`get` ise `Option` döndürür). `struct`'ın asıl avantajı doğruluk."
  - "Çıktıda `null` yazıyor; panik olsaydı program orada dururdu."
```

## Hatalar ve ödünç alınan veri

Dış dünyadan gelen veri bozuk olabilir. `serde_json::Error` hatanın **ne** olduğunu ve **nerede**
olduğunu söyler:

```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Urun {
    ad: String,
    stok: u8,
}

fn urun_oku(json: &str) -> Result<Urun, serde_json::Error> {
    let u: Urun = serde_json::from_str(json)?; // hata olursa çağırana yay
    Ok(u)
}

fn main() {
    let girdiler = [
        r#"{"ad": "defter", "stok": 12}"#,
        r#"{"ad": "kalem"}"#,
        r#"{"ad": "silgi", "stok": 300}"#,
        r#"{"ad": "cetvel", "stok": "beş"}"#,
        r#"{"ad": "kitap", "stok": 3"#,
    ];
    for g in girdiler {
        match urun_oku(g) {
            Ok(u) => println!("✔ {} ({} adet)", u.ad, u.stok),
            Err(e) => println!("✘ [{:?}] {e}", e.classify()),
        }
    }
}
```

Hata mesajları satır ve sütun bilgisi içerir. `classify()` hatanın türünü verir: `Syntax` (geçersiz JSON),
`Data` (geçerli JSON ama tipe uymuyor; `u8` için `300` de buna dahil), `Eof` (metin yarıda bitti) ya da
`Io`. Bir uygulamada bu hatayı `Box<dyn Error>`'a (Modül 10) ya da `thiserror`'un `#[from]`'u ile kendi hata
enum'una (Modül 25) çevirip `?` ile yayarsın.

### Kopyalamadan okumak: `&'a str` alanlar

`String` alanlar her değer için heap'te yeni bir tahsis (allocation) yapar. serde, alanları doğrudan
**girdi metninin içinden ödünç alabilir**: Modül 12'deki referans tutan struct'lar!

```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Mesaj<'a> {
    kimden: &'a str,
    metin: &'a str,
}

fn main() {
    let girdi = String::from(r#"{"kimden": "Ece", "metin": "merhaba"}"#);
    let m: Mesaj = serde_json::from_str(&girdi).unwrap();
    println!("{} der ki: {}", m.kimden, m.metin);
}
```

```memory
title: "Mesaj<'a>: alanlar girdinin içine işaret eder"
steps:
  - caption: "`girdi` heap'te JSON metnini tutuyor."
    stack:
      - frame: main
        vars:
          - { name: girdi, type: String, value: "ptr · len=37", to: h1 }
    heap:
      - { id: h1, value: "{\"kimden\": \"Ece\", \"metin\": \"merhaba\"}" }
  - caption: "`from_str` yeni bir tahsis yapmadı: `kimden` ve `metin`, `girdi`'nin baytlarının içindeki dilimlere (`&str`) işaret ediyor. `m`, `girdi`'den uzun yaşayamaz."
    stack:
      - frame: main
        vars:
          - { name: girdi, type: String, value: "ptr · len=37", to: h1 }
          - { name: m.kimden, type: "&'a str", value: "ptr · len=3", to: h1, note: "\"Ece\" kısmı" }
          - { name: m.metin, type: "&'a str", value: "ptr · len=7", to: h1, note: "\"merhaba\" kısmı" }
    heap:
      - { id: h1, value: "{\"kimden\": \"Ece\", \"metin\": \"merhaba\"}" }
```

Bunun bir sınırı var: JSON'daki metin kaçış dizisi içeriyorsa (`\n`, `\"`, `\t` gibi) gerçek değer girdide
**olduğu gibi** durmaz; serde onu yeniden kurmak zorundadır ve ödünç verecek bir dilim yoktur. Bu durumda
`invalid type: string "satır\nsonu", expected a borrowed string` hatası alırsın.

```quiz
question: "(Modül 12 tekrarı) `Mesaj<'a>` örneğinde, `girdi` `from_str`'den hemen sonra `drop(girdi)` ile bırakılsa ve ardından `m.kimden` yazdırılsa ne olur?"
options:
  - "Çalışır; serde değerleri zaten kopyalamıştır"
  - "Derlenmez: `m`, `girdi`'den ödünç aldığı için `girdi` `m` kullanılırken bırakılamaz (E0505)"
  - "Çalışma anında panik: serde geçersiz belleğe erişir"
answer: 1
explanation: |
  `from_str<'a>(s: &'a str) -> Result<T>` imzasında `T = Mesaj<'a>`, yani sonuç girdiyle **aynı yaşam
  süresine** bağlı. Borrow checker `girdi`'nin ödünç alındığı sürece taşınamayacağını ya da
  bırakılamayacağını bilir: ``cannot move out of `girdi` because it is borrowed`` (E0505). Rust'ın sarkan
  referans koruması (Modül 5) burada da işliyor. Esneklik istiyorsan `String` ya da `Cow<'a, str>`
  (Modül 25) kullan: `Cow` kaçış yoksa ödünç alır, varsa sahiplenir.
feedback:
  - "`&'a str` alanlar kopya değil, girdinin içine işaret eden dilimlerdir."
  - Doğru!
  - Güvenli Rust'ta bu tür bir hata çalışma anına kalmaz; derleyici yakalar.
```

## Alıştırmalar

````exercise
title: Kafe hesabı
difficulty: 3
prompt: |
  Bir kafenin sipariş tableti, masanın hesabını şu biçimde JSON olarak gönderiyor:

  ```json
  {
    "masa": 4,
    "kalemler": [
      { "urun": "çay", "adet": 3, "birimFiyat": 15 },
      { "urun": "tost", "adet": 1, "birimFiyat": 90 }
    ],
    "indirimKodu": "OGRENCI"
  }
  ```

  1. `Siparis` ve `Kalem` tiplerine gerekli `derive`'ları ve serde özniteliklerini ekle. Rust tarafında
     alan adları `birim_fiyat` ve `indirim_kodu` olmalı. `indirimKodu` JSON'da **olmayabilir**.
  2. `hesap_toplami(json: &str) -> Result<u32, serde_json::Error>` fonksiyonunu yaz: Kalemlerin
     `adet * birim_fiyat` toplamını döndürsün. İndirim kodu `"OGRENCI"` ise toplamın **%10'u** düşülsün
     (`toplam * 90 / 100`, tamsayı bölmesi). Geçersiz JSON ya da eksik alan `Err` döndürmeli.
starter: |
  use serde::Deserialize;

  struct Kalem {
      urun: String,
      adet: u32,
      birim_fiyat: u32,
  }

  struct Siparis {
      masa: u32,
      kalemler: Vec<Kalem>,
      indirim_kodu: Option<String>,
  }

  fn hesap_toplami(json: &str) -> Result<u32, serde_json::Error> {
      todo!()
  }

  fn main() {
      let json = r#"{"masa": 4, "kalemler": [{"urun": "çay", "adet": 3, "birimFiyat": 15}]}"#;
      println!("{:?}", hesap_toplami(json));
  }
solution: |
  use serde::Deserialize;

  #[derive(Debug, Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct Kalem {
      urun: String,
      adet: u32,
      birim_fiyat: u32,
  }

  #[derive(Debug, Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct Siparis {
      masa: u32,
      kalemler: Vec<Kalem>,
      indirim_kodu: Option<String>,
  }

  fn hesap_toplami(json: &str) -> Result<u32, serde_json::Error> {
      let siparis: Siparis = serde_json::from_str(json)?;
      let toplam: u32 = siparis.kalemler.iter().map(|k| k.adet * k.birim_fiyat).sum();
      let toplam = match siparis.indirim_kodu.as_deref() {
          Some("OGRENCI") => toplam * 90 / 100,
          _ => toplam,
      };
      Ok(toplam)
  }

  fn main() {
      let json = r#"{"masa": 4, "kalemler": [{"urun": "çay", "adet": 3, "birimFiyat": 15}]}"#;
      println!("{:?}", hesap_toplami(json));
  }
check: tests
tests: |
  #[test]
  fn indirimsiz_toplam() {
      let json = r#"{"masa": 2, "kalemler": [
          {"urun": "çay", "adet": 3, "birimFiyat": 15},
          {"urun": "tost", "adet": 1, "birimFiyat": 90}
      ]}"#;
      assert_eq!(hesap_toplami(json).unwrap(), 135, "3×15 + 1×90 = 135; indirimKodu yoksa indirim yok");
  }

  #[test]
  fn ogrenci_indirimi() {
      let json = r#"{"masa": 4, "indirimKodu": "OGRENCI", "kalemler": [
          {"urun": "kahve", "adet": 2, "birimFiyat": 65},
          {"urun": "kurabiye", "adet": 3, "birimFiyat": 25}
      ]}"#;
      assert_eq!(hesap_toplami(json).unwrap(), 184, "205 TL'nin %10 indirimlisi 184 (tamsayı bölmesi)");
  }

  #[test]
  fn baska_kod_indirim_vermez() {
      let json = r#"{"masa": 1, "indirimKodu": "YAZ50", "kalemler": [{"urun": "su", "adet": 4, "birimFiyat": 10}]}"#;
      assert_eq!(hesap_toplami(json).unwrap(), 40, "yalnızca OGRENCI kodu indirim verir");
      let bos = r#"{"masa": 1, "kalemler": []}"#;
      assert_eq!(hesap_toplami(bos).unwrap(), 0, "boş sipariş 0 TL");
  }

  #[test]
  fn hatali_json_err_doner() {
      assert!(hesap_toplami(r#"{"masa": 1, "kalemler": ["#).is_err(), "yarım JSON hata olmalı");
      let eksik = r#"{"masa": 1, "kalemler": [{"urun": "çay", "adet": 1}]}"#;
      assert!(hesap_toplami(eksik).is_err(), "birimFiyat eksikse hata olmalı");
      let yilan = r#"{"masa": 1, "kalemler": [{"urun": "çay", "adet": 1, "birim_fiyat": 15}]}"#;
      assert!(hesap_toplami(yilan).is_err(), "JSON'da anahtar birimFiyat (camelCase) olmalı");
  }
hints:
  - "İki struct'a da `#[derive(Debug, Deserialize)]` ve `#[serde(rename_all = \"camelCase\")]` ekle. `Option<String>` alanı JSON'da yoksa kendiliğinden `None` olur."
  - "`let siparis: Siparis = serde_json::from_str(json)?;` ile başla. Toplam için `siparis.kalemler.iter().map(|k| k.adet * k.birim_fiyat).sum()` kullanabilirsin."
  - "İndirim için `match siparis.indirim_kodu.as_deref() { Some(\"OGRENCI\") => toplam * 90 / 100, _ => toplam }`. `as_deref`, `Option<String>`'i `Option<&str>`'ye çevirir."
explanation: |
  Bütün doğrulama işini serde yaptı: Eksik `birimFiyat`, yanlış yazılmış anahtar, yarım kalmış JSON;
  hepsi `from_str` anında `Err` oldu ve `?` ile çağırana yayıldı. Elle yazılmış bir ayrıştırıcıda bu
  kontrollerin her biri ayrı bir `if` olurdu.

  `rename_all = "camelCase"` iki struct'a da ayrı ayrı uygulanmalı; öznitelik iç içe tiplere miras
  kalmaz. `as_deref()` ise `Option<String>`'i `Option<&str>`'ye çevirerek bir string literal'iyle
  desen eşleştirmeyi mümkün kılar (Modül 7 ve 17'deki deref fikri).

  `urun` ve `masa` alanlarını hiç okumadık; derleyici "never read" uyarısı verebilir. Gerçek kodda bu
  alanlar başka yerlerde kullanılacağı için sorun değil.
````

```exercise
title: Sunucu ayar dosyası
difficulty: 4
prompt: |
  Final projesindeki web sunucumuz ayarlarını JSON'dan okuyacak. `SunucuAyari` tipini ve iki fonksiyonu
  tamamla:

  - `ad` zorunlu. `port` yoksa **8080**, `isci_sayisi` yoksa **4** olsun. `izinli_ipler` yoksa boş liste olsun.
  - `ayar_yukle(json: &str) -> Result<SunucuAyari, AyarHatasi>`: JSON bozuksa ya da tipe uymuyorsa
    `AyarHatasi::Json(hata_mesaji)` döndür (`e.to_string()`). JSON geçerli ama `isci_sayisi == 0` ise
    `AyarHatasi::GecersizIsciSayisi` döndür.
  - `ayar_kaydet(ayar: &SunucuAyari) -> String`: Ayarı tek satırlık JSON'a çevirsin; `izinli_ipler` boşsa
    bu alan çıktıda **hiç görünmesin**.

  JSON anahtarları Rust alan adlarıyla aynıdır (`isci_sayisi`).
starter: |
  use serde::{Deserialize, Serialize};

  #[derive(Debug, PartialEq)]
  struct SunucuAyari {
      ad: String,
      port: u16,
      isci_sayisi: usize,
      izinli_ipler: Vec<String>,
  }

  #[derive(Debug, PartialEq)]
  enum AyarHatasi {
      Json(String),
      GecersizIsciSayisi,
  }

  fn ayar_yukle(json: &str) -> Result<SunucuAyari, AyarHatasi> {
      todo!()
  }

  fn ayar_kaydet(ayar: &SunucuAyari) -> String {
      todo!()
  }

  fn main() {
      match ayar_yukle(r#"{"ad": "rusteach"}"#) {
          Ok(a) => println!("{}", ayar_kaydet(&a)),
          Err(e) => println!("hata: {e:?}"),
      }
  }
solution: |
  use serde::{Deserialize, Serialize};

  fn varsayilan_port() -> u16 {
      8080
  }

  fn varsayilan_isci() -> usize {
      4
  }

  #[derive(Debug, PartialEq, Serialize, Deserialize)]
  struct SunucuAyari {
      ad: String,
      #[serde(default = "varsayilan_port")]
      port: u16,
      #[serde(default = "varsayilan_isci")]
      isci_sayisi: usize,
      #[serde(default, skip_serializing_if = "Vec::is_empty")]
      izinli_ipler: Vec<String>,
  }

  #[derive(Debug, PartialEq)]
  enum AyarHatasi {
      Json(String),
      GecersizIsciSayisi,
  }

  fn ayar_yukle(json: &str) -> Result<SunucuAyari, AyarHatasi> {
      let ayar: SunucuAyari = serde_json::from_str(json).map_err(|e| AyarHatasi::Json(e.to_string()))?;
      if ayar.isci_sayisi == 0 {
          return Err(AyarHatasi::GecersizIsciSayisi);
      }
      Ok(ayar)
  }

  fn ayar_kaydet(ayar: &SunucuAyari) -> String {
      serde_json::to_string(ayar).expect("SunucuAyari her zaman JSON'a çevrilebilir")
  }

  fn main() {
      match ayar_yukle(r#"{"ad": "rusteach"}"#) {
          Ok(a) => println!("{}", ayar_kaydet(&a)),
          Err(e) => println!("hata: {e:?}"),
      }
  }
check: tests
tests: |
  #[test]
  fn varsayilanlar_doldurulur() {
      let a = ayar_yukle(r#"{"ad": "deneme"}"#).unwrap();
      assert_eq!(a.port, 8080, "port verilmezse 8080");
      assert_eq!(a.isci_sayisi, 4, "isci_sayisi verilmezse 4");
      assert!(a.izinli_ipler.is_empty(), "izinli_ipler verilmezse boş");
  }

  #[test]
  fn verilen_degerler_kullanilir() {
      let a = ayar_yukle(r#"{"ad": "api", "port": 3000, "isci_sayisi": 16, "izinli_ipler": ["10.0.0.1"]}"#).unwrap();
      assert_eq!(
          a,
          SunucuAyari { ad: String::from("api"), port: 3000, isci_sayisi: 16, izinli_ipler: vec![String::from("10.0.0.1")] }
      );
  }

  #[test]
  fn sifir_isci_reddedilir() {
      assert_eq!(ayar_yukle(r#"{"ad": "x", "isci_sayisi": 0}"#), Err(AyarHatasi::GecersizIsciSayisi));
  }

  #[test]
  fn bozuk_json_ve_tasan_port() {
      match ayar_yukle(r#"{"port": 80}"#) {
          Err(AyarHatasi::Json(m)) => assert!(m.contains("missing field `ad`"), "mesaj eksik alanı söylemeli: {m}"),
          diger => panic!("ad eksikse Json hatası bekleniyordu, gelen: {diger:?}"),
      }
      assert!(
          matches!(ayar_yukle(r#"{"ad": "x", "port": 70000}"#), Err(AyarHatasi::Json(_))),
          "70000 bir u16'ya sığmaz; serde bunu Data hatası olarak yakalamalı"
      );
  }

  #[test]
  fn kaydederken_bos_liste_atlanir() {
      let a = SunucuAyari { ad: String::from("web"), port: 80, isci_sayisi: 2, izinli_ipler: vec![] };
      assert_eq!(ayar_kaydet(&a), r#"{"ad":"web","port":80,"isci_sayisi":2}"#);
      let b = SunucuAyari { izinli_ipler: vec![String::from("127.0.0.1")], ..a };
      let geri = ayar_yukle(&ayar_kaydet(&b)).unwrap();
      assert_eq!(geri, b, "kaydedip geri yüklenen ayar aynı olmalı (gidiş-dönüş)");
  }
hints:
  - "`SunucuAyari`'ye `Serialize, Deserialize` ekle. `port` ve `isci_sayisi` için `#[serde(default = \"fonksiyon_adi\")]` kullan; fonksiyonları (`fn varsayilan_port() -> u16 { 8080 }`) kendin yaz."
  - "`izinli_ipler` için iki öznitelik birden gerekli: `#[serde(default, skip_serializing_if = \"Vec::is_empty\")]`."
  - "`serde_json::from_str(json).map_err(|e| AyarHatasi::Json(e.to_string()))?` ile serde hatasını kendi hatana çevir; sonra `isci_sayisi`'yi kontrol et. Kaydetmek için `serde_json::to_string(ayar)`."
explanation: |
  Bu alıştırmada iki tür doğrulama var ve ikisi farklı katmanlarda duruyor:

  - **Biçimsel doğrulama** (zorunlu alan, tip, `u16` aralığı) serde'nin işidir. `port: 70000` için ayrı bir
    `if` yazmadık; `u16` tipini seçmek yetti. Bu, Modül 10'daki "geçersiz değerleri tiplerle
    imkânsız kıl" fikrinin serileştirmedeki karşılığı.
  - **Anlamsal doğrulama** (`isci_sayisi > 0`) senin uygulamanın kuralıdır, serde bunu bilemez; bu yüzden
    `from_str`'den sonra kontrol ettik.

  `map_err` (Modül 10) dış crate'in hatasını kendi hata enum'una çeviriyor. `thiserror` ile
  `Json(#[from] serde_json::Error)` yazsaydın `?` bunu kendisi yapardı (Modül 25).

  `ayar_kaydet`'te `expect` kullandık çünkü bu tipin serileştirmesi başarısız olamaz: Bütün alanlar
  string anahtarlı basit değerler. (`serde_json::to_string`'in `Result` döndürmesinin sebebi, örneğin
  anahtarı tuple olan bir `HashMap`'in JSON nesnesine çevrilememesi gibi durumlardır.) Son test bir
  **gidiş-dönüş (round-trip)** testi: Kaydet → yükle → aynı değer. Serileştirme kodu için en değerli test
  budur.
```

## Özet

:::remember
- `#[derive(Serialize, Deserialize)]` + `serde_json::to_string(&x)` / `to_string_pretty` / `from_str::<T>(s)`.
- `from_str`'in dönüş tipini sen söylersin (`let x: T` ya da turbofish), yoksa **E0283**.
- Biçimi şekillendir: `rename`, `rename_all = "camelCase"`, `default`, `default = "fn"`,
  `skip_serializing_if`, `skip`, `deny_unknown_fields`. `Option` alan eksikse `None` olur.
- Enum'lar: varsayılan dışarıdan etiketli `{"Varyant": ...}`; `tag = "tur"`, `tag` + `content`, `untagged`.
- Yapı bilinmiyorsa `serde_json::Value` ve `json!`; eksik anahtar `Null` döner, yapı biliniyorsa `struct` seç.
- Hatalar satır/sütun bilgisi taşır; `classify()` → `Syntax` / `Data` / `Eof` / `Io`. `?` ile yay.
- `&'a str` alanlar kopyasız okur ama kaçış dizili metinde başarısız olur; `String` ya da `Cow` kullan.
:::

```reflect
prompt: |
  serde, Python'un `json.loads` fonksiyonundan temelde nasıl farklı? `json.loads` bir sözlük (dict)
  döndürürken serde neden doğrudan senin `struct`'ını döndürüyor ve bu sana ne kazandırıyor?
answer: |
  `json.loads` yapıyı bilmez; her şeyi dict/list olarak döndürür ve bir anahtarın yanlış ya da eksik
  olduğunu ancak o anahtara eriştiğinde (çoğu zaman çalışma anında, `KeyError` ile) öğrenirsin. serde ise
  hedef tipi derleme zamanında bilir: `derive` o tipe özel bir ayrıştırıcı üretir. Eksik alan, yanlış tip,
  aralık dışı sayı JSON okunduğu anda tek bir yerde hata olur; sonrasında kod tip sistemine güvenerek
  çalışır. Üstelik yansıma (reflection) olmadığı için hızlıdır. Python'daki gibi esnek bir yapı gerekirse
  `serde_json::Value` da vardır.
```

```flashcards
- front: "serde'de bir tipin JSON'a çevrilebilmesi için ne yazılır ve `Cargo.toml`'da hangi özellik açılır?"
  back: "`#[derive(Serialize, Deserialize)]`; `serde = { version = \"1\", features = [\"derive\"] }`."
- front: "`let p = serde_json::from_str(s).unwrap();` neden derlenmez?"
  back: "Dönüş tipi `T` çıkarılamaz (E0283). `let p: Nokta = ...` ya da `from_str::<Nokta>(s)` yazılmalı."
- front: "JSON'da olmayan bir alan için serde ne yapar: (a) `Option<T>` alan, (b) `#[serde(default)]` alan, (c) düz `String` alan?"
  back: "(a) `None` olur, (b) `Default::default()` kullanılır, (c) `missing field` hatası verir."
- front: "Bütün alanları JSON'da `camelCase` yapmak için hangi öznitelik kullanılır?"
  back: "Tipin üzerine `#[serde(rename_all = \"camelCase\")]`."
- front: "`enum Olay { Odeme { tutar: u32 } }` varsayılan gösterimde nasıl serileştirilir? `#[serde(tag = \"tur\")]` ile?"
  back: "`{\"Odeme\":{\"tutar\":50}}`; etiketli hâliyle `{\"tur\":\"Odeme\",\"tutar\":50}`."
- front: "`serde_json::Value`'da olmayan bir anahtarı `v[\"yok\"]` ile indekslemek ne döndürür?"
  back: "Panik yok; `Value::Null` döner. `Option` için `v.get(\"yok\")` kullanılır."
- front: "`#[derive(Deserialize)] struct M<'a> { ad: &'a str }` hangi JSON girdisinde başarısız olur?"
  back: "Değer kaçış dizisi içerdiğinde (`\\n`, `\\\"`...): ödünç verilecek hazır bir dilim yoktur (\"expected a borrowed string\")."
- front: "`serde_json::Error::classify()` hangi dört türü ayırt eder?"
  back: "`Syntax` (geçersiz JSON), `Data` (tipe uymuyor), `Eof` (metin yarıda bitti), `Io`."
```
