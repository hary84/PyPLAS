//@ts-check
import * as error from "./modules/error.js"

/** 
 * @typedef {Object} CategoryInfo カテゴリの詳細情報
 * @prop {string=} cat_id 
 * @prop {string} cat_name
 * @prop {string} logo_url
 * @prop {string} description
 */

/** @type {HTMLElement | null} */
const modalElement = document.querySelector("#categoryModal")
/** @type {HTMLInputElement | null} */
const categoryNameInput = document.querySelector("#categoryNameInput")
/** @type {HTMLSelectElement | null} */
const categoryLogoURLSelect = document.querySelector("#categoryLogoURLSelect")
/** @type {HTMLElement | null} */
const previewContainer = document.querySelector("#imgPreview")
/** @type {HTMLInputElement  | null} */
const categoryDescInput = document.querySelector("#categoryDescriptionInput")

if (modalElement == null || 
    categoryNameInput == null || 
    categoryLogoURLSelect == null ||
    categoryDescInput == null) {
        throw new error.ElementNotFoundError()
    }
else {
    modalElement?.addEventListener("show.bs.modal", async e => {
        /** @type {HTMLElement} */
        const triggerElement = e.relatedTarget
        const catId = triggerElement.dataset.catId
        modalElement.dataset.shownCatId = catId
        const modalTitle = document.querySelector("#categoryModalLabel")
        if (modalTitle === null) { throw new error.ElementNotFoundError()}
    
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
    modalElement?.addEventListener("hide.bs.modal", e => {
        modalElement.dataset.shownCatId = ""
    })
    
    document.addEventListener("click", async e => {
        /** @type {HTMLElement | null} */
        const btn = e.target.closest(".btn")
        if (btn == null) {return}
        const action = btn.dataset.action 
        const catId = modalElement.dataset.shownCatId 
        if (catId === undefined || action === undefined) {return}
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
    })
    categoryLogoURLSelect?.addEventListener("change", e => {
        /** @type {string} */
        const url = e.target.value 
        showImgPreview(url)
    })
}
/**
 * selectタグ内のoptions中から指定されたurlを探し，selected状態にする  
 * 
 * urlが見つかった場合，#previewContaienrに画像を表示し，見つからない場合，
 * #previewContainerの内部を空にする
 * @param {string} url 
 */
function setImageFromURL(url) {
    const optionValues = Array.from(categoryLogoURLSelect.options).map(op=>op.value)
    const idx = optionValues.indexOf(url)
    categoryLogoURLSelect.selectedIndex = (idx >= 0) ? idx : 0
    if (idx > 0) {
        showImgPreview(optionValues[idx])
    } else {
        previewContainer.innerHTML = ""
    }
}
/**
 * 画像をプレビュー欄に表示する
 * @param {string} url 
 */
function showImgPreview(url) {
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
    const res = await fetch(`${window.location.origin}/create/category/${cat_id}`, {
        method: "GET"   
    })
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
    const res = await fetch(`${window.location.origin}/create/category/${cat_id}`,{
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
    const res = await fetch(`${window.location.origin}/create/category/${cat_id}`, {
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




