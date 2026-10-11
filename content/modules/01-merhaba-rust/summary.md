# Modül 1 Özet Kartı: Merhaba Rust

## Temel fikirler

- **Derlenen dil**: Kaynak kod, çalışmadan **önce** bir kez makine koduna çevrilir (Rust, C, C++).
  **Yorumlanan dil**: Kod çalışırken çevrilir (Python, JavaScript).
- C/C++'ta bellek elle yönetilir; ciddi güvenlik açıklarının **~%70'i** bellek hatasıdır. Çöp
  toplayıcılı diller güvenlidir ama çalışma zamanında bedel öder.
- **Rust**: Bellek kurallarını **derleme zamanında** denetler → hem güvenli hem hızlı, GC yok.
- **İyi öğrenme**: önce hatırlamaya çalış, her gün biraz çalış, önce tahmin et, hatadan korkma.

## Araçlar

| Komut | Ne yapar? |
|---|---|
| `rustup update` | Rust araç zincirini en son kararlı sürüme günceller |
| `rustup doc --book` | Resmî Rust kitabını çevrimdışı açar |
| `rustc --version` / `cargo --version` | Kurulumu doğrular |
| `rustc main.rs` → `.\main.exe` | Tek dosyayı derler, programı çalıştırır |
| `cargo new ad` | `Cargo.toml`, `src/main.rs`, `.gitignore` ve git deposuyla proje oluşturur |
| `cargo check` | En hızlı denetim; makine kodu üretmez |
| `cargo build` / `cargo run` | Derler (`target\debug`) / derler ve çalıştırır |
| `cargo build --release` | Optimize derleme (`target\release`) |
| `cargo fmt` | Kodu resmî stile göre biçimlendirir (rustfmt) |
| `cargo clippy` | Şüpheli ya da iyileştirilebilecek kodu bulur |
| `rustc --explain E0425` | Bir hata kodunun uzun açıklaması |

Windows'ta Rust, **MSVC** bağlayıcısına (`link.exe`) ihtiyaç duyar: Visual Studio Build Tools'un
"Desktop development with C++" iş yükü. Editör: **VS Code + rust-analyzer**. Rusteach'te kod,
Rust kuruluysa yerelde, değilse çevrimiçi Rust Playground'da çalışır (**Ayarlar > Kod çalıştırıcı**).

## Programın iskeleti

```rust
// Satır yorumu        /* blok yorumu (iç içe olabilir) */
fn main() {
    println!("Merhaba, Dünya!"); // ! → makro; ; → deyim sonu
}
```

Kaçış dizileri: `\n` yeni satır · `\t` sekme · `\"` tırnak · `\\` ters eğik çizgi.
Metinler **çift tırnak**; tek tırnak yalnızca tek karakter içindir.

## Yer tutucular

| Yazım | Anlamı | Örnek → çıktı |
|---|---|---|
| `{}` | Sıradaki argüman | `println!("{} + {}", 2, 3)` → `2 + 3` |
| `{0}` `{1}` | Sıra numaralı (0'dan başlar) | `println!("{1} {0}", "a", "b")` → `b a` |
| `{ad}` + `ad = …` | İsimli argüman | `println!("{s}", s = "Rize")` → `Rize` |
| `{x}` | Kapsamdaki `x` değişkeni (**yalnızca ad**, ifade değil) | `{fiyat}` ✓ · `{fiyat * 2}` ✗ |
| `{:?}` | Debug (programcı için; tırnaklı) | `"Ali"` → `"Ali"` |
| `{:#?}` | Güzel (çok satırlı) Debug | - |
| `{{` `}}` | Süslü parantezin kendisi | `"{{x}}"` → `{x}` |

## Biçim belirteçleri

Yapı: **`{değer:dolgu hizalama genişlik .hassasiyet}`**

| Belirteç | Sonuç |
|---|---|
| `{:6}` | En az 6 karakter (kesmez). Metin sola, sayı sağa yaslanır |
| `{:<6}` `{:>6}` `{:^6}` | Sola / sağa / ortaya yasla |
| `{:*^9}` | `*` ile doldurarak ortala (fazla dolgu sağa) |
| `{:05}` | Sıfırla doldur: `42` → `00042`, `-42` → `-0042` |
| `{:.2}` | Ondalıkta 2 basamak (yuvarlar); metinde en fazla 2 karakter (keser) |
| `{fiyat:>10.2}` | Hepsi bir arada |
| `{:+}` `{:b}` `{:x}` `{:e}` | İşaret, ikilik, onaltılık, bilimsel |

```rust
fn main() {
    let urun = "Peynir";
    let fiyat = 189.9;
    println!("{urun:<10}{fiyat:>10.2} TL");
    println!("{:-<23}", "");
}
```

## Yazdırma makroları

| Makro | Nereye? | Satır sonu? |
|---|---|---|
| `print!` / `println!` | stdout (asıl çıktı) | Hayır / Evet |
| `eprint!` / `eprintln!` | stderr (hatalar, uyarılar) | Hayır / Evet |
| `format!` | Hiçbir yere, bir `String` döndürür | - |

`cargo run > dosya.txt` yalnızca stdout'u dosyaya yönlendirir; stderr ekranda kalır.

## Derleyici mesajları

```text
error[E0425]: cannot find value `derce` in this scope    ← düzey, kod, özet
 --> src/main.rs:5:26                                     ← dosya:satır:sütun
  |
5 |     println!("Sıcaklık: {derce} derece");
  |                          ^^^^^                        ← asıl yer (--- ilgili yerler)
help: a local variable with a similar name exists        ← öneri (çoğu zaman çözüm)
```

- **Hata** derlemeyi durdurur; **uyarı** durdurmaz ama ciddiye alınır. Kullanılmayan değişken → `_ad`.
- **İlk hatadan başla**, mesajın tamamını oku, **birer birer düzelt ve yeniden derle**. Eksik `;`
  bir sonraki satırda raporlanır.
- **Derlenmek, doğru çalışmak demek değildir**: Çıktıyı kontrol et.

| Hata | Sık nedeni | Çözüm |
|---|---|---|
| `E0601` | `main` fonksiyonu yok | `fn main() { … }` ekle |
| `E0423` | `println("…")` | `println!("…")` |
| `E0425` | Yanlış yazılmış ad | Doğru adı yaz (`help`'e bak) |
| `unclosed delimiter` | Eşi olmayan `{`, `(` ya da `[` | İşaretlenen ayracın eşini ekle |
| `character literal may only contain one codepoint` | Metni tek tırnakla yazmak | Çift tırnak kullan |
| `unknown character escape` | `"C:\Users"` gibi tek `\` | `\\` yaz |
| `expected ;` | Eksik noktalı virgül | Gösterilen yere `;` ekle |
| `2 positional arguments … but there is 1 argument` | Yer tutucu ve argüman sayısı tutmuyor | Argüman ekle ya da `{}` sil |
| `argument never used` | Fazla argüman | Yer tutucu ekle ya da argümanı sil |
| `invalid format string` | `{x * 2}` ya da tek başına `{` | İfadeyi argüman yap; `{{` kullan |
