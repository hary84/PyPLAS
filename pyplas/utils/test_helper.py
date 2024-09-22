
from numbers import Real
from typing import Optional


def check_num_equal(true_n:Real, target_n:Real, 
                     var_name:str="", ndigits:Optional[int]=None):
    """
    true_nとtarget_nが等しいかを比較する 

    Parameters
    ----------
    true_n: Real  
        比較の際に想定される値
    target_n: Real  
        実際に比較したい値
    var_name: str  
        エラー発生時に表示したい変数名
    n_digits: int or None 
        少数第何位まで丸め込むのかを決定する. 値がNoneの場合, 値の丸め込みは行わない.
    """
    assert isinstance(target_n, Real), f"変数{var_name}には数値型のデータを格納してください"

    if ndigits is not None:
        try:
            true_n = round(true_n, ndigits=ndigits)
            target_n = round(target_n, ndigits=ndigits)
        except: 
            raise AssertionError(f"変数{var_name}は{type(target_n).__name__}型のためround関数により値を丸めることができません")

    assert true_n == target_n, f"変数{var_name}の値が異なります"


def cast(value: Real, astype: type, var_name: str):
    try:
        return astype(value)
    except: 
        raise AssertionError(f"変数{var_name}には{astype.__name__}型のデータを格納してください")