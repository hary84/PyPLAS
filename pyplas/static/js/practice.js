//@ts-check
import * as error from "./modules/error.js"
import {notNull} from "./modules/helper.js"

/** 
 * @typedef {Object} CategoryMembers カテゴリの詳細情報
 * @prop {string=} cat_id 
 * @prop {Array<any>} problems
 * @prop {string} DESCR
 */

/** @type {HTMLSelectElement} */
const searchCategoryMemberSelect = notNull(document.querySelector("#SearchCategorySelect"))
/** @type {Element} */
const categoryMembersLinks = notNull(document.querySelector("#CategoryMembersLinks"))

/** @description sessionStorageに格納された現在のカテゴリを取得するためのキー */
const KeyForCategoryID = "practice-SearchCategory"

const currentCategoryID = sessionStorage.getItem(KeyForCategoryID)
if (currentCategoryID !== undefined) {
    searchCategoryMemberSelect.querySelectorAll("option").forEach(async e => {
        if (e.value == "-1") {
            return
        }
        if (e.value == currentCategoryID) {
            e.selected = true
            const m = await getCategoryMember(currentCategoryID)
            showCategoryTable(m)
        }
    })
}


// モーダル中のselectタグが変化したときのイベント
searchCategoryMemberSelect?.addEventListener("change", async e => {
    /** @type {string} */
    const cat_id = e.target.value
    sessionStorage.setItem(KeyForCategoryID, cat_id)

    if (cat_id == "-1") {
        categoryMembersLinks.innerHTML = ""
        return
    }

    const mems = await getCategoryMember(cat_id)
    showCategoryTable(mems)
})

document.addEventListener("click", e => {
    /** @type {HTMLElement} */
    const btn = e.target?.closest("a, button")
    if (btn === null || btn === undefined) {return}
    const action = btn.dataset.action 
    console.log(action)

    if (action == "remove-question") {
        const blk = btn.closest("#selectedQuestion")
        const prv = blk?.previousElementSibling
        blk?.remove()
        if (prv.dataset.role == "node-control") {prv?.remove()}
    }

})

/**
 * カテゴリの詳細情報を取得する
 * @param {string} cat_id 
 * @returns {Promise<CategoryMembers>}
 */
async function getCategoryMember(cat_id) {
    const res = await fetch(`${window.location.origin}/api/categorymembers/${cat_id}`)
    if (res.ok) {
        const json = await res.json()
        return json 
    } else {
        throw new error.FetchError(res.status, res.statusText)
    }
}

/** 問題一覧を表形式にして表示する
 * @param {CategoryMembers} membersArray
 */
function showCategoryTable(membersArray) {
    categoryMembersLinks.innerHTML = ""
    let trs = ''
    for (var mem of membersArray.problems) {
        const p_id = mem.p_id
        /** @type {string} */
        const q_ids = mem.q_id
        let links = ""
        let n = 1
        for (var q_id of q_ids.split(",")) {
            links += `<a class='px-2' href='/practice?p_id=${p_id}&q_id=${q_id}'>${n}</a>`
            n += 1
        }
        trs += `<tr><td style='padding-left: .5rem !important'>${mem.title}</td><td>${links}</td></tr>`
    }

    const html = `
    <table class='table table-sm table-hover table-striped mx-auto table-light' style='width: 90%'>
        <thead>
            <tr>
                <th scope='col' style='width: 65%'>Title</th>
                <th scope='col' style='width: 35%'>Questions</th>
            </tr>
        </thead>
        <tbody>${trs}</tbody>
    </table>
    `
    categoryMembersLinks.insertAdjacentHTML("beforeend", html)    
}

