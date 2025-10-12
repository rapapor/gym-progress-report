# Dokument Wymagań Produktowych (PRD) - Gym Progress Report

## 1. Przegląd produktu
Gym Progress Report to aplikacja webowa, która umożliwia trenerom personalnym gromadzenie i analizowanie cotygodniowych danych postępów swoich klientów.  Klienci korzystają z aplikacji PWA na urządzeniach mobilnych, aby przesłać raport składający się z trzech zdjęć oraz pomiarów ciała.  Trenerzy mają dostęp do panelu webowego, w którym mogą przeglądać raporty, wizualizować trendy i zarządzać listą klientów.  Platforma zawiera rolę super-admina zapewniającą pełny nadzór nad systemem.

## 2. Problem użytkownika
Klienci współpracujący z trenerami na odległość przesyłają dane o postępach różnymi kanałami (e-mail, komunikatory, arkusze), co prowadzi do utraty informacji i utrudnionego śledzenia.  Trenerzy nie mają jednolitego widoku postępów i muszą poświęcać czas na przypominanie o aktualizacjach.  Produkt rozwiązuje te problemy, oferując usprawniony, bezpieczny i mobilny przepływ pracy do przesyłania oraz przeglądania ustrukturyzowanych raportów.

## 3. Wymagania funkcjonalne
1. Uwierzytelnianie i role
   1.1 Tworzenie konta super-admina z pełnym dostępem do systemu.
   1.2 Rejestracja trenera przez super-admina; trener otrzymuje jednorazowe hasło (OTP) e-mail i musi je zmienić przy pierwszym logowaniu.
   1.3 Tworzenie konta klienta przez trenera; system wysyła link aktywacyjny z OTP; klient ustawia własne hasło przy pierwszym logowaniu.
   1.4 Logowanie za pomocą numeru telefonu (klienci) lub e-maila (trenerzy i super-admin) oraz hasła.
   1.5 Reset hasła może zostać zainicjowany wyłącznie przez trenera lub super-admina.
2. PWA dla klienta
   2.1 Wykrywanie trybu offline i wyświetlanie trybu „tylko do odczytu” z zablokowanymi akcjami zapisu.
   2.2 Wysyłka cotygodniowego raportu zawierającego:
       – Trzy obrazy (JPEG/PNG, ≤5 MB każdy; automatyczna kompresja i skalowanie).
       – Pomiary: waga, talia, klatka piersiowa, biceps lewy/prawy, udo lewe/prawe.
       – Dni cardio (0-7).
       – Opcjonalna notatka tekstowa.
   2.3 Maksymalnie dwa raporty w jednym tygodniu kalendarzowym; po wysłaniu raport staje się tylko do odczytu.
3. Panel webowy trenera
   3.1 Podgląd listy przypisanych klientów z oznaczeniem brakujących raportów w bieżącym tygodniu.
   3.2 Dostęp do strony klienta zawierającej:
       – Chronologiczną listę raportów (najnowsze pierwsze).
       – Szczegóły raportu (zdjęcia, pomiary, notatki).
       – Proste wykresy liniowe trendów dla każdego pomiaru.
       – Szybkie porównanie trzech ostatnich zdjęć z wybranym raportem.
   3.3 Generowanie nowych kont klientów i resetowanie haseł.
4. Zarządzanie danymi i przechowywanie
   4.1 Supabase Postgres dla danych relacyjnych; Supabase Storage dla obrazów.
   4.2 Automatyczne usuwanie obrazów starszych niż sześć miesięcy (implementacja do ustalenia).
   4.3 Wszystkie dane osobowe szyfrowane „w spoczynku” i „w tranzycie”.
5. Internacjonalizacja i dostępność
   5.1 Domyślne jednostki metryczne z warstwą abstrakcji umożliwiającą przyszłą zmianę.
   5.2 Przygotowanie do i18n; język angielski jako domyślny.
   5.3 Spełnienie podstawowych wytycznych WCAG dotyczących kontrastu i etykiet ARIA.

## 4. Granice produktu
Zakres (MVP):
- Role: super-admin, trener, klient.
- PWA klienta do wysyłki raportów (zapisy tylko online).
- Panel webowy trenera z przeglądem i wizualizacją raportów.
- Upload obrazów (maks 3 na raport) z kompresją i retencją 6 miesięcy.
- Dashboard KPI z wyróżnieniem klientów bez raportu w danym tygodniu.

Poza zakresem (MVP):
- Natywne aplikacje mobilne.
- Plany żywieniowe generowane przez AI.
- Płatne subskrypcje.
- Powiadomienia push/SMS/e-mail.
- Samoobsługowy reset hasła.
- Zaawansowana analityka (porównania okresów, eksport PDF).

## 5. Historyjki użytkownika
| ID | Tytuł | Opis | Kryteria akceptacji |
|----|-------|------|----------------------|
| US-001 | Bezpieczne logowanie | Jako użytkownik chcę zalogować się swoimi danymi, aby bezpiecznie korzystać z aplikacji. | AC1: Poprawne dane logowania przenoszą na pulpit.<br>AC2: Błędne dane wyświetlają komunikat bez ujawniania istnienia konta.<br>AC3: Po logowaniu z OTP wymuszona jest zmiana hasła. |
| US-002 | Super-admin tworzy trenera | Jako super-admin chcę utworzyć konto trenera, aby rozpoczął onboarding klientów. | AC1: Formularz dodania trenera (imię, e-mail) wysyła mail z OTP.<br>AC2: Trener wyświetla się z statusem „Oczekuje na aktywację”.<br>AC3: Trener musi zmienić hasło przy pierwszym logowaniu. |
| US-003 | Trener tworzy klienta | Jako trener chcę utworzyć konto klienta, aby mógł przesyłać raporty. | AC1: Trener wypełnia profil (imię, telefon, e-mail opcjonalnie) i wysyła zaproszenie.<br>AC2: System wysyła link aktywacyjny z OTP.<br>AC3: Klient widnieje na liście ze statusem „Oczekuje na aktywację”. |
| US-004 | Klient aktywuje konto | Jako klient chcę aktywować konto przez link, aby uzyskać dostęp do PWA. | AC1: Link ważny 24 h.<br>AC2: Klient ustawia hasło i loguje się.<br>AC3: Ponowne użycie linku wyświetla „Link wygasł”. |
| US-005 | Tryb offline tylko do odczytu | Jako klient chcę wiedzieć, że jestem offline, aby rozumieć brak możliwości wysyłki raportu. | AC1: Aplikacja wykrywa brak sieci i pokazuje baner.<br>AC2: Przycisk wysyłki raportu wyłączony offline.<br>AC3: Podgląd wcześniejszych raportów jest dostępny offline. |
| US-006 | Wysłanie raportu tygodniowego | Jako klient chcę przesłać cotygodniowy raport ze zdjęciami i pomiarami, aby trener mógł ocenić postępy. | AC1: Formularz waliduje wymagane pola i limity obrazów.<br>AC2: System blokuje trzeci raport w tym samym tygodniu.<br>AC3: Po wysyłce raport jest tylko do odczytu i ma znacznik czasu. |
| US-007 | Lista klientów | Jako trener chcę widzieć wszystkich moich klientów i informacji, kto przesłał raport, aby móc reagować. | AC1: Lista pokazuje status „Raport otrzymany” lub „Brak” dla bieżącego tygodnia.<br>AC2: Kliknięcie klienta otwiera jego stronę. |
| US-008 | Szczegóły raportu | Jako trener chcę zobaczyć szczegóły raportu, aby ocenić postępy. | AC1: Strona raportu wyświetla zdjęcia, pomiary, dni cardio, notatkę.<br>AC2: Pomiary zawierają różnicę vs poprzedni raport. |
| US-009 | Wykres trendów | Jako trener chcę zobaczyć wykresy pomiarów w czasie, aby wychwycić trendy. | AC1: Wykres liniowy dla każdego pomiaru z osią dat.<br>AC2: Przełącznik widoczności poszczególnych metryk. |
| US-010 | Porównanie zdjęć | Jako trener chcę porównać bieżące zdjęcia z wcześniejszymi, aby wizualnie ocenić zmiany. | AC1: UI pokazuje trzy najnowsze zdjęcia obok siebie.<br>AC2: Trener może wybrać dowolny raport do porównania. |
| US-011 | Reset hasła klienta | Jako trener chcę zresetować hasło klienta, gdy je zapomni, aby przywrócić dostęp. | AC1: Trener uruchamia reset; klient dostaje nowy link OTP.<br>AC2: Poprzednie hasło staje się nieważne natychmiast. |
| US-012 | Pełen dostęp super-admina | Jako super-admin chcę pełnej kontroli nad danymi i użytkownikami. | AC1: Super-admin może listować, edytować i usuwać dowolnego trenera lub klienta.<br>AC2: Super-admin widzi każdy raport i zdjęcia.<br>AC3: Akcje są logowane do audytu. |
| US-013 | Polityka retencji obrazów | Jako system muszę usuwać obrazy starsze niż 6 miesięcy, aby spełnić politykę przechowywania. | AC1: Codzienny proces oznacza obrazy >180 dni.<br>AC2: Obrazy są trwale usuwane lub archiwizowane zależnie od konfiguracji.<br>AC3: Usunięcia są logowane. |
| US-014 | Gotowość do i18n | Jako deweloper chcę przechowywać teksty w plikach lokalizacyjnych, aby łatwo dodać nowe języki. | AC1: Wszystkie komunikaty znajdują się w plikach tłumaczeń.<br>AC2: Zmiana języka w konfiguracji aktualizuje UI bez błędów. |
| US-015 | Dostępność (WCAG) | Jako użytkownik z niepełnosprawnością wzroku potrzebuję odpowiedniego kontrastu i etykiet ARIA, aby nawigować po aplikacji. | AC1: Wszystkie elementy interaktywne mają etykiety ARIA.<br>AC2: Współczynniki kontrastu spełniają WCAG AA.<br>AC3: Nawigacja klawiaturą obejmuje wszystkie fokusowalne elementy. |

## 6. Metryki sukcesu
1. Współczynnik wysyłki raportów tygodniowych ≥ 80 % (klienci przesyłający ≥ 1 raport w tygodniu).
2. Średni czas aktywacji konta klienta < 24 h od utworzenia.
3. ≤ 5 % duplikatów lub niekompletnych raportów tygodniowo.
4. Dostępność PWA klienta ≥ 99 % (okres kroczący 30 dni).
5. Skuteczność zadania kasującego obrazy >6 mies. = 100 %.
