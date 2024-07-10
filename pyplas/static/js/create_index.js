//@ts-check 

import * as creator from "./modules/create-utils.js"

creator.observeForm()

document.addEventListener("click", async e => {
    const btn = e.target.closest(".btn") 
    if (btn == null) {return} 
    if (btn.classList.contains("btn-delp")) {
        const target = e.target.closest("tr").getAttribute("target")
        await creator.deleteProblem(target)
    }
    else if (btn.classList.contains("btn-updatep")) {
        await creator.updateProfiles(creator.changedParams)
    }
})
