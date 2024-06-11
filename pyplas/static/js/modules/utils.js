/**
 * node-id属性を持ち、classにnodeを持つelementを返す
 * @param {string} node_id 
 * @returns {Element}
 */
function getNodeElement(node_id) {
    return document.querySelector(`div[node-id='${node_id}'].node`)
}
/**
 * HTML文字列からdom要素に変換する
 * @param {string} str 
 * @returns {HTMLCollection}
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
 * Explain Nodeを追加する
 * @param {Element} loc 
 * @param {string} pos
 * @returns {Promise<Element>} .node-mde要素
 */
async function addMD(loc, pos, {
        content=String(), 
        allow_del=true, 
        code=true,
        explain=true,
        question=true} = {}) 
    {
    if (loc === undefined || pos === undefined) {
        new Error("argument Error")
    }
    const res = await fetch(`${window.location.origin}/api/render?action=addMD`, {
        method: "POST",
        headers: {
            "Content-type": "application/json"},
        body: JSON.stringify({
            "content": content,
            "allow_del": allow_del,
            "editor": true,
            "code": code,
            "explain": explain,
            "question": question
        })
    })
    const json = await res.json()
    const htmlString = json.html 
    loc.insertAdjacentHTML(pos, htmlString)
    const mde = document.querySelector("#sourceCode .explain:not([node-id]) .node-mde")
    registerAceMDE(mde)
    return mde
}
/**
 * Code Nodeを追加する.
 * @param {Element} loc 
 * @param {string} pos 
 * @returns {Promise<Element>} .node-code要素
 */
async function addCode(loc, pos, {
        content=String(), 
        user=0, 
        allow_del=true, 
        code=true, 
        explain=true, 
        question=true} = {}) 
    {
    if (loc === undefined || pos === undefined) {
        new Error("argument error")
    }
    const res = await fetch(`${window.location.origin}/api/render?action=addCode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "content": content, 
            "user": user, 
            "allow_del": allow_del, 
            "code": code, 
            "explain": explain, 
            "question": question
        })
    })
    const json = await res.json()
    const htmlString = json.html 
    loc.insertAdjacentHTML(pos, htmlString)
    const codeEditor = document.querySelector("#sourceCode .code:not([node-id]) .node-code")
    registerAceEditor(codeEditor)
    return codeEditor
}
/**
 * Question Nodeをappend_tailの後ろに追加する
 * @param {Element} loc 
 * @param {string} pos 
 * @param {Number} ptype
 */
async function addQ(loc, pos, ptype) {
    if (loc === undefined || pos == undefined || ptype === undefined) {
        new Error("argument error")
    }
    const res = await fetch(`${window.location.origin}/api/render?action=addQ`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": ptype,
            "code": true, 
            "explain": true,
            "question": true
        })
    })
    const json = await res.json()
    loc.insertAdjacentHTML(pos, json.html)
    if (ptype == 1) {
        registerAceEditor(document.querySelector("#sourceCode .code:not([node-id]) .node-code"))
    }
    const mde = document.querySelector("#sourceCode .explain:not([node-id]) .node-mde")
    registerAceMDE(mde)
    return mde.closest(".question")
}
/**
 * btnの親要素のNodeを削除する
 * @param {Element} btn 
 */
function delme(btn) {
    var node = btn.closest(".node")
    node.nextElementSibling.remove()
    node.remove()
}
/**
 * 質問の採点を行う
 * @param {string} p_id      問題id
 * @param {string} q_id      質問id
 * @param {string} kernel_id 実行カーネルid
 * @returns {none}
 */
async function scoring(p_id, q_id, kernel_id) {
    var question_node = document.querySelector(`.node.question[q-id="${q_id}"]`)
    var params = extractQuestionNode(question_node, mode=0)
    // POST /problems/<p_id>/scoring
    var res = await fetch(`${window.location.origin}/problems/${p_id}/scoring`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": params.ptype,     // int:   0 or 1
            "q_id": params.q_id,       // str:   e.g. "1"
            "answers": params.answers, // list:  ['ans', 'ans', ...]
            "kernel_id": kernel_id     // str:   uuid
        })})
    var json = await res.json()
    if (res.ok) {
        console.log(`[scoring] ${json.DESCR}`)
        question_node.setAttribute("progress", json.progress)
        var toast = question_node.querySelector(".for-toast > .toast")
        toast.querySelector(".toast-body").innerHTML = json.content
        toast.classList.add("show")
        document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`).setAttribute("progress", json.progress)
    }
    else {
        console.log(`[scoring] ${json.DESCR}`)
    }
}
/**
 * Code Testingをキャンセルする
 * @param {string} p_id       問題id
 * @param {string} kernel_id  実行カーネルのid
 */
async function cancelScoring(p_id, kernel_id) {
    var res = await fetch(`${window.location.origin}/problems/${p_id}/cancel?kernel_id=${kernel_id}`, {
        method: "POST",
    })
    var json = await res.json()
    console.log(json.DESCR)
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
/**
 * ユーザーの入力を保存する
 * @param {string} p_id 
 */
async function saveUserData(p_id) {
    var q_content = {}
    document.querySelectorAll(".question").forEach(elem => {
        var params = extractQuestionNode(elem, mode=0)
        q_content[params.q_id] = params.answers
    })
    var res = await fetch(`${window.location.origin}/problems/${p_id}/save`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "q_content": q_content
        })})
    var json = await res.json()
    console.log(`[save] ${json.DESCR}`)
}
/**
 * ipynbをparseして, locの末尾にnodeとして挿入する
 * @param {Element} input       form type="file"の要素 
 * @param {Element} loc         nodeを追加する要素
 * @param {boolean} markdown    markdownを追加するか
 */
async function loadIpynb(input, loc, markdown=true, {user=1, inQ=false}={}) {
    const ipynb = input.files[0]
    console.log(`[FileReader] Load '${ipynb.name}' and embed in page.`)
    const reader = new FileReader()
    reader.readAsText(ipynb)

    reader.onload = async () => {
        const cells = JSON.parse(reader.result).cells
    
        for (const cell of cells) {
            if (cell.cell_type == "code") {
                await addCode(loc, "beforeend", {
                    content: cell.source.join(""), 
                    user:user, 
                    allow_del:true,
                    explain: !inQ, 
                    question: !inQ
                })
            }
            else if (markdown && cell.cell_type == "markdown") {
                const mde = await addMD(loc, "beforeend", {
                    content:cell.source.join(""), 
                    allow_del:true,
                    explain: !inQ, 
                    question: !inQ
                })
                showPreview(mde)
            }
        }
    }
    
    reader.onerror = () => {
        alert("Ipynbファイルの読み込みに失敗しました.")
    }
}
