//@ts-check 
import * as error from "./modules/error.js"
import * as helper from "./modules/helper.js"

const itemsPerPage = 10
const nullCategory = ""

const tableBody = document.querySelector("#problemList tbody")
const queries = helper.getUrlQuery()

const changedParams = {}
let subWindow = null

// formの監視を開始
observeForm()

// paginationを埋め込む
helper.pagination.init("#problemList", itemsPerPage)

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
                const target = e.target?.closest("tr").getAttribute("target")
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

// カテゴリーフィルターの有効化
const categoryTags = Array.from(document.querySelectorAll(".category-tag"))
categoryTags.forEach(btn=> {
    btn.addEventListener("click", (e) => {
        const category = e.target.dataset.category
        categoryTags.forEach(tag=> { // radio button
            if (tag != btn) {
                tag.classList.remove("active")
            }
        })
        document.querySelector("#categoryActions")?.classList.toggle(
            "d-none", !btn.classList.contains("active")
        )
        if (btn.classList.contains("active")) {
            helper.addQueryParam("category", category)
        } else {
            helper.removeQueryParam("category")
        }
        tableBody?.querySelectorAll("tr").forEach(e => {
            const registeredCat = e.querySelector("select.select-category")?.value
            if (registeredCat == nullCategory) {
                e.classList.toggle("d-none", btn.classList.contains("active"))
            }
            else if (registeredCat == category) {
                e.classList.toggle("d-none", !btn.classList.contains("active"))
            }
            else {
                e.classList.add("d-none")
            }
        })
        helper.pagination.update()
    })
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
    if (categoryId === undefined) {
        throw new Error("Unexpected Error")
    }
    const subWindow = window.open(
        `${window.location.origin}/create/order?category=${categoryId}`,
        "_blank",
        "menubar=0,width=700,height=700,top=100,left=100")
    window.addEventListener("message", (e) => {
        if (e.data === "processCompleted") {
            subWindow?.close()
            location.reload()
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
    const res = await fetch(`${window.location.origin}/create/profile`, {
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
 */
function observeForm() {
    const initialFormValue = {}
    const tbl = document.querySelector("#problemList")
    if (tbl == null)  {console.error("there is no table"); return}
    tbl.querySelectorAll("input, select").forEach(elem => {
        const p_id = elem.closest("tr")?.getAttribute("target")
        if (typeof p_id === "string" && !(p_id in initialFormValue)) {
            initialFormValue[p_id] = {}
        }
        const tag = elem.getAttribute("for")
        initialFormValue[p_id][tag] = elem.value
    })

    tbl.querySelectorAll("input, select").forEach(elem => {
        elem.addEventListener("change", () => {
            const tr = elem.closest("tr")
            const p_id = tr?.getAttribute("target")
            const changed = {}
            tr.querySelectorAll("input, select").forEach(elem => {
                const tag = elem.getAttribute("for")
                changed[tag] = elem.value
            })
            if (initialFormValue[p_id]["title"] != changed["title"]
                || initialFormValue[p_id]["category"] != changed["category"]
                || initialFormValue[p_id]["status"] != changed["status"]) {
                    changedParams[p_id] = changed
                    tr.classList.add("table-danger")
                }
            else {
                delete changedParams[p_id]
                tr.classList.remove("table-danger")
            }
        })
    })
}
