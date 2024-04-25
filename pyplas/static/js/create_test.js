
$(function() {
    document.querySelectorAll(".MD").forEach(function(elem) {
        registerEasyMDE(elem)
    })

    $(".btn-addMD").on("click", function(){
        var $append_tail = $(this).parent()
        addMD($append_tail)
    })

    $(".btn-addCode").on("click", function() {
        var $append_tail = $(this).parent()
        addCode($append_tail)
    })

    $(".btn-addQ").on("click", function() {
        var $append_tail = $(this).parent()
        addQ($append_tail)
    })

})

function addMD($append_tail) {
    $.ajax({
        url: `${window.location.origin}/create?action=addMD`,
        type: "POST",
        async: true,
    }).done((data) => {
        $elem = $(data.html)
        // $append_tail.after($elem)
        $(".p-content").append($elem)
        registerEasyMDE($elem.find(".MD")[0])
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

function addQ($append_tail) {
    $.ajax({
        url: `${window.location.origin}/create?action=addQ`,
        type: "POST",
        async: true
    }).done((data) => {
        $elem = $(data.html)
        $append_tail.after($elem)
    })
}
