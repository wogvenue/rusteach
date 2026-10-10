---
id: m25-boss
title: "Boss: Hızlı ve İdiomatik Rust"
minutes: 45
type: boss
objectives:
  - Ölçme, tahsis azaltma, API tasarımı, hata yönetimi ve kod kalitesi araçlarını karışık sorularla uygulayabilmek
  - "`Cow`, `impl Into<String>`, thiserror/anyhow ve typestate içeren kodların çıktısını ve derlenip derlenmeyeceğini öngörebilmek"
  - Tahsis bilinçli, tipli hatalar döndüren ve derleme zamanı güvenceli API'leri sıfırdan yazabilmek
keywords: [boss, benchmark, black_box, with_capacity, Cow, API Guidelines, Into, must_use, thiserror, anyhow, clippy, typestate, sealed trait]
---

Uzman Zirvesi'nin son yamaçlarındasın! Bu sınav, kodun yalnızca **çalışmasını** değil; hızlı, okunaklı ve
kullanması keyifli olmasını da sağlayabildiğini gösterecek. Sorular karışık geliyor, aralarda önceki
modüllerden (ödünç alma, `Rc`, hata yönetimi) sorular da var. Geçmek için **%80** gerekiyor.

Her soruda kendine üç şey sor: *"Bu bir tahsis yapıyor mu?"*, *"Bu imza çağırana ne vaat ediyor?"* ve
*"Bu hatayı kim, nasıl kullanacak?"*

## Ölçüm ve bellek

```quiz
question: |
  Bir arkadaşın indeksli bir `for` döngüsünü iterator zinciriyle değiştirmiş. `cargo run` ile, `Instant`
  kullanarak tek bir çalıştırmada ölçmüş ve yeni sürümün **3 kat yavaş** olduğunu söylüyor. İlk ne
  yapılmalı?
options:
  - Iterator'lar yavaştır; indeksli döngüye geri dönülmeli
  - "`--release` ile derleyip girdiyi/çıktıyı `black_box`'tan geçirerek, ısınma ve çok tekrarla yeniden ölçmek (ciddi karşılaştırma için criterion)"
  - "Bütün fonksiyonlara `#[inline(always)]` eklemek"
  - "Sınır kontrollerini kaldırmak için `unsafe` ve `get_unchecked` kullanmak"
answer: 1
explanation: |
  `cargo run` **debug** profilinde derler: inlining yok, taşma kontrolleri var, closure'lar gerçek
  çağrı olarak kalır. Iterator zincirleri release'te genelde indeksli döngüyle aynı makine koduna
  dönüşür (sıfır maliyetli soyutlama). Ayrıca tek bir ölçüm gürültüye açıktır; `black_box` olmadan
  derleyici işi tamamen silebilir. Önce **doğru ölç**, sonra karar ver.
feedback:
  - Debug ölçümüne dayanan bir karar; release'te fark büyük ihtimalle kaybolur.
  - Doğru! Önce ölçümün kendisini düzelt.
  - Ölçmeden serpiştirilen `inline(always)` kod şişkinliğiyle işleri yavaşlatabilir de.
  - "`unsafe`, ölçülmemiş bir sorun için en son başvurulacak araçtır, ilk değil."
```

```quiz
question: |
  Bir rapor programı toplam **100 saniye** sürüyor; profilci bunun **20 saniyesinin** CSV ayrıştırmada
  geçtiğini gösteriyor. Ayrıştırmayı **10 kat** hızlandırırsan program toplam yaklaşık kaç saniye sürer?
options:
  - "10 saniye"
  - "82 saniye"
  - "50 saniye"
  - "98 saniye"
answer: 1
explanation: |
  Amdahl yasası: yalnızca ayrıştırma hızlanır. 80 saniye aynı kalır, 20 saniye 2 saniyeye iner:
  80 + 2 = **82 saniye**. Ayrıştırmayı sonsuz hızlandırsan bile 80 saniyenin altına inemezsin. Bu
  yüzden önce profilciyle **en büyük payı** bulmak gerekir.
feedback:
  - Bu, programın tamamı 10 kat hızlansaydı geçerli olurdu.
  - Doğru! 80 s (değişmeyen kısım) + 20/10 s = 82 s.
  - Kazanç, optimize edilen kısmın toplamdaki payıyla sınırlıdır.
  - 20 saniyenin 2 saniyeye inmesi 18 saniye kazandırır, 2 değil.
```

```predict
code: |
  fn main() {
      let mut v: Vec<u32> = Vec::with_capacity(10);
      v.extend([3, 1, 2]);
      let kap = v.capacity();
      v.clear();
      println!("{} {}", v.len(), v.capacity() == kap);

      let s = String::with_capacity(16);
      println!("{s:?} {}", s.capacity() >= 16);
  }
options:
  - |
    0 true
    "" true
  - |
    0 false
    "" true
  - |
    3 true
    "                " true
  - |
    0 true
    "" false
answer: 0
explanation: |
  `clear()` uzunluğu 0 yapar ama heap bloğunu **korur**; bu yüzden kapasite değişmez. Tampon yeniden
  kullanımı tam olarak buna dayanır. `String::with_capacity(16)` yalnızca **yer ayırır**: içerik boş
  (`""`), kapasite en az 16. Kapasite ≠ uzunluk.
```

```predict
code: |
  use std::borrow::Cow;

  fn temizle(s: &str) -> Cow<'_, str> {
      if s.contains('\t') {
          Cow::Owned(s.replace('\t', " "))
      } else {
          Cow::Borrowed(s)
      }
  }

  fn main() {
      for girdi in ["elma armut", "elma\tarmut"] {
          match temizle(girdi) {
              Cow::Borrowed(b) => println!("ödünç: {b}"),
              Cow::Owned(o) => println!("yeni: {o}"),
          }
      }
  }
options:
  - |
    ödünç: elma armut
    yeni: elma armut
  - |
    yeni: elma armut
    yeni: elma armut
  - |
    ödünç: elma armut
    ödünç: elma armut
answer: 0
explanation: |
  İlk girdide sekme yok: `Cow::Borrowed` döner, **hiç tahsis yapılmaz**. İkincide `replace` yeni bir
  `String` üretir: `Cow::Owned`. Çıktılar aynı görünse de bellek davranışları farklı. `Cow`'un değeri,
  girdilerin çoğu değişmeden geçtiğinde ortaya çıkar.
```

```compiles
code: |
  fn kelime_say(metin: &String) -> usize {
      metin.split_whitespace().count()
  }

  fn main() {
      let n = kelime_say("bugün hava çok güzel");
      println!("{n}");
  }
answer: false
error: E0308
explanation: |
  Modül 5'i hatırla: `"bugün hava çok güzel"` bir `&'static str`'dir, `&String` değil. `&String`'den
  `&str`'ye otomatik dönüşüm (deref coercion) vardır ama **tersi yoktur**. Çözüm parametreyi `&str`
  yapmaktır; o zaman fonksiyon hem literal'leri hem `&String`'leri kabul eder ve çağıranı bir `String`
  tahsis etmeye zorlamaz. Clippy de `&String` parametresini `ptr_arg` ile işaretler.
```

## API'ler ve hatalar

```quiz
question: |
  `struct Sifre(String)` newtype'ı için yazılmış aşağıdaki metotlardan hangisi Rust API Guidelines'ın
  isimlendirme sözleşmesine **aykırıdır**?
options:
  - "`fn as_str(&self) -> &str` — içteki metni ödünç verir"
  - "`fn into_inner(self) -> String` — newtype'ı tüketip içteki `String`'i verir"
  - "`fn as_hash(&self) -> String` — SHA-256 özetini hesaplayıp yeni bir `String` döndürür"
  - "`fn to_maskeli(&self) -> String` — `\"****\"` gibi maskelenmiş yeni bir metin üretir"
answer: 2
explanation: |
  `as_` önekinin vaadi **bedava bir görünümdür**: ödünç al, ödünç ver, tahsis yok. Özet hesaplamak
  pahalı bir iştir ve yeni bir `String` tahsis eder: bu `to_hash` olmalıdır. İsim yanlış olunca
  kullanıcı onu bir döngüde rahatça çağırır ve habersizce binlerce özet hesaplatır.
feedback:
  - Uygun. `as_` = ödünç → ödünç, bedava.
  - Uygun. `into_` = `self`'i tüketir, sahipli → sahipli.
  - Doğru! Pahalı ve tahsis eden bir dönüşüm `to_` önekini almalı.
  - Uygun. `to_` = ödünç alır, yeni sahipli değer üretir (genelde tahsis).
```

```fill
prompt: Kurucuyu esnek yap (`&str` de `String` de kabul etsin) ve getter'ı API Guidelines'a uygun yaz.
code: |
  struct Kitap {
      baslik: String,
      yazar: String,
  }

  impl Kitap {
      fn yeni(baslik: impl ___0<String>, yazar: impl Into<String>) -> Self {
          Kitap { baslik: baslik.into(), yazar: yazar.___1 }
      }

      fn baslik(&self) -> ___2 {
          &self.baslik
      }
  }

  fn main() {
      let k = Kitap::yeni("Tutunamayanlar", String::from("Oğuz Atay"));
      println!("{} — {}", k.baslik(), k.yazar);
  }
blanks:
  - ["Into"]
  - ["into()"]
  - ["&str"]
output: Tutunamayanlar — Oğuz Atay
explanation: |
  Alan bir `String` olarak **saklanacağı** için `impl Into<String>` en iyisidir: çağıran `String`
  verirse taşınır (kopya yok), `&str` verirse tam bir kez kopyalanır. Getter `get_` öneki almaz ve
  iç temsili gizlemek için `&String` yerine `&str` döndürür.
```

```compiles
code: |
  #[must_use = "siparişi oluşturmak için `.olustur()` çağır"]
  struct SiparisBuilder {
      adet: u32,
  }

  impl SiparisBuilder {
      fn adet(mut self, n: u32) -> Self {
          self.adet = n;
          self
      }
  }

  fn main() {
      let b = SiparisBuilder { adet: 1 };
      b.adet(5);
      println!("bitti");
  }
answer: true
explanation: |
  Derlenir! `#[must_use]` bir **uyarı** (`unused_must_use`) üretir, hata değil. `b.adet(5)` yeni builder'ı
  döndürüp hemen atıyor; derleyici bunu `#[must_use]` mesajıyla birlikte gösterir. CI'da
  `-D warnings` varsa bu uyarı orada hataya dönüşür; araçlar bu yüzden birlikte çalışır.
```

```predict
code: |
  use anyhow::{Context, Result, ensure};

  fn yas_oku(s: &str) -> Result<u8> {
      let yas: u8 = s.trim().parse().context("yaş sayı değil")?;
      ensure!(yas >= 18, "{yas} yaş, 18'den küçük");
      Ok(yas)
  }

  fn main() {
      for g in ["20", "15", "yirmi"] {
          match yas_oku(g).with_context(|| format!("kayıt {g:?}")) {
              Ok(y) => println!("ok {y}"),
              Err(e) => println!("{e:#}"),
          }
      }
  }
options:
  - |
    ok 20
    kayıt "15": 15 yaş, 18'den küçük
    kayıt "yirmi": yaş sayı değil: invalid digit found in string
  - |
    ok 20
    kayıt "15"
    kayıt "yirmi"
  - |
    ok 20
    15 yaş, 18'den küçük: kayıt "15"
    invalid digit found in string: yaş sayı değil: kayıt "yirmi"
answer: 0
explanation: |
  Her `context`/`with_context` zincire **dışarıdan** bir katman ekler; `{:#}` zinciri dıştan içe, `: `
  ile birleştirerek tek satırda yazar. `ensure!` başarısız olunca kendi mesajıyla bir hata üretir
  (altında başka katman yok); `parse` hatası ise `context` ile sarıldığı için üç katmanlıdır.
  Yalnızca `{e}` yazsaydık ikinci seçenekteki gibi en dış mesajı görürdük.
```

````quiz
question: |
  Bir kütüphanede şu varyantı görüyorsun:

  ```rust
  #[derive(Debug, thiserror::Error)]
  enum AyarHatasi {
      #[error("ayar okunamadı: {0}")]
      Okuma(#[from] std::io::Error),
  }
  ```

  Bu tasarımın sorunu nedir?
options:
  - "`#[from]` ile `{0}` birlikte kullanılamaz; derlenmez"
  - "Kaynak hata hem `Display` mesajında (`{0}`) hem `source()`'ta (`#[from]`) yer alıyor; zinciri yazdıran araçlar aynı bilgiyi iki kez gösterir"
  - "`std::io::Error` için `#[from]` yerine `#[source]` zorunludur"
  - Hiçbir sorun yok; en çok önerilen kalıp budur
answer: 1
explanation: |
  `#[from]`, alanı `source()` olarak da döndürür. Mesaj ayrıca `{0}` ile aynı hatayı yazınca anyhow'ın
  `{:#}`'u ya da bir log aracı `ayar okunamadı: No such file... : No such file...` gibi tekrarlı çıktı
  üretir. Kural: kaynağı **ya** mesaja koy **ya** `source()`'tan döndür. Burada doğrusu
  `#[error("ayar okunamadı")]`.
feedback:
  - Derlenir; sorun derleme değil, zincirdeki tekrar.
  - Doğru! Kaynak ya mesajda ya source'ta, ikisinde birden değil.
  - "`#[from]` her `Error` tipiyle kullanılabilir; `#[source]` sadece `From` istemediğinde tercih edilir."
  - Mesaj tekrarı, hata yönetimi çalışma grubunun özellikle uyardığı bir hatadır.
````

## Kalite, kalıplar ve tekrar

```quiz
question: |
  Clippy önerilerini elle uygularken aşağıdaki "sadeleştirmelerden" hangisi programın **davranışını
  değiştirir**?
options:
  - "`if a { if b { f(); } }` → `if a && b { f(); }`"
  - "`if v.len() == 0 { .. }` → `if v.is_empty() { .. }`"
  - "`if !v.is_empty() && v.iter().all(|&n| n >= 85) { .. }` → `if v.iter().all(|&n| n >= 85) { .. }`"
  - "Fonksiyonun son satırındaki `return x;` → `x`"
answer: 2
explanation: |
  `iter().all(..)` **boş** bir dizide `true` döner (boş küme her koşulu sağlar). Boşluk kontrolünü
  silersen hiç notu olmayan öğrenci "hepsi 85 üstü" sayılır. Diğer üç dönüşüm clippy'nin
  `collapsible_if`, `len_zero` ve `needless_return` önerileridir ve davranışı birebir korur.
  Yeniden düzenlemeden önce testlerin olmasının sebebi budur.
feedback:
  - "`&&` kısa devre yapar; `a` yanlışsa `b` hiç değerlendirilmez, tıpkı iç içe `if` gibi."
  - "`is_empty()` ile `len() == 0` aynı anlamdadır."
  - Doğru! Boş dizide `all` → `true`; kontrol gerekliydi.
  - Son ifade zaten bloğun değeridir; `return` gereksizdi.
```

```parsons
prompt: |
  `Birim` trait'ini **mühürle**: crate dışından kimse uygulayamasın ama `Lira` onu uygulasın.
lines: |
  mod para {
      mod gizli {
          pub trait Muhur {}
      }
      pub trait Birim: gizli::Muhur {}
      pub struct Lira;
      impl gizli::Muhur for Lira {}
      impl Birim for Lira {}
  }
  fn main() {}
distractors: |
      pub trait Birim {}
      impl Birim for gizli::Lira {}
explanation: |
  Mühür, `para` dışından **adı yazılamayan** `gizli::Muhur` supertrait'idir: `Birim`'i uygulamak için
  önce `Muhur`'u uygulamak gerekir, bu da yalnızca `para` modülünün (gerçek hayatta crate'in) içinden
  mümkündür. Supertrait'siz `pub trait Birim {}` herkesin uygulamasına açık olurdu.
```

```predict
code: |
  use std::rc::Rc;

  fn main() {
      let katalog = Rc::new(vec![String::from("kalem"); 1000]);
      let a = Rc::clone(&katalog);
      let b = Rc::clone(&katalog);
      println!("{} {}", Rc::strong_count(&katalog), a.len() + b.len());
      drop(a);
      println!("{}", Rc::strong_count(&b));
  }
options:
  - |
    3 2000
    2
  - |
    1 2000
    1
  - |
    3 3000
    2
answer: 0
explanation: |
  Modül 17'den: `Rc::clone` 1000 `String`'i **kopyalamaz**; yalnızca referans sayacını artırır (ucuz,
  tahsis yok). Üç sahip var → `3`; `a` ve `b` aynı vektörü gösterir → 1000 + 1000 = `2000`. `drop(a)`
  sayacı `2`'ye indirir. Ders 2'deki "gereksiz `clone`'dan kaçın" tavsiyesinin bir yolu da budur:
  paylaşılması gereken büyük veri için derin kopya yerine `Rc`/`Arc`.
```

```quiz
question: |
  Ekibin CI hattında yalnızca şu adımlar var:

  1. `cargo fmt --all --check`
  2. `cargo clippy --all-targets -- -D warnings`
  3. `cargo test --all-targets`

  Belgelerindeki bir kod örneği (`/// # Examples` içindeki) bozuldu. Ne olur?
options:
  - 3. adım başarısız olur, çünkü `cargo test` doc testlerini de çalıştırır
  - "Hiçbir adım yakalamaz: `--all-targets` doc testlerini içermez; `cargo test --doc` (ya da bayraksız `cargo test`) eklenmeli"
  - 2. adım yakalar, çünkü clippy belge örneklerini derler
answer: 1
explanation: |
  `--all-targets` "lib, bin, test, bench, example" demektir; doc testleri bu listede **yoktur**. Modül
  13'te öğrendiğin gibi doc testleri belgelerinin doğru kalmasını garanti eden şeydir, CI'dan düşmeleri
  sessiz bir kayıptır. Ek olarak `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps` kırık belge
  bağlantılarını yakalar.
feedback:
  - Bayraksız `cargo test` çalıştırırdı; `--all-targets` ise çalıştırmaz.
  - Doğru! Klasik bir CI tuzağı.
  - Clippy belge yorumlarındaki kod bloklarını çalıştırmaz.
```

## Uygulama

```exercise
id: m25-boss-e-slug
title: Tahsis bilinçli slug üretici
difficulty: 3
prompt: |
  Bir blog motoru, yazı başlıklarından URL parçası (**slug**) üretiyor. Başlıkların çoğu zaten slug
  biçiminde geliyor, bu yüzden gereksiz tahsisten kaçınmak istiyorsun. `slug(baslik: &str) -> Cow<'_, str>`
  fonksiyonunu yaz:

  - Başlık **zaten geçerli bir slug** ise (yalnızca `a-z`, `0-9` ve `-`; `-` ile başlamıyor/bitmiyor;
    `--` içermiyor) girdiyi `Cow::Borrowed` ile **olduğu gibi** döndür. Boş metin de geçerlidir.
  - Aksi hâlde yeni bir `String` kur (`String::with_capacity(baslik.len())` ile) ve `Cow::Owned` döndür:
    - Türkçe harfler sadeleşir: `ç→c`, `ğ→g`, `ı→i`, `İ→i`, `ö→o`, `ş→s`, `ü→u` (büyükleri de).
    - ASCII harf ve rakamlar küçük harfe çevrilip eklenir.
    - Diğer her karakter (boşluk, noktalama, `-`) bir **ayırıcıdır**: art arda gelen ayırıcılar tek bir
      `-` olur; sonucun başında ve sonunda `-` olmaz.

  Örnek: `"  Rust: Sahiplik & Ödünç!  "` → `"rust-sahiplik-odunc"`.
starter: |
  use std::borrow::Cow;

  fn slug(baslik: &str) -> Cow<'_, str> {
      todo!()
  }

  fn main() {
      for baslik in ["rust-dersi-25", "Çağrı Öztürk ile Rust"] {
          match slug(baslik) {
              Cow::Borrowed(s) => println!("ödünç: {s}"),
              Cow::Owned(s) => println!("yeni:  {s}"),
          }
      }
  }
solution: |
  use std::borrow::Cow;

  fn gecerli_slug_mu(s: &str) -> bool {
      !s.starts_with('-')
          && !s.ends_with('-')
          && !s.contains("--")
          && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
  }

  fn slug(baslik: &str) -> Cow<'_, str> {
      if gecerli_slug_mu(baslik) {
          return Cow::Borrowed(baslik);
      }
      let mut sonuc = String::with_capacity(baslik.len());
      for c in baslik.chars() {
          let harf = match c {
              'ç' | 'Ç' => Some('c'),
              'ğ' | 'Ğ' => Some('g'),
              'ı' | 'İ' => Some('i'),
              'ö' | 'Ö' => Some('o'),
              'ş' | 'Ş' => Some('s'),
              'ü' | 'Ü' => Some('u'),
              c if c.is_ascii_alphanumeric() => Some(c.to_ascii_lowercase()),
              _ => None,
          };
          match harf {
              Some(h) => sonuc.push(h),
              None => {
                  if !sonuc.is_empty() && !sonuc.ends_with('-') {
                      sonuc.push('-');
                  }
              }
          }
      }
      if sonuc.ends_with('-') {
          sonuc.pop();
      }
      Cow::Owned(sonuc)
  }

  fn main() {
      for baslik in ["rust-dersi-25", "Çağrı Öztürk ile Rust"] {
          match slug(baslik) {
              Cow::Borrowed(s) => println!("ödünç: {s}"),
              Cow::Owned(s) => println!("yeni:  {s}"),
          }
      }
  }
check: tests
tests: |
  #[test]
  fn zaten_slug_ise_tahsis_yapmaz() {
      assert!(matches!(slug("rust-dersi-25"), Cow::Borrowed("rust-dersi-25")), "geçerli slug ödünç dönmeli");
      assert!(matches!(slug(""), Cow::Borrowed("")), "boş metin geçerli bir slug'dır");
      assert!(matches!(slug("a--b"), Cow::Owned(_)), "'--' içeren metin geçerli slug değildir");
      assert!(matches!(slug("-rust"), Cow::Owned(_)), "'-' ile başlayan metin geçerli slug değildir");
  }

  #[test]
  fn turkce_harfler_sadelesir() {
      assert_eq!(slug("Çağrı Öztürk"), "cagri-ozturk");
      assert_eq!(slug("IŞIK ve GÖLGE"), "isik-ve-golge", "büyük harfler de küçülüp sadeleşmeli");
      assert_eq!(slug("İstanbul 2026"), "istanbul-2026");
  }

  #[test]
  fn ayiricilar_tek_tireye_iner() {
      assert_eq!(slug("  Rust: Sahiplik & Ödünç!  "), "rust-sahiplik-odunc", "baştaki/sondaki ayırıcılar atılmalı");
      assert_eq!(slug("a--b"), "a-b", "art arda ayırıcılar tek '-' olmalı");
      assert_eq!(slug("-rust-"), "rust");
      assert_eq!(slug("!!! ???"), "", "yalnızca ayırıcıdan oluşan başlık boş slug verir");
  }
hints:
  - "İşi ikiye böl: önce `fn gecerli_slug_mu(s: &str) -> bool` yaz (`starts_with`, `ends_with`, `contains(\"--\")` ve `s.bytes().all(..)`). Geçerliyse `return Cow::Borrowed(baslik);`"
  - "Her karakteri `match` ile bir `Option<char>`'a çevir: Türkçe harfler için `'ç' | 'Ç' => Some('c')`, `c if c.is_ascii_alphanumeric() => Some(c.to_ascii_lowercase())`, geri kalan her şey `None` (ayırıcı)."
  - "`Some(h)` → `sonuc.push(h)`. `None` → yalnızca `!sonuc.is_empty() && !sonuc.ends_with('-')` ise `-` ekle (baştaki ve tekrarlı ayırıcılar böylece atlanır). Döngüden sonra sonda kalan `-`'yi `pop()` ile at."
require:
  - pattern: "String::with_capacity"
    message: "Sonuç `String`'ini `String::with_capacity(baslik.len())` ile önceden ayır (çıktı girdiden uzun olamaz)."
explanation: |
  Bu fonksiyon modülün iki fikrini birleştiriyor: **ödünç al, gerekirse sahiplen** (`Cow`) ve **yeri baştan
  ayır** (`with_capacity`). Gerçek bir blogda başlıkların çoğu zaten slug olarak saklandığından ana yol
  hiç tahsis yapmaz. Çıktı hiçbir zaman girdiden uzun olamaz (her karakter en fazla bir bayta iner),
  bu yüzden `baslik.len()` kapasitesi tek tahsisle yetiyor.

  Ayırıcı mantığı "son eklenen karaktere bak" fikrine dayanıyor: baştaki ayırıcılar `is_empty` sayesinde,
  tekrarlılar `ends_with('-')` sayesinde atlanıyor; sondaki tek `-` ise `pop` ile gidiyor. Bu kalıp ayrı
  bir "önceki ayırıcı mıydı?" bayrağı tutmaktan daha az durumludur.

  `Cow<'_, str>` `&str` ile `==` karşılaştırılabildiği için testler `assert_eq!(slug(..), "...")` yazabiliyor;
  çağıranlar da sonucu `&*slug` ya da `slug.as_ref()` ile `&str` gibi kullanabilir.
```

```exercise
id: m25-boss-e-etiket
title: Typestate'li kargo etiketi builder'ı
difficulty: 3
prompt: |
  Bir kargo uygulaması için etiket builder'ı yazıyorsun. Kural: **adres verilmeden etiket oluşturulamaz**,
  ve bu kural çalışma zamanında değil, **derleme zamanında** denetlenmeli. Bunun için builder'ın tip
  parametresi adres durumunu taşıyor: `EtiketBuilder<AdresYok>` → `EtiketBuilder<AdresVar>`.

  Metot gövdelerini tamamla:

  - `Etiket::builder(alici)`: `impl Into<String>` alır; adres yok, desi varsayılan olarak `1`.
  - `desi(n)`: **her durumda** çağrılabilir (adres öncesi ya da sonrası). `0` verilirse `1` kabul edilir.
  - `adres(a)`: yalnızca `AdresYok` durumunda var; `impl Into<String>` alır ve adresi `AdresVar` içine koyar.
  - `olustur()`: yalnızca `AdresVar` durumunda var; `Etiket` döndürür (hiç `Option`/`unwrap` gerekmeden!).
  - `Display`: `"<alıcı> | <adres> | <desi> desi"`, örn. `"Ayşe Yılmaz | Isparta | 3 desi"`.
starter: |
  use std::fmt;

  pub struct AdresYok;
  pub struct AdresVar(String);

  #[derive(Debug, PartialEq)]
  pub struct Etiket {
      alici: String,
      adres: String,
      desi: u32,
  }

  #[must_use = "etiketi oluşturmak için `.olustur()` çağır"]
  pub struct EtiketBuilder<A> {
      alici: String,
      adres: A,
      desi: u32,
  }

  impl Etiket {
      pub fn builder(alici: impl Into<String>) -> EtiketBuilder<AdresYok> {
          todo!()
      }
  }

  impl<A> EtiketBuilder<A> {
      pub fn desi(mut self, desi: u32) -> Self {
          todo!()
      }
  }

  impl EtiketBuilder<AdresYok> {
      pub fn adres(self, adres: impl Into<String>) -> EtiketBuilder<AdresVar> {
          todo!()
      }
  }

  impl EtiketBuilder<AdresVar> {
      pub fn olustur(self) -> Etiket {
          todo!()
      }
  }

  impl fmt::Display for Etiket {
      fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
          todo!()
      }
  }

  fn main() {
      let etiket = Etiket::builder("Ayşe Yılmaz").desi(3).adres("Isparta").olustur();
      println!("{etiket}");
  }
solution: |
  use std::fmt;

  pub struct AdresYok;
  pub struct AdresVar(String);

  #[derive(Debug, PartialEq)]
  pub struct Etiket {
      alici: String,
      adres: String,
      desi: u32,
  }

  #[must_use = "etiketi oluşturmak için `.olustur()` çağır"]
  pub struct EtiketBuilder<A> {
      alici: String,
      adres: A,
      desi: u32,
  }

  impl Etiket {
      pub fn builder(alici: impl Into<String>) -> EtiketBuilder<AdresYok> {
          EtiketBuilder { alici: alici.into(), adres: AdresYok, desi: 1 }
      }
  }

  impl<A> EtiketBuilder<A> {
      pub fn desi(mut self, desi: u32) -> Self {
          self.desi = desi.max(1);
          self
      }
  }

  impl EtiketBuilder<AdresYok> {
      pub fn adres(self, adres: impl Into<String>) -> EtiketBuilder<AdresVar> {
          EtiketBuilder { alici: self.alici, adres: AdresVar(adres.into()), desi: self.desi }
      }
  }

  impl EtiketBuilder<AdresVar> {
      pub fn olustur(self) -> Etiket {
          Etiket { alici: self.alici, adres: self.adres.0, desi: self.desi }
      }
  }

  impl fmt::Display for Etiket {
      fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
          write!(f, "{} | {} | {} desi", self.alici, self.adres, self.desi)
      }
  }

  fn main() {
      let etiket = Etiket::builder("Ayşe Yılmaz").desi(3).adres("Isparta").olustur();
      println!("{etiket}");
  }
check: tests
tests: |
  #[test]
  fn tam_zincir_ve_display() {
      let e = Etiket::builder("Ayşe Yılmaz").adres(String::from("Isparta")).desi(3).olustur();
      assert_eq!(e.to_string(), "Ayşe Yılmaz | Isparta | 3 desi");
  }

  #[test]
  fn desi_adresten_once_de_verilebilir() {
      let e = Etiket::builder(String::from("Can Demir")).desi(5).adres("Ankara, Çankaya").olustur();
      assert_eq!(
          e,
          Etiket { alici: "Can Demir".to_string(), adres: "Ankara, Çankaya".to_string(), desi: 5 },
          "desi, adres verilmeden önce ayarlanınca da korunmalı"
      );
  }

  #[test]
  fn varsayilan_ve_sifir_desi() {
      let e = Etiket::builder("Elif").adres("İzmir").olustur();
      assert_eq!(e.to_string(), "Elif | İzmir | 1 desi", "desi verilmezse 1 olmalı");
      let e = Etiket::builder("Elif").adres("İzmir").desi(0).olustur();
      assert_eq!(e.to_string(), "Elif | İzmir | 1 desi", "0 desi 1 kabul edilmeli");
  }
hints:
  - "`builder`: `EtiketBuilder { alici: alici.into(), adres: AdresYok, desi: 1 }`. `desi`: `self.desi = desi.max(1); self`."
  - "Durum değiştiren `adres` yeni bir builder kurar: `EtiketBuilder { alici: self.alici, adres: AdresVar(adres.into()), desi: self.desi }`. Tip parametresi `adres` alanının tipinden çıkarılır."
  - "`olustur`: adres artık `self.adres.0` içinde garanti olarak var: `Etiket { alici: self.alici, adres: self.adres.0, desi: self.desi }`. `Display` için `write!(f, \"{} | {} | {} desi\", ...)`."
explanation: |
  Bu builder'da durum tipi sadece bir işaret değil, **veriyi taşıyor**: `AdresVar(String)`. Bu sayede
  `olustur` hiçbir kontrol yapmadan adresi alabiliyor; klasik builder'daki `Option<String>` +
  `ok_or("adres eksik")?` ikilisine gerek kalmıyor. "Doğrulama yerine tiple ifade et" (parse, don't
  validate) ilkesinin güzel bir örneği.

  `desi` metodu `impl<A> EtiketBuilder<A>` içinde olduğu için **her durumda** kullanılabiliyor; durum
  değiştirmediği için `Self` döndürüyor. `adres` ise yalnızca `AdresYok`'ta var: adresi iki kez vermek de
  derleme hatası (E0599). `#[must_use]` ile `.olustur()`'u unutmak da uyarı üretiyor.

  `impl Into<String>` parametreleri `"Isparta"` ile `String::from("Isparta")`'yı aynı rahatlıkla kabul
  ediyor; saklanacak veri için en verimli esnek imza budur.
```

```exercise
id: m25-boss-e-bilet
title: Tipli hatalar ve bağlamlı rezervasyon
difficulty: 4
prompt: |
  Bir sinema bilet sisteminde iki katman var. Koltuklar bir `&mut [bool]` dilimi (`true` = dolu,
  koltuk numaraları **1'den** başlar).

  **Kütüphane katmanı (thiserror):** `BiletHatasi` enum'unu tanımla. Mesajlar birebir aynı olmalı:

  - `Gecersiz(ParseIntError)` → `geçersiz koltuk numarası` (kaynak `source()` ile, `?` için `#[from]`)
  - `SalonDisi { numara: usize, kapasite: usize }` → `koltuk <numara> salonda yok (salon <kapasite> kişilik)`
  - `Dolu(usize)` → `koltuk <numara> dolu`

  `rezerve_et(koltuklar, metin)`: kırpılmış metni `usize`'a çevir (`?`), numara 0 ya da kapasiteden büyükse
  `SalonDisi`, koltuk doluysa `Dolu`; aksi hâlde koltuğu doldurup numarayı döndür.

  **Uygulama katmanı (anyhow):** `toplu_rezervasyon(koltuklar, istekler)` istekleri sırayla işler ve alınan
  numaraları döndürür. İlk hatada durur ve hataya şu bağlamı ekler: `<sıra>. istek (<istek:?>) işlenemedi`
  (sıra 1'den başlar). O ana kadar yapılan rezervasyonlar kalır.
starter: |
  use anyhow::Context;
  use std::num::ParseIntError;
  use thiserror::Error;

  #[derive(Debug, Error, PartialEq)]
  pub enum BiletHatasi {
      // varyantları ve #[error(...)] mesajlarını yaz
      #[error("TODO")]
      Taslak(ParseIntError),
  }

  pub fn rezerve_et(koltuklar: &mut [bool], metin: &str) -> Result<usize, BiletHatasi> {
      todo!()
  }

  pub fn toplu_rezervasyon(koltuklar: &mut [bool], istekler: &[&str]) -> anyhow::Result<Vec<usize>> {
      todo!()
  }

  fn main() {
      let mut salon = [false; 5];
      match toplu_rezervasyon(&mut salon, &["2", "3", "9"]) {
          Ok(alinan) => println!("alınan: {alinan:?}"),
          Err(e) => println!("hata: {e:#}"),
      }
      println!("{salon:?}");
  }
solution: |
  use anyhow::Context;
  use std::num::ParseIntError;
  use thiserror::Error;

  #[derive(Debug, Error, PartialEq)]
  pub enum BiletHatasi {
      #[error("geçersiz koltuk numarası")]
      Gecersiz(#[from] ParseIntError),
      #[error("koltuk {numara} salonda yok (salon {kapasite} kişilik)")]
      SalonDisi { numara: usize, kapasite: usize },
      #[error("koltuk {0} dolu")]
      Dolu(usize),
  }

  pub fn rezerve_et(koltuklar: &mut [bool], metin: &str) -> Result<usize, BiletHatasi> {
      let numara: usize = metin.trim().parse()?;
      let kapasite = koltuklar.len();
      if numara == 0 || numara > kapasite {
          return Err(BiletHatasi::SalonDisi { numara, kapasite });
      }
      let koltuk = &mut koltuklar[numara - 1];
      if *koltuk {
          return Err(BiletHatasi::Dolu(numara));
      }
      *koltuk = true;
      Ok(numara)
  }

  pub fn toplu_rezervasyon(koltuklar: &mut [bool], istekler: &[&str]) -> anyhow::Result<Vec<usize>> {
      let mut alinan = Vec::with_capacity(istekler.len());
      for (i, istek) in istekler.iter().enumerate() {
          let numara = rezerve_et(koltuklar, istek)
              .with_context(|| format!("{}. istek ({istek:?}) işlenemedi", i + 1))?;
          alinan.push(numara);
      }
      Ok(alinan)
  }

  fn main() {
      let mut salon = [false; 5];
      match toplu_rezervasyon(&mut salon, &["2", "3", "9"]) {
          Ok(alinan) => println!("alınan: {alinan:?}"),
          Err(e) => println!("hata: {e:#}"),
      }
      println!("{salon:?}");
  }
check: tests
tests: |
  use std::error::Error;

  #[test]
  fn tekli_rezervasyon_ve_dolu_koltuk() {
      let mut salon = [false; 5];
      assert_eq!(rezerve_et(&mut salon, " 3 "), Ok(3), "metin kırpılmalı");
      assert!(salon[2], "3 numaralı koltuk (indeks 2) dolmalı");
      let e = rezerve_et(&mut salon, "3").unwrap_err();
      assert_eq!(e, BiletHatasi::Dolu(3));
      assert_eq!(e.to_string(), "koltuk 3 dolu");
  }

  #[test]
  fn salon_disi_ve_gecersiz() {
      let mut salon = [false; 5];
      let e = rezerve_et(&mut salon, "6").unwrap_err();
      assert_eq!(e.to_string(), "koltuk 6 salonda yok (salon 5 kişilik)");
      assert_eq!(rezerve_et(&mut salon, "0").unwrap_err(), BiletHatasi::SalonDisi { numara: 0, kapasite: 5 }, "numaralar 1'den başlar");
      let e = rezerve_et(&mut salon, "beş").unwrap_err();
      assert!(matches!(e, BiletHatasi::Gecersiz(_)), "parse hatası ? ile Gecersiz'e dönüşmeli");
      assert_eq!(e.to_string(), "geçersiz koltuk numarası", "kaynak mesajı Display'de tekrarlanmamalı");
      assert!(e.source().is_some(), "Gecersiz, ParseIntError'ı source() ile döndürmeli");
      assert_eq!(salon, [false; 5], "başarısız denemeler koltuk doldurmamalı");
  }

  #[test]
  fn toplu_rezervasyon_baglam_ekler() {
      let mut salon = [false; 5];
      assert_eq!(toplu_rezervasyon(&mut salon, &["1", "5"]).unwrap(), vec![1, 5]);
      let e = toplu_rezervasyon(&mut salon, &["2", "9", "4"]).unwrap_err();
      assert_eq!(format!("{e:#}"), "2. istek (\"9\") işlenemedi: koltuk 9 salonda yok (salon 5 kişilik)");
      assert_eq!(
          e.downcast_ref::<BiletHatasi>(),
          Some(&BiletHatasi::SalonDisi { numara: 9, kapasite: 5 }),
          "bağlamın altındaki tipli hata downcast ile bulunabilmeli"
      );
      assert_eq!(salon, [true, true, false, false, true], "hatadan önceki rezervasyon kalmalı, sonrakiler yapılmamalı");
      let e = toplu_rezervasyon(&mut salon, &["x"]).unwrap_err();
      assert_eq!(format!("{e:#}"), "1. istek (\"x\") işlenemedi: geçersiz koltuk numarası: invalid digit found in string");
  }
hints:
  - "Varyantlar: `#[error(\"geçersiz koltuk numarası\")] Gecersiz(#[from] ParseIntError)`, `#[error(\"koltuk {numara} salonda yok (salon {kapasite} kişilik)\")] SalonDisi { numara: usize, kapasite: usize }`, `#[error(\"koltuk {0} dolu\")] Dolu(usize)`."
  - "`rezerve_et`: `let numara: usize = metin.trim().parse()?;` sonra aralık kontrolü; `let koltuk = &mut koltuklar[numara - 1];` ile koltuğu ödünç al, doluysa `Dolu`, değilse `*koltuk = true;`."
  - "`toplu_rezervasyon`: `for (i, istek) in istekler.iter().enumerate()` içinde `rezerve_et(koltuklar, istek).with_context(|| format!(\"{}. istek ({istek:?}) işlenemedi\", i + 1))?`; sonuçları önceden ayrılmış bir `Vec`'e (`with_capacity`) topla."
explanation: |
  İki katmanlı tasarım, Ders 4'teki kuralın birebir uygulaması: **kütüphane** (`rezerve_et`) tipli bir
  `BiletHatasi` döndürüyor, çünkü çağıran "dolu mu, salon dışı mı?" diye **ayırt edip** farklı tepki
  vermek isteyebilir (örneğin dolu koltukta yan koltuğu önermek). **Uygulama** (`toplu_rezervasyon`) ise
  hatayı gösterecek; ona tip değil **bağlam** lazım: hangi istek, hangi değer.

  anyhow bağlam eklerken alttaki hatayı kaybetmiyor: `{:#}` tüm zinciri yazıyor, `downcast_ref` ise tipli
  hataya geri ulaşıyor. `Gecersiz` varyantının mesajı kısa tutulduğu için `ParseIntError`'ın mesajı
  zincirde yalnızca **bir kez** görünüyor.

  `with_context` closure'u yalnızca hata olduğunda çalışır: başarılı isteklerde `format!` hiç
  tahsis yapmaz. Sonuç vektörü de `with_capacity(istekler.len())` ile tek tahsiste kuruluyor; modülün
  performans ve hata yönetimi fikirleri aynı fonksiyonda buluşuyor.
```
