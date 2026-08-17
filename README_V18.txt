Jan Bos Voorraad V18 - Excel master + PostgreSQL back-ups + herstel

- /export.xlsx downloadt altijd Jan_Bos_Voorraad.xlsx.
- Bij iedere export wordt exact dezelfde Excel ook als timestamp-back-up in PostgreSQL opgeslagen.
- /backups toont eerdere exports, die je opnieuw kunt downloaden of terugzetten.
- Een aangepaste Jan_Bos_Voorraad.xlsx kan via /backups weer in de database worden ingelezen.
- Import koppelt eerst op barcode, daarna artikelcode, daarna exacte productnaam.
- Producten die niet in de Excel staan worden nooit automatisch verwijderd.
- De bestaande DATABASE_URL/PostgreSQL en alle huidige producten blijven behouden.
