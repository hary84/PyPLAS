
$(function() {
    document.querySelectorAll(".node-mde").forEach(function(elem) {
        registerAceMDE(elem)
    })


})

function save() {
    var title = $("#titleForm").val()

    var headers = []

    $("#summary").find(".node-mde").each(function(idx) {
        var editor = ace.edit($(this)[0])
        headers.push(marked.parse(editor.getValue()))
    })

    var body = []
    var answers = {}

    $("#sourceCode > .p-content").children(".node").each(function(idx) {
        if ($(this).hasClass("explain")) {
            var editor = ace.edit($(this).find(".node-mde")[0])
            var content = marked.parse(editor.getValue())
            body.push({
                "type": "explain",
                "content": content
            })
        }
        else if ($(this).hasClass("code")) {
            var editor = ace.edit($(this).find(".node-code")[0])
            var content = editor.getValue()
            var readonly = $(this).find(".readonly-flag").prop("checked")
            body.push({
                "type": "code",
                "content": content,
                "readonly": readonly
            })
        }
        else if ($(this).hasClass("question")) {
            var qid = $(this).attr("q-id")
            var ptype = $(this).attr("ptype")
            var question = ""
            var conponent = []
            answers[qid] = []

            if (ptype == 0) {
                var editor = ace.edit($(this).find(".node-mde")[0])
                var html = marked.parse(editor.getValue())
                var question = ""
                
                var arr = []
                $html.each(function() {
                    $form = $(this).find("input, select")
                    answers[qid].push($form.attr("ans"))
                    $form.removeAttr("ans")
                    arr.push($(this)[0].outerHTML)
                })
                question = arr.join("\n")

                body.push({
                    "type": "question",
                    "qid": qid,
                    "question": question,
                    "ptype": ptype
                })

            } else {
                var editable = $(this).find(".editable-flag").prop("checked")
                
                question = marked.parse(
                    ace.edit($(this).find(".q-text .node-mde")[0]).getValue())

                var test_code = ace.edit($(this).find(".test-code .node-code")[0]).getValue()
                answers[qid].push(test_code)

                body.push({
                    "type": "question",
                    "qid": qid,
                    "question": question,
                    "ptype": ptype,
                    "editable": editable,
                })
            }
        }
    })

    var pages = {
        "title": title,
        "header": {"summary": headers[0],
                   "source": headers[1],
                   "env": headers[2]},
        "body": body
    }
    console.log(pages)
    console.log(answers)
}

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