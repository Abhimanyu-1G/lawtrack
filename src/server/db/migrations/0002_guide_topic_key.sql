-- ===========================================================================
-- Phase 3: bilingual guide pairing
--
-- AGENTS.md §4 permits extra implementation columns when the reason is recorded
-- in docs/DECISIONS.md. `topic_key` groups the English and Hindi versions of the
-- same guide so the detail page can offer an exact language switch, and so a
-- curator can see both versions of a topic. It carries no legal meaning.
-- ===========================================================================

ALTER TABLE Legal_Guide ADD COLUMN topic_key TEXT
  CHECK (topic_key IS NULL OR length(trim(topic_key)) BETWEEN 2 AND 80);

CREATE INDEX IF NOT EXISTS ix_guide_topic_language ON Legal_Guide (topic_key, language);
