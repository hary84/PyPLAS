
/**
 * ページをパースしてサーバーに投げる
 * @returns {none}
 */
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

    var send_msg = {
        "p_id": crypto.randomUUID(),
        "title": title,
        "page": page,
        "answers": answers
    }

    fetch(`${window.location.origin}/create`,{
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(send_msg)
    }).then(response => response.json()).then(data => {
        if (data.status == 0) {
            alert("SAVE FAILURE")
        } else if (data.status == 1) {
            alert("SAVED")
        }
    })
}

