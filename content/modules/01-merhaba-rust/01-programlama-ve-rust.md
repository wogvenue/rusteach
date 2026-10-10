---
id: m01-l01
title: Programlama nedir, Rust neden var?
minutes: 16
type: lesson
objectives:
  - Bir programın kaynak koddan makine koduna nasıl dönüştüğünü açıklayabilmek
  - Derlenen ve yorumlanan dilleri hız, hata yakalama ve dağıtım açısından karşılaştırabilmek
  - Bellek güvenliği sorununu ve Rust'ın çözümünü çöp toplayıcılı dillerle kıyaslayabilmek
  - Geri çağırma, aralıklı tekrar ve tahmin stratejilerini kendi çalışma planına uygulayabilmek
keywords: [programlama, derleyici, yorumlayıcı, makine kodu, bellek güvenliği, çöp toplayıcı, öğrenme]
---

Bilgisayarın saniyede milyarlarca işlem yapabilir, ama kendi başına hiçbir şey **bilmez**. Ne
yapacağını ona birinin adım adım, hiçbir belirsizlik bırakmadan anlatması gerekir. Bu yolculuğun
sonunda o "birisi" sen olacaksın — hem de dünyanın en güvenli ve en hızlı dillerinden biriyle.

Bu ilk derste büyük resmi kuruyoruz: Program nedir, Rust neden icat edildi, kimler kullanıyor ve
beynin en iyi nasıl öğrenir? Asıl kod yazmaya sonraki derslerde başlayacağız; ama ilk Rust kodunu
daha bu derste çalıştıracaksın.

:::ferris
Merhaba, ben Ferris! 🦀 Rust topluluğunun maskotuyum ve bu yolculukta hep yanında olacağım. Hiç kod
yazmamış olman sorun değil — her Rust uzmanı bir zamanlar tam olarak senin olduğun yerdeydi.
:::

## Program: çok hızlı ama harfiyen çalışan bir işçi

Bir **program**, bilgisayarın sırayla uyguladığı kesin talimatlar listesidir. Bilgisayarın beyni
olan **işlemci (CPU)** ise tek bir dil konuşur: **makine kodu (machine code)**. Makine kodu, "şu iki
sayıyı topla", "bu değeri belleğe kopyala", "sonuç sıfırsa şu talimata atla" gibi çok basit
komutları temsil eden sayılardan ibarettir.

Aynı işlemin üç farklı "dildeki" hâline bak:

```text
Makine kodu (x86-64):  48 01 F8        ← işlemcinin anladığı baytlar
Assembly:              add rax, rdi    ← makine kodunun insanca yazılışı
Rust:                  a + b           ← senin yazacağın kod
```

İnsanların bayt dizileriyle program yazması hem çok yavaş hem de hataya çok açık olurdu. Bu yüzden
**programlama dilleri** var: Okunabilir bir metin yazarız — buna **kaynak kod (source code)** denir
— ve bir araç bu metni makine koduna çevirir.

Unutma: Bilgisayar **ne demek istediğini değil, ne yazdığını** yapar. Bir virgül, tek bir harf
hatası bile sonucu değiştirir. Programlamanın büyük kısmı, talimatları bu kadar kesin yazmayı
öğrenmektir.

:::analogy Hiç yemek yapmamış bir aşçı
Bir tarifi, hayatında hiç yemek yapmamış ama söyleneni harfiyen uygulayan çok hızlı bir aşçıya
verdiğini düşün. Tarifte "2 yumurta ekle" yazıp "kır" demeyi unutursan yumurtalar kabuğuyla
tencereye girer! Program da böyle bir tariftir: İşlemci her adımı inanılmaz bir hızla ama **tam
yazıldığı gibi** uygular.
:::

İşte gerçek bir Rust programı. Satırlarını henüz anlaman gerekmiyor (3. derste her parçasını tek tek
inceleyeceğiz). Sadece **Çalıştır**'a bas ve ne olduğunu gör:

```rust
fn main() {
    println!("Merhaba, Rust! 🦀");
    println!("Bu satırları senin çalıştırdığın bir program yazıyor.");
}
```

```predict
question: |
  Henüz Rust bilmiyorsun ama tahmin etmeyi dene! Bu program ne yazdırır?
code: |
  fn main() {
      println!("Önce kahvaltı,");
      println!("sonra Rust!");
  }
options:
  - "Önce kahvaltı, sonra Rust!"
  - |
    Önce kahvaltı,
    sonra Rust!
  - |
    sonra Rust!
    Önce kahvaltı,
answer: 1
explanation: |
  `println!` "satır yazdır" (*print line*) demektir: Metni yazar ve bir **alt satıra** geçer. İki
  `println!` olduğu için iki ayrı satır görürsün. Talimatlar da **yukarıdan aşağıya, sırayla**
  çalışır — programlamanın en temel kuralı budur. Yanıldıysan dert etme: Tahmin etmek, yanlış olsa
  bile, doğru cevabı daha iyi hatırlamanı sağlar.
```

```quiz
question: |
  İşlemci (CPU) **doğrudan** hangisini çalıştırabilir?
options:
  - Rust kaynak kodunu
  - Makine kodunu
  - Python kodunu
  - Türkçe yazılmış talimatları
answer: 1
explanation: |
  İşlemci yalnızca **makine kodunu** — basit komutları temsil eden sayıları — anlar. Rust, Python ya
  da başka bir dilde yazılan kaynak kod, çalışabilmek için önce bir şekilde makine koduna
  çevrilmelidir.
feedback:
  - "Rust kodu insanlar için yazılmış bir metindir; önce makine koduna **çevrilmesi** gerekir."
  - Doğru! İşlemcinin anladığı tek dil makine kodudur.
  - Python kodu da bir metindir; onu Python yorumlayıcısı adlı başka bir program çalıştırır.
  - İşlemci insan dillerini anlamaz — programlama dilleri tam da bu yüzden var.
```

## Çevirmenler: derleyici ve yorumlayıcı

Kaynak kodu makine koduna çevirmenin iki temel yolu vardır:

- **Derleyici (compiler):** Programın **tamamını, çalıştırmadan önce** makine koduna çevirir ve
  sonucu bir dosyaya yazar (Windows'ta `.exe`). Sonra bu dosyayı istediğin kadar çalıştırırsın. C,
  C++, Go ve **Rust** böyle çalışır.
- **Yorumlayıcı (interpreter):** Programı **çalışırken** satır satır okuyup uygular. Her
  çalıştırmada kaynak kod ve yorumlayıcı birlikte gerekir. Python ve JavaScript bu gruptadır.

Arada karma yaklaşımlar da var: Java ve C# kodu önce **bytecode** adlı ara bir koda derlenir, sonra
bir sanal makine bunu çalışırken makine koduna çevirir. Modern JavaScript motorları da benzer
teknikler kullanır.

:::analogy Kitap çevirisi ve simultane tercüman
**Derleyici**, bir kitabı baskıdan önce baştan sona çeviren çevirmen gibidir: Çeviri bir kez yapılır,
editör hataları baskıdan önce yakalar, okurlar da kitabı kendi dillerinde hızla okur.
**Yorumlayıcı** ise simultane tercümandır: Konuşma sürerken anında çevirir. Esnektir, hemen başlar;
ama her konuşmada tercümanın orada olması gerekir ve süreç daha yavaştır.
:::

| | Derlenen (Rust, C, C++, Go) | Yorumlanan (Python, JavaScript) |
|---|---|---|
| Ne zaman çevrilir? | Çalıştırmadan önce, bir kez | Her çalıştırmada, çalışırken |
| Hız | Çok hızlı: doğrudan makine kodu | Genellikle daha yavaş |
| Hatalar ne zaman yakalanır? | Birçoğu derleme sırasında | Çoğu, hatalı satır çalıştığında |
| Başka bir bilgisayarda çalıştırmak | Tek bir çalıştırılabilir dosya yeterli | Kaynak kod + yorumlayıcı gerekir |
| Kodu değiştirince | Yeniden derlemek gerekir | Hemen çalıştırılabilir |

"Hatalar ne zaman yakalanır?" satırı küçük bir fark gibi görünür ama çok önemlidir. Şu Python koduna
bak:

```python
def gece_raporu():
    pirnt("Gece raporu")   # yazım hatası!

print("Gündüz raporu")
```

Bu program sorunsuz çalışır ve "Gündüz raporu" yazar. Yazım hatası ancak bir gün `gece_raporu`
gerçekten çağrıldığında patlar — belki gece 03.00'te, gerçek kullanıcılar varken. Rust ise kodun
**tamamını** derlerken denetler; o satır hiç çalışmayacak olsa bile:

```rust,compile_fail
fn gece_raporu() {
    pirntln!("Gece raporu"); // yazım hatası!
}

fn main() {
    println!("Gündüz raporu");
}
```

Derleyici `pirntln` adında bir makro bulamadığını söyler, hatta `println`'i kastettiğini tahmin eder
— ve hatalı program **hiç oluşmaz**. (`fn` ile kendi fonksiyonlarını yazmayı Modül 3'te
öğreneceksin.)

Rust'ın derleyicisinin adı **`rustc`**'dir. Perde arkasında **LLVM** adlı güçlü bir altyapıyla
kodunu hızlı makine koduna çevirir. Rusteach'te **Çalıştır**'a bastığında da aynı yolculuk
gerçekleşir:

```rust
fn main() {
    println!("1) Kaynak kodu sen yazdın.");
    println!("2) Derleyici onu makine koduna çevirdi.");
    println!("3) İşlemci makine kodunu çalıştırdı ve bu satırları yazdı!");
}
```

```quiz
question: |
  Derlenen (compiled) diller için hangileri **doğrudur**? (Birden fazla seçenek işaretleyebilirsin.)
options:
  - Program, çalıştırılmadan önce makine koduna çevrilir.
  - Programı çalıştırmak için hedef bilgisayarda mutlaka derleyicinin kurulu olması gerekir.
  - Pek çok hata, program hiç çalışmadan önce yakalanabilir.
  - Kaynak kodu değiştirdiğinde, yeniden derlemeden yeni hâliyle çalıştırabilirsin.
answer: [0, 2]
explanation: |
  Derleyici çeviriyi **önceden** yapar ve bir çalıştırılabilir dosya üretir; bu sırada birçok
  hatayı da yakalar. Ortaya çıkan dosya derleyici olmadan çalışır. Ama kaynak kodu değiştirirsen,
  değişikliğin programa yansıması için **yeniden derlemen** gerekir.
feedback:
  - Doğru — çeviri baştan, bir kez yapılır.
  - Hayır; derlenmiş dosya zaten makine kodu içerir, derleyiciye ihtiyaç duymaz. (Yorumlanan dillerde ise yorumlayıcı gerekir.)
  - Doğru — derleyici kodu çevirirken birçok hatayı yakalar.
  - Hayır; eski çalıştırılabilir dosya eski kodun çevirisidir. Değişikliğin yansıması için yeniden derlemelisin.
```

## 50 yıllık sorun: bellek hataları

Her program verilerini **belleğe (RAM)** koyar. Belleği, her çekmecesinin bir numarası (**adres**)
olan devasa bir dolap gibi düşün. Program çalışırken çekmeceler ister, kullanır ve işi bitince geri
verir.

C ve C++ gibi dillerde bu işi **programcı elle yapar**: Yer ister (`malloc`), işi bitince iade eder
(`free`). İnsanlar hata yapar ve bu hataların adları korkutucudur:

- **Arabellek taşması (buffer overflow):** 10 çekmece ayırıp 11.'ye yazmak — yani başkasının
  verisinin üstüne yazmak.
- **Serbest bırakıldıktan sonra kullanım (use-after-free):** İade ettiğin çekmeceyi kullanmaya devam
  etmek.
- **Çift serbest bırakma (double free):** Aynı çekmeceyi iki kez iade etmek.
- **Veri yarışı (data race):** İki iş parçacığının aynı veriye aynı anda, düzensizce yazması.

Şu C koduna bak. C derleyicisi onu hiç itiraz etmeden derler:

```c
char *bakiye = malloc(16);       // bellekten 16 baytlık yer iste
strcpy(bakiye, "Bakiye: 500");   // oraya bir metin yaz
free(bakiye);                    // yeri iade et
printf("%s\n", bakiye);          // iade edilmiş yeri kullan: TANIMSIZ DAVRANIŞ!
```

Son satırda ne olacağını kimse bilemez: Bazen doğru metin yazılır, bazen anlamsız karakterler,
bazen program çöker. En kötüsü, bazen bir saldırgan o belleğe kendi verisini yerleştirmiştir. Adım
adım izleyelim. Diyagramda solda programın değişkenleri (**stack**), sağda programın çalışırken
istediği bellek alanları (**heap**) var; ikisini de Modül 4'te ayrıntılı göreceğiz.

```memory
title: "C'de serbest bırakıldıktan sonra kullanım (use-after-free)"
steps:
  - caption: "`malloc` bellekten yer ister; `bakiye` işaretçisi (pointer) o alanın **adresini** tutar."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: "char *", value: "adres 0x5F20", to: h1 }
    heap:
      - { id: h1, value: "Bakiye: 500", label: "0x5F20" }
  - caption: "`free(bakiye)` alanı iade eder. Ama `bakiye` hâlâ eski adresi tutuyor: Artık bir **sarkan işaretçi** (dangling pointer)."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: "char *", value: "adres 0x5F20", to: h1, note: "sarkıyor!" }
    heap:
      - { id: h1, value: "Bakiye: 500", label: "0x5F20", freed: true }
  - caption: "Program aynı alanı başka bir veriye verir. `bakiye` üzerinden okumak artık **başkasının verisini** okumak demektir."
    stack:
      - frame: main
        vars:
          - { name: bakiye, type: "char *", value: "adres 0x5F20", to: h2, note: "sarkıyor!" }
          - { name: sifre, type: "char *", value: "adres 0x5F20", to: h2 }
    heap:
      - { id: h2, value: "Şifre: 1234", label: "0x5F20" }
```

Bunlar akademik sorunlar değil. **Microsoft**, her yıl düzelttiği güvenlik açıklarının yaklaşık
**%70'inin** bellek güvenliği hatası olduğunu açıkladı; **Google** da Chrome'daki ciddi güvenlik
hataları için aynı oranı buldu. 2014'teki ünlü **Heartbleed** açığında ise internetin büyük
kısmının kullandığı OpenSSL kütüphanesi, bir arabelleğin sınırları dışını okuyarak sunuculardaki
şifreleri ve gizli anahtarları sızdırdı.

```quiz
question: |
  Bir programın, **iade ettiği** (serbest bıraktığı) bellek alanını kullanmaya devam etmesine ne ad
  verilir?
options:
  - Arabellek taşması (buffer overflow)
  - Serbest bırakıldıktan sonra kullanım (use-after-free)
  - Çöp toplama (garbage collection)
  - Derleme hatası (compile error)
answer: 1
explanation: |
  **Use-after-free**: Bellek iade edildikten (`free`) sonra o adresi tutan işaretçi hâlâ
  kullanılıyor. O alan artık başka bir veriye verilmiş olabilir; sonuç çöp veri, çökme ya da
  güvenlik açığıdır.
feedback:
  - Arabellek taşması, ayrılan alanın **sınırlarının dışına** taşmaktır.
  - Doğru!
  - Çöp toplama bir hata değil, belleği otomatik yönetme yöntemidir (sıradaki adımda).
  - C derleyicisi bu kodu hatasız derler — sorun ancak program çalışırken ortaya çıkar.
```

## Üç yol: elle yönetim, çöp toplayıcı ve Rust

Java, C#, Go, Python ve JavaScript bu soruna farklı bir çözüm getirir: **çöp toplayıcı (garbage
collector, GC)**. Program çalışırken arka planda bir mekanizma, artık kullanılmayan bellek
alanlarını bulur ve otomatik olarak geri verir. Programcı `free` yazmadığı için yukarıdaki hataları
da yapamaz.

Ama bu güvenliğin bir bedeli var:

- Çöp toplayıcının kendisi de çalışırken işlemci ve ek bellek kullanır.
- Zaman zaman programı kısa süreliğine **duraklatır** — ve bunun ne zaman olacağını sen seçemezsin.
- Programla birlikte bir **çalışma zamanı (runtime)** gerekir. Bu da işletim sistemi çekirdekleri,
  gömülü sistemler ya da milisaniyelerin önemli olduğu servisler için sorun olabilir.

Gerçek bir örnek: **Discord**, Go ile yazdığı bir serviste çöp toplayıcının yaklaşık her iki dakikada
bir gecikme sıçramalarına yol açtığını gördü. Servisi Rust ile yeniden yazdıklarında bu sıçramalar
ortadan kalktı.

:::analogy Restoran mutfağı
- **C/C++:** Her aşçı kendi tabaklarını kendisi yıkar. Hızlıdır; ama dalgın bir aşçı kirli tabağı
  ortada bırakır ya da başkasının hâlâ kullandığı tabağı çöpe atar.
- **Çöp toplayıcı:** Belirli aralıklarla bir temizlik ekibi gelir, mutfağı bir anlığına durdurur ve
  kullanılmayan tabakları toplar. Güvenlidir ama servis zaman zaman aksar.
- **Rust:** Her tabağın tek bir sorumlusu vardır ve kurallar restoran **açılmadan önce** bir müfettiş
  tarafından denetlenir. Sorumlu işini bitirdiği anda tabak yıkanır — ne temizlik ekibi var ne de
  bekleme.
:::

```quiz
question: |
  Çöp toplayıcı (GC) kullanan dillerin ödediği **bedeller** hangileridir? (Birden fazla seçenek
  işaretleyebilirsin.)
options:
  - Çalışma sırasında ek işlemci ve bellek kullanımı
  - Ne zaman olacağı önceden bilinemeyen kısa duraklamalar
  - Use-after-free hatalarına açık olmaları
  - Programların hiç derlenememesi
answer: [0, 1]
explanation: |
  Çöp toplayıcı belleği güvenli hâle getirir — use-after-free gibi hataları önler — ama bunu
  **çalışma zamanında** yapar: Ek kaynak tüketir ve programı zaman zaman duraklatabilir.
feedback:
  - Doğru — çöp toplayıcının kendisi de çalışan bir programdır.
  - Doğru — bu duraklamalar özellikle düşük gecikme gereken sistemlerde sorun olur.
  - Hayır; çöp toplayıcının asıl amacı tam da bu hataları önlemektir.
  - Hayır; Java, C# ve Go gibi GC'li diller de derlenebilir. Bedel çalışma zamanında ödenir.
```

**Rust üçüncü bir yol seçti.** Bellek kuralları — hangi verinin **sahibinin** kim olduğu, veriyi
kimin ne kadar süreyle **ödünç** alabileceği — **derleme sırasında** denetlenir. Kuralları çiğneyen
kod derlenmez. Program çalışırken arka planda dolaşan bir çöp toplayıcı yoktur; bu denetimin
çalışma zamanında hiçbir maliyeti yoktur.

Yukarıdaki C hatasının Rust'taki karşılığını yazalım. Kodu şimdi anlaman gerekmiyor (`let`'i Modül
2'de, `String` ve `drop`'u Modül 4'te göreceğiz); sadece sonuca bak:

```rust,compile_fail,E0382
fn main() {
    let bakiye = String::from("Bakiye: 500");
    drop(bakiye);         // belleği serbest bırak
    println!("{bakiye}"); // serbest bırakılmış değeri kullanmaya çalış
}
```

:::error
```text
error[E0382]: borrow of moved value: `bakiye`
 --> src/main.rs:4:16
  |
2 |     let bakiye = String::from("Bakiye: 500");
  |         ------ move occurs because `bakiye` has type `String`, which does not implement the `Copy` trait
3 |     drop(bakiye);         // belleği serbest bırak
  |          ------ value moved here
4 |     println!("{bakiye}"); // serbest bırakılmış değeri kullanmaya çalış
  |                ^^^^^^ value borrowed here after move
```
Derleyici hikâyeyi satır satır anlatıyor: Değer 3. satırda `drop`'a verildi (*value moved here*), 4.
satırda ise yeniden kullanılmak istendi (*value borrowed here after move*). Program **derlenmedi**;
yani hatalı hâliyle hiçbir zaman çalışmayacak.
:::

| Yaklaşım | Örnek diller | Bellek güvenliği | Bedeli |
|---|---|---|---|
| Elle yönetim | C, C++ | Programcının dikkatine bağlı | Bellek hataları, güvenlik açıkları |
| Çöp toplayıcı | Java, C#, Go, Python, JavaScript | Var (çalışma zamanında) | Ek kaynak tüketimi, duraklamalar |
| Sahiplik + derleme zamanı denetimi | **Rust** | Var (derleme zamanında) | Daha dik bir öğrenme eğrisi, katı bir derleyici |

```quiz
question: |
  Rust, yukarıdaki "serbest bıraktıktan sonra kullanma" hatasını **ne zaman** yakaladı?
options:
  - Program çalışırken, hatalı satıra gelindiğinde
  - Derleme sırasında, program daha hiç çalışmadan
  - Arka planda çalışan çöp toplayıcı belleği temizlerken
  - Yakalayamadı; program çalışırken çöktü
answer: 1
explanation: |
  Rust'ın bellek kuralları **derleme zamanında** denetlenir. Kuralları çiğneyen kod derlenmez,
  dolayısıyla hatalı program hiç çalışmaz. Üstelik bu denetim, çalışma zamanında hiçbir ek maliyet
  getirmez.
feedback:
  - Hayır — o satıra hiç gelinmez, çünkü program derlenmez.
  - Doğru! Hata derleme sırasında yakalandı.
  - Rust'ta çöp toplayıcı yoktur.
  - Hayır; derlenmeyen bir program çalışamaz, dolayısıyla çökemez de.
```

## Rust'ın vaadi ve onu kimler kullanıyor?

Rust'ın vaadini üç başlıkta özetleyebiliriz:

1. **Güvenlik:** Bellek hataları ve veri yarışları derleme zamanında engellenir.
2. **Hız:** C ve C++ ile aynı ligde. Çöp toplayıcı yoktur; üst düzey yazdığın kod da **sıfır
   maliyetli soyutlamalar (zero-cost abstractions)** sayesinde elle optimize edilmiş kod kadar hızlı
   makine koduna dönüşür.
3. **Korkusuz eşzamanlılık (fearless concurrency):** Aynı anda birden çok iş yapan programlar yazmak
   normalde en zor işlerden biridir. Rust'ın derleyicisi, iş parçacıklarının aynı veriyi
   kontrolsüzce değiştirmesine izin vermez (Modül 18).

**Kısa bir tarihçe:** Rust, 2006'da Mozilla çalışanı **Graydon Hoare**'ın kişisel projesi olarak
doğdu. Anlatılana göre, oturduğu binanın asansörü yine bir yazılım hatası yüzünden çökünce 21 kat
merdiven çıkarken "bu tür hatalar önlenebilmeli" diye düşünmüştü. Mozilla 2009'da projeyi
desteklemeye başladı ve **Rust 1.0 Mayıs 2015'te** yayımlandı. 2021'den beri dili, kurucu üyeleri
arasında AWS, Google, Huawei, Microsoft ve Mozilla'nın bulunduğu bağımsız **Rust Vakfı (Rust
Foundation)** destekliyor. Her **6 haftada bir** yeni bir kararlı sürüm çıkar ve eski kodun
derlenmeye devam edeceği garanti edilir.

**Kimler kullanıyor?**

- **Linux çekirdeği**, 2022'den (6.1 sürümü) beri Rust ile yazılmış kodu kabul ediyor.
- **Microsoft**, Windows çekirdeğinin ve sistem bileşenlerinin bazı parçalarını Rust ile yeniden
  yazdı.
- **Google**, Android'de yeni kodu ağırlıkla Rust gibi bellek güvenli dillerle yazmaya başladıktan
  sonra, bellek güvenliği açıklarının oranının 2019'daki %76'dan 2024'te %24'e düştüğünü açıkladı.
- **Firefox**'un CSS motoru Rust ile yazıldı — dili doğuran Mozilla'nın tarayıcısında.
- **Cloudflare**, internet trafiğinin önemli bir kısmını taşıyan vekil sunucusu Pingora'yı Rust ile
  yazdı.
- **AWS**, Lambda ve Fargate servislerinin altındaki Firecracker sanallaştırma teknolojisini Rust ile
  geliştirdi.
- **Discord**, **Dropbox**, **Figma**, **1Password** ve daha niceleri...

Geliştiriciler de onu çok seviyor: Stack Overflow'un on binlerce geliştiriciyle yaptığı yıllık
ankette Rust, **2016'dan 2025'e kadar her yıl** "en çok sevilen" (2023'ten itibaren adıyla "en çok
beğenilen — *most admired*") dil seçildi.

Dürüst olalım, bedelleri de var: Rust'ın **öğrenme eğrisi diktir.** Sahiplik ve ödünç alma (Modül
4-5) yeni bir düşünme biçimi ister ve derleyici ilk başta sana "kızıyormuş" gibi gelebilir. Derleme
süreleri de bazı dillere göre uzundur. Bu uygulama tam da o dik yokuşu basamaklara bölmek için
tasarlandı.

```rust
fn main() {
    println!("🦀 Merhaba! Ben Ferris, Rust'ın gayriresmî maskotuyum.");
    println!("🦀 Rust'ı sevenlere 'Rustacean' denir: İngilizcede kabuklu deniz canlısı (crustacean) ile kelime oyunu.");
    println!("🦀 Bu yolculuğun sonunda sen de bir Rustacean olacaksın!");
}
```

```quiz
question: |
  Rust'ın "korkusuz eşzamanlılık" (*fearless concurrency*) vaadi ne anlama gelir?
options:
  - Rust programları her zaman tek bir işlemci çekirdeğinde çalışır.
  - İş parçacıklarının aynı veriyi kontrolsüzce değiştirmesi gibi hatalar derleme zamanında engellenir.
  - Rust'ta iş parçacığı (thread) kullanmak yasaktır.
  - Eşzamanlılık hataları çalışma zamanında otomatik olarak düzeltilir.
answer: 1
explanation: |
  Aynı anda birden çok iş yapan programlarda en sinsi hata **veri yarışıdır**: İki iş parçacığı
  aynı veriye aynı anda yazar ve sonuç rastgeleleşir. Rust'ın tip sistemi ve sahiplik kuralları
  bunu **derleme zamanında** engeller; böylece eşzamanlı kodu "korkmadan" yazabilirsin. Ayrıntıları
  Modül 18'de göreceğiz.
feedback:
  - Hayır; Rust çok çekirdekli programlar yazmaya çok uygundur.
  - Doğru!
  - Hayır; iş parçacıkları Rust'ın standart kütüphanesinin bir parçasıdır.
  - Hayır; Rust hataları düzeltmez, **önler** — hem de derleme zamanında.
```

## Beynin nasıl öğrenir — ve Rusteach bunu nasıl kullanır?

Rust öğrenmek bir maraton. İyi haber şu: Bilişsel bilim beynin en iyi nasıl öğrendiğini oldukça iyi
biliyor ve Rusteach bu bulgular üzerine kuruldu. Aşağıdaki tablo ilkeleri ve uygulamadaki
karşılıklarını gösteriyor:

| İlke | Neden işe yarar? | Rusteach'te |
|---|---|---|
| **Hatırlamaya çalış** (geri çağırma pratiği) | Bilgiyi hafızadan çekip çıkarmak, onu tekrar okumaktan çok daha kalıcı iz bırakır (test etkisi). | Her adımda sorular var; **Devam** düğmesi soruyu cevaplayınca açılır. |
| **Az ama her gün** (aralıklı tekrar) | Öğrendiğinin çoğunu birkaç gün içinde unutursun (unutma eğrisi); tam unutmak üzereyken tekrar edersen iz derinleşir. | Ders sonundaki kartlar ve yanlış cevapladığın sorular, **Tekrar** sayfasında tam zamanında karşına çıkar. |
| **Önce tahmin et** | Tahmin, beynini doğru cevaba hazırlar; yanılsan bile öğrenme güçlenir. | "Bu kod ne yazdırır?" ve "Derlenir mi?" soruları açıklamadan **önce** gelir. |
| **Hatadan korkma** | Çok emin olup yanıldığın bilgiler, düzeltildikten sonra en iyi hatırlananlardır. | Sorulardan sonra "Ne kadar emindin?" diye sorulur; emin olmadığın konular tekrar kuyruğuna girer. |
| **Kendin üret** | Kodu kendin yazmak, okumaktan çok daha derin öğrenme sağlar. | Alıştırmalar, kademeli ipuçları ve gerçek derleyici geri bildirimi. |
| **Kendi cümlelerinle açıkla** | Açıklamaya çalışmak, anlamadığın yerleri ortaya çıkarır. | "Düşün" kutuları ve her derse yazabileceğin kendi notların. |
| **Karıştır** | Konuları karışık çalışmak, hangi bilginin ne zaman gerektiğini ayırt etmeyi öğretir. | **Antrenman** sayfası modülleri karıştırarak soru sorar. |

:::tip Önerilen günlük rutin (20-30 dakika)
1. **Tekrar** kuyruğunu bitir (5-10 dk).
2. **Bir yeni ders** çalış (15 dk). Kodu kopyalamak yerine kendin yazmayı dene.
3. Vaktin kalırsa **Antrenman**'daki hata defterine göz at.

Haftada bir kez 3 saat yerine her gün yarım saat çalışmak çok daha etkilidir. İyi bir uyku da
öğrendiklerinin pekişmesini sağlar.
:::

Puanlar (XP), günlük hedef ve seri (*streak*) seni motive etmek için var; ama asıl hedef öğrenmek.
Her modülün sonunda bir **boss sınavı** seni bekliyor: %80 başarıyla bir sonraki modülün kilidi
açılır. Böylece bir konuyu gerçekten öğrenmeden diğerine geçmezsin.

```quiz
question: |
  Yarın bir konuyu hatırlamak istiyorsun. Bugün yapabileceğin **en etkili** çalışma hangisi?
options:
  - Ders metnini üç kez baştan sona tekrar okumak
  - Önemli cümlelerin altını renkli kalemle çizmek
  - Metni kapatıp öğrendiklerini hatırlamaya çalışmak, sonra eksiklerini kontrol etmek
  - Hiç ara vermeden, tek oturumda 5 saat çalışmak
answer: 2
explanation: |
  **Geri çağırma pratiği** (*retrieval practice*), araştırmalarda en etkili öğrenme yöntemlerinden
  biri olarak öne çıkar: Hafızadan çekip çıkarmaya çalıştığın bilgi güçlenir. Tekrar okumak ve altını
  çizmek "tanıdık" hissettirir ama bu his çoğu zaman yanıltıcıdır. Tek oturuma sıkıştırılmış çalışma
  da kısa vadede işe yarıyor gibi görünse de hızla unutulur.
feedback:
  - Tekrar okumak tanıdıklık hissi verir ama kalıcılığı düşüktür.
  - Altını çizmek pasif bir etkinliktir; tek başına öğrenmeye çok az katkı sağlar.
  - Doğru! Önce hatırlamaya çalış, sonra kontrol et.
  - Sıkıştırılmış çalışma hızla unutulur; aralıklı çalışma çok daha kalıcıdır.
```

Şimdi ilkelerden birini — **kendin üret** — hemen uygulayalım. İşte ilk alıştırman! Alıştırmalarda
kodu sen yazarsın; **Kontrol et**'e bastığında program çalıştırılır ve çıktısı beklenenle
karşılaştırılır.

````exercise
id: m01-e-ilk-dokunus
title: İlk dokunuş
difficulty: 1
prompt: |
  Aşağıdaki program şu an `Merhaba, Dünya!` yazıyor. Onu, ekrana **tam olarak** şu iki satırı
  yazacak şekilde değiştir:

  ```text
  Merhaba, Ferris!
  Rust yolculuğum başlıyor.
  ```

  Büyük-küçük harf, virgül ve nokta dahil her karakter önemli — bilgisayar harfiyen çalışır!
  Takılırsan ipuçlarını **birer birer** aç; her ipucu bir öncekinden biraz daha fazlasını söyler.
starter: |
  fn main() {
      println!("Merhaba, Dünya!");
  }
solution: |
  fn main() {
      println!("Merhaba, Ferris!");
      println!("Rust yolculuğum başlıyor.");
  }
check: output
expected_output: |
  Merhaba, Ferris!
  Rust yolculuğum başlıyor.
hints:
  - |
    Çift tırnak (`"`) içindeki metin, ekrana yazılan metindir. İşe `Dünya` kelimesini `Ferris`
    yaparak başla.
  - |
    Her `println!` bir satır yazar. İkinci satır için `println!(...);` satırının tamamını kopyalayıp
    hemen altına yapıştır, sonra tırnakların içini değiştir.
  - |
    İkinci satır tam olarak şöyle olmalı: `println!("Rust yolculuğum başlıyor.");` — sondaki noktalı
    virgülü (`;`) unutma.
explanation: |
  Her `println!` metnini yazar ve satır sonuna geçer; iki satır için iki `println!` kullandık.
  Talimatlar yukarıdan aşağıya çalıştığı için satırların sırası da önemli.

  Bilgisayarın harfiyen çalıştığını da gördün: `Ferris` yerine `ferris` yazsaydın ya da sondaki
  noktayı unutsaydın çıktı farklı olurdu ve kontrol başarısız olurdu.

  Sonraki derslerde `println!`'in aslında bir **makro** olduğunu, tek bir `println!` ile birden
  fazla satır yazmayı (`\n`) ve değerleri metnin içine yerleştirmeyi öğreneceksin.
````

## Özet

:::remember
- **Program**, işlemcinin harfiyen uyguladığı talimatlardır; işlemci yalnızca **makine kodu** anlar.
- **Derleyici** kodu çalıştırmadan önce bir kez çevirir (Rust, C, C++); **yorumlayıcı** çalışırken
  çevirir (Python, JavaScript).
- C/C++'ta bellek elle yönetilir; bellek hataları ciddi güvenlik açıklarının **yaklaşık %70'inin**
  kaynağıdır.
- **Çöp toplayıcılı** diller güvenlidir ama çalışma zamanında bedel öder (ek kaynak, duraklamalar).
- **Rust** bellek kurallarını **derleme zamanında** denetler: hem güvenli hem hızlı.
- İyi öğrenmenin sırrı: **hatırlamaya çalış, her gün biraz çalış, önce tahmin et, hatadan korkma.**
:::

```reflect
prompt: |
  Bir arkadaşın soruyor: "Zaten C de var, Python da var. Rust'a neden ihtiyaç duyuldu?" Ona iki-üç
  cümleyle nasıl açıklarsın?
answer: |
  Model cevap: C çok hızlıdır ama belleği programcı elle yönetir; bu da use-after-free gibi hatalara
  ve ciddi güvenlik açıklarına yol açar. Python gibi çöp toplayıcılı diller güvenlidir ama çalışma
  zamanında ek kaynak harcar ve daha yavaştır. Rust ikisinin iyi yanlarını birleştirir: Bellek
  kurallarını **derleme zamanında** denetler; böylece hem C kadar hızlı hem de bellek açısından
  güvenli programlar yazılabilir.
```

```flashcards
- front: Derleyici (compiler) ne yapar?
  back: Kaynak kodun tamamını, program **çalışmadan önce** makine koduna çevirir ve çalıştırılabilir bir dosya üretir.
- front: Derlenen dil ile yorumlanan dil arasındaki temel fark nedir?
  back: Derlenen dilde çeviri çalıştırmadan önce bir kez yapılır (Rust, C); yorumlanan dilde kod çalışırken satır satır çevrilip uygulanır (Python, JavaScript).
- front: "**Use-after-free** hatası nedir?"
  back: İade edilmiş (serbest bırakılmış) bir bellek alanını kullanmaya devam etmek. Sonuç çöp veri, çökme ya da güvenlik açığı olabilir.
- front: Microsoft ve Google'a göre ciddi güvenlik açıklarının yaklaşık ne kadarı bellek güvenliği hatasıdır?
  back: Yaklaşık **%70**'i.
- front: Çöp toplayıcının (GC) bedeli nedir?
  back: Çalışma zamanında ek işlemci ve bellek kullanımı, önceden bilinemeyen duraklamalar.
- front: Rust bellek güvenliğini **ne zaman** ve nasıl sağlar?
  back: Derleme zamanında, sahiplik ve ödünç alma kurallarını denetleyerek — çöp toplayıcı olmadan.
- front: Rust'ın üç büyük vaadi nedir?
  back: Güvenlik, hız ve korkusuz eşzamanlılık.
- front: "**Geri çağırma pratiği** (retrieval practice) nedir ve neden tekrar okumaktan daha etkilidir?"
  back: Metne bakmadan hatırlamaya çalışıp sonra kontrol etmek. Hafızadan çekip çıkarılan bilgi güçlenir; tekrar okumak yalnızca tanıdıklık hissi verir.
```
