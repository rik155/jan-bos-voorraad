# Jan Bos Voorraad V7 - Snel & Simpel

Vernieuwde mobiele voorraad-app met:

- groot scan-startscherm;
- rustige Jan Bos-huisstijl;
- live zoeken zonder extra klik;
- voorraad direct aanpassen zonder pagina opnieuw te laden;
- duidelijke knop voor bijbestellen;
- inventarisatiemodus en dagelijks scannen;
- PostgreSQL via `DATABASE_URL`;
- bestaande producten en voorraad blijven behouden.

## Belangrijk bij update

Deze versie verandert **geen tabelnamen en verwijdert geen databasekolommen**. De bestaande PostgreSQL-database blijft gekoppeld via dezelfde `DATABASE_URL`. Upload de bestanden over de huidige GitHub-repository; maak geen nieuwe database aan.

## Render

De bestaande instellingen blijven gelijk. Na de deploy controleer je:

`/health`

Verwacht:

```json
{"status":"ok","database":"postgresql","persistent":true}
```

## V8 - iPhone app zonder browserbalk
Deze versie is als PWA ingericht. Open de app eenmalig in Safari en kies **Deel > Zet op beginscherm**. Start hem daarna uitsluitend via het nieuwe beginscherm-icoon; dan opent hij schermvullend zonder Safari- of Google-balk.

De PostgreSQL-database en bestaande producten worden niet aangepast of gewist.

## V10
- iPhone barcode scanning fallback via html5-qrcode when BarcodeDetector is unavailable.
- Photo workflow at `/fotos` for rapidly photographing all existing products.
- One-tap photo add/replace on every product detail page.
