//@ts-check

if (window.opener !== null) {
    // Sortable.jsを有効化
    const tableBody = document.querySelector("#problemList tbody")
    const tableOrderSwitch = document.querySelector("input#activateOrderChange")
    const sortable = Sortable.create(tableBody, {
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
    console.log(initialOrder)
    
    document.addEventListener("click", async e=> {
        const btn = e.target?.closest(".btn")
        if (btn == null) {return}
        try {
            switch (btn.dataset.action) {
                case "update-order":
                    await updateOrder()
                        alert([
                        "Problem order is succesfully updated",
                        "This window is closed.",
                        "Check the original window.",
                    ].join("\n"))
                    window.opener.postMessage("processCompleted")
                case "reset-order":
                    await resetOrder()
            }
        } catch (e) {
            alert(e)
        }
    })
    
    async function updateOrder() {
        const trList = Array.from(tableBody.querySelectorAll("tr"))
        const order = trList.map((tr) => tr.getAttribute("target"))
        const res = await fetch(`${window.location.origin}/create/order`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({"order": order})
        })
        if (res.ok) {} 
        else {
            throw new Error(res.statusText)
        }
    }
    
    async function resetOrder() {
        sortable.sort(initialOrder, true)
        tableBody?.querySelectorAll("tr").forEach(e => {
            e.classList.remove("table-warning")
        })
    }
    window.addEventListener("beforeunload", e=> {
        window.opener.postMessage("processAborted")
    })
}
else {
    alert([
        "This URL cannot be opened directly.",
        "Please open it from the `Change Problem Order` button in /create."
    ].join("\n"))
    window.location.href = "/create"
}