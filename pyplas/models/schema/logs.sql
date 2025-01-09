CREATE TABLE logs(
    p_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category INT,
    q_id TEXT NOT NULL,
    ptype INT NOT NULL,
    content TEXT NOT NULL,
    result INT NOT NULL,
    error_cls TEXT,
    answer_at DEFAULT CURRENT_TIMESTAMP,
    CHECK (ptype = 0 OR ptype = 1),
    CHECK (result = 1 OR result = 2),
    CHECK (JSON_VALID(content) AND JSON_TYPE(content) = 'array')
)