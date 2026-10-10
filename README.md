# Rusteach

Rusteach, **Rust'ı sıfırdan uzmanlığa kadar Türkçe öğreten** bir masaüstü uygulamasıdır. İçerik; derlenebilir kod örnekleri, etkileşimli alıştırmalar ve öğrenme bilimine dayanan bir tekrar sistemiyle hazırlandı. Uygulama internet olmadan da çalışır; kodlarınızı bilgisayarınızdaki Rust ile derleyip çalıştırır.

## Neler var?

- **Yolculuk haritası:** Modüller sırayla ilerler (Merhaba Rust, değişkenler ve tipler, sahiplik, ödünç alma, yapılar, enum'lar, koleksiyonlar, hata yönetimi, generic'ler ve trait'ler…). Her ders kısa adımlara bölünmüştür.
- **Çalıştırılabilir kod:** Derslerdeki örnekleri düzenleyip çalıştırabilir, derleyici hatalarını (E0382 gibi) Türkçe açıklamalarla birlikte görebilirsiniz.
- **Etkileşimli bloklar:** Çıktı tahmini, boşluk doldurma, "derlenir mi?", Parsons (satırları sıraya dizme), çoktan seçmeli sorular, bilgi kartları ve belleği adım adım gösteren **bellek diyagramları** (yığın, öbek, sahiplik okları).
- **Oyun alanı:** Serbest kod yazıp çalıştırabileceğiniz editör (`tokio`, `serde`, `rand` gibi yaygın crate'ler dahil).
- **İlerleme ve motivasyon:** XP, seri, günlük hedef, etkinlik haritası ve istatistikler.
- **Açık/koyu tema** ve tamamen klavyeyle kullanılabilir arayüz.

## Öğrenme yaklaşımı

Rusteach, "okudum, anladım sandım" yanılgısını önlemek için kanıtlanmış yöntemleri kullanır:

| Yöntem | Uygulamada nasıl görünür? |
| --- | --- |
| **Aralıklı tekrar (spaced repetition)** | Öğrendiğiniz kartlar FSRS algoritmasıyla, unutmaya yaklaştığınız anda yeniden önünüze gelir (hedef hatırlama oranı %90). **Tekrar** sayfası bugünün kartlarını toplar. |
| **Geri çağırma pratiği (retrieval practice)** | Cevabı görmeden önce kendiniz düşünürsünüz; kartlarda önce cevabı hatırlamaya çalışır, sonra çevirirsiniz. |
| **Önce tahmin et** | Kodu çalıştırmadan çıktıyı tahmin edersiniz; yanılgılar kalıcı öğrenmenin en iyi yakıtıdır. |
| **Ustalık canavarları (boss)** | Bir modülü bitirince, o modüldeki her şeyi birlikte sınayan bir son sınav vardır. |
| **Karışık pratik (interleaving)** | **Antrenman** sayfasında farklı modüllerin soruları karıştırılır; "hangi araç ne zaman?" becerisini geliştirir. Hız turu ile akıcılık kazanırsınız. |
| **Özgüven kalibrasyonu** | Cevabınıza ne kadar güvendiğinizi işaretlersiniz; istatistiklerde gerçek başarınızla kıyaslanır. |
| **Görselleştirme** | Sahiplik ve ödünç almayı bellek diyagramlarıyla adım adım izlersiniz. |

## Kurulum

### Hazır sürümü kullanmak

`release/` klasöründeki dosyalardan birini kullanın:

- `Rusteach-Kurulum-<sürüm>.exe` – Türkçe kurulum sihirbazı (masaüstü ve başlat menüsü kısayolu oluşturur).
- `Rusteach-Tasinabilir-<sürüm>.exe` – Kurulum gerektirmez; USB belleğe kopyalayıp doğrudan çalıştırabilirsiniz.

### Kendiniz derlemek

Node.js 20 veya üstü gerekir.

```bash
npm install
npm run dist
```

Çıktılar `release/` klasörüne yazılır. Sadece paketlenmiş klasörü denemek için `npm run pack` yeterlidir (`release/win-unpacked/Rusteach.exe`).

## Bilgisayarınıza Rust kurmak (önerilir)

Uygulama **iki şekilde** kod çalıştırabilir:

1. **Yerel Rust (önerilen):** Hızlıdır, internet gerektirmez, `stdin` desteği vardır ve crate'ler bilgisayarınızda derlenir.
2. **Çevrimiçi (Rust Playground):** Rust kurulu değilse uygulama otomatik olarak buna geçer. Çalışır, ama internet ister, yavaş olabilir ve `stdin` desteklemez.

Sağ üstteki durum rozeti hangisinin kullanıldığını gösterir (Yerel Rust / Çevrimiçi / Rust bulunamadı).

### Windows'ta adım adım

1. **Visual Studio Build Tools** indirin: <https://visualstudio.microsoft.com/visual-cpp-build-tools/>. Kurarken **"Desktop development with C++"** (C++ ile masaüstü geliştirme) iş yükünü seçin. Rust'ın Windows (MSVC) bağlayıcısı buna ihtiyaç duyar.
2. **rustup** kurun: <https://rustup.rs> adresinden `rustup-init.exe` dosyasını indirip çalıştırın ve varsayılan seçeneği (1) onaylayın.
3. Rusteach'i kapatıp yeniden açın (ya da durum rozetine tıklayıp yeniden denetleyin). Rozet "Yerel Rust" olmalıdır.
4. Kontrol için bir terminalde `rustc --version` ve `cargo --version` komutlarını çalıştırabilirsiniz. Uygulama Rust 1.85 veya üstünü (edition 2024) gerektirir; eski sürüm için `rustup update` yeterlidir.

Not: `tokio`, `serde`, `rand`, `regex` gibi crate'leri kullanan örneklerin **ilk** derlemesi birkaç dakika sürebilir (bu bir kez yapılır); sonraki çalıştırmalar hızlıdır. Bu sırada indirme için internet gerekir.

## Etkili çalışma önerileri

1. **Her gün kısa çalışın.** 20 dakikalık günlük seans, haftada bir 3 saatlik maratondan çok daha kalıcıdır.
2. **Önce Tekrar'a bakın.** Günlük kartlarınızı yeni derse geçmeden bitirin; sıra bu yüzden önemlidir.
3. **Önce tahmin edin, sonra çalıştırın.** Çıktıyı tahmin etmeden Çalıştır'a basmayın.
4. **Hata yapmaktan çekinmeyin.** Derleyici hatası okumak Rust öğrenmenin en büyük parçasıdır; hata kodlarını sözlükten inceleyin.
5. **Kodu kendi elinizle yazın.** Kopyalamak yerine örnekleri değiştirip bozmayı ve düzeltmeyi deneyin.
6. **Haftada bir Antrenman yapın.** Karışık pratik ve Hız turu eski konuları taze tutar.
7. **Boss'ları atlamayın.** Takıldığınız konu, modülün Özet Kartı'ndan ve ilgili derslerden tekrar edilebilir.

## Klavye kısayolları

| Kısayol | Nerede | Ne yapar? |
| --- | --- | --- |
| `Ctrl` + `Enter` | Kod editörü, çıktı tahmini, yansıtma alanları | Kodu çalıştır / cevabı kontrol et |
| `Ctrl` + `Shift` + `Enter` | Kod editörü | İkincil eylem (örneğin yalnızca derle / test) |
| `Ctrl` + `B` | Her yer (yazı alanları dışında) | Kenar çubuğunu daralt / genişlet |
| `1` `2` `3` `4` | Çoktan seçmeli sorular, bilgi kartı notlama | Seçeneği seç / kartı derecelendir (Tekrar, 1 = Yeniden … 4 = Kolay) |
| `Boşluk` / `Enter` | Bilgi kartları, tekrar oturumu | Kartı çevir / cevabı göster |
| `Enter` | Sorularda, antrenman ve tekrar ekranlarında | Kontrol et, sonraki soruya geç, oturumu başlat |
| `Tab` | Boşluk doldurma | Boşluklar arasında gezin |
| Oklar, `Boşluk` | Parsons ve diyagram adımları | Satırı tut, taşı, adım adım ilerle / geri git |
| `Esc` | Pencereler, açılır paneller | Kapat |
| `F11` | Her yer | Tam ekran |
| `Ctrl` + `+` / `Ctrl` + `-` / `Ctrl` + `0` | Her yer | Yakınlaştır / uzaklaştır / gerçek boyut |

## İlerlemeniz nerede saklanır? Yedekleme

Tüm ilerlemeniz (tamamlanan dersler, XP, tekrar kartları, ayarlar) **yalnızca bilgisayarınızda**, uygulamanın kullanıcı verisi klasöründe tutulur:

```
%APPDATA%\Rusteach
```

Hiçbir veri sunucuya gönderilmez. Kod, yalnızca çevrimiçi çalıştırma kullanılırken Rust Playground'a gönderilir.

**Yedeklemek için:** `Ayarlar` sayfasından ilerlemeyi **dışa aktarın** (bir `.json` dosyası kaydedilir). Başka bir bilgisayara geçerken ya da uygulamayı yeniden kurarken aynı sayfadan **içe aktararak** devam edebilirsiniz. Önemli bir ilerlemeden önce düzenli yedek almanız önerilir.

## Geliştirici komutları

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | İçeriği derler, Vite ve Electron'u birlikte geliştirme modunda başlatır |
| `npm run web` | Yalnızca tarayıcıda çalıştırır (yerel Rust yok; Playground kullanılır) |
| `npm run content` | `content/modules/` altındaki Markdown dersleri `src/generated/content.json` olarak derler (`--with-examples` ile demo modülü ekler) |
| `npm run verify` | Derslerdeki Rust kod bloklarını gerçek derleyiciyle doğrular (Rust kurulu olmalı) |
| `npm run typecheck` | TypeScript tip denetimi |
| `npm run test:runner` | Yerel çalıştırıcının testleri (Rust gerektirmez, Playground ile çalışır) |
| `npm run smoke` | Derlenmiş uygulamayı açıp konsol hatası olup olmadığını denetler |
| `npm run build` | İçerik + tip denetimi + Vite derlemesi |
| `npm run pack` | Paketlenmiş (kurulumsuz) klasör: `release/win-unpacked` |
| `npm run dist` | Kurulum sihirbazı ve taşınabilir `.exe` üretir |
| `npm run icon` | `build/icon.svg` dosyasından simgeleri yeniden üretir |

Proje yapısı için `docs/ARCHITECTURE.md`, ders yazım kuralları için `CONTENT_SPEC.md` dosyalarına bakın. Electron katmanı `electron/` klasöründedir (`main.cjs`, `preload.cjs`, `runner.cjs`).

İyi öğrenmeler!
