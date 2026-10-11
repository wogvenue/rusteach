---
id: m01-l02
title: "Kurulum: rustup, rustc ve cargo"
minutes: 16
type: lesson
objectives:
  - rustup, rustc ve cargo araçlarının görevlerini birbirinden ayırt edebilmek
  - Rust'ı MSVC derleme araçlarıyla birlikte Windows'a kurup kurulumu doğrulayabilmek
  - rustup ile Rust'ı güncelleyebilmek ve belgeleri çevrimdışı açabilmek
  - VS Code'a rust-analyzer kurup Rusteach'te kodun nerede çalıştığını açıklayabilmek
keywords: [kurulum, rustup, rustc, cargo, MSVC, bağlayıcı, PATH, VS Code, rust-analyzer, Playground]
---

Bir marangozun iyi bir tezgâha, bir aşçının da düzenli bir mutfağa ihtiyacı vardır. Bu derste Rust
**atölyeni** kuruyoruz: Derleyiciyi bilgisayarına yükleyecek, çalıştığını doğrulayacak ve kod
yazmayı keyifli hâle getiren bir editör hazırlayacaksın.

İyi haber: Rusteach'teki kod blokları, Rust bilgisayarında kurulu olmasa bile çalışır (nasıl olduğunu
bu dersin sonunda göreceksin). Yani kurulumu şimdi yapamıyorsan derse devam edebilirsin. Yine de
gerçek projeler, dosya okuyan, kullanıcıdan girdi alan, internetten kütüphane indiren programlar,
için kendi kurulumun şart olacak.

## Araç kutun: rustup, rustc ve cargo

Rust'ı kurduğunda bilgisayarına tek bir program değil, birlikte çalışan bir **araç zinciri
(toolchain)** gelir. Bunların üçüyle sık sık karşılaşacaksın:

| Araç | Görevi | Örnek komut |
|---|---|---|
| `rustc` | **Derleyici.** Bir `.rs` dosyasını makine koduna çevirir. | `rustc main.rs` |
| `cargo` | **Proje ve paket yöneticisi.** Proje oluşturur, derler, çalıştırır, test eder, kütüphaneleri indirir. | `cargo run` |
| `rustup` | **Araç zinciri yöneticisi.** `rustc` ve `cargo`'yu kurar, günceller, sürümler arasında geçiş yapar. | `rustup update` |

Günlük hayatta en çok `cargo` ile konuşacaksın; o da perde arkasında `rustc`'yi çağırır. `rustup`'ı
ise genellikle yalnızca güncelleme yaparken kullanırsın. Araç zincirinde bunların yanında standart
kütüphane (`rust-std`), çevrimdışı belgeler (`rust-docs`), kod biçimlendirici `rustfmt` ve kod
denetleyicisi `clippy` de bulunur (son ikisini 7. derste kullanacağız).

:::analogy Rust mutfağı
- **`rustc` fırındır:** Çiğ hamuru (kaynak kodu) pişmiş ürüne (makine kodu) dönüştürür.
- **`cargo` aşçıbaşıdır:** Tarifleri düzenler, eksik malzemeleri (kütüphaneleri) tedarik eder ve
  fırını doğru ayarlarla çalıştırır. Sen aşçıbaşıyla konuşursun, fırına o dokunur.
- **`rustup` mutfağı kuran ustadır:** Fırını yerleştirir, yenisi çıkınca değiştirir, gerekirse
  ikinci bir fırın (başka bir sürüm) kurar.
:::

Rust **üç kanal** halinde yayımlanır:

- **stable (kararlı):** Her **6 haftada bir** çıkar. Bu kursta hep bunu kullanacağız.
- **beta:** Bir sonraki kararlı sürümün adayıdır; 6 hafta boyunca test edilir.
- **nightly:** Her gece otomatik derlenir; henüz kararlı olmayan, deneysel özellikleri içerir.

Bu düzene **tren modeli** denir: Trenler tarifeye göre kalkar. Hazır olan özellikler trene biner,
hazır olmayanlar bir sonraki trene kalır. Böylece kimse bir özelliği acele ettirmek zorunda kalmaz.

```quiz
question: |
  Aşağıdaki işlerden hangisi **rustup**'ın görevidir?
options:
  - "`.rs` uzantılı bir dosyayı makine koduna çevirmek"
  - Rust'ı yeni sürüme güncellemek ve araç zincirlerini yönetmek
  - Yeni bir Rust projesi oluşturup çalıştırmak
  - Rust kodunu satır satır yorumlayarak çalıştırmak
answer: 1
explanation: |
  `rustup` araç zincirinin **yöneticisidir**: Rust'ı kurar, `rustup update` ile günceller ve gerekirse
  farklı sürümler (stable, beta, nightly) arasında geçiş yapar. Kodu derleyen `rustc`, projeyi
  oluşturup çalıştıran ise `cargo`'dur.
feedback:
  - Bu, derleyicinin (`rustc`) işidir.
  - Doğru!
  - Bu, `cargo`'nun işidir, `cargo new` ve `cargo run` ile 4. derste yapacaksın.
  - Rust yorumlanan bir dil değildir; kod önce derlenir.
```

## Windows'a adım adım kurulum

Kurulum sırasında rustup senden **Visual Studio'nun C++ derleme araçlarını** kurmanı isteyecek. "Ben
C++ değil Rust öğreniyorum!" diyebilirsin; önce nedenini anlayalım.

Derleyici kodunu makine koduna çevirir ama ortaya çıkan parçalar tek başına çalışmaz. Senin kodun,
Rust'ın standart kütüphanesine ve Windows'un kendi kütüphanelerine (ekrana yazmak, dosya açmak gibi
işler için) ihtiyaç duyar. Bütün bu parçaları birleştirip tek bir `.exe` dosyası üreten programa
**bağlayıcı (linker)** denir. Rust, Windows'ta Microsoft'un bağlayıcısı **`link.exe`**'yi ve Windows
kütüphanelerini kullanır; bunlar da Visual Studio'nun C++ derleme araçlarıyla (**MSVC**) gelir.

:::analogy Cilt ustası
Derleyiciyi kitabın bölümlerini ayrı ayrı basan matbaa, bağlayıcıyı da bu bölümleri, hazır gelen
sözlük ve dizin sayfalarıyla birlikte, tek bir kitap olarak ciltleyen usta gibi düşün. Rust kendi
matbaasını getirir ama Windows'ta ciltleme işini Microsoft'un ustasına bırakır.
:::

**1. rustup-init.exe'yi indir.** Tarayıcıda **https://rustup.rs** adresini aç ve 64-bit Windows için
sunulan **`rustup-init.exe`** dosyasını indir. (Windows'un paket yöneticisi `winget`'i
kullanıyorsan aşağıdaki komut da aynı işi görür.)

```powershell
winget install Rustlang.Rustup
```

**2. Çalıştır ve C++ araçlarını kurdur.** `rustup-init.exe`'ye çift tıkla. Bilgisayarında C++
derleme araçları yoksa şu ekranı görürsün:

```text
Rust Visual C++ prerequisites

Rust requires a linker and Windows API libraries but they don't seem to be available.

These components can be acquired through a Visual Studio installer.

1) Quick install via the Visual Studio Community installer
   (free for individuals, academic uses, and open source).

2) Manually install the prerequisites
   (for enterprise and advanced users).

3) Don't install the prerequisites
   (if you're targeting the GNU ABI).

>
```

**1** yazıp Enter'a bas. rustup, **Visual Studio Yükleyicisi**'ni (*Visual Studio Installer*)
indirip gerekli bileşenler, MSVC derleme araçları ve Windows SDK, seçili olarak açar. Kurulumu
onayla ve bitmesini bekle; birkaç GB indirileceği için biraz sürebilir. Visual Studio Community
bireyler, öğrenciler ve açık kaynak projeler için ücretsizdir.

:::tip Elle kurmak istersen (seçenek 2)
Microsoft'un sitesinden **Build Tools for Visual Studio**'yu indir. Yükleyicide **"Desktop
development with C++"** iş yükünü (Türkçe arayüzde **"C++ ile masaüstü geliştirme"**) seç. Sağdaki
ayrıntılarda **MSVC ... C++ x64/x86 derleme araçları** ve **Windows 11 SDK** işaretli olmalı,
varsayılan olarak öyledirler. Kurulum bitince `rustup-init.exe`'yi yeniden çalıştır.
:::

**3. Varsayılan kurulumla devam et.** C++ araçları hazır olunca rustup kurulum seçeneklerini gösterir:

```text
Current installation options:


   default host triple: x86_64-pc-windows-msvc
     default toolchain: stable (default)
               profile: default
  modify PATH variable: yes

1) Proceed with standard installation (default - just press enter)
2) Customize installation
3) Cancel installation
>
```

Satırları tek tek okuyalım:

- **default host triple**, kodun hangi platform için derleneceği: `x86_64` (işlemci mimarisi),
  `pc` (üretici), `windows` (işletim sistemi), `msvc` (Microsoft araç zinciri).
- **default toolchain: stable**, kararlı kanal.
- **profile: default**, `rustc`, `cargo`, standart kütüphane, belgeler, `rustfmt` ve `clippy`.
- **modify PATH variable: yes**, komutların her terminalde tanınması için gereken ayar (birazdan).

Hiçbir şeyi değiştirmene gerek yok: **Enter**'a bas. Bileşenler indirilir ve kurulum şu mesajla biter:

```text
Rust is installed now. Great!

To get started you may need to restart your current shell.
```

Araç zincirleri `%USERPROFILE%\.rustup` klasörüne, `rustc.exe`, `cargo.exe` ve `rustup.exe` gibi
komutlar ise `%USERPROFILE%\.cargo\bin` klasörüne kurulur. (`%USERPROFILE%` senin kullanıcı
klasörün, örneğin `C:\Users\Ayse`.)

| Hedef | Bağlayıcı | Gerekenler | Ne zaman? |
|---|---|---|---|
| `x86_64-pc-windows-msvc` | Microsoft `link.exe` | Visual Studio C++ derleme araçları | **Varsayılan ve önerilen**; Windows kütüphaneleriyle en uyumlusu |
| `x86_64-pc-windows-gnu` | MinGW-w64 (GCC) | MinGW araçları | Özel durumlar, ör. MinGW ile derlenmiş C kütüphaneleri |

:::warning VS Code, Visual Studio değildir!
İsimleri benzese de **Visual Studio Code** (birazdan kuracağımız hafif kod editörü) ile **Visual
Studio** (C++ derleme araçlarını getiren büyük geliştirme ortamı) farklı ürünlerdir. VS Code'u kurmak
bağlayıcıyı getirmez.
:::

:::error
C++ araçları olmadan bir program derlemeye çalışırsan şuna benzer bir hata alırsın:
```text
error: linker `link.exe` not found
  |
  = note: program not found

note: the msvc targets depend on the msvc linker but `link.exe` was not found

note: please ensure that Visual Studio 2017 or later, or Build Tools for Visual Studio were installed with the Visual C++ option.

note: VS Code is a different product, and is not sufficient.
```
Derleyici sorunu açıkça söylüyor: Bağlayıcı (`link.exe`) bulunamadı. Çözüm, yukarıdaki gibi
Visual Studio'nun C++ derleme araçlarını kurmaktır. Son nota dikkat: VS Code yeterli değildir!
:::

```quiz
question: |
  Rust neden Windows'ta Visual Studio'nun C++ derleme araçlarına (MSVC) ihtiyaç duyar?
options:
  - Rust kodu önce C++'a çevrilip öyle derlendiği için
  - Derlenen parçaları Windows kütüphaneleriyle birleştirip `.exe` üreten bağlayıcı (link.exe) ve Windows kütüphaneleri için
  - Rust kodunu yazmak için Visual Studio editörü zorunlu olduğu için
  - Rust programları yalnızca Visual Studio'nun içinde çalışabildiği için
answer: 1
explanation: |
  Rust'ın derleyicisi kendi işini kendisi yapar; ama Windows'ta son adımı - derlenmiş parçaları ve
  Windows kütüphanelerini birleştirip çalıştırılabilir bir dosya üretmeyi - Microsoft'un bağlayıcısı
  **`link.exe`** yapar. Bağlayıcı ve gerekli kütüphaneler C++ derleme araçlarıyla gelir.
feedback:
  - Hayır; Rust kodu C++'a çevrilmez. `rustc` kodu (LLVM yardımıyla) doğrudan makine koduna çevirir.
  - Doğru!
  - Rust kodunu istediğin editörde yazabilirsin; bu derste VS Code'u kuracağız.
  - Hayır; ortaya çıkan `.exe` her yerde tek başına çalışır.
```

## Kurulumu doğrula

Kurulum bittikten sonra **yeni** bir terminal aç (Başlat menüsünde "PowerShell" ya da "Terminal" yaz)
ve şu komutları dene:

```console
PS C:\Users\Ayse> rustc --version
rustc 1.99.0 (b940084d7 2026-09-28)
PS C:\Users\Ayse> cargo --version
cargo 1.99.0 (5f94df478 2026-08-27)
```

İki komut da bir sürüm satırı yazdıysa tebrikler, Rust bilgisayarında! Sürüm satırını okuyalım:

- **`1.99.0`**, *ana.ara.yama* sürüm numarası. Rust 2015'teki 1.0'dan beri `1.x` serisinde ve her
  6 haftada bir ara numara bir artar. Sen bunu okurken numara büyük ihtimalle daha büyük olacak;
  sorun değil.
- **`b940084d7`**, derleyicinin kaynak kodundaki sürümün kimliği (*commit hash*) ilk karakterleri.
- **`2026-09-28`**, o kaynak kodun tarihi.

:::warning "'rustc' tanınmıyor" hatası
Şöyle bir hata görürsen paniğe kapılma:
```text
rustc : The term 'rustc' is not recognized as the name of a cmdlet, function, script file, or operable program.
```
(Türkçe Windows'ta mesaj "... olarak tanınmıyor" şeklinde biter.) Bu, terminalin `rustc`'yi
bulamadığı anlamına gelir. Windows komutları **PATH** adlı bir klasör listesinde arar; rustup
`%USERPROFILE%\.cargo\bin` klasörünü bu listeye ekler, ama **önceden açık olan terminaller** bu
değişikliği görmez. Sırayla şunları dene:
1. Terminali (ve VS Code'u) tamamen kapatıp yeniden aç.
2. Olmadıysa oturumu kapatıp aç ya da bilgisayarı yeniden başlat.
3. Hâlâ olmuyorsa `rustup-init.exe`'yi yeniden çalıştır.
:::

Şimdi aşağıdaki programı **Çalıştır**. Rust bilgisayarında kuruluysa Rusteach onu doğrudan senin
derleyicinle çalıştırır:

```rust
fn main() {
    println!("Rust kurulumu tamam! 🦀");
    println!("Derleyici, bağlayıcı ve cargo görev başında.");
}
```

```parsons
prompt: |
  Rust'ı Windows'a kurma adımlarını doğru sıraya diz. Dikkat: Aralarında **yanlış** bir adım var;
  onu dışarıda bırak.
lines: |
  rustup.rs adresinden rustup-init.exe dosyasını indir
  rustup-init.exe dosyasını çalıştır
  Visual Studio C++ derleme araçlarını kur (seçenek 1)
  Varsayılan kurulumu Enter ile onayla
  Açık terminali kapatıp yeni bir terminal aç
  rustc --version ve cargo --version ile doğrula
distractors: |
  C++ araçları yerine VS Code'u kur
verify: false
explanation: |
  Önce kurulum programı indirilip çalıştırılır. C++ araçları eksikse rustup onları **kurulumdan
  önce** ister. Ardından varsayılan seçeneklerle kurulum tamamlanır. PATH değişikliğini görmek için
  **yeni** bir terminal açılır ve iki sürüm komutuyla kurulum doğrulanır. VS Code bir editördür;
  bağlayıcıyı getirmez.
```

```quiz
question: |
  Kurulum bitti. Kurulumdan önce açtığın PowerShell penceresinde `rustc --version` yazdın ve
  *"'rustc' tanınmıyor"* hatası aldın. En olası neden ve çözüm nedir?
options:
  - Rust bozuk kuruldu; Windows'u yeniden kurmak gerekir.
  - Terminal, PATH güncellenmeden önce açılmıştı; terminali kapatıp yeni bir tane açmalısın.
  - "`rustc` yalnızca VS Code'un içinden çalıştırılabilir."
  - Komutu büyük harfle (`RUSTC --VERSION`) yazman gerekir.
answer: 1
explanation: |
  Komutların bulunduğu `%USERPROFILE%\.cargo\bin` klasörü PATH'e kurulum sırasında eklendi; ama açık
  olan terminaller ortam değişkenlerini **açıldıkları anda** okur. Yeni bir terminal açmak genellikle
  sorunu çözer.
feedback:
  - Çok büyük bir çözüm! Sorun neredeyse her zaman PATH'tir.
  - Doğru!
  - "`rustc` her terminalde çalışır, yeter ki PATH doğru olsun."
  - Windows'ta komut adlarında büyük-küçük harf fark etmez; sorun bu değil.
```

## rustup ile araçlarını güncel tut

Rust her 6 haftada bir yeni özellikler ve hata düzeltmeleri getirir. Kurulumunu yönetmek için şu
komutları bilmen yeterli:

```powershell
rustup update                       # Rust'ı en yeni kararlı sürüme güncelle
rustup show                         # kurulu araç zincirlerini ve etkin sürümü göster
rustup component list --installed   # kurulu bileşenleri listele
rustup doc                          # tüm belgeleri tarayıcıda, çevrimdışı aç
rustup doc --book                   # resmî Rust kitabını aç
rustup doc --std                    # standart kütüphane belgelerini aç
rustup self uninstall               # Rust'ı tamamen kaldır (dikkat!)
```

(`#` işaretinden sonraki kısımlar PowerShell'de açıklamadır; komutları yazarken onları yazmana gerek
yok.)

**Güncellemekten korkma.** Rust'ın **kararlılık sözü** var: Rust 1.x'in bir sürümünde derlenen kod,
sonraki 1.x sürümlerinde de derlenmeye devam eder. Dili köklü biçimde değiştiren yenilikler ise
**edisyonlarla** (*editions*: 2015, 2018, 2021, 2024) gelir ve her proje hangi edisyonu kullanacağını
kendisi seçer. Bu kurs en yeni edisyon olan **2024**'ü kullanıyor; edisyonun nereye yazıldığını 4.
derste göreceksin.

:::tip Belgeler cebinde
`rustup doc --book`, Rust ekibinin resmî ve ücretsiz kitabı **"The Rust Programming Language"**'i
(topluluk arasındaki adıyla *"The Book"*) internet olmadan açar. `rustup doc --std` ise standart
kütüphanedeki her şeyin açıklamasını ve örneklerini içerir. İngilizceleri yeterliyse Rusteach'te
öğrendiklerini bu kaynaklarla pekiştirebilirsin.
:::

```quiz
question: |
  Uçakta, internetin yokken Rust'ın resmî kitabını okumak istiyorsun. Hangi komutu kullanırsın?
options:
  - "`rustup update`"
  - "`rustup doc --book`"
  - "`cargo --version`"
  - "`rustc --book`"
answer: 1
explanation: |
  `rustup doc --book`, kurulumla birlikte bilgisayarına inen belgelerden resmî kitabı tarayıcında
  açar - internet gerekmez.
feedback:
  - Bu komut Rust'ı günceller; üstelik internet ister.
  - Doğru!
  - Bu komut yalnızca cargo'nun sürümünü yazar.
  - "`rustc`'nin böyle bir seçeneği yok; belgeleri `rustup` yönetir."
```

Şimdi bu komutları hafızana kazıyalım. Bir sonraki alıştırmada kendi **kopya kâğıdını** yazdıran bir
program yazacaksın.

````exercise
id: m01-e-kurulum-kopya
title: Kurulum kopya kâğıdı
difficulty: 1
prompt: |
  Aşağıdaki program dört kez `...` yazdırıyor. Her `...` yerine, üstündeki açıklamanın tarif ettiği
  komutu yaz. Program tam olarak şunu yazdırmalı:

  ```text
  rustc --version
  cargo --version
  rustup update
  rustup doc --book
  ```

  `//` ile başlayan satırlar **yorumdur**: Bilgisayar onları yok sayar, insanlara not bırakmak için
  kullanılır (5. derste ayrıntılı göreceğiz). Önce yukarıya bakmadan hatırlamaya çalış!
starter: |
  fn main() {
      // 1) Derleyicinin sürümünü gösteren komut
      println!("...");
      // 2) Cargo'nun sürümünü gösteren komut
      println!("...");
      // 3) Rust'ı en yeni sürüme güncelleyen komut
      println!("...");
      // 4) Rust kitabını çevrimdışı açan komut
      println!("...");
  }
solution: |
  fn main() {
      // 1) Derleyicinin sürümünü gösteren komut
      println!("rustc --version");
      // 2) Cargo'nun sürümünü gösteren komut
      println!("cargo --version");
      // 3) Rust'ı en yeni sürüme güncelleyen komut
      println!("rustup update");
      // 4) Rust kitabını çevrimdışı açan komut
      println!("rustup doc --book");
  }
check: output
expected_output: |
  rustc --version
  cargo --version
  rustup update
  rustup doc --book
hints:
  - |
    İlk iki komut aynı kalıbı izler: aracın adı, bir boşluk ve iki tire ile başlayan `--version`.
  - |
    Güncelleme ve belge işleri araç zincirinin yöneticisine, yani `rustup`'a aittir. Belgeler için
    kullanılan alt komut `doc`'tur.
  - |
    Üçüncü satır `println!("rustup update");`, dördüncü satır ise `println!("rustup doc --book");`
    olmalı.
explanation: |
  Sürüm komutları (`rustc --version`, `cargo --version`) kurulumun çalıştığını doğrulamanın en hızlı
  yoludur. Güncelleme ve belgeler ise `rustup`'ın işidir: `rustup update` en yeni kararlı sürümü
  kurar, `rustup doc --book` resmî kitabı çevrimdışı açar.

  Bu alıştırmada bilgiyi hafızandan **geri çağırdın** - sadece okumaktan çok daha kalıcı bir öğrenme.
  Yorum satırlarının programın çıktısını hiç etkilemediğine de dikkat et.
````

## Editörün: VS Code ve rust-analyzer

Kod yazmak için Not Defteri bile yeter, ama iyi bir editör işini çok kolaylaştırır. En yaygın seçim
ücretsiz **Visual Studio Code** ve onun Rust eklentisi **rust-analyzer**'dır.

1. **https://code.visualstudio.com** adresinden VS Code'u indirip kur.
2. VS Code'da **Eklentiler** panelini aç (`Ctrl+Shift+X`).
3. **rust-analyzer** ara ve yayıncısı *The Rust Programming Language* olanı kur.

:::warning Eski eklentiye dikkat
Mağazada adı yalnızca **"Rust"** olan eski bir eklenti de görebilirsin. O artık geliştirilmiyor;
yerini rust-analyzer aldı. İkisini birlikte kurma.
:::

rust-analyzer sana neler kazandırır?

- **Anında hata gösterimi:** Hatalı kodun altı, sen daha kaydetmeden kırmızıyla çizilir.
- **Otomatik tamamlama:** `pri` yazınca `println!`'i önerir.
- **Tip ipuçları:** Kodun yanına, derleyicinin çıkardığı tipleri soluk yazıyla ekler.
- **Üzerine gelince belge:** Bir fonksiyonun üzerine geldiğinde açıklamasını gösterir.
- **Tanıma git:** `F12` ile bir şeyin tanımlandığı yere atlarsın, standart kütüphanenin içine bile.
- **Çalıştır düğmesi:** `fn main()` satırının üstünde **▶ Run** bağlantısı belirir.

Kaydederken kodu otomatik biçimlendirmek ve daha ayrıntılı denetim (`clippy`, 7. derste) için VS
Code'un ayar dosyasına (`Ctrl+Shift+P` → *Preferences: Open User Settings (JSON)*) şunları
ekleyebilirsin:

```json
{
  "editor.formatOnSave": true,
  "rust-analyzer.check.command": "clippy"
}
```

VS Code tek seçenek değil: JetBrains'in **RustRover**'ı (ticari olmayan kullanım için ücretsiz),
**Zed**, **Helix** ve **Neovim** de Rust'ı çok iyi destekler.

İşte VS Code'da işini hızlandıracak kısayollar, bu küçük programı çalıştırıp çıktısını bir kenara
not edebilirsin:

```rust
fn main() {
    println!("Ctrl+Shift+X  -> Eklentiler paneli");
    println!("Ctrl+`        -> Terminali aç/kapat");
    println!("Ctrl+Space    -> Tamamlama önerilerini göster");
    println!("Ctrl+.        -> Hızlı düzeltme önerileri");
    println!("F12           -> Tanıma git");
    println!("Shift+Alt+F   -> Dosyayı biçimlendir");
}
```

```quiz
question: |
  rust-analyzer eklentisi sana hangilerini sağlar? (Birden fazla seçenek işaretleyebilirsin.)
options:
  - Kod yazarken hataların altını anında çizmek
  - Otomatik tamamlama ve tip ipuçları
  - Bilgisayarına Rust derleyicisini kurmak
  - Programlarının daha hızlı çalışmasını sağlamak
answer: [0, 1]
explanation: |
  rust-analyzer bir **dil sunucusudur**: Kodunu sen yazarken analiz eder; hataları, tamamlama
  önerilerini ve tip ipuçlarını editöre taşır. Rust'ı kurmak `rustup`'ın, programını hızlı hâle
  getirmek ise derleyicinin işidir.
feedback:
  - Doğru, hataları derlemeyi beklemeden görürsün.
  - Doğru, yazarken büyük kolaylık sağlar.
  - Hayır; rust-analyzer bilgisayarında kurulu Rust'ı kullanır, onu kurmaz.
  - Hayır; editör eklentileri programının çalışma hızını etkilemez.
```

## Rusteach'te kodun nerede çalışır?

Rusteach'teki bir kod bloğunda **Çalıştır**'a bastığında kodun iki yoldan birinde derlenip çalışır:

- **Yerel:** Bilgisayarında Rust kuruluysa Rusteach senin `rustc` ve `cargo`'nu kullanır. İnternet
  gerekmez, genellikle daha hızlıdır ve kodun bilgisayarından çıkmaz.
- **Çevrimiçi:** Rust kurulu değilse kodun internet üzerinden Rust ekibinin resmî **Rust
  Playground** hizmetine (`play.rust-lang.org`) gönderilir, orada derlenip çalıştırılır ve sonuç
  sana döner.

Hangisinin kullanılacağını **Ayarlar > Kod çalıştırıcı** bölümünden seçersin: **Otomatik**
(varsayılan; Rust kuruluysa yerel, değilse çevrimiçi), **Yerel** ya da **Çevrimiçi**. Üst çubuktaki
küçük rozet de kodunun şu an nerede çalıştığını gösterir.

:::tip Rust'ı kurduktan sonra
Rusteach açıkken Rust'ı kurduysan uygulamayı kapatıp yeniden aç. Tıpkı terminallerde olduğu gibi,
açık olan programlar yeni PATH'i göremez.
:::

Aşağıdaki program, çalıştığı işletim sistemini ve işlemci mimarisini yazdırır. Kod bilgisayarında
çalışırsa `windows`, Playground'da çalışırsa `linux` görürsün, çünkü Playground'un sunucuları Linux
kullanır. (`{}` bir **yer tutucudur**: Virgülden sonraki değer onun yerine yazılır. 5. derste
ayrıntılı göreceğiz.)

```rust
fn main() {
    println!("Bu kod şu işletim sisteminde çalıştı: {}", std::env::consts::OS);
    println!("İşlemci mimarisi: {}", std::env::consts::ARCH);
}
```

Çevrimiçi çalıştırmanın bazı sınırları var: Kodun Rust ekibinin sunucularına gönderildiği için
içine şifre gibi gizli bilgiler yazma. Programlar kısa bir süre sınırı içinde bitmeli; dosyalara ve
internete erişemez, klavyeden girdi okuyamaz. Kütüphane olarak yalnızca en popüler crate'ler (yaklaşık
100 tane ve onların bağımlılıkları) kullanılabilir. Uygulamadaki örnekler bu sınırlara göre
hazırlandı. Girdi okuyan ya da dosyalarla çalışan gerçek programları ise ilerleyen modüllerde kendi
bilgisayarında `cargo run` ile çalıştıracaksın.

:::ferris
Aklına bir şey takıldığında **Oyun Alanı** sayfasına geç: Orada istediğin Rust kodunu yazıp
çalıştırabilirsin. Merak et, dene, boz, düzelt, en iyi öğrenme böyle olur! 🦀
:::

```quiz
question: |
  Bilgisayarında Rust kurulu değil ve internet bağlantın da kesik. Rusteach'te bir kod bloğunda
  **Çalıştır**'a basarsan ne olur?
options:
  - Kod yine çalışır; Rusteach'in içinde gizli bir derleyici vardır.
  - Kod çalıştırılamaz; ya Rust'ı kurmalı ya da internete bağlanmalısın.
  - Kod Python'a çevrilip çalıştırılır.
  - Kod çalışır ama sonuç internet gelince görünür.
answer: 1
explanation: |
  Rusteach kodu ya **bilgisayarındaki Rust** ile ya da internet üzerinden **Rust Playground**'da
  çalıştırır. İkisi de yoksa kodu derleyecek bir şey yoktur. Rust'ı kurmanın bir avantajı da budur:
  İnternet olmadan da çalışabilirsin.
feedback:
  - Rusteach kendi içinde bir derleyici taşımaz.
  - Doğru!
  - Rust kodu başka bir dile çevrilerek çalıştırılmaz.
  - Kod bir kuyruğa alınmaz; çalıştırma anında bir derleyici gerekir.
```

## Özet

:::remember
- **`rustc`** derleyicidir; **`cargo`** proje ve paket yöneticisidir; **`rustup`** araç zincirini
  kurar ve günceller.
- Windows'ta Rust, **MSVC** bağlayıcısına (`link.exe`) ihtiyaç duyar: Visual Studio'nun C++ derleme
  araçlarını kur (rustup'ta seçenek 1 ya da "Desktop development with C++"). **VS Code bunun yerini
  tutmaz.**
- Kurulumu **yeni bir terminalde** `rustc --version` ve `cargo --version` ile doğrula.
- "Tanınmıyor" hatası genellikle PATH'tir: Terminali kapatıp yeniden aç.
- `rustup update` günceller, `rustup doc --book` resmî kitabı çevrimdışı açar.
- Editör olarak **VS Code + rust-analyzer** kullan.
- Rusteach kodunu Rust kuruluysa **yerelde**, değilse **Rust Playground**'da çalıştırır.
:::

```reflect
prompt: |
  Bir arkadaşın Rust'ı kurmaya çalışıyor ama `cargo --version` yazınca hata alıyor. Ona hangi
  sorularla ve hangi sırayla yardım edersin?
answer: |
  Model cevap: Önce tam hata mesajını sorarım. "Tanınmıyor" diyorsa kurulumdan sonra **yeni** bir
  terminal açıp açmadığını kontrol ederiz; olmazsa oturumu kapatıp açmasını ya da `rustup-init.exe`'yi
  yeniden çalıştırmasını öneririm. Kurulum hiç tamamlanmadıysa Visual Studio C++ derleme araçlarının
  kurulu olup olmadığına bakarız - ve VS Code'un bunun yerini tutmadığını hatırlatırım. Sorunu
  sistemli biçimde, en olası ve en kolay çözümden başlayarak daraltmak en hızlı yoldur.
```

```flashcards
- front: "`rustc` nedir?"
  back: Rust derleyicisi. Bir `.rs` dosyasını makine koduna çevirir.
- front: "`cargo` nedir?"
  back: Rust'ın proje ve paket yöneticisi. Proje oluşturur, derler, çalıştırır, test eder ve kütüphaneleri indirir.
- front: "`rustup` nedir?"
  back: "Araç zinciri yöneticisi: `rustc` ve `cargo`'yu kurar, günceller (`rustup update`) ve sürümler arasında geçiş yapar."
- front: Rust, Windows'ta neden Visual Studio'nun C++ derleme araçlarına ihtiyaç duyar?
  back: Derlenen parçaları Windows kütüphaneleriyle birleştirip `.exe` üreten MSVC bağlayıcısı (`link.exe`) ve Windows kütüphaneleri için. VS Code bunun yerini tutmaz.
- front: Rust kurulumunu nasıl doğrularsın?
  back: Yeni bir terminalde `rustc --version` ve `cargo --version` komutlarıyla.
- front: Kurulumdan sonra "'rustc' tanınmıyor" hatası alırsan ilk ne yaparsın?
  back: Terminali kapatıp yeni bir tane açarım. Açık terminaller güncellenen PATH'i görmez.
- front: Rust'ın resmî kitabını çevrimdışı nasıl açarsın?
  back: "`rustup doc --book`"
- front: Rusteach'te Rust kurulu değilse kod nerede çalışır?
  back: İnternet üzerinden Rust Playground'da (`play.rust-lang.org`). Rust kuruluysa bilgisayarında yerel olarak çalışır.
```
