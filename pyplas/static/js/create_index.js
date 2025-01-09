//@ts-check 
import * as error from "./modules/error.js"
import { notNull } from "./modules/helper.js"
import * as helper from "./modules/helper.js"

const itemsPerPage = 10

const tableElement = notNull(document.querySelector("#problemList"))
const queries = helper.getUrlQuery()

const changedParams = {}
let subWindow = null

// formの監視を開始
observeForm(tableElement)

// paginationを埋め込む
helper.pagination.init("#problemList", itemsPerPage)

// カテゴリーフィルターの有効化
activateCategoryTagFilter(tableElement)

// ボタンイベントリスナーの設定
document.addEventListener("click", async e => {
    const btn = e.target?.closest(".btn") 
    if (btn == null) {return} 
    btn.classList.add("disabled")
    try {
        switch (btn.dataset.action) {
            case "open-order-window":
                subWindow = openOrderChangeWindow()
                break;
            case "del-problem":
                const target = notNull(btn.closest("tr")).getAttribute("target")
                await deleteProblem(target)
                break;
            case "update-profiles":
                await updateProfiles()
                break;
        }
    } catch (e) {
        alert(e)
    } 
    finally{
        btn.classList.remove("disabled")
    }
})



// URLクエリーにcategoryがあるならば，指定されたカテゴリフィルターを有効にする
if (queries.category !== undefined) {
    const activeBtn = document.querySelector(
        `#cateogoryFilterContainer > .btn[data-category='${queries.category}']`)
    if (activeBtn == null) {}
    else {
        activeBtn.dispatchEvent(new Event("click"))
    }
}

// 他ページに遷移時に問題順序変更用のサブウィンドウを閉じる．
window.addEventListener("beforeunload", e => {
    if (subWindow != null && !subWindow.closed) {
        subWindow.close()
    }
})

/** 問題順番変更用のウィンドウを開く */
function openOrderChangeWindow() {
    const categoryId = helper.getUrlQuery().category
    const subWindow = window.open(
        `${window.location.origin}/edit/order/${categoryId}`,
        "_blank",
        "menubar=0,width=700,height=700,top=100,left=100")
    window.addEventListener("message", (e) => {
        if (e.data === "processCompleted") {
            subWindow?.close()
            location.reload()
        } else if (e.data === "processAborted") {
            subWindow?.close()
        }
    })
    return subWindow
}

/** 問題の削除を要請する */
async function deleteProblem(p_id) {
    const agree = confirm("本当に削除しますか？")
    if (!agree) {return}
 
    const res = await fetch(`${window.location.origin}/create/${p_id}`, {
        method: "DELETE",
    })
    if (res.ok) {
        const json = await res.json()
        console.log(`[deleteProblem] ${json.DESCR}`)
        window.location.reload()
    } else {
        throw new error.FetchError(res.status, res.statusText)
    }
}

/** pageのstatus, category, titleを変更する */
async function updateProfiles() {
    const res = await fetch(`${window.location.origin}/edit/profiles`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"profiles": changedParams})
    })
    if (res.ok) {
        window.location.reload()
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}
/**
 * create_index.htmlのform(input, select)の変更を監視する
 * 
 * formに変更があった際に、グローバル変数changedParamsにp_id, title, category, status
 * を格納する。
 * @param {Element} tableElement
 */
function observeForm(tableElement) {
    const initialFormValue = {}
    tableElement.querySelectorAll("input, select").forEach(elem => {
        const p_id = notNull(elem.closest("tr")?.getAttribute("target"))
        if (typeof p_id === "string" && !(p_id in initialFormValue)) {
            initialFormValue[p_id] = {}
        }
        const tag = notNull(elem.getAttribute("for"))
        initialFormValue[p_id][tag] = elem.value
    })

    tableElement.addEventListener("change", highlightTableRow)
    
    /** フォームの値が変化したときに実行される関数*/
    function highlightTableRow(event) {
        const target = event.target
        if (target.tagName === "INPUT" || target.tagName === "SELECT") {
            /** @type {Element} */
            const tableRow = notNull(target.closest("tr"))
            const p_id = tableRow.getAttribute("target")
            const changed = {}
            
            tableRow.querySelectorAll("input, select").forEach(e => {
                const tag = e.getAttribute("for")
                changed[tag] = e.value
            })
            if (!helper.compareObjects(initialFormValue[p_id], changed)) {
                changedParams[p_id] = changed
                tableRow.classList.add("table-danger")
            } else {
                delete changedParams[p_id]
                tableRow.classList.remove("table-danger")
            }
        }
    }
}

/** 
 * タグによるテーブルフィルターを有効化する 
 * @param {Element} tableElement*/
function activateCategoryTagFilter(tableElement) {
    const categoryTags = Array.from(document.querySelectorAll(".category-tag"))
    categoryTags.forEach(btn=> {
        btn.addEventListener("click", (e) => {
            const cat_id = e.target.dataset.category

            // 他のボタンをnon-activeにする
            categoryTags.forEach(tag=> {
                if (tag != btn) tag.classList.remove("active")
            })
            document.querySelector("#categoryActions")?.classList.toggle(
                "d-none", !btn.classList.contains("active")
            )

            // カテゴリアクションの表示/非表示切り替え
            if (btn.classList.contains("active")) {
                helper.addQueryParam("category", cat_id)
            } else {
                helper.removeQueryParam("category")
            }

            // 該当するカテゴリの列のみを表示する
            Array.from(tableElement.querySelectorAll("tr")).slice(1, ).forEach(e => {
                const registeredCat = e.querySelector("select.select-category")?.value
                if (btn.classList.contains("active")) {
                    e.classList.toggle("d-none", registeredCat !== cat_id)
                }
                else if (!btn.classList.contains("active")) {
                    e.classList.remove("d-none")
                }
            })

            // ページ数を更新する
            helper.pagination.update()
        })
    })

}
