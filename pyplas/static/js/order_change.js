//@ts-check

import { notNull } from "./modules/helper.js"

if (window.opener === null) {
    // 警告文を出して/createへリダイレクト
    alert([
        "This URL cannot be opened directly.",
        "Please open it from the `Change Problem Order` button in /create."
    ].join("\n"))
    window.location.href = "/create"
} 
else {
    // テーブルのソート機能を有効化
    const tableBody = notNull(document.querySelector("#problemList tbody"))
    const sortableObj = activateSortable(tableBody)
    
    // クリックイベント
    document.addEventListener("click", async e=> {
        const btn = e.target?.closest(".btn")
        if (btn == null) {return}
        try {
            switch (btn.dataset.action) {
                case "update-order":
                    await sortableObj.updateOrder()
                    window.opener.postMessage("processCompleted")
                case "reset-order":
                    sortableObj.resetOrder()
            }
        } catch (e) {
            alert(e)
        }
    })
}    

function activateSortable(tBodyElement) {
    const sortable = Sortable.create(tBodyElement, {
        handle: ".handle",
        chosenClass: "chosen",
        animation: 200,
        dataIdAttr: "data-sort-id",
        onUpdate: (evt) => {
            const target = evt.item 
            target.classList.toggle("table-warning",
                evt.newIndex != initialOrder.indexOf(target.dataset.sortId))
            console.log(target.dataset.sortId)
        } 
    })
    const initialOrder = sortable.toArray()

    return {
        sortable: sortable,

        updateOrder: async () => {
            const trList = Array.from(tBodyElement.querySelectorAll("tr"))
            const order = trList.map((tr) => tr.getAttribute("target"))
            const res = await fetch(window.location.href, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({"order": order})
            })
            if (res.ok) {}
            else { 
                throw new Error(res.statusText)
            }
        },

        resetOrder: () => {
            sortable.sort(initialOrder, true)
            tBodyElement.querySelectorAll("tr").forEach(e => {
                e.classList.remove("table-warning")
            })
        }
    }

}
    
window.addEventListener("beforeunload", e=> {
    window.opener.postMessage("processAborted")
})
