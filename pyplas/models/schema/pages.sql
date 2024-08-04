CREATE TABLE pages(
    p_id TEXT PRIMARY KEY, 
    title TEXT UNIQUE NOT NULL, 
    page TEXT NOT NULL, 
    category INT, 
    status INT DEFAULT 0,
    answers TEXT NOT NULL,
    register_at DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category) REFERENCES categories(cat_id) ON DELETE SET NULL,
    CHECK (JSON_VALID(page)=1 AND JSON_TYPE(page)='object'),
    CHECK (status=0 or status=1),
    CHECK (JSON_VALID(answers)=1 AND JSON_TYPE(answers)='object')
)