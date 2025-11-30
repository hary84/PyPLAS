//@ts-check

/**
 * 問題のメタ情報を提供する  
 * URLから問題IDと実行モードを解析し，`p_id`と`mode`に格納する
 */
export const problem_meta = (() => {
    const match = window.location.pathname.match(/(?<parent_path>problems|create)\/(?<p_id>[-\w]+)/);
    const groups = match?.groups || {};

    const mode = groups.parent_path;
    const p_id = groups.p_id;

    return {
        modes: {
            create: "create",
            problems: "problems"
        },
        /** モード (例: `"problems"`, `"create"`) */
        mode,
        /** 問題ID */
        p_id,
        /** モードが `"create"` なら `true` */
        isCreateMode() {
            return this.mode === this.modes.create;
        }
    };
})();

console.log(`problem_id(p_id) is '${problem_meta.p_id}'`)
console.log(`mode is '${problem_meta.mode}'`)

/**
 * `value`が`null`や`undefined`でないことを確認する  
 * `null`, `undefined`の場合，引数`error`で指定したエラーを発生させる
 * @template T
 * @param {T | null | undefined} value 
 * @param {Error} error
 * @returns {T}
 */
export function notNull(value, error=Error()) {
    if (value === null || value === undefined) {
        throw error
    }
    return value
}

/**
 * objのpropertyを監視し，値が変化した際に`func`を実行する  
 * `func`は引数として，`obj`, `プロパティの変化前の値`, `プロパティの変化後の値`を持たなければならない
 * @example
 * const a = {
 *  test: "test"
 * }
 * function printNewValue(obj, oldV, newV) {
 *  console.log(newV)
 * }
 * 
 * watchValue(a, "test", printNewValue)
 * a.test = "new test"
 * // => 'new test'
 * 
 * @param {object} obj 
 * @param {string} propName 
 * @param {function} func 
 */
export function watchValue(obj, propName, func) {
    let value = obj[propName];
    Object.defineProperty(obj, propName, {
        get: () => value,
        set: newValue => {
            const oldValue = value;
            value = newValue;
            func(obj, oldValue, newValue);
        },
        configurable: true
    });
}

/**
 * `showFilePicker`でファイルピッカーを表示し, 選択したファイルのFileオブジェクトを返す.   
 * `showFilePicker`の仕様上, HTTPSでしか使えない? 
 * 
 * @param {object} acceptMIME 
 * `window.ShowOpenFIlePicker`の`accept`オプション  
 * MINEタイプをキー, ファイル拡張子の配列を値として持つ`object`
 * 
 * @returns {Promise<File>} 選択されたファイルオブジェクト
 * 
 * @see https://developer.mozilla.org/ja/docs/Web/API/Window/showOpenFilePicker 
 */
export async function filePicker(acceptMIME={"text/*": [".ipynb"]}) {
    const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
            {
                accept: acceptMIME
            }
        ]
    })
    const file = await handle.getFile()
    return file
}

/**
 * 受け取った文字列をHTML, ANSIエスケープ処理する  
 * ```
 *  '&': '&amp;',
    "'": '&#x27;',
    '`': '&#x60;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
 * ```
 * 
 * @param {String} str エスケープ処理する文字列
 * @param {boolean} ansi ANSIエスケープする場合は`true`
 * @returns {String}
 */
export function escapeHTML(str, ansi=true) {
    if (ansi) {
        var str =  str.replace(/\x1B[[;\d]+m/g, "")
    }
    return str.replace(/[&'`"<>]/g, function(match) {
        return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
        }[match]
    });
}

/** 
 * HTMLエスケープ処理された文字をもとに戻す
 * @param {string} str */
export function unescapeHTML(str) {
    return str.replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
}

/** 
 * URLクエリを`{パラメータ名: 値}`のオブジェクトにして返す
 * 
 * @example
 * // url: localhost:8888?name=bob&age=20
 * getUrlQuery() 
 * // => {name: 'bob', age: '20'}
 * 
 * @returns {object}
 */
export function getUrlQuery() {
    const queryStr = window.location.search.slice(1)
    const queries = {}

    if (!queryStr) {return queries}

    queryStr.split("&").forEach(str => {
        const queryArray = str.split("=")
        queries[queryArray[0]] = queryArray[1]
    })
    return queries
}

/** 
 * 現在のURLにクエリパラメータを追加する
 * @param {string} key パラメータ名
 * @param {string} value  パラメータ値
 * */
export function addQueryParam(key, value) {
    const url = new URL(window.location.href)
    url.searchParams.set(key, value)
    history.pushState(null, "", url)
}

/** 
 * 現在のURLのクエリパラメータを削除する
 * @param {string} key パラメータ名
 * */
export function removeQueryParam(key) {
    const url = new URL(window.location.href)
    url.searchParams.delete(key)
    history.replaceState(null, "", url)
}

/**
 * h1~h6の内部リンクを設置する
 * @param {Element} linksContainer 
 * @param {Element} ankerLoc 
 * @param {InsertPosition} position
 */
export function addInnerLink(linksContainer, ankerLoc, position) {
    const rank = {
        "H1": 0,
        "H2": 0,
        "H3": 1,
        "H4": 1,
        "H5": 2,
        "H6": 3
    }
    const details = document.createElement("details")
    details.open = true
    details.id = "InnerJumpContainer"
    details.insertAdjacentHTML("afterbegin", "<summary class='fs-4 fw-bold'>Inner Link</summary>")

    const ul = document.createElement("ul")
    ul.style.fontSize = "0.9rem"
    ul.classList.add("list-unstyled")
    console.log(linksContainer)

    linksContainer.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(e => {
        e.id = "_" + e.textContent
        const li = document.createElement("li")
        li.innerHTML = `<a href="#${e.id}" class='text-decoration-none link-secondary'> ${e.textContent} </a>`
        li.style.marginLeft = `${1 * rank[e.tagName]}rem`
        ul.appendChild(li)
    })
    details.appendChild(ul)
    ankerLoc.insertAdjacentElement(position, details)
}

/**
 * テーブルにページネーションを追加する．
 * 
 * - `pagination.init()`でページネーションを追加する
 * - `pagination.update()`でページネーションを再構築する
 */
export const pagination = {
    /** 1ページあたりに表示するアイテム数のデフォルト値 */
    itemsPerPage: 10,

    /** 現在のページ番号（0始まり） */
    currentPage: 0,

    /** 表示対象の <tr> 要素リスト */
    items: Array(),

    /** 対象のテーブルDOM要素 */
    /** @type {Element | undefined} */
    targetTableElem: undefined,

    /** イベントリスナを制御するための`AbortController` */
    /** @type {AbortController} */
    controller: new AbortController(),

    /**
     * ページネーションの初期化処理
     * 
     * 最初にこのメソッドを実行する
     * @param {Element} table  対象テーブルのCSSセレクタ
     * @param {number} itemsPerPage  1ページあたりのアイテム数
     */
    init(table, itemsPerPage=10) {
        this.itemsPerPage = itemsPerPage
        this.currentPage = 0
        
        if (table.tagName != "TABLE") {throw new Error("引数`table`はtable要素でありません")}
        this.targetTableElem = table
        this.items = Array.from(table.getElementsByTagName("tr"))
            .filter(e=>{return window.getComputedStyle(e).display !== "none"})
            .slice(1)

        if (this.itemsPerPage < 1) {
            this.itemsPerPage = this.items.length
        }

        this._createPageButton()
        this._showPage()
        this._updateButtonState()
    },

    /** ページボタンを生成・表示する */
    _createPageButton() {
        if (this.targetTableElem === undefined) {throw new Error("`init`が呼ばれていません")}
        this.controller = new AbortController()
        const totalPages = Math.ceil(this.items.length / this.itemsPerPage)
        const paginationContainer = document.createElement("div")
        this.targetTableElem.after(paginationContainer)
        const paginationDiv = this.targetTableElem.nextElementSibling
        paginationDiv?.classList.add("my-pagination")
        for (let i=0; i<totalPages; i++) {
            const pageButton = document.createElement("button")
            pageButton.classList.add("btn", "btn-sm", "btn-outline-dark")
            pageButton.textContent = String(i + 1)
            pageButton.addEventListener("click", () => {
                this.currentPage = i; 
                this._showPage()
                this._updateButtonState()
            }, {signal: this.controller.signal})
            paginationDiv?.appendChild(pageButton)
        }
    },

    /** 現在のページに該当する要素を表示する */
    _showPage() {
        const startIndex = this.currentPage * this.itemsPerPage
        const endIndex = startIndex + this.itemsPerPage
        this.items.forEach((item, idx) => {
            item.classList.toggle("pgn-hidden", idx < startIndex || idx >= endIndex)
        })
    },

    /** ページボタンの状態を変更する */
    _updateButtonState() {
        const pageButtons = document.querySelectorAll(".my-pagination button")
        pageButtons.forEach((btn, idx) => {
            if (idx == this.currentPage) {
                btn.classList.add("active")
            }
            else {
                btn.classList.remove("active")
            }
        })
    },

    /** 
     * ページネーションを再構築する
     * @param {number | null} itemsPerPage 
     */
    update(itemsPerPage=null) {
        if (this.targetTableElem === undefined ) {throw new Error("`init`が呼ばれていません")}
        const paginationDiv = this.targetTableElem.nextElementSibling
        if (paginationDiv != null && paginationDiv.classList.contains("my-pagination")) {
            this.controller.abort()
            paginationDiv.remove()
            const fullItems = Array.from(this.targetTableElem.querySelectorAll("tr")).slice(1)
            fullItems.forEach(e => {
                e.classList.remove("pgn-hidden")
            })
        }
        this.init(this.targetTableElem, itemsPerPage??this.itemsPerPage)
    }
}

/** 
 * 2つのオブジェクトのすべてのプロパティ値を比較し，異なるプロパティがなければ`true`を返す
 * @param {object} obj1 
 * @param {object} obj2
 * @returns {boolean}
 */
export function compareObjects(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    // プロパティ数が異なる場合、false
    if (keys1.length !== keys2.length) return false;

    // プロパティごとに値を比較
    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) return false;
    }

    return true;
}