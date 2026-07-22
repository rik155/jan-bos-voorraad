# Jan Bos Voorraad V6 - PostgreSQL veilig

Deze versie gebruikt automatisch de Render PostgreSQL-database zodra de environment variable `DATABASE_URL` aanwezig is. Zonder die variabele gebruikt de app alleen lokaal SQLite voor ontwikkeling en tests.

## Controle na deploy

Open:

```
https://jouw-app.onrender.com/health
```

Bij een goede koppeling staat er:

```json
{"status":"ok","database":"postgresql","persistent":true}
```

## Render

- Key: `DATABASE_URL`
- Value: de Internal Database URL van Render
- Daarna: Save, rebuild, and deploy

## Belangrijk

Een gratis Render PostgreSQL-database verloopt op de datum die Render in het dashboard toont. Upgrade de database voor die datum of maak tijdig een export/back-up. Nieuwe deploys en normale herstarts wissen PostgreSQL-data niet.
