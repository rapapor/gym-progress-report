# Architektura UI dla Gym Progress Report

## 1. Przegląd struktury UI

Aplikacja dzieli się na trzy odrębne przestrzenie robocze odpowiadające rolom użytkowników:

1. **/admin** – panel super-admina do zarządzania trenerami, klientami i logiem audytowym.
2. **/trainer** – panel trenera do obsługi klientów, raportów i statystyk.
3. **/app** – PWA klienta (mobile-first) służąca do przesyłania i przeglądania własnych raportów.

Każda przestrzeń ma własny układ (layout), zestaw ścieek i kontekst autoryzacji, co minimalizuje złożoność uprawnień i kodu.

Wspólny ekran logowania (`/login`) weryfikuje poświadczenia (e-mail lub telefon) przy użyciu Supabase Auth. Po udanej autoryzacji następuje przekierowanie do odpowiedniego prefiksu na podstawie roli w JWT (`role` claim).

## 2. Lista widoków

### 2.1 Wspólne

| Widok | Ścieżka | Cel | Kluczowe informacje | Kluczowe komponenty | UX / A11y / Security |
|-------|---------|-----|---------------------|---------------------|----------------------|
| Login | `/login` | Uwierzytelnienie wszystkich użytkowników | Formularz e-mail/telefon, hasło/OTP, błąd logowania | `AuthForm`, `RoleRedirector`, `ErrorToast` | Walidacja inline, aria-labels, WCAG kontrast; tokeny w httpOnly cookies + XSRF header |
| 404 / Error | `*` (catch-all) | Przyjazna obsługa nieznanych tras i błędów serwera | Kod błędu, opis, przycisk powrotu | `ErrorLayout` | Dostępny komunikat, logowanie stack trace po stronie serwera |

### 2.2 Admin (`/admin`)

| Widok | Ścieżka | Cel | Kluczowe informacje | Kluczowe komponenty | UX / A11y / Security |
|-------|---------|-----|---------------------|---------------------|----------------------|
| Dashboard | `/admin` | Szybki przegląd statystyk systemu | Liczniki trenerów, klientów, raportów; ostatnie zdarzenia audytu | `StatsCards`, `RecentAuditList` | Tabela z aria-describedby; dostęp tylko super-admin |
| Lista trenerów | `/admin/trainers` | Zarządzanie trenerami | Tabela trenerów, status aktywacji, akcje edycji/usunięcia | `TrainerTable`, `InviteTrainerModal` | Zabezp.  CSRF przy mutacjach; paginacja |
| Profil trenera | `/admin/trainers/:id` | Szczegóły i edycja trenera | Dane profilu, lista klientów, audit log | `ProfileHeader`, `ClientMiniList`, `AuditTab` | Lazy loading zakładek; RLS + kontrola roli |
| Lista użytkowników | `/admin/users` | Lista wszystkich kont | Tabela z filtrami roli i statusu | `UserTable` | Maskowanie wrażliwych danych; paginacja |
| Audit Log | `/admin/audit-logs` | Przegląd zdarzeń w systemie | Tabela paginowana; filtry encji/dat | `AuditTable`, `FilterBar` | Nie pokazuje userAgent/IP; pobiera `/api/audit-logs` |

### 2.3 Trainer (`/trainer`)

| Widok | Ścieżka | Cel | Kluczowe informacje | Kluczowe komponenty | UX / A11y / Security |
|-------|---------|-----|---------------------|---------------------|----------------------|
| Dashboard / Lista klientów | `/trainer` | Monitorowanie klientów i braków raportów | Tabela klientów, badge "Brak raportu", sort/filtr | `ClientTable`, `SendReminderAction` | Akcja wywołuje Edge Function; toast sukces/porażka |
| Profil klienta (Reports) | `/trainer/clients/:id` (tab `reports`) | Lista raportów klienta | Karty raportów, przycisk podglądu | `ReportCard`, `TabNav` | Lazy load; aria-selected na zakładkach |
| Profil klienta (Trends) | `...` tab `trends` | Wykresy pomiarów | react-chartjs-2 line charts | `TrendChart`, `MetricToggle` | Kolory z kontrastem ≥4.5:1; opis osi |
| Profil klienta (Profile) | `...` tab `profile` | Dane osobowe klienta | Formularz edycji | `ClientProfileForm` | Walidacja inline; CSRF token |
| Szczegóły raportu | `/trainer/reports/:id` | Ocena pojedynczego raportu | Zdjęcia (blurhash→full), pomiary, diff vs poprzedni | `ReportDetail`, `ImageCompare` | Keyboard-nav między zdjęciami; dane z `/api/reports/:id` |
| Create Client Wizard | `/trainer/clients/new` | Onboarding nowego klienta | Kroki: dane osobowe → podsumowanie → potwierdzenie | `Wizard`, `StepForm`, `SummaryCard` | Async invite; disabled on submitting; aria-live region |
| Settings | `/trainer/settings` | Ustawienia konta | Zmiana hasła, dane profilu | `SettingsForm` | Reautoryzacja przy krytycznych akcjach |

### 2.4 Client PWA (`/app`)

| Widok | Ścieżka | Cel | Kluczowe informacje | Kluczowe komponenty | UX / A11y / Security |
|-------|---------|-----|---------------------|---------------------|----------------------|
| Dashboard | `/app` | Lista raportów i status tygodnia | Karty raportów, przycisk „Nowy raport” | `ReportCard`, `NewReportFAB` | Bottom tab bar; offline overlay blokuje CTA |
| Wizard Submit Report | `/app/reports/new` | Przesyłanie raportu | Kroki: zdjęcia → pomiary → cardio/note → podsumowanie | `ImageUploader`, `MeasuresForm`, `Wizard` | Ograniczenia 3×5 MB; walidacja; progres uploadu |
| Szczegóły raportu | `/app/reports/:id` | Podgląd własnego raportu | Zdjęcia, pomiary, data | `ReportDetail` | Stan tylko-do-odczytu po wysłaniu |
| Onboarding Wizard | `/app/onboarding` | Aktywacja konta po OTP | Kroki: hasło → dane osobowe → gotowe | `Wizard`, `PasswordStep`, `ProfileStep` | Minimalne pola; aria-live errors |
| Offline Overlay | (global) | Informacja o braku sieci | Ikona, tekst, „Spróbuj ponownie” | `OfflineOverlay` | Wykrycie `navigator.onLine`; wyszarzone akcje |
| Settings | `/app/settings` | Ustawienia konta | Zmiana hasła, język (przygotowanie) | `SettingsForm` | Tryb dark toggle (po MVP) |

## 3. Mapa podróży użytkownika

### 3.1 Klient – kluczowy przepływ „Wysłanie raportu”
1. **Login** → przekierowanie do `/app`.
2. Dashboard pokazuje przycisk „Nowy raport” (lub badge, że limit wykorzystany).
3. Użytkownik klika → **Wizard Submit Report**.
   1. **Krok 1:** Upload 3 zdjęć (kompresja + podgląd blurhash).
   2. **Krok 2:** Formularz pomiarów (walidacja zakresów).
   3. **Krok 3:** Cardio days + notatka.
   4. **Krok 4:** Podsumowanie → Submit.
4. API `POST /api/clients/{id}/reports` zwraca 201; TanStack Query `invalidate` listę.
5. Redirect do **Szczegóły raportu** → powrót na **Dashboard**.
6. Offline? → `OfflineOverlay` blokuje „Submit”, umożliwia podgląd zapisanych raportów (cache).

### 3.2 Trener – „Sprawdzenie brakujących raportów” i przypomnienie
1. **Login** → `/trainer` (lista klientów).
2. Filtr „Brak raportu” → sortowanie alfabetyczne.
3. Kliknięcie akcji „Wyślij przypomnienie” wywołuje Edge Function `/rpc/send_reminder_email`.
4. Toast potwierdzający; status klienta aktualizuje się po sukcesie.
5. Wejście na **Profil klienta** → zakładka **Reports**.
6. Kliknięcie ostatniego raportu otwiera **Szczegóły raportu**.
7. Zakładka **Trends** pokazuje wykresy z `/trends` (cache 5 min).

### 3.3 Super-admin – „Dodanie nowego trenera”
1. **Login** → `/admin/trainers`.
2. Klik „Dodaj trenera” otwiera `InviteTrainerModal`.
3. Formularz `fullName`, `email` → `POST /api/trainers`.
4. Po 201 → tabela odświeża się, status „Oczekuje na aktywację”.

## 4. Układ i struktura nawigacji

1. **Login** ma osobny, lekki layout bez bocznego menu.
2. **Admin**:
   - Stały sidebar (ikony + nazwy) z sekcjami: Dashboard, Trainers, Users, Audit Logs.
   - Główna treść w kontenerze z breadcrumbs.
3. **Trainer**:
   - Sidebar na ≥768 px, collapsible. Na mobile: hamburger menu.
   - Główne sekcje: Clients, Settings.
   - Widoki klienta korzystają z TabNav (Reports / Trends / Profile).
4. **Client PWA**:
   - Bottom tab bar (Dashboard, Settings) na <768 px; na desktop – top nav.
   - Floating Action Button `NewReportFAB` dostępny tylko, gdy dopuszczalny upload.

Routing chroniony middlewarem Astro (`src/middleware`) – przekierowuje do `/login` przy braku JWT lub do odpowiedniego prefixu, jeśli rola nie pasuje do aktualnego workspace.

## 5. Kluczowe komponenty (wielokrotnego użytku)

| Komponent | Krótki opis |
|-----------|-------------|
| `AuthForm` | Obsługuje login e-mail/telefon, walidację, przekierowanie po JWT. |
| `Wizard` | Uniwersalny wrapper kroków, aria-live announcer, pasek postępu. |
| `ImageUploader` | Kompresja, podgląd blurhash, walidacja rozmiaru/typu, progres. |
| `ReportCard` | Podsumowanie raportu (data, mini-zdjęcie, badge). |
| `TrendChart` | Wrapper react-chartjs-2 z responsywnymi liniami i legendą toggle. |
| `TabNav` | Dostępne zakładki z `aria-controls`, klawiaturowa nawigacja. |
| `ClientTable` / `TrainerTable` / `UserTable` | Paginowane tabele z sort/filtr, dostępne komórki. |
| `ErrorToast` | Globalny toast obsługi błędów API; typy: error/warning/success. |
| `OfflineOverlay` | Detekcja offline, overlay półtransparentny, CTA retry. |
| `SettingsForm` | Aktualizacja hasła i profilu; weryfikacja starego hasła. |
| `SendReminderAction` | Wywołanie Edge Function, stan loading, toast wyniku. |

---

### Mapowanie historyjek użytkownika 1F ui

| Historyjka (PRD) | Widoki / komponenty |
|------------------|--------------------|
| US-001 Bezpieczne logowanie | Login, AuthForm, Middleware |
| US-002 Super-admin tworzy trenera | Admin – TrainerList + InviteTrainerModal |
| US-003 Trener tworzy klienta | Trainer – Create Client Wizard |
| US-004 Klient aktywuje konto | Onboarding Wizard |
| US-005 Tryb offline tylko do odczytu | OfflineOverlay, Wizard Submit Report (disabled) |
| US-006 Wysłanie raportu | Wizard Submit Report, ImageUploader, MeasuresForm |
| US-007 Lista klientów | Trainer Dashboard ClientTable |
| US-008 Szczegóły raportu | ReportDetail, ImageCompare |
| US-009 Wykres trendów | TrendChart tab |
| US-010 Porównanie zdjęć | ImageCompare w ReportDetail |
| US-011 Reset hasła klienta | SettingsForm (Trainer) → Supabase Admin API |
| US-012 Pełen dostęp super-admina | Admin workspace widoki |
| US-013 Polityka retencji obrazów | Back-end proces – UI brak |
| US-014 Gotowość do i18n | Wszystkie widoki korzystają z i18n (hook useTranslation) |
| US-015 Dostępność (WCAG) | Wszystkie komponenty Shadcn/ui + kolory kontrastowe |

### Potencjalne stany brzegowe / błędy
- Offline – overlay, cachowane GET, blokada mutacji.
- 401/403 – globalny interceptor usuwa cache, redirect do `/login`.
- 409 Duplicate report – walidacja w Wizard; toast z informacją.
- 500 – ErrorLayout z przyjaznym komunikatem i numerem referencyjnym.
- Rate limit 429 – Toast z odliczaniem do ponownej próby.

> Architektura UI pozostaje zgodna z planem API: każda operacja mutująca ma dedykowany endpoint, a stany widoków są napędzane przez TanStack Query z cache i invalidacją po sukcesie.
