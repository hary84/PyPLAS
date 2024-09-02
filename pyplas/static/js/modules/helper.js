//@ts-check

const groups = window.location.pathname.match(
            /(?<parent_path>problems|create)\/(?<p_id>[-\w]+)/)?.groups

export const problem_meta= {
    mode: groups?.parent_path,
    p_id: groups?.p_id
}

console.log(`problem_id(p_id) is '${problem_meta.p_id}'`)
console.log(`mode is '${problem_meta.mode}'`)


export function isCreateMode() {
    return problem_meta.mode == "create"
}

/**
 * objのpropertyが変化した際にfuncを実行する
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
 * showFilePickerでファイルピッカーを表示し, Fileオブジェクトを返す. 
 * @param {object} acceptMIME MINE typeがキー, ファイル拡張子のarrayが値のオブジェクト
 * @returns {Promise<File>} 選択されたファイルオブジェクト
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
 * 文字列をhtmlとansiエスケープする
 * @param {String} str 
 * @param {boolean} ansi 
 * @returns {String}
 */
export function escapeHTML(str, ansi=false) {
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
 * エスケープ処理された文字をもとに戻す
 * @param {string} str */
export function unescapeHTML(str) {
    return str.replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
}
/** オブジェクト化したクエリ文字列を返す */
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
 * @param {string} key
 * @param {string} value  */
export function addQueryParam(key, value) {
    const url = new URL(window.location.href)
    url.searchParams.set(key, value)
    history.pushState(null, "", url)
}
/** 現在のURLのクエリパラメータを削除する
 * @param {string} key */
export function removeQueryParam(key) {
    const url = new URL(window.location.href)
    url.searchParams.delete(key)
    history.replaceState(null, "", url)
}
/** ページネーションオブジェクト */
export const pagination = {
    tableTag: "",
    itemsPerPage: 10,
    currentPage: 0,

    items: Array(),
    /** @property {Element} targetTableElem */
    targetTableElem: {},
    controller: {},

    /**
     * テーブルにページネーションを実装する
     * @param {string} tableTag  
     */
    init(tableTag, itemsPerPage=10) {
        this.tableTag = tableTag
        this.itemsPerPage = itemsPerPage
        this.currentPage = 0
        
        const content = document.querySelector(tableTag);
        if (content == null) {throw new Error("The specified table was not found.")}
        this.targetTableElem = content
        this.items = Array.from(content.getElementsByTagName("tr")).filter(e=>{
            return window.getComputedStyle(e).display !== "none"
        }).slice(1)

        if (this.itemsPerPage < 1) {
            this.itemsPerPage = this.items.length
        }

        this.createPageButton()
        this.showPage()
        this.updateButtonState()
    },

    /** ページ移動ボタンを追加する */
    createPageButton() {
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
                this.showPage()
                this.updateButtonState()
            }, {signal: this.controller.signal})
            paginationDiv?.appendChild(pageButton)
        }
    },

    /** currentPageを表示する */
    showPage() {
        const startIndex = this.currentPage * this.itemsPerPage
        const endIndex = startIndex + this.itemsPerPage
        this.items.forEach((item, idx) => {
            item.classList.toggle("pgn-hidden", idx < startIndex || idx >= endIndex)
        })
    },

    /** ページ移動ボタンの状態を変更する */
    updateButtonState() {
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
    /** ページネーションを更新する
     * @param {number | null} itemsPerPage 
     */
    update(itemsPerPage=null) {
        const paginationDiv = this.targetTableElem.nextElementSibling
        if (paginationDiv != null && paginationDiv.classList.contains("my-pagination")) {
            this.controller.abort()
            paginationDiv.remove()
            const fullItems = Array.from(this.targetTableElem.querySelectorAll("tr")).slice(1)
            fullItems.forEach(e => {
                e.classList.remove("pgn-hidden")
            })
        }
        this.init(this.tableTag, itemsPerPage??this.itemsPerPage)
    }
}