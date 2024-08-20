//@ts-check 
import * as error from "./modules/error.js"
import * as helper from "./modules/helper.js"

const changedParams = {}

observeForm()
helper.pagination.init("#problemList", 10)

document.addEventListener("click", async e => {
    const btn = e.target.closest(".btn") 
    if (btn == null) {return} 
    if (btn.classList.contains("btn-delp")) {
        const target = e.target.closest("tr").getAttribute("target")
        await deleteProblem(target)
    }
    else if (btn.classList.contains("btn-updatep")) {
        await updateProfiles()
    }
})

const categoryTag = Array.from(document.querySelectorAll(".category-tag"))
categoryTag.forEach(btn=> {
    btn.addEventListener("click", (e) => {
        // radio button
        categoryTag.forEach(tag=> {
            if (tag != btn) {
                tag.classList.remove("active")
            }
        })
        const category = e.target.dataset.category
        const trList = Array.from(document.querySelectorAll("#problemList tr")).slice(1)
        trList.forEach(e => {
            const registeredCat = e.querySelector("select.select-category")?.value
            e.classList.toggle("d-none", registeredCat != category && btn.classList.contains("active"))
        })
        helper.pagination.update()
    })

})

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
    tbl.querySelectorAll("input, select").forEach(elem => {
        const p_id = elem.closest("tr").getAttribute("target")
        if (!(p_id in initialFormValue)) {
            initialFormValue[p_id] = {}
        }
        const tag = elem.getAttribute("for")
        initialFormValue[p_id][tag] = elem.value
    })

    tbl.querySelectorAll("input, select").forEach(elem => {
        elem.addEventListener("change", () => {
            const tr = elem.closest("tr")
            const p_id = tr.getAttribute("target")
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
