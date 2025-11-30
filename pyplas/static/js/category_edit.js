//@ts-check
import * as error from "./modules/error.js"
import {notNull} from "./modules/helper.js"

/** 
 * @typedef {Object} CategoryInfo カテゴリの詳細情報
 * @prop {string=} cat_id 
 * @prop {string} cat_name
 * @prop {string} logo_url
 * @prop {string} description
 */

/** @type {HTMLElement} */
const modalElement = notNull(document.querySelector("#categoryModal"))
/** @type {HTMLInputElement} */
const categoryNameInput = notNull(document.querySelector("#categoryNameInput"))
/** @type {HTMLSelectElement} */
const categoryLogoURLSelect = notNull(document.querySelector("#categoryLogoURLSelect"))
/** @type {HTMLElement} */
const previewContainer = notNull(document.querySelector("#imgPreview"))
/** @type {HTMLInputElement} */
const categoryDescInput = notNull(document.querySelector("#categoryDescriptionInput"))


// モーダル表示のイベント
modalElement?.addEventListener("show.bs.modal", async e => {
    /** @type {HTMLElement} */
    const triggerElement = e.relatedTarget
    const catId = triggerElement.dataset.catId
    modalElement.dataset.shownCatId = catId
    const modalTitle = notNull(document.querySelector("#categoryModalLabel"))

    if (catId === "new") {
        modalTitle.textContent = "Category: NEW"
        categoryNameInput.value = ""
        setImageFromURL("")
        categoryDescInput.value = ""
    }
    else if (catId !== undefined) {
        const catInfo = await getCategoryInfo(catId)
        modalTitle.textContent = `Category: #${catInfo.cat_id} ${catInfo.cat_name}`
        categoryNameInput.value = catInfo.cat_name
        setImageFromURL(catInfo.logo_url)
        categoryDescInput.value = catInfo.description
    } 
})

// モーダル非表示時のイベント
modalElement?.addEventListener("hide.bs.modal", e => {
    modalElement.dataset.shownCatId = ""
})

// ボタンをクリックしたときのイベント
document.addEventListener("click", async e => {
    /** @type {HTMLElement | null} */
    const btn = e.target.closest(".btn")
    if (btn == null) {return}
    const action = btn.dataset.action 
    const catId = modalElement.dataset.shownCatId 
    if (catId === undefined || action === undefined) {return}
    try {
        switch (action) {
            case "update-category":
                await updateCategory(catId)
                break;
            case "delete-category":
                const agree = confirm("Do you really want to delete it?")
                if (agree) {
                    await deleteCategory(catId)
                }
        }
    } catch (e) {
        alert(e.message)
        console.error(e)
    }
})
// モーダル中のselectタグが変化したときのイベント
categoryLogoURLSelect?.addEventListener("change", e => {
    /** @type {string} */
    const url = e.target.value
    setImageFromURL(url)
})

/**
 * selectタグ内のoptions中から指定されたurlを探し，selected状態にする  
 * 
 * urlが見つかった場合，#previewContaienrに画像を表示し，見つからない場合，
 * #previewContainerの内部を空にする
 * @param {string} url 
 */
function setImageFromURL(url) {
    const options = Array.from(categoryLogoURLSelect.options)
    const idx = options.map(op => op.value).indexOf(url)
    categoryLogoURLSelect.selectedIndex = (idx >= 0) ? idx : 0
    if (idx > 0) {
        showImgPreview(options[idx].dataset.fullpath??"")
    } else {
        showImgPreview("")
    }
}
/**
 * 画像をプレビュー欄に表示する
 * @param {string} url 
 */
function showImgPreview(url) {
    if (url.trim() === "") {
        previewContainer.innerHTML = ""
        previewContainer.innerHTML = "<p class='rounded bg-secondary-subtle text-center py-1'>NO IMAGE</p>"
        console.log(url)
        return
    }
    const img = document.createElement("img")
    img.src = encodeURI(url)
    img.style.maxHeight = "8rem"
    img.style.width = "100%"
    img.style.objectFit = "cover"
    previewContainer.innerHTML = ""
    previewContainer.appendChild(img)
}
/**
 * カテゴリの詳細情報を取得する
 * @param {string} cat_id 
 * @returns {Promise<CategoryInfo>}
 */
async function getCategoryInfo(cat_id) {
    const res = await fetch(`${window.location.origin}/api/categoryinfo/${cat_id}`)
    if (res.ok) {
        const json = await res.json()
        return json 
    } else {
        throw new error.FetchError(res.status, res.statusText)
    }
}
/**
 * 指定のカテゴリを削除する
 * @param {string} cat_id 
 */
async function deleteCategory(cat_id) {
    const res = await fetch(`${window.location.origin}/edit/categories/${cat_id}`,{
        method: "DELETE",
    })
    if (res.ok) {
        window.location.reload()
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}
/**
 * カテゴリを更新する
 * @param {string} cat_id 
 */
async function updateCategory(cat_id) {
    /** @type {CategoryInfo} */
    const updateInfo = {
        cat_name: categoryNameInput.value,
        logo_url: categoryLogoURLSelect.value,
        description: categoryDescInput.value,
    }
    const res = await fetch(`${window.location.origin}/edit/categories/${cat_id}`, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify(updateInfo)
    })
    if (res.ok) {
        window.location.reload()
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}




