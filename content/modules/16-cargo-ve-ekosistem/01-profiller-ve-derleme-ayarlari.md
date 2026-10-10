---
id: m16-l01
title: Profiller ve Derleme Ayarları
minutes: 20
type: lesson
objectives:
  - "`[profile.dev]` ve `[profile.release]` tablolarıyla `opt-level`, `debug`, `lto`, `codegen-units`, `panic` ve `strip` ayarlarını değiştirip etkilerini açıklayabilmek"
  - "Taşma kontrollerinin (`overflow-checks`) ve `debug_assertions`'ın profile bağlı olduğunu bilip her iki profilde de aynı davranan kod yazabilmek"
  - "`inherits` ile özel bir profil tanımlayıp `cargo build --profile` ile kullanabilmek"
  - Binary boyutunu ve çalışma hızını tahmin etmek yerine ölçebilmek
keywords: [profile, profil, opt-level, lto, codegen-units, panic abort, strip, debug_assertions, overflow-checks, release]
---

Modül 1'de iki komut öğrendin: geliştirirken `cargo build`, dağıtırken `cargo build --release`. Peki
bu `--release` bayrağı perde arkasında tam olarak neyi değiştiriyor? Oyununun dağıtım dosyası neden
4 MB tutuyor da arkadaşınınki 400 KB? Neden aynı kod bir modda panikliyor, diğerinde sessizce yanlış
sonuç veriyor?

Bu soruların hepsinin cevabı tek bir kavramda: **derleme profili (build profile)**. Bu derste
Cargo'nun profillerini açıp içine bakacak, hız, boyut ve derleme süresi arasında **bilinçli** seçimler
yapmayı öğreneceksin.

## Profil: adı olan bir ayar paketi

Önce bildiklerini yokla. Rusteach kodunu Cargo'nun varsayılan geliştirme ayarlarıyla çalıştırır:

```predict
code: |
  fn main() {
      let indirim_orani = 0.25;
      debug_assert!(indirim_orani <= 1.0, "oran 1'i geçemez");
      println!("debug mi? {}", cfg!(debug_assertions));

      let mut kontrol_sayisi = 0;
      if cfg!(debug_assertions) {
          kontrol_sayisi += 1;
      }
      println!("ek kontrol: {kontrol_sayisi}");
  }
options:
  - |
    debug mi? true
    ek kontrol: 1
  - |
    debug mi? false
    ek kontrol: 0
  - |
    debug mi? true
    ek kontrol: 0
answer: 0
explanation: |
  Rusteach (ve `cargo run`) **dev** profiliyle derler; bu profilde `debug_assertions` açıktır. Bu
  yüzden `cfg!(debug_assertions)` `true` olur, `debug_assert!` denetimi çalışır (oran 0.25 olduğu için
  geçer) ve `if` bloğu da çalışır. Aynı program `cargo run --release` ile derlenseydi ikinci seçeneği
  yazardı: release profilinde `debug_assert!` satırları **hiç çalışmaz**; derleyici onları makine kodundan tamamen atar.
```

Bir **profil (profile)**, derleyiciye verilecek ayarların adı konmuş bir paketidir. Cargo'da hazır dört
profil vardır:

| Profil | Ne zaman kullanılır? | Çıktı klasörü |
|---|---|---|
| `dev` | `cargo build`, `cargo run`, `cargo check` | `target/debug/` |
| `release` | `--release` bayrağıyla | `target/release/` |
| `test` | `cargo test` (ayarlarını `dev`'den alır) | `target/debug/` |
| `bench` | `cargo bench` (ayarlarını `release`'den alır) | `target/release/` |

`dev` profilinin çıktısının `target/dev/` yerine `target/debug/` klasörüne gitmesi tarihsel bir
isimlendirmedir; şaşırma. Asıl önemli olan, iki ana profilin **farklı amaçlar** için ayarlanmış olması:

| Ayar | `dev` varsayılanı | `release` varsayılanı | Ne işe yarar? |
|---|---|---|---|
| `opt-level` | `0` | `3` | optimizasyon düzeyi |
| `debug` | `true` (tam) | `false` | hata ayıklama bilgisi |
| `debug-assertions` | `true` | `false` | `debug_assert!` ve `cfg!(debug_assertions)` |
| `overflow-checks` | `true` | `false` | tamsayı taşmasında panik |
| `incremental` | `true` | `false` | değişmeyen kısımları yeniden derlememe |
| `codegen-units` | `256` | `16` | crate'in kaç parçaya bölünerek derleneceği |
| `lto` | `false` | `false` | crate'ler arası optimizasyon |
| `panic` | `"unwind"` | `"unwind"` | panik stratejisi |

`dev` profili **derleme hızına** ve hata yakalamaya, `release` profili **çalışma hızına** odaklanır.
Geliştirirken kodu günde yüzlerce kez derlersin; her derlemenin saniyeler sürmesi önemlidir. Kullanıcı
ise programı bir kez indirir ve binlerce kez çalıştırır; orada da her milisaniye önemlidir.

Bir program hangi profille derlendiğini kendisi de söyleyebilir. Bunu Rusteach'te çalıştır, sonra kendi
bir Cargo projende `cargo run` ve `cargo run --release` ile karşılaştır:

```rust
fn main() {
    let profil = if cfg!(debug_assertions) {
        "dev: hata ayıklama ve ek kontroller açık"
    } else {
        "release: optimize edilmiş, ek kontroller kapalı"
    };
    println!("Derleme profili → {profil}");
}
```

:::analogy Prova ve gala gecesi
Tiyatro provasında ışıklar açıktır, yönetmen istediği an "dur!" der, oyuncuların yanında suflör vardır.
Yavaştır ama hata bulmak kolaydır: bu `dev` profilidir. Gala gecesinde ise suflör yoktur, sahne
değişimleri saniyeler içinde yapılır, her şey seyirci için optimize edilmiştir: bu da `release`. Aynı
oyun, iki farklı düzen.
:::

```quiz
question: "`cargo test` komutu hangi profilin ayarlarıyla derlenir?"
options:
  - "`release` — testler gerçekçi olsun diye"
  - "`test` profili; o da ayarlarını `dev`'den alır, yani taşma kontrolleri ve `debug_assert!` açıktır"
  - "`bench` profili"
  - Testler için profil kullanılmaz, her zaman `opt-level = 3` ile derlenir
answer: 1
explanation: |
  `cargo test`, `test` profilini kullanır ve bu profil `dev`'den **miras alır** (inherits). Bu yüzden
  testlerinde taşma panikleri ve `debug_assert!` denetimleri çalışır; bu iyi bir şeydir, testler
  hataları yakalamak içindir. İstersen `cargo test --release` ile testleri optimize edilmiş kodla da
  çalıştırabilirsin.
feedback:
  - Varsayılan bu değil; ama `cargo test --release` ile bunu açıkça isteyebilirsin.
  - Doğru!
  - "`bench` profili `cargo bench` içindir ve `release`'den miras alır."
  - Testler de bir profille derlenir; varsayılanı `dev`'e dayanır.
```

## [profile.*] tabloları ve opt-level

Bir profili değiştirmek için `Cargo.toml`'a o profilin tablosunu ekler ve **yalnızca değiştirmek
istediğin** ayarları yazarsın. Yazmadıkların varsayılan değerinde kalır:

```toml
[package]
name = "kahve-takip"
version = "0.1.0"
edition = "2024"

[profile.dev]
opt-level = 1          # geliştirirken de biraz optimizasyon

[profile.release]
debug = true           # profil aracında (profiler) fonksiyon adlarını görmek için
```

**`opt-level`** derleyicinin ne kadar çaba harcayacağını söyler:

| Değer | Anlamı |
|---|---|
| `0` | optimizasyon yok; en hızlı derleme, en kolay hata ayıklama |
| `1` | temel optimizasyonlar |
| `2` | çoğu optimizasyon |
| `3` | hepsi (release varsayılanı) |
| `"s"` | boyut için optimize et |
| `"z"` | boyut için daha da agresif optimize et (döngü vektörleştirmeyi de kapatır) |

Dikkat: `"s"` ve `"z"` **tırnak içinde** yazılır, çünkü TOML'da bunlar metindir (string); sayılar ise
tırnaksız yazılır. `opt-level = s` yazarsan Cargo `Cargo.toml`'u okuyamaz bile.

:::tip Ağır bağımlılıkları geliştirirken de hızlandır
Bir oyun ya da görüntü işleme projesinde `opt-level = 0` ile derlenen bağımlılıklar o kadar yavaş
çalışabilir ki uygulamayı test etmek bile işkenceye döner. Çözüm: yalnızca **bağımlılıkları** optimize
et, kendi kodunu hızlı derlenen hâlde bırak:

```toml
[profile.dev.package."*"]
opt-level = 3
```

`"*"` tüm bağımlılıklar demektir (senin kendi paketlerin hariç). Bağımlılıklar nadiren değiştiği için bu
ek derleme maliyeti bir kez ödenir.
:::

### Kendi profilini tanımlamak

Hazır dört profil yetmezse kendi profilini tanımlarsın. **`inherits`** zorunludur: yeni profilin
hangi profilden yola çıkacağını söyler.

```toml
[profile.release]
lto = "thin"

[profile.dagitim]
inherits = "release"
lto = true
codegen-units = 1
```

```console
$ cargo build --profile dagitim
    Finished `dagitim` profile [optimized] target(s) in 48.12s
```

```quiz
question: |
  Yukarıdaki `Cargo.toml` ile `cargo build --profile dagitim` çalıştırılıyor. Hangisi **doğrudur**?
options:
  - "`opt-level` `0` olur, çünkü `dagitim` profilinde `opt-level` yazılmamış"
  - "`opt-level` `3`, `lto` `true` olur ve çıktı `target/dagitim/` klasörüne yazılır"
  - "`lto` `\"thin\"` olur, çünkü `release`'deki değer her zaman kazanır"
  - "Çıktı `target/release/` klasörüne yazılır, çünkü profil `release`'den türetildi"
answer: 1
explanation: |
  `dagitim`, ayarlarını `release`'den miras alır: yazılmayan `opt-level` release'in `3` değeridir.
  Kendi tablosunda yazdığı `lto = true` ise miras aldığı `"thin"`'in **üzerine yazar**. Özel profillerin
  çıktısı kendi adını taşıyan klasöre gider: `target/dagitim/`.
feedback:
  - Yazılmayan ayar miras alınan profilden gelir, `release`'te de `opt-level = 3`'tür.
  - Doğru!
  - Tam tersi; alt profilde yazılan değer miras alınanı ezer.
  - Özel profiller kendi adlarıyla `target/` altında ayrı bir klasör kullanır.
```

:::warning Profiller yalnızca kök paketten okunur
Profil ayarları **senin** projenin (ya da Ders 3'te göreceğin workspace'in kök) `Cargo.toml`'unda
geçerlidir. Bir bağımlılığın kendi `Cargo.toml`'unda yazdığı `[profile.release]` tamamen yok sayılır.
Mantıklıdır: binary'nin nasıl derleneceğine onu üreten kişi karar verir, kullandığı kütüphaneler değil.
:::

## Taşma kontrolleri ve debug_assertions

Profiller yalnızca hızı değil, bazen **davranışı** da değiştirir. Modül 2'deki taşma metotlarını
hatırlıyor musun?

```predict
code: |
  fn main() {
      let koltuk: u8 = 200;
      println!("{:?}", koltuk.checked_add(100));
      println!("{}", koltuk.wrapping_add(100));
      println!("{}", koltuk.saturating_add(100));
  }
options:
  - |
    None
    44
    255
  - |
    Some(300)
    300
    255
  - |
    None
    255
    44
answer: 0
explanation: |
  `u8` en fazla 255 tutar. `checked_add` taşmayı `None` ile bildirir, `wrapping_add` başa sarar
  (300 − 256 = 44), `saturating_add` ise sınırda durur (255). Bu üç metot **her profilde aynı**
  davranır; çünkü taşma durumunda ne olacağını sen açıkça söylemişsindir.
```

Peki düz `+` operatörü taşarsa ne olur? İşte burada profil devreye girer:

```rust,should_panic
fn main() {
    // black_box, değeri derleyiciden "saklar"; yoksa derleyici taşmayı
    // derleme anında görüp programı hiç derlemezdi.
    let koltuk: u8 = std::hint::black_box(255);
    let yeni = koltuk + 1;
    println!("{yeni}");
}
```

`dev` profilinde `overflow-checks = true` olduğu için program `attempt to add with overflow` mesajıyla
panikler. `release` profilinde ise bu kontrol **kapalıdır**: aynı satır sessizce başa sarar ve `0`
yazdırır. Neden böyle bir tasarım? Çünkü her toplama işleminden sonra bir taşma kontrolü yapmak
sıkı döngülerde ölçülebilir bir yavaşlık yaratır. Rust bir uzlaşma seçti: geliştirirken hataları
yakala, dağıtırken hız kaybetme.

Release'teki davranışı Rusteach'te de görebilirsin; düz `+`'nın iki profildeki karşılığını açıkça
yazman yeterli:

```rust
fn main() {
    let koltuk: u8 = 255;
    // release profilinde düz `koltuk + 1` tam olarak bunu yapar:
    let release_sonucu = koltuk.wrapping_add(1);
    // dev profilinde aynı satır panikler; checked_add bunu panik olmadan gösterir:
    let dev_sonucu = koltuk.checked_add(1);
    println!("release'te: {release_sonucu}");
    println!("dev'de: {dev_sonucu:?} → panik");
}
```

Taşma Rust'ta **hiçbir zaman tanımsız davranış değildir**: ya panik
olur ya da iyi tanımlanmış biçimde başa sarar. C'de ise işaretli tamsayı taşması tanımsız davranıştır
(*undefined behavior*); derleyici "bu asla olmaz" varsayımıyla kodunu beklemediğin biçimde
optimize edebilir.

:::warning Release'te panik yok, hata var
"Testlerimde taşma olsa panik görürdüm" diye güvenme. Testlerin kapsamadığı bir girdi release'te
sessizce yanlış bir sayı üretir. Taşmanın **mümkün** olduğu her yerde niyetini açıkça yaz:
`checked_*` (hata olarak ele al), `saturating_*` (sınırda dur) ya da `wrapping_*` (başa sarma isteniyor).
İstersen release'te de kontrolleri açabilirsin:

```toml
[profile.release]
overflow-checks = true
```
:::

`debug_assert!` ailesi de (`debug_assert!`, `debug_assert_eq!`, `debug_assert_ne!`) profile bağlıdır:
`debug-assertions` kapalıysa bu satırlar **hiç çalışmaz**: kod yine tip denetiminden geçer ama derleyici onu makine kodundan tamamen atar, yani hiçbir maliyeti kalmaz. Pahalı ama faydalı iç tutarlılık
kontrolleri (örneğin "bu liste sıralı olmalı") için idealdir. Güvenlik için **şart** olan kontroller
ise her zaman `assert!` ya da `Result` ile yapılmalıdır.

Şimdi başa sarmanın **istendiği** bir duruma bakalım. Java'nın `String.hashCode()` metodu her harf için
`h = 31 * h + harf` hesaplar ve taşmayı bilerek yok sayar. Rust'ta aynı algoritmayı yazarken bu niyeti
açıkça belirtmelisin; yoksa `dev` profilinde panik alırsın:

```fill
prompt: Boşlukları doldurarak taşmada **her profilde** başa saran bir metin özeti (hash) fonksiyonu yaz.
code: |
  fn metin_ozeti(metin: &str) -> u32 {
      let mut h: u32 = 0;
      for b in metin.bytes() {
          h = h.___0(31).___1(b as u32);
      }
      h
  }

  fn main() {
      println!("{}", metin_ozeti("Cargo ve Ekosistem"));
  }
blanks:
  - ["wrapping_mul"]
  - ["wrapping_add"]
output: "1262244251"
explanation: |
  Bu algoritmada taşma bir hata değil, **tasarımın parçası**. `wrapping_mul` ve `wrapping_add`
  kullanarak hem okuyana niyetini anlatırsın hem de sonucun `dev` ve `release` profillerinde aynı
  olmasını garanti edersin. Düz `h * 31 + b` yazsaydın uzun metinlerde `dev` profili paniklerdi.
```

````exercise
id: m16-e-stok-tasma
title: Stok sayacındaki gizli hata
difficulty: 2
prompt: |
  Bir kırtasiye dükkânının stok programında iki fonksiyon var. Geliştirici bunları düz `-` ve `+`
  ile yazmış. Testlerde her şey yolundaymış, ama release sürümünde bir gün kasiyer stoktaki 3 defterden
  10 tane satınca ekranda **4 294 967 289 defter** görünmüş!

  Fonksiyonları her profilde doğru davranacak şekilde düzelt:

  - `stok_azalt(stok, adet)`: Yeterli stok varsa kalan stoğu `Some` içinde döndürür; `adet` stoktan
    fazlaysa `None` döndürür.
  - `toplam_tutar(fiyatlar)`: Kuruş cinsinden fiyatların toplamını `Some` içinde döndürür; toplam
    `u32`'ye sığmazsa `None` döndürür. Boş liste için toplam `Some(0)`'dır.
starter: |
  pub fn stok_azalt(stok: u32, adet: u32) -> Option<u32> {
      Some(stok - adet)
  }

  pub fn toplam_tutar(fiyatlar: &[u32]) -> Option<u32> {
      let mut toplam = 0;
      for f in fiyatlar {
          toplam += f;
      }
      Some(toplam)
  }

  fn main() {
      println!("{:?}", stok_azalt(10, 3));
      println!("{:?}", toplam_tutar(&[1250, 899, 4500]));
  }
solution: |
  pub fn stok_azalt(stok: u32, adet: u32) -> Option<u32> {
      stok.checked_sub(adet)
  }

  pub fn toplam_tutar(fiyatlar: &[u32]) -> Option<u32> {
      let mut toplam: u32 = 0;
      for &f in fiyatlar {
          toplam = toplam.checked_add(f)?;
      }
      Some(toplam)
  }

  fn main() {
      println!("{:?}", stok_azalt(10, 3));
      println!("{:?}", toplam_tutar(&[1250, 899, 4500]));
  }
check: tests
tests: |
  #[test]
  fn yeterli_stok_azalir() {
      assert_eq!(stok_azalt(10, 3), Some(7), "10 defterden 3'ü satılınca 7 kalır");
      assert_eq!(stok_azalt(5, 5), Some(0), "stoğun tamamı satılabilir, kalan 0 olur");
  }

  #[test]
  fn yetersiz_stokta_none() {
      assert_eq!(stok_azalt(3, 10), None, "3 defterden 10 tane satılamaz: None bekleniyordu (panik ya da başa sarma değil)");
      assert_eq!(stok_azalt(0, 1), None, "stok 0 iken satış yapılamaz");
  }

  #[test]
  fn toplam_dogru_hesaplanir() {
      assert_eq!(toplam_tutar(&[1250, 899, 4500]), Some(6649), "12,50 + 8,99 + 45,00 TL = 6649 kuruş");
      assert_eq!(toplam_tutar(&[]), Some(0), "boş sepetin tutarı 0'dır");
  }

  #[test]
  fn tasan_toplam_none() {
      assert_eq!(toplam_tutar(&[u32::MAX, 1]), None, "u32::MAX + 1 sığmaz: None bekleniyordu");
      assert_eq!(toplam_tutar(&[u32::MAX - 1, 1]), Some(u32::MAX), "tam sınırdaki toplam hâlâ geçerlidir");
  }
hints:
  - "Modül 2'deki taşma metotlarını hatırla: hangisi taşmayı bir `Option` ile bildiriyordu?"
  - "`stok.checked_sub(adet)` zaten `Option<u32>` döndürür. Toplamda da her adımda `checked_add` kullan."
  - "Döngüde `toplam = toplam.checked_add(f)?;` yazabilirsin: `?` operatörü `None` gelirse fonksiyondan hemen `None` ile çıkar (Modül 10)."
forbid:
  - pattern: "stok\\s*-\\s*adet"
    message: Düz `-` operatörü release'te başa sarar; taşmayı açıkça ele alan bir metot kullan.
explanation: |
  `checked_sub` ve `checked_add`, taşmayı **bir değer** olarak döndürür; davranışları `overflow-checks`
  ayarından bağımsızdır. Bu yüzden program `dev`'de de `release`'te de aynı sonucu verir.

  `toplam_tutar`'daki `?`, Modül 10'da `Result` için gördüğün operatörün `Option` versiyonudur: ilk
  taşmada fonksiyon `None` ile biter. Iterator'larla (Modül 14) aynı işi tek satırda da yazabilirsin:

  ```rust,ignore
  fiyatlar.iter().try_fold(0u32, |t, &f| t.checked_add(f))
  ```

  Başlangıç kodu neden testlerde "iyi" görünüyordu? Çünkü geliştiricinin testleri yalnızca yeterli
  stoğu deniyordu. Yetersiz stok testi `dev` profilinde **panik** verir (en azından hatayı fark
  edersin), `release`'te ise başa sarar. Sınır durumlarını test etmenin değeri burada ortaya çıkıyor.
````

## Boyut ve hız: lto, codegen-units, panic, strip

`opt-level` dışında, binary'nin hızını ve boyutunu etkileyen dört önemli ayar daha var.

**`codegen-units`**: Derleyici bir crate'i paralel derleyebilmek için parçalara (*code generation
unit*) böler. Çok parça, çok çekirdek kullanır ve hızlı derlenir; ama derleyici parçalar **arasında**
optimizasyon yapamaz (örneğin bir parçadaki fonksiyonu diğerine gömemez, yani *inline* edemez).
`codegen-units = 1` en iyi optimizasyonu verir, derlemeyi ise yavaşlatır.

**`lto`** (*link-time optimization*, bağlama zamanı optimizasyonu): Normalde her crate ayrı optimize
edilir; senin kodun `rand`'ın içindeki küçük bir fonksiyonu gömemez. LTO, bağlama aşamasında **tüm
crate'leri birlikte** optimize eder.

| `lto` değeri | Anlamı |
|---|---|
| `false` (varsayılan) | yalnızca aynı crate'in parçaları arasında hafif LTO |
| `"thin"` | tüm crate'ler arasında, paralel ve hızlı bir LTO; kazancın çoğunu verir |
| `true` ya da `"fat"` | tüm crate'ler tek parça hâlinde; en yavaş derleme, bazen biraz daha hızlı kod |
| `"off"` | LTO tamamen kapalı |

**`panic`**: Modül 10'da gördüğün gibi panik varsayılan olarak **geri sarma (unwinding)** yapar: stack
çerçeve çerçeve geriye sarılır ve sahip olunan her değer `drop` edilir. `panic = "abort"` ise
programı **anında** durdurur.

```memory
title: "Aynı panik, iki strateji"
steps:
  - caption: "Panikten hemen önce: `main` bir sepet `Vec`'i, `fis_yaz` bir `String` tutuyor. `kdv_hesapla` panikliyor."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<u32>", value: "ptr · len=3 · cap=3", to: h1 }
      - frame: fis_yaz
        vars:
          - { name: fis, type: String, value: "ptr · len=9 · cap=9", to: h2 }
      - frame: kdv_hesapla
        vars:
          - { name: oran, type: u32, value: "0", note: "100 / oran → 💥" }
    heap:
      - { id: h1, value: "[1250, 899, 4500]" }
      - { id: h2, value: "F i ş   N o : 7" }
  - caption: "`panic = \"unwind\"`: çerçeveler tek tek kapanır, `fis` ve `sepet` drop edilir; heap düzenli biçimde serbest kalır. Çıkış kodu 101."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<u32>", value: "drop edildi", moved: true }
    heap:
      - { id: h1, value: "[1250, 899, 4500]", freed: true }
      - { id: h2, value: "F i ş   N o : 7", freed: true }
  - caption: "`panic = \"abort\"`: hiçbir çerçeve sarılmaz, hiçbir `drop` çalışmaz. İşletim sistemi süreci öldürür ve belleği topluca geri alır."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<u32>", value: "ptr · len=3 · cap=3", note: "temizlenmedi" }
      - frame: fis_yaz
        vars:
          - { name: fis, type: String, value: "ptr · len=9 · cap=9", note: "temizlenmedi" }
      - frame: kdv_hesapla
        vars:
          - { name: oran, type: u32, value: "0" }
    heap:
      - { id: h1, value: "[1250, 899, 4500]", label: "süreç bitince OS geri alır" }
      - { id: h2, value: "F i ş   N o : 7", label: "süreç bitince OS geri alır" }
```

Neden biri `abort` seçsin? Geri sarabilmek için derleyici her fonksiyona "panik olursa buradan
temizle" tabloları (*landing pad*) ekler. `abort` bunları kaldırır: binary **küçülür**, kod biraz
**hızlanabilir**. Bedeli: panikte temizlik kodu çalışmaz (örneğin bir dosyanın tamponu diske
yazılmaz) ve panikleri yakalayıp kurtarmak imkânsızlaşır. Gömülü sistemler ve boyutun kritik olduğu
araçlar `abort`'u sık seçer. (`cargo test` bu ayarı yok sayar; test çatısı panikleri yakalayabilmek
için her zaman geri sarar.)

**`strip`**: Binary'den sembol adlarını ve hata ayıklama bilgisini siler: `"none"`, `"debuginfo"` ya da
`"symbols"` (`true` ile aynı). Release profili, sen `debug` istemediğin sürece hata ayıklama bilgisini
zaten varsayılan olarak siler.

Hepsini bir araya getiren, boyut odaklı tipik bir tarif:

```toml
[profile.release]
opt-level = "z"     # boyut için optimize et
lto = true          # crate'ler arası optimizasyon, ölü kodu at
codegen-units = 1   # tek parça: en iyi optimizasyon
panic = "abort"     # geri sarma tablolarını kaldır
strip = true        # sembolleri sil
```

:::info C ve C++ ile karşılaştırma
Bu ayarların hepsinin C/C++ derleyicilerinde karşılığı vardır: `-O0`…`-O3`, `-Os`, `-flto`, `-g`, `-s`.
Fark şu: C dünyasında bu bayraklar Makefile'lara, CMake betiklerine ve derleme sistemine göre değişen
yerlere dağılır. Cargo'da ise hepsi `Cargo.toml`'da, herkesin aynı biçimde okuduğu bildirimsel
(*declarative*) bir tabloda durur.
:::

Panik stratejisi de, tıpkı `debug_assertions` gibi, kodun içinden sorgulanabilir:

```predict
code: |
  fn main() {
      if cfg!(panic = "unwind") {
          println!("panikte stack geri sarılır");
      } else {
          println!("panikte süreç anında durur");
      }
      println!("taşma kontrolü örneği: {:?}", 250u8.checked_add(10));
  }
options:
  - |
    panikte stack geri sarılır
    taşma kontrolü örneği: None
  - |
    panikte süreç anında durur
    taşma kontrolü örneği: None
  - |
    panikte stack geri sarılır
    taşma kontrolü örneği: Some(4)
answer: 0
explanation: |
  Varsayılan strateji her iki profilde de `"unwind"`'dır, Rusteach da bunu değiştirmez; bu yüzden
  `cfg!(panic = "unwind")` `true` olur. `250 + 10 = 260` bir `u8`'e sığmadığı için `checked_add` `None`
  döndürür; `Some(4)` `wrapping_add`'in sonucu olurdu.
```

```quiz
question: "Bir CLI aracının binary'sini **küçültmek** istiyorsun. Aşağıdaki değişikliklerden hangisi bu amaca **hizmet etmez**?"
options:
  - "`opt-level = \"z\"`"
  - "`panic = \"abort\"`"
  - "`codegen-units = 256`"
  - "`strip = true`"
answer: 2
explanation: |
  `codegen-units`'i artırmak derlemeyi **paralel ve hızlı** yapar ama derleyicinin parçalar arası
  optimizasyon şansını azaltır; genellikle daha büyük ve daha yavaş kod çıkar. Boyut için tam tersi,
  `codegen-units = 1` önerilir. Diğer üçü boyutu doğrudan azaltır: boyut odaklı optimizasyon, geri
  sarma tablolarının kaldırılması ve sembollerin silinmesi.
feedback:
  - "`\"z\"` tam olarak boyut için optimizasyon demektir."
  - Geri sarma tabloları kalkar; binary küçülür.
  - Doğru! Çok parça hızlı derleme içindir, küçük binary için değil.
  - Semboller ve hata ayıklama bilgisi binary'nin büyük bir kısmını oluşturabilir.
```

## Tahmin etme, ölç

Profil ayarları birer **takas (trade-off)** olduğu için "en iyi ayar" diye bir şey yoktur; yalnızca
**senin programın için ölçülmüş** en iyi ayar vardır. `lto = true` bir projede %15 hız kazandırır,
başka bir projede hiçbir şey değiştirmez ama derlemeyi iki katına çıkarır.

**Boyutu ölçmek** en kolayıdır: dosyanın boyutuna bakarsın.

```console
PS C:\projeler\kahve-takip> cargo build --release
PS C:\projeler\kahve-takip> (Get-Item target\release\kahve-takip.exe).Length
$ ls -lh target/release/kahve-takip        # Linux/macOS
```

Boyutun nereden geldiğini görmek için `cargo bloat` gibi eklentiler (Ders 5) fonksiyon fonksiyon döküm
verir. **Derleme süresini** ölçmek için Cargo'nun kendi aracı var: `cargo build --release --timings`,
hangi crate'in ne kadar sürdüğünü gösteren bir HTML raporu üretir.

**Çalışma hızını** ölçmenin en basit yolu, standart kütüphanedeki `std::time::Instant`'tır:

```rust
use std::hint::black_box;
use std::time::Instant;

fn asal_say(sinir: u32) -> u32 {
    let mut adet = 0;
    for n in 2..sinir {
        let mut asal = true;
        let mut d = 2;
        while d * d <= n {
            if n % d == 0 {
                asal = false;
                break;
            }
            d += 1;
        }
        if asal {
            adet += 1;
        }
    }
    adet
}

fn main() {
    let baslangic = Instant::now();
    // black_box: derleyici sabit girdiyi görüp sonucu önceden hesaplamasın
    let adet = asal_say(black_box(20_000));
    let sure = baslangic.elapsed();
    println!("{adet} asal sayı bulundu, süre: {sure:?}");
}
```

Birkaç kez çalıştır: süre her seferinde biraz değişir. İşte ölçümün ilk dersi bu: **tek ölçüm
güvenilmezdir.** Ciddi karşılaştırmalar için `hyperfine` gibi araçlarla programı onlarca kez
çalıştırır ya da `criterion` crate'iyle istatistiksel kıyaslama (*benchmark*) yazarsın. İkinci ders
`black_box`: optimize eden derleyici çok zekidir; girdinin sabit olduğunu görürse sonucu **derleme
anında** hesaplayıp ölçtüğün döngüyü tamamen silebilir. Sonra "Rust inanılmaz hızlı, 0 ns!" diye
yanlış bir sonuca varırsın.

:::warning Debug'da ölçülen hız anlamsızdır
Bu örneği Rusteach'te çalıştırdığında `dev` profilindesin (`opt-level = 0`). Aynı kod `--release` ile
çoğu zaman **10-50 kat** daha hızlı çalışır. "Rust yavaşmış" demeden önce her zaman profili kontrol et.
:::

```quiz
question: "Bir arkadaşın `lto = true` ekledikten sonra programının hızlandığını söylüyor. Bunu nasıl doğrularsın?"
options:
  - Programı bir kez `cargo run` ile, bir kez `cargo run --release` ile çalıştırıp süreleri karşılaştırırım
  - "Her iki ayarla da `--release` derleyip, aynı girdiyle birçok kez çalıştırarak (örneğin `hyperfine` ile) süreleri karşılaştırırım"
  - "`lto = true` her zaman hızlandırır, ölçmeye gerek yoktur"
  - Binary boyutlarına bakarım; küçük olan daha hızlıdır
answer: 1
explanation: |
  Adil bir karşılaştırmada **yalnızca bir şey** değişmelidir: burada `lto`. İki ölçüm de aynı profil
  ailesinde, aynı girdiyle ve tekrarlanarak yapılmalıdır; çünkü tek bir ölçüm gürültülüdür. `dev` ile
  `release`'i karşılaştırmak `lto`'nun etkisini değil, onlarca ayarın toplam etkisini ölçer.
feedback:
  - Bu, `lto`'yu değil `dev` ile `release` arasındaki tüm farkları ölçer.
  - Doğru!
  - Hiçbir profil ayarı her programda kazanç garantisi vermez; ölç.
  - Boyut ve hız farklı şeylerdir; `opt-level = "z"` küçük ama daha yavaş kod üretebilir.
```

## Alıştırma: Profil ayarı denetçisi

`Cargo.toml`'da bir yazım hatası yaptığında Cargo seni uyarır; şimdi küçük bir denetçiyi sen yazacaksın.
Bu alıştırma Modül 7'deki `split_once`'ı, Modül 9'daki metin işlemlerini ve Modül 10'daki `Result`'ı
bir arada kullanıyor.

```exercise
id: m16-e-profil-denetcisi
title: Profil ayarı denetçisi
difficulty: 3
prompt: |
  `[profile.release]` tablosundan tek bir satırı denetleyen `ayar_dogrula(satir: &str)` fonksiyonunu
  yaz. Fonksiyon, geçerli bir satır için baştaki/sondaki boşlukları atılmış `(anahtar, deger)` çiftini
  `Ok` içinde döndürür; aksi hâlde uygun `AyarHatasi`'nı döndürür.

  Kurallar:

  1. Satırda `=` yoksa ya da `=`'in solu veya sağı (boşluklar atıldıktan sonra) boşsa →
     `AyarHatasi::BicimHatali`
  2. Yalnızca dört anahtar desteklenir. Başka bir anahtar → `AyarHatasi::BilinmeyenAnahtar(anahtar)`
  3. Geçerli değerler (TOML yazımıyla, metinler **çift tırnaklı**):

     | Anahtar | Geçerli değerler |
     |---|---|
     | `opt-level` | `0` `1` `2` `3` `"s"` `"z"` |
     | `panic` | `"unwind"` `"abort"` |
     | `lto` | `true` `false` `"thin"` `"fat"` `"off"` |
     | `codegen-units` | 1 veya daha büyük bir tamsayı |

     Geçersiz değer → `AyarHatasi::GecersizDeger { anahtar, deger }`

  Örnek: `"  lto =  \"thin\" "` → `Ok(("lto", "\"thin\""))`, `opt-level = s` → `GecersizDeger`
  (tırnak eksik!).
starter: |
  #[derive(Debug, PartialEq)]
  pub enum AyarHatasi {
      BicimHatali,
      BilinmeyenAnahtar(String),
      GecersizDeger { anahtar: String, deger: String },
  }

  pub fn ayar_dogrula(satir: &str) -> Result<(String, String), AyarHatasi> {
      todo!()
  }

  fn main() {
      for satir in ["opt-level = 3", "opt-level = s", "lto = \"thin\"", "boyut = 1", "panic"] {
          println!("{satir:<16} → {:?}", ayar_dogrula(satir));
      }
  }
solution: |
  #[derive(Debug, PartialEq)]
  pub enum AyarHatasi {
      BicimHatali,
      BilinmeyenAnahtar(String),
      GecersizDeger { anahtar: String, deger: String },
  }

  pub fn ayar_dogrula(satir: &str) -> Result<(String, String), AyarHatasi> {
      let Some((anahtar, deger)) = satir.split_once('=') else {
          return Err(AyarHatasi::BicimHatali);
      };
      let anahtar = anahtar.trim();
      let deger = deger.trim();
      if anahtar.is_empty() || deger.is_empty() {
          return Err(AyarHatasi::BicimHatali);
      }

      let gecerli = match anahtar {
          "opt-level" => matches!(deger, "0" | "1" | "2" | "3" | "\"s\"" | "\"z\""),
          "panic" => matches!(deger, "\"unwind\"" | "\"abort\""),
          "lto" => matches!(deger, "true" | "false" | "\"thin\"" | "\"fat\"" | "\"off\""),
          "codegen-units" => match deger.parse::<u32>() {
              Ok(n) => n >= 1,
              Err(_) => false,
          },
          _ => return Err(AyarHatasi::BilinmeyenAnahtar(anahtar.to_string())),
      };

      if gecerli {
          Ok((anahtar.to_string(), deger.to_string()))
      } else {
          Err(AyarHatasi::GecersizDeger {
              anahtar: anahtar.to_string(),
              deger: deger.to_string(),
          })
      }
  }

  fn main() {
      for satir in ["opt-level = 3", "opt-level = s", "lto = \"thin\"", "boyut = 1", "panic"] {
          println!("{satir:<16} → {:?}", ayar_dogrula(satir));
      }
  }
check: tests
tests: |
  fn ok(a: &str, d: &str) -> Result<(String, String), AyarHatasi> {
      Ok((a.to_string(), d.to_string()))
  }

  fn gecersiz(a: &str, d: &str) -> Result<(String, String), AyarHatasi> {
      Err(AyarHatasi::GecersizDeger { anahtar: a.to_string(), deger: d.to_string() })
  }

  #[test]
  fn gecerli_satirlar_kabul_edilir() {
      assert_eq!(ayar_dogrula("opt-level = 3"), ok("opt-level", "3"));
      assert_eq!(ayar_dogrula("opt-level = \"z\""), ok("opt-level", "\"z\""), "\"z\" geçerli bir opt-level");
      assert_eq!(ayar_dogrula("panic = \"abort\""), ok("panic", "\"abort\""));
      assert_eq!(ayar_dogrula("lto = true"), ok("lto", "true"));
      assert_eq!(ayar_dogrula("codegen-units = 16"), ok("codegen-units", "16"));
  }

  #[test]
  fn bosluklar_kirpilir() {
      assert_eq!(ayar_dogrula("   lto   =   \"thin\"  "), ok("lto", "\"thin\""), "anahtar ve değerin etrafındaki boşluklar atılmalı");
  }

  #[test]
  fn gecersiz_degerler_reddedilir() {
      assert_eq!(ayar_dogrula("opt-level = 4"), gecersiz("opt-level", "4"), "opt-level en fazla 3 olabilir");
      assert_eq!(ayar_dogrula("opt-level = s"), gecersiz("opt-level", "s"), "TOML'da metin tırnaksız yazılamaz");
      assert_eq!(ayar_dogrula("panic = \"stop\""), gecersiz("panic", "\"stop\""));
      assert_eq!(ayar_dogrula("codegen-units = 0"), gecersiz("codegen-units", "0"), "en az 1 parça gerekir");
      assert_eq!(ayar_dogrula("codegen-units = -2"), gecersiz("codegen-units", "-2"));
  }

  #[test]
  fn bilinmeyen_anahtar_ve_bicim_hatasi() {
      assert_eq!(ayar_dogrula("boyut = 1"), Err(AyarHatasi::BilinmeyenAnahtar("boyut".to_string())));
      assert_eq!(ayar_dogrula("opt-level 3"), Err(AyarHatasi::BicimHatali), "'=' olmayan satır biçim hatasıdır");
      assert_eq!(ayar_dogrula("lto = "), Err(AyarHatasi::BicimHatali), "değeri boş satır biçim hatasıdır");
      assert_eq!(ayar_dogrula(" = 3"), Err(AyarHatasi::BicimHatali), "anahtarı boş satır biçim hatasıdır");
  }
hints:
  - "Önce satırı `split_once('=')` ile ikiye böl (Modül 7). `None` gelirse biçim hatası var; `let ... else` burada çok işe yarar."
  - "Her iki parçayı `trim()` ile kırp ve boş olup olmadıklarını kontrol et. Sonra anahtar üzerinde `match` kur; bilinmeyen anahtarda `_` kolundan hemen `return Err(...)` yap."
  - "Değer listelerini `matches!(deger, \"0\" | \"1\" | ... | \"\\\"s\\\"\")` ile kontrol edebilirsin. Tırnaklı değerler Rust'ta `\"\\\"s\\\"\"` diye yazılır. `codegen-units` için `deger.parse::<u32>()` sonucunu `match` ile incele."
explanation: |
  Çözümün omurgası üç katmanlı bir denetim: **biçim** (`split_once` + `trim`), **anahtar**
  (`match`'in `_` kolu) ve **değer** (`matches!` ve `parse`). Her katman kendi hata varyantını üretir;
  böylece çağıran taraf "neden" reddedildiğini bilir. Modül 10'da kendi hata enum'unu tasarlarken
  gördüğün fikir tam olarak bu: her başarısızlık bir varyant, gereken bilgi de varyantın içinde veri.

  `"\"s\""` yazımı biraz göz yorar ama gerçeği yansıtır: TOML'da `opt-level = s` geçersizdir, çünkü
  metinler tırnak ister. Gerçek Cargo bu satırı gördüğünde `Cargo.toml`'u hiç okuyamaz ve hata verir.

  `codegen-units = -2` neden `GecersizDeger`? `"-2".parse::<u32>()` `Err` döndürür; işaretsiz bir tipe
  negatif sayı sığmaz. `n >= 1` kontrolü de `0`'ı eler. Alternatif olarak
  `deger.parse::<u32>().is_ok_and(|n| n >= 1)` tek satırda aynı işi yapar.
```

## Özet

:::remember
- **Profil**, adı konmuş bir derleme ayarları paketidir: `dev` (derleme hızı + hata yakalama) ve `release` (çalışma hızı).
- `Cargo.toml`'da `[profile.release]` gibi bir tabloya **yalnızca değiştirdiğin** ayarları yazarsın; gerisi varsayılan kalır.
- `opt-level`: `0`–`3`, boyut için `"s"`/`"z"`. `lto`, `codegen-units = 1`, `panic = "abort"` ve `strip` boyut ve hız için takaslardır.
- `overflow-checks` ve `debug-assertions` `release`'te kapalıdır: taşabilecek yerde `checked_*`/`wrapping_*`/`saturating_*` kullan.
- Özel profil: `[profile.ad]` + `inherits = "release"`, kullanımı `cargo build --profile ad`, çıktısı `target/ad/`.
- Profil ayarları yalnızca kök `Cargo.toml`'dan okunur. Hızı her zaman **release'te** ve **tekrarlayarak** ölç.
:::

```reflect
prompt: |
  Rust neden `release` profilinde taşma kontrollerini varsayılan olarak kapatıyor? Bu kararın bir
  programcı olarak sana yüklediği sorumluluk nedir?
answer: |
  Model cevap: Her aritmetik işlemden sonra taşma kontrolü yapmak, özellikle sıkı döngülerde ölçülebilir
  bir yavaşlık yaratır. Rust geliştirme sırasında (dev) hataları panikle yakalamayı, dağıtımda ise hızı
  seçer; taşma yine de tanımsız davranış değildir, iyi tanımlanmış biçimde başa sarar. Bu yüzden
  taşmanın mümkün olduğu yerlerde niyetimi açıkça yazmalıyım: hata olarak ele almak için `checked_*`,
  sınırda durmak için `saturating_*`, bilinçli başa sarma için `wrapping_*`. Gerekirse
  `overflow-checks = true` ile release'te de kontrolü açabilirim.
```

```flashcards
- front: "`cargo build` ve `cargo build --release` hangi profilleri kullanır, çıktıları hangi klasöre gider?"
  back: "`dev` → `target/debug/`, `release` → `target/release/`."
- front: "`opt-level` değerleri ve anlamları?"
  back: "`0` (yok), `1`, `2`, `3` (hepsi; release varsayılanı), `\"s\"` ve `\"z\"` (boyut için)."
- front: "Düz `x + 1` taştığında `dev` ve `release` profillerinde ne olur?"
  back: "`dev`'de panik (`attempt to add with overflow`); `release`'te sessizce başa sarar. Ayarın adı `overflow-checks`."
- front: "`codegen-units = 1` ne kazandırır, neye mal olur?"
  back: Parçalar arası optimizasyon mümkün olur (daha hızlı/küçük kod) ama derleme paralelliği kaybolur, derleme yavaşlar.
- front: "`lto` ne yapar? `\"thin\"` ile `true` farkı?"
  back: "Bağlama aşamasında tüm crate'leri birlikte optimize eder. `\"thin\"` paralel ve hızlıdır; `true`/`\"fat\"` tek parça, en yavaş derleme."
- front: "`panic = \"abort\"` seçmenin bir kazancı ve bir bedeli?"
  back: "Kazanç: geri sarma tabloları kalkar, binary küçülür. Bedel: panikte `drop`/temizlik çalışmaz, panik yakalanamaz."
- front: "Özel bir `dagitim` profili nasıl tanımlanır ve kullanılır?"
  back: "`[profile.dagitim]` + `inherits = \"release\"`; `cargo build --profile dagitim` → `target/dagitim/`."
- front: "`debug_assert!` release profilinde ne olur?"
  back: "Hiç çalışmaz; derleyici onu tamamen atar (`debug-assertions = false`). Güvenlik için şart olan kontrollerde `assert!` ya da `Result` kullan."
```
