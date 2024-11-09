import locale

# ==============================
#  PATH
# ==============================
### docker bind mount dir path 
SHARE_DIR = "share/"

### sqlite database path 
DB_DIR = "pyplas/database/"
PROBLEM_DB_PATH =  DB_DIR + "pyplas.db"
USER_DB_PATH =  SHARE_DIR + "user.db"
DEV_USER_DB_PATH = DB_DIR + "dev-user.db"

### sqlite table schema dir path
SCHEMA_PATH = "pyplas/models/schema"

### template and static dir path
TEMPLATE_DIR = "pyplas/templates"
STATIC_DIR = "pyplas/static"

### request json schema dir path
JSON_SCHEMA_PATH = "pyplas/utils/schema"

### tmpfile save path
PYTHON_TEMP_DIR = "pyplas/temp"


# ==============================
#  ENCODING
# ==============================
### Enocoding when writing files
### Used to output the results of code scoring problems.
### default
### Windows -> cp932 (jp)
### linux   -> utf-8
PREFERRED_ENCODING = locale.getpreferredencoding()