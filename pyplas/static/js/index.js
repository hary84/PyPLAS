//@ts-check

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

    const cat = window.location.search.match(/category=(?<cat_name>[-\w]+)/)?.groups?.cat_name
    if (cat === undefined) {
        alert(`please specify category`)
        return
    }

    window.location.href = 
        `${window.location.origin}/problems/log/download?cat=${cat}&name=${name}&num=${number}`
}

