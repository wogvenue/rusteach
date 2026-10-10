---
id: m25-l02
title: Bellek Tahsisini Azaltmak
minutes: 25
type: lesson
objectives:
  - Bir `Vec`/`String`'in ne zaman yeniden tahsis yaptığını açıklayıp `with_capacity` ve `reserve` ile önleyebilmek
  - "`clear` ile tamponları yeniden kullanarak döngü içindeki tahsisleri ortadan kaldırabilmek"
  - "`&str`/`&[T]` parametreleri ve `Cow<'_, str>` ile yalnızca gerektiğinde sahiplenen fonksiyonlar yazabilmek"
  - Gereksiz `clone` çağrılarını tanıyıp `Box<str>` gibi kompakt tiplerin ne zaman işe yaradığını söyleyebilmek
keywords: [allocation, tahsis, with_capacity, reserve, clear, tampon, Cow, clone, Box<str>, smallvec, redundant_clone]
---

Önceki derste ilk kuralı öğrendin: önce algoritma. Algoritman doğruysa ve profilci hâlâ bir sıcak
nokta gösteriyorsa, listenin ikinci maddesine geçersin: **gereksiz iş**. Rust programlarında en sık
rastlanan gereksiz iş, fark edilmeden yapılan **heap tahsisleridir (allocation)**.

Bir `String::from`, bir `format!`, bir `clone`, kapasitesi dolan bir `Vec`'e `push`... Hepsi
masum görünür. Saniyede bir milyon kez çalışan bir döngünün içine girdiklerinde ise profilcinin
en geniş kutusu `malloc` ve `free` olur. Bu derste tahsisleri görmeyi ve onları azaltmanın
idiomatik yollarını öğreneceksin.

## Bir tahsisin bedeli

Modül 4'ten hatırla: stack'te yer açmak bir işaretçiyi kaydırmak kadar ucuzdur. Heap ise farklıdır.
Her tahsiste **bellek ayırıcı (allocator)** çağrılır: uygun boyutta boş bir blok arar, kayıt
tutar, gerekirse işletim sisteminden yeni sayfa ister. Her serbest bırakma da benzer bir iş yapar.
Üstelik heap'e dağılmış veriler işlemci önbelleğine (cache) daha az sığar.

En sinsi tahsisler **yeniden tahsislerdir (reallocation)**. Bir `Vec`'in kapasitesi dolduğunda:

```memory
title: Kapasitesi dolan Vec'e push
steps:
  - caption: "`v`'nin uzunluğu ve kapasitesi 4. Yer kalmadı."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "10 20 30 40", label: "eski blok (4 yer)" }
  - caption: "`v.push(50)`: ayırıcıdan **iki kat** büyüklükte yeni bir blok istenir ve eski elemanlar oraya **kopyalanır**."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "10 20 30 40", label: "eski blok" }
      - { id: h2, value: "10 20 30 40 _ _ _ _", label: "yeni blok (8 yer)" }
  - caption: "Eski blok serbest bırakılır, `v` yeni bloğu gösterir ve `50` eklenir. Tek bir `push` = tahsis + kopya + serbest bırakma."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=5 · cap=8", to: h2 }
    heap:
      - { id: h1, value: "10 20 30 40", label: "eski blok", freed: true }
      - { id: h2, value: "10 20 30 40 50 _ _ _", label: "yeni blok (8 yer)" }
```

Kapasitenin her seferinde ikiye katlanması sayesinde `push`'un **ortalama** (amortize) maliyeti
O(1)'dir. Yine de bu küçük fırtınalar gereksizdir, eğer kaç eleman geleceğini biliyorsan.

```predict
question: |
  Fonksiyon, 100 eleman eklenirken kapasitenin kaç kez değiştiğini sayıyor. Program ne yazdırır?
  (İpucu: bugünkü std'de boş bir `Vec<i32>`'nin ilk kapasitesi 4'tür ve her dolduğunda iki katına çıkar.)
code: |
  fn kapasite_degisimi(mut v: Vec<i32>) -> usize {
      let mut degisim = 0;
      let mut onceki = v.capacity();
      for i in 0..100 {
          v.push(i);
          if v.capacity() != onceki {
              degisim += 1;
              onceki = v.capacity();
          }
      }
      degisim
  }

  fn main() {
      println!("Vec::new          → {}", kapasite_degisimi(Vec::new()));
      println!("with_capacity(100) → {}", kapasite_degisimi(Vec::with_capacity(100)));
  }
options:
  - |
    Vec::new          → 100
    with_capacity(100) → 0
  - |
    Vec::new          → 6
    with_capacity(100) → 0
  - |
    Vec::new          → 6
    with_capacity(100) → 1
answer: 1
explanation: |
  `Vec::new()` hiç tahsis yapmaz (kapasite 0). İlk `push` 4'lük bir blok ayırır, sonra kapasite
  8 → 16 → 32 → 64 → 128 olur: **6 değişim**, yani 6 tahsis ve 5 kopyalama. `with_capacity(100)`
  ise baştan en az 100 yerlik bloğu bir kez ayırır; döngü boyunca kapasite **hiç** değişmez.
  Not: büyüme stratejisinin ayrıntıları (4'ten başlamak, iki kat) bir uygulama detayıdır ve
  garanti edilmez; garanti edilen şey `with_capacity(n)`'nin en az `n` yer ayırmasıdır.
```

## `with_capacity` ve `reserve`: yeri baştan ayır

Kaç eleman geleceğini biliyorsan (ya da makul bir üst sınır tahmin edebiliyorsan) yeri baştan
iste:

| Metot | Ne yapar? |
|---|---|
| `Vec::with_capacity(n)` / `String::with_capacity(n)` | en az `n` eleman/bayt yerle **boş** bir koleksiyon oluşturur |
| `v.reserve(ek)` | en az `ek` eleman daha sığacak yer garantiler (gerekirse büyür, fazlasını da alabilir) |
| `v.reserve_exact(ek)` | tam olarak gerektiği kadar ister (sonra yine büyüyecekse genelde `reserve` daha iyidir) |
| `v.shrink_to_fit()` | fazla kapasiteyi geri verir (uzun yaşayacak, artık büyümeyecek veriler için) |
| `v.capacity()` | şu anki kapasite |

İyi haber: iterator'larla `collect` yaptığında bunu çoğu zaman düşünmen gerekmez. `collect`,
iterator'ın `size_hint()` bilgisini kullanır; `v.iter().map(...)` gibi boyutu bilinen bir
zincir tek tahsisle toplanır. `filter` gibi boyutu belirsizleştiren adaptörlerden sonra ise
`collect` yine büyüyerek çalışır.

:::warning Kapasite uzunluk değildir
`with_capacity` yer **ayırır**, eleman **eklemez**. `len()` hâlâ 0'dır ve `v[0] = 5` yazmak
panikler. Elemanları `push` ile ekle; gerçekten belirli sayıda varsayılan değer istiyorsan
`vec![0; n]` kullan.
:::

```rust,should_panic
fn main() {
    let mut puanlar: Vec<u32> = Vec::with_capacity(3);
    println!("len = {}, kapasite ≥ 3: {}", puanlar.len(), puanlar.capacity() >= 3);
    puanlar[0] = 95; // panik: index out of bounds: the len is 0 but the index is 0
}
```

Aşağıdaki örnek bir sipariş satırını CSV'ye çeviriyor. Her parçanın uzunluğunu bildiğimiz için
`String`'i tek seferde doğru boyutta ayırabiliriz.

```fill
prompt: Boşlukları doldurarak `csv_satiri`'nın sonucu tek bir tahsisle oluşturmasını sağla.
code: |
  fn csv_satiri(alanlar: &[&str]) -> String {
      let toplam_uzunluk: usize = alanlar.iter().map(|a| a.len()).sum();
      let virguller = alanlar.len().saturating_sub(1);
      let mut satir = String::___0(toplam_uzunluk + virguller);
      for (i, alan) in alanlar.iter().enumerate() {
          if i > 0 {
              satir.push(',');
          }
          satir.___1(alan);
      }
      satir
  }

  fn main() {
      let satir = csv_satiri(&["1042", "Çay", "3", "45.90"]);
      println!("{satir}");
      println!("{}", satir.capacity() == satir.len());
  }
blanks:
  - ["with_capacity"]
  - ["push_str"]
output: |
  1042,Çay,3,45.90
  true
explanation: |
  Bayt uzunlukları toplanıp (`Ç` iki bayt, `len()` bayt sayar — tam da istediğimiz) virgül sayısı
  eklenince gereken kapasite kesin olarak bilinir. `String::with_capacity` bu kadar yer ayırır,
  `push`/`push_str` çağrıları da asla yeniden tahsis yapmaz. Son satırdaki `true` bunun kanıtı:
  kapasite tam olarak uzunluk kadar. `saturating_sub(1)` boş dilimde `0 - 1` taşmasını önler
  (Modül 2).
```

## Tamponları yeniden kullan

Döngü içinde her turda yeni bir `String` ya da `Vec` oluşturmak, her turda bir tahsis ve bir
serbest bırakma demektir. Oysa `clear()` **elemanları siler ama kapasiteyi korur**. Aynı tamponu
tekrar tekrar kullanırsan, ilk birkaç turdan sonra hiç tahsis yapılmaz.

```rust
use std::fmt::Write; // String'e write! ile yazabilmek için

fn main() {
    let siparisler = [("Ayşe", 3), ("Mehmet", 12), ("Zeynep", 7)];

    // Kötü: her turda format! yeni bir String tahsis eder
    for (ad, adet) in &siparisler {
        let satir = format!("{ad:<8}|{adet:>4} adet");
        println!("{satir}");
    }

    // İyi: tek tampon, her turda temizlenip yeniden doldurulur
    let mut tampon = String::with_capacity(32);
    let ilk_adres = tampon.as_ptr();
    for (ad, adet) in &siparisler {
        tampon.clear();
        write!(tampon, "{ad:<8}|{adet:>4} adet").unwrap();
        println!("{tampon}");
    }
    println!("aynı bellek mi? {}", tampon.as_ptr() == ilk_adres);
}
```

`std::fmt::Write` trait'i, Modül 11'de `Display` yazarken kullandığın `write!` makrosunun bir
`String`'e de yazabilmesini sağlar. `write!` bir `fmt::Result` döndürür; `String`'e yazmak asla
başarısız olmadığı için burada `unwrap()` güvenlidir. `as_ptr()` ise tamponun heap adresini verir:
adres değişmediyse yeni tahsis yapılmamış demektir.

:::analogy Çay bardağı
Kantinde her müşteriye yeni karton bardak açmak (tahsis) ve sonra çöpe atmak (serbest bırakma)
yerine cam bardağı yıkayıp (`clear`) tekrar doldurursun. Bardak aynı bardaktır; sadece içi yenidir.
Kalabalık bir günde fark muazzamdır.
:::

Aynı fikir standart kütüphanede de var: `BufRead::read_line(&mut tampon)` satırı **senin**
tamponuna ekler, yeni bir `String` döndürmez. Döngüde her satırdan önce `tampon.clear()` çağırmak
idiomatiktir. Fonksiyon tasarlarken de aynısını yapabilirsin: sonucu döndürmek yerine çağıranın
verdiği bir `&mut String`'e yazan bir varyant sun.

```exercise
id: m25-e-rapor-tamponu
title: Tamponlu rapor yazıcı
difficulty: 3
prompt: |
  Bir kargo şirketinin panosu her saniye depo raporunu yeniden üretiyor. Her seferinde yeni bir
  `String` tahsis etmek yerine, çağıranın verdiği tamponu yeniden kullanacağız.

  `rapor_yaz(tampon, stoklar)` fonksiyonunu tamamla:

  - Önce tamponun eski içeriğini **sil** (ama yeni bir `String` oluşturma!).
  - Her `(urun, adet)` için `urun: adet\n` biçiminde bir satır ekle.
  - En sona `toplam: N` satırını ekle (sonunda `\n` yok). `N` adetlerin toplamı.

  Örnek: `[("elma", 3), ("armut", 5)]` → `"elma: 3\narmut: 5\ntoplam: 8"`

  Testler, yeterli kapasitesi olan bir tamponun **heap adresinin değişmediğini** de kontrol ediyor.
starter: |
  use std::fmt::Write;

  fn rapor_yaz(tampon: &mut String, stoklar: &[(&str, u32)]) {
      todo!()
  }

  fn main() {
      let mut tampon = String::with_capacity(256);
      rapor_yaz(&mut tampon, &[("elma", 3), ("armut", 5)]);
      println!("{tampon}");
      rapor_yaz(&mut tampon, &[("çilek", 10)]);
      println!("{tampon}");
  }
solution: |
  use std::fmt::Write;

  fn rapor_yaz(tampon: &mut String, stoklar: &[(&str, u32)]) {
      tampon.clear();
      let mut toplam = 0;
      for (urun, adet) in stoklar {
          writeln!(tampon, "{urun}: {adet}").unwrap();
          toplam += adet;
      }
      write!(tampon, "toplam: {toplam}").unwrap();
  }

  fn main() {
      let mut tampon = String::with_capacity(256);
      rapor_yaz(&mut tampon, &[("elma", 3), ("armut", 5)]);
      println!("{tampon}");
      rapor_yaz(&mut tampon, &[("çilek", 10)]);
      println!("{tampon}");
  }
check: tests
tests: |
  #[test]
  fn rapor_bicimi_dogru() {
      let mut t = String::new();
      rapor_yaz(&mut t, &[("elma", 3), ("armut", 5)]);
      assert_eq!(t, "elma: 3\narmut: 5\ntoplam: 8");
  }

  #[test]
  fn eski_icerik_silinir() {
      let mut t = String::from("ESKİ RAPOR\n");
      rapor_yaz(&mut t, &[("çilek", 10)]);
      assert_eq!(t, "çilek: 10\ntoplam: 10", "tamponun eski içeriği silinmeli");
  }

  #[test]
  fn bos_stok() {
      let mut t = String::from("bir şeyler");
      rapor_yaz(&mut t, &[]);
      assert_eq!(t, "toplam: 0", "stok yoksa yalnızca toplam satırı kalır");
  }

  #[test]
  fn tampon_yeniden_kullanilir() {
      let mut t = String::with_capacity(1024);
      let adres = t.as_ptr();
      for _ in 0..3 {
          rapor_yaz(&mut t, &[("kalem", 40), ("defter", 25)]);
      }
      assert_eq!(t, "kalem: 40\ndefter: 25\ntoplam: 65");
      assert_eq!(t.as_ptr(), adres, "yeterli kapasite varken yeni bir String tahsis edilmemeli (clear kullan, *tampon = ... değil)");
      assert!(t.capacity() >= 1024, "kapasite korunmalı");
  }
hints:
  - "Eski içeriği silmek için `tampon.clear()` kullan. `*tampon = String::new()` ya da `*tampon = format!(...)` yeni bir tahsis yapar ve son testi geçemez."
  - "`use std::fmt::Write;` sayesinde `writeln!(tampon, \"{urun}: {adet}\")` doğrudan tampona yazar; dönen `fmt::Result`'ı `.unwrap()` ile karşılayabilirsin."
  - "Döngüde bir `toplam` değişkenine adetleri ekle; döngüden sonra `write!(tampon, \"toplam: {toplam}\").unwrap();` (sonunda `\\n` olmaması için `writeln!` değil `write!`)."
forbid:
  - pattern: "format!"
    message: "`format!` her çağrıda yeni bir `String` tahsis eder; doğrudan tampona `write!`/`writeln!` ile yaz."
explanation: |
  `clear()` uzunluğu sıfırlar ama heap bloğunu elinde tutar; sonraki `write!` çağrıları aynı bloğa
  yazar. Yeterli kapasite olduğu sürece hiç tahsis yapılmaz; test bunu `as_ptr()` ile kanıtlıyor.

  `for (urun, adet) in stoklar` satırında `stoklar` bir `&[(&str, u32)]` olduğu için desen
  eşleştirme (Modül 21'deki varsayılan bağlama kipleri) `urun: &&str` ve `adet: &u32` verir;
  `toplam += adet` çalışır çünkü `u32 += &u32` için `AddAssign` uygulanmıştır.

  Alternatif API: hem kolaylık hem verim için iki fonksiyon sunmak yaygındır:
  `fn rapor(stoklar) -> String` (her seferinde yeni) ve `fn rapor_yaz(&mut String, stoklar)`
  (tampona). İlki ikincisini çağırarak yazılabilir. `read_line` ve `Read::read_to_string` aynı
  tasarımı kullanır.
```

## Parametrelerde ödünç al, sahiplenme

Tahsislerin bir kısmı fonksiyon imzalarından gelir. Sadece **okuyan** bir fonksiyon `String` ya
da `Vec<T>` isterse, çağıran elinde bir `&str` veya dizi olduğunda sırf çağırabilmek için kopya
oluşturmak zorunda kalır:

```rust
fn selamla_kotu(ad: String) -> usize {
    ad.chars().count()
}

fn selamla_iyi(ad: &str) -> usize {
    ad.chars().count()
}

fn toplam(puanlar: &[u32]) -> u32 {
    puanlar.iter().sum()
}

fn main() {
    let ad = "Şükrü";
    let n1 = selamla_kotu(ad.to_string()); // sırf çağırmak için tahsis!
    let n2 = selamla_iyi(ad); // tahsis yok

    let sahipli = String::from("Gülşen");
    let n3 = selamla_iyi(&sahipli); // &String → &str (deref zorlaması)

    let vec_puan = vec![70, 85, 90];
    let dizi_puan = [100, 60];
    println!("{n1} {n2} {n3} {} {}", toplam(&vec_puan), toplam(&dizi_puan));
}
```

Kural basit: **sadece okuyorsan `&str` / `&[T]` al; saklayacaksan sahipliği al.** Bir struct'ın
alanına koyacağın bir değeri `&str` alıp içeride `to_string()` yaparsan, çağıranın elinde zaten
taşıyabileceği bir `String` varsa onu boşuna kopyalatmış olursun. Bu ince noktaya bir sonraki
derste `impl Into<String>` ile döneceğiz.

```compiles
code: |
  fn ortalama(notlar: &[f64]) -> f64 {
      if notlar.is_empty() {
          return 0.0;
      }
      notlar.iter().sum::<f64>() / notlar.len() as f64
  }

  fn main() {
      let sinav: Vec<f64> = vec![80.0, 95.5];
      let quiz = [60.0, 70.0, 100.0];
      let kutulu: Box<[f64]> = Box::new([50.0]);
      println!("{} {} {}", ortalama(&sinav), ortalama(&quiz), ortalama(&kutulu));
      println!("{}", ortalama(&sinav[..1]));
  }
answer: true
explanation: |
  `&[f64]` parametresi neredeyse her şeyi kabul eder: `&Vec<f64>` deref zorlamasıyla (Modül 17)
  `&[f64]`'ye döner, `&[f64; 3]` dizisi dilime **boyut silme (unsizing)** dönüşümüyle çevrilir,
  `&Box<[f64]>` de deref ile dilime iner. `&sinav[..1]` zaten bir dilimdir (Modül 5). `&Vec<f64>`
  isteseydik dizi ve kutu sürümleri derlenmezdi; `Vec<f64>` isteseydik çağıranların hepsi kopya
  oluşturmak zorunda kalırdı.
```

Parametreyi `&Vec<f64>` yapıp aynı diziyi verseydin derleyici itiraz ederdi:

```rust,compile_fail,E0308
fn ortalama(notlar: &Vec<f64>) -> f64 {
    if notlar.is_empty() {
        return 0.0;
    }
    notlar.iter().sum::<f64>() / notlar.len() as f64
}

fn main() {
    let sinav: Vec<f64> = vec![80.0, 95.5];
    let quiz = [60.0, 70.0, 100.0];
    println!("{} {}", ortalama(&sinav), ortalama(&quiz));
}
```

:::error
```text
error[E0308]: mismatched types
  --> src/main.rs:11:50
   |
11 |     println!("{} {}", ortalama(&sinav), ortalama(&quiz));
   |                                         -------- ^^^^^ expected `&Vec<f64>`, found `&[{float}; 3]`
   |                                         |
   |                                         arguments to this function are incorrect
   |
   = note: expected reference `&Vec<f64>`
              found reference `&[{float}; 3]`
note: function defined here
  --> src/main.rs:1:4
   |
 1 | fn ortalama(notlar: &Vec<f64>) -> f64 {
   |    ^^^^^^^^ -----------------
```
Çağıranın tek seçeneği `ortalama(&quiz.to_vec())` olurdu: sırf imzayı tatmin etmek için bir heap
tahsisi. Hata aslında çağıranda değil, **fazla kısıtlı imzada**. Clippy bu imzayı zaten `ptr_arg`
lint'iyle işaretler (Ders 5).
:::

## `Cow`: gerektiğinde sahiplen

Bazen bir fonksiyon girdisini **çoğu zaman olduğu gibi** döndürür, ama **bazen** değiştirmesi
gerekir. Örneğin kullanıcı yorumlarında `<` ve `>` karakterlerini HTML'e güvenli hâle getirmek:
yorumların %99'unda bu karakterler yoktur. Her seferinde `String` döndürmek, %99 ihtimalle
gereksiz bir kopya demektir.

Standart kütüphanenin cevabı `std::borrow::Cow` ("clone-on-write", yazınca kopyala):

```rust,ignore
pub enum Cow<'a, B: ?Sized + ToOwned> {
    Borrowed(&'a B),            // ödünç: hiçbir şey kopyalanmadı
    Owned(<B as ToOwned>::Owned), // sahipli: yeni bir değer üretildi
}
```

`Cow<'a, str>` ya bir `&'a str` ödünç alır ya da bir `String`'e sahip olur. İkisi de `Deref`
ile `&str` gibi kullanılır (Modül 17), yani çağıran farkı çoğu zaman görmez bile.

```rust
use std::borrow::Cow;

fn html_kacis(metin: &str) -> Cow<'_, str> {
    if !metin.contains(['<', '>', '&']) {
        return Cow::Borrowed(metin); // hızlı yol: tahsis yok
    }
    let mut cikti = String::with_capacity(metin.len() + 16);
    for c in metin.chars() {
        match c {
            '<' => cikti.push_str("&lt;"),
            '>' => cikti.push_str("&gt;"),
            '&' => cikti.push_str("&amp;"),
            _ => cikti.push(c),
        }
    }
    Cow::Owned(cikti)
}

fn main() {
    for yorum in ["Harika ürün, teşekkürler!", "Fiyat <script> ile değişti & şaştım"] {
        let guvenli = html_kacis(yorum);
        let tur = match guvenli {
            Cow::Borrowed(_) => "ödünç",
            Cow::Owned(_) => "sahipli",
        };
        println!("[{tur}] {guvenli} ({} karakter)", guvenli.chars().count());
    }
}
```

```memory
title: Cow'un iki hâli
steps:
  - caption: "Değişiklik gerekmedi: `Cow::Borrowed` girdinin kendisini gösterir. Yeni heap bloğu yok."
    stack:
      - frame: main
        vars:
          - { name: yorum, type: "&str", value: "ptr · len=29", to: h1 }
          - { name: guvenli, type: "Cow<str>", value: "Borrowed(ptr · len=29)", to: h1 }
    heap:
      - { id: h1, value: "Harika ürün, teşekkürler!", label: "binary'deki sabit metin" }
  - caption: "Değişiklik gerekti: `Cow::Owned` kendi `String`'ine sahiptir. Tahsis yalnızca bu durumda yapıldı."
    stack:
      - frame: main
        vars:
          - { name: yorum, type: "&str", value: "ptr · len=40", to: h2 }
          - { name: guvenli, type: "Cow<str>", value: "Owned(ptr · len · cap)", to: h3 }
    heap:
      - { id: h2, value: "Fiyat <script> ile değişti & şaştım", label: "binary'deki sabit metin" }
      - { id: h3, value: "Fiyat &lt;script&gt; ile değişti &amp; şaştım", label: "yeni String" }
```

Faydalı `Cow` metotları:

- `cow.into_owned()` → her durumda bir `String` verir (Borrowed ise o an kopyalar).
- `cow.to_mut()` → `&mut String` verir; Borrowed ise **önce** kopyalar ("yazınca kopyala" adı
  buradan gelir).
- `Cow::from("sabit")` ve `Cow::from(string)` dönüşümleri `From` ile hazırdır.
- `String::from_utf8_lossy(&baytlar)` standart kütüphanede `Cow<str>` döndüren gerçek bir örnektir:
  baytlar zaten geçerli UTF-8 ise kopyalamaz.

```quiz
question: |
  `fn temizle(s: &str) -> Cow<'_, str>` fonksiyonu girdide değiştirilecek bir şey bulamadı. En
  idiomatik dönüş hangisidir?
options:
  - "`Cow::Owned(s.to_string())`"
  - "`Cow::Borrowed(s)`"
  - "`Cow::Borrowed(&s.to_string())`"
answer: 1
explanation: |
  Değişiklik yoksa girdinin kendisini ödünç döndürmek `Cow`'un tüm amacıdır: sıfır tahsis.
  `Owned(s.to_string())` çalışır ama `Cow` kullanmanın faydasını yok eder. Üçüncü seçenek ise
  derlenmez: fonksiyon içinde oluşturulan geçici `String`'e referans döndürülemez (Modül 5'teki
  sarkan referans, E0515).
feedback:
  - Doğru çalışır ama gereksiz bir kopya oluşturur; `Cow`'u kullanmanın anlamı kalmaz.
  - Doğru! Değişiklik yoksa ödünç ver, tahsis yapma.
  - Yerel bir geçici değere referans döndürmeye çalışıyor; derleyici sarkan referansa izin vermez.
```

```exercise
id: m25-e-cow-bosluk
title: Boşlukları sadeleştir (Cow ile)
difficulty: 3
prompt: |
  Bir haber sitesinin yorum sistemi, yorumlardaki **art arda gelen boşlukları tek boşluğa**
  indiriyor. Yorumların çoğunda zaten çift boşluk olmadığı için gereksiz kopyalardan kaçınmak
  istiyoruz.

  `bosluk_sadelestir` fonksiyonunu yaz:

  - Metinde art arda iki boşluk (`"  "`) **yoksa** `Cow::Borrowed` döndür (tahsis yok).
  - Varsa, her boşluk dizisini tek bir `' '` karakterine indiren yeni bir `String` oluştur ve
    `Cow::Owned` döndür.
  - Yalnızca `' '` (boşluk) karakteri dikkate alınır; baştaki ve sondaki boşluklar da sadeleştirilir
    ama silinmez (`"  a"` → `" a"`).
starter: |
  use std::borrow::Cow;

  fn bosluk_sadelestir(metin: &str) -> Cow<'_, str> {
      todo!()
  }

  fn main() {
      println!("{}", bosluk_sadelestir("Çok   güzel  bir   haber"));
      println!("{}", bosluk_sadelestir("Zaten düzgün"));
  }
solution: |
  use std::borrow::Cow;

  fn bosluk_sadelestir(metin: &str) -> Cow<'_, str> {
      if !metin.contains("  ") {
          return Cow::Borrowed(metin);
      }
      let mut sonuc = String::with_capacity(metin.len());
      let mut onceki_bosluk = false;
      for c in metin.chars() {
          if c == ' ' {
              if !onceki_bosluk {
                  sonuc.push(' ');
              }
              onceki_bosluk = true;
          } else {
              sonuc.push(c);
              onceki_bosluk = false;
          }
      }
      Cow::Owned(sonuc)
  }

  fn main() {
      println!("{}", bosluk_sadelestir("Çok   güzel  bir   haber"));
      println!("{}", bosluk_sadelestir("Zaten düzgün"));
  }
check: tests
tests: |
  #[test]
  fn degisiklik_yoksa_odunc_verir() {
      let s = bosluk_sadelestir("Zaten düzgün bir yorum");
      assert!(matches!(s, Cow::Borrowed(_)), "çift boşluk yoksa tahsis yapılmamalı (Cow::Borrowed)");
      assert_eq!(s, "Zaten düzgün bir yorum");
  }

  #[test]
  fn coklu_bosluklar_teke_iner() {
      let s = bosluk_sadelestir("Çok   güzel  bir   haber");
      assert!(matches!(s, Cow::Owned(_)), "değişiklik yapıldıysa Cow::Owned olmalı");
      assert_eq!(s, "Çok güzel bir haber");
  }

  #[test]
  fn bastaki_ve_sondaki_bosluklar() {
      assert_eq!(bosluk_sadelestir("   merhaba    "), " merhaba ", "baştaki/sondaki boşluk dizileri de teke iner ama silinmez");
      assert_eq!(bosluk_sadelestir("  "), " ");
  }

  #[test]
  fn kenar_durumlar() {
      assert!(matches!(bosluk_sadelestir(""), Cow::Borrowed("")), "boş metin ödünç döner");
      assert!(matches!(bosluk_sadelestir(" a b "), Cow::Borrowed(_)), "tekli boşluklar değişiklik gerektirmez");
  }
hints:
  - "Hızlı yol: `if !metin.contains(\"  \") { return Cow::Borrowed(metin); }`"
  - "Yavaş yolda `String::with_capacity(metin.len())` ile başla (sonuç asla girdiden uzun olmaz) ve `chars()` üzerinde dön. Bir önceki karakterin boşluk olup olmadığını bir `bool` ile takip et."
  - "Karakter boşluksa yalnızca önceki boşluk değilse `push(' ')` yap; değilse karakteri ekle ve bayrağı `false` yap. En sonda `Cow::Owned(sonuc)` döndür."
explanation: |
  Fonksiyonun maliyeti artık girdiye göre değişiyor: çoğunluğu oluşturan temiz yorumlar için tek
  bir `contains` taraması ve **sıfır tahsis**; yalnızca gerçekten değişmesi gereken yorumlar için
  tek bir doğru boyutlu tahsis. Dönüş tipindeki `'_` "girdiyle aynı yaşam süresi" demektir (elision,
  Modül 12): `Borrowed` dalı `metin`'i ödünç aldığı için sonuç, girdiden uzun yaşayamaz.

  Testlerde `assert_eq!(s, "...")` çalışıyor çünkü `Cow<str>` ile `&str` arasında `PartialEq`
  uygulanmıştır. `matches!` (Modül 7) ile varyantı kontrol ederek "gereksiz tahsis yapılmadı"
  davranışını da test ettik; bu, performans sözleşmesini testle korumanın güzel bir örneği.

  Alternatif: `split(' ')` ile parçalayıp boş olmayanları birleştirmek de mümkündü, ama bu baştaki
  ve sondaki boşlukları farklı ele alır ve ara `Vec` tahsis eder; tek geçişli döngü hem doğru hem verimli.
```

## Gereksiz `clone` ve kompakt tipler

Borrow checker'la uğraşan yeni Rust programcısının ilk refleksi `.clone()` eklemektir (Modül 4'ten
hatırla: `clone` sihirli bir düzeltme değil, bilinçli bir karardır). Bir `clone` gereksizse genellikle şu
kalıplardan biriyle kaldırılır:

| Durum | Gereksiz | İdiomatik |
|---|---|---|
| Sadece okunacak | `yazdir(ad.clone())` | `yazdir(&ad)` (parametre `&str`) |
| Son kullanım | `let b = a.clone(); /* a bir daha kullanılmıyor */` | `let b = a;` (taşı) |
| Koleksiyonu tüketmek | `for x in v.clone() { ... }` sonra `v` yok | `for x in v { ... }` |
| Bir alanı almak | `let ad = kisi.ad.clone(); drop(kisi);` | `let ad = kisi.ad;` (kısmi taşıma) ya da `std::mem::take(&mut kisi.ad)` (alanı boş `String` ile değiştirip eskisini verir) |
| Gerçekten paylaşım | büyük veriyi her yere `clone` | `Rc<T>` / `Arc<T>` (Modül 17-18): klonlamak sadece sayaç artırır |

Clippy'nin `redundant_clone` lint'i bu tür bazı durumları yakalar; yanlış pozitifleri olduğu için
**nursery** grubundadır ve elle açılması gerekir (`#![warn(clippy::redundant_clone)]`). Clippy'yi
son derste ayrıntılı göreceğiz.

Bazen tahsisi değil, **bellek ayak izini** küçültmek istersin. Önce tahmin et (Modül 24'teki
`size_of`'u hatırla; Rusteach 64 bit bir makinede çalışır):

```predict
code: |
  use std::mem::size_of;

  fn main() {
      println!("String   : {}", size_of::<String>());
      println!("Box<str> : {}", size_of::<Box<str>>());
      println!("&str     : {}", size_of::<&str>());
      println!("Vec<u8>  : {}", size_of::<Vec<u8>>());
      println!("Box<[u8]>: {}", size_of::<Box<[u8]>>());
  }
options:
  - |
    String   : 24
    Box<str> : 16
    &str     : 16
    Vec<u8>  : 24
    Box<[u8]>: 16
  - |
    String   : 8
    Box<str> : 8
    &str     : 8
    Vec<u8>  : 8
    Box<[u8]>: 8
  - |
    String   : 24
    Box<str> : 24
    &str     : 16
    Vec<u8>  : 24
    Box<[u8]>: 24
answer: 0
explanation: |
  `String` ve `Vec<T>` üç kelimedir: işaretçi + uzunluk + **kapasite** = 24 bayt. `Box<str>` ve
  `Box<[T]>` ise bir şişman işaretçidir (Modül 22: DST'ler): işaretçi + uzunluk = 16 bayt; büyüyemedikleri
  için kapasiteye ihtiyaçları yoktur. `&str` de aynı şekilde 16 bayttır. Milyonlarca kısa,
  **değişmeyecek** metin tutan bir yapıda (örneğin bir sözlük ya da sembol tablosu) `Box<str>`
  kullanmak, eleman başına 8 bayt ve fazla kapasite israfını kurtarır.
```

`String::into_boxed_str()` ve `Vec::into_boxed_slice()` dönüşümü yapar (fazla kapasite varsa
önce küçültür). Bir adım ötesi, ekosistemdeki **küçük veri optimizasyonu** crate'leridir:
`smallvec` (ilk N elemanı stack'te tutan `Vec`), `compact_str` / `smol_str` (kısa metni, yaklaşık 23-24 bayta kadar, hiç heap'e çıkmadan saklayan string'ler). Bunlar Rusteach'te çalışmaz ve her durumda kazanç
garantisi yoktur; ancak profilci kısa ömürlü küçük tahsisleri gösteriyorsa denemeye değer.
Unutma: **önce ölç**.

## Özet

:::remember
- Her heap tahsisi ayırıcıya bir çağrıdır; dolu bir `Vec`'e `push` = yeni blok + kopya + eski bloğu serbest bırakma.
- Boyutu biliyorsan `with_capacity` / `reserve`. Kapasite ≠ uzunluk: `with_capacity` eleman eklemez.
- Döngülerde tamponu **yeniden kullan**: `clear()` içeriği siler, kapasiteyi korur; `write!` ile `String`'e yaz.
- Sadece okuyorsan `&str` / `&[T]` al; saklayacaksan sahipliği al.
- `Cow<'_, str>`: değişiklik yoksa `Borrowed` (tahsis yok), varsa `Owned`.
- `clone`'u bilerek kullan: ödünç ver, taşı, ya da paylaşım için `Rc`/`Arc`.
- Değişmeyecek metin/diziler için `Box<str>` / `Box<[T]>` 24 yerine 16 bayttır.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — `Cow<'_, str>` döndüren bir fonksiyon, her zaman `String` döndüren
  bir fonksiyona göre hangi durumda daha verimlidir, hangi durumda hiçbir kazanç sağlamaz?
answer: |
  Model cevap: Girdinin çoğu zaman değişmeden döndüğü durumlarda (örneğin çoğu yorumda kaçışlanacak
  karakter yoksa) `Cow` girdiyi ödünç döndürür ve hiç tahsis yapmaz; `String` döndüren sürüm ise her
  çağrıda kopya oluşturur. Ama girdi neredeyse her seferinde değişiyorsa `Cow` her seferinde `Owned`
  olur ve kazanç kalmaz; üstüne bir varyant kontrolü ve daha karmaşık bir imza getirir. Ayrıca
  çağıran sonucu zaten sahiplenmek zorundaysa (`into_owned`) kopya sadece ertelenmiş olur.
```

```flashcards
- front: Dolu bir `Vec`'e `push` yapıldığında arka planda hangi üç iş olur?
  back: Daha büyük (genelde iki kat) yeni bir blok tahsis edilir, eski elemanlar kopyalanır, eski blok serbest bırakılır.
- front: "`Vec::with_capacity(10)` sonrasında `len()` kaçtır?"
  back: "0. `with_capacity` yalnızca yer ayırır; eleman eklemez. `v[0]` panikler."
- front: "`String::clear()` kapasiteye ne yapar?"
  back: Korur. Uzunluk 0 olur ama heap bloğu elde kalır; bu yüzden tampon yeniden kullanımı tahsis yapmaz.
- front: "Bir `String`'e `write!` ile yazabilmek için hangi trait'i içe aktarmalısın?"
  back: "`std::fmt::Write`"
- front: "`Cow<'a, str>`'nin iki varyantı nedir?"
  back: "`Cow::Borrowed(&'a str)` (kopya yok) ve `Cow::Owned(String)` (yeni değer)."
- front: "`Cow::to_mut()` Borrowed bir değerde ne yapar?"
  back: "Önce veriyi kopyalayıp `Owned`'a çevirir, sonra `&mut String` verir (clone-on-write)."
- front: "64 bit sistemde `size_of::<String>()` ve `size_of::<Box<str>>()` kaçtır, neden farklıdır?"
  back: "24 ve 16. `String`'in kapasite alanı vardır; `Box<str>` büyüyemez, yalnızca işaretçi + uzunluk tutar."
- front: "Sadece okuyan bir fonksiyon için `fn f(s: String)` yerine hangi imza tercih edilir?"
  back: "`fn f(s: &str)` — çağıranı kopya oluşturmaya zorlamaz; `&String`, literal ve dilimlerle çalışır."
```
