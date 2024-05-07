document.querySelectorAll(".node-mde").forEach(elem=>registerAceMDE(elem))
document.querySelectorAll(".node-code").forEach(elem=>registerAceEditor(elem))
/**
 * ページをパースしてサーバーに投げる
 * @returns {none}
 */
function problemSave() {

    var p_id = window.location.pathname.match(/([-a-zA-Z0-9]+)/g)[1]
    var title = document.querySelector("#titleForm").value
    if (title.length == 0) {
        alert("input problem title")
        return 
    }

    var headers = []

    document.querySelectorAll("#summary .node-mde").forEach(function(elem) {
        var editor = ace.edit(elem)
        headers.push(editor.getValue())
    })

    var body = []
    var answers = {}

    const parser = new DOMParser()

    document.querySelectorAll("#sourceCode > .p-content > .node").forEach(function(elem) {
        if (elem.classList.contains("explain")) {
            var editor = ace.edit(elem.querySelector(".node-mde"))
            var content = editor.getValue()
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
            var ptype = Number(elem.getAttribute("ptype"))
            var question = ""
            var conponent = []
            var editable = false
            answers[qid] = []

            if (ptype == 0) {
                var editor = ace.edit(elem.querySelector(".node-mde"))
                var html_str = editor.getValue()

                var html_dom = parser.parseFromString(html_str, "text/html").querySelector("body")
                html_dom.querySelectorAll(".q-text > *[ans]").forEach(function(elem) {
                    answers[qid].push(elem.getAttribute("ans"))
                    elem.removeAttribute("ans")
                })

                question = html_dom.innerHTML

            } else {
                var editable = elem.querySelector(".editable-flag").checked
                
                question = ace.edit(elem.querySelector(".q-text .node-mde")).getValue()

                var test_code = ace.edit(elem.querySelector(".test-code .node-code")).getValue()
                answers[qid].push(test_code)

            }

            body.push({
                "type": "question",
                "q_id": qid,
                "question": question,
                "ptype": ptype,
                "editable": editable,
            })
        }
    })

    var page = {
        "header": {"summary": headers[0],
                   "source": headers[1],
                   "env": headers[2]},
        "body": body
    }

    var send_msg = {
        "title": title,
        "page": page,
        "answers": answers
    }

    fetch(window.location.href,{
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(send_msg)
    }).then(response => response.json()).then(data => {
        if (data.status == 0) {
            alert("SAVE FAILURE")
        }
    })
}
/**
 * pageのstatus, category, titleを変更する
 * @param {DOM} btn 
 */
function editPageParams(btn) {
    var tr = btn.closest("tr")
    var p_id = tr.getAttribute("target")
    var title = tr.querySelector(".title-form").value
    var category = Number(tr.querySelector(".select-category").value)
    var status = Number(tr.querySelector(".select-status").value)
    console.log("edit page params")
    fetch(`${window.location.origin}/create/${p_id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"title": title, "category": category, "status": status})
    }).then(response => response.json()).then(data => {
        if (data.status == 0) {
            alert("SAVE FAILED")
        } else if (data.status == 1) {
            window.location.reload()
        }
    })
}

