
document.querySelectorAll(".node").forEach(function(elem) {
    var id = crypto.randomUUID()
    elem.setAttribute("node-id", id)
})

document.querySelectorAll(".node-code").forEach(function(elem) {
    registerAceEditor(elem)
})
