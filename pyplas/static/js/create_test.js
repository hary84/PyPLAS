
$(function() {
    document.querySelectorAll(".node-mde").forEach(function(elem) {
        registerAceMDE(elem)
    })
})

function addMD($append_tail) {
    $.ajax({
        url: `${window.location.origin}/create?action=addMD`,
        type: "POST",
        async: true,
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
        async: true,
    }).done((data) => {
        $elem = $(data.html)
        $append_tail.after($elem)
        registerAceEditor($elem.find(".node-code")[0])
    })
}

function addQ($append_tail, type) {
    $.ajax({
        url: `${window.location.origin}/create?action=addQ&type=${type}`,
        type: "POST",
        async: true
    }).done((data) => {
        $elem = $(data.html)
        $append_tail.after($elem)
        if (type == "code") {
            registerAceEditor($elem.find(".node-code")[0])
        } else if (type == "html") {
            registerAceMDE($elem.find('.node-mde')[0])
        }
    })
}

function delU($btn) {
    $btn.parent().prev().remove()
    $btn.parent().remove()
}

function delL($btn) {
    $btn.parent().next().remove()
    $btn.parent().remove()
}
