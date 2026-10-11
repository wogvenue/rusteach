// "Günün ipucu" - short, evidence-based learning tips shown on the dashboard.
export interface LearningTip {
  icon: string;
  title: string;
  body: string;
  source?: string;
}

export const TIPS: LearningTip[] = [
  {
    icon: '🗓️',
    title: 'Aralıklı tekrar',
    body: 'Bir konuyu tek oturumda uzun uzun çalışmak yerine günlere yay. Bilgiyi tam unutmak üzereyken hatırlamak, onu en çok güçlendiren şeydir. Tekrar bölümü bu zamanlamayı senin için hesaplar.',
    source: 'Cepeda ve ark., 2006',
  },
  {
    icon: '🧠',
    title: 'Okuma, hatırla',
    body: 'Notları yeniden okumak tanıdık hissettirir ama yanıltıcıdır. Cevaba bakmadan önce hatırlamaya çalışmak, öğrendiğini hem ölçer hem de kalıcı hale getirir.',
    source: 'Roediger ve Karpicke, 2006',
  },
  {
    icon: '😴',
    title: 'Uyku da çalışmanın parçası',
    body: 'Beyin gün içinde öğrendiklerini uykuda pekiştirir. Gece yarısı bir ders daha yerine iyi bir uyku, ertesi gün daha çok şey hatırlamanı sağlar.',
    source: 'Stickgold, 2005',
  },
  {
    icon: '🔀',
    title: 'Karışık çalış',
    body: 'Farklı konulardan soruları karışık çözmek daha zor gelir ama hangi aracı ne zaman kullanacağını ayırt etmeyi öğretir. Antrenman bölümü soruları bilerek karıştırır.',
    source: 'Rohrer ve Taylor, 2007',
  },
  {
    icon: '🗣️',
    title: 'Sesli açıkla',
    body: 'Bir kavramı birine anlatıyormuş gibi kendi cümlelerinle açıkla. Takıldığın yer, henüz tam anlamadığın yerdir; orası tam da çalışman gereken yer.',
    source: 'Chi ve ark., 1994',
  },
  {
    icon: '🐞',
    title: 'Hatalar öğretmendir',
    body: 'Yanlış bir cevabın ardından açıklamayı okumak, hiç yanılmamaktan daha kalıcı bir öğrenme sağlayabilir. Derleyici hataları da birer ipucu: onları sonuna kadar oku.',
    source: 'Metcalfe, 2017',
  },
  {
    icon: '🔮',
    title: 'Önce tahmin et',
    body: 'Bir konuyu öğrenmeden önce cevabı tahmin etmek, yanılsan bile, beynini o bilgiye hazırlar. Derslerdeki "Bu kod ne yazdırır?" soruları bu yüzden açıklamadan önce gelir.',
    source: 'Richland, Kornell ve Kao, 2009',
  },
  {
    icon: '🎯',
    title: 'Emin olduğun hatalar',
    body: 'Çok emin olduğun bir cevabın yanlış çıkması seni şaşırtır ve bu şaşkınlık doğru bilgiyi daha iyi hatırlamanı sağlar. Güven sorusunu bu yüzden soruyoruz.',
    source: 'Butterfield ve Metcalfe, 2001',
  },
  {
    icon: '⏱️',
    title: 'Kısa ama her gün',
    body: 'Haftada bir kez üç saat yerine her gün yirmi dakika çalışmak çok daha kalıcıdır. Küçük ama düzenli adımlar uzun vadede büyük fark yaratır.',
    source: 'Dağıtılmış pratik etkisi',
  },
  {
    icon: '⌨️',
    title: 'Kodu kendin yaz',
    body: 'Çözümü okumak yerine kodu kendin yazmayı denemek, takılsan bile, hatırlamayı belirgin şekilde artırır. İpucuna geçmeden önce birkaç dakika uğraş.',
    source: 'Slamecka ve Graf, 1978',
  },
  {
    icon: '🖼️',
    title: 'Kelime ve resim birlikte',
    body: 'Bellek diyagramları gibi görselleri sözlü açıklamalarla birleştirmek, bilgiyi beyninde iki ayrı yoldan saklar. Bir kavramı anlamadıysan kâğıda çizmeyi dene.',
    source: 'Paivio, 1986',
  },
  {
    icon: '🍅',
    title: 'Odak ve mola',
    body: 'Dikkat sınırlı bir kaynaktır. 25 dakika odaklanıp 5 dakika mola vermek hem verimini hem motivasyonunu korur. Üst çubuktaki odak zamanlayıcısını dene.',
    source: 'Pomodoro tekniği, Cirillo',
  },
  {
    icon: '📵',
    title: 'Tek iş, tek sekme',
    body: 'Bildirime bakmak ya da sekme değiştirmek her seferinde odağını sıfırlar. Ders sırasında telefonunu başka odaya koymak bile fark yaratır.',
  },
  {
    icon: '🧗',
    title: 'Zorlanmak iyi işaret',
    body: 'Öğrenirken zorlanmak yanlış yolda olduğun anlamına gelmez. Biraz zorlayan çalışma, kolay gelen çalışmadan daha kalıcı öğrenme sağlar.',
    source: 'Bjork, 1994',
  },
  {
    icon: '📚',
    title: 'Somut örnek bul',
    body: 'Soyut bir kuralı anlamakta zorlanıyorsan onu hayatından bir örnekle eşleştir: sahiplik bir kütüphane kitabı gibidir, ödünç alma kitabı arkadaşına okuması için vermek gibi.',
  },
  {
    icon: '❓',
    title: 'Neden diye sor',
    body: 'Yeni bir kural öğrendiğinde "Rust bunu neden böyle yapıyor?" diye sor. Cevabı aramak, yeni bilgiyi zaten bildiklerine bağlar.',
    source: 'Dunlosky ve ark., 2013',
  },
  {
    icon: '🚶',
    title: 'Takıldığında yürü',
    body: 'Kısa bir yürüyüş ya da birkaç dakikalık hareket dikkati tazeler. Bir hatayla boğuşuyorsan kalk, biraz dolaş; çözüm çoğu zaman o arada gelir.',
  },
  {
    icon: '🧱',
    title: 'Ustalıkla ilerle',
    body: 'Bir konuyu sağlamlaştırmadan sonrakine geçmek, temeli çatlak bir ev kurmaya benzer. Modül sınavlarındaki yüzde 80 eşiği bu yüzden var.',
    source: 'Bloom, 1968',
  },
  {
    icon: '🌱',
    title: 'Hedefini küçük tut',
    body: 'Motivasyon ilerlemeyi görmekten beslenir. Ulaşılabilir bir günlük hedef koy; her gün tamamlanan küçük bir hedef, seri oluşturmanın en sağlam yoludur.',
  },
  {
    icon: '🔧',
    title: 'Çalıştır, değiştir, boz',
    body: 'Örnek kodları yalnızca okuma: çalıştır, bir satırını değiştir, bilerek boz ve neden bozulduğunu gör. Deneyerek öğrenilen bilgi daha derine yerleşir.',
  },
  {
    icon: '🫧',
    title: 'Unutmak normal',
    body: 'Bir şeyi unutman onu öğrenmediğin anlamına gelmez. Unuttuğun bir bilgiyi yeniden hatırlamak, onu öncekinden daha güçlü hale getirir.',
    source: 'Bjork ve Bjork, 1992',
  },
  {
    icon: '🛠️',
    title: 'Küçük bir proje başlat',
    body: 'Öğrendiklerini kendi küçük projende kullan: bir hesap makinesi, bir yapılacaklar listesi. Bilgiyi yeni bir bağlamda uygulamak onu gerçekten senin yapar.',
  },
];

/** Deterministic tip for a given day so it stays the same all day. */
export function tipIndexForDay(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((d.getTime() - start) / 86_400_000);
  return (dayOfYear + d.getFullYear()) % TIPS.length;
}
