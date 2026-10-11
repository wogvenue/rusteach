---
id: m08-l07
title: Semver, Cargo.lock ve Özellikler
minutes: 19
type: lesson
objectives:
  - "Bir semver numarasının (`MAJOR.MINOR.PATCH`) her parçasının hangi tür değişikliği bildirdiğini ve `0.x` sürümlerin özel kuralını açıklayabilmek"
  - "Cargo sürüm gereksinimlerinin (`\"1.2.3\"`, `^`, `~`, `=`, `*`, aralıklar) hangi sürümlere izin verdiğini hesaplayabilmek"
  - "`Cargo.lock`'un amacını, ne zaman değiştiğini (`cargo update`) ve neden sürüm kontrolüne eklendiğini açıklayabilmek"
  - "Crate özelliklerini (features) ve `[dev-dependencies]`'i `Cargo.toml`'da kullanabilmek"
keywords: [semver, sürüm, version, Cargo.lock, cargo update, caret, tilde, features, özellik, dev-dependencies, kırıcı değişiklik, breaking change, E0004]
---

Pazartesi projen sorunsuz derleniyor. Salı sabahı kullandığın bir crate'in yazarı yeni bir sürüm
yayımlıyor. Çarşamba günü takım arkadaşın projeyi kendi bilgisayarına indiriyor. Onun derlediği program
seninkiyle aynı mı? Yeni sürüm senin kodunu kırabilir mi? Kırarsa kimin hatası?

Bu sorular yazılımın en eski dertlerinden biridir ve "bende çalışıyordu" cümlesinin kaynağıdır. Rust
ekosistemi bu derdi üç araçla çözer: **anlamsal sürümleme (semantic versioning, semver)**, sürüm
**gereksinimleri** ve **`Cargo.lock`**. Dersin sonunda da crate'lerin isteğe bağlı parçalarını
(**features**) açıp kapatmayı göreceksin.

## Bir sürüm numarası ne söyler?

Semver'de her sürüm üç sayıdan oluşur: `MAJOR.MINOR.PATCH`, örneğin `1.13.1`. Her sayı, önceki sürüme göre
**ne tür** bir değişiklik olduğunu bildiren bir sözdür:

| Artan parça | Anlamı | Örnek | Senin kodun |
|---|---|---|---|
| **PATCH** | Hata düzeltmesi, API aynı | `1.13.0` → `1.13.1` | Değişmeden derlenir |
| **MINOR** | Yeni özellik, eskiler aynen duruyor | `1.12.4` → `1.13.0` | Değişmeden derlenir |
| **MAJOR** | **Kırıcı değişiklik (breaking change)** | `1.13.1` → `2.0.0` | Kırılabilir |

Bir MINOR ya da PATCH artışında kütüphane yazarı şunu taahhüt eder: "Eski sürümle çalışan her kod, yeni
sürümle de çalışır." Daha büyük bir sayıdan önce, bu sayıların nasıl **karşılaştırıldığını** görelim:

```predict
code: |
  fn main() {
      println!("{}", "1.10.0" < "1.9.0");
      println!("{}", (1, 10, 0) < (1, 9, 0));
      println!("{}", (2, 0, 0) > (1, 99, 99));
  }
options:
  - |
    true
    false
    true
  - |
    false
    false
    true
  - |
    true
    true
    false
answer: 0
explanation: |
  Metinler **karakter karakter** karşılaştırılır: `"1.10.0"` ile `"1.9.0"`'ın ilk farklı karakteri `'1'`
  ile `'9'`'dur ve `'1' < '9'` olduğu için sonuç `true`. Yani metin olarak 1.10, 1.9'dan "küçük" çıkar;
  bu sürüm sıralaması için yanlıştır!

  Tuple'lar da soldan sağa karşılaştırılır (sözlük sırası), ama elemanlar **sayıdır**: ilk elemanlar
  eşit (`1 = 1`), ikinci elemanlarda `10 > 9`, sonuç `false`. Üçüncü satırda ilk eleman `2 > 1` olduğu
  için gerisine bakılmaz bile: `true`. Sürüm numaralarını her zaman sayısal parçalar olarak karşılaştır.
```

:::analogy Priz standardı
Evindeki prizleri düşün. Elektrikçi duvarın içindeki gevşek bir kabloyu onarır: **PATCH**, hiçbir
cihazın fark etmez. Prizin yanına bir USB girişi ekler: **MINOR**, eski fişler aynen takılır, yeni
cihazlar ek özellikten faydalanır. Priz tipini değiştirir: **MAJOR**, eski fişler artık girmez; ya
adaptör alırsın ya da cihazlarını değiştirirsin. Semver, kütüphane yazarının "bu sefer priz tipini mi
değiştirdim?" sorusuna dürüst cevap verme sözüdür.
:::

Peki Rust'ta tam olarak hangi değişiklikler **kırıcıdır**? Bir kütüphanenin yeni sürümünü ve onu eski
sürüm zamanında kullanmaya başlamış birinin kodunu birlikte derleyelim:

```compiles
question: "`kargo_takip` crate'i 1.2.0'dan 1.3.0'a geçerken `Durum` enum'una yeni bir varyant ekledi. 1.2.0 zamanında yazılmış bu kod yeni sürümle derlenir mi?"
code: |
  // ---- kargo_takip crate'i, sürüm 1.3.0 ----
  mod kargo_takip {
      pub enum Durum {
          Hazirlaniyor,
          Yolda,
          Teslim,
          Iade, // 1.3.0'da eklendi
      }
  }

  // ---- senin kodun (1.2.0 zamanında yazıldı) ----
  use kargo_takip::Durum;

  fn mesaj(d: Durum) -> &'static str {
      match d {
          Durum::Hazirlaniyor => "Hazırlanıyor",
          Durum::Yolda => "Yolda",
          Durum::Teslim => "Teslim edildi",
      }
  }

  fn main() {
      println!("{}", mesaj(Durum::Yolda));
  }
answer: false
error: E0004
explanation: |
  Modül 7'yi hatırla: `match` **bütün** varyantları kapsamak zorundadır. Yeni `Iade` varyantı eklenince
  senin `match`'in eksik kalır: **E0004 - non-exhaustive patterns: `Durum::Iade` not covered**. Yani
  `pub` bir enum'a varyant eklemek, kulağa "yeni özellik" gibi gelse de **kırıcı bir değişikliktir** ve
  semver'e göre MAJOR artış (2.0.0) gerektirir. 1.3.0 olarak yayımlamak, kullanıcılara verilmiş bir sözü
  bozmaktır.
```

Rust'ta sık karşılaşılan kırıcı ve kırıcı olmayan değişiklikler:

| Değişiklik | Kırıcı mı? | Neden? |
|---|---|---|
| `pub` bir fonksiyonu silmek ya da adını değiştirmek | Evet | Çağıran kod onu bulamaz (E0425) |
| Fonksiyona parametre eklemek | Evet | Eski çağrılar eksik argümanlı kalır (E0061) |
| `pub` bir enum'a varyant eklemek | Evet | Eksiksiz `match`'ler kırılır (E0004) |
| Bütün alanları `pub` olan bir struct'a alan eklemek | Evet | `Hesap { ... }` ile kurulan değerlerde alan eksik kalır (E0063) |
| **Gizli** alanları olan bir struct'a alan eklemek | Hayır | Dışarıdan zaten `Hesap { ... }` yazılamıyor; herkes kurucuyu kullanıyor |
| Yeni bir `pub` fonksiyon ya da modül eklemek | Hayır | Var olan kodu etkilemez* |
| Bir fonksiyonun gövdesindeki hatayı düzeltmek | Hayır | İmza aynı |

Dördüncü ve beşinci satıra dikkat: Ders 2'de gizli alanların ve kurucuların değişmez koşulları
koruduğunu görmüştün. İşte ikinci büyük faydası: **gizlilik, kütüphaneye değişme özgürlüğü verir.**
Dışarıya ne kadar az şey açarsan, kırmadan o kadar çok şeyi değiştirebilirsin.

Bunu çalışırken gör. `hava` crate'i 1.1.0 sürümünde gizli alanlı `Olcum` struct'ına yeni bir alan ve
yeni bir metot ekliyor; 1.0.0 zamanında yazılmış kod ise hiç değişmeden derleniyor:

```rust
// ---- hava crate'i, sürüm 1.1.0 ----
mod hava {
    pub struct Olcum {
        sehir: String,
        derece: i32,
        nem: u8, // 1.1.0'da eklendi: alanlar gizli olduğu için kimse fark etmez
    }

    impl Olcum {
        pub fn yeni(sehir: &str, derece: i32) -> Olcum {
            Olcum { sehir: String::from(sehir), derece, nem: 50 }
        }

        pub fn ozet(&self) -> String {
            format!("{}: {}°C", self.sehir, self.derece)
        }

        // 1.1.0'da eklendi: yeni bir pub metot → MINOR artış yeterli
        pub fn nem(&self) -> u8 {
            self.nem
        }
    }
}

fn main() {
    // ---- 1.0.0 zamanında yazılmış kod: hiç değişmeden derlenir ----
    let o = hava::Olcum::yeni("Trabzon", 18);
    println!("{}", o.ozet());

    // ---- yeni özelliği kullanmak isteyenler için ----
    println!("Nem: %{}", o.nem());
}
```

Aynı değişikliği `pub sehir`, `pub derece` alanlarıyla yapsaydın, `hava::Olcum { sehir: ..., derece: 18 }`
yazan her kullanıcı **E0063 (missing field `nem`)** alırdı ve sürüm 2.0.0 olmak zorunda kalırdı.

:::deep *Neden yıldız? Ve `#[non_exhaustive]`
Yeni bir `pub` öğe eklemek bile nadiren kod kırabilir: kullanıcı iki ayrı crate'ten glob içe aktarma
yapmışsa (`use kutuphane::*;` ve `use baska::*;`) ve yeni öğe öbür crate'teki bir adla çakışıyorsa, o adı
kullanan her satır Ders 4'teki belirsizlik hatasını (E0659) verir. (Kullanıcının kendi tanımladığı aynı
adlı bir öğe ise sorun çıkarmaz: yerel tanımlar glob'u gölgeler.) Semver kuralları bu tür nadir "küçük
kırılmaları" kabul edilebilir sayar, ama bu da glob'ları idareli kullanmak için bir neden daha.

Gelecekte varyant ekleyeceğini bilen kütüphaneler enum'u `#[non_exhaustive]` ile işaretler. Bu durumda
crate'in dışındaki her `match` bir `_ =>` kolu yazmak **zorunda** kalır; yeni varyant eklemek artık
kırıcı olmaz. `std::io::ErrorKind` böyle bir enum'dur.
:::

## 0.x sürümleri: henüz söz yok

Semver'e göre `0.y.z` sürümleri "ilk geliştirme" aşamasıdır: API her an değişebilir. Ama `rand` gibi
yıllardır `0.x`'te duran çok kullanılan crate'ler de var; tamamen sözsüz bir dünya işe yaramazdı. Bu
yüzden Cargo, `0.x` için kuralı **bir basamak kaydırır**:

| Sürüm | Kırıcı değişikliği hangi parça bildirir? | Örnek |
|---|---|---|
| `1.0.0` ve üstü | MAJOR | `1.13.1` → `2.0.0` kırıcı |
| `0.y.z` (y > 0) | **MINOR** (`y`) | `0.9.2` → `0.10.0` kırıcı; `0.10.0` → `0.10.3` uyumlu |
| `0.0.z` | **her sürüm** | `0.0.3` → `0.0.4` kırıcı |

Geçen dersteki `thread_rng` hatası tam olarak buydu: `rand` 0.8 → 0.9 → 0.10 geçişlerinin her biri kırıcı
bir sürümdü ve semver'e göre bunu söyleme hakları vardı.

`1.0.0`, bir yazarın "API'yi artık kırmayacağım, kırarsam 2.0 yayımlarım" demesidir. Bir crate seçerken
`1.x` olması bu yüzden önemli bir olgunluk işaretidir; ama `0.x` bir crate'in kalitesiz olduğu anlamına
gelmez, sadece yazarının API'nin son hâlinden henüz emin olmadığını gösterir.

:::info Ön sürümler
`1.0.0-alpha.1`, `2.0.0-rc.2` gibi tireli sürümler **ön sürümdür (pre-release)**. Sıralamada asıl
sürümden önce gelirler (`1.0.0-alpha.1 < 1.0.0`) ve Cargo onları sen açıkça istemedikçe
(`rand = "0.11.0-rc.1"` gibi) **asla** seçmez. Denemek isteyenler için vardır, sessizce projene
sızmazlar.
:::

## Sürüm gereksinimleri: Cargo hangi sürümü seçer?

`Cargo.toml`'a `regex = "1.13"` yazdığında tek bir sürüm değil, bir **sürüm gereksinimi (version
requirement)**, yani bir **aralık** belirtirsin. Varsayılan işleç **caret (`^`)**'tir: `"1.13"` ile
`"^1.13"` aynı şeydir ve "1.13.0 ya da ondan büyük, ama **uyumlu** olan her sürüm" demektir.

| Gereksinim | İzin verilen aralık | Açıklama |
|---|---|---|
| `"1.2.3"` = `"^1.2.3"` | `>= 1.2.3, < 2.0.0` | Varsayılan: MAJOR sabit |
| `"1.2"` | `>= 1.2.0, < 2.0.0` | Eksik parçalar 0 sayılır |
| `"1"` | `>= 1.0.0, < 2.0.0` | |
| `"0.10"` | `>= 0.10.0, < 0.11.0` | `0.x`'te MINOR sabit |
| `"0.10.3"` | `>= 0.10.3, < 0.11.0` | |
| `"0.0.3"` | `>= 0.0.3, < 0.0.4` | `0.0.x`'te tam sürüm |
| `"~1.2.3"` | `>= 1.2.3, < 1.3.0` | Tilde: yalnızca PATCH güncellemeleri |
| `"=1.2.3"` | yalnızca `1.2.3` | Tam sabitleme (nadiren gerekir) |
| `"1.*"` | `>= 1.0.0, < 2.0.0` | Joker |
| `">= 1.2, < 1.5"` | `>= 1.2.0, < 1.5.0` | Elle yazılmış aralık |

Gereksinime uyan birden çok sürüm varsa Cargo **en yenisini** seçer: hata düzeltmelerini ve yenilikleri
almak istersin, kırılmaları ise istemezsin. Caret'in "uyumlu" tanımı, tam olarak bir önceki adımdaki
"kırıcı değişikliği hangi parça bildirir?" tablosudur.

İnce bir ayrıntı: edition 2024 projelerinde varsayılan olan `resolver = "3"` ayarı Rust sürümünü de
dikkate alır. `Cargo.toml`'da `rust-version = "1.85"` gibi bir satır varsa Cargo, o Rust sürümüyle
derlenemeyecek kadar yeni sürümler yerine onunla uyumlu olan en yeni sürümü tercih eder.

Bu seçimi tuple karşılaştırmasıyla kendimiz yapalım (şimdilik yalnızca `1.0.0` ve üstü için):

```rust
fn main() {
    let gereksinim = (1, 9, 0); // regex = "1.9"
    let ust_sinir = (gereksinim.0 + 1, 0, 0); // bir sonraki MAJOR: 2.0.0
    let yayimlananlar = [(1, 8, 4), (1, 9, 0), (1, 10, 2), (1, 13, 1), (2, 0, 0)];

    let mut secilen = (0, 0, 0);
    for s in yayimlananlar {
        let uyumlu = s >= gereksinim && s < ust_sinir;
        println!("{}.{}.{} → {}", s.0, s.1, s.2, if uyumlu { "uyumlu" } else { "dışarıda" });
        if uyumlu && s > secilen {
            secilen = s;
        }
    }
    println!("Cargo'nun seçimi: {}.{}.{}", secilen.0, secilen.1, secilen.2);
}
```

```quiz
question: |
  `Cargo.toml`'da `rand = "0.9"` yazıyor. crates.io'da şu sürümler var: `0.8.5`, `0.9.0`, `0.9.2`,
  `0.10.3`. Yeni bir projede Cargo hangisini seçer?
options:
  - "`0.10.3`, en yeni sürüm"
  - "`0.9.2`"
  - "`0.9.0`, tam olarak yazılan sürüm"
  - "`0.8.5`"
answer: 1
explanation: |
  `"0.9"` = `^0.9` = `>= 0.9.0, < 0.10.0`. `0.x`'te MINOR kırıcı değişikliği bildirdiği için `0.10.3`
  aralığın dışındadır. Aralıktaki en yeni sürüm `0.9.2`'dir. `0.10`'a geçmek bilinçli bir karar
  olmalı: `Cargo.toml`'u `rand = "0.10"` yapar ve kırılan yerleri düzeltirsin.
feedback:
  - "`0.9` → `0.10` geçişi, `0.x` kuralına göre kırıcıdır; Cargo onu sessizce seçmez."
  - Doğru!
  - Caret bir alt sınır koyar, tam sürümü değil; Cargo uyumlu en yeni sürümü seçer. Tam sürüm için `=0.9.0` yazman gerekirdi.
  - Gereksinimin alt sınırı `0.9.0`'dır; daha eski sürümler hiç değerlendirilmez.
```

## Cargo.lock: tam sürümlerin fotoğrafı

`Cargo.toml` bir **aralık** söyler. Ama aralıktaki "en yeni" sürüm zamanla değişir: bugün `1.13.1`, gelecek
ay `1.14.0`. Takım arkadaşın projeyi bir ay sonra derlerse farklı bir sürüm alabilir. İşte `Cargo.lock`
bu yüzden var: Cargo ilk çözümlemede seçtiği **tam** sürümleri, bağımlılık ağacının **tamamı** için bu
dosyaya yazar.

```toml
# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "rand"
version = "0.10.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "…64 karakterlik SHA-256 özeti…"
dependencies = [
 "chacha20",
 "getrandom",
 "rand_core",
]

[[package]]
name = "rand_core"
version = "0.10.1"
# ...
```

Dosya var olduğu ve kilitli sürümler `Cargo.toml`'daki gereksinimleri karşılamaya devam ettiği sürece
`cargo build` yeni sürüm aramaz, **kilitli sürümleri** kullanır. Sen, takım arkadaşın ve CI sunucusu bit
bit aynı bağımlılık koduyla derlersiniz. (`Cargo.toml`'daki bir gereksinimi kilitli sürümün dışında
kalacak şekilde değiştirirsen Cargo yalnızca o bağımlılığı yeniden çözümler.) `checksum` alanı ise
indirilen dosyanın kilitteki özetle aynı olduğunu doğrular; arada değiştirilmiş bir dosya fark edilir.

:::analogy Tarif ve fiş
`Cargo.toml` bir **yemek tarifi** gibidir: "1 kilo un (herhangi bir marka), 2 yumurta". `Cargo.lock` ise
geçen sefer alışveriş yaptığında aldığın **fiş**: "X marka un, 1 kg, son kullanma 03/2027, parti no
4711". Tarif esnektir ve yıllarca geçerlidir; fiş ise kekin geçen seferki gibi olmasını garanti eder.
Fişi yenilemek istediğinde yeniden markete gidersin: `cargo update`.
:::

`Cargo.lock` ne zaman değişir?

| Komut | Ne yapar? |
|---|---|
| İlk `cargo build` / `cargo add` | Yeni bağımlılıkları çözümler, kilide ekler |
| `cargo update` | **Bütün** bağımlılıkları gereksinimlerine uyan en yeni sürüme günceller |
| `cargo update -p regex` | Yalnızca `regex`'i (ve gerekiyorsa onun bağımlılıklarını) günceller |
| `cargo update -p regex --precise 1.13.0` | `regex`'i aralık içindeki belirli bir sürüme kilitler |

```console
$ cargo update
    Updating crates.io index
     Locking 1 package to latest compatible version
    Updating regex v1.13.0 -> v1.13.1
```

`cargo update` asla aralığın dışına çıkmaz; `regex` `1.x`'te kalır. Kırıcı bir sürüme geçmek için
`Cargo.toml`'daki gereksinimi değiştirmen gerekir.

:::info Cargo.lock sürüm kontrolüne (git) eklenir mi?
**Evet.** Çalıştırılabilir programlarda (binary) her zaman. 2023'ten beri Cargo ekibi kütüphanelerde de
eklemeyi öneriyor; `cargo new` da `Cargo.lock`'u `.gitignore`'a eklemez. Önemli bir ayrıntı: senin
kütüphanen **başka bir projenin bağımlılığı** olduğunda, senin `Cargo.lock`'un **yok sayılır**. Kilidi
yalnızca en üstteki projenin (son uygulamanın) dosyası belirler. Bu yüzden kütüphane yazarları
gereksinimlerini dürüst yazmalıdır: `regex = "1.13"` diyorsan, gerçekten `1.13.0` ile de çalışmalısın.

Benzerleri: JavaScript'te `package-lock.json`, Python'da `poetry.lock` / `uv.lock`.
:::

```quiz
question: |
  Elif'in projesinde `regex = "1.12"` gereksinimi var ve `Cargo.lock`'ta `regex 1.12.2` kilitli. Bugün
  crates.io'da `1.13.1` ve `2.0.0` da var. Elif'in takım arkadaşı Can projeyi git'ten indirip
  `cargo build` diyor. Can hangi `regex` sürümüyle derler?
options:
  - "`2.0.0`, en yeni sürüm"
  - "`1.13.1`, gereksinime uyan en yeni sürüm"
  - "`1.12.2`, `Cargo.lock`'ta kilitli sürüm"
  - Her derlemede rastgele biri seçilir
answer: 2
explanation: |
  `Cargo.lock` git'te olduğu için Can, Elif'le **aynı** sürümü alır: `1.12.2`. Cargo, gereksinim hâlâ
  karşılandığı sürece kilitli sürümü değiştirmez. `1.13.1`'e geçmek isteyen biri `cargo update -p regex`
  çalıştırır ve değişen `Cargo.lock`'u da git'e gönderir; böylece güncelleme bilinçli ve herkes için
  aynı anda olur. `2.0.0` ise `"1.12"` aralığında hiç değildir.
feedback:
  - "`2.0.0`, caret aralığının (`< 2.0.0`) dışındadır."
  - "`Cargo.lock` olmasaydı doğru cevap bu olurdu. Kilit dosyası tam da bu farkı önlemek için var."
  - Doğru!
  - Sürüm çözümlemesi tamamen belirlenimcidir (deterministic).
```

:::tip Aynı crate'in iki sürümü
`rand` 0.8'e bağımlı eski bir crate ile `rand` 0.10 isteyen kendi kodun aynı projede olabilir mi? Evet:
semver'e göre **uyumsuz** iki sürüm gerekirse Cargo **ikisini de** derler. Uyumlu aralıklar ise tek bir
sürümde birleştirilir. Ama dikkat: iki sürümün tipleri **farklı tiplerdir**; bir taraftan aldığın `rand`
değerini diğerine veremezsin. `cargo tree` bağımlılık ağacını, `cargo tree -d` ise ağaçta birden çok
sürümü bulunan crate'leri gösterir.
:::

## Özellikler (features) ve geliştirme bağımlılıkları

Büyük crate'ler her kullanıcının her parçaya ihtiyaç duymadığını bilir. Derleme süresini ve ikili dosya
boyutunu küçültmek için kodlarının bir kısmını **özellik (feature)** adlı anahtarlarla açılıp kapanabilir
hâlde sunarlar:

```toml
[dependencies]
# Varsayılan özellikler + "derive" özelliği
serde = { version = "1", features = ["derive"] }

# Varsayılan özellikleri kapat, yalnızca ihtiyacın olanı aç
regex = { version = "1.13", default-features = false, features = ["std", "unicode-perl"] }
```

```console
$ cargo add serde --features derive
```

Geçen dersteki `\d` meselesini hatırla: `regex` crate'inde `\d`, `\w` gibi Unicode farkında sınıflar
`unicode-perl` özelliğiyle gelir. Bu uygulamanın çevrimiçi çalıştırıcısı `regex`'i bu özellik kapalıyken
derliyor, bu yüzden `\d` orada hata veriyor. Aynı crate, aynı sürüm; farklı özellikler, farklı yetenekler.

Özellikler hakkında bilmen gereken üç kural:

- **Toplanırlar (additive):** Ağaçtaki iki crate aynı bağımlılığın farklı özelliklerini isterse Cargo
  ikisinin **birleşimini** açar. Bu yüzden iyi tasarlanmış bir özellik yalnızca bir şey **ekler**, asla
  bir şeyi kaldırmaz.
- **Belgelerde yazar:** docs.rs'teki "Feature flags" sekmesi bir crate'in bütün özelliklerini ve
  varsayılanlarını listeler.
- **Kendi crate'in de tanımlayabilir:** `Cargo.toml`'a `[features]` bölümü ekler, kodda
  `#[cfg(feature = "...")]` ile o özelliğe bağlı kodu işaretlersin.

```rust,ignore,title=src/main.rs
// Cargo.toml: [features]  renkli = []
#[cfg(feature = "renkli")]
fn baslik(metin: &str) -> String {
    format!("\x1b[1;32m{metin}\x1b[0m") // terminalde yeşil, kalın
}

#[cfg(not(feature = "renkli"))]
fn baslik(metin: &str) -> String {
    format!("== {metin} ==")
}
```

`cargo run --features renkli` dendiğinde ilk fonksiyon, aksi hâlde ikincisi **derlenir**; diğeri
programa hiç girmez. `#[cfg(...)]` koşullu derlemedir ve aynı mekanizmayı her gün farkında olmadan
kullanıyorsun. Modül 1'deki debug / `--release` ayrımını hatırla:

```rust
fn main() {
    // cfg! makrosu derleme zamanındaki ayarı bool olarak verir
    let profil = if cfg!(debug_assertions) { "debug" } else { "release" };
    println!("Bu program {profil} profiliyle derlendi.");

    let a: u8 = 250;
    println!("250 + 10 = {}", a.wrapping_add(10));
    // Düz `a + 10` yazsaydık: değer derleme anında bilindiği için derleyici bunu hata olarak
    // yakalardı. Değer çalışma anında gelseydi debug'da panik, release'de sarma olurdu (Modül 2).
}
```

`debug_assertions`, debug profilinde açık, `--release`'te kapalıdır. Modül 2'deki "taşma debug'da panik,
release'de sarma" davranışını ise kardeş bir profil ayarı, `overflow-checks` yönetir; varsayılan değeri
`debug-assertions` ile aynıdır. İstersen `Cargo.toml`'a `[profile.release]` altında
`overflow-checks = true` yazarak release'de de taşma denetimini açabilirsin.

### Yalnızca geliştirirken gereken bağımlılıklar

Bazı crate'lere yalnızca testlerde, örneklerde ya da kıyaslamalarda ihtiyaç duyarsın. Onları ayrı bir
bölüme yazarsın:

```toml
[dependencies]
regex = "1.13"

[dev-dependencies]
pretty_assertions = "1"   # testlerde daha okunaklı fark çıktısı
```

`[dev-dependencies]` yalnızca `cargo test`, `cargo bench` ve örnekler derlenirken kullanılır. Senin
kütüphaneni kullananlar bunları **hiç indirmez**; böylece kullanıcılarının derleme süresi ve risk yüzeyi
büyümez. (`cargo add --dev pretty_assertions` aynı satırı ekler.)

```quiz
question: "Kütüphanen yalnızca testlerde `pretty_assertions` kullanıyor, kodun kendisi `serde`'nin `derive` özelliğine ihtiyaç duyuyor. Hangi `Cargo.toml` doğru?"
options:
  - "`[dependencies]` altında `serde = \"1\"` ve `pretty_assertions = \"1\"`"
  - "`[dependencies]` altında `serde = { version = \"1\", features = [\"derive\"] }`; `[dev-dependencies]` altında `pretty_assertions = \"1\"`"
  - "`[dev-dependencies]` altında ikisi de"
  - "`[dependencies]` altında `serde-derive = \"1\"`; `[dev-dependencies]` altında `pretty_assertions = \"1\"`"
answer: 1
explanation: |
  Kodun ihtiyaç duyduğu `serde` normal bağımlılıktır ve `derive` özelliği `features` ile açılır.
  Yalnızca testlerde kullanılan `pretty_assertions` ise `[dev-dependencies]`'e gider; kütüphaneni
  kullananlara yük olmaz.
feedback:
  - "İki hata var: `derive` özelliği açılmamış ve test aracı, kütüphanenin bütün kullanıcılarına bağımlılık olarak dayatılıyor."
  - Doğru!
  - "`[dev-dependencies]`'deki crate'ler normal derlemede yoktur; kodun `serde`'yi bulamaz."
  - "`serde_derive` adlı bir crate gerçekten var, ama yalnızca türetme makrolarını içerir; `Serialize` gibi trait'ler `serde`'dedir ve kodun `serde`'yi bulamaz. Ad tahmin etmek yerine docs.rs'teki \"Feature flags\" sekmesine bak: `serde`'nin `derive` özelliği tam bu iş için var."
```

:::deep Rust'ın kendi sözü: sürümler ve edition'lar
Rust derleyicisi de semver kullanır ve Rust ekibinin **bir 2.0 sürümü planı yoktur**: 1.0 için yazılmış
kod bugün de derlenir. Peki dil nasıl gelişiyor? **Edition**'larla: `2015`, `2018`, `2021`, `2024`.
`Cargo.toml`'daki `edition = "2024"` satırı, crate'inin dilin hangi "lehçesini" kullandığını söyler
(örneğin 2018 edition'ında yollar sadeleşti ve `extern crate` satırları gereksizleşti; 2024 edition'ında
`gen` ayrılmış bir anahtar kelime oldu). Edition'lar **crate
başına** seçilir ve farklı edition'daki crate'ler birbirini sorunsuz kullanır. Sonuç: ekosistem tek
seferde göç etmek zorunda kalmadan dil ilerler. Rust ekibi buna "durgunluk olmadan kararlılık"
(*stability without stagnation*) der.
:::

## Alıştırma: Kendi sürüm çözücün

Önce tilde gereksinimini (`~1.2.3` = `>= 1.2.3, < 1.3.0`) kodla:

```fill
prompt: |
  `tilde_uyumlu_mu` fonksiyonu, `~MAJOR.MINOR.PATCH` gereksiniminin bir aday sürümü kabul edip etmediğini
  söylesin. Sürümler `(major, minor, patch)` tuple'ı olarak veriliyor.
code: |
  fn tilde_uyumlu_mu(g: (u64, u64, u64), aday: (u64, u64, u64)) -> bool {
      let ust = (g.0, g.___0 + 1, 0);
      aday ___1 g && aday < ust
  }

  fn main() {
      let g = (1, 2, 3); // ~1.2.3
      for aday in [(1, 2, 2), (1, 2, 3), (1, 2, 9), (1, 3, 0), (2, 0, 0)] {
          println!("{}.{}.{} → {}", aday.0, aday.1, aday.2, tilde_uyumlu_mu(g, aday));
      }
  }
blanks:
  - ["1"]
  - [">="]
output: |
  1.2.2 → false
  1.2.3 → true
  1.2.9 → true
  1.3.0 → false
  2.0.0 → false
explanation: |
  Tilde, MAJOR ve MINOR'u sabitleyip yalnızca PATCH güncellemelerine izin verir: üst sınır
  `(major, minor + 1, 0)`. Tuple'larda `g.1` ikinci elemandır (MINOR). Alt sınır **dahil** (`>=`), üst
  sınır **hariç** (`<`): tıpkı `1.2.3..1.3.0` gibi yarı açık bir aralık.
```

Şimdi Cargo'nun varsayılanı olan caret kuralını, `0.x` incelikleriyle birlikte sen yaz:

```exercise
id: m08-e-surum-cozucu
title: Kendi sürüm çözücün
difficulty: 3
prompt: |
  Sürümler `(major, minor, patch)` tuple'ı olarak veriliyor. İki fonksiyon yaz:

  1. `uyumlu_mu(g, aday) -> bool`: `aday`, **caret** gereksinimi `g`'yi (`"^g"`) karşılıyor mu?
     - `aday` en az `g` olmalı.
     - `g.0 > 0` ise: üst sınır bir sonraki MAJOR → `^1.2.3` = `>= 1.2.3, < 2.0.0`
     - `g.0 == 0` ve `g.1 > 0` ise: üst sınır bir sonraki MINOR → `^0.10.3` = `>= 0.10.3, < 0.11.0`
     - `g.0 == 0` ve `g.1 == 0` ise: üst sınır bir sonraki PATCH → `^0.0.3` = `>= 0.0.3, < 0.0.4`
  2. `en_yeni_uyumlu(g, yayimlananlar) -> Option<(u64, u64, u64)>`: Yayımlanmış sürümlerden (sırasız
     olabilir) gereksinimi karşılayan **en yenisini** döndürür; hiçbiri uymuyorsa `None`. Cargo'nun yaptığı
     tam olarak bu!
starter: |
  pub fn uyumlu_mu(g: (u64, u64, u64), aday: (u64, u64, u64)) -> bool {
      todo!()
  }

  pub fn en_yeni_uyumlu(g: (u64, u64, u64), yayimlananlar: &[(u64, u64, u64)]) -> Option<(u64, u64, u64)> {
      todo!()
  }

  fn main() {
      let rand_surumleri = [(0, 8, 5), (0, 9, 0), (0, 10, 3), (0, 9, 2)];
      match en_yeni_uyumlu((0, 9, 0), &rand_surumleri) {
          Some(s) => println!("rand = \"0.9\" → {}.{}.{}", s.0, s.1, s.2),
          None => println!("rand = \"0.9\" → uyumlu sürüm yok"),
      }
  }
solution: |
  pub fn uyumlu_mu(g: (u64, u64, u64), aday: (u64, u64, u64)) -> bool {
      let ust = if g.0 > 0 {
          (g.0 + 1, 0, 0)
      } else if g.1 > 0 {
          (0, g.1 + 1, 0)
      } else {
          (0, 0, g.2 + 1)
      };
      aday >= g && aday < ust
  }

  pub fn en_yeni_uyumlu(g: (u64, u64, u64), yayimlananlar: &[(u64, u64, u64)]) -> Option<(u64, u64, u64)> {
      let mut en_iyi: Option<(u64, u64, u64)> = None;
      for s in yayimlananlar {
          let s = *s;
          if uyumlu_mu(g, s) {
              en_iyi = match en_iyi {
                  None => Some(s),
                  Some(e) => {
                      if s > e { Some(s) } else { Some(e) }
                  }
              };
          }
      }
      en_iyi
  }

  fn main() {
      let rand_surumleri = [(0, 8, 5), (0, 9, 0), (0, 10, 3), (0, 9, 2)];
      match en_yeni_uyumlu((0, 9, 0), &rand_surumleri) {
          Some(s) => println!("rand = \"0.9\" → {}.{}.{}", s.0, s.1, s.2),
          None => println!("rand = \"0.9\" → uyumlu sürüm yok"),
      }
  }
check: tests
tests: |
  #[test]
  fn bir_ve_ustu_major_sabit() {
      assert!(uyumlu_mu((1, 2, 3), (1, 2, 3)), "gereksinimin kendisi uyumludur");
      assert!(uyumlu_mu((1, 2, 3), (1, 9, 0)), "^1.2.3 → 1.9.0 uyumlu (MINOR artışı)");
      assert!(uyumlu_mu((1, 2, 3), (1, 2, 10)), "^1.2.3 → 1.2.10 uyumlu (PATCH artışı)");
      assert!(!uyumlu_mu((1, 2, 3), (1, 2, 2)), "^1.2.3 → 1.2.2 alt sınırın altında");
      assert!(!uyumlu_mu((1, 2, 3), (2, 0, 0)), "^1.2.3 → 2.0.0 kırıcı sürüm");
      assert!(!uyumlu_mu((1, 2, 3), (0, 9, 9)), "^1.2.3 → 0.9.9 çok eski");
  }

  #[test]
  fn sifir_x_surumlerinde_minor_sabit() {
      assert!(uyumlu_mu((0, 10, 0), (0, 10, 3)), "^0.10.0 → 0.10.3 uyumlu");
      assert!(!uyumlu_mu((0, 10, 0), (0, 11, 0)), "^0.10.0 → 0.11.0 kırıcı (0.x'te MINOR kırar)");
      assert!(!uyumlu_mu((0, 10, 3), (0, 10, 1)), "^0.10.3 → 0.10.1 alt sınırın altında");
      assert!(!uyumlu_mu((0, 10, 0), (1, 0, 0)), "^0.10.0 → 1.0.0 kırıcı");
  }

  #[test]
  fn sifir_sifir_x_tam_surum() {
      assert!(uyumlu_mu((0, 0, 3), (0, 0, 3)), "^0.0.3 → 0.0.3 uyumlu");
      assert!(!uyumlu_mu((0, 0, 3), (0, 0, 4)), "^0.0.3 → 0.0.4 kırıcı (0.0.x'te her sürüm kırar)");
      assert!(!uyumlu_mu((0, 0, 3), (0, 1, 0)), "^0.0.3 → 0.1.0 kırıcı");
  }

  #[test]
  fn en_yeni_uyumluyu_secer() {
      let regex = [(1, 8, 4), (1, 13, 1), (2, 0, 0), (1, 9, 0), (1, 10, 2)];
      assert_eq!(en_yeni_uyumlu((1, 9, 0), &regex), Some((1, 13, 1)), "\"1.9\" için 1.13.1 seçilmeli (liste sırasız)");
      let rand = [(0, 8, 5), (0, 9, 0), (0, 10, 3), (0, 9, 2)];
      assert_eq!(en_yeni_uyumlu((0, 9, 0), &rand), Some((0, 9, 2)), "\"0.9\" için 0.9.2 seçilmeli, 0.10.3 değil");
      assert_eq!(en_yeni_uyumlu((0, 11, 0), &rand), None, "\"0.11\" için uyumlu sürüm yok");
      assert_eq!(en_yeni_uyumlu((1, 0, 0), &[]), None, "boş listede sonuç None");
  }
hints:
  - |
    `uyumlu_mu`'yu iki adıma böl: önce gereksinime göre **hariç** üst sınırı hesapla, sonra
    `aday >= g && aday < ust` döndür. Tuple'lar soldan sağa karşılaştırılır.
  - |
    Üst sınır üç durumlu bir `if` ifadesi: `if g.0 > 0 { (g.0 + 1, 0, 0) } else if g.1 > 0 { (0, g.1 + 1, 0) } else { (0, 0, g.2 + 1) }`.
  - |
    `en_yeni_uyumlu`: `let mut en_iyi: Option<(u64, u64, u64)> = None;` ile başla. Her `s` için
    (`let s = *s;`) uyumluysa `en_iyi`'yi güncelle: `None` ise `Some(s)`, `Some(e)` ise `s > e` olduğunda
    `Some(s)`. Sonunda `en_iyi`'yi döndür.
explanation: |
  Çözümün kalbi tek bir fikir: her caret gereksinimi **yarı açık bir aralıktır**: `[g, ust)`. Üst sınır,
  sürümün ilk sıfır olmayan parçasının bir artırılmasıyla bulunur: `1.2.3 → 2.0.0`, `0.10.3 → 0.11.0`,
  `0.0.3 → 0.0.4`. Bu, "kırıcı değişikliği hangi parça bildirir?" tablosunun koda dökülmüş hâlidir.

  Tuple'ların sözlük sırasıyla karşılaştırılması işi çok kolaylaştırdı: `(1, 13, 1) > (1, 9, 0)` doğru
  çalışır. Sürümleri metin olarak tutsaydık `"1.13.1" < "1.9.0"` çıkardı (bkz. dersin başındaki tahmin
  sorusu).

  `en_yeni_uyumlu`'daki `match en_iyi { None => ..., Some(e) => ... }` Modül 7'deki `Option` kalıbıdır.
  Modül 14'te iterator'ları öğrendiğinde aynı işi tek satırda yazabileceksin:
  `yayimlananlar.iter().copied().filter(|&s| uyumlu_mu(g, s)).max()`.
  Gerçek Cargo bundan çok daha fazlasını yapar: bütün ağaç için aynı anda çözüm arar, ön sürümleri ve
  özellikleri hesaba katar. Ama her bağımlılık için temel soru aynıdır: "Aralıktaki en yeni sürüm hangisi?"
```

## Özet

:::remember
- Semver: `MAJOR.MINOR.PATCH`. PATCH = düzeltme, MINOR = uyumlu yenilik, MAJOR = **kırıcı değişiklik**.
- `0.y.z`'de kırıcı değişikliği MINOR bildirir (`0.9` → `0.10`); `0.0.z`'de her sürüm kırıcıdır.
- Rust'ta kırıcı: `pub` öğeyi silmek/yeniden adlandırmak, parametre eklemek, `pub` enum'a varyant eklemek
  (E0004), tamamen `pub` struct'a alan eklemek. Gizlilik, kütüphaneye kırmadan değişme özgürlüğü verir.
- `regex = "1.13"` bir **aralıktır**: varsayılan caret `>= 1.13.0, < 2.0.0`. `~` yalnızca PATCH, `=` tam
  sürüm. Cargo aralıktaki **en yeni** sürümü seçer.
- `Cargo.lock` tüm ağacın **tam** sürümlerini ve özetlerini kaydeder; derlemeler tekrarlanabilir olur.
  `cargo update` (gerekirse `-p crate`) ile bilinçli güncellenir, git'e eklenir, elle düzenlenmez.
- Özellikler: `features = ["derive"]`, `default-features = false`; toplanırlar. Kod tarafı
  `#[cfg(feature = "...")]`. `[dev-dependencies]` yalnızca test/örnek içindir.
:::

```reflect
prompt: |
  `Cargo.toml` ve `Cargo.lock` iki farklı soruya cevap verir. Bu iki soru nedir ve ikisine birden neden
  ihtiyaç var? Yalnızca `Cargo.toml` olsaydı (ya da yalnızca tam sürümler yazılsaydı) ne sorunlar çıkardı?
answer: |
  Model cevap: `Cargo.toml` "hangi sürümlerle **çalışabilirim**?" sorusunu bir aralıkla cevaplar;
  `Cargo.lock` ise "şu anda **tam olarak** hangi sürümlerle derliyorum?" sorusunu cevaplar. Yalnızca
  aralık olsaydı, aynı proje farklı günlerde ya da farklı bilgisayarlarda farklı sürümlerle derlenir ve
  "bende çalışıyordu" sorunları çıkardı. Yalnızca tam sürümler yazılsaydı ise (`=1.12.2`) hata
  düzeltmelerini almak için her şeyi elle güncellemem gerekir, iki kütüphane aynı crate'in biraz farklı
  tam sürümlerini istediğinde de Cargo onları tek bir sürümde birleştiremezdi. İkisi birlikte hem esneklik
  (uyumlu aralık) hem tekrarlanabilirlik (kilit) sağlar; güncelleme de `cargo update` ile bilinçli bir
  adım olur.
```

```flashcards
- front: "Semver'de `1.4.2` → `1.5.0` ve `1.4.2` → `2.0.0` geçişleri ne anlatır?"
  back: "`1.5.0`: uyumlu yeni özellik (MINOR). `2.0.0`: kırıcı değişiklik (MAJOR), kodun kırılabilir."
- front: "`0.x` sürümlerde kırıcı değişikliği hangi parça bildirir?"
  back: "MINOR: `0.9.x` → `0.10.0` kırıcıdır. `0.0.z`'de ise her sürüm kırıcıdır."
- front: "`Cargo.toml`'daki `regex = \"1.13\"` hangi sürümlere izin verir?"
  back: "Caret (varsayılan): `>= 1.13.0, < 2.0.0`. Cargo aralıktaki en yeni sürümü seçer."
- front: "`~1.2.3` ile `=1.2.3` gereksinimleri neye izin verir?"
  back: "`~1.2.3`: `>= 1.2.3, < 1.3.0` (yalnızca PATCH güncellemeleri). `=1.2.3`: yalnızca tam olarak `1.2.3`."
- front: "`pub` bir enum'a yeni varyant eklemek neden kırıcı bir değişikliktir?"
  back: "Kullanıcıların eksiksiz `match` ifadeleri artık bütün varyantları kapsamaz ve E0004 ile derlenmez."
- front: "`Cargo.lock` ne işe yarar?"
  back: Bağımlılık ağacının tamamındaki tam sürümleri ve özetleri (checksum) kaydeder; herkes aynı sürümlerle derler.
- front: "`Cargo.lock`'taki bir crate'i daha yeni uyumlu sürüme nasıl güncellersin?"
  back: "`cargo update -p crate_adi` (hepsi için `cargo update`). Aralığın dışına çıkmak için `Cargo.toml` değişmeli."
- front: "`[dev-dependencies]` bölümündeki crate'ler ne zaman kullanılır?"
  back: "Yalnızca test, örnek ve kıyaslama derlemelerinde; kütüphaneni kullananlar bunları indirmez."
```
