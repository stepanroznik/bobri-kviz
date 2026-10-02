# Bobří kvíz

Jednoduchá webová aplikace se dvěma režimy:

- **Projektor**: `/`
- **Admin**: `/?admin=TVUJ_TAJNY_KLIC`

Struktura je volná: kola, témata i otázky lze v administraci přidávat a odebírat. Doporučená šablona je **2 témata × 5 otázek = 10 otázek na kolo**; administrace odlišnou strukturu pouze barevně označí. Každé téma má vlastní titulní slide a zobrazují se všechny otázky s vyplněným zadáním. Starší příznaky `enabled` se při přehrávání ignorují. Na konci každého kola je samostatný 60s odpočet pro odevzdání odpovědních lístků.

Zalomení řádků v zadání i odpovědi se zachovají také v prezentaci. Pokud se zadání nevejde do dostupného prostoru, jeho písmo se jemně zmenší v půlprocentních krocích, maximálně o 6 %. V adminu tlačítko **Přesunout téma…** přemístí celé téma do jiného kola a **Přesunout otázku…** v rozbalené otázce nabídne cílové kolo a téma. Položka se zařadí na konec cíle včetně médií a zdrojů; přesun potvrdíte tlačítkem **Uložit**.

## Hosting

Projekt je připravený pro **Cloudflare Pages + Pages Functions + D1**. Není potřeba Node server ani placený disk.

### 1. GitHub

Vytvoř prázdný repozitář (např. `bobri-kviz`) a nahraj do něj celý obsah tohoto adresáře.

```bash
git init
git add .
git commit -m "Initial Bobri kviz"
git branch -M main
git remote add origin git@github.com:TVUJ_UCET/bobri-kviz.git
git push -u origin main
```

### 2. Cloudflare Pages

1. Zaregistruj se na https://dash.cloudflare.com/
2. **Workers & Pages → Create application → Pages → Import an existing Git repository**.
3. Připoj GitHub a vyber repozitář.
4. Production branch: `main`.
5. Build command: `npm run build`
6. Build output directory: `dist`
7. Deploy.

Cloudflare pak redeployne projekt po každém pushi do `main`.

### 3. D1 databáze

V Cloudflare Dashboardu:

1. **Storage & databases → D1 → Create database**
2. Název např. `bobri-kviz`
3. Vrať se do Pages projektu → **Settings → Bindings → Add → D1 database**
4. Variable name musí být přesně `DB`
5. Vyber vytvořenou databázi
6. Ulož a udělej nový deployment (třeba Retry deployment nebo další push)

Tabulky se vytvoří automaticky při prvním requestu a vloží se výchozí kvíz.

### 4. Admin klíč

Pages projekt → **Settings → Environment variables**:

- Name: `ADMIN_KEY`
- Value: dlouhý náhodný řetězec, např. `bobri-9f4d...`
- nastav pro Production (a klidně i Preview)

Pak admin otevřeš například:

`https://bobri-kviz.pages.dev/?admin=bobri-9f4d...`

Klíč se posílá serveru v hlavičce `X-Admin-Key`. Projektor žádný klíč nepotřebuje.

## Média

Kvůli nulovým nákladům a nulové kartě ukládá aplikace krátká média přímo do D1. Jeden soubor je omezen na **1,3 MB** (D1 má 2MB limit na řádek, data se ukládají base64). Pro fotky to stačí po běžné kompresi, pro hudební otázky použij krátké MP3 ukázky.

Admin umí také místo uploadu uložit externí URL obrázku/audia.

## Ovládání projektoru

- `←` / `→`: předchozí / další slide
- `Space`: zobrazit/schovat odpověď; na odpočtu pauza/spuštění
- `R`: restart 60s odpočtu
- `F`: fullscreen

## Poznámka k fontu

CSS preferuje lokálně nainstalovaný **Museo Sans / Museo Slab**. Pokud na zařízení nejsou, použije Lato + Roboto Slab z Google Fonts. Fonty Museo nejsou součástí repozitáře.


## API

Interaktivní Swagger dokumentace je po nasazení dostupná na `/api/docs`; OpenAPI 3.1 JSON je na `/api/openapi`. Čtení veřejného kvízu nevyžaduje klíč. Operace pod `/api/admin/*` používají hlavičku `X-Admin-Key` se stejnou hodnotou jako `ADMIN_KEY`.
