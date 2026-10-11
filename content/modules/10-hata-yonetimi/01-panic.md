---
id: m10-l01
title: "panic!, Kurtarılamaz Hatalar"
minutes: 16
type: lesson
objectives:
  - "`panic!` çağrıldığında programın adım adım ne yaptığını (mesaj, unwinding, temizlik, çıkış kodu) açıklayabilmek"
  - Panik mesajını ve `RUST_BACKTRACE=1` ile alınan backtrace'i okuyarak hatanın kaynağını bulabilmek
  - Kütüphane kodundan gelen yaygın panikleri tanıyıp yerine `Option` döndüren güvenli alternatifleri kullanabilmek
  - Bir hatanın programlama hatası mı (panik) yoksa beklenen bir durum mu olduğunu ayırt edebilmek
keywords: [panic!, unwinding, abort, RUST_BACKTRACE, backtrace, todo!, unreachable!, hata yönetimi]
---

Şimdiye kadar yazdığın programlarda her şeyin yolunda gideceğini varsaydık. Gerçek dünya ise daha dağınık:
kullanıcıya yaşını sorarsın, "yirmi" yazar; aradığın dosya silinmiştir; ağ bağlantısı kopar, ve bazen de
biz programcılar hata yaparız. Rust hataları iki büyük aileye ayırır: **kurtarılabilir (recoverable)** ve
**kurtarılamaz (unrecoverable)** hatalar. Bu modülün sonunda ikisini de bir usta gibi yöneteceksin.

İlk durağımız, kurtarılamaz hataların alarm zili: **`panic!`**.

:::ferris
Modül 2'den beri `parse` sonrasında "şimdilik" diyerek `.unwrap()` yazıyorduk, hatırlıyor musun? O "şimdilik"
bu modülde bitiyor. Hazırsan başlayalım! 🦀
:::

## Önce tahmin et: dizinin dışına çıkmak

Aşağıdaki program, 3 notluk bir listenin 6. elemanını okumaya çalışıyor. Açıklamaya geçmeden önce ne olacağını
tahmin et, yanılsan bile tahmin etmek öğrenmeni güçlendirir.

````quiz
question: |
  Bu program çalıştırıldığında ne olur?

  ```rust
  fn main() {
      let notlar = vec![85, 92, 78];
      println!("Başlıyoruz");
      let i = notlar.len() + 2;
      println!("{}", notlar[i]);
      println!("Bitti");
  }
  ```
options:
  - "`Başlıyoruz` yazılır, sonra program bir hata mesajıyla **durur**; `Bitti` hiç yazılmaz"
  - "`Başlıyoruz`, ardından bellekte o adreste ne varsa (anlamsız bir sayı), sonra `Bitti` yazılır"
  - "Program derlenmez; derleyici `notlar[i]` erişiminin dizin dışında kaldığını görür"
  - "Hatalı satır atlanır: `Başlıyoruz` ve `Bitti` yazılır"
answer: 0
explanation: |
  `i` değeri 5, vektörün uzunluğu ise 3. Rust her dizinleme işleminde bir **sınır denetimi (bounds check)**
  yapar; geçersiz bir dizin gördüğünde programı **panikle** durdurur. `Başlıyoruz` panikten önce yazıldığı için
  ekrana gelir, `Bitti` ise hiç çalışmaz.
feedback:
  - Doğru! Rust geçersiz dizini fark eder ve programı durdurur.
  - "C ve C++ tam olarak bunu yapabilir: dizinin bittiği yerdeki belleği okur ve devam eder (tanımsız davranış). Rust buna izin vermez."
  - "`Vec`'in uzunluğu çalışma zamanında belli olur, `i` de çalışırken hesaplanıyor. Derleyici bunu bilemez; denetim çalışırken yapılır."
  - Hiçbir dil hatalı satırı sessizce atlamaz; bu, hatayı gizlemek olurdu.
````

Programı çalıştırdığında terminalde şunu görürsün:

:::error Panik mesajı
```text
Başlıyoruz
thread 'main' (13) panicked at src/main.rs:5:26:
index out of bounds: the len is 3 but the index is 5
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Satır satır oku: **1)** `thread 'main' (13)`, paniği yaşayan thread, yani programın ana akışı (parantezdeki
sayı thread'in kimlik numarasıdır, çalıştırmadan çalıştırmaya değişir). **2)** `src/main.rs:5:26`, paniğin
yeri: 5. satır, 26. sütun (`notlar[i]` ifadesi). **3)** `index out of bounds: the len is 3 but the
index is 5`, ne olduğu: "uzunluk 3, ama istenen dizin 5". **4)** `note`, daha fazla ayrıntı için bir ipucu
("Backtrace ile iz sürmek" bölümünde kullanacağız).
:::

Rust burada bilinçli bir seçim yapıyor: **yanlış bir değerle devam etmektense durmak**. C'de aynı kod, dizinin
bittiği yerdeki belleği okuyup ekrana anlamsız bir sayı basabilir ve hiçbir şey olmamış gibi yoluna devam
edebilir. 2014'te yüz binlerce sunucuyu etkileyen **Heartbleed** açığı tam olarak böyle eksik bir sınır
denetiminden doğdu: saldırganlar sunucuların belleğinden şifreleri ve gizli anahtarları okuyabiliyordu. Python
(`IndexError`) ve Java (`ArrayIndexOutOfBoundsException`) da Rust gibi durur; ama orada bu bir **istisnadır
(exception)** ve sıradan hatalarla aynı `try/catch` mekanizmasıyla yakalanıp yönetilmesi olağandır. Rust'ın
farkı, dizin dışına çıkmayı yakalanıp geçiştirilecek bir durum olarak değil, düzeltilmesi gereken bir **bug**
olarak görmesidir: beklenen hatalar için bambaşka bir araç (`Result`) kullanır.

Peki derleyici bu hatayı hiç yakalayamaz mı? Yakalayabildiği durumlar var:

```compiles
code: |
  fn main() {
      let notlar = [85, 92, 78];
      println!("{}", notlar[5]);
  }
answer: false
explanation: |
  Bu sefer elimizde bir **dizi (array)** var: `[i32; 3]` tipinin uzunluğu derleme zamanında belli ve dizin de
  sabit bir `5`. Derleyici paniğin **kesin** olduğunu bildiği için kodu hiç derlemez:
  `error: this operation will panic at runtime` (Modül 2'de dizileri işlerken görmüştük).
  `Vec`'in uzunluğu ise ancak çalışırken belli olur; önceki örnekteki hata bu yüzden çalışma zamanında yakalandı.
  Kural: Rust hatayı **mümkün olan en erken anda** yakalar - derleme zamanında yapamıyorsa çalışma zamanında.
```

## İki tür hata

Her hata aynı değildir. Şu iki duruma bak:

1. Kullanıcı, yaş alanına `"yirmi"` yazdı.
2. Senin kodun, uzunluğu 3 olan bir vektörün 5. elemanını istedi.

İlki **beklenen** bir durum: kullanıcılar hata yapar ve program buna hazırlıklı olmalıdır. Yaşı tekrar sorabilir,
bir uyarı gösterebilir. Bu bir **kurtarılabilir hata**dır; Rust'ta `Result<T, E>` tipiyle ifade edilir (sonraki
dersin konusu).

İkincisi ise bir **programlama hatası (bug)**: kod, var olmayan bir şeyi istiyor. Bu noktadan sonra hangi değerle
devam edilirse edilsin sonuç yanlış olur. Bu bir **kurtarılamaz hata**dır ve Rust'ın cevabı `panic!`'tir:
dur, sesini yükselt, hatanın yerini göster.

| Dil | Beklenen hatalar | Programlama hataları (bug) |
|---|---|---|
| C | dönüş kodu, `errno`, kontrol etmeyi unutmak çok kolay | tanımsız davranış: çökme ya da sessizce bozulan veri |
| Java, Python, JS | istisna (exception), çoğu zaman fonksiyonun imzasında görünmez | yine istisna |
| Go | `error` dönüş değeri | `panic` |
| **Rust** | **`Result<T, E>`**, tipte görünür, yok sayılamaz | **`panic!`** |

Rust'ın farkı, iki türü **ayrı araçlarla** ele alması: beklenen hatalar tip sisteminin bir parçasıdır (derleyici
onları ele almanı ister), programlama hataları ise programı durdurur.

:::analogy Lastik patlaması mı, motor yangını mı?
Yolda lastiğin patlarsa yedek lastiği takar, yoluna devam edersin: can sıkıcı ama **beklenen** bir aksilik,
**kurtarılabilir**. Kaputtan duman yükseliyorsa durur ve araçtan inersin; "idare eder" diye sürmeye devam etmek
felakete götürür, **kurtarılamaz**. Rust'ta yedek lastiğin adı `Result`, acil durdurmanın adı `panic!`.
:::

```quiz
question: "Aşağıdakilerden hangileri **kurtarılabilir** (beklenen) hatalardır? Birden fazla seçenek doğru olabilir."
options:
  - "Kullanıcı yaş alanına `\"on sekiz\"` yazdı"
  - Programcının yazdığı sıralama fonksiyonundaki bir hata yüzünden, sıralı olması gereken liste karışık
  - "Okunmak istenen `ayarlar.toml` dosyası diskte yok"
  - Kod, uzunluğu 3 olan bir vektörün 7. elemanına erişmeye çalışıyor
answer: [0, 2]
explanation: |
  Kullanıcı girdisi ve dosya sistemi **dış dünyadır**: kodun kusursuz olsa bile başarısız olabilirler; bunlar
  `Result` ile ele alınır. Bozuk sıralama ve dizin dışına çıkma ise kodun kendisindeki **hatalardır (bug)**;
  doğru yol programı durdurmak, hatayı görünür kılmak ve kodu düzeltmektir.
feedback:
  - "Doğru: kullanıcılar her şeyi yazabilir, bu beklenen bir durum."
  - "Bu bir bug: kodun kendi varsayımı (sıralı liste) bozulmuş. Devam etmek yanlış sonuçlar üretir."
  - "Doğru: dosyalar silinebilir, taşınabilir; program buna hazırlıklı olmalı."
  - "Bu bir bug: kod var olmayan bir elemanı istiyor."
```

## panic! makrosu

Paniklerin çoğu standart kütüphaneden gelir (az önceki dizin hatası gibi), ama istersen kendin de
tetikleyebilirsin. `panic!` bir makrodur ve `println!` gibi biçimlendirme kabul eder. Ne zaman kullanılır?
Program, **asla olmaması gereken** bir duruma geldiğinde: örneğin bir fonksiyonun **sözleşmesi** (çağıranın
uyması gereken şart) bozulduğunda.

```rust
// Sözleşme: `toplam` asla 0 olmamalı - bunu çağıran garanti eder.
fn yuzde_hesapla(kismi: u32, toplam: u32) -> u32 {
    if toplam == 0 {
        panic!("yuzde_hesapla() toplam = 0 ile çağrıldı (kismi = {kismi})");
    }
    kismi * 100 / toplam
}

fn main() {
    let dogru = 18;
    let soru = 24;
    println!("Başarı: %{}", yuzde_hesapla(dogru, soru));
    // Dene: `soru` değişkenini 0 yapıp tekrar çalıştır!
}
```

`soru`'yu 0 yapıp çalıştırırsan şunu görürsün:

:::error Panik mesajı
```text
thread 'main' (12) panicked at src/main.rs:4:9:
yuzde_hesapla() toplam = 0 ile çağrıldı (kismi = 18)
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Konum (`4:9`) senin `panic!` satırını, ikinci satır da senin mesajını gösteriyor. İyi bir panik mesajı **neyin
bozulduğunu ve hangi değerle** bozulduğunu söyler. Panikle biten bir program işletim sistemine **101** çıkış kodu
döndürür (başarılı bitiş 0'dır); betikler ve CI sistemleri programın çöktüğünü buradan anlar.
:::

`panic!`'in birkaç akrabası var. Hepsi aynı mekanizmayı kullanır, sadece **niyeti** farklı anlatır:

| Makro | Ne zaman? | Panik mesajı |
|---|---|---|
| `panic!("...")` | genel amaçlı: "bu durum olmamalıydı" | senin mesajın |
| `todo!()` | "henüz yazmadım", kod derlenir, çalışınca panikler | `not yet implemented` |
| `unimplemented!()` | "bu yolu desteklemiyorum" | `not implemented` |
| `unreachable!("...")` | "mantıken buraya asla gelinmez" | `internal error: entered unreachable code: ...` |
| `assert!(kosul)` | bir koşulu doğrulamak (Modül 13'te testlerde) | `assertion failed: kosul` |

Alıştırmaların başlangıç kodlarında gördüğün `todo!()` aslında bir panik makrosudur: fonksiyonun gövdesi henüz
yokken bile kodun derlenmesini sağlar.

```rust,should_panic
fn vergi_hesapla(_tutar: u32) -> u32 {
    todo!("KDV oranları netleşince yazılacak")
}

fn main() {
    println!("Fatura hazırlanıyor...");
    let vergi = vergi_hesapla(1000);
    println!("Vergi: {vergi}");
}
```

Bunu çalıştırınca `Fatura hazırlanıyor...` yazılır, ardından program
`not yet implemented: KDV oranları netleşince yazılacak` mesajıyla panikler.

```fill
prompt: |
  `yildiz_puani` fonksiyonuna yalnızca kendi kodumuz, önceden doğrulanmış 0-5 arası puanlar gönderiyor.
  5'ten büyük bir puan, programın başka bir yerinde **bir hata (bug)** olduğu anlamına gelir. Fonksiyon bu
  durumda panik atsın ve mesajda gelen puanı göstersin.
code: |
  fn yildiz_puani(puan: u8) -> String {
      if puan > 5 {
          ___0!("puan 0-5 arası olmalı, gelen: {}", ___1);
      }
      "★".repeat(puan as usize) // repeat: metni n kez tekrarlar
  }

  fn main() {
      println!("{}", yildiz_puani(4));
      println!("[{}]", yildiz_puani(0));
  }
blanks:
  - ["panic"]
  - ["puan"]
output: |
  ★★★★
  []
explanation: |
  `panic!("...", puan)` tam bir `println!` gibi biçimlendirir; mesajda **gelen değeri** göstermek, hatayı
  ayıklarken çok işe yarar. `{puan}` diye satır içi de yazabilirdin. Programın çıktısında panik yok, çünkü
  `main` yalnızca geçerli puanlar gönderiyor; `yildiz_puani(9)` çağırırsan panik mesajını görürsün.
```

## Panik anında ne olur? Unwinding ve abort

Bir panik başladığında Rust varsayılan olarak şunları yapar:

1. Panik mesajını (konum + açıklama) standart hata akışına (stderr) yazar.
2. **Geri sarma (unwinding)** yapar: çağrı yığınında (stack) geriye doğru, fonksiyon fonksiyon ilerler ve her
   çerçevede (frame) **sahip olunan** değerleri `drop` eder, `String`'lerin, `Vec`'lerin heap belleği serbest
   kalır. Modül 4'te öğrendiğin "kapsam bitince temizle" kuralı (RAII) panikte de geçerlidir.
3. Panik ana thread'deyse program **101** çıkış koduyla sonlanır.

Aşağıdaki programda `ucuncu_not`, iki elemanlı bir listenin üçüncü elemanını istiyor. Adım adım izle:

```rust,should_panic
fn ucuncu_not(liste: &[u32]) -> u32 {
    liste[2]
}

fn karne_yazdir(isim: String, notlar: Vec<u32>) {
    let n = ucuncu_not(&notlar);
    println!("{isim}: 3. not {n}");
}

fn main() {
    let okul = String::from("Fen Lisesi");
    karne_yazdir(String::from("Elif"), vec![90, 75]);
    println!("{okul}");
}
```

```memory
title: Panik anında stack geri sarılır (unwinding)
steps:
  - caption: "Panikten hemen önce: stack'te üç çerçeve var. `liste`, `karne_yazdir`'daki `notlar` vektörünün heap'teki elemanlarını gösteren bir dilim (Modül 5): `notlar`'ı ödünç alıyor."
    stack:
      - frame: main
        vars:
          - { name: okul, type: String, value: "ptr · len=10 · cap=10", to: h1 }
      - frame: karne_yazdir
        vars:
          - { name: isim, type: String, value: "ptr · len=4 · cap=4", to: h2 }
          - { name: notlar, type: "Vec<u32>", value: "ptr · len=2 · cap=2", to: h3 }
      - frame: ucuncu_not
        vars:
          - { name: liste, type: "&[u32]", value: "ptr · len=2", to: h3, note: "liste[2] → 💥" }
    heap:
      - { id: h1, value: "F e n   L i s e s i" }
      - { id: h2, value: "E l i f" }
      - { id: h3, value: "[90, 75]" }
  - caption: "`liste[2]` panikler ve unwinding başlar: önce en üstteki `ucuncu_not` çerçevesi kapanır. `liste` yalnızca bir referans; serbest bırakacağı bir şey yok."
    stack:
      - frame: main
        vars:
          - { name: okul, type: String, value: "ptr · len=10 · cap=10", to: h1 }
      - frame: karne_yazdir
        vars:
          - { name: isim, type: String, value: "ptr · len=4 · cap=4", to: h2 }
          - { name: notlar, type: "Vec<u32>", value: "ptr · len=2 · cap=2", to: h3 }
    heap:
      - { id: h1, value: "F e n   L i s e s i" }
      - { id: h2, value: "E l i f" }
      - { id: h3, value: "[90, 75]" }
  - caption: "Sıra `karne_yazdir`'da: sahibi olduğu `notlar` ve `isim` **drop** edilir, heap bellekleri serbest kalır."
    stack:
      - frame: main
        vars:
          - { name: okul, type: String, value: "ptr · len=10 · cap=10", to: h1 }
    heap:
      - { id: h1, value: "F e n   L i s e s i" }
      - { id: h2, value: "E l i f", freed: true }
      - { id: h3, value: "[90, 75]", freed: true }
  - caption: "Son olarak `main`'deki `okul` da drop edilir. Ana thread bitti; program **101** çıkış koduyla sonlanır. `println!(\"{okul}\")` satırı hiç çalışmaz."
    stack: []
    heap:
      - { id: h1, value: "F e n   L i s e s i", freed: true }
      - { id: h2, value: "E l i f", freed: true }
      - { id: h3, value: "[90, 75]", freed: true }
```

Temizliğin gerçekten yapıldığını **görmek** ister misin? Aşağıdaki programdaki `impl Drop` bloğu bir
önizleme: "bu değer silinirken şu mesajı yazdır" demek (`Drop` trait'ini Modül 17'de ayrıntılı göreceğiz;
şimdilik yalnızca çıktıya odaklan).

```rust,should_panic
struct Kaynak(&'static str);

impl Drop for Kaynak {
    fn drop(&mut self) {
        println!("🧹 {} temizlendi", self.0);
    }
}

fn riskli_islem() {
    let _gecici = Kaynak("geçici dosya");
    panic!("disk doldu!");
}

fn main() {
    let _baglanti = Kaynak("veritabanı bağlantısı");
    riskli_islem();
    println!("buraya hiç gelinmez");
}
```

Çalıştırınca panik mesajının ardından önce `🧹 geçici dosya temizlendi`, sonra
`🧹 veritabanı bağlantısı temizlendi` yazılır: unwinding, en son açılan çerçeveden başlayarak her şeyi
toparlar. `buraya hiç gelinmez` ise gerçekten hiç yazılmaz.

**abort stratejisi.** Bazen bu temizliği istemezsin: geri sarma için ikili dosyaya ek bilgi gömülür ve bu,
programı büyütür. Gömülü sistemler gibi her baytın önemli olduğu yerlerde `Cargo.toml`'a şunu eklersin:

```toml
[profile.release]
panic = "abort"
```

Artık `--release` derlemelerinde panik olunca program **anında** sonlandırılır: mesaj yazılır ama geri sarma da
`drop` da yoktur. Belleği işletim sistemi zaten geri alır; kaybolan, programın kendi temizlik işleridir
(tampondaki veriyi diske yazmak, geçici dosyayı silmek gibi). Profilleri Modül 16'da ayrıntılı göreceğiz.

:::analogy Tahliye mi, şalteri indirmek mi?
Bir binada yangın alarmı çaldığında **tahliye** (unwinding) düzenlidir: herkes kat kat, sırayla çıkar; çıkarken
ocağı kapatır, kapıyı kilitler. **Şalteri indirmek** (abort) ise her şeyi bir anda karartır: hızlıdır, ama kimse
arkasını toplamaz. İkisinde de bina boşalır; fark, geride bıraktığın düzendedir.
:::

```quiz
question: "`Cargo.toml`'da `panic = \"abort\"` ayarlı bir programda panik olursa aşağıdakilerden hangisi **olmaz**?"
options:
  - Panik mesajı ekrana yazılır
  - Stack geri sarılır ve her çerçevedeki değerlerin temizliği (drop) yapılır
  - Program sonlanır
  - İşletim sistemi, programın kullandığı belleği geri alır
answer: 1
explanation: |
  `abort` stratejisinde panik mesajı yine yazılır, ama **unwinding yapılmaz**: program o anda sonlandırılır ve
  hiçbir `drop` çalışmaz. Belleği işletim sistemi her durumda geri alır; kaybolan şey, programın kendi temizlik
  işleridir (yarım kalan dosyayı silmek, tampondaki veriyi diske yazmak, bağlantıyı düzgünce kapatmak).
feedback:
  - "Mesaj yine yazılır: mesajı basan mekanizma (panic hook) sonlandırmadan önce çalışır."
  - Doğru! abort'ta geri sarma ve temizlik yoktur.
  - Program her iki stratejide de sonlanır.
  - "Bir süreç (process) bittiğinde belleğini her zaman işletim sistemi geri alır, abort'ta da."
```

:::deep Panik hakkında birkaç ayrıntı
- Panik **thread başınadır**: yan bir thread paniklerse yalnızca o thread biter, ana thread sonucu kontrol edip
  devam edebilir (thread'leri Modül 18'de göreceğiz). Ana thread paniklerse program biter.
- Unwinding sırasında bir `drop` kodu **tekrar** paniklerse ("panik içinde panik"), Rust işi bırakır ve
  programı doğrudan abort eder.
- `std::panic::catch_unwind` diye bir fonksiyon var, ama bu bir `try/catch` değildir: C kodu ile Rust kodunun
  sınırında ya da thread havuzlarında paniğin yayılmasını durdurmak gibi özel durumlar içindir. Beklenen
  hataları **asla** panik + yakalama ile yönetme; onların aracı `Result`.
:::

## Backtrace ile iz sürmek

Panik mesajı hatanın **nerede** patladığını söyler: `liste[2]` satırı. Ama asıl soru çoğu zaman şudur: bu
fonksiyona o hatalı veriyi **kim** gönderdi? Büyük bir programda `ucuncu_not` onlarca yerden çağrılıyor
olabilir. Çağrı zincirini görmek için **backtrace (çağrı izi)** iste. Kendi bilgisayarında, terminalde:

```powershell
# Windows PowerShell
$env:RUST_BACKTRACE=1; cargo run
```

```bat
:: Windows cmd
set RUST_BACKTRACE=1
cargo run
```

```sh
# Linux, macOS, Git Bash
RUST_BACKTRACE=1 cargo run
```

Projenin adı `karne` olsun. Unwinding bölümündeki `ucuncu_not` programı şu çıktıyı verir (yollar kısaltıldı):

:::error Panik mesajı + backtrace
```text
thread 'main' (14) panicked at src/main.rs:2:5:
index out of bounds: the len is 2 but the index is 2
stack backtrace:
   0: __rustc::rust_begin_unwind
             at /rustc/.../library/std/src/panicking.rs:679:5
   1: core::panicking::panic_fmt
             at /rustc/.../library/core/src/panicking.rs:80:14
   2: core::panicking::panic_bounds_check
             at /rustc/.../library/core/src/panicking.rs:271:5
   3: karne::ucuncu_not
             at ./src/main.rs:2:5
   4: karne::karne_yazdir
             at ./src/main.rs:6:13
   5: karne::main
             at ./src/main.rs:12:5
   6: <fn() as core::ops::function::FnOnce<()>>::call_once
             at .../library/core/src/ops/function.rs:250:5
note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.
```
Okuma yöntemi: liste **en son çağrılan fonksiyondan** başlar. **1)** En üstteki satırlar (`0`-`2`) standart
kütüphanenin panik mekanizmasıdır; atla. **2)** Kendi crate adınla (`karne::`) başlayan **ilk** satırı bul:
paniğin olduğu fonksiyon odur. **3)** Aşağı doğru in: her satır, bir üsttekini **çağıran** fonksiyondur.
Hikâyeyi aşağıdan yukarı okursan: `main` (12. satır) → `karne_yazdir` (6. satır) → `ucuncu_not` (2. satır) 💥
:::

Daha da fazla ayrıntı için `RUST_BACKTRACE=full` kullanabilirsin. Backtrace'in satır numaraları gösterebilmesi
için hata ayıklama bilgisi gerekir; bu bilgi `cargo build`/`cargo run`'ın varsayılan **debug** derlemesinde
vardır, `--release` derlemelerinde ise çoğu zaman eksiktir.

```quiz
question: "Yukarıdaki backtrace'e göre panik **hangi fonksiyonda** oluştu ve o fonksiyonu **kim** çağırdı?"
options:
  - "`core::panicking::panic_bounds_check` içinde; onu `rust_begin_unwind` çağırdı"
  - "`ucuncu_not` içinde (`main.rs` satır 2); onu `karne_yazdir` (satır 6) çağırdı"
  - "`main` içinde (satır 12); onu `karne_yazdir` çağırdı"
answer: 1
explanation: |
  0-2 numaralı satırlar standart kütüphanenin panik mekanizmasıdır. Kendi crate adınla (`karne::`) başlayan
  **ilk** satır paniğin yeridir: `ucuncu_not`, `main.rs:2`. Bir alttaki satır onu çağıranı gösterir:
  `karne_yazdir`, `main.rs:6`. En alttaki `main` ise zincirin başlangıcıdır.
feedback:
  - Bunlar std'nin iç fonksiyonları, paniği raporlayan mekanizma, hatanın kaynağı değil.
  - Doğru! Backtrace yukarıdan aşağıya, "en son çağrılandan ilk çağırana" doğru okunur.
  - Ters okudun. Liste en son çağrılan fonksiyondan başlar; `main` en altta, zincirin başındadır.
```

Hatayı bulduk; peki nasıl düzelteceğiz? Önce bir soru sor: **üçüncü notun olmaması bir bug mı, yoksa beklenen
bir durum mu?** Dönem ortasında bazı öğrencilerin üçüncü notu henüz girilmemiş olabilir. Bu durumda bu bir
bug değil, beklenen bir durumdur ve bunu **tipe** yansıtmak gerekir: `ucuncu_not` bir `Option` döndürsün.

```rust
fn ucuncu_not(liste: &[u32]) -> Option<u32> {
    // get(2): Option<&u32>; copied() içindeki değeri kopyalayıp Option<u32> yapar (Modül 9)
    liste.get(2).copied()
}

fn karne_yazdir(isim: &str, notlar: &[u32]) {
    match ucuncu_not(notlar) {
        Some(n) => println!("{isim}: 3. not {n}"),
        None => println!("{isim}: 3. not henüz girilmemiş"),
    }
}

fn main() {
    karne_yazdir("Elif", &[90, 75]);
    karne_yazdir("Can", &[60, 85, 70]);
}
```

## Kütüphanelerden gelen panikler

Kendi kodunda `panic!`'i nadiren elle yazarsın. Paniklerin çoğu, standart kütüphanedeki bir işlemin
**önkoşulunu** bozduğunda gelir. En sık karşılaşacakların ve panik atmayan kardeşleri:

| İşlem | Ne zaman panikler? | Panik mesajı | Panik atmayan kardeşi |
|---|---|---|---|
| `v[i]` | `i >= v.len()` | `index out of bounds: the len is 3 but the index is 5` | `v.get(i)` → `Option<&T>` |
| `a / b`, `a % b` | `b == 0` (tam sayılarda; taşmanın aksine **release'de de**) | `attempt to divide by zero` | `a.checked_div(b)` → `Option` |
| `a + b` | taşma (debug derlemede) | `attempt to add with overflow` | `checked_add`, `saturating_add`, `wrapping_add` |
| `&s[0..1]` | dilim bir karakterin ortasına denk gelirse | `end byte index 1 is not a char boundary; it is inside 'ş' (bytes 0..2 of string)` | `s.get(0..1)` → `Option<&str>` |
| `x.unwrap()` | `x` `None` ya da `Err` ise | ``called `Option::unwrap()` on a `None` value`` | `match`, `if let`, `unwrap_or` (sonraki ders) |

Panik std'nin içinde oluşsa bile mesajdaki konum **senin satırını** gösterir. Çünkü hata, işlemi hatalı
çağıran koddadır; std bu yüzden konumu kendi içinden değil, çağıranın satırından raporlar (`unwrap` gibi
fonksiyonlardaki `#[track_caller]` niteliği bunu sağlar).

```rust
fn main() {
    let notlar = [85, 92, 78];
    let sehir = String::from("Şanlıurfa");
    let kisi_sayisi: u32 = 0;
    let bakiye: u8 = 250;

    // Her satır, panik atabilecek bir işlemin Option döndüren kardeşi:
    println!("{:?}", notlar.get(10)); //                 notlar[10] yerine
    println!("{:?}", 120u32.checked_div(kisi_sayisi)); // 120 / kisi_sayisi yerine
    println!("{:?}", bakiye.checked_add(10)); //          bakiye + 10 yerine
    println!("{:?}", sehir.get(0..1)); //                 &sehir[0..1] yerine ('Ş' 2 bayt!)
    println!("{:?}", sehir.get(0..2)); //                 bu dilim geçerli
}
```

Şimdi Modül 2, 7 ve 9'dan bildiklerini birleştir:

```predict
code: |
  fn main() {
      let puanlar: Vec<u8> = vec![40, 175, 90];

      match puanlar.get(3) {
          Some(p) => println!("4. puan: {p}"),
          None => println!("4. puan yok"),
      }

      let toplam = puanlar[1].checked_add(puanlar[2]);
      println!("{toplam:?}");

      let tavan = puanlar[1].saturating_add(puanlar[2]);
      println!("{tavan}");
  }
options:
  - |
    4. puan yok
    None
    255
  - |
    4. puan: 0
    Some(265)
    265
  - |
    4. puan yok
    Some(9)
    9
  - |
    4. puan yok
    None
    9
answer: 0
explanation: |
  `get(3)` geçersiz dizinde panik atmaz, `None` döner. `175 + 90 = 265` bir `u8`'e (0-255) sığmaz:
  `checked_add` taşmayı `None` ile bildirir, `saturating_add` ise sonucu üst sınırda (255) "doyurur".
  `9` (265 - 256) değeri `wrapping_add`'in sonucu olurdu. Hiçbir satır panik atmadı - işte güvenli
  kardeşlerin gücü.
```

````exercise
id: m10-e-bonus-puan
title: Panik atmayan bonus hesabı
difficulty: 2
prompt: |
  Bir yarışma uygulamasında oyuncuların puanları `u8` olarak bir dilimde (`&[u8]`) tutuluyor.
  `bonuslu_puan(puanlar, sira, bonus)` fonksiyonu, `sira`'daki oyuncunun puanına `bonus` eklemeli.

  Bu fonksiyon **asla panik atmamalı**:
  - `sira` geçersizse (dilimin dışındaysa) `None` döndür,
  - toplam `u8`'e sığmıyorsa (255'i aşıyorsa) yine `None` döndür,
  - aksi halde `Some(toplam)` döndür.

  `puanlar[sira]` ve `+` yerine bu dersteki güvenli kardeşleri kullan.
starter: |
  fn bonuslu_puan(puanlar: &[u8], sira: usize, bonus: u8) -> Option<u8> {
      todo!()
  }

  fn main() {
      let puanlar = [120, 250, 30];
      println!("{:?}", bonuslu_puan(&puanlar, 0, 15)); // Some(135)
      println!("{:?}", bonuslu_puan(&puanlar, 1, 15)); // None (taşma)
      println!("{:?}", bonuslu_puan(&puanlar, 7, 15)); // None (geçersiz sıra)
  }
solution: |
  fn bonuslu_puan(puanlar: &[u8], sira: usize, bonus: u8) -> Option<u8> {
      let Some(puan) = puanlar.get(sira) else {
          return None;
      };
      puan.checked_add(bonus)
  }

  fn main() {
      let puanlar = [120, 250, 30];
      println!("{:?}", bonuslu_puan(&puanlar, 0, 15)); // Some(135)
      println!("{:?}", bonuslu_puan(&puanlar, 1, 15)); // None (taşma)
      println!("{:?}", bonuslu_puan(&puanlar, 7, 15)); // None (geçersiz sıra)
  }
check: tests
tests: |
  #[test]
  fn gecerli_sira_ve_sigan_toplam() {
      assert_eq!(bonuslu_puan(&[120, 250, 30], 0, 15), Some(135), "120 + 15 = 135 olmalı");
      assert_eq!(bonuslu_puan(&[120, 250, 30], 2, 5), Some(35), "30 + 5 = 35 olmalı");
  }

  #[test]
  fn tasma_none_dondurur() {
      assert_eq!(bonuslu_puan(&[120, 250, 30], 1, 15), None, "250 + 15 = 265, u8'e sığmaz: None olmalı");
  }

  #[test]
  fn sinirdaki_255_sigar() {
      assert_eq!(bonuslu_puan(&[250], 0, 5), Some(255), "250 + 5 = 255 tam sınırda, sığar");
  }

  #[test]
  fn gecersiz_sira_none_dondurur() {
      assert_eq!(bonuslu_puan(&[120, 250, 30], 3, 1), None, "3. sıra yok (dilimin uzunluğu 3)");
      assert_eq!(bonuslu_puan(&[], 0, 1), None, "boş dilimde hiçbir sıra geçerli değil");
  }
hints:
  - "Panik atabilecek iki işlem var: dizinleme (`puanlar[sira]`) ve toplama (`+`). İkisinin de `Option` döndüren bir kardeşi var."
  - "`puanlar.get(sira)` bir `Option<&u8>` döndürür. `match` ile ya da `let Some(puan) = puanlar.get(sira) else { return None; };` ile aç."
  - "`checked_add` zaten `Option<u8>` döndürür; `puan.checked_add(bonus)` ifadesini doğrudan fonksiyonun son ifadesi yapabilirsin."
forbid:
  - pattern: "puanlar\\s*\\["
    message: "`puanlar[...]` dizinlemesi geçersiz sırada panik atar, `get` kullan."
  - pattern: "\\.unwrap\\(|\\.expect\\("
    message: "Bu alıştırmada `unwrap`/`expect` yok: onlar da panik atabilir!"
explanation: |
  `get` ve `checked_add`, panik atan kardeşlerinin (`[]` ve `+`) yaptığı işi yapar, ama başarısızlığı programı
  durdurmak yerine bir **değer** olarak (`None`) bildirir. Böylece karar çağırana kalır.

  `let ... else` (Modül 7) ile `Some` değilse erken döndük. `puan` burada bir `&u8`; `puan.checked_add(bonus)`
  yazabildik, çünkü metot çağrısında Rust referansı kendiliğinden takip eder (Modül 5). Aynı fonksiyonu
  `match` ile de yazabilirdin:

  ```rust
  match puanlar.get(sira) {
      Some(puan) => puan.checked_add(bonus),
      None => None,
  }
  ```

  Bu "değer yoksa hemen `None` döndür" kalıbı o kadar yaygın ki Rust'ın onun için tek karakterlik bir operatörü
  var; Clippy (Modül 1) bu çözümü görünce zaten onu önerir. Dördüncü derste bu fonksiyonu tek satıra
  indireceğiz: `puanlar.get(sira)?.checked_add(bonus)`.
````

## Özet

:::remember
- `panic!` = **kurtarılamaz** hata: mesaj + konum yazılır, program (thread) durur, çıkış kodu **101**.
- Varsayılan davranış **unwinding**: stack geri sarılır, her çerçevedeki değerler `drop` edilir.
  `[profile.release]` altında `panic = "abort"` → anında sonlanma, temizlik yok.
- Çağrı zincirini görmek için `RUST_BACKTRACE=1`; kendi crate adınla başlayan ilk satırı bul.
- Paniklerin çoğu bozulmuş önkoşullardan gelir: `v[i]`, `/ 0`, taşma, `unwrap`. Güvenli kardeşleri
  (`get`, `checked_*`, `s.get(a..b)`) `Option` döndürür.
- Panik **programlama hataları (bug)** içindir; beklenen başarısızlıklar için `Result` (sonraki ders).
:::

```reflect
prompt: Kendi cümlelerinle açıkla, Rust, dizinin dışına erişildiğinde C gibi "ne varsa okuyup devam etmek" yerine neden programı durdurmayı seçer? Bu seçimin bedeli ve kazancı nedir?
answer: |
  Model cevap: Yanlış veriyle devam etmek durmaktan daha tehlikelidir. Dizinin dışındaki belleği okumak gizli
  bilgileri sızdırabilir (Heartbleed) ya da veriyi sessizce bozabilir; bu tür hatalar çoğu zaman çok sonra,
  kaynağından uzak bir yerde fark edilir. Panik hatayı **hemen ve kaynağına yakın** görünür kılar; mesaj ve
  backtrace sayesinde düzeltmek kolaylaşır. Bedeli küçüktür: her erişimde ucuz bir sınır denetimi (derleyici
  çoğu zaman bunu optimize eder) ve programın çökmesi. Ama çöken bir program fark edilir ve düzeltilir;
  sessizce yanlış çalışan bir program ise fark edilmeyebilir.
```

```flashcards
- front: Panikle biten bir Rust programı işletim sistemine hangi çıkış kodunu döndürür?
  back: "**101** (başarılı bitiş 0'dır)."
- front: Unwinding (geri sarma) nedir?
  back: Panikten sonra Rust'ın çağrı yığınında geriye doğru ilerleyip her çerçevedeki sahip olunan değerleri **drop** etmesi (temizlik).
- front: "`panic = \"abort\"` ayarı nereye yazılır ve neyi değiştirir?"
  back: "`Cargo.toml`'da `[profile.release]` altına; panikte unwinding yapılmaz, program temizlik yapmadan anında sonlanır (ikili dosya küçülür)."
- front: Panik anındaki çağrı zincirini görmek için hangi ortam değişkenini ayarlarsın?
  back: "`RUST_BACKTRACE=1` (daha fazla ayrıntı için `RUST_BACKTRACE=full`)."
- front: Backtrace'te paniğin kaynağını nasıl bulursun?
  back: "Std'nin iç satırlarını atlayıp **kendi crate adınla** başlayan ilk satırı bulursun; altındaki satırlar onu çağıranlardır."
- front: "`v[i]` yerine panik atmayan hangi metodu kullanırsın, ne döner?"
  back: "`v.get(i)` → `Option<&T>`; dizin geçersizse `None`."
- front: "`todo!()` makrosu ne yapar?"
  back: "Kodun derlenmesini sağlar; çalışırken o satıra gelinirse `not yet implemented` mesajıyla panikler."
- front: "`panic!` hangi tür hatalar için uygundur?"
  back: Programlama hataları (bug), bozulmuş sözleşmeler ve "imkânsız" durumlar için, beklenen başarısızlıklar için değil.
```
