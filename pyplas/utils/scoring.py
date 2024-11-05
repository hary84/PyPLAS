from numbers import Real
from typing import Any, Literal, Optional, TypeVar

import numpy as np
import pandas as pd 
from pandas.testing import assert_series_equal, assert_frame_equal
from sklearn import metrics

T = TypeVar("T")

def check_num_equal(true_num: Any, target_num: Any, var_name:str="") -> bool:
    """
    2つの数値true_numとtarget_numが等しいかを比較する  
    """
    assert isinstance(true_num, Real), f"true_numには数値(Real型)を継承する値を代入してください"
    assert isinstance(target_num, Real), f"変数{var_name}には数値を代入してください"

    assert true_num == target_num, "\n".join([
        f"変数{var_name}の値が異なります.",
        f"あなたの解答: {target_num}, 正答: {true_num}"
    ])
    return True

def check_num_approx_equal(true_num: Any, target_num: Any, var_name:str="",
                           ndigits: int = 0) -> bool:
    """
    true_numとtarget_numがndigits桁まで等しいかを検証する  
    検証に際して, 各値はfloat型にキャストされ, round関数によって桁数が丸められる  
    """
    assert isinstance(true_num, Real), f"true_numには数値(Real型)を継承する値を代入してください"
    assert isinstance(target_num, Real), f"変数{var_name}には数値を代入してください"

    true = mycast(true_num, float)
    target = mycast(target_num, float, var_name)

    true_rounded = round(true, ndigits)
    target_rounded = round(target, ndigits)

    assert true_rounded == target_rounded, "\n".join([
        f"変数{var_name}の値が異なります.",
        f"あなたの解答: {target_num}({target_rounded}), 正答: {true_num}({true_rounded})",
    ])

    return True

def check_ndarray_equal(true_n: np.ndarray, target_n: np.ndarray,
                        var_name: str="", ndigits: Optional[int]=None) -> bool:
    """
    true_nとtarget_nのndarrayが等しいかを比較する

    Parameters
    ----------
    true_n: np.ndarray
        比較の際に想定されるndarray配列
    target_n: np.ndarray
        実際に比較したいndarray配列
    var_name: str
        エラーの際に表示したい変数名
    ndigits: int or None
        少数第何位まで丸め込むのかを決定する. 値がNoneの場合, 値の丸め込みは行わない
    """
    assert type(true_n) == np.ndarray, f"true_nにはnp.ndarrayを代入してください"
    assert type(target_n) == np.ndarray, f"変数{var_name}にはnp.ndarrayを格納してください"

    if ndigits is not None:
        try:
            true_n = true_n.round(ndigits)
            target_n = target_n.round(ndigits)
        except:
            raise AssertionError(f"変数{var_name}はroundメソッドにより値を丸める事ができませんでした")
    
    assert np.array_equal(true_n, target_n, equal_nan=True), "\n".join([
        f"変数{var_name}の値が異なります.",
        f"正しい値:",
        f"{true_n}",
        "\n",
        "あなたの解答:",
        f"{target_n}"
    ])
    return True

def check_series_equal(true_series: pd.Series, target_series: pd.Series, 
                       var_name: str="", **kwargs) -> bool:
    """
    true_seriesとtarget_seriesが等しいかを比較する

    Parameters
    ----------
    true_series: pd.Series
        比較の際に想定されるSeries
    target_series: pd.Series
        実際に比較したいSeries
    **kwargs
        pd.testing.assert_series_equalに渡す引数
    """
    assert isinstance(true_series, pd.Series), "\n".join(["="*50,
            f"true_seriesにはpd.Seriesを代入してください"])
    assert isinstance(target_series, pd.Series), "\n".join(["="*50,
            f"変数{var_name}にはpd.Seriesを格納してください"])

    kw:dict[str, Any] = {"obj": var_name}
    kw.update(kwargs)

    err_msg = ""
    try:
        assert_series_equal(true_series, target_series, **kw)
    except AssertionError as e:
        err_msg = str(e)

    assert len(err_msg) == 0, "\n".join(["="*50,
        err_msg,
        "(left: correct answer, right: your answer)",
    ])
    return True

    
def check_frame_equal(true_df: pd.DataFrame, target_df: pd.DataFrame,
                      var_name: str="", **kwargs) -> bool:
    """
    true_dfとtarget_dfが等しいかを比較する

    Parameters
    ----------
    true_df: pd.DataFrame
        比較の際に想定されるDataFrame
    target_series: pd.DataFrame
        実際に比較したいDataFrame
    **kwargs
        pd.testing.assert_frame_equalに渡す引数
    """
    assert isinstance(true_df, pd.DataFrame), "\n".join(["="*50,
            f"target_dfにはpd.DataFrameを格納してください"])
    assert isinstance(target_df, pd.DataFrame), "\n".join(["="*50,
            f"変数{var_name}にはpd.DataFrameを格納してください"])

    err_msg = ""
    try:
        assert_frame_equal(true_df, target_df, **kwargs)
    except AssertionError as e:
        err_msg = str(e)

    assert len(err_msg) == 0, "\n".join(["="*50,
            err_msg,                             
            "(left: correct answer, right: your answer)",
        ])
    return True

def check_cls_model_score(y_true, y_target, scoring: Literal["accuracy", "recall", "precision"]="accuracy",
                          var_name: str="", allow_type: Optional[list[type]]=None, **kwargs):
    ALLOW_TYPE = allow_type or [np.ndarray]
    METRICS = {
        "accuracy": metrics.accuracy_score,
        "recall": metrics.recall_score,
        "precision": metrics.precision_score
    }

    assert type(y_true) in ALLOW_TYPE, "\n".join(["="*50,
                f"y_trueには{ALLOW_TYPE}のいずれかを代入してください"])
    assert type(y_target) in ALLOW_TYPE, "\n".join(["="*50,
                f"変数{var_name}には{ALLOW_TYPE}のいずれかを代入してください"])
    
    try:
        y_target = y_target.reshape(y_true.shape)
    except Exception as e: 
        raise AssertionError("\n".join(["="*50, 
                f"{var_name}の形を{y_true.shape}に揃えてください"]))

    try:
        score = METRICS[scoring](y_true, y_target, **kwargs)
    except Exception as e:
        raise AssertionError("\n".join(["="*50,
                "値の評価中に想定外のエラーが発生しました",
                "",
                f"{str(e)}"]))

    return score
    


def mycast(value: Any, astype: type[T], var_name: str="") -> T:
    """
    valueをastypeで指定した型にキャストする  
    キャストに失敗した場合, AssertionErrorを投げる
    """
    try:
        return astype(value)
    except: 
        raise AssertionError("\n".join(["="*50,
            f"変数{var_name}の型キャストに失敗しました",
            f"{type(value)} -> {astype}"
        ]))
    
def check_array_like(value, disallow: list[type]=[]):
    allowd_type = {list, }