
$(function() {
    document.querySelectorAll(".node-mde").forEach(function(elem) {
        registerAceMDE(elem)
    })


})

function problemSave() {
    var title = document.querySelector("#titleForm").value

    var headers = []

    document.querySelectorAll("#summary .node-mde").forEach(function(elem) {
        var editor = ace.edit(elem)
        headers.push(marked.parse(editor.getValue()))
    })

    var body = []
    var answers = {}

    const parser = new DOMParser()

    document.querySelectorAll("#sourceCode > .p-content > .node").forEach(function(elem) {
        if (elem.classList.contains("explain")) {
            var editor = ace.edit(elem.querySelector(".node-mde"))
            var content = marked.parse(editor.getValue())
            body.push({
                "type": "explain",
                "content": content
            })
        }
        else if (elem.classList.contains("code")) {
            var editor = ace.edit(elem.querySelector(".node-code"))
            var content = editor.getValue()
            var readonly = elem.querySelector(".readonly-flag").checked
            body.push({
                "type": "code",
                "content": content,
                "readonly": readonly
            })
        }
        else if (elem.classList.contains("question")) {
            var qid = elem.getAttribute("q-id")
            var ptype = elem.getAttribute("ptype")
            var question = ""
            var conponent = []
            answers[qid] = []

            if (ptype == 0) {
                var editor = ace.edit(elem.querySelector(".node-mde"))
                var html_str = marked.parse(editor.getValue())

                var html_dom = parser.parseFromString(html_str, "text/html").querySelector("body")
                console.log(html_dom)
                html_dom.querySelectorAll(".q-text > *[ans]").forEach(function(elem) {
                    answers[qid].push(elem.getAttribute("ans"))
                    elem.removeAttribute("ans")
                })

                question = html_dom.innerHTML

                body.push({
                    "type": "question",
                    "qid": qid,
                    "question": question,
                    "ptype": ptype
                })

            } else {
                var editable = elem.querySelector(".editable-flag").checked
                
                question = marked.parse(
                    ace.edit(elem.querySelector(".q-text .node-mde")).getValue())

                var test_code = ace.edit(elem.querySelector(".test-code .node-code")).getValue()
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

    var page = {
        "header": {"summary": headers[0],
                   "source": headers[1],
                   "env": headers[2]},
        "body": body
    }

    // await fetch()
    return title, page, answers, p_id
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