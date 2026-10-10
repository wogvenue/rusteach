---
id: m25-l01
title: Ölç, Sonra Optimize Et
minutes: 24
type: lesson
objectives:
  - Amdahl yasasıyla bir optimizasyonun toplam süreye etkisini hesaplayabilmek
  - "`std::time::Instant` ve `std::hint::black_box` ile güvenilir bir mikro benchmark yazıp sonuçlarını medyanla özetleyebilmek"
  - criterion benchmark'ı ve flamegraph çıktısını okuyup darboğazı bulabilmek
  - Sabit çarpanlarla uğraşmadan önce algoritmik karmaşıklığı (O(n²) → O(n)) iyileştirebilmek
keywords: [performans, benchmark, Instant, black_box, criterion, flamegraph, profiling, release, Amdahl, karmaşıklık, inline, sıfır maliyet]
---

Elif'in kargo takip servisi yavaşlamış. Bir hafta boyunca JSON ayrıştırıcısını `unsafe` ile yeniden
yazıyor, her `clone`'u söküyor, `#[inline(always)]` serpiştiriyor... Sonuç: **%2** hızlanma. Sonra
bir profil aracı çalıştırıyor ve gerçeği görüyor: zamanın %85'i, bir döngünün içinde çağrılan
`Vec::contains`'te geçiyor. Üç satırlık bir `HashSet` değişikliği programı **40 kat** hızlandırıyor.

Bu modül Rust'ın "hızlı" ününü **bilinçli** kullanmayı öğretiyor. İlk kural basit ama çoğu programcı
onu zor yoldan öğrenir: **tahmin etme, ölç.**

:::ferris
Rust zaten hızlı bir dil; yani çoğu zaman yavaşlığın sebebi dil değil, seçtiğin algoritma ya da
ölçme biçimindir. Bu derste dedektif şapkanı takıyorsun! 🦀
:::

## Sezgi yalan söyler: önce ölç

Donald Knuth'un meşhur uyarısı, "erken optimizasyon her kötülüğün anasıdır" diye özetlenir.
Uyarının devamı daha az bilinir: programın küçük ama **kritik** bir kısmı için optimizasyon
gerçekten önemlidir. Sorun, o kritik kısmın neresi olduğunu **bilmememizdir**. Deneyimli
programcıların bile darboğaz tahminleri şaşırtıcı sıklıkta yanlış çıkar.

Bir programın süresi genellikle birkaç sıcak noktada (hot spot) toplanır. Bu yüzden şu soruyu
sormadan tek satır optimize etme: *"Bu kod toplam sürenin yüzde kaçını oluşturuyor?"*
Cevabı veren formül **Amdahl yasasıdır**: bir parçayı sonsuz hızlandırsan bile kazancın, o parçanın
toplam süredeki payıyla sınırlıdır.

:::analogy Market alışverişi
Market alışverişin 60 dakika sürüyor: 5 dakika yürüyüş, 10 dakika raflar, 45 dakika kasa kuyruğu.
Daha hızlı yürümek için koşu ayakkabısı alsan ve yürüyüşü yarıya indirsen bile 2,5 dakika
kazanırsın. Kuyruğun boş olduğu saate gitmek ise 40 dakika kazandırır. Önce **zamanın nereye
gittiğini** ölçen, doğru yere yatırım yapar.
:::

```quiz
question: |
  Bir rapor programı toplam **10 saniye** sürüyor. Ölçümlere göre `ayristir` fonksiyonu 1 s,
  `hesapla` fonksiyonu 6 s harcıyor. Hangi iyileştirme toplam süreyi **daha çok** kısaltır?
options:
  - "`ayristir`'ı 10 kat hızlandırmak"
  - "`hesapla`'yı 2 kat hızlandırmak"
  - İkisi de aynı kazancı sağlar
answer: 1
explanation: |
  Amdahl yasasıyla hesapla: `ayristir` 10 kat hızlanırsa 1 s → 0,1 s olur, toplam **9,1 s**.
  `hesapla` 2 kat hızlanırsa 6 s → 3 s olur, toplam **7 s**. Etkileyici görünen "10 kat"
  küçük bir paya uygulandığı için az kazandırır. Kural: önce **en büyük payı** bul.
feedback:
  - 10 kat kulağa hoş gelir ama 1 saniyelik bir parçadan en fazla 0,9 s kazanabilirsin.
  - Doğru! 3 saniye kazanç, 0,9 saniyeden çok daha fazla.
  - Kazanç = parçanın payı × hızlanma etkisi; paylar çok farklı olduğu için sonuçlar da farklı.
```

Ölçmeden optimize etmenin iki gizli maliyeti daha var: optimize edilmiş kod genellikle **daha zor
okunur** ve **daha çok hata** barındırır. Yani yanlış yere yapılan optimizasyon sadece boşa harcanan
zaman değil, aynı zamanda teknik borçtur.

## Doğru modda ölç: `--release`

Modül 16'da profilleri gördün: `cargo build` **dev** profilini (`opt-level = 0`), `cargo build
--release` ise **release** profilini (`opt-level = 3`) kullanır. Performans ölçerken bunun anlamı
çok nettir: **debug derlemesinde ölçülen süreler neredeyse hiçbir şey söylemez.**

Neden? Debug modunda derleyici kodunu olduğu gibi, satır satır makine koduna çevirir:

- Iterator zincirlerindeki her `map`, `filter`, closure çağrısı gerçek bir fonksiyon çağrısı olarak
  kalır; release'te bunlar **inline** edilip tek bir sıkı döngüye erir.
- Her tamsayı işleminde taşma kontrolü (`overflow-checks`) yapılır.
- Değişkenler register yerine bellekte tutulur ki hata ayıklayıcı onları gösterebilsin.

Sonuç olarak iterator ağırlıklı bir kod debug'da release'e göre 10-100 kat yavaş olabilir ve bu
oran koddan koda **değişir**. "A, B'den debug'da 2 kat hızlı" bilgisi release için hiçbir şey ifade
etmez; sıralama bile tersine dönebilir.

:::warning Rusteach'te süre ölçümü
Bu uygulamadaki **Çalıştır** düğmesi kodu dev profiliyle derler. Aşağıdaki örneklerde gördüğün
süreler kavramı göstermek içindir; gerçek kararlarını kendi bilgisayarında
`cargo run --release` (ya da `cargo bench`) ile verdiğin ölçümlere dayandır.
:::

```rust
use std::time::Instant;

fn main() {
    let sayilar: Vec<u64> = (1..=200_000).collect();

    let baslangic = Instant::now();
    let toplam: u64 = sayilar.iter().map(|x| x * x).filter(|x| x % 3 == 0).sum();
    let gecen = baslangic.elapsed();

    println!("toplam = {toplam}");
    println!("süre   = {gecen:?} (debug derlemesi — release'te çok daha hızlı!)");
}
```

```quiz
question: |
  Modül 2'yi hatırla. `let x: u8 = 255;` ile başlayan bir programda `x + 1` işlemi **çalışma
  zamanında** (derleyicinin önceden göremeyeceği bir şekilde) yapılıyor. Program
  `cargo run --release` ile derlenip çalıştırılırsa varsayılan ayarlarda ne olur?
options:
  - Program paniğe girer, tıpkı debug modunda olduğu gibi
  - Sonuç sessizce `0` olur (sarma / wrapping)
  - Sonuç otomatik olarak `256` olacak şekilde `u16`'ya genişletilir
answer: 1
explanation: |
  Release profilinde `overflow-checks` varsayılan olarak **kapalıdır**; taşma ikiye tümleyen
  aritmetiğiyle sarar ve `255 + 1` → `0` olur. Debug'da ise aynı işlem paniğe yol açar. Bu,
  "debug ve release aynı kodu farklı derler" gerçeğinin bir başka yüzü. Taşmanın her iki modda da
  aynı davranmasını istiyorsan `wrapping_add`, `checked_add` ya da `saturating_add` kullan.
feedback:
  - Panik debug'ın davranışıdır; release'te taşma kontrolleri varsayılan olarak kapalıdır.
  - Doğru! Release'te taşma sarar; bu yüzden niyetini `wrapping_*`/`checked_*` ile açıkça yaz.
  - Rust tipleri asla kendiliğinden genişletmez; `u8` her zaman `u8` kalır.
```

## `Instant` ve `black_box` ile mikro benchmark

En basit ölçüm aracı standart kütüphanede: `std::time::Instant` monoton (geriye gitmeyen) bir
saattir. `Instant::now()` bir an kaydeder, `.elapsed()` o andan bu yana geçen süreyi `Duration`
olarak verir. `Duration`'ı `{:?}` ile yazdırınca birimini kendisi seçer (`1.2ms`, `350µs`...).

Ama release modunda saf bir ölçüm seni kandırabilir. Optimize eden derleyici çok zekidir:

- Sonucu **hiç kullanılmayan** bir hesaplamayı tamamen siler (dead code elimination).
- Girdisi derleme zamanında **bilinen** bir hesabı derleme sırasında yapıp sabit gömer (constant
  folding). `1..=n` toplamını döngü yerine `n*(n+1)/2` formülüne bile çevirebilir!

Bu durumda "0 ns sürdü!" sonucunu görürsün; ölçtüğün şey koşmamıştır bile. Çözüm
`std::hint::black_box`: içine verdiğin değeri derleyiciye **opak** gösterir. Derleyici bu değerin
nereden geldiğini ya da nereye gittiğini bildiğini varsayamaz, bu yüzden hesaplamayı gerçekten
yapmak zorunda kalır.

```rust
use std::hint::black_box;
use std::time::Instant;

fn kareler_toplami(n: u64) -> u64 {
    (1..=n).map(|x| x * x).sum()
}

fn main() {
    const TEKRAR: u32 = 100;
    let mut sonuc = 0;

    let baslangic = Instant::now();
    for _ in 0..TEKRAR {
        // girdi black_box'tan geçiyor → derleme zamanında bilinemez
        // çıktı black_box'tan geçiyor → "kullanılmıyor" diye silinemez
        sonuc = black_box(kareler_toplami(black_box(10_000)));
    }
    let gecen = baslangic.elapsed();

    println!("sonuç = {sonuc}");
    println!("tekrar başına ≈ {:?}", gecen / TEKRAR);
}
```

Tek bir ölçüm de güvenilmezdir: işletim sistemi programını bir anlığına durdurabilir, işlemci
frekansı değişebilir, ilk çalıştırmada önbellek soğuktur. İyi bir mikro benchmark şunları yapar:

1. **Isınma (warm-up)**: ölçmeden önce kodu birkaç kez çalıştırır.
2. **Tekrar**: ölçümü çok kez yapar.
3. **Sağlam özet**: ortalama yerine **medyan** ya da **en iyi** süreyi raporlar; tek bir aykırı
   değer (örneğin 500 ms'lik bir kesinti) ortalamayı mahveder ama medyanı neredeyse etkilemez.
4. Ölçülen bölgeye `println!` gibi yavaş, alakasız işler **koymaz**.

```fill
prompt: |
  Boşlukları doldurarak `ters_cevir` fonksiyonunun süresini ölçen ve derleyicinin hesabı
  silmesini engelleyen kodu tamamla.
code: |
  use std::hint::black_box;
  use std::time::Instant;

  fn ters_cevir(s: &str) -> String {
      s.chars().rev().collect()
  }

  fn main() {
      let metin = "Kış güneşi Kaş'ta bir başka".repeat(100);
      let baslangic = Instant::___0;
      let mut uzunluk = 0;
      for _ in 0..50 {
          let sonuc = ___1(ters_cevir(black_box(&metin)));
          uzunluk = sonuc.len();
      }
      let gecen = baslangic.___2;
      println!("{uzunluk} bayt");
      let _ = gecen;
  }
blanks:
  - ["now()"]
  - ["black_box"]
  - ["elapsed()"]
output: "3300 bayt"
explanation: |
  `Instant::now()` başlangıç anını alır, `.elapsed()` geçen süreyi `Duration` olarak döndürür.
  Sonucu `black_box`'tan geçirmek, optimize eden derleyicinin "bu `String` aslında gerekmiyor"
  diyerek işi silmesini engeller. (Bayt sayısı neden 3300 ve 2700 değil? Metinde 27 karakter var ama
  `ı`, `ş`, `ü` gibi harfler UTF-8'de 2 bayt tutar: altı Türkçe harf × 1 fazladan bayt → tek tekrar
  33 bayt, 100 tekrar 3300 bayt.)
```

Şimdi sıra sende: gerçek bir benchmark aracının yapacağı gibi, toplanan ölçümleri özetle.

```exercise
id: m25-e-olcum-ozeti
title: Ölçüm özetleyici
difficulty: 3
prompt: |
  Bir benchmark aracı yazıyorsun. Aynı kod birçok kez ölçülmüş ve süreler bir dilimde duruyor.
  `ozetle` fonksiyonunu tamamla:

  - Dilim boşsa `None` döndür.
  - Değilse `Some(Ozet { en_iyi, medyan, ortalama })` döndür.
  - **en_iyi**: en küçük süre.
  - **medyan**: süreler sıralandığında ortadaki değer. Eleman sayısı **çiftse** ortadaki iki
    değerin ortalaması.
  - **ortalama**: toplam / adet.

  İpucu: `Duration` `Ord` uygular (sıralanabilir), `+` ve `/ u32` destekler, ve bir iterator
  `sum::<Duration>()` ile toplanabilir.
starter: |
  use std::time::Duration;

  #[derive(Debug, PartialEq)]
  struct Ozet {
      en_iyi: Duration,
      medyan: Duration,
      ortalama: Duration,
  }

  fn ozetle(olcumler: &[Duration]) -> Option<Ozet> {
      todo!()
  }

  fn main() {
      let ms = Duration::from_millis;
      let olcumler = [ms(12), ms(10), ms(11), ms(250), ms(10)];
      println!("{:?}", ozetle(&olcumler));
  }
solution: |
  use std::time::Duration;

  #[derive(Debug, PartialEq)]
  struct Ozet {
      en_iyi: Duration,
      medyan: Duration,
      ortalama: Duration,
  }

  fn ozetle(olcumler: &[Duration]) -> Option<Ozet> {
      if olcumler.is_empty() {
          return None;
      }
      let mut sirali = olcumler.to_vec();
      sirali.sort_unstable();

      let n = sirali.len();
      let medyan = if n % 2 == 1 {
          sirali[n / 2]
      } else {
          (sirali[n / 2 - 1] + sirali[n / 2]) / 2
      };
      let toplam: Duration = sirali.iter().sum();

      Some(Ozet {
          en_iyi: sirali[0],
          medyan,
          ortalama: toplam / n as u32,
      })
  }

  fn main() {
      let ms = Duration::from_millis;
      let olcumler = [ms(12), ms(10), ms(11), ms(250), ms(10)];
      println!("{:?}", ozetle(&olcumler));
  }
check: tests
tests: |
  fn ms(x: u64) -> Duration {
      Duration::from_millis(x)
  }

  #[test]
  fn tek_sayida_olcum() {
      let o = ozetle(&[ms(5), ms(1), ms(3)]).expect("boş olmayan dilim Some vermeli");
      assert_eq!(o.en_iyi, ms(1), "en iyi süre en küçük olandır");
      assert_eq!(o.medyan, ms(3), "sıralı [1, 3, 5] dizisinin ortası 3'tür");
      assert_eq!(o.ortalama, ms(3), "(5 + 1 + 3) / 3 = 3");
  }

  #[test]
  fn cift_sayida_olcumde_medyan_ortadaki_ikisinin_ortalamasi() {
      let o = ozetle(&[ms(4), ms(1), ms(3), ms(2)]).unwrap();
      assert_eq!(o.medyan, Duration::from_micros(2500), "sıralı [1, 2, 3, 4] → (2 + 3) / 2 = 2,5 ms");
      assert_eq!(o.ortalama, Duration::from_micros(2500), "(4 + 1 + 3 + 2) / 4 = 2,5 ms");
  }

  #[test]
  fn aykiri_deger_medyani_bozmaz() {
      let o = ozetle(&[ms(10), ms(10), ms(500), ms(10), ms(10)]).unwrap();
      assert_eq!(o.medyan, ms(10), "tek bir 500 ms'lik kesinti medyanı değiştirmemeli");
      assert_eq!(o.ortalama, ms(108), "ortalama ise aykırı değerden çok etkilenir: 540 / 5 = 108");
      assert_eq!(o.en_iyi, ms(10));
  }

  #[test]
  fn bos_dilim_none() {
      assert_eq!(ozetle(&[]), None, "hiç ölçüm yoksa özet de yoktur");
  }

  #[test]
  fn tek_olcum() {
      let o = ozetle(&[ms(7)]).unwrap();
      assert_eq!(o, Ozet { en_iyi: ms(7), medyan: ms(7), ortalama: ms(7) });
  }
hints:
  - "Önce boş dilimi ele al: `if olcumler.is_empty() { return None; }`. Sonra sıralamak için bir kopya al: `let mut sirali = olcumler.to_vec();`."
  - "`sirali.sort_unstable()` sonrasında en iyi süre `sirali[0]`'dır. Ortadaki indeks `n / 2`; çift sayıda elemanda ortadakiler `n / 2 - 1` ve `n / 2`'dir."
  - "Ortalama için `let toplam: Duration = sirali.iter().sum();` ve `toplam / n as u32`. Çift durumda medyan: `(sirali[n / 2 - 1] + sirali[n / 2]) / 2`."
explanation: |
  Parametre `&[Duration]` olduğu için çağıranın verisini değiştiremeyiz; sıralamak için
  `to_vec()` ile bir kopya alıyoruz. `Duration` `Copy` olduğundan `sirali[0]` gibi indekslemeler
  değeri kopyalar, ödünç alma sorunu çıkmaz. `sort_unstable` burada idealdir: eşit süreler arasında
  sıra korumaya ihtiyacımız yok ve ek bellek tahsis etmez.

  Testlerdeki "aykırı değer" senaryosu bu dersin özüdür: ortalama 108 ms derken medyan 10 ms
  diyor; kodun gerçek hızı 10 ms'dir, 500 ms'lik ölçüm bir işletim sistemi kesintisidir. criterion
  gibi araçlar bu yüzden ortalamanın yanında sağlam istatistikler ve aykırı değer analizi verir.

  Alternatif: en iyi süre için sıralamadan `olcumler.iter().min()` kullanılabilirdi; ama medyan
  için zaten sıralama gerektiğinden tek sıralama ile hepsini almak daha derli topludur.
```

## criterion ve profil araçları

Elle yazdığın `Instant` döngüsü fikir vermek için iyidir, ama ciddi karşılaştırmalar için
topluluğun standardı **criterion** crate'idir. criterion senin yerine ısınma yapar, ölçüm sayısını
otomatik ayarlar, istatistiksel analiz yapar ve bir önceki çalıştırmayla **karşılaştırır**.

```toml
# Cargo.toml
[dev-dependencies]
criterion = "0.5"   # güncel sürümü crates.io'dan kontrol et

[[bench]]
name = "siralama"
harness = false     # Rust'ın yerleşik bench altyapısı yerine criterion'ın main'i kullanılsın
```

```rust,ignore,title=benches/siralama.rs
use criterion::{Criterion, criterion_group, criterion_main};
use std::hint::black_box;

fn siralama_benchmark(c: &mut Criterion) {
    let veri: Vec<u32> = (0..1_000).rev().collect();

    c.bench_function("sort_unstable 1000", |b| {
        b.iter(|| {
            let mut v = black_box(veri.clone());
            v.sort_unstable();
            v
        })
    });
}

criterion_group!(benches, siralama_benchmark);
criterion_main!(benches);
```

`cargo bench` komutu (Modül 16: `bench` profili ayarlarını `release`'ten alır) şuna benzer bir
çıktı verir:

```text
sort_unstable 1000      time:   [3.1021 µs 3.1187 µs 3.1370 µs]
                        change: [-2.1432% -1.0510% +0.0911%] (p = 0.07 > 0.05)
                        No change in performance detected.
```

Köşeli parantezdeki üç sayı **[alt sınır, en iyi tahmin, üst sınır]** biçiminde bir güven
aralığıdır. `change` satırı önceki çalıştırmaya göre farkı söyler; `p > 0.05` ise farkın gürültü
olabileceğini, yani "gerçek bir değişiklik tespit edilmediğini" belirtir.

:::info Neden `rust,ignore`?
criterion, Rusteach'in çevrim içi çalıştırıcısında bulunmayan bir crate'tir ve `cargo bench`
gerektirir. Bu kodu kendi projende `benches/` klasörüne koyarak çalıştırmalısın.
:::

**Benchmark** "bu kod ne kadar sürüyor?" sorusunu cevaplar. **Profil çıkarma (profiling)** ise
"zaman **nereye** gidiyor?" sorusunu. Örnekleyen (sampling) bir profilci programı çalışırken
saniyede binlerce kez durdurup o an hangi fonksiyonların çağrı yığınında (call stack) olduğunu kaydeder.

| Araç | Platform | Not |
|---|---|---|
| `perf record` / `perf report` | Linux | çekirdek düzeyinde örnekleme |
| `cargo flamegraph` | Linux, macOS (Windows desteği sınırlı) | `cargo install flamegraph`, sonuç bir SVG |
| samply | Linux, macOS, Windows | Firefox Profiler arayüzünde gösterir |
| Visual Studio Profiler / Intel VTune | Windows | grafik arayüzlü |

Profilcinin fonksiyon isimlerini gösterebilmesi için release derlemesinde hata ayıklama sembolleri
gerekir. Modül 16'daki `inherits` hilesi burada çok işe yarar:

```toml
[profile.profiling]
inherits = "release"
debug = true          # optimize edilmiş ama sembollü
```

Bir **flamegraph** şöyle okunur: her kutu bir fonksiyondur, üstündeki kutular onun çağırdığı
fonksiyonlardır, kutunun **genişliği** o fonksiyonda (ve çağırdıklarında) geçen örnek sayısıyla
orantılıdır.

```text
[            main                                              ]
[  rapor_uret                                ][ dosya_oku      ]
[ ayristir ][   tekrar_eden_bul              ]
            [  <Vec<T>>::contains           ]
```

```quiz
question: |
  Yukarıdaki flamegraph'a bakan bir arkadaşın şöyle diyor: "`ayristir` en solda, demek ki önce o
  çalışıyor ve en uzun o sürüyor." Doğru yorum hangisi?
options:
  - "Arkadaşın haklı: x ekseni zamanı gösterir, soldaki kutular önce çalışır"
  - "Yatay sıra zamanı göstermez (kutular genelde alfabetik dizilir); önemli olan **genişliktir** ve en geniş yaprak `Vec::contains`"
  - "En **yüksekteki** kutu en çok zaman harcayandır, yani `Vec::contains` en üstte olduğu için yavaştır"
answer: 1
explanation: |
  Flamegraph bir zaman çizelgesi değildir: aynı çağrı yığınından gelen örnekler birleştirilir ve
  kutular soldan sağa genellikle alfabetik sıralanır. **Genişlik** = o fonksiyonda geçirilen sürenin
  payı. Burada `tekrar_eden_bul` içindeki `Vec::contains` geniş bir "plato" oluşturuyor; asıl
  darboğaz orası. Yükseklik yalnızca çağrı derinliğidir; yüksek ama dar bir kutu önemsiz olabilir.
feedback:
  - Bu, flamegraph'ı okurken en sık yapılan hatadır. X ekseni zaman değildir.
  - Doğru! Geniş platolar ara; özellikle en üstteki geniş kutular, zamanın gerçekten harcandığı yerdir.
  - Yükseklik çağrı derinliğidir. Belirleyici olan genişliktir; `contains` yüksekte olduğu için değil, geniş olduğu için önemli.
```

## Önce algoritma: karmaşıklık her şeyi yener

Profilci Elif'e `Vec::contains`'i gösterdi. Neden bu kadar pahalı? Çünkü `contains` dizinin
başından sonuna **doğrusal arama** yapar: O(n). Bir döngü içinde çağrılınca toplam maliyet
**O(n²)** olur. Önce tahmin et:

```predict
question: Bu program kaç karşılaştırma yapıldığını yazdırıyor. Çıktı ne olur?
code: |
  fn main() {
      let n = 1000;
      let mut karsilastirma = 0u64;
      for i in 0..n {
          for j in (i + 1)..n {
              karsilastirma += 1;
              let _ayni = i == j;
          }
      }
      println!("{karsilastirma}");
  }
options:
  - "1000"
  - "499500"
  - "1000000"
answer: 1
explanation: |
  Her `i` için `j` döngüsü `n - i - 1` kez döner: 999 + 998 + ... + 0 = n·(n−1)/2 = **499 500**.
  "Her elemanı diğerleriyle karşılaştır" yaklaşımı O(n²)'dir: n 10 katına çıkınca iş **100 katına**
  çıkar. 1 000 eleman için yarım milyon işlem önemsiz görünebilir; 1 000 000 eleman için ~500 milyar
  işlem demektir ve hiçbir mikro optimizasyon bunu kurtaramaz.
```

Modül 9'daki `HashSet` ile aynı soruyu her eleman için ortalama **O(1)**'de cevaplayabiliriz:

```rust
use std::collections::HashSet;

// O(n²): her eleman için listenin geri kalanını tara
fn tekrar_var_mi_yavas(kodlar: &[u32]) -> bool {
    for (i, k) in kodlar.iter().enumerate() {
        if kodlar[i + 1..].contains(k) {
            return true;
        }
    }
    false
}

// O(n): görülenleri bir HashSet'te tut
fn tekrar_var_mi_hizli(kodlar: &[u32]) -> bool {
    let mut gorulen = HashSet::with_capacity(kodlar.len());
    for k in kodlar {
        if !gorulen.insert(k) {
            return true; // insert false döndürdü → zaten vardı
        }
    }
    false
}

fn main() {
    let kargolar: Vec<u32> = (0..5_000).collect();
    println!("{} {}", tekrar_var_mi_yavas(&kargolar), tekrar_var_mi_hizli(&kargolar));
    let mut tekrarli = kargolar.clone();
    tekrarli.push(42);
    println!("{} {}", tekrar_var_mi_yavas(&tekrarli), tekrar_var_mi_hizli(&tekrarli));
}
```

`HashSet::insert` değer zaten varsa `false` döndürür; bu tek çağrı hem "var mı?" sorusunu hem de
ekleme işini yapar. Bu tür "veri yapısını değiştir" kazançları genellikle **katlarca** hızlanma
getirir; derleyici seviyesindeki ince ayarlar ise çoğu zaman yüzdelerle ölçülür. Optimizasyon
sırası her zaman aynıdır:

1. **Doğru algoritma ve veri yapısı** (O(n²) → O(n log n) → O(n))
2. **Gereksiz işi kaldırmak** (aynı şeyi tekrar tekrar hesaplamamak, gereksiz tahsisler — sonraki ders)
3. **Sabit çarpanlar** (önbellek dostu veri düzeni, dallanmayı azaltmak, en son `unsafe`)

```exercise
id: m25-e-ortak-ogrenciler
title: İki kursun ortak öğrencileri
difficulty: 3
prompt: |
  Bir dil kursunun yönetim panelindesin. İki kursun kayıt listesi var ve **her iki kursa da**
  kayıtlı öğrencileri bulman gerekiyor. Mevcut kod her öğrenci için diğer listeyi baştan sona
  tarıyor (O(n·m)) ve büyük kurslarda panel donuyor.

  `ortak_ogrenciler` fonksiyonunu `HashSet` kullanarak O(n + m) sürede çalışacak şekilde yaz:

  - Sonuç, öğrencileri **`kurs_a`'daki sırayla** içermeli.
  - `kurs_a`'da aynı isim birden fazla geçse bile sonuçta **bir kez** yer almalı.
  - Dönüş tipi, `kurs_a`'daki dilimleri ödünç alan `Vec<&'a str>` (Modül 12'deki yaşam süreleri!).
starter: |
  use std::collections::HashSet;

  fn ortak_ogrenciler<'a>(kurs_a: &[&'a str], kurs_b: &[&str]) -> Vec<&'a str> {
      todo!()
  }

  fn main() {
      let ingilizce = ["Ayşe", "Mehmet", "Zeynep", "Can"];
      let almanca = ["Can", "Elif", "Ayşe"];
      println!("{:?}", ortak_ogrenciler(&ingilizce, &almanca));
  }
solution: |
  use std::collections::HashSet;

  fn ortak_ogrenciler<'a>(kurs_a: &[&'a str], kurs_b: &[&str]) -> Vec<&'a str> {
      let b_kumesi: HashSet<&str> = kurs_b.iter().copied().collect();
      let mut eklenen = HashSet::new();
      let mut sonuc = Vec::new();
      for &ad in kurs_a {
          if b_kumesi.contains(ad) && eklenen.insert(ad) {
              sonuc.push(ad);
          }
      }
      sonuc
  }

  fn main() {
      let ingilizce = ["Ayşe", "Mehmet", "Zeynep", "Can"];
      let almanca = ["Can", "Elif", "Ayşe"];
      println!("{:?}", ortak_ogrenciler(&ingilizce, &almanca));
  }
check: tests
tests: |
  #[test]
  fn kurs_a_sirasini_korur() {
      let a = ["Ayşe", "Mehmet", "Zeynep", "Can"];
      let b = ["Can", "Elif", "Ayşe"];
      assert_eq!(ortak_ogrenciler(&a, &b), vec!["Ayşe", "Can"], "sıra kurs_a'daki gibi olmalı: önce Ayşe, sonra Can");
  }

  #[test]
  fn tekrar_eden_isim_bir_kez_gelir() {
      let a = ["Can", "Can", "Ece", "Can"];
      let b = ["Can", "Ece"];
      assert_eq!(ortak_ogrenciler(&a, &b), vec!["Can", "Ece"], "Can kurs_a'da üç kez geçse de sonuçta bir kez olmalı");
  }

  #[test]
  fn ortak_yoksa_bos() {
      assert!(ortak_ogrenciler(&["Ali"], &["Veli"]).is_empty(), "ortak öğrenci yoksa boş Vec");
      assert!(ortak_ogrenciler(&[], &["Veli"]).is_empty(), "kurs_a boşsa sonuç boş");
      assert!(ortak_ogrenciler(&["Ali"], &[]).is_empty(), "kurs_b boşsa sonuç boş");
  }

  #[test]
  fn buyuk_kurslar() {
      let a_isimler: Vec<String> = (0..20_000).map(|i| format!("ogr{i}")).collect();
      let b_isimler: Vec<String> = (10_000..30_000).map(|i| format!("ogr{i}")).collect();
      let a: Vec<&str> = a_isimler.iter().map(|s| s.as_str()).collect();
      let b: Vec<&str> = b_isimler.iter().map(|s| s.as_str()).collect();
      let sonuc = ortak_ogrenciler(&a, &b);
      assert_eq!(sonuc.len(), 10_000, "ogr10000..ogr19999 arası 10 000 ortak öğrenci var");
      assert_eq!(sonuc[0], "ogr10000");
      assert_eq!(sonuc[9_999], "ogr19999");
  }
hints:
  - "`kurs_b`'yi bir kez `HashSet`'e çevir: `let b_kumesi: HashSet<&str> = kurs_b.iter().copied().collect();`. Böylece her sorgu O(1) olur."
  - "Sırayı korumak için `kurs_a` üzerinde dön (`for &ad in kurs_a`). Aynı ismi iki kez eklememek için ikinci bir `HashSet` (`eklenen`) tut."
  - "`HashSet::insert` yeni bir eleman eklediğinde `true` döndürür: `if b_kumesi.contains(ad) && eklenen.insert(ad) { sonuc.push(ad); }`"
require:
  - pattern: "HashSet"
    message: Bu alıştırmanın amacı O(n·m) aramayı `HashSet` ile O(n + m)'e indirmek.
explanation: |
  `kurs_b` bir kez kümeye çevrilir (O(m)), sonra `kurs_a`'nın her elemanı için O(1) ortalama
  sürede sorgulanır (O(n)). Toplam O(n + m). 20 000 × 20 000'lik testte naif yöntem 400 milyon
  karşılaştırma yapardı; küme yöntemi yaklaşık 40 000 işlem yapar.

  `&&` kısa devre yapar: `b_kumesi.contains(ad)` `false` ise `eklenen.insert(ad)` hiç çağrılmaz,
  yani yalnızca ortak isimler `eklenen`'e girer. Yaşam süresi `'a`, sonuçtaki `&str`'lerin
  `kurs_a`'nın elemanlarından geldiğini derleyiciye anlatır; `kurs_b`'nin verisini ödünç almadığımız
  için onun yaşam süresi sonuca bağlanmaz.

  Alternatif: sıra önemli olmasaydı iki kümenin `intersection` metodu tek satırda iş görürdü.
  Sıra önemli olduğu için "küme ile sorgula, `Vec` ile sırayı koru" deseni kullanılır.
```

## Sıfır maliyetli soyutlamalar ve inlining

Rust'ın performans felsefesi C++'tan miras bir ilkeye dayanır: **sıfır maliyetli soyutlama
(zero-cost abstraction)**. Bjarne Stroustrup'un tanımını özetlersek: *kullanmadığın özelliğin
bedelini ödemezsin; kullandığını da elle daha iyi yazamazdın.*

Bunun Rust'taki somut örneklerini zaten biliyorsun:

| Soyutlama | Neden bedava? |
|---|---|
| Iterator zincirleri (Modül 14) | release'te inline edilip elle yazılmış döngüyle aynı makine koduna dönüşür; çoğu zaman sınır kontrolleri de kalkar |
| Generic'ler (Modül 11) | monomorfizasyon: her tip için ayrı, özelleşmiş kopya üretilir; çalışma zamanında tip kontrolü yoktur |
| `Option<&T>` (Modül 24) | niş optimizasyonu: `None` için null kullanılır, boyut `&T` ile aynıdır |
| Newtype (Modül 6) | `struct Metre(f64)` bellekte düz bir `f64`'tür |

"Bedava" olmayanları da bil: `dyn Trait` çağrıları vtable üzerinden gider ve genelde inline
edilemez (Modül 20), `Rc`/`Arc` sayaç günceller, `RefCell` çalışma zamanı kontrolü yapar. Bunlar
kötü değildir; sadece bedelleri vardır ve onları **bilerek** seçersin.

Önce tahmin et — tembellik (laziness) de sıfır maliyetin bir parçasıdır:

```predict
code: |
  fn main() {
      let fiyatlar = vec![100, 250, 40];
      let indirimli = fiyatlar.iter().map(|f| {
          println!("işleniyor: {f}");
          f * 9 / 10
      });
      println!("plan hazır");
      let ilk_iki: Vec<i32> = indirimli.take(2).collect();
      println!("{ilk_iki:?}");
  }
options:
  - |
    işleniyor: 100
    işleniyor: 250
    işleniyor: 40
    plan hazır
    [90, 225]
  - |
    plan hazır
    işleniyor: 100
    işleniyor: 250
    [90, 225]
  - |
    plan hazır
    işleniyor: 100
    işleniyor: 250
    işleniyor: 40
    [90, 225]
answer: 1
explanation: |
  Modül 14'ü hatırla: iterator adaptörleri **tembeldir**. `map` satırı yalnızca bir "plan"
  oluşturur; closure henüz hiç çalışmaz, bu yüzden önce `plan hazır` yazılır. `take(2).collect()`
  yalnızca iki eleman ister; closure tam **iki** kez çalışır ve üçüncü fiyat (`40`) hiç işlenmez.
  İstenmeyen işin hiç yapılmaması, iterator'ların elle yazılmış döngüler kadar verimli olmasının
  sebeplerinden biridir.
```

**Inlining**, bir fonksiyon çağrısını fonksiyonun gövdesiyle değiştirmektir. Kendisi küçük bir
kazançtır (çağrı maliyeti gider), ama asıl önemi **kapı açmasıdır**: gövde çağrı yerine
yapıştırılınca derleyici sabitleri yayabilir, gereksiz kontrolleri silebilir, döngüleri
vektörleştirebilir. Iterator'ların hızlı olmasının sırrı budur.

Derleyici neyin inline edileceğine genellikle senden iyi karar verir. Ancak bir kural bilinmeli:
normal (generic olmayan) bir fonksiyonun gövdesi **crate sınırını** geçmez, yani başka bir crate
onu inline edemez (LTO açık değilse). Bu yüzden kütüphanelerdeki küçük, sık çağrılan fonksiyonlara
`#[inline]` eklenir:

```rust
pub struct Vektor2 {
    pub x: f64,
    pub y: f64,
}

impl Vektor2 {
    /// Küçük ve sık çağrılan: diğer crate'ler de inline edebilsin.
    #[inline]
    pub fn uzunluk_karesi(&self) -> f64 {
        self.x * self.x + self.y * self.y
    }

    /// Nadiren çalışan hata yolu: "soğuk" olarak işaretle, sıcak koda karışmasın.
    #[cold]
    #[inline(never)]
    fn gecersiz(&self) -> ! {
        panic!("geçersiz vektör: ({}, {})", self.x, self.y)
    }

    pub fn birim(&self) -> Vektor2 {
        let u = self.uzunluk_karesi().sqrt();
        if u == 0.0 {
            self.gecersiz();
        }
        Vektor2 { x: self.x / u, y: self.y / u }
    }
}

fn main() {
    let v = Vektor2 { x: 3.0, y: 4.0 };
    let b = v.birim();
    println!("|v|² = {}, birim = ({}, {})", v.uzunluk_karesi(), b.x, b.y);
}
```

- `#[inline]`: "crate dışında da inline edilebilsin" ipucu.
- `#[inline(always)]` / `#[inline(never)]`: daha güçlü istekler; ölçmeden kullanma — aşırı inlining
  kodu şişirir ve talimat önbelleğini (instruction cache) zorlayarak programı **yavaşlatabilir**.
- `#[cold]`: "bu fonksiyon nadiren çağrılır"; derleyici onu sıcak yolun dışına yerleştirir.

```quiz
question: |
  `kutuphane` crate'inde tanımlı küçük fonksiyonlar `uygulama` crate'inden sık sık çağrılıyor.
  LTO **kapalıyken**, aşağıdakilerden hangisi `#[inline]` işareti olmadan da `uygulama` içinde
  inline edilebilir?
options:
  - "`pub fn topla(a: i32, b: i32) -> i32`"
  - "`pub fn en_buyuk<T: PartialOrd>(a: T, b: T) -> T`"
  - Hiçbiri; crate sınırları asla aşılamaz
answer: 1
explanation: |
  Generic fonksiyonlar, kullanıldıkları crate'te monomorfize edilir (Modül 11): `en_buyuk::<i32>`
  kopyası `uygulama` derlenirken üretilir, gövdesi de orada bulunduğundan inline edilebilir. Generic
  olmayan `topla` ise `kutuphane` içinde bir kez derlenir; `#[inline]` yoksa (ya da LTO açık
  değilse) gövdesi `uygulama`'ya taşınmaz. `#[inline]` ve LTO, sınırı aşmanın iki yoludur.
feedback:
  - "`topla` generic olmadığı için `kutuphane`'de derlenip bitmiştir; `#[inline]` ya da LTO olmadan inline edilemez."
  - Doğru! Monomorfizasyon, generic gövdeyi kullanan crate'e taşır.
  - "`#[inline]`, generic fonksiyonlar ve LTO sınırı aşmanın meşru yollarıdır."
```

## Özet

:::remember
- **Tahmin etme, ölç.** Amdahl yasası: kazanç, optimize edilen parçanın toplam süredeki payıyla sınırlıdır.
- Performansı yalnızca **`--release`** (ya da `cargo bench`) ile ölç; debug süreleri yanıltıcıdır.
- `Instant::now()` + `.elapsed()` ile ölç; girdiyi ve çıktıyı `std::hint::black_box`'tan geçir ki derleyici işi silmesin.
- Isınma + çok tekrar + **medyan**; ciddi karşılaştırmalar için **criterion**.
- "Ne kadar?" → benchmark; "nerede?" → profilci (perf, flamegraph, samply). Flamegraph'ta **genişlik** önemlidir.
- Sıra: algoritma ve veri yapısı → gereksiz iş → sabit çarpanlar.
- Iterator'lar, generic'ler ve newtype'lar sıfır maliyetlidir; `#[inline]` crate sınırını aşmak içindir, ölçmeden serpiştirilmez.
:::

```reflect
prompt: |
  Bir arkadaşın "Iterator'lar yavaş, döngüyü indeksle yazdım; Rusteach'te `Instant` ile ölçtüm,
  2 kat hızlandı" diyor. Kendi cümlelerinle, bu ölçümün neden güvenilmez olduğunu ve doğru
  ölçümün nasıl yapılacağını açıkla.
answer: |
  Model cevap: Ölçüm debug (dev) profilinde yapılmış; orada iterator adaptörleri ve closure'lar
  inline edilmez, taşma kontrolleri vardır, yani süreler release'i temsil etmez. Release'te iterator
  zinciri genelde indeksli döngüyle aynı makine koduna dönüşür ve sınır kontrolleri bile kalkabilir.
  Doğru ölçüm için `cargo bench` (criterion) ya da `--release` ile, girdi ve çıktıyı `black_box`'tan
  geçirerek, ısınma yapıp çok tekrarla ölçmeli ve medyana bakmalı. Ayrıca önce profilciyle bu kodun
  gerçekten darboğaz olup olmadığına bakmalı; değilse okunabilir olan iterator sürümü kalmalı.
```

```flashcards
- front: "Amdahl yasası optimizasyon hakkında ne söyler?"
  back: "Bir parçayı ne kadar hızlandırırsan hızlandır, toplam kazanç o parçanın toplam süredeki **payıyla** sınırlıdır."
- front: Performans ölçümleri neden debug derlemesinde yapılmamalı?
  back: "Debug'da `opt-level = 0`: inlining yok, taşma kontrolleri var, iterator/closure çağrıları gerçek çağrı olarak kalır; süreler release'i temsil etmez."
- front: "`std::hint::black_box(x)` ne işe yarar?"
  back: "Değeri derleyiciye opak gösterir; derleyici hesabı sabitleyemez (constant folding) ya da sonucu kullanılmıyor diye silemez (dead code elimination)."
- front: Benchmark sonuçlarını özetlerken neden ortalama yerine medyan tercih edilir?
  back: Medyan, işletim sistemi kesintisi gibi tek bir aykırı ölçümden neredeyse etkilenmez; ortalama ise kolayca bozulur.
- front: "criterion çıktısındaki `time: [a b c]` üçlüsü nedir?"
  back: "Güven aralığı: [alt sınır, en iyi tahmin, üst sınır]."
- front: Flamegraph'ta bir kutunun genişliği neyi gösterir?
  back: O fonksiyonda (ve çağırdıklarında) geçen örnek sayısının, yani sürenin payını. X ekseni zaman çizelgesi değildir.
- front: "Generic olmayan bir kütüphane fonksiyonunu başka crate'in inline edebilmesi için ne gerekir?"
  back: "`#[inline]` özniteliği ya da LTO (link-time optimization). Generic fonksiyonlar monomorfizasyon sayesinde zaten inline edilebilir."
- front: Optimizasyonda doğru öncelik sırası nedir?
  back: "1) Algoritma ve veri yapısı (karmaşıklık), 2) gereksiz işi/tahsisleri kaldırmak, 3) sabit çarpanlar (önbellek, dallanma, en son `unsafe`)."
```
