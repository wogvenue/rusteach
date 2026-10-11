---
id: m08-l05
title: Modülleri Dosyalara Bölmek
minutes: 18
type: lesson
objectives:
  - "`mod ad;` bildiriminin derleyiciye hangi dosyayı (`ad.rs` ya da `ad/mod.rs`) aratacağını söyleyebilmek"
  - İç içe modülleri modern düzenle (`src/a.rs` + `src/a/b.rs`) dosyalara bölebilmek ve dosya düzeninden modül ağacını çıkarabilmek
  - "Her modülün **bir kez** `mod` ile bildirildiğini, başka yerlerden `use crate::...` ile kullanıldığını açıklayıp E0583'ü düzeltebilmek"
  - "`src/lib.rs` + `src/main.rs` kalıbını kurup binary crate'in kütüphaneyi paket adıyla kullanmasını sağlayabilmek"
keywords: ["mod ad;", dosya, mod.rs, lib.rs, main.rs, modül ağacı, proje düzeni, E0583, E0761]
---

Geçen dersteki kütüphane alıştırmasını hatırla: `kutuphane`, `katalog`, `kitap`, `arama`, `odunc`... Hepsi
tek bir dosyada, iç içe süslü parantezlerin arasındaydı. 70 satırda bu sorun değil. Ama gerçek bir
kütüphane yazılımı 7.000 satır olur ve tek bir dosyada iç içe geçmiş on kat süslü parantez kimsenin
okuyabileceği bir şey değildir.

Bu derste modül ağacını **değiştirmeden** onu dosyalara dağıtmayı öğreneceksin. İyi haber şu: bildiğin
her şey (yollar, `pub`, `use`) aynen geçerli. Değişen tek şey, modülün gövdesinin **nerede durduğu**.

:::info Bu derste kod blokları
Uygulamadaki kod blokları tek bir dosya olarak derlenir. Bu yüzden çok dosyalı düzenleri klasör ağaçları
ve başlığında dosya adı yazan (`src/kutuphane.rs` gibi) kod parçalarıyla göstereceğiz. Çalıştırılabilir
örnekler ise aynı modül ağacını satır içi `mod` bloklarıyla kurar; dosyalara bölünmüş hâli **birebir aynı
ağaçtır**.
:::

## Noktalı virgüllü mod

Şimdiye kadar hep `mod ad { ... }` yazdık. Modülün gövdesini süslü parantez yerine bir **noktalı virgülle**
bitirirsen derleyiciye şunu söylemiş olursun: "Bu modülün içeriği **başka bir dosyada**, git onu bul."
Tahmin et:

```compiles
question: Bu kod tek bir `src/main.rs` dosyası olarak derlenirse (yanında başka dosya yok) derlenir mi?
code: |
  mod kutuphane;

  fn main() {
      kutuphane::listele();
  }
answer: false
error: E0583
explanation: |
  `mod kutuphane;` bir **bildirimdir (declaration)**: "crate'in modül ağacında `kutuphane` adında bir
  modül var ve içeriği ayrı bir dosyada." Derleyici o dosyayı arar; bulamazsa **E0583 - file not found
  for module** verir. Yanına `src/kutuphane.rs` dosyasını koyduğunda aynı kod derlenir.
```

:::error
```text
error[E0583]: file not found for module `kutuphane`
 --> src/main.rs:1:1
  |
1 | mod kutuphane;
  | ^^^^^^^^^^^^^^
  |
  = help: to create the module `kutuphane`, create file "src/kutuphane.rs" or "src/kutuphane/mod.rs"
  = note: if there is a `mod kutuphane` elsewhere in the crate already, import it with `use crate::...` instead
```
Derleyici **hangi dosyaları aradığını** açıkça söylüyor: `src/kutuphane.rs` ya da `src/kutuphane/mod.rs`.
Son satırdaki `note` ise bu dersin en önemli tuzaklarından birine işaret ediyor; "Her modül bir kez
bildirilir" bölümünde ona döneceğiz.
:::

İki yazım biçimi **aynı modül ağacını** kurar:

```rust,ignore,title=Satır içi - src/main.rs
mod kutuphane {
    pub fn listele() {
        println!("Raf 1: Tutunamayanlar");
    }
}

fn main() {
    kutuphane::listele();
}
```

```rust,ignore,title=src/main.rs
mod kutuphane;

fn main() {
    kutuphane::listele();
}
```

```rust,ignore,title=src/kutuphane.rs
pub fn listele() {
    println!("Raf 1: Tutunamayanlar");
}
```

`src/kutuphane.rs` dosyasının içinde `mod kutuphane { ... }` sarmalayıcısı **yok**. Dosyanın kendisi
zaten modülün gövdesidir; süslü parantezlerin arasında yazdığın her şeyi olduğu gibi dosyaya taşırsın.

:::analogy Ansiklopedi ciltleri
Tek ciltlik bir kitapta bütün bölümler aynı kapağın arasındadır. Ansiklopedi büyüyünce ciltlere ayrılır:
ilk cildin başındaki **içindekiler** sayfası (crate kökü) "Bölüm *Kütüphane* → ayrı ciltte" der. Bölümün
yeri ve adı değişmez, yalnızca sayfalar başka bir kapağın arasına taşınmıştır. `mod kutuphane;` tam olarak
bu nottur. İçindekilerde adı geçmeyen bir cilt ise rafta dursa bile ansiklopedinin parçası değildir.
:::

## Derleyici dosyayı nerede arar?

Kural tek cümle: **bir modülün alt modülleri, o modülün adını taşıyan klasörde durur.** Crate kökü
(`src/main.rs` ya da `src/lib.rs`) bu kuralın başlangıç noktasıdır; onun "klasörü" `src/`'nin kendisidir.

| `mod` bildirimi nerede? | Bildirim | Derleyicinin aradığı dosya |
|---|---|---|
| `src/main.rs` veya `src/lib.rs` | `mod oyun;` | `src/oyun.rs` **ya da** `src/oyun/mod.rs` |
| `src/oyun.rs` (veya `src/oyun/mod.rs`) | `mod harita;` | `src/oyun/harita.rs` **ya da** `src/oyun/harita/mod.rs` |
| `src/oyun/harita.rs` | `mod zindan;` | `src/oyun/harita/zindan.rs` **ya da** `.../zindan/mod.rs` |

Bir oyun projesi şöyle görünebilir:

```text
src/
├── main.rs            mod oyun;            → crate
├── oyun.rs            mod harita; mod karakter;   → crate::oyun
└── oyun/
    ├── harita.rs      mod zindan;          → crate::oyun::harita
    ├── harita/
    │   └── zindan.rs                       → crate::oyun::harita::zindan
    └── karakter.rs                         → crate::oyun::karakter
```

Dosya yolu ile modül yolu birbirinin aynası: `src/oyun/harita/zindan.rs` ↔ `crate::oyun::harita::zindan`.
Bir dosyayı gördüğünde modül yolunu, bir modül yolunu gördüğünde dosyayı bulabilirsin.

```quiz
question: "`src/oyun.rs` dosyasının içinde `mod harita;` yazıyor. Derleyici `harita` modülünün içeriğini hangi dosyalarda arar? (Birden çok doğru cevap var.)"
options:
  - "`src/harita.rs`"
  - "`src/oyun/harita.rs`"
  - "`src/oyun/harita/mod.rs`"
  - "`src/harita/mod.rs`"
answer: [1, 2]
explanation: |
  `harita`, `oyun`'un **alt modülüdür** (`crate::oyun::harita`); alt modüller üst modülün adını taşıyan
  klasörde durur: `src/oyun/`. İçinde de iki biçimden biri kullanılır: `harita.rs` ya da
  `harita/mod.rs`. `src/harita.rs` ise crate kökünün çocuğu olan **başka** bir modülün (`crate::harita`)
  dosyası olurdu.
feedback:
  - "Bu, kökte `mod harita;` yazsaydın aranacak dosyaydı (`crate::harita`). Bildirim `oyun.rs`'in içinde olduğu için arama `src/oyun/` klasöründe yapılır."
  - Doğru, bu modern (2018 sonrası) biçim.
  - Doğru, bu eski biçim; hâlâ geçerli.
  - "Bu da `crate::harita` için aranacak eski biçimli dosya olurdu."
```

:::info İki biçim: `harita.rs` ve `harita/mod.rs`
Rust 2018 döneminden (Rust 1.30) önce, bir modülün alt modülleri olacaksa onu klasör içinde `mod.rs`
adıyla yazmak zorundaydın: `src/oyun/mod.rs`, `src/oyun/harita/mod.rs`... Sonuç: editörde on tane
"mod.rs" sekmesi ve hangisinin hangisi olduğunu bulmaya çalışan bir geliştirici. O günden beri
`src/oyun.rs` + `src/oyun/` klasörü yan yana durabilir; **yeni kodda bu modern biçim önerilir**. Eski biçim hâlâ çalışır ve birçok popüler
crate'te karşına çıkar. Tek yasak: **aynı modül** için ikisini birden koymak.
:::

:::error
```text
error[E0761]: file for module `oyun` found at both "src/oyun.rs" and "src/oyun/mod.rs"
 --> src/main.rs:1:1
  |
1 | mod oyun;
  | ^^^^^^^^^
  |
  = help: delete or rename one of them to remove the ambiguity
```
**E0761:** Derleyici iki aday dosya bulmuş ve hangisinin `oyun` olduğuna karar veremiyor. Birini sil ya da
yeniden adlandır. (Farklı modüllerde farklı biçimler kullanmak ise serbesttir.)
:::

Dosyaya taşırken en sık yapılan hata, alışkanlıkla sarmalayıcıyı da taşımaktır:

````quiz
question: |
  `src/main.rs`'te `mod hava;` var. Ayşe, `src/hava.rs` dosyasına şunu yazıyor:

  ```rust
  mod hava {
      pub fn tahmin() -> &'static str { "Güneşli" }
  }
  ```

  `tahmin` fonksiyonunun tam yolu ne olur?
options:
  - "`crate::hava::tahmin`"
  - "`crate::hava::hava::tahmin`, ve iç `hava` modülü gizli olduğu için `main` onu çağıramaz"
  - Derlenmez; bir dosyada `mod` bloğu yazılamaz
answer: 1
explanation: |
  `src/hava.rs` dosyası **zaten** `crate::hava` modülünün gövdesidir. İçine bir de `mod hava { ... }`
  yazmak, `hava`'nın içinde ikinci bir `hava` modülü açar: `crate::hava::hava::tahmin`. Üstelik bu iç modül
  `pub` değil, yani `main`'den `hava::hava::tahmin()` bile yazılamaz (E0603). Doğrusu, dosyaya yalnızca
  süslü parantezlerin **içindekileri** koymaktır.
feedback:
  - Dosyanın kendisi modül olduğu için içerideki `mod hava` bir kat daha ekler.
  - Doğru!
  - "Dosyalarda satır içi `mod` blokları yazmak tamamen serbesttir (testler için `mod tests { ... }` hep böyle yazılır); sadece burada istenmeyen bir kat ekliyor."
````

## Dosyalar ağacı saklar, ağacı mod kurar

Şimdi küçük bir projeyi baştan sona bölelim. Önce tek dosyalık hâli; çalıştırıp çıktısını gör:

```rust
// ---- src/main.rs (crate kökü) ----
mod hava {
    // ---- src/hava.rs ----
    pub mod olcum {
        // ---- src/hava/olcum.rs ----
        pub struct Olcum {
            pub sehir: String,
            pub derece: i32,
        }
    }

    pub mod yorum {
        // ---- src/hava/yorum.rs ----
        use super::olcum::Olcum;

        pub fn yorumla(o: &Olcum) -> String {
            let durum = if o.derece >= 30 {
                "çok sıcak"
            } else if o.derece >= 15 {
                "ılık"
            } else {
                "serin"
            };
            format!("{}: {}°C, {durum}", o.sehir, o.derece)
        }
    }
}

use hava::olcum::Olcum;

fn main() {
    let izmir = Olcum { sehir: String::from("İzmir"), derece: 33 };
    let kars = Olcum { sehir: String::from("Kars"), derece: 4 };
    println!("{}", hava::yorum::yorumla(&izmir));
    println!("{}", hava::yorum::yorumla(&kars));
}
```

Yorum satırları, her bloğun dosyalara bölündüğünde nereye gideceğini gösteriyor. Bölünmüş hâli:

```text
src/
├── main.rs
├── hava.rs
└── hava/
    ├── olcum.rs
    └── yorum.rs
```

```rust,ignore,title=src/main.rs
mod hava;

use hava::olcum::Olcum;

fn main() {
    let izmir = Olcum { sehir: String::from("İzmir"), derece: 33 };
    println!("{}", hava::yorum::yorumla(&izmir));
}
```

```rust,ignore,title=src/hava.rs
pub mod olcum;
pub mod yorum;
```

```rust,ignore,title=src/hava/olcum.rs
pub struct Olcum {
    pub sehir: String,
    pub derece: i32,
}
```

```rust,ignore,title=src/hava/yorum.rs
use super::olcum::Olcum;

pub fn yorumla(o: &Olcum) -> String {
    // ... aynı gövde ...
}
```

Dikkat et, neler **değişmedi**:

- Yollar: `hava::yorum::yorumla`, `super::olcum::Olcum`, `use hava::olcum::Olcum`. Hepsi harfi harfine aynı.
- Gizlilik: `pub mod olcum;` satırındaki `pub` tıpkı `pub mod olcum { ... }`'daki gibi çalışır. Bir
  modülün `pub` olup olmadığına, onu **bildiren** `mod` satırı karar verir.
- `src/hava.rs` yalnızca iki satır: bu dosyanın görevi alt modülleri bildirmek. Yanında kendi fonksiyonları
  da olabilirdi.

Asıl ders şu: **modül ağacını `mod` bildirimleri kurar; dosyalar yalnızca gövdeleri saklar.** Python'da ya
da JavaScript'te her dosya kendiliğinden bir modüldür. Rust'ta ise bir dosya, ancak ağaçtaki bir `mod`
satırı onu işaret ettiğinde crate'in parçası olur.

```quiz
question: "Mehmet `src/yardim.rs` dosyasını oluşturup içine `pub fn temizle() {}` yazdı, ama projenin hiçbir yerinde `mod yardim;` yok. Ne olur?"
options:
  - Cargo `src/` klasöründeki bütün `.rs` dosyalarını otomatik derler; `yardim::temizle()` çağrılabilir
  - Derleyici bu dosyayı **hiç görmez**; içine yazım hatası bile koysan derleme bozulmaz, `yardim::temizle()` çağrısı ise "unresolved" hatası verir
  - Derleyici "orphan file" hatası verir ve derleme durur
answer: 1
explanation: |
  Derleyici crate kökünden başlar ve yalnızca `mod` bildirimlerinin gösterdiği dosyaları açar. Ağaca
  bağlanmamış bir dosya, diskte dursa bile crate'in parçası değildir. `yardim::temizle()` yazarsan
  **E0433** (``cannot find module or crate `yardim` ``) alırsın. rust-analyzer de böyle dosyalar için "bu
  dosya modül ağacına dahil değil" diye uyarır. (Tek istisna: Cargo'nun crate kökü olarak tanıdığı
  dosyalar - `src/main.rs`, `src/lib.rs`, `src/bin/*.rs`, ileride göreceğin `tests/*.rs` ve
  `examples/*.rs` - kendileri bir ağacın köküdür.)
feedback:
  - Python/JS alışkanlığı! Rust'ta modül ağacına `mod` ile bağlanmayan dosya derlenmez.
  - Doğru!
  - Böyle bir hata yok; dosya sessizce yok sayılır. Bu yüzden "neden değişikliğim etki etmiyor?" sorusunun ilk cevabı genellikle eksik bir `mod` satırıdır.
```

:::deep `#[path]` özniteliği
Nadir durumlarda (örneğin üretilmiş kodu ya da platforma özel dosyaları bağlarken) varsayılan arama
kuralını `#[path = "baska/yer.rs"] mod ozel;` ile ezebilirsin. Bu bir kaçış kapısıdır; okuyanın dosyayı
bulmasını zorlaştırdığı için günlük kodda kullanılmaz. Standart düzen herkesin bildiği düzendir, bu da
onun en büyük değeridir.
:::

## Her modül bir kez bildirilir

C'de bir başlık dosyasına ihtiyaç duyan her dosya `#include` yazar; Python'da her dosya `import` yazar.
Bu alışkanlıkla Rust'a gelen herkes bir gün şunu dener:

```text
src/
├── main.rs      mod kitap; mod odunc;
├── kitap.rs     pub struct Kitap { ... }
└── odunc.rs     mod kitap;   ← Kitap'ı kullanmak için "import" etmeye çalışıyor
```

`odunc.rs` içindeki `mod kitap;` bir "içe aktarma" **değil**, yeni bir modül **bildirimidir**: "`odunc`'un
içinde `kitap` adında bir alt modül var." Derleyici bu yüzden `src/odunc/kitap.rs` dosyasını arar,
bulamaz ve E0583 verir; az önce gördüğün mesajın son satırı tam da bu durum için yazılmıştır:

```text
  = note: if there is a `mod kitap` elsewhere in the crate already, import it with `use crate::...` instead
```

Kural iki parçalı:

- **`mod` = ağaca ekle.** Her modül, ağaçtaki yerinde, **tam olarak bir kez** bildirilir (üst modülünde).
- **`use` = kısayol aç.** Bir modülü ya da öğeyi kullanmak isteyen her yer `use crate::...` (veya
  `super::...`) yazar; bunu istediğin kadar yerde yapabilirsin.

`odunc.rs`'in doğrusu `use crate::kitap::Kitap;`. Satır içi hâliyle çalıştır:

```rust
// ---- src/main.rs ----
mod kitap {
    // ---- src/kitap.rs ----
    pub struct Kitap {
        pub baslik: String,
        pub musait: bool,
    }
}

mod odunc {
    // ---- src/odunc.rs ----
    use crate::kitap::Kitap; // `mod kitap;` DEĞİL!

    pub fn odunc_ver(k: &mut Kitap) -> bool {
        if k.musait {
            k.musait = false;
            true
        } else {
            false
        }
    }
}

fn main() {
    let mut k = kitap::Kitap { baslik: String::from("Kürk Mantolu Madonna"), musait: true };
    println!("İlk deneme: {}", odunc::odunc_ver(&mut k));
    println!("İkinci deneme: {}", odunc::odunc_ver(&mut k));
    println!("'{}' müsait mi? {}", k.baslik, k.musait);
}
```

Bir sonraki soru dosya düzeniyle ilgili değil; Modül 5'teki bir kuralı hatırlatıyor:

```compiles
question: "`use` satırı bu kez doğru. Peki `odunc_ver`'in bu sürümü derlenir mi?"
code: |
  mod kitap {
      pub struct Kitap {
          pub baslik: String,
          pub musait: bool,
      }
  }

  mod odunc {
      use crate::kitap::Kitap;

      pub fn odunc_ver(k: &Kitap) {
          k.musait = false;
      }
  }

  fn main() {
      let k = kitap::Kitap { baslik: String::from("Kürk Mantolu Madonna"), musait: true };
      odunc::odunc_ver(&k);
      println!("{} müsait mi? {}", k.baslik, k.musait);
  }
answer: false
error: E0594
explanation: |
  Yollar ve gizlilik kusursuz; sorun **ödünç almada**. `&Kitap` değişmez (immutable) bir referanstır ve
  üzerinden alan değiştirilemez: **E0594 - cannot assign to `k.musait`, which is behind a `&`
  reference**. Derleyici çözümü de önerir: parametreyi `&mut Kitap` yap. Bunun için çağıran tarafta
  `let mut k` ve `odunc_ver(&mut k)` da gerekir.

  Kodu dosyalara bölmek borrow checker'ın kurallarını değiştirmez: modül sınırları **ad** ve **görünürlük**
  ile ilgilidir; sahiplik ve ödünç alma her yerde aynıdır.
```

:::warning Aynı dosyayı iki kez bildirmek
`#[path]` gibi hilelerle aynı dosyayı iki farklı `mod` satırına bağlarsan, derleyici onu **iki ayrı modül**
olarak derler: içindeki `Kitap` struct'ı da iki ayrı, birbiriyle uyumsuz tip olur
(`crate::a::Kitap` ≠ `crate::b::Kitap`). Bir modül, ağaçta tek bir yerde yaşar.
:::

## lib.rs + main.rs: ince main, kalın kütüphane

Birinci derste bir paketin hem `src/main.rs` hem `src/lib.rs` taşıyabileceğini görmüştün. Deneyimli Rust
geliştiricilerinin en sevdiği düzen budur: **bütün mantık kütüphanede, `main.rs` yalnızca ince bir
kabuk.**

```text
kutuphane/                ← paket (Cargo.toml'da name = "kutuphane")
├── Cargo.toml
└── src/
    ├── main.rs           ← binary crate: girişi alır, kütüphaneyi çağırır, sonucu yazdırır
    ├── lib.rs            ← library crate kökü: modülleri bildirir, vitrini kurar
    ├── katalog.rs
    ├── odunc.rs
    └── odunc/
        └── ceza.rs
```

```rust,ignore,title=src/lib.rs
pub mod katalog;
mod odunc; // iç ayrıntı: dışarıya yalnızca vitrin açılır

pub use odunc::ceza::gecikme_cezasi;
pub use odunc::odunc_ver;
```

```rust,ignore,title=src/main.rs
use kutuphane::katalog::Kitap; // paket adı = kütüphane crate'inin adı

fn main() {
    let mut k = Kitap::yeni("Saatleri Ayarlama Enstitüsü", "Ahmet Hamdi Tanpınar");
    kutuphane::odunc_ver(&mut k);
    println!("Ceza: {} TL", kutuphane::gecikme_cezasi(12));
}
```

Burada üç önemli ayrıntı var:

1. **`main.rs` kütüphaneyi adıyla çağırır:** `kutuphane::...`. Cargo, aynı paketteki library crate'i binary
   crate'e otomatik olarak bağımlılık gibi bağlar. Paket adında tire varsa (`kutuphane-takip`) kodda alt
   çizgiye döner: `kutuphane_takip::...`.
2. **`main.rs` modülleri yeniden bildirmez.** `main.rs`'e `mod katalog;` yazmak `katalog.rs`'i **ikinci
   kez**, bu sefer binary crate'in içinde derler: iki ayrı `Kitap` tipi ve karışıklık. Modüller
   `lib.rs`'te bildirilir, `main.rs` onları `use kutuphane::...` ile kullanır.
3. **`main.rs` için kütüphane bir yabancıdır.** İki ayrı crate oldukları için `main.rs` yalnızca `pub`
   (ve vitrinden açılmış) öğeleri görebilir. Bu bir kısıt değil, bir **armağan**: kütüphanenin dış API'si,
   ilk müşterisi olan kendi `main`'in tarafından her gün sınanır.

Neden bu kadar sevilir? Mantık kütüphanede olunca **test etmek** kolaylaşır (Modül 13'te `tests/`
klasöründeki entegrasyon testleri kütüphaneyi tam da `main.rs` gibi dışarıdan kullanır), aynı mantığı
`src/bin/` altındaki başka araçlar ya da başka projeler de kullanabilir ve `main.rs` girdi/çıktı
işleriyle sınırlı kalır.

Bu ayrımı tek dosyada taklit edelim: `kutuphane` modülü kütüphane crate'ini, `main` de binary crate'i
temsil ediyor.

```rust
mod kutuphane {
    // ---- src/lib.rs ----
    pub use odunc::ceza::gecikme_cezasi;

    pub mod katalog {
        // ---- src/katalog.rs ----
        pub struct Kitap {
            pub baslik: String,
            pub yazar: String,
        }

        impl Kitap {
            pub fn yeni(baslik: &str, yazar: &str) -> Kitap {
                Kitap { baslik: String::from(baslik), yazar: String::from(yazar) }
            }
        }
    }

    mod odunc {
        // ---- src/odunc.rs ----
        pub mod ceza {
            // ---- src/odunc/ceza.rs ----
            const GUNLUK_TL: u32 = 5;
            const TAVAN_TL: u32 = 100;

            pub fn gecikme_cezasi(gun: u32) -> u32 {
                let ceza = gun * GUNLUK_TL;
                if ceza > TAVAN_TL { TAVAN_TL } else { ceza }
            }
        }
    }
}

// ---- src/main.rs: yalnızca kütüphanenin dış API'sini kullanır ----
use kutuphane::katalog::Kitap;

fn main() {
    let k = Kitap::yeni("Saatleri Ayarlama Enstitüsü", "Ahmet Hamdi Tanpınar");
    println!("{} - {}", k.baslik, k.yazar);
    for gun in [3, 12, 40] {
        println!("{gun} gün gecikme: {} TL", kutuphane::gecikme_cezasi(gun));
    }
}
```

:::warning Taklidin bir sınırı var
Satır içi `mod kutuphane` aynı crate'in içindedir; gerçek `lib.rs`/`main.rs` ise **iki ayrı crate**. Bu
fark `pub(crate)` ile ortaya çıkar: satır içi taklitte `main`, `pub(crate)` öğeleri görebilir; gerçek
projede göremez.
:::

```quiz
question: "`src/lib.rs`'te `pub(crate) fn ic_kontrol() {}` var. `src/main.rs`'ten `kutuphane::ic_kontrol()` çağrılırsa ne olur?"
options:
  - "Çalışır, çünkü ikisi de aynı paketin içinde"
  - "Derlenmez: `main.rs` ayrı bir crate'tir ve `pub(crate)` yalnızca kütüphane crate'inin içine açıktır (E0603)"
  - "Çalışır, ama yalnızca `main.rs`'e `mod lib;` yazılırsa"
answer: 1
explanation: |
  Gizlilik sınırları **crate** düzeyindedir, paket düzeyinde değil. `pub(crate)` "bu crate'in içinde
  herkese açık" demektir; `main.rs` ise kütüphaneyi dışarıdan kullanan ayrı bir binary crate'tir. Onun
  gözünde `ic_kontrol` gizlidir: **E0603 - function `ic_kontrol` is private**. Fonksiyonu `main`'den
  çağırmak istiyorsan `pub` yapmalısın; ama önce gerçekten dış API'nin parçası mı diye düşün.
feedback:
  - Paket bir Cargo kavramıdır; derleyicinin gizlilik kuralları crate'lere bakar.
  - Doğru!
  - "`mod lib;` yazmak `lib.rs`'i binary crate'in içinde ikinci kez derler; tam da kaçınman gereken şey."
```

## Alıştırma: Çok dosyalı projeyi kur

Önce ısınma: dosya düzeni ile modül ağacını eşleştir.

```fill
prompt: |
  Aşağıdaki satır içi kod, bir mağaza projesinin modül ağacını gösteriyor. Yorumlardaki iki boşluğa
  bölündüğünde her modülün gövdesinin hangi dosyada duracağını yaz (modern biçimle, `src/` sonrası),
  son boşluğa da `kasa` modülünün `stok`'taki `Urun`'u bulmasını sağlayan yolun başını yaz.
code: |
  mod magaza { // gövdesi: src/___0
      pub mod stok { // gövdesi: src/magaza/stok.rs
          pub struct Urun {
              pub ad: String,
              pub fiyat: u32,
          }
      }

      pub mod kasa { // gövdesi: src/___1
          use ___2::stok::Urun;

          pub fn fis(u: &Urun, adet: u32) -> String {
              format!("{} x{adet} = {} TL", u.ad, u.fiyat * adet)
          }
      }
  }

  fn main() {
      let simit = magaza::stok::Urun { ad: String::from("Simit"), fiyat: 15 };
      println!("{}", magaza::kasa::fis(&simit, 4));
  }
blanks:
  - ["magaza.rs", "magaza/mod.rs"]
  - ["magaza/kasa.rs", "magaza/kasa/mod.rs"]
  - ["super", "crate::magaza"]
output: "Simit x4 = 60 TL"
explanation: |
  - `magaza` kökün çocuğudur: gövdesi `src/magaza.rs` (eski biçimle `src/magaza/mod.rs`).
  - `kasa`, `magaza`'nın çocuğudur: gövdesi `src/magaza/kasa.rs`. `src/magaza.rs` dosyası da
    `pub mod stok;` ve `pub mod kasa;` bildirimlerini taşır.
  - `kasa`'nın üst modülü `magaza`, `stok` da onun çocuğu: `use super::stok::Urun;` (ya da mutlak yol
    `crate::magaza::stok::Urun`). Bu yollar dosyalara bölündükten sonra da aynen geçerlidir.
```

Şimdi tam bir proje:

````exercise
id: m08-e-market-dosyalari
title: Market projesini modül ağacına yerleştir
difficulty: 3
prompt: |
  Bir market uygulamasının kütüphanesi dört dosyaya bölünmüş durumda:

  ```text
  src/
  ├── lib.rs            pub mod urun;  mod sepet;  pub use sepet::Sepet;
  ├── urun.rs           Urun struct'ı ve Urun::yeni
  ├── sepet.rs          pub mod indirim;  use crate::urun::Urun;  Sepet struct'ı ve metotları
  └── sepet/
      └── indirim.rs    uygula fonksiyonu
  ```

  Başlangıç kodunda biri bu dört dosyanın içeriğini **art arda yapıştırmış** (C'nin `#include`'u gibi):
  her şey crate kökünde duruyor. Görevin:

  1. Aynı modül ağacını **satır içi `mod` bloklarıyla** kur. Crate kökü `lib.rs`'i temsil ediyor: kökte
     `pub mod urun`, gizli `mod sepet` ve `pub use sepet::Sepet;` olmalı; `indirim` modülü `sepet`'in
     **içinde** `pub mod indirim` olarak durmalı.
  2. `sepet` modülünün `Urun`'u `use crate::urun::Urun;` ile bulmasını sağla.
  3. `sepet::indirim::uygula` fonksiyonunu tamamla (fiyatlar **kuruş** cinsinden):
     - toplam 100.000 kuruş (1000 TL) ve üstüyse **%15** indirim,
     - 50.000 kuruş (500 TL) ve üstüyse **%10** indirim,
     - daha azsa indirim yok.
     İndirimli tutarı tamsayı aritmetiğiyle hesapla: `toplam * 90 / 100` gibi.

  Testler `urun::Urun::yeni`, `Sepet::new` (vitrinden), `sepet::Sepet` ve `sepet::indirim::uygula`
  yollarını kullanır.
starter: |
  // ===== src/urun.rs =====
  pub struct Urun {
      pub ad: String,
      pub fiyat: u32, // kuruş
  }

  impl Urun {
      pub fn yeni(ad: &str, fiyat: u32) -> Urun {
          Urun { ad: String::from(ad), fiyat }
      }
  }

  // ===== src/sepet.rs =====
  pub struct Sepet {
      urunler: Vec<Urun>,
  }

  impl Sepet {
      pub fn new() -> Sepet {
          Sepet { urunler: vec![] }
      }

      pub fn ekle(&mut self, u: Urun) {
          self.urunler.push(u);
      }

      pub fn adet(&self) -> usize {
          self.urunler.len()
      }

      pub fn toplam(&self) -> u32 {
          let mut ham = 0;
          for u in &self.urunler {
              ham += u.fiyat;
          }
          uygula(ham)
      }
  }

  // ===== src/sepet/indirim.rs =====
  pub fn uygula(toplam: u32) -> u32 {
      todo!()
  }

  fn main() {
      let mut s = Sepet::new();
      s.ekle(Urun::yeni("Zeytinyağı 5 L", 64_000));
      println!("{} ürün, {} kuruş", s.adet(), s.toplam());
  }
solution: |
  // ===== src/urun.rs =====
  pub mod urun {
      pub struct Urun {
          pub ad: String,
          pub fiyat: u32, // kuruş
      }

      impl Urun {
          pub fn yeni(ad: &str, fiyat: u32) -> Urun {
              Urun { ad: String::from(ad), fiyat }
          }
      }
  }

  // ===== src/sepet.rs =====
  mod sepet {
      use crate::urun::Urun;

      pub struct Sepet {
          urunler: Vec<Urun>,
      }

      impl Sepet {
          pub fn new() -> Sepet {
              Sepet { urunler: vec![] }
          }

          pub fn ekle(&mut self, u: Urun) {
              self.urunler.push(u);
          }

          pub fn adet(&self) -> usize {
              self.urunler.len()
          }

          pub fn toplam(&self) -> u32 {
              let mut ham = 0;
              for u in &self.urunler {
                  ham += u.fiyat;
              }
              indirim::uygula(ham)
          }
      }

      // ===== src/sepet/indirim.rs =====
      pub mod indirim {
          pub fn uygula(toplam: u32) -> u32 {
              if toplam >= 100_000 {
                  toplam * 85 / 100
              } else if toplam >= 50_000 {
                  toplam * 90 / 100
              } else {
                  toplam
              }
          }
      }
  }

  // ===== src/lib.rs (vitrin) =====
  pub use sepet::Sepet;

  fn main() {
      let mut s = Sepet::new();
      s.ekle(urun::Urun::yeni("Zeytinyağı 5 L", 64_000));
      println!("{} ürün, {} kuruş", s.adet(), s.toplam());
  }
check: tests
tests: |
  #[test]
  fn indirim_esikleri() {
      assert_eq!(sepet::indirim::uygula(0), 0, "boş sepette tutar 0 olmalı");
      assert_eq!(sepet::indirim::uygula(49_999), 49_999, "500 TL'nin altında indirim yok");
      assert_eq!(sepet::indirim::uygula(50_000), 45_000, "tam 500 TL'de %10 indirim başlar");
      assert_eq!(sepet::indirim::uygula(99_999), 89_999, "1000 TL'nin hemen altında hâlâ %10 indirim");
      assert_eq!(sepet::indirim::uygula(100_000), 85_000, "tam 1000 TL'de %15 indirim başlar");
      assert_eq!(sepet::indirim::uygula(240_000), 204_000, "2400 TL'lik sepet %15 indirimle 2040 TL olur");
  }

  #[test]
  fn sepet_vitrinden_ve_modulunden_ayni() {
      let mut s: sepet::Sepet = Sepet::new();
      assert_eq!(s.adet(), 0, "yeni sepet boş olmalı");
      assert_eq!(s.toplam(), 0, "boş sepetin toplamı 0 olmalı");
      s.ekle(urun::Urun::yeni("Çay 1 kg", 30_000));
      assert_eq!(s.toplam(), 30_000, "300 TL'lik sepette indirim olmamalı");
  }

  #[test]
  fn sepet_toplami_indirimi_uygular() {
      let mut s = Sepet::new();
      s.ekle(urun::Urun::yeni("Çay 1 kg", 30_000));
      s.ekle(urun::Urun::yeni("Beyaz peynir", 25_000));
      assert_eq!(s.adet(), 2, "sepette 2 ürün olmalı");
      assert_eq!(s.toplam(), 49_500, "550 TL'lik sepet %10 indirimle 495 TL olur");
      s.ekle(urun::Urun::yeni("Bal", 45_000));
      assert_eq!(s.toplam(), 85_000, "1000 TL'lik sepet %15 indirimle 850 TL olur");
  }
hints:
  - |
    Her `===== src/... =====` bölümü bir modülün gövdesi. `urun.rs` → `pub mod urun { ... }`,
    `sepet.rs` → `mod sepet { ... }`. `sepet/indirim.rs` ise `sepet`'in alt modülü olduğu için
    `mod sepet { ... }` bloğunun **içine** `pub mod indirim { ... }` olarak girer.
  - |
    `sepet` modülü artık kökte değil; `Urun`'u görebilmesi için içine `use crate::urun::Urun;` ekle.
    `toplam` metodu da `uygula`'yı alt modülünden çağırmalı: `indirim::uygula(ham)`. Kökte, vitrin
    için `pub use sepet::Sepet;` satırını unutma.
  - |
    `uygula` için en büyük eşikten başla:
    `if toplam >= 100_000 { toplam * 85 / 100 } else if toplam >= 50_000 { toplam * 90 / 100 } else { toplam }`.
    `main`'deki `Urun::yeni` çağrısını da `urun::Urun::yeni` yap (ya da kökte `use urun::Urun;` yaz).
require:
  - pattern: "mod\\s+sepet\\s*\\{[\\s\\S]*pub\\s+mod\\s+indirim"
    message: "`indirim` modülü `sepet` modülünün içinde `pub mod indirim` olarak durmalı."
  - pattern: "use\\s+crate::urun::Urun"
    message: "`sepet` modülü `Urun`'u `use crate::urun::Urun;` ile getirmeli."
  - pattern: "pub\\s+use\\s+(self::|crate::)?sepet::(Sepet\\b|\\{[^}]*\\bSepet\\b)"
    message: "Kökte `pub use sepet::Sepet;` vitrini olmalı."
explanation: |
  Çözümün modül ağacı, dosya düzeninin birebir aynası:

  ```text
  crate                     ← src/lib.rs (pub use sepet::Sepet)
   ├── urun                 ← src/urun.rs
   └── sepet                ← src/sepet.rs
        └── indirim         ← src/sepet/indirim.rs
  ```

  Gerçek projede yapacağın tek şey, her `mod ad { ... }` bloğunun **içini** ilgili dosyaya taşıyıp yerine
  `mod ad;` yazmak olurdu. Yollar (`crate::urun::Urun`, `indirim::uygula`, `sepet::Sepet`) hiç değişmez.

  Gizliliğe dikkat: `sepet` kökte gizli, ama içindeki `pub mod indirim` sayesinde crate içindeki herkes
  (testler dahil) `sepet::indirim::uygula`'ya ulaşabilir. Crate'in **dışından** ise `sepet` hiç görünmez;
  dış dünya `Sepet`'i yalnızca vitrinden, crate adıyla tanır (paketin adı `market` ise `market::Sepet`).

  `uygula`'da eşikleri büyükten küçüğe sıralamak önemli: `>= 50_000` koşulunu önce yazsaydın 1000 TL'lik
  sepet de o kola düşer ve yalnızca %10 indirim alırdı. Para hesaplarını kuruş cinsinden tamsayıyla
  yapmak da kayan nokta yuvarlama hatalarından (Modül 2'deki `0.1 + 0.2`) korur. Bir sınır: `toplam * 85`
  ara sonucu `u32`'ye sığmalıdır; sepet yaklaşık 50,5 milyon kuruşu (505.000 TL) aşarsa çarpım taşar
  (debug'da panik). Gerçek bir kasada `u64` kullanmak bu riski pratikte ortadan kaldırır.
````

## Özet

:::remember
- `mod ad;` (noktalı virgüllü) = "`ad` modülünün gövdesi başka bir dosyada". Dosya bulunamazsa **E0583**.
- Alt modüller üst modülün adını taşıyan klasörde durur: kökte `mod oyun;` → `src/oyun.rs`;
  `oyun.rs` içinde `mod harita;` → `src/oyun/harita.rs`. Eski biçim `x/mod.rs`; ikisi birden → **E0761**.
- Dosyanın içine `mod ad { }` sarmalayıcısı yazılmaz; dosya **zaten** modülün gövdesidir.
- Modül ağacını `mod` bildirimleri kurar; ağaca bağlanmayan dosya derlenmez. Yollar ve gizlilik, kod
  satır içinde de dosyalarda da **aynıdır**.
- Her modül **bir kez** bildirilir (`mod`); başka yerlerden `use crate::...` ile kullanılır.
- `lib.rs` + `main.rs`: modüller `lib.rs`'te bildirilir, `main.rs` kütüphaneyi paket adıyla
  (`kutuphane::...`) kullanır ve yalnızca `pub` öğeleri görür.
:::

```reflect
prompt: |
  Python'da her `.py` dosyası kendiliğinden bir modüldür ve onu kullanmak isteyen her dosya `import`
  yazar. Rust'ta ise bir dosya ancak bir `mod` satırıyla ağaca bağlanır ve başka yerlerden `use` ile
  kullanılır. Rust'ın `mod` ile `use`'u ayırmasının ne gibi faydaları olabilir?
answer: |
  Model cevap: `mod` modül ağacının **tek bir yerde, açıkça** kurulmasını sağlar: ağacın tamamını görmek
  için crate kökünden başlayıp `mod` satırlarını izlemem yeter, diskteki rastgele dosyalar crate'e
  kendiliğinden karışmaz. Her modülün ağaçta tek bir yeri olduğu için bir tip de tek bir yerde tanımlıdır;
  aynı dosyanın iki kez yüklenip iki farklı tip oluşması engellenir. `use` ise yalnızca kısayol açtığı
  için istediğim kadar yerde, hiçbir yan etki olmadan yazılabilir. Python'da `import` hem yükleme hem
  ad bağlama işini yapar ve çalışma zamanında kod çalıştırır; Rust'ta ikisi ayrıldığı için düzen derleme
  zamanında net ve denetlenebilirdir.
```

```flashcards
- front: "`mod kutuphane;` (noktalı virgüllü) bildirimi ne anlama gelir?"
  back: "`kutuphane` modülü ağaçta var, ama gövdesi ayrı bir dosyada: `kutuphane.rs` ya da `kutuphane/mod.rs`."
- front: "`src/oyun.rs` içinde `mod harita;` yazıyor. Derleyici hangi dosyaları arar?"
  back: "`src/oyun/harita.rs` ya da `src/oyun/harita/mod.rs`."
- front: "`E0583` hatası ne zaman çıkar?"
  back: "`mod ad;` bildirimine karşılık gelen dosya bulunamadığında, file not found for module."
- front: "`src/hava.rs` dosyasının içine `mod hava { ... }` yazarsan ne olur?"
  back: "İstenmeyen bir kat oluşur: öğeler `crate::hava::hava::...` yoluna düşer. Dosya zaten modülün gövdesidir."
- front: Diskte duran ama hiçbir `mod` satırının göstermediği bir `.rs` dosyası derlenir mi?
  back: Hayır. Modül ağacını `mod` bildirimleri kurar; ağaca bağlanmayan dosya crate'in parçası değildir.
- front: "Kardeş modüldeki bir tipi kullanmak için `mod kitap;` mı yazılır, `use` mu?"
  back: "`use crate::kitap::Kitap;`, `mod` her modül için ağaçtaki yerinde yalnızca bir kez yazılır."
- front: "Aynı paketteki `src/main.rs`, `src/lib.rs`'teki kodu nasıl kullanır?"
  back: "Paket adıyla, dış bir crate gibi: `use kutuphane::katalog::Kitap;` (tireler alt çizgiye döner). Yalnızca `pub` öğeleri görür."
- front: "`E0761` hatası neyi anlatır?"
  back: "Aynı modül için hem `x.rs` hem `x/mod.rs` bulundu; birini sil ya da yeniden adlandır."
```
