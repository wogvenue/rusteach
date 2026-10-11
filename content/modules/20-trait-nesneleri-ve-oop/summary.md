# Özet Kartı: Trait Nesneleri ve OOP Desenleri

Rust'ta **nesne = veri (struct/enum) + davranış (impl)**. Kapsülleme var (`pub` / gizli alanlar, modül
düzeyinde gizlilik), **kalıtım yok**. Kod paylaşımı: trait'lerin **varsayılan metotları** + **kompozisyon**
(bileşeni alan olarak tutmak). Çok biçimlilik: **generic'ler** (statik) ve **trait nesneleri** (dinamik).

## Çok biçimliliği seçmek

| | Generic / `impl Trait` | `dyn Trait` | Enum |
|---|---|---|---|
| Tip kümesi | Her kullanımda tek tip | **Açık**, karışık | **Kapalı**, karışık |
| Dispatch | Statik (monomorphization) | Dinamik (vtable) | `match` |
| Maliyet | Sıfır; kod kopyası, derleme süresi | Dolaylı çağrı, inlining yok, genelde `Box` | Sıfır; en büyük varyant kadar yer |
| Yeni tip eklemek | Kolay | Kolay (yeni `impl`) | Enum'ı değiştir; `match`'ler E0004 verir |
| Yeni işlem eklemek | Trait'i değiştir | Trait'i değiştir | Kolay (yeni fonksiyon) |

## Trait nesneleri

```rust
trait Ciz {
    fn ciz(&self) -> String;
}

struct Daire;
struct Kare;

impl Ciz for Daire {
    fn ciz(&self) -> String {
        String::from("○")
    }
}

impl Ciz for Kare {
    fn ciz(&self) -> String {
        String::from("□")
    }
}

fn goster(s: &dyn Ciz) -> String {
    s.ciz() // vtable üzerinden dinamik çağrı
}

fn main() {
    let sekiller: Vec<Box<dyn Ciz>> = vec![Box::new(Daire), Box::new(Kare)];
    for s in &sekiller {
        print!("{} ", goster(s.as_ref()));
    }
    println!();
}
```

- `dyn Trait` **boyutsuzdur**: hep bir işaretçinin arkasında (`&dyn`, `&mut dyn`, `Box<dyn>`, `Rc<dyn>`).
  `Vec<dyn Ciz>` → **E0277**.
- Trait nesnesi işaretçisi **geniş işaretçidir**: veri ptr + vtable ptr = 16 bayt (64 bit).
- Vtable: metot işaretçileri + drop fonksiyonu + boyut + hizalama. Tip başına bir tane, salt okunur bellekte.
- Ek sınırlar: `Box<dyn Trait + Send>`, `&(dyn Trait + 'static)`.

## dyn uyumluluğu (E0038)

Vtable kurulamıyorsa trait `dyn` olamaz. Sorunlu metotlar:

| sorun | örnek | çare |
|---|---|---|
| Generic metot | `fn kaydet<T>(&self, x: T)` | `&dyn Debug` al ya da `where Self: Sized` |
| `Self` döndürmek/almak | `fn kopya(&self) -> Self` | `where Self: Sized` ya da `-> Box<dyn Trait>` |
| `self`'siz fonksiyon | `fn yeni() -> Self` | `where Self: Sized` |
| `Self: Sized` süper trait | `trait T: Clone` | clone_box deseni |

`where Self: Sized` metodu vtable'dan çıkarır: trait dyn uyumlu olur, metot yalnızca somut tiplerde çağrılır.
Somut tipe geri dönmek gerekirse son çare: `&dyn Any` + `downcast_ref::<T>()`.

## Durum deseni ve typestate

| | `Option<Box<dyn Durum>>` | Typestate (durum = tip) | Enum durum makinesi |
|---|---|---|---|
| Geçersiz geçiş | Çalışma zamanında yutulur | **Derlenmez** (E0599) | Çalışma zamanında ele alınır |
| Maliyet | Heap + vtable | Sıfır | Sıfır |
| Ne zaman? | Açık küme, karmaşık bağımsız durumlar | API sırası derleme zamanında belli | Durum çalışırken değişiyor, küme kapalı |

```rust,ignore
// Durum deseni: &mut self arkasındaki kutuyu tüketmek
fn onayla(&mut self) {
    if let Some(d) = self.durum.take() {   // doğrudan self.durum.onayla() → E0507
        self.durum = Some(d.onayla());     // fn onayla(self: Box<Self>) -> Box<dyn Durum>
    }
}

// Typestate: geçiş eski durumu tüketir; başarısızsa geri verir
impl KilitliKasa {
    fn ac(self, sifre: &str) -> Result<AcikKasa, KilitliKasa> { /* ... */ }
}
```

## Builder, newtype ve Default

```rust
#[derive(Debug, Default)]
struct Ayar {
    port: u16,
    ad: String,
    hizli: bool,
}

struct Kurucu {
    ayar: Ayar,
}

impl Kurucu {
    fn new() -> Self {
        Kurucu { ayar: Ayar { port: 8080, ..Default::default() } }
    }
    fn ad(mut self, ad: &str) -> Self {
        self.ayar.ad = ad.to_string(); // tüketen builder: mut self -> Self
        self
    }
    fn kur(self) -> Result<Ayar, String> {
        if self.ayar.ad.is_empty() {
            return Err(String::from("ad zorunlu")); // doğrulama tek kapıda
        }
        Ok(self.ayar)
    }
}

pub struct Yuzde(u8); // newtype: alan gizli → değişmezin kanıtı

impl Yuzde {
    pub fn new(d: u8) -> Option<Yuzde> {
        if d <= 100 { Some(Yuzde(d)) } else { None }
    }

    pub fn deger(&self) -> u8 {
        self.0
    }
}

fn main() {
    if let Ok(a) = Kurucu::new().ad("api").kur() {
        println!("{}:{} hızlı={}", a.ad, a.port, a.hizli);
    }
    let oran = Yuzde::new(40).map(|y| y.deger());
    println!("{oran:?}");
}
```

- `#[derive(Default)]`: sayılar 0, `bool` false, `String`/`Vec` boş, `Option` `None`. Enum'da `#[default]`.
- `..Default::default()` güvenli; `..baska_deger` ise yazılmayan alanları **taşır** (kısmi taşıma, E0382).
- Tüketen builder (`mut self -> Self`): alanlar taşınır. Tüketmeyen (`&mut self -> &mut Self`): koşullu ayar
  kolay, yeniden kullanılabilir; `let k = Kurucu::new().ayar(..);` → **E0716**.
- Newtype: sıfır maliyet (`size_of::<Metre>() == size_of::<f64>()`), “parse, don't validate”, orphan
  kuralını (E0117) aşar. Değişmezli newtype'a `DerefMut` verme.

## Strateji, RAII koruyucuları, uzantı trait'leri

| desen | Rust'taki biçimi |
|---|---|
| Strateji | `S: Strateji` (derleme zamanı) · `Box<dyn Strateji>` (çalışma zamanı) · `impl Fn` / `Box<dyn Fn>` |
| RAII koruyucusu | Kurulunca başlat, `Drop`'ta geri al; `return`, `?` ve panikte de çalışır |
| Uzantı trait'i | `trait MetinExt { .. } impl MetinExt for str { .. }`; kullanmak için `use` (yoksa E0599) |

```rust
struct Koruyucu(&'static str);

impl Drop for Koruyucu {
    fn drop(&mut self) {
        println!("bırak {}", self.0);
    }
}

fn main() {
    let _ = Koruyucu("A"); // HEMEN drop edilir!
    let _b = Koruyucu("B"); // kapsam sonuna kadar yaşar
    println!("iş");
}
```

- `&mut` tutan koruyucu yaşarken asıl nesneye dokunulamaz (E0502/E0499): derleme zamanı yalıtımı.
- `Drop` uygulayan tipten alan taşınamaz (E0509) → “onaylandı” bayrağı kullan.
- `mem::forget` güvenlidir: bellek güvenliği hiçbir zaman Drop'un çalışmasına bağlanmaz.
- Blanket uzantı: `impl<I: Iterator<Item = u32>> OrtalamaExt for I { .. }` (ör. `Itertools`, `StreamExt`).

## GoF desenleri → Rust

Iterator → `Iterator` · Strategy/Command → closure ya da trait · Template Method → varsayılan metot ·
State → enum / typestate · Visitor → enum + `match` · Decorator → sarmalayıcı tip, iterator adaptörü ·
Adapter → newtype, `From` · Factory → `new`/`from`/`default` · Prototype → `Clone` · Singleton → parametre
olarak geçir (gerekirse `OnceLock`/`LazyLock`) · Observer → callback listesi ya da kanal.

## Sık hatalar

| hata | anlamı | çözüm |
|---|---|---|
| E0277 (`dyn T` boyutsuz) | `Vec<dyn T>`, `fn f(x: dyn T)` | `Box<dyn T>` / `&dyn T` |
| E0038 | Trait dyn uyumlu değil | Generic metodu/`Self` dönüşünü düzelt, `where Self: Sized` |
| E0507 | `&mut self` arkasındaki alanı taşımak | `Option::take()` / `mem::take` |
| E0599 | Metot yok: yanlış typestate ya da trait kapsamda değil | Doğru duruma geç / `use Trait;` |
| E0716 | Geçici kurucuya referans tutmak | Önce `let mut k = Kurucu::new();` |
| E0117 | Yabancı trait + yabancı tip | Newtype sarmalayıcı |
| E0509 | `Drop` tipinden alan taşımak | Bayrak / `Option::take` |
