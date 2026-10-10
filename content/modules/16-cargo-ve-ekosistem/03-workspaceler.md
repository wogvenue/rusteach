---
id: m16-l03
title: Workspace'ler
minutes: 22
type: lesson
objectives:
  - "Birden çok crate'i `[workspace]` ve `members` ile tek bir workspace'te toplayıp ortak `Cargo.lock` ve `target/` klasörünün faydasını açıklayabilmek"
  - "Üyeler arasında `path` bağımlılığı kurabilmek ve `[workspace.package]` / `[workspace.dependencies]` ile ortak ayarları miras alabilmek"
  - "`-p`, `--workspace` ve `default-members` ile Cargo komutlarını doğru üyede çalıştırabilmek"
  - "`cargo tree` ve `cargo update` ile bağımlılık ağacını inceleyip kilit dosyasını bilinçli güncelleyebilmek"
keywords: [workspace, members, path dependency, Cargo.lock, cargo tree, cargo update, resolver, monorepo, -p]
---

Kahve dükkânın için yazdığın `kahve-takip` programı büyüdü. Artık üç parçası var: kasada çalışan bir
**komut satırı aracı**, siparişleri telefondan alan bir **web sunucusu** ve ikisinin de kullandığı fiyat
hesabı, menü, sipariş tipleri gibi **ortak bir çekirdek kütüphane**. Bunları üç ayrı Cargo projesi
olarak tutarsan çok geçmeden şu sorunlarla karşılaşırsın:

- Her projede ayrı bir `target/` klasörü olur ve `serde` gibi ortak bağımlılıklar **üç kez** derlenir.
  Bu da hem diskte gigabaytlar hem de beklemekle geçen dakikalar demektir.
- Her projenin kendi `Cargo.lock`'u olur ve sürümler zamanla ayrışır. Web sunucusu `serde 1.0.219`
  kullanırken CLI hâlâ `1.0.190`'da kalır.
- Çekirdekte bir değişiklik yaptığında diğer iki projeyi elle güncellemen gerekir.

Bu derste Cargo'nun bu soruna cevabını öğreneceksin: **workspace**.

## Bir çatı altında birden çok crate

Bir **workspace**, aynı `Cargo.lock` dosyasını ve aynı `target/` klasörünü **paylaşan** paketler
topluluğudur. Her üye kendi `Cargo.toml`'u, kendi `src/`'si ve kendi bağımlılıklarıyla bağımsız bir
pakettir; ama derleme altyapısını ortak kullanır.

```text
kahve/
├── Cargo.toml            ← workspace kökü (üyeleri listeler)
├── Cargo.lock            ← TEK kilit dosyası, tüm üyeler için
├── target/               ← TEK derleme klasörü
├── kahve-cekirdek/
│   ├── Cargo.toml
│   └── src/lib.rs
├── kahve-cli/
│   ├── Cargo.toml
│   └── src/main.rs
└── kahve-web/
    ├── Cargo.toml
    └── src/main.rs
```

Paylaşımın üç somut faydası var:

1. **Bir kez derle**: `kahve-cli` ve `kahve-web` aynı `serde` sürümünü istiyorsa, `serde` ortak `target/`
   içinde **bir kez** derlenir ve ikisi de onu kullanır.
2. **Tutarlı sürümler**: Tek bir `Cargo.lock` olduğu için uyumlu sürüm aralığındaki her bağımlılık tüm
   workspace'te **aynı** tam sürüme kilitlenir. "CLI'da çalışıyor, sunucuda çalışmıyor" türü sürpriz
   azalır.
3. **Birlikte değişim**: Çekirdekte bir fonksiyonun imzasını değiştirdiğinde `cargo build` onu kullanan
   tüm üyeleri hemen yeniden derler; neyin kırıldığını aynı anda görürsün.

:::analogy Apartman
Ayrı Cargo projeleri, her birinin kendi kazanı, kendi su sayacı ve kendi yönetim defteri olan müstakil
evler gibidir. Workspace ise bir apartmandır: her dairenin (üyenin) kendi odaları ve kendi eşyaları
vardır, ama **kalorifer kazanı** (`target/`) ortaktır ve binanın **tek bir yönetim defteri**
(`Cargo.lock`) vardır. Bina kurallarını (profiller, Ders 1) yalnızca yönetim koyar; bir dairenin kapısına
astığı "kural" binayı bağlamaz.
:::

```quiz
question: "Bir workspace'teki üyeler aşağıdakilerden hangisini **paylaşmaz**?"
options:
  - "`Cargo.lock` dosyasını"
  - "`target/` derleme klasörünü"
  - "`[dependencies]` listesini: her üye kendi bağımlılıklarını kendi `Cargo.toml`'unda yazar"
  - "Profil ayarlarını (`[profile.release]` yalnızca kökte tanımlanır)"
answer: 2
explanation: |
  Her üye bağımsız bir pakettir: `kahve-web` bir web çatısına bağımlı olabilir, `kahve-cli` ise olmayabilir.
  Ortak olan, **derleme altyapısıdır**: tek `Cargo.lock`, tek `target/` ve kökte tanımlanan profiller.
  Bağımlılıkların **tanımını** da paylaşmak mümkün (`[workspace.dependencies]`); ama her üye yine de
  hangisini kullanacağını kendisi söyler. Bunu birazdan göreceksin.
feedback:
  - Kilit dosyası workspace kökünde tektir.
  - Derleme klasörü workspace kökünde tektir.
  - Doğru!
  - Ders 1'de gördüğün gibi profiller yalnızca kök `Cargo.toml`'dan okunur.
```

## Workspace kurmak

Workspace kökündeki `Cargo.toml`'da `[package]` tablosu yoksa ona **sanal manifest** (*virtual
manifest*) denir; tek işi üyeleri listelemektir:

```toml
# kahve/Cargo.toml
[workspace]
resolver = "3"
members = ["kahve-cekirdek", "kahve-cli", "kahve-web"]
```

`members` listesi glob kalıplarını da kabul eder: `members = ["crates/*"]` yazarsan `crates/` altındaki
her klasör bir üye olur. `resolver = "3"`, Cargo'ya bağımlılıkları edition 2024'ün kurallarıyla
çözmesini söyler. Paket manifestlerinde bu değer `edition`'dan otomatik çıkar; ama sanal manifestin bir
`edition`'ı olmadığı için açıkça yazman gerekir, yoksa Cargo eski çözümleyiciyi seçip seni uyarır.

Üyeleri oluşturmak için kök klasörde `cargo new` yeterli. Güncel Cargo, yeni paketi `members` listesine
kendisi ekler:

```console
PS C:\projeler\kahve> cargo new --lib kahve-cekirdek
    Creating library `kahve-cekirdek` package
      Adding `kahve-cekirdek` as member of workspace at `C:\projeler\kahve`
PS C:\projeler\kahve> cargo new kahve-cli
    Creating binary (application) `kahve-cli` package
      Adding `kahve-cli` as member of workspace at `C:\projeler\kahve`
```

### Üyeler arası bağımlılık: path

`kahve-cli`'nin çekirdeği kullanabilmesi için ona sıradan bir bağımlılık gibi bağımlı olur; tek fark,
sürüm yerine **yol (path)** verir:

```toml
# kahve/kahve-cli/Cargo.toml
[package]
name = "kahve-cli"
version = "0.1.0"
edition = "2024"

[dependencies]
kahve-cekirdek = { path = "../kahve-cekirdek" }
```

Kodda ise çekirdek, crates.io'dan gelmiş herhangi bir crate gibi kullanılır: `use kahve_cekirdek::fiyat;`
(tire yine alt çizgiye dönüşür). Aşağıdaki programda üç crate'i tek dosyada **modüllerle taklit
ediyoruz**. Gerçek workspace'te `crate::kahve_cekirdek` yerine doğrudan `kahve_cekirdek` yazarsın:

```rust
// Gerçekte bunlar üç ayrı crate; burada tek dosyada modüllerle taklit ediyoruz.
mod kahve_cekirdek {
    pub struct Siparis {
        pub icecek: String,
        pub boy: char,
    }

    /// Kuruş cinsinden fiyat.
    pub fn fiyat(s: &Siparis) -> u32 {
        let taban = match s.icecek.as_str() {
            "latte" => 9000,
            "filtre" => 6500,
            _ => 7500,
        };
        match s.boy {
            'B' => taban + 1500,
            'K' => taban - 1000,
            _ => taban,
        }
    }
}

mod kahve_cli {
    // Gerçek workspace'te: use kahve_cekirdek::{fiyat, Siparis};
    use crate::kahve_cekirdek::{fiyat, Siparis};

    pub fn calistir() {
        let s = Siparis { icecek: String::from("latte"), boy: 'B' };
        let f = fiyat(&s);
        println!("[kasa] {} ({}) → {},{:02} TL", s.icecek, s.boy, f / 100, f % 100);
    }
}

mod kahve_web {
    use crate::kahve_cekirdek::{fiyat, Siparis};

    pub fn yanit() -> String {
        let s = Siparis { icecek: String::from("filtre"), boy: 'K' };
        format!("[web] {{\"icecek\":\"{}\",\"fiyat\":{}}}", s.icecek, fiyat(&s))
    }
}

fn main() {
    kahve_cli::calistir();
    println!("{}", kahve_web::yanit());
}
```

Fiyat kuralını değiştirdiğinde iki "uygulama" da bir sonraki derlemede yeni kuralı kullanır. Workspace'in
gerçek hayattaki karşılığı tam olarak bu.

:::warning Yayınlanacak crate'lerde path tek başına yetmez
crates.io'daki bir crate, senin diskindeki `../kahve-cekirdek` klasörüne ulaşamaz. Bu yüzden yalnızca
`path` içeren bir bağımlılıkla `cargo publish` reddedilir. Hem yerel geliştirme hem yayın için ikisini
birlikte yaz:

```toml
kahve-cekirdek = { path = "../kahve-cekirdek", version = "0.1.0" }
```

Yerelde Cargo `path`'i kullanır; yayında ise bu satır crates.io'daki `0.1.0` sürümüne işaret edecek
biçimde yazılır. Önce çekirdeği, sonra ona bağımlı olanları yayınlarsın.
:::

:::info Diğer dillerde
Bu yapıya genel olarak **monorepo** denir. JavaScript'te npm/pnpm workspaces, Java'da Maven'in çok modüllü
projeleri, .NET'te bir `.sln` altındaki projeler benzer bir rol oynar. Rust'ın farkı, bunun dile ve
araca en baştan gömülü olmasıdır: ek bir araç kurmadan Cargo ile gelir. Rust derleyicisinin kendisi,
Tokio, Bevy ve Servo gibi dev projeler de birer Cargo workspace'idir.
:::

## Ortak ayarları miras almak

Üç üyenin üçü de `edition = "2024"`, aynı lisans ve aynı `serde` sürümünü kullanıyorsa bunları üç kez
yazmak hem sıkıcıdır hem de ayrışmaya davetiye çıkarır. Workspace kökü bu tanımları bir kez yapar,
üyeler **miras alır**:

```toml
# kahve/Cargo.toml
[workspace]
resolver = "3"
members = ["kahve-cekirdek", "kahve-cli", "kahve-web"]

[workspace.package]
version = "0.3.0"
edition = "2024"
license = "MIT OR Apache-2.0"
rust-version = "1.85"

[workspace.dependencies]
serde = "1.0.219"
kahve-cekirdek = { path = "kahve-cekirdek", version = "0.3.0" }

[workspace.lints.rust]
unsafe_code = "forbid"

[profile.release]
lto = "thin"
```

```toml
# kahve/kahve-web/Cargo.toml
[package]
name = "kahve-web"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
serde = { workspace = true, features = ["derive"] }
kahve-cekirdek = { workspace = true }

[lints]
workspace = true
```

- `version.workspace = true`, "bu değeri workspace kökündeki `[workspace.package]`'dan al" demektir.
- `serde = { workspace = true, features = ["derive"] }`: Sürüm kökten gelir; üye isterse üstüne
  **özellik (feature)** ekleyebilir (Ders 4). Ama sürümü değiştiremez: tek bir yerde tanımlamanın amacı da bu.
- `[workspace.lints]` lint seviyelerini (Ders 5) tüm üyelere uygular.
- `[profile.release]` yalnızca burada, kökte yazılır.

```quiz
question: |
  `kahve-cli/Cargo.toml` içinde `serde = { workspace = true, version = "1.0.150" }` yazıldı. Ne olur?
options:
  - Cargo, `kahve-cli` için `1.0.150`'yi, diğer üyeler için kökteki sürümü kullanır
  - "Cargo üyedeki `version`'ı yok sayar (`unused manifest key: dependencies.serde.version` uyarısı verir); sürüm yine kökten gelir"
  - "Kökteki `[workspace.dependencies]` girdisi `1.0.150` olarak güncellenir"
  - İki farklı `serde` sürümü indirilir ve ikisi de kullanılır
answer: 1
explanation: |
  `workspace = true`, tanımın tamamen kökten geldiği anlamına gelir. Üye yalnızca **ekleyici** ayarlar
  yapabilir: `features` eklemek ya da bağımlılığı `optional` yapmak gibi. Bunların dışındaki anahtarları
  Cargo tanımaz; derlemeyi durdurmaz ama `unused manifest key` uyarısıyla onları görmezden gelir. Bu
  yüzden bu uyarıyı ciddiye al: yazdığın satır sandığın işi yapmıyor demektir. Sürümü, kaynağı (`path`,
  `git`) ya da `default-features`'ı değiştirmek istiyorsan ya kökteki tanımı değiştirirsin ya da o üyede
  miras almayı bırakıp tam bir tanım yazarsın.
feedback:
  - "Miras alınan bağımlılıkta sürüm üyede yeniden tanımlanamaz; Cargo bu `version`'ı görmezden gelir."
  - Doğru!
  - Üye dosyaları kökü asla değiştirmez.
  - "Workspace'te `serde`'nin tek bir tanımı var; üyedeki `version` hiç dikkate alınmaz."
```

## Komutları doğru üyede çalıştırmak

Bir workspace'te Cargo komutlarının hangi üyelere uygulanacağını seçebilirsin:

| Komut | Etkisi |
|---|---|
| `cargo build` (sanal manifestli kökte) | tüm üyeleri derler |
| `cargo build --workspace` | her durumda tüm üyeleri derler |
| `cargo build -p kahve-cekirdek` | yalnızca o üyeyi (ve ihtiyaç duyduklarını) derler |
| `cargo run -p kahve-cli` | o binary'yi derleyip çalıştırır |
| `cargo test --workspace` | tüm üyelerin testlerini çalıştırır |
| `cargo test -p kahve-cekirdek fiyat` | o üyede adında `fiyat` geçen testleri çalıştırır |

`-p` (`--package`) bayrağı Cargo'ya hangi paketin kastedildiğini söyler. Bir üyenin klasörüne girip
(`cd kahve-cli`) komut çalıştırırsan Cargo da varsayılan olarak o üyeyi seçer; ama `target/` ve
`Cargo.lock` yine kökte ortak kalır.

Kökte bayraksız `cargo run` yazarsan ne olur?

```console
PS C:\projeler\kahve> cargo run
error: `cargo run` could not determine which binary to run. Use the `--bin` option to specify a binary,
or the `default-run` manifest key.
available binaries: kahve-cli, kahve-web
PS C:\projeler\kahve> cargo run -p kahve-web
   Compiling kahve-cekirdek v0.3.0 (C:\projeler\kahve\kahve-cekirdek)
   Compiling kahve-web v0.3.0 (C:\projeler\kahve\kahve-web)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.31s
     Running `target\debug\kahve-web.exe`
```

İlk komut başarısız oldu, çünkü workspace'te iki binary var ve Cargo hangisini istediğini tahmin
etmiyor. `-p` ile seçince sorun kalmadı. Bayraksız komutların varsayılan hedefini kökte belirleyebilirsin:

```toml
[workspace]
members = ["kahve-cekirdek", "kahve-cli", "kahve-web"]
default-members = ["kahve-cli"]
```

Artık kökteki bayraksız `cargo build`, `cargo test` ve `cargo run` yalnızca `kahve-cli` ile (ve onun
ihtiyaç duyduğu çekirdekle) ilgilenir; diğer üyeler için yine `-p` ya da `--workspace` kullanırsın.

```quiz
question: |
  Sanal manifestli `kahve` workspace'inin kökündesin. Yalnızca çekirdek kütüphanenin testlerini çalıştırmak
  istiyorsun. Hangi komut doğrudur?
options:
  - "`cargo test`"
  - "`cargo test -p kahve-cekirdek`"
  - "`cargo test --workspace kahve-cekirdek`"
  - "`cargo test --bin kahve-cekirdek`"
answer: 1
explanation: |
  `-p kahve-cekirdek` komutu o pakete sınırlar. Sanal manifestli kökte bayraksız `cargo test` tüm üyelerin
  testlerini çalıştırır (yanlış değil, ama istediğinden fazla). `--workspace`'ten sonra gelen ad bir
  paket değil, **test adı filtresi** olarak yorumlanır (Modül 13). `kahve-cekirdek` bir kütüphane olduğu
  için `--bin` ile seçilemez.
feedback:
  - Bu tüm üyelerin testlerini çalıştırır.
  - Doğru!
  - "Buradaki `kahve-cekirdek` paket değil, test adı filtresi olur."
  - "Kütüphanenin bir binary'si yok; `--bin` burada işe yaramaz."
```

## Bağımlılık ağacı: cargo tree ve cargo update

Workspace'in tek bir `Cargo.lock`'u olduğundan, hangi crate'in hangi sürümünün **neden** projede olduğunu
merak edeceksin. `cargo tree` bunu bir ağaç olarak çizer. Gerçek çıktıya bakmadan önce, aynı işi yapan
küçük bir programla mantığını tahmin et:

```predict
code: |
  use std::collections::{HashMap, HashSet};

  fn agac_yaz<'a>(
      paket: &'a str,
      bag: &HashMap<&'a str, Vec<&'a str>>,
      derinlik: usize,
      goruldu: &mut HashSet<&'a str>,
  ) {
      let ilk_kez = goruldu.insert(paket);
      let isaret = if ilk_kez { "" } else { " (*)" };
      println!("{}{paket}{isaret}", "  ".repeat(derinlik));
      if !ilk_kez {
          return;
      }
      if let Some(altlar) = bag.get(paket) {
          for &alt in altlar {
              agac_yaz(alt, bag, derinlik + 1, goruldu);
          }
      }
  }

  fn main() {
      let bag = HashMap::from([
          ("kahve-web", vec!["kahve-cekirdek", "serde"]),
          ("kahve-cekirdek", vec!["serde"]),
      ]);
      let mut goruldu = HashSet::new();
      agac_yaz("kahve-web", &bag, 0, &mut goruldu);
  }
options:
  - |
    kahve-web
      kahve-cekirdek
        serde
      serde (*)
  - |
    kahve-web
      kahve-cekirdek
        serde
      serde
  - |
    kahve-web
      kahve-cekirdek (*)
        serde
      serde
answer: 0
explanation: |
  `HashSet::insert` (Modül 9) değer kümede **yoksa** ekleyip `true`, zaten varsa `false` döndürür.
  `serde` ilk kez çekirdeğin altında görülür ve normal yazılır. `kahve-web`'in doğrudan bağımlılığı olarak
  ikinci kez karşımıza çıktığında artık kümede olduğu için `(*)` ile işaretlenir ve alt ağacı tekrar
  açılmaz. `cargo tree` da tam olarak bunu yapar: aynı alt ağacı defalarca basmak yerine `(*)` der.
```

Gerçek `cargo tree` çıktısı da aynı mantıkla okunur (kısaltılmış):

```console
PS C:\projeler\kahve> cargo tree -p kahve-web
kahve-web v0.3.0 (C:\projeler\kahve\kahve-web)
├── kahve-cekirdek v0.3.0 (C:\projeler\kahve\kahve-cekirdek)
│   ├── rand v0.10.3
│   │   └── rand_core v0.10.0
│   └── serde v1.0.219
│       └── serde_derive v1.0.219 (proc-macro)
├── eski-grafik v1.2.0
│   └── rand v0.8.5
│       └── rand_core v0.6.4
└── serde v1.0.219 (*)
```

En kullanışlı bayraklar:

| Komut | Sorduğu soru |
|---|---|
| `cargo tree -i rand` | **Kim** `rand`'a bağımlı? (ters ağaç, *invert*) |
| `cargo tree -d` | Hangi crate'ten **birden çok sürüm** var? (*duplicates*) |
| `cargo tree -e features` | Hangi özellik (feature) kimin yüzünden açık? (Ders 4) |
| `cargo tree --depth 1` | Yalnızca doğrudan bağımlılıklar |

Yukarıdaki ağaçta `rand`'ın iki sürümü var: `0.10.3` ve `0.8.5`. Bu bir hata değil. Modül 8'deki semver
kuralına göre `0.8` ile `0.10` **uyumsuz** sürümlerdir, bu yüzden Cargo ikisini birden derler. Aynı
uyumluluk aralığındaki istekler ise tek bir sürümde **birleştirilir**:

```rust
use std::collections::BTreeMap;

// Cargo'nun "aynı uyumluluk aralığı" anahtarı: 1.x.y → "1", 0.10.y → "0.10"
fn uyumluluk_anahtari(surum: &str) -> String {
    let parcalar: Vec<&str> = surum.split('.').collect();
    if parcalar[0] != "0" {
        parcalar[0].to_string()
    } else {
        format!("0.{}", parcalar[1])
    }
}

fn main() {
    let istekler = [
        ("kahve-cekirdek", "rand", "0.10.1"),
        ("kahve-web", "rand", "0.10.3"),
        ("eski-grafik", "rand", "0.8.5"),
        ("kahve-cli", "serde", "1.0.200"),
        ("kahve-web", "serde", "1.0.219"),
    ];

    let mut kopyalar: BTreeMap<(&str, String), Vec<&str>> = BTreeMap::new();
    for (isteyen, krate, surum) in istekler {
        kopyalar.entry((krate, uyumluluk_anahtari(surum))).or_default().push(isteyen);
    }

    for ((krate, anahtar), isteyenler) in &kopyalar {
        println!("{krate} ({anahtar}) → tek kopya, isteyenler: {isteyenler:?}");
    }
}
```

Çıktıda `rand` için iki satır, `serde` için tek satır görürsün: `1.0.200` ve `1.0.219` isteyen iki üye
aynı `serde` kopyasını paylaşır. Birden çok kopya derleme süresini ve binary boyutunu artırır, ayrıca iki
sürümün tipleri birbirine karışmaz (`rand 0.8`'in bir tipi `rand 0.10` bekleyen bir fonksiyona
verilemez). `cargo tree -d` bu kopyaları bulmanın yoludur.

### cargo update: kilidi bilinçli açmak

`Cargo.lock` sürümleri kilitler; peki ne zaman güncellenir? **Yalnızca sen istediğinde**:

```console
PS C:\projeler\kahve> cargo update -p serde
    Updating crates.io index
     Locking 1 package to latest compatible version
    Updating serde v1.0.219 -> v1.0.228
PS C:\projeler\kahve> cargo update -p serde --precise 1.0.219   # belirli bir sürüme dön
PS C:\projeler\kahve> cargo update                               # her şeyi güncelle
```

`cargo update`, `Cargo.toml`'daki sürüm gereksinimlerine **dokunmaz**; yalnızca o gereksinimlerin izin
verdiği aralıkta `Cargo.lock`'u en yeni sürümlere taşır. `"1.0.219"` gereksinimi `2.0.0`'a asla
yükseltilmez; büyük sürüm atlamak için `Cargo.toml`'u kendin değiştirirsin.

```quiz
question: "`Cargo.toml`'da `rand = \"0.8\"` yazıyor ve `Cargo.lock`'ta `rand 0.8.3` kilitli. crates.io'da `0.8.5` ve `0.10.3` var. `cargo update -p rand` sonrası ne olur?"
options:
  - "`rand` `0.10.3`'e yükselir, çünkü en yeni sürüm odur"
  - "`rand` `0.8.5`'e yükselir; `0.10` `^0.8` aralığının dışındadır"
  - "Hiçbir şey olmaz; `cargo update` yalnızca `Cargo.toml`'u değiştirir"
  - "`Cargo.toml`'daki satır `rand = \"0.8.5\"` olarak güncellenir"
answer: 1
explanation: |
  `"0.8"` gereksinimi `^0.8` demektir: `>=0.8.0, <0.9.0` (Modül 8). `cargo update` bu aralıktaki en yeni
  sürümü, `0.8.5`'i seçer ve yalnızca `Cargo.lock`'u değiştirir. `0.10.3`'e geçmek kırıcı bir değişikliği
  kabul etmek demektir; bunu `Cargo.toml`'daki gereksinimi değiştirerek sen yaparsın.
feedback:
  - "`0.10` ile `0.8` semver'e göre uyumsuzdur; Cargo onu kendiliğinden seçmez."
  - Doğru!
  - Tam tersi; `cargo update` yalnızca `Cargo.lock`'u değiştirir.
  - "`cargo update` `Cargo.toml`'a dokunmaz."
```

````exercise
id: m16-e-kopya-avcisi
title: Kopya sürüm avcısı
difficulty: 3
prompt: |
  `cargo tree --prefix none` komutu ağacı girintisiz, her satırda bir paket olacak şekilde yazar:

  ```text
  kahve-web v0.3.0 (C:\projeler\kahve\kahve-web)
  rand v0.10.3
  rand_core v0.10.0
  serde v1.0.219
  rand v0.8.5
  serde v1.0.219 (*)
  ```

  `kopyalari_bul(cikti: &str)` fonksiyonunu yaz. Fonksiyon **birden fazla farklı sürümü** olan
  paketleri, `cargo tree -d` gibi, bulur:

  - Her satırın ilk kelimesi paket adı, ikincisi başında `v` olan sürümdür. Boş satırları atla.
  - Aynı sürüm birden çok kez görünebilir (ör. `(*)` satırları); bunlar **tek** sürüm sayılır.
  - Sonuç, paket adına göre alfabetik sıralı `(ad, sürümler)` listesidir. Sürümler `v` olmadan ve
    **sayısal olarak** küçükten büyüğe sıralanır: `0.8.5`, `0.10.3`'ten önce gelir (metin olarak
    sıralasaydın tersi olurdu!).
starter: |
  pub fn kopyalari_bul(cikti: &str) -> Vec<(String, Vec<String>)> {
      todo!()
  }

  fn main() {
      let cikti = "kahve-web v0.3.0 (C:\\projeler\\kahve\\kahve-web)
  rand v0.10.3
  serde v1.0.219
  rand v0.8.5
  serde v1.0.219 (*)";
      for (ad, surumler) in kopyalari_bul(cikti) {
          println!("{ad}: {}", surumler.join(", "));
      }
  }
solution: |
  use std::collections::BTreeMap;

  fn sayisal(surum: &str) -> Vec<u64> {
      surum.split('.').map(|p| p.parse().unwrap_or(0)).collect()
  }

  pub fn kopyalari_bul(cikti: &str) -> Vec<(String, Vec<String>)> {
      let mut paketler: BTreeMap<String, Vec<String>> = BTreeMap::new();
      for satir in cikti.lines() {
          let mut kelimeler = satir.split_whitespace();
          let (Some(ad), Some(surum)) = (kelimeler.next(), kelimeler.next()) else {
              continue;
          };
          let surum = surum.trim_start_matches('v').to_string();
          let liste = paketler.entry(ad.to_string()).or_default();
          if !liste.contains(&surum) {
              liste.push(surum);
          }
      }

      let mut sonuc = Vec::new();
      for (ad, mut surumler) in paketler {
          if surumler.len() > 1 {
              surumler.sort_by_key(|s| sayisal(s));
              sonuc.push((ad, surumler));
          }
      }
      sonuc
  }

  fn main() {
      let cikti = "kahve-web v0.3.0 (C:\\projeler\\kahve\\kahve-web)
  rand v0.10.3
  serde v1.0.219
  rand v0.8.5
  serde v1.0.219 (*)";
      for (ad, surumler) in kopyalari_bul(cikti) {
          println!("{ad}: {}", surumler.join(", "));
      }
  }
check: tests
tests: |
  fn s(liste: &[&str]) -> Vec<String> {
      liste.iter().map(|x| x.to_string()).collect()
  }

  #[test]
  fn iki_rand_surumu_bulunur() {
      let cikti = "kahve-web v0.3.0 (C:\\kahve\\kahve-web)\nrand v0.10.3\nrand_core v0.10.0\nserde v1.0.219\nrand v0.8.5\nrand_core v0.6.4\nserde v1.0.219 (*)";
      let sonuc = kopyalari_bul(cikti);
      assert_eq!(
          sonuc,
          vec![
              ("rand".to_string(), s(&["0.8.5", "0.10.3"])),
              ("rand_core".to_string(), s(&["0.6.4", "0.10.0"])),
          ],
          "rand ve rand_core ikişer sürümle gelmeli; serde tek sürümdür ((*) satırı yeni sürüm değildir)"
      );
  }

  #[test]
  fn kopya_yoksa_bos_liste() {
      let cikti = "kahve-cli v0.3.0 (C:\\kahve\\kahve-cli)\nserde v1.0.219\nserde v1.0.219 (*)\n";
      assert_eq!(kopyalari_bul(cikti), vec![], "aynı sürümün tekrarı kopya değildir");
      assert_eq!(kopyalari_bul(""), vec![], "boş çıktıda kopya yoktur");
  }

  #[test]
  fn surumler_sayisal_siralanir() {
      let cikti = "syn v2.0.100\n\nsyn v1.0.109\nsyn v2.0.9\n";
      assert_eq!(
          kopyalari_bul(cikti),
          vec![("syn".to_string(), s(&["1.0.109", "2.0.9", "2.0.100"]))],
          "2.0.9 sayısal olarak 2.0.100'den küçüktür; boş satır atlanmalı"
      );
  }
hints:
  - "`cikti.lines()` ile satırları, `split_whitespace()` ile kelimeleri gez. İlk iki kelimeyi `next()` ile al; biri yoksa satırı atla."
  - "Sonuç zaten ada göre sıralı olsun istiyorsan `BTreeMap<String, Vec<String>>` kullan (Modül 9). Sürümü eklemeden önce `contains` ile tekrarını kontrol et; `trim_start_matches('v')` baştaki `v`'yi atar."
  - "Sayısal sıralama için sürümü `split('.')` ile parçalayıp her parçayı `u64`'e çeviren bir yardımcı yaz ve `sort_by_key(|s| sayisal(s))` kullan: `Vec<u64>`'ler de soldan sağa karşılaştırılır."
explanation: |
  Çözümün iki kritik noktası var. Birincisi **tekrar ile kopyayı ayırmak**: `(*)` satırı aynı sürümün
  tekrar görünmesidir, yeni bir kopya değildir; `contains` kontrolü bunu eler. İkincisi **sayısal
  sıralama**: metin olarak `"0.10.3" < "0.8.5"`'tir, çünkü `'1' < '8'`. Sürümleri `Vec<u64>`'e çevirip
  sıralamak doğru sonucu verir; `Vec`'ler de tuple'lar gibi sözlük sırasıyla karşılaştırılır.

  `let (Some(ad), Some(surum)) = (..., ...) else { continue; };` Modül 7'deki `let else`'in bir tuple
  deseniyle kullanımıdır: iki kelimeden biri eksikse satır sessizce atlanır.

  Gerçek hayatta bu bilgiyi kendin ayrıştırmazsın: `cargo tree -d` doğrudan kopyaları gösterir, `cargo
  metadata` ise tüm ağacı JSON olarak verir. Ama bir CI betiğinde "aynı crate'in iki sürümü varsa uyar"
  gibi bir kural yazmak istersen, mantık tam olarak budur.
````

## Alıştırma: Derleme sırası

Cargo bir workspace'i derlerken önce **bağımlılıkları** derler: `kahve-cli` çekirdeğe bağımlıysa çekirdek
önce derlenmelidir. Bağımsız crate'ler ise paralel derlenebilir. Peki iki crate birbirine bağımlı olursa?
Cargo bunu kesinlikle reddeder (kısaltılmış):

```console
error: cyclic package dependency: package `kahve-cekirdek v0.3.0 (C:\projeler\kahve\kahve-cekirdek)` depends on itself. Cycle:
package `kahve-cekirdek v0.3.0 (C:\projeler\kahve\kahve-cekirdek)`
    ... which satisfies path dependency `kahve-cekirdek` of package `kahve-cli v0.3.0 (...)`
    ... which satisfies path dependency `kahve-cli` of package `kahve-cekirdek v0.3.0 (...)`
```

Döngü hiçbir zaman derlenemez: hangisini önce derlesen, diğerinin hazır olması gerekir. Çözüm, ortak
kısmı **yeni bir crate'e** çıkarıp ikisinin de ona bağımlı olmasını sağlamaktır.

```exercise
id: m16-e-derleme-sirasi
title: Workspace derleme sırası
difficulty: 4
prompt: |
  Cargo'nun yaptığı işin küçük bir versiyonunu yaz: `derleme_sirasi(uyeler)` her üyenin adını ve
  workspace içindeki bağımlılıklarını alır, üyelerin **hangi sırayla derleneceğini** döndürür.

  - Her üye, bağımlı olduğu tüm üyelerden **sonra** gelmelidir.
  - Aynı anda derlenmeye hazır birden çok üye varsa **alfabetik olarak ilki** seçilir (sonuç
    tek ve tahmin edilebilir olsun).
  - Listede olmayan bir üyeye bağımlılık varsa → `Err("bilinmeyen üye: <ad>")`
  - Bağımlılıklar bir döngü oluşturuyorsa → döngüdeki üyelerden en az birinin adını içeren bir `Err`.

  Örnek: `[("kahve-cli", vec!["kahve-cekirdek"]), ("kahve-cekirdek", vec![])]` →
  `Ok(vec!["kahve-cekirdek", "kahve-cli"])`
starter: |
  pub fn derleme_sirasi(uyeler: &[(&str, Vec<&str>)]) -> Result<Vec<String>, String> {
      todo!()
  }

  fn main() {
      let uyeler = [
          ("kahve-web", vec!["kahve-cekirdek", "kahve-sablon"]),
          ("kahve-sablon", vec!["kahve-cekirdek"]),
          ("kahve-cli", vec!["kahve-cekirdek"]),
          ("kahve-cekirdek", vec![]),
      ];
      println!("{:?}", derleme_sirasi(&uyeler));
  }
solution: |
  use std::collections::{BTreeMap, BTreeSet};

  pub fn derleme_sirasi(uyeler: &[(&str, Vec<&str>)]) -> Result<Vec<String>, String> {
      // Her üyenin henüz derlenmemiş bağımlılık sayısı
      let mut bekleyen: BTreeMap<&str, usize> = BTreeMap::new();
      // bagimli_olanlar[x] = x'e bağımlı olan üyeler
      let mut bagimli_olanlar: BTreeMap<&str, Vec<&str>> = BTreeMap::new();

      for (ad, _) in uyeler {
          bekleyen.insert(*ad, 0);
      }
      for (ad, bagimliliklar) in uyeler {
          let ad = *ad;
          for &b in bagimliliklar {
              if !bekleyen.contains_key(b) {
                  return Err(format!("bilinmeyen üye: {b}"));
              }
              *bekleyen.get_mut(ad).unwrap() += 1;
              bagimli_olanlar.entry(b).or_default().push(ad);
          }
      }

      let mut hazir: BTreeSet<&str> = bekleyen
          .iter()
          .filter(|(_, sayi)| **sayi == 0)
          .map(|(ad, _)| *ad)
          .collect();
      let mut sira = Vec::new();

      while let Some(ad) = hazir.pop_first() {
          sira.push(ad.to_string());
          if let Some(liste) = bagimli_olanlar.get(ad) {
              for &bagimli in liste {
                  let sayi = bekleyen.get_mut(bagimli).unwrap();
                  *sayi -= 1;
                  if *sayi == 0 {
                      hazir.insert(bagimli);
                  }
              }
          }
      }

      if sira.len() < uyeler.len() {
          let dongudekiler: Vec<&str> = bekleyen
              .iter()
              .filter(|(_, sayi)| **sayi > 0)
              .map(|(ad, _)| *ad)
              .collect();
          return Err(format!("döngüsel bağımlılık: {}", dongudekiler.join(", ")));
      }
      Ok(sira)
  }

  fn main() {
      let uyeler = [
          ("kahve-web", vec!["kahve-cekirdek", "kahve-sablon"]),
          ("kahve-sablon", vec!["kahve-cekirdek"]),
          ("kahve-cli", vec!["kahve-cekirdek"]),
          ("kahve-cekirdek", vec![]),
      ];
      println!("{:?}", derleme_sirasi(&uyeler));
  }
check: tests
tests: |
  fn s(liste: &[&str]) -> Vec<String> {
      liste.iter().map(|x| x.to_string()).collect()
  }

  #[test]
  fn basit_zincir() {
      let uyeler = [("kahve-cli", vec!["kahve-cekirdek"]), ("kahve-cekirdek", vec![])];
      assert_eq!(derleme_sirasi(&uyeler), Ok(s(&["kahve-cekirdek", "kahve-cli"])), "çekirdek, ona bağımlı CLI'dan önce derlenmeli");
  }

  #[test]
  fn elmas_bagimlilik_ve_alfabetik_secim() {
      let uyeler = [
          ("kahve-web", vec!["kahve-cekirdek", "kahve-sablon"]),
          ("kahve-sablon", vec!["kahve-cekirdek"]),
          ("kahve-cli", vec!["kahve-cekirdek"]),
          ("kahve-cekirdek", vec![]),
      ];
      assert_eq!(
          derleme_sirasi(&uyeler),
          Ok(s(&["kahve-cekirdek", "kahve-cli", "kahve-sablon", "kahve-web"])),
          "çekirdekten sonra cli ve sablon hazır olur (alfabetik: önce cli); web en son"
      );
  }

  #[test]
  fn bagimsiz_uyeler_alfabetik() {
      let uyeler = [("zeytin", vec![]), ("armut", vec![]), ("muz", vec!["armut"])];
      assert_eq!(derleme_sirasi(&uyeler), Ok(s(&["armut", "muz", "zeytin"])), "muz armut'tan hemen sonra hazır olur ve zeytin'den önce gelir");
      assert_eq!(derleme_sirasi(&[]), Ok(vec![]), "boş workspace'in derleme sırası boştur");
  }

  #[test]
  fn dongu_reddedilir() {
      let uyeler = [("a-cekirdek", vec!["b-cli"]), ("b-cli", vec!["a-cekirdek"]), ("c-araclar", vec![])];
      let sonuc = derleme_sirasi(&uyeler);
      let hata = sonuc.expect_err("döngüsel bağımlılık Err döndürmeli");
      assert!(hata.contains("a-cekirdek") || hata.contains("b-cli"), "hata mesajı döngüdeki bir üyeyi anmalı, gelen: {hata}");
  }

  #[test]
  fn bilinmeyen_uye_reddedilir() {
      let uyeler = [("kahve-cli", vec!["kahve-yok"])];
      assert_eq!(derleme_sirasi(&uyeler), Err("bilinmeyen üye: kahve-yok".to_string()));
  }
hints:
  - "Her üye için **kaç bağımlılığının henüz derlenmediğini** tut. Bağımlılık sayısı 0 olanlar derlenmeye hazırdır."
  - "Hazır üyeleri bir `BTreeSet`'te tut: `pop_first()` sana her zaman alfabetik olarak ilkini verir. Bir üyeyi sıraya ekleyince, ona bağımlı olan her üyenin sayacını 1 azalt; sayaç 0'a düşen hazır kümesine girer."
  - "Döngü nasıl anlaşılır? Hazır küme boşaldığında hâlâ sıraya girmemiş üye varsa, onların sayaçları hiç 0'a düşmeyecek demektir: onlar döngünün içindedir (ya da ona bağımlıdır). `bilinmeyen üye` kontrolünü en başta, bağımlılıkları sayarken yap."
explanation: |
  Bu algoritmanın adı **topolojik sıralama** (Kahn algoritması). Bir grafiğin düğümlerini, her ok
  "önce şu" diyecek biçimde sıraya dizer. Cargo, derleme planını kurarken ve hangi crate'lerin paralel
  derlenebileceğine karar verirken aynı fikri kullanır: sayacı aynı anda 0 olan crate'ler birbirini
  beklemeden ayrı çekirdeklerde derlenebilir.

  `BTreeSet::pop_first()` hem "hazır olanlardan birini al" hem de "alfabetik olarak ilkini al" işini tek
  adımda yapar ve sonucu deterministik kılar. `BTreeMap` de sayaçların ve hata mesajındaki listenin
  sıralı olmasını sağlar.

  Döngü tespiti bedavaya gelir: hazır küme boşaldığında sıraya girmemiş üye kaldıysa, onların hiçbiri
  bağımlılıklarının tamamlanmasını asla göremeyecektir. Cargo'nun `cyclic package dependency` hatası da
  özünde bu gözlemdir.
```

## Özet

:::remember
- **Workspace** = tek `Cargo.lock` + tek `target/` paylaşan paketler. Kökte `[workspace]` ve `members`; sanal manifestte `resolver = "3"` yaz.
- Üyeler arası bağımlılık: `ad = { path = "../ad" }`; yayınlanacaksa `version` de ekle.
- `[workspace.package]` (`version.workspace = true`), `[workspace.dependencies]` (`serde = { workspace = true }`), `[workspace.lints]` ile ortak ayarları tek yerde tanımla. Profiller yalnızca kökte.
- Komutlar: `-p uye` tek üye, `--workspace` hepsi, `default-members` bayraksız komutların hedefi.
- `cargo tree` ağacı gösterir: `-i` kim bağımlı, `-d` kopya sürümler, `(*)` = daha önce gösterildi.
- `cargo update` yalnızca `Cargo.lock`'u ve yalnızca `Cargo.toml`'un izin verdiği aralıkta günceller; `-p` ve `--precise` ile hedeflenir.
:::

```reflect
prompt: |
  Bir arkadaşın "üç projeyi tek workspace'e koymak yerine ayrı depolarda tutalım, daha bağımsız olurlar"
  diyor. Workspace'in hangi somut sorunları çözdüğünü ve hangi durumda ayrı projelerin daha mantıklı
  olabileceğini açıkla.
answer: |
  Model cevap: Workspace ortak bağımlılıkları bir kez derler (tek `target/`), tüm üyeleri aynı kilitli
  sürümlerde tutar (tek `Cargo.lock`) ve çekirdekteki bir değişikliğin kimleri kırdığını tek `cargo build`
  ile gösterir; ortak sürüm, lisans ve bağımlılık tanımları da tek yerde durur. Ayrı projeler ise
  parçalar gerçekten bağımsız yaşıyorsa daha mantıklıdır: farklı ekipler, farklı yayın takvimleri ya da
  birbirini hiç kullanmayan kodlar. O durumda ortak kilit dosyası bir fayda değil, gereksiz bir bağ olur.
```

```flashcards
- front: Bir workspace'teki üyeler hangi iki şeyi paylaşır?
  back: "Tek `Cargo.lock` ve tek `target/` klasörü (profiller de yalnızca kökten okunur)."
- front: Sanal manifest (virtual manifest) nedir?
  back: "`[package]` tablosu olmayan, yalnızca `[workspace]` ve `members` içeren kök `Cargo.toml`."
- front: "`kahve-cli`, aynı workspace'teki `kahve-cekirdek`'e nasıl bağımlı olur?"
  back: "`kahve-cekirdek = { path = \"../kahve-cekirdek\" }` (yayınlanacaksa `version = \"...\"` da eklenir)."
- front: Bir üye, kökteki `[workspace.dependencies]` tanımını nasıl kullanır?
  back: "`serde = { workspace = true }`; isterse `features` ekleyebilir ama sürümü değiştiremez."
- front: Workspace kökünde yalnızca `kahve-web` binary'sini çalıştıran komut?
  back: "`cargo run -p kahve-web`"
- front: "`cargo tree` çıktısında `(*)` ne demektir?"
  back: Bu paketin alt ağacı daha önce gösterildi; tekrar açılmıyor.
- front: Hangi crate'ten birden çok sürüm olduğunu ve kimin `rand`'a bağımlı olduğunu gösteren komutlar?
  back: "`cargo tree -d` (kopyalar) ve `cargo tree -i rand` (ters ağaç)."
- front: "`cargo update -p serde` `Cargo.toml`'u değiştirir mi?"
  back: "Hayır. Yalnızca `Cargo.lock`'ta `serde`'yi, `Cargo.toml`'daki gereksinimin izin verdiği en yeni sürüme taşır."
```
