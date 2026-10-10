---
id: m04-l01
title: Bellek nasıl çalışır — stack ve heap
minutes: 18
type: lesson
objectives:
  - Stack ile heap arasındaki farkı (boyut, hız, düzen, temizlik) bir örnek üzerinde açıklayabilmek
  - "Bir `String`'in stack'teki başlığını ve heap'teki verisini bellek diyagramıyla çizebilmek"
  - Bellek sızıntısı, double free, use-after-free ve sarkan işaretçi hatalarını tanımlayabilmek
  - C'nin elle yönetimini, çöp toplayıcıyı ve Rust'ın sahiplik yaklaşımını karşılaştırabilmek
keywords: [stack, heap, bellek, işaretçi, pointer, malloc, free, çöp toplayıcı, GC, String, double free, use-after-free]
---

Şimdiye kadar yazdığın her programda değişkenler bir yerde saklandı, işi bitince de sessizce ortadan
kayboldu. Peki tam olarak **nerede** saklandılar ve onları **kim** temizledi?

Bu sorunun cevabı, Rust'ı diğer bütün dillerden ayıran fikre — **sahiplik (ownership)** — açılan kapıdır.
Modül 1'deki çarpıcı istatistiği hatırla: büyük yazılım şirketlerinde ciddi güvenlik açıklarının yaklaşık
**%70'i bellek hatalarından** çıkıyor. Bu derste o hataların tam olarak ne olduğunu, dillerin onlarla nasıl
savaştığını ve Rust'ın neden bambaşka bir yol seçtiğini göreceksin.

:::ferris
Bu modül Rust yolculuğunun kalbi. Acele etme; diyagramlara bakarken her adımı kafanda canlandır.
Burayı sindirirsen sonraki modüllerin hepsi çok daha kolay gelecek! 🦀
:::

## Stack: tabak yığını

Modül 3'te her fonksiyon çağrısının **çağrı yığınının (call stack)** tepesine kendi **çerçevesini
(frame)** eklediğini görmüştün. Şimdi o yapıya daha yakından bakalım. Önce tahmin et — yanılsan bile
tahmin etmek, birazdan okuyacağın açıklamayı daha kalıcı yapar:

```predict
question: Fonksiyonlar hangi sırayla başlar ve biter? Bu program ne yazdırır?
code: |
  fn ic(n: i32) -> i32 {
      println!("ic başladı");
      n + 1
  }

  fn dis(n: i32) -> i32 {
      println!("dis başladı");
      let x = ic(n * 2);
      println!("dis bitiyor");
      x * 10
  }

  fn main() {
      println!("main başladı");
      let a = 3;
      let sonuc = dis(a);
      println!("main: {sonuc}");
  }
options:
  - |
    main başladı
    dis başladı
    ic başladı
    dis bitiyor
    main: 70
  - |
    main başladı
    dis başladı
    dis bitiyor
    ic başladı
    main: 70
  - |
    main başladı
    dis başladı
    ic başladı
    dis bitiyor
    main: 40
answer: 0
explanation: |
  `dis`, `ic`'i çağırdığında **kendi işini yarıda bırakıp bekler**. `ic` biter (6 + 1 = 7 döndürür), ancak
  ondan sonra `dis` kaldığı yerden devam eder ve `7 * 10 = 70` döndürür. En son başlayan fonksiyon (`ic`)
  en önce biter: stack'in temel kuralı budur.
feedback:
  - Doğru! Son başlayan, ilk biter.
  - "`dis`, `ic` dönmeden `let x = ...` satırını bitiremez; bu yüzden \"dis bitiyor\" ancak `ic`'ten sonra yazılır."
  - "`ic`'e `n` değil `n * 2` (yani 6) gönderiliyor: 6 + 1 = 7, 7 × 10 = 70."
```

Aynı programın stack'ini adım adım izle:

```memory
title: main → dis → ic çağrı zinciri
steps:
  - caption: "`main` çalışıyor; stack'te yalnızca onun çerçevesi var."
    stack:
      - frame: main
        vars:
          - { name: a, type: i32, value: "3" }
  - caption: "`dis(a)` çağrıldı: yeni çerçeve yığının **tepesine** eklendi. `n`, `a`'nın bir kopyası."
    stack:
      - frame: main
        vars:
          - { name: a, type: i32, value: "3" }
      - frame: dis
        vars:
          - { name: n, type: i32, value: "3" }
  - caption: "`ic(n * 2)` çağrıldı: üç çerçeve üst üste. `dis` şu an bekliyor."
    stack:
      - frame: main
        vars:
          - { name: a, type: i32, value: "3" }
      - frame: dis
        vars:
          - { name: n, type: i32, value: "3" }
      - frame: ic
        vars:
          - { name: n, type: i32, value: "6" }
  - caption: "`ic` döndü: çerçevesi **bütünüyle** kaldırıldı. Dönüş değeri 7, `dis`'teki `x`'e yazıldı."
    stack:
      - frame: main
        vars:
          - { name: a, type: i32, value: "3" }
      - frame: dis
        vars:
          - { name: n, type: i32, value: "3" }
          - { name: x, type: i32, value: "7" }
  - caption: "`dis` döndü: geriye yalnızca `main` kaldı. Hiçbir temizlik kodu yazmadık."
    stack:
      - frame: main
        vars:
          - { name: a, type: i32, value: "3" }
          - { name: sonuc, type: i32, value: "70" }
```

Bu diyagram stack'in dört özelliğini gösteriyor:

- **LIFO** (*Last In, First Out* — son giren ilk çıkar): En son eklenen çerçeve, ilk kaldırılandır.
- **Sabit boyut**: Derleyici her çerçevenin kaç bayt olduğunu önceden bilir. `dis`'in çerçevesi her
  çağrıda aynı büyüklüktedir.
- **Çok hızlı**: Çerçeve eklemek, işlemcinin *stack işaretçisini* birkaç bayt kaydırmasından ibarettir.
  Boş yer aramak, kayıt tutmak yok.
- **Otomatik temizlik**: Fonksiyon dönünce çerçevesi bir hamlede kaldırılır.

:::analogy Tabak yığını
Yemekhanedeki tabak yığınını düşün: yeni tabağı hep **en üste** koyarsın, alırken de **en üstten**
alırsın. Ortadan tabak çekmeye kalkmazsın. Fonksiyon çağrıları da böyle: en son çağrılan fonksiyonun
çerçevesi en üsttedir ve ilk o kaldırılır.
:::

## Stack'in sınırları

Stack bu kadar hızlı ve düzenliyse neden her şeyi stack'e koymuyoruz? Çünkü iki ciddi kısıtı var.

**1. Boyut derleme zamanında bilinmeli.** Derleyici her çerçevenin kaç bayt tutacağını program
çalışmadan hesaplar: `i32` her zaman 4 bayt, `[i32; 100]` her zaman 400 bayttır. Peki kullanıcının
klavyeden yazacağı bir isim 3 harf mi olacak, 300 harf mi? Bir alışveriş listesine kaç ürün eklenecek?
Bunlar ancak program **çalışırken** belli olur.

**2. Stack küçüktür.** Ana thread'in stack'i genellikle Linux'ta 8 MB, Windows'ta yalnızca 1 MB'tır.
Kendi kendini çağıran — **özyinelemeli (recursive)** — şu fonksiyona bak. Mantığı kusursuz: 0'a kadar
geri sayıp her adımda 1 ekliyor. Ama her çağrı yeni bir çerçeve açıyor ve hiçbiri hemen dönmüyor:

```rust,norun
fn say(n: u64) -> u64 {
    if n == 0 {
        return 0;
    }
    say(n - 1) + 1 // önce 1 eksiğini say, sonra 1 ekle
}

fn main() {
    println!("{}", say(10_000_000)); // 10 milyon çerçeve üst üste!
}
```

On milyon çerçeve stack'e sığmaz ve program (normal, yani debug derlemede) çöker:

:::warning Stack taşması (stack overflow)
```text
thread 'main' (13) has overflowed its stack
fatal runtime error: stack overflow, aborting
```
Bu bir derleme hatası değil, **çalışma zamanı** çöküşüdür; o yüzden yukarıdaki örnek uygulamada
çalıştırılmıyor, sadece derleniyor. Programcıların ünlü soru-cevap sitesi *Stack Overflow* da adını bu
hatadan alır.
:::

:::info Release derlemede neden çökmeyebilir?
Aynı programı `cargo run --release` ile derlersen büyük ihtimalle çökmeden `10000000` yazar: optimize
eden derleyici bu özyinelemeyi fark edip onu bir **döngüye** çevirebilir. Ama Rust bu dönüşümü **garanti
etmez**; ufak bir değişiklik optimizasyonu bozabilir. Çok derin özyinelemeye güvenme — gerektiğinde
döngü kullan.
:::

İki sorunun ortak çözümü: boyutu çalışma zamanında belli olan ya da çok büyük veriler için belleğin
ikinci bölgesi, **heap**.

```quiz
question: Aşağıdakilerden hangisi **tamamen** stack'te tutulamaz?
options:
  - "`[i32; 1000]` — bin elemanlı bir dizi"
  - "`(f64, bool, char)` — üç elemanlı bir tuple"
  - Kullanıcının programa klavyeden yazacağı adı
  - "`u128` tipinde bir sayı"
answer: 2
explanation: |
  Stack'e konacak her şeyin boyutu **derleme zamanında** bilinmelidir. `[i32; 1000]` her zaman 4000
  bayttır; tuple'ın boyutu elemanlarının tiplerinden hesaplanır; `u128` her zaman 16 bayttır. Kullanıcının
  yazacağı adın uzunluğu ise ancak program çalışırken belli olur — böyle veriler heap'te tutulur.
feedback:
  - "Büyük ama boyutu **sabit**: 1000 × 4 = 4000 bayt. (Çok büyük diziler stack'i taşırabilir ama boyutları derleme zamanında bilinir.)"
  - Tuple'ın boyutu, elemanlarının tiplerinden derleme zamanında hesaplanır.
  - Doğru! Uzunluğu çalışma zamanında belli olan veri heap'e gider.
  - "`u128` her zaman 16 bayttır (Modül 2)."
```

## Heap: otel resepsiyonu

Boyutu çalışma zamanında belli olan ya da büyüyüp küçülebilen veriler **heap (öbek)** bölgesine konur.
Heap'ten yer almanın adı **bellek ayırma (allocation)**dır: program, **bellek ayırıcıya (allocator)**
"bana 7 bayt lazım" der; ayırıcı uygun bir boş alan bulur, onu "dolu" diye işaretler ve alanın
**adresini** döndürür. Bir adresi tutan değere **işaretçi (pointer)** denir. İşaretçinin boyutu sabittir
(64-bit sistemde 8 bayt); bu yüzden işaretçi stack'te durabilir, gösterdiği veri ise heap'te.

:::analogy Otel resepsiyonu
Heap bir otel gibidir. Resepsiyona "dört kişilik bir oda" dersin; görevli boş bir oda bulur ve sana
**oda numarasını** verir. Oda numarası küçük bir bilgidir, cebine (stack'e) sığar; odanın kendisi ise
otelin içindedir (heap). Eşyalarına ulaşmak için önce numaraya bakıp koridorda yürümen gerekir — bu yüzden
heap'e erişmek, cebinden bir şey çıkarmaktan yavaştır.
:::

Rust'ta heap kullanan ilk tipin **`String`**: büyüyebilen ve sahibi olunan bir metin tipi. Tırnak içinde
yazdığın bir metinden (bir *string literalinden*) `String::from("...")` ile oluşturulur; `len()` metnin kaç bayt olduğunu, `capacity()` heap'te
kaç baytlık yer ayrıldığını söyler:

```rust
fn main() {
    let s = String::from("merhaba");
    println!("{s}: {} bayt, kapasite {} bayt", s.len(), s.capacity());
}
```

Bu tek satır bellekte şöyle görünür:

```memory
title: let s = String::from("merhaba");
steps:
  - caption: "Stack'te üç parça var: heap'teki veriye **işaretçi** (ptr), **uzunluk** (len — kullanılan bayt) ve **kapasite** (cap — ayrılan bayt). Karakterlerin kendisi heap'te."
    stack:
      - frame: main
        vars:
          - { name: s, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a", label: "7 bayt" }
```

Bunu kendin ölçebilirsin. `std::mem::size_of::<T>()` bir `T` değerinin **kendisinin** kaç bayt
kapladığını söyler; bir `String` için bu, stack'teki başlıktır — gösterdiği heap verisi bu sayıya dahil
**değildir** (bellek düzenini Modül 24'te derinlemesine göreceğiz; şimdilik onu bir cetvel gibi
kullanıyoruz):

```rust
fn main() {
    println!("i32      : {} bayt", std::mem::size_of::<i32>());
    println!("char     : {} bayt", std::mem::size_of::<char>());
    println!("[i32; 4] : {} bayt", std::mem::size_of::<[i32; 4]>());
    println!("String   : {} bayt", std::mem::size_of::<String>());

    let kisa = String::from("a");
    let uzun = String::from("Bu metin çok daha uzun ama stack'teki başlığı yine aynı!");
    println!("kısa metnin heap verisi: {} bayt", kisa.len());
    println!("uzun metnin heap verisi: {} bayt", uzun.len());
}
```

Bir `String` ister tek harf ister koca bir roman tutsun, stack'teki başlığı hep **24 bayttır** (64-bit
sistemde 3 × 8 bayt). Değişen yalnızca heap'teki kısımdır.

Heap'in asıl gücü **büyüyebilmesidir**. `push_str` bir `String`'in sonuna metin, `push` ise tek bir
karakter ekler. (Değiştirebilmek için değişkenin `mut` olması gerekir — Modül 2'yi hatırla; ayrıntısı
bir sonraki derste.)

```rust
fn main() {
    let mut s = String::from("merhaba");
    println!("len={:2} cap={:2} → {s}", s.len(), s.capacity());
    s.push_str(", dünya");
    println!("len={:2} cap={:2} → {s}", s.len(), s.capacity());
    s.push('!');
    println!("len={:2} cap={:2} → {s}", s.len(), s.capacity());
}
```

Kapasite yetmediğinde `String` ayırıcıdan **daha büyük** bir alan ister: ayırıcı ya mevcut alanı yerinde
genişletir ya da yeni bir yer bulup baytları oraya kopyalar ve eski alanı geri alır; ikinci durumda
stack'teki işaretçi artık yeni adresi gösterir. Kapasitenin tam olarak ne kadar büyüdüğü bir uygulama
ayrıntısıdır (yukarıdaki sayılar Rust sürümüne göre değişebilir) — önemli olan, heap verisinin çalışma
zamanında büyüyebilmesi.

Bedeli de var: heap kullanmak stack'ten **yavaştır**. Asıl maliyet ayırma ve geri vermededir: ayırıcı
her istekte boş yer arayıp kayıt tutmak zorundadır. Veriye ulaşmak için de önce işaretçiyi izlemek
gerekir — fazladan bir adım. (Bellek donanımı aynıdır: heap baytları "daha yavaş bir bellekte" durmaz;
yavaşlık ayırmadan ve bu dolaylı erişimden gelir.) Bu yüzden deneyimli Rust programcıları gereksiz heap
ayırmalarından kaçınır (Modül 25).

```quiz
question: |
  `let s = String::from("kedi");` satırından sonra bellekte ne vardır?
options:
  - Stack'te `k`, `e`, `d`, `i` harfleri; heap'te hiçbir şey
  - Stack'te işaretçi, uzunluk (4) ve kapasite (4); heap'te `k e d i` baytları
  - Heap'te hem işaretçi hem harfler; stack'te hiçbir şey
  - Stack'te sadece harflerin sayısı; harfler programın içine gömülü
answer: 1
explanation: |
  `String` iki parçalıdır: stack'te sabit boyutlu bir **başlık** (işaretçi + uzunluk + kapasite, toplam
  24 bayt), heap'te ise asıl karakterler. Başlığın boyutu hiç değişmediği için stack'te durabilir;
  karakterlerin sayısı değişebildiği için heap'tedir.
feedback:
  - Harflerin sayısı çalışma zamanında değişebilir; bu yüzden stack'te tutulmazlar.
  - Doğru! Sabit boyutlu başlık stack'te, değişken boyutlu veri heap'te.
  - "Değişken `s`'nin kendisi (başlık) stack'te, `main`'in çerçevesinde yaşar."
  - "String literali `\"kedi\"` programın içine gömülüdür, ama `String::from` onun baytlarını heap'e **kopyalar**."
```

## Elle yönetim: C'nin dünyası

Stack kendini temizler. Ama heap'ten aldığın her alanı **birinin** geri vermesi gerekir; yoksa program
çalıştıkça bellek dolar. Programlama dilleri "kim geri verecek?" sorusuna üç farklı cevap verir. İlki
en eskisi: **programcı versin**.

C'de `malloc` ile bellek ister, `free` ile geri verirsin. Aşağıdaki programın son iki satırına dikkat et:

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    char *isim = malloc(8);   // heap'ten 8 bayt iste
    strcpy(isim, "merhaba");  // 7 harf + sonlandırıcı '\0'
    printf("%s\n", isim);
    free(isim);               // belleği geri ver

    printf("%s\n", isim);     // HATA: use-after-free
    free(isim);               // HATA: double free
    return 0;
}
```

C derleyicisi bu programı derler — belki bir uyarı verir, ama durdurmaz. Hatalar çalışma zamanında,
belki aylar sonra, belki de bir saldırganın elinde patlar. Elle yönetimin dört klasik hatası:

| Hata | Ne olur? | Sonuç |
|---|---|---|
| **Bellek sızıntısı (memory leak)** | `free` unutulur | Program giderek daha çok bellek yer; uzun çalışan programlarda bellek tükenebilir |
| **Çift serbest bırakma (double free)** | Aynı alan iki kez `free` edilir | Ayırıcının kayıtları bozulur; güvenlik açığı |
| **Serbest bıraktıktan sonra kullanım (use-after-free)** | Geri verilmiş alan okunur ya da yazılır | Başka bir verinin belleği bozulur — saldırganların favorisi |
| **Sarkan işaretçi (dangling pointer)** | İşaretçi, artık geçersiz bir alanı gösterir | Use-after-free'nin kaynağı: gizli bir saatli bomba |

Sarkan işaretçinin neden bu kadar tehlikeli olduğunu adım adım gör:

```memory
title: C'de free(isim) sonrası — sarkan işaretçi
steps:
  - caption: "`malloc(8)` heap'te 8 bayt ayırdı; `isim` bu alanın adresini tutuyor."
    stack:
      - frame: main
        vars:
          - { name: isim, type: "char *", value: "0x5a10", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a", label: "isim'in verisi" }
  - caption: "`free(isim)`: alan ayırıcıya geri verildi. Ama `isim` **hâlâ aynı adresi** tutuyor — artık sarkan bir işaretçi."
    stack:
      - frame: main
        vars:
          - { name: isim, type: "char *", value: "0x5a10", to: h1, note: sarkıyor! }
    heap:
      - { id: h1, value: "m e r h a b a", label: "isim'in eski verisi", freed: true }
  - caption: "Ayırıcı aynı alanı başka bir veriye verdi. `isim` üzerinden okumak ya da yazmak artık **başkasının verisini** bozar: use-after-free."
    stack:
      - frame: main
        vars:
          - { name: isim, type: "char *", value: "0x5a10", to: h1, note: sarkıyor! }
    heap:
      - { id: h1, value: "ş i f r e = 1 2 3 4", label: "artık başka bir verinin" }
```

Otel benzetmesiyle: sızıntı, çıkış yapmayı unutmaktır — oda sonsuza dek dolu görünür. Double free,
anahtarı iki kez teslim etmektir — resepsiyon odayı iki misafire birden verebilir. Use-after-free ise
çıkış yaptıktan sonra sakladığın anahtar kopyasıyla odaya girmektir — içeride artık başka bir misafir var!

Bu hatalar teorik değil. Google, Android'de yeni kodu Rust gibi bellek güvenli dillerle yazmaya
başladıktan sonra bellek kaynaklı güvenlik açıklarının payının %76'dan (2019) %24'e (2024) düştüğünü
açıkladı.

````quiz
question: |
  Aşağıdaki C kodunda hangi bellek hatası var?
  ```c
  char *mesaj = malloc(16);
  strcpy(mesaj, "Rust harika");
  free(mesaj);
  mesaj[0] = 'r';
  ```
options:
  - Bellek sızıntısı
  - Double free
  - Use-after-free
  - Hata yok; `free` zaten çağrılmış
answer: 2
explanation: |
  `free(mesaj)` sonrası `mesaj` sarkan bir işaretçidir. `mesaj[0] = 'r';` geri verilmiş belleğe **yazar**:
  bu use-after-free'dir. O alan bu sırada başka bir veriye verilmişse, o veri sessizce bozulur.
feedback:
  - "`free` çağrıldığı için sızıntı yok; sorun, `free`'den **sonra** yapılan erişimde."
  - "`free` yalnızca bir kez çağrılmış."
  - Doğru! Geri verilmiş belleğe yazmak, use-after-free'dir.
  - "`free`'den sonra belleğe dokunmak tam da sorunun kendisi."
````

## Çöp toplayıcı ve Rust'ın üçüncü yolu

İkinci cevap: **makine versin**. Modül 1'de bu yolu kısaca görmüştün: Java, Python, JavaScript, Go ve
C# gibi dillerde heap'i bir **çöp toplayıcı (garbage collector, GC)** yönetir. Şimdi nasıl çalıştığına
biraz daha yakından bakalım. GC, program çalışırken zaman zaman devreye girer: stack'teki değişkenlerden
başlayıp işaretçileri takip ederek **hâlâ ulaşılabilen** nesneleri işaretler. Hiçbir yerden ulaşılamayan
her şey çöptür ve geri verilir. Sen hiç `free` yazmazsın; bu yüzden double free ve use-after-free
neredeyse imkânsızdır. (Python'un yaygın sürümü CPython ayrıca **referans sayımı** kullanır: bir nesneyi
gösteren kimse kalmadığı anda onu hemen siler; birbirini gösteren nesne döngüleri için de yukarıdaki gibi
tarayan bir toplayıcıyı ek olarak çalıştırır.)

Bedeli de Modül 1'den tanıdık, ama şimdi nedenlerini görebiliyorsun:

- **Çalışma zamanı maliyeti**: Taramanın kendisi işlemci zamanı ve ek bellek harcar.
- **Duraklamalar**: Tarama sırasında program kısa süreliğine durabilir. Discord'un Go servisinde
  yaklaşık iki dakikada bir gelen gecikme sıçramalarını hatırla.
- **Belirsiz zamanlama**: Bir nesneye ulaşılamaz olması, hemen temizleneceği anlamına gelmez. Bellek için
  bu çoğu zaman dert değildir; ama dosya ya da ağ bağlantısı gibi kaynakların zamanında kapatılması
  gerekir. Bu yüzden Python'da `with`, Java'da `try-with-resources` gibi ek yapılar vardır.
- **Sızıntı yine mümkün**: Artık işine yaramayan bir nesneyi bir listede unutursan, ona hâlâ
  ulaşılabildiği için GC onu asla toplamaz.

İşletim sistemi çekirdekleri, gömülü cihazlar ve oyun motorları bu bedeli çoğu zaman kaldıramaz.

```quiz
question: Çöp toplayıcılı bir dilde (ör. Java) bir nesne **ne zaman** temizlenebilir hâle gelir?
options:
  - Onu oluşturan fonksiyon bittiği anda
  - Programın hiçbir yerinden ona artık ulaşılamadığında; asıl temizlik ise GC'nin sıradaki turunda
  - Programcı `free` çağırdığında
  - Ancak program tamamen kapandığında
answer: 1
explanation: |
  GC "bu nesneyi hâlâ gösteren biri var mı?" diye bakar. Kimse göstermiyorsa nesne **çöp** olur, ama
  hemen silinmez: GC onu sıradaki turunda, kendi seçtiği bir anda temizler. Rust'ta ise cevap
  kesindir: sahibin kapsamı hangi satırda bitiyorsa, tam orada. Bu fark dosya gibi kaynaklarda büyük
  önem taşır; bir sonraki derste göreceğiz.
feedback:
  - Nesne fonksiyondan dışarı verilmiş ya da bir listeye eklenmiş olabilir. GC kapsamlara değil, ulaşılabilirliğe bakar.
  - Doğru! Ulaşılamaz olmak "temizlenebilir" demektir, "temizlendi" değil.
  - GC'li dillerde `free` yoktur; temizliği toplayıcı yapar.
  - GC program çalışırken de toplar; yoksa uzun süre çalışan sunucular belleği bitirirdi.
```

Üçüncü cevap Rust'ınki: **derleyici ayarlasın**. Rust'ta heap belleği yine otomatik geri verilir, ama
bunu çalışma zamanında bir toplayıcı yapmaz. Her değerin bir **sahibi (owner)** vardır ve sahip kapsam
dışına çıktığı anda — derleyicinin tam o noktaya yerleştirdiği kodla — bellek serbest bırakılır.
Aynı belleği iki kez serbest bırakabilecek ya da serbest bırakılmış belleğe erişebilecek bir program
ise **derlenmez** (`unsafe` kullanmayan, yani **güvenli Rust** kodunda; `unsafe`'i Modül 24'te
göreceğiz).

```rust
fn main() {
    let sayi = 42; // stack'te
    {
        let mesaj = String::from("geçici"); // heap'te bellek ayrıldı
        println!("{mesaj} {sayi}");
    } // ← mesaj'ın kapsamı bitti: Rust heap belleğini TAM BURADA geri verir
    println!("{sayi}"); // mesaj artık yok; sayi hâlâ yaşıyor
}
```

```memory
title: Kapsam bitince heap belleği geri verilir
steps:
  - caption: "İç blokta `mesaj` oluşturuldu: heap'te bellek ayrıldı."
    stack:
      - frame: main
        vars:
          - { name: sayi, type: i32, value: "42" }
          - { name: mesaj, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "g e ç i c i" }
  - caption: "`}` geldi: `mesaj`'ın kapsamı bitti. Rust belleği **anında** geri verdi — ne GC ne de elle `free`."
    stack:
      - frame: main
        vars:
          - { name: sayi, type: i32, value: "42" }
    heap:
      - { id: h1, value: "g e ç i c i", label: "mesaj'ın verisi", freed: true }
```

Üç yaklaşım yan yana:

| | C (elle) | Java, Python, Go (GC) | Rust (sahiplik) |
|---|---|---|---|
| Belleği kim geri verir? | Programcı (`free`) | Çalışma zamanında GC | Derleyicinin yerleştirdiği kod |
| Ne zaman? | Programcı ne zaman yazarsa | GC ne zaman karar verirse | Sahip kapsamdan çıktığı anda |
| Toplayıcı gibi ek çalışma zamanı maliyeti | Yok | Var (CPU, bellek, duraklama) | Yok |
| Double free, use-after-free | Korumasız | Güvenli | Güvenli — derleme zamanında denetlenir |
| Bedeli | Hatalar, güvenlik açıkları | Performans, öngörülemezlik | Kuralları öğrenmek |

Bir dürüstlük notu: Rust'ın derleme zamanı garantisi double free, use-after-free ve sarkan işaretçiler
içindir. **Sızıntıyı** tamamen imkânsız kılmaz (bir sonraki derste konuşacağız); ama "geri vermeyi
unuttum" türünden bir sızıntı, temizlik otomatik olduğu için Rust'ta kendiliğinden oluşmaz.

:::ferris
Evet, Rust derleyicisi bazen programına "hayır" diyecek. Ama o "hayır"lar, C programcılarının yıllarca
hata ayıklayarak aradığı hataların ta kendisi. Derleyici seni durdurduğunda bir kazayı önlemiş olur. 🦀
:::

```quiz
question: Rust'ın sahiplik yaklaşımı için hangisi **doğrudur**?
options:
  - Rust'ta da arka planda çalışan bir çöp toplayıcı vardır, sadece çok hızlıdır
  - Heap belleği, sahibi kapsam dışına çıktığında derleyicinin yerleştirdiği kodla geri verilir
  - Rust'ta her heap ayırmasından sonra `free` çağırmayı unutmamak gerekir
  - Rust, double free ve use-after-free hatalarını program çalışırken yakalayıp programı durdurur
answer: 1
explanation: |
  Rust'ta temizliği çalışma zamanında bir toplayıcı **yapmaz**: derleyici her değerin sahibinin
  kapsamının nerede bittiğini bilir ve geri verme kodunu oraya kendisi koyar. Kurallar derleme zamanında
  denetlendiği için toplayıcı taraması, duraklama gibi ek bir çalışma zamanı maliyeti yoktur.
feedback:
  - Rust'ta GC yoktur; temizlik derleme zamanında belirlenen noktalarda yapılır.
  - Doğru! Ne GC ne elle `free` — sahiplik.
  - Rust'ta `free` diye bir şey yazmazsın; temizlik otomatiktir.
  - "Bu hatalar program çalışmadan, **derleme sırasında** engellenir; böyle bir program hiç derlenmez. (Dizi sınırı aşımı gibi bazı hatalar ise çalışma zamanında panikle yakalanır — Modül 2 — ama sahiplik hataları derlemede.)"
```

## Alıştırma: metni heap'te büyüt

Uzunluğu program çalışırken belli olan metinler heap'in tam işi. `String::new()` boş bir `String`
oluşturur (henüz heap ayırmaz); `push` ile karakter ekledikçe büyür. Önce çözülmüş bir örnek:

```rust
fn cizgi(uzunluk: u32) -> String {
    let mut sonuc = String::new(); // boş: henüz heap ayırması yok
    for _ in 0..uzunluk {
        sonuc.push('-'); // tek bir karakter ekler
    }
    sonuc // sonucu çağırana veriyoruz (Ders 5'te ayrıntılı)
}

fn main() {
    let kisa = cizgi(5);
    let uzun = cizgi(20);
    println!("{kisa}|");
    println!("{uzun}|");
    println!("kısa: {} bayt, uzun: {} bayt", kisa.len(), uzun.len());
}
```

```fill
prompt: |
  Sıra sende: `n` basamaklı bir merdiven çizen fonksiyonu tamamla. 1. satırda 1, 2. satırda 2, ...,
  `n`. satırda `n` tane `*` olmalı.
code: |
  fn merdiven(n: u32) -> String {
      let mut sonuc = ___0;
      for basamak in 1..=n {
          for _ in 0..basamak {
              sonuc.___1('*');
          }
          sonuc.push('\n');
      }
      sonuc
  }

  fn main() {
      print!("{}", merdiven(3));
  }
blanks:
  - ["String::new()", "String::from(\"\")"]
  - ["push"]
output: |
  *
  **
  ***
explanation: |
  Boş bir `String` ile başlayıp her satırda `push` ile karakter, satır sonunda da `'\n'` (yeni satır)
  ekliyoruz. Ortaya çıkan metnin uzunluğu `n`'ye bağlı, yani derleme zamanında bilinemez — işte bu yüzden
  heap'te büyüyen bir `String` kullanıyoruz. Dikkat: `push` bir `char` alır (`'*'`), `push_str` ise bir
  metin (`"*"`); ikisini karıştırırsan tip hatası (`E0308`) alırsın.
```

````exercise
id: m04-e-ilerleme-cubugu
title: İlerleme çubuğu
difficulty: 2
prompt: |
  Bir dosya indirme ekranı için **ilerleme çubuğu** üreten `ilerleme_cubugu(yuzde)` fonksiyonunu yaz:

  - Çubuk 10 karakter genişliğindedir: her tam **%10** için bir `#`, kalan yerler için `-`.
  - Çubuk köşeli parantez içindedir; ardından bir boşluk ve Türkçe yazımla yüzde gelir: `%45`.
  - 100'den büyük değerler 100 kabul edilir.

  | çağrı | sonuç |
  |---|---|
  | `ilerleme_cubugu(0)` | `[----------] %0` |
  | `ilerleme_cubugu(45)` | `[####------] %45` |
  | `ilerleme_cubugu(100)` | `[##########] %100` |
  | `ilerleme_cubugu(250)` | `[##########] %100` |
starter: |
  fn ilerleme_cubugu(yuzde: u32) -> String {
      todo!()
  }

  fn main() {
      println!("{}", ilerleme_cubugu(0));
      println!("{}", ilerleme_cubugu(45));
      println!("{}", ilerleme_cubugu(100));
  }
solution: |
  fn ilerleme_cubugu(yuzde: u32) -> String {
      let yuzde = if yuzde > 100 { 100 } else { yuzde };
      let dolu = yuzde / 10;
      let mut cubuk = String::new();
      for i in 0..10 {
          if i < dolu {
              cubuk.push('#');
          } else {
              cubuk.push('-');
          }
      }
      format!("[{cubuk}] %{yuzde}")
  }

  fn main() {
      println!("{}", ilerleme_cubugu(0));
      println!("{}", ilerleme_cubugu(45));
      println!("{}", ilerleme_cubugu(100));
  }
check: tests
tests: |
  #[test]
  fn sifir_yuzde_bos_cubuk() {
      assert_eq!(ilerleme_cubugu(0), "[----------] %0", "%0'da hiç # olmamalı");
  }

  #[test]
  fn kirk_bes_yuzde_dort_kutu() {
      assert_eq!(
          ilerleme_cubugu(45),
          "[####------] %45",
          "45 / 10 = 4 (tam sayı bölmesi aşağı yuvarlar), yani 4 tane # olmalı"
      );
  }

  #[test]
  fn doksan_dokuz_yuzde_henuz_dolmadi() {
      assert_eq!(ilerleme_cubugu(99), "[#########-] %99", "%99'da 9 tane # olmalı, çubuk henüz dolmadı");
  }

  #[test]
  fn tam_dolu() {
      assert_eq!(ilerleme_cubugu(100), "[##########] %100", "%100'de 10 tane # olmalı");
  }

  #[test]
  fn yuzden_buyuk_deger_sinirlanir() {
      assert_eq!(
          ilerleme_cubugu(250),
          "[##########] %100",
          "100'den büyük değerler 100 kabul edilmeli"
      );
      assert_eq!(
          ilerleme_cubugu(u32::MAX),
          "[##########] %100",
          "en büyük u32 değeri bile 100 kabul edilmeli (hesaplamada taşma olmamalı)"
      );
  }

  #[test]
  fn sifirdan_yuze_her_deger() {
      for yuzde in 0..=100u32 {
          let dolu = (yuzde / 10) as usize;
          let beklenen = format!("[{}{}] %{yuzde}", "#".repeat(dolu), "-".repeat(10 - dolu));
          assert_eq!(ilerleme_cubugu(yuzde), beklenen, "%{yuzde} için çubuk yanlış");
      }
  }
hints:
  - |
    Önce değeri sınırla: `let yuzde = if yuzde > 100 { 100 } else { yuzde };` (gölgeleme, Modül 2).
    Dolu kutu sayısı `yuzde / 10` — tam sayı bölmesi kesirli kısmı atar.
  - |
    `let mut cubuk = String::new();` ile başla. `for i in 0..10` döngüsünde `i < dolu` ise
    `cubuk.push('#')`, değilse `cubuk.push('-')` yap.
  - |
    Köşeli parantezleri ve yüzdeyi en sonda tek seferde ekle: fonksiyonun son ifadesi
    `format!("[{cubuk}] %{yuzde}")` olsun (sonunda noktalı virgül yok!).
explanation: |
  **Neden `String`?** Fonksiyonun ürettiği metin çalışma zamanında hesaplanıyor ve içeriği her çağrıda
  farklı: böyle veriler heap'te yaşar. `String::new()` başlangıçta heap ayırmaz (kapasite 0); ilk `push`
  ile küçük bir alan ayrılır, gerektikçe büyütülür. `format!` ise (Modül 1) yepyeni bir `String` üretip
  döndürür.

  **Alternatifler ve deyimler:**
  - `yuzde.min(100)`, iki sayıdan küçüğünü verir: sınırlamanın kısa yolu.
  - `"#".repeat(n)`, bir metni `n` kez tekrarlayan yeni bir `String` üretir. Döngüsüz çözüm:
    `format!("[{}{}] %{yuzde}", "#".repeat(dolu as usize), "-".repeat(10 - dolu as usize))`
    (`repeat` bir `usize` ister; `as` dönüşümünü Modül 2'de görmüştün).
  - Kaç karakter ekleyeceğini önceden biliyorsan `String::with_capacity(10)` yeri baştan ayırır ve
    büyürken yeniden ayırma yapılmasını önler (Modül 9 ve 25).
````

## Özet

:::remember
- **Stack**: LIFO düzeni; boyutu derleme zamanında bilinen veriler; çok hızlı; fonksiyon dönünce
  çerçevesi otomatik kaldırılır. Küçüktür (ana thread'de genellikle 1–8 MB).
- **Heap**: boyutu çalışma zamanında belli olan ya da büyüyebilen veriler; ayırma gerekir, işaretçiyle
  erişilir, **birinin geri vermesi gerekir**.
- `String` = stack'te **ptr + len + cap** (24 bayt) + heap'te karakterler.
- C: elle `free` → sızıntı, double free, use-after-free, sarkan işaretçi riski.
- GC: güvenli ama çalışma zamanı maliyeti, duraklamalar, belirsiz zamanlama.
- Rust: **sahiplik** — sahip kapsamdan çıkınca derleyicinin yerleştirdiği kod belleği geri verir;
  kurala uymayan program derlenmez.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: bir `String`'in karakterleri neden stack'te değil de heap'te tutulur?
  Stack'te ne kalır ve neden?
answer: |
  Stack'e konan her şeyin boyutu derleme zamanında bilinmeli ve sabit olmalı. Bir `String`'in uzunluğu
  ise ancak program çalışırken belli olur ve sonradan değişebilir (`push_str` ile büyüyebilir). Bu yüzden
  karakterler heap'te tutulur. Stack'te yalnızca sabit boyutlu bir **başlık** kalır: heap'teki veriye
  işaretçi, uzunluk ve kapasite (64-bit sistemde toplam 24 bayt). Başlığın boyutu metnin uzunluğundan
  bağımsız olduğu için stack'e rahatça sığar.
```

```flashcards
- front: Stack'e konan bir değerin boyutu hakkında hangi şart vardır?
  back: Derleme zamanında bilinmeli ve sabit olmalıdır.
- front: Stack'te yer ayırmak neden heap'ten çok daha hızlıdır?
  back: Stack'te ayırma sadece stack işaretçisini kaydırmaktır. Heap'te ayırıcının uygun boş alan araması ve kayıt tutması gerekir.
- front: "Bir `String` stack'te hangi üç parçayı tutar?"
  back: Heap'teki veriye işaretçi (ptr), uzunluk (len) ve kapasite (cap) — 64-bit sistemde toplam 24 bayt.
- front: Bellek sızıntısı (memory leak) nedir?
  back: Artık kullanılmayan heap belleğinin hiç geri verilmemesi; program giderek daha fazla bellek tüketir.
- front: Double free nedir?
  back: Aynı heap alanını iki kez serbest bırakmak. Ayırıcının kayıtlarını bozar, güvenlik açığına yol açar.
- front: Sarkan işaretçi (dangling pointer) nedir?
  back: Serbest bırakılmış, yani artık geçersiz olan bir bellek alanını göstermeye devam eden işaretçi. Use-after-free hatalarının kaynağıdır.
- front: Çöp toplayıcılı bir dilde bir nesne ne zaman temizlenebilir hâle gelir?
  back: Programın hiçbir yerinden ona artık ulaşılamadığında. Temizliğin tam anını ise GC kendisi seçer.
- front: Rust heap belleğini ne zaman ve kimin eliyle geri verir?
  back: Değerin sahibi kapsam dışına çıktığı anda, derleyicinin oraya yerleştirdiği kodla — GC ya da elle `free` olmadan.
```
