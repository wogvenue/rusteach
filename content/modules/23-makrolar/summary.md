# Özet Kartı: Makrolar

## Makro mu, fonksiyon mu?

| | Fonksiyon | `macro_rules!` | Prosedürel makro |
|---|---|---|---|
| Girdi | tipli değerler | token'lar (desenle eşleşir) | `TokenStream` (Rust koduyla işlenir) |
| Ne zaman çalışır | çalışma anında | derleme anında | derleme anında, derleyicinin içinde |
| Argüman sayısı | sabit | değişken | değişken |
| Nerede tanımlanır | her yerde | **kullanımdan önce** | ayrı `proc-macro` crate'inde |
| Bedel | yok | okunurluk, dolaylı hatalar | ayrı crate, derleme süresi, zor ayıklama |

**Merdiven:** fonksiyon → generic + trait → `macro_rules!` → prosedürel makro. Alt basamak yetiyorsa yukarı çıkma.

## `macro_rules!` sözdizimi

```rust
macro_rules! sepet {
    (@adet) => { 1 };                                   // iç kurallar: @ ile, EN ÜSTTE
    (@adet $n:expr) => { $n };
    ( $( $urun:literal $( x $adet:expr )? ),* $(,)? ) => {{   // {{ }} = blok ifadesi üret
        #[allow(unused_mut)]
        let mut liste: Vec<(&str, u32)> = Vec::new();
        $( liste.push(($urun, sepet!(@adet $( $adet )?))); )*
        liste
    }};
}

fn main() {
    println!("{:?}", sepet!["simit" x 4, "çay"]); // [("simit", 4), ("çay", 1)]
}
```

- Kollar **yukarıdan aşağıya** denenir, **ilk uyan** kazanır → özel kollar üstte, `$($t:tt)*` en altta.
- `$` ile başlamayan her token **birebir** aranır (`km`, `lira`, `=>`).
- `()`, `[]`, `{}` ile çağrı eşdeğerdir (gelenek: fonksiyon / koleksiyon / blok-öğe).
- Makro **kodu** kopyalar, değeri değil: `$x`'i iki kez kullanacaksan önce `let a = $x;`.

## Fragment belirteçleri

| Belirteç | Yakalar | Arkasından gelebilir |
|---|---|---|
| `expr`, `stmt` | ifade / deyim | yalnızca `=>` `,` `;` |
| `pat` | desen (`A \| B` dahil) | `=>` `,` `=` `if` `in` |
| `ty`, `path` | tip / yol | `=>` `,` `=` `\|` `;` `:` `>` `[` `{` `as` `where` |
| `ident`, `literal`, `tt`, `block`, `lifetime`, `item`, `meta` | isim, sabit (`-7` dahil), token ağacı, blok, `'a`, öğe, attribute içi | **her şey** |
| `vis` | `pub`, `pub(crate)` veya **boş** | `,`, isim, tip başlangıcı |

## Tekrarlar

| Yazım | Anlam |
|---|---|
| `$( $x:expr ),*` | virgülle ayrılmış 0+ |
| `$( $x:expr );+` | noktalı virgülle ayrılmış 1+ |
| `$( x $n:expr )?` | 0 veya 1 (ayırıcı alamaz) |
| `$(,)?` | sondaki virgül serbest |
| `0 $( + $x )*` | dönüştürücüde sabit token'larla tekrar |

Tekrar değişkeni dönüştürücüde **aynı derinlikte** bir `$( )` içinde kullanılır; aynı tekrardaki değişkenler aynı sayıda olmalı.

## Hijyen, kapsam, paylaşım

- **Hijyen (karma):** makronun yerel değişkenleri ve döngü etiketleri çağıranınkilerle **karışmaz**;
  makro çağıranın değişkenlerini **göremez** (`E0425`) → değişkeni `$v:ident` olarak ver.
- Fonksiyonlar, tipler, modüller, yollar **çağrı yerinde** çözülür → `$crate::yardimci()` ve `::std::...` kullan.
- Modül içinden dışarı: tanımdan sonra `pub(crate) use ad;`. Crate dışına: `#[macro_export]` (crate köküne yerleşir).
- Özyineleme sınırı **128**: `#![recursion_limit = "256"]`.
- **TT munching:** baştan birkaç token ye, kalanı + biriktiriciyi makroya yeniden ver:
  `(@adim $acc:expr ; arti $x:literal $($k:tt)*) => { m!(@adim ($acc + $x) ; $($k)*) }`.

## Yaygın hatalar

| Mesaj | Sebep → çözüm |
|---|---|
| `no rules expected ...` | hiçbir kol uymadı → çağrıyı ya da kolları düzelt |
| `unexpected end of macro invocation` | eksik girdi / sondaki virgül → `$(,)?` |
| `` `$x:expr` is followed by ... `` | follow-set ihlali → `,` ekle, sırayı değiştir ya da `literal`/`tt` kullan |
| `variable 'x' is still repeating at this depth` | `$x` tekrarın dışında → `$( ... )*` içine al |
| `recursion limit reached while expanding` | temel durum yok ya da genel kol iç kurallardan önce |
| `cannot find macro ... in this scope` | tanımdan önce kullanım ya da içe aktarılmamış |
| `E0425 ... not accessible due to macro hygiene` | makro çağıranın değişkenine dokunmaya çalıştı → `ident` olarak ver |

**Ayıklama:** `cargo expand` (nightly kurulu olmalı), editörde *Expand macro*, `stringify!(...)`, hata kolu için `compile_error!(...)`.

## Prosedürel makrolar

| Tür | Attribute | İmza | Kullanım |
|---|---|---|---|
| Derive | `#[proc_macro_derive(Ad)]` | `fn(TokenStream) -> TokenStream` | `#[derive(Ad)]`; tanımın **yanına** ekler |
| Attribute | `#[proc_macro_attribute]` | `fn(ayar, oge) -> TokenStream` | `#[ad(...)]`; öğeyi **yeniden yazar** |
| Fonksiyon benzeri | `#[proc_macro]` | `fn(TokenStream) -> TokenStream` | `ad!(...)` |

```toml
[lib]
proc-macro = true    # bu crate yalnızca makro açabilir → trait ayrı crate'te

[dependencies]
syn = "2"            # ayrıştır (ItemFn için features = ["full"])
quote = "1"          # üret
```

```rust,ignore
#[proc_macro_derive(MerhabaMakro)]
pub fn merhaba_makro_derive(girdi: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(girdi as DeriveInput);              // 1) ayrıştır
    let isim = &ast.ident;                                            // 2) bilgiyi çıkar
    let (impl_gen, tip_gen, where_k) = ast.generics.split_for_impl();
    quote! {                                                          // 3) üret
        impl #impl_gen MerhabaMakro for #isim #tip_gen #where_k {
            fn merhaba_makro() { println!("Merhaba! Benim adım {}!", stringify!(#isim)); }
        }
    }
    .into()
}
```

- `quote!`: `#degisken` gömer, `#( ... ),*` tekrarlar; `format_ident!` yeni isim üretir.
- Hata: `syn::Error::new_spanned(oge, "mesaj").to_compile_error()` (panik değil).
- `quote!` hijyensizdir (`Span::call_site`) → tam yollar ve çakışmayan isimler kullan.
- Test: dönüşümü `proc_macro2::TokenStream` alan bir fonksiyona koy; derleme hataları için `trybuild`.
