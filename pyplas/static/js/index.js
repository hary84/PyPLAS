//@ts-check
import {downloadLog} from "./modules/utils.js"

document.querySelector("#logDownloader")?.addEventListener("click", async (e) => {
    const number = document.querySelector("#inputNumber")?.value 
    const name = document.querySelector("#inputName")?.value
    const category = window.location.pathname.match(/categories\/(?<cat_id>[\w]+)/).groups.cat_id
    await downloadLog(number, name, category)
})

