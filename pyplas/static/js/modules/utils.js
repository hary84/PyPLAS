/**
 * HTML文字列からdom要素に変換する
 * @param {string} str 
 * @returns {[DOM]}
 */
function domFromStr(str) {
    var div = document.createElement("div")
    div.innerHTML = str 
    return div.children
}
/**
 * objのpropertyが変化した際にfuncを実行する
 * @param {object} obj 
 * @param {property} propName 
 * @param {function} func 
 */
function watchValue(obj, propName, func) {
    let value = obj[propName];
    Object.defineProperty(obj, propName, {
        get: () => value,
        set: newValue => {
            const oldValue = value;
            value = newValue;
            func(obj, newValue);
        },
        configurable: true
    });
}
/**
 * Explain Nodeをappend_tailの後ろに追加する
 * @param {DOM} append_tail 
 */
async function addMD(append_tail) {
    await fetch(`${window.location.origin}/api/render?action=addMD`, {
        method: "POST",
        headers: {
            "Content-type": "application/json"},
        body: JSON.stringify({"inQ": append_tail.closest(".question") ? true:false})
    })
    .then(response => response.json()).then(data => {
        var l = domFromStr(data.html)
        append_tail.insertAdjacentElement("afterend", l[1])
        append_tail.insertAdjacentElement("afterend", l[0])
        registerAceMDE(append_tail.nextElementSibling.querySelector(".node-mde"))
    })
}
/**
 * Code Nodeをappend_tailの後ろに追加する
 * @param {DOM} append_tail 
 */
async function addCode(append_tail) {
    await fetch(`${window.location.origin}/api/render?action=addCode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "inQ": append_tail.closest(".question") ? true:false,
            "user": window.location.pathname.split("/")[1] == "create"
        })
    })
    .then(response => response.json()).then(data => {
        var l = domFromStr(data.html)
        append_tail.insertAdjacentElement("afterend", l[1])
        append_tail.insertAdjacentElement("afterend", l[0])
        registerAceEditor(append_tail.nextElementSibling.querySelector(".node-code"))

    })
}
/**
 * Question Nodeをappend_tailの後ろに追加する
 * @param {DOM} append_tail 
 * @param {int} ptype 
 */
async function addQ(append_tail, ptype) {
    await fetch(`${window.location.origin}/api/render?action=addQ`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"ptype": ptype})
    })
    .then(response => response.json()).then(data => {
        var l = domFromStr(data.html)
        append_tail.insertAdjacentElement("afterend", l[1])
        append_tail.insertAdjacentElement("afterend", l[0])
        if (ptype == 1) {
            registerAceEditor(append_tail.nextElementSibling.querySelector(".node-code"))
        }
        registerAceMDE(append_tail.nextElementSibling.querySelector(".node-mde"))
    })
}
/**
 * btnの親要素のNodeを削除する
 * @param {DOM} btn 
 */
function delme(btn) {
    var node = btn.closest(".node")
    node.nextElementSibling.remove()
    node.remove()
}
/**
 * サーバーに採点を要請する
 * @param {DOM} question_node 
 */
async function scoring(question_node) {
    var params = extractQuestionNode(question_node, mode=0)
    var sbm_btn = question_node.querySelector(".btn-testing")
    sbm_btn.classList.add("disabled")
    console.log(params.answers)
    // POST /problems/<p_id>
    var res = await fetch(window.location.href, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": params.ptype,     // int:   0 or 1
            "q_id": params.q_id,       // str:   e.g. "1"
            "answers": params.answers, // list:  ['ans', 'ans', ...]
            "kernel_id": sessionStorage["kernel_id"] 
        })})
    var json = await res.json()
    var toast = question_node.querySelector(".for-toast")
    toast.innerHTML = json.html
    toast.querySelector(".toast").classList.add("show")
    sbm_btn.classList.remove("disabled")
    question_node.setAttribute("progress", json.progress)
    document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`).setAttribute("progress", json.progress)
}
/**
 * Code Testingをキャンセルする
 */
async function cancelScoring() {
    var res = await fetch(`${window.location.origin}/problems/${sessionStorage["kernel_id"]}`, {
        method: "DELETE",
    })
    var json = await res.json()
    if (json.status == 200) {
        console.log(`[cancelScoring()] ${json.DESCR}`)
    }
}
/**
 * Question Nodeから各パラメータを抽出する
 * @param {DOM} elem 
 * @param {int} mode 0: learner, 1: creator
 * @returns {object}
 */
function extractQuestionNode(elem, mode) {
    var q_id = elem.getAttribute("q-id")
    var ptype = Number(elem.getAttribute("ptype"))
    var conponent = []
    var question = ""
    var editable = false 
    var answers = []
    const parser = new DOMParser()
    // learner mode 
    if (mode == 0) {
        if (ptype == 0) {
            elem.querySelectorAll(".card-body > .explain > .q-text").forEach(elem => {
                answers.push(elem.querySelector("select, input").value) // answers
            }) 
        }
        else if (ptype == 1) {
            elem.querySelectorAll(".q-content  .node-code").forEach(elem => {
                answers.push(ace.edit(elem).getValue()) // answers
            })
        }
        return {
            "q_id": q_id,      // str
            "ptype": ptype,    // int 
            "answers": answers // list
        }
    }
    // creator mode 
    if (mode == 1) {
        if (ptype == 0) {
            var md_string = ace.edit(elem.querySelector(".node-mde")).getValue()
            var md_dom = parser.parseFromString(md_string, "text/html").querySelector("body")
            md_dom.querySelectorAll(".q-text > *[ans]").forEach(elem => { // answers
                answers.push(elem.getAttribute("ans"))
            })
            question = md_dom.innerHTML // question
        }
        else if (ptype == 1) {
            answers.push(ace.edit(elem.querySelector(".test-code .node-code")).getValue()) // answers
            question = ace.edit(elem.querySelector(".q-text .node-mde")).getValue() // question
            editable = elem.querySelector(".editable-flag").checked // editable
            if (!editable) { // conponent
                elem.querySelectorAll(".q-content > .node").forEach(elem => {
                    if (elem.classList.contains("explain")) {
                        var type = "explain"
                        var content = ace.edit(elem.querySelector(".node-mde")).getValue()
                    }
                    else if (elem.classList.contains("code")) {
                        var type = "code"
                        var content = ace.edit(elem.querySelector(".node-code")).getValue()
                    }
                    conponent.push({"type": type, content: content})
                })
            }
        }
        return {
            "q_id": q_id,           // str
            "ptype": ptype,         // int 
            "conponent": conponent, // list
            "question": question,   // str
            "editable": editable,   // bool
            "answers": answers      // list
        }
    }
}