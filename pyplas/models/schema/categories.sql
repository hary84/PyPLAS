CREATE TABLE categories(
    cat_id INTEGER PRIMARY KEY,
    cat_name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    description TEXT
)