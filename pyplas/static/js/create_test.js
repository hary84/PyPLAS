
/**
 * ページをパースしてサーバーに投げる
 * POST /create/<p_id>
 *  (send)
 *      title: str
 *      page: dict
 *          headersとbodyのdict
 *      answers: dict
 *          {<q_id>: [ans, ans, ...] }
 *  (receive)
 *      status: int
 * @returns {none}
 */
function registerProblem() {

    // var p_id = window.location.pathname.match(/([-a-zA-Z0-9]+)/g)[1]
    var title = document.querySelector("#titleForm").value
    if (title.length == 0) {
        alert("input problem title")
        return 
    }

    // 概要欄のSummary, Data Source, Environmentを取得
    var headers = []
    document.querySelectorAll("#summary .node-mde").forEach(function(elem) {
        var editor = ace.edit(elem)
        headers.push(editor.getValue())
    })

    // The Source CodeからNodeを取得
    var body = []
    var answers = {}
    var q_id = 1
    document.querySelectorAll("#sourceCode > .p-content > .node").forEach(function(elem) {
        // Explain Node
        if (elem.classList.contains("explain")) {
            var editor = ace.edit(elem.querySelector(".node-mde"))
            var content = editor.getValue()
            body.push({
                "type": "explain",
                "content": content
            })
        }
        // Code Node
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
        // Question Node
        else if (elem.classList.contains("question")) {
            elem.setAttribute("q-id", q_id)
            var params = extractQuestionNode(elem, mode=1)
            answers[`${q_id}`] = params.answers 
            body.push({
                "type": "question",
                "q_id": params.q_id,
                "ptype": params.ptype,
                "conponent": params.conponent,
                "question": params.question,
                "editable": params.editable,
            })
            q_id += 1
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
            alert("SAVE FAILURE\n" + data.error)
        }
        else if (data.status == 1) {
            window.location.href = `/create/${data.p_id}`
        }
    })
    console.log(send_msg)
}
/**
 * pageのstatus, category, titleを変更する
 * PUT /create/<p_id>
 *  (send)
 *      title: str
 *      category: int
 *      status: int 
 *  (receive)
 *      status: int
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
        console.log(`[editProblemparams] ${data.DESCR}`)
        if (data.status == 200) {
            window.location.reload()
        } 
    })
}

