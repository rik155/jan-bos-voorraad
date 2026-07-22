# Jan Bos Voorraad

Online magazijnvoorraad voor telefoon, tablet en pc.

## Functies
- Producten toevoegen en bewerken
- Voorraad in- en uitboeken
- Minimumvoorraad en bestelmelding
- Magazijnlocatie, categorie, artikelnummer en eenheid
- Mutatiegeschiedenis met medewerker en reden
- Zoeken en filteren
- Excel-export
- PostgreSQL voor veilige online opslag, met SQLite als lokale fallback

## Render
1. Maak een nieuwe GitHub-repository, bijvoorbeeld `jan-bos-voorraad`.
2. Upload de inhoud van deze map.
3. Maak in Render een PostgreSQL-database.
4. Maak een nieuwe Web Service via Docker.
5. Voeg bij Environment de Internal Database URL toe als `DATABASE_URL`.
6. Deploy.

Zonder `DATABASE_URL` gebruikt de app lokaal SQLite. Op Render wordt PostgreSQL sterk aanbevolen, omdat lokale bestanden bij een deploy verloren kunnen gaan.
