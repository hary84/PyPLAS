CREATE TABLE logs(
    p_id TEXT,
    q_id TEXT,
    category INT,
    content TEXT NOT NULL,
    result INT NOT NULL,
    answer_at DEFAULT CURRENT_TIMESTAMP,
    CHECK( result = 1 OR result = 2),
    CHECK (JSON_VALID(content) AND JSON_TYPE(content) = 'array')
)