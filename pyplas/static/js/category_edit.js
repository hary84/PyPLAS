//@ts-check
import * as error from "./modules/error.js"

const modalElement = document.querySelector("#categoryModal")
const categoryNameInput = document.querySelector("#categoryNameInput")
const categoryLogoURLInput = document.querySelector("#categoryLogoURLInput")
const categoryDescInput = document.querySelector("#categoryDescriptionInput")

modalElement?.addEventListener("show.bs.modal", async e => {
    const targetCate = e.relatedTarget
    const catId = targetCate.dataset.catId
    modalElement.dataset.shownCatId = catId
    const modalTitle = document.querySelector("#categoryModalLabel")

    if (targetCate.tagName == "TR") {
        const catInfo = await getCategoryInfo(catId)
        modalTitle.textContent = `Category: #${catInfo["cat_id"]} ${catInfo["cat_name"]}`
        categoryNameInput.value = catInfo["cat_name"]
        categoryLogoURLInput.value = catInfo["logo_url"]
        categoryDescInput.value = catInfo["description"]
        showImgPreview(catInfo["logo_url"] ?? "")
    } 
    else if (targetCate.tagName == "BUTTON") {
        modalTitle.textContent = "Category: NEW"
        categoryNameInput.value = ""
        categoryLogoURLInput.value = ""
        categoryDescInput.value = ""
        showImgPreview("")
    }
})
modalElement?.addEventListener("hide.bs.modal", e => {
    modalElement.dataset.shownCatId = ""
})

document.addEventListener("click", async e => {
    const btn = e.target.closest(".btn")
    if (btn == null) {return}
    const action = btn.dataset.action 
    switch (action) {
        case "update-category":
            await updateCategory(modalElement.dataset.shownCatId)
            break;
        case "delete-category":
            const agree = confirm("Do you really want to delete it?")
            if (agree) {
                await deleteCategory(modalElement.dataset.shownCatId)
            }
    }
})
categoryLogoURLInput?.addEventListener("change", e => {
    const url = e.target.value 
    showImgPreview(url)
})
/**
 * 画像をプレビュー欄に表示する
 * @param {string} url 
 */
function showImgPreview(url) {
    const img = document.createElement("img")
    img.src = url
    img.style.maxHeight = "8rem"
    img.style.width = "100%"
    img.style.objectFit = "cover"
    const previewContainer = document.querySelector("#imgPreview")
    previewContainer.innerHTML = ""
    previewContainer?.appendChild(img)
}
/**
 * カテゴリの詳細情報を取得する
 * @param {string} cat_id 
 * @returns {Promise<object>}
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
    const res = await fetch(`${window.location.origin}/create/category/${cat_id}`, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify({
            "cat_name": categoryNameInput.value,
            "logo_url": categoryLogoURLInput.value,
            "description": categoryDescInput.value
        })
    })
    if (res.ok) {
        window.location.reload()
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }

}




