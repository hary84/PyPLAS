//@ts-check 
import * as error from "./modules/error.js"
import * as helper from "./modules/helper.js"

// formの監視を開始
const changedParams = {}
observeForm()

// paginationを埋め込む
const itemsPerPage = 10
helper.pagination.init("#problemList", itemsPerPage)

// Sortable.jsを有効化
const tableBody = document.querySelector("#problemList tbody")
const tableOrderSwitch = document.querySelector("input#activateOrderChange")
const sortable = Sortable.create(tableBody, {
    handle: ".handle",
    chosenClass: "chosen",
    animation: 200,
    dataIdAttr: "data-sort-id",
    onUpdate: (evt) => {
        const target = evt.item 
        target.closest("tr").classList.add("table-warning")
    } 
})
let initialOrder = sortable.toArray()

// order change switch の有効化
tableOrderSwitch?.addEventListener("change", function() {
    if (!this.checked && !helper.arraysAreEqual(initialOrder, sortable.toArray())) {
        const agree = confirm("Your changes are not saved.\nDo you want to revert to the previous state?")
        if (agree) {
            sortable.sort(initialOrder, true)
            resetOrderChangeMarker()
        }
        else { 
            this.checked = true
            return
         }
    }
    categoryTags.forEach(btn => {
        btn.classList.toggle("disabled", this.checked)
    })
    document.querySelectorAll("th[for='table-row-header']").forEach(elem => {
        elem.classList.toggle("active-order-change-btn", this.checked)
    })
    const updateBtn = document.querySelector(".btn-update")
    if (updateBtn == null) {console.error(); return}
    updateBtn.dataset.action = 
        this.checked ? "update-order" : "update-profiles"
    updateBtn.textContent = 
        this.checked ? " Update Order" : " Update Profiles"
    helper.pagination.update(this.checked ? -1 : itemsPerPage)
})

// ボタンイベントリスナーの設定
document.addEventListener("click", async e => {
    const btn = e.target?.closest(".btn") 
    if (btn == null) {return} 
    if (btn.classList.contains("btn-delp")) {
        const target = e.target?.closest("tr").getAttribute("target")
        await deleteProblem(target)
    }
    else if (btn.classList.contains("btn-update")) {
        switch (btn.dataset.action) {
            case "update-order":
                await changeProblemOrder()
                break;
            case "update-profiles":
                await updateProfiles()
                break;
        }
    }
})

// カテゴリーフィルターの有効化
const categoryTags = Array.from(document.querySelectorAll(".category-tag"))
categoryTags.forEach(btn=> {
    btn.addEventListener("click", (e) => {
        // radio button
        categoryTags.forEach(tag=> {
            if (tag != btn) {
                tag.classList.remove("active")
            }
        })
        document.querySelector("#orderChangeSwitch")?.classList.toggle(
            "d-none", !btn.classList.contains("active")
        )
        const category = e.target.dataset.category
        tableBody?.querySelectorAll("tr").forEach(e => {
            const registeredCat = e.querySelector("select.select-category")?.value
            if (registeredCat == "" && !btn.classList.contains("active")) {e.classList.remove("d-none")}
            else if (registeredCat == category && btn.classList.contains("active")) {
                e.classList.remove("d-none")
            }
            else {
                e.classList.add("d-none")
            }
        })
        helper.pagination.update()
    })
})

function resetOrderChangeMarker() {
    tableBody?.querySelectorAll("tr").forEach(e => {
        e.classList.remove("table-warning")
    })
}
function getVisibleTableRow() {
    return Array.from(tableBody.getElementsByTagName("tr")).filter(e=>{
        return window.getComputedStyle(e).display !== "none"})
}
/**
 * 問題の削除を要請する
 */
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
/**
 * 問題の順番を入れ替える
 */
async function changeProblemOrder() {
    const trList = getVisibleTableRow()
    const order = trList.map((tr) => tr.getAttribute("target"))
    // const res = await fetch(`${window.location.origin}/create/profile`, {
    //     method: "POST",
    //     headers: {"Content-Type": "application/json"},
    //     body: JSON.stringify({"order": order})
    // })
    // if (res.ok) {
    //     const json = await res.json()
    //     console.log(`[changeProblemOrder] ${json.DESCR}`)
    //     resetOrderChangeMarker()
    //     initialOrder = sortable.toArray()
    // } else {
    //     throw new error.FetchError(res.status, res.statusText)
    // }
    console.log(order)
    resetOrderChangeMarker()
    initialOrder = sortable.toArray()
    tableOrderSwitch.checked = false 
    tableOrderSwitch?.dispatchEvent(new Event("change"))
}

/**
 * pageのstatus, category, titleを変更する
 */
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
