# Gym Progress Report – Database Schema (PostgreSQL)

## 1. Tabele, kolumny i ograniczenia

### 1.1  `users`

This tabel is managed by Supabase Auth. 

| Kolumna | Typ | Ograniczenia |
|---------|-----|--------------|
| id | UUID | PRIMARY KEY (pochodzi z `auth.uid()`) |
| role | TEXT | NOT NULL, CHECK (role IN ('super_admin','trainer','client')) |
| email | TEXT | UNIQUE, NULLABLE (klienci logują się telefonem) |
| phone | TEXT | UNIQUE, NULLABLE |
| full_name | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

### 1.2  `trainers`
| Kolumna | Typ | Ograniczenia |
|---------|-----|--------------|
| id | UUID | PRIMARY KEY REFERENCES `users`(id) ON DELETE CASCADE |
| bio | TEXT | NULL |

### 1.3  `clients`
| Kolumna | Typ | Ograniczenia |
|---------|-----|--------------|
| id | UUID | PRIMARY KEY REFERENCES `users`(id) ON DELETE CASCADE |
| date_of_birth | DATE | NULL |
| gender | TEXT | NULL |
| deleted_at | TIMESTAMPTZ | NULL |

### 1.4  `trainer_client`
| Kolumna | Typ | Ograniczenia |
|---------|-----|--------------|
| trainer_id | UUID | NOT NULL REFERENCES `trainers`(id) ON DELETE CASCADE |
| client_id | UUID | NOT NULL REFERENCES `clients`(id) ON DELETE CASCADE |
| started_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| PRIMARY KEY | (trainer_id, client_id) | |

### 1.5  `reports`
| Kolumna | Typ | Ograniczenia |
|---------|-----|--------------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| client_id | UUID | NOT NULL REFERENCES `clients`(id) ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| week_number | INTEGER | NOT NULL |
| year | INTEGER | NOT NULL |
| sequence | INTEGER | NOT NULL DEFAULT 0 CHECK (sequence IN (0,1)) |
| weight | NUMERIC(6,2) | CHECK (weight >= 0) |
| waist | NUMERIC(6,2) | CHECK (waist >= 0) |
| chest | NUMERIC(6,2) | CHECK (chest >= 0) |
| biceps_left | NUMERIC(6,2) | CHECK (biceps_left >= 0) |
| biceps_right | NUMERIC(6,2) | CHECK (biceps_right >= 0) |
| thigh_left | NUMERIC(6,2) | CHECK (thigh_left >= 0) |
| thigh_right | NUMERIC(6,2) | CHECK (thigh_right >= 0) |
| cardio_days | INTEGER | CHECK (cardio_days BETWEEN 0 AND 7) |
| note | TEXT | NULL |
| deleted_at | TIMESTAMPTZ | NULL |
| UNIQUE | (client_id, week_number, year, sequence) | |

### 1.6  `report_images`
| Kolumna | Typ | Ograniczenia |
|---------|-----|--------------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| report_id | UUID | NOT NULL REFERENCES `reports`(id) ON DELETE CASCADE |
| storage_path | TEXT | NOT NULL |
| size_bytes | INTEGER | NOT NULL CHECK (size_bytes <= 10485760) |
| width | INTEGER | NULL |
| height | INTEGER | NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false |
| deleted_at | TIMESTAMPTZ | NULL |

---

## 2. Relacje między tabelami
1. `users` 1-to-1 `trainers`  (trener jest użytkownikiem)
2. `users` 1-to-1 `clients`   (klient jest użytkownikiem)
3. `trainers` 1-to-many `trainer_client`  (mapowanie aktywnych/archiwalnych przypisań)
4. `clients` 1-to-many `trainer_client`
5. `clients` 1-to-many `reports`
6. `reports` 1-to-many `report_images`

## 3. Indeksy
- `trainer_client`  (`trainer_id`, `is_active`, `started_at` DESC)
- `reports`         (`client_id`, `created_at` DESC)
- `reports_brin`    BRIN(`created_at`)
- `report_images_brin` BRIN(`created_at`)
- Unikalny łączony klucz w `reports` (client_id, week_number, year, sequence)

## 4. Zasady RLS (Row-Level Security)
1. **Domyślnie**: RLS włączone, brak dostępu.
2. **super_admin**: polityka `USING (true)` – pełny dostęp.
3. **trainer**:
   - `trainer_client`: `USING (trainer_id = auth.uid() AND is_active)`
   - `clients`, `reports`, `report_images`: dostęp jeśli istnieje aktywny wiersz w `trainer_client` łączący `trainer_id = auth.uid()` oraz `client_id`.
4. **client**:
   - Tabele związane z nim (`clients`, `reports`, `report_images`): `USING (id = auth.uid() OR client_id = auth.uid())`.

## 5. Dodatkowe uwagi
- **Trigger** na `reports` automatycznie ustala `week_number` oraz `year` na podstawie `created_at`.
- **Procedura retencji obrazów** (cron): codziennie oznacza `is_deleted = true` dla obrazów >180 dni, a następnie usuwa obiekty ze Storage.
- Soft-delete realizowany przez kolumnę `deleted_at` oraz opcjonalne triggery kaskadowe.
- Pole `note` pozostaje pełnym `TEXT`; limit/validacja może być dodana w warstwie aplikacji.
- Partycjonowanie tabel nie jest obecnie wymagane; rozważenie przy dużej skali.
