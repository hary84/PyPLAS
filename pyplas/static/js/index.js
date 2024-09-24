//@ts-check
import {getUrlQuery} from "./modules/helper.js"
import {FetchError} from "./modules/error.js"

document.querySelector("#logDownloader")?.addEventListener("click", async (e) => {
    await downloadLog()
})


async function downloadLog() {
    /** @type {string | undefined} */
    const number = document.querySelector("#inputNumber")?.value 
    /** @type {string | undefined} */
    const name = document.querySelector("#inputName")?.value 

    if (!!!number || !!!name) {
        alert("Input your name or student number.")
        return 
    }

    const urlQuery = getUrlQuery()
    /** @type {string | undefined} */
    const cat = urlQuery.category
    if (cat === undefined) {
        alert(`please specify category`)
        return
    }

    const res = 
        await fetch(`${window.location.origin}/problems/log/download?cat=${cat}`)
    if (res.ok) {
        const content = await res.blob()
        const objectUrl = window.URL.createObjectURL(content)
        const a = document.createElement("a")
        a.href = objectUrl
        a.download = `${decodeURI(cat)}_${number}_${name}.csv`
        a.click()
        a.remove()
        window.URL.revokeObjectURL(objectUrl)
    } else {
        alert("Failed to retrieve log file")
        throw new FetchError(res.status, res.statusText)
    }


}

