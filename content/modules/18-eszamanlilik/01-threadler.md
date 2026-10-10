---
id: m18-l01
title: Thread'ler
minutes: 18
type: lesson
objectives:
  - Eşzamanlılık (concurrency) ile paralelliği (parallelism) örnekle ayırt edebilmek
  - "`thread::spawn` ile thread açıp `JoinHandle::join` ile sonucunu toplayabilmek"
  - "`E0373` hatasının neden çıktığını açıklayıp `move` closure ile düzeltebilmek"
  - Sırası belirsiz (nondeterministic) thread çıktısını deterministik sonuca dönüştürebilmek
keywords: [thread, "thread::spawn", JoinHandle, join, move, E0373, eşzamanlılık, paralellik, "thread::sleep"]
---

Bilgisayarının işlemcisinde büyük ihtimalle 4, 8 belki 16 çekirdek var. Şimdiye kadar yazdığın bütün
programlar bunlardan yalnızca **birini** kullandı; diğerleri boş boş bekledi. Bu modülde onları da işe
koşacağız. Modül 1'de Rust'ın üç vaadinden birinin **korkusuz eşzamanlılık (fearless concurrency)**
olduğunu söylemiştik. Şimdi bu vaadin ne demek olduğunu göreceksin: başka dillerde gece yarısı ortaya
çıkan, tekrar üretilemeyen thread hatalarının büyük bölümünü Rust **derleme zamanında** yakalar.

:::ferris
Thread'ler ilk başta biraz ürkütücü gelebilir. Ama merak etme: sahiplik ve ödünç alma kurallarını zaten
biliyorsun. Bu modülde aynı kuralların thread'leri nasıl koruduğunu göreceksin! 🦀
:::

## Eşzamanlılık mı, paralellik mi?

Bu iki kelime sık karıştırılır, oysa farklı şeyleri anlatır:

- **Eşzamanlılık (concurrency):** Birden fazla işin **aynı zaman diliminde ilerlemesi**. İşler sırayla,
  parça parça yürütülebilir; tek çekirdekte bile olur. Bir sunucunun aynı anda yüzlerce isteği "idare
  etmesi" eşzamanlılıktır.
- **Paralellik (parallelism):** Birden fazla işin **gerçekten aynı anda**, farklı çekirdeklerde
  çalışması. Bir videoyu 8 çekirdekte 8 parçaya bölüp kodlamak paralelliktir.

:::analogy Mutfaktaki aşçılar
Tek aşçı, üç ocaktaki tencereyi karıştırıp dururken her yemek ilerler ama aşçı her an **tek** tencereyle
ilgilenir: bu **eşzamanlılıktır**. Mutfağa üç aşçı girip her biri kendi tenceresinin başında durursa
yemekler **gerçekten aynı anda** pişer: bu **paralelliktir**. Aşçılar aynı tuzluğu, aynı tezgâhı
paylaştığında ise kurallar gerekir; yoksa biri tuzu koyarken diğeri de koyar ve yemek tuzlu olur.
Bu modülün konusu tam olarak o kurallar.
:::

Programlarda bu "aşçılar" **thread**'lerdir (iş parçacığı). İşletim sistemi bir programı bir **süreç
(process)** olarak çalıştırır; her sürecin en az bir thread'i vardır: `main`'i çalıştıran **ana thread**.
Ek thread'ler açtığında hepsi aynı sürecin belleğini (heap'i, global değişkenleri) **paylaşır** ama her
birinin **kendi stack'i** olur. Rust'ın standart kütüphanesindeki `std::thread`, işletim sisteminin
gerçek thread'lerini kullanır (her Rust thread'i = bir OS thread'i, "1:1 model").

Paylaşılan bellek hem güç hem tehlikedir. Klasik sorunlar:

| Sorun | Ne olur? |
|---|---|
| **Veri yarışı (data race)** | İki thread aynı belleğe **eşzamanlı** erişir, en az biri **yazar** ve arada senkronizasyon yoktur. Sonuç bozuk veri; C/C++'ta **tanımsız davranış (undefined behavior)**. |
| **Yarış durumu (race condition)** | Sonuç, thread'lerin hangi sırayla çalıştığına bağlıdır (ör. iki kişinin aynı son bileti alması). |
| **Kilitlenme (deadlock)** | İki thread birbirinin bıraktığını bekler; ikisi de sonsuza dek durur. |

Diller bu sorunlarla farklı başa çıkar. C/C++ sorumluluğu tamamen programcıya bırakır. Java'da veri yarışı
belleği bozmaz ama yanlış sonuç üretir. Python'ın yaygın sürümü (CPython) **GIL** (Global Interpreter
Lock) ile saf Python kodunu aynı anda tek çekirdekte çalıştırır; güvenli ama paralel değildir.
JavaScript tek thread'li bir olay döngüsüyle yaşar, Web Worker'lar ise bellek paylaşmak yerine mesajlaşır.
Rust'ın yolu farklı: **güvenli Rust kodunda veri yarışı derlenmez.** Kanıtını bu modül boyunca göreceksin.

```quiz
question: Aşağıdakilerden hangisi **paralelliğin** (sadece eşzamanlılığın değil) örneğidir?
options:
  - Tek çekirdekli bir telefonda müzik çalarken mesajlaşma uygulamasının da çalışması
  - Bir fotoğraf filtresinin resmi 8 parçaya bölüp 8 çekirdekte aynı anda işlemesi
  - Bir web sunucusunun tek thread'de sırayla yüzlerce isteğe biraz biraz cevap vermesi
answer: 1
explanation: |
  Paralellik, işlerin **fiziksel olarak aynı anda** farklı çekirdeklerde yürütülmesidir. Tek çekirdekte
  hızlıca işler arasında geçiş yapmak eşzamanlılıktır ama paralellik değildir: her an yalnızca bir iş
  çalışır. Fotoğrafı 8 çekirdeğe bölmek ise gerçek paralelliktir.
feedback:
  - Tek çekirdekte işletim sistemi işler arasında hızla geçiş yapar; bu eşzamanlılıktır, paralellik değil.
  - Doğru! Farklı çekirdeklerde gerçekten aynı anda çalışma = paralellik.
  - Tek thread'de parça parça ilerlemek eşzamanlılıktır; aynı anda iki iş yürümüyor.
```

## İlk thread'in: `thread::spawn`

Yeni bir thread açmak için `std::thread::spawn`'a bir **closure** verirsin (Modül 14). Closure, yeni
thread'in çalıştıracağı koddur:

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let tutamac = thread::spawn(|| {
        for i in 1..=3 {
            println!("  kurye: {i}. paket teslim edildi");
            thread::sleep(Duration::from_millis(2));
        }
    });

    for i in 1..=3 {
        println!("depo: {i}. paket hazırlandı");
        thread::sleep(Duration::from_millis(2));
    }

    tutamac.join().unwrap(); // kuryenin işini bitirmesini bekle
    println!("Gün bitti.");
}
```

Birkaç kez **Çalıştır**'a bas. Satırların sırası her seferinde değişebilir! Hangi thread'in ne zaman
çalışacağına işletim sisteminin **zamanlayıcısı (scheduler)** karar verir ve bu karar senin kontrolünde
değildir. `thread::sleep(Duration::from_millis(2))` o thread'i 2 milisaniye uyutur; bu sırada diğer
thread'e fırsat doğar. Ama uyku bile sırayı **garanti etmez**, sadece olasılığı değiştirir.

Bu kodda üç yeni parça var:

1. `thread::spawn(closure)` yeni bir OS thread'i başlatır ve hemen döner; ana thread beklemeden yoluna devam eder.
2. Dönen değer bir **`JoinHandle`** (birleştirme tutamacı) — thread'in "kumandası".
3. `tutamac.join()` ana thread'i, o thread **bitene kadar** bekletir.

Peki `join` hiç çağrılmazsa ne olur? Tahmin etmeye çalış:

````quiz
question: |
  Aşağıdaki programda `join` yok. Hangi ifadeler **her çalıştırmada kesinlikle** doğrudur? (Birden fazla seçenek olabilir.)

  ```rust
  use std::thread;
  use std::time::Duration;

  fn main() {
      thread::spawn(|| {
          for i in 1..=3 {
              println!("yan thread: {i}");
              thread::sleep(Duration::from_millis(1));
          }
      });
      println!("main bitti");
  }
  ```
options:
  - "`yan thread: 3` satırı her zaman yazdırılır"
  - "`main bitti` satırı her zaman yazdırılır"
  - "Yan thread'in yazdırabildiği satırlar her zaman 1, 2, 3 sırasıyla çıkar"
  - "`main bitti` her zaman en son satırdır"
answer: [1, 2]
explanation: |
  **`main` döndüğünde süreç biter ve diğer bütün thread'ler yarıda kesilir.** Yan thread'in hiçbir satır
  yazamaması da, bir-iki satır yazması da mümkündür; `yan thread: 3`'ün garantisi yoktur.
  Kesin olanlar: ana thread'in kendi `println!`'i mutlaka çalışır ve **tek bir thread'in içindeki** işler
  her zaman yazıldığı sırayla yürür (1, 2, 3 karışmaz). `main bitti`'nin en son satır olması da garanti
  değil: `main` yazdırdıktan sonra süreç kapanana kadar geçen kısa sürede yan thread bir satır daha
  yazabilir.
feedback:
  - "`main` bitince süreç kapanır; yan thread'in işini bitirmesi beklenmez."
  - Doğru, ana thread kendi satırını mutlaka yazar.
  - Doğru, tek bir thread içindeki sıra korunur; karışan, thread'ler **arasındaki** sıradır.
  - "`main`'in `println!`'i ile sürecin kapanması arasında yan thread bir satır yazabilir."
````

:::warning Ana thread biterse herkes gider
Python'da veya Java'da program, ana olmayan (non-daemon) thread'ler bitene kadar açık kalır. Rust'ta
öyle değil: `main` döndüğü an süreç sonlanır ve tüm thread'ler **haber verilmeden** kesilir. Bir thread'in
işini bitirmesini istiyorsan onu **`join` etmek senin sorumluluğun.**
:::

## `JoinHandle` ve `join`: sonuç toplamak

Thread'ler sadece yan etki (yazdırma) üretmez; closure'ın **döndürdüğü değer** `join` ile geri gelir.
`thread::spawn` aslında `JoinHandle<T>` döndürür; `T`, closure'ın dönüş tipidir:

```rust
use std::thread;

fn main() {
    let satislar = vec![1250, 980, 1430, 760]; // bir şubenin günlük satışları (TL)

    let tutamac = thread::spawn(move || {
        let toplam: u32 = satislar.iter().sum();
        toplam // closure'ın dönüş değeri → JoinHandle<u32>
    });

    // Bu arada ana thread başka işler yapabilir...
    println!("Hesap yan thread'de yapılıyor");

    let toplam = tutamac.join().unwrap();
    println!("Şube toplamı: {toplam} TL");
}
```

Buradaki `move`'u birazdan ayrıntılı göreceğiz; şimdilik "`satislar`'ın sahipliği thread'e geçiyor"
diye oku. Bellekte olan biten şöyle:

```memory
title: Sahiplik thread'e geçiyor
steps:
  - caption: "Başta tek thread var. `satislar` ana thread'in stack'inde; elemanlar heap'te."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: satislar, type: "Vec<u32>", value: "ptr · len=4 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "1250 980 1430 760" }
  - caption: "`thread::spawn(move || ...)`: `Vec` başlığı closure'a **taşındı**. Yeni thread'in **kendi stack'i** var; heap ise ortak."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: satislar, type: "Vec<u32>", value: "ptr · len=4 · cap=4", moved: true, note: taşındı }
          - { name: tutamac, type: "JoinHandle<u32>", value: "thread #2" }
      - frame: "thread #2 · closure"
        vars:
          - { name: satislar, type: "Vec<u32>", value: "ptr · len=4 · cap=4", to: h1 }
    heap:
      - { id: h1, value: "1250 980 1430 760" }
  - caption: "Closure bitti: `satislar` thread içinde drop edildi, heap belleği serbest. `join` toplamı ana thread'e getirdi."
    stack:
      - frame: "ana thread · main"
        vars:
          - { name: satislar, type: "Vec<u32>", value: "ptr · len=4 · cap=4", moved: true, note: taşındı }
          - { name: toplam, type: u32, value: "4420" }
    heap:
      - { id: h1, value: "1250 980 1430 760", freed: true }
```

`join`'in imzası neden `.unwrap()` istiyor? Çünkü `join()` bir **`Result`** döndürür:
thread normal biterse `Ok(değer)`, **paniğe kapılırsa** `Err(...)`. Bir thread'in paniği bütün
programı çökertmez; yalnızca o thread çözülür (unwind) ve paniği `join` eden tarafa bir hata değeri
olarak ulaşır:

```rust
use std::thread;

fn main() {
    let saglam = thread::spawn(|| 10 / 2);
    let bozuk = thread::spawn(|| {
        let bolen = 0;
        if bolen == 0 {
            panic!("sıfıra bölme!");
        }
        10 / bolen
    });

    println!("sağlam: {:?}", saglam.join());
    match bozuk.join() {
        Ok(v) => println!("bozuk: {v}"),
        Err(_) => println!("bozuk thread paniğe kapıldı ama main yaşıyor"),
    }
}
```

`Err` içindeki değerin tipi `Box<dyn Any + Send>`'dir: "herhangi bir tipte olabilen panik yükü". `dyn`
ile yazılan bu **trait nesnelerini** Modül 20'de göreceğiz; şimdilik `Err(_)` ile yakalamak yeterli.

:::info Sıra `join` ile sabitlenir
Thread'ler hangi sırayla **biterse** bitsin, tutamaçları **senin seçtiğin** sırayla `join` edersen
sonuçlar da o sırayla gelir. Bu, deterministik (her çalıştırmada aynı) çıktı almanın en temel yoludur.
:::

```predict
code: |
  use std::thread;

  fn main() {
      let mut tutamaclar = Vec::new();
      for i in 1..=4 {
          tutamaclar.push(thread::spawn(move || i * i));
      }

      let mut sonuclar = Vec::new();
      for t in tutamaclar {
          sonuclar.push(t.join().unwrap());
      }
      println!("{sonuclar:?}");
  }
options:
  - "[1, 4, 9, 16]"
  - "Her çalıştırmada farklı bir sıra, ör. [4, 1, 16, 9]"
  - "[16, 9, 4, 1]"
  - "Derlenmez: `i` döngüden sonra yaşamıyor"
answer: 0
explanation: |
  Dört thread herhangi bir sırayla **bitebilir**, ama sonuçları `tutamaclar` vektörünün sırasıyla, yani
  1., 2., 3., 4. thread sırasıyla `join` ediyoruz. Her `join` o belirli thread'in sonucunu verir; bu yüzden
  çıktı her zaman `[1, 4, 9, 16]`. `move` sayesinde her closure kendi `i` kopyasını alır (`i32` `Copy`),
  döngü değişkeninin ömrü sorun olmaz.
```

## `move` closure'lar ve `E0373`

`move` anahtar kelimesini Modül 14'te görmüştün. Thread'lerde neden **neredeyse her zaman** gerekli?
Önce tahmin et:

```compiles
code: |
  use std::thread;

  fn main() {
      let sepet = vec!["elma", "armut", "kiraz"];
      let h = thread::spawn(|| {
          println!("Sepette {} meyve var", sepet.len());
      });
      h.join().unwrap();
  }
answer: false
error: E0373
explanation: |
  Closure `sepet`'i yalnızca okuyor, bu yüzden Rust onu **referansla** yakalamaya çalışır. Ama yeni
  thread, `main` fonksiyonundan **daha uzun yaşayabilir**; derleyicinin gözünde `sepet` thread hâlâ onu
  okurken drop edilebilir. Sarkan referans (Modül 5) riski olduğu için kod reddedilir.
```

"Ama `join` ediyorum, thread `main`'den önce bitiyor!" diyebilirsin. Haklısın, ama derleyici bunu
**imzaya bakarak** karar verir, `join`'i takip etmez. `thread::spawn`'ın imzası şöyle:

```rust,ignore
pub fn spawn<F, T>(f: F) -> JoinHandle<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
```

Önceki modüllerden tanıdığın her parça bir şey söylüyor:

- **`FnOnce() -> T`** (Modül 14): closure bir kez çalıştırılacak ve `T` döndürecek.
- **`'static`** (Modül 12): closure **ödünç alınmış kısa ömürlü veri tutamaz**; ya her şeye sahip
  olmalı ya da yalnızca `'static` referanslar taşımalı. Çünkü `JoinHandle`'ı hiç `join` etmeyip
  düşürebilirsin; o zaman thread program boyunca yaşayabilir.
- **`Send`**: closure ve içindekiler başka bir thread'e güvenle **gönderilebilir** olmalı. Bunu 4. derste
  derinlemesine göreceğiz.

Derleyici hem sorunu hem çözümü söylüyor:

:::error
```text
error[E0373]: closure may outlive the current function, but it borrows `sepet`, which is owned by the current function
 --> src/main.rs:5:27
  |
5 |     let h = thread::spawn(|| {
  |                           ^^ may outlive borrowed value `sepet`
6 |         println!("Sepette {} meyve var", sepet.len());
  |                                          ----- `sepet` is borrowed here
  |
note: function requires argument type to outlive `'static`
help: to force the closure to take ownership of `sepet` (and any other referenced variables), use the `move` keyword
  |
5 |     let h = thread::spawn(move || {
  |                           ++++
```
"closure may outlive the current function" = closure bu fonksiyondan uzun yaşayabilir. `note` satırı
sebebi (`'static` şartı), `help` satırı çözümü (`move`) gösteriyor.
:::

C++'ta aynı hatayı yapmak çok kolaydır: `std::thread t([&]{ ... });` yerel değişkenleri referansla
yakalar, fonksiyon dönünce thread **ölü belleği** okur. Derleyici ses çıkarmaz, program bazen çalışır
bazen çöker. Rust aynı hatayı derlemez.

`move` ile değer thread'e **taşınır**. Taşıma kurallarını (Modül 4) hatırla:

```compiles
code: |
  use std::thread;

  fn main() {
      let notlar = vec![85, 92, 78];
      let h = thread::spawn(move || {
          let toplam: i32 = notlar.iter().sum();
          toplam
      });
      println!("{} not var", notlar.len());
      println!("toplam: {}", h.join().unwrap());
  }
answer: false
error: E0382
explanation: |
  `move` closure `notlar`'ın **sahipliğini** aldı; `Vec` `Copy` olmadığı için `main`'deki `notlar` artık
  geçersiz. `notlar.len()` → `E0382: borrow of moved value`. Çözümler: uzunluğu `spawn`'dan **önce** bir
  değişkene almak, bilinçli olarak `notlar.clone()`'u taşımak ya da ihtiyacın olan bilgiyi thread'in dönüş
  değeriyle geri almak (ör. `(toplam, notlar.len())` döndürmek).
```

`Copy` tiplerde ise durum farklıdır: `move` closure'a değerin bir **kopyası** girer ve orijinal geçerli
kalır. "Taşı" demek, `Copy` bir tip için "kopyala" demektir:

```rust
use std::thread;

fn main() {
    let carpan = 3; // i32 → Copy
    let h = thread::spawn(move || carpan * 14);
    println!("çarpan hâlâ burada: {carpan}");
    println!("sonuç: {}", h.join().unwrap());
}
```

```fill
prompt: |
  İsimlerdeki toplam harf sayısını yan thread'de hesaplayıp ana thread'de yazdır. Boşlukları doldur.
code: |
  use std::thread;

  fn main() {
      let isimler = vec![String::from("Ali"), String::from("Ayşe")];
      let h = thread::spawn(___0 || {
          let mut toplam = 0;
          for isim in &isimler {
              toplam += isim.chars().count();
          }
          toplam
      });
      let harf = h.___1().unwrap();
      println!("{harf}");
  }
blanks:
  - ["move"]
  - ["join"]
output: "7"
explanation: |
  `move` olmadan closure `isimler`'i ödünç almaya çalışır ve `E0373` alırsın. `join()` thread bitene kadar
  bekler ve closure'ın döndürdüğü `toplam`'ı `Result` içinde verir. `"Ayşe"` 4 harf: `chars().count()`
  bayt değil karakter sayar (Modül 9) — `len()` kullansaydık `ş` 2 bayt olduğu için 8 çıkardı.
```

## Sıra belirsizliği ve deterministik sonuçlar

Üç thread'in aynı anda yazdırdığı bu programı birkaç kez çalıştır:

```rust
use std::thread;

fn main() {
    let mut tutamaclar = Vec::new();
    for istasyon in ["Ankara", "İzmir", "Van"] {
        tutamaclar.push(thread::spawn(move || {
            println!("{istasyon} istasyonu ölçüm gönderdi");
        }));
    }
    for t in tutamaclar {
        t.join().unwrap();
    }
}
```

Satırlar her seferinde farklı sırada gelebilir. Buna **sıra belirsizliği (nondeterminism)** denir ve
thread'lerle çalışmanın doğal bir parçasıdır. Testlerde, kontrol sorularında ve gerçek programlarda
**sonucun sıraya bağlı olmaması** gerekir. Üç güvenilir teknik:

1. **Yazdırmayı thread'lere değil ana thread'e bırak:** thread'ler değer döndürsün, sen `join` edip
   sabit sırayla yazdır.
2. **Toplanan sonuçları sırala:** sıra anlamsızsa `sort()` ile tek bir düzene sok.
3. **Sıradan bağımsız işlemler kullan:** toplama, sayma, en büyüğü bulma gibi işlemler sıradan etkilenmez.

Iterator'larla (Modül 14) bunu kısaca yazabilirsin. Ama bir tuzak var:

````quiz
question: |
  `agir_hesap` uzun süren bir fonksiyon olsun. Bu kod dört hesabı **paralel** çalıştırır mı?

  ```rust
  let sonuclar: Vec<u64> = (1..=4)
      .map(|i| thread::spawn(move || agir_hesap(i)))
      .map(|h| h.join().unwrap())
      .collect();
  ```
options:
  - Evet, `map` dört thread'i aynı anda başlatır
  - Hayır; iterator'lar tembel olduğu için her eleman sırayla önce spawn sonra join edilir, yani hesaplar art arda çalışır
  - Derlenmez, `JoinHandle` bir iterator'da tutulamaz
answer: 1
explanation: |
  Iterator'lar **tembeldir (lazy)** ve elemanları **teker teker** zincirin sonuna kadar götürür (Modül 14).
  1 için thread açılır ve hemen `join` edilir, ancak o bitince 2 için thread açılır... Sonuç doğru ama
  paralellik yok! Çözüm: önce tutamaçları bir `Vec`'e **topla**, sonra ayrı bir döngüde `join` et:

  ```rust
  let tutamaclar: Vec<_> = (1..=4).map(|i| thread::spawn(move || agir_hesap(i))).collect();
  let sonuclar: Vec<u64> = tutamaclar.into_iter().map(|h| h.join().unwrap()).collect();
  ```
feedback:
  - "`map` tek başına hiçbir şey çalıştırmaz; elemanlar `collect` onları çektikçe tek tek işlenir."
  - Doğru! Ara `collect` olmadan spawn ve join iç içe geçer.
  - "`JoinHandle` sıradan bir değer; iterator'da da `Vec`'te de tutulabilir."
````

Şimdi doğru kalıbı kendin kur:

```parsons
prompt: Üç thread aç, her biri `i * 10` döndürsün; hepsini topladıktan sonra `join` edip toplamı yazdır (çıktı `60`).
lines: |
  use std::thread;
  fn main() {
      let mut tutamaclar = Vec::new();
      for i in 1..=3 {
          tutamaclar.push(thread::spawn(move || i * 10));
      }
      let mut toplam = 0;
      for h in tutamaclar {
          toplam += h.join().unwrap();
      }
      println!("{toplam}");
  }
distractors: |
          tutamaclar.push(thread::spawn(|| i * 10));
          toplam += h.join();
explanation: |
  Önce **bütün** thread'ler başlatılıp tutamaçlar biriktiriliyor, sonra ayrı bir döngüde `join` ediliyor;
  böylece üçü aynı anda çalışabilir. Çeldiriciler: `move`'suz closure `i`'yi ödünç almaya çalışır (`E0373`);
  `h.join()` ise bir `Result` döndürür, doğrudan sayıya eklenemez (`E0277`).
```

:::deep Thread'lerin bedeli ve `thread::Builder`
Bir OS thread'i açmak bedava değildir: çekirdek bir yapı oluşturur ve Rust'ta yeni thread'lere varsayılan
olarak **2 MiB'lık** bir stack ayrılır (çoğu sayfa gerçekten kullanılmadıkça fiziksel belleğe yansımaz).
Açılış birkaç mikrosaniye sürer. Bu yüzden her küçük iş için thread açmak yerine işi **büyük parçalara**
bölmek iyi bir alışkanlıktır. On binlerce eşzamanlı bekleyen iş (ör. ağ bağlantıları) için thread yerine
**async** kullanılır (Modül 19).

İsim veya stack boyutu vermek istersen `thread::Builder` var:
```rust
use std::thread;

fn main() {
    let h = thread::Builder::new()
        .name("rapor-uretici".to_string())
        .stack_size(4 * 1024 * 1024)
        .spawn(|| thread::current().name().map(String::from))
        .expect("thread açılamadı");
    println!("{:?}", h.join().unwrap()); // Some("rapor-uretici")
}
```
`std::thread::available_parallelism()` ise makinenin kaç thread'i gerçekten paralel çalıştırabileceğini
tahmin eder: kaç parçaya bölmen gerektiğine karar verirken işe yarar.
:::

## Alıştırma: şube satışlarını paralel topla

```exercise
title: Bölgelere ayır, paralel topla
difficulty: 3
prompt: |
  Bir market zincirinin şubelerinden gelen günlük satış tutarları tek bir dilimde duruyor. Bunları
  `parca_sayisi` kadar **bölgeye** ayırıp her bölgenin toplamını **ayrı bir thread'de** hesapla.

  `bolge_toplamlari(satislar: &[u64], parca_sayisi: usize) -> Vec<u64>` fonksiyonunu yaz:

  - Parça boyutu `satislar.len()`'in `parca_sayisi`'na bölümünün **yukarı yuvarlanmış** hâli olsun
    (10 satış, 3 parça → parçalar 4 + 4 + 2).
  - Her parça için bir thread aç; thread o parçanın toplamını döndürsün.
  - Sonuçları **bölge sırasıyla** (ilk parça önce) döndür.
  - `parca_sayisi` 0 gelirse 1 kabul et; `satislar` boşsa boş `Vec` döndür.
starter: |
  use std::thread;

  fn bolge_toplamlari(satislar: &[u64], parca_sayisi: usize) -> Vec<u64> {
      todo!()
  }

  fn main() {
      let satislar = [120, 340, 90, 410, 280, 150, 75, 600, 330, 210];
      let toplamlar = bolge_toplamlari(&satislar, 3);
      println!("{toplamlar:?}");
  }
solution: |
  use std::thread;

  fn bolge_toplamlari(satislar: &[u64], parca_sayisi: usize) -> Vec<u64> {
      if satislar.is_empty() {
          return Vec::new();
      }
      let parca_sayisi = parca_sayisi.max(1);
      let boyut = satislar.len().div_ceil(parca_sayisi);

      let mut tutamaclar = Vec::new();
      for parca in satislar.chunks(boyut) {
          let parca = parca.to_vec(); // thread'e sahip olduğu bir kopya ver
          tutamaclar.push(thread::spawn(move || parca.iter().sum::<u64>()));
      }

      tutamaclar
          .into_iter()
          .map(|t| t.join().expect("bölge thread'i paniğe kapıldı"))
          .collect()
  }

  fn main() {
      let satislar = [120, 340, 90, 410, 280, 150, 75, 600, 330, 210];
      let toplamlar = bolge_toplamlari(&satislar, 3);
      println!("{toplamlar:?}");
  }
check: tests
tests: |
  #[test]
  fn on_satis_uc_bolge() {
      let satislar = [120, 340, 90, 410, 280, 150, 75, 600, 330, 210];
      assert_eq!(
          bolge_toplamlari(&satislar, 3),
          vec![960, 1105, 540],
          "10 satış 3 bölgeye 4 + 4 + 2 olarak bölünmeli ve sıra korunmalı"
      );
  }

  #[test]
  fn tam_bolunen_dizi() {
      let satislar: Vec<u64> = (1..=100).collect();
      let t = bolge_toplamlari(&satislar, 4);
      assert_eq!(t.len(), 4, "100 eleman 4 parçaya tam bölünür");
      assert_eq!(t[0], 325, "ilk bölge 1..=25'in toplamıdır");
      assert_eq!(t.iter().sum::<u64>(), 5050, "bölge toplamlarının toplamı genel toplama eşit olmalı");
  }

  #[test]
  fn parca_sayisi_elemandan_fazla() {
      assert_eq!(bolge_toplamlari(&[5, 7], 10), vec![5, 7], "2 satış varsa en fazla 2 bölge olur");
  }

  #[test]
  fn sinir_durumlari() {
      assert_eq!(bolge_toplamlari(&[], 3), Vec::<u64>::new(), "boş girdi boş sonuç vermeli");
      assert_eq!(bolge_toplamlari(&[4, 6, 10], 0), vec![20], "parça sayısı 0 ise 1 kabul edilmeli");
  }
hints:
  - "Dilimlerin `chunks(boyut)` metodu dilimi en fazla `boyut` elemanlık parçalara böler. Yukarı yuvarlanmış bölme için `a.div_ceil(b)` var."
  - "Bir thread'e `&[u64]` parçası veremezsin (`'static` şartı); `parca.to_vec()` ile sahip olunan bir `Vec` oluşturup `move` ile taşı. Tutamaçları önce bir `Vec`'te biriktir."
  - "Boş girdiyi en başta yakala: `chunks(0)` paniğe yol açar. Son adım: `tutamaclar.into_iter().map(|t| t.join().unwrap()).collect()`."
require:
  - pattern: "thread::spawn"
    message: Her bölgeyi ayrı bir thread'de topla — `thread::spawn` kullanmalısın.
explanation: |
  Çözümün iskeleti eşzamanlı Rust kodunun en sık kalıbıdır: **böl → her parçayı bir thread'e taşı →
  tutamaçları topla → sırayla `join` et.** Sonuçların sırası, thread'lerin bitiş sırasından değil, `join`
  sırasından gelir; bu yüzden çıktı deterministiktir.

  Neden `parca.to_vec()`? Çünkü `thread::spawn` `'static` bir closure istiyor; `satislar` dilimi çağıranın
  belleğine bir referans ve derleyici thread'in o bellekten uzun yaşamayacağını kanıtlayamaz. Kopyalamak
  burada küçük bir bedel. 5. derste göreceğin **`thread::scope`** ile bu kopyaya hiç gerek kalmadan
  dilimi doğrudan ödünç verebileceksin.

  Gerçek hayatta bu kadar küçük işler için thread açmak, thread açma maliyeti yüzünden düz bir döngüden
  **daha yavaş** olabilir. Paralellik, parça başına iş yeterince büyük olduğunda kazandırır.
```

## Özet

:::remember
- **Eşzamanlılık** = işlerin aynı zaman diliminde ilerlemesi; **paralellik** = gerçekten aynı anda çalışması.
- `thread::spawn(closure)` yeni bir OS thread'i açar ve `JoinHandle<T>` döndürür.
- `join()` thread'in bitmesini bekler; `Ok(değer)` ya da thread paniklediyse `Err` döner.
- `main` bitince bütün thread'ler kesilir → bitmesi gereken thread'leri `join` et.
- `spawn` `'static` closure ister → yerel veriyi `move` ile taşı; yoksa `E0373`.
- Thread'ler arası sıra belirsizdir; deterministik sonuç için sabit sırayla `join` et ya da sırala.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla — sen `join` çağırdığın hâlde derleyici neden `move`'suz closure'ı
  (`E0373`) reddediyor?
answer: |
  Derleyici kararını `thread::spawn`'ın **imzasına** bakarak verir: closure `'static` olmalıdır. İmza,
  benim `join` çağırıp çağırmayacağımı bilmez; tutamacı düşürüp thread'i `main`'den uzun yaşatabilirim.
  Bu durumda thread, drop edilmiş yerel bir değişkeni referansla okumaya devam ederdi (sarkan referans).
  `move` ile veriyi thread'e taşıdığımda thread verinin sahibi olur, ömür sorunu ortadan kalkar.
```

```flashcards
- front: Eşzamanlılık (concurrency) ile paralellik (parallelism) arasındaki fark nedir?
  back: Eşzamanlılık işlerin aynı zaman diliminde (sırayla da olsa) ilerlemesi; paralellik ise farklı çekirdeklerde gerçekten aynı anda çalışmasıdır.
- front: "`thread::spawn` ne döndürür?"
  back: "Bir `JoinHandle<T>`; `T` closure'ın dönüş tipidir. `join()` ile sonuca ulaşılır."
- front: "`main` fonksiyonu dönerken hâlâ çalışan thread'lere ne olur?"
  back: Süreç sonlanır ve hepsi haber verilmeden kesilir; işlerini bitirmeleri için `join` edilmeleri gerekir.
- front: "`handle.join()` neden bir `Result` döndürür?"
  back: "Thread paniğe kapılmış olabilir: normal bitişte `Ok(değer)`, panikte `Err(panik yükü)` gelir."
- front: "`E0373` (closure may outlive the current function) hatasının çözümü nedir?"
  back: "Closure'ı `move` yapıp yerel veriyi thread'e taşımak; çünkü `spawn` `'static` closure ister."
- front: "`thread::spawn`'ın closure için istediği üç şart nedir?"
  back: "`FnOnce() -> T`, `Send` ve `'static`."
- front: Thread sonuçlarını deterministik sırada almanın en basit yolu nedir?
  back: Tutamaçları bir `Vec`'te toplayıp sabit sırayla `join` etmek (gerekirse sonuçları sıralamak).
- front: "`(1..=4).map(spawn).map(join).collect()` neden paralel çalışmaz?"
  back: Iterator'lar tembeldir; her eleman sırayla spawn edilip hemen join edilir. Önce tutamaçları `collect` etmek gerekir.
