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
