---
id: m05-l05
title: "Dizi dilimleri: &[T] ve &mut [T]"
minutes: 18
type: lesson
objectives:
  - "Dizilerden ve vektörlerden `&a[1..3]` ile dilim alabilmek ve `&[T]` tipini okuyabilmek"
  - "Tek bir `&[T]` parametresiyle dizilerle, vektörlerle ve dilimlerle çalışan fonksiyonlar yazabilmek"
  - "`&mut [T]` ile bir koleksiyonun yalnızca bir bölümünü yerinde değiştirebilmek"
  - "Aynı koleksiyonun iki parçasını `split_at_mut` ile aynı anda değiştirebilmek"
keywords: [dilim, slice, "&[T]", "&mut [T]", dizi, Vec, split_at_mut, iter_mut]
---

Önceki derste metinlerin bir parçasını gösteren `&str` dilimlerini öğrendin. Aynı fikir her
koleksiyonda işe yarar: bir dizinin ya da vektörün **ardışık bir bölümüne**, kopyalamadan bakan bir
referans. Bu tür dilimlerin tipi **`&[T]`**'dir ("T'lerden oluşan bir dilim"). Hatta onunla zaten
tanıştın: Ders 4'teki `s.as_bytes()` bir `&[u8]`, yani bir bayt dilimi döndürüyordu.

Bu derste dilimlerle okumayı, sonra da `&mut [T]` ile bir koleksiyonun **yalnızca bir parçasını**
değiştirmeyi öğreneceksin.

## Dizilerin ve vektörlerin dilimleri

Yazım `&str` ile birebir aynı. Tek fark, indekslerin bayt değil **eleman** saymasıdır:

```rust
fn main() {
    let a = [10, 20, 30, 40, 50];
    let orta = &a[1..4]; // 1, 2 ve 3. elemanlar
    println!("{orta:?}, uzunluk: {}, ilk: {}", orta.len(), orta[0]);

    let v = vec![1, 2, 3, 4];
    let son_ikisi = &v[2..]; // 2. elemandan sona kadar
    println!("{son_ikisi:?}");
}
```

Dilimi `{:?}` ile yazdırabilir, `.len()` ile uzunluğunu sorabilir ve `orta[0]` ile elemanlarına
ulaşabilirsin. Dikkat: `orta[0]`, dizinin değil **dilimin** ilk elemanıdır, yani `20`.

Metin dilimlerinde olduğu gibi aralık çalışma zamanında denetlenir: `&a[2..9]` (dizinin dışına taşan)
ya da `&a[3..1]` (başı sonundan büyük) derlenir ama çalışınca **panik** verir. `orta[5]` gibi dilimin
dışındaki bir indeks de öyle.

Bellekte iki dilim de aynı yapıdadır, adres + uzunluk. Ama adresin **nereyi** gösterdiğine bak:

```memory
title: "Dilimler verinin durduğu yeri gösterir"
steps:
  - caption: "Dizinin elemanları doğrudan stack'te durur. `orta`, `a`'nın 1. elemanından başlayan 3 elemanlık bir pencere."
    stack:
      - frame: main
        vars:
          - { name: a, type: "[i32; 5]", value: "[10, 20, 30, 40, 50]" }
          - { name: orta, type: "&[i32]", value: "ptr (+1) · len=3", to: a }
  - caption: "Vektörün elemanları heap'tedir. `son_ikisi`, `v` değişkenini değil, **doğrudan heap'teki** 2. elemanı gösterir."
    stack:
      - frame: main
        vars:
          - { name: a, type: "[i32; 5]", value: "[10, 20, 30, 40, 50]" }
          - { name: orta, type: "&[i32]", value: "ptr (+1) · len=3", to: a }
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4", to: h1 }
          - { name: son_ikisi, type: "&[i32]", value: "ptr (+2) · len=2", to: h1 }
    heap:
      - { id: h1, value: "1 2 3 4" }
```

Ders 1'deki `&String` zincirini hatırla: `metin` → `kitap` → heap. Bir `&Vec<i32>` de böyledir: önce
`v`'yi, `v` de heap'i gösterir. Bir `&[i32]` dilimi ise aradaki adımı atlayıp **verinin kendisini**
gösterir. Bu yüzden dilim, verinin nerede durduğunu (stack ya da heap) umursamaz.

Peki neden dilime ihtiyaç var? Bir diziyi doğrudan başka bir değişkene versek olmaz mı? Modül 4'ü
hatırlayarak tahmin et:

```compiles
code: |
  fn main() {
      let a = [1, 2, 3];
      let b = a;
      println!("{a:?} {b:?}");
  }
answer: true
explanation: |
  Derlenir ve `[1, 2, 3] [1, 2, 3]` yazar. Modül 4'ten: **elemanları `Copy` olan diziler de
  `Copy`'dir.** `let b = a;` bütün diziyi kopyalar. Aynı kod `let a = vec![1, 2, 3];` ile yazılsaydı
  `a` taşınırdı ve E0382 alırdın. Üç elemanı kopyalamak ucuzdur. Ama bir milyon elemanlı bir diziyi
  her fonksiyon çağrısında kopyalamak çok pahalı olurdu. Dilim ise boyu ne olursa olsun sadece
  bir adres ve bir uzunluk kopyalar.
```

## Her koleksiyonu kabul eden fonksiyonlar: `&[T]`

Ders 4'teki kural burada da geçerli: **sadece okuyacaksan parametre olarak dilim al.** `&[i32]`
alan bir fonksiyon dizilerle, vektörlerle ve onların dilimleriyle çalışır:

```rust
fn toplam(sayilar: &[i32]) -> i32 {
    let mut t = 0;
    for s in sayilar {
        t += *s; // s bir &i32; değeri *s ile alırız
    }
    t
}

fn main() {
    let dizi = [1, 2, 3, 4];
    let v = vec![10, 20, 30];
    println!("{}", toplam(&dizi)); // &[i32; 4] → &[i32]
    println!("{}", toplam(&v)); // &Vec<i32> → &[i32]
    println!("{}", toplam(&v[1..])); // zaten bir dilim
}
```

İki şeye dikkat et:

- `&v` bir `&Vec<i32>`'dir ama derleyici onu `&[i32]`'ye **otomatik olarak** çevirir. Bu, Ders 4'teki
  `&String` → `&str` dönüşümünün aynısıdır (deref zorlaması, Modül 17). `&dizi` için de benzer bir
  otomatik dönüşüm vardır: dizinin uzunluğu tipten "unutulur" ve dizi bir dilim olarak görülür.
- Bir dilimin üzerinde `for` ile dönmek elemanları **ödünç** verir: `s`'nin tipi `i32` değil
  `&i32`'dir. Değeri almak için `*s` yazarız (Ders 1). `sayilar.iter()` da aynı şeyi açıkça
  yazmanın yoludur (Modül 9 ve 14'te ayrıntılı).

```quiz
question: "Bir fonksiyon `[1, 2, 3]` dizisini, `vec![1, 2, 3]` vektörünü ve `&v[1..]` dilimini **değiştirmeden okumak** istiyor. Hangi imza üçünü de kabul eder?"
options:
  - "`fn f(x: &Vec<i32>)`"
  - "`fn f(x: &[i32])`"
  - "`fn f(x: [i32; 3])`"
  - "`fn f(x: Vec<i32>)`"
answer: 1
explanation: |
  `&[i32]` en esnek seçimdir: `&[i32; 3]` ve `&Vec<i32>` ona otomatik dönüşür, `&v[1..]` zaten
  odur. `&Vec<i32>` diziyi ve dilimi kabul etmez. `[i32; 3]` yalnızca tam 3 elemanlı dizileri,
  `Vec<i32>` ise **sahipliği** alır.
feedback:
  - "Bir dizi ya da dilim `Vec` değildir. `&Vec<i32>` sadece vektörleri kabul eder."
  - "Doğru! `&str` gibi `&[T]` de en esnek okuma parametresidir."
  - "Bu imza sahipliği (bir kopyayı) alır ve sadece tam 3 elemanlı dizileri kabul eder."
  - "Bu imza vektörün sahipliğini alır; çağıran vektörünü kaybeder ve diziler hiç kabul edilmez."
```

Şimdi bir dilim fonksiyonunu farklı girdilerle çağır. Tahmin et:

```predict
code: |
  fn en_buyuk(sayilar: &[i32]) -> i32 {
      let mut en = sayilar[0];
      for s in sayilar {
          if *s > en {
              en = *s;
          }
      }
      en
  }

  fn main() {
      let sicakliklar = [12, 7, 18, 3, 25];
      let v = vec![4, 9, 1];
      println!("{}", en_buyuk(&sicakliklar));
      println!("{}", en_buyuk(&sicakliklar[1..4]));
      println!("{}", en_buyuk(&v));
  }
options:
  - |
    25
    18
    9
  - |
    25
    25
    9
  - |
    25
    18
    4
  - "Derlenmez: aynı fonksiyon hem dizi hem Vec alamaz"
answer: 0
explanation: |
  `&sicakliklar[1..4]` sadece 7, 18 ve 3'ü gösterir; fonksiyon dilimin **dışını göremez**, bu yüzden
  25'i bilmez ve 18 döner. `&v` otomatik olarak `&[i32]`'ye dönüşür ve en büyük eleman 9'dur.
  Dikkat: `sayilar[0]` boş bir dilimde panik verirdi. Gerçek kodda bu durumu ayrıca düşünmen gerekir
  (Modül 7'de `Option` ile çok daha zarif bir çözüm göreceksin).
```

:::ferris Bir kez yaz, her yerde kullan
Standart kütüphanedeki `contains`, `sort`, `reverse`, `swap`, `iter`, `first` gibi onlarca metot aslında
**dilimler** için tanımlanmıştır. Diziler ve vektörler bu metotları dilime dönüşebildikleri için
kullanabilir. Sen de fonksiyonlarını `&[T]` ile yazarsan aynı cömertliği kendi kodunda yaşarsın.
:::

Sıra sende:

```exercise
title: Not ortalaması
difficulty: 2
prompt: |
  Bir not defteri uygulaması için `ortalama` fonksiyonunu yaz. Fonksiyon notları bir **dilim** olarak
  alır ve ortalamalarını `f64` olarak döndürür:

  - `ortalama(&[70, 80, 90])` → `80.0`
  - `ortalama(&[1, 1, 2])` → `1.333...` (tamsayı bölmesi değil!)
  - Boş bir dilimin ortalaması `0.0` olsun (0'a bölme yok).

  Fonksiyon hem dizilerle, hem vektörlerle, hem de onların dilimleriyle çalışmalı.
starter: |
  fn ortalama(notlar: &[u32]) -> f64 {
      todo!()
  }

  fn main() {
      let sinav = [70, 85, 90];
      let odevler = vec![100, 60, 80, 40];
      println!("Sınav ortalaması: {:.1}", ortalama(&sinav));
      println!("Ödev ortalaması: {:.1}", ortalama(&odevler));
      println!("İlk iki ödev: {:.1}", ortalama(&odevler[..2]));
  }
solution: |
  fn ortalama(notlar: &[u32]) -> f64 {
      if notlar.is_empty() {
          return 0.0;
      }
      let mut toplam = 0;
      for n in notlar {
          toplam += *n;
      }
      toplam as f64 / notlar.len() as f64
  }

  fn main() {
      let sinav = [70, 85, 90];
      let odevler = vec![100, 60, 80, 40];
      println!("Sınav ortalaması: {:.1}", ortalama(&sinav));
      println!("Ödev ortalaması: {:.1}", ortalama(&odevler));
      println!("İlk iki ödev: {:.1}", ortalama(&odevler[..2]));
  }
check: tests
tests: |
  #[test]
  fn dizi_ile_ortalama() {
      assert_eq!(ortalama(&[70, 80, 90]), 80.0, "70, 80 ve 90'ın ortalaması 80.0");
      assert_eq!(ortalama(&[45]), 45.0, "tek notun ortalaması kendisidir");
  }

  #[test]
  fn vektor_ve_dilim_ile_ortalama() {
      let v = vec![50, 60, 100, 0];
      assert_eq!(ortalama(&v), 52.5, "&Vec<u32> de &[u32] yerine verilebilmeli");
      assert_eq!(ortalama(&v[..2]), 55.0, "sadece dilimdeki elemanlar sayılmalı");
  }

  #[test]
  fn bos_dilimin_ortalamasi_sifirdir() {
      assert_eq!(ortalama(&[]), 0.0, "boş dilimde 0'a bölme yapılmamalı; 0.0 döndür");
  }

  #[test]
  fn kesirli_sonuc() {
      let sonuc = ortalama(&[1, 1, 2]);
      assert!((sonuc - 1.3333).abs() < 0.001, "tamsayı bölmesi değil, ondalık bölme yapılmalı: {sonuc}");
  }
hints:
  - "Önce boş dilimi ele al: `if notlar.is_empty() { return 0.0; }` (ya da `notlar.len() == 0`)."
  - "Toplamı bir döngüyle bul: `for n in notlar { toplam += *n; }`. Burada `n` bir `&u32`'dir."
  - "Bölmeden **önce** iki tarafı da `f64`'e çevir (Modül 2'deki `as`): `toplam as f64 / notlar.len() as f64`."
explanation: |
  Fonksiyon bir `&[u32]` aldığı için çağıran tarafta hiçbir şey kopyalanmadı ve sahiplik hiç el
  değiştirmedi: `odevler` çağrılardan sonra da kullanılabilir.

  En sık yapılan iki hata: Boş dilimi unutmak (`0.0 / 0.0` sonucu `NaN` yani "sayı değil" olur) ve
  önce tamsayı bölmesi yapıp sonra çevirmek. `(toplam / notlar.len() as u32) as f64` ifadesi
  `[1, 1, 2]` için `1.0` verir, çünkü kesirli kısım `as` çalışmadan önce kaybolur.
```

## `&mut [T]`: bir bölümü yerinde değiştirmek

Değiştirilebilir dilimler, bir koleksiyonun **yalnızca bir parçasını** başka bir fonksiyona
değiştirmesi için ödünç vermeni sağlar. `&mut [T]` üzerinde `for` ile dönmek her elemanı `&mut T`
olarak verir; değeri değiştirmek için yine `*` kullanırız. Tahmin et:

```predict
code: |
  fn ikiye_katla(dilim: &mut [i32]) {
      for x in dilim {
          *x *= 2;
      }
  }

  fn main() {
      let mut v = vec![1, 2, 3, 4, 5];
      ikiye_katla(&mut v[1..3]);
      println!("{v:?}");
  }
options:
  - "[1, 4, 6, 4, 5]"
  - "[2, 4, 6, 8, 10]"
  - "[1, 4, 6, 8, 5]"
  - "Derlenmez: bir vektörün bir parçası &mut ile ödünç verilemez"
answer: 0
explanation: |
  `&mut v[1..3]` sadece 1. ve 2. indeksteki elemanları (2 ve 3) değiştirilebilir olarak ödünç verir.
  Üst sınır olan 3 hariç olduğu için 3. indeksteki 4'e dokunulmaz. Fonksiyon dilimin dışındaki
  elemanları **göremez bile**. Bu da bir güvenlik önlemi: "Sadece şu bölümü düzenleyebilirsin" demenin
  tip sistemi seviyesindeki yolu.
```

Dilim metotlarının çoğu bir bölüm üzerinde de çalışır. Aralıkla seçtiğin parçaya doğrudan metot
çağırabilirsin:

```rust
fn main() {
    let mut puanlar = [42, 7, 19, 88, 3, 56];
    puanlar[..3].sort(); // sadece ilk üç eleman sıralanır
    println!("{puanlar:?}");
    puanlar[3..].reverse(); // sadece son üç eleman ters çevrilir
    println!("{puanlar:?}");
    puanlar.swap(0, 5); // 0. ve 5. elemanlar yer değiştirir
    println!("{puanlar:?}");
    println!("{}", puanlar.contains(&42)); // aranan değeri de ödünç veririz
}
```

`sort`, `reverse` ve `swap` dilimi `&mut` ile ödünç alır, bu yüzden `puanlar` bir `let mut` olmalı.
`contains` ise sadece okur ve aranan değeri bile bir referans olarak (`&42`) ister.

Şimdi bir `&mut [T]` dilimiyle çalışan bir programı kendin kur. Sadece okunan bir dilim için
`.iter()` olduğu gibi, değiştirilebilir bir dilim için de `.iter_mut()` vardır: her elemanı `&mut T`
olarak verir.

```parsons
prompt: "Bir ses mikserinde 0. kanal ana kanaldır ve ona dokunulmamalı. **Diğer** kanallardan 100'ü aşanları 100'e indir. Program `[130, 100, 75, 100]` yazmalı."
lines: |
  fn main() {
      let mut kanallar = [130, 120, 75, 200];
      let digerleri = &mut kanallar[1..];
      for d in digerleri.iter_mut() {
          if *d > 100 {
              *d = 100;
          }
      }
      println!("{kanallar:?}");
  }
distractors: |
      let digerleri = &kanallar[1..];
              d = 100;
explanation: |
  `&mut kanallar[1..]` yalnızca 1, 2 ve 3. kanalları değiştirilebilir olarak ödünç verir. Ana kanal
  (130) dilimin dışında kaldığı için ona dokunulmaz. `d` bir `&mut i32` olduğundan değeri `*d = 100`
  ile değiştiririz. `d = 100` ise bir referansa sayı atamaya çalışır (E0308). `&kanallar[1..]` salt
  okunur bir dilim olurdu ve `iter_mut` çağrısı E0596 verirdi. Son satırda `kanallar`'ı yeniden
  kullanabiliyoruz, çünkü `digerleri`'nin işi döngüyle bitti (NLL).
```

Bir tuzak: `&mut T` kopyalanamaz, **taşınır** (Ders 2). `for` döngüsü de verdiğin `&mut` dilimi
alıp tüketir. Tahmin et:

```compiles
code: |
  fn negatifleri_sifirla(dizi: &mut [i32]) -> usize {
      let mut sayac = 0;
      for x in dizi {
          if *x < 0 {
              *x = 0;
              sayac += 1;
          }
      }
      println!("{} elemanın {sayac} tanesi sıfırlandı", dizi.len());
      sayac
  }

  fn main() {
      let mut olcumler = [3, -1, 4, -5];
      negatifleri_sifirla(&mut olcumler);
      println!("{olcumler:?}");
  }
answer: false
error: E0382
explanation: |
  `borrow of moved value: dizi`. `for x in dizi` satırı `dizi`'yi döngüye **taşır**, çünkü `&mut [i32]`
  `Copy` değildir. Döngüden sonra `dizi.len()` artık kullanılamaz. Çözüm: `for x in dizi.iter_mut()`
  yazmak ya da derleyicinin önerdiği gibi geçici bir yeniden ödünç almak: `for x in &mut *dizi`.
```

## Aynı anda iki `&mut` parça: `split_at_mut`

Bir vektörün iki farklı elemanını aynı anda değiştirmek istiyorsun. Elemanlar farklı, o zaman sorun
olmamalı. Değil mi?

```compiles
code: |
  fn main() {
      let mut v = vec![1, 2, 3, 4];
      let a = &mut v[0];
      let b = &mut v[1];
      *a += 10;
      *b += 10;
      println!("{v:?}");
  }
answer: false
error: E0499
explanation: |
  `cannot borrow v as mutable more than once at a time`. Ödünç denetleyicisi, `&mut v[0]` ifadesini
  "`v`'nin **tamamını** değiştirilebilir ödünç al, sonra 0. elemanı ver" olarak görür. İndekslerin
  **değerlerine** bakmaz, çünkü genelde bakamaz: `&mut v[i]` ve `&mut v[j]` yazdığında `i` ile `j`
  çalışma zamanında eşit olabilir. O zaman aynı elemana iki `&mut` olurdu.
```

Derleyicinin mesajı çözümü de söylüyor:

:::error E0499: Aynı vektöre iki `&mut`
```text
error[E0499]: cannot borrow `v` as mutable more than once at a time
 --> src/main.rs:4:18
  |
3 |     let a = &mut v[0];
  |                  - first mutable borrow occurs here
4 |     let b = &mut v[1];
  |                  ^ second mutable borrow occurs here
5 |     *a += 10;
  |     -------- first borrow later used here
  |
  = help: use `.split_at_mut(position)` to obtain two mutable non-overlapping sub-slices
```
Son satır: "Örtüşmeyen iki değiştirilebilir alt dilim elde etmek için `.split_at_mut(konum)` kullan."
:::

`split_at_mut(k)` bir dilimi `k` konumundan ikiye böler ve **iki ayrı** `&mut` dilim verir: `[..k]`
ve `[k..]`. İkisi örtüşmediği için aynı anda kullanılabilirler (`k` dilimin uzunluğundan büyükse
panik verir). Sonucu Modül 2'deki tuple ayrıştırmasıyla iki değişkene alırız. Tahmin et:

```predict
code: |
  fn main() {
      let mut v = vec![10, 20, 30, 40];
      let (sol, sag) = v.split_at_mut(2);
      sol[0] += 1;
      sag[0] += 100;
      println!("{v:?}");
  }
options:
  - "[11, 20, 130, 40]"
  - "[11, 120, 30, 40]"
  - "[11, 20, 30, 140]"
  - "Derlenmez: v iki kez &mut olarak ödünç alındı"
answer: 0
explanation: |
  `split_at_mut(2)`: `sol` = `[10, 20]` (0 ve 1. elemanlar), `sag` = `[30, 40]` (2 ve 3. elemanlar).
  `sag[0]`, **dilimin** ilk elemanı yani vektörün 2. elemanıdır: 30 + 100 = 130. Kod derlenir, çünkü
  `v` tek bir kez ödünç alındı (`split_at_mut` çağrısında) ve dönen iki parçanın örtüşmediği garanti.
  `println!` satırında ise iki dilimin de işi bitmiştir (NLL).
```

```memory
title: "split_at_mut(2): bir blok, iki örtüşmeyen pencere"
steps:
  - caption: "`v`'nin dört elemanı heap'te."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "10 20 30 40" }
  - caption: "`sol` 0. elemandan başlayan 2 elemanı, `sag` 2. elemandan başlayan 2 elemanı gösterir. Aynı blok, ama **ortak eleman yok**."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4 (ödünçte)", to: h1 }
          - { name: sol, type: "&mut [i32]", value: "ptr (+0) · len=2", to: h1 }
          - { name: sag, type: "&mut [i32]", value: "ptr (+2) · len=2", to: h1 }
    heap:
      - { id: h1, value: "10 20 30 40" }
  - caption: "`sol[0] += 1` ve `sag[0] += 100` çalıştı. Dilimlerin son kullanımı geçti, `v` yeniden serbest."
    stack:
      - frame: main
        vars:
          - { name: v, type: "Vec<i32>", value: "ptr · len=4 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "11 20 130 40" }
```

:::analogy Çitle bölünmüş bahçe
Bir bahçeyi iki bahçıvana aynı anda verirsen ikisi aynı gülü budamaya kalkabilir. Ama bahçeyi bir
çitle ikiye bölüp birine sol tarafı, diğerine sağ tarafı verirsen istedikleri kadar budayabilirler:
Çit sayesinde aynı güle iki kişinin dokunması **imkânsızdır**. `split_at_mut` o çittir. Bölme bir
kez yapılır ve her `&mut` yalnızca kendi tarafını görür.
:::

İki elemanın sadece **yerini değiştirmek** istiyorsan daha da kolay bir yol var: `v.swap(0, 1)`.
`split_at_mut`, iki parçayla daha karmaşık işler yapman gerektiğinde işe yarar.

:::deep Derleyici tuple alanlarını ayırt eder, indeksleri etmez
Aynı deneyi bir tuple ile yap:

```rust
fn main() {
    let mut t = (1, 2);
    let a = &mut t.0;
    let b = &mut t.1;
    *a += 10;
    *b += 10;
    println!("{t:?}");
}
```

Bu derlenir! `t.0` ve `t.1` **derleme zamanında** bilinen farklı alanlardır ve ödünç denetleyicisi
ikisini ayrı yerler olarak takip eder (Modül 6'daki struct alanları da böyledir). Dizi indeksi ise
bir **değerdir**: `d[0]` ile `d[i]` ancak program çalışırken karşılaştırılabilir. Aynı deneyi bir
diziyle (`let mut d = [1, 2, 3];`) yaparsan derleyici dizinin tamamını tek bir yer gibi görür ve
`cannot borrow d[_] as mutable more than once at a time` der. Buradaki `_` "hangi indeks olduğu fark
etmez" anlamına gelir.

`split_at_mut`'ın içi ise derleyicinin kendi başına kanıtlayamadığı bu garantiyi elle veren küçük bir
`unsafe` bloğu içerir. Standart kütüphane yazarları "bu iki parça asla örtüşmez" sözünü dikkatle
doğrulamıştır. Böylece sen tamamen güvenli bir arayüz kullanırsın. Modül 24'te kendi `split_at_mut`'ını
yazacaksın.
:::

## Alıştırma: eğriye göre not yükseltme

Son alıştırma, bir `&mut` dilimi önce **okumayı** sonra **değiştirmeyi** gerektiriyor. Az önceki
tuzağı unutma!

```exercise
title: Eğriye göre not yükselt
difficulty: 3
prompt: |
  Sınav zor geçti ve öğretmen notları "eğriye göre" yükseltmeye karar verdi: **en yüksek not 100'e
  çıkarılacak** ve aynı fark **herkesin** notuna eklenecek. Notlar 0 ile 100 arasındadır.

  `egriye_gore_yukselt` fonksiyonu notları bir `&mut [u32]` olarak alsın ve **yerinde** değiştirsin:

  - `[40, 70, 85]` → en yüksek 85, fark 15 → `[55, 85, 100]`
  - `[100, 60, 35]` → fark 0 → değişmez
  - Boş bir dilimde panik vermemeli.

  Fonksiyon bir dilim aldığı için yalnızca bir şubenin notlarını da yükseltebilir:
  `egriye_gore_yukselt(&mut okul[2..])`.
starter: |
  fn egriye_gore_yukselt(notlar: &mut [u32]) {
      todo!()
  }

  fn main() {
      let mut sinif = vec![45, 72, 80, 64];
      egriye_gore_yukselt(&mut sinif);
      println!("{sinif:?}");
  }
solution: |
  fn egriye_gore_yukselt(notlar: &mut [u32]) {
      let mut en_yuksek = 0;
      for n in notlar.iter() {
          if *n > en_yuksek {
              en_yuksek = *n;
          }
      }
      let ek = 100 - en_yuksek;
      for n in notlar.iter_mut() {
          *n += ek;
      }
  }

  fn main() {
      let mut sinif = vec![45, 72, 80, 64];
      egriye_gore_yukselt(&mut sinif);
      println!("{sinif:?}");
  }
check: tests
tests: |
  #[test]
  fn en_yuksek_not_100_olur() {
      let mut notlar = [40, 70, 85];
      egriye_gore_yukselt(&mut notlar);
      assert_eq!(notlar, [55, 85, 100], "en yüksek 85; herkese 15 eklenmeli");
  }

  #[test]
  fn zaten_100_varsa_degismez() {
      let mut notlar = vec![100, 60, 35];
      egriye_gore_yukselt(&mut notlar);
      assert_eq!(notlar, [100, 60, 35], "en yüksek not zaten 100 ise eklenecek puan 0'dır");
  }

  #[test]
  fn sadece_verilen_dilim_degisir() {
      let mut okul = [30, 90, 40, 60];
      egriye_gore_yukselt(&mut okul[2..]);
      assert_eq!(okul, [30, 90, 80, 100], "sadece dilimin içindeki notlar (40 ve 60) yükseltilmeli");
  }

  #[test]
  fn bos_dilim_ve_sifirlar() {
      egriye_gore_yukselt(&mut []);
      let mut sifirlar = [0, 0];
      egriye_gore_yukselt(&mut sifirlar);
      assert_eq!(sifirlar, [100, 100], "hepsi 0 ise herkes 100 almalı");
  }
hints:
  - "İki aşama var: önce en yüksek notu **bul** (sadece okuma), sonra farkı herkese **ekle** (yazma). Farkı `100 - en_yuksek` ile hesapla."
  - "İki ayrı döngü yazacaksın ve iki kez `for n in notlar` yazarsan ilki dilimi taşır (E0382). Okurken `notlar.iter()`, yazarken `notlar.iter_mut()` kullan."
  - "En yüksek notu `0` ile başlat (`notlar[0]` ile başlatırsan boş dilimde panik olur). İkinci döngüde `*n += ek;` yaz."
explanation: |
  Çözümde aynı `&mut [u32]` önce `.iter()` ile **paylaşılan** olarak okundu, sonra `.iter_mut()` ile
  değiştirildi. Bu iki ödünç sırayla yaşadığı için çakışmazlar: Biri bittiğinde diğeri başlar (NLL).

  Neden `notlar.iter()` dilimi taşımadı da `for n in notlar` taşıyor? Çünkü bir metot çağrısında Rust
  alıcıyı kendiliğinden ödünç alır: `notlar.iter()` aslında `(&*notlar).iter()` demektir. `for`
  döngüsü ise kendisine verdiğin değeri olduğu gibi tüketir. Ders 2'deki kural: `&T` kopyalanır,
  `&mut T` taşınır.

  Fonksiyon dilim aldığı için çağıran hangi bölümün değişeceğine karar verir: `&mut okul[2..]`
  verildiğinde fonksiyon ilk iki nota dokunamaz, onları göremez bile.

  İleride ilk döngünün yerine `notlar.iter().max()` yazacaksın; boş dilimde "yok" diyebilmek için
  bir `Option` döndürür (Modül 7 ve 14).
```

## Özet ve tekrar

:::remember
- `&a[1..4]`, `&v[2..]`, `&v[..]`: dizi ve vektör dilimleri. Tipi **`&[T]`**, indeksler **eleman** sayar.
- Dilim **adres + uzunluktur** ve verinin kendisini gösterir (dizide stack'i, vektörde heap'i).
- Sadece okuyan fonksiyonlar **`&[T]`** almalı: `&[T; N]` ve `&Vec<T>` ona otomatik dönüşür.
- `for x in dilim` elemanları ödünç verir: `&[T]` → `&T`, `&mut [T]` → `&mut T`. Değer için `*x`.
- `&mut [T]` bir bölümü yerinde değiştirmeye yarar. `for` onu **taşır**; tekrar kullanacaksan `.iter_mut()` kullan.
- `&mut v[0]` ve `&mut v[1]` aynı anda olamaz (E0499). Örtüşmeyen iki parça için **`split_at_mut`**, sadece yer değiştirme için `swap`.
:::

```reflect
prompt: |
  Derleyici `&mut v[0]` ile `&mut v[1]`'i aynı anda kabul etmiyor, ama `split_at_mut(1)` ile aldığın
  iki dilimi kabul ediyor. Aradaki fark nedir? Kendi cümlelerinle açıkla.
answer: |
  Model cevap: `&mut v[i]` ifadesinde ödünç denetleyicisi indeksin değerine bakmaz, `v`'nin tamamını
  değiştirilebilir olarak ödünç alınmış sayar. Çünkü genel durumda `i` ve `j` çalışma zamanında eşit
  olabilir ve aynı elemana iki `&mut` oluşurdu. `split_at_mut` ise `v`'yi **tek bir kez** ödünç alır ve
  bir sözle iki dilim döndürür: `[..k]` ve `[k..]` asla örtüşmez. Bu sözü derleyici değil standart
  kütüphane (içerideki küçük, dikkatle doğrulanmış bir `unsafe` blokla) verir. Böylece aynı elemana iki
  `&mut` oluşamayacağı garanti altındadır.
```

```flashcards
- front: "`let a = [10, 20, 30, 40, 50];` için `&a[1..4]` neyi gösterir, tipi nedir?"
  back: "`[20, 30, 40]`; tipi `&[i32]` (3 elemanlık bir dilim)."
- front: Sadece okuyan bir fonksiyon neden `&Vec<i32>` yerine `&[i32]` almalı?
  back: "`&[i32]` dizileri, vektörleri ve dilimleri kabul eder; `&Vec<i32>` yalnızca vektörleri."
- front: "`for x in dilim` döngüsünde `dilim: &mut [i32]` ise `x`'in tipi nedir?"
  back: "`&mut i32`. Değiştirmek için `*x = ...` yazılır."
- front: "Bir fonksiyonda `for x in dizi { ... }` sonrası `dizi.len()` neden E0382 verir? (`dizi: &mut [i32]`)"
  back: "`&mut` dilim `Copy` değildir; `for` onu taşır. Çözüm: `dizi.iter_mut()` ya da `&mut *dizi`."
- front: "`let a = &mut v[0]; let b = &mut v[1];` neden derlenmez?"
  back: "**E0499**: Derleyici indekslere bakmaz, `v`'nin tamamı iki kez `&mut` ödünç alınmış sayılır."
- front: "`v.split_at_mut(k)` ne döndürür?"
  back: "Örtüşmeyen iki `&mut` dilim: `[..k]` ve `[k..]`. İkisi aynı anda kullanılabilir."
- front: "`let b = a;` bir diziyi (`[i32; 3]`) kopyalar mı, taşır mı?"
  back: "Kopyalar: elemanları `Copy` olan diziler de `Copy`'dir. `Vec` ise taşınır."
```
