-- ===========================================================================
-- LawTrack initial schema (AGENTS.md §4)
-- 18 ER tables + 4 permitted helper tables. `source_excerpt` is the one
-- explicitly permitted ADDED column on Legal_Guide.
--
-- Conventions:
--   * identifiers follow the Lab-9 ER exactly (PascalCase tables, snake_case cols)
--   * timestamps are UTC text 'YYYY-MM-DD HH:MM:SS'; dates are 'YYYY-MM-DD'
--   * booleans are INTEGER 0/1 (SQLite has no native boolean)
--   * every enum and length rule from the spec is enforced with a CHECK
--   * foreign keys are ON DELETE CASCADE for owned detail rows and
--     RESTRICT/SET NULL where history must survive
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Identity and role profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS User (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  email         TEXT    NOT NULL CHECK (length(trim(email)) BETWEEN 3 AND 120),
  phone_number  TEXT    CHECK (
                    phone_number IS NULL
                    OR phone_number GLOB '[6-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                  ),
  password_hash TEXT    NOT NULL CHECK (length(password_hash) BETWEEN 20 AND 255),
  role          TEXT    NOT NULL CHECK (role IN ('Citizen', 'Lawyer', 'Curator', 'Administrator', 'API Manager')),
  language      TEXT    NOT NULL CHECK (language IN ('English', 'Hindi')),
  is_verified   INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1))
);

-- Case-insensitive email uniqueness (AGENTS.md §5: "unique, case-insensitive").
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_email ON User (email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS Legal_Aid_Lawyer (
  user_id          INTEGER PRIMARY KEY REFERENCES User (user_id) ON DELETE CASCADE,
  bar_council_id   TEXT    NOT NULL CHECK (length(trim(bar_council_id)) BETWEEN 3 AND 30),
  specialization   TEXT    CHECK (specialization IS NULL OR length(specialization) <= 60),
  experience_years INTEGER CHECK (experience_years IS NULL OR (experience_years >= 0 AND experience_years <= 60)),
  status           TEXT    NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Busy', 'Offline'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lawyer_bar ON Legal_Aid_Lawyer (bar_council_id);

CREATE TABLE IF NOT EXISTS Content_Curator (
  user_id         INTEGER PRIMARY KEY REFERENCES User (user_id) ON DELETE CASCADE,
  expertise       TEXT CHECK (expertise IS NULL OR length(expertise) <= 60),
  validated_count INTEGER NOT NULL DEFAULT 0 CHECK (validated_count >= 0)
);

CREATE TABLE IF NOT EXISTS System_Administrator (
  user_id     INTEGER PRIMARY KEY REFERENCES User (user_id) ON DELETE CASCADE,
  admin_level TEXT NOT NULL DEFAULT 'Standard' CHECK (admin_level IN ('Super', 'Standard')),
  last_login  TEXT CHECK (last_login IS NULL OR last_login GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE TABLE IF NOT EXISTS API_Integration_Manager (
  user_id          INTEGER PRIMARY KEY REFERENCES User (user_id) ON DELETE CASCADE,
  managed_services TEXT    CHECK (managed_services IS NULL OR length(managed_services) <= 120),
  on_call_status   TEXT    NOT NULL DEFAULT 'Available' CHECK (on_call_status IN ('Available', 'On Call', 'Offline'))
);

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Legal_Guide (
  guide_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  curator_id        INTEGER REFERENCES Content_Curator (user_id) ON DELETE SET NULL,
  title             TEXT    NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 150),
  category          TEXT    NOT NULL CHECK (length(trim(category)) BETWEEN 2 AND 50),
  plain_summary     TEXT    NOT NULL CHECK (length(plain_summary) >= 20),
  source_statute    TEXT    NOT NULL CHECK (length(trim(source_statute)) BETWEEN 2 AND 200),
  language          TEXT    NOT NULL CHECK (language IN ('English', 'Hindi')),
  validation_status TEXT    NOT NULL DEFAULT 'Draft' CHECK (validation_status IN ('Draft', 'Valid', 'Requires AI Update')),
  last_updated      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
                    CHECK (last_updated GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  source_excerpt    TEXT    CHECK (source_excerpt IS NULL OR length(source_excerpt) <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_guide_title_language ON Legal_Guide (title, language);
CREATE INDEX IF NOT EXISTS ix_guide_filter ON Legal_Guide (category, language, validation_status);
CREATE INDEX IF NOT EXISTS ix_guide_status_updated ON Legal_Guide (validation_status, last_updated);

CREATE TABLE IF NOT EXISTS Citizen (
  user_id              INTEGER PRIMARY KEY REFERENCES User (user_id) ON DELETE CASCADE,
  address              TEXT CHECK (address IS NULL OR length(address) <= 255),
  state                TEXT CHECK (state IS NULL OR length(state) <= 50),
  last_viewed_guide_id INTEGER REFERENCES Legal_Guide (guide_id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS API_Integration (
  integration_id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id     INTEGER NOT NULL REFERENCES API_Integration_Manager (user_id) ON DELETE RESTRICT,
  service_name   TEXT    NOT NULL CHECK (length(trim(service_name)) BETWEEN 2 AND 60),
  status         TEXT    NOT NULL DEFAULT 'Healthy' CHECK (status IN ('Healthy', 'Degraded', 'Down')),
  last_sync_time TEXT CHECK (last_sync_time IS NULL OR last_sync_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  error_count    INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_service ON API_Integration (service_name);

CREATE TABLE IF NOT EXISTS Court_Case (
  case_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id    INTEGER NOT NULL REFERENCES API_Integration (integration_id) ON DELETE RESTRICT,
  cnr_number        TEXT    NOT NULL CHECK (cnr_number GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  case_title        TEXT    NOT NULL CHECK (length(trim(case_title)) BETWEEN 1 AND 200),
  court_name        TEXT    NOT NULL CHECK (length(trim(court_name)) BETWEEN 1 AND 120),
  status            TEXT    NOT NULL CHECK (status IN ('Pending', 'Disposed')),
  next_hearing_date TEXT    CHECK (next_hearing_date IS NULL OR next_hearing_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  last_synced_at    TEXT    NOT NULL CHECK (last_synced_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_court_case_cnr ON Court_Case (cnr_number);
CREATE INDEX IF NOT EXISTS ix_court_case_status ON Court_Case (status, next_hearing_date);

CREATE TABLE IF NOT EXISTS Hearing (
  hearing_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id       INTEGER NOT NULL REFERENCES Court_Case (case_id) ON DELETE CASCADE,
  hearing_date  TEXT    NOT NULL CHECK (hearing_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  purpose       TEXT    NOT NULL CHECK (length(trim(purpose)) BETWEEN 1 AND 150),
  order_summary TEXT,
  order_url     TEXT CHECK (order_url IS NULL OR length(order_url) <= 255)
);

CREATE INDEX IF NOT EXISTS ix_hearing_case_date ON Hearing (case_id, hearing_date);

-- ---------------------------------------------------------------------------
-- Chatbot (UC-02)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Chat_Session (
  session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizen_id INTEGER NOT NULL REFERENCES Citizen (user_id) ON DELETE CASCADE,
  start_time TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
             CHECK (start_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  end_time   TEXT    CHECK (end_time IS NULL OR end_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  language   TEXT    NOT NULL CHECK (language IN ('English', 'Hindi')),
  CHECK (end_time IS NULL OR end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS ix_chat_session_citizen ON Chat_Session (citizen_id, start_time);

CREATE TABLE IF NOT EXISTS Chat_Message (
  message_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES Chat_Session (session_id) ON DELETE CASCADE,
  question      TEXT    NOT NULL CHECK (length(question) BETWEEN 1 AND 1000),
  answer        TEXT    NOT NULL CHECK (length(answer) BETWEEN 1 AND 8000),
  sources_cited TEXT    CHECK (sources_cited IS NULL OR length(sources_cited) <= 255),
  timestamp     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
                CHECK (timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_chat_message_session ON Chat_Message (session_id, timestamp);

-- ---------------------------------------------------------------------------
-- Drafts and lawyer review
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Legal_Draft (
  draft_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  citizen_id     INTEGER NOT NULL REFERENCES Citizen (user_id) ON DELETE CASCADE,
  draft_type     TEXT    NOT NULL CHECK (draft_type IN ('Complaint', 'RTI', 'Legal Notice')),
  form_data      TEXT    NOT NULL CHECK (length(form_data) BETWEEN 2 AND 5000),
  generated_text TEXT    NOT NULL CHECK (length(generated_text) BETWEEN 1 AND 20000),
  status         TEXT    NOT NULL CHECK (status IN ('Pending Review', 'Approved', 'Rejected', 'Regenerating')),
  version        INTEGER NOT NULL CHECK (version >= 1),
  created_at     TEXT    NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_draft_citizen ON Legal_Draft (citizen_id, created_at);
CREATE INDEX IF NOT EXISTS ix_draft_status ON Legal_Draft (status, created_at);

CREATE TABLE IF NOT EXISTS Draft_Review (
  review_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id    INTEGER NOT NULL REFERENCES Legal_Draft (draft_id) ON DELETE CASCADE,
  lawyer_id   INTEGER NOT NULL REFERENCES Legal_Aid_Lawyer (user_id) ON DELETE RESTRICT,
  decision    TEXT    NOT NULL CHECK (decision IN ('Approved', 'Rejected')),
  remarks     TEXT,
  reviewed_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
              CHECK (reviewed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_review_draft ON Draft_Review (draft_id, reviewed_at);
CREATE INDEX IF NOT EXISTS ix_review_lawyer ON Draft_Review (lawyer_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- Notifications, audit, subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Notification (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES User (user_id) ON DELETE CASCADE,
  case_id         INTEGER REFERENCES Court_Case (case_id) ON DELETE SET NULL,
  message         TEXT    NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 255),
  channel         TEXT    NOT NULL CHECK (channel IN ('In-App', 'Email', 'SMS')),
  status          TEXT    NOT NULL CHECK (status IN ('Unread', 'Delivered', 'Sent', 'Failed')),
  timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
                  CHECK (timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_notification_user ON Notification (user_id, status, timestamp);
CREATE INDEX IF NOT EXISTS ix_notification_case ON Notification (case_id, timestamp);

CREATE TABLE IF NOT EXISTS Audit_Log (
  log_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  performed_by INTEGER NOT NULL REFERENCES User (user_id) ON DELETE RESTRICT,
  action       TEXT    NOT NULL CHECK (length(trim(action)) BETWEEN 2 AND 100),
  details      TEXT,
  timestamp    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
               CHECK (timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_audit_timestamp ON Audit_Log (timestamp);
CREATE INDEX IF NOT EXISTS ix_audit_actor ON Audit_Log (performed_by, timestamp);

CREATE TABLE IF NOT EXISTS Case_Tracking (
  citizen_id    INTEGER NOT NULL REFERENCES Citizen (user_id) ON DELETE CASCADE,
  case_id       INTEGER NOT NULL REFERENCES Court_Case (case_id) ON DELETE CASCADE,
  subscribed_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
                CHECK (subscribed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  PRIMARY KEY (citizen_id, case_id)
);

CREATE TABLE IF NOT EXISTS Guide_View (
  citizen_id INTEGER NOT NULL REFERENCES Citizen (user_id) ON DELETE CASCADE,
  guide_id   INTEGER NOT NULL REFERENCES Legal_Guide (guide_id) ON DELETE CASCADE,
  viewed_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
             CHECK (viewed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  PRIMARY KEY (citizen_id, guide_id, viewed_at)
);

-- ---------------------------------------------------------------------------
-- Implementation helpers explicitly permitted by AGENTS.md §4
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Otp_Code (
  otp_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES User (user_id) ON DELETE CASCADE,
  code_hash   TEXT    NOT NULL,
  purpose     TEXT    NOT NULL CHECK (purpose IN ('verify', 'login')),
  expires_at  TEXT    NOT NULL CHECK (expires_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  attempts    INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  consumed_at TEXT,
  created_at  TEXT    NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_otp_user ON Otp_Code (user_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS System_Setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Metric_Event (
  metric_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  metric     TEXT NOT NULL CHECK (length(trim(metric)) BETWEEN 2 AND 64),
  value      REAL NOT NULL,
  ref_id     TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
             CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS ix_metric_event_metric ON Metric_Event (metric, created_at);

CREATE TABLE IF NOT EXISTS Guide_Embedding (
  guide_id   INTEGER PRIMARY KEY REFERENCES Legal_Guide (guide_id) ON DELETE CASCADE,
  model      TEXT NOT NULL CHECK (length(trim(model)) BETWEEN 1 AND 80),
  vector     TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
             CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
);
