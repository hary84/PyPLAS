CREATE TABLE progress (
    p_id TEXT PRIMARY KEY,
    q_status JSON NOT NULL,
    q_content JSON NOT NULL,
    p_status INT DEFAULT 0,
    saved_at DEFAULT CURRENT_TIMESTAMP,
    CHECK(p_status = 0 OR p_status = 1 OR p_status = 2)
)