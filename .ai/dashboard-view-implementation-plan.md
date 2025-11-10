# Plan implementacji widoku Dashboard (`/app`)

## 1. Przegląd
Dashboard to główny widok aplikacji PWA dla klienta. Jego zadaniem jest:
* wyświetlenie listy wszystkich raportów klienta (najnowsze pierwsze) wraz ze statusem raportu w bieżącym tygodniu,
* umożliwienie przesłania nowego raportu (przycisk „+” lub „+ Nowy raport”) – o ile spełnione są warunki (online, klient nie przekroczył limitu 2 raportów w tygodniu),
* informowanie użytkownika o braku połączenia z siecią i blokowanie akcji zapisu zgodnie z US-005.

## 2. Routing widoku
* **Ścieżka**: `/app`
* **Strażnik dostępu**: tylko rola `client` zalogowana.
* **Ładowanie danych początkowych**: query param `page, pageSize` z defaultem `page=1&pageSize=20`.

## 3. Struktura komponentów
```
<DashboardPage>
 ├── <Header />              – nagłówek z tytułem i statusem tygodnia
 ├── <ReportList />          – lista raportów wirtualizowana
 │     └─ <ReportCard />     – pojedynczy raport
 ├── <OfflineOverlay />      – pełnoekranowa warstwa info o offline (portal)
 ├── <NewReportFAB />        – Floating Action Button „+ Nowy raport”
 └── <BottomTabBar />        – nawigacja aplikacji (shadcn/ui Tabs)
```

## 4. Szczegóły komponentów

### 4.1 `DashboardPage`
* **Opis**: Komponent stronicujący listę raportów i zawierający logikę offline / limit tygodnia.
* **Główne elementy**: `Header`, `ReportList`, `OfflineOverlay`, `NewReportFAB`, `BottomTabBar`.
* **Zdarzenia**: ładowanie dalszych stron (`onLoadMore`), detekcja zmiany `isOffline`.
* **Walidacja**: brak – logika walidacyjna delegowana do podrzędnych.
* **Typy**:
  * `ReportListItemDTO[]` – dane z API.
  * `PaginationMeta` – meta-dane stronicowania.
* **Propsy**: brak (używane w trasie bezpośrednio).

### 4.2 `Header`
* **Opis**: Pasek tytułu „Moje raporty” z podsumowaniem statusu tygodnia (✅ „Raport wysłany” lub ⚠️ „Brak raportu”).
* **Elementy**: tag <header>, <h1>, <StatusBadge /> (mały komponent tekstowy).
* **Zdarzenia**: brak.
* **Walidacja**: wylicza status z prop `hasCurrentWeekReport: boolean`.
* **Typy**: `boolean`.
* **Propsy**: `{ hasCurrentWeekReport: boolean }`.

### 4.3 `ReportList`
* **Opis**: Wirtualizowana lista raportów z paginacją.
* **Elementy**: `react-window`/`autoSizer` + mapowanie na `ReportCard`.
* **Zdarzenia**: `onEndReached` → fetch następnej strony.
* **Walidacja**: brak.
* **Typy**: `ReportListItemDTO[]`.
* **Propsy**: `{ reports: ReportCardVM[]; onLoadMore: () => void; isLoading: boolean }`.

### 4.4 `ReportCard`
* **Opis**: Wizualna karta jednego raportu. Pokazuje datę, numer tygodnia + miniatury 3 zdjęć (jeśli w cache) oraz skrócone pomiary.
* **Elementy**: karta shadcn/ui `Card` z Tailwind grid.
* **Zdarzenia**: klik → przejście do `/app/reports/{reportId}`.
* **Walidacja**: gdy offline, obrazki pobierane tylko z cache (`<img loading="lazy" />`).
* **Typy**:
  * `ReportCardVM` – patrz sekcja 5.
* **Propsy**: `{ report: ReportCardVM }`.

### 4.5 `NewReportFAB`
* **Opis**: Pływający przycisk typu `ActionIcon` (shadcn/ui). Widoczny tylko gdy `canCreateReport === true`.
* **Zdarzenia**: `onClick` → push do `/app/new-report`.
* **Walidacja**: disabled gdy `isOffline` lub `hasReachedWeeklyLimit`.
* **Typy**: `{ canCreateReport: boolean; disabledReason?: string }`.
* **Propsy**: jak wyżej.

### 4.6 `OfflineOverlay`
* **Opis**: Pełnoekranowy przezroczysty overlay pokazujący komunikat i blokujący kliknięcia w FAB.
* **Elementy**: `<div role="alert">…</div>` z animacją fade-in.
* **Zdarzenia**: brak.
* **Walidacja**: renderowany gdy `isOffline === true`.
* **Typy**: `boolean`.
* **Propsy**: `{ isOffline: boolean }`.

### 4.7 `BottomTabBar`
* **Opis**: Wspólna nawigacja aplikacji klienta (karty: Dashboard, Profil).
* **Impl.**: shadcn/ui `Tabs` fixed to bottom.

## 5. Typy
```ts
// Istniejące
type ReportListItemDTO = import('src/types').ReportListItemDTO;
interface PaginationMeta { page: number; pageSize: number; totalPages: number; totalItems: number; }

// Nowe
interface ReportCardVM {
  id: string;
  createdAt: string;          // ISO
  weekNumber: number;         // ISO week
  sequence: number;           // w roku
  cardioDays: number;
  hasNote: boolean;
  imageThumbUrls: string[];   // max 3
}
```
*`ReportCardVM` jest adapterem DTO → VM agregującym wyliczone pola (weekNumber, thumb URLs)

## 6. Zarządzanie stanem
* **Źródło prawdy**: `React Query` (lub `@tanstack/query`) – cacheuje `GET /reports`.
* **Hooki**:
  * `useReports(clientId)` – enkapsuluje fetch, stronicowanie i mapowanie na `ReportCardVM`.
  * `useNetworkStatus()` – zwraca `{ isOffline: boolean }` (listener `navigator.onLine` + eventy `online/offline`).
* **Lokalny stan** (DashboardPage):
  * `isOffline` – z hooka.
  * `canCreateReport` – computed (`!isOffline && !hasReachedWeeklyLimit`).

## 7. Integracja API
* **Lista raportów** – `GET /api/clients/{clientId}/reports?page=x&pageSize=y`
  * `response.body`: `{ data: ReportListItemDTO[]; meta: PaginationMeta }`
  * Mapowanie na `ReportCardVM` po stronie hooka.
* **Tworzenie raportu** – delegowane do widoku „New Report”, ale Dashboard musi przejść do tej trasy.

## 8. Interakcje użytkownika
| Interakcja | Wynik |
|------------|-------|
| Scroll do końca listy | pobranie kolejnej strony (spinner w stopce) |
| Tap na `ReportCard` | przejście do szczegółów raportu |
| Tap na `FAB` online | przejście do `/app/new-report` |
| Tap na `FAB` offline lub >2 raporty | tooltip z `disabledReason` |
| Utrata sieci | pojawia się `OfflineOverlay`, `FAB` znika / disabled |

## 9. Warunki i walidacja
* **Offline** (`navigator.onLine === false`) → `OfflineOverlay` + `FAB.disabled = true`.
* **Limit 2 raportów/tydzień** – z ostatnich elementów listy (lub nagłówka meta) liczone lokalnie.
* **Paginacja** – blokuje fetch gdy `meta.page >= meta.totalPages`.

## 10. Obsługa błędów
* **Błędy sieci**: toast (shadcn/ui `useToast`) + możliwość retry.
* **404 client** (gdy brak klienta) → redirect do `/error` z komunikatem.
* **409 duplicate** (podczas dodawania raportu) – wyświetlony w widoku „New Report”.

## 11. Kroki implementacji
1. Utworzyć trasę `/app` w `src/pages/app.astro` z layoutem `Layout.astro`.
2. Zaimportować `DashboardPage` jako komponent React w pliku.
3. Zaimplementować hook `useNetworkStatus` w `src/lib/hooks/useNetworkStatus.ts`.
4. Zaimplementować hook `useReports` w `src/lib/hooks/useReports.ts` (React Query).
5. Stworzyć komponenty: `Header`, `ReportList`, `ReportCard`, `NewReportFAB`, `OfflineOverlay`, `BottomTabBar` w `src/components/dashboard/*`.
6. Dodać Tailwind classes + shadcn/ui (Card, Button, Tabs).
7. Przygotować adapter DTO→VM w `src/lib/mappers/reportCardMapper.ts`.

