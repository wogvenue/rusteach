---
id: m04-l02
title: Sahiplik kuralları ve kapsam
minutes: 17
type: lesson
objectives:
  - Rust'ın üç sahiplik kuralını söyleyip her birinin hangi bellek hatasını önlediğini açıklayabilmek
  - Bir değerin hangi satırda drop edileceğini kapsamlara bakarak bulabilmek
  - "String literali (`&str`) ile `String` arasındaki farkı bellek yerleşimi üzerinden açıklayabilmek"
  - RAII fikrini dosya gibi kaynakların otomatik kapanmasıyla ilişkilendirebilmek
keywords: [sahiplik, ownership, sahip, owner, kapsam, scope, drop, RAII, String::from, push_str, "&str", E0425, E0596, E0599]
---

Önceki derste Rust'ın üçüncü yolunu gördün: heap belleğini ne programcı ne de bir çöp toplayıcı geri
verir; değerin **sahibi** kapsamdan çıktığında, derleyicinin oraya yerleştirdiği kod geri verir.

Bu derste o fikrin arkasındaki **üç kısa kuralı** öğreneceksin. Rust'ın bütün bellek güvenliği,
sonraki modüllerde göreceğin ödünç alma, yaşam süreleri ve akıllı işaretçiler de dahil, bu üç cümlenin
üzerine kurulu.

## Üç kural

Kuralları okumadan önce kısa bir programa bak. Yorumlar, her değerin kime ait olduğunu ve ne zaman
ortadan kalktığını söylüyor:

```rust
fn main() {
    let sehir = String::from("Trabzon"); // sehir, bu String'in sahibi
    println!("Sahibi sehir olan değer: {sehir}");
    {
        let baska = String::from("Gaziantep"); // baska, kendi String'inin sahibi
        println!("{sehir} ve {baska}");
    } // baska'nın kapsamı bitti → "Gaziantep" drop edildi
    println!("Hâlâ buradayım: {sehir}");
} // sehir'in kapsamı bitti → "Trabzon" drop edildi
```

Programda iki `String` değeri var ve her birinin tam olarak bir sahibi var: `sehir` ve `baska`. Hiçbir
yerde `free` yazmadık; yine de iki heap alanı da tam zamanında geri veriliyor. Bunu sağlayan, Rust'ın üç
**sahiplik (ownership)** kuralı:

:::remember Sahipliğin üç kuralı
1. Rust'ta her değerin bir **sahibi (owner)** vardır.
2. Bir değerin aynı anda **yalnızca bir** sahibi olabilir.
3. Sahip **kapsam (scope)** dışına çıktığında değer **drop edilir**.
:::

**Drop** (İngilizcede "bırakmak"), bir değerin ömrünün sona ermesidir: değer heap'te bellek tutuyorsa o
bellek geri verilir, açık bir dosya gibi başka bir kaynak tutuyorsa o da kapatılır. Her kural, önceki
derste gördüğün hatalardan birini kökünden keser:

- **Kural 1**, "bu belleği kim geri verecek?" sorusunu asla cevapsız bırakmaz: sahibi.
- **Kural 2**, iki kez geri vermeyi imkânsız kılar. İki sahip olsaydı ikisi de kendi kapsamının sonunda
  aynı belleği geri vermeye kalkardı: double free.
- **Kural 3**, geri vermeyi otomatik yapar; unutamazsın. Üstelik değer drop edildiğinde sahibi de
  kapsam dışındadır, yani o isimle değere bir daha ulaşamazsın: use-after-free'ye kapı kapanır.
  (Değere **referanslar** üzerinden ulaşma yollarını ise Modül 5'teki ödünç alma kuralları denetler.)

(Rust sızıntıyı *tamamen* imkânsız kılmaz; Modül 17'de bile isteye sızıntı yaratmanın yollarını
göreceksin. Ama "geri vermeyi unuttum" diye bir hata Rust'ta yoktur.)

Modül 1'deki restoran benzetmesini hatırla: Rust mutfağında her tabağın **tek bir sorumlusu** vardı ve
sorumlu işini bitirdiği anda tabak yıkanıyordu. O sorumlunun Rust'taki adı **sahip**.

:::analogy Lunaparkta balonlar
Bir lunaparkta her balonun ipini **bir çocuk** tutar (kural 1). Aynı ipi iki çocuk birden tutamaz;
balon el değiştirebilir ama ipi tutan hep **tek kişidir** (kural 2). Çocuk lunaparktan çıkarken balonu
bırakır, İngilizcesiyle *drop*, ve görevliler onu hemen toplar (kural 3). Böylece sahipsiz kalıp
unutulan balon olmaz (sızıntı yok), aynı balon da iki kez toplanmaz (double free yok).
:::

```quiz
question: |
  Sahipliğin 2. kuralı ("bir değerin aynı anda yalnızca bir sahibi olabilir") önceki derste gördüğün
  hangi hatayı doğrudan engeller?
options:
  - Double free, aynı belleği iki kez serbest bırakmak
  - Bellek sızıntısı, belleği hiç geri vermemek
  - Tam sayı taşması (integer overflow)
  - Stack taşması (stack overflow)
answer: 0
explanation: |
  Değer, kapsam dışına çıkan **sahibi** tarafından drop edilir (kural 3). İki sahip olsaydı, ikisi de
  kendi kapsamının sonunda aynı belleği geri vermeye çalışırdı: double free. Tek sahip, tek geri verme
  demektir. Sızıntıyı engelleyen ise kural 3'tür: drop otomatik olduğu için unutulamaz.
feedback:
  - Doğru! Tek sahip, tek geri verme demektir.
  - Sızıntıya karşı koruma kural 3'ten gelir; drop otomatik olduğu için unutulamaz.
  - "Taşma bir sayı hatasıdır (Modül 2): debug derlemede panik, release derlemede sarma. Sahiplikle ilgisi yok."
  - Stack taşması çok derin iç içe çağrılardan doğar; sahiplik kuralları onu engellemez.
```

## Kapsamın sonu: drop

Modül 2'de Ferris sana bir söz vermişti: kapsam fikrine Modül 4'te geri dönecektik. Hatırlayalım:
`{ }` bir **kapsam** açar; içeride tanımlanan değişken, tanımlandığı satırdan bloğun kapanan `}`'sine
kadar yaşar. Sahiplikle birlikte o `}` yeni bir anlam kazanıyor: **değerlerin drop edildiği yer**
orasıdır. Dersin başındaki şehir programının belleğine bak:

```memory
title: Şehir programının kapsamları
steps:
  - caption: "İç bloğun içi: `sehir` ve `baska` kapsamda; ikisi de heap'teki kendi verisinin tek sahibi."
    stack:
      - frame: main
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: baska, type: String, value: "ptr · len=9 · cap=9", to: h2 }
    heap:
      - { id: h1, value: "T r a b z o n" }
      - { id: h2, value: "G a z i a n t e p" }
  - caption: "İç bloğun `}`'si: `baska`'nın kapsamı bitti, değeri drop edildi ve heap'teki 9 bayt geri verildi. `sehir` hâlâ yaşıyor."
    stack:
      - frame: main
        vars:
          - { name: sehir, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "T r a b z o n" }
      - { id: h2, value: "G a z i a n t e p", label: "baska'nın verisi", freed: true }
  - caption: "`main`'in `}`'si: sıra `sehir`'de. Programın ayırdığı bütün heap belleği, tek satır temizlik kodu yazmadan geri verildi."
    stack:
      - frame: main
        vars: []
    heap:
      - { id: h1, value: "T r a b z o n", label: "sehir'in verisi", freed: true }
      - { id: h2, value: "G a z i a n t e p", label: "baska'nın verisi", freed: true }
```

Drop'u gözünle görmek için bu modülde **`Balon`** adında küçük bir yardımcı tip kullanacağız. Nasıl
yazıldığı kodun gizli satırlarında duruyor (kendi tiplerini yazmayı Modül 6'da, drop anında çalışacak
kodu Modül 17'de öğreneceksin). Tek bilmen gereken: bir `Balon` drop edildiği anda ekrana
`... balon patladı` yazar. Hem iç içe kapsamları hem de aynı kapsamdaki sırayı düşünerek tahmin et:

```predict
question: Balonlar hangi sırayla patlar?
code: |
  # struct Balon(&'static str);
  # impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
  fn main() {
      let _a = Balon("kırmızı");
      {
          let _b = Balon("mavi");
          println!("iç blok bitiyor");
      }
      let _c = Balon("yeşil");
      println!("main bitiyor");
  }
options:
  - |
    iç blok bitiyor
    main bitiyor
    kırmızı balon patladı
    mavi balon patladı
    yeşil balon patladı
  - |
    iç blok bitiyor
    mavi balon patladı
    main bitiyor
    yeşil balon patladı
    kırmızı balon patladı
  - |
    iç blok bitiyor
    mavi balon patladı
    main bitiyor
    kırmızı balon patladı
    yeşil balon patladı
answer: 1
explanation: |
  Her balon, sahibinin kapsamı bittiği anda patlar. `_b`'nin kapsamı iç bloğun `}`'sinde biter; bu
  yüzden mavi balon "main bitiyor" yazısından **önce** patlar. `_a` ile `_c` aynı kapsamda: `main`'in
  sonunda ikisi birden kapsam dışına çıkar ve **tanımlandıkları sıranın tersiyle** drop edilir. Önce
  yeşil, sonra kırmızı.
feedback:
  - "Mavi balonun sahibi `_b` iç blokta yaşıyor; iç bloğun `}`'si geldiğinde patlar, `main`'in sonunu beklemez."
  - Doğru! İç kapsam önce temizlenir; aynı kapsamdakiler ters sırayla gider.
  - "Kapsam sırası doğru, ama aynı kapsamdaki değerler tanımlanma sırasının **tersiyle** drop edilir: önce `_c`, sonra `_a`."
```

Neden ters sıra? Sonra tanımlanan bir değer, daha önce tanımlanmış birine dayanıyor olabilir (Modül 5'te
göreceğin referanslar gibi). Önce dayanan değeri temizlemek, temizlik sırasında hiçbir değerin çoktan
yok olmuş bir şeye yaslanmamasını garanti eder. Stack'in LIFO düzenini hatırla: son giren ilk çıkar.

Kapsamı biten bir değişkeni kullanmaya kalkarsan Modül 2'den tanıdığın `E0425` hatasını alırsın. Bu bir
**isim** hatasıdır: derleyici o noktada öyle bir isim görmez. Artık arka planı da biliyorsun: isim kapsam
dışına çıkarken, ona bağlı değer de (başka bir yere verilmediyse) drop edildi. Peki iç blokta
hazırladığın bir değeri dışarıda kullanmak istersen? Modül 3'teki **blok ifadeleri** tam bunun için var: bloğun son ifadesi,
bloğun değeridir.

```rust
fn main() {
    let sehir = {
        let ad = String::from("Mardin");
        println!("{ad} çok güzel");
        ad // bloğun son ifadesi: değer dışarı verilir
    };
    println!("{sehir} hâlâ aklımda");
}
```

Bu sefer "Mardin" drop edilmedi: blok bitmeden değer `sehir`'e **verildi** ve sahibi değişti. Heap'teki
metin yerinden kıpırdamadı; değişen yalnızca sahibiydi. Sahibin bu şekilde değişmesine **taşıma
(move)** denir ve bir sonraki dersin konusu tam olarak bu.

## Gölgeleme drop etmez

Modül 2'de **gölgelemeyi (shadowing)** öğrenmiştin: aynı isimle yeni bir `let` yazınca eski değişken
görünmez olur. Peki görünmez olan değer drop edilir mi?

```predict
question: Gölgelenen balonlar ne zaman patlar?
code: |
  # struct Balon(&'static str);
  # impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
  fn main() {
      let _balon = Balon("mavi");
      let _balon = Balon("sarı");
      let _balon = Balon("yeşil");
      println!("main bitiyor");
  }
options:
  - |
    main bitiyor
    yeşil balon patladı
    sarı balon patladı
    mavi balon patladı
  - |
    mavi balon patladı
    sarı balon patladı
    main bitiyor
    yeşil balon patladı
  - |
    main bitiyor
    yeşil balon patladı
answer: 0
explanation: |
  Gölgeleme yalnızca **ismi** yeni değere bağlar. Eski değerler yaşamaya devam eder; sadece onlara
  isimle ulaşamazsın. Üç balonun sahibi de `main`'in kapsamında olduğu için üçü de `main`'in sonunda,
  ters sırayla patlar. Hiçbiri erken patlamaz, hiçbiri sahipsiz kalmaz.
feedback:
  - Doğru! Gölgeleme değeri yok etmez, sadece gizler.
  - "Gölgeleme drop etmez: aynı ismi `let` ile yeniden kullanmak eski değeri silmez, yalnızca görünmez yapar."
  - Rust sahipsiz değer bırakmaz. Gölgelenen balonların sahipleri hâlâ kapsamda; kapsam bitince onlar da patlar.
```

Bunun pratik bir sonucu var: büyük bir `String`'i gölgelersen, eski metnin heap belleği kapsamın sonuna
kadar geri verilmez. `mut` ile **yeniden atama** ise farklıdır: değişkene yeni değer verildiği anda eski
değerin sahibi kalmaz, bu yüzden eski değer **hemen** drop edilir:

```rust
# struct Balon(&'static str);
# impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
fn main() {
    let mut _balon = Balon("mavi");
    println!("atama öncesi");
    _balon = Balon("sarı"); // eski değer (mavi) TAM BURADA drop edilir
    println!("atama sonrası");
}
```

| | Gölgeleme: `let x = yeni;` | Yeniden atama: `x = yeni;` |
|---|---|---|
| Ne olur? | Aynı isimle **yeni** bir değişken doğar | **Aynı** değişkene yeni değer konur |
| Eski değer | Kapsamın sonuna kadar yaşar (başka yere taşınmadıysa, Ders 3) | Atama anında drop edilir |
| `mut` gerekir mi? | Hayır | Evet |

:::deep `_` ile `_isim` aynı şey değil
`let _a = Balon("kırmızı");` bir değişken tanımlar: balon `_a`'nın kapsamı bitene kadar yaşar. Başında
alt çizgi olması yalnızca "bu değişkeni kullanmayacağım" demektir (Modül 2). Tek başına `_` ise bir isim
**değildir**: `let _ = Balon("mavi");` değeri hiçbir değişkene bağlamaz, değerin sahibi olmadığı için o
satırın sonunda hemen drop edilir.

```rust
# struct Balon(&'static str);
# impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
fn main() {
    let _a = Balon("kırmızı"); // main'in sonuna kadar yaşar
    let _ = Balon("mavi"); // hiçbir değişkene bağlanmadı: hemen patlar
    println!("main bitiyor");
}
```

Çıktı: önce `mavi balon patladı`, sonra `main bitiyor`, en son `kırmızı balon patladı`. Bu fark,
"tutulduğu sürece etkili" değerlerde (örneğin Modül 18'deki kilitlerde) hata kaynağı olabilir.

İkinci bir tuzak: `_` değeri hiçbir şeye **bağlamadığı** için onu taşımaz da. Mevcut bir değişkenle
`let _ = sehir;` yazarsan hiçbir şey olmaz: `sehir` taşınmaz, drop edilmez, kullanılmaya devam eder.
Hemen drop edilen yalnızca hiçbir değişkene ait olmayan **geçici** değerlerdir (`Balon("mavi")` gibi).
Bir değeri bilerek erken bırakmak istersen doğru araç `drop(sehir);` çağrısıdır (Ders 5'te nasıl
çalıştığını göreceksin).
:::

## String literali mi, `String` mi?

Modül 1'den beri `"merhaba"` gibi metinler yazıyoruz; bunlara **string literali** denir
(*literal*: kaynak koda olduğu gibi yazılmış değer). Peki bir string literalini `mut` bir değişkene koyup
büyütebilir miyiz?

````compiles
code: |
  fn main() {
      let mut selam = "merhaba";
      selam.push_str(", dünya");
      println!("{selam}");
  }
answer: false
error: E0599
explanation: |
  `mut` yetmez, çünkü sorun değişkende değil, **tipte**. String literallerinin tipi `String` değil,
  `&str`'dir ve `&str`'nin `push_str` diye bir metodu yoktur:

  ```text
  error[E0599]: no method named `push_str` found for reference `&str` in the current scope
   --> src/main.rs:3:11
    |
  3 |     selam.push_str(", dünya");
    |           ^^^^^^^^ method not found in `&str`
  ```

  "`&str` için `push_str` adında bir metot bulunamadı." Neden böyle olduğunu hemen aşağıda görüyoruz.
````

String literalinin tipi **`&str`**'dir (okunuşu "ref str"; `&` işaretinin anlamını ve `&str`'nin
aslında ne olduğunu Modül 5'te göreceksin). Metin derleme zamanında bilindiği için derleyici baytlarını doğrudan **programın içine**,
çalıştırılabilir dosyanın salt okunur bir bölümüne gömer. Modül 2'deki `static` gibi, bu baytlar da
program boyunca tek ve sabit bir yerde durur; tam tipin `&'static str` olması bundandır (`'static`,
"program boyunca yaşar" demektir; Modül 12'de ayrıntısıyla). Değişkenin kendisi yalnızca o baytları
gösteren bir işaretçi ile bir uzunluk tutar. `mut` bir değişkeni başka bir literale yönlendirebilirsin
(`selam = "selam";`), ama baytların kendisini değiştiremez ya da büyütemezsin.

Büyüyebilen, değiştirilebilen ve sahibi olunan metin için **`String`** kullanırız. `String::from`, bir
string literalinin baytlarını heap'te yeni ayrılmış bir alana **kopyalar**; o heap verisinin tek sahibi
artık `String` değişkenidir. `push_str` sonuna bir metin, `push` ise tek bir karakter ekler:

```rust
fn main() {
    let literal = "merhaba"; // &str: baytlar programın içinde, salt okunur
    let mut metin = String::from(literal); // String: baytlar heap'e kopyalandı
    metin.push_str(", dünya"); // sonuna bir metin ekle
    metin.push('!'); // sonuna tek bir karakter ekle
    println!("{literal}");
    println!("{metin}");
    println!("{} bayt, kapasite {}", metin.len(), metin.capacity());
}
```

```memory
title: String literali ve String bellekte
steps:
  - caption: "`literal` programın içindeki salt okunur baytları gösteriyor; `metin` ise o baytların heap'teki **kopyasının** sahibi."
    stack:
      - frame: main
        vars:
          - { name: literal, type: "&str", value: "ptr · len=7", to: lit }
          - { name: metin, type: String, value: "ptr · len=7 · cap=7", to: h1, mut: true }
    heap:
      - { id: lit, value: "m e r h a b a", label: "programın içinde, salt okunur, heap değil" }
      - { id: h1, value: "m e r h a b a" }
  - caption: "`push_str` ve `push` yalnızca `metin`'in heap verisini büyüttü; yer yetmeyince veri daha büyük bir alana taşındı. `literal`'in baytlarına dokunulmadı, dokunulamaz da."
    stack:
      - frame: main
        vars:
          - { name: literal, type: "&str", value: "ptr · len=7", to: lit }
          - { name: metin, type: String, value: "ptr · len=16 · cap=30", to: h1, mut: true }
    heap:
      - { id: lit, value: "m e r h a b a", label: "programın içinde, salt okunur, heap değil" }
      - { id: h1, value: "merhaba, dünya!", label: "16 bayt kullanılıyor, 30 bayt ayrılmış" }
```

`metin`'in uzunluğu 15 değil 16 bayt, çünkü Rust metinleri **UTF-8** olarak saklar ve bu kodlamada `ü`
harfi 2 bayt tutar (metinlerin baytlarını Modül 9'da inceleyeceğiz). Kapasitenin tam değeri (burada 30)
ise bir uygulama ayrıntısıdır. Şimdi doğru tipi kullanalım ama Modül 2'yi de unutmayalım:

````compiles
code: |
  fn main() {
      let ad = String::from("Ayşe");
      ad.push_str(" Yılmaz");
      println!("{ad}");
  }
answer: false
error: E0596
explanation: |
  Bu sefer tip doğru (`String`), ama Modül 2'nin kuralı geçerli: değişkenler varsayılan olarak
  **değiştirilemez**. `push_str` metni yerinde değiştirdiği için `ad`'ın `let mut ad` olarak tanımlanması
  gerekir. Derleyici çözümü de söylüyor:

  ```text
  error[E0596]: cannot borrow `ad` as mutable, as it is not declared as mutable
   --> src/main.rs:3:5
    |
  3 |     ad.push_str(" Yılmaz");
    |     ^^ cannot borrow as mutable
    |
  help: consider changing this to be mutable
    |
  2 |     let mut ad = String::from("Ayşe");
    |         +++
  ```

  Mesajdaki *borrow* (ödünç alma) kelimesine şimdilik takılma; o Modül 5'in konusu. Şimdilik şunu
  bilmen yeterli: değeri yerinde değiştiren her metot, değişkenin `mut` olmasını ister.
````

| | String literali (`&str`) | `String` |
|---|---|---|
| Baytlar nerede? | Programın içinde, salt okunur | Heap'te |
| Boyut | Derleme zamanında sabit | Çalışma zamanında büyüyebilir |
| Değiştirilebilir mi? | Hayır | Evet (`let mut` ile) |
| Stack'teki parça (64-bit) | 16 bayt (ptr + len) | 24 bayt (ptr + len + cap) |
| Ne zaman? | Sabit mesajlar, etiketler | Kullanıcı girdisi, birleştirilen ya da değişen metinler |

## RAII: kaynağı sahibine bağla

Bellek, bir programın kullandığı tek kaynak değil. Açık dosyalar, ağ bağlantıları, veritabanı
bağlantıları, kilitler... Hepsi işi bitince **geri verilmesi** gereken kaynaklardır ve hepsi bellekle aynı
hatalara açıktır: kapatmayı unutmak, iki kez kapatmak, kapattıktan sonra kullanmak.

GC'li diller bellek için toplayıcıya güvenir, ama dosyalar için güvenemez: toplayıcının ne zaman
çalışacağı belli değildir. Bu yüzden ek yapılar kullanırlar:

```python
with open("rapor.txt", "w") as dosya:   # Python
    dosya.write("merhaba")
# blok bitince dosya kapanır; ama `with` yazmayı unutursan dosya açık kalabilir
```

```go
dosya, _ := os.Create("rapor.txt") // Go
defer dosya.Close()                 // bu satırı unutursan dosya açık kalır
```

Hepsinde ortak bir sorun var: **hatırlaman gerekir**. Rust'ta böyle ayrı bir yapıya ihtiyaç yoktur. Dosya
da bir değerdir; sahibi kapsamdan çıkınca drop edilir ve bir dosyanın drop edilmesi, dosyanın
kapatılması demektir:

```rust,norun
fn main() {
    let _dosya = std::fs::File::create("rapor.txt").unwrap(); // dosya açıldı
    println!("rapor yazılıyor...");
} // _dosya kapsamdan çıktı: dosya OTOMATİK olarak kapatıldı
```

`.unwrap()`'ı Modül 2'deki `parse().unwrap()` gibi düşün: "işlem başarısız olursa programı durdur"
demek (dosya işlemlerini ve hata yönetimini Modül 10'da ayrıntılı göreceksin). Bu örnek diske dosya
yazdığı için uygulamada çalıştırılmıyor, yalnızca derleniyor.

Bu fikrin adı **RAII**'dir: *Resource Acquisition Is Initialization*, yani "kaynak edinimi
ilklendirmedir". Adı garip, fikri basit: **bir kaynağın ömrünü, onu tutan değerin ömrüne bağla.** Değer
oluşturulurken kaynak alınır, değer drop edilirken kaynak bırakılır. Fikir C++'tan gelir; ama C++'ta onu
kullanmak sana kalmıştır ve derleyici yanlış kullanımı çoğu zaman engellemez. Rust'ta ise her değer bu
şekilde yönetilir ve sahiplik kuralları derleme zamanında denetlenir: `String` belleğini, `File` dosyasını,
Modül 18'de göreceğin kilitler de kilidi hep aynı yolla bırakır.

:::deep Drop'un bir sınırı: hata bildiremez
Drop sessizce çalışır ve bir sonuç döndüremez. Bir dosya drop sırasında kapatılırken bir hata oluşursa
(örneğin disk dolduysa) bu hata **yok sayılır**. Çoğu program için sorun değildir; ama verinin gerçekten
diske yazıldığından emin olman gereken yerlerde, kapsam bitmeden önce açık bir çağrıyla (ör.
`sync_all()`) hatayı kendin kontrol edersin. Hata yönetimini Modül 10'da göreceksin.
:::

````quiz
question: |
  Bu programda dosya **hangi noktada** kapatılır?

  ```rust
  fn main() {
      println!("başlıyor");
      {
          let _dosya = std::fs::File::create("rapor.txt").unwrap();
          println!("yazılıyor");
      } // (A)
      println!("başka işler"); // (B)
  } // (C)
  ```
options:
  - (A), `_dosya`'nın kapsamı bittiğinde
  - (B) - bir sonraki `println!` çalışırken
  - (C), `main` bittiğinde
  - Hiçbir zaman; `close()` çağrılmadığı için dosya açık kalır
answer: 0
explanation: |
  Dosyanın sahibi `_dosya` ve kapsamı iç bloğun `}`'sinde (A) bitiyor. Kural 3: sahip kapsamdan çıkınca
  değer drop edilir; bir `File`'ın drop edilmesi de dosyanın kapatılmasıdır. "başka işler" yazılırken
  dosya çoktan kapanmıştır.
feedback:
  - Doğru! Kaynağın ömrü, sahibinin kapsamıyla birlikte biter.
  - "Drop, kapsamın bittiği `}`'de olur; bir sonraki satırı beklemez."
  - "`main`'in sonu `_dosya` için çok geç: onun kapsamı iç blokta bitti."
  - "Rust'ta ayrıca `close()` çağırmak gerekmez; drop dosyayı kapatır."
````

:::ferris
Bu yüzden Rust'ta `free()`, `close()` ya da `finally` aramayacaksın. Sen kapsamları doğru kur; temizlik,
kapsam bittiği anda kendiliğinden yapılır. 🦀
:::

## Alıştırmalar: metni doğru kapsamda kur

Önce yukarıda gördüğün blok ifadesi kalıbını ("Mardin" örneği) kendin kur:

```parsons
prompt: |
  Satırları sıraya koyarak sipariş fişini **iç blokta** hazırlayan ve blok ifadesiyle dışarı çıkaran
  programı kur. Program `Sipariş: 2 simit, 1 çay` yazdırmalı.
lines: |
  fn main() {
      let fis = {
          let mut f = String::from("Sipariş: ");
          f.push_str("2 simit");
          f.push_str(", 1 çay");
          f
      };
      println!("{fis}");
  }
distractors: |
          f;
          let f = String::from("Sipariş: ");
explanation: |
  Bloğun **son ifadesi** (`f`, noktalı virgülsüz) bloğun değeridir: `String` bloktan çıkıp `fis`'e geçer
  ve drop edilmez. `f;` yazsaydın satır bir deyime dönüşür ve blok `()` döndürürdü (Modül 3'teki
  noktalı virgül tuzağı): `fis` bir `()` olur, `println!("{fis}")` da derlenmezdi. `f` ise tam o `f;`
  satırında drop edilirdi (derleyici bunu `path statement drops value` uyarısıyla da söyler). `mut`
  olmayan `let f` ile ise `push_str` çağrılamazdı (`E0596`).
```

````exercise
id: m04-e-alisveris-listesi
title: Büyüyen alışveriş listesi
difficulty: 1
prompt: |
  Bu program bir alışveriş listesini satır satır büyütmek istiyor ama derlenmiyor. Programı düzelt;
  çıktısı şu olmalı:

  ```text
  Alışveriş listesi:
  - süt
  - yumurta
  - ekmek
  ```

  `push_str` satırlarını silme: listenin program çalışırken büyümesi gerekiyor.
starter: |
  fn main() {
      let liste = "Alışveriş listesi:";
      liste.push_str("\n- süt");
      liste.push_str("\n- yumurta");
      liste.push_str("\n- ekmek");
      println!("{liste}");
  }
starter_compiles: false
solution: |
  fn main() {
      let mut liste = String::from("Alışveriş listesi:");
      liste.push_str("\n- süt");
      liste.push_str("\n- yumurta");
      liste.push_str("\n- ekmek");
      println!("{liste}");
  }
check: output
expected_output: |
  Alışveriş listesi:
  - süt
  - yumurta
  - ekmek
require:
  - pattern: 'String::(from|new|with_capacity)|\.to_string\(\)|\.to_owned\(\)'
    message: "Büyüyebilen bir metin için bir `String` oluşturmalısın (örneğin `String::from(...)`)."
  - pattern: '\.push_str\([\s\S]*\.push_str\([\s\S]*\.push_str\('
    message: "Listeyi üç `push_str` çağrısıyla büyütmelisin; `push_str` satırlarını silme."
hints:
  - "Derleyicinin ilk şikâyeti `E0599`: `&str`'nin `push_str` metodu yok. `liste` bir string literali; onu büyüyebilen bir `String`'e çevir."
  - "`String::from(...)` yazdıktan sonra yeni bir hata göreceksin: `E0596`. Bir değeri yerinde değiştirebilmek için değişkenin nasıl tanımlanması gerekiyordu?"
  - "Tam çözüm tek satır: `let mut liste = String::from(\"Alışveriş listesi:\");`"
explanation: |
  İki ayrı sorun vardı ve derleyici ikisini sırayla gösterdi:

  1. **Tip**: `"Alışveriş listesi:"` bir string literali (`&str`); baytları programın içinde ve
     büyütülemez. `String::from` bu baytları heap'e kopyalar ve büyüyebilen bir `String` verir.
  2. **Değişebilirlik**: `push_str` değeri yerinde değiştirir; bu yüzden değişken `let mut` olmalı
     (Modül 2).

  `\n` yeni satır karakteridir: `println!` metni yazarken her `\n`'de alt satıra geçer. Bu tek `String`
  değişkeni, `main` bitince bir kez drop edilir ve heap belleği geri verilir.
````

````exercise
id: m04-e-kayip-kart
title: Kayıp doğum günü kartı
difficulty: 2
prompt: |
  Zeynep'in doğum günü kartı iç blokta özenle hazırlanıyor, ama program derlenmiyor: `println!` kartı
  bulamıyor.

  Kartı **iç blokta hazırlamaya devam ederek** programı düzelt: kart blok bitince drop edilmemeli,
  dışarı çıkmalı. Çıktı şu olmalı:

  ```text
  Doğum günün kutlu olsun, Zeynep!
  Kart hazır.
  ```
starter: |
  fn main() {
      let isim = "Zeynep";
      {
          let mut kart = String::from("Doğum günün kutlu olsun, ");
          kart.push_str(isim);
          kart.push('!');
      }
      println!("{kart}");
      println!("Kart hazır.");
  }
starter_compiles: false
solution: |
  fn main() {
      let isim = "Zeynep";
      let kart = {
          let mut kart = String::from("Doğum günün kutlu olsun, ");
          kart.push_str(isim);
          kart.push('!');
          kart
      };
      println!("{kart}");
      println!("Kart hazır.");
  }
check: output
expected_output: |
  Doğum günün kutlu olsun, Zeynep!
  Kart hazır.
require:
  - pattern: 'let\s+(mut\s+)?kart\s*(:\s*String\s*)?=\s*\{'
    message: "Kartı bir blok ifadesiyle dışarı çıkar: `let kart = { ... };`"
hints:
  - "Hata `E0425`: `kart` iç blokta doğuyor ve bloğun `}`'sinde drop ediliyor. Dışarıdaki `println!` için artık `kart` diye bir şey yok."
  - "Modül 3'teki blok ifadelerini hatırla: bir bloğun **son ifadesi** bloğun değeridir. Bloğu bir `let`'in sağ tarafına koyabilirsin."
  - "Bloğu `let kart = { ... };` şeklinde yaz ve bloğun son satırına noktalı virgülsüz `kart` koy. Bloğu kapatan `};`'yi unutma."
explanation: |
  Bloğun son satırı (`kart`, noktalı virgülsüz) bloğun değeridir. Blok biterken içteki `kart`
  değişkeninin kapsamı sona erer, **ama değer drop edilmez**: çoktan dıştaki `kart`'a verilmiştir. Heap'teki
  metin yerinde kalır; değişen yalnızca sahibidir. Bu sahip değişikliğinin adı **taşıma (move)**, bir
  sonraki dersin konusu.

  İçteki `kart` yalnızca kendi bloğunda yaşayan ayrı bir değişkendir; dıştaki `kart` ise blok bittikten
  sonra doğar. Aynı ismi kullanmak serbesttir. Dıştaki `kart`'ın `mut` olmasına da gerek yok, çünkü onu
  artık değiştirmiyoruz.

  `kart.push_str(isim)` satırında `isim` bir string literali (`&str`) ve `push_str` tam olarak bunu
  bekler: verilen baytları okur ve kendi heap alanına kopyalar.
````

## Özet

:::remember
- **Üç kural**: her değerin bir sahibi var; aynı anda yalnızca bir sahip; sahip kapsamdan çıkınca değer
  **drop** edilir.
- Kapsam, tanımlandığı satırdan bloğun `}`'sine kadardır ve o `}` aynı zamanda **drop noktasıdır**.
- Aynı kapsamdaki değerler tanımlanma sırasının **tersiyle** drop edilir.
- **Gölgeleme drop etmez** (eski değer kapsam sonuna kadar yaşar); `mut` ile yeniden atama eski değeri
  hemen drop eder.
- String literali `&str`: baytlar programın içinde, salt okunur. `String`: heap'te, büyüyebilen, sahibi
  olunan metin. `String::from` baytları heap'e kopyalar; `push_str` / `push` büyütür (`mut` gerekir).
- **RAII**: kaynağın ömrü sahibinin ömrüne bağlıdır. Bellek, dosya, kilit, hepsi drop anında bırakılır.
:::

```reflect
prompt: |
  C'de `free`, Python'da dosyalar için `with` gerekirken, Rust'ta belleği geri vermeyi ya da bir dosyayı
  kapatmayı neden **unutamazsın**? Cevabında sahiplik kurallarından en az ikisini kullan.
answer: |
  Rust'ta her değerin bir sahibi vardır (kural 1) ve sahip kapsam dışına çıktığında değer otomatik
  olarak drop edilir (kural 3). Belleği geri vermek ya da dosyayı kapatmak, programcının yazması gereken
  ayrı bir adım değil, drop'un kendisidir; derleyici bunu her kapsamın sonuna kendisi yerleştirir. Değerin
  aynı anda tek bir sahibi olabildiği için (kural 2) aynı kaynak iki kez de bırakılamaz. Kısacası
  temizlik, kaynağın sahibinin ömrüne bağlıdır (RAII): sahibi yaşadığı sürece kaynak açıktır, sahibinin
  kapsamı bittiği an kapanır.
```

```flashcards
- front: Sahipliğin üç kuralı nedir?
  back: "(1) Her değerin bir sahibi vardır. (2) Bir değerin aynı anda yalnızca bir sahibi olabilir. (3) Sahip kapsam dışına çıkınca değer drop edilir."
- front: Bir değişkenin kapsamı nerede başlar, nerede biter?
  back: "Tanımlandığı satırda başlar, tanımlandığı bloğun kapanan `}`'sinde biter. Kapsamı bitmiş bir ismi kullanmak `E0425` hatası verir."
- front: Aynı kapsamdaki değişkenler hangi sırayla drop edilir?
  back: Tanımlanma sırasının tersiyle; son tanımlanan ilk drop edilir.
- front: Gölgelenen (shadowed) bir değer ne zaman drop edilir?
  back: "Gölgelendiği anda değil, kapsamının sonunda. Gölgeleme yalnızca ismi gizler; `mut` ile yeniden atama ise eski değeri hemen drop eder."
- front: "`\"merhaba\"` string literalinin tipi nedir ve baytları nerede durur?"
  back: "`&str` (tam olarak `&'static str`). Baytlar programın içinde, salt okunur bir bölgededir; ne stack'te ne heap'te."
- front: "`String::from(\"merhaba\")` ne yapar?"
  back: "Heap'te yer ayırır, string literalinin baytlarını oraya kopyalar ve bu verinin sahibi olan bir `String` döndürür."
- front: "`let s = String::from(\"a\"); s.push_str(\"b\");` neden derlenmez?"
  back: "`s` `mut` değil, ama `push_str` değeri yerinde değiştirir. Hata `E0596`; çözüm `let mut s`."
- front: RAII nedir?
  back: Bir kaynağın (bellek, dosya, kilit) ömrünü onu tutan değerin ömrüne bağlamak. Değer drop edilince kaynak otomatik olarak serbest bırakılır.
```
