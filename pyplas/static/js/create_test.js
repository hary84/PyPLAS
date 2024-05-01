
$(function() {
    document.querySelectorAll(".node-mde").forEach(function(elem) {
        registerAceMDE(elem)
    })
})

function addMD($append_tail) {
    $.ajax({
        url: `${window.location.origin}/create?action=addMD`,
        type: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify({"inQ": $append_tail.parents(".question").length > 0}),
    }).done((data) => {
        $elem = $(data.html)
        $append_tail.after($elem)
        registerAceMDE($elem.find(".node-mde")[0])
    })
}

function addCode($append_tail) {
    $.ajax({
        url: `${window.location.origin}/create?action=addCode`,
        type: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify({
            "inQ": $append_tail.parents(".question").length > 0,
            "user": window.location.pathname.split("/")[1] == "create" ? 1 : 0 }),
    }).done((data) => {
        $elem = $(data.html)
        $append_tail.after($elem)
        registerAceEditor($elem.find(".node-code")[0])
    })
}

function addQ($append_tail, ptype) {
    $.ajax({
        url: `${window.location.origin}/create?action=addQ`,
        type: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify({"ptype": ptype}),
    }).done((data) => {
        $elem = $(data.html)
        $append_tail.after($elem)
        if (ptype == 1) {
            registerAceEditor($elem.find(".node-code")[0])
            registerAceMDE($elem.find(".node-mde")[0])
        } else if (ptype == 0) {
            registerAceMDE($elem.find('.node-mde')[0])
        }
    })
}

function delU($btn) {
    $btn.parents(".node-control").prev().remove()
    $btn.parent().remove()
}

function delme($btn) {
    $node = $btn.closest(".node")
    $node.next(".node-control").remove()
    $node.remove()
}