# planda sitesi

Bu klasör planda'nın bağımsız sürümüdür. Kayıtlar her tarayıcıda ayrı tutulur. Görselden ekleme özelliği, Netlify'da çalışan küçük bir sunucu fonksiyonu üzerinden çalışır.

## Dosyalar

- `index.html`: Uygulamanın kendisi.
- `netlify.toml`: Netlify'a sunucu fonksiyonunun nerede olduğunu söyler.
- `netlify/functions/read-image.js`: Görseli okuyan sunucu fonksiyonu.

## Önemli: Netlify Drop bu sürümü çalıştırmaz

Önceki yayın yöntemi (Netlify Drop'a klasör sürüklemek) yalnızca dosyaları yayınlar; sunucu fonksiyonunu çalıştırmaz. Bu yüzden siteyi GitHub üzerinden yayınlamalısın. GitHub ücretsizdir.

## Terimler

- **API anahtarı:** Programların Claude'u kullanabilmesi için bir şifre. Anthropic hesabında oluşturulur. Kullanım, claude.ai aboneliğinden ayrı ve kullandıkça ücretlendirilir. Güncel fiyat için: https://docs.claude.com
- **Erişim kodu:** Senin belirleyeceğin kod. Görselden ekleme özelliğini kimlerin kullanabileceğini belirler. Sadece güvendiğin kişilere ver.
- **Ortam değişkeni:** Netlify'a gizlice verdiğin ayar. Anahtar ve kod burada durur; sayfada görünmez.

## Kurulum adımları

**1. API anahtarı al**
1. https://console.anthropic.com adresine gir ve giriş yap.
2. Kullanım/faturalama bölümünden hesabına kredi ekle.
3. "API Keys" bölümünde yeni bir anahtar oluştur ve kopyala. Bu anahtarı kimseyle paylaşma.
4. Hesabında harcama limiti ayarlamanı öneririm.

**2. GitHub'a yükle**
1. https://github.com adresinde hesap aç.
2. "New repository" ile yeni bir depo oluştur, adı `planda` olsun.
3. "uploading an existing file" bağlantısına tıkla.
4. Bu klasördeki `index.html`, `netlify.toml`, `README.md` dosyalarını ve `netlify` klasörünü sürükle bırak.
5. "Commit changes" düğmesine bas.

**3. Netlify'a bağla**
1. https://app.netlify.com adresinde "Add new site" > "Import an existing project" seç.
2. GitHub'ı bağla ve `planda` deposunu seç.
3. Ayarlara dokunma, "Deploy" de. Bu yeni bir link verir; eski `yourplanda` linki yerine bu linki kullanırsın.

**4. Anahtar ve erişim kodunu ekle**
1. Sitenin ayarlarına gir: "Site configuration" > "Environment variables".
2. İki değişken ekle:
   - `ANTHROPIC_API_KEY`: 1. adımda kopyaladığın anahtar.
   - `ACCESS_CODE`: Kendi seçtiğin kod (en az 6 karakter önerilir).
3. "Deploys" sekmesine gidip "Trigger deploy" > "Deploy site" de. Değişkenler yeniden yayından sonra geçerli olur.

**5. Dene**
Siteyi aç, "📷 Görselden ekle" düğmesine bas, erişim kodunu yaz ve bir ekran görüntüsü seç. Kayıt formu açılırsa her şey çalışıyor demektir.

## Sorun giderme

- **"Erişim kodu yanlış":** Netlify'daki `ACCESS_CODE` ile yazdığın kod aynı olmalı.
- **"Sunucu henüz ayarlanmamış":** Değişkenleri ekledikten sonra yeniden yayın yapmayı unutmuş olabilirsin.
- **"Görseli şu an okuyamadım":** Anthropic tarafında geçici bir sorun ya da kredi bitmiş olabilir. Hesabındaki kredi durumuna bak.
- Model değiştirmek istersen `netlify/functions/read-image.js` içindeki `MODEL` satırına bak.
