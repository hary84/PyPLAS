import json
import os 
import sqlite3
from typing import Any, Literal, Optional, Union
import uuid 
import random

from faker import Faker
from tornado.testing import AsyncHTTPTestCase

from pyplas import config as cfg 
from pyplas.app import make_app
from pyplas.models import create_problem_db, create_user_db

TEST_DB_PATH = "pyplas/database/test_pyplas.db"
TEST_USR_PATH = "pyplas/database/test_user.db"

fakegen = Faker("jp-JP")

class MyHTTPTestCase(AsyncHTTPTestCase):
    def get_app(self, develop=False):
        return make_app(develop=develop)

def default_if_none(value, default):
    """
    valueがNoneの時, defaultの値を返す  
    valueがNoneでないとき, valueを返す
    """
    if value is None:
        return default
    return value


class DummyNodeParams:
    @property
    def params(self) -> dict:
        return self.__dict__

class ExplainNodeParams(DummyNodeParams):
    def __init__(self, content: Optional[str] = None):
        self.type = "explain"
        self.content = default_if_none(content, fakegen.text())

class CodeNodeParams(DummyNodeParams):
    def __init__(self, 
                 content :Optional[str] = None, 
                 readonly: Optional[bool] = None):
        fakegen = Faker("jp-JP")
        self.type = "code"
        self.content = default_if_none(content, fakegen.text())
        self.readonly = default_if_none(readonly, fakegen.boolean())

class QuestionNodeParams(DummyNodeParams):
    def __init__(
            self, 
            q_id: Optional[str] = None,
            ptype: Optional[Literal[0, 1]] = None,
            question: Optional[str] = None,
            editable: Optional[bool] = None
            ):
        self.type = "question"
        self.q_id = default_if_none(q_id, str(uuid.uuid4()))
        self.ptype = default_if_none(ptype, random.choice([0, 1]))
        self.conponent = self._construct_conponent(length=3)
        self.question = default_if_none(question, fakegen.text())
        self.editable = default_if_none(editable, fakegen.boolean())

    def _construct_conponent(self, length:int) -> list:
        conponents = []
        for _ in range(length):
            conponents.append(random.choice([ExplainNodeParams(), CodeNodeParams()]).__dict__)
        return conponents


def make_dummy_page(length):
    """
    pagesテーブルのpageカラムを生成する

    Parameters
    ----------
    length: int
        生成するページの長さ
    """
    return json.dumps({
        "header": {
            "summary": fakegen.text(),
            "source": fakegen.text(),
            "env": fakegen.text()
        },
        "body": [
            random.choice([
                ExplainNodeParams(),
                CodeNodeParams(),
                QuestionNodeParams()
            ]).__dict__ for _ in range(length) 
        ]
    })

class DummyRecord:
    """ダミーレコード生成の基底クラス"""
    null = "__null"

    @property
    def params(self) -> dict:
        return self.__dict__
    
    def default_if_null(self, value, default):
        if value == DummyRecord.null:
            return default 
        return value

class CategoryDummyRecord(DummyRecord):
    def __init__(
            self,
            cat_name: Optional[str] = None,
            logo_url: Optional[str] = DummyRecord.null,
            description: Optional[str] = DummyRecord.null,
            ):
        """
        categoriesテーブル用ダミーレコード  

        引数として与えられていないパラメータはランダムに生成される
        """
        self.cat_name = default_if_none(cat_name, fakegen.unique.country())
        self.logo_url = self.default_if_null(logo_url, fakegen.url())
        self.description = self.default_if_null(description, fakegen.text())

class PagesDummyRecord(DummyRecord):
    def __init__(
            self, 
            category: Optional[int],
            p_id: Optional[str] = None,
            title: Optional[str] = None,
            status: Optional[Literal[0, 1]] = None,
            answers: Optional[dict] = None
            ):
        """
        pagesテーブル用ダミーレコード
        
        `category`は必ず指定する必要がある．  
        それ以外で引数として与えられていないパラメータはランダムに生成される
        """
        self.category = category
        self.p_id = default_if_none(p_id, str(uuid.uuid4()))
        self.title = default_if_none(title, fakegen.unique.word())
        self.page = make_dummy_page(length=4)
        self.status = default_if_none(status, random.choice([0, 1]))

        if answers is None:
            self.answers = json.dumps({
                "1": ["1", "2"], "2": ["assert a = 1"]
            })
        else:
            self.answers = json.dumps(answers)

class LogDummyRecord(DummyRecord):
    def __init__(
            self,
            p_id: str,
            category: Optional[str],
            q_id: Optional[str] = None,
            content: Optional[list[str]] = None,
            result: Optional[Literal[1, 2]] = None,
            ):
        """
        logsテーブル用ダミーレコード
        
        `p_id`, `category`は必ず指定する必要があるが, それ以外は引数として与えられなければランダムに生成される
        """
        self.p_id = p_id
        self.category = category
        self.q_id = default_if_none(q_id, random.choice(["0", "1", "2"]))
        self.content = default_if_none(content, [fakegen.text() for _ in range(random.randint(1, 3))])
        self.result = default_if_none(result, random.choices([1, 2]))

Q_STATUS = dict[str, Literal[1, 2]]

class ProgressDummyRecord(DummyRecord):
    def __init__(
            self,
            p_id: str,
            q_ids: list[str],
            p_status: Optional[Literal[0, 1, 2]] = None,
            ):
        self.p_id= p_id 
        self.p_status = default_if_none(p_status, random.choice([1, 2]))
        self.q_status = self._create_status(q_ids)
        self.q_content = self._create_content(q_ids)
        self.p_status = default_if_none(p_status, random.choice([0, 1, 2]))

    def _create_status(self, q_ids: list[str]):
        return json.dumps({
            q_id: random.choice([1, 2])
            for q_id in q_ids
        })
    
    def _create_content(self, q_ids: list[str]):
        return json.dumps({
            q_id: [fakegen.text() for _ in range(3)]
            for q_id in q_ids
        })


class DummyDB:
    def __init__(self, delete=True) -> None:
        """
        テスト用の問題DBを作成する

        Parameters
        ----------
        delete: bool
            終了時に作成したDBを削除するか
        """
        self.delete = delete

        cfg.PROBLEM_DB_PATH = TEST_DB_PATH
        cfg.USER_DB_PATH = TEST_USR_PATH
        create_problem_db(cfg.PROBLEM_DB_PATH)
        create_user_db(cfg.USER_DB_PATH)

        self.cate_records = []
        self.page_records = [] 
        self.progress_records = []
        self.log_records = []

    def set_problemDB(self, 
                      categories: Union[int, list] = 0, 
                      pages: Union[int, list] = 0,
                      progress: list = [],
                      logs: list = []):
        """
        テスト用問題DBにダミーデータをいれる
        
        Parameters
        ----------
        categories: int or list 
            引数にint型を指定した場合, categoriesテーブルにランダムなダミーデータを  
            recordsの数だけレコードを作成する  
            list型を指定した場合, list内のDummyRecordを使ってレコードを作成する
        pages: int or list 
            引数にint型を指定した場合, pagesテーブルにランダムなダミーデータを  
            recordsの数だけレコードを作成する  
            list型を指定した場合, list内のDummyRecordを使ってレコードを作成する
        """
        try:
            with sqlite3.connect(TEST_DB_PATH) as conn:
                self._set_categories(conn, records=categories)
                self._set_pages(conn, records=pages)
            with sqlite3.connect(TEST_USR_PATH) as conn:
                self._set_progress(conn, progress)
                self._set_logs(conn, logs)
        except Exception as e:
            if os.path.exists(TEST_DB_PATH) and self.delete:
                os.remove(TEST_DB_PATH)
            if os.path.exists(TEST_USR_PATH):
                os.remove(TEST_USR_PATH)
            raise e
        
    def _set_categories(
            self, 
            conn: sqlite3.Connection, 
            records: Union[int, list[CategoryDummyRecord]]
            ):
        """
        categoriesテーブルにダミーデータをいれる

        Parameters
        ----------
        conn: sqlite3.Connection
            問題DBとのコネクション
        records: int or list 
            引数にint型を指定した場合, ランダムなダミーデータをrecordsの数だけ
            レコードを作成する  
            list型を指定した場合, list内のDummyRecordを使ってレコードを作成する
        """
        if isinstance(records, int):
            params =  self._create_dummy_category_params(length=records)
        elif isinstance(records, list):
            self.cate_records = records
            params = [record.params for record in records]
        else:
            raise TypeError("argment 'records' must be int or list")
            
        SQL = r"""INSERT INTO categories(cat_name, logo_url, description)
                VALUES(:cat_name, :logo_url, :description)"""
        conn.executemany(SQL, params)
        conn.commit()

    def _create_dummy_category_params(self, length) -> list[dict[str, Any]]:
        """
        categoriesテーブルのランダムなダミーデータを作成する
        """
        records: list[CategoryDummyRecord] = []
        for i in range(length):
            records.append(CategoryDummyRecord())
        self.cate_records = records
        return [record.params for record in records]
    
    def _set_pages(
            self, 
            conn: sqlite3.Connection, 
            records: Union[int, list[PagesDummyRecord]]
            ):
        """
        pagesテーブルにダミーデータを入れる
        
        Parameters
        ----------
        conn: sqlite3.Connection
            テスト用問題DBとのコネクション
        records: int or list 
            引数にint型を指定した場合, ランダムなダミーデータをrecordsの数だけ
            レコードを作成する  
            list型を指定した場合, list内のDummyRecordを使ってレコードを作成する
        """
        if isinstance(records, int):
            params = self._create_dummy_pages_params(length=records)
        elif isinstance(records, list):
            self.page_records = records
            params = [record.params for record in records]
        else:
            raise TypeError("argment 'records' must be int or list.")
        
        SQL = r"""INSERT INTO pages(p_id, title, page, category, status, answers)
            VALUES(:p_id, :title, :page, :category, :status, :answers)"""
        conn.executemany(SQL, params)
        conn.commit()
    
    def _create_dummy_pages_params(self, length) -> list[dict]:
        """
        pagesテーブルのランダムなダミーデータを作成する
        """
        records: list[PagesDummyRecord] = []
        for _ in range(length):
            category = random.choice(range(1, len(self.cate_records)+1))
            records.append(PagesDummyRecord(category=category))
        self.page_records = records
        return [record.params for record in records]

    def _set_progress(
            self, 
            conn: sqlite3.Connection, 
            records: list[ProgressDummyRecord]
            ):
        """
        pagesテーブルにダミーデータを入れる
        
        Parameters
        ----------
        conn: sqlite3.Connection
            テスト用問題DBとのコネクション
        records: list 
            list内のDummyRecordを使ってレコードを作成する
        """
        self.progress_records = records
        params = [record.params for record in records]

        SQL = r"""INSERT INTO progress(p_id, q_status, q_content, p_status)
            VALUES(:p_id, JSON(:q_status), JSON(:q_content), :p_status)"""
        conn.executemany(SQL, params)
        conn.commit()

    def _set_logs(
            self, 
            conn: sqlite3.Connection, 
            records: list[LogDummyRecord]
            ):
        """
        pagesテーブルにダミーデータを入れる
        
        Parameters
        ----------
        conn: sqlite3.Connection
            テスト用問題DBとのコネクション
        records: list 
            list内のDummyRecordを使ってレコードを作成する
        """
        self.log_records = records
        params = [record.params for record in records]

        SQL = r"""INSERT INTO logs(p_id, category, q_id, content, result)
            VALUES(:p_id, :category, :q_id, :content, :result)"""
        conn.executemany(SQL, params)
        conn.commit()        
    
    def clean_up(self):
        """
        テスト用DBを削除する
        """
        if self.delete:
            if os.path.exists(TEST_DB_PATH):
                os.remove(TEST_DB_PATH)
            if os.path.exists(TEST_USR_PATH):
                os.remove(TEST_USR_PATH)
