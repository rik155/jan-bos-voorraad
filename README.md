# Jan Bos Voorraad V4 - Barcode Inventarisatie

Deze versie is bedoeld om eerst een schone voorraad op te bouwen door alleen producten te scannen die echt in het magazijn liggen.

## Nieuw
- Inventarisatiemodus met camera-scanner
- Bestaande barcode koppelen aan nieuw product
- Bestaand product opnieuw tellen en voorraad corrigeren
- Dagelijkse barcode-scanner opent het product direct
- Handmatige barcode-invoer als camera-scannen niet wordt ondersteund
- Artikelcode en barcode in Excel-export
- Bestaande database blijft behouden door automatische migratie

## Werkwijze inventarisatie
1. Open `Inventarisatie starten`.
2. Geef de browser toegang tot de camera.
3. Scan een barcode.
4. Nieuwe barcode: vul productnaam, getelde voorraad, eenheid, minimum en locatie in.
5. Bekende barcode: vul alleen het werkelijk getelde aantal in.
6. Na opslaan kun je direct het volgende product scannen.

## Render
De app gebruikt dezelfde `DATABASE_URL` als de bestaande versie. Upload alle bestanden over de bestaande repository heen. Render deployt daarna automatisch.

## Let op camera
Camera-scannen werkt alleen via HTTPS, zoals de Render-link. Niet alle browsers ondersteunen de ingebouwde `BarcodeDetector`. Chrome op Android werkt meestal het best. Er is altijd handmatige barcode-invoer als fallback.
